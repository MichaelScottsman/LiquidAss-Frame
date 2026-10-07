/* vr:systemui. Emulates laser hover: clones every :hover rule to [data-lgs-hover] and marks the grab handle, resize handle, frame-controls container and its first button. Auto-reverts after 5 s. Limitation: rules written as :not(:hover) still match, so the frame-controls container stays at opacity .6 here (real hover = 1). */
(async () => {
  const st = document.createElement('style'); st.id = 'lgs-inv-hover';
  const rules = [];
  for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; }
    for (const r of rs) if (r.selectorText && r.selectorText.includes(':hover')) rules.push(r.selectorText.replace(/:hover/g, '[data-lgs-hover]') + '{' + r.style.cssText + '}'); }
  st.textContent = rules.join('\n'); document.head.appendChild(st);
  const marked = [];
  for (const s of ['%{GrabHandleButton}', '%{ResizeHandleButton}', '%{FrameControlsContainer}', '%{FrameControlsContainer} .ButtonControl']) {
    const el = L.q('vr:systemui', s); if (el) { el.setAttribute('data-lgs-hover', ''); marked.push(s); }
  }
  setTimeout(() => { st.remove(); document.querySelectorAll('[data-lgs-hover]').forEach((e) => e.removeAttribute('data-lgs-hover')); }, 5000);
  return { rules: rules.length, marked };
})()
