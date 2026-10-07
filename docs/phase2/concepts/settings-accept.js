/* main. Acceptance sweep for the Settings concept (docs/phase2/concepts/settings.md §12).
 * Read-only: navigation only, never operates a control, returns to the starting route.
 * For each route it measures the themed page against the concept's numbers and prints PASS/FAIL per check.
 *
 * Usage (one locked lab step, about 1.4 s per route; keep batches under 30 routes):
 *   python glass.py js "$(cat docs/phase2/concepts/settings-accept.js)()"                 # all 25 routes
 *   python glass.py js "$(cat docs/phase2/concepts/settings-accept.js)(['/settings/audio'])"
 * Pass {verbose:true} as the second argument to list every failing element instead of the first 6.
 *
 * Thresholds (main-window CSS px; DESIGN2 §4 and settings.md §3):
 *   sidebar row >= 72 tall, pitch >= 78, column >= 340 wide | field row >= 72 | toggle >= 64 x 38 (after scale)
 *   dropdown / button / text input >= 60 tall | slider hit >= 64 | checkbox >= 40, column pitch >= 80
 *   segment >= 56 tall | text >= 18 px, no uppercase, no italic, tracking <= 0.3 px
 *   content column <= 762 wide and centred within 4 px | no border, outline or 1 px ring on rows, menus, platters
 *   at scroll 0: >= 4 rows (or >= 260 px of rows) fully inside y 108..628 | search = 80 x 80 circle box, right edge 1266
 *   bottom ornament hidden when only the default Select / Back legends are present, shown otherwise
 */
(async (ROUTES, OPT) => {
  OPT = OPT || {};
  const ALL = ['/settings/system', '/settings/internet', '/settings/storage', '/settings/bluetooth', '/settings/display',
    '/settings/power', '/settings/audio', '/settings/controller/:type/:controllerIndex', '/settings/controller/advanced/:controllerIndex',
    '/settings/keyboard', '/settings/accessibility', '/settings/security', '/settings/notifications', '/settings/friends',
    '/settings/downloads', '/settings/cloud', '/settings/ingame', '/settings/compatibility', '/settings/family',
    '/settings/remoteplay', '/settings/gamerecording', '/settings/home', '/settings/library', '/settings/store', '/settings/developer'];
  ROUTES = ROUTES && ROUTES.length ? ROUTES : ALL;
  const W = L.surface('main'), D = W.document, start = L.route();
  const G = (t) => L.sel('%{*GamepadDialogContent>' + t + '}');
  const R = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = W.getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const name = (e) => ((e.getAttribute('aria-label') || e.innerText || e.className || e.tagName) + '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const px = (v) => parseFloat(v) || 0;
  const report = [];
  for (const route of ROUTES) {
    L.nav(route); await L.sleep(1300);
    const pc = L.q('main', '%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageContent}');
    if (!pc) { report.push({ route, error: 'no page content (route not shown)' }); continue; }
    const checks = {};
    const fail = (k, e, why) => { (checks[k] = checks[k] || { n: 0, fail: [] }); checks[k].fail.push((e ? name(e) + ' ' : '') + why); };
    const seen = (k) => { (checks[k] = checks[k] || { n: 0, fail: [] }).n++; };

    // 1. sidebar (measured once per route; it is the same list, but selection and scroll differ)
    const items = L.qa('main', '%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageListItem}').filter(vis);
    items.forEach((it, i) => {
      seen('navRow'); const r = R(it);
      if (r.h < 72) fail('navRow', it, `h ${r.h.toFixed(0)} < 72`);
      if (r.w < 340 - 32) fail('navRow', it, `w ${r.w.toFixed(0)} < 308`);
      if (i > 0) { const p = R(items[i - 1]); const pitch = r.y - p.y; if (pitch > 0 && pitch < 78) fail('navPitch', it, `pitch ${pitch.toFixed(0)} < 78`); seen('navPitch'); }
    });
    const col = items[0] && items[0].closest('[class*="PageListColumn"]');
    if (col) { seen('navColumn'); if (R(col).w < 340) fail('navColumn', null, `column ${R(col).w.toFixed(0)} < 340`); }

    // 2. content column width and centring
    const inner = pc.querySelector('.DialogContent_InnerWidth');
    if (inner) {
      seen('column'); const a = R(inner), b = R(pc);
      const padL = px(W.getComputedStyle(pc).paddingLeft), padR = px(W.getComputedStyle(pc).paddingRight);
      const left = a.x - (b.x + padL), right = (b.x + b.w - padR) - (a.x + a.w);
      if (a.w > 762) fail('column', null, `width ${a.w.toFixed(0)} > 762`);
      if (Math.abs(left - right) > 4 && a.w < b.w - padL - padR - 8) fail('column', null, `off-centre by ${(left - right).toFixed(0)}`);
    }

    // 3. rows and controls
    pc.querySelectorAll(G('Field')).forEach((f) => { if (!vis(f)) return; seen('fieldRow'); const r = R(f); if (r.h < 72) fail('fieldRow', f, `h ${r.h.toFixed(0)} < 72`); });
    pc.querySelectorAll(G('Toggle')).forEach((t) => { if (!vis(t)) return; seen('toggle'); const r = R(t); if (r.w < 64 || r.h < 38) fail('toggle', t, `${r.w.toFixed(0)}x${r.h.toFixed(0)} < 64x38`); });
    pc.querySelectorAll(L.sel('%{DropDownControlButton}')).forEach((d) => { if (!vis(d)) return; seen('dropdown'); if (R(d).h < 60) fail('dropdown', d, `h ${R(d).h.toFixed(0)} < 60`); });
    pc.querySelectorAll('button.DialogButton').forEach((b) => { if (!vis(b) || b.matches(L.sel('%{DropDownControlButton}'))) return; seen('button'); if (R(b).h < 60) fail('button', b, `h ${R(b).h.toFixed(0)} < 60`); });
    pc.querySelectorAll('input').forEach((i) => { if (!vis(i)) return; seen('input'); if (R(i).h < 60) fail('input', i, `h ${R(i).h.toFixed(0)} < 60`); });
    pc.querySelectorAll('[role=slider]').forEach((s) => { if (!vis(s)) return; seen('slider'); const grp = s.closest(L.sel('%{*SliderControlAndNotches>SliderControlPanelGroup}')) || s; if (R(grp).h < 64) fail('slider', s, `hit h ${R(grp).h.toFixed(0)} < 64`); });
    const cbs = [...pc.querySelectorAll('.DialogCheckbox')].filter(vis);
    cbs.forEach((c, i) => {
      seen('checkbox'); const r = R(c); if (r.w < 40 || r.h < 40) fail('checkbox', c, `${r.w.toFixed(0)}x${r.h.toFixed(0)} < 40`);
      const n = cbs[i + 1]; if (n && Math.abs(R(n).y - r.y) < 4) { const pitch = R(n).x - r.x; if (pitch < 80) fail('checkboxPitch', c, `pitch ${pitch.toFixed(0)} < 80`); seen('checkboxPitch'); }
    });
    pc.querySelectorAll('.RadioButton').forEach((s) => { if (!vis(s)) return; seen('segment'); if (R(s).h < 56) fail('segment', s, `h ${R(s).h.toFixed(0)} < 56`); });

    // 4. type
    const leaves = [...pc.querySelectorAll('*'), ...items].filter((e) => e.childElementCount === 0 && e.innerText && e.innerText.trim().length > 1 && vis(e));
    leaves.forEach((e) => {
      const cs = W.getComputedStyle(e); seen('text');
      if (px(cs.fontSize) < 18) fail('text', e, `font ${cs.fontSize}`);
      if (cs.textTransform === 'uppercase') fail('textCase', e, 'uppercase'); seen('textCase');
      if (cs.fontStyle === 'italic') fail('textItalic', e, 'italic'); seen('textItalic');
      if (px(cs.letterSpacing) > 0.3) fail('textTracking', e, `tracking ${cs.letterSpacing}`); seen('textTracking');
    });

    // 5. no outlines on glass and fills (rows, platters, nav rows, buttons)
    [...pc.querySelectorAll(G('Field') + ', button.DialogButton, ' + L.sel('%{DropDownControlButton}')), ...items].forEach((e) => {
      if (!vis(e)) return; const cs = W.getComputedStyle(e); seen('noOutline');
      const clear = (c) => /transparent|rgba\([^)]*,\s*0(\.0+)?\)$/.test(c);
      const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((sd) => px(cs['border' + sd + 'Width']) > 0 && cs['border' + sd + 'Style'] !== 'none' && !clear(cs['border' + sd + 'Color']));
      if (sides.length) fail('noOutline', e, `border ${sides.join('/')}`);
      if (cs.outlineStyle !== 'none' && px(cs.outlineWidth) > 0) fail('noOutline', e, `outline ${cs.outlineWidth}`);
      if (/(^|,)\s*(inset\s+)?(rgba?\([^)]*\)\s+)?0px 0px 0px 1px/.test(cs.boxShadow)) fail('noOutline', e, '1px ring');
    });

    // 6. vertical budget at scroll 0 (root view): top-level field rows and drill-down rows fully inside y 108..628.
    //    Pass with >= 4 rows, or rows covering >= 260 px (half the 520 px band; pages that open with two-line rows or a
    //    slider row), or every row of a short page (settings.md §3.5, T-ROWS).
    if (pc.scrollTop === 0 && !(D.querySelector('[data-lgs-view]') && D.querySelector('[data-lgs-view]').dataset.lgsView !== 'root')) {
      const rowsAll = [...pc.querySelectorAll(G('Field') + ', [data-lgs-drill]')].filter(vis).filter((e) => !(e.parentElement && e.parentElement.closest(G('Field'))));
      const band = rowsAll.filter((e) => { const r = R(e); return r.y >= 107 && r.y + r.h <= 629; });
      const area = band.reduce((a, e) => a + R(e).h, 0);
      seen('rowsAtTop');
      if (!(band.length >= 4 || area >= 260 || (rowsAll.length && band.length === rowsAll.length)))
        fail('rowsAtTop', null, `${band.length} rows / ${area.toFixed(0)} px inside y 108..628 at scroll 0 (need 4 rows or 260 px)`);
    }

    // 7. toolbar: Steam's search collapsed to the 60 px magnifier circle in an 80 x 80 box at the trailing corner (right edge 1266)
    const sc = L.q('main', '%{SearchAndTitleContainer}');
    if (sc && vis(sc)) {
      seen('searchCircle'); const r = R(sc);
      if (r.w > 84 || r.h < 78 || Math.abs(r.x + r.w - 1266) > 6) fail('searchCircle', null, `search box ${r.w.toFixed(0)}x${r.h.toFixed(0)}, right edge ${(r.x + r.w).toFixed(0)} (want 80x80, right edge 1266)`);
    }

    // 8. bottom ornament: hidden while every legend is OK / CANCEL with Steam's default label; shown otherwise.
    //    Legends are tagged by the theme's T2 (data-lgs-btn = OK|CANCEL|SECONDARY|OPTIONS|MENU|SELECT, data-lgs-default = 1|0).
    const foot = D.querySelector('#Footer');
    if (foot) {
      seen('ornament');
      const legs = [...foot.querySelectorAll('[data-lgs-btn]')];
      const fcs = W.getComputedStyle(foot);
      const shown = fcs.visibility !== 'hidden' && parseFloat(fcs.opacity) > 0.05;
      if (!legs.length) fail('ornament', null, 'legends not tagged (T2 data-lgs-btn missing)');
      else {
        const generic = legs.every((l) => /^(OK|CANCEL)$/.test(l.dataset.lgsBtn) && l.dataset.lgsDefault === '1');
        if (generic && shown) fail('ornament', null, 'generic Select/Back legend is shown');
        if (!generic && !shown) fail('ornament', null, 'page-specific legend is hidden');
      }
    }

    const foc = [...pc.querySelectorAll('.Focusable')].filter(vis).length;
    const summary = {};
    let bad = 0;
    for (const [k, v] of Object.entries(checks)) {
      if (!v.n) continue;
      summary[k] = v.fail.length ? `FAIL ${v.fail.length}/${v.n}: ` + v.fail.slice(0, OPT.verbose ? 999 : 6).join(' | ') : `PASS ${v.n}`;
      if (v.fail.length) bad++;
    }
    report.push({ route, ok: bad === 0, fields: pc.querySelectorAll(G('Field')).length, focusables: foc, scrollH: pc.scrollHeight, checks: summary });
  }
  L.nav(start); await L.sleep(400);
  const ok = report.filter((r) => r.ok).length;
  return JSON.stringify({ routes: report.length, routesPassing: ok, report }, null, 1);
})
