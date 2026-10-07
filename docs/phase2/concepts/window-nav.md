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

**Mockups** (true size, 1920 × 1080 headset view, built with `mockups/kit.css`; shared chrome in `mockups/window-nav-shared.css` and `window-nav-shared.js`):

| Shot | Source | Shows |
|---|---|---|
| `shots/p2_window-nav_anatomy.png` | `mockups/window-nav-anatomy.html` | The window at rest, laser mode: the device's 10-item tab bar, toolbar row, the More circle on the hovered card, the ornament (Sort and Filter folded in, Options naming its target), the window-bar row, the dashboard bar, the pointer proxy |
| `shots/p2_window-nav_anatomy_depth.png` | `window-nav-anatomy-depth.html` | The same with depth (mm) and tier labels |
| `shots/p2_window-nav_anatomy_t1.png` | `window-nav-anatomy-t1.html` | Degraded glass: what ships if the native gate (AT-0) fails |
| `shots/p2_window-nav_tabbar.png` | `window-nav-tabbar.html` | Gamepad focus in the expanded tab bar: focus pill on Store, current route (Downloads) as a circle; ΔL 40 |
| `shots/p2_window-nav_tabbar_r863.png` | `window-nav-tabbar-r863.html` | The user's window size r = 0.863, worst case: live pitch 52 popup px, bar = panel height |
| `shots/p2_window-nav_ornament.png` | `window-nav-ornament.html` | The ornament contract: gamepad mode, laser mode, the frozen Options target |
| `shots/p2_window-nav_search.png` | `window-nav-search.html` | Search activated: a sheet over the dimmed Library, zero state, keyboard with echo row |
| `shots/p2_window-nav_results.png` | `window-nav-results.html` | Results for "half" in the sheet: one category control, Top Results with every category present |
| `shots/p2_window-nav_menu.png` | `window-nav-menu.html` | A 7-item tile menu (Developer › present) in the compact layout, grown out of its card |
| `shots/p2_window-nav_sort.png` | `window-nav-sort.html` | Sort By (10 options) as a two-column menu grown up from the white Sort button |
| `shots/p2_window-nav_power.png` | `window-nav-power.html` | The Power menu, 592 px, two groups, grown from the white Power tab |
| `shots/p2_window-nav_alert.png` | `window-nav-alert.html` | An alert over the dimmed window |
| `shots/p2_window-nav_sheet.png` | `window-nav-sheet.html` | A sheet (the library Filters dialog) over the dimmed window |
| `shots/p2_window-nav_toast.png` | `window-nav-toast.html` | A toast card and variants, the floating hint, the toolbar on a hero route |
| `shots/p2_window-nav_chrome.png` | `window-nav-chrome.html` | The window-bar row: tooltip below, More Options, Close on game frames, resize corner |
| `shots/p2_window-nav_motion.png` | `window-nav-motion.html` | Motion storyboard: menu morph, search sheet present, route change, toast |

Measurement helper for the acceptance tests: `docs/phase2/concepts/window-nav-measure.py` (`edge`, `dl`, `ring`).

**Units.** Sizes are main-window CSS px unless marked. 1 pt = 4/3 px (DESIGN2 §2.1). At r = 1 one main px is 0.766 mm (0.0307° at 1.43 m, 0.038° at the 1.15 m summon distance). Popup px (frame menu, toasts, floating footer) are 0.847 mm. SteamVR systemui px (frame controls, their tooltips, More Options) are 0.581 mm. Grab-handle px are 0.300 mm. Depths are in mm; scene units = mm / (369 × r) (DESIGN2 §2.6). This device runs at **r = 0.863** today (spatial.md §1.1), with **developer mode on**, so the frame menu has Console and the tile menu has Developer ›.

---

## 1. The experience

You raise the controller and the dashboard opens. One frosted glass window floats in the room. You see the room through it, blurred and darkened. Its edge is light along the upper-left curve, fading away along the top and down the sides; no line is drawn around it.

**Where you are is always visible.** Beside the window's leading edge hang two slim glass capsules of circles. The first holds the six sections: Home, Library, Store, Friends, Media, Downloads. The second holds the system: Console, Steam Settings, VR Settings and, after a small space, Power. The current section sits on a soft circle, and the window's top-left corner names it in a large bold title: "Library". Ten destinations are more than a visionOS tab bar holds, so the bar runs the full height of the window and its system capsule ends level with the toolbar at the bottom: the two ornaments frame the window like one piece of chrome.

**The window's chrome lives at its edges.** The toolbar row has a circular back chevron in the corner, the large title, and a dark recessed search capsule in the middle, 64 px tall. Content scrolls under a soft darkening at the top edge; there is no header band.

**One toolbar hangs over the bottom edge**, half on the glass and half in the room. It holds the page's actions as real buttons: "Alphabetical" (the current sort), "Filter", and "Options · Hollow Peaks". The controller glyph sits after each label as a small hint, the way a menu shows a keyboard shortcut. When you use the laser, the toolbar shows only what the laser needs; Select and Back are gone, because the back circle and a direct click do both. When you pick up the gamepad, Select and Back return at the end, quieter.

**What you point at, you act on.** Hover a game and a small glass "⋯" circle appears on its corner: its menu, right there. If you reach for the toolbar instead, it remembers the game you looked at and names it on the Options button, so moving the pointer down across other posters never changes the target.

**Under the window there is one row**, and only while you point at the dashboard: a capsule of window controls (keyboard, float in world, theatre, more) beside the visionOS window bar. Below it floats the dashboard bar. Today there are four rows here.

**Searching opens a sheet over the page you were on.** Point at the capsule, or press Up from the top row. The capsule takes the system's only focus ring, the keyboard rises under the window, and a glass sheet grows down out of the field. Behind it the Library stays where it was, dimmed. Before you type, the sheet offers your recent games as circles and your recent searches as capsules. As you type it becomes results: one control for Steam's categories (All, Library, Friends, Store, Tools, Hidden, with counts), a Top Hit card, your matching games, an entry for every other category, and the first Store results. Press B, the back circle or the dimmed page, and the sheet is gone; you are where you were, on the poster you left.

**Menus grow out of what you pressed.** A game's menu grows out of its card and settles just in front of the window; the card stays lightly lifted while its menu is open. Sort By grows up out of the white Sort button as two columns, because ten options in one column would scroll. The Power menu grows from the white Power tab: "This Device" and "Steam" side by side.

**Dialogs come forward and the window steps back.** A confirmation is a 640 px glass card with a bold title and two capsules; the window behind it darkens to 65 %. Larger dialogs are sheets with a close circle.

**Nothing slides in from the edge of your view.** Notifications appear in place as small glass cards with a round icon. Pages cross-fade with 16 px of parallax. The persistent chrome never moves, and nothing moves at rest.

**Both input models work everywhere** (§9). Gamepad focus is light: a lit pill that lifts into glass, never a ring. It never looks like the current section's soft circle, so you always know which is which.

---

## 2. Is today's UI right for VR? Verdict per surface

| Surface | Today (audit) | Verdict | Redesign |
|---|---|---|---|
| Window | Opaque dark gradient, 6 px corners, a uniform rim in Phase 1 | Wrong material and shape | visionOS glass, radius 54, edge from light (§3.1, §8) |
| Header band | 40 px strip "← Back \| 🔍 Search…", targets 1.23° | Wrong idiom, half the target size | Toolbar row of 108 px: Back circle, Large Title, search capsule (§3.2) |
| Search | 40 px strip, light-grey web field on its own route; no echo; empty query lists the library; entering it loses the page | The user's named example | A sheet over the page you were on, opened on the field's real activation; zero state; results with every category; echo on the keyboard (§4) |
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
| Glass on routes with a bottom ornament | **1280 × 656 px**; a 64 px transparent ornament margin below | §12 D-1 |
| Glass on routes without one (Home, keyboard-only routes) | 1280 × 720 | |
| Corner radius | 54 px (40 pt) | A 60 px circle inset 24 px is concentric |
| Outline | None. Edge = tone step + a specular lobe from the key light (above, 20° left) + darkened inner edge + depth shadow (§8.2) | The top highlight must pass AT-23 |
| Material | T5 glassd `window` cover when the native gate passes (§8.3); otherwise the degraded spec (§8.4) | |
| Background clearing | Shell clears `%{BasicHome}%{OpaqueBackground}`; area owners clear their page roots (LAB) | |
| Clip | `%{BasicUiRoot}` keeps `overflow:hidden`; its `border-radius` 6 → 54 px | Paint-only, sign-off §11 |
| Optional larger window | Frame height override 1.5 → 1.6 (× 1.067) (spatial.md §7 E5b [PROVEN]) | Sign-off Q5; the mockups do not use it |

**How the glass stops at 656.** CSS draws the window tint on a pseudo-element of `#GamepadUI_VR_Full_Root` that ends 64 px above the bottom whenever a footer exists (`:has(#Footer)`). In T5 the daemon reports the same rect (1280 × 656, radius 54) as the cover shape. The ornament is Steam's DOM in the margin, so its input stays native.

### 3.2 The toolbar row (Steam's `#header`)

The row is 108 px tall (24 + 60 + 24 = 81 pt, 83 mm at r = 1). There is no band. Steam's header `::before` becomes the scroll-edge effect: a 124 px band of black .30 → 0 with a 12 px blur, masked to fade out, its opacity still bound to Steam's `--gamepadui-header-background-opacity`.

| Element | Steam node | Visible | Hit region | Position | States |
|---|---|---|---|---|---|
| Back | `%{BackContainer}` (laser; B is the gamepad path) | 60 px circle with a 28 px chevron | 80 × 80 box | Box at (14, 14) | Section roots: borderless, chevron white .70. Nested pages: white .10. Hover + .08 and the light spot; after 0.6 s it grows into a capsule with the previous page's title (T2). Steam's "Back" text is visually replaced by the chevron with T2 `aria-label` (audit exception Q8) |
| Large Title | T2 decorative node in `#header`, text from a route map | Large Title 46 px Bold, white .96 | none | x 100, centred on the row | Section roots only; area concepts may supply their own (`data-lgs-title`) |
| Search | `%{SearchAndTitleContainer}`, `%{SearchFieldBackground}`, `%{SearchBox}` | 520 × 64 capsule on section roots; 640 × 64 on nested and search routes | 536 × 80 (656 × 80) | Centred at x 640, y 54 | Recessed: black .30 + `inset 0 2px 5px`. Magnifier 26 px; placeholder Steam's string, upright 24 px white .55. The grey `%{WhiteBackground}` field is gone. Focus: the system's only ring (3 px white .55 + 16 px glow). No microphone (Steam has no dictation) |
| Clear (×) | `input::-webkit-search-cancel-button` | 44 px circle, white .16 | Alone at the trailing end | 10 px inset | When text is present |
| Title mode | `%{SearchAndTitleContainer}%{ShowingTitle} > div` | Title 2, 30 px Bold, centred | — | y 36 | Replaces search, as Steam does (H5) |
| Browser mode | `%{HeaderBrowser}` | 640 × 64 recessed capsule, URL 22 px white .70 | 656 × 80 | Centred | Not seen live: verify on the first Store web view |
| Account alert | `#header_profile` | 60 px circle with Steam's avatar and a red badge | 80 × 80 | Top-right, 24 px inset | Only with active support alerts (H7) |

**Hero routes** (game pages): the row floats over the art. Back becomes a clear glass circle (black .32 + 10 px blur); search collapses to a 60 px magnifier circle at the top-right (the same `%{SearchAndTitleContainer}`, 80 × 80 box). Gated on AT-4; if the audit flags the narrower box, the full capsule stays in the clear variant. Shot: `p2_window-nav_toast.png`.

**Header height (CQ1).** `--basicui-header-height: 108px !important` on `%{BasicUiRoot}` plus `HeaderStore.m_flCurrentHeaderHeight = 108` (T3, in memory, restored on `lgs off`). This is [UNPROVEN]; AT-2 tests it. **If it fails**, three rules keep everything clear of the toolbar row:

1. The header stays 40 px in layout; the toolbar controls overflow downwards into a 68 px band (the header is `pointer-events: none` except its children, inventory shell §3).
2. Every page root adds `padding-top: 68px`, and every Steam scroller (`%{ScrollPanel}`) gets `scroll-padding-top: 108px`, so gamepad scroll-into-view stops below the row.
3. **Modals:** `%{GamepadDialogOverlay} .ModalPosition` and the context-menu modal container get `padding-top: 68px`, so the modal box starts at 108, exactly as with CQ1 (revision 1 left modal tops under the toolbar). AT-2 measures the modal top in both cases.

### 3.3 The tab-bar ornament (Steam's VR main menu, `frame.menu.<id>`)

Steam's frame menu is already a separate popup beside the window's leading edge, collapsed to icons and expanding on hover: structurally the visionOS tab bar (shell-nav C.2). This design keeps every item, route and handler and changes visibility, grouping, size, placement and states.

#### 3.3.1 Items and grouping on this device

Steam's items in DOM order (inventory bar.md §3, audit shell-nav A.3): Home, Library, Store, Friends & Chat, Media, Downloads, **Console** (developer mode), Steam Settings, [Help, setup only], VR Settings, Steam's `%{SectionGap}`, Power. **This device has 10** (11 during setup).

| Capsule | Items | Why |
|---|---|---|
| Sections | Home, Library, Store, Friends & Chat, Media, Downloads | The six places, as a visionOS tab bar |
| System | Console, Steam Settings, [Help], VR Settings, then Steam's SectionGap (10 popup px) and Power | System destinations; one capsule instead of two (one gap fewer) |

Capsules are 10 popup px apart. Inside a capsule: padding 6 top and bottom, 12 at the sides; rows are contiguous (each item's hit box is its full row). Built only from Steam's component variables (`--menu-item-height`, `--menu-item-padding`, `--menu-icon-size`, `--menu-font-size`) and `%{DashboardMenu>ItemOuter}` backgrounds; never `width` (it animates). The system capsule starts at the seventh `ItemOuter` with `margin-top: 10px`; `%{SectionGap}` becomes 10 px.

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

The floor (52) is below DESIGN2's 72 main-px fixed-quad floor (§12 D-2). Ten destinations at ≥ 60 popup px need 644 popup px; the panel offers 641 at r = 1. The alternative is a bar that overhangs the window.

Shots: `p2_window-nav_anatomy.png` (r = 1, p 58), `p2_window-nav_tabbar_r863.png` (r = 0.863 worst case, p 52).

#### 3.3.3 Placement

Steam's anchor: `origin_on_popup {x:1}`, `offset.x_pixels −6` on the window's left edge, 1.4 cm outside and 1 cm nearer (shell-nav §0.3). Unchanged. The bar is centred on the panel (rule 2) or on the glass (rule 1). Expanded, it is 272 popup px wide and grows outward into the room (Steam right-aligns the content against the window), so it never covers the window (§12 D-6).

#### 3.3.4 States: selection is a circle, focus is a pill

Revision 1 drew focus and selection as two fills of nearly the same brightness (ΔL 2.5). They now differ in shape and in light.

| State | Look | Measured in `p2_window-nav_tabbar.png` |
|---|---|---|
| Rest | Glyph white .70, no fill | Media disc L 92 |
| **Current route** (`%{DashboardMenu>Active}`) | A white .16 **circle** (d) behind the glyph, glyph white with a heavier stroke (`stroke-width` +0.7 where Steam's SVG strokes; `fill` where it fills). No label pill even when expanded. Steam's blue `%{DashboardMenu>ActiveDot}` becomes transparent. Steam's own `scale(1.1)` stays (Steam-owned transform) | Disc L 127 |
| Laser hover | Collapsed bar: + white .10 circle and the light spot. Expanded: a pill across icon and label at + .10 | — |
| **Gamepad focus** (`.gpfocus`, keyframe-held, so `!important`) | A **pill across icon and label** (the bar always expands while it holds gamepad focus) at + white .30, a light spot .20 in the upper third, and the pill's own specular arc (×1.5) | Pill L 167: **ΔL 40** over the full shapes, 59 fill to fill |
| Focus on the current route | The pill, with the circle inside it | — |
| Menu open (Power) | White .94 circle, dark glyph (the source of an open menu is white). T2 sets the class from `SteamUIStore.OpenPowerMenu` | `p2_window-nav_power.png` |
| Badge | Steam's yellow "!" on Steam Settings stays | — |
| During a modal | The capsules darken with a black .35 layer (T2 class, or a T4 `tint` node on the popup); still clickable | — |

AT-8b repeats the measurement on the device.

#### 3.3.5 Visibility

Today the popup is `only_visible_with_laser`. T3/T4 clear the flag: wrap `vrPooledPopupStore.CreatePooledPopup` for type 3, or resend the live instance's params without it (spatial.md §3.1, §6.3 [PLAUSIBLE]; the flag is a plain request field that E2 showed is honoured). Fallback: as today (visible with the laser and while it holds gamepad focus); the Large Title still answers "where am I".

#### 3.3.6 Depth and material

- **+25 mm** by moving the popup itself (Steam's +10 mm plus +15 mm on the frame's left side-panel transform; the t1 technique, spatial.md §5 [PROVEN] on t1, [PLAUSIBLE] on this node). It is Steam's real panel, so its input is native. Never a crop (native-e2e §1 ghosting).
- T5: glassd `liquid` covers on the popup's own panel (`frame.menu.*` is already a live glassd surface, native-e2e). T1: panel tint + edge.

### 3.4 The bottom ornament: the contract

One toolbar ornament per window, owned by the shell. Area concepts fill its slots; they do not draw their own toolbars.

#### 3.4.1 Geometry

| Property | Value |
|---|---|
| Node | `#Footer.%{BasicFooter}` (absolute bottom, z 7000): no background, no top hairline, `padding-bottom: 8px`. Steam measures its height (module 97502), so `--gamepadui-current-footer-height` becomes 92 and every page and modal ends at y 628 by Steam's own layout |
| Capsule | y **628–712** (84 px = 63 pt = 64 mm, 2.58°), straddling the glass's bottom edge by 28 px; centred; `width: fit-content`, **≤ 960 px** (75 % of the glass); radius 42; padding 0 12; gap 4; 14 px between member groups |
| Members | 60 px capsules (1.84°): label 22 px Semibold first, the controller glyph after it as a 30 px badge (white .16, 15 px Bold, white .70). The hit region is the capsule's full 84 px height |
| Clearance | 8 px above the panel's bottom; 27 px above the window-bar row |
| Backing | T2 measures the union rect of the members and writes `--lgs-orn-x` / `--lgs-orn-w` on `#Footer`; `#Footer::before` (free, inventory shell §12) draws the capsule there. Without T2: two adjacent capsules (the footer legend's and Steam's laser-mode pill), 12 px apart |

#### 3.4.2 Members, in order, and the two input modes

T2 reads Steam's input mode read-only (`IsInGamepadNav`, module 84114, the getter `%{SortAndFilterContainer}` itself uses) and sets `html.lgs-gp` or `html.lgs-laser` on every Steam document.

| Slot | Node | Gamepad mode | Laser mode |
|---|---|---|---|
| 1. Laser controls | Steam's `%{SortAndFilterContainer}` (Sort with the current sort as its label; Filter), rendered by Steam only in laser mode (inventory library §6.1) | — (Steam does not render it) | Moved by T1 into the capsule's leading slot (it is absolutely positioned already; its buttons keep `pointer-events: auto`). Sort with a leading sort glyph and the value ("Alphabetical"); Filter with a leading filter glyph and Steam's "Filter: …" text |
| 2. Actions | Steam's `%{ActionButtonLegend}` nodes except A and B | All shown: "Filter X", "Sort By Y", "Options ☰" … | Shown, except X/Y legends that duplicate a slot-1 button (Sort By, Filter) |
| 3. Area slot | At most one segmented control (Steam's node, e.g. the library's VR sub-filter, if its owner's gate passes) and T2 state labels on Steam's legends (current sort, filter count) | Shown | Shown |
| 4. Navigation | A (Select) and B (Back / Cancel / Done) legends | Quiet: Medium white .70 | **Hidden**: the Back circle (H1) and a direct click on the element do both, and these two act on a focus the laser user cannot see |

T2 tags each legend with Steam's button enum (`data-lgs-btn`, read from the legend's React props), so no selector depends on a localised label. Hiding Steam's own legend nodes in laser mode breaks LAB's "never `display:none`" rule on purpose; it needs sign-off (Q13). Fallback if refused: A and B stay as 44 px glyph-only circles at the trailing end.

Labels follow focus, as today. When they change, the label cross-fades in 150 ms; with T2 the backing's width morphs on `snappy`.

Steam's legends' click dispatch is unchanged. The legend whose menu is open turns white (T2 tracks the last pressed legend or slot-1 button), e.g. Sort while the Sort menu shows (`p2_window-nav_sort.png`).

Shots: `p2_window-nav_ornament.png` (both modes), `p2_window-nav_anatomy.png` (laser), `p2_window-nav_tabbar.png` (gamepad).

#### 3.4.3 The frozen target (T2)

With the laser, Steam's focus follows hover. Moving the pointer from a poster down to the ornament crosses other posters, so today Options may open the wrong game's menu (library audit B.5.1, LQ7; on Downloads the Options menu opens with Uninstall first and focused, social-media D6).

The shell keeps a **target**:

1. On `pointerdown` on a focusable card or row, the target becomes that element.
2. On hover, an element becomes the target after **300 ms of dwell** (a pointer crossing a poster on its way down takes less, about 90 ms in the board's example).
3. When the pointer enters `#Footer` (`pointerenter`), T2 re-focuses the target through Steam's own nav node (`node.BTakeFocus(3)`, the call the lab already uses) before any click can reach a legend. Steam then re-renders the legends for the target, so a click dispatches the target's actions with Steam's own handler.
4. The Options legend carries the target's name as a decorative suffix: "Options · Hollow Peaks" (T2, `aria-hidden`; the name from the element's accessible name or its title text).
5. The target clears when the route changes, when gamepad input arrives (gamepad focus is visible, so no freezing is needed), or after 8 s without the pointer on the window.

Shot: `p2_window-nav_ornament.png` (third strip).

#### 3.4.4 The More circle (T2, shell-owned)

DESIGN2 §10.4 asks for a visible "⋯" on the hovered or focused row or card. The shell owns it for every area:

| Property | Value |
|---|---|
| Node | One T2 decorative node per document, moved to the current target (hover ≥ 300 ms or `.gpfocus`) |
| Look | 52 px liquid-glass circle (40 mm, 1.6°), "⋯" glyph 26 px; its hit is a 76 px circle (transparent padding); white .94 while its menu is open |
| Position | Cards: centred on the card's top-right corner, inset 12 px. Rows: trailing end, vertically centred, 24 px inset |
| Action | Dispatches Steam's own menu event on the target (`vgp_onmenu`, gamepad button 14, inventory library §0.3: the same event ☰ sends). Never a new menu |
| Shown | Only where the target has an `onMenuButton` action (T2 reads `actionDescriptionMap`); never on Home's launcher circles unless their owner asks |

The laser therefore opens a card's menu where it is, without reaching the ornament. Shot: `p2_window-nav_anatomy.png`.

#### 3.4.5 Material and depth

T5: a glassd `liquid` slab behind the capsule at the window plane (the inset approach, spatial.md §2.5). T1: in-page `backdrop-filter: blur(12px) saturate(1.7)` + liquid edge + a 0 7 px 22 px shadow. Depth **0 mm** (it lies half outside the window cover, where a popped crop would double it off-axis). The +25 mm variant with an occluder stays a sign-off item (Q11).

#### 3.4.6 Reconciliation with the area concepts

| Concept | Today in its file | Under the contract |
|---|---|---|
| home-apps §7 | Toolbar ornament 936 × 84 at (172, **636**) on a 664 px glass: Sort, Filter, VR segmented control, Options | y **628**, glass **656**; width 936 ≤ 960 is fine. Sort and Filter are Steam's legends (gamepad) or slot-1 buttons (laser) with T2 state labels; the VR control is the area slot (behind its own gate AT-15d); Options gets the frozen-target suffix; its "More circle" spec (52 px on the card's corner, `vgp_onmenu`) is this shell helper |
| settings, game-pages | Already 656 / 628 (they adopted revision 1) | Unchanged; their A / B legends hide in laser mode |
| social-media | Legend-only groups (friend menu, media Filter, Delete Clip, Downloads Options, Change Device, Add to Cart) | Each becomes an ornament member or the More circle on its row |
| control-center §5 | Power menu 440 px single column, 72 px rows | The shell's count rule (§5.1): 7 actions → two columns, 592 px (§5.2) |

The shared builder (`window-nav-shared.js`) now draws the device's tab bar (Console on, live pitch) and the contract's ornament for every mockup that includes it; area mockups adopt the window-bar row by replacing their `frame` and `pill` placeholders with `winbar`.

### 3.5 Under the window: one window-bar row

#### 3.5.1 Layout

references.md names the four strata under the window as a seam ("don't stack several rows of small separate chrome"); visionOS has one window bar and its close button. The new stack:

| Row | Content | Visible |
|---|---|---|
| Ornament | §3.4, straddling the glass | Always (routes with a footer) |
| **Window-bar row**, 15 mm below the panel | SteamVR's frame controls in one capsule, **left of** the window-bar pill, which is centred under the window | With the laser on the dashboard, or while the frame controls hold gamepad focus (SteamVR's rule; it plays visionOS's "chrome on look") |
| Dashboard bar | SteamVR's, 13 cm nearer (control-center concept) | Always |
| Floating hint | Only while the dashboard has no focus (§3.5.3) | Transient |

At rest without the laser: two rows (ornament, bar). With the laser: three. Today: four, plus the hint.

#### 3.5.2 The row's parts (`vr:systemui`, theme in `theme/vr/`)

| Element | Node | New look | Size | Placement | Evidence |
|---|---|---|---|---|---|
| Frame controls | `%{FrameControlsContainer}` › `%{Section}` › `.ButtonControl` | One panel-glass capsule; sections 20 px apart. Circles: rest white .10, hover + .08, `%{GamepadFocused}` + .30 and the specular arc, toggled (keyboard shown) white .94 with a dark glyph | Hit 107 × 107 systemui px (62 mm, 2.49°); visible 80; glyph 36 | Moved left so its right edge sits 26 view px (20 mm) left of the pill (T4: translation override on `bottom-controls-transform`'s child) | Size: E16 [PROVEN]. Move: [PLAUSIBLE], the same transform-override mechanism as E4 and E5b, where the laser target followed the panel |
| Close (game frames) | The button after the wide gap | A separate circle with × at the row's left end (visionOS's close sits left of the bar); red whole fill only on focus or hover | As above | With the capsule | — |
| Window bar | `%{GrabHandleBar}` in `%{GrabHandleButton}` | White .46 pill with a soft shadow; hover or drag white .92, 198 wide; Steam's scaleX grow stays | 467 × 32 grab px = 140 × 9.6 mm; hit area ≥ 132 px tall as today | **Moved up from under the dashboard bar to the row, centred under the window** (T4: `DashboardGrabHandleTransform` translation) | [PLAUSIBLE], same mechanism; its drag behaviour (grab-transform) is unchanged |
| Idle dim | `:not(:hover):not(%{HasGamepadFocus})` opacity .6 | Kept (SteamVR's rule); brighter fills compensate | — | — | steamvr.md §2.5 |
| Tooltips | `.ControlBarButtonTooltip` panels | Panel-glass capsule, 30 systemui px Semibold, 60 px tall, **below** the button | — | T4 transform flip [PLAUSIBLE]; fallback above (18 mm in front of the ornament) | — |
| More Options | `%{AdditionalOptions}` rows | Thick glass, radius 44, rows 96 systemui px (72 main px) with 8 px gaps; curvature as a real switch | 536 px wide | Above the More button | Verify only on a static mock (it moves SteamVR input focus) |
| Gamepad-mode pill | `%{ButtonPill}` | "Enter Gamepad Mode": blue whole fill. "Use Laser Mouse to Interact": quiet glass, white .70. Mixed case | Keep its padding (it sizes the quad) | — | T1 |
| Resize corner | `%{ResizeCorner}` / `%{ResizeSVG}` | An arc concentric with the glass corner (radius 54 + 12), 9 px stroke, white .72 → .92 on hover | Panel fixed at 100 mm | Lifted 64 px to the glass corner (T4 [PLAUSIBLE]); fallback the panel corner | T1 colour |

**Fallback for both moves:** SteamVR's own positions (frame controls centred under the window, grab handle under the bar), restyled. AT-17 decides from `DumpLaserOverlays` (targets registered at the new places with unchanged sizes) and an `hvgrab` look.

Shot: `p2_window-nav_chrome.png`.

#### 3.5.3 The floating hint (`floatingfooter`, non-interactive)

`%{FloatingVRFooter}`: `filter: brightness(.6) drop-shadow(...)` → `none`; content as a panel-glass capsule 44 popup px tall, radius 22; glyph badges 28 px; labels 20 popup px Semibold, mixed case, white .96: "View · Jump to Dashboard Bar", "L5 R5 · Laser Mouse". Steam shows it only when the dashboard has no focus, so it does not add a row in normal use. Shot: `p2_window-nav_toast.png`.

### 3.6 The pointer proxy (T2)

The native layer puts an opaque glassd cover over Steam's real panel and shows Steam's content as crops in front of it. The laser still hits Steam's real panel, so SteamVR's own laser dot is probably drawn behind the cover (spatial.md §2.4, native-e2e §5). No agent can see SteamVR's dot without a wearer. The shell therefore draws its own:

| Property | Value |
|---|---|
| Where | Every Steam document the native layer covers: `main`, `bar`, `frame.menu.*` (and `barpopup` when the control-center concept covers it) |
| Node | One `div.lgs-pointer`, `position: fixed`, `pointer-events: none`, `contain: strict`, top z-index |
| Look | A 16 px ring (2.5 px white .95) with a 6 px white core, a 1.5 px dark outer ring and a soft glow: readable on bright art and dark glass. Where SteamVR's own dot also shows at the same spot, the ring reads as its halo |
| Motion | Positioned with `translate` from `pointermove` (rAF-throttled, the same listener that writes the hover light's `--hx/--hy`); hidden on `pointerleave` and when the document loses the pointer. It moves only with the pointer, so nothing animates at rest |
| Why it always shows | It is part of Steam's texture, so it is in every base crop and every popped crop, in front of the cover, whatever SteamVR does with its own dot. In a popped crop it marks the element that will receive the click (the real hit), which is what the user needs |
| When | Whenever the native layer is on |

AT-0b verifies it on the device (CDP shots and an `hvgrab`).

### 3.7 Depth plan

Revision 1 relied on interactive crops for menus, alerts and sheets at +30–50 mm. Their registration is [PROVEN] but a click on them is [PLAUSIBLE], and only a wearer can close that (spatial.md §12). The default now uses only proven mechanisms.

| Element | Default (agent-verifiable) | With the wearer flag `lgs.flags.interactivePops` | How |
|---|---|---|---|
| Window glass, toolbar row, content | 0 | 0 | Cover + base crops |
| Content cards ≥ 150 px (focused or hovered; area concepts) | +15 static, non-interactive crop | +15, interactive | Parallax at 45° ≤ 20 px on a ≥ 150 px card |
| Source card while its menu is open | +5 | +15 | — |
| Tab bar | +25 | +25 | The popup's own transform (real panel) |
| Bottom ornament | 0 | 0 (Q11 variant) | Inset slab |
| **Menus, popovers, alerts** | **+10, non-interactive**; animated 0 → +10 on `depth` (441 ms) | +30, interactive; chrome-sourced menus appear at +30 with the materialize (no animated depth); card-sourced animate +15 → +30 | In-place crop |
| **Sheets** (incl. the search sheet) | **+10, non-interactive** | +30 → +50, interactive | In-place crop |
| Window dim during alerts and sheets | t1 `tint` .65 (spatial.md §5 [PROVEN]) | same | — |
| Toasts, window-bar row, tooltips | SteamVR's | SteamVR's | Their own quads |

- **Why 10 mm.** A non-interactive pop renders [PROVEN], and the laser passes through it to the real element [PROVEN, `skippingDueToNonInteractivity`]. The hit is offset from the drawn row by 10 mm × tan θ: 13 main px at θ = 45° (r = 1), ≤ 20 % of a 64 px row, ≤ 18 % of a 72 px row; 7.5 px at 30°. Steam draws the hover on the element actually hit and the pointer proxy marks it, so the user sees which row the click will reach.
- **Separation** comes mainly from the window dim (t1 tint), the slab's own glass and a depth shadow (0.4 px y and 1.2 px blur per mm, with a 6 mm floor for the shadow so +10 mm still reads).
- **Animated depth deltas** stay ≤ 20 mm in both columns (MO M4): 0 → +10 by default; with the flag, chrome-sourced menus appear at their depth instead of travelling 0 → +30.
- **The wearer flag** is off by default and listed in §11 (Q12). It is the only path to the larger depths.

---

## 4. Search: a sheet over the page you were on

### 4.1 Why it changes

Today search is a 1.23° strip whose focused state is a light-grey web form. Entering it replaces the page with Steam's results route; leaving needs Back; an empty query lists the whole library; the keyboard shows no echo 22–28° below the text (shell-nav B.4.1, B.5.2, B.6). visionOS treats search as a system feature with suggestions, recents and grouped results.

### 4.2 The model

Search stays on Steam's own routes (`/search`, `/search/tab/<Category>`) so that history, B, the keyboard, IME and every result path are Steam's. It is **presented** as a sheet over the page you were on:

1. On activation T2 takes a **context snapshot**: `cloneNode(true)` of the current page's content element (the child of `%{TopLevelTransitionSwitch}`), with every `id` removed, `inert` and `aria-hidden` set, the `scrollTop` of each scrolled descendant copied, and no event listeners (clones carry none). It is a decorative picture; Steam's FocusNavController never sees it, because focusables register through React context, not through the DOM.
2. The search route renders (T3 override, §4.9): the snapshot under a .35 scrim, then the sheet.
3. Because the snapshot is pixel-identical to the page that just left, the route transition is invisible: the page appears to stay while the sheet materializes over it.
4. Leaving (B, the back circle, a click on the dimmed page, any tab) is Steam's `NavigateBack`: the real page returns under the same picture, and Steam's focus history puts focus back on the poster you left.

The page you were on stays visible, and returning to it is one press. That is the behaviour of an overlay, while every search function stays Steam's route.

### 4.3 The trigger (what activates search)

The inventories disagree about Steam's own behaviour: shell.md §3 says focusing the field navigates to `/search/tab/All` (documented from CSS, not captured); library.md §1.2 says typing navigates. The design does not depend on either:

- **Activation = the header input receives DOM focus** (`focusin` on `%{SearchBox}`). A laser click gives it focus; Steam's gamepad focus (D-pad Up from the top row) calls `focus()` on it.
- On activation T2 takes the snapshot, and **if the route is not already `/search…`**, calls `inst.Navigate('/search')` (Steam's own `Routes.Search.Root()`). If Steam navigates by itself on focus, nothing is added; if it only navigates on typing, the sheet still appears on activation.
- The keyboard rises as Steam already raises it (`onKeyboardShow`).

AT-9a and AT-9b exercise the real trigger with both inputs and record what Steam itself does (revision 1's AT-9 called `L.nav` and bypassed it).

### 4.4 States

| State | Route | Sheet | Tier |
|---|---|---|---|
| Idle | any | — (the 520/640 × 64 capsule in the toolbar row) | T1 |
| Activated, empty | `/search` or `/search/tab/All` with an empty query | **Zero state**, 880 × 500 at (200, 100) | T2 snapshot + T3 |
| Typing | `/search/tab/All` + query | **Results**, 1040 × 520 at (120, 100); the width grows on `snappy` | T3 |
| Category | `/search/tab/{Library,Friends,Store,Tools,Hidden}` | Steam's own tabbed results page, hosted in the sheet (gate AT-9d) | T1 + T3 host |
| No results | any | Steam's "No Results Found" as centred Title 3 + a Callout hint | T1 |

The sheet: thick glass, radius 44, its top 14 px under the field, so it reads as growing down out of the capsule; content inset 40 (zero state) or 32 (results). The field itself stays Steam's input in the toolbar row, above the scrim, with the focus ring.

### 4.5 Zero state

Shot: `p2_window-nav_search.png`.

- **Recently Played**: five circles of 112 px (84 pt, 3.4°) on a 160 px pitch; art = the portrait capsule cropped at 50 % 28 % with the logo (DESIGN2 §9.2); labels Subheadline 20 px. Data `collectionStore.recentAppsCollection` (steam-react.md §3.7). A or a click → `Routes.Library.App.Root(appid)`. Focus: scale 1.10 + shadow + sheen.
- **Recent Searches**: 60 px capsules with a clock glyph; this session's queries (≤ 8) in SharedJSContext memory only, never on disk; a Steam restart empties it and the section hides. A or a click sets the query with Steam's store (`U.SetSearchText`, module 4399).
- **Show All Results**: a capsule that shows Steam's own page for the empty query (today's "list everything") in the sheet.
- Hint: Callout 22 px, white .70: "Type to search your library, friends and the Store."

### 4.6 Results

Shot: `p2_window-nav_results.png`.

- **One category control** at the sheet's top: Steam's categories as a 64 px glass segmented control with counts (white .70): All · Library · Friends · Store · Tools · Hidden (Hidden only with matches, as Steam does). ‹ › as 60 px plain circles. LB / RB step through it.
- **All = Top Results** when Steam's own search results are available to T3 (Q6, a finder for Steam's search hook; our component then calls Steam's hook, the way the prototype calls `useNonSteamApps`). Counts and items are Steam's, never our own matching:
  - **Top Hit**: a 300 × 170 card (hero art, name, status, an "Open" capsule; ☰ or the More circle for its menu). No Play: launching stays on the game page with its dialogs.
  - **Your library**: up to 4 posters 113 × 170 with name and install status.
  - **Every other category with matches** as a capsule with its count: Friends, Tools, Hidden (54 px visible on a contiguous 58 px pitch). Each opens Steam's own grid for that category in the sheet.
  - **In the Store**: the first 4 store results as 230 × 96 cards and "See All N ›" → Steam's Store grid, where "View more in the Store" stays the path to the store search.
  - Further sections (friend avatars, tools, hidden) follow below the fold; the sheet scrolls with a 26 px fade.
- **All without Q6**: the sheet hosts Steam's own All grid (every result Steam shows today, with Steam's own counts in its tab row). Nothing is ever hidden or recounted by the shell.
- **Categories** always host Steam's own tabbed page (`steamChildren`) in the sheet: Steam's virtualised grid, tab row (restyled as the segmented control), "View more in the Store". Hosting Steam's page in a smaller container is [PLAUSIBLE]: the grid measures its container. Gate AT-9d; fallback: Steam's page full-window, restyled (T1), and the sheet presentation only for the zero state and Top Results.

### 4.7 Keyboard and echo

The keyboard is SteamVR-placed under the window and owned by the social-media concept. This concept relies on its echo row (social-media C.2, SQ4): a display-only mirror of the field on the keyboard's slab, so the typing glance is about 5° instead of 22–28°. If SQ4 fails, the field still updates live in the toolbar row.

### 4.8 Paths

| Step | Laser | Gamepad |
|---|---|---|
| Start | Click the capsule | D-pad Up from the top row of any page (Main's `onMoveUp`) |
| Type | Point at keys | D-pad over keys + A |
| Leave the keyboard | Done, or click the window | Done / B |
| Into the results | Point | Down from the field enters the sheet (our `Focusable`s join the nav tree, steam-react.md §4 [PROVEN]) |
| Switch category | Click a segment, ‹ › or a category capsule | LB / RB; or D-pad to the control + A |
| Open | Click a card, poster, circle or "See All" | A |
| Item menu | The More circle, or "Options · <target>" in the ornament | ☰ on the focused item |
| Clear | × in the field | Backspace on the keyboard |
| Leave search | The back circle, a click on the dimmed page, any tab | B (our page's `onCancel` → `NavigateBack`) |

### 4.9 Implementation and fallbacks

- `overrides.set(Routes.Search.Root(), steam => jsx(LgsSearch, { steam }))` (steam-react.md §3.5 [PROVEN], 19/19 selftest).
- `LgsSearch` reads the query from module 4399's store and re-renders on the input's `input` events (or Steam's own reaction). It renders, inside a `GamepadPage` with an error boundary, `onCancel` = `NavigateBack`, unique keys and no plain DOM buttons (steam-react.md §7): the snapshot + scrim (a plain node; a click on it calls `NavigateBack`), then the sheet: zero state, Top Results (Q6) or `steam` (Steam's page) for categories, "Show All" and All-without-Q6.
- The snapshot lives in a module-level variable and is dropped when `LgsSearch` unmounts or on `lgs off`.
- **Fallback 1** (no page root found, e.g. a deep link): the sheet sits on plain window glass; the previous page's title (T2 route map) shows dimmed in the toolbar row.
- **Fallback 2** (T3 override unavailable): Steam's search page, restyled by T1 (capsule field, segmented control, title-case labels; row heights unchanged because the grid is virtualised).

---

## 5. System presentations

All of these render inside Steam's main window (ModalManager), except toasts, tooltips and the frame-control popout. The modal box runs from the header's height (108) to the footer's (628): **menus and dialogs have 520 px of height**.

### 5.1 Menus and popovers (Steam's gamepad context menu)

#### 5.1.1 Layout by item count (no menu scrolls)

Revision 1 used 72 px rows for every menu, which made the device's tile menu (6 actions + Cancel, because developer mode adds Developer ›), Sort By (10) and Downloads Options (8) scroll. T2 counts the actionable items of `contextMenuContents` (excluding Cancel) and sets one class:

| Items | Class | Layout | Rows | Header | Height | Width |
|---|---|---|---|---|---|---|
| ≤ 5 | — | One column | 72 px, 6 px apart | 40 px header row (22 px Bold, white .70) | ≤ 512 | 320–420 |
| 6–7 | `lgs-menu-compact` | One column | **60 px visible on a contiguous 64 px pitch** (the row element is 64 px; its fill is inset 2 px) | Inline: the label as a 26 px line (19 px Semibold, white .50) at the slab's top-left | 7 items: **504** | 400 |
| ≥ 8 single-level options | `lgs-menu-grid` | **Two columns**, column-major in Steam's DOM order: `display: grid; grid-auto-flow: column; grid-template-rows: repeat(ceil(n/2), 72px)`; Cancel spans both columns as the last item | 72 px, 6 px apart, 8 px between columns | 40 px header row | Sort By (10): **508**; Downloads Options (8): 434 | **592** (2 × 284 + 8 + 16) |

- **Cancel** stays Steam's appended item and the last in DOM order: a 56 px capsule centred under the rows, white .08 fill, Medium white .70.
- **Groups**: Steam's separators become 6–8 px of space, no line.
- **Submenus** (›) open beside the menu as Steam does; their own item count chooses their layout.
- **D-pad in the grid.** If Steam's nav node for `contextMenuContents` declares no layout, `GetLayout()` reads the grid as GEOMETRIC and the D-pad follows the picture (Left/Right between columns). If it declares `column`, Up/Down walk the same column-major order (Down from the last row of column 1 continues at the top of column 2); Left/Right do nothing. Both are usable; AT-12 records which one Steam uses.
- AT-11b checks every case on the device: `scrollHeight == clientHeight`, Cancel inside the slab, slab ≤ 520 × 600.

Shots: `p2_window-nav_menu.png` (7 items, compact), `p2_window-nav_sort.png` (10, grid), `p2_window-nav_power.png` (7 grouped, grid).

#### 5.1.2 Slab, states and tones

| Property | Value |
|---|---|
| Slab | `%{*BasicContextMenuModal>contextMenuContents}` → thick glass, radius 32, padding 8; Steam's `filter: drop-shadow` → the depth shadow; first/last margins 0 |
| Rows | Radius 24 (22 in compact), 26 px symbols left of 24 px labels (T2 decoration by tone class; none where unknown); trailing › for submenus |
| **Focus** (`%{*…>Focused}` / `.gpfocus`, `!important`) | + white **.30**, light spot .18, the row's own specular arc. With the laser, hover moves Steam's focus, so hover looks the same |
| **Checked / selected** (`.menuChecked`, `%{*…>Selected}`) | **Only a white check glyph** at the trailing end; no fill, so it looks like a resting row plus the check. In `p2_window-nav_menu.png` the focused row measures L 128 and an unfilled row L 63 (ΔL 65); AT-8c measures focus against a real checked row |
| Submenu parent open (`%{*…>active}`) | White .94, dark label |
| Primary | `.Play`, `.Launch` and the primary first row: green whole fill, white label. `.Install`, `.Update`: blue whole fill |
| Destructive | **≤ 2 destructive rows in the menu**: red label (Semibold) and red symbol at rest. **More than 2** (Power): red symbol, white label at rest (a wall of red labels carries no signal). Always a red whole fill on focus |
| Disabled | 40 % |
| Popovers | Same, sized to content, no arrow; > 40 % of the window → sheet rules |
| Dropdowns (Settings) | Same slab, anchored to the dropdown button, the current value checked |

#### 5.1.3 Anchor, morph and depth

- **Anchor (T2).** Steam always centres the menu. T2 keeps the source: the element under the last `pointerdown`, the More circle's card, or (for ☰) the `.gpfocus` element; then sets `translate` on `%{*BasicContextMenuHeader>BasicContextMenuModal}` so the slab sits beside it: 16 px right of a card (left if it would leave the window); above an ornament source, growing upward; aligned to the source's edge; clamped inside the modal box. Cross-quad sources (the Power tab) anchor to the window's leading edge at the source's height. `ModalClickToDismiss` is untouched. Fallback: centred.
- **Source.** A legend, slot-1 button, tab or More circle turns white while its menu is open; a card stays at +5 mm with a soft glow.
- **Scrim.** None: `.ModalOverlayBackground` is transparent while the overlay holds a `.BasicUIContextMenu` (`:has()`).
- **Morph.** `morph-open` (607 ms, b .20): `clip-path` from the source rect (T2 fills `--sx --sy --sw --sh --sr`) to the slab; content 15–50 %; items take input from the first frame. Every slab above is ≤ 600 × 600 (largest 592 × 508), inside the clip-path limit (DESIGN2 R9, MO §6.4). A larger slab would materialize instead (glass channel + swell, origin at the source side). Close: Steam removes the DOM, so CSS is instant; glassd plays `morph-close` (441 ms) on the slab in T5. Reduce Motion: a 180 ms cross-fade.
- **Depth.** +10 mm by default, 0 → +10 on `depth` (§3.7).

### 5.2 The Power menu

Steam's Power menu is a context menu (module 79100 → `showContextMenu`), so §5.1 applies: 7 actions → the grid layout.

- **Two groups side by side**: "This Device" (Sleep, Shutdown, Restart Device, Restart SteamVR) and "Steam" (Change Account, Sign Out, Restart Steam); Cancel spans below. **592 × 464 px**, within the 520 px box and the 600 px morph limit (revision 1's 712 px slab was not).
- The group labels are T2 decorative nodes (Footnote 18 px Semibold, white .50, `aria-hidden`); without T2, space separates the groups. In the grid the second group starts a new column with `grid-column: 2` on Steam's separator.
- Six of seven items are destructive: red glyphs, white labels at rest, red whole fill on focus (§5.1.2). This matches the control-center concept's D-CC1.
- **Default focus is not changed.** Steam's preferred focus may land on Restart SteamVR; moving it needs the user's approval (Q3).
- Anchored at the window's leading edge, bottom at 616 (top 152), beside the Power tab, which is white while the menu is open.
- Every item still opens Steam's own confirmation dialog (§5.3). The control-center concept adds a second entry point (its Power circle) and styles the confirmation.

### 5.3 Alerts (`ConfirmModal`, small dialogs)

| Property | Value |
|---|---|
| Card | `%{*GamepadDialogContent_InnerWidth>GamepadDialogContent}`: thick glass, radius 44, width 640 (19.5°), padding 36 36 28; Steam's border, `#0e141b` fill and `vw`/`vh` padding replaced |
| Type | Title Title 3 28 px Bold, left; body Callout 22 px Medium white .70, left; title case |
| Buttons | `button.DialogButton` as 60 px capsules side by side **in Steam's order** (`DialogTwoColLayout` is a nav row). Primary blue; `.Destructive` red; secondary white .10. Focus + .30, spot, arc (`!important`) |
| Text prompt | A 64 px recessed capsule with the focus ring |
| Scrim | `.ModalOverlayBackground` in `%{GamepadDialogOverlay}`: black .35, no blur; plus the t1 tint .65 on the window in the native layer |
| Chrome while open | Toolbar contents at opacity .45 (still clickable, as today); tab bar darkened; the ornament stays lit with the dialog's legends |
| Depth | **+10 mm**, non-interactive pop (+30 interactive behind the wearer flag) |
| Motion | Materialize 250 ms + swell 1.02 → 1; content 35–100 %; scrim 0 → .35 on `fade`. Replaces Steam's `.5s` card animation by naming our keyframes and repeating Steam's opacity end state (MO R3; sign-off Q2). The default button takes focus as soon as content passes 50 % |

Shot: `p2_window-nav_alert.png`.

### 5.4 Sheets (large dialogs, scrolling dialogs, the app-details overlay)

| Property | Value |
|---|---|
| Rule | A dialog whose card is wider than 640 px or taller than 40 % of the window (288 px) |
| Card | Thick glass, radius 44, max width 960 (75 % of the glass), centred in the modal box |
| Close | A 60 px circle at (24, 24) in the card: a T2 decorative node whose click dispatches the click Steam's `%{*…>ModalClickToDismiss}` handles (cancel). Laser-only; B is the gamepad path |
| Title | Title 2, 30 px Bold, centred; trailing actions as capsules at the 24 px inset |
| Scroll | `ModalPosition` keeps `overflow: hidden auto`; content fades under the card's bottom edge |
| Scrim, chrome | As alerts |
| Depth | **+10 mm** static, non-interactive (+30 → +50 interactive behind the wearer flag); window recede variant Q4 |
| Motion | `sheet-in` (735 ms): scale .97 → 1, content 25–70 %; `sheet-out` (514 ms), content out first, scale → .98 |
| App-details overlay | `%{Container>TransitionWrapper}` loses its blur and brightness → black .35; content materializes on `sheet-in` |

Shot: `p2_window-nav_sheet.png` (content: library concept).

### 5.5 Toasts (`notifications` quad, 340 × 80 popup px, placed by SteamVR)

| Property | Value (popup px) |
|---|---|
| Card | `%{ShortTemplate}`: 320 × 76, radius 30, panel glass; Steam's 1 px outline → none |
| Icon | `%{ShortTemplate>ShortLogoDimensions}`: a 48 px circle |
| Text | Title 20 px Semibold white .96; body 18 px Medium white .70; one line each; `%{TwoLine}` clamps the body to 2 lines and the card grows to 80 |
| Friend toasts | `%{ShortTemplate>AvatarStatus}` → a 3 px ring in the state colour |
| Incoming call | Green whole fill (Steam's gradient) |
| Motion | Materialize in place, 250 ms; translate −8 → 0 on `snappy`; swell 1 + 12/320. Replaces `toastEnterVR` in Steam's animation list, **keeping `toastExitVR`** (MO §4.10). Out: dematerialize 350 ms |
| Scope | Never scoped to `body.GamepadMode` (the window's body has only `.LowPerfMode`, LAB) |

Shot: `p2_window-nav_toast.png`.

### 5.6 Tooltips

Steam's popup tooltips: a panel-glass capsule, 20 px Semibold, after Steam's delay (owner: control-center concept). SteamVR frame-control tooltips: §3.5.2.

---

## 6. Navigation model

### 6.1 Where things are

| Need | Laser | Gamepad |
|---|---|---|
| Know where I am | Large Title + the current route's circle in the always-visible tab bar | Same |
| Change section | Click a tab-bar circle (labels after Steam's 500 ms hover) | D-pad Left at the content's left edge, or B at the window root: the bar takes focus and expands at once → Up/Down → A. Right or B returns |
| Go back | The Back circle (previous title after 0.6 s) | B |
| Search | The search capsule | D-pad Up from the top row |
| Act on the thing I looked at | The More circle on it, or the ornament's named Options (frozen target) | ☰ / X / Y / A, as the ornament's glyph hints say |
| Page actions (sort, filter) | Ornament slot 1 (laser mode) | Y / X |
| Window controls | The window-bar row (visible with the laser) | D-pad Down from the window's bottom row → frame controls → Left/Right → A |
| Move the window | Drag the window bar | — (as today) |
| The dashboard bar | Point at it | View ("Cycle View"); the floating hint says so |
| Power | Tab bar › Power; Control Center › Power (control-center concept) | Tab bar › Power |

### 6.2 What B does (unchanged, now visible)

1. A menu or dialog is open: close it. 2. The search sheet is open: close it (back to the page). 3. A nested page: go back. 4. The window root: open the tab bar. The ornament's B legend (gamepad mode) names the current meaning, because Steam supplies the label (our search page supplies "Close").

### 6.3 Input modes

Steam switches between gamepad mode and laser mode from SteamVR's overlay-focus messages (`IsInGamepadNav`). The shell mirrors it as `html.lgs-gp` / `html.lgs-laser` (T2, read-only) and uses it for the ornament's members (§3.4.2) and the frozen target (§3.4.3). Focus illumination (+ .30, spot, arc) is the same in every quad: Steam's `.gpfocus` and `%{*…>Focused}`, SteamVR's `%{GamepadFocused}` and `%{HasGamepadFocus}`, SteamVR's `%{FocusRing}` (its 20 × 1.2 s pulse becomes one static state), and the bar's ring hint. Moving focus between the window, the tab bar, the frame controls and the bar reads as one moving light.

---

## 7. Motion

All tokens are DESIGN2 §11 (MO). Durations are spring settling times.

| Interaction | Token | What moves | Must not |
|---|---|---|---|
| Hover in / out | `hover-in` 294 / `fade` 441 | Light spot, fill alpha | Scale, outline |
| Gamepad focus | `hover-in`, first frame ≥ 60 % (static `!important` fill) | Illumination, specular arc | A travelling indicator, scale |
| Press | `interactive` 210 in, glow off 90 ms, swell back `snappy` 488 | Glow, swell ≤ ×1.06 | Delaying the action |
| Back reveal | 0.6 s delay, width `snappy`, label cross-fade 150 ms | Capsule width | Moving the circle |
| Tab bar expand / collapse | Steam's timers (500 / 800 ms); Steam's width transition retimed to `snappy` / `fade` (timing properties only) | Width, label opacity | Setting width |
| Tab selection change | Cross-fade on `fade` (T1); the circle travels on `snappy` (T2 option) | Circle | Tab sizes |
| Segmented control | Pill travel `snappy` 488 | Pill x and width | Labels |
| Route change | Old content out 150 ms linear; new content in + `translate` ±16 px (T2 direction; 0 in T1) on `page` 662, 40 ms delay (MO §6.4; sign-off Q2) | Opacity, translate | Scaling the 38° window, re-animating chrome |
| Tab content (library, search categories) | ±16 px + fade on `page` (replaces Steam's ±40 % slide) | | Full-width slides |
| **Search sheet present** | `sheet-in` 735: glass from the field (scale .97 → 1, origin at the field's centre-bottom), content 25–70 %, the page you were on dims 0 → .35 on `fade`, z 0 → +10 on `depth` | Glass, scrim, z | Moving the field |
| Search sheet zero state → results | Sheet width 880 → 1040 on `snappy`; sections cross-fade on `fade` | Width | Height jumps |
| Search sheet dismiss | `sheet-out` 514, content first | | |
| Menu open / close | `morph-open` 607 [b20] (clip-path, ≤ 600 × 600) / `morph-close` 441 (glassd); z 0 → +10 on `depth` | Shape from the source, θ, z | Content scale; animated depth > 20 mm |
| Alert | Materialize 250 + swell 1.02 → 1; scrim `fade` | Glass channel, scrim | Shake, bounce > .15 |
| Sheet | `sheet-in` / `sheet-out`; z 0 → +10 on `depth` | Glass, scale, z | Parent motion in CSS |
| Toast | Materialize 250 + `snappy` −8 → 0 / dematerialize 350 | Glass, content | Slide from the edge |
| Ornament legend change | Label cross-fade 150 ms; backing width `snappy` (T2) | | |
| More circle appear / leave | Materialize 250 / dematerialize 350 | Glass channel | Pop-in |
| Pointer proxy | None (follows the pointer) | — | Any animation |
| Window open | glassd ramps the cover on `sheet-in` | Optics | Window position |
| Scroll edge | Scroll-linked over 24 px | Band opacity | Blur radius |

- **Reduce Motion**: bounce 0; scale, translate and z become fades; materialize becomes a 180 ms cross-dissolve; the morph becomes a fade in place.
- **At rest**: `document.getAnimations().length === 0` one second after any interaction on `main`, `frame.menu`, `notifications` and `vr:systemui`.

Storyboard: `p2_window-nav_motion.png` (the closed-form spring sampled at f = 0, .15, .35, .6, 1).

---

## 8. Materials, the native gate and degraded glass

### 8.1 Summary

| Element | T5 (glassd) | T1 (CSS) | Edge |
|---|---|---|---|
| Window | `window` cover, shape = the glass rect | Smoky tint + edge (§8.4) | Rim 2 px .78, dark edge 16 px .20 |
| Tab bar capsules | `liquid` covers on the popup's panel | Panel tint `rgb(28 30 40 / .78)` + edge | Rim 1.5 px ×1.10, dark edge 6 px .12 |
| Bottom ornament | `liquid` slab behind (inset) | Backdrop blur 12 + saturate 1.7 | Liquid |
| More circle | `liquid` slab under it at +15 mm | Backdrop blur over the card | Liquid |
| Search field, platters | Fills on glass | Black .30 well / black .14 platter | None |
| Menus, alerts, sheets, search sheet | `thick` slab under the pop | Blur 30 + tint .30–.40 | Rim 1.5 px .85, dark edge 12 px .20, shadow by depth |
| Toasts, hint, window-bar row, tooltips | `panel` covers | Panel tint + edge | Rim 1.5 px .90 |
| Window bar | — | White .46 | Soft shadow |

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

AT-23 requires ratio ≤ 0.35 on the device, and AT-20 the same profile in an `hvgrab` frame for glassd's rim. glassd must draw its rim the same way: bright where the edge faces the light, near zero on the sides and bottom (native-e2e §2).

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

### 8.3 The native gate (AT-0): when real glass is the default

The user's brief requires full glass, which only glassd (T5) can draw over the room. NATIVE.md keeps the native layer off by default "until a wearer has checked input, the cursor dot and window resizing". The user is unavailable, so the shell replaces each wearer check with an agent check:

| Wearer check (NATIVE.md) | Agent check | Pass |
|---|---|---|
| Laser input reaches Steam through non-interactive layers | `DumpLaserOverlays` with `lgs on --native`: every glassd cover, slab and base piece is under `skippingDueToNonInteractivity`; the main, `frame.menu` and bar panels are laser targets with unchanged `fWidth`/`fHeight` (spatial.md §2.1: non-interactive panels are passed through [PROVEN]) | All listed |
| The cursor dot is visible | The pointer proxy (§3.6): AT-0b | Ring found in CDP shots and in the `hvgrab` frame over the cover |
| Resized windows stay aligned | This device already runs at r = 0.863: an `hvgrab` frame shows cover edges and crop edges registered with Steam's content | Misregistration ≤ 3 view px; no mosaic hairlines |
| Cost | `glassd` GPU and the compositor frame time (NATIVE.md's cost measure) | glassd ≤ 1.5 ms; compositor frame time within 5 % |

The cover flags NATIVE.md documents for the dot (`{"all": {"sort-depth-bias": -0.5}}`, then `{"cover": {"no-depth-test": true}, "base": {"no-depth-write": true}}`) are tried in AT-0c in that order; each must leave the `hvgrab` look unchanged (they cannot be judged further without a laser). The first that renders identically stays on: if SteamVR's dot is drawn in front because of it, it coincides with the proxy ring.

**Decision.** If AT-0 passes, Phase 2 turns the native layer on by default (`lgs on` = `--native`; the toggle in + › Launch Program › Liquid Glass does the same). The remaining wearer-only items (comfort of depths, a real click on popped crops) do not block it, because the default depths use only non-interactive pops (§3.7). If AT-0 fails, Phase 2 ships CSS-only with the degraded spec below, and says so.

### 8.4 Degraded glass (native layer off)

What T1 can and cannot do: CSS cannot see the room, so it cannot frost or lens it. It can draw the material's other cues.

| Element | Degraded look |
|---|---|
| Window | `rgb(20 22 30 / .74)` (the dial .60–.84) + a vertical sheen (white .08 → 0 over the top 30 %) + the §8.2 edge lobe + dark inner edge 16 px .20 + depth shadow; radius 54 |
| Ornament | Over the window content: in-page blur 12 + saturate 1.7 (it frosts Steam's own content); outside the window: tint .70 + edge |
| Tab bar, toasts, hint, window-bar row | Panel tint `rgb(28 30 40 / .78)` + edge |
| Menus, alerts, sheets, search sheet | In-page blur 30 over Steam's content (works in T1) + tint .40 + edge + shadow |
| Depth | None (no crops); shadows only |

Shot: `p2_window-nav_anatomy_t1.png`. It is honest tinted glass with light-from-above edges, not Liquid Glass of the room.

---

## 9. Function retention table

Every function in `audit/shell-nav.md` §A, and every function from the other audits that these surfaces present, with its new place and both paths. "Same" means the path is unchanged. Nothing is removed.

### 9.1 Header and search

| # | Function | New place | Laser | Gamepad | Tier |
|---|---|---|---|---|---|
| H1 | Go back (history) | Back circle (80 × 80 hit); previous title after 0.6 s | Click | B (same); "Back" legend in gamepad mode | T1 (+T2) |
| H2 | Start a search | Search capsule; on hero routes a 60 px magnifier circle | Click (DOM focus → the sheet) | D-pad Up from a page's top row (same) | T1 + T2 + T3 |
| H3 | Type / edit the query | Steam's VR keyboard + echo row | Click keys | D-pad + A (same) | social-media concept |
| H4 | Clear the query | × circle, 44 px | Click | Backspace (same) | T1 |
| H5 | Title mode | Centred Title 2 | — | — | T1 |
| H6 | Browser mode URL bar | 640 × 64 capsule | Click (same) | Focus + A (same) | T1 |
| H7 | Account / support alert | 60 px circle top-right | Click (same) | Focus + A (same) | T1 |
| S1 | Switch result category | The sheet's segmented control + ‹ › + category capsules | Click | LB / RB (same); D-pad + A | T3, T1 |
| S2 | Open a result | Top Hit, posters, capsules, store cards (All); Steam's grid tiles (categories) | Click | D-pad + A | T3, T1 |
| S3 | "View more in the Store" | Steam's Store grid in the sheet (unchanged), reached by "See All N" | Click | Focus + A | T1 |
| S4 | Leave search | Back circle, the dimmed page, any tab | Click | B | T1, T3 |
| S-T | See Tools, Hidden, Store results (All tab today) | Category capsules with counts and the "In the Store" row on All; or Steam's All grid when Q6 is unresolved | Click | D-pad + A | T3 / T1 |
| — | Empty query lists everything | "Show All Results" capsule | Click | Focus + A | T3 |
| NEW-1 | Reopen a recent game from search | Recently Played circles | Click | Focus + A | T3 |
| NEW-2 | Repeat a recent search | Recent Searches capsules (session memory) | Click | Focus + A | T3 |
| LA S4 | No results message | Centred Title 3 + hint | — | — | T1 |

### 9.2 Navigation (`frame.menu`)

| # | Function | New place | Laser | Gamepad | Tier |
|---|---|---|---|---|---|
| N1 | See the menu and the current section | Always-visible tab bar (fallback laser-visible) + Large Title; current route = circle | Look | Look | T1, T2, T3/T4 |
| N2 | Go to Home, Library, Store, Friends & Chat, Media, Downloads, **Console**, Steam Settings, Help (setup), VR Settings | Tab-bar circles (live pitch) | Click (same) | D-pad Left at the page edge → Up/Down + A; Right/B back (same) | T1 + T2 |
| N3 | Open the menu from anywhere | Same | — | B at the window root (same) | — |
| N4 | Same items via the bar's Steam tab menu | Unchanged (control-center concept) | Hover (same) | Bar focus (same) | — |
| N-P | Power | System capsule › Power → Power menu (§5.2) | Click | Focus + A | T1 |
| SY A.1.1 | Reach Steam Settings | Tab bar › Steam Settings | Click | As N2 | T1 |
| SY A.2 | Reach SteamVR Settings (laser-only page) | Tab bar › VR Settings | Click | As N2 (the page stays laser-only; settings concept) | T1 |

### 9.3 Ornament, legends and hints

| # | Function | New place | Laser | Gamepad | Tier |
|---|---|---|---|---|---|
| F1 | Perform the focused element's actions (X, Y, ☰, A, B) | Ornament members: real buttons, label + trailing glyph | Click (same handler); Options acts on the frozen target | The physical button (same) | T1 + T2 |
| F1-A/B | A Select / B Back legends | Gamepad mode: quiet members. Laser mode: hidden (Q13) | Click the element itself (Select); the Back circle (Back) | A / B (same) | T1 |
| L6 | Sort (10 options), laser-mode pill | Ornament slot 1: "↑↓ <current sort>" | Click | Y (legend "Sort By") | T1 |
| L7 | Filter, laser-mode pill | Ornament slot 1: "Filter" | Click | X | T1 |
| L8 / LA A.3 | A tile's menu (Play/Install, Favorites, Add To ›, Manage ›, **Developer ›**, Properties, Cancel) | More circle on the card; ornament "Options · <target>"; compact 7-item slab | Click the More circle, or Options (frozen target) | ☰ then D-pad + A | T1 + T2 |
| SM D6 | Downloads item Options (Uninstall first, Remove, View in Library, Favorites, Add To ›, Manage ›, Developer ›, Properties) | More circle on the row; ornament Options; 8 items → two columns, Uninstall red at rest | Click | ☰ | T1 + T2 |
| SM A.10 | Legend-only groups (friend menu, media Filter, Select Game, Delete Clip, Change Device, store menu, Add to Cart) | Ornament members (labelled) or the More circle on the row | Click | The physical button (same) | T1 + T2 |
| SY S12 | Settings explainer ("Y for more info") | Ornament "More Info Y" | Click | Y | T1 |
| SY S13 | Storage row actions (Uninstall, Move Content) | Ornament members | Click | X / Y | T1 |
| FF1 | Learn Cycle View and Laser Mouse | Full-brightness hint capsule | — (hint) | The shown buttons (same) | T1 |

### 9.4 Modals, alerts, sheets

| # | Function | New place | Laser | Gamepad | Tier |
|---|---|---|---|---|---|
| M1 | Confirm / cancel | Alert capsules in Steam's order; click outside = cancel (same) | Click | Left/Right + A; B (same) | T1 |
| M2 | Single-button alert | Same | Click | A / B | T1 |
| M3 | Text prompt | 64 px recessed field | Click → keyboard | Focus + A → keyboard | T1 |
| M4 | Scroll a long dialog | Sheet; `ModalPosition` scrolls | Wheel / drag | D-pad (same) | T1 |
| M5 | Header and footer during a modal | Toolbar recessed but clickable; ornament lit with the dialog's legends | Same | B to the dialog (same) | T1 |
| NEW-3 | Close a sheet with a visible control | Close circle top-left | Click (= click outside) | B | T2 |
| LA A.4 | Library Filters dialog | Sheet (content: library concept) | — | — | T1 |
| GP | Game-page modals | Alert or sheet by size | Same | Same | T1 |
| — | App-details overlay | Scrim .35, materialize | Same | Same | T1 |

### 9.5 Context menus, Power, dropdowns

| # | Function | New place | Laser | Gamepad | Tier |
|---|---|---|---|---|---|
| C1 | Choose an item | Slab grown from its source; count-based layout, no scroll | Click | D-pad + A (same; geometric in the grid if Steam declares no layout) | T1 + T2 |
| C2 | Open a submenu | Row with ›; submenu beside it (Steam's) | Click | A or Right (same) | T1 |
| C3 | Toggle a checked item | Row with a check glyph | Click | A | T1 |
| C4 | Dismiss | Cancel capsule (last), click outside | Click | B (same) | T1 |
| C5 | Scroll a long menu | Not needed for any menu measured; Steam's scroll stays if a menu exceeds 14 items | Wheel | D-pad | T1 |
| SY A.5 | Power: Sleep, Shutdown, Restart Device, Restart SteamVR, Change Account, Sign Out, Restart Steam, Cancel | Two-group Power menu, 592 px; each item opens Steam's confirm dialog | Click | D-pad + A; B | T1 + T2 |
| GP A.3, A.4 | Manage menu, Play-from menu | Same slab, anchored to the gear / Play | Click | D-pad + A | T1 + T2 |
| SY S6 | Settings dropdown values | Same slab, anchored to the dropdown, value checked | Click | A, Up/Down + A, B | T1 + T2 |
| LA sort | Sort By choices | Two-column slab grown up from the white Sort button | Click | Y → D-pad + A | T1 + T2 |

### 9.6 Toasts

| # | Function | New place | Laser | Gamepad | Tier |
|---|---|---|---|---|---|
| T1 / SY NO4 | Read a toast | 320 × 76 card where SteamVR places it; click behaviour Steam's | Look / hover | Look | T1 |
| SY NO5 | SteamVR's own toasts | Same card language (theme/vr) | Look | Look | T1 |
| SY NO2 | Read the list | Quick Access › Notifications (control-center concept) | — | — | — |

### 9.7 Page transitions

| # | Function | New place | Laser | Gamepad | Tier |
|---|---|---|---|---|---|
| A.8 | Route changes gate input for ~800 ms | Exit 150 ms, enter 662 ms with ≤ 40 ms delay; nothing blocks input (MO C6) | — | — | T1 (sign-off Q2) |

### 9.8 SteamVR window chrome

| # | Function | New place | Laser | Gamepad | Tier |
|---|---|---|---|---|---|
| W1 | Move the window | Window bar, now in the window-bar row (fallback: under the bar) | Drag (same) | — (same) | T1 + T4 |
| W2 | Resize the window | Resize arc at the glass corner (fallback: panel corner) | Drag (same) | — (same) | T1 (T4 lift) |
| W3 | Show/hide the keyboard | Frame-control circle 1 (white when shown) | Click | D-pad Down → Left/Right → A (same) | T1 |
| W4 | Float in World / View in Theater | Circles 2–3 | Click | Same | T1 |
| W5 | More Options › Curvature, Dock Left/Right | Circle 4 → thick-glass popout | Click | Same (SteamVR focus) | T1 |
| W6 | Close (game frames) | Separate circle at the row's left | Click | Same | T1 |
| W7 | Tooltips | Capsule below the button | Hover | Focus | T1 (T4 flip) |
| W8 | Gamepad-mode pill | Tinted / quiet capsule | Click (enter variant) | — | T1 |
| W9 | Now Playing frame | Owner: game-pages concept | Same | Same | — |
| W10 | SteamVR Settings page | Via the tab bar (settings concept) | Same | — (as today) | — |

### 9.9 Bar entries (owner: control-center concept)

B1–B12 of `audit/system.md` §A.3 stay on the bar; this concept changes none of them and relies only on View ("Cycle View") for gamepad access to the bar.

---

## 10. Implementation tiers and evidence

| Element | Tier | Evidence | Fallback |
|---|---|---|---|
| Window glass | T5 + T1 | Covers with `shapes` [PROVEN-P1]; the window cover renders (native-e2e). Default-on only through AT-0 | Degraded spec §8.4 |
| `BasicUiRoot` radius 54 | T1 | Paint property | 6 px clip under 54 px glass |
| Ornament margin (glass 656) | T1 | `:has()` (Chromium 126); footer height measured by Steam | Full-height glass |
| Toolbar row 108 px | T1 + T3 | `!important` var + `HeaderStore` write; CQ1 [UNPROVEN], AT-2 | §3.2's three-rule fallback (page padding, scroll-padding, modal padding) |
| Back circle, Large Title, previous title | T1, T2 | Plain nodes; AT-5 | Omit the decorations |
| Search capsule | T1 | Inventory shell §3 | — |
| Search trigger + snapshot | T2 | `focusin` on Steam's input; `cloneNode` is plain DOM in Steam's document; focusables register through React context (steam-react §4), so clones are inert to the nav tree | Fallback 1 (§4.9) |
| Search sheet, zero state, Top Results | T3 | Route-render override [PROVEN, 19/19]; data stores §3.7; Steam's hook via finder (Q6) [UNPROVEN] | All = Steam's All grid; fallback 2 |
| Steam's results page hosted in the sheet | T3 | `steamChildren` rendering [PROVEN]; in a smaller container [PLAUSIBLE], AT-9d | Full-window Steam page |
| Tab-bar shape, sizes | T1 | Steam's component variables (bar.md §3) | — |
| Tab-bar live pitch | T2 + daemon | Variables written by the shell; inputs read-only from systemui (spatial.md §1.2 snippet, `GetTransformForOverlayCoordinates`) | Fixed p 52 (fits r ≥ 0.86 in the worst case) |
| Tab bar always visible | T3/T4 | Flag honoured (E2); clearing it [PLAUSIBLE] | Laser-visible |
| Tab bar +15 mm | T4 | t1 translation [PROVEN]; side panel [PLAUSIBLE] | Steam's +10 mm |
| Bottom ornament + contract | T1 + T2 | `#Footer` restyle; `#Footer::before` free; `SortAndFilterContainer` absolute already | Two adjacent capsules |
| Input-mode classes | T2 | Read of Steam's getter (module 84114), no write | Gamepad-mode layout always |
| Frozen target | T2 | `pointerdown`/hover listeners; `BTakeFocus(3)` (used by the lab) | Today's behaviour (legend acts on current focus); the More circle still works |
| More circle | T2 | Dispatches Steam's `vgp_onmenu` (inventory library §0.3) | Ornament Options |
| Legend hiding in laser mode | T1 | Needs sign-off Q13 | Glyph-only circles |
| Pointer proxy | T2 | A fixed node moved on `pointermove`; CDP-verifiable (AT-0b) | — |
| Window-bar row moves | T4 | Transform overrides on SteamVR's own panels [PLAUSIBLE]: E4/E5b show laser targets following | SteamVR's positions |
| Frame controls, More Options, pill, window bar, resize arc | T1 (`theme/vr`) | E16 [PROVEN] | — |
| Menu slab, rows, tones | T1 | Inventory shell §7 | — |
| Count-based menu layouts | T2 class + T1 CSS | `GetLayout` reads CSS (game-pages §0.5); AT-11b, AT-12 | One column with Steam's scroll |
| Menu anchoring | T2 + T1 `translate` | Plain CSS on the modal child; AT-11 | Centred |
| Menu morph | T1 + T2 | MO §6.4 (clip-path ≤ 600 × 600) | Materialize |
| Depth of menus, alerts, sheets | T4 | Non-interactive pops render [PROVEN]; pass-through [PROVEN] | Flat + shadow |
| Interactive pops (+30/+50) | T4 | Registration [PROVEN], click [PLAUSIBLE] | Wearer flag only (Q12) |
| Window dim | T4 | t1 `tint` [PROVEN] | CSS scrim only |
| Toast | T1 | hud.md §4 | Steam's motion |
| Route transitions | T1 (+T2) | MO §6.4; AT-15 (CQ6) | Steam's timing |

**Removal.** `lgs off` restores everything; a Steam restart or reboot gives the stock UI: the T3 override removed (`patchedLeft: 0`); the popup wrapper and the frame-menu flag restored; every transform override (tab bar, frame controls, grab handle, tooltips, resize corner) restored, each with a TTL in the page as a safety net (spatial.md §9.5); T2 nodes, listeners, the snapshot, the pointer proxy, the More circle and the input-mode classes removed; the recent-search list dropped; `--lgs-tab-pitch` removed.

---

## 11. Open questions and decisions needing sign-off

| # | Question | Default until answered |
|---|---|---|
| Q1 | CQ1: does the 108 px header (var + `HeaderStore`) hold? (AT-2) | §3.2 fallback |
| Q2 | Overriding Steam's route, card and context-menu entrance animations (lifts a Phase 1 ban) | Steam's timing |
| Q3 | Power default focus on Sleep or Cancel instead of Steam's preference | Steam's |
| Q4 | Sheet push-back variant (window −50 mm) | Sheet comes forward |
| Q5 | Frame-height override 1.6 | Off |
| Q6 | A finder for Steam's search hook (Top Results) | All = Steam's All grid |
| Q7 | CQ3: always-visible tab bar | Laser-visible |
| Q8 | Audit exception: Steam's "Back" text replaced by the chevron | Required for the circle |
| Q10 | T4 moves of SteamVR panels (frame controls, grab handle, tooltips, resize corner) | Steam's positions (AT-17 decides plausibility; sign-off for the change in layout) |
| Q11 | Ornament pop with an occluder | No pop |
| Q12 | The wearer flag `interactivePops` (+30 / +50 mm with interactive crops): needs one wearer session (spatial.md §12 checks) | Off: +10 mm non-interactive |
| Q13 | Hiding Steam's A/B (and duplicate X/Y) legends in laser mode: a deliberate exception to LAB's "never `display:none`"; every hidden legend has an equal visible path | Glyph-only circles |
| Q14 | Native layer default-on when AT-0 passes (coordinator decision; NATIVE.md's opt-in rule changes) | CSS-only until AT-0 passes |

Revision 1's Q9 (Power as a grid) is no longer a sign-off: the count rule applies to every menu, and AT-12 records how Steam's D-pad walks the grid; both outcomes are usable (§5.1.1).

---

## 12. Deviations from DESIGN2 (and why)

| # | DESIGN2 | Here | Reason |
|---|---|---|---|
| D-1 | Glass 1280 × 664, ornament 636–720 | Glass 656, ornament 628–712 | SteamVR's window-bar row sits 19 px below the panel; DESIGN2 §4 asks ≥ 24 px clearance |
| D-2 | Tab-bar items 56 at 72 popup px pitch; ≥ 72 main px for fixed quads | Live pitch: 58 (r = 1, Console on), floor 52 | 10 destinations; 72 would need 764 popup px against 653 available |
| D-3 | Title at x 40 | x 100 | Back is on every route |
| D-4 | Search width min(640, 50 %) | 520 on section roots, 640 elsewhere | Room for the Large Title |
| D-5 | Menu header 56 px; rows 72 | 40 px header; compact menus 60/64 with an inline 26 px label; grid menus for ≥ 8 | The 520 px box; no menu scrolls |
| D-6 | Tab bar expands over content | Outward | Steam right-aligns the popup |
| D-7 | Ornament +25 mm | 0 | Ghost rule (native-e2e §1) |
| D-8 | Search capsule with a microphone | None | Steam has no dictation |
| D-9 | Frame-control circles 64–80 systemui px | 80 visible, 107 hit | 107 systemui px = 60 pt |
| D-10 | Selected tab: white .18 platter | A .16 circle only; focus = a .30 pill | Shape and ΔL ≥ 25 between focus and selection |
| D-11 | Gamepad focus + .14 | + .30 in navigation, menus and the ornament | Critique: focus must stand out from selection |
| D-12 | Menus +30, sheets +30 → +50 (interactive crops) | +10 non-interactive; the larger depths behind the wearer flag | Only proven mechanisms by default |
| D-13 | Bar centred on the glass | Centred on the glass when it fits; otherwise spans the panel and ends level with the ornament | Ten destinations do not fit the glass |
| D-14 | Grab pill under the dashboard bar | In the window-bar row under the window | visionOS order; one row instead of two |
| D-15 | E3 with a faint linear top layer | A radial lobe | The linear layer read as a full-width line on wide slabs |
| D-16 | Destructive: red label at rest | Red label when ≤ 2 destructive rows; red glyph + white label when more | A wall of red carries no signal (Power) |
| D-17 | Search sheet (DESIGN2 §7.5) hands off to Steam's route on typing | The whole search stays in the sheet; Steam's route underneath | Context stays visible; results never replace the page visually |

---

## 13. Acceptance tests (agents only, no wearer)

All Steam steps use LAB's locked atomic forms (`shot`/`audit`/`outline` with `--route`/`--pre`). They never press A on Steam's nodes (exception: AT-9b presses A on the header search field only, which raises the keyboard; the keyboard is hidden again with `SteamClient.OpenVR.Keyboard.Hide()` in the same step), never confirm, launch, change a setting or touch power items. Gamepad sequences first call `SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.FocusApplicationRoot()` (steam-react §4). Synthetic menus and dialogs use `docs/inventory/shell.md` §0.2 (CONFIRM, ALERT, MENU, SUBMENU, POWER, ZOO). `hvgrab` frames are looked at and deleted. `M` = `python docs/phase2/concepts/window-nav-measure.py`.

| # | Test | How | Pass |
|---|---|---|---|
| **AT-0a** | Native gate: pass-through | Lab lock (`lab.lock` + `lab-vr.lock`): `python glass.py on --native`; `OverlayStore.DumpLaserOverlays()` | Every glassd cover, slab and base piece under `skippingDueToNonInteractivity`; main, `frame.menu`, bar targets present with sizes equal to CSS-only mode |
| **AT-0b** | Pointer proxy | In `main`: dispatch `pointermove` at (x, y) on three points (a poster, a MENU row, an ornament member) and `shot main` each; then `pointerleave` and shot again; `M ring WITH WITHOUT x y` (×1.5 for shot px). With native on: `hvgrab` while the synthetic pointer sits on the poster | Ring centroid within 2 px, peak ≥ 50 L, spread ≤ 12 px; in the `hvgrab` frame the ring is visible over the cover at the poster |
| **AT-0c** | Alignment, flags, cost | `hvgrab` at the current r (0.863); then the two flag sets of §8.3, each followed by `hvgrab`; NATIVE.md cost measure | Cover and crop edges within 3 view px of Steam's content; no hairlines; flags change nothing visible; glassd ≤ 1.5 ms, compositor within 5 % |
| AT-1 | Tokens | `python glass.py status` | 0 unresolved tokens |
| AT-2 | Header height (CQ1) and modal top | `--pre` AllGames: computed `--basicui-header-height`, `HeaderStore.m_flCurrentHeaderHeight`; 6× `L.pad('down')` and 6× `L.pad('up')` recording the `.gpfocus` rect; then CONFIRM and MENU: read `ModalPosition` and the menu slab's top. Repeat with the CQ1 fallback forced | 108 / 108 (or the fallback active); every focused rect top ≥ 108, bottom ≤ 628; modal and menu tops ≥ 108 in both cases |
| AT-3 | Toolbar geometry | `styles` on `%{BackContainer}`, `%{SearchAndTitleContainer}`, `%{SearchBox}` on AllGames, a game page, `/controller/calibration/0` | Back 80 × 80 at (14, 14); search 536 × 80 (656 nested); upright 24 px placeholder; title mode centred |
| AT-4 | Function audit | `python glass.py audit main` on Home, AllGames, a game page, `/downloads`, `/controller/calibration/0`, SEARCH('half','All'), SEARCH('half','Store'), CONFIRM, ALERT, MENU, POWER (look only), ZOO('Scroll Panel Test'); `audit frame.menu.<id>` | GONE / HIDDEN / UNCLICKABLE = 0 except the listed exceptions (Q8 Back label; Q13 legends in laser mode); SHRUNK only where the new hit is ≥ 80 px (≥ 58 popup px in the tab bar) |
| AT-5 | Back click | `L.nav` Home → AllGames → `L.click('main','%{BackContainer}')` | `/library/home` |
| AT-6 | Ornament geometry | On AllGames: rects of `#Footer`, `%{FooterLegend}`, legends; `--gamepadui-current-footer-height`; `L.click` on the Back legend (gamepad mode) | Footer 92; capsule 84 at y 628, centred ±1, ≤ 960 wide; members 60; var 92px; Back navigates back |
| AT-7 | Tab-bar geometry, live | In `vr:systemui`: `Hm`, r, and the `frame.menu` overlay's world height from `GetTransformForOverlayCoordinates`; compute `mp`, G, P and the rule's p; then `styles frame.menu.<id> "%{DashboardMenu>Item}"` and `DumpLaserOverlays` | Item rows = p popup px (58 at r = 1 with 10 items); the computed p matches §3.3.2 for the measured r; bar inside the panel (rule 2) or the glass (rule 1); Console present; `only_visible_with_laser: false` (Q7 path); records whether the popup follows the resize |
| AT-8 | Gamepad into and out of the tab bar | `FocusApplicationRoot`; focus the first poster; `L.pad('left')`; `L.focused()`; `L.pad('down',2)`; `L.pad('right')` | Focus in `frame.menu`, not `%{DashboardMenu>Collapsed}`; two items down; back in `main` |
| **AT-8b** | Focus vs current route (tab bar) | `--route /downloads`; gamepad focus into the bar and onto Store; `shot frame.menu.<id>`; `M dl SHOT rect:<Store pill> circle:<Downloads circle>` | ΔL ≥ 25 (mockup: 40) and the shapes differ (pill vs circle) |
| **AT-8c** | Focus vs checked (menus) | MENU pre with a CheckItem (checked) and focus on the next row; `shot main`; `M dl` | ΔL ≥ 25 (mockup: 65); the checked row has no fill |
| **AT-9a** | Search trigger, laser | On AllGames: `L.click('main','%{SearchBox}')` then `L.q('main','%{SearchBox}').focus()` (the two DOM effects of a laser click); after 1.2 s: `L.route()`, `.lgs-snap` present, `document.activeElement`, keyboard shown; `shot main p2_wn_at9a`; hide the keyboard; `L.back()` | Route `/search…`; the snapshot has 0 `[id]` and is `inert`; zero state visible; records whether Steam itself navigated |
| **AT-9b** | Search trigger, gamepad | `FocusApplicationRoot`; focus the first poster; `L.pad('up')` (and, if the field took focus without the sheet, A on the field); record route, `activeElement`, keyboard | The zero state appears on the real gamepad path; records Steam's own behaviour (resolves the shell.md / library.md disagreement) |
| **AT-9c** | Leaving restores context | After AT-9b: B (our page's `onCancel`, dispatched only while `.gpfocus` is inside our sheet); `L.route()`, `L.focused()` | Back on `/library/tab/AllGames` with focus on the same poster; no `.lgs-snap` left |
| **AT-9d** | Steam's category page in the sheet | `SEARCH('half','Library')` with the override on; `outline main`; `L.pad` down ×3; LB/RB | `%{TabContentsScroll}` inside the sheet; rows render (virtualised); focus moves; LB/RB switch categories. Else the full-window fallback is active |
| **AT-9e** | Parity (Q6) | For 'half', 'a', 'zzqxjvkw': counts per category in Top Results vs Steam's own tab row (override off, same lock) | Equal for every category; every category with matches has an entry on All |
| AT-10 | Echo | social-media concept's SQ4 test | Echo shows the field's text and placeholder |
| AT-11 | Menu anchor and dismiss | MENU pre with a known source; slab rect; click on `%{*…>ModalClickToDismiss}` outside the slab | Slab edge 16 ± 2 px from the source; `m_rgModals.length` restored |
| **AT-11b** | Menus fit | MENU pre with 5, 7 and 10 items; Steam's real Sort menu on AllGames (Y; look only, then B); Downloads Options if an item exists (look only); POWER (look only) | `scrollHeight == clientHeight`; Cancel inside the slab; slab ≤ 520 tall and ≤ 600 wide; the class matches §5.1.1 |
| AT-12 | Grid menus' D-pad | POWER and the Sort menu (look only): read `contextMenuContents`'s nav node `m_Properties.layout`; `L.pad` down/right/up/left | Records GEOMETRIC or column; in both cases every item is reachable and Cancel is last. **Never press A** |
| AT-13 | Alerts and sheets | CONFIRM, ALERT, ZOO('Scroll Panel Test'); `styles` on scrim, `#header` children, buttons | Scrim .35, no blur; header contents .45; buttons 60; `DialogTwoColLayout` a row |
| AT-14 | Depth | `__LGS_SG.dump()` with MENU, CONFIRM and the search sheet up; `DumpLaserOverlays` | Menu/alert/sheet crops dz 10 mm ± 2 (with live S × r), `interactive: false`; tab-bar popup +15 mm over Steam's; no ornament or tab-bar crop; no crop > 15 mm unless `interactivePops` is set |
| AT-15 | Motion | `--pre` per interaction, then `document.getAnimations()`; after 1 s, the count; filmstrips at f = 0, .15, .35, .6, 1 → `shots/p2_motion_wn_<interaction>_<f>.png`; route changes every 50 ms (CQ6) | Durations ∈ tokens; 0 at rest; glass before content; no closed outline; animated depth deltas ≤ 20 mm; clip-path only on ≤ 600 × 600 |
| AT-16 | Performance | `python glass.py perf main --route /library/tab/AllGames`; the same with a `--pre` that opens and closes MENU 5×, and one that opens the search sheet 5× (snapshot cost) | Themed fps within 5 % of stock; no frames > 34 ms; snapshot ≤ 1 long frame per activation |
| AT-17 | SteamVR chrome and T4 moves | `shot vr:systemui p2_wn_chrome_*` (hover, focus, tooltip pre); `DumpLaserOverlays` before/after the moves; `hvgrab` look | Frame-control panel grows with the DOM (E16); after the moves the frame-control and grab-handle targets exist at the new positions with unchanged sizes; one row under the window in the `hvgrab` frame. Else the fallback positions |
| AT-18 | Toast | Class-exact mock (hud.md §4.3) mounted in `main`; `styles` in the real `notifications` window | 320 × 76, radius 30, icon 48 circle, no outline; `toastExitVR` kept |
| AT-19 | Accessibility | Reduce Motion and High Contrast via CDP `Emulation.setEmulatedMedia` in a lab lock | Fades only; opaque glass with the 2 px edge; no Steam setting touched |
| AT-20 | Headset view | `hvgrab` with the laser idle, MENU up, CONFIRM up, the ornament off-axis; look, then delete | Tab bar visible without the laser; no doubled ornament or tab bar; glass L 55–110; glassd rim profile as AT-23 |
| AT-21 | Type sizes | `styles` sweep over `#header`, `#Footer`, menus, dialogs, the sheet | No `font-size` < 18 px; no uppercase, tracking or italics |
| AT-22 | Removal | `lgs off`; `outline main`; `frame.menu` params; systemui transforms; status | Stock DOM; original route switch; flag restored; transforms restored; no `lgs` nodes, snapshot, proxy or styles |
| **AT-23** | No outline on glass | `shot main` with MENU, POWER and the search sheet up; `M edge SHOT y x0 x1` on each slab's top edge and on the ornament | Ratio ≤ 0.35 on every slab (mockups: 0.00–0.13) |
| **AT-24** | Ornament modes | (a) Gamepad mode: legends and quiet A/B. (b) Laser mode without touching the input getter: mount a class-exact `%{SortAndFilterContainer}` mock (inventory library §6.1 DOM) in `main`, force `html.lgs-laser` through the shell's test hook, `shot main`; remove both. (c) Optional, lab-locked, with restore and a TTL: override the `IsInGamepadNav` getter for one capture | Capsule 84 at y 628 with Sort and Filter in slot 1; A/B hidden only in laser mode; duplicates hidden; width ≤ 960 |
| **AT-25** | Frozen target | On AllGames (laser path, synthetic `mouseover`/`mousemove`): dwell 600 ms on poster A, 90 ms on poster B, then `pointerenter` on `#Footer`; read the Options label and `L.focused()`; `L.click` on Options; read the MENU header; B | Label "Options · A"; focus on A; the menu is A's |
| **AT-26** | More circle | Hover poster A 400 ms → the circle at A's corner; `L.click` on it → A's menu (header); B. Gamepad: focus A → the circle present | Circle at the corner ± 2 px; the menu is A's |
| **AT-27** | Contract in area mockups and on device | `outline main` on each area's route with a footer | Every bottom ornament is the single `#Footer` capsule at y 628, ≤ 960 wide; no second toolbar node |

---

## 14. Critique responses

| Critique point | Response |
|---|---|
| **Blocker: the headline glass depends on a native layer that stays off without a wearer; the laser dot is probably hidden under the cover** | Fixed. §3.6 adds the T2 pointer proxy, drawn inside Steam's DOM, so it shows in every base and popped crop over the cover. §8.3 replaces each NATIVE.md wearer check with an agent check (AT-0a pass-through via `DumpLaserOverlays`, AT-0b the proxy in CDP shots and an `hvgrab`, AT-0c alignment at the device's own r = 0.863, the documented cover flags, cost). The native layer becomes the default only when AT-0 passes (Q14). §8.4 specifies the degraded glass that ships otherwise and `p2_window-nav_anatomy_t1.png` shows it |
| **Focus vs selection indistinguishable (ΔL 2.5)** | Fixed. Current route = a .16 circle only; gamepad focus = a pill across icon and label at + .30 with its own specular arc. Measured ΔL 40 (59 fill to fill) in `p2_window-nav_tabbar.png`. Menus: focus + .30, checked = check glyph only, ΔL 65. AT-8b and AT-8c repeat it on the device |
| **Tab-bar geometry on the user's device (Console, developer mode, r = 0.863, centred on the panel not the glass)** | Fixed. Console is drawn in every mockup (the shared builder now defaults to the device). §3.3.2 sizes the pitch from the live world heights (AT-7) and merges System and Power into one capsule. Result: p 58 at r = 1, p 52 at r = 0.863 in the worst case; `p2_window-nav_tabbar_r863.png` renders it. The bar centres on the glass when it fits; with ten items it does not, so it spans the panel and ends level with the ornament by design (D-13). Partly rejected: the critic's 60 px floor. Ten items at 60 need 644 popup px and the panel offers 641 at r = 1 (564 at r = 0.863 if the popup ignores the resize), so the floor is 52 and tied to the window's own scale (D-2) |
| **Laser path through the ornament crosses posters; laser mode unmentioned; home-apps' conflicting ornament** | Fixed. The More circle is a shell-owned T2 helper (§3.4.4). The frozen target (§3.4.3) re-focuses the dwelled or pressed card before the ornament acts and names it on the button. Laser mode (§3.4.2): A/B hidden (Q13), Steam's `%{SortAndFilterContainer}` folded into slot 1, duplicate X/Y hidden. One published contract (§3.4.1–3.4.2) and a reconciliation table with home-apps and the others (§3.4.6). Laser mode is verified with a class-exact mock and an optional, restored getter override (AT-24). `p2_window-nav_ornament.png` shows all three |
| **520 px modal box makes the tile menu, Sort By and Downloads Options scroll** | Fixed. Layout by item count (§5.1.1): ≤ 5 at 72 px; 6–7 compact (60 visible on a 64 px pitch, inline label): the device's 7-item tile menu with Developer › is 504 px; ≥ 8 in two columns ≤ 600 px: Sort By 508, Downloads Options 434, Power 464. AT-11b requires `scrollHeight == clientHeight`. Rendered: `p2_window-nav_menu.png`, `p2_window-nav_sort.png`, `p2_window-nav_power.png` |
| **Menus, alerts and sheets rely on clicks on interactive crops; Q12's fallback can never trigger** | Fixed. The default uses only proven mechanisms: non-interactive pops of 10 mm (parallax ≤ 20 % of a 64 px row up to 45°, and the proxy marks the real hit), separation from the t1 dim and shadows. The +30/+50 interactive depths sit behind the wearer flag `interactivePops` (Q12). §3.7, §10, AT-14 |
| **Search trigger unverified; AT-9 bypassed it; inventories disagree** | Fixed. Activation is the input's DOM focus, which both input paths produce; T2 navigates only if Steam did not. AT-9a (laser: click + focus) and AT-9b (gamepad: D-pad Up) exercise the real trigger and record Steam's own behaviour |
| **Search is still a page swap; B.5.2 unsolved** | Fixed in the experience; partly rejected in mechanism. Search is presented as a sheet over a snapshot of the page you were on; leaving is one press and focus returns to the same poster (AT-9c). The mechanism stays Steam's route underneath, deliberately: Steam's input navigates on typing (library.md §1.2), so a modal opened over the page would be orphaned by that navigation, and the route keeps history, B, IME and every Steam result path intact |
| **Search summary hides Tools, Hidden and Store; counts depend on Q6** | Fixed. All shows every category with matches (capsules with counts, an "In the Store" row, "See All N"); categories open Steam's own grid in the sheet. Counts and items come only from Steam (its hook via Q6, or its own All grid and tab row when Q6 is unresolved). AT-9e checks parity |
| **Full-width 2 px line on the tops of wide slabs** | Fixed. §8.2 replaces the linear top layer with a light-dependent lobe; measured profiles fade to 0–13 % on the right (ratio ≤ 0.13). AT-23 checks it with `window-nav-measure.py edge` |
| **Menus from chrome animate 0 → +30 mm, over the 20 mm cap** | Fixed. Default 0 → +10 on `depth`; with the wearer flag, chrome-sourced menus appear at +30 with the materialize instead of travelling (§3.7, §5.1.3) |
| **Power slab too large for the clip-path morph limit** | Fixed. 592 × 464 (two columns of 284); every menu ≤ 600 × 600; anything larger would materialize (§5.1.3, §5.2) |
| **Bottom ornament is the console legend made clickable; four stacked rows under the window** | Fixed. The ornament is a toolbar with modes, a named target and slot rules (§3.4). Under the window: one window-bar row (frame controls + window bar moved up, T4 [PLAUSIBLE] with fallback), laser-visible; at rest two rows (§3.5, `p2_window-nav_chrome.png`) |
| **CQ1 fallback leaves modal tops under the toolbar** | Fixed. The fallback pads the modal container by 68 px (and scrollers get `scroll-padding-top: 108px`); AT-2 measures modal and menu tops in both cases (§3.2) |

---

## 15. Files

| File | What |
|---|---|
| `docs/phase2/concepts/window-nav.md` | This concept |
| `docs/phase2/concepts/window-nav-measure.py` | Pixel checks for AT-0b, AT-8b/c, AT-23 |
| `docs/phase2/mockups/window-nav-*.html` | Mockups (true size, except the motion storyboard and the ornament board, which crop) |
| `docs/phase2/mockups/window-nav-shared.css`, `window-nav-shared.js` | Shared chrome: the device tab bar, the ornament contract, the window-bar row (`winbar`), the More circle, the pointer proxy, the edge lobe |
| `shots/p2_window-nav_*.png` | Renders: `python tools/mockshot.py docs/phase2/mockups/window-nav-<name>.html shots/p2_window-nav_<name>.png` |
