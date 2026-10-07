/* vr:controllerbindingui. Read-only "Viewing <binding>" page of the binding already in use for VR Dashboard: calls the list component's ViewBinding(url, true) (SetBindingURL + GET of the config; no SelectConfig), returns to the app list after 6 s. Never press Select / Edit / Export / Replace Default / Options items. */
(async () => {
  const fib = (el) => el && el[Object.keys(el).find((x) => x.startsWith('__reactFiber'))];
  const t = [...document.querySelectorAll('.AppSelectContainer')].find((e) => /dashboard/i.test(e.innerText));
  if (!t) return 'no VR Dashboard entry';
  t.setAttribute('data-lgs-t', '1'); L.click('vr:controllerbindingui', '[data-lgs-t]'); t.removeAttribute('data-lgs-t');
  await L.sleep(2500);
  let url = null, viewer = null;
  for (const e of document.querySelectorAll('.BindingEntry')) {
    for (let f = fib(e); f; f = f.return) {
      if (!url && f.memoizedProps && f.memoizedProps.bCurrentlySelectedBinding && f.memoizedProps.result) url = f.memoizedProps.result.url;
      if (!viewer && f.stateNode && typeof f.stateNode.ViewBinding === 'function') viewer = f.stateNode;
    }
  }
  if (!url || !viewer) { inputUI.ShowAppSelect(); return 'no current binding url/viewer ' + !!url + ' ' + !!viewer; }
  viewer.ViewBinding(url, true);   // read-only preview of the binding already in use
  await L.sleep(3000);
  const out = 'state ' + inputUI.GetUIState + ' url ' + url + '\n' + L.outline('vr:controllerbindingui', { max: 260 });
  setTimeout(() => inputUI.ShowAppSelect(), 6000);
  return out;
})()
