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
  const TICK_MS = 250;               // liveness poll while no observer watches main (fallback)
  const TICK_IDLE_MS = 2000;         // window reconcile + check while the observer watches main
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
    if (e.kind === 'main' && started && !stopping) { mainCache = e; watchMain(e); retick(); }
    fireAdd(e);
    return e;
  }
  function removeWin(w) {
    const e = entries.get(w);
    if (!e) return;
    entries.delete(w);
    try { e.doc.removeEventListener('visibilitychange', e._vis); } catch (_) { /* gone */ }
    if (e === mainCache || (moHtml && e.html === moHtml)) { mainCache = null; unwatchMain(); retick(); }
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

  // Module-independent window API (scoped variants are built per module; a dead
  // module scope gets no-ops, see makeScope).
  function windowsApi(track, isDead, late) {
    const dead = isDead || (() => false);
    const no = (what) => (late ? late(what) : NOOP);
    const api = {
      list() { return [...entries.values()]; },
      each(fn) {
        if (dead()) return;
        for (const e of [...entries.values()]) {
          try { fn(e); } catch (err) { log('error', 'rt', 'windows.each callback threw', errText(err)); }
        }
      },
      main() { for (const e of entries.values()) if (e.kind === 'main') return e; return null; },
      byKind(kind) { return [...entries.values()].filter((e) => e.kind === kind); },
      find(win) { return entries.get(win) || null; },
      onAdd(fn) { if (dead()) return no('rt.windows.onAdd'); winSubs.add.add(fn); return track(() => winSubs.add.delete(fn)); },
      onRemove(fn) { if (dead()) return no('rt.windows.onRemove'); winSubs.remove.add(fn); return track(() => winSubs.remove.delete(fn)); },
      onShow(fn) { if (dead()) return no('rt.windows.onShow'); winSubs.show.add(fn); return track(() => winSubs.show.delete(fn)); },
      onHide(fn) { if (dead()) return no('rt.windows.onHide'); winSubs.hide.add(fn); return track(() => winSubs.hide.delete(fn)); },
      // fn(entry) for every current and future window. It may return a cleanup
      // function, called when the window closes or the subscription ends.
      track(fn) {
        if (dead()) return no('rt.windows.track');
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
  // Subscribers are called on every set (contracts/daemon.md §3: also with an
  // equal value, e.g. a repeated action reply); the 4th argument says whether
  // the value changed, and set() returns it.
  const bridgeStore = new Map();
  const pendingActions = new Map();   // action id -> {resolve, timer}
  const bridge = {
    set(key, value) {
      const json = (() => { try { return JSON.stringify(value); } catch (_) { return String(Math.random()); } })();
      const cur = bridgeStore.get(key);
      const t = Date.now();
      const changed = !cur || cur.json !== json;
      bridgeStore.set(key, { value, json, t });
      if (key === 'reply' && value && typeof value === 'object') settleAction(value);
      bus.emit('bridge:' + key, value, cur ? cur.value : undefined, key, changed);
      return changed;
    },
    get(key) { const c = bridgeStore.get(key); return c ? c.value : undefined; },
    age(key) { const c = bridgeStore.get(key); return c ? Date.now() - c.t : Infinity; },
    keys() { return [...bridgeStore.keys()]; },
    on(key, fn) { return bus.on('bridge:' + key, fn); },
  };

  // ------------------------------------------------------------------ daemon actions
  // rt.action(type, args, {src, timeoutMs}) -> Promise<reply> (contracts/daemon.md §5):
  // calls the daemon's CDP binding window.lgsAction and resolves with the bridge
  // 'reply' of the same id. Never rejects: {ok: false, error} on no daemon,
  // timeout or teardown. nav/launch actions are not run while the action logger
  // is on (the daemon checks rt.test.actions.enabled()).
  let actionSeq = 0;
  function daemonFresh() {
    const d = bridge.get('daemon');
    return !!(d && typeof d === 'object' && typeof d.at === 'number' && Date.now() - d.at <= (d.ttlMs || 6000));
  }
  function settleAction(reply) {
    const p = pendingActions.get(reply.id);
    if (!p) return;
    pendingActions.delete(reply.id);
    W.clearTimeout(p.timer);
    try { p.resolve(reply); } catch (_) { /* caller gone */ }
  }
  function action(owner, type, args, opts) {
    const o = opts || {};
    const tag = String(owner || 'rt').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 32);
    const id = `${tag}:${(T0 % 46656).toString(36)}.${++actionSeq}`.slice(0, 64);
    const timeoutMs = o.timeoutMs || (daemonFresh() ? 12000 : 2000);   // plugin timeout 10 s + margin
    return new Promise((resolve) => {
      if (stopping || stopped) { resolve({ id, ok: false, error: 'teardown' }); return; }
      let fn = null;
      try { fn = W.lgsAction; } catch (_) { /* none */ }
      if (typeof fn !== 'function') { resolve({ id, ok: false, error: 'no-daemon' }); return; }
      const timer = W.setTimeout(() => { pendingActions.delete(id); resolve({ id, ok: false, error: 'timeout' }); }, timeoutMs);
      pendingActions.set(id, { resolve, timer });
      try {
        fn(JSON.stringify({ id, type: String(type), args: args || {}, src: o.src || 'main' }));
      } catch (e) {
        W.clearTimeout(timer);
        pendingActions.delete(id);
        resolve({ id, ok: false, error: 'call-failed', detail: errText(e) });
      }
    });
  }
  function dropActions(why) {
    for (const [id, p] of [...pendingActions]) {
      pendingActions.delete(id);
      W.clearTimeout(p.timer);
      try { p.resolve({ id, ok: false, error: why }); } catch (_) { /* caller gone */ }
    }
  }

  // ------------------------------------------------------------------ registry
  const mods = new Map();      // name -> rec, in definition order
  let defSeq = 0;
  let loadingFile = null;
  let loadingBefore = null;
  let started = false, stopping = false, stopped = false;
  let chain = Promise.resolve();
  const failedLoads = [];      // {file, error}: files that failed before define()
  const shared = {};
  const exposed = new Map();   // public member name -> owning module (rt.expose)

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
      const t = W.setTimeout(() => { const e = new Error(`${what} timed out after ${ms} ms`); e.lgsTimeout = true; rej(e); }, ms);
      v.then((x) => { W.clearTimeout(t); res(x); }, (e) => { W.clearTimeout(t); rej(e); });
    });
  }

  // An install() that timed out keeps running. Its scope is dead (no-ops), but
  // whatever it did directly (not through rt) is undone by calling remove()
  // once more when it finally settles, unless the module was installed again.
  function lateSettle(rec, gen, how) {
    if (rec.gen !== gen || rec.state === 'installed' || rec.state === 'installing') return;
    rec.lateSettled = how;
    log('warn', rec.name, `install() ${how} after its timeout; remove() called again`);
    if (typeof rec.def.remove !== 'function') return;
    try {
      const r = rec.def.remove();
      if (r && typeof r.then === 'function') r.then(null, (e) => log('error', rec.name, 'remove() after a late install threw', errText(e)));
    } catch (e) { log('error', rec.name, 'remove() after a late install threw', errText(e)); }
  }

  // Per-module facade: everything subscribed through it is undone on removal,
  // even if the module's own remove() forgets. Once disposed (removal, or a
  // failed / timed-out install) the scope is dead: a late continuation of the
  // module (an install still running after its 5 s timeout, an await that
  // resumes after a flag-off removal) gets no-ops, and anything that slips
  // through track() is undone at once (review R1 M2).
  const NOOP = () => {};
  function makeScope(rec) {
    // Live subscriptions only: an off() that runs (a timer that fired, an
    // unsubscribe the module did itself) leaves the set at once, so a module
    // that keeps scheduling short timers never grows it (REQ P2->P1). A Set
    // keeps insertion order; removal undoes the newest first.
    const cleanups = new Set();
    let dead = false, lateCalls = 0;
    const late = (what) => {
      lateCalls++;
      if (lateCalls <= 5) log('warn', rec.name, `${what} after the module was removed: ignored`);
      return NOOP;
    };
    const track = (fn) => {
      let done = false;
      const off = () => {
        if (done) return;
        done = true;
        cleanups.delete(off);
        try { fn(); } catch (e) { log('error', rec.name, 'cleanup threw', errText(e)); }
      };
      if (dead) { late('a subscription'); off(); return NOOP; }
      cleanups.add(off);
      return off;
    };
    const isDead = () => dead;
    const scope = Object.create(rt);
    scope.name = rec.name;
    scope.module = rec.name;
    scope.log = (msg, data) => log('info', rec.name, msg, data);
    scope.warn = (msg, data) => log('warn', rec.name, msg, data);
    scope.error = (msg, data) => log('error', rec.name, msg, data);
    scope.cleanup = (fn) => track(fn);
    scope.on = (ev, fn) => (dead ? late('rt.on') : track(bus.on(ev, fn)));
    scope.listen = (target, type, fn, opts) => {
      if (dead) return late('rt.listen');
      target.addEventListener(type, fn, opts);
      return track(() => { try { target.removeEventListener(type, fn, opts); } catch (_) { /* window gone */ } });
    };
    scope.setTimeout = (fn, ms) => {
      if (dead) return late('rt.setTimeout');
      let off = null;
      const id = W.setTimeout(() => { if (off) off(); if (dead) return; try { fn(); } catch (e) { log('error', rec.name, 'timer threw', errText(e)); } }, ms);
      off = track(() => W.clearTimeout(id));
      return off;
    };
    scope.setInterval = (fn, ms) => {
      if (dead) return late('rt.setInterval');
      const id = W.setInterval(() => { if (dead) return; try { fn(); } catch (e) { log('error', rec.name, 'interval threw', errText(e)); } }, ms);
      return track(() => W.clearInterval(id));
    };
    scope.windows = windowsApi(track, isDead, late);
    scope.flags = Object.assign(Object.create(flags), {
      on: (name, fn) => (dead ? late('rt.flags.on') : track(flags.on(name, fn))),
      onAny: (fn) => (dead ? late('rt.flags.onAny') : track(flags.onAny(fn))),
    });
    scope.bridge = Object.assign(Object.create(bridge), {
      on: (key, fn) => (dead ? late('rt.bridge.on') : track(bridge.on(key, fn))),
    });
    scope.action = (type, args, opts) => (dead
      ? (late('rt.action'), Promise.resolve({ id: null, ok: false, error: 'removed' }))
      : action(rec.name, type, args, opts));
    // A member on the public runtime object (PLAN §1.4: one accessor, e.g.
    // __LGS_RT.input), visible to every module's rt and to the lab; deleted
    // when this module is removed.
    scope.expose = (name, value) => {
      if (dead) return late('rt.expose');
      const k = String(name);
      const owner = exposed.get(k);
      if ((Object.prototype.hasOwnProperty.call(rt, k) && !owner) || (owner && owner !== rec.name)) {
        throw new Error(`rt.expose: ${k} is taken by ${owner || 'the runtime core'}`);
      }
      rt[k] = value;
      exposed.set(k, rec.name);
      return track(() => {
        if (exposed.get(k) === rec.name && rt[k] === value) { delete rt[k]; exposed.delete(k); }
      });
    };
    scope._dispose = () => {
      dead = true;
      // newest first, as before; anything a cleanup subscribes now is undone at once (dead)
      const all = [...cleanups].reverse();
      cleanups.clear();
      for (const off of all) off();
    };
    scope._dead = isDead;
    scope._late = () => lateCalls;
    scope._count = () => cleanups.size;
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
    const gen = rec.gen = (rec.gen || 0) + 1;
    const scope = makeScope(rec);
    rec.scope = scope;
    const before = lgsGlobals();
    const t0 = now();
    let pending = null;
    try {
      pending = rec.def.install(scope);
      rec.api = await withTimeout(pending, INSTALL_TIMEOUT_MS, 'install()');
      rec.state = 'installed';
      rec.installs++;
      rec.installMs = Math.round((now() - t0) * 10) / 10;
      log('info', rec.name, `installed in ${rec.installMs} ms` + (rec.retries ? ` after ${rec.retries} transient retries` : ''));
      if (rec.retries) { rec.retriedOk = rec.retries; rec.retries = 0; }
      bus.emit('module', rec.name, 'installed');
      replayInputStub(rec);
    } catch (e) {
      if (e && e.lgsTimeout && pending && typeof pending.then === 'function') {
        pending.then(() => lateSettle(rec, gen, 'resolved'), () => lateSettle(rec, gen, 'rejected'));
      }
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
      if (!(e && e.lgsTimeout)) retryTransient(rec, gen, e);
    }
    trackNewGlobals(before, rec.name);
  }

  // A failure the module marks as transient (err.transient === true, or on err.cause:
  // Steam's UI still mounting after a SharedJSContext restart, react.md v3 §1) is
  // retried after err.retryAfterMs (at least 1 s), at most TRANSIENT_RETRIES times,
  // each attempt logged; never after teardown (REQ P2->P1). Any other failure stays
  // failed until the next `lgs on`.
  const TRANSIENT_RETRIES = 4;
  const retryTimers = new Set();
  function transientOf(e) {
    for (let x = e, i = 0; x && i < 4; x = x.cause, i++) {
      try { if (x.transient === true) return x; } catch (_) { return null; }
    }
    return null;
  }
  function retryTransient(rec, gen, e) {
    const t = transientOf(e);
    if (!t) return;
    rec.retries = (rec.retries || 0) + 1;
    if (rec.retries > TRANSIENT_RETRIES) {
      log('warn', rec.name, `transient failure: gave up after ${TRANSIENT_RETRIES} retries`);
      return;
    }
    const ms = Math.max(1000, Number(t.retryAfterMs) || 0);
    rec.reason = `transient: retry ${rec.retries}/${TRANSIENT_RETRIES} in ${ms} ms`;
    log('warn', rec.name, `transient failure; retry ${rec.retries}/${TRANSIENT_RETRIES} in ${ms} ms`);
    const id = W.setTimeout(() => {
      retryTimers.delete(id);
      if (stopping || stopped || !started || rec.gen !== gen || rec.state !== 'failed') return;
      rec.state = 'defined';
      rec.error = null;
      schedule('transient retry ' + rec.name);
    }, ms);
    retryTimers.add(id);
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
  // goes and arms a timer for exactly 2 s later. The tick is a fallback: every
  // 2 s (a window reconcile and a check) while the observer watches main, every
  // 250 ms while it cannot (no observer, or no main window, e.g. right after a
  // SharedJSContext reload: then the CSS core itself is watched, __LGS gone or
  // disabled for 2 s means theme off; review R1 m2, m3). Removal ≈ 2 s + teardown (RT-5).
  let tick = null, missingSince = 0, ticks = 0, mo = null, moHtml = null, tickMs = 0, mainCache = null;
  let livenessTimer = null;
  function disarmLiveness() { if (livenessTimer) { W.clearTimeout(livenessTimer); livenessTimer = null; } }
  function armLiveness() {
    if (livenessTimer || stopping || !missingSince) return;
    const due = Math.max(0, missingSince + LIVENESS_MS - Date.now());
    livenessTimer = W.setTimeout(() => { livenessTimer = null; checkLiveness(); }, due);
  }
  function coreOn() {
    try { const c = W.__LGS; return !!(c && c.state && c.state.enabled); } catch (_) { return true; }
  }
  // true when it started the teardown
  function checkLiveness() {
    if (!started || stopping) return false;
    let on = true, what = 'html.lgs-on gone from main';
    try {
      if (moHtml) on = moHtml.classList.contains('lgs-on');
      else { on = coreOn(); what = 'the CSS core gone (no main window)'; }
    } catch (_) { return false; }
    if (on) { missingSince = 0; disarmLiveness(); return false; }
    if (!missingSince) missingSince = Date.now();
    const gone = Date.now() - missingSince;
    if (gone < LIVENESS_MS) { armLiveness(); return false; }
    disarmLiveness();
    teardown(`liveness: ${what} for ${gone} ms`).then((r) => {
      try { W.console.info('[lgs-rt] removed by the liveness watch', JSON.stringify(r)); } catch (_) { /* no console */ }
    });
    return true;
  }
  function unwatchMain() {
    if (mo) { try { mo.disconnect(); } catch (_) { /* gone */ } mo = null; }
    moHtml = null;
    disarmLiveness();
    missingSince = 0;
  }
  function watchMain(main) {
    if (moHtml === main.html) return;
    unwatchMain();
    moHtml = main.html;
    try {
      const MO = main.win.MutationObserver || W.MutationObserver;
      if (!MO) return;
      mo = new MO(() => {
        try {
          if (!moHtml.classList.contains('lgs-on')) { if (!missingSince) missingSince = Date.now(); armLiveness(); }
          else { missingSince = 0; disarmLiveness(); }
        } catch (_) { /* closing */ }
      });
      mo.observe(main.html, { attributes: true, attributeFilter: ['class'] });
    } catch (_) { mo = null; }
  }
  function scheduleTick() {
    if (!started || stopping) return;
    tick = W.setTimeout(onTick, mo ? TICK_IDLE_MS : TICK_MS);
  }
  // main came or went: re-plan the next tick at the rate that now applies
  function retick() {
    if (!started || stopping || !tick) return;
    W.clearTimeout(tick);
    tick = null;
    scheduleTick();
  }
  function onTick() {
    tick = null;
    const t0 = now();
    try { tickBody(); } finally { tickMs += now() - t0; scheduleTick(); }
  }
  function tickBody() {
    if (!started || stopping) return;
    ticks++;
    if (mo || ticks % 8 === 0) { try { reconcileWindows(); } catch (_) { /* next tick */ } }
    let main = (mainCache && entries.get(mainCache.win) === mainCache) ? mainCache : null;
    if (!main) {
      for (const e of entries.values()) if (e.kind === 'main') { main = e; break; }
      mainCache = main;
    }
    if (!main) {
      if (moHtml) unwatchMain();
      if (ticks % 2 === 0) { try { reconcileWindows(); } catch (_) { /* later */ } }
    } else {
      watchMain(main);
    }
    checkLiveness();
  }

  // ------------------------------------------------------------------ test hooks
  const testTimers = new Set();
  function ttlTimer(ms, fn) {
    const id = W.setTimeout(() => { testTimers.delete(id); fn(); }, Math.max(1000, ms || TEST_TTL_MS));
    testTimers.add(id);
    return () => { W.clearTimeout(id); testTimers.delete(id); };
  }
  let inputStub = null;   // {mode, opts, until, restore, applied, clearTtl}
  let actionsOn = null;   // {until, clearTtl}
  const actionLog = [];
  // A stub set while no module provided rt.input.stub is applied as soon as one
  // installs (P3's input module, e.g. when a lab step turns wp.p3 on after it).
  function replayInputStub(rec) {
    if (!inputStub || inputStub.applied) return;
    let fn = null;
    try { fn = rt.input && typeof rt.input.stub === 'function' ? rt.input.stub : null; } catch (_) { /* none */ }
    if (!fn) return;
    const left = inputStub.until - Date.now();
    if (left <= 1000) return;
    try {
      const r = fn(inputStub.mode, Object.assign({}, inputStub.opts, { ttlMs: left }));
      inputStub.restore = typeof r === 'function' ? r : null;
      inputStub.applied = true;
      log('info', 'rt', `test input stub '${inputStub.mode}' applied once ${rec ? rec.name : 'input'} installed`);
    } catch (e) { log('error', 'rt', 'rt.input.stub threw (replay)', errText(e)); }
  }
  const test = {
    // Input-mode stub: P3's rt.input.stub when installed, else remembered and
    // applied when a module providing rt.input installs within the stub's TTL.
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
        inputStub = { mode, opts: o, until: Date.now() + ttl, restore: typeof restore === 'function' ? restore : null, applied };
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
    // Subscriber counts on Steam's objects, for leak checks (RT-1, IN-9; IM §8).
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
    // SteamVR's navigation-type callbacks (vrGamepadInput.RegisterForNavigationTypeChange, IM §8)
    try { out.vrNavigationType = size(W.vrGamepadInput.m_NavigationTypeChangeCallbacks); } catch (_) { /* not in VR */ }
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
      if (r.retries || r.retriedOk) m.retries = r.retries || r.retriedOk;
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
      exposed: [...exposed].reduce((a, [k, m]) => { a[k] = m; return a; }, {}),
      actionsPending: pendingActions.size,
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
      if (tick) { W.clearTimeout(tick); tick = null; }
      unwatchMain();
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
      dropActions('teardown');
      for (const id of retryTimers) W.clearTimeout(id);
      retryTimers.clear();
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
    windows: windowsApi((off) => off, null, null),
    bridge,
    action: (type, args, opts) => action('rt', type, args, opts),
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
        onTick();   // the liveness observer on main from the start; schedules the next tick
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
      r.expose('rtStubC', { ok: true });
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

  // rt.stubSlow: an install() that outlives its 5 s timeout, then subscribes through
  // its (dead) scope and marks main directly (RT-2, review R1 M2). Everything must
  // be gone: the scoped calls are no-ops, the direct mark is undone by the second
  // remove() when the late install settles.
  define({
    name: 'rt.stub.slow', file: 'rt/00-rt.js', flag: 'rt.stubSlow',
    async install(r) {
      await new Promise((res) => W.setTimeout(res, INSTALL_TIMEOUT_MS + 600));
      const m = r.windows.main();
      if (m) m.html.classList.add('lgs-rt-stub-slow-direct');
      r.windows.track((e) => { e.html.classList.add('lgs-rt-stub-slow'); return () => e.html.classList.remove('lgs-rt-stub-slow'); });
      r.setInterval(() => log('info', 'rt.stub.slow', 'late interval tick'), 100);
      r.setTimeout(() => log('info', 'rt.stub.slow', 'late timer fired'), 50);
      if (m) r.listen(m.doc, 'pointerdown', () => {}, { passive: true });
      r.on('flags', () => {});
      r.expose('rtStubSlow', { late: true });
      return { late: true };
    },
    remove() {
      for (const p of popupObjects()) {   // Steam's list, not ours: also right after a teardown
        const w = winOf(p);
        try { if (w) w.document.documentElement.classList.remove('lgs-rt-stub-slow-direct'); } catch (_) { /* closed */ }
      }
      return { patchedLeft: 0 };
    },
  });

  // rt.stubTransient: install() fails twice with a transient error (retryAfterMs 1000),
  // then installs (RT-2, REQ P2->P1).
  let transientAttempts = 0;
  define({
    name: 'rt.stub.transient', file: 'rt/00-rt.js', flag: 'rt.stubTransient',
    install(r) {
      transientAttempts++;
      if (transientAttempts <= 2) {
        const e = new Error(`rt.stub.transient: not ready yet (attempt ${transientAttempts})`);
        e.transient = true; e.retryAfterMs = 1000;
        throw e;
      }
      r.windows.track((e) => { e.html.classList.add('lgs-rt-stub-transient'); return () => e.html.classList.remove('lgs-rt-stub-transient'); });
      return { attempts: transientAttempts };
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
