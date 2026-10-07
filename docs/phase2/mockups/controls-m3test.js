// C4a M3 tests (T2, module `controls`, flag wp.c4a). Run inside one locked step:
//   python glass.py js "$(cat docs/phase2/mockups/controls-m3test.js)" --flags wp.p3,wp.c4a --mode pad|laser
// Only Steam's /zoo demo controls are operated (one demo switch is flipped and flipped back); settings routes are
// only looked at and focused. Everything this script adds is removed in finally.
(async () => {
  const R = window.__LGS_RT, out = { mode: R.input ? R.input.mode : '?', checks: {}, info: {} };
  const ok = (k, v, info) => { out.checks[k] = { ok: !!v, ...(info || {}) }; };
  const w = L.surface('main'), d = w.document;
  const F = L.sel('%{*GamepadDialogContent>Field}'), T = L.sel('%{*GamepadDialogContent>Toggle}'), ON = L.sel('%{*GamepadDialogContent>On}');
  const added = [];
  const start = L.route();
  try {
    const m = R.module('controls');
    ok('installed', m && m.state === 'installed', { state: m && m.state });
    const C = R.use('controls');
    // 1. row tags on focus (pad) or pointer (laser: tagged by pointerover)
    L.nav('/zoo/toggles'); await L.sleep(1300);
    if (out.mode === 'pad') {
      await L.root(); await L.sleep(300);
      await L.gpTake('main', T + ':not(' + ON + ')'); await L.sleep(300);
      const tg = [...L.qa('main', T)].find((e) => !e.matches(ON) && !/Disabled/.test(e.className));
      const row = tg.closest(F);
      ok('row_tag_single', row.getAttribute('data-lgs-ctl') === '1', { tag: row.getAttribute('data-lgs-ctl'), rowFocus: w.getComputedStyle(row).getPropertyValue('--lgs-focus'), rail: w.getComputedStyle(tg.children[0]).getPropertyValue('--lgs-focus') });
      // 2. knob lift: gamepad A on the demo switch (zoo demo; flipped back below)
      const was = tg.getAttribute('aria-checked');
      const fire = (type) => tg.dispatchEvent(new w.CustomEvent(type, { bubbles: true, cancelable: true, detail: { button: 1, source: 1, is_repeat: false } }));
      fire('vgp_onbuttondown');
      const liftOn = tg.classList.contains('lgs-knob-lift');
      const anim = d.getAnimations().filter((a) => a.animationName === 'lgs-knob-lift').map((a) => ({ state: a.playState, dur: a.effect.getTiming().duration }));
      fire('vgp_onbuttonup');
      await L.sleep(650);
      const liftOff = !tg.classList.contains('lgs-knob-lift');
      const now = tg.getAttribute('aria-checked');
      if (now !== was) { fire('vgp_onbuttondown'); fire('vgp_onbuttonup'); await L.sleep(400); }
      ok('knob_lift', liftOn && liftOff && anim.length > 0, { liftOn, liftOff, anim, flipped: now !== was, restored: tg.getAttribute('aria-checked') === was });
      // multi-control row (check matrix) on a settings route: focus only
      L.nav('/settings/notifications'); await L.sleep(1500);
      const cb = L.q('main', '.DialogCheckbox'); cb.scrollIntoView({ block: 'center' }); await L.sleep(300);
      await L.gpTake('main', '.DialogCheckbox'); await L.sleep(300);
      const crow = cb.closest(F);
      ok('row_tag_multi', crow && crow.getAttribute('data-lgs-ctl') === 'n', { tag: crow && crow.getAttribute('data-lgs-ctl'), rowFocus: crow && w.getComputedStyle(crow).getPropertyValue('--lgs-focus') });
    }
    // 3. the pill on our own test strip (no Steam control is touched)
    L.nav('/zoo/buttons'); await L.sleep(1000);
    const strip = d.createElement('div');
    strip.style.cssText = 'position:fixed;left:300px;top:300px;display:flex;width:600px;height:64px;padding:2px;box-sizing:border-box;z-index:9999';
    strip.innerHTML = ['A', 'B', 'C'].map((t, i) => `<div class="lgsc-seg${i === 0 ? ' lgsc-on' : ''}" style="flex:1;height:60px">${t}</div>`).join('');
    d.body.append(strip); added.push(strip);
    const off = C.pill(strip, { active: '.lgsc-on' });
    const p = strip.querySelector('.lgs-pill');
    const r0 = p && p.getBoundingClientRect();
    strip.children[0].classList.remove('lgsc-on'); strip.children[2].classList.add('lgsc-on');
    strip.children[2].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => w.requestAnimationFrame(() => w.requestAnimationFrame(() => w.requestAnimationFrame(r))));
    const lifting = p.classList.contains('lgs-pill-lift');
    const tr = w.getComputedStyle(p).transitionDuration;
    await L.sleep(700);
    const r1 = p.getBoundingClientRect(), c2 = strip.children[2].getBoundingClientRect();
    ok('pill_travel', !!p && lifting && Math.abs(r1.left - (c2.left + 2)) < 1.5 && Math.abs(r1.width - (c2.width - 4)) < 1.5 && !p.classList.contains('lgs-pill-lift'),
      { r0: r0 && [r0.left, r0.width].map(Math.round), r1: [r1.left, r1.width].map(Math.round), target: [c2.left + 2, c2.width - 4].map(Math.round), lifting, transition: tr, aria: p.getAttribute('aria-hidden') });
    off();
    ok('pill_off', !strip.querySelector('.lgs-pill') && !strip.hasAttribute('data-lgs-pill'));
    // 4. tooltips: the registration exists; an icon-only button's tip text is its aria-label
    out.info.tooltip = R.has('tooltip') ? { owners: R.use('tooltip').state().owners } : 'no tooltip module';
    L.nav('/settings/keyboard'); await L.sleep(1500);
    const kb = L.q('main', 'button.DialogButton' + L.sel('%{ShowKeyboardButton}'));
    if (kb && R.has('tooltip')) {
      const tip = R.use('tooltip');
      kb.scrollIntoView({ block: 'center' }); await L.sleep(300);
      tip.show(kb); await L.sleep(400);
      const s = tip.state().shown;
      out.info.kbButton = { aria: kb.getAttribute('aria-label'), title: kb.getAttribute('title'), rect: [kb.getBoundingClientRect().width, kb.getBoundingClientRect().height].map(Math.round), radius: w.getComputedStyle(kb).borderRadius };
      ok('tooltip_icon_button', kb.getAttribute('aria-label') ? s.some((t) => t.text === kb.getAttribute('aria-label')) : s.length === 0, { shown: s.map((t) => t.text) });
      tip.hideAll();
    } else out.info.kbButton = kb ? 'no tooltip module' : 'no ShowKeyboardButton';
    // 4b. slider value text on a settings route with no value of its own (look only)
    L.nav('/settings/audio'); await L.sleep(1500);
    const vt = [...L.qa('main', '[data-lgs-val]')].map((g) => ({ text: g.style.getPropertyValue('--lgs-c4a-val'), after: w.getComputedStyle(g, '::after').content, pe: w.getComputedStyle(g, '::after').pointerEvents }));
    ok('slider_value_text', vt.length >= 1 && vt.every((v) => v.text && v.after === v.text && v.pe === 'none'), { values: vt });
    // 5. removal (C19): turn the flag off inside the step, look for leftovers, then restore
    const tok = R.test.flags.push({ 'wp.c4a': false }); await (R.settled ? R.settled() : L.sleep(500)); await L.sleep(300);
    const left = [];
    for (const e of R.windows.list()) {
      try {
        const q = (s) => e.doc.querySelectorAll(s).length;
        const n = q('[data-lgs-ctl]') + q('.lgs-pill') + q('[data-lgs-pill]') + q('.lgs-knob-lift') + q('[data-lgs-val]') + q('[data-lgs-mute]');
        if (n) left.push({ kind: e.kind, n });
      } catch (_) { /* closed */ }
    }
    ok('removal', R.module('controls').state === 'off' && left.length === 0, { state: R.module('controls').state, left });
    R.test.flags.pop(tok); await (R.settled ? R.settled() : L.sleep(500));
    out.info.reinstalled = R.module('controls').state;
  } catch (e) { out.err = String(e && e.stack || e); }
  finally {
    for (const n of added) n.remove();
    if (L.route() !== start) { L.nav(start); await L.sleep(600); }
    out.ok = !out.err && Object.values(out.checks).every((c) => c.ok);
  }
  return JSON.stringify(out);
})()
