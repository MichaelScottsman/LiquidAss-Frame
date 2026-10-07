// Glass Shell runtime core (P1): window.__LGS_RT in Steam's SharedJSContext.
//
// lgs.py evaluates this file first (with __LGS_RT_CONFIG in scope), then every
// device/shared/*.js and device/rt/NN-*.js file in name order, each in its own
// CDP evaluation, and finally `await __LGS_RT.start()`. Each module file calls
//
//   __LGS_RT.define({name, deps, flag, install(rt), remove()})
//
// and does nothing else at load time. start() installs the enabled modules in
// dependency order; `lgs off` (or the liveness watch) removes them in reverse
// order. A module that throws is marked failed; the theme and every other
// module keep working. Nothing here is written to disk or to web storage: a
// Steam restart or a reboot always returns the stock UI.
//
// Interface: docs/phase2/contracts/runtime.md (P1).
(function lgsRuntimeBoot(CONFIG) {
  'use strict';
  const W = window;
  const VERSION = 1;
  const LOG_MAX = 300;
  const INSTALL_TIMEOUT_MS = 5000;
  const REMOVE_TIMEOUT_MS = 3000;
  const TICK_MS = 250;               // liveness + window reconcile poll
  const LIVENESS_MS = 2000;          // html.lgs-on gone from main this long -> remove everything
  const TEST_TTL_MS = 300000;        // test hooks expire on their own (a crashed lab step)
  const OWN_GLOBALS = new Set(['__LGS_RT', '__LGS', '__LGS_INDEX', '__LGS_LAB', '__LGS_RT_CONFIG']);
  const LGS_GLOBAL = /^_*lgs/i;
  const T0 = Date.now();
  const now = () => (W.performance ? W.performance.now() : Date.now());

  CONFIG = CONFIG || {};

  // A previous instance (manual re-evaluation): tear it down first. lgs.py
  // already awaits teardown before booting, so this is only a safety net.
  const prev = W.__LGS_RT;
  if (prev && prev !== undefined && typeof prev.teardown === 'function') {
    try { prev.teardown('replaced by a new runtime'); } catch (_) { /* stale */ }
  }

  // ------------------------------------------------------------------ log
  const ring = [];
  function log(level, mod, msg, data) {
    const e = { t: Date.now() - T0, level, mod: mod || 'rt', msg: String(msg) };
    if (data !== undefined) {
      try { e.data = JSON.parse(JSON.stringify(data)); } catch (_) { e.data = String(data); }
    }
    ring.push(e);
    if (ring.length > LOG_MAX) ring.splice(0, ring.length - LOG_MAX);
    if (level === 'error') { try { W.console.warn('[lgs-rt]', e.mod + ':', e.msg); } catch (_) { /* no console */ } }
    return e;
  }
  const errText = (e) => {
    if (!e) return 'unknown error';
    const s = (e && e.stack) ? String(e.stack) : String(e);
    return s.length > 800 ? s.slice(0, 800) + '…' : s;
  };

  // ------------------------------------------------------------------ events
  function emitter() {
    const subs = new Map();
    return {
      on(ev, fn) {
        let s = subs.get(ev);
        if (!s) subs.set(ev, s = new Set());
        const rec = { fn };
        s.add(rec);
        return () => s.delete(rec);
      },
      emit(ev, ...args) {
        const s = subs.get(ev);
        if (!s) return;
        for (const rec of [...s]) {
          try { rec.fn(...args); } catch (e) { log('error', 'rt', `listener for ${ev} threw`, errText(e)); }
        }
      },
      count() { let n = 0; for (const s of subs.values()) n += s.size; return n; },
      clear() { subs.clear(); },
    };
  }
  const bus = emitter();

  // ------------------------------------------------------------------ globals tracking
  function lgsGlobals() {
    const out = new Set();
    try { for (const k of Object.getOwnPropertyNames(W)) if (LGS_GLOBAL.test(k)) out.add(k); } catch (_) { /* proxy */ }
    return out;
  }
  const trackedGlobals = new Set();
  function trackNewGlobals(before, owner) {
    for (const k of lgsGlobals()) {
      if (!before.has(k) && !OWN_GLOBALS.has(k)) { trackedGlobals.add(k); log('info', owner, `defines global ${k}`); }
    }
  }

  // ------------------------------------------------------------------ flags
  // Layers, lowest first: builtin (lgs.py's table), defaults (device/defaults.json),
  // session (/tmp/lgs/flags.json), cli (`lgs on --flags`), then test overlays.
  const FALLBACK_BUILTIN = { rt: true, native: 'auto', interactivePops: false, pointerProxy: 'native', haptics: false };
  const layers = {
    builtin: Object.assign({}, FALLBACK_BUILTIN, CONFIG.builtin || {}),
    defaults: Object.assign({}, CONFIG.defaults || {}),
    session: Object.assign({}, CONFIG.session || {}),
    cli: Object.assign({}, CONFIG.cli || {}),
  };
  const overlays = [];   // [{token, obj, timer, until}]
  let overlaySeq = 0;
  const TOKEN_BASE = 'f' + (T0 % 2176782336).toString(36) + '.';   // unique per runtime instance
  let flagCache = null;

  function effective() {
    if (flagCache) return flagCache;
    const out = {}, src = {};
    for (const name of ['builtin', 'defaults', 'session', 'cli']) {
      for (const k of Object.keys(layers[name])) { out[k] = layers[name][k]; src[k] = name; }
    }
    for (const o of overlays) for (const k of Object.keys(o.obj)) { out[k] = o.obj[k]; src[k] = 'test'; }
    flagCache = { values: out, sources: src };
    return flagCache;
  }
  function truthy(v) {
    if (v === undefined || v === null || v === false || v === 0 || v === '') return false;
    if (typeof v === 'string' && /^(off|false|no|0|none)$/i.test(v)) return false;
    return true;
  }
  function flagsChanged(reason) {
    const before = flagCache ? flagCache.values : {};
    flagCache = null;
    const after = effective().values;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changed = [];
    for (const k of keys) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
    }
    if (!changed.length) return [];
    log('info', 'rt', `flags changed (${reason}): ${changed.join(', ')}`);
    for (const k of changed) bus.emit('flag:' + k, after[k], before[k], k);
    bus.emit('flags', changed, after);
    if (started && !stopping) schedule('flags');
    return changed;
  }

  const flags = {
    get(name) { return effective().values[name]; },
    enabled(name) { return truthy(effective().values[name]); },
    all() { return Object.assign({}, effective().values); },
    sources() { return Object.assign({}, effective().sources); },
    layer(name) { return layers[name] ? Object.assign({}, layers[name]) : undefined; },
    // Replace the session layer (lgs.py calls this for `lgs flags name=value`).
    setSession(obj) { layers.session = Object.assign({}, obj || {}); return flagsChanged('session'); },
    on(name, fn) { return bus.on('flag:' + name, fn); },
    onAny(fn) { return bus.on('flags', fn); },
    truthy,
  };

  // ------------------------------------------------------------------ windows
  // One popup-created and one popup-destroyed callback for the whole runtime;
  // modules subscribe through rt.windows.
  const KEY_PREFIX = 'valve.steam.gamepadui.';
  const entries = new Map();   // Window -> entry
  const winSubs = { add: new Set(), remove: new Set(), show: new Set(), hide: new Set() };
  let pmCreated = null, pmDestroyed = null;
  const readyWaits = new Set();

  function keyFromName(n) {
    if (/^VR_uid/.test(n)) return KEY_PREFIX + 'main';
    if (/^VRKeyboard_uid/.test(n)) return KEY_PREFIX + 'keyboard';
    if (/^VRNotificationToasts_uid/.test(n)) return KEY_PREFIX + 'notifications';
    return n.replace(/_uid\d+$/, '').replace(/\.\d+$/, '');
  }
  function kindOf(key) {
    let k = key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : key;
    k = k.replace(/(\.\d+)+$/, '');
    return k || key;
  }
  function popupObjects() {
    const out = [];
    let pm;
    try { pm = W.g_PopupManager; } catch (_) { return out; }
    if (!pm) return out;
    try {
      const vals = pm.m_mapPopups ? [...pm.m_mapPopups.values()] : (pm.GetPopups ? [...pm.GetPopups()] : []);
      for (const p of vals) out.push(p);
    } catch (_) { /* popup manager not ready */ }
    return out;
  }
  function winOf(p) {
    try {
      const w = p.window;
      if (!w || w.closed || !w.document || !w.document.documentElement || !w.document.body) return null;
      return w;
    } catch (_) { return null; }
  }
  function describe(p, w) {
    let key = '';
    try { key = (p.params && p.params.strVROverlayKey) || ''; } catch (_) { /* no params */ }
    const name = String(p.m_strName || '');
    if (!key) key = keyFromName(name);
    const doc = w.document;
    return {
      win: w, doc, html: doc.documentElement, key, kind: kindOf(key), name, popup: p,
      visible() { try { return doc.visibilityState === 'visible'; } catch (_) { return false; } },
    };
  }
  // Steam pools its popups (bar popups, tooltip, frame menus): opening the "+"
  // list shows an existing window rather than creating one. Its document's
  // visibilitychange is the "opened" signal: rt.windows.onShow / onHide.
  function fireVis(e) {
    const set = e.visible() ? winSubs.show : winSubs.hide;
    for (const s of [...set]) {
      try { s(e); } catch (err) { log('error', 'rt', 'windows.onShow/onHide listener threw', errText(err)); }
    }
  }
  function fireAdd(e) {
    for (const s of [...winSubs.add]) {
      try { s(e); } catch (err) { log('error', 'rt', 'windows.onAdd listener threw', errText(err)); }
    }
  }
  function fireRemove(e) {
    for (const s of [...winSubs.remove]) {
      try { s(e); } catch (err) { log('error', 'rt', 'windows.onRemove listener threw', errText(err)); }
    }
  }
  function addPopup(p) {
    const w = winOf(p);
    if (!w || entries.has(w)) return null;
    const e = describe(p, w);
    e._vis = () => fireVis(e);
    try { e.doc.addEventListener('visibilitychange', e._vis); } catch (_) { /* closing */ }
    entries.set(w, e);
    fireAdd(e);
    return e;
  }
  function removeWin(w) {
    const e = entries.get(w);
    if (!e) return;
    entries.delete(w);
    try { e.doc.removeEventListener('visibilitychange', e._vis); } catch (_) { /* gone */ }
    fireRemove(e);
  }
  // A created popup has no document yet: wait for its body (≤ 5 s).
  function whenReady(p) {
    let tries = 0;
    const tick = () => {
      readyWaits.delete(timer);
      if (stopping || !started) return;
      if (winOf(p)) { addPopup(p); return; }
      if (++tries < 100) { timer = W.setTimeout(tick, 50); readyWaits.add(timer); }
    };
    let timer = W.setTimeout(tick, 0);
    readyWaits.add(timer);
  }
  function reconcileWindows() {
    const live = new Set();
    for (const p of popupObjects()) {
      const w = winOf(p);
      if (!w) continue;
      live.add(w);
      if (!entries.has(w)) addPopup(p);
    }
    for (const w of [...entries.keys()]) if (!live.has(w)) removeWin(w);
  }
  function hookPopupManager() {
    let pm;
    try { pm = W.g_PopupManager; } catch (_) { pm = null; }
    if (!pm) return;
    try {
      pmCreated = pm.AddPopupCreatedCallback((p) => whenReady(p));
    } catch (e) { log('warn', 'rt', 'AddPopupCreatedCallback failed; the poll covers new windows', errText(e)); }
    try {
      if (typeof pm.AddPopupDestroyedCallback === 'function') {
        pmDestroyed = pm.AddPopupDestroyedCallback((p) => {
          let w = null;
          try { w = p.window; } catch (_) { /* gone */ }
          if (w && entries.has(w)) { removeWin(w); return; }
          for (const [ww, e] of entries) if (e.popup === p) { removeWin(ww); return; }
        });
      }
    } catch (e) { log('warn', 'rt', 'AddPopupDestroyedCallback failed; the poll covers closed windows', errText(e)); }
  }
  function unhookPopupManager() {
    for (const h of [pmCreated, pmDestroyed]) {
      if (!h) continue;
      try {
        if (typeof h.Unregister === 'function') h.Unregister();
        else if (typeof h.Unsubscribe === 'function') h.Unsubscribe();
      } catch (_) { /* gone */ }
    }
    pmCreated = pmDestroyed = null;
    for (const t of readyWaits) W.clearTimeout(t);
    readyWaits.clear();
  }

  // Module-independent window API (scoped variants are built per module).
  function windowsApi(track) {
    const api = {
      list() { return [...entries.values()]; },
      each(fn) {
        for (const e of [...entries.values()]) {
          try { fn(e); } catch (err) { log('error', 'rt', 'windows.each callback threw', errText(err)); }
        }
      },
      main() { for (const e of entries.values()) if (e.kind === 'main') return e; return null; },
      byKind(kind) { return [...entries.values()].filter((e) => e.kind === kind); },
      find(win) { return entries.get(win) || null; },
      onAdd(fn) { winSubs.add.add(fn); return track(() => winSubs.add.delete(fn)); },
      onRemove(fn) { winSubs.remove.add(fn); return track(() => winSubs.remove.delete(fn)); },
      onShow(fn) { winSubs.show.add(fn); return track(() => winSubs.show.delete(fn)); },
      onHide(fn) { winSubs.hide.add(fn); return track(() => winSubs.hide.delete(fn)); },
      // fn(entry) for every current and future window. It may return a cleanup
      // function, called when the window closes or the subscription ends.
      track(fn) {
        const cleanups = new Map();
        const run = (e) => {
          if (cleanups.has(e.win)) return;
          let c = null;
          try { c = fn(e); } catch (err) { log('error', 'rt', 'windows.track callback threw', errText(err)); }
          cleanups.set(e.win, typeof c === 'function' ? c : null);
        };
        const done = (e) => {
          if (!cleanups.has(e.win)) return;
          const c = cleanups.get(e.win);
          cleanups.delete(e.win);
          if (c) { try { c(e); } catch (err) { log('error', 'rt', 'windows.track cleanup threw', errText(err)); } }
        };
        winSubs.add.add(run);
        winSubs.remove.add(done);
        for (const e of [...entries.values()]) run(e);
        return track(() => {
          winSubs.add.delete(run);
          winSubs.remove.delete(done);
          for (const [w, c] of [...cleanups]) {
            cleanups.delete(w);
            if (c) { try { c(entries.get(w) || { win: w }); } catch (err) { log('error', 'rt', 'windows.track cleanup threw', errText(err)); } }
          }
        });
      },
    };
    return api;
  }

  // ------------------------------------------------------------------ bridge
  // Daemon -> page messages (P8): __LGS_RT.bridge.set('geom', {...}).
  const bridgeStore = new Map();
  const bridge = {
    set(key, value) {
      const json = (() => { try { return JSON.stringify(value); } catch (_) { return String(Math.random()); } })();
      const cur = bridgeStore.get(key);
      const t = Date.now();
      if (cur && cur.json === json) { cur.t = t; return false; }
      bridgeStore.set(key, { value, json, t });
      bus.emit('bridge:' + key, value, cur ? cur.value : undefined, key);
      return true;
    },
    get(key) { const c = bridgeStore.get(key); return c ? c.value : undefined; },
    age(key) { const c = bridgeStore.get(key); return c ? Date.now() - c.t : Infinity; },
    keys() { return [...bridgeStore.keys()]; },
    on(key, fn) { return bus.on('bridge:' + key, fn); },
  };

  // ------------------------------------------------------------------ registry
  const mods = new Map();      // name -> rec, in definition order
  let defSeq = 0;
  let loadingFile = null;
  let loadingBefore = null;
  let started = false, stopping = false, stopped = false;
  let chain = Promise.resolve();
  const failedLoads = [];      // {file, error}: files that failed before define()
  const shared = {};

  function define(def) {
    const file = loadingFile || (def && def.file) || '(inline)';
    if (!def || typeof def !== 'object' || typeof def.name !== 'string' || !def.name) {
      const err = 'define() needs {name, install}';
      failedLoads.push({ file, error: err });
      log('error', 'rt', `${file}: ${err}`);
      return false;
    }
    if (stopping || stopped) { log('warn', def.name, 'define() after teardown ignored'); return false; }
    const name = def.name;
    if (mods.has(name)) {
      const err = `duplicate module name (already defined by ${mods.get(name).file})`;
      failedLoads.push({ file, name, error: err });
      log('error', name, err);
      return false;
    }
    const rec = {
      name, file, def, seq: defSeq++,
      deps: Array.isArray(def.deps) ? def.deps.filter((d) => typeof d === 'string') : [],
      flag: typeof def.flag === 'string' && def.flag ? def.flag : null,
      state: 'defined', reason: null, error: null, api: undefined, scope: null,
      installMs: null, removeMs: null, report: null, installs: 0,
    };
    if (typeof def.install !== 'function') {
      rec.state = 'failed'; rec.error = 'define(): install is not a function';
    }
    mods.set(name, rec);
    log('info', name, `defined (${file})`);
    if (started && !stopping) schedule('define');
    return true;
  }

  function withTimeout(v, ms, what) {
    if (!v || typeof v.then !== 'function') return Promise.resolve(v);
    return new Promise((res, rej) => {
      const t = W.setTimeout(() => rej(new Error(`${what} timed out after ${ms} ms`)), ms);
      v.then((x) => { W.clearTimeout(t); res(x); }, (e) => { W.clearTimeout(t); rej(e); });
    });
  }

  // Per-module facade: everything subscribed through it is undone on removal,
  // even if the module's own remove() forgets.
  function makeScope(rec) {
    const cleanups = [];
    const track = (fn) => {
      let done = false;
      const off = () => { if (done) return; done = true; try { fn(); } catch (e) { log('error', rec.name, 'cleanup threw', errText(e)); } };
      cleanups.push(off);
      return off;
    };
    const scope = Object.create(rt);
    scope.name = rec.name;
    scope.module = rec.name;
    scope.log = (msg, data) => log('info', rec.name, msg, data);
    scope.warn = (msg, data) => log('warn', rec.name, msg, data);
    scope.error = (msg, data) => log('error', rec.name, msg, data);
    scope.cleanup = (fn) => track(fn);
    scope.on = (ev, fn) => track(bus.on(ev, fn));
    scope.listen = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      return track(() => { try { target.removeEventListener(type, fn, opts); } catch (_) { /* window gone */ } });
    };
    scope.setTimeout = (fn, ms) => {
      let off = null;
      const id = W.setTimeout(() => { if (off) off(); try { fn(); } catch (e) { log('error', rec.name, 'timer threw', errText(e)); } }, ms);
      off = track(() => W.clearTimeout(id));
      return off;
    };
    scope.setInterval = (fn, ms) => {
      const id = W.setInterval(() => { try { fn(); } catch (e) { log('error', rec.name, 'interval threw', errText(e)); } }, ms);
      return track(() => W.clearInterval(id));
    };
    scope.windows = windowsApi(track);
    scope.flags = Object.assign(Object.create(flags), {
      on: (name, fn) => track(flags.on(name, fn)),
      onAny: (fn) => track(flags.onAny(fn)),
    });
    scope.bridge = Object.assign(Object.create(bridge), {
      on: (key, fn) => track(bridge.on(key, fn)),
    });
    scope._dispose = () => {
      while (cleanups.length) { const off = cleanups.pop(); off(); }
    };
    scope._count = () => cleanups.length;
    return scope;
  }

  function topoOrder() {
    const out = [], seen = new Set(), visiting = new Set();
    const list = [...mods.values()].sort((a, b) => a.seq - b.seq);
    const visit = (rec, path) => {
      if (seen.has(rec.name)) return;
      if (visiting.has(rec.name)) { rec.cycle = path.concat(rec.name).join(' -> '); return; }
      visiting.add(rec.name);
      for (const d of rec.deps) { const dr = mods.get(d); if (dr) visit(dr, path.concat(rec.name)); }
      visiting.delete(rec.name);
      seen.add(rec.name);
      out.push(rec);
    };
    for (const rec of list) visit(rec, []);
    return out;
  }

  // What should be installed, and why not.
  function plan() {
    const order = topoOrder();
    const want = new Map();
    for (const rec of order) {
      let why = null;
      if (rec.state === 'failed') why = 'failed';
      else if (rec.cycle) why = `dependency cycle: ${rec.cycle}`;
      else if (rec.flag && !flags.enabled(rec.flag)) why = `flag ${rec.flag} is off`;
      else {
        for (const d of rec.deps) {
          if (!mods.has(d)) { why = `missing dependency ${d}`; break; }
          if (!want.get(d)) { why = `dependency ${d} is not installed`; break; }
        }
      }
      want.set(rec.name, !why);
      if (why && rec.state !== 'failed') rec.reason = why;
    }
    return { order, want };
  }

  async function installRec(rec) {
    rec.state = 'installing';
    rec.reason = null;
    const scope = makeScope(rec);
    rec.scope = scope;
    const before = lgsGlobals();
    const t0 = now();
    try {
      rec.api = await withTimeout(rec.def.install(scope), INSTALL_TIMEOUT_MS, 'install()');
      rec.state = 'installed';
      rec.installs++;
      rec.installMs = Math.round((now() - t0) * 10) / 10;
      log('info', rec.name, `installed in ${rec.installMs} ms`);
      bus.emit('module', rec.name, 'installed');
    } catch (e) {
      rec.state = 'failed';
      rec.error = errText(e);
      rec.installMs = Math.round((now() - t0) * 10) / 10;
      log('error', rec.name, 'install() threw; module marked failed', rec.error);
      // Undo what a partial install did: remove() must be safe after a partial install.
      if (typeof rec.def.remove === 'function') {
        try { await withTimeout(rec.def.remove(), REMOVE_TIMEOUT_MS, 'remove()'); } catch (e2) { log('error', rec.name, 'remove() after failed install threw', errText(e2)); }
      }
      scope._dispose();
      rec.scope = null;
      rec.api = undefined;
      bus.emit('module', rec.name, 'failed');
    }
    trackNewGlobals(before, rec.name);
  }

  async function removeRec(rec, reason) {
    if (rec.state !== 'installed') return null;
    rec.state = 'removing';
    const t0 = now();
    let report = null, error = null;
    if (typeof rec.def.remove === 'function') {
      try { report = await withTimeout(rec.def.remove(), REMOVE_TIMEOUT_MS, 'remove()'); } catch (e) { error = errText(e); log('error', rec.name, 'remove() threw', error); }
    }
    if (rec.scope) { rec.scope._dispose(); rec.scope = null; }
    rec.api = undefined;
    rec.removeMs = Math.round((now() - t0) * 10) / 10;
    rec.report = (report && typeof report === 'object') ? report : (report === undefined ? null : report);
    rec.state = stopping ? 'removed' : 'off';
    rec.reason = reason || null;
    if (error) rec.removeError = error;
    log('info', rec.name, `removed (${reason || 'off'}) in ${rec.removeMs} ms`);
    bus.emit('module', rec.name, 'removed');
    return { report: rec.report, error };
  }

  async function reconcile() {
    if (!started || stopping) return;
    const { order, want } = plan();
    // Remove first, dependents before their dependencies.
    for (const rec of [...order].reverse()) {
      if (rec.state === 'installed' && !want.get(rec.name)) await removeRec(rec, rec.reason || 'not wanted');
    }
    for (const rec of order) {
      if (stopping) return;
      if (want.get(rec.name) && rec.state !== 'installed' && rec.state !== 'failed') {
        // A dependency may have failed during this pass.
        const bad = rec.deps.find((d) => !mods.get(d) || mods.get(d).state !== 'installed');
        if (bad) { rec.state = 'blocked'; rec.reason = `dependency ${bad} is not installed`; continue; }
        await installRec(rec);
      } else if (!want.get(rec.name) && rec.state !== 'failed' && rec.state !== 'installed') {
        rec.state = rec.reason && rec.reason.startsWith('flag') ? 'off' : 'blocked';
      }
    }
  }
  function schedule(why) {
    const p = chain.then(() => reconcile()).catch((e) => log('error', 'rt', `reconcile (${why}) threw`, errText(e)));
    chain = p;
    return p;
  }

  // ------------------------------------------------------------------ liveness
  // A MutationObserver on main's <html> class stamps the moment html.lgs-on
  // goes; the 250 ms tick acts once it has been gone for 2 s (≤ 2.25 s total).
  let tick = null, missingSince = 0, ticks = 0, mo = null, moHtml = null, tickMs = 0, mainCache = null;
  function watchMain(main) {
    if (moHtml === main.html) return;
    if (mo) { try { mo.disconnect(); } catch (_) { /* gone */ } mo = null; }
    moHtml = main.html;
    try {
      const MO = main.win.MutationObserver || W.MutationObserver;
      if (!MO) return;
      mo = new MO(() => {
        try { if (!moHtml.classList.contains('lgs-on')) { if (!missingSince) missingSince = Date.now(); } else missingSince = 0; } catch (_) { /* closing */ }
      });
      mo.observe(main.html, { attributes: true, attributeFilter: ['class'] });
    } catch (_) { mo = null; }
  }
  function onTick() {
    const t0 = now();
    try { tickBody(); } finally { tickMs += now() - t0; }
  }
  function tickBody() {
    if (!started || stopping) return;
    ticks++;
    if (ticks % 8 === 0) { try { reconcileWindows(); } catch (_) { /* next tick */ } }
    let main = (mainCache && entries.get(mainCache.win) === mainCache) ? mainCache : null;
    if (!main) {
      for (const e of entries.values()) if (e.kind === 'main') { main = e; break; }
      mainCache = main;
    }
    if (!main) { if (ticks % 2 === 0) { try { reconcileWindows(); } catch (_) { /* later */ } } return; }
    watchMain(main);
    let on = false;
    try { on = main.html.classList.contains('lgs-on'); } catch (_) { return; }
    if (on) { missingSince = 0; return; }
    const t = Date.now();
    if (!missingSince) { missingSince = t; return; }
    if (t - missingSince >= LIVENESS_MS) {
      teardown('liveness: html.lgs-on gone from main for 2 s').then((r) => {
        try { W.console.info('[lgs-rt] removed by the liveness watch', JSON.stringify(r)); } catch (_) { /* no console */ }
      });
    }
  }

  // ------------------------------------------------------------------ test hooks
  const testTimers = new Set();
  function ttlTimer(ms, fn) {
    const id = W.setTimeout(() => { testTimers.delete(id); fn(); }, Math.max(1000, ms || TEST_TTL_MS));
    testTimers.add(id);
    return () => { W.clearTimeout(id); testTimers.delete(id); };
  }
  let inputStub = null;   // {mode, opts, restore, clearTtl}
  let actionsOn = null;   // {until, clearTtl}
  const actionLog = [];
  const test = {
    // Input-mode stub: P3's rt.input.stub when installed, else only remembered
    // (and replayed to P3 if it installs later in the step).
    input: {
      set(mode, opts) {
        if (inputStub) { try { if (inputStub.restore) inputStub.restore(); } catch (_) { /* gone */ } if (inputStub.clearTtl) inputStub.clearTtl(); }
        inputStub = null;
        if (mode !== 'pad' && mode !== 'laser') {
          try { if (rt.input && typeof rt.input.stub === 'function') rt.input.stub(null); } catch (_) { /* P3 gone */ }
          bus.emit('test:input', null);
          return { mode: null, applied: !!rt.input };
        }
        const o = Object.assign({}, opts || {});
        const ttl = o.ttlMs || TEST_TTL_MS;
        let restore = null, applied = false;
        try {
          if (rt.input && typeof rt.input.stub === 'function') { restore = rt.input.stub(mode, Object.assign({ ttlMs: ttl }, o)); applied = true; }
        } catch (e) { log('error', 'rt', 'rt.input.stub threw', errText(e)); }
        inputStub = { mode, opts: o, until: Date.now() + ttl, restore: typeof restore === 'function' ? restore : null };
        inputStub.clearTtl = ttlTimer(ttl, () => { log('warn', 'rt', 'test input stub expired'); test.input.set(null); });
        bus.emit('test:input', mode, o);
        return { mode, applied };
      },
      get() { return inputStub ? inputStub.mode : null; },
    },
    // Action logger: P2's actions log {fn, arg} and never run while enabled.
    actions: {
      enable(on, opts) {
        if (actionsOn && actionsOn.clearTtl) actionsOn.clearTtl();
        actionsOn = null;
        if (on) {
          const ttl = (opts && opts.ttlMs) || TEST_TTL_MS;
          actionsOn = { until: Date.now() + ttl };
          actionsOn.clearTtl = ttlTimer(ttl, () => { log('warn', 'rt', 'test action logger expired'); test.actions.enable(false); });
        }
        bus.emit('test:actions', !!on);
        return !!on;
      },
      enabled() { return !!actionsOn; },
      record(entry) {
        const e = Object.assign({ t: Date.now() - T0 }, entry || {});
        actionLog.push(e);
        if (actionLog.length > 500) actionLog.splice(0, actionLog.length - 500);
        log('info', 'actions', `logged ${e.fn || '?'}`, e);
        return e;
      },
      log() { return actionLog.slice(); },
      take() { return actionLog.splice(0, actionLog.length); },
    },
    // Flags for one locked step. push/pop for a step that spans several evaluations.
    flags: {
      push(obj, opts) {
        const token = (opts && opts.token) || (TOKEN_BASE + (++overlaySeq));
        const ttl = (opts && opts.ttlMs) || TEST_TTL_MS;
        const o = { token, obj: Object.assign({}, obj || {}), until: Date.now() + ttl };
        o.clearTtl = ttlTimer(ttl, () => { log('warn', 'rt', `test flags ${token} expired`); test.flags.pop(token); });
        overlays.push(o);
        flagsChanged('test push ' + token);
        return token;
      },
      pop(token) {
        const i = overlays.findIndex((o) => o.token === token);
        if (i < 0) return false;
        const [o] = overlays.splice(i, 1);
        if (o.clearTtl) o.clearTtl();
        flagsChanged('test pop ' + token);
        return true;
      },
      // await rt.test.flags.with({'wp.c2a': true}, async () => {...}): flags on,
      // modules reconciled, fn run, flags restored and reconciled, in finally.
      async with(obj, fn, opts) {
        const token = test.flags.push(obj, opts);
        try {
          await rt.settled();
          return await fn(rt);
        } finally {
          test.flags.pop(token);
          await rt.settled();
        }
      },
      list() { return overlays.map((o) => ({ token: o.token, flags: Object.assign({}, o.obj), expiresInMs: o.until - Date.now() })); },
    },
    // What a reload must keep (lgs.py passes it to the next runtime as
    // CONFIG.test): a lab step's flags, logger and input stub survive a
    // "--theme on" inside the same step, with the same tokens and remaining TTLs.
    carry() {
      const t = Date.now();
      return {
        flags: overlays.map((o) => ({ token: o.token, obj: Object.assign({}, o.obj), ms: o.until - t })).filter((o) => o.ms > 1000),
        actions: actionsOn ? Math.max(0, actionsOn.until - t) : 0,
        actionLog: actionLog.slice(-100),
        input: inputStub ? { mode: inputStub.mode, opts: Object.assign({}, inputStub.opts), ms: inputStub.until - t } : null,
      };
    },
    reset() {
      test.input.set(null);
      test.actions.enable(false);
      for (const o of overlays.splice(0)) if (o.clearTtl) o.clearTtl();
      flagsChanged('test reset');
      actionLog.length = 0;
    },
    state() {
      return {
        input: inputStub ? inputStub.mode : null,
        actions: !!actionsOn,
        actionsLogged: actionLog.length,
        flags: test.flags.list(),
      };
    },
  };

  // ------------------------------------------------------------------ status, teardown
  function counts() {
    // Subscriber counts on Steam's objects, for leak checks (RT-1, IN-9).
    const out = {};
    const size = (x) => {
      if (!x) return null;
      if (x.m_vecCallbacks) x = x.m_vecCallbacks;     // Steam's CallbackList
      if (Array.isArray(x)) return x.length;
      if (typeof x.size === 'number') return x.size;
      if (typeof x.length === 'number') return x.length;
      return null;
    };
    try {
      const pm = W.g_PopupManager;
      out.popupCreated = size(pm.m_rgPopupCreatedCallbacks);
      out.popupDestroyed = size(pm.m_rgPopupDestroyedCallbacks);
    } catch (_) { /* no popup manager */ }
    try {
      const ns = W.FocusNavController.NavigationSource;
      const cb = ns.m_callbacks || ns.m_Callbacks;
      out.navigationSource = size(cb && (cb.m_vecCallbacks || cb.m_rgCallbacks || cb));
    } catch (_) { /* not there */ }
    return out;
  }

  function status(opts) {
    const o = opts || {};
    const list = [...mods.values()].sort((a, b) => a.seq - b.seq).map((r) => {
      const m = { name: r.name, file: r.file, state: r.state };
      if (r.flag) m.flag = r.flag;
      if (r.deps.length) m.deps = r.deps.slice();
      if (r.reason && r.state !== 'installed') m.reason = r.reason;
      if (r.error) m.error = r.error;
      if (r.installMs !== null) m.installMs = r.installMs;
      if (r.state === 'installed' && r.scope) m.subscriptions = r.scope._count();
      return m;
    });
    const fx = effective();
    const nonBuiltin = {};
    for (const k of Object.keys(fx.values)) if (fx.sources[k] !== 'builtin') nonBuiltin[k] = fx.values[k];
    const out = {
      runtime: stopped ? 'removed' : (stopping ? 'stopping' : (started ? 'running' : 'loaded')),
      version: VERSION,
      build: CONFIG.version || null,
      since: new Date(T0).toISOString(),
      modules: list,
      failedLoads: failedLoads.slice(),
      flagsSet: nonBuiltin,
      windows: [...entries.values()].map((e) => e.kind + (e.visible() ? '' : ' (hidden)')),
      bridge: bridge.keys().reduce((a, k) => { a[k] = Math.round(bridge.age(k)); return a; }, {}),
      test: test.state(),
      globals: [...trackedGlobals],
      listeners: bus.count(),
      idle: { ticks, tickMsTotal: Math.round(tickMs * 1000) / 1000, t: Date.now() },
    };
    if (o.flags) { out.flags = fx.values; out.flagSources = fx.sources; }
    if (o.log) out.log = ring.slice(-(typeof o.log === 'number' ? o.log : 40));
    if (o.counts) out.counts = counts();
    return out;
  }

  let teardownPromise = null;
  function teardown(reason) {
    if (teardownPromise) return teardownPromise;
    stopping = true;
    teardownPromise = (async () => {
      const t0 = now();
      log('info', 'rt', `teardown: ${reason}`);
      bus.emit('teardown', reason);
      if (tick) { W.clearInterval(tick); tick = null; }
      if (mo) { try { mo.disconnect(); } catch (_) { /* gone */ } mo = null; moHtml = null; }
      try { await chain; } catch (_) { /* logged */ }
      const removed = [], errors = [], reports = {};
      let patchedLeft = 0;
      const order = topoOrder().filter((r) => r.state === 'installed').reverse();
      for (const rec of order) {
        const r = await removeRec(rec, 'teardown');
        removed.push(rec.name);
        if (r && r.error) errors.push({ module: rec.name, error: r.error });
        if (r && r.report !== null && r.report !== undefined) {
          reports[rec.name] = r.report;
          if (r.report && typeof r.report.patchedLeft === 'number') patchedLeft += r.report.patchedLeft;
        }
      }
      for (const rec of mods.values()) if (rec.state !== 'removed') rec.state = rec.state === 'failed' ? 'failed' : 'removed';
      // Test hooks off; their timers cleared.
      try { if (inputStub && inputStub.restore) inputStub.restore(); } catch (_) { /* P3 gone */ }
      inputStub = null; actionsOn = null;
      for (const id of testTimers) W.clearTimeout(id);
      testTimers.clear();
      overlays.length = 0;
      unhookPopupManager();
      for (const e of entries.values()) { try { e.doc.removeEventListener('visibilitychange', e._vis); } catch (_) { /* gone */ } }
      entries.clear();
      for (const k of Object.keys(winSubs)) winSubs[k].clear();
      const leftGlobals = [];
      for (const k of trackedGlobals) {
        try { if (k in W) { delete W[k]; if (k in W) leftGlobals.push(k); } } catch (_) { leftGlobals.push(k); }
      }
      const listenersLeft = bus.count();
      bus.clear();
      started = false; stopped = true;
      if (W.__LGS_RT === rt) { try { delete W.__LGS_RT; } catch (_) { W.__LGS_RT = undefined; } }
      return {
        reason, removed, errors, reports, patchedLeft,
        failed: [...mods.values()].filter((r) => r.state === 'failed').map((r) => r.name),
        globalsDeleted: [...trackedGlobals].filter((k) => !leftGlobals.includes(k)),
        globalsLeft: leftGlobals,
        listenersLeft,
        ms: Math.round(now() - t0),
      };
    })();
    return teardownPromise;
  }

  // ------------------------------------------------------------------ token helper
  function sel(s) {
    const index = W.__LGS_INDEX;
    return String(s).replace(/%\{([^}]+)\}/g, (_, tok) => {
      if (!index || !index.selector) throw new Error('rt.sel: class index not built (theme off?)');
      const r = index.selector(tok);
      if (!r.sel) throw new Error(`rt.sel: token ${tok} ${r.err}`);
      return r.sel;
    });
  }

  // ------------------------------------------------------------------ data
  // JSON fragments lgs.py passes in (theme/popups/*.json, name order, each with
  // "file"): rt.data('popups') or rt.data.popups. Read-only copies.
  const DATA = (CONFIG.data && typeof CONFIG.data === 'object') ? CONFIG.data : {};
  const data = Object.assign(function data(name) {
    const v = DATA[name];
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }, DATA);

  // ------------------------------------------------------------------ public object
  const rt = {
    version: VERSION,
    W,
    define,
    use(name) {
      const r = mods.get(name);
      if (!r || r.state !== 'installed') throw new Error(`rt.use: module ${name} is not installed`);
      return r.api;
    },
    has(name) { const r = mods.get(name); return !!(r && r.state === 'installed'); },
    module(name) { const r = mods.get(name); return r ? { name: r.name, state: r.state, reason: r.reason, error: r.error } : null; },
    shared,
    data,
    flags,
    windows: windowsApi((off) => off),
    bridge,
    test,
    on: (ev, fn) => bus.on(ev, fn),
    log: Object.assign((msg, data) => log('info', 'rt', msg, data), {
      info: (mod, msg, data) => log('info', mod, msg, data),
      warn: (mod, msg, data) => log('warn', mod, msg, data),
      error: (mod, msg, data) => log('error', mod, msg, data),
      tail: (n) => ring.slice(-(n || 40)),
    }),
    sel,
    status,
    counts,
    settled() { return chain.then(() => status()); },
    async start() {
      if (stopping || stopped) return status();
      if (!started) {
        started = true;
        hookPopupManager();
        reconcileWindows();
        tick = W.setInterval(onTick, TICK_MS);
        log('info', 'rt', `started: ${mods.size} modules defined, ${entries.size} windows`);
      }
      await schedule('start');
      if (carried && carried.input && carried.input.ms > 1000 && !inputStub) {
        test.input.set(carried.input.mode, Object.assign({}, carried.input.opts, { ttlMs: carried.input.ms }));
      }
      return status();
    },
    teardown,
    // Manual retry of a failed module (development only).
    retry(name) {
      const r = mods.get(name);
      if (!r || r.state !== 'failed') return false;
      r.state = 'defined'; r.error = null;
      schedule('retry');
      return true;
    },
    // Loader hooks (lgs.py).
    _loading(file) {
      if (file) { loadingFile = file; loadingBefore = lgsGlobals(); return; }
      if (loadingBefore) trackNewGlobals(loadingBefore, loadingFile || 'load');
      loadingFile = null; loadingBefore = null;
    },
    _fail(file, e) {
      const error = typeof e === 'string' ? e : errText(e);
      failedLoads.push({ file, error });
      log('error', 'rt', `${file} failed to load`, error);
      // A module defined by that file before it threw is not trusted either.
      for (const r of mods.values()) {
        if (r.file === file && r.state === 'defined') { r.state = 'failed'; r.error = 'file failed to load: ' + error; }
      }
    },
    _shared(name, exports) {
      if (exports && typeof exports === 'object' && Object.keys(exports).length) { shared[name] = exports; return; }
      if (typeof exports === 'function') { shared[name] = exports; return; }
      // The file set a global instead (it also runs standalone elsewhere).
      const cands = [...trackedGlobals].filter((k) => k in W);
      if (cands.length) shared[name] = W[cands[cands.length - 1]];
    },
  };

  // ------------------------------------------------------------------ test stubs (behind flags)
  // rt.stubs: three no-op modules exercising every core facility (RT-1, RT-3, RT-4).
  // rt.stubThrow: a module whose install() throws (RT-2).
  define({
    name: 'rt.stub.a', file: 'rt/00-rt.js', flag: 'rt.stubs',
    install(r) {
      r.windows.track((e) => {
        e.html.classList.add('lgs-rt-stub');
        e.html.setAttribute('data-lgs-rt-stub', e.kind);
        return () => { try { e.html.classList.remove('lgs-rt-stub'); e.html.removeAttribute('data-lgs-rt-stub'); } catch (_) { /* closed */ } };
      });
      r.windows.onAdd((e) => r.log(`window added: ${e.kind}`));
      r.windows.onShow((e) => r.log(`window shown: ${e.kind}`));
      try {
        const sub = W.FocusNavController.NavigationSource.Subscribe(() => {});
        r.cleanup(() => sub.Unsubscribe());
      } catch (_) { /* not in VR */ }
      return { added: () => r.windows.list().length };
    },
    remove() { return { patchedLeft: 0 }; },
  });
  define({
    name: 'rt.stub.b', file: 'rt/00-rt.js', flag: 'rt.stubs', deps: ['rt.stub.a'],
    install(r) {
      r.bridge.on('geom', () => {});
      r.flags.onAny(() => {});
      const m = r.windows.main();
      if (m) r.listen(m.doc, 'pointerdown', () => {}, { capture: true, passive: true });
      r.setInterval(() => {}, 60000);
      return {};
    },
    remove() { return { patchedLeft: 0 }; },
  });
  define({
    name: 'rt.stub.c', file: 'rt/00-rt.js', flag: 'rt.stubs', deps: ['rt.stub.b'],
    async install(r) {
      await new Promise((res) => r.setTimeout(res, 10));
      return { ok: true };
    },
    async remove() { await new Promise((res) => W.setTimeout(res, 5)); return { patchedLeft: 0 }; },
  });
  define({
    name: 'rt.stub.throw', file: 'rt/00-rt.js', flag: 'rt.stubThrow',
    install(r) {
      r.windows.track((e) => { e.html.classList.add('lgs-rt-stub-throw'); return () => e.html.classList.remove('lgs-rt-stub-throw'); });
      throw new Error('rt.stub.throw: install() throws on purpose (RT-2)');
    },
    remove() { return { patchedLeft: 0 }; },
  });

  // Test hooks carried over from the runtime this one replaces (same process, lab step).
  const carried = (CONFIG.test && typeof CONFIG.test === 'object') ? CONFIG.test : null;
  if (carried) {
    for (const f of carried.flags || []) {
      if (f && f.token && f.ms > 1000) test.flags.push(f.obj || {}, { token: f.token, ttlMs: f.ms });
    }
    if (carried.actions > 1000) test.actions.enable(true, { ttlMs: carried.actions });
    for (const e of carried.actionLog || []) actionLog.push(e);
    log('info', 'rt', 'test hooks carried over from the previous runtime', { flags: (carried.flags || []).length, actions: carried.actions > 1000, input: carried.input ? carried.input.mode : null });
  }

  W.__LGS_RT = rt;
  log('info', 'rt', `runtime v${VERSION} booted (${CONFIG.version || 'dev'})`);
  return { runtime: 'loaded', version: VERSION };
})(typeof __LGS_RT_CONFIG !== 'undefined' ? __LGS_RT_CONFIG : null);
