// C7 (press look), C28 (text on coloured fills) and the C14 Reduce Motion part, on /zoo/buttons and /zoo/toggles.
// Only classes are set on demo controls (lgs-pressed, removed at once) and temporary test buttons are created in our own
// container (removed in finally). Nothing is clicked or activated.
(async () => {
  const out = { checks: {}, info: {} }, ok = (k, v, i) => { out.checks[k] = { ok: !!v, ...(i || {}) }; };
  const w = L.surface('main'), d = w.document, added = [], marked = [];
  const B = L.sel('%{*GamepadDialogContent>Button}').replace(/^:is\(|\)$/g, '').split(',')[0].trim().replace(/^\./, '');
  const reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  out.info.reduce = reduce;
  try {
    L.nav('/zoo/buttons'); await L.sleep(1200);
    const btn = L.q('main', 'button.DialogButton:not(.Disabled)');
    const row = btn.closest(L.sel('%{*GamepadDialogContent>Field}'));
    const sc = (e) => w.getComputedStyle(e).scale;
    // C7: lgs-pressed on a capsule: swell min(1.06, 1 + 6/160) (none under Reduce Motion); on a row: no scale
    btn.classList.add('lgs-pressed'); row.classList.add('lgs-pressed'); marked.push([btn, 'lgs-pressed'], [row, 'lgs-pressed']);
    await L.sleep(400);
    const sBtn = sc(btn), sRow = sc(row), glow = w.getComputedStyle(btn, '::after').backgroundImage.slice(0, 80);
    btn.classList.remove('lgs-pressed'); row.classList.remove('lgs-pressed');
    await L.sleep(650);
    const sAfter = sc(btn);
    const want = reduce ? 1 : 1 + 6 / 160;
    ok('press_capsule_swell', Math.abs(parseFloat(sBtn === 'none' ? 1 : sBtn) - want) < 0.003, { scale: sBtn, want, glowLayer: glow });
    ok('press_row_no_scale', sRow === 'none' || parseFloat(sRow) === 1, { scale: sRow });
    ok('press_released', sAfter === 'none' || Math.abs(parseFloat(sAfter) - 1) < 0.002, { scale: sAfter });
    // C28: our own test buttons with Steam's classes
    const box = d.createElement('div'); box.style.cssText = 'position:fixed;left:400px;top:200px;z-index:9999;display:flex;gap:24px';
    box.innerHTML = `<div class="DialogFooter" style="display:flex;gap:24px"><button class="DialogButton ${B} Primary">Confirm</button><button class="DialogButton ${B} Destructive">Delete</button></div><button class="DialogButton GreenPlay ${B}">Play</button><button class="DialogButton ${B} Destructive">Remove</button>`;
    d.body.append(box); added.push(box);
    await L.sleep(200);
    const [pri, des, play, desRow] = box.querySelectorAll('button');
    const col = (e) => w.getComputedStyle(e).color;
    const fill = (e) => w.getComputedStyle(e).backgroundColor;
    out.info.fills = { primary: fill(pri).slice(-40), destructive: fill(des).slice(-40), play: fill(play).slice(-40) };
    ok('primary_white_on_blue', /255, 255, 255/.test(col(pri)) && /0, 145, 255/.test(fill(pri)), { color: col(pri) });
    ok('destructive_dark_on_red', col(des) === 'rgb(13, 14, 18)' && /255, 66, 69/.test(fill(des)), { color: col(des) });
    ok('play_dark_on_green', col(play) === 'rgb(13, 14, 18)' && /48, 209, 88/.test(fill(play)), { color: col(play) });
    ok('destructive_label_red_at_rest', col(desRow) === 'rgb(255, 130, 125)', { color: col(desRow) });
    // C5 on a focusable test button: no 0 0 0 Npx ring on any control at rest
    const ring = [btn, pri, des, play].map((e) => w.getComputedStyle(e).boxShadow).filter((s) => /(^|,\s*)(rgba?\([^)]*\)\s+)?0px 0px 0px [1-9]/.test(s));
    ok('no_ring', ring.length === 0, { rings: ring });
    // C14 Reduce Motion: the pill does not travel, knob lift keyframe is opacity-only (P5)
    L.nav('/zoo/toggles'); await L.sleep(1000);
    const tg = L.q('main', L.sel('%{*GamepadDialogContent>Toggle}'));
    out.info.toggleTransition = w.getComputedStyle(tg.children[1]).transition.slice(0, 160);
  } catch (e) { out.err = String(e && e.stack || e); }
  finally {
    for (const [e, c] of marked) e.classList.remove(c);
    for (const n of added) n.remove();
    out.ok = !out.err && Object.values(out.checks).every((c) => c.ok);
  }
  return JSON.stringify(out);
})()
