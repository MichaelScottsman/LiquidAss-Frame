// Glass Shell phase 2, C1c system presentations: T2 runtime. Module `menus`, flag `wp.c1c` (off until V2).
// PLAN §1.4, §1.7, §1.8, §1.12, §1.15; WN §5.1-§5.4 (rev 3); C1c log docs/phase2/wp/C1c.md (D1-D33).
//
//   classify  every Steam context menu on `main`: data-lgs-menu="action|value" on the slab,
//             lgs-menu-compact|grid|scroll and --lgs-menu-rows by item count, data-lgs-exempt="E-MENU"
//             on its rows (22-presentations.css keys its layouts on these; its :has() fallback steps aside)
//   power     Steam's Power menu: data-lgs-glyph on its 7 rows, the group labels (Steam's own strings
//             "#Downloads_ThisDevice", "#Menu_Steam") as data-lgs-g1/-g2 on the container
//   value     the library Sort menu: the current sort checked (data-lgs-checked) and Steam's "Sort By"
//             ("#Library_SortCollectionBy") as the slab's title (data-lgs-title on the container)
//   source    what opened the menu: the More circle (C1a paints it white; its card gets a glow), Steam's
//             own anchor element (the menu instance's m_position.element), the last pointerdown /
//             vgp_onmenu / vgp_onoptions target, a frame-menu tab (data-lgs-open, C1a's look), the
//             ornament's Y member for Sort. data-lgs-menu-source="white" (controls) or "glow" (content)
//   anchor    translate on Steam's menu container and title row so the slab sits beside its source (kill
//             switch: flag menuAnchor=false), and the morph start --sx --sy --sw --sh --sr (D15)
//   modal     html.lgs-modal on every Steam popup while main shows an alert or a sheet (D16);
//             html.lgs-menu-open on main while a context menu is open (D34: the page backdrop root)
//   close     a 60 px close circle on sheets (data-lgs-sheet="close" on the card), which dispatches
//             Steam's own click-away cancel (ModalClickToDismiss), then B's cancel if the sheet ignored it
//             and Steam's focus is inside it; B and outside clicks stay Steam's
//   tag       data-lgs-destructive on a destructive confirm (Steam's .Destructive, or the confirm of a
//             dialog opened from the Power menu) and data-lgs-plate="thick" on its card (flat, PLAN-1c-1);
//             data-lgs-plate="thick" on menu slabs and modal cards on windowless routes (C2a REQ #3)
//
// One MutationObserver on main's modal overlay (Steam keeps the node, display none when idle).
// Nothing is persisted; every class, attribute, style and node is removed by remove() (G-REMOVE).
(function lgsC1cMenus() {
  'use strict';
  const RT = (typeof __LGS_RT !== 'undefined') ? __LGS_RT : window.__LGS_RT;
  if (!RT || typeof RT.define !== 'function') return;

  const T = {
    overlay: '%{GamepadDialogOverlay}',
    pos: '%{*GamepadDialogContent>ModalPosition}',
    dismiss: '%{*GamepadDialogContent>ModalClickToDismiss}',
    bcm: '%{*BasicContextMenuHeader>BasicContextMenuModal}',
    header: '%{*BasicContextMenuModal>BasicContextMenuHeader}',
    container: '%{*BasicContextMenuModal>BasicContextMenuContainer}',
    contents: '%{*BasicContextMenuModal>contextMenuContents}',
    item: '%{*BasicContextMenuModal>contextMenuItem}',
    sectionHeader: '%{*BasicContextMenuModal>MenuSectionHeader}',
    separator: '%{*BasicContextMenuModal>ContextMenuSeparator}',
    destructive: '%{*BasicContextMenuModal>Destructive}',
    selected: '%{*BasicContextMenuModal>Selected}',
    card: '%{*GamepadDialogContent_InnerWidth>GamepadDialogContent}',
    focusRing: '%{FocusRing}',
    focusRingRoot: '%{FocusRingRoot}',
    tabItem: '%{DashboardMenu>Item}',
    gridItem: '%{CSSGrid} %{LibraryItemBox}',
    legend: '%{ActionButtonLegend}',
    legendLabel: '%{ActionButtonLabel}',
  };
  // Steam's Power menu rows in Steam's order (inventory shell §4; WN §5.2): Sleep, Shutdown, Restart Device,
  // Restart Steam VR, Change Account, Sign Out, Restart Steam. Glyphs are masks in 22-presentations.css.
  const POWER_GLYPHS = ['moon', 'power', 'restart', 'vr', 'person', 'signout', 'restart'];
  // Group labels: Steam's own strings (PLAN §1.15), so every language gets them; null hides a label.
  const POWER_GROUPS = [['#Downloads_ThisDevice', 'This Device'], ['#Menu_Steam', 'Steam']];
  const BOX = { top: 108, bottom: 616, left: 24, right: 1256, gap: 16, ornGap: 8 };   // D7, D28, C2c REQ-6
  const SOURCE_MS = 1500;   // a pointerdown / vgp event this recent is the menu's source

  let R = null;
  let S = null;   // live state, created by install

  // ---------------------------------------------------------------- tracked DOM changes
  // every change is recorded once per (element, kind, name) and undone by remove(); entries of nodes Steam
  // removed are pruned while no modal is shown
  function key(el, kind, name) { return kind + '\u0001' + name; }
  function rec(el, kind, name, undo) {
    let m = S.marks.get(el);
    if (!m) { m = new Map(); S.marks.set(el, m); }
    const k = key(el, kind, name);
    if (!m.has(k)) m.set(k, undo);
  }
  function setAttr(el, a, v) {
    if (!el) return;
    if (v === null || v === undefined || v === false) { unsetAttr(el, a); return; }
    const s = String(v);
    if (el.getAttribute(a) === s) return;
    if (!el.hasAttribute(a)) rec(el, 'a', a, () => el.removeAttribute(a));
    el.setAttribute(a, s);
  }
  function unsetAttr(el, a) {
    if (!el || !el.hasAttribute(a)) return;
    el.removeAttribute(a);
    const m = S.marks.get(el);
    if (m) m.delete(key(el, 'a', a));
  }
  function addCls(el, c) {
    if (!el || el.classList.contains(c)) return;
    el.classList.add(c);
    rec(el, 'c', c, () => el.classList.remove(c));
  }
  function delCls(el, c) {
    if (!el || !el.classList.contains(c)) return;
    el.classList.remove(c);
    const m = S.marks.get(el);
    if (m) m.delete(key(el, 'c', c));
  }
  function setProp(el, p, v) {
    if (!el) return;
    if (el.style.getPropertyValue(p) === v) return;
    rec(el, 's', p, () => el.style.removeProperty(p));
    el.style.setProperty(p, v);
  }
  function undoAll() {
    for (const [, m] of S.marks) for (const f of Array.from(m.values()).reverse()) { try { f(); } catch (_) { /* gone */ } }
    S.marks.clear();
  }
  function prune() {
    for (const el of Array.from(S.marks.keys())) if (!el.isConnected) S.marks.delete(el);
  }

  // ---------------------------------------------------------------- helpers
  function loc(token, english) {
    try {
      const LM = R.W.LocalizationManager;
      const s = LM && LM.LocalizeString ? LM.LocalizeString(token) : null;
      if (typeof s === 'string' && s && s !== token) return s;
      const l = LM && LM.GetPreferredLocales ? LM.GetPreferredLocales() : null;
      const lang = String((Array.isArray(l) ? l[0] : l) || 'english');
      return /^en/i.test(lang) ? english : null;
    } catch (_) { return null; }
  }
  function fiberOf(el) {
    if (!el) return null;
    const k = Object.keys(el).find((x) => x.startsWith('__reactFiber'));
    return k ? el[k] : null;
  }
  function upProps(el, test, depth) {
    for (let f = fiberOf(el), i = 0; f && i < (depth || 40); i++, f = f.return) {
      const p = f.memoizedProps;
      if (p && typeof p === 'object') { try { const v = test(p); if (v !== undefined) return v; } catch (_) { /* odd props */ } }
    }
    return undefined;
  }
  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
  }
  function kindOfEl(el) {
    // controls (buttons, capsules, tabs, circles) turn white; content (cards, rows) gets a glow
    const r = el.getBoundingClientRect();
    if (el.matches && el.matches(S.sel.gridItem)) return 'glow';
    return (r.height <= 100 && r.width <= 420) ? 'white' : 'glow';
  }
  function now() { return R.W.performance.now(); }

  // ---------------------------------------------------------------- source tracking
  function noteSource(e, how) {
    const doc = e.target && e.target.ownerDocument;
    if (!doc) return;
    const entry = R.windows.find(doc.defaultView);
    const t = e.target.closest ? e.target.closest('.lgs-more, ' + S.sel.tabItem + ', button, [role="button"], [role="tab"], .Focusable, .Panel') : null;
    if (!t) return;
    const src = { el: t, at: now(), how, kind: entry ? entry.kind : 'main', rect: rectOf(t), win: doc.defaultView };
    if (t.classList.contains('lgs-more')) {
      src.more = true;
      try { src.card = (RT.more && RT.more.current) ? RT.more.current(doc.defaultView) : null; } catch (_) { src.card = null; }
    }
    if (how === 'options') {
      // gamepad Y: the ornament's Y member is the visible source (C1a tags it OPTIONS)
      const y = doc.querySelector('#Footer [data-lgs-btn="OPTIONS"]') || legendOf(doc, 3);
      if (y) { const l = y.querySelector(S.sel.legendLabel) || y; src.orn = { el: y, rect: rectOf(y), label: (l.textContent || '').trim() }; }
    }
    S.lastSource = src;
  }
  // the footer legend Steam renders for a button (its React props rgButtons; 3 = Y / OPTIONS), as C1a reads it
  function legendOf(doc, button) {
    for (const el of doc.querySelectorAll('#Footer ' + S.sel.legend)) {
      const rg = upProps(el, (p) => (Array.isArray(p.rgButtons) ? p.rgButtons : undefined), 4);
      if (rg && rg[0] === button) return el;
    }
    return null;
  }
  function steamAnchor(bcm) {
    // Steam's own anchor: the ContextMenuManager context's active menu, m_position.element
    const v = upProps(bcm, (p) => (p.value && p.value.m_ActiveMenu !== undefined ? p.value : undefined), 40);
    const m = v && v.m_ActiveMenu;
    const el = m && m.m_position && m.m_position.element;
    if (!el || el.nodeType !== 1 || !el.isConnected) return null;
    const doc = el.ownerDocument;
    if (el === doc.documentElement || el === doc.body) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.width > doc.defaultView.innerWidth / 2) return null;
    return el;
  }

  // ---------------------------------------------------------------- classification
  function classify(contents, isTop) {
    const items = Array.from(contents.children).filter((e) => e.matches(S.sel.item));
    const actionable = items.filter((e) => !e.matches(S.sel.sectionHeader));
    const n = Math.max(0, actionable.length - (isTop ? 1 : 0));          // Steam's appended Cancel
    const value = contents.getAttribute('role') === 'listbox' ||
      items.some((e) => e.classList.contains('menuChecked') || e.matches(S.sel.selected) || e.getAttribute('aria-selected') === 'true');
    const destructive = items.filter((e) => e.matches(S.sel.destructive) || e.classList.contains('Stop')).length;
    // PLAN §1.12 by count, with D28 (7 compact rows do not fit the 508 px box: 7 take the grid)
    const layout = n <= 5 ? 'column' : n === 6 ? 'compact' : n <= 14 ? 'grid' : 'scroll';
    setAttr(contents, 'data-lgs-menu', value ? 'value' : 'action');
    for (const c of ['compact', 'grid', 'scroll']) { if (c === layout) addCls(contents, 'lgs-menu-' + c); else delCls(contents, 'lgs-menu-' + c); }
    if (layout === 'grid') setProp(contents, '--lgs-menu-rows', String(Math.ceil(n / 2)));
    for (const e of actionable) setAttr(e, 'data-lgs-exempt', 'E-MENU');
    return { items, actionable, n, value, destructive, layout };
  }

  function isPower(bcm, info) {
    if (info.n !== 7 || info.destructive < 3) return false;
    const h = bcm.querySelector(':scope > ' + S.sel.header);
    const t = h ? (h.textContent || '').trim() : '';
    const want = loc('#Power', 'Power');
    return !t || !want || t === want;
  }
  function decoratePower(bcm, info) {
    const rows = info.actionable.slice(0, 7);
    rows.forEach((e, i) => setAttr(e, 'data-lgs-glyph', POWER_GLYPHS[i]));
    const cont = bcm.querySelector(S.sel.container);
    const [g1, g2] = POWER_GROUPS.map(([tok, en]) => loc(tok, en));
    setAttr(cont, 'data-lgs-g1', g1);
    setAttr(cont, 'data-lgs-g2', g2);
    setAttr(info.contents, 'data-lgs-power', '');
  }

  function decorateSort(bcm, contents, src) {
    if (contents.getAttribute('role') !== 'listbox') return;
    const opts = upProps(contents, (p) => (Array.isArray(p.rgOptions) ? p.rgOptions : undefined), 12);
    if (!opts) return;
    // the library's sort: the tab component's eSortBy prop (module "LibraryTab", inventory library §6.2)
    const find = (el) => upProps(el, (p) => (typeof p.eSortBy === 'number' && typeof p.showSortingContextMenu === 'function' ? p.eSortBy : undefined), 60);
    const main = R.windows.main();
    let cur = src && src.el && src.el.isConnected ? find(src.el) : undefined;
    if (cur === undefined && main) { const g = main.doc.querySelector(S.sel.gridItem); if (g) cur = find(g); }
    if (cur === undefined) return;
    const isSort = opts.some((o) => o && o.data === cur) && opts.length >= 4;
    if (!isSort) return;
    const optEls = Array.from(contents.querySelectorAll(':scope > [role="option"]'));
    opts.forEach((o, i) => { if (optEls[i]) setAttr(optEls[i], 'data-lgs-checked', o.data === cur ? '' : null); });
    // the title: Steam's Y legend string when it opened the menu, else Steam's "Sort By" token
    const title = (src && src.orn && src.orn.label) || loc('#Library_SortCollectionBy', 'Sort By');
    const hdr = bcm.querySelector(':scope > ' + S.sel.header);
    if (title && !(hdr && (hdr.textContent || '').trim())) setAttr(bcm.querySelector(S.sel.container), 'data-lgs-title', title);
  }

  // ---------------------------------------------------------------- anchoring and morph start
  function anchorOn() {
    const v = R.flags.get('menuAnchor');
    return v === undefined ? true : R.flags.enabled('menuAnchor');
  }
  function place(bcm, contents, src) {
    const doc = bcm.ownerDocument;
    const m = rectOf(contents);
    if (!m.w || !m.h) return null;
    let x = m.x;
    let y = m.y;
    let from = null;             // the morph's start rect in window px
    let how = 'centre';
    const W = BOX;
    const clampX = (v) => Math.max(W.left, Math.min(W.right - m.w, v));
    const clampY = (v) => Math.max(W.top, Math.min(W.bottom - m.h, v));
    if (src && src.kind && src.kind !== 'main') {
      // a source in another window (the frame menu's Power tab): the slab grows from the left, bottom 616
      x = W.left; y = clampY(W.bottom - m.h); how = 'other-window';
      from = { x: x, y: y + m.h - 60, w: 60, h: 60, r: 30 };
    } else if (src && src.orn) {
      // the ornament's member (Sort By on Y): rows line up with it, the slab sits above the ornament
      const o = src.orn.rect;
      x = clampX(o.x - W.ornGap); y = clampY(W.bottom - m.h); how = 'ornament';
      from = { x: o.x, y: o.y, w: o.w, h: o.h, r: o.h / 2 };
    } else if (src && src.el) {
      const anchorEl = src.card && src.card.isConnected ? src.card : src.el;
      const s = anchorEl.isConnected ? rectOf(anchorEl) : src.rect;
      const circle = src.more ? (src.el.isConnected ? rectOf(src.el) : src.rect) : null;
      if (s.y >= 628 - 4 && s.h <= 100) {
        // a member of the bottom ornament (a laser click on the Sort pill, a legend)
        x = clampX(s.x - W.ornGap); y = clampY(W.bottom - m.h); how = 'ornament';
        from = { x: s.x, y: s.y, w: s.w, h: s.h, r: s.h / 2 };
      } else if (s.r + W.gap + m.w <= W.right) {
        x = s.r + W.gap; y = clampY(s.y); how = 'right';
      } else if (s.x - W.gap - m.w >= W.left) {
        x = s.x - W.gap - m.w; y = clampY(s.y); how = 'left';
      } else if (s.b + W.gap + m.h <= W.bottom) {
        x = clampX(s.r - m.w); y = s.b + W.gap; how = 'below';
      } else if (s.y - W.gap - m.h >= W.top) {
        x = clampX(s.r - m.w); y = s.y - W.gap - m.h; how = 'above';
      } else {
        how = 'centre';   // Steam's centred placement (GP §3.4's last step)
      }
      const f = circle || s;
      from = { x: f.x, y: f.y, w: Math.min(f.w, 60), h: Math.min(f.h, 60), r: 30 };
      if (!circle) { from.x = f.x + f.w / 2 - from.w / 2; from.y = f.y + f.h / 2 - from.h / 2; }
    }
    const moved = anchorOn() && how !== 'centre';
    if (!moved) { x = m.x; y = m.y; }
    const dx = Math.round(x - m.x);
    const dy = Math.round(y - m.y);
    // the slab and its title row move; Steam's BasicContextMenuModal stays full size, so its own onClick still
    // dismisses on any click outside the slab (WN AT-11 / R13: a translated modal left a strip where clicks
    // reached ModalClickToDismiss, which does not close menus)
    if (moved && (dx || dy)) {
      const cont = contents.closest(S.sel.container);
      const hdr = bcm.querySelector(':scope > ' + S.sel.header);
      if (cont) setProp(cont, 'translate', dx + 'px ' + dy + 'px');
      if (hdr) setProp(hdr, 'translate', dx + 'px ' + dy + 'px');
    }
    // the morph start inside the slab: the source carried to the slab's nearest edge at its height (D15)
    if (from) {
      const sw = Math.max(40, Math.min(from.w, m.w));
      const sh = Math.max(40, Math.min(from.h, m.h));
      let sx = from.x - x;
      let sy = from.y - y;
      if (sx + sw <= 0) sx = 0; else if (sx >= m.w) sx = m.w - sw;
      if (sy + sh <= 0) sy = 0; else if (sy >= m.h) sy = m.h - sh;
      sx = Math.max(0, Math.min(m.w - sw, sx));
      sy = Math.max(0, Math.min(m.h - sh, sy));
      setProp(contents, '--sx', Math.round(sx) + 'px');
      setProp(contents, '--sy', Math.round(sy) + 'px');
      setProp(contents, '--sw', Math.round(sw) + 'px');
      setProp(contents, '--sh', Math.round(sh) + 'px');
      setProp(contents, '--sr', Math.round(Math.min(from.r, sw / 2, sh / 2)) + 'px');
    }
    void doc;
    return { how, moved, dx, dy };
  }

  // ---------------------------------------------------------------- the source's look while its menu is open
  function markSource(src) {
    const out = [];
    if (!src) return out;
    if (src.more) {
      // C1a paints the circle white itself (lgs-more-open); the card it sits in glows at 0 mm (D6b)
      if (src.card && src.card.isConnected) { setAttr(src.card, 'data-lgs-menu-source', 'glow'); out.push([src.card, 'data-lgs-menu-source']); }
      return out;
    }
    const el = src.orn ? src.orn.el : src.el;
    if (!el || !el.isConnected) return out;
    if (el.matches(S.sel.tabItem)) { setAttr(el, 'data-lgs-open', ''); out.push([el, 'data-lgs-open']); return out; }
    setAttr(el, 'data-lgs-menu-source', kindOfEl(el));
    out.push([el, 'data-lgs-menu-source']);
    return out;
  }
  function releaseSources() {
    for (const [el, a] of S.sourceMarks) unsetAttr(el, a);
    S.sourceMarks = [];
  }

  // ---------------------------------------------------------------- modal state, sheets, destructive tags
  function topContent(doc) {
    const ov = S.overlay;
    if (!ov || !ov.isConnected || ov.style.display === 'none') return null;
    const act = Array.from(ov.children).filter((e) => e.classList.contains('ModalOverlayContent') && e.classList.contains('active') && !e.classList.contains('ModalOverlayBackground'));
    const top = act[act.length - 1];
    void doc;
    return top || null;
  }
  function modalKind(top) {
    if (!top) return null;
    const pos = top.querySelector(S.sel.pos);
    if (!pos) return null;
    if (pos.querySelector(':scope > .BasicUIContextMenu')) return 'menu';
    if (pos.querySelector(':scope > ' + S.sel.card)) return 'alert';
    return sheetOf(pos) ? 'sheet' : null;
  }
  function sheetOf(pos) {
    return Array.from(pos.children).find((e) => e.tagName === 'DIV' &&
      !e.matches(`${S.sel.dismiss}, ${S.sel.focusRing}, ${S.sel.focusRingRoot}, .BasicUIContextMenu, ${S.sel.card}`)) || null;
  }
  function setModalClass(on) {
    if (S.modalOn === on) return;
    S.modalOn = on;
    R.windows.each((w) => { try { w.html.classList.toggle('lgs-modal', on); } catch (_) { /* closed */ } });
  }
  function windowless(doc) {
    const g = doc.querySelector('[data-lgs-glass]');
    return !!(g && g.getAttribute('data-lgs-glass') === 'windowless');
  }

  function closeCircle(doc, kind, top) {
    const pos = kind === 'sheet' && top ? top.querySelector(S.sel.pos) : null;
    const sheet = pos ? sheetOf(pos) : null;
    if (!sheet) { if (S.close) { S.close.node.remove(); S.close = null; } return; }
    if (S.close && S.close.sheet !== sheet) { S.close.node.remove(); S.close = null; }
    setAttr(sheet, 'data-lgs-sheet', 'close');
    if (!S.close) {
      const b = doc.createElement('div');
      b.className = 'lgs-sheet-close';
      b.setAttribute('role', 'button');
      b.setAttribute('aria-label', loc('#Generic_Close', 'Close') || 'Close');
      const win = doc.defaultView;
      // keep Steam's focus inside the sheet (a press on a non-focusable node would move it to <body>),
      // and note where it was for the B fallback below
      let focusIn = false;
      const stop = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const ov0 = pos.closest('.ModalOverlayContent');
        focusIn = !!(ov0 && doc.activeElement && ov0.contains(doc.activeElement));
      };
      b.addEventListener('pointerdown', stop);
      b.addEventListener('mousedown', stop);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = pos.querySelector(':scope > ' + S.sel.dismiss) || doc.querySelector(S.sel.dismiss);
        if (!d) return;
        // Steam's own click-away cancel (its handler checks the click's target)
        const o = { bubbles: true, cancelable: true, view: win, button: 0 };
        d.dispatchEvent(new win.MouseEvent('mousedown', o));
        d.dispatchEvent(new win.MouseEvent('mouseup', o));
        d.dispatchEvent(new win.MouseEvent('click', o));
        try { RT.sound && RT.sound('cancel'); } catch (_) { /* no sound bus */ }
        // Some sheets ignore Steam's click-away (stock too: the zoo Scroll Panel). Then cancel the way
        // B does, but only while Steam's focus is inside this sheet's overlay (B never reaches the page).
        const ov = pos.closest('.ModalOverlayContent');
        R.W.setTimeout(() => {
          try {
            if (!ov || !ov.isConnected || !pos.isConnected || !ov.classList.contains('active')) return;
            const ae = doc.activeElement;
            const FN = R.W.FocusNavController;
            if (((ae && ov.contains(ae)) || focusIn) && FN && FN.DispatchVirtualButtonClick) FN.DispatchVirtualButtonClick(2);
          } catch (_) { /* gone */ }
        }, 260);
      });
      (doc.body || doc.documentElement).appendChild(b);
      S.close = { node: b, sheet };
    }
    placeClose();
  }
  function placeClose() {
    if (!S || !S.close) return;
    const { node, sheet } = S.close;
    if (!sheet.isConnected) return;
    // layout box, without the sheet's entrance transform (offsets ignore transforms)
    let x = 0; let y = 0;
    for (let n = sheet; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    node.style.left = Math.round(x + 24) + 'px';
    node.style.top = Math.round(y + 24) + 'px';
  }

  function tagDestructive(doc, kind, top) {
    if (kind !== 'alert' || !top) return;
    const card = top.querySelector(S.sel.card);
    if (!card) return;
    const fromPower = S.lastPower && now() - S.lastPower < 4000;
    let any = false;
    for (const b of card.querySelectorAll('.DialogFooter .DialogButton')) {
      const red = b.classList.contains('Destructive') || (fromPower && b.classList.contains('Primary'));
      if (red) { setAttr(b, 'data-lgs-destructive', ''); any = true; }
      if (b.hasAttribute('data-lgs-destructive')) any = true;
    }
    // a confirmation holding a destructive button stays flat: one thick plate in native mode (WN §5.3)
    if (any) setAttr(card, 'data-lgs-plate', 'thick');
  }

  // ---------------------------------------------------------------- the scan
  function scan() {
    S.pending = false;
    const main = R.windows.main();
    if (!main) return;
    const doc = main.doc;
    if (!S.overlay || !S.overlay.isConnected) attachOverlay(main);
    const top = topContent(doc);
    const kind = modalKind(top);
    setModalClass(kind === 'alert' || kind === 'sheet');
    closeCircle(doc, kind, top);
    tagDestructive(doc, kind, top);
    const wl = windowless(doc);
    const ov = S.overlay;
    const bcms = ov && ov.style.display !== 'none' ? Array.from(ov.querySelectorAll(S.sel.bcm)) : [];
    // While a menu is open, 22-presentations.css lifts the page's backdrop root (C1a's will-change on
    // MainNavMenuMainSplit), so the slab's blur reaches the page under it (session 4 finding)
    try { doc.documentElement.classList.toggle('lgs-menu-open', bcms.length > 0); } catch (_) { /* closed */ }
    for (const bcm of bcms) {
      const list = Array.from(bcm.querySelectorAll(S.sel.contents));
      let st = S.menus.get(bcm);
      list.forEach((c, i) => {
        const info = classify(c, i === 0);
        info.contents = c;
        if (wl) setAttr(c, 'data-lgs-plate', 'thick');
        if (i === 0 && isPower(bcm, info)) { decoratePower(bcm, info); if (!st) S.lastPower = now(); }
      });
      if (!st && list[0]) {
        st = { at: now() };
        S.menus.set(bcm, st);
        const ls = S.lastSource && now() - S.lastSource.at < SOURCE_MS ? S.lastSource : null;
        let src = ls;
        if (!src || (!src.more && !src.orn && src.kind === 'main')) {
          const el = steamAnchor(bcm);
          if (el && (!src || !src.el || !src.el.isConnected || src.el.contains(el) || el.contains(src.el) || src.how !== 'pointer')) {
            src = { el, at: now(), how: 'steam', kind: 'main', rect: rectOf(el) };
            if (ls && ls.orn) src.orn = ls.orn;
          }
        }
        st.src = src;
        decorateSort(bcm, list[0], src);
        S.sourceMarks.push(...markSource(src));
        st.place = place(bcm, list[0], src);
        S.lastSource = null;
      }
    }
    // sources whose menu closed turn back
    if (kind !== 'menu' && S.sourceMarks.length) releaseSources();
    if (kind === 'alert' || kind === 'sheet') {
      const pos = top.querySelector(S.sel.pos);
      const card = pos && (pos.querySelector(':scope > ' + S.sel.card) || sheetOf(pos));
      if (card && wl) setAttr(card, 'data-lgs-plate', 'thick');
    }
    if (!kind) prune();
  }

  function schedule() {
    if (!S || S.pending) return;
    S.pending = true;
    R.W.queueMicrotask(() => { if (S) { try { scan(); } catch (e) { S.pending = false; R.warn('scan failed', String(e && e.stack || e)); } } });
  }

  function attachOverlay(main) {
    if (S.obs) { S.obs.disconnect(); S.obs = null; }
    const ov = main.doc.querySelector(S.sel.overlay);
    S.overlay = ov || null;
    if (!ov) return;
    const obs = new main.win.MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === 'childList' || r.target === ov || r.target.parentElement === ov) { schedule(); return; }
      }
    });
    obs.observe(ov, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    S.obs = obs;
  }

  RT.define({
    name: 'menus',
    flag: 'wp.c1c',
    deps: [],
    install(rt) {
      R = rt;
      S = {
        sel: {}, marks: new Map(), menus: new WeakMap(), sourceMarks: [], lastSource: null, lastPower: 0,
        modalOn: false, close: null, pending: false, obs: null, overlay: null,
      };
      for (const [k, v] of Object.entries(T)) S.sel[k] = rt.sel(v);

      rt.windows.track((w) => {
        if (S && S.modalOn) w.html.classList.add('lgs-modal');
        const doc = w.doc;
        rt.listen(doc, 'pointerdown', (e) => noteSource(e, 'pointer'), { capture: true, passive: true });
        if (w.kind === 'main') {
          rt.listen(doc, 'vgp_onmenu', (e) => noteSource(e, 'menu'), { capture: true, passive: true });
          rt.listen(doc, 'vgp_onoptions', (e) => noteSource(e, 'options'), { capture: true, passive: true });
          attachOverlay(w);
          rt.listen(w.win, 'resize', () => placeClose(), { passive: true });
          schedule();
        }
        return () => {
          try { w.html.classList.remove('lgs-modal', 'lgs-menu-open'); } catch (_) { /* closed */ }
          if (w.kind === 'main' && S && S.obs) { S.obs.disconnect(); S.obs = null; S.overlay = null; }
        };
      });
      // the sheet's entrance moves its card; the close circle follows its layout box
      rt.setInterval(() => { if (S && S.close) placeClose(); if (S && (!S.overlay || !S.overlay.isConnected)) schedule(); }, 1000);

      const api = {
        scan() { scan(); return api.state(); },
        state() {
          return S ? {
            modal: S.modalOn, close: !!S.close, sources: S.sourceMarks.length, marks: S.marks.size,
            overlay: !!(S.overlay && S.overlay.isConnected), anchor: anchorOn(),
          } : null;
        },
        // where the open menu was placed and why (tests AT-11, C1c-4)
        last() {
          const main = R.windows.main();
          const bcm = main && main.doc.querySelector(S.sel.bcm);
          const st = bcm && S.menus.get(bcm);
          if (!st) return null;
          const s = st.src;
          return { how: st.place && st.place.how, moved: st.place && st.place.moved, dx: st.place && st.place.dx, dy: st.place && st.place.dy,
            src: s ? { how: s.how, kind: s.kind, more: !!s.more, orn: !!s.orn, rect: s.rect, cls: s.el ? String(s.el.className).slice(0, 80) : null } : null };
        },
        test: {
          // PLAN-1c-1 without a power action: the next alert counts as opened from the Power menu
          notePower() { if (S) S.lastPower = now(); return true; },
          loc,
        },
      };
      return api;
    },
    remove() {
      if (!S) return { left: 0 };
      if (S.obs) { S.obs.disconnect(); S.obs = null; }
      if (S.close) { try { S.close.node.remove(); } catch (_) { /* gone */ } S.close = null; }
      undoAll();
      R.windows.each((w) => { try { w.html.classList.remove('lgs-modal', 'lgs-menu-open'); } catch (_) { /* closed */ } });
      S = null;
      return { left: 0 };
    },
  });
})();
