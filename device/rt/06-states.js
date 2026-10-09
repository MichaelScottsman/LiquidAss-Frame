// Glass Shell phase 2, P3 interaction runtime: state tags for the illumination model (CTL §4).
// Contract: docs/phase2/contracts/interaction.md §3. Evidence: docs/phase2/wp/P3.md.
//
//   --hx / --hy           light spot at the laser hit point (laser only, one write per frame)
//   .lgs-pressed          gamepad A (vgp_onbuttondown button 1) until its up, 400 ms safety clear
//   .lgs-focus-in         entry class on the new gamepad focus and on the FocusRing (400 ms)
//   .lgs-ring-check       on the FocusRing while focus is on a .DialogCheckbox
//   .lgs-focus-disabled   on the gamepad-focused element while it is disabled
//   .lgs-lit              for LIT_HOLD_MS after an element stops being hovered, focused (or focus-within) or
//                         pressed: its light layer (04-states.css, created only while lit) stays for the fade-out
//
// Every listener is passive and capture phase. Nothing here calls preventDefault, stopPropagation
// or re-dispatches a Steam event.
(function lgsP3States() {
  'use strict';
  const RT = (typeof __LGS_RT !== 'undefined') ? __LGS_RT : window.__LGS_RT;
  if (!RT || typeof RT.define !== 'function') return;

  const H = window;
  const PRESS_CLEAR_MS = 400;
  const FOCUS_IN_MS = 400;
  const A_BUTTON = 1;     // EGamepadButton OK (CTL §4.4, P-C1)
  const DEFAULT_SPOT = '[data-lgs-spot], .DialogButton, button, [role="button"], [role="tab"], a[href], .Panel';
  const DEFAULT_PRESS = '[data-lgs-press], .DialogButton, button, [role="button"], [role="tab"], a[href], .Panel';
  const DISABLED = '.Disabled, [disabled], [aria-disabled="true"], %{*GamepadDialogContent>Disabled}, %{*Button>Disabled}';
  const LIT_HOLD_MS = 600;  // the light's fade-out (--lgs-ill-d-out, 441 ms) and a margin
  const OUR_CLASSES = ['lgs-pressed', 'lgs-focus-in', 'lgs-ring-check', 'lgs-focus-disabled', 'lgs-lit'];

  let R = null;
  let live = null;

  function log(level, msg, data) {
    try {
      const f = R && (level === 'error' ? R.error : level === 'warn' ? R.warn : R.log);
      if (typeof f === 'function') { f(msg, data); return; }
    } catch (_) { /* fall through */ }
    try { H.console[level === 'error' ? 'error' : 'log']('[lgs states] ' + msg, data === undefined ? '' : data); } catch (_) { /* none */ }
  }
  const PUB = () => (H.__LGS_RT && typeof H.__LGS_RT.define === 'function') ? H.__LGS_RT : RT;
  // Per-document hooks through P1's window registry (scoped, tracked), else P3's own hub.
  function onDocOf(rt, input) {
    const RW = rt && rt.windows;
    if (RW && typeof RW.track === 'function') return (fn) => RW.track((e) => fn(e.win, e.doc, e.kind));
    return (fn) => input.hub.onDoc(fn);
  }
  // A member on the public runtime object (PLAN §1.4 one accessor) through P1's tracked rt.expose,
  // which deletes it when the module is removed; plain assignment (undone by off) only without it.
  function expose(rt, name, value, offs) {
    const P = PUB();
    if (rt && rt !== P && typeof rt.expose === 'function') {
      try { offs.push(rt.expose(name, value)); return; } catch (err) { log('warn', 'rt.expose(' + name + ') refused; assigning', String(err)); }
    }
    P[name] = value;
    offs.push(() => { if (P[name] === value) delete P[name]; });
  }
  function inputOf(rt) {
    try { if (rt && typeof rt.use === 'function') return rt.use('input'); } catch (_) { /* not via use */ }
    return (rt && rt.input) || (PUB() && PUB().input) || null;
  }

  RT.define({
    name: 'states',
    deps: ['input'],
    flag: 'wp.p3',
    install(rt) {
      R = rt || RT;
      const input = inputOf(R);
      if (!input || !input.hub) throw new Error('states: rt.input (P3 input module) missing');
      const hub = input.hub;
      const onDoc = onDocOf(R, input);
      const marks = input.marks;
      // %{Token} selectors resolve lazily and are retried until P1's class index has every token, so an
      // install while the index is incomplete cannot switch a tag off for the session (review R1 F6).
      const lazySel = input.lazySel;
      // No strong set of touched elements (review R1 F1): marks are weak, at most one spot host per
      // window is held (released on the next move), and removal sweeps every live window instead.
      const st = {
        docs: new Map(), offs: [], spotHosts: [], spotSel: lazySel(DEFAULT_SPOT), pressSel: lazySel(DEFAULT_PRESS),
        disabledSel: lazySel(DISABLED), ringSel: lazySel('%{FocusRing}'),
        stats: { spotWrites: 0, spotClears: 0, pressed: 0, released: 0, safetyClears: 0, focusIn: 0, ringCheck: 0, disabledFocus: 0 },
      };
      live = st;
      // Fail closed (runtime.md §1 rule 2): set before any listener or subscription below.
      st.remove = () => {
        for (const off of st.offs.splice(0).reverse()) { try { off(); } catch (_) { /* gone */ } }
        try { marks.sweep((c) => OUR_CLASSES.includes(c)); } catch (_) { /* input gone */ }
        // Belt and braces: nothing of ours left in any live popup (classes and the inline spot).
        for (const w of hub.windows()) {
          try {
            for (const el of w.document.querySelectorAll('.lgs-pressed, .lgs-focus-in, .lgs-ring-check, .lgs-focus-disabled, .lgs-lit')) {
              for (const c of OUR_CLASSES) marks.remove(el, c);
            }
            for (const el of w.document.querySelectorAll('[style*="--hx"], [style*="--hy"]')) {
              el.style.removeProperty('--hx');
              el.style.removeProperty('--hy');
            }
          } catch (_) { /* gone */ }
        }
      };

      function big(n, w) {
        try { const r = n.getBoundingClientRect(); return r.width * r.height > 0.5 * w.innerWidth * w.innerHeight; } catch (_) { return true; }
      }
      // Nearest ancestor matching sel that is not a page-sized container.
      function hostFor(t, sel, w) {
        if (!sel) return null;
        for (let n = t; n && n.nodeType === 1; n = n.parentElement) {
          let ok = false;
          try { ok = n.matches(sel); } catch (_) { ok = false; }
          if (ok) return big(n, w) ? null : n;
        }
        return null;
      }
      function spotHost(t, w) {
        for (const s of st.spotHosts) { const h = hostFor(t, s(), w); if (h) return h; }
        return hostFor(t, st.spotSel(), w);
      }
      // The last pointer target per window is only a hint: held weakly (review R1 F1).
      const WR = typeof H.WeakRef === 'function' ? H.WeakRef : null;
      const weak = (el) => (el && WR ? new WR(el) : el);
      const strong = (r) => (r && WR && r instanceof WR ? r.deref() || null : r);

      // ---------------------------------------------- light spot (CTL §4.2, VP P-09, P-10)
      // The spot host is held weakly as well: a page Steam unmounts under a still pointer is collected.
      function clearSpot(rec) {
        const el = strong(rec.spotEl);
        if (!rec.spotEl) return;
        if (!el) { rec.spotEl = null; rec.spotX = rec.spotY = null; return; }
        try { el.style.removeProperty('--hx'); el.style.removeProperty('--hy'); } catch (_) { /* gone */ }
        rec.spotEl = null;
        rec.spotX = rec.spotY = null;
        st.stats.spotClears++;
      }
      function flushSpot(rec) {
        rec.raf = 0;
        if (live !== st || input.mode !== 'laser' || !rec.ptr) return;
        const { x, y } = rec.ptr;
        const target = strong(rec.ptr.target);
        const el = target && target.isConnected ? spotHost(target, rec.win) : null;
        const cur = strong(rec.spotEl);
        if (el !== cur) clearSpot(rec);
        if (!el) return;
        let r;
        try { r = el.getBoundingClientRect(); } catch (_) { return; }
        if (!r.width || !r.height) return;
        const hx = (Math.max(0, Math.min(1, (x - r.left) / r.width)) * 100).toFixed(1) + '%';
        const hy = (Math.max(0, Math.min(1, (y - r.top) / r.height)) * 100).toFixed(1) + '%';
        if (el === cur && hx === rec.spotX && hy === rec.spotY) return;
        el.style.setProperty('--hx', hx);
        el.style.setProperty('--hy', hy);
        if (el !== cur) rec.spotEl = weak(el);
        rec.spotX = hx;
        rec.spotY = hy;
        st.stats.spotWrites++;
      }

      function schedule(rec) {
        if (rec.raf) return;
        try { rec.raf = rec.win.requestAnimationFrame(() => flushSpot(rec)); } catch (_) { rec.raf = 0; }
      }

      // ---------------------------------------------- press (CTL §4.4, C7)
      function unpress(rec, el, why) {
        const t = rec.pressed.get(el);
        if (t === undefined) return;
        H.clearTimeout(t);
        rec.pressed.delete(el);
        try { marks.remove(el, 'lgs-pressed'); } catch (_) { /* gone */ }
        holdLit(rec, el);
        if (why === 'safety') st.stats.safetyClears++; else st.stats.released++;
      }
      function onButtonDown(rec, e) {
        const d = e.detail || {};
        if (d.button !== A_BUTTON || d.is_repeat) return;
        const t = e.target;
        if (!t || t.nodeType !== 1) return;
        const el = hostFor(t, st.pressSel(), rec.win) || t;
        if (rec.pressed.has(el)) unpress(rec, el, 'again');
        marks.add(el, 'lgs-pressed');
        rec.pressed.set(el, H.setTimeout(() => unpress(rec, el, 'safety'), PRESS_CLEAR_MS));
        st.stats.pressed++;
      }
      function onButtonUp(rec, e) {
        const d = e.detail || {};
        if (d.button !== A_BUTTON) return;
        for (const el of [...rec.pressed.keys()]) unpress(rec, el, 'up');
      }

      // ---------------------------------------------- gamepad focus tags (CTL §4.3, §4.5, §4.7)
      function rings(rec) {
        const sel = st.ringSel();
        if (!sel) return [];
        try { return [...rec.doc.querySelectorAll(sel)]; } catch (_) { return []; }
      }
      function focusIn(rec, el) {
        if (!el || el.nodeType !== 1) return;
        if (el.classList.contains('lgs-focus-in')) {
          // Restart our entry animation in place (no reflow): CSS animations restart at currentTime 0.
          try {
            for (const a of el.getAnimations({ subtree: true })) {
              if (a.animationName && String(a.animationName).startsWith('lgs-focus-in')) a.currentTime = 0;
            }
          } catch (_) { /* no animations */ }
        } else {
          marks.add(el, 'lgs-focus-in');
        }
        H.clearTimeout(rec.focusInTimers.get(el));
        rec.focusInTimers.set(el, H.setTimeout(() => {
          rec.focusInTimers.delete(el);
          try { marks.remove(el, 'lgs-focus-in'); } catch (_) { /* gone */ }
        }, FOCUS_IN_MS));
      }
      function applyRingCheck(rec) {
        for (const ring of rings(rec)) {
          const on = !!rec.ringCheck;
          if (on !== ring.classList.contains('lgs-ring-check')) {
            if (on) { marks.add(ring, 'lgs-ring-check'); st.stats.ringCheck++; } else marks.remove(ring, 'lgs-ring-check');
          }
        }
      }
      function clearFocusTags(rec) {
        if (rec.disEl) { try { marks.remove(rec.disEl, 'lgs-focus-disabled'); } catch (_) { /* gone */ } rec.disEl = null; }
        rec.ringCheck = false;
        applyRingCheck(rec);
      }
      function isDisabled(t, w) {
        const sel = st.disabledSel();
        if (!sel) return false;
        for (let n = t, i = 0; n && n.nodeType === 1 && i < 4; n = n.parentElement, i++) {
          let ok = false;
          try { ok = n.matches(sel); } catch (_) { ok = false; }
          if (ok) return !big(n, w);
          if (i > 0 && n.classList && n.classList.contains('Panel') && n.classList.contains('Focusable')) break;   // another control
        }
        return false;
      }
      function onFocus(rec, e) {
        if (input.mode !== 'pad') return;
        const t = e.target;
        if (!t || t.nodeType !== 1) return;
        clearFocusTags(rec);
        focusIn(rec, t);
        for (const ring of rings(rec)) focusIn(rec, ring);
        st.stats.focusIn++;
        if (isDisabled(t, rec.win)) { marks.add(t, 'lgs-focus-disabled'); rec.disEl = t; st.stats.disabledFocus++; }
        let chk = false;
        try { chk = !!t.closest('.DialogCheckbox'); } catch (_) { chk = false; }
        rec.ringCheck = chk;
        applyRingCheck(rec);
        // Steam (re)renders its FocusRing after the focus event: tag it again once it is there.
        const token = rec.focusToken = {};
        const again = () => {
          if (live !== st || rec.focusToken !== token) return;
          applyRingCheck(rec);
          for (const ring of rings(rec)) if (!ring.classList.contains('lgs-focus-in') && !rec.focusInTimers.has(ring)) focusIn(rec, ring);
        };
        try { rec.win.requestAnimationFrame(again); } catch (_) { /* hidden window */ }
        H.setTimeout(again, 120);
      }
      function onBlur(rec, e) {
        const t = e.target;
        if (rec.disEl && rec.disEl === t) { try { marks.remove(t, 'lgs-focus-disabled'); } catch (_) { /* gone */ } rec.disEl = null; }
      }

      // ---------------------------------------------- light fade-out hold
      // An element and its ancestors up to the body: what :hover, :active and .gpfocuswithin cover.
      function chainOf(el) {
        const out = [];
        for (let n = el; n && n.nodeType === 1 && n.tagName !== 'BODY' && n.tagName !== 'HTML'; n = n.parentElement) out.push(n);
        return out;
      }
      function holdLit(rec, el) {
        if (!el || el.nodeType !== 1 || !el.isConnected) return;
        H.clearTimeout(rec.litTimers.get(el));
        if (!el.classList.contains('lgs-lit')) { try { marks.add(el, 'lgs-lit'); } catch (_) { return; } }
        rec.litTimers.set(el, H.setTimeout(() => {
          rec.litTimers.delete(el);
          try { marks.remove(el, 'lgs-lit'); } catch (_) { /* gone */ }
        }, LIT_HOLD_MS));
      }
      // what was lit by the old chain and is not by the new one fades out
      function leaveChain(rec, key, el) {
        const prev = rec[key] || [];
        const next = el ? chainOf(el) : [];
        if (prev.length) {
          const keep = new Set(next);
          for (const n of prev) if (!keep.has(n)) holdLit(rec, n);
        }
        rec[key] = next;
      }

      // ---------------------------------------------- per document
      st.offs.push(onDoc((w, doc, surface) => {
        const rec = {
          win: w, doc, surface, ptr: null, raf: 0, spotEl: null, spotX: null, spotY: null,
          pressed: new Map(), focusInTimers: new Map(), disEl: null, ringCheck: false, focusToken: null,
          litTimers: new Map(), hoverChain: null, focusChain: null, activeChain: null, hoverEl: null,
        };
        st.docs.set(doc, rec);
        const move = (e) => {
          // Always remember the pointer (cheap), so the spot appears the moment Steam's source flips to
          // the laser; write only in laser mode, at most once per frame.
          rec.ptr = { target: weak(e.target), x: e.clientX, y: e.clientY };
          if (input.mode === 'laser') schedule(rec);
          if (e.target !== rec.hoverEl) { rec.hoverEl = e.target; leaveChain(rec, 'hoverChain', e.target); }
        };
        const out = (e) => {
          if (!e.relatedTarget) { rec.ptr = null; clearSpot(rec); rec.hoverEl = null; leaveChain(rec, 'hoverChain', null); }
        };
        const down = (e) => onButtonDown(rec, e);
        const up = (e) => onButtonUp(rec, e);
        const pdown = (e) => { rec.activeChain = e.target && e.target.nodeType === 1 ? chainOf(e.target) : null; };
        const pup = () => leaveChain(rec, 'activeChain', null);
        const focus = (e) => { leaveChain(rec, 'focusChain', e.target && e.target.nodeType === 1 ? e.target : null); onFocus(rec, e); };
        const blur = (e) => onBlur(rec, e);
        const opt = { capture: true, passive: true };
        doc.addEventListener('pointermove', move, opt);
        doc.addEventListener('mouseout', out, opt);
        doc.addEventListener('vgp_onbuttondown', down, opt);
        doc.addEventListener('vgp_onbuttonup', up, opt);
        doc.addEventListener('vgp_onfocus', focus, opt);
        doc.addEventListener('vgp_onblur', blur, opt);
        doc.addEventListener('pointerdown', pdown, opt);
        doc.addEventListener('pointerup', pup, opt);
        doc.addEventListener('pointercancel', pup, opt);
        rec.handlers = { down, up, focus, blur };
        return () => {
          doc.removeEventListener('pointermove', move, opt);
          doc.removeEventListener('mouseout', out, opt);
          doc.removeEventListener('vgp_onbuttondown', down, opt);
          doc.removeEventListener('vgp_onbuttonup', up, opt);
          doc.removeEventListener('vgp_onfocus', focus, opt);
          doc.removeEventListener('vgp_onblur', blur, opt);
          doc.removeEventListener('pointerdown', pdown, opt);
          doc.removeEventListener('pointerup', pup, opt);
          doc.removeEventListener('pointercancel', pup, opt);
          for (const [el, t] of rec.litTimers) { H.clearTimeout(t); try { marks.remove(el, 'lgs-lit'); } catch (_) { /* gone */ } }
          rec.litTimers.clear();
          try { if (rec.raf) w.cancelAnimationFrame(rec.raf); } catch (_) { /* gone */ }
          rec.raf = 0;
          clearSpot(rec);
          for (const el of [...rec.pressed.keys()]) unpress(rec, el, 'remove');
          for (const [el, t] of rec.focusInTimers) { H.clearTimeout(t); try { marks.remove(el, 'lgs-focus-in'); } catch (_) { /* gone */ } }
          rec.focusInTimers.clear();
          clearFocusTags(rec);
          st.docs.delete(doc);
        };
      }));

      st.offs.push(input.onChange((s, prev) => {
        if (s.mode === prev.mode) return;
        for (const rec of st.docs.values()) {
          if (s.mode === 'pad') { rec.ptr = null; clearSpot(rec); }   // VP P-09: no stale coordinates
          else {
            if (rec.ptr) schedule(rec);
            clearFocusTags(rec);
            for (const [el, t] of rec.focusInTimers) { H.clearTimeout(t); try { marks.remove(el, 'lgs-focus-in'); } catch (_) { /* gone */ } }
            rec.focusInTimers.clear();
          }
        }
      }));

      function recFor(el) { try { return st.docs.get(el.ownerDocument) || null; } catch (_) { return null; } }
      // An area's selector whose tokens resolve to nothing (yet) falls back to the default list.
      function orDefault(get, def) {
        const f = () => get() || def;
        f.resolved = get.resolved;
        f.source = get.source;
        return f;
      }

      const states = {
        get spotSelector() { return st.spotSel(); },
        set spotSelector(v) { if (typeof v === 'string' && v) st.spotSel = orDefault(lazySel(v), DEFAULT_SPOT); },
        get pressSelector() { return st.pressSel(); },
        set pressSelector(v) { if (typeof v === 'string' && v) st.pressSel = orDefault(lazySel(v), DEFAULT_PRESS); },
        // Areas: a host whose own CSS draws the spot (e.g. a card's outer box); tried before the default list.
        addSpotHost(sel) {
          if (!sel || typeof sel !== 'string') return () => {};
          const s = lazySel(sel);
          st.spotHosts.push(s);
          return () => { const i = st.spotHosts.indexOf(s); if (i >= 0) st.spotHosts.splice(i, 1); };
        },
        stats() { return Object.assign({}, st.stats); },
        // Diagnostics: the selectors in use and whether every %{Token} in them has resolved yet.
        selectors() {
          const one = (g) => ({ sel: g(), resolved: g.resolved() });
          return { spot: one(st.spotSel), press: one(st.pressSel), disabled: one(st.disabledSel), ring: one(st.ringSel), hosts: st.spotHosts.map(one) };
        },
        // Test hook (IN-4): run our handler on a fake event object, never dispatched to Steam.
        test: {
          feed(type, target, detail) {
            const rec = recFor(target);
            if (!rec) throw new Error('states.test.feed: target is not in a hooked Steam window');
            const ev = {
              type, target, detail: detail || {}, defaultPrevented: false, propagationStopped: false,
              preventDefault() { this.defaultPrevented = true; },
              stopPropagation() { this.propagationStopped = true; },
              stopImmediatePropagation() { this.propagationStopped = true; },
            };
            const h = rec.handlers;
            if (type === 'vgp_onbuttondown') h.down(ev);
            else if (type === 'vgp_onbuttonup') h.up(ev);
            else if (type === 'vgp_onfocus') h.focus(ev);
            else if (type === 'vgp_onblur') h.blur(ev);
            else throw new Error('states.test.feed: unknown type ' + type);
            return { prevented: ev.defaultPrevented, stopped: ev.propagationStopped };
          },
        },
      };
      st.api = states;
      expose(R, 'states', states, st.offs);
      return states;
    },
    remove() {
      const st = live;
      live = null;
      if (st && st.remove) st.remove();
      const P = PUB();
      if (P && st && P.states === st.api) delete P.states;
      R = null;
    },
  });
})();
