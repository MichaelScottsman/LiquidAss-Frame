// Liquid Glass Shell: layer reporter for the native glass compositor.
//
// The daemon (device/lgs_shell.py) evaluates this inside Steam's
// SharedJSContext. If window.__LGS_LAYERS_OPTS = {layers, binding} is set
// beforehand, it starts itself with those rules. Tokens resolve through
// window.__LGS_INDEX (built by lgs_core.js while the theme is on) or through
// lgsBuildIndex when device/lgs_index.js is prepended; without either it waits
// for the theme. It installs window.__LGS_LAYERS:
//
//   start(rules, opts)  rules = theme/layers.json (object or JSON text),
//                  opts.binding = binding name (default "lgsLayers"). Starts,
//                  or restarts with new rules. Returns status().
//   stop()         stops and removes every data-lgs-* attribute it set.
//   resend()       measures now and emits the report even if unchanged.
//   snapshot()     the current report as an object, computed fresh. Emits
//                  nothing and changes nothing.
//   status()       counters, timing, wake sources, dashboard state, rule errors.
//   debug(name)    per-rule candidates of one surface (or all) and why each
//                  was kept or dropped.
//   overlay(ms)    debug only: outlines the cover and every layer in each
//                  window for ms milliseconds (default 8000), then removes it.
//
// Reports go to window.lgsLayers(json), the CDP binding the daemon adds with
// Runtime.addBinding. At most one per animation frame, and only when something
// changed. Format: docs/NATIVE.md, "Steam -> daemon: layer report". Each
// surface also carries two fields the compositor needs:
//   "material"  the material of the surface's own glass (the cover)
//   "shapes"    [{x, y, w, h, r}] in texture px: the rounded region the cover
//               must fill (glassd's optional "shapes"). It hides Steam's own
//               panel there. Main's is the whole window; the bar's, popups'
//               and footer's are their card or capsule inside a mostly
//               transparent texture. [] when the surface is not visible.
// A surface is "visible" only while the dashboard is up, its window shows,
// and its cover element is on screen. Otherwise it reports no layers, and the
// stock CSS glass stays in charge.
//
// While a surface is visible, its cover element carries data-lgs-cover and
// every popped element carries data-lgs-pop ("self", "before" or "after", the
// part that pops). theme/05-native.css keys off them, so it only drops CSS
// glass that glassd really replaces.
//
// Cost: nothing runs per frame while the UI is still. Mutations, scrolls,
// transitions, animations and pointer moves wake a requestAnimationFrame loop
// on the window that changed. The loop samples until rects stop changing,
// plus ACTIVE_MS. A 2 s safety resample catches anything missed. While
// SteamVR reports the dashboard hidden, nothing is measured. If the theme
// stays off for 5 s (a daemon that died without calling stop()), it stops.
(function lgsLayersInstall() {
  'use strict';
  const W = window;
  const VERSION = 1;
  if (W.__LGS_LAYERS && typeof W.__LGS_LAYERS.stop === 'function') {
    try { W.__LGS_LAYERS.stop(); } catch (_) { /* stale instance */ }
  }

  const ATTR_POP = 'data-lgs-pop';
  const ATTR_COVER = 'data-lgs-cover';
  const DEFAULT_FOCUS = '.gpfocus, .gpfocuswithin';
  const MATERIALS = ['window', 'panel', 'liquid', 'thick'];
  const POLL_MS = 500;        // dashboard state, window list, stalled-frame watchdog
  const RESAMPLE_EVERY = 4;   // safety resample every N polls (2 s)
  const ACTIVE_MS = 700;      // keep sampling this long after a change signal
  const MIN_PX = 4;           // texture px; smaller layers are dropped
  const OVERLAP_PX = 2;       // texture px two layers may overlap
  const MAX_LAYERS = 23;      // hard cap per surface
  const THEME_OFF_POLLS = 10; // stop after the theme has been off this many polls (5 s)
  const HIT_POINTS = [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]];
  const WAKE_EVENTS = ['scroll', 'transitionrun', 'transitionend', 'animationstart', 'animationend',
    'mouseover', 'mouseout', 'visibilitychange'];

  let S = null;               // running state; null while stopped
  let idSeq = 0;
  const ids = new WeakMap();  // element -> number, for stable layer ids

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
      s.cover = { sel: csel, pseudo: pseudoOf(c.pseudo), r: c.r, inset: insetOf(c.inset, c.outset) };
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
  // (IsInGamepadNav). Located by source text, so module ids may move.
  function findNav() {
    const req = webpackReq();
    if (!req) return null;
    for (const id of Object.keys(req.m)) {
      let src;
      try { src = req.m[id].toString(); } catch (_) { continue; }
      if (src.indexOf('get IsInGamepadNav') < 0) continue;
      let mod;
      try { mod = req(id); } catch (_) { continue; }
      for (const k of Object.keys(mod)) {
        try {
          const C = mod[k];
          if (C && C.Instance && 'IsInGamepadNav' in C.Instance) return C;
        } catch (_) { /* getter threw */ }
      }
    }
    return null;
  }

  // true = controller nav, false = laser, null = unknown
  function gamepadNav() {
    if (S.navClass === undefined) S.navClass = findNav();
    try { return S.navClass && S.navClass.Instance ? !!S.navClass.Instance.IsInGamepadNav : null; } catch (_) { return null; }
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

  function setDash(v) {
    if (S.dash === v) return;
    S.dash = v;
    for (const e of S.ents.values()) e.force = true;
    if (v) schedule(); else setTimeout(tick, 0); // hidden windows get no frames
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

  function attach(s, name, key, win) {
    const doc = win.document;
    const ent = {
      s, name, key, win, doc,
      mo: null, listeners: [], wake: null,
      activeUntil: performance.now() + ACTIVE_MS,
      force: true, lastChanged: false, sig: null, result: null,
      applied: new Map(),
      wakes: {}, computes: 0, changes: 0,
    };
    const wake = (ev) => {
      const t = ev && ev.type ? ev.type : 'mutation';
      ent.wakes[t] = (ent.wakes[t] || 0) + 1;
      ent.activeUntil = performance.now() + ACTIVE_MS;
      if (S && S.dash) schedule();
    };
    ent.wake = wake;
    try {
      ent.mo = new win.MutationObserver(() => wake(null));
      ent.mo.observe(doc.documentElement, {
        subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'],
      });
    } catch (_) { /* window closing */ }
    const add = (target, type) => {
      try {
        target.addEventListener(type, wake, { capture: true, passive: true });
        ent.listeners.push([target, type]);
      } catch (_) { /* window closing */ }
    };
    for (const t of WAKE_EVENTS) add(doc, t);
    add(win, 'resize');
    return ent;
  }

  function detach(ent, keepAttrs) {
    try { if (ent.mo) ent.mo.disconnect(); } catch (_) { /* gone */ }
    for (const [target, type] of ent.listeners) {
      try { target.removeEventListener(type, ent.wake, { capture: true }); } catch (_) { /* gone */ }
    }
    ent.listeners = [];
    if (!keepAttrs) applyAttrs(ent, new Map());
  }

  function syncWindows() {
    const seen = new Set();
    let changed = false;
    for (const { win, key } of popupList()) {
      const m = surfaceFor(key);
      if (!m) continue;
      seen.add(key);
      let ent = S.ents.get(key);
      if (ent && ent.win !== win) { detach(ent); ent = null; }
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

  function cs(ctx, el) {
    let v = ctx.cs.get(el);
    if (!v) { v = ctx.win.getComputedStyle(el); ctx.cs.set(el, v); }
    return v;
  }

  // does this style make the element a containing block for absolute (or,
  // with fixed=true, fixed) descendants?
  function makesCB(s, fixed) {
    if (s.transform !== 'none' || s.perspective !== 'none' || s.filter !== 'none') return true;
    if (s.backdropFilter && s.backdropFilter !== 'none') return true;
    if (/transform|perspective|filter/.test(s.willChange)) return true;
    if (/paint|layout|strict|content/.test(s.contain)) return true;
    return !fixed && s.position !== 'static';
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
    while (cb && cb.nodeType === 1 && !makesCB(cs(ctx, cb), pos === 'fixed')) cb = cb.parentElement;
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

  // Clip by every overflow ancestor on the containing-block chain (an absolute
  // element escapes overflow:hidden of ancestors below its containing block).
  function clipAncestors(ctx, a, pos, c) {
    for (; a && a.nodeType === 1; a = a.parentElement) {
      const s = cs(ctx, a);
      if (pos === 'absolute' && !makesCB(s, false)) continue;
      if (pos === 'fixed' && !makesCB(s, true)) continue;
      const paint = /paint|strict|content/.test(s.contain);
      const ox = paint || s.overflowX !== 'visible';
      const oy = paint || s.overflowY !== 'visible';
      if (ox || oy) {
        const R = a.getBoundingClientRect();
        if (ox) { c.l = Math.max(c.l, R.left); c.r = Math.min(c.r, R.right); }
        if (oy) { c.t = Math.max(c.t, R.top); c.b = Math.min(c.b, R.bottom); }
        if (c.r - c.l < 1 || c.b - c.t < 1) return null;
      }
      pos = s.position;
    }
    return c;
  }

  // Is the element hidden under something else (a modal scrim, a sheet)?
  // Hit-tests a few points; any point landing on the element, inside it or
  // on one of its ancestors counts as visible.
  function covered(ctx, el, c) {
    let tested = 0;
    for (const [fx, fy] of HIT_POINTS) {
      const x = c.l + (c.r - c.l) * fx;
      const y = c.t + (c.b - c.t) * fy;
      if (x < 0 || y < 0 || x >= ctx.vw || y >= ctx.vh) continue;
      let hit = null;
      try { hit = ctx.doc.elementFromPoint(x, y); } catch (_) { /* detached */ }
      if (!hit) continue;
      tested++;
      if (hit === el || el.contains(hit) || hit.contains(el)) return false;
    }
    return tested > 0;
  }

  // Visible, clipped box of an element (or its pseudo-element) in CSS px,
  // with its corner radius; or {skip: reason}.
  function measure(ctx, el, spec, hitTest, clip) {
    if (!el.isConnected) return { skip: 'detached' };
    const ecs = cs(ctx, el);
    if (ecs.display === 'none') return { skip: 'display none' };
    if (ecs.visibility !== 'visible') return { skip: 'visibility ' + ecs.visibility };
    let box;
    let rad;
    let pos = ecs.position;
    let first = el.parentElement;
    if (spec.pseudo) {
      const ps = ctx.win.getComputedStyle(el, spec.pseudo);
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
    for (let a = el.parentElement; a && a.nodeType === 1 && op >= 0.05; a = a.parentElement) op *= parseFloat(cs(ctx, a).opacity);
    if (op < 0.05) return { skip: 'transparent (opacity ' + op.toFixed(2) + ')' };
    let c = { l: Math.max(0, box.l), t: Math.max(0, box.t), r: Math.min(ctx.vw, box.r), b: Math.min(ctx.vh, box.b) };
    if (c.r - c.l < 1 || c.b - c.t < 1) return { skip: 'offscreen' };
    if (clip) {
      c = clipAncestors(ctx, first, pos, c);
      if (!c) return { skip: 'clipped away' };
    }
    if (hitTest && covered(ctx, el, c)) return { skip: 'covered' };
    return { l: c.l, t: c.t, r: c.r, b: c.b, rad };
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

  function idFor(el) {
    let n = ids.get(el);
    if (!n) { n = ++idSeq; ids.set(el, n); }
    return n;
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

  function computeEntry(ent, why) {
    const s = ent.s;
    const win = ent.win;
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
      return { surface: blank(ent, 0, 0), attrs: new Map() };
    }
    const texW = Math.round(vw * dpr);
    const texH = Math.round(vh * dpr);
    const surface = blank(ent, texW, texH);
    const attrs = new Map();
    const off = (reason) => {
      if (why) why.push({ surface: reason });
      return { surface, attrs };
    };
    if (!S.dash) return off('dashboard hidden');
    if (s.docVisibility && doc.visibilityState !== 'visible') return off('window hidden');
    if (s.frameKey && !frameVisible(s.frameKey)) return off('dashboard frame hidden');
    if (s.laserOnly && gamepadNav() !== false) return off('controller navigation (laser-only surface)');
    const ctx = { win, doc, dpr, vw, vh, texW, texH, cs: S.csCache || new Map() };

    let cover = null;
    let coverEl = null;
    for (const el of doc.querySelectorAll(s.cover.sel)) {
      const b = measure(ctx, el, s.cover, false, true);
      if (b.skip) { if (why) why.push({ cover: describe(el), skip: b.skip }); continue; }
      const t = toTex(b, ctx);
      if (!t) { if (why) why.push({ cover: describe(el), skip: 'too small' }); continue; }
      cover = t;
      coverEl = el;
      break;
    }
    if (!cover) return off('no cover on screen');
    surface.visible = true;
    surface.radius = cover.r;
    surface.shapes = [cover];
    attrs.set(coverEl, { cover: true, pop: [] });
    if (why) why.push({ cover: describe(coverEl), ok: cover });

    const kept = [];
    for (const rule of s.rules) {
      let n = 0;
      let els;
      try { els = doc.querySelectorAll(rule.sel); } catch (_) { continue; }
      for (const el of els) {
        if (n >= rule.max || kept.length >= s.maxLayers) break;
        const r = candidate(ctx, rule, el, kept, cover);
        if (why) why.push(Object.assign({ rule: rule.id, el: describe(el) }, r.skip ? { skip: r.skip } : { ok: r.layer }));
        if (r.skip) continue;
        kept.push(r);
        n++;
      }
    }
    for (const k of kept) {
      surface.layers.push(k.layer);
      let at = attrs.get(k.el);
      if (!at) attrs.set(k.el, at = { cover: false, pop: [] });
      at.pop.push(k.pseudo ? k.pseudo.slice(2) : 'self');
    }
    return { surface, attrs };
  }

  function blank(ent, texW, texH) {
    return {
      name: ent.name, overlayKey: ent.key, visible: false, texW, texH, radius: 0,
      material: ent.s.material, shapes: [], layers: [],
    };
  }

  function candidate(ctx, rule, el, kept, cover) {
    for (const k of kept) if (k.el === el && k.pseudo === rule.pseudo) return { skip: 'already popped' };
    let focused = true;
    if (rule.focus) { try { focused = el.matches(rule.focus); } catch (_) { focused = false; } }
    const dz = rule.dz + (focused ? rule.lift : 0);
    if (!(dz > 0)) return { skip: 'not focused' };
    const b = measure(ctx, el, rule, rule.hitTest, rule.clip);
    if (b.skip) return b;
    let t = toTex(b, ctx);
    if (!t) return { skip: 'too small' };
    // Steam's own pixels outside the cover would show behind the crop.
    t = intersectTex(t, cover);
    if (!t) return { skip: 'outside the cover' };
    for (const k of kept) {
      const ix = Math.min(k.t.x + k.t.w, t.x + t.w) - Math.max(k.t.x, t.x);
      const iy = Math.min(k.t.y + k.t.h, t.y + t.h) - Math.max(k.t.y, t.y);
      if (ix > OVERLAP_PX && iy > OVERLAP_PX) return { skip: 'overlaps ' + k.layer.id };
    }
    const id = rule.max === 1 ? rule.id : rule.id + '-' + idFor(el);
    return {
      el, pseudo: rule.pseudo, t,
      layer: { id, x: t.x, y: t.y, w: t.w, h: t.h, r: t.r, dz: Math.round(dz * 10000) / 10000, material: rule.material },
    };
  }

  function applyAttrs(ent, plan) {
    for (const el of ent.applied.keys()) {
      if (plan.has(el)) continue;
      try {
        el.removeAttribute(ATTR_POP);
        el.removeAttribute(ATTR_COVER);
      } catch (_) { /* window gone */ }
    }
    for (const [el, at] of plan) {
      try {
        const pop = at.pop.join(' ');
        if (pop) { if (el.getAttribute(ATTR_POP) !== pop) el.setAttribute(ATTR_POP, pop); } else if (el.hasAttribute(ATTR_POP)) el.removeAttribute(ATTR_POP);
        if (at.cover) { if (!el.hasAttribute(ATTR_COVER)) el.setAttribute(ATTR_COVER, ''); } else if (el.hasAttribute(ATTR_COVER)) el.removeAttribute(ATTR_COVER);
      } catch (_) { /* window gone */ }
    }
    ent.applied = plan;
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

  function schedule() {
    if (!S || S.raf) return;
    const w = S.dash ? clockWindow() : null;
    S.rafAt = performance.now();
    S.rafWin = null;
    if (w) {
      try {
        S.raf = w.requestAnimationFrame(tick);
        S.rafWin = w;
        return;
      } catch (_) { /* window closing: fall back to a timer */ }
    }
    S.raf = setTimeout(tick, 16);
  }

  function cancelFrame() {
    if (!S || !S.raf) return;
    try { if (S.rafWin) S.rafWin.cancelAnimationFrame(S.raf); else clearTimeout(S.raf); } catch (_) { /* window gone */ }
    S.raf = 0;
    S.rafWin = null;
  }

  function tick() {
    if (!S) return;
    S.raf = 0;
    S.rafWin = null;
    const t0 = performance.now();
    let active = false;
    S.csCache = new Map();
    try {
      for (const ent of S.ents.values()) {
        const due = ent.force || !ent.result || t0 < ent.activeUntil || ent.lastChanged;
        if (!due) continue;
        ent.force = false;
        let res;
        try { res = computeEntry(ent, null); } catch (e) {
          S.lastError = String(e && e.stack || e).slice(0, 400);
          res = { surface: blank(ent, 0, 0), attrs: new Map() };
        }
        applyAttrs(ent, res.attrs);
        const sig = JSON.stringify(res.surface);
        ent.lastChanged = sig !== ent.sig;
        ent.computes++;
        if (ent.lastChanged) ent.changes++;
        ent.sig = sig;
        ent.result = res.surface;
        if (t0 < ent.activeUntil || ent.lastChanged) active = true;
      }
    } finally {
      S.csCache = null;
    }
    S.structureChanged = false;
    emit();
    const ms = performance.now() - t0;
    S.ticks++;
    S.lastMs = ms;
    S.totalMs += ms;
    S.maxMs = Math.max(S.maxMs, ms);
    if (active && S.dash) schedule();
  }

  function surfacesNow() {
    const out = [];
    for (const ent of S.ents.values()) if (ent.result) out.push(ent.result);
    return out;
  }

  function emit() {
    const body = JSON.stringify(surfacesNow());
    if (body === S.lastBody) return false;
    S.lastBody = body;
    S.seq++;
    const json = '{"seq":' + S.seq + ',"surfaces":' + body + '}';
    S.last = json;
    S.emits++;
    S.lastEmitAt = Date.now();
    const bind = W[S.binding];
    if (typeof bind === 'function') {
      try { bind(json); } catch (e) { S.bindError = String(e); }
    }
    return true;
  }

  function poll() {
    if (!S) return;
    S.polls++;
    // Only while the theme is on (the daemon stops us; this covers a daemon
    // that died without doing so).
    let themeOn = true;
    try { themeOn = !!(W.__LGS && W.__LGS.state && W.__LGS.state.enabled); } catch (_) { /* keep running */ }
    S.themeOffPolls = themeOn ? 0 : (S.themeOffPolls || 0) + 1;
    if (S.themeOffPolls >= THEME_OFF_POLLS) { stop(); return; }
    try { syncWindows(); } catch (e) { S.lastError = String(e && e.stack || e).slice(0, 400); }
    refreshDash();
    if (S.polls % RESAMPLE_EVERY === 0 || S.structureChanged) for (const e of S.ents.values()) e.force = true;
    // a frame request on a window that stopped rendering must not stall us
    if (S.raf && performance.now() - S.rafAt > 250) cancelFrame();
    if (!S.dash) { if (!S.raf) S.raf = setTimeout(tick, 0); } else schedule();
  }

  // ------------------------------------------------------------ API

  let waiting = null; // {timer, tries, rules, opts} while the token index is missing

  function start(rules, opts) {
    if (S) stop();
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
      dash: true, dashPending: false, navClass: undefined,
      raf: 0, rafWin: null, rafAt: 0, timer: 0, polls: 0,
      seq: 0, emits: 0, ticks: 0, lastMs: 0, totalMs: 0, maxMs: 0,
      last: null, lastBody: null, lastEmitAt: 0, lastError: null, bindError: null,
      structureChanged: true, csCache: null, startedAt: Date.now(),
    };
    syncWindows();
    refreshDash();
    S.timer = setInterval(poll, POLL_MS);
    schedule();
    return status();
  }

  function stop() {
    if (waiting) { clearInterval(waiting.timer); waiting = null; }
    if (!S) return { running: false };
    const st = S;
    clearInterval(st.timer);
    cancelFrame();
    for (const ent of st.ents.values()) detach(ent);
    st.ents.clear();
    S = null;
    return { running: false, emits: st.emits, seq: st.seq };
  }

  // Measure now and emit even if nothing changed (after a daemon reconnect).
  function resend() {
    if (!S) return false;
    for (const e of S.ents.values()) e.force = true;
    S.lastBody = null;
    cancelFrame();
    tick();
    return S ? S.seq : false;
  }

  function status() {
    if (!S) {
      return waiting ? { running: false, version: VERSION, waiting: 'token index (theme off?)', tries: waiting.tries }
        : { running: false, version: VERSION };
    }
    const surfaces = [];
    for (const e of S.ents.values()) {
      surfaces.push({
        name: e.name, key: e.key,
        visible: !!(e.result && e.result.visible),
        layers: e.result ? e.result.layers.length : 0,
        attrs: e.applied.size,
        computes: e.computes, changes: e.changes, wakes: e.wakes,
      });
    }
    let nav = null;
    try { nav = gamepadNav(); } catch (_) { /* unknown */ }
    return {
      running: true, version: VERSION, seq: S.seq, emits: S.emits, ticks: S.ticks, polls: S.polls,
      uptimeS: Math.round((Date.now() - S.startedAt) / 100) / 10,
      lastMs: Math.round(S.lastMs * 100) / 100,
      avgMs: S.ticks ? Math.round(S.totalMs / S.ticks * 100) / 100 : 0,
      maxMs: Math.round(S.maxMs * 100) / 100,
      dashboardVisible: S.dash, gamepadNav: nav,
      binding: S.binding, bound: typeof W[S.binding] === 'function',
      lastEmitAgoMs: S.lastEmitAt ? Date.now() - S.lastEmitAt : null,
      surfaces, errors: S.errors, lastError: S.lastError, bindError: S.bindError,
    };
  }

  function snapshot() {
    if (!S) return null;
    const prev = S.csCache;
    S.csCache = new Map();
    try {
      const surfaces = [];
      for (const ent of S.ents.values()) surfaces.push(computeEntry(ent, null).surface);
      return { seq: S.seq, surfaces };
    } finally {
      S.csCache = prev;
    }
  }

  function debug(name) {
    if (!S) return null;
    const prev = S.csCache;
    S.csCache = new Map();
    try {
      const out = {};
      for (const ent of S.ents.values()) {
        if (name && ent.name !== name && ent.s.name !== name) continue;
        const why = [];
        const r = computeEntry(ent, why);
        out[ent.name] = { visible: r.surface.visible, shapes: r.surface.shapes, layers: r.surface.layers.length, why };
      }
      return out;
    } finally {
      S.csCache = prev;
    }
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

  W.__LGS_LAYERS = { version: VERSION, start, stop, resend, snapshot, status, debug, overlay };

  // The daemon sets window.__LGS_LAYERS_OPTS = {layers, binding} before
  // evaluating this file: start right away with those rules.
  const opts = W.__LGS_LAYERS_OPTS;
  if (opts && opts.layers) {
    try { start(opts.layers, opts); } catch (e) { W.__LGS_LAYERS.error = String(e && e.message || e); }
  }
  return 'lgs_layers v' + VERSION + (S ? ' running' : waiting ? ' waiting for the token index' : ' installed');
})();
