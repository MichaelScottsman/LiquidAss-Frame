// Glass Shell phase 2: input-mode prototype (see docs/phase2/capabilities/input-mode.md).
//
// One JS expression. Evaluate it in SharedJSContext or in any gamepadui popup;
// it installs itself once in SharedJSContext (reached via window.opener from a
// popup) and keeps every Steam popup in sync. Memory only, idempotent, and
// fully removable with window.__LGS_INPUT.remove().
//
//   html.lgs-input-laser | html.lgs-input-pad   on every popup's <html>
//   html[data-lgs-vr-mode="laser"|"gamepad"]     SteamVR's own mode (grip toggle)
//   .lgs-dwell + --lgs-dwell:1                    on the laser-hovered card after 80 ms
//
//   window.__LGS_INPUT = { mode, state(), onChange(fn) -> off(), playSound(name),
//                          haptic(kind, elOrWin), armHaptics(bool), dwellSelector,
//                          remove() }
//
// Signals (build 11094443):
//   mode    <- FocusNavController.NavigationSource.Value.eActivationSourceType
//              (1 GAMEPAD, 2 KEYBOARD_SIMULATOR -> pad; 3 MOUSE, 4 TOUCH, 5/6 pads -> laser;
//               0 UNKNOWN -> SteamVR's mode). Steam clears .gpfocus when this becomes MOUSE.
//   vrMode  <- vrGamepadInput.IsInGamepadNav (SteamVR system_panel_interaction_mode,
//              1 LaserMouse / 2 Gamepad), MobX-observable; what Steam keys its own
//              laser-only layout on (Sort/Filter pill, footer "Laser Mouse" legend).
(() => {
  const V = 1;
  const H = window.FocusNavController ? window
    : (window.opener && window.opener.FocusNavController ? window.opener : null);
  if (!H) throw new Error('lgs input_mode: SharedJSContext (FocusNavController) not reachable');
  const prev = H.__LGS_INPUT;
  if (prev && prev.v === V) { try { window.__LGS_INPUT = prev; } catch (_) { /* cross-window */ } return prev.state(); }
  if (prev && typeof prev.remove === 'function') prev.remove();

  const FNC = H.FocusNavController;
  const VRI = H.vrGamepadInput || null;          // only exists in VR
  const PM = H.g_PopupManager;
  const SOURCE = ['unknown', 'gamepad', 'keyboard-sim', 'mouse', 'touch', 'lpad', 'rpad'];  // EInputSourceType
  const DWELL_MS = 80;
  const undo = [];
  const listeners = new Set();
  const now = () => H.performance.now();

  // ------------------------------------------------ webpack (one guarded pass)
  // Ids are only hints; a module is used only if its source passes the test.
  let req = null;
  try { H.webpackChunksteamui.push([[Symbol('lgs-input')], {}, (r) => { req = r; }]); } catch (_) { /* no webpack */ }
  const src = (id) => { try { return Function.prototype.toString.call(req.m[id]); } catch (_) { return ''; } };
  const FIND = {
    mobx: ['89193', (s) => s.includes('[MobX]')],
    sound: ['67758', (s) => s.length < 4000 && s.includes('RegisterCallbackOnPlaySound') && s.includes('"BasicNav"')],
  };
  const found = {};
  if (req) {
    const todo = new Set(Object.keys(FIND));
    for (const k of [...todo]) if (req.m[FIND[k][0]] && FIND[k][1](src(FIND[k][0]))) { found[k] = FIND[k][0]; todo.delete(k); }
    if (todo.size) {
      for (const id of Object.keys(req.m)) {
        if (!todo.size) break;
        const s = src(id);
        for (const k of [...todo]) if (FIND[k][1](s)) { found[k] = id; todo.delete(k); }
      }
    }
  }
  let reaction = null, PN = null, bus = null;
  try {
    if (found.mobx) {
      reaction = Object.values(req(found.mobx)).find((f) => typeof f === 'function'
        && String(f).includes('"Reaction"') && String(f).includes('compareStructural')) || null;
    }
  } catch (_) { reaction = null; }
  try {
    if (found.sound) {
      for (const v of Object.values(req(found.sound))) {
        if (v && typeof v.PlayNavSound === 'function') bus = v;
        else if (v && typeof v.BasicNav === 'number') PN = v;
      }
    }
  } catch (_) { /* fallbacks below */ }

  // ------------------------------------------------ mode
  function compute() {
    let s = 0;
    try { s = FNC.NavigationSource.Value.eActivationSourceType | 0; } catch (_) { /* keep 0 */ }
    let vrPad = null;
    try { vrPad = VRI ? !!VRI.IsInGamepadNav : null; } catch (_) { vrPad = null; }
    const mode = (s === 1 || s === 2) ? 'pad' : (s === 0 ? (vrPad === false ? 'laser' : 'pad') : 'laser');
    return { mode, source: SOURCE[s] || String(s), vrMode: vrPad === null ? 'none' : (vrPad ? 'gamepad' : 'laser') };
  }
  let cur = compute();

  function windows() {
    const out = [];
    try { for (const p of PM.GetPopups()) { try { if (p.window && p.window.document) out.push(p.window); } catch (_) { /* closing */ } } } catch (_) { /* none */ }
    return out;
  }
  function paint(w) {
    try {
      const de = w.document.documentElement;
      de.classList.toggle('lgs-input-laser', cur.mode === 'laser');
      de.classList.toggle('lgs-input-pad', cur.mode === 'pad');
      de.setAttribute('data-lgs-vr-mode', cur.vrMode);
    } catch (_) { /* not ready */ }
  }
  function unpaint(w) {
    try {
      const de = w.document.documentElement;
      de.classList.remove('lgs-input-laser', 'lgs-input-pad');
      de.removeAttribute('data-lgs-vr-mode');
    } catch (_) { /* gone */ }
  }

  // ------------------------------------------------ laser dwell (D-7)
  const dwell = new Map();   // document -> { el, timer, t0, on }
  function cardFor(t, w) {
    for (let n = t; n && n.nodeType === 1; n = n.parentElement) {
      if (n.matches(api.dwellSelector)) {
        const r = n.getBoundingClientRect();
        // A page or list container, not a card: skip the dwell.
        return (r.width * r.height > 0.5 * w.innerWidth * w.innerHeight) ? null : n;
      }
    }
    return null;
  }
  function clearDwell(d) {
    const st = dwell.get(d);
    if (!st) return;
    H.clearTimeout(st.timer);
    try { st.el.classList.remove('lgs-dwell'); st.el.style.removeProperty('--lgs-dwell'); } catch (_) { /* gone */ }
    dwell.delete(d);
  }
  function clearAllDwell() { for (const d of [...dwell.keys()]) clearDwell(d); }
  function onOver(e) {
    const d = e.currentTarget;
    const w = d.defaultView;
    if (!w) return;
    const card = cardFor(e.target, w);
    const st = dwell.get(d);
    if (st && st.el === card) return;
    clearDwell(d);
    if (!card || cur.mode !== 'laser') return;
    const rec = { el: card, t0: now(), on: false, timer: 0 };
    rec.timer = H.setTimeout(() => {
      if (dwell.get(d) !== rec || cur.mode !== 'laser' || !card.isConnected || !card.matches(':hover')) return;
      card.classList.add('lgs-dwell');
      card.style.setProperty('--lgs-dwell', '1');
      rec.on = true;
      rec.tOn = now();
    }, DWELL_MS);
    dwell.set(d, rec);
  }
  function onOut(e) {
    const d = e.currentTarget;
    const st = dwell.get(d);
    if (!st) return;
    if (e.relatedTarget && st.el.contains(e.relatedTarget)) return;   // still inside the card
    clearDwell(d);
  }

  // ------------------------------------------------ popups
  const hooked = new Map();  // window -> { doc, off }
  function ensureHooked(w) {
    let d;
    try { d = w.document; } catch (_) { return; }
    if (!d || !d.documentElement) return;
    const h = hooked.get(w);
    if (h && h.doc === d) { paint(w); return; }
    if (h) { try { h.off(); } catch (_) { /* gone */ } }
    d.addEventListener('mouseover', onOver, true);
    d.addEventListener('mouseout', onOut, true);
    try { w.__LGS_INPUT = api; } catch (_) { /* cross-window */ }
    paint(w);
    hooked.set(w, {
      doc: d,
      off: () => {
        d.removeEventListener('mouseover', onOver, true);
        d.removeEventListener('mouseout', onOut, true);
        clearDwell(d);
        unpaint(w);
        try { if (w.__LGS_INPUT === api) delete w.__LGS_INPUT; } catch (_) { /* gone */ }
      },
    });
  }

  function update(reason) {
    const before = cur;
    cur = compute();
    for (const w of windows()) ensureHooked(w);
    if (cur.mode !== 'laser') clearAllDwell();
    if (cur.mode !== before.mode || cur.vrMode !== before.vrMode) {
      const s = state();
      for (const fn of [...listeners]) { try { fn(s, before, reason); } catch (err) { H.console.error('lgs input onChange', err); } }
    }
  }

  // ------------------------------------------------ sounds (Steam's own bus)
  // Steam's GamepadUIAudioStore.PlayNavSound honours Settings > Audio > UI sounds
  // (settingsStore.clientSettings.enable_ui_sounds), drops a sound within 50 ms of
  // the last one, and lets a lower enum value pre-empt a pending one.
  const PN_FALLBACK = ['LaunchGame', 'FriendMessage', 'ChatMention', 'ChatMessage', 'ToastMessage', 'ToastAchievement',
    'ToastMisc', 'ToastMiscShort', 'FriendOnline', 'FriendInGame', 'VolSound', 'ShowModal', 'HideModal', 'IntoGameDetail',
    'OutOfGameDetail', 'PagedNavigation', 'ToggleOn', 'ToggleOff', 'SliderUp', 'SliderDown', 'ChangeTabs', 'DefaultOk',
    'OpenSideMenu', 'CloseSideMenu', 'BasicNav', 'FailedNav', 'Typing', 'TimerExpired', 'Screenshot'];
  const SOUND_ALIAS = {
    deck_ui_misc_10: 'BasicNav', deck_ui_navigation: 'PagedNavigation', deck_ui_default_activation: 'DefaultOk',
    deck_ui_bumper_end_02: 'FailedNav', deck_ui_show_modal: 'ShowModal', deck_ui_hide_modal: 'HideModal',
    deck_ui_side_menu_fly_in: 'OpenSideMenu', deck_ui_side_menu_fly_out: 'CloseSideMenu',
    deck_ui_tab_transition_01: 'ChangeTabs', deck_ui_switch_toggle_on: 'ToggleOn', deck_ui_switch_toggle_off: 'ToggleOff',
    deck_ui_slider_up: 'SliderUp', deck_ui_slider_down: 'SliderDown', deck_ui_into_game_detail: 'IntoGameDetail',
    deck_ui_out_of_game_detail: 'OutOfGameDetail', deck_ui_launch_game: 'LaunchGame', deck_ui_toast: 'ToastMisc',
    deck_ui_achievement_toast: 'ToastAchievement', deck_ui_message_toast: 'ToastMessage', deck_ui_typing: 'Typing',
    deck_ui_volume: 'VolSound',
  };
  function soundId(name) {
    if (typeof name === 'number') return name;
    const n = SOUND_ALIAS[name] || name;
    if (PN && typeof PN[n] === 'number') return PN[n];
    const i = PN_FALLBACK.indexOf(n);
    return i >= 0 ? i : undefined;
  }
  function playSound(name, immediate) {
    const e = soundId(name);
    if (e === undefined) throw new Error('lgs input_mode: unknown sound ' + name);
    if (bus) bus.PlayNavSound(e, !!immediate);
    else H.SteamUIStore.m_GamepadUIAudioStore.PlayNavSound(e, !!immediate);
    return e;
  }

  // ------------------------------------------------ haptics (SteamVR overlay effects)
  // <popup window>.SteamClient.OpenVR.TriggerOverlayHapticEffect(eEffect, 0) pulses the
  // controller whose laser points at that popup's overlay. EVROverlayHapticEffect:
  // 1 ButtonEnter, 2 ButtonLeave, 3 Snap, 4 Sliding, 5 SlidingEdge. Steam already fires
  // 1/2 on every focusable Panel's mouseenter/mouseleave, so use this only for our own
  // non-Panel elements. Disarmed by default: nothing fires until armHaptics(true).
  const HAPTIC = { enter: 1, hover: 1, tick: 1, leave: 2, snap: 3, detent: 3, slide: 4, sliding: 4, edge: 5, thud: 5 };
  let armed = false, lastPulse = -1e9;
  function haptic(kind, target) {
    const e = typeof kind === 'number' ? kind : HAPTIC[kind];
    let w = target && target.ownerDocument ? target.ownerDocument.defaultView : target;
    if (!w) { try { w = H.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.BrowserWindow; } catch (_) { w = null; } }
    let fn = null;
    try { fn = w.SteamClient.OpenVR.TriggerOverlayHapticEffect; } catch (_) { fn = null; }
    const plan = { api: 'SteamClient.OpenVR.TriggerOverlayHapticEffect', effect: e, available: typeof fn === 'function', armed, mode: cur.mode, fired: false };
    if (!e || !plan.available || !armed || cur.mode !== 'laser' || now() - lastPulse < 80) return plan;
    lastPulse = now();
    fn.call(w.SteamClient.OpenVR, e, 0);
    plan.fired = true;
    return plan;
  }

  // ------------------------------------------------ api
  function state() {
    let sounds = true;
    try { sounds = H.settingsStore.clientSettings.enable_ui_sounds !== false; } catch (_) { /* default on */ }
    return {
      v: V, mode: cur.mode, source: cur.source, vrMode: cur.vrMode,
      subscriptions: { navigationSource: true, vrOverlayFocus: !!(VRI && VRI.RegisterForNavigationTypeChange), mobxReaction: !!(VRI && reaction) },
      sound: { bus: !!bus, enum: !!PN, uiSoundsEnabled: sounds },
      haptics: { available: true, armed },
      popups: hooked.size,
      dwell: [...dwell.values()].map((r) => ({ on: r.on, ms: r.on ? Math.round(r.tOn - r.t0) : null })),
    };
  }
  function remove() {
    for (const u of undo.splice(0).reverse()) { try { u(); } catch (_) { /* already gone */ } }
    clearAllDwell();
    for (const h of hooked.values()) { try { h.off(); } catch (_) { /* gone */ } }
    hooked.clear();
    listeners.clear();
    for (const w of windows()) unpaint(w);
    if (H.__LGS_INPUT === api) delete H.__LGS_INPUT;
    try { if (window.__LGS_INPUT === api) delete window.__LGS_INPUT; } catch (_) { /* cross-window */ }
    return true;
  }
  const api = {
    v: V,
    get mode() { return cur.mode; },
    state,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    playSound,
    soundId,
    haptic,
    armHaptics(on) { armed = !!on; return armed; },
    // Innermost match under the pointer wins. Not '.Focusable': Steam drops that class
    // from every Panel while the nav source is the mouse (laser), so it never matches
    // under the laser. '.Panel' stays in both modes.
    dwellSelector: '.Panel, button, [role="button"], [role="tab"], a[href]',
    dwellMs: DWELL_MS,
    remove,
  };

  // ------------------------------------------------ subscriptions
  const s1 = FNC.NavigationSource.Subscribe(() => update('source'));
  undo.push(() => s1.Unsubscribe());
  if (VRI && typeof VRI.RegisterForNavigationTypeChange === 'function') {
    const s2 = VRI.RegisterForNavigationTypeChange(() => update('vr-overlay-focus'));
    undo.push(() => s2.Unregister());
  }
  if (VRI && reaction) {
    const dispose = reaction(() => { try { return VRI.IsInGamepadNav; } catch (_) { return null; } }, () => update('vr-mode'));
    undo.push(dispose);
  } else if (VRI) {
    const t = H.setInterval(() => update('poll'), 2000);   // last resort when MobX is not found
    undo.push(() => H.clearInterval(t));
  }
  const pc = PM.AddPopupCreatedCallback((p) => {
    for (const ms of [0, 250, 1000]) H.setTimeout(() => { try { if (p.window && H.__LGS_INPUT === api) ensureHooked(p.window); } catch (_) { /* closed */ } }, ms);
  });
  undo.push(() => pc.Unregister());
  const pd = PM.AddPopupDestroyedCallback((p) => {
    let w = null;
    try { w = p.window; } catch (_) { /* gone */ }
    const h = w && hooked.get(w);
    if (h) { try { h.off(); } catch (_) { /* gone */ } hooked.delete(w); }
  });
  undo.push(() => pd.Unregister());

  H.__LGS_INPUT = api;
  try { window.__LGS_INPUT = api; } catch (_) { /* cross-window */ }
  update('install');
  return state();
})()
