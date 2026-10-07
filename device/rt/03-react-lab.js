// Glass Shell runtime module "react-lab" (P2): the test-only lab route /library/lgs/lab and P2's
// acceptance tests RX-1 to RX-7. Contract: docs/phase2/contracts/react.md section 9.
//
// Flag `reactLab` (off by default): installed only inside a locked lab step, e.g.
//   python glass.py js --flags reactLab "__LGS_RT.use('react-lab').run('RX-1', L)"
// Everything here only navigates, moves controller focus, opens and cancels its OWN menus and modals,
// and logs. Actions run only through react.actions in test mode, behind spies. Nothing is launched,
// confirmed or changed.
(() => {
  'use strict';
  const RT = window.__LGS_RT || window.__LGS_RT_TEST;
  if (!RT || typeof RT.define !== 'function') return;

  const LAB = '/library/lgs/lab';
  const SELF = '/library/lgs/lab/selftest';
  const RAW = '/library/lgs/lab/raw';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const BTN = { A: 1, B: 2, X: 3, Y: 4, MENU: 14, UP: 9, DOWN: 10, LEFT: 11, RIGHT: 12 };

  let rt = null, react = null, S = null;

  const CSS = `
.lgsx-root{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:12px 48px 18px;box-sizing:border-box;color:#fff}
.lgsx-title{font-size:34px;font-weight:700}
.lgsx-sub{font-size:20px;opacity:.72}
.lgsx-grid{display:grid;grid-template-columns:repeat(3,176px);gap:22px 64px;justify-content:center}
.lgsx-tile{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px;border-radius:24px;outline:none;background:transparent}
.lgsx-disc{width:128px;height:128px;border-radius:50%;overflow:hidden;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:700}
.lgsx-disc img{width:100%;height:100%;object-fit:cover}
.lgsx-tile.gpfocus .lgsx-disc{scale:1.1;box-shadow:0 0 18px 2px rgba(255,255,255,.3)}
.lgsx-label{font-size:18px;max-width:176px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lgsx-bar{display:flex;gap:18px;align-items:center}
.lgsx-bar .DialogButton{min-width:180px;min-height:60px;border-radius:30px}
.lgsx-toggle{width:340px}
.lgsx-lab{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;color:#fff}
`;

  function newState() {
    return { fixtures: new Map(), events: [], listeners: new Set(), handles: [], labRoute: null, labEl: null, labSeq: 0, labError: null,
      rawRoute: null, rawEl: null, menu: null, spies: [] };
  }
  function emit(type, item) {
    const e = { t: Date.now(), type, kind: item && item.kind, id: item && item.id, name: item && item.name };
    S.events.push(e);
    if (S.events.length > 80) S.events.shift();
    for (const fn of S.listeners) { try { fn(e); } catch (_) { /* unmounted */ } }
  }
  const doc = () => react.nav.win().document;
  const route = () => react.nav.route();
  const FNC = () => window.FocusNavController;

  // ------------------------------------------------------------ built-in fixtures (Steam's components, fake props)
  function builtinFixtures() {
    const noop = () => {};
    S.fixtures.set('ConfirmModal', (r) => r.jsx(r.c.ConfirmModal, {
      strTitle: 'Lab fixture', strDescription: 'Steam ConfirmModal with no-op handlers (P2 RX-4).',
      onOK: noop, onCancel: noop, closeModal: noop,
    }));
    S.fixtures.set('buttons', (r) => r.jsxs(r.c.Focusable, { 'flow-children': 'row', style: { display: 'flex', gap: '24px' }, children: [
      r.jsx(r.c.DialogButton, { onClick: noop, children: 'Secondary' }, 'a'),
      r.c.DialogButtonPrimary ? r.jsx(r.c.DialogButtonPrimary, { onClick: noop, children: 'Primary' }, 'b') : null,
    ] }));
    S.fixtures.set('fields', (r) => r.jsx(FieldsFixture, {}));
    // A component that throws while rendering (ui.ErrorBoundary, lab.open() error reporting, RX-FAIL).
    S.fixtures.set('boom', (r) => r.jsx(BoomFixture, {}));
  }
  function BoomFixture() { throw new Error('react-lab: forced render error (fixture boom)'); }
  // A lab click: the events P10's L.click dispatches (untrusted pointer and mouse events; the 'click'
  // itself is a MouseEvent).
  function labClick(el) {
    const w = react.nav.win(), r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: w, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 };
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) el.dispatchEvent(new (t.startsWith('pointer') ? w.PointerEvent : w.MouseEvent)(t, Object.assign({ pointerType: 'mouse', isPrimary: true }, o)));
  }
  function FieldsFixture() {
    const R = react.React;
    const [on, setOn] = R.useState(false);
    const [v, setV] = R.useState(50);
    const c = react.c;
    return react.jsxs(c.Focusable, { 'flow-children': 'column', style: { width: '640px' }, children: [
      c.ToggleField ? react.jsx(c.ToggleField, { label: 'Toggle (local state)', checked: on, onChange: setOn }, 't') : null,
      c.SliderField ? react.jsx(c.SliderField, { label: 'Slider (local state)', value: v, min: 0, max: 100, step: 1, onChange: setV }, 's') : null,
    ] });
  }

  // ------------------------------------------------------------ lab route
  // The fixture renders inside its own ui.ErrorBoundary, keyed per open() so a new fixture never inherits
  // an earlier one's error state; the boundary reports what it caught (contract §9: {mounted, error}).
  function LabPage() {
    const el = S && S.labEl;
    const seq = S ? S.labSeq : 0;
    return react.jsx(react.ui.Page, {
      name: 'lab', className: 'lgsx-lab',
      onCancel: () => react.nav.back(),
      children: [react.ui.style(CSS), el ? react.jsx(react.ui.ErrorBoundary, {
        name: 'lab fixture', key: 'f' + seq,
        onError: (e) => { if (S && S.labSeq === seq) S.labError = String((e && e.message) || e); },
        children: el,
      }) : null],
    });
  }
  function fixtureElement(what, opts) {
    if (typeof what !== 'string') return what;
    const f = S.fixtures.get(what);
    if (!f) throw new Error('react-lab: no fixture ' + what);
    return f(react, (opts && opts.props) || {});
  }
  async function open(what, opts) {
    opts = opts || {};
    const el = fixtureElement(what, opts);
    S.labSeq++;
    S.labError = null;
    S.labEl = el;
    if (!S.labRoute) S.labRoute = react.routes.add(LAB, LabPage, { exact: true, owner: 'react-lab' });
    if (route() === LAB) react.nav.go(LAB, true); else react.nav.go(LAB);
    let mounted = false;
    for (let i = 0; i < 20 && !mounted; i++) { await sleep(100); mounted = !!doc().querySelector('.lgsx-lab'); }
    await sleep(300);
    const lab = doc().querySelector('.lgsx-lab');
    // The fixture's boundary caught: not mounted, with the error (C7 labels such fixtures "unverified").
    const failNode = !!(lab && lab.querySelector('.lgs-react-fail'));
    const error = S.labError || (failNode ? 'fixture render failed (error page shown)' : null);
    return { mounted: mounted && !error, error, route: route(), nodes: lab ? lab.querySelectorAll('*').length : 0 };
  }
  // A fixture as the WHOLE page of a real added route (no lab wrapper around it), at /library/lgs/lab/raw:
  // what a package's routes.add() page gets, e.g. ui.ErrorBoundary's error page (RX-FAIL, shots).
  async function openRaw(what, opts) {
    opts = opts || {};
    const el = fixtureElement(what, opts);
    S.rawEl = el;
    if (!S.rawRoute) S.rawRoute = react.routes.add(RAW, function LabRaw() { return S && S.rawEl ? S.rawEl : null; }, { exact: true, owner: 'react-lab' });
    if (route() === RAW) react.nav.go(RAW, true); else react.nav.go(RAW);
    await sleep(opts.settleMs || 1200);
    return { route: route(), failPage: !!doc().querySelector('.lgs-react-fail') };
  }
  async function close() {
    for (const p of [LAB, RAW]) {
      if (route() === p) {
        react.nav.back();
        await sleep(900);
        if (route() === p) { react.nav.go('/library/home', true); await sleep(600); }
      }
    }
    if (S.labRoute) { S.labRoute.remove(); S.labRoute = null; }
    if (S.rawRoute) { S.rawRoute.remove(); S.rawRoute = null; }
    S.labEl = null; S.rawEl = null; S.labError = null;
    await sleep(300);
    return { routeLeft: route() !== LAB && route() !== RAW, route: route(), nodesLeft: doc().querySelectorAll('.lgsx-lab').length, routes: react.routes.list() };
  }

  // ------------------------------------------------------------ RX-1: the SR §6 selftest, ported
  function makeSelftestPage() {
    const R = react.React, jsx = react.jsx, jsxs = react.jsxs, c = react.c;
    function Tile({ item, autoFocus }) {
      return jsxs(c.Focusable, {
        className: 'lgsx-tile', autoFocus, noFocusRing: true,
        onActivate: () => emit('activate', item),
        onOKActionDescription: 'Open (logged only)',
        onMenuButton: (e) => openMenu(item, e && e.currentTarget),
        onMenuActionDescription: 'Options',
        'data-lgsx': item.kind + ':' + item.id,
        children: [
          jsx('div', { className: 'lgsx-disc', children: item.art ? jsx('img', { src: item.art, alt: '' }) : (item.name || '?').slice(0, 1) }, 'd'),
          jsx('div', { className: 'lgsx-label', children: item.name }, 'l'),
        ],
      });
    }
    function openMenu(item, anchor) {
      S.menu = react.ui.menu([
        { label: 'Open (logged only)', onSelected: () => emit('menu-open', item) },
        { label: 'Details (logged only)', onSelected: () => emit('menu-details', item) },
      ], anchor, { label: item.name });
      emit('menu', item);
    }
    return function SelftestPage() {
      const [labels, setLabels] = R.useState(true);
      const programs = react.data.useNonSteamApps({});
      const items = R.useMemo(() => {
        const progs = (programs || []).slice(0, 3).map((p) => ({ kind: 'program', id: p.key, name: p.name, art: p.iconUrl }));
        const games = react.data.installedGames({ limit: 6 - progs.length }).map((g) => ({ kind: 'game', id: String(g.appid), name: g.name, art: react.data.art(g.overview).portrait[0] || null }));
        return games.concat(progs);
      }, [programs]);
      const back = () => { emit('back'); react.nav.back(); };
      return jsx(react.ui.Page, {
        name: 'selftest', className: 'lgsx-root' + (labels ? '' : ' lgsx-nolabels'), onCancel: back,
        children: [
          react.ui.style(CSS),
          jsx('div', { className: 'lgsx-title', children: 'P2 selftest' }, 'h'),
          jsx(c.Focusable, { 'flow-children': 'grid', className: 'lgsx-grid', children: items.map((it, i) => jsx(Tile, { item: it, autoFocus: i === 0 }, it.kind + ':' + it.id)) }, 'grid'),
          jsxs(c.Focusable, { 'flow-children': 'row', className: 'lgsx-bar', children: [
            jsx(c.DialogButton, { className: 'lgsx-back', onClick: back, children: react.ui.text('#Button_Back', 'Back') }, 'b'),
            c.ToggleField ? jsx('div', { className: 'lgsx-toggle', children: jsx(c.ToggleField, { label: 'Show labels', checked: labels, bottomSeparator: 'none', onChange: (v) => { setLabels(v); emit('toggle', { kind: 'local', id: 'labels', name: String(v) }); } }) }, 't') : null,
          ] }, 'bar'),
        ],
      });
    };
  }
  function where() {
    const f = doc().querySelector('.gpfocus');
    if (!f) return 'none';
    if (f.getAttribute('data-lgsx')) return f.getAttribute('data-lgsx');
    if (f.closest('.BasicUIContextMenu') || f.closest('[role=menu]')) return 'menu:' + (f.innerText || '').trim().split('\n')[0];
    if (f.closest('.lgsx-toggle')) return 'toggle';
    if (f.closest('.lgsx-root')) return f.classList.contains('lgsx-back') || f.closest('.lgsx-back') ? 'back-button' : 'page';
    // ui.ErrorBoundary's error page, only on the lab's own raw route (RX-FAIL).
    if (f.closest('.lgs-react-fail') && route() === RAW) return 'fail-page';
    return 'outside';
  }
  const inPage = (w) => /^(game|program):/.test(w) || ['toggle', 'back-button', 'page', 'fail-page'].includes(w);
  // A, B and MENU only while controller focus is inside our page or our own menu, and main is the
  // active focus context (never on Steam's own controls; never-list).
  function press(name) {
    const code = BTN[name];
    if (!code) throw new Error('press: unknown button');
    const w = where();
    const ours = inPage(w) || (!!S.menu && /^menu:/.test(w));
    if (!ours) throw new Error('press: controller focus is not inside the lab page or its menu (' + w + '); refusing');
    const fnc = FNC();
    const ctx = fnc.GetActiveContext && fnc.GetActiveContext();
    const mainCtx = react.nav.inst().GetFocusNavContext && react.nav.inst().GetFocusNavContext();
    if (ctx && mainCtx && ctx !== mainCtx) throw new Error('press: main is not the active focus context; refusing');
    fnc.DispatchVirtualButtonClick(code);
    return name;
  }
  function navState() {
    try {
      const fnc = FNC();
      const ctx = fnc.GetActiveContext && fnc.GetActiveContext();
      const tree = ctx && ctx.m_LastActiveNavTree;
      const src = fnc.m_navigationSource && fnc.m_navigationSource.m_currentValue;
      return (tree ? tree.id : '?') + ' source ' + (src ? src.eActivationSourceType : '?');
    } catch (_) { return '?'; }
  }
  async function selftestOnce(rep) {
    const check = (name, got, want) => {
      const pass = want instanceof RegExp ? want.test(String(got)) : got === want;
      rep.steps.push((pass ? 'PASS ' : 'FAIL ') + name + ': ' + got + (pass ? '' : '  (want ' + want + ')'));
      if (pass) rep.pass++; else { rep.fail++; rep.ok = false; }
      return pass;
    };
    const pad = async (dir) => {
      if (where() === 'none') await refocus();
      const before = where();
      if (!inPage(before)) throw new Error('focus is not in the page (' + before + '); refusing to send ' + dir);
      FNC().DispatchVirtualButtonClick(BTN[dir.toUpperCase()]);
      await sleep(260);
      return where();
    };
    const refocus = async () => {
      for (let i = 0; i < 8 && !/^(game|program):/.test(where()); i++) {
        if (where() === 'none') { react.nav.focusRoot(); await sleep(400); }
        if (where() === 'none' || where() === 'outside') FNC().DispatchVirtualButtonClick(BTN.DOWN);
        else FNC().DispatchVirtualButtonClick(BTN.UP);
        await sleep(300);
      }
      if (!/^(game|program):/.test(where())) rep.steps.push('NOTE focus not on a tile after refocus: ' + where() + ' (' + navState() + ')');
      return where();
    };
    const click = labClick;
    const since = (n) => S.events.slice(n).map((e) => e.type + (e.id ? ' ' + e.id : ''));
    if (route() !== SELF) { react.nav.go(SELF); await sleep(1600); }
    check('route', route(), SELF);
    const t = [...doc().querySelectorAll('.lgsx-tile')].map((e) => e.getAttribute('data-lgsx'));
    check('tiles', t.length, 6);
    const plan = [['right', t[1]], ['right', t[2]], ['right', t[2]], ['down', t[5]], ['left', t[4]], ['left', t[3]],
      ['up', t[0]], ['down', t[3]], ['down', /^(back-button|toggle)$/], ['right', 'toggle'], ['up', /^(game|program):/]];
    for (let attempt = 1; attempt <= 3; attempt++) {
      await refocus();
      for (let i = 0; i < 6 && t.indexOf(where()) !== 0; i++) await pad(t.indexOf(where()) >= 3 ? 'up' : 'left');
      const got = [where()];
      for (const [d] of plan) got.push(await pad(d));
      if (got.includes('none') && attempt < 3) { rep.steps.push('NOTE focus interrupted (' + navState() + '), retrying'); continue; }
      check('start', got[0], t[0]);
      plan.forEach(([d, want], i) => check('pad ' + d, got[i + 1], want));
      break;
    }
    let n = S.events.length;
    click([...doc().querySelectorAll('.lgsx-tile')].find((e) => e.getAttribute('data-lgsx') === t[1]));
    await sleep(300);
    check('laser click', since(n).filter((e) => e.startsWith('activate')).join(), 'activate ' + t[1].split(':').slice(1).join(':'));
    await refocus();
    const focusedTile = where();
    n = S.events.length;
    press('A'); await sleep(300);
    check('A on tile', since(n).filter((e) => e.startsWith('activate')).join(), 'activate ' + focusedTile.split(':').slice(1).join(':'));
    press('MENU'); await sleep(800);
    check('MENU opens Steam context menu', where(), /^menu:Open/);
    press('B'); await sleep(600);
    check('B closes the menu', doc().querySelectorAll('.BasicUIContextMenu').length, 0);
    S.menu = null;
    await refocus();
    n = S.events.length;
    press('B'); await sleep(1000);
    check('B leaves the page', route() !== SELF && since(n).includes('back'), true);
  }
  async function selftest(opts) {
    opts = opts || {};
    const runs = opts.runs || 1;
    const out = { routeBefore: route(), runs: [], ok: true };
    let h = null;
    try {
      h = react.routes.add(SELF, makeSelftestPage(), { exact: true, owner: 'react-lab' });
      S.handles.push(h);
      for (let i = 0; i < runs; i++) {
        const rep = { steps: [], pass: 0, fail: 0, ok: true };
        try { await selftestOnce(rep); } catch (e) { rep.ok = false; rep.fail++; rep.steps.push('ERROR ' + ((e && e.message) || e) + ' [' + navState() + ']'); }
        if (route() === SELF) { react.nav.back(); await sleep(900); }
        out.runs.push({ ok: rep.ok, pass: rep.pass, fail: rep.fail, steps: rep.steps });
        if (!rep.ok) out.ok = false;
      }
    } finally {
      if (S.menu) { try { S.menu.Hide(); } catch (_) { /* closed */ } S.menu = null; }
      if (route() === SELF) { react.nav.go('/library/home', true); await sleep(600); }
      if (h) { h.remove(); S.handles = S.handles.filter((x) => x !== h); }
      await sleep(200);
    }
    out.routeAfter = route();
    out.pageLeft = doc().querySelectorAll('.lgsx-root').length;
    out.routes = react.routes.list();
    out.patchedLeft = react.test.countPatchedLeft();
    out.summary = out.runs.map((r) => r.pass + '/' + (r.pass + r.fail)).join(', ');
    return out;
  }

  // ------------------------------------------------------------ spies (RX-7): Steam's launch calls replaced for the step
  function spy(obj, key, label, calls) {
    if (!obj) return false;
    const own = Object.prototype.hasOwnProperty.call(obj, key);
    const orig = obj[key];
    const fake = function lgsSpy() { calls.push({ fn: label, args: [].slice.call(arguments).map((a) => { try { return JSON.parse(JSON.stringify(a)); } catch (_) { return String(a); } }) }); return Promise.resolve(); };
    try { obj[key] = fake; } catch (_) { return false; }
    if (obj[key] !== fake) return false;
    S.spies.push(() => { if (own) obj[key] = orig; else delete obj[key]; });
    return true;
  }
  function unspy() { while (S.spies.length) { try { S.spies.pop()(); } catch (_) { /* gone */ } } }

  // Export key of a module whose getter returns v, and the local name the module's `t.d(exports, {...})`
  // map gives that key: used to prove which Steam functions the tile menu calls.
  function webpackRequire() {
    let r = null; const sym = Symbol('lgs-react-lab'); const ch = window.webpackChunksteamui;
    ch.push([[sym], {}, (x) => { r = x; }]);
    for (let i = ch.length - 1; i >= 0; i--) if (ch[i] && ch[i][0] && ch[i][0][0] === sym) { ch.splice(i, 1); break; }
    return r;
  }
  // Source text of a module factory (no require, no side effects).
  function srcOf(modId) { try { return Function.prototype.toString.call(webpackRequire().m[modId]); } catch (_) { return ''; } }
  // Webpack id that module `modId` imports under the local alias `alias` (`alias=t(12345)`).
  function importOf(modId, alias) {
    const m = new RegExp('[,;\\s]' + alias.replace(/\$/g, '\\$') + '=\\w\\((\\d+)\\)').exec(srcOf(modId));
    return m ? m[1] : null;
  }
  function localNameOf(modId, v) {
    let ex = null, key = null;
    try {
      const r = webpackRequire();
      ex = r(modId);   // already loaded: AppActions was resolved (and required) by react.ready()
      for (const k of Object.keys(ex)) { try { if (ex[k] === v) { key = k; break; } } catch (_) { /* getter */ } }
      if (!key) return { key: null, local: null, src: '' };
      const src = Function.prototype.toString.call(r.m[modId]);
      const m = new RegExp('[{,]' + key.replace(/\$/g, '\\$') + ':\\(\\)=>([A-Za-z_$][\\w$]*)').exec(src);
      return { key, local: m ? m[1] : null, src };
    } catch (e) { return { key, local: null, src: '', error: String(e) }; }
  }

  // RX-7, gamepad path (review R1 M1): the A button on Steam's DialogButton and on a ui.menu item reaches
  // the action as Steam's own click (HTMLElement.click(): an untrusted PointerEvent 'click', pointerType
  // ''), which must NOT count as a synthetic lab click, while a lab MouseEvent click on the same button
  // still does. Test mode stays on through the whole phase (actions.test(true) and the action logger), and
  // spies make sure nothing reaches Steam's launch calls; the actions only log.
  async function rx7Gamepad(out, pass, A) {
    const P = '/library/lgs/lab/rx7';
    const seen = {};
    let phase = 'buttonA';
    const evInfo = (e) => {
      const ne = e && (e.nativeEvent || e);
      return ne && typeof ne === 'object' ? { type: ne.type, ctor: ne.constructor && ne.constructor.name, trusted: ne.isTrusted, pointerType: ne.pointerType, pointerId: ne.pointerId } : null;
    };
    const record = (key, e) => { seen[key] = { ev: evInfo(e), reasons: A.mode(e).reasons, res: A.launchNonSteam('/usr/bin/true', e) }; };
    const synthetic = (x) => !!x && x.reasons.includes('synthetic pointer event');
    const c = react.c;
    const Page = () => react.jsx(react.ui.Page, { name: 'rx7', className: 'lgsx-root', children: [
      react.ui.style(CSS),
      react.jsx('div', { className: 'lgsx-title', children: 'RX-7 gamepad path' }, 'h'),
      react.jsx(c.DialogButton, { className: 'lgsx-rx7', autoFocus: true, onClick: (e) => record(phase, e), children: 'Action (logged only)' }, 'b'),
    ] });
    const routeBefore = route();
    let h = null;
    const calls = [];
    try {
      h = react.routes.add(P, Page, { exact: true, owner: 'react-lab' });
      S.handles.push(h);
      react.nav.go(P); await sleep(1500);
      react.nav.focusRoot(); await sleep(500);
      const btn = () => doc().querySelector('.lgsx-rx7');
      for (let i = 0; i < 4 && !(btn() && btn().classList.contains('gpfocus')); i++) { FNC().DispatchVirtualButtonClick(BTN.DOWN); await sleep(300); }
      pass(!!btn() && btn().classList.contains('gpfocus'), 'gamepad focus on the lab DialogButton (' + where() + ')');
      const M = react.M, inst = react.nav.inst();
      spy(window.SteamClient.Apps, 'LaunchNonSteamApp', 'LaunchNonSteamApp', calls);
      spy(window.SteamClient.Apps, 'RunGame', 'RunGame', calls);
      spy(M.VRMessages && M.VRMessages.SteamVR, 'DashboardDesktopWindowClicked', 'DashboardDesktopWindowClicked', calls);
      spy(inst, 'Navigate', 'Navigate', calls);
      phase = 'buttonA';
      press('A'); await sleep(500);
      const b = seen.buttonA;
      pass(!!b && !synthetic(b) && b.res.mode === 'logged',
        'A on a DialogButton reaches the action as the gamepad path, not a lab click: ' + JSON.stringify(b && b.ev) + ', reasons [' + (b ? b.reasons.join('; ') : 'onClick not called') + '], ' + (b && b.res.mode));
      // A ui.menu item (Steam's MenuItem): onSelected on A.
      S.menu = react.ui.menu([{ label: 'Menu action (logged only)', onSelected: (e) => record('menuA', e) }], btn(), { label: 'RX-7' });
      await sleep(900);
      const wm = where();
      pass(/^menu:Menu action/.test(wm), 'gamepad focus in the ui.menu sheet: ' + wm);
      if (/^menu:/.test(wm)) { press('A'); await sleep(700); }
      const m = seen.menuA;
      pass(!!m && !synthetic(m) && m.res.mode === 'logged',
        'A on a ui.menu item reaches the action as the gamepad path: ' + JSON.stringify(m && m.ev) + ', reasons [' + (m ? m.reasons.join('; ') : 'onSelected not called') + '], ' + (m && m.res.mode));
      if (doc().querySelector('.BasicUIContextMenu') && S.menu) { try { S.menu.Hide(); } catch (_) { /* closed */ } await sleep(400); }
      S.menu = null;
      // A lab click (MouseEvent) on the same button is still a synthetic pointer event.
      phase = 'labClick';
      if (btn()) labClick(btn());
      await sleep(300);
      const k = seen.labClick;
      pass(!!k && synthetic(k) && k.res.mode === 'logged', 'a lab MouseEvent click is still a synthetic pointer event: ' + JSON.stringify(k && k.ev) + ', reasons [' + (k ? k.reasons.join('; ') : 'onClick not called') + ']');
      pass(calls.length === 0, 'gamepad phase: no Steam launch or navigation call reached a spy: ' + JSON.stringify(calls));
      out.gamepad = seen;
    } finally {
      unspy();
      if (S.menu) { try { S.menu.Hide(); } catch (_) { /* closed */ } S.menu = null; }
      if (route() === P) { react.nav.back(); await sleep(900); }
      if (route() === P) { react.nav.go(routeBefore, true); await sleep(600); }
      if (h) { h.remove(); S.handles = S.handles.filter((x) => x !== h); }
    }
  }

  // A main-window snapshot once gamepad focus has settled (L.snap), with where focus is. Steam's footer
  // legend follows whatever holds focus, which settles at its own pace after a navigation: two shots are
  // compared with the legend only when focus is on the same element in both.
  async function settledSnap(L) {
    react.nav.focusRoot();
    await sleep(700);
    return { snap: L.snap('main'), focus: L.focused('main') || {} };
  }
  function compareSettled(L, A, B) {
    const sameFocus = JSON.stringify(A.focus) === JSON.stringify(B.focus);
    const legend = (el) => /ActionButtonLabel|FooterLegend|%\{Footer/.test(el || '');
    const strip = (x) => { if (sameFocus) return x; const o = {}; for (const k of Object.keys(x)) if (!legend(x[k].el)) o[k] = x[k]; return o; };
    const a = strip(A.snap), b = strip(B.snap);
    const d = L.diff(a, b);
    const keysA = Object.keys(a).length, keysB = Object.keys(b).length;
    return { ok: !d.issues.length && !d.movedCount && keysA === keysB, sameFocus, focusA: A.focus, focusB: B.focus,
      issues: d.issues.slice(0, 6), movedCount: d.movedCount, keysA, keysB,
      txt: d.issues.length + ' issues, ' + d.movedCount + ' moved, ' + keysA + '/' + keysB + ' nodes' + (sameFocus ? '' : ' (focus differed: footer legend left out)') };
  }

  // ------------------------------------------------------------ the RX runners
  const runners = {
    async 'RX-1'() { return selftest({ runs: 2 }); },

    async 'RX-2'(L) {
      if (!L) return { ok: false, blocked: 'needs the lab helpers L (run through glass.py js)' };
      const out = { ok: true, steps: [] };
      // Open bar popups (the lab helpers' openThings() reads the same set).
      const bars = () => {
        const i = react.nav.inst();
        let all = [];
        try { all = [...(i.m_setVRDashboardBarPopups || i.VRDashboardBarPopups || [])]; } catch (_) { all = []; }
        return all.filter((h) => { try { return h.BPopupOpen(); } catch (_) { return true; } });
      };
      const closeBars = async () => { for (const p of bars()) { try { p.closePopup(); } catch (_) { /* gone */ } } await sleep(400); };
      const openPlus = async () => {
        await closeBars();
        const sel = '%{AddWindowButton}';
        const el = L.q('bar', sel);
        L.click('bar', sel);
        el.dispatchEvent(new (L.surface('bar').MouseEvent)('mouseenter'));
        await sleep(1000);
      };
      let h = null, calls = 0;
      const summary = (d, a, b) => ({ controls: d.controls, texts: d.texts, issues: d.issues, movedCount: d.movedCount, keysA: Object.keys(a).length, keysB: Object.keys(b).length });
      const same = (x) => x.issues.length === 0 && x.movedCount === 0 && x.keysA === x.keysB;
      try {
        await openPlus();
        const a = L.snap('barpopup');
        const aBar = L.snap('bar');
        await closeBars();
        h = react.patch.byProps('p2.rx2', react.patch.targets.plusButton, (orig) => function rx2NoOp(props, second) { calls++; return orig.call(this, props, second); });
        out.patch = { count: h.count, kinds: h.kinds, live: h.live };
        const callsBefore = calls;
        out.rerender = react.patch.rerender(h);
        await sleep(300);
        out.wrapperCallsAfterRerender = calls - callsBefore;
        await openPlus();
        const b = L.snap('barpopup');
        const bBar = L.snap('bar');
        await closeBars();
        out.diff = summary(L.diff(a, b), a, b);
        out.diffBar = summary(L.diff(aBar, bBar), aBar, bBar);
        out.wrapperCalls = calls;
        out.steps.push((h.count === 1 ? 'PASS' : 'FAIL') + ' one component matched: ' + h.count + ' ' + h.kinds.join() + ' (live fibers ' + h.live + ')');
        out.steps.push((out.rerender.forced >= 1 && out.wrapperCallsAfterRerender > 0 ? 'PASS' : 'FAIL') + ' rerender() shows the patch at once: ' + JSON.stringify(out.rerender) + ', ' + out.wrapperCallsAfterRerender + ' wrapper calls');
        out.steps.push((calls > 0 ? 'PASS' : 'FAIL') + ' patched render ran: ' + calls + ' calls');
        out.steps.push((same(out.diff) ? 'PASS' : 'FAIL') + ' barpopup (OPEN) unchanged against unpatched: ' + out.diff.issues.length + ' issues, ' + out.diff.movedCount + ' moved, ' + out.diff.keysA + '/' + out.diff.keysB + ' nodes');
        out.steps.push((same(out.diffBar) ? 'PASS' : 'FAIL') + ' bar unchanged against unpatched: ' + out.diffBar.issues.length + ' issues, ' + out.diffBar.movedCount + ' moved, ' + out.diffBar.keysA + '/' + out.diffBar.keysB + ' nodes');
      } catch (e) {
        out.steps.push('ERROR ' + ((e && e.message) || e));
      } finally {
        if (h) h.remove();
        await closeBars();
        // Undo the fake hover of the OPEN recipe (IM §9: pointer to 1400, 900).
        try { L.q('bar', '%{AddWindowButton}').dispatchEvent(new (L.surface('bar').MouseEvent)('mouseleave')); } catch (_) { /* gone */ }
        try { if (typeof L.unhover === 'function') await L.unhover(); } catch (_) { /* older lab */ }
      }
      out.patchedLeft = react.test.countPatchedLeft();
      out.steps.push((out.patchedLeft === 0 ? 'PASS' : 'FAIL') + ' patchedLeft after removal: ' + out.patchedLeft);
      out.ok = out.steps.every((s) => s.startsWith('PASS'));
      return out;
    },

    async 'RX-3'(L) {
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      const d = doc();
      let libSel = null; try { libSel = L ? L.sel('%{GamepadLibrary}') : null; } catch (_) { libSel = null; }
      const routeRoot = () => (libSel ? d.querySelector(libSel) : null);
      const routeNodes = () => { const r = routeRoot(); return r ? r.querySelectorAll('*').length : -1; };
      // A poster is named by the app its component renders (fiber props), not by its (empty) text.
      const appOf = (el) => {
        const f = react.fiber.closest(el, (p) => typeof p.appid === 'number' || (p.app && typeof p.app.appid === 'number') || (p.overview && typeof p.overview.appid === 'number'));
        if (!f) return null;
        const p = f.memoizedProps;
        return typeof p.appid === 'number' ? p.appid : (p.app ? p.app.appid : p.overview.appid);
      };
      const focusKey = () => {
        const f = d.querySelector('.gpfocus');
        if (!f) return null;
        const app = appOf(f);
        return { el: f, app, text: app != null ? 'app ' + app : (f.innerText || f.getAttribute('aria-label') || '').trim().slice(0, 40) };
      };
      const describeEl = (el) => (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 3).join('.') : ''));
      let modal = null, cancelled = 0;
      const routeBefore = react.nav.route();
      try {
        react.nav.go('/library/tab/AllGames');
        await sleep(1600);
        react.nav.focusRoot();
        await sleep(500);
        let before = focusKey();
        // Start on a poster (focus may land on the library's tab row first): D-pad down into the grid.
        for (let i = 0; i < 3 && !(before && before.app != null); i++) { FNC().DispatchVirtualButtonClick(BTN.DOWN); await sleep(400); before = focusKey(); }
        out.focusBefore = before && before.text;
        const n0 = routeNodes();
        out.nodesBefore = n0;
        const root0 = routeRoot();
        const els0 = root0 ? [...root0.querySelectorAll('*')] : [];
        const c = react.c, jsx = react.jsx, jsxs = react.jsxs;
        function LabModal(p) {
          const close = () => { cancelled++; if (p.closeModal) p.closeModal(); };
          return jsxs(c.Focusable, { className: 'lgsx-modal', onCancel: close, onCancelActionDescription: react.ui.text('#Button_Back', 'Back'),
            style: { display: 'flex', gap: '24px', padding: '40px', background: 'rgba(30,32,40,.9)', borderRadius: '32px', color: '#fff' },
            children: [
              jsx(c.DialogButton, { className: 'lgsx-m1', autoFocus: true, onClick: () => {}, children: 'One' }, '1'),
              jsx(c.DialogButton, { className: 'lgsx-m2', onClick: () => {}, children: 'Two' }, '2'),
            ] });
        }
        modal = await react.ui.modal(jsx(LabModal, {}));
        await sleep(700);
        const shown = !!d.querySelector('.lgsx-modal');
        pass(shown, 'modal rendered in main');
        pass(react.nav.route() === '/library/tab/AllGames', 'route unchanged: ' + react.nav.route());
        const n1 = routeNodes();
        const root1 = routeRoot();
        const gone = els0.filter((e) => !e.isConnected || !root1 || !root1.contains(e));
        const added = root1 ? [...root1.querySelectorAll('*')].filter((e) => !els0.includes(e)) : [];
        out.nodesDuring = n1;
        out.changedDuring = { gone: gone.map(describeEl).slice(0, 8), added: added.map(describeEl).slice(0, 8) };
        pass(!!root0 && root1 === root0, 'the route stays mounted under the modal (same root node)');
        // Steam renders the grid's gamepad fast-scroll overlay only while gamepad focus is inside the grid,
        // and a poster may drop its focus decoration: both leave when focus moves to the modal and come back
        // after. Anything else is a real change. The posters themselves must be the very same nodes.
        let fso = null; try { fso = L ? L.sel('%{FastScrollOverlay}') : null; } catch (_) { fso = null; }
        const focusDependent = (e) => (fso && (e.matches(fso) || !!(e.parentElement && e.parentElement.closest(fso))))
          || !!(before && before.el && (before.el === e || before.el.contains(e)));
        const onlyFocusDependent = gone.concat(added).every((e) => focusDependent(e));
        pass(n0 > 0 && (n1 === n0 || onlyFocusDependent), 'route DOM node count unchanged: ' + n0 + ' -> ' + n1 + (n1 !== n0 ? ' (the difference is only Steam\'s focus-dependent nodes: ' + onlyFocusDependent + ')' : ''));
        react.nav.focusRoot();
        await sleep(500);
        const f1 = d.querySelector('.gpfocus');
        pass(!!(f1 && f1.closest('.lgsx-modal')), '.gpfocus inside the modal after FocusApplicationRoot(): ' + (f1 ? (f1.innerText || '').trim().slice(0, 20) : 'none') + ' [' + navState() + ']');
        if (f1 && f1.closest('.lgsx-modal')) {
          FNC().DispatchVirtualButtonClick(BTN.B);
          await sleep(800);
        }
        pass(cancelled === 1 && !d.querySelector('.lgsx-modal'), 'B closes it (onCancel ' + cancelled + ', modal ' + (d.querySelector('.lgsx-modal') ? 'still open' : 'gone') + ')');
        let after = focusKey();
        out.restoredByItself = !!after;
        if (!after) { react.nav.focusRoot(); await sleep(500); after = focusKey(); out.steps.push('NOTE focus parked after close; FocusApplicationRoot() (' + navState() + ')'); }
        out.focusAfter = after && after.text;
        pass(!!(before && after && before.app != null && (after.el === before.el || (after.text && after.text === before.text))), 'focus back on the same poster: "' + (before && before.text) + '" -> "' + (after && after.text) + '"');
        pass(out.restoredByItself, 'focus came back by itself within 800 ms (ui.modal gives it back, D-P2-7), no FocusApplicationRoot() needed');
        pass(routeNodes() === n0, 'route DOM node count after close: ' + routeNodes());
      } catch (e) {
        out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e));
      } finally {
        if (d.querySelector('.lgsx-modal') && modal) { try { modal.Close(); } catch (_) { /* closed */ } }
        // Leave the device on the route we found it on.
        if (routeBefore !== '/library/tab/AllGames' && react.nav.route() === '/library/tab/AllGames') {
          react.nav.back();
          await sleep(900);
          if (react.nav.route() !== routeBefore) { react.nav.go(routeBefore, true); await sleep(600); }
        }
        out.routeBefore = routeBefore;
        out.routeAfter = react.nav.route();
      }
      return out;
    },

    async 'RX-4'() {
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      try {
        const o = await open('ConfirmModal');
        const d = doc();
        const lab = d.querySelector('.lgsx-lab');
        const txt = lab ? lab.innerText : '';
        pass(o.mounted && /Lab fixture/.test(txt), 'ConfirmModal rendered on ' + o.route + ' (' + o.nodes + ' nodes)');
        const c = await close();
        pass(c.routeLeft && c.nodesLeft === 0, 'unmounted: route ' + c.route + ', lab nodes ' + c.nodesLeft);
        pass(!c.routes.added.includes(LAB), 'no route left behind: ' + JSON.stringify(c.routes));
      } catch (e) { out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e)); try { await close(); } catch (_) { /* best effort */ } }
      return out;
    },

    async 'RX-5'() {
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      const st = react.status();
      if (st.routes.length || st.overrides.length || st.patches.length) return { ok: false, blocked: 'react has live routes or patches from other modules; run with only reactLab on', status: st };
      try {
        react.reset();
        react.test.breakFinder('Focusable');
        let threw = null;
        try { react.routes.add('/library/lgs/lab/rx5', () => null); } catch (e) { threw = e.message; }
        pass(!!threw && /cannot find Focusable/.test(threw), 'install throws: ' + threw);
        let threw2 = null;
        try { react.ready(); } catch (e) { threw2 = e.message; }
        pass(!!threw2, 'ready() stays failed (sticky): ' + threw2);
        const s2 = react.status();
        pass(!s2.ready && s2.routes.length === 0 && react.test.countPatchedLeft() === 0, 'nothing patched: ready ' + s2.ready + ', routes ' + s2.routes.length + ', patchedLeft ' + react.test.countPatchedLeft());
      } finally {
        react.test.breakFinder(null);
        react.reset();
      }
      const t0 = performance.now(); react.ready(); const ms = Math.round(performance.now() - t0);
      pass(react.isReady, 'after reset the module is ready again (' + ms + ' ms)');
      return out;
    },

    async 'RX-6'() {
      const out = { ok: true, steps: [], times: [] };
      const st = react.status();
      if (st.routes.length || st.overrides.length || st.patches.length) return { ok: false, blocked: 'react has live routes or patches from other modules', status: st };
      for (let i = 0; i < 3; i++) {
        react.reset();
        const t0 = performance.now(); react.ready(); out.times.push(Math.round(performance.now() - t0));
      }
      const t1 = performance.now(); react.ready(); const again = Math.round((performance.now() - t1) * 100) / 100;
      out.max = Math.max(...out.times);
      out.cached = again;
      out.steps.push((out.max <= 250 ? 'PASS' : 'FAIL') + ' ready() (the one scan) ' + out.times.join(', ') + ' ms, max ' + out.max + ' <= 250');
      out.steps.push((again < 1 ? 'PASS' : 'FAIL') + ' a second ready() is cached: ' + again + ' ms');
      try {
        const g = window.__LGS_RT;
        const m = g && g.status ? (g.status().modules || []).find((x) => x.name === 'react') : null;
        if (m) out.steps.push('NOTE runtime installMs for react (install only, no scan): ' + m.installMs);
      } catch (_) { /* no runtime */ }
      out.ok = out.steps.every((s) => !s.startsWith('FAIL'));
      return out;
    },

    async 'RX-7'() {
      const out = { ok: true, steps: [], results: {} };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      const A = react.actions;
      const t = rt.test && rt.test.actions;
      let loggerWasOn = false;
      try { loggerWasOn = !!(t && t.enabled && t.enabled()); } catch (_) { loggerWasOn = false; }
      try { if (t && t.enable && !loggerWasOn) t.enable(true, { ttlMs: 60000 }); } catch (_) { /* shim */ }
      A.test(true);
      const mode = A.mode();
      if (mode.mode !== 'test') { A.test(false); return { ok: false, steps: ['FAIL test mode is not on; aborting before any action: ' + JSON.stringify(mode)] }; }
      pass(true, 'test mode on: ' + mode.reasons.join('; '));
      // Identity checks first (before the spies replace anything).
      const inst = react.nav.inst();
      const M = react.M;
      const hL = A.handler('launchNonSteam');
      pass(typeof hL === 'function' && hL === window.SteamClient.Apps.LaunchNonSteamApp, 'launchNonSteam handler is SteamClient.Apps.LaunchNonSteamApp');
      // The "+" popup module (source scan only): its program row calls SteamClient.Apps?.LaunchNonSteamApp
      // and its window row calls <alias>.p.SteamVR.DashboardDesktopWindowClicked, alias = VRMessages' module.
      const st = react.status();
      let plusId = null;
      try {
        const req = webpackRequire();
        for (const id of Object.keys(req.m)) { const s = Function.prototype.toString.call(req.m[id]); if (s.includes('.p.SteamVR.DashboardDesktopWindowClicked(') && s.includes('LaunchNonSteamApp(')) { plusId = id; break; } }
      } catch (_) { plusId = null; }
      const plusSrc = plusId ? srcOf(plusId) : '';
      out.plusModule = plusId;
      pass(/SteamClient\.Apps\??\.LaunchNonSteamApp\(\w+\.strCmdline\)/.test(plusSrc), 'Steam\'s "+" program row calls SteamClient.Apps.LaunchNonSteamApp(strCmdline) (module ' + plusId + ')');
      const am = /([A-Za-z_$][\w$]*)\.p\.SteamVR\.DashboardDesktopWindowClicked\(/.exec(plusSrc);
      const vrImport = am ? importOf(plusId, am[1]) : null;
      pass(!!vrImport && vrImport === st.finders.VRMessages.module, 'Steam\'s "+" window row calls module ' + vrImport + '\'s p.SteamVR.DashboardDesktopWindowClicked; ours is module ' + st.finders.VRMessages.module);
      const hP = A.handler('primary');
      const pa = localNameOf(st.finders.AppActions.module, hP.primaryAction);
      const ra = localNameOf(st.finders.AppActions.module, hP.runAction);
      const gpi = pa.src.indexOf('GetPrimaryActionMenuItem(');
      const body = gpi >= 0 ? pa.src.slice(gpi, gpi + 600) : '';
      pass(!!(pa.local && ra.local && body.includes(pa.local + '(this.props.instance') && body.includes(ra.local + '(')),
        `primary uses the tile menu's own functions: export ${pa.key}=${pa.local} (primary action), ${ra.key}=${ra.local} (run), called by GetPrimaryActionMenuItem`);
      const hD = A.handler('desktopWindow');
      pass(typeof hD === 'function' && hD === M.VRMessages.SteamVR.DashboardDesktopWindowClicked, 'desktopWindow handler is the popup row\'s p.SteamVR.DashboardDesktopWindowClicked (module ' + st.finders.VRMessages.module + ')');
      pass(A.handler('navigate') === inst.Navigate, 'navigate handler is the main window instance\'s Navigate');
      // Spies: even a bug could not launch anything during this step.
      const calls = [];
      const spied = [
        spy(window.SteamClient.Apps, 'LaunchNonSteamApp', 'LaunchNonSteamApp', calls),
        spy(window.SteamClient.Apps, 'RunGame', 'RunGame', calls),
        spy(window.SteamClient.Apps, 'StreamGame', 'StreamGame', calls),
        spy(window.SteamClient.Installs, 'OpenInstallWizard', 'OpenInstallWizard', calls),
        spy(M.VRMessages.SteamVR, 'DashboardDesktopWindowClicked', 'DashboardDesktopWindowClicked', calls),
        spy(inst, 'Navigate', 'Navigate', calls),
      ];
      out.spies = spied;
      const routeBefore = react.nav.route();
      const logBefore = t && t.log ? t.log().length : null;
      try {
        // a real program from Steam's own list (never Liquid Glass), a real game, a fake window id
        let prog = null;
        try {
          const raw = await window.SteamClient.Apps.ScanForInstalledNonSteamApps(true);
          prog = react.data.filterPrograms(raw || [], true).find((p) => !p.isLiquidGlass) || null;
        } catch (_) { prog = null; }
        const game = react.data.installedGames({ limit: 1 })[0];
        const r1 = A.launchNonSteam(prog ? prog.cmdline : '/usr/bin/true');
        const r2 = game ? A.primary(game.appid) : null;
        const r3 = A.desktopWindow(424242);
        const r4 = game ? A.navigate('/library/app/' + game.appid) : A.navigate('/library/app/620');
        const fakeClick = { type: 'click', isTrusted: false };
        const r5 = A.navigate('/library/home', {}, fakeClick);
        const r6 = A.primary(999999999);
        out.results = { launchNonSteam: r1, primary: r2, desktopWindow: r3, navigate: r4, untrusted: r5, refused: r6, program: prog && prog.name, game: game && game.name };
        pass(r1.mode === 'logged', 'launchNonSteam logged, not run: ' + r1.mode + ' (' + (prog ? prog.name : 'no program') + ')');
        pass(!!r2 && r2.mode === 'logged' && !!(r2.detail && r2.detail.action), 'primary logged, not run: ' + (r2 && r2.mode) + ', Steam\'s action ' + (r2 && r2.detail && r2.detail.action) + ' (' + (game && game.name) + ')');
        pass(r3.mode === 'logged', 'desktopWindow logged, not run: ' + r3.mode);
        pass(r4.mode === 'logged', 'navigate logged, not run: ' + r4.mode);
        pass(r5.mode === 'logged' && /synthetic pointer event/.test(r5.reason), 'an untrusted click is test mode by itself: ' + r5.reason);
        pass(r6.mode === 'refused', 'no handler -> refused, nothing guessed: ' + r6.reason);
        pass(calls.length === 0, 'no Steam launch call reached a spy: ' + JSON.stringify(calls));
        pass(react.nav.route() === routeBefore, 'route unchanged: ' + react.nav.route());
        if (logBefore !== null) {
          const added = t.log().slice(logBefore).map((e) => e.fn);
          pass(['launchNonSteam', 'primary', 'desktopWindow', 'navigate'].every((f) => added.includes(f)), 'runtime action log has every call: ' + added.join(', '));
        }
        out.reactLog = A.log.slice(-6).map((e) => e.fn + ' ' + e.mode);
        // The gamepad path needs navigation into a lab page: the Navigate spy goes first, and the phase
        // installs its own spies once it is there.
        unspy();
        await rx7Gamepad(out, pass, A);
      } catch (e) {
        out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e));
      } finally {
        unspy();
        if (S.menu) { try { S.menu.Hide(); } catch (_) { /* closed */ } S.menu = null; }
        A.test(false);
        // Give the step's action logger back as it was (P10 turns it on for every locked step).
        try { if (t && t.enable && !loggerWasOn) t.enable(false); } catch (_) { /* shim */ }
      }
      return out;
    },

    // ---------------------------------------------------------- beyond the card's RX list: the other builds
    // RX-OV: routes.override on /library/home (element children) and on the achievements route (function
    // children), Steam's page kept inside ours, an override that throws degrades to Steam's page, removal.
    async 'RX-OV'(L) {
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      const d = doc();
      const routeBefore = route();
      const home = react.Routes.Library.Home();
      const count = () => d.querySelectorAll('*').length;
      // Steam's route transition keeps the old and new page in the DOM for a moment (Home 802 + AllGames 843
      // = 1645 nodes at 13:01): measure only once the count has held for 600 ms (at most 6 s).
      const stableCount = async () => {
        let last = -1, same = 0;
        for (let i = 0; i < 30; i++) { const n = count(); if (n === last) { if (++same >= 3) return n; } else { same = 0; last = n; } await sleep(200); }
        return last;
      };
      const handles = [];
      try {
        react.nav.go(home, true); await sleep(1500);
        const n0 = await stableCount();
        let calls = 0;
        handles.push(react.routes.override(home, (steam, ctx) => { calls++; return react.jsx('div', { className: 'lgsx-ov', 'data-path': ctx.match && ctx.match.path, children: steam }); }));
        await sleep(1200);
        const ov = d.querySelector('.lgsx-ov');
        pass(!!ov && calls > 0, 'override renders at ' + home + ' (' + calls + ' calls, match ' + (ov && ov.getAttribute('data-path')) + ')');
        pass(!!ov && ov.querySelectorAll('*').length > 100, 'Steam Home is kept inside it: ' + (ov ? ov.querySelectorAll('*').length : 0) + ' nodes');
        handles.pop().remove(); await sleep(1200);
        const n1 = await stableCount();
        pass(!d.querySelector('.lgsx-ov') && Math.abs(n1 - n0) <= Math.max(10, n0 * 0.05), 'removed: Steam Home back, ' + n0 + ' -> ' + n1 + ' nodes');
        // a throwing override degrades to Steam's own page
        function Boom() { throw new Error('lab: forced render error'); }
        handles.push(react.routes.override(home, () => react.jsx(Boom, {})));
        await sleep(1200);
        const n2 = await stableCount();
        pass(Math.abs(n2 - n0) <= Math.max(10, n0 * 0.05), 'a throwing override shows Steam Home instead: ' + n2 + ' nodes');
        handles.pop().remove(); await sleep(900);
        // function children (Steam's achievements route): Steam's own children still get the route props
        const game = react.data.installedGames({ limit: 1 })[0];
        if (game) {
          const achPath = '/library/app/:appid/achievements';
          let seen = null;
          handles.push(react.routes.override(achPath, (steam, ctx) => { seen = ctx.match && ctx.match.params; return react.jsx('div', { className: 'lgsx-ov2', children: steam }); }));
          react.nav.go('/library/app/' + game.appid + '/achievements'); await sleep(1800);
          const ov2 = d.querySelector('.lgsx-ov2');
          pass(!!ov2 && !!seen && String(seen.appid) === String(game.appid), 'function-children route: our wrapper with the real match (appid ' + (seen && seen.appid) + '), Steam content ' + (ov2 ? ov2.querySelectorAll('*').length : 0) + ' nodes');
          handles.pop().remove(); await sleep(900);
          pass(!d.querySelector('.lgsx-ov2'), 'achievements override removed');
          react.nav.back(); await sleep(900);
        }
        let threw = null; try { react.routes.override('/library/no-such-route', () => null); } catch (e) { threw = e.message; }
        pass(!!threw, 'override of a path Steam does not declare throws: ' + threw);
      } catch (e) {
        out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e));
      } finally {
        while (handles.length) { try { handles.pop().remove(); } catch (_) { /* gone */ } }
        if (route() !== routeBefore) { react.nav.go(routeBefore, true); await sleep(900); }
      }
      out.routeBefore = routeBefore; out.routeAfter = route();
      out.status = react.routes.list();
      out.patchedLeft = react.test.countPatchedLeft();
      pass(out.patchedLeft === 0 && !out.status.overridden.length, 'patchedLeft ' + out.patchedLeft + ', overrides left ' + out.status.overridden.length);
      return out;
    },

    // RX-HEAL: React remounts the route switch (simulated: the original type is put back on the live
    // fiber); the history listener re-patches before the router renders into our path.
    async 'RX-HEAL'() {
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      const routeBefore = route();
      const P = '/library/lgs/lab/heal';
      let h = null;
      try {
        h = react.routes.add(P, () => react.jsx(react.ui.Page, { className: 'lgsx-heal', children: react.jsx('div', { className: 'lgsx-title', children: 'heal' }) }), { exact: true, owner: 'react-lab' });
        const dropped = react.test.dropSwitchPatch();
        pass(dropped > 0 && react.status().patchedLive === 0, 'switch patch dropped (as on a remount): ' + dropped + ' fiber types restored, patchedLive ' + react.status().patchedLive);
        react.nav.go(P); await sleep(1500);
        pass(!!doc().querySelector('.lgsx-heal') && react.status().patchedLive === 1, 'navigation re-patched it and our page rendered (patchedLive ' + react.status().patchedLive + ')');
      } catch (e) {
        out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e));
      } finally {
        if (route() === P) { react.nav.back(); await sleep(900); }
        if (h) h.remove();
        if (route() !== routeBefore) { react.nav.go(routeBefore, true); await sleep(900); }
      }
      out.patchedLeft = react.test.countPatchedLeft();
      pass(out.patchedLeft === 0, 'patchedLeft after removal: ' + out.patchedLeft);
      out.routeAfter = route();
      return out;
    },

    // RX-FN: patch.byProps on a bare function component (Steam's PagedSettings, SET P-S1): the patch
    // survives the settings page being unmounted and mounted again (element substitution), the page is
    // unchanged by a no-op wrap, and removal restores everything.
    async 'RX-FN'(L) {
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      const routeBefore = route();
      const sys = react.Routes.Settings.System();
      let h = null, calls = 0;
      try {
        // The unpatched reference comes through the same entry path as the patched shot below (Home, then
        // Settings), so focus and the footer legend start the same way.
        react.nav.go(sys); await sleep(1200);
        react.nav.go('/library/home'); await sleep(1300);
        react.nav.go(sys); await sleep(1500);
        // Steam's footer legend follows whatever holds gamepad focus, which settles at its own pace after
        // a navigation; it is compared only when focus is on the same element in both shots.
        const settle = async () => { react.nav.focusRoot(); await sleep(700); return (L.focused('main') || {}); };
        const fa = L ? await settle() : null;
        const a = L ? L.snap('main') : null;
        h = react.patch.byProps('p2.rxfn', react.patch.targets.pagedSettings, (orig) => function rxfnNoOp(props, r) { calls++; return orig.call(this, props, r); });
        out.patch = { count: h.count, kinds: h.kinds, live: h.live };
        pass(h.count === 1 && h.kinds[0] === 'fn', 'one bare function component matched: ' + h.count + ' ' + h.kinds.join());
        react.nav.go('/library/home'); await sleep(1300);
        const c0 = calls;
        react.nav.go(sys); await sleep(1500);
        pass(calls > c0, 'patched render runs after the page was unmounted and mounted again: ' + (calls - c0) + ' calls');
        const fb = L ? await settle() : null;
        const b = L ? L.snap('main') : null;
        if (a && b) {
          const sameFocus = JSON.stringify(fa) === JSON.stringify(fb);
          const legend = (k) => /ActionButtonLabel|FooterLegend|%\{Footer/.test(k);
          const strip = (x) => { if (sameFocus) return x; const o = {}; for (const k of Object.keys(x)) if (!legend(x[k].el || '')) o[k] = x[k]; return o; };
          const a2 = strip(a), b2 = strip(b);
          const df = L.diff(a2, b2);
          out.diff = { issues: df.issues, movedCount: df.movedCount, keysA: Object.keys(a2).length, keysB: Object.keys(b2).length, sameFocus, focusA: fa, focusB: fb };
          if (!sameFocus) out.steps.push('NOTE gamepad focus settled on different elements (' + JSON.stringify(fa) + ' vs ' + JSON.stringify(fb) + '); the footer legend is left out of the comparison');
          pass(!df.issues.length && !df.movedCount && out.diff.keysA === out.diff.keysB, sys + ' unchanged against unpatched: ' + df.issues.length + ' issues, ' + df.movedCount + ' moved, ' + out.diff.keysA + '/' + out.diff.keysB + ' nodes');
        }
        h.remove(); h = null;
        pass(react.test.countPatchedLeft() === 0, 'removed while mounted: patchedLeft ' + react.test.countPatchedLeft());
        const c1 = calls;
        react.nav.go('/library/home'); await sleep(1200);
        react.nav.go(sys); await sleep(1500);
        pass(calls === c1 && !!doc().querySelector('.Panel'), 'after removal the wrap never runs again (' + (calls - c1) + ' calls) and Settings renders');
      } catch (e) {
        out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e));
      } finally {
        if (h) { try { h.remove(); } catch (_) { /* gone */ } }
        if (route() !== routeBefore) { react.nav.go(routeBefore, true); await sleep(900); }
      }
      out.patchedLeft = react.test.countPatchedLeft();
      out.routeAfter = route();
      return out;
    },

    // RX-REMOVE: everything at once (a route, an override, a memo patch and a bare function patch), then
    // the module's own removal (what lgs off runs): patchedLeft 0, Steam's element factories restored, a
    // stale /library/lgs/ entry falls back to Steam's library. The module then starts fresh (unscanned).
    async 'RX-REMOVE'() {
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      const st0 = react.status();
      const others = st0.routes.filter((p) => !p.startsWith(LAB)).length + st0.overrides.length + st0.patches.length;
      if (others) return { ok: false, blocked: 'react has live routes or patches from other modules; run with only reactLab on', status: st0 };
      const routeBefore = route();
      const P = '/library/lgs/lab/remove';
      try {
        react.ready();
        const M = react.M;
        const jsx0 = M.jsx.jsx, ce0 = M.React.createElement;
        react.routes.add(P, () => react.jsx(react.ui.Page, { className: 'lgsx-rm', children: react.jsx('div', { className: 'lgsx-title', children: 'remove' }) }), { exact: true });
        react.routes.override(react.Routes.Library.Home(), (steam) => steam);
        react.patch.byProps('p2.rm.plus', react.patch.targets.plusButton, (o) => function (p, r) { return o.call(this, p, r); });
        react.nav.go(react.Routes.Settings.System()); await sleep(1500);
        react.patch.byProps('p2.rm.paged', react.patch.targets.pagedSettings, (o) => function (p, r) { return o.call(this, p, r); });
        react.nav.go(P); await sleep(1500);
        const s1 = react.status();
        pass(!!doc().querySelector('.lgsx-rm') && s1.patches.length === 2 && s1.overrides.length === 1 && M.jsx.jsx !== jsx0, 'all live: route rendered, 2 patches, 1 override, element factories hooked');
        const rep = react.test.cycle();
        out.report = rep;
        // Steam's route transition keeps the exiting page in the DOM for a moment (over 1.2 s under load,
        // 13:44): wait for it to go, at most 4 s.
        for (let i = 0; i < 20 && doc().querySelector('.lgsx-rm'); i++) await sleep(200);
        await sleep(400);
        pass(rep.patchedLeft === 0, 'removal report: patchedLeft ' + rep.patchedLeft + ', restored ' + rep.restored + ', route ' + rep.routeBefore + ' -> ' + rep.routeAfter);
        pass(M.jsx.jsx === jsx0 && M.React.createElement === ce0, 'Steam jsx and createElement are the originals again');
        pass(rep.routeAfter !== P && !doc().querySelector('.lgsx-rm'), 'our route was left: ' + route());
        react.nav.go(P); await sleep(1500);
        const libSel = (() => { try { return window.__LGS_LAB ? window.__LGS_LAB.sel('%{GamepadLibrary}') : null; } catch (_) { return null; } })();
        pass(!doc().querySelector('.lgsx-rm') && (!libSel || !!doc().querySelector(libSel)), 'a stale ' + P + ' entry falls back to Steam library (no page of ours)');
        pass(!react.isReady && react.status().switchFibers === null, 'fresh state after removal: not scanned');
      } catch (e) {
        out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e));
        try { out.report = react.test.cycle(); } catch (_) { /* gone */ }
      } finally {
        if (route() !== routeBefore) { react.nav.go(routeBefore, true); await sleep(900); }
      }
      out.routeAfter = route();
      return out;
    },
    // RX-TARGETS: the named predicates of contract §5.2 not covered above (statusPill on the bar, appButtons
    // on a game page): each matches exactly one component; a no-op wrap leaves the surface unchanged; removal
    // leaves patchedLeft 0. (plusButton: RX-2; pagedSettings: RX-FN.)
    async 'RX-TARGETS'(L) {
      if (!L) return { ok: false, blocked: 'needs the lab helpers L (run through glass.py js)' };
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      const same = (a, b) => { const d = L.diff(a, b); return { ok: !d.issues.length && !d.movedCount && Object.keys(a).length === Object.keys(b).length, txt: d.issues.length + ' issues, ' + d.movedCount + ' moved, ' + Object.keys(a).length + '/' + Object.keys(b).length + ' nodes', issues: d.issues.slice(0, 4) }; };
      const routeBefore = route();
      let h1 = null, h2 = null;
      try {
        // statusPill (bar, always mounted)
        let c1 = 0;
        const a1 = L.snap('bar');
        h1 = react.patch.byProps('p2.rxt.pill', react.patch.targets.statusPill, (o) => function rxtPill(p, r) { c1++; return o.call(this, p, r); });
        out.pill = { count: h1.count, kinds: h1.kinds, live: h1.live, rerender: react.patch.rerender(h1) };
        await sleep(400);
        const b1 = L.snap('bar');
        const s1 = same(a1, b1);
        pass(h1.count === 1, 'statusPill matches one component: ' + h1.count + ' ' + h1.kinds.join() + ' (live ' + h1.live + ', rerender ' + JSON.stringify(out.pill.rerender) + ', ' + c1 + ' wrapper calls)');
        pass(s1.ok, 'bar unchanged with the no-op wrap: ' + s1.txt + (s1.ok ? '' : ' ' + JSON.stringify(s1.issues)));
        h1.remove(); h1 = null;
        pass(react.test.countPatchedLeft() === 0, 'statusPill removed: patchedLeft ' + react.test.countPatchedLeft());
        // appButtons (game page)
        const g = react.data.installedGames({ limit: 1 })[0];
        if (!g) { out.steps.push('NOTE no installed game; appButtons skipped'); }
        else {
          const page = '/library/app/' + g.appid;
          let c2 = 0;
          react.nav.go('/library/home'); await sleep(1200);
          react.nav.go(page); await sleep(1800);
          const a2 = await settledSnap(L);
          h2 = react.patch.byProps('p2.rxt.app', react.patch.targets.appButtons, (o) => function rxtApp(p, r) { c2++; return o.call(this, p, r); });
          out.app = { count: h2.count, kinds: h2.kinds };
          react.nav.go('/library/home'); await sleep(1200);
          react.nav.go(page); await sleep(1800);
          const b2 = await settledSnap(L);
          const s2 = compareSettled(L, a2, b2);
          pass(h2.count === 1 && c2 > 0, 'appButtons matches one component: ' + h2.count + ' ' + h2.kinds.join() + ', patched render ran ' + c2 + ' times after a remount');
          pass(s2.ok, page + ' unchanged with the no-op wrap: ' + s2.txt + (s2.ok ? '' : ' ' + JSON.stringify(s2.issues)));
          h2.remove(); h2 = null;
          pass(react.test.countPatchedLeft() === 0, 'appButtons removed: patchedLeft ' + react.test.countPatchedLeft());
        }
      } catch (e) {
        out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e));
      } finally {
        if (h1) { try { h1.remove(); } catch (_) { /* gone */ } }
        if (h2) { try { h2.remove(); } catch (_) { /* gone */ } }
        if (route() !== routeBefore) { react.nav.go(routeBefore, true); await sleep(900); }
      }
      out.routeAfter = route();
      return out;
    },

    // RX-OPT (review R1 M2, m5): an optional patch.byProps that is the module's ONLY registration attaches
    // once its target mounts (the watchers count a pending handle; the late-attach series runs after the
    // navigation commits), for appButtons (forwardRef, game page) and pagedSettings (bare function,
    // Settings). A second layer on appButtons matches although the first layer replaced its render.
    async 'RX-OPT'() {
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      const st0 = react.status();
      if (st0.routes.length || st0.overrides.length || st0.patches.length) return { ok: false, blocked: 'react has live routes or patches from other modules; RX-OPT needs the optional patch to be the only registration', status: st0 };
      const g = react.data.installedGames({ limit: 1 })[0];
      if (!g) return { ok: false, blocked: 'no installed game for the game page' };
      const routeBefore = route();
      const page = '/library/app/' + g.appid;
      const sys = react.Routes.Settings.System();
      const pl = (id) => react.status().patches.find((p) => p.id === id) || {};
      // Which runtime and module instance the test ran in (a reload or a module re-install by another agent
      // during the step kills the module's scoped timers).
      const rtState = () => { try { const g = window.__LGS_RT, s = g.status({ log: 80 }); const m = (s.modules || []).find((x) => x.name === 'react') || {};
        return { since: s.since, runtime: s.runtime, react: m.state, warn: (s.log || []).filter((e) => e.mod === 'react' && e.level !== 'info').slice(-3).map((e) => e.msg) }; } catch (e) { return String(e); } };
      out.runtimeAtStart = rtState();
      let h1 = null, h2 = null, h3 = null, c1 = 0, c2 = 0, c3 = 0;
      try {
        react.nav.go('/library/home'); await sleep(1300);
        h1 = react.patch.byProps('p2.opt.app', react.patch.targets.appButtons, (o) => function rxOptApp(p, r) { c1++; return o.call(this, p, r); }, { optional: true });
        const s1 = react.status();
        pass(h1.count === 0 && pl('p2.opt.app').pending === true && s1.watching === true,
          'optional appButtons registered on /library/home as the only registration: count ' + h1.count + ', pending ' + pl('p2.opt.app').pending + ', watching ' + s1.watching + ', late timers ' + s1.lateTimers);
        await sleep(3000);
        const s1b = react.status();
        pass(h1.count === 0 && s1b.watching === true && s1b.lateTimers === 0, 'nothing to attach on Home: still pending and watching after the registration series (late timers ' + s1b.lateTimers + ')');
        react.nav.go(page); await sleep(3000);
        pass(h1.count === 1 && pl('p2.opt.app').pending === false, 'attached after navigating to ' + page + ': count ' + h1.count + ' ' + h1.kinds.join() + ', attached by "' + pl('p2.opt.app').late + '"');
        pass(c1 > 0, 'patched render ran: ' + c1 + ' calls');
        // A second layer on the same component: appButtons reads the row's source through our trampoline.
        let threw = null;
        try { h2 = react.patch.byProps('p2.opt.app2', react.patch.targets.appButtons, (o) => function rxOptApp2(p, r) { c2++; return o.call(this, p, r); }); } catch (e) { threw = e.message; }
        pass(!!h2 && h2.count === 1, 'a second layer on appButtons matches the patched component: ' + (h2 ? h2.count + ' ' + h2.kinds.join() : threw));
        if (h2) {
          const a1 = c1;
          react.nav.go('/library/home'); await sleep(1200);
          react.nav.go(page); await sleep(2000);
          pass(c2 > 0 && c1 > a1, 'both layers run after a remount: layer 1 +' + (c1 - a1) + ', layer 2 ' + c2);
          h2.remove(); h2 = null;
        }
        h1.remove(); h1 = null;
        const s2 = react.status();
        pass(s2.patchedLeft === 0 && s2.watching === false && s2.lateTimers === 0, 'removed: patchedLeft ' + s2.patchedLeft + ', watching ' + s2.watching + ', late timers ' + s2.lateTimers);
        // pagedSettings (a bare function): registered on Home, attached on entering Settings.
        react.nav.go('/library/home'); await sleep(1300);
        h3 = react.patch.byProps('p2.opt.paged', react.patch.targets.pagedSettings, (o) => function rxOptPaged(p, r) { c3++; return o.call(this, p, r); }, { optional: true });
        pass(h3.count === 0 && react.status().watching === true, 'optional pagedSettings registered on Home (only registration): count ' + h3.count + ', watching ' + react.status().watching);
        react.nav.go(sys); await sleep(2500);
        pass(h3.count === 1 && h3.kinds[0] === 'fn', 'attached after entering ' + sys + ': count ' + h3.count + ' ' + h3.kinds.join() + ', attached by "' + pl('p2.opt.paged').late + '"');
        if (!c3) {
          // A bare function shows the patch at its next render: move to another Settings page (plain navigation).
          const f = react.fiber.findAll(react.patch.targets.pagedSettings, { max: 1 })[0];
          const other = f ? (f.memoizedProps.pages || []).find((pg) => pg && pg.visible !== false && typeof pg.route === 'string' && pg.route !== sys) : null;
          if (other) { react.nav.go(other.route, true); await sleep(1500); out.steps.push('NOTE moved to ' + other.route + ' for a render'); }
        }
        pass(c3 > 0, 'patched PagedSettings render ran: ' + c3 + ' calls');
        h3.remove(); h3 = null;
        const s3 = react.status();
        pass(s3.patchedLeft === 0 && s3.watching === false && !s3.jsxHooked, 'removed: patchedLeft ' + s3.patchedLeft + ', watching ' + s3.watching + ', element factories hooked ' + s3.jsxHooked);
      } catch (e) {
        out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e));
      } finally {
        for (const h of [h2, h1, h3]) if (h) { try { h.remove(); } catch (_) { /* gone */ } }
        if (route() !== routeBefore) { react.nav.go(routeBefore, true); await sleep(900); }
      }
      out.runtimeAtEnd = rtState();
      out.patchedLeft = react.test.countPatchedLeft();
      out.routeAfter = route();
      return out;
    },

    // RX-RETRY (review R1 m7): a transient ready() failure (no route switch yet, as while Steam's UI mounts
    // after a renderer restart) is retried by ready() itself after a backoff, without reset(); the finders
    // are not scanned again. A missing required finder stays sticky (RX-5).
    async 'RX-RETRY'() {
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      const st0 = react.status();
      if (st0.routes.length || st0.overrides.length || st0.patches.length) return { ok: false, blocked: 'react has live routes or patches from other modules; run with only reactLab on', status: st0 };
      try {
        react.reset();
        react.test.noSwitch(true);
        let e1 = null; try { react.ready(); } catch (e) { e1 = e; }
        pass(!!e1 && e1.transient === true && e1.retryAfterMs > 0 && /route switch not found/.test(e1.message),
          'no route switch: ready() throws a transient error: ' + (e1 && e1.message) + ' (retry after ' + (e1 && e1.retryAfterMs) + ' ms)');
        let e2 = null; try { react.ready(); } catch (e) { e2 = e; }
        pass(e2 === e1, 'within the backoff the same error is thrown again, nothing rescanned');
        let e3 = null; try { react.routes.add('/library/lgs/lab/rxretry', () => null); } catch (e) { e3 = e; }
        pass(!!e3 && react.test.countPatchedLeft() === 0 && !react.status().routes.length, 'a caller still fails closed meanwhile: ' + (e3 && e3.message));
        await sleep(e1.retryAfterMs + 150);
        let e4 = null; try { react.ready(); } catch (e) { e4 = e; }
        pass(!!e4 && e4 !== e1 && e4.transient && e4.retryAfterMs === 2 * e1.retryAfterMs, 'still missing after the backoff: retried, next backoff ' + (e4 && e4.retryAfterMs) + ' ms (attempt ' + (e4 && e4.attempt) + ')');
        react.test.noSwitch(false);
        await sleep(e4.retryAfterMs + 150);
        const t0 = performance.now();
        let ok = false; try { ok = react.ready(); } catch (e) { out.steps.push('NOTE ' + e.message); }
        const ms = Math.round(performance.now() - t0);
        const s = react.status();
        pass(ok === true && react.isReady && !s.error, 'once the switch is there, ready() succeeds by itself without reset() in ' + ms + ' ms (finders reused from the first scan)');
      } catch (e) {
        out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e));
      } finally {
        try { react.test.noSwitch(false); } catch (_) { /* gone */ }
        if (!react.isReady) { try { react.reset(); react.ready(); } catch (_) { /* reported above */ } }
      }
      out.ready = react.isReady;
      return out;
    },

    // RX-FAIL (review R1 M3, m8): ui.ErrorBoundary's error page as the whole page of a real added route
    // (not the lab wrapper, whose own centring hid the bug): the root spans the page, title and Back sit on
    // the page's centre line inside 48 px insets, the title is Title 2, Back is a focused 60 px capsule
    // with no outline or border, and B leaves.
    async 'RX-FAIL'() {
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      const routeBefore = route();
      try {
        const o = await openRaw('boom', { settleMs: 1500 });
        // Back takes focus on entry (autoFocus). Steam draws .gpfocus only while the navigation source is
        // the gamepad: after another agent's laser step it is not, so DOM focus is read first, then a
        // D-pad press (Back is the page's only control; nothing acts) brings the gamepad source back, as
        // RX-1's refocus does (SR §4 vr-null-tree).
        const backEl = () => doc().querySelector('.lgs-react-fail-back');
        out.domFocusOnEntry = !!backEl() && doc().activeElement === backEl();
        for (let i = 0; i < 6 && where() !== 'fail-page'; i++) {
          react.nav.focusRoot(); await sleep(400);
          if (where() === 'none') { FNC().DispatchVirtualButtonClick(BTN.DOWN); await sleep(400); }
        }
        if (where() !== 'fail-page') out.steps.push('NOTE focus after FocusApplicationRoot() and D-pad: ' + where() + ' (' + navState() + ')');
        const d = doc(), w = react.nav.win();
        const fail = d.querySelector('.lgs-react-fail');
        pass(o.route === RAW && !!fail, 'error page shown on the real added route ' + o.route);
        if (fail) {
          const R = (e) => { const q = e.getBoundingClientRect(); return { x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width), h: Math.round(q.height) }; };
          const cx = (e) => { const q = e.getBoundingClientRect(); return Math.round(q.x + q.width / 2); };
          const pr = R(fail.parentElement), fr = R(fail);
          const t = d.querySelector('.lgs-react-fail-title'), b = d.querySelector('.lgs-react-fail-back');
          const mid = Math.round(pr.x + pr.w / 2);
          out.rects = { parent: pr, root: fr, title: t ? R(t) : null, back: b ? R(b) : null, window: w.innerWidth };
          pass(Math.abs(fr.w - pr.w) <= 1 && fr.x === pr.x, 'the page root spans its parent: ' + JSON.stringify(fr) + ' in ' + JSON.stringify(pr));
          pass(!!b && Math.abs(cx(b) - mid) <= 2 && (!t || Math.abs(cx(t) - mid) <= 2), 'title and Back on the centre line: title ' + (t ? cx(t) : '-') + ', Back ' + (b ? cx(b) : '-') + ', centre ' + mid + ' (window ' + w.innerWidth + ')');
          pass(!t || R(t).x >= pr.x + 47, 'the title keeps the 48 px inset: x ' + (t ? R(t).x : '-'));
          if (t) {
            const ts = w.getComputedStyle(t);
            pass(ts.fontSize === '30px' && ts.fontWeight === '700', 'title is Title 2: ' + ts.fontSize + ' / ' + ts.fontWeight);
          }
          if (b) {
            const bs = w.getComputedStyle(b), br = R(b);
            out.back = { radius: bs.borderRadius, font: bs.fontSize + '/' + bs.fontWeight, outline: bs.outlineStyle + ' ' + bs.outlineWidth, border: bs.borderTopWidth };
            pass(br.h >= 59 && br.w >= 239 && parseFloat(bs.borderRadius) >= br.h / 2 - 1 && (bs.outlineStyle === 'none' || parseFloat(bs.outlineWidth) === 0) && parseFloat(bs.borderTopWidth) === 0,
              'Back is a capsule with no outline or border: ' + br.w + ' x ' + br.h + ', radius ' + bs.borderRadius + ', ' + out.back.font + ', outline ' + out.back.outline + ', border ' + bs.borderTopWidth);
            pass(b.classList.contains('gpfocus'), 'Back has gamepad focus: ' + where() + ' (DOM focus on Back at entry: ' + out.domFocusOnEntry + ')');
          }
          press('B'); await sleep(1100);
          pass(route() !== RAW, 'B leaves the error page: ' + route());
        }
      } catch (e) {
        out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e));
      } finally {
        try { await close(); } catch (_) { /* best effort */ }
        if (route() !== routeBefore) { react.nav.go(routeBefore, true); await sleep(900); }
      }
      out.routeAfter = route();
      out.routes = react.routes.list();
      return out;
    },

    // RX-OPEN (review R1 m6): lab.open() reports a fixture that throws as {mounted: false, error}.
    async 'RX-OPEN'() {
      const out = { ok: true, steps: [] };
      const pass = (c, msg) => { out.steps.push((c ? 'PASS ' : 'FAIL ') + msg); if (!c) out.ok = false; };
      try {
        const a = await open('boom');
        pass(a.mounted === false && /forced render error/.test(a.error || ''), 'throwing fixture: ' + JSON.stringify(a));
        const b = await open('buttons');
        pass(b.mounted === true && b.error === null, 'the next fixture on the same route mounts cleanly: ' + JSON.stringify(b));
        const c = await close();
        pass(c.routeLeft && !c.routes.added.includes(LAB), 'closed: ' + JSON.stringify({ route: c.route, routes: c.routes }));
      } catch (e) { out.ok = false; out.steps.push('ERROR ' + ((e && e.message) || e)); try { await close(); } catch (_) { /* best effort */ } }
      return out;
    },
  };

  async function run(id, L) {
    const fn = runners[id];
    if (!fn) throw new Error('react-lab: no test ' + id);
    const t0 = Date.now();
    const res = await fn(L || window.__LGS_LAB || null);
    res.test = id;
    res.ms = Date.now() - t0;
    res.date = new Date().toISOString();
    return res;
  }

  RT.define({
    name: 'react-lab',
    deps: ['react'],
    flag: 'reactLab',
    install(scope) {
      rt = scope || RT;
      react = rt.use('react');
      S = newState();
      builtinFixtures();
      const api = {
        fixture(name, factory) { if (typeof factory !== 'function') throw new Error('fixture: factory must be a function'); S.fixtures.set(name, factory); return name; },
        fixtures: () => [...S.fixtures.keys()],
        open, openRaw, close, selftest, run, press, where,
        get events() { return S.events.slice(); },
        tests: Object.keys(runners),
      };
      // Contract §9: also reachable as rt.react.lab while this module is installed.
      try { react.lab = api; } catch (_) { /* frozen */ }
      return api;
    },
    async remove() {
      const st = S;
      if (!st) return { patchedLeft: 0 };
      try { unspy(); } catch (_) { /* none */ }
      if (st.menu) { try { st.menu.Hide(); } catch (_) { /* closed */ } }
      try { if (st.labRoute) st.labRoute.remove(); } catch (_) { /* gone */ }
      try { if (st.rawRoute) st.rawRoute.remove(); } catch (_) { /* gone */ }
      for (const h of st.handles) { try { h.remove(); } catch (_) { /* gone */ } }
      try { if (react && react.lab) delete react.lab; } catch (_) { /* gone */ }
      S = null; react = null; rt = null;
      return { patchedLeft: 0 };
    },
  });
})();
