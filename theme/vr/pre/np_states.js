/* vr:systemui, Now Playing open (see docs/inventory/steamvr-pre/np_open.js).
   Puts SteamVR's own .gpfocus on one action and an emulated laser hover on
   another for 5 s (DOM classes/attributes only, restored afterwards). Unlike
   the inventory's np_states.js the hover clone also covers the theme's
   nested html.lgs-on rules. Choose with globals set in the same expression:
     window.__LGS_NP = { focus: 1, hover: 3 }, <this script>
   (indexes into the action buttons: 0 Resume, 1 VR Controller Bindings,
   2 VR Video Settings, 3 Exit Game; -1 = none). Default focus 1, hover 3.
   Never clicks anything. */
(async () => {
  const opt = Object.assign({ focus: 1, hover: 3 }, window.__LGS_NP || {});
  delete window.__LGS_NP;
  const st = document.createElement('style'); st.id = 'lgs-vr-np-hover';
  const out = [];
  const walk = (rules, nest) => {
    for (const r of rules) {
      if (r.selectorText && r.cssRules && r.cssRules.length) walk(r.cssRules, (nest || []).concat(r.selectorText));
      if (r.selectorText && r.selectorText.includes(':hover')) {
        let t = r.selectorText.replace(/:hover/g, '[data-lgs-hover]') + '{' + r.style.cssText + '}';
        for (const p of (nest || []).slice().reverse()) t = p + '{' + t + '}';
        out.push(t);
      }
    }
  };
  for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; } walk(rs, null); }
  st.textContent = out.join('\n'); document.head.appendChild(st);
  const btns = [...document.querySelectorAll('.NowPlaying .InfoColumn .GamepadUIButton')];
  if (!btns.length) { st.remove(); return 'Now Playing is not open'; }
  const before = btns.map((b) => b.className);
  btns.forEach((b) => b.classList.remove('gpfocus'));
  if (btns[opt.focus]) btns[opt.focus].classList.add('gpfocus');
  if (btns[opt.hover]) btns[opt.hover].setAttribute('data-lgs-hover', '');
  setTimeout(() => { st.remove(); btns.forEach((b, i) => { b.className = before[i]; b.removeAttribute('data-lgs-hover'); }); }, 5000);
  return { labels: btns.map((b) => b.textContent), focus: opt.focus, hover: opt.hover };
})()
