/* vr:systemui. Shows SteamVR's settings page (same call as Steam's frame menu > VR Settings), reads every section by clicking the sidebar section buttons (navigation only), returns to the first section and switches the frame back. Safety revert at 14 s. Never touches a setting. */
(async () => {
  const f = FrameStore.frames.find((x) => x.pages.some((p) => p.m_sSummonOverlayKey === 'system.settings'));
  const prev = f.activePageID;
  const target = f.pages.find((p) => p.m_sSummonOverlayKey === 'system.settings');
  f.SwitchToPage(target.pageID ?? target.m_unPageID);
  const back = setTimeout(() => f.SwitchToPage(prev), 14000);
  for (let i = 0; i < 25 && !document.querySelector('.SettingsSidebarButton'); i++) await L.sleep(200);
  await L.sleep(700);
  const r = (e) => { const b = e.getBoundingClientRect(); return Math.round(b.width) + 'x' + Math.round(b.height); };
  const btns = [...document.querySelectorAll('.SettingsSidebarButton')];
  const out = ['panel ' + r(document.querySelector('.DashboardPanel.Settings')) + ' sidebar ' + r(document.querySelector('.SettingsSidebar')) + ' adv=' + (document.querySelector('.AdvancedSettingsToggle .Active, .AdvancedSettingsToggle .SegmentedControlGroupOption.Active') || {}).innerText];
  const first = btns.find((b) => b.classList.contains('Active'));
  for (let bi = 0; bi < btns.length; bi++) {
    const b = document.querySelectorAll('.SettingsSidebarButton')[bi];
    const name = b.innerText.trim();
    b.setAttribute('data-lgs-sb', String(bi)); L.click('vr:systemui', '[data-lgs-sb="' + bi + '"]'); b.removeAttribute('data-lgs-sb');
    await L.sleep(650);
    const pc = document.querySelector('.SettingsPageContainer');
    out.push('=== ' + name + ' (sidebar row ' + r(b) + ', page scrollH ' + (pc ? pc.scrollHeight : '?') + ')');
    if (!pc) continue;
    for (const it of pc.querySelectorAll('.SettingsItem, .SettingsPageContainer > div > .Label, .SettingsSectionHeader, h1, h2')) {
      if (it.parentElement && it.parentElement.closest('.SettingsItem')) continue;
      const lab = (it.querySelector(':scope > .Label') || it).innerText.trim().split('\n')[0].slice(0, 60);
      const cls = [...it.classList].filter((c) => !/^(SettingsItem|Label)$/.test(c)).join('.');
      const ctl = it.querySelector('.RadioButtonsSet') ? 'radio×' + it.querySelectorAll('.RadioButton').length : it.querySelector('.SliderControl') ? 'slider' : it.querySelector('.SegmentedControlGroup') ? 'segmented×' + it.querySelectorAll('.SegmentedControlGroupOption').length : it.querySelector('.Dropdown') ? 'dropdown' : it.querySelector('.ButtonControl') ? 'button "' + it.querySelector('.ButtonControl').innerText.trim().slice(0, 30) + '"' : '';
      const c0 = it.querySelector('.RadioButton, .SegmentedControlGroup, .Dropdown, .HandleContainer, .ButtonControl');
      out.push('  ' + lab + ' :: ' + ctl + (c0 ? ' ' + r(c0) : '') + ' row ' + r(it) + (/Advanced/.test(cls) ? ' ADV' : '') + (it.classList.contains('Disabled') || it.querySelector('.Disabled') ? ' (disabled)' : ''));
    }
  }
  if (first) { const i = [...document.querySelectorAll('.SettingsSidebarButton')].findIndex((b) => b.innerText.trim() === first.innerText.trim()); const fb = document.querySelectorAll('.SettingsSidebarButton')[i]; fb.setAttribute('data-lgs-sb', 'x'); L.click('vr:systemui', '[data-lgs-sb="x"]'); fb.removeAttribute('data-lgs-sb'); await L.sleep(300); }
  clearTimeout(back); f.SwitchToPage(prev);
  await L.sleep(300);
  out.push('restored activePage=' + f.activePageID + ' (prev ' + prev + ')');
  return out.join('\n');
})()
