/* main. Gamepad traversal acceptance for the Settings concept (docs/phase2/concepts/settings.md §12, T-PAD).
 * Navigation only: D-pad moves through the sidebar (selection follows focus), into pages and down every row.
 * It never presses A, B, X, Y or Menu; L.pad refuses left/right while a slider has focus.
 *
 * Usage (one locked lab step each; the js timeout is 60 s, so run the sidebar and the pages in separate calls):
 *   python glass.py js "$(cat docs/phase2/concepts/settings-pad.js)({sidebar:true})"
 *   python glass.py js "$(cat docs/phase2/concepts/settings-pad.js)({pages:['/settings/power','/settings/audio']})"
 * Options: visTop / visBottom = the band a focused row must sit in (concept: 108 = below the header row,
 * 628 = the top of the bottom ornament and the end of Steam's modal box (window-nav.md AT-2); Phase 1 today: 40 / 678), maxRows (default 70).
 */
(async (O) => {
  O = O || {};
  const VIS_TOP = O.visTop == null ? 108 : O.visTop, VIS_BOTTOM = O.visBottom == null ? 628 : O.visBottom;
  const W = L.surface('main'), D = W.document, start = L.route();
  const inst = SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
  const ITEM = L.sel('%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageListItem}');
  const gp = () => { const a = D.querySelectorAll('.gpfocus'); return a.length ? a[a.length - 1] : null; };
  const desc = (e) => (e ? ((e.innerText || e.getAttribute('aria-label') || '') + '').trim().replace(/\s+/g, ' ').slice(0, 40) || e.tagName : null);
  const box = (e) => { const r = e.getBoundingClientRect(); return { y0: Math.round(r.top), y1: Math.round(r.bottom) }; };
  const inBand = (e) => { const b = box(e); return b.y0 >= VIS_TOP - 2 && b.y1 <= VIS_BOTTOM + 2; };
  const step = async (dir) => { try { await L.pad(dir, 1); return true; } catch (err) { return String(err.message || err); } };
  // With the headset unworn focus is parked (vr-null-tree, steam-react.md §4): FocusApplicationRoot, then the first
  // D-pad press both activates focus and moves it, so activate with Down + Up (on the sidebar: next page, then back).
  const root = async () => { inst.FocusApplicationRoot(); await L.sleep(300); await step('down'); await step('up'); };
  const toSidebar = async () => {
    for (let i = 0; i < 4; i++) {
      const f = gp();
      if (f && f.matches(ITEM)) return true;                 // never press Left on the sidebar: it opens the frame menu
      if (!f) { await step('down'); continue; }
      const r = await step('left');
      if (r !== true) await step('up');                     // a slider refused Left: move off it first
    }
    return !!(gp() && gp().matches(ITEM));
  };
  const out = { band: [VIS_TOP, VIS_BOTTOM] };

  if (O.sidebar) {
    L.nav('/settings/system'); await L.sleep(1300); await root();
    const okSide = await toSidebar();
    const items = L.qa('main', '%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageListItem}');
    const walk = [];
    for (let i = 0; i < items.length; i++) {
      const f = gp();
      walk.push({ focus: desc(f), route: L.route(), visible: f ? box(f).y0 >= 0 && box(f).y1 <= 720 : false });
      if (i < items.length - 1) await step('down');
    }
    for (let i = 0; i < items.length - 1; i++) await step('up');
    const routes = [...new Set(walk.map((w) => w.route))];
    out.sidebar = {
      reachedSidebar: okSide, items: items.length, distinctRoutes: routes.length,
      PASS_everyPageSelectedByFocus: routes.length === items.length,
      PASS_focusVisibleEveryStep: walk.every((w) => w.visible),
      PASS_upReturnsToFirst: desc(gp()) === walk[0].focus,
      walk: walk.map((w) => `${w.focus} -> ${w.route}${w.visible ? '' : ' (FOCUS OFF-SCREEN)'}`),
    };
  }

  out.pages = [];
  for (const p of O.pages || []) {
    L.nav(p); await L.sleep(1300); await root();
    const okSide = await toSidebar();
    const entered = await step('right');
    // Down then Up must return to the same element (sampled at the first row, before Steam's focus memory matters)
    const a = gp(); await step('down'); await step('up'); const b = gp();
    const rows = []; let same = 0, last = null;
    for (let i = 0; i < (O.maxRows || 70) && same < 2; i++) {
      const f = gp(); const d = desc(f);
      if (f && f !== last) { rows.push({ focus: d, inBand: inBand(f), y: box(f) }); same = 0; } else same++;
      last = f;
      await step('down');
    }
    await toSidebar();
    const off = rows.filter((r) => !r.inBand);
    out.pages.push({
      route: p, reachedSidebar: okSide, enteredWithRight: entered === true, rows: rows.length,
      PASS_focusInBand: off.length === 0, offBand: off.slice(0, 8).map((r) => `${r.focus} y ${r.y.y0}..${r.y.y1}`),
      PASS_downUpReturns: !!a && a === b, first: rows[0] && rows[0].focus, lastRow: rows.length ? rows[rows.length - 1].focus : null,
    });
  }
  // P-S4 / T-DRILL: drill-down sub-views (settings.md §4.3). Navigation only: it activates our own drill-down rows
  // ([data-lgs-drill], never a Steam control) with a synthetic click and leaves with the wrapper's back(), which is the very
  // handler our onCancel (B) calls. Checks: the sub-view shows only its sections, focus lands in it and stays in the band,
  // back() returns to the root with focus restored to the same drill-down row.
  //   python glass.py js "$(cat docs/phase2/concepts/settings-pad.js)({drill:['/settings/system']})"
  out.drill = [];
  for (const p of O.drill || []) {
    L.nav(p); await L.sleep(1300); await root();
    const api = window.__LGS_SET;
    const rows = [...D.querySelectorAll('[data-lgs-drill]')];
    if (!api || !rows.length) { out.drill.push({ route: p, error: 'no drill-down rows: P-S1 / P-S4 not installed' }); continue; }
    const res = [];
    for (const row of rows.slice(0, O.maxDrill || 4)) {
      const key = row.dataset.lgsDrill;
      L.click('main', `[data-lgs-drill="${key}"]`); await L.sleep(700);
      const view = (D.querySelector('[data-lgs-view]') || {}).dataset || {};
      const f = gp();
      const shownSecs = [...D.querySelectorAll('[data-lgs-sec]')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.dataset.lgsSec);
      api.back(); await L.sleep(700);
      const g = gp();
      res.push({ key, view: view.lgsView, focusInSubview: !!f && inBand(f), sections: [...new Set(shownSecs)].join(','),
        PASS_backToRoot: ((D.querySelector('[data-lgs-view]') || {}).dataset || {}).lgsView === 'root',
        PASS_focusRestored: !!g && (g === row || row.contains(g)) });
    }
    out.drill.push({ route: p, rows: rows.length, results: res });
  }

  L.nav(start); await L.sleep(400);
  return JSON.stringify(out, null, 1);
})
