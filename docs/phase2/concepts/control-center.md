# Concept: Control Center and the dashboard bar (revision 2)

Phase 2 redesign of the Steam Frame's system layer: the dashboard bar, Quick Access, the Power menu, the volume HUD, battery and status, the notification list and notification banners. It follows `docs/phase2/DESIGN2.md` (cited **D2 §x**) except where §15 says so and why.

**Revision 2** answers a critic's review (score 6). The main change: Control Center is now drawn **inside Steam's main window** (variant **CC-M**), whose gamepad navigation tree agents can traverse today, and whose tiles then float over the room as real glass. The popup variant (CC-A) is kept behind a ship gate. §17 lists every critique point and what was done about it.

**Sources.** Audits `audit/system.md` (**SY**), `shell-nav.md` (**SN**), `social-media.md` (**SM**), `library-apps.md` (**LA**). Capabilities `capabilities/spatial.md` (**SP**), `steam-react.md` (**SR**), `native-e2e.md` (**NE**). Research `research/visionos.md` (**VR**), `references.md` (**REF**), `liquid-glass-motion.md` (**MO**). Inventories `inventory/bar.md`, `hud.md`, `shell.md`. `native/glassd/README.md` (**GD**). The settings concept `concepts/settings.md` (**SC**). References `refs/visionos/3.png` (Control Center), `1.png`, `6.webp`, `8.webp`, `11.webp`.

**Mockups.** All are true size and built with `mockups/kit.css`, `mockups/control-center.css` and `mockups/control-center-build.js` (which builds the tiles and the bar from a JSON config). They are rendered with `tools/mockshot.py` and size-checked with `concepts/control-center-mockaudit.py` (A2). Glass in every render is what a shipped tier can produce (§10).

| Mockup (`docs/phase2/mockups/`) | Render (`shots/`) | Shows |
|---|---|---|
| `control-center-overview.html` | `p2_control-center_overview.png` | **CC-M with glassd**: Steam's window has turned into three glass tiles and a close circle over the room. The laser is on the Volume slider and the status pill is white |
| `control-center-overview-t1.html` | `p2_control-center_overview-t1.png` | CC-M without glassd: tiles at the opaque end of the dial (.94) |
| `control-center-overview-dim.html` | `p2_control-center_overview-dim.png` | Dim evening room during Steam's low-battery alert: Return to Game stays |
| `control-center-gamepad.html` | `p2_control-center_gamepad.png` | Opened with the gamepad. First focus is on Wi-Fi with the D-CC6 focus look, and the footer legend shows our actions |
| `control-center-states.html` | `p2_control-center_states.png` | Each control at rest, under laser hover and under gamepad focus, with measured contrast steps |
| `control-center-focusmap.html` | `p2_control-center_focusmap.png` | Gamepad focus map: explicit neighbours at tile edges, so no horizontal move lands on a slider |
| `control-center-notifications.html` | `p2_control-center_notifications.png` | The Now tile turns into the notification list in place, at the same size |
| `control-center-more.html` | `p2_control-center_more.png` | More Controls: Steam's six Quick Access panels inside Control Center (network row, Bluetooth devices, Add Device) |
| `control-center-popup.html` | `p2_control-center_popup.png` | CC-A, gated: the honest glassd look over the dimmed window (flat grey frost) and the 40 pp clearance above the bar |
| `control-center-fallback.html` | `p2_control-center_fallback.png` | CC-C: Steam's Quick Access in its Phase 2 restyle, used on non-Steam pages, with honest material |
| `control-center-bar.html` | `p2_control-center_bar.png` | The bar in five states, including gamepad focus on the pill and on a white "on" disc |
| `control-center-hud.html` | `p2_control-center_hud.png` | Volume HUD at its new head-locked angle and two notification banners |
| `control-center-power.html` | `p2_control-center_power.png` | The Power menu as a grouped thick-glass menu over the dimmed window |
| `control-center-power-confirm.html` | `p2_control-center_power-confirm.png` | Its confirmation as a visionOS alert |

---

## 0. Summary

| Surface | Is Steam's current UI right for VR? | Phase 2 form | Main tiers | Mockup |
|---|---|---|---|---|
| Dashboard bar | **No.** One strip mixes navigation, running apps, a launcher, three room toggles, status and account. Small buttons are 1.78° (SY B.1), the + is 1.26°, status is read from 18 px glyphs, and the bell is a dot | **Three glass pieces**: the Steam (Home) circle, an apps capsule (running apps as art discs, then +), and **one system capsule** painted on Steam's `%{Tray}` (room controls, the **status pill**, the avatar). 56 pp discs at 64 pp pitch (3.0° at the measured distance). About as wide as today (722 vs 700 pp) | T1, T2, T5 | bar, overview |
| Quick Access | **No.** One 300 × 440 card holds three visionOS tiles' worth of content behind five icon tabs. The daily toggles are below a 2.5-screen scroll and sliders have 6 px tracks | **Control Center in the main window (CC-M)**: while it is open, Steam's window content fades out and the window's glass becomes three tiles (Now, Controls, Room) plus a close circle, floating over the room. Steam's Quick Access panels stay *inside* Control Center as **More Controls**. CC-A (popup) is gated; CC-C (Steam's popup, restyled) covers other pages | T3, T1, T5 | overview, gamepad, more |
| Power menu | **Partly.** A list suits seven rare actions, but rows are 1.47°, the title floats outside, device and account actions are not grouped, and first focus can land on Restart SteamVR | Grouped thick-glass menu at +30 mm with 72 px rows and glyphs, title inside, window dimmed. Confirmations become visionOS alerts. Second path from Control Center | T1, T2, T4 | power, power-confirm |
| Volume HUD | **No.** 6 px track, no number, head-locked 27° below the eye line | A Control Center slider as the HUD: white value fill with the glyph inside, number trailing, 12° below the eye line | T1, T2, T4, T5 | hud |
| Battery and status | **No.** The only always-visible battery is an 18 px glyph, and controller levels need two taps | Battery capsule in the pill, battery chips with numbers in Control Center. **Numbers on coloured fills are dark** (≥ 5.6:1) | T1, T2, T3 | bar, overview |
| Notification list | **No.** A tab that is not the default, 1 px dividers, no history in VR | "N Notifications ›" capsule in the Now tile. Activating it turns the tile into the list, at the same size | T3 | notifications |
| Notification banners | **No.** 300 × 40 square card with a 1 px outline and 11–12 px text | The whole 340 × 80 toast quad as a rounded glass card | T1, T5 | hud |

---

## 1. The experience

You are in the dashboard with Room View on, or a game is running behind it. **You glance down** at the bar. It reads as three small glass objects rather than a desktop toolbar:
- a glass circle with the Steam mark;
- a capsule of round app icons (the running game, a desktop window) ending in a **+**;
- on the right, one longer capsule holding the room controls (Playspace, Room View lit white because it is on, Streaming), the **status pill** ("4:56", a green battery capsule reading 82 in dark figures, Wi-Fi, volume, a red "3") and your avatar.

**You point at the status pill and click**, or press A on it. The pill turns white, as a visionOS button does while what it opens is showing.

**Then the Steam window dissolves.** Its glass gathers into **three portrait slabs and a small round ×**. They stand where the window was, with the room visible between them. Nothing slides in from an edge, and nothing new appears somewhere else in the room. The window you were looking at becomes Control Center, at the same distance and in the same place.

- **The left slab (Now)** is the device at a glance: the date, a large clock, and three battery chips with numbers (headset, left and right controller; the right one is orange because it is low, with dark figures you can read). Below them are the running game with a **Return to Game** capsule and "3 Notifications ›".
- **The centre slab (Controls)** is what you reach for:
  - four round toggles (Wi-Fi, Bluetooth, Airplane Mode, Motion Smoothing), lit blue when on;
  - a recessed group of rows: Refresh Rate 120 Hz ›, Streaming Ready ›, More Controls ›;
  - two thick capsule sliders, Volume and Microphone. The value is a white fill with the glyph inside it.
- **The right slab (Room)** is the Frame's "environment", as visionOS's right tile is the current environment: a large "Room View" title with an Off · On switch, Recenter and Playspace as corner circles, and sliders for environment brightness (the mountain) and display brightness (the sun).

**You drag the Volume slider.** A white knob appears under the laser and the value follows the pointer exactly. With the gamepad, the focused control grows a little and glows, so you can find it without eye tracking. LB/RB jump between slabs and the D-pad moves inside them. **B closes**, as do the ×, a click on the room between the slabs, the status pill again, and navigating anywhere with the tab bar. The slabs dissolve and the window comes back exactly as it was.

**"3 Notifications ›"** turns the left slab into the list, at the same size: a low-battery card and two friend requests pinned at the top, then "Earlier". Each is a rounded card with a round icon and a blue unread dot. A back chevron, or B, returns.

**"More Controls ›"** widens the centre slab over the right one into a small split view. Steam's six Quick Access sections (Notifications, Quick Settings, Performance, Battery, Streaming, Help) form a sidebar with coloured circle icons, and the chosen section's real Steam panel is on the right: the network row, your Bluetooth devices, Add Device, System Profile, Reset to Default. You never leave Control Center.

**The power circle** in the Now slab closes Control Center and opens Steam's Power menu: a dark glass slab in front of the dimmed window with the device actions and the Steam actions as two groups. Choosing one asks once more in a visionOS alert with a red confirm capsule.

**If the dashboard is showing something else**, such as a desktop window or SteamVR's own pages, the pill opens Steam's own Quick Access, restyled to match. It never hides the window you are looking at.

**Back in the game, you press volume up.** A single glass capsule appears 12° below your line of sight, with a white fill, the speaker glyph inside it and "55" at its end. It fades a second later. **A friend writes:** a rounded glass card materializes where SteamVR places notifications, with her round avatar, her name at 20 px and the message at 18 px.

---

## 2. Units, angles, placement and depth

### 2.1 Units and honest angles

Every surface is its own quad at its own scale (D2 §2.5). Sizes are written in **that quad's CSS px**, with points, and with angles at two distances:

- **cons**: D2's conservative design distance (D1), used for target minimums;
- **meas**: the distance measured live at summon (SP §1.1).

| Unit | Quad | mm per CSS px | ° per px, cons | ° per px, meas | pt = | Source |
|---|---|---|---|---|---|---|
| **px** | Steam's main window (CC-M, Power menu, alerts) | 0.769 at r = 1; 0.664 today (r = 0.863) | 0.0307 (1.43 m) | **0.038** at r = 1 (1.15 m), **0.033** today | px × 0.75 | D2 §2.1, SP §1.1–1.2 |
| **pp** | bar, bar popups (`barpopup`), Steam's Quick Access (CC-C) | 0.847 (r does not apply) | 0.037 (1.30 m) | **0.047** (the bar is about 1.03 m from the eye: 13 cm nearer than the 1.15 m window, and below it) | pp × 0.904 | SY §0.3, SP §1.1, §1.3 |
| **cc** | CC-A's popup at request `scale` 0.83 | 0.703 | 0.031 | 0.040 | as px | §4.11 |
| **tp** | notification toast (`notifications`, 340 × 80) | — | 0.034 | ≈ 0.042 [inferred, same 24 % as px] | tp × 0.83 | SN §0.2 |
| **hp** | volume HUD (`volumelevel`, popup scale 0.4) | 0.92 | 0.064 at its new 0.82 m (0.059 at the stock 0.89 m) | same (head-locked) | hp × 1.44 | SY §0.3 |

The previous revision quoted only the conservative column, which understated sizes at the real summon distance by about 24 % (critique 6). Both columns are given from here on. At the measured distance, Control Center is **41° wide at r = 1 and 36° at today's window size**. The bar is **34° wide** with no app tabs (§3.1).

### 2.2 Scene

```
                  frame.menu (laser-only)        Steam main window texture (1280 x 720 px), window glass gone while CC is open
                   ( )            +------------+  +------------+  +------------+
                   ( )            | Now        |  | Controls   |  | Room       |    three tiles 344 x 528 px, 28 px apart,
                   ( )            | 4:56       |  | () () () ()|  | (.)    (.) |    at the window plane, over the room:
                   ( )            | 82 64 21   |  | [ rows   ] |  | Room View  |    glassd panel glass of the ROOM
                                  | now playing|  | [=====   ] |  | [Off| On ] |
                                  | 3 Notif. > |  | [======  ] |  | [==] [===] |
                                  +------------+  +------------+  +------------+
                                                       ( x )                          close 56 px, 20 px below
                                [ A Select   B Close   LB RB Tiles ]                  Steam's floating footer (legend)
            (Steam) (o o +)            (Playspace RoomView Stream | 4:56 [82] wifi vol (3) | B)    bar, 13 cm nearer
                                          ======= grab pill =======
```

### 2.3 Depth plan (D2 §3.8)

| Element | Depth | How | Evidence |
|---|---|---|---|
| Bar capsules | SteamVR's own plane, about 130 mm in front of the window | none added | SN §0.3, SP §1.3 |
| **CC-M tiles, close circle** | **0 mm: the window plane** | They are in Steam's main texture. An in-place pop would show the same pixels twice off-axis (NE §1, "ghosts"), so there is none. Depth reads from the contact shadow and from the room seen between the tiles | NE §1 rule |
| CC-A tiles (gated) | +25 mm in front of the bar plane (`offset.z_meters` 0.025 / S = 0.068 units) | own popup request | [PROVEN] own popup `z`, SP §3.2 (E2) |
| Content inside tiles | 0 on its tile (text never gets depth) | — | D2 §3.8 |
| Steam's Quick Access (CC-C), Playspace and Streaming menus, tab menus | +25 mm instead of Steam's 3.7 mm | wrapper on `SendPendingInstanceParamsToSteamVR` per host type (CS4) | [PLAUSIBLE] SP §3.3 |
| Power menu | +30 mm at its own x/y | interactive in-place crop of the context menu | registration [PROVEN], click [PLAUSIBLE], SP §2.4, §2.6 |
| Power alert | +30 mm; window dimmed to 0.65 | in-place crop + `t1` tint | [PROVEN] dim, SP §5 (E4) |
| Volume HUD, banners | none (head-locked / SteamVR-placed) | — | SY C.11 |

Shadows follow D2 §3.8 (0.4 px y and 1.2 px blur per mm). For CC-M, glassd draws the tiles' contact shadow on the room (T5). In T1 the tiles cast no shadow, because nothing of the same page lies behind them.

---

## 3. The dashboard bar

### 3.1 Layout

The bar is Steam's `bar` popup: a 1200 × 80 pp window whose visible part (clip rect) is the `%{PopupContent}` box, centred (DynamicWidth). Every item keeps its Steam node, order, tooltip, popup and handler. Only backgrounds, sizes and spacing change (T1). Steam's DOM already groups the right-hand side: Playspace, Room View, Streaming, Quick Access and the avatar are all children of **one** element, `%{BarSurfaceSection}%{SmallButtonSection}%{Tray}` (`inventory/bar.md` §1.1). That element is painted as **one** capsule, so nothing is reordered.

| Piece | Steam node | Size (pp) | Contents |
|---|---|---|---|
| **Home circle** | `%{BarSurface}%{Bookend}` (Steam tab) | 72 × 72 | Steam glyph 28 pp in a 56 pp disc. Selected = lighter disc (white .18) + 6 pp white dot |
| **Apps capsule** | `%{BarSurfaceSection}%{LowBatteryGauge>Tabs}` in the main `%{BarSurface}` (`%{BarTabs}` + `%{AddWindowButton}`) | 72 tall, padding 0 4, slots 64 × 72 | One 52 pp art disc per running app (portrait crop, overlay thumbnail or window icon; LA C.7), then **+** as a 56 pp plain disc. The main `%{BarSurface}` itself becomes transparent |
| (gap) | `%{EmptySpace}` | min-width 70 → **12** (36 pp between the capsules, including the flex gaps) | transparent |
| **System capsule** | `%{Tray}` | 72 tall, padding 0 4 | Slots 64 × 72: Playspace Menu, Toggle Room View, Streaming Status, then any conditional header buttons in Steam's order (Downloads as an art disc in a white progress ring, Family View / Kiosk lock, unformatted SD, low disk, connection warning, voice chat). Then the **status pill** and the **avatar** |
| ↳ Status pill | `%{QuickAccessButton}` (its `%{PopupBody>Inner}`) | raised capsule 56 tall (white .10), ≈ 262 wide with a badge, padding 0 16 0 18 | Clock 26 pp Semibold tabular, battery, Wi-Fi 23, volume 23, conditional glyphs 23, unread badge |
| ↳ Avatar | `%{AvatarButton}` | 60 × 72 slot | 52 pp avatar disc (content, not glass) |

**Width.** With no app tabs (as live today, SY A.3), the bar is ≈ **722 pp**: 26.7° cons, **34° meas**. Today it is 700 pp (26° / 33°). With two app tabs it is ≈ 850 pp (31° / 40°). More apps scroll inside the apps capsule (Steam's own `%{BarTabs}` scroller and fade mask, untouched).

| Element | Visible (pp → pt → ° cons / meas) | Pitch and hit (pp → ° cons / meas) |
|---|---|---|
| Home, app, + and room discs | 56 → 51 pt → 2.07° / **2.63°** | pitch 64 → 2.37° / **3.0°**; slot hit 64 × 72 |
| Status pill | 56 tall → 51 pt → 2.07° / 2.63° | one target, ≈ 262 × 72 |
| Clock | 26 pp (= 31 main px) | — |
| Battery capsule | 50 × 28, number 16 pp Bold **dark** (#0d0e12) | — |
| Unread badge | 30 pp tall, deep red `rgb(204 32 40)`, white 17 pp Bold (5.5:1) | — |
| Tooltip | capsule 40 pp tall (its 400 × 40 host), 18 pp Semibold | — |

Pitch 64 pp is below D2 §2.5's 67 pp ("use 72 where it fits"). It is above D2's hard floor (72 main px = 60 pp), and at the measured distance it is 3.0°, above visionOS's 2.5° (D-CC8). In return the bar stays as wide as today.

How the sizes are reached without touching Steam's geometry rules (`inventory/bar.md` §1.5):

- Small buttons: `font-size: 28px` on `.VRDashboardBarSmallButton` makes `%{PopupBody>Highlight}` (2 em) a 56 pp circle. The glyph `svg` is set to 28 pp. `--bar-item-padding-pct` (inline) is left alone.
- **+**: its `%{PopupBody>Highlight}` keeps Steam's `transform: scale(.7)`. The base size is raised so that the transformed disc renders at 56 pp. Verify with `elementFromPoint` sweeps (A4).
- Bar tabs: the selected indicator `::after` keeps its `transform`. It is recoloured white and reshaped to a 6 × 6 pp dot. The lighter disc is a `radial-gradient` background on `%{BarTab}` (no new pseudo-element).
- System capsule: background, radius 36 and edge cues on `%{Tray}` (replacing its `linear-gradient`). The pill is `%{QuickAccessButton} %{PopupBody>Inner}::before`, Steam's own hover/open pill, enlarged and kept visible.

### 3.2 States (both inputs; D2 §8.2, §10)

| State | Look | Steam trigger |
|---|---|---|
| Rest | Discs transparent on the capsule glass. Pill white .10 | — |
| Laser hover | + white .08 and a light spot at the pointer (T2 writes `--hx/--hy`; T1 alone puts the spot in the upper third) | `:hover` |
| **Gamepad focus** | **D-CC6**: disc `scale: 1.10`, + white .26, specular arc ×2, contact shadow. On white or art discs, a soft white bloom (0 0 18 px 5 px white .42). The pill gets `scale: 1.06` and the same treatment. Steam's FocusRing element is transparent | `.gpfocus` |
| Press | Glow from the hit point; swell ≤ ×1.06 (§9) | `:active`, `%{ClickAnimation}` |
| Selected frame (Steam or an app) | Lighter disc (white .18) + white dot. Never white fill: this is navigation | `%{LowBatteryGauge>Selected}` |
| Toggled on (Room View) | **White** disc (.94), dark glyph | `VRDashboardBarSmallButtonActive` |
| Its popup is open (Playspace, Streaming, +) | **White** disc, dark glyph | `%{PanelSection>Active}` |
| Control Center or Quick Access open | **Pill white**, dark clock and glyphs | `%{MenuVisible}` on `%{QuickAccessButton}` |
| Unread notifications | Deep-red count badge at the end of the pill (§3.3) | the bell `%{NotificationsIcon}` is present |
| Battery low / critical | Battery capsule whole-fill orange / red, **dark number** | Steam's `%{DashboardBar>LowBattery}` / `ReallyLow` alert state |
| Download running | Downloads as a 56 pp art disc in a white progress ring | `HeaderDownloadContainer` |

In `p2_control-center_bar.png` the focused pill (row 4) and the focused white Room View disc (row 5) are visibly larger and haloed. A white disc cannot get lighter, so on white the scale and the bloom carry the state; A25 measures it live.

### 3.3 The status pill

The pill is the visionOS status view (time, battery, network, volume; VR §20) and the door to Control Center.

- **Battery.** If Steam's **Settings › Power › Battery Percentage** is on, Steam renders the percentage. It becomes the number in a 50 × 28 whole-fill capsule: green, orange in Steam's LowBattery state, red in ReallyLow, always with a **dark** number. If the setting is off (as on this device), the pill shows a 40 × 22 level capsule with no number. **T2 never adds a percentage the user turned off** (SY C.4).
- **Controller batteries** keep Steam's own status items, drawn as small level capsules. Steam hides them during a low-battery alert, and so do we.
- **Unread count.** The bell `%{NotificationsIcon}` (Steam's node, present only with unread items) is restyled as a deep-red badge. T2 writes the count into a decorative child from the same store the bell reads (CC8).
- **Not separate targets.** As today, the status items are inside one button: one target.

### 3.4 Bar popups

| Popup | Phase 2 look | Rows and sizes | Placement |
|---|---|---|---|
| Playspace Menu (Playspace Setup, Adjust Floor Height, Recenter) | Thick glass menu, radius 28 pp, padding 8, leading glyphs, no separators | 64 pp rows 4 pp apart, 20 pp labels; width ≥ 280 pp | Steam's (centred on the button); +25 mm via CS4 |
| Streaming Status | Same slab. "Select game to stream…" is a 56 pp blue capsule (the one tinted primary); hosts as rows in a recessed platter; Advanced as a disclosure row | 64 pp | Steam's |
| Steam tab menu and app tab menus | Glass menu that grows from the tab; groups by space (Steam's `%{SectionGap}`); Power last | 64 pp rows | Steam's |
| + (Launch Program, Add Desktop Window) | **Owned by the launcher concept.** This concept keeps only the **+** disc and its white open state. "Liquid Glass" stays a row there | — | — |
| Tooltips | Panel glass capsule, 18 pp Semibold, Steam's delay | 40 pp tall | Steam's (below the bar) |

Steam's opaque `#0e141b` scroll-fade shadows in these lists are recoloured to transparent-to-glass gradients (`inventory/bar.md` §2.0).

### 3.5 Inputs

- **Laser:** the same targets, larger. Tab menus still open on hover (Steam's 200 ms).
- **Gamepad:** the same order. View ("Cycle View") puts focus on the bar. Left/Right moves along Steam, apps, +, Playspace, Room View, Streaming, [header buttons], the pill, the avatar. A activates; D-pad Up opens popups. Nothing is reordered, so no neighbour relation changes (D2 §12).

**Why the bar keeps Steam's order.** The critic noted that it is still Steam's horizontal toolbar in Steam's order. The D-pad follows DOM order (D2 §12), so a visual reorder would make Left/Right disagree with what is drawn. Steam's order already matches visionOS's grouping: navigation (Home, apps, the app launcher) on the left, system (status, which opens Control Center) on the right. The radical change is elsewhere. The bar's system half is now one capsule around a status pill, and that pill no longer opens a Steam panel: it turns the window into Control Center.

---

## 4. Control Center

### 4.1 Model and variants

| Question | Answer |
|---|---|
| What opens it | Activating the **status pill** (laser click or gamepad A). ≡ (Menu) on the pill opens Steam's Quick Access popup directly, as a power-user path (the CC3 patch maps `onMenuButton` to Steam's original open handler). Steam's own programmatic openings of Quick Access (the battery-alert jump, the Streaming small button) still open Steam's popup |
| What it is | Three tiles and a close circle rendered by one T3 view **in Steam's main window** (CC-M). While it is open, Steam's page layers fade out and the window's glass becomes the tiles' glass |
| What closes it | ×, B, the pill again, a press on the room between the tiles (a press on our full-window backdrop), any navigation of the main window (tab bar, Settings circle, Return to Game, Power), the dashboard hiding. No 2 s auto-close: Control Center stays until dismissed, as in visionOS |
| What it never does | Change a value on its own, block input during an animation, or move or resize the window |

| Variant | When | Gamepad path, and how agents verify it |
|---|---|---|
| **CC-M** (ships first) | The dashboard shows Steam's main window page (the Steam frame, page 3) | **Steam's main-window navigation tree, proven traversable by agents today** (SR §4, §6). A8 runs now |
| **CC-A** (gated, §4.11) | Once its gate passes: pages other than Steam's main window, instead of CC-C. On Steam's page CC-M stays the default (real glass, nothing behind it); CC-A replaces it there only if an `hvgrab` comparison favours it (R5) | Our own type-7 popup. Ships **only** after the CS10 spike (CC1) records PASS in `capabilities/cc-focus.md`. FAIL or INCONCLUSIVE: not shipped |
| **CC-C** (floor) | Any other page (desktop window, overlay app, SteamVR Now Playing or Settings) while CC-A is not shipped; or no T3 view loads (finders fail closed, SR §7) | Steam's own Quick Access popup, restyled with T1 only (§4.12). Its gamepad behaviour is stock, and nothing new is added to it |

The previous fallback **CC-B** (a Control Center tile swapped into Steam's Quick Settings panel) is **withdrawn**. Its gamepad path was as unverifiable as CC-A's (critique 1), and it dropped three Quick Access rows (critique 5). §17 has the details.

### 4.2 CC-M: host, open and close

- **Container.** A Steam modal in the main window: `showModal(jsx(ControlCenter), mainWindow)`, with our error boundary and an `onCancel` on the root (SR §3.6: "a modal is an alternative container for an overlay panel (Control-Center-style tiles)"). It overlays the current route without unmounting it, so closing returns to exactly the same page, scroll position and focus. [PLAUSIBLE]: CC11 tests it. **Fallback container:** a route `/library/lgs/cc` (the SR selftest's mechanism, [PROVEN]). B then calls `NavigateBack`.
- **Hiding the window.** T2 sets `data-lgs-cc` on the main window's root. A T1 rule fades Steam's page layers to `opacity: 0` on `fade` (441 ms): the route switch, the header, the in-window footer ornament and the scroll edges. Steam's modal layer and our view are excluded. No Steam node is removed or moved, and nothing changes layout. The faded container holds its own in-page glass, whose backdrop is inside it, so MO R1 (fading a parent of glass) does not take away a backdrop. A18 checks this with filmstrips.
- **Glass (T5).** The window's glassd cover dematerializes (`phase` hidden, `sheet-out` 514 ms; materialize ramps [PROVEN-P1], GD). At the same time, glassd draws the tiles' glass as **four slabs**: three `panel` and one `liquid` for the close circle. They are placed by the inset method (SP §2.5 option 1: glass *behind* Steam's transparent page at the tiles' own x/y, so nothing is moved and input stays native) and materialize on `sheet-in`. The result is a cross-dissolve of the glass. [PLAUSIBLE]: CC14. **Fallback:** the main surface's `shapes` (GD: union of up to 8 rounded shapes [PROVEN-P1]) switch from the window rect to the four tile rects at 50 % of the content fade, with `m` held at 1. The outline then jumps, but under a cross-fade.
- **Glass (T1, no glassd).** Tiles use the opaque end of the dial: black-blue **.94** + edge cues. The window content behind them is already gone, so nothing can ghost through (critique 2).
- **Laser.** The main panel is a laser target over its whole quad. A press between the tiles lands on our full-window backdrop element (DOM hit-testing ignores alpha) and closes Control Center. If SteamVR does not hit-test fully transparent texels (SP §6.4, [UNPROVEN]), such a press goes nowhere, which is harmless: ×, B and the pill still close it.
- **No pre-warm.** The main window is always rendered, so the view mounts in about 110 ms (SR §5: Navigate to mounted 106 ms). The 2.5 s first-paint delay of new popups (SP §3.2) does not apply.
- **Close.** The view unmounts at the end of `morph-close`. Steam's page layers fade back in from 40 % of it. The glassd cover returns on `sheet-in` while the slabs dematerialize.
- **Which page is shown (CC15).** CC-M opens only if the main window is the shown page: the Steam frame is selected and the frame's active page is `page:3` (SP §5, §9.3). The daemon reads systemui's `FrameStore` and publishes a flag in Steam's context. Steam's own `document.visibilityState` of the main window is the cheaper check if it tracks the page. Otherwise the pill takes the CC-C path.

### 4.3 Layout (main px; pt = px × 0.75)

All three tiles: **344 × 528 px** (258 × 396 pt; 10.6 × 16.2° cons, **13.1 × 20.1° at r = 1**, 11.4 × 17.4° today), radius 54 (concentric: 60 px corner circles at a 24 px inset), `panel` glass, top at y 40, x at 96 / 468 / 840, 28 px apart. The footprint with the close circle is **1088 × 604 px** (33° × 18.5° cons, **41° × 23° at r = 1**, 36° × 20° today). The reference's tiles are ≈ 290 × 420 pt, about 12.1 × 17.5° (VR §20). The aspect ratio is 0.65 (reference 0.62–0.69).

**Now (left, x 96)**

| Element | Position (px, tile-relative) | Size | Look | Action |
|---|---|---|---|---|
| Settings circle | 24, 24 | 60 (45 pt); hit 80 | thin fill .10, gear 27 | Steam Settings (same navigation as the tab bar's Settings); closes CC |
| Power circle | 260, 24 | 60 | thin fill, power 27 | closes CC, then `SteamUIStore.OpenPowerMenu` |
| Date | centred, 37 | 22 px Semibold, text-2 | — | — |
| Clock | centred, 88 | **104 px** (78 pt) Semibold, tabular, −0.035 em | white .97 | — |
| Battery row | 18, 204, 308 × 60 | one target, transparent at rest (pill on hover or focus). Three chips: glyph 24 + capsule 54 × 30, number **18 px Bold #0d0e12** on green (9.5:1), orange at Steam's LowBattery (8.6:1), red at ReallyLow (5.6:1); "Full" on white .86; bolt when charging | — | opens More Controls › Battery |
| — during Steam's low-battery alert | same slot | the row becomes a whole-fill orange (red when critical) capsule "Right Controller · 9 % ›", dark label | — | same action |
| Now Playing platter | 18, 276, 308 × 158 | recessed black .14, radius 36, padding 12. Art disc 64 (portrait crop), title 23 px Semibold, "Running · 1 h 12 min" 18 px text-2 | — | — |
| Return to Game | inside the platter, 284 × 60 | capsule, white .14, play glyph 22 | — | the app's bar tab handler (`DashboardTabClicked`); closes CC |
| — when nothing runs | same platter | dim disc + "Not Playing" text-2, no capsule | — | — |
| Notifications capsule | 18, 450, 308 × 60 | raised .10; stacked icons 34; "3 Notifications" 22 px Semibold; chevron | — | the list in place (§4.6). "No Notifications" in text-2 when empty |

**Controls (centre, x 468)**

| Element | Position | Size | Look | Action |
|---|---|---|---|---|
| Wi-Fi, Bluetooth, Airplane Mode, Motion Smoothing | x 18 / 98 / 178 / 258, y 18 | **68 px circles** (51 pt) at **80 px pitch** (60 pt): 2.09° / 2.58° / 2.24°, pitch 2.46° / 3.04° / 2.64° (cons / r = 1 / today) | off: black .30 recessed. On: whole-fill blue + white glyph (3.2:1, a non-text glyph ≥ 3:1). Airplane Mode on: orange + **dark** glyph | toggle (the same setter as Steam's Quick Access field) |
| Platter | 18, 102, 308 × 228 | black .14, radius 36, padding 6 | — | — |
| Refresh Rate row | in the platter | **72 px** (54 pt), contiguous; glyph 26; label 22 px Semibold; trailing "120 Hz" 20 px text-2 + chevron | — | More Controls › Performance, scrolled to Refresh Rate |
| Streaming row | in the platter | as above; trailing state ("Ready", "Streaming", "Off") | — | More Controls › Streaming (Steam's Streaming panel, QA key 9) |
| More Controls row | in the platter | as above | — | More Controls › Quick Settings (or the last section used) |
| Volume slider | 18, 346, 308 × 72 | §4.4 | — | value; glyph zone = mute |
| Microphone slider | 18, 438, 308 × 72 | §4.4 | — | value; glyph zone = mute |

**Room (right, x 840)**

| Element | Position | Size | Look | Action |
|---|---|---|---|---|
| Recenter circle | 24, 24 | 60 | thin fill, recenter glyph | the Playspace Menu's Recenter action |
| Playspace circle | 260, 24 | 60 | thin fill, playspace glyph | Steam's context menu in the main window (`showContextMenu`, SR §3.6) with Playspace Setup, Adjust Floor Height, Recenter, calling the same SteamVR handlers as the bar's menu (CC6). Fallback: open the bar's Playspace popup |
| Title | centred, 126 | 40 px Bold | white | — |
| Subtitle | centred, 178 | 21 px, text-2 | "Passthrough is on" / "off" | — |
| Off · On | 18, 248, 308 × 72 | segmented: recessed track, two 147 px segments; selected = white .94, dark label | — | the bar's Room View toggle handler, only when the other segment is chosen |
| Environment Brightness | 18, 346, 308 × 72 | capsule slider, mountain glyph | — | value (Steam's field) |
| Brightness | 18, 438, 308 × 72 | capsule slider, sun glyph | — | value (Steam's field) |

**Close.** A 56 px (42 pt) liquid-glass circle with an ×, centred 20 px under the Controls tile (x 612, y 588). Its 80 px hit region ends at y 656, 64 px above the window's bottom edge. SteamVR's frame controls and the bar are below that edge, so no other target is within 64 px (A27).

### 4.4 Sliders: anatomy and value mapping

A capsule of 308 × 72 px (radius 36, black .30 track + inner shadow) holds **two targets**:

| Part | x range | What it does |
|---|---|---|
| Glyph zone | 0–72 px | Volume and Microphone: **mute toggle**, Steam's `%{ClickableSliderIcon}` behaviour and handler. Brightness sliders: inert (the glyph is a label) |
| Value track | 72–308 px (236 px) | **value = (x − 72) / 236**, so every value from 0 to 1 is a click. The value is Steam's `SliderField`, sized to this track. The pointer maps to the value from the track's rect (CS2) |

- **Fill.** White .86 from the leading edge, width 72 + v × 236. The glyph (28 px, dark) sits in the always-filled glyph zone, as in ref 3.
- **Knob.** A 64 px white disc at the fill's end, shown only under laser hover or gamepad focus. On drag it lifts ×1.25.
- **Gamepad.** Left/Right step the value (Steam's slider; auto-repeat retargets, never queues). **X toggles mute** (`onSecondaryButton`, the same handler as the glyph), with the footer legend "X Mute". Up/Down leave the slider.

This removes the earlier design's dead band, in which the lowest values sat under the mute zone and could not be clicked (critique 5).

### 4.5 Low-battery state

During Steam's alert (`%{DashboardBar>LowBattery}` / `ReallyLow`), **only the battery row changes**. It becomes the orange (or red) whole-fill capsule with a dark label naming the device and level, and it keeps the same action (More › Battery). Now Playing and **Return to Game stay** (critique 5). Steam's own auto-jump to Battery Info remains part of Steam's Quick Access (CC-C, ≡).

### 4.6 The notification list (Now tile, in place)

| Element | Value |
|---|---|
| Shape | **No growth.** The tile keeps 344 × 528. Its content changes with a `page` transition (662 ms cross-fade, ≤ 16 px parallax), so no clip rect or window edge can cut it (critique 4) |
| Header | Back circle 60 at 24, 24 (chevron); "Notifications" 28 px Bold at x 96 |
| Cards | 308 × 84 px, radius 30, raised white .10 (pinned .15), 8 px apart, no dividers. Icon disc 50 (avatar, app art, or a system glyph on a whole-fill colour, dark glyph on orange and green); title 21 px Semibold; body 18 px text-2 with " · time" in text-3; unread = 14 px blue dot |
| Order | Steam's: pinned items (Battery Low, Low Disk Space, rewards, gifts, friend requests, comments, unread chat, items, trade offers, turns, community messages, support replies, family invites), then "Earlier" (SY A.4) |
| Overflow | Steam's scroller; the last 64 px fade (scroll edge, D2 §6.7) |
| Empty | "No New Notifications" 22 px text-2, centred |
| Action | A or click opens what the notification refers to, through Steam's own item component and handler (CC8). This navigates the main window, so CC closes. B or the chevron returns to the Now page |
| Fallback | If CC8 fails, the capsule opens More Controls › Notifications (Steam's panel inside CC). If CC12 fails too, it opens Steam's Quick Access popup on its Notifications tab |

### 4.7 More Controls: Steam's Quick Access inside Control Center

**More Controls ›** widens the Controls tile over the Room tile's slot to **716 × 528 px**. The glass grows on `morph-open` 607 ms, and the Room tile's content fades out in the first 40 %. The result is a split view (visionOS Settings, ref 8):

| Part | Value |
|---|---|
| Sidebar | x 0–258, recessed black .14 (no line). Six rows of 72 px at 80 px pitch (60 pt): **Notifications, Quick Settings, Performance, Battery, Streaming, Help** (Steam's five tabs plus the Streaming tab, key 9). Each has a 40 px colour circle (dark glyph on green and orange) and a 22 px Semibold label. Navigation selection = white .18 pill (D6) |
| Header | Back circle 60 at x 282, y 24; section title 30 px Bold |
| Content | x 282–698 from y 104: **Steam's own Quick Access tab panel component** for the chosen section, rendered unchanged inside our container. It is restyled at window scale with the §4.12 rules converted to main px: rows ≥ 72, labels 22, toggles `scale: 1.75` (CS1), capsule sliders, recessed platters, title-case section headers. Steam's rows, order, disabled states and handlers are Steam's |
| Retention | Every Quick Access row (SY Appendix 2) is here: the network row, all six Bluetooth device rows (five stay visibly disabled), Add Device, System Profile, Basic View, Manual GPU Clock, the non-VR rows, the VR rows, Reset to Default, Battery Info, the Help buttons, the Streaming hosts |
| Gamepad | The sidebar is a column. Right enters the content (explicit map; it never lands on a slider: the first non-slider row). In the content, Left returns to the sidebar except on a slider (Steam's settings pattern). B in the content returns to the sidebar, and B in the sidebar returns to the Controls page |
| Evidence | Rendering Steam's Quick Access components in the main window is the settings concept's P-S2 (SC §"Display" platter: module 51008 renders six QA VR components, rendered unchanged inside the settings route). Here it extends to whole tab panels: **CC12** [PLAUSIBLE] |
| Fallback | If CC12 fails for a section, that sidebar row opens Steam's Quick Access popup on that tab (the old deep link), restyled (§4.12) |

This keeps the user inside Control Center for every Quick Access function, which removes the "different app" seam the brief complains about (critique 5).

### 4.8 Focus graph and explicit neighbours

```
CC root  Focusable  onCancel = close; onButtonDown(LB / RB) = previous / next tile -> that tile's FIRST control
├─ Now       column: [Settings, Power] -> Battery row -> Return to Game -> Notifications
├─ Controls  column: [Wi-Fi, Bluetooth, Airplane, Motion Smoothing] -> Refresh Rate -> Streaming -> More Controls -> Volume -> Microphone
├─ Room      column: [Recenter, Playspace] -> [Off, On] -> Environment Brightness -> Brightness
└─ Close     reached by Down from the last control of any tile
```

- **First focus:** Wi-Fi.
- **No geometric moves between tiles.** Geometric moves land on the nearest target. From Return to Game (y 362–422) that is Volume (346–418), and from Notifications (450–510) it is Microphone (438–510). On a slider the next Right would change the value (critique 4). Every tile edge therefore has an explicit `onMoveRight` / `onMoveLeft` (SR §3.6), and **no explicit move targets a slider**:

| From | Right → | Left → |
|---|---|---|
| Power | Wi-Fi | (Settings) |
| Battery row | Refresh Rate | — |
| Return to Game | More Controls | — |
| Notifications | More Controls | — |
| Wi-Fi | (Bluetooth) | Power |
| Motion Smoothing | Recenter | (Airplane) |
| Refresh Rate | Recenter | Battery row |
| Streaming | Off | Battery row |
| More Controls | Off | Return to Game (Battery row when nothing runs) |
| Recenter | (Playspace) | Motion Smoothing |
| Off | (On) | Streaming |
| Sliders (Volume, Microphone, Env., Brightness) | value + | value − |

- Moves inside a row and Up/Down inside a column are Steam's (`flow-children` row / column). Edges do not wrap.
- **LB / RB** jump to the previous or next tile's first control (Settings, Wi-Fi, Recenter). There is no wrap.
- **B** closes the notification list or More Controls first, then Control Center. Focus returns to the main window's last focused element (Steam's focus memory), and View returns to the bar as always.
- **Hand-off from the bar (CC13).** A on the pill happens while the bar's tree has focus. Our handler opens CC-M, then calls the function Steam's Cycle View uses to hand gamepad focus to the main window. If that call cannot be identified, the user presses View once (stock Cycle View), and the root's `autoFocus` puts focus on Wi-Fi. Every function stays reachable either way.
- `p2_control-center_focusmap.png` draws this map.

### 4.9 Gamepad focus look (D-CC6) and laser hover

Laser hover stays visionOS-subtle: + white .08 and a light spot at the pointer, the eyes' role. **Gamepad focus has to be found without eye tracking**, so it is tvOS-strength (critique 3):

| Control | Gamepad focus |
|---|---|
| Circles (toggles, corner circles, close, bar discs) | `scale: 1.10` (independent property), + white .26 (**+ .12 on coloured fills**, so the white glyph keeps its contrast), specular arc ×2 (2 px, peak .98), contact shadow 0 8 16 black .34; on coloured, white or art fills a soft white **bloom** (0 0 18 px 5 px white .42), not a ring |
| Rows, capsules, cards, segments | No scale (D2: rows never scale). + white .26 under the content (the lift sits beneath labels and chips), arc ×2, a 6 px shadow; on a white selected segment and on the alert capsule, the bloom |
| Sliders | Knob shown, track lifted + .26, bloom |
| Status pill | `scale: 1.06`, + .26, arc ×2, bloom |
| First frame | ≥ 60 % of final contrast immediately (static `!important` fill), so focus is never invisible during D-pad auto-repeat |

Measured on the mockup renders (mean Rec.709 luma 0–255, focused target minus its at-rest twin, `p2_control-center_states.png`):

| Control | ΔL focus |
|---|---|
| Blue toggle | **+47** |
| Off toggle | **+49** |
| Platter row | **+47** |
| Capsule | **+43** |
| Slider | **+29** |
| Segment | **+50** |

The focus column's glass sits about 20 L darker in that render (room adaptation), so these figures are lower bounds. In context (`p2_control-center_gamepad.png`), focused Wi-Fi measures +41 over the unfocused Bluetooth beside it. A25 sets the live threshold: ≥ 25, or ≥ 15 plus the scale on coloured fills.

### 4.10 Bindings: same handlers, no new behaviour

Rule: every Control Center control calls **the same Steam or SteamVR handler** as the existing control, found by reading Steam's modules (static source reading only; CC4–CC6). No code path writes a value the user did not choose.

| Control | Existing home it mirrors | Binding |
|---|---|---|
| Wi-Fi, Bluetooth, Airplane Mode | Quick Access › Quick Settings toggles | the store setter the Quick Settings field calls (CC4) |
| Motion Smoothing | Quick Access › Performance › VR toggle (module 51008, SC) | same (CC4) |
| Refresh Rate, Streaming, More Controls rows | Quick Access tabs | open More Controls at that section (CC12); fallback: open Steam's popup at that tab (CC5) |
| Volume, Microphone (+ mute) | Quick Access › Audio sliders and `%{ClickableSliderIcon}` | Steam's `SliderField` with the same value source and setter; mute = the icon's handler (CC4) |
| Brightness, Environment Brightness | Quick Access › Brightness sliders | same (CC4) |
| Room View Off · On | bar Toggle Room View (SteamVR action 432800007) | that button's handler; state from `VRDashboardBarSmallButtonActive` (CC6) |
| Recenter, Playspace menu rows | Playspace Menu rows / button (action 432800001) | those handlers (CC6) |
| Settings | tab bar › Steam Settings | the same navigation |
| Power | tab bar › Power | `SteamUIStore.OpenPowerMenu(el)` (`inventory/shell.md` §4) |
| Battery row | Quick Access › Battery Info | More › Battery (CC12) |
| Return to Game | the app's bar tab | its `DashboardTabClicked` handler (CC6) |
| Notifications | Quick Access › Notifications | Steam's list item component and handlers (CC8) |
| Clock, date, batteries, unread count | bar status items, Battery Info | the stores those read (read-only) |

### 4.11 CC-A: the popup variant, behind a gate

CC-A renders the **same component** (same CSS px) in Steam's type-7 popup host. It is kept because it can float in front of *any* page and keeps the window visible behind it. It is not shipped until its gamepad path is proven by an agent-run method.

**Ship gate (critique 1).** CC-A ships only when **CC1** records **PASS** in `docs/phase2/capabilities/cc-focus.md`, by the CS10 spike below. **INCONCLUSIVE** (the bar's focus could not be obtained unattended, e.g. `vr-null-tree`) and **FAIL** both mean: not shipped. CC-M remains the default and CC-C covers other pages.

**The CS10 spike** (one locked step: `lab.lock` and `lab-vr.lock`; never-list respected; restores everything; TTL timer in the page):
1. Static reading only: find the bar module's focus path that Cycle View uses (`FocusDashboardBar`, SY C.0.2) and the call that activates a popup window's navigation tree.
2. Open CC-A's host with our view (`CreatePooledPopup(7, …)`), `interactive: true`, visible. Wait for state 2 + 3 s (first paint).
3. Call the bar-focus path. Assert `.gpfocus` in the **bar** document within 1 s. If it is absent: **INCONCLUSIVE**; go to step 7.
4. Call our pill handler (the CC3 patch, or the open + hand-off calls directly). Assert `.gpfocus` on Wi-Fi **in the type-7 host** within 1 s. If it is absent: **FAIL**; go to step 7.
5. `L.pad` in the host: right → Bluetooth; down ×4 → More Controls → … per §4.8; LB/RB; check that no horizontal move lands on a slider.
6. B: the host closes and `.gpfocus` is back on the pill.
7. Restore: `ClosePooledPopup`, `FocusApplicationRoot()` on main, theme state as found. Write the result, build ids and the trace to `capabilities/cc-focus.md`.

**Request** (fields from SP §3.1):

| Field | Value |
|---|---|
| `parent_overlay_key` | the bar (`valve.steam.gamepadui.bar`) |
| `origin_on_parent` / `origin_on_popup` | {0, 1} (top centre of the bar) / {0, −1} (bottom centre of the content box) |
| `offset` | `y_pixels` **40** (≈ 34 mm, 1.9° above the bar's top edge; critique 4); `z_meters` 0.025 / S (0.068 at S = 0.369; read S live) |
| `scale` | **0.83**: one CSS px then has the angle of one main-window px (0.031° cons, 0.040° meas), so CC-A and CC-M are the same size and D2's main-window minimums apply unchanged |
| `interactive` | true while shown; false while pre-warmed (with the guard below) |
| `inherit_parent_curvature` | true |

- **Content box: fixed at 1088 × 616 px from the start** (tiles, close circle and its hit region). The notification list is in place and More Controls widens inside the same box, so the clip rect Steam measures at open (SP §3.1) never has to change (critique 4). A30 checks it.
- **Pre-warm guard (critique 4).** The host is opened when the dashboard shows, with our content at opacity 0, `interactive: false`, and the root `Focusable` `childFocusDisabled` (the tiles are not mounted). After every hide, `DumpLaserOverlays` must list the host's panel under `skippingDueToNonInteractivity` within 1 s; otherwise `ClosePooledPopup` and CC-M / CC-C for the rest of that session. Until the first paint is confirmed (state 2 + 2.5 s), the pill takes the CC-M / CC-C path. A20b measures the cost of the hidden host.
- **Material, honestly (critique 2).** glassd frosts its *room map*, in which Steam's window is masked while the dashboard shows (GD "Masks"). Behind the window that map keeps whatever was last captured while the dashboard was hidden. Where nothing was ever captured, today's glassd fills flat grey (NE §3). So a CC-A tile over the window frosts *the room behind the window* or *grey*, never the window. While CC-A is open, the window is dimmed to 0.6 by the proven `t1` tint (SP §5, on `fade`). `p2_control-center_popup.png` renders the grey case, with glassd's adaptive tint pulling the grey into the text band. That flat look is why CC-M is preferred where it can run.
- **Yield (pool of 1).** If Steam requests a type-7 popup (the VR controllers popup; Help › Replay Guided Tour) while ours holds the host, ours closes at once and that session uses CC-M / CC-C.
- **glassd.** The type-7 host must be reported as a surface (key prefix `vrcontrollers`, 4 shapes) (SP §11.2 item 3; CC9).

### 4.12 CC-C: Steam's Quick Access, restyled (and the deep layer of ≡)

Steam's panel is kept whole and restyled (T1). It is what the pill opens on non-Steam pages (CC-A not shipped), what ≡ on the pill opens, what Steam's own programmatic openings show, and the floor if no T3 view loads. `p2_control-center_fallback.png` shows it.

| Part | Steam node | Phase 2 |
|---|---|---|
| Card | `%{QuickAccessMenu}` (bg, border, r6) | Transparent. `%{PanelOuterNav}` becomes the tile: `panel` glass, radius 44 pp, no border |
| Tabs | `%{ViewPlaceholder>Tabs}` › `%{PopupBody>Tab}` × 5 | Same row and order, drawn as a 300 × 64 pp liquid capsule overlapping the card's bottom edge by 26 pp: 52 pp circles at 56 pp pitch. Selected = lighter disc .18 (Steam's selected animation overridden with `!important`); focus = D-CC6 |
| Title | `%{PopupBody>Title}` | 25 pp Bold. Its opaque top-fade shadow becomes a transparent-to-glass gradient |
| Sections | `%{*PanelSectionTitle>PanelSection}` | Title-case 17 pp Semibold text-2 headers; rows inside recessed platters; 1 px dividers removed |
| Rows | Field rows | ≥ 60 pp; labels 18–20 pp; descriptions 15 pp |
| Toggles | `%{*GamepadDialogContent>Toggle}` | `scale: 1.45` (38 × 22 → 55 × 32 pp), green on (CS1) |
| Sliders | `SliderControlPanelGroup` | 60 pp capsule hit area by padding, recessed track, white `::before` fill, Steam's handle as a 54 pp white disc (CS2). Notch labels 15 pp title case |
| Buttons | DialogButtons (Basic View, Reset to Default, Help) | 56–60 pp capsules, thin fill |
| Low-battery banner | `%{DashboardBar>LowBattery}` / `ReallyLow` | Whole-fill orange / red capsule, **dark** label |
| Bottom fade | `ContentTransition::after` (opaque) | Recoloured to fade into the glass |
| Order | — | Unchanged; non-VR rows stay before VR rows (D2 §12) |
| Placement | Steam's (centred on the pill) | +25 mm via CS4 [PLAUSIBLE]; else Steam's 3.7 mm |
| Material | — | T5: `panel` cover on `barpopup`, which frosts the room map (grey or room behind the window, never the window). T1: tint .78 + edges |

---

## 5. Power menu and confirmations

| Property | Value (main px) |
|---|---|
| Node | Steam's context menu in `main` (`79100.d4` → `showContextMenu`, `inventory/shell.md` §4, §7), identified by T2 as the Power menu |
| Slab | Thick glass, 440 px wide, radius 32, padding 8, centred where Steam centres it; +30 mm (in-place interactive crop) |
| Title | Steam's `BasicContextMenuHeader` "Power" drawn as a 44 px header row inside the slab, 22 px Bold text-2 |
| Rows | 72 px, radius 24, 4 px apart; leading glyphs (T2 decorative): moon, power, restart, VR goggles; person-swap, sign-out, restart |
| Groups | Device: Sleep, Shut Down, Restart Device, Restart SteamVR. Steam: Change Account, Sign Out, Restart Steam. Then Cancel. Steam's two separators become 8 px of space |
| Fit rule | 672 px in total fits the 680 px between Steam's 40 px header and the window bottom. With the 108 px header (CQ1), rows drop to 64 px |
| Labels | White at rest; **red whole fill on focus** for Steam's `Destructive` rows (D-CC1) |
| Focus | D-CC6 row treatment (+ .26, arc ×2); on destructive rows, the red fill |
| Window | Dims to 0.65 (`t1` tint, SP §5 [PROVEN]) on `fade` |
| First focus | Steam's (it can be Restart SteamVR). Changing it is a behaviour change that needs the user's approval (§16, R7) |
| Entry points | Tab bar › Power and Steam tab menu › Power (both unchanged); Control Center › Power circle (new, same call; CC closes first) |

**Confirmations** (`p2_control-center_power-confirm.png`) use the visionOS alert of D2 §3.7: 640 px wide, radius 44, title 28 px Bold on the left, body 22 px text-2. Two 60 px capsules sit side by side in Steam's order (`DialogTwoColLayout` is a nav row). The confirm capsule is whole-fill red with a 24 px Semibold label: large text, 4.4:1 composited over the glass. T2 tags it because the dialog came from the Power menu; Steam's `bDestructiveWarning` has no visual effect (`inventory/shell.md` §6.3). The alert sits at +30 mm with the window dimmed.

---

## 6. Volume HUD

| Property | Stock | Phase 2 |
|---|---|---|
| Shape | 250 × 34 hp capsule, 6 px track inside, 20 px glyph outside | **224 × 40 hp capsule** (14.4° × 2.6° at 0.82 m). The capsule is the track; the value is a white .86 fill with radius 20 from the leading edge (min 40, the glyph zone) |
| Glyph | left of the track | Steam's `AudioVolumeIcon`, 15 hp, dark, inside the fill (negative margin over the track; the HUD is not interactive) |
| Number | none | "55" 13 hp Semibold tabular (= 25 main px eq.), trailing, white on glass (T2 decorative node from `--normalized-slider-value`) |
| Muted | glyph changes | Steam's muted glyph; number "0" |
| Material | `rgba(14,20,27,.97)` | `panel` glass (T5 cover on `volumelevel`, already in glassd's mask list, GD); T1: tint .80 + edges inside the clip rect |
| Placement | head-locked, y −0.4 m, z −0.8 m, pitch −20° (27° below the eye line) | head-locked, **y −0.17 m, z −0.8 m, pitch −12°** (12° below the eye line), changed through the request wrapper for host type 5 (CS11, [PLAUSIBLE]); fallback: stock placement with the new look |
| Duration | 1 s after the last press | unchanged (Steam's timer) |

How: Steam's `SliderTrack` keeps its width and left. Its height and radius are restyled, and its `::before` fill is recoloured and given full height (colour, radius and height only; never width or left, `inventory/hud.md` §2.4). The clip rect follows `%{PopupContent}`, so the capsule is exactly the content box.

---

## 7. Battery and status: every home

**Label rule (critique 4).** Text on a coloured fill is **dark (#0d0e12)**:

| Fill | Contrast |
|---|---|
| Green | 9.5:1 |
| Orange | 8.6:1 |
| Yellow | 13.6:1 |
| Red | 5.6:1 |

White on green or orange would be 2.0–2.2:1 and is never used. Non-text glyphs are white on blue (3.2:1) and red (3.4:1), and dark on green and orange. The unread badge is the one white-on-red text: it uses a deeper red, `rgb(204 32 40)`, at 5.5:1.

| Home | Phase 2 | Rule |
|---|---|---|
| Bar status pill | Whole-fill capsule with a dark number when Steam's Battery Percentage is on; level capsule (no text) when it is off | never override the setting |
| Bar controller items | Small level capsules (Steam's items) | hidden by Steam during an alert; we follow |
| Control Center › Now | Chips with dark numbers for the headset, left and right (what Battery Info shows: a percentage or "Full") | colour = Steam's alert state |
| Control Center low-battery row | Orange / red whole-fill capsule replacing **only** the chips row | from `%{DashboardBar>LowBattery}` / `ReallyLow` |
| More › Battery, Steam's Quick Access › Battery Info | Restyled: headset row with a large capsule and the level 34 pp; controller rows 64 pp | unchanged behaviour, including the auto-jump |
| Low-battery toast | System banner with an orange icon disc and a dark glyph (§8) | Steam's notification setting decides |
| Controller model status texture | Unchanged (SteamVR's 256 × 256 texture on the controller) | out of scope |
| Clock | Bar 26 pp; Control Center 104 px | tabular figures |

---

## 8. Notification banners

| Property | Value (tp) |
|---|---|
| Quad | Steam's `notifications` window, 340 × 80, no clip rect; placed by SteamVR (`ShowCustomNotification`), unchanged |
| Card | The whole quad: 336 × 76 at a 2 tp inset, radius 30, `panel` glass (T5 cover on `notifications`, in glassd's mask list; T1 tint .82 + edges). Steam's VR `outline: 1px solid` removed |
| Content | Icon disc 48 (avatar, app icon; system events: glyph on whole-fill orange / red / blue, dark glyph on orange); title 20 tp Semibold; body 18 tp text-2, one line (TwoLine: two lines at 17 tp); time 15 tp text-3 top right |
| Variants | Incoming call keeps Steam's green whole fill as the card tint, with dark text; achievements show the achievement art as a rounded square (SM C.6) |
| Hover (laser) | + white .08 (Steam's hover state) |
| Motion | Materialize in place (§9). Our keyframes replace `toastEnterVR` in Steam's `animation` list; `toastExitVR` and its `--toast-duration` delay are kept (MO §4.10) |
| SteamVR's own toasts | Same card in `theme/vr/` (`notificationtoast.html`), replacing the blue gradient frame (owner: SteamVR pages) |

---

## 9. Motion (MO tokens only; D2 §11)

| Interaction | In | Out | What animates | Tier |
|---|---|---|---|---|
| Hover, any target | `hover-in` 294 ms b0 | `fade` 441 ms b0 | light spot (follows the pointer), fill alpha | T1/T2 |
| Gamepad focus | `hover-in`, first frame ≥ 60 % (static `!important` fill); circles' `scale` 1 → 1.10 on `hover-in` | `fade` | illumination, scale, bloom; no travelling indicator | T1 |
| Press (bar discs, toggles, corner circles) | glow `interactive` 210 ms b15; swell ≤ ×1.06 on top of the focus scale | glow off 90 ms linear; swell back `snappy` 488 ms b15 | glow, independent `scale` | T1 (+T2 pressed class for gamepad A) |
| Bar selection dot | `snappy` 488 ms | — | Steam's indicator transition retimed (transform untouched) | T1 |
| Pill turns white | `hover-in` | `fade` | fill | T1 |
| **CC-M open** | Steam's page layers opacity 1 → 0 on `fade` 441 ms. Window glass: cover `sheet-out` 514 ms while the 4 tile slabs materialize on `sheet-in` 735 ms (glassd ramps, MO §9). Tile content (T3): opacity over 15–50 % of `morph-open` 607 ms, never scaled; the centre tile first, side tiles 40 ms later. T1 tiles: glass channel `morph-open` with scale 1 + 12/528 = 1.023 → 1 from the bottom edge | — | page opacity, glass, content opacity | T1, T3, T5 |
| **CC-M close** | — | content out by 40 % of `morph-close` 441 ms; Steam's page layers back in on `fade` from 40 %; slabs `sheet-out`, cover `sheet-in` | glass, content, page | T1, T3, T5 |
| Toggle circle on / off | fill colour on `hover-in` 294 ms b0 | — | background colour | T3 |
| Slider hover / focus | knob materializes 250 ms linear | 350 ms | knob, illumination | T3 |
| Slider drag | knob lift ×1.25 `interactive` | settle `snappy` | value = pointer, no easing | T3 |
| Slider gamepad step | fill on `interactive` 210 ms, retarget on auto-repeat | settle 300 ms after the last step | fill width | T3 |
| Room View Off · On | pill travel `snappy` 488 ms b15; label colours swap at t90 | — | selection pill | T3 |
| Now ↔ notification list | `page` 662 ms cross-fade, ≤ 16 px parallax in the navigation direction; new cards `fade` 441 ms + 8 → 0 px, 30 ms stagger, ≤ 5 | old content 150 ms | opacity, translate | T3 |
| Controls ↔ More Controls | glass width 344 → 716 on `morph-open` 607 ms (T1 `clip-path` on the tile; T5 slab size); Room tile content out in the first 40 %; content `page` | `morph-close` 441 ms | glass shape, content | T3, T5 |
| Steam's Quick Access open / close (CC-C) | materialize 250 ms (replaces Steam's 2 s opacity) / 350 ms | — | glass channel | T1 |
| Its tab change | `page` 662 ms cross-fade, ≤ 8 px | old content 150 ms | opacity, translate (Steam's ±8–12 % replaced) | T1 |
| Bar popups (Playspace, Streaming, tab menus) | materialize at their place, scale origin at the edge nearest the button, 250 ms | 350 ms | glass channel | T1 (T5 morph optional) |
| CC-A open (when shipped) | as CC-M's tiles; + popup `offset.z` +5 → +25 mm on `depth` 441 ms (Δ 20 mm, M4), pushed at 60/s while moving | `morph-close` | glass, content, z | T3, T4 |
| Power menu | materialize centred 250 ms, swell 1.02 → 1; window tint 1 → 0.65 on `fade` | instant (Steam removes the DOM) | glass, tint | T1, T4 |
| Alert | as MO §4.9 | dematerialize 250 ms | glass, scrim | T1 |
| Banner | materialize 250 ms + translate −8 → 0 px on `snappy`, swell 1 + 12/336 | dematerialize 350 ms (Steam's exit timing) | glass, content | T1 |
| Volume HUD | materialize 250 ms; value steps on `interactive` | instant in T1 (Steam unmounts); 300 ms glass dissolve in T5 if the nodes survive | glass, fill | T1, T5 |
| **Reduce Motion** | every entry above becomes a 150–200 ms cross-fade; no scale, translate, z or width morph (More appears by cross-fade); glassd uses coverage alpha only; slider values jump | — | opacity | all |
| At rest | `document.getAnimations().length === 0` one second after any interaction | — | nothing | all |

---

## 10. Materials and tiers per element

| Element | T1 CSS | T2 DOM | T3 React | T4 scene graph | T5 glassd | Evidence | Fallback |
|---|---|---|---|---|---|---|---|
| Bar pieces, sizes, states | layout and look on Steam's nodes (§3.1) | light-spot coordinates; pressed class; badge count | — | — | `liquid` covers: 3 shapes on the `bar` surface | Bar no-touch list: `inventory/bar.md` §1.5. Bar segments drawn as glass capsules by the live native chain [PROVEN, NE "What worked"]; shapes [PROVEN-P1] | tint .78 + edges |
| Status pill → Control Center | — | — | type-swap of the button component's activation (props shape) | — | — | The same technique located the + button (SR §3.2, §8) [PLAUSIBLE] (CC3) | Steam's Quick Access opens (CC-C) |
| **CC-M view** | its own CSS in the view | `data-lgs-cc` on the main root | **the view** (Steam's `Focusable`, `DialogButton`, `SliderField`, `ToggleField`) in a Steam modal | — | — | Routes, components and focus in main [PROVEN] (SR §1–§6, 19/19 selftest); modal container [PLAUSIBLE] (SR §3.6) (CC11) | route `/library/lgs/cc` [PROVEN]; then CC-C |
| Window content hidden while open | opacity on Steam's page layers (`fade`) | the root attribute | — | — | cover `phase` hidden | Transparent main window [PROVEN visually] (SP §6.4, E6); materialize ramps [PROVEN-P1] (GD) | — |
| CC-M tile glass | T1: tint .94 + edges | — | — | — | 3 `panel` slabs + 1 `liquid` slab behind Steam's page at the tiles' x/y (inset method) | Inset method [PLAUSIBLE] (SP §2.5 opt. 1); slabs and partial covers [PROVEN-P1] (CC14) | cover `shapes` switch (union of ≤ 8 shapes [PROVEN-P1], GD); then T1 |
| More Controls | restyle of Steam's panels at window scale | — | Steam's QA tab panel components rendered in our container | — | inside the tile slab | QA VR components rendered in main by the settings concept (SC P-S2) [PLAUSIBLE] (CC12) | the row opens Steam's popup at that tab (CC5) |
| Notification list | card look | — | Steam's list item component (module 96144) | — | — | to read (CC8) | More › Notifications; then Steam's popup |
| Gamepad hand-off bar → main | — | — | call Steam's Cycle-View focus function | — | — | to read (CC13) | the user presses View (stock) |
| CC-A (gated) | same CSS | — | same view in a type-7 host | request: parent, z +25 mm, scale 0.83, interactive | `panel` cover, 4 shapes on the new surface | Own popup with z / scale / interactive [PROVEN] (SP E2, type 1); type 7 [PLAUSIBLE]; gamepad: CS10 spike (CC1); glassd surface: change needed (SP §11.2) | not shipped; CC-M / CC-C |
| Steam's Quick Access (CC-C) | full restyle (§4.12) | — | — | +25 mm via CS4 | `panel` cover on `barpopup` | restyle [PROVEN-P1]; CS1–CS2 [UNPROVEN]; CS4 [PLAUSIBLE] | Steam's switches and thin sliders, recoloured; Steam's 3.7 mm |
| Power menu | slab, rows, groups, red focus | menu tag, glyphs | — | in-place interactive crop +30 mm; window tint | `thick` slab | crop registration [PROVEN] (SP §2.2); dim [PROVEN] (SP §5) | flat in the window, no crop |
| Alert | D2 alert | red-confirm tag | — | crop +30 mm, tint | `thick` slab | as above | flat |
| Volume HUD | capsule, fill, glyph | number | — | placement via CS11 | `panel` cover on `volumelevel` | clip rect follows content (`inventory/hud.md` §0); CS11 [PLAUSIBLE] | stock placement |
| Banners | card, type, keyframes | — | — | — | `panel` cover on `notifications` | mock recipe `inventory/hud.md` §4.3; `notifications` in glassd's mask list (GD) | T1 tint |

**What each render shows (critique 2).**
- **CC-M** (overview, gamepad, notifications, more, dim) shows tiles frosting **the room**. That is exactly what ships: the window content is hidden, so glassd's room glass is the honest backdrop.
- **CC-M in T1** shows near-opaque tiles over an unblurred room.
- **CC-A** (popup) and **CC-C** (fallback) show **grey frost** wherever they overlap the window. That is glassd's room map with the window masked and nothing captured behind it (the rendering puts glassd's room map, not the window, under these tiles: `.roommap` in `control-center.css`).
- No render shows a material that frosts Steam's window content.

---

## 11. Function retention table

Every function in SY §A.3–A.9 and Appendix 2, SN A.7 / A.9 / A.11, SM A.4 and LA A.8 (+ only) / A.9. "Unchanged" means Steam's node and handler, restyled.

Path labels:
- **Laser** = controller laser.
- **Pad** = Steam's FocusNavController.
- **CC** = Control Center: CC-M where Steam's page is shown; on other pages CC-A once its gate has passed, otherwise CC-C.
- **More** = CC › More Controls.
- **QA** = Steam's Quick Access popup. ≡ on the pill opens it; it is also CC-C.
- **Pad to CC** = View → bar, Left/Right to the pill, A. Focus lands on Wi-Fi (CC13 hand-off; otherwise press View once more).

On pages where CC-C applies, every CC path falls back to the QA path in the same row.

### 11.1 Dashboard bar

| # | Function | Today | Phase 2 place | Laser | Pad | Tier |
|---|---|---|---|---|---|---|
| B1 | Select the Steam frame | Steam tab | Home circle (same node) | click | View → bar, Left/Right, A | T1 |
| B2 | Steam tab menu: Home, Library, Store, Friends & Chat, Media, Downloads, Console, Steam Settings, VR Settings, Power | hover the Steam tab | unchanged (glass menu from the Home circle) | hover 200 ms, click | bar focus on Home, D-pad Up (as today; unverified in SY) | T1 |
| B3 | Switch to an app or desktop-window frame; its tab menu (Close) | app tabs | apps capsule art discs (same nodes); menu as glass | click; hover for the menu | Left/Right + A; Up for the menu | T1, T2 |
| B3b | Same switch from Control Center | — | CC › Now › Return to Game (running app) | click | Pad to CC, D-pad to it, A | T3 |
| B4 | + list: open it, launch a program, add a desktop window, toggle **Liquid Glass**, close it (LA P1–P5) | + | + disc (same node, white while open); the popup belongs to the launcher concept | click | Left/Right to +, A; Up/Down + A in the list; B | T1 |
| B5 | Playspace Menu: Playspace Setup, Adjust Floor Height, Recenter | small button 1 | system capsule slot 1 (same node) + CC › Room › Playspace circle (menu) and Recenter circle | click | bar: Left/Right + A, then Up/Down + A; CC: D-pad + A | T1, T3 |
| B6 | Toggle Room View | small button 2 | system capsule slot 2 (white when on) + CC › Room › Off · On | click | bar: A; CC: Left/Right + A on the segment | T1, T3 |
| B7 | Streaming Status: Select game to stream, hosts, Advanced › Stream VR Without Game, conditional host states | small button 3 | system capsule slot 3 (same node) + CC › Streaming row → More › Streaming (Steam's panel) | click | bar: A; CC: D-pad + A | T1, T3 |
| B8 | Quick Access | status cluster | the pill opens CC; More = Steam's panels inside CC; ≡ on the pill opens QA | click | A on the pill; ≡ on the pill | T3 (CC-C: the pill opens QA) |
| B9 | Read time and status | 22 px clock, 18 px glyphs | pill: 26 pp clock, battery, glyphs 23 pp; CC › Now | look | look | T1, T3 |
| B10 | Account page | avatar | avatar disc (same node) | click | Left/Right + A | T1 |
| B11 | Tooltips | hover / focus | glass capsule tooltips, Steam's delay and placement | hover | focus | T1 |
| B12 | Conditional: Downloads progress, Family View / Kiosk lock, unformatted SD, low disk space (+ boot-reserve dialog), Steam connection warning, voice chat status | small buttons / status items | system capsule slots / pill glyphs, same nodes, Steam's order; Downloads as an art disc in a progress ring | click | Left/Right + A | T1 |
| B13 | Popups close: outside press, B, 2 s after leaving, another popup opening | Steam | unchanged for Steam's popups. CC: ×, B, pill, a press between the tiles, any main-window navigation, dashboard hide (no 2 s timer) | — | — | T3 |
| B14 | Focus the bar from anywhere | View ("Cycle View") | unchanged (also leaves CC focus for the bar) | — | View | — |
| R3 | Identify a running item | tooltip | tooltip + Now Playing title in CC | hover | focus | T1 |

### 11.2 Quick Access (Steam's panel, all tabs)

| # | Function | Phase 2 place (direct) | Also in | Laser | Pad | Tier |
|---|---|---|---|---|---|---|
| Q0 | Switch tab (Notifications, Quick Settings, Performance, Battery Info, Help, + Streaming) | More sidebar rows | QA tabs as a bottom capsule (≡) | click | More: Up/Down + A; QA: Left/Right + A | T3, T1 |
| Q1 | Close | CC: ×, B, pill; QA: B, outside press, 2 s | — | click | B | — |
| QN1 | Read notifications: pinned cards, unread rows | **CC › Now › Notifications list** | More › Notifications; QA tab | click capsule | D-pad + A | T3, T1 |
| QN2 | Open a notification's target | CC list card (Steam's handler) | More, QA | click | A | T3, T1 |
| QS1 | Brightness slider | **CC › Room › Brightness** | More › Quick Settings; QA | drag / click on track | Up/Down to it, Left/Right | T3, T1 |
| QS2 | Environment Brightness slider | **CC › Room › Environment Brightness** | More; QA | as above | as above | T3, T1 |
| QS3 | Volume + mute | **CC › Controls › Volume** (glyph zone = mute) | More; QA | drag; click the glyph | Left/Right; **X = mute** | T3, T1 |
| QS4 | Microphone Volume + mute | **CC › Controls › Microphone** | More; QA | as above | as above | T3, T1 |
| QS5 | Wi-Fi toggle | **CC › Controls › Wi-Fi circle** | More; QA | click | A | T3, T1 |
| QS6 | Current network row (opens settings / connects) | **More › Quick Settings › network row** (Steam's row) | QA | click | More: Right into content, Down, A | T3, T1 |
| QS7 | Bluetooth toggle | **CC › Controls › Bluetooth circle** | More; QA | click | A | T3, T1 |
| QS8 | Bluetooth device rows (6; 5 disabled, stay visibly disabled) | **More › Quick Settings** (Steam's rows) | QA | click | D-pad + A | T3, T1 |
| QS9 | Add Device | **More › Quick Settings** (Steam's row) | QA | click | D-pad + A | T3, T1 |
| QS10 | Airplane mode | **CC › Controls › Airplane circle** | More; QA | click | A | T3, T1 |
| QP1 | System Profile (2 notches) | More › Performance (Steam's slider) | QA | drag | Left/Right | T3, T1 |
| QP2 | Basic View | More › Performance | QA | click | A | T3, T1 |
| QP3 | Manual GPU Clock | More › Performance | QA | click | A | T3, T1 |
| QP4–QP7 | Performance Overlay Level, Disable Frame Limit, Scaling Mode, Scaling Filter (non-VR) | More › Performance, Steam's order | QA | click / drag | A / Left/Right | T3, T1 |
| QP8–QP10 | Show Perf Overlay in VR, Record VR Performance, Record Tracking | More › Performance | QA | click | A | T3, T1 |
| QP11 | Refresh Rate (notched slider) | **CC › Refresh Rate row** (shows the value) → More › Performance at that row | QA | click row, drag | A, Left/Right | T3, T1 |
| QP12 | Motion Smoothing | **CC › Controls › Motion Smoothing circle** | More; QA | click | A | T3, T1 |
| QP13 | Reset to Default | More › Performance | QA | click | A | T3, T1 |
| QB1 | Battery Info: headset row (clickable) | More › Battery (Steam's row) via **CC › Now › battery row** | QA | click | A | T3, T1 |
| QB2 | Controller battery rows | CC › Now chips (read); More › Battery | QA | look | look | T3, T1 |
| QH1–QH4 | Visit Help Site, Report a Bug, Replay Guided Tour, Show Frame Tutorial Videos | More › Help (Steam's buttons) | QA | click | A | T3, T1 |
| QL | Low-battery banner and auto-jump to Battery Info | CC › Now low-battery row (→ More › Battery); Steam's banner and auto-jump in QA | — | look / click | A | T3, T1 |
| QT | Streaming tab (key 9) content | More › Streaming (Steam's panel); bar Streaming button (QA popup) | — | click | A | T3, T1 |

### 11.3 Power and session

| # | Function | Phase 2 place | Laser | Pad | Tier |
|---|---|---|---|---|---|
| P0 | Open the Power menu | tab bar › Power; Steam tab menu › Power (both unchanged); **CC › Now › Power circle** (same call) | click | tab bar: D-pad Left / B at root, then A; CC: Pad to CC, Up/Left to Power, A | T1, T3 |
| P1–P4 | Sleep, Shut Down, Restart Device, Restart SteamVR | Device group, same items | click | Up/Down + A | T1, T2, T4 |
| P5–P7 | Change Account, Sign Out, Restart Steam | Steam group, same items | click | Up/Down + A | T1, T2, T4 |
| P8 | Cancel | last row | click; outside press | B | T1 |
| P9 | Confirm / cancel each action | visionOS alert, Steam's buttons and order | click; outside = cancel | Left/Right + A; B | T1, T2, T4 |

### 11.4 Volume HUD

| # | Function | Phase 2 | Laser | Pad | Tier |
|---|---|---|---|---|---|
| V1 | See the level after a hardware volume press | capsule with fill and number, 12° below the eye line | look | look | T1, T2, T4 |
| V2 | Drag while it shows (Steam accepts it; the popup is non-interactive) | unchanged | drag | — | — |
| V3 | Change volume otherwise | CC › Controls › Volume; More; QA; Steam Settings › Audio | drag | Left/Right | T3, T1 |

### 11.5 Battery, status, notifications

| # | Function | Phase 2 | Laser | Pad | Tier |
|---|---|---|---|---|---|
| S1 | Headset battery in the bar | pill capsule (level; dark number only with Battery Percentage on) | look | look | T1 |
| S2 | Controller batteries in the bar | Steam's items as small capsules | look | look | T1 |
| S3 | Volume glyph | pill glyph 23 pp | look | look | T1 |
| S4 | Wi-Fi glyph | pill glyph 23 pp | look | look | T1 |
| S5 | Steam connection warning | pill glyph (Steam's item) | look | look | T1 |
| S6 | Unformatted SD | pill glyph (Steam's item) | look | look | T1 |
| S7 | Unread notifications | deep-red count badge on the pill + CC › Now capsule | look | look | T1, T2 |
| S8 | Battery Percentage setting | Steam Settings › Power (settings concept), honoured | click | A | — |
| S9 | Battery details | CC chips; More › Battery; QA › Battery Info | click | A | T3, T1 |
| S10 | Low-battery banner | CC low-battery row; Steam's banner in QA (restyled) | look | look | T3, T1 |
| S11 | Low-battery toast | system banner (§8) | look | — | T1 |
| S12 | Controller status texture | unchanged (SteamVR) | look | look | — |
| S13 | Clock | pill 26 pp, CC 104 px | look | look | T1, T3 |
| NO1 | See that something is unread | S7 | look | look | T1, T2 |
| NO2 | Read the list | CC › Now list; More › Notifications; QA tab | click capsule / row / tab | CC: D-pad + A; QA: Left/Right + A | T3, T1 |
| NO3 | Act on a notification | card or row, Steam's handler | click | A | T3, T1 |
| NO4 | Read a toast as it arrives (+ hover, click as Steam) | banner card | look / hover / click | — (as today) | T1 |
| NO5 | SteamVR's own toasts | same card in `theme/vr/` | look | — | T1 (vr) |
| NO6 | Configure | Steam Settings › Notifications; SteamVR › General › Notifications (settings concepts) | click | Steam: A; SteamVR: — (as today) | — |

**Count:**

| Group | Rows | Functions |
|---|---|---|
| Bar | 16 | 16 |
| Quick Access | 27 | 35 (QP4–QP7, QP8–QP10 and QH1–QH4 are grouped rows) |
| Power | 5 | 10 |
| HUD | 3 | 3 |
| Status and notifications | 19 | 19 |
| **Total** | **70** | **83, 0 dropped** |

CC-C keeps every Quick Access function in Steam's own popup. Functions that belong to other concepts (B2, B4, S8, NO6) are listed where the bar or Quick Access reaches them and are owned there (§14).

### 11.6 Paths that change (critique 5)

| Function(s) | Today (laser clicks from the bar) | Phase 2 | Change | Mitigation / why accepted |
|---|---|---|---|---|
| Wi-Fi, Bluetooth, Airplane toggles (QS5, QS7, QS10) | pill → QA → scroll 2.5 screens → toggle | pill → circle | **shorter** (no scroll) | — |
| Volume, Microphone, both brightness sliders | pill → slider | pill → slider | same, larger | — |
| Motion Smoothing (QP12) | pill → Performance tab → scroll → toggle | pill → circle | **shorter** | — |
| Refresh Rate (QP11) | pill → Performance tab → scroll → slider | pill → row → slider (More opens at it) | same | the row shows the current value |
| Read notifications (NO2) | pill → Notifications tab (QA opens on Quick Settings) | pill → capsule | **shorter** | — |
| Read battery levels (QB2) | pill → Battery tab | pill (the chips are on the Now tile) | **shorter** | — |
| Network row, Bluetooth devices, Add Device (QS6, QS8, QS9) | pill → scroll → row | pill → More Controls → scroll → row | **+1 step** | ≡ on the pill opens QA directly (gamepad, as today). Laser users stay inside CC (no context switch) |
| Other Performance rows (QP1–QP10, QP13), Help (QH1–QH4) | pill → tab → (scroll) → row | pill → More Controls → section → row | **+1 step** | same; these are rare tasks (SY B.3 frequency) |
| Battery detail (QB1) | pill → Battery tab → row | pill → battery row → (More › Battery) row | same | — |
| Return to Game during a low-battery alert | (not in QA) | kept in CC; the alert replaces only the chips row | fixed | — |
| Low slider values by click | Steam's slider: anywhere on its track | value track 72–308 px maps 0–1; glyph zone = mute | no value unreachable | — |
| Deep links | (n/a) | stay inside CC (More); Steam's popup only if CC12 fails | **no context switch** | — |
| Gamepad: open | View → pill → A → QA (focus on the tab row) | View → pill → A → CC (focus on Wi-Fi) | same presses (+ View once if CC13 fails) | Steam's Cycle View is the stock way into the main window |
| Pages other than Steam's main window | pill → QA | pill → QA (CC-C) | same | — |

---

## 12. Capability questions this concept depends on

| Id | Question | Status | How an agent settles it (no human) |
|---|---|---|---|
| **CC1** | **CC-A gate.** Does gamepad focus enter our own type-7 popup from the bar and traverse it, with B returning focus to the pill? | [UNPROVEN]; SP §12 lists it among the items needing the wearer | The CS10 spike of §4.11 (PASS / FAIL / INCONCLUSIVE), recorded in `capabilities/cc-focus.md`. Only PASS ships CC-A |
| CC2 | Type-7 host: creatable from Steam JS; first-paint latency; laser passes when `interactive: false`; yield; memory | [PLAUSIBLE] (type 1 [PROVEN], SP E2) | `CreatePooledPopup(7, …)`; state 2 → visible by `hvgrab` (look, delete); `DumpLaserOverlays` lists it under `skippingDueToNonInteractivity` while hidden; simulated Steam type-7 request with a no-op popup closes ours within one frame; `/proc` RSS |
| CC3 | Can the pill's activation be redirected by type-swapping its component (props shape), keeping its tooltip, `%{MenuVisible}`, order and focus? | [PLAUSIBLE] (SR §3.2 located the + button the same way) | `audit bar` before and after (0 GONE / HIDDEN / SHRUNK / UNCLICKABLE); fiber `type` restored on removal (`patchedLeft: 0`) |
| CC4 | Which store getter / setter does each Quick Access field use (Wi-Fi, Bluetooth, Airplane, Volume, Microphone + mute, both brightness sliders, Motion Smoothing, Refresh Rate)? | to read | Static reading of the Quick Settings and Performance panel modules (found by source text, never called). Output a table; where references are reachable, assert `cc.binding.set === qamField.onChange` |
| CC5 | The call that opens Steam's Quick Access popup at a given tab (what the Streaming button does with key 9) | to read | Static reading of modules 34493 / 62678; then open each tab once (allowed: tab switching is safe) |
| CC6 | Bar handlers callable from T3: Room View (432800007), the Playspace menu's three actions (432800001), the Streaming button, an app tab's `DashboardTabClicked` | to read | Static reading; then a **spy test**: replace each handler with a recorder inside one locked step, activate the CC control, assert one call with Steam's arguments, restore. Never call the real handler |
| CC7 | Re-anchor and scale Steam's own popups: Quick Access, bar menus (CS4), the volume HUD's head-locked offset and pitch (CS11) | [PLAUSIBLE] (SP §3.3) | Wrap `SendPendingInstanceParamsToSteamVR`, open each popup (HUD via the `m_VolumePressedSubscribable` trigger, `inventory/hud.md` §2.2), read the params back from systemui's scene graph; `hvgrab` for the HUD angle (look, delete) |
| CC8 | Can Steam's notification list items (module 96144) and the unread count be rendered and read in our view with Steam's handlers? | to read | Static reading; render with the live store while it is empty (today) and with the static mock recipe of `inventory/hud.md` §4.3 adapted to the list; never trigger real notifications |
| CC9 | glassd surfaces: the type-7 host for CC-A (key prefix, mask, 4 shapes); `shapes` for `bar` (3), `barpopup`, `volumelevel`, `notifications` | change needed (SP §11.2 item 3) | `glassd --once --dump` with the spec; `tools/test_shapes.py`; look at the dumps, delete |
| CC10 | The signal Steam's bar popups use to close on an outside laser press (for CC-A); CC-M uses its own backdrop | to read | Static reading of the bar popup host (`Jt`, module 34493) |
| **CC11** | **Main-window modal container:** does `showModal(view, mainWindow)` render over the current route without unmounting it, take gamepad focus (`autoFocus` → Wi-Fi), call our `onCancel` on B, and restore the page's focus when closed? | [PLAUSIBLE] (SR §3.6) | One locked step: install, open the modal, `FocusApplicationRoot()`, `L.focused('main')` = Wi-Fi, `L.pad` sequence, B; assert the route's DOM node count is unchanged and its focused element restored. Fail → the route container |
| **CC12** | **Steam's Quick Access tab panels inside CC:** can the panel components (Quick Settings, Performance, Battery Info, Help, Notifications, Streaming) be found by source text / props shape and rendered in our container with Steam's handlers, gamepad-operable? | [PLAUSIBLE]; extends the settings concept's P-S2 (six QA VR components rendered in main) | Render each panel; `qam_sweep.js`-style read of rows: same header, row and disabled counts as Steam's popup (A11); `L.pad` through each panel reading values only; spy on one toggle's `onChange` |
| **CC13** | **Hand-off from the bar:** the function Steam's Cycle View (View button) calls to give the main window gamepad focus, callable from our pill handler | to read | Static reading of the bar / dashboard module; spy test that our handler calls it once. A live check is possible only when bar focus is obtainable (CS10's step 3) |
| **CC14** | **CC-M glass:** can glassd draw `panel` slabs *behind* Steam's transparent main page at the tiles' rects (SP §2.5 option 1), materializing while the window cover dematerializes? | [PLAUSIBLE] | `glassd --once --dump` with the spec; `hvgrab` with CC-M open (look, delete): tiles show frosted room, no window glass, no doubled content |
| **CC15** | Is the Steam main page the one shown? | to read | systemui `FrameStore` active page matches `page:3` (SP §5), published by the daemon; or the main window's `document.visibilityState` if it tracks the page. Test by switching to SteamVR's settings page and back (navigation only, as `vrsettings_sweep.js` does) |
| CS1, CS2 | Toggle `scale`, slider hit area and pointer mapping by the track rect (SY) | [UNPROVEN] | as in SY §C and SC (on a mock slider in a T3 page, never on a real setting) |
| CS10 | Bar focus helper for unattended traversal | needed | §4.11's spike, steps 1–3 |

---

## 13. Acceptance tests (agents only)

All live steps run inside the lab locks (`lab.lock`; `lab-vr.lock` for systemui), follow LAB.md's never-list, and restore what they change. Opening and closing Control Center and switching its pages is navigation (allowed). No control is ever *operated* except through a spy (A10). Values are read, never written.

| # | Test | Command / method | Pass |
|---|---|---|---|
| A1 | Mockups render | `python tools/mockshot.py docs/phase2/mockups/control-center-<name>.html shots/p2_control-center_<name>.png` for the 14 files | 14 PNGs; `data-lgk-ready` set |
| A2 | Sizes (mockup DOM now; the live CC-M DOM later with the same script body run over CDP) | `python docs/phase2/concepts/control-center-mockaudit.py` (every `data-id` target's size in its quad's px, toggle pitch, minimum text, bar width) | CC (main px): circles ≥ 60 (close ≥ 56 alone), toggle pitch ≥ 80, rows and sliders ≥ 72, no text < 18 px. Bar (pp): discs ≥ 56, pitch ≥ 64, no text < 15 pp. **Run 2026-10-07 on overview, gamepad, notifications, more, bar: PASS** (min text 18 px / 16 pp; toggle pitch 80; bar slots 64 pp; no target under its floor; bar 852 pp with two app tabs) |
| A3 | Bar functions kept | `python glass.py audit bar` (exact-key shim, `inventory/bar.md` §0.1) with the theme on; the OPEN snippet for each popup | GONE / HIDDEN / SHRUNK / UNCLICKABLE = 0 |
| A4 | Bar target sizes | `elementFromPoint` sweep over the bar at 2 pp steps | each slot ≥ 64 × 72 pp; + disc renders at 56 ± 2 pp |
| A5 | Bar states | `shot bar p2_bar_{rest,hover,focus,open}`, with the CLEANUP snippet after | Look: white only on Room View on, an open popup's source, and the pill while open; no ring in focus shots |
| A6 | Battery setting honoured | Read Steam's Battery Percentage value; shot the pill | no number on the pill when the setting is off |
| A7 | CC-M opens as specified | Locked step: open CC (our open function, no Steam handler involved); read the main DOM; `DumpLaserOverlays`; read glassd's spec | CC root mounted in a modal; Steam's page layers at opacity 0; **no new laser panel** (main only); glassd: main cover `phase` hidden, 4 slabs (3 `panel`, 1 `liquid`) at the tiles' rects ± 2 px; `shot main p2_cc_live` shows only the tiles |
| **A8** | **CC-M gamepad traversal (runnable today)** | After `inst.FocusApplicationRoot()` (SR §4): `L.pad` through §4.8's whole tree: every target reached; Down-Up and Left-Right return to the start; LB/RB land on Settings / Wi-Fi / Recenter; Down from each tile's last control reaches Close; B closes the list / More first, then CC | all reached in the expected order; B leaves no CC node; focus back on the main window's previous element; never `vr-null-tree` during the step |
| **A8b** | **No horizontal move onto a slider** | For every non-slider focusable: focus it (L.pad path), press Left, read `L.focused()`, return; press Right, read, return | the focused element after any horizontal press from a non-slider is never a slider (Volume, Microphone, Environment Brightness, Brightness, or a More slider) |
| A9 | No value changes | Snapshot every bound store value (CC4) before A8 / A8b and after | identical |
| A10 | Same handlers | CC6 spy test for every row of §4.10, by laser click and by gamepad A | each control records exactly one call to the same function as its stock home, with Steam's arguments |
| A11 | Quick Access kept whole, in QA and in More | `qam_sweep.js` (SY §0.2) before and after the restyle; the same read on More's six sections (CC12) | identical tab, header and field-row counts in QA; More shows the same rows per section, including the network row, 6 device rows (5 disabled, still disabled) and Add Device |
| A12 | Deep links stay in CC | Activate the Refresh Rate, Streaming, More Controls and battery rows (navigation) | More opens at the expected section; `vrPooledPopupStore` opened **no** barpopup host |
| A13 | Power menu | POWER snippet (`inventory/shell.md` §0.2, look only) + `audit main` with it; `L.pad` Up/Down through all rows | 0 GONE / SHRUNK; 8 items in Steam's order; slab ≤ 680 px tall; focus visible on every row (A25) |
| A14 | Power second path | CC Power circle with `OpenPowerMenu` replaced by a recorder | one call with an element; CC closed first |
| A15 | Volume HUD | `inventory/hud.md` §2.2 trigger (never changes the volume); `shot volumelevel p2_hud_volume`; `audit volumelevel`; params read back | capsule 224 × 40 hp; number = `round(100 × --normalized-slider-value)`; offset y −0.17, pitch −12 (or stock if CC7 fails) |
| A16 | Banners | Toast mock in a host ≥ 80 px tall (CQ9) with Steam's classes; `audit` of that host | card fills 336 × 76 tp; title 20 tp, body 18 tp; no outline; `toastExitVR` still in the computed `animation-name` |
| A17 | Motion tokens | During open, close, page change, More, toggle, slider step: `document.getAnimations()` in each touched window | every duration is a token (§9); iterations 1; 1 s later the list is empty |
| A18 | Motion filmstrips | Pause and seek the CC-M open at f = 0, .15, .35, .5, .75, 1; `shot main p2_motion_cc_open_<f>` | Steam's page fades while the tiles' glass comes first and the content after; no scaled text; no closed outline in any frame; in-page glass inside the fading page keeps its blur |
| A19 | Reduce Motion, High Contrast | CDP `Emulation.setEmulatedMedia` inside the lock (never Steam's settings) | Reduce: only opacity animates, ≤ 200 ms; More appears by cross-fade. Contrast: glass near-opaque; 2 px white .70 edge allowed |
| A20 | Performance, CC-M | `python glass.py perf main` while opening / closing CC and moving focus 20 times; glassd `gpu=` with 4 slabs | fps within 5 % of stock; no new frames > 34 ms; glassd ≤ 1.4 ms GPU |
| A20b | Performance, CC-A pre-warm (when gated in) | dashboard `perf` with the type-7 host pre-warmed and hidden vs absent | ≤ 2 % fps difference, no frames > 34 ms |
| A21 | Headset view | `hvgrab` with CC-M open (look, then delete) | tiles ≈ 13 × 20° at r = 1 (11.4 × 17.4° at r = 0.863); room visible in the gaps; glass L 55–110; no outline ring; **no window content visible**; no doubled content |
| A22 | glassd | `glassd --once --dump` with CC-M's spec (look, delete) | cover not drawn; 4 slabs drawn; nothing outside them |
| A23 | Removal and theme off | `lgs off`; then `status`: patched fibers, wrappers, popups, `data-lgs-cc` | `patchedLeft: 0`; no CC modal; Steam's page layers at opacity 1; Steam's popups back to stock params; the pill opens Steam's stock Quick Access |
| A24 | Persistence | After a Steam restart (only if another agent already restarted Steam: never restart it for this test) | stock bar and Quick Access |
| **A25** | **Focus visibility** | CDP shots of main (CC-M) and bar, each focusable focused in turn, over the bright and the dim room; the same pixels with focus on its twin (or at rest). Then one `hvgrab` (look, delete) | mean luma of the focused target region − its unfocused twin **≥ 25**; on coloured fills **≥ 15 plus a measured scale ≥ 1.08**. Mockup values: §4.9 |
| **A26** | **Contrast** | `audit` CONTRAST on `main` (CC-M open), `bar`, `barpopup` (CC-C), `volumelevel`, `notifications`; plus a script: every text node whose nearest background is a whole-fill colour | CONTRAST = 0; text on green / orange / yellow / red fills has computed colour #0d0e12; white text only on blue-tinted primaries, on the deep-red badge or on glass |
| **A27** | **Clearance** | CC-M: the close circle's 80 px hit rect against the window's bottom edge and SteamVR's frame controls (systemui DOM rects, scene units). CC-A: computed from the popup params and the bar's clip rect | CC-M: ≥ 64 px to the window edge; no other target within 24 px. CC-A: ≥ 36 pp (spec 40) between the × hit region and any bar target |
| **A28** | **CC-A gate** | Read `docs/phase2/capabilities/cc-focus.md` | the build ships CC-A only if it records PASS for the current Steam build |
| A29 | CC-A pre-warm guard (when gated in) | Hide the pre-warmed host; `DumpLaserOverlays` at 250 ms intervals; `L.pad` from the bar | the host is under `skippingDueToNonInteractivity` within 1 s; no hidden focusable is reachable |
| A30 | CC-A clip box (when gated in) | `DumpLaserOverlays` `fWidth` / `fHeight` with the host open on Now, on the notification list and on More | constant: 1088 × 616 px × 1.5 × Mp × 0.83 (± 1 %) |
| A31 | Non-Steam page → CC-C | Switch the dashboard page to SteamVR's settings (navigation only, as `vrsettings_sweep.js` does), activate the pill with Steam's open-QA call spied, switch back | Steam's QA open recorded; CC-M not mounted |
| A32 | Hand-off (CC13) | Spy on Steam's Cycle-View focus function; activate the pill via our handler | exactly one call; live effect checked only if CS10 step 3 can obtain bar focus |
| A33 | Navigation closes CC | With CC-M open, navigate the main window from the tab bar (navigation only) | CC unmounted; Steam's page layers at opacity 1 within `fade` |

---

## 14. Interactions with other concepts

| Owner | What this concept assumes from it |
|---|---|
| Shell (tab bar, window chrome, generic menus and alerts, floating footer) | The tab bar's Power entry and the generic menu / alert look; the floating footer shows our action descriptions. This concept adds only the Power-specific grouping, glyphs and the red-on-focus rule. While CC-M is open, the tab bar ornament stays (laser-only); using it navigates and therefore closes CC |
| Launcher ("+ › Launch Program") | Owns the + popup. The **Liquid Glass** row must stay reachable there |
| Settings (Steam Settings, SteamVR Settings) | Battery Percentage and notification settings stay where they are. CC12 shares P-S2's method (Steam's QA components rendered in main) and its restyle at window scale |
| Foundation (tokens, glassd, popup wrapper, daemon) | The CS4 wrapper; the CS10 spike; the T2 pointer coordinates and pressed class; glassd slabs behind the main page (CC14); the CC15 page flag; glassd surfaces for new hosts |

---

## 15. Decisions that depart from or refine DESIGN2

| # | DESIGN2 says | This concept does | Why |
|---|---|---|---|
| D-CC1 | §3.7: destructive menu rows have red labels at rest | Power menu: white labels at rest, red whole fill on focus | Steam marks 6 of the 7 power items `Destructive`; six red labels make red meaningless. Apple's own power menus are plain text and put the red on the confirmation, which carries the red capsule |
| D-CC2 | §3.6: Control Center tile rows 64 popup px in the inner platter; §4 rows 80 contiguous | Tile rows are 72 main px contiguous with 22 px Semibold labels (Callout) | 72 px is D2 §2.2's floor for a quad Steam fixes (the main window is 1280 × 720 by Steam) and 2.7° at r = 1. 80 px rows would push the tile to 552 px. The reference's rows are ≈ 52 pt (69 px) |
| D-CC3 | §3.6: tiles 300 × 440 popup px (≈ 361 × 530 main px) | 344 × 528 main px | Four toggles at 80 px pitch + three rows + two 72 px sliders need 510 px with 18 px insets; the aspect ratio 0.65 is within the reference's 0.62–0.69 |
| D-CC4 | §7.14: battery number only when Steam's setting is on | The same on the bar; Control Center shows numbers always | Control Center shows what Steam's Battery Info shows; it is a details surface, not the bar |
| D-CC5 | §3.6: toggles on = whole-fill colour | Control Center toggles use colour (blue; Airplane Mode orange); the bar's Room View button and the Off · On segment use white | visionOS uses blue for Control Center toggles (ref 3) and white for toggled ornament buttons and selected segments (D2 §8.2) |
| **D-CC6** | §8.2 / §10.1: gamepad focus = + white .14, light spot, arc ×1.5; rows and toolbar buttons never scale | **Gamepad focus only:** circles and the status pill scale ×1.10 / ×1.06; + white .26 (+.12 on coloured fills); arc ×2; contact shadow; soft white bloom on coloured, white and art fills. Rows still never scale. Laser hover unchanged | visionOS can be subtle because the eyes are the pointer; with a gamepad the user must first *find* the focus. At + .14, focus on a blue toggle or a white "on" disc was near invisible at the Frame's 19.6 ppd (critique 3). The model is Apple's own controller-focus language (tvOS). Measured: ΔL +29 to +50 (§4.9) |
| D-CC7 | §3.6: Control Center as bar-popup quads in front of the window | **CC-M**: Control Center is drawn in the main window; while it is open, the window's content and glass give way to the tiles | (1) its gamepad path is the main window's, which agents can traverse today (SR §4); (2) it is the only way the tiles can be real glass now (glassd frosts the room, not the window; NE §3); (3) it opens where the user is already looking, at a size no wider than the window; (4) it mounts at once (no 2.5 s first paint). CC-A stays available behind its gate |
| D-CC8 | §2.5: bar targets 67 pp (72 where it fits) | Bar discs 56 pp at 64 pp pitch | 64 pp is 3.0° at the measured distance (> visionOS's 2.5°) and above D2's hard floor (60 pp); it keeps the bar as wide as today (722 vs 700 pp) |
| D-CC9 | §7.11: Control Center slider value = white fill from the leading edge | The glyph zone (72 px) is a separate target (mute, or inert); the value maps over the remaining 236 px | so every value 0–1 is a click and mute stays one click, as in Steam's Quick Access (critique 5) |

---

## 16. Risks and open questions

| # | Risk | Mitigation |
|---|---|---|
| R1 | CC11 fails (the modal does not take focus or unmounts the page) | Route container `/library/lgs/cc` [PROVEN]; B = `NavigateBack`; the page re-renders with Steam's focus memory |
| R2 | CC14 fails (no slabs behind the main page) | Cover `shapes` switch under the content cross-fade; then T1 tiles (.94) |
| R3 | CC12 fails for some or all sections | That sidebar row opens Steam's QA popup at that tab (restyled); nothing is lost |
| R4 | CC13 not found: A on the pill opens CC-M but focus stays on the bar | The user presses View once (stock Cycle View, the way into the main window today); the root's `autoFocus` lands on Wi-Fi |
| R5 | Hiding the window may surprise: Control Center replaces what the user was looking at | It returns exactly as it was on close (modal: no unmount); every close path is one action; Reduce Motion keeps it a short cross-fade. Compare in `hvgrab` against CC-A once that is gated in |
| R6 | Steam's press transform on bar slots (×0.9 + `ClickPop`) is on the inventory's do-not-touch list | Override only as a decoration (independent `scale` ≤ 1.06) and verify hit areas with A4; if in any doubt, keep Steam's press and add only the glow |
| R7 | The Power menu's first focus can be Restart SteamVR | **Open question for the user:** may Glass Shell move first focus to Sleep or Cancel? Not shipped without approval |
| R8 | Localised labels are longer than English in 308 px rows | Ellipsis + the row's tooltip after 0.8 s; `audit` CONTRAST and a German-locale visual pass |
| R9 | The volume HUD unmounts instantly, so T1 has no exit animation | T5 glass dissolve if the nodes survive (MO §4.11 test) |
| R10 | The 340 × 80 toast quad limits banners to one body line (two at 17 tp) | Accepted; the list carries the full text |
| R11 | A head-locked HUD at 12° may sit over game action | Brief (1 s) and translucent; compare 12° and 15° in `hvgrab` |
| R12 | No 2 s auto-close for Control Center, unlike Steam's popups | visionOS keeps Control Center until dismissed; five explicit ways to close it |
| R13 | CC-M has no stereo separation of its own (the window plane) | In-place pops would double the content (NE §1). Option needing sign-off: move the whole main panel +20 mm via `t1` while CC is open (SP §5 mechanism; forward translation not run; it would move the window, M5) |
| R14 | CC-M covers the window at today's r = 0.863 at 36° but at r = 1 at 41°; users who enlarge the window get a larger Control Center | It scales with the window the user chose; it never exceeds the window's own footprint |
| Q1 | Open: when the dashboard shows a non-Steam page, should the pill switch the dashboard to the Steam page and open CC-M, instead of CC-C? | Not done: it would hide the window the user is looking at. Ask the user |
| Q2 | Open: should More Controls remember the last section, or always open on Quick Settings? | Remember (Steam's QA opens on Quick Settings; More opens on the last section, defaulting to Quick Settings) |

---

## 17. Critique responses

The critic's review (score 6) raised the issues below. Every valid point is fixed; nothing was rejected outright, but points 5b and 6 are answered differently from the suggested fix, and the reasons are given.

| # | Critique | Response | Where |
|---|---|---|---|
| 1 | **Blocker: the gamepad path cannot be verified.** CC-A relies on focus entering our popup (SP §12, needs the wearer); CS10 does not exist; CC-B has the same blocker; no plan for "inconclusive" | **Accepted.** The primary variant is now **CC-M**, Control Center in the main window, whose navigation tree agents traverse today after `FocusApplicationRoot()` (SR §4, §6). A8 / A8b run now. CC-A is behind a **ship gate**: the CS10 spike (§4.11, 7 steps, PASS / FAIL / INCONCLUSIVE) must record PASS in `capabilities/cc-focus.md`; INCONCLUSIVE means not shipped. CC-B is withdrawn. Non-Steam pages use CC-C (Steam's own popup, stock gamepad behaviour). The one remaining unverifiable step, the hand-off from the bar into the main window (CC13), has a stock fallback (one press of View). The spike itself was specified, not run: it needs the T3 view and the CC3 patch, which are implementation work | §4.1, §4.2, §4.11, §12 CC1 / CC11 / CC13, §13 A8, A8b, A28, A32 |
| 2 | **Renders show a material no tier can produce** (tiles frosting the window's posters); the T1 render ghosts poster titles | **Accepted.** In CC-M the window content is gone while Control Center is open, so the tiles' glassd glass frosts the room, and that is what the hero renders show. T1 tiles are at **.94** with nothing behind them to ghost. CC-A and CC-C are re-rendered honestly: under them sits glassd's *room map* with the window masked (flat grey where nothing was captured, adapted into the text band), and CC-A dims the window with the `t1` tint. A21 checks "no window content visible" in `hvgrab` | §4.2, §4.11, §10 "What each render shows"; `p2_control-center_overview*.png`, `_popup.png`, `_fallback.png` |
| 3 | **Gamepad focus practically invisible** | **Accepted:** D-CC6 (scale ×1.10 / ×1.06, +.26, arc ×2, contact shadow, bloom on coloured and white fills; laser hover unchanged). The white glyph keeps its contrast by using +.12 on coloured fills. Measured on the renders: ΔL +29 to +50 (§4.9); in context, Wi-Fi vs Bluetooth +41. New test A25 | §3.2, §4.9, §15 D-CC6; `p2_control-center_states.png`, `_gamepad.png`, `_bar.png` |
| 4a | **D-pad Right between tiles lands on sliders** | **Accepted.** Explicit `onMoveRight` / `onMoveLeft` at every tile edge; none targets a slider; LB/RB kept. New test A8b, and A9 covers the full traversal | §4.8; `p2_control-center_focusmap.png` |
| 4b | **Close × 12 pp above Room View** | **Accepted.** CC-M: the × is in the window, 64 px above its bottom edge, far from any bar target. CC-A: `offset.y` 40 pp (≥ 36), and a computed cross-quad clearance test A27 | §4.3 Close, §4.11 Request, §13 A27; `p2_control-center_popup.png` |
| 4c | **Battery numbers white on green / orange at 2.0–2.2:1** | **Accepted, extended:** dark #0d0e12 on green, orange, yellow **and red** (white on red is 3.4:1, which fails D2 §13's 4.5:1); non-text glyphs dark on green and orange. The unread badge keeps white digits on a deeper red (5.5:1). A26 tests it | §3.3, §7 label rule, §13 A26 |
| 4d | **Notification stack grows past the clip rect** | **Accepted, fixed differently:** the list now replaces the Now tile's content **in place** at the same size, so nothing grows; More Controls widens inside the same box. CC-A's content box is fixed at 1088 × 616 from the start, and A30 checks it is constant | §4.6, §4.7, §4.11 |
| 4e | **Pre-warmed hidden popup could be an invisible laser shield** | **Accepted** for CC-A: `childFocusDisabled` / unmounted tiles while hidden; a `DumpLaserOverlays` guard within 1 s after every hide, else close the host and use CC-M / CC-C for the session; the pill takes CC-M / CC-C until first paint is confirmed; A20b, A29. CC-M needs no pre-warm at all | §4.11 Pre-warm guard, §13 A20b, A29 |
| 5a | **CC-B drops the network row, Bluetooth device rows and Add Device** | **Accepted:** CC-B is withdrawn. Those rows are in **More Controls** (Steam's own Quick Settings panel inside CC) and in QA; A11 counts them in both | §4.1, §4.7, §11.2 QS6 / QS8 / QS9, §13 A11; `p2_control-center_more.png` |
| 5b | **Paths made worse were not listed**: deep QA functions one step deeper, Return to Game lost during a low-battery alert, low slider values not clickable; deep links eject the user into Steam's QA | **Accepted.** §11.6 lists every path that changes. Return to Game now stays: the alert replaces only the chips row. Sliders map the value over the track beside the glyph zone, so no value is unreachable (D-CC9). Deep links open **More Controls inside CC** (CC12), so there is no seam; Steam's popup appears only if CC12 fails. **Not changed:** the +1 step for rare QA rows (network, devices, Performance, Help). Lifting them to the top level would crowd the tiles below visionOS sizes; ≡ on the pill still opens QA directly for gamepad users | §4.4, §4.5, §4.7, §11.6 |
| 6 | **Sizes understated** (1.43 m; Control Center and bar about 43–46° wide at the measured distance) | **Accepted.** Every angle is now given at both the conservative and the measured distance (§2.1). Answered by design rather than only by restating: CC-M is 41° at r = 1 and 36° at today's window size, never wider than the window; CC-A's request scale is 0.83 so it matches; the bar is narrowed to about today's width (722 pp = 34° measured) with targets that are 3.0° at the measured distance (D-CC8) | §2.1, §3.1, §4.3, §4.11 |
| — | Verdict: "still Steam's horizontal toolbar in Steam's order" | **Partly accepted:** the right half is now one system capsule around the pill (Steam's `%{Tray}`), and the pill turns the window into Control Center. **Order kept:** the D-pad follows DOM order (D2 §12), and Steam's order already groups navigation left and system right, as visionOS does | §3.5 |
| — | Suggested: "a main-window-hosted variant would make the gamepad path verifiable today and would also fix the glass-over-window problem" | **Adopted** as CC-M, the primary variant (D-CC7) | §4.1, §4.2 |
