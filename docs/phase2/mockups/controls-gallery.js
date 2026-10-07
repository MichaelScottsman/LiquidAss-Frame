/* Sidebar of the controls gallery (a spec board drawn as the /zoo route: `window` glass 1280 x 656, docs/phase2/concepts/controls.md §3).
 * Back circle at (24, 24) with its 80 px box at (14, 14), the Large Title at x 100 centred on it, the page list from y 108
 * (rows 72 + 8, navigation selection = white .18 + top arc + Semibold; the list scrolls under a bottom fade).
 * Runs synchronously at the end of <body>, before kit.js, so kit.js renders the icons it inserts.
 * <div class="cg-side" data-sel="Buttons" [data-hover="Lists"]></div> */
(() => {
  const PAGES = [
    ['Buttons', 'btncircle', 'var(--lg-blue)'],
    ['Switches & Sliders', 'switch', 'var(--lg-green)'],
    ['Pickers', 'updown', 'var(--lg-indigo)'],
    ['Text Fields', 'ibeam', 'var(--lg-purple)'],
    ['Lists', 'list', 'var(--lg-orange)'],
    ['Hover & Focus', 'pointer', 'var(--lg-teal)'],
    ['Keyboard', 'keyboard', 'var(--lg-gray)'],
  ];
  document.querySelectorAll('.cg-side[data-sel]').forEach(side => {
    const sel = side.dataset.sel, hov = side.dataset.hover;
    side.innerHTML = '<span class="lgk-btn circle cg-back" data-id="back"><i data-i="chevron-left"></i></span><div class="t-large">Controls</div><div class="cg-nav">' + PAGES.map(([name, icon, col]) =>
      `<div class="lgk-row${name === sel ? ' is-nav-selected' : ''}${name === hov ? ' is-hover' : ''}"${name === hov ? ' style="--hx:70%; --hy:48%"' : ''}><span class="chip" style="background:${col}"><i data-i="${icon}"></i></span><span class="lab">${name.replace('&', '&amp;')}</span></div>`).join('') + '</div>';
  });
})();
