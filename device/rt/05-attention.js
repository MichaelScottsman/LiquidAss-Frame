// Glass Shell phase 2, P3 interaction runtime: attention (laser dwell + gamepad focus).
// Contract: docs/phase2/contracts/interaction.md §2. Evidence: docs/phase2/wp/P3.md.
//
// Hover never moves Steam's focus (IM D-7), so every delayed reveal is fed by this one machine:
//   gamepad mode: vgp_onfocus / vgp_onblur (or rt.attention.feed from a T3 component)
//   laser mode:   mouseover / mouseout plus dwell, re-checked against :hover (trusted events:
//                 the real laser, CDP input) or against the last mouseover target (untrusted
//                 events: the lab's synthetic L.hover, which cannot set :hover)
//
//   .lgs-dwell                 innermost dwellSelector match under the laser after 80 ms (laser only)
//   rt.attend(target, opts)    enter / dwell / step / leave callbacks, .lgs-attend and .lgs-attend-<ms>
//   rt.attention.current(win), rt.attention.feed(el, 'enter'|'leave')
(function lgsP3Attention() {
  'use strict';
  const RT = (typeof __LGS_RT !== 'undefined') ? __LGS_RT : window.__LGS_RT;
  if (!RT || typeof RT.define !== 'function') return;

  const H = window;
  const DWELL_MS = 80;
  const DEFAULT_DWELL_SEL = '.Panel, button, [role="button"], [role="tab"], a[href], [data-lgs-dwell]';

  let R = null;
  let live = null;

  function log(level, msg, data) {
    try {
      const f = R && (level === 'error' ? R.error : level === 'warn' ? R.warn : R.log);
      if (typeof f === 'function') { f(msg, data); return; }
    } catch (_) { /* fall through */ }
    try { H.console[level === 'error' ? 'error' : 'log']('[lgs attention] ' + msg, data === undefined ? '' : data); } catch (_) { /* none */ }
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
  function call(fn, ...args) {
    if (typeof fn !== 'function') return;
    try { fn(...args); } catch (err) { log('error', 'callback failed', String(err && err.stack || err)); }
  }

  RT.define({
    name: 'attention',
    deps: ['input'],
    flag: 'wp.p3',
    install(rt) {
      R = rt || RT;
      const input = inputOf(R);
      if (!input || !input.hub) throw new Error('attention: rt.input (P3 input module) missing');
      const hub = input.hub;
      const onDoc = onDocOf(R, input);
      const marks = input.marks;
      const lazySel = input.lazySel;
      const now = () => H.performance.now();
      // No strong set of touched elements (review R1 F1): class refcounts live in a WeakMap, the sticky
      // marks registry is weak, and removal sweeps every live window instead.
      const st = { docs: new Map(), regs: new Set(), refs: new WeakMap(), offs: [], dwellSel: lazySel(DEFAULT_DWELL_SEL) };
      live = st;
      const OURS = (c) => c === 'lgs-dwell' || c === 'lgs-attend' || c.startsWith('lgs-attend-');
      // Fail closed (runtime.md §1 rule 2): set before any listener or subscription below.
      st.remove = () => {
        for (const reg of st.regs) for (const A of [...reg.active.values()]) leaveNow(reg, A, true);
        st.regs.clear();
        for (const off of st.offs.splice(0).reverse()) { try { off(); } catch (_) { /* gone */ } }
        for (const rec of st.docs.values()) clearDwell(rec);
        st.docs.clear();
        try { marks.sweep(OURS); } catch (_) { /* input gone */ }
        // Belt and braces: no lgs-dwell / lgs-attend* left in any live popup.
        for (const w of hub.windows()) {
          try {
            for (const el of w.document.querySelectorAll('.lgs-dwell, .lgs-attend, [class*="lgs-attend-"]')) {
              for (const c of [...el.classList]) if (OURS(c)) marks.remove(el, c);
            }
          } catch (_) { /* gone */ }
        }
      };

      // ---------------------------------------------- class refcounts (several registrations may share an element)
      function addCls(el, cls) {
        let m = st.refs.get(el);
        if (!m) { m = new Map(); st.refs.set(el, m); }
        const n = (m.get(cls) || 0) + 1;
        m.set(cls, n);
        if (n === 1) { try { marks.add(el, cls); } catch (_) { /* gone */ } }
      }
      function delCls(el, cls) {
        const m = st.refs.get(el);
        if (!m || !m.get(cls)) return;
        const n = m.get(cls) - 1;
        if (n > 0) { m.set(cls, n); return; }
        m.delete(cls);
        try { marks.remove(el, cls); } catch (_) { /* gone */ }
        if (!m.size) st.refs.delete(el);
      }

      // ---------------------------------------------- global laser dwell (IM §4)
      function cardFor(t, w) {
        const sel = st.dwellSel();
        if (!sel) return null;
        for (let n = t; n && n.nodeType === 1; n = n.parentElement) {
          let ok = false;
          try { ok = n.matches(sel); } catch (_) { ok = false; }
          if (ok) {
            const r = n.getBoundingClientRect();
            return (r.width * r.height > 0.5 * w.innerWidth * w.innerHeight) ? null : n;   // a page container
          }
        }
        return null;
      }
      function clearDwell(rec) {
        const d = rec.dwell;
        if (!d) return;
        H.clearTimeout(d.timer);
        if (d.on) { try { marks.remove(d.el, 'lgs-dwell'); } catch (_) { /* gone */ } }
        rec.dwell = null;
      }
      // The last mouseover target per document, held weakly: it is only a hint, and must not keep a
      // page Steam unmounted under a still pointer alive (review R1 F1).
      const WR = typeof H.WeakRef === 'function' ? H.WeakRef : null;
      function setOver(rec, t) { rec.lastOver = t ? (WR ? new WR(t) : t) : null; }
      function lastOver(rec) { const r = rec.lastOver; return r ? (WR && r instanceof WR ? r.deref() || null : r) : null; }
      // Is the pointer still on el? Trusted events (the real laser, CDP input) set :hover; the
      // lab's synthetic hover cannot, so for it the last mouseover target in that document decides.
      function stillOver(rec, el) {
        try {
          if (!el.isConnected) return false;
          if (rec.overTrusted !== false) return el.matches(':hover');
          const lo = lastOver(rec);
          return !!(lo && lo.isConnected && el.contains(lo));
        } catch (_) { return false; }
      }
      // The card under a still laser, from the document's hover chain (trusted input only; the last
      // :hover match is the innermost element).
      function hoveredCard(rec) {
        try {
          const hs = rec.doc.querySelectorAll(':hover');
          const leaf = hs.length ? hs[hs.length - 1] : null;
          const c = leaf ? cardFor(leaf, rec.win) : null;
          if (c) setOver(rec, leaf);
          return c;
        } catch (_) { return null; }
      }
      function laserDwell(rec, target) {
        if (input.mode !== 'laser') return;
        const card = target ? cardFor(target, rec.win) : null;
        if (rec.dwell && rec.dwell.el === card) return;
        clearDwell(rec);
        if (!card) return;
        const d = { el: card, t0: now(), on: false, tOn: 0, timer: 0 };
        d.timer = H.setTimeout(() => {
          if (rec.dwell !== d || live !== st || input.mode !== 'laser') return;
          if (!stillOver(rec, card)) {
            // Steam re-rendered the element under a still pointer (library cards swap a child on hover)
            // and Chromium has not sent the new mouseover yet (measured up to 420 ms late): the laser
            // stayed put, so the card now under it inherits the dwell.
            const now2 = rec.overTrusted !== false ? hoveredCard(rec) : null;
            if (!now2) { rec.dwell = null; return; }
            d.el = now2;
          }
          const card2 = d.el;
          marks.add(card2, 'lgs-dwell');
          d.on = true;
          d.tOn = now();
        }, DWELL_MS);
        rec.dwell = d;
      }

      // ---------------------------------------------- registrations
      function thresholdsOf(o) {
        const t = new Set([o.dwellMs]);
        for (const s of o.steps) t.add(s);
        return [...t].sort((a, b) => a - b);
      }
      function evOf(A, extra) { return Object.assign({ source: A.source, t: now(), win: A.win }, extra || {}); }
      function reach(reg, A, th) {
        if (A.reached.includes(th)) return;
        A.reached.push(th);
        if (reg.o.classes) addCls(A.el, 'lgs-attend-' + th);
        if (th === reg.o.dwellMs) call(reg.o.onDwell, A.el, evOf(A));
        else call(reg.o.onStep, A.el, th, evOf(A));
      }
      function leaveNow(reg, A, silent) {
        if (reg.active.get(A.el) !== A) return;
        reg.active.delete(A.el);
        for (const t of A.timers) H.clearTimeout(t);
        H.clearTimeout(A.leaveTimer);
        if (reg.o.classes) {
          delCls(A.el, 'lgs-attend');
          for (const th of A.reached) delCls(A.el, 'lgs-attend-' + th);
        }
        if (!silent) call(reg.o.onLeave, A.el, evOf(A));
      }
      function scheduleLeave(reg, A) {
        if (A.leaveTimer || reg.active.get(A.el) !== A) return;
        // No grace: leave in the same task. A 0 ms timer runs only after Steam's own work for the
        // event (a D-pad focus change keeps the thread busy for about 100 ms), which delays the leave.
        if (!(reg.o.leaveMs > 0)) { leaveNow(reg, A, false); return; }
        A.leaveTimer = H.setTimeout(() => { A.leaveTimer = 0; leaveNow(reg, A, false); }, reg.o.leaveMs);
      }
      function enter(reg, el, source, rec) {
        const cur = reg.active.get(el);
        if (cur) {
          if (cur.leaveTimer) { H.clearTimeout(cur.leaveTimer); cur.leaveTimer = 0; }
          // The input that entered last owns the attention, so its own leave paths end it (a feed
          // attention the laser takes over must end when the laser leaves; found by the R1 leak test).
          cur.source = source;
          return cur;
        }
        const A = { el, source, since: now(), reached: [], timers: [], leaveTimer: 0, win: rec ? rec.win : null, doc: rec ? rec.doc : el.ownerDocument };
        reg.active.set(el, A);
        if (reg.o.classes) addCls(el, 'lgs-attend');
        call(reg.o.onEnter, el, evOf(A));
        if (reg.active.get(el) !== A) return A;   // the callback ended it
        const padLike = source === 'pad' || (source === 'feed' && input.mode === 'pad');
        const immediate = padLike && reg.o.padImmediate;
        for (const th of reg.ths) {
          if (immediate || th <= 0) { reach(reg, A, th); continue; }
          A.timers.push(H.setTimeout(() => {
            if (reg.active.get(el) !== A || live !== st) return;
            if (A.source === 'laser' && !A.leaveTimer && rec && !stillOver(rec, el)) { leaveNow(reg, A, false); return; }
            if (!el.isConnected) { leaveNow(reg, A, false); return; }
            reach(reg, A, th);
          }, th));
        }
        return A;
      }
      function inSurface(reg, rec) { return !reg.surfaces || (rec && reg.surfaces.has(rec.surface)); }

      // A target: Element, selector string, or predicate fn(el) -> bool. Returns the matched ancestor.
      function matcherFor(target) {
        if (typeof target === 'string') {
          const get = lazySel(target);   // %{Token}: re-resolved on use until P1's index has it (R1 F6)
          return (el) => { const sel = get(); if (!sel) return null; try { return el && el.closest ? el.closest(sel) : null; } catch (_) { return null; } };
        }
        if (typeof target === 'function') {
          return (el) => {
            for (let n = el; n && n.nodeType === 1; n = n.parentElement) { try { if (target(n)) return n; } catch (_) { return null; } }
            return null;
          };
        }
        if (target && target.nodeType === 1) return (el) => (el && (el === target || target.contains(el)) ? target : null);
        throw new Error('rt.attend: target must be an Element, a selector or a function');
      }

      // ---------------------------------------------- event handling per document
      function onLaserTarget(rec, t) {
        laserDwell(rec, t);
        for (const reg of st.regs) {
          if (!inSurface(reg, rec)) continue;
          const m = reg.match(t);
          for (const A of [...reg.active.values()]) {
            if (A.source === 'laser' && A.doc === rec.doc && A.el !== m && !(t && A.el.contains(t))) scheduleLeave(reg, A);
          }
          if (m) enter(reg, m, 'laser', rec);
        }
      }
      function onPadFocus(rec, t) {
        rec.focusEl = t;
        rec.focusSince = now();
        for (const reg of st.regs) {
          if (!inSurface(reg, rec)) continue;
          const m = reg.match(t);
          for (const A of [...reg.active.values()]) {
            if (A.source === 'pad' && A.doc === rec.doc && A.el !== m && !A.el.contains(t)) scheduleLeave(reg, A);
          }
          if (m) enter(reg, m, 'pad', rec);
        }
      }
      function onPadBlur(rec, t) {
        if (rec.focusEl === t) rec.focusEl = null;
        for (const reg of st.regs) {
          for (const A of [...reg.active.values()]) {
            if (A.source === 'pad' && A.doc === rec.doc && (A.el === t || A.el.contains(t))) scheduleLeave(reg, A);
          }
        }
      }
      function endSource(rec, source, silent) {
        for (const reg of st.regs) {
          for (const A of [...reg.active.values()]) {
            if ((!rec || A.doc === rec.doc) && (source === '*' || A.source === source)) leaveNow(reg, A, silent);
          }
        }
      }

      st.offs.push(onDoc((w, doc, surface) => {
        const rec = { win: w, doc, surface, lastOver: null, overTrusted: null, dwell: null, focusEl: null, focusSince: 0 };
        st.docs.set(doc, rec);
        const over = (e) => {
          setOver(rec, e.target);
          rec.overTrusted = e.isTrusted !== false;
          if (input.mode === 'laser') onLaserTarget(rec, e.target);
        };
        const out = (e) => {
          if (e.relatedTarget) {
            const to = e.relatedTarget;
            if (rec.dwell && !rec.dwell.el.contains(to)) clearDwell(rec);
            // The laser left an attended element: its leave (and grace) starts now. Steam's own
            // handlers can hold the matching mouseover on the new element back by about 70 ms.
            if (input.mode === 'laser' && e.target && e.target.nodeType === 1) {
              for (const reg of st.regs) {
                for (const A of [...reg.active.values()]) {
                  if (A.source === 'laser' && A.doc === doc && A.el.contains(e.target) && !A.el.contains(to)) scheduleLeave(reg, A);
                }
              }
            }
            return;
          }
          // left the window
          setOver(rec, null);
          clearDwell(rec);
          for (const reg of st.regs) for (const A of [...reg.active.values()]) if (A.source === 'laser' && A.doc === doc) scheduleLeave(reg, A);
        };
        const focus = (e) => { if (input.mode === 'pad' && e.target && e.target.nodeType === 1) onPadFocus(rec, e.target); };
        const blur = (e) => { if (e.target && e.target.nodeType === 1) onPadBlur(rec, e.target); };
        doc.addEventListener('mouseover', over, true);
        doc.addEventListener('mouseout', out, true);
        doc.addEventListener('vgp_onfocus', focus, true);
        doc.addEventListener('vgp_onblur', blur, true);
        return () => {
          doc.removeEventListener('mouseover', over, true);
          doc.removeEventListener('mouseout', out, true);
          doc.removeEventListener('vgp_onfocus', focus, true);
          doc.removeEventListener('vgp_onblur', blur, true);
          clearDwell(rec);
          endSource(rec, '*', live !== st);
          st.docs.delete(doc);
        };
      }));

      // Seeds attention for the current mode: the element under the laser, or Steam's .gpfocus.
      function seed(reg) {
        for (const rec of st.docs.values()) {
          if (reg && !inSurface(reg, rec)) continue;
          if (input.mode === 'laser') {
            const t = lastOver(rec);
            if (t && stillOver(rec, t)) onLaserTarget(rec, t);
          } else {
            let f = null;
            try { f = rec.doc.querySelector('.gpfocus'); } catch (_) { f = null; }
            if (f) onPadFocus(rec, f);
          }
        }
      }
      let seedTimer = 0;
      st.offs.push(input.onChange((s, prev) => {
        if (s.mode === prev.mode) return;
        // The old input's attention ends at once (no grace); feed-driven attention follows its component.
        for (const rec of st.docs.values()) {
          if (s.mode === 'pad') { clearDwell(rec); endSource(rec, 'laser', false); }
          else { endSource(rec, 'pad', false); rec.focusEl = null; }
        }
        H.clearTimeout(seedTimer);
        // Pad: Steam re-takes focus on the first press, then dispatches vgp_onfocus; seed covers the rest.
        seedTimer = H.setTimeout(() => { if (live === st) seed(null); }, s.mode === 'pad' ? 60 : 0);
      }));
      st.offs.push(() => H.clearTimeout(seedTimer));

      function attend(target, opts) {
        if (live !== st) return { off() {}, active() { return []; } };
        const o0 = opts || {};
        const o = {
          dwellMs: typeof o0.dwellMs === 'number' && o0.dwellMs >= 0 ? o0.dwellMs : DWELL_MS,
          steps: Array.isArray(o0.steps) ? o0.steps.filter((x) => typeof x === 'number' && x >= 0) : [],
          padImmediate: !!o0.padImmediate,
          leaveMs: typeof o0.leaveMs === 'number' && o0.leaveMs >= 0 ? o0.leaveMs : 0,
          classes: o0.classes !== false,
          onEnter: o0.onEnter, onDwell: o0.onDwell, onStep: o0.onStep, onLeave: o0.onLeave,
        };
        const reg = {
          o, ths: thresholdsOf(o), match: matcherFor(target), active: new Map(),
          surfaces: Array.isArray(o0.surfaces) && o0.surfaces.length ? new Set(o0.surfaces) : null,
        };
        st.regs.add(reg);
        seed(reg);
        return {
          off() {
            if (!st.regs.has(reg)) return;
            for (const A of [...reg.active.values()]) leaveNow(reg, A, true);
            st.regs.delete(reg);
          },
          active() { return [...reg.active.values()].map((A) => ({ el: A.el, since: A.since, source: A.source, reached: A.reached.slice() })); },
        };
      }

      function docRec(win) {
        let w = win;
        if (!w) w = hub.main();
        if (typeof w === 'string') w = hub.windows().find((x) => hub.surfaceOf(x) === w) || null;
        if (!w) return null;
        try { return st.docs.get(w.document) || null; } catch (_) { return null; }
      }

      const attention = {
        get dwellSelector() { return st.dwellSel(); },
        set dwellSelector(v) { if (typeof v === 'string' && v) st.dwellSel = lazySel(v); },
        get dwellMs() { return DWELL_MS; },
        current(win) {
          const rec = docRec(win);
          if (!rec) return null;
          if (input.mode === 'pad') {
            let f = null;
            try { f = rec.doc.querySelector('.gpfocus'); } catch (_) { f = null; }
            return f ? { el: f, source: 'pad', since: rec.focusEl === f ? rec.focusSince : null } : null;
          }
          return rec.dwell && rec.dwell.on ? { el: rec.dwell.el, source: 'laser', since: rec.dwell.tOn } : null;
        },
        feed(el, kind, source) {
          if (live !== st || !el || el.nodeType !== 1) return;
          const src = source || 'feed';
          let rec = null;
          try { rec = st.docs.get(el.ownerDocument) || null; } catch (_) { rec = null; }
          for (const reg of st.regs) {
            if (rec && !inSurface(reg, rec)) continue;
            const m = reg.match(el);
            if (!m) continue;
            if (kind === 'enter') enter(reg, m, src, rec || { win: el.ownerDocument.defaultView, doc: el.ownerDocument });
            else if (kind === 'leave') { const A = reg.active.get(m); if (A) scheduleLeave(reg, A); }
          }
        },
        // Diagnostics for tests: the dwell state per surface.
        dwellState() {
          const out = [];
          for (const rec of st.docs.values()) {
            if (rec.dwell) out.push({ surface: rec.surface, on: rec.dwell.on, ms: rec.dwell.on ? Math.round(rec.dwell.tOn - rec.dwell.t0) : null, cls: String(rec.dwell.el.className).slice(0, 120) });
          }
          return out;
        },
        registrations() { return st.regs.size; },
      };
      st.attend = attend;
      expose(R, 'attend', attend, st.offs);
      expose(R, 'attention', attention, st.offs);
      return { attend, attention };
    },
    remove() {
      const st = live;
      live = null;
      if (st && st.remove) st.remove();
      const P = PUB();
      if (P && st && P.attend === st.attend) { delete P.attend; delete P.attention; }
      R = null;
    },
  });
})();
