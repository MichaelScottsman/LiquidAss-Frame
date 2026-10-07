/* vr:systemui, Now Playing open. Puts .gpfocus on Resume Game (the primary) for 4 s. */
(async () => {
  const btns = [...document.querySelectorAll('.NowPlaying .InfoColumn .GamepadUIButton')];
  const before = btns.map((b) => b.className);
  btns.forEach((b) => b.classList.remove('gpfocus'));
  if (btns[0]) btns[0].classList.add('gpfocus');
  setTimeout(() => btns.forEach((b, i) => { b.className = before[i]; }), 4000);
  const fr = document.querySelector('.NowPlaying');
  const r = fr.getBoundingClientRect();
  return { np: [r.x, r.y, r.width, r.height], app: sceneApplicationStore.SceneAppName };
})()
