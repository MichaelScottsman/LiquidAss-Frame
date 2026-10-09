// Glass Shell phase 2, C1a shell chrome runtime (T2): module `shell`, flag `wp.c1a`.
// Concept: docs/phase2/concepts/window-nav.md (WN) §3.1-§3.4; PLAN §1.2, §1.9, §1.10.
// Evidence: docs/phase2/wp/C1a.md. CSS that reads what this module writes: theme/20-shell.css.
//
// Writes (all removed by remove(), G-REMOVE):
//   %{BasicUiRoot}[data-lgs-glass]   window | window-full | windowless | hero  (route map, hooks; never on focus)
//   %{BasicUiRoot}[data-lgs-route]   route key (WN §3.1.1)
//   %{BasicUiRoot}[data-lgs-search]  capsule | nested | circle               (PLAN §1.9 field variant)
//   %{BasicUiRoot}[data-lgs-back]    root | nested                           (Back style, WN §3.2)
//   html.lgs-hdr-40 / html.lgs-hdr-108 on main (CQ1; 108 only when the flag hdr108 tries it and it holds)
//   #header > .lgs-title             Large Title (aria-hidden), section roots only
//   %{BackContainer}[data-lgs-exempt="E-BACK"][aria-label]  Back as the chevron circle (PLAN §1.16)
//   #Footer [data-lgs-btn]           each legend's button (from its React props rgButtons)
//   #Footer[data-lgs-orn]            capsule | quiet (material by content, PLAN §1.10)
//   #Footer[data-lgs-orn-compact]    members would pass 960 px
//   #Footer[data-lgs-orn-fixed] + --lgs-orn-x / --lgs-orn-w   an area's fixed slots
//   #Footer[data-lgs-band="off"]     flag quietBacking = "off"
//   Native glass (PLAN §1.6, contracts/reporter.md §2.2-§2.4; read by theme/layers/20-shell.json):
//   #Footer > div.lgs-orn-plate      the ornament's rect: [data-lgs-nopop] always, [data-lgs-plate="liquid"]
//                                    only as a capsule (the quiet legend has no material); id shell-ornament
//   Back / search [data-lgs-plate]   liquid plates shell-back / shell-search on windowless routes only
//   frame menu > div.lgs-tabcap x2   the tab bar's two capsules: the frame.menu cover elements (paint nothing)
// API (rt.use('shell'), __LGS_RT.shell):
//   glassMode(routeKey | '*', fn) -> {remove()}; refreshGlass(); ornamentSlots(routeKey, {widths, gap, padding})
//   -> {remove()}; route() -> {path, key, mode, search}; target(); onTarget(fn) -> {remove()}; status()
(function lgsC1aShell() {
  'use strict';
  const RT = (typeof __LGS_RT !== 'undefined') ? __LGS_RT : window.__LGS_RT;
  if (!RT || typeof RT.define !== 'function') return;

  const H = window;
  const MODES = ['window', 'window-full', 'windowless', 'hero'];
  // Steam's legend enum as the footer legends carry it (rgButtons, probed 2026-10-07 on build 11094443:
  // Select 0, Back 1, Filter (X) 2, Sort By (Y) 3, Options (menu) 11)
  const BTN = { 0: 'OK', 1: 'CANCEL', 2: 'SECONDARY', 3: 'OPTIONS', 4: 'BUMPER_LEFT', 5: 'BUMPER_RIGHT',
    6: 'TRIGGER_LEFT', 7: 'TRIGGER_RIGHT', 10: 'SELECT', 11: 'MENU' };
  const QUIET = new Set(['OK', 'CANCEL']);
  // Steam's localization token for the library's ≡ description "Options" (probed on build 11094443:
  // a poster's onMenuActionDescription; PLAN §1.15). Used only when neither the target's own description
  // nor a ≡ legend Steam rendered earlier gives the string.
  const OPT_TOKENS = ['#LibraryHome_GameCarousel_ContextMenu'];
  // WN §3.1.1 route map: [pattern, key, mode, search variant, back style, Large Title section index]
  // (section index into the frame menu's items: Home 0, Library 1, Store 2, Friends 3, Media 4, Downloads 5)
  const ROUTES = [
    [/^\/library\/home\/?$/, 'home', 'window-full', 'circle', 'root', -1],
    [/^\/library\/lgs\/folder\//, 'folder', 'windowless', 'circle', 'nested', -1],
    [/^\/library\/lgs\/steamhome/, 'steamhome', 'window-full', 'circle', 'nested', -1],
    [/^\/library\/tab\//, 'library', 'window', 'capsule', 'root', 1],
    [/^\/library\/collection\//, 'library', 'window', 'nested', 'nested', -1],
    [/^\/search(\/|$)/, 'search', 'window', 'nested', 'nested', -1],
    [/^\/library\/downloads/, 'downloads', 'window', 'capsule', 'root', 5],
    [/^\/media\/grid/, 'media', 'window', 'capsule', 'root', 4],
    [/^\/media\//, 'media', 'window', 'circle', 'nested', -1],
    [/^\/chat(\/|$)/, 'chat', 'window', 'circle', 'root', -1],
    [/^\/account(\/|$)/, 'account', 'window-full', 'circle', 'nested', -1],
    [/^\/invites(\/|$)/, 'invites', 'windowless', 'circle', 'nested', -1],
    [/^\/library\/app\/\d+\/.*achievements/, 'achievements', 'window', 'circle', 'nested', -1],
    [/^\/library\/app\/\d+\/.*properties/, 'properties', 'window', 'circle', 'nested', -1],
    [/^\/library\/app\//, 'app', 'hero', 'circle', 'nested', -1],
    [/^\/app\/\d+\/controllerconfigurator/, 'controller', 'window-full', 'circle', 'nested', -1],
    [/^\/settings(\/|$)/, 'settings', 'window', 'circle', 'nested', -1],
    [/^\/zoo(\/|$)/, 'zoo', 'window', 'capsule', 'nested', -1],
  ];

  let S = null; // live state while installed

  function log(level, msg, data) {
    try {
      const f = S && S.rt && (level === 'error' ? S.rt.error : level === 'warn' ? S.rt.warn : S.rt.log);
      if (typeof f === 'function') { f(msg, data); return; }
    } catch (_) { /* fall through */ }
    try { H.console.log('[lgs shell] ' + msg, data === undefined ? '' : data); } catch (_) { /* none */ }
  }
  function inst() {
    try { return H.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance; } catch (_) { return null; }
  }
  function pathname() {
    try { return inst().m_history.location.pathname || ''; } catch (_) { return ''; }
  }
  function sel(rt, s) { return rt.sel(s); }
  function q(doc, s) { try { return doc.querySelector(s); } catch (_) { return null; } }
  function setAttr(el, name, value) {
    if (!el) return;
    if (value === null || value === undefined || value === false) { if (el.hasAttribute(name)) el.removeAttribute(name); return; }
    const v = String(value);
    if (el.getAttribute(name) !== v) el.setAttribute(name, v);
  }
  function fiberProps(el, key, depth) {
    try {
      const k = Object.keys(el).find((x) => x.startsWith('__reactFiber'));
      let f = k ? el[k] : null;
      for (let i = 0; f && i < (depth || 6); i++, f = f.return) {
        const p = f.memoizedProps;
        if (p && typeof p === 'object' && p[key] !== undefined) return p[key];
      }
    } catch (_) { /* none */ }
    return undefined;
  }
  function call(fn, ...args) {
    try { return fn(...args); } catch (e) { log('warn', 'hook threw', String(e && e.message || e)); return null; }
  }

  // ------------------------------------------------------------------ route map and glass modes
  function mapRoute(path) {
    for (const r of ROUTES) if (r[0].test(path)) return { key: r[1], mode: r[2], search: r[3], back: r[4], section: r[5] };
    return { key: 'other', mode: null, search: 'capsule', back: 'nested', section: -1 };
  }
  function hookMode(key) {
    // '*' wins when it answers (Control Center); then the route's own hook; null = the map's fallback
    for (const k of ['*', key]) {
      const list = S.hooks.get(k);
      if (!list) continue;
      for (const fn of list) {
        const m = call(fn);
        if (MODES.includes(m)) return m;
      }
    }
    return null;
  }
  function footerHasLegends() {
    const m = S.main;
    if (!m) return false;
    const f = q(m.doc, S.footerSel);
    return !!(f && q(f, S.legendSel));
  }
  function applyRoute(reason) {
    const m = S.main;
    if (!m) return;
    const root = q(m.doc, S.rootSel);
    if (!root) return;
    const path = pathname();
    const r = mapRoute(path);
    let mode = hookMode(r.key);
    if (!mode) {
      if (r.key === 'home') mode = 'window-full';
      else if (r.mode) mode = r.mode;
      else mode = S.otherMode && S.otherMode.path === path ? S.otherMode.mode : 'window';
    }
    // PLAN §1.9: the circle variant is gated by WN AT-4 (no SHRUNK); the audit reports the 80 x 80
    // circle as SHRUNK (1128 x 40 -> 80 x 80), so the capsule ships until the flag searchCircle is on
    // (PLAN §1.17 rule: the safe default behind a flag; C1a's log)
    const search = (r.search === 'circle' && !S.rt.flags.enabled('searchCircle')) ? 'capsule' : r.search;
    S.route = { path, key: r.key, mode, search, back: r.back, section: r.section, reason };
    setAttr(root, 'data-lgs-route', r.key);
    setAttr(root, 'data-lgs-glass', mode);
    setAttr(root, 'data-lgs-search', search);
    setAttr(root, 'data-lgs-back', r.back);
    S.root = root;
    // other routes: window if Steam's footer holds legends 300 ms after the route settles, else
    // window-full; fixed until the route changes (WN §3.1.1)
    if (r.key === 'other' && !(S.otherMode && S.otherMode.path === path) && !hookMode(r.key)) {
      const forPath = path;
      S.rt.setTimeout(() => {
        if (!S || pathname() !== forPath) return;
        S.otherMode = { path: forPath, mode: footerHasLegends() ? 'window' : 'window-full' };
        applyRoute('other-settle');
      }, 300);
    }
    applyTitle();
    applyOrnament();
    applyToolbarPlates();
    holdHeader();
    const back = q(m.doc, S.backSel);
    if (back && back.hasAttribute('data-lgs-reveal')) reveal(back, false);
    wireReveal();
  }

  // ------------------------------------------------------------------ Large Title, Back (E-BACK)
  function sectionName(index) {
    if (index < 0) return null;
    try {
      for (const e of S.rt.windows.byKind('frame.menu') || []) {
        const items = e.doc.querySelectorAll('[role="menuitem"]');
        const it = items[index];
        const t = it && (it.getAttribute('aria-label') || it.textContent || '').trim();
        if (t) return t;
      }
    } catch (_) { /* none */ }
    return null;
  }
  function applyTitle() {
    const m = S.main;
    if (!m) return;
    const header = q(m.doc, '#header');
    let text = null;
    if (S.route && S.route.key !== 'search') {
      const own = q(m.doc, '[data-lgs-title]');
      text = own ? own.getAttribute('data-lgs-title') : sectionName(S.route.section);
    }
    let node = header ? q(header, ':scope > .lgs-title') : null;
    if (!text || !header) { if (node) node.remove(); return; }
    if (!node) {
      node = m.doc.createElement('div');
      node.className = 'lgs-title';
      node.setAttribute('aria-hidden', 'true');
      header.appendChild(node);
    }
    if (node.textContent !== text) node.textContent = text;
  }
  function applyBack() {
    const m = S.main;
    if (!m) return;
    const back = q(m.doc, S.backSel);
    if (!back) return;
    if (back.getAttribute('data-lgs-exempt') === 'E-BACK') return;
    const label = q(back, S.backLabelSel);
    const text = label ? (label.textContent || '').trim() : '';
    if (!text) return;
    if (!S.backAria.has(back)) S.backAria.set(back, back.hasAttribute('aria-label') ? back.getAttribute('aria-label') : null);
    back.setAttribute('aria-label', text);
    back.setAttribute('data-lgs-exempt', 'E-BACK');
  }

  // ------------------------------------------------------------------ Back reveal (WN §3.2)
  // After 0.6 s of attention on Back (laser dwell or gamepad focus, P3's rt.attend), the circle grows into a
  // capsule naming the page Steam's NavigateBack returns to: the previous history entry's section name from
  // the route map (Steam's own frame-menu label, PLAN §1.15). Without a title it does not grow. The text is
  // a decorative T2 child (aria-hidden); Back's aria-label stays Steam's own "Back" (E-BACK).
  const SECTION_OF_KEY = { home: 0, library: 1, chat: 3, media: 4, downloads: 5 };
  // Steam's main history is a browser history (no entries list), so the shell keeps its own stack of the
  // paths seen since it installed: PUSH adds, REPLACE swaps the top, POP to the previous path drops the top;
  // any other POP (forward, a jump) restarts the stack, so an unknown previous page gives no title.
  function trackHistory(loc, action) {
    const p = (loc && loc.pathname) || pathname();
    const st = S.stack;
    if (action === 'PUSH') st.push(p);
    else if (action === 'REPLACE') st[st.length - 1] = p;
    else if (st.length > 1 && st[st.length - 2] === p) st.pop();
    else if (st[st.length - 1] !== p) S.stack = [p];
    if (S.stack.length > 64) S.stack.splice(0, S.stack.length - 64);
  }
  function previousTitle() {
    try {
      const st = S.stack;
      const prev = st.length > 1 ? st[st.length - 2] : null;
      if (!prev) return null;
      const r = mapRoute(prev);
      const i = SECTION_OF_KEY[r.key];
      return i === undefined ? null : sectionName(i);
    } catch (_) { return null; }
  }
  function reveal(back, on) {
    if (!S || !back || !back.isConnected) return;
    let span = q(back, ':scope > .lgs-back-reveal');
    const text = on ? previousTitle() : null;
    const header = back.closest('#header');
    if (!text) {
      const w0 = back.hasAttribute('data-lgs-reveal') ? back.getBoundingClientRect().width : 0;
      back.removeAttribute('data-lgs-reveal');
      if (header) header.removeAttribute('data-lgs-reveal');
      if (w0) collapseBack(back, w0);
      return;
    }
    if (S.unreveal) endUnreveal();
    if (!span) {
      span = back.ownerDocument.createElement('span');
      span.className = 'lgs-back-reveal';
      span.setAttribute('aria-hidden', 'true');
      back.appendChild(span);
    }
    if (span.textContent !== text) span.textContent = text;
    back.setAttribute('data-lgs-reveal', '');
    if (header) header.setAttribute('data-lgs-reveal', '');
  }
  // leaving the reveal (WN §7 "Back reveal": width on `snappy`): the label is gone at once (content before
  // glass) and the capsule's glass slides back into the circle; on section roots, whose Back has no fill
  // at rest, the circle then fades (data-lgs-unreveal keeps the fill meanwhile, 20-shell.css §2). Forwards
  // fill, cancelled in the same task as the attribute goes, so no frame shows the rest state early.
  function collapseBack(back, w0) {
    if (S.unreveal) endUnreveal();
    const w1 = back.getBoundingClientRect().width;
    const M = S.rt.shared && S.rt.shared.motion;
    const win = back.ownerDocument.defaultView;
    if (!(w0 - w1 > 2) || typeof back.animate !== 'function' || !M || typeof M.timing !== 'function'
      || (typeof M.reduced === 'function' && M.reduced(win))) return;
    const t = M.timing('snappy', {});
    // a borderless section-root Back (no fill at rest; windowless routes keep their plate)
    const root = !!(S.root && S.root.getAttribute('data-lgs-back') === 'root' && S.root.getAttribute('data-lgs-glass') !== 'windowless');
    const from = (10 - (w0 - w1)) + 'px';
    const kf = root
      ? [{ right: from, opacity: 1 }, { right: '10px', opacity: 1, offset: 0.7 }, { right: '10px', opacity: 0 }]
      : [{ right: from }, { right: '10px' }];
    back.setAttribute('data-lgs-unreveal', '');
    let anim = null;
    try { anim = back.animate(kf, { duration: t.duration, easing: t.easing, fill: 'forwards', pseudoElement: '::before' }); } catch (_) { anim = null; }
    if (!anim) { back.removeAttribute('data-lgs-unreveal'); return; }
    const rec = S.unreveal = { back, anim };
    anim.finished.then(() => { if (S && S.unreveal === rec) endUnreveal(); }, () => { /* cancelled */ });
  }
  function endUnreveal() {
    const u = S.unreveal;
    S.unreveal = null;
    if (!u) return;
    try { u.back.removeAttribute('data-lgs-unreveal'); } catch (_) { /* gone */ }
    try { u.anim.cancel(); } catch (_) { /* gone */ }
  }
  // P3's attention can be removed and installed again while the shell stays (its flag wp.p3 is P3's own,
  // and the shell does not depend on it): its registrations then go with the old instance. Each install
  // publishes a new rt.attention object, so a registration is renewed whenever that object changed
  // (checked on every route change and footer/header update; cheap).
  function wireReveal() {
    if (!S) return;
    const att = S.rt.attention || null;
    if (S.revealReg && S.revealAtt === att) return;
    if (S.revealReg) { try { S.revealReg.off(); } catch (_) { /* gone with its instance */ } S.revealReg = null; }
    S.revealAtt = null;
    if (typeof S.rt.attend !== 'function' || !att) return;
    try {
      S.revealReg = S.rt.attend(S.backSel, {
        dwellMs: 600, surfaces: ['main'], classes: false,
        onDwell(el) { reveal(el.closest('[data-lgs-exempt]') || el, true); },
        onLeave(el) { reveal(el.closest('[data-lgs-exempt]') || el, false); },
      });
      S.revealAtt = att;
      S.revealWires = (S.revealWires || 0) + 1;
    } catch (e) { log('warn', 'back reveal', String(e && e.message || e)); }
  }

  // ------------------------------------------------------------------ Options member (WN §3.4.2 slot 2, §3.4.3)
  // A T2 member [data-lgs-btn="MENU"][data-lgs-t2] in #Footer, with Steam's own legend classes, placed
  // before the quiet A/B members. Shown in laser mode on routes whose page holds a registered More host,
  // and on fixed-slot routes in both modes; it steps aside whenever Steam renders its own ≡ legend.
  // Disabled (aria-disabled, .38, no dispatch) without a target, while main holds a modal or menu, and in
  // gamepad mode (Steam's ≡ is absent there, so there is nothing to act on). It dispatches like the More
  // circle (__LGS_RT.more.dispatch: the target's onMenuButton, else vgp_onmenu). Its label is Steam's own
  // Options string (PLAN §1.15); in laser mode off fixed slots a decorative " · <target name>" follows.
  function vrMode() {
    try { const v = RT.input && RT.input.vrMode; if (v === 'laser' || v === 'gamepad') return v; } catch (_) { /* P3 off */ }
    const a = S.main && S.main.html.getAttribute('data-lgs-vr-mode');
    return a === 'laser' ? 'laser' : 'gamepad';
  }
  function modalUp(doc) {
    try {
      const mm = inst() && inst().m_ModalManager;
      if (mm && Array.isArray(mm.m_rgModals)) return mm.m_rgModals.length > 0 || !!q(doc, '.BasicUIContextMenu');
    } catch (_) { /* fall back to the DOM */ }
    return !!q(doc, '.BasicUIContextMenu, .ModalOverlayContent.active');
  }
  function optionsText(tgt) {
    // the target's own description for its ≡ action: exactly what Steam's legend would say for it
    const own = tgt ? fiberProps(tgt, 'onMenuActionDescription', 14) : undefined;
    if (typeof own === 'string' && own.trim()) return own.trim();
    if (S.optText) return S.optText;
    try {
      const ui = RT.react && RT.react.ui;
      if (ui && typeof ui.loc === 'function') {
        for (const t of OPT_TOKENS) { const v = ui.loc(t); if (v) return (S.optText = v); }
        if (typeof ui.text === 'function') return ui.text(OPT_TOKENS[0], 'Options');
      }
    } catch (_) { /* no react module */ }
    try { if (/^en/i.test(H.navigator.language || '')) return 'Options'; } catch (_) { /* none */ }
    return null;
  }
  function targetName(el) {
    if (!el) return '';
    const own = el.getAttribute('aria-label');
    if (own && own.trim()) return own.trim();
    const img = q(el, 'img[alt]');
    if (img && img.alt && img.alt.trim()) return img.alt.trim();
    const t = (el.innerText || '').split('\n').map((x) => x.trim()).find((x) => x.length > 1) || '';
    return t.length > 40 ? t.slice(0, 39) + '…' : t;
  }
  function applyOptions(footer, steam) {
    const doc = S.main.doc;
    let node = q(footer, '.lgs-opt');
    const steamMenu = steam.find((el) => el.getAttribute('data-lgs-btn') === 'MENU');
    if (steamMenu) {
      // Steam's own ≡ legend: remember its string, and step aside
      const lab = q(steamMenu, S.labelSel);
      const t = lab && (lab.textContent || '').trim();
      if (t) S.optText = t;
    }
    const key = S.route && S.route.key;
    const fixed = !!(key && S.slots.get(key));
    const laser = vrMode() === 'laser';
    let hosts = false;
    try { hosts = !!(RT.more && typeof RT.more.hostsIn === 'function' && RT.more.hostsIn(doc)); } catch (_) { hosts = false; }
    const tgt = S.target && S.target.isConnected && S.target.ownerDocument === doc ? S.target : null;
    const text = (!steamMenu && steam.length && (fixed || (laser && hosts))) ? optionsText(tgt) : null;
    if (!text) { if (node) node.remove(); S.opt = null; return; }
    if (!node) {
      const proto = steam[0], plab = q(proto, S.labelSel);
      node = doc.createElement('div');
      node.className = proto.className + ' lgs-opt';
      node.setAttribute('data-lgs-btn', 'MENU');
      node.setAttribute('data-lgs-t2', '');
      node.setAttribute('role', 'button');
      const lab = doc.createElement('div');
      lab.className = (plab ? plab.className + ' ' : '') + 'lgs-opt-label';
      const main = doc.createElement('span');
      const suffix = doc.createElement('span');
      suffix.className = 'lgs-opt-name';
      suffix.setAttribute('aria-hidden', 'true');
      lab.append(main, suffix);
      // the leading ⋯ glyph of the laser look (the More circle's glyph; hidden in gamepad mode by CSS)
      const NS = 'http://www.w3.org/2000/svg';
      const svg = doc.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 26 26');
      svg.setAttribute('class', 'lgs-opt-glyph');
      svg.setAttribute('aria-hidden', 'true');
      for (const cx of [5, 13, 21]) {
        const c = doc.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(cx)); c.setAttribute('cy', '13'); c.setAttribute('r', '2.4');
        svg.appendChild(c);
      }
      node.append(svg, lab);
      const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      for (const t of ['pointerdown', 'mousedown', 'mouseup', 'pointerup']) S.rt.listen(node, t, stop, { capture: true });
      S.rt.listen(node, 'click', (ev) => { stop(ev); optionsActivate(node); }, { capture: true });
    }
    const disabled = !laser || !tgt || modalUp(doc);
    const name = laser && !fixed && tgt ? targetName(tgt) : '';
    const lab = q(node, '.lgs-opt-label');
    if (lab.firstChild.textContent !== text) lab.firstChild.textContent = text;
    const sfx = name ? '· ' + name : '';
    if (lab.lastChild.textContent !== sfx) lab.lastChild.textContent = sfx;
    setAttr(node, 'aria-label', text);
    setAttr(node, 'aria-disabled', disabled ? 'true' : null);
    // place it before the first quiet member (A, B), else after the last legend
    const firstQuiet = steam.find((el) => QUIET.has(el.getAttribute('data-lgs-btn')));
    const last = steam[steam.length - 1];
    const parent = (firstQuiet || last).parentElement;
    const before = firstQuiet || last.nextSibling;
    const placed = node.parentElement === parent && (before ? node.nextSibling === before : parent.lastChild === node);
    if (!placed && before !== node) parent.insertBefore(node, before || null);
    S.opt = { text, disabled, name, fixed, laser, hosts };
  }
  function optionsActivate(node) {
    const doc = S && S.main && S.main.doc;
    if (!doc || node.getAttribute('aria-disabled') === 'true') return false;
    const tgt = S.target;
    if (!tgt || !tgt.isConnected || modalUp(doc)) return false;
    try { if (RT.more && typeof RT.more.dispatch === 'function') return !!RT.more.dispatch(tgt, { source: node }); } catch (e) { log('warn', 'options dispatch', String(e && e.message || e)); }
    return false;
  }

  function setTarget(el) {
    if (!S || S.target === (el || null)) return;
    S.target = el || null;
    for (const fn of S.targetFns) call(fn, S.target);
    schedule();
  }

  // ------------------------------------------------------------------ ornament (#Footer)
  function applyOrnament() {
    const m = S.main;
    if (!m) return;
    const footer = q(m.doc, S.footerSel);
    S.footer = footer;
    if (!footer) return;
    const steam = Array.from(footer.querySelectorAll(S.legendSel)).filter((el) => !el.hasAttribute('data-lgs-t2'));
    for (const el of steam) {
      const rg = fiberProps(el, 'rgButtons', 4);
      const n = Array.isArray(rg) && rg.length ? rg[0] : null;
      setAttr(el, 'data-lgs-btn', n === null ? null : (BTN[n] || ('B' + n)));
      applyGlyph(q(el, S.glyphSel));
    }
    applyOptions(footer, steam);
    const legends = Array.from(footer.querySelectorAll(S.legendSel));
    const quiet = legends.length > 0 && legends.every((el) => !el.hasAttribute('data-lgs-t2') && QUIET.has(el.getAttribute('data-lgs-btn')));
    setAttr(footer, 'data-lgs-orn', legends.length ? (quiet ? 'quiet' : 'capsule') : null);
    applyOrnPlate(footer, legends.length ? (quiet ? 'quiet' : 'capsule') : null);
    morphOrnament(footer, legends.length ? (quiet ? 'quiet' : 'capsule') : null);
    // flag quietBacking: "off" shows PLAN §1.10's bare quiet labels in the margin
    const qb = S.rt.flags.get('quietBacking');
    setAttr(footer, 'data-lgs-band', (qb === 'off' || qb === false) ? 'off' : null);
    // fixed slots registered for this route
    const key = S.route && S.route.key;
    const slots = key ? S.slots.get(key) : null;
    if (slots) {
      const w = slots.widths.reduce((a, b) => a + b, 0) + slots.gap * (slots.widths.length - 1) + 2 * slots.padding;
      const x = Math.round((footer.clientWidth || 1280) / 2 - w / 2);
      setAttr(footer, 'data-lgs-orn-fixed', key);
      footer.style.setProperty('--lgs-orn-x', x + 'px');
      footer.style.setProperty('--lgs-orn-w', w + 'px');
    } else if (footer.hasAttribute('data-lgs-orn-fixed')) {
      footer.removeAttribute('data-lgs-orn-fixed');
      footer.style.removeProperty('--lgs-orn-x');
      footer.style.removeProperty('--lgs-orn-w');
    }
    // compact members instead of passing 960 px (PLAN §1.10); measured in the regular style
    if (legends.length && !slots) {
      const had = footer.hasAttribute('data-lgs-orn-compact');
      if (had) footer.removeAttribute('data-lgs-orn-compact');
      const a = legends[0].getBoundingClientRect(), b = legends[legends.length - 1].getBoundingClientRect();
      const width = b.right - a.left + 20; // the capsule: 10 px outside the abutting hit boxes
      setAttr(footer, 'data-lgs-orn-compact', width > 960 ? '' : null);
    } else if (footer.hasAttribute('data-lgs-orn-compact')) footer.removeAttribute('data-lgs-orn-compact');
  }
  // the glyph badge (20-shell.css §3): the image's own URL as a mask source, so CSS can light only the
  // letter Steam's glyph cuts out of its disc (whatever glyph set the controller has)
  function applyGlyph(img) {
    if (!img) return;
    const src = img.src || '';
    const v = src ? 'url("' + src.replace(/["\\\n]/g, encodeURIComponent) + '")' : '';
    if (v && img.style.getPropertyValue('--lgs-c1a-glyph') !== v) img.style.setProperty('--lgs-c1a-glyph', v);
    setAttr(img, 'data-lgs-glyph', v ? '' : null);
  }
  // WN §7 "Ornament legend change" and "Ornament capsule <-> quiet legend". The labels never move by
  // animation (they take their new places at once); only the backing does.
  // (1) A width change of the capsule: its glass (::after) and its E3 edge (::before, P4's hook) slide
  //     their ends from the old rect to the new one on `snappy`. The ends are our own absolutely placed
  //     pseudo-elements (nothing of Steam's is laid out again), so the capsule keeps its radius and its
  //     shadow all the way (a scale FLIP stretched the round ends; a clip cut the shadow). Web Animations
  //     with no fill: when it ends, the CSS anchors give the same rect (MO R11, nothing stays applied).
  // (2) capsule -> quiet: the capsule's glass dematerializes at its old rect (#Footer[data-lgs-orn-leave]
  //     ::before, P5's lgs-mat-glass-out, 350 ms) while the quiet band fades in (CSS); quiet -> capsule:
  //     lgs-mat-glass-in on ::after (CSS). Reduce Motion: no slide (the rect changes at once, P-56); P5's
  //     keyframes are fades there.
  function morphOrnament(footer, look) {
    const plate = footer.querySelector(':scope > .lgs-orn-plate');
    let box = null;
    if (look === 'capsule' && plate) {
      const p = plate.getBoundingClientRect(), f = footer.getBoundingClientRect();
      if (p.width > 0) box = { l: p.left - f.left, r: f.right - p.right, w: p.width };
    }
    const same = S.ornFooter === footer;
    const prev = same ? S.ornBox : null;
    const prevLook = same ? S.ornLook : null;
    S.ornFooter = footer;
    S.ornBox = box;
    S.ornLook = look;
    S.ornW = box ? box.w : 0;
    if (prevLook === 'capsule' && look === 'quiet' && prev) leaveGhost(footer, prev);
    if (!box || !prev || (Math.abs(box.l - prev.l) < 2 && Math.abs(box.r - prev.r) < 2) || typeof footer.animate !== 'function') return;
    const M = S.rt.shared && S.rt.shared.motion;
    if (!M || typeof M.timing !== 'function') return;
    const win = footer.ownerDocument.defaultView;
    if (typeof M.reduced === 'function' && M.reduced(win)) return;
    const t = M.timing('snappy', {});
    const kf = [{ left: prev.l + 'px', right: prev.r + 'px' }, { left: box.l + 'px', right: box.r + 'px' }];
    for (const a of S.ornAnims || []) { try { a.cancel(); } catch (_) { /* gone */ } }
    S.ornAnims = [];
    for (const pe of ['::after', '::before']) {
      try { S.ornAnims.push(footer.animate(kf, { duration: t.duration, easing: t.easing, pseudoElement: pe })); }
      catch (_) { /* no pseudo-element animations */ }
    }
    S.ornMorphs = (S.ornMorphs || 0) + 1;
  }
  // the capsule's glass leaving: a ghost of it on ::before at its old rect for the length of
  // lgs-mat-glass-out (its rest state is opacity 0, so taking the attribute away later changes nothing)
  function leaveGhost(footer, prev) {
    footer.style.setProperty('--lgs-orn-gl', prev.l + 'px');
    footer.style.setProperty('--lgs-orn-gr', prev.r + 'px');
    footer.removeAttribute('data-lgs-orn-leave');
    void footer.offsetWidth; // restart the CSS animation if a leave is still running
    footer.setAttribute('data-lgs-orn-leave', '');
    const token = S.ornLeave = {};
    let tries = 0;
    // the ghost goes once its dematerialize has ended (checked, not timed: a paused or slowed clock, as in
    // the lab's filmstrips, keeps it until it is really done); at most about 10 s
    const done = () => {
      if (!S || S.ornLeave !== token) return;
      let pending = false;
      try {
        pending = footer.isConnected && footer.getAnimations({ subtree: true }).some((a) => a.animationName === 'lgs-mat-glass-out'
          && a.effect && a.effect.pseudoElement === '::before' && a.playState !== 'finished');
      } catch (_) { pending = false; }
      if (pending && ++tries < 40) { S.rt.setTimeout(done, 250); return; }
      S.ornLeave = null;
      footer.removeAttribute('data-lgs-orn-leave');
      footer.style.removeProperty('--lgs-orn-gl');
      footer.style.removeProperty('--lgs-orn-gr');
    };
    S.rt.setTimeout(done, 450);
    S.ornLeaves = (S.ornLeaves || 0) + 1;
  }
  function schedule() {
    if (!S || S.pending) return;
    S.pending = true;
    H.requestAnimationFrame(() => {
      if (!S) return;
      S.pending = false;
      try { applyBack(); applyTitle(); applyOrnament(); applyToolbarPlates(); wireReveal(); } catch (e) { log('warn', 'update failed', String(e && e.message || e)); }
    });
  }

  // ------------------------------------------------------------------ native glass (PLAN §1.6, §1.7)
  // The bottom ornament is a liquid plate, never a pop (reporter §2.1, §3.5): a T2 node at the capsule's
  // rect (20-shell.css §3b, the same anchors as #Footer::after) carries data-lgs-nopop in both looks (admission
  // rule 1: no pop over the ornament) and data-lgs-plate only as a capsule (the quiet legend has no material).
  function applyOrnPlate(footer, look) {
    let p = footer.querySelector(':scope > .lgs-orn-plate');
    if (!look) { if (p) p.remove(); return; }
    if (!p) {
      p = footer.ownerDocument.createElement('div');
      p.className = 'lgs-orn-plate';
      p.setAttribute('aria-hidden', 'true');
      p.setAttribute('data-lgs-nopop', '');
      p.setAttribute('data-lgs-plate-id', 'shell-ornament');
      p.setAttribute('data-lgs-plate-r', 'capsule');
      footer.appendChild(p);
    }
    setAttr(p, 'data-lgs-plate', look === 'capsule' ? 'liquid' : null);
  }
  // windowless routes have no window cover, so the toolbar row's glass is two liquid plates (REQ C2a->C1a #2,
  // reporter §2.2): Back (80 box, 60 circle: inset 10) and the search field (536 x 80 box, 520 x 64 capsule:
  // inset 8; the circle variant: inset 10). Off every other route.
  const PLATE_ATTRS = ['data-lgs-plate', 'data-lgs-plate-id', 'data-lgs-plate-inset', 'data-lgs-plate-r'];
  function clearPlate(el) { for (const a of PLATE_ATTRS) if (el.hasAttribute(a)) el.removeAttribute(a); }
  function applyToolbarPlates() {
    const m = S.main;
    if (!m) return;
    const on = !!(S.route && S.route.mode === 'windowless');
    const want = [
      ['shell-back', q(m.doc, S.backSel), 10],
      ['shell-search', q(m.doc, S.searchSel), S.route && S.route.search === 'circle' ? 10 : 8],
    ];
    for (const [id, el, inset] of want) {
      for (const o of m.doc.querySelectorAll('[data-lgs-plate-id="' + id + '"]')) if (!on || o !== el) clearPlate(o);
      if (!on || !el) continue;
      setAttr(el, 'data-lgs-plate', 'liquid');
      setAttr(el, 'data-lgs-plate-id', id);
      setAttr(el, 'data-lgs-plate-inset', String(inset));
      setAttr(el, 'data-lgs-plate-r', 'capsule');
    }
  }
  // the frame menu's cover is its two capsules, not its box (the box also holds the gap between them and
  // the band under the bar): two T2 nodes at the capsules' rects (20-shell.css §4) are the cover elements of
  // theme/layers/20-shell.json. They paint nothing and take no input.
  function ensureTabCaps(doc) {
    const menu = q(doc, S.tabMenuSel);
    if (!menu) return;
    for (const g of ['1', '2']) {
      if (menu.querySelector(':scope > .lgs-tabcap[data-lgs-tabcap="' + g + '"]')) continue;
      const n = doc.createElement('div');
      n.className = 'lgs-tabcap';
      n.setAttribute('data-lgs-tabcap', g);
      n.setAttribute('aria-hidden', 'true');
      menu.appendChild(n);
    }
  }

  // ------------------------------------------------------------------ CQ1 header (WN §3.2)
  // CQ1 (WN §3.2, AT-2): Steam's header height is a constant (HeaderHeightVisible 40px) that JS consumers
  // read from the window's HeaderStore (m_flCurrentHeaderHeight, module 1282's hook) and CSS from
  // --basicui-header-height. The 108 px row needs both: the CSS variable (20-shell.css under
  // html.lgs-hdr-try / lgs-hdr-108, !important over Steam's inline value) and the store write (T3, in memory,
  // restored on removal). Tried only with the flag hdr108; kept as lgs-hdr-108 only if the variable and
  // Steam's own #header box both read 108, else both writes are reverted and lgs-hdr-40 is set.
  function headerStore() {
    try { return inst().m_HeaderStore || null; } catch (_) { return null; }
  }
  function restoreHeaderStore() {
    if (!S || !S.hdrSaved) return;
    const hs = headerStore();
    try { if (hs && hs.m_flCurrentHeaderHeight === 108) hs.m_flCurrentHeaderHeight = S.hdrSaved.value; } catch (_) { /* gone */ }
    S.hdrSaved = null;
  }
  function applyHeader() {
    const m = S.main;
    if (!m) return;
    const html = m.html;
    const want108 = S.rt.flags.enabled('hdr108');
    html.classList.remove('lgs-hdr-108', 'lgs-hdr-40', 'lgs-hdr-try');
    if (!want108) {
      restoreHeaderStore();
      html.classList.add('lgs-hdr-40');
      S.hdr = { cls: 'lgs-hdr-40', tried: false };
      return;
    }
    const hs = headerStore();
    if (hs && !S.hdrSaved) S.hdrSaved = { value: hs.m_flCurrentHeaderHeight };
    try { if (hs) hs.m_flCurrentHeaderHeight = 108; } catch (e) { log('warn', 'HeaderStore write', String(e && e.message || e)); }
    html.classList.add('lgs-hdr-try');
    H.requestAnimationFrame(() => H.requestAnimationFrame(() => {
      if (!S) return;
      const root = q(m.doc, S.rootSel), header = q(m.doc, '#header');
      const v = root ? getComputedStyle(root).getPropertyValue('--basicui-header-height').trim() : '';
      const h = header ? Math.round(header.getBoundingClientRect().height) : 0;
      const store = hs ? hs.m_flCurrentHeaderHeight : null;
      const ok = v === '108px' && h === 108 && store === 108;
      html.classList.remove('lgs-hdr-try');
      html.classList.add(ok ? 'lgs-hdr-108' : 'lgs-hdr-40');
      if (!ok) restoreHeaderStore();
      S.hdr = { cls: ok ? 'lgs-hdr-108' : 'lgs-hdr-40', tried: true, variable: v, headerHeight: h, store, saved: S.hdrSaved ? S.hdrSaved.value : null };
      log('log', 'CQ1 header', S.hdr);
    }));
  }
  // Steam may write the store again (route changes, header show/hide); while lgs-hdr-108 holds, keep 108
  function holdHeader() {
    if (!S || !S.main || !S.main.html.classList.contains('lgs-hdr-108')) return;
    const hs = headerStore();
    try { if (hs && hs.m_flCurrentHeaderHeight !== 108) { hs.m_flCurrentHeaderHeight = 108; S.hdrRewrites = (S.hdrRewrites || 0) + 1; } } catch (_) { /* gone */ }
  }

  // ------------------------------------------------------------------ tab bar (frame.menu, WN §3.3.2)
  // The pitch p (popup px) from the live window size: P8's `geom` bridge value (Hm, the main panel's
  // world height; frameMenu.mpMm, the frame menu's measured mm per popup px) and n, the number of items.
  // Written as --lgs-tab-pitch / --lgs-tab-place on the frame-menu document's root (20-shell.css §4).
  function tabRule(geom, n) {
    const fm = geom && geom.frameMenu;
    if (!fm || !(fm.mpMm > 0) || !(geom.Hm > 0) || !(n > 0)) return null;
    const Hm = geom.Hm * 1000, mp = fm.mpMm;
    const G = 656 * Hm / 720 / mp, P = Hm / mp;
    const H = (p) => n * p + 44;
    const base = { n, G: Math.round(G * 10) / 10, P: Math.round(P * 10) / 10, mp, r: geom.r };
    // rule 1: fits the glass at >= 60: centre it on the glass
    for (const p of [66, 64, 62, 60]) {
      if (H(p) <= G - 24) return Object.assign(base, { p, rule: 1, place: Math.round(64 * (Hm / 720) / mp), H: H(p) });
    }
    // rule 2: the largest even pitch in [52, 66] inside the panel, centred on the panel (Steam's anchor)
    for (let p = 66; p >= 52; p -= 2) if (H(p) <= P - 12) return Object.assign(base, { p, rule: 2, place: 0, H: H(p) });
    // rule 3: the floor; overhangs the panel by (H - P) / 2 at each end
    return Object.assign(base, { p: 52, rule: 3, place: 0, H: H(52) });
  }
  // Expanded, Steam leaves the tab bar's width `auto`, which Chromium 126 does not interpolate: it jumped
  // open in one frame. The width its labels need is measured on a hidden copy (expanded, at auto, never
  // Steam's own element) and written as --lgs-c1a-tab-wx on the frame-menu root (20-shell.css §4), so
  // Steam's width transition runs. Measured when the items or the pitch change, and once the font is in
  // (while the bar is collapsed: applyTabWidth).
  function tabWidth(e) {
    const menu = q(e.doc, S.tabMenuSel);
    if (!menu || !menu.parentElement) return 0;
    const ghost = menu.cloneNode(true);
    for (const c of S.tabCollapsedSel.split('.').filter(Boolean)) ghost.classList.remove(c);
    ghost.removeAttribute('id');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.cssText = 'position:absolute;left:0;top:0;width:auto;visibility:hidden;pointer-events:none;transition:none;';
    let w = 0;
    try {
      menu.parentElement.appendChild(ghost);
      w = ghost.getBoundingClientRect().width;
    } finally {
      ghost.remove();
    }
    return w > 0 ? Math.ceil(w) : 0;
  }
  function applyTabWidth(e) {
    const st = e.html.style;
    // measured while collapsed: open, Steam's label marquees add content and the copy comes out wider
    // than the labels' own width, so the open bar would creep wider after it opened
    const menu = q(e.doc, S.tabMenuSel);
    if (menu && !menu.matches(S.tabCollapsedSel) && st.getPropertyValue('--lgs-c1a-tab-wx')) return;
    let w = 0;
    try { w = tabWidth(e); } catch (_) { /* closed */ }
    if (w > 0) { if (st.getPropertyValue('--lgs-c1a-tab-wx') !== w + 'px') st.setProperty('--lgs-c1a-tab-wx', w + 'px'); }
    else st.removeProperty('--lgs-c1a-tab-wx');
  }
  function applyTabBar() {
    if (!S) return;
    const geom = S.rt.bridge && S.rt.bridge.get('geom');
    for (const e of S.menus) {
      try { ensureTabCaps(e.doc); } catch (_) { /* closed */ }
      applyTabWidth(e);
      const n = e.doc.querySelectorAll(S.tabItemSel).length;
      const t = tabRule(geom, n);
      const st = e.html.style;
      if (!t) { st.removeProperty('--lgs-tab-pitch'); st.removeProperty('--lgs-tab-place'); S.tab = { n, rule: null }; continue; }
      if (st.getPropertyValue('--lgs-tab-pitch') !== t.p + 'px') st.setProperty('--lgs-tab-pitch', t.p + 'px');
      if (st.getPropertyValue('--lgs-tab-place') !== t.place + 'px') st.setProperty('--lgs-tab-place', t.place + 'px');
      S.tab = t;
    }
  }
  // the tab bar recedes while main holds an alert or sheet (C1c's html.lgs-modal, WN §3.3.4)
  function mirrorModal() {
    if (!S || !S.main) return;
    const on = S.main.html.classList.contains('lgs-modal');
    for (const e of S.menus) e.html.classList.toggle('lgs-modal', on);
  }
  function attachMenu(entry) {
    S.menus.add(entry);
    const mo = new H.MutationObserver(() => applyTabBar());
    const menu = q(entry.doc, S.tabMenuSel);
    if (menu) mo.observe(menu, { childList: true });
    applyTabBar();
    mirrorModal();
    // the label font may load after the first measure
    S.rt.setTimeout(() => { if (S && S.menus.has(entry)) applyTabWidth(entry); }, 1500);
    return () => {
      mo.disconnect();
      if (!S) return;
      S.menus.delete(entry);
    };
  }
  function teardownMenus() {
    for (const e of S.menus) {
      try {
        e.html.style.removeProperty('--lgs-tab-pitch');
        e.html.style.removeProperty('--lgs-tab-place');
        e.html.style.removeProperty('--lgs-c1a-tab-wx');
        e.html.classList.remove('lgs-modal');
        for (const n of e.doc.querySelectorAll('.lgs-tabcap')) n.remove();
      } catch (_) { /* closed */ }
    }
  }

  // ------------------------------------------------------------------ main window wiring
  function attachMain(entry) {
    S.main = entry;
    const doc = entry.doc;
    applyHeader();
    // route changes: Steam's own history of the main window
    try {
      // a route change also clears the frozen target (WN §3.4.3 item 5)
      S.stack = [pathname()];
      const un = inst().m_history.listen((loc, action) => {
        if (!S) return;
        try { trackHistory(loc, action); } catch (_) { /* keep going */ }
        S.otherMode = null; setTarget(null); S.rt.setTimeout(() => S && applyRoute('history'), 0);
      });
      S.rt.cleanup(() => { try { un(); } catch (_) { /* gone */ } });
    } catch (e) { log('warn', 'no history listener', String(e && e.message || e)); }
    // footer and header re-renders (focus changes the legends). Narrow observers only: the split's
    // and the window root's direct children (footer and header mount/unmount), the footer's subtree
    // and the header's direct children, never the page content.
    const fo = new H.MutationObserver(schedule);
    const ho = new H.MutationObserver(schedule);
    let fEl = null, hEl = null;
    const rewire = () => {
      if (!S) return;
      const f = q(doc, S.footerSel), h = q(doc, '#header');
      if (f !== fEl) { fo.disconnect(); fEl = f; if (f) fo.observe(f, { childList: true, subtree: true, characterData: true }); }
      if (h !== hEl) { ho.disconnect(); hEl = h; if (h) ho.observe(h, { childList: true }); }
      schedule();
    };
    const so = new H.MutationObserver(rewire);
    const split = q(doc, S.splitSel);
    if (split) so.observe(split, { childList: true });
    const home = split && split.firstElementChild;
    if (home) so.observe(home, { childList: true });
    // C1c's html.lgs-modal on main: mirrored onto the frame menu (the tab bar recedes)
    // and the input-mode signals (the Options member follows data-lgs-vr-mode)
    const mo = new H.MutationObserver(() => { mirrorModal(); schedule(); });
    mo.observe(entry.html, { attributes: true, attributeFilter: ['class', 'data-lgs-vr-mode'] });
    S.rt.cleanup(() => { so.disconnect(); fo.disconnect(); ho.disconnect(); mo.disconnect(); });
    rewire();
    applyRoute('install');
    wireReveal();
    applyBack();
    return () => { if (S && S.main === entry) S.main = null; };
  }

  function teardownDom() {
    const m = S && S.main;
    if (!m) return;
    const doc = m.doc;
    m.html.classList.remove('lgs-hdr-108', 'lgs-hdr-40', 'lgs-hdr-try');
    restoreHeaderStore();
    const root = q(doc, S.rootSel);
    if (root) for (const a of ['data-lgs-glass', 'data-lgs-route', 'data-lgs-search', 'data-lgs-back']) root.removeAttribute(a);
    const t = q(doc, '#header > .lgs-title');
    if (t) t.remove();
    for (const [el, prev] of S.backAria) {
      try {
        el.removeAttribute('data-lgs-exempt');
        if (prev === null) el.removeAttribute('aria-label'); else el.setAttribute('aria-label', prev);
      } catch (_) { /* gone */ }
    }
    S.backAria.clear();
    for (const n of doc.querySelectorAll('#Footer .lgs-opt, #header .lgs-back-reveal, #Footer > .lgs-orn-plate')) n.remove();
    for (const n of doc.querySelectorAll('[data-lgs-plate-id="shell-back"], [data-lgs-plate-id="shell-search"]')) clearPlate(n);
    for (const n of doc.querySelectorAll('#header[data-lgs-reveal], #header [data-lgs-reveal]')) n.removeAttribute('data-lgs-reveal');
    if (S.unreveal) endUnreveal();
    for (const n of doc.querySelectorAll('#header [data-lgs-unreveal]')) n.removeAttribute('data-lgs-unreveal');
    for (const a of S.ornAnims || []) { try { a.cancel(); } catch (_) { /* gone */ } }
    S.ornAnims = [];
    S.ornLeave = null;
    if (S.revealReg) { try { S.revealReg.off(); } catch (_) { /* gone */ } S.revealReg = null; }
    for (const f of doc.querySelectorAll('#Footer')) {
      for (const a of ['data-lgs-orn', 'data-lgs-orn-compact', 'data-lgs-orn-fixed', 'data-lgs-band', 'data-lgs-orn-leave']) f.removeAttribute(a);
      for (const v of ['--lgs-orn-x', '--lgs-orn-w', '--lgs-orn-gl', '--lgs-orn-gr']) f.style.removeProperty(v);
      for (const el of f.querySelectorAll('[data-lgs-btn]')) el.removeAttribute('data-lgs-btn');
      for (const el of f.querySelectorAll('[data-lgs-glyph]')) {
        el.removeAttribute('data-lgs-glyph');
        el.style.removeProperty('--lgs-c1a-glyph');
        if (el.getAttribute('style') === '') el.removeAttribute('style');
      }
    }
  }

  RT.define({
    name: 'shell',
    flag: 'wp.c1a',
    install(rt) {
      S = {
        rt, main: null, root: null, footer: null, route: null, otherMode: null, pending: false, hdr: null,
        hooks: new Map(), slots: new Map(), targetFns: new Set(), target: null, backAria: new Map(),
        rootSel: sel(rt, '%{BasicUiRoot}'),
        splitSel: sel(rt, '%{MainNavMenuMainSplit}'),
        footerSel: '#Footer' + sel(rt, '%{BasicFooter}') + ':not(' + sel(rt, '%{FloatingVRFooter}') + ')',
        legendSel: sel(rt, '%{ActionButtonLegend}'),
        glyphSel: sel(rt, '%{FooterGlyphSize}'),
        backSel: '#header ' + sel(rt, '%{BackContainer}'),
        searchSel: '#header ' + sel(rt, '%{SearchAndTitleContainer}%{ShowingSearch}'),
        backLabelSel: sel(rt, '%{BackContainer>BackButton}'),
        labelSel: sel(rt, '%{ActionButtonLabel}'),
        tabMenuSel: sel(rt, '%{DashboardMenu}%{Variant_FrameMenu}'),
        tabItemSel: sel(rt, '%{DashboardMenu}%{Variant_FrameMenu} %{DashboardMenu>Item}'),
        tabCollapsedSel: sel(rt, '%{DashboardMenu>Collapsed}'),
        menus: new Set(), tab: null, opt: null, optText: null, revealReg: null, stack: [], hdrSaved: null, hdrRewrites: 0,
      };
      rt.windows.track((entry) => {
        if (entry.kind === 'main') return attachMain(entry);
        if (entry.kind === 'frame.menu') return attachMenu(entry);
        return undefined;
      });
      if (rt.bridge && typeof rt.bridge.on === 'function') {
        rt.bridge.on('geom', (v, prev, key, changed) => { if (changed !== false) applyTabBar(); });
      }
      rt.flags.on('quietBacking', () => schedule());
      rt.flags.on('hdr108', () => { if (S) applyHeader(); });
      rt.flags.on('searchCircle', () => { if (S) applyRoute('flag'); });
      rt.flags.on('wp.p3', () => { if (S) rt.setTimeout(() => wireReveal(), 500); });
      const api = {
        glassMode(key, fn) {
          if (typeof fn !== 'function') throw new Error('shell.glassMode: fn must be a function');
          const k = String(key || '*');
          if (!S.hooks.has(k)) S.hooks.set(k, new Set());
          S.hooks.get(k).add(fn);
          const self = S;
          return { remove() { const l = self.hooks.get(k); if (l) l.delete(fn); if (S === self) applyRoute('hook-removed'); } };
        },
        refreshGlass() { if (S) applyRoute('refresh'); },
        ornamentSlots(key, opts) {
          const o = opts || {};
          const widths = Array.isArray(o.widths) ? o.widths.map(Number) : null;
          if (!widths || !widths.length || widths.some((w) => !(w > 0))) throw new Error('shell.ornamentSlots: widths required');
          const rec = { widths, gap: Number(o.gap) || 0, padding: Number(o.padding) || 0 };
          S.slots.set(String(key), rec);
          schedule();
          const self = S;
          return { remove() { if (self.slots.get(String(key)) === rec) self.slots.delete(String(key)); if (S === self) schedule(); } };
        },
        route() { return S && S.route ? { path: S.route.path, key: S.route.key, mode: S.route.mode, search: S.route.search } : null; },
        target() { return S ? S.target : null; },
        onTarget(fn) {
          if (typeof fn !== 'function') throw new Error('shell.onTarget: fn must be a function');
          S.targetFns.add(fn);
          const self = S;
          return { remove() { self.targetFns.delete(fn); } };
        },
        // set by the More helper (20-more.js) from attention; not for areas
        _setTarget(el) { setTarget(el); },
        // the ≡ description for the More circle's label and tooltip when Steam shows no ≡ legend (laser)
        _optionsText(el) { return S ? optionsText(el || null) : null; },
        status() {
          return S ? { route: S.route, header: Object.assign({}, S.hdr, { rewrites: S.hdrRewrites }), tab: S.tab, opt: S.opt, hooks: Array.from(S.hooks.keys()), slots: Array.from(S.slots.keys()),
            reveal: { wired: !!S.revealReg, live: !!S.revealReg && S.revealAtt === (S.rt.attention || null), wires: S.revealWires || 0, stack: S.stack.slice(-3), title: previousTitle() },
            footer: S.footer ? { orn: S.footer.getAttribute('data-lgs-orn'), fixed: S.footer.getAttribute('data-lgs-orn-fixed'), w: S.ornW || 0, morphs: S.ornMorphs || 0, leaves: S.ornLeaves || 0 } : null } : null;
        },
      };
      rt.expose('shell', api);
      return api;
    },
    remove() {
      try { teardownDom(); } catch (e) { log('warn', 'teardown', String(e && e.message || e)); }
      try { if (S) teardownMenus(); } catch (e) { log('warn', 'teardown menus', String(e && e.message || e)); }
      S = null;
      return { patchedLeft: 0 };
    },
  });
})();
