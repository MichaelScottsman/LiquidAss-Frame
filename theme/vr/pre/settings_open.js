/* vr:systemui. Like docs/inventory/steamvr-pre/settings_open.js (switches the
   Steam dashboard frame to its "system.settings" page, what Steam's frame
   menu > VR Settings does), then switches back after a hold. Options, set as a
   prefix of the expression:
     window.__LGS_SET_HOLD_MS = 40000,   hold time (default 9000 ms; gates and
                                         audits need about 40 s)
     window.__LGS_SET_SECTION = 4,       sidebar section to show (index, or the
                                         row's label); navigation only. General
                                         (the first row) is clicked again before
                                         switching back
     window.__LGS_SET_HOVER = 1,         clone every :hover rule (nested theme
                                         rules included) to [data-lgs-hover] and
                                         mark a non-selected sidebar section, a
                                         non-selected radio button, the first
                                         segmented control, the first slider and
                                         the first dropdown button (display only)
   This hides Steam main in the headset meanwhile: hold the Steam lab lock
   while running it (docs/inventory/steamvr.md 2.8). Never touch a setting. */
(async () => {
  const hover = !!window.__LGS_SET_HOVER;
  const hold = Number(window.__LGS_SET_HOLD_MS) || 9000;
  const sec = window.__LGS_SET_SECTION;
  delete window.__LGS_SET_HOVER; delete window.__LGS_SET_HOLD_MS; delete window.__LGS_SET_SECTION;
  if (window.__LGS_SET_REVERT) { clearTimeout(window.__LGS_SET_REVERT); window.__LGS_SET_REVERT = 0; }  // a later step owns the revert
  const f = FrameStore.frames.find((x) => x.pages.some((p) => p.m_sSummonOverlayKey === 'system.settings'));
  if (!f) return 'no frame with a settings page';
  const target = f.pages.find((p) => p.m_sSummonOverlayKey === 'system.settings');
  const tid = target.pageID ?? target.m_unPageID;
  let prev = f.activePageID;
  if (prev === tid) {  // a previous run is still showing settings: go back to Steam main afterwards
    const main = f.pages.find((p) => p.m_sSummonOverlayKey === 'valve.steam.gamepadui.main');
    prev = main ? (main.pageID ?? main.m_unPageID) : prev;
  }
  f.SwitchToPage(tid);
  for (let i = 0; i < 25 && !document.querySelector('.SettingsMainPanel'); i++) await L.sleep(200);
  const rows = () => [...document.querySelectorAll('.SettingsSidebar > .SettingsSidebarButton')];
  let shown = '';
  if (sec !== undefined && sec !== null) {
    const r = rows();
    const b = typeof sec === 'number' ? r[sec] : r.find((x) => x.textContent.trim() === String(sec));
    if (b) { b.click(); shown = b.textContent.trim(); }
  }
  window.__LGS_SET_REVERT = setTimeout(() => {
    if (shown) { const g = rows()[0]; if (g && !g.classList.contains('Active')) g.click(); }
    f.SwitchToPage(prev);
  }, hold);
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
    setTimeout(() => { st.remove(); pick.forEach((e) => e.removeAttribute('data-lgs-hover')); }, Math.max(1000, hold - 1000));
  }
  return 'prev=' + prev + ' now=' + f.activePageID + ' section=' + (shown || '(current)') + ' hold=' + hold + ' hover=' + JSON.stringify(marked);
})()
