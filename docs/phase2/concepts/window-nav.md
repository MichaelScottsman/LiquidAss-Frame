# Concept: window, navigation and search (`window-nav`, the shell)

This concept redesigns the frame of the Steam Frame's VR interface: the parts every screen shares.

- The main window as a visionOS window: glass, no outline, its chrome at its edges.
- The left navigation column as a tab-bar ornament.
- The toolbar row: Back, the page title, search.
- Search as a system feature: a sheet over the page you were on.
- The bottom ornament: one toolbar with a published contract that every area concept uses.
- One window-bar row under the window instead of four strata of chrome.
- Page transitions.
- The system-wide behaviour of menus, popovers, alerts, sheets, toasts and tooltips: depth, dimming, growing out of the source.

It uses `docs/phase2/DESIGN2.md` and its tokens. §12 lists every deviation and its reason. The functions it must keep come from `audit/shell-nav.md` §A and from the rows of the other audits that use these surfaces (§9). §14 answers the critique of revision 1 point by point.

**Revision 3 (Phase 2 build, milestone M0).** This revision brings the text into line with `docs/phase2/PLAN.md` §1, which decides every conflict between concepts. §0 lists each §1 decision that touches this concept and where it landed. Where this text and PLAN §1 still disagree, PLAN §1 wins. The sections other packages build carry the text they sent at their own M0: §4 and the search rows of §9.1 and §13 from C1b, §5.1–§5.4, §9.4, §9.5, §9.7 and their §13 rows from C1c, and §3.5.3, §5.5, §5.6 and AT-18 from C3a (their requests in `docs/phase2/wp/<package>.md`).

**Who builds what** (PLAN §1.1, §2.4). The concept file is owned by package **C1a**; the other packages build from it and send text changes to C1a as requests (`docs/phase2/wp/<package>.md`).

| Package | Sections it builds | Its mockups |
|---|---|---|
| C1a Shell chrome | §3 (window, route glass modes, toolbar row, tab bar, bottom ornament, window-bar row, More circle, frozen target, pointer proxy), §6, §8.1–§8.2 for the chrome, §9.1 H1 and H5–H7, §9.2, §9.3, §9.8 | `anatomy`, `anatomy-t1`, `anatomy-depth`, `tabbar`, `tabbar-r863`, `ornament`, `chrome`; `window-nav-shared.css` and `.js` |
| C1b Search | §4, §9.1 H2–H4 and S rows | `search`, `results` |
| C1c System presentations | §5.1–§5.4, the route transitions of §7, §9.4, §9.5, §9.7 | `menu`, `sort`, `power`, `alert`, `sheet`, `motion` |
| C3a Bar, HUD, toasts | §5.5, the look of §5.6 and §3.5.3, §9.6 | `toast` |
| P3, P4 | The illumination model and its values (§6.3, PLAN §1.4) | — |
| V1 | The native gate (§8.3, PLAN §4.3) | — |

**Mockups** (true size, 1920 × 1080 headset view, built with `mockups/kit.css`; shared chrome in `mockups/window-nav-shared.css` and `window-nav-shared.js`, owned by C1a):

| Shot | Source | Owner | Shows |
|---|---|---|---|
| `shots/p2_window-nav_anatomy.png` | `mockups/window-nav-anatomy.html` | C1a | The window at rest on a library route, laser mode: the device's 10-item tab bar (58 px pitch, Library as the .18 selection circle), the toolbar row, the More circle inside the dwelled card, the ornament in the library's five fixed slots (880 px: Sort and Filter folded in, the Options member, quiet Select and Back, no glyph badges), the window-bar row, the dashboard bar, the pointer proxy (native mode) |
| `shots/p2_window-nav_anatomy_depth.png` | `window-nav-anatomy-depth.html` | C1a | The same with depth (mm) and tier labels |
| `shots/p2_window-nav_anatomy_t1.png` | `window-nav-anatomy-t1.html` | C1a | Degraded glass: what ships while native mode is off (no pointer proxy) |
| `shots/p2_window-nav_tabbar.png` | `window-nav-tabbar.html` | C1a | Gamepad focus in the expanded tab bar: the focus pill on Store, the current route (Downloads) as a .18 circle with its arc, laser hover as a light spot only; a state key with the four states over the same room (G-FOCUS, §13.1) |
| `shots/p2_window-nav_tabbar_r863.png` | `window-nav-tabbar-r863.html` | C1a | The user's window size r = 0.863, worst case: live pitch 52 popup px, bar = panel height; gamepad mode with the focused card and its More circle, the library's fixed-slot ornament with glyph badges |
| `shots/p2_window-nav_ornament.png` | `window-nav-ornament.html` | C1a | The ornament contract in five true-size strips: gamepad mode in the library's fixed slots; laser mode and the frozen target (the More circle stays on the dwelled card); a route without fixed slots (Downloads: the Options member names its target, the row's More circle); the quiet legend on a `window` route on its dim band, beside the bare look over the curtain; the quiet legend inside the glass on `window-full` |
| `shots/p2_window-nav_chrome.png` | `window-nav-chrome.html` | C1a | The window-bar row: quiet frame controls, the hovered one with its thick-glass tooltip below, More Options open (the More circle white, focus on its first row), Close on game frames, the resize arc |
| `shots/p2_window-nav_search.png` | `window-nav-search.html` | C1b | Search activated: a sheet over the dimmed Library (real art), zero state with Recent Games and Recent Searches, keyboard with echo row; laser mode, quiet legend |
| `shots/p2_window-nav_results.png` | `window-nav-results.html` | C1b | Results for "half" in the 960 px sheet: the scope bar with Steam's counts, the focused Top Hit (gamepad mode), Steam's next library matches, the Software cell and Steam's store results under Steam's section headers |
| `shots/p2_window-nav_menu.png` | `window-nav-menu.html` | C1c | Laser mode: Steam's 6-action tile menu (developer mode adds Developer ›) in the compact layout, 400 × 502, grown 16 px right of its card out of the white More circle; the row under the pointer lit + .08 with the light spot; the card at 0 mm with a soft glow; Cancel a 56 px quiet capsule; the quiet legend |
| `shots/p2_window-nav_sort.png` | `window-nav-sort.html` | C1c | Laser mode: Sort By (10 options) as a two-column menu, 592 × 508, grown up out of the white Sort button; the current sort's check in the leading slot; the hovered row + .08; A and B as quiet members without glyphs |
| `shots/p2_window-nav_power.png` | `window-nav-power.html` | C1c | Gamepad mode: the Power menu, 592 × 470, two groups, grown from the white Power tab; Steam's default focus (Restart Steam VR) as a red whole fill with a dark label |
| `shots/p2_window-nav_alert.png` | `window-nav-alert.html` | C1c | Gamepad mode: a 640 px alert centred on the glass at +10 mm over Steam's scrim (.35, clipped to the glass); the primary focused (outer glow); inset: the destructive variant, flat, with a red confirm and a dark label |
| `shots/p2_window-nav_sheet.png` | `window-nav-sheet.html` | C1c | Gamepad mode: a 960 × 472 sheet (the library Filters dialog) centred on the glass at +10 mm, with its close circle; a chip with gamepad focus |
| `shots/p2_window-nav_motion.png` | `window-nav-motion.html` | C1c | Motion storyboard at f = 0, .15, .35, .5, .75, 1: menu morph-open, alert present, sheet present, sheet dismiss, route change |
| `shots/p2_window-nav_toast.png` | `window-nav-toast.html` | C3a | A toast card and variants, the floating hint, the toolbar on a hero route |

Measurement helper for the acceptance tests: `docs/phase2/concepts/window-nav-measure.py` (`edge`, `dl`, `focus`, `ring`).

**Units.** Sizes are main-window CSS px unless marked. 1 pt = 4/3 px (DESIGN2 §2.1). At r = 1 one main px is 0.766 mm (0.0307° at 1.43 m, 0.038° at the 1.15 m summon distance). Popup px (frame menu, toasts, floating footer) are 0.847 mm. SteamVR systemui px (frame controls, their tooltips, More Options) are 0.581 mm. Grab-handle px are 0.300 mm. Depths are in mm; scene units = mm / (369 × r) (DESIGN2 §2.6). This device runs at **r = 0.863** today (spatial.md §1.1), with **developer mode on**, so the frame menu has Console and the tile menu has Developer ›.

---

## 0. Conformance with PLAN §1 (revision 3)

Every PLAN §1 decision that touches this concept, and where the text now carries it.

| PLAN | Decision | What changed here | Where |
|---|---|---|---|
| §1.1 | Owners of shared elements | Package table above; owners in §9 and §13 | Intro, §9, §13 |
| §1.2 | Route glass modes `window` / `window-full` / `windowless` / `hero`, set by C1a's T2 as `data-lgs-glass` on `%{BasicUiRoot}`; the route decides, never focus | New §3.1.1 with the route map. The glass no longer follows `:has(#Footer)` | §3.1 |
| §1.3 | One control vocabulary | Back 60 / 80 at (24, 24); search 520 / 640 / circle; tab-bar live pitch 52–66; ornament 84, members 60; More circle 60 / 80; glyph badge 30 with a 16 px Bold letter | §3.2–§3.4 |
| §1.4 | Two input signals from P3 (`html.lgs-input-pad` / `-laser` for state looks, `data-lgs-vr-mode` for Steam's mode-only nodes and glyph badges); one accessor `__LGS_RT.input`; hover never moves Steam's focus; laser looks on `:hover`, lift after 80 ms dwell; one attention state machine; focus add white .28; navigation selection .18 + arc + Semibold; navigation hover = light spot only | WN's `html.lgs-gp` / `html.lgs-laser` withdrawn. The frozen target and the More circle are fed by P3's attention. Tab-bar states re-specified. Glyph badges in gamepad mode only | §3.3.4, §3.4, §6.3 |
| §1.5 | One motion system (MO tokens from P5); Steam's entrance animations overridden (S3); at rest nothing runs | Q2 closed; every duration in §7 is a token | §7 |
| §1.6 | Five materials, four mechanisms (cover, plate, slab, hole); E3 lobe; no outline anywhere; glass L 55–110 | Material table aligned; the More circle rides its host | §8 |
| §1.7 | One depth plan, two profiles; admission rules; {0, +10, +15, +25} mm; menus and sheets +10; destructive alerts 0; source card keeps +15 or 0 (WN's +5 withdrawn); tab bar +25 through the popup's own transform | Depth plan replaced | §3.7, §5 |
| §1.8 | Alerts and sheets dim with Steam's overlay at black .35 in both modes; `t1` is not used for in-window modals | WN's `t1` tint .65 withdrawn | §3.3.4, §3.7, §5.3 |
| §1.9 | Header 108 when CQ1 holds, else the three-rule fallback; C1a sets `html.lgs-hdr-108` or `html.lgs-hdr-40`; three field variants; search is WN §4; HA contributes through C1b's provider API | §3.2, §4 updated | §3.2, §4 |
| §1.10 | Legends never hidden; capsule vs quiet legend by content; A and B always present; Sort/Filter in slot 1 in laser mode; library five slots (880); compact members instead of dropping; depth 0 | Q13 withdrawn (A and B stay in laser mode as quiet members); SET's E-ORN and SM's 1232 px limit withdrawn; fixed slots registered through `shell.ornamentSlots` (the library's 880); on `window` routes the quiet legend sits on a dim band (P-39; O3, flag `quietBacking`) | §3.4 |
| §1.11 | One More helper (60 / 80, inside its host, the host's own `onMenuButton`, one node per document); frozen target unchanged; pointer proxy in native mode only | §3.4.4 rewritten (no blur inside another glass container); the name suffix omitted on fixed-slot routes, where the More circle marks the target; §3.6 scoped to native mode | §3.4.3, §3.4.4, §3.6 |
| §1.12 | Menus: layout by count; value menus (list page on settings routes, grid for 9–14, a scrolling column for ≥ 15); anchoring gated; GP's placement order; destructive rule by count; Power per WN §5.2 + CC §5; alerts 640, sheets ≤ 960 | §5 aligned (C1c builds it) | §5 |
| §1.13 | Tooltips (P3): thick capsule 48 px, 0.8 s in / 0.2 s out; Steam's sounds through its bus; haptics off | §5.6; icon-only shell controls get tooltips | §3.2, §3.4.4, §5.6 |
| §1.15 | Strings from Steam's localization; English only when the UI language starts with `en` | New strings listed | §3.8 |
| §1.16 | Exemptions E-BACK, E-MENU, E-MINI, E-TAB | AT-4 lists only these | §13 |
| §1.17 | Sign-off register | §11 now records each decision, its default and its flag | §11 |
| §1.18 | DESIGN2 amendments A1, A3, A5, A6, A8 adopt WN deviations | §12 marks which deviations are now DESIGN2 and which remain | §12 |
| §4.3 | The native gate belongs to V1 (AT-0a to AT-0f) | §8.3 points there; C1a keeps AT-0b (pointer proxy) | §8.3, §13 |

---

## 1. The experience

You raise the controller and the dashboard opens. One frosted glass window floats in the room. You see the room through it, blurred and darkened. Its edge is light along the upper-left curve, fading away along the top and down the sides; no line is drawn around it.

**Where you are is always visible.** Beside the window's leading edge hang two slim glass capsules of circles. The first holds the six sections: Home, Library, Store, Friends, Media, Downloads. The second holds the system: Console, Steam Settings, VR Settings and, after a small space, Power. The current section sits on a soft circle, and the window's top-left corner names it in a large bold title: "Library". Ten destinations are more than a visionOS tab bar holds, so the bar runs the full height of the window and its system capsule ends level with the toolbar at the bottom: the two ornaments frame the window like one piece of chrome.

**The window's chrome lives at its edges.** The toolbar row has a circular back chevron in the corner, the large title, and a dark recessed search capsule in the middle, 64 px tall. Content scrolls under a soft darkening at the top edge; there is no header band.

**One toolbar hangs over the bottom edge**, half on the glass and half in the room. It holds the page's actions as real buttons: "Alphabetical" (the current sort), "Filter", and "Options · Hollow Peaks". Select and Back always sit at its end, quieter. While you hold the gamepad, the controller glyph sits after each label as a small hint, the way a menu shows a keyboard shortcut; with the laser the hints go away and the labels stay. When a page offers nothing but Select and Back, the capsule's glass dissolves and only the two quiet labels remain.

**What you point at, you act on.** Rest the laser on a game and a small "⋯" circle appears inside its top corner: its menu, right there. If you reach for the toolbar instead, it remembers the game you looked at and names it on the Options button, so moving the pointer down across other posters never changes the target.

**Under the window there is one row**, and only while you point at the dashboard: a capsule of window controls (keyboard, float in world, theatre, more) beside the visionOS window bar. Below it floats the dashboard bar. Today there are four rows here.

**Searching opens a sheet over the page you were on.** Point at the capsule, or press Up from the top row. The capsule takes the system's only focus ring, the keyboard rises under the window, and a glass sheet grows down out of the field. Behind it the Library stays where it was, dimmed. Before you type, the sheet offers your recent games as circles and your recent searches as capsules. As you type it becomes results: one scope bar for Steam's categories with Steam's counts, a Top Hit card, your matching games, Steam's first Store results, and a section for every other category with matches. Press B, the back circle or the dimmed page, and the sheet is gone; you are where you were, on the poster you left.

**Menus grow out of what you pressed.** A game's menu grows out of its card and settles just in front of the window; the card keeps its lift if it was the one in focus. Sort By grows up out of the white Sort button as two columns, because ten options in one column would scroll. The Power menu grows from the white Power tab: "This Device" and "Steam" side by side.

**Dialogs come forward and the window darkens.** A confirmation is a 640 px glass card with a bold title and two capsules, a centimetre in front of the window, which darkens under a light scrim. A confirmation that would destroy something stays in the window's plane. Larger dialogs are sheets with a close circle.

**Nothing slides in from the edge of your view.** Notifications appear in place as small glass cards with a round icon. Pages cross-fade with 16 px of parallax. The persistent chrome never moves, and nothing moves at rest.

**Both input models work everywhere** (§9). Gamepad focus is light: a lit pill that lifts into glass, never a ring. It never looks like the current section's soft circle, so you always know which is which.

---

## 2. Is today's UI right for VR? Verdict per surface

| Surface | Today (audit) | Verdict | Redesign |
|---|---|---|---|
| Window | Opaque dark gradient, 6 px corners, a uniform rim in Phase 1 | Wrong material and shape | visionOS glass, radius 54, edge from light (§3.1, §8) |
| Header band | 40 px strip "← Back \| 🔍 Search…", targets 1.23° | Wrong idiom, half the target size | Toolbar row of 108 px: Back circle, Large Title, search capsule (§3.2) |
| Search | 40 px strip, light-grey web field on its own route; no echo; empty query lists the library; entering it loses the page | The user's named example | A sheet over the page you were on, opened on the field's real activation; zero state; results with every category; scope bar; no-results view that echoes the query; echo on the keyboard (§4) |
| VR main menu | Already a tab bar beside the window, but laser-only, square rows, blue dot only in the hidden menu; 10 items here (Console on) | Right structure; wrong visibility, shape, size and selection | Always-visible ornament, two capsules, live pitch from the real window size, circle = current route, pill = focus (§3.3) |
| Footer legend | 12 px uppercase legend; the laser's only path to Filter, Sort, Options; acts on whatever focus the laser crossed last | Wrong idiom and size; an accuracy trap | One toolbar with a contract: real buttons, gamepad / laser modes, Steam's laser-mode Sort and Filter folded in, a frozen named target, a More circle on cards (§3.4) |
| Chrome under the window | Four rows: frame controls, floating footer, dashboard bar, grab line | A seam (references.md: "don't stack several rows") | One window-bar row (frame controls + window bar), laser-visible; at rest only the ornament and the bar (§3.5) |
| Floating footer | 12 px uppercase at 60 % brightness | Hints in the dimmest text | Full-brightness hint capsule, only when the dashboard has no focus (§3.5.3) |
| Context menus | Centred list, 48 px rows; destructive rows look normal | Disconnected from the source | Glass slab grown from its source; layout chosen by item count so nothing scrolls (§5.1) |
| Power menu | One column; device and account mixed; may open on a destructive item | Confusing grouping | Two groups side by side, 592 px; default focus left to Steam (§5.2) |
| Modals | Square card, 2 px border, .85 scrim | Wrong material | Alert and sheet cards in thick glass, 60 px capsules, .35 scrim (§5.3–5.4) |
| Toasts | 300 × 40 card, 11 px text, outline | Illegible | 320 × 76 glass card, 48 px icon circle, materializes in place (§5.5) |
| Page transitions | 200 ms dead time + 600 ms scale "breath" | Reads as a web page loading | 150 ms out, 662 ms in with 16 px parallax (§7) |
| Frame controls | 67 × 51 grey squares, 1.19° | Too small, another vocabulary | Glass circles, 107 systemui px hit (2.49°) (§3.5) |
| Grab bar | 12 px dark line under the dashboard bar | Invisible, in the wrong place | The visionOS window bar, white .46, directly under the window (§3.5) |

---

## 3. The window and its chrome

### 3.1 The window

| Property | Value | Notes |
|---|---|---|
| Overlay | 1280 × 720 px = 960 × 540 pt = 0.98 × 0.55 m at r = 1 (0.85 × 0.48 m at r = 0.863) | Fixed by Steam |
| Glass | Set by the route's **glass mode** (§3.1.1): 1280 × 656 with a 64 px transparent ornament margin below (`window`), 1280 × 720 (`window-full`), none (`windowless`), or art-filled (`hero`) | DESIGN2 A1 (was WN D-1) |
| Corner radius | 54 px (40 pt) | A 60 px circle inset 24 px is concentric |
| Outline | None. Edge = tone step + a specular lobe from the key light (above, 20° left) + darkened inner edge + depth shadow (§8.2) | The top highlight must pass AT-23 (edge ratio ≤ 0.35) |
| Material | T5 glassd `window` cover when native mode is on (the gate is V1's, PLAN §4.3); otherwise the degraded spec (§8.4) | Tone: glass L 55–110, 70–90 under text (PLAN §1.6) |
| Background clearing | Shell clears `%{BasicHome}%{OpaqueBackground}`; area owners clear their page roots (LAB) | |
| Clip | `%{BasicUiRoot}` keeps `overflow:hidden`; its `border-radius` 6 → 54 px | Paint-only |
| Optional larger window | Frame height override 1.5 → 1.6 (× 1.067) (spatial.md §7 E5b [PROVEN]) | Off (PLAN S8, flag `frameHeight`); the mockups do not use it |

**How the glass stops at 656.** C1a's T2 writes the route's mode as `data-lgs-glass` on `%{BasicUiRoot}`. CSS draws the window tint on a pseudo-element of `#GamepadUI_VR_Full_Root` whose height follows the mode: 656 for `window`, 720 for `window-full`, none for `windowless`. In T5 the reporter (P6) reads the same attribute and reports the same rect (1280 × 656 or 720, radius 54) as the cover shape. The ornament is Steam's DOM in the margin, so its input stays native. Revision 2 keyed the height on `:has(#Footer)`; that is withdrawn, because Steam's footer can come and go with focus and the glass must never change size under the user (PLAN §1.2).

#### 3.1.1 Route glass modes (PLAN §1.2)

| Mode | Glass | Native (T5) | CSS-only (T1) |
|---|---|---|---|
| `window` | 1280 × 656, radius 54, a 64 px ornament margin below | `window` cover with that shape | Smoky tint `rgb(20 22 30 / .74)` (dial .60–.84) + edge cues (§8.4) |
| `window-full` | 1280 × 720 | `window` cover, full overlay | As above |
| `windowless` | None. Every glass element is a **plate** (PLAN §1.6) | Plates (P9 G1), reported by P6 from `data-lgs-plate` | CSS plates: black .58 with a white .16 → .04 gradient + edge cues; CC-M tiles at .94 (CC §4.2) |
| `hero` | The art fills the window | `window` cover, hidden under the opaque art | The same |

**The route map** (C1a's T2 sets `data-lgs-glass` and a route key `data-lgs-route` on `%{BasicUiRoot}` on every route change, never on focus):

| Route | `data-lgs-route` | Mode | Notes |
|---|---|---|---|
| `/library/home` | `home` | `windowless` while C2a's Home override runs; otherwise `window-full` | C2a's hook `shell.glassMode('home', () => live ? 'windowless' : null)` decides; with `null` or no hook, Steam's own Home shows in a `window-full` window (it hides its footer), so it never floats over the room without glass |
| `/library/lgs/folder/*` | `folder` | `windowless` | C2a |
| `/library/lgs/steamhome` (What's New) | `steamhome` | `window-full` | C2a |
| `/library/tab/*`, `/library/collection/*` | `library` | `window` | C2c |
| `/search`, `/search/tab/*` | `search` | `window` | C1b. Back in the nested style; **no Large Title** (C1b's snapshot carries a clone of the previous page's title under the scrim); the field in its 640 px variant |
| `/library/downloads` | `downloads` | `window` | C7 |
| `/media/grid` (Photos), `/media/item/*` (viewer, clip player) | `media` | `window` | C7. The viewer and the clip player fit the media to the 656 glass and raise its tint (SM §3.7, §3.8) |
| `/chat` | `chat` | `window` | C7 |
| `/account` | `account` | `window-full` | C7 (quiet legend inside the glass) |
| `/invites` | `invites` | `windowless` | C7 (the card is a plate) |
| `/library/app/:appid`, title view | `app` | `hero` | C5a tells the shell which view is showing (title or details) through `__LGS_RT.shell.glassMode('app', fn)`; the hook is evaluated on route change and on C5a's own view change, never on focus |
| `/library/app/:appid`, details states; Properties; achievements | `app`, `properties`, `achievements` | `window` | C5a. SM §3.0 drew achievements at 720 with a quiet legend; PLAN §1.2's table puts it in `window`, which this map follows |
| The Steam Input page (`/app/:appid/controllerconfigurator`) | `controller` | `window-full` | C5a (look) |
| `/settings/*` | `settings` | `window` on every page | C6a. The ornament comes and goes inside the margin (SET §3.2) |
| `/zoo/*` | `zoo` | `window` | C4a |
| Control Center (CC-M) open | (unchanged) | `windowless` while open | C3b registers `shell.glassMode('*', () => open ? 'windowless' : null)` and calls `shell.refreshGlass()` on open and close |
| Any other route | `other` | `window` if Steam's `#Footer` holds legends 300 ms after the route settles, else `window-full`; fixed until the route changes | Covers `/controller/calibration/*`, web views and new Steam routes |

**Area hooks.** `__LGS_RT.shell.glassMode(routeKey, fn)` → `{remove()}` lets an area decide its route's mode: `fn()` returns a mode or `null`, and `null` (or a throwing hook, or none) gives the map's fallback for that route. The key `'*'` applies on every route and wins when it answers (Control Center). The shell calls it on route change and when the area calls `shell.refreshGlass()` after its own view change (C5a's title ↔ details, C3b's Control Center), never on focus.

**Without the runtime** (T1 only, fallback ladder step 3) there is no attribute, and the CSS default is `window` on every route. Home then falls back to Steam's own page in that window.

### 3.2 The toolbar row (Steam's `#header`)

The row is 108 px tall (24 + 60 + 24 = 81 pt, 83 mm at r = 1). There is no band. Steam's header `::before` becomes the scroll-edge effect: a 124 px band of black .30 → 0 with a 12 px blur, masked to fade out, its opacity still bound to Steam's `--gamepadui-header-background-opacity`.

| Element | Steam node | Visible | Hit region | Position | States |
|---|---|---|---|---|---|
| Back | `%{BackContainer}` (laser; B is the gamepad path) | 60 px circle with a 28 px chevron | 80 × 80 box | Box at (14, 14), circle at (24, 24) on every route (VP P-60) | Section roots: borderless, chevron white .70. Nested pages: white .10. Over art and media: clear (black .32 + 10 px blur). Laser hover + .08 and the light spot; after 0.6 s of hover (attention, PLAN §1.4) or gamepad focus it grows into a capsule naming the page Steam's `NavigateBack` returns to: the previous history entry's title from the route map (T2); without a title it does not grow. Steam's main history is a browser history with no entries list, so the shell keeps its own stack of the paths it has seen; Steam's D-pad never focuses Back (B is its gamepad path), so in practice the reveal is the laser's. While it shows, the Large Title fades out. Steam's "Back" text is visually replaced by the chevron; T2 sets `aria-label` to the stock text (exemption **E-BACK**, PLAN §1.16 and S4) |
| Large Title | T2 decorative node `#header > .lgs-title` (`aria-hidden`; a stable selector, so C1b's snapshot can clone it), text from the route map | Large Title 46 px Bold, white .96 | none | x 100, centred on the row | Section roots only, never on the search route; area concepts may supply their own text (`data-lgs-title` on their page root). The text is Steam's own localized section name (§3.8) |
| Search, capsule | `%{SearchAndTitleContainer}`, `%{SearchFieldBackground}`, `%{SearchBox}` | 520 × 64 capsule on section roots (Library, Photos, Downloads); 640 × 64 on nested routes and the search route | 536 × 80 (656 × 80) | Centred at x 640, y 54 | Recessed: black .30 + `inset 0 2px 5px`. Magnifier 26 px; placeholder Steam's string, upright 24 px white .55. The grey `%{WhiteBackground}` field is gone. Focus: the system's only ring (3 px white .55 + 16 px glow, VP P-17). No microphone anywhere (Steam has no dictation; WN D-8 = DESIGN2 A1) |
| Search, circle | The same container, collapsed | 60 px magnifier circle; thin fill white .10 (clear over art and media) | 80 × 80 box | Box at (1186, 14), circle at (1196, 24), unless a route below says otherwise | Home, folders, hero routes, Steam Settings, the photo viewer and clip player, `/account`, achievements; `/chat` (box at (362, 14), in the sidebar's row); `/invites` (the card's top corner). Tooltip: Steam's placeholder string after 0.8 s (PLAN §1.13). Gated by AT-4 (no SHRUNK); the fallback is the capsule |
| Clear (×) | `input::-webkit-search-cancel-button` | 44 px circle, white .16 | 80 × 80 clear region (E-MINI) | 10 px inset | When text is present |
| Title mode | `%{SearchAndTitleContainer}%{ShowingTitle} > div` | Title 2, 30 px Bold, centred | — | y 36 | Replaces search, as Steam does (H5) |
| Browser mode | `%{HeaderBrowser}` | 640 × 64 recessed capsule, URL 22 px white .70 | 656 × 80 | Centred | Not seen live: verify on the first Store web view |
| Account alert | `#header_profile` | 60 px circle with Steam's avatar and a red badge | 80 × 80 | Top-right, 24 px inset | Only with active support alerts (H7) |

**Route-scoped positions** (SM §3.0, PLAN §1.1). On `/chat` the Back circle and the search circle sit in the sidebar's toolbar row (search box at (362, 14)); on `/invites` they sit in the card's top corners. These are position-only T1 rules keyed on `data-lgs-route`, written by C7 in its own file; Steam's handlers and D-pad Up (Main's `onMoveUp`) are unchanged.

**Windowless routes** (Home, folders, `/invites`, Control Center; PLAN §1.2): there is no window cover, so the Back circle and the search circle are glass of their own. T2 tags them as plates, `data-lgs-plate="liquid"` with the stable ids `data-lgs-plate-id="shell-back"` and `"shell-search"` (P6 reporter §2.2); in CSS-only mode they take the CSS plate look (black .58 with a white .16 → .04 gradient + edge cues, PLAN §1.2). The areas never tag Steam's toolbar nodes themselves.

**Hero routes** (game pages, title view, `data-lgs-glass="hero"`): the row floats over the art. Back becomes a clear glass circle (black .32 + 10 px blur); search collapses to the circle variant. Shot: `p2_window-nav_toast.png`.

**Header height (CQ1).** `--basicui-header-height: 108px !important` on `%{BasicUiRoot}` plus `HeaderStore.m_flCurrentHeaderHeight = 108` (T3, in memory, restored on `lgs off`). The runtime tries it only with the flag `hdr108`: it writes both, reads back the variable, the store and Steam's own `#header` box, and sets **`html.lgs-hdr-108`** if all are 108, or reverts both writes and sets **`html.lgs-hdr-40`** (PLAN §1.9). **Settled by AT-2 on build 11094443 (C1a session 4): it does not hold.** The variable and the store both read 108, but `#header` stays 40 and Steam lays every page out from y 40 (its CSS-module constant `HeaderHeightVisible`), so the fallback below is what ships; `hdr108` stays off and only re-runs the trial on a later Steam build. Areas key only on these classes. With the runtime off neither class is present, which means the fallback. **The fallback** (under `html:not(.lgs-hdr-108)`) is three rules that keep everything clear of the toolbar row:

1. The header stays 40 px in layout; the toolbar controls overflow downwards into a 68 px band (the header is `pointer-events: none` except its children, inventory shell §3).
2. Every page root adds `padding-top: var(--lgs-hdr-pad)` (68 px in the fallback, 0 with `lgs-hdr-108`; each area pads its own page roots), and the scroll guard below keeps gamepad scroll-into-view clear of the row.
3. **Modals:** `%{GamepadDialogOverlay} .ModalPosition` and the context-menu modal container get `padding-top: 68px`, so the modal box starts at 108, exactly as with CQ1 (revision 1 left modal tops under the toolbar). AT-2 measures the modal top in both cases.

**Scroll guard** (VP P-23, IM §7: `scroll-padding` works on Steam's scrollers [PROVEN]). Focused items stay between y 124 (the row + 16) and y 612 (the ornament's top at 628 − 16) on routes with an ornament, or the glass bottom − 16 without one. The shell sets `scroll-padding-top` and `scroll-padding-bottom` on Steam's generic `%{ScrollPanel}` from two variables, `--lgs-guard-top: 124px` and `--lgs-guard-bottom: 612px` (window y); areas apply the same variables to their own scrollers, with `!important` where Steam writes scroll padding inline.

### 3.3 The tab-bar ornament (Steam's VR main menu, `frame.menu.<id>`)

Steam's frame menu is already a separate popup beside the window's leading edge, collapsed to icons and expanding on hover: structurally the visionOS tab bar (shell-nav C.2). This design keeps every item, route and handler and changes visibility, grouping, size, placement and states.

#### 3.3.1 Items and grouping on this device

Steam's items in DOM order (inventory bar.md §3, audit shell-nav A.3): Home, Library, Store, Friends & Chat, Media, Downloads, **Console** (developer mode), Steam Settings, [Help, setup only], VR Settings, Steam's `%{SectionGap}`, Power. **This device has 10** (11 during setup).

| Capsule | Items | Why |
|---|---|---|
| Sections | Home, Library, Store, Friends & Chat, Media, Downloads | The six places, as a visionOS tab bar |
| System | Console, Steam Settings, [Help], VR Settings, then Steam's SectionGap (10 popup px) and Power | System destinations; one capsule instead of two (one gap fewer) |

Capsules are 10 popup px apart. Inside a capsule: padding 6 top and bottom, 12 at the sides; rows are contiguous (each item's hit box is its full row). Built only from Steam's component variables (`--menu-item-height`, `--menu-item-padding`, `--menu-icon-size`, `--menu-font-size`) and `%{DashboardMenu>ItemOuter}` backgrounds; no width of our own (Steam animates it). One value is replaced: Steam's collapsed column is a fixed 54 px (`%{DashboardMenu>Collapsed}`), narrower than the circle at a live pitch above 50, so the collapsed width is `d + 24` (the 12 px sides; 82 at p 66) and the capsule ends' radius `d/2 + 12`; Steam's 300 ms width transition and its expanded width stay. Steam zooms the focused item 1.1×, so the focus pill is inset 24 px at the sides and its zoomed ends stay 12 px inside the capsule. The system capsule starts at the seventh `ItemOuter` with `margin-top: 10px`; `%{SectionGap}` becomes 10 px.

#### 3.3.2 Size from the real window (live sizing rule)

Revision 1 assumed r = 1 and nine items. On this device the bar would have been about 160 mm taller than the visible glass. The pitch is therefore computed live.

**Inputs** (the shell daemon reads them in `vr:systemui` at `lgs on` and whenever `latestMeasuredPanelWorldHeight` changes; polled 1/s, read-only):

- `Hm`: the main panel's world height (`FrameStore.frames[i].activePage.size.latestMeasuredPanelWorldHeight`): 553 mm at r = 1, 478 mm today.
- `mp`: the frame menu's millimetres per popup px: its panel's world height (`GetTransformForOverlayCoordinates` on the `frame.menu` overlay's corners, the method NATIVE.md used for the window) divided by its clip-rect CSS height. 0.847 mm if the popup does not follow the user resize; 0.847 × r if it does (Steam's pooled popups carry `frame-resize-scale-factor: 1`, NATIVE.md fact 2). AT-7 records which.
- `n`: the number of `%{DashboardMenu>Item}` nodes.

**Derived:** glass height `G = 656 × Hm / 720 / mp` and panel height `P = Hm / mp`, both in popup px. Bar height `H(p) = n × p + 44` (padding 24, capsule gap 10, section gap 10).

**Rule** (the daemon writes the result as `--lgs-tab-pitch` and `--lgs-tab-place` on the frame-menu document's root; T2):

1. If `H(60) ≤ G − 24`: take the largest p in {66, 64, 62, 60} with `H(p) ≤ G − 24` and centre the bar on the **glass**: a transparent `padding-bottom` of `64 × (Hm/720) / mp` popup px on the content moves the visible capsules up by half of it (Steam's anchor centres the clip rect on the panel; the clip rect includes padding).
2. Else take the largest even p in [52, 66] with `H(p) ≤ P − 12` and centre the bar on the **panel** (Steam's own anchor): the system capsule then ends level with the bottom ornament.
3. Else p = 52, centred on the panel; it overhangs by `(H − P) / 2` at each end (only with Help during setup at small r).

The visible circle is `d = p − 8`; glyph `0.52 d`.

| Case | G, P (popup px) | Result | Physical |
|---|---|---|---|
| This device at r = 1, Console on (n = 10) | 593, 653 | Rule 2: **p 58**, d 50, H 624 popup px = 690 main px, y 15–705 | Pitch 49 mm: 2.0° at 1.43 m, 2.4° at 1.15 m |
| r = 0.863 today, popup not following the resize (worst case) | 514, 564 | Rule 2 at the floor: **p 52**, d 44, H 564 = the panel | Pitch 44 mm: 2.2° at 1.15 m |
| r = 0.863, popup following the resize | 593, 653 | As r = 1, everything × r | Pitch 42 mm |
| Developer mode off (n = 9), r = 1 | 593, 653 | Rule 2: p 66, H 638 | 56 mm |

The floor (52) is below DESIGN2's 72 main-px fixed-quad floor (§12 D-2, now DESIGN2 amendment A8, with the audit exemption **E-TAB**: pitch ≥ 52 frame-menu px at the live window size, PLAN §1.16). Ten destinations at ≥ 60 popup px need 644 popup px; the panel offers 641 at r = 1. The alternative is a bar that overhangs the window. Rows are contiguous, so the hit boxes abut along the bar (VP P-07).

Shots: `p2_window-nav_anatomy.png` (r = 1, p 58), `p2_window-nav_tabbar_r863.png` (r = 0.863 worst case, p 52).

#### 3.3.3 Placement

Steam's anchor: `origin_on_popup {x:1}`, `offset.x_pixels −6` on the window's left edge, 1.4 cm outside and 1 cm nearer (shell-nav §0.3). Unchanged. The bar is centred on the panel (rule 2) or on the glass (rule 1). Expanded, it is 272 popup px wide and grows outward into the room (Steam right-aligns the content against the window), so it never covers the window (§12 D-6).

#### 3.3.4 States: selection is a circle, focus is a pill

Revision 1 drew focus and selection as two fills of nearly the same brightness (ΔL 2.5). They now differ in shape and in light. The values are PLAN §1.4's (P4 owns the tokens and sets the final focus add once, between .28 and .32, from the G-FOCUS measurement). Looks are keyed on P3's input classes on the frame-menu document: laser looks on `:hover` under `html.lgs-input-laser`, gamepad looks on `.gpfocus` under `html.lgs-input-pad` (VP P-01, P-02).

| State | Look |
|---|---|
| Rest | Glyph white .70, no fill. Label (expanded) 22 px Medium white .96 |
| **Current route** (`%{DashboardMenu>Active}`) | The navigation selection (PLAN §1.4) drawn as a **circle** (d) behind the glyph: white .18 with its specular top arc; glyph white with a heavier stroke (`stroke-width` +0.7 where Steam's SVG strokes; `fill` where it fills); label Semibold when expanded. No label pill even when expanded, so it never shares a shape with focus. Steam's blue `%{DashboardMenu>ActiveDot}` becomes transparent. Steam's own `scale(1.1)` stays (Steam-owned transform) |
| Laser hover | **The light spot only** (.12 at the pointer, drawn under the glyph), no fill added (navigation rows, PLAN §1.4) |
| **Gamepad focus** (`.gpfocus`, keyframe-held, so `!important`) | A **pill across icon and label** (the bar always expands while it holds gamepad focus) at + white **.28** (P4's token; on the tab bar's glass G-FOCUS needs .32, the top of the range, §13.1, so the mockups use .32 until P4 tunes it), a light spot .16 in the upper third, and the pill's own specular arc ×1.5; label Semibold. The first frame shows ≥ 60 % of the final contrast |
| Focus on the current route | The pill, with the circle inside it |
| Menu open (Power) | White .94 circle, dark glyph (the source of an open menu is white). T2 sets the class from `SteamUIStore.OpenPowerMenu` |
| Badge | Steam's yellow "!" on Steam Settings stays |
| During a modal | The capsules darken with a black .35 layer drawn by a T2 class on the frame-menu document; still clickable. No `t1` or popup tint node (PLAN §1.8) |

**Criteria** (gate G-FOCUS, PLAN §1.4; PLAN-1a-2): focus ≥ rest + 40 L; focus ≥ current-route circle + 15 L; current-route circle ≥ hovered + 12 L; first frame ≥ 60 %. AT-8b measures them on the device, and `window-nav-measure.py focus` on the mockup (§13).

#### 3.3.5 Visibility

Today the popup is `only_visible_with_laser`. T3/T4 clear the flag: wrap `vrPooledPopupStore.CreatePooledPopup` for type 3, or resend the live instance's params without it (spatial.md §3.1, §6.3 [PLAUSIBLE]; the flag is a plain request field that E2 showed is honoured). It is built behind the flag **`tabBarAlways`** (PLAN S9, "on (gated)"): V1 enables it in `defaults.json` only after AT-7 shows the flag cleared and the bar placed. Fallback and default until then: as today (visible with the laser and while it holds gamepad focus); the Large Title still answers "where am I".

#### 3.3.6 Depth and material

- **+25 mm** by moving the popup itself: Steam's +10 mm plus +15 mm on the frame's left side-panel transform (configured with the always-visible flag in C1a's `theme/popups/20-shell.json`, applied through P6's popup wrapper and P7's transform overrides; the t1 technique, spatial.md §5 [PROVEN] on t1, [PLAUSIBLE] on this node). Fallback: Steam's +10 mm. It is Steam's real panel, so its input is native. Never a crop (native-e2e §1 ghosting; PLAN §1.7 rule 1: no pop over the tab bar).
- T5: glassd `liquid` covers on the popup's own panel (`frame.menu.*` is already a live glassd surface, native-e2e). T1: panel tint `rgb(28 30 40 / .78)` + liquid edge.
- **Known deviation** (PLAN §4.4): VP P-37 asks for one capsule of ≤ 6 items on the leading edge. Steam's frame menu is one popup with ten items; moving Settings or Power elsewhere would hide Steam's nodes, so the second (system) capsule stays.

### 3.4 The bottom ornament: the contract

One toolbar ornament per window, owned by the shell (C1a). Area concepts fill its slots; they do not draw their own toolbars. PLAN §1.10 settles the open points of revision 2: **Steam's legend nodes are never hidden** (no `display: none`, no audit exception for legends), the glass height is set by the route (§3.1.1), and the ornament's **material is set by its content**.

#### 3.4.1 Geometry

| Property | Value |
|---|---|
| Node | `#Footer.%{BasicFooter}` (absolute bottom, z 7000): no background, no top hairline, `padding-bottom: 8px`. Steam measures its height (module 97502), so `--gamepadui-current-footer-height` becomes 92 and every page and modal ends at y 628 by Steam's own layout |
| Capsule | y **628–712** (84 px = 63 pt = 64 mm, 2.58°), straddling the glass's bottom edge by 28 px; centred; `width: fit-content` (or the area's fixed slots, below), **≤ 960 px** (75 % of the glass); radius 42; padding 0 12; gap 4; 14 px between member groups |
| Members | 60 px capsules (1.84°): label 22 px Semibold first; in gamepad mode the controller glyph follows it as a **30 px badge with a 16 px Bold letter** (white .16, letter white .70), the way a menu shows a keyboard shortcut. The hit region is the capsule's full 84 px height, and adjacent members' hit boxes abut (VP P-07) |
| Compact members | When the members would exceed 960 px, every member switches to the compact style (20 px labels, 16 px side padding) instead of being dropped (PLAN §1.10; SM's 1232 px limit is withdrawn) |
| Clearance | 8 px above the panel's bottom; 27 px above the window-bar row |
| Backing | T2 measures the union rect of the members and writes `--lgs-orn-x` / `--lgs-orn-w` on `#Footer`; `#Footer::before` (free, inventory shell §12) draws the capsule there. Without T2: two adjacent capsules (the footer legend's and Steam's laser-mode pill), 12 px apart, always in the capsule material |
| Fixed slots | An area whose ornament must not change width registers its slots: `__LGS_RT.shell.ornamentSlots(routeKey, {widths, gap, padding})` → `{remove()}`. On that route the shell draws the backing at the fixed rect (centred; width = the slots + gaps + padding), never re-measures it, tags `#Footer[data-lgs-orn-fixed="<routeKey>"]`, omits the Options member's name suffix (§3.4.3) and keeps the Options member present in both modes (§3.4.2). The area places the members in its slots with its own T1 rules |
| Library routes | HA §7.1's five fixed slots, 300 · 130 · 156 · 134 · 120 (840 px of slots + 4 gaps of 4 + padding 12 + 12 = **880 px**, x 200–1080), in both input modes (PLAN §1.10; C2c registers `ornamentSlots('library', {widths: [300, 130, 156, 134, 120], gap: 4, padding: 12})` and places the members) |

**Capsule or quiet legend (material by content).**

| Members present | Ornament | Look |
|---|---|---|
| Any member other than A and B (an action legend, a slot-1 button, the Options member, an area segmented control) | **Capsule** | The geometry above; `liquid` material (§3.4.5) |
| Only A and B | **Quiet legend** | No capsule material and no slab; the items keep their 60 px size and their place (y 640–700) and stay clickable. On `window-full` routes (`/account`, What's New) it sits inside the glass: labels 22 px Medium white .70 (PLAN §1.10). On `window` routes (settings pages, the search zero state) the labels sit in the ornament margin, over the room; there they get the **dim band** below |

- T2 tags `#Footer` with `data-lgs-orn="capsule"` or `"quiet"` from the members' button enums (below). The test is the button enum, never the label, so Steam's per-page labels for A and B ("Done", "Cancel") stay quiet.
- The state follows the legend's content, which follows focus; the **glass height never changes** with it (the route decides that). The capsule materializes on `materialize-in` (250 ms) and dematerializes on `materialize-out` (350 ms); the labels do not move.
- Without T2 the ornament is always a capsule (the safe default).
- **The dim band** (flag `quietBacking`, default `"window"`; PLAN §1.17 rule, decided by C1a, see the note below). Over a bright room, white .70 labels in the margin measure 1.1–1.5 : 1 (C1b, C1c, C1a: background L 209–236 behind "Open" and "Select"), far below VP P-39's 4.5 : 1, and the on-room shadow alone does not rescue them. So on `window` routes the quiet members sit on one soft band: black .62, 60 px tall, radius 30, its edges blurred by 7 px, spanning the quiet members with 10 px to spare; no rim, no sheen, no `backdrop-filter`, no slab in native mode. It is a shadow on the room, not glass: it darkens, it does not frost. The labels are 22 px Medium white .82 with the on-room shadow. With `quietBacking: "off"` the margin shows PLAN §1.10's bare labels. Measured on the mockups in §13.1 (contrast ≥ 4.5 : 1 over the curtain, L 236).
- **Note for the coordinator** (REQ C1a->Coordinator in C1a's log): PLAN §1.10 fixes the quiet look as "no capsule material, labels Medium white .70"; on `window` routes that look fails the must item P-39. The band keeps "no capsule material" (it is not glass) and changes the label alpha from .70 to .82 there.
- This replaces SET §4.11's hidden ornament and its audit exception E-ORN, and revision 2's laser-mode hiding of A and B (Q13): both are withdrawn (PLAN §1.10, S5).

#### 3.4.2 Members, in order, and the two input modes

The shell reads the two input signals P3 sets on every Steam document (PLAN §1.4), through the one accessor `__LGS_RT.input`; revision 2's own `html.lgs-gp` / `html.lgs-laser` classes are withdrawn:

- `html[data-lgs-vr-mode="gamepad" | "laser"]` (from `vrGamepadInput.IsInGamepadNav`, the getter `%{SortAndFilterContainer}` itself uses) decides **which of Steam's mode-only nodes render** (slot 1) and whether **glyph badges** show;
- `html.lgs-input-pad` / `html.lgs-input-laser` (from `FocusNavController.NavigationSource`) decides **every state look** (hover, focus, press).

| Slot | Node | Gamepad mode | Laser mode |
|---|---|---|---|
| 1. Laser controls | Steam's `%{SortAndFilterContainer}` (Sort with the current sort as its label; Filter), rendered by Steam only in laser mode (inventory library §6.1) | — (Steam does not render it) | Moved by T1 into the capsule's leading slot, keyed on `data-lgs-vr-mode="laser"` (it is absolutely positioned already; its buttons keep `pointer-events: auto`). Sort with a leading sort glyph and the value ("Alphabetical"); Filter with a leading filter glyph and Steam's "Filter: …" text |
| 2. Actions | Steam's `%{ActionButtonLegend}` nodes except A and B | All shown, label then glyph badge: "Filter X", "Sort By Y", "Options ☰" … | Every legend Steam renders is shown, labels only. Steam renders no ≡ legend under the laser (no element holds `.gpfocus`, IM §3.1), so on routes with registered More hosts (§3.4.4) the shell adds a T2 **Options** member that names the frozen target ("Options · Hollow Peaks"; no name on fixed-slot routes, §3.4.3) and dispatches like the More circle. Its label is Steam's own string for that target's ≡ action (the target's `onMenuActionDescription`), else the last ≡ legend Steam showed, else Steam's token `#LibraryHome_GameCarousel_ContextMenu` ("Options"); in laser mode a leading ⋯ glyph (the More circle's) stands where glyph badges would be. It is disabled (.38, no hover, no dispatch) when there is no target and while main's ModalManager holds any modal or context menu (in both modes, so it can never stack a second menu), and it removes itself whenever Steam renders its own ≡ legend, so there is never a duplicate. On routes with fixed slots (§3.4.1) it never leaves its slot: in gamepad mode, when Steam renders no ≡ legend (focus on the library's tab row, for example), it shows disabled in its place. On library routes it is C2c's slot 3 |
| 3. Area slot | At most one segmented control (Steam's node, e.g. the library's VR sub-filter, if its owner's gate passes) and T2 state labels on Steam's legends (current sort, filter count) | Shown | Shown |
| 4. Navigation | A (Select) and B (Back / Cancel / Done) legends | Quiet trailing members: Medium white .70, glyph badges | **Quiet trailing members, labels only.** Steam renders them in laser mode too (`shots/p2_lib_collections_on.png`), and they are never hidden |

- **Glyph badges** (VP P-26, P-27): Steam's own glyph component inside each legend, restyled to the 30 px badge. They show only under `data-lgs-vr-mode="gamepad"`. In laser mode the glyph child, which is decorative and not a target, collapses (zero width, no paint); the legend node, its label and its click target stay, so no function is hidden (G-AUD counts targets and text runs).
- T2 tags each legend with Steam's button enum (`data-lgs-btn`: OK, CANCEL, SECONDARY, OPTIONS, MENU, …, read from the legend's React props), so no selector depends on a localised label.
- Labels follow focus, as today. When they change, the new label fades in on `fade`; with T2 the backing's width morphs on `snappy`.
- Steam's legends' click dispatch is unchanged. The legend whose menu is open turns white (T2 tracks the last pressed legend or slot-1 button), e.g. Sort while the Sort menu shows (`p2_window-nav_sort.png`).
- **While an alert or sheet is open** (C1c's `html.lgs-modal`), the members that act on the page beneath (slot 1, the Options member, the area slot) recede under the tab bar's black .35 layer and stay clickable, as the toolbar does; A, B and the dialog's own legends stay lit. Menus do not recede the ornament (they have no scrim).

Shots: `p2_window-nav_ornament.png` (five strips: gamepad and laser in the library's fixed slots with the frozen target, a route without fixed slots, the quiet legend on `window` and `window-full` routes), `p2_window-nav_anatomy.png` (laser), `p2_window-nav_tabbar.png` and `p2_window-nav_tabbar_r863.png` (gamepad).

#### 3.4.3 The frozen target (T2)

Under the laser, Steam's `.gpfocus` is normally absent: Steam removes it, `.gpfocuswithin` and even `.Focusable` when the navigation source becomes the mouse, and hover never moves it [PROVEN, IM D-7, D-9]. When SteamVR hands overlay focus to the panel, Steam focuses the element under the laser and that `.gpfocus` then goes **stale** (IM §3.3). Steam's legends act on `.gpfocus`, so without help a laser click on a legend acts on nothing, or on an element the user left long ago (library audit B.5.1, LQ7; on Downloads the Options menu opens with Uninstall first and focused, social-media D6).

The shell keeps a **target**, fed by P3's attention state machine (`rt.attend`, PLAN §1.4):

1. On `pointerdown` on a registered card or row, the target becomes that element.
2. On laser dwell, an element becomes the target after **300 ms** (`rt.attend(el, {dwellMs: 300})`). A pointer crossing a poster on its way down takes less, about 90 ms in the board's example, so it never retargets.
3. When the pointer enters `#Footer` (`pointerenter`), T2 re-focuses the target through Steam's own nav node (`node.BTakeFocus(3)`, the call the lab already uses) before any click can reach a legend. Steam then re-renders the legends for the target, so a click dispatches the target's actions with Steam's own handler. AT-25 records whether Steam then renders its own ≡ legend (the T2 Options member steps aside if it does).
4. The Options member carries the target's name as a decorative suffix: "Options · Hollow Peaks" (T2, `aria-hidden`; the name from the element's accessible name or its title text). In gamepad mode focus is visible and there is no suffix. On routes with fixed slots (the library's 156 px slot 3) there is no room for it: the suffix is omitted, and the More circle stays on the frozen target while the pointer is inside `#Footer` (it does not follow attention into the ornament), so the target is marked on its own card.
5. The target clears when the route changes, when gamepad input arrives (gamepad focus is visible, so no freezing is needed), or after 8 s without the pointer on the window.

Areas read it through `__LGS_RT.shell.target()` and `onTarget(fn)`. Shot: `p2_window-nav_ornament.png` (third strip).

#### 3.4.4 The More circle (T2, one helper for every area)

DESIGN2 §10.4 asks for a visible "⋯" on the hovered or focused row or card. PLAN §1.11 makes it one helper, owned by the shell (`device/rt/20-more.js`), for every area (sign-off S14: on every host, including the game pages' event cards):

| Property | Value |
|---|---|
| Node | **One** T2 node per document, moved to the current target (the attention target of §3.4.3: laser dwell ≥ 300 ms, at once on gamepad focus), so there is nothing to re-attach when virtualized rows recycle; while the pointer is inside `#Footer` it stays on the frozen target. `role=button`, not focusable (the gamepad keeps ≡) |
| Look | **60 px** circle with a **80 px** hit (transparent padding), black .38 + 10 px blur (the clear material over content, PLAN §1.3, §1.6), "⋯" glyph 26 px white; white .94 with a dark glyph while its menu is open. Inside another glass container (the search sheet, a sheet) it has no blur, only the black .38 fill (no glass in glass, VP P-45). Laser hover + .08 and the spot; it never scales |
| Position | **Inside its host.** Cards: top right, inset 10 (the circle's box at host right − 70, host top + 10). Rows: trailing end, vertically centred, inset 24 |
| Isolation | A capture-phase listener on the node stops `pointerdown`, `mousedown`, `mouseup` and `click`, so the host's own handler never runs and the route never changes |
| Action | The host's own `onMenuButton` from its `Focusable` fiber props (SM-D15); fallback Steam's `vgp_onmenu` (gamepad button 14) dispatched on the host (HA §7.2, inventory library §0.3: the event ☰ sends). Never a new menu. The menu's source is the circle (C1c anchors to it) |
| Registration | Areas call `__LGS_RT.more.register(selector, {placement: 'card' \| 'row'})`. The helper shows only on a registered host whose `Focusable` has a menu action, and never on Home's launcher discs |
| Feedback | Tooltip "Options" (Steam's own legend string) after 0.8 s through P3's tooltip layer; `aria-label` the same; the activation sound through `rt.sound` with the `ENavSound` Steam uses for ≡ (PLAN §1.13) |
| Depth | It rides its host: inside a focused card's +15 mm crop, at 0 on rows. No slab of its own |
| Motion | Appears on `materialize-in` (250 ms), leaves on `materialize-out` (350 ms) |

The laser therefore opens a card's menu where it is, without reaching the ornament. Shots: `p2_window-nav_anatomy.png`, `p2_window-nav_ornament.png`.

#### 3.4.5 Material and depth

T5: a glassd `liquid` slab behind the capsule at the window plane (the inset approach, spatial.md §2.5); the quiet legend has none. T1: in-page `backdrop-filter: blur(12px) saturate(1.7)` + liquid edge + a 0 7 px 22 px shadow. Depth **0 mm** (it lies half outside the window cover, where a popped crop would double it off-axis; PLAN §1.7 rule 1 forbids pops over it). The +25 mm variant with an occluder is off (PLAN S11).

#### 3.4.6 Reconciliation with the area concepts

| Concept | In its file (revision 2) | Under the contract (PLAN §1.10) |
|---|---|---|
| home-apps §7 | Toolbar ornament 936 × 84 at (172, **636**) on a 664 px glass; then five fixed slots (880) | y **628**, glass **656**; the five slots 300 · 130 · 156 · 134 · 120 in both modes (C2c). Slot 1 Sort, slot 2 Filter (Steam's legends in gamepad mode, the slot-1 buttons in laser mode, with T2 state labels), slot 3 Options (Steam's ≡ legend, or the T2 Options member; no name suffix in this fixed slot, the More circle marks the target), slots 4–5 Select and Back. C2c registers the slots with `ornamentSlots('library', …)` (§3.4.1). Its More circle spec (60 / 80 inside the poster, inset 10) is this shell helper |
| settings §4.11 | Ornament hidden (`visibility: hidden`) when only Select and Back are present; exception E-ORN | **Quiet legend** in the margin instead, on the dim band (§3.4.1); E-ORN withdrawn. Settings routes stay `window` (656), so the capsule comes and goes inside the margin |
| game-pages §3.1 | 656 / 628, legends with leading glyph badges | Glyph badges trail the label and show in gamepad mode only |
| social-media §3.0 | Quiet legend on `/account`, achievements and the `/invites` card; capsule ≤ 1232 wide | Quiet legend adopted for every A/B-only ornament; the 1232 px limit is withdrawn (compact members above 960). Legend-only groups (friend menu, media Filter, Delete Clip, Downloads Options, Change Device, Add to Cart) become ornament members or the More circle on their row |
| control-center §5 | Power menu 440 px single column, 72 px rows | The shell's count rule (§5.1): 7 actions → two columns, 592 px (§5.2) |

The shared builder (`window-nav-shared.js`) draws the device's tab bar (Console on, live pitch), the contract's ornament (capsule or quiet, glyph badges by mode) and the More helper for every mockup that includes it. Area mockups adopt the window-bar row by replacing their `frame` and `pill` placeholders with `winbar`.

### 3.5 Under the window: one window-bar row

#### 3.5.1 Layout

references.md names the four strata under the window as a seam ("don't stack several rows of small separate chrome"); visionOS has one window bar and its close button. The new stack:

| Row | Content | Visible |
|---|---|---|
| Ornament | §3.4, straddling the glass (a capsule, or a quiet legend when it holds only A and B) | Always (routes with a footer) |
| **Window-bar row**, 15 mm below the panel | SteamVR's frame controls in one capsule, **left of** the window-bar pill, which is centred under the window (the moves are built behind the flag **`winbarMove`**, PLAN S10: on once AT-17 passes; until then SteamVR's positions, restyled) | With the laser on the dashboard, or while the frame controls hold gamepad focus (SteamVR's rule; it plays visionOS's "chrome on look") |
| Dashboard bar | SteamVR's, 13 cm nearer (control-center concept) | Always |
| Floating hint | Only while the dashboard has no focus (§3.5.3) | Transient |

At rest without the laser: two rows (ornament, bar). With the laser: three. Today: four, plus the hint.

#### 3.5.2 The row's parts (`vr:systemui`, theme in `theme/vr/`)

| Element | Node | New look | Size | Placement | Evidence |
|---|---|---|---|---|---|
| Frame controls | `%{FrameControlsContainer}` › `%{Section}` › `.ButtonControl` | One panel-glass capsule; sections 20 px apart; hit boxes abut along the row (VP P-07). Circles rest **quiet** (fill white .06, glyph white .70; with SteamVR's idle dim .6 the glyph reads at .42, VP P-70) and become full circles on hover (white .14 = rest + .08, and the light spot) or `%{GamepadFocused}` (+ .28, the spot .16 in the upper third, the specular arc ×1.5). Toggled (keyboard shown): white .94 with a dark glyph | Hit 107 × 107 systemui px (62 mm, 2.49°); visible 80; glyph 36 | Moved left so its right edge sits 26 view px (20 mm) left of the pill (T4: translation override on `bottom-controls-transform`'s child) | Size: E16 [PROVEN]. Move: [PLAUSIBLE], the same transform-override mechanism as E4 and E5b, where the laser target followed the panel |
| Close (game frames) | The button after the wide gap | A separate circle with × at the row's left end (visionOS's close sits left of the bar); red whole fill only on focus or hover, the × glyph white (CC §7: glyphs stay white on red) | As above | With the capsule | — |
| Window bar | `%{GrabHandleBar}` in `%{GrabHandleButton}` | White .46 pill with a soft shadow; hover or drag white .92, 198 wide; Steam's scaleX grow stays | 467 × 32 grab px = 140 × 9.6 mm; hit area ≥ 132 px tall as today | **Moved up from under the dashboard bar to the row, centred under the window** (T4: `DashboardGrabHandleTransform` translation) | [PLAUSIBLE], same mechanism; its drag behaviour (grab-transform) is unchanged |
| Idle dim | `:not(:hover):not(%{HasGamepadFocus})` opacity .6 | Kept (SteamVR's rule); brighter fills compensate | — | — | steamvr.md §2.5 |
| Tooltips | `.ControlBarButtonTooltip` panels | Thick-glass capsule (PLAN §1.13), 30 systemui px Semibold, 60 px tall, **below** the button; SteamVR's own delay | — | T4 transform flip [PLAUSIBLE]; fallback above (18 mm in front of the ornament) | — |
| More Options | `%{AdditionalOptions}` rows | Thick glass, radius 44, rows 96 systemui px (72 main px) with 8 px gaps; curvature as a real switch | 536 px wide | Above the More button | Verify only on a static mock (it moves SteamVR input focus) |
| Gamepad-mode pill | `%{ButtonPill}` | "Enter Gamepad Mode": blue whole fill. "Use Laser Mouse to Interact": quiet glass, white .70. Mixed case | Keep its padding (it sizes the quad) | — | T1 |
| Resize corner | `%{ResizeCorner}` / `%{ResizeSVG}` | An arc concentric with the glass corner (radius 54 + 12), 9 px stroke, white .72 → .92 on hover; shown only while the laser is near, as SteamVR does (VP P-70) | Panel fixed at 100 mm | Lifted 64 px to the glass corner on `window` routes (T4 [PLAUSIBLE]); fallback the panel corner | T1 colour |

**Fallback for both moves:** SteamVR's own positions (frame controls centred under the window, grab handle under the bar), restyled. AT-17 decides from `DumpLaserOverlays` (targets registered at the new places with unchanged sizes) and an `hvgrab` look; V1 then turns `winbarMove` on in `defaults.json`. The moves are transform overrides in C1a's `theme/sg/20-winbar.json`, applied by P7, composed with SteamVR's own values and restored in `finally` with a TTL (spatial.md §9.5). The theme for the row is C1a's `theme/vr/10-systemui.css`; P4 moves its shared values to `theme/vr/00-vr-tokens.css`.

Shot: `p2_window-nav_chrome.png`.

#### 3.5.3 The floating hint (`floatingfooter`, non-interactive)

`%{FloatingVRFooter}`: `filter: brightness(.6) drop-shadow(...)` → `none`; content as a panel-glass capsule **40** popup px tall, radius 20 (the `floatingfooter` host is 600 × 40 and clips to its content box, so 44 does not fit); glyph badges 28 px; labels 20 popup px Semibold, mixed case, white .96: "View · Jump to Dashboard Bar", "L5 R5 · Laser Mouse" (Steam's strings; nothing new). Steam shows it only when the dashboard has no focus, so it does not add a row in normal use; its glyphs are its content, so they show in either mode. The look is C3a's (`theme/35-hud.css`); its content and placement are the shell's (PLAN §2.4 C3a). Shot: `p2_window-nav_toast.png`.

### 3.6 The pointer proxy (T2, native mode only)

The native layer puts an opaque glassd cover over Steam's real panel and shows Steam's content as crops in front of it. The laser still hits Steam's real panel, so SteamVR's own laser dot is probably drawn behind the cover (spatial.md §2.4, native-e2e §5). No agent can see SteamVR's dot without a wearer. The shell therefore draws its own **while native mode is on**, and only then (PLAN §1.11, sign-off S16, flag **`pointerProxy`**, default `"native"`):

| Property | Value |
|---|---|
| Where | Every Steam document the native layer covers: `main`, `bar`, `frame.menu.*` (and `barpopup` when the control-center concept covers it) |
| Node | One `div.lgs-pointer`, `position: fixed`, `pointer-events: none`, `contain: strict`, top z-index (`device/rt/20-pointer.js`) |
| Look | A 16 px ring (2.5 px white .95) with a 6 px white core, a 1.5 px dark outer ring and a soft glow: readable on bright art and dark glass. Where SteamVR's own dot also shows at the same spot, the ring reads as its halo |
| Motion | Positioned with `translate` from `pointermove` (rAF-throttled, the same listener P3 uses for the hover light's `--hx/--hy`); hidden on `pointerleave` and when the document loses the pointer. It moves only with the pointer, so nothing animates at rest |
| Why it always shows | It is part of Steam's texture, so it is in every base crop and every popped crop, in front of the cover, whatever SteamVR does with its own dot. In a popped crop it marks the element that will receive the click (the real hit), which is what the user needs |
| When | Only while the daemon reports native mode (`lgs-native`); never in CSS-only mode, where SteamVR's own dot is visible on Steam's panel |

- **A recorded deviation** from VP P-11 ("draw no cursor"; PLAN §4.4): no agent can see SteamVR's dot behind the cover.
- **Retirement:** the proxy is removed (flag `pointerProxy = "off"`) once a wearer confirms that SteamVR's dot is visible with the cover flags (PLAN §5.3, question 2).

AT-0b verifies it on the device (CDP shots and an `hvgrab`).

### 3.7 Depth plan (PLAN §1.7)

Revision 1 relied on interactive crops for menus, alerts and sheets at +30–50 mm. Their registration is [PROVEN] but a click on them is [PLAUSIBLE], and only a wearer can close that (spatial.md §12). PLAN §1.7 makes one plan for every concept, with two profiles:

- **Default** (ships): every pop is a non-interactive crop; the laser passes through it to Steam's panel at the same x/y.
- **Wearer** (flag `interactivePops`, off; PLAN S2): restores the larger interactive depths after one wearer session (spatial.md §12).

| Element (this concept) | Default | Wearer | Mechanism |
|---|---|---|---|
| Window glass, toolbar row, content rows, in-window controls, fields, platters | 0 | 0 | Cover (+ base mosaic) |
| Bottom ornament (capsule or quiet) | 0 | 0 | Inset `liquid` slab behind the capsule; no slab for the quiet legend |
| Tab-bar ornament | **+25** | +25 | The frame-menu popup's own transform (§3.3.6) [PLAUSIBLE]; fallback Steam's +10. Never a crop |
| Focused or hovered content card ≥ 150 px (area concepts), with the More circle inside it | +15, non-interactive crop over the cover; the laser lift starts only after 80 ms of dwell (`.lgs-dwell`) | +15, interactive | Crop over the cover |
| Source card while its menu is open | PLAN §1.7's table: keeps +15 if it was the focused card; otherwise 0 with a CSS glow. Revision 2's +5 mm is withdrawn (it would be a fifth depth). PLAN's admission rule 6 (only the modal pops while one is open) contradicts the +15 case; until the coordinator rules (O4, §11), P6's reporter applies rule 6, so the source drops to 0 with the glow | +15 | — |
| **Menus, popovers, dropdown slabs** (C1c) | **+10**, appearing with the materialize (0 → +10 on `depth`, 441 ms) | +30, growing from the source's depth | Crop + `thick` slab |
| **Alerts** (C1c) | **+10**; **0** if it contains a destructive button (rule 4) | +30 (still 0 if destructive) | Crop + `thick` slab, or a flat `thick` plate |
| **Sheets**, including the search sheet (C1c, C1b) | **+10** | +30 → +50 | Crop + `thick` slab |
| Window dim during alerts and sheets | Steam's `.ModalOverlayBackground` restyled to black .35, in CSS, in both modes (PLAN §1.8). The hole treatment's `fill` follows the scrim | Same | No `t1` tint: in native mode the visible window is the cover and the base mosaic, both reparented outside `t1` (spatial.md §5), so a `t1` tint would dim only the hidden panel [inferred; P7's SG-5 checks it] |
| Tooltips | CSS shadow only | Owner + 5 mm | — |
| Toasts, window-bar row | SteamVR's | SteamVR's | Their own quads |

**Admission rules** (PLAN §1.7; the reporter P6 enforces them, gate G-DEPTH checks them). A pop must be:

1. **covered** by a cover or a plate, and never over the bottom ornament, the store's navigation ornament, the tab bar, the window-bar row or the `/invites` header nodes;
2. **click-safe**: dz_mm ≤ 0.25 × s × 0.769, where s is the shorter side of the smallest visible focusable it intersects (+10 mm needs s ≥ 52, +15 mm needs s ≥ 78); otherwise it drops to the next lower allowed value;
3. not over media or opaque art, unless the hole treatment is live and GP AT-HV-OFFAXIS passes;
4. never a destructive confirmation;
5. a container of at least 60 × 60, never text or a glyph alone;
6. still: never while its scroller moves; while a modal is open only the modal pops;
7. one of at most 4 distinct depths at rest per route, from {0, +10, +15, +25} mm.

C1a's own fragment `theme/layers/20-shell.json` declares the window cover (its shape from `data-lgs-glass`) and supersedes Phase 1's `hdr-*`, `footer` and `sort-filter` pops: nothing in the toolbar row or the ornament pops now.

- **Why 10 mm.** A non-interactive pop renders [PROVEN], and the laser passes through it to the real element [PROVEN, `skippingDueToNonInteractivity`]. The hit is offset from the drawn row by 10 mm × tan θ: 13 main px at θ = 45° (r = 1), ≤ 20 % of a 64 px row, ≤ 18 % of a 72 px row; 7.5 px at 30°. Steam draws the hover on the element actually hit and, in native mode, the pointer proxy marks it, so the user sees which row the click will reach.
- **Separation** comes from the .35 scrim, the slab's own glass, the hole treatment under the pop and a depth shadow (0.4 px y and 1.2 px blur per mm, with a 6 mm floor for the shadow so +10 mm still reads; VP P-48).
- **Animated depth deltas** stay ≤ 20 mm in both profiles (MO M4): 0 → +10 by default; in the wearer profile, chrome-sourced menus appear at their depth instead of travelling 0 → +30.

### 3.8 New strings (PLAN §1.15)

Text that the shell's T2 draws comes from Steam's or SteamVR's localization, found by source text (the `game-pages-locgrep.sh` method). Where no string exists, English is drawn only when the UI language starts with `en`; otherwise the element is icon-only or omitted. Every string is listed again in C1a's evidence log for V2.

| Where | Text | Source | Without a string |
|---|---|---|---|
| Large Title (§3.2) | The section's name: "Library", "Store", "Friends & Chat", "Media", "Downloads", "Settings" | Steam's own tab-bar labels (the frame menu's localized items) and `#MainTabsSettings` | Omitted |
| Back reveal (§3.2) | The previous page's title | The same route map | The circle does not grow |
| Back `aria-label` (E-BACK) | Steam's stock "Back" text | Read from the node before it is replaced | — |
| Options member and its suffix (§3.4.2, §3.4.3) | "Options" + " · " + the target's name | Steam's ≡ legend string; the name from the target's accessible name or title text | The member shows the menu glyph only |
| More circle `aria-label` and tooltip (§3.4.4) | "Options" | Steam's ≡ legend string | No tooltip |
| Search circle tooltip (§3.2) | Steam's placeholder | `%{SearchBox}`'s own placeholder | — |

---

## 4. Search: a sheet over the page you were on (built by C1b)

Revision 3 (PLAN §1.9, with §1.2–§1.15). Mockups: `window-nav-search.html` (zero state, laser mode, keyboard up) and `window-nav-results.html` (results for "half", gamepad mode, focus on the Top Hit). Both show the device's real library, its real program "Half SBS Toggle", Steam's real counts for "half" and Steam's own strings. Shots: `p2_window-nav_search.png`, `p2_window-nav_results.png`.

### 4.1 Why it changes

Today search is a 1.23° strip whose focused state is a light-grey web form. Entering it replaces the page with Steam's results route; leaving needs Back; an empty query lists the whole library; the keyboard shows no echo 22–28° below the text (shell-nav B.4.1, B.5.2, B.6). visionOS treats search as a system feature: suggestions and recent searches before typing, a scope bar, grouped live results and a no-results view that echoes the query (VP §3.2, P-62).

### 4.2 The model

Search stays on Steam's own routes (`/search`, `/search/tab/<Category>`), so history, B, the keyboard, IME and every result path are Steam's. The route's glass mode is `window` (PLAN §1.2). It is **presented** as a sheet over the page you were on:

1. On activation T2 takes a **context snapshot**: `cloneNode(true)` of the current page's content element (the child of `%{TopLevelTransitionSwitch}`) and of the toolbar's Large Title node, every `id` removed, `inert` and `aria-hidden` set, the `scrollTop` of each scrolled descendant copied, no listeners. It is a decorative picture; Steam's focus never sees it, because focusables register through React context, not through the DOM.
2. The search route renders (T3 override, §4.10): the snapshot under Steam's scrim restyled to black .35 (PLAN §1.8; never the `t1` tint), then the sheet.
3. The snapshot is pixel-identical to the page that just left, so the route change is invisible: the page stays while the sheet materializes over it.
4. Leaving (B, the Back circle, a click on the dimmed page, any tab) is Steam's `NavigateBack`: the real page returns under the same picture, and Steam's focus history puts focus back on the poster you left.

### 4.3 The trigger

- **Activation = the header input receives DOM focus** (`focusin` on `%{SearchBox}`). A laser click gives it focus; Steam's gamepad focus (D-pad Up from the top row) calls `focus()` on it.
- On activation T2 takes the snapshot and, **if the route is not already `/search…`**, calls `Navigate(Routes.Search.Root())`. If Steam navigates by itself on focus, nothing is added.
- The keyboard rises as Steam raises it (`onKeyboardShow`), on activation only, never on arrival (P-63).
- Input mode comes from P3 (`rt.input`, `html.lgs-input-*`); Steam's getters are never written.

AT-9a and AT-9b exercise the real trigger with both inputs and record what Steam itself does.

### 4.4 States

| State | Route | Sheet | Tier |
|---|---|---|---|
| Idle | any | — the field: 520 × 64 on section roots, 640 × 64 on nested routes, a 60 px circle on Home, folders, hero routes and the other routes of PLAN §1.9 (C1a) | T1 |
| Activated, empty | `/search` or `/search/tab/All`, empty query | **Zero state**, 880 × 500 at (200, 100) | T2 snapshot + T3 |
| Typing | `/search/tab/All` + query | **Results**, 960 × 500 at (160, 100); the width grows 880 → 960 on `snappy`; the height never changes | T3 |
| Category | `/search/tab/{Library,Friends,Store,Tools,Hidden}` | Steam's own tabbed page hosted in the sheet, 960 × 500 (AT-9d) | T1 + T3 host |
| No results | any, with a query | Steam's "No Results Found" (`#Search_NoResults`) as centred Title 3 and the query echoed under it in Callout, in quotes (P-62) | T1 + T3 |

- **The sheet:** thick glass (PLAN §1.6), radius 44, its top 14 px under the field so it reads as growing down out of the capsule, centred on the glass (P-35), ≤ 960 wide (PLAN §1.12); content inset 40 (zero state) or 32 (results).
- **The field** stays Steam's input in the toolbar row, above the scrim. While it holds DOM focus it carries the only focus ring in the system (3 px soft white .55 + 16 px glow, VP P-17); when focus moves into the sheet the ring goes. No microphone.
- **Close control:** the window's Back circle at (24, 24), above the scrim; after 0.6 s it grows into a capsule naming the page you return to (§3.2). It is the sheet's close circle in the sense of PLAN §1.12 and VP P-66, so the sheet has no second one.
- **A click on the dimmed page closes search.** This deviates from VP P-65 ("an outside click does not close sheets"): the search sheet hangs from its field like a popover, closing it loses nothing (the query is kept in Recent Searches), and PLAN §1.9 adopts this section's leaving paths. V2 records it as a known deviation.

### 4.5 Zero state (880 × 500)

Shot: `p2_window-nav_search.png`.

- **Recent Games** (`#LibraryHome_RecentGames`): five cells of 160 × 180 on a 160 px pitch; each a 120 px game disc (DESIGN2 §9.2: hero, logo at 70 %, specular arc, contact shadow) with a one-line Subheadline label (HA-5). Inside the sheet the disc is content, not glass (no glass on glass, P-45). Data: Steam's `recentAppsCollection` (`rt.react.data.recentGames(5)`), shortcuts included as in Steam's own list. A or a click → the game page (`rt.react.actions.navigate`). Focus: the Home disc lift ×1.10 + shadow; no pop (PLAN §1.7: < 150 px).
- **Recent Searches** (English only, PLAN §1.15; in other languages the header is omitted and the capsules stay): this session's queries (≤ 8, newest first) as 60 px capsules with a clock glyph, 24 Semibold, 24 px apart. Kept in SharedJSContext memory only, never on disk or in `localStorage`; `lgs off` or a Steam restart empties the list and the section hides. A or a click sets the query through Steam's own search store.
- **See All** (`#StoreApp_SeeAll`), a 60 px capsule with a grid glyph: Steam's own page for the empty query (today's "list everything") in the sheet.
- **Hint** (English only): Callout 22 px, white .70: "Type to search your library, friends and the Store."

### 4.6 Results (960 × 500)

Shot: `p2_window-nav_results.png`.

- **The scope bar** at the sheet's top: Steam's categories (`#SearchTab_All`, `_Library`, `_Friends`, `_Store`, `_Tools`, `_Hidden`) as one 64 px segmented control, segments 56 tall and ≥ 120 wide (E-SEG compact), each followed by Steam's count in white .70. Hidden appears only with matches, as Steam does; Friends shows its 0 as Steam does. Steam's own paging arrows ‹ › sit at the sheet's ends as 60 px plain circles (80 px hit). LB / RB step through the categories. The white pill travels on `snappy`.
- **All = the summary**, when Steam's own search results are available to T3 (Q6: a finder for Steam's search hook through `rt.react.find`). Items, order and counts are Steam's; the shell never matches games itself.
  - **Row 1:** the **Top Hit**, 372 × 170: hero art, the name in Title 3, Steam's status line (`Playtime: %1$s hrs`, `Not installed`, or Steam's display status), an "Open" capsule (60 px, `#Generic_Open`) that is part of the card's single target, and the More circle inside its top right (PLAN §1.11). Then Steam's next four library matches as 113 × 170 posters in Steam's order. Posters show art only at rest; the focused or hovered poster shows its name and status under it (DESIGN2 §7.8).
  - **Top Hit rule:** among Steam's library matches of the best match tier (exact title > title prefix > word prefix > substring), the most recently played; ties keep Steam's order. A program (S-A) becomes the Top Hit only with a strictly better tier.
  - **Row 2:** Steam's own header "Store (%1$s)" (`#Search_Results_Header_StoreApps_With_Count`) over Steam's first store results as 180 × 84 capsule cards, then a **See All** capsule that opens Steam's Store tab in the sheet, where "View more in the Store" (`#GamepadHome_GoToStore`) stays the path to the store search. When programs match (S-B), the **Software** cell (header `#AppType_2`; 300 × 84; the best program's icon on a 56 px disc and its name; "and N more" in English only, otherwise "+N") takes the row's start and the store keeps two cards.
  - **Below the fold**, in Steam's order, one section per other category with matches, under Steam's own headers with counts (`Friends (%1$s)`, `Tools (%1$s)`; Hidden as `#SearchTab_Hidden` with its count), holding Steam's items. The sheet scrolls under a 26 px fade (P-73), with no scrollbar (P-72); the next header peeks above the fade.
- **All without Q6:** the sheet hosts Steam's own All grid (every result Steam shows today, with Steam's counts in its tab row). Nothing is hidden or recounted by the shell.
- **Categories** always host Steam's own tabbed page (`steamChildren`) in the sheet: Steam's virtualised grid, its tab row restyled as the scope bar, "View more in the Store". Hosting Steam's page in a smaller container is [PLAUSIBLE]: the grid measures its container. Gate AT-9d; fallback: Steam's page full-window, restyled (T1), and the sheet only for the zero state and All.

### 4.7 Keyboard and echo

The keyboard is SteamVR-placed under the window and built by C4b. Search relies on its echo row (SM SQ4): a display-only mirror of the field on the keyboard's slab, so the typing glance is about 5° instead of 22–28°. If SQ4 fails, the field still updates live in the toolbar row.

### 4.8 Paths

| Step | Laser | Gamepad |
|---|---|---|
| Start | Click the capsule (or the 60 px magnifier circle) | D-pad Up from the top row of any page (Main's `onMoveUp`) |
| Type | Point at keys | D-pad over keys + A |
| Leave the keyboard | Done, or click the window | Done / B |
| Into the results | Point | Down from the field enters the sheet; focus lands on the Top Hit (zero state: the first Recent Games disc), P-22 |
| Switch category | Click a segment or ‹ › | LB / RB; or Up to the scope bar, Left / Right + A |
| Open | Click a card, poster, disc, store card or See All | A |
| Play a library result (S-C) | "Play" in the ornament (acts on the frozen target), or the More circle → Steam's menu → Play | X (Steam's primary action) |
| Item menu | The More circle on the attended item, or "Options · <target>" in the ornament | ☰ |
| Clear | The × mini circle (44 px, E-MINI) in the field | Backspace on the keyboard |
| Repeat a search | Click a Recent Searches capsule | Focus + A |
| Leave search | The Back circle, a click on the dimmed page, any tab | B (our page's `onCancel` → `NavigateBack`) |

### 4.9 Ornament, depth, motion and sound

- **Ornament** (§3.4, PLAN §1.10): our `Focusable`s declare Steam's own action descriptions: A "Open" (`#Generic_Open`), B "Back" (`#ActionButtonLabelBack`), X "Play" (`#GameAction_Play`) on library items, ☰ "Options" (`#ActionButtonLabelContextMenu`). Zero state: A and B only, so the quiet legend in the margin. Results with a library item attended: X and ☰ join, so the 84 px capsule. Glyph badges only in gamepad mode. Steam's legend nodes are never hidden.
- **Depth** (PLAN §1.7, default profile): the sheet is a +10 mm non-interactive crop over a `thick` slab, 0 → +10 on `depth` with `sheet-in`. A focused or dwelled content card in the sheet whose long side is ≥ 150 px (Top Hit, posters, store cards) rises to +15 mm, capped by the click-safe rule on its smallest focusable (the More circle's 80 px hit allows +15). Recent Games discs, the Software cell, capsules and the scope bar never pop. Nothing pops while the sheet scrolls; the snapshot never pops. Wearer profile (`interactivePops`): the sheet +30 → +50, interactive.
- **Native mode:** the snapshot, scrim and sheet content are Steam's DOM, so they reach the headset through the base mosaic and the sheet's crop. **CSS-only:** in-page blur 30 + tint .40 + the edge lobe + shadow (§8.4); nothing inside the sheet has its own `backdrop-filter` (P-45): the Open capsule and the More circle are fills there.
- **Motion:** present on `sheet-in` 735: glass from the field (scale .97 → 1, origin at the field's centre-bottom), content 25–70 %, scrim 0 → .35 on `fade`, z 0 → +10 on `depth`. Zero state → results: width 880 → 960 on `snappy`, sections cross-fade on `fade`. **Dismiss:** leaving is Steam's `NavigateBack`, and React unmounts our route after Steam's ≤ 200 ms exit (PLAN §1.5), so content and glass fade out in 150 ms linear; glassd dissolves the slab in native mode. Reduce Motion: fades of ≤ 200 ms only. Nothing runs at rest.
- **Sound** (PLAN §1.13): Steam's `ShowModal` / `HideModal` on present and dismiss, `ChangeTabs` on a scope change on our All page (Steam's own tab row sounds itself); nothing on hover.

### 4.10 Implementation and fallbacks

- `rt.react.routes.override(Routes.Search.Root(), (steam) => jsx(LgsSearch, {steam}))` (P2 §4.2) in `device/rt/21-search.js`, module `search`, flag `wp.c1b`.
- `LgsSearch` reads the query from Steam's search store and re-renders on its change. It renders inside `rt.react.ui.Page` (`onCancel` = `NavigateBack`) with `ui.ErrorBoundary` whose fallback is `steamChildren`: the snapshot + scrim (a plain node; a click calls `NavigateBack`), then the sheet: zero state, the All summary (Q6), or `steam` for categories, See All and All-without-Q6.
- HA's contributions go in through `__LGS_RT.search.addProvider` (spec: `docs/phase2/wp/C1b.md`, "Interface announced"). Every launch and jump goes through `rt.react.actions`, which logs instead of running in test mode.
- The snapshot lives in a module-level variable and is dropped when `LgsSearch` unmounts or on `lgs off`.
- **Fallback 1** (no page root found, e.g. a deep link): the sheet sits on plain window glass; the previous page's title shows dimmed in the toolbar row.
- **Fallback 2** (T3 override unavailable, or the runtime off): Steam's search page, restyled by T1 (`theme/21-search.css`): the scope bar, title-case labels, Steam's tiles; row heights unchanged because the grid is virtualised.

---

## 5. System presentations

Menus, popovers, alerts, sheets, the Power menu and route transitions are built by **C1c** (`theme/22-presentations.css`, `theme/23-transitions.css`, `device/rt/22-menus.js`, `theme/layers/22-presentations.json`); toasts and tooltips' look by **C3a**. PLAN §1.12 decides this section.

All of these render inside Steam's main window (ModalManager), except toasts, tooltips and the frame-control popout. The modal box runs from the header's height (108) to the footer's (628): **menus and dialogs have 520 px of height**. With the CQ1 fallback the modal container is padded by 68 px, so the box is the same (§3.2).

### 5.1 Menus and popovers (Steam's gamepad context menu)

#### 5.1.1 Layout by item count (no menu scrolls)

Revision 1 used 72 px rows for every menu, which made the device's tile menu (6 actions + Cancel, because developer mode adds Developer ›), Sort By (10) and Downloads Options (8) scroll. T2 counts the actionable items of `contextMenuContents` (excluding Cancel) and sets one class:

| Items | Class | Layout | Rows | Header | Height | Width |
|---|---|---|---|---|---|---|
| ≤ 5 | — | One column | 72 px, 6 px apart | 40 px header row (22 px Bold, white .70) | ≤ 512 | 320–420 |
| 6–7 | `lgs-menu-compact` | One column | **60 px visible on a contiguous 64 px pitch** (the row element is 64 px; its fill is inset 2 px) | Inline: the label as a 26 px line (19 px Semibold, white .50) at the slab's top-left | 6 actions: **502** (tile menu, measured); 7 items: 504 | 400 |
| ≥ 8 single-level actions | `lgs-menu-grid` | **Two columns**, column-major in Steam's DOM order: `display: grid; grid-auto-flow: column; grid-template-rows: repeat(ceil(n/2), 72px)`; Cancel spans both columns as the last item | 72 px, 6 px apart, 8 px between columns | 40 px header row | Downloads Options (8): 434 | **≤ 592** (2 × 284 + 8 + 16) |

**Value menus** (dropdowns and choices such as Sort By; PLAN §1.12):

| Options | Layout |
|---|---|
| ≤ 8 | **Placement:** a slab anchored to its capsule, right-aligned, below, above or over it (SET §4.5). **Layout** follows the count table above: ≤ 5 one column, 6–7 compact, 8 the two-column grid (8 rows of 72 px would need 624 px) |
| > 8 on settings routes | SET's **list page** over the detail pane (built by C6a) |
| 9–14 elsewhere | The two-column grid above (Sort By, 10 options: 592 × 508) |
| ≥ 15 | One scrolling column of two-line rows (CTL C-D19) |

- **Cancel** stays Steam's appended item and the last in DOM order: a 56 px quiet capsule centred under the rows, white .08 fill, Medium white .70 (HA-11).
- **Exemption E-MENU** (PLAN §1.16): menu rows are ≥ 60 visible on a contiguous pitch of ≥ 64 (compact) or 78 (regular), ≥ 320 wide; this replaces the general 80 px hit rule for menu rows.
- **Groups**: Steam's separators become 6–8 px of space, no line.
- **Submenus** (›) open beside the menu as Steam does; their own item count chooses their layout.
- **D-pad in the grid.** If Steam's nav node for `contextMenuContents` declares no layout, `GetLayout()` reads the grid as GEOMETRIC and the D-pad follows the picture (Left/Right between columns). If it declares `column`, Up/Down walk the same column-major order (Down from the last row of column 1 continues at the top of column 2); Left/Right do nothing. Both are usable; AT-12 records which one Steam uses.
- AT-11b checks every case on the device: `scrollHeight == clientHeight`, Cancel inside the slab, slab ≤ 520 × 600.

Shots: `p2_window-nav_menu.png` (6 actions, compact, laser hover), `p2_window-nav_sort.png` (10, grid, laser hover), `p2_window-nav_power.png` (7 grouped, grid by S24, gamepad focus).

#### 5.1.2 Slab, states and tones

| Property | Value |
|---|---|
| Slab | `%{*BasicContextMenuModal>contextMenuContents}` → thick glass, radius 32, padding 8; Steam's `filter: drop-shadow` → the depth shadow; first/last margins 0 |
| Rows | Radius 24 (22 in compact), 26 px symbols left of 24 px labels (T2 decoration by tone class; none where unknown); trailing › for submenus |
| **Focus** (`%{*…>Focused}` / `.gpfocus` under `html.lgs-input-pad`, `!important`) | + white **.28** (P4's focus token, tuning .28–.32), light spot .16 in the upper third, the row's own specular arc ×1.5; first frame ≥ 60 % |
| Laser hover (`:hover` under `html.lgs-input-laser`) | + white .08 and the light spot .12 at the pointer. Hover never moves Steam's focus [PROVEN, IM D-7], so a menu row under the laser shows hover, not focus |
| **Checked / selected** (`.menuChecked`, `%{*…>Selected}`) | A white check (24 px, stroke 3) in the row's **leading** 28 px slot, the slot action menus use for their symbols; no fill. Every row of a value menu reserves the slot, so labels align (as SET §4.5, visionOS menus and the CTL and SET mockups; revision 2's trailing check is withdrawn). AT-8c measures focus against a real checked row |
| Submenu parent open (`%{*…>active}`) | White .94, dark label |
| Primary | `.Play`, `.Launch` and the primary first row: green whole fill. `.Install`, `.Update`: blue whole fill. On a coloured fill the row's label and glyph are #0d0e12 on green, orange, yellow and red, white on blue (CC §7) |
| Destructive | **≤ 2 destructive rows**: red label (Semibold) and red symbol at rest. **More than 2** (Power): red symbol, white label at rest. On focus always a red whole fill (`rgb(255 66 69 / .92)`) with a #0d0e12 Semibold label and glyph, the illumination capped at + .04, and the outer glow. Never reordered (SM-D8, S20); Steam's default focus untouched (S6) |
| Focus on a coloured or white fill | A blurred outer glow (P-16), P4's token `--lgs-white-glow` (`0 0 22px 8px` white .55; + 23 L in the 8–16 px band on a bright room, `contracts/tokens.md`). PLAN §1.4's `0 0 18px 2px` white .30 measured + 11.7 L on the alert mockup, below P-16's + 20 |
| Disabled | 40 % |
| Popovers | Same, sized to content, no arrow; > 40 % of the window → sheet rules |
| Dropdowns (Settings) | Same slab, anchored to the dropdown button, the current value checked; long lists per the value-menu rule above |

Mockup values (C1c log E8): Power's focused row + 61.8 L over a rest row; the sort menu's laser-hovered row + 22 L over rest (P-03: + 10 to + 25).

#### 5.1.3 Anchor, morph and depth

- **Anchor (T2).** Steam always centres the menu. T2 keeps the source: the element under the last `pointerdown`, the More circle (§3.4.4), or (for ☰) the `.gpfocus` element; then sets `translate` on `%{*BasicContextMenuHeader>BasicContextMenuModal}` so the slab sits beside it: 16 px right of a card (left if it would leave the window); above an ornament source, growing upward; aligned to the source's edge; clamped inside the modal box. For a source inside a page row, GP §3.4's order applies: above, right, left, then Steam's centred placement. Ornament sources: the slab's left edge 8 px left of the source's, so its rows line up with the button; its bottom clamped above the ornament (Sort By: y 108–616). Cross-quad sources (the Power tab) anchor to the window's leading edge at the source's height. `ModalClickToDismiss` is untouched. **Gate:** anchoring is used only if WN AT-11, GP AT-MENU and SET CQ10 pass (a click outside still dismisses, the D-pad is unchanged); otherwise the menu stays centred and still morphs from its source.
- **Source.** A legend, slot-1 button, tab or More circle turns white while its menu is open. A source card keeps its +15 mm if it was the focused card, otherwise it stays at 0 with a soft CSS glow (PLAN §1.7; revision 2's +5 mm is withdrawn).
- **Scrim.** None: `.ModalOverlayBackground` is transparent while the overlay holds a `.BasicUIContextMenu` (`:has()`).
- **Morph.** `morph-open` (607 ms, b .20): `clip-path` from the source rect (T2 fills `--sx --sy --sw --sh --sr`) to the slab; content 15–50 %; items take input from the first frame. Every slab above is ≤ 600 × 600 (largest 592 × 508), inside the clip-path limit (DESIGN2 R9, MO §6.4). A larger slab would materialize instead (glass channel + swell, origin at the source side). `clip-path` cannot reach outside the slab, so T2 carries the source rect to the slab's nearest edge at the source's height (the tile menu starts as a 60 × 60, radius 30 shape at the slab's left edge, level with the More circle). Close: Steam removes the DOM, so CSS is instant. glassd v3 draws no morph (`contracts/glassd.md` §6): in T5 the slab's glass materializes in place on its `phase` while the CSS morph plays, and on close glassd dematerializes it. Reduce Motion: a 180 ms cross-fade.
- **Depth.** +10 mm by default, 0 → +10 on `depth` (§3.7).

### 5.2 The Power menu

PLAN §1.12: this section's layout, the control-center concept's glyphs and group labels (CC §5), and CC's second entry point (the Power circle in Control Center). Sign-off S24 adopts the two-column grid.

Steam's Power menu is a context menu (module 79100 → `showContextMenu`), so §5.1 applies, with one exception: by count its 7 actions would take the compact column, but its two groups sit side by side in the two-column grid (sign-off S24). T2 identifies it as the Power menu and sets `lgs-menu-grid`.

- **Two groups side by side**: "This Device" (Sleep, Shutdown, Restart Device, Restart Steam VR) and "Steam" (Change Account, Sign Out, Restart Steam), Steam's live labels (inventory shell §4); Cancel spans below. **592 × 470 px** (measured), within the 520 px box and the 600 px morph limit (revision 1's 712 px slab was not).
- The group labels are T2 decorative nodes (Footnote 18 px Semibold, white .50, `aria-hidden`). "This Device" and "Steam" are new strings, drawn only when the UI language starts with `en` (PLAN §1.15); otherwise, and without T2, space separates the groups. In the grid the second group starts a new column with `grid-column: 2` on Steam's separator.
- Six of seven items are destructive: red glyphs, white labels at rest, red whole fill on focus (§5.1.2). This matches the control-center concept's D-CC1.
- **Default focus is not changed.** Steam's preferred focus may land on Restart Steam VR; it stays Steam's (PLAN S6, which also covers alerts). The mockup shows it as the focused red whole fill.
- Anchored at the window's leading edge, bottom at 616 (top 146), beside the Power tab, which is white while the menu is open.
- Every item still opens Steam's own confirmation dialog (§5.3): a visionOS alert with a **red confirm capsule**, its label dark (CC §5, §7). That alert contains a destructive button, so it stays flat at 0 mm (§3.7 rule 4).

### 5.3 Alerts (`ConfirmModal`, small dialogs)

| Property | Value |
|---|---|
| Card | `%{*GamepadDialogContent_InnerWidth>GamepadDialogContent}`: thick glass, radius 44, width 640 (19.5°), padding 36 36 28; Steam's border, `#0e141b` fill and `vw`/`vh` padding replaced |
| Type | Title Title 3 28 px Bold, left; body Callout 22 px Medium white .70, left; title case |
| Buttons | `button.DialogButton` as 60 px capsules side by side **in Steam's order** (`DialogTwoColLayout` is a nav row). Primary blue; `.Destructive` red (dark label, CC §7); secondary white .10. Focus + .28, spot, arc (`!important`); on a white or coloured fill the focus is the outer glow `0 0 18px 2px` white .30 (VP P-16) |
| Text prompt | A 64 px recessed capsule with the focus ring |
| Position | **Centred on the glass** (VP P-35, ± 24 px): the card's centre at y 328 on `window` routes, 360 on `window-full`. T1 pads `ModalPosition`'s bottom; it never moves its top or bottom (LAB) |
| Scrim | `.ModalOverlayBackground` in `%{GamepadDialogOverlay}`: black .35, no blur, in both modes, **clipped to the route's glass shape** (`window`: 1280 × 656, radius 54; `window-full`: 1280 × 720; `windowless`: the whole quad, radius 54), so the ornament margin and the corners never darken the room. No `t1` tint (PLAN §1.8) |
| Chrome while open | Toolbar contents at opacity .45 (still clickable, as today); the tab bar darkened; the ornament stays lit with the dialog's legends, while the page's own members (slot 1, the Options member, the area slot) recede (§3.4.2). The tab bar lives in another popup, so C1c's T2 sets `html.lgs-modal` on every popup while main's ModalManager holds an alert or sheet |
| Dismissal | Steam's: an outside click (`ModalClickToDismiss`) and B cancel. VP P-65 asks that an outside click not close alerts and sheets; Steam's behaviour is kept for function retention and recorded as a deviation (PLAN §4.4) |
| Default focus | Steam's (PLAN S6). VP P-67 asks for the non-destructive choice; recorded as a deviation |
| Depth | **+10 mm**, non-interactive pop; **0 mm** (a flat `thick` plate in native mode) when the alert contains a destructive button (PLAN §1.7 rule 4). Wearer profile: +30, interactive (still 0 if destructive) |
| Native flat modals | A destructive alert carries `data-lgs-destructive` (never pops, reporter rule 4) and `data-lgs-plate="thick"` (a flat plate) |
| Motion | Materialize 250 ms + swell 1.02 → 1; content 35–100 %; scrim 0 → .35 on `fade`. Replaces Steam's `.5s` card animation by naming our keyframes and repeating Steam's opacity end state (MO R3; sign-off S3, adopted). The default button takes focus as soon as content passes 50 % |

Shot: `p2_window-nav_alert.png`.

### 5.4 Sheets (large dialogs, scrolling dialogs, the app-details overlay)

| Property | Value |
|---|---|
| Rule | A dialog whose card is wider than 640 px or taller than 40 % of the window (288 px) |
| Card | Thick glass, radius 44, max width 960 (75 % of the glass), **centred on the glass** (P-35): top-aligned at 108 and at most 488 px tall on `window` routes (552 on `window-full`), so its centre stays within 24 px of the glass centre; the content scrolls inside |
| Close | A 60 px circle at (24, 24) in the card: a T2 decorative node whose click dispatches the click Steam's `%{*…>ModalClickToDismiss}` handles (cancel). Laser-only; B is the gamepad path |
| Title | Title 2, 30 px Bold, centred; trailing actions as capsules at the 24 px inset |
| Scroll | `ModalPosition` keeps `overflow: hidden auto`; content fades under the card's bottom edge |
| Scrim, chrome | As alerts |
| Depth | **+10 mm** static, non-interactive (+30 → +50 interactive in the wearer profile). The window-recede variant is off (PLAN S7, flag `sheetRecede`): the sheet comes forward |
| Motion | `sheet-in` (735 ms): scale .97 → 1, content 25–70 %; `sheet-out` (514 ms), content out first, scale → .98. `sheet-out` plays in CSS only while Steam keeps the node (MO R4); otherwise the CSS close is instant and glassd dematerializes the slab in place |
| App-details overlay | `%{Container>TransitionWrapper}` loses its blur and brightness → black .35; content materializes on `sheet-in` |

Shot: `p2_window-nav_sheet.png` (content: library concept).

### 5.5 Toasts (`notifications` quad, 340 × 80 popup px, placed by SteamVR)

| Property | Value (popup px) |
|---|---|
| Card | `%{ShortTemplate}`: 320 × 76, radius 30, panel glass; Steam's 1 px outline → none. It sits at x 20, y 2 of the quad: Steam's `inset: 0 0 0 20px` on `%{GamepadToastPopup}` stays |
| Icon | `%{ShortTemplate>ShortLogoDimensions}`: a 48 px circle; dark glyph on green and orange discs, white on blue and red; achievements: the art as a rounded square |
| Text | Title 20 px Semibold white .96; body 18 px Medium white .70; one line each; `%{TwoLine}` clamps the body to 2 lines and the card grows to 80 |
| Friend toasts | `%{ShortTemplate>AvatarStatus}` → a 3 px ring in the state colour |
| Incoming call | Green whole fill (Steam's gradient) with **dark** text (CC §7) |
| Motion | Materialize in place, 250 ms; translate −8 → 0 on `snappy`; swell 1 + 12/320. Replaces `toastEnterVR` in Steam's animation list, **keeping `toastExitVR`** (MO §4.10). Out: dematerialize 350 ms |
| Scope | Never scoped to `body.GamepadMode` (the window's body has only `.LowPerfMode`, LAB). No time label (it is not Steam's, and would be a new string under the type floor) |

Shot: `p2_window-nav_toast.png`.

### 5.6 Tooltips

PLAN §1.13: P3's tooltip layer (`device/rt/07-tooltip.js`) for in-window tooltips and a `ShowTooltip` delay wrapper for the bar's popup tooltips; the look is C3a's. A thick-glass capsule 48 px tall, 20 px Semibold, below its owner by default (`data-lgs-tip="above"` for GP's action cluster), 0.8 s in and 0.2 s out for both laser and gamepad (VP P-12); the one exception is GP's icon-only cluster controls, which show at once under gamepad focus (`data-lgs-tip-pad="now"`). Tooltips only on icon-only controls. On the bar's `tooltip` host (400 × 40 tp, a hard maximum) the 48 px capsule becomes the host's full 40 tp (= 48 main px at m .83), 18 Semibold; Steam closes that host at once, so there is no 0.2 s exit there (C3a). The shell's icon-only controls (the search circle, the More circle) use the in-window layer (§3.8). SteamVR frame-control tooltips: §3.5.2.

---

## 6. Navigation model

### 6.1 Where things are

| Need | Laser | Gamepad |
|---|---|---|
| Know where I am | Large Title + the current route's circle in the always-visible tab bar | Same |
| Change section | Click a tab-bar circle (labels after Steam's 500 ms hover) | D-pad Left at the content's left edge, or B at the window root: the bar takes focus and expands at once → Up/Down → A. Right or B returns |
| Go back | The Back circle (previous title after 0.6 s) | B |
| Search | The search capsule, or the search circle on routes that collapse it | D-pad Up from the top row |
| Act on the thing I looked at | The More circle inside it, or the ornament's Options member naming it (frozen target) | ☰ / X / Y / A, as the ornament's glyph badges say |
| Page actions (sort, filter) | Ornament slot 1 (laser mode) | Y / X |
| Window controls | The window-bar row (visible with the laser) | D-pad Down from the window's bottom row → frame controls → Left/Right → A |
| Move the window | Drag the window bar | — (as today) |
| The dashboard bar | Point at it | View ("Cycle View"); the floating hint says so |
| Power | Tab bar › Power; Control Center › Power (control-center concept) | Tab bar › Power |

### 6.2 What B does (unchanged, now visible)

1. A menu or dialog is open: close it. 2. The search sheet is open: close it (back to the page). 3. A nested page: go back. 4. The window root: open the tab bar. The ornament's B legend (gamepad mode) names the current meaning, because Steam supplies the label (our search page declares Steam's own "Back", `#ActionButtonLabelBack`).

### 6.3 Input modes

P3 owns the input signals (PLAN §1.4; `device/rt/04-input.js`) and sets them on every Steam popup; the shell only reads them, through `__LGS_RT.input`, whose test stub changes only our classes and never Steam's getters:

| Signal | Source | The shell uses it for |
|---|---|---|
| `html.lgs-input-pad` / `html.lgs-input-laser` | `FocusNavController.NavigationSource` | Every state look on the shell's controls: laser looks on `:hover`, gamepad looks on `.gpfocus` |
| `html[data-lgs-vr-mode="gamepad" \| "laser"]` | `vrGamepadInput.IsInGamepadNav` | Which of Steam's mode-only nodes render (ornament slot 1) and whether glyph badges show (§3.4.2) |

Revision 2's own `html.lgs-gp` / `html.lgs-laser` classes are withdrawn. **Hover never moves Steam's focus** [PROVEN, IM D-7], so every delayed reveal of the shell (the Back title, the More circle, the frozen target, tooltips) is fed by P3's one attention state machine (`05-attention.js`): gamepad focus events in gamepad mode, `pointerenter` plus dwell in laser mode. Laser lift, scale and depth start only on `.lgs-dwell` (80 ms); brightness changes at once (VP P-06).

Focus illumination (+ .28, the spot .16 in the upper third, the control's arc ×1.5; P4's tokens) is the same in every quad: Steam's `.gpfocus` and `%{*…>Focused}`, SteamVR's `%{GamepadFocused}` and `%{HasGamepadFocus}`, SteamVR's `%{FocusRing}` (its 20 × 1.2 s pulse becomes one static state), and the bar's ring hint. Moving focus between the window, the tab bar, the frame controls and the bar reads as one moving light. SteamVR's pages have no input classes; there `:hover` and `%{GamepadFocused}` are the two states.

---

## 7. Motion

All tokens are DESIGN2 §11 (MO), generated by P5 (`theme/02-motion.nowrap.css`, `device/shared/motion.js`); a token never changes in an output, only in `springs.py` (PLAN §1.5). Durations are spring settling times. Keyframes are P5's `lgs-mat-*`, `lgs-focus-in`, `lgs-page-*`, `lgs-sheet-*`, `lgs-toast-in` and `lgs-morph`, all with `backwards` fill (R11). Rows marked C1c, C1b or C3a are built by those packages.

| Interaction | Token | What moves | Must not |
|---|---|---|---|
| Hover in / out | `hover-in` 294 / `fade` 441 | Light spot, fill alpha | Scale, outline |
| Gamepad focus | `hover-in`, first frame ≥ 60 % (static `!important` fill) | Illumination, specular arc | A travelling indicator, scale |
| Press | `interactive` 210 in, glow off 90 ms, swell back `snappy` 488 | Glow, swell ≤ ×1.06 | Delaying the action |
| Back reveal | 0.6 s of attention (laser dwell or gamepad focus), width `snappy`, label in on `fade` | Capsule width | Moving the circle |
| Tab bar expand / collapse | Steam's timers (500 / 800 ms); Steam's width transition retimed to `snappy` / `fade` (timing properties only) | Width, label opacity | Setting width |
| Tab selection change | Cross-fade on `fade` (T1); the circle travels on `snappy` (T2 option) | Circle | Tab sizes |
| Segmented control | Pill travel `snappy` 488 | Pill x and width | Labels |
| Route change (C1c, `23-transitions.css`) | Old content out 150 ms linear; new content in + `translate` ±16 px (T2 direction; 0 in T1) on `page` 662, 40 ms delay (MO §6.4; sign-off S3, adopted; within Steam's timeouts: enter ≤ 800 ms, exit ≤ 200 ms) | Opacity, translate | Scaling the 38° window, re-animating chrome |
| Tab content (library, search categories; C1c) | ±16 px + fade on `page` (replaces Steam's ±40 % slide) | | Full-width slides |
| **Search sheet present** (C1b) | `sheet-in` 735: glass from the field (scale .97 → 1, origin at the field's centre-bottom), content 25–70 %, the page you were on dims 0 → .35 on `fade`, z 0 → +10 on `depth` | Glass, scrim, z | Moving the field |
| Search sheet zero state → results (C1b) | Sheet width 880 → 960 on `snappy`; sections cross-fade on `fade` | Width | Height jumps |
| Search sheet dismiss (C1b) | Content and glass fade out in 150 ms linear inside Steam's ≤ 200 ms route exit (leaving is Steam's `NavigateBack`; React unmounts the route); glassd dissolves the slab in native mode | Opacity | A `sheet-out` longer than Steam's exit |
| Menu open / close (C1c) | `morph-open` 607 [b20] (clip-path, ≤ 600 × 600) / `morph-close` 441 (glassd); z 0 → +10 on `depth` | Shape from the source, θ, z | Content scale; animated depth > 20 mm |
| Alert (C1c) | Materialize 250 + swell 1.02 → 1; scrim `fade`; z 0 → +10 on `depth` (stays 0 when destructive) | Glass channel, scrim | Shake, bounce > .15 |
| Sheet (C1c) | `sheet-in` / `sheet-out`; z 0 → +10 on `depth` | Glass, scale, z | Parent motion in CSS |
| Toast (C3a) | Materialize 250 + `snappy` −8 → 0 / dematerialize 350 | Glass, content | Slide from the edge |
| Ornament legend change | New label in on `fade`; backing width `snappy` (T2) | Label opacity, backing width | Moving the labels |
| Ornament capsule ↔ quiet legend | Capsule glass `materialize-in` 250 / `materialize-out` 350 (`lgs-mat-glass-*` on `#Footer::before`) | Glass channel | Changing the glass height; moving the labels |
| More circle appear / leave | `materialize-in` 250 / `materialize-out` 350 | Glass channel | Pop-in |
| Pointer proxy | None (follows the pointer) | — | Any animation |
| Window open | glassd ramps the cover on `sheet-in` | Optics | Window position |
| Scroll edge | Scroll-linked over 24 px | Band opacity | Blur radius |

- **Reduce Motion**: bounce 0; scale, translate and z become fades of 150–200 ms; the end depth is pushed once; materialize becomes a 180 ms cross-dissolve; the morph becomes a fade in place; glassd gets `reduceMotion: true` (PLAN §1.5).
- **At rest**: one second after any interaction no animation is in `playState: running` and none whose name starts with `lgs-` remains, on `main`, `frame.menu`, `notifications` and `vr:systemui`. Steam's finished `forwards` fills (`ItemFocusAnim-*`) are allowed (PLAN §1.5, CTL C13).

Storyboard: `p2_window-nav_motion.png`, C1c's interactions (menu morph-open, alert present, sheet present, sheet dismiss, route change) sampled at the G-MOTION points f = 0, .15, .35, .5, .75, 1 (PLAN §2.3 P10 `motion`). The search sheet and the toast are filmed by C1b and C3a.

---

## 8. Materials, the native gate and degraded glass

### 8.1 Summary

| Element | T5 (glassd) | T1 (CSS) | Edge |
|---|---|---|---|
| Window (`window`, `window-full` modes) | `window` cover, shape = the glass rect from `data-lgs-glass` | Smoky tint + edge (§8.4) | Specular arc + lobe .78, dark inner edge 16 px .20 |
| Windowless routes | No window cover; **plates** (`data-lgs-plate`, P9 G1) | CSS plates: black .58 + white .16 → .04 gradient + edges | Plate edges |
| Tab bar capsules | `liquid` covers on the popup's panel | Panel tint `rgb(28 30 40 / .78)` + edge | Arc + lobe ×1.10, dark edge 6 px .12 |
| Bottom ornament (capsule) | `liquid` slab behind (inset); none for the quiet legend | Backdrop blur 12 + saturate 1.7 | Liquid |
| More circle | None of its own: it rides its host (the focused card's crop, or 0 on rows) | Clear: black .38 + 10 px blur (PLAN §1.3) | None (clear material over content) |
| Search field, platters | Fills on glass | Black .30 well / black .14 platter | None |
| Menus, alerts, sheets, search sheet | `thick` slab under the pop (a flat `thick` plate when kept flat) | Blur 30 + tint .30–.40; no element inside the search sheet has its own `backdrop-filter` (P-45) | Arc + lobe .85, dark edge 12 px .20, shadow by depth |
| Toasts, hint, window-bar row | `panel` covers | Panel tint + edge | Arc + lobe .90 |
| Tooltips (in-window, bar, frame controls) | `thick` (PLAN §1.13); the bar's `tooltip` host gets a `thick` cover once P6 reports that surface | Thick tint .80 + edge | Arc + lobe .85 |
| Window bar | — | White .46 | Soft shadow |

Every "rim" above is the E3 arc with gaps plus the lobe of §8.2, never a closed ring: nowhere is there a border, an outline or a 1 px ring (VP P-42, PLAN §1.6). Thickness θ is computed from the **shorter** side in glassd and in the CSS fallback (GM §1.7). Glass luminance stays in L 55–110, and 70–90 under text. Native-mode CSS (P6's `theme/05-native.css`) drops the shell's CSS glass only where the daemon has acknowledged a cover, plate or pop; anything not acknowledged keeps its CSS glass.

### 8.2 Edges are light, not lines

The kit and the theme draw E3 (DESIGN2 §6.2) as a conic arc plus a faint linear top layer. On wide slabs that linear layer became a uniform 2 px line about +100 L across the whole top of the Power menu and the ornament (critique). The shell replaces it with a **lobe**: a radial highlight centred at 26 % of the width, peak .18 × rim, fading to nothing by 75 % of the width and down the sides; the conic arc keeps its gaps on both sides.

Measured with `window-nav-measure.py edge` (brightest quarter of the top edge vs darkest quarter, dL over the glass 10 px inside):

| Slab | Segments, left → right | Ratio darkest / brightest |
|---|---|---|
| Window (anatomy) | 45, 61, 80, 82, 43, 17, 1, −3 | 0.00 |
| Ornament (anatomy) | 31, 40, 45, 77, 25, 14, 0, −1 | 0.00 |
| Power menu | 69, 86, 99, 92, 61, 34, 18, 7 | 0.13 |
| Sort menu | 78, 97, 108, 87, 57, 32, 17, 7 | 0.12 |
| Search sheet | 59, 79, 101, 99, 55, 24, 5, −1 | 0.02 |

AT-23 requires ratio ≤ 0.35 on the device, and AT-20 the same profile in an `hvgrab` frame for glassd's rim. glassd draws GM v2's crescent the same way: bright where the edge faces the light, near zero on the sides and bottom (native-e2e §2, GM v2). The revision 3 renders are re-measured in §13 (AT-23 row).

The CSS for every glass the shell owns (`window-nav-shared.css` carries the mockup version):

```css
.lgs-edge::before {               /* E3 without a closing ring and without a full-width line */
  background:
    conic-gradient(from 340deg, rgb(255 255 255 / calc(.62 * var(--rim))) 0deg, rgb(255 255 255 / calc(.20 * var(--rim))) 38deg,
      transparent 72deg, transparent 148deg, rgb(255 255 255 / calc(.16 * var(--rim))) 180deg, transparent 214deg,
      transparent 288deg, rgb(255 255 255 / calc(.22 * var(--rim))) 322deg, rgb(255 255 255 / calc(.62 * var(--rim))) 360deg),
    radial-gradient(70% 120% at 26% 0%, rgb(255 255 255 / calc(.18 * var(--rim))) 0, rgb(255 255 255 / calc(.06 * var(--rim))) 46%, transparent 75%);
  /* + DESIGN2 §6.2's padding / mask-composite ring */
}
```

### 8.3 The native gate: when real glass is the default

**Owner: V1** (PLAN §4.3, checks AT-0a to AT-0f, decision S1 with the flag `native`, default `auto`). This section is the shell's input to it; C1a keeps AT-0b (the pointer proxy).

The user's brief requires full glass, which only glassd (T5) can draw over the room. NATIVE.md keeps the native layer off by default "until a wearer has checked input, the cursor dot and window resizing". The user is unavailable, so each wearer check is replaced with an agent check:

| Wearer check (NATIVE.md) | Agent check | Pass |
|---|---|---|
| Laser input reaches Steam through non-interactive layers | `DumpLaserOverlays` with `lgs on --native`: every glassd cover, slab and base piece is under `skippingDueToNonInteractivity`; the main, `frame.menu` and bar panels are laser targets with unchanged `fWidth`/`fHeight` (spatial.md §2.1: non-interactive panels are passed through [PROVEN]) | All listed |
| The cursor dot is visible | The pointer proxy (§3.6): AT-0b | Ring found in CDP shots and in the `hvgrab` frame over the cover |
| Resized windows stay aligned | This device already runs at r = 0.863: an `hvgrab` frame shows cover edges and crop edges registered with Steam's content | Misregistration ≤ 3 view px; no mosaic hairlines |
| Cost | `glassd` GPU and the compositor frame time (NATIVE.md's cost measure) | glassd median ≤ 2.5 ms (PLAN AT-0c, P9 G6); compositor frame time within 5 % |

The cover flags NATIVE.md documents for the dot (`{"all": {"sort-depth-bias": -0.5}}`, then `{"cover": {"no-depth-test": true}, "base": {"no-depth-write": true}}`) are tried in AT-0c in that order; each must leave the `hvgrab` look unchanged (they cannot be judged further without a laser). The first that renders identically stays on: if SteamVR's dot is drawn in front because of it, it coincides with the proxy ring.

**Decision** (V1, PLAN §4.3). If AT-0a to AT-0f pass, V1 sets `native: on` in `device/defaults.json`; `lgs on` and the "+" toggle then start native mode, and nothing survives `lgs off`, a Steam restart or a reboot. The remaining wearer-only items (comfort of depths, a real click on popped crops) do not block it, because the default depths use only non-interactive pops (§3.7). If any check fails, Phase 2 ships CSS-only with the degraded spec below, and the report says so.

### 8.4 Degraded glass (native layer off)

What T1 can and cannot do: CSS cannot see the room, so it cannot frost or lens it. It can draw the material's other cues.

| Element | Degraded look |
|---|---|
| Window | `rgb(20 22 30 / .74)` (the dial .60–.84; never above .84, VP P-87) + a vertical sheen (white .08 → 0 over the top 30 %) + the §8.2 edge lobe + dark inner edge 16 px .20 + depth shadow; radius 54 |
| Windowless plates | Black .58 with a white .16 → .04 gradient + edge cues (HA §10.5); labels keep the on-room shadow |
| Ornament | Over the window content: in-page blur 12 + saturate 1.7 (it frosts Steam's own content); outside the window: tint .70 + edge |
| Tab bar, toasts, hint, window-bar row | Panel tint `rgb(28 30 40 / .78)` + edge |
| Tooltips | Thick tint .80 + edge |
| Menus, alerts, sheets, search sheet | In-page blur 30 over Steam's content (works in T1) + tint .40 + edge + shadow; no element inside the search sheet has its own `backdrop-filter` (P-45) |
| Depth | None (no crops); shadows only |
| Pointer proxy | None: SteamVR's own dot shows on Steam's panel |

Shot: `p2_window-nav_anatomy_t1.png`. It is honest tinted glass with light-from-above edges, not Liquid Glass of the room, and the reports say so (PLAN §1.6).

---

## 9. Function retention table

Every function in `audit/shell-nav.md` §A, and every function from the other audits that these surfaces present, with its new place and both paths. "Same" means the path is unchanged. Nothing is removed. The **Owner** column is the package that keeps the function working (PLAN §1.1, §2.4); **Test** names the acceptance test (§13, or the owner's concept) that proves it, or the static check for actions tests never perform (PLAN §4.5). `glass.py ledger` reads these tables.

### 9.1 Header and search

| # | Function | New place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| H1 | Go back (history) | Back circle (80 × 80 hit) at (24, 24) on every route; previous title after 0.6 s | Click | B (same); "Back" legend (quiet member) | T1 (+T2) | C1a | AT-5, AT-3 |
| H2 | Start a search | The field: 520 / 640 × 64 capsule, or a 60 px magnifier circle on the routes of PLAN §1.9 | Click (DOM focus → the sheet) | D-pad Up from a page's top row (same) | T1 (C1a) + T2 + T3 | C1a (field), C1b (trigger) | AT-9a, AT-9b |
| H3 | Type / edit the query | Steam's VR keyboard with the echo row (C4b) | Click keys | D-pad + A (same) | T1–T3 | C4b | AT-10 |
| H4 | Clear the query | The × as a 44 px mini circle inside the field (E-MINI) | Click | Backspace on the keyboard (same) | T1 | C1a (field), C1b | AT-3, C1b-1 |
| H5 | Title mode | Centred Title 2 | — | — | T1 | C1a | AT-3 |
| H6 | Browser mode URL bar | 640 × 64 capsule | Click (same) | Focus + A (same) | T1 | C1a | AT-4 (on the first reachable Store web view) |
| H7 | Account / support alert | 60 px circle top-right | Click (same) | Focus + A (same) | T1 | C1a | AT-4 (static: Steam's node and handler unchanged; only with active alerts) |
| S1 | Switch result category (All, Library, Friends, Store, Tools, Hidden, with counts) | The scope bar in the sheet; Steam's ‹ › as 60 px circles | Click a segment or ‹ › | LB / RB (same); or Up to the bar, Left / Right + A | T3 (All), T1 (Steam's tab row) | C1b | AT-9d, AT-9e |
| S2 | Open a result (game → its page, friend → profile, store item → store page) | All: Top Hit, posters, store cards, friend circles; categories: Steam's grid tiles | Click | D-pad + A | T3, T1 | C1b | G-PAD, HA AT-13 (store cards are never activated in tests) |
| S3 | "View more in the Store" (store search) | Steam's Store tab in the sheet, its last tile unchanged; reached from See All or the Store segment | Click See All, then the tile | Focus + A | T1 / T3 | C1b | AT-9d (look only) |
| S4 | Leave search | The Back circle, the dimmed page, any tab | Click | B (same) | T1, T3 | C1b | AT-9c |
| LA S4 | No results | "No Results Found" + the query echoed | Look | Look | T1 + T3 | C1b | AT-9e |
| S-T | See Friends, Tools, Hidden and Store results from All | Scope segments with Steam's counts; a section per category on All; or Steam's All grid without Q6 | Click | D-pad + A | T3 / T1 | C1b | AT-9e |
| — | Empty query lists everything | Zero state "See All" | Click | Focus + A | T3 | C1b | G-PAD |
| NEW-1 | Reopen a recent game | Recent Games discs | Click | Focus + A | T3 | C1b | G-PAD |
| NEW-2 | Repeat a recent search (session memory) | Recent Searches capsules | Click | Focus + A | T3 | C1b | C1b-6 |
| S-A | Find a program; a program as the Top Hit | Top Hit card (program), Open | Click | A | T3 (C2a provider) | C1b, C2a (provider) | HA AT-13 |
| S-B | Launch a matching program; reach more matches | The Software cell; "and N more" → Home › Apps with it focused | Click | Focus + A | T3 (C2a provider) | C1b, C2a (provider) | HA AT-13 |
| S-C | Play a library result | "Play" in the ornament (frozen target); the More circle → Steam's menu → Play | Click | X (Steam's primary action) | T3 | C1b, C2a (provider) | HA AT-13 |
| L8 (search) | A result's item menu (Steam's tile menu) | The More circle inside the attended card; "Options · <target>" in the ornament | Click | ☰ | T2 (C1a helper) | C1a (helper), C1b (registration), C1c (menu) | WN AT-26 on `/search` |
| — | Focus returns to the poster you left | Steam's focus history under `NavigateBack` | — | B | — | C1b | AT-9c |

H2–H4 and the S rows are C1b's (`docs/phase2/wp/C1b.md`, complete for `audit/shell-nav.md` A.1 H2–H4, A.2 S1–S4, `audit/library-apps.md` A.7 and HA §12.6); H1 and H5–H7 are C1a's.

### 9.2 Navigation (`frame.menu`)

| # | Function | New place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| N1 | See the menu and the current section | Tab bar (always visible behind `tabBarAlways`; until then laser-visible) + Large Title; current route = .18 circle with its arc | Look | Look | T1, T2, T3/T4 | C1a | AT-7, AT-8b, AT-20 |
| N2 | Go to Home, Library, Store, Friends & Chat, Media, Downloads, **Console**, Steam Settings, Help (setup), VR Settings | Tab-bar circles (live pitch) | Click (same) | D-pad Left at the page edge → Up/Down + A; Right/B back (same) | T1 + T2 | C1a | AT-8, AT-4 (`audit frame.menu`) |
| N3 | Open the menu from anywhere | Same | — | B at the window root (same) | — | C1a | AT-8 |
| N4 | Same items via the bar's Steam tab menu | Unchanged (control-center concept) | Hover (same) | Bar focus (same) | — | C3a | CC A3–A6 |
| N-P | Power | System capsule › Power → Power menu (§5.2) | Click | Focus + A | T1 | C1a (tab), C1c (menu) | AT-11b (POWER, look only) |
| SY A.1.1 | Reach Steam Settings | Tab bar › Steam Settings | Click | As N2 | T1 | C1a | AT-8 |
| SY A.2 | Reach SteamVR Settings (laser-only page) | Tab bar › VR Settings | Click | As N2 (the page stays laser-only; settings concept) | T1 | C1a | AT-4 (static: Steam's handler, action 432800008) |

### 9.3 Ornament, legends and hints

| # | Function | New place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| F1 | Perform the focused element's actions (X, Y, ☰, A, B) | Ornament members: real buttons, label first, glyph badge trailing in gamepad mode | Click (same handler); Options acts on the frozen target | The physical button (same) | T1 + T2 | C1a | AT-6, AT-24, AT-25, PLAN-1a-1 |
| F1-A/B | A Select / B Back legends | Quiet trailing members in **both** modes (labels only in laser mode); never hidden; alone they form the quiet legend (on the dim band in a `window` route's margin) | Click the legend (same); also a direct click on the element (Select) and the Back circle (Back) | A / B (same) | T1 | C1a | AT-24, AT-29, PLAN-1a-1 |
| L6 | Sort (10 options), laser-mode pill | Ornament slot 1: sort glyph + "<current sort>" (library slot 1, 300 px) | Click | Y (legend "Sort By") | T1 | C1a (slot), C2c (library slots) | AT-24; PLAN-2c-1 |
| L7 | Filter, laser-mode pill | Ornament slot 1: "Filter" (library slot 2, 130 px) | Click | X | T1 | C1a, C2c | AT-24; PLAN-2c-1 |
| L8 / LA A.3 | A tile's menu (Play/Install, Favorites, Add To ›, Manage ›, **Developer ›**, Properties, Cancel) | More circle inside the card; the ornament's Options member (library slot 3, no suffix: the More circle marks the frozen target; "Options · <target>" on routes without fixed slots); the compact slab (6 or 7 items) | Click the More circle, or Options (frozen target) | ☰ then D-pad + A | T1 + T2 | C1a (helper), C2c (registration), C1c (menu) | AT-25, AT-26, AT-11b |
| SM D6 | Downloads item Options (Uninstall first, Remove, View in Library, Favorites, Add To ›, Manage ›, Developer ›, Properties) | More circle on the row; ornament Options; 8 items → two columns, Uninstall red at rest | Click | ☰ | T1 + T2 | C7 (registration), C1a, C1c | AT-26; SM F-DL |
| SM A.10 | Legend-only groups (friend menu, media Filter, Select Game, Delete Clip, Change Device, store menu, Add to Cart) | Ornament members (labelled) or the More circle on the row | Click | The physical button (same) | T1 + T2 | C7, C1a | AT-27; SM G1–G9 |
| SY S12 | Settings explainer ("Y for more info") | Ornament "More Info" capsule (Y badge in gamepad mode) | Click | Y | T1 | C6a, C1a | AT-27; SET T-AUD |
| SY S13 | Storage row actions (Uninstall, Move Content) | Ornament members | Click | X / Y | T1 | C6a, C1a | AT-27; SET T-AUD |
| FF1 | Learn Cycle View and Laser Mouse | Full-brightness hint capsule | — (hint) | The shown buttons (same) | T1 | C3a (look), C1a (content) | AT-4 (`audit floatingfooter`) |

### 9.4 Modals, alerts, sheets

| # | Function | New place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| M1 | Confirm / cancel | 640 px alert centred on the glass; capsules in Steam's order (Primary blue; `.Destructive` and Power confirmations red with a #0d0e12 label); an outside click cancels (Steam's; §5.3 Dismissal) | Click | Left/Right + A; B (same) | T1 (+T2 tag) | C1c | AT-13 (Steam's handlers; never confirmed) |
| M2 | Single-button alert | One full-width 60 px capsule | Click | A / B | T1 | C1c | AT-13 (ALERT) |
| M3 | Text prompt | 64 px recessed field with the focus ring | Click → keyboard | Focus + A → keyboard (tests never type) | T1 | C1c | AT-13 (ZOO 'Text Prompt') |
| M4 | Scroll a long dialog | Sheet ≤ 488 tall on `window` routes; `ModalPosition` / `%{ScrollPanel}` scroll; content fades under the card's edge | Wheel / drag | D-pad (same; the FocusRing as P4's light plate) | T1 | C1c | AT-13 (ZOO 'Scroll Panel Test') |
| M5 | Header and footer during a modal | Toolbar contents .45, still clickable; tab bar darkened (`html.lgs-modal`); the ornament lit with the dialog's legends (capsule or quiet, §3.4) | Same | B to the dialog (same) | T1 + T2 | C1c (C1a chrome) | AT-13 |
| NEW-3 | Close a sheet with a visible control | 60 px close circle at (24, 24) in the card, dispatching Steam's click-outside cancel | Click | B | T2 | C1c | AT-13, C1c-3 |
| LA A.4 | Library Filters dialog | Sheet (content: C2c) | Click | D-pad + A; B | T1 | C1c (frame), C2c (content) | AT-13; PLAN-2c-2 |
| GP | Game-page modals (Exit game, Uninstall, …) | Alert or sheet by size; destructive ones flat | Same | Same | T1 | C1c | AT-13, PLAN-1c-1 |
| — | App-details overlay | Scrim .35, content on `sheet-in` | Same | Same | T1 | C1c | AT-13 |
| CC P9 | Confirm a Power action | Flat alert, red confirm capsule with a #0d0e12 label, Steam's default focus | Click (never in tests) | Left/Right + A; B | T1 + T2 | C1c (look), C3b (CC entry) | PLAN-1c-1, CC A13 |

### 9.5 Context menus, Power, dropdowns

| # | Function | New place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| C1 | Choose an item | Slab grown from its source; layout by count, no scroll up to 14 items | Click (the row under the laser lights; Steam's focus does not follow it) | D-pad + A (geometric in the grid if Steam declares no layout) | T1 + T2 | C1c | AT-11b, AT-12, C1c-1 |
| C2 | Open a submenu | Row with ›; Steam's submenu beside it; the open parent white | Click | A or Right (same) | T1 | C1c | AT-11b (SUBMENU) |
| C3 | Toggle a checked item | Row with the check in its leading slot | Click | A | T1 | C1c | AT-8c |
| C4 | Dismiss | Cancel, a 56 px quiet capsule (last); an outside click | Click | B (same) | T1 | C1c | AT-11, C1c-3 |
| C5 | Scroll a long menu | Value menus of ≥ 15 options: one scrolling column of two-line rows (560 × 520); settings routes > 8: C6a's list page | Wheel | D-pad | T1 | C1c, C6a | AT-11b |
| C6 | Open the menu of the thing I looked at | The More circle inside the card or row (C1a); the menu grows from it | Click | ☰ (same) | T2 | C1a, C1c | WN AT-26, AT-11 |
| SY A.5 | Power: Sleep, Shutdown, Restart Device, Restart Steam VR, Change Account, Sign Out, Restart Steam, Cancel | Two-group Power menu, 592 × 470; Steam's order and default focus; each item opens Steam's own confirmation or flow | Click | D-pad + A; B | T1 + T2 | C1c | CC A13, AT-11b, AT-12 (look only; never A) |
| CC P0 | Power from Control Center | The same menu, opened by CC's Power circle (CC closes first) | Click | Pad to CC, then A | T3 | C3b (entry), C1c (menu) | CC tests |
| GP A.3, A.4 | Manage menu, Play-from menu | Same slab, placed by GP §3.4's order | Click | D-pad + A | T1 + T2 | C1c, C5a | GP AT-MENU |
| SY S6 | Settings dropdown values | Same slab, right-aligned to the dropdown, the value checked; > 8 options: SET's list page | Click | A, Up/Down + A, B | T1 + T2 | C1c, C6a (list page) | SET T-MENU |
| LA sort | Sort By choices | Two-column slab grown up from the white Sort button | Click | Y → D-pad + A | T1 + T2 | C1c | AT-11b |
| SM D6 | Downloads item Options (8) | Two-column slab, Uninstall a red label at rest (≤ 2 destructive) | Click (More circle) | ☰ | T1 + T2 | C1c, C7 | AT-11b |

### 9.6 Toasts

| # | Function | New place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| T1 | Read a notification (toast) | 320 × 76 card at x 20, y 2 of the quad SteamVR places; click behaviour Steam's | Look / hover | Look | T1 | C3a | AT-18 |
| SY NO4 | Read a toast (system audit) | As T1 | Look / hover | Look | T1 | C3a | AT-18 |
| SY NO5 | SteamVR's own toasts | Same card language (theme/vr) | Look | Look | T1 | C3a | AT-18 |
| SY NO2 | Read the list | Quick Access › Notifications (control-center concept) | — | — | — | C3b | CC tests |

### 9.7 Page transitions

| # | Function | New place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| A.8 | Route changes gate input for ~800 ms | Exit 150 ms linear; enter on `page` (662 ms) after ≤ 40 ms with ± 16 px (T2 direction; 0 in T1), inside Steam's React timeouts; nothing blocks input | — | — | T1 (+T2) | C1c | AT-15, C1c-5 |
| LA tabs | Library and search tab content changes | ± 16 px + fade on `page` (replaces Steam's ± 40 % slide) | Click a tab | LB / RB | T1 | C1c | AT-15 |

### 9.8 SteamVR window chrome

| # | Function | New place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| W1 | Move the window | Window bar, in the window-bar row behind `winbarMove` (fallback and default until AT-17: under the bar) | Drag (same) | — (same) | T1 + T4 | C1a | AT-17 |
| W2 | Resize the window | Resize arc at the glass corner (fallback: panel corner) | Drag (same) | — (same) | T1 (T4 lift) | C1a | AT-17 |
| W3 | Show/hide the keyboard | Frame-control circle 1 (white when shown) | Click | D-pad Down → Left/Right → A (same) | T1 | C1a | AT-17 (look; never pressed) |
| W4 | Float in World / View in Theater | Circles 2–3 | Click | Same | T1 | C1a | AT-17 (look; never pressed) |
| W5 | More Options › Curvature, Dock Left/Right | Circle 4 → thick-glass popout | Click | Same (SteamVR focus) | T1 | C1a | AT-17 (static mock only) |
| W6 | Close (game frames) | Separate circle at the row's left | Click | Same | T1 | C1a | AT-17 (look; never pressed) |
| W7 | Tooltips | Capsule below the button | Hover | Focus | T1 (T4 flip) | C1a | AT-17 |
| W8 | Gamepad-mode pill | Tinted / quiet capsule | Click (enter variant) | — | T1 | C1a | AT-17 |
| W9 | Now Playing frame | Owner: game-pages concept | Same | Same | — | C5b | GP AT-NP |
| W10 | SteamVR Settings page | Via the tab bar (settings concept) | Same | — (as today) | — | C6b | SET T-VR |

### 9.9 Bar entries (owner: control-center concept)

B1–B12 of `audit/system.md` §A.3 stay on the bar (owner C3a); this concept changes none of them and relies only on View ("Cycle View") for gamepad access to the bar.

---

## 10. Implementation tiers and evidence

| Element | Tier | Owner, file | Evidence | Fallback |
|---|---|---|---|---|
| Window glass | T5 + T1 | C1a `theme/20-shell.css`, `theme/layers/20-shell.json` | Covers with `shapes` [PROVEN-P1]; the window cover renders (native-e2e). Native mode is the default only through V1's gate (PLAN §4.3) | Degraded spec §8.4 |
| Route glass modes (`data-lgs-glass`, `data-lgs-route`) | T2 + T1 | C1a `device/rt/20-shell.js` | Plain attribute writes on route change (P1's route hooks) | No attribute: `window` on every route |
| `BasicUiRoot` radius 54 | T1 | C1a | Paint property | 6 px clip under 54 px glass |
| Ornament margin (glass 656) | T1 | C1a | Keyed on `data-lgs-glass`; footer height measured by Steam | `window` everywhere |
| Toolbar row 108 px | T1 + T3 | C1a | `!important` var + `HeaderStore` write; CQ1 [UNPROVEN], AT-2; `html.lgs-hdr-108` / `lgs-hdr-40` | §3.2's three-rule fallback (page padding, scroll guard, modal padding) |
| Scroll guard | T1 | C1a (generic scrollers), each area (its own) | `scroll-padding` honoured by Steam's scroll-into-view [PROVEN, IM §7] | — |
| Back circle, Large Title, previous title | T1, T2 | C1a | Plain nodes; AT-5; E-BACK | Omit the decorations |
| Search field (capsule, circle) | T1 | C1a | Inventory shell §3; circle gated by AT-4 | The capsule |
| Search trigger + snapshot | T2 | C1b | `focusin` on Steam's input; `cloneNode` is plain DOM in Steam's document; focusables register through React context (steam-react §4), so clones are inert to the nav tree | Fallback 1 (§4.9) |
| Search sheet, zero state, All summary, providers | T3 | C1b | Route-render override [PROVEN, 19/19]; data stores §3.7; provider API (C1b, `docs/phase2/wp/C1b.md`); Q6 finder through `rt.react.find` [UNPROVEN] | All = Steam's All grid; fallback 2 |
| Steam's results page hosted in the sheet | T3 | C1b | `steamChildren` rendering [PROVEN]; in a smaller container [PLAUSIBLE], AT-9d | Full-window Steam page |
| Tab-bar shape, sizes, states | T1 | C1a (frame-menu rules move in from `30-bar.css`, PLAN §6) | Steam's component variables (bar.md §3) | — |
| Tab-bar live pitch | T2 + daemon | C1a, P8 (geometry publishing) | Variables written by the shell from P8's published `Hm`, r and the frame-menu panel height (spatial.md §1.2 snippet, `GetTransformForOverlayCoordinates`) | Fixed p 52 (fits r ≥ 0.86 in the worst case) |
| Tab bar always visible | T3/T4 | C1a `theme/popups/20-shell.json` via P6's wrapper | Flag honoured (E2); clearing it [PLAUSIBLE]; flag `tabBarAlways`, on after AT-7 | Laser-visible |
| Tab bar +15 mm | T4 | C1a `theme/popups/20-shell.json`, P7 | t1 translation [PROVEN]; side panel [PLAUSIBLE] | Steam's +10 mm |
| Bottom ornament + contract, capsule or quiet | T1 + T2 | C1a | `#Footer` restyle; `#Footer::before` free; `SortAndFilterContainer` absolute already; `data-lgs-btn` from the legends' React props | Two adjacent capsules, always the capsule material |
| Fixed ornament slots (`shell.ornamentSlots`) | T2 + T1 | C1a (API, backing), the area (its slot rules; C2c on library routes) | A registration keyed on `data-lgs-route`; the backing rect is written once per route | Measured backing (the width follows the members) |
| Quiet legend's dim band on `window` routes | T1 (+T2 tag) | C1a | Plain CSS on `#Footer[data-lgs-orn="quiet"]` under `[data-lgs-glass="window"]`; flag `quietBacking` | Without T2 there is no quiet state: always the capsule |
| Input-mode signals | T2 | P3 (`04-input.js`); the shell reads `__LGS_RT.input` | Both signals readable and subscribable [PROVEN, IM D-1] | Gamepad-mode layout always |
| Frozen target | T2 | C1a, fed by P3's attention (`05-attention.js`) | `pointerdown`/dwell; `BTakeFocus(3)` (used by the lab) | Today's behaviour (legend acts on current focus); the More circle still works |
| More circle | T2 | C1a `device/rt/20-more.js` | The host's `onMenuButton` from fiber props (SM-D15); fallback `vgp_onmenu` [PROVEN dispatch, inventory library §0.3] | Ornament Options |
| Glyph badges by mode | T1 | C1a | Keyed on `data-lgs-vr-mode` | Badges always shown |
| Pointer proxy (native mode only) | T2 | C1a `device/rt/20-pointer.js` | A fixed node moved on `pointermove`; CDP-verifiable (AT-0b) | — |
| Window-bar row moves | T4 | C1a `theme/sg/20-winbar.json`, P7 | Transform overrides on SteamVR's own panels [PLAUSIBLE]: E4/E5b show laser targets following; flag `winbarMove`, on after AT-17 | SteamVR's positions |
| Frame controls, More Options, pill, window bar, resize arc | T1 (`theme/vr/10-systemui.css`) | C1a | E16 [PROVEN] | — |
| Menu slab, rows, tones | T1 | C1c | Inventory shell §7 | — |
| Count-based menu layouts | T2 class + T1 CSS | C1c | `GetLayout` reads CSS (game-pages §0.5); AT-11b, AT-12 | One column with Steam's scroll |
| Menu anchoring | T2 + T1 `translate` | C1c | Plain CSS on the modal child; gated on AT-11, GP AT-MENU, SET CQ10 | Centred, still morphing from its source |
| Menu morph | T1 + T2 | C1c | MO §6.4 (clip-path ≤ 600 × 600) | Materialize |
| Depth of menus, alerts, sheets | T4 | C1c `theme/layers/22-presentations.json` | Non-interactive pops render [PROVEN]; pass-through [PROVEN] | Flat + shadow |
| Interactive pops (+30/+50) | T4 | P6, P7 | Registration [PROVEN], click [PLAUSIBLE] | Wearer profile only (`interactivePops`, S2) |
| Window dim under alerts and sheets | T1 | C1c | Steam's `.ModalOverlayBackground` restyled to black .35 | — |
| Toast | T1 | C3a | hud.md §4 | Steam's motion |
| Route transitions | T1 (+T2) | C1c | MO §6.4; AT-15 (CQ6) | Steam's timing |

**Removal.** `lgs off` restores everything; a Steam restart or reboot gives the stock UI (PLAN §1.17, G-REMOVE): `data-lgs-glass`, `data-lgs-route`, `lgs-hdr-*` and the header writes removed (`HeaderStore` restored); the T3 override removed (`patchedLeft: 0`); `data-lgs-orn`, `data-lgs-orn-fixed` and the registered slots dropped; the popup wrapper and the frame-menu flag restored; every transform override (tab bar, frame controls, grab handle, tooltips, resize corner) restored, each with a TTL in the page as a safety net (spatial.md §9.5); T2 nodes, listeners, the snapshot, the pointer proxy, the More circle, the Options member and the `data-lgs-btn` / `data-lgs-orn` tags removed; the recent-search list dropped; `--lgs-tab-pitch` removed. Runtime state lives only under `/tmp/lgs` and `/dev/shm/lgs`.

---

## 11. Decisions (PLAN §1.17) and open questions

The user cannot be asked. Every question revision 2 left open is now decided by PLAN §1.17, with a safe default and, where useful, a runtime flag (defaults in V1's `device/defaults.json`, session overrides in `/tmp/lgs/flags.json`).

| # | Question | Decision (PLAN) | Default | Flag |
|---|---|---|---|---|
| Q1 | CQ1: does the 108 px header (var + `HeaderStore`) hold? | **Settled, no** (AT-2, build 11094443): `#header` and the page layout stay at 40 whatever the variable and the store say. The fallback ships; areas pad with `--lgs-hdr-pad` | `lgs-hdr-40` | `hdr108` (trial only) |
| Q2 | Overriding Steam's route, card and context-menu entrance animations | S3: adopted, within Steam's timeouts | On | — |
| Q3 | Power default focus | S6: Steam's, unchanged (also for alerts) | Steam's | — |
| Q4 | Sheet push-back variant (window −50 mm) | S7: off; the sheet comes forward | Off | `sheetRecede` |
| Q5 | Frame-height override 1.6 | S8: off (it changes the user's window size) | Off | `frameHeight` |
| Q6 | A finder for Steam's search hook (the All summary) | Open; owner C1b at M3 | All = Steam's All grid | — |
| Q7 | CQ3: always-visible tab bar | S9: on once AT-7 passes | On (gated) | `tabBarAlways` |
| Q8 | Steam's "Back" text shown as the chevron | S4: adopted, exemption E-BACK | On | — |
| Q10 | T4 moves of SteamVR panels (frame controls, grab handle, tooltips, resize corner) | S10: on once AT-17 passes | On (gated) | `winbarMove` |
| Q11 | Ornament pop with an occluder | S11: off | Off | — |
| Q12 | Interactive pops (+30 / +50 mm) | S2: built, off until one wearer session | Off | `interactivePops` |
| Q13 | Hiding A/B (and duplicate X/Y) legends in laser mode | S5: **rejected**; legends are never hidden; A and B are quiet members in both modes (§3.4) | — | — |
| Q14 | Native layer default-on | S1: on when V1's native gate passes | `auto` | `native` |
| — | More circle on every host | S14: on | On | — |
| — | Pointer proxy | S16: native mode only | `native` | `pointerProxy` |
| — | Power as a two-column grid | S24: adopted | On | — |
| — | Laser dwell before lift (80 ms) | S25: adopted | On | — |
| — | Quiet legend on `window` routes: a dim band behind the labels (§3.4.1) | C1a, under PLAN §1.17's rule: P-39 (a must) fails over a bright room without it | `"window"` | `quietBacking` (`"window"` \| `"off"`) |

Still open, recorded for the coordinator (C1a's evidence log carries the detail):

| # | Item | Default meanwhile |
|---|---|---|
| O1 | PLAN §1.2's table puts achievements in `window`, while its note calls SM's quiet-legend routes (SM lists achievements among them) `window-full` | The table: achievements are `window` (§3.1.1); C5a may ask for `window-full` |
| O2 | VP P-23 states its bottom bound as 620 (= 636 − 16); amendment A1 moved the ornament to 628 | The guard uses 612 (§3.2); V2 is asked to score P-23 at 612 |
| O3 | PLAN §1.10's quiet look (no material, labels white .70) fails P-39 in the margin of `window` routes over a bright room | The dim band behind the labels and white .82, flag `quietBacking` (§3.4.1) |
| O4 | PLAN §1.7: "the source card keeps +15 if it was the focused card" vs admission rule 6 (only the modal pops while one is open); raised by C2c (REQ-7) | P6's reporter applies rule 6: the source drops to 0 with the CSS glow (§3.7) |

Revision 1's Q9 (Power as a grid) is closed by S24.

---

## 12. Deviations from DESIGN2 (and why)

PLAN §1.18 folds most of these into DESIGN2 (amendments A1–A13, applied by P4). The **Status** column says which remain deviations.

| # | DESIGN2 (before the amendments) | Here | Reason | Status |
|---|---|---|---|---|
| D-1 | Glass 1280 × 664, ornament 636–720 | Glass 656, ornament 628–712 | SteamVR's window-bar row sits 19 px below the panel; DESIGN2 §4 asks ≥ 24 px clearance | DESIGN2 A1 |
| D-2 | Tab-bar items 56 at 72 popup px pitch; ≥ 72 main px for fixed quads | Live pitch: 58 (r = 1, Console on), floor 52 | 10 destinations; 72 would need 764 popup px against 653 available | DESIGN2 A8; exemption E-TAB |
| D-3 | Title at x 40 | x 100 | Back is on every route | DESIGN2 A1 |
| D-4 | Search width min(640, 50 %) | 520 on section roots, 640 elsewhere, or a 60 px circle | Room for the Large Title | DESIGN2 A1 |
| D-5 | Menu header 56 px; rows 72 | 40 px header; compact menus 60/64 with an inline 26 px label; grid menus for ≥ 8 | The 520 px box; no menu scrolls | DESIGN2 A6; exemption E-MENU |
| D-6 | Tab bar expands over content | Outward | Steam right-aligns the popup | Remains |
| D-7 | Ornament +25 mm | 0 | Ghost rule (native-e2e §1) | DESIGN2 A3 |
| D-8 | Search capsule with a microphone | None | Steam has no dictation | DESIGN2 A1 |
| D-9 | Frame-control circles 64–80 systemui px | 80 visible, 107 hit | 107 systemui px = 60 pt | Remains |
| D-10 | Selected tab: white .18 platter | The navigation selection (.18 + arc + Semibold) drawn as a **circle** behind the glyph, never a pill; focus = a pill | Focus and selection must differ in shape as well as light (G-FOCUS) | Value: DESIGN2 A5. Shape: remains |
| D-11 | Gamepad focus + .14 | + .28 (tuning .28–.32) everywhere | Focus must stand out from selection | DESIGN2 A5 (revision 2's + .30 is replaced by P4's token) |
| D-12 | Menus +30, sheets +30 → +50 (interactive crops) | +10 non-interactive; the larger depths in the wearer profile | Only proven mechanisms by default | DESIGN2 A3 |
| D-13 | Bar centred on the glass | Centred on the glass when it fits; otherwise spans the panel and ends level with the ornament | Ten destinations do not fit the glass | Remains |
| D-14 | Grab pill under the dashboard bar | In the window-bar row under the window | visionOS order; one row instead of two | Remains (behind `winbarMove`) |
| D-15 | E3 with a faint linear top layer | A radial lobe | The linear layer read as a full-width line on wide slabs | DESIGN2 A4 |
| D-16 | Destructive: red label at rest | Red label when ≤ 2 destructive rows; red glyph + white label when more | A wall of red carries no signal (Power) | DESIGN2 A6 |
| D-17 | Search sheet (DESIGN2 §7.5) hands off to Steam's route on typing | The whole search stays in the sheet; Steam's route underneath | Context stays visible; results never replace the page visually | Remains (PLAN §1.9 adopts it) |
| D-18 | Sheets ≤ 75 % of the glass (960) | The results sheet is 960 wide, not revision 2's 1040 | PLAN §1.12 | DESIGN2 §3.7 (conforms) |
| D-19 | Search sheet rows of 64 px (DESIGN2 §7.5) | The zero state uses Home's 120 px discs and 60 px capsules; results use posters and cards (content) | One vocabulary with Home and the library (PLAN §1.3) | Remains (C1b) |
| D-20 | Revision 2's column of category capsules (54 px on a 58 px pitch) | The scope bar's counts and Steam's own section headers | PLAN §1.3 sizes; Steam's strings (§1.15) | Withdrawn element (C1b) |

Known deviations from the visionOS conformance checklist, recorded in PLAN §4.4: **P-11** (the pointer proxy draws a cursor in native mode, §3.6) and **P-37** (the tab bar's second capsule, §3.3.6).

---

## 13. Acceptance tests (agents only, no wearer)

All Steam steps use LAB's locked atomic forms (`shot`/`audit`/`outline` with `--route`/`--pre`) and P10's options: `--flags a,b` turns flags on for the locked step only (the runtime flag `wp.c1a`, and `tabBarAlways`, `winbarMove`, `pointerProxy`, `quietBacking` where a test needs them), `--mode laser|pad` sets P3's input stub (never Steam's getter), and native steps run inside `glass.py native-session`. Steps never press A on Steam's nodes (exception: AT-9b presses A on the header search field only, which raises the keyboard; the keyboard is hidden again with `SteamClient.OpenVR.Keyboard.Hide()` in the same step), never confirm, launch, change a setting or touch power items. Gamepad sequences first call `SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.FocusApplicationRoot()` (steam-react §4). After a synthetic hover, the pointer goes to (1400, 900). Synthetic menus and dialogs use `docs/inventory/shell.md` §0.2 (CONFIRM, ALERT, MENU, SUBMENU, POWER, ZOO). `hvgrab` frames are looked at and deleted. `M` = `python docs/phase2/concepts/window-nav-measure.py`.

The **Owner** column follows PLAN §2.4: C1a runs AT-0b, AT-1 to AT-8, AT-8b, AT-17, AT-20, AT-21 and AT-23 (C1a parts), AT-22, AT-24 to AT-29 and PLAN-1a-1 to -3; C1b, C1c, C3a and C4b run the rows marked with their ids (their logs hold the operative versions); V1 runs the native gate.

| # | Owner | Test | How | Pass |
|---|---|---|---|---|
| **AT-0a** | V1 (PLAN §4.3) | Native gate: pass-through | Lab lock (`lab.lock` + `lab-vr.lock`) in a native session; `OverlayStore.DumpLaserOverlays()` | Every glassd cover, plate, slab and base piece under `skippingDueToNonInteractivity`; main, `frame.menu`, bar targets present with sizes equal to CSS-only mode |
| **AT-0b** | C1a | Pointer proxy (native mode only) | In a native session, in `main`: dispatch `pointermove` at (x, y) on three points (a poster, a MENU row, an ornament member) and `shot main` each; then `pointerleave` and shot again; `M ring WITH WITHOUT x y` (×1.5 for shot px); `hvgrab` while the synthetic pointer sits on the poster. Then `on --css` and the same `pointermove` | Native: ring centroid within 2 px, peak ≥ 50 L, spread ≤ 12 px; in the `hvgrab` frame the ring is visible over the cover at the poster. CSS-only: no `.lgs-pointer` node in any document |
| **AT-0c** | V1 (PLAN §4.3) | Alignment, flags, cost | `hvgrab` at the current r (0.863); then the two flag sets of §8.3, each followed by `hvgrab`; NATIVE.md cost measure | Cover and crop edges within 3 view px of Steam's content; no hairlines; flags change nothing visible; glassd median ≤ 2.5 ms, compositor within 5 % |
| AT-1 | C1a | Tokens | `python glass.py status` | 0 unresolved tokens |
| AT-2 | C1a | Header height (CQ1), classes and the scroll guard | `--pre` AllGames: computed `--basicui-header-height`, `HeaderStore.m_flCurrentHeaderHeight`, the `lgs-hdr-*` class on every main document; 6× `L.pad('down')` and 6× `L.pad('up')` recording the `.gpfocus` rect; then CONFIRM and MENU: read `ModalPosition` and the menu slab's top. Repeat with the CQ1 fallback forced (test hook) | Exactly one of `lgs-hdr-108` (header 108 / 108) or `lgs-hdr-40` (header 40, fallback rules active); every focused rect top ≥ 124 and bottom ≤ 612 (VP P-23 with A1's ornament); modal and menu tops ≥ 108 in both cases |
| AT-3 | C1a | Toolbar geometry | `styles` on `%{BackContainer}`, `%{SearchAndTitleContainer}`, `%{SearchBox}` on AllGames (capsule 520), `/library/downloads` (520), a collection (640), the search route (640), a game page, `/settings/system`, `/account` (circle), `/controller/calibration/0` (title mode); with text in the field, the clear button | Back 80 × 80 at (14, 14), 60 circle at (24, 24) on every route; capsule 536 × 80 (656 nested); circle 60 in an 80 × 80 box at (1186, 14); upright 24 px placeholder; title mode centred; clear 44 with no other target within 80 px (E-MINI) |
| AT-4 | C1a | Function audit | `python glass.py audit main --mode laser` and `--mode pad` on Home, AllGames, a game page, `/library/downloads`, `/settings/system`, `/account`, `/controller/calibration/0`, CONFIRM, MENU, POWER (look only); `audit frame.menu.<id>`; `audit floatingfooter` | GONE / HIDDEN / UNCLICKABLE = 0 except E-BACK (the Back label), E-TAB (tab-bar pitch ≥ 52 popup px) and E-MINI; **no legend HIDDEN in either mode**; SHRUNK only where the new hit is ≥ 80 px |
| AT-5 | C1a | Back click | `L.nav` Home → AllGames → `L.click('main','%{BackContainer}')` | `/library/home` |
| AT-6 | C1a | Ornament geometry | On AllGames: rects of `#Footer`, `%{FooterLegend}`, legends; `--gamepadui-current-footer-height`; `data-lgs-orn`; `L.click` on the Back legend (gamepad mode) | Footer 92; capsule 84 at y 628; with C2c's `ornamentSlots('library')` registered: x 200–1080 (880 ± 1) and `data-lgs-orn-fixed="library"`, in both modes; without it: centred ± 1, ≤ 960 wide; members 60; var 92px; `data-lgs-orn="capsule"`; Back navigates back |
| AT-7 | C1a | Tab-bar geometry, live | `--flags tabBarAlways`. In `vr:systemui`: `Hm`, r, and the `frame.menu` overlay's world height from `GetTransformForOverlayCoordinates`; compute `mp`, G, P and the rule's p; then `styles frame.menu.<id> "%{DashboardMenu>Item}"` and `DumpLaserOverlays` | Item rows = p popup px (58 at r = 1 with 10 items); the computed p matches §3.3.2 for the measured r; bar inside the panel (rule 2) or the glass (rule 1); Console present; `only_visible_with_laser: false`; records whether the popup follows the resize. V1 turns `tabBarAlways` on in `defaults.json` only after this passes |
| AT-8 | C1a | Gamepad into and out of the tab bar | `FocusApplicationRoot`; focus the first poster; `L.pad('left')`; `L.focused()`; `L.pad('down',2)`; `L.pad('right')`; then at the window root B (`DispatchVirtualButtonClick(2)`) | Focus in `frame.menu`, not `%{DashboardMenu>Collapsed}`; two items down; back in `main`; B at the root puts focus in the bar (N3) |
| **AT-8b** = PLAN-1a-2 | C1a | G-FOCUS on the tab bar | `--route /library/downloads --mode pad`; gamepad focus into the bar and onto Store; `shot frame.menu.<id>`; `glass.py focus` (P10) with the pairs rest (Media), focused (Store pill), current route (Downloads circle); a laser-mode shot with a CDP hover on Media for the hovered state; the first frame by the P10 filmstrip | Focus ≥ rest + 40 L; focus ≥ current-route circle + 15 L; current-route circle ≥ hovered + 12 L; first frame ≥ 60 % of the final contrast; the shapes differ (pill vs circle). Mockup values in §13.1 |
| AT-8c | C1c | Focus vs checked (menus) | MENU pre with a CheckItem (checked) and focus on the next row, `--mode pad`; `glass.py focus` pairs | Focus ≥ checked + 15 L and ≥ rest + 40 L; the checked row has no fill; the check sits in the leading slot |
| **AT-9a** | C1b | Trigger, laser | `--mode laser`, route AllGames: `L.click('main','%{SearchBox}')`, then `focus()` on it; after 1.2 s read `L.route()`, `.lgs-snap`, `document.activeElement`, keyboard state; `shot main p2_c1b_at9a`; hide the keyboard; `L.back()` | Route `/search…`; the snapshot has 0 `[id]` and is `inert`; sheet rect 880 × 500 at (200, 100) ± 2; the field shows its ring; no glyph badge visible; records whether Steam navigated by itself |
| **AT-9b** | C1b | Trigger, gamepad | `--mode pad`; focus the first poster; `L.pad('up')` (A on the field only if it took focus without the sheet; then hide the keyboard) | The zero state appears on the real gamepad path; records Steam's own behaviour (resolves the shell.md / library.md disagreement) |
| **AT-9c** | C1b | Leaving restores context | After AT-9b: B (`DispatchVirtualButtonClick(2)`) while `.gpfocus` is inside the sheet; `L.route()`, `L.focused()` | Back on `/library/tab/AllGames`, focus on the same poster; no `.lgs-snap`, no sheet node |
| **AT-9d** | C1b | Steam's category page in the sheet | SEARCH('half','Library'); `outline main`; `L.pad('down', 3)`; LB, RB | `%{TabContentsScroll}` inside the sheet (≤ 960 wide); rows render (virtualised); focus moves; LB / RB switch categories. Otherwise the full-window fallback is active and recorded |
| **AT-9e** | C1b | Parity and no results | For 'half', 'a', 'zzqxjvkw': counts per category in our scope bar against Steam's own tab row (override off, same lock) | Equal for every category; every category with matches has a segment and, on All, a section or row; 'zzqxjvkw' shows "No Results Found" with the query echoed (P-62) |
| AT-10 | C4b (with C1b) | Echo | C4b's echo test (SM SQ4) with the sheet open | The echo shows the field's text and placeholder |
| AT-11 | C1c | Menu anchor and dismiss (gate R13) | MENU pre via `showContextMenu(menu, anchorEl)` with a known source; slab and source rects; a CDP click on `%{*…>ModalClickToDismiss}` outside the slab; then the same with `wp.c1c` off: `L.pad` order down/up through the items | Slab edge 16 ± 2 px from a card source (P-35: gap ≤ 40); ornament sources: left edges aligned (± 2), bottom ≤ 620; `m_rgModals.length` restored; the D-pad visits the same items in the same order with T2 on and off. Else: centred placement ships (still morphing) |
| AT-11b | C1c | Menus fit | MENU pre with 5, 6, 7, 8, 10, 14 and 15 items; the Sort snippet on AllGames (look only, then B); Downloads Options if an item exists (look only); POWER (look only) | The class matches the count table (≤ 5 none, 6–7 `lgs-menu-compact`, ≥ 8 `lgs-menu-grid`, ≥ 15 value options `lgs-menu-scroll`); `scrollHeight == clientHeight` up to 14; Cancel inside the slab; slab ≤ 520 tall and ≤ 600 wide; 15: one scroller of two-line rows in a 560 × 520 slab with the current value in view |
| AT-12 | C1c | Grid menus' D-pad and default focus | POWER and the Sort menu (look only): `contextMenuContents`'s nav node `m_Properties.layout`; `L.focused()` right after open, with `wp.c1c` on and off; `L.pad` down/right/up/left | Records GEOMETRIC or column; every item reachable; Cancel last; the item focused on open is the same with T2 on and off (S6). **Never press A** |
| AT-13 | C1c | Alerts and sheets | CONFIRM, ALERT, ZOO('Text Prompt'), ZOO('Scroll Panel Test'), `--mode pad` and `--mode laser`; `styles` on the scrim, `#header` children, buttons, card; `elementFromPoint` at the Back circle's centre; a CDP click on the sheet's close circle (lab dialog: no action) | Scrim black .35, no blur, painted only inside the glass shape (margin luma under the ornament = the no-modal shot ± 3 L); no `t1` tint node; header contents .45 and Back still hit; alert 640 wide, centre within 24 px of the glass centre; sheet ≤ 960 × 488 (window routes); buttons 60 px capsules in Steam's order, `DialogTwoColLayout` a row; text on red and green fills #0d0e12; the close circle closes the dialog (`m_rgModals.length` restored) |
| AT-14 | C1c | Depth (native) | Native session: `__LGS_SG.dump()` and `glass.py sgcheck` with MENU, CONFIRM, CONFIRM-D (below), ZOO sheet, each opened from a focused poster and from a hovered one; `glass.py sg_timeline`-style capture of the menu's dz | Menu, non-destructive alert and sheet crops at 10 mm ± 2 (live S × r), `interactive: false`; CONFIRM-D: no crop, a flat `thick` plate; every other in-page pop dropped while the modal is up, except a source card that was the gamepad-focused card (+15); ≤ 4 distinct dz (+1 for the modal); the menu's dz follows `depth` 0 → 10 within 0.5 mm; none above 15 mm unless `interactivePops` |
| AT-15 | C1c | Motion | `glass.py motion main --pre …` for: MENU open, CONFIRM open, ZOO sheet open and close, a route change (AllGames → a collection → back), a library tab change; `getAnimations()` after 1 s; route changes every 50 ms (CQ6) | Durations and easings are tokens (P-58); 0 running and no `lgs-*` 1 s after (§1.5); filmstrips `shots/p2_motion_c1c_<interaction>_<f>.png` at f = 0, .15, .35, .5, .75, 1 show glass before content on entry and content before glass on exit, no text scaling, no closed outline; animated depth ≤ 20 mm; clip-path only on ≤ 600 × 600; route enter ≤ 800 ms with delay, exit ≤ 200 ms |
| AT-16 | C1b | Performance | `glass.py perf main --route /library/tab/AllGames`; the same with a `--pre` that opens and closes the sheet 5× | Themed fps within 5 % of stock; no frames > 34 ms; the snapshot costs ≤ 1 long frame per activation |
| AT-17 | C1a | SteamVR chrome and T4 moves | `shot vr:systemui p2_c1a_chrome_*` (hover, focus, tooltip pre); `--flags winbarMove`: `DumpLaserOverlays` before and after the moves; `hvgrab` look | Frame-control panel grows with the DOM (E16); circles rest quiet (glyph ≤ .5 effective opacity, VP P-70) and full on hover or focus; after the moves the frame-control and grab-handle targets exist at the new positions with unchanged sizes; one row under the window in the `hvgrab` frame. Else the fallback positions, and `winbarMove` stays off |
| AT-18 (= CC A16) | C3a | Toast | Class-exact mock: `hud.md` §4.3 (b) in a tooltip host for the shot, (a) in the real `notifications` window for computed styles | Card 320 × 76 tp at x 20, y 2 of the quad (Steam's inset unchanged), radius 30; icon 48 circle (achievements: rounded square); title 20, body 18 (TwoLine: 2 × 18, card 80); no `outline` / `border` (P-42); `toastExitVR` still in the computed `animation-name`, our entry in place of `toastEnterVR`; no text < 16.2 tp; dark text on the green call fill |
| AT-19 | C1c | Accessibility | `--media reduce` and `--media contrast` on MENU, CONFIRM, a sheet and a route change | Reduce: opacity only, 150–200 ms, no scale, translate, clip-path or depth animation; glassd `reduceMotion: true`. Contrast: opaque glass with the 2 px edge. No Steam setting touched |
| AT-20 | C1a | Headset view | Native session with `--flags tabBarAlways`: `hvgrab` with the laser idle, MENU up, CONFIRM up, the ornament off-axis (`glass.py hv --offaxis`); look, then delete | Tab bar visible without the laser; no doubled ornament or tab bar; glass L 55–110; glassd rim profile as AT-23 |
| AT-21 (C1a part) | C1a | Type sizes, chrome | `styles` sweep over `#header`, `#Footer`, the More circle, the Options member, `frame.menu`, `floatingfooter` content | No `font-size` < 18 px; no weight < 500; no uppercase, tracking or italics |
| AT-21 (C1c part) | C1c | Type | `styles` sweep over menus (all count classes), Power, dialogs, sheets | No `font-size` < 18 px; no weight < 500; no uppercase, tracking or italics; red labels only at ≥ 22 px Semibold (P-40) |
| AT-22 | C1a | Removal | `lgs off`; `outline main`; `frame.menu` params; systemui transforms; `status` | Stock DOM; original route switch; flag restored; transforms restored; no `lgs` nodes, `data-lgs-*` attributes, `lgs-hdr-*` classes, snapshot, proxy or styles (G-REMOVE) |
| **AT-23** (C1a part) | C1a | No outline on the shell's glass | `shot main` on AllGames and `/settings/system`; `M edge SHOT y x0 x1` (or P10's `edge_profile.py`) on the window's top edge, the ornament capsule and the tab-bar capsules (`shot frame.menu.<id>`) | Ratio ≤ 0.35 on every slab; no border, outline or 1 px ring on any glass container (P-42). Mockup values in §13.1 |
| **AT-23** (C1c part) | C1c | No outline on glass | `shot main` with MENU, POWER, CONFIRM and a sheet up; `window-nav-measure.py edge` on each slab's top edge | Ratio ≤ 0.35 (mockups 0.00–0.22, E7); no border, outline or 1 px ring (P-42) |
| **AT-24** | C1a | Ornament modes | (a) `--mode pad` on AllGames: legends with trailing glyph badges, quiet A/B. (b) `--mode laser` (P3's stub sets `data-lgs-vr-mode="laser"` and `lgs-input-laser` without touching Steam's getters): mount a class-exact `%{SortAndFilterContainer}` mock (inventory library §6.1 DOM) in `main`, `shot main`; remove it. (c) `/settings/system` in both modes | (a), (b): capsule 84 at y 628, ≤ 960 wide (or compact members; 880 with the library's fixed slots); Sort and Filter in slot 1 in laser mode; **A and B present as quiet members in both modes**; glyph badges only in (a); no legend node with `display: none`, `visibility: hidden` or opacity < .5. (c): quiet legend (`data-lgs-orn="quiet"`) |
| **AT-25** | C1a | Frozen target and the Options member | (a) AllGames (fixed slots), `--mode laser`, CDP mouse moves: dwell 600 ms on poster A, 90 ms on poster B, then `pointerenter` on `#Footer`; read the Options member's label, `__LGS_RT.shell.target()`, `L.focused()` and the `.lgs-more` host; `L.click` on Options; read the MENU header; B. (b) The same on `/library/downloads` with two rows (`placement: 'row'`; a class-exact row mock if the queue is empty). (c) CONFIRM open over AllGames, `--mode laser`: `L.click` on Options; computed styles of slot 1, Options, A and B. (d) `--mode pad` on AllGames with focus on the tab row. Pointer to (1400, 900) after each | (a) Label "Options" with no suffix; the More circle stays on A while the pointer is in `#Footer`; the target is A; the menu is A's; records whether Steam rendered its own ≡ legend after the re-focus (and that the T2 member then stood aside). (b) Label "Options · <row A's name>"; the menu is row A's. (c) No dispatch (`m_rgModals.length` unchanged); slot 1 and Options under the .35 layer, A and B lit. (d) Options shown disabled in slot 3 |
| **AT-26** | C1a | More circle | `--mode laser`: dwell on poster A 400 ms → the circle; its rect; `L.click` on it → A's menu (header); route unchanged; B. `--mode pad`: focus A → the circle present. Count `.lgs-more` nodes per document. Repeat on a Downloads row (`placement: 'row'`) | Circle 60 visible with an 80 hit, inside A's top right at inset 10 ± 2 (rows: trailing, inset 24 ± 2); the menu is A's; the route did not change (the host's click never ran); one node per document; on a host inside the search sheet (C1b's results, Top Hit) the circle has no `backdrop-filter` (P-45) |
| **AT-27** | C1a | Contract in area mockups and on device | `outline main` on each area's route with a footer | Every bottom ornament is the single `#Footer` capsule or quiet legend at y 628, ≤ 960 wide; no second toolbar node |
| **AT-28** | C1a | Route glass modes | For each route of §3.1.1: `data-lgs-glass`, `data-lgs-route` and the window tint's rect; on AllGames and `/settings/system`, 10 `L.pad` moves and a CDP hover sweep, reading both after each move | Attribute and rect as in the map (656, 720, none, art); **unchanged by every focus move**; the ornament's `data-lgs-orn` may change with the legends, the glass height never does |
| **AT-29** | C1a | Quiet legend legibility | `/settings/system` at rest (A and B only), both modes: `glass.py audit main --route /settings/system` (CONTRAST over the grey, bright and dark rooms, VP P-39); computed styles of the band (`#Footer[data-lgs-orn="quiet"]::before` or the shell's band node) and the labels; then `--flags quietBacking=off`; the same on `/account` (`window-full`) | `window` route: the band present (black .62, no `backdrop-filter`, no border, no outline), labels Medium white .82; AUD CONTRAST = 0 for the legend labels. `quietBacking=off`: no band, labels white .70 (PLAN §1.10's look; recorded, not required to pass). `/account`: no band, labels white .70 inside the glass, CONTRAST = 0 |
| **PLAN-1a-1** | C1a | Capsule or quiet by content | On `/library/tab/AllGames`, `/settings/system` and `/account`, in both modes: list the legends' `data-lgs-btn`, read `data-lgs-orn`, and the computed `display` of every legend node | Capsule exactly when a non-A/B member exists (AllGames: capsule; `/settings/system` at rest and `/account`: quiet); no legend node has `display: none` |
| **PLAN-1a-2** | C1a | G-FOCUS on the tab bar | = AT-8b | As AT-8b |
| **PLAN-1a-3** | C1a | Looks like the design | `glass.py cmp` of the live shots against `window-nav-anatomy.html`, `-tabbar.html`, `-ornament.html` and `-chrome.html` (live selectors in `docs/phase2/wp/C1a-cmp.json`) | Named rects within ± 8 px or the difference explained in the evidence log; the agent views both images and records a verdict (G-MOCK) |
| HA AT-13 | C1b, C2a | Providers (with C2a) | AT-9 steps with 'half', 'vlc', 'liquid', `--flags wp.c1b,wp.c2a` | 'half': the Software cell lists "Half SBS Toggle", A on it logs `launchNonSteam` with Steam's `strCmdline`; X on the Top Hit logs `primary(546560)`. 'vlc': the Top Hit is the program "VLC media player" and Open logs its launch. 'liquid': no Top Hit or Software cell for Liquid Glass |
| PLAN-1b-1 | C1b | Looks like the mockups | `glass.py cmp window-nav-search.html LIVE` (zero state) and `window-nav-results.html LIVE` (results 'half', Top Hit focused, `--mode pad`), with `docs/phase2/wp/C1b-cmp.json` | Named rects (`data-id` in the mockups) within ±8 px or the difference explained here; both images viewed and a verdict recorded |
| G-PAD (search) | C1b | Gamepad traversal | `glass.py pad-bfs --route /search/tab/All --pre <type 'half'>`; and from AllGames: Up to the field, Down into the sheet, B | Every item reached; Down from the field lands on the Top Hit (zero state: the first disc); Down-Up and Right-Left return; B closes search and focus is on the poster you left |
| C1b-1 | C1b | Sizes, type, outlines | `glass.py gates main --route /search/tab/All --pre <type 'half'>` in both modes; and with the zero state | G-SIZE: every target ≥ 60 visible with an 80 px hit (segments E-SEG, the × E-MINI); G-TYPE: no text < 18 px, no weight < 500, no uppercase or tracking in the sheet; G-OUTLINE: no border or outline; edge ratio ≤ 0.35 on the sheet's top edge (WN AT-23) |
| C1b-2 | C1b | Ornament | `outline main` with the zero state, then with results and the Top Hit attended, in both modes | Zero state: `#Footer[data-lgs-orn="quiet"]` with A and B only; results: the capsule with X "Play" and ☰ "Options"; no legend node with `display: none`; glyph badges only under `data-lgs-vr-mode="gamepad"` |
| C1b-3 | C1b | Focus and hover | `glass.py focus main --pairs` on a scope segment (rest, focused, selected), a Recent Searches capsule, See All, the Top Hit; laser hover with `--mode laser` | G-FOCUS (PLAN §1.4): focus ≥ +40 L over rest, focus ≥ selected + 15 L, glow band ≥ +20 L on the white segment; the Top Hit and posters scale 1.05 on focus and after 80 ms of laser dwell; capsules and segments never scale |
| C1b-4 | C1b | Depth (native) | `glass.py native-session --step "sgcheck --pre <open sheet, type 'half', focus the Top Hit>"`; then the same while the sheet scrolls | The sheet's crop at 10 mm ± 2 (live S × r), `interactive: false`; the Top Hit at +15 (or capped by the click-safe rule, reported); ≤ 4 distinct dz; no pop while scrolling; no pop for the snapshot, discs or the Software cell; nothing beyond +15 unless `interactivePops` |
| C1b-5 | C1b | Motion | `glass.py motion main --pre <activate> --name c1b_sheet_in`; `--name c1b_results` (first keystroke); `--name c1b_dismiss` (B) | Durations and easings are tokens; present ≤ 800 ms incl. delay; dismiss ≤ 200 ms; glass before content on entry, content before glass on exit; nothing at rest after 1 s; `--media reduce`: fades ≤ 200 ms only |
| C1b-6 | C1b | Recent searches stay in memory | Three searches; then `glass.py js` reads `localStorage` / `sessionStorage` keys on `main`; frame_ssh `grep -r` for the queries under `/tmp/lgs`, `/dev/shm/lgs`, `~/.local/share/glass-shell`; then `lgs off`, `lgs on --css`, open search | No query found in storage or on disk; after the restart the section is hidden |
| C1b-7 | C1b | Removal | `lgs off`; navigate to `/search/tab/All` with a query | Steam's own search page, unpatched; no `lgs` node, snapshot or provider; `rt.react.status().patchedLeft` 0 |
| C1b-8 | C1b | Strings | Static review of `21-search.js`: every drawn string goes through `rt.react.ui.loc()` or the `en*` gate; DOM: drawn strings on `main` equal "Strings" below | Equal; no other literal text |
| C1b-9 | C1b | Sounds | Intercept `PlayAudioURL` (IM §9); open and close the sheet; LB / RB on All; hover a card | `ShowModal` and `HideModal` once each; `ChangeTabs` per scope change; nothing on hover |
| CC A13 | C1c | Power, look only | POWER + `audit main` with it; `L.pad` through every row in both columns (never A); `--mode pad` and `--mode laser` (CDP hover on two rows) | 0 GONE / SHRUNK; 7 items + Cancel in Steam's order; slab ≤ 520 × 600; focus visible on every row (destructive rows: red fill, #0d0e12 label, glow band ≥ +20 L); group labels present only when the language starts with `en` |
| PLAN-1c-1 | C1c | A destructive confirmation never pops | CONFIRM-D = CONFIRM with `bDestructiveWarning: true` and C1c's test hook tagging its OK button `data-lgs-destructive` (the tag a Power confirmation gets); CSS-only: P6's report; native: `sgcheck` | No crop for the alert in either profile; native: one flat `thick` plate; the CSS look is the red confirm with a dark label |
| PLAN-1c-2 | C1c | G-MOTION filmstrips | = AT-15 for menu morph, alert and sheet; compared with `window-nav-motion.html` | Each frame's glass/content progress within ± 10 % of the storyboard's values at the same f |
| PLAN-1c-3 | C1c | Looks like the design | `glass.py cmp` of live MENU (tile menu via the More circle), the Sort menu, POWER, CONFIRM (the mockup's strings) and ZOO sheet against `window-nav-menu`, `-sort`, `-power`, `-alert`, `-sheet` (map below) | Named rects within ± 8 px or the difference explained here; both images viewed and a verdict recorded (G-MOCK) |
| C1c-1 | C1c | Input-mode looks in menus | MENU with `--mode pad` (focus on row 2), then `--mode laser` with a CDP hover + 80 ms dwell on row 3 while Steam's stale `.gpfocus` stays on row 1 | Pad: focus ≥ rest + 40 L, first frame ≥ 60 %; laser: the hovered row + 10 to + 25 L, and **no** focus fill on the stale `.gpfocus` row (P-02) |
| C1c-2 | C1c | Focus returns to the source (P-21, G-PAD) | Focus a poster, ☰ (`vgp_onmenu`) → MENU; B; `L.focused()`. The Sort menu from the Y legend (look only); B | Focus back on the same poster after each; B closed only the topmost layer (P-24) |
| C1c-3 | C1c | Dismissal | Menus: B, an outside click, Cancel. Alerts and sheets: B, the close circle, an outside click | Each closes the topmost layer; outside clicks on alerts and sheets cancel exactly as stock (D9) |
| C1c-4 | C1c | Source turns white | While MENU (from the More circle), the Sort menu (from slot 1) and POWER (from the tab) are open: the source's computed background | White .94 with a dark glyph while open; restored on close |
| C1c-5 | C1c | Route transitions never block input | A route change; at 300 ms a CDP click on an element of the new page; `getAnimations()` on `TopLevelTransitionSwitch` children | The click reaches the new page's element; translate ≤ 16 px (0 in T1); nothing left at rest |
| C1c-6 | C1c | Strings | `--flags wp.c1c` with the UI language read from `LocalizationManager`; POWER | Group labels drawn only for `en*`; every drawn string is listed in this log |
| C1c-7 | C1c | Removal | `lgs off` after MENU, CONFIRM and POWER runs; `outline main`; `status` | No `lgs-menu-*`, `data-lgs-*`, `html.lgs-modal`, `--sx..--sr` or `translate` left on Steam's nodes; ModalManager untouched (G-REMOVE) |

### 13.1 Mockup measurements (revision 3)

Measured on the revision 3 renders with `window-nav-measure.py` (VP SHOT luma, 0.299 R + 0.587 G + 0.114 B). The device values replace these when the tests run.

Renders of 2026-10-07 (session 2, after P4's kit parity change of 05:24); commands in C1a's evidence log. Regions are view px of the 1920 × 1080 render.

| Check | Render, region | Result | Criterion |
|---|---|---|---|
| G-FOCUS, tab bar state key, the icon circle (r 21.5) | `p2_window-nav_tabbar.png`: rest (Media), hover (spot only), current route (.18 circle), focus (pill) | L 96.4 / 101.3 / 126.5 / 141.6: focus − rest **+45.3**, focus − circle **+15.1**, circle − hover **+25.2** | ≥ 40, ≥ 15, ≥ 12: PASS |
| G-FOCUS, the same rows (SHOT rect inset 6) | rest row vs focus row | **+42.5** | ≥ 40: PASS |
| G-FOCUS in the bar itself | Store pill vs the Media row at rest | **+58.7** | ≥ 40: PASS |
| The focus add | Same state key rendered at .28 and .30 (scratch copies) | .28: +35.2 and +7.6 (FAIL); .30: +39.1 and +11.6 (FAIL); .32: +42.5 and +15.1 | The shell's mockups use .32, the top of PLAN §1.4's range, until P4 tunes `--lgs-focus-add` (REQ C1a->P4) |
| Glass tone under labels | Tab-bar capsule, state-key glass | L 82, 95 | 70–90 under text (PLAN §1.6); the kit alone gave 128–140 over the curtain, so the shell's liquid glass carries a tone layer (C1a log) |
| AT-23 edge, window | `p2_window-nav_anatomy.png` y 66, x 380–1540 | ratio 0.00 (`_t1`: 0.00) | ≤ 0.35: PASS |
| AT-23 edge, ornament (fixed slots) | `anatomy` y 694, x 560–1360 | 0.05 (`_t1`: 0.07) | PASS |
| AT-23 edge, tab-bar capsule (expanded) | `tabbar` y 83, x 100–325 | 0.29 | PASS |
| AT-23 edge, ornament (Downloads) | `tabbar` y 694, x 745–1295 | 0.04 | PASS |
| AT-23 edge, frame-control capsule | `p2_window-nav_chrome.png` y 438, x 505–808 | 0.00 | PASS |
| Quiet legend contrast, `window` route, dim band | `p2_window-nav_ornament.png` strip 4: "Select", "Back" over the window sill | 4.9–6.7 : 1 (Back 6.5–12.7) | VP P-39 ≥ 4.5 : 1: PASS |
| The same over the curtain (worst case, L 236) | scratch copy with the band in place of the bare comparison | 5.1–6.0 : 1 | PASS |
| The bare look (`quietBacking` off) over the curtain | strip 4, left copy | 1.3–1.5 : 1 | FAIL: why the band exists (O3) |
| Quiet legend inside the glass (`window-full`) | strip 5 | 5.6–8.3 : 1 | PASS |
| Geometry | `--rects` dumps of `anatomy`, `ornament`, `tabbar` | Ornament 880 × 84 at window (200, 628), slots 300 · 130 · 156 · 134 · 120, gap 4; Back 60 at (24, 24); search 520 × 64 at x 380; title x 100; More circle 60 at the lifted poster's corner − (70, −10); tab rows 63.8 view px = 58 popup px; the bar spans main y 17–703 | As §3.2–§3.4 |

Contrast is WCAG's ratio of relative luminances (the brightest 2.5 % of a label's box against its 60th-percentile background); the script is in C1a's log.

---

## 14. Critique responses

These answer the critique of revision 1. Where PLAN §1 later changed an answer, the row says so in a **Revision 3** note.

| Critique point | Response |
|---|---|
| **Blocker: the headline glass depends on a native layer that stays off without a wearer; the laser dot is probably hidden under the cover** | Fixed. §3.6 adds the T2 pointer proxy, drawn inside Steam's DOM, so it shows in every base and popped crop over the cover. §8.3 replaces each NATIVE.md wearer check with an agent check (AT-0a pass-through via `DumpLaserOverlays`, AT-0b the proxy in CDP shots and an `hvgrab`, AT-0c alignment at the device's own r = 0.863, the documented cover flags, cost). The native layer becomes the default only when AT-0 passes (Q14). §8.4 specifies the degraded glass that ships otherwise and `p2_window-nav_anatomy_t1.png` shows it. **Revision 3:** the gate is V1's (PLAN §4.3, AT-0a to AT-0f); the proxy draws only in native mode (S16) |
| **Focus vs selection indistinguishable (ΔL 2.5)** | Fixed. Current route = a .16 circle only; gamepad focus = a pill across icon and label at + .30 with its own specular arc. Measured ΔL 40 (59 fill to fill) in `p2_window-nav_tabbar.png`. Menus: focus + .30, checked = check glyph only, ΔL 65. AT-8b and AT-8c repeat it on the device. **Revision 3:** PLAN §1.4's values replace these (focus + .28, the current route a .18 circle with its arc, laser hover a light spot only); the G-FOCUS criteria and the new mockup measurements are in §3.3.4 and §13.1 |
| **Tab-bar geometry on the user's device (Console, developer mode, r = 0.863, centred on the panel not the glass)** | Fixed. Console is drawn in every mockup (the shared builder now defaults to the device). §3.3.2 sizes the pitch from the live world heights (AT-7) and merges System and Power into one capsule. Result: p 58 at r = 1, p 52 at r = 0.863 in the worst case; `p2_window-nav_tabbar_r863.png` renders it. The bar centres on the glass when it fits; with ten items it does not, so it spans the panel and ends level with the ornament by design (D-13). Partly rejected: the critic's 60 px floor. Ten items at 60 need 644 popup px and the panel offers 641 at r = 1 (564 at r = 0.863 if the popup ignores the resize), so the floor is 52 and tied to the window's own scale (D-2) |
| **Laser path through the ornament crosses posters; laser mode unmentioned; home-apps' conflicting ornament** | Fixed. The More circle is a shell-owned T2 helper (§3.4.4). The frozen target (§3.4.3) re-focuses the dwelled or pressed card before the ornament acts and names it on the button. Laser mode (§3.4.2): Steam's `%{SortAndFilterContainer}` folded into slot 1. One published contract (§3.4.1–3.4.2) and a reconciliation table with home-apps and the others (§3.4.6). `p2_window-nav_ornament.png` shows the modes. **Revision 3:** A/B and duplicate X/Y are no longer hidden in laser mode (PLAN §1.10, S5): A and B are quiet members in both modes and glyph badges show only in gamepad mode; an ornament holding only A and B is a quiet legend; laser mode is tested with P3's input stub (AT-24), never Steam's getter |
| **520 px modal box makes the tile menu, Sort By and Downloads Options scroll** | Fixed. Layout by item count (§5.1.1): ≤ 5 at 72 px; 6–7 compact (60 visible on a 64 px pitch, inline label): the device's 7-item tile menu with Developer › is 504 px; ≥ 8 in two columns ≤ 600 px: Sort By 508, Downloads Options 434, Power 464. AT-11b requires `scrollHeight == clientHeight`. Rendered: `p2_window-nav_menu.png`, `p2_window-nav_sort.png`, `p2_window-nav_power.png` |
| **Menus, alerts and sheets rely on clicks on interactive crops; Q12's fallback can never trigger** | Fixed. The default uses only proven mechanisms: non-interactive pops of 10 mm (parallax ≤ 20 % of a 64 px row up to 45°, and the proxy marks the real hit), separation from the scrim and shadows. The +30/+50 interactive depths sit behind the wearer flag `interactivePops` (Q12). §3.7, §10, AT-14. **Revision 3:** the dim is Steam's overlay at black .35, not a `t1` tint (PLAN §1.8); destructive alerts stay at 0 mm |
| **Search trigger unverified; AT-9 bypassed it; inventories disagree** | Fixed. Activation is the input's DOM focus, which both input paths produce; T2 navigates only if Steam did not. AT-9a (laser: click + focus) and AT-9b (gamepad: D-pad Up) exercise the real trigger and record Steam's own behaviour |
| **Search is still a page swap; B.5.2 unsolved** | Fixed in the experience; partly rejected in mechanism. Search is presented as a sheet over a snapshot of the page you were on; leaving is one press and focus returns to the same poster (AT-9c). The mechanism stays Steam's route underneath, deliberately: Steam's input navigates on typing (library.md §1.2), so a modal opened over the page would be orphaned by that navigation, and the route keeps history, B, IME and every Steam result path intact |
| **Search summary hides Tools, Hidden and Store; counts depend on Q6** | Fixed. All shows every category with matches (capsules with counts, an "In the Store" row, "See All N"); categories open Steam's own grid in the sheet. Counts and items come only from Steam (its hook via Q6, or its own All grid and tab row when Q6 is unresolved). AT-9e checks parity |
| **Full-width 2 px line on the tops of wide slabs** | Fixed. §8.2 replaces the linear top layer with a light-dependent lobe; measured profiles fade to 0–13 % on the right (ratio ≤ 0.13). AT-23 checks it with `window-nav-measure.py edge` |
| **Menus from chrome animate 0 → +30 mm, over the 20 mm cap** | Fixed. Default 0 → +10 on `depth`; with the wearer flag, chrome-sourced menus appear at +30 with the materialize instead of travelling (§3.7, §5.1.3) |
| **Power slab too large for the clip-path morph limit** | Fixed. 592 × 464 (two columns of 284); every menu ≤ 600 × 600; anything larger would materialize (§5.1.3, §5.2) |
| **Bottom ornament is the console legend made clickable; four stacked rows under the window** | Fixed. The ornament is a toolbar with modes, a named target and slot rules (§3.4). Under the window: one window-bar row (frame controls + window bar moved up, T4 [PLAUSIBLE] with fallback), laser-visible; at rest two rows (§3.5, `p2_window-nav_chrome.png`) |
| **CQ1 fallback leaves modal tops under the toolbar** | Fixed. The fallback pads the modal container by 68 px; AT-2 measures modal and menu tops in both cases (§3.2). **Revision 3:** the runtime publishes the outcome as `html.lgs-hdr-108` / `lgs-hdr-40`, and the scroll guard keeps focus in y 124–612 (VP P-23) |

---

## 15. Files

| File | Owner | What |
|---|---|---|
| `docs/phase2/concepts/window-nav.md` | C1a | This concept |
| `docs/phase2/concepts/window-nav-measure.py` | C1a | Pixel checks for AT-0b, AT-8b/c, AT-23 (`edge`, `dl`, `focus`, `ring`) |
| `docs/phase2/mockups/window-nav-*.html` | C1a, C1b, C1c, C3a (intro table) | Mockups (true size, except the motion storyboard and the ornament board, which crop) |
| `docs/phase2/mockups/window-nav-shared.css`, `window-nav-shared.js` | C1a | Shared chrome: the device tab bar, the toolbar row, the ornament contract (capsule or quiet, badges by mode), the window-bar row (`winbar`), the More circle, the pointer proxy, the edge lobe; menu, sheet, search and toast styles used by the other packages' mockups |
| `docs/phase2/wp/C1a.md`, `C1a-cmp.json` | C1a | Evidence log; live selectors for `glass.py cmp` |
| `shots/p2_window-nav_*.png` | Each mockup's owner | Renders: `python tools/mockshot.py docs/phase2/mockups/window-nav-<name>.html shots/p2_window-nav_<name>.png` |
