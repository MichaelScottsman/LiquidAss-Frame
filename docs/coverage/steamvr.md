# Coverage: SteamVR's own pages (area `steamvr`)

Owner of `theme/vr/` (DESIGN.md §9, LAB.md "SteamVR's own pages", inventory `docs/inventory/steamvr.md`). Done on 2026-10-06 against SteamVR web UI `CLSTAMP 11065908`.

## Files

| File | What it styles |
|---|---|
| `theme/vr/10-systemui.css` | `vr:systemui` chrome around the window: shared scale variables, the grab bar, the resize corner, the frame controls (and their tooltips, the More Options popout and the gamepad-mode pill), the controller status card, and the on-demand systemui panels (app transition, IPD, progress ring, framerate and gamepad-unsupported pills, room setup, Steam loading, persistent notifications, guided tour) |
| `theme/vr/20-nowplaying.css` | Now Playing (`#nowplayingpanel`) |
| `theme/vr/30-settings.css` | The SteamVR settings page (`#vrsettingspanel`) plus every `SettingsMain` control SteamVR reuses: Now Playing's bindings and video-settings modals, dropdown popovers, the restart banner |
| `theme/vr/40-bindings.css` | `vr:controllerbindingui` (app select, binding list, view/edit binding, rodal modals, popovers, scrollbars). Scoped to `body.ControllerMainBorderRadius` |
| `theme/vr/50-keyboard.css` | `vr:keyboard` (SteamVR's own keyboard, `keyboard.html`) |
| `theme/vr/60-overlays.css` | `messageoverlay.html`, `notificationtoast.html`, `bindingcallouts.html` |
| `theme/vr/pre/*.js` | State scripts for shots and audits (not bundled: only `theme/vr/*.css` is). See "Reproduce" |

Every file in `theme/vr/` is bundled into **every** SteamVR page. Tokens therefore have to resolve on every page:

- **Shared modules:** the 9 that every page loads (grabhandle, controllerstatus, legacydashboardframecontrols, frameresizehandle, framegamepadmodebutton, gamepaduibutton, guidedtour_steamframe, …) are written as `%{Token}`.
- **Systemui-only modules:** roomsetup, framerate, gamepadunsupportedmessage, loadingthrobber and persistentnotifications would be "unresolved" on the binding and keyboard pages. They are matched by their CSS-module prefix instead, e.g. `[class*="framerate_FramerateRoot_"]`.
- **Status:** `window.__LGS_VR.status()` shows `unresolved: [], ambiguous: []` on `systemui`, `Controller Binding` and `keyboard`.

## Look, per piece

| Piece | Treatment |
|---|---|
| **Window grab bar** | Translucent white Liquid Glass capsule (white .62 + top sheen + inset rim). A faint dark hairline and soft shadow keep it visible over a bright room. Hover and drag light it from within: white .92 + glow. SteamVR's `scaleX` grow, inline width, 60px hit padding and the transform timing are untouched |
| **Resize corner** | Stroke at `--lgs-text-2`, slightly thinner at rest (4.5), with a drop shadow for bright rooms. `--lgs-text-1` on hover and drag. SteamVR's `scale(1.4)` and stroke growth are kept |
| **Frame controls** | Each section is a panel-glass capsule, with white icons. Hover, focus and press draw a **circular** highlight (our `::before`, which is free on these buttons) inside the capsule: hover `--lgs-hover-fill`, gamepad focus `--lgs-focus-fill` + inset white ring, pressed `--lgs-pressed-fill`. SteamVR's idle `.6` container opacity, margins and paddings stay, so the quad width is unchanged |
| **Frame-control tooltips** | Panel-glass capsule, same padding and font |
| **More Options popout** | Panel-glass menu at `--lgs-r-menu`. Rows get inset rounded highlights; the separators become hairlines |
| **Gamepad-mode pill** | "Use Laser Mouse to Interact" is panel glass. "Enter Gamepad Mode" is the tinted primary, brighter on hover |
| **Controller status** | Panel-glass card behind the content only: our `::before`, anchored with CSS anchor positioning to SteamVR's icon and battery frames, so it hugs the hand, the gamepad glyph or the battery alone. No card when the status is empty. The hand PNG and the gamepad glyph are drawn white. Battery pips are whole-fill colour: full green (Steam dims them to 65%), orange under 30%, red when low. In the Frame's large layout, 8px of the battery row's top padding moves to its bottom (same total height) so the pips sit inside the card |
| **Now Playing** | Window glass at Steam's window radius. The art is content at the card radius with a soft shadow; the no-art fallback is a fill. **Resume Game** is the one tinted primary: deep play-green at rest (play tint under the dimming scrim, like Steam's Play capsule in `50-appdetails.css`), full tint on hover, highlight and focus. The other actions are fill capsules. **Exit Game / Exit Home** turns `--lgs-tint-danger` only on hover or focus; it is the only non-primary action whose label is not wrapped in a `<span>`, hence `:not(:has(> span))`. Focus is SteamVR's own `.gpfocus`: focus fill + ring, and the Steam-owned `::after` ring becomes a steady outline with no flash and no 20× blinker |
| **SteamVR settings** | Window glass. The sidebar is a fill column whose current section is an inset white rounded row. Grouped subsections are `--lgs-fill-1` cards. Buttons and dropdowns are fill capsules. Radios are round fills, the selected one white. Segmented controls are a sunken capsule well with the white selected segment. Sliders have a fill-3 track, a white fill up to the knob (drawn from SteamVR's own `--slider-value`) and a white knob with a dark value. **Advanced** controls swap SteamVR's purple slabs for a purple glass tint (`--lgs-purple` mixed 26% / 40% on hover) so they stay recognisable. Popovers and modals are thick glass. The restart banner is a glass strip with a tinted Restart |
| **Controller bindings** | Window glass at Steam's window radius (body clip radius scaled). The title bar is no longer a slab: the title floats, with a hairline under it, and Back and Options are capsules. App rows and binding entries are fill cards; buttons are fill capsules. Action-set tabs are fill segments with the current one white; warning and error tabs keep an orange or red whole fill. Mode groups are fill cards. Rodal dialogs, popovers and inline dropdown lists are thick glass with white selected rows. Scrollbars are thin `.28` white thumbs with no track, widths unchanged |
| **SteamVR keyboard** | Panel-glass slab, concentric with the keys. Keys are fill-2 (special keys fill-3) with white labels. The touched or pressed key (SteamVR's inline `background:#000`, overridden with `!important`) is white with a dark label. Done is tinted primary. The preview is a sunken well with a white caret |
| **Message overlay** | Panel glass; buttons are fill capsules, the first (affirmative) one tinted primary |
| **Notification toast** | Panel-glass rounded rect; title `--lgs-text-1`, body `--lgs-text-2` |
| **Binding callouts** | Panel-glass action panel and bubbles. The pressed input is lit with focus fill + ring; the current action set is white |
| **Transition, IPD, progress, framerate, gamepad-unsupported, room setup, loading, persistent notifications, tour** | Panel glass. Pills are capsules; SteamVR's borders stay (geometry) but go clear, with the glass clipped to the padding box. Primary buttons are tinted; the progress ring is `--lgs-green` on a panel disc; the tour keeps its semantic blue guide line |

**Scale.** SteamVR draws the dashboard window's pages wider than Steam draws main (1280 CSS px) for the same window, so window-level radii and rings scale by a page factor and corners match Steam's window glass:

| Page | Width | Factor |
|---|---|---|
| Now Playing, SteamVR settings | 1858 px | 1.45 (`--lgs-vr-scale`) |
| Binding page | 2400 px | 1.875 |
| Keyboard | 1920 px | 2.25 against Steam's 854 px keyboard |

## Screens, shots and audits

Shots are in `shots/` (1x; transparent areas show the room in the headset). `before` = theme off, `after` = theme on.

Audit columns:

- **Audit** is `glass.py audit` or the in-page audit (`pre/audit_inpage.js`, see below), with the theme verifiably applied (`themeApplied=true`).
- **Panel sizes** compares every `vsg-node[vsg-type=panel]` box with the theme off and on; they must be identical.

| Screen / state | Before | After | Audit (GONE/HIDDEN/SHRUNK/UNCLICKABLE/CONTRAST) |
|---|---|---|---|
| systemui idle: grab bar, frame controls, resize corner, controller card | `vr_sys_before` | `vr_sys_after` | 4 controls, 4 text runs, **0 issues**. Panel sizes 820×132, 314×51, 152×152, 256×256 ×2, same as stock |
| systemui laser hover (grab bar, resize, frame controls, 1st button) | `vr_sys_hover_before` | `vr_sys_hover_after` | **0 issues** |
| systemui drag + gamepad focus (`ForceActive`, `HasGamepadFocus`, `GamepadFocused`) | `vr_sys_focus_active_before` | `vr_sys_focus_active_after` | **0 issues** |
| Frame-control tooltip (real `legacy-tooltip` panel) | `vr_sys_tooltip_before` | `vr_sys_tooltip_after` | **0 issues** |
| Controller card, gamepad mode + Now Playing's natural gamepad focus on Resume | `vr_np_before` | `vr_sys_gamepadmode_after` | (covered by the Now Playing audits) |
| On-demand systemui panels (static mocks: More Options with a focused and a hovered row, gamepad pills ×3, tooltip, transition, IPD, framerate, gamepad-unsupported, progress ring, room setup with hover, loading, persistent notification, tour card) | `vr_sys_zoo_before`, `vr_sys_moreoptions_mock_before` | `vr_sys_zoo_after` | mocks only (not auditable as real panels) |
| Message overlay, notification toast, binding callouts (static mocks with hover and pressed states) | `vr_overlays_zoo_before` | `vr_overlays_zoo_after` | mocks only |
| Now Playing at rest | `vr_np_before`, `vr_np_rest_before` | `vr_np_after` | **0 issues**. Panel sizes 819×132, 1858×1045, 334×51, 152×152, 256×256 ×2, 20×34, same with the theme off and on |
| Now Playing: VR Controller Bindings focused, Exit hovered | `vr_np_states_before` | `vr_np_states_after` | **0 issues** |
| Now Playing: Resume focused | `vr_np_resumefocus_before` | `vr_np_resumefocus_after` | **0 issues** |
| Now Playing: Exit focused, Resume hovered | `vr_np_exitfocus_before` | `vr_np_exitfocus_after` | **0 issues**; also VR Video Settings focused + Bindings hovered: **0 issues** |
| SteamVR settings (General) | `vr_settings_before` | `vr_settings_after` | 5 controls, 45 text runs, **0 issues** |
| SteamVR settings, hover on a sidebar section, a radio, a segmented control, the slider and a dropdown | `vr_settings_states_before` | `vr_settings_states_after` | **0 issues** |
| Bindings: app select | `vr_bind_apps_before` | `vr_bind_apps_after` | 3 controls, 4 text runs, **0 issues** |
| Bindings: Show More Applications (107 apps) | `vr_bind_apps_more_before` | `vr_bind_apps_more_after` | 2 controls, 110 text runs, **0 issues** |
| Bindings: binding list (VR Dashboard) | `vr_bind_list_before` | `vr_bind_list_after` | 24 controls, 23 text runs, **0 issues** |
| Bindings: read-only binding view | `vr_bind_view_before` | `vr_bind_view_after` | 51 controls, 141 text runs, **0 issues** (after raising mode headers to `--lgs-text-1` and the mirrored column's controller title to full strength) |
| SteamVR keyboard (DOM shown by `kb_show.js`; "r" pressed) | `vr_kb_before` | `vr_kb_after` | 0 controls (keys are plain divs), 2 text runs, **0 issues** |

Other checks:

- **Performance budget:**
  - At rest, `backdrop-filter` is used on 0 elements in systemui and keyboard, and on 1 in the binding page: a hidden, 0×0 rodal dialog.
  - Blur only appears on opened modals and popovers.
  - There are no infinite or filter animations, and `document.getAnimations()` returns 0 at rest.
  - None of these pages has a scroller under blur, so `perf` was not needed.
- **Row 0 of the atlas:** untouched. `html`, `body`, `#root`, `vsg-app`, `.AppSceneGraph` and `vsg-*` elements are never painted.

## Reproduce

All from `glass-shell/`. Always pass `--theme on` on after-shots (see "Caveat" below).

```bash
python glass.py sync
python glass.py shot vr:systemui vr_sys_after --theme on
python glass.py shot vr:systemui vr_sys_hover_after --theme on --pre "$(cat theme/vr/pre/sys_hover.js)"
python glass.py shot vr:systemui vr_sys_focus_active_after --theme on --pre "$(cat docs/inventory/steamvr-pre/sys_focus_active.js)"
python glass.py shot vr:systemui vr_sys_tooltip_after --theme on --pre "$(cat docs/inventory/steamvr-pre/sys_tooltip.js)"
python glass.py shot vr:systemui vr_sys_zoo_after --theme on --pre "$(cat theme/vr/pre/sys_zoo.js)"
python glass.py shot vr:systemui vr_overlays_zoo_after --theme on --pre "window.__LGS_ZOO_PART = 2, $(cat theme/vr/pre/sys_zoo.js)"
python glass.py shot vr:controllerbindingui vr_bind_view_after --theme on --pre "$(cat docs/inventory/steamvr-pre/bind_view.js)" --settle 1.5
python glass.py shot vr:keyboard vr_kb_after --theme on --pre "$(cat docs/inventory/steamvr-pre/kb_show.js)"
```

- **Now Playing** (showcase only):
  1. Check with `../.claude/skills/run-liquid-glass-frame/driver.py status` that it is inactive, then run `driver.py start`.
  2. Run each step as `--pre "(async()=>{ await $(cat docs/inventory/steamvr-pre/np_open.js); window.__LGS_NP = {focus: 3, hover: 0}; return await $(cat theme/vr/pre/np_states.js) })()"`. The Steam frame can come back between steps, so reopen Now Playing in every step.
  3. Run `driver.py stop`.
- **SteamVR settings:**
  1. Hold the Steam lab lock first: `python glass.py js "(async()=>{window.__LGS_VR_HOLD=Date.now(); await L.sleep(50000); window.__LGS_VR_HOLD=0})()" &`. Keep it under the 60 s eval timeout.
  2. Use `theme/vr/pre/settings_open.js`. It stays 9 s, so an audit fits, and it returns to Steam main even if a previous run is still showing settings. Prefix it with `window.__LGS_SET_HOVER = 1,` for the hover marks.
  3. Leave ≥ 9.5 s between runs.
- **Audits:** use `theme/vr/pre/audit_inpage.js` as the `--pre` of a `shot --theme on`, after the state script: `--pre "(async()=>{ await <state>; return await <audit_inpage.js> })()"`. It toggles `html.lgs-on` inside the page with the lab's own `L.snap`/`L.diff`, so it cannot be fooled by the `lgs-vr` watcher, and it prints `themeApplied`. `python glass.py audit vr:PAGE` gives the same numbers when nothing strips the theme mid-step.

## Caveats found

- **Other agents' Steam theme toggles strip the SteamVR pages.** The `lgs-vr` watcher strips SteamVR pages whenever the Steam theme goes off. Consequences:
  - `--theme keep` shots can come out stock: two did, and were re-shot.
  - A `glass.py audit vr:…` can compare stock against stock and report a false 0.
  - The in-page audit above avoids both.
- **The audit cannot see pseudo-element backgrounds**, and it ignores `color(srgb …)` gradient stops. Dark labels on white selections therefore need the white painted on the element itself:
  - **Segmented controls:** the selected option paints the white too, appearing when SteamVR's sliding `::after` pill arrives (transition delay = SteamVR's own switch time), so the slide animation still shows.
  - **Sidebar:** the current section's white rounded row is painted on the button from 7 gradient layers in opaque `--lgs-knob` white (overlapping layers, no seams).
- **SteamVR marks the selected radio `Disabled`.** The disabled dimming therefore only applies to `.Disabled:not(.Selected)`.
- **White on the play tint (.86) is 2.4:1** at Now Playing's 36px. Resume rests deep (under `--lgs-scrim`) and lights up to the full tint on hover and focus, the same approach as Steam's Play capsule.

## Gaps (not verified live)

- **More Options popout:** opening it moves input focus (inventory §2.5.2). Verified on a static mock with SteamVR's classes only.
- **Now Playing's VR Controller Bindings / VR Video Settings modals:** styled from source (`.SettingsMain .Modal`, thick glass). Opening them means pressing those buttons, which is not allowed.
- **SteamVR settings, other sections:** only General was rendered. Not rendered: other sidebar sections, dropdown popovers, section modals, the restart banner, colour sliders (hue/alpha tracks are deliberately left alone), and password fields. All are styled from source.
- **Binding editor edit mode:** not opened (Edit/Create change bindings). This covers chord, pose and input-settings modals, `SourceModeGroup.Edit`, simulated actions, the tracker editor and the debugger. They get generic fills from source.
- **SteamVR keyboard:** DOM emulation only (`kb_show.js`), so it is not the real overlay. The "flat" head-locked presentation was not seen. The shift planes' active-key inline style is handled by the same `[style*="background"]` rule.
- **Mock-only panels:** message overlay, notification toast, binding callouts, app transition, IPD, progress ring, framerate, gamepad unsupported, room setup, Steam loading and the guided tour have no side-effect-free trigger. They were verified on static mocks only. The toast mock borrows `notificationtoast.css`; its icon path did not load in the mock.
- **Controller status:** seen with no role (empty, so no card), with battery only, with a right hand, and in gamepad mode. App-icon gamepad mode (`ControllerGamepadIconWithApp`) and the low/charging PNGs were not seen. Those PNGs 404 on this build anyway; the red filter rule is in place in case they appear.
- **Theater/dark mode:** SteamVR multiplies the grab and resize panels by 0.3 there. Not checked in the headset.
- **Not styled at all:** the legacy SteamVR dashboard (unused on the Frame), dev UIs (`inputfocusdevui`, `framedevui`, `vrlink-info`, `testing-stuff`), `ErrorBoundary`, `WakingBaseStationsPanel` (Lighthouse only), and desktop-only pages (`settings_desktop`, `systemreportviewer`, `debugcommands`).
