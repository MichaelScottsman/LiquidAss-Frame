// Glass Shell phase 2, P3 interaction runtime: input mode, sounds, haptics (dry run).
// Contract: docs/phase2/contracts/interaction.md §1, §5, §6. Evidence: docs/phase2/wp/P3.md.
// Promoted from device/proto/input_mode.js (capabilities/input-mode.md, IM).
//
//   html.lgs-input-pad | html.lgs-input-laser   on every Steam popup window
//   html[data-lgs-vr-mode="gamepad"|"laser"]     SteamVR's own mode (absent when unknown)
//   rt.input  { mode, vrMode, source, state(), onChange(fn), stub(mode, opts), windows(), sound, haptic, hub }
//   rt.sound(event)   Steam's own sound bus, Steam's ENavSound for the same event (IM §6.4)
//   rt.haptic(kind)   dry run unless flag `haptics` === true (S17)
//
// Runs in SharedJSContext. Memory only; remove() restores every subscription and class.
(function lgsP3Input() {
  'use strict';
  const RT = (typeof __LGS_RT !== 'undefined') ? __LGS_RT : window.__LGS_RT;
  if (!RT || typeof RT.define !== 'function') return;

  const H = window;
  const SOURCE = ['unknown', 'gamepad', 'keyboard-sim', 'mouse', 'touch', 'lpad', 'rpad'];  // EInputSourceType
  const SURFACE_PREFIX = 'valve.steam.gamepadui.';
  const STUB_TTL_MS = 120000;

  let R = null;          // the (scoped) runtime object install() got
  let live = null;       // per-install state; null when removed
  // The public runtime object (window.__LGS_RT); a scoped rt inherits from it.
  const PUB = () => (H.__LGS_RT && typeof H.__LGS_RT.define === 'function') ? H.__LGS_RT : RT;

  // ---------------------------------------------------------------- helpers
  // P1's scoped logger: rt.log(msg, data) / rt.warn / rt.error (contracts/runtime.md §3.1).
  function log(level, msg, data) {
    try {
      const f = R && (level === 'error' ? R.error : level === 'warn' ? R.warn : R.log);
      if (typeof f === 'function') { f(msg, data); return; }
    } catch (_) { /* fall through */ }
    try { H.console[level === 'error' ? 'error' : 'log']('[lgs input] ' + msg, data === undefined ? '' : data); } catch (_) { /* none */ }
  }
  function flag(name) {
    try {
      const f = R && R.flags;
      if (!f) return undefined;
      if (typeof f.get === 'function') return f.get(name);
      return f[name];
    } catch (_) { return undefined; }
  }
  function surfaceOfName(name) {
    if (!name) return 'unknown';
    if (name === 'VR_uid0' || /^VR_uid\d+$/.test(name)) return 'main';
    if (/^VRKeyboard_uid/.test(name)) return 'keyboard';
    if (/^VRNotificationToasts_uid/.test(name)) return 'notifications';
    if (name.startsWith(SURFACE_PREFIX)) {
      const rest = name.slice(SURFACE_PREFIX.length);
      const m = rest.match(/^(.*?)\.\d+/);
      return m ? m[1] : rest.replace(/_uid\d+$/, '');
    }
    return name.replace(/_uid\d+$/, '');
  }

  // ---------------------------------------------------------------- %{Token} selectors, resolved lazily
  // A selector list with %{Token} classes resolves through P1's class index (__LGS_INDEX). A part whose
  // token does not resolve is left out. The index can be incomplete for minutes (after a Steam page
  // crash it held 3 of 550 modules, review R1 F6), so an incomplete result is never kept: the getter
  // resolves again on use, at most once a second, until every part resolves.
  let INDEX_OVERRIDE = null;   // test hook only (rt.input.test.index): stands in for an incomplete index
  function resolveParts(list) {
    const parts = String(list || '').split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
    const out = [];
    let full = true;
    for (const p of parts) {
      if (p.indexOf('%{') < 0) { out.push(p); continue; }
      let bad = false;
      const s = p.replace(/%\{([^}]+)\}/g, (_, tok) => {
        try {
          const idx = INDEX_OVERRIDE || H.__LGS_INDEX;
          const r = idx && typeof idx.selector === 'function' ? idx.selector(tok) : null;
          if (r && r.sel) return r.sel;
        } catch (_) { /* unresolved */ }
        bad = true;
        return '';
      });
      if (bad) full = false; else out.push(s);
    }
    return { sel: out.join(', '), full };
  }
  function lazySel(list) {
    let cache = '';
    let full = false;
    let at = -1e9;
    let warned = false;
    const get = () => {
      if (full) return cache;
      const t = H.performance.now();
      if (t - at < 1000) return cache;
      at = t;
      const r = resolveParts(list);
      cache = r.sel;
      full = r.full;
      if (!full && !warned) { warned = true; log('warn', 'unresolved %{Token} in selector; retrying on use', String(list)); }
      return cache;
    };
    get.source = String(list);
    get.resolved = () => { get(); return full; };
    return get;
  }

  // ---------------------------------------------------------------- webpack (one guarded pass)
  // Steam's webpack require, taken once per page load. webpack also keeps every pushed chunk record
  // in the array, so ours is spliced out again at once (G-REMOVE: no global mutation survives).
  let REQ = null;
  function webpackRequire() {
    if (REQ) return REQ;
    const ch = H.webpackChunksteamui;
    if (!ch || typeof ch.push !== 'function') return null;
    const sym = Symbol('lgs-p3-input');
    let req = null;
    try { ch.push([[sym], {}, (r) => { req = r; }]); } catch (_) { req = null; }
    // Ours, and any record an earlier P3 build (before review R1 F4) left behind.
    try {
      for (let i = ch.length - 1; i >= 0; i--) {
        const c = ch[i];
        const id = c && Array.isArray(c[0]) ? c[0][0] : null;
        if (id === sym || (typeof id === 'symbol' && id.description === 'lgs-p3-input')) ch.splice(i, 1);
      }
    } catch (_) { /* array gone */ }
    if (req && req.m) REQ = req;
    return REQ;
  }
  // Ids are hints only; a module is used only if its source passes the needle test.
  function findSteamModules() {
    const req = webpackRequire();
    const out = { reaction: null, bus: null, PN: null };
    if (!req) return out;
    const src = (id) => { try { return Function.prototype.toString.call(req.m[id]); } catch (_) { return ''; } };
    const FIND = {
      mobx: ['89193', (s) => s.includes('[MobX]')],
      sound: ['67758', (s) => s.length < 4000 && s.includes('RegisterCallbackOnPlaySound') && s.includes('"BasicNav"')],
    };
    const found = {};
    const todo = new Set(Object.keys(FIND));
    for (const k of [...todo]) if (req.m[FIND[k][0]] && FIND[k][1](src(FIND[k][0]))) { found[k] = FIND[k][0]; todo.delete(k); }
    if (todo.size) {
      for (const id of Object.keys(req.m)) {
        if (!todo.size) break;
        const s = src(id);
        for (const k of [...todo]) if (FIND[k][1](s)) { found[k] = id; todo.delete(k); }
      }
    }
    try {
      if (found.mobx) {
        out.reaction = Object.values(req(found.mobx)).find((f) => typeof f === 'function'
          && String(f).includes('"Reaction"') && String(f).includes('compareStructural')) || null;
      }
    } catch (_) { out.reaction = null; }
    try {
      if (found.sound) {
        for (const v of Object.values(req(found.sound))) {
          if (v && typeof v.PlayNavSound === 'function') out.bus = v;
          else if (v && typeof v.BasicNav === 'number') out.PN = v;
        }
      }
    } catch (_) { /* fallbacks below */ }
    out.ids = found;
    return out;
  }

  // ---------------------------------------------------------------- window hub (shared by P3's modules)
  // One g_PopupManager created/destroyed callback pair for the whole package. Modules register
  // per-document hooks with hub.onDoc(fn(win, doc, surface) -> cleanup); a hook runs for every
  // live Steam popup document now and later, and its cleanup runs when the window closes, its
  // document is replaced, the hook is removed or the package is removed.
  function makeHub(PM, scope) {
    // P1's window registry when the runtime has one (one popup callback pair for every module).
    const RW = scope && scope.windows;
    if (RW && typeof RW.track === 'function' && typeof RW.list === 'function' && typeof RW.find === 'function') {
      return {
        p1: true,
        scan() {},
        ensure() {},
        drop() {},
        clear() {},
        windows() { return RW.list().map((e) => e.win); },
        surfaceOf(w) { const e = RW.find(w); return e ? e.kind : surfaceOfName(w && w.name); },
        docOf(w) { const e = RW.find(w); return e ? e.doc : null; },
        main() {
          const e = typeof RW.main === 'function' ? RW.main() : null;
          if (e) return e.win;
          try { return H.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.BrowserWindow || null; } catch (_) { return null; }
        },
        onDoc(fn) { return RW.track((e) => fn(e.win, e.doc, e.kind)); },
      };
    }
    const wins = new Map();     // Window -> { doc, surface, cleanups: Map(hookId -> fn) }
    const hooks = new Map();    // hookId -> fn
    const popupOf = new Map();  // Window -> popup name
    let nextId = 1;
    function liveWindows() {
      const out = [];
      try {
        for (const p of PM.GetPopups()) {
          try { if (p.window && p.window.document && p.window.document.documentElement) { out.push(p.window); popupOf.set(p.window, p.m_strName); } } catch (_) { /* closing */ }
        }
      } catch (_) { /* none */ }
      return out;
    }
    function runHook(rec, w, id, fn) {
      try {
        const c = fn(w, rec.doc, rec.surface);
        rec.cleanups.set(id, typeof c === 'function' ? c : null);
      } catch (e) { rec.cleanups.set(id, null); log('error', 'doc hook failed', String(e && e.stack || e)); }
    }
    function dropWin(w) {
      const rec = wins.get(w);
      if (!rec) return;
      for (const c of rec.cleanups.values()) { if (c) { try { c(); } catch (_) { /* gone */ } } }
      wins.delete(w);
    }
    function ensure(w) {
      let d;
      try { d = w.document; } catch (_) { dropWin(w); return; }
      if (!d || !d.documentElement) return;
      const rec = wins.get(w);
      if (rec && rec.doc === d) return;
      if (rec) dropWin(w);
      const nrec = { doc: d, surface: surfaceOfName(popupOf.get(w) || w.name), cleanups: new Map() };
      wins.set(w, nrec);
      for (const [id, fn] of hooks) runHook(nrec, w, id, fn);
    }
    function scan() {
      const seen = new Set(liveWindows());
      for (const w of seen) ensure(w);
      for (const w of [...wins.keys()]) if (!seen.has(w)) dropWin(w);
    }
    return {
      scan,
      ensure,
      drop: dropWin,
      windows() { return [...wins.keys()]; },
      surfaceOf(w) { const r = wins.get(w); return r ? r.surface : surfaceOfName(w && w.name); },
      docOf(w) { const r = wins.get(w); return r ? r.doc : null; },
      main() {
        try { const w = H.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.BrowserWindow; if (w) return w; } catch (_) { /* fall back */ }
        for (const [w, r] of wins) if (r.surface === 'main') return w;
        return null;
      },
      onDoc(fn) {
        const id = nextId++;
        hooks.set(id, fn);
        for (const [w, rec] of wins) runHook(rec, w, id, fn);
        return () => {
          hooks.delete(id);
          for (const rec of wins.values()) {
            const c = rec.cleanups.get(id);
            rec.cleanups.delete(id);
            if (c) { try { c(); } catch (_) { /* gone */ } }
          }
        };
      },
      clear() { for (const w of [...wins.keys()]) dropWin(w); hooks.clear(); },
    };
  }

  // ---------------------------------------------------------------- sounds
  const PN_FALLBACK = ['LaunchGame', 'FriendMessage', 'ChatMention', 'ChatMessage', 'ToastMessage', 'ToastAchievement',
    'ToastMisc', 'ToastMiscShort', 'FriendOnline', 'FriendInGame', 'VolSound', 'ShowModal', 'HideModal', 'IntoGameDetail',
    'OutOfGameDetail', 'PagedNavigation', 'ToggleOn', 'ToggleOff', 'SliderUp', 'SliderDown', 'ChangeTabs', 'DefaultOk',
    'OpenSideMenu', 'CloseSideMenu', 'BasicNav', 'FailedNav', 'Typing', 'TimerExpired', 'Screenshot'];
  // Our events -> Steam's ENavSound for the same event (IM §6.4, VP §4.4).
  const SOUND_EVENT = {
    activate: 'DefaultOk', tab: 'ChangeTabs', segment: 'ChangeTabs', page: 'PagedNavigation',
    toggleOn: 'ToggleOn', toggleOff: 'ToggleOff', sliderUp: 'SliderUp', sliderDown: 'SliderDown',
    sheetIn: 'ShowModal', sheetOut: 'HideModal', menuIn: 'OpenSideMenu', menuOut: 'CloseSideMenu',
    nav: 'BasicNav', fail: 'FailedNav',
  };
  const SOUND_REFUSED = new Set(['hover', 'enter', 'leave', 'dwell']);   // visionOS plays nothing on hover

  // ---------------------------------------------------------------- haptics (SteamVR overlay effects)
  const HAPTIC = { enter: 1, hover: 1, tick: 1, leave: 2, snap: 3, detent: 3, slide: 4, sliding: 4, edge: 5, thud: 5 };

  RT.define({
    name: 'input',
    deps: [],
    flag: 'wp.p3',
    install(rt) {
      R = rt || RT;
      const FNC = H.FocusNavController;
      const PM = H.g_PopupManager;
      if (!FNC || !FNC.NavigationSource || !PM) throw new Error('input: FocusNavController / g_PopupManager not found');
      const VRI = H.vrGamepadInput || null;
      const steam = findSteamModules();
      const hub = makeHub(PM, R);
      const listeners = new Set();
      const undo = [];
      const st = {
        cur: null, stub: null, stubTimer: 0, lastPulse: -1e9, steam, hub, listeners, undo,
      };
      live = st;
      // Fail closed (runtime.md §1 rule 2): remove() works from here on, whatever step throws below.
      // Each Steam subscription registers its undo the moment it is made, here and with P1's tracked
      // rt.cleanup (both run once), so a partial install leaves nothing behind.
      function addUndo(fn) {
        let done = false;
        const once = () => { if (done) return; done = true; fn(); };
        undo.push(once);
        try { if (R && typeof R.cleanup === 'function' && R !== PUB()) R.cleanup(once); } catch (_) { /* untracked */ }
        return once;
      }
      st.remove = () => {
        H.clearTimeout(st.stubTimer);
        for (const u of undo.splice(0).reverse()) { try { u(); } catch (_) { /* already gone */ } }
        listeners.clear();
        try { hub.clear(); } catch (_) { /* gone */ }
        // Belt and braces: strip our marks from every live popup, hooked or not.
        try { for (const p of PM.GetPopups()) { try { unpaintDoc(p.window.document); } catch (_) { /* gone */ } } } catch (_) { /* none */ }
      };

      function computeLive() {
        let s = 0;
        try { s = FNC.NavigationSource.Value.eActivationSourceType | 0; } catch (_) { /* keep 0 */ }
        let vrPad = null;
        try { vrPad = VRI ? !!VRI.IsInGamepadNav : null; } catch (_) { vrPad = null; }
        const mode = (s === 1 || s === 2) ? 'pad' : (s === 0 ? (vrPad === false ? 'laser' : 'pad') : 'laser');
        return { mode, source: SOURCE[s] || String(s), vrMode: vrPad === null ? 'none' : (vrPad ? 'gamepad' : 'laser') };
      }
      function effective(l) {
        if (!st.stub) return l;
        return { mode: st.stub.mode || l.mode, vrMode: st.stub.vrMode || l.vrMode, source: l.source };
      }
      function paintDoc(doc) {
        try {
          const de = doc.documentElement;
          const c = st.cur;
          de.classList.toggle('lgs-input-laser', c.mode === 'laser');
          de.classList.toggle('lgs-input-pad', c.mode === 'pad');
          if (c.vrMode === 'gamepad' || c.vrMode === 'laser') de.setAttribute('data-lgs-vr-mode', c.vrMode);
          else de.removeAttribute('data-lgs-vr-mode');
        } catch (_) { /* not ready */ }
      }
      function unpaintDoc(doc) {
        try {
          const de = doc.documentElement;
          de.classList.remove('lgs-input-laser', 'lgs-input-pad');
          de.removeAttribute('data-lgs-vr-mode');
        } catch (_) { /* gone */ }
      }
      function hapticAvailable() {
        try { return typeof hub.main().SteamClient.OpenVR.TriggerOverlayHapticEffect === 'function'; } catch (_) { return false; }
      }
      function stateObj() {
        let sounds = true;
        try { sounds = H.settingsStore.clientSettings.enable_ui_sounds !== false; } catch (_) { /* default on */ }
        const l = computeLive();
        return {
          mode: st.cur.mode, vrMode: st.cur.vrMode, source: st.cur.source,
          stub: st.stub ? { mode: st.stub.mode, vrMode: st.stub.vrMode, until: st.stub.until } : null,
          live: l,
          windows: hub.windows().length,
          subscriptions: {
            navigationSource: true,
            vrOverlayFocus: !!(VRI && typeof VRI.RegisterForNavigationTypeChange === 'function'),
            mobxReaction: !!(VRI && steam.reaction),
          },
          sound: { bus: !!steam.bus, enum: !!steam.PN, uiSoundsEnabled: sounds },
          haptics: { available: hapticAvailable(), armed: flag('haptics') === true },
        };
      }
      function update(reason) {
        if (live !== st) return;
        const before = st.cur;
        st.cur = effective(computeLive());
        hub.scan();
        for (const w of hub.windows()) { const d = hub.docOf(w); if (d) paintDoc(d); }
        if (!before || st.cur.mode !== before.mode || st.cur.vrMode !== before.vrMode) {
          if (!before) return;
          const s = stateObj();
          for (const fn of [...listeners]) {
            try { fn(s, before, reason); } catch (err) { log('error', 'onChange listener failed', String(err && err.stack || err)); }
          }
        }
      }

      // Paint every document the hub hooks (new popups included).
      st.cur = effective(computeLive());
      addUndo(hub.onDoc((w, doc) => { if (st.cur) paintDoc(doc); return () => unpaintDoc(doc); }));

      // ------------------------------------------------ sounds
      function soundId(name) {
        if (typeof name === 'number') return name;
        const n = SOUND_EVENT[name] || name;
        if (steam.PN && typeof steam.PN[n] === 'number') return steam.PN[n];
        const i = PN_FALLBACK.indexOf(n);
        return i >= 0 ? i : undefined;
      }
      function sound(event, opts) {
        if (live !== st) return null;
        if (typeof event === 'string' && SOUND_REFUSED.has(event)) return null;
        const e = soundId(event);
        if (e === undefined) { log('error', 'unknown sound ' + event); return null; }
        const immediate = !!(opts && opts.immediate);
        try {
          if (steam.bus) steam.bus.PlayNavSound(e, immediate);
          else H.SteamUIStore.m_GamepadUIAudioStore.PlayNavSound(e, immediate);
        } catch (err) { log('error', 'PlayNavSound failed', String(err)); return null; }
        return e;
      }

      // ------------------------------------------------ haptics (S17: disarmed unless flag haptics === true)
      function haptic(kind, target) {
        const e = typeof kind === 'number' ? kind : HAPTIC[kind];
        let w = null;
        try { w = target && target.ownerDocument ? target.ownerDocument.defaultView : target; } catch (_) { w = null; }
        if (!w) w = hub.main();
        let fn = null;
        try { fn = w.SteamClient.OpenVR.TriggerOverlayHapticEffect; } catch (_) { fn = null; }
        const armed = flag('haptics') === true;
        const isPanel = !!(target && target.classList && target.classList.contains('Panel'));
        const plan = {
          api: 'SteamClient.OpenVR.TriggerOverlayHapticEffect', effect: e || null,
          available: typeof fn === 'function', armed, mode: st.cur ? st.cur.mode : null, fired: false,
        };
        if (isPanel) plan.refused = 'steam-panel';
        const t = H.performance.now();
        if (!e || !plan.available || !armed || isPanel || !st.cur || st.cur.mode !== 'laser' || t - st.lastPulse < 80) return plan;
        st.lastPulse = t;
        try { fn.call(w.SteamClient.OpenVR, e, 0); plan.fired = true; } catch (err) { plan.error = String(err); }
        return plan;
      }

      // ------------------------------------------------ stub (test hook: our classes only)
      function stub(mode, opts) {
        if (live !== st) return () => {};
        H.clearTimeout(st.stubTimer);
        if (mode === null || mode === undefined || mode === false) {
          if (st.stub) { st.stub = null; update('stub'); }
          return () => {};
        }
        if (mode !== 'pad' && mode !== 'laser') throw new Error('input.stub: mode must be "pad", "laser" or null');
        const o = opts || {};
        const vrMode = o.vrMode === 'gamepad' || o.vrMode === 'laser' ? o.vrMode : null;
        const ttl = typeof o.ttlMs === 'number' && o.ttlMs > 0 ? o.ttlMs : STUB_TTL_MS;
        const token = { mode, vrMode, until: Date.now() + ttl };
        st.stub = token;
        st.stubTimer = H.setTimeout(() => { if (st.stub === token) { st.stub = null; update('stub'); } }, ttl);
        update('stub');
        return () => { if (st.stub === token) { H.clearTimeout(st.stubTimer); st.stub = null; update('stub'); } };
      }

      // ------------------------------------------------ sticky marks (P3-internal)
      // Steam renders className through React: a re-render (e.g. the one that adds .gpfocus right
      // after vgp_onfocus) overwrites the class attribute and drops our classes. A mark is re-added
      // by a MutationObserver callback (a microtask, so before the frame is painted) until it is
      // released. One observer per document; it only watches the elements we marked.
      // Weak by design (review R1 F1): the registry never keeps an element alive. Marked elements are
      // held through a WeakMap (element -> classes) and a WeakRef set used only to sweep on removal,
      // so a page Steam unmounts while one of its nodes is marked is still collected.
      const WR = typeof H.WeakRef === 'function' ? H.WeakRef : null;
      const marks = (() => {
        const perDoc = new Map();   // doc -> { mo, want: WeakMap(el -> {cls: Set, ref}), refs: Set(WeakRef | el) }
        const deref = (ref) => (WR && ref instanceof WR ? ref.deref() : ref);
        function recFor(doc) {
          let r = perDoc.get(doc);
          if (r) return r;
          const want = new WeakMap();
          const view = doc.defaultView || H;
          const MO = view.MutationObserver || H.MutationObserver;
          const mo = new MO((muts) => {
            for (const m of muts) {
              const w = want.get(m.target);
              if (!w) continue;
              for (const c of w.cls) if (!m.target.classList.contains(c)) m.target.classList.add(c);
            }
          });
          r = { mo, want, refs: new Set() };
          perDoc.set(doc, r);
          return r;
        }
        function dropDoc(doc, r) { try { r.mo.disconnect(); } catch (_) { /* gone */ } perDoc.delete(doc); }
        // Forget collected elements and closed documents (cheap: a handful of marks are live at a time).
        function prune() {
          for (const [doc, r] of perDoc) {
            for (const ref of r.refs) { const el = deref(ref); if (!el) r.refs.delete(ref); }
            if (!r.refs.size || !doc.defaultView) dropDoc(doc, r);
          }
        }
        function add(el, cls) {
          if (!el || el.nodeType !== 1) return;
          const r = recFor(el.ownerDocument);
          let w = r.want.get(el);
          if (!w) {
            w = { cls: new Set(), ref: WR ? new WR(el) : el };
            r.want.set(el, w);
            r.refs.add(w.ref);
            r.mo.observe(el, { attributes: true, attributeFilter: ['class'] });
            if (r.refs.size > 32) prune();
          }
          w.cls.add(cls);
          el.classList.add(cls);
        }
        function remove(el, cls) {
          if (!el || el.nodeType !== 1) return;
          const doc = el.ownerDocument;
          const r = perDoc.get(doc);
          const w = r && r.want.get(el);
          if (w) {
            w.cls.delete(cls);
            if (!w.cls.size) {
              r.want.delete(el);
              r.refs.delete(w.ref);
              if (!r.refs.size) dropDoc(doc, r);   // disconnect also drops stale observations
            }
          }
          try { el.classList.remove(cls); } catch (_) { /* gone */ }
        }
        function has(el, cls) {
          const r = el && perDoc.get(el.ownerDocument);
          const w = r && r.want.get(el);
          return !!(w && w.cls.has(cls));
        }
        // Release every mark whose class passes pred (a module's own sweep on its removal).
        function sweep(pred) {
          for (const [doc, r] of [...perDoc]) {
            for (const ref of [...r.refs]) {
              const el = deref(ref);
              const w = el && r.want.get(el);
              if (!w) { r.refs.delete(ref); continue; }
              for (const c of [...w.cls]) if (pred(c)) remove(el, c);
            }
            if (perDoc.get(doc) === r && !r.refs.size) dropDoc(doc, r);
          }
        }
        function clear() {
          for (const r of perDoc.values()) {
            try { r.mo.disconnect(); } catch (_) { /* gone */ }
            for (const ref of r.refs) {
              const el = deref(ref);
              const w = el && r.want.get(el);
              if (w) { try { el.classList.remove(...w.cls); } catch (_) { /* gone */ } }
            }
          }
          perDoc.clear();
        }
        function count() { prune(); let n = 0; for (const r of perDoc.values()) n += r.refs.size; return n; }
        return { add, remove, has, sweep, clear, count, weak: !!WR };
      })();
      addUndo(() => marks.clear());

      const api = {
        get mode() { return st.cur.mode; },
        get vrMode() { return st.cur.vrMode; },
        get source() { return st.cur.source; },
        state: stateObj,
        onChange(fn) {
          if (typeof fn !== 'function') throw new Error('input.onChange: function expected');
          listeners.add(fn);
          return () => { listeners.delete(fn); };
        },
        stub,
        windows() { return hub.windows(); },
        surfaceOf(w) { return hub.surfaceOf(w); },
        sound,
        soundId,
        haptic,
        // P3-internal: the per-document hook hub, sticky class marks and lazy %{Token} selectors
        // shared by attention, states and tooltip.
        hub,
        marks,
        lazySel,
        // Test hook (review R1 F6): make lazy selectors see a stand-in class index, e.g. one that has not
        // indexed a token yet; null restores P1's. Only P3's own resolution is affected, never the theme's.
        test: {
          index(fake) { INDEX_OVERRIDE = fake && typeof fake.selector === 'function' ? fake : null; return !!INDEX_OVERRIDE; },
        },
      };
      addUndo(() => { INDEX_OVERRIDE = null; });

      // ------------------------------------------------ subscriptions (each undo registered at once)
      const s1 = FNC.NavigationSource.Subscribe(() => update('source'));
      addUndo(() => s1.Unsubscribe());
      if (VRI && typeof VRI.RegisterForNavigationTypeChange === 'function') {
        const s2 = VRI.RegisterForNavigationTypeChange(() => update('vr-overlay-focus'));
        addUndo(() => s2.Unregister());
      }
      if (VRI && steam.reaction) {
        const dispose = steam.reaction(() => { try { return VRI.IsInGamepadNav; } catch (_) { return null; } }, () => update('vr-mode'));
        addUndo(dispose);
      } else if (VRI) {
        const t = H.setInterval(() => update('poll'), 2000);   // last resort when MobX is not found
        addUndo(() => H.clearInterval(t));
      }
      if (!hub.p1) {
        const pending = new Set();
        addUndo(() => { for (const t of pending) H.clearTimeout(t); pending.clear(); });
        const pc = PM.AddPopupCreatedCallback((p) => {
          for (const ms of [0, 250, 1000]) {
            const t = H.setTimeout(() => {
              pending.delete(t);
              if (live !== st) return;
              try { if (p.window) hub.scan(); for (const w of hub.windows()) { const d = hub.docOf(w); if (d) paintDoc(d); } } catch (_) { /* closed */ }
            }, ms);
            pending.add(t);
          }
        });
        addUndo(() => pc.Unregister());
        const pd = PM.AddPopupDestroyedCallback((p) => {
          let w = null;
          try { w = p.window; } catch (_) { /* gone */ }
          if (w) hub.drop(w);
        });
        addUndo(() => pd.Unregister());
      }

      hub.scan();
      for (const w of hub.windows()) { const d = hub.docOf(w); if (d) paintDoc(d); }
      // PLAN §1.4: one accessor, __LGS_RT.input, on the public runtime object, so every module's scoped
      // rt (Object.create(public)) and the lab (__LGS_RT.input.stub) see it. Through P1's rt.expose
      // (tracked: deleted when this module is removed); plain assignment only without it.
      function expose(name, value) {
        const P = PUB();
        if (R && R !== P && typeof R.expose === 'function') {
          try { addUndo(R.expose(name, value)); return; } catch (err) { log('warn', 'rt.expose(' + name + ') refused; assigning', String(err)); }
        }
        P[name] = value;
        addUndo(() => { if (P[name] === value) delete P[name]; });
      }
      expose('input', api);
      expose('sound', sound);
      expose('haptic', haptic);
      return api;
    },
    remove() {
      const st = live;
      live = null;
      if (st && st.remove) st.remove();
      const P = PUB();
      if (P && st && P.input && P.input.hub === st.hub) { delete P.input; delete P.sound; delete P.haptic; }
      R = null;
    },
  });
})();
