/* vr:systemui. Switches the Steam dashboard frame to its "system.settings" page (what Steam's frame menu > VR Settings does) and back after 4.5 s. This hides Steam main in the headset for those seconds, so hold the Steam lab lock while running it (see docs/inventory/steamvr.md, 2.8). Never touch a setting. */
(async () => {
  const f = FrameStore.frames.find((x) => x.pages.some((p) => p.m_sSummonOverlayKey === 'system.settings'));
  const prev = f.activePageID;
  const target = f.pages.find((p) => p.m_sSummonOverlayKey === 'system.settings');
  f.SwitchToPage(target.pageID ?? target.m_unPageID);
  setTimeout(() => f.SwitchToPage(prev), 4500);
  for (let i = 0; i < 25 && !document.querySelector('.SettingsMainPanel'); i++) await L.sleep(200);
  await L.sleep(1200);
  return 'prev=' + prev + ' now=' + f.activePageID + '\n' + L.outline('vr:systemui', { sel: '.SettingsMain', max: 220 });
})()
