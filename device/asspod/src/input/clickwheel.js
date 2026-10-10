// Click wheel state machine: turns a 2D "finger" sample per frame into assPod wheel events.
// Pure module (no DOM, no three.js) so Node can unit-test it and any input source can drive it:
// the XR thumbstick, a desktop mouse drag on the 3D wheel, or a test script.
//
// Conventions (see the design spec, section 3.1):
//   input  { x, y, pressed }, x right, y UP, magnitude clamped to 1 (XR callers pass y = -axes[3])
//   angle  radians, 0 = top (MENU), increasing clockwise: pi/2 Next, pi Play/Pause, 3pi/2 Previous
//   scroll +1 = clockwise = next item / volume up

// ---------------------------------------------------------------- constants

/** Wheel buttons by 90 degree sector: top, right, bottom, left. */
export const SECTOR_PARTS = Object.freeze(['menu', 'next', 'play', 'prev']);

export const DEFAULTS = Object.freeze({
  step: Math.PI / 12,   // 15 degrees per detent: 24 scroll steps per revolution
  touchOn: 0.45,        // a touch starts at this radius ...
  touchOff: 0.30,       // ... and only ends below this one, so a stick resting near the edge doesn't flicker
  scrollMinR: 0.6,      // angle is only trusted for scrolling out on the ring; near the center atan2 is noise
  centerR: 0.45,        // a press inside this radius is the center (Select) button
  holdS: 0.5,
  longHoldS: 2.0,
});

const TAU = Math.PI * 2;
// Lets an exact full turn (24 x 15 degrees summed from float atan2 deltas) land on exactly 24 steps.
const STEP_EPS = 1e-6;
// Returned when a frame produces no events, so idle frames allocate nothing. Treat results as read-only.
const NO_EVENTS = Object.freeze([]);

/**
 * @typedef {'menu'|'next'|'play'|'prev'|'select'} Part
 * @typedef {{ x: number, y: number, pressed: boolean }} WheelInput
 * @typedef {{ type: 'touch', active: true, angle: number }
 *   | { type: 'touch', active: false }
 *   | { type: 'scroll', delta: 1 | -1 }
 *   | { type: 'press', part: Part }
 *   | { type: 'hold', part: Part }
 *   | { type: 'longhold', part: Part }
 *   | { type: 'release', part: Part, held: boolean, cancelled?: true }} WheelEvent
 * @typedef {{ touching: boolean, angle: number, radius: number, pressedPart: Part | null }} WheelState
 * @typedef {{ update(input: WheelInput | null, dt: number): readonly WheelEvent[],
 *             readonly state: WheelState, reset(): WheelEvent[] }} ClickWheel
 */

// ---------------------------------------------------------------- helpers

/** Normalizes any angle into [0, 2pi). */
function norm(a) {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}

/** Wraps an angle difference into (-pi, pi], so crossing 0/2pi counts as a small step. */
function wrapDelta(d) {
  while (d > Math.PI) d -= TAU;
  while (d <= -Math.PI) d += TAU;
  return d;
}

/**
 * Maps a wheel angle to the button under it: 90 degree sectors centered on each label,
 * so MENU covers [-45, 45), Next [45, 135), Play [135, 225), Previous [225, 315).
 * @param {number} angle radians, 0 = top, clockwise
 * @returns {'menu'|'next'|'play'|'prev'}
 */
export function angleToPart(angle) {
  const i = Math.floor((norm(angle) + Math.PI / 4) / (Math.PI / 2)) % 4;
  return SECTOR_PARTS[i];
}

// ---------------------------------------------------------------- state machine

/**
 * @param {Partial<typeof DEFAULTS>} [opts]
 * @returns {ClickWheel}
 */
export function createClickWheel(opts = {}) {
  const o = { ...DEFAULTS, ...opts };

  /** @type {WheelState} live object, mutated in place (read it, don't keep copies expecting them to change) */
  const state = { touching: false, angle: 0, radius: 0, pressedPart: null };

  let wasPressed = false;
  let acc = 0;             // accumulated, not yet emitted rotation (radians)
  let prevAngle = 0;
  let prevOnRing = false;  // previous sample was touching with r >= scrollMinR
  let pressT = 0;
  let holdFired = false;
  let longFired = false;
  /** @type {WheelEvent[] | null} */
  let out = null;

  function emit(e) {
    (out ??= []).push(e);
  }

  /**
   * Feeds one frame of input. Returns the events it produced, in order: touch start, scrolls,
   * press / hold / longhold / release, touch end.
   * @param {WheelInput | null} input null = untouched and unpressed
   * @param {number} dt seconds since the previous call
   */
  function update(input, dt) {
    out = null;
    const x = input ? input.x : 0;
    const y = input ? input.y : 0;
    const pressed = !!(input && input.pressed);
    const r = Math.min(1, Math.hypot(x, y));
    state.radius = r;
    // Keep the last meaningful angle when the finger drifts to the center, so the
    // touch marker fades out where it was instead of snapping to the top.
    if (r >= o.touchOff) state.angle = norm(Math.atan2(x, y));
    const angle = state.angle;
    const onRing = r >= o.scrollMinR;

    // Touch start. No scroll on this frame: the first sample only seeds the accumulator.
    if (!state.touching && r >= o.touchOn) {
      state.touching = true;
      acc = 0;
      prevAngle = angle;
      prevOnRing = onRing;
      emit({ type: 'touch', active: true, angle });
    } else if (state.touching && r >= o.touchOff) {
      // Scroll. Keep tracking the angle while pressed so releasing doesn't dump the
      // rotation made during the press into a burst of scrolls.
      if (!wasPressed && !pressed && prevOnRing && onRing) {
        acc += wrapDelta(angle - prevAngle);
        while (acc >= o.step - STEP_EPS) { acc -= o.step; emit({ type: 'scroll', delta: 1 }); }
        while (acc <= -o.step + STEP_EPS) { acc += o.step; emit({ type: 'scroll', delta: -1 }); }
      }
      prevAngle = angle;
      prevOnRing = onRing;
    }

    // Buttons. The part is decided on the rising edge and stays latched until release,
    // even if the stick slides into another sector while held down.
    if (pressed && !wasPressed) {
      const part = r < o.centerR ? 'select' : angleToPart(angle);
      state.pressedPart = part;
      pressT = 0;
      holdFired = false;
      longFired = false;
      emit({ type: 'press', part });
    } else if (pressed && wasPressed) {
      pressT += dt || 0;
      if (!holdFired && pressT >= o.holdS - 1e-9) {
        holdFired = true;
        emit({ type: 'hold', part: state.pressedPart });
      }
      if (!longFired && pressT >= o.longHoldS - 1e-9) {
        longFired = true;
        emit({ type: 'longhold', part: state.pressedPart });
      }
    } else if (!pressed && wasPressed) {
      emit({ type: 'release', part: state.pressedPart, held: holdFired });
      state.pressedPart = null;
      acc = 0;
    }
    wasPressed = pressed;

    // Touch end (hysteresis: only below touchOff).
    if (state.touching && r < o.touchOff) {
      state.touching = false;
      prevOnRing = false;
      acc = 0;
      emit({ type: 'touch', active: false });
    }

    return out ?? NO_EVENTS;
  }

  /**
   * Ends any press or touch (e.g. when the assPod is dropped) and returns the closing events. The
   * release is marked cancelled: the click was never finished, so it must not act like one.
   */
  function reset() {
    /** @type {WheelEvent[]} */
    const events = [];
    if (wasPressed) events.push({ type: 'release', part: state.pressedPart, held: holdFired, cancelled: true });
    if (state.touching) events.push({ type: 'touch', active: false });
    wasPressed = false;
    state.touching = false;
    state.pressedPart = null;
    state.radius = 0;
    acc = 0;
    prevOnRing = false;
    pressT = 0;
    holdFired = false;
    longFired = false;
    return events;
  }

  return {
    update,
    reset,
    get state() { return state; },
  };
}
