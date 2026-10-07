# UX audit: system surfaces (`audit:system`)

Scope: everything a Frame user touches to run the device rather than to browse games:

- **Steam Settings**: all 24 `/settings/*` pages plus Controller › Advanced, their dialogs and dropdown menus;
- **SteamVR Settings** (the `system.settings` page drawn by `vr:systemui`), all 8 sections;
- the **dashboard bar** (dock) and its system popups: Playspace Menu, Streaming Status, the Steam tab menu, tooltips;
- **Quick Access** (QAM), every tab: Notifications, Quick Settings, Performance, Battery Info, Help;
- the **Power menu** and its confirmations;
- the **volume HUD**;
- **battery and status** indicators wherever they appear;
- the **notification list** and **toasts** (Steam's and SteamVR's).

Overlap with `docs/phase2/audit/shell-nav.md` (window chrome, search, main menu, context menus, toasts, footer legend) is kept short and cross-referenced as **SN §x**. The "+ › Launch Program" list belongs to the launcher/library audit and appears here only as a bar function.

Audited live on 2026-10-07 (Steam client build `1791328779`, SteamVR `2.18.2`, web build of 2026-09-30) with the Phase 1 theme on. Stock looks come from the Phase 1 before-shots. Inputs: `docs/inventory/settings.md`, `bar.md`, `hud.md`, `steamvr.md`, `shell.md`, `social.md` §10, `docs/coverage/settings.md` and `hud.md`, the research in `docs/phase2/research/` (cited as **VR §x** for `visionos.md`, **REF** for `references.md`, **MO §x** for `liquid-glass-motion.md`), and the visionOS references `docs/refs/visionos/3.png` (Control Center) and `8.webp` (Settings).

Two capability studies landed while this was written: `docs/phase2/capabilities/spatial.md` (T4/T5, cited as **SP**) and `steam-react.md` (T3, cited as **SR**). Their answers are folded into §0.3 and §C. §C names the capability question each proposal still depends on (**CS1**–**CS12**, listed at the end, with what SP/SR already settle).

---

## 0. Evidence and units

### 0.1 Shots taken for this audit (`shots/`, 1.5x, transparent = room)

| file | what it shows |
|---|---|
| `p2_sys_bar_on.png` | the dashboard bar today: Steam tab, +, Playspace / Room View (on) / Streaming, clock and status, avatar |
| `p2_sys_qam_settings_on.png` | QAM › Quick Settings (opens here): 4 sliders visible, "Other" cut off at the fold |
| `p2_sys_qam_notifications_on.png` | QAM › Notifications, empty state |
| `p2_sys_qam_performance_on.png` | QAM › Performance, top of a 3-screen scroll |
| `p2_sys_qam_batteryinfo_on.png` | QAM › Battery Info: headset "Full", right controller 21 % with a yellow "!" |
| `p2_sys_qam_help_on.png` | QAM › Help: 4 full-width buttons |
| `p2_sys_set_system_on.png` | `/settings/system`, top |
| `p2_sys_set_audio_on.png` | `/settings/audio`: two full-width sliders |
| `p2_sys_set_notif_matrix_on.png` | `/settings/notifications` scrolled to the Email / Toast / Mobile / Feed checkbox matrix |
| `p2_sys_set_storage_on.png` | `/settings/storage`: drive tabs, usage bar, virtualized app list |
| `p2_sys_set_focusrow_on.png` | `/settings/power` (the focus call did not draw a focus state while the navigation source was the laser; used for layout only) |

Reused Phase 1 shots: every `set_*.png` (stock) and `set_*_after.png`, `set_dropdown_open.png`, `set_dropdown_rich.png`, `set_dlg_*.png`, `set_focus_*.png`; `bar_*_before/after.png` (QAM tabs, Playspace, Streaming, tab menus, frame menu, tooltip); `hud_volume_*`, `hud_toast_*`; `vr_settings_before/after.png`, `vr_sys_*`; `p2_audit_power_off/on.png` from SN.

### 0.2 Live measurements (re-runnable by any agent)

Three read-only sweeps were saved under `docs/phase2/audit/system-measure/`:

| script | what it returns | how to run |
|---|---|---|
| `settings_sweep.js` | for each settings route: section headers, every field row (label, control type, control size, row height, disabled/clickable), focusable count, scroll height, font sizes. Navigation only; returns to the starting route | `python glass.py js "$(cat docs/phase2/audit/system-measure/settings_sweep.js)(['/settings/system', …])"` (≈1.5 s per page) |
| `qam_sweep.js` | opens Quick Access, walks all five tabs, lists headers and field rows with sizes. Never operates a control; the locked step closes the popup | `python glass.py js "$(cat docs/phase2/audit/system-measure/qam_sweep.js)"` |
| `vrsettings_sweep.js` | switches the Steam frame to SteamVR's settings page (what frame menu › VR Settings does), clicks each sidebar section (navigation only), lists every setting with control type and size, returns to the first section and switches the frame back (safety revert at 14 s) | Hold the Steam lab lock first, exactly as `inventory/steamvr.md` §2.8 prescribes, then `python glass.py js "$(cat …/vrsettings_sweep.js)" --in vr:systemui`. It printed `restored activePage=3 (prev 3)` |

The bar inventory's OPEN snippet fakes a `mouseenter` on the bar button so the popup stays open. The locked step closes the popup but not the hover, so a "Quick Access Menu" tooltip stays up under the user's bar until a `mouseleave` is sent. `qam_sweep.js` now sends it; after any OPEN-based shot, run the bar inventory's CLEANUP snippet (`bar.md` §0.3) or a `mouseleave` on your own button. After this audit, two tooltips from other steps were still registered ("Steam", "Launch Program"); they were left for their owners.

Totals from the settings sweep: **232 field rows and 629 focusables on 25 pages** (24 sidebar pages plus Controller › Advanced). Row heights: 112 rows of 64 px, 75 of 46 px, 28 of 47 px, 9 of 44 px, 8 others. Controls: 88 toggles, 45 buttons, 30 dropdowns, 27 read-only value rows, 20 checkbox rows (with 1–4 boxes each), 12 clickable list rows, 8 text inputs, 2 sliders, 2 segmented groups, 3 radio cards, 2 drive tabs.

Gamepad traversal was verified live in Steam Settings with `L.pad` (§A.1.2). It could not be exercised inside Quick Access or the bar: a QAM opened by a laser click holds no `.gpfocus` in any window, and giving the bar gamepad focus (View button) would take the user's input focus. Those paths come from the inventories and Steam's source.

### 0.3 Physical scale of each surface

Derived in SN §0.2 unless marked. "Body" is visionOS body text (17 pt ≈ 0.70°); "target" is the visionOS 60 pt minimum (≈ 2.5°).

| surface | ° per CSS px | 2.5° target in px | 0.70° body text in px | source |
|---|---|---|---|---|
| main window (Steam Settings, Power menu) | 0.031 | 81 | 23 | NATIVE.md |
| bar and its popups (QAM, Playspace, Streaming, tab menus) | 0.037 | 67 | 19 | 0.847 mm/px, 0.13 m nearer than the window. The QAM and other bar popups are child overlays of the bar; same distance assumed |
| other Steam popups (frame menu, tooltip, toasts) | 0.034 | 74 | 21 | SN §0.2. Toast placement is SteamVR's; same scale assumed |
| volume HUD | ≈ 0.059 [inferred] | ≈ 42 | ≈ 12 | head-locked popup: 1.53 mm per texture px × DPR 1.5 × popup scale 0.4 = 0.92 mm/px at 0.89 m (offset y −0.4, z −0.8 m) |
| SteamVR Settings page | ≈ 0.021 [inferred] | ≈ 118 | ≈ 33 | 1858 px panel shown in the same dashboard frame as Steam's 0.98 m window. Confirm with one `hvgrab` capture |

**The window is user-resizable.** SP §1.1 read a resize factor of **r = 0.863** on the device today (window 0.850 m wide instead of 0.984 m). The numbers in this audit use the brief's default (r = 1). At today's size every main-window angle (Steam Settings, Power menu) is a further **14 % smaller**: a settings toggle is 0.59° tall, not 0.68°. Bar and popup angles do not depend on r.

### 0.4 What could not be exercised

- **Notification list with items, real toasts, the low-battery banner** (`%{DashboardBar>LowBattery}`): no safe trigger. Mapped from source (Steam module 96144 for the QAM list) and from the Phase 1 mock.
- **Volume HUD drag and mute glyph**: needs a volume change.
- **QAM and bar gamepad traversal**: see §0.2.
- **Settings values**: never changed. Expanded states that need a value change (Downloads bandwidth limit, schedule times, Remote Play advanced options) are listed as conditional.
- **SteamVR Settings modals** (dropdown popovers, Per-Application Video Settings, Edit Chaperone Appearance, Choose Startup Overlay Apps, Manage Add-Ons, Thumbstick Settings, Test Controller): one click from a setting or a tool, so not opened.

---

## A. Function list

"Laser" = controller laser (`:hover`, laser focus). "Gamepad" = Steam's FocusNavController (`.gpfocus`) or SteamVR's own focus where stated. **—** = no path today. Every row must stay reachable both ways after the redesign; a row that is "—" for gamepad today may gain a path but must not lose its laser path.

### A.1 Steam Settings (surface `main`, `/settings/*`)

#### A.1.1 How settings are reached

| from | laser | gamepad |
|---|---|---|
| VR main menu (`frame.menu`) › Steam Settings | click (menu visible only with the laser, SN A.3) | D-pad Left at a page edge or B at the window root, then Up/Down + A |
| Bar › Steam tab hover menu › Steam Settings | hover the tab, click | bar focus (View), Steam tab (whether focus opens the menu is unverified, SN A.3 N4) |
| QAM rows that lead into settings (Wi-Fi network row, Bluetooth "Add Device"; targets not exercised) | click | inside the QAM: D-pad + A (unverified, §0.4) |

#### A.1.2 Skeleton interactions (every page)

| # | function | laser | gamepad (verified with `L.pad` unless noted) |
|---|---|---|---|
| S1 | Choose a page | click a sidebar row (256 × 42 px, 24 rows in a list that scrolls: 1115 px of content in 678 px) | D-pad Up/Down in the sidebar. **Selection follows focus**: each step loads that page at once (`/settings/power` → down → `/settings/audio` → down → `/settings/controller/...`), each with the 320 ms page transition |
| S2 | Enter the page | click any control | D-pad Right from the sidebar lands on the first row |
| S3 | Move between rows | point | D-pad Up/Down. Focus lands on the **control** inside a row (the dropdown button, the toggle), and the row highlights through `.gpfocuswithin` |
| S4 | Return to the sidebar | click it | D-pad Left from a row (verified), or B |
| S5 | Operate a toggle | click the toggle (38 × 22 px); the whole row also carries an `onClick` handler, so the row is probably a target too (not clicked: it would change a value) | A on the focused toggle |
| S6 | Choose a dropdown value | click the button (250 × 40 px) → a centred gamepad context menu with a trailing **Cancel** (§A.1.4) | A, then Up/Down + A; B cancels |
| S7 | Adjust a slider | drag or click the 6 px track / 24 px knob | focus, then Left/Right steps the value; the footer shows "B Done" while a slider is focused |
| S8 | Press a button | click | A |
| S9 | Edit text | click → VR keyboard (`keyboard` surface) | A → keyboard |
| S10 | Segmented choice | click a segment (309 × 32 px) | D-pad Left/Right + A (FocusRing shown) |
| S11 | Checkbox | click the 22 × 22 px box | D-pad across the four columns + A (FocusRing shown) |
| S12 | Explainer ("Press [Y] for more info", Display) | **footer legend "Y" only** (SN A.4: the legend is the laser's only route) | Y |
| S13 | Item actions on Storage app rows (Uninstall, Move Content) | **footer legends only** | X / Y |
| S14 | Scroll a long page | wheel/drag in the page scroller | focus moves scroll the page (scroll-padding 250/60 px) |
| S15 | Leave settings | Back, or any navigation | B from the sidebar |

#### A.1.3 Pages, controls and side-effect actions

Counts from `settings_sweep.js`. "Rows" = field rows; "foc" = focusables in the page. **[x]** = performs an action (never pressed during the audit). The full row-by-row list is in Appendix 1.

| page | rows / foc / height | content | dialogs and sub-pages | actions [x] |
|---|---|---|---|---|
| System | 46 / 68 / 3335 px (4.6 screens) | Language; Updates; Beta channels (OS, Steam client); 24-hour clock, Timezone (rich dropdown, 96 px row), Desktop Mode on startup, Developer Mode; Crash reports (1 toggle + 6 disabled); About (8 info rows + Hostname); SteamVR (3 info); Steam (4 info + Licences); Hardware (10 info); Advanced (4) | Hostname rename (Cancel / Change & Restart); Timezone menu (64 options) | Apply update, Run Diagnostics, Create Report, Run maintenance, **Factory Reset**, Change & Restart |
| Internet | 8 / 14 / 809 | Wi-Fi toggle; connected networks; networks found; Other network…; Offline Mode; HTTP Proxy; Delete Web Browser Data | network details (Disconnect), proxy, SSID/password form | Enter Offline Mode, Delete, Disconnect, connect |
| Storage | — / 55 / 720 | drive tabs (2, 238 × 50 px), usage bar + legend, sort dropdown, **virtualized** app list (58 px rows) | selection mode | Uninstall, Move Content (footer X/Y) |
| Bluetooth | 8 / 12 / 720 | Bluetooth toggle, Show all devices; paired devices (1 connected, 5 greyed); "Searching for devices…" | — | pair, connect, disconnect, forget |
| Display | 1 / 3 / 720 | Maximum Game Resolution (dropdown) | explainer (Y) | — |
| Power | 5 / 11 / 720 | **Battery Percentage** ("Show battery percentage on dashboard bar", off on this device); dim/sleep timeouts on battery and plugged in (4 dropdowns) | — | — |
| Audio | 7 / 17 / 802 | output slider, output device, Spatialization; Apps (empty); mic slider, input device; UI sounds | — | Reset audio settings |
| Controller | 3 / 8 / 720 | Steam Frame Controllers › Details; Add Controller; Show Advanced Settings | **Controller › Advanced** sub-page (own back button): idle shutdown dropdown, Desktop Layout Edit (configurator), firmware Start | Add Controller (pairing), firmware Start |
| Keyboard | 15 / 41 / 1299 | keyboard theme + preview button, Points Shop link, haptics, initial location ×2; active keyboards (Edit); 8 Quick Chat text inputs | layouts dialog (tall, scrolls) | — |
| Accessibility | 4 / 9 / 720 | High Contrast, Reduce Motion, Color Filter, Mono Audio | — | — |
| Security | 2 / 4 / 720 | lock-screen description, "On system wake and power up" | — | — |
| Notifications | 31 / **144** / 2512 | toast policy dropdown, toast sound; 4 client + 4 friend rows with **two** toggles each (Show Toast / Play Sound); "Flash window" segmented; 5 checkbox-matrix sections (Email / Toast / Mobile / Feed, sticky column headers); email opt-out | — | — |
| Friends & Chat | 16 / 38 / 1231 | 9 friends-list toggles (first embeds a preview friend), 7 chat toggles, Chat Filtering Manage (web), Chat Font Size segmented | — | — |
| Downloads | 8 / 20 / 887 | region, speed limit, bits/s, schedule auto-updates, during gameplay, while streaming, LAN transfers, transfer audience | conditional bandwidth and time pickers | — |
| Cloud, In Game, Compatibility | 2 each | Steam Cloud, screenshot management; screenshot UI, Steam Networking; default compatibility tool, show all tools | — | — |
| Family | 0 / 3 | text, Steam Families link, Try Steam Families (primary) | — | create/join family |
| Remote Play | 13 / 32 / 1372 | enable; host rows (Connect), Pair Steam Link; direct connection, PIN; advanced host/client; streaming adapter (enable, management, Unpair, connected host, advanced Wi-Fi); FAQ | Set PIN | Connect, Pair, Unpair |
| Game Recording | 8 + 3 cards / 24 / 1193 | recording mode radio cards (73–105 px tall); FAQ; controller shortcuts; quality (dialog), frame rate, max height; record mic; record audio from (disabled) | Recording Quality dialog | Set shortcut |
| Home | 5 / 10 / 720 | Big Art Mode, personalized store, What's New filter, hidden games (Manage → Library), instructions row | — | — |
| Library | 3 / 7 / 720 | Low Performance Mode, Deck compatibility info, Add game | Add game (product code) | Confirm |
| Store | 7 / 15 / 720 | 7 "Manage" buttons that open store web pages | web pages | — |
| Developer | 33 / 67 / 2569 | profiling, dev-kit pairing, Steam Play, Wi-Fi, 19 miscellaneous rows (composite, colour, Mura, SD format, console, browser composers, password, HDR, hardware updates), Steam Input (3) | — | Pair new host, Speaker Test, Re-arm Mura, **Format SD**, Clear All, Open console, Change User Password, Update all devices |

#### A.1.4 Shared primitives inside settings

| primitive | size today (CSS px) | laser | gamepad |
|---|---|---|---|
| sidebar row | 256 × 42 (scale 1.1 when active/focused) | click | Up/Down (selection follows focus) |
| field row | 952 wide; 46 (label only), 64 (with description or 40 px control), 47 (info), 80–96 (two-line or rich) | row click on toggle rows (probable) | highlight via `gpfocuswithin` |
| toggle | 38 × 22 | click | A |
| dropdown button | 250 × 40 (rich: 250 × 72) | click | A |
| dropdown menu | centred sheet, rows 48 px (rich 80 px), min 280 px wide, ends with Cancel | click | Up/Down, A, B |
| button | 160–331 × 40 | click | A |
| slider | 896 × 24 control, 6 px track, 24 px knob | drag | Left/Right |
| text input | 250 × 40 | click → keyboard | A → keyboard |
| segmented | 309 × 32 per segment | click | Left/Right + A |
| checkbox | 22 × 22, columns ≈ 60 px apart | click | D-pad + A |
| radio card | 952 × 73–105 | click | Up/Down + A |
| modal dialog | 660 px card, buttons ≈ 278 × 40 | click; click outside = cancel | Left/Right, A, B |

### A.2 SteamVR Settings (`vr:systemui`, frame page `system.settings`)

Reached from **VR main menu › VR Settings** or the **Steam tab menu › VR Settings**. Both switch the Steam dashboard frame to SteamVR's page, so Steam's window disappears while it is shown. **Laser only**: SteamVR shows "USE LASER MOUSE TO INTERACT" under the window and draws no gamepad focus. Leaving it: pick a Steam item from the main menu or the Steam tab.

Layout: a 1858 × 1045 px panel; a 416 px sidebar with 8 section rows (416 × 74 px) and an **Advanced Settings Hide | Show** segmented control at its foot (currently **Show**); a 1442 px page.

| section | settings (control) — **ADV** = shown only with Advanced Settings: Show |
|---|---|
| General | Refresh Rate (7 circles, 72–144 Hz, 85 px), Display Brightness (slider, value on the knob), Motion Smoothing (Off/On), Notifications (Off/On); ADV: IPD HUD, Eye Tracking, Dominant Eye (dropdown), Track Dominant Eye Only |
| Play Area | Chaperone: Edit Chaperone Appearance (button → editor); Environment: Environment Style (picker, 919 px tall block), Content-Aware Aurora Color, Content-Aware Camera Tint; Reset Page to Default |
| Dashboard | Laser Pointer Length (slider), Grab Handle Acceleration (slider); ADV: Dim Game When Dashboard Visible, Allow App Quitting From Dashboard, **Show VR Settings** (hides the VR Settings menu entry when Off), Present Non-VR Applications on Theater Screen, Allow Undocked Dashboard Overlay Interaction, Theater Curvature, Theater Alignment, Keyboard Privacy |
| Controllers | Show Binding on Controllers, Manage Controller Bindings (→ `vr:controllerbindingui`), Edit Thumbstick Settings, Test Controller, Debug Legacy Input, Input Debugger; ADV: Show Binding UI |
| Video | Refresh Rate, Display Brightness, Motion Smoothing (the same three as General), Fade To Grid on App Hang, Per-Application Video Settings (app picker → resolution, FOV, refresh override, frame limit, throttling, prediction, world scale), Foveated Sharpening; ADV: Advanced Supersample Filtering, Overlay Render Quality, Pause VR When Headset Is Idle; Reset Page to Default |
| Camera | Room View (Off/On), Anti-Flicker (3-way), Dynamic Resolution (gaze-based), Room View Style (dropdown); Reset Page to Default |
| Startup / Shutdown | Choose Startup Overlay Apps (0), Manage Add-Ons (1 disabled), Turn Off Displays After, Turn Off Controllers After; Reset Page to Default |
| Developer | Performance assessment overlay and textures; reprojection depth and motion vectors; smooth spectator view, input-binding debugging, global input from overlays, Arcade Mode; Quick Calibrate, Chaperone bubble, Chaperone System, Record Tracking Data; version info (3 rows) |

Controls: radio circles, sliders with the value on the knob, Off/On segmented pills (`.SegmentedControlGroup::after` sliding thumb), dropdowns (popover inside the panel), full-width ALL-CAPS buttons, purple fills for Advanced controls. Every row: label 24 px, control 499 × 64 px.

### A.3 Dashboard bar (surface `bar`, 1200 × 80 px window)

Live today: Steam tab; no app tabs; +; three small buttons; Quick Access; avatar (`bar_focus_all_after.png` shows two extra tabs that come and go with open windows).

| # | function | laser | gamepad | size (px → °, bar 0.037°/px) |
|---|---|---|---|---|
| B1 | Select the Steam frame | click the Steam tab | View ("Cycle View") to the bar, Left/Right, A | 80 × 80 → 2.96° |
| B2 | Steam tab menu: Home, Library, Store, Friends & Chat, Media, Downloads, (Console), Steam Settings, VR Settings, Power | **hover** the tab (200 ms) | unverified | rows 40 px → 1.48° |
| B3 | Switch to an app / desktop-window tab; its menu (Close) | click; hover | Left/Right + A | 80 × 80 |
| B4 | **+**: Launch Program / Add Desktop Window list (incl. Liquid Glass) | click | A (D-pad Up opens popups) | hit 54 × 48 → 2.0 × 1.8°, visible circle 34 px → 1.26° |
| B5 | Playspace Menu: Playspace Setup, Adjust Floor Height, **Recenter** | click → 212 × 141 card, rows 40 px | A, Up/Down, A | hit 54–63 × 80, visible 48 px → 1.78° |
| B6 | Toggle Room View (passthrough) | click (toggle, no popup) | A | same |
| B7 | Streaming Status: Select game to stream, host list, Advanced › Stream VR Without Game | click | A | same |
| B8 | Quick Access (§A.4) | click the clock/status cluster | A | 135 × 80 → 5.0 × 2.96° |
| B9 | Read time and status (§A.7) | look | look | clock 22 px → 0.81°; icons 18 px → 0.67° |
| B10 | Account page | click the avatar → `/account` | A | 79 × 86 |
| B11 | Tooltips (names of every button) | hover | focus | 16 px text → 0.59° |
| B12 | Conditional buttons: download progress, Family View / Kiosk lock, unformatted SD, low disk, Steam connection warning, voice chat | click | A | same primitives |

Popups close 2 s after the pointer leaves (100 ms when gamepad focus leaves), on any outside click, on B, and when another popup opens.

### A.4 Quick Access (surface `barpopup`, card 300 × 440 px, opens on Quick Settings)

Tabs sit at the **bottom**: 5 icon-only tabs, 60 × 48 px (2.2 × 1.8°). The content panel shows 343 px at a time.

| tab | content (live) | scroll | functions |
|---|---|---|---|
| Notifications | "No new notifications" today. With items: **pinned** cards first (Battery Low, Low Disk Space, unclaimed rewards, gifts, friend requests, comments, unread chat, inventory items, trade offers, turns, community messages, support replies, family invites), then unread notifications as rows with dividers | as needed | open a notification's target (click / A). No "view all" or history in VR: there is no notifications route (`social.md` §10) |
| Quick Settings | Brightness: **Brightness**, **Environment Brightness** sliders (237 × 28); Audio: **Volume**, **Microphone Volume** sliders (240 × 24, mute icons); Other: **Wi-Fi** toggle + current network row, **Bluetooth** toggle + 6 device rows (5 greyed) + **Add Device**, **Airplane mode** toggle | 870 px in 343 (**2.5 screens**; every toggle is below the fold) | drag sliders / Left-Right; click mute icons; toggles; network row and device rows open settings or connect |
| Performance | System Profile (2-notch slider), Basic View; Manual GPU Clock; Non-VR: Performance Overlay Level (5 notches), Disable Frame Limit, Scaling Mode (5), Scaling Filter (3); VR: Show Perf Overlay in VR, Record VR Performance, Record Tracking, **Refresh Rate** (72 \| 144 notched slider), **Motion Smoothing**; Reset to Default | 1059 px (**3.1 screens**) | sliders, toggles, Basic View, Reset |
| Battery Info | headset ("Full", 36 px, 24 × 40 icon; no percentage); one row per connected controller ("Right Controller 21 %" with a 1-step icon and a yellow "!") | none | the headset row is clickable (target not exercised) |
| Help | Visit Help Site, Report a Bug, Replay Guided Tour, Show Frame Tutorial Videos (267 × 40) | none | each opens a web view or a tour |

Gamepad (from the inventory and source; not exercised, §0.2): A on the bar's Quick Access opens it with the Quick Settings tab focused; the tab row is a horizontal group; D-pad moves into the content; B closes. With an active battery alert, opening the QAM jumps to Battery Info and a yellow/red **Low Battery** banner shows.

### A.5 Power menu (in `main`, context-menu sheet)

Reached from **VR main menu › Power** (laser-visible menu, or D-pad Left / B at root), the **Steam tab menu › Power**, nowhere else (not in the QAM). Items: Sleep, Shutdown, Restart Device, Restart Steam VR | Change Account, Sign Out, Restart Steam | Cancel. Every item except Cancel opens a confirmation dialog (OK / Cancel). Rows 48 px (1.47°), 16 px text (0.49°), title "Power" floating above the sheet (18 px). First focus is timing-dependent: Restart Steam VR in the stock capture, Sleep in the themed one (SN A.7).

Related system actions elsewhere: System › Advanced (Factory Reset and three maintenance tools), SteamVR Startup / Shutdown (turn off displays / controllers after), Steam Settings › Power (dim / sleep timeouts).

### A.6 Volume HUD (`volumelevel`)

| function | laser | gamepad |
|---|---|---|
| See the volume level after a hardware volume press (1 s, re-armed per press) | display only (`interactive:false`; a drag is accepted while it shows, but the popup ignores focus) | — |

Shape: 250 × 34 px capsule (≈ 14.7 × 2.0° [inferred]), 6 px track (≈ 0.35°), 20 px speaker glyph that changes with level, no handle, no number, no device name. **Head-locked** 0.4 m below and 0.8 m ahead of the eyes (≈ 27° below the horizon), pitched −20°.

### A.7 Battery and status

| where | what | size | interaction |
|---|---|---|---|
| Bar status cluster (inside the Quick Access button) | headset battery glyph (green fill; a small yellow "!" was showing while the right controller was at 21 %), volume glyph, Wi-Fi glyph; conditional: controller batteries (not during a low-battery alert), Steam connection warning, unformatted SD, **notifications bell** with a blue dot when unread items exist | glyphs 18 px (0.67°), battery 26 × 18 (0.96 × 0.67°). No tooltips (status items have no `vrTooltip`) | not separate targets: a click anywhere opens the QAM |
| Battery percentage on the bar | only when Settings › Power › **Battery Percentage** is on (off here) | — | the user's setting |
| QAM › Battery Info | headset level word ("Full"), controller rows with % | 36 px headline; rows 44 px | look |
| QAM low-battery banner | yellow or red strip; auto-jump to Battery Info | — | look |
| Low-battery toast | Notifications setting "When a controller's battery is low" (toast + sound) | toast (§A.8) | look |
| SteamVR controller status | 256 × 256 texture on the controller model's status area: hand or gamepad glyph, battery **PNG** in 5 levels + charging, 3 connection dots | on the controller | look |
| Clock | bar, 22 px Semibold, tabular | 0.81° | look |

### A.8 Notifications

| # | function | laser | gamepad |
|---|---|---|---|
| NO1 | See that something is unread | bell glyph in the bar (18 px) | same |
| NO2 | Read the list | QAM › Notifications (first tab, but the QAM opens on Quick Settings) | View → bar → Quick Access → A → Left to the first tab (unverified) |
| NO3 | Act on a notification | click its row / pinned card | A |
| NO4 | Read a toast as it arrives | Steam toast: 300 × 40 card, 11 px title, 12 px body, 40 px logo (10.2 × 1.36°; text 0.37–0.41°); laser hover fill; click behaviour unverified | — |
| NO5 | SteamVR's own toasts (`notificationtoast.html`) | 100 px image + 2-line header + 3-line text in a blue gradient frame | — |
| NO6 | Configure | Steam Settings › Notifications (144 focusables) and SteamVR › General › Notifications (Off/On) | Steam: yes; SteamVR: — |

### A.9 One function, many homes

The system functions are spread over **seven surfaces in two apps** (Steam Settings, SteamVR Settings, Quick Access, bar buttons, bar popups, the Power menu, SteamVR frame controls). Many appear more than once, each time with a different control:

| function | Quick Access | Steam Settings | SteamVR Settings | bar | elsewhere |
|---|---|---|---|---|---|
| Output volume | slider | Audio slider | — | glyph | volume HUD |
| Microphone volume | slider | Audio › Voice slider | — | — | — |
| Display brightness | Brightness slider | — | General **and** Video slider (125 %) | — | — |
| Refresh rate | Performance notched slider | — | General **and** Video, 7 circles | — | — |
| Motion smoothing | Performance toggle | — | General **and** Video, Off/On | — | — |
| Room View (passthrough) | — | — | Camera › Room View, Room View Style | Room View button | — |
| Recenter / floor | — | — | Developer › Quick Calibrate | Playspace Menu | — |
| Wi-Fi | toggle + network row | Internet page | — | glyph | — |
| Bluetooth | toggle + devices + Add Device | Bluetooth page | — | — | — |
| Performance overlay / tracking recording | Performance toggles | — | Developer (assessment overlay, Record Tracking Data) | — | — |
| Notifications | list | policy + matrices | Off/On | bell | toasts |
| Controller bindings | — | Controller › Desktop Layout | Controllers › Manage Bindings | — | Now Playing |
| Keyboard | — | Keyboard page | Dashboard › Keyboard Privacy | — | frame control Show Keyboard |
| Power / session | — | System › Advanced; Power timeouts | Startup / Shutdown | — | Power menu |

Redesigns must keep **every** home (they are all real paths) but can make one of them the obvious one.

---

## B. VR UX critique

### B.1 Target sizes

| control | size (px) | angle (limiting side) | vs 2.5° | visionOS equivalent (refs 3, 8) |
|---|---|---|---|---|
| Settings sidebar row | 256 × 42 | **1.29°** | 52 % | sidebar row pitch 52–60 pt ≈ 2.2–2.5° |
| Settings field row (toggle rows are probably whole-row targets) | 952 × 46 / 64 | 1.41° / 1.96° | 56 % / 78 % | grouped row ≈ 52–60 pt |
| Settings toggle | 38 × 22 | **0.68°** tall | 27 % | switch 51 × 31 pt ≈ 2.1 × 1.3° inside a ≥ 2.5° row |
| Settings dropdown / button | 250 × 40 | 1.23° | 49 % | pop-up button 44 pt ≈ 1.8° in a 2.5° row |
| Settings slider (knob / track) | 24 / 6 | **0.74° / 0.18°** | 30 % | capsule slider ≈ 56 pt ≈ 2.3° |
| Settings checkbox (Notifications matrix) | 22 × 22, columns 60 px apart | **0.68°**, pitch 1.84° | 27 % | none: visionOS uses toggles or menus |
| Settings segmented segment | 309 × 32 | 0.98° | 39 % | segmented ≈ 44 pt ≈ 1.8° |
| Dropdown menu row | 48 | 1.47° | 59 % | menu row ≈ 44–52 pt |
| QAM tab (icon only) | 60 × 48 | 1.78° | 71 % | — (CC has no tabs) |
| QAM slider row / knob / track | 44–48 / 24 / 6 | 1.6–1.8° / **0.89° / 0.22°** | 36 % (knob) | CC slider 56 pt ≈ 2.3°, the whole capsule is the target |
| QAM toggle / toggle row | 38 × 22 / 42 | 0.81° / 1.55° | 32 % / 62 % | CC toggle circle 44 pt ≈ 1.8° at 61 pt (2.5°) pitch |
| QAM device / Help rows | 40 | 1.48° | 59 % | CC platter rows ≈ 52 pt ≈ 2.2° |
| Bar small button (visible / hit) | 48 / 54–63 × 80 | 1.78° / 2.0–2.3° | 71–92 % | — |
| Bar small-button centre spacing | 54–63 | **2.0–2.3°** | below the 2.5° spacing rule | — |
| Bar + (visible / hit) | 34 / 54 × 48 | 1.26° / 1.78° | 50 % / 71 % | — |
| Bar Steam tab, QAM button, avatar | 80+ | ≥ 2.96° | OK | — |
| Playspace / tab-menu rows | 40 | 1.48° | 59 % | — |
| Power menu row | 48 | 1.47° | 59 % | menu row ≈ 2.2° |
| SteamVR Settings sidebar row | 416 × 74 | ≈ 1.56° | 62 % | — |
| SteamVR Settings radio circle / Off-On pill / button | 85 / 64 / 64 | ≈ 1.79° / 1.35° / 1.35° | 54–72 % | — |

**Findings**

1. Every system control except the bar's large tabs is **0.7–2.0°**, a quarter to three quarters of the visionOS minimum. The worst are the ones adjusted most often: **slider knobs and tracks (0.18–0.89°)**, **toggles (0.68–0.81°)**, the Notifications **checkboxes (0.68°)**.
2. The QAM uses the bar's slightly larger angle (0.037°/px) but packs Steam Deck's handheld layout into it: the sliders are thin lines meant for a thumb on a touch screen.
3. Small-button centres on the bar are 2.0–2.3° apart: adjacent buttons (Playspace, Room View, Streaming) sit closer than the 60 pt spacing rule, and Room View is a one-click toggle of the user's view of the room.
4. SteamVR's page is drawn bigger in pixels (64–85 px controls) but at ≈ 0.021°/px it lands at the same 1.3–1.8°.

### B.2 Legibility

| text | size | angle | vs 0.70° body |
|---|---|---|---|
| Settings labels, values, dropdown text | 16 px | 0.49° | 70 % |
| Settings descriptions | 12 px | **0.37°** | 53 % |
| Settings section headers / page title | 16 / 22 px | 0.49° / 0.68° | — |
| QAM section headers (stock: uppercase, tracked) | 16 px | 0.59° | 84 % |
| QAM notch labels ("PERFORMANCE", "PLAYTIME", "OFF 1 2 3 4") | 10 px bold uppercase | **0.37°** | 53 % |
| QAM rows, Help buttons | 16 px | 0.59° | 84 % |
| Bar clock | 22 px | 0.81° | OK |
| Bar status glyphs | 18 px | **0.67°** for a battery level read from a glyph | — |
| Toast title / body | 11 / 12 px | **0.37 / 0.41°** | 53–58 % |
| Power menu | 16 px | 0.49° | 70 % |
| SteamVR Settings labels / descriptions | 24 px / ≈ 22 px | ≈ 0.51° / 0.46° | 73 % |
| SteamVR buttons | 24 px ALL CAPS | ≈ 0.51° | uppercase loses word shape |

**Findings**

- Every settings description, every notch label and every toast line is at **0.37–0.41°**, about half of visionOS body text and below the visionOS 12 pt (0.49°) minimum.
- Status is read from **glyphs**: an 18 px battery glyph at 0.67° is the only always-visible battery indicator. visionOS Control Center prints "100" inside a green battery capsule (ref 3).
- Grey on glass compounds the size problem: info values (`LabelFieldValue`), descriptions and disabled rows are all mid-grey 12–16 px text.

### B.3 Information architecture

1. **Two settings apps in one place.** "Steam Settings" and "VR Settings" sit next to each other in the main menu but are different apps: different type scale, ALL-CAPS buttons, Off/On pills instead of switches, purple "advanced" fills, a different selection look, and **no gamepad support** in SteamVR's (a "Use Laser Mouse to Interact" banner). visionOS has one Settings app.
2. **Duplicates with different controls** (§A.9). Refresh rate is a notched slider in the QAM and seven circles in SteamVR (twice: General and Video). Brightness is a QAM slider and a SteamVR slider with a percentage. The user cannot tell they are the same setting.
3. **24 sidebar pages, 3 hairline separators, no grouping labels, no icons in colour.** The list scrolls (1115 px in 678 px) so Library, Store and Developer are below the fold. visionOS Settings groups rows with gaps and colours each icon circle (ref 8).
4. **Selection follows focus in the sidebar.** Moving the D-pad from System to Developer loads every page in between (each with a 320 ms slide). This is Steam Deck's behaviour; it costs little on a handheld but makes the 38° window flash in a headset.
5. **Page length is uneven.** System is 46 rows over 4.6 screens and mixes language, updates, clock, crash reports, 25 read-only info rows and the destructive Advanced tools. Notifications has **144 focusables**. Ten pages have 1–3 rows each.
6. **Danger looks like everything else.** Factory Reset, Format SD, Delete Web Browser Data, Unpair and Change & Restart are the same grey 160 × 40 buttons as "View FAQ". visionOS colours destructive buttons red.
7. **Desktop leftovers.** Notifications › "Flash window when I receive a chat message" (Always / Only when minimized / Never) has no meaning in a headset; Keyboard › "Initial Location (Desktop)"; Developer rows about composite and browser composers. They must stay reachable but need not be prominent.
8. **Quick Access is one Control Center tile carrying three tiles' content.** At the bar's scale the QAM card is **11.1 × 16.3°**, the size of **one** visionOS Control Center tile (≈ 12.1 × 17.5°, ref 3). visionOS spreads status, controls and environment over three such tiles; Steam stacks brightness, audio, Wi-Fi, Bluetooth, airplane mode, performance, battery and help into one scrolling column behind five icon-only tabs.
9. **The daily toggles are below the fold.** Quick Settings opens with four sliders visible; Wi-Fi, Bluetooth and Airplane mode need a scroll, and six mostly greyed Bluetooth device rows sit between Bluetooth and Airplane mode.
10. **Performance mixes VR and non-VR.** Half of the Performance tab is labelled "Non-VR Settings" (overlay level, frame limit, scaling) and does not apply while in VR; the VR-relevant Refresh Rate and Motion Smoothing are at the bottom of a 3-screen scroll.
11. **Notifications are a tab, not a place.** The first QAM tab, but the QAM opens on the second. There is no history beyond unread items and no route for it in VR (`social.md` §10). The bell is an 18 px glyph with a dot.
12. **Power is navigation, not a system control.** It sits at the bottom of the main menu and the Steam tab menu; the QAM has none. Account actions (Change Account, Sign Out, Restart Steam) share the sheet with device power. visionOS keeps power off the navigation entirely.
13. **Recenter is two clicks deep in a small-button popup** (Playspace › Recenter), and also a SteamVR Developer row (Quick Calibrate).

### B.4 Ergonomics

- **Label-to-control travel.** In Steam Settings each row is 952 px wide; the label starts at x ≈ 304 and the control is right-aligned at x ≈ 1110–1230. Reading a label and then aiming at its toggle sweeps **25–28°** for every row, beyond comfortable eye-only rotation (≈ ±15°). The sidebar adds another 8° to the left. visionOS Settings rows sit in a platter about 55 % of the window wide with the value next to a chevron (ref 8).
- **Gaze stack for system tasks.** Window (centre) → bar (0.44 m below the dashboard origin, 13 cm nearer) → QAM growing up from the bar (16° tall). Checking the battery means looking down at an 18 px glyph; adjusting volume means opening a popup and aiming at a 6 px track.
- **Volume HUD at ≈ 27° below the horizon, head-locked.** It follows the head, so it never leaves the view, but it sits at the bottom edge of the comfortable field and moves when the user looks for it. visionOS avoids head-locked content (VR §22) except for brief system indicators placed near the top of view.
- **Laser arm posture.** Thin targets in the QAM (0.22° tracks) need a steady wrist at the lowest point of the UI stack.

### B.5 visionOS comparison (refs 3 and 8)

| trait | visionOS Control Center (ref 3) | Steam Quick Access today |
|---|---|---|
| Structure | three separate portrait glass tiles (status + Now Playing + notifications; controls; environment), close button below | one 300 × 440 card, 5 icon-only bottom tabs, vertical scroll |
| Toggles | 44 pt circles, blue fill when on, white glyph, 61 pt pitch | 38 × 22 px switches at row ends |
| Sliders | 56 pt capsules; the value is a white fill with the dark glyph inside it | 6 px track with a 24 px knob, glyph outside |
| Rows | recessed inner platter, glyph + label, no separators | full-width rows with 1 px dividers |
| Status | large clock, battery capsule with the number, network glyphs | none in the QAM (the bar shows a clock and 18 px glyphs) |
| Notifications | "35 Notifications ›" capsule row in the status tile; expands on look | a whole tab, first position, not the default |

| trait | visionOS Settings (ref 8) | Steam Settings today |
|---|---|---|
| Sidebar | ≈ 36 % of the window, darker tone, no line; rows with coloured circular icons; groups separated by space; search capsule at the top; selection = lighter pill (not white) | 256 px column; grey glyphs; 3 hairlines; no search; Phase 1 selection = **white** pill with a ring |
| Detail | circular back button top-left on sub-pages, centred bold title, grouped rows in a recessed platter, trailing value + chevron, status block centred | left-aligned 22 px title, full-width grey rows with 6 px gaps, controls at the far right |
| Sizes | row pitch ≈ 52–60 pt (2.2–2.5°), body 17 pt (0.70°) | 46–64 px rows (1.4–2.0°), 16 px labels (0.49°), 12 px descriptions |
| Destructive | red labels / red buttons | grey buttons |

### B.6 Motion against the Liquid Glass spec (MO §3–5)

| element | today | spec | verdict |
|---|---|---|---|
| Settings page switch | new page slides `translateY(±12 %)` (86 px of a 720 px window) + fades in over 320 ms after an 80 ms delay; old page exits 80 ms. Runs on **every** D-pad step in the sidebar (B.3.4) | sidebar selection = content cross-fade on `page`/`fade`, ≤ 16 px parallax (M1), no delay; retarget on auto-repeat (C5) | fails M1 (a 38° surface slides) and C5 (repeated steps queue slides) |
| Toggle knob | `transform .2s cubic-bezier(.1,.12,.53,1.72)` (≈ 20 % overshoot) | `snappy`, overshoot ≤ 0.6 %, optional lift on press (MO §4.15) | too bouncy |
| Slider knob on focus | 200 ms pop from `scale(1.4)` | grab lift ×1.25 on `interactive`, settle `snappy`; no pop on mere focus (MO §4.16) | wrong trigger |
| Focus fills | `ItemFocusAnim` keyframes, 0.5 s `forwards` | illumination in `hover-in` (294 ms), out `fade` | slow, and blocks theme colours (needs `!important`) |
| Settings FocusRing (segmented, checkbox, radio cards, links) | grow + fade + `Blinker` 20 × 1.2 s | static glow, no pulse (C7) | Phase 1 neutralised the pulse; keep |
| QAM tab content | `translateY(±8–12 %)` + fade, 320 / 80 ms | `page` cross-fade, ≤ 16 px | slide too large for a 16° card |
| QAM container | `transition: opacity 2s` | materialize small glass 250 ms in / 350 ms out (MO §3.2) | too slow |
| Bar popups | appear instantly (popup window shown) | morph from the source button, `morph-open` 607 ms / `morph-close` 441 ms (MO §4.6) | no materialize |
| Volume HUD | opacity .5 s `cubic-bezier(0,.73,.48,1)` on the popin; mount/unmount | materialize in place 250 ms, out 350 ms | close; add the glass channel |
| Toasts (VR) | no motion (VR keyframes are opacity 1 → 1), then opacity exit | materialize in place, dematerialize (MO §4.10) | no entrance |
| Bar small button press | `ClickPop` keyframe scale 1.1 at 5 %, `:active` scale .9 | press swell ≤ ×1.06, `interactive` (C4) | slightly large |
| Sidebar active item | `ScaledChildren` scale 1.1 | navigation selection = lighter pill, no scale on rows (VR §12) | scale on a high-use row |
| SteamVR segmented thumb | `::after` slides with `transform` | selection travel on `snappy` with brief lift (MO §4.5) | timing only |
| Reduce Motion | Phase 1 sets every duration to 1 ms | keep fades, remove motion (MO C8) | Phase 1 rule must change |

### B.7 Materials against the brief (Phase 1 state)

- **Outlines.** The QAM card, bar segments, settings sidebar pill and dropdown buttons show a 1 px light ring (`p2_sys_qam_settings_on.png`, `p2_sys_bar_on.png`). The brief: glass slabs whose edge comes from the shader. The 1 px dividers between QAM rows and under settings rows are hairlines the Frame renders at 0.6 display px (VR §1.5) and they shimmer.
- **Selection vocabulary.** Phase 1 paints the current settings page and the current QAM tab as a **white** pill with a dark label. visionOS reserves white for toggled buttons and the selected segment; navigation selection is a lighter translucent pill (VR §14, REF finding 5).
- **No frost.** The QAM and every bar popup are their own quads over the room, painted with tint + sheen. They are the easiest surfaces in the UI to give real glassd glass (T5), because nothing of Steam's is behind them.
- **Fill polarity is inverted.** Settings rows are *lighter* than the window (white fill); visionOS platters are *recessed* (darker) and buttons raised (REF D.4).
- **No depth.** Bar, QAM, dropdown menus and dialogs all lie on their own planes, but nothing inside the window pops.

### B.8 Safety and functional risks found

- **Power menu first focus** can land on Restart Steam VR (SN A.7). Account and device actions share one sheet.
- **One-click toggles beside navigation:** Room View is a 48 px circle between Playspace and Streaming on the bar, at 2.0–2.3° pitch.
- **Hidden laser paths:** Storage Uninstall / Move Content and the Display explainer exist only as footer legends for the laser (SN C.4). A redesign that changes the footer must keep them.
- **SteamVR "Show VR Settings" (Dashboard, ADV)** can remove the VR Settings menu entry; the redesign must not rely on that entry being present.
- **Disabled rows** (6 crash-report toggles, greyed Bluetooth devices, "Record Audio from…") must stay visibly disabled after any restyle.

---

## C. Redesign opportunities, ranked by impact

Impact = how often the user meets it × distance from visionOS × how much it fixes size, legibility or navigation. Tiers: **T1** CSS incl. layout, **T2** DOM augmentation, **T3** new views from Steam's React/gamepad components, **T4** spatial compositor, **T5** glassd materials.

Rules that apply to every item (from the brief and SN §C):

- Steam's nodes keep their identity, focusability, handlers and order; T2 only adds. Nothing hides (`audit` GONE/HIDDEN/SHRUNK/UNCLICKABLE stay 0; "moved > 24 px" is expected).
- **D-pad direction must match the visual layout.** A CSS reflow that turns a column of focusables into a grid changes what Up/Down/Left/Right reach. Every layout change below is verified with `L.pad` traversal (it works in `main` today, §A.1.2).
- New paths may be added (T3), existing paths are never removed. A new control that performs an existing action calls the **same** Steam or SteamVR handler.
- Phase 2 motion follows MO §3.2 tokens; reduced motion keeps fades (MO C8).

### C.0 Prerequisites (do first)

1. **Scalable primitives** (CS1–CS3). Toggles, sliders, checkboxes and segmented controls are the bottleneck of every system surface. Their geometry is encoded in Steam's transforms (toggle knob `translateX(16px)`, slider knob `translateX(calc(…))` from `--normalized-slider-value`), so width/height changes break them. Two candidate T1 routes:
   - **Independent `scale`** on the control (e.g. `scale: 1.75` on `%{*GamepadDialogContent>Toggle}`): scales the knob travel with the rail and, because transforms move hit-testing, also enlarges the target. Steam already uses `scale: -1 1` on toggles in RTL, so the RTL rule must become `scale: -1.75 1.75`. Verify the hit box with `elementFromPoint` sweeps.
   - **Taller slider hit area** without moving the track maths: grow `S>SliderControl`'s padding or a transparent `::before` inside the slider panel group so the pointer area is 56–64 px while the track geometry (`SliderTrack`, `HandleContainer`) keeps its width. Verify that Steam maps the pointer x to the value from the track's rect, not the control's.
2. **A lab helper that gives the bar gamepad focus** (Steam's `FocusDashboardBar` path) for a few seconds and hands it back, so QAM and bar traversal can be verified unattended (CS10). Today only the main window can be traversed.
3. **Popup hosts and popup scale** (CS4, mostly settled by SP §3). Steam's `vrPooledPopupStore` places every bar popup with a request that carries an offset (x, y, **z**), rotation and a **`scale`** that enlarges a popup at the same CSS size. A popup of our own in an idle barpopup host rendered at ×1.5 and stayed a laser target [PROVEN, SP E2]. Applying `z`/`scale` to Steam's **own** popups by wrapping `SendPendingInstanceParamsToSteamVR` is [PLAUSIBLE], not yet run. Limits that shape C.1:
   - host windows have fixed widths: barpopup **300 × 1024** (pool of up to 2), frame.menu 300 × 800 (up to 4), vrcontrollers 1200 × 800 (pool of 1, Steam uses it for the guided tour);
   - a newly opened popup was not visible until ≈ 2.5 s after it reported "shown": anything that must appear with the QAM has to be opened early and revealed with CSS;
   - gamepad focus across several popup windows is still open (CS5).
4. **Two global size levers** (both trade field of view for size, so neither replaces C.3):
   - **popup `scale`** for the bar's popups (QAM, Playspace, Streaming, tab menus): ×1.25 makes every QAM row and knob 25 % larger in angle with no CSS layout change, and the QAM card 13.9 × 20.4° (bigger than one visionOS tile);
   - **window scale** (SP E5b, [PROVEN]: the frame's pre-resize height 1.5 → 1.8 made the window ×1.2 with the laser target following). That grows the whole Steam window to ≈ 45° wide; it helps settings less than a layout change does and must stay a user-facing choice.

### C.1 Quick Access becomes Control Center (rank 1)

- **Problem:** B.1 (sliders 0.18–0.89°, toggles 0.81°), B.3.8–B.3.10 (one tile, 2.5–3 screens of scroll, essentials below the fold), B.2 (10 px notch labels), B.7 (outlined card, white tab pill).
- **visionOS pattern:** Control Center, ref 3 / VR §20: separate portrait glass tiles, circular toggles with whole-fill colour, thick capsule sliders with the glyph in the fill, recessed inner platter, one close circle below.
- **Proposal A (preferred): three tiles as three popup quads.** A bar-popup host is 300 px wide, exactly one visionOS Control Center tile at the bar's scale. So each tile is its **own popup**: the centre tile is Steam's real Quick Access in its barpopup host (restyled), and the two side tiles are T3 views in the second barpopup host and a frame.menu host, placed left and right of it by the popup request's offsets (SP §3.1–3.2). Three separate glass slabs with real room between them is what ref 3 shows. Side tiles are opened hidden while the theme is on and revealed with the QAM (first-paint latency, C.0.3). Each tile is **300 × 440 px** (11 × 16°), gaps ≈ 24 px:
  1. **Status tile:** clock (48–56 px, tabular), date; battery capsules for the headset and each controller **with the number inside** (T2 reads the same store the Battery tab reads); Wi-Fi and Bluetooth state glyphs; a **"N Notifications ›"** capsule (72 px) that opens the Notifications view; low-battery state as an orange/red capsule fill.
  2. **Controls tile:** a row of four **56–60 px circular toggles at 70–72 px pitch** (Wi-Fi, Bluetooth, Airplane mode, and **Room View** as a second path to the bar's action); four **64 px capsule sliders** (Volume, Microphone, Brightness, Environment Brightness), white fill from the leading edge with the dark glyph inside, knob only on hover or focus; mute stays on the glyph (the existing `%{ClickableSliderIcon}`). This is the centre tile, i.e. Steam's own Quick Access popup. Restyled in place (T1) it keeps Steam's switches; the circular toggles need its Quick Settings panel re-rendered by a T3 type-swap of the panel component (SR §8 located the bar popup's observer component but has not patched it yet). Either way the five stock tabs stay reachable from this tile.
  3. **Device tile:** Refresh Rate as a segmented capsule (72 \| … \| 144, the same notches), Motion Smoothing toggle, **Recenter** and **Playspace** circles (second paths to the Playspace actions), **Power** circle (second path to the same Power menu, C.6), and platter rows "Performance ›", "Battery ›", "Help ›" that open the remaining tab content as a pushed view inside the tile.
  - A 48 px **close circle** centred below (B closes as today).
- **Proposal B (if cross-popup gamepad focus fails, CS5).** One tile in Steam's own popup, no scroll for the essentials: status strip (battery capsules + notifications capsule, 64 px), four toggle circles, two capsule sliders (Volume, Brightness); Microphone and Environment Brightness one level down ("Audio ›", "Display ›" platter rows); the five tabs become a **vertical capsule tab ornament** on the tile's leading edge, like visionOS tab bars (60 px circles at 72 px pitch, 5 × 72 = 360 px) instead of a 48 px icon row at the bottom.
- **Never lose:** every QAM row (Appendix 2) stays reachable: Performance's non-VR rows, Basic View, Reset to Default, every Bluetooth device row, the network row, Help buttons. In Proposal A they live in the pushed views; in T1-only form they stay in Steam's own tab panels, restyled.
- **Tiers:**
  - T1: restyle Steam's own tabs and rows in place. This gives capsule sliders (C.0.1), larger switches and 64 px platter rows, but not circular toggle buttons: Steam renders switches, and turning them into circles needs the T3 tile views;
  - T3: the tile views, built from Steam's own `ToggleField`/`SliderField`/`Focusable` components and bound to the same stores and handlers (`SteamClient.System.Audio`, Bluetooth and Wi-Fi stores, the Room View SteamVR action, `SteamUIStore.OpenPowerMenu`). SR proves such views in the main window; popups are portals of the same React root (SR §3.3), so the same components should render in a popup host;
  - popup request: `scale` ≈ ×1.1–1.25 and a small `z` for the tiles (C.0.3);
  - T4: tiles at +1 cm from the bar plane with a 2 cm gap in z between status and controls tiles optional; T5: each tile a glassd slab (the popup quad has nothing behind it).
- **Retention:** the stock QAM stays one press away (e.g. a "More…" row or long-press, or the T3 tiles are an alternate first page of the same popup). Gamepad: the tiles are one focus tree, left-to-right tiles, Up/Down inside; B closes; the bar's Quick Access button still opens it.
- **Verify:**
  - `shot barpopup p2_cc_*` for each tile state (Wi-Fi on/off is read, not changed: shoot the current state);
  - `audit barpopup`;
  - the new C.0.2 helper + `L.pad` through all tiles and back to the bar; refusal on Left/Right over sliders is already built into `L.pad`;
  - `perf barpopup` on the pushed Performance view;
  - an `hvgrab` capture to confirm tile size and gaps against 12 × 17°.
- **Open:** CS5 (gamepad focus moving between the three tile popups, and B closing all three), CS4 (the scale wrapper on Steam's own popups), CS1–CS3.

### C.2 Steam Settings becomes visionOS Settings (rank 2)

- **Problem:** B.1 (rows 1.3–2.0°, controls 0.7–1.2°), B.2 (12 px descriptions), B.3.3–B.3.7, B.4 (25–28° label-to-control sweep), B.7.
- **visionOS pattern:** Settings, ref 8 / VR §7, §10, §21.
- **Proposal:**
  1. **Sidebar (T1 + T2):** rows **64–72 px**, label 22–24 px Medium; a **40 px coloured icon circle** behind each page's existing glyph (T2 adds `data-lgs-page` from the route each row activates; CSS colours by it: blue for Internet/Bluetooth/Display/Accessibility, grey for System/Storage/Developer, green for Friends, red for Notifications, orange for Power/Audio, purple for Game Recording/Remote Play); groups separated by 16–24 px of space instead of hairlines (Steam's three separators stay as transparent spacers); selection = **lighter pill** (white 0.16–0.20), focus = brighter pill + light spot (VR §12). Drop the `ScaledChildren` 1.1 scale look by not reinforcing it (the transform is Steam's and stays).
  2. **Detail pane (T1):** page title centred (Title 3, 28 px Bold) as in ref 8; section headers 20–22 px title case; rows grouped in **recessed platters** (black 0.14 on the glass, radius 30 px) with **64–72 px rows**; labels 22 px, descriptions 18 px; **platter max-width ≈ 760 px, centred**, which cuts the label-to-control sweep from 25–28° to about 18–20° while keeping controls right-aligned as visionOS does.
  3. **Controls (C.0.1):** toggles at visionOS switch proportions (≈ 66 × 40 px via `scale`); dropdowns as capsule "value ⌄" buttons 56 px tall; sliders as 56 px capsules with the glyph inside the fill (Audio); checkboxes 40 px with 80 px column pitch (C.7); segmented capsules 56 px.
  4. **Danger (T1 + T2):** buttons whose action is destructive get a red label at rest and a red whole fill on focus (T2 tags them by their localization token, e.g. Factory Reset, Format, Delete, Unpair, Change & Restart, Reset). Primary actions (Apply update, Try Steam Families) stay the one tinted capsule per page.
  5. **Read-only info rows** (About, SteamVR, Steam, Hardware: 25 rows of 47 px): render as compact "label · value" rows at 56 px inside one platter each; keep them focusable and in one column (no grid: a grid would change D-pad meaning).
  6. **Sub-pages (Controller › Advanced):** circular 60 px back button top-left of the detail pane, centred title (ref 8). Steam's `%{BackButtonContent>BackButton}` is the node; restyle, don't replace.
  7. **Sidebar page switching:** keep selection-follows-focus (changing it is a behaviour change) but make it cheap: content cross-fade on `fade` with ≤ 12 px parallax and no delay (C.9), so holding the D-pad reads as one moving highlight.
- **Tiers:** T1 (all layout and look), T2 (icon colour keys, destructive tags, `aria-label`s), T4 (dropdown menus and dialogs at +3.5 / +3 cm, SN C.5–C.6), T5 (window glass; platters stay fills: no glass on glass).
- **Retention:** no row hides; the virtualized Storage list keeps its inline geometry (style only its rows); the Notifications sticky headers keep `position: sticky` (restyle only); `scroll-padding` stays so focused rows clear the header and footer.
- **Verify:**
  - `settings_sweep.js` before and after: every page's row and focusable counts must be identical; minimum row height ≥ 64 px, minimum control height ≥ 56 px, no text below 18 px;
  - `audit main --route /settings/<page>` for all 25 routes;
  - `L.pad` traversal script: sidebar Up/Down across all 24 pages, Right into each page, Down through every row to the end, Left back (navigation only; Left/Right on sliders refused by the helper);
  - `perf main --route /settings/system` and `/settings/notifications` (the two long pages).
- **Open:** CS1–CS3; whether `max-width` on `G>GamepadDialogContent_InnerWidth` keeps Steam's scroll-into-view correct (CS6).

### C.3 System control primitives at visionOS size (rank 3, cross-cutting)

This is the shared work behind C.1, C.2 and C.4, kept in `10-primitives.css` (Foundation).

| primitive | today | Phase 2 target | how |
|---|---|---|---|
| Toggle | 38 × 22 rail, overshoot 20 % | ≈ 66 × 40 visual; whole row as target where Steam's row already handles the click; green whole-fill on; knob lift on press; `snappy` travel | `scale` (CS1); MO §4.15 lift via T2 class |
| Slider | 6 px track, 24 px knob | 56–64 px capsule, value = white fill with glyph inside, knob on hover/focus only, notch labels 16 px title case | hit-area padding (CS2); restyle `SliderTrack::before` colour and radius only |
| Checkbox | 22 × 22 | 40 × 40 rounded square, 80 px column pitch | `scale` or padding (CS3) |
| Segmented | 32 px segments | 56 px capsule, white selected segment (this is where white is correct) | padding inside `%{Group}` |
| Dropdown button | 250 × 40 square-ish | 56 px capsule "value ⌄", 22 px text | padding |
| Dropdown menu | centred sheet, 48 px rows, title floating above, Cancel row | thick-glass menu, 64–72 px rows, title inside the slab, Cancel kept | SN C.6 |
| Focus | white fill (`ItemFocusAnim`) or 2 px ring | illumination + light spot; ring only on text fields | DESIGN §3, VR §12 |

### C.4 The dashboard bar becomes a system ornament with legible status (rank 4)

- **Problem:** B.1 (small buttons 1.78° at 2.0–2.3° pitch, + 1.26°), B.2 (18 px status glyphs, 0.67°), B.3.11 (bell), B.7 (outlined segments).
- **visionOS pattern:** ornaments are glass capsules with borderless circular buttons; status in Control Center prints the battery number (ref 3).
- **Proposal:**
  - Each `%{BarSurface}` becomes one glass capsule (radius 40 px, the bar's own height); no rim line (T5 slab, T1 sheen only).
  - **Small buttons and +:** 60–64 px visible circles at ≥ 72 px pitch (2.7°), using the existing 80 px-tall hit areas; borderless at rest, lighter on hover, **white only when toggled** (Room View on) or when their popup is open (visionOS: the invoking button turns white).
  - **Status cluster:** clock 26–28 px; battery as a **capsule with level fill and the number** when Steam's Battery Percentage setting is on (style Steam's own percentage); when it is off, a larger 28 px level glyph with whole-fill colour (green / orange < 30 % / red < 15 %). Controller batteries appear beside it as small capsules. **Notification badge:** a red capsule with the unread count on the cluster (T2 reads the count Steam already uses for the bell), not an 18 px bell with a dot.
  - **Tooltips:** 0.8 s in / 0.2 s out (VR §12), capsule text 20 px.
  - **Depth:** the bar is already its own plane 13 cm nearer; T4 can add +1 cm per toggled button only if paired with a shadow (VR §16.2: small objects don't need depth; prefer none).
- **Tiers:** T1 (sizes inside the 80 px window, which already reserves the hit area), T2 (the unread badge count), T5. T2 must **not** add a battery percentage while Steam's Battery Percentage setting is off: that would override the user's choice.
- **Retention:** every bar item keeps its node, tooltip, popup and gamepad order. Don't change `--bar-item-padding-pct` or the + button's `scale(.7)` transform: size through the variables or padding the inventory lists (bar.md §1.5).
- **Verify:** `shot bar p2_bar_*` (rest, popup-open states via the OPEN snippet), `audit bar`, an `hvgrab` capture for the 2.5° pitch, the C.0.2 helper for Left/Right traversal.

### C.5 One settings language, and a gamepad path into SteamVR settings (rank 5)

- **Problem:** B.3.1–B.3.2, A.2 (laser only), B.2 (ALL CAPS).
- **Proposal:**
  1. **T1 (`theme/vr/`):** restyle SteamVR's page to the C.2 look: sidebar pill rows with coloured icon circles (CSS `::before` on `.SettingsSidebarButton` is Steam-owned, so use an inner span or the label's `::before`), grouped recessed platters, **title case** (`text-transform: none` on the ALL-CAPS buttons), Off/On segmented pills styled as visionOS segmented capsules (SteamVR's `::after` thumb restyled, never moved), Advanced controls marked by a small purple dot instead of a purple fill, refresh-rate circles kept (they are already visionOS-like).
  2. **T3 (Steam side), new path:** a "SteamVR" group at the foot of Steam Settings' sidebar whose rows open SteamVR settings **at that section** (the same `SwitchToPage` + section the VR Settings entry uses), so gamepad users can at least reach the page, and a gamepad-operable **"VR Display"** mirror page for the settings Steam already exposes to the gamepad (Refresh Rate, Motion Smoothing, brightness) using the same handlers the QAM uses. No SteamVR value is written by any code path that a user didn't trigger.
  3. **Gamepad inside SteamVR's page** would need T3 work in SteamVR's own React (not Steam's). Treat as research (CS7).
- **Verify:** `vrsettings_sweep.js` before/after (identical setting counts and control sizes per section; it reports sizes); `shot vr:systemui p2_vrset_*` with the lock procedure; `audit vr:systemui` while shown; panel-size check from `steamvr.md` §7 (the panel root must not change size).
- **Open:** CS7, CS8 (deep link to a section).

### C.6 Power and session (rank 6)

- **Problem:** B.3.12, B.8 (destructive first focus, mixed account/device actions), B.1 (1.47° rows).
- **Proposal:**
  - **Second path:** a 60 px Power circle in Control Center (C.1, T3) that calls the same `SteamUIStore.OpenPowerMenu`.
  - **The sheet (T1):** a thick-glass menu (SN C.6): **Device** group (Sleep, Shutdown, Restart Device, Restart SteamVR) and **Account** group (Change Account, Sign Out, Restart Steam) as two recessed platters using Steam's own separators; 64–72 px rows with leading glyphs; Shutdown and Restart rows red-labelled; title inside the slab.
  - **Confirmations:** visionOS alerts (SN C.5): 640 px card, left-aligned 28 px title, 60 px capsule buttons, the destructive confirm red.
  - **Default focus:** opening on Sleep (or Cancel) instead of Restart Steam VR is a behaviour change; offer it to the user as an option, do not ship it by default.
- **Verify:** the POWER snippet (`inventory/shell.md` §0.2, look only), `audit main` with it, `L.pad` Up/Down inside the sheet.

### C.7 Notifications: list, toasts and settings (rank 7)

- **Problem:** B.2 (toasts 0.37–0.41°), B.3.11, B.1 (Notifications page checkboxes 0.68°, 144 focusables).
- **Proposal:**
  - **List (T1 now, T3 with C.1):** the QAM Notifications panel as visionOS notification cards: 80 px rows, 48 px circular app/avatar icons, 22 px title, 18 px body, pinned items as a separate platter at the top. In C.1 a "N Notifications ›" capsule in the status tile opens it.
  - **Toasts:** SN C.9 (use the whole 340 × 80 quad, 48 px circular icon, 16–18 px title, 14–15 px body; materialize in place). System toasts (low battery, controller connected) get whole-fill semantic colour on the icon circle (orange/red), not on text.
  - **SteamVR toasts** (`notificationtoast.html`): same card, replacing the blue gradient frame.
  - **Notifications settings page:** keep the matrix (it is Steam's nav structure) but at visionOS size: 40 px boxes at 80 px column pitch with the column headers in 18 px title case, sticky behaviour unchanged; each two-toggle row (Show Toast / Play Sound) gets two labelled switches. Flash-window segmented control moves visually into a "Desktop" platter at the end of the page (order unchanged: style only).
- **Verify:** toast mock recipe (`hud.md` §4.3, CS9 for an 80 px host), `audit notifications` with the mock, `settings_sweep.js` on `/settings/notifications`, `L.pad` across the matrix (Left/Right between columns is safe: checkboxes are not sliders).

### C.8 Volume HUD becomes a visionOS volume capsule (rank 8)

- **Problem:** A.6 (6 px track, no number, head-locked ≈ 27° below the horizon), B.6.
- **Proposal:**
  - **Look (T1):** a 64 px capsule (≈ 3.8° at the HUD's scale [inferred]) whose value is the white fill from the leading edge with the speaker glyph inside it, Control Center style; the track recessed. The clip rect follows `%{PopupContent}`, so the capsule must grow by padding on that box (allowed, audited in Phase 1).
  - **Number (T2):** a decorative "45 %" label driven by the slider's `--normalized-slider-value` (T2 observer), 20 px tabular.
  - **Placement:** move it higher (≈ 10–15° below the horizon) and keep it brief. Its placement is the popup request's `offset`/`rotation` (SP §3.1), so the same wrapper as C.0.3 can change it (CS11), or T4 can re-place a crop of the HUD (it is non-interactive, so a moved crop loses nothing).
  - **Motion:** materialize in 250 ms, out 350 ms (MO §4.10).
- **Verify:** the `hud.md` §2.2 trigger (never changes the volume), `audit volumelevel`, `hvgrab` for placement.

### C.9 Motion compliance for system surfaces (rank 9)

| element | change | tier |
|---|---|---|
| Settings page switch | override `%{PagedSettingsDialog>Enter*}`/`Exit*` timing: cross-fade on `fade`, ≤ 12 px parallax, no 80 ms delay; never touch the end states | T1 (CS12: the transition group's timers) |
| QAM tab content | same, ≤ 8 px | T1 |
| QAM / bar popups | materialize small glass (250 / 350 ms), swell `1 + 12/maxSide` | T1, T5 |
| Toggle | `snappy` instead of the 20 % overshoot; lift on press | T1, T2 |
| Slider | no pop on focus; grab lift on press; value follows the pointer directly | T1, T2 |
| Focus fills | `hover-in` / `fade` illumination layer | T1 |
| Reduce Motion | keep fades ≤ 200 ms, remove motion (replace Phase 1's 1 ms rule) | T1 (Foundation) |

Verify with the filmstrip method of MO §10 (several shots during a `L.pad` move).

### C.10 Materials: glass slabs without outlines (rank 10)

- QAM, bar segments, Playspace / Streaming / tab-menu popups, the volume HUD and toasts are **standalone quads with nothing of Steam's behind them**: each gets a glassd slab (frost, lensing, specular rim, adaptive tint) sized to its `%{PopupContent}` box (T5). In CSS: remove the uniform 1 px rims; keep a top-lit rim gradient ≥ 2 px and a darkened inner edge (VR §15).
- Inside the window: settings platters recessed fills (no glass on glass); hairlines replaced by spacing or ≥ 2 px soft separators.
- Selection vocabulary fixed across all system surfaces: navigation = lighter pill; toggled button, selected segment, open-popup source = white; focus = illumination.
- **Verify:** pixel profiles across each edge in shots (top peak, flat sides, REF E.2); glassd debug dumps; `hvgrab` (look, then delete).

### C.11 Stereo plan for system surfaces (rank 11)

| element | dz | note |
|---|---|---|
| Settings sidebar, platters, rows, controls | 0 | visionOS keeps rows flat |
| Settings dropdown menus, Power sheet | +3.5 cm | crop at the same x/y (input lands underneath) |
| Settings dialogs | +3 cm; window base dimmed | SN C.5 |
| Control Center tiles | 0 relative to their own quad; optional +1 cm for the controls tile | the popup is already a separate plane |
| Bar | already 13 cm nearer; no extra | — |
| Toasts, volume HUD | none | head-locked or SteamVR-placed |

Shadows sized by depth (VR §16.3). Text never gets its own depth.

### C.12 Settings search (rank 12, new function, optional)

visionOS Settings has a search capsule at the top of the sidebar (ref 8). Steam has none; in VR, typing is expensive but jumping beats scrolling 24 pages. A T3 capsule at the top of the sidebar could open a sheet listing matching **page and row labels** (the labels the sweep collects) and navigate to the page with the row scrolled into view. It must build its index from what is on screen or from static data shipped with the theme, never by navigating behind the user's back. Lowest priority: it adds a function rather than fixing one.

### Summary ranking

| rank | opportunity | main fix | tiers | blocking question |
|---|---|---|---|---|
| 1 | C.1 Quick Access → Control Center | size, essentials without scroll, status, notifications entry | T1 T3 T4 T5 | CS1–CS5, CS10 |
| 2 | C.2 Steam Settings → visionOS Settings | row and control size, gaze travel, grouping, danger | T1 T2 T4 T5 | CS1–CS3, CS6 |
| 3 | C.3 primitives at visionOS size | toggles, sliders, checkboxes, segmented, menus | T1 T2 | CS1–CS3 |
| 4 | C.4 bar as system ornament | button size and pitch, battery number, badge | T1 T2 T5 | CS10 |
| 5 | C.5 one settings language + gamepad path to SteamVR settings | app seam, gamepad dead end | T1 (vr) T3 | CS7, CS8 |
| 6 | C.6 power and session | second path, grouping, destructive safety | T1 T3 | user approval for default focus |
| 7 | C.7 notifications | legibility, place, matrix size | T1 T3 | CS9 |
| 8 | C.8 volume HUD | capsule, number, placement | T1 T2 T3/T4 | CS11 |
| 9 | C.9 motion | LG spec, no slides on repeat | T1 T2 | CS12 |
| 10 | C.10 materials | frost, no outlines, selection vocabulary | T1 T5 | — |
| 11 | C.11 stereo | hierarchy | T4 | SN CQ7 |
| 12 | C.12 settings search | findability | T3 | CS5 |

### Capability questions for `docs/phase2/capabilities/`

| id | question |
|---|---|
| CS1 | Does an independent `scale` on Steam's toggle (and the RTL `scale: -s s` variant) enlarge both the visual and the hit-test area without breaking the knob's `translateX` state or Steam's focus halo `::after`? |
| CS2 | Steam slider: does the value follow the pointer relative to the track rect when the slider's hit area is enlarged by padding or a transparent pseudo-element, and does a taller capsule track keep `SliderTrack::before` width correct? |
| CS3 | Can checkboxes (`.DialogCheckbox`) and segmented buttons grow (padding / `scale`) inside the Notifications matrix without breaking the sticky `%{CheckboxHeaders}` alignment? |
| CS4 | **Mostly settled by SP §3:** hosts are fixed-width (barpopup 300 px, so three tiles = three popups), our own popups take `offset`/`scale` and stay laser targets [PROVEN]. Still open: run the `SendPendingInstanceParamsToSteamVR` wrapper on Steam's **own** QAM and bar popups (×1.1–1.25, small `z`) and confirm the clip rect and laser mapping follow |
| CS5 | Can T3 views in popup hosts (the side tiles) be first-class gamepad targets: D-pad Left/Right moving focus between three popup windows, B closing all three, focus returning to the bar? (SR proves T3 nav trees in the main window; SP §3.3 leaves cross-popup focus open) |
| CS6 | With the settings content width limited (`max-width` on the inner width wrapper) and rows at 64–72 px, does Steam's `scroll-padding` / scroll-into-view still keep the focused row clear of the header and footer? |
| CS7 | Can SteamVR's settings page be given gamepad focus (its React has a gamepad model for Now Playing), or is a Steam-side mirror the only route? |
| CS8 | Can a Steam-side control open SteamVR settings directly at a given section (frame `SwitchToPage` + the settings route page) without a visible flash of the General page? |
| CS9 | A lab host for 340 × 80 toast mocks (SN CQ9). |
| CS10 | A lab helper that gives the dashboard bar gamepad focus for a bounded time and returns it, so bar and QAM traversal can be verified without a user. |
| CS11 | The volume HUD's placement (head-locked offset −0.4 / −0.8 m, pitch −20°) is a popup request (SP §3.1); confirm the CS4 wrapper can change it for this host type (5) without affecting other popups |
| CS12 | Do the settings page transitions (`%{PagedSettingsDialog}` Enter/Exit) finish on `transitionend` or fixed timers (SN CQ6 for routes)? |

---

## Appendix 1. Steam Settings, row by row

From `settings_sweep.js` on 2026-10-07. "t" toggle, "dd" dropdown, "b" button, "v" read-only value, "in" text input, "cb×n" n checkboxes, "row" clickable list row, "sl" slider; "(desc)" = has a description line; "dis" = disabled at the time. Personal values (network names, device names, serial number, versions) are omitted.

- **System:** Select preferred language (dd) · Updates: Software Updates (b Apply), Update available (v) · Beta Participation: OS Update Channel (dd), Steam Client Update Channel (dd) · System Settings: 24-hour clock (t, desc), Timezone (dd rich, 96 px row), Default to Desktop Mode on startup (t), Enable Developer Mode (t) · SteamOS Crash Report: Enable SteamOS Crash Reports (t, desc), Application / Kernel / GPU crash collection, Service Log, System Info, Driver crash collection (6 t, dis) · About: Hostname (b), OS Name, Codename, Variant, Version, Build, Kernel Version, Device Serial Number (7 v) · SteamVR: Version, Web Build Date, HMD Tracking Info (3 v) · Steam: Version, Client Build Date, Web Build Date, API Version (4 v), Third-Party Licenses and Source Code (b) · Hardware: CPU Vendor, Name, Frequency, Physical Cores, Logical Cores, Available Logical Cores, RAM, Video Card, Video Driver, VRAM (10 v) · Advanced: Steam Runtime System Information (b Run Diagnostics), System Report (b Create Report), Run storage device maintenance tasks (b Run, desc), Reset to factory state (b Factory Reset).
- **Internet:** Enable Wi-Fi (t) · Connected Networks: wired connection (row), current Wi-Fi (row, desc "Preferred connection") · Networks Found: one network (row), Other network… (row) · Advanced Settings: Offline Mode (b Enter Offline Mode), HTTP Proxy (b Configure), Delete Web Browser Data (b Delete).
- **Storage:** 2 drive tabs; usage bar and legend; Items header with sort dropdown; virtualized app rows (58 px).
- **Bluetooth:** Bluetooth (t), Show all devices (t) · Paired: 6 device rows (1 connected, 5 dis) · Searching for devices…
- **Display:** Virtual Display Scaling: Maximum Game Resolution (dd, desc with a Y glyph).
- **Power:** Battery: Battery Percentage (t, desc "Show battery percentage on dashboard bar") · When On Battery and Idle: Dim display after (dd), Sleep after (dd) · When Plugged In and Idle: Dim display after (dd), Sleep after (dd).
- **Audio:** Output: volume (sl), Output Device (dd), Spatialization (t, desc) · Apps: (empty) · Voice: mic volume (sl), Input Device (dd) · General: Enable UI sounds (t), Reset audio settings (b Reset).
- **Controller:** Connected Controllers: Steam Frame Controllers (b Details), Add a new controller (b Add Controller) · Advanced Settings (b Show Advanced Settings).
- **Controller › Advanced:** External Gamepad Settings: Idle Gamepad Shutdown Timeout (dd) · Non-Game Controller Layouts: Desktop Layout (b Edit + icon b) · Controller Firmware: Force update all connected Steam Controllers (b Start).
- **Keyboard:** Current Keyboard Theme (dd + preview b), Find More Keyboard Themes (b Visit the Points Shop, desc), Haptics (dd), Initial Location (Desktop) (dd), Initial Location (Overlay) (dd) · Active Keyboards: Select Available Keyboards (b Edit), current layout (radio row) · Quick Chat Options: Option 1–8 (8 in).
- **Accessibility:** High Contrast Mode (t, desc), Reduce Motion (t, desc), Color Filter (dd, desc), Mono Audio (t, desc).
- **Security:** Lock Screen: description row, On system wake and power up (t).
- **Notifications:** Show Notification Toasts… (dd, desc), Play a sound when a notification toast is displayed (t) · Client Notifications: achievement, controller connect/disconnect, controller battery low, wake with multiple users (4 rows × 2 t) · Friend Notifications: friend joins a game, comes online, direct chat message, chat room notification (4 rows × 2 t), Flash window (segmented: Always / Only when minimized / Never) · Store News: major sale (cb×4) · Personal Activity: friend invitation, discussion reply, inventory item, gift, trade offer, Support reply, Steam Turn, Playtest invite (cb×3–4 each), review copy for a curator group, Community Awards, Steam Replay (cb×1 each) · Wishlist Activity: on sale (cb×4), released, demo released (cb×1) · Steam Family Activity: (rows appear with a family) · Developer / Game News: followed developer released, released a demo, game events, season pass content, roadmap content (cb×1 each) · Email Opt-out: Opt out from all email marketing (t, desc).
- **Friends & Chat:** Append nicknames (t, with a preview friend), Group friends by game, Hide offline friends in custom categories, Hide categorized friends in Online/Offline, Ignore 'Away' when sorting, Sign in to friends when Steam Frame starts, Animated avatars and frames, Compact friends list & chat view, Compact favorite friends area (9 t) · Chat: Dock chats to the friends list, Open a new window for new chats, Don't embed media in-line, Remember my open chats (desc), Disable spellcheck, Disable animated room effects (6 t), Chat Filtering (b Manage, desc) · Chat Font Size (segmented: Small / Default / Large).
- **Downloads:** Download region (dd), Limit download speed (t), Display download rates in bits per second (t) · Game Updates: Schedule auto-updates (t), Allow downloads during gameplay (t, desc), Throttle downloads while streaming (t, desc), Game File Transfer over Local Network (t, desc), Allow transfers from this device to (dd).
- **Cloud:** Enable Steam Cloud (t, desc), Screenshot Management (t, desc).
- **In Game:** Screenshots: Include Steam UI elements in screenshots (t) · More: Steam Networking (dd, desc with link).
- **Compatibility:** Steam Play: Default compatibility tool (dd, desc), Show all compatibility tools (t).
- **Family:** text, Steam Families link, Try Steam Families (primary b).
- **Remote Play:** Enable Remote Play (t, desc) · Computers & Devices: host (b Connect), Pair Steam Link (b) · Connection Options: Allow Direct Connection (dd), Connection PIN (b Set PIN) · Advanced Host Options (t, desc) · Advanced Client Options (t, desc) · Wireless Streaming Adapter (Steam Frame): Enable Streaming Adapter (t), Connection Management (dd), paired adapter (b Unpair), connected host (b Connected, dis), Show Advanced Wi-Fi Settings (t) · Learn More (b View FAQ).
- **Game Recording:** 3 mode cards (Recording Off / Record in Background / Record Manually), Learn More (b View FAQ) · Shortcut Keys: start/stop shortcut (row), timeline marker shortcut (b Set shortcut) · Video Recording: Recording Quality (b), Maximum frame rate (dd), Maximum video height (dd, desc) · Audio Recording: Record Microphone (t, desc), Record Audio from… (dd, desc, dis).
- **Home:** Big Art Mode (t, desc), Show personalized store content on my Home (t) · What's New Settings: Only show product updates (t), hidden games (b Manage), instructions (row).
- **Library:** Low Performance Mode (t, desc), Show Steam Deck compatibility information (t) · Activate a product on Steam: Add to Library (b Add game, desc).
- **Store:** Mature Content, Exclude from My Store, Discovery Queue Content, New On Steam Queue Content, Platform Preference, Steam Deck Feedback, Live Broadcasts (7 × b Manage, desc).
- **Developer:** Profiling: System Tracing (t, desc), Graphics Profiling (t, desc) · Development Kit: host pairing (b Pair new host) · Steam Play: default compatibility tool (dd, desc) · Wi-Fi: Wi-Fi Power Management (t, desc), Force WPA Supplicant backend (t) · Miscellaneous: Show Steam Controller Tour, external display refresh control, Force Composite, Composite Debug, Disable Color Management (5 t), Session for Desktop Mode (dd), Speaker Test (b Start), Show Advanced Update Channels (t), HDR Debug Visualization (dd), Disable Mura Compensation (t), Re-arm Mura Calibration (b Start), Force Format SD Card (b Format), advanced display scaling for internal display (t), Game Launch Interstitials Seen (b Clear All), Steam Console (b Open), timestamps in console, gamescope browser composer, gamescope VR browser composer, force system browser composer (4 t), browserview underlays (t, desc), CEF Remote Debugging (t, desc), User Password (b Change User Password), HDR Compatibility Testing (t, desc), Hardware Updates (b Update all devices now) · Steam Input: Layout Dev Mode, API Config Author Mode, Keyboard Glyphs (3 t, desc).

## Appendix 2. Quick Access, row by row

From `qam_sweep.js` on 2026-10-07 (theme on; sizes are Steam's, unchanged by Phase 1).

| tab | rows (control, size in px) |
|---|---|
| Notifications | empty state "No new notifications" (16 px) |
| Quick Settings | Brightness: Brightness (slider 237 × 28, row 48), Environment Brightness (slider 237 × 28, row 48) · Audio: Volume (slider 240 × 24, row 44), Microphone Volume (slider, row 44) · Other: Wi-Fi (toggle 38 × 22, row 42), current network (clickable row 40), Bluetooth (toggle, row 42), 6 device rows (40 each; 5 disabled), Add Device (row 40), Airplane mode (toggle, row 42) |
| Performance | System Profile (2-notch slider 270 × 39, row 85), Basic View (button 267 × 40) · Common Settings: Manual GPU Clock (toggle) · Non-VR Settings: Performance Overlay Level (5 notches), Disable Frame Limit (toggle), Scaling Mode (5 notches), Scaling Filter (3 notches) · VR Settings: Show Perf Overlay in VR, Record VR Performance, Record Tracking (toggles), Refresh Rate (2-notch slider, current value shown as text), Motion Smoothing (toggle), Reset to Default (button 299 × 40) |
| Battery Info | headset summary (clickable row 60), Right Controller (row 44) |
| Help | Visit Help Site, Report a Bug, Replay Guided Tour, Show Frame Tutorial Videos (buttons 267 × 40, rows 60) |
