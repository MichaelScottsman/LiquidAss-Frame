// Liquid Glass Shell: layer reporter for the native glass compositor.
//
// The daemon (device/lgs_shell.py) evaluates this inside Steam's
// SharedJSContext. If window.__LGS_LAYERS_OPTS = {layers, binding, ackMode} is
// set beforehand, it reads (and deletes) it and starts itself with those
// rules. Tokens resolve through window.__LGS_INDEX (built by lgs_core.js while
// the theme is on) or through lgsBuildIndex when device/lgs_index.js is
// prepended; without either it waits for the theme. It installs
// window.__LGS_LAYERS:
//
//   start(rules, opts)  rules = theme/layers.json (object or JSON text),
//                  opts.binding = binding name (default "lgsLayers"),
//                  opts.ackMode = tag elements only once acknowledged (ack()),
//                  opts.pingTtlMs = self-stop after this long without ping()
//                  once pinged (default 12000), opts.attrPrefix = attribute
//                  names (tests; default "data-lgs"). Starts, or restarts
//                  with new rules. Returns status().
//   stop(o)        stops, removes every data-lgs-* attribute it set, emits a
//                  last report with every surface invisible ("stopped": true)
//                  and deletes window.__LGS_LAYERS, so a daemon that checks
//                  for it re-injects. o.silent: no last report.
//   ping()         the daemon's heartbeat (call it every second or so):
//                  {running, version, seq, paused, dash}. After the first ping
//                  the reporter stops itself when pings stop for pingTtlMs.
//   ack(map)       the daemon's acknowledgement {overlayKey: [popped layer
//                  ids]}, one key per surface that is in the scene-graph spec
//                  (with [] when nothing of it pops). null leaves ack mode.
//                  Returns how many elements carry data-lgs-pop.
//   resend()       measures now and emits the report even if unchanged.
//   snapshot()     the current report as an object, computed fresh. Emits
//                  nothing and changes nothing.
//   status()       counters, timing, wake sources, dashboard state, rule errors.
//   debug(name)    per-rule candidates of one surface (or all) and why each
//                  was kept or dropped.
//   overlay(ms)    debug only: outlines the cover and every layer in each
//                  window for ms milliseconds (default 8000), then removes it.
//   forceDash(v)   tests only: pretend SteamVR's dashboard is shown (true) or
//                  hidden (false); null goes back to asking SteamVR.
//
// Reports go to window.lgsLayers(json), the CDP binding the daemon adds with
// Runtime.addBinding, only when something changed. Format: docs/NATIVE.md,
// "Steam -> daemon: layer report", plus "dash" (SteamVR's dashboard
// visibility) and, while theme/layers.json has problems, "errors". Each
// surface also carries:
//   "material"  the material of the surface's own glass (the cover)
//   "shapes"    [{x, y, w, h, r}] in texture px: the rounded regions the cover
//               fills. Main's is the whole window; the bar's are its segments,
//               a popup's its card(s), the footer's its capsule. [] when the
//               surface is not visible.
// Layer ids name slots, not elements: a rule's first element is reported as
// the rule id, later ones as "<id>.1", "<id>.2"; an id moves with the rule's
// match (the focused card). A layer's w/h only change once its element is
// settled (no geometric transition or animation on it or an ancestor), so
// glassd re-packs slabs once per change, not per animation frame; meanwhile
// its x/y follow with the last settled size. A surface is "visible" while its
// window shows and its cover element is on screen. While SteamVR hides the
// dashboard nothing is measured and the last layout stays reported as it was
// (glassd and SteamVR handle the hidden dashboard). Hidden pooled popups
// (keyPrefix surfaces) are left out of the report.
//
// Attributes: a visible surface's cover element(s) carry data-lgs-cover and
// every popped element data-lgs-pop ("self", "before" or "after", the part
// that pops); theme/05-native.css drops the CSS glass glassd replaces. In ack
// mode (opts.ackMode, or after the first ack()) an attribute is set only
// while the daemon acknowledges it as shown, and removed as soon as it no
// longer does: a layer while its id is in its window's ack list, a cover
// while its overlay key is in the ack map. Because ids name slots, an ack
// applies to an element only once it has held its id for ACK_DELAY_MS (a
// scene-graph round trip). Without ack mode they follow the report at once.
//
// Cost: nothing runs per frame while the UI is still. Mutations, transitions
// and animations that move things wake a sampling loop capped at ~30 Hz that
// runs while they last plus TAIL_MS. Element lists, styles and hit tests are
// cached between samples. A scroll only flattens the layers that move with
// that scroller (they are left out until it has been still for
// SCROLL_SETTLE_MS, so their crops never lag behind the live texture), and
// mutations inside a scrolling scroller wait for it to settle. A 2 s safety
// resample re-measures (every 10 s it also re-queries and re-hit-tests).
// While the theme is off it pauses. It stops itself when the daemon's pings
// stop; without pings (an older daemon), when the daemon's lgs-native
// heartbeat goes stale or the theme stays off for 30 s.
(function lgsLayersInstall() {
  'use strict';
  const W = window;
  const VERSION = 2;
  // The daemon's options are for this evaluation only: a later evaluation of
  // the bare file must not start with a binding nobody listens to.
  const OPTS = W.__LGS_LAYERS_OPTS;
  try { delete W.__LGS_LAYERS_OPTS; } catch (_) { W.__LGS_LAYERS_OPTS = undefined; }
  if (W.__LGS_LAYERS && typeof W.__LGS_LAYERS.stop === 'function') {
    try { W.__LGS_LAYERS.stop({ silent: true, keepGlobal: true }); } catch (_) { /* stale instance */ }
  }

  const ATTR_PREFIX = 'data-lgs';
  const DEFAULT_FOCUS = '.gpfocus, .gpfocuswithin';
  const MATERIALS = ['window', 'panel', 'liquid', 'thick'];
  const POLL_MS = 500;          // dashboard state, window list, liveness, stalled-frame watchdog
  const RESAMPLE_EVERY = 4;     // safety re-measure every N polls (2 s)
  const DEEP_EVERY = 5;         // every Nth resample also re-queries and re-hit-tests (10 s)
  const MIN_TICK_MS = 33;       // sampling cap (~30 Hz; sg pushes <= 30/s anyway)
  const TAIL_MS = 80;           // keep sampling this long after a sample changed something
  const SCROLL_SETTLE_MS = 150; // a scroller is still after this long without a scroll event
  const ANIM_MAX_MS = 1500;     // a running transition/animation counts at most this long
  const COVER_FOLLOW_MS = 150;  // an animating cover's shape is updated at most this often
  const ACK_DELAY_MS = 350;     // an element must hold its id this long before an ack applies to it (scene-graph latency)
  const COVER_FALLBACK_MS = 3000; // ack mode, key never acked but window lgs-native: tag the cover
  const PING_TTL_MS = 12000;    // no ping for this long (once pinged): stop
  const NATIVE_STALE_MS = 15000; // no lgs-native heartbeat for this long (never pinged): stop
  const THEME_OFF_POLLS = 60;   // never pinged: stop after the theme has been off this long (30 s)
  const MIN_PX = 4;            // texture px; smaller layers are dropped
  const MAX_LAYERS = 23;        // hard cap per surface
  // Hover alone never moves a layer; hover effects that do move one animate,
  // and those fire transition/animation events.
  const DOC_EVENTS = ['scroll', 'transitionrun', 'transitionend', 'transitioncancel',
    'animationstart', 'animationend', 'animationcancel', 'visibilitychange', 'focusin', 'focusout'];
  // Properties whose change never moves or resizes a box (camelCase is
  // converted first). Everything else (transform, scale, width, opacity,
  // border-radius, ...) counts as geometric.
  const PAINT_RE = /^(--|background|color$|(border|outline|column-rule|text-decoration|text-emphasis)(-[a-z]+)*-color$|outline|box-shadow|text-shadow|caret-color|accent-color|fill|stroke|filter$|(-?webkit-)?backdrop-filter$|-?webkit-text-(fill|stroke)-color|mask|-?webkit-mask|clip-path|stop-color|flood-color|lighting-color)/;
  const KF_META = new Set(['offset', 'easing', 'composite', 'computedOffset']);
  const NAV_HINTS = ['84114']; // webpack module with IsInGamepadNav in the current Steam build

  let S = null;               // running state; null while stopped
  let API = null;

  // ------------------------------------------------------------ rules

  function getIndex() {
    if (W.__LGS_INDEX && W.__LGS_INDEX.selector) return W.__LGS_INDEX;
    if (typeof lgsBuildIndex !== 'function') return null;
    return (W.__LGS_INDEX = lgsBuildIndex()); // eslint-disable-line no-undef
  }

  function resolveSel(sel, index, errs, where) {
    if (typeof sel !== 'string' || !sel.trim()) { errs.push(where + ': empty selector'); return null; }
    let bad = false;
    const out = sel.replace(/%\{([^}]+)\}/g, (_, tok) => {
      const r = index.selector(tok);
      if (r.sel) return r.sel;
      errs.push(where + ': %{' + tok.trim() + '} ' + r.err);
      bad = true;
      return '.lgs-' + r.err;
    });
    if (bad) return null;
    try { document.createDocumentFragment().querySelector(out); } catch (_) {
      errs.push(where + ': invalid selector ' + out.slice(0, 120));
      return null;
    }
    return out;
  }

  function pseudoOf(p) {
    if (!p) return null;
    const s = String(p).replace(/^:+/, '');
    return s === 'before' || s === 'after' ? '::' + s : null;
  }

  // inset [top, right, bottom, left] (CSS px, positive shrinks) minus outset
  function insetOf(inset, outset) {
    let a = [0, 0, 0, 0];
    if (Array.isArray(inset)) a = [0, 1, 2, 3].map((i) => +inset[i] || 0);
    else if (typeof inset === 'number') a = [inset, inset, inset, inset];
    const o = +outset || 0;
    a = a.map((v) => v - o);
    return a.some((v) => v !== 0) ? a : null;
  }

  function material(m, fallback) { return MATERIALS.includes(m) ? m : fallback; }

  function compile(cfg) {
    if (typeof cfg === 'string') cfg = JSON.parse(cfg);
    if (!cfg || typeof cfg !== 'object' || !cfg.surfaces) throw new Error('lgs_layers: rules need a "surfaces" object');
    const index = getIndex();
    if (!index) return null; // no token index yet (theme off): caller waits
    const errs = [];
    const defaults = cfg.defaults || {};
    const out = [];
    for (const name of Object.keys(cfg.surfaces)) {
      const sc = cfg.surfaces[name];
      if (!sc || sc.enabled === false) continue;
      const s = {
        name,
        key: sc.key || null,
        keyPrefix: sc.keyPrefix || null,
        material: material(sc.material, 'window'),
        frameKey: sc.frameKey || null,
        laserOnly: !!sc.laserOnly,
        docVisibility: sc.docVisibility !== false,
        maxLayers: Math.max(0, Math.min(+sc.maxLayers || +defaults.maxLayers || 20, MAX_LAYERS)),
        cover: null,
        rules: [],
      };
      if (!s.key && !s.keyPrefix) { errs.push(name + ': needs "key" or "keyPrefix"'); continue; }
      const c = sc.cover || {};
      const csel = resolveSel(c.sel, index, errs, name + '.cover');
      if (!csel) { errs.push(name + ': no usable cover, surface skipped'); continue; }
      s.cover = { sel: csel, pseudo: pseudoOf(c.pseudo), r: c.r, inset: insetOf(c.inset, c.outset), all: !!c.all };
      (sc.layers || []).forEach((rc, i) => {
        const id = String(rc.id || 'layer' + i);
        const where = name + '.' + id;
        const sel = resolveSel(rc.sel, index, errs, where);
        if (!sel) return;
        let focus = null;
        if (rc.focus !== 'always') {
          focus = rc.focus ? resolveSel(rc.focus, index, errs, where + '.focus') : DEFAULT_FOCUS;
          if (!focus) return;
        }
        const dz = +rc.dz || 0;
        const lift = +rc.lift || 0;
        if (!(dz > 0) && !(lift > 0)) { errs.push(where + ': needs dz or lift > 0'); return; }
        s.rules.push({
          id, sel, focus, dz, lift,
          pseudo: pseudoOf(rc.pseudo),
          part: pseudoOf(rc.pseudo) ? pseudoOf(rc.pseudo).slice(2) : 'self',
          r: rc.r,
          inset: insetOf(rc.inset, rc.outset),
          material: material(rc.material, material(defaults.material, 'liquid')),
          max: Math.max(1, Math.floor(+rc.max || 1)),
          hitTest: rc.hitTest !== false,
          clip: rc.clip !== false,
        });
      });
      out.push(s);
    }
    return { surfaces: out, errors: errs };
  }

  // ------------------------------------------------------------ Steam state

  let reqCache = null;
  function webpackReq() {
    if (reqCache) return reqCache;
    try { W.webpackChunksteamui.push([[Symbol('lgs-layers')], {}, (r) => { reqCache = r; }]); } catch (_) { /* no bundle */ }
    return reqCache;
  }

  // The controller-vs-laser mode Steam tracks for SteamVR overlay focus
  // (IsInGamepadNav), located by source text so module ids may move. Only a
  // laserOnly surface asks for it. The known id is tried first; otherwise the
  // search reads every module's source, in slices between frames (one huge
  // module still costs ~45 ms once). The id is kept on window for later
  // injections.
  function navExport(mod) {
    for (const k of Object.keys(mod || {})) {
      try {
        const C = mod[k];
        if (C && C.Instance && 'IsInGamepadNav' in C.Instance) return C;
      } catch (_) { /* getter threw */ }
    }
    return null;
  }

  function navClass() {
    const n = S.nav;
    if (n.C) return n.C;
    if (n.state !== 'idle') return null;
    const req = webpackReq();
    if (!req) { n.state = 'no webpack'; return null; }
    // the id an earlier injection found is loaded already: use it as is
    const cached = W.__LGS_LAYERS_NAVMOD;
    if (cached != null && req.m[cached]) {
      try { n.C = navExport(req(cached)); } catch (_) { /* moved */ }
      if (n.C) { n.state = 'found'; n.id = cached; return n.C; }
    }
    // Otherwise read module sources, the current build's id first, between
    // frames and never inside a sample. One module's source can take ~45 ms
    // to read the first time, so this happens once per Steam session.
    n.state = 'searching';
    const hints = NAV_HINTS.filter((id) => req.m[id]);
    n.ids = hints.concat(Object.keys(req.m).filter((id) => !hints.includes(id)));
    n.i = 0;
    navLater();
    return null;
  }

  function navLater() {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(navStep, { timeout: 1000 });
    else setTimeout(navStep, 16);
  }

  function navStep() {
    if (!S || S.nav.state !== 'searching') return;
    const n = S.nav;
    const req = webpackReq();
    const a = performance.now();
    while (n.i < n.ids.length && performance.now() - a < 3) {
      const id = n.ids[n.i++];
      let src;
      try { src = req.m[id].toString(); } catch (_) { continue; }
      if (src.indexOf('get IsInGamepadNav') < 0) continue;
      let C = null;
      try { C = navExport(req(id)); } catch (_) { /* not loadable */ }
      if (!C) continue;
      n.C = C;
      n.id = id;
      n.state = 'found';
      W.__LGS_LAYERS_NAVMOD = id;
      n.ms += performance.now() - a;
      for (const e of S.ents.values()) if (e.s.laserOnly) e.force = true;
      schedule(0);
      return;
    }
    n.ms += performance.now() - a;
    if (n.i >= n.ids.length) { n.state = 'not found'; n.ids = null; return; }
    navLater();
  }

  // true = controller nav, false = laser, null = unknown (or still searching)
  function gamepadNav() {
    const C = navClass();
    if (!C) return null;
    try { return C.Instance ? !!C.Instance.IsInGamepadNav : null; } catch (_) { return null; }
  }

  // Is the dashboard frame that shows this overlay visible? (A dashboard tab
  // for another app hides Steam's window.) Unknown layouts don't block.
  function frameVisible(key) {
    try {
      const frames = SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.VRFrameStore.frames;
      let found = false;
      for (const f of frames) {
        const keys = Object.values(f.steamUIVROverlayKeysInPages || {});
        if (!keys.includes(key)) continue;
        found = true;
        if (f.isVisible) return true;
      }
      return !found;
    } catch (_) { return true; }
  }

  function refreshDash() {
    if (S.dashForced !== null) { setDash(S.dashForced); return; }
    let api = null;
    try { api = SteamClient.OpenVR.VROverlay; } catch (_) { /* not in VR */ }
    if (!api || typeof api.IsDashboardVisible !== 'function') { setDash(true); return; }
    if (S.dashPending) return;
    S.dashPending = true;
    const me = S;
    Promise.resolve().then(() => api.IsDashboardVisible()).then((v) => {
      me.dashPending = false;
      if (S === me) setDash(v !== false);
    }, () => { me.dashPending = false; });
  }

  // Hidden: measure nothing and keep reporting the last layout (and keep the
  // attributes), so opening the dashboard shows the glass that was there.
  function setDash(v) {
    if (S.dash === v) return;
    S.dash = v;
    S.dashChanges++;
    if (v) {
      for (const e of S.ents.values()) e.force = true;
      schedule(0);
    } else {
      cancelFrame();
    }
    if (S.lastBody !== null) emit(false, true);
  }

  // ------------------------------------------------------------ windows

  function popupList() {
    const out = [];
    let map;
    try { map = g_PopupManager.m_mapPopups; } catch (_) { return out; }
    if (!map) return out;
    for (const p of map.values()) {
      let win = null;
      try {
        win = p.window;
        if (!win || win.closed || !win.document || !win.document.documentElement) continue;
      } catch (_) { continue; }
      let key = '';
      try { key = (p.params && p.params.strVROverlayKey) || ''; } catch (_) { /* no params */ }
      if (!key) key = keyFromName(p.m_strName || '');
      if (key) out.push({ win, key });
    }
    return out;
  }

  // Fallback when a popup has no params: "valve.steam.gamepadui.bar.70880000_uid0"
  // -> "valve.steam.gamepadui.bar", "...barpopup.70880001.70880001_uid0" ->
  // "...barpopup.70880001".
  function keyFromName(n) {
    if (/^VR_uid/.test(n)) return 'valve.steam.gamepadui.main';
    if (/^VRKeyboard_uid/.test(n)) return 'valve.steam.gamepadui.keyboard';
    if (/^VRNotificationToasts_uid/.test(n)) return 'valve.steam.gamepadui.notifications';
    return n.replace(/_uid\d+$/, '').replace(/\.\d+$/, '');
  }

  function surfaceFor(key) {
    for (const s of S.cfg.surfaces) {
      if (s.key && key === s.key) return { s, name: s.name };
      if (s.keyPrefix && key.startsWith(s.keyPrefix) && key.length > s.keyPrefix.length) {
        return { s, name: s.name + '.' + key.slice(s.keyPrefix.length) };
      }
    }
    return null;
  }

  function activeScrollers(ent, now) {
    const act = [];
    for (const [sc, t] of ent.scrolling) if (now - t < SCROLL_SETTLE_MS) act.push(sc);
    return act;
  }

  function isScrolling(ent, sc, now) {
    const t = ent.scrolling.get(sc);
    return t !== undefined && now - t < SCROLL_SETTLE_MS;
  }

  function isPaintProp(p) {
    if (!p || p === 'all') return false;
    const k = p.startsWith('--') ? p : p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    return PAINT_RE.test(k);
  }

  // Does this CSS animation move or resize anything? Read once per name from
  // its keyframes (an animation on ::before/::after is only listed with the
  // host's subtree).
  function animGeometric(T, name, pseudo) {
    if (!name) return true;
    const c = S.animGeo.get(name);
    if (c !== undefined) return c;
    let geo = null;
    try {
      for (const a of T.getAnimations(pseudo ? { subtree: true } : undefined)) {
        if (a.animationName !== name || !a.effect || typeof a.effect.getKeyframes !== 'function') continue;
        const props = new Set();
        for (const kf of a.effect.getKeyframes()) for (const k of Object.keys(kf)) if (!KF_META.has(k)) props.add(k);
        geo = [...props].some((p) => !isPaintProp(p));
        break;
      }
    } catch (_) { /* detached */ }
    if (geo === null) return true; // already gone: assume it moved something
    S.animGeo.set(name, geo);
    return geo;
  }

  function attach(s, name, key, win) {
    const doc = win.document;
    const ent = {
      s, name, key, win, doc,
      mo: null, listeners: [], handler: null,
      force: true, dirty: true, needLight: false, deferred: false,
      domGen: 0, hitGen: 0, animGen: 0, q: null, facts: new WeakMap(),
      csw: new WeakMap(), psw: new WeakMap(), hit: new WeakMap(), settled: new WeakMap(),
      scrolling: new Map(), anims: new Map(), panims: new Map(),
      tailUntil: 0, full: null, cur: null, sig: null, lastIds: null,
      attrPop: S.attrPrefix + '-pop', attrCover: S.attrPrefix + '-cover',
      applied: new Map(), hold: new Map(), keyAcked: false, nativeSince: 0,
      wakes: {}, computes: 0, computeMs: 0, lights: 0, changes: 0, queries: 0, hitTests: 0,
    };
    const bump = (t) => { ent.wakes[t] = (ent.wakes[t] || 0) + 1; };
    const wakeUp = () => { if (S && S.dash && !S.paused) schedule(0); };
    const handler = (ev) => {
      if (!S) return;
      const t = ev.type;
      const now = performance.now();
      if (t === 'scroll') {
        let sc = ev.target;
        if (!sc || sc.nodeType !== 1) sc = doc.scrollingElement || doc.documentElement;
        const was = isScrolling(ent, sc, now);
        ent.scrolling.set(sc, now);
        armSettle();
        if (!was) {
          bump('scroll');
          // flatten the layers that move with this scroller right away
          if (ent.cur && ent.cur.kept.some((k) => k.scrollers.includes(sc))) { ent.needLight = true; wakeUp(); }
        }
        return;
      }
      if (t === 'resize') { bump(t); ent.domGen++; ent.hitGen++; ent.dirty = true; wakeUp(); return; }
      if (t === 'visibilitychange') { bump(t); ent.dirty = true; refreshDash(); wakeUp(); return; }
      if (t === 'focusin' || t === 'focusout') {
        // focus following a scroll inside the scroller waits for the settle
        const T = ev.target;
        if (T && T.nodeType === 1 && ent.scrolling.size && activeScrollers(ent, now).some((sc) => sc.contains(T))) {
          ent.deferred = true;
          bump('focus-deferred');
          return;
        }
        bump('focus');
        ent.domGen++;
        ent.dirty = true;
        wakeUp();
        return;
      }
      // transitions and animations
      const T = ev.target;
      if (!T || T.nodeType !== 1) return;
      ent.animGen++; // cached style facts may be stale now
      const pseudo = ev.pseudoElement ? String(ev.pseudoElement).replace(/^:+/, '') : '';
      const geo = t.startsWith('transition') ? !isPaintProp(ev.propertyName) : animGeometric(T, ev.animationName, pseudo);
      if (!geo) { bump('paint-anim'); return; }
      const start = t === 'transitionrun' || t === 'animationstart';
      // a ::before/::after animation moves only that pseudo-element
      const map = pseudo ? ent.panims : ent.anims;
      const key = pseudo ? pseudoKey(T, pseudo) : T;
      const rec = map.get(key);
      // content moving inside a scrolling scroller (virtualized rows fading
      // in and out): the settle handles it
      if (!(rec && !start) && ent.scrolling.size && activeScrollers(ent, now).some((sc) => sc.contains(T))) {
        bump('scrolled-anim');
        return;
      }
      if (start) {
        const r = rec || { n: 0, until: 0, el: T, part: pseudo };
        r.n++;
        r.until = now + ANIM_MAX_MS;
        map.set(key, r);
      } else {
        if (rec && --rec.n <= 0) map.delete(key);
        // something outside the measured elements stopped moving (a side
        // menu slid in?): re-check what covers what
        if (!pseudo && !insideMeasured(ent, T)) ent.hitGen++;
      }
      bump(t);
      ent.dirty = true;
      wakeUp();
    };
    ent.handler = handler;
    try {
      ent.mo = new win.MutationObserver((records) => {
        if (!S) return;
        // mutations inside a scrolling scroller (virtualized rows) wait for it
        if (ent.scrolling.size) {
          const act = activeScrollers(ent, performance.now());
          if (act.length && records.every((r) => act.some((sc) => sc.contains(r.target)))) {
            ent.deferred = true;
            bump('mutation-deferred');
            return;
          }
        }
        bump('mutation');
        ent.domGen++;
        ent.dirty = true;
        wakeUp();
      });
      ent.mo.observe(doc.documentElement, {
        subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'],
      });
    } catch (_) { /* window closing */ }
    const add = (target, type) => {
      try {
        target.addEventListener(type, handler, { capture: true, passive: true });
        ent.listeners.push([target, type]);
      } catch (_) { /* window closing */ }
    };
    for (const t of DOC_EVENTS) add(doc, t);
    add(win, 'resize');
    return ent;
  }

  function detach(ent) {
    try { if (ent.mo) ent.mo.disconnect(); } catch (_) { /* gone */ }
    for (const [target, type] of ent.listeners) {
      try { target.removeEventListener(type, ent.handler, { capture: true }); } catch (_) { /* gone */ }
    }
    ent.listeners = [];
    applyAttrs(ent, new Map());
  }

  function syncWindows() {
    const seen = new Set();
    let changed = false;
    for (const { win, key } of popupList()) {
      const m = surfaceFor(key);
      if (!m) continue;
      seen.add(key);
      let ent = S.ents.get(key);
      let stale = false;
      try { stale = !!ent && (ent.win !== win || ent.doc !== win.document); } catch (_) { stale = true; }
      if (stale) { detach(ent); ent = null; }
      if (!ent) {
        ent = attach(m.s, m.name, key, win);
        S.ents.set(key, ent);
        changed = true;
      }
    }
    for (const [key, ent] of S.ents) {
      if (seen.has(key)) continue;
      detach(ent);
      S.ents.delete(key);
      changed = true;
    }
    if (changed) S.structureChanged = true;
  }

  // ------------------------------------------------------------ geometry

  // computed styles are live objects: cached per element across samples
  function cs(ent, el) {
    let v = ent.csw.get(el);
    if (!v) { v = ent.win.getComputedStyle(el); ent.csw.set(el, v); }
    return v;
  }

  function pcs(ent, el, pseudo) {
    let m = ent.psw.get(el);
    if (!m) ent.psw.set(el, m = {});
    return m[pseudo] || (m[pseudo] = ent.win.getComputedStyle(el, pseudo));
  }

  // does this style make the element a containing block for fixed (and so
  // also absolute) descendants?
  function fixedCB(s) {
    if (s.transform !== 'none' || s.perspective !== 'none' || s.filter !== 'none') return true;
    if ((s.scale && s.scale !== 'none') || (s.translate && s.translate !== 'none') || (s.rotate && s.rotate !== 'none')) return true;
    if (s.transformStyle === 'preserve-3d') return true;
    if (s.backdropFilter && s.backdropFilter !== 'none') return true;
    if (/transform|perspective|filter|scale|translate|rotate/.test(s.willChange)) return true;
    if (/paint|layout|strict|content/.test(s.contain)) return true;
    if (s.containerType && s.containerType !== 'normal') return true;
    return s.contentVisibility === 'auto';
  }

  // The style facts the walks need, read once per element and kept until
  // the DOM changes (domGen) or an animation starts or ends (animGen):
  // candidates share most of their ancestors.
  function facts(ent, el) {
    let f = ent.facts.get(el);
    if (f && f.dg === ent.domGen && f.ag === ent.animGen) return f;
    const s = cs(ent, el);
    const ovx = s.overflowX;
    const ovy = s.overflowY;
    const paint = /paint|strict|content/.test(s.contain);
    const fix = fixedCB(s);
    f = {
      dg: ent.domGen, ag: ent.animGen,
      position: s.position, opacity: parseFloat(s.opacity),
      cbFixed: fix, cbAbs: fix || s.position !== 'static',
      clipX: paint || ovx !== 'visible', clipY: paint || ovy !== 'visible',
      scroller: (ovx !== 'visible' && ovx !== 'clip') || (ovy !== 'visible' && ovy !== 'clip'),
    };
    ent.facts.set(el, f);
    return f;
  }

  // The box of an absolutely positioned ::before/::after, from its resolved
  // (used) offsets and size, in viewport CSS px.
  function pseudoBox(ctx, el, ps) {
    const pos = ps.position;
    if (pos !== 'absolute' && pos !== 'fixed') return null;
    let w = parseFloat(ps.width);
    let h = parseFloat(ps.height);
    if (!(w >= 0) || !(h >= 0)) return null;
    if (ps.boxSizing !== 'border-box') {
      w += (parseFloat(ps.paddingLeft) || 0) + (parseFloat(ps.paddingRight) || 0)
        + (parseFloat(ps.borderLeftWidth) || 0) + (parseFloat(ps.borderRightWidth) || 0);
      h += (parseFloat(ps.paddingTop) || 0) + (parseFloat(ps.paddingBottom) || 0)
        + (parseFloat(ps.borderTopWidth) || 0) + (parseFloat(ps.borderBottomWidth) || 0);
    }
    let cb = el;
    while (cb && cb.nodeType === 1) {
      const f = facts(ctx.ent, cb);
      if (pos === 'fixed' ? f.cbFixed : f.cbAbs) break;
      cb = cb.parentElement;
    }
    let ox = 0;
    let oy = 0;
    let cw = ctx.vw;
    let ch = ctx.vh;
    if (cb && cb.nodeType === 1) {
      const R = cb.getBoundingClientRect();
      ox = R.left + cb.clientLeft - cb.scrollLeft;
      oy = R.top + cb.clientTop - cb.scrollTop;
      cw = cb.clientWidth;
      ch = cb.clientHeight;
    }
    const ml = parseFloat(ps.marginLeft) || 0;
    const mt = parseFloat(ps.marginTop) || 0;
    let left = parseFloat(ps.left);
    let top = parseFloat(ps.top);
    if (isNaN(left)) {
      const right = parseFloat(ps.right);
      if (isNaN(right)) return null;
      left = cw - right - w - (parseFloat(ps.marginRight) || 0) - ml;
    }
    if (isNaN(top)) {
      const bottom = parseFloat(ps.bottom);
      if (isNaN(bottom)) return null;
      top = ch - bottom - h - (parseFloat(ps.marginBottom) || 0) - mt;
    }
    const l = ox + left + ml;
    const t = oy + top + mt;
    return { l, t, r: l + w, b: t + h };
  }

  // Walk the containing-block chain: clip by every overflow ancestor on it
  // (an absolute element escapes overflow:hidden below its containing block)
  // and collect them as the scrollers the box moves with.
  function clipChain(ctx, a, pos, c, clip, scrollers) {
    for (; a && a.nodeType === 1; a = a.parentElement) {
      const f = facts(ctx.ent, a);
      if (pos === 'absolute' && !f.cbAbs) continue;
      if (pos === 'fixed' && !f.cbFixed) continue;
      if (f.scroller) scrollers.push(a);
      if (clip && c && (f.clipX || f.clipY)) {
        const R = a.getBoundingClientRect();
        if (f.clipX) { c.l = Math.max(c.l, R.left); c.r = Math.min(c.r, R.right); }
        if (f.clipY) { c.t = Math.max(c.t, R.top); c.b = Math.min(c.b, R.bottom); }
        if (c.r - c.l < 1 || c.b - c.t < 1) c = null;
      }
      pos = f.position;
    }
    return c;
  }

  // Is the element hidden under something else (a modal scrim, a sheet)?
  // Hit-tests the centre of its visible box; landing on the element, inside
  // it or on one of its ancestors counts as visible. Cached per element until
  // its box moves or something may have started covering it (hitGen).
  function covered(ctx, el, c) {
    const ent = ctx.ent;
    const x = (c.l + c.r) / 2;
    const y = (c.t + c.b) / 2;
    const key = Math.round(x) + ',' + Math.round(y);
    const prev = ent.hit.get(el);
    if (prev && prev.key === key && prev.gen === ent.hitGen) return prev.covered;
    let hit = null;
    const a = performance.now();
    if (x >= 0 && y >= 0 && x < ctx.vw && y < ctx.vh) {
      try { hit = ctx.doc.elementFromPoint(x, y); } catch (_) { /* detached */ }
    }
    S.prof.hitMs += performance.now() - a;
    ent.hitTests++;
    const res = !!hit && !(hit === el || el.contains(hit) || hit.contains(el));
    ent.hit.set(el, { key, gen: ent.hitGen, covered: res });
    return res;
  }

  // Visible, clipped box of an element (or its pseudo-element) in CSS px,
  // with its corner radius and the scrollers it moves with; or {skip: reason}.
  function measure(ctx, el, spec, hitTest, clip) {
    if (!el.isConnected) return { skip: 'detached' };
    const ent = ctx.ent;
    const ecs = cs(ent, el);
    if (ecs.display === 'none') return { skip: 'display none' };
    if (ecs.visibility !== 'visible') return { skip: 'visibility ' + ecs.visibility };
    let box;
    let rad;
    let pos = ecs.position;
    let first = el.parentElement;
    if (spec.pseudo) {
      const ps = pcs(ent, el, spec.pseudo);
      if (!ps || ps.content === 'none' || ps.content === 'normal' || ps.display === 'none') return { skip: 'no ' + spec.pseudo };
      if (ps.visibility !== 'visible' || parseFloat(ps.opacity) < 0.05) return { skip: spec.pseudo + ' invisible' };
      box = pseudoBox(ctx, el, ps);
      if (!box) return { skip: spec.pseudo + ' not absolutely positioned' };
      rad = parseFloat(ps.borderTopLeftRadius) || 0;
      pos = ps.position;
      first = el; // the host is the pseudo's parent
    } else {
      const R = el.getBoundingClientRect();
      box = { l: R.left, t: R.top, r: R.right, b: R.bottom };
      rad = parseFloat(ecs.borderTopLeftRadius) || 0;
    }
    if (spec.inset) {
      box.t += spec.inset[0];
      box.r -= spec.inset[1];
      box.b -= spec.inset[2];
      box.l += spec.inset[3];
      rad = Math.max(0, rad - spec.inset[0]);
    }
    const w = box.r - box.l;
    const h = box.b - box.t;
    if (!(w > 1 && h > 1)) return { skip: 'zero size' };
    if (spec.r === 'capsule') rad = Math.min(w, h) / 2;
    else if (typeof spec.r === 'number') rad = spec.r;
    rad = Math.min(rad, w / 2, h / 2);
    let op = parseFloat(ecs.opacity);
    for (let a = el.parentElement; a && a.nodeType === 1 && op >= 0.05; a = a.parentElement) op *= facts(ent, a).opacity;
    if (op < 0.05) return { skip: 'transparent (opacity ' + op.toFixed(2) + ')' };
    let c = { l: Math.max(0, box.l), t: Math.max(0, box.t), r: Math.min(ctx.vw, box.r), b: Math.min(ctx.vh, box.b) };
    if (c.r - c.l < 1 || c.b - c.t < 1) return { skip: 'offscreen' };
    const scrollers = [];
    c = clipChain(ctx, first, pos, c, clip, scrollers);
    if (!c) return { skip: 'clipped away' };
    if (hitTest && covered(ctx, el, c)) return { skip: 'covered' };
    return { l: c.l, t: c.t, r: c.r, b: c.b, rad, scrollers };
  }

  function toTex(b, ctx) {
    const d = ctx.dpr;
    const cl = (v, m) => Math.max(0, Math.min(m, v));
    const x0 = cl(Math.round(b.l * d), ctx.texW);
    const y0 = cl(Math.round(b.t * d), ctx.texH);
    const x1 = cl(Math.round(b.r * d), ctx.texW);
    const y1 = cl(Math.round(b.b * d), ctx.texH);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < MIN_PX || h < MIN_PX) return null;
    return { x: x0, y: y0, w, h, r: Math.round(Math.min(b.rad * d, w / 2, h / 2)) };
  }

  function intersectTex(t, c) {
    const x0 = Math.max(t.x, c.x);
    const y0 = Math.max(t.y, c.y);
    const x1 = Math.min(t.x + t.w, c.x + c.w);
    const y1 = Math.min(t.y + t.h, c.y + c.h);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < MIN_PX || h < MIN_PX) return null;
    return { x: x0, y: y0, w, h, r: Math.min(t.r, Math.floor(w / 2), Math.floor(h / 2)) };
  }

  // the cover shape under the centre of t
  function shapeAt(shapes, t) {
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    for (const s of shapes) if (cx >= s.x && cx < s.x + s.w && cy >= s.y && cy < s.y + s.h) return s;
    return null;
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // pseudo-element animations are keyed per host and part
  const pkeys = new WeakMap();
  function pseudoKey(T, part) {
    let m = pkeys.get(T);
    if (!m) pkeys.set(T, m = {});
    return m[part] || (m[part] = { T, part });
  }

  // is T one of the measured elements (a cover or a rule match) or inside one?
  function insideMeasured(ent, T) {
    const q = ent.q;
    if (!q) return false;
    for (const el of q.cover) if (el.contains(T)) return true;
    for (const els of q.rules.values()) for (const el of els) if (el.contains(T)) return true;
    return false;
  }

  // Is a geometric transition or animation running on el (or, for a
  // ::before/::after part, on that pseudo-element) or an ancestor? Its events
  // arrive a frame after the style change that starts it, so el's own
  // running animations are asked for too (a just-focused card).
  function animating(ent, el, now, part) {
    for (const [T, rec] of ent.anims) {
      if (now > rec.until || !T.isConnected) { ent.anims.delete(T); continue; }
      if (T === el || T.contains(el)) return true;
    }
    if (part && part !== 'self' && part !== 'cover' && ent.panims.size) {
      const rec = ent.panims.get(pseudoKey(el, part));
      if (rec) {
        if (now <= rec.until && el.isConnected) return true;
        ent.panims.delete(pseudoKey(el, part));
      }
    }
    let list = [];
    try { list = el.getAnimations(); } catch (_) { /* detached */ }
    for (const a of list) {
      if (a.playState !== 'running') continue;
      const geo = a.transitionProperty !== undefined ? !isPaintProp(a.transitionProperty)
        : a.animationName !== undefined ? animGeometric(el, a.animationName) : true;
      if (!geo) continue;
      return true; // its events follow (the 2 s resample if they never come)
    }
    return false;
  }

  // Does a tracked animation touch anything this window measures (a cover or
  // a rule match, or one of their ancestors)? Others (a row fading, a
  // spinner) do not keep the sampling loop running.
  function animsRelevant(ent, now) {
    if (!ent.anims.size && !ent.panims.size) return false;
    const q = ent.q;
    if (!q || q.gen !== ent.domGen) return true;
    for (const [T, rec] of ent.anims) {
      if (now > rec.until || !T.isConnected) { ent.anims.delete(T); continue; }
      for (const el of q.cover) if (T === el || T.contains(el)) return true;
      for (const els of q.rules.values()) for (const el of els) if (T === el || T.contains(el)) return true;
    }
    for (const [k, rec] of ent.panims) {
      if (now > rec.until || !rec.el.isConnected) { ent.panims.delete(k); continue; }
      for (const [rule, els] of q.rules) if (rule.part === rec.part && els.includes(rec.el)) return true;
    }
    return false;
  }

  function describe(el) {
    let idx = null;
    try { idx = getIndex(); } catch (_) { /* none */ }
    const cls = [];
    for (const c of el.classList) {
      if (cls.length >= 3) break;
      const t = idx && idx.byHash && idx.byHash.has(c) ? idx.tokenFor(c) : null;
      cls.push(t ? '%{' + t + '}' : c);
    }
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls.length ? ' ' + cls.join(' ') : '');
  }

  // ------------------------------------------------------------ per surface

  // element lists, cached until the DOM (classes, styles, nodes) changes
  function queries(ent) {
    if (ent.q && ent.q.gen === ent.domGen) return ent.q;
    const a = performance.now();
    const s = ent.s;
    const q = { gen: ent.domGen, cover: [], rules: new Map() };
    try { q.cover = Array.from(ent.doc.querySelectorAll(s.cover.sel)); } catch (_) { /* window gone */ }
    for (const rule of s.rules) {
      let a = [];
      try { a = Array.from(ent.doc.querySelectorAll(rule.sel)); } catch (_) { /* window gone */ }
      q.rules.set(rule, a);
    }
    ent.q = q;
    ent.queries++;
    S.prof.queryMs += performance.now() - a;
    return q;
  }

  // Full measurement of one window: {surface, kept, covers}. Layers in a
  // scroller that is scrolling right now are left out ('scrolling').
  function computeEntry(ent, why) {
    const s = ent.s;
    const win = ent.win;
    const now = performance.now();
    let doc;
    let dpr;
    let vw;
    let vh;
    try {
      doc = win.document;
      dpr = win.devicePixelRatio || 1;
      vw = win.innerWidth;
      vh = win.innerHeight;
    } catch (_) {
      return { surface: blank(ent, 0, 0), kept: [], covers: [] };
    }
    const texW = Math.round(vw * dpr);
    const texH = Math.round(vh * dpr);
    const surface = blank(ent, texW, texH);
    const out = { surface, kept: [], covers: [] };
    const off = (reason) => {
      if (why) why.push({ surface: reason });
      return out;
    };
    if (s.docVisibility && doc.visibilityState !== 'visible') return off('window hidden');
    if (s.frameKey && !frameVisible(s.frameKey)) return off('dashboard frame hidden');
    if (s.laserOnly) {
      const g = gamepadNav();
      if (g !== false) return off(g === null ? 'input mode unknown yet (laser-only surface)' : 'controller navigation (laser-only surface)');
    }
    const ctx = { ent, win, doc, dpr, vw, vh, texW, texH, now, held: 0 };
    const q = queries(ent);

    // the cover: the first match, or (cover.all) every outermost match
    const shapes = [];
    for (const el of q.cover) {
      if (shapes.length && !s.cover.all) break;
      if (s.cover.all && q.cover.some((o) => o !== el && o.contains(el))) {
        if (why) why.push({ cover: describe(el), skip: 'inside another cover' });
        continue;
      }
      const b = measure(ctx, el, s.cover, false, true);
      if (b.skip) { if (why) why.push({ cover: describe(el), skip: b.skip }); continue; }
      let t = toTex(b, ctx);
      if (!t) { if (why) why.push({ cover: describe(el), skip: 'too small' }); continue; }
      t = settleCover(ctx, el, t);
      if (!t) { if (why) why.push({ cover: describe(el), skip: 'animating (new)' }); continue; }
      shapes.push(t);
      out.covers.push(el);
      if (why) why.push({ cover: describe(el), ok: t });
    }
    if (!shapes.length) return off('no cover on screen');
    surface.visible = true;
    surface.radius = shapes[0].r;
    surface.shapes = shapes;

    for (const rule of s.rules) {
      let n = 0;
      for (const el of q.rules.get(rule) || []) {
        if (n >= rule.max || out.kept.length >= s.maxLayers) break;
        const r = candidate(ctx, rule, el, out.kept, shapes, n);
        if (why) why.push(Object.assign({ rule: rule.id, el: describe(el) }, r.skip ? { skip: r.skip } : { ok: r.layer }));
        if (r.skip) continue;
        out.kept.push(r);
        n++;
      }
    }
    surface.layers = out.kept.map((k) => k.layer);
    out.held = ctx.held;
    return out;
  }

  // An animating cover keeps its last settled shape, updated at most every
  // COVER_FOLLOW_MS; a new cover waits until it settles (a materializing
  // popup), so glassd re-renders its shape a few times, not every frame.
  function settleCover(ctx, el, t) {
    const ent = ctx.ent;
    let m = ent.settled.get(el);
    if (!m) ent.settled.set(el, m = {});
    const prev = m.cover;
    if (!animating(ent, el, ctx.now, 'cover')) {
      m.cover = Object.assign({ at: ctx.now }, t);
      return t;
    }
    if (!prev) return null;
    ctx.held++;
    if (ctx.now - prev.at >= COVER_FOLLOW_MS) m.cover = Object.assign({ at: ctx.now }, t);
    const c = m.cover;
    return { x: c.x, y: c.y, w: c.w, h: c.h, r: c.r };
  }

  function blank(ent, texW, texH) {
    return {
      name: ent.name, overlayKey: ent.key, visible: false, texW, texH, radius: 0,
      material: ent.s.material, shapes: [], layers: [],
    };
  }

  function candidate(ctx, rule, el, kept, shapes, slot) {
    const ent = ctx.ent;
    for (const k of kept) if (k.el === el && k.part === rule.part) return { skip: 'already popped' };
    let focused = true;
    if (rule.focus) { try { focused = el.matches(rule.focus); } catch (_) { focused = false; } }
    const dz = rule.dz + (focused ? rule.lift : 0);
    if (!(dz > 0)) return { skip: 'not focused' };
    const b = measure(ctx, el, rule, rule.hitTest, rule.clip);
    if (b.skip) return b;
    // its crop would lag the live texture while the scroller moves
    if (b.scrollers.some((sc) => isScrolling(ent, sc, ctx.now))) return { skip: 'scrolling' };
    let t = toTex(b, ctx);
    if (!t) return { skip: 'too small' };
    // Steam's own pixels outside the cover would show behind the crop.
    const shape = shapeAt(shapes, t);
    if (!shape) return { skip: 'outside the cover' };
    t = intersectTex(t, shape);
    if (!t) return { skip: 'outside the cover' };
    // the slab size changes only once the element has settled
    let m = ent.settled.get(el);
    if (!m) ent.settled.set(el, m = {});
    if (!animating(ent, el, ctx.now, rule.part)) {
      m[rule.part] = { w: t.w, h: t.h, r: t.r };
    } else {
      const p = m[rule.part];
      if (!p) return { skip: 'animating (new)' };
      ctx.held++;
      t = { x: Math.round(t.x + t.w / 2 - p.w / 2), y: Math.round(t.y + t.h / 2 - p.h / 2), w: p.w, h: p.h, r: p.r };
    }
    // same rule as the daemon: popped rects never overlap
    for (const k of kept) if (overlaps(t, k.t)) return { skip: 'overlaps ' + k.layer.id };
    const id = slot === 0 ? rule.id : rule.id + '.' + slot;
    return {
      el, part: rule.part, t, scrollers: b.scrollers,
      layer: { id, x: t.x, y: t.y, w: t.w, h: t.h, r: t.r, dz: Math.round(dz * 10000) / 10000, material: rule.material },
    };
  }

  // The last full measurement minus the layers whose scroller started
  // scrolling since.
  function present(ent, now) {
    const f = ent.full;
    const kept = f.kept.filter((k) => !k.scrollers.some((sc) => isScrolling(ent, sc, now)));
    if (kept.length === f.kept.length) return f;
    const surface = Object.assign({}, f.surface, { layers: kept.map((k) => k.layer) });
    return { surface, kept, covers: f.covers };
  }

  // ------------------------------------------------------------ attributes

  // Since when each reported (element, part) has held its id. An ack names
  // ids; it can only refer to the element now holding an id once that
  // element has held it for a scene-graph round trip (an id moves, e.g. the
  // focused card). Covers hold the id '#cover'.
  function refreshHold(ent, now) {
    const next = new Map();
    const cur = ent.cur;
    if (cur && cur.surface.visible) {
      const prev = ent.hold;
      const put = (el, part, id) => {
        const o = prev.get(el);
        const r = o && o[part];
        let m = next.get(el);
        if (!m) next.set(el, m = {});
        m[part] = r && r.id === id ? r : { id, since: now };
      };
      for (const el of cur.covers) put(el, 'cover', '#cover');
      for (const k of cur.kept) put(k.el, k.part, k.layer.id);
    }
    ent.hold = next;
  }

  // ack mode: the ids acknowledged for this window (null: its key is not in
  // the ack map, i.e. the compositor shows no cover for it)
  function ackedIds(ent, now) {
    const list = S.acked && Object.prototype.hasOwnProperty.call(S.acked, ent.key) ? S.acked[ent.key] : null;
    const ids = Array.isArray(list) ? list.map(String) : null;
    if (ids) ent.keyAcked = true;
    let native = false;
    try { native = ent.doc.documentElement.classList.contains('lgs-native'); } catch (_) { /* gone */ }
    if (!native) ent.nativeSince = 0; else if (!ent.nativeSince) ent.nativeSince = now;
    return ids;
  }

  function updateAttrs() {
    if (!S) return;
    const now = performance.now();
    let due = Infinity;
    for (const ent of S.ents.values()) {
      const plan = new Map();
      const cur = ent.cur;
      refreshHold(ent, now);
      if (cur && cur.surface.visible) {
        const ids = S.ackMode ? ackedIds(ent, now) : null;
        // a daemon that leaves out surfaces with nothing popped: the window's
        // lgs-native (glassd covers it) stands in for the cover's ack
        const fallback = S.ackMode && !ids && !ent.keyAcked && ent.nativeSince && now - ent.nativeSince >= COVER_FALLBACK_MS;
        const ok = (el, part) => {
          if (!S.ackMode) return true;
          const o = ent.hold.get(el);
          const r = o && o[part];
          if (!r) return false;
          if (part === 'cover' ? !(ids || fallback) : !(ids && ids.includes(r.id))) return false;
          const t = r.since + S.ackDelay;
          if (now >= t) return true;
          due = Math.min(due, t);
          return false;
        };
        const add = (el, part) => {
          let p = plan.get(el);
          if (!p) plan.set(el, p = { cover: false, pop: [] });
          if (part === 'cover') p.cover = true; else if (!p.pop.includes(part)) p.pop.push(part);
        };
        for (const el of cur.covers) if (ok(el, 'cover')) add(el, 'cover');
        for (const k of cur.kept) if (ok(k.el, k.part)) add(k.el, k.part);
      }
      applyAttrs(ent, plan);
    }
    if (S.attrTimer) { clearTimeout(S.attrTimer); S.attrTimer = 0; }
    if (due < Infinity) {
      S.attrTimer = setTimeout(() => { if (S) { S.attrTimer = 0; updateAttrs(); } }, Math.max(5, due - now + 2));
    }
  }

  function applyAttrs(ent, plan) {
    const AP = ent.attrPop;
    const AC = ent.attrCover;
    for (const el of ent.applied.keys()) {
      if (plan.has(el)) continue;
      try {
        el.removeAttribute(AP);
        el.removeAttribute(AC);
      } catch (_) { /* window gone */ }
    }
    for (const [el, at] of plan) {
      try {
        const pop = at.pop.join(' ');
        if (pop) { if (el.getAttribute(AP) !== pop) el.setAttribute(AP, pop); } else if (el.hasAttribute(AP)) el.removeAttribute(AP);
        if (at.cover) { if (!el.hasAttribute(AC)) el.setAttribute(AC, ''); } else if (el.hasAttribute(AC)) el.removeAttribute(AC);
      } catch (_) { /* window gone */ }
    }
    ent.applied = plan;
  }

  function popCount() {
    let n = 0;
    for (const ent of S.ents.values()) for (const at of ent.applied.values()) if (at.pop.length) n++;
    return n;
  }

  // ------------------------------------------------------------ loop

  function clockWindow() {
    let best = null;
    for (const e of S.ents.values()) {
      try {
        if (e.doc.visibilityState !== 'visible') continue;
        if (e.s.name === 'main') return e.win;
        if (!best) best = e.win;
      } catch (_) { /* closing */ }
    }
    return best;
  }

  // One pending tick at a time: after `delay` ms, on the next animation
  // frame of a visible window (a timer when none renders).
  function schedule(delay, timerOnly) {
    if (!S || S.paused || !S.dash || S.raf) return;
    S.rafAt = performance.now();
    if (delay > 1) {
      S.rafTimer = true;
      S.raf = setTimeout(() => {
        if (!S) return;
        S.raf = 0;
        S.rafTimer = false;
        schedule(0, timerOnly);
      }, delay);
      return;
    }
    const w = timerOnly ? null : clockWindow();
    if (w) {
      try {
        S.raf = w.requestAnimationFrame(tick);
        S.rafWin = w;
        S.rafTimer = false;
        return;
      } catch (_) { /* window closing: fall back to a timer */ }
    }
    S.rafWin = null;
    S.rafTimer = true;
    S.raf = setTimeout(tick, 16);
  }

  function cancelFrame() {
    if (!S || !S.raf) return;
    try { if (S.rafWin) S.rafWin.cancelAnimationFrame(S.raf); else clearTimeout(S.raf); } catch (_) { /* window gone */ }
    S.raf = 0;
    S.rafWin = null;
    S.rafTimer = false;
  }

  // a scroller is "still" SCROLL_SETTLE_MS after its last scroll event
  function armSettle() {
    if (S.settleTimer) clearTimeout(S.settleTimer);
    S.settleTimer = setTimeout(() => {
      if (!S) return;
      S.settleTimer = 0;
      schedule(0);
    }, SCROLL_SETTLE_MS + 10);
  }

  function settleScrolls(ent, now) {
    if (!ent.scrolling.size) return;
    let settled = false;
    for (const [sc, t] of ent.scrolling) {
      if (now - t >= SCROLL_SETTLE_MS) { ent.scrolling.delete(sc); settled = true; }
    }
    if (!settled) return;
    ent.dirty = true;
    if (ent.deferred) { ent.deferred = false; ent.domGen++; }
  }

  function tick() {
    if (!S) return;
    S.raf = 0;
    S.rafWin = null;
    S.rafTimer = false;
    if (S.paused || !S.dash) return;
    const t0 = performance.now();
    const since = t0 - S.lastTickAt;
    if (since < MIN_TICK_MS) { schedule(MIN_TICK_MS - since); return; }
    if (S.dashPending) { schedule(16); return; } // a dashboard check is in flight
    S.lastTickAt = t0;
    let again = false;
    let changed = false;
    for (const ent of S.ents.values()) {
      settleScrolls(ent, t0);
      // per-frame samples only while a reported layer follows an animation;
      // an element that waits to settle is picked up by its end event
      const moving = !!(ent.full && ent.full.held) && animsRelevant(ent, t0);
      const full = ent.force || ent.dirty || !ent.full || moving || t0 < ent.tailUntil;
      if (!full && !ent.needLight) continue;
      ent.needLight = false;
      if (full) {
        ent.force = false;
        ent.dirty = false;
        const a = performance.now();
        try { ent.full = computeEntry(ent, null); } catch (e) {
          S.lastError = String(e && e.stack || e).slice(0, 400);
          ent.full = { surface: blank(ent, 0, 0), kept: [], covers: [] };
        }
        ent.computeMs += performance.now() - a;
        ent.computes++;
        S.fullComputes++;
      } else {
        ent.lights++;
        S.lightComputes++;
      }
      const cur = present(ent, t0);
      const sig = JSON.stringify(cur.surface);
      ent.cur = cur;
      if (sig !== ent.sig) {
        ent.sig = sig;
        ent.changes++;
        changed = true;
        if (full) {
          ent.tailUntil = t0 + TAIL_MS;
          // another layer appeared or went: re-check what covers what once
          const ids = cur.surface.layers.map((l) => l.id).join(',');
          if (ent.lastIds !== null && ids !== ent.lastIds) { ent.hitGen++; ent.dirty = true; }
          ent.lastIds = ids;
        }
      }
      if (ent.dirty || (ent.full.held && animsRelevant(ent, t0)) || t0 < ent.tailUntil) again = true;
    }
    if (changed || S.structureChanged || S.lastBody === null) {
      updateAttrs();
      emit();
    }
    S.structureChanged = false;
    const ms = performance.now() - t0;
    S.ticks++;
    S.lastMs = ms;
    S.totalMs += ms;
    S.maxMs = Math.max(S.maxMs, ms);
    if (again) schedule(MIN_TICK_MS);
  }

  function surfacesNow(final) {
    const out = [];
    for (const ent of S.ents.values()) {
      const r = final ? blank(ent, ent.cur ? ent.cur.surface.texW : 0, ent.cur ? ent.cur.surface.texH : 0) : ent.cur && ent.cur.surface;
      if (!r) continue;
      // a hidden pooled popup costs glassd an overlay and buffers: leave it out
      if (ent.s.keyPrefix && !r.visible) continue;
      out.push(r);
    }
    return out;
  }

  function emit(final, force) {
    const body = '"dash":' + (S.dash ? 'true' : 'false') + ',"surfaces":' + JSON.stringify(surfacesNow(final));
    if (!final && !force && body === S.lastBody) return false;
    S.lastBody = body;
    S.seq++;
    let json = '{"seq":' + S.seq + ',' + body;
    if (S.errors && S.errors.length) json += ',"errors":' + JSON.stringify(S.errors.slice(0, 20));
    if (final) json += ',"stopped":true';
    json += '}';
    S.last = json;
    S.emits++;
    S.lastEmitAt = Date.now();
    const bind = W[S.binding];
    if (typeof bind === 'function') {
      try { bind(json); } catch (e) { S.bindError = String(e); }
    }
    return true;
  }

  // Liveness: the daemon's pings, or (an older daemon that never pings) its
  // lgs-native heartbeat, or the theme staying off.
  function daemonGone() {
    const now = Date.now();
    if (S.pingAt) return now - S.pingAt > S.pingTtl ? 'no ping for ' + Math.round((now - S.pingAt) / 1000) + ' s' : null;
    // a heartbeat from before this reporter started may be a dead daemon's
    // leftover; only one seen since counts
    let h = null;
    try { h = W.__LGS_NATIVE; } catch (_) { /* none */ }
    if (h && Array.isArray(h.keys) && h.keys.length && +h.last > 0) {
      if (h.last > S.startedAt) S.nativeSeen = true;
      if (S.nativeSeen && now - h.last > NATIVE_STALE_MS) return 'lgs-native heartbeat stale for ' + Math.round((now - h.last) / 1000) + ' s';
    }
    if (S.themeOffPolls >= THEME_OFF_POLLS) return 'theme off for 30 s';
    return null;
  }

  function pause() {
    if (S.paused) return;
    S.paused = true;
    cancelFrame();
    for (const ent of S.ents.values()) detach(ent);
    S.ents.clear();
    S.lastBody = null;
  }

  function poll() {
    if (!S) return;
    S.polls++;
    let themeOn = true;
    try { themeOn = !!(W.__LGS && W.__LGS.state && W.__LGS.state.enabled); } catch (_) { /* keep running */ }
    S.themeOffPolls = themeOn ? 0 : (S.themeOffPolls || 0) + 1;
    const gone = daemonGone();
    if (gone) { stop({ reason: gone }); return; }
    if (!themeOn) { pause(); return; }
    if (S.paused) { S.paused = false; S.structureChanged = true; }
    try { syncWindows(); } catch (e) { S.lastError = String(e && e.stack || e).slice(0, 400); }
    refreshDash();
    if (!S.dash) return;
    if (S.structureChanged || S.ackMode) updateAttrs(); // new windows; cover fallback timing
    const resample = S.polls % RESAMPLE_EVERY === 0 || S.structureChanged;
    if (resample) {
      S.resamples++;
      const deep = S.resamples % DEEP_EVERY === 0;
      const now = performance.now();
      for (const e of S.ents.values()) {
        // a window that is scrolling gets a full measurement once it settles
        if (!S.structureChanged && e.scrolling.size && activeScrollers(e, now).length) continue;
        e.force = true;
        if (deep) { e.domGen++; e.hitGen++; }
      }
    }
    // a frame request on a window that stopped rendering must not stall us
    let stalled = false;
    if (S.raf && !S.rafTimer && performance.now() - S.rafAt > 250) { cancelFrame(); stalled = true; }
    if (resample || stalled) schedule(0, stalled);
  }

  // ------------------------------------------------------------ API

  let waiting = null; // {timer, tries, rules, opts} while the token index is missing

  function start(rules, opts) {
    if (S) stop({ silent: true, keepGlobal: true });
    if (waiting) { clearInterval(waiting.timer); waiting = null; }
    opts = opts || {};
    const cfg = compile(rules);
    if (!cfg) {
      // The theme (lgs_core.js) builds the token index; wait for it.
      waiting = { tries: 0, rules, opts, timer: setInterval(() => {
        if (!waiting) return;
        waiting.tries++;
        if (getIndex()) { const w = waiting; clearInterval(w.timer); waiting = null; start(w.rules, w.opts); } else if (waiting.tries > 120) { clearInterval(waiting.timer); waiting = null; }
      }, 1000) };
      return status();
    }
    S = {
      cfg, errors: cfg.errors, ents: new Map(),
      binding: opts.binding || 'lgsLayers',
      attrPrefix: typeof opts.attrPrefix === 'string' && /^data-[a-z0-9-]+$/.test(opts.attrPrefix) ? opts.attrPrefix : ATTR_PREFIX,
      dash: true, dashPending: false, dashForced: null, dashChanges: 0,
      nav: { C: null, state: 'idle', id: null, ms: 0 },
      animGeo: new Map(),
      raf: 0, rafWin: null, rafTimer: false, rafAt: 0, timer: 0, polls: 0, resamples: 0,
      settleTimer: 0, attrTimer: 0, lastTickAt: -1e9,
      seq: 0, emits: 0, ticks: 0, fullComputes: 0, lightComputes: 0, prof: { queryMs: 0, hitMs: 0 },
      lastMs: 0, totalMs: 0, maxMs: 0,
      last: null, lastBody: null, lastEmitAt: 0, lastError: null, bindError: null,
      structureChanged: true, startedAt: Date.now(), paused: false, themeOffPolls: 0,
      ackMode: !!opts.ackMode, acked: null, acks: 0, lastAckAt: 0,
      ackDelay: +opts.ackDelayMs >= 0 ? +opts.ackDelayMs : ACK_DELAY_MS,
      pingAt: 0, pings: 0, pingTtl: +opts.pingTtlMs > 0 ? +opts.pingTtlMs : PING_TTL_MS, nativeSeen: false,
    };
    syncWindows();
    refreshDash();
    S.timer = setInterval(poll, POLL_MS);
    schedule(0);
    return status();
  }

  function stop(o) {
    o = o || {};
    if (waiting) { clearInterval(waiting.timer); waiting = null; }
    const dropGlobal = () => {
      if (o.keepGlobal || W.__LGS_LAYERS !== API) return;
      try { delete W.__LGS_LAYERS; } catch (_) { W.__LGS_LAYERS = undefined; }
    };
    if (!S) { dropGlobal(); return { running: false }; }
    const st = S;
    clearInterval(st.timer);
    cancelFrame();
    if (st.settleTimer) clearTimeout(st.settleTimer);
    if (st.attrTimer) clearTimeout(st.attrTimer);
    // the daemon must not keep compositing a layout nobody updates
    if (!o.silent && st.lastBody !== null) { try { emit(true); } catch (_) { /* binding gone */ } }
    for (const ent of st.ents.values()) detach(ent);
    st.ents.clear();
    S = null;
    const reason = o.reason || 'stop()';
    W.__LGS_LAYERS_LAST = { reason, at: Date.now(), emits: st.emits, seq: st.seq };
    dropGlobal();
    return { running: false, emits: st.emits, seq: st.seq, reason };
  }

  // running: false means the daemon should inject the reporter again (a
  // reporter still waiting for the theme's token index counts as running)
  function ping(o) {
    if (!S) return { running: !!waiting, version: VERSION, waiting: !!waiting };
    S.pingAt = Date.now();
    S.pings++;
    if (o && +o.ttlMs > 0) S.pingTtl = +o.ttlMs;
    return { running: true, version: VERSION, seq: S.seq, paused: S.paused, dash: S.dash, ackMode: S.ackMode };
  }

  // The daemon's acknowledgement: {overlayKey: [layer ids popped on screen]}.
  // Re-tags every window from its last measurement (no re-measuring). null
  // leaves ack mode (every reported element is tagged again).
  function ack(map) {
    if (!S) return false;
    if (typeof map === 'string') { try { map = JSON.parse(map); } catch (_) { map = null; } }
    if (map && typeof map === 'object') {
      S.ackMode = true;
      S.acked = map;
    } else {
      S.ackMode = false;
      S.acked = null;
    }
    S.acks++;
    S.lastAckAt = Date.now();
    if (S.pingAt) S.pingAt = S.lastAckAt; // an acking daemon is alive
    updateAttrs();
    return popCount();
  }

  // Measure now and emit even if nothing changed (after a daemon reconnect).
  function resend() {
    if (!S) return false;
    if (!S.dash || S.paused) { if (!S.paused) emit(false, true); return S.seq; }
    for (const e of S.ents.values()) e.force = true;
    S.lastBody = null;
    S.lastTickAt = -1e9;
    cancelFrame();
    tick();
    return S ? S.seq : false;
  }

  function forceDash(v) {
    if (!S) return false;
    S.dashForced = v === true || v === false ? v : null;
    refreshDash();
    return S.dash;
  }

  function status() {
    if (!S) {
      return waiting ? { running: false, version: VERSION, waiting: 'token index (theme off?)', tries: waiting.tries }
        : { running: false, version: VERSION, last: W.__LGS_LAYERS_LAST || null };
    }
    const now = performance.now();
    const surfaces = [];
    for (const e of S.ents.values()) {
      surfaces.push({
        name: e.name, key: e.key,
        visible: !!(e.cur && e.cur.surface.visible),
        layers: e.cur ? e.cur.surface.layers.length : 0,
        attrs: e.applied.size,
        computes: e.computes, computeMs: Math.round(e.computeMs * 10) / 10,
        lights: e.lights, changes: e.changes, queries: e.queries, hitTests: e.hitTests,
        scrolling: activeScrollers(e, now).length, animating: e.anims.size,
        wakes: Object.assign({}, e.wakes),
      });
    }
    // reading the input mode never starts the module search
    let nav = null;
    if (S.nav.C) { try { nav = !!S.nav.C.Instance.IsInGamepadNav; } catch (_) { nav = null; } }
    return {
      running: true, version: VERSION, seq: S.seq, emits: S.emits, ticks: S.ticks, polls: S.polls,
      fullComputes: S.fullComputes, lightComputes: S.lightComputes,
      queryMs: Math.round(S.prof.queryMs * 10) / 10, hitMs: Math.round(S.prof.hitMs * 10) / 10,
      uptimeS: Math.round((Date.now() - S.startedAt) / 100) / 10,
      lastMs: Math.round(S.lastMs * 100) / 100,
      avgMs: S.ticks ? Math.round(S.totalMs / S.ticks * 100) / 100 : 0,
      maxMs: Math.round(S.maxMs * 100) / 100,
      dashboardVisible: S.dash, dashForced: S.dashForced, paused: S.paused,
      gamepadNav: nav, navSearch: { state: S.nav.state, module: S.nav.id, ms: Math.round(S.nav.ms * 10) / 10 },
      ackMode: S.ackMode, acks: S.acks, acked: S.acked,
      lastAckAgoMs: S.lastAckAt ? Date.now() - S.lastAckAt : null,
      pings: S.pings, lastPingAgoMs: S.pingAt ? Date.now() - S.pingAt : null, pingTtlMs: S.pingTtl,
      binding: S.binding, bound: typeof W[S.binding] === 'function',
      lastEmitAgoMs: S.lastEmitAt ? Date.now() - S.lastEmitAt : null,
      animations: Object.fromEntries([...S.animGeo].slice(0, 40).map(([k, v]) => [k, v ? 'moves' : 'paint'])),
      surfaces, errors: S.errors, lastError: S.lastError, bindError: S.bindError,
    };
  }

  function snapshot() {
    if (!S) return null;
    const surfaces = [];
    for (const ent of S.ents.values()) surfaces.push(computeEntry(ent, null).surface);
    return { seq: S.seq, dash: S.dash, surfaces };
  }

  function debug(name) {
    if (!S) return null;
    const out = {};
    for (const ent of S.ents.values()) {
      if (name && ent.name !== name && ent.s.name !== name) continue;
      const why = [];
      const r = computeEntry(ent, why);
      out[ent.name] = { visible: r.surface.visible, shapes: r.surface.shapes, layers: r.surface.layers.length, why };
    }
    return out;
  }

  // Debug only: outline the cover (cyan) and every layer (magenta, with id and
  // dz) of the current snapshot in each window, for ms milliseconds. The nodes
  // are pointer-events:none and removed afterwards.
  function overlay(ms) {
    const snap = snapshot();
    if (!snap) return 0;
    let n = 0;
    for (const ent of S.ents.values()) {
      const sf = snap.surfaces.find((x) => x.name === ent.name);
      if (!sf || !sf.visible) continue;
      let doc;
      let dpr;
      try { doc = ent.doc; dpr = ent.win.devicePixelRatio || 1; } catch (_) { continue; }
      const root = doc.createElement('div');
      root.id = 'lgs-layers-overlay';
      root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
      const box = (t, color, label) => {
        const d = doc.createElement('div');
        d.style.cssText = `position:absolute;left:${t.x / dpr}px;top:${t.y / dpr}px;width:${t.w / dpr}px;height:${t.h / dpr}px;`
          + `border-radius:${t.r / dpr}px;outline:2px solid ${color};outline-offset:-1px;box-sizing:border-box;`;
        if (label) {
          const s = doc.createElement('span');
          s.textContent = label;
          s.style.cssText = `position:absolute;left:0;top:-15px;font:600 11px/14px monospace;color:#000;background:${color};padding:0 3px;white-space:nowrap;`;
          d.appendChild(s);
        }
        root.appendChild(d);
      };
      for (const sh of sf.shapes) box(sh, '#00e5ff', null);
      for (const l of sf.layers) { box(l, '#ff2bd6', l.id + ' ' + l.dz); n++; }
      const old = doc.getElementById('lgs-layers-overlay');
      if (old) old.remove();
      doc.body.appendChild(root);
      setTimeout(() => { try { root.remove(); } catch (_) { /* gone */ } }, ms || 8000);
    }
    return n;
  }

  API = { version: VERSION, start, stop, ping, ack, resend, snapshot, status, debug, overlay, forceDash };
  W.__LGS_LAYERS = API;

  // The daemon sets window.__LGS_LAYERS_OPTS = {layers, binding, ackMode}
  // before evaluating this file: start right away with those rules.
  if (OPTS && OPTS.layers) {
    try { start(OPTS.layers, OPTS); } catch (e) { API.error = String(e && e.message || e); }
  }
  return 'lgs_layers v' + VERSION + (S ? ' running' : waiting ? ' waiting for the token index' : ' installed');
})();
