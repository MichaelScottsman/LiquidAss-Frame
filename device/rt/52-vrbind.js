/* Glass Shell C5b: the Controller Bindings capsule on a VR game's page
   (GP §4.12 step 3, T3; flag vrBindings, off until the user approves
   additions, Q-A).
   - Where: the last child of Steam's %{AppButtons} Focusable row, so Right
     from Steam Input reaches it. Added by a layer on P2's `appButtons`
     patch (rt.react.patch.targets.appButtons). Only for apps with VR
     support (overview.vr_supported / vr_only), and only while the daemon
     is up with a SteamVR session (GP "no daemon session": not rendered).
   - Laser click: opens SteamVR's bindings for this app at once, through
     the daemon relay (device/shell_ext/vrbind.py, action `vrbind`).
   - Gamepad A: Steam's ConfirmModal first (title: SteamVR's "Controller
     Bindings"; body GQ14b, English only; Continue / Cancel), because the
     editor is laser-only and the gamepad way back cannot be proven without
     a wearer. Cancel or B closes it and focus returns to the capsule.
   - Labels: SteamVR's own strings, read once through the daemon
     (`vrbind.strings`); English fallback only for an English UI.
   - The Steam Input page link (GP §4.12 step 2) is not built (AT-T3-ROUTE
     not run); the existing paths stay: Now Playing › VR Controller
     Bindings and SteamVR Settings.
   remove(): our patch layer is removed; nothing else is left. */
let vrbindHandle = null;
let vrbindSubs = null;
__LGS_RT.define({
  name: 'vrbind',
  deps: ['react'],
  flag: 'vrBindings',
  install(rt) {
    const R = rt.react;
    R.ready();
    const { React, jsx } = R;
    const Focusable = (R.c && R.c.Focusable) || R.Focusable;
    if (!Focusable) throw new Error('vrbind: no Focusable');
    const ui = R.ui;
    const english = () => /^en/i.test(String(ui.lang() || ''));
    const cls = (s) => { try { return rt.sel(s).replace(/^\./, '').split('.').join(' '); } catch (e) { return ''; } };
    const rowClass = cls('%{AppButtons}');
    if (!rowClass) throw new Error('vrbind: %{AppButtons} unresolved');

    // SteamVR's labels, once per install
    const strings = { title: null, vr: null, loaded: false };
    const subs = new Set();
    vrbindSubs = subs;
    const loadStrings = async () => {
      const r = await rt.action('vrbind.strings', {}, { src: 'main' });
      if (r && r.ok && r.result) {
        strings.title = r.result['#Controller_Bindings'] || null;
        strings.vr = r.result['#VR_Controller_Bindings'] || null;
      }
      if (!strings.title && english()) strings.title = 'Controller Bindings';
      strings.loaded = true;
      subs.forEach((fn) => { try { fn(); } catch (e) {} });
    };
    loadStrings();
    // the daemon may not have the flag yet at install: one retry for SteamVR's own labels
    rt.setTimeout(() => { if (!strings.vr) loadStrings(); }, 4000);

    const daemonUp = () => {
      const d = rt.bridge && rt.bridge.get ? rt.bridge.get('daemon') : null;
      return !!(d && d.steamvr && Date.now() - d.at < (d.ttlMs || 6000) && typeof window.lgsAction === 'function');
    };

    let busy = false;
    const open = async (how, appid) => {
      if (busy) return;
      busy = true;
      rt.log(how, { appid });
      try {
        const r = await rt.action('vrbind', { app: 'steam.app.' + appid }, { src: 'main' });
        rt.log('vrbind reply', r);
      } finally { busy = false; }
    };
    const confirm = (appid) => {
      const body = english() ? "SteamVR's binding editor is used with the laser pointer. Back in the editor returns you to this page." : undefined;
      ui.confirm({
        title: strings.title || undefined,
        description: body,
        okText: ui.loc('#Button_Continue') || (english() ? 'Continue' : undefined),
        cancelText: ui.loc('#Button_Cancel') || undefined,
        onOK: () => open('confirmed', appid),
        onCancel: () => rt.log('cancelled', { appid }),
      });
    };

    // the capsule: its own component (it may use hooks; the patch wrap may not)
    // Steam's 30 px "private app" indicator sits right after Manage: keep the
    // capsule's hit box clear of that control's 80 px box (G-SIZE P-08)
    let ind = '';
    try { ind = rt.sel('%{PrivateAppActiveIndicator}'); } catch (e) { ind = ''; }
    const CSS = (ind ? `*:has(${ind}) > .lgs-vrbind { margin-left: 56px !important; }` : '') + `
      .lgs-vrbind { position: relative; display: inline-flex; align-items: center; gap: 14px; box-sizing: border-box;
        height: 80px; min-width: 255px; padding: 0 28px 0 20px; margin-left: 16px; border-radius: 40px; flex: none;
        background: radial-gradient(30% 55% at 26% 0, rgb(255 255 255 / .14), rgb(255 255 255 / 0)), var(--lgs-fill-thin, rgb(255 255 255 / .10));
        color: var(--lgs-text-1, #fff); font: 600 24px/1 var(--lgs-font, sans-serif); white-space: nowrap; cursor: pointer;
        transition: background-color var(--lgs-motion-hover-in, 294ms ease), box-shadow var(--lgs-motion-hover-in, 294ms ease); }
      .lgs-vrbind::before { content: ""; flex: none; width: 40px; height: 40px; border-radius: 50%;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23fff' fill-rule='evenodd' d='M7.2 7h9.6a4.6 4.6 0 0 1 4.5 5.6l-.9 4.1a2.3 2.3 0 0 1-4 .9L14.6 16H9.4l-1.8 1.6a2.3 2.3 0 0 1-4-.9l-.9-4.1A4.6 4.6 0 0 1 7.2 7z'/%3E%3C/svg%3E") center / 24px no-repeat, var(--lgs-indigo, rgb(109 124 255)); }
      .lgs-vrbind::after { content: "\\2197"; font-size: 22px; color: var(--lgs-text-2, rgb(255 255 255 / .7)); }
      .lgs-vrbind:hover { background-color: rgb(255 255 255 / .18); }
      .lgs-vrbind.gpfocus { background-color: rgb(255 255 255 / var(--lgs-focus-add, .32)); box-shadow: 0 0 32px rgb(255 255 255 / .30); }
    `;
    function Capsule(props) {
      const [, bump] = React.useState(0);
      React.useEffect(() => { const f = () => bump((n) => n + 1); subs.add(f); return () => subs.delete(f); }, []);
      if (!strings.title) return null;
      return jsx(React.Fragment, { children: [
        jsx(ui.Style, { css: CSS }, 's'),
        jsx(Focusable, {
          className: 'lgs-vrbind',
          focusClassName: 'gpfocus',
          'data-lgs-vrbind': String(props.appid),
          onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); open('direct', props.appid); },
          onOKButton: (e) => { if (e && e.stopPropagation) e.stopPropagation(); confirm(props.appid); },
          onOKActionDescription: strings.title,
          children: strings.title,
        }, 'f'),
      ] });
    }

    // insert into the %{AppButtons} element of the patched output (fail closed: unchanged when not found)
    const hasRow = (p) => typeof (p && p.className) === 'string' && (' ' + p.className + ' ').includes(' ' + rowClass.split(' ')[0] + ' ');
    const insert = (el, add, depth) => {
      if (!el || typeof el !== 'object' || depth > 12) return null;
      if (Array.isArray(el)) {
        for (let i = 0; i < el.length; i++) { const n = insert(el[i], add, depth + 1); if (n) { const c = el.slice(); c[i] = n; return c; } }
        return null;
      }
      if (!el.props) return null;
      if (hasRow(el.props)) {
        const kids = React.Children.toArray(el.props.children);
        return React.cloneElement(el, null, ...kids, add);
      }
      const ch = el.props.children;
      if (ch == null) return null;
      const n = insert(ch, add, depth + 1);
      return n ? React.cloneElement(el, null, ...(Array.isArray(n) ? n : [n])) : null;
    };

    const handle = vrbindHandle = R.patch.byProps('c5b.vrbind', R.patch.targets.appButtons, (orig) => function (props, ref) {
      const out = orig.call(this, props, ref);
      try {
        const ov = props && props.overview;
        if (!ov || !(ov.vr_supported || ov.vr_only) || !daemonUp()) return out;
        const n = insert(out, jsx(Capsule, { appid: ov.appid }, 'lgs-vrbind'), 0);
        return n || out;
      } catch (e) { return out; }
    }, { optional: true });

    return {
      status: () => ({ strings: { ...strings }, daemon: daemonUp(), patch: { count: handle.count, live: handle.live, pending: handle.pending } }),
    };
  },
  remove() {
    const h = vrbindHandle;
    vrbindHandle = null;
    try { if (h) h.remove(); } catch (e) {}
    if (vrbindSubs) vrbindSubs.clear();
    vrbindSubs = null;
  },
});
