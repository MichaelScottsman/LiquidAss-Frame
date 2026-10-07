// Glass Shell runtime module "react" (P2): Steam React framework (tier T3).
// Contract: docs/phase2/contracts/react.md. Mechanisms: docs/phase2/capabilities/steam-react.md (SR).
//
// What it gives other modules (const react = rt.use('react')):
//   - Steam's own React, jsx runtime, router and components, found by source text (SR §3.2);
//   - routes.add(path, Component) under /library/lgs/... and routes.override(path, fn(steamChildren))
//     by patching the main window's route switch fiber (SR §3.4, §3.5), self-healing on navigation;
//   - patch.byProps(id, predicate, wrap) for memo / observer / forwardRef / class components found by
//     the shape of their props (SR §3.2);
//   - ui helpers (Page, ErrorBoundary, menu, modal, confirm, loc), data helpers, and
//   - actions (launchNonSteam, primary, desktopWindow, navigate) that are LOGGED, never run, in test mode.
//
// Fail closed: the first call that needs Steam's modules runs ready(); a missing required finder or route
// switch throws before anything is patched. install() itself is cheap and patches nothing. remove()
// restores every fiber, holder and listener and reports patchedLeft. Nothing persists: everything lives
// in SharedJSContext's heap.
(() => {
  'use strict';
  const RT = window.__LGS_RT || window.__LGS_RT_TEST;
  if (!RT || typeof RT.define !== 'function') return;

  const VERSION = 1;
  const PREFIX = '/library/lgs/';
  const REQUIRED = ['React', 'jsx', 'RoutePaths', 'Focusable', 'DialogButton', 'GamepadPage'];
  const MARK = '__lgsP2';                // set on every function this module installs
  // Steam's library-grid launch source (the value the grid's tile menu passes; module 94601 `Zw7` = 1000
  // in build 11094443). It only tags the launch for Steam's own statistics.
  const LAUNCH_SOURCE_LIBRARY = 1000;
  const CLIENT = 'mostavailable';        // what the library grid's tile menu passes (SR, 43394 callers)
  const ACTION_LOG_MAX = 200;
  const WALK_MAX = 400000;

  let rt = null;   // P1's scoped runtime for this module
  let S = null;    // state of the current install

  // ------------------------------------------------------------ small utilities
  function fnSrc(v) {
    try {
      if (v == null) return '';
      const f = typeof v === 'function' ? v : (v.render || (v.type && (v.type.render || v.type)));
      if (typeof f !== 'function') return '';
      let s = Function.prototype.toString.call(f);
      if (f.prototype && typeof f.prototype.render === 'function') s += '\n' + Function.prototype.toString.call(f.prototype.render);
      return s;
    } catch (_) { return ''; }
  }
  function pick(ex, test) {
    if (!ex || (typeof ex !== 'object' && typeof ex !== 'function')) return null;
    for (const k of Object.keys(ex)) {
      let v; try { v = ex[k]; } catch (_) { continue; }
      try { if (v && test(v, fnSrc(v), k)) return v; } catch (_) { /* next */ }
    }
    return null;
  }
  const has = (s, ...n) => n.every((x) => s.includes(x));
  const util = { fnSrc, pick, has };
  const errMsg = (e) => String((e && e.message) || e);
  function logE(msg, data) { try { rt.error(msg, data); } catch (_) { /* no runtime log */ } }
  function logI(msg, data) { try { rt.log(msg, data); } catch (_) { /* no runtime log */ } }

  // ------------------------------------------------------------ finders (SR §3.2)
  // name -> [needles every candidate module's SOURCE must contain, pick(exports, util)].
  // Needles are literal strings Steam keeps across builds; never webpack ids or minified names.
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
    // The library tile menu (module 43394 in 11094443): GetPrimaryActionMenuItem runs
    // runAction(primaryAction(instance, overview, client), overview, client, launchSource, window)().
    AppActions: [['GetPrimaryActionMenuItem', 'ContextMenuAction'], (ex) => {
      const primaryAction = pick(ex, (v, s) => typeof v === 'function' && has(s, 'BIsAppBlocked()', 'display_status') && !s.includes('Local-only'));
      const runAction = pick(ex, (v, s) => typeof v === 'function' && has(s, 'Local-only app action for non-local client data', 'CancelLaunch'));
      return primaryAction && runAction ? { primaryAction, runAction } : null;
    }],
    // "#GameAction_<action>" label (module 18488): label(action, count)
    ActionLabel: [['"#GameActionPlural_"', '"#GameAction_"'], (ex) => pick(ex, (v, s) => typeof v === 'function' && has(s, '"#GameActionPlural_"', '"#GameAction_"'))],
    // The VR gamepad UI message service (module 92102): p.SteamVR.DashboardDesktopWindowClicked
    VRMessages: [['"VRGamepadUIMessages"', 'm_SteamVR_ClientMethods'], (ex) => pick(ex, (v) => typeof v === 'object' && v.SteamVR && typeof v.SteamVR.DashboardDesktopWindowClicked === 'function')],
  };

  function newState() {
    return {
      req: null, src: null, factories: 0, M: null, where: {}, counts: {}, ready: false, error: null, scanMs: null,
      broken: new Set(), RouteType: null, ui: null,
      switchPatches: [], routes: new Map(), overrides: new Map(), unlisten: null, winOff: null,
      targets: new Map(), handles: new Map(), touched: new Set(),
      menus: new Set(), modals: new Set(),
      actionLog: [], actionSubs: new Set(), forceTest: false,
    };
  }

  // ------------------------------------------------------------ webpack and source scan
  function getReq() {
    if (S.req) return S.req;
    const chunk = window.webpackChunksteamui;
    if (!chunk || typeof chunk.push !== 'function') throw new Error('lgs-react: webpackChunksteamui not found');
    const sym = Symbol('lgs-react');
    let req = null;
    chunk.push([[sym], {}, (r) => { req = r; }]);
    // webpack also stores the pushed entry in the array; take ours out again.
    for (let i = chunk.length - 1; i >= 0; i--) { const c = chunk[i]; if (c && c[0] && c[0][0] === sym) { chunk.splice(i, 1); break; } }
    if (!req || !req.m) throw new Error('lgs-react: webpack require not available');
    S.req = req;
    return req;
  }
  function sources() {
    if (S.src) return S.src;
    const req = getReq();
    const out = [];
    for (const id of Object.keys(req.m)) {
      let s; try { s = Function.prototype.toString.call(req.m[id]); } catch (_) { continue; }
      out.push([id, s]);
    }
    S.src = out;
    S.factories = out.length;
    return out;
  }
  // One pass over the cached sources; require only modules whose source has every needle,
  // smallest first (a module nobody loaded yet would run its top-level code on require).
  // The prefilter is one regex of every distinct needle (one pass over each source, about 2.3x faster than
  // one includes() per finder on 21 MB of source); every candidate is then confirmed with includes(), so a
  // needle hidden inside another needle's match can only cost a candidate, never produce a wrong one.
  function findIn(spec) {
    const src = sources();
    const req = getReq();
    const cand = {}, size = {};
    for (const k in spec) cand[k] = [];
    const all = [...new Set(Object.values(spec).flatMap((v) => v[0]))].sort((a, b) => b.length - a.length);
    const re = new RegExp(all.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    for (const [id, s] of src) {
      re.lastIndex = 0;
      let m, found = null;
      while ((m = re.exec(s))) (found || (found = new Set())).add(m[0]);
      if (!found) continue;
      for (const k in spec) {
        const nd = spec[k][0];
        if (!nd.some((n) => found.has(n))) continue;
        if (nd.every((n) => s.includes(n))) { cand[k].push(id); size[id] = s.length; }
      }
    }
    const mods = {}, where = {}, counts = {};
    for (const k in spec) {
      cand[k].sort((a, b) => size[a] - size[b]);
      counts[k] = cand[k].length;
      for (const id of cand[k]) {
        let ex; try { ex = req(id); } catch (_) { continue; }
        let v = null; try { v = spec[k][1](ex, util); } catch (_) { v = null; }
        if (v) { mods[k] = v; where[k] = id; break; }
      }
    }
    return { mods, where, counts };
  }

  // ------------------------------------------------------------ Steam glue
  const inst = () => window.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
  const mainWin = () => { const i = inst(); return i.BrowserWindow || i.m_BrowserWindow; };
  const route = () => inst().m_history.location.pathname;
  const nav = {
    inst, win: mainWin, route,
    location: () => inst().m_history.location,
    go(path, replace) { inst().Navigate(path, !!replace); return path; },
    back() { inst().NavigateBack(); },
    focusRoot() { inst().FocusApplicationRoot(); },
  };

  // ------------------------------------------------------------ fibers
  function fiberOf(el) {
    if (!el) return null;
    for (const k of Object.keys(el)) if (k.startsWith('__reactFiber$')) return el[k];
    return null;
  }
  function hostRoot() {
    const doc = mainWin().document;
    const tw = doc.createTreeWalker(doc.body, 1 /* SHOW_ELEMENT */);
    for (let n = tw.nextNode(), i = 0; n && i < 5000; n = tw.nextNode(), i++) {
      let f = fiberOf(n);
      if (!f) continue;
      while (f.return) f = f.return;
      return f;
    }
    throw new Error('lgs-react: no React fiber in the main window');
  }
  // Depth-first over the mounted tree (main window and every popup: popups are portals of SharedJSContext's
  // single root). visit(f) returning true stops the walk.
  function walk(visit, from) {
    const stack = [from || hostRoot()];
    let n = 0;
    while (stack.length && n++ < WALK_MAX) {
      const f = stack.pop();
      if (visit(f) === true) return n;
      if (f.sibling) stack.push(f.sibling);
      if (f.child) stack.push(f.child);
    }
    return n;
  }
  function findFibers(pred, max) {
    const out = [];
    walk((f) => {
      const p = f.memoizedProps;
      if (p && typeof p === 'object') { let ok = false; try { ok = pred(p, f); } catch (_) { ok = false; } if (ok) out.push(f); }
      return max && out.length >= max;
    });
    return out;
  }
  function closestFiber(el, pred) {
    for (let f = fiberOf(el); f; f = f.return) {
      const p = f.memoizedProps;
      if (f.tag !== 5 && f.tag !== 6 && p && typeof p === 'object') { let ok = false; try { ok = pred(p, f); } catch (_) { ok = false; } if (ok) return f; }
    }
    return null;
  }
  const fiber = {
    of: fiberOf,
    root: () => hostRoot(),
    walk: (visit) => walk(visit),
    findAll: (pred, opts) => findFibers(pred, opts && opts.max),
    closest: closestFiber,
    props(el) { const f = closestFiber(el, () => true); return f ? f.memoizedProps : null; },
  };

  // The main route switch: a function component whose children prop is the list of top-level <Route>
  // elements (it contains both /settings and /zoo). SR §3.3.
  function routeSwitchFibers(P) {
    const settings = P.Settings.Root(), zoo = P.GamepadUI.Zoo.Root();
    const out = [];
    walk((f) => {
      const ch = f.memoizedProps && typeof f.memoizedProps === 'object' ? f.memoizedProps.children : null;
      if (f.tag === 0 && Array.isArray(ch)
          && ch.some((c) => c && c.props && c.props.path === settings)
          && ch.some((c) => c && c.props && c.props.path === zoo)) out.push(f);
    });
    return out;
  }

  // ------------------------------------------------------------ ready(): the one scan, fail closed
  function ready() {
    if (!S) throw new Error('lgs-react: module not installed');
    if (S.ready) return true;
    if (S.error) throw S.error;
    const t0 = performance.now();
    try {
      const r = findIn(FINDERS);
      for (const k of S.broken) { delete r.mods[k]; delete r.where[k]; }
      const missing = REQUIRED.filter((k) => !r.mods[k]);
      if (missing.length) throw new Error('lgs-react: cannot find ' + missing.join(', ') + ' (fail closed; T3 off)');
      const fibers = routeSwitchFibers(r.mods.RoutePaths);
      if (!fibers.length) throw new Error('lgs-react: main route switch not found (fail closed; T3 off)');
      const zoo = r.mods.RoutePaths.GamepadUI.Zoo.Root();
      const sib = fibers[0].memoizedProps.children.find((c) => c && c.props && c.props.path === zoo);
      S.RouteType = sib ? sib.type : (r.mods.Router && r.mods.Router.Route);
      if (!S.RouteType) throw new Error('lgs-react: no <Route> element type (fail closed; T3 off)');
      S.M = r.mods; S.where = r.where; S.counts = r.counts;
      S.ui = makeUI(r.mods);
      S.ready = true;
      S.scanMs = Math.round(performance.now() - t0);
      logI(`ready in ${S.scanMs} ms (${S.factories} factories)`);
      return true;
    } catch (e) {
      S.error = e instanceof Error ? e : new Error(String(e));
      S.scanMs = Math.round(performance.now() - t0);
      S.src = null;
      logE('ready() failed', S.error.message);
      throw S.error;
    }
  }
  const need = () => { ready(); return S.M; };

  // ------------------------------------------------------------ route matching
  function compile(path) {
    const keys = [];
    const re = path.replace(/[.+*?^${}()[\]\\]/g, '\\$&').replace(/\/:([A-Za-z0-9_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; });
    return { re: new RegExp('^' + re + '(?:/(?=.)|/?$)', 'i'), reExact: new RegExp('^' + re + '/?$', 'i'), keys };
  }
  function match(pathname, path, exact) {
    if (S && S.M && S.M.Router && S.M.Router.matchPath) {
      try { return S.M.Router.matchPath(pathname, { path, exact: !!exact }); } catch (_) { /* fall through */ }
    }
    const c = compile(path);
    const m = (exact ? c.reExact : c.re).exec(pathname);
    if (!m) return null;
    const params = {};
    c.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    return { path, url: m[0].replace(/\/$/, '') || '/', isExact: pathname === m[0] || pathname === m[0] + '/', params };
  }

  // ------------------------------------------------------------ the route switch patch (SR §3.4, §3.5)
  function switchRender(orig, self, props, second) {
    const st = S;
    if (!st || !st.ready || (!st.routes.size && !st.overrides.size)) return orig.call(self, props, second);
    let children;
    try { children = buildChildren(st, props.children); } catch (e) { logE('route switch: our children failed, rendering Steam\'s', errMsg(e)); return orig.call(self, props, second); }
    return orig.call(self, Object.assign({}, props, { children }), second);
  }
  function buildChildren(st, ch) {
    const { React } = st.M;
    const { jsx } = st.M.jsx;
    const loc = nav.location();
    let list = [].concat(ch);
    if (st.overrides.size) {
      list = list.map((c) => {
        const p = c && c.props && c.props.path;
        const o = typeof p === 'string' ? st.overrides.get(p) : null;
        if (!o) return c;
        return React.cloneElement(c, { children: jsx(st.ui.ErrorBoundary, {
          name: 'override ' + p, fallback: c.props.children === undefined ? null : c.props.children,
          children: jsx(OverrideHost, { o, steam: c.props.children, loc }),
        }) });
      });
    }
    if (st.routes.size) {
      const ours = [...st.routes.values()].sort((a, b) => b.path.length - a.path.length).map((r) => jsx(st.RouteType, {
        path: r.path, exact: !!r.opts.exact,
        children: jsx(st.ui.ErrorBoundary, { name: 'route ' + r.path, children: jsx(RouteHost, { r, loc }) }),
      }, 'lgs-route:' + r.path));
      list = ours.concat(list);
    }
    return list;
  }
  function OverrideHost(props) {
    const { o, steam, loc } = props;
    return o.fn(steam, { match: match(loc.pathname, o.path, false), location: loc });
  }
  function RouteHost(props) {
    const { r, loc } = props;
    return S.M.jsx.jsx(r.Component, { match: match(loc.pathname, r.path, r.opts.exact), location: loc });
  }
  function patchSwitch() {
    let n = 0;
    for (const f of routeSwitchFibers(S.M.RoutePaths)) {
      if (f.type && f.type[MARK]) continue;
      const orig = f.type;
      const patched = function LgsRouteSwitch(props, second) { return switchRender(orig, this, props, second); };
      patched[MARK] = 'switch';
      patched.__lgsOrig = orig;
      f.type = patched;
      if (f.alternate) f.alternate.type = patched;
      S.switchPatches.push({ fiber: f, alt: f.alternate, orig, patched });
      n++;
    }
    return n;
  }
  function unpatchSwitch() {
    let n = 0;
    for (const p of S.switchPatches) {
      for (const f of [p.fiber, p.alt, p.fiber.alternate]) if (f && f.type === p.patched) { f.type = p.orig; n++; }
    }
    S.switchPatches = [];
    return n;
  }
  function switchChildren() {
    const f = routeSwitchFibers(S.M.RoutePaths)[0];
    return f ? [].concat(f.memoizedProps.children) : [];
  }
  function onOurPath(pathname) {
    for (const r of S.routes.values()) if (match(pathname, r.path, r.opts.exact)) return true;
    for (const o of S.overrides.values()) if (match(pathname, o.path, false)) return true;
    return false;
  }

  // One history listener and one window listener while anything is registered: re-patch the switch
  // before the router renders into our paths (SR §3.4 self-healing), and re-apply byProps patches on
  // bare function components that remounted.
  function syncWatchers() {
    const any = S.routes.size || S.overrides.size || [...S.targets.values()].some((T) => T.needsRefresh);
    if (any && !S.unlisten) {
      S.unlisten = inst().m_history.listen((loc) => {
        try { if ((S.routes.size || S.overrides.size) && onOurPath(loc.pathname)) patchSwitch(); } catch (e) { logE('re-patch failed', errMsg(e)); }
        refreshTargets('navigation');
      });
      try { if (rt.windows && typeof rt.windows.onAdd === 'function') S.winOff = rt.windows.onAdd(() => refreshTargets('window')); } catch (_) { S.winOff = null; }
    } else if (!any && S.unlisten) {
      try { S.unlisten(); } catch (_) { /* gone */ }
      S.unlisten = null;
      if (S.winOff) { try { S.winOff(); } catch (_) { /* gone */ } S.winOff = null; }
    }
    if (!S.routes.size && !S.overrides.size && S.switchPatches.length) unpatchSwitch();
  }
  function rerenderIfOn(test) {
    let cur; try { cur = route(); } catch (_) { return; }
    if (test(cur)) { try { inst().Navigate(cur, true); } catch (e) { logE('re-render navigation failed', errMsg(e)); } }
  }

  const routes = {
    add(path, Component, opts) {
      need();
      opts = Object.assign({}, opts);
      if (typeof path !== 'string' || !path.startsWith(PREFIX) || path.length <= PREFIX.length) throw new Error(`lgs-react: routes.add: ${path} must be under ${PREFIX} (SR §3.4)`);
      if (typeof Component !== 'function' && !(Component && typeof Component === 'object')) throw new Error('lgs-react: routes.add: Component must be a component');
      if (S.routes.has(path)) throw new Error(`lgs-react: routes.add: ${path} is already added`);
      if (!S.switchPatches.length && !patchSwitch()) throw new Error('lgs-react: route switch not found; nothing added');
      const r = { path, Component, opts, owner: opts.owner || null };
      S.routes.set(path, r);
      syncWatchers();
      rerenderIfOn((cur) => !!match(cur, path, opts.exact));
      const st = S;
      return {
        path,
        remove() {
          if (S !== st || !S.routes.has(path) || S.routes.get(path) !== r) return false;
          let on = false; try { on = !!match(route(), path, opts.exact); } catch (_) { /* no window */ }
          S.routes.delete(path);
          if (on) { try { inst().Navigate('/library/home', true); } catch (_) { /* gone */ } }
          syncWatchers();
          return true;
        },
      };
    },
    override(path, fn, opts) {
      need();
      opts = Object.assign({}, opts);
      if (typeof path !== 'string' || !path) throw new Error('lgs-react: routes.override: path must be a string');
      if (typeof fn !== 'function') throw new Error('lgs-react: routes.override: fn must be a function');
      if (S.overrides.has(path)) throw new Error(`lgs-react: routes.override: ${path} is already overridden`);
      if (!switchChildren().some((c) => c && c.props && c.props.path === path)) throw new Error(`lgs-react: routes.override: Steam has no top-level route ${path}`);
      if (!S.switchPatches.length && !patchSwitch()) throw new Error('lgs-react: route switch not found; nothing overridden');
      const o = { path, fn, opts, owner: opts.owner || null };
      S.overrides.set(path, o);
      syncWatchers();
      rerenderIfOn((cur) => !!match(cur, path, false));
      const st = S;
      return {
        path,
        remove() {
          if (S !== st || S.overrides.get(path) !== o) return false;
          S.overrides.delete(path);
          syncWatchers();
          rerenderIfOn((cur) => !!match(cur, path, false));
          return true;
        },
      };
    },
    list() { return { added: S ? [...S.routes.keys()] : [], overridden: S ? [...S.overrides.keys()] : [] }; },
    get paths() { return need().RoutePaths; },
  };

  // ------------------------------------------------------------ patches by props shape (SR §3.2)
  const baseFn = (f) => (f && f[MARK] && f.__lgsOrig ? f.__lgsOrig : f);
  // What to patch for a fiber: a shared holder (memo .type, forwardRef .render, class prototype.render)
  // and/or the live fibers' own type.
  function describe(f) {
    const t = f.type;
    switch (f.tag) {
      case 0: {
        if (typeof t !== 'function') return null;
        const p = f.return;
        if (p && p.tag === 14 && p.type && baseFn(p.type.type) === baseFn(t)) return { kind: 'memo', holder: p.type, key: 'type', orig: baseFn(t), fiberType: true };
        return { kind: 'fn', holder: null, key: null, orig: baseFn(t), fiberType: true };
      }
      case 15: {
        if (typeof t !== 'function') return null;
        const h = f.elementType && typeof f.elementType === 'object' ? f.elementType : null;
        return { kind: 'simplememo', holder: h, key: h ? 'type' : null, orig: baseFn(t), fiberType: true };
      }
      case 14: {
        const inner = t && t.type;
        if (typeof inner === 'function') return { kind: 'memo', holder: t, key: 'type', orig: baseFn(inner), fiberType: true };
        if (inner && typeof inner.render === 'function') return { kind: 'fwd', holder: inner, key: 'render', orig: baseFn(inner.render), fiberType: false };
        return null;
      }
      case 11:
        if (t && typeof t.render === 'function') return { kind: 'fwd', holder: t, key: 'render', orig: baseFn(t.render), fiberType: false };
        return null;
      case 1:
        if (typeof t === 'function' && t.prototype && typeof t.prototype.render === 'function') return { kind: 'class', holder: t.prototype, key: 'render', orig: baseFn(t.prototype.render), fiberType: false };
        return null;
      default: return null;
    }
  }
  const PATCH_TAGS = new Set([0, 1, 11, 14, 15]);
  function matchTargets(pred, tags) {
    const found = new Map();  // orig -> desc
    walk((f) => {
      if (!(tags || PATCH_TAGS).has(f.tag)) return;
      const p = f.memoizedProps;
      if (!p || typeof p !== 'object') return;
      let ok = false; try { ok = !!pred(p, f); } catch (_) { ok = false; }
      if (!ok) return;
      const d = describe(f);
      if (d && !found.has(d.orig)) found.set(d.orig, d);
    });
    return [...found.values()];
  }
  function swapLiveFibers(T) {
    let n = 0;
    walk((f) => {
      if (f.tag !== 0 && f.tag !== 15) return;
      if (typeof f.type !== 'function' || baseFn(f.type) !== T.orig) return;
      if (f.type !== T.installed) { f.type = T.installed; n++; }
      if (f.alternate && typeof f.alternate.type === 'function' && baseFn(f.alternate.type) === T.orig && f.alternate.type !== T.installed) f.alternate.type = T.installed;
    });
    T.live = n;
    return n;
  }
  function installTarget(T) {
    let fn = T.orig;
    for (const L of T.layers) {
      const w = L.wrap(fn);
      if (typeof w !== 'function') throw new Error(`lgs-react: patch ${L.id}: wrap() must return a function`);
      fn = w;
    }
    if (T.layers.length) {
      const composed = fn;
      const tramp = function LgsPatched() { return composed.apply(this, arguments); };
      tramp[MARK] = T.layers.map((L) => L.id).join(',');
      tramp.__lgsOrig = T.orig;
      fn = tramp;
    }
    T.installed = fn;
    if (T.holder) { T.holder[T.key] = fn; S.touched.add(T); }
    if (T.fiberType) swapLiveFibers(T);
  }
  function refreshTargets(why) {
    if (!S || !S.ready) return;
    for (const T of S.targets.values()) {
      if (T.needsRefresh && T.layers.length) { try { swapLiveFibers(T); } catch (e) { logE('patch refresh failed (' + why + ')', errMsg(e)); } }
    }
    for (const h of S.handles.values()) {
      if (h._pending) { try { h._attach(true); } catch (e) { logE(`patch ${h.id}: late attach failed`, errMsg(e)); } }
    }
  }

  const patch = {
    byProps(id, predicate, wrap, opts) {
      need();
      opts = Object.assign({ max: 1 }, opts);
      if (typeof id !== 'string' || !id) throw new Error('lgs-react: patch.byProps: id must be a string');
      if (S.handles.has(id)) throw new Error(`lgs-react: patch.byProps: ${id} already exists`);
      if (typeof predicate !== 'function') throw new Error(`lgs-react: patch.byProps ${id}: predicate must be a function (is it one of patch.targets that is still null?)`);
      if (typeof wrap !== 'function') throw new Error(`lgs-react: patch.byProps ${id}: wrap must be a function`);
      const tags = opts.tags ? new Set(opts.tags) : null;
      const layer = { id, wrap };
      const h = {
        id, count: 0, live: 0, kinds: [], _pending: false, _targets: [],
        _attach(late) {
          const found = matchTargets(predicate, tags);
          if (found.length > opts.max) throw new Error(`lgs-react: patch.byProps ${id}: ${found.length} components match (max ${opts.max}); tighten the predicate`);
          if (!found.length) {
            if (opts.optional) { h._pending = true; syncWatchers(); return 0; }
            throw new Error(`lgs-react: patch.byProps ${id}: nothing matches (fail closed)`);
          }
          // Validate every wrap before touching anything.
          for (const d of found) { const w = wrap(d.orig); if (typeof w !== 'function') throw new Error(`lgs-react: patch.byProps ${id}: wrap() must return a function`); }
          for (const d of found) {
            let T = S.targets.get(d.orig);
            if (!T) { T = Object.assign({ layers: [], installed: d.orig, live: 0 }, d); T.needsRefresh = !T.holder && T.fiberType; S.targets.set(d.orig, T); }
            T.layers.push(layer);
            installTarget(T);
            h._targets.push(T);
          }
          h._pending = false;
          h.count = h._targets.length;
          h.kinds = h._targets.map((T) => T.kind);
          h.live = h._targets.reduce((a, T) => a + (T.live || 0), 0);
          if (late) logI(`patch ${id}: attached late`, { count: h.count });
          syncWatchers();
          return h.count;
        },
        refresh() { refreshTargets('manual'); h.live = h._targets.reduce((a, T) => a + (T.live || 0), 0); return h.live; },
        remove() {
          if (!S || S.handles.get(id) !== h) return false;
          for (const T of h._targets) {
            T.layers = T.layers.filter((L) => L !== layer);
            try { installTarget(T); } catch (e) { logE(`patch ${id}: restore failed`, errMsg(e)); }
            if (!T.layers.length) S.targets.delete(T.orig);
          }
          h._targets = [];
          h.count = 0;
          S.handles.delete(id);
          syncWatchers();
          return true;
        },
      };
      S.handles.set(id, h);
      try { h._attach(false); } catch (e) { S.handles.delete(id); throw e; }
      return h;
    },
    // Named predicates for known targets (contract §5.2). null = not mapped yet.
    targets: {
      plusButton: (p) => { const k = Object.keys(p); return k.length === 1 && k[0] === 'allowLaunchProgram'; },
      pagedSettings: (p) => {
        if (!Array.isArray(p.pages)) return false;
        let sys = null; try { sys = S.M.RoutePaths.Settings.System(); } catch (_) { return false; }
        return p.pages.some((pg) => pg && pg.route === sys);
      },
      statusPill: null,
      appButtons: null,
    },
    list() { return S ? [...S.handles.values()].map((h) => ({ id: h.id, count: h.count, live: h.live, kinds: h.kinds, pending: h._pending })) : []; },
  };

  // ------------------------------------------------------------ localization (PLAN §1.15)
  function loc(token, ...args) {
    try {
      const LM = window.LocalizationManager;
      if (!LM || typeof token !== 'string') return null;
      const s = LM.LocalizeString(token, ...args);
      return typeof s === 'string' && s && s !== token ? s : null;
    } catch (_) { return null; }
  }
  function lang() {
    try {
      const LM = window.LocalizationManager;
      const l = LM.GetPreferredLocales ? LM.GetPreferredLocales() : null;
      return String((Array.isArray(l) ? l[0] : l) || 'english');
    } catch (_) { return 'english'; }
  }
  const isEnglish = () => /^en/i.test(lang());
  // Steam's string for token, else the English text only when the UI language is English, else null.
  const text = (token, english) => (token && loc(token)) || (isEnglish() ? (english || null) : null);

  // ------------------------------------------------------------ UI helpers
  function makeUI(M) {
    const React = M.React;
    const { jsx, jsxs } = M.jsx;
    class ErrorBoundary extends React.Component {
      constructor(p) { super(p); this.state = { err: null }; }
      static getDerivedStateFromError(err) { return { err }; }
      componentDidCatch(err) { logE('render error in ' + (this.props.name || 'view'), String((err && err.stack) || err).slice(0, 600)); }
      render() {
        if (!this.state.err) return this.props.children === undefined ? null : this.props.children;
        if (this.props.fallback !== undefined) return this.props.fallback;
        return jsx(FailPage, { name: this.props.name, err: this.state.err });
      }
    }
    // Our error page: Steam's header and footer stay; Back is focused (SR §7).
    function FailPage() {
      const back = () => nav.back();
      const title = text(null, 'This view could not be shown');
      return jsx(M.GamepadPage, { scrollable: false, children: jsxs(M.Focusable, {
        className: 'lgs-react-fail', onCancel: back, onCancelActionDescription: text('#Button_Back', 'Back'),
        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '32px', height: '100%', color: '#fff' },
        children: [
          title ? jsx('div', { style: { fontSize: '32px', fontWeight: 600 }, children: title }, 't') : null,
          jsx(M.DialogButton, { autoFocus: true, onClick: back, style: { minWidth: '200px', minHeight: '60px', borderRadius: '30px', fontSize: '24px', fontWeight: 600 }, children: text('#Button_Back', 'Back') }, 'b'),
        ] }) });
    }
    function Page(props) {
      const { onCancel, className, pageProps, rootProps, children, name } = props;
      const cancel = onCancel || (() => nav.back());
      return jsx(ErrorBoundary, { name: name || 'page', children: jsx(M.GamepadPage, Object.assign({ scrollable: false }, pageProps, {
        children: jsx(M.Focusable, Object.assign({}, rootProps, {
          className, onCancel: cancel, onCancelActionDescription: text('#Button_Back', 'Back'), children,
        })),
      })) });
    }
    function Style(props) { return jsx('style', { children: props.css }); }
    return { ErrorBoundary, FailPage, Page, Style };
  }
  function trackMenu(m) {
    if (!m) return m;
    S.menus.add(m);
    try { if (typeof m.SetOnHideCallback === 'function') { const st = S; m.SetOnHideCallback(() => { if (st.menus) st.menus.delete(m); }); } } catch (_) { /* older client */ }
    return m;
  }
  const ui = {
    get Page() { need(); return S.ui.Page; },
    get ErrorBoundary() { need(); return S.ui.ErrorBoundary; },
    get Style() { need(); return S.ui.Style; },
    style(css) { need(); return S.M.jsx.jsx(S.ui.Style, { css }); },
    loc, lang, text,
    menu(content, anchor, opts) {
      const M = need();
      opts = opts || {};
      if (!M.showContextMenu || !M.Menu) throw new Error('lgs-react: Steam context menu components not found');
      const { jsx } = M.jsx;
      const { Menu, MenuItem, MenuSeparator } = M.Menu;
      let el = content;
      if (Array.isArray(content)) {
        el = jsx(Menu, { label: opts.label, children: content.map((it, i) => {
          if (!it) return null;
          if (it === 'separator' || it.separator) return MenuSeparator ? jsx(MenuSeparator, {}, 'sep' + i) : null;
          const p = { onSelected: it.onSelected, disabled: !!it.disabled, children: it.label };
          if (it.tone) p.tone = it.tone;
          if (it.className) p.className = it.className;
          return jsx(MenuItem, p, it.key || 'item' + i);
        }) });
      }
      return trackMenu(M.showContextMenu(el, anchor || mainWin().document.body, opts.position || {}));
    },
    modal(element, opts) {
      const M = need();
      opts = opts || {};
      if (!M.showModal) throw new Error('lgs-react: Steam showModal not found');
      const st = S;
      return Promise.resolve(M.showModal(element, opts.window || mainWin(), opts.options)).then((m) => { if (m && st.modals) st.modals.add(m); return m; });
    },
    confirm(o) {
      const M = need();
      if (!M.ConfirmModal) throw new Error('lgs-react: Steam ConfirmModal not found');
      o = o || {};
      const p = { strTitle: o.title, strDescription: o.description, onOK: o.onOK, onCancel: o.onCancel };
      if (o.okText) p.strOKButtonText = o.okText;
      if (o.cancelText) p.strCancelButtonText = o.cancelText;
      if (o.middleText) { p.strMiddleButtonText = o.middleText; p.onMiddleButton = o.onMiddle; }
      if (o.alert) p.bAlertDialog = true;
      return ui.modal(M.jsx.jsx(M.ConfirmModal, p), o);
    },
  };

  // ------------------------------------------------------------ data (read-only, SR §3.7)
  function overview(x) {
    if (x && typeof x === 'object') return x;
    try { return window.appStore.GetAppOverviewByAppID(Number(x)) || null; } catch (_) { return null; }
  }
  function isLiquidGlass(a) {
    return !!a && ((typeof a.strExePath === 'string' && /\/glass-shell\/device\/lgs$/.test(a.strExePath)) || a.strAppName === 'Liquid Glass');
  }
  function filterPrograms(list, devMode, opts) {
    if (!Array.isArray(list)) return [];
    const F = S && S.M && S.M.LaunchFilters;
    const ex = F ? [...F.always, ...(devMode ? [] : F.devOnly)] : ['steam', 'vrurlhandler'];
    const allow = F ? F.allow : [];
    const out = [];
    for (const a of list) {
      if (!a) continue;
      const keep = allow.includes(a.strAppName) || !ex.some((x) => a.strExePath === x || String(a.strExePath || '').endsWith('/' + x));
      if (!keep) continue;
      const lg = isLiquidGlass(a);
      if (lg && !(opts && opts.includeLiquidGlass)) continue;
      out.push({
        key: a.strCmdline, name: a.strAppName, exePath: a.strExePath, cmdline: a.strCmdline, args: a.strArguments,
        iconUrl: a.strIconDataBase64 ? 'data:image/png;base64,' + a.strIconDataBase64 : null,
        isApplication: !!a.bIsApplication, isLiquidGlass: lg, raw: a,
      });
    }
    return out;
  }
  const data = {
    stores: () => ({ collectionStore: window.collectionStore, appStore: window.appStore, urlStore: window.urlStore }),
    app: (appid) => overview(appid),
    collection(id) { try { return window.collectionStore.GetCollection(id) || null; } catch (_) { return null; } },
    installedGames(opts) {
      opts = opts || {};
      const cs = window.collectionStore;
      const apps = (cs && cs.localGamesCollection ? cs.localGamesCollection.allApps : []).slice();
      if (opts.sort === 'name') apps.sort((a, b) => String(a.display_name).localeCompare(String(b.display_name)));
      else apps.sort((a, b) => (b.rt_last_time_played || 0) - (a.rt_last_time_played || 0));
      return (opts.limit ? apps.slice(0, opts.limit) : apps).map((ov) => ({ appid: ov.appid, name: ov.display_name, overview: ov }));
    },
    recentGames(limit) {
      const c = window.collectionStore && window.collectionStore.recentAppsCollection;
      const apps = c ? (c.visibleApps || c.allApps || []).slice() : [];
      return (limit ? apps.slice(0, limit) : apps).map((ov) => ({ appid: ov.appid, name: ov.display_name, overview: ov }));
    },
    art(x) {
      const ov = overview(x);
      const out = { portrait: [], hero: null, logo: null, header: null, icon: null, custom: { hero: [], logo: [], landscape: [], portrait: [] } };
      if (!ov) return out;
      const as = window.appStore, us = window.urlStore;
      try { out.portrait.push(...[].concat(as.GetCachedVerticalCapsuleURL(ov) || [])); } catch (_) { /* older client */ }
      try { const u = as.GetVerticalCapsuleURLForApp(ov); if (u) out.portrait.push(u); } catch (_) { /* older client */ }
      out.portrait = out.portrait.filter(Boolean);
      const b = (file) => { try { return us.BuildCachedLibraryAssetURL(ov.appid, file, ov.local_cache_version) || null; } catch (_) { return null; } };
      out.hero = b('library_hero.jpg'); out.logo = b('logo.png'); out.header = b('header.jpg');
      try { out.icon = as.GetIconURLForApp(ov) || null; } catch (_) { /* none */ }
      const c = (fn) => { try { const v = as[fn] && as[fn](ov); return Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []); } catch (_) { return []; } };
      out.custom = { hero: c('GetCustomHeroImageURLs'), logo: c('GetCustomLogoImageURLs'), landscape: c('GetCustomLandcapeImageURLs'), portrait: c('GetCustomVerticalCapsuleImageURLs') };
      return out;
    },
    // Hooks: call only inside a component rendered by a route, override or patch of this module.
    useDevMode() {
      const M = need();
      const v = M.LaunchFilters && M.LaunchFilters.useDevMode ? M.LaunchFilters.useDevMode() : [true];
      return !!(Array.isArray(v) ? v[0] : v);
    },
    useNonSteamApps(opts) {
      const M = need();
      opts = opts || {};
      const dev = data.useDevMode();
      const raw = M.useNonSteamApps ? M.useNonSteamApps(true, opts.enabled !== false, opts.refresh || 0) : undefined;
      const lg = !!opts.includeLiquidGlass;
      return M.React.useMemo(() => (Array.isArray(raw) ? filterPrograms(raw, dev, { includeLiquidGlass: lg }) : null), [raw, dev, lg]);
    },
    filterPrograms: (list, devMode, opts) => filterPrograms(list, devMode, opts),
    isLiquidGlass,
  };

  // ------------------------------------------------------------ actions (HA §14, PLAN §2.3 P2, RX-7)
  function untrustedPointer(ev) {
    const ne = ev && (ev.nativeEvent || ev);
    if (!ne || typeof ne !== 'object' || typeof ne.isTrusted !== 'boolean') return false;
    return /^(click|dblclick|auxclick|contextmenu|mouse|pointer)/.test(String(ne.type || '')) && !ne.isTrusted;
  }
  function testReasons(ev) {
    const r = [];
    let loggerOn = null;
    try { const t = rt.test && rt.test.actions; loggerOn = t && typeof t.enabled === 'function' ? !!t.enabled() : null; } catch (_) { loggerOn = null; }
    if (loggerOn === null) r.push('test state unreadable (fail closed)');
    else if (loggerOn) r.push('runtime action logger on');
    if (S && S.forceTest) r.push('actions.test(true)');
    let live; try { live = rt.flags.get('actionsLive'); } catch (_) { live = undefined; }
    if (live !== true) r.push('flag actionsLive is not true');
    if (untrustedPointer(ev)) r.push('synthetic pointer event');
    return r;
  }
  function recordAction(entry) {
    S.actionLog.push(entry);
    if (S.actionLog.length > ACTION_LOG_MAX) S.actionLog.splice(0, S.actionLog.length - ACTION_LOG_MAX);
    try { const t = rt.test && rt.test.actions; if (t && typeof t.record === 'function' && (entry.mode !== 'executed')) t.record({ fn: entry.fn, arg: entry.arg, mode: entry.mode, reason: entry.reason, detail: entry.detail }); } catch (_) { /* no runtime */ }
    for (const cb of S.actionSubs) { try { cb(entry); } catch (_) { /* subscriber gone */ } }
  }
  // plan() -> {run: fn | null, refuse: reason, detail}
  function act(fn, arg, ev, plan) {
    if (!S) throw new Error('lgs-react: module not installed');
    const reasons = testReasons(ev);
    let p;
    try { p = plan() || {}; } catch (e) { p = { run: null, refuse: 'Steam handler lookup failed: ' + errMsg(e) }; }
    const entry = { t: Date.now(), fn, arg, mode: 'executed', reason: null, detail: p.detail || null };
    if (typeof p.run !== 'function') { entry.mode = 'refused'; entry.reason = p.refuse || 'Steam handler not found'; }
    else if (reasons.length) { entry.mode = 'logged'; entry.reason = reasons.join('; '); }
    if (entry.mode === 'executed') {
      try { const r = p.run(); if (r && typeof r.catch === 'function') r.catch((e) => logE(`action ${fn} failed`, errMsg(e))); } catch (e) { entry.mode = 'error'; entry.reason = errMsg(e); }
    }
    recordAction(entry);
    return { fn, arg, mode: entry.mode, reason: entry.reason, detail: entry.detail };
  }
  function primaryInfo(appid) {
    const M = need();
    const ov = overview(appid);
    if (!ov) return { appid, action: null, label: null, reason: 'no such app' };
    if (!M.AppActions) return { appid, action: null, label: null, reason: 'Steam app actions not found' };
    const action = M.AppActions.primaryAction(inst(), ov, CLIENT);
    let label = null;
    if (action) { try { label = M.ActionLabel ? M.ActionLabel(action, 1) : null; } catch (_) { label = null; } }
    return { appid: ov.appid, name: ov.display_name, action: action || null, label, overview: ov };
  }
  const actions = {
    launchNonSteam(cmdline, ev) {
      return act('launchNonSteam', cmdline, ev, () => {
        if (typeof cmdline !== 'string' || !cmdline) return { refuse: 'cmdline must be a non-empty string' };
        const A = window.SteamClient && window.SteamClient.Apps;
        if (!A || typeof A.LaunchNonSteamApp !== 'function') return { refuse: 'SteamClient.Apps.LaunchNonSteamApp not found' };
        return { run: () => A.LaunchNonSteamApp(cmdline) };
      });
    },
    primary(appid, ev) {
      return act('primary', appid, ev, () => {
        const i = primaryInfo(appid);
        if (!i.action) return { refuse: i.reason || 'no primary action for this app', detail: { action: null } };
        const M = S.M;
        const ov = i.overview;
        return {
          detail: { action: i.action, label: i.label, name: i.name },
          run: () => { const f = M.AppActions.runAction(i.action, ov, CLIENT, LAUNCH_SOURCE_LIBRARY, mainWin()); if (typeof f === 'function') f(); },
        };
      });
    },
    desktopWindow(windowId, ev) {
      return act('desktopWindow', windowId, ev, () => {
        const M = need();
        const p = M.VRMessages;
        if (!p || !p.SteamVR || typeof p.SteamVR.DashboardDesktopWindowClicked !== 'function') return { refuse: 'DashboardDesktopWindowClicked not found' };
        if (windowId == null) return { refuse: 'windowId missing' };
        return { run: () => p.SteamVR.DashboardDesktopWindowClicked({ window_id: windowId }) };
      });
    },
    navigate(path, opts, ev) {
      if (opts && typeof opts === 'object' && (opts.nativeEvent || typeof opts.isTrusted === 'boolean')) { ev = opts; opts = {}; }
      const replace = !!(opts && opts.replace);
      return act('navigate', path, ev, () => {
        if (typeof path !== 'string' || !path.startsWith('/')) return { refuse: 'path must start with /' };
        return { detail: { replace }, run: () => inst().Navigate(path, replace) };
      });
    },
    primaryInfo(appid) { const i = primaryInfo(appid); return { appid: i.appid, name: i.name || null, action: i.action, label: i.label, reason: i.reason || null }; },
    mode(ev) { const r = testReasons(ev); return { mode: r.length ? 'test' : 'live', reasons: r }; },
    get log() { return S ? S.actionLog.slice() : []; },
    onLog(cb) { S.actionSubs.add(cb); const st = S; return () => { st.actionSubs.delete(cb); }; },
    test(on) { S.forceTest = !!on; return actions.mode(); },
    // The Steam function each action calls (identity checks, HA AT-4).
    handler(name) {
      switch (name) {
        case 'launchNonSteam': { const A = window.SteamClient && window.SteamClient.Apps; return A ? A.LaunchNonSteamApp : null; }
        case 'primary': { const M = need(); return M.AppActions ? { primaryAction: M.AppActions.primaryAction, runAction: M.AppActions.runAction, launchSource: LAUNCH_SOURCE_LIBRARY, client: CLIENT } : null; }
        case 'desktopWindow': { const M = need(); return M.VRMessages && M.VRMessages.SteamVR ? M.VRMessages.SteamVR.DashboardDesktopWindowClicked : null; }
        case 'navigate': return inst().Navigate;
        default: return null;
      }
    },
  };

  // ------------------------------------------------------------ status, removal
  function countPatchedLeft(touched) {
    let n = 0;
    const isOurs = (t) => !!t && ((typeof t === 'function' && t[MARK]) || (typeof t === 'object' && ((t.type && t.type[MARK]) || (t.render && t.render[MARK]))));
    try {
      walk((f) => { if (isOurs(f.type)) n++; if (f.alternate && isOurs(f.alternate.type)) n++; });
    } catch (_) { /* no window */ }
    for (const T of touched || []) { try { if (T.holder && T.holder[T.key] && T.holder[T.key][MARK]) n++; } catch (_) { /* gone */ } }
    return n;
  }
  function status() {
    const st = S;
    const out = { version: VERSION, installed: !!st, ready: !!(st && st.ready), error: st && st.error ? st.error.message : null,
      scanMs: st ? st.scanMs : null, factories: st ? st.factories : 0, finders: {}, switchFibers: null, patchedLive: null,
      routes: [], overrides: [], patches: [], actions: null };
    if (!st) return out;
    for (const k in FINDERS) out.finders[k] = { module: st.where[k] || null, candidates: st.counts[k] == null ? null : st.counts[k], required: REQUIRED.includes(k), found: !!(st.M && st.M[k]) };
    if (st.ready) {
      try { const live = routeSwitchFibers(st.M.RoutePaths); out.switchFibers = live.length; out.patchedLive = live.filter((f) => f.type && f.type[MARK]).length; } catch (e) { out.switchError = errMsg(e); }
    }
    out.routes = [...st.routes.keys()];
    out.overrides = [...st.overrides.keys()];
    out.patches = patch.list();
    try { out.actions = Object.assign(actions.mode(), { logged: st.actionLog.length }); } catch (_) { /* no runtime */ }
    return out;
  }
  function removeAll() {
    const st = S;
    if (!st) return { patchedLeft: 0, restored: 0 };
    const rep = { restored: 0, routeBefore: null, routeAfter: null };
    for (const m of st.menus) { try { m.Hide(); } catch (_) { /* closed */ } }
    for (const m of st.modals) { try { m.Close(); } catch (_) { /* closed */ } }
    st.menus.clear(); st.modals.clear();
    let cur = null; try { cur = route(); } catch (_) { /* no window */ }
    rep.routeBefore = cur;
    let onOurs = false, onOverride = false;
    if (cur && st.ready) {
      for (const r of st.routes.values()) if (match(cur, r.path, r.opts.exact)) onOurs = true;
      for (const o of st.overrides.values()) if (match(cur, o.path, false)) onOverride = true;
    }
    st.routes.clear(); st.overrides.clear();
    const touched = [...st.touched];
    for (const T of st.targets.values()) { T.layers = []; try { installTarget(T); rep.restored++; } catch (e) { logE('restore failed', errMsg(e)); } }
    st.targets.clear(); st.handles.clear();
    rep.restored += unpatchSwitch();
    if (st.unlisten) { try { st.unlisten(); } catch (_) { /* gone */ } st.unlisten = null; }
    if (st.winOff) { try { st.winOff(); } catch (_) { /* gone */ } st.winOff = null; }
    if (onOurs) { try { inst().Navigate('/library/home', true); } catch (_) { /* gone */ } }
    else if (onOverride) { try { inst().Navigate(cur, true); } catch (_) { /* gone */ } }
    rep.patchedLeft = st.ready ? countPatchedLeft(touched) : 0;
    try { rep.routeAfter = route(); } catch (_) { /* gone */ }
    st.actionSubs.clear();
    st.src = null; st.req = null; st.M = null; st.ui = null;
    S = null;
    return rep;
  }

  // ------------------------------------------------------------ the API
  function makeApi() {
    const api = {
      version: VERSION,
      get isReady() { return !!(S && S.ready); },
      ready,
      status,
      // Tests only: forget a failed scan (and any broken-finder hook) so ready() can run again.
      reset() {
        if (!S) return false;
        if (S.routes.size || S.overrides.size || S.handles.size || S.switchPatches.length) throw new Error('lgs-react: reset() with live patches; remove them first');
        const keep = { actionLog: S.actionLog, actionSubs: S.actionSubs };
        S = Object.assign(newState(), keep);
        return true;
      },
      find(spec) { need(); return findIn(spec); },
      util,
      fiber,
      routes,
      patch,
      ui,
      data,
      actions,
      nav,
      get React() { return need().React; },
      get jsx() { return need().jsx.jsx; },
      get jsxs() { return need().jsx.jsxs; },
      get Fragment() { return need().jsx.Fragment || need().React.Fragment; },
      get ReactDOM() { return need().ReactDOM || null; },
      get router() { return need().Router || null; },
      get Routes() { return need().RoutePaths; },
      get M() { return need(); },
      get c() {
        const M = need();
        const m = M.Menu || {};
        return { Focusable: M.Focusable, DialogButton: M.DialogButton, DialogButtonPrimary: M.DialogButtonPrimary || null, Field: M.Field || null,
          ToggleField: M.ToggleField || null, SliderField: M.SliderField || null, DropdownField: M.DropdownField || null, GamepadPage: M.GamepadPage,
          ScrollPanel: M.ScrollPanel || null, ScrollPanelGroup: M.ScrollPanelGroup || null, Menu: m.Menu || null, MenuItem: m.MenuItem || null,
          MenuSeparator: m.MenuSeparator || null, ConfirmModal: M.ConfirmModal || null, showModal: M.showModal || null, showContextMenu: M.showContextMenu || null };
      },
      // Test hooks (RX-5): the next ready() treats these finders as missing.
      test: {
        breakFinder(name) { if (!S) return false; if (name) S.broken.add(name); else S.broken.clear(); return [...S.broken]; },
        countPatchedLeft: () => countPatchedLeft(S ? [...S.touched] : []),
      },
    };
    return api;
  }

  RT.define({
    name: 'react',
    deps: [],
    install(scope) {
      rt = scope || RT;
      S = newState();
      return makeApi();
    },
    remove() {
      const rep = removeAll();
      rt = null;
      return { patchedLeft: rep.patchedLeft || 0, restored: rep.restored || 0, routeBefore: rep.routeBefore || null, routeAfter: rep.routeAfter || null };
    },
  });
})();
