# Capability: input mode, laser hover, haptics, UI sounds and the scroll guard

Answers `visionos-principles.md` §7 rows **D-1, D-2, D-7, D-9** and the §1.6 "not confirmed" table, with evidence from the live Frame.

- **Date and builds:** 2026-10-07. Steam client `11094443`, Chrome 126.
- **Prototype:** `device/proto/input_mode.js`. It was tested live, then removed from every popup (§8).

| Tag | Meaning |
|---|---|
| **[PROVEN]** | Measured on the live Frame by this probe |
| **[SOURCE]** | Read from Steam's live webpack source (module ids are from build `11094443`; use the needles, not the ids). Not exercised end to end |
| **[UNPROVEN]** | Needs a wearer, or was not tested |

## How the probe was run (and what it could not do)

**Setup.** Nobody was wearing the headset, and no game or VR app was running. SteamVR stayed in **Gamepad** mode for the whole probe: `system_panel_interaction_mode = 2`.

**Inputs used:**

- **Laser.** Simulated with CDP `Input.dispatchMouseEvent` (`mouseMoved`, and once `mousePressed`/`mouseReleased`), sent to the popup's own devtools target (`main`, `bar`). These are trusted events: they produce real `:hover`, `mouseenter` and `pointermove`.
- **Synthetic JS events** (`new MouseEvent(...)`, so `isTrusted = false`), for comparison.
- **Gamepad.** `FocusNavController.DispatchVirtualButtonClick` through `L.pad`, up and down only.

**Safety wrappers, active for every step:**

- **Haptics.** Every popup's `SteamClient.OpenVR.TriggerOverlayHapticEffect` and `SetOverlayInteractionAffordance` were replaced with counters that **drop** the call. No haptic and no affordance change reached SteamVR.
- **Sounds.** `SteamUIStore.m_GamepadUIAudioStore.m_AudioPlaybackManager.PlayAudioURL` was replaced with a dropping counter, so **no sound was played** by any probe step.

All wrappers were removed afterwards, and the functions were verified native again.

**Housekeeping:**

- Every step held the lab lock.
- Route and focus were restored: `/library/home`, controller focus on the featured capsule, `NavigationSource` back to GAMEPAD, tooltip hidden, `vrGamepadInput.m_lastHoverElem` unset.
- The temp scripts were deleted.

**Not reproducible without a wearer:** flipping SteamVR's own mode (the grip toggle), and SteamVR's "overlay input focus changed" message that fires when a real laser enters a panel. Those paths are documented from source.

---

## 0. Answers in one table

| Row | Question | Answer | Recommendation |
|---|---|---|---|
| **D-1** | How does gamepadui know laser vs gamepad, and can we read it live? | **Two signals, both readable and subscribable [PROVEN]:**<br>(a) SteamVR's mode, `vrGamepadInput.IsInGamepadNav` (MobX-observable).<br>(b) Steam's navigation source, `FocusNavController.NavigationSource` (a SubscribableValue). It flips to MOUSE on the first laser move and back on the first pad press. **No root class or data attribute changes with the mode** on any popup | Add `html.lgs-input-laser` / `html.lgs-input-pad` from (b), and `data-lgs-vr-mode` from (a). `input_mode.js` does both on all popups (§2, §8) |
| **D-2** | (pad-only focus contrast) | Not affected by this probe. In gamepad mode `.gpfocus` behaves as Phase 1 assumed | Keep D-2 as written, scoped to `html.lgs-input-pad` |
| **D-7** | Laser sweeps light every card | **Hover never moves `.gpfocus` [PROVEN]:**<br>- The only per-card laser signals are `:hover`, plus Steam's own affordance and haptic enter/leave calls.<br>- A dwell helper set `.lgs-dwell` exactly **80 ms** after entry.<br>- It set none on cards swept at about 45 ms per card | Brightness on `:hover` at once. Lift, scale and depth only on `.lgs-dwell:hover` (§4) |
| **D-9** | Does `.gpfocus` persist after the laser leaves? | **Under the laser it is normally absent [PROVEN]:**<br>- Steam **removes** `.gpfocus`, `.gpfocuswithin` and even the `Focusable` class from every Panel when the source becomes MOUSE.<br>- Hover, a laser click and leaving the panel never add it.<br>- `:hover` clears as soon as the pointer leaves.<br>**Exception [SOURCE]:** when SteamVR moves overlay focus to a panel, Steam focuses the element under the laser. While the source stays MOUSE, that `.gpfocus` is **stale** and is not cleared when the laser moves on (§3.3) | Laser looks key on `:hover` only. Never key a laser look on `.gpfocus`, `.gpfocuswithin` or `.Focusable` |
| Haptics | Can gamepadui JS fire controller haptics? | **Yes, but only through SteamVR's overlay API [SOURCE + PROVEN call sites]:**<br>- **API:** `<popup>.SteamClient.OpenVR.TriggerOverlayHapticEffect(eEffect, 0)`.<br>- **Effects:** 1 ButtonEnter, 2 ButtonLeave, 3 Snap, 4 Sliding, 5 SlidingEdge.<br>- **Target:** it pulses the laser that points at that popup's overlay.<br>- **Steam already uses it:** 1/2 on every focusable Panel's enter and leave (measured: one per card crossed), and 3/4/5 on slider drags.<br>- **Steam Input path:** `SteamClient.Input.TriggerSimpleHapticEvent` and `TriggerHapticPulse` exist, but Steam Input lists **no controllers** on the Frame | Use the overlay effect only for our own non-Panel controls, in laser mode, opt-in, at most one pulse per 80 ms. Never re-pulse Steam Panels (§5) |
| Sounds | `PlayNavSound` and the UI-sounds setting | **[PROVEN path, SOURCE policy]:**<br>- **Call:** the bus `eZ.PlayNavSound(eSound, bImmediate)` (module with `RegisterCallbackOnPlaySound`), or directly `SteamUIStore.m_GamepadUIAudioStore.PlayNavSound(eSound, bImmediate)`.<br>- **Setting:** it returns early when `settingsStore.clientSettings.enable_ui_sounds` is false.<br>- **Limits:** 50 ms rate limit; a lower enum value pre-empts a pending one.<br>- **Laser hover plays nothing:** BasicNav only plays for GAMEPAD-source focus changes. A laser *click* on a tab requested BasicNav + PagedNavigation | Call Steam's bus with Steam's enum for our controls, the same events Steam uses. No hover sounds (§6) |
| Scroll guard | How does focus scroll into view, and does `scroll-padding` work? | **Native `element.scrollIntoView({behavior:'smooth', block:'nearest'})` for default nodes. Steam's own math, which also reads `scroll-padding`, for `NoTransform` scrollers [SOURCE].**<br>**`scroll-padding` works [PROVEN]:** stock Settings keeps the focused row exactly 60 px above the pane bottom (Steam's CSS). With an injected `scroll-padding-bottom:120px` it is exactly **120 px**, on 10 of 10 scrolling moves | Implement the guard in CSS. Use `scroll-padding-*` in px on Steam's scrollers, with `!important` where Steam writes it inline. No JS (§7) |

---

## 1. Where the state lives

Everything is in **SharedJSContext**. Every gamepadui popup (main `VR_uid0`, bar, barpopup, frame.menu, floatingfooter, tooltip, volumelevel, keyboard, toasts) is a child window: `window.opener` is SharedJSContext, and popups have no `FocusNavController` of their own **[PROVEN]**.

| Object | Global path | Notes |
|---|---|---|
| SteamVR focus bridge | `window.vrGamepadInput`, also `VRFocus.Instance` | Class in module 84114 (needles `system_panel_interaction_mode`, `IsInGamepadNav`) |
| Focus navigation | `window.FocusNavController` (= `SteamUIStore.NavigationManager`) | Owns `NavigationSource`, the contexts and the input sources |
| Popups | `window.g_PopupManager` | `GetPopups()`, `AddPopupCreatedCallback(fn)` and `AddPopupDestroyedCallback(fn)`, each returning `{Unregister}`. The callback gets the popup (`p.window`) |
| Sounds | `SteamUIStore.m_GamepadUIAudioStore` | Steam's implementation of `PlayNavSound` |
| UI settings | `window.settingsStore.clientSettings` | `enable_ui_sounds` (live: `true`) |

---

## 2. Input mode (D-1)

### 2.1 The two signals

| | (a) SteamVR panel mode | (b) Steam navigation source |
|---|---|---|
| **Read** | `vrGamepadInput.IsInGamepadNav` (bool), or `vrGamepadInput.ShowGamepadFocusMode` (the same, with a legacy `flags & 2` fallback) | `FocusNavController.NavigationSource.Value.eActivationSourceType`, and `FocusNavController.NavigationSourceSupportsFocus.Value` (bool) |
| **Values** | From `m_lastOverlayInputFocusChangedMessage.system_panel_interaction_mode()`. EVRSystemPanelInteractionMode (module 68584): 0 Unknown, **1 LaserMouse**, **2 Gamepad** | EInputSourceType (module 20505): 0 UNKNOWN, **1 GAMEPAD**, 2 KEYBOARD_SIMULATOR, **3 MOUSE**, 4 TOUCH, 5 LPAD, 6 RPAD. `SupportsFocus` is true only for 1 and 2 |
| **Live value** | `{overlay_key: "valve.steam.gamepadui.main", flags: 3, system_panel_interaction_mode: 2}`, so `IsInGamepadNav = true` | `{eActivationSourceType: 1, nActiveGamepadIndex: -1}` |
| **Changes when** | Only on SteamVR's *OverlayInputFocusChanged* message: the grip toggle, or overlay focus moving to another panel. Page events cannot change it: **it stayed `true` through every synthetic mouse test [PROVEN]** | **Any** input. A gamepad button sets GAMEPAD. A mode change from (a) forwards GAMEPAD or MOUSE. A mouse move in any popup sets MOUSE (each popup has its own mouse source, `m_rgGamepadInputSources` type 3) |
| **Subscribe** | MobX: `m_lastOverlayInputFocusChangedMessage` is `observable.ref`, so `reaction(() => vrGamepadInput.IsInGamepadNav, fn)` works. Steam itself reads it with `useObserver(() => …IsInGamepadNav)`. Callback alternative: `vrGamepadInput.RegisterForNavigationTypeChange(fn)` returns `{Unregister}`. It fires with 1 or 3 at the end of every *OverlayInputFocusChanged* | `FocusNavController.NavigationSource.Subscribe(fn)` returns `{Unsubscribe}`. It fires only on change (it has an equality function) |
| **What Steam keys on it** | The library Sort/Filter pill, which renders only when `isVR && !IsInGamepadNav` (module 10272). The floating-footer legend for the grip buttons (§2.3). The guided tour's A/X glyph badges | The visibility of `.gpfocus`, `.gpfocuswithin` and `Focusable` (§2.2). The footer hook in module 82312 also reads `NavigationSourceSupportsFocus` |

**MobX finder for our code:**

- The single module whose source contains `[MobX]` (id 89193 here).
- `reaction` is the export whose source contains `"Reaction"` and `compareStructural`.

### 2.2 What a mode flip does to the DOM [PROVEN]

Measured on `/library/home`:

| | Gamepad (source 1) | Laser (source 3, after a CDP move) |
|---|---|---|
| `.Focusable` in main / bar | **164 / 12** | **3 / 0**. The three left are the search `INPUT` and two `%{UninstalledIcon}` |
| `.Panel` in main | 161 | 161 |
| `.gpfocuswithin` in main | 14 | **0** |
| `.gpfocus` | 1 (the featured capsule) | **0** |
| `html` / `body` classes, all 10 popups | e.g. main: `html.Rp8QOGJ2DypeDniMnRBhr.lgs-on`, `body = %{*PopupBody} GamepadMode BasicUI %{SteamUIPopupWindowBody} %{GamepadUIPopupWindowBody} LowPerfMode WindowFocus` | **Identical.** `body.GamepadMode` is the gamepad *UI*, not the input mode, and it stays in laser |

**Why the classes go [SOURCE]:**

- `FocusNavController.OnNavigationTypeChange(MOUSE)` (module 5757) calls `TransferFocus(APPLICATION, null)` on the active tree, unless the focused element is a text input.
- Panels add `Focusable` only while the focus-nav context says `bSupportsFocus` (module 23569).

**Live log, first CDP move:**

```
+91 ms  SupportsFocus false / NavigationSource 3 / FocusChanged {src: 2 APPLICATION, el: null}
+109 ms -gpfocus %{LibraryItemBox} %{Landscape} %{InRecentGames} %{FeaturedCapsule}
```

**Impact on today's theme:**

- Selectors that rely on `.Focusable` do not match under the laser: `40-library.css:277`, `40-library.css:720`, `70-social.css:642` and `layers.json:58`.
- Neither do container states keyed on `.gpfocuswithin`, such as `70-social.css` `.friendlist.GamepadMode.gpfocuswithin`.
- These looks switch off whenever the laser is used. Audit them against D-1.

### 2.3 Steam's own mode-dependent UI [SOURCE]

- **Footer legend** (module 53487). For one controller type only (`eControllerType == S.My`, presumably the Frame controllers), the grip buttons (`REAR_LEFT_LOWER` / `REAR_RIGHT_LOWER`, `bShowOnFloatingVRFooter`) carry a label:
  - `#VRDashboard_ShowLaserMouse` = **"Laser Mouse"** while `ShowGamepadFocusMode` is true;
  - `#VRDashboard_HideLaserMouse` = **"Hide Laser Mouse"** in laser mode.

  This is the "laser-mode pill". The floatingfooter popup stayed hidden for the whole probe (headset unworn), so it was not seen live.
- **Library tabs** (module 10272). `Ft = isVR && !IsInGamepadNav && (showSortingContextMenu || showFilterDialogForCollection)` decides whether the laser-only Sort/Filter pill renders.

### 2.4 Flip test: synthesized input [PROVEN]

| Step (main window, `/library/home`) | `NavigationSource` | `IsInGamepadNav` | `.gpfocus` | deepest `:hover` |
|---|---|---|---|---|
| Baseline | 1 | true | featured capsule | – |
| CDP `mouseMoved` sweep onto card 2 | **3** (within the first few moves: 5–170 ms) | true | **none** | `%{LibraryItemOverlayInnerArea}` |
| Dwell 1.05 s on card 2 | 3 | true | none | same |
| Move to card 3 | 3 | true | none | card 3's overlay |
| Move outside the viewport | 3 | true | none | **none** |
| `L.pad('down')` | **1** | true | **featured capsule again**: the first press only re-takes focus | – |
| `L.pad('up')` | 1 | true | search box | – |
| 12 synthetic `mousemove` (`isTrusted` false), then synthetic `mouseover`/`mouseenter` on card 2 | **3** | true | none | **none**: `card.matches(':hover')` is false |
| Synthetic `mouseleave` | 3 | true | none | none |
| `L.pad` down | 1 | true | featured capsule | – |

**What the table shows:**

- **`isTrusted` doesn't matter to Steam.** The mouse source has no `isTrusted` check, and synthetic `mousemove` events flip the source after about 500 px of accumulated travel. Synthetic `mouseover` and `mouseenter` reach Steam's listeners: `vrGamepadInput.m_lastHoverElem` was set to the card, and the affordance and haptic hooks fired (dropped).
- **Only CDP input sets `:hover`.** That makes CDP `Input.dispatchMouseEvent` on the popup's own target the way to test laser CSS. This corrects principles §1.2 "Hover cannot be faked".
- **One mode for every popup.** Hovering the **bar** flipped the shared source. The bar lost its `.Focusable` classes, and the main window was affected too.

**Which popups share one mode:** both signals are singletons in SharedJSContext. `input_mode.js` painted all **10** live popups in one update (9 kinds; there were two frame.menu popups):

- VR, VRKeyboard, bar, barpopup, tooltip, volumelevel, floatingfooter, frame.menu ×2, VRNotificationToasts.

**What stays per popup:**

- the mouse accumulator;
- the `SteamClient` object, so haptics target that popup's overlay;
- `.gpfocus`, which is one per window.

SteamVR's own pages (`vr:systemui` and the others) run in vrwebhelper, outside this JS heap. They need their own signal if `theme/vr/` wants a mode **[UNPROVEN]**.

---

## 3. `.gpfocus` and `:hover` under the laser (D-9, §1.6)

### 3.1 Class lists before and after [PROVEN]

| State | Featured capsule (card 0) | Card 1 |
|---|---|---|
| Gamepad, focus on card 0 | `%{LibraryItemBox} %{Landscape} %{InRecentGames} %{FeaturedCapsule} %{BasicMode} Panel Focusable gpfocus gpfocuswithin` | `%{LibraryItemBox} %{PortraitImage>Portrait} %{InRecentGames} %{BasicMode} Panel Focusable`, not `:hover` |
| Laser on card 1 | `%{LibraryItemBox} %{Landscape} %{InRecentGames} %{FeaturedCapsule} %{BasicMode} Panel` | `%{LibraryItemBox} %{PortraitImage>Portrait} %{InRecentGames} %{BasicMode} Panel`, **`:hover` true**. Deepest hover is `%{LibraryItemOverlayInnerArea}`. Its parent `%{PortraitImage>Draggable} %{PortraitImage>HoversEnabled} Panel` lost `Focusable` too |
| Laser on empty space (640, 420; the shelf background) | same | same, **`:hover` false**. Deepest hover is `%{PortraitImage>Image} %{Visibility} %{PortraitImage>Visible} %{RecentGamesBackgroundImage} %{MoveRight}` |
| Laser outside the window | same | same, no `:hover` anywhere in main |

**Other cases:**

- **Settings.** Hovering the active tab "System" set `:hover` on `%{PagedSettingsDialog_PageList_ShowTitle>PageListItem_Title}` and no `.gpfocus`.
- **Laser click.** A CDP press and release on that already-active tab also set **no `.gpfocus`**. It requested BasicNav and PagedNavigation (both dropped).
- **Bar.** Hovering a small button showed the tooltip ("Streaming Status") at +1.4 s. Moving the pointer off hid it, so no stuck tooltip remained.

### 3.2 Steam's own laser-hover feedback [PROVEN]

Every focusable Panel is wrapped (module 24616) with the affordance hook `HJ` (module 58508). On the element's `mouseenter` and `mouseleave` it calls, on **that popup's** `SteamClient.OpenVR`:

- `SetOverlayInteractionAffordance(2, true|false)`, where 2 = clickable;
- `SetOverlayInteractionAffordance(1, true|false)`, sent as well for items that have a context menu (library cards: yes; settings tabs and bar buttons: no);
- `TriggerOverlayHapticEffect(1 ButtonEnter | 2 ButtonLeave, 0)`.

Measured: one enter/leave pair per card crossed, including cards swept at about 45 ms per card. Steam does not rate-limit it.

### 3.3 The stale-focus exception [SOURCE, UNPROVEN live]

When SteamVR sends *OverlayInputFocusChanged* for a Steam panel (the laser enters another panel, or the user toggles the mode), `vrGamepadInput.OnVROverlayInputFocusChanged` runs these steps:

1. It activates that panel's nav tree.
2. `FocusItemUnderMouse` dispatches `vgp_requestfocus` (source GAMEPAD) on `m_lastHoverElem`. That is the element last seen under the laser, tracked by document `mouseover` and cleared 200 ms after document `mouseleave`.
3. `TakeFocusIfNothingIsFocused` calls `TakeFocus`.
4. Finally `OnNavigationTypeChanged(…)` runs. This clears focus **only if the source actually changes** (`ChangeNavigationSource` returns whether it changed).

**Result:**

- **Laser already active, laser enters another panel.** The item under the laser gets `.gpfocus` and **keeps it while the laser moves on**. Hover never moves it again.
- **Gamepad → laser toggle.** The focus set in steps 2–3 is cleared at once.

This is the likely origin of INV-B's "Steam sets `.gpfocus` for the laser too".

**§1.6 answers:**

- **Follow?** `.gpfocus` does **not** follow the laser across tiles. There were 0 focus changes during sweeps across 4–6 cards.
- **Stay?** It can be stale in laser mode, from the panel-entry case.
- **`:hover`** is the only reliable "the laser is on this" signal, and it clears when the pointer leaves.

**Recommendation (D-9, P-02):**

```css
html.lgs-input-laser %{LibraryItemBox}:hover { /* hover look */ }
html.lgs-input-pad   %{LibraryItemBox}.gpfocus { /* focus look (D-2) */ }
/* never: html.lgs-input-laser ….gpfocus without :hover */
```

---

## 4. Laser dwell (D-7) [PROVEN with the prototype]

`input_mode.js` listens for `mouseover` and `mouseout` (capture) on every popup document. In laser mode it finds the **innermost** element under the pointer that matches `dwellSelector`, skipping anything larger than half the window (page containers). The default selector is `.Panel, button, [role="button"], [role="tab"], a[href]`. It is **not** `.Focusable`, which Steam removes under the laser (§2.2).

After 80 ms, if the element is still `:hover`, the helper adds `.lgs-dwell` and `style="--lgs-dwell: 1"`. Leaving the element, switching to pad mode or `remove()` clears both.

**Measured (CDP):**

- `enter card1` at +701 ms, then `+lgs-dwell card1 --lgs-dwell=1` at **+781 ms** (80 ms).
- A sweep across cards 2→3→4 at about 45 ms per card produced **no** dwell on any of them.
- Moving to empty space or off the window cleared it.

**CSS pattern** (motion only after dwell, brightness at once):

```css
html.lgs-input-laser %{LibraryItemBox}:hover { background-color: … }            /* instant */
html.lgs-input-laser %{LibraryItemBox}.lgs-dwell:hover { scale: 1.04; translate: 0 -4px; }
/* or a continuous form: scale: calc(1 + .04 * var(--lgs-dwell, 0)); */
```

**Further rules:**

- Keep `transition-delay: 0` on the scale. The 80 ms is in the class, so a sweep never starts a transition.
- Animate only `scale`, `translate` and `opacity` (LAB perf rules).

---

## 5. Haptics

### 5.1 APIs reachable from gamepadui JS

None of these was fired by this probe. Every one of Steam's own calls during the synthetic hovers was intercepted and dropped (one enter/leave pair per element crossed).

| API | Reach it from | Arguments (from Steam's call sites; the natives report `length` 0) | Steam uses it for |
|---|---|---|---|
| **`SteamClient.OpenVR.TriggerOverlayHapticEffect(eEffect, n)`** | **The popup window's own** `SteamClient`: `el.ownerDocument.defaultView.SteamClient.OpenVR`. Each popup has a separate `SteamClient` object; the property is writable | `eEffect` is EVROverlayHapticEffect (module 68584 `en`): 0 None, **1 ButtonEnter**, **2 ButtonLeave**, **3 Snap**, **4 Sliding**, **5 SlidingEdge**. `n`: Steam passes `0`; the VR keyboard passes a controller index | Panel enter and leave (§3.2). Slider drags (module 50777): `SlidingEdge` at the clamp ends, `Sliding` per 1/40 of travel, `Snap` per step. VR keyboard trackpad hover. Steam's developer test page ("VR Haptics" section, module 37730) warns: *"Lasermouse must be pointing at this overlay to feel the haptic."* |
| `SteamClient.OpenVR.SetOverlayInteractionAffordance(eAffordance, bOn)` | Per popup | 2 = clickable, 1 = has a context menu. Steam ref-counts per window (`SetInteractionAffordance` in module 58508) | Laser affordance while over Panels. Not haptic, but SteamVR may change the laser's look. Never call it unbalanced |
| `SteamClient.Input.TriggerSimpleHapticEvent(controllerIndex, eTarget, eType, unIntensity, ndBGain)` | SharedJSContext | `eType`: 1 Tick, 2 Click. Steam's helper (module 26596, `PlayHaptic` / `PlaySteamDeckHaptic`) only calls it for Steam Deck / Triton controller types | Deck keyboard, radial menus, the boot movie |
| `SteamClient.Input.TriggerHapticPulse(controllerIndex, side, 360, 0)` | SharedJSContext | Legacy controller type only | Same helper, as a fallback |
| `SteamClient.Input.ForceSimpleHapticEvent(…)` | SharedJSContext | – | The controller-settings "test strength" slider |

**On the Frame,** Steam Input's controller list (`sY.GetControllers()`, module 35137) was **empty**. The `SteamClient.Input.*` haptics have no target here. **The overlay effect is the only usable path.** Firing it on the real device is **[UNPROVEN]**: it needs a wearer pointing the laser.

### 5.2 Recommendation

- **Our own controls only.** Use `TriggerOverlayHapticEffect`, called on the popup window that owns the element, in **laser mode only** (it targets the laser; in gamepad mode there is nothing to pulse). Use it only for **our** controls that are not Steam Panels: native-layer ornaments, custom sliders. Steam already pulses ButtonEnter and ButtonLeave for every focusable Panel, so adding ours would double-pulse.
- **Vocabulary mapping** (§4.4 of the principles):

  | Our pulse | Effect |
  |---|---|
  | hover tick | ButtonEnter (Steam does this already) |
  | detent | Snap |
  | drag | Sliding |
  | edge / thud | SlidingEdge |

  There is **no tap or click effect**. Leave activation unpulsed, or reuse Snap, and decide with a wearer.
- **Limits** go in our wrapper: one pulse per 80 ms (the prototype enforces this), a Glass Shell "haptics off" switch, and **disarmed by default**. Steam's own per-Panel pulses cannot be rate-limited without patching Steam, which is not recommended.

---

## 6. UI sounds

### 6.1 How to call them

| Path | Call |
|---|---|
| Steam's bus (preferred) | Find the module with `RegisterCallbackOnPlaySound` and `"BasicNav"` (id 67758, 1466 chars). It exports `PN` (ENavSound) and `eZ`. Call `eZ.PlayNavSound(eSound, bImmediate)`. `eZ.SuppressImminentNavSound()` cancels a pending sound |
| Without webpack | `SteamUIStore.m_GamepadUIAudioStore.PlayNavSound(eSound, bImmediate)`: the implementation the bus dispatches to (class `Ce` in module 5757) |
| From our code | `__LGS_INPUT.playSound('BasicNav' \| 24 \| 'deck_ui_misc_10')` |

**Measured [PROVEN]:**

- `__LGS_INPUT.playSound('BasicNav')` returned 24.
- Steam requested it on the bus and called `PlayAudioURL('/sounds/deck_ui_misc_10.wav')`, which the probe intercepted. **Nothing was played.**

### 6.2 ENavSound → file

From the module imports. "GamepadUI mode" is `m_fnGetUIMode()`, 4 live; the VR dashboard is in it, since BasicNav resolved to its file.

| # | Name | File | # | Name | File |
|---|---|---|---|---|---|
| 0 | LaunchGame | `deck_ui_launch_game.wav` | 15 | PagedNavigation | `deck_ui_navigation.wav` |
| 1 | FriendMessage | `ui_steam_message_old_smooth.m4a` | 16 | ToggleOn | `deck_ui_switch_toggle_on.wav` |
| 2 | ChatMention | `steam_at_mention.m4a` | 17 | ToggleOff | `deck_ui_switch_toggle_off.wav` |
| 3 | ChatMessage | `steam_chatroom_notification.m4a` | 18 | SliderUp | `deck_ui_slider_up.wav` |
| 4 | ToastMessage | `deck_ui_message_toast.wav` | 19 | SliderDown | `deck_ui_slider_down.wav` |
| 5 | ToastAchievement | `deck_ui_achievement_toast.wav` | 20 | ChangeTabs | `deck_ui_tab_transition_01.wav` |
| 6 | ToastMisc | `deck_ui_toast.wav` | 21 | DefaultOk | `deck_ui_default_activation.wav` |
| 7 | ToastMiscShort | (none in gamepad UI) | 22 | OpenSideMenu | `deck_ui_side_menu_fly_in.wav` |
| 8 | FriendOnline | `ui_steam_smoother_friend_online.m4a` | 23 | CloseSideMenu | `deck_ui_side_menu_fly_out.wav` |
| 9 | FriendInGame | `ui_steam_smoother_friend_join.m4a` | 24 | **BasicNav** | `deck_ui_misc_10.wav` |
| 10 | VolSound | `deck_ui_volume.wav` | 25 | FailedNav | `deck_ui_bumper_end_02.wav` |
| 11 | ShowModal | `deck_ui_show_modal.wav` | 26 | Typing | `deck_ui_typing.wav` |
| 12 | HideModal | `deck_ui_hide_modal.wav` | 27 | TimerExpired | `timer_expired_alarm.wav` |
| 13 | IntoGameDetail | `deck_ui_into_game_detail.wav` | 28 | Screenshot | `camera1.wav` |
| 14 | OutOfGameDetail | `deck_ui_out_of_game_detail.wav` | | | |

All files are under `/sounds/`.

### 6.3 Policy inside Steam [SOURCE]

`PlayNavSound`:

- returns early unless `settingsStore.clientSettings.enable_ui_sounds` is true. **Our calls inherit Steam › Audio › UI sounds.**
- drops a sound that comes within **50 ms** of the last one.
- lets a lower enum value pre-empt a pending one. A laser tab click requested BasicNav (24) and PagedNavigation (15); only `deck_ui_navigation.wav` reached playback.
- plays after 1 ms unless `bImmediate` is set.

**When Steam itself plays sounds:**

- `BasicNav` plays **only** for focus changes whose source is GAMEPAD, unless the node has `disableNavSounds`.
- `FailedNav` plays on an unhandled D-pad press.

**Measured:** 0 sound requests during laser hovers and sweeps. One `deck_ui_misc_10` per `L.pad` move. So, for §1.6: **Steam plays no nav sound on laser movement**, but laser clicks play activation and page sounds.

### 6.4 Recommendation

For our restyled or new controls, call the bus with **the same ENavSound Steam uses for the same event**:

| Event | Sound |
|---|---|
| Activate | DefaultOk |
| Tab or segment change | ChangeTabs |
| Paged section | PagedNavigation |
| Toggle | ToggleOn / ToggleOff |
| Sheet in / out | ShowModal / HideModal |

**Rules:**

- Pass nothing on laser hover.
- Don't duplicate the sound Steam already plays for a focus change of its own Panels.
- New files are never needed.

---

## 7. Scroll guard

### 7.1 Mechanism [SOURCE]

The scroll code is module 84719 (needles `"ScrollSnap"`, `scrollPaddingBottom`), export `ZQ`. The nav node's `SetDOMFocusAndScroll` (module 74562) calls it on every focus move.

**For the focused node:** it collects the node plus ancestors with `scrollIntoViewWhenChildFocused`, then for each one:

- **`fnScrollIntoViewHandler` on the node** overrides everything. Chat and the bar tabs use one.
- **`scrollIntoViewType` Standard (0, the default)** → native `element.scrollIntoView({behavior: 'smooth' | 'auto', block: 'nearest'})`.
  - Smooth by default.
  - Instant if the target is more than 40 % of the viewport away, if another scroll happened less than 500 ms ago, or while restoring history.
  - Native `scrollIntoView` honours the scroller's `scroll-padding` and the element's `scroll-margin`.
- **NoTransform (1), NoTransformSparseContent** (`ScrollPanelGroup`, module 52872), **and every ancestor entry** → Steam's own function `M`.
  - It reads `scroll-padding-*` of each scroll container and `scroll-margin-*` of the element through `getComputedStyle`.
  - It accepts **px only**; any other unit logs "Unsupported length" and counts as 0.
  - It then calls `scrollTo` with its own 200 ms sine animation.
  - For a window scroller it reads SharedJSContext's `documentElement`, which is a Steam bug; irrelevant for element scrollers.
- **`ScrollPanel` props** `scrollPaddingTop/Right/Bottom/Left` are written as **inline style**, which beats theme CSS without `!important`.

### 7.2 Measurement [PROVEN]

**Where:** `/settings` › System, content pane `%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageContent}`: 1024×720, `scrollHeight` 3282, no inline style. Steam's own CSS gives it `scroll-padding: 250px` top and `60px` bottom.

**How:** 48 `L.pad` moves (12 down, 12 up, twice). Each one was a native `scrollIntoView({behavior: 'smooth', block: 'nearest'})` on the focused `%{*GamepadDialogContent>Field}`. Measured 450 ms after each move.

| Run | Focused row's bottom gap to the pane bottom, on moves that scrolled | Top gap on up moves |
|---|---|---|
| Stock (`scroll-padding-bottom: 60px`) | **60 px** on 11 of 12 (rows of 47 px: OS Name … Steam Version). On the first move the scrolled element was a sub-header button, not the measured row: 72 px | ≥ 277 px (honours 250) |
| Injected `scroll-padding-bottom: 120px !important` | **120 px** on 10 of 10 | ≥ 277 px |

The settings sidebar (`…PagedSettingsDialog_PageList`) has Steam's `scroll-padding: 36px` and `scroll-snap-type: y mandatory`.

**Not verified:**

- The library Home carousel, a ReactVirtualized grid. It may use a custom handler.
- Inline-padded `GamepadPage` scrollers.

### 7.3 Recommendation

**The scroll guard is CSS** (P-34 / I-9):

- Put `scroll-padding-top` and `scroll-padding-bottom` **in px** on Steam's scrollers, e.g. `%{ScrollPanel}`, `…PageContent` and `%{ScrollArea}`.
- Size them for the toolbar row, the bottom ornament and the scroll-edge bands, plus 16 px.
- Add `!important` where Steam sets them inline or in its own CSS. Settings already uses 250 / 60.
- Use `scroll-margin` on an item for per-item exceptions.
- No JS and no `scrollIntoView` patching.

---

## 8. Prototype: `device/proto/input_mode.js`

One expression. It can be evaluated in SharedJSContext or in **any gamepadui popup**: it reaches SharedJSContext through `window.opener` and installs itself there once.

**What it sets:**

- **Root class:** `html.lgs-input-laser` or `html.lgs-input-pad` on every popup, including popups created later through `g_PopupManager.AddPopupCreatedCallback`.
  - **pad** when `eActivationSourceType` is 1 or 2;
  - **laser** for 3–6;
  - for 0 (UNKNOWN), SteamVR's mode decides.
- **Attribute:** `html[data-lgs-vr-mode="gamepad"|"laser"]` from `IsInGamepadNav`. Use it for D-5 glyph badges and laser-only affordances.
- **Dwell:** `.lgs-dwell` / `--lgs-dwell` (§4).

**API, `window.__LGS_INPUT`** (on SharedJSContext and on every popup window):

| Member | What it does |
|---|---|
| `mode` | `'laser'` or `'pad'` |
| `state()` | Mode, source, vrMode, subscription kinds, sound and haptic status, dwell |
| `onChange(fn)` | Returns `off()`. `fn(state, previous, reason)` runs when `mode` or `vrMode` changes |
| `playSound(name \| id)` | Plays through Steam's bus. Accepts ENavSound names, numbers or `deck_ui_*` aliases |
| `haptic(kind, elOrWin)` | `enter`, `leave`, `snap`, `slide` or `edge` (or 1–5), through `TriggerOverlayHapticEffect`. **Disarmed by default:** it returns a dry-run plan until `armHaptics(true)`. Laser mode only, at most one pulse per 80 ms |
| `dwellSelector` | The selector used to find the dwell target (§4) |
| `remove()` | Undoes everything |

**Subscriptions:**

- `FocusNavController.NavigationSource.Subscribe`;
- `vrGamepadInput.RegisterForNavigationTypeChange`;
- a MobX `reaction` on `IsInGamepadNav`. It falls back to a 2 s poll only if MobX isn't found.

It makes one webpack pass. Module ids are only hints, verified by needles, and only the MobX and sound modules (both already loaded) are required.

**Live test** (one locked step, haptics and sound playback intercepted):

| Check | Result |
|---|---|
| Install from the `main` popup's target | 5 ms. State: `mode: pad, source: gamepad, vrMode: gamepad, mobxReaction: true, sound.bus: true, uiSoundsEnabled: true` |
| Evaluate again from the `bar` target (idempotent) | Same instance returned, no extra subscribers (+1 each over baseline, from the single install) |
| Classes | All 10 popups `lgs-input-pad vr=gamepad`. After the CDP laser move, all 10 `lgs-input-laser`. `onChange` fired `pad->laser` (reason `source`) |
| Dwell | 80 ms on card 1. None during the 45 ms-per-card sweep. Cleared off-window |
| `haptic('enter', card)` | `{available: true, armed: false, fired: false}`. Nothing called |
| `playSound('BasicNav')` | Bus → `PlayAudioURL('/sounds/deck_ui_misc_10.wav')` (intercepted) |
| `L.pad('down')` | `laser->pad`, all 10 popups `lgs-input-pad` |
| `remove()` | No `lgs-input-*` classes or `data-lgs-vr-mode` left on any popup. `__LGS_INPUT` gone everywhere. Subscriber counts back to baseline: NavigationSource 2, vr callbacks 1, popup-created 11, popup-destroyed 2 |

The prototype was then removed from the live popups. It is not loaded by `lgs`.

**To try it:**

```bash
python glass.py sync
python glass.py eval SharedJSContext @/home/steamos/.local/share/glass-shell/device/proto/input_mode.js
python glass.py js "__LGS_INPUT.state()"
python glass.py js "__LGS_INPUT.remove()"
```

**Integration notes:**

- In the product, evaluate it in **SharedJSContext**. If it is evaluated in a popup, the closures live in that popup's realm. That is fine for `main`, which persists, but not for a transient menu.
- `lgs off` must call `remove()`.

---

## 9. Lab notes for later probes

- **Real laser hover without a wearer.** Use CDP `Input.dispatchMouseEvent` on the popup's own target (`lab.target_for('main')` plus `lgs.Session`). It gives real `:hover` and `mouseenter`, and Steam's affordance and haptic calls. **Wrap every popup's `SteamClient.OpenVR.TriggerOverlayHapticEffect` and `SetOverlayInteractionAffordance` first**: someone may be holding the controllers.
- **Clearing a stuck hover or tooltip.** Move the CDP pointer outside the viewport, e.g. `(1400, 900)`. That clears `:hover`, hides bar tooltips and clears `vrGamepadInput.m_lastHoverElem` after 200 ms.
- **After a synthetic hover.** The source stays MOUSE and `.gpfocus` is gone. The first `L.pad` press only re-takes focus.
- **Restoring focus silently.** First return to GAMEPAD with one pad press. Then use:

  ```js
  el.dispatchEvent(new w.CustomEvent('vgp_requestfocus', {bubbles: true, cancelable: true, detail: {button: 0, source: 1}}))
  ```

  This is the event Steam's own `FocusItemUnderMouse` uses. It did nothing while the source was MOUSE.
- **Muting UI sounds for a test step.** Shadow `SteamUIStore.m_GamepadUIAudioStore.m_AudioPlaybackManager.PlayAudioURL`, then `delete` it to restore. The setting is not touched.
- **`glass.py outline --route R` leaves the route changed.** Navigate back yourself.
