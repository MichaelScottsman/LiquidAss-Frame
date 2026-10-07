// Glass Shell phase 2, C1a pointer proxy (T2): module `pointer`, flag `wp.c1a`.
// Concept: docs/phase2/concepts/window-nav.md §3.6; PLAN §1.11, sign-off S16 (flag pointerProxy).
// In native mode glassd's opaque cover sits over Steam's real panel, so SteamVR's own laser dot may be
// drawn behind it (no agent can see it). The shell then draws its own ring inside Steam's texture, so
// it shows in every base and popped crop. Only while the window carries html.lgs-native (P6/P8), never
// in CSS-only mode, where SteamVR's dot is visible (VP P-11; a recorded deviation, PLAN §4.4).
//   pointerProxy = "native" (default): only in native mode; "on": always (tests); "off": never.
// One div.lgs-pointer per covered document (main, bar, frame.menu), position: fixed, pointer-events none,
// moved with translate from pointermove (rAF-throttled); hidden on leave. Removed by remove() (G-REMOVE).
(function lgsC1aPointer() {
  'use strict';
  const RT = (typeof __LGS_RT !== 'undefined') ? __LGS_RT : window.__LGS_RT;
  if (!RT || typeof RT.define !== 'function') return;

  const H = window;
  const KINDS = new Set(['main', 'bar', 'frame.menu']);
  let S = null;

  function mode() {
    const v = S && S.rt.flags.get('pointerProxy');
    if (v === undefined || v === null || v === '') return 'native';
    if (v === true || v === 'on' || v === 'always') return 'on';
    if (v === false || v === 'off' || v === 'none' || v === 0 || v === '0') return 'off';
    return 'native';
  }

  function attach(entry) {
    if (!KINDS.has(entry.kind)) return undefined;
    const w = entry.win, doc = entry.doc, html = entry.html;
    const st = { node: null, x: 0, y: 0, raf: 0, inside: false };
    const active = () => {
      const m = mode();
      return m === 'on' || (m === 'native' && html.classList.contains('lgs-native'));
    };
    const ensure = () => {
      if (!active()) { if (st.node) { st.node.remove(); st.node = null; } return null; }
      if (!st.node || !st.node.isConnected) {
        st.node = doc.createElement('div');
        st.node.className = 'lgs-pointer';
        st.node.setAttribute('aria-hidden', 'true');
        (doc.body || doc.documentElement).appendChild(st.node);
      }
      return st.node;
    };
    const paint = () => {
      st.raf = 0;
      const n = ensure();
      if (!n) return;
      n.style.translate = st.x + 'px ' + st.y + 'px';
      n.classList.toggle('lgs-pointer-on', st.inside);
    };
    const onMove = (ev) => {
      st.x = ev.clientX; st.y = ev.clientY; st.inside = true;
      if (!st.raf) st.raf = w.requestAnimationFrame(paint);
    };
    const onLeave = () => { st.inside = false; if (!st.raf) st.raf = w.requestAnimationFrame(paint); };
    const offs = [
      S.rt.listen(doc, 'pointermove', onMove, { passive: true, capture: true }),
      S.rt.listen(doc.documentElement, 'pointerleave', onLeave, { passive: true }),
      S.rt.listen(w, 'blur', onLeave, { passive: true }),
    ];
    // native mode comes and goes with html.lgs-native (P6's native CSS class)
    const mo = new w.MutationObserver(() => { if (!st.raf) st.raf = w.requestAnimationFrame(paint); });
    mo.observe(html, { attributes: true, attributeFilter: ['class'] });
    S.repaint.add(paint);
    return () => {
      mo.disconnect();
      for (const off of offs) { try { off(); } catch (_) { /* gone */ } }
      if (st.raf) { try { w.cancelAnimationFrame(st.raf); } catch (_) { /* gone */ } }
      if (st.node) st.node.remove();
      if (S) S.repaint.delete(paint);
    };
  }

  RT.define({
    name: 'pointer',
    flag: 'wp.c1a',
    install(rt) {
      S = { rt, repaint: new Set() };
      rt.windows.track(attach);
      rt.flags.on('pointerProxy', () => { if (S) for (const p of S.repaint) p(); });
      return { mode, nodes() { let n = 0; rt.windows.each((e) => { n += e.doc.querySelectorAll('.lgs-pointer').length; }); return n; } };
    },
    remove() {
      try { RT.windows && RT.windows.each && RT.windows.each((e) => e.doc.querySelectorAll('.lgs-pointer').forEach((n) => n.remove())); } catch (_) { /* gone */ }
      S = null;
      return { patchedLeft: 0 };
    },
  });
})();
