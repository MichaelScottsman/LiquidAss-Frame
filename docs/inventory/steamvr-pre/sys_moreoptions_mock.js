/* vr:systemui. STATIC MOCK of the "More Options" popout (%{AdditionalOptions}) built from SteamVR's own classes, absolutely positioned at (900,40) in <body> outside vsg-app (no panel, no UV change), removed after 5 s. Opening the real popout is NOT side-effect free: it calls inputFocus.FocusAdditionalOptions() and moves the user's input focus. */
(async () => {
  const c = (t) => L.index.selector(t).sel.slice(1);
  const host = document.createElement('div');
  host.id = 'lgs-inv-mock';
  host.setAttribute('style', 'position:absolute; left:900px; top:40px;');
  const panel = document.createElement('div');
  panel.setAttribute('vsg-type', 'panel');
  const ao = document.createElement('div');
  ao.className = c('AdditionalOptions');
  const icons = L.qa('vr:systemui', '%{FrameControlsContainer} .ButtonControl svg');
  [['Toggle Curvature', 0], ['Dock on Left Controller', 1], ['Dock on Right Controller', 2]].forEach(([label, i]) => {
    const row = document.createElement('div');
    row.className = 'ButtonControl WithIcon LargeIcon ' + c('AdditionalOptionsRow') + (i === 1 ? ' ' + c('GamepadFocused') : '');
    const svg = icons[i % icons.length].cloneNode(true);
    row.appendChild(svg);
    const span = document.createElement('span');
    span.className = c('AdditionalOptionsLabel');
    span.textContent = label;
    row.appendChild(span);
    ao.appendChild(row);
  });
  panel.appendChild(ao);
  host.appendChild(panel);
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 5000);
  await L.sleep(100);
  return L.outline('vr:systemui', { sel: '#lgs-inv-mock', max: 30 });
})()
