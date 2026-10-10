/* Glass Shell: the paintbrush on the bar (the glass tuner; flag glassTune).
   - Where: a glass circle of its own after the system capsule (and after the assPod's music note,
     34-asspod.js, when that is on), a child of the bar's
     %{PopupBody>DashboardBar} (mirroring the Home circle, Steam's Bookend, before the apps capsule).
     Added by a layer on P2's `dashboardBar` patch (rt.react.patch.targets.dashboardBar); its glass
     is theme/33-tune.css, its native cover theme/layers/30-bar.json (.lgs-tune).
   - The button is Steam's own bar popup button (the component behind Room View, the status pill and
     the avatar: {refBarPopupHandle, popupContents, tooltip, children(ref, navRef)}), so opening one bar
     popup closes the others, the popup sits at the bar popups' depth and the Active disc shows while
     it is open, as for every bar button.
   - The panel (the bar popup, at most 300 px): colour swatches and tint strength, Glass intensity (the
     dial), Refraction, Frost, Highlights, Reset to default. Every change goes to the daemon's
     `glass.tune` action (at most one call per SEND_MS; glassd eases to it, tune.json keeps it across
     reboots) and to the CSS glass of every Steam window at once (a <style> per window: --lgs-dial,
     --lgs-tune-hue, --lgs-tune-hue-k; theme/00-tokens.nowrap.css mixes the colour in).
   - Refraction and Highlights exist only in glassd: without native glass their rows are disabled.
   remove(): the patch layer, the styles and the subscriptions go; tune.json stays (the wearer's). */
let TUNE = null;
__LGS_RT.define({
  name: 'tune',
  deps: ['react'],
  flag: 'glassTune',
  install(rt) {
    const R = rt.react;
    R.ready();
    const { React, jsx, jsxs } = R;
    const c = R.c || {};
    const Focusable = c.Focusable || R.Focusable;
    if (!Focusable) throw new Error('tune: no Focusable');
    if (!R.patch.targets.dashboardBar) throw new Error('tune: no dashboardBar target');

    const DEFAULT = { dial: 0.5, hue: null, hueK: 0.5, refract: 1, frost: 1, light: 1 };
    const SEND_MS = 50;        // the daemon takes one glass.tune call per 40 ms
    const LOCAL_HOLD_MS = 800; // the bridge's echo of an older value never moves a slider being dragged
    // the colours (sRGB), None first: Apple-like system hues, a cool ice and a neutral graphite
    const HUES = [[null, 'None'], ['#d8e6f5', 'Ice'], ['#0a84ff', 'Blue'], ['#8e6cff', 'Violet'],
      ['#ff5c8a', 'Rose'], ['#ffad33', 'Amber'], ['#30d18c', 'Mint'], ['#8a8f99', 'Graphite']];
    const ICON = jsx('svg', { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true', children: [
      jsx('path', { d: 'M20.3 2.3a1.6 1.6 0 0 1 2.3 2.3l-9.3 9.6-2.3-2.3z' }, 'h'),
      jsx('path', { d: 'M10.1 12.8l2.1 2.1-1 1.2a1.6 1.6 0 0 1-1 .5l-.6.1-2.4-2.4.1-.6a1.6 1.6 0 0 1 .5-1z' }, 'f'),
      jsx('path', { d: 'M6.6 15.2l3.1 3.1c-.2 2.6-2.2 4.3-4.9 4.3H1.6c1.2-.9 1.4-2 1.6-3.2.3-2.4 1.4-4 3.4-4.2z' }, 'b'),
    ] });

    const S = TUNE = {
      rt, R, handle: null, Btn: null, lastErr: null, sent: 0, subs: new Set(), styles: new Map(),
      cur: Object.assign({}, DEFAULT), lastLocal: 0, pending: null, timer: 0, off: [],
    };
    const merge = (v) => {
      const t = Object.assign({}, DEFAULT);
      if (v && typeof v === 'object') {
        for (const k of ['dial', 'hueK', 'refract', 'frost', 'light']) if (typeof v[k] === 'number' && isFinite(v[k])) t[k] = v[k];
        t.hue = typeof v.hue === 'string' && /^#[0-9a-f]{6}$/i.test(v.hue) ? v.hue.toLowerCase() : null;
      }
      return t;
    };
    S.cur = merge(rt.bridge.get('tune'));

    // ---- the CSS glass of every Steam window follows at once (the bundler's values are a reload old)
    const cssText = () => {
      const t = S.cur;
      return '@media not (prefers-contrast: more) { html.lgs-on.lgs-on { --lgs-dial: ' + t.dial
        + '; --lgs-tune-hue: ' + (t.hue || 'rgb(0 0 0)') + '; --lgs-tune-hue-k: ' + (t.hue ? t.hueK : 0) + '; } }';
    };
    const applyCss = () => {
      const txt = cssText();
      for (const st of S.styles.values()) { try { if (st.textContent !== txt) st.textContent = txt; } catch (_) { /* window gone */ } }
    };
    S.off.push(rt.windows.track((e) => {
      let st = null;
      try {
        st = e.doc.createElement('style');
        st.setAttribute('data-lgs-tune', '');
        st.textContent = cssText();
        (e.doc.head || e.doc.documentElement).appendChild(st);
      } catch (_) { return null; }
      S.styles.set(e.win, st);
      return () => { S.styles.delete(e.win); try { st.remove(); } catch (_) { /* gone */ } };
    }));
    const changed = () => { applyCss(); S.subs.forEach((f) => { try { f(); } catch (_) { /* unmounted */ } }); };
    // the daemon's value (another panel, `lgs dial`, the first bridge after install)
    S.off.push(rt.bridge.on('tune', (v) => {
      if (Date.now() - S.lastLocal < LOCAL_HOLD_MS) return;
      S.cur = merge(v);
      changed();
    }));

    const daemon = () => {
      const d = rt.bridge.get('daemon');
      const live = !!(d && Date.now() - d.at < (d.ttlMs || 6000) && typeof window.lgsAction === 'function');
      return { live: live && Array.isArray(d.actions) && d.actions.includes('glass.tune'), native: live && d.native === true };
    };
    // ---- the daemon: the latest values at most every SEND_MS (trailing: the last one always goes)
    const flush = () => {
      S.timer = 0;
      const p = S.pending;
      S.pending = null;
      if (!p) return;
      const args = {};
      for (const k of ['dial', 'hueK', 'refract', 'frost', 'light']) if (k in p) args[k] = Math.round(p[k] * 1000) / 1000;
      if ('hue' in p) args.hue = p.hue || '';
      if (p.reset) { for (const k of Object.keys(args)) delete args[k]; args.reset = true; }
      S.sent++;
      rt.action('glass.tune', args, { src: 'barpopup' }).then((r) => { if (r && r.ok === false) S.lastErr = r.error + (r.detail ? ' ' + r.detail : ''); });
      S.timer = rt.setTimeout(flush, SEND_MS);
    };
    const send = (patch) => {
      S.pending = Object.assign(S.pending || {}, patch);
      if (!S.timer) flush();
    };
    const set = (patch) => {
      S.cur = Object.assign({}, S.cur, patch);
      S.lastLocal = Date.now();
      changed();
      send(patch);
    };
    const reset = () => {
      S.cur = Object.assign({}, DEFAULT);
      S.lastLocal = Date.now();
      changed();
      S.pending = null;
      send({ reset: true });
    };

    // ---- the panel (the bar popup's contents)
    const contentsClass = () => { try { const s = rt.sel('%{DashboardBarPopupContents}'); return /^\.[\w-]+$/.test(s) ? s.slice(1) : ''; } catch (_) { return ''; } };
    const pct = (v) => Math.round(v * 100);
    // one row: the name and the value on one line, Steam's bare slider below (its own gamepad and laser
    // handling; no label of its own, so nothing wraps in the 300 pp column)
    function Slider(props) {
      if (!c.SliderField) return null;
      return jsxs('div', { className: 'lgs-tune-row' + (props.disabled ? ' is-disabled' : ''), children: [
        jsx('div', { className: 'lgs-tune-label', children: [props.label, jsx('span', { children: props.value + '%' }, 'v')] }, 'l'),
        jsx(c.SliderField, {
          value: props.value, min: props.min || 0, max: props.max, step: 1, disabled: !!props.disabled,
          bottomSeparator: 'none', resetValue: props.reset, onChange: props.onChange,
        }, 's'),
      ] });
    }
    function TunePanel() {
      const [, bump] = React.useState(0);
      React.useEffect(() => { const f = () => bump((n) => n + 1); S.subs.add(f); return () => S.subs.delete(f); }, []);
      const t = S.cur;
      const d = daemon();
      const cls = contentsClass();
      const hueName = (HUES.find((h) => h[0] === t.hue) || HUES[0])[1];
      return jsxs(Focusable, {
        className: 'lgs-tune-panel' + (cls ? ' ' + cls : ''),
        'flow-children': 'column',
        noFocusRing: true,
        children: [
          jsx('div', { className: 'lgs-tune-title', children: 'Glass' }, 'title'),
          d.live ? null : jsx('div', { className: 'lgs-tune-note', children: 'Glass service not running' }, 'note'),
          d.live && !d.native ? jsx('div', { className: 'lgs-tune-note', children: 'Refraction and Highlights need native glass' }, 'nn') : null,
          jsx('div', { className: 'lgs-tune-label', children: ['Colour', jsx('span', { children: hueName }, 'v')] }, 'cl'),
          jsx(Focusable, {
            className: 'lgs-tune-swatches', 'flow-children': 'row',
            children: HUES.map(([h, name]) => jsx(Focusable, {
              className: 'lgs-tune-swatch' + (t.hue === h ? ' is-on' : '') + (h ? '' : ' is-none'),
              style: h ? { '--lgs-sw': h } : undefined,
              'aria-label': name,
              onActivate: () => set({ hue: h }),
            }, name)),
          }, 'sw'),
          jsx(Slider, { label: 'Tint strength', value: pct(t.hueK), max: 100, reset: 50, disabled: !t.hue,
            onChange: (v) => set({ hueK: v / 100 }) }, 'k'),
          jsx(Slider, { label: 'Glass intensity', value: pct(t.dial), max: 100, reset: 50,
            onChange: (v) => set({ dial: v / 100 }) }, 'dial'),
          jsx(Slider, { label: 'Refraction', value: pct(t.refract), max: 200, reset: 100, disabled: !d.native,
            onChange: (v) => set({ refract: v / 100 }) }, 'ref'),
          jsx(Slider, { label: 'Frost', value: pct(t.frost), max: 200, reset: 100,
            onChange: (v) => set({ frost: v / 100 }) }, 'frost'),
          jsx(Slider, { label: 'Highlights', value: pct(t.light), max: 200, reset: 100, disabled: !d.native,
            onChange: (v) => set({ light: v / 100 }) }, 'light'),
          c.DialogButton ? jsx(c.DialogButton, { className: 'lgs-tune-reset', onClick: reset, children: 'Reset to default' }, 'reset') : null,
        ],
      });
    }

    // ---- the button: Steam's bar popup button, found once in the live tree (Room View, the pill, the avatar)
    const barClasses = () => (R.M && R.M.BarClasses) || {};
    const findBtn = () => {
      if (S.Btn) return S.Btn;
      try {
        const f = R.fiber.findAll((p, fb) => fb.tag === 0 && 'refBarPopupHandle' in p && 'popupContents' in p
          && typeof p.children === 'function', { max: 1 })[0];
        if (f && typeof f.type === 'function') S.Btn = f.type;
      } catch (e) { S.lastErr = 'find: ' + String(e && e.message || e); }
      return S.Btn;
    };
    function TuneButton() {
      const handle = React.useRef(undefined);
      const [open, setOpen] = React.useState(false);
      S.btnHandle = handle;     // status, and the lab's open() / close()
      const Btn = findBtn();
      if (!Btn) return null;
      const bc = barClasses();
      return jsx('div', { className: 'lgs-tune', children: jsx(Btn, {
        refBarPopupHandle: handle,
        popupContents: jsx(TunePanel, {}),
        popupAlignment: 'center',
        tooltip: 'Glass',
        onPopupVisibilityChange: (v) => setOpen(!!v),
        children: (ref, navRef) => jsx(Focusable, {
          ref, navRef,
          className: ['VRDashboardBarSmallButton', bc.Item, bc.Clickable, open && bc.Active, open && 'VRDashboardBarSmallButtonActive', 'lgs-tune-btn']
            .filter(Boolean).join(' '),
          style: { '--bar-item-padding-pct': '0' },
          'aria-label': 'Glass',
          onActivate: () => { const h = handle.current; if (h && typeof h.togglePopup === 'function') h.togglePopup(); },
          children: jsx('div', { className: bc.Highlight || '', children: jsx('div', { className: 'lgs-tune-icon', children: ICON }) }),
        }),
      }) });
    }

    // after the main %{BarSurface} (the apps and system capsules), in the Fragment that holds it and the
    // Bookend (fail closed: unchanged when not found)
    const surfaceCls = () => barClasses().BarSurface || '';
    const isMainSurface = (p) => {
      const sc = surfaceCls();
      return !!sc && p && typeof p.className === 'string' && p.className.split(/\s+/).includes(sc) && !p.className.includes(barClasses().Bookend || '\u0000');
    };
    const insert = (el, add, depth) => {
      if (!el || typeof el !== 'object' || depth > 10) return null;
      if (Array.isArray(el)) {
        let at = el.findIndex((x) => x && typeof x === 'object' && x.props && isMainSurface(x.props));
        // the assPod's music note (34-asspod.js) stays between the capsule and the paintbrush
        if (at >= 0 && el[at + 1] && el[at + 1].key === 'lgs-asspod') at++;
        if (at >= 0) { const n = el.slice(); n.splice(at + 1, 0, add); return n; }
        for (let i = 0; i < el.length; i++) { const n = insert(el[i], add, depth + 1); if (n) { const cpy = el.slice(); cpy[i] = n; return cpy; } }
        return null;
      }
      if (!el.props) return null;
      const ch = el.props.children;
      if (ch == null) return null;
      if (!Array.isArray(ch) && typeof ch === 'object' && ch.props && isMainSurface(ch.props)) {
        return React.cloneElement(el, null, ch, add);
      }
      const n = insert(ch, add, depth + 1);
      return n ? React.cloneElement(el, null, ...(Array.isArray(n) ? n : [n])) : null;
    };

    S.handle = R.patch.byProps('tune.bar', R.patch.targets.dashboardBar, (orig) => function (props, ref) {
      const out = orig.call(this, props, ref);
      if (TUNE !== S) return out;
      try { return insert(out, jsx(TuneButton, {}, 'lgs-tune'), 0) || out; } catch (e) { S.lastErr = String(e && e.message || e); return out; }
    }, { optional: true });
    try { R.patch.rerender(S.handle); } catch (_) { /* shows at the bar's next render */ }

    return {
      status: () => ({ tune: Object.assign({}, S.cur), daemon: daemon(), btn: !!S.Btn, sent: S.sent, lastErr: S.lastErr,
        styles: S.styles.size, patch: S.handle ? { count: S.handle.count, live: S.handle.live } : null,
        shown: (() => { try { return rt.windows.byKind('bar').some((e) => !!e.doc.querySelector('.lgs-tune')); } catch (_) { return null; } })() }),
      set: (patch) => set(patch || {}),
      reset,
      // the popup, for tests (the wearer opens it with the paintbrush)
      open: () => { const h = S.btnHandle && S.btnHandle.current; if (!h) return false; h.openPopup(); return true; },
      close: () => { const h = S.btnHandle && S.btnHandle.current; if (!h) return false; h.closePopup(); return true; },
      isOpen: () => { const h = S.btnHandle && S.btnHandle.current; return !!(h && h.BPopupOpen && h.BPopupOpen()); },
    };
  },
  remove() {
    const S = TUNE;
    TUNE = null;
    if (!S) return;
    try { if (S.timer) clearTimeout(S.timer); } catch (_) { /* scoped timer */ }
    for (const off of S.off) { try { if (typeof off === 'function') off(); else if (off && off.remove) off.remove(); } catch (_) { /* gone */ } }
    for (const st of S.styles.values()) { try { st.remove(); } catch (_) { /* gone */ } }
    S.styles.clear();
    S.subs.clear();
    try { if (S.handle) { S.handle.remove(); try { S.R.patch.rerender(S.handle); } catch (_) { /* */ } } } catch (_) { /* */ }
  },
});
