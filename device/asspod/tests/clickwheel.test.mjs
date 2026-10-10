// Unit tests for the click wheel state machine. Run: node --test device/asspod/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleToPart, createClickWheel, DEFAULTS, SECTOR_PARTS } from '../src/input/clickwheel.js';

// ---------------------------------------------------------------- helpers

const DEG = Math.PI / 180;
const DT = 1 / 72;

/** Stick sample at a wheel angle (degrees, 0 = top, clockwise) and radius. */
function at(deg, r = 1, pressed = false) {
  return { x: r * Math.sin(deg * DEG), y: r * Math.cos(deg * DEG), pressed };
}

function scrolls(events) {
  return events.filter((e) => e.type === 'scroll').reduce((s, e) => s + e.delta, 0);
}

function ofType(events, type) {
  return events.filter((e) => e.type === type);
}

/** Feeds a sequence of samples and returns every event produced, in order. */
function feed(wheel, samples, dt = DT) {
  const all = [];
  for (const s of samples) all.push(...wheel.update(s, dt));
  return all;
}

// ---------------------------------------------------------------- sectors

test('exports match the contract', () => {
  assert.deepEqual([...SECTOR_PARTS], ['menu', 'next', 'play', 'prev']);
  assert.equal(DEFAULTS.step, Math.PI / 12);
  assert.equal(DEFAULTS.touchOn, 0.45);
  assert.equal(DEFAULTS.touchOff, 0.30);
  assert.equal(DEFAULTS.scrollMinR, 0.6);
  assert.equal(DEFAULTS.centerR, 0.45);
  assert.equal(DEFAULTS.holdS, 0.5);
  assert.equal(DEFAULTS.longHoldS, 2.0);
});

test('angleToPart: the four sector centers', () => {
  assert.equal(angleToPart(0), 'menu');
  assert.equal(angleToPart(90 * DEG), 'next');
  assert.equal(angleToPart(180 * DEG), 'play');
  assert.equal(angleToPart(270 * DEG), 'prev');
});

test('angleToPart: boundaries at 44 and 46 degrees around each sector', () => {
  assert.equal(angleToPart(44 * DEG), 'menu');
  assert.equal(angleToPart(46 * DEG), 'next');
  assert.equal(angleToPart(134 * DEG), 'next');
  assert.equal(angleToPart(136 * DEG), 'play');
  assert.equal(angleToPart(224 * DEG), 'play');
  assert.equal(angleToPart(226 * DEG), 'prev');
  assert.equal(angleToPart(314 * DEG), 'prev');
  assert.equal(angleToPart(316 * DEG), 'menu');
  assert.equal(angleToPart(-44 * DEG), 'menu');
  assert.equal(angleToPart(-46 * DEG), 'prev');
  assert.equal(angleToPart((360 + 90) * DEG), 'next');
});

test('pressing the stick toward each sector presses that part', () => {
  for (const [deg, part] of [[0, 'menu'], [90, 'next'], [180, 'play'], [270, 'prev'], [44, 'menu'], [46, 'next']]) {
    const w = createClickWheel();
    w.update(at(deg), DT);
    const ev = w.update(at(deg, 1, true), DT);
    assert.deepEqual(ofType(ev, 'press'), [{ type: 'press', part }], `at ${deg} degrees`);
    assert.equal(w.state.pressedPart, part);
  }
});

test('XR convention: stick pushed forward (axes[3] = -1, y = +1) is MENU at angle 0', () => {
  const w = createClickWheel();
  const ev = w.update({ x: 0, y: -(-1), pressed: false }, DT);
  assert.equal(ev[0].type, 'touch');
  assert.ok(Math.abs(ev[0].angle) < 1e-9);
  assert.deepEqual(ofType(w.update({ x: 0, y: 1, pressed: true }, DT), 'press'), [{ type: 'press', part: 'menu' }]);
});

// ---------------------------------------------------------------- center press

test('a centered press is select, with no touch events', () => {
  const w = createClickWheel();
  assert.equal(w.update({ x: 0, y: 0, pressed: false }, DT).length, 0);
  const ev = w.update({ x: 0.1, y: -0.2, pressed: true }, DT);
  assert.deepEqual(ev, [{ type: 'press', part: 'select' }]);
  assert.deepEqual(w.update({ x: 0, y: 0, pressed: false }, DT), [{ type: 'release', part: 'select', held: false }]);
});

test('a press inside the hysteresis band (touching, r < centerR) is select', () => {
  const w = createClickWheel();
  w.update(at(90, 1), DT);
  w.update(at(90, 0.4), DT); // still touching (above touchOff) but inside the center button
  assert.equal(w.state.touching, true);
  assert.deepEqual(ofType(w.update(at(90, 0.4, true), DT), 'press'), [{ type: 'press', part: 'select' }]);
});

test('null input means untouched and unpressed', () => {
  const w = createClickWheel();
  assert.deepEqual(w.update(null, DT), []);
  w.update(at(180, 1, true), DT);
  const ev = w.update(null, DT);
  assert.deepEqual(ev, [{ type: 'release', part: 'play', held: false }, { type: 'touch', active: false }]);
});

// ---------------------------------------------------------------- scrolling

test('one full clockwise turn in 2 degree steps scrolls exactly +24', () => {
  const w = createClickWheel();
  const samples = [];
  for (let d = 0; d <= 360; d += 2) samples.push(at(d));
  const ev = feed(w, samples);
  assert.equal(scrolls(ev), 24);
  assert.equal(ofType(ev, 'scroll').length, 24);
  assert.ok(ofType(ev, 'scroll').every((e) => e.delta === 1));
});

test('one full counter-clockwise turn in 2 degree steps scrolls exactly -24', () => {
  const w = createClickWheel();
  const samples = [];
  for (let d = 0; d >= -360; d -= 2) samples.push(at(d));
  const ev = feed(w, samples);
  assert.equal(scrolls(ev), -24);
  assert.ok(ofType(ev, 'scroll').every((e) => e.delta === -1));
});

test('starting the turn at another angle and crossing 0 still gives 24', () => {
  const w = createClickWheel();
  const samples = [];
  for (let d = 200; d <= 560; d += 2) samples.push(at(d));
  assert.equal(scrolls(feed(w, samples)), 24);
});

test('two turns at partial radius (0.8) scroll 48', () => {
  const w = createClickWheel();
  const samples = [];
  for (let d = 0; d <= 720; d += 3) samples.push(at(d, 0.8));
  assert.equal(scrolls(feed(w, samples)), 48);
});

test('+-5 degree jitter never scrolls', () => {
  for (const base of [0, 37, 90, 180, 359]) {
    const w = createClickWheel();
    const samples = [at(base)];
    for (let i = 0; i < 200; i++) samples.push(at(base + (i % 2 ? 5 : -5)));
    for (let i = 0; i < 200; i++) samples.push(at(base + 5 * Math.sin(i * 0.7)));
    assert.equal(ofType(feed(w, samples), 'scroll').length, 0, `base ${base}`);
  }
});

test('one detent needs a full 15 degrees', () => {
  const w = createClickWheel();
  w.update(at(0), DT);
  assert.equal(scrolls(w.update(at(14), DT)), 0);
  assert.equal(scrolls(w.update(at(15.5), DT)), 1);
  // Coming back 15 degrees from the post-scroll remainder does not immediately scroll back.
  assert.equal(scrolls(w.update(at(5), DT)), 0);
  assert.equal(scrolls(w.update(at(-0.5), DT)), -1);
});

test('a fast flick emits several scrolls in one frame', () => {
  const w = createClickWheel();
  w.update(at(0), DT);
  const ev = w.update(at(50), DT);
  assert.equal(scrolls(ev), 3);
});

test('no scroll below scrollMinR even while touching', () => {
  const w = createClickWheel();
  const samples = [];
  for (let d = 0; d <= 360; d += 2) samples.push(at(d, 0.55));
  const ev = feed(w, samples);
  assert.equal(w.state.touching, true);
  assert.equal(ofType(ev, 'scroll').length, 0);
});

test('dipping inside scrollMinR does not count the rotation made there', () => {
  const w = createClickWheel();
  w.update(at(0), DT);
  w.update(at(10, 0.5), DT);
  w.update(at(170, 0.5), DT); // swing around near the center: ignored
  assert.equal(scrolls(w.update(at(175, 1), DT)), 0); // back on the ring: re-seeds, no burst
  assert.equal(scrolls(w.update(at(191, 1), DT)), 1);
});

// ---------------------------------------------------------------- touch hysteresis

test('touch starts at 0.45 and ends below 0.30', () => {
  const w = createClickWheel();
  assert.deepEqual(w.update(at(90, 0.44), DT), []);
  assert.equal(w.state.touching, false);
  const start = w.update(at(90, 0.45), DT);
  assert.equal(start.length, 1);
  assert.equal(start[0].type, 'touch');
  assert.equal(start[0].active, true);
  assert.ok(Math.abs(start[0].angle - Math.PI / 2) < 1e-9);
  assert.equal(w.state.touching, true);
  assert.deepEqual(w.update(at(90, 0.35), DT), []);
  assert.deepEqual(w.update(at(90, 0.30), DT), []);
  assert.equal(w.state.touching, true);
  assert.deepEqual(w.update(at(90, 0.29), DT), [{ type: 'touch', active: false }]);
  assert.equal(w.state.touching, false);
  assert.deepEqual(w.update(at(90, 0.40), DT), []);
  assert.equal(w.state.touching, false);
});

test('no scroll on the frame a touch starts, even after a big jump', () => {
  const w = createClickWheel();
  w.update(at(0, 0.2), DT); // resting near the center at the top
  const ev = w.update(at(120, 1), DT); // jumps straight to the ring far away
  assert.deepEqual(ev.map((e) => e.type), ['touch']);
  assert.equal(scrolls(w.update(at(122, 1), DT)), 0);
  assert.equal(scrolls(w.update(at(136, 1), DT)), 1);
});

test('the accumulator resets when a new touch starts', () => {
  const w = createClickWheel();
  w.update(at(0), DT);
  w.update(at(14), DT); // 14 degrees pending
  w.update(null, DT); // touch ends
  w.update(at(14), DT); // new touch
  assert.equal(scrolls(w.update(at(16), DT)), 0); // would have scrolled if 14 degrees had carried over
});

test('state reports radius and angle', () => {
  const w = createClickWheel();
  w.update(at(270, 0.8), DT);
  assert.ok(Math.abs(w.state.radius - 0.8) < 1e-9);
  assert.ok(Math.abs(w.state.angle - 1.5 * Math.PI) < 1e-9);
  w.update({ x: 3, y: 0, pressed: false }, DT);
  assert.equal(w.state.radius, 1); // clamped
});

// ---------------------------------------------------------------- hold and longhold

test('hold fires once at 0.5 s and longhold once at 2.0 s, then release reports held', () => {
  const w = createClickWheel();
  w.update(at(90), DT);
  const ev = [...w.update(at(90, 1, true), DT)];
  let t = 0;
  let holdAt = -1;
  let longAt = -1;
  const step = 1 / 60;
  while (t < 3) {
    t += step;
    for (const e of w.update(at(90, 1, true), step)) {
      ev.push(e);
      if (e.type === 'hold') holdAt = t;
      if (e.type === 'longhold') longAt = t;
    }
  }
  assert.equal(ofType(ev, 'hold').length, 1);
  assert.equal(ofType(ev, 'longhold').length, 1);
  assert.ok(holdAt >= 0.5 - 1e-9 && holdAt < 0.5 + step + 1e-9, `hold at ${holdAt}`);
  assert.ok(longAt >= 2.0 - 1e-9 && longAt < 2.0 + step + 1e-9, `longhold at ${longAt}`);
  assert.deepEqual(ofType(ev, 'hold')[0], { type: 'hold', part: 'next' });
  assert.deepEqual(ofType(ev, 'longhold')[0], { type: 'longhold', part: 'next' });
  assert.deepEqual(w.update(at(90), DT), [{ type: 'release', part: 'next', held: true }]);
});

test('hold timing with exact 0.1 s frames', () => {
  const w = createClickWheel();
  w.update(at(180, 1, true), 0.1);
  const seen = [];
  for (let i = 1; i <= 25; i++) for (const e of w.update(at(180, 1, true), 0.1)) seen.push([i, e.type]);
  assert.deepEqual(seen, [[5, 'hold'], [20, 'longhold']]);
});

test('a short press releases with held: false and no hold events', () => {
  const w = createClickWheel();
  const ev = feed(w, [at(270), at(270, 1, true), at(270, 1, true), at(270, 1, true), at(270)], 0.1);
  assert.deepEqual(ev.filter((e) => e.type !== 'touch'), [
    { type: 'press', part: 'prev' },
    { type: 'release', part: 'prev', held: false },
  ]);
});

test('a centered hold also fires hold and longhold for select', () => {
  const w = createClickWheel();
  const ev = feed(w, Array.from({ length: 30 }, () => ({ x: 0, y: 0, pressed: true })), 0.1);
  assert.deepEqual(ev.map((e) => e.type + ':' + e.part), ['press:select', 'hold:select', 'longhold:select']);
});

// ---------------------------------------------------------------- press suppresses scroll, part latching

test('pressing suspends scrolling, and the part stays latched while the stick moves', () => {
  const w = createClickWheel();
  w.update(at(0), DT);
  const press = w.update(at(0, 1, true), DT);
  assert.deepEqual(ofType(press, 'press'), [{ type: 'press', part: 'menu' }]);
  const during = [];
  for (let d = 2; d <= 180; d += 2) during.push(...w.update(at(d, 1, true), 0.001)); // quick: no hold
  assert.equal(ofType(during, 'scroll').length, 0);
  assert.equal(w.state.pressedPart, 'menu');
  // Slide into the center while still pressed: touch ends, part stays latched.
  const center = w.update({ x: 0, y: 0, pressed: true }, 0.001);
  assert.deepEqual(center, [{ type: 'touch', active: false }]);
  assert.equal(w.state.pressedPart, 'menu');
  assert.deepEqual(w.update({ x: 0, y: 0, pressed: false }, DT), [{ type: 'release', part: 'menu', held: false }]);
  assert.equal(w.state.pressedPart, null);
});

test('releasing after rotating while pressed does not dump the rotation into scrolls', () => {
  const w = createClickWheel();
  w.update(at(0), DT);
  w.update(at(0, 1, true), DT);
  for (let d = 2; d <= 90; d += 2) w.update(at(d, 1, true), 0.001);
  const rel = w.update(at(90), DT);
  assert.deepEqual(rel, [{ type: 'release', part: 'menu', held: false }]);
  assert.equal(scrolls(w.update(at(92), DT)), 0);
  // Scrolling works again after the release, starting from a clean accumulator.
  const after = feed(w, [at(100), at(107), at(108)]);
  assert.equal(scrolls(after), 1);
});

test('the release frame accumulator is reset', () => {
  const w = createClickWheel();
  w.update(at(0), DT);
  w.update(at(14), DT); // 14 degrees pending
  w.update(at(14, 1, true), DT);
  w.update(at(14), DT); // release resets it
  assert.equal(scrolls(w.update(at(16), DT)), 0);
});

// ---------------------------------------------------------------- reset and allocation

test('reset() closes an open press and touch', () => {
  const w = createClickWheel();
  w.update(at(90, 1, true), DT);
  for (let i = 0; i < 40; i++) w.update(at(90, 1, true), 1 / 60);
  const ev = w.reset();
  assert.deepEqual(ev, [{ type: 'release', part: 'next', held: true, cancelled: true }, { type: 'touch', active: false }]);
  assert.equal(w.state.touching, false);
  assert.equal(w.state.pressedPart, null);
  assert.deepEqual(w.reset(), []);
  // After a reset, still holding the button down is a fresh press.
  assert.deepEqual(ofType(w.update(at(90, 1, true), DT), 'press'), [{ type: 'press', part: 'next' }]);
});

test('reset() during a short click returns a cancelled release; a normal release is never cancelled', () => {
  const w = createClickWheel();
  w.update(at(90, 1, true), DT);
  w.update(at(90, 1, true), DT);
  assert.deepEqual(w.reset(), [{ type: 'release', part: 'next', held: false, cancelled: true }, { type: 'touch', active: false }]);
  w.update(null, DT);
  w.update(at(0, 0, true), DT);
  const rel = ofType(w.update(at(0, 0, false), DT), 'release');
  assert.deepEqual(rel, [{ type: 'release', part: 'select', held: false }]);
  assert.equal('cancelled' in rel[0], false);
});

test('idle frames return the same empty array (no per-frame allocation)', () => {
  const w = createClickWheel();
  const a = w.update(null, DT);
  const b = w.update(at(90, 0.1), DT);
  assert.equal(a.length, 0);
  assert.equal(a, b);
  assert.ok(Object.isFrozen(a));
});

test('custom options are honored', () => {
  const w = createClickWheel({ step: Math.PI / 6 });
  const samples = [];
  for (let d = 0; d <= 360; d += 2) samples.push(at(d));
  assert.equal(scrolls(feed(w, samples)), 12);
});
