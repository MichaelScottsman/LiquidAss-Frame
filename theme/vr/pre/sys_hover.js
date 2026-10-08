/* vr:systemui. Laser-hover emulation that also covers the theme's nested
   rules (the inventory's sys_hover.js only clones top-level :hover rules, so
   it can't show html.lgs-on { ... } hovers). Clones every :hover rule, nested
   ones re-emitted inside html.lgs-on, to [data-lgs-hover]; marks the grab
   handle, the resize handle, the frame-controls container and its first
   button; lifts the container's idle .6 opacity the way a real hover does
   (SteamVR writes it as :not(:hover)). Display-only, reverts after 5 s. */
(async () => {
  const st = document.createElement('style'); st.id = 'lgs-vr-hover';
  const out = [];
  const conv = (s) => s.replace(/:hover/g, '[data-lgs-hover]');
  const walk = (rules, nest) => { for (const r of rules) {
    if (r.selectorText && r.cssRules && r.cssRules.length) { walk(r.cssRules, (nest || []).concat(r.selectorText)); }
    if (r.selectorText && r.selectorText.includes(':hover')) {
      // the clone carries no transition: the hover state shows at once, and the lab's MOTION gate (which
      // counts any lgs-* sheet as ours) never reads SteamVR's own 0.04 s button timing as the theme's
      const decl = Array.from(r.style).filter((p) => !p.startsWith('transition'))
        .map((p) => p + ':' + r.style.getPropertyValue(p) + (r.style.getPropertyPriority(p) ? ' !important' : '')).join(';');
      let txt = conv(r.selectorText) + '{' + decl + '}';
      for (const p of (nest || []).slice().reverse()) txt = p + '{' + txt + '}';
      out.push(txt);
    } } };
  for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; } if (sh.ownerNode && sh.ownerNode.id === 'lgs-vr-hover') continue; walk(rs, null); }
  const c = (t) => L.index.selector(t).sel;
  out.push(c('FrameControlsContainer') + '[data-lgs-hover]{opacity:1 !important}');
  st.textContent = out.join('\n'); document.head.appendChild(st);
  const marked = [];
  for (const s of ['%{GrabHandleButton}', '%{ResizeHandleButton}', '%{FrameControlsContainer}', '%{FrameControlsContainer} .ButtonControl']) {
    const el = L.q('vr:systemui', s); if (el) { el.setAttribute('data-lgs-hover', ''); marked.push(s); }
  }
  setTimeout(() => { st.remove(); document.querySelectorAll('[data-lgs-hover]').forEach((e) => e.removeAttribute('data-lgs-hover')); }, 5000);
  return { rules: out.length, marked };
})()
