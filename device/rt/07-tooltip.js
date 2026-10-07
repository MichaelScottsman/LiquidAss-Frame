// Glass Shell phase 2, P3 interaction runtime: tooltips (PLAN §1.13, CTL §11, VP P-12).
// Contract: docs/phase2/contracts/interaction.md §4. Evidence: docs/phase2/wp/P3.md.
//
//   In-window: one div.lgs-tip per Steam window, for icon-only owners ([data-lgs-tip] or
//              rt.tooltip.register). In after 0.8 s of attention (laser dwell or gamepad focus),
//              out 0.2 s after leave; [data-lgs-tip-pad="now"] shows at once under gamepad focus.
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
  const BAR_DELAY_MS = 800;
  const GAP = 12;             // px between owner and tip
  const INSET = 24;           // clamp inside the window
  const TIP_H = 48;
  const STYLE_ID = 'lgs-tip-style';
  const MARK = Symbol.for('lgs.p3.tooltipWrapper');

  // Base look and motion. :where() keeps specificity at 0 so theme CSS (P4 / C3a) can restyle it.
  // Thick glass capsule, edges from a specular sheen only: no border, no outline (VP P-42).
  const CSS = `
:where(.lgs-tip) {
  position: fixed; left: 0; top: 0; z-index: 7100; pointer-events: none; box-sizing: border-box;
  display: flex; align-items: center; height: ${TIP_H}px; padding: 0 22px; border-radius: ${TIP_H / 2}px;
  max-width: calc(100vw - ${2 * INSET}px); white-space: nowrap; overflow: hidden; border: 0; outline: 0;
  font-family: var(--lgs-font, "LGS Inter", "Inter", "Motiva Sans", Arial, sans-serif);
  font-size: 20px; font-weight: 600; line-height: 24px; letter-spacing: 0; text-transform: none; font-style: normal;
  color: rgb(255 255 255 / .96);
  background:
    radial-gradient(120% 140% at 26% 0%, rgb(255 255 255 / .10), transparent 60%),
    var(--lgs-tip-tint, rgb(26 28 38 / .56));
  -webkit-backdrop-filter: blur(30px) saturate(1.8); backdrop-filter: blur(30px) saturate(1.8);
  box-shadow: inset 0 1.5px 1.5px -1px rgb(255 255 255 / .55), inset 0 -1.5px 2px -1px rgb(255 255 255 / .12),
    0 10px 28px rgb(0 0 0 / .28);
  transform-origin: 50% 0%;
}
:where(.lgs-tip)[data-placement="above"] { transform-origin: 50% 100%; }
:where(.lgs-tip) > .lgs-tip-label { overflow: hidden; text-overflow: ellipsis; }
:where(.lgs-tip)[data-state="hidden"] { display: none; }
:where(.lgs-tip)[data-state="measure"] { visibility: hidden; animation: none; }
:where(.lgs-tip)[data-state="in"] { animation: lgs-tip-glass-in ${MAT_IN_MS}ms linear backwards; }
:where(.lgs-tip)[data-state="in"] > .lgs-tip-label { animation: lgs-tip-content-in ${MAT_IN_MS}ms linear backwards; }
:where(.lgs-tip)[data-state="out"] { animation: lgs-tip-glass-out ${MAT_OUT_MS}ms linear forwards; }
:where(.lgs-tip)[data-state="out"] > .lgs-tip-label { animation: lgs-tip-content-out ${MAT_OUT_MS}ms linear forwards; }
@keyframes lgs-tip-glass-in {
  0% { scale: var(--lgs-tip-s0, 1.06); opacity: 0; -webkit-backdrop-filter: blur(0px) saturate(1); backdrop-filter: blur(0px) saturate(1); }
  92%, 100% { scale: 1; opacity: 1; -webkit-backdrop-filter: blur(30px) saturate(1.8); backdrop-filter: blur(30px) saturate(1.8); }
}
@keyframes lgs-tip-content-in { 0%, 35% { opacity: 0; filter: blur(8px); } 100% { opacity: 1; filter: blur(0px); } }
@keyframes lgs-tip-content-out { 0% { opacity: 1; filter: blur(0px); } 55%, 100% { opacity: 0; filter: blur(8px); } }
@keyframes lgs-tip-glass-out {
  0%, 40% { scale: 1; opacity: 1; }
  100% { scale: var(--lgs-tip-s0, 1.06); opacity: 0; -webkit-backdrop-filter: blur(0px) saturate(1); backdrop-filter: blur(0px) saturate(1); }
}
@keyframes lgs-tip-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes lgs-tip-fade-out { from { opacity: 1; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  :where(.lgs-tip)[data-state="in"] { animation: lgs-tip-fade-in 150ms linear backwards; }
  :where(.lgs-tip)[data-state="out"] { animation: lgs-tip-fade-out 150ms linear forwards; }
  :where(.lgs-tip)[data-state] > .lgs-tip-label { animation: none; }
}
@media (prefers-contrast: more) {
  :where(.lgs-tip) { background: rgb(18 20 28 / .96); box-shadow: inset 0 0 0 2px rgb(255 255 255 / .70); }
}`;

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
  function inputOf(rt) {
    try { if (rt && typeof rt.use === 'function') return rt.use('input'); } catch (_) { /* not via use */ }
    return (rt && rt.input) || (PUB() && PUB().input) || null;
  }
  function resolve(sel) {
    if (typeof sel !== 'string' || sel.indexOf('%{') < 0) return sel;
    return sel.replace(/%\{([^}]+)\}/g, (_, tok) => {
      try {
        const r = H.__LGS_INDEX && typeof H.__LGS_INDEX.selector === 'function' ? H.__LGS_INDEX.selector(tok) : null;
        if (r && r.sel) return r.sel;
      } catch (_) { /* unresolved */ }
      log('error', 'unresolved token ' + tok);
      return '.lgs-unresolved';
    });
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
      const st = { regs: [], tips: new Map(), offs: [], bar: null, shown: 0 };
      live = st;

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
        node.className = 'lgs-tip';
        node.setAttribute('role', 'tooltip');
        node.setAttribute('aria-hidden', 'true');
        node.setAttribute('data-state', 'hidden');
        const label = doc.createElement('span');
        label.className = 'lgs-tip-label';
        node.appendChild(label);
        (doc.body || doc.documentElement).appendChild(node);
        t = { doc, node, label, owner: null, timer: 0, shownAt: 0 };
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
        if (!same) t.node.setAttribute('data-state', 'measure');   // laid out, invisible, no animation
        const tw = Math.min(t.node.offsetWidth || 0, w.innerWidth - 2 * INSET) || 120;
        const x = Math.round(Math.max(INSET, Math.min(w.innerWidth - INSET - tw, r.left + r.width / 2 - tw / 2)));
        const y = Math.round(place === 'below' ? r.bottom + GAP : r.top - GAP - TIP_H);
        t.node.style.left = x + 'px';
        t.node.style.top = Math.max(INSET / 2, Math.min(w.innerHeight - TIP_H - INSET / 2, y)) + 'px';
        t.node.style.setProperty('--lgs-tip-s0', String(1 + Math.min(0.15, Math.max(0.01, 12 / Math.max(tw, TIP_H)))));
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
          t.owner = null;
          if (immediate) { t.node.setAttribute('data-state', 'hidden'); continue; }
          t.node.setAttribute('data-state', 'out');
          t.hiddenAt = H.performance.now();
          t.timer = H.setTimeout(() => { if (!t.owner) t.node.setAttribute('data-state', 'hidden'); }, MAT_OUT_MS);
        }
      }

      // ---------------------------------------------- attention: 0.8 s in, 0.2 s out (both inputs)
      const handle = attendFn(isOwner, {
        dwellMs: IN_MS,
        leaveMs: OUT_MS,
        classes: false,
        onEnter(el, ev) {
          const padLike = ev.source === 'pad' || (ev.source === 'feed' && input.mode === 'pad');
          if (padLike && padNow(el, regFor(el))) show(el, 'pad-now');
        },
        onDwell(el, ev) { show(el, ev.source); },
        onLeave(el) { hide(el, false); },
      });
      st.offs.push(() => handle.off());
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
          if (typeof target === 'string') { const sel = resolve(target); self = (el) => el.matches(sel); }
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
          return { shown, owners: st.regs.length, barWrapper: !!(st.bar && st.bar.store.ShowTooltip === st.bar.wrapper), mapTooltips, count: st.shown };
        },
        hideAll() { hide(null, true); },
        // Test hooks.
        show(el) { return show(el, 'test'); },
        hide(el) { hide(el || null, false); },
      };
      st.api = tooltip;
      PUB().tooltip = tooltip;
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
