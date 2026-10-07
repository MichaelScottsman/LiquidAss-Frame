// Glass Shell, Phase 2 capability prototype T3 ("steam-react").
//
// Adds a first-class, gamepad-navigable view to Steam's gamepadui main window,
// Decky Loader style, entirely in memory:
//   - a new route (default /library/lgs/proto) injected into the main window's route
//     switch by patching that one fiber's component type (no Steam code edited,
//     nothing written to disk);
//   - the page is built only from Steam's own React and gamepad components
//     (GamepadPage, Focusable with flow-children="grid", DialogButton,
//     ToggleField), so FocusNavController, the footer legend, A/B and the laser
//     all work like on Steam's own pages;
//   - data comes from Steam's stores: installed games (collectionStore +
//     appStore art URLs) and the "+ > Launch Program" list (Steam's own
//     ScanForInstalledNonSteamApps hook and filter lists).
// Clicks are only LOGGED. Nothing is launched, nothing is changed.
//
// The whole file is one expression that returns the API (window.__LGS_PROTO).
// It is too long for a Windows command line, so load it from the headset copy
// (loading only defines the API; nothing is patched until install()):
//   python glass.py sync
//   MSYS_NO_PATHCONV=1 python glass.py eval SharedJSContext @/home/steamos/.local/share/glass-shell/device/proto/react_proto.js
//   python glass.py js "__LGS_PROTO.selftest({remove:true})"      (locked step; prints PASS/FAIL per check)
//   python glass.py js "__LGS_PROTO.install(), __LGS_PROTO.open()"
//   python glass.py js "__LGS_PROTO.status()"
//   python glass.py js "__LGS_PROTO.remove()"
// API: install({route, flow}), open(), close(), status(), remove(), unpatch(),
//      overrideRoute(path[, fn]) / clearOverrides() (render this page in place
//      of a Steam route, e.g. /library/home), press('A'|'B'|'X'|'Y'|'MENU')
//      (dispatches a gamepad button ONLY while controller focus is inside this
//      page or its menu), selftest({remove}), resolve() (module finders only,
//      no side effects), events (the activation log).
// Removal restores the patched fiber types, drops the history listener and the
// global; a Steam restart or reboot also drops everything.
(() => {
  'use strict';
  const VERSION = 11;
  // Under /library so that a stale history entry left after removal falls back
  // to Steam's own library page instead of an empty page (see steam-react.md).
  const DEFAULT_ROUTE = '/library/lgs/proto';
  const prev = window.__LGS_PROTO;
  if (prev && prev.version === VERSION) return prev;
  // An older copy: restore its fiber patch synchronously before patching again.
  if (prev && prev.installed) { try { (prev.unpatch || prev.remove)({ quiet: true }); } catch (_) { /* old copy */ } }

  // ------------------------------------------------------------ webpack
  let req = null;
  window.webpackChunksteamui.push([[Symbol('lgs-proto')], {}, (r) => { req = r; }]);

  // Source of an export: a function, a class (constructor + prototype.render),
  // a forwardRef (.render) or a memo (.type).
  function fnSrc(v) {
    try {
      if (v == null) return '';
      let f = typeof v === 'function' ? v : (v.render || (v.type && (v.type.render || v.type)));
      if (typeof f !== 'function') return '';
      let s = Function.prototype.toString.call(f);
      if (f.prototype && typeof f.prototype.render === 'function') s += '\n' + Function.prototype.toString.call(f.prototype.render);
      return s;
    } catch (_) { return ''; }
  }
  function pick(ex, test) {
    if (!ex || typeof ex !== 'object' && typeof ex !== 'function') return null;
    for (const k of Object.keys(ex)) {
      let v; try { v = ex[k]; } catch (_) { continue; }
      if (v && test(v, fnSrc(v), k)) return v;
    }
    return null;
  }
  const has = (s, ...n) => n.every((x) => s.includes(x));

  // Each finder: strings the module factory's SOURCE must contain (cheap
  // filter, never executes anything), then a pick() over that module's exports.
  // Needles are literal strings Steam's code keeps across builds (string
  // literals, prop names, CSS-module keys), never webpack ids or minified names.
  const FINDERS = {
    React: [['react.production'], (ex) => (ex.createElement && ex.useState && ex.version ? ex : null)],
    jsx: [['react-jsx-runtime.production'], (ex) => (ex.jsx && ex.jsxs ? ex : null)],
    ReactDOM: [['react-dom.production'], (ex) => (ex.createPortal && ex.flushSync ? ex : null)],
    Router: [['computeRootMatch', 'Router-History'], (ex) => {
      const proto = (v) => (v && v.prototype && typeof v.prototype.render === 'function' ? Function.prototype.toString.call(v.prototype.render) : '');
      const Route = pick(ex, (v) => has(proto(v), 'computedMatch', '.component'));
      const Switch = pick(ex, (v) => has(proto(v), 'Children.forEach', 'computedMatch'));
      const matchPath = pick(ex, (v, s) => typeof v === 'function' && !proto(v) && has(s, 'isExact', 'sensitive'));
      return Route && Switch && matchPath ? { Route, Switch, matchPath } : null;
    }],
    RoutePaths: [['"/zoo"', 'GamepadUI'], (ex) => pick(ex, (v) => typeof v === 'object' && v.GamepadUI && v.GamepadUI.Zoo && v.Library && typeof v.Library.Home === 'function')],
    Focusable: [['"flow-children":', 'focusWithinClassName', '"Panel"'], (ex) => pick(ex, (v, s) => typeof v === 'function' && has(s, '"flow-children"', 'focusWithinClassName'))],
    DialogButton: [['"DialogButton","_DialogLayout","Secondary"'], (ex) => pick(ex, (v, s) => has(s, '"DialogButton","_DialogLayout","Secondary"'))],
    DialogButtonPrimary: [['"DialogButton","_DialogLayout","Primary"'], (ex) => pick(ex, (v, s) => has(s, '"DialogButton","_DialogLayout","Primary"'))],
    Field: [['spacingBetweenLabelAndChild', '"keep-inline"'], (ex) => pick(ex, (v, s) => has(s, 'spacingBetweenLabelAndChild', '"keep-inline"', 'childrenLayout'))],
    ToggleField: [['"ToggleField"'], (ex) => pick(ex, (v, s) => v.render && has(s, '"ToggleField"'))],
    SliderField: [['"SliderField"'], (ex) => pick(ex, (v, s) => typeof v === 'function' && s.length < 400 && has(s, '"SliderField"'))],
    DropdownField: [['"DropDownField"'], (ex) => pick(ex, (v, s) => typeof v === 'function' && s.length < 400 && has(s, '"DropDownField"'))],
    GamepadPage: [['useHeaderOpacitiesForGamepadPage', 'padForHeader'], (ex) => pick(ex, (v, s) => v.render && has(s, 'padForHeader', 'scrollable', 'headerVisibility'))],
    ScrollPanel: [['scrollPaddingLeft', 'ScrollBoth'], (ex) => pick(ex, (v, s) => v.render && has(s, 'scrollPaddingTop', 'scrollDirection'))],
    ScrollPanelGroup: [['scrollPaddingLeft', 'ScrollBoth', 'scrollStepPercent'], (ex) => pick(ex, (v, s) => v.render && has(s, 'scrollStepPercent', 'onGamepadDirection'))],
    ConfirmModal: [['bAlertDialog', 'strMiddleButtonText', 'bProgressDialog'], (ex) => pick(ex, (v, s) => typeof v === 'function' && has(s, 'bAlertDialog', 'strMiddleButtonText', 'closeModal'))],
    showModal: [['bHideMainWindowForPopouts', 'bForcePopOut'], (ex) => pick(ex, (v, s) => typeof v === 'function' && s.length < 200 && has(s, 'bHideMainWindowForPopouts'))],
    showContextMenu: [['GetContextMenuManagerFromWindow', 'CreateContextMenuInstance'], (ex) => pick(ex, (v, s) => typeof v === 'function' && has(s, 'CreateContextMenuInstance', '.Show()'))],
    Menu: [['contextMenuCheckMark', 'bInteractableItem'], (ex) => {
      const MenuItem = pick(ex, (v, s) => has(s, 'bInteractableItem', 'OnOKButton'));
      const Menu = pick(ex, (v, s) => typeof v === 'function' && s.length < 160 && has(s, 'labelId:', 'useId()'));
      const MenuSeparator = pick(ex, (v, s) => typeof v === 'function' && has(s, 'ContextMenuSeparator', '"separator"'));
      return MenuItem && Menu ? { Menu, MenuItem, MenuSeparator } : null;
    }],
    useNonSteamApps: [['ScanForInstalledNonSteamApps', 'useEffect'], (ex) => pick(ex, (v, s) => typeof v === 'function' && has(s, 'ScanForInstalledNonSteamApps'))],
    LaunchFilters: [['"vrurlhandler"', '"Install Chromium"'], (ex) => {
      const arrs = Object.keys(ex).map((k) => { try { return ex[k]; } catch (_) { return null; } }).filter(Array.isArray);
      const always = arrs.find((a) => a.includes('vrurlhandler') && !a.includes('konsole'));
      const devOnly = arrs.find((a) => a.includes('konsole'));
      const allow = arrs.find((a) => a.includes('Install Chromium'));
      const useDevMode = pick(ex, (v, s) => typeof v === 'function' && s.length < 200 && has(s, '"developer_mode_enabled"'));
      return always && devOnly && allow ? { always, devOnly, allow, useDevMode } : null;
    }],
  };

  // One pass over every factory's source text; then require only the matches,
  // smallest first. Needles are chosen so each finder matches exactly one
  // module (the one that defines the export): require() of a module the UI has
  // already executed returns its cached exports, but require() of a module
  // nobody loaded yet would run its top-level code, so a finder with several
  // candidates is a finder to tighten (resolve() reports the counts).
  function resolve() {
    const cand = {}, size = {};
    for (const k in FINDERS) cand[k] = [];
    for (const id of Object.keys(req.m)) {
      let s; try { s = Function.prototype.toString.call(req.m[id]); } catch (_) { continue; }
      for (const k in FINDERS) if (FINDERS[k][0].every((n) => s.includes(n))) { cand[k].push(id); size[id] = s.length; }
    }
    for (const k in cand) cand[k].sort((a, b) => size[a] - size[b]);
    const mods = {}, where = {}, counts = {};
    for (const k in FINDERS) {
      counts[k] = cand[k].length;
      for (const id of cand[k]) {
        let ex; try { ex = req(id); } catch (_) { continue; }
        const v = FINDERS[k][1](ex);
        if (v) { mods[k] = v; where[k] = id; break; }
      }
    }
    return { mods, where, counts };
  }

  // ------------------------------------------------------------ Steam glue
  const inst = () => window.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
  const mainWin = () => inst().BrowserWindow || inst().m_BrowserWindow;
  const route = () => inst().m_history.location.pathname;

  function fiberOf(el) {
    for (const k of Object.keys(el)) if (k.startsWith('__reactFiber$')) return el[k];
    return null;
  }
  // HostRoot of the React tree that renders the main window (popups are
  // portals of SharedJSContext's single root).
  function hostRoot() {
    const doc = mainWin().document;
    const tw = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
    for (let n = tw.nextNode(), i = 0; n && i < 5000; n = tw.nextNode(), i++) {
      let f = fiberOf(n);
      if (!f) continue;
      while (f.return) f = f.return;
      return f;
    }
    throw new Error('lgs-proto: no React fiber in the main window');
  }
  // The main route switch: a function component whose children prop is the
  // list of top-level <Route> elements (it contains both /settings and /zoo).
  function routeSwitchFibers(P) {
    const settings = P.Settings.Root(), zoo = P.GamepadUI.Zoo.Root();
    const out = [];
    const stack = [hostRoot()];
    let n = 0;
    while (stack.length && n++ < 400000) {
      const f = stack.pop();
      const ch = f.memoizedProps && typeof f.memoizedProps === 'object' ? f.memoizedProps.children : null;
      if (f.tag === 0 && Array.isArray(ch)
          && ch.some((c) => c && c.props && c.props.path === settings)
          && ch.some((c) => c && c.props && c.props.path === zoo)) out.push(f);
      if (f.sibling) stack.push(f.sibling);
      if (f.child) stack.push(f.child);
    }
    return out;
  }

  // ------------------------------------------------------------ state
  const api = {
    version: VERSION,
    route: DEFAULT_ROUTE,
    flow: 'grid', // flow-children of the tile grid: grid | geometric | row | column
    installed: false,
    events: [],
    where: null,
    _M: null,
    _patches: [],
    _unlisten: null,
    _listeners: new Set(),
    _routeEl: null,
    _overrides: new Map(), // route path -> (steamChildren) => children
    _Page: null,
  };
  window.__LGS_PROTO = api;

  api.emit = function (type, item) {
    const e = { t: Date.now(), type, kind: item && item.kind, id: item && item.id, name: item && item.name };
    api.events.push(e);
    if (api.events.length > 60) api.events.shift();
    console.log('[lgs-proto]', type, e.kind || '', e.name || '');
    for (const fn of api._listeners) { try { fn(e); } catch (_) { /* unmounted */ } }
  };

  // ------------------------------------------------------------ the page
  const CSS = `
.lgsp-root{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:12px 48px 18px;box-sizing:border-box;color:#fff}
.lgsp-head{text-align:center}
.lgsp-title{font-size:34px;font-weight:700;letter-spacing:.2px}
.lgsp-sub{font-size:15px;opacity:.72;margin-top:6px}
.lgsp-grid{display:grid;grid-template-columns:repeat(3,176px);gap:22px 64px;justify-content:center}
.lgsp-tile{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px;border-radius:24px;outline:none;cursor:pointer;background:transparent}
.lgsp-disc{width:128px;height:128px;border-radius:50%;overflow:hidden;background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22),0 10px 24px rgba(0,0,0,.35);transition:scale .32s cubic-bezier(.2,.9,.3,1.15),box-shadow .32s ease}
.lgsp-img{width:100%;height:100%;object-fit:cover;display:block}
.lgsp-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:700;opacity:.85}
.lgsp-label{font-size:16px;max-width:176px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.85}
.lgsp-tile:hover .lgsp-disc{scale:1.05}
.lgsp-tile.gpfocus .lgsp-disc{scale:1.12;box-shadow:inset 0 0 0 1px rgba(255,255,255,.45),0 0 0 4px rgba(255,255,255,.92),0 16px 34px rgba(0,0,0,.45)}
.lgsp-tile.gpfocus .lgsp-label{opacity:1;font-weight:600}
.lgsp-nolabels .lgsp-label{visibility:hidden}
.lgsp-bar{display:flex;gap:18px;align-items:center}
.lgsp-bar .DialogButton{min-width:180px;min-height:60px;border-radius:30px}
.lgsp-toggle{width:340px;border-radius:30px;overflow:hidden}
.lgsp-log{font-size:13px;opacity:.6;font-family:monospace;min-height:16px}
@media (prefers-reduced-motion: reduce){.lgsp-disc{transition:none}}
`;

  function installedGames(n) {
    const cs = window.collectionStore, as = window.appStore;
    const apps = (cs && cs.localGamesCollection ? cs.localGamesCollection.allApps : []).slice();
    apps.sort((a, b) => (b.rt_last_time_played || 0) - (a.rt_last_time_played || 0));
    return apps.slice(0, n).map((ov) => {
      const art = [];
      try { art.push(...as.GetCachedVerticalCapsuleURL(ov)); } catch (_) { /* older client */ }
      try { art.push(as.GetVerticalCapsuleURLForApp(ov)); } catch (_) { /* older client */ }
      try { const i = as.GetIconURLForApp(ov); if (i) art.push(i); } catch (_) { /* no icon */ }
      return { kind: 'game', id: ov.appid, name: ov.display_name, art: art.filter(Boolean),
        wouldDo: '/library/app/' + ov.appid };
    });
  }
  // Steam's own filter for the "+ > Launch Program" list (bar popup module).
  function launchPrograms(list, devMode, F) {
    if (!list) return [];
    const ex = F ? [...F.always, ...(devMode ? [] : F.devOnly)] : ['steam', 'vrurlhandler'];
    const allow = F ? F.allow : [];
    return list.filter((a) => {
      if (allow.includes(a.strAppName)) return true;
      return !ex.some((x) => a.strExePath === x || a.strExePath.endsWith('/' + x));
    }).map((a) => ({ kind: 'program', id: a.strCmdline, name: a.strAppName, // several flatpaks share one strExePath
      art: a.strIconDataBase64 ? ['data:image/png;base64,' + a.strIconDataBase64] : [],
      wouldDo: 'LaunchNonSteamApp(' + a.strCmdline + ')' }));
  }

  function makePage(M) {
    const R = M.React;
    const { jsx, jsxs } = M.jsx;
    const { Focusable, DialogButton, GamepadPage, ToggleField } = M;
    const noDev = () => [true];
    const noScan = () => undefined;
    const useDevMode = (M.LaunchFilters && M.LaunchFilters.useDevMode) || noDev;
    const useNonSteamApps = M.useNonSteamApps || noScan;

    function Art({ urls, name }) {
      const [i, setI] = R.useState(0);
      if (!urls.length || i >= urls.length) return jsx('div', { className: 'lgsp-fallback', children: (name || '?').slice(0, 1) });
      return jsx('img', { className: 'lgsp-img', src: urls[i], alt: '', draggable: false, onError: () => setI(i + 1) });
    }
    // Gamepad Options (the menu button) and the laser's context-menu gesture
    // open a Steam context menu built from Steam's Menu components.
    const MENU_LABELS = ['Open (logged only)', 'Details (logged only)'];
    function openMenu(item, anchor) {
      if (!M.Menu || !M.showContextMenu) return;
      const { Menu, MenuItem } = M.Menu;
      const el = jsx(Menu, { label: item.name, children: [
        jsx(MenuItem, { onSelected: () => api.emit('menu-open', item), children: MENU_LABELS[0] }, 'o'),
        jsx(MenuItem, { onSelected: () => api.emit('menu-details', item), children: MENU_LABELS[1] }, 'd'),
      ] });
      api._menu = M.showContextMenu(el, anchor || mainWin().document.body, {});
      api.emit('menu', item);
    }
    api._menuLabels = MENU_LABELS;
    function Tile({ item, autoFocus }) {
      return jsxs(Focusable, {
        className: 'lgsp-tile',
        autoFocus,
        noFocusRing: true, // the disc draws its own focus; Steam's rectangular FocusRing would double it
        onActivate: () => api.emit('activate', item),
        onGamepadFocus: () => api.emit('focus', item),
        onOKActionDescription: item.kind === 'game' ? 'Open (logged only)' : 'Launch (logged only)',
        onMenuButton: (e) => openMenu(item, e && e.currentTarget),
        onMenuActionDescription: 'Options',
        onContextMenu: (e) => { e.preventDefault(); openMenu(item, e.currentTarget); },
        'data-lgsp': item.kind + ':' + item.name,
        children: [
          jsx('div', { className: 'lgsp-disc', children: jsx(Art, { urls: item.art, name: item.name }) }, 'd'),
          jsx('div', { className: 'lgsp-label', children: item.name }, 'l'),
        ],
      });
    }
    // Our own error boundary: Steam's boundary sits around ALL routes, so an
    // exception in this page would otherwise blank the whole window content.
    class Guard extends R.Component {
      constructor(p) { super(p); this.state = { err: null }; }
      static getDerivedStateFromError(err) { return { err }; }
      componentDidCatch(err) { api.emit('error', { kind: 'error', name: String(err && err.message || err) }); }
      render() {
        if (!this.state.err) return this.props.children;
        return jsx(GamepadPage, { scrollable: false, children: jsxs(Focusable, {
          className: 'lgsp-root', onCancel: () => inst().NavigateBack(), onCancelActionDescription: 'Back',
          children: [
            jsx('style', { children: CSS }, 'css'),
            jsx('div', { className: 'lgsp-title', children: 'This view failed to load' }, 't'),
            jsx('div', { className: 'lgsp-sub', children: String(this.state.err && this.state.err.message || this.state.err) }, 's'),
            jsx(DialogButton, { className: 'lgsp-back', autoFocus: true, onClick: () => inst().NavigateBack(), children: 'Back' }, 'b'),
          ] }) });
      }
    }
    function ProtoPage() {
      return jsx(Guard, { children: jsx(ProtoBody, {}) });
    }
    function ProtoBody() {
      // Test hook: throw on the next N renders (React retries a failed render once).
      if (api._throwRenders > 0) { api._throwRenders--; throw new Error('test error (api._throwRenders)'); }
      const [last, setLast] = R.useState(null);
      const [labels, setLabels] = R.useState(true);
      R.useEffect(() => { api._listeners.add(setLast); return () => { api._listeners.delete(setLast); }; }, []);
      const dev = useDevMode();
      const programs = useNonSteamApps(true, true, 0);
      const items = R.useMemo(() => {
        const progs = launchPrograms(programs, dev && dev[0], M.LaunchFilters).slice(0, 3);
        const games = installedGames(6 - progs.length);
        return games.concat(progs);
      }, [programs, dev && dev[0]]);
      const back = () => { api.emit('back'); inst().NavigateBack(); };
      return jsx(GamepadPage, {
        className: 'lgsp-page',
        scrollable: false,
        children: jsxs(Focusable, {
          className: 'lgsp-root' + (labels ? '' : ' lgsp-nolabels'),
          onCancel: back,
          onCancelActionDescription: 'Back',
          children: [
            jsx('style', { children: CSS }, 'css'),
            jsxs('div', { className: 'lgsp-head', children: [
              jsx('div', { className: 'lgsp-title', children: 'Home' }, 't'),
              jsx('div', { className: 'lgsp-sub', children: 'Glass Shell prototype: a new route built from Steam\'s own components. Activations are logged, nothing launches.' }, 's'),
            ] }, 'head'),
            jsx(Focusable, {
              'flow-children': api.flow,
              className: 'lgsp-grid',
              children: items.map((it, i) => jsx(Tile, { item: it, autoFocus: i === 0 }, it.kind + ':' + it.id)),
            }, 'grid'),
            jsxs(Focusable, { 'flow-children': 'row', className: 'lgsp-bar', children: [
              jsx(DialogButton, { className: 'lgsp-back', onClick: back, children: 'Back' }, 'b'),
              ToggleField ? jsx('div', { className: 'lgsp-toggle', children: jsx(ToggleField, {
                label: 'Show labels', checked: labels, bottomSeparator: 'none',
                onChange: (v) => { setLabels(v); api.emit('toggle', { kind: 'local', id: 'labels', name: String(v) }); },
              }) }, 't') : null,
            ] }, 'bar'),
            jsx('div', { className: 'lgsp-log', children: last ? last.type + (last.name ? ': ' + last.name : '') : 'no events yet' }, 'log'),
          ],
        }),
      });
    }
    return ProtoPage;
  }

  // ------------------------------------------------------------ route patch
  function patchFiber(f) {
    if (f.type && f.type.__lgsOrig) return false;
    const orig = f.type;
    const patched = function LgsRouteSwitch(props, second) {
      const el = api._routeEl;
      if (!el && !api._overrides.size) return orig.call(this, props, second);
      let children = [].concat(props.children);
      if (api._overrides.size) {
        // Decky-style "patch a route's render": same <Route> element (path,
        // wrapper, transitions), different children.
        children = children.map((c) => {
          const fn = c && c.props && api._overrides.get(c.props.path);
          return fn ? api._M.React.cloneElement(c, { children: fn(c.props.children) }) : c;
        });
      }
      if (el) children = [el].concat(children);
      return orig.call(this, Object.assign({}, props, { children }), second);
    };
    patched.__lgsOrig = orig;
    f.type = patched;
    if (f.alternate) f.alternate.type = patched;
    api._patches.push({ fiber: f, alt: f.alternate, orig, patched });
    return true;
  }
  function ensurePatched() {
    if (!api.installed) return 0;
    let n = 0;
    for (const f of routeSwitchFibers(api._M.RoutePaths)) if (patchFiber(f)) n++;
    return n;
  }

  api.resolve = function () {
    const r = resolve();
    const out = {};
    for (const k in FINDERS) out[k] = r.where[k] ? 'module ' + r.where[k] + ' (' + r.counts[k] + ' candidate' + (r.counts[k] === 1 ? '' : 's') + ')' : 'NOT FOUND (' + r.counts[k] + ' candidates)';
    return out;
  };

  api.install = function (opts) {
    opts = opts || {};
    if (api.installed) return api.status();
    const t0 = performance.now();
    const r = resolve();
    const need = ['React', 'jsx', 'RoutePaths', 'Focusable', 'DialogButton', 'GamepadPage'];
    const missing = need.filter((k) => !r.mods[k]);
    if (missing.length) throw new Error('lgs-proto: cannot find ' + missing.join(', '));
    api._M = r.mods;
    api.where = r.where;
    api.route = opts.route || DEFAULT_ROUTE;
    if (opts.flow) api.flow = opts.flow;
    const fibers = routeSwitchFibers(r.mods.RoutePaths);
    if (!fibers.length) throw new Error('lgs-proto: main route switch not found');
    // Reuse the element type of Steam's own /zoo route (Steam's Route wrapper).
    const zoo = r.mods.RoutePaths.GamepadUI.Zoo.Root();
    const sibling = fibers[0].memoizedProps.children.find((c) => c && c.props && c.props.path === zoo);
    const RouteType = sibling ? sibling.type : (r.mods.Router && r.mods.Router.Route);
    const Page = makePage(r.mods);
    api._Page = Page;
    api._routeEl = r.mods.jsx.jsx(RouteType, { path: api.route, children: r.mods.jsx.jsx(Page, {}) }, 'lgs-proto-route');
    api.installed = true;
    fibers.forEach(patchFiber);
    // If React ever remounts the switch (new fiber, original type), re-patch
    // before the router re-renders into our route.
    api._unlisten = inst().m_history.listen((loc) => {
      if (loc.pathname === api.route || loc.pathname.startsWith(api.route + '/')) ensurePatched();
    });
    api.emit('installed');
    const s = api.status();
    s.installMs = Math.round(performance.now() - t0);
    return s;
  };

  // Render the prototype page in place of an existing Steam route (for example
  // '/library/home'); fn(steamChildren) may also wrap Steam's own children.
  // Takes effect on the next render of the switch, so it re-enters the route.
  api.overrideRoute = function (path, fn) {
    if (!api.installed) throw new Error('install first');
    const J = api._M.jsx;
    api._overrides.set(path, fn || (() => J.jsx(api._Page, {})));
    if (route() === path) inst().Navigate(path, true);
    return [...api._overrides.keys()];
  };
  api.clearOverrides = function () {
    const paths = [...api._overrides.keys()];
    api._overrides.clear();
    if (paths.includes(route())) inst().Navigate(route(), true); // re-render Steam's own page
    return paths;
  };

  api.open = function () { inst().Navigate(api.route); return api.route; };
  api.close = function () { if (route().startsWith(api.route)) inst().NavigateBack(); return route(); };

  // Gamepad buttons for tests (EGamepadButton codes): only while controller
  // focus is inside this page, or on an item of the menu this page opened.
  api.press = function (button) {
    const code = { A: 1, B: 2, X: 3, Y: 4, MENU: 14 }[button];
    if (!code) throw new Error('press: A, B, X, Y or MENU');
    const doc = mainWin().document;
    const f = doc.querySelector('.gpfocus');
    const inPage = f && f.closest('.lgsp-root');
    const inOurMenu = f && api._menu && f.closest('.BasicUIContextMenu')
      && (api._menuLabels || []).concat(['Cancel']).includes((f.innerText || '').trim());
    if (!inPage && !inOurMenu) throw new Error('press: controller focus is not inside the prototype page or its menu; refusing');
    const ctx = window.FocusNavController.GetActiveContext && window.FocusNavController.GetActiveContext();
    const mainCtx = inst().GetFocusNavContext && inst().GetFocusNavContext();
    if (ctx && mainCtx && ctx !== mainCtx) throw new Error('press: the main window is not the active focus context; refusing');
    window.FocusNavController.DispatchVirtualButtonClick(code);
    return button;
  };

  api.status = function () {
    const live = api._M ? routeSwitchFibers(api._M.RoutePaths) : [];
    return {
      version: VERSION,
      installed: api.installed,
      route: api.route,
      currentRoute: route(),
      switchFibers: live.length,
      patchedLive: live.filter((f) => f.type && f.type.__lgsOrig).length,
      patchesMade: api._patches.length,
      pageMounted: !!mainWin().document.querySelector('.lgsp-root'),
      events: api.events.slice(-8).map((e) => e.type + (e.kind ? ' ' + e.kind : '') + (e.name ? ' ' + e.name : '')),
      modules: api.where,
    };
  };

  // Synchronous part of removal: history listener, fiber types, global.
  api.unpatch = function () {
    if (api._menu) { try { api._menu.Hide(); } catch (_) { /* closed */ } api._menu = null; }
    if (api._unlisten) { try { api._unlisten(); } catch (_) { /* gone */ } }
    api._unlisten = null;
    let restored = 0;
    for (const p of api._patches) {
      for (const f of [p.fiber, p.alt, p.fiber.alternate]) {
        if (f && f.type === p.patched) { f.type = p.orig; restored++; }
      }
    }
    api._patches = [];
    api._routeEl = null;
    api._overrides.clear();
    api.installed = false;
    api._listeners.clear();
    if (window.__LGS_PROTO === api) delete window.__LGS_PROTO;
    const left = api._M ? routeSwitchFibers(api._M.RoutePaths).filter((f) => f.type && f.type.__lgsOrig).length : 0;
    return { restoredFiberTypes: restored, patchedLeft: left };
  };

  // Full removal: leave the route first (so the page unmounts through Steam's
  // normal exit transition), then unpatch.
  api.remove = async function (opts) {
    opts = opts || {};
    const wasOn = route();
    if (wasOn === api.route || wasOn.startsWith(api.route + '/')) {
      inst().NavigateBack();
      await new Promise((r) => setTimeout(r, 900)); // exit transition is 200 ms
      if (route().startsWith(api.route)) { inst().Navigate('/library/home', true); await new Promise((r) => setTimeout(r, 600)); }
    }
    const onOverridden = api._overrides.has(route());
    const unp = api.unpatch();
    if (onOverridden) { inst().Navigate(route(), true); await new Promise((r) => setTimeout(r, 900)); } // Steam's page back
    const res = Object.assign(unp, { routeBefore: wasOn, routeAfter: route(),
      pageMounted: !!mainWin().document.querySelector('.lgsp-root'), events: api.events.length });
    if (!opts.quiet) console.log('[lgs-proto] removed', res);
    return res;
  };

  // One-command verification for agents. It only moves controller focus,
  // laser-clicks / presses A on this page's own tiles (which only log), opens
  // and cancels this page's own menu, and leaves with B. Run it inside a
  // locked lab step:  python glass.py js "$(cat device/proto/react_proto.js).selftest({remove:true})"
  api.selftest = async function (opts) {
    opts = opts || {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const doc = () => mainWin().document;
    const FNC = window.FocusNavController;
    const rep = { routeBefore: route(), steps: [], ok: true };
    const at = () => {
      const f = doc().querySelector('.gpfocus');
      if (!f) return 'none';
      if (f.getAttribute('data-lgsp')) return f.getAttribute('data-lgsp');
      if (f.closest('.BasicUIContextMenu')) return 'menu:' + (f.innerText || '').trim();
      if (f.closest('.lgsp-toggle')) return 'toggle';
      if (f.closest('.lgsp-root')) return f.classList.contains('lgsp-back') ? 'back-button' : 'page';
      return 'outside';
    };
    const inPage = (w) => /^(game|program):/.test(w) || ['toggle', 'back-button', 'page'].includes(w);
    const pad = async (dir) => {
      if (at() === 'none') await refocus(); // focus parked in vr-null-tree (see refocus)
      const before = at();
      if (!inPage(before)) throw new Error('selftest: focus is not in the page (' + before + '); refusing to send ' + dir);
      FNC.DispatchVirtualButtonClick({ up: 9, down: 10, left: 11, right: 12 }[dir]);
      await sleep(260);
      return at();
    };
    // With the headset unworn SteamVR reports no overlay input focus, so after a
    // modal closes Steam parks gamepad focus in "vr-null-tree"; re-focus the
    // main window's root the way Navigate() does.
    const navState = () => {
      const ctx = FNC.GetActiveContext && FNC.GetActiveContext();
      const tree = ctx && ctx.m_LastActiveNavTree;
      const src = FNC.m_navigationSource && FNC.m_navigationSource.m_currentValue;
      return (tree ? tree.id : '?') + ' source ' + (src ? src.eActivationSourceType : '?');
    };
    const refocus = async () => {
      for (let i = 0; i < 8 && !/^(game|program):/.test(at()); i++) {
        if (at() === 'none') { inst().FocusApplicationRoot(); await sleep(400); }
        if (at() === 'none' || at() === 'outside') FNC.DispatchVirtualButtonClick(10); // down, into the page
        else FNC.DispatchVirtualButtonClick(9); // up, from the button row to the grid
        await sleep(300);
      }
      if (!/^(game|program):/.test(at())) rep.steps.push('NOTE focus not on a tile after refocus: ' + at() + ' (' + navState() + ')');
      return at();
    };
    const click = (el) => {
      const w = mainWin(), r = el.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, view: w, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 };
      for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        el.dispatchEvent(new (t.startsWith('pointer') ? w.PointerEvent : w.MouseEvent)(t, Object.assign({ pointerType: 'mouse', isPrimary: true }, o)));
      }
    };
    const check = (name, got, want) => {
      const pass = want instanceof RegExp ? want.test(String(got)) : got === want;
      rep.steps.push((pass ? 'PASS ' : 'FAIL ') + name + ': ' + got + (pass ? '' : '  (want ' + want + ')'));
      if (!pass) rep.ok = false;
      return pass;
    };
    const since = (n) => api.events.slice(n).map((e) => e.type + (e.name ? ' ' + e.name : ''));
    try {
      if (!api.installed) api.install(opts);
      if (route() !== api.route) { api.open(); await sleep(1600); }
      check('route', route(), api.route);
      const t = [...doc().querySelectorAll('.lgsp-tile')].map((e) => e.getAttribute('data-lgsp'));
      check('tiles', t.length, 6);
      const plan = [['right', t[1]], ['right', t[2]], ['right', t[2]], ['down', t[5]], ['left', t[4]], ['left', t[3]],
        ['up', t[0]], ['down', t[3]],
        // entering a row restores its last focused child (Steam's focus memory), so
        // the second time down from the grid may land on the toggle instead
        ['down', /^(back-button|toggle)$/], ['right', 'toggle'], ['up', /^(game|program):/]];
      // Up to 3 attempts: on the shared, unworn headset SteamVR can move input
      // focus away mid-sequence (focus becomes 'none'); then start over.
      for (let attempt = 1; attempt <= 3; attempt++) {
        await refocus();
        for (let i = 0; i < 6 && t.indexOf(at()) !== 0; i++) await pad(t.indexOf(at()) >= 3 ? 'up' : 'left'); // to the top-left tile
        const got = [at()];
        for (const [d] of plan) got.push(await pad(d));
        if (got.includes('none') && attempt < 3) { rep.steps.push('NOTE focus interrupted (' + navState() + '), retrying'); continue; }
        check('start', got[0], t[0]);
        plan.forEach(([d, want], i) => check('pad ' + d, got[i + 1], want));
        break;
      }
      let n = api.events.length;
      click(doc().querySelector('[data-lgsp="' + t[1] + '"]'));
      await sleep(300);
      check('laser click', since(n).filter((e) => e.startsWith('activate')).join(), 'activate ' + t[1].split(':').slice(1).join(':'));
      await refocus();
      const focusedTile = at();
      n = api.events.length;
      api.press('A'); await sleep(300);
      check('A on tile', since(n).filter((e) => e.startsWith('activate')).join(), 'activate ' + focusedTile.split(':').slice(1).join(':'));
      api.press('MENU'); await sleep(800);
      check('MENU opens Steam context menu', at(), /^menu:Open/);
      api.press('B'); await sleep(600);
      check('B closes the menu', doc().querySelectorAll('.BasicUIContextMenu').length, 0);
      await refocus();
      n = api.events.length;
      api.press('B'); await sleep(1000);
      check('B leaves the page', route() !== api.route && since(n).includes('back'), true);
    } catch (e) {
      rep.ok = false;
      rep.steps.push('ERROR ' + (e && e.message || e) + ' [' + navState() + ']');
    }
    rep.routeAfter = route();
    if (opts.remove) rep.remove = await api.remove({ quiet: true });
    return rep;
  };

  return api;
})()
