// Glass Shell runtime module "cc" (package C3b): Control Center in the main window (CC-M) and the
// status pill patch (CC3). Concept: docs/phase2/concepts/control-center.md (CC) §4; PLAN §1.2-§1.8.
// Contracts: react.md (P2: patch.targets.statusPill, ui.modal, ui.menu, find, actions), runtime.md
// (P1), reporter.md (P6: data-lgs-plate*), interaction.md (P3: data-lgs-tip). Behind flag wp.c3b.
// The DOM class names are the contract with theme/31-cc.css part B.
//
// What it does while installed:
//   - patches the bar's status pill (P2 target statusPill): activating it opens CC-M while Steam's main
//     window is the page the dashboard shows, else Steam's own Quick Access (CC-C, unchanged); the pill
//     again closes CC-M; the menu button (≡) always opens Steam's Quick Access (CC3);
//   - CC-M is a Steam modal in the main window (ui.modal: the route stays mounted, CC §4.2): three tiles
//     (Now, Controls, Room) and a close circle, each a glass plate (data-lgs-plate, PLAN §1.6);
//     Steam's page layers fade out under it (data-lgs-cc-fade, opacity only), C1a's glass mode goes
//     to windowless through shell.glassMode('*') when the shell runs;
//   - every control calls the handler Steam's own control calls, found by reading Steam's modules
//     (CC §4.10): the toggles are Steam's Quick Access toggles' own value and onChange (extracted
//     from the element Steam's component returns), the sliders ARE Steam's slider components, Room
//     View / Recenter / Playspace are the bar's SteamVR dashboard actions (the bar's own hook),
//     Return to Game is the bar tab's DashboardTabClicked, Power is SteamUIStore.OpenPowerMenu;
//   - More Controls renders Steam's own Quick Access tab panels (Steam's tab list hook) inside CC;
//     the notification list renders Steam's Notifications panel in place in the Now tile;
//   - every side effect goes through act(): run only when P2's actions mode is 'live' (flag
//     actionsLive, a trusted event) and the spy is off; otherwise logged (CC.log, api.log()).
// A control whose Steam handler is not found is not drawn (its function stays on the bar and in
// Steam's Quick Access, CC-C). install() fails closed if the pill cannot be patched.

/* eslint-disable no-var */
__LGS_RT.define({
  name: 'cc',
  deps: ['react'],
  flag: 'wp.c3b',
  install(rt) { return ccInstall(rt); },
  remove() { return ccRemove(); },
});

var CC = null;

// Steam strings (PLAN §1.15): tokens first; English only on an English UI
var CC_STR = {
  notifications: ['#QuickAccess_Tab_Notifications_Title', 'Notifications'],
  more: ['#QuickAccess_Tab_Settings_Title', 'Quick Settings'],
  perf: ['#QuickAccess_Tab_Perf_Title', 'Performance'],
  battery: ['#VRDashboardBar_BatteryStatus', 'Battery'],
  qam: ['#VRDashboard_QuickAccessMenu', 'Quick Access Menu'],
  settings: ['#MainTabsSettings', 'Settings'],
  power: ['#Power', 'Power'],
  close: ['#Button_Close', 'Close'],
  back: ['#Button_Back', 'Back'],
  wifi: ['#QuickAccess_Tab_Settings_Section_Shortcuts_Wifi', 'Wi-Fi'],
  bt: ['#QuickAccess_Tab_Bluetooth_ToggleLabel', 'Bluetooth'],
  air: ['#QuickAccess_Tab_Settings_Section_Shortcuts_AirplaneMode', 'Airplane Mode'],
  motion: ['#QuickAccess_Tab_Perf_VRMotionSmoothing', 'Motion Smoothing'],
  off: ['#Settings_Off', 'Off'],
  on: ['#Settings_On', 'On'],
  resume: ['#AppDetails_ResumeGame', 'Resume'],
  notPlaying: [null, 'Not Playing'],
  noNotif: ['#QuickAccess_Tab_Notifications_None', 'No new notifications'],
};
var CC_ROOMVIEW_ID = 432800007;  // SteamVR "Toggle Room View" (CC §4.10, SY)
var CC_PLAYSPACE_ID = 432800001; // SteamVR "Playspace Menu"

function ccStr(R, key) {
  const t = CC_STR[key]; if (!t) return '';
  let s = null;
  try { s = t[0] ? R.ui.text(t[0], t[1]) : (String(R.ui.lang()).startsWith('en') ? t[1] : null); } catch (_) { s = null; }
  return s || '';
}

// ------------------------------------------------------------------ finders (CC §4.10, read-only)
function ccFinders() {
  const fn = (v) => typeof v === 'function';
  return {
    qamTabs: [['vrLocation', 'quick-access-menu', '#QuickAccess_Tab_Help_Title'],
      (ex, u) => u.pick(ex, (v, s) => fn(v) && s.includes('vrLocation') && s.includes('useMemo') && s.includes('panel:'))],
    wifi: [['SetWifiEnabled', '#QuickAccess_Tab_Settings_Section_Shortcuts_Wifi'],
      (ex, u) => u.pick(ex, (v, s) => fn(v) && s.includes('SetWifiEnabled') && s.length < 1200)],
    bt: [['"system_bluetooth_enabled"', '#QuickAccess_Tab_Bluetooth_ToggleLabel'],
      (ex, u) => u.pick(ex, (v, s) => fn(v) && s.includes('system_bluetooth_enabled') && !s.includes('rPairedDevices'))],
    vr: [['motion_smoothing_value', 'env_brightness_construct_theater', 'SetDisplayBrightness'], (ex, u) => {
      const motion = u.pick(ex, (v, s) => fn(v) && s.includes('motion_smoothing:'));
      const bright = u.pick(ex, (v, s) => fn(v) && s.includes('SetDisplayBrightness'));
      const env = u.pick(ex, (v, s) => fn(v) && s.includes('env_brightness_construct_theater:'));
      return motion || bright || env ? { motion, bright, env } : null;
    }],
    audio: [['#Audio_OutputVolume', '#Audio_InputVolume'],
      (ex, u) => u.pick(ex, (v, s) => fn(v) && s.includes('#Audio_OutputVolume') && s.includes('aria-label') && s.length < 400)],
    sys: [['AirplaneModeEnabled', 'SetAirplaneMode'], (ex, u) => {
      const hook = u.pick(ex, (v, s) => fn(v) && s.includes('AirplaneModeEnabled') && s.length < 200);
      const store = u.pick(ex, (v) => v && fn(v.Get) && (() => { try { return fn(v.Get().SetAirplaneMode); } catch (_) { return false; } })());
      return hook && store ? { hook, store } : null;
    }],
    bar: [['fnInvokeAction', 'VRDashboardBarSmallButton', 'mutualCapabilities'], (ex, u) => {
      const actions = u.pick(ex, (v, s) => fn(v) && s.includes('mutualCapabilities') && s.includes('defined_actions') && s.length < 2000);
      const invoke = u.pick(ex, (v, s) => fn(v) && s.includes('fnInvokeAction') && s.includes('bVisuallyActive'));
      const tabs = u.pick(ex, (v, s) => fn(v) && s.includes('rgTabsToShow') && s.includes('vr_steam_tab_id'));
      return actions && invoke ? { actions, invoke, tabs } : null;
    }],
    vrMsg: [['VRGamepadUIMessages', 'm_SteamVR_ClientMethods'], (ex) => {
      for (const k of Object.keys(ex)) {
        let v; try { v = ex[k]; } catch (_) { continue; }
        if (v && v.SteamVR && typeof v.SteamVR.DashboardTabClicked === 'function') return v;
      }
      return null;
    }],
    icons: [['AirplaneMode:()=>', 'Recenter:()=>', 'Playspace:()=>'],
      (ex) => (ex && ex.WiFi && ex.AirplaneMode && ex.Settings ? ex : null)],
  };
}

// ------------------------------------------------------------------ helpers
function ccNavNode(R, el) {
  for (let f = el ? R.fiber.of(el) : null, i = 0; f && i < 12; i++, f = f.return) {
    const n = f.memoizedProps && f.memoizedProps.node;
    if (n && typeof n.BTakeFocus === 'function') return n;
  }
  return null;
}
function ccFocusEl(R, el) { const n = ccNavNode(R, el); if (!n) return false; try { n.BTakeFocus(3); return true; } catch (_) { return false; } }

// The callable behind a React element type (function, memo, forwardRef); null for classes and hosts.
function ccCallable(t) {
  if (typeof t === 'function') return t.prototype && t.prototype.isReactComponent ? null : t;
  if (t && t.$$typeof) {
    const s = String(t.$$typeof);
    if (s.includes('memo')) return ccCallable(t.type);
    if (s.includes('forward_ref') && typeof t.render === 'function') return (p) => t.render(p, null);
  }
  return null;
}
// The first element with a boolean `checked` and an `onChange` in Steam's returned tree. The search
// never calls a component until the plain tree is exhausted, then calls the FIRST component in tree
// order (its hooks become ours, in a fixed order). Depth-limited.
function ccFindToggle(el, depth) {
  if (!el || depth > 4) return null;
  const q = [el]; let comp = null;
  while (q.length) {
    const e = q.shift();
    if (!e || typeof e !== 'object') continue;
    if (Array.isArray(e)) { for (const x of e) q.push(x); continue; }
    const p = e.props; if (!p) continue;
    if (typeof p.onChange === 'function' && typeof p.checked === 'boolean') return e;
    if (!comp && typeof e.type !== 'string' && ccCallable(e.type)) comp = e;
    if (p.children) q.push(p.children);
  }
  if (!comp) return null;
  return ccFindToggle(ccCallable(comp.type)(comp.props), depth + 1);
}

// ------------------------------------------------------------------ install / remove
function ccInstall(rt) {
  const R = rt.react || rt.use('react');
  R.ready(); // fail closed (P2 rule 2)
  const found = R.find(ccFinders());
  const M = found.mods;
  CC = { rt, R, M, where: found.where, counts: found.counts, inst: null, opening: false, closing: false, spy: false,
    log: [], fade: [], attrEls: [], glassHook: null, pillHandle: null, routeAtOpen: null, timers: [], lastErr: null, debug: {} };
  const S = CC;
  const { jsx, jsxs, React } = R;
  const c = R.c;
  const e = React.createElement;

  // ---------------------------------------------------------------- side effects (logged in test mode)
  function act(name, fn, ev) {
    let mode = 'test', reasons = [];
    try { if (!S.spy) { const m = R.actions.mode(ev); mode = m.mode; reasons = m.reasons || []; } else reasons = ['spy']; } catch (_) { reasons = ['unreadable']; }
    const rec = { t: Date.now(), name, mode: mode === 'live' ? 'executed' : 'logged', reasons };
    S.log.push(rec); if (S.log.length > 60) S.log.shift();
    if (mode !== 'live') return rec;
    try { fn(); } catch (err) { rec.error = String(err && err.message || err); rt.warn('cc: ' + name + ' failed', rec.error); }
    return rec;
  }

  // ---------------------------------------------------------------- open / close
  function mainEntry() { try { return rt.windows.main(); } catch (_) { return null; } }
  function eligible() {
    const m = mainEntry();
    if (!m) return false;
    try { if (!m.visible()) return false; } catch (_) { return false; }
    return true;
  }
  function setAttrAll(on) {
    if (!on) { for (const h of S.attrEls) { try { h.removeAttribute('data-lgs-cc'); } catch (_) { /* gone */ } } S.attrEls = []; return; }
    try {
      rt.windows.each((w) => {
        if (w.kind !== 'main' && w.kind !== 'bar') return;
        w.html.setAttribute('data-lgs-cc', 'open'); S.attrEls.push(w.html);
      });
    } catch (_) { /* window gone */ }
  }
  function basicRoot() {
    const m = mainEntry(); if (!m) return null;
    try { return m.doc.querySelector(rt.sel('%{BasicUiRoot}')); } catch (_) { return null; }
  }
  // Fade Steam's page layers: every sibling of each ancestor of our root, up to BasicUiRoot (opacity
  // only; nothing removed, moved or resized; CC §4.2).
  function fadeOn(rootEl) {
    fadeOff();
    const top = basicRoot();
    if (!rootEl || !top || !top.contains(rootEl)) return;
    top.setAttribute('data-lgs-cc', 'open'); S.attrEls.push(top);
    for (let n = rootEl; n && n !== top; n = n.parentElement) {
      const p = n.parentElement; if (!p) break;
      for (const sib of p.children) {
        if (sib === n || sib.hasAttribute('data-lgs-cc-fade')) continue;
        sib.setAttribute('data-lgs-cc-fade', '');
        S.fade.push(sib);
      }
    }
  }
  function fadeOff() {
    for (const n of S.fade) { try { n.removeAttribute('data-lgs-cc-fade'); } catch (_) { /* gone */ } }
    S.fade = [];
  }
  function glassOn() {
    try {
      if (!S.glassHook && rt.has('shell')) {
        const sh = rt.use('shell');
        S.glassHook = sh.glassMode('*', () => (S.inst || S.opening ? 'windowless' : null));
        sh.refreshGlass();
      }
    } catch (err) { rt.warn('cc: glassMode', String(err && err.message || err)); }
  }
  function glassOff() {
    const h = S.glassHook; S.glassHook = null;
    try { if (h) h.remove(); if (rt.has('shell')) rt.use('shell').refreshGlass(); } catch (_) { /* shell gone */ }
  }
  function clearTimers() { for (const off of S.timers) { try { off(); } catch (_) { /* done */ } } S.timers = []; }

  async function open(ev, source) {
    if (S.inst || S.opening) { close('toggle'); return { opened: false, closed: true }; }
    if (!eligible()) return { opened: false, reason: 'main window not shown' };
    S.opening = true; S.closing = false;
    S.routeAtOpen = safeRoute();
    setAttrAll(true);
    glassOn();
    try {
      S.inst = await R.ui.modal(jsx(CCView, { source: source || 'api' }));
    } catch (err) {
      S.opening = false; setAttrAll(false); glassOff();
      S.lastErr = String(err && err.message || err);
      rt.warn('cc: open failed', S.lastErr);
      return { opened: false, error: S.lastErr };
    }
    S.opening = false;
    // close when the main window navigates or hides (CC §4.1)
    clearTimers();
    S.timers.push(rt.setInterval(() => {
      if (!S.inst) return;
      const r = safeRoute();
      if (r && S.routeAtOpen && r !== S.routeAtOpen) close('route');
    }, 300));
    return { opened: true };
  }
  function safeRoute() { try { return R.nav.route(); } catch (_) { return null; } }
  function close(reason) {
    if (!S.inst && !S.opening) return false;
    if (S.closing) return true;
    S.closing = true;
    S.closeReason = reason || 'close';
    if (S.setClosing) { try { S.setClosing(true); } catch (_) { /* unmounted */ } }
    const inst = S.inst;
    fadeRestore();
    const done = () => {
      clearTimers();
      try { if (inst) inst.Close(); } catch (_) { /* already closed */ }
      S.inst = null; S.closing = false; S.setClosing = null; S.setPage = null;
      setAttrAll(false); glassOff();
    };
    const reduce = (() => { try { return mainEntry().win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
    if (reason === 'teardown') { done(); fadeOff(); return true; }
    // the tiles dematerialize (mat-out, 350 ms); the page layers finish their fade back (441 ms)
    rt.setTimeout(done, reduce ? 180 : 350);
    rt.setTimeout(() => { if (!S.inst && !S.opening) fadeOff(); }, reduce ? 200 : 460);
    return true;
  }
  // the page layers start coming back while the tiles dematerialize (CC §4.2: from 40 % of the close)
  function fadeRestore() { for (const n of S.fade) { try { n.setAttribute('data-lgs-cc-fade', 'out'); } catch (_) { /* gone */ } } }

  // ---------------------------------------------------------------- icons (Steam's own where found)
  const IC = M.icons || {};
  function svg(d, extra) {
    return jsx('svg', { className: 'lgs-cc-ic', viewBox: '0 0 24 24', 'aria-hidden': 'true', children: jsx('path', Object.assign({ d, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, extra || {})) });
  }
  const GLYPH = {
    close: () => svg('M6 6l12 12M18 6L6 18'),
    back: () => svg('M15 5l-7 7 7 7'),
    chev: () => svg('M9 5l7 7-7 7'),
    gear: () => (IC.Settings ? jsx(IC.Settings, {}) : svg('M12 8a4 4 0 100 8 4 4 0 000-8zM4 12h2M18 12h2M12 4v2M12 18v2')),
    power: () => (IC.Power ? jsx(IC.Power, {}) : svg('M12 3v9M6.3 6.3a8 8 0 1011.4 0')),
    motion: () => svg('M3 12c2.5-5 5.5-5 8 0s5.5 5 8 0M3 17c2.5-5 5.5-5 8 0'),
    recenter: () => (IC.Recenter ? jsx(IC.Recenter, {}) : svg('M12 3v4M12 17v4M3 12h4M17 12h4M12 9a3 3 0 100 6 3 3 0 000-6z')),
    playspace: () => (IC.Playspace ? jsx(IC.Playspace, {}) : svg('M4 8l8-4 8 4-8 4-8-4zM4 8v8l8 4 8-4V8')),
    battery: () => (IC.BatterySimple ? jsx(IC.BatterySimple, {}) : svg('M3 8h15v8H3zM20 11v2')),
    bell: () => (IC.Notifications ? jsx(IC.Notifications, {}) : svg('M6 16V11a6 6 0 1112 0v5l2 2H4zM10 20h4')),
    perf: () => (IC.QAMPerformance ? jsx(IC.QAMPerformance, {}) : svg('M4 18l5-6 4 3 7-9')),
    play: () => svg('M8 5l11 7-11 7z', { fill: 'currentColor', stroke: 'none' }),
    sliders: () => svg('M5 7h14M5 17h14M9 4v6M15 14v6'),
  };

  // ---------------------------------------------------------------- small controls
  // One focusable control: an 80 px hit box (PLAN §1.3) that draws its visible glass inside.
  function Ctl(props) {
    const { k, cls, label, tip, onAct, children, extra } = props;
    return jsx(c.Focusable, Object.assign({
      className: 'lgs-cc-hit ' + (cls || ''),
      noFocusRing: true,
      'data-lgs-cc-k': k,
      'aria-label': label || undefined,
      'data-lgs-tip': tip ? '' : undefined,
      onActivate: onAct,
      children,
    }, extra || {}));
  }
  const ref = {};
  const focusK = (k) => { const el = ref.root && ref.root.querySelector('[data-lgs-cc-k="' + k + '"]'); return el ? ccFocusEl(R, el) : false; };
  // explicit neighbours (CC §4.8): a handler returns true when it moved focus itself
  const NB = {
    power: { right: 'wifi' },
    wifi: { left: 'power' },
    battery: { right: 'perf' },
    perf: { left: 'battery', right: 'segoff' },
    ret: { right: 'more' },
    notif: { right: 'more' },
    more: { left: ['ret', 'notif'], right: 'segoff' },
    segoff: { left: 'perf' },
    motion: { right: 'recenter' },
    recenter: { left: 'motion' },
  };
  function nbProps(k) {
    const nb = NB[k]; if (!nb) return {};
    const go = (t) => () => { const list = Array.isArray(t) ? t : [t]; for (const x of list) if (focusK(x)) return true; return false; };
    const o = {};
    if (nb.right) o.onMoveRight = go(nb.right);
    if (nb.left) o.onMoveLeft = go(nb.left);
    return o;
  }

  // A round toggle bound to the value and onChange of Steam's own Quick Access toggle.
  function SteamToggle({ k, resolve, glyph, labelKey, tone }) {
    let el = null;
    try { el = resolve(); } catch (err) { S.debug['tog_' + k] = String(err && err.message || err); el = null; }
    if (!el) return null;
    const p = el.props;
    const on = !!p.checked, dis = !!p.disabled;
    const label = (typeof p.label === 'string' && p.label) || ccStr(R, labelKey);
    return jsx(Ctl, {
      k, cls: 'lgs-cc-tog' + (on ? ' is-on' : '') + (dis ? ' is-disabled' : ''), label, tip: true,
      extra: Object.assign({ 'aria-pressed': on ? 'true' : 'false', 'aria-disabled': dis ? 'true' : undefined, 'data-tone': tone || 'blue', autoFocus: k === 'wifi' }, nbProps(k)),
      onAct: (ev) => { if (!dis) act(k, () => p.onChange(!on), ev); },
      children: jsx('div', { className: 'lgs-cc-tog-face', children: p.icon || glyph() }),
    });
  }
  function Guard({ name, children }) { return jsx(R.ui.ErrorBoundary, { name: 'cc.' + name, fallback: null, children }); }

  // ---------------------------------------------------------------- tiles
  function useClock() {
    const [now, setNow] = React.useState(() => new Date());
    React.useEffect(() => { const id = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(id); }, []);
    return now;
  }
  function locale() { try { return R.nav.win().navigator.language || 'en-US'; } catch (_) { return 'en-US'; } }

  function NowTile({ page, setPage }) {
    const now = useClock();
    const loc = locale();
    let date = '', time = '';
    try { date = now.toLocaleDateString(loc, { weekday: 'short', month: 'short', day: 'numeric' }); } catch (_) { date = now.toDateString(); }
    try { time = now.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AaPp]\.?[Mm]\.?$/, ''); } catch (_) { time = ''; }
    if (page === 'notif') return jsx(NotifPage, { setPage });
    return jsxs('div', { className: 'lgs-cc-now-main', children: [
      jsxs(c.Focusable, { className: 'lgs-cc-corners', 'flow-children': 'row', children: [
        jsx(Ctl, { k: 'settings', cls: 'lgs-cc-circle is-tl', label: ccStr(R, 'settings'), tip: true, extra: {},
          onAct: (ev) => { const r = (R.Routes.Settings && typeof R.Routes.Settings.Root === 'function') ? R.Routes.Settings.Root() : '/settings'; close('settings'); R.actions.navigate(r, {}, ev); },
          children: jsx('div', { className: 'lgs-cc-circle-face', children: GLYPH.gear() }) }),
        jsx(Ctl, { k: 'power', cls: 'lgs-cc-circle is-tr', label: ccStr(R, 'power'), tip: true, extra: Object.assign({}, nbProps('power')),
          onAct: (ev) => {
            const doc = (() => { try { return R.nav.win().document.documentElement; } catch (_) { return null; } })();
            close('power');
            act('power', () => rt.W.SteamUIStore.OpenPowerMenu(doc), ev);
          },
          children: jsx('div', { className: 'lgs-cc-circle-face', children: GLYPH.power() }) }),
      ] }),
      jsx('div', { className: 'lgs-cc-date', children: date }),
      jsx('div', { className: 'lgs-cc-clock', children: time }),
      jsx(Ctl, { k: 'battery', cls: 'lgs-cc-cap is-battery', label: ccStr(R, 'battery'), extra: Object.assign({}, nbProps('battery')),
        onAct: () => { setPage('more', 'battery'); },
        children: jsxs('div', { className: 'lgs-cc-cap-face', children: [jsx('span', { className: 'lgs-cc-cap-ic', children: GLYPH.battery() }),
          jsx('span', { className: 'lgs-cc-cap-label', children: ccStr(R, 'battery') }), jsx('span', { className: 'lgs-cc-chev', children: GLYPH.chev() })] }) }),
      jsx(Guard, { name: 'nowplaying', children: jsx(NowPlaying, {}) }),
      jsx(Ctl, { k: 'notif', cls: 'lgs-cc-cap is-notif', label: ccStr(R, 'notifications'), extra: Object.assign({}, nbProps('notif')),
        onAct: () => setPage('notif'),
        children: jsxs('div', { className: 'lgs-cc-cap-face', children: [jsx('span', { className: 'lgs-cc-cap-ic', children: GLYPH.bell() }),
          jsx('span', { className: 'lgs-cc-cap-label', children: ccStr(R, 'notifications') }), jsx('span', { className: 'lgs-cc-chev', children: GLYPH.chev() })] }) }),
    ] });
  }

  function NowPlaying() {
    let info = null;
    if (M.bar && M.bar.tabs) {
      const t = M.bar.tabs() || {};
      const proto = t.tabsProto || {};
      const tabs = (t.rgTabsToShow || []).filter((x) => x && x.tab_id != null && x.tab_id !== proto.vr_steam_tab_id && x.tab_id !== proto.deprecated_vr_settings_tab_id);
      S.debug.tabKeys = tabs[0] ? Object.keys(tabs[0]).slice(0, 20) : [];
      const tab = tabs[0];
      if (tab) info = { id: tab.tab_id, name: tab.display_name || tab.label || tab.name || tab.title || '' };
    }
    if (!info) {
      return jsxs('div', { className: 'lgs-cc-platter lgs-cc-np is-idle', children: [jsx('div', { className: 'lgs-cc-np-disc' }),
        jsx('div', { className: 'lgs-cc-np-text', children: jsx('div', { className: 'lgs-cc-np-sub', children: ccStr(R, 'notPlaying') }) })] });
    }
    return jsxs('div', { className: 'lgs-cc-platter lgs-cc-np', children: [
      jsxs('div', { className: 'lgs-cc-np-head', children: [jsx('div', { className: 'lgs-cc-np-disc', children: GLYPH.play() }),
        jsx('div', { className: 'lgs-cc-np-text', children: jsx('div', { className: 'lgs-cc-np-title', children: info.name }) })] }),
      jsx(Ctl, { k: 'ret', cls: 'lgs-cc-cap is-return', label: ccStr(R, 'resume') || info.name, extra: Object.assign({}, nbProps('ret')),
        onAct: (ev) => { close('return'); act('return', () => M.vrMsg.SteamVR.DashboardTabClicked({ tab_id: info.id }).catch(() => {}), ev); },
        children: jsxs('div', { className: 'lgs-cc-cap-face is-center', children: [jsx('span', { className: 'lgs-cc-cap-ic', children: GLYPH.play() }),
          jsx('span', { className: 'lgs-cc-cap-label', children: ccStr(R, 'resume') || info.name })] }) }),
    ] });
  }

  function NotifPage({ setPage }) {
    const tabs = useQamTabs();
    const t = tabs.find((x) => x.name === 'notifications');
    React.useEffect(() => { rt.setTimeout(() => focusK('nback'), 60); }, []);
    return jsxs(c.Focusable, { className: 'lgs-cc-list', 'flow-children': 'column', children: [
      jsxs('div', { className: 'lgs-cc-head', children: [
        jsx(Ctl, { k: 'nback', cls: 'lgs-cc-circle is-tl', label: ccStr(R, 'back'), extra: {}, onAct: () => setPage('main', null, 'notif'),
          children: jsx('div', { className: 'lgs-cc-circle-face', children: GLYPH.back() }) }),
        jsx('div', { className: 'lgs-cc-head-title', children: ccStr(R, 'notifications') }),
      ] }),
      jsx(c.ScrollPanel || 'div', { className: 'lgs-cc-scroll', children: t ? jsx(Guard, { name: 'notif', children: t.panel }) : jsx('div', { className: 'lgs-cc-empty', children: ccStr(R, 'noNotif') }) }),
    ] });
  }

  // Steam's own Quick Access tab list (CC12): [{key, tab, strTitle, panel, name}] for the QAM location.
  // `name` is ours: matched by Steam's own localized title strings (the tab enum is minified).
  const QAM_TITLES = { notifications: '#QuickAccess_Tab_Notifications_Title', settings: '#QuickAccess_Tab_Settings_Title',
    perf: '#QuickAccess_Tab_Perf_Title', battery: '#VRDashboardBar_BatteryStatus', help: '#QuickAccess_Tab_Help_Title' };
  function useQamTabs() {
    let list = [];
    if (M.qamTabs) { try { list = M.qamTabs('quick-access-menu') || []; } catch (err) { S.debug.qamTabs = String(err && err.message || err); list = []; } }
    const titles = {};
    for (const n in QAM_TITLES) { try { const t = R.ui.loc(QAM_TITLES[n]); if (t) titles[t] = n; } catch (_) { /* no token */ } }
    return list.filter((t) => t && t.panel && t.strTitle).map((t) => Object.assign({}, t, { name: titles[t.strTitle] || String(t.key) }));
  }

  function ControlsTile({ page, setPage, moreKey }) {
    if (page === 'more') return jsx(MorePage, { setPage, moreKey });
    const toggles = [];
    if (M.wifi) toggles.push(jsx(Guard, { name: 'wifi', children: jsx(SteamToggle, { k: 'wifi', labelKey: 'wifi', glyph: GLYPH.sliders, resolve: () => ccFindToggle(M.wifi({}), 0) }) }, 'wifi'));
    if (M.bt) toggles.push(jsx(Guard, { name: 'bt', children: jsx(SteamToggle, { k: 'bt', labelKey: 'bt', glyph: GLYPH.sliders, resolve: () => ccFindToggle(M.bt({ label: ccStr(R, 'bt') }), 0) }) }, 'bt'));
    if (M.sys) toggles.push(jsx(Guard, { name: 'air', children: jsx(SteamToggle, { k: 'air', labelKey: 'air', tone: 'orange', glyph: GLYPH.sliders, resolve: () => {
      const v = !!M.sys.hook();
      return { props: { checked: v, onChange: (x) => M.sys.store.Get().SetAirplaneMode(x), label: ccStr(R, 'air'), icon: IC.AirplaneMode ? jsx(IC.AirplaneMode, {}) : null } };
    } }) }, 'air'));
    if (M.vr && M.vr.motion) toggles.push(jsx(Guard, { name: 'motion', children: jsx(SteamToggle, { k: 'motion', labelKey: 'motion', glyph: GLYPH.motion, resolve: () => ccFindToggle(M.vr.motion({}), 0) }) }, 'motion'));
    const rows = [];
    rows.push(jsx(Ctl, { k: 'perf', cls: 'lgs-cc-row', label: ccStr(R, 'perf'), extra: Object.assign({}, nbProps('perf')), onAct: () => setPage('more', 'perf'),
      children: jsxs('div', { className: 'lgs-cc-row-face', children: [jsx('span', { className: 'lgs-cc-row-ic', children: GLYPH.perf() }), jsx('span', { className: 'lgs-cc-row-label', children: ccStr(R, 'perf') }), jsx('span', { className: 'lgs-cc-chev', children: GLYPH.chev() })] }) }, 'perf'));
    rows.push(jsx(Ctl, { k: 'more', cls: 'lgs-cc-row', label: ccStr(R, 'more'), extra: Object.assign({}, nbProps('more')), onAct: () => setPage('more', S.lastMore || 'settings'),
      children: jsxs('div', { className: 'lgs-cc-row-face', children: [jsx('span', { className: 'lgs-cc-row-ic', children: GLYPH.sliders() }), jsx('span', { className: 'lgs-cc-row-label', children: ccStr(R, 'more') }), jsx('span', { className: 'lgs-cc-chev', children: GLYPH.chev() })] }) }, 'more'));
    const sliders = [];
    if (M.audio) {
      sliders.push(jsx('div', { className: 'lgs-cc-slider', 'data-lgs-cc-s': 'vol', children: jsx(Guard, { name: 'vol', children: jsx(M.audio, { direction: 1 }) }) }, 'vol'));
      sliders.push(jsx('div', { className: 'lgs-cc-slider', 'data-lgs-cc-s': 'mic', children: jsx(Guard, { name: 'mic', children: jsx(M.audio, { direction: 0 }) }) }, 'mic'));
    }
    return jsxs('div', { className: 'lgs-cc-ctl-main', children: [
      jsx(c.Focusable, { className: 'lgs-cc-toggles', 'flow-children': 'row', children: toggles }),
      jsx('div', { className: 'lgs-cc-platter lgs-cc-rows', children: rows }),
      jsx('div', { className: 'lgs-cc-sliders', children: sliders }),
    ] });
  }

  function MorePage({ setPage, moreKey }) {
    const tabs = useQamTabs();
    const cur = tabs.find((x) => x.name === moreKey) || tabs.find((x) => x.name === 'settings') || tabs[0];
    React.useEffect(() => { rt.setTimeout(() => { const el = ref.root && ref.root.querySelector('.lgs-cc-side-row.is-selected'); if (el) ccFocusEl(R, el); }, 60); }, []);
    const select = (t) => { S.lastMore = t.name; setPage('more', t.name); };
    const enterPane = () => {
      const pane = ref.root && ref.root.querySelector('.lgs-cc-pane');
      if (!pane) return false;
      for (const el of pane.querySelectorAll('.Focusable, .gpfocusable, [tabindex], button')) {
        if (el.closest('[class*="Slider"]')) continue;
        if (ccFocusEl(R, el)) return true;
      }
      return false;
    };
    return jsxs('div', { className: 'lgs-cc-more', children: [
      jsx(c.Focusable, { className: 'lgs-cc-side', 'flow-children': 'column', children: tabs.map((t) => jsx(Ctl, {
        k: 'side-' + t.name, cls: 'lgs-cc-side-row' + (cur && t.name === cur.name ? ' is-selected' : ''), label: t.strTitle || '',
        extra: { 'aria-selected': cur && t.name === cur.name ? 'true' : 'false', onMoveRight: enterPane, onGamepadFocus: () => { if (!cur || t.name !== cur.name) select(t); } },
        onAct: () => select(t),
        children: jsxs('div', { className: 'lgs-cc-side-face', children: [jsx('span', { className: 'lgs-cc-side-ic', 'data-k': t.name, children: t.tab }), jsx('span', { className: 'lgs-cc-side-label', children: t.strTitle || '' })] }),
      }, 'side-' + t.name)) }),
      jsxs('div', { className: 'lgs-cc-pane-wrap', children: [
        jsxs('div', { className: 'lgs-cc-head is-pane', children: [
          jsx(Ctl, { k: 'mback', cls: 'lgs-cc-circle', label: ccStr(R, 'back'), extra: {}, onAct: () => setPage('main', null, 'more'),
            children: jsx('div', { className: 'lgs-cc-circle-face', children: GLYPH.back() }) }),
          jsx('div', { className: 'lgs-cc-head-title', children: cur ? cur.strTitle || '' : '' }),
        ] }),
        jsx(c.Focusable, { className: 'lgs-cc-pane', 'flow-children': 'column', key: 'pane-' + (cur ? cur.name : 'none'),
          children: jsx(c.ScrollPanel || 'div', { className: 'lgs-cc-scroll', children: cur ? jsx(Guard, { name: 'pane', children: cur.panel }) : null }) }),
      ] }),
    ] });
  }

  // Room tile: the bar's own SteamVR dashboard actions (CC §4.10, CC6)
  function useBarActions() {
    if (!M.bar) return null;
    const cfg = M.bar.actions() || {};
    const defs = cfg.defined_actions || [];
    const byId = (id) => defs.find((a) => a && a.action_id === id) || null;
    const items = cfg.bar_menu_items || [];
    const buttons = cfg.bar_buttons || [];
    // The bar's own structure, not ids (they differ between SteamVR builds): Room View is the bar's
    // toggle button (invocation 2, not a menu); the Playspace menu is the bar button whose menu rows
    // are SteamVR actions (not the hamburger menu).
    const hamburger = new Set(buttons.filter((b) => b && b.is_main_hamburger_menu).map((b) => b.action_id));
    const parents = [];
    for (const m of items) if (m && m.parent_menu_action_id != null && !hamburger.has(m.parent_menu_action_id) && !parents.includes(m.parent_menu_action_id)) parents.push(m.parent_menu_action_id);
    const psId = parents.find((id) => buttons.some((b) => b && b.action_id === id)) || parents[0] || CC_PLAYSPACE_ID;
    const menu = items.filter((m) => m && m.parent_menu_action_id === psId).map((m) => byId(m.action_id)).filter((a) => a && a.enabled !== false);
    const toggles = buttons.map((b) => b && byId(b.action_id)).filter((a) => a && a.invocation === 2 && !parents.includes(a.action_id));
    const roomView = byId(CC_ROOMVIEW_ID) || toggles[0] || null;
    S.debug.actions = defs.slice(0, 16).map((a) => [a.action_id, a.display_name, a.invocation]);
    S.debug.bar = { buttons: buttons.slice(0, 12).map((b) => [b.type, b.action_id, !!b.is_main_hamburger_menu]), psId, roomView: roomView && roomView.action_id };
    return { roomView, playspace: byId(psId), menu };
  }
  function RoomSeg({ action }) {
    const { bVisuallyActive: on, fnInvokeAction } = M.bar.invoke(action) || {};
    const set = (v) => (ev) => { if (!!on !== v) act('roomview', () => fnInvokeAction(v), ev); };
    return jsxs('div', { className: 'lgs-cc-room-head', children: [
      jsx('div', { className: 'lgs-cc-title', children: action.display_name || '' }),
      jsxs(c.Focusable, { className: 'lgs-cc-seg', 'flow-children': 'row', 'data-on': on ? '1' : '0', children: [
        jsx('div', { className: 'lgs-cc-seg-pill', 'aria-hidden': 'true' }),
        jsx(Ctl, { k: 'segoff', cls: 'lgs-cc-seg-item' + (!on ? ' is-selected' : ''), label: ccStr(R, 'off'), extra: Object.assign({ 'aria-pressed': !on ? 'true' : 'false' }, nbProps('segoff')), onAct: set(false),
          children: jsx('span', { className: 'lgs-cc-seg-label', children: ccStr(R, 'off') }) }),
        jsx(Ctl, { k: 'segon', cls: 'lgs-cc-seg-item' + (on ? ' is-selected' : ''), label: ccStr(R, 'on'), extra: { 'aria-pressed': on ? 'true' : 'false' }, onAct: set(true),
          children: jsx('span', { className: 'lgs-cc-seg-label', children: ccStr(R, 'on') }) }),
      ] }),
    ] });
  }
  function ActionCircle({ k, action, glyph, cls }) {
    const { fnInvokeAction } = M.bar.invoke(action) || {};
    return jsx(Ctl, { k, cls: 'lgs-cc-circle ' + cls, label: action.display_name || '', tip: true, extra: Object.assign({}, nbProps(k)),
      onAct: (ev) => act(k, () => fnInvokeAction(), ev), children: jsx('div', { className: 'lgs-cc-circle-face', children: glyph() }) });
  }
  // Playspace circle: Steam's context menu in the main window with the Playspace menu's own rows
  function PlayspaceMenu({ items, title }) {
    const fns = items.map((a) => M.bar.invoke(a)); // hooks: one per item, fixed list (keyed by ids)
    return jsx(Ctl, { k: 'playspace', cls: 'lgs-cc-circle is-tr', label: title, tip: true, extra: {},
      onAct: (ev) => {
        const anchor = ev && ev.currentTarget;
        R.ui.menu(items.map((a, i) => ({ label: a.display_name || '', onSelected: () => act('playspace:' + a.action_id, () => fns[i].fnInvokeAction(), ev) })), anchor, { label: title });
      },
      children: jsx('div', { className: 'lgs-cc-circle-face', children: GLYPH.playspace() }) });
  }
  function RoomTile() {
    const A = useBarActions();
    if (!A) return null;
    const recenter = A.menu.find((a) => /recent/i.test(a.display_name || ''));
    const bright = [];
    if (M.vr && M.vr.env) bright.push(jsx('div', { className: 'lgs-cc-slider', 'data-lgs-cc-s': 'env', children: jsx(Guard, { name: 'env', children: jsx(M.vr.env, { iconOnly: true }) }) }, 'env'));
    if (M.vr && M.vr.bright) bright.push(jsx('div', { className: 'lgs-cc-slider', 'data-lgs-cc-s': 'bright', children: jsx(Guard, { name: 'bright', children: jsx(M.vr.bright, { iconOnly: true }) }) }, 'bright'));
    return jsxs('div', { className: 'lgs-cc-room-main', children: [
      jsxs(c.Focusable, { className: 'lgs-cc-corners', 'flow-children': 'row', children: [
        recenter ? jsx(Guard, { name: 'recenter', children: jsx(ActionCircle, { k: 'recenter', action: recenter, glyph: GLYPH.recenter, cls: 'is-tl' }) }, 'rc') : jsx('div', { className: 'lgs-cc-hit-spacer' }, 'rc'),
        A.menu.length ? jsx(Guard, { name: 'playspace', children: jsx(PlayspaceMenu, { items: A.menu, title: (A.playspace && A.playspace.display_name) || '' }, A.menu.map((a) => a.action_id).join('-')) }, 'ps') : null,
      ] }),
      A.roomView ? jsx(Guard, { name: 'roomview', children: jsx(RoomSeg, { action: A.roomView }) }) : jsx('div', { className: 'lgs-cc-room-head' }),
      jsx('div', { className: 'lgs-cc-sliders', children: bright }),
    ] });
  }

  // ---------------------------------------------------------------- the view
  function CCView(props) {
    const [page, setPageS] = React.useState('main');
    const [moreKey, setMoreKey] = React.useState(null);
    const [closing, setClosing] = React.useState(false);
    const rootRef = React.useRef(null);
    S.setClosing = setClosing;
    const setPage = S.setPage = (p, key, from) => {
      setPageS(p); setMoreKey(key || null);
      if (p === 'main' && from) rt.setTimeout(() => focusK(from === 'notif' ? 'notif' : 'more'), 60);
    };
    React.useEffect(() => {
      ref.root = rootRef.current;
      fadeOn(rootRef.current);
      const mine = rootRef.current;
      return () => {
        if (ref.root === mine) ref.root = null;
        // Steam closed the modal itself (another modal, a window reset): give everything back
        if (S.inst && !S.closing) { clearTimers(); S.inst = null; S.setClosing = null; setAttrAll(false); fadeOff(); glassOff(); }
      };
    }, []);
    const onCancel = (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      if (page === 'more') {
        const pane = rootRef.current && rootRef.current.querySelector('.lgs-cc-pane');
        if (pane && pane.querySelector('.gpfocus')) { const el = rootRef.current.querySelector('.lgs-cc-side-row.is-selected'); if (el && ccFocusEl(R, el)) return true; }
        setPage('main', null, 'more'); return true;
      }
      if (page === 'notif') { setPage('main', null, 'notif'); return true; }
      close('cancel'); return true;
    };
    const onButtonDown = (ev) => {
      const b = ev && ev.detail && (ev.detail.button != null ? ev.detail.button : ev.detail);
      if (b !== 5 && b !== 6 || page !== 'main') return;
      const order = ['now', 'ctl', 'room'];
      const firstOf = { now: ['settings', 'battery'], ctl: ['wifi', 'bt', 'air', 'motion', 'perf'], room: ['recenter', 'playspace', 'segoff'] };
      const el = rootRef.current && rootRef.current.querySelector('.gpfocus');
      const tile = el && el.closest('[data-lgs-cc-tile]');
      const i = order.indexOf(tile ? tile.getAttribute('data-lgs-cc-tile') : 'ctl') + (b === 6 ? 1 : -1);
      if (i < 0 || i >= order.length) return;
      for (const k of firstOf[order[i]]) if (focusK(k)) return;
    };
    const wide = page === 'more';
    const tile = (name, plateId, cls, child) => jsx(c.Focusable, {
      className: 'lgs-cc-tile ' + cls + (closing ? ' lgs-mat-out' : ' lgs-mat'), 'flow-children': 'column',
      'data-lgs-cc-tile': name, 'data-lgs-plate': 'panel', 'data-lgs-plate-id': plateId,
      children: child,
    });
    return jsxs(c.Focusable, {
      className: 'lgs-cc' + (closing ? ' is-closing' : ''), 'data-page': page, 'flow-children': 'column', noFocusRing: true,
      onCancel, onCancelActionDescription: page === 'main' ? ccStr(R, 'close') : ccStr(R, 'back'), onButtonDown,
      ref: rootRef,
      children: [
        jsx('div', { className: 'lgs-cc-backdrop', onClick: () => close('backdrop') }, 'bd'),
        jsxs(c.Focusable, { className: 'lgs-cc-tiles', 'flow-children': 'row', children: [
          tile('now', 'cc-now', 'lgs-cc-now', jsx(Guard, { name: 'now', children: jsx(NowTile, { page, setPage }) })),
          tile('ctl', 'cc-controls', 'lgs-cc-ctl' + (wide ? ' is-wide' : ''), jsx(Guard, { name: 'controls', children: jsx(ControlsTile, { page, setPage, moreKey }) })),
          wide ? null : tile('room', 'cc-room', 'lgs-cc-room', jsx(Guard, { name: 'room', children: jsx(RoomTile, {}) })),
        ] }, 'tiles'),
        jsx(Ctl, { k: 'close', cls: 'lgs-cc-close' + (closing ? ' lgs-mat-out' : ' lgs-mat'), label: ccStr(R, 'close'), tip: true,
          extra: { 'data-lgs-plate': 'liquid', 'data-lgs-plate-id': 'cc-close', 'data-lgs-plate-r': 'capsule',
            onMoveUp: () => { const t = rootRef.current && [...rootRef.current.querySelectorAll('.lgs-cc-ctl .lgs-cc-slider .Focusable, .lgs-cc-ctl .lgs-cc-slider .Panel')].pop(); return t ? ccFocusEl(R, t.closest('.Panel') || t) : false; } },
          onAct: () => close('x'), children: jsx('div', { className: 'lgs-cc-circle-face', children: GLYPH.close() }) }, 'x'),
      ],
    });
  }

  // ---------------------------------------------------------------- pill patch (CC3)
  function pillOut(out) {
    if (!out || !out.props || typeof out.props.children !== 'function') return out;
    const kids = out.props.children;
    return React.cloneElement(out, {
      children: (a, b) => {
        const el = kids(a, b);
        if (!el || !el.props || typeof el.props.onActivate !== 'function') return el;
        const steamOpen = el.props.onActivate;
        return React.cloneElement(el, {
          onActivate: (ev) => { if (S.inst || S.opening) { close('pill'); return; } if (!eligible()) { steamOpen(ev); return; } open(ev, 'pill'); },
          onMenuButton: (ev) => { if (S.inst) close('menu'); steamOpen(ev); },
          onMenuActionDescription: ccStr(R, 'qam') || undefined,
        });
      },
    });
  }
  S.pillHandle = R.patch.byProps('c3b.pill', R.patch.targets.statusPill, (orig) => function (props, r) {
    const out = orig.call(this, props, r);
    try { return pillOut(out); } catch (err) { S.lastErr = String(err && err.message || err); return out; }
  });
  try { R.patch.rerender(S.pillHandle); } catch (_) { /* shows at its next render */ }

  // the dashboard hiding closes CC-M
  rt.windows.onHide((w) => { if (w.kind === 'main' && (S.inst || S.opening)) close('hidden'); });

  return {
    open: (src) => open(null, src || 'api'),
    close: (reason) => close(reason || 'api'),
    isOpen: () => !!(S.inst || S.opening),
    page: (p, key) => { if (S.setPage) { S.setPage(p, key || null); return true; } return false; },
    spy: (on) => { S.spy = !!on; return S.spy; },
    log: () => S.log.slice(),
    status: () => ({ open: !!S.inst, opening: S.opening, closing: S.closing, where: S.where, counts: S.counts,
      found: Object.keys(ccFinders()).filter((k) => !!M[k]), pill: S.pillHandle ? { count: S.pillHandle.count, live: S.pillHandle.live } : null,
      fade: S.fade.length, glassHook: !!S.glassHook, lastErr: S.lastErr, debug: S.debug, log: S.log.slice(-8) }),
  };
}

function ccRemove() {
  const S = CC; CC = null;
  if (!S) return { patchedLeft: 0 };
  try { if (S.inst || S.opening) { S.closing = false; } } catch (_) { /* */ }
  try { if (S.inst) S.inst.Close(); } catch (_) { /* closed */ }
  for (const n of S.fade || []) { try { n.removeAttribute('data-lgs-cc-fade'); } catch (_) { /* gone */ } }
  for (const h of S.attrEls || []) { try { h.removeAttribute('data-lgs-cc'); } catch (_) { /* gone */ } }
  try { if (S.glassHook) S.glassHook.remove(); } catch (_) { /* shell gone */ }
  for (const off of S.timers || []) { try { off(); } catch (_) { /* done */ } }
  let left = 0;
  try { if (S.pillHandle) { S.pillHandle.remove(); try { S.R.patch.rerender(S.pillHandle); } catch (_) { /* */ } } } catch (_) { left = 1; }
  return { patchedLeft: left };
}
