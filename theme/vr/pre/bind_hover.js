/* vr:controllerbindingui. Laser-hover emulation that also covers the theme's
   nested rules: clones every :hover rule to [data-lgs-hover] and marks the
   2nd app row, the title bar's Back button and "Show More Applications" on
   the app list, or on a binding view the first non-selected action-set tab
   and the first fill button. Override the targets with
     window.__LGS_BIND_HOVER = ['selector', ...], <this script>
   Display-only; reverts after 5 s. Never clicks. */
(async () => {
  const sels = window.__LGS_BIND_HOVER || ['.AppSelectContainer:nth-child(2)', '.PageTitleBackButton', '.AppSelectShowMoreButton', '.Label.Tab:not(.Selected)', '.BindingInputSection .ButtonControl'];
  delete window.__LGS_BIND_HOVER;
  const st = document.createElement('style'); st.id = 'lgs-vr-bind-hover';
  const out = [];
  const walk = (rules, nest) => { for (const r of rules) {
    if (r.selectorText && r.cssRules && r.cssRules.length) walk(r.cssRules, (nest || []).concat(r.selectorText));
    if (r.selectorText && r.selectorText.includes(':hover')) { let t = r.selectorText.replace(/:hover/g, '[data-lgs-hover]') + '{' + r.style.cssText + '}'; for (const p of (nest || []).slice().reverse()) t = p + '{' + t + '}'; out.push(t); } } };
  for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; } walk(rs, null); }
  st.textContent = out.join('\n'); document.head.appendChild(st);
  const marks = sels.map((s) => document.querySelector(s)).filter(Boolean);
  marks.forEach((e) => e.setAttribute('data-lgs-hover', ''));
  setTimeout(() => { marks.forEach((e) => e.removeAttribute('data-lgs-hover')); st.remove(); }, 5000);
  return 'hover on ' + marks.map((e) => e.className.split(' ').slice(0, 2).join('.')).join(', ');
})()
