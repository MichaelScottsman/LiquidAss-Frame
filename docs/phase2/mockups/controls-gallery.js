/* Sidebar of the controls gallery (a spec board drawn as a visionOS window; docs/phase2/concepts/controls.md §3).
 * Runs synchronously at the end of <body>, before kit.js, so kit.js renders the icons it inserts.
 * <div class="cg-side" data-sel="Buttons"></div> */
(() => {
  const PAGES = [
    ['Buttons', 'btncircle', 'var(--lg-blue)'],
    ['Switches & Sliders', 'switch', 'var(--lg-green)'],
    ['Pickers', 'updown', 'var(--lg-indigo)'],
    ['Text Fields', 'ibeam', 'var(--lg-purple)'],
    ['Lists', 'list', 'var(--lg-orange)'],
    ['Keyboard', 'keyboard', 'var(--lg-gray)'],
    ['Hover & Focus', 'pointer', 'var(--lg-teal)'],
  ];
  document.querySelectorAll('.cg-side[data-sel]').forEach(side => {
    const sel = side.dataset.sel;
    side.innerHTML = '<div class="t-large">Controls</div><div class="cg-nav">' + PAGES.map(([name, icon, col]) =>
      `<div class="lgk-row${name === sel ? ' is-nav-selected' : ''}"><span class="chip" style="background:${col}"><i data-i="${icon}"></i></span>${name.replace('&', '&amp;')}</div>`).join('') + '</div>';
  });
})();
