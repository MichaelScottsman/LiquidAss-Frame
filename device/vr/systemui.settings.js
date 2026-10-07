// @lgs-flag wp.c6b
/* Glass Shell C6b (SET §4.10, §9.5; contracts/daemon.md §6): SteamVR's own
   settings page in vr:systemui (#vrsettingspanel). T2 markup for
   theme/vr/30-settings.css, keyed by SteamVR's own localised strings, never
   by position:
   - data-lgs-switch on two-option .DualValue groups of the detail pane whose
     texts are SteamVR's "Off" then "On" (#settings_togglebutton_off/_on):
     the T1 switch; data-lgs-exempt="E-SWITCH" on the group (PLAN §1.16);
   - data-lgs-sec on each sidebar row (#settings_sectiontitle_*): icon circle;
   - data-lgs-title / data-lgs-sec on .SettingsPageContainer: the section hero
     (the active row's own text);
   - the Back circle (.lgs-c6b-back, a new node in the sidebar's non-scrolling
     parent): its click switches the dashboard frame back to Steam's page with
     the same FrameStore call settings_open.js uses (SwitchToPage).
   A MutationObserver (childList only) re-applies after React re-renders,
   before the next paint. Nothing here changes a setting. remove() takes
   every attribute and node away. */
(function (ctx) {
  const SEC = {
    general: '#settings_sectiontitle_general',
    playarea: '#settings_sectiontitle_playarea',
    dashboard: '#settings_sectiontitle_dashboard',
    controller: '#settings_sectiontitle_controller',
    video: '#settings_sectiontitle_video',
    camera: '#settings_sectiontitle_camera',
    startupshutdown: '#settings_sectiontitle_startupshutdown',
    developer: '#settings_sectiontitle_developer',
  };
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const loc = (t) => {
    try {
      const L = window.LocalizationManager;
      const v = L && L.LocalizeString ? L.LocalizeString(t) : null;
      return v && v !== t ? v : null;
    } catch (e) { return null; }
  };
  let secMap = null;      // label -> key
  let offOn = null;       // [off, on]
  let backLabel = 'Back';
  const build = () => {
    const m = new Map();
    for (const [k, t] of Object.entries(SEC)) { const v = loc(t); if (v) m.set(norm(v), k); }
    if (m.size) secMap = m;
    const off = loc('#settings_togglebutton_off'); const on = loc('#settings_togglebutton_on');
    if (off && on) offOn = [norm(off), norm(on)];
    backLabel = loc('#back') || 'Back';
  };
  const ATTRS = ['data-lgs-switch', 'data-lgs-exempt', 'data-lgs-sec', 'data-lgs-title'];
  // ARIA we add (SteamVR sets none on these nodes): removed by remove()
  const OWN_ARIA = [['.SettingsSidebar > .SettingsSidebarButton', ['role', 'aria-selected']],
    ['.SegmentedControlGroup[data-lgs-switch]', ['role', 'aria-checked', 'aria-label']]];
  const setAttr = (el, a, v) => { if (el.getAttribute(a) !== v) el.setAttribute(a, v); };
  let runs = 0; let switches = 0; let backClicks = 0; let lastErr = null;

  const steamPage = () => {
    const fs = window.FrameStore && window.FrameStore.frames;
    if (!fs) return null;
    const f = fs.find((x) => x.pages && x.pages.some((p) => p.m_sSummonOverlayKey === 'system.settings'));
    if (!f) return null;
    const p = f.pages.find((x) => x.m_sSummonOverlayKey === 'valve.steam.gamepadui.main');
    return p ? { f, id: p.pageID ?? p.m_unPageID } : null;
  };
  const onBack = (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    backClicks++;
    try { const s = steamPage(); if (s) s.f.SwitchToPage(s.id); } catch (e) { lastErr = String(e); }
  };
  const ensureBack = (cont) => {
    let b = cont.querySelector(':scope > .lgs-c6b-back');
    if (!b) {
      b = document.createElement('div');
      b.className = 'lgs-c6b-back';
      b.setAttribute('role', 'button');
      b.setAttribute('data-lgs-c6b', '');
      b.addEventListener('click', onBack);
      cont.appendChild(b);
    }
    setAttr(b, 'aria-label', backLabel);
    setAttr(b, 'title', backLabel);
  };

  const apply = () => {
    const panel = document.querySelector('.DashboardPanel.Settings');
    if (!panel) return;
    runs++;
    if (!secMap || !offOn) build();
    const cont = panel.querySelector('.SettingsSidebarPageContainer');
    if (cont && steamPage()) ensureBack(cont);
    // sidebar rows and the hero
    let active = null;
    for (const b of panel.querySelectorAll('.SettingsSidebar > .SettingsSidebarButton')) {
      const lab = b.querySelector('.Label');
      const key = secMap && lab ? secMap.get(norm(lab.textContent)) : null;
      if (key) setAttr(b, 'data-lgs-sec', key); else if (b.hasAttribute('data-lgs-sec')) b.removeAttribute('data-lgs-sec');
      const on = b.classList.contains('Active');
      setAttr(b, 'role', 'tab'); setAttr(b, 'aria-selected', on ? 'true' : 'false');
      if (on) active = { lab, key };
    }
    const page = panel.querySelector('.SettingsPageContainer');
    if (page) {
      const t = active && active.lab ? active.lab.textContent.trim() : '';
      if (t) setAttr(page, 'data-lgs-title', t); else if (page.hasAttribute('data-lgs-title')) page.removeAttribute('data-lgs-title');
      if (active && active.key) setAttr(page, 'data-lgs-sec', active.key); else if (page.hasAttribute('data-lgs-sec')) page.removeAttribute('data-lgs-sec');
      // Off / On pairs -> switches
      let n = 0;
      if (offOn) for (const g of page.querySelectorAll('.SettingsItem.SegmentedControl .SegmentedControlGroup.DualValue')) {
        const o = g.children;
        const ok = o.length === 2 && norm(o[0].textContent) === offOn[0] && norm(o[1].textContent) === offOn[1];
        if (ok) {
          setAttr(g, 'data-lgs-switch', ''); setAttr(g, 'data-lgs-exempt', 'E-SWITCH');
          setAttr(g, 'role', 'switch'); setAttr(g, 'aria-checked', o[1].classList.contains('Active') ? 'true' : 'false');
          const lab = g.closest('.SettingsItem') && g.closest('.SettingsItem').querySelector(':scope > .Label');
          if (lab) setAttr(g, 'aria-label', lab.textContent.trim());
          n++;
        } else if (g.hasAttribute('data-lgs-switch')) { for (const a of ['data-lgs-switch', 'data-lgs-exempt', 'role', 'aria-checked', 'aria-label']) g.removeAttribute(a); }
      }
      switches = n;
    }
  };
  const safe = () => { try { apply(); } catch (e) { lastErr = String(e && e.stack || e).slice(0, 300); } };
  const mo = new MutationObserver(safe);
  mo.observe(document.body, { childList: true, subtree: true });
  // the active row and a switch's state change by class only: watch class changes in the panel too
  const mo2 = new MutationObserver(safe);
  let watched = null;
  const watchSidebar = () => {
    const sb = document.querySelector('.DashboardPanel.Settings');
    if (sb && sb !== watched) { mo2.disconnect(); mo2.observe(sb, { attributes: true, attributeFilter: ['class'], subtree: true }); watched = sb; }
  };
  const mo3 = new MutationObserver(watchSidebar);
  mo3.observe(document.body, { childList: true, subtree: true });
  watchSidebar();
  safe();

  return {
    remove() {
      mo.disconnect(); mo2.disconnect(); mo3.disconnect();
      for (const b of document.querySelectorAll('.lgs-c6b-back')) { b.removeEventListener('click', onBack); b.remove(); }
      for (const [sel, as] of OWN_ARIA) for (const el of document.querySelectorAll('.DashboardPanel.Settings ' + sel)) for (const a of as) el.removeAttribute(a);
      for (const a of ATTRS) for (const el of document.querySelectorAll('.DashboardPanel.Settings [' + a + ']')) el.removeAttribute(a);
    },
    status() {
      return { name: ctx && ctx.name, runs, switches, backClicks, sections: secMap ? secMap.size : 0, offOn: !!offOn, back: !!document.querySelector('.lgs-c6b-back'), err: lastErr };
    },
    test: {
      apply: safe,
      steamPage,
      // lab only (hold the Steam lab lock): show SteamVR's page for ms, then Steam's page again.
      // Navigation only, the same FrameStore calls as theme/vr/pre/settings_open.js.
      async open(ms) {
        const s = steamPage();
        if (!s) return 'no frame';
        const t = s.f.pages.find((p) => p.m_sSummonOverlayKey === 'system.settings');
        if (window.__LGS_SET_REVERT) clearTimeout(window.__LGS_SET_REVERT);
        s.f.SwitchToPage(t.pageID ?? t.m_unPageID);
        window.__LGS_SET_REVERT = setTimeout(() => { window.__LGS_SET_REVERT = 0; s.f.SwitchToPage(s.id); }, Math.min(Number(ms) || 9000, 120000));
        for (let i = 0; i < 25 && !document.querySelector('.SettingsMainPanel'); i++) await new Promise((r) => setTimeout(r, 200));
        await new Promise((r) => setTimeout(r, 1200));
        return 'settings shown, back to Steam in ' + ms + ' ms';
      },
    },
  };
})
