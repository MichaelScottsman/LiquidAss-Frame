/* vr:keyboard. Display-only: renders SteamVR's own keyboard DOM (full mode,
   "r" pressed, like docs/inventory/steamvr-pre/kb_show.js) and emulates a
   laser hover on a letter key ("g") and a special key (backspace) by
   cloning every :hover rule (nested theme rules included) to
   [data-lgs-hover]. Set window.__LGS_KB_MINIMAL = 1 first for minimal mode
   (no preview row). Restores the keyboard's state after 5 s. Never types. */
(async () => {
  const minimal = !!window.__LGS_KB_MINIMAL;
  delete window.__LGS_KB_MINIMAL;
  const root = document.getElementById('root');
  let inst = null;
  const walk = (f, d) => { if (!f || inst || d > 30) return; if (f.stateNode && f.stateNode.state && 'bVisible' in f.stateNode.state) { inst = f.stateNode; return; } walk(f.child, d + 1); walk(f.sibling, d); };
  walk(root[Object.keys(root).find((k) => k.startsWith('__reactContainer'))], 0);
  if (!inst) return 'no keyboard component';
  if (inst.state.bVisible) return 'keyboard really visible; not touching';
  const saved = { bVisible: false, bMinimalMode: inst.state.bMinimalMode, activeKey: inst.state.activeKey };
  inst.setState({ bVisible: true, bMinimalMode: minimal, text: 'Liquid', textPos: 6, activeKey: { nRow: 1, nCol: 3 } });
  await L.sleep(600);
  const st = document.createElement('style'); st.id = 'lgs-vr-kb-hover';
  const out = [];
  const walkR = (rules, nest) => { for (const r of rules) {
    if (r.selectorText && r.cssRules && r.cssRules.length) walkR(r.cssRules, (nest || []).concat(r.selectorText));
    if (r.selectorText && r.selectorText.includes(':hover')) { let t = r.selectorText.replace(/:hover/g, '[data-lgs-hover]') + '{' + r.style.cssText + '}'; for (const p of (nest || []).slice().reverse()) t = p + '{' + t + '}'; out.push(t); } } };
  for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; } walkR(rs, null); }
  st.textContent = out.join('\n'); document.head.appendChild(st);
  const keys = [...document.querySelectorAll('.VRKBKey')];
  const pick = [keys.find((k) => k.textContent.trim().startsWith('g')), keys.find((k) => (k.querySelector('img') || {}).src?.includes('del.png'))].filter(Boolean);
  pick.forEach((k) => k.setAttribute('data-lgs-hover', ''));
  setTimeout(() => { st.remove(); pick.forEach((k) => k.removeAttribute('data-lgs-hover')); inst.setState(Object.assign({ text: '', textPos: 0 }, saved)); }, 5000);
  return 'hover on ' + pick.length + ' keys, minimal=' + minimal;
})()
