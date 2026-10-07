/* controls-probe.js — acceptance probes for docs/phase2/concepts/controls.md (§17 P-C*, §18 C2, C6, C7, C11).
 *
 * Runs in Steam's SharedJSContext with the lab helpers (L), one locked step per call (the js timeout is 60 s):
 *   python glass.py js "$(cat docs/phase2/concepts/controls-probe.js)({parts:['hit','slider']})"
 *   python glass.py js "$(cat docs/phase2/concepts/controls-probe.js)({parts:['disabled'],routes:['/zoo/buttons','/settings/system']})"
 *   python glass.py js "$(cat docs/phase2/concepts/controls-probe.js)({parts:['vgp','firstframe']})"
 *   python glass.py js "$(cat docs/phase2/concepts/controls-probe.js)({parts:['kbsrc']})"
 * The file is a function expression: always append the call, e.g. "(…)()" runs the default parts ['hit','slider'].
 *
 * Nothing is clicked, typed or pressed. The only input is D-pad navigation through FocusNavController (L.pad): Down/Up, and
 * one Right from a page list into its page (L.pad refuses Left/Right while a slider has focus). Geometry is probed only on
 * Steam's /zoo demo pages; 'disabled' also walks /settings/system by D-pad (navigation only, as settings-pad.js does).
 * Every <style>, attribute and listener the probe adds is removed in `finally`, and the starting route is restored.
 * Results of the 2026-10-07 runs: controls.md §17 (P-C2, P-C3, P-C7, P-C8, P-C11, P-C12).
 * mode 'probe' (default) injects the vocabulary's geometry rules on marked demo controls; mode 'theme' measures whatever the
 * live theme does (use it once the Phase 2 primitives ship).
 */
(async (O) => {
  O = O || {};
  const PARTS = O.parts || ['hit', 'slider'], MODE = O.mode || 'probe';
  const out = { mode: MODE, parts: PARTS, start: L.route(), checks: {}, info: {} };
  const pass = (k, ok, info) => { out.checks[k] = { ok: !!ok, ...(info || {}) }; };
  const w = L.surface('main'), d = w.document, added = [], marked = [], listeners = [];
  const inst = SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
  const R = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10); };
  const addStyle = (css) => { const s = d.createElement('style'); s.textContent = css; d.head.append(s); added.push(s); };
  const mark = (e, a) => { e.setAttribute(a, '1'); marked.push([e, a]); };
  const gp = () => { const a = d.querySelectorAll('.gpfocus'); return a.length ? a[a.length - 1] : null; };
  const desc = (e) => e ? ((e.getAttribute('aria-label') || e.innerText || e.tagName) + '').trim().replace(/\s+/g, ' ').slice(0, 32) : null;
  const isDis = (e) => !!e && (/Disabled/.test(e.className) || e.getAttribute('aria-disabled') === 'true' || e.disabled === true);
  const step = async (dir) => { try { await L.pad(dir, 1); return true; } catch (err) { return String(err.message || err); } };
  const root = async () => { inst.FocusApplicationRoot(); await L.sleep(300); await step('down'); await step('up'); };
  try {
    /* ------------------------------------------------ hit: switch at visionOS size (scale 1.75) + extender inset -12px -6px */
    if (PARTS.includes('hit')) {
      L.nav('/zoo/toggles'); await L.sleep(1600);
      const ts = [...L.qa('main', '%{*GamepadDialogContent>Toggle}')].filter((e) => e.getBoundingClientRect().width > 0 && !/Disabled/.test(e.className));
      const off = ts.find((e) => e.getAttribute('aria-checked') !== 'true'), on = ts.find((e) => e.getAttribute('aria-checked') === 'true');
      if (MODE === 'probe') { addStyle('[data-lgsc-t]{scale:1.75}[data-lgsc-t]::before{content:"";position:absolute;inset:-12px -6px}'); for (const t of [on, off]) if (t) mark(t, 'data-lgsc-t'); }
      await L.sleep(120);
      for (const [name, t] of [['on', on], ['off', off]]) {
        if (!t) { pass('switch_' + name, false, { err: 'no demo toggle' }); continue; }
        const r = t.getBoundingClientRect(), k = t.children[1].getBoundingClientRect();
        const hit = (x, y) => { const e = d.elementFromPoint(x, y); return !!(e && (e === t || t.contains(e))); };
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const own = hit(cx, cy) && hit(r.left + 3, cy) && hit(r.right - 3, cy);
        // 80.5 px tall, 87.5 px wide. /zoo/toggles stacks demo toggles at a 52 px pitch, so only the side away from the
        // neighbouring marked toggle is tested vertically (in 80 px rows the extenders meet; P-C3).
        const other = name === 'on' ? off : on, below = other && other.getBoundingClientRect().top > r.top;
        const ext = (below ? hit(cx, r.top - 19) : hit(cx, r.bottom + 19)) && hit(r.left - 8, cy) && hit(r.right + 8, cy);
        const beyond = below ? !hit(cx, r.top - 25) : !hit(cx, r.bottom + 25);
        // theme mode: the knob is drawn ~3 px inside the track (CTL §6.1), so allow 4 px
        const tol = MODE === 'theme' ? 4 : 2;
        const knobOk = name === 'on' ? Math.abs(k.right - r.right) < tol : Math.abs(k.left - r.left) < tol;
        pass('switch_' + name, r.width >= 64 && r.height >= 38 && own && ext && knobOk, { rect: R(t), knob: R(t.children[1]), own, ext, beyondNotHit: beyond, knobOk });
      }
      for (const [e, a] of marked.splice(0)) e.removeAttribute(a);
      for (const s of added.splice(0)) s.remove();
    }

    /* ------------------------------------------------ slider: capsule (64 track, 64 handle), notches, origin, default tick */
    if (PARTS.includes('slider')) {
      L.nav('/zoo/sliders'); await L.sleep(1600);
      const all = [...d.querySelectorAll('[role=slider]')].filter((e) => e.getBoundingClientRect().width > 0);
      const instOf = (sc) => { let f = sc[Object.keys(sc).find((k) => k.startsWith('__reactFiber$'))]; for (let i = 0; f && i < 12; i++, f = f.return) if (f.stateNode && typeof f.stateNode.ComputeNormalizedValueForMousePosition === 'function') return f.stateNode; return null; };
      const NOTCH = L.sel('%{*SliderControlPanelGroup>SliderNotch}'), TICK = L.sel('%{*SliderControlPanelGroup>SliderNotchTick}'), LABEL = L.sel('%{*SliderControlPanelGroup>SliderNotchLabel}');
      const DTICK = L.sel('%{*SliderControlPanelGroup>DefaultValueTick}'), DRANGE = L.sel('%{*SliderControlPanelGroup>DefaultValueIsColorRange}');
      const DLEFT = L.sel('%{*SliderControlPanelGroup>DefaultValueColorLeft}'), DRIGHT = L.sel('%{*SliderControlPanelGroup>DefaultValueColorRight}');
      const flags = (sc) => ['range', 'left', 'right'].filter((k, i) => sc.matches([DRANGE, DLEFT, DRIGHT][i]) || sc.querySelector([DRANGE, DLEFT, DRIGHT][i]) || sc.closest([DRANGE, DLEFT, DRIGHT][i])).join(',');
      out.info.sliders = all.map((sc) => ({ label: sc.getAttribute('aria-label'), v: sc.style.getPropertyValue('--normalized-slider-value').trim(), origin: sc.style.getPropertyValue('--normalized-slider-origin').trim(),
        notches: sc.querySelectorAll(NOTCH).length, ticks: sc.querySelectorAll(TICK).length, defaultTick: sc.querySelectorAll(DTICK).length, colour: flags(sc) }));
      const css = '[data-lgsc-c],[data-lgsc-c] .SliderControl{--slider-handle-width:64px!important}[data-lgsc-c] .SliderControl{height:64px!important}[data-lgsc-c] .SliderTrack{height:64px!important;border-radius:32px!important}' +
                  '[data-lgsc-c] .SliderHandle{width:var(--slider-handle-width)!important;height:var(--slider-handle-width)!important}[data-lgsc-g]{padding-block:12px!important}' +
                  // Steam lays notches and the default-value tick out for its own 24 px handle: notch cells are `width/min-width: 24px;
                  // flex-basis: 0` in a space-between row, and the 24 px tick sits at inset-inline-end 0 of a container translated by
                  // -(1 - d) x (100% - handle width). With the 64 px handle: 64 px notch cells, and the tick 20 px in from the end.
                  '[data-lgsc-c] ' + NOTCH + '{width:64px!important;min-width:64px!important;flex-basis:64px!important}' +
                  '[data-lgsc-c] ' + DTICK + '{inset-inline-end:calc((var(--slider-handle-width) - 24px) / 2)!important}';
      if (MODE === 'probe') addStyle(css);
      // 1. the continuous slider (P-C2)
      const sc = all.find((e) => !e.querySelector(NOTCH)), si = sc && instOf(sc);
      if (!sc || !si) pass('slider_found', false); else {
        const track = sc.querySelector('.SliderTrack'), hdl = sc.querySelector('.SliderHandle'), grp = sc.closest('.SliderControlPanelGroup');
        const v = parseFloat(sc.style.getPropertyValue('--normalized-slider-value'));
        const map = () => { si.RecomputeSliderBounds(); const r = track.getBoundingClientRect(); return [0, .25, .5, .75, 1].map((q) => si.ComputeNormalizedValueForMousePosition(r.left + q * r.width)); };
        const before = map();
        if (MODE === 'probe') { mark(sc, 'data-lgsc-c'); if (grp) mark(grp, 'data-lgsc-g'); }
        await L.sleep(150);
        const after = map(), tr = track.getBoundingClientRect(), hr = hdl.getBoundingClientRect(), gr = grp.getBoundingClientRect(), hw = hr.width;
        const centreFrac = (hr.left + hw / 2 - tr.left - hw / 2) / (tr.width - hw);
        const knobMaps = Math.abs(si.ComputeNormalizedValueForMousePosition(hr.left + hw / 2) - v) < 0.01;
        const hitTop = (() => { const e = d.elementFromPoint(gr.left + gr.width / 2, gr.top + 4); return !!(e && e.closest('.SliderControlPanelGroup') === grp); })();
        pass('slider_track', tr.height >= 60, { track: R(track) });
        pass('slider_group_hit', gr.height >= 80 && hitTop, { group: R(grp), hitTop });
        pass('slider_knob_value', Math.abs(hw - 64) < 1 && Math.abs(centreFrac - v) < 0.01 && knobMaps, { handle: R(hdl), value: v, centreFrac: Math.round(centreFrac * 1000) / 1000 });
        pass('slider_mid_unchanged', Math.abs(before[2] - after[2]) < 0.002, { before: before.map((x) => +x.toFixed(3)), after: after.map((x) => +x.toFixed(3)) });
        // the knob's zone never overlaps whatever precedes the track (the mute glyph sits before the group, C-D13)
        const kx = (vv) => tr.left + hw / 2 + vv * (tr.width - hw);
        const knobHits = [0, 0.05, 0.1].map((vv) => { const e = d.elementFromPoint(kx(vv), tr.top + tr.height / 2); return !!(e && e.closest('.SliderControlPanelGroup') === grp); });
        pass('slider_low_values_hit_group', knobHits.every(Boolean), { at: [0, 0.05, 0.1], knobHits });
      }
      // 1b. the default-value tick keeps marking the same value with the 64 px handle
      const sd = all.find((e) => e.querySelector(DTICK)), di = sd && instOf(sd);
      if (sd && di) {
        const g = sd.closest('.SliderControlPanelGroup'), at = () => { di.RecomputeSliderBounds(); const r = sd.querySelector(DTICK).getBoundingClientRect(); return { x: Math.round((r.left + r.width / 2) * 10) / 10, v: +di.ComputeNormalizedValueForMousePosition(r.left + r.width / 2).toFixed(4), w: Math.round(r.width), h: Math.round(r.height) }; };
        const b = at(); if (MODE === 'probe') { mark(sd, 'data-lgsc-c'); if (g) mark(g, 'data-lgsc-g'); } await L.sleep(150); const a = at();
        const tr = sd.querySelector('.SliderTrack').getBoundingClientRect();
        pass('default_tick_same_value', Math.abs(a.v - b.v) * (tr.width - 64) <= 2, { before: b, after: a, value: sd.style.getPropertyValue('--normalized-slider-value').trim() });
      }
      // 2. a notched slider: tick centre vs the knob centre for that notch's value, with the 64 px handle
      const sn = all.find((e) => e.querySelectorAll(TICK).length >= 3) || all.find((e) => e.querySelectorAll(TICK).length >= 2), ni = sn && instOf(sn);
      if (!sn || !ni) pass('notched_found', false, { note: 'no notched slider on /zoo/sliders' }); else {
        const grp = sn.closest('.SliderControlPanelGroup');
        const measure = () => {
          ni.RecomputeSliderBounds();
          const ticks = [...sn.querySelectorAll(TICK)], n = ticks.length, hw = sn.querySelector('.SliderHandle').getBoundingClientRect().width;
          const tr = sn.querySelector('.SliderTrack').getBoundingClientRect();
          return ticks.map((t, i) => {
            const r = t.getBoundingClientRect(), x = r.left + r.width / 2, vExp = n > 1 ? i / (n - 1) : 0;
            const vAt = ni.ComputeNormalizedValueForMousePosition(x);
            return { i, tickX: Math.round(x * 10) / 10, vAtTick: +vAt.toFixed(4), vExpected: +vExp.toFixed(4), errPx: Math.round((vAt - vExp) * (tr.width - hw) * 10) / 10 };
          });
        };
        const before = measure();
        if (MODE === 'probe') { mark(sn, 'data-lgsc-c'); if (grp) mark(grp, 'data-lgsc-g'); }
        await L.sleep(150);
        const after = measure();
        out.info.notchedHandle = R(sn.querySelector('.SliderHandle'));
        const vNow = parseFloat(sn.style.getPropertyValue('--normalized-slider-value'));
        const hr = sn.querySelector('.SliderHandle').getBoundingClientRect(), knobX = hr.left + hr.width / 2;
        const nearest = after.reduce((a, b) => (Math.abs(b.vExpected - vNow) < Math.abs(a.vExpected - vNow) ? b : a));
        pass('notch_ticks_under_knob', after.every((t) => Math.abs(t.errPx) <= 2) && Math.abs(nearest.tickX - knobX) <= 2,
          { label: sn.getAttribute('aria-label'), before, after, value: vNow, knobX: Math.round(knobX * 10) / 10, nearestTickX: nearest.tickX });
        // 3. 18 px Semibold title-case labels in a 270 px wide slider (Quick Access width at m 0.83 is 270 popup px; this is a proxy)
        addStyle('[data-lgsc-n] ' + LABEL + '{font-size:18px!important;font-weight:600!important;text-transform:none!important;letter-spacing:0!important}[data-lgsc-w]{width:270px!important;max-width:270px!important;flex:none!important}');
        mark(sn, 'data-lgsc-n'); if (grp) mark(grp, 'data-lgsc-w');
        await L.sleep(150);
        const labs = [...sn.querySelectorAll(LABEL)].map((e) => ({ t: e.innerText.trim(), r: e.getBoundingClientRect() }));
        let overlaps = 0; for (let i = 1; i < labs.length; i++) if (labs[i].r.left < labs[i - 1].r.right - 0.5) overlaps++;
        pass('notch_labels_270', overlaps === 0, { labels: labs.map((l) => `${l.t} [${Math.round(l.r.left)}-${Math.round(l.r.right)}]`), overlaps });
      }
    }

    /* ------------------------------------------------ disabled: can D-pad focus land on a disabled control? (C6 disabled cases) */
    if (PARTS.includes('disabled')) {
      out.info.disabled = {};
      for (const route of O.routes || ['/zoo/toggles', '/zoo/buttons']) {
        L.nav(route); await L.sleep(1500); await root();
        await step('right');   // from the page list into the page (Right never acts on a list item; L.pad refuses it on sliders)
        const disabledFocusables = [...d.querySelectorAll('.Focusable')].filter((e) => isDis(e) && e.getBoundingClientRect().width > 0).map(desc);
        const seen = [], landed = [];
        for (let i = 0; i < (O.steps || 14); i++) {
          const f = gp(); if (f) { seen.push(desc(f) + (isDis(f) ? ' [DISABLED]' : '')); if (isDis(f)) landed.push({ el: desc(f), cls: f.className.split(' ').filter((c) => !/^_/.test(c) || c.length < 4).join(' ').slice(0, 80) }); }
          if ((await step('down')) !== true) break;
        }
        out.info.disabled[route] = { disabledFocusables, landedOnDisabled: landed, walk: seen };
      }
      const any = Object.values(out.info.disabled).some((r) => r.landedOnDisabled.length);
      pass('disabled_takes_focus', true, { landed: any, note: any ? 'focus lands on disabled controls: the .Disabled.gpfocus look is required' : 'no disabled control took focus on these routes' });
    }

    /* ------------------------------------------------ vgp: does a passive capture listener see Steam's gamepad dispatch? (C7) */
    if (PARTS.includes('vgp')) {
      L.nav('/zoo/buttons'); await L.sleep(1500); await root(); await step('right');
      const got = [];
      for (const t of ['vgp_onbuttondown', 'vgp_onbuttonup', 'vgp_onfocus', 'vgp_onblur']) {
        const fn = (ev) => got.push({ type: ev.type, button: ev.detail && ev.detail.button, source: ev.detail && ev.detail.source, target: desc(ev.target), focusedNow: desc(gp()) });
        w.addEventListener(t, fn, true); listeners.push([t, fn]);
      }
      const before = desc(gp()); await step('down'); const after = desc(gp());
      const down = got.find((g) => g.type === 'vgp_onbuttondown' && g.button === 10);
      pass('vgp_capture_sees_dpad', !!down, { before, after, events: got.slice(0, 8) });
    }

    /* ------------------------------------------------ firstframe: an entry keyframe from opacity .6 shows 60 % on Steam's first focus frame (C6) */
    if (PARTS.includes('firstframe')) {
      L.nav('/zoo/buttons'); await L.sleep(1500); await root(); await step('right');
      addStyle('@keyframes lgsc-ff{from{opacity:.6}to{opacity:1}}html[data-lgsc-ff] .DialogButton.gpfocus::after{content:"";position:absolute;inset:0;pointer-events:none;background:rgb(255 255 255/.14);animation:lgsc-ff 294ms cubic-bezier(.2,0,0,1) both}');
      mark(d.documentElement, 'data-lgsc-ff');
      const prev = gp();
      FocusNavController.DispatchVirtualButtonClick(10);
      let el = null, frames = 0;
      for (; frames < 12; frames++) { await new Promise((r) => w.requestAnimationFrame(r)); el = gp(); if (el && el !== prev && el.matches('.DialogButton')) break; }
      const anims = d.getAnimations().filter((a) => a.animationName === 'lgsc-ff');
      for (const a of anims) { a.pause(); a.currentTime = 0; }
      const op0 = el ? parseFloat(w.getComputedStyle(el, '::after').opacity) : null;
      for (const a of anims) a.play();
      await L.sleep(700);
      const op1 = el ? parseFloat(w.getComputedStyle(el, '::after').opacity) : null;
      const states = {}; for (const a of d.getAnimations()) states[a.playState] = (states[a.playState] || 0) + 1;
      pass('focus_first_frame_60', el && Math.abs(op0 - 0.6) < 0.02 && Math.abs(op1 - 1) < 0.02, { from: desc(prev), to: desc(el), framesUntilFocus: frames, opacityAtT0: op0, opacityAfter700ms: op1 });
      out.info.animationStatesAfterFocus = states;   // Steam's ItemFocusAnim-* forwards fills report 'finished', not 'running'
    }

    /* ------------------------------------------------ kbsrc: where do the IME and emoji rows render, and what sets the content height? (C11, risk 2) */
    if (PARTS.includes('kbsrc')) {
      let req; window.webpackChunksteamui.push([[Symbol('lgsc-kb')], {}, (r) => { req = r; }]);
      const hits = [];
      for (const id of Object.keys(req.m)) {
        const s = req.m[id].toString();
        if (!/Row_IME|KeyboardImeLutKey|EmojiKeyboard|VRVirtualKeyboardContents/.test(s)) continue;
        const snip = (re) => { const m = re.exec(s); return m ? s.slice(Math.max(0, m.index - (O.before || 160)), m.index + (O.after || 260)).replace(/\s+/g, ' ') : null; };
        hits.push({ id, len: s.length, rowIME: snip(/Row_IME/), contents: snip(/VRVirtualKeyboardContents/), emoji: snip(/EmojiKeyboard[^a-zA-Z]/), height: snip(/(clientHeight|offsetHeight|ResizeObserver|style:\{height)/) });
      }
      out.info.kbsrc = hits.slice(0, 8);
      pass('kbsrc_found', hits.length > 0, { modules: hits.map((h) => h.id + ':' + h.len) });
    }
  } catch (e) { out.err = String(e && e.stack || e); }
  finally {
    for (const [t, fn] of listeners) w.removeEventListener(t, fn, true);
    for (const s of added) s.remove();
    for (const [e, a] of marked) e.removeAttribute(a);
    if (L.route() !== out.start) { L.nav(out.start); await L.sleep(800); }
    out.back = L.route();
    out.ok = !out.err && Object.values(out.checks).every((c) => c.ok);
  }
  return out;
})
