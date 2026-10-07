# Settings concept: one visionOS Settings app for Steam and SteamVR

This is the Phase 2 concept for every Steam settings page and for SteamVR's own settings page:

- Steam: the 24 pages under `/settings/*`, plus Controller › Advanced.
- SteamVR: the `vr:systemui` page (frame page `system.settings`) with its 8 sections.

It builds on `docs/phase2/DESIGN2.md`, which is the design system. Numbers in this file follow DESIGN2 unless a line says why not. It serves the user's Phase 2 brief: the Frame's settings should feel like the visionOS Settings app, not like a Steam Deck page in a frame, and not like two different apps.

This is revision 2. It answers a critic's review (score 6). §14 lists every point of that review and what changed. The main changes:

- **Information architecture.** Long pages now use visionOS drill-down instead of a section bar.
- **Toolbar.** Steam's search becomes a magnifier circle, and an inline page title appears once the hero scrolls away.
- **Hero and ornament.** The page hero is compact (72 px). The generic Select/Back legend no longer shows.
- **Sidebar.** The selected row is clearly brighter than a hovered one. This is measured (§3.3).
- **Depth.** Everything is flat by default. Interactive pops wait behind a flag that only a wearer's check can turn on, and destructive dialogs never pop. Hole covers are now exact rects.
- **SteamVR's page.** It has Steam's window footprint, a Back circle, real switches and a bottom ornament. Its gamepad exit path was read from source.
- **VR Settings page.** It now shows Steam's real Quick Access components, measured on the device.
- **Value menus.** They are anchored to their capsule. Lists with more than 8 options become a list page.
- **New checks.** Modals in SteamVR's fixed-size panel get a fit test, and Storage's selection mode is mapped.

| Deliverable | Path |
|---|---|
| This concept | `docs/phase2/concepts/settings.md` |
| Acceptance sweep (sizes, type, outlines, column, rows at scroll 0, search circle, generic ornament) | `docs/phase2/concepts/settings-accept.js`. Live runs: §12.3 |
| Gamepad traversal (sidebar, pages, drill-down sub-views) | `docs/phase2/concepts/settings-pad.js` |
| Selection-contrast check (T-SEL) | `docs/phase2/concepts/settings-sel.py` |
| Mockups (kit at true size) | `docs/phase2/mockups/settings-*.html`. Shared files: `settings.css`, `settings-shared.js` (sidebar, toolbar and SteamVR sidebar builders) and `settings-icons.js` |
| Renders | `shots/p2_settings_*.png` (Appendix A) |
| Live captures made for this revision | `shots/p2_settings_live_vr_playarea.png`: SteamVR › Play Area as it renders today |

Shared chrome is owned by the shell concept `docs/phase2/concepts/window-nav.md` (**WN**): the toolbar row, the tab bar, the bottom ornament, the menu slab, alerts and sheets. This file uses WN's numbers and only adds what is specific to settings. The mockups draw that chrome with WN's own helper, `window-nav-shared.js`.

Evidence tags are as in DESIGN2: **[PROVEN]**, **[PLAUSIBLE]**, **[UNPROVEN]**, **[ours]**.

Capability citations use these short names:

| Short name | Document |
|---|---|
| **SP** | `capabilities/spatial.md` |
| **SR** | `capabilities/steam-react.md` |
| **E2E** | `capabilities/native-e2e.md` |
| **SY** | `audit/system.md` |
| **SN** | `audit/shell-nav.md` |
| **INV-S** | `inventory/settings.md` |
| **INV-VR** | `inventory/steamvr.md` |
| **MO** | `research/liquid-glass-motion.md` |

**SRC** marks a fact read for this concept from the live webpack sources of Steam or SteamVR. These reads are read-only source text: no module was executed. They are listed in Appendix B.

---

## 0. Summary

| Today | This concept |
|---|---|
| **Two settings apps.** Steam's uses the gamepad. SteamVR's is laser-only, with a different type scale, purple fills, ALL CAPS and a taller window. | **One Settings app.** Steam Settings gains a **VR Settings** page with Steam's own Quick Access VR controls and one row into SteamVR. SteamVR's page gets Steam's exact window footprint, the same sidebar, Back circle, title position, switches and platters. |
| **Long pages scroll for screens.** System is 4.6 screens (45 fields today, 25 of them read-only); Notifications has 144 focusables; Developer has 33 rows. | **visionOS drill-down.** Daily settings stay inline. Groups become "›" rows that open a sub-view, with a Back circle and the title inline in the toolbar. System is now 1.5 screens, Notifications 1.4 and Developer 1.0 (screens of 720 px, the audit's unit). Nothing is moved or removed: sub-views show or hide Steam's own section nodes (§4.3). |
| **The toolbar.** Steam's game search, a 1172 × 40 field, sits in every settings header and reads like a settings search. | **A magnifier circle** at the trailing corner, with the same node and handler (WN's hero-route variant). **An inline page title** fades in when the hero scrolls under the edge; sub-views always show their title. |
| **The sidebar.** A 256 px column of 42 px grey rows with 3 hairlines. | **A 400 px sidebar** of 72 px rows at 80 px pitch, with coloured 40 px icon circles and groups separated by space. The **selected pill is brighter (white .26, specular top arc, Semibold) than any hovered row**: +12.9 luma in the bright room, +36.9 in the dim room (§3.3). |
| **Rows.** 952 px wide, with the label at the far left and the control at the far right (a 25–28° sweep). | **760 px recessed platters** with 80 px rows. Label to control is about 20°. |
| **Small controls.** 38 × 22 toggles, 6 px slider tracks, 22 px checkboxes, 40 px dropdowns, 12 px descriptions. | **visionOS sizes.** Switches are 66 × 40. Volume and microphone use Control Center capsule sliders (64 px). Checkboxes are 40 px check circles. Dropdowns are 60 px value capsules. Descriptions are 20 px. |
| **Dropdowns** open a centred list on an 85 % black scrim. | **A menu slab grown out of its capsule**, right-aligned to it, below or above it, or over it. **More than 8 options** show as a **list page** over the detail pane: the visionOS Time Zone pattern, using Steam's same menu nodes. |
| **Dialogs** are a flat card with a 2 px border on an 85 % scrim. | **visionOS alerts and sheets**, with thick glass and radius 44. They stay **flat at depth 0 until the wearer check**. Steam's own scrim is restyled to .35. |
| **The legend.** "A Select / B Back" shows under every page. | **The bottom ornament appears only for page-specific actions**: Uninstall and Move Content, More Info, a slider's "Done". It holds them as real buttons. |
| **Destructive buttons** look like every other button. | **Red label at rest, red fill on focus.** They are never popped in depth. Steam's own confirmation always follows. |

Renders:

- System: `p2_settings_system.png` (root view), `_dim` (dim room) and `_t1` (CSS-only fallback).
- Drill-down: `p2_settings_update.png` (a sub-view with gamepad on Apply) and `p2_settings_advanced.png` (destructive).
- Dialogs and menus: `p2_settings_dialog.png` (flat alert), `p2_settings_dropdown.png` (menu over its capsule) and `p2_settings_timezone.png` (list page).
- Other pages: `p2_settings_audio.png` (inline title, contextual ornament), `p2_settings_notifications.png` (root) and `_sub.png` (delivery matrix), `p2_settings_storage.png` (selection mode).
- VR: `p2_settings_vr.png` (the VR Settings page as it ships) and `p2_settings_vr_tiles.png` (after P-S3).
- SteamVR: `p2_settings_steamvr.png` (General) and `p2_settings_steamvr_playarea.png` (the Environment Style block at the new size).

---

## 1. The experience

1. **Arriving.** The user points at the gear in the tab-bar ornament beside the window (Steam's frame menu, DESIGN2 §3.3), or presses Left at a page edge and picks Settings with the D-pad. The window's content cross-fades to Settings. The window keeps its place and size.
2. **Orientation.**
   - The left third of the window is the sidebar: a slightly darker tone of the same glass, with no line between the panes.
   - Its top row holds a circular Back, concentric with the window corner, and the Large Title "Settings".
   - Below are the pages, each a row with a coloured circle icon: grey System, blue Internet, grey Storage, blue Bluetooth; a gap; purple VR Settings; a gap; Display, Power, Audio and so on.
   - The current page is the brightest pill, with a thin specular arc on its top edge and a Semibold label. A row under the laser only gets a soft light. If a system update is waiting, System carries a red count badge.
3. **Reading a page.**
   - The right two thirds show the page. A compact header sits at the top: the page's coloured circle and its title on one line.
   - Steam's game search has shrunk to a magnifier circle in the top-right corner. It still opens Steam's search.
   - Settings sit in recessed rounded platters 760 px wide, label left and control right, 80 px per row.
   - When the user scrolls, the header slides under the top edge and the title fades into the centre of the toolbar row, as in visionOS.
4. **Going deeper.**
   - Groups of settings are rows ending in "›", sometimes with a value: "Updates · 1 · Update available", "SteamOS Crash Report · On", "Advanced".
   - Choosing one replaces the page with that group. Content fades in from 16 px to the right, the group's title appears centred in the toolbar, and a Back circle appears at the top-left of the detail pane.
   - Back or B returns, with focus on the row the user came from.
   - System › About holds the 25 read-only facts. System › Advanced holds the destructive tools.
5. **Changing something.**
   - A switch is a visionOS switch.
   - A choice is a capsule showing its value. Clicking it grows a glass menu out of the capsule, aligned to its right edge, with the current value checked.
   - A long choice (Timezone, Language) opens as a list page over the detail pane, with Cancel at the top-left.
   - Volume and microphone are Control Center capsule sliders.
   - Notification delivery is a grid of check circles under "Email · Toast · Mobile · Feed".
6. **Danger.**
   - Factory Reset, Format SD, Delete Web Browser Data, Unpair and similar actions show a red label, and fill red when focused.
   - Steam's own confirmation always follows, as a glass alert over the window dimmed to 35 %. It stays on the window plane.
7. **VR settings.**
   - The VR Settings page shows one row, "SteamVR ›", with a laser glyph. Below it are Steam's own VR controls: Refresh Rate as a notched slider, Motion Smoothing, and the performance overlay and recordings. These are the same components as Quick Access.
   - Choosing SteamVR switches the window to SteamVR's settings page at **exactly the same footprint**. It shows a "SteamVR" Large Title beside a Back circle where "Settings" was, the same sidebar of coloured circles, switches instead of Off/On pills, and the Advanced Settings toggle as an ornament under the window.
   - Back returns to Steam's VR Settings page. With a gamepad, D-pad Left reaches the tab bar (§4.12).
8. **Gamepad.**
   - Up/Down in the sidebar moves through pages, and each step shows that page.
   - Right goes into the page and Up/Down moves through rows.
   - A on a "›" row opens it, and B returns.
   - Left from a page goes to the sidebar, and B from the sidebar leaves Settings.
   - Focus is light from inside the control (DESIGN2 §10), never a ring. The focused row always stays between the toolbar row and the window's bottom edge.

---

## 2. Is today's UI right for VR? Verdicts per screen

Sizes are main-window px at 0.0307°/px (DESIGN2 §2). "Target" is the visionOS 60 pt minimum: 80 px.

| Screen | Verdict | Why (measured, SY §B unless noted) | Redesign |
|---|---|---|---|
| Sidebar | **Not optimal** | Rows are 42 px (1.29°, 52 % of the target) with grey glyphs and 3 hairlines. Selection follows focus with a 320 ms slide of a 38° surface on every D-pad step | 72/80 px rows, colour circles, groups separated by space, a selection that clearly outranks hover, a cross-fade instead of a slide (§3.3, §7) |
| Information architecture of long pages (System, Notifications, Developer, Friends & Chat, Keyboard, Game Recording) | **Not optimal** | System is 3,282 px (4.6 screens; 45 fields live on 2026-10-07). It mixes daily settings, 25 read-only rows and destructive tools. Notifications has 144 focusables. At visionOS sizes these pages would roughly double | **Drill-down**: daily settings inline, groups as "›" rows that open sub-views (§4.3) |
| Toolbar on settings routes | **Not optimal** | Steam's game search (1172 × 40) sits where visionOS Settings shows the page title, and invites the user to search settings | Magnifier circle plus inline title (§3.4) |
| Page layout (all pages) | **Not optimal** | 952 px rows give a 25–28° label-to-control sweep. Descriptions are 12 px (0.37°). Rows are lighter than the glass (inverted polarity) | 760 px recessed platters, 24/20 px type, compact hero (§3.5) |
| Toggles, sliders, checkboxes, segmented controls | **Not optimal** | Toggles 0.68°, slider tracks 0.18°, checkboxes 0.68°, segments 0.98° | visionOS sizes (§3.6) |
| Dropdown menu | **Not optimal** | Centred 48 px rows on an 85 % black scrim, disconnected from the control that opened it. Timezone has 64 options in about 5 visible rows | A slab anchored to the capsule, or a list page for more than 8 options (§4.5) |
| Dialogs | **Not optimal** | 40 px buttons, an 85 % scrim, a square card with a 2 px border | Alert or sheet (§4.6) |
| Legend under every page | **Not optimal** | "A Select / B Back" is a console hint, not a visionOS element. It takes the window's bottom edge on every page | Shown only for page-specific actions (§4.11) |
| Storage | **Partly** | The layout is fine, but rows are 58 px virtualised (1.78°). Uninstall and Move Content are footer legends only, and the selection mode was never mapped | Ornament buttons, check circles in selection mode, rows 80 px through T3 or kept at 58 px (§4.8, §4.13) |
| Notifications matrix | **Not optimal** | 22 px checkboxes at 60 px pitch, 10 px uppercase column labels, an italic "Notify me via" | Check circles at 80 px pitch, 18 px title-case headers, inside sub-views (§4.8) |
| SteamVR Settings | **Not optimal** | It is a second app: a different type scale, ALL CAPS buttons, purple fills, no title, Off/On pills, 1.3–1.8° controls, laser-only. Its window is 720 px tall where Steam's glass is 656 | Same footprint, same anatomy and vocabulary at ×1.44, real switches, a Back circle (§4.10) |
| Two "Settings" items in the tab bar (Steam Settings, VR Settings) | **Acceptable, kept** | They are two real paths. The user may hide the VR one (SteamVR "Show VR Settings") | Both stay; Steam Settings now also contains VR Settings |

---

## 3. Geometry and sizes

### 3.1 Units

- 1 visionOS pt = 4/3 main px (DESIGN2 §2.1).
- 1 main px = 0.766 mm = 0.0307° at r = 1.
- SteamVR's settings panel (1858 × 1045) is shown by the dashboard frame at the size of Steam's 1280 × 720 overlay. Its footprint therefore uses **1.4516 SteamVR px per main px** (1858 / 1280; 1045 / 720 = 1.4514).
- Element sizes on SteamVR's page use DESIGN2's m = 1.44 (§2.5). The 0.8 % difference is invisible.

### 3.2 The window (`p2_settings_system.png`)

| Element | px | pt | ° | Notes |
|---|---|---|---|---|
| Overlay | 1280 × 720 | 960 × 540 | 39.3 × 22.1 | Steam's, fixed |
| Window glass | 1280 × 656, radius 54 | 960 × 492, r 40.5 | 39.3 × 20.1 | WN §3.1. The 64 px margin below holds the bottom ornament when one is shown (§4.11). The glass height never changes with the ornament |
| Sidebar | x 0–400, full glass height | 300 | 12.3 | Steam's `PagedSettingsDialog_PageListColumn`, fill black .14, no line |
| Detail pane | x 400–1280 (880) | 660 | 27.0 | Steam's `PagedSettingDialog_ContentColumn`, transparent (window glass) |
| Content column | 760 wide, centred: x 460–1220 | 570 | 23.3 | Steam's `DialogContent_InnerWidth` with `max-width: 760px; margin-inline: auto` |
| Toolbar row | y 0–108 | 81 | 3.3 | Steam's `#header` at 108 px (DESIGN2 §3.2; needs CQ1) |
| Band where focus may sit | y 108–628 (520 px) | 390 | 16.0 | WN's modal box and AT-2 band |

### 3.3 Sidebar

| Element | Value |
|---|---|
| Back | A 60 px (45 pt) circle at (24, 24) with a 28 px chevron. Hit box 80 × 80 (60 pt) at (14, 14). This is Steam's `%{BackContainer}`, nested-page style with a thin fill (WN §3.2) |
| Title | "Settings", Large Title 46 px (34.5 pt) Bold at x 100, vertically centred on the Back circle (y 24–84). The text is Steam's localised `#MainTabsSettings`, written by T2 into an attribute and drawn by `::before` |
| List | Starts at y 108. It scrolls under a 46 px top fade (DESIGN2 §6.7) and a 72 px bottom fade |
| Row | 72 px (54 pt) tall and 8 px (6 pt) apart, so 80 px (60 pt) pitch = 2.46°. x 16–384 (368 px = 276 pt). Capsule (radius 36), padding 0 16 px |
| Icon circle | 40 px (30 pt), colour fill with a 24 % top sheen, white glyph 22 px, stroke ≥ 2.3 px |
| Label | Body 24 px (18 pt) Medium, white .96, one line, ellipsis |
| Trailing | A red count badge, 30 px with 18 px Semibold text, on System when an update is available. T2 reads the same state that shows Steam's "!" in the Updates section |
| Group gap | 24 px (18 pt). Steam's three separators become transparent 16 px spacers, plus the row's 8 px margin |
| **Selected** (current page) | **White .26 fill, a 1.5 px specular top arc (conic gradient from the key light, fading to nothing at the sides), label Semibold 600, shadow 0 4 12 black .14.** No scale. Steam's `ScaledChildren` 1.1 transform stays Steam's and is not reinforced |
| **Hover** (laser, unselected) | **+ white .03 and a light spot of .07 (radius 55 %) at the pointer.** The cap keeps a hovered row below the selected one in every room (T-SEL) |
| Hover on the selected row | + .02 and the spot |
| Gamepad focus | In Steam's sidebar, focus and selection are the same row. Focus look = selected look + .06 and a spot fixed in the upper third |

**T-SEL, measured on the renders** (`docs/phase2/concepts/settings-sel.py`). The test compares the mean luma of the pill interior to the right of the label, excluding SteamVR's laser dot (16 px radius):

| Render | Selected | Hovered | Unlit row | Difference |
|---|---|---|---|---|
| Bright lounge (`p2_settings_system.png`) | 115.0 | 102.1 | 90.2 | **+12.9** |
| Dim studio (`_dim`) | 121.2 | 84.2 | 64.5 | **+36.9** |
| T1 fallback (`_t1`) | 99.5 | 72.2 | 60.7 | **+27.3** |

The pass mark is +12 in all three. The first iteration of this revision used white .24 with hover + .05 and a .09 spot. It measured −0.4, because the room behind the hovered row was brighter. That is why the hover light is capped and the selection is .26.

This deviates from DESIGN2 D6 (navigation selection white .18). A sidebar pill sits over a recessed, darker column, so .18 does not outrank the hover light there. Reported to the DESIGN2 owner as a token change, `--lgs-nav-selected-sidebar: .26`.

Groups, in Steam's order, with the new VR Settings group inserted after the first:

| Group | Pages (icon colour) |
|---|---|
| 1 | System (grey, gear), Internet (blue, wifi), Storage (grey, drive), Bluetooth (blue, bluetooth) |
| new | **VR Settings** (purple, headset) |
| 2 | Display (blue, display), Power (green, bolt), Audio (pink, speaker), Controller (orange, controller), Keyboard (grey, keyboard), Accessibility (blue, accessibility), Security (blue, lock) |
| 3 | Notifications (red, bell), Friends & Chat (green, people), Downloads (teal, arrow), Cloud (blue, cloud), In Game (indigo, overlay), Compatibility (purple, wrench), Family (orange, house), Remote Play (purple, screen and waves), Game Recording (red, record) |
| 4 | Home (indigo, house), Library (orange, books), Store (blue, bag), Developer (grey, hammer) |

Colours follow visionOS and iOS Settings conventions. They are keyed by page route, not by text, so they work in every language.

### 3.4 Toolbar row (settings routes)

The row is 108 px tall with no band, like WN §3.2. Settings splits it into the sidebar's part and the detail pane's part.

| Element | Where | Value |
|---|---|---|
| Back (leave Settings) | Sidebar part | (24, 24), §3.3 |
| "Settings" Large Title | Sidebar part | §3.3 |
| **Steam's search, collapsed** | Detail part, trailing corner | A **60 px (45 pt) magnifier circle at (1196, 24)**: thin fill white .10, glyph 26 px white .70. Its hit box is Steam's `%{SearchAndTitleContainer}` at **80 × 80 at (1186, 14)**. This is WN's hero-route variant (WN §3.2, gated by WN AT-4: "SHRUNK only where the new hit box is ≥ 80 px tall"). The node and handler are the same: a click focuses Steam's input and opens Steam's search, which then expands to WN's 640 px capsule. If WN AT-4 flags it, the fallback is WN's 640 × 64 capsule centred over the detail pane |
| **Inline title** | Detail part, centre | Title 2, 30 px (22.5 pt) Bold, white .96, centred over the detail pane (x 840), y 35–73, max width 680 px with an ellipsis. It is a T2 decorative node (`aria-hidden`) holding Steam's own text: the page's `DialogHeader` on a root view, or the drill-down row's label in a sub-view |
| Inline title visibility | | **Root view:** opacity is scroll-linked to the hero. It is 0 while the hero's bottom is below y 124 and 1 once it is above y 100 (DESIGN2 scroll-edge rule: scroll-linked over 24 px). **Sub-view:** always 1. **Storage:** always 1, because it has no hero |
| **Back (sub-view)** | Detail part, leading | A 60 px circle at (424, 24), with an 80 × 80 hit box at (414, 14) and a 28 px chevron. It is rendered by our drill-down wrapper (§4.3) `position: sticky` at the top of the page scroller, so it sits in the toolbar row. It is **laser-only, and B is the gamepad path**, like WN's Back. It is not a Focusable, so entering a sub-view focuses its first row |
| **Cancel (list page)** | Detail part, leading | Steam's menu Cancel item as a 60 px text capsule at (424, 24) (§4.5) |
| Everything else | — | Nothing. Content scrolls under the row behind WN's 124 px scroll-edge band |

Why a circle and not a capsule:

- visionOS Settings shows the page title in that place (ref 8, references.md B.8), and its settings search sits at the top of the sidebar.
- Steam's field searches games and profiles, not settings. A capsule in the title's place reads as a settings search.

Open question Q1 adds a settings search at the top of the sidebar once a static settings index exists.

### 3.5 Detail pane

| Element | Value |
|---|---|
| Top padding | Content starts at y 116 (87 pt): toolbar 108 + 8 |
| **Compact hero** (root views except Storage) | A 56 px (42 pt) colour circle with a 32 px glyph, and the page title in Title 1 38 px (28.5 pt) Bold, **on one line, centred**, 56 px tall, with 16 px below. **72 px in total** (DESIGN2 rule 2; the critic's limit was 96). The title is Steam's `.DialogHeader` laid out as a row; the circle is its `::before`, keyed by a T2 `data-lgs-page` attribute |
| Section header | Callout 22 px (16.5 pt) Semibold, white .70, at x +24 from the platter edge. **A 60 px block**: 24 above, a 26 px line, 10 below. The first header directly under the hero has no top margin (36 px block) |
| Gap between platters without a header | 20 px |
| Platter | Recessed black .14, radius 30 px (22.5 pt; 54 − 24), the full column width of 760 px (570 pt) |
| Row | 80 px (60 pt, 2.46°). Two-line rows are 104 px (78 pt). Capsule-slider rows are 96 px; notched-slider rows are 160 px. Padding 0 24 px. Label Body 24 px (18 pt) Medium. Description Subheadline 20 px (15 pt) Medium white .70, 4 px under the label |
| Separators | 2 px white .08 between rows, inset 24 px on both sides, none at the platter ends |
| Footer text | Subheadline 20 px white .70, 12 px under a platter, at x +24 |
| Scroll edges | Top: content fades from y 92 to 124 under the toolbar row. Bottom: over the last **48 px** of the glass with no ornament, or the last **96 px** when the ornament is shown. A focused row always stays above y 628 |

**Vertical budget at scroll 0.** Rows fully inside y 108–628 (T-ROWS):

| Root view | Rows fully in the band | Height | Chrome share of the band |
|---|---|---|---|
| System | About, Updates, Select preferred language, 24-hour clock (two-line) | 344 px | 34 % |
| Notifications | Show Notification Toasts (two-line), Play a sound, Client ›, Friend › | 344 px | 34 % |
| Power | Battery Percentage (two-line), Dim display after, Sleep after | 264 px | 49 % (passes on area) |
| VR Settings | SteamVR ›, Refresh Rate (160), Motion Smoothing | 320 px | 38 % |
| Accessibility | 4 two-line rows | 416 px | 20 % |
| Previous revision, System | Language, Software Updates | 184 px | 65 % |

The pass rule is "≥ 4 rows, or rows covering ≥ 260 px (half the band), or every row of a short page". Pages that open with two-line or slider rows carry the same content in fewer rows. The rule's purpose is the chrome share, and the area clause measures that directly.

### 3.6 Row and control catalogue

All values are main px. "Hit" is what the laser can click. "Steam node" is what is restyled, never replaced.

| Control | Visible | Hit | Steam node | Look |
|---|---|---|---|---|
| Switch | 66 × 40 px = 50 × 30 pt (Steam's 38 × 22 at `scale: 1.75`) | 86 × 78 (a transparent `::before` hit extender, `inset: -11px -6px` before scale) | `%{*GamepadDialogContent>Toggle}` | Off: white .16 track, white knob with a shadow. On: green whole-fill track. Disabled: 40 % |
| **Drill-down row** (new, T3) | 80 px row, full platter width | the row | ours, `Focusable` with `onActivate` | Label Body 24 px; trailing value (Callout 22 px white .70) or a red badge; chevron 22 px white .50 |
| Value capsule (dropdown) | 60 px (45 pt) tall, ≥ 250 px wide, radius 30 | button 60 tall, plus a `::before` extender to 80 | `%{DropDownControlButton}` | Thin fill (white .10); value 22 px Medium white; up/down chevrons 22 px white .70. **White fill and dark label while its menu is open** |
| Rich value (Timezone) | 72 tall, two lines (20 px + 18 px) | same | same | Same |
| Text button | 60 px (45 pt) tall, padding 24, Headline 24 px (18 pt) Semibold | 80 (extender) | `button.DialogButton` | Thin fill. The primary is tinted blue (one per page). Destructive: red label at rest (§4.7) |
| Icon button (keyboard preview, built-in layout) | 60 px (45 pt) circle | 80 | `%{ShowKeyboardButton}`, `%{BuiltInLayoutButton}` | Thin fill |
| Capsule slider (Volume, Microphone) | 64 px (48 pt) tall, the row width minus the 76 px value | 96 px row (track padding) | `S>SliderControlAndNotches` group | Recessed track (black .30 with an inner shadow). The value is a white .86 fill from the leading edge (Steam's `SliderTrack::before`, recoloured), at least 64 wide so the glyph always sits on white. Steam's speaker or mic `FieldIcon` sits inside the fill's leading end, dark. The knob (Steam's `SliderHandle`, 60 px white) shows only on hover, focus or drag. The value "62%" is 22 px Semibold white .70 tabular (T2 decorative, from `--normalized-slider-value`) |
| **Notched slider** (Quick Access Refresh Rate) | Label and value on one line; a 64 px capsule track below; bookend labels 18 px under its ends | 160 px row | Steam's QAM `o.k` slider (module 862, `showValue`, `showBookendLabels`, `rValues` = the available rates) | Same capsule look. Fill to the current notch. The value (e.g. "90") is right-aligned on the label line in Callout Semibold white, as Steam renders it |
| Segmented control (Flash window, Chat Font Size) | 64 px (48 pt) track, segments ≥ 140 px (105 pt) wide, 4 px apart | segment | `%{Group}` / `%{Group>Button}` | Recessed track. The selected segment is white with a dark label |
| Check circle (Notifications matrix, Storage selection) | 40 px (30 pt) circle | an 80 × 80 cell (column pitch 80) | `.DialogCheckbox`; Storage: the `%{AppSelected}` checkbox | Off: a black .30 well with a 2.5 px white .28 inner rim. On: blue whole fill and a white check (stroke 3). Disabled 40 % |
| Selection list (Game Recording mode) | rows 96–104 tall (title + description) | row | `%{RecordingModeOption}` | A row in a platter with a leading 32 px radio circle: blue fill and white check when selected. No card borders |
| Text field | 64 px (48 pt) capsule | 80 | `G>BasicTextInput` | Recessed (black .30), 24 px text. Focus ring 3 px white .55 plus a 16 px glow (the only ring) |
| Read-only value | text | the row (Steam's rows are focusable `G>Clickable`) | `G>LabelFieldValue` | Callout 22 px white .70, right-aligned, tabular |
| Clickable row (network, device, layout) | 80 px row | row | `G>Field G>Clickable` | A trailing chevron 22 px white .50 when it opens something (T2 tag) |
| Two switches per row (Notifications) | two 66 × 40 switches in 120 px columns | each switch 86 × 78 | `%{Toggles}` with two `G>Toggle` | Column headers "Show Toast" and "Play Sound" in 18 px Semibold title case above the platter |
| Drive tabs (Storage) | 64 px segmented track, segments ≥ 290 wide | segment | `%{InstallFolder}` | The selected drive is white |
| **List-page row** (long menus, §4.5) | 80 px, with a 28 px leading check slot | row | Steam's `MenuItem` | Label 24 px, trailing secondary text 22 px white .70 if the option has one |

### 3.7 Hit regions and spacing

- Every focusable target is ≥ 80 px in its limiting direction. Where Steam fixes the geometry the floor is ≥ 72 px. The one documented exception is the virtualised Storage rows at 58 px if T3 fails (§4.8).
- Hit extenders are transparent pseudo-elements on free pseudo slots: `G>Toggle::before`, `button.DialogButton::before`, `.DialogCheckbox::before` (INV-S §6 lists them free).
  - They are the one place our pseudo-elements take pointer events. A click on them is a click on the control itself: same element, same handler.
  - Each control is verified with an `elementFromPoint` sweep (T-HIT).
- Neighbouring hit regions never overlap: switch columns are 120 px apart, check-circle columns 80 px.

---

## 4. Screens and states

### 4.1 A root view at rest (`p2_settings_system.png`)

Route `/settings/system`, root view, scroll 0, laser on the Internet row.

| y (main px) | Content |
|---|---|
| 0–108 | Toolbar row: Back and "Settings" in the sidebar; the magnifier circle at the trailing corner; no title yet (the hero is the title) |
| 116–172 | Hero: grey gear circle and "System" |
| 188–348 | **Platter (ours, top slot):** About › (trailing: the hostname, "steamframe"); Updates › (trailing: red "1" and "Update available"; "Up to date" when there is none) |
| 368–448 | **Steam's inline:** Select preferred language, with the "English" capsule |
| 448–508 | Header "System Settings" (Steam's) |
| 508–852 | **Steam's inline:** 24-hour clock (two-line), Timezone (rich capsule), Default to Desktop Mode on startup, Enable Developer Mode |
| 872–1032 | **Platter (ours, bottom slot):** SteamOS Crash Report › (trailing "On" / "Off" from its first switch); Advanced › |

The page is about 1,072 px tall (1.5 screens of 720 px), against 3,282 px (4.6) today. Depth: everything is at 0, and the tab bar is at +25 mm (§5). Material: window glass (T5 `window`). The sidebar and the platters are fills inside it. No bottom ornament (§4.11).

### 4.2 Sidebar states

| State | Look | Trigger |
|---|---|---|
| Rest | Transparent row, colour circle, white label | — |
| Selected (current page) | §3.3: white .26 pill, specular top arc, Semibold | Steam's `P>Active` |
| Laser hover | + white .03 and a .07 light spot at the pointer (`--hx/--hy` from a T2 `pointermove`) | `:hover` |
| Gamepad focus (= selection) | Selected + .06 and a spot fixed in the upper third, with ≥ 60 % of the final contrast on the first frame | Steam's `:focus` / `.gpfocus` on the item, with `!important` because Steam paints focus with a `forwards` animation (INV-S §2) |
| Focus = selection | Selection follows focus (Steam's behaviour, kept). Each D-pad step selects that page and resets it to its root view | — |
| Scrolled | A 46 px top fade under the title row and a 72 px bottom fade | Steam's `PagedSettingsDialog_PageList` scroller (overflow unchanged, `scroll-snap` kept) |
| Disabled page | 40 % (none seen live) | `P>DisabledItem` |

### 4.3 Information architecture: drill-down

This is the main change of this revision. The previous section bar is withdrawn (§14, issue 1).

**Pattern.** visionOS Settings, and Steam's own Controller › Advanced:

- A page's root view shows its everyday settings inline and its groups as "›" rows.
- A row opens a **sub-view** that shows one or more of Steam's own sections.
- The sidebar keeps the page selected.
- The detail toolbar shows a Back circle and the sub-view's title.

**Mechanism.** It uses T3 (P-S1) plus T1/T2, and moves or removes no Steam node.

1. **The wrapper.** P-S1 wraps each page object's `content` in our `LgsPage` component. It renders, in DOM order:
   - our **top slot** (drill-down rows shown before Steam's content);
   - Steam's `content`, unchanged;
   - our **bottom slot** (drill-down rows after it).
   
   The wrapper's root element carries `data-lgs-view="root"` or the key of the open sub-view.
2. **Tagging.** After mount, T2 tags each child of Steam's content container with `data-lgs-sec="<key>"`.
   - Nodes from one `.SettingsDialogSubHeader` up to the next belong to that header's section.
   - Nodes before the first header belong to the unheaded first group.
   - A static per-route table maps each section to `root` (inline) or to a sub-view key.
   - A `MutationObserver` re-tags nodes that Steam adds later: conditional rows such as the Downloads bandwidth input, or the Family notification rows.
3. **Visibility.** CSS shows only the nodes of the current view: `[data-lgs-view=K] [data-lgs-sec]:not([data-lgs-sec=K]) { display: none }`. In a sub-view the top and bottom slots are hidden too. The first section header of a sub-view is shown in the inline title instead; its node gets `height: 0; opacity: 0` (a documented text-moved exception for T-AUD).
4. **Order constraint.** Our rows can only come before or after Steam's content, because D-pad order follows DOM order and focusable siblings may not be reordered with `order` (DESIGN2 §12). The per-route table therefore keeps inline only those sections that read well in that order.
5. **Entering a sub-view.** A on a drill-down row, or a click, sets the view.
   - Content fades in on the `page` token (§7).
   - The wrapper's root Focusable takes focus (`navRef.current.TakeFocus()`, SR §3.6). Steam then picks the first visible focusable, the sub-view's first row, because the Back circle is not a Focusable.
6. **Leaving.**
   - The Back circle, or B: the wrapper's `onCancel` handles B only in a sub-view. It sets the view to `root` and calls `TakeFocus()` on the drill-down row's `navRef`. In the root view, B is not handled, so Steam's own B applies (to the sidebar, or leave Settings).
   - Choosing another sidebar page also resets the view to root.
7. **Test API.** For agents, the wrapper exposes `window.__LGS_SET = { view(key), back(), remove() }` in SharedJSContext. `back()` is the same function `onCancel` calls; `remove()` is part of `lgs off` (T-T3).
8. **Routes and deep links.** Sub-views do not change Steam's route (it stays `/settings/system`) or Steam's back stack. A deep link into a page lands on its root view; the drill-down row carries the badge or value that drew the user there.

**Per-route table.** All labels are Steam's own section header text, localised.

| Page | Inline at the root | Drill-down rows (slot) | Root length |
|---|---|---|---|
| System | Select preferred language (unheaded group); System Settings (24-hour clock, Timezone, Desktop Mode, Developer Mode) | **About ›** = About + SteamVR + Steam + Hardware: Hostname, 24 read-only rows, Third-Party Licenses (top). **Updates ›** = Updates + Beta Participation; trailing badge and value (top). **SteamOS Crash Report ›**, trailing On/Off (bottom). **Advanced ›** (bottom) | ≈ 1,072 px (1.5 screens; today 3,282 px, 4.6) |
| Notifications | Show Notification Toasts, Play a sound (unheaded group) | Client Notifications ›, Friend Notifications › (with Flash window), Store News ›, Personal Activity ›, Wishlist Activity ›, Steam Family Activity › (only when Steam renders it), Developer / Game News ›, **Email Opt-out ›** with its switch state as the trailing value (all bottom) | ≈ 1,010 px (1.4 screens; today 144 focusables inline) |
| Developer | — | Profiling ›, Development Kit ›, Steam Play ›, Wi-Fi ›, Miscellaneous ›, Steam Input › (bottom) | ≈ 710 px (1.0 screen; one row per section) |
| Friends & Chat | The 9 friends-list switches with Steam's preview friend (unheaded group) | Chat › (bottom) | ≈ 1,090 px (1.5) |
| Keyboard | Theme, Points Shop, Haptics, Initial Location × 2 (unheaded group); Active Keyboards | Quick Chat Options › (bottom) | ≈ 820 px (1.1) |
| Game Recording | The 3 mode rows and Learn More (unheaded group) | Shortcut Keys ›, Video Recording ›, Audio Recording › (bottom) | ≈ 700 px (1.0) |
| All other pages | Everything (single page) | — | ≤ 2.3 screens (Remote Play is the longest, about 1,650 px; its last section, Learn More, rules out a bottom slot) |

**Fallback if P-S1 or P-S4 fails.** The previous single long page, **without the hero**: the inline title is shown from the start, as on Storage. Rows keep every other change in this concept. The previous T3-only section bar is not a fallback.

### 4.4 Grouped rows (`p2_settings_audio.png`)

Audio, scrolled past its hero, with gamepad focus on the volume slider:

- **Toolbar:** "Audio" is centred inline (the hero has passed under the edge). The magnifier sits at the trailing corner.
- **"Output" platter:**
  - Volume capsule slider row (96 px). The knob shows because the slider is focused; the value is 62 %.
  - Output Device value capsule ("Steam Frame Speakers").
  - Spatialization, a two-line row with a switch.
- **"Apps" platter:** Steam's empty-state text as a single 80 px row in white .70.
- **"Voice" platter:** Microphone capsule slider (38 %) and Input Device.
- **Focus look:** the focused row shows the inset pill (white .14 plus the light spot) under its controls. The slider track brightens and gets a soft halo.
- **The ornament appears**, because the legend is page-specific: Steam's slider renames B to "Done" (§4.11).

### 4.5 Value menus (`p2_settings_dropdown.png`, `p2_settings_timezone.png`)

Steam's settings dropdowns are Steam's gamepad context menu, so the shell's menu slab applies (WN §5.1):

- thick glass, radius 32, padding 8;
- a 40 px header row inside the slab;
- 72 px rows with radius 24, 6 px apart, min width 320;
- Cancel as a 60 px capsule centred under the rows;
- no scrim;
- `morph-open` from the source;
- T2 anchoring with `translate`.

Settings adds the following.

**Up to 8 options: the slab grows out of its capsule.**

| Property | Value |
|---|---|
| Horizontal | **Right-aligned to the capsule:** the slab's right edge = the capsule's right edge + 8 px (the slab's padding), so its rows line up with the capsule. Width 320–440 px, 380 typical. The slab covers the trailing part of the rows around it. The labels on the left stay visible |
| Vertical, in order of preference | **(1) Below:** slab top = capsule bottom + 8, if the slab ends above y 628. **(2) Above:** slab bottom = capsule top − 8, if the slab starts below y 108. **(3) Over:** the slab covers the capsule, with the current value's row over it, clamped to y 108–628 |
| Example (Power › When On Battery and Idle › Dim display after, capsule at y 398–458, slab 448 px tall) | Below needs y 914 and above needs y −58, so (3) applies: x 824–1204, y 180–628, with "5 minutes" (checked) at y 390–462 over the capsule. "Battery Percentage", "Dim display after" and "Sleep after" stay readable on the left |
| Source | The value capsule turns white (`--lgs-selected-fill`, dark label) while its menu is open. It is visible in cases (1) and (2) and covered in (3). The morph starts from its rect in every case |
| Header | Steam leaves `BasicContextMenuHeader` empty for settings dropdowns, so T2 writes the source row's label ("Dim display after") into it. It is the row's own localised text |
| Current value | A leading check glyph (`C>Selected`). The menu opens with focus on it (Steam's behaviour) |
| Rows | 72 px (54 pt, 2.2°) |

**More than 8 options: a list page (`p2_settings_timezone.png`).** Timezone has 64 options; Language and Download region are long too.

- This is visionOS's pattern for Time Zone and Language: a pushed list, not a menu.
- It is the same Steam menu, with the same `MenuItem` nodes, handlers, default focus and scroll-to-current. T1 positions and sizes Steam's menu container over the detail pane: x 400–1280, y 0–656.
- The page underneath gets `visibility: hidden` while the menu is open. Its nodes stay.
- **Toolbar:** Steam's Cancel item moves to the toolbar's leading position as a 60 px text capsule at (424, 24), like a visionOS sheet's "Cancel". The title is the source row's label ("Timezone"), centred. There is no magnifier.
- **Rows** are 80 px in a 760 px platter: a 28 px leading check slot, the label, and trailing secondary text if the option has one. About 6.5 rows are visible, against about 5 in a slab, at nearly twice the width.
- The sidebar shows at 50 %, because Steam's modal makes it inert (a click outside the menu cancels).
- **Input:** a click or A picks; B or Cancel cancels; Up/Down move as in Steam's menu.
- Fallback: the slab with a scroll (§4.5 above), max height 520.

### 4.6 Alerts and sheets (`p2_settings_dialog.png`)

Steam's settings dialogs (`GenericConfirmDialog` and its relatives, INV-S §4.14) follow the shell's alert and sheet rules (WN §5.3, §5.4). The change in this revision: **they stay on the window plane (depth 0)** until the depth flag is on (§5), and **a dialog with a destructive button never pops**.

| Dialog | Rule | Notes |
|---|---|---|
| Hostname, HTTP Proxy, Set PIN, Add game, Display explainer, "Other network…", every destructive confirmation | **Alert** | A 640 px (480 pt) card, radius 44 (33 pt), padding 36 36 28. Title 3 28 px Bold, left-aligned. Callout 22 px body. 64 px fields with the focus ring. 60 px capsule buttons side by side in Steam's order. The primary is blue; `.Destructive` and the §4.7 list are red. Materialize 250 ms with a swell from 1.02 to 1. `p2_settings_dialog.png` |
| Keyboard layouts (a 1,923 px card that scrolls), Recording Quality (a table), network details | **Sheet** | ≤ 960 px wide, radius 44, centred in the 108–628 box. A 60 px close circle at (24, 24) inside the card. Title 2, centred. Content scrolls inside (`ModalPosition` keeps `overflow`). `sheet-in` |
| The parent while either is open | **Steam's own modal overlay, restyled to black .35** | It is in Steam's texture, so it dims the sidebar, the toolbar and the page together. The tab bar is darkened to .5, and both stay operable. **No ornament:** the dialog's own buttons carry its actions, and Steam's legend (Select / Cancel) is generic |

Flat alerts cannot be dimmed through SteamVR's `t1` tint node. That node sits above Steam's whole main panel, so it would dim the alert too (SP §5). `t1` is used only when the alert is popped (flag on, §5). The CSS scrim is then made transparent.

### 4.7 Destructive actions (`p2_settings_advanced.png`)

- **Which.** Factory Reset, Format (Force Format SD Card), Delete (Web Browser Data), Unpair, Change & Restart, Reset (audio settings), Clear All (launch interstitials), Change User Password, and Uninstall (Storage ornament).
  - T2 tags them with `data-lgs-destructive` at install. It matches each button's text against Steam's own localised strings for these labels, read through Steam's localisation function, so it works in every language. Unmatched buttons stay neutral.
  - An alert whose buttons include a tagged or `.Destructive` button is tagged too (`:has()`).
- **Look.**
  - At rest: a red label (`--lgs-red`, Headline weight).
  - Hovered or focused: a red whole fill (`rgb(255 66 69 / .84)`) with a red glow.
  - On a tinted fill the illumination is capped at +.04, so the white label keeps its contrast. The row's own light paints under its controls.
- **Depth.** Destructive elements, and alerts that contain them, are **never popped**: not with the flag off, and not with it on (§5).
- **Place.** System's destructive tools live in **System › Advanced**, one level down. Developer's (Format SD, Clear All, Change User Password, Re-arm Mura) live in Developer › Miscellaneous.
- **Behaviour.** Unchanged. Every destructive action still goes through Steam's own confirmation dialog, now drawn as an alert (§4.6). Default focus inside those dialogs is Steam's (changing it would be a behaviour change; SY C.6).
- **On the bottom ornament** (Uninstall), the colour moves into the X glyph badge as a red whole fill with a white label.
- **Footnote** under System › Advanced: "Destructive actions keep Steam's own confirmation dialog." It is English-only T2 text and is omitted in other languages.

### 4.8 Page-by-page notes

The common rules (§3, §4.3) apply to every page. Only the differences are listed.

| Page | Notes |
|---|---|
| System | Root as in §4.1. **About ›** shows Hostname as a value-style button that opens the Hostname alert, then OS Name … Device Serial Number (7), SteamVR (3), Steam (4 plus Third-Party Licenses), Hardware (10): read-only 80 px rows, value right-aligned. They stay focusable and in one column, because a grid would change the D-pad's meaning. **Updates ›:** Steam's yellow "!" becomes a 32 px orange circle, and Apply is the page's primary (blue) (`p2_settings_update.png`). **SteamOS Crash Report ›:** the toggle and the 6 disabled toggles at 40 %. **Advanced ›:** §4.7. Timezone is a rich value capsule (72 px) that opens the list page |
| Internet | Network rows: a leading check (connected) or lock glyph; trailing signal glyph and chevron. "Other network…" has a chevron. Delete Web Browser Data is destructive. Network details, the proxy and "Other network…" open as alerts or sheets |
| Storage (`p2_settings_storage.png`) | **No hero:** the virtualised list's height is computed by JS from the space it gets, and its inline `height` and `will-change` stay untouched (INV-S §8). The title is inline in the toolbar from the start. Drive tabs become a 64 px segmented control. The usage bar is a 24 px capsule with Steam's segment colours and an 18 px legend. "Items · N" sits beside the sort value capsule. App rows: art thumbnail (44 × 64, radius 10), name 24 px, "last played" 20 px white .70, size on the right. **Row height 80 needs T3** (react-virtualized `rowHeight` prop, LA LQ2) [PLAUSIBLE]; the fallback is Steam's 58 px rows restyled. **Selection mode:** §4.13 |
| Bluetooth | Device rows with a leading device glyph. "Not connected" in 18 px Semibold title case white .50, not uppercase. Disabled rows at 40 %. "Searching for devices…" as a footer line with Steam's spinner |
| Display | One row. Steam's description "Press [Y] for more info" keeps its Y glyph image. The ornament shows "More Info (Y)", which dispatches the same `onOptionsButton` (§4.11) |
| Power | `p2_settings_dropdown.png` |
| Audio | `p2_settings_audio.png`. "Reset audio settings" is destructive |
| Controller, Controller › Advanced | The sub-page's own Back (`%{BackButtonContent>BackButton}`) becomes the detail toolbar's 60 px Back circle at (424, 24), with "Advanced Settings" as the inline title. This is the same anatomy as our drill-down sub-views. Add Controller and firmware Start keep the neutral style: they start processes, they do not destroy |
| Keyboard | Theme value capsule plus a 60 px circular preview button; Points Shop button; Active Keyboards: Edit (opens the tall layouts sheet) and the current layout row with a radio circle. **Quick Chat Options ›:** 8 text fields as 64 px capsules in one platter |
| Accessibility | Four rows. Steam's High Contrast and Reduce Motion stay the user's settings; the theme reacts to them (§7, DESIGN2 §13) |
| Security | Steam's description-only row becomes footer text (20 px) above a one-row platter |
| Notifications (`p2_settings_notifications.png`, `_sub.png`) | Root as in §4.3. **Client › and Friend ›:** two switches per row under "Show Toast" / "Play Sound" headers. Flash window keeps its segmented control in Friend ›. **Store News, Personal Activity, Wishlist, Family, Developer / Game News:** check circles under "Email · Toast · Mobile · Feed". Steam's sticky `%{CheckboxHeaders}` keep `position: sticky`, restyled to 18 px Semibold title case with no italics. "Notify me via" is upright |
| Friends & Chat | Steam's preview friend (`%{FakeFriend}`) in the first row becomes a 48 px avatar circle and name. **Chat ›** holds Chat Filtering "Manage" (opens the web page, unchanged) and Chat Font Size (segmented) |
| Downloads | Steam's `%{FakeContainer}` pseudo-row becomes a regular platter row. Conditional rows (the bandwidth input, the schedule time pickers) take the same row styles when they appear |
| Cloud, In Game, Compatibility, Library, Home | Plain rows. Links inside descriptions (`a.Focusable`) are underlined white .70, with the FocusRing replaced by a fill light |
| Family | Body text; "Try Steam Families" is the page's primary (blue) |
| Remote Play | A single page (§4.3): host rows with Connect capsules, Unpair destructive, the disabled "Connected" button at 40 % |
| Game Recording | The mode rows become a selection list (§3.6). **Shortcut Keys ›, Video Recording ›, Audio Recording ›** |
| Store | Seven rows with "Manage" capsules and a trailing external glyph (they open web pages) |
| Developer | Root of six drill-down rows (§4.3). Destructive-styled where they match the §4.7 list; everything else neutral |

### 4.9 The VR Settings page (new, Steam side)

This is a new page in Steam's settings list (P-S1). Steam Settings becomes the one entry point for every setting, and gamepad users get a path into SteamVR's settings.

**As it ships, before P-S3 passes (`p2_settings_vr.png`):**

| Part | Content | Source of truth |
|---|---|---|
| Sidebar row | "VR Settings": a purple headset circle in its own group after group 1 | Steam's localised `#MainTabsVRSettings` (SRC module 82545) |
| Hero | Purple headset circle, "VR Settings" | Same |
| **SteamVR ›** row (one row, its own platter) | A 40 px grey headset circle; the label "SteamVR" (a brand name, the same in every language); a trailing **laser glyph** (a beam ending in a ringed dot, white .70) that marks the destination as laser-only; a chevron | A T3 Focusable whose `onActivate` (A or a click) calls **`SteamClient.SteamVR.DashboardTabClicked({tab_id})`** with the VR settings tab id, exactly what the tab bar's VR Settings item does (SRC module 80096). It opens SteamVR's settings at its last section, and nothing promises more |
| Second platter, no header | **Refresh Rate:** Steam's notched slider. The value is on the label line ("90"), the bookends 72 and 144 are under the track, and the steps are the rates SteamVR reports (`display_refresh_rates_available`). It is disabled while a per-game profile is active (Steam's rule). **Motion Smoothing:** a switch, with Steam's explainer marker (an ⓘ, opened with Y). **Custom Render Resolution:** a switch plus a resolution slider showing "W × H" per eye. It only renders when SteamVR reports `supersample_manual_override`; it did not render on 2026-10-07 | **Steam's own Quick Access components**, rendered unchanged inside our page so the handlers are Steam's (`SteamClient.SteamVR.SetHMDSettings`). Module 51008 renders the QAM's "VR Settings" section from six exports of module 862 (SRC, §12.3) |
| "Performance" platter | **Show Perf Overlay in VR** (renders while SteamVR reports a value). **Record VR Performance** and **Record Tracking** (render when a condition read from `v.gk` holds — presumably developer mode — or when already on) | Same module. The header is Steam's localised `#QuickAccess_Tab_Perf_Title` ("Performance") |
| Footnote (English only) | "SteamVR's own settings use the laser pointer. With a controller, press Left there to reach the tab bar." | T3 text, gated on `lang === 'en'` |

The six components were enumerated from the source and checked live on 2026-10-07 (§12.3): five rendered, and Custom Render Resolution returned null. The previous revision drew Refresh Rate as a "90 Hz" value capsule. That was wrong: it is a notched slider, and the mockup is redrawn from the live DOM measurements.

**Gamepad:**

- Up/Down: SteamVR › → Refresh Rate → Motion Smoothing → Show Perf Overlay → …
- Left/Right on Refresh Rate changes it (Steam's slider; T-PAD never presses Left/Right there).
- A on SteamVR › switches the window to SteamVR's page. The way back with a gamepad is in §4.12.

**After P-S3 passes (`p2_settings_vr_tiles.png`):**

- The single row becomes a 4 × 2 grid of 176 × 124 px raised tiles (radius 30, 16 px gaps, a 48 px colour circle and a 22 px Semibold label).
- Each tile opens SteamVR's page **at that section**.
- Each tile has its own glyph and colour, the same as SteamVR's sidebar: General (grey sliders), Play Area (green floor arrow), Dashboard (blue panel), Controllers (orange controller), Video (indigo film strip), Camera (teal camera), Startup / Shutdown (red power), Developer (grey hammer).
- The previous revision gave Dashboard, Video and Display one shared glyph.
- Tiles are a `flow-children: grid` group (SR §4). Grid moves are spatially correct and edges do not wrap.
- Tile labels are SteamVR's own section names, read from SteamVR's page on its last render. Until they have been read, the single row stays.

**Visibility.** The page stays visible even when SteamVR's "Show VR Settings" (Dashboard › Advanced) hides the tab-bar entry, because this page is then the way back to turn it on. P-S3 also checks whether `DashboardTabClicked` refuses a hidden tab; if it does, the row shows disabled with that reason.

### 4.10 SteamVR's settings page (`p2_settings_steamvr.png`, `p2_settings_steamvr_playarea.png`)

The panel root `.DashboardPanel.Settings` keeps its 1858 × 1045 SteamVR px box (INV-VR §7.2: a panel's box is its quad). Everything else is layout inside it. **The page is laser-only, so there is no focus order to protect.**

| Element | SteamVR px | = main px | How |
|---|---|---|---|
| **Visible glass** | **1858 × 952, radius 78**, top-aligned in the 1858 × 1045 panel | **1280 × 656, r 54: Steam's footprint exactly** | The panel's own background becomes transparent, and the glass tint is drawn by a backing (a free pseudo of `.SettingsMainPanel`, or a T2 `aria-hidden` node if none is free). `.SettingsSidebarPageContainer` gets `height: 952px`. T5: a systemui `window` cover with the same shape (DESIGN2 §14, SP §11.2). The previous revision's 1290 × 726 came from applying m = 1.44 to the panel; at the frame's real ratio (1.4516) the panel is exactly Steam's 1280 × 720 overlay, and the difference that showed was the height (720 against 656) |
| Bottom margin | y 952–1045 (93) | 64 | Holds the ornament, as in Steam's window |
| Sidebar | 576 wide, black .14 | 400 | `.SettingsSidebar` width. Its buttons scroll in their own column (`overflow-y: auto`) |
| **Back circle** | 86 px at (35, 35), hit 115 | 60 at (24, 24), hit 80 | A **new T2 node** in the sidebar's non-scrolling parent. Its click handler calls `FrameStore.frames.find(f => f.pages.some(p => p.m_sSummonOverlayKey === 'system.settings')).SwitchToPage(<the Steam page id>)`: the same call `docs/inventory/steamvr-pre/settings_open.js` uses to switch pages [call PROVEN, used by the inventory and on 2026-10-07]. A laser click on our own DOM node is [PLAUSIBLE]: SteamVR's buttons on this page are DOM elements clicked the same way. It returns to Steam's window at its current route, normally Steam › VR Settings. Fallback: no Back circle; the tab bar, which is always visible on this page (§4.12), is the way back |
| **"SteamVR" title** | Large Title 66 px Bold at x 144, centred on the Back circle (y 35–121) | 46 at x 100, y 24–84: **the same place as "Settings"** | `::before` with a brand name (the same in every language) |
| Sidebar rows | 104 tall at **115 pitch** (11 apart), radius 52, x 23–553, from y 156 | 72 / 80 | The same as Steam's. Eight rows need 920 px, so the column **scrolls**, like Steam's 25-row sidebar, with a 104 px bottom fade. The first 6.8 rows are visible. [PLAUSIBLE] that a laser scrolls a plain `overflow: auto` div here: the page container already scrolls by laser today (Play Area: scrollHeight 1722). Fallback: 96 px rows at 100 pitch fit all eight (66 / 69 main px, a documented exception like Storage's 58) |
| Row selection and hover | Selected white .26, specular top arc, Semibold; hover + .03 and a .07 spot | — | As §3.3. The selected row is SteamVR's `.SettingsSidebarButton.Active` |
| Row icon circles | 58 px, glyph 32 | 40 | T2 decoration on `.SettingsSidebarButton > .Label`. `.SettingsSidebarButton::before` is SteamVR's press effect and stays |
| Inline title | Title 2 43 px, centred over the detail pane, y 50 | 30 | When the section hero has scrolled under the edge (`p2_settings_steamvr_playarea.png`) |
| Section hero | 81 px circle and the section name in 55 px Bold, one line, centred, at y 168 | 56 + 38 | T2 copies the active sidebar label (SteamVR's localised text) into an attribute on `.SettingsPageContainer`, drawn by `::before` |
| Content column | 1094 wide, centred in the 1282 px detail pane (x 670–1764) | 760 | max-width on the page container's content |
| Rows | 115 tall, padding 35; labels 35 px; descriptions 29 px | 80 / 24 / 20 | `.SettingsItem` |
| **Off / On → switch** | **95 × 58** track, 50 px knob | **66 × 40** | Applies to two-option groups `.SegmentedControlGroup.DualValue` whose option texts are SteamVR's own localised "Off" and "On" (T2 tags `data-lgs-switch`). The Advanced toggle and every other group stay segmented. T1 only: (1) the selected option gets `opacity: 0; pointer-events: none`; (2) the unselected option is stretched transparent over the whole track (`position: absolute; inset: 0`), so **a click anywhere on the track hits the unselected option and toggles**; (3) the knob is that option's `::after`, white, at the On side when the unselected option is the first one (Off) and at the Off side otherwise; (4) the track is green when `:has(> :last-child.Active)`; (5) SteamVR's own sliding `::after` pill on the group gets `opacity: 0`, its `transform` untouched. Verified by T-VR-SW on a static copy of SteamVR's DOM |
| Refresh Rate | 7 circles of **86 px at 121 pitch** under the label (60 main px at 84: CTL R10, §7.4; VP P-08's clear gap); current = white | 60 / 84 | `.RadioButton` |
| Brightness and other sliders | A 92 px tall capsule, 600 wide. SteamVR's handle (a 92 px white circle) carries the value ("125%") | 64 | `.SliderControl.ValueOnHandle`. The `HandleContainer` transform is untouched |
| Dropdowns | Value capsules 86 tall | 60 | `.ButtonControl.Dropdown` (its `::after` chevron kept, recoloured) |
| Buttons | 86 tall capsules, title case | 60 | `text-transform: none` on SteamVR's ALL CAPS buttons |
| Advanced items | A 16 px purple dot before the label instead of purple fills | 11 | `.Advanced` |
| Nested sub-sections (`SubsectionStem`, e.g. Environment Style) | A recessed platter inside the platter (black .16, radius 35, inset 23) | — | A fill on a fill, never glass on glass |
| **Bottom ornament** | A liquid capsule 121 tall at y 911–1032, straddling the glass bottom by 41 (28 main), centred: "Advanced Settings" 32 px Semibold white .70 plus SteamVR's "Hide · Show" segmented (86 tall; the selected segment is white) | 84 / 60 | `.Bottom.AdvancedSettingsToggle` (the same node) re-placed by T1 `position: absolute` against the panel container. The sidebar is not its containing block, so the sidebar's scroll does not clip it. Its sliding `::after` thumb is recoloured white, never moved. It is the view option of the whole page, so it belongs in an ornament (visionOS puts view options in toolbars) |
| Popovers and section modals | Thick glass, radius 46, rows 104 | 32 / 72 | `.SettingsMain .Modal`, `.DropdownPopoverButton`. **Fit rule:** `max-height: 856px` (the glass minus 2 × 48), `overflow-y: auto`, rows 104 (the 72 px floor) instead of 115 when the modal has more than 6 rows. Checked by T-VR-MODAL |
| Laser pill under the window | "Use Laser Mouse to Interact" with an A glyph: a panel-glass capsule in title case | — | SteamVR's gamepad-mode pill (INV-VR §2.5.4). Its panel size follows its DOM (SP §6.2) |

**Environment Style.** It was captured live on 2026-10-07 (`p2_settings_live_vr_playarea.png`) and redrawn in `p2_settings_steamvr_playarea.png`.

- Today the block is 1195 × 919 SteamVR px: a dropdown ("AURORA") over a nested sub-panel holding a Background colour button, Height and Rainbow Speed sliders, a Light Shafts Off/On control and a further nested Speed slider.
- At the new sizes it re-flows into the 1094 px column at about 1,100 px tall. The page already scrolls today (scrollHeight 1722 in the 1045 panel), so every control stays reachable by scrolling.
- T-VR-MODAL and T-VR re-measure it.
- The "Background" control opens a colour picker, which is one of the modals in T-VR-MODAL.

### 4.11 The bottom ornament per context

The ornament is Steam's `#Footer` legend as the shell's ornament (WN §3.4):

- an 84 px capsule at y 628–712;
- 60 px legend buttons with Steam's glyph as the leading badge, labels 22 px Semibold;
- Select (A) and Back (B) in Medium white .70 after a 14 px gap;
- depth 0.

**New in this revision: it shows only when it carries a page-specific legend.**

| Context | Ornament | Why |
|---|---|---|
| Any row, sub-view or root (legends: Select (A), Back (B)) | **Hidden** (`visibility: hidden`; Steam's footer keeps its measured height, so pages still end at y 628 and the glass stays 656) | A laser user clicks the control and uses the Back circle; a gamepad user presses A and B. visionOS has no legend strip |
| Slider focused (B renamed "Done") | Done (B) | Page-specific label |
| Storage app row focused, or a selection made | Uninstall (X, the badge a red whole fill), Move Content (Y), Select (A), Back (B) | The laser has no other path to X and Y |
| Display row focused | More Info (Y), Select (A), Back (B) | Same |
| Dialog or menu open | Hidden | The dialog's own buttons and the menu's Cancel carry the actions |

- **Mechanism (T2).** Each legend gets `data-lgs-btn` (OK, CANCEL, SECONDARY, OPTIONS, MENU or SELECT) and `data-lgs-default` (1 when its label equals Steam's own default label for that button). Both are read from the legend's React props (`onOKActionDescription` and the like, SR §3.6). CSS hides the capsule while every legend is OK or CANCEL with its default label.
- **Motion.** The capsule materializes in 250 ms when it appears and dematerializes in 350 ms when it leaves. Labels cross-fade in 150 ms (WN).
- **Audit exception E-ORN.** `glass.py audit` reports Select and Back as HIDDEN on settings routes. Their functions stay reachable: Select = clicking the control or A; Back = the Back circle or B. T-AUD lists exactly these two and nothing else.
- **Fallback** if the legends cannot be tagged: the ornament is always shown, as WN does today.

### 4.12 Ways in and out

| Path | Laser | Gamepad |
|---|---|---|
| Tab bar (frame menu) › Settings (gear) | click | D-pad Left at a page edge or B at the root, then Up/Down + A |
| Tab bar › VR Settings | click | same |
| Bar › Steam tab menu › Steam Settings / VR Settings | hover + click | unchanged (SN A.3 N4) |
| Steam Settings › VR Settings › SteamVR › | click | D-pad + A (new path) |
| A root view → a sub-view | click a "›" row | A on it |
| A sub-view → its root view | Back circle (424, 24) | B (focus returns to the row) |
| Leave Settings | Back circle (24, 24); any tab | B from the sidebar |
| **Leave SteamVR's page** | **Back circle (new)**, or any tab-bar item | **D-pad Left focuses the tab bar**, then Up/Down + A on Settings, VR Settings or any item (SRC below) |

**SteamVR's page with a gamepad.** This is read from the source of `vr:systemui` (module 1391, `OnSystemGamepadButtonDown/Click`) on 2026-10-07. The button numbers match Steam's `EGamepadButton` (module 20505: OK 1, CANCEL 2, DIR_DOWN 10, DIR_LEFT 11, SELECT 13); SteamVR's bundle carries no names, so the mapping is [PLAUSIBLE].

| Button | What it does on `system.settings` |
|---|---|
| **D-pad Left (11)** | `FocusLeftFrameMenu()`: gamepad focus moves into the tab bar, which is Steam's frame menu with Steam's own focus navigation |
| D-pad Down (10) | `FocusFrameControls()`, or `FocusDashboardBar()` |
| View / Select (13) | `CycleDashboardFocus()`, or `FocusDashboardBar()` |
| A (1) | `ForceActivateLaserMouse()` while the "Use Laser Mouse to Interact" banner shows |
| B (2) | Only "Enter Gamepad Mode" when that button shows; otherwise **nothing** |

On a system panel the tab bar is visible without the laser (`frameMenuVisibilityRequiresLaser` is false when the active page `isSystemPanel`). Nothing is pressed to establish any of this. T-VR-EXIT checks it by calling the same method, `FocusLeftFrameMenu`, and reading where focus lands (§12).

### 4.13 Storage selection mode (new mapping)

Steam's Storage list has a selection mode: activating a row selects it, and its row shows a checkbox (`%{AppSelected}` plus a checkbox, INV-S). Uninstall (X) and Move Content (Y) then act on the selection. The live inventory never entered it, because activating a row selects it.

| Element | New look | Input |
|---|---|---|
| Selected row | A leading 40 px check circle (blue whole fill and white check), shown only in selection mode. Steam's checkbox is restyled, not replaced | Laser: click the row. Gamepad: A |
| Unselected row in selection mode | An empty check circle (black .30 well, white .28 rim) | same |
| Ornament | Uninstall (X) and Move Content (Y) as buttons, acting on the selection as Steam does | click, or X / Y |
| Count | Steam's own count text if it shows one; otherwise "Items · N" unchanged | — |

This state is drawn in `p2_settings_storage.png` from Steam's class names; it has not been seen live. T-STORE-SEL checks the restyle on a detached clone of one row with `%{AppSelected}` added, built in the lab page, never on the live list.

---

## 5. Depth

Depths are given in mm at r = 1 and in scene units (units = m / (S × r), S = 0.369; DESIGN2 §2.6).

**The safety rule (new).** Clicks on interactive in-place crops are [PLAUSIBLE], and only a person wearing the headset can confirm them (SP §2.3, §12). Non-interactive crops of interactive elements are not an alternative: they hide the laser dot and offset the hit by `dz × tan θ` (SP §2.4: 8–14 px at 30 mm). So:

1. **`theme/layers.json` gains `"interactivePops": false`.** Every layer rule whose element takes input gets `"interactive": true`. That covers the existing `menu`, `sheet`, `sheet-panel`, `filters`, `hdr-back`, `hdr-search` and `footer` rules and every rule this concept adds for buttons and capsules. `device/lgs_layers.js` skips interactive rules while the flag is false.
2. **The flag turns true only after the SP §12 wearer check** ("Pop a menu at 0.03 units, click each row at a steep laser angle") passes. The date of the check is written next to the flag. No agent sets it.
3. **Destructive elements never pop.** This covers elements tagged `data-lgs-destructive` and any modal containing one (`:has()`), whatever the flag says. A misrouted click inside a Factory Reset confirmation is not worth a few millimetres.
4. The tab bar's depth is not a crop. It is the `z` of Steam's own frame-menu popup, which SteamVR places and routes like every bar popup (SP §3.3). It stays at +25 mm either way.

**Ships with the flag off:**

| Element | Depth | Units | Tier | Notes |
|---|---|---|---|---|
| Window glass, sidebar, platters, rows, all in-window controls, Back, search circle, ornament | 0 | 0 | — | Shadows only. These are flat in visionOS too: in-window controls sit at the window plane |
| Menus, list pages, alerts, sheets | 0 | 0 | T1 + T5 `thick` shape at the window plane | Depth comes from the thick material, the shadow and Steam's .35 scrim |
| Hero icon circle | +10 mm (1.0 cm) | 0.027 | T4 non-interactive crop + T5 slab + hole cover | Decorative, with no handler under it, so the crop's hit offset is harmless. The laser dot is hidden only over its 56 px. Dropped while its scroller moves and while any modal is open |
| Tab bar | +25 mm (2.5 cm) | 0.068 | T4 popup `z` (not a crop) / T5 | WN §3.3 |

**Added once the flag is on (after the wearer check):**

| Element | Depth | Units | Tier |
|---|---|---|---|
| Primary capsule (Apply, Try Steam Families); a focused or hovered non-destructive `DialogButton` | +15 mm | 0.041 | T4 interactive in-place crop + T5 tinted / liquid slab |
| A value capsule while its menu is open | +15 mm | 0.041 | T4 interactive crop |
| Value menu slab | +30 mm (grows from +15) | 0.081 | T4 interactive crop + T5 `thick` |
| Alert **without** a destructive button | +30 mm | 0.081 | T4 interactive crop + T5 `thick`; the window dims through the `t1` tint [PROVEN, SP §5], and Steam's CSS scrim becomes transparent |
| Sheet | +30 → +50 mm | 0.081 → 0.136 | Same |
| List page (long menus) | 0 | 0 | It replaces the detail pane, like a pushed page |

**Hole covers (corrected).** Every popped element hides its original under an opaque cover, because E2E §1 found doubled content otherwise.

- **Shape:** the element's own rect + 2 px on every side, with the element's corner radius + 2. A cover at +1 mm over the exact rect already hides the original from every angle: the parallax between the cover and the original is 1 mm × tan 35° = 0.7 mm, about 0.9 px. The previous revision's `dz × tan 35°` margin was a geometry error that blanked out neighbouring content.
- **Tone:** glassd's `window` material plus a fill equal to the container's (black .14 inside a platter, none on bare glass), so the cover looks like what surrounds it. This needs a per-shape `fill` in glassd's cover shapes (a small glassd change, listed in §10).
- **Modals:** covers sit outside `t1`'s subtree (SP §5), so while a popped modal dims the window through `t1`, each cover is wrapped in the same `tint`. With the flag off, in-page pops are dropped while a modal is open, so there is nothing to dim.

**Other rules:**

- Crops stay at their original x/y (DESIGN2 §3.8).
- Text never pops alone.
- Scrolling content does not pop while it scrolls (an existing `layers.json` rule).
- SteamVR's settings page has no pops: systemui crops of systemui panels are untested. Its depth comes from the tab bar and the ornament's straddle.

---

## 6. Materials

| Element | T5 (glassd running) | T1 fallback (CSS only) |
|---|---|---|
| Steam window | A `window` cover; its shape excludes the 64 px ornament margin | Smoky tint `rgb(20 22 30 / .74)` plus edge cues (`p2_settings_system_t1.png`) |
| Sidebar | Fill black .14 on the window glass (not glass) | Same |
| Platters, fields, slider tracks | Fills (black .14 / .30), recessed | Same |
| Buttons, value capsules, drill-down rows, tiles | Thin fill white .10, raised | Same |
| Value menu, alert, sheet (flat) | A `thick` shape inside the window cover at the window plane (a per-shape material in glassd's cover, §10) | `backdrop-filter: blur(30px) saturate(1.5)`, tint black .30, edge cues, the 30 mm shadow token |
| List page | None of its own: it sits on the window glass of the detail pane | Same |
| Bottom ornament, tab bar | `liquid` | `blur(12px) saturate(1.7)` plus edges |
| SteamVR settings panel | A `window` cover with the 1858 × 952 shape (radius 78) over the systemui panel, and a `liquid` shape for the ornament. Needs systemui covers: DESIGN2 §14, SP §11.2 | Smoky tint on the glass backing; `blur` on the ornament |

**Edges.** Edges follow DESIGN2 §6.2 only: a tone step, a lens band, specular arcs with side gaps, a darkened inner edge and a depth shadow.

- There are no borders, outlines or 1 px rings. Steam's 2 px dialog border and the nav item's transparent 2 px border are removed or stay transparent.
- The selected sidebar pill's arc is a specular arc in this vocabulary: brightest under the key light and gone at the sides. It is not a ring.
- E2E §2 found glassd's current rim reading as a stroke. This concept depends on the normal-dependent specular fix listed there.

---

## 7. Motion

Every animation is a DESIGN2 §11 token. "In / out" is in ms; curves are from DESIGN2 §11.3.

| Interaction | Token, duration, curve | What moves | Must not |
|---|---|---|---|
| Sidebar selection (a laser click or each D-pad step) | Pill fill: `hover-in` 294 in, `fade` 441 out. Page content: the old content out in 150 ms linear; the new content in on `page` 662 ms b0 with `translate: 0 12px → 0` (downward step) or `0 −12px → 0` (upward), no delay | Opacity, ≤ 12 px | Steam's 86 px slide (±12 %), its 80 ms delay, scale. Steam's `PagedSettingsDialog` Enter / EnterActive / Exit / ExitActive classes are overridden with our keyframes. Steam's own timer (400 ms) cuts the tail of `page`, where opacity is already above .97 (CS12) |
| **Drill-down: enter a sub-view** | Old view out in 150 ms linear; new view in on `page` 662 ms b0 with `translate: 16px 0 → 0` (from the trailing side); the inline title cross-fades on `fade` 441; the Back circle materializes in 250 ms | Opacity, ≤ 16 px | Full-width slides (DESIGN2 M1), scale, delays over 60 ms |
| **Drill-down: back to the root** | The same, with `translate: −16px 0 → 0`; the Back circle dematerializes in 350 ms | Same | Same |
| **Inline title on a root view** | Opacity scroll-linked over 24 px of hero travel (no timing) | Opacity | A timed animation, a moving title |
| Row and control hover | `hover-in` 294 / `fade` 441 | Light spot, fill | Scale, outline |
| Gamepad focus move | `hover-in` 294 in (≥ 60 % on the first frame), `fade` 441 out; retargets on auto-repeat | Illumination | A travelling indicator, scale, Steam's `ItemFocusAnim` (neutralised with `animation-name: none` on focused Fields) |
| Press (laser or A) | `interactive` 210 ms b15 glow. Capsules swell to `min(1.06, 1 + 6/maxSide)`. On release the glow goes off in 90 ms linear and the swell returns on `snappy` 488 | Glow; scale on capsules only | Scaling rows, drill-down rows and tiles |
| Switch (Steam) | Knob lift ×1.2 on `interactive` 210 on press; travel and settle on `snappy` 488 ms b15 | Steam's knob `transform` keeps its values; only its `transition` timing changes (from `.2s cubic-bezier(.1,.12,.53,1.72)`, a 20 % overshoot) | Track size, bounce > .15 |
| Switch (SteamVR, drawn on the unselected option) | The knob is a pseudo of a different option in each state, so a CSS transition cannot carry it. On a state change the newly matched knob runs a `snappy` 488 ms keyframe from the opposite side (`translate: ∓37px → 0`), and the track colour changes at t50. A class set by T2 after the first paint keeps the keyframe from running on page load | Knob translate | Animating at rest |
| Slider | The knob appears on hover or focus (`materialize-in` 250 linear, opacity). The thumb lifts ×1.25 on `interactive` when pressed and settles on `snappy`. The value follows the pointer with no easing | Knob opacity and scale | Steam's 200 ms `scale(1.4)` focus pop (removed: `animation: none`) |
| Value menu open | `morph-open` 607 ms b20: `clip-path: inset()` from the source capsule's rect (T2 `--sx --sy --sw --sh`) to the slab's rect; content 15–50 %. Flag on: the source lifts 0 → +15 mm and the menu goes +15 → +30 mm on `depth` (441 ms, b0, Δ 15 mm) | Shape, content, depth | Content scale; moving the source |
| Value menu close | `morph-close` 441 ms b0; content out by 40 %; the source catches at ×1.03 | Same | Capturing input while closing |
| **List page (long menu) open / close** | As a drill-down push: the page underneath is out in 150 ms; the list fades in on `page` 662 with `translate: 16px 0 → 0`. Close is the reverse. Scroll-to-current is Steam's, instant | Opacity, ≤ 16 px | A slab morph across the window |
| Alert (WN §5.3) | Materialize 250 ms (glass channel) + swell 1.02 → 1; content 35–100 %; scrim 0 → .35 on `fade` 441 ms; the default button is focusable once content passes 50 % | Glass, scrim | Shake, bounce > .15, delayed focusability |
| Sheet (WN §5.4) | `sheet-in` 735 ms b0: scale .97 → 1, content 25–70 %, scrim 0 → .35 on `fade`. Flag on: depth +30 → +50 mm on `depth`. Dismiss: `sheet-out` 514 ms b0, content out first | Glass, scrim, depth | Sliding in from an edge, moving the parent |
| Segmented control (Steam's) | Selected fill cross-fades on `snappy` 488 | Fill | — |
| Segmented control (SteamVR's, with its sliding `::after`) | Thumb travel on `snappy` 488 ms b15 (retimed `transition`; the transform values are SteamVR's) | Thumb | — |
| Bottom ornament appears / leaves | `materialize-in` 250 / `materialize-out` 350; labels cross-fade in 150 ms | Glass channel, opacity | Width animation without WN's T2 backing |
| Reduce Motion (`prefers-reduced-motion`) | Bounce 0 everywhere. Movement, depth animation and morphs become 150–200 ms cross-fades; drill-down pushes become cross-fades with no translate. Depth is pushed once at the end | Opacity | — |

Nothing animates at rest: `document.getAnimations().length === 0` one second after any interaction (T-MOT).

---

## 8. Focus and gamepad navigation

| Move | Result | Basis |
|---|---|---|
| Up / Down in the sidebar | Previous / next page. Selection follows focus (unchanged), and each page opens in its root view | Measured live: 24 of 24 pages reached (`settings-pad.js`, §12.3) |
| Right from the sidebar | The first focusable of the page's current view | Steam's geometric layout (DESIGN2 §12) |
| Up / Down in a page | Previous / next row. Focus lands on the control (Steam's behaviour), and the row lights via `.gpfocuswithin`. Drill-down rows are ordinary rows in this order: top slot, Steam's inline rows, bottom slot | DOM order = visual order (§4.3) |
| A on a drill-down row | Opens the sub-view; focus moves to its first row | `navRef.TakeFocus()` on the wrapper (§4.3, P-S4) |
| B in a sub-view | Back to the root view; focus returns to the drill-down row | Our `onCancel`, handled only in a sub-view (P-S4) |
| B in a root view | Steam's: to the sidebar, then out of Settings | Unchanged |
| Left / Right in a row with two switches, or in the check-circle matrix | Between controls in the row (unchanged; checkboxes and switches do not change value on Left/Right) | SY §A.1.2 S10, S11 |
| Left from a page | The sidebar | Unchanged |
| A / B / X / Y | Unchanged; X / Y are also clickable as ornament buttons | SN A.4 |
| VR Settings page | A column: SteamVR ›, then Steam's QAM components. After P-S3, the tiles are a grid | SR §4 |
| SteamVR's page | Laser-only. D-pad Left reaches the tab bar (§4.12) | SRC module 1391 |
| Scroll into view | The focused row must sit between y 108 and 628. Steam's `scroll-padding: 250px 0 60px` on the page scroller becomes `scroll-padding: 140px 0 120px` (T1) | CS6 / T-PAD |

Layout changes that could alter the D-pad mapping are avoided by construction:

- The sidebar stays a column.
- Rows stay a column; read-only rows are not turned into a grid.
- The matrix keeps Steam's rows.
- The content column only narrows.
- Hidden sections are `display: none`, so they are not focusable (P-S4 checks that `FocusNavController` skips them).
- Our new T3 elements (drill-down rows, the SteamVR row, the VR tiles) are Steam `Focusable`s with explicit `flow-children` (SR §3.6).

---

## 9. Function retention table

This covers every function in SY §A.1 (Steam Settings), §A.2 (SteamVR Settings), Appendix 1, Appendix 2 (the QAM VR rows used on the new page) and INV-S (selection mode).

- **[x]** = performs an action. Tests never press these.
- "Same" = the same Steam node and handler, restyled.
- "Root" = inline in the page's root view; "› X" = in sub-view X (§4.3).

### 9.1 Ways in and out (SY A.1.1, A.2)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| E1 | Open Steam Settings from the VR main menu | Tab-bar ornament › gear (frame menu restyled; DESIGN2 §3.3) | click | Left at a page edge or B at the root, then Up/Down + A |
| E2 | Open Steam Settings from the bar's Steam tab menu | Unchanged | hover + click | as today |
| E3 | QAM rows that lead into settings (Wi-Fi network, Bluetooth Add Device) | Unchanged (Control Center concept). They land on Internet and Bluetooth, which have no sub-views | click | as today |
| E4 | Open SteamVR Settings from the VR main menu | Tab bar › VR Settings | click | Left/B, Up/Down, A |
| E5 | Open SteamVR Settings from the Steam tab menu | Unchanged | hover + click | as today |
| E6 (new) | Open SteamVR Settings from Steam Settings | Settings › VR Settings › SteamVR › (tiles after P-S3) | click | D-pad + A |
| E7 | Leave Steam Settings | Back circle (24, 24); any tab | click | B from the sidebar |
| E8 | Leave SteamVR Settings | **Back circle (new)**; any tab-bar item | click | **D-pad Left → tab bar → Up/Down + A** (§4.12) |
| E9 (new) | Turn the laser on from SteamVR's page | SteamVR's "Use Laser Mouse to Interact" pill | — | A (SteamVR's `ForceActivateLaserMouse`) |

### 9.2 Settings skeleton (SY A.1.2)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| S1 | Choose a page | Sidebar row (72 px) | click | Up/Down (selection follows focus) |
| S2 | Enter the page | The first row of the current view | click any control | Right |
| S3 | Move between rows | Platter rows | point | Up/Down |
| S4 | Return to the sidebar | Sidebar | click | Left, or B at a root view |
| S5 | Operate a switch | Switch 66 × 40, hit 86 × 78 | click | A |
| S6 | Choose a dropdown value | Value capsule → slab (≤ 8 options) or list page (> 8), each with Cancel | click, click | A, Up/Down, A; B cancels |
| S7 | Adjust a slider | Capsule slider | drag, or click on the track | Left/Right (ornament "Done (B)") |
| S8 | Press a button | Capsule | click | A |
| S9 | Edit text | 64 px field → VR keyboard | click | A |
| S10 | Segmented choice | Segmented capsule | click | Left/Right + A |
| S11 | Checkbox | Check circle | click | D-pad + A |
| S12 | Explainer (Display) | Ornament "More Info (Y)" button **(a new laser path beside the legend)** | click | Y |
| S13 | Storage Uninstall / Move Content [x] | Ornament buttons with X / Y badges | click | X / Y |
| S14 | Scroll a long page | Page scroller; **drill-down shortens every long page (new)** | wheel / drag | focus moves the scroll |
| S15 | Leave Settings | Back circle | click | B |
| S16 (new) | Open a group of settings | Drill-down row › | click | A |
| S17 (new) | Return from a group | Back circle in the detail toolbar | click | B (focus restored) |
| S18 | Select (A) and Back (B) footer legends | Hidden when generic (E-ORN); the same functions are the click on the control and the Back circle | click the control / Back circle | A / B |

### 9.3 Steam Settings pages (SY A.1.3, Appendix 1)

| Page | Functions | New place | Laser | Gamepad |
|---|---|---|---|---|
| System | Language (dd) | Root | click capsule → list page | A → list page |
| System | Apply software update [x]; "Update available" value | **› Updates**, Apply = the page's primary; badge and value also on the drill-down row | click | A |
| System | OS / Steam Client update channel (2 dd) | › Updates (Beta Participation) | click | A |
| System | 24-hour clock (t), Timezone (rich dd, 64 options), Desktop Mode on startup (t), Developer Mode (t) | Root (System Settings); Timezone → list page | click | A |
| System | Crash reports (t) + 6 disabled (t) | › SteamOS Crash Report; disabled at 40 % | click | A |
| System | Hostname (b → alert: field, Cancel, Change & Restart [x]) | › About; alert §4.6, flat, Change & Restart red | click | A; Left/Right in the alert; B cancels |
| System | About / SteamVR / Steam / Hardware info rows (24 read-only) | › About, 80 px read-only rows | click (focus) | Up/Down |
| System | Third-Party Licenses (b) | › About | click | A |
| System | Run Diagnostics [x], Create Report [x], Run maintenance [x], Factory Reset [x] | › Advanced; Factory Reset red, never popped | click | A |
| Internet | Enable Wi-Fi (t) | Same | click | A |
| Internet | Connected network rows → details (Disconnect [x]); found networks → connect [x]; Other network… → form | Same rows with chevrons; dialogs as alerts or sheets | click | A |
| Internet | Offline Mode [x], HTTP Proxy Configure (→ sheet), Delete Web Browser Data [x] | Same; Delete red | click | A |
| Storage | Drive tabs (2) | Segmented capsule | click | Left/Right + A |
| Storage | Usage bar and legend (read) | Same, restyled | look | look |
| Storage | Sort (dd) | Value capsule | click | A |
| Storage | App rows: select (focus); Uninstall [x]; Move Content [x] | The same virtualised list; ornament buttons for X / Y | click; ornament buttons | Up/Down, X, Y |
| Storage | **Selection mode (multi-select) (newly mapped)** | Leading check circles in selection mode (§4.13); X / Y act on the selection | click a row | A |
| Bluetooth | Bluetooth (t), Show all devices (t) | Same | click | A |
| Bluetooth | Paired / available device rows (pair, connect, disconnect, forget) [x]; "Searching…" | Same rows; status as a footer | click | A |
| Display | Maximum Game Resolution (dd); explainer (Y) | Same; ornament More Info (Y) | click | A, Y |
| Power | Battery Percentage (t); 4 dim / sleep (dd) | Same; menus anchored to their capsule | click | A |
| Audio | Output volume (sl), Output Device (dd), Spatialization (t) | Same; capsule slider | drag; click | Left/Right; A |
| Audio | Apps (per-app sliders when audio plays; empty text otherwise) | Same | as above | as above |
| Audio | Mic volume (sl), Input Device (dd), UI sounds (t), Reset [x] | Same; Reset red | drag; click | Left/Right; A |
| Controller | Details (b), Add Controller [x], Show Advanced Settings (b → sub-page) | Same | click | A |
| Controller › Advanced | Back (b), Idle shutdown (dd), Desktop Layout Edit (b → configurator) + layout icon (b), Firmware Start [x] | Same; Back as the detail toolbar's circle | click | A; B |
| Keyboard | Theme (dd) + preview (b → keyboard), Points Shop (b → store), Haptics (dd), Initial Location × 2 (dd) | Root | click | A |
| Keyboard | Active keyboards Edit (b → tall sheet of switch rows), current layout radio row | Root; sheet §4.6 | click | A |
| Keyboard | Quick Chat options 1–8 (text) | › Quick Chat Options, 64 px fields | click → keyboard | A → keyboard |
| Accessibility | High Contrast (t), Reduce Motion (t), Color Filter (dd), Mono Audio (t) | Same | click | A |
| Security | Description; "On system wake and power up" (t) | Same | click | A |
| Notifications | Toast policy (dd), toast sound (t) | Root | click | A |
| Notifications | Client: 4 rows × (Show Toast, Play Sound) (t) | › Client Notifications, two switch columns | click | Left/Right, A |
| Notifications | Friend: 4 rows × 2 (t); Flash window (segmented) | › Friend Notifications | click | Left/Right, A |
| Notifications | Store News, Personal Activity, Wishlist, Family, Developer / Game News matrices (Email / Toast / Mobile / Feed) | One sub-view each; check circles, sticky headers | click | D-pad + A |
| Notifications | Email opt-out (t) | › Email Opt-out (its state also as the row's trailing value) | click | A |
| Friends & Chat | 9 friends-list switches (t) | Root | click | A |
| Friends & Chat | 7 chat switches (t), Chat Filtering Manage (b → web), Chat Font Size (segmented) | › Chat | click | A; Left/Right + A |
| Downloads | Region (dd), limit speed (t) + bandwidth input, bits/s (t), schedule (t) + time pickers, during gameplay (t), streaming (t), LAN (t), transfers to (dd) | Same (single page); Region → list page | click | A |
| Cloud | Steam Cloud (t), Screenshot Management (t) | Same | click | A |
| In Game | Screenshot UI (t), Steam Networking (dd) + link | Same | click | A |
| Compatibility | Default tool (dd), show all tools (t) | Same | click | A |
| Family | Steam Families link, Try Steam Families [x] | Same; primary | click | A |
| Remote Play | Enable (t), host Connect [x], Pair Steam Link [x], Direct Connection (dd), Set PIN (b → alert), advanced host / client (t) | Same (single page) | click | A |
| Remote Play | Adapter: enable (t), management (dd), Unpair [x], Connected (disabled), advanced Wi-Fi (t), View FAQ (b → web) | Same; Unpair red | click | A |
| Game Recording | Mode (3 radio cards) [changes mode], View FAQ | Root; selection list | click | Up/Down + A |
| Game Recording | Shortcut row, Set shortcut | › Shortcut Keys | click | A |
| Game Recording | Recording Quality (b → sheet), frame rate (dd), height (dd) | › Video Recording | click | A |
| Game Recording | Record Microphone (t), Record audio from (dd, disabled) | › Audio Recording | click | A |
| Home | Big Art Mode (t), personalised store (t), product updates only (t), hidden games Manage (b → library), instructions row | Same | click | A |
| Library | Low Performance Mode (t), Deck compatibility (t), Add game (b → alert with a code field, Confirm / Cancel) | Same | click | A |
| Store | 7 × Manage (b → web pages) | Same, external glyph | click | A |
| Developer | Profiling (t × 2) | › Profiling | click | A |
| Developer | Pair new host [x] | › Development Kit | click | A |
| Developer | Steam Play (dd) | › Steam Play | click | A |
| Developer | Wi-Fi (t × 2) | › Wi-Fi | click | A |
| Developer | Misc (t × 5), Session (dd), Speaker Test [x], advanced channels (t), HDR Debug (dd), Disable Mura (t), Re-arm Mura [x], Force Format SD [x], display scaling (t), Clear All [x], Steam Console [x], timestamps and composers (t × 4), underlays (t), CEF Remote Debugging (t), Change User Password [x], HDR testing (t), Update all devices [x] | › Miscellaneous; Format / Clear All / Password destructive-styled | click | A |
| Developer | Steam Input (t × 3) | › Steam Input | click | A |

### 9.4 Menus and dialogs (SY A.1.4, INV-S §4.6, §4.14)

| Function | New place | Laser | Gamepad |
|---|---|---|---|
| Dropdown menu: pick a value, Cancel, click outside to cancel | Slab anchored to its capsule (≤ 8 options) or a list page (> 8), flat until the flag (§4.5, §5) | click | Up/Down, A, B |
| Dialog: confirm / cancel; click outside = cancel; text prompt; scroll a tall dialog | Alert or sheet, flat until the flag; destructive dialogs always flat (§4.6) | click (sheets also: close circle) | Left/Right, A, B; D-pad scrolls |
| Header Back and search while a dialog is open | Under Steam's .35 scrim, still operable | click | — (as today) |

### 9.5 SteamVR Settings (SY A.2)

Everything is laser, as today, unless marked. "Same" = the same SteamVR node and handler, restyled at ×1.44.

| Section | Functions | New place | Laser | Gamepad |
|---|---|---|---|---|
| Sidebar | 8 section buttons | Same, 104 px rows with icon circles; the column scrolls | click; scroll | — |
| Sidebar | Advanced Settings Hide / Show | **Bottom ornament** (the same node, re-placed) | click | — |
| (new) | Back to Steam | Back circle (T2 node → `SwitchToPage`) | click | D-pad Left → tab bar (§4.12) |
| General | Refresh Rate (7), Display Brightness (sl), Motion Smoothing, Notifications; ADV IPD HUD, Eye Tracking, Dominant Eye (dd + explainer), Track Dominant Eye Only | Same; Off/On as switches | click / drag | **Refresh Rate and Motion Smoothing also on Steam's VR Settings page** (Steam's QAM components) |
| Play Area | Edit Chaperone Appearance (→ editor), Environment Style (dd + Background colour, Height, Rainbow Speed, Light Shafts, Speed), Content-Aware Aurora Color, Content-Aware Camera Tint, Reset Page to Default | Same; the sub-panel as a nested platter (`p2_settings_steamvr_playarea.png`) | click / drag | — |
| Dashboard | Laser Pointer Length (sl), Grab Handle Acceleration (sl); ADV Dim Game, Allow App Quitting, Show VR Settings, Present Non-VR Apps on Theater, Allow Undocked Overlay Interaction, Theater Curvature, Theater Alignment, Keyboard Privacy | Same | click / drag | — |
| Controllers | Show Binding on Controllers, Manage Controller Bindings (→ binding UI), Edit Thumbstick Settings, Test Controller, Debug Legacy Input, Input Debugger; ADV Show Binding UI | Same | click | — |
| Video | Refresh Rate, Brightness, Motion Smoothing (the same three as General), Fade To Grid, Per-Application Video Settings (picker), Foveated Sharpening; ADV Supersample Filtering, Overlay Render Quality, Pause VR When Idle; Reset | Same | click / drag | Refresh Rate and Motion Smoothing as above; the supersample override too while SteamVR reports it (Custom Render Resolution) |
| Camera | Room View, Anti-Flicker (3-way, stays segmented), Dynamic Resolution, Room View Style (dd), Reset | Same | click | — (Room View is also the bar's button) |
| Startup / Shutdown | Choose Startup Overlay Apps, Manage Add-Ons, Turn Off Displays After, Turn Off Controllers After, Reset | Same | click | — |
| Developer | Performance overlay and textures, reprojection depth and motion vectors, smooth spectator, input-binding debugging, global input from overlays, Arcade Mode, Quick Calibrate, Chaperone bubble, Chaperone System, Record Tracking Data, version info | Same | click | Performance overlay, Record VR Performance and Record Tracking also on Steam's VR Settings page |
| Popovers and modals | Dropdown popovers; Per-Application Video Settings; Edit Chaperone Appearance; Choose Startup Overlay Apps; Manage Add-Ons; Thumbstick Settings; Test Controller; the Environment Background colour picker | Same, thick glass; fit rule max-height 856 with scroll, rows 104 when > 6 rows (§4.10) | click | — |

### 9.6 Functions with several homes (SY A.9)

All homes are kept. This concept adds one home, Steam's VR Settings page, for Refresh Rate, Motion Smoothing, Custom Render Resolution (when present), the VR performance overlay and the two VR recordings. It uses the same Steam components as Quick Access, so the homes cannot disagree.

**Nothing is dropped.** Live today: 45 fields on System and 5 on Power (2026-10-07; the audit's 232 field rows and 629 focusables on 25 pages, SY §0.2, are the reference count). With the theme on, every field must be visible in exactly one view (root or one sub-view), and the sum across views must equal the stock count (T-CNT). The only additions are the VR Settings page and our drill-down rows.

---

## 10. Implementation tiers, evidence and fallbacks

| Element | Tier | Evidence it is feasible | Fallback if not |
|---|---|---|---|
| Sidebar width 400, 72/80 rows, group gaps, selection and hover fills | T1 layout | D-pad direction is read from computed CSS, and a column stays a column (DESIGN2 §12). Baseline traversal measured (§12.3) | Steam's 256 px column; rows still 72/80 |
| Icon circles and colours | T2 (`data-lgs-page` from the item's React props `route`) + T1 | Page objects carry `route` and `icon` (SRC module 97849); reading fiber props is read-only. Alternative: `PagedSettings` accepts a `PageListItemComponent` prop (SRC module 47969) | A neutral grey circle behind Steam's own icon (T1 only) |
| "Settings" title, System badge | T2 attribute + T1 `::before` | Steam's localiser and `#MainTabsSettings` (SRC 82545) | No title; no badge |
| Toolbar row 108 | T1 + T3 (shell) | SN C.0.1 / CQ1 [UNPROVEN], tested by WN AT-2 | DESIGN2 risk 4 (a 40 px header with larger controls in a scroll-edge band) |
| **Search as a magnifier circle** | T1 (WN hero-route variant) | The same `%{SearchAndTitleContainer}` node at 80 × 80; WN AT-4 gate | WN's 640 × 64 capsule centred over the detail pane |
| **Inline title** | T2 decorative node + T1 | `DialogHeader` text is in the DOM; scroll-linked opacity from an IntersectionObserver | The hero only (no inline title) |
| Compact hero | T1 + T2 | `.DialogHeader::before` is free (INV-S §4.1) | Title only |
| **Drill-down (wrapper, slots, sub-views)** | T3 (P-S1 wrapper) + T2 (section tags) + T1 (visibility) | `PagedSettings` takes `pages` objects with a `content` element (SRC 47969, 97849); fiber `type` patching [PROVEN, SR §3.4]; `Focusable` with `onCancel` and `navRef` (SR §3.6). Hiding Steam's section nodes with `display: none` neither moves nor removes them. **P-S4** proves the nav controller skips hidden sections, focus restore and counts | The single long page without the hero (§4.3) |
| 760 px column | T1 | CS6 [UNPROVEN]: scroll-into-view with a narrower inner width | Full-width rows with larger type |
| Platters, rows, separators | T1 | `:has()` and sibling selectors in Chromium 126; Field pseudo-elements free in VR (INV-S §4.2) | — |
| Switch at 66 × 40 | T1 `scale: 1.75` (RTL `scale: -1.75 1.75`) + hit extender | CS1 [UNPROVEN]; an independent `scale` keeps Steam's knob `transform` | Steam's 38 × 22 with a larger hit extender and stronger colours |
| Capsule sliders | T1 (track height, recoloured `::before`, icon overlay) + T2 (value text) | CS2 [UNPROVEN]: pointer-to-value mapping from the track rect | A 24 px slider with a 64 px hit area and value text |
| Check circles at 80 pitch | T1 | CS3 [UNPROVEN]: sticky header alignment | 40 px boxes at Steam's 60 px pitch |
| Segmented controls, radio lists, text fields, buttons, value capsules | T1 | Phase 1 restyles of the same primitives (INV-S §4) | — |
| Destructive tagging | T2 | Steam's localiser is reachable (SR finders); text match | No red labels (Steam's confirmations remain) |
| **Menu slab anchored to its capsule** | T1 position + T2 source rect | CQ10: positioning the container changes no handler | Steam's centred position, still restyled, with the morph from the source rect |
| **List page for > 8 options** | T1 (position and size of Steam's menu container; the page underneath `visibility: hidden`) + T2 (title from the source row) | The same menu nodes and handlers; CQ10 | The slab with a scroll (max 520) |
| Dialog restyle, scrim .35 | T1 | INV-S §4.14 | — |
| **Generic ornament hidden** | T2 (legend tags from React props) + T1 | Legend props carry `on…ActionDescription` (SR §3.6) | Ornament always shown (WN today) |
| **Depth flag and destructive exclusion** | `theme/layers.json` + `device/lgs_layers.js` | Rules are already declarative; adding a flag check and a selector exclusion is a small code change [ours] | — (the flag-off state is the safe state) |
| Depth with the flag on: menu, alert, sheet, primary, focused button | T4 interactive in-place crops + T5 slabs + hole covers | Registration [PROVEN, SP §2.2]; `t1` dim [PROVEN, SP §5]; click [PLAUSIBLE until the SP §12 wearer check] | Flat (the shipped state) |
| Hero pop (+10 mm) | T4 non-interactive crop + T5 slab + cover | Non-interactive crops render where placed [PROVEN, SP §2.2 E15]; nothing clickable under the hero | Flat with a shadow |
| Hole cover tone | T5: a per-shape `fill` in glassd cover shapes | glassd covers support `surfaces[].shapes` [PROVEN-P1, SP §11.1]; the `fill` field is a new, small change [ours] | Drop the pop it covers |
| Flat thick shapes for menus, alerts, sheets | T5: a per-shape `material` in the window cover | Same | T1 blur and tint |
| VR Settings page in Steam's list | T3 (P-S1) | `PagedSettings` takes `pages` objects `{title, icon, route, content, visible}` (SRC 47969, 97849); fiber `type` patching [PROVEN, SR §3.4] | Not added: SteamVR stays reachable from the tab bar as today |
| SteamVR › row → SteamVR settings | T3 calling `SteamClient.SteamVR.DashboardTabClicked` | Steam's own main-menu item uses it (SRC 80096) | — |
| VR tiles → a given section | T4 bridge (a systemui script sets SteamVR's settings route) | **P-S3** [UNPROVEN] | The single SteamVR › row (shipped state) |
| VR quick settings | T3 rendering Steam's QAM components | SRC 51008 → 862: six exports, enumerated (§4.9, §12.3) | Omitted; Quick Access › Performance stays the gamepad path |
| Storage rows at 80 px | T3 (`rowHeight` prop) | LA LQ2 [PLAUSIBLE] | 58 px rows |
| SteamVR page restyle (rows, controls, hero) | T1 `theme/vr` + T2 | Phase 1 themed this page (commit 86300b5); systemui panels follow their DOM (SP §6.2), and the settings panel root keeps its size | — |
| **SteamVR glass inset to 952** | T1 (a backing and container heights inside the unchanged panel) + T5 cover shape | Layout inside the panel does not resize the quad; only the root's box does (INV-VR §7.2) | The full 1045 panel (the footprint jump stays) |
| **SteamVR Back circle** | T2 node + `FrameStore…SwitchToPage` | The call is [PROVEN] (`settings_open.js`, run on 2026-10-07); the click on our node is [PLAUSIBLE] | The tab bar |
| **SteamVR Off/On as switches** | T1 + T2 tag | `.DualValue` marks two-value groups (INV-VR §2.8); option pseudos free (P-S6 checks); T-VR-SW `elementFromPoint` on a static copy | SteamVR's segmented control, restyled (the previous revision) |
| SteamVR sidebar scroll | T1 `overflow-y: auto` | The page container already scrolls by laser [PROVEN by use]; a plain div [PLAUSIBLE] | 96 px rows at 100 pitch (documented exception) |
| SteamVR ornament (Advanced toggle) | T1 re-placement + T5 `liquid` shape | The same node; absolute positioning against the panel container | The previous top-right placement |
| SteamVR page glass | T5 systemui cover | Needs systemui covers (DESIGN2 §14) | Smoky tint |
| Motion overrides | T1 keyframes on our pseudo-elements and Steam's transition classes | MO §6.3 rules | Static states |

---

## 11. Capability probes this concept needs

Each probe is agent-runnable and leaves nothing behind. P-S1 to P-S6 are this concept's; the others are open questions from the audits that it depends on.

| Id | Question | Procedure | Pass |
|---|---|---|---|
| **P-S1** | Can a fiber `type` patch on `PagedSettings` insert a page object and wrap every page's `content`? Find it by props shape: a `pages` array containing `route === Routes.Settings.System()` | Same method as SR §3.4: the wrapper calls the original with `{...props, pages: inserted}`; our page is `{visible: true, title, icon, route: '/settings/lgsvr', content}`. Then: `settings-pad.js({sidebar:true})` shows 25 items and 25 routes; `L.nav('/settings/lgsvr')` renders our page; `remove()` restores 24 items; `patchedLeft: 0` | 25 / 25 routes; removal is clean; Steam's 24 pages unchanged |
| **P-S2** | Do the six Quick Access VR components render and stay gamepad-operable in the main window? | Render the exports `lD, rM, R8, zo, Pj, NF` of the module found by the needle `QuickAccess_Tab_Perf_PerfRecordTracking` inside the P-S1 page, in a 760 px platter; `settings-pad.js({pages:['/settings/lgsvr']})`; read values only; **capture `shot main p2_set_live_lgsvr`** and compare with `p2_settings_vr.png` | Those that render in the QAM render here (5 on 2026-10-07); all focusable; values match Quick Access; the shot matches the mockup's structure |
| **P-S3** | Can SteamVR's settings page be opened at a given section from Steam? | In `vr:systemui` (lab VR lock): locate SteamVR's settings route state (`routePage`). Script a page switch plus a section set, as `vrsettings_sweep.js` already does by clicking sidebar buttons (navigation only). Then check whether `DashboardTabClicked` works while "Show VR Settings" is off (read the flag, never change it) | The section is shown without a flash of General |
| **P-S4** | Drill-down: does `FocusNavController` skip hidden sections, does B return with focus restored, and do the counts add up? | With P-S1's wrapper: `settings-pad.js({drill:['/settings/system','/settings/notifications','/settings/developer']})`; `settings-pad.js({pages:[…]})` on root views (no hidden row is ever focused); T-CNT per view | `PASS_backToRoot` and `PASS_focusRestored` on every drill-down row; no focus on a hidden node; the per-view counts sum to stock |
| **P-S5** | Does the SteamVR Back circle's click reach our listener, and does `SwitchToPage` return to Steam? | Inside a Steam lab lock: render the T2 node; dispatch a synthetic click on it (as the laser's mouse event would arrive); read `f.activePageID` | The Steam page id is active after the click |
| **P-S6** | Are `.SegmentedControlGroupOption::after` and `.SettingsMainPanel::before` free in SteamVR's CSS? | `python glass.py styles vr:systemui ".SegmentedControlGroupOption"` with pseudo content, and the same for `.SettingsMainPanel`, on a section page (navigation only) | `content: none` / unset on both |
| CS1 | Toggle `scale: 1.75`: knob state, focus halo, hit area | An `elementFromPoint` sweep over the scaled toggle; shots on and off | Hit = visual; knob positions correct |
| CS2 | Slider with a 64 px track: does the value follow the pointer by the track rect? | Read `--normalized-slider-value` against synthetic pointer positions on a **mock** slider built with Steam's `SliderField` in a T3 page (never on a real setting) | Value = pointer fraction |
| CS3 | Checkbox matrix at 80 px pitch with sticky headers | Shot `/settings/notifications` › Personal Activity scrolled; header x against column x | Aligned within 2 px |
| CS6 | Scroll-into-view with the 760 column and the new scroll-padding | `settings-pad.js` on every long page and sub-view | `PASS_focusInBand` |
| CS12 | Page transition timers | Read Steam's `CSSTransition` timeout for `PagedSettingsDialog` | Enter within the `page` budget |
| CQ1 | 108 px header (shell) | SN C.0.1, WN AT-2 | — |
| CQ10 | Re-placing the menu container keeps scroll-to-current and click-outside | Open the Power dropdown and the Timezone dropdown with the INV-S §4.6 helpers, measure, cancel | Slab within y 108–628 per §4.5; list page over x 400–1280; current value visible; the value is unchanged afterwards |
| LA LQ2 | Storage `rowHeight` 80 | Library audit probe | Rows are 80; list scroll is correct |

---

## 12. Acceptance tests (agents only)

All tests use the locked lab commands (LAB.md). None changes a setting, confirms a dialog, or presses A/B/X/Y on a real control. Every dialog and menu is opened and closed with the INV-S §0.4 helpers (`fire`, `cancelMenu`, `dismiss`).

### 12.1 Tests

| Id | What | Command | Pass |
|---|---|---|---|
| T-ACC | Sizes, type, outlines, column, **rows at scroll 0, search circle, generic ornament** on every route | `python glass.py js "$(cat docs/phase2/concepts/settings-accept.js)()"` (25 routes; split into two calls if near the 60 s limit) | `routesPassing: 25` |
| **T-ROWS** | Vertical budget (part of T-ACC, check `rowsAtTop`) | as above | ≥ 4 rows, or ≥ 260 px of rows, fully inside y 108–628 at scroll 0 on every root view |
| **T-SEL** | The selected sidebar pill outranks hover | `shot main p2_set_live_sel_<room>` with `--pre` that adds the theme's test class `lgs-hover` (styled exactly as `:hover`; synthetic events cannot set CSS `:hover`) to the row after the selected one, in the bright and dim lab rooms, plus the mockups. `python docs/phase2/concepts/settings-sel.py SHOT SEL HOVER --win 0,0 --scale 1.5` (mean luma of the pill interior right of the label, excluding the laser dot) | Selected ≥ hovered + 12 in every capture |
| T-PAD | Gamepad: sidebar walk, page walks, focus kept in the band | `python glass.py js "$(cat docs/phase2/concepts/settings-pad.js)({sidebar:true})"`, then batches of 2–3 pages: `({pages:[…]})` | `distinctRoutes` = items (25 with P-S1); every page `PASS_focusInBand` and `PASS_downUpReturns` |
| **T-DRILL** | Sub-views: enter, focus, back, restore | `settings-pad.js({drill:[…]})` on the six drill-down pages | Every row `PASS_backToRoot` and `PASS_focusRestored`; `focusInSubview` true |
| **T-AUD** | No regressions against stock, **per view** | `python glass.py audit main --route /settings/<page> --pre "__LGS_SET.view('<key>')"` for the root view and every sub-view of all 25 routes | GONE / SHRUNK / UNCLICKABLE / CONTRAST = 0 in the union. An element HIDDEN in one view must be visible in exactly one other view. The only other HIDDEN entries are E-ORN (Select and Back legends) and the first section header of each sub-view (text moved to the inline title) |
| **T-CNT** | Nothing dropped | `settings_sweep.js` (SY §0.2) theme off; theme on, once per view | Every stock field and focusable is visible in exactly one view; the sums are equal; the theme adds only the VR Settings page and our drill-down rows |
| T-HIT | Hit extenders | For each toggle, value capsule, button and checkbox: `elementFromPoint` at the visible edge + 8 px returns the control or a descendant | All |
| T-MENU | Menu placement and look | Power › Dim display after (≤ 8 options) and System › Timezone (64) opened with `fire`; measure: slab right edge = capsule right edge + 8 ± 2, slab within 108–628 per the §4.5 order, rows ≥ 72; list page over x 400–1280 with rows ≥ 80 and the page underneath `visibility: hidden`; `cancelMenu` | All, and the setting value unchanged afterwards |
| T-DLG | Alert look | Hostname dialog via the INV-S §5 System snippet (in › About): card width 640 ± 4, buttons ≥ 60, scrim alpha .35, no ornament; `dismiss` | All |
| T-VR | SteamVR page | Hold the Steam lab lock (INV-VR §2.8); run `vrsettings_sweep.js` theme off and on; panel-size check (INV-VR §7.6); `audit vr:systemui`; `shot vr:systemui p2_set_vr_<section>` per section | The same setting counts per section; panel sizes identical; 0 issues |
| **T-VR-FOOT** | One footprint | Shots of `main` (/settings/lgsvr) and `vr:systemui` (General): the glass rect as a fraction of each page | Both 100 % wide and 91.1 % tall (656/720 and 952/1045), radius 54 / 78, within 1 %. One `hvgrab` of each page in the same frame confirms (look, then delete) |
| **T-VR-SW** | Off/On switches toggle by a click anywhere on the track | On a static copy of one `.DualValue` group (outerHTML plus SteamVR's CSS, in a lab page, never live): `elementFromPoint` at 9 points across the track in both states | Every point returns the unselected option; the knob sits on the correct side |
| **T-VR-MODAL** | SteamVR modals fit or scroll | For each modal in §9.5 (navigation only: open with its button, measure, close with its Cancel or close control, never change a value): modal rect inside the 1858 × 952 glass; either `scrollHeight ≤ clientHeight` or `overflow-y` scrolls; every control's rect inside the glass or inside the modal's scroll range | All; a modal that fails gets 104 px rows or ×1.0 |
| **T-VR-EXIT** | The gamepad exit path from SteamVR's page | Inside a Steam lab lock with SteamVR's page shown (as `settings_open.js`): call the same method SteamVR's D-pad Left handler calls, `frame.inputFocus.FocusLeftFrameMenu()`; then `L.focused()` on the Steam side; revert as `settings_open.js` does | `.gpfocus` lands in `frame.menu` |
| T-SHOT | Visual states | `shot main p2_set_live_<page>` for all 25 routes and every sub-view; focus states with `--pre` and `L.pad`; menus and dialogs with the helpers | Visual review against `p2_settings_*.png` |
| T-MOT | Motion | DESIGN2 §11.9: `document.getAnimations()` durations are in the token list; 0 animations 1 s after a sidebar step and after a drill-down push; a filmstrip of the page switch, the push, the menu open and the alert at f = 0, .15, .35, .5, .75, 1 | All |
| **T-DEPTH** | Depth safety | Read `theme/layers.json` and `__LGS_SG.dump()` | With `interactivePops` false: no interactive rule is active and the only popped nodes are the hero and the tab bar. In every state: no element matching `[data-lgs-destructive]` or a modal containing one is popped. Each hole cover's rect = its element's rect ± 2 px, and its tint = the window's tint. With the flag on (after the wearer check): menu 0.081, sheet 0.136, primary 0.041 units (± 2 mm); `DumpLaserOverlays` lists each popped crop with Steam main's key; an `hvgrab` off-axis frame shows no doubled menu or dialog (look, then delete) |
| T-STORE-SEL | Storage selection-mode restyle | A detached clone of one Storage row with `%{AppSelected}` added, in a lab page (never the live list): shot | A 40 px check circle, blue when selected |
| T-PERF | Performance | `python glass.py perf main --route /settings/system` and `/settings/notifications` | fps within 5 % of stock; no new long frames |
| T-FONT | Font | `document.fonts.check('500 24px "LGS Inter"')` on main and `vr:systemui` | true |
| T-A11Y | Reduce Motion, High Contrast | CDP `Emulation.setEmulatedMedia` inside a lab lock (never Steam's settings); shots | Fades only; opaque glass, 2 px edge |
| T-I18N | No untranslated text | Code review: every string the theme draws comes from Steam's or SteamVR's localised text, except brand names ("SteamVR") and the English-only footnotes gated on `lang === 'en'` | All |
| T-T3 | Hook removal | `lgs off`; then `settings-pad.js({sidebar:true})` shows 24 items, no `/settings/lgsvr`, no `[data-lgs-view]`, `[data-lgs-sec]` or `[data-lgs-btn]` attributes, and no hidden section | All |

### 12.2 What a reviewer looks at in the shots

- **No line anywhere.** The sidebar edge, platter edges and menu edges are tone steps and rims only (DESIGN2 §17 check 3).
- **White fills only on:** switch knobs, the selected segment, a value capsule whose menu is open, and slider fills and knobs. Checked circles are blue, not white.
- **The selected sidebar row is the brightest row,** brighter than any hovered one.
- **Toolbar.** The magnifier is a circle in the trailing corner; there is never a search capsule in the title's place on a settings route.
- **Ornament.** It appears only with page-specific legends.
- **Focus.** The focused row and its control are always fully between the toolbar row and y 628.

### 12.3 Live runs and reads (2026-10-07)

- **Phase 1 baseline (first revision).** `settings-accept.js` on Audio, Power and Notifications: 0 of 3 routes pass, as expected. Rows were 42 px at a 42 px pitch in a 256 px column, content 952 px wide, field rows 46–64 px, toggles 38 × 22, dropdowns and buttons 40 px, slider hit 24 px, checkboxes 22 px at 60 px pitch, segments 32 px, text 12–16 px. "SHOW TOAST" was uppercase with 0.5 px tracking, and "Notify me via" was italic.
- **Sidebar and page walks.** `settings-pad.js({sidebar:true})`: 24 items, 24 distinct routes, every page selected by focus, Up returns to System. `({pages:['/settings/power','/settings/audio'], visTop:40, visBottom:678})`: Power 5 stops, Audio 7 stops, focus always in today's band, Down-Up returns.
- **New checks on today's UI (this revision).** `settings-accept.js(['/settings/system','/settings/power'])`:
  - `searchCircle` FAIL: the search box is 1172 × 40 with its right edge at 1280.
  - `ornament` FAIL: legends are not tagged yet.
  - `rowsAtTop` PASS: today's rows are small, so many fit. The check matters at the new sizes.
  - System has **45 fields** and a scrollHeight of 3,282 px today. Its Software Updates row reads "Up to date" when there is no update.
- **Quick Access VR components.** Read-only source text of module 51008 and module 862, plus a live DOM measurement of Quick Access › Performance:
  - The "VR Settings" section renders exports `lD` (Show Perf Overlay in VR, `perf_graph_in_hmd`), `rM` (Record VR Performance, `record_vr_stats`, shown when `v.gk()` or already on), `R8` (Record Tracking, `record_tracking`, same condition), `zo` (Refresh Rate: a notched slider over `display_refresh_rates_available` with `showValue` and `showBookendLabels`, disabled under a per-game profile), `Pj` (Custom Render Resolution: switch plus a "W × H" scale slider, only when `supersample_manual_override` is reported) and `NF` (Motion Smoothing, with an explainer).
  - All six write through `SteamClient.SteamVR.SetHMDSettings`.
  - Live, five rows rendered: three 38 × 22 toggles in 42 px rows, Refresh Rate as a 270 × 39 slider in an 85 px row with the text "90 | 72 | 144", and Motion Smoothing. Custom Render Resolution returned null.
  - The barpopup screenshot timed out twice, so the mockup is drawn from these DOM measurements. The popup was closed and its faked hover cleared afterwards.
- **SteamVR gamepad handlers.** Read-only source text of `vr:systemui` module 1391: `OnSystemGamepadButtonDown` (10 → frame controls or bar, 11 → `FocusLeftFrameMenu`, 13 → `CycleDashboardFocus` / `FocusDashboardBar`), `OnSystemGamepadButtonClick` (1 → `ForceActivateLaserMouse` while the banner shows, 2 → Enter Gamepad Mode only), `frameMenuVisibilityRequiresLaser = !activePage.isSystemPanel`. Steam's module 20505 names the numbers.
- **SteamVR Play Area.** A live capture under the Steam lab lock (INV-VR §2.8 procedure). The frame switched to SteamVR's settings, the "Play Area" sidebar button was clicked (navigation), then the previous section ("General") was clicked and the frame switched back after 8 s. Afterwards `activePage = 3` (Steam). Output: `shots/p2_settings_live_vr_playarea.png`. The page container is 1442 × 1045 with scrollHeight 1722; Environment Style is 1195 × 919. Nothing else was touched.
- **Harness notes.** With the headset unworn, the first D-pad press after `FocusApplicationRoot()` both activates and moves focus, so the script activates with Down + Up. **Left on the sidebar opens the frame menu**, so the scripts never press Left there.

---

## 13. Risks and open questions

| # | Item | Proposal |
|---|---|---|
| Q1 | A settings search. visionOS has one at the top of the Settings sidebar | When a static settings index exists (the labels `settings_sweep.js` collects, shipped with the theme), add a recessed 64 px search capsule at the top of the sidebar (x 16–384, y 108), and give the list a 92 px top offset. Results navigate to the page and open the sub-view holding the match. It never navigates behind the user's back. Until then, the magnifier circle is Steam's game search |
| Q2 | Selection follows focus in the sidebar (Steam's behaviour), which loads a page on every D-pad step | Kept (anything else is a behaviour change). The cross-fade makes holding the D-pad read as one moving highlight |
| Q3 | Where to insert VR Settings: after group 1, or appended at the end | After group 1 (VR is the device's purpose). P-S1 decides whether insertion in the middle is stable |
| Q4 | Destructive confirm buttons as red fills in alerts ("Change & Restart" restarts rather than deletes) | Red, following SY C.2.4's list; switch to the blue primary if the user prefers |
| Q5 | Desktop leftovers (Flash window, Initial Location (Desktop), composer rows) | Kept in place and order, inside their sub-views |
| Q6 | SteamVR's settings stay laser-only except the mirrored components | Gamepad inside SteamVR's React is research (CS7). This concept gives a source-backed exit path (D-pad Left → tab bar) |
| Q7 | glassd rims currently read as strokes (E2E §2) | This concept depends on the normal-dependent specular fix |
| Q8 | The drill-down's per-route table is static | If Steam adds or reorders sections, unknown sections fall back to `root` (shown inline), so nothing can disappear; T-CNT catches the change |
| Q9 | Storage rows stay 58 px if `rowHeight` cannot be set | A documented exception (1.78°); the ornament buttons still give large targets for the row's actions |
| Q10 | Hit extenders take pointer events on our pseudo-elements (LAB says ours should not) | The exception is limited to free pseudo slots of the control itself; T-HIT verifies |
| Q11 | The depth flag delays almost all stereo until a wearer is available | Accepted: input safety first (§5). In-window controls are flat in visionOS too; only menus, alerts and sheets lose their lift until then. The wearer check takes about a minute (SP §12) |
| Q12 | DESIGN2 D6 (selection .18) against .26 in the sidebar | Proposed as a sidebar-specific token; T-SEL is the reason |
| Q13 | SteamVR's sidebar scroll by laser on a plain div | T-VR checks; fallback 96 px rows (§4.10) |

---

## 14. Critique responses

The critic scored the first revision 6 and listed ten issues; the text of the last was cut off. Each one is answered below. Nine are accepted in full. Issue 5 is accepted with one technical correction. The truncated part of issue 10 is interpreted.

| # | Issue (summary) | Response | Where |
|---|---|---|---|
| 1 | **Still a skin: Steam's information architecture page for page.** The section bar is not a visionOS pattern, is T3-only with no fallback, and does not fit (9 capsules in 760 px) | **Accepted.** The section bar is withdrawn. visionOS drill-down replaces it: daily settings inline, groups as "›" rows that open sub-views, built by a P-S1 wrapper with top and bottom slots, Steam's own section nodes shown or hidden by a data attribute (nothing moved or removed), a Back circle, and B handled by our `onCancel` with focus restored. Probe P-S4 and tests T-DRILL and T-CNT were added. **Fallback:** the single page without the hero, not a section bar. System drops from 3,282 px to about 1,072; Notifications from 144 inline focusables to 9 rows. One refinement: our rows can only come before or after Steam's content (D-pad order = DOM order, DESIGN2 §12), so the per-route table keeps inline only what reads well in that order. That is why Notifications' trailing Email Opt-out is a "›" row and Remote Play stays a single page | §4.3, §4.1, §8, §11 P-S4, §12 |
| 2 | **Steam's game search sits where visionOS shows the page title; no title once the hero scrolls away** | **Accepted.** WN's collapsed variant: a 60 px magnifier circle at the trailing corner (the same node and handler, an 80 × 80 box, WN AT-4 SHRUNK rule). A centred inline title (Title 2, matching DESIGN2's nested-page title) is scroll-linked to the hero on root views and always shown in sub-views. A sidebar settings search is planned once the static index exists (Q1). T-ACC gains `searchCircle` | §3.4, §13 Q1 |
| 3 | **Vertical budget: over 40 % of the first screen is chrome** | **Accepted.** The hero is now compact: a 56 px circle and Title 1 on one line, 72 px in total. Section headers are a 60 px block. T-ROWS was added to `settings-accept.js`: ≥ 4 rows fully inside y 108–628 at scroll 0. It is refined with an area clause (≥ 260 px of rows) for pages that open with two-line or slider rows (Power: 3 rows, 264 px). System's chrome share falls from 65 % to 34 % | §3.5, §12 T-ROWS |
| 4 | **Selected sidebar row indistinguishable from a hovered one** (hover luma 117 against selected 99) | **Accepted and measured.** Selected: white .26, a specular top arc, Semibold, a soft shadow. Hover: + .03 and a .07 spot, capped. T-SEL results: +12.9 in the bright room, +36.9 dim, +27.3 T1. The first attempt at the critic's suggested .24 / .05 measured −0.4, which is why the cap is tighter. This deviates from DESIGN2 D6 and is reported (Q12) | §3.3, §12 T-SEL |
| 5 | **Depth relies on unverified interactive-crop clicks, including destructive confirmations** | **Accepted, with one correction.** Everything ships flat: a `theme/layers.json` flag, `interactivePops: false`, disables every interactive pop, including the existing `menu`, `sheet`, `hdr-*` and `footer` rules on settings routes. It turns on only after the SP §12 wearer check. Destructive elements, and modals containing them, never pop even then. T-DEPTH asserts both. **Correction:** a flat modal cannot be dimmed through the `t1` tint node, because `t1` is above Steam's whole main panel and would dim the modal too (SP §5). Flat modals use Steam's own overlay restyled to .35. `t1` is used only when a modal is popped (flag on), with the CSS scrim made transparent | §5, §4.6, §12 T-DEPTH |
| 6 | **The hole-cover parallax margin is a geometry error** | **Accepted.** Covers are the element's rect + 2 px with its radius + 2 (the cover-to-original parallax at +1 mm is 0.9 px at 35°). The tone is the container's fill, which needs a per-shape `fill` in glassd. During a popped modal, covers get the window's `t1` tint. T-DEPTH checks rect ± 2 and tint equality | §5, §10 |
| 7 | **SteamVR's half: a different footprint, Off/On segments, no Back** | **Accepted.** The glass is inset to 1858 × 952 inside the unchanged panel. That is exactly 1280 × 656 at the frame's 1.4516 ratio: the previous 1290 × 726 came from applying m = 1.44 to the panel, and the real difference was the height. Two-option `.DualValue` groups with SteamVR's Off/On strings become 66 × 40-equivalent switches by the critic's T1 method (selected option hidden and inert, unselected option stretched over the track, knob on the correct side, green when On), checked by T-VR-SW on a static copy. A Back circle calls the proven `SwitchToPage`. "SteamVR" sits at the same x/y as "Settings". Consequences: the sidebar scrolls (8 × 115 > 796), and the Advanced toggle moves into a bottom ornament in the panel's own margin. T-VR-FOOT checks the footprint | §4.10, §12 |
| 8 | **VR Settings page: false affordance of tiles, a wrong Refresh Rate drawing, an unknown sixth component, no gamepad exit, shared glyphs** | **Accepted.** Until P-S3 passes, the page shows one "SteamVR ›" row with a laser glyph (the label is the brand name "SteamVR" rather than `#MainTabsVRSettings`, so it does not repeat the page title; both are localisation-safe). The six components were enumerated from source; the sixth is **Custom Render Resolution** (supersample override). A live DOM measurement was redrawn: Refresh Rate is a notched slider with value "90" and bookends 72 / 144. The barpopup shot timed out twice, so P-S2 now includes a shot of the components in our 760 px platter. The gamepad exit was read from SteamVR's source: D-pad Left → tab bar; B does nothing; View / Down → bar or frame controls; A → laser. T-VR-EXIT checks it. The tiles (after P-S3) have eight distinct glyphs | §4.9, §4.12, §11, §12.3 |
| 9 | **SteamVR modals at ×1.44 may clip; Environment Style re-flow unchecked** | **Accepted.** A fit rule: max-height 856, scroll, 104 px rows when there are more than 6. T-VR-MODAL opens each modal (navigation only) and checks containment and scroll. The Play Area page was captured live and redrawn at the new size: the Environment Style block grows to about 1,100 px, and the page scrolls as it does today | §4.10, §9.5, §12 |
| 10 | **Value menus cover labels; long lists are tedious** (the critique's last sentence is cut off after "present Steam's same") | **Accepted.** The slab is right-aligned to its capsule and opens below, above, or over it, with the current value over the capsule, clamped to 108–628. The truncated fix is read as "present Steam's same menu as a list": for more than 8 options, Steam's same menu nodes become a list page over the detail pane, the visionOS Time Zone pattern, with Cancel at the top-left. T-MENU checks both | §4.5 |
| — | **Storage selection mode never mapped** (in the summary) | **Accepted.** Mapped in §4.13 and the retention table, drawn in `p2_settings_storage.png`, and checked by T-STORE-SEL on a detached clone (the state has never been seen live) | §4.13, §9.3 |
| — | **The generic Select/Back legend ornament stays on every page** (in the summary) | **Accepted.** The ornament shows only with page-specific legends. Audit exception E-ORN is documented, with alternative paths. T-ACC checks it | §4.11 |
| — | **Quick Access component drawn differently from how it renders** | **Accepted** (issue 8) | §4.9 |

---

## Appendix A. Mockups and shots

All mockups use `kit.css` + `kit.js` at true size: a 1920 × 1080 view with Steam's window 1280 × 720 at 1:1. They also load:

- `settings.css`;
- `settings-shared.js`, which builds the sidebar, the detail toolbar and SteamVR's sidebar identically in every mockup;
- `settings-icons.js`.

The tab bar, bottom ornament, frame controls, dashboard bar and window pill come from the shell's `window-nav-shared.css/.js`, so they match WN exactly.

Render command: `python tools/mockshot.py docs/phase2/mockups/settings-<name>.html shots/p2_settings_<name>.png`. `-` becomes `_` in shot names.

| Mockup | Shot | Shows |
|---|---|---|
| `settings-system.html` | `p2_settings_system.png` | **Root view.** The sidebar with groups and a badge; selected System against hovered Internet; compact hero; About › and Updates › (top slot); Language and System Settings inline; magnifier circle; no ornament |
| `settings-system-t1.html` | `p2_settings_system_t1.png` | Same, CSS-only fallback (no room frost) |
| `settings-system-dim.html` | `p2_settings_system_dim.png` | Same in a dim studio room (the glass tone adapts; T-SEL +36.9) |
| `settings-update.html` | `p2_settings_update.png` | **Sub-view** System › Updates: Back circle and inline title in the toolbar, gamepad focus on Apply |
| `settings-advanced.html` | `p2_settings_advanced.png` | Sub-view System › Advanced: Factory Reset focused (red fill, glow, depth 0) |
| `settings-dialog.html` | `p2_settings_dialog.png` | Hostname alert over System › About: flat, Steam's .35 scrim, tab bar darkened, red Change & Restart label, no ornament |
| `settings-dropdown.html` | `p2_settings_dropdown.png` | Power: the menu slab right-aligned to its capsule, in the "over" placement, with labels readable on the left |
| `settings-timezone.html` | `p2_settings_timezone.png` | Timezone (64 options) as a list page: Cancel capsule, centred title, 80 px rows, the current value checked, laser on a row |
| `settings-audio.html` | `p2_settings_audio.png` | Scrolled: the inline title "Audio"; capsule sliders; gamepad on Volume; the "Done (B)" ornament |
| `settings-notifications.html` | `p2_settings_notifications.png` | Notifications root: two inline rows, seven drill-down rows, sidebar focus |
| `settings-notifications-sub.html` | `p2_settings_notifications_sub.png` | Notifications › Personal Activity: the check-circle matrix with headers, gamepad on a circle |
| `settings-storage.html` | `p2_settings_storage.png` | Storage in selection mode: check circles, inline title, Uninstall / Move Content ornament |
| `settings-vr.html` | `p2_settings_vr.png` | **VR Settings as it ships:** SteamVR › with a laser glyph; Steam's QAM components as measured live (notched Refresh Rate, switches) |
| `settings-vr-tiles.html` | `p2_settings_vr_tiles.png` | VR Settings after P-S3: eight tiles with distinct glyphs, one focused |
| `settings-steamvr.html` | `p2_settings_steamvr.png` | SteamVR General in Steam's footprint: Back + "SteamVR", a sidebar like Steam's, switches, the Advanced ornament |
| `settings-steamvr-playarea.html` | `p2_settings_steamvr_playarea.png` | SteamVR Play Area scrolled to Environment Style: a nested platter, value-on-handle sliders, the inline title |
| — | `p2_settings_live_vr_playarea.png` | **Live capture** of SteamVR › Play Area as it renders today (2026-10-07) |

**Iterations in this revision.** Each was seen in a render, then fixed:

1. **Selection against hover.** At .24 with hover .05 / .09 the measurement was −0.4 in the bright room. It now measures +12.9 at .26 with hover .03 / .07 (§3.3).
2. **SteamVR ornament placement.** The ornament first rendered at the panel's left edge, because `left: 50%` resolved against a parent with no width. It is now anchored at x 929.
3. **Laser glyph.** It first read as a magic wand. It was redrawn as a beam ending in a ringed dot, the laser's own look.
4. **Timezone list focus.** The list page first showed both gamepad focus (on the current value) and laser hover. Only one input is active at a time, so the render shows the laser alone.
5. **Email Opt-out.** It started inline at the end of Notifications. Our rows can only come after Steam's content, so it became a "›" row (§4.3).

The first revision's iterations still hold:

- the focused slider knob gained a shadow and a track halo;
- tiles became raised;
- the red ornament text became a red badge;
- the row light paints under its controls;
- the scroll-padding rule was added;
- the 656 px glass, the ornament at y 628 and the menu's 40 px header and Cancel capsule were adopted from WN.

## Appendix B. Source evidence gathered for this concept

These are read-only reads of webpack module sources on the live Frame (2026-10-07, Steam build `11094443`), with the SR §3.1 method. Only source text was read; no module was required or executed by these reads.

| Bundle / module | Finding |
|---|---|
| Steam 47969 | `PagedSettings` (via `Zt("PagedSettings", …)`): props `pages`, `onPageRequested`, `eInitialFocus`, `startingPage`, `page`, `PageListItemComponent`, `PageListSeparatorComponent`, `bottomControls`, `stylesheet`; separators are sentinel entries in `pages` |
| Steam 97849 | Steam Settings' page table: entries `{visible, title: #Settings_Page_*, icon, route: Routes.Settings.*(), content, hideTitle?, link?}`; a hook builds the ordered `pages` array from a key list with separator sentinels, keeping only `visible` pages |
| Steam 80096 | The VR main menu inserts "VR Settings" after "settings" when the tab is visible in the bar or its menu; its action is `SteamClient.SteamVR.DashboardTabClicked({tab_id})` |
| Steam 51008 | Quick Access › Performance: sections `#QuickAccess_Tab_Perf_Common_Settings`, `…_NonVR_Settings` and `…_VR_Settings`; the VR section renders `u.lD, u.rM, u.R8, u.zo, u.Pj, u.NF` with `u = module 862`; Reset to Default (`o.DJ`) follows outside the section |
| Steam 862 | `lD`: Show Perf Overlay in VR (`perf_graph_in_hmd`). `rM`: Record VR Performance (`record_vr_stats`, shown if `v.gk()` or on). `R8`: Record Tracking (`record_tracking`, same). `zo`: Refresh Rate, a notched slider over `display_refresh_rates_available`, `showValue`, `showBookendLabels`, explainer, disabled under a per-game profile. `Pj`: Custom Render Resolution (`supersample_manual_override`) + a scale slider rendered as "W × H". `NF`: Motion Smoothing (`motion_smoothing`) with an explainer. All call `SteamClient.SteamVR.SetHMDSettings` |
| Steam 82545 | English strings: `MainTabsSettings` "Settings", `MainTabsVRSettings` "VR Settings", `QuickAccess_Tab_Perf_VR_Settings` "VR Settings", `QuickAccess_Tab_Perf_Title` "Performance", `QuickAccess_Tab_Perf_VRSupersampleManualOverride` "Custom Render Resolution", `SearchPlaceholder` |
| Steam 20505 | `EGamepadButton`: OK 1, CANCEL 2, SECONDARY 3, OPTIONS 4, BUMPER_LEFT 5, BUMPER_RIGHT 6, TRIGGER_LEFT 7, TRIGGER_RIGHT 8, DIR_UP 9, DIR_DOWN 10, DIR_LEFT 11, DIR_RIGHT 12, SELECT 13, START 14 |
| SteamVR (`vr:systemui`) 1391 | `OnSystemGamepadButtonDown`: 10 → `FocusFrameControls()` or `FocusDashboardBar()`; 11 → `FocusLeftFrameMenu()`; 13 → `CycleDashboardFocus()` or `FocusDashboardBar()`. `OnSystemGamepadButtonClick`: 1 → `HandleLaserMouseRequiredPromptClick()` (= `ForceActivateLaserMouse`) when `canPressAToActivateLaserMouse`, else Enter Gamepad Mode; 2 → Enter Gamepad Mode only when shown. `showGamepadInputNotSupportedBanner` requires `!supportsGamepadFocus` and gamepad interaction mode |
| SteamVR 3514 | `frameMenuVisibilityRequiresLaser` returns `!activePage.isSystemPanel`: on SteamVR's settings page the frame menu (tab bar) is visible without the laser |
| SteamVR `FrameStore` (used by `docs/inventory/steamvr-pre/settings_open.js`) | `frames[].SwitchToPage(pageID)` switches the dashboard frame between `system.settings` and Steam's page; run on 2026-10-07 for the Play Area capture, restored to page 3 |
