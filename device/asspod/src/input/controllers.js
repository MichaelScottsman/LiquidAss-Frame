// Reads both thumbsticks (tilt and click) and the right controller's A, B and menu (hamburger)
// buttons from SteamVR's own
// controller models, inside SteamVR's systemui page. SteamVR animates each model's parts from the
// live input whatever has input focus, and VRHTML.VRRenderModels.GetComponentStateForDevicePath
// returns a part's current pose: Steam's UI only gets digital presses while the dashboard is up,
// and nothing at all for the sticks.
//
// Measured on the Frame (2026-10-09, both sticks circled and clicked): the thumbstick's pose is a
// rotation about a pivot P below the stick, in the model's frame (x right, y up, -z forward):
// xf = R x + (I - R) P to 0.05 mm. Its rotation vectors lie in the plane normal to the stick's axis,
// up to |v| = 0.17 (full tilt). A click pushes the stick about 0.5 mm into the controller, along
// the axis. A and B move about 1.4 mm. (The left controller's model has no parts for its face
// buttons: those come from Steam, through the daemon.)

const DEV = { left: '/user/hand/left', right: '/user/hand/right' };
const RENDER_MODEL_NAME = 1003;          // ETrackedDeviceProperty Prop_RenderModelName_String
// Per hand: the stick's pivot P (m) and its axis out of the controller, from the fits above.
const STICK = {
  right: { P: [-0.0218, -0.0049, 0.0564], axis: [-0.173, 0.807, -0.565] },
  left: { P: [0.0218, -0.0049, 0.0565], axis: [0.168, 0.797, -0.581] },
};
const FULL_TILT = 0.165;                 // |vector part of the rotation| at full deflection
const CLICK_M = 0.00025;                 // pushed in this far = clicked
const CLICK_OFF_M = 0.00015;             // ... and released below this (hysteresis)
const BUTTON_M = 0.0006;                 // a face button moved this far = down
const BUTTON_OFF_M = 0.0003;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// The stick's right and forward directions, in the plane normal to its axis.
function basis(axis) {
  const s = norm(axis);
  const proj = (v) => { const k = dot(v, s); return norm([v[0] - k * s[0], v[1] - k * s[1], v[2] - k * s[2]]); };
  return { s, right: proj([1, 0, 0]), fwd: proj([0, 0, -1]) };
}

function rotate(q, v) {
  // v' = v + 2w (u x v) + 2 u x (u x v), q = (w, u)
  const u = [q.x, q.y, q.z];
  const t = cross(u, v).map((c) => 2 * c);
  const ut = cross(u, t);
  return [v[0] + q.w * t[0] + ut[0], v[1] + q.w * t[1] + ut[1], v[2] + q.w * t[2] + ut[2]];
}

export function createControllerReader() {
  const VR = globalThis.VRHTML;
  const hands = {};
  for (const side of ['left', 'right']) {
    hands[side] = { side, dev: DEV[side], rm: null, stick: null, b: null, ...basis(STICK[side].axis),
      P: STICK[side].P, clicked: false, btn: {}, down: {}, x: 0, y: 0, ok: false, err: null };
  }

  function component(h, source) {
    try { return VR.VRRenderModelsInternal.FindComponentForInputSource(h.rm, source) || null; } catch (_) { return null; }
  }
  function resolve(h) {
    if (h.rm) return true;
    try { h.rm = VR.VRProperties.GetStringProperty(h.dev, RENDER_MODEL_NAME) || null; } catch (_) { h.rm = null; }
    if (!h.rm) return false;
    h.stick = component(h, '/input/thumbstick');
    h.btn = {};
    if (h.side === 'right') for (const [k, src] of [['a', '/input/a'], ['b', '/input/b'], ['menu', '/input/menu']]) {
      const c = component(h, src);
      if (c) h.btn[k] = c;
    }
    return true;
  }
  function pose(h, comp) {
    try {
      const st = VR.VRRenderModels.GetComponentStateForDevicePath(h.rm, comp, h.dev);
      return st && st.xfTrackingToComponentRenderModel;
    } catch (_) { return null; }
  }

  function readHand(h) {
    h.ok = false;
    if (!VR || !resolve(h) || !h.stick) { h.x = h.y = 0; return; }
    const xf = pose(h, h.stick);
    if (!xf) { h.x = h.y = 0; return; }
    let q = xf.rotation;
    if (q.w < 0) q = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
    const v = [q.x, q.y, q.z];
    // The tip moves along v x axis; its right and forward parts are the stick's x and y.
    const d = cross(v, h.s);
    let x = dot(d, h.right) / FULL_TILT;
    let y = dot(d, h.fwd) / FULL_TILT;
    const r = Math.hypot(x, y);
    if (r > 1) { x /= r; y /= r; }
    h.x = x;
    h.y = y;
    // What the rotation about the pivot does not explain is the click, along the axis (inward).
    const t = [xf.translation.x, xf.translation.y, xf.translation.z];
    const rp = rotate(q, h.P);
    const resid = [t[0] - (h.P[0] - rp[0]), t[1] - (h.P[1] - rp[1]), t[2] - (h.P[2] - rp[2])];
    const depth = -dot(resid, h.s);
    h.clicked = h.clicked ? depth > CLICK_OFF_M : depth > CLICK_M;
    for (const [k, comp] of Object.entries(h.btn)) {
      const bx = pose(h, comp);
      const m = bx ? Math.hypot(bx.translation.x, bx.translation.y, bx.translation.z) : 0;
      h.down[k] = h.down[k] ? m > BUTTON_OFF_M : m > BUTTON_M;
    }
    h.ok = true;
  }

  return {
    /** Reads both hands now. */
    update() { readHand(hands.left); readHand(hands.right); },
    /** One wheel thumb from both sticks: the one tilted further drives it; either click presses. */
    wheel() {
      const l = hands.left;
      const r = hands.right;
      const src = Math.hypot(r.x, r.y) >= Math.hypot(l.x, l.y) ? r : l;
      return { x: src.x, y: src.y, pressed: l.clicked || r.clicked };
    },
    get hands() { return hands; },
    /** The right controller's buttons now: { a, b, menu } (true while held). */
    get buttons() { return hands.right.down; },
    /** Whether the right controller's buttons can be read here (else Steam's relay is used). */
    get rightButtons() { return hands.right.ok && Object.keys(hands.right.btn).length > 0; },
    debug() {
      const o = {};
      for (const h of Object.values(hands)) {
        o[h.side] = { ok: h.ok, rm: h.rm, x: Math.round(h.x * 100) / 100, y: Math.round(h.y * 100) / 100, clicked: h.clicked,
          buttons: Object.assign({}, h.down) };
      }
      return o;
    },
  };
}
