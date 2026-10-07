// Glass Shell phase 2, P3 interaction runtime: tooltips (PLAN §1.13, CTL §11, VP P-12).
// Contract: docs/phase2/contracts/interaction.md §4. Evidence: docs/phase2/wp/P3.md.
//
//   In-window: one div.lgs-tip per Steam window, for icon-only owners ([data-lgs-tip] or
//              rt.tooltip.register). In after 0.8 s of attention (laser dwell or gamepad focus),
//              out 0.2 s after leave; [data-lgs-tip-pad="now"] shows at once under gamepad focus.
//              Flag tipQuick (off; P3-D4): the card's literal IN-7 timing instead, fully in at 0.8 s
//              and gone 0.18 s after leave.
//   Bar:       vrPooledPopupStore.ShowTooltip gets unDelayMS >= 800 (CTL P-C5); restored on removal.
(function lgsP3Tooltip() {
  'use strict';
  const RT = (typeof __LGS_RT !== 'undefined') ? __LGS_RT : window.__LGS_RT;
  if (!RT || typeof RT.define !== 'function') return;

  const H = window;
  const IN_MS = 800;          // PLAN §1.13: 0.8 s in, both inputs
  const OUT_MS = 200;         // 0.2 s out
  const MAT_IN_MS = 250;      // materialize-in (D2 §11.2)
  const MAT_OUT_MS = 350;     // materialize-out
  const QUICK_OUT_MS = 180;   // flag tipQuick: dematerialize on --lgs-d-reduce, no grace
  const BAR_DELAY_MS = 800;
  const GAP = 12;             // px between owner and tip
  const INSET = 24;           // clamp inside the window
  const TIP_H = 48;
  const STYLE_ID = 'lgs-tip-style';
  const MARK = Symbol.for('lgs.p3.tooltipWrapper');

  // Base layout, look and motion. :where() keeps specificity at 0 so theme CSS (P4 / C3a) can
  // restyle it. Material: P4's thick glass tokens, edges from P4's edge hook (class lgs-edge +
  // data-lgs-mat="thick": E3 arcs on ::before), no border or outline (VP P-42). Motion: P5's
  // small-glass materialize keyframes and tokens, which are Reduce-Motion-correct by themselves.
  // Literal values are fallbacks for a theme without the tokens.
  const CSS = `
:where(.lgs-tip) {
  position: fixed; left: 0; top: 0; z-index: 7100; pointer-events: none; box-sizing: border-box; margin: 0;
  display: flex; align-items: center; height: var(--lgs-tooltip-h, ${TIP_H}px); padding: 0 20px;
  border-radius: var(--lgs-r-capsule, 999px); border: 0; outline: 0;
  max-width: calc(100vw - ${2 * INSET}px); white-space: nowrap;
  font-family: var(--lgs-font, "LGS Inter", "Motiva Sans", Arial, sans-serif);
  font-size: var(--lgs-fs-subhead, 20px); font-weight: 600; line-height: 24px;
  letter-spacing: 0; text-transform: none; font-style: normal;
  color: var(--lgs-text-1, rgb(255 255 255 / .96));
  background: var(--lgs-mat-thick-bg, linear-gradient(180deg, rgb(255 255 255 / .08), rgb(255 255 255 / 0) 30%), rgb(36 37 42 / .40));
  -webkit-backdrop-filter: var(--lgs-mat-thick-blur, blur(30px) saturate(1.5));
  backdrop-filter: var(--lgs-mat-thick-blur, blur(30px) saturate(1.5));
  box-shadow: var(--lgs-mat-thick-shade, inset 0 -12px 20px -12px rgb(0 0 0 / .20)), var(--lgs-shadow-5mm, 0 2px 6px rgb(0 0 0 / .30));
  transform-origin: 50% 0%;
}
:where(.lgs-tip)[data-placement="above"] { transform-origin: 50% 100%; }
:where(.lgs-tip) > .lgs-tip-label { overflow: hidden; text-overflow: ellipsis; }
:where(.lgs-tip)[data-state="hidden"] { display: none; }
:where(.lgs-tip)[data-state="measure"] { visibility: hidden; animation: none; }
:where(.lgs-tip)[data-state="in"] { animation: lgs-mat-glass-in var(--lgs-motion-mat-in, ${MAT_IN_MS}ms linear) backwards; }
:where(.lgs-tip)[data-state="in"] > .lgs-tip-label { animation: lgs-mat-content-in var(--lgs-motion-mat-in, ${MAT_IN_MS}ms linear) backwards; }
:where(.lgs-tip)[data-state="out"] { animation: lgs-mat-glass-out var(--lgs-motion-mat-out, ${MAT_OUT_MS}ms linear) forwards; }
:where(.lgs-tip)[data-state="out"] > .lgs-tip-label { animation: lgs-mat-content-out var(--lgs-d-mat-out, ${MAT_OUT_MS}ms) linear forwards; }
:where(.lgs-tip)[data-state="in"][data-resume], :where(.lgs-tip)[data-state="in"][data-resume] > .lgs-tip-label { animation: none; }
:where(.lgs-tip)[data-state="out"][data-quick], :where(.lgs-tip)[data-state="out"][data-quick] > .lgs-tip-label { animation-duration: var(--lgs-d-reduce, ${QUICK_OUT_MS}ms); }`;

  let R = null;
  let live = null;

  function log(level, msg, data) {
    try {
      const f = R && (level === 'error' ? R.error : level === 'warn' ? R.warn : R.log);
      if (typeof f === 'function') { f(msg, data); return; }
    } catch (_) { /* fall through */ }
    try { H.console[level === 'error' ? 'error' : 'log']('[lgs tooltip] ' + msg, data === undefined ? '' : data); } catch (_) { /* none */ }
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
  function flagOn(name) {
    try {
      const f = R && R.flags;
      if (!f) return false;
      if (typeof f.enabled === 'function') return !!f.enabled(name);
      if (typeof f.get === 'function') return !!f.get(name);
      return !!f[name];
    } catch (_) { return false; }
  }

  RT.define({
    name: 'tooltip',
    deps: ['input', 'attention'],
    flag: 'wp.p3',
    install(rt) {
      R = rt || RT;
      const input = inputOf(R);
      let att = null;
      try { att = typeof R.use === 'function' ? R.use('attention') : null; } catch (_) { att = null; }
      const attendFn = (att && att.attend) || R.attend || (PUB() && PUB().attend);
      if (!input || !input.hub || typeof attendFn !== 'function') throw new Error('tooltip: rt.input / rt.attend (P3) missing');
      const hub = input.hub;
      const onDoc = onDocOf(R, input);
      const lazySel = input.lazySel;
      const st = { regs: [], tips: new Map(), offs: [], bar: null, shown: 0, quick: flagOn('tipQuick') };
      live = st;
      // Fail closed (runtime.md §1 rule 2): set before any listener, registration or wrapper below.
      st.remove = () => {
        for (const off of st.offs.splice(0).reverse()) { try { off(); } catch (_) { /* gone */ } }
        for (const t of st.tips.values()) { H.clearTimeout(t.timer); try { t.node.remove(); } catch (_) { /* gone */ } }
        st.tips.clear();
        st.regs.length = 0;
        if (st.bar) {
          const { store, own, orig, wrapper } = st.bar;
          try {
            if (store.ShowTooltip === wrapper) {
              if (own) store.ShowTooltip = orig;
              else delete store.ShowTooltip;
            }
          } catch (_) { /* gone */ }
          st.bar = null;
        }
        // Belt and braces: no tip node or style left in any live popup.
        for (const w of hub.windows()) {
          try {
            for (const n of w.document.querySelectorAll('.lgs-tip, #' + STYLE_ID)) n.remove();
          } catch (_) { /* gone */ }
        }
      };
      const WR = typeof H.WeakRef === 'function' ? H.WeakRef : null;
      const weak = (el) => (el && WR ? new WR(el) : el);
      const strong = (r) => (r && WR && r instanceof WR ? r.deref() || null : r);

      // ---------------------------------------------- owners
      function regFor(el) {
        for (const r of st.regs) { try { if (r.self(el)) return r; } catch (_) { /* bad selector */ } }
        return null;
      }
      function isOwner(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el.hasAttribute('data-lgs-tip')) return true;
        return !!regFor(el);
      }
      function textFor(el, reg) {
        let t = '';
        try {
          if (reg && reg.text) {
            if (typeof reg.text === 'function') t = reg.text(el);
            else if (typeof reg.text === 'string' && reg.text.startsWith('@')) t = el.getAttribute(reg.text.slice(1));
            else t = reg.text;
          }
          if (!t) t = el.getAttribute('data-lgs-tip-text') || el.getAttribute('aria-label') || el.getAttribute('title') || '';
        } catch (_) { t = ''; }
        return String(t || '').replace(/\s+/g, ' ').trim();
      }
      function hasVisibleText(el) {
        try { return !!(el.innerText && el.innerText.trim()); } catch (_) { return false; }
      }
      function placementFor(el, reg) {
        const a = el.getAttribute('data-lgs-tip');
        if (a === 'above' || a === 'below') return a;
        if (reg && (reg.placement === 'above' || reg.placement === 'below')) return reg.placement;
        return 'auto';
      }
      function padNow(el, reg) { return el.getAttribute('data-lgs-tip-pad') === 'now' || !!(reg && reg.padNow); }

      // ---------------------------------------------- the per-window tip node
      function tipFor(doc) {
        let t = st.tips.get(doc);
        if (t && t.node.isConnected) return t;
        if (!doc.getElementById(STYLE_ID)) {
          const s = doc.createElement('style');
          s.id = STYLE_ID;
          s.textContent = CSS;
          (doc.head || doc.documentElement).appendChild(s);
        }
        const node = doc.createElement('div');
        node.className = 'lgs-tip lgs-edge';
        node.setAttribute('data-lgs-mat', 'thick');   // P4's edge hook: E3 arcs of thick glass on ::before
        node.setAttribute('role', 'tooltip');
        node.setAttribute('aria-hidden', 'true');
        node.setAttribute('data-state', 'hidden');
        const label = doc.createElement('span');
        label.className = 'lgs-tip-label';
        node.appendChild(label);
        (doc.body || doc.documentElement).appendChild(node);
        t = { doc, node, label, owner: null, lastOwner: null, timer: 0, shownAt: 0 };
        st.tips.set(doc, t);
        return t;
      }
      function show(el, why) {
        if (live !== st || !el || !el.isConnected) return false;
        const reg = regFor(el);
        const text = textFor(el, reg);
        if (!text) return false;
        if (!(reg && reg.force) && hasVisibleText(el)) return false;   // VP P-12: icon-only owners
        const doc = el.ownerDocument;
        const w = doc.defaultView;
        const t = tipFor(doc);
        H.clearTimeout(t.timer);
        const same = t.owner === el && t.node.getAttribute('data-state') === 'in';
        t.owner = el;
        if (t.label.textContent !== text) t.label.textContent = text;
        const r = el.getBoundingClientRect();
        let place = placementFor(el, reg);
        if (place === 'auto') place = (r.bottom > w.innerHeight * (600 / 720) || r.bottom + GAP + TIP_H + INSET > w.innerHeight) ? 'above' : 'below';
        if (!same) { t.node.removeAttribute('data-resume'); t.node.setAttribute('data-state', 'measure'); }   // laid out, invisible, no animation
        const tw = Math.min(t.node.offsetWidth || 0, w.innerWidth - 2 * INSET) || 120;
        const x = Math.round(Math.max(INSET, Math.min(w.innerWidth - INSET - tw, r.left + r.width / 2 - tw / 2)));
        const y = Math.round(place === 'below' ? r.bottom + GAP : r.top - GAP - TIP_H);
        t.node.style.left = x + 'px';
        t.node.style.top = Math.max(INSET / 2, Math.min(w.innerHeight - TIP_H - INSET / 2, y)) + 'px';
        t.node.style.setProperty('--lgs-maxside', String(Math.round(Math.max(tw, TIP_H))));   // P5's materialize swell s0
        t.node.setAttribute('data-placement', place);
        if (!same) { t.node.setAttribute('data-state', 'in'); t.shownAt = H.performance.now(); st.shown++; }
        t.why = why;
        return true;
      }
      function hide(el, immediate) {
        for (const t of st.tips.values()) {
          if (el && t.owner !== el) continue;
          if (t.node.getAttribute('data-state') === 'hidden') { t.owner = null; continue; }
          H.clearTimeout(t.timer);
          t.lastOwner = weak(t.owner);   // weak: only for tipQuick's return within the leave
          t.owner = null;
          t.node.removeAttribute('data-resume');
          if (immediate) { t.node.setAttribute('data-state', 'hidden'); continue; }
          if (st.quick) t.node.setAttribute('data-quick', ''); else t.node.removeAttribute('data-quick');
          t.node.setAttribute('data-state', 'out');
          t.hiddenAt = H.performance.now();
          t.timer = H.setTimeout(() => { if (!t.owner) t.node.setAttribute('data-state', 'hidden'); }, st.quick ? QUICK_OUT_MS : MAT_OUT_MS);
        }
      }
      // tipQuick only (no leave grace there): attention that returns to the same owner while its tooltip
      // is still leaving brings it straight back, with no new delay, so laser jitter cannot flicker it.
      function resume(el) {
        for (const t of st.tips.values()) {
          if (strong(t.lastOwner) !== el || !t.node.isConnected || t.node.getAttribute('data-state') !== 'out' || !el.isConnected) continue;
          H.clearTimeout(t.timer);
          t.owner = el;
          t.node.setAttribute('data-resume', '');
          t.node.setAttribute('data-state', 'in');
          t.why = 'resume';
        }
      }

      // ---------------------------------------------- attention: 0.8 s in, 0.2 s out (both inputs)
      // Default (PLAN §1.13, D2 §11 "After 0.8 s, materialize 250 ms | 0.2 s, dematerialize 350 ms", MO
      // §4.17, Apple's 0.8 s / 0.2 s reveal delays): the materialize starts at 0.8 s, the leave starts
      // 0.2 s after attention ends. Flag tipQuick (P3-D4): the card's literal IN-7 instead, fully in
      // at 0.8 s (start at 0.8 - 0.25 s) and gone 0.18 s after leave (no grace, see resume()).
      function attendOpts() {
        return {
          dwellMs: st.quick ? IN_MS - MAT_IN_MS : IN_MS,
          leaveMs: st.quick ? 0 : OUT_MS,
          classes: false,
          onEnter(el, ev) {
            const padLike = ev.source === 'pad' || (ev.source === 'feed' && input.mode === 'pad');
            if (padLike && padNow(el, regFor(el))) { show(el, 'pad-now'); return; }
            if (st.quick) resume(el);
          },
          onDwell(el, ev) { show(el, ev.source); },
          onLeave(el) { hide(el, false); },
        };
      }
      let handle = attendFn(isOwner, attendOpts());
      st.offs.push(() => handle.off());
      try {
        if (R.flags && typeof R.flags.on === 'function') {
          const offQ = R.flags.on('tipQuick', () => {
            if (live !== st) return;
            const q = flagOn('tipQuick');
            if (q === st.quick) return;
            st.quick = q;
            try { handle.off(); } catch (_) { /* gone */ }
            handle = attendFn(isOwner, attendOpts());
          });
          if (typeof offQ === 'function') st.offs.push(offQ);
        }
      } catch (err) { log('warn', 'flag tipQuick not watched', String(err)); }
      // A route change or a scroll can move the owner away; Steam removes it from the DOM: hide.
      st.offs.push(onDoc((w, doc) => {
        const onScroll = () => { const t = st.tips.get(doc); if (t && t.owner) hide(t.owner, true); };
        doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
        return () => {
          doc.removeEventListener('scroll', onScroll, { capture: true, passive: true });
          const t = st.tips.get(doc);
          if (t) { H.clearTimeout(t.timer); try { t.node.remove(); } catch (_) { /* gone */ } st.tips.delete(doc); }
          try { const s = doc.getElementById(STYLE_ID); if (s) s.remove(); } catch (_) { /* gone */ }
        };
      }));

      // ---------------------------------------------- bar tooltips: Steam's own popup, 0.8 s (CTL P-C5)
      try {
        const store = H.vrPooledPopupStore
          || (H.SteamUIStore && H.SteamUIStore.WindowStore && H.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance
            && H.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.VRPooledPopupStore);
        if (store && typeof store.ShowTooltip === 'function' && !store.ShowTooltip[MARK]) {
          const own = Object.prototype.hasOwnProperty.call(store, 'ShowTooltip');
          const orig = store.ShowTooltip;
          const wrapper = function lgsShowTooltip(el, text, params, fn) {
            let p = params;
            try {
              if (live === st && !(p && p.unDelayMS >= BAR_DELAY_MS)) p = Object.assign({}, p || {}, { unDelayMS: BAR_DELAY_MS });
            } catch (_) { p = params; }
            return orig.call(this, el, text, p, fn);
          };
          wrapper[MARK] = true;
          store.ShowTooltip = wrapper;
          st.bar = { store, own, orig, wrapper };
        } else if (!store) {
          log('error', 'vrPooledPopupStore not found: bar tooltips keep Steam\'s delay');
        }
      } catch (err) { log('error', 'bar wrapper failed', String(err)); }

      const tooltip = {
        register(target, opts) {
          if (live !== st) return () => {};
          const o = opts || {};
          let self;
          if (typeof target === 'string') { const get = lazySel(target); self = (el) => { const sel = get(); return !!sel && el.matches(sel); }; }
          else if (typeof target === 'function') self = (el) => !!target(el);
          else if (target && target.nodeType === 1) self = (el) => el === target;
          else throw new Error('tooltip.register: target must be an Element, a selector or a function');
          const reg = { self, text: o.text, placement: o.placement, padNow: !!o.padNow, force: !!o.force };
          st.regs.push(reg);
          return () => { const i = st.regs.indexOf(reg); if (i >= 0) st.regs.splice(i, 1); };
        },
        state() {
          const shown = [];
          for (const t of st.tips.values()) {
            const s = t.node.getAttribute('data-state');
            if (s === 'hidden') continue;
            const r = t.node.getBoundingClientRect();
            shown.push({
              surface: hub.surfaceOf(t.doc.defaultView), state: s, text: t.label.textContent, placement: t.node.getAttribute('data-placement'),
              rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
              shownAt: t.shownAt, why: t.why,
            });
          }
          let mapTooltips = null;
          try { mapTooltips = st.bar ? st.bar.store.m_mapTooltips.size : null; } catch (_) { mapTooltips = null; }
          return {
            shown, owners: st.regs.length, barWrapper: !!(st.bar && st.bar.store.ShowTooltip === st.bar.wrapper), mapTooltips, count: st.shown,
            timing: st.quick ? { quick: true, startMs: IN_MS - MAT_IN_MS, inMs: MAT_IN_MS, graceMs: 0, outMs: QUICK_OUT_MS }
              : { quick: false, startMs: IN_MS, inMs: MAT_IN_MS, graceMs: OUT_MS, outMs: MAT_OUT_MS },
          };
        },
        hideAll() { hide(null, true); },
        // Test hooks.
        show(el) { return show(el, 'test'); },
        hide(el) { hide(el || null, false); },
      };
      st.api = tooltip;
      expose(R, 'tooltip', tooltip, st.offs);
      return tooltip;
    },
    remove() {
      const st = live;
      live = null;
      if (st && st.remove) st.remove();
      const P = PUB();
      if (P && st && P.tooltip === st.api) delete P.tooltip;
      R = null;
    },
  });
})();
