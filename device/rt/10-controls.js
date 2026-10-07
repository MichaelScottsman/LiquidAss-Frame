// Glass Shell phase 2, C4a controls runtime (T2). Flag wp.c4a (off until V2 accepts C4a).
// Concept: docs/phase2/concepts/controls.md (CTL) §4.2, §4.3, §6.1, §8.3, §11, §16; evidence docs/phase2/wp/C4a.md.
//
//   Row tags     G>Field rows get data-lgs-ctl="1" (one control: the row carries the focus) or "n" (several:
//                the row warms), counted when focus or the laser first reaches the row (CTL C-D14).
//   Spot hosts   switches get P3's light spot (rt.states.addSpotHost); the rest are .Panel / button already.
//   Knob lift    gamepad A on a switch adds lgs-knob-lift for 500 ms (P5's keyframe; the laser uses :active).
//   Pill         segmented groups (%{Group}) get a decorative div.lgs-pill that carries the selected fill and
//                travels on `snappy` when the selection moves, lifting into clear glass for 180 ms (CTL §8.3).
//                rt.use('controls').pill(el) registers any other strip (library tabs, game-page tabs).
//   Tooltips     icon-only DialogButtons are registered with P3's rt.tooltip (text: aria-label or title).
//   Mute zone    a slider row holding Steam's clickable mute icon gets data-lgs-mute="on" on its icon column.
//   Value text   a full-width slider whose row shows no value gets it as decorative text (--lgs-c4a-val on the group).
//
// Everything here is decoration or a data attribute: no Steam handler, focus or value is touched, nothing is
// clicked or dispatched (CTL §16). Every attribute, class, node and listener is removed by remove().
(function lgsC4aControls() {
  'use strict';
  const RT = (typeof __LGS_RT !== 'undefined') ? __LGS_RT : window.__LGS_RT;
  if (!RT || typeof RT.define !== 'function') return;

  const LIFT_MS = 500;        // knob lift trigger (MO §4.15; P5's lgs-knob-lift runs on --lgs-d-snappy 488 ms)
  const PILL_LIFT_MS = 180;   // the pill is clear glass for its first 180 ms of travel (CTL §8.3)
  const CONTROL_ROLES = 'button, input, textarea, select, a[href], [role="checkbox"], [role="slider"], ' +
    '[role="combobox"], [role="radio"], [role="switch"], [role="button"]';

  let live = null;

  RT.define({
    name: 'controls',
    deps: ['input', 'states'],
    flag: 'wp.c4a',
    install(rt) {
      const sel = (s) => rt.sel(s);
      const S = {
        row: sel('%{*GamepadDialogContent>Field}') + ':not(' + sel('%{*GamepadDialogContent>Classic}') + ')',
        toggle: sel('%{*GamepadDialogContent>Toggle}'),
        group: sel('%{Group}') + ':not(' + sel('%{CenteredPill}') + ')',
        groupBtn: sel('%{Group>Button}'),
        groupActive: sel('%{Group>Active}'),
        iconBtn: 'button.DialogButton:is(' + sel('%{ShowKeyboardButton}') + ', ' + sel('%{BuiltInLayoutButton}') + ', ' +
          sel('%{BackButtonContent>BackButton}') + ')',
        mute: sel('%{ClickableSliderIcon}'),
        slider: sel('%{*SliderControlPanelGroup>SliderControlAndNotches}') + '[role="slider"]',
        sliderGroup: sel('%{*SliderControlAndNotches>SliderControlPanelGroup}'),
        descValue: sel('%{*SliderControlPanelGroup>DescriptionValue}'),
        withIcon: sel('%{*GamepadDialogContent>FieldChildrenWithIcon}'),
      };
      const input = rt.use('input');
      const st = {
        rows: new Set(), lifts: new Set(), pills: new Map(), docs: new Set(),
        stats: { rowsTagged: 0, single: 0, multi: 0, lifts: 0, pills: 0, travels: 0, tips: 0 },
      };
      live = st;

      // ------------------------------------------------------------ row tags (CTL C-D14)
      function controlsIn(row) {
        const all = [...row.querySelectorAll(CONTROL_ROLES)].filter((e) => e !== row);
        // outermost controls only: a slider group (role=button) holds its role=slider part
        return all.filter((e) => !all.some((o) => o !== e && o.contains(e)));
      }
      function tagRow(row) {
        if (!row || row.nodeType !== 1 || row.hasAttribute('data-lgs-ctl')) return;
        let n = 0;
        try { n = controlsIn(row).length; } catch (_) { return; }
        if (n < 1) return;          // the row itself is the control (info rows, clickable rows)
        row.setAttribute('data-lgs-ctl', n === 1 ? '1' : 'n');
        st.rows.add(row);
        // a slider with Steam's clickable mute icon: its zone (CTL C-D13). Steam's muted state is not readable
        // in the DOM on this build (no instance, P-C9), so the tag says only that the zone exists
        try {
          const ic = row.querySelector(S.mute);
          const host = ic && ic.closest(S.withIcon);
          if (host) host.setAttribute('data-lgs-mute', 'on');
        } catch (_) { /* none */ }
        st.stats.rowsTagged++;
        st.stats[n === 1 ? 'single' : 'multi']++;
      }
      function rowOf(t) {
        try { return t && t.closest ? t.closest(S.row) : null; } catch (_) { return null; }
      }

      // ------------------------------------------------------------ knob lift (gamepad A on a switch)
      function lift(tg, win) {
        tg.classList.remove('lgs-knob-lift');
        void tg.offsetWidth;                          // restart P5's keyframe on a repeat press
        tg.classList.add('lgs-knob-lift');
        st.lifts.add(tg);
        st.stats.lifts++;
        rt.setTimeout(() => { tg.classList.remove('lgs-knob-lift'); st.lifts.delete(tg); }, LIFT_MS);
      }

      // ------------------------------------------------------------ the travelling pill (CTL §8.3)
      function activeIn(strip, rec) {
        try { return strip.querySelector(rec.activeSel); } catch (_) { return null; }
      }
      function place(rec, animate) {
        const { strip, node } = rec;
        if (!strip.isConnected) { dropPill(strip); return; }
        const a = activeIn(strip, rec);
        if (!a) { node.style.opacity = '0'; return; }
        const sr = strip.getBoundingClientRect(), ar = a.getBoundingClientRect();
        const s = parseFloat(strip.ownerDocument.defaultView.getComputedStyle(strip).scale) || 1;   // never scaled today
        const x = (ar.left - sr.left) / s + rec.inset, y = (ar.top - sr.top) / s + rec.inset;
        const w = ar.width / s - 2 * rec.inset, h = ar.height / s - 2 * rec.inset;
        const moved = rec.last && (Math.abs(rec.last.x - x) > 0.5 || Math.abs(rec.last.w - w) > 0.5);
        if (!animate || !moved) node.classList.add('lgs-pill-still');
        node.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
        node.style.width = w.toFixed(1) + 'px';
        node.style.height = h.toFixed(1) + 'px';
        node.style.opacity = '';
        if (!animate || !moved) { void node.offsetWidth; node.classList.remove('lgs-pill-still'); }
        else {
          st.stats.travels++;
          node.classList.add('lgs-pill-lift');
          rt.setTimeout(() => node.classList.remove('lgs-pill-lift'), PILL_LIFT_MS);
        }
        rec.last = { x, w };
      }
      function pill(strip, opts) {
        opts = opts || {};
        if (!strip || strip.nodeType !== 1) return () => {};
        const have = st.pills.get(strip);
        if (have) return have.off;
        const doc = strip.ownerDocument;
        const node = doc.createElement('div');
        node.className = 'lgs-pill';
        node.setAttribute('aria-hidden', 'true');
        const rec = {
          strip, node, last: null, inset: opts.inset == null ? 2 : opts.inset,
          activeSel: opts.active || S.groupActive, off: null,
        };
        rec.off = () => dropPill(strip);
        strip.setAttribute('data-lgs-pill', '');
        strip.appendChild(node);
        st.pills.set(strip, rec);
        st.stats.pills++;
        place(rec, false);
        return rec.off;
      }
      function dropPill(strip) {
        const rec = st.pills.get(strip);
        if (!rec) return;
        st.pills.delete(strip);
        try { rec.node.remove(); } catch (_) { /* gone */ }
        try { strip.removeAttribute('data-lgs-pill'); } catch (_) { /* gone */ }
      }
      function stripOf(t) {
        for (const [strip] of st.pills) if (strip.contains(t)) return strip;
        try { return t && t.closest ? t.closest(S.group) : null; } catch (_) { return null; }
      }
      // after Steam moves its selected class (a click or A), move the pill on the next frame
      function settle(strip, win) {
        const rec = st.pills.get(strip);
        if (!rec) return;
        win.requestAnimationFrame(() => win.requestAnimationFrame(() => { if (st.pills.get(strip) === rec) place(rec, true); }));
      }

      // ------------------------------------------------------------ slider value text (CTL §7.2)
      // A full-width slider whose row shows no value of its own (Steam's DescriptionValue) gets its value as
      // decorative text: --lgs-c4a-val on the slider group, drawn by the group's free ::after (CSS), so no node
      // is inserted into Steam's tree. Value = min + v × (max − min) from Steam's own props and its inline
      // --normalized-slider-value, rounded to the step, formatted for the UI language with Steam's suffix.
      const vals = new Map();     // slider element -> {group, mo}
      function sliderProps(sc) {
        const k = Object.keys(sc).find((x) => x.startsWith('__reactFiber$'));
        let f = k ? sc[k] : null;
        for (let i = 0; f && i < 14; i++, f = f.return) {
          const n = f.stateNode;
          if (n && typeof n.ComputeNormalizedValueForMousePosition === 'function') return n.props || null;
        }
        return null;
      }
      function fmt(sc, p, nf) {
        const v = parseFloat(sc.style.getPropertyValue('--normalized-slider-value'));
        if (!isFinite(v)) return '';
        let x = p.min + v * (p.max - p.min);
        if (p.step > 0) x = Math.round(x / p.step) * p.step;
        if (nf.resolvedOptions().style === 'percent') return nf.format(x);   // a 0..1 level (volume): "25 %"
        const suffix = typeof p.strValueSuffix === 'string' ? p.strValueSuffix : '';
        return nf.format(x) + suffix;
      }
      function valueText(sc, win) {
        if (!sc || vals.has(sc)) return;
        const group = sc.closest(S.sliderGroup);
        const row = sc.closest(S.row);
        if (!group || !row || row.querySelector(S.descValue)) return;
        if (group.getBoundingClientRect().width < 400) return;      // inline sliders keep their full width
        const p = sliderProps(sc);
        if (!p || !isFinite(p.min) || !isFinite(p.max) || p.max <= p.min) return;
        let nf;
        // a 0..1 range with no unit of its own (Steam's volume and microphone levels) reads as a percentage
        const unit = p.max - p.min <= 1 && !(typeof p.strValueSuffix === 'string' && p.strValueSuffix)
          ? { style: 'percent', maximumFractionDigits: 0 }
          : { maximumFractionDigits: p.step > 0 && p.step < 1 ? 2 : 0 };
        try { nf = new win.Intl.NumberFormat(win.navigator.language || undefined, unit); } catch (_) { nf = new Intl.NumberFormat(undefined, unit); }
        const write = () => { try { group.style.setProperty('--lgs-c4a-val', JSON.stringify(fmt(sc, sliderProps(sc) || p, nf))); } catch (_) { /* gone */ } };
        group.setAttribute('data-lgs-val', '');
        write();
        const mo = new win.MutationObserver(write);
        mo.observe(sc, { attributes: true, attributeFilter: ['style'] });
        vals.set(sc, { group, mo });
        st.stats.values = (st.stats.values || 0) + 1;
      }
      function sweepValues(doc, win) {
        for (const [sc, rec] of vals) if (!sc.isConnected) { rec.mo.disconnect(); vals.delete(sc); }
        doc.querySelectorAll(S.slider).forEach((sc) => valueText(sc, win));
      }

      // ------------------------------------------------------------ per-window listeners
      rt.windows.track((e) => {
        if (!e || !e.doc) return;
        const { doc, win } = e;
        st.docs.add(doc);
        // sliders appear with their page: one coalesced sweep per frame after DOM changes (main window only)
        if (e.kind === 'main' && doc.body) {
          let raf = 0;
          const mo = new win.MutationObserver(() => {
            if (raf) return;
            raf = win.requestAnimationFrame(() => { raf = 0; sweepValues(doc, win); });
          });
          mo.observe(doc.body, { childList: true, subtree: true });
          sweepValues(doc, win);
          rt.cleanup(() => { mo.disconnect(); if (raf) win.cancelAnimationFrame(raf); });
        }
        const onFocus = (ev) => {
          const t = ev.target;
          tagRow(rowOf(t));
          const g = stripOf(t);
          if (g && !st.pills.has(g) && g.matches(S.group)) pill(g);
        };
        const onOver = (ev) => {
          if (input.mode !== 'laser') return;
          const t = ev.target;
          tagRow(rowOf(t));
          const g = stripOf(t);
          if (g && !st.pills.has(g) && g.matches(S.group)) pill(g);
        };
        const onDown = (ev) => {
          const d = ev.detail || {};
          if (d.button !== 1 || d.is_repeat) return;
          const t = ev.target;
          const tg = t && t.closest ? t.closest(S.toggle) : null;
          if (tg) lift(tg, win);
          const g = stripOf(t);
          if (g) settle(g, win);
        };
        const onClick = (ev) => {
          const g = stripOf(ev.target);
          if (g) settle(g, win);
        };
        rt.listen(doc, 'vgp_onfocus', onFocus, { capture: true, passive: true });
        rt.listen(doc, 'pointerover', onOver, { capture: true, passive: true });
        rt.listen(doc, 'vgp_onbuttondown', onDown, { capture: true, passive: true });
        rt.listen(doc, 'click', onClick, { capture: true, passive: true });
        return () => st.docs.delete(doc);
      });

      // ------------------------------------------------------------ spot host and tooltips
      try {
        const states = rt.use('states');
        if (states && typeof states.addSpotHost === 'function') rt.cleanup(states.addSpotHost(S.toggle));
      } catch (err) { rt.warn('spot host not added', String(err && err.message || err)); }
      if (rt.has('tooltip')) {
        try {
          const tip = rt.use('tooltip');
          const text = (el) => ((el.getAttribute('aria-label') || el.getAttribute('title') || '') + '').trim().slice(0, 32);
          rt.cleanup(tip.register(S.iconBtn, { text }));
          st.stats.tips++;
        } catch (err) { rt.warn('tooltip registration failed', String(err && err.message || err)); }
      }

      rt.cleanup(() => {
        for (const row of st.rows) { try { row.removeAttribute('data-lgs-ctl'); } catch (_) { /* gone */ } }
        st.rows.clear();
        for (const tg of st.lifts) { try { tg.classList.remove('lgs-knob-lift'); } catch (_) { /* gone */ } }
        st.lifts.clear();
        for (const strip of [...st.pills.keys()]) dropPill(strip);
        for (const [, rec] of vals) { rec.mo.disconnect(); try { rec.group.removeAttribute('data-lgs-val'); rec.group.style.removeProperty('--lgs-c4a-val'); } catch (_) { /* gone */ } }
        vals.clear();
        // rows tagged before a re-render may have been detached and re-attached: sweep every known document
        for (const doc of st.docs) {
          try {
            doc.querySelectorAll('[data-lgs-ctl]').forEach((n) => n.removeAttribute('data-lgs-ctl'));
            doc.querySelectorAll('[data-lgs-mute]').forEach((n) => n.removeAttribute('data-lgs-mute'));
            doc.querySelectorAll('.lgs-knob-lift').forEach((n) => n.classList.remove('lgs-knob-lift'));
            doc.querySelectorAll('.lgs-pill').forEach((n) => n.remove());
            doc.querySelectorAll('[data-lgs-pill]').forEach((n) => n.removeAttribute('data-lgs-pill'));
            doc.querySelectorAll('[data-lgs-val]').forEach((n) => { n.removeAttribute('data-lgs-val'); n.style.removeProperty('--lgs-c4a-val'); });
          } catch (_) { /* closed */ }
        }
        if (live === st) live = null;
      });

      return {
        pill,
        tagRow,
        stats: () => Object.assign({ rows: st.rows.size, pillsLive: st.pills.size, valuesLive: vals.size }, st.stats),
        test: {
          // place every live pill again (after a layout change in a test)
          replace() { for (const rec of st.pills.values()) place(rec, false); return st.pills.size; },
          controlsIn: (row) => controlsIn(row).length,
        },
      };
    },
    remove() {
      return { left: live ? live.rows.size + live.pills.size : 0 };
    },
  });
})();
