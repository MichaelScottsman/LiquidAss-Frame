// The assPod's nodes in SteamVR's scene graph (systemui page): the assPod in one hand (the original
// 3D model as SteamVR render models, device/asspod/model, with the live screen on a panel), and
// while it is out an invisible laser blocker where the menu was, with "(menu glyph) to close".
//
//   vsg-transform parent-path=/user/hand/<side>                the controller's pose
//     vsg-transform (HOLD)                                      the body's centre in the hand (wheel over the stick)
//       vsg-transform scale            > rendermodel x7         the body, the model's metres scaled up
//       vsg-transform (front + 0.25 mm) > panel                 the screen, the touch marker, the glass's reflection
//       vsg-transform (back - 0.25 mm, turned) > panel          the steel back's live reflection (reflect.js)
//   vsg-transform parent-id=<Steam main window>_BottomCenter   follows the window (frame units)
//     vsg-transform (BLOCK)   > panel (invisible but intersectable: the laser stops here, so the
//                               faded-out menu behind it is not used)
//     vsg-transform (CAPTION) > panel ("≡ to close")
//
// The menu itself fades out (Steam's windows in CSS, the native glass through lgs_sg.js fade()).
//
// The panels show parts of systemui's own page (the canvases this script adds there), the way
// SteamVR's own panels do. Changes reach the compositor when the page's scene-graph scheduler runs
// (the export of the webpack module containing "update_scene_graph", as in lgs_sg.js); every node
// removed is handed to the module's retire export first: a removed node that is not retired stays
// in the compositor, and enough of those stop new panels from rendering (docs/phase2/capabilities/
// spatial.md §9).

const SYSTEMUI_KEY = 'system.systemui';
const MAIN = 'system.standalone::valve.steam.gamepadui.main';
// The sheet, in the window's frame units (the window is 2.67 x 1.5 above its bottom centre; the bar
// hangs below it): from under the bar to just over the top, a little wider than the window.
const SHEET = { w: 3.2, h: 2.25, y: 0.55, z: 0.06 };   // the blocker
const MODEL_W = 0.0618;          // m: the model's own width (tools/asspod-model, GEOMETRY.BODY)
const OVERLAY_DZ = 0.00025;      // m (model units) in front of the plate: the screen panel (render-model body)
const SCREEN_RECESS = 0.0004;    // m (model units) behind the plate's surface: the screen under podd's glass
const VIDEO_BELOW = 0.0001;      // m (model units) behind the screen panel: podd's video picture
const LCD_M = { cy: 0.0242, w: 0.0508 };   // the LCD on the model (face.js LCD, podd.cpp LCD_CY)
const WIN_M = { w: 0.0532, h: 0.0405 };    // its window (face.js WINDOW, podd.cpp WIN)
const CAPTION = { w: 1.0, y: 0.75, z: 0.075 };
// The body in the hand (controller frame: x right, y up, -z forward): its rotation (w x y z) and
// centre for the right hand, as placed with Reposition; the left hand mirrors it (defaultHold).
const DEFAULT_HOLD = {
  rot: [0.4629683756855247, -0.8817248681122181, -0.05644956223246437, 0.07095886474063698],
  centre: [-0.022855362986507255, -0.014096345082941181, 0.021905882792809507],
};

const r6 = (v) => Math.round(v * 1e6) / 1e6;

// Rotation quaternion (w x y z) of the frame whose columns are x, y, z.
function quatFromBasis(x, y, z) {
  const m00 = x[0], m11 = y[1], m22 = z[2];
  const tr = m00 + m11 + m22;
  let w, qx, qy, qz;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = s / 4; qx = (y[2] - z[1]) / s; qy = (z[0] - x[2]) / s; qz = (x[1] - y[0]) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (y[2] - z[1]) / s; qx = s / 4; qy = (y[0] + x[1]) / s; qz = (z[0] + x[2]) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (z[0] - x[2]) / s; qx = (y[0] + x[1]) / s; qy = s / 4; qz = (z[1] + y[2]) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (x[1] - y[0]) / s; qx = (z[0] + x[2]) / s; qy = (z[1] + y[2]) / s; qz = s / 4;
  }
  return [w, qx, qy, qz];
}

const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
function qrot(q, v) {
  const u = [q[1], q[2], q[3]];
  const cr = (p, r) => [p[1] * r[2] - p[2] * r[1], p[2] * r[0] - p[0] * r[2], p[0] * r[1] - p[1] * r[0]];
  const t = cr(u, v).map((x) => 2 * x);
  const ut = cr(u, t);
  return [v[0] + q[0] * t[0] + ut[0], v[1] + q[0] * t[1] + ut[1], v[2] + q[0] * t[2] + ut[2]];
}

export function createSceneGraph() {
  const W = window;
  const sched = { push: null, retire: null, error: null };
  (function locate() {
    let req = null;
    try {
      const chunks = W.webpackChunkvrwebui;
      const entry = [[Symbol('lgs-asspod')], {}, (r) => { req = r; }];
      chunks.push(entry);
      for (let i = chunks.length - 1; i >= 0; i--) if (chunks[i] === entry) chunks.splice(i, 1);
    } catch (e) { sched.error = 'no webpackChunkvrwebui'; return; }
    if (!req) { sched.error = 'webpack runtime did not answer'; return; }
    const RETIRE = /^function\s*\w*\((\w+)\)\{\w+\.push\(\1\),\w+\(\)\}$/;
    const tryModule = (id) => {
      let src;
      try { src = String(req.m[id]); } catch (_) { return false; }
      if (src.indexOf('"update_scene_graph"') < 0) return false;
      let ex;
      try { ex = req(id); } catch (_) { return false; }
      for (const k of Object.keys(ex)) {
        let f;
        try { f = ex[k]; } catch (_) { continue; }
        if (typeof f !== 'function') continue;
        const s = String(f);
        if (s.indexOf('update_scene_graph') >= 0) sched.push = f;
        else if (RETIRE.test(s)) sched.retire = f;
      }
      return !!sched.push;
    };
    if (!tryModule('5723')) for (const id of Object.keys(req.m)) if (tryModule(id)) break;
    if (!sched.push) sched.error = 'scene-graph scheduler not found';
    else if (!sched.retire) sched.error = 'retire export not found';   // fail closed: no nodes
  })();

  const st = { root: null, nodes: [], retireQ: [], pushes: 0, hand: null, shown: false, errors: [] };

  function sgid() {
    let id = 0;
    try { id = W.VRHTML && VRHTML.NextSGID ? VRHTML.NextSGID() : 0; } catch (_) { /* fall back */ }
    return id || 910000000 + Math.floor(Math.random() * 1e8);
  }
  function vnode(type, props) {
    const el = document.createElement('vsg-node');
    el.setAttribute('vsg-type', type);
    const id = sgid();
    el.setAttribute('sgid', String(id));
    el.__lgsSgid = id;
    el.__lgsProps = props;
    el.buildNode = (ctx) => [Object.assign({}, ctx), { type, properties: Object.assign({ sgid: id }, el.__lgsProps) }];
    st.nodes.push(el);
    return el;
  }
  function vxf(t, rot, attrs) {
    const el = document.createElement('vsg-transform');
    el.setAttribute('translation', t.map(r6).join(' '));
    el.setAttribute('rotation', (rot || [1, 0, 0, 0]).map(r6).join(' '));
    el.setAttribute('scale', '1 1 1');
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    el.setAttribute('vsg-type', 'base');
    const id = sgid();
    el.setAttribute('sgid', String(id));
    el.__lgsSgid = id;
    st.nodes.push(el);
    return el;
  }
  // A panel showing the page rect r (CSS px) of systemui's own texture at `mpp` units per pixel.
  function pagePanel(r, mpp, name, extra) {
    const iw = W.innerWidth || 1;
    const ih = W.innerHeight || 1;
    return vnode('panel', Object.assign({
      key: SYSTEMUI_KEY,
      uv_min: [r6(r.x / iw), r6(r.y / ih)],
      uv_max: [r6((r.x + r.w) / iw), r6((r.y + r.h) / ih)],
      'meters-per-pixel': mpp,
      origin: [0, 0],
      interactive: false,
      visibility: 0,
      reflect: 0,
      debug_name: name,
    }, extra || {}));
  }

  function attach() {
    const app = document.querySelector('vsg-app');
    if (!app) return false;
    if (!st.root) {
      st.root = document.createElement('div');
      st.root.id = 'lgs-asspod-sg';
      st.root.setAttribute('aria-hidden', 'true');
      st.root.style.cssText = 'display:none';
    }
    if (st.root.parentNode !== app) app.appendChild(st.root);
    return true;
  }

  function push() {
    if (!sched.push) return;
    try {
      const q = st.retireQ.splice(0);
      if (sched.retire) for (const id of q) { try { sched.retire(id); } catch (_) { /* best effort */ } }
      sched.push();
      st.pushes++;
    } catch (e) {
      st.errors.push(String(e && e.message || e));
      if (st.errors.length > 5) st.errors.shift();
    }
  }

  function clearNodes() {
    for (const el of st.nodes) if (el.__lgsSgid) st.retireQ.push(el.__lgsSgid);
    st.nodes = [];
    if (st.root) st.root.textContent = '';
  }

  // The body drawn by podd (native/podd, real shaders): the screen panel first, then a box of six
  // stereo panels around the body showing podd's texture, each face one eye pair (SteamVR's Parallel
  // stereoscopy: the left half of its rect to the left eye). podd renders each eye's view of the
  // model through each face; the faces write no depth, so the screen inside shows through podd's
  // glass. The faces match podd's (native/podd/podd.cpp makeLayout): centre, right, up, normal.
  function poddBody(parent, b, rects, pd, video) {
    const k = b.w / MODEL_W;
    // The screen panel is the window only, centred on it like the video panel: SteamVR orders
    // see-through panels by their centres, so two panels on one axis keep their order from any angle
    // (offset centres swapped it head on, and the screen hid the video).
    const ppm = rects.face.w / b.w;
    const ww = WIN_M.w * k * ppm, wh = WIN_M.h * k * ppm;
    const win = { x: rects.face.x + rects.face.w / 2 - ww / 2, y: rects.face.y + rects.face.h / 2 - LCD_M.cy * k * ppm - wh / 2, w: ww, h: wh };
    if (video && Array.isArray(pd.video)) {
      // the video's picture (podd's video tile, the frame twice: one per eye) just under the screen,
      // which is clear over it but for the overlays; first, so the screen blends over it
      const [vx, vy, vw, vh] = pd.video;
      const pic = vxf([0, LCD_M.cy * k, b.d / 2 - (SCREEN_RECESS + VIDEO_BELOW) * k]);
      pic.appendChild(vnode('panel', {
        key: pd.key,
        uv_min: [r6(vx / pd.texW), r6(vy / pd.texH)],
        uv_max: [r6((vx + 2 * vw) / pd.texW), r6((vy + vh) / pd.texH)],
        'meters-per-pixel': r6(LCD_M.w * k / vw),
        origin: [0, 0],
        interactive: false,
        visibility: 0,
        reflect: 0,
        stereoscopy: 1,
        debug_name: 'lgs-asspod-video',
      }));
      parent.appendChild(pic);
    }
    // recessed in the plate's opening, under podd's glass (which sits on the plate's surface)
    const front = vxf([0, LCD_M.cy * k, b.d / 2 - SCREEN_RECESS * k]);
    front.appendChild(pagePanel(win, b.w / rects.face.w, 'lgs-asspod-screen'));
    parent.appendChild(front);
    const [hx, hy, hz] = pd.box;
    const faces = {
      front: [[0, 0, hz], [1, 0, 0], [0, 1, 0], [0, 0, 1], 2 * hx],
      back: [[0, 0, -hz], [-1, 0, 0], [0, 1, 0], [0, 0, -1], 2 * hx],
      right: [[hx, 0, 0], [0, 0, -1], [0, 1, 0], [1, 0, 0], 2 * hz],
      left: [[-hx, 0, 0], [0, 0, 1], [0, 1, 0], [-1, 0, 0], 2 * hz],
      top: [[0, hy, 0], [1, 0, 0], [0, 0, -1], [0, 1, 0], 2 * hx],
      bottom: [[0, -hy, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], 2 * hx],
    };
    for (const [name, [c, R, U, N, w]] of Object.entries(faces)) {
      const t = pd.tiles[name];
      if (!t) continue;
      const [tx, ty, tw, th] = t;
      const p = pd.pad || 0;
      const xf = vxf(c, quatFromBasis(R, U, N));
      // both eyes with their overscan: the panel is the face grown by `pad` px on every side
      xf.appendChild(vnode('panel', {
        key: pd.key,
        uv_min: [r6((tx - p) / pd.texW), r6((ty - p) / pd.texH)],
        uv_max: [r6((tx + 2 * tw + 3 * p) / pd.texW), r6((ty + th + p) / pd.texH)],
        'meters-per-pixel': r6(w / tw),
        origin: [0, 0],
        interactive: false,
        visibility: 0,
        reflect: 0,
        stereoscopy: 1,
        'no-depth-write': true,
        debug_name: 'lgs-asspod-' + name,
      }));
      parent.appendChild(xf);
    }
  }

  // The body without podd: the model's parts as SteamVR render models (fixed lighting), the screen
  // panel just in front of the plate.
  function body(parent, b, rects, modelDir, finish) {
    const k = b.w / MODEL_W;
    const fin = finish === 'white' ? 'white' : 'black';
    const scaled = vxf([0, 0, 0]);
    scaled.setAttribute('scale', [k, k, k].map(r6).join(' '));
    const parts = ['asspod_steel_back', 'asspod_steel_edge', 'asspod_ports', `asspod_plate_${fin}`, `asspod_well_${fin}`,
      `asspod_wheel_${fin}`, `asspod_center_${fin}`];
    for (const name of parts) scaled.appendChild(vnode('rendermodel', { source: `${modelDir}/${name}/${name}.obj` }));
    parent.appendChild(scaled);
    const front = vxf([0, 0, b.d / 2 + OVERLAY_DZ * k]);
    front.appendChild(pagePanel(rects.face, b.w / rects.face.w, 'lgs-asspod-screen'));
    parent.appendChild(front);
    const back = vxf([0, 0, -(b.d / 2 + OVERLAY_DZ * k)], [0, 0, 1, 0]);
    back.appendChild(pagePanel(rects.back, b.w / rects.back.w, 'lgs-asspod-back'));
    parent.appendChild(back);
  }

  // The default place in the hand: where you put it with Reposition (2026-10-09, right hand), and
  // its mirror image across the controller's centre line for the left hand.
  function defaultHold(side) {
    const r = DEFAULT_HOLD;
    if (side === 'right') return { rot: r.rot.slice(), centre: r.centre.slice() };
    return { rot: [r.rot[0], r.rot[1], -r.rot[2], -r.rot[3]], centre: [-r.centre[0], r.centre[1], r.centre[2]] };
  }

  /**
   * Shows the assPod in `hand` ('left' | 'right') with the sheet over the menu.
   * @param {{ hand: string, body: {w,h,d,r}, rects: {face, back, dim, text}, modelDir: string, finish: string,
   *   podd?: { key, texW, texH, box, tiles }, hold?: { rot, centre }, world?: { rot, centre } }} o
   *   podd: its layout (podd-out.json) when podd draws the body; hold: a place in the hand other than
   *   the default; world: pinned in the room (standing space) instead of on the hand
   * @returns {{ rot: number[], centre: number[] } | null} the body in the controller's frame (for reflect.js)
   */
  function show(o) {
    if (sched.error) return null;
    if (!attach()) return null;
    clearNodes();
    const side = o.hand === 'left' ? 'left' : 'right';
    const { rot, centre } = o.hold && o.hold.rot && o.hold.centre ? o.hold : defaultHold(side);
    // pinned in the room (Reposition: the controller moves, the assPod stays), else on the hand
    const hand = o.world
      ? vxf(o.world.centre, o.world.rot)
      : vxf([0, 0, 0], null, { 'parent-path': '/user/hand/' + side });
    const hold = o.world ? vxf([0, 0, 0]) : vxf(centre, rot);
    if (o.podd && o.podd.tiles && Array.isArray(o.podd.box)) poddBody(hold, o.body, o.rects, o.podd, o.video);
    else body(hold, o.body, o.rects, o.modelDir, o.finish);
    hand.appendChild(hold);
    st.root.appendChild(hand);
    // the sheet and the caption, on Steam's window
    const curve = { 'curvature-origin-id': MAIN + '_CurvatureOrigin' };
    const win = vxf([0, 0, 0], null, { 'parent-id': MAIN + '_BottomCenter' });
    const sheet = vxf([0, SHEET.y, SHEET.z]);
    sheet.appendChild(pagePanel(o.rects.dim, SHEET.w / o.rects.dim.w, 'lgs-asspod-block',
      Object.assign({ interactive: true, visibility: 3 }, curve)));
    const cap = vxf([0, CAPTION.y, CAPTION.z]);
    cap.appendChild(pagePanel(o.rects.text, CAPTION.w / o.rects.text.w, 'lgs-asspod-caption', curve));
    win.appendChild(sheet);
    win.appendChild(cap);
    st.root.appendChild(win);
    st.hand = side;
    st.shown = true;
    push();
    return { rot, centre };
  }

  function hide() {
    if (!st.shown && !st.nodes.length) return;
    clearNodes();
    st.shown = false;
    st.hand = null;
    push();
  }

  function destroy() {
    hide();
    if (st.root) { st.root.remove(); st.root = null; }
  }

  return {
    show, hide, destroy,
    get shown() { return st.shown; },
    status: () => ({ error: sched.error, shown: st.shown, hand: st.hand, nodes: st.nodes.length, pushes: st.pushes,
      attached: !!(st.root && st.root.isConnected), errors: st.errors.slice() }),
  };
}
