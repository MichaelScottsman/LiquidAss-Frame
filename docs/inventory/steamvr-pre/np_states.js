/* vr:systemui, Now Playing open. Puts .gpfocus on "VR Controller Bindings" and emulated hover on "Exit Game" for 5 s (DOM classes only). */
(async () => {
  const st = document.createElement('style'); st.id = 'lgs-inv-hover';
  const rules = [];
  for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; }
    for (const r of rs) if (r.selectorText && r.selectorText.includes(':hover')) rules.push(r.selectorText.replace(/:hover/g, '[data-lgs-hover]') + '{' + r.style.cssText + '}'); }
  st.textContent = rules.join('\n'); document.head.appendChild(st);
  const btns = [...document.querySelectorAll('.NowPlaying .InfoColumn .GamepadUIButton')];
  const before = btns.map((b) => b.className);
  btns.forEach((b) => b.classList.remove('gpfocus'));
  if (btns[1]) btns[1].classList.add('gpfocus');          // gamepad focus on "VR Controller Bindings"
  if (btns[3]) btns[3].setAttribute('data-lgs-hover', ''); // laser hover on "Exit Game"
  setTimeout(() => { st.remove(); btns.forEach((b, i) => { b.className = before[i]; b.removeAttribute('data-lgs-hover'); }); }, 5000);
  return before;
})()
