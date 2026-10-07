/* vr:controllerbindingui. Opens the binding list for "VR Dashboard" (SetSelectedApp + ShowBindingList: read-only loads), prints the outline, returns to the app list (inputUI.ShowAppSelect) after 6 s. Never press Activate / Edit / Create New Binding / Delete there. */
(async () => {
  const before = inputUI.GetUIState;
  const t = [...document.querySelectorAll('.AppSelectContainer')].find((e) => /dashboard/i.test(e.innerText));
  if (!t) return 'no VR Dashboard entry';
  t.setAttribute('data-lgs-t', '1');
  L.click('vr:controllerbindingui', '[data-lgs-t]');
  t.removeAttribute('data-lgs-t');
  await L.sleep(2500);
  const out = { before, now: inputUI.GetUIState, outline: L.outline('vr:controllerbindingui', { max: 160 }) };
  setTimeout(() => inputUI.ShowAppSelect(), 6000);
  return out.before + ' -> ' + out.now + '\n' + out.outline;
})()
