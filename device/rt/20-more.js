// Glass Shell phase 2, C1a More circle (T2): module `more`, flag `wp.c1a`.
// Concept: docs/phase2/concepts/window-nav.md §3.4.3 (frozen target), §3.4.4 (More circle); PLAN §1.11, S14.
// One helper for every area: areas call __LGS_RT.more.register(selector, {placement: 'card' | 'row'}).
//   - One node per document (div.lgs-more), moved to the current target: laser dwell >= 300 ms, at once
//     on gamepad focus (P3's attention). A fixed overlay node in the window's body, placed over its host:
//     cards top right inset 10, rows trailing inset 24; 60 px visible, 80 px hit. Never inside Steam's
//     React tree, so nothing has to be re-attached when virtualized rows recycle.
//   - While the pointer is inside #Footer it stays on the frozen target (shell.target()).
//   - A capture-phase listener stops pointerdown / mousedown / mouseup / click, so the host never opens.
//   - Action: the host's own onMenuButton (its Focusable fiber props, SM-D15); fallback Steam's
//     vgp_onmenu event on the host (HA §7.2). Never a new menu. White while its menu is open.
// Removed by remove() (G-REMOVE): nodes, listeners, classes.
(function lgsC1aMore() {
  'use strict';
  const RT = (typeof __LGS_RT !== 'undefined') ? __LGS_RT : window.__LGS_RT;
  if (!RT || typeof RT.define !== 'function') return;

  const H = window;
  const DWELL = 300;
  const LEAVE_GRACE = 220; // ms between leaving the host and hiding the circle (the laser's way onto it)
  const SVG = '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="5" cy="13" r="2.4"/><circle cx="13" cy="13" r="2.4"/><circle cx="21" cy="13" r="2.4"/></svg>';
  let S = null;

  function log(level, msg, data) {
    try { const f = S && S.rt && (level === 'warn' ? S.rt.warn : S.rt.log); if (f) f(msg, data); } catch (_) { /* none */ }
  }
  function fiberFn(el, key, depth) {
    try {
      const k = Object.keys(el).find((x) => x.startsWith('__reactFiber'));
      let f = k ? el[k] : null;
      for (let i = 0; f && i < (depth || 12); i++, f = f.return) {
        const p = f.memoizedProps;
        if (p && typeof p[key] === 'function') return p[key];
      }
    } catch (_) { /* none */ }
    return null;
  }
  // Steam's nav node behind an element (its Focusable fiber's `node`, GP §0.4)
  function navNode(el) {
    try {
      const k = Object.keys(el).find((x) => x.startsWith('__reactFiber'));
      let f = k ? el[k] : null;
      for (let i = 0; f && i < 12; i++, f = f.return) {
        const n = f.memoizedProps && f.memoizedProps.node;
        if (n && typeof n.BTakeFocus === 'function') return n;
      }
    } catch (_) { /* none */ }
    return null;
  }
  function shellTarget() {
    try { return RT.shell ? RT.shell.target() : null; } catch (_) { return null; }
  }
  function setTarget(el) {
    try { if (RT.shell) RT.shell._setTarget(el); } catch (_) { /* shell off */ }
  }
  function laserMode(st) {
    try { const v = RT.input && RT.input.vrMode; if (v === 'laser' || v === 'gamepad') return v === 'laser'; } catch (_) { /* P3 off */ }
    return st.entry.html.getAttribute('data-lgs-vr-mode') === 'laser';
  }
  // WN §3.4.3 item 3: when the pointer enters #Footer, the frozen target takes Steam's focus through its
  // own nav node (source 3 = mouse, so the navigation source stays the laser's) before any click can reach
  // a legend; Steam then renders the legends for the target and its own handlers act on it.
  function refocus(st) {
    const t = shellTarget();
    if (!t || !t.isConnected || t.ownerDocument !== st.entry.doc || !laserMode(st)) return false;
    const n = navNode(t);
    if (!n) return false;
    try { n.BTakeFocus(3); S.refocused = (S.refocused || 0) + 1; return true; } catch (e) { log('warn', 'BTakeFocus failed', String(e && e.message || e)); return false; }
  }
  function fiberProp(el, key) {
    try {
      const k = Object.keys(el).find((x) => x.startsWith('__reactFiber'));
      let f = k ? el[k] : null;
      for (let i = 0; f && i < 14; i++, f = f.return) {
        const p = f.memoizedProps;
        if (p && typeof p === 'object' && p[key] !== undefined) return p[key];
      }
    } catch (_) { /* none */ }
    return undefined;
  }
  function menuLabel(doc) {
    // Steam's own ≡ legend string, when the footer shows it (PLAN §1.15: no new strings)
    try {
      const el = doc.querySelector('#Footer [data-lgs-btn="MENU"]');
      const t = el && (el.innerText || '').trim();
      return t || null;
    } catch (_) { return null; }
  }
  function modalOpen(doc) {
    try { return !!doc.querySelector('.BasicUIContextMenu, .ModalOverlayContent.active'); } catch (_) { return false; }
  }

  function docState(entry) {
    let st = S.docs.get(entry.doc);
    if (st) return st;
    const doc = entry.doc;
    const node = doc.createElement('div');
    node.className = 'lgs-more';
    node.setAttribute('role', 'button');
    node.innerHTML = SVG;
    st = { entry, node, host: null, placement: 'card', inFooter: false, open: false, timer: 0, away: null, leaveT: null, onCircle: false };
    const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    for (const t of ['pointerdown', 'mousedown', 'mouseup', 'pointerup']) S.rt.listen(node, t, stop, { capture: true });
    S.rt.listen(node, 'click', (ev) => { stop(ev); activate(st); }, { capture: true });
    const onEnter = () => { st.onCircle = true; if (st.leaveT) { st.leaveT(); st.leaveT = null; } };
    const onOut = (ev) => {
      st.onCircle = false;
      const to = ev.relatedTarget;
      if (st.host && to && st.host.contains(to)) return; // back on its host
      if (st.host) scheduleHide(st, st.host);
    };
    S.rt.listen(node, 'pointerenter', onEnter, { passive: true });
    S.rt.listen(node, 'mouseenter', onEnter, { passive: true });
    S.rt.listen(node, 'pointerleave', onOut, { passive: true });
    S.rt.listen(node, 'mouseleave', onOut, { passive: true });
    // the frozen target: while the pointer is inside #Footer the circle stays where it is
    S.rt.listen(doc, 'pointerover', (ev) => {
      if (st.away) { st.away(); st.away = null; }
      const t = ev.target;
      const inF = !!(t && t.closest && t.closest('#Footer'));
      if (inF !== st.inFooter) {
        st.inFooter = inF;
        if (inF) {
          // the circle marks the frozen target while the pointer is in the ornament (WN §3.4.3 item 4)
          refocus(st);
          const tg = shellTarget();
          if (tg && tg.isConnected && tg.ownerDocument === doc && st.host !== tg) show(st, tg, st.placement);
        } else if (!(st.host && t && st.host.contains(t))) hide(st);
      }
    }, { passive: true, capture: true });
    // the target clears 8 s after the pointer left the window (WN §3.4.3 item 5)
    S.rt.listen(doc, 'pointerout', (ev) => {
      if (ev.relatedTarget) return;
      if (st.away) st.away();
      st.away = S.rt.setTimeout(() => {
        st.away = null;
        st.inFooter = false;
        if (shellTarget() && shellTarget().ownerDocument === doc) setTarget(null);
        if (!st.open) { st.host = null; st.node.classList.remove('lgs-more-show'); }
      }, 8000);
    }, { passive: true, capture: true });
    S.rt.listen(doc, 'scroll', () => place(st), { passive: true, capture: true });
    S.docs.set(doc, st);
    return st;
  }
  function place(st) {
    const h = st.host;
    if (!h || !st.node.isConnected) return;
    if (!h.isConnected) { hide(st); return; }
    const r = h.getBoundingClientRect();
    let x, y;
    if (st.placement === 'row') { x = r.right - 24 - 60 - 10; y = r.top + r.height / 2 - 40; }
    else { x = r.right - 70 - 10; y = r.top + 10 - 10; }
    st.node.style.translate = Math.round(x) + 'px ' + Math.round(y) + 'px';
  }
  function show(st, host, placement) {
    if (st.leaveT) { st.leaveT(); st.leaveT = null; }
    st.host = host;
    st.placement = placement;
    const doc = st.entry.doc;
    if (!st.node.isConnected) (doc.body || doc.documentElement).appendChild(st.node);
    // inside another glass container (the search sheet, a sheet): no blur (VP P-45)
    const inGlass = !!(host.closest && host.closest('[data-lgs-mat], .lgs-sheet, [data-lgs-inglass]'));
    st.node.toggleAttribute('data-lgs-inglass', inGlass);
    const own = fiberProp(host, 'onMenuActionDescription');
    const label = (typeof own === 'string' && own.trim()) ? own.trim() : menuLabel(doc);
    if (label) st.node.setAttribute('aria-label', label); else st.node.removeAttribute('aria-label');
    place(st);
    st.node.classList.add('lgs-more-show');
    try { RT.shell && RT.shell._setTarget(host); } catch (_) { /* shell off */ }
  }
  function hide(st) {
    if (st.inFooter || st.open) return; // frozen target, or its menu is open
    if (st.leaveT) { st.leaveT(); st.leaveT = null; }
    st.host = null;
    st.node.classList.remove('lgs-more-show');
  }
  // The circle is a body-level node, so moving the laser from the host onto the circle is a leave of the
  // host (REQ C1c->C1a): the hide waits LEAVE_GRACE ms and is dropped while the pointer is on the circle
  // or back on the host, so the press lands on the circle, never on the host below it.
  function scheduleHide(st, host) {
    if (st.leaveT) st.leaveT();
    st.leaveT = S.rt.setTimeout(() => {
      st.leaveT = null;
      if (st.host !== host || st.onCircle || st.inFooter || st.open) return;
      try { if (host && host.matches(':hover')) return; } catch (_) { /* detached */ }
      hide(st);
    }, LEAVE_GRACE);
  }
  // the host's own menu: its onMenuButton (Focusable fiber props, SM-D15), else Steam's vgp_onmenu on it
  function dispatchMenu(host, win) {
    let done = false;
    const fn = fiberFn(host, 'onMenuButton');
    if (fn) {
      try { fn({ detail: { button: 11, source: 0, is_repeat: false }, currentTarget: host, target: host, preventDefault() {}, stopPropagation() {} }); done = true; }
      catch (e) { log('warn', 'onMenuButton threw', String(e && e.message || e)); }
    }
    if (!done) {
      try { host.dispatchEvent(new win.CustomEvent('vgp_onmenu', { bubbles: true, cancelable: true, detail: { button: 14, source: 0, is_repeat: false } })); done = true; }
      catch (e) { log('warn', 'vgp_onmenu failed', String(e && e.message || e)); }
    }
    try { RT.sound && RT.sound('activate'); } catch (_) { /* no sound bus */ }
    return done;
  }
  function activate(st) {
    const host = st.host;
    if (!host || !host.isConnected) return;
    const doc = st.entry.doc;
    if (modalOpen(doc)) return; // never stacks a second menu
    dispatchMenu(host, st.entry.win);
    // white while its menu is open (the menu's source is the circle; C1c anchors to it)
    st.open = true;
    st.node.classList.add('lgs-more-open');
    let seen = false;
    const t0 = Date.now();
    const poll = S.rt.setInterval(() => {
      const open = modalOpen(doc);
      if (open) seen = true;
      if ((seen && !open) || (!seen && Date.now() - t0 > 1500)) {
        poll();
        st.open = false;
        st.node.classList.remove('lgs-more-open');
        if (!st.host || !st.host.matches(':hover')) hide(st);
      }
    }, 200);
  }

  RT.define({
    name: 'more',
    deps: ['attention', 'shell'],
    flag: 'wp.c1a',
    install(rt) {
      S = { rt, docs: new Map(), regs: new Set(), sels: new Set(), refocused: 0 };
      const api = {
        register(selector, opts) {
          const placement = (opts && opts.placement) === 'row' ? 'row' : 'card';
          const surfaces = (opts && opts.surfaces) || ['main'];
          const self = S;
          const handle = rt.attend(selector, {
            dwellMs: DWELL, padImmediate: true, surfaces, classes: false,
            onDwell(el, ev) {
              if (!S || S !== self) return;
              const entry = rt.windows.find(ev && ev.win) || rt.windows.main();
              if (!entry) return;
              show(docState(entry), el, placement);
            },
            onLeave(el, ev) {
              if (!S || S !== self) return;
              const entry = rt.windows.find(ev && ev.win) || rt.windows.main();
              const st = entry && S.docs.get(entry.doc);
              if (st && st.host === el && !st.inFooter && !st.open) scheduleHide(st, el);
            },
          });
          S.regs.add(handle);
          let match = null;
          if (typeof selector === 'string') { try { match = rt.sel(selector); } catch (_) { match = null; } }
          const rec = { match, fn: typeof selector === 'function' ? selector : null, el: selector && selector.nodeType === 1 ? selector : null, surfaces };
          S.sels.add(rec);
          return { remove() { try { handle.off(); } catch (_) { /* gone */ } if (self.regs) self.regs.delete(handle); if (self.sels) self.sels.delete(rec); } };
        },
        // a registered host is on this page (the shell's Options member shows only then, WN §3.4.2)
        hostsIn(doc) {
          if (!S) return false;
          for (const r of S.sels) {
            if (r.el) { if (r.el.isConnected && r.el.ownerDocument === doc) return true; continue; }
            if (r.fn) return true;
            if (r.match) { try { if (doc.querySelector(r.match)) return true; } catch (_) { /* bad selector */ } }
          }
          return false;
        },
        // dispatch the host's own menu (the shell's Options member); never while a modal or menu is up
        dispatch(host) {
          if (!S || !host || !host.isConnected) return false;
          const entry = rt.windows.find(host.ownerDocument.defaultView) || rt.windows.main();
          if (!entry || modalOpen(entry.doc)) return false;
          return dispatchMenu(host, entry.win);
        },
        refocused() { return S ? (S.refocused || 0) : 0; },
        current(win) { const e = win ? rt.windows.find(win) : rt.windows.main(); const st = e && S.docs.get(e.doc); return st ? st.host : null; },
        nodes() { let n = 0; rt.windows.each((e) => { n += e.doc.querySelectorAll('.lgs-more').length; }); return n; },
      };
      rt.expose('more', api);
      return api;
    },
    remove() {
      if (S) {
        for (const h of S.regs) { try { h.off(); } catch (_) { /* gone */ } }
        for (const st of S.docs.values()) { try { st.node.remove(); } catch (_) { /* gone */ } }
      }
      S = null;
      return { patchedLeft: 0 };
    },
  });
})();
