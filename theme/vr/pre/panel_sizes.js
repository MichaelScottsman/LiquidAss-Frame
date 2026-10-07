/* vr:systemui. Compares every vsg-node[vsg-type=panel] box (each one a VR
   quad) with html.lgs-on removed (stock) and restored (themed). They must be
   identical: the theme may not change a quad's size. Display-only. */
(async () => {
  const html = document.documentElement;
  const boxes = () => [...document.querySelectorAll('vsg-node[vsg-type="panel"]')].map((n) => {
    const r = n.getBoundingClientRect();
    return Math.round(r.width) + 'x' + Math.round(r.height);
  });
  if (!html.classList.contains('lgs-on')) return 'theme not applied';
  html.classList.remove('lgs-on');
  await L.sleep(500);
  const a = boxes();
  html.classList.add('lgs-on');
  await L.sleep(600);
  const b = boxes();
  const same = a.length === b.length && a.every((v, i) => v === b[i]);
  return 'PANELS ' + (same ? 'identical' : 'DIFFER') + ': stock ' + a.join(' ') + (same ? '' : ' | themed ' + b.join(' '));
})()
