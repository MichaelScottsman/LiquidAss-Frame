/* vr:systemui. Needs a running scene app (only the Liquid Glass Frame showcase, see docs). Waits for the Now Playing frame, opens the dashboard on it with window.Dashboard.showDashboardOverlay({frameId}, true) (what the Steam button does), prints the outline. Never press Resume / Bindings / Video Settings / Exit / Close. */
(async () => {
  let f = null;
  for (let i = 0; i < 100 && !f; i++) {
    f = FrameStore.frames.find((x) => x.pages.some((p) => p.m_sSummonOverlayKey === 'system.dashboard.nowplaying'));
    if (!f) await L.sleep(250);
  }
  if (!f) return 'no Now Playing frame (is a scene app running?)';
  if (!f.isCurrentlyVisible) window.Dashboard.showDashboardOverlay({ frameId: f.frameID, sReason: 'lgs-inventory' }, true);
  for (let i = 0; i < 40 && !document.querySelector('.NowPlaying'); i++) await L.sleep(200);
  await L.sleep(1500);
  return 'visible=' + f.isCurrentlyVisible + ' app=' + sceneApplicationStore.SceneAppName + '\n' + L.outline('vr:systemui', { max: 320 });
})()
