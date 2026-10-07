// Phase 2 lab helpers (P10, docs/phase2/contracts/lab.md section 7).
// Evaluated after lab_helpers.js in the same IIFE scope: extends
// window.__LGS_LAB with new members only; every Phase 1 member is unchanged.
(function () {
  const L = window.__LGS_LAB;
  if (!L || L.p2 === 5) return;
  const SINGLE = L.single;
  const sleep = L.sleep;

  function mainInst() { return SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance; }
  function fiberOf(el) {
    const k = el && Object.keys(el).find((x) => x.startsWith('__reactFiber'));
    return k ? el[k] : null;
  }
  // The Steam nav node behind a DOM element (GP 0.4, appdetails.md 0.4).
  function navNode(el) {
    for (let f = fiberOf(el), i = 0; f && i < 12; i++, f = f.return) {
      const n = f.memoizedProps && f.memoizedProps.node;
      if (n && typeof n.BTakeFocus === 'function') return n;
    }
    return null;
  }
  function gpTakeEl(el) {
    const n = navNode(el);
    if (!n) throw new Error('gpTake: no nav node for ' + (L.readable(el).join(' ') || el.tagName));
    n.BTakeFocus(3);
    return true;
  }
  function gpTake(alias, s) {
    const el = typeof s === 'string' ? L.q(alias, s) : s;
    if (!el) throw new Error('gpTake: nothing matches ' + s + ' in ' + alias);
    gpTakeEl(el);
    return L.focused();
  }
  // FocusApplicationRoot, then Down + Up so focus is live (SR 4, vr-null-tree).
  async function root() {
    if (SINGLE) return {};
    mainInst().FocusApplicationRoot();
    await sleep(250);
    const before = gpEl('main');
    FocusNavController.DispatchVirtualButtonClick(10);
    await sleep(220);
    if (before || gpEl('main')) { FocusNavController.DispatchVirtualButtonClick(9); await sleep(220); }
    return L.focused();
  }
  function gpEl(alias) {
    const w = L.surface(alias || 'main');
    const a = w.document.querySelectorAll('.gpfocus');
    return a.length ? a[a.length - 1] : null;
  }

  // Synthetic laser hover at an element's centre (pointerover/enter/move), held
  // for ms; leave with unhover(). Events are untrusted: Steam's laser focus
  // does not move (IM D-7), :hover does not apply; P3's attention listens to
  // mouseover/mouseout, which are dispatched too.
  function evAt(w, el, type, x, y) {
    const E = type.startsWith('pointer') ? w.PointerEvent : w.MouseEvent;
    el.dispatchEvent(new E(type, { bubbles: !/enter|leave/.test(type), cancelable: true, view: w, clientX: x, clientY: y, pointerType: 'mouse', isPrimary: true }));
  }
  let hovered = null;
  async function hover(alias, s, ms) {
    const w = L.surface(alias);
    const el = typeof s === 'string' ? L.q(alias, s) : s;
    if (!el) throw new Error('hover: nothing matches ' + s);
    unhover();
    const r = el.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    for (const t of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']) evAt(w, el, t, x, y);
    hovered = { w, el };
    if (ms) await sleep(ms);
    return L.readable(el).join(' ');
  }
  // The park point (PLAN 7 item 2, IM 9): (1400, 900) CSS px, outside the main window's 1280 x 720 viewport, so
  // the pointer rests on nothing; on a viewport that contains it, just beyond its far corner. Until session 5 this
  // was (1400, 900) / 1.5 = (933, 600), inside main and on Home's All Games disc (REQ C2a-R2->P10 (2)).
  function park(w) {
    let x = 1400, y = 900;
    if (x < w.innerWidth && y < w.innerHeight) { x = Math.max(x, w.innerWidth + 40); y = Math.max(y, w.innerHeight + 40); }
    return [x, y];
  }
  function unhover() {
    if (hovered) {
      const { w, el } = hovered;
      hovered = null;
      const [x, y] = park(w);
      try { for (const t of ['pointerout', 'pointerleave', 'mouseout', 'mouseleave']) evAt(w, el, t, x, y); } catch (_) { /* gone */ }
    }
    if (!SINGLE) {
      try {
        const w = L.surface('main');
        const b = w.document.body;
        const [x, y] = park(w);
        for (const t of ['pointermove', 'mousemove']) evAt(w, b, t, x, y);
      } catch (_) { /* no main */ }
    }
    return true;
  }

  const FOCUSABLE = '.Focusable, .gpfocus, button, [role=button], [role=tab], [role=link], input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])';
  function visible(w, el) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= w.innerWidth || r.top >= w.innerHeight) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = w.getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    }
    return true;
  }
  function focusables(alias, opts) {
    opts = opts || {};
    const w = L.surface(alias || 'main');
    const out = [];
    for (const el of w.document.querySelectorAll(opts.sel || FOCUSABLE)) {
      if (el.closest('[id^="lgs-"]')) continue;
      if (!visible(w, el)) continue;
      if (opts.nav && !navNode(el)) continue;
      const r = el.getBoundingClientRect();
      out.push({ el, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] });
    }
    return out;
  }

  function anims(alias) {
    const w = L.surface(alias || 'main');
    return w.document.getAnimations().map((a) => {
      const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
      const tg = a.effect && a.effect.target;
      return {
        name: a.animationName || a.transitionProperty || a.constructor.name, kind: a.constructor.name,
        duration: t.duration, delay: t.delay, easing: t.easing, iterations: t.iterations, fill: t.fill,
        playState: a.playState, target: tg ? (L.readable(tg).slice(0, 3).join(' ') || tg.tagName) : null,
      };
    });
  }

  Object.assign(L, { p2: 5, navNode, gpTake, gpTakeEl, gpEl, root, hover, unhover, focusables, anims, visible, FOCUSABLE });
})();
