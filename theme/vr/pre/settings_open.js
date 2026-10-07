/* vr:systemui. Like docs/inventory/steamvr-pre/settings_open.js (switches the
   Steam dashboard frame to its "system.settings" page, what Steam's frame
   menu > VR Settings does) but stays 9 s so an audit (theme off -> snap ->
   theme on -> snap) fits, then switches back. Optional hover emulation:
   prefix the expression with  window.__LGS_SET_HOVER = 1,  to clone every
   :hover rule (nested theme rules included) to [data-lgs-hover] and mark a
   non-selected sidebar section, a non-selected radio button, the first
   segmented control, the first slider and the first dropdown button.
   Display-only. This hides Steam main in the headset meanwhile: hold the
   Steam lab lock while running it (docs/inventory/steamvr.md 2.8). Never
   touch a setting. */
(async () => {
  const hover = !!window.__LGS_SET_HOVER;
  delete window.__LGS_SET_HOVER;
  const f = FrameStore.frames.find((x) => x.pages.some((p) => p.m_sSummonOverlayKey === 'system.settings'));
  if (!f) return 'no frame with a settings page';
  const target = f.pages.find((p) => p.m_sSummonOverlayKey === 'system.settings');
  const tid = target.pageID ?? target.m_unPageID;
  let prev = f.activePageID;
  if (prev === tid) {  // a previous run is still showing settings: go back to Steam main afterwards
    const main = f.pages.find((p) => p.m_sSummonOverlayKey === 'valve.steam.gamepadui.main');
    prev = main ? (main.pageID ?? main.m_unPageID) : prev;
  }
  f.SwitchToPage(target.pageID ?? target.m_unPageID);
  setTimeout(() => f.SwitchToPage(prev), 9000);
  for (let i = 0; i < 25 && !document.querySelector('.SettingsMainPanel'); i++) await L.sleep(200);
  await L.sleep(1200);
  let marked = [];
  if (hover) {
    const st = document.createElement('style'); st.id = 'lgs-vr-set-hover';
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
    const pick = [
      document.querySelectorAll('.SettingsSidebarButton:not(.Active)')[1],
      document.querySelector('.SettingsItem.RadioButtons .RadioButton:not(.Selected)'),
      document.querySelector('.SettingsPageContainer .SettingsItem.SegmentedControl .SegmentedControlGroup'),
      document.querySelector('.SettingsPageContainer .SliderControl'),
      document.querySelector('.SettingsPageContainer .ButtonControl.Dropdown'),
    ].filter(Boolean);
    pick.forEach((e) => e.setAttribute('data-lgs-hover', ''));
    marked = pick.map((e) => e.className);
    setTimeout(() => { st.remove(); pick.forEach((e) => e.removeAttribute('data-lgs-hover')); }, 8000);
  }
  return 'prev=' + prev + ' now=' + f.activePageID + ' hover=' + JSON.stringify(marked);
})()
