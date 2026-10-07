/* vr:controllerbindingui. Clicks "Show More Applications" (component-local state), resets that state through the React fiber after 5 s. */
(async () => {
  L.click('vr:controllerbindingui', '.AppSelectShowMoreButton');
  await L.sleep(800);
  const n = document.querySelectorAll('.AppSelectContainer').length;
  setTimeout(() => {
    // reset the local "show more" state of the app-select column
    const el = document.querySelector('.AppSelectColumn');
    const k = el && Object.keys(el).find((x) => x.startsWith('__reactFiber'));
    for (let f = k && el[k]; f; f = f.return) { if (f.stateNode && f.stateNode.state && 'bShowRecentApps' in f.stateNode.state) { f.stateNode.setState({ bShowRecentApps: false }); break; } }
  }, 5000);
  return { apps: n, state: inputUI.GetUIState };
})()
