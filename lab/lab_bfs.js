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
  if (!L || L.single || (L.bfs && L.bfs.v === 9)) return;
  const sleep = L.sleep;
  const CODE = { up: 9, down: 10, left: 11, right: 12 };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const inst = () => SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
  const W = () => L.surface('main');
  // Steam's focus: the innermost .gpfocus element that has a nav node (test fixtures other agents
  // inject with a .gpfocus class have none).
  const gp = () => { const a = [...W().document.querySelectorAll('.gpfocus')].filter((e) => !e.closest('[id^="lgs-"]') && L.navNode(e)); return a.length ? a[a.length - 1] : null; };
  const where = () => { if (gp()) return 'main'; const k = Object.keys(L.focused()); return k.length ? k[0] : null; };
  // A label that does not change with focus: aria-label, then the aria-labelledby texts (Steam's library tiles
  // show their name only while focused, but always reference it), then the visible text.
  const labelOf = (el) => {
    const a = el.getAttribute('aria-label');
    if (a) return a;
    const ids = el.getAttribute('aria-labelledby');
    if (ids) {
      const t = ids.split(/\s+/).map((id) => { const x = el.ownerDocument.getElementById(id); return x ? x.textContent : ''; }).join(' ').trim();
      if (t) return t;
    }
    return el.innerText || '';
  };
  const own = (el) => labelOf(el).trim().replace(/\s+/g, ' ').slice(0, 40);
  // A control without text (toggle, slider) is named by the nearest ancestor that has text (its row label).
  const text = (el) => { for (let n = el, i = 0; n && n.nodeType === 1 && i < 5; n = n.parentElement, i++) { const t = own(n); if (t) return t; } return ''; };
  // Identity: the first readable class that is not a state class (focus, selection, visibility change it),
  // the label, and the rank among elements with the same class and label in document order (stable under
  // scrolling, which moves x and y: a shelf keeps its focused tile in place).
  const STATE = /(gpfocus|Focusable|^lgs-|Active|Selected|Focus|Hover|Visible|Expanded|Open|Highlight|Pressed|Within|WhiteBackground|^On$|>On\}|>Off\})/;
  const cls = (el) => L.readable(el).filter((c) => !STATE.test(c)).slice(0, 1).join(' ') || el.tagName.toLowerCase();
  const keyOf = (el) => {
    const c = cls(el), t = text(el);
    let n = 0;
    for (const e of el.ownerDocument.querySelectorAll(L.FOCUSABLE)) {
      if (e === el) break;
      if (cls(e) === c && text(e) === t) n++;
    }
    return c + '|' + t + '#' + n;
  };
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
      S.info.push(Object.assign(desc(el), { route: L.route(), key: k }));
    } else S.nodes[i].el = el;
    return i;
  }
  function findByKey(key) {
    for (const f of leaves()) if (keyOf(f.el) === key) return f.el;
    return null;
  }
  // Leaf focusables: visible elements with a nav node that hold no other such element (a row whose
  // focus goes to its dropdown, or a page panel, is a container, not a target).
  function leaves(onscreen) {
    const w = W(), all = [];
    for (const el of w.document.querySelectorAll(L.FOCUSABLE)) {
      if (el.closest('[id^="lgs-"]') || !L.navNode(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      all.push(el);
    }
    const isLeaf = (el) => !all.some((g) => g !== el && el.contains(g));
    // Off-screen elements count (rows below the fold, sidebar items further down), hidden ones do not.
    const shown = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = w.getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false; } return true; };
    return all.filter((el) => isLeaf(el) && shown(el) && (!onscreen || L.visible(w, el))).map((el) => ({ el }));
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
  async function takeDirect(S, i) {
    const n = S.nodes[i];
    // Edges are measured in the node's own route: Steam Settings keeps the sidebar mounted across
    // pages, and BTakeFocus on a sidebar item does not change the page, so take the route first.
    if (L.route() !== n.route) { L.nav(n.route); await sleep(1300); n.el = null; }
    if (gp() && keyOf(gp()) === n.key) return true;
    if (!n.el || !n.el.isConnected) {
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
  // A node that is not mounted now (a tab panel that follows focus, a page in a pager) is reached again the
  // way the sweep found it: take its parent, press the same direction.
  async function take(S, i, depth) {
    if (await takeDirect(S, i)) return true;
    const p = S.parent[i];
    if (!p || (depth || 0) > 8) return false;
    if (!(await take(S, p.a, (depth || 0) + 1))) return false;
    const m = await press(S, p.dir);
    if (m.r === 'node' && keyOf(m.el) === S.nodes[i].key) { S.nodes[i].el = m.el; S.replayed++; return true; }
    if (m.recover) await recover(S);
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
    const S = window.__LGS_BFS = { route: L.route(), nodes: [], info: [], byKey: new Map(), edges: {}, rev: [], untested: [], queue: [], parent: {}, replayed: 0, seen: new Set(), moves: 0, t0: Date.now() };
    inst().FocusApplicationRoot();
    await sleep(300);
    // the first press both activates focus and moves it (SR 4): Down then Up
    FocusNavController.DispatchVirtualButtonClick(10); await sleep(260);
    FocusNavController.DispatchVirtualButtonClick(9); await sleep(260);
    if (seg(L.route()) !== seg(S.route) || L.route() !== S.route) { L.nav(S.route); await sleep(1300); inst().FocusApplicationRoot(); await sleep(300); }
    if (o.start) { const el = L.q('main', o.start); if (el) { try { L.gpTakeEl(el); } catch (_) { /* keep */ } await sleep(200); } }
    const start = gp();
    if (!start) return { error: 'no gamepad focus after FocusApplicationRoot (vr-null-tree?)' };
    // The universe: leaf focusables visible on the start route. Nodes reached on another route (Steam
    // Settings: selection follows focus) are expanded only when they are also in the universe (the
    // sidebar); other nodes there are recorded as reached leaves.
    S.universe = new Map();
    for (const f of leaves()) { const k = keyOf(f.el); if (!S.universe.has(k)) S.universe.set(k, desc(f.el)); }
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
        if (S.parent[b] === undefined && b !== S.entry) S.parent[b] = { a, dir };
        S.edges[a][dir] = b;
        // reversibility, as a user does it: the opposite press right away (focus memory intact)
        const back = await press(S, OPP[dir]);
        const ok = back.r === 'node' && keyOf(back.el) === S.nodes[a].key;
        if (back.r === 'skip:slider') S.untested.push({ a, dir, b, why: 'opposite move would change a slider' });
        else if (!ok) S.rev.push({ a, dir, b, back: back.r === 'node' ? nodeFor(S, back.el) : back.r });
        if (back.recover) await recover(S);
        const expand = S.nodes[b].route === S.route || S.universe.has(S.nodes[b].key);
        if (!S.seen.has(b) && expand && S.nodes.length <= S.max) { S.seen.add(b); S.queue.push(b); }
      }
    }
    return { done: S.queue.length === 0, visited: Object.keys(S.edges).length, nodes: S.nodes.length, queue: S.queue.length, moves: S.moves, route: L.route() };
  }

  async function finish(o) {
    o = o || {};
    const S = window.__LGS_BFS;
    if (L.route() !== S.route) { L.nav(S.route); await sleep(1300); }
    await recover(S);
    // unreached: leaf focusables visible on the start route (at init and now) that no node matches
    const keys = new Set(S.nodes.map((n) => n.key));
    for (const f of leaves()) { const k = keyOf(f.el); if (!S.universe.has(k)) S.universe.set(k, desc(f.el)); }
    const unreached = [...S.universe.entries()].filter(([k]) => !keys.has(k)).map(([, d]) => d);
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
      untested: S.untested.map((r) => ({ from: r.a, dir: r.dir, to: r.b, why: r.why })), universe: S.universe.size,
      unreached, b, moves: S.moves, replayed: S.replayed, seconds: Math.round((Date.now() - S.t0) / 100) / 10, truncated: S.queue.length > 0,
    };
    res.pass = unreached.length === 0 && res.irreversible.length === 0 && !res.truncated;
    delete window.__LGS_BFS;
    return res;
  }

  L.bfs = { v: 9, init, step, finish, keyOf, leaves };
})();
