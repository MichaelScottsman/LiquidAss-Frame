// Glass Shell scene-graph compositor, evaluated inside SteamVR's systemui page
// (vrwebhelper devtools, 127.0.0.1:8090) by lgs_shell.py as
//
//   (SOURCE)({ version, watchdogMs })
//
// It installs window.__LGS_SG:
//
//   update(spec)  build / diff the injected scene-graph nodes (docs/NATIVE.md)
//   clear()       remove every injected node and push once
//   status()      counts, scheduler, push rate, attach state (JSON-safe)
//   dump()        every injected panel with its properties (debugging)
//   ping()        daemon heartbeat; without one for watchdogMs the nodes
//                 clear themselves, so a killed daemon never leaves glass
//                 covering Steam's window
//   destroy()     clear() and uninstall
//
// Per surface, back to front (z = metres toward the viewer, from the spec):
//   cover   glassd's backdrop region, the whole surface, at coverDz
//   base    Steam's texture minus the popped rects, as a guillotine mosaic of
//           crops at baseDz (pieces overlap their right/bottom neighbour by 1 px)
//   slab    glassd's slab for each popped element, at dz - 0.8 mm
//   popped  Steam's texture cropped to the element, at dz
// Every item is   reparent-to-panel(steamKey) > panel-anchor(centre u,v)
//                 > vsg-transform(0 0 z) > panel(key, uv, meters-per-pixel)
// with curvature inherit-from-parent-panel and interactive:false, so Steam's
// real panel underneath keeps the laser and controller input.
//
// Nodes live in our own <div id="lgs-sg-root"> under <vsg-app>; it is
// re-attached if a React re-render drops it. Changes reach the compositor only
// when the serializer's scheduler runs (the export of the webpack module that
// contains "update_scene_graph"; module 5723, export "my", on this build); we
// call it at most 30 times a second.
(function lgsSceneGraph(opts) {
  'use strict';
  const W = window;
  opts = opts || {};
  const VERSION = String(opts.version || 'dev');
  const MAX_PUSH_HZ = 30;
  const WATCHDOG_MS = opts.watchdogMs === undefined ? 12000 : Number(opts.watchdogMs);
  const SLAB_BEHIND = 0.0008;     // slab sits this far behind its popped crop
  const MIN_PIECE = 1;            // px; smaller mosaic slivers are dropped
  const ROOT_ID = 'lgs-sg-root';
  // true: one reparent-to-panel per surface holding every item's anchor;
  // false: one reparent-to-panel per item (the structure the spike proved).
  const SHARED_REPARENT = opts.sharedReparent !== undefined ? !!opts.sharedReparent : false;
  // Debug: {kind: [r,g,b]} wraps that kind's panels in a SteamVR tint node,
  // e.g. {base:[1,.35,.35], pop:[.35,1,.35]}, to see which copy is ours.
  const DEBUG_TINT = opts.debugTint || null;

  if (W.__LGS_SG) {
    if (W.__LGS_SG.version === VERSION && !opts.force) return JSON.stringify(W.__LGS_SG.status());
    try { W.__LGS_SG.destroy(); } catch (_) { /* stale instance */ }
  }

  // ------------------------------------------------------------ scheduler
  const sched = { module: null, push: null, retire: null, error: null };
  (function locate() {
    let req = null;
    try {
      W.webpackChunkvrwebui.push([[Symbol('lgs-sg')], {}, (r) => { req = r; }]);
    } catch (e) { sched.error = 'no webpackChunkvrwebui: ' + e.message; return; }
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
    if (!sched.push) sched.error = 'scene-graph scheduler not found';
  })();

  // ------------------------------------------------------------ state
  const st = {
    items: new Map(),          // key -> item
    root: null,
    M: 0,
    MSource: '',
    pushes: 0,
    pushTimes: [],
    lastPush: 0,
    pushTimer: 0,
    reattaches: 0,
    wasAttached: false,
    lastContact: Date.now(),
    expired: false,
    updates: 0,
    lastSpecAt: 0,
    lastSummary: null,
    errors: [],
    tick: 0,
    destroyed: false,
  };

  function note(msg) {
    st.errors.push(new Date().toISOString().slice(11, 19) + ' ' + msg);
    if (st.errors.length > 8) st.errors.shift();
  }

  function nextSgid() {
    try { if (W.VRHTML && VRHTML.NextSGID) return VRHTML.NextSGID(); } catch (_) { /* fall through */ }
    return 900000000 + Math.floor(Math.random() * 1e8);
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

  // Keep our root under the live <vsg-app>; true if it is attached.
  function ensureAttached() {
    const app = document.querySelector('vsg-app');
    if (!app) return false;
    const root = rootEl();
    if (root.parentNode !== app) {
      if (st.wasAttached && st.items.size) {   // dropped by a re-render
        st.reattaches++;
        note('root re-attached');
      }
      app.appendChild(root);
      st.wasAttached = true;
      if (st.items.size) schedulePush();
    }
    return true;
  }

  // ------------------------------------------------------------ pushing
  function pushNow() {
    st.pushTimer = 0;
    if (!sched.push) return;
    try {
      sched.push();
      const t = Date.now();
      st.pushes++;
      st.lastPush = t;
      st.pushTimes.push(t);
      while (st.pushTimes.length && t - st.pushTimes[0] > 1000) st.pushTimes.shift();
    } catch (e) { note('push: ' + e.message); }
  }

  function schedulePush() {
    if (st.pushTimer || st.destroyed) return;
    const wait = Math.max(0, st.lastPush + 1000 / MAX_PUSH_HZ - Date.now());
    st.pushTimer = setTimeout(pushNow, wait);
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

  // desc: { kind, parentKey, u, v, z, key, uv:[u0,v0,u1,v1], mpp, name }
  function panelProps(d) {
    return {
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

  function createItem(d) {
    const panel = vnode('panel', panelProps(d));
    const xf = vtransform(r6(d.z));
    if (DEBUG_TINT && DEBUG_TINT[d.kind]) {
      const tint = vnode('tint', { color: DEBUG_TINT[d.kind] });
      tint.appendChild(panel);
      xf.appendChild(tint);
    } else {
      xf.appendChild(panel);
    }
    const anchor = vnode('panel-anchor', { 'anchor-u': r6(d.u), 'anchor-v': r6(d.v) });
    anchor.appendChild(xf);
    if (SHARED_REPARENT) {
      const g = groupFor(d.parentKey);
      g.top.appendChild(anchor);
      g.n++;
      return { d, top: null, anchor, xf, panel, sig: sigOf(d), group: d.parentKey };
    }
    const top = vnode('reparent-to-panel', { 'parent-overlay-key': d.parentKey });
    top.appendChild(anchor);
    rootEl().appendChild(top);
    return { d, top, anchor, xf, panel, sig: sigOf(d) };
  }

  function sigOf(d) {
    return [d.parentKey, r6(d.u), r6(d.v), r6(d.z), d.key, d.uv.map(r6).join(','), d.mpp, d.name].join('|');
  }

  // Update in place; true if anything changed.
  function updateItem(it, d) {
    const sig = sigOf(d);
    if (sig === it.sig) return false;
    it.sig = sig;
    it.d = d;
    if (it.top) it.top.__lgsProps = { 'parent-overlay-key': d.parentKey };
    it.anchor.__lgsProps = { 'anchor-u': r6(d.u), 'anchor-v': r6(d.v) };
    const t = '0 0 ' + r6(d.z);
    if (it.xf.getAttribute('translation') !== t) it.xf.setAttribute('translation', t);
    it.panel.__lgsProps = panelProps(d);
    return true;
  }

  function retire(els) {
    if (!sched.retire) return;
    for (const el of els) {
      try { sched.retire(el.__lgsSgid); } catch (_) { /* best effort */ }
    }
  }

  function removeItem(it) {
    if (it.top) {
      it.top.remove();
      retire([it.top, it.anchor, it.xf, it.panel]);
      return;
    }
    it.anchor.remove();
    retire([it.anchor, it.xf, it.panel]);
    const g = groups.get(it.group);
    if (g && --g.n <= 0) {
      g.top.remove();
      retire([g.top]);
      groups.delete(it.group);
    }
  }

  // ------------------------------------------------------------ geometry
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
    // Across a band cut one of the two neighbours always qualifies.
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

  function num(v, dflt) { const n = Number(v); return Number.isFinite(n) ? n : dflt; }

  // Spec surface -> item descriptors.
  function describe(s, M, want, counts) {
    const key = String(s.steamKey);
    const Wd = Math.round(num(s.texW, 0)), Ht = Math.round(num(s.texH, 0));
    const g = s.glassd;
    if (!Wd || !Ht || !g || !g.key || !Array.isArray(g.backdrop)) return;
    const scale = num(g.scale, 0.75) || 0.75;
    const coverDz = num(s.coverDz, 0.001), baseDz = num(s.baseDz, 0.002);
    const short = key.replace(/^valve\.steam\.gamepadui\./, '');
    const add = (k, d) => { want.set(key + '#' + k, Object.assign({ parentKey: key }, d)); counts[d.kind] = (counts[d.kind] || 0) + 1; };

    add('cover', { kind: 'cover', px: [Wd, Ht], u: 0.5, v: 0.5, z: coverDz, key: g.key, uv: g.backdrop.map(Number), mpp: M / scale, name: 'lgs:cover:' + short });

    const holes = [];
    const seen = new Set();
    for (const p of Array.isArray(s.popped) ? s.popped : []) {
      if (!p || p.id === undefined || seen.has(String(p.id))) continue;
      const x = num(p.x, NaN), y = num(p.y, NaN), w = num(p.w, 0), h = num(p.h, 0);
      if (!(w > 0 && h > 0) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
      const x1 = Math.min(Wd, Math.round(x + w)), y1 = Math.min(Ht, Math.round(y + h));
      if (x1 - x0 < 2 || y1 - y0 < 2) continue;   // scrolled out of the surface
      seen.add(String(p.id));
      holes.push({ x0, y0, x1, y1 });
      const dz = num(p.dz, 0.012);
      const id = String(p.id);
      add('pop:' + id, {
        kind: 'pop', px: [x1 - x0, y1 - y0], u: (x0 + x1) / 2 / Wd, v: (y0 + y1) / 2 / Ht, z: dz,
        key, uv: [x0 / Wd, y0 / Ht, x1 / Wd, y1 / Ht], mpp: M, name: 'lgs:pop:' + short + ':' + id,
      });
      if (Array.isArray(p.slab) && p.slab.length === 4) {
        // The slab is the element's full rect; crop it like the element was.
        const [s0, t0, s1, t1] = p.slab.map(Number);
        const fx0 = (x0 - x) / w, fx1 = (x1 - x) / w, fy0 = (y0 - y) / h, fy1 = (y1 - y) / h;
        add('slab:' + id, {
          kind: 'slab', px: [x1 - x0, y1 - y0], u: (x0 + x1) / 2 / Wd, v: (y0 + y1) / 2 / Ht, z: dz - SLAB_BEHIND,
          key: g.key, uv: [s0 + (s1 - s0) * fx0, t0 + (t1 - t0) * fy0, s0 + (s1 - s0) * fx1, t0 + (t1 - t0) * fy1],
          mpp: M / scale, name: 'lgs:slab:' + short + ':' + id,
        });
      }
    }

    guillotine(Wd, Ht, holes).forEach((p, i) => {
      add('base:' + i, {
        kind: 'base', px: [p.x1 - p.x0, p.y1 - p.y0], u: (p.x0 + p.x1) / 2 / Wd, v: (p.y0 + p.y1) / 2 / Ht, z: baseDz,
        key, uv: [p.x0 / Wd, p.y0 / Ht, p.x1 / Wd, p.y1 / Ht], mpp: M, name: 'lgs:base:' + short + ':' + i,
      });
    });
  }

  // ------------------------------------------------------------ API
  function update(spec) {
    if (st.destroyed) return { error: 'destroyed' };
    st.lastContact = Date.now();
    st.expired = false;
    st.updates++;
    st.lastSpecAt = Date.now();
    spec = spec || {};
    let M = num(spec.M, 0);
    if (M > 0) { st.M = M; st.MSource = 'spec'; } else {
      if (!st.M) { st.M = readM(); st.MSource = st.M ? 'PooledPopup' : ''; }
      M = st.M;
    }
    const want = new Map();
    const counts = {};
    if (M > 0) {
      for (const s of Array.isArray(spec.surfaces) ? spec.surfaces : []) {
        if (!s || !s.steamKey || s.visible === false) continue;
        try { describe(s, M, want, counts); } catch (e) { note('describe ' + s.steamKey + ': ' + e.message); }
      }
    } else if ((spec.surfaces || []).length) {
      note('no meters-per-pixel yet (no PooledPopup panel); nothing built');
    }
    const attached = ensureAttached();
    let dirty = false;
    for (const [k, it] of st.items) {
      if (!want.has(k)) { removeItem(it); st.items.delete(k); dirty = true; }
    }
    for (const [k, d] of want) {
      const it = st.items.get(k);
      if (!it) { st.items.set(k, createItem(d)); dirty = true; } else if (updateItem(it, d)) dirty = true;
    }
    if (dirty) schedulePush();
    st.lastSummary = { items: st.items.size, counts, changed: dirty, attached, M };
    return st.lastSummary;
  }

  function clear() {
    for (const it of st.items.values()) removeItem(it);
    st.items.clear();
    if (st.root && st.root.parentNode) st.root.remove();
    st.wasAttached = false;
    if (st.pushTimer) { clearTimeout(st.pushTimer); st.pushTimer = 0; }
    pushNow();
    return true;
  }

  function ping() {
    st.lastContact = Date.now();
    if (st.expired) st.expired = false;
    return st.items.size;
  }

  function status() {
    const counts = {};
    for (const it of st.items.values()) counts[it.d.kind] = (counts[it.d.kind] || 0) + 1;
    const app = document.querySelector('vsg-app');
    const surfaces = [...new Set([...st.items.values()].map((it) => it.d.parentKey))];
    return {
      version: VERSION,
      sharedReparent: SHARED_REPARENT,
      scheduler: { module: sched.module, push: !!sched.push, retire: !!sched.retire, error: sched.error },
      attached: !!(st.root && app && st.root.parentNode === app),
      M: st.M, MSource: st.MSource,
      surfaces,
      items: st.items.size,
      panels: counts,
      nodes: st.root ? st.root.querySelectorAll('*').length : 0,
      pushes: st.pushes,
      pushesLastSec: st.pushTimes.filter((t) => Date.now() - t <= 1000).length,
      lastPushMsAgo: st.lastPush ? Date.now() - st.lastPush : null,
      updates: st.updates,
      lastContactMsAgo: Date.now() - st.lastContact,
      watchdogMs: WATCHDOG_MS,
      expired: st.expired,
      reattaches: st.reattaches,
      errors: st.errors.slice(),
    };
  }

  function dump() {
    return [...st.items.entries()].map(([k, it]) => ({
      k, kind: it.d.kind, parent: it.d.parentKey, anchor: [r6(it.d.u), r6(it.d.v)], z: r6(it.d.z),
      key: it.d.key, uv: it.d.uv.map(r6), mpp: it.d.mpp,
      px: it.d.px, sizeM: it.d.px ? [r6(it.d.px[0] * st.M), r6(it.d.px[1] * st.M)] : null,
      sgids: [it.top ? it.top.__lgsSgid : null, it.anchor.__lgsSgid, it.xf.__lgsSgid, it.panel.__lgsSgid],
      connected: it.anchor.isConnected,
    }));
  }

  function destroy() {
    clear();
    st.destroyed = true;
    clearInterval(st.tick);
    if (W.__LGS_SG === api) delete W.__LGS_SG;
    return true;
  }

  // Housekeeping: re-attach after React re-renders, heartbeat watchdog.
  st.tick = setInterval(() => {
    if (st.destroyed) return;
    if (st.items.size) ensureAttached();
    if (WATCHDOG_MS > 0 && st.items.size && Date.now() - st.lastContact > WATCHDOG_MS) {
      note('no heartbeat for ' + WATCHDOG_MS + ' ms: cleared');
      clear();
      st.expired = true;
    }
  }, 500);

  const api = { version: VERSION, update, clear, status, dump, ping, destroy, guillotine };
  W.__LGS_SG = api;
  return JSON.stringify(status());
});
