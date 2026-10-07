/* vr:systemui. Adds SteamVR's own state classes for 5 s: %{HasGamepadFocus} on the frame controls, %{GamepadFocused} on the 2nd button, %{GrabHandleBar>ForceActive} and %{ResizeHandleButton>ForceActive} (the "being dragged" look). DOM classes only. */
(async () => {
  const c = (t) => L.index.selector(t).sel.slice(1);
  const added = [];
  const add = (sel, cls) => { const el = L.q('vr:systemui', sel); if (el && !el.classList.contains(cls)) { el.classList.add(cls); added.push([el, cls]); } };
  add('%{FrameControlsContainer}', c('HasGamepadFocus'));
  const btns = L.qa('vr:systemui', '%{FrameControlsContainer} .ButtonControl');
  if (btns[1]) { btns[1].classList.add(c('GamepadFocused')); added.push([btns[1], c('GamepadFocused')]); }
  add('%{GrabHandleBar}', c('GrabHandleBar>ForceActive'));
  add('%{ResizeHandleButton}', c('ResizeHandleButton>ForceActive'));
  setTimeout(() => added.forEach(([el, cls]) => el.classList.remove(cls)), 5000);
  return added.map(([el, cls]) => cls);
})()
