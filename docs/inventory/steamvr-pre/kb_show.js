/* vr:keyboard. Renders SteamVR's own keyboard DOM by setting the React state bVisible (plus a sample text and one "pressed" key) for 5 s. No VRHTML call, the keyboard overlay is not shown in the headset. Refuses if the keyboard is really visible. */
(async () => {
  const root = document.getElementById('root');
  let inst = null;
  const walk = (f, d) => { if (!f || inst || d > 30) return; if (f.stateNode && f.stateNode.state && 'bVisible' in f.stateNode.state) { inst = f.stateNode; return; } walk(f.child, d + 1); walk(f.sibling, d); };
  walk(root[Object.keys(root).find((k) => k.startsWith('__reactContainer'))], 0);
  if (!inst) return 'no keyboard component';
  if (inst.state.bVisible) return 'keyboard really visible; not touching';
  const saved = { bVisible: false, bMinimalMode: inst.state.bMinimalMode, activeKey: inst.state.activeKey };
  // display-only: render the stock keyboard DOM (full mode, one key "pressed") for a screenshot, then restore
  inst.setState({ bVisible: true, bMinimalMode: false, text: 'Liquid', textPos: 6, activeKey: { nRow: 1, nCol: 3 } });
  await L.sleep(600);
  const out = L.outline('vr:keyboard', { max: 90 });
  setTimeout(() => inst.setState(Object.assign({ text: '', textPos: 0 }, saved)), 5000);
  return out;
})()
