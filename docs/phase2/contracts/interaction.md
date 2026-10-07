# Contract: interaction runtime (P3)

Owner: **P3**. Files: `device/rt/04-input.js`, `05-attention.js`, `06-states.js`, `07-tooltip.js` (and the retired prototype `device/proto/input_mode.js`). Sources: PLAN §1.4, §1.13, §2.3 P3; IM (`capabilities/input-mode.md`); CTL §4, §11; VP P-01 to P-12; D2 §10.

**Status:** see the "Status" section of `docs/phase2/wp/P3.md`. Interfaces below are stable from M1; behaviour lands at M3. Anything marked *(M3)* is a stub that does nothing until then.

Everything runs in **SharedJSContext** (P1's bundle). Nothing is persisted. Every class, attribute, listener, node and wrapper listed here is removed by `remove()` (G-REMOVE, RT-4).

---

## 0. Loading and flags

| Module (`define` name) | File | deps | flag |
|---|---|---|---|
| `input` | `04-input.js` | — | `wp.p3` |
| `attention` | `05-attention.js` | `input` | `wp.p3` |
| `states` | `06-states.js` | `input` | `wp.p3` |
| `tooltip` | `07-tooltip.js` | `input`, `attention` | `wp.p3` |

- Each file calls `__LGS_RT.define({name, deps, flag, install(rt), remove()})` (P1, `contracts/runtime.md`). If `__LGS_RT` is absent (runtime not loaded) the file does nothing.
- **`wp.p3`** gates the whole package. Off: none of the APIs below exist on `rt`, and no class is set anywhere. Tests turn it on with `--flags wp.p3` (P10). Recommended default once P3 reaches M3: **on** (V1 decides in `defaults.json`).
- **`haptics`** (S17, default off). `rt.haptic()` is a dry run unless this flag is exactly `true`. No test turns it on.
- **Consumers** either list `'input'` / `'attention'` / … in their own `deps` (P1 then skips them while P3 is off), or feature-test: `if (rt.input) …`. Never call Steam's getters for the input mode yourself (PLAN §1.4: one accessor).

---

## 1. Input mode: `rt.input` (module `input`)

### 1.1 DOM signals (every Steam popup window, including popups created later)

| Signal | Values | Source | Use it for |
|---|---|---|---|
| `html.lgs-input-pad` / `html.lgs-input-laser` | exactly one of the two | `FocusNavController.NavigationSource` (1 GAMEPAD, 2 KEYBOARD_SIMULATOR → pad; 3 MOUSE, 4 TOUCH, 5/6 pads → laser; 0 UNKNOWN → SteamVR's mode) | Every state look: hover, focus, press, light spot |
| `html[data-lgs-vr-mode]` | `"gamepad"` / `"laser"`; absent when SteamVR's mode is unknown | `vrGamepadInput.IsInGamepadNav` | Steam's mode-dependent nodes (the laser-only Sort/Filter pill), glyph badges (gamepad only, VP P-26) |

- All popups share one mode (it is a SharedJSContext singleton, IM §2.4). A new popup is painted at creation and again at +250 ms and +1 s.
- Painting is synchronous inside Steam's change notification, so the class flips in the same task as Steam's own `.gpfocus` removal.

**CSS rules for every area (P4 and contexts):**

```css
/* laser: looks key on :hover only (VP P-01, P-02); never on .gpfocus, .gpfocuswithin or .Focusable alone */
html.lgs-input-laser X:hover            { /* hover look, instant */ }
html.lgs-input-laser X.lgs-dwell:hover  { /* lift, scale, depth: only after 80 ms of dwell (VP P-06) */ }
/* gamepad */
html.lgs-input-pad X.gpfocus            { /* focus look */ }
/* runtime off (P3 flag off or loader failed): neither class is present. Fallbacks that keep T1 working: */
html:not(.lgs-input-laser) X.gpfocus    { /* focus look */ }
html:not(.lgs-input-pad) X:hover        { /* hover look */ }
```

### 1.2 API

| Member | Returns / does |
|---|---|
| `rt.input.mode` | `'pad'` or `'laser'` (the stubbed value while a stub is active) |
| `rt.input.vrMode` | `'gamepad'`, `'laser'` or `'none'` |
| `rt.input.source` | `'gamepad'`, `'keyboard-sim'`, `'mouse'`, `'touch'`, `'lpad'`, `'rpad'` or `'unknown'` |
| `rt.input.state()` | `{mode, vrMode, source, stub: null \| {mode, vrMode, until}, live: {mode, vrMode, source}, windows, sound: {bus, uiSoundsEnabled}, haptics: {armed, available}}` |
| `rt.input.onChange(fn)` | Returns `off()`. `fn(state, previous, reason)` runs when `mode` or `vrMode` changes. `reason`: `'source'`, `'vr-mode'`, `'vr-overlay-focus'`, `'poll'`, `'stub'`. Exceptions in `fn` are logged and swallowed |
| `rt.input.stub(mode, {vrMode, ttlMs} = {})` | **Test hook.** Forces `mode` (`'pad'` / `'laser'`) and optionally `vrMode` in **our** classes, attribute and `rt.input` values only. Steam's getters, `NavigationSource` and `vrGamepadInput` are never touched (HA AT-14d, WN AT-24, IN-2). Fires `onChange` with reason `'stub'`. Expires after `ttlMs` (default 120 000). Returns `restore()`. `rt.input.stub(null)` clears it. P1's `rt.test` input-mode stub and P10's `--mode laser\|pad` call this |
| `rt.input.windows()` | The live Steam popup windows P3 has hooked (array of `Window`) |
| `rt.sound(event, {immediate} = {})` | Plays a Steam UI sound through Steam's own bus (§5). Also `rt.input.sound` |
| `rt.haptic(kind, elOrWindow)` | Dry-run haptic plan (§6). Also `rt.input.haptic` |

---

## 2. Attention: `rt.attend`, `rt.attention` (module `attention`)

Hover never moves Steam's focus [PROVEN, IM D-7], so every delayed reveal (Home card ramp and name plates, tooltips, the More circle, the frozen target) is fed by this one state machine:

- **gamepad mode:** `vgp_onfocus` / `vgp_onblur` on the element (capture listeners on each popup document), or a T3 component's `onGamepadFocus` / `onGamepadBlur` through `rt.attention.feed`;
- **laser mode:** `mouseover` / `mouseout` (trusted CDP or real laser events) plus dwell; a dwell timer fires only if the element still matches `:hover`.

### 2.1 Global laser dwell (no registration needed)

- `.lgs-dwell` is set on the **innermost** element under the laser that matches `rt.attention.dwellSelector`, after **80 ms** of continuous hover, in laser mode only.
- Default `dwellSelector`: `.Panel, button, [role="button"], [role="tab"], a[href], [data-lgs-dwell]`. Not `.Focusable` (Steam removes it under the laser). Elements larger than half the window (page containers) are skipped.
- Cleared at once when the pointer leaves the element, when the mode becomes pad, and on removal. A sweep faster than one target per 80 ms sets none (IN-3).
- One element per window at a time. P6's reporter keys laser lifts on `.lgs-dwell:hover`.

### 2.2 `rt.attend(target, opts)` → handle

`target` is an `Element`, a selector string (`%{Token}` allowed, resolved through Steam's class index) or a predicate `fn(el) → bool`. A selector matches the event target or its closest ancestor; registrations are delegated, so virtualized rows that recycle need no re-registration.

| Option | Default | Meaning |
|---|---|---|
| `dwellMs` | `80` | Continuous attention before `dwell` fires |
| `steps` | `[]` | Further thresholds in ms (e.g. `[400, 800]` for Home's name plate and card). Each fires `step` and sets a class |
| `padImmediate` | `false` | Gamepad focus fires `dwell` and every step at once (for GP's `data-lgs-tip-pad="now"` style reveals) |
| `leaveMs` | `0` | Grace before `leave`. Attention returning to the same element within it cancels the leave and keeps the timers (Home's 0.3 s hysteresis) |
| `surfaces` | all | Restrict to popup kinds, e.g. `['main']` (names as `rt.windows` reports them; `main` always works) |
| `classes` | `true` | Set the classes below on the attended element |
| `onEnter(el, ev)`, `onDwell(el, ev)`, `onStep(el, ms, ev)`, `onLeave(el, ev)` | — | Callbacks. `ev = {source: 'laser' \| 'pad' \| 'feed', t, win}`. Exceptions are logged and swallowed |

**Classes** (only with `classes: true`): `lgs-attend` from enter to leave; `lgs-attend-<ms>` from each threshold (`dwellMs` and every step) to leave, e.g. `lgs-attend-800`.

**Order guarantee:** `enter` → `dwell` → `step`… → `leave`, at most one `leave` per `enter`. A mode switch ends every active attention of the old input with `leave` (no grace).

**Handle:** `{off(), active() → [{el, since, source, reached: [ms…]}]}`. `off()` fires no `leave` and removes its classes.

### 2.3 Other members

| Member | Does |
|---|---|
| `rt.attention.current(win = main)` | `{el, source, since}` of what the user attends in that window right now: the `.gpfocus` element in pad mode, the dwelled element in laser mode; `null` if nothing. For the More circle and the frozen target (C1a) |
| `rt.attention.feed(el, 'enter' \| 'leave', source = 'feed')` | Drive registrations from a T3 component's `onGamepadFocus` / `onGamepadBlur` (HA AT-8(d)). Registrations whose target matches `el` behave as if attention arrived or left |
| `rt.attention.dwellSelector` | Read/write string (§2.1) |
| `rt.attention.dwellMs` | `80` (read-only) |

---

## 3. States: `rt.states` (module `states`)

All listeners are passive, capture phase, on each popup document. P3 **never** calls `preventDefault`, `stopPropagation` or re-dispatches a Steam event.

| Output | Rule |
|---|---|
| **Light spot** `--hx`, `--hy` | Laser mode only. On `pointermove`, at most one write per animation frame, as percentages of the element's box (`"37.5%"`), inline on the **innermost** element matching `rt.states.spotSelector` under the pointer (default: the dwell selector plus `[data-lgs-spot]`). Removed when the pointer leaves that element, when the mode becomes pad (VP P-09), and on removal. Zero writes while the pointer is still (IN-5). CSS: `radial-gradient(circle at var(--hx, 50%) var(--hy, 30%), …)`, drawn under the label (VP P-10) |
| **`lgs-pressed`** | Gamepad A only: on `vgp_onbuttondown` with `detail.button === 1` (not repeats) on the focused element, set on `e.target.closest(rt.states.pressSelector)` or the target itself. Removed synchronously on the matching `vgp_onbuttonup` (button 1), or after **400 ms** as a safety net. Other buttons are ignored (IN-4). The laser press uses CSS `:active` |
| **`lgs-focus-in`** | On every gamepad focus change (`vgp_onfocus` in pad mode), set on the newly focused element and on that window's `%{FocusRing}` node(s), in the same task as Steam's `.gpfocus` change; restarted if already present; removed 400 ms later. CSS keys the entry keyframe (P5 `lgs-focus-in`, `.6 → 1` on `hover-in`) either on `.gpfocus` itself or on `.lgs-focus-in`; the ring needs the class because it moves without a class change |
| **`lgs-ring-check`** | On the window's `%{FocusRing}` node(s) while gamepad focus is on a `.DialogCheckbox` (CTL §4.5); removed at the next focus change |
| **`lgs-focus-disabled`** | On the gamepad-focused element while it is disabled (`.Disabled`, `[disabled]`, `[aria-disabled="true"]`, or gamepaddialog's `Disabled` class); removed when focus leaves it (CTL C-D15). Rows can use `:has(.lgs-focus-disabled)` |

| Member | Does |
|---|---|
| `rt.states.spotSelector`, `rt.states.pressSelector` | Read/write selector strings |
| `rt.states.stats()` | `{spotWrites, pressed, focusIn}` counters, for IN-4/IN-5 |

---

## 4. Tooltips: `rt.tooltip` (module `tooltip`)

### 4.1 In-window tooltips (new, T2)

- **Owners:** any element in a Steam window with a `data-lgs-tip` attribute (`""`, `"below"`, `"above"`), plus anything registered with `rt.tooltip.register`. Areas set the attribute from their own T2 code (C1a Back circle, GP action cluster with `"above"`, …).
- **Text:** `data-lgs-tip-text`, else `aria-label`, else `title`. One line, ≤ 32 characters is the owner's job. Controls with visible text get no tooltip (VP P-12); `register(…, {force: true})` overrides the check for text that our CSS hides (E-BACK).
- **Timing (PLAN §1.13):** in after **0.8 s** of attention (laser hover or gamepad focus), out **0.2 s** after leave or blur, in both modes. `data-lgs-tip-pad="now"` shows at once under gamepad focus. Materialize 250 ms, dematerialize 350 ms; Reduce Motion: 150 ms fade.
- **Node:** one `div.lgs-tip` per window document (`role="tooltip"`, `aria-hidden="true"`, `pointer-events: none`, `position: fixed`, `z-index: 7100`), label in `.lgs-tip-label`. Placement 12 px below the owner (above with `"above"`, or when the owner's bottom is below y 600), clamped 24 px inside the window. State: `data-state="in" | "out"`, `data-placement="below" | "above"`.
- **Look:** a thick-glass capsule 48 px tall, 20 px Semibold, from P4 tokens, in a per-window `<style id="lgs-tip-style">` of low specificity (`:where()`), so theme CSS can override it. No border, no outline.

| Member | Does |
|---|---|
| `rt.tooltip.register(target, {text, placement, padNow, force, surfaces})` | `target` as in `rt.attend`. `text`: a string, an attribute name prefixed `@` (`'@aria-label'`), or `fn(el) → string`. Returns `off()` |
| `rt.tooltip.state()` | `{shown: [{surface, text, rect}], owners, barWrapper}` |
| `rt.tooltip.hideAll()` | Hides every in-window tooltip at once |

### 4.2 Bar tooltips (Steam's `tooltip` popup)

- `vrPooledPopupStore.ShowTooltip(el, text, params, fn)` is wrapped so `params.unDelayMS` is at least **800** (CTL P-C5). Nothing else changes; the original function is restored by `remove()`.
- The look is C3a's (`theme/35-hud.css`).
- Lab hygiene: every test that synthesizes hover ends with the pointer at (1400, 900) and checks that `vrPooledPopupStore.m_mapTooltips` is empty (IN-7).

---

## 5. Sounds: `rt.sound(event)`

Calls Steam's sound bus (`PlayNavSound(eSound, bImmediate)`, found by needles; fallback `SteamUIStore.m_GamepadUIAudioStore`). Steam applies its own policy: Settings › Audio › UI sounds, a 50 ms rate limit, lower enum pre-empts (IM §6.3). Returns the `ENavSound` number requested, or `null` if refused.

| `event` | ENavSound | Use for |
|---|---|---|
| `'activate'` | `DefaultOk` (21) | Our own controls' activation (A or trigger) |
| `'tab'`, `'segment'` | `ChangeTabs` (20) | Tab or segment change |
| `'page'` | `PagedNavigation` (15) | Paged section change |
| `'toggleOn'`, `'toggleOff'` | `ToggleOn` (16), `ToggleOff` (17) | Our switches |
| `'sliderUp'`, `'sliderDown'` | `SliderUp` (18), `SliderDown` (19) | Our sliders, per detent |
| `'sheetIn'`, `'sheetOut'` | `ShowModal` (11), `HideModal` (12) | Our sheets and alerts |
| `'menuIn'`, `'menuOut'` | `OpenSideMenu` (22), `CloseSideMenu` (23) | Side menus only |
| `'nav'` | `BasicNav` (24) | Focus moves inside our own T3 views that Steam does not sound |
| `'fail'` | `FailedNav` (25) | Our own dead-end moves |
| any `ENavSound` name or number | itself | — |

- **Refused:** `'hover'` (and any call while the laser hovers is the caller's bug: no sound on hover, VP §4.4). Never duplicate a sound Steam already plays for its own Panels' focus change.
- Tests intercept playback with `SteamUIStore.m_GamepadUIAudioStore.m_AudioPlaybackManager.PlayAudioURL` (IM §9); nothing is ever played by a test.

## 6. Haptics: `rt.haptic(kind, elOrWindow)` (disarmed)

- `kind`: `'enter'` (1 ButtonEnter), `'leave'` (2), `'snap'` (3), `'slide'` (4), `'edge'` (5), or the number.
- Returns `{api, effect, available, armed, mode, fired}`. It fires `<popup>.SteamClient.OpenVR.TriggerOverlayHapticEffect(effect, 0)` **only** when flag `haptics === true`, the mode is laser, the element is not a Steam `.Panel` (Steam already pulses those), and ≥ 80 ms passed since the last pulse. Default: `fired: false` (dry run, S17).

---

## 7. Removal (IN-9, RT-4, G-REMOVE)

`remove()` of each module, in reverse order, leaves:

- no `lgs-input-*`, `data-lgs-vr-mode`, `lgs-dwell`, `lgs-attend*`, `lgs-pressed`, `lgs-focus-in`, `lgs-ring-check`, `lgs-focus-disabled` on any node of any window; no inline `--hx` / `--hy`;
- no `.lgs-tip` node and no `#lgs-tip-style`;
- `vrPooledPopupStore.ShowTooltip` identical to Steam's original;
- subscriber counts back to baseline: `NavigationSource` subscribers, `vrGamepadInput` navigation-type callbacks, `g_PopupManager` created/destroyed callbacks, the MobX reaction disposed.

## 8. Changes

| Date | Change |
|---|---|
| 2026-10-07 | M1: first version |
