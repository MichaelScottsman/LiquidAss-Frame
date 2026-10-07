# UX audit: window chrome and system navigation (`audit:shell-nav`)

Scope: everything that frames and navigates the main Steam window on the Steam Frame:

- the header (Back, the search field) and the search results route;
- the left navigation column (the VR main menu in `frame.menu`);
- page transitions;
- the in-window footer button legend and the floating footer under the window;
- modals, alerts and sheets, and context menus (including the Power menu);
- toasts;
- SteamVR's window chrome under the window: grab bar, resize corner, frame controls.

The dashboard bar is covered only where it overlaps navigation: the Steam tab menu, Quick Access and the avatar.

Audited live on 2026-10-06/07 (Steam build `11041156`, SteamVR web UI `11065908`) with the theme off and on. Inputs: `docs/inventory/shell.md`, `bar.md`, `hud.md`, `steamvr.md`, `docs/coverage/shell.md`, the 12 visionOS references in `docs/refs/visionos/`, and the bible rulebook (`../.claude/skills/run-liquid-glass-frame/references/design-language.md`).

The capability results in `docs/phase2/capabilities/` were empty when this was written. §C therefore names the open capability question each proposal depends on.

---

## 0. Evidence and units

### 0.1 Shots taken for this audit (all in `shots/`, 1.5x, transparent = room)

| file | what it shows |
|---|---|
| `p2_audit_home_off.png` / `_on` | Home: header (Back + search), no footer |
| `p2_audit_alltab_off.png` / `_on` | `/library/tab/AllGames`: tab row, filter segment, footer legend with 5 actions |
| `p2_audit_search_off.png` / `_on` | `/search/tab/All` with query "half": filled search field, result tabs, results, "View more in the Store" |
| `p2_audit_confirm_off.png` / `_on` | synthetic confirm dialog (no-op handlers) over AllGames |
| `p2_audit_menu_off.png` / `_on` | synthetic context menu with every item state |
| `p2_audit_power_off.png` / `_on` | the real Power menu (looked at, never selected) |
| `p2_audit_mainmenu_off.png` / `_on` | VR main menu (`frame.menu.70880005`), expanded by a synthetic hover |
| `p2_audit_vrsys_off.png` / `_on` | `vr:systemui` atlas: grab bar, resize corner, frame controls, controller status |
| `p2_audit_bar_on.png` | the dashboard bar, themed |

Phase 1 shots reused: `shell_*` (header title mode, modals, scroll panel, submenu, search focus, tab focus), `hud_keyboard_before.png`, `hud_footer_real_before.png`, `vr_np_*`, `vr_settings_before.png`, `bar_framemenu_*`, `bar_tabmenu_*`.

Snippets used: the `--pre` bodies in `docs/inventory/shell.md` §0.2 (HOME, SEARCH, CONFIRM, MENU, POWER) and `bar.md` §0.3 (FRAME MENU expand, with the popup id updated to `70880005`).

### 0.2 Physical scale of each surface (measured, not assumed)

The scales come from SteamVR's scene graph in `vr:systemui`. They were read with `buildNode()` on each `vsg-node[vsg-type=panel]` and by walking its `vsg-transform` parents.

| surface | metres per CSS px | how it was derived | degrees per px at 1.43 m |
|---|---|---|---|
| main window | 0.77 mm | `docs/NATIVE.md` (window corners from `GetTransformForOverlayCoordinates`: 0.98 m for 1280 px) | **0.031°** |
| Steam popups (bar, `frame.menu`, `floatingfooter`, `barpopup`, tooltips, keyboard, toasts) | 0.847 mm | `meters-per-pixel` 1.5308 mm per texture px × devicePixelRatio 1.5 × frame scale 0.369 | 0.034° (the bar is 0.13 m nearer: 0.037°) |
| SteamVR frame controls, their tooltips, More Options | 0.581 mm | `meters-per-pixel` 1.5744 mm × frame scale 0.369 (`ignore-parent-scale`) | 0.023° |
| grab bar | 0.300 mm | `width` 0.66675 m × 0.369 over 820 px | 0.012° |
| resize corner | 0.658 mm | `width` 0.1 m over 152 px (no frame scale) | 0.026° |

The visionOS minimum target is 60 pt, about 2.5°. At 1.43 m that is 62 mm, which equals:

- **81 px in the main window**
- 74 px in a Steam popup (67 px on the bar)
- 107 px in the SteamVR frame controls

The bible equates 60 pt with 2.5°, so 1 pt ≈ 0.042°. visionOS body text (17 pt) is then ≈ 0.71° per em, which is **≈ 23 px in the main window**.

### 0.3 Where things sit (scene-graph offsets)

- **Main window:** 0.98 × 0.55 m at about 1.43 m, so it subtends **37.8° × 21.8°**.
- **VR main menu (`frame.menu`):** anchored to the window's centre-left edge (`main_CenterLeft`), 1.4 cm outside it and 1 cm nearer.
- **Frame controls:** 1.5 cm below the window's bottom centre (`main_BottomCenter`, translation −0.04 × 0.369).
- **Bar and floating footer:** under translation (0, −1.2, +0.35) × 0.369, which is **0.44 m below and 0.13 m in front of** the dashboard origin.
  - If that origin is the window centre, the bar's top edge is about 0.17 m below the window's bottom edge.
  - The vertical span from the header to the bar is then about 0.75 m, roughly **29° of gaze travel**.
  - The origin is an inference; confirm it with one `native/spike/hvgrab` capture.
- **Laser-only panels:** the grab bar, resize corner, frame controls, their tooltips and the VR main menu are visible in the headset only while a laser points at the dashboard (`only_visible_with_laser`).

### 0.4 What could not be exercised

- **Gamepad traversal (`L.pad`).** At audit time Steam's navigation source was the laser (`ActiveNavigationSourceType` = 3). There was no `.gpfocus` in any window, and `FocusNavController.DispatchVirtualButtonClick` moved nothing. The gamepad paths below therefore come from Steam's source:
  - module 37730: `onMoveLeft` → `OpenMainMenu` in VR, and `onCancelButton`;
  - module 7284: `OpenMainMenu` → `FocusLeftFrameMenu`;
  - the inventories.
  
  A lab helper that hands focus to the main window's nav tree is needed before any Phase 2 traversal test can run (see §C.0).
- **Laser `:hover`.** It cannot be synthesised, so hover looks are taken from CSS.
- **Real toasts, the More Options popout and the header's browser mode.** None has a safe trigger; they are mapped from source.
- **One transient false alarm.** A first themed search shot showed no window glass and a white "View more" tile with white text. A re-shot and `glass.py audit main` (72 controls, 35 text runs, 0 issues) showed it was caught during another agent's theme reload.
  - Lesson for Phase 2 verification: re-shoot before judging a regression.

---

## A. Function list

"Laser" means the controller laser, which sets `:hover` and Steam's laser focus. "Gamepad" means Steam's FocusNavController (`.gpfocus`), or SteamVR's own focus where noted. Every row must stay reachable both ways after the redesign. A dash (—) means there is no path today.

### A.1 Header (`#header`, 1280×40 px, z 6000, above the modal scrim)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| H1 | Go back (history) | click **Back** (`%{BackContainer}`, 108×40) | **B** (each page's cancel handler; at the window root B opens the main menu, see N3) | Back is **not** focusable, so it is laser-only by design |
| H2 | Start a search | click the field (`%{SearchBox}`) | D-pad Up from the top row of a page reaches the header (Main's `onMoveUp`); focusing the field calls `onKeyboardShow` | Focusing it navigates to `/search/tab/All` and raises the VR keyboard |
| H3 | Type / edit the query | Steam VR keyboard (`keyboard` surface, 854×280 popup px, placed by SteamVR under the main window): click keys | D-pad over keys + A (keyboard nav tree) | The keyboard is in *minimal* mode for Steam fields: no text echo on the keyboard itself, so the typed text is visible only in the header |
| H4 | Clear the query | the field's clear (x) button (26 px circle) | Backspace on the keyboard | |
| H5 | Read the page title (title mode) | — (text only) | — | e.g. `/controller/calibration/0`; Back stays |
| H6 | Browser mode: URL bar | click | focus + A | on Steam web views; replaces search, removes Back. Not seen live |
| H7 | Account/support alert | click `#header_profile` | focus + A | only with active support alerts |

### A.2 Search results route (`/search/tab/{All,Library,Friends,Store,Tools,Hidden}`)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| S1 | Switch result category | click a tab (34 px tall capsules with counts) or the ‹ › arrows (32×32) | LB / RB (Steam's tabbed-page convention), or D-pad to the tab row + A | Empty categories can be hidden ("Hidden" appears only with matches) |
| S2 | Open a result | click a tile (game → app page, friend → profile, store → store page) | D-pad in the virtualized grid + A | tiles are about 191×89 px art (≈5.9° × 2.7°) plus a label row |
| S3 | "View more in the Store" | click the last tile | focus + A | opens store search |
| S4 | Leave search | Back, or any nav item | B | Clearing the text does not leave the route |

### A.3 Left navigation: VR main menu (`frame.menu.<id>`, popup quad at the window's left edge)

Items, in order:

1. Home
2. Library
3. Store
4. Friends & Chat
5. Media
6. Downloads
7. **Console** (Steam's own developer-console entry, module 80096, shown when its developer flag is set; it is present on this device)
8. Steam Settings
9. (Help, only during setup)
10. **VR Settings** (SteamVR action 432800008: switches the Steam frame to SteamVR's own settings page)
11. a gap, then **Power** (opens the Power menu, A.6)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| N1 | See the menu | appears only while the laser is active. Collapsed to 54 px icons; expands 500 ms after hover, collapses 800 ms after leaving | shown when it takes focus | The current section has a blue dot, so it is visible only when the menu is |
| N2 | Go to a section | click an item | D-pad Left at the left edge of any page's content (`onMoveLeft` → `OpenMainMenu` → `FocusLeftFrameMenu`), then Up/Down + A | Right or B returns focus to the window |
| N3 | Open the menu from anywhere | — | B at the window root (`onCancelButton` → `OpenMainMenu`) | The behaviour of B depends on history depth |
| N4 | Same items, second path | hover the bar's **Steam** tab: its tab menu (`%{Variant_TabMenu}`) lists the same items | focus the bar (View button, "Cycle View"), then the Steam tab. Whether gamepad focus opens the tab menu was not verified | a duplicate of N2 in another quad |

### A.4 Footer legend (`#Footer`, bottom of the window, 42 px tall, z 7000)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| F1 | Perform the focused element's actions (example, AllGames: **X Filter, Y Sort By, ☰ Options, A Select, B Back**) | click a legend item (`%{ActionButtonLegend}`, 83–106 × 35 px). It dispatches the action | the physical button | **For the laser this is the only path to Filter, Sort By and the Options (context) menu of a tile.** Hidden on Home. The legend changes with focus |

### A.5 Floating footer (`floatingfooter` quad under the window)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| FF1 | Learn the global buttons: "**Cycle View**" (View button: moves dashboard focus window ↔ bar) and "**Laser Mouse**" (LG/RG grips) | — (`interactive:false`) | the shown buttons | shown when the dashboard has no focus. Dimmed to 60% by Steam's `filter: brightness(.6)`. 12 px uppercase |

### A.6 Modals, alerts and sheets (ModalManager, in-window, scrim z 1500)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| M1 | Confirm / cancel a dialog | click OK / Cancel (about 278×40 px each). Click outside the card = cancel (`ModalClickToDismiss`) | D-pad Left/Right between buttons, A, B = cancel | Opening a modal closes every bar popup |
| M2 | Alert (single Close) | click | A / B | |
| M3 | Text prompt | click the input → keyboard | focus + A → keyboard | |
| M4 | Scroll a long dialog | wheel/drag in `ModalPosition` or `%{ScrollPanel}` | D-pad moves focus and scrolls (FocusRing visible) | |
| M5 | Header and footer during a modal | **Back, the search field and footer legends stay above the scrim, undimmed** (header z 6000, footer z 7000) | B goes to the dialog | Whether Back and search accept clicks while a dialog is up was not tested (no side-effect-free way) |

### A.7 Context menus (gamepad presentation: a centred sheet, not anchored to the invoker)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| C1 | Choose an item | click a row (48 px tall, min 280 px wide) | D-pad + A | Steam always appends a separator and **Cancel** |
| C2 | Open a submenu | click the row with › | A or Right | the submenu opens beside it |
| C3 | Toggle a checked item | click | A | |
| C4 | Dismiss | click outside, or **Cancel** | B | |
| C5 | Scroll a long menu | wheel | D-pad | `scroll-padding` 72 px |

**Power menu** (from N1 Power), in order:

1. Sleep
2. Shutdown
3. Restart Device
4. **Restart Steam VR** (Steam's preferred focus)
5. separator
6. Change Account
7. Sign Out
8. Restart Steam
9. separator
10. Cancel

Every item except Cancel opens a confirmation dialog. In the stock capture the first focus sat on the destructive **Restart Steam VR** (`p2_audit_power_off.png`). In the themed run the first focus was Sleep, so the initial focus is timing-dependent.

### A.8 Page transitions (no user function, but they gate input)

Route change:

- the old page fades and scales out over 200 ms with `pointer-events:none`;
- the new page waits 200 ms, then scales 0.95→1 and fades in over 600 ms.

**About 800 ms per navigation** in total. The app-details overlay cross-fades with a blurred scrim.

### A.9 Toasts (`notifications` quad, 340×80 popup px, placed by SteamVR relative to the dashboard)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| T1 | Read a notification (title 11 px, body 12 px, 40×40 logo) | passive; the card has a laser hover fill | — | Disappears after `--toast-duration`. No VR motion (enter/exit are opacity 1→1). Click behaviour not verified (no safe trigger). The notification list itself lives in Quick Access › Notifications (bar) |

### A.10 SteamVR window chrome (`vr:systemui` panels; laser-only visible)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| W1 | Move the window | drag the **grab bar** under the window (visual 636×12 px = 191×3.6 mm; hit area 246×40 mm) | — | not focusable (`bCanTakeKeyboardFocus:false`) |
| W2 | Resize the window | drag the bottom-right **resize corner** (100×100 mm hit) | — | |
| W3 | Show/hide the keyboard | frame control 1 (keyboard icon) | D-pad Down from the window into the frame controls (`%{HasGamepadFocus}`), Left/Right, A | toggle; the icon swaps when active |
| W4 | Float in World / View in Theater | frame controls 2–3 (icons only; names in tooltips) | same | move the window |
| W5 | More Options › Toggle Curvature, Dock on Left Controller, Dock on Right Controller | frame control 4 opens a popout | same; the popout takes SteamVR input focus | |
| W6 | Close (game frames only) | frame control after a wide gap | same | exits the app |
| W7 | Tooltips for W3–W6 | hover | focus | capsules 0.15 m above the button |
| W8 | "Enter Gamepad Mode" / "Use Laser Mouse to Interact" pill | click (enter variant only) | — | appears under laser-only pages (SteamVR Settings, bindings) |
| W9 | Now Playing frame (while a scene app runs): Resume, VR Controller Bindings, VR Video Settings, Exit Game | click | SteamVR's own focus: D-pad Up/Down, A, B = Resume | a different app's look inside the same dashboard |
| W10 | SteamVR Settings page (via VR Settings, N2) | click; laser only | **none**: a "Use Laser Mouse to Interact" banner | the Steam frame shows SteamVR's page in place of Steam's window |

### A.11 Bar entries that belong to navigation (detail in `bar.md`)

- **Steam tab:** selects the Steam frame; its hover menu is N4.
- **App tabs:** switch frames.
- **+ Launch Program:** lists programs, including **Liquid Glass**.
- **Small buttons:** Playspace Menu, Toggle Room View, Streaming Status.
- **Quick Access:** clock and status; opens the QAM with Notifications, Quick Settings, Performance, Battery and Help.
- **Avatar:** goes to `/account`.
- **Gamepad:** the View button cycles focus to the bar; then Left/Right + A. Tooltips show on focus.

---

## B. UX critique for VR

### B.1 Target sizes (angles at 1.43 m, or 1.30 m for the bar)

| control | size (px) | physical | angle (limiting side) | vs 2.5° |
|---|---|---|---|---|
| Header height / Back | 40 (Back 108×40) | 31 mm | **1.23°** | 49% |
| Search field | 1172×40 | 902×31 mm | **1.23°** tall | 49% |
| Search clear (x) | 26 | 20 mm | 0.80° | 32% |
| Search / library tabs | 34 tall | 26 mm | 1.05° | 42% |
| Tab-row arrows ‹ › | 32×32 | 25 mm | 0.99° | 40% |
| Footer legend item | 83–106 × 35 | 27 mm | **1.08°** | 43% |
| Dialog button | ~278×40 | 31 mm | 1.23° | 49% |
| Context-menu / Power row | 48 tall | 37 mm | 1.48° | 59% |
| VR main menu row (popup) | 54×54 | 46 mm | 1.83° | 73% |
| Bar tab (popup, nearer) | 80×80 | 68 mm | 2.99° | 120% (OK) |
| Bar small button / + hit | 48 / 54×48 | 41 mm | 1.79° | 72% |
| Toast card | 300×40 | 34 mm | 1.36° | — (passive) |
| VR keyboard key row | ~47 | 40 mm | 1.6° | 64% |
| Frame controls (SteamVR) | 67×51 | 39×30 mm | **1.19°** | 48% |
| Grab bar: visual / hit | 12 / 132 tall | 3.6 / 40 mm | 0.14° / 1.59° | 64% (hit) |
| Resize corner | 152 | 100 mm | 4.0° | OK |

**Findings**

- Every in-window chrome control (header, tabs, footer legend, dialog buttons) is **1.0–1.25°**: half the visionOS minimum. A typical controller laser at 1.4 m jitters by a few tenths of a degree, so these targets need deliberate aiming.
- The worst offenders are the ones used most: **Back and search** (1.23°), **footer legends** (1.08°, the laser's only route to Filter, Sort and Options) and **tabs** (1.05°).
- The window chrome under the window (frame controls 1.19°, grab bar visual 0.14°) is small *and* shown only while the laser is active.
  - Its hit sizes are SteamVR panel sizes, and changing a panel root's box resizes the quad. **A CSS-only redesign cannot enlarge them.**
- Spacing: footer legends touch (0 px gaps), as do the tabs (2 px). visionOS wants centres ≥ 60 pt apart or a 16 pt margin.

### B.2 Legibility

| text | size | angle (em) | vs visionOS body ≈ 0.71° |
|---|---|---|---|
| Search placeholder (italic, grey) | 16 px | 0.49° | 69%, and italic thin strokes |
| Back label, dialog body, menu rows | 16 px | 0.49° | 69% |
| Tab titles, result labels ("IN LIBRARY") | ~14 px bold uppercase, tracked | 0.43° | 61% |
| Footer legend labels | 12 px bold uppercase | **0.37°** | 52% |
| Toast title / body | 11 / 12 px | **0.37–0.41°** | 52–58% |
| Floating footer | 12 px uppercase at 60% brightness | 0.41° (popup) | 58%, and dimmed |
| Dialog title | 22 px bold | 0.68° | ~96% |

**Findings**

- Chrome text runs at 50–70% of visionOS body size.
- Uppercase tracked labels (tabs, footer, result labels) remove word shapes, which costs most at small angles.
- The placeholder is italic grey on glass, the weakest combination.
- Phase 1 fixed colour contrast, but not size.

### B.3 Discoverability

1. **The main navigation is invisible most of the time.**
   - It is a separate quad that appears only with an active laser, collapsed to icons.
   - A gamepad user has no visual cue that pressing Left at the edge of a page, or B at the root, opens it.
   - The "you are here" indicator (blue dot) lives only in that hidden menu. The window shows no section title (compare visionOS Settings, ref 8: section title centred in the toolbar).
2. **The footer legend does not look clickable.** It reads as console glyph hints (Steam Deck heritage). Laser users may never learn that it is the only way to sort, filter or open a game's Options.
3. **Back is laser-only and B is gamepad-only.** That is consistent, but on Home Back is still drawn and its effect (history) is not predictable from the UI.
4. **The frame controls are icon-only.** Pop-out = Float in World; the curved-screen icon = View in Theater. They idle at 60% opacity and are visible only with the laser. Curvature and docking are hidden under More Options.
5. **The floating footer explains the two most important global buttons** (View = Cycle View, grips = Laser Mouse) in the dimmest text of the whole UI, below the window.
6. **"VR Settings" and "Steam Settings"** sit side by side but open two different apps, one of which a gamepad cannot operate (W10).

### B.4 "Window into another app" seams

Ranked by how often the user meets them:

1. **Search** (the user's example):
   - A 40 px, full-width text strip with an italic placeholder: a browser address bar, not an OS search.
   - On the search route it becomes a light-grey `#b8bcbf` web-form field with dark text (stock).
   - The keyboard appears as a separate black slab below the window, about 25° of gaze from the text being typed. Minimal mode shows no echo.
   - Results replace the whole page as a new route with its own tab row. Search is a destination, not an overlay.
2. **Header idiom.** "← Back | 🔍 Search…" with a 1 px divider is a desktop-browser toolbar. visionOS uses a circular back chevron, a centred title and capsule fields (refs 5, 8, 4).
3. **Context menus and the Power menu.**
   - They are centred full-window modal lists with a floating text title, disconnected from whatever invoked them.
   - visionOS menus grow out of their button.
   - Destructive items look like normal rows until focused.
4. **Footer legend.** A gamepad-console legend strip in the bottom-right corner of a spatial window. visionOS has no legends; actions are buttons in a toolbar ornament (ref 11, the Music playback ornament).
5. **Two apps in one frame.** VR Settings swaps the window for SteamVR's settings (different type scale, purple "advanced" fills, laser-only banner). Now Playing and Controller Bindings are also SteamVR pages with their own idioms (AllCaps title bar, 72 px titles).
6. **Three focus languages:**
   - Steam's `.gpfocus` white fills;
   - SteamVR's `%{GamepadFocused}` grey fills and the blinking `%{FocusRing}` outline (Now Playing);
   - the bar's ring hint.
   
   Moving focus between the window, menu, bar and frame controls changes the look of "focused" each time.
7. **Window chrome under the window.**
   - SteamVR's grey rounded-square pills and a 12 px dark grab line form a different shape vocabulary from Steam's.
   - In dark mode the grab and resize panels are multiplied to 30% brightness.
   - In stock the grab bar is a dark line on a dark background.
8. **Toasts.** Steam Deck's 300×40 toast with a 1 px grey outline, square corners and 11 px text. visionOS notifications are rounded glass cards with an app-icon circle.
9. **Page transitions.** About 800 ms with a 200 ms dead time and a scale "breath" of the whole 38° window. It reads as a web page loading, not an OS view change.

### B.5 Navigation model problems

1. **Four navigation surfaces in four quads:**
   - the hidden left menu;
   - the bar's Steam tab menu (the same items);
   - B / Back history in the window;
   - the bar itself (tabs, Quick Access, avatar → account).
   
   The user must learn which quad holds which function. Nothing in the window says where you are.
2. **Search is a route, not an overlay.** Entering search loses the current context, and leaving needs Back. There are no recent searches or suggestions before typing; an empty query lists the whole library.
3. **Focus hand-offs between quads are invisible.**
   - Left at the page edge jumps into another quad (the menu).
   - Down from the window bottom jumps into SteamVR's frame controls.
   - View cycles to the bar.
   
   Each hop changes the focus style (B.4 item 6) and the menu/frame controls may not be visible until focus arrives.
4. **B is overloaded:** page back, close modal, close menu, open main menu at the root.
5. **Modal scope.** The header and footer stay above the scrim, undimmed, so the Back and search targets look live during a confirm dialog.
6. **Power is one click from navigation**, and its menu can open with focus on a destructive item (Restart Steam VR). Account actions (Change Account, Sign Out) are mixed in with device power.
7. **Ten to eleven nav items** (with Console and Help) against visionOS's ≤ 6 tabs. Power is in the nav list rather than a system place (QAM or Control Center, ref 3).
8. **A gamepad dead end:** VR Settings (W10) cannot be operated without the laser.

### B.6 Ergonomics (reach, neck, distance)

- **The most-used controls sit at the extremes:**
  - Back: top-left corner (≈ −18°, +10° from window centre);
  - search: along the top edge;
  - footer legends: bottom-right (≈ +4° to +19°, −10°);
  - the main menu: outside the left edge (≈ −19° to −27° expanded);
  - the bar: ≈ 0.44 m below the dashboard origin.
  
  A typical "browse → sort → open → back" loop sweeps the full 38° × 22° window plus the bar. Comfortable eye-only rotation is commonly put at about ±15°; beyond that the head turns.
- **Search ↔ keyboard:** the field is at the window's top edge and the keyboard is under the window. Every glance from keys to text crosses the whole window height (≈ 22–28°).
- **Laser arm posture:** small targets (B.1) mean holding the arm steady. The bottom-right footer and the bar below need the wrist dropped further.
- **Distance:** 1.43 m is fine for reading (≥ 1 m), but at that distance Steam's px are smaller than visionOS points. All chrome is about 60% of the visionOS angle, so the fix is size, not distance.
- **Vertical stack:** window, frame controls (1.5 cm below), grab bar, floating footer, then the bar (+ its tooltips below it, + its popups growing upward). About 29° from header to bar, with the bar 13 cm nearer. That depth step makes the bar a separate plane to refocus on.

### B.7 Motion versus the Liquid Glass spec

| element | today | Liquid Glass / bible |
|---|---|---|
| Route change | 200 ms delay + 600 ms `cubic-bezier(0,0,.1,1)` fade + scale .95→1; exit 200 ms | Materialize, not fade (P7). Springs: materialize 120–160 stiffness / damping 20, about 220–300 ms. No dead time. Avoid scaling a 38° field (peripheral motion) |
| Dialog / context menu | 500 ms opacity + scale(1) `cubic-bezier(.16,.86,.43,.99)` | 220 ms spring materialize; sheet: parent pushes back and dims |
| Main menu expand | width 300 ms after a 500 ms hover delay | visionOS tab bar expands on look; the delay is good but should be shorter (~250–350 ms) |
| FocusRing | pulses 20 × 1.2 s (≈0.8 Hz, about 24 s) | "No pulsing at rest"; avoid oscillation, especially near 0.2 Hz |
| Frame controls | opacity .6 ↔ 1 over 0.4 s | fine (state change) |
| Toasts (VR) | no motion (opacity 1→1) | materialize in, dematerialize out |

### B.8 Materials versus the brief (Phase 1 state, from the `_on` shots)

- **Window glass is tint + rim.** It cannot frost or lens the room (CSS cannot see passthrough). The brief requires real Liquid Glass, which means T5 `glassd`.
- **Visible outline strokes.** The search capsule, tab capsule, footer capsule and menus show a thin light outline stroke. The brief says menus are glass slabs whose edge comes from the shader (specular rim and lensing), not from a stroke.
- **The VR main menu themed** is a flat grey gradient slab with a hairline (`p2_audit_mainmenu_on.png`): neither visionOS tab-bar glass nor a capsule.
- **No stereo.** All chrome lies on the window plane. The brief asks for subtle pop-out (header and footer capsules, menus, sheets).

---

## C. Redesign opportunities, ranked by impact

Impact = how often the user meets it × how far it is from visionOS × how much it fixes size or navigation. Tiers: T1 CSS incl. layout, T2 DOM augmentation, T3 Steam React views, T4 spatial compositor, T5 glassd.

Rules that apply to every item:

- Steam's nodes keep their identity, focusability and handlers.
- `glass.py audit` must report 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE ("moved >24px" is expected in Phase 2).
- D-pad direction must still match the visual layout. Steam's nav tree declares a `flow-children` direction (row or column) for each group, so a CSS reflow that turns a row into a column makes Left/Right move focus up and down the screen.

### C.0 Prerequisites found by this audit (do first)

1. **Header height is a constant, footer height is measured.**
   - The footer is measured: `#Footer` has a resize observer that writes `m_flCurrentFooterHeight` (module 97502). So **a taller footer automatically moves modals and page bottoms** through `--gamepadui-current-footer-height`.
   - The header is not: `m_flCurrentHeaderHeight` is set from the CSS-module constant `HeaderHeightVisible: "40px"` (module 37730, constant in 329). A taller header therefore needs **both**:
     - `--basicui-header-height: Npx !important` on `%{BasicUiRoot}` (beats Steam's inline var);
     - setting `HeaderStore.m_flCurrentHeaderHeight = N` (T3, in memory, restored on theme off), because JS consumers read it through a hook in module 1282.
   - **Capability question CQ1:** do both hold, and does scroll-into-view clear the taller header?
2. **A lab helper to activate gamepad focus in the main window**, so `L.pad` traversal can be verified unattended. Today `L.pad` silently does nothing when the navigation source is the laser.
3. **Transient theme reloads by other agents** make single shots unreliable. Verification should shoot twice, or check `glass.py status` and a known element, before judging.

### C.1 Search becomes a system search (highest impact; the user's named example)

- **Problem:** B.4 item 1, B.1 (1.23°), B.6 (field ↔ keyboard).
- **visionOS pattern:** a capsule search field with a leading magnifier and a mic slot (ref 4 Messages, ref 8 Settings sidebar search, ref 11 Music). Results appear in place.
- **Proposal:**
  1. The header search becomes a **centred Liquid Glass capsule 64–72 px tall** (≈2.0–2.2°; 80 px = 2.5° if the header can be 88 px), about 640–760 px wide, with a 22–24 px upright (not italic) placeholder at `--lgs-text-2`.
  2. In its idle state it is a field, not a strip. On the search route it stays the same glass capsule (no grey web field).
  3. **The query echo moves near the keyboard.** Use the keyboard's own buffered text row if Steam can be told to use it for Steam fields (CQ5), or a T4 display-only crop of the field shown just above the keyboard. Eyes stay within about 5° while typing.
  4. **The search sheet (T3):** focusing the field opens a glass sheet *over* the current page (not a route change) with recent searches and top library matches as large rows (≥ 64 px). Typing hands off to Steam's real `/search/tab/All` route, so every existing result path (S1–S4) stays untouched.
  5. **Results:** keep Steam's virtualized grid. Enlarge the result tabs to ≥ 56–64 px capsules in one glass segmented control. Labels in title case, not tracked uppercase.
- **Tiers:**
  - T1: header layout and field size, after CQ1;
  - T2: magnifier glyph and placeholder text unchanged;
  - T3: the sheet and the `m_flCurrentHeaderHeight` sync;
  - T4: pop the capsule +1.5 cm in stereo at the same x/y;
  - T5: real glass slab.
- **Retention:**
  - the `%{SearchBox}` input stays Steam's element, so keyboard, IME, `onKeyboardShow` and route behaviour are unchanged;
  - the gamepad still reaches it with D-pad Up;
  - the clear (x) grows to ≥ 44 px inside the capsule;
  - the sheet must be a first-class nav tree (Down from the field enters it, B closes it).
- **Verify:**
  - `shot main p2_search_*` for idle, filled and simulated focus (`gpfocuswithin` class as in `docs/coverage/shell.md` FIELDFOCUS);
  - `audit main` on Home and the SEARCH pre;
  - `L.pad` Up/Down after C.0.2;
  - an hvgrab capture to confirm the depth and the keyboard-echo position.
- **Open:** CQ1, CQ5 (keyboard buffered mode or T4 echo), CQ8 (a T3 overlay as a gamepad nav tree).

### C.2 The VR main menu becomes a visionOS tab-bar ornament, always visible

- **Problem:** B.3 item 1, B.5 items 1 and 7, B.1 (1.83°).
- **Key insight:** Steam's VR main menu is already **structurally a visionOS tab bar**. It is a separate quad hugging the window's left edge, collapsed to icons, and it expands on hover, exactly like TV (ref 5) and Music (ref 11). It fails only on visibility (laser-only), shape (a square slab of rows), size and selected state.
- **Proposal:**
  - **Shape and size:**
    - a vertical **glass capsule** with circular items **64–72 popup px** (2.2–2.4°) via the component variables `--menu-item-height`, `--menu-icon-size` and `--menu-item-padding` (Steam's own custom properties on `%{DashboardMenu}`), with 24–28 px icons;
    - **selected = white circle with a dark glyph** (DESIGN §3: white is reserved for selected);
    - labels appear on expand as a glass pill to the right of each icon, as in Music (ref 11);
    - shorter expand delay (CQ: is the 500 ms a JS constant we may change? if not, keep it).
  - **Always visible.** The frame menu popup is `only_visible_with_laser`.
    - Option A (T3): change that popup flag in memory (CQ3).
    - Option B (T4): show a non-interactive crop of the menu's texture at its exact position whenever the real quad is hidden. When the laser is active the real quad covers it and takes input. Gamepad focus already moves into the real quad (N2); verify that it becomes visible then.
  - **Grouping:**
    - Primary: Home, Library, Store, Friends, Media.
    - Utilities group (separate capsule): Downloads, Console, Steam Settings, VR Settings.
    - **Power** last, in its own small circle.
    - This uses Steam's existing `%{SectionGap}` split plus CSS spacing; no node moves.
  - **Where am I:** a T2 decorative label in the header showing the current section (from the active item), e.g. "Library", 28–34 px bold, like ref 8's toolbar title.
- **Tiers:** T1 (variables, shape), T2 (title label), T3 or T4 (visibility), T5 (capsule glass), T4 (ornament at +2–3.5 cm, as in the bible's tab bar at z +3.5 cm).
- **Retention:**
  - the same `DashboardMenu` items, routes and actions;
  - D-pad Left at the page edge and B at the root still open it;
  - the bar's Steam tab menu (N4) remains as a second path;
  - Power still opens the same menu.
  - **Do not set `width` on the menu** (it animates); the size changes go through the item variables, and the collapsed width follows the item size.
- **Verify:**
  - `shot frame.menu.<id> p2_nav_*` collapsed, expanded and active-route (`bar.md` §3 commands);
  - `audit frame.menu.<id>`;
  - pad Left from the first tile, then Up/Down, then Right (after C.0.2);
  - an hvgrab capture with the laser idle to prove visibility.
- **Open:** CQ3 (visibility), plus whether `--menu-item-height` changes keep the item's `scale(1.1)` active transform inside the 300 px popup.

### C.3 The header becomes a visionOS toolbar: circular Back, title, search

- **Problem:** B.1 (Back 1.23°), B.4 item 2, B.3 item 3.
- **visionOS pattern:** a circular back chevron at the top-left inside the window (ref 5 TV, ref 8 Settings), a centred title, and trailing circular action buttons (ref 2 Image Playground).
- **Proposal:**
  - **Back** becomes a **64–72 px glass circle** with a chevron glyph. Steam's "Back" text node stays in the DOM and visible, because hiding Steam text trips the audit's HIDDEN check. It can sit beside the chevron as a short label in the same capsule, or appear in a hover pill if a capability confirms that this passes the audit. T2 adds an `aria-label`.
  - Drop the 1 px divider look.
  - Header height becomes 80–88 px with a scroll-edge glass band instead of a black bar (C.0.1).
- **Tiers:** T1, T2, T4 (Back and the search capsule popped +1.5 cm), T5.
- **Retention:**
  - Back stays `%{BackContainer}` (laser click; the gamepad keeps B);
  - title mode (H5) and browser mode (H6) get the same toolbar (the title centred, the URL bar as the capsule).
- **Verify:**
  - shots on Home, AllGames, title mode (`/controller/calibration/0`) and a game page;
  - the audit (Back must not shrink);
  - `L.click('main','%{BackContainer}')` on a safe route returns to the previous safe route.

### C.4 The footer legend becomes a bottom action ornament with real buttons

- **Problem:** B.1 (1.08°), B.2 (12 px uppercase), B.3 item 2, B.4 item 4, B.6.
- **visionOS pattern:** the bottom toolbar or playback ornament (ref 11 Music: a capsule overlapping the window's bottom edge; ref 7 Safari toolbar).
- **Proposal:**
  - The legend becomes **one centred glass capsule** of buttons **64–72 px tall** (2.0–2.2°), centres ≥ 80 px apart.
  - Each button: a **mixed-case label at 18–20 px** with the controller glyph kept as a small leading badge, so it still teaches the gamepad mapping.
  - Primary-ish actions (Options, Sort, Filter) read as buttons. Select and Back may become compact circles.
  - Pop +1.5 cm (T4, same x/y); slab glass (T5).
  - The footer height grows, and Steam's measured `--gamepadui-current-footer-height` moves modal and page bottoms automatically (C.0.1).
- **Overlapping the window's bottom edge** as visionOS does is **not possible in T1** (the window quad clips). It needs either:
  - a T4 crop moved down with proven input routing (CQ4), or
  - making the `floatingfooter` quad interactive (it is `interactive:false` today; CQ: can a T3 change make it interactive and host the same actions?).
  
  Until then, keep it inside the bottom edge.
- **Retention:**
  - legend items stay `%{ActionButtonLegend}` with their click dispatch (laser) and are unchanged for gamepad buttons;
  - the content still varies with focus.
- **Verify:**
  - FOOTER shot (AllGames), a single-action shot (title mode) and over a modal (CONFIRM);
  - the audit;
  - a laser click on the "Back" legend on a safe route (other legends act on the focused game; look, don't click).

### C.5 Modals and alerts become visionOS alerts and sheets with depth

- **Problem:** B.1 (buttons 1.23°), B.5 item 5, B.7, B.8.
- **visionOS pattern:** alerts are compact glass cards with bold left-aligned titles and capsule buttons. A sheet comes forward while the parent window pushes back and dims (bible §5: sheet +10 cm, window −7 cm, alpha × 0.45).
- **Proposal:**
  - The dialog card becomes thick glass at `--lgs-r-sheet` with 22–26 px titles and 18–20 px body text.
  - Buttons become **≥ 64 px capsules**. Keep them side by side (`DialogTwoColLayout` is a row in the nav tree; stacking them would invert the D-pad directions). Primary tinted.
  - While a modal is open, visually recess the header and footer (lower contrast, no glass highlight), so they stop looking like live targets. Any dimming layer must be `pointer-events:none` and must not cover the footer legends, which stay operable.
  - **Depth (T4):** the dialog crop at +3 cm, the window base at its rest depth and dimmed by glassd. The x/y are unchanged, so input still lands on the real dialog.
  - **Motion:** a 220–300 ms materialize (`scale`/`opacity` independent properties, not Steam's `transform`).
- **Retention:** the same buttons and the same `ModalClickToDismiss`. The scroll container keeps `overflow`.
- **Verify:** CONFIRM, ALERT and ZOO text prompt / scroll panel shots; the audit; hvgrab for depth.
- **Open:** CQ7 (pushing the window plane back while the dialog stays put).

### C.6 Context menus and the Power menu become glass menus with safer defaults

- **Problem:** B.1 (rows 1.48°), B.4 item 3, B.5 item 6.
- **visionOS pattern:** a menu bubble that grows out of its button (bible §10 "menu bubble"), rows about 44–52 pt, destructive items in red.
- **Proposal:**
  - Rows **64 px**, 18–20 px text, `--lgs-r-row` radius.
  - The menu title becomes a header inside the slab (not floating above).
  - **Destructive rows are tinted red at rest** (label colour, plus the whole-row red fill on focus).
  - Power splits visually into "Device" (Sleep, Shutdown, Restart Device, Restart SteamVR) and "Account" (Change Account, Sign Out, Restart Steam) cards, using the existing separators.
  - Depth +3 cm (T4).
  - Anchoring to the invoker is attractive, but Steam's VR presentation is always the centred sheet. Treat anchoring as T3-only research (CQ10) and do not pursue it in the first pass.
  - **Default focus:** making the Power menu open on Cancel or Sleep instead of Restart Steam VR is a behaviour change. List it as an option needing the user's approval, not a default.
- **Verify:** MENU, SUBMENU and POWER shots (look only); the audit; pad Up/Down inside the menu.

### C.7 SteamVR window chrome becomes a visionOS window bar

- **Problem:** B.1 (frame controls 1.19°, grab visual 0.14°), B.3 item 4, B.4 item 7.
- **visionOS pattern:** a single grab pill under the window plus a close dot (ref 2, ref 8, ref 12); the resize corner appears on look.
- **Proposal:**
  - **Grab bar:** a thicker glass pill visual (8–10 mm) drawn inside the existing 40 mm hit area. Bright on hover. Counter the dark-mode 0.3 tint by painting brighter.
  - **Frame controls:** individual **glass circles** with white icons. Tooltip capsules show the names.
  - **More Options:** a glass menu.
  - **Hard limit:** these hit areas are SteamVR panel sizes (1.19°). Enlarging them requires changing panel roots, which resizes the VR quad. Only T4 own-ornament panels with proven interactive routing (CQ4) could provide larger targets.
  - Until then, improve visibility only:
    - higher idle opacity than Steam's 0.6. That is Steam's opacity rule, so it must stay, but brighter fills compensate.
    - glassd slabs behind each circle (T5).
- **Verify:** `shot vr:systemui p2_chrome_*` with `steamvr-pre` hover and focus scripts; the panel-size check in `steamvr.md` §7 (sizes identical on and off); `audit vr:systemui`.

### C.8 Page transitions follow the Liquid Glass materialize spec

- **Problem:** B.7 (≈800 ms, a 200 ms dead time, a full-field scale).
- **Proposal:**
  - Shorten to a ~250 ms ease-out (spring approximation), with **no delay**.
  - Smaller travel: scale .98, or none, with opacity only.
  - Keep reduced motion at 1 ms.
  - The theme may change only `transition-duration`, `transition-delay` and `transition-timing-function` on `%{TopLevelTransition}`; never its `transform`/`opacity` end states.
- **Open:** CQ6 (does Steam's transition group rely on `transitionend` or on fixed timeouts? If it uses timeouts of 200/600 ms, shortening CSS alone may cause a pop). Verify by capturing frames during `L.nav`.

### C.9 Toasts become visionOS notification cards

- **Problem:** B.2 (11–12 px), B.4 item 8.
- **Proposal:**
  - Use the whole 340×80 quad (layout inside the toast window only; no nav tree involved): a rounded glass card with a circular 48 px app icon, a 16–18 px title and a 14–15 px body, up to 2 lines.
  - Materialize in and out (replacing Steam's VR opacity 1→1 no-op).
  - Placement is SteamVR's (`ShowCustomNotification`); leave it.
- **Verify:** the static mock recipe in `hud.md` §4.3 hosted in a larger window (a 40 px tooltip host cannot show a 2-line card; CQ9: a lab host for an 80 px mock).

### C.10 One focus and hover language across all quads

- **Problem:** B.4 item 6.
- **Proposal:**
  - Map `.gpfocus` (Steam), `%{GamepadFocused}` and `.gpfocus` (SteamVR) and `%{FocusRing}` to one treatment: glass "illuminate from within" fill + ring (DESIGN §3).
  - Replace the 20× pulsing ring with a static ring.
  - Laser hover = a soft fill (glassd could add the bible's Gaussian hover light at the ray hit only if SteamVR exposes the laser hit point; research item).
- **Tiers:** T1 everywhere; T5 optional.

### C.11 Floating footer hints become legible

- **Proposal:**
  - Restyle `%{FloatingVRFooter}`: replace `brightness(.6)` with full-brightness glyphs on a small glass capsule (inside the clip rect).
  - Mixed-case 16–18 px labels.
  - The quad is non-interactive, so this is a hint only.
- **Verify:** `hud.md` §3.2 recipes.

### C.12 VR Settings stops feeling like another app (cross-area; owner: settings / steamvr)

- **Proposal:**
  - Theme SteamVR's settings page to the visionOS Settings pattern (ref 8: sidebar of rows with circular coloured icons, a white selected pill, grouped rounded rows).
  - Flag the gamepad dead end (W10) to the settings owner. Making SteamVR settings gamepad-navigable is outside CSS (T3-level work in SteamVR's own React, not Steam's).

### Summary ranking

| rank | opportunity | main fix | tiers | blocking question |
|---|---|---|---|---|
| 1 | C.1 system search | size, seam, typing ergonomics | T1 T2 T3 T4 T5 | CQ1, CQ5, CQ8 |
| 2 | C.2 tab-bar ornament | discoverability, where-am-I, size | T1 T2 T3/T4 T5 | CQ3 |
| 3 | C.3 toolbar header | Back size, OS idiom, title | T1 T2 T4 T5 | CQ1 |
| 4 | C.4 action ornament | laser path to Sort/Filter/Options, size | T1 T4 T5 | CQ4 (overlap) |
| 5 | C.5 alerts and sheets | button size, depth, modal scope | T1 T4 T5 | CQ7 |
| 6 | C.6 menus and Power | row size, destructive safety | T1 T4 T5 | (approval for default focus) |
| 7 | C.7 window bar | visibility of move/resize/controls | T1 T5 (T4) | CQ4 |
| 8 | C.8 transitions | LG motion, perceived speed | T1 | CQ6 |
| 9 | C.9 toasts | legibility | T1 | CQ9 |
| 10 | C.10 focus language | consistency | T1 (T5) | — |
| 11 | C.11 floating footer | hint legibility | T1 | — |
| 12 | C.12 VR Settings | app seam (cross-area) | T1 (vr) | owner |

### Capability questions for `docs/phase2/capabilities/`

| id | question |
|---|---|
| CQ1 | Taller header: does `--basicui-header-height` with `!important`, plus a T3 write of `m_flCurrentHeaderHeight`, keep modals, search padding and scroll-into-view correct? |
| CQ3 | Can the `frame.menu` popup be shown without the laser (T3 popup flag), or a T4 crop be shown in its place when the real quad is hidden? Is it visible while it holds gamepad focus? |
| CQ4 | Can a T4 crop be moved off its original x/y with input routed to the real element (needed for ornaments overlapping the window edge and for larger frame controls)? |
| CQ5 | Can Steam's VR keyboard show its text buffer for Steam UI fields without behaviour change, or can a T4 display-only crop echo the field above the keyboard? |
| CQ6 | Do Steam's route transitions finish on `transitionend` or on fixed timers? |
| CQ7 | Can T4 recess the window plane and dim it while a dialog crop stays at its x/y? |
| CQ8 | Can a T3 overlay (the search sheet) join the main nav tree as a first-class gamepad target with B to close? |
| CQ9 | A lab host for 340×80 toast mocks |
| CQ10 | Can a context menu be shown anchored in VR (non-centred presentation) without changing its handlers? |
