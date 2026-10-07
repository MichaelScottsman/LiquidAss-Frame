# Coverage: SteamVR's own pages (area `steamvr`)

Owner of `theme/vr/` (DESIGN.md §9, LAB.md "SteamVR's own pages", inventory `docs/inventory/steamvr.md`). Done on 2026-10-06 against SteamVR web UI `CLSTAMP 11065908`. Fix pass for the review findings on 2026-10-07 (see "Fix pass" below); current after-shots are the `vrf_*` set.

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

**Laser hover on SteamVR's laser-only pages.** SteamVR settings, the binding editor, the SteamVR keyboard, message overlays, room setup and Now Playing in laser-mouse mode draw no gamepad focus ("Use Laser Mouse to Interact"), so laser hover is the only targeting cue. Controls there use one strong hover, defined once in `10-systemui.css` §0: `--lgs-vr-hover-fill` (= `--lgs-focus-fill`, .22) plus `--lgs-vr-hover-rim` (an inset `1.5px × page scale` ring in `--lgs-control-outline`). This matches Steam's own pages, where the laser lights the pointed control with `.gpfocus`; ours is the same fill without the glow, so gamepad focus (fill + ring + glow) stays distinct where it exists. Pressed stays brighter (`--lgs-pressed-fill`, .30). Rows that rest transparent or at `--lgs-fill-1` get the fill only.

| Piece | Treatment |
|---|---|
| **Window grab bar** | Translucent white Liquid Glass capsule (white .62 + top sheen) with a **two-tone edge**: an inset 1.5px black .55 ring and an outer 1px black .32 ring (the 60px hit padding leaves room), so the white body reads over a dark room and the dark edge over a bright one. Hover and drag light it from within: white .92 + glow, same edge. SteamVR's `scaleX` grow, inline width, 60px hit padding and the transform timing are untouched |
| **Resize corner** | Near-opaque white stroke (`--lgs-text-1`; a .72 stroke let its own halo show through and went grey over a grey room) at SteamVR's own stroke width, with a tight two-pass dark halo (`drop-shadow(0 0 .8px rgba(0,0,0,.9))` ×2, cursor style) plus a soft drop shadow. Pure white (`--lgs-knob`) on hover and drag. SteamVR's `scale(1.4)` and stroke growth are kept |
| **Frame controls** | Each section is a panel-glass capsule, with pure white glyphs. Hover, focus and press draw a **pill** (our `::before`, free on these buttons) inset 3px in the button, so it is concentric with the section capsule (25.5 − 3 = 22.5) and the focus ring clears every glyph (the 36-unit glyphs at 38px overflowed the old 45px circle); one-button sections stay near-circles. Hover `--lgs-hover-fill`, gamepad focus `--lgs-focus-fill` + inset white ring, pressed `--lgs-pressed-fill`. **Idle:** SteamVR fades the container to `.6` exactly when it is neither hovered nor gamepad-focused; then the capsule tint goes opaque (`--lgs-vr-solid-bg`, the panel tint), so the faded capsule is a .6 tint like stock and the glyphs keep at least stock contrast over a bright room. Hover and focus bring back the .73 panel glass at full opacity (background transition in step with SteamVR's .4s fade). Margins and paddings stay, so the quad width is unchanged |
| **Frame-control tooltips** | Panel-glass capsule, same padding and font |
| **More Options popout** | Panel-glass menu at `--lgs-r-menu`. Rows get inset rounded highlights; the separators become hairlines |
| **Gamepad-mode pill** | "Use Laser Mouse to Interact" is panel glass. "Enter Gamepad Mode" is the tinted primary, brighter on hover |
| **Controller status** | Panel-glass card behind the content only: our `::before`, anchored with CSS anchor positioning to SteamVR's icon and battery frames, so it hugs the hand, the gamepad glyph or the battery alone. No card when the status is empty. The hand PNG and the gamepad glyph are drawn white. **Battery pips are whole-fill colour:** the horizontal pip PNGs (`controller_model_battery_1..4`, `controller_model_low`; a soft glow band and black empty pips) are swapped with `content:` for an SVG of the same natural size (210×25, pip centres and radius measured from the PNG), so the img box stays 160×19: green `#30d158`, orange `#ff9f0a` for `_battery_1` (under 30%), red `#ff453a` for `_low`, empty pips white .24 fills. Data URIs can't read CSS variables, so the token hex values are written out. The charging PNGs and SteamVR's vertical `vert_` set (not seen on the Frame) keep the full-strength hue-rotated tint. In the Frame's large layout, 8px of the battery row's top padding moves to its bottom (same total height) so the pips sit inside the card |
| **Now Playing** | Window glass at Steam's window radius. The art is content at the card radius with a soft shadow. **No art:** SteamVR paints its placeholder portrait (`appimage_default_portrait.png`, opaque #282828) as an inline `background-image` on the fallback's `.Icon`; that placeholder is decoration, so it goes (`!important`, inline style) and the fallback card is a `--lgs-fill-1` fill with an inner rim and no content shadow. Only that URL is matched; real art and icons are untouched. **Resume Game** is the one tinted primary: deep play-green at rest (play tint under the dimming scrim, like Steam's Play capsule in `50-appdetails.css`); hover and focus light it to `--lgs-vr-play-lit` (the play tint with 18% black, so the white 36px label stays ≥ 3.5:1 over any room); hover adds the inner rim, focus the ring. `%{Highlighted}` (SteamVR: primary + laser-mouse mode + no controllers) keeps the rest look, so in that mode rest and hover still differ. The other actions are fill capsules with the strong laser hover. **Exit Game / Exit Home** turns `--lgs-tint-danger` only on hover or focus; it is the only non-primary action whose label is not wrapped in a `<span>`, hence `:not(:has(> span))`. Focus is SteamVR's own `.gpfocus`: focus fill + **one** ring (`--lgs-vr-focus-ring`, like Steam's DialogButton and Play focus); the Steam-owned `::after` ring element keeps its geometry but its outline goes clear and its flash / grow / 20× blinker stop |
| **SteamVR settings** | Window glass. The **sidebar is the same raised pane as Steam Settings** (`60-settings.css`), its sibling page in this window: our `::before` inset 8/6/8/8 (×1.45), `--lgs-r-panel` ×1.45 (concentric with the window), panel sheen + `--lgs-fill-1` + glass rim, the sidebar `isolation: isolate` so it sits under the list. Section rows are capsules inset 8px inside the pane like Steam's; the current section is a white **capsule** painted on the button from 7 overlapping opaque gradient layers (`--r` 32px; a non-overlapping 3-layer capsule showed hairline seams at this page's fractional scale). Grouped subsections are `--lgs-fill-1` cards. Buttons and dropdowns are fill capsules. Radios are round fills, the selected one white. Segmented controls are a sunken capsule well with the white selected segment. Sliders have a fill-3 track, a white fill up to the knob (drawn from SteamVR's own `--slider-value`) and a white knob with a dark value; **detent ticks** are `--lgs-text-2` with `mix-blend-mode: difference`, so they turn dark grey on the white fill and dim light grey on the track. **Advanced** controls swap SteamVR's purple slabs for a purple glass tint (`--lgs-purple` mixed 26% / 40% on hover) so they stay recognisable. Popovers and modals are thick glass. The restart banner is a glass strip with a tinted Restart. All hovers are the strong laser hover |
| **Controller bindings** | Window glass at Steam's window radius (body clip radius scaled). The title bar is no longer a slab: the title floats, with a hairline under it, and Back and Options are capsules. App rows and binding entries are fill cards; buttons are fill capsules. Action-set tabs are fill segments with the current one white; warning and error tabs keep an orange or red whole fill. The **unbound-actions count** (absolutely positioned over the end of the tab label) is an opaque panel-tint chip with a white count, like stock's opaque chip, so the digit never draws over the label. Mode groups are fill cards (hover one step up, `--lgs-fill-3`). SteamVR's `.5` dimming of the mirrored column (`.Mirrored`) and of unbound rows (`.None .Label.BindingLabel`) is raised to `.64`: still clearly dimmer, but above stock contrast on translucent glass over a bright room. Rodal dialogs, popovers and inline dropdown lists are thick glass with white selected rows. Scrollbars are thin `.28` white thumbs with no track, widths unchanged. All hovers are the strong laser hover |
| **SteamVR keyboard** | Panel-glass slab at **Steam's keyboard radius** (`--lgs-r-panel` × 2.25 = 54px, like `35-hud.css`). What sits in its top corners follows the curve: the preview well's top corners (5px in, 49px) and, in minimal mode without a preview, the first row's corner keys (7px in, 47px). The bottom keys sit 33px above the slab edge, where the slab curve already clears their normal corners, so they keep the key radius. Keys are fill-2 (special keys fill-3) with white labels; **laser hover** lifts letter keys to `--lgs-focus-fill` and special keys to `--lgs-pressed-fill` (the special-key rule carries the `:has()` so it outranks their rest fill), both with the inner rim. The touched or pressed key (SteamVR's inline `background:#000`, overridden with `!important`) is white with a dark label. Done is tinted primary. The preview is a sunken well with a white caret |
| **Message overlay** | Panel glass; buttons are fill capsules (strong laser hover), the first (affirmative) one tinted primary |
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

Fix-pass shots (`vrf_*`, 2026-10-07) replace the earlier after-shots; the earlier `vr_*_before` stock shots stay valid where the state is the same. New `vrf_*_before` stock shots were taken where the live state had changed (two battery-only controller cards instead of the gamepad card; settings opening on the Dashboard section). They are captured with `html.lgs-on` removed for the capture (every theme rule is scoped under it), so the `lgs-vr` watcher is never stopped.

| Screen / state | Before | After | Audit (GONE/HIDDEN/SHRUNK/UNCLICKABLE/CONTRAST) |
|---|---|---|---|
| systemui idle: grab bar, frame controls, resize corner, controller cards | `vrf_sys_before` | `vrf_sys_after` | 4 controls, 4 text runs, **0 issues** |
| systemui laser hover (grab bar, resize, frame controls, 1st button) | `vrf_sys_hover_before` | `vrf_sys_hover_after` | **0 issues**. (The emulation can't lift SteamVR's `:not(:hover)` idle fade, so the capsules show their idle tint there) |
| systemui drag + gamepad focus (`ForceActive`, `HasGamepadFocus`, `GamepadFocused` on pop-out) | `vrf_sys_focus_active_before` | `vrf_sys_focus_active_after` | **0 issues** |
| Frame-control tooltip (real `legacy-tooltip` panel) | `vr_sys_tooltip_before` | `vr_sys_tooltip_after` | **0 issues** (unchanged by the fix pass) |
| On-demand systemui panels (static mocks: More Options with a focused and a hovered row, gamepad pills ×3, tooltip, transition, IPD, framerate, gamepad-unsupported, progress ring, room setup with hover, loading, persistent notification, tour card) | `vr_sys_zoo_before`, `vr_sys_moreoptions_mock_before` | `vrf_sys_zoo_after` | mocks only (not auditable as real panels) |
| Message overlay, notification toast, binding callouts (static mocks with hover and pressed states) | `vr_overlays_zoo_before` | `vrf_overlays_zoo_after` | mocks only |
| Now Playing at rest (laser-mouse mode: Resume carries `%{Highlighted}`; no-art fallback) | `vr_np_before`, `vr_np_rest_before` | `vrf_np_after` | **0 issues**. Panel sizes 819×132, 1858×1045, 334×51, 152×152, 256×256 ×3, 20×34, identical with the theme off and on (`pre/panel_sizes.js`) |
| Now Playing: Resume focused | `vr_np_resumefocus_before` | `vrf_np_resumefocus_after` | 4 controls, 10 text runs, **0 issues** |
| Now Playing: VR Controller Bindings focused, Exit hovered | `vr_np_states_before` | `vrf_np_states_after` | **0 issues** |
| Now Playing: Exit focused, Resume hovered | `vr_np_exitfocus_before` | `vrf_np_exitfocus_after` | **0 issues** |
| Now Playing: no focus, VR Video Settings hovered (laser mode) | `vr_np_before` | `vrf_np_hover_after` | **0 issues** |
| SteamVR settings (opens on its last section, Dashboard) | `vrf_settings_before` | `vrf_settings_after` | 6 controls, 40 text runs, **0 issues** |
| SteamVR settings, hover on a sidebar section, a segmented control, the slider and a dropdown | `vrf_settings_states_before` | `vrf_settings_states_after` | **0 issues** |
| SteamVR settings mocks inside the real page (`pre/settings_mock.js`): a radio row with 80 hovered and 90 selected, two slider detents (on the fill and on the track) | `vr_settings_states_before` (real General radios) | `vrf_settings_mock_after` | mocks; computed styles: rest `.10`, hovered `.22` + rim, selected `.94` |
| Bindings: app select | `vr_bind_apps_before` | `vrf_bind_apps_after` | 3 controls, 4 text runs, **0 issues** |
| Bindings: laser hover on an app row, Back and Show More | `vrf_bind_hover_before` | `vrf_bind_hover_after` | **0 issues** |
| Bindings: Show More Applications (107 apps) | `vr_bind_apps_more_before` | `vrf_bind_apps_more_after` | 2 controls, 109 text runs, **0 issues** (audited 1.5 s after the list opens; earlier, app images still loading reflow the names) |
| Bindings: binding list (VR Dashboard) | `vr_bind_list_before` | `vrf_bind_list_after` | 24 controls, 23 text runs, **0 issues** |
| Bindings: read-only binding view (unbound-actions chip on "Keyboard Entry") | `vrf_bind_view_before` | `vrf_bind_view_after` | 51 controls, 141 text runs, **0 issues** |
| SteamVR keyboard, full mode ("r" pressed, "g" and backspace laser-hovered, `pre/kb_states.js`) | `vrf_kb_before` | `vrf_kb_after` | 0 controls (keys are plain divs), 2 text runs, **0 issues** |
| SteamVR keyboard, minimal mode (no preview row: first-row corner keys follow the slab) | (none) | `vrf_kb_minimal_after` | display check |

Other checks:

- **Performance budget:**
  - At rest, `backdrop-filter` is used on 0 elements in systemui and keyboard, and on 1 in the binding page: a hidden, 0×0 rodal dialog.
  - Blur only appears on opened modals and popovers.
  - There are no infinite or filter animations, and `document.getAnimations()` returns 0 at rest (re-checked after the fix pass on systemui, the binding page and the keyboard: 0 visible blurs, 0 blend modes, 0 animations).
  - The only blend mode is the settings slider detent (`difference` on a 3px tick, static). The frame-control capsules transition `background-color` only on hover / idle changes, in step with SteamVR's own opacity fade.
  - None of these pages has a scroller under blur, so `perf` was not needed.
- **Row 0 of the atlas:** untouched. `html`, `body`, `#root`, `vsg-app`, `.AppSceneGraph` and `vsg-*` elements are never painted.

## Fix pass (review findings, 2026-10-07)

Measured from screenshots composited over a dark (24), grey (128), 210 and bright (235) room. "Stock" = theme off.

| Finding | Outcome | Evidence after the fix |
|---|---|---|
| Keyboard icon keys lost laser hover (`:has()` rest rule outranked `:hover`) | Fixed: `.VRKBKey:has(> .VRKBKeyFace > img):hover` | Computed: special keys `.16 → .30` + rim (was `.16 → .16`); letters `.10 → .22` + rim. Hover-vs-rest over a grey room: letters 1.46, specials 1.52 (stock 1.32) |
| Laser hover too weak on laser-only pages | Fixed: strong SteamVR hover (§ "Laser hover") on settings, bindings, keyboard, message overlay, room setup, binding callouts, Now Playing | Radio rest vs hover (fill alone, rim not counted) 1.51 / 1.43 / 1.33 (was 1.13 / 1.10). Binding app row 1.74 / 1.65 / 1.49 (stock 1.54), Back 1.49 / 1.41 / 1.32, Show More 1.53 / 1.46 / 1.35 (were 1.10–1.15), plus the rim |
| Grab bar and resize corner vanish over a bright room | Fixed: two-tone bar edge; resize stroke near-opaque white with a tight dark halo, stock stroke width | Bar vs room, dark / grey / 210 / 235: 11.4 / 3.12 / 3.50 / 4.16 (was 14.9 / 3.59 / 2.18 / 2.23; stock 1.80 / 2.48 / 6.49 / 8.20). Resize: 16.3 / 3.82 / 7.01 / 7.90 (was 9.6 / 2.79 / 1.39 / 1.40) |
| Frame-control icons wash out at SteamVR's idle .6 | Fixed: capsule tint opaque only while idle, pure white glyphs | Glyph vs capsule, keyboard button: 6.15 / 5.16 / 4.28 / 4.06 (stock 5.13 / 4.60 / 3.88 / 3.69); More: 6.52 / 5.56 / 4.59 / 4.34 (stock 6.43 / 5.57 / 4.60 / 4.35, equal within 0.01) |
| Resume lit state below 3:1 | Fixed: lit fill = play tint + 18% black; `%{Highlighted}` keeps the rest look | Label vs capsule, lit (hover or focus): 3.81 / 3.66 / 3.54 / 3.51 (was 2.64 / 2.52 / 2.43 / 2.41; stock 2.75). Rest 5.63–5.26 |
| Binding view dim rows over a bright room | Fixed: SteamVR's `.5` mirrored / unbound dimming raised to `.64` (labels were already `--lgs-text-1`, so no vibrancy step was left) | At 235: mirrored header and Click 3.87 (was 2.97; stock 4.91 / 3.63; bold 24px is large text, threshold 3), Touch / None 3.72 (was 2.95; stock 3.64), mirrored Touch 2.51 (stock 1.93) |
| Unbound-actions count drew over the tab label | Fixed: opaque panel-tint chip, white count | `vrf_bind_view_after`: "3" clean on its chip |
| Slider detents vanish on the white fill | Fixed: `--lgs-text-2` tick with `mix-blend-mode: difference` | `vrf_settings_mock_after`: dark tick on the fill, dim light tick on the track |
| Now Playing double focus ring | Fixed: Steam-owned `::after` outline clear, button's own ring kept | `vrf_np_resumefocus_after`, `vrf_np_states_after`: one ring |
| Now Playing no-art fallback was an opaque slab | Fixed: placeholder `background-image` removed (URL-matched), fill-1 card with rim, no content shadow | `vrf_np_after`; computed `.Icon` background-image `none`, ArtworkColumn shadow `none` |
| Frame-control circle cut through the glyphs | Fixed: concentric inset pill | `vrf_sys_focus_active_after`: the focus ring clears the pop-out glyph |
| SteamVR settings sidebar didn't match Steam Settings | Fixed: inset raised pane + capsules + white capsule | `vrf_settings_after`, `vrf_settings_states_after` |
| Battery pips: hue-rotate smear, black empty pips | Fixed: SVG swap for the horizontal pip set | `vrf_sys_after`: clean orange 1/4 and green 2/4, empty pips white .24 |
| Keyboard slab squarer than Steam's keyboard | Fixed for the slab (54px), the preview well and minimal-mode first-row corner keys. **Not applied to the bottom corner keys:** they sit 33px above the slab edge (last row ends at y 1047 on a 1080 slab), so a 47–49px corner would not be concentric (a concentric key corner there is about 21px, close to the 18px key radius) and the slab curve already clears their normal corners (checked: key arc reaches 47.2px from the slab corner centre, inside its 54px) | `vrf_kb_after`, `vrf_kb_minimal_after` |

## Reproduce

All from `glass-shell/`. Always pass `--theme on` on after-shots (see "Caveat" below).

```bash
python glass.py sync
python glass.py shot vr:systemui vrf_sys_after --theme on
python glass.py shot vr:systemui vrf_sys_hover_after --theme on --pre "$(cat theme/vr/pre/sys_hover.js)"
python glass.py shot vr:systemui vrf_sys_focus_active_after --theme on --pre "$(cat docs/inventory/steamvr-pre/sys_focus_active.js)"
python glass.py shot vr:systemui vr_sys_tooltip_after --theme on --pre "$(cat docs/inventory/steamvr-pre/sys_tooltip.js)"
python glass.py shot vr:systemui vrf_sys_zoo_after --theme on --pre "$(cat theme/vr/pre/sys_zoo.js)"
python glass.py shot vr:systemui vrf_overlays_zoo_after --theme on --pre "window.__LGS_ZOO_PART = 2, $(cat theme/vr/pre/sys_zoo.js)"
python glass.py shot vr:controllerbindingui vrf_bind_view_after --theme on --pre "$(cat docs/inventory/steamvr-pre/bind_view.js)" --settle 1.5
python glass.py shot vr:keyboard vrf_kb_after --theme on --pre "$(cat theme/vr/pre/kb_states.js)"
python glass.py shot vr:keyboard vrf_kb_minimal_after --theme on --pre "window.__LGS_KB_MINIMAL = 1, $(cat theme/vr/pre/kb_states.js)"
python glass.py shot vr:controllerbindingui vrf_bind_hover_after --theme on --pre "$(cat theme/vr/pre/bind_hover.js)"
```

- **Stock before-shots without stopping the watcher:** add `(()=>{const h=document.documentElement; h.classList.remove('lgs-on'); setTimeout(()=>h.classList.add('lgs-on'), 5000)})()` after the state script in the `--pre` of a `--theme on` shot.
- **Panel sizes:** `--pre "$(cat theme/vr/pre/panel_sizes.js)"` (after `np_open.js` for Now Playing).

- **Now Playing** (showcase only):
  1. Check with `../.claude/skills/run-liquid-glass-frame/driver.py status` that it is inactive, then run `driver.py start`.
  2. Run each step as `--pre "(async()=>{ await $(cat docs/inventory/steamvr-pre/np_open.js); window.__LGS_NP = {focus: 3, hover: 0}; return await $(cat theme/vr/pre/np_states.js) })()"`. The Steam frame can come back between steps, so reopen Now Playing in every step.
  3. Run `driver.py stop`.
- **SteamVR settings:**
  1. Hold the Steam lab lock first: `python glass.py js "(async()=>{window.__LGS_VR_HOLD=Date.now(); await L.sleep(50000); window.__LGS_VR_HOLD=0})()" &`. Keep it under the 60 s eval timeout.
  2. Use `theme/vr/pre/settings_open.js`. It stays 9 s, so an audit fits, and it returns to Steam main even if a previous run is still showing settings. Prefix it with `window.__LGS_SET_HOVER = 1,` for the hover marks; follow it with `theme/vr/pre/settings_mock.js` for the radio and detent mocks (the page opens on the user's last section, which may have neither).
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
- **White on the play tint (.86) is 2.4:1** at Now Playing's 36px. Resume rests deep (under `--lgs-scrim`) like Steam's Play capsule, and its lit state (hover, focus) is the play tint with 18% black (≥ 3.5:1), not the full tint.
- **Deviations from DESIGN.md §9, for legibility (design owner to confirm):** the resize corner's stroke is `--lgs-text-1`, not `--lgs-text-2` (a translucent stroke over its own dark halo turns grey; see the fix pass), and the grab bar carries a dark two-tone edge besides its white rim, because without a blurrable backdrop a white-only bar disappears over a bright room.
- **Hover emulation can't undo `:not(:hover)`.** The frame controls' idle fade and opaque idle tint are written as `:not(:hover)`; the `[data-lgs-hover]` clone can't lift them, so hover shots show the idle capsule tint (a real hover shows the .73 panel glass).

## Gaps (not verified live)

- **More Options popout:** opening it moves input focus (inventory §2.5.2). Verified on a static mock with SteamVR's classes only.
- **Now Playing's VR Controller Bindings / VR Video Settings modals:** styled from source (`.SettingsMain .Modal`, thick glass). Opening them means pressing those buttons, which is not allowed.
- **SteamVR settings, other sections:** only General was rendered. Not rendered: other sidebar sections, dropdown popovers, section modals, the restart banner, colour sliders (hue/alpha tracks are deliberately left alone), and password fields. All are styled from source.
- **Binding editor edit mode:** not opened (Edit/Create change bindings). This covers chord, pose and input-settings modals, `SourceModeGroup.Edit`, simulated actions, the tracker editor and the debugger. They get generic fills from source.
- **SteamVR keyboard:** DOM emulation only (`kb_show.js`), so it is not the real overlay. The "flat" head-locked presentation was not seen. The shift planes' active-key inline style is handled by the same `[style*="background"]` rule.
- **Mock-only panels:** message overlay, notification toast, binding callouts, app transition, IPD, progress ring, framerate, gamepad unsupported, room setup, Steam loading and the guided tour have no side-effect-free trigger. They were verified on static mocks only. The toast mock borrows `notificationtoast.css`; its icon path did not load in the mock.
- **Controller status:** seen with no role (empty, so no card), with battery only, with a right hand, and in gamepad mode. App-icon gamepad mode (`ControllerGamepadIconWithApp`), the low / charging PNGs and the vertical `vert_` battery set were not seen (the low and charging PNGs 404 on this build anyway). `controller_model_low` gets the red-pip SVG; charging and `vert_` keep the hue-rotated PNG.
- **SteamVR settings radios:** the page now opens on the user's last section (Dashboard), which has none; the radio hover was verified on a mock row built from SteamVR's classes inside the real page, not by switching the user's section.
- **Theater/dark mode:** SteamVR multiplies the grab and resize panels by 0.3 there. Not checked in the headset.
- **Not styled at all:** the legacy SteamVR dashboard (unused on the Frame), dev UIs (`inputfocusdevui`, `framedevui`, `vrlink-info`, `testing-stuff`), `ErrorBoundary`, `WakingBaseStationsPanel` (Lighthouse only), and desktop-only pages (`settings_desktop`, `systemreportviewer`, `debugcommands`).
