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
  if (!L || L.single || (L.bfs && L.bfs.v === 11)) return;
  const sleep = L.sleep;
  const CODE = { up: 9, down: 10, left: 11, right: 12 };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const inst = () => SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
  const W = () => L.surface('main');
  // Steam's focus: the innermost .gpfocus element that has a nav node (test fixtures other agents
  // inject with a .gpfocus class have none).
  // Main has the gamepad only while Steam's active nav tree lives in main's document: after an exit (the frame
  // menu) or while another window's tree is active (the VR keyboard) main can keep a stale .gpfocus class.
  const treeInMain = () => { try { const at = FocusNavController.GetActiveNavTree(); const el = at && at.m_Root && at.m_Root.m_element; return !el || el.ownerDocument.defaultView === W(); } catch (_) { return true; } };
  const gp = () => { if (!treeInMain()) return null; const a = [...W().document.querySelectorAll('.gpfocus')].filter((e) => !e.closest('[id^="lgs-"]') && L.navNode(e)); return a.length ? a[a.length - 1] : null; };
  const where = () => { if (gp()) return 'main'; const k = Object.keys(L.focused()).filter((n) => n !== 'VR'); return k.length ? k[0] : null; };
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
  // Bring gamepad focus back into the main window after a move left it (an `exit:` edge: Left from a row's first
  // item into the frame menu, REQ C1b->P10 #10, C2a->P10 #14). As a user does it first: the opposite direction
  // (this also tells whether the exit is reversible), then FocusApplicationRoot (SR 4), then main's own nav tree
  // made active again in Steam's focus context (FindNavTreeInWindow + SetActiveNavTree) and the root once more.
  // Returns how focus came back ('opposite' | 'root' | 'tree'), or null when it did not.
  function ctxOf() { const i = inst(); try { return (i.GetFocusNavContext && i.GetFocusNavContext()) || i.m_FocusNavContext || null; } catch (_) { return null; } }
  // main's own nav tree (GamepadUI_VR_Full_Root) made Steam's active one (FindNavTreeInWindow + Activate). After an
  // exit the gamepad can sit in another window's tree (the frame menu, the VR keyboard) or in `vr-null-tree`, and
  // then neither FocusApplicationRoot, D-pad presses nor BTakeFocus reach main (session 5 probe on
  // /library/tab/AllGames: Left from the first poster -> vr-null-tree; root, BTakeFocus and Down left it there;
  // Activate gave main the gamepad back). Steam's own focus API: it runs no action.
  function activateMain() {
    const ctx = ctxOf();
    try {
      const t = ctx && typeof ctx.FindNavTreeInWindow === 'function' ? ctx.FindNavTreeInWindow(W()) : null;
      if (t && typeof t.Activate === 'function') { t.Activate(true); return true; }
      if (t && ctx && typeof ctx.SetActiveNavTree === 'function') { ctx.SetActiveNavTree(t); return true; }
    } catch (_) { /* older build */ }
    return false;
  }
  // main has the gamepad, and still has it 150 ms later (an activation Steam undoes at once is not a recovery: the
  // session 4 sweep counted such a moment as "back" and then found every later node untakeable)
  async function held(ms) {
    for (let k = 0; k < (ms || 300) / 20 && !gp(); k++) await sleep(20);
    if (!gp()) return false;
    await sleep(150);
    return !!gp();
  }
  async function regain(S, dir) {
    if (gp()) return 'kept';
    if (dir) {
      FocusNavController.DispatchVirtualButtonClick(CODE[OPP[dir]]);
      S.moves++;
      if (await held()) return 'opposite';
    }
    if (activateMain() && await held()) return 'tree';
    try { inst().FocusApplicationRoot(); } catch (_) { /* no main */ }
    if (await held()) return 'root';
    // The main overlay given the VR gamepad again, then the root and a Down + Up (SR 4: the first press activates
    // focus). After an exit from a text field (/search/tab/All: Left on the field makes vr-null-tree active: the
    // gamepad left Steam's overlay) neither the tree, the root nor D-pad presses reach main. Steam's own
    // EnsureVROverlayVisible (what its Navigate calls after every route change) followed by the root and Down + Up
    // does, with no navigation (session 5 probes 14:00-14:12). Last resort: Navigate to the same route, replacing
    // the history entry (Steam's Navigate(path, replace)), so the final B still sees Steam's own history. A Down that
    // changes the page (Settings: selection follows focus) is undone by the route check.
    const rootDownUp = async (r) => {
      try { inst().FocusApplicationRoot(); } catch (_) { /* no main */ }
      await sleep(300);
      FocusNavController.DispatchVirtualButtonClick(10); S.moves++; await sleep(260);
      FocusNavController.DispatchVirtualButtonClick(9); S.moves++; await sleep(260);
      if (L.route() !== r) { L.nav(r); await sleep(1300); }
    };
    const r = L.route();
    if (typeof inst().EnsureVROverlayVisible === 'function') {
      try { inst().EnsureVROverlayVisible(); } catch (_) { /* older build */ }
      await sleep(500);
      await rootDownUp(r);
      if (await held()) return 'overlay';
    }
    if (seg(r) === seg(S.route)) {
      try { inst().Navigate(r, true); } catch (_) { L.nav(r); }
      S.navs++;
      await sleep(1000);
      await rootDownUp(r);
      if (await held()) return 'nav';
    }
    activateMain();
    try { inst().FocusApplicationRoot(); } catch (_) { /* no main */ }
    if (await held()) return 'tree+root';
    return null;
  }
  async function takeDirect(S, i) {
    const n = S.nodes[i];
    if (!gp()) await regain(S, null);            // focus is outside main (a recovery that did not come back)
    // Edges are measured in the node's own route: Steam Settings keeps the sidebar mounted across
    // pages, and BTakeFocus on a sidebar item does not change the page, so take the route first.
    if (L.route() !== n.route) { L.nav(n.route); await sleep(1300); n.el = null; }
    if (gp() && keyOf(gp()) === n.key) return true;
    if (!n.el || !n.el.isConnected) {
      n.el = findByKey(n.key);
      if (!n.el) return false;
    }
    // A BTakeFocus that does not land: main's tree may not be Steam's active one although main still shows a
    // .gpfocus (REQ C1b->P10 #10, C2a->P10 #14). Activate main's tree and take once more before calling the node
    // untakeable.
    for (let attempt = 0; attempt < 2; attempt++) {
      try { L.gpTakeEl(n.el); } catch (_) { return false; }
      for (let k = 0; k < 12; k++) {
        await sleep(20);
        const g = gp();
        if (g && (g === n.el || keyOf(g) === n.key)) { if (attempt) S.retook++; return true; }
      }
      if (!attempt) { activateMain(); await sleep(60); }
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
    if (m.recover) await recover(S, /^exit:/.test(m.r) ? p.dir : null);
    return false;
  }
  async function recover(S, dir) {
    try { SteamClient.OpenVR.Keyboard.Hide(); } catch (_) { /* none */ }
    if (seg(L.route()) !== seg(S.route)) { L.nav(S.route); await sleep(1300); }
    return gp() ? 'kept' : regain(S, dir);
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
    const S = window.__LGS_BFS = { route: L.route(), nodes: [], info: [], byKey: new Map(), edges: {}, rev: [], untested: [], exits: [], queue: [], parent: {}, replayed: 0, retook: 0, navs: 0, seen: new Set(), moves: 0, t0: Date.now() };
    inst().FocusApplicationRoot();
    await sleep(300);
    // the first press both activates focus and moves it (SR 4): Down then Up
    FocusNavController.DispatchVirtualButtonClick(10); await sleep(260);
    FocusNavController.DispatchVirtualButtonClick(9); await sleep(260);
    if (seg(L.route()) !== seg(S.route) || L.route() !== S.route) { L.nav(S.route); await sleep(1300); inst().FocusApplicationRoot(); await sleep(300); }
    if (!gp()) S.initRegain = await regain(S, null);     // another window's nav tree kept the gamepad
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
          if (m.recover) {
            const how = await recover(S, /^exit:/.test(m.r) ? dir : null);
            if (/^exit:/.test(m.r)) S.exits.push({ a, dir, to: m.r, back: how });
          }
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
        if (back.recover) await recover(S, /^exit:/.test(back.r) ? OPP[dir] : null);
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
      // moves that left the main window, and how focus came back (REQ C1b->P10 #10, C2a->P10 #14)
      exits: S.exits.map((r) => ({ from: r.a, dir: r.dir, to: r.to, back: r.back })),
      unreached, b, moves: S.moves, replayed: S.replayed, retook: S.retook, navs: S.navs, seconds: Math.round((Date.now() - S.t0) / 100) / 10, truncated: S.queue.length > 0,
    };
    res.pass = unreached.length === 0 && res.irreversible.length === 0 && !res.truncated;
    delete window.__LGS_BFS;
    return res;
  }

  L.bfs = { v: 11, init, step, finish, keyOf, leaves, regain, activateMain };
})();
