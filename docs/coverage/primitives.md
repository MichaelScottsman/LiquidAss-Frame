# Coverage: area `primitives` (foundation)

Owner of `theme/10-primitives.css`, `theme/00-tokens.nowrap.css` (tokens added/tuned, no renames) and `theme/defs.svg` (unused, not created).
Measured live on 2026-10-06 against Steam build 11041156. All shots are 1.5x and live in `shots/`. "before" = inventory shot taken with `--theme off`, "after" = `prim_*` with `--theme on`.

## What the primitives do

| Primitive | Treatment (tokens) |
|---|---|
| `button.DialogButton%{*GamepadDialogContent>Button}` | Capsule, `--lgs-fill-2` + `--lgs-control-rim`; hover `--lgs-hover-fill`; focus `--lgs-focus-fill` + `--lgs-focus-ring` (!important, Steam paints white); pressed `--lgs-pressed-fill` (Steam's own `scale` kept); disabled recessed `--lgs-fill-sunken` + `--lgs-disabled-opacity`, never tinted. One tinted action: `.Primary` / `.Destructive` inside `.DialogFooter` or `%{ModalButtonRow}` are `--lgs-tint-primary` / `--lgs-tint-danger` at rest; Primary elsewhere (row actions like Disconnect) is neutral at rest and tints on hover/focus. `.GreenPlay` = `--lgs-tint-play`. Focus on a tint = `--lgs-tint-lift` over the tint + ring. `.Glyph` focus no longer darkens its icon. |
| Field rows `%{*GamepadDialogContent>Field}` (non-Classic) | Rows with `Background` form one grouped card per run of consecutive rows: `--lgs-fill-1`, `--lgs-r-card` outer corners, the 6px gap (`--lgs-field-gap`) filled by a box-shadow, inset hairline `--lgs-separator` (Field `::before`, free on non-Classic rows, pointer-events none). Labels `--lgs-text-1`, descriptions / values `--lgs-text-2`, disabled rows `--lgs-text-3`. Focus (`HighlightOnFocus` `.gpfocus`/`.gpfocuswithin`, a keyframe fill): Steam's fill is replaced with !important and the highlight is an inner `--lgs-r-row` pill (`::after`, z -1) with `--lgs-focus-fill` + `--lgs-focus-ring`, so the card stays whole. When focus sits on a button / dropdown / input / checkbox / radio inside the row, that control carries the ring and the row only glows (`--lgs-hover-fill`). |
| Toggles | Rail `--lgs-fill-3` capsule + `--lgs-track-depth`; Steam's on-fill (`ToggleRail::before`, transform untouched) recoloured `--lgs-toggle-on`; knob `--lgs-knob` + `--lgs-knob-shadow`; focused knob rim `--lgs-focus-outline`; Steam's focus halo (`Toggle.gpfocus::after`) recoloured `--lgs-fill-2` capsule; hover ring `--lgs-hover-fill`; disabled `--lgs-disabled-opacity`. |
| Sliders | Track `--lgs-fill-3` capsule; fill via Steam's own `--left-track-color` = `--lgs-slider-fill`, `--default-value-track-color` = `--lgs-slider-fill-2` (QAM brightness "boost" range); knob white + `--lgs-knob-shadow`, focused knob `--lgs-focus-glow`; notches `--lgs-fill-3` / active `--lgs-slider-fill`; notch labels and value `--lgs-text-2`; editable value box = well + focus ring. Handle container transform and inline vars untouched. |
| Dropdown buttons `%{DropDownControlButton}` | Same capsule as buttons; caret `--lgs-text-2` (`--lgs-text-1` focused); rich (multi-line) dropdowns `--lgs-r-card`; rich label title/description keep `--lgs-text-1/2` on focus (Steam darkens them for its white focus); Game Recording `%{BitrateOption}` likewise. |
| Text inputs | `BasicTextInput` / `DialogTextInputBase`: sunken capsule well (`--lgs-well-bg`, `--lgs-well-shadow`), text `--lgs-text-1`, caret `--lgs-caret`, placeholder `--lgs-text-3` (upright), focus = well + `--lgs-focus-ring`; textarea r-row; `._DialogInputContainer` focus/active likewise; `.DialogLabel` `--lgs-text-2`. |
| Segmented radios `%{Group}` | Sunken capsule well holding transparent capsule segments; selected (`%{Group>Active}`) = `--lgs-selected-fill` pill + `--lgs-text-on-selected` + `--lgs-pill-shadow`; hover `--lgs-hover-fill`; Steam's segment divider `::before` recoloured `--lgs-separator`; focus = floating FocusRing. CenteredPill variant: separator borders, white selected. |
| Checkboxes `.DialogCheckbox` | Well, `--lgs-r-small`, `--lgs-control-outline` edge; checked = white `--lgs-selected-fill` box with dark check; hover `--lgs-hover-fill`; focus = FocusRing. |
| Context / dropdown menus (gamepad presentation) | `contextMenuContents` = thick glass (`--lgs-panel-sheen`, `--lgs-thick-bg`, `--lgs-thick-blur`, `--lgs-glass-rim`, `--lgs-glass-shadow`), `--lgs-r-menu`, 8px padding, Steam's drop-shadow filter replaced; the invisible 15/40px end margins removed (they read as empty glass). Items transparent, `--lgs-r-row`, `--lgs-text-1`; hover `--lgs-hover-fill`; Selected / open-submenu parent (`active`) = white selected pill; focus `--lgs-focus-fill` + ring (on a Selected row: white + glow); Positive / Emphasis / Destructive (+ `.Play .Launch .Stream .Download .Stop …`) tint the whole row on hover/focus only; disabled `--lgs-text-disabled`; `.menuChecked` = white label + a check mark (`::after`, mask, pointer-events none) instead of thin cyan text; check SVGs in rows follow the label colour; section headers `--lgs-text-2`; submenu arrow currentColor .7; separators 1px hairlines inset 12px (Steam's 2px slot kept). Header above the menu `--lgs-text-1` + text shadow. Behind menus the dimming layer frosts the page (`--lgs-menu-scrim-blur`, iOS context-menu look) because the menu column sits in Steam's animated container, a backdrop root that keeps the column's own blur from reaching the page. |
| Modals | Scrim `.ModalOverlayBackground` = `--lgs-scrim` (Steam's 3px blur kept; menus get the frosted scrim). Dialog card (`ModalPosition > GamepadDialogContent`) = thick-glass sheet, `--lgs-r-sheet`, border made transparent (geometry kept), entrance animation untouched. Custom scrolling content placed straight in the modal (`ModalPosition > div.Panel:has(> ScrollPanel)`) gets the same sheet (colour only). Dialog header/body `--lgs-text-1`, `.DialogSubHeader`/`.DialogControlsSectionHeader` `--lgs-text-2`. |
| Floating focus ring `%{FocusRing}` | Steady `--lgs-focus-outline` outline (2px, offset 2) + `--lgs-focus-glow`, radius `min(--lgs-r-row, 35%)` (tighter on checkboxes); Steam's 20x opacity pulse held at 1 (`opacity: 1 !important`, the animation itself untouched); inline geometry untouched. |
| Generic progress bar | Track `--lgs-fill-3` capsule; fill white via Steam's inline `var(--gpColor-Blue)` (set on the bar); operation text `--lgs-text-2`. |

### Token changes (foundation)
Added (no renames): `--lgs-focus-outline`, `--lgs-focus-glow`, `--lgs-pressed-fill`, `--lgs-control-rim`, `--lgs-tint-lift`, `--lgs-well-bg`, `--lgs-well-shadow`, `--lgs-caret`, `--lgs-control-outline`, `--lgs-knob`, `--lgs-knob-shadow`, `--lgs-slider-fill`, `--lgs-slider-fill-2`, `--lgs-track-depth`, `--lgs-pill-shadow`, `--lgs-text-on-tint`, `--lgs-field-gap`, `--lgs-menu-scrim-blur`.
Tuned: `--lgs-disabled-opacity` .45 -> .50 (lowest that keeps disabled labels at or above stock contrast over a bright room); `--lgs-thick-bg` alpha `.62+.2*dial` -> `.68+.2*dial` (.78 at the default dial: Steam's dim greys inside dialog bodies keep 4.5:1 over a bright room); `--lgs-window-sheen` and `--lgs-panel-sheen` rewritten bottom-up (0deg): identical pixels, but the first stop is now the faint end, so the audit's flat "first gradient stop" backdrop estimate no longer counts the top highlight under body text.

## Screens and states

How-to ids: CONFIRM / ALERT / MENU / SUBMENU / POWER / ZOO(label) = `docs/inventory/shell.md` §0.2; settings BODY snippets = `docs/inventory/settings.md` §0.3–0.4 and §4–5 (dropdown open §4.6, dialogs §5). Focus: `--pre` starts with `await L.pad('right',1)` (restores gamepad nav after a laser click elsewhere), then `el.focus()` on the target, or `L.pad('down',n)`.

| Screen / state | How to reach | Before | After | Audit (main unless noted) | Notes |
|---|---|---|---|---|---|
| Buttons rest / disabled / field rows | `--route /zoo/buttons` | `prim_zoo_buttons_before` | `prim_zoo_buttons_after` | 41 ctl, 0 issues | grouped card, capsules, recessed disabled |
| Button focused inside a row | `/zoo/buttons`, pre `L.pad('right',1)` | — | `prim_zoo_buttons_focus` | (same page) 0 | button carries the ring, row glows |
| Toggles on / off / disabled | `/zoo/toggles` | `prim_zoo_toggles_before` | `prim_zoo_toggles_after` | 40 ctl, 0 | green whole-fill track |
| Toggle row focused | `/zoo/toggles`, pad right + down | — | `prim_zoo_toggles_focus` | 0 | row ring, knob rim, halo pill |
| Sliders (notches, value, editable values) | `/zoo/sliders` (+ scrolled to end) | `prim_zoo_sliders_before` | `prim_zoo_sliders_after`, `prim_zoo_sliders2_after` | 125 ctl, 0 | white fill, value wells |
| Slider row focused | `/zoo/sliders`, pad right + down | — | `prim_zoo_sliders_focus` | 0 | |
| Dropdown buttons incl. disabled | `/zoo/dropdowns` | `prim_zoo_dropdowns_before` | `prim_zoo_dropdowns_after` | 43 ctl, 0 | |
| Field layouts (inline / below / icons) | `/zoo/fieldlayouts` | `prim_zoo_fields_before` | `prim_zoo_fields_after` | 45 ctl, 0 | |
| Text input, progress bars | `/zoo/misc` | `prim_zoo_misc_before` | `prim_zoo_misc_after` (+`_crop`) | 97 ctl, 0 | progress fill white |
| Small input / textarea | `/zoo/input` | `prim_zoo_input_before` | `prim_zoo_input_after` | 38 ctl, 0 | bare `<textarea>` not styled (see below) |
| Settings System (top, scrolled to crash reports) | `/settings/system` (+ scrollTop 650) | `set_system`, `set_system_2` | `prim_set_system_after`, `prim_set_system_2_after` | 86 ctl, 0 | disabled rows / toggles |
| Settings Display | `/settings/display` | `set_display` | `prim_set_display_after` | 40 ctl, 0 | |
| Settings Audio | `/settings/audio` | `set_audio` | `prim_set_audio_after` | 48 ctl, 0 | sliders with icons |
| Settings Controller (+ Advanced) | `/settings/controller/:type/:controllerIndex`, `/settings/controller/advanced/:controllerIndex` | `set_controller`, `set_controller_advanced` | `prim_set_controller_after` | 43 ctl, 0 / 45 ctl, 0 | |
| Settings Notifications (toggle pairs, radio, checkbox matrix) | `/settings/notifications` | `set_notifications`, `_2` | `prim_set_notifications_after` | 105 ctl, 0 | |
| Settings Downloads | `/settings/downloads` | `set_downloads` | `prim_set_downloads_after` | 48 ctl, 0 | `%{FakeContainer}` pseudo-row is settings-owned (request) |
| Settings Accessibility | `/settings/accessibility` | `set_accessibility` | `prim_set_accessibility_after` | 43 ctl, 0 | |
| Settings Internet / Bluetooth | `/settings/internet`, `/settings/bluetooth` | `set_internet`, `set_bluetooth` | `prim_set_internet_after`, `prim_set_bluetooth_after` | 47 ctl, 0 / 47 ctl, 0 | clickable info rows |
| Settings Remote Play (disabled "Connected" button) | `/settings/remoteplay` scrolled to end | `set_remoteplay_2` | `prim_set_remoteplay_2_after` | 54 ctl, 0 | |
| Other settings pages (audit only) | power, keyboard, security, friends, cloud, ingame, compatibility, family, gamerecording, home, library, store, developer, storage | `set_*` | — | all 0 issues | |
| Focus: toggle row | `/settings/system`, pad right, focus 1st Toggle | `set_focus_toggle` | `prim_set_focus_toggle_after` | — | |
| Focus: slider (adjust mode) | `/settings/audio`, pad right, focus SliderControlAndNotches | `set_focus_slider` | `prim_set_focus_slider_after` | — | navigated away afterwards so no slider stays in adjust mode |
| Focus: button | `/settings/system`, focus "Apply" (never pressed) | `set_focus_button` | `prim_set_focus_button_after` | — | |
| Focus: dropdown | `/settings/system`, focus first DropDownControlButton | `set_focus_dropdown` | `prim_set_focus_dropdown_after` | — | |
| Focus: text input | `/settings/keyboard`, focus first BasicTextInput | `set_focus_input` | `prim_set_focus_input_after` | — | |
| Focus: segmented radio (FocusRing) | `/settings/notifications`, focus `.RadioButton` "Never" | `set_focus_radio` | `prim_set_focus_radio_after` | — | |
| Focus: checkbox (FocusRing) | `/settings/notifications`, focus 3rd `.DialogCheckbox` | `set_focus_checkbox` | `prim_set_focus_checkbox_after` | — | |
| Dropdown menu open (plain) | `/settings/power`, settings §4.6 BODY (Cancel only) | `set_dropdown_open` | `prim_set_dropdown_open_after` | 52 ctl, 0 | current value = white pill |
| Dropdown menu open (rich, scrolling) | `/settings/system`, Timezone (§4.6) | `set_dropdown_rich` | `prim_set_dropdown_rich_after` | 150 ctl, 0 | rich labels dark on the white pill |
| Dialog: text input (hostname) | `/settings/system`, §5 hostname BODY | `set_dlg_hostname` | `prim_set_dlg_hostname_after` | 0 | Change & Restart never pressed |
| Dialog: field + toggle, disabled primary (proxy) | `/settings/internet`, §5 proxy BODY | `set_dlg_proxy` | `prim_set_dlg_proxy_after` | 0 | |
| Dialog: info rows, row Primary (network) | `/settings/internet`, §5 network BODY | `set_dlg_network` | `prim_set_dlg_network_after` | 0 (after fixes) | Disconnect never pressed |
| Dialog: explainer (single Primary) | `/settings/display`, §5 explainer BODY | `set_dlg_explainer` | `prim_set_dlg_explainer_after` | 0 | |
| Dialog: tall scrolling list (keyboards) | `/settings/keyboard`, §5 Edit BODY | `set_dlg_keyboards` | `prim_set_dlg_keyboards_after` | 0 | |
| Dialog: PIN | `/settings/remoteplay`, §5 Set PIN BODY | `set_dlg_pin` | `prim_set_dlg_pin_after` | 0 | |
| Dialog: recording quality (dropdown + table) | `/settings/gamerecording`, §5 High BODY | `set_dlg_recquality` | `prim_set_dlg_recquality_after` | 0 (after fixes) | |
| Dialog: add game (disabled Primary) | `/settings/library`, §5 Add game BODY | `set_dlg_addgame` | `prim_set_dlg_addgame_after` | 0 | |
| Synthetic CONFIRM | shell §0.2 CONFIRM | `shell_modal_confirm_before` | `prim_modal_confirm_after` | 0 in the dialog (9 library-home CONTRAST lines, not primitives: same 9 on `/library/home` with no modal) | OK tinted, ring |
| Synthetic ALERT | ALERT | `shell_modal_alert_before` | `prim_modal_alert_after` | same as above | |
| Synthetic MENU (all item states) | MENU | `shell_contextmenu_before` | `prim_menu_after` | same as above | frosted scrim |
| Menu focus on Positive / Emphasis / Destructive | MENU + `await L.pad('down',3|4|5)` | `prim_menu_focus_down5_before` | `prim_menu_focus_down3/4/5_after`, `prim_menu_focus_tones_after` | — | whole-row tints on focus |
| Synthetic SUBMENU | SUBMENU | `shell_contextmenu_submenu_before` | `prim_submenu_after` | same as above | parent = white pill |
| Power menu chrome (look only) | POWER | `shell_powermenu_before` | `prim_power_after` | same as above | no item selected, ever |
| ZOO Text Prompt | ZOO('Text Prompt') | `shell_modal_textprompt_before` | `prim_zoo_textprompt_after` | 53 ctl, 0 | |
| ZOO Scroll Panel (FocusRing) | ZOO('Scroll Panel Test') | `shell_modal_scrollpanel_before` | `prim_zoo_scrollpanel_after` | 56 ctl, 0 | custom content now on a sheet |
| ZOO Non-Interactive | ZOO('Non-Interactive Dialog') | `shell_modal_noninteractive_before` | `prim_zoo_noninteractive_after` | 52 ctl, 0 | |
| ZOO Longboi menu | ZOO('Longboi (long title)') | `shell_contextmenu_long_before` | `prim_zoo_longmenu_after` | 63 ctl, 0 | |
| Game Manage menu / Play from menu (shared chrome) | appdetails §4 / §4.1 reach | `appdetails_manage_menu`, `appdetails_playfrom_menu` | `prim_appdetails_manage_menu_after`, `prim_appdetails_playfrom_after` | — | check glyph follows label |
| Game properties (field rows, dropdown, checkbox) | `/app/620980/properties/general`, `/compatibility` | `appdetails_props_*` | `prim_props_general_after`, `prim_props_compat_after` | 28 ctl, 0 each | |
| QAM (barpopup) toggles / sliders / buttons | bar §0.3 OPEN(`%{QuickAccessButton}`) + tab click | `bar_qam_settings_before` | `prim_qam_settings_after`, `prim_qam_perf_after`, `prim_qam_help_after`, `prim_qam_combo` | barpopup 24 ctl, 0 | Classic rows left to the bar owner |
| Volume HUD slider | hud §2 safe trigger | `hud_volume_before` | `prim_hud_volume_after` | — | generic slider look; HUD owner refines the slab |

Every audit above reported 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE and no CONTRAST line from primitives. Two CONTRAST lines found on the way were fixed: the network dialog's `.DialogControlsSectionHeader` (Steam's `.BasicUI` rule out-ranked mine; now `--lgs-text-2`) and Game Recording's `%{AutoExplainer}` on the sheet (thick glass .78 + bottom-up sheen).

## Performance (`python glass.py perf main`)

| Route / state | theme off | theme on |
|---|---|---|
| `/settings/system` (3389px page) | 90 fps, median 11.1 ms, p95 11.3, 0 long | 90 fps, median 11.1, p95 11.3, 0 long |
| `/settings/notifications` | 90 fps, 0 long | 90 fps, 0 long |
| `/settings/keyboard` + tall layouts dialog open (scrolls `ModalPosition` under a blurred sheet) | 90 fps, worst 11.7 ms, 0 long | 90.2 fps, worst 13.2 ms, 0 long |
| Timezone dropdown open (5026px thick-glass menu, frosted scrim), custom rAF scroll of the menu column | — | 90 fps, median 11.1, p95 11.3, worst 13.0, 0 long |

No animated filters, no infinite animations added. Backdrop filters added only on floating sheets/menus and the menu scrim.

## Not styled / limits (and why)

- **Laser `:hover` and `:active` states** are defined (fills, tints, Steam's own press scale) but cannot be captured: synthetic events do not set CSS `:hover`.
- **Bare `<textarea class="Focusable">`** (zoo "Text Area" demo) stays stock: it carries no Steam class, and a generic `textarea` rule would reach the chat composer (social area).
- **Classic field rows** (`%{*GamepadDialogContent>Classic}`, QAM and bar popup lists) are deliberately excluded from the row/card/focus rules; the bar owner styles them (their focus is the `_2NVMb…` keyframe fill and needs !important). Controls inside them (toggles, sliders, buttons) do get the primitives.
- **The menu column's own backdrop blur** cannot reach the page: Steam's `BasicContextMenuContainer` runs a fill-mode-both opacity/transform entrance animation (not to be touched), which makes it a backdrop root. The frost comes from the menu scrim instead (`--lgs-menu-scrim-blur`).
- **Selected next to open-submenu parent**: two adjacent white pills touch (rows have no gap and margins are layout); only seen in the synthetic menu.
- **High Contrast / Reduce Motion** are covered through tokens only (not toggled live: changing settings is forbidden).
- `theme/defs.svg` not needed (no SVG filters used).

## Requests to other owners

See the structured result; summary:
1. shell: `will-change: opacity` on `%{MainNavMenuMainSplit}` lets preserve-3d page content (Home "Recent Games" header, WHAT'S NEW / FRIENDS / RECOMMENDED tab strip, library tab rows) escape the modal scrim and paint over modal menus and dialogs. Verified: removing it inline (`prim_diag_menu_nowillchange`) puts them back under the scrim. Drop it, or turn it off while a modal is open.
2. settings: `%{FakeContainer}` (Downloads "Game update timing" pseudo-row) should match the grouped card (`--lgs-fill-1`, `--lgs-r-card`); `%{BitRateTable}` -> well (`--lgs-fill-sunken`, `--lgs-r-row`); `%{AutoExplainer}` -> `--lgs-text-2`; `%{RecordingModeOption}` cards -> fill-1 / selected treatment.
3. appdetails: compat `DialogCheckbox_Container %{ThrobberContainer>Checkbox}` (rgba(59,63,72,.5) r3) -> `--lgs-fill-1` + `--lgs-r-card`.
4. library: `/library/home` shows 9 CONTRAST regressions (NO PLAYTIME YET, `%{Bytes}`, "Updated …") with no modal open.
5. hud: the volume HUD's `SliderTrackDark` now gets the generic fill-3 track + white fill; refine inside the HUD slab if wanted.
