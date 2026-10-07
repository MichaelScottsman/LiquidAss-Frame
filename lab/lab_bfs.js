// Gamepad reachability BFS for `glass.py pad-bfs` (P10, contracts/lab.md section 4; G-PAD,
// VP P-20 to P-24). Navigation only: D-pad moves and one B at the end. Never A, X, Y or menu;
// never Left/Right on a slider. Runs in chunks (state on window.__LGS_BFS) so each lab_js
// call stays under its timeout.
//
// Nodes are keyed by what they are (readable classes, text, column), not by DOM identity, so
// a move that changes the route (Steam Settings: selection follows focus) keeps working: a
// route change inside the start route's first segment (/settings/...) is an ordinary move and
// the node remembers its route; any other route change (the header search -> /search and the
// keyboard) is recorded and undone.
(function () {
  const L = window.__LGS_LAB;
  if (!L || L.single || (L.bfs && L.bfs.v === 3)) return;
  const sleep = L.sleep;
  const CODE = { up: 9, down: 10, left: 11, right: 12 };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const inst = () => SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
  const W = () => L.surface('main');
  const gp = () => { const a = W().document.querySelectorAll('.gpfocus'); return a.length ? a[a.length - 1] : null; };
  const where = () => { if (gp()) return 'main'; const k = Object.keys(L.focused()); return k.length ? k[0] : null; };
  const text = (el) => (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const cls = (el) => L.readable(el).filter((c) => !/^(gpfocus|gpfocuswithin|Focusable|lgs-|%\{.*(Active|Selected|Focused)\})/.test(c)).slice(0, 3).join(' ');
  const keyOf = (el) => cls(el) + '|' + text(el) + '|' + Math.round(el.getBoundingClientRect().x / 16);
  const desc = (el) => { const r = el.getBoundingClientRect(); return { el: L.readable(el).slice(0, 3).join(' ') || el.tagName.toLowerCase(), text: text(el), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }; };
  const isSlider = (el) => !!(el && (el.querySelector('input[type=range]') || /Slider/i.test(L.readable(el).join(' ')) || el.closest('[class*="Slider"]')));
  const seg = (p) => (p || '').split('/')[1] || '';

  function nodeFor(S, el) {
    const k = keyOf(el);
    let i = S.byKey.get(k);
    if (i === undefined) {
      i = S.nodes.length;
      S.byKey.set(k, i);
      S.nodes.push({ key: k, route: L.route(), el });
      S.info.push(Object.assign(desc(el), { route: L.route() }));
    } else S.nodes[i].el = el;
    return i;
  }
  function findByKey(key) {
    for (const f of L.focusables('main', { nav: true })) if (keyOf(f.el) === key) return f.el;
    return null;
  }
  async function waitChange(prev, ms) {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      await sleep(20);
      const g = gp();
      if (g !== prev) { await sleep(60); return gp(); }
      if (!g && where() !== 'main') return null;
    }
    return gp();
  }
  async function take(S, i) {
    const n = S.nodes[i];
    if (gp() && keyOf(gp()) === n.key) return true;
    if (!n.el || !n.el.isConnected) {
      if (L.route() !== n.route) { L.nav(n.route); await sleep(1300); }
      n.el = findByKey(n.key);
      if (!n.el) return false;
    }
    try { L.gpTakeEl(n.el); } catch (_) { return false; }
    for (let k = 0; k < 12; k++) {
      await sleep(20);
      const g = gp();
      if (g && (g === n.el || keyOf(g) === n.key)) return true;
    }
    return false;
  }
  async function recover(S) {
    try { SteamClient.OpenVR.Keyboard.Hide(); } catch (_) { /* none */ }
    if (seg(L.route()) !== seg(S.route)) { L.nav(S.route); await sleep(1300); }
    if (!gp()) { inst().FocusApplicationRoot(); await sleep(250); }
  }
  async function press(S, dir) {
    const before = gp();
    if ((dir === 'left' || dir === 'right') && isSlider(before)) return { r: 'skip:slider' };
    const route = L.route();
    FocusNavController.DispatchVirtualButtonClick(CODE[dir]);
    S.moves++;
    const after = await waitChange(before, 260);
    const now = L.route();
    if (now !== route && seg(now) !== seg(S.route)) return { r: 'route:' + now, recover: true };
    if (!after) { const w = where(); return { r: 'exit:' + (w || 'none'), recover: true }; }
    if (after === before) return { r: 'edge' };
    return { r: 'node', el: after, routeChanged: now !== route ? now : null };
  }

  async function init(o) {
    o = o || {};
    const S = window.__LGS_BFS = { route: L.route(), nodes: [], info: [], byKey: new Map(), edges: {}, rev: [], queue: [], seen: new Set(), moves: 0, t0: Date.now() };
    inst().FocusApplicationRoot();
    await sleep(300);
    // the first press both activates focus and moves it (SR 4): Down then Up
    FocusNavController.DispatchVirtualButtonClick(10); await sleep(260);
    FocusNavController.DispatchVirtualButtonClick(9); await sleep(260);
    if (seg(L.route()) !== seg(S.route) || L.route() !== S.route) { L.nav(S.route); await sleep(1300); inst().FocusApplicationRoot(); await sleep(300); }
    if (o.start) { const el = L.q('main', o.start); if (el) { try { L.gpTakeEl(el); } catch (_) { /* keep */ } await sleep(200); } }
    const start = gp();
    if (!start) return { error: 'no gamepad focus after FocusApplicationRoot (vr-null-tree?)' };
    S.entry = nodeFor(S, start);
    S.queue.push(S.entry);
    S.seen.add(S.entry);
    S.max = o.max || 120;
    return { entry: S.info[S.entry], route: S.route };
  }

  async function step(budgetMs) {
    const S = window.__LGS_BFS;
    const t0 = Date.now();
    while (S.queue.length && Date.now() - t0 < budgetMs) {
      const a = S.queue.shift();
      S.edges[a] = S.edges[a] || {};
      for (const dir of ['down', 'right', 'up', 'left']) {
        if (!(await take(S, a))) { S.edges[a][dir] = 'untakeable'; break; }
        const m = await press(S, dir);
        if (m.r !== 'node') {
          S.edges[a][dir] = m.r;
          if (m.recover) await recover(S);
          continue;
        }
        const b = nodeFor(S, m.el);
        S.edges[a][dir] = b;
        // reversibility, as a user does it: the opposite press right away (focus memory intact)
        const back = await press(S, OPP[dir]);
        const ok = back.r === 'node' && keyOf(back.el) === S.nodes[a].key;
        if (!ok) S.rev.push({ a, dir, b, back: back.r === 'node' ? nodeFor(S, back.el) : back.r });
        if (back.recover) await recover(S);
        if (!S.seen.has(b) && S.nodes.length <= S.max) { S.seen.add(b); S.queue.push(b); }
      }
    }
    return { done: S.queue.length === 0, visited: Object.keys(S.edges).length, nodes: S.nodes.length, queue: S.queue.length, moves: S.moves, route: L.route() };
  }

  async function finish(o) {
    o = o || {};
    const S = window.__LGS_BFS;
    if (L.route() !== S.route) { L.nav(S.route); await sleep(1300); }
    await recover(S);
    // unreached: visible focusables (with a nav node) on the start route that no node matches
    const keys = new Set(S.nodes.map((n) => n.key));
    const els = S.nodes.map((n) => n.el).filter(Boolean);
    const unreached = L.focusables('main', { nav: true }).filter((f) => !keys.has(keyOf(f.el)) && !els.some((s) => s.isConnected && (s.contains(f.el) || f.el.contains(s))))
      .map((f) => desc(f.el));
    let b = null;
    if (!o.noB) {
      await take(S, S.entry);
      const ot = L.openThings();
      const before = { route: L.route(), modals: ot.modals.length, menus: ot.menus.length };
      FocusNavController.DispatchVirtualButtonClick(2);
      await sleep(700);
      const ot2 = L.openThings();
      const after = { route: L.route(), modals: ot2.modals.length, menus: ot2.menus.length };
      b = { before, after, effect: after.modals < before.modals || after.menus < before.menus ? 'closed a layer' : (after.route !== before.route ? 'route ' + before.route + ' -> ' + after.route : 'nothing') };
      if (L.route() !== S.route) { L.nav(S.route); await sleep(1300); }
    }
    const res = {
      route: S.route, entry: S.info[S.entry], nodes: S.info.map((x, i) => Object.assign({ id: i }, x)), edges: S.edges,
      routes: [...new Set(S.info.map((x) => x.route))],
      irreversible: S.rev.map((r) => ({ from: r.a, dir: r.dir, to: r.b, back: r.back })),
      unreached, b, moves: S.moves, seconds: Math.round((Date.now() - S.t0) / 100) / 10, truncated: S.queue.length > 0,
    };
    res.pass = unreached.length === 0 && res.irreversible.length === 0 && !res.truncated;
    delete window.__LGS_BFS;
    return res;
  }

  L.bfs = { v: 3, init, step, finish, keyOf };
})();
