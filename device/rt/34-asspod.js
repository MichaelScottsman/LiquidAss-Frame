/* Glass Shell: the music note on the bar, which takes out the assPod (flag assPod).
   - Where: a glass circle of its own between the system capsule and the paintbrush (33-tune.js puts
     itself after this one). Added by a layer on P2's `dashboardBar` patch; its glass is
     theme/34-asspod.css, its native cover theme/layers/30-bar.json (.lgs-asspod).
   - Pressing it calls the daemon's asspod.open (device/shell_ext/asspod.py): VLC starts, the library
     loads and the assPod appears in the hand whose laser pressed it (SteamVR's systemui page,
     device/vr/systemui.asspod.js), with the menu dimmed behind it.
   - While it is out (the daemon's bridge value 'asspod' {open, at, ttlMs}, renewed while it stays
     out): every gamepad input Steam gets is swallowed (FocusNavController's catch-all), so the
     sticks and buttons drive only the assPod. A (OK, or the left controller's button in that place,
     DIR_DOWN), B (CANCEL, or DIR_LEFT) and the hamburger (START) go to the daemon as asspod.btn: A is
     the centre button, B the wheel's Menu, the hamburger puts the assPod away. The Steam /
     quick-access buttons pass. Steam's windows also take no laser clicks meanwhile
     (html.lgs-asspod-out, theme/34-asspod.css). A bridge value older
     than its ttl ends all of this on its own, so a dead daemon never leaves Steam's input taken.
   remove(): the patch layer, the catch-all and the class go. */
let ASSPOD = null;
__LGS_RT.define({
  name: 'asspod',
  deps: ['react'],
  flag: 'assPod',
  install(rt) {
    const R = rt.react;
    R.ready();
    const { React, jsx } = R;
    const c = R.c || {};
    const Focusable = c.Focusable || R.Focusable;
    if (!Focusable) throw new Error('asspod: no Focusable');
    if (!R.patch.targets.dashboardBar) throw new Error('asspod: no dashboardBar target');

    // Steam's gamepad buttons (EGamepadButton)
    const BTN = { OK: 1, CANCEL: 2, DIR_DOWN: 10, DIR_LEFT: 11, START: 14, STEAM_GUIDE: 27, STEAM_QUICK_MENU: 28 };
    // button -> [what it does, which controller]
    const MAP = { [BTN.OK]: ['ok', 'right'], [BTN.CANCEL]: ['menu', 'right'], [BTN.DIR_DOWN]: ['ok', 'left'],
      [BTN.DIR_LEFT]: ['menu', 'left'], [BTN.START]: ['close', 'right'] };
    const OUT_CLASS = 'lgs-asspod-out';
    const ICON = jsx('svg', { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true', children: [
      jsx('path', { d: 'M9 3.6 20 1.4v14.1a3.4 3.4 0 1 1-2-3.1V6.3L11 7.7v10.1A3.4 3.4 0 1 1 9 14.7z' }, 'n'),
    ] });

    const S = ASSPOD = {
      rt, R, handle: null, lastErr: null, opening: false, out: false, catchOff: null, timer: 0, off: [],
      sent: 0, swallowed: 0, subs: new Set(),
    };
    const changed = () => S.subs.forEach((f) => { try { f(); } catch (_) { /* unmounted */ } });

    // ---- out or not: the daemon's bridge value, fresh
    const fresh = (v) => !!(v && v.open && typeof v.at === 'number' && Date.now() - v.at <= (v.ttlMs || 5000));
    const setClass = (on) => {
      for (const e of rt.windows.list()) {
        try { e.doc.documentElement.classList.toggle(OUT_CLASS, on); } catch (_) { /* window gone */ }
      }
    };
    const onPad = (button, down, repeat) => {
      if (!S.out) return false;
      if (button === BTN.STEAM_GUIDE || button === BTN.STEAM_QUICK_MENU) return false;
      S.swallowed++;
      if (repeat) return true;
      const m = MAP[button];
      if (m) {
        S.sent++;
        rt.action('asspod.btn', { b: m[0], side: m[1], down: !!down }, { src: 'main', timeoutMs: 4000 })
          .then((r) => { if (r && r.ok === false) S.lastErr = r.error + (r.detail ? ' ' + r.detail : ''); });
      }
      return true;
    };
    function setOut(on) {
      if (on === S.out) return;
      S.out = on;
      if (on && !S.catchOff) {
        try { S.catchOff = W.FocusNavController.SetCatchAllGamepadInput(onPad).Unregister; } catch (e) { S.lastErr = 'catch: ' + String(e && e.message || e); }
      } else if (!on && S.catchOff) {
        try { S.catchOff(); } catch (_) { /* gone */ }
        S.catchOff = null;
      }
      setClass(on);
      changed();
    }
    const W = rt.W;
    const check = () => {
      S.timer = 0;
      const v = rt.bridge.get('asspod');
      setOut(fresh(v));
      if (S.out) S.timer = rt.setTimeout(check, 500);
    };
    S.off.push(rt.bridge.on('asspod', () => { if (S.timer) { S.timer(); S.timer = 0; } check(); }));
    S.off.push(rt.windows.track((e) => {
      try { e.doc.documentElement.classList.toggle(OUT_CLASS, S.out); } catch (_) { /* window gone */ }
      return () => { try { e.doc.documentElement.classList.remove(OUT_CLASS); } catch (_) { /* gone */ } };
    }));

    const daemon = () => {
      const d = rt.bridge.get('daemon');
      const live = !!(d && Date.now() - d.at < (d.ttlMs || 6000) && typeof window.lgsAction === 'function');
      return live && Array.isArray(d.actions) && d.actions.includes('asspod.open');
    };
    const open = () => {
      if (S.opening) return;
      if (!daemon()) { S.lastErr = 'no daemon'; return; }
      S.opening = true;
      changed();
      rt.action('asspod.open', {}, { src: 'bar', timeoutMs: 45000 }).then((r) => {
        S.opening = false;
        if (r && r.ok === false) S.lastErr = r.error + (r.detail ? ' ' + r.detail : '');
        changed();
      });
    };

    // ---- the button: Steam's small bar disc in a glass circle of its own
    const barClasses = () => (R.M && R.M.BarClasses) || {};
    function AssPodButton() {
      const [, bump] = React.useState(0);
      React.useEffect(() => { const f = () => bump((n) => n + 1); S.subs.add(f); return () => S.subs.delete(f); }, []);
      const bc = barClasses();
      const on = S.out || S.opening;
      return jsx('div', { className: 'lgs-asspod', children: jsx(Focusable, {
        className: ['VRDashboardBarSmallButton', bc.Item, bc.Clickable, on && bc.Active, on && 'VRDashboardBarSmallButtonActive', 'lgs-asspod-btn']
          .filter(Boolean).join(' '),
        style: { '--bar-item-padding-pct': '0' },
        'aria-label': 'assPod',
        onActivate: open,
        children: jsx('div', { className: bc.Highlight || '', children: jsx('div', { className: 'lgs-asspod-icon', children: ICON }) }),
      }) });
    }

    // right after the main %{BarSurface} (the apps and system capsules), so it sits left of the
    // paintbrush whichever patch layer runs first (fail closed: unchanged when not found)
    const surfaceCls = () => barClasses().BarSurface || '';
    const isMainSurface = (p) => {
      const sc = surfaceCls();
      return !!sc && p && typeof p.className === 'string' && p.className.split(/\s+/).includes(sc) && !p.className.includes(barClasses().Bookend || '\u0000');
    };
    const insert = (el, add, depth) => {
      if (!el || typeof el !== 'object' || depth > 10) return null;
      if (Array.isArray(el)) {
        const at = el.findIndex((x) => x && typeof x === 'object' && x.props && isMainSurface(x.props));
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

    S.handle = R.patch.byProps('asspod.bar', R.patch.targets.dashboardBar, (orig) => function (props, ref) {
      const out = orig.call(this, props, ref);
      if (ASSPOD !== S) return out;
      try { return insert(out, jsx(AssPodButton, {}, 'lgs-asspod'), 0) || out; } catch (e) { S.lastErr = String(e && e.message || e); return out; }
    }, { optional: true });
    try { R.patch.rerender(S.handle); } catch (_) { /* shows at the bar's next render */ }
    check();

    return {
      status: () => ({ out: S.out, opening: S.opening, daemon: daemon(), sent: S.sent, swallowed: S.swallowed, lastErr: S.lastErr,
        bridge: rt.bridge.get('asspod') || null, patch: S.handle ? { count: S.handle.count, live: S.handle.live } : null,
        shown: (() => { try { return rt.windows.byKind('bar').some((e) => !!e.doc.querySelector('.lgs-asspod')); } catch (_) { return null; } })() }),
      open,
    };
  },
  remove() {
    const S = ASSPOD;
    ASSPOD = null;
    if (!S) return;
    try { if (S.timer) S.timer(); } catch (_) { /* scoped timer */ }
    if (S.catchOff) { try { S.catchOff(); } catch (_) { /* gone */ } S.catchOff = null; }
    for (const off of S.off) { try { if (typeof off === 'function') off(); else if (off && off.remove) off.remove(); } catch (_) { /* gone */ } }
    S.subs.clear();
    try { if (S.handle) { S.handle.remove(); try { S.R.patch.rerender(S.handle); } catch (_) { /* */ } } } catch (_) { /* */ }
  },
});
