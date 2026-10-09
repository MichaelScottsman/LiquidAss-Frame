// Glass Shell scene-graph compositor, evaluated inside SteamVR's systemui page
// (vrwebhelper devtools, 127.0.0.1:8090) by lgs_shell.py as
//
//   (() => { <device/shared/motion.js>; return (SOURCE)(opts); })()
//
// The interface is docs/phase2/contracts/sg.md (P7). It installs
// window[opts.global || '__LGS_SG']:
//
//   update(spec)     build / diff the injected scene-graph nodes; heartbeat
//   ping()           daemon heartbeat; after a watchdog expiry it rebuilds the
//                    last spec and re-applies the last overrides
//   overrides(set)   transform overrides of SteamVR's own chrome ({rules})
//   windowState(w)   Steam's real window panel: {dim, recede, motion}
//   clear()          remove every node, restore every override, push once
//   destroy()        clear() and uninstall
//   status() dump() geom() timeline() spec()  inspection
//   test.yaw(deg)    lab only: turn Steam's window about its vertical axis
//
// Without update()/ping()/overrides() for watchdogMs, every node is removed
// and every override restored (spec and rules kept), so a stalled or killed
// daemon never leaves glass covering Steam's window or chrome moved.
//
// Per surface, back to front (z = scene units toward the viewer):
//   cover   glassd's backdrop region (cover shapes and plates) at coverDz
//   base    Steam's texture minus the popped rects (or only the spec's
//           mosaic bands), as a guillotine mosaic of crops at baseDz
//   slab    glassd's slab for each pop, max(zPop - 0.0008, coverDz + 0.0003)
//   pop     Steam's texture cropped to the element, max(dz(t), baseDz)
// Every item of a surface is   panel-anchor(centre u,v) > vsg-transform(0 0 z)
//                              > [tint >] panel(key, uv, meters-per-pixel)
// (u,v in the parent's texture uv, which SteamVR maps onto the part of the
// texture the parent panel displays; see describe())
// under one shared reparent-to-panel(steamKey). Panels are interactive:false
// except pops that ask for it in the wearer profile.
//
// The depth channel: each pop's z follows a closed-form spring (MO section 8,
// P5's motion.js when present) evaluated by time; while anything moves we push
// at <= animHz (60), then once with the exact targets, then not at all.
// Structural changes push at <= maxPushHz (15). Changes reach the compositor
// only when the serializer's scheduler runs (the export of the webpack module
// containing "update_scene_graph"); retired sgids are handed to the module's
// retire export right before our own push.
(function lgsSceneGraph(opts) {
  'use strict';
  const W = window;
  opts = opts || {};
  const num = (v, dflt) => { const n = Number(v); return Number.isFinite(n) ? n : dflt; };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const VERSION = String(opts.version || 'dev');
  const GLOBAL = (typeof opts.global === 'string' && /^[A-Za-z_$][\w$]*$/.test(opts.global)) ? opts.global : '__LGS_SG';
  const MAX_PUSH_HZ = clamp(num(opts.maxPushHz, 15), 1, 60);
  const ANIM_HZ = clamp(num(opts.animHz, 60), 1, 60);
  const WATCHDOG_MS = opts.watchdogMs === undefined ? 12000 : num(opts.watchdogMs, 12000);
  const SLAB_BEHIND = 0.0008;     // slab sits this far behind its popped crop
  const SLAB_OVER_COVER = 0.0003; // and at least this far in front of the cover
  const MIN_PIECE = 1;            // px; smaller mosaic slivers are dropped
  const SINK_MAX_MS = 600;        // glassd keeps a retired slab cell drawn this long
  const ROOT_ID = GLOBAL === '__LGS_SG' ? 'lgs-sg-root' : 'lgs-sg-root-' + GLOBAL;
  const TIMELINE_MAX = 600;
  const SHARED_REPARENT = opts.sharedReparent !== undefined ? !!opts.sharedReparent : true;
  const DEBUG_TINT = opts.debugTint || null;
  const FLAG_KEYS = ['frame-resize-scale-factor', 'sort-depth-bias', 'sort-order', 'no-depth-test', 'no-depth-write', 'reflect'];
  const DEFAULT_FLAGS = { 'frame-resize-scale-factor': 1 };
  const KINDS = ['cover', 'base', 'pop', 'slab', 'roomdim'];
  const CAPS = ['depthAnim', 'profile', 'dim', 'window', 'overrides', 'timeline', 'geom', 'sink', 'mosaic', 'cut', 'dimSlabs'];
  const ROOMDIM_SCALE = 3;        // a dimSlabs cell is drawn this many times its rect's size
  const ROOMDIM_DZ = -0.05;       // and at least this far behind the window (units)

  if (W[GLOBAL]) {
    if (W[GLOBAL].version === VERSION && !opts.force) return JSON.stringify(W[GLOBAL].status());
    try { W[GLOBAL].destroy(); } catch (_) { /* stale instance */ }
  }

  // ------------------------------------------------------------ motion
  // D2 section 11.2 tokens {d, b}; P5's motion.js (prepended in the same
  // scope by P8) is preferred when it publishes a token table.
  const TOKENS = {
    'interactive': [0.15, 0.14], 'hover-in': [0.20, 0], 'fade': [0.30, 0], 'snappy': [0.35, 0.15],
    'release-touch': [0.40, 0.25], 'morph-open': [0.45, 0.20], 'morph-close': [0.30, 0],
    'sheet-in': [0.50, 0], 'sheet-out': [0.35, 0], 'page': [0.45, 0], 'depth': [0.30, 0],
  };
  const motionLib = (() => {
    try { if (typeof LGS_MOTION !== 'undefined' && LGS_MOTION) return LGS_MOTION; } catch (_) { /* absent */ }  // eslint-disable-line no-undef
    try { if (W.__LGS_MOTION) return W.__LGS_MOTION; } catch (_) { /* absent */ }
    return null;
  })();
  function tokenDB(name) {
    if (motionLib) {
      try {
        const t = (motionLib.tokens && motionLib.tokens[name]) || (typeof motionLib.token === 'function' && motionLib.token(name));
        if (t) {
          const d = num(t.d !== undefined ? t.d : t.duration, NaN), b = num(t.b !== undefined ? t.b : t.bounce, 0);
          if (d > 0) return [d, b];
        }
      } catch (_) { /* fall back */ }
    }
    return TOKENS[name] || TOKENS.depth;
  }
  // MO section 8: y = x - target; [y(t), y'(t)] for y(0) = y0, y'(0) = v0.
  function spring(y0, v0, t, d, b) {
    const w = 2 * Math.PI / d, z = b >= 0 ? 1 - b : 1 / (1 + b);
    if (Math.abs(z - 1) < 1e-6) {
      const e = Math.exp(-w * t), B = v0 + w * y0;
      return [e * (y0 + B * t), e * (B - w * (y0 + B * t))];
    }
    if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z), e = Math.exp(-z * w * t);
      const B = (v0 + z * w * y0) / wd, c = Math.cos(wd * t), s = Math.sin(wd * t);
      return [e * (y0 * c + B * s), e * ((-z * w) * (y0 * c + B * s) + (-y0 * wd * s + B * wd * c))];
    }
    const r1 = -w * (z - Math.sqrt(z * z - 1)), r2 = -w * (z + Math.sqrt(z * z - 1));
    const A = (v0 - r2 * y0) / (r1 - r2), C = y0 - A;
    return [A * Math.exp(r1 * t) + C * Math.exp(r2 * t), A * r1 * Math.exp(r1 * t) + C * r2 * Math.exp(r2 * t)];
  }
  // An animated scalar.
  function chan(v, label) { return { x0: v, v0: 0, t0: 0, target: v, d: 0.3, b: 0, travel: 0, moving: false, label: label || null }; }
  // P5's spring when present (the same MO section 8 closed form)
  const springFn = (motionLib && typeof motionLib.spring === 'function') ? motionLib.spring : spring;
  function chanAt(c, now) {
    if (!c.moving) return [c.target, 0];
    const [y, v] = springFn(c.x0 - c.target, c.v0, Math.max(0, now - c.t0) / 1000, c.d, c.b);
    return [c.target + y, v];
  }
  function chanSettled(c, now) {
    if (!c.moving) return true;
    const [x, v] = chanAt(c, now);
    const tr = Math.max(c.travel, 1e-6);
    return Math.abs(x - c.target) < 0.001 * tr && Math.abs(v) < 0.01 * tr / c.d;
  }
  // Retarget keeping the current value and velocity; token null = jump.
  function chanSet(c, target, token, now) {
    if (!Number.isFinite(target)) return;
    if (!token) { Object.assign(c, { x0: target, v0: 0, t0: now, target, moving: false, travel: 0 }); return; }
    if (target === c.target && (c.moving || c.x0 === target)) return;
    const [x, v] = chanAt(c, now);
    const [d, b] = tokenDB(token);
    Object.assign(c, { x0: x, v0: v, t0: now, target, d, b, travel: Math.abs(target - x), moving: Math.abs(target - x) > 1e-9 || Math.abs(v) > 1e-9 });
    if (c.label && c.moving) {
      retargets.push({ key: c.label, t0: now, x0: r6(x), v0: r6(v), target, d, b, token });
      if (retargets.length > 100) retargets.shift();
    }
  }
  const retargets = [];

  // ------------------------------------------------------------ scheduler
  const sched = { module: null, push: null, retire: null, error: null };
  (function locate() {
    let req = null;
    try {
      const chunks = W.webpackChunkvrwebui;
      const entry = [[Symbol('lgs-sg')], {}, (r) => { req = r; }];
      chunks.push(entry);
      // webpack's push appends the entry to the array after running it: take
      // it out again, with any left by older installs (R1 m3; only consulted
      // when the runtime starts, so removing processed entries is harmless)
      for (let i = chunks.length - 1; i >= 0; i--) {
        const e = chunks[i];
        try {
          if (e === entry || (Array.isArray(e) && Array.isArray(e[0]) && e[0].length === 1 && typeof e[0][0] === 'symbol' && e[0][0].description === 'lgs-sg')) chunks.splice(i, 1);
        } catch (_) { /* foreign entry */ }
      }
    } catch (e) { sched.error = 'no webpackChunkvrwebui: ' + e.message; return; }
    if (!req) { sched.error = 'webpack runtime did not answer'; return; }
    const RETIRE = /^function\s*\w*\((\w+)\)\{\w+\.push\(\1\),\w+\(\)\}$/;
    const tryModule = (id) => {
      let src;
      try { src = String(req.m[id]); } catch (_) { return false; }
      if (src.indexOf('"update_scene_graph"') < 0) return false;
      let ex;
      try { ex = req(id); } catch (_) { return false; }
      let push = null, retire = null;
      for (const k of Object.keys(ex)) {
        let f;
        try { f = ex[k]; } catch (_) { continue; }
        if (typeof f !== 'function') continue;
        const s = String(f);
        if (s.indexOf('update_scene_graph') >= 0) push = f;
        else if (RETIRE.test(s)) retire = f;
      }
      if (!push) return false;
      Object.assign(sched, { module: id, push, retire });
      return true;
    };
    if (!tryModule('5723')) {
      for (const id of Object.keys(req.m)) if (tryModule(id)) break;
    }
    if (opts.noRetire) sched.retire = null;   // tests only: SG-2's fail-closed case
    if (!sched.push) sched.error = 'scene-graph scheduler not found';
    // Fail closed (R1 m2): without the retire export every removed panel would
    // leak in the compositor, and about 45 leaked panels stop new panels from
    // rendering (SP 9.1). So no node of ours is built; overrides (SteamVR's
    // own nodes, no sgids of ours) still work.
    else if (!sched.retire) sched.error = 'retire export not found: no scene-graph nodes are built (fail closed)';
  })();

  // ------------------------------------------------------------ state
  const st = {
    items: new Map(),          // key -> item
    unpushed: new Set(),       // items created since the last push
    retireQ: [],               // sgids to retire with the next push
    root: null,
    M: 0, MSource: '',
    pushes: 0, pushTimes: [], lastPush: 0, pushTimer: 0, pushDue: 0,
    reattaches: 0, wasAttached: false,
    lastSpec: null, specSeq: null,
    parents: {}, parentSig: '', relayouts: 0, rebuilds: 0,
    lastContact: Date.now(), expired: false, expiries: 0,
    updates: 0, lastSpecAt: 0, lastSummary: null,
    errors: [], tick: 0, destroyed: false,
    pops: new Map(),           // steamKey#id -> pop state (depth channel)
    ghostN: 0,
    dims: new Map(),           // steamKey -> {c: chan, want: number|null}
    anim: { timer: 0, frames: 0, finals: 0, lastFrame: 0 },
    timeline: [],
    sg: { created: 0, retired: 0, live: new Set(), noRetire: 0 },
    profile: 'default',
    reduce: false,
    depthToken: 'depth',
    unitM: 0,
  };

  function note(msg) {
    st.errors.push(new Date().toISOString().slice(11, 19) + ' ' + msg);
    if (st.errors.length > 8) st.errors.shift();
  }

  function nextSgid() {
    let id = 0;
    try { if (W.VRHTML && VRHTML.NextSGID) id = VRHTML.NextSGID(); } catch (_) { /* fall through */ }
    if (!id) id = 900000000 + Math.floor(Math.random() * 1e8);
    st.sg.created++;
    st.sg.live.add(id);
    return id;
  }

  function rootEl() {
    if (!st.root) {
      st.root = document.createElement('div');
      st.root.id = ROOT_ID;
      st.root.setAttribute('aria-hidden', 'true');
      st.root.style.cssText = 'display:none';
    }
    return st.root;
  }

  function isAttached() {
    const app = document.querySelector('vsg-app');
    return !!(st.root && app && st.root.parentNode === app);
  }

  // Keep our root under the live <vsg-app>; true if it is attached.
  function ensureAttached() {
    const app = document.querySelector('vsg-app');
    if (!app) return false;
    const root = rootEl();
    if (root.parentNode !== app) {
      if (st.wasAttached && st.items.size) {   // dropped by a re-render
        st.reattaches++;
        note('root re-attached');
        for (const it of st.items.values()) { it.pushedAt = 0; st.unpushed.add(it); }
      }
      app.appendChild(root);
      st.wasAttached = true;
      if (st.items.size) schedulePush();
    }
    return true;
  }

  // ------------------------------------------------------------ geometry (live)
  // Steam's page of a dashboard frame. Page ids are handed out at run time
  // (Steam was page 3 at first, page 4 after its overlay re-registered), so
  // find it by its summon key, never by number.
  const STEAM_KEY = 'valve.steam.gamepadui.main';
  function steamPage() {
    try {
      for (const f of (W.FrameStore && FrameStore.frames) || []) {
        for (const p of (f && f.pages) || []) {
          if (p && p.m_sSummonOverlayKey === STEAM_KEY) {
            const id = String(p.mountableID || ('frame:' + f.m_unFrameID + ':page:' + p.m_unPageID + ':mountable'));
            return { frame: f, page: p, mountable: id, active: !!(f.activePage && f.activePage === p) };
          }
        }
      }
    } catch (_) { /* no FrameStore */ }
    return null;
  }

  let geomCache = null, geomAt = 0;
  function geom() {
    const now = Date.now();
    if (geomCache && now - geomAt < 1000) return geomCache;
    let S = 0.369, H0 = 1.5, r = 1, src = 'default';
    try {
      const sp = steamPage();
      const fr = W.FrameStore && FrameStore.frames;
      const f = sp ? sp.frame : (fr && fr[0]);
      const pg = sp ? sp.page : (f && f.activePage);
      const s = num(W.DashboardStore && DashboardStore.dashboardScale, 0);
      if (s > 0) { S = s; src = 'live'; }
      if (f) {
        H0 = num(f.size && f.size.mainPanelHeightOverride, 1.5) || 1.5;
        const lh = num(pg && pg.size && pg.size.latestMeasuredPanelLocalHeight, 0);
        if (lh > 0) r = lh / H0;
      }
    } catch (_) { /* defaults */ }
    const unitM = st.unitM > 0 ? st.unitM : S * r;
    geomCache = { S, H0, r: Math.round(r * 1e4) / 1e4, unitM, unitsPerMm: 1 / (1000 * unitM), src: st.unitM > 0 ? 'spec' : src };
    geomAt = now;
    return geomCache;
  }

  // ------------------------------------------------------------ pushing
  function pushNow() {
    st.pushTimer = 0;
    st.pushDue = 0;
    const now = Date.now();
    try { applyAnimated(now); } catch (e) { note('anim: ' + e.message); }
    try { applyOverrides(now); } catch (e) { note('overrides: ' + e.message); }
    if (!sched.push) { st.retireQ.length = 0; return; }
    try {
      // The retire export queues the sgid and schedules the module's push
      // (setTimeout 0); our push call below then joins that same push.
      const q = st.retireQ.splice(0);
      if (sched.retire) for (const id of q) { try { sched.retire(id); } catch (_) { /* best effort */ } }
      const attached = isAttached();
      sched.push();
      const t = Date.now();
      st.pushes++;
      st.lastPush = t;
      st.pushTimes.push(t);
      while (st.pushTimes.length && t - st.pushTimes[0] > 1000) st.pushTimes.shift();
      if (attached) {
        for (const it of st.unpushed) if (!it.pushedAt) it.pushedAt = t;
        st.unpushed.clear();
      }
    } catch (e) { note('push: ' + e.message); }
  }

  // Structural changes: at most MAX_PUSH_HZ. While animating, the next
  // animation frame carries them.
  function schedulePush() {
    if (st.destroyed) return;
    if (st.anim.timer) return;
    if (st.pushTimer) return;
    const wait = Math.max(0, st.lastPush + 1000 / MAX_PUSH_HZ - Date.now());
    st.pushDue = Date.now() + wait;
    st.pushTimer = setTimeout(pushNow, wait);
  }

  // ------------------------------------------------------------ animation
  // Every animated value: pop depths (st.pops), surface dims (st.dims), the
  // window channels and override fractions (ov).
  function anyMoving(now) {
    for (const p of st.pops.values()) if (p.c.moving && !chanSettled(p.c, now)) return true;
    for (const d of st.dims.values()) if (d.c.moving && !chanSettled(d.c, now)) return true;
    for (const c of animatedOverrideChans()) if (c.moving && !chanSettled(c, now)) return true;
    return false;
  }

  function startAnim() {
    if (st.anim.timer || st.destroyed) return;
    if (st.pushTimer) { clearTimeout(st.pushTimer); st.pushTimer = 0; }
    const frame = () => {
      st.anim.timer = 0;
      if (st.destroyed) return;
      const now = Date.now();
      const moving = anyMoving(now);
      if (!moving) settleAll();          // exact targets in the final push
      st.anim.frames++;
      st.anim.lastFrame = now;
      pushNow();
      recordTimeline(now, !moving);
      if (moving) {
        st.anim.timer = setTimeout(frame, 1000 / ANIM_HZ);
      } else {
        st.anim.finals++;
        afterSettle();
      }
    };
    const wait = Math.max(0, st.lastPush + 1000 / ANIM_HZ - Date.now());
    st.anim.timer = setTimeout(frame, wait);
  }

  function settleAll() {
    for (const p of st.pops.values()) if (p.c.moving) { p.c.moving = false; p.c.x0 = p.c.target; p.c.v0 = 0; }
    for (const d of st.dims.values()) if (d.c.moving) { d.c.moving = false; d.c.x0 = d.c.target; d.c.v0 = 0; }
    for (const c of animatedOverrideChans()) if (c.moving) { c.moving = false; c.x0 = c.target; c.v0 = 0; }
  }

  // Sunk pops and faded-out dims leave; removed override rules restore.
  function afterSettle() {
    let structural = false;
    for (const [k, p] of st.pops) if (p.sinking && !p.c.moving) { st.pops.delete(k); structural = true; }
    for (const [k, d] of st.dims) if (d.want === null && !d.c.moving) { st.dims.delete(k); structural = true; }
    if (ovCleanup()) structural = true;
    if (structural && st.lastSpec && !st.expired) { build(st.lastSpec); }
    else if (structural) schedulePush();
  }

  function recordTimeline(now, final) {
    const z = {};
    let n = 0;
    for (const [k, p] of st.pops) { z[k] = r6(chanAt(p.c, now)[0]); n++; }
    for (const [k, d] of st.dims) { z['dim:' + k] = r6(chanAt(d.c, now)[0]); n++; }
    for (const [k, c] of ov.chans) { z['ov:' + k] = r6(chanAt(c, now)[0]); n++; }
    if (win.dimC.moving || win.dimC.target !== 1) { z['win:dim'] = r6(chanAt(win.dimC, now)[0]); n++; }
    if (win.recC.moving || win.recC.target !== 0) { z['win:recede'] = r6(chanAt(win.recC, now)[0]); n++; }
    if (!n) return;
    st.timeline.push({ t: now, final: !!final, z });
    if (st.timeline.length > TIMELINE_MAX) st.timeline.splice(0, st.timeline.length - TIMELINE_MAX);
  }

  // Write the animated values into their nodes (called right before a push).
  function applyAnimated(now) {
    for (const it of st.items.values()) {
      const d = it.d;
      if (d.popKey) {
        const p = st.pops.get(d.popKey);
        if (p) {
          const zp = Math.max(chanAt(p.c, now)[0], d.baseDz);
          const z = d.kind === 'pop' ? zp : Math.max(zp - SLAB_BEHIND, d.coverDz + SLAB_OVER_COVER);
          const t = '0 0 ' + r6(z);
          if (it.xf.getAttribute('translation') !== t) it.xf.setAttribute('translation', t);
          it.zNow = z;
        }
      }
      if (it.wrap && d.dimKey) {
        const dm = st.dims.get(d.dimKey);
        const v = dm ? clamp(chanAt(dm.c, now)[0], 0, 1) : 1;
        const base = (DEBUG_TINT && DEBUG_TINT[d.kind]) || [1, 1, 1];
        it.wrap.__lgsProps = { color: base.map((x) => r6(x * v)) };
      }
    }
  }

  // ------------------------------------------------------------ nodes
  // A vsg-node whose buildNode serializes its current props.
  function vnode(type, props) {
    const el = document.createElement('vsg-node');
    el.setAttribute('vsg-type', type);
    const sgid = nextSgid();
    el.setAttribute('sgid', String(sgid));
    el.__lgsSgid = sgid;
    el.__lgsProps = props;
    el.buildNode = (ctx) => [
      type === 'reparent-to-panel'
        ? Object.assign({}, ctx, { bInsideReparentedPanel: true, currentPanel: undefined })
        : Object.assign({}, ctx),
      { type, properties: Object.assign({ sgid }, el.__lgsProps) },
    ];
    return el;
  }

  function vtransform(z) {
    const el = document.createElement('vsg-transform');
    el.setAttribute('translation', '0 0 ' + z);
    el.setAttribute('rotation', '1 0 0 0');
    el.setAttribute('scale', '1 1 1');
    el.setAttribute('vsg-type', 'base');
    const sgid = nextSgid();
    el.setAttribute('sgid', String(sgid));
    el.__lgsSgid = sgid;
    return el;
  }

  const r6 = (v) => Math.round(v * 1e6) / 1e6;

  // desc: { kind, id, parentKey, u, v, z, key, uv:[u0,v0,u1,v1], mpp, name, flags, interactive }
  function panelProps(d) {
    const p = {
      key: d.key,
      uv_min: [r6(d.uv[0]), r6(d.uv[1])],
      uv_max: [r6(d.uv[2]), r6(d.uv[3])],
      'meters-per-pixel': d.mpp,
      origin: [0, 0],
      curvature: 'inherit-from-parent-panel',
      interactive: false,
      visibility: 0,
      reflect: 0,
      debug_name: d.name,
    };
    // Steam's bar, floating footer and bar popups curve about the dashboard's
    // curvature origin. A copy of a bar popup with "inherit-from-parent-panel"
    // came out flat: it crossed the curved popup and hid behind it except for
    // a middle strip. With the origin named and no "inherit" it curves exactly
    // like the popup (measured, R1 B1 / SG-POPUP).
    if (d.curvOrigin) {
      p['curvature-origin-id'] = d.curvOrigin;
      delete p.curvature;
    }
    Object.assign(p, d.flags || {});
    // Wearer profile only (PLAN 1.7, SP 2.6): the crop takes the laser itself.
    if (d.interactive) Object.assign(p, { interactive: true, 'steam-input-appid': 769, 'can-take-keyboard-focus': true });
    return p;
  }

  // Shared mode: one reparent-to-panel per parent key.
  const groups = new Map();   // parentKey -> { top, n }
  function groupFor(key) {
    let g = groups.get(key);
    if (!g) {
      g = { top: vnode('reparent-to-panel', { 'parent-overlay-key': key }), n: 0 };
      rootEl().appendChild(g.top);
      groups.set(key, g);
    }
    return g;
  }

  function wrapColor(d) {
    if (d.dimKey) return [1, 1, 1];
    return (DEBUG_TINT && DEBUG_TINT[d.kind]) || null;
  }

  function createItem(d) {
    const panel = vnode('panel', panelProps(d));
    const xf = vtransform(r6(d.z));
    const wc = wrapColor(d);
    let wrap = null;
    if (wc) {
      wrap = vnode('tint', { color: wc });
      wrap.appendChild(panel);
      xf.appendChild(wrap);
    } else {
      xf.appendChild(panel);
    }
    const anchor = vnode('panel-anchor', { 'anchor-u': r6(d.u), 'anchor-v': r6(d.v) });
    anchor.appendChild(xf);
    let it;
    if (SHARED_REPARENT) {
      const g = groupFor(d.parentKey);
      g.top.appendChild(anchor);
      g.n++;
      it = { d, top: null, anchor, xf, wrap, panel, sig: sigOf(d), group: d.parentKey, pushedAt: 0 };
    } else {
      const top = vnode('reparent-to-panel', { 'parent-overlay-key': d.parentKey });
      top.appendChild(anchor);
      rootEl().appendChild(top);
      it = { d, top, anchor, xf, wrap, panel, sig: sigOf(d), pushedAt: 0 };
    }
    st.unpushed.add(it);
    return it;
  }

  // z of animated items is not part of the signature (applyAnimated sets it).
  function sigOf(d) {
    return [d.parentKey, r6(d.u), r6(d.v), d.popKey ? 'anim' : r6(d.z), d.key, d.uv.map(r6).join(','), d.mpp, d.name, d.curvOrigin || '',
      JSON.stringify(d.flags || {}), d.interactive ? 1 : 0, d.dimKey || '', d.popKey ? r6(d.baseDz) + '/' + r6(d.coverDz) : ''].join('|');
  }

  // Update in place; true if anything changed, 'rebuild' if the wrapper changes.
  function updateItem(it, d) {
    const sig = sigOf(d);
    if (sig === it.sig) return false;
    // a wrapper appears or goes (dim on / off): new nodes, swapped in one push
    if (!!wrapColor(d) !== !!it.wrap) return 'rebuild';
    it.sig = sig;
    it.d = d;
    if (it.top) it.top.__lgsProps = { 'parent-overlay-key': d.parentKey };
    it.anchor.__lgsProps = { 'anchor-u': r6(d.u), 'anchor-v': r6(d.v) };
    if (!d.popKey) {
      const t = '0 0 ' + r6(d.z);
      if (it.xf.getAttribute('translation') !== t) it.xf.setAttribute('translation', t);
    }
    it.panel.__lgsProps = panelProps(d);
    if (it.wrap && !d.dimKey) it.wrap.__lgsProps = { color: wrapColor(d) };
    return true;
  }

  // Queued; handed to the module right before our next push (pushNow).
  function retire(els) {
    for (const el of els) {
      if (!el || !el.__lgsSgid) continue;
      st.sg.live.delete(el.__lgsSgid);
      st.sg.retired++;
      if (sched.retire) st.retireQ.push(el.__lgsSgid);
      else st.sg.noRetire++;
    }
  }

  function removeItem(it) {
    st.unpushed.delete(it);
    if (it.top) {
      it.top.remove();
      retire([it.top, it.anchor, it.xf, it.wrap, it.panel]);
      return;
    }
    it.anchor.remove();
    retire([it.anchor, it.xf, it.wrap, it.panel]);
    const g = groups.get(it.group);
    if (g && --g.n <= 0) {
      g.top.remove();
      retire([g.top]);
      groups.delete(it.group);
    }
  }

  // ------------------------------------------------------------ mosaic
  // Guillotine decomposition of [0,W]x[0,H] minus the holes (integer px
  // rects {x0,y0,x1,y1}). Prefers cuts that cross no hole (full-width bands
  // first), so a row of header capsules costs one band plus the gaps.
  function guillotine(Wd, Ht, holes) {
    const out = [];
    const clip = (h, r) => ({ x0: Math.max(h.x0, r.x0), y0: Math.max(h.y0, r.y0), x1: Math.min(h.x1, r.x1), y1: Math.min(h.y1, r.y1) });
    let guard = 0;
    function cut(r, hs) {
      if (++guard > 4000) return;
      if (r.x1 - r.x0 < MIN_PIECE || r.y1 - r.y0 < MIN_PIECE) return;
      hs = hs.map((h) => clip(h, r)).filter((h) => h.x1 > h.x0 && h.y1 > h.y0);
      if (!hs.length) { out.push(r); return; }
      if (hs.some((h) => h.x0 <= r.x0 && h.y0 <= r.y0 && h.x1 >= r.x1 && h.y1 >= r.y1)) return;
      const edges = (a, b, lo, hi) => [...new Set(hs.flatMap((h) => [h[a], h[b]]))].filter((v) => v > lo && v < hi).sort((p, q) => p - q);
      const ys = edges('y0', 'y1', r.y0, r.y1);
      const xs = edges('x0', 'x1', r.x0, r.x1);
      for (const y of ys) {
        if (!hs.some((h) => h.y0 < y && h.y1 > y)) { cut(Object.assign({}, r, { y1: y }), hs); cut(Object.assign({}, r, { y0: y }), hs); return; }
      }
      for (const x of xs) {
        if (!hs.some((h) => h.x0 < x && h.x1 > x)) { cut(Object.assign({}, r, { x1: x }), hs); cut(Object.assign({}, r, { x0: x }), hs); return; }
      }
      // Interlocking holes: cut through one (both halves stay holes).
      if (ys.length) { cut(Object.assign({}, r, { y1: ys[0] }), hs); cut(Object.assign({}, r, { y0: ys[0] }), hs); return; }
      if (xs.length) { cut(Object.assign({}, r, { x1: xs[0] }), hs); cut(Object.assign({}, r, { x0: xs[0] }), hs); }
    }
    cut({ x0: 0, y0: 0, x1: Wd, y1: Ht }, holes);
    // 1 px overlap against seams: grow a piece by 1 px on a side when the
    // pixels just beyond it are entirely other pieces, never into a hole (a
    // popped element must not show at base depth) or past the texture edge.
    const area = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
    const covered = (p, s) => {
      if (s.x0 < 0 || s.y0 < 0 || s.x1 > Wd || s.y1 > Ht || !area(s)) return false;
      let a = 0;
      for (const q of out) if (q !== p) a += area(clip(q, s));
      return a >= area(s);
    };
    return out.map((p) => {
      const g = Object.assign({}, p);
      if (covered(p, { x0: p.x1, x1: p.x1 + 1, y0: p.y0, y1: p.y1 })) g.x1 += 1;
      if (covered(p, { x0: p.x0, x1: p.x1, y0: p.y1, y1: p.y1 + 1 })) g.y1 += 1;
      if (covered(p, { x0: p.x0 - 1, x1: p.x0, y0: p.y0, y1: p.y1 })) g.x0 -= 1;
      if (covered(p, { x0: p.x0, x1: p.x1, y0: p.y0 - 1, y1: p.y0 })) g.y0 -= 1;
      return g;
    });
  }

  // Base pieces inside the given bands (or the whole region), minus holes.
  // Bands are made disjoint (a later band loses what an earlier one covers).
  function mosaic(Wd, Ht, holes, bands) {
    if (!bands) return guillotine(Wd, Ht, holes);
    const out = [];
    const done = [];
    for (const b of bands) {
      const bx0 = clamp(b.x0, 0, Wd), by0 = clamp(b.y0, 0, Ht), bx1 = clamp(b.x1, 0, Wd), by1 = clamp(b.y1, 0, Ht);
      if (bx1 - bx0 < 2 || by1 - by0 < 2) continue;
      const hs = holes.concat(done).map((h) => ({ x0: h.x0 - bx0, y0: h.y0 - by0, x1: h.x1 - bx0, y1: h.y1 - by0 }));
      for (const q of guillotine(bx1 - bx0, by1 - by0, hs)) out.push({ x0: q.x0 + bx0, y0: q.y0 + by0, x1: q.x1 + bx0, y1: q.y1 + by0 });
      done.push({ x0: bx0, y0: by0, x1: bx1, y1: by1 });
    }
    return out;
  }

  function readM() {
    for (const el of document.querySelectorAll('[id^=PooledPopup]')) {
      try {
        const n = el.buildNode({}, el)[1];
        const m = n && n.properties && n.properties['meters-per-pixel'];
        if (m && /gamepadui/.test(n.properties.key || '')) return m;
      } catch (_) { /* skip */ }
    }
    return 0;
  }

  // How Steam shows a surface: the part of its texture the parent panel
  // displays (uv) and the panel's scene units per texture pixel (mpp).
  //  - Popups and the bar are PooledPopup panels on this page; Steam crops a
  //    popup's texture to its content and changes that range live.
  //  - The main window is mounted from Steam's own scene graph; its frame
  //    node gives its pre-resize height (override-pre-resize-main-panel-
  //    height, 1.5 for 1080 px = 0.001389 /px). A user resize scales it on
  //    top of that; our panels follow it (frame-resize-scale-factor 1).
  //  - src 'none': the parent panel is not on this page; not built.
  // Is Steam's page (the one Steam's main window is summoned into) not the frame's active page right now
  // (SteamVR Settings or the binding UI shows in its place)? Read from SteamVR's FrameStore on this page,
  // every frame (frameWatch), so main's nodes go and come back in the same scene-graph update as the page.
  function mainAway(key) {
    if (key !== 'valve.steam.gamepadui.main') return false;
    try {
      const FS = window.FrameStore;
      if (!FS || !FS.frames) return false;
      for (const f of FS.frames) {
        const pages = f.m_mapPages ? [...f.m_mapPages.values()] : [];
        if (!pages.some((p) => p && p.m_sSummonOverlayKey === key)) continue;
        const ap = f.activePage;
        return !!ap && ap.m_sSummonOverlayKey !== key;
      }
    } catch (_) { /* no store */ }
    return false;
  }

  function parentInfo(key, texH) {
    if (mainAway(key)) return { src: 'away', uv: [0, 0, 1, 1], mpp: 0 };
    const el = document.getElementById('PooledPopup-' + key);
    if (el && typeof el.buildNode === 'function') {
      try {
        const p = el.buildNode({}, el)[1].properties;
        const uv = [p.uv_min[0], p.uv_min[1], p.uv_max[0], p.uv_max[1]].map(Number);
        if (uv.every(Number.isFinite) && uv[2] > uv[0] && uv[3] > uv[1]) {
          return { src: 'popup', uv, mpp: num(p['meters-per-pixel'], 0), curv: curvOriginOf(el, 0) };
        }
      } catch (_) { /* fall through */ }
    }
    for (const f of document.querySelectorAll('vsg-node[vsg-type=frame-node]')) {
      if (!mountsKey(f, key)) continue;
      try {
        const h = num(f.buildNode({}, f)[1].properties['override-pre-resize-main-panel-height'], 0);
        if (h > 0 && texH > 0) return { src: 'frame', uv: [0, 0, 1, 1], mpp: h / texH };
      } catch (_) { /* skip */ }
    }
    return { src: 'none', uv: [0, 0, 1, 1], mpp: 0 };
  }

  // The curvature origin a popup panel really curves about: its own
  // curvature-origin-id (the bar, the floating footer: the dashboard's), or
  // else that of the panel it is reparented to (a bar popup hangs off the bar
  // and inherits it). Our copies name it explicitly; with plain "inherit" a
  // copy of a bar popup curved about its own centre and crossed Steam's
  // panel, so only a middle strip of it showed (R1 B1, SG-POPUP).
  function curvOriginOf(el, depth) {
    try {
      const co = el.buildNode({}, el)[1].properties['curvature-origin-id'];
      if (typeof co === 'string' && co) return co;
    } catch (_) { /* no props */ }
    if (depth >= 3) return null;
    for (let e = el.parentElement; e && e.tagName !== 'VSG-APP'; e = e.parentElement) {
      if (e.tagName !== 'VSG-NODE' || e.getAttribute('vsg-type') !== 'reparent-to-panel') continue;
      let k = null;
      try { k = e.buildNode({}, e)[1].properties['parent-overlay-key']; } catch (_) { return null; }
      const pe = k ? document.getElementById('PooledPopup-' + k) : null;
      return pe && typeof pe.buildNode === 'function' ? curvOriginOf(pe, depth + 1) : null;
    }
    return null;
  }

  function mountsKey(f, key) {
    for (const m of f.querySelectorAll('vsg-node[vsg-type=mountedscenegraph]')) {
      try {
        if (m.buildNode({}, m)[1].properties.mountable_id === 'system.standalone::' + key) return true;
      } catch (_) { /* skip */ }
    }
    return false;
  }

  // Panel property overrides per kind: defaults < spec.flags.all < spec.flags[kind]
  function flagsFor(spec) {
    const pick = (o) => {
      const out = {};
      if (o && typeof o === 'object') for (const k of FLAG_KEYS) if (o[k] !== undefined && o[k] !== null) out[k] = o[k];
      return out;
    };
    const f = (spec && spec.flags) || {};
    const all = Object.assign({}, DEFAULT_FLAGS, pick(f.all));
    const out = {};
    for (const k of KINDS) out[k] = Object.assign({}, all, pick(f[k]));
    return out;
  }

  function depthToken(tok) {
    if (st.reduce || st.depthToken === 'none') return null;
    return (typeof tok === 'string' && tok) ? tok : st.depthToken;
  }

  // A slot id whose element moved: more than a quarter of its size, or a
  // size change over 2.5 px.
  function rectMoved(a, b) {
    if (Math.abs(a.w - b.w) > 2.5 || Math.abs(a.h - b.h) > 2.5) return true;
    return Math.abs(a.x - b.x) > a.w / 4 || Math.abs(a.y - b.y) > a.h / 4;
  }
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  // Depth channel bookkeeping for one surface's spec pops (called by build).
  function trackPops(s, now, seenKeys) {
    const key = String(s.steamKey);
    const cut = new Set(Array.isArray(s.cut) ? s.cut.map(String) : []);
    const slabsOut = new Map();
    for (const o of Array.isArray(s.slabsOut) ? s.slabsOut : []) if (o && o.id !== undefined && Array.isArray(o.slab)) slabsOut.set(String(o.id), o.slab);
    const coverDz = num(s.coverDz, 0.001), baseDz = num(s.baseDz, 0.002);
    for (const p of Array.isArray(s.popped) ? s.popped : []) {
      if (!p || p.id === undefined) continue;
      const x = num(p.x, NaN), y = num(p.y, NaN), w = num(p.w, 0), h = num(p.h, 0);
      if (!(w > 0 && h > 0) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      const id = String(p.id);
      const k = key + '#' + id;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      const rect = { x, y, w, h };
      const dz = num(p.dz, 0.012);
      const tok = depthToken(p.motion);
      let ps = st.pops.get(k);
      if (ps && rectMoved(ps.rect, rect)) {
        // the slot moved to another element: the old one sinks as a ghost
        // (unless it overlaps the new one, which would double content)
        st.pops.delete(k);
        if (!overlaps(ps.rect, rect) && ps.sink && tok) {
          const g = Object.assign(ps, { id: id + '~' + (++st.ghostN), sinking: true, sinkAt: now, ghost: true });
          g.c.label = key + '#' + g.id;
          chanSet(g.c, ps.baseDz, 'fade', now);
          st.pops.set(key + '#' + g.id, g);
        }
        ps = null;
      }
      if (!ps) {
        // rise from the base plane (the rest depth), or from p.from
        const from = p.from === 'cut' || !tok ? dz : Math.max(num(p.from, baseDz), baseDz);
        ps = { surface: key, id, rect, c: chan(from, k), sink: true, sinking: false, ghost: false, slab: null, clip: null };
        st.pops.set(k, ps);
      }
      ps.rect = rect;
      ps.p = p;
      ps.sink = p.sink !== false;
      ps.sinking = false;
      ps.coverDz = coverDz;
      ps.baseDz = baseDz;
      if (Array.isArray(p.slab) && p.slab.length === 4) ps.slab = p.slab;
      ps.clip = Array.isArray(p.clip) ? p.clip : null;
      chanSet(ps.c, dz, tok, now);
    }
    // pops of this surface that left the spec: sink, or go at once
    for (const [k, ps] of st.pops) {
      if (ps.surface !== key || seenKeys.has(k)) continue;
      if (ps.sinking) {
        const so = slabsOut.get(ps.id);
        if (so) ps.slab = so;
        if (now - ps.sinkAt > SINK_MAX_MS) { st.pops.delete(k); continue; }
        seenKeys.add(k);
        continue;
      }
      const tok = depthToken('fade');
      if (!ps.sink || !tok || cut.has(ps.id) || chanAt(ps.c, now)[0] <= baseDz) { st.pops.delete(k); continue; }
      ps.sinking = true;
      ps.sinkAt = now;
      const so = slabsOut.get(ps.id);
      if (so) ps.slab = so;
      chanSet(ps.c, baseDz, 'fade', now);
      seenKeys.add(k);
    }
  }

  // Spec surface -> item descriptors. Everything is clipped to the part of
  // the texture the parent panel shows; anchors are texture uv (SteamVR maps
  // them onto that part).
  function describe(s, c) {
    const key = String(s.steamKey);
    const Wd = Math.round(num(s.texW, 0)), Ht = Math.round(num(s.texH, 0));
    const g = s.glassd;
    if (!Wd || !Ht || !g || !g.key || !Array.isArray(g.backdrop)) return;
    const P = parentInfo(key, Ht);
    const M = c.Mspec > 0 ? c.Mspec : (P.mpp || c.Mfallback);
    c.info[key] = { src: P.src, uv: P.uv.map(r6), mpp: M, curv: P.curv || null };
    if (P.src !== 'popup' && P.src !== 'frame') { c.info[key].skipped = 'no parent panel'; return; }
    if (!(M > 0)) return;
    c.built.add(key);
    const scale = num(g.scale, 0.75) || 0.75;
    const coverDz = num(s.coverDz, 0.001), baseDz = num(s.baseDz, 0.002);
    const short = key.replace(/^valve\.steam\.gamepadui\./, '');
    const dimKey = st.dims.has(key) ? key : null;
    const add = (k, d) => {
      c.want.set(key + '#' + k, Object.assign({ parentKey: key, ms: M, flags: c.flags[d.kind], curvOrigin: P.curv || null }, d));
      c.counts[d.kind] = (c.counts[d.kind] || 0) + 1;
    };
    // R: the displayed region in texture px; au/av: texture px -> anchor
    const R = {
      x0: Math.max(0, Math.round(P.uv[0] * Wd)), y0: Math.max(0, Math.round(P.uv[1] * Ht)),
      x1: Math.min(Wd, Math.round(P.uv[2] * Wd)), y1: Math.min(Ht, Math.round(P.uv[3] * Ht)),
    };
    if (R.x1 - R.x0 < 2 || R.y1 - R.y0 < 2) return;
    // Anchors are in the parent's TEXTURE uv (0..1 over its whole texture),
    // not in the displayed range: SteamVR maps anchor-u/v onto the displayed
    // part (uv_min..uv_max) of the parent panel and clamps what lies outside
    // it to its edge. Measured on the frame menu (uv x 0.773..1): anchor-u 0.5
    // put a copy half a panel to the left (clamped to the left edge), 0.8867
    // (the displayed centre) exactly on Steam's panel (R1 B1, SG-POPUP). The
    // main window (uv 0..1) and the bar (a symmetric range, centred items
    // only) never showed the difference.
    const au = (x) => x / Wd;
    const av = (y) => y / Ht;

    // cover: glassd's backdrop maps linearly onto the Steam texture; plates
    // are drawn by glassd inside it (contracts/glassd.md 1.3)
    const [b0, b1, b2, b3] = g.backdrop.map(Number);
    add('cover', {
      kind: 'cover', id: null, px: [R.x1 - R.x0, R.y1 - R.y0], u: au((R.x0 + R.x1) / 2), v: av((R.y0 + R.y1) / 2), z: coverDz,
      key: g.key, uv: [b0 + (b2 - b0) * R.x0 / Wd, b1 + (b3 - b1) * R.y0 / Ht, b0 + (b2 - b0) * R.x1 / Wd, b1 + (b3 - b1) * R.y1 / Ht],
      mpp: M / scale, name: 'lgs:cover:' + short, dimKey,
    });

    const holes = [];
    for (const [pk, ps] of st.pops) {
      if (ps.surface !== key || !c.seen.has(pk)) continue;
      const { x, y, w, h } = ps.rect;
      // optional clip [x0,y0,x1,y1] (texture px): the daemon trims a sliver
      // that overlaps another popped element; the slab is cropped the same way
      let cx0 = x, cy0 = y, cx1 = x + w, cy1 = y + h;
      if (ps.clip && ps.clip.length === 4) {
        const k = ps.clip.map(Number);
        if (k.every(Number.isFinite)) { cx0 = Math.max(cx0, k[0]); cy0 = Math.max(cy0, k[1]); cx1 = Math.min(cx1, k[2]); cy1 = Math.min(cy1, k[3]); }
      }
      const x0 = Math.max(R.x0, Math.round(cx0)), y0 = Math.max(R.y0, Math.round(cy0));
      const x1 = Math.min(R.x1, Math.round(cx1)), y1 = Math.min(R.y1, Math.round(cy1));
      if (x1 - x0 < 2 || y1 - y0 < 2) continue;   // outside what Steam shows (scrolled away)
      holes.push({ x0: x0 - R.x0, y0: y0 - R.y0, x1: x1 - R.x0, y1: y1 - R.y0 });
      const id = ps.id;
      const u = au((x0 + x1) / 2), v = av((y0 + y1) / 2);
      const interactive = c.profile === 'wearer' && !ps.ghost && !!(ps.p && ps.p.interactive === true);
      add('pop:' + id, {
        kind: 'pop', id, ghost: ps.ghost, px: [x1 - x0, y1 - y0], u, v, z: ps.c.target, popKey: pk, baseDz, coverDz,
        key, uv: [x0 / Wd, y0 / Ht, x1 / Wd, y1 / Ht], mpp: M, name: 'lgs:pop:' + short + ':' + id, interactive,
      });
      if (ps.slab && ps.slab.length === 4) {
        // The slab is the element's full rect; crop it like the element was.
        const [s0, t0, s1, t1] = ps.slab.map(Number);
        const fx0 = (x0 - x) / w, fx1 = (x1 - x) / w, fy0 = (y0 - y) / h, fy1 = (y1 - y) / h;
        add('slab:' + id, {
          kind: 'slab', id, ghost: ps.ghost, px: [x1 - x0, y1 - y0], u, v, z: ps.c.target, popKey: pk, baseDz, coverDz,
          key: g.key, uv: [s0 + (s1 - s0) * fx0, t0 + (t1 - t0) * fy0, s0 + (s1 - s0) * fx1, t0 + (t1 - t0) * fy1],
          mpp: M / scale, name: 'lgs:slab:' + short + ':' + id,
        });
      }
    }

    // Room dim (glassd G7, contracts/glassd.md 1.4): each `dimSlabs` cell is
    // a flat dark tone with a feathered edge. It goes behind the window, centred
    // on its rect and scaled up, so it darkens the room around the window and
    // the feather becomes a soft edge. Never interactive, never popped.
    for (const o of Array.isArray(s.dimSlabs) ? s.dimSlabs : []) {
      if (!o || o.id === undefined || !Array.isArray(o.slab) || o.slab.length !== 4) continue;
      const x = num(o.x, NaN), y = num(o.y, NaN), w = num(o.w, 0), h = num(o.h, 0);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !(w > 0 && h > 0)) continue;
      const k = Math.max(1, num(o.scaleUp, ROOMDIM_SCALE));
      add('roomdim:' + o.id, {
        kind: 'roomdim', id: String(o.id), px: [Math.round(w * k), Math.round(h * k)], u: au(x + w / 2), v: av(y + h / 2),
        z: Math.min(num(o.dz, ROOMDIM_DZ), ROOMDIM_DZ), key: g.key, uv: o.slab.map(Number), mpp: (M / scale) * k,
        name: 'lgs:roomdim:' + short + ':' + o.id,
      });
    }

    // mosaic bands (windowless routes): only these get base pieces
    let bands = null;
    if (Array.isArray(s.mosaic)) {
      bands = [];
      for (const b of s.mosaic) {
        const x = num(b && b.x, NaN), y = num(b && b.y, NaN), w = num(b && b.w, 0), h = num(b && b.h, 0);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !(w > 0 && h > 0)) continue;
        bands.push({ x0: Math.round(x) - R.x0, y0: Math.round(y) - R.y0, x1: Math.round(x + w) - R.x0, y1: Math.round(y + h) - R.y0 });
      }
    }
    mosaic(R.x1 - R.x0, R.y1 - R.y0, holes, bands).forEach((q, i) => {
      const p = { x0: q.x0 + R.x0, y0: q.y0 + R.y0, x1: q.x1 + R.x0, y1: q.y1 + R.y0 };
      add('base:' + i, {
        kind: 'base', id: null, px: [p.x1 - p.x0, p.y1 - p.y0], u: au((p.x0 + p.x1) / 2), v: av((p.y0 + p.y1) / 2), z: baseDz,
        key, uv: [p.x0 / Wd, p.y0 / Ht, p.x1 / Wd, p.y1 / Ht], mpp: M, name: 'lgs:base:' + short + ':' + i, dimKey,
      });
    });
  }

  // ------------------------------------------------------------ SteamVR Settings glass
  // SteamVR Settings (frame page system.settings) is a panel of this page (#vrsettingspanel), not a Steam
  // window. Its window glass was CSS only (no room behind it): with the spec's `vr` entry (glassd's
  // "vrsettings" surface, drawn ahead while the page is away) a cover panel goes right behind the
  // settings panel, in its own transform, the moment the page mounts (frameWatch), and html.lgs-native-vr
  // drops the CSS window fill (theme/vr/30-settings.css). Without the entry, or glassd, the CSS glass stays.
  const VRP = { el: null, xf: null, panel: null };
  function vrPanelEl() { return document.querySelector('#vrsettingspanel'); }
  // the panel's size and its glass rect (the page container), in its own px (for glassd's shapes)
  function vrPanelInfo() {
    const p = vrPanelEl();
    if (!p) return null;
    const pr = p.getBoundingClientRect();
    if (!(pr.width > 1 && pr.height > 1)) return null;
    const out = { w: Math.round(pr.width), h: Math.round(pr.height), glass: null };
    const c = p.querySelector('.SettingsSidebarPageContainer');
    if (c) {
      const r = c.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) {
        out.glass = { x: Math.round(r.left - pr.left), y: Math.round(r.top - pr.top), w: Math.round(r.width), h: Math.round(r.height),
          r: Math.round(parseFloat(getComputedStyle(c).borderTopLeftRadius) || 0) };
      }
    }
    return out;
  }
  function vrSig() {
    const p = vrPanelEl();
    return p ? 'vr' + (p === VRP.el && VRP.xf && VRP.xf.isConnected ? 1 : 0) : '';
  }
  function setVrClass(on) {
    try { document.documentElement.classList.toggle('lgs-native-vr', !!on); } catch (_) { /* gone */ }
  }
  function vrCoverDrop() {
    if (VRP.xf) {
      try { VRP.xf.remove(); } catch (_) { /* gone */ }
      retire([VRP.xf, VRP.panel]);
    }
    VRP.el = null; VRP.xf = null; VRP.panel = null;
    setVrClass(false);
  }
  function vrCoverSync(v) {
    const p = vrPanelEl();
    const g = v && v.glassd;
    if (!p || !p.parentElement || !g || !g.key || !Array.isArray(g.backdrop) || g.backdrop.length !== 4) { if (VRP.xf) { vrCoverDrop(); return true; } setVrClass(false); return false; }
    let sp = null;
    try { sp = p.buildNode({}, p)[1].properties; } catch (_) { sp = null; }
    if (!sp || !(num(sp.width, 0) > 0)) { if (VRP.xf) { vrCoverDrop(); return true; } return false; }
    const [b0, b1, b2, b3] = g.backdrop.map(Number);
    const props = {
      key: g.key, uv_min: [r6(b0), r6(b1)], uv_max: [r6(b2), r6(b3)], width: sp.width,
      origin: Array.isArray(sp.origin) ? sp.origin : [0, -1],
      'scale-index': sp['scale-index'] || 0, 'frame-resize-scale-factor': num(sp['frame-resize-scale-factor'], 1),
      interactive: false, visibility: 0, reflect: 0, debug_name: 'lgs:vrsettings:cover',
    };
    if (sp['curvature-origin-id']) props['curvature-origin-id'] = sp['curvature-origin-id'];
    else props.curvature = 'inherit-from-parent-panel';
    let changed = false;
    if (VRP.el !== p || !VRP.xf || !VRP.xf.isConnected) {
      if (VRP.xf) vrCoverDrop();
      const xf = vtransform(-0.0004);
      const panel = vnode('panel', props);
      xf.appendChild(panel);
      p.parentElement.insertBefore(xf, p);
      VRP.el = p; VRP.xf = xf; VRP.panel = panel;
      changed = true;
    } else if (JSON.stringify(VRP.panel.__lgsProps) !== JSON.stringify(props)) {
      VRP.panel.__lgsProps = props;
      changed = true;
    }
    setVrClass(true);
    return changed;
  }

  // Parent geometry of every surface in a spec (the tick re-lays out on change).
  function parentSig(spec) {
    const out = [];
    for (const s of (spec && Array.isArray(spec.surfaces)) ? spec.surfaces : []) {
      if (!s || !s.steamKey || (s.visible === false && s.standby !== true)) continue;
      const P = parentInfo(String(s.steamKey), Math.round(num(s.texH, 0)));
      out.push(s.steamKey + ':' + P.src + ':' + P.uv.map(r6).join(',') + ':' + P.mpp + ':' + (P.curv || ''));
    }
    if (spec && spec.vr) out.push(vrSig());
    return out.join('|');
  }

  // Per parent panel: item counts and when its cover and each popped
  // element (crop and slab) first went out in a push (0 = not yet).
  function surfSummary() {
    const out = {};
    for (const it of st.items.values()) {
      const d = it.d;
      const s = out[d.parentKey] || (out[d.parentKey] = { cover: 0, base: 0, pop: 0, slab: 0, coverAt: 0, pops: {} });
      s[d.kind] = (s[d.kind] || 0) + 1;
      if (d.kind === 'cover') s.coverAt = it.pushedAt || 0;
      else if ((d.kind === 'pop' || d.kind === 'slab') && !d.ghost) {
        const prev = s.pops[d.id];
        const at = it.pushedAt || 0;
        s.pops[d.id] = prev === undefined ? at : (prev && at ? Math.max(prev, at) : 0);
      }
    }
    return out;
  }

  function animCount() {
    const now = Date.now();
    let n = 0;
    for (const p of st.pops.values()) if (p.c.moving && !chanSettled(p.c, now)) n++;
    for (const d of st.dims.values()) if (d.c.moving && !chanSettled(d.c, now)) n++;
    for (const c of animatedOverrideChans()) if (c.moving && !chanSettled(c, now)) n++;
    return n;
  }

  function beat(rebuilt) {
    return {
      items: st.items.size, expired: st.expired, rebuilt: !!rebuilt,
      attached: isAttached(), push: !!sched.push,
      pending: !!st.pushTimer || !!st.anim.timer || st.unpushed.size > 0,
      pushIn: st.pushTimer ? Math.max(0, st.pushDue - Date.now()) : (st.anim.timer ? 0 : null),
      specSeq: st.specSeq, now: Date.now(), anim: animCount(), surf: surfSummary(),
      vr: (() => { try { return vrPanelInfo(); } catch (_) { return null; } })(),
    };
  }

  // ------------------------------------------------------------ build
  function update(spec) {
    if (st.destroyed) return { error: 'destroyed' };
    contact(false);   // the build below replaces any watchdog rebuild
    st.updates++;
    st.lastSpecAt = Date.now();
    st.lastSpec = (spec && typeof spec === 'object') ? spec : {};
    st.specSeq = st.lastSpec.seq !== undefined ? st.lastSpec.seq : null;
    build(st.lastSpec);
    // The spec is declarative: an absent or null `window` is the window at
    // rest ({dim: 1, recede: 0}, animated back on sheet-out), exactly like an
    // absent surfaces[].dim (R1 M1). So the daemon dropping the request (the
    // report's data-lgs-window-dim gone, the sgwindow action's TTL) restores.
    const w = st.lastSpec.window;
    setWindow((w && typeof w === 'object') ? w : {});
    return Object.assign({}, st.lastSummary, beat(false));
  }

  function build(spec) {
    const now = Date.now();
    const Mspec = num(spec.M, 0);
    st.profile = spec.profile === 'wearer' ? 'wearer' : 'default';
    st.reduce = !!spec.reduceMotion;
    st.depthToken = typeof spec.depthMotion === 'string' && spec.depthMotion ? spec.depthMotion : 'depth';
    if (num(spec.unitM, 0) > 0 && spec.unitM !== st.unitM) { st.unitM = num(spec.unitM, 0); geomCache = null; }
    if (!st.M) { st.M = readM(); st.MSource = st.M ? 'PooledPopup' : ''; }
    // standby: a hidden pooled popup the daemon keeps glass for; built only while Steam's panel for it
    // is on the page (describe), which the panel watch below catches the moment it is inserted
    const surfaces = (Array.isArray(spec.surfaces) ? spec.surfaces : []).filter((s) => s && s.steamKey && (s.visible !== false || s.standby === true));
    // dims first (describe reads them)
    const dimWant = new Map();
    for (const s of surfaces) if (s.dim !== undefined && s.dim !== null && Number.isFinite(Number(s.dim))) dimWant.set(String(s.steamKey), clamp(Number(s.dim), 0, 1));
    for (const [k, v] of dimWant) {
      let d = st.dims.get(k);
      if (!d) { d = { c: chan(1), want: v }; st.dims.set(k, d); }
      d.want = v;
      chanSet(d.c, v, st.reduce ? null : (v < chanAt(d.c, now)[0] ? 'sheet-in' : 'sheet-out'), now);
    }
    for (const [k, d] of st.dims) {
      if (dimWant.has(k)) continue;
      if (!surfaces.some((s) => String(s.steamKey) === k)) { st.dims.delete(k); continue; }   // surface gone
      if (d.want !== null) { d.want = null; chanSet(d.c, 1, st.reduce ? null : 'sheet-out', now); }
      if (!d.c.moving) st.dims.delete(k);
    }
    const c = { Mspec, Mfallback: st.M, want: new Map(), counts: {}, info: {}, flags: flagsFor(spec), seen: new Set(), built: new Set(), profile: st.profile };
    for (const s of surfaces) {
      try { trackPops(s, now, c.seen); } catch (e) { note('pops ' + s.steamKey + ': ' + e.message); }
    }
    // pops of surfaces no longer in the spec go at once
    for (const [k, ps] of st.pops) if (!surfaces.some((s) => String(s.steamKey) === ps.surface)) st.pops.delete(k);
    for (const s of surfaces) {
      try { describe(s, c); } catch (e) { note('describe ' + s.steamKey + ': ' + e.message); }
    }
    // pops whose surface was not built (no parent panel) go at once
    for (const [k, ps] of st.pops) if (!c.built.has(ps.surface)) st.pops.delete(k);
    // fail closed without the scheduler or its retire export (R1 m2)
    if (!sched.push || !sched.retire) {
      if (c.want.size) c.failClosed = c.want.size;
      c.want.clear();
      st.pops.clear();
      st.dims.clear();
    }
    st.parents = c.info;
    let vrChanged = false;
    try { vrChanged = vrCoverSync(spec.vr); } catch (e) { note('vr cover: ' + e.message); }
    st.parentSig = parentSig(spec);
    const M = Mspec || st.M;
    const attached = ensureAttached();
    let dirty = vrChanged;
    for (const [k, it] of st.items) {
      if (!c.want.has(k)) { removeItem(it); st.items.delete(k); dirty = true; }
    }
    for (const [k, d] of c.want) {
      const it = st.items.get(k);
      if (!it) { st.items.set(k, createItem(d)); dirty = true; continue; }
      const r = updateItem(it, d);
      if (r === 'rebuild') {
        // the new nodes go out in the same push that retires the old ones
        const n = createItem(d);
        n.pushedAt = it.pushedAt;
        removeItem(it);
        st.items.set(k, n);
        dirty = true;
      } else if (r) dirty = true;
    }
    applyAnimated(now);
    if (anyMoving(now)) startAnim();
    else if (dirty) schedulePush();
    st.lastSummary = { items: st.items.size, counts: c.failClosed ? {} : c.counts, changed: dirty, attached, M, profile: st.profile };
    if (c.failClosed) st.lastSummary.error = sched.error + ' (' + c.failClosed + ' items not built)';
    return st.lastSummary;
  }

  // Remove every node; keepSpec (watchdog) remembers the spec for a rebuild.
  function clearNodes() {
    for (const it of st.items.values()) removeItem(it);
    st.items.clear();
    st.unpushed.clear();
    st.pops.clear();
    st.dims.clear();
    if (st.root && st.root.parentNode) st.root.remove();
    st.wasAttached = false;
    if (st.pushTimer) { clearTimeout(st.pushTimer); st.pushTimer = 0; }
    if (st.anim.timer) { clearTimeout(st.anim.timer); st.anim.timer = 0; }
  }

  function clear() {
    st.lastSpec = null;
    st.specSeq = null;
    st.expired = false;
    clearNodes();
    ov.rules = [];
    ov.internal.clear();
    ov.chans.clear();
    ov.removing.clear();
    ov.seq = null;
    clearTimeout(yawTimer);
    winReq = null;
    Object.assign(win.dimC, chan(1));
    Object.assign(win.recC, chan(0));
    restoreAll();
    pushNow();
    return true;
  }

  // A sign of life from the daemon (update, ping, overrides, windowState,
  // test.yaw). After a watchdog expiry the first of them, whichever it is,
  // revives: the last spec is rebuilt and the overrides re-applied (R1 m4).
  // update() passes revive = false: its own build of the new spec follows.
  // Returns null when nothing had expired, else whether anything came back.
  function contact(revive) {
    st.lastContact = Date.now();
    if (!st.expired) return null;
    st.expired = false;
    ov.suspended = false;
    let rebuilt = false;
    if (revive !== false && st.lastSpec) {
      try { build(st.lastSpec); rebuilt = true; st.rebuilds++; } catch (e) { note('rebuild: ' + e.message); }
    }
    if (ov.rules.length || ov.internal.size || winRules().length) { rebuilt = true; schedulePush(); }
    // a value that was moving when the watchdog fired finishes its spring
    if (anyMoving(Date.now())) startAnim();
    return rebuilt;
  }

  // Heartbeat. After a watchdog expiry it rebuilds the last spec and
  // re-applies the overrides (the daemon follows with a fresh spec).
  function ping() {
    if (st.destroyed) return { error: 'destroyed' };
    return beat(contact() === true);
  }

  // ------------------------------------------------------------ overrides
  // Transform overrides of SteamVR's own (React-owned) chrome nodes,
  // composed with React's values (contracts/sg.md section 4).
  const ov = {
    rules: [],              // active rules (from overrides()), plus internal ones
    seq: null,
    recs: new Map(),        // element -> rec
    chans: new Map(),       // rule id -> fraction channel (rules with motion)
    removing: new Map(),    // rule id -> rule (animating out)
    suspended: false,
    missing: [],
    applied: [],
    internal: new Map(),    // id -> rule (test yaw)
    errors: [],
    dirty: false,
  };
  function animatedOverrideChans() { return [...ov.chans.values(), win.dimC, win.recC]; }

  function ovNote(msg) {
    ov.errors.push(msg);
    if (ov.errors.length > 8) ov.errors.shift();
  }

  function frameNodeForMain() {
    for (const f of document.querySelectorAll('vsg-node[vsg-type=frame-node]')) if (mountsKey(f, 'valve.steam.gamepadui.main')) return f;
    return null;
  }

  // t1: the vsg-transform parent of the mountedscenegraph of Steam's page.
  function t1Node() {
    const sp = steamPage();
    for (const m of document.querySelectorAll('vsg-node[vsg-type=mountedscenegraph]')) {
      let id = '';
      try { id = String(m.buildNode({}, m)[1].properties.mountable_id || ''); } catch (_) { continue; }
      const hit = sp ? (id === sp.mountable || id.endsWith('::' + sp.mountable)) : /frame:\d+:page:3:mountable$/.test(id);
      if (hit && m.parentElement && m.parentElement.tagName === 'VSG-TRANSFORM') return m.parentElement;
    }
    return null;
  }

  const notOurs = (el) => !(st.root && st.root.contains(el));

  function findTargets(rule) {
    let els = [];
    try {
      if (rule.select) {
        els = [...document.querySelectorAll(rule.select)].filter((e) => e.tagName === 'VSG-TRANSFORM' || e.tagName === 'VSG-NODE');
      } else {
        switch (rule.target) {
          case 'window': { const t = t1Node(); if (t) els = [t]; break; }
          case 'window-scale': { const t = t1Node(); if (t && t.parentElement && t.parentElement.tagName === 'VSG-TRANSFORM') els = [t.parentElement]; break; }
          case 'frame-left':
            els = [...document.querySelectorAll('vsg-transform[parent-id$="gamepadui.main_CenterLeft"]')]
              .filter((e) => e.querySelector('[id^="PooledPopup-valve.steam.gamepadui.frame.menu"]'));
            break;
          case 'frame-controls':
            els = [...document.querySelectorAll('vsg-transform[id$=":bottom-controls-transform"]')]
              .map((e) => [...e.children].find((k) => k.tagName === 'VSG-TRANSFORM')).filter(Boolean);
            break;
          case 'grab-handle': { const e = document.getElementById('DashboardGrabHandleTransform'); if (e) els = [e]; break; }
          case 'resize-corner':
            els = [...document.querySelectorAll('vsg-transform[parent-id$="gamepadui.main_BottomRight"]')];
            break;
          case 'tooltips':
            els = [...document.querySelectorAll('.v-parent-portal > vsg-transform > vsg-transform')];
            break;
          case 'frame-node': { const f = frameNodeForMain(); if (f) els = [f]; break; }
          default: els = [];
        }
      }
    } catch (e) { ovNote(rule.id + ': ' + e.message); }
    return els.filter(notOurs);
  }

  const parseVec = (s, n, dflt) => {
    const v = String(s || '').trim().split(/\s+/).map(Number);
    return v.length === n && v.every(Number.isFinite) ? v : dflt.slice();
  };
  const fmt = (v) => v.map((x) => String(Math.round(x * 1e7) / 1e7)).join(' ');
  function qmul(a, b) {   // [w, x, y, z]
    return [
      a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
      a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
      a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
      a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    ];
  }

  // Normalise a rule; null if unusable.
  function normRule(r) {
    if (!r || typeof r !== 'object' || !r.id) return null;
    const vec = (a) => (Array.isArray(a) && a.length === 3 && a.map(Number).every(Number.isFinite)) ? a.map(Number) : null;
    const out = {
      id: String(r.id), target: r.target ? String(r.target) : null, select: typeof r.select === 'string' ? r.select : null,
      add: vec(r.add), addMm: vec(r.addMm), mul: vec(r.mul), resize: r.resize !== false,
      yawDeg: Number.isFinite(Number(r.yawDeg)) ? Number(r.yawDeg) : null,
      props: (r.props && typeof r.props === 'object') ? r.props : null,
      tint: Number.isFinite(Number(r.tint)) ? clamp(Number(r.tint), 0, 1) : null,
      motion: typeof r.motion === 'string' ? r.motion : null,
      internal: !!r.internal,
      dyn: typeof r.dyn === 'function' ? r.dyn : null,
    };
    if (!out.target && !out.select) return null;
    return out;
  }

  // The fraction (0..1) of a rule's effect currently applied.
  function ruleFrac(rule, now) {
    const c = ov.chans.get(rule.id);
    return c ? clamp(chanAt(c, now)[0], 0, 1.2) : 1;
  }

  function allRules() {
    const out = ov.rules.slice();
    for (const r of ov.internal.values()) out.push(r);
    for (const r of winRules()) out.push(r);
    for (const r of ov.removing.values()) if (!out.some((x) => x.id === r.id)) out.push(r);
    return out;
  }

  // Apply every active rule to its targets; restore elements no rule wants.
  function applyOverrides(now) {
    const want = new Map();   // el -> [rules]
    const applied = [], missing = [];
    if (!ov.suspended && !st.destroyed) {
      for (const rule of allRules()) {
        const els = findTargets(rule);
        if (!els.length) { missing.push(rule.id); continue; }
        for (const el of els) { if (!want.has(el)) want.set(el, []); want.get(el).push(rule); }
        applied.push({ id: rule.id, target: rule.target || rule.select, n: els.length, el: els[0] });
      }
    }
    // restore what is no longer wanted
    for (const [el, rec] of [...ov.recs]) if (!want.has(el)) restoreEl(el, rec);
    for (const [el, rules] of want) composeEl(el, rules, now);
    ov.applied = applied.map((a) => {
      const e = a.el;
      delete a.el;
      const rec = ov.recs.get(e) || {};
      return Object.assign(a, { now: e.getAttribute('translation'), base: rec.tBase, sgid: e.getAttribute('sgid') },
        rec.tintFn ? { tint: rec.tint } : {}, rec.tintError ? { error: rec.tintError } : {});
    });
    ov.missing = missing;
  }

  function recFor(el) {
    let rec = ov.recs.get(el);
    if (rec) return rec;
    rec = {
      tBase: el.getAttribute('translation'), rBase: el.getAttribute('rotation'),
      tWritten: null, rWritten: null, mo: null, rules: [], node: null, origBuild: undefined, hadBuild: false,
    };
    if (el.tagName === 'VSG-TRANSFORM') {
      rec.mo = new MutationObserver(() => {
        if (st.destroyed || !ov.recs.has(el)) return;
        const t = el.getAttribute('translation'), r = el.getAttribute('rotation');
        let changed = false;
        if (rec.tWritten !== null && t !== rec.tWritten) { rec.tBase = t; changed = true; }
        if (rec.rWritten !== null && r !== rec.rWritten) { rec.rBase = r; changed = true; }
        if (changed) {
          composeEl(el, rec.rules, Date.now());   // before SteamVR's setTimeout(0) push
          const id = el.getAttribute('sgid');
          for (const a of ov.applied) if (a.sgid === id) Object.assign(a, { base: rec.tBase, now: el.getAttribute('translation') });
        }
      });
      try { rec.mo.observe(el, { attributes: true, attributeFilter: ['translation', 'rotation'] }); } catch (_) { rec.mo = null; }
    }
    ov.recs.set(el, rec);
    return rec;
  }

  function composeEl(el, rules, now) {
    if (!el.isConnected) { const rec = ov.recs.get(el); if (rec) { if (rec.mo) rec.mo.disconnect(); ov.recs.delete(el); } return; }
    const rec = recFor(el);
    rec.rules = rules;
    if (el.tagName === 'VSG-TRANSFORM') {
      // translation: React x mul + add + addMm
      const base = parseVec(rec.tBase, 3, [0, 0, 0]);
      let t = base.slice();
      let rot = parseVec(rec.rBase, 4, [1, 0, 0, 0]);
      let touchT = false, touchR = false, tint = null;
      for (const r of rules) {
        const f = ruleFrac(r, now);
        if (r.dyn) {
          const v = r.dyn(now) || {};
          if (Array.isArray(v.add)) { t = t.map((x, i) => x + num(v.add[i], 0)); touchT = true; }
          if (Number.isFinite(v.tint)) tint = (tint === null ? 1 : tint) * v.tint;
          continue;
        }
        if (r.mul) { t = t.map((x, i) => x * (1 + f * (r.mul[i] - 1))); touchT = true; }
        if (r.add) { t = t.map((x, i) => x + f * r.add[i]); touchT = true; }
        if (r.addMm) {
          const g = geom();
          const upm = r.resize ? g.unitsPerMm : 1 / (1000 * g.S);
          t = t.map((x, i) => x + f * r.addMm[i] * upm);
          touchT = true;
        }
        if (r.yawDeg !== null) {
          const a = (r.yawDeg * f) * Math.PI / 360;
          rot = qmul(rot, [Math.cos(a), 0, Math.sin(a), 0]);
          touchR = true;
        }
        if (r.tint !== null) tint = (tint === null ? 1 : tint) * (1 + f * (r.tint - 1));
      }
      if (touchT) {
        const s = fmt(t);
        rec.tWritten = s;
        if (el.getAttribute('translation') !== s) { el.setAttribute('translation', s); ov.dirty = true; }
      } else if (rec.tWritten !== null) {
        rec.tWritten = null;
        if (el.getAttribute('translation') !== rec.tBase && rec.tBase !== null) { el.setAttribute('translation', rec.tBase); ov.dirty = true; }
      }
      if (touchR) {
        const s = fmt(rot);
        rec.rWritten = s;
        if (el.getAttribute('rotation') !== s) { el.setAttribute('rotation', s); ov.dirty = true; }
      } else if (rec.rWritten !== null) {
        rec.rWritten = null;
        if (el.getAttribute('rotation') !== rec.rBase && rec.rBase !== null) { el.setAttribute('rotation', rec.rBase); ov.dirty = true; }
      }
      // tint: the node itself is serialized as a tint node with its own sgid
      // (SP 5, E4); only for identity transforms (nothing to lose)
      if (tint !== null && tint < 0.9999) {
        const ident = !el.hasAttribute('parent-id') && fmt(parseVec(el.getAttribute('translation'), 3, [1, 1, 1])) === '0 0 0' &&
          fmt(parseVec(el.getAttribute('rotation'), 4, [0, 0, 0, 0])) === '1 0 0 0' && fmt(parseVec(el.getAttribute('scale'), 3, [0, 0, 0])) === '1 1 1';
        if (!ident) { rec.tintError = 'not an identity transform'; }
        else {
          rec.tintError = null;
          if (rec.tint !== r6(tint)) ov.dirty = true;
          rec.tint = r6(tint);
          if (!rec.tintFn || el.buildNode !== rec.tintFn) {
            if (!rec.tintFn) { rec.hadBuild = Object.prototype.hasOwnProperty.call(el, 'buildNode'); rec.origBuild = el.buildNode; }
            const sgid = parseInt(el.getAttribute('sgid'), 10);
            rec.tintFn = (ctx) => [Object.assign({}, ctx), { type: 'tint', properties: { sgid, color: [rec.tint, rec.tint, rec.tint] } }];
            el.buildNode = rec.tintFn;
            ov.dirty = true;
          }
        }
      } else if (rec.tintFn) {
        untint(el, rec);
        ov.dirty = true;
      } else rec.tintError = null;
    } else if (el.tagName === 'VSG-NODE') {
      // props: wrap the node's own buildNode
      let props = null;
      for (const r of rules) if (r.props) props = Object.assign(props || {}, r.props);
      if (props) {
        if (JSON.stringify(rec.props) !== JSON.stringify(props)) ov.dirty = true;
        rec.props = props;
        if (!rec.propFn || el.buildNode !== rec.propFn) {
          if (typeof el.buildNode !== 'function') return;
          rec.origBuild = el.buildNode;   // React may have set a new one
          const orig = rec.origBuild;
          rec.propFn = function (ctx, e) {
            const res = orig.call(this, ctx, e);
            if (res && res[1] && res[1].properties) res[1].properties = Object.assign({}, res[1].properties, rec.props);
            return res;
          };
          el.buildNode = rec.propFn;
          ov.dirty = true;
        }
      }
    }
  }

  function untint(el, rec) {
    if (el.buildNode === rec.tintFn) {
      if (rec.hadBuild) el.buildNode = rec.origBuild; else delete el.buildNode;
    }
    rec.tintFn = null;
  }

  function restoreEl(el, rec) {
    if (rec.mo) rec.mo.disconnect();
    ov.recs.delete(el);
    if (!el.isConnected) return;
    ov.dirty = true;
    if (rec.tWritten !== null && el.getAttribute('translation') === rec.tWritten && rec.tBase !== null) el.setAttribute('translation', rec.tBase);
    if (rec.rWritten !== null && el.getAttribute('rotation') === rec.rWritten && rec.rBase !== null) el.setAttribute('rotation', rec.rBase);
    if (rec.tintFn) untint(el, rec);
    if (rec.propFn && el.buildNode === rec.propFn) el.buildNode = rec.origBuild;
  }

  function restoreAll() {
    for (const [el, rec] of [...ov.recs]) restoreEl(el, rec);
  }

  // Replace the rule set. Rules with motion animate in (0 -> 1) and out.
  function ovSet(rules, instant) {
    const now = Date.now();
    const next = [];
    const ids = new Set();
    for (const r of rules) {
      const n = normRule(r);
      if (!n || ids.has(n.id)) continue;
      ids.add(n.id);
      next.push(n);
    }
    for (const old of ov.rules) {
      if (ids.has(old.id)) continue;
      const c = ov.chans.get(old.id);
      if (!instant && old.motion && c && !st.reduce) { chanSet(c, 0, old.motion, now); ov.removing.set(old.id, old); }
      else ov.chans.delete(old.id);
    }
    for (const n of next) {
      ov.removing.delete(n.id);
      if (n.motion && !instant && !st.reduce) {
        let c = ov.chans.get(n.id);
        if (!c) { c = chan(0); ov.chans.set(n.id, c); }
        chanSet(c, 1, n.motion, now);
      } else ov.chans.delete(n.id);
    }
    ov.rules = next;
    if (instant) { ov.removing.clear(); }
    if (anyMoving(now)) startAnim(); else schedulePush();
  }

  // Rules that finished animating out leave (afterSettle).
  function ovCleanup() {
    let any = false;
    for (const [id] of ov.removing) {
      const c = ov.chans.get(id);
      if (!c || !c.moving) { ov.removing.delete(id); ov.chans.delete(id); any = true; }
    }
    // a window channel back at rest: its rule leaves allRules(); restore now
    if (!win.dimC.moving && win.dimC.target === 1 && [...ov.recs.values()].some((r) => r.tintFn)) any = true;
    if (!win.recC.moving && win.recC.target === 0 && [...ov.recs.values()].some((r) => r.tWritten !== null)) any = true;
    return any;
  }

  function overrides(set) {
    if (st.destroyed) return { error: 'destroyed' };
    contact();
    ov.suspended = false;
    set = set || {};
    ov.seq = set.seq !== undefined ? set.seq : null;
    ovSet(Array.isArray(set.rules) ? set.rules : [], !!set.instant);
    applyOverrides(Date.now());
    return { applied: ov.applied, missing: ov.missing, errors: ov.errors.slice() };
  }

  // ------------------------------------------------------------ window (t1)
  // {dim, recede, motion}: dim tints the identity transform above t1
  // ('window-scale'), recede moves t1 away (z - recede). Each is a value
  // channel read by a dynamic internal rule while it differs from rest.
  let winReq = null;
  const win = { dimC: chan(1), recC: chan(0) };
  const WIN_DIM = { id: 'window-dim', target: 'window-scale', internal: true, dyn: (now) => ({ tint: clamp(chanAt(win.dimC, now)[0], 0, 1) }) };
  const WIN_REC = { id: 'window-recede', target: 'window', internal: true, dyn: (now) => ({ add: [0, 0, -chanAt(win.recC, now)[0]] }) };
  function winRules() {
    const out = [];
    if (win.dimC.moving || win.dimC.target !== 1) out.push(WIN_DIM);
    if (win.recC.moving || win.recC.target !== 0) out.push(WIN_REC);
    return out;
  }
  function setWindow(w) {
    if (!w || typeof w !== 'object') return windowStatus();
    winReq = Object.assign({}, w);
    const now = Date.now();
    const motion = typeof w.motion === 'string' && w.motion ? w.motion : null;
    const dim = Number.isFinite(Number(w.dim)) ? clamp(Number(w.dim), 0, 1) : 1;
    const recede = Number.isFinite(Number(w.recede)) ? Number(w.recede) : 0;
    const off = st.reduce || st.depthToken === 'none';
    let changed = false;
    if (dim !== win.dimC.target) { chanSet(win.dimC, dim, off ? null : (motion || (dim < chanAt(win.dimC, now)[0] ? 'sheet-in' : 'sheet-out')), now); changed = true; }
    if (recede !== win.recC.target) { chanSet(win.recC, recede, off ? null : (motion || (recede > chanAt(win.recC, now)[0] ? 'sheet-in' : 'sheet-out')), now); changed = true; }
    // nothing to push when the window is already where it was asked to be
    // (every update() passes through here: no pushes at rest)
    // (a jump back to rest leaves allRules(); the push's applyOverrides()
    // then restores the transform)
    if (changed) { if (anyMoving(now)) startAnim(); else schedulePush(); }
    return windowStatus();
  }
  function windowStatus() {
    let error = null;
    for (const [el, rec] of ov.recs) if (rec.tintError) error = rec.tintError + ' (sgid ' + (el.getAttribute('sgid') || '?') + ')';
    const now = Date.now();
    return { dim: r6(chanAt(win.dimC, now)[0]), dimTarget: win.dimC.target, recede: r6(chanAt(win.recC, now)[0]), recedeTarget: win.recC.target, error };
  }
  function windowState(w) {
    if (st.destroyed) return { error: 'destroyed' };
    contact();
    return setWindow(w);
  }

  // ------------------------------------------------------------ lab hooks
  let yawTimer = 0;
  const test = {
    // Turn Steam's window (t1, and every panel reparented to it) about its
    // own vertical axis, for off-axis headset-view checks. yaw(0) restores;
    // restored by itself after ttlMs (default 20 s) and by the watchdog.
    yaw(deg, ttlMs) {
      if (st.destroyed) return { error: 'destroyed' };
      contact();
      clearTimeout(yawTimer);
      const d = Number(deg) || 0;
      if (!d) ov.internal.delete('test-yaw');
      else {
        ov.internal.set('test-yaw', normRule({ id: 'test-yaw', target: 'window', yawDeg: clamp(d, -60, 60), internal: true }));
        yawTimer = setTimeout(() => { ov.internal.delete('test-yaw'); schedulePush(); }, clamp(num(ttlMs, 20000), 1000, 120000));
      }
      pushNow();
      return { yaw: d, applied: ov.applied, missing: ov.missing };
    },
  };

  // ------------------------------------------------------------ inspection
  function sgidCheck() {
    let dom = 0;
    if (st.root) for (const e of st.root.querySelectorAll('[sgid]')) { if (st.sg.live.has(Number(e.getAttribute('sgid')))) dom++; }
    return { created: st.sg.created, retired: st.sg.retired, live: st.sg.live.size, dom, noRetire: st.sg.noRetire, retireQueued: st.retireQ.length };
  }

  function status() {
    const counts = {};
    for (const it of st.items.values()) counts[it.d.kind] = (counts[it.d.kind] || 0) + 1;
    const surfaces = [...new Set([...st.items.values()].map((it) => it.d.parentKey))];
    return {
      version: VERSION, global: GLOBAL, caps: CAPS,
      sharedReparent: SHARED_REPARENT, maxPushHz: MAX_PUSH_HZ, animHz: ANIM_HZ,
      motion: motionLib ? 'motion.js' : 'builtin',
      scheduler: { module: sched.module, push: !!sched.push, retire: !!sched.retire, error: sched.error },
      attached: isAttached(),
      M: st.M, MSource: st.MSource,
      parents: st.parents, relayouts: st.relayouts, panelBuilds: st.panelBuilds || 0, frameRelayouts: st.frameRelayouts || 0, surfaces,
      items: st.items.size, panels: counts, surf: surfSummary(),
      nodes: st.root ? st.root.querySelectorAll('*').length : 0,
      pushes: st.pushes,
      pushesLastSec: st.pushTimes.filter((t) => Date.now() - t <= 1000).length,
      lastPushMsAgo: st.lastPush ? Date.now() - st.lastPush : null,
      retireQueued: st.retireQ.length,
      updates: st.updates, specSeq: st.specSeq,
      lastContactMsAgo: Date.now() - st.lastContact,
      watchdogMs: WATCHDOG_MS, expired: st.expired, expiries: st.expiries, rebuilds: st.rebuilds, reattaches: st.reattaches,
      profile: st.profile, reduceMotion: st.reduce, depthMotion: st.depthToken,
      anim: { active: animCount(), frames: st.anim.frames, finals: st.anim.finals, pops: st.pops.size, dims: st.dims.size },
      overrides: { seq: ov.seq, rules: ov.rules.map((r) => r.id), internal: [...ov.internal.keys()], applied: ov.applied, missing: ov.missing, suspended: ov.suspended, elements: ov.recs.size, errors: ov.errors.slice() },
      window: windowStatus(),
      steamPage: (() => { const sp = steamPage(); return sp ? { mountable: sp.mountable, active: sp.active, t1: !!t1Node() } : null; })(),
      sgids: sgidCheck(),
      tick: { n: st.tickCost.n, lastMs: r6(st.tickCost.lastMs), avgMs: r6(st.tickCost.avgMs), maxMs: r6(st.tickCost.maxMs) },
      errors: st.errors.slice(),
    };
  }

  function dump() {
    const now = Date.now();
    return [...st.items.entries()].map(([k, it]) => ({
      k, kind: it.d.kind, parent: it.d.parentKey, anchor: [r6(it.d.u), r6(it.d.v)],
      z: r6(it.d.popKey ? num(it.zNow, it.d.z) : it.d.z), zTarget: r6(it.d.z),
      moving: it.d.popKey ? !!(st.pops.get(it.d.popKey) && !chanSettled(st.pops.get(it.d.popKey).c, now)) : false,
      ghost: !!it.d.ghost,
      key: it.d.key, uv: it.d.uv.map(r6), mpp: it.d.mpp, flags: it.d.flags, interactive: !!it.d.interactive, curv: it.d.curvOrigin || null,
      dimmed: !!it.wrap && !!it.d.dimKey, wrap: it.wrap ? it.wrap.__lgsProps : null,
      px: it.d.px, sizeM: it.d.px ? [r6(it.d.px[0] * it.d.ms), r6(it.d.px[1] * it.d.ms)] : null,
      sgids: [it.top ? it.top.__lgsSgid : null, it.anchor.__lgsSgid, it.xf.__lgsSgid, it.wrap ? it.wrap.__lgsSgid : null, it.panel.__lgsSgid],
      connected: it.anchor.isConnected, pushedAt: it.pushedAt,
    }));
  }

  function timeline(clr) {
    const out = st.timeline.slice();
    if (clr) st.timeline.length = 0;
    return out;
  }

  // Always uninstalls, even if clear() throws (R1 m5).
  function destroy() {
    try {
      clear();
    } finally {
      // nothing of ours may stay on screen: if clear() failed half way, drop
      // the root and push once (best effort)
      try {
        if (st.root && st.root.parentNode) {
          st.root.remove();
          if (sched.push) sched.push();
        }
      } catch (_) { /* best effort */ }
      st.destroyed = true;
      clearInterval(st.tick);
      if (st.frameReq) { try { cancelAnimationFrame(st.frameReq); } catch (_) { /* gone */ } st.frameReq = 0; }
      try { vrCoverDrop(); } catch (_) { /* gone */ }
      try { if (st.panelWatch) st.panelWatch.disconnect(); } catch (_) { /* gone */ }
      clearTimeout(yawTimer);
      if (st.pushTimer) { clearTimeout(st.pushTimer); st.pushTimer = 0; }
      if (st.anim.timer) { clearTimeout(st.anim.timer); st.anim.timer = 0; }
      if (W[GLOBAL] === api) delete W[GLOBAL];
    }
    return true;
  }

  // Panel watch: Steam inserts a pooled popup's panel (PooledPopup-<key>) when the popup opens and removes
  // it when it closes. For a surface the spec holds in standby, our cover and base nodes are built in the
  // mutation callback itself, before Steam's scheduler runs, and pushed at once: they join the same scene-
  // graph update as Steam's own panel, so the popup never shows without its glass for a round trip. A
  // panel whose crop is not readable yet is caught on the next frame, then by the 0.5 s relayout check.
  function standbyKeys() {
    const ks = new Set();
    const sp = st.lastSpec;
    for (const x of (sp && Array.isArray(sp.surfaces)) ? sp.surfaces : []) if (x && x.standby === true && x.steamKey) ks.add(String(x.steamKey));
    return ks;
  }
  function panelAdded(recs) {
    if (st.destroyed || st.expired || !st.lastSpec) return false;
    const ks = standbyKeys();
    if (!ks.size) return false;
    for (const r of recs) {
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        const els = (n.id && n.id.startsWith('PooledPopup-')) ? [n] : [...n.querySelectorAll('[id^="PooledPopup-"]')];
        for (const e of els) if (ks.has(e.id.slice('PooledPopup-'.length))) return true;
      }
    }
    return false;
  }
  function relayoutNow(why) {
    try {
      build(st.lastSpec);
      if (st.pushTimer) { clearTimeout(st.pushTimer); st.pushTimer = 0; }
      pushNow();
      st.panelBuilds = (st.panelBuilds || 0) + 1;
    } catch (e) { note('panel ' + why + ': ' + e.message); }
  }
  try {
    st.panelWatch = new MutationObserver((recs) => {
      if (!panelAdded(recs)) return;
      relayoutNow('insert');
      requestAnimationFrame(() => { if (!st.destroyed && parentSig(st.lastSpec) !== st.parentSig) relayoutNow('frame'); });
    });
    st.panelWatch.observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (e) { note('panel watch: ' + e.message); }

  // Frame watch of the parents' crops. Steam re-crops a popup's panel to its content every frame while
  // that content animates (the tab bar opening: uv_min x 0.75 -> 0.07 over the motion). Read only every
  // 0.5 s, the base pieces stayed where the old crop ended and the rest of the opening bar hid behind
  // its opaque cover ("half cut off"). Read every frame here; a change relays out and pushes at once.
  function frameWatch() {
    st.frameReq = 0;
    if (st.destroyed) return;
    try {
      const sp = st.lastSpec;
      if (sp && !st.expired && st.items.size && Array.isArray(sp.surfaces) && sp.surfaces.length && parentSig(sp) !== st.parentSig) {
        st.relayouts++;
        st.frameRelayouts = (st.frameRelayouts || 0) + 1;
        build(sp);
        if (st.pushTimer) { clearTimeout(st.pushTimer); st.pushTimer = 0; }
        pushNow();
      }
    } catch (e) { note('frame relayout: ' + e.message); }
    st.frameReq = requestAnimationFrame(frameWatch);
  }
  st.frameReq = requestAnimationFrame(frameWatch);

  // Housekeeping: re-attach after React re-renders, re-layout when Steam
  // re-crops a parent, re-find override targets, heartbeat watchdog.
  // Its cost at idle is measured in status().tick (R1 m6: the relayout check
  // reads each parent panel's buildNode; a popup re-crop must be followed
  // within 0.5 s, and nothing on the panel can be observed instead).
  st.tickCost = { n: 0, lastMs: 0, avgMs: 0, maxMs: 0 };
  st.tick = setInterval(() => {
    if (st.destroyed) return;
    const t0 = performance.now();
    try { tick(); } finally {
      const dt = performance.now() - t0;
      const c = st.tickCost;
      c.n++;
      c.lastMs = dt;
      c.avgMs = c.n === 1 ? dt : c.avgMs + (dt - c.avgMs) / Math.min(c.n, 120);
      if (dt > c.maxMs) c.maxMs = dt;
    }
  }, 500);
  function tick() {
    if (st.items.size) ensureAttached();
    if (st.lastSpec && !st.expired && Array.isArray(st.lastSpec.surfaces) && st.lastSpec.surfaces.length) {
      try {
        if (parentSig(st.lastSpec) !== st.parentSig) { st.relayouts++; build(st.lastSpec); }
      } catch (e) { note('relayout: ' + e.message); }
    }
    // sinking pops past their limit (no animation frame came)
    if (!st.anim.timer && [...st.pops.values()].some((p) => p.sinking)) afterSettle();
    // overrides: a target React re-created gets the override again
    if (!ov.suspended && !st.anim.timer && (allRules().length || ov.recs.size)) {
      try {
        ov.dirty = false;
        applyOverrides(Date.now());
        if (ov.dirty) pushNow();
      } catch (e) { note('ov tick: ' + e.message); }
    }
    const idle = Date.now() - st.lastContact > WATCHDOG_MS;
    if (WATCHDOG_MS > 0 && !st.expired && idle && (st.items.size || ov.recs.size || st.pops.size || allRules().length)) {
      note('no heartbeat for ' + WATCHDOG_MS + ' ms: cleared and restored (spec and rules kept)');
      clearNodes();
      ov.suspended = true;
      restoreAll();
      st.expired = true;
      st.expiries++;
      pushNow();
    }
  }

  const api = {
    version: VERSION, caps: CAPS, update, ping, overrides, windowState, clear, status, dump, destroy,
    geom: () => Object.assign({}, geom()), timeline, spec: () => st.lastSpec, guillotine, mosaic, test,
    _spring: spring, _token: tokenDB, _retargets: () => retargets.slice(),
  };
  W[GLOBAL] = api;
  return JSON.stringify(status());
});
