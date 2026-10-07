/* vr:systemui. Shows one frame-control tooltip panel (ControlBarButtonTooltip) through window.LegacyDashboardStore.m_nCurrentlyShownLegacyTooltipID (display-only mobx observable; the same thing a laser hover sets), restores it after 4 s. Tooltip ids are assigned at mount, so the script maps them by text first. */
(async () => {
  const S = window.LegacyDashboardStore;
  const prev = S.m_nCurrentlyShownLegacyTooltipID;
  const map = {};
  for (let id = 1; id < S.m_nNextLegacyTooltipID; id++) {
    S.m_nCurrentlyShownLegacyTooltipID = id;
    await L.sleep(60);
    const vis = [...document.querySelectorAll('.ControlBarButtonTooltip')].find((e) => e.getBoundingClientRect().width > 0);
    if (vis) map[id] = vis.textContent;
  }
  const want = Object.keys(map).find((k) => map[k] === 'Float in World') || Object.keys(map)[0];
  S.m_nCurrentlyShownLegacyTooltipID = want ? Number(want) : prev;
  await L.sleep(300);
  const el = [...document.querySelectorAll('.ControlBarButtonTooltip')].find((e) => e.getBoundingClientRect().width > 0);
  const r = el && el.getBoundingClientRect();
  setTimeout(() => { if (S.m_nCurrentlyShownLegacyTooltipID === Number(want)) S.m_nCurrentlyShownLegacyTooltipID = prev; }, 4000);
  return { map, shown: want, prev, rect: r && [r.x, r.y, r.width, r.height], panel: el && el.parentElement.getAttribute('style') };
})()
