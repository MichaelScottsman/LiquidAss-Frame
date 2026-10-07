# Glass Shell Phase 2 design system (DESIGN2)

This is the design system for Phase 2: the rules that make the Steam Frame's Steam and SteamVR interface look and behave like a native visionOS app with Liquid Glass. Phase 2 also redesigns layouts, not only skins them. Every per-surface redesign (library, game page, settings, Quick Access, friends, bar, launcher) builds on this file.

It replaces `docs/DESIGN.md` (Phase 1) wherever the two disagree. Phase 1 functionality guardrails (DESIGN.md §8, LAB.md) still apply unchanged.

**What this file is built from**

| Source | Used for |
|---|---|
| `research/visionos.md` (VR) | Units, window anatomy, ornaments, components, type, colour, depth, accessibility |
| `research/liquid-glass-motion.md` (MO) | **All motion, verbatim in substance**, and the material and edge spec |
| `research/references.md` (REF) | Measurements from the 12 reference shots: luminance band, frost, edge anatomy, fill polarity |
| `capabilities/spatial.md` (SP) | What the scene graph and glassd can do; live geometry; scene units |
| `capabilities/steam-react.md` (SR) | What new Steam React views can do |
| `audit/*.md` | Per-surface problems and proposals: shell-nav (SN), library-apps (LA), game-pages (GP), system (SY), social-media (SM) |
| Design bible (`../bible/`) and its rulebook `design-language.md` (DL) | The seven material behaviours, layer rule, concentric shape, review checklist |
| `refs/visionos/1–12` | The look the user asked for |

**Companion files**

| File | What it is |
|---|---|
| `docs/phase2/mockups/kit.css`, `kit.js` | The mockup kit: this system as static HTML at true size (§15) |
| `docs/phase2/mockups/_example.html` → `shots/p2_example.png` | Worked example: the Library window with an open Sort menu |
| `docs/phase2/fontkit.py` | Builds the UI font subset and its `@font-face` stylesheet (§5) |
| `theme/fonts/` | Inter 4.1 (SIL OFL 1.1) and its licence |

**Evidence tags.** Numbers carry the tag of their source: **[official]** Apple HIG or WWDC, **[measured]** from the reference shots or the live device, **[community]**, **[inferred]**, **[ours]** (chosen here, with the reason given). Where the sources disagree, §0.2 records which one this file follows and why.

---

## 0. Read this first

### 0.1 The twelve rules

1. **Size by angle.** 1 visionOS point = 4/3 CSS px = the CSS `pt` unit on the main window. Minimum target 80 px (60 pt), regular button 60 px (44 pt), body text 24 px. Nothing interactive is smaller than 60 px visible with an 80 px hit region. (§2, §4)
2. **The Steam window is a small visionOS window.** 1280 × 720 px is 960 × 540 pt. Show fewer, larger things; page or group the rest. Never shrink visionOS sizes to keep Steam's density. (§2.4)
3. **Chrome is outside the content.** Main navigation is a vertical tab-bar ornament beside the window (Steam's frame menu). Toolbars are capsule ornaments that straddle the window's bottom edge by 28 px. No full-width header or footer bands. (§3)
4. **Circles and capsules.** Icon-only controls are circles; text controls are capsules. No square buttons, no text "Back" or "Close". (§7.9)
5. **No outlines.** Glass edges come from a tone step, a lens band, specular arcs lit from above, a darkened inner edge and a depth shadow. No `border`, no `outline`, no 1 px ring, anywhere on glass. (§6.2)
6. **Glass only on the functional layer, never glass on glass.** Window, ornaments, menus, sheets, toasts are glass. Everything inside glass is a fill. Content (art, posters, web pages) is never glass. (§6.1, §6.5)
7. **Recessed containers, raised controls.** Platters, sidebars, fields and tracks are darker than the glass; buttons, selected rows and bubbles are lighter. (§6.5)
8. **White means "on".** White fill + dark label = a toggled or selected button, a selected segment, or the button whose menu is open. Navigation selection (tab, sidebar row) is a lighter translucent pill. (§8.2)
9. **Light, not rings, for state.** Hover is a soft light at the pointer; gamepad focus is illumination from within; press is a glow that spreads. Rows and toolbar buttons never scale; content cards lift. The only ring is the text-field focus ring. (§10)
10. **Depth carries hierarchy, a few centimetres at most.** Default profile: tab bar and bar popups +25 mm, focused cards and Home cells +15 mm, menus, alerts and sheets +10 mm, everything in the window at 0; at most four depths at rest. The larger interactive depths (menus +30, sheets +50 mm) wait for a wearer (§3.8) [A3]. Text never gets depth of its own. (§3.8)
11. **Motion is springs, from MO only.** Glass materializes, menus grow out of their source, nothing moves at rest, Reduce Motion keeps fades and removes movement. (§11)
12. **Title case, Inter, white.** Inter Variable (Medium body, Bold titles); no uppercase chrome, no letter-spaced labels, no italics; white text at three vibrancy levels. (§5, §8)

### 0.2 Conflicts between the sources, and the decision taken

| # | Topic | Sources disagree | Decision in this file | Why |
|---|---|---|---|---|
| D1 | Viewing distance | Brief and VR: window at 1.43 m (0.0307°/px). SP measured: eye to window ≈ 1.15 m at summon (0.038°/px at r = 1), and the user's resize factor r = 0.863 today | Size everything for **0.0307°/px** (1.43 m, r = 1). 1 pt = 4/3 px | It is the smallest angle a CSS px realistically gets. At the summon distance the same px are ≈ 24 % larger, which the Frame's lower pixel density welcomes. 80 px still meets 60 pt down to r ≈ 0.82 at 1.15 m (SP §1.2) |
| D2 | Press feedback | Phase 1 and VR §12: `scale: .97` (shrink) | **Swell**, +6 px on the longest side, ≤ ×1.06 (MO §4.3) | Liquid Glass grows under the finger; the task makes MO binding for motion |
| D3 | Motion tokens | VR §18 has its own easing table; GP C.11 proposes bible k/c springs; Phase 1 uses `cubic-bezier(.2,.9,.25,1.15)` | **MO §3.2–3.3 only** | Task instruction; MO's curves are exact SwiftUI springs |
| D4 | Hover-in timing | VR §12: 120 ms in, 250 ms out | MO: 294 ms in (`hover-in`), 441 ms out (`fade`) | As D3 |
| D5 | Reduce Motion | Phase 1 and GP C.11: every duration to 1 ms | Keep fades (150–200 ms), remove movement, bounce 0 (MO C8) | Apple keeps fades under Reduce Motion |
| D6 | Navigation selection | Phase 1 DESIGN §3 and SN C.2: white fill | Lighter pill, white .18. White only for on/selected buttons, segments and open-menu sources | Refs 5, 8, 11, 12 and WWDC23-10076 (REF H.2, VR §14) |
| D7 | Window corner radius | Phase 1: 32 px | **54 px** | A 60 px circle inset 24 px is then concentric (30 + 24); refs measure 6.4–7.5 % of H |
| D8 | Font | REF H.5: keep Motiva Sans with heavier weights | **Inter 4.1 Variable**, Motiva Sans and Steam's fallbacks after it | Task instruction; Inter is the free face closest to SF, with an optical-size axis |
| D9 | Body text | Audits: 18–22 px | **24 px Medium**; 22 px Callout for dense secondary text; 18 px floor | VR §13; the Frame's 19.6 ppd needs the larger angle |
| D10 | Focused content card depth | MO §4.4 and `layers.json`: +8 mm | **+15 mm** static depth, reached on the `depth` spring | 8 mm is ≈ 0.3 display px of disparity, below what people see (VR §1.6). +15 mm is inside MO's 20 mm cap for animated depth |
| D11 | Menu depth | VR: +35 mm | **+30 mm**, growing from the source's depth (MO §4.6) | Keeps the animated delta (15 → 30 mm) under the 20 mm cap |
| D12 | Sheet depth | VR §16: sheet stays, parent pushes back −60 mm | **MO §4.8: sheet +30 → +50 mm, parent stays and dims** (scrim 35 %) | MO binds motion and its depth deltas. The 50 mm separation matches visionOS's push-back in relative depth; on fixed-focus optics only vergence changes. The SP §5 recede (proven) stays an option needing sign-off (§3.8) |
| D13 | Scrim | VR: .40 | **.35** | Apple's dimming number (MO, DL §2) |
| D14 | `dz` units | NATIVE.md and `layers.json` call them metres | They are **scene units**: metres = units × S × r, S = 0.369 (SP §1.1) | Measured live. This file gives depths in mm and in units |
| D15 | Bar and popup scale | SN: popups 0.034°/px; SY: bar and its popups 0.037°/px | Both, per surface (§2.5) | The bar sits 13 cm nearer than the window |

### 0.3 Amendments A1–A13 (PLAN §1.18, applied by P4)

The build plan (`docs/phase2/PLAN.md` §1) decides conflicts between this file and the seven area concepts. Its §1.18 lists the changes to this file; they are applied in place and tagged **[A<n>]** where the text changed. Where this file and PLAN §1 still disagree, PLAN §1 wins.

| # | Sections changed | Change | Source |
|---|---|---|---|
| A1 | §3.1, §3.2, §3.3, §7.4, §7.5 | Glass 656 with a 64 px ornament margin; ornament y 628–712, ≤ 960 wide; title at x 100; search 520 / 640 / circle; no microphone | WN D-1 to D-4, D-8; PLAN §1.2, §1.9, §1.10 |
| A2 | §3.5 | Windowless routes drawn with plates; LB/RB = sections; one-line labels; folder pages | HA-1, HA-3, HA-5, HA-14; PLAN §1.2, §1.14 |
| A3 | §0.1 rule 10, §3.3, §3.7, §3.8 | Two depth profiles (default, wearer), the seven admission rules, the values table; the dimming recipe | PLAN §1.7, §1.8; WN D-7, D-12 |
| A4 | §6.1, §6.2, §6.6 | θ from the shorter side; E3 radial lobe instead of the linear top layer; plates and hole treatment in the tier map | GM §1.7, WN D-15; PLAN §1.6 |
| A5 | §6.5, §8.2, §10 | Focus add .28 → **.32** (the tuning range .28–.32, set from G-FOCUS); navigation-row hover = the spot only; navigation selection with arc and Semibold; input-mode keying; laser dwell; glyph badges in gamepad mode only; white-fill focus glow | PLAN §1.4; VP D-1, D-2, D-5, D-7 |
| A6 | §3.7 | Menu layouts by item count; exemption E-MENU; destructive rule by count; Steam's Cancel as a quiet capsule | WN D-5, D-16; PLAN §1.12, §1.16 |
| A7 | §12 | The friends list is not virtualized; settings drill-down may hide a section under E-DRILL | SM-D9, SET §4.3; PLAN §1.16 |
| A8 | §2.5, §3.3 | Bar pitch 64 bar px; tab-bar live pitch with a floor of 52 | CC D-CC8, WN D-2; PLAN §1.3 |
| A9 | new §10.5 | Feedback: Steam's sounds through its bus; haptics off | VP D-4, IM §6; PLAN §1.13, S17 |
| A10 | §11.5 | Route transition overrides adopted within Steam's timeouts | PLAN §1.5, §1.17 S3 |
| A11 | §17 | The verification checklist points to PLAN §4 | PLAN §4 |
| A12 | §5.2, §18 | `theme/01-font.nowrap.css` exists (generated) and is live; measured results | P4 evidence (`docs/phase2/wp/P4.md`, FD-2) |
| A13 | §14 | Tier status from the capability studies: T3 proven; T4 click unproven; plates and holes planned | SR, SP, E2E; PLAN §1.6, §1.7 |

Token values are in `theme/00-tokens.nowrap.css`; their contract (names, meaning, how areas use the hooks) is `docs/phase2/contracts/tokens.md`. §16 below is the original proposal, annotated where the live values differ.

---

## 1. What Phase 2 is aiming for

The user's brief, condensed: a radical overhaul so that the Frame's UI feels like a native visionOS experience; Steam integrated into SteamVR rather than "a window into a different app"; element sizes and each context's experience re-examined and redesigned where needed; glass slabs whose outline comes from the shader; Liquid Glass motion; full glass optics, not transparency; subtle stereo pop-out.

Translated into what an observer should see in a headset capture:

| Trait | Target | Section |
|---|---|---|
| Frosted, adaptive glass | Glass luminance inside L 55–110 (of 255) whatever the room; room texture contrast down ≥ 80 %; hue follows the room | §6 |
| No outlines | Pixel profile across any glass edge: a peak on the light-facing edge, flat sides, no closed ring | §6.2 |
| Chrome as ornaments | No element wider than 50 % of the window and shorter than 60 px at its top or bottom edge | §3 |
| Size by angle | 0 controls under 60 px visible; 0 hit regions under 80 px (72 px floor where a quad is fixed) | §4 |
| visionOS type | Inter; no text under 18 px; no uppercase, tracking or italics in chrome | §5 |
| Depth hierarchy | Ornaments, menus, sheets and the focused card in front of the window by the §3.8 amounts | §3.8 |
| Liquid Glass motion | Every animation one of the MO tokens; nothing running at rest | §11 |

---

## 2. Units and viewing geometry

### 2.1 The conversion

- visionOS defines a point as an angle: 60 pt ≈ 2.5°, so 1 pt ≈ 0.0417° [official, VR §1.1].
- On the main window 1 CSS px = 0.766 mm = **0.0307°** at 1.43 m with r = 1 [NATIVE.md, VR §1.2].
- So 1 visionOS pt = 1.36 CSS px. **Working rule: 1 pt = 4/3 CSS px = the CSS `pt` unit** (0.0409°, within 2 %) [ours].

| visionOS | pt | CSS px | ° at 0.0307°/px | ° at 1.15 m (0.038°/px) |
|---|---|---|---|---|
| Minimum hit region and centre spacing | 60 | **80** | 2.45 | 3.04 |
| Regular button | 44 | **60** | 1.84 | 2.28 |
| Large button (primary action) | 52 | **70** | 2.15 | 2.66 |
| Extra-large button | 64 | **86** | 2.64 | 3.27 |
| Small / mini button (alone only) | 32 / 28 | 44 / 38 | 1.35 / 1.17 | 1.67 / 1.44 |
| Margin around an interactive item | 16 | 24 (21 exact) | 0.74 | 0.91 |
| Space between list or menu items | 4 | 6 | 0.18 | 0.23 |
| Bottom-ornament overlap | 20 | 28 | 0.86 | 1.06 |
| Body text | 17 | **24** (23 exact) | 0.74 | 0.91 |
| Minimum text | 12 | **18** (16 exact) | 0.55 | 0.68 |

### 2.2 Why distance 1.43 m (decision D1)

SP §1.1 measured the eye-to-window distance at summon as about 1.15 m and the window's resize factor as r = 0.863 today; users can also push or pull the dashboard. Designing at 0.0307°/px is the conservative case: at 1.15 m and r = 1 everything is 24 % larger in angle, and at today's r = 0.863 it is still 7 % larger. **Hit regions never drop below 72 px** in any quad whose size Steam fixes (SP §1.2: 72 px keeps 60 pt at r ≈ 0.86).

### 2.3 Display density

- Steam Frame ≈ 19.6 pixels per degree; Vision Pro ≈ 34 [press, VR §1.5]. One main-window CSS px is 0.6–0.74 display px.
- Consequences: no 1 px lines (they shimmer); glyph strokes ≥ 2 CSS px; text floor 18 px; Medium and Bold weights only.

### 2.4 The window-size consequence

1280 × 720 px = 960 × 540 pt, 56 % of the area of a default 1280 × 720 pt visionOS window. Every surface is laid out as a **compact visionOS window**: drop secondary items behind a "More" control, page them, or move them to an ornament. Expect fewer items per row and more paging. Never scale visionOS numbers down.

### 2.5 Every surface has its own scale

Steam and SteamVR render several quads at different distances and metres-per-pixel. To give an element the same angle as N main-window px, write **N × m** of that surface's own CSS px.

| Surface | °/CSS px | m (multiplier) | 80-px target becomes | 24-px body becomes | Source |
|---|---|---|---|---|---|
| Main window (all Steam routes, menus, sheets) | 0.0307 | 1.00 | 80 | 24 | NATIVE, SN §0.2 |
| Steam popups at the window plane (`frame.menu`, tooltip, toasts, floating footer) | 0.034 | 0.90 | 72 | 22 | SN §0.2 |
| Bar and its child popups (`bar`, `barpopup`: + menu, Quick Access) | 0.037 | 0.83 | 67 (use 72 where it fits); bar discs 56 at a **64 bar px pitch** in 64 × 72 slots (E-BAR) [A8] | 20 | SY §0.3, CC D-CC8 |
| Steam VR keyboard (across) | 0.0416 | 0.74 | 59 | 18 | SM §0.2 |
| Volume HUD [inferred] | ≈ 0.059 | 0.52 | 42 | 12 | SY §0.3 |
| SteamVR frame controls, their tooltips, More Options | 0.023 | 1.33 | 107 | 32 | SN §0.2 |
| SteamVR Settings, Now Playing (1858 px panel) | 0.0213 | 1.44 | 115 | 35 | GP §0.2 |
| SteamVR controller binding UI (2400 px page) | 0.0164 | 1.87 | 150 | 45 | GP §0.2 |

Unless a section says otherwise, sizes in this file are **main-window px**. Multiply by m for other surfaces.

**Tab-bar items [A8, WN D-2].** The frame menu holds ten destinations, so a fixed 72 popup px pitch would need 764 popup px against 653 available. The tab bar uses a **live pitch** of 52–66 frame-menu px (58 at r = 1 with Console on), circle = pitch − 8, with a floor of **52** (exemption E-TAB, PLAN §1.16).

### 2.6 Depth units

- Stereo disparity at 1.43 m: 1 cm ≈ 0.35–0.43 display px; 2.5 cm ≈ 0.9–1.1; 5 cm ≈ 1.8–2.2; 8 cm ≈ 2.9–3.6 [ours, VR §1.6]. Below about 1 cm stereo alone is barely visible, so every lift is paired with a shadow.
- **Scene units.** `vsg-transform` translations, popup offsets and `theme/layers.json` `dz` are in the main panel's local units: **metres = units × S × r**, S = `DashboardStore.dashboardScale` = 0.369 [SP §1.1]. At r = 1: 1 cm = 0.0271 units. Read S and r live (SP §1.2 snippet); never hard-code.

---

## 3. Spatial layout

### 3.1 The scene

```
                 frame.menu popup                 Steam main overlay 1280 x 720 (transparent outside the glass)
                 = tab-bar ornament   +--------------------------------------------------------------------+
                 +----+               | ( < )  Title               ( Search capsule  64 )        ( .. ) |  <- in-window toolbar row
                 | () |  gap 16-24    |                                                                    |     108 px
                 | () |               |   content (cards, lists, platters)                                 |
                 | () |               |                                                                    |
                 | () |               |                         window glass, radius 54                    |
                 +----+               |                                                                    |
                 +----+               +-----------+------------------------------------------+-------------+  <- glass bottom (656) [A1]
                 | () |                           |  bottom ornament 84 px, overlaps by 28  |                <- Steam footer, restyled
                 +----+                           +------------------------------------------+                  (720)
                                                 ( frame controls )        SteamVR systemui, window plane, idle-dim
                                    ( Steam  apps  + )   ( clock  battery  bell  QAM )    dashboard bar, 13 cm nearer
                                                       ==== grab pill ====                 SteamVR grab handle
```

Rendered: `shots/p2_example.png`.

### 3.2 The window (main overlay)

| Item | Value | Notes |
|---|---|---|
| Overlay | 1280 × 720 CSS px, fixed by Steam | Never resize the Steam window (SP §7) |
| Glass | Set by the route's **glass mode** (PLAN §1.2), never by focus: **1280 × 656** with a 64 px ornament margin below (`window`: library, search, Downloads, Settings, …), 1280 × 720 (`window-full`: What's New, `/account`, routes without a footer), none (`windowless`: Home, folders, `/invites`, §3.5) or art-filled (`hero`) [A1] | The ornament margin technique (VR §3.3): chrome outside the glass that is still Steam DOM, so laser and gamepad work unchanged. 656 rather than 664 because SteamVR's window-bar row sits 19 px below the panel and needs ≥ 24 px clearance (WN D-1) |
| Corner radius | **54 px** | Concentric with 60 px corner circles at a 24 px inset |
| In-window toolbar row (Steam's `#header`) | **108 px** tall: 24 + 60 + 24 | Needs the taller-header capability (SN C.0.1, CQ1): `--basicui-header-height` and `HeaderStore.m_flCurrentHeaderHeight` |
| Back / close | 60 px circle at (24, 24) | Always top-left. After 0.6 s of hover or focus it grows rightwards into a capsule with the previous page's title (§10.3) |
| Title | Large Title 46 px Bold, left, at **x 100** (right of the Back circle, which is on every route), vertically centred on the row; nested pages: Title 2 30 px Bold centred [A1, WN D-3] | No title strip, no app name |
| Search | Centred at x 640: a 64 px capsule **520** wide on section roots (Library, Photos, Downloads), **640** on nested routes and the search route, or a **60 px circle** in an 80 × 80 box (Home, folders, hero routes, Steam Settings, `/account`, …; PLAN §1.9). No microphone [A1, WN D-4, D-8] | §7.5 |
| Trailing actions | 60 px circles, right inset 24, 20 px apart | Account, More |
| Content inset | 40 px left/right for text columns and grids; ≥ 24 px for anything else | |
| Bottom ornament | 84 px capsule, **y 628–712**, ≤ **960** wide, centred, straddling the glass bottom by 28 px. When the legend holds only A and B it is a **quiet legend** (no capsule material, 60 px items, Medium white .70). Members switch to a compact style rather than exceed 960; nothing is dropped or hidden (PLAN §1.10) [A1] | Steam's `#Footer` restyled into it; its measured height moves page bottoms automatically (SN C.0.1) |
| Curvature | SteamVR already curves the window | Describe, don't set |
| Shape tolerance | Scroll content fades under the ornament (scroll edge, §6.7), never a hard clip | |

### 3.3 Ornaments

General rules [official, VR §4]: ornaments sit in a parallel plane slightly in front of the window, move with it, never scroll with content, overlap the bottom edge by 20 pt (28 px), use borderless buttons inside, stay visible, and hold controls, not content. At most one extra ornament per edge.

| Ornament | Steam node | Shape and size | Depth | Tier |
|---|---|---|---|---|
| **Tab bar** (main navigation) | Steam's VR main menu, the `frame.menu.<id>` popup beside the window's leading edge (SN C.2) | Vertical liquid capsule: circular items at the **live pitch** of §2.5 (52–66 frame-menu px, circle = pitch − 8) [A8]. Primary capsule: Home, Library, Store, Friends, Media, Downloads (6). A second capsule 16 px below: Settings, VR Settings, Power. Centred vertically on the glass, 16–24 px outside its edge | +25 mm (the frame-menu popup's own transform [PLAUSIBLE]; fallback Steam's +10) | T1 (Steam's own menu variables `--menu-item-height`, `--menu-icon-size`), T3/T4 (always visible: clear `only_visible_with_laser`, SP §6.3 [PLAUSIBLE]), T5 slab |
| **Bottom toolbar** | Steam's `#Footer` legend and per-route action buttons | 84 px capsule, 60 px controls, 12 px padding, centred, y 628–712, overlaps the glass by 28 px [A1] | **0**, with an inset slab behind it (ghost rule, E2E §1) [A3, WN D-7] | T1 layout, T4 pop, T5 slab |
| **Top ornament** (optional, Safari-style) | Search or browser navigation for web views | 84 px capsule above the glass, 12 px gap | +25 mm | Only on routes that give up 96 px of glass |

- The tab bar expands on hover after **0.4 s** (gamepad: at once on entry) to about 280 px, labels in Headline 24 px Semibold, overlaying the content; collapses 0.3 s after leaving (VR §5). Steam already expands it after 500 ms and collapses after 800 ms; keep Steam's timers if they are JS constants (SN C.2).
- Selected tab: lighter platter, white .18 (D6). Badges only for critical counts.
- Never put a menu that opens downward on a bottom ornament; open upward or centred.

### 3.4 Popups and their own quads

- Bar popups, the frame menu, tooltips, toasts and the volume HUD are separate SteamVR quads, placed by `ShowDashboardPopup` requests with offset (x, y, z), rotation and `scale` (SP §3.1). Their sizes follow §2.5.
- Popups can be asked for more depth and scale (×1.1–1.25) by wrapping `SendPendingInstanceParamsToSteamVR` [PLAUSIBLE, SP §3.3]. Use it for depth (+25–30 mm) before using it for size.
- A barpopup host is 300 × 1024 popup px. A launcher or Control Center wider than 300 px needs several hosts (SY C.1) or a T3 route in the main window (LA C.1).
- First paint of a new popup takes ≈ 2.5 s (SP §3.2): open ornaments early, hidden, and reveal them with CSS.

### 3.5 Windowless views (Home and pickers)

visionOS Home and the Environments picker have no window: circular icons float in the room (refs 1, 9, 10).

| Property | Value |
|---|---|
| Route | The **`windowless`** glass mode (PLAN §1.2): `/library/home`, the folder routes `/library/lgs/folder/*`, `/invites`. A T3 view in the main window with no window glass; **every glass element is a plate** (PLAN §1.6): glassd's plate primitive in native mode, the CSS plate (black .58 under a white .16 → .04 gradient, plus edges) otherwise. Only the attended item pops [A2, HA-1] |
| Icon | **120 px circle** (3.7°). Diameter / column pitch 0.54 (refs 0.52–0.55) |
| Lattice | 13 per page as 4-5-4, rows offset by half a pitch. Column pitch **224 px**, row pitch **188 px** (0.84 × column, refs 0.84) |
| Label | Subheadline 20 px Medium, white .92, **one line** ending in an ellipsis, centred, 14 px below the icon, with the on-room text shadow (§8.3); the full name shows on attention (card or name plate) [A2, HA-5] |
| Focusable | The whole cell (icon + label), ≥ 200 × 180 px |
| Sections and paging | **LB/RB switch sections** (Recent · Collections · Apps), as on every Steam tabbed page; D-pad Left/Right past a row end turns the page; LT/RT also turn pages when delivered. Every section and page also has a D-pad path. Page dots 12 px at 24 px pitch in a capsule; neighbour pages' edge icons at 35 % opacity [A2, HA-3] |
| Hover / focus | Scale 1.10, shadow deepens; the attended cell pops **+15 mm** as a non-interactive crop over its plate (plates stay at 0, PLAN §1.7) [A3]. After 0.8 s of attention (P3's attention state, gamepad focus or laser dwell) the disc morphs into a 320 × 240 card holding Play and More (HA-6). A opens the game page, X is Play (HA-4) |
| Hexagonal D-pad | Needs explicit neighbour maps (LA LQ3) so Down then Up returns to the same icon. Fallback: a 5 × 3 square lattice of the same circles |

| Folders | A collection opened from Home is a **folder route** (`/library/lgs/folder/<id>`, HA-14): pages of the same honeycomb (1 + 6 per page, VP D-13), Steam's Back and B work natively [A2] |

Use it for "+ > Launch Program" (all programs, A–Z), Library home (recent games, collections as folders) and pickers. The library **catalogue** stays a window of rectangular posters (LA D.1: circles are for launching, posters for browsing 350 items).

### 3.6 Control Center (Quick Access)

visionOS 27 Control Center is three separate portrait tiles (ref 3). SY C.1 Proposal A maps them to three bar-popup quads: the centre tile is Steam's own Quick Access, the side tiles are T3 views in other popup hosts.

| Property | Value (bar popup px; m = 0.83 vs main) |
|---|---|
| Tiles | 300 × 440 popup px each (11 × 16°), 24 px gaps, radius 44 (≈ 40 pt), panel glass, room visible between tiles |
| Toggles | 56–60 px circles at 72 px pitch; on = whole-fill colour + white glyph; off = black .30 fill |
| Rows | 64 px, glyph + label, inside a recessed platter (radius concentric) |
| Sliders | 64 px capsule track (black .30); value = white .86 fill from the leading edge with a dark glyph inside; knob only on hover or focus |
| Close | 48 px circle centred 16 px below the centre tile (B still closes) |
| Fallback (CS5 fails) | One tile in Steam's popup; its five tabs as a vertical capsule tab ornament on the tile's leading edge |

### 3.7 Sheets, menus, alerts, toasts

| Surface | Spec (main px) | Depth |
|---|---|---|
| **Menu / context menu / dropdown** | Thick glass, radius 32, padding 8, rows radius 24, min width 320, max 592, symbols left of labels (the current value's check in a leading 28 px slot), title as a 40 px header row inside the slab (22 px Bold, text-2), groups separated by 8 px of space (no separator lines). **Layout by item count** (table below) [A6]. The invoking button turns white while open. Grows from its source (§11.6). Steam's Cancel stays, as a 56 px quiet capsule centred under the rows | **+10 mm** (default profile), appearing with the materialize; +30 in the wearer profile [A3] |
| **Popover** | As a menu, sized to content, no arrow. Over 40 % of the window → treat as a sheet | +10 mm (wearer +30) [A3] |
| **Sheet / modal** | Centred on the glass, width ≤ 960 (75 % of the glass), radius 44, thick glass. Close or Back as a 60 px circle top-left. Parent: scrim black .35 | **+10 mm** (wearer +30 → +50); parent dims (§3.8, Dimming) [A3] |
| **Alert** | 640 px wide, radius 44, title Title 3 28 px Bold left-aligned, body left-aligned, buttons 60 px capsules side by side (keep Steam's row order: `DialogTwoColLayout` is a nav row; Steam's default focus untouched, S6), primary tinted, destructive red with a `#0d0e12` label | **+10 mm; 0 if it contains a destructive button** (wearer +30, still 0 if destructive); parent dims [A3] |
| **Toast** | Uses the whole 340 × 80 popup quad: panel glass card, radius 30, 48 px circular app icon, title 20 px Semibold, body 18 px, one line each. Materializes in place (no slide) | Placement is SteamVR's |
| **Tooltip** | Thick-glass capsule 48 px tall, 20 px Semibold, after 0.8 s of hover or focus (0.2 s out), below its button (PLAN §1.13) | CSS shadow only (wearer: owner + 5 mm) [A3] |

**Menu layout by count [A6, WN D-5; PLAN §1.12].** No menu scrolls inside the 520 px box.

| Actionable items | Layout |
|---|---|
| ≤ 5 | One column of **72 px** rows, 6 px apart, a 40 px header row |
| 6–7 | **Compact**: 60 px visible rows on a contiguous 64 px pitch, inline 26 px label |
| ≥ 8 (single level) | **Two columns**, ≤ 592 px wide |

Value menus (dropdowns): up to 8 options a slab anchored to its capsule; more than 8 on settings routes a list page over the detail pane; elsewhere 9–14 options the two-column grid; 15 or more one scrolling column of two-line rows. Menu rows are exempt from the 80 px size gate under **E-MENU**: ≥ 60 visible on a contiguous pitch of ≥ 64 (compact) or 78 (regular), rows ≥ 320 wide (PLAN §1.16).

**Destructive items [A6, WN D-16 = CC D-CC1].** With ≤ 2 destructive rows: red label at rest. With more (Power): red glyph and white label at rest, because a wall of red carries no signal. Always a red whole fill with a `#0d0e12` label on focus. Never reordered (SM-D8); Steam's default focus untouched (S6).

### 3.8 Depth plan

**Two profiles [A3, PLAN §1.7].** The **default** profile ships: every pop is a **non-interactive** crop, so the laser passes through it to Steam's panel at the same x/y (only proven mechanisms by default, WN D-12). The **wearer** profile is behind the flag `interactivePops` (off, sign-off S2); it restores the larger interactive depths of the table at the end of this section and turns on only after the SP §12 check by a person wearing the headset.

**Admission rules (default profile).** A pop must satisfy all of these; the reporter (P6) enforces them and gate G-DEPTH checks them:

1. **Covered** (ghost rule, E2E §1): inside a cover or a plate; never over the bottom ornament, the store's navigation ornament, the tab bar, the window-bar row or the `/invites` header.
2. **Click-safe**: dz_mm ≤ 0.25 × s × 0.769, s = the shorter side (CSS px) of the smallest visible focusable intersecting the crop; in units dz ≤ 0.000521 × s. +10 mm needs s ≥ 52, +15 mm needs s ≥ 78. A pop that fails drops to the next lower allowed value.
3. **Not over media or opaque art**, unless the hole treatment is live and an off-axis `hvgrab` passes.
4. **Never a destructive confirmation**: an alert or sheet holding a destructive button stays flat.
5. **Containers only**: ≥ 60 × 60 px, never text or a glyph alone.
6. **Still**: never while its scroller moves; while a modal is open only the modal pops.
7. **Few depths**: at most 4 distinct dz values at rest per route, from {0, +10, +15, +25} mm.

**Values (default / wearer).**

| Element | Default | Wearer | Mechanism |
|---|---|---|---|
| Window, content, rows, in-window controls, fields, platters, bottom ornament, store ornament | 0 | 0 | Cover; ornaments get an inset slab behind them |
| Tab-bar ornament, bar popups (+, Quick Access, …) | +25 | +25 | The popup's own transform / request `z` [PLAUSIBLE]; fallback Steam's |
| Home / folder plates, labels, page dots | 0 | 0 | Plates + mosaic bands |
| Focused Home cell, open card, name plate | +15 | +15, interactive | Crop over its plate |
| Focused or hovered content card ≥ 150 px | +15 | +15, interactive | Crop over the cover |
| Primary capsule ≥ 70 px; the Pause circle on the Now Downloading card | +10 | +15, interactive | Crop + tinted slab |
| Game-page cluster, Play, tab row at rest (over art) | 0; +10 once the hole treatment and the off-axis check pass | Play +15, others +10 | Crop + hole treatment |
| Game-page tabs, pinned | +10 | +20 | Crop + slab |
| Menus, popovers, dropdown slabs | +10 | +30, growing from the source's depth | Crop + `thick` slab |
| Alerts | +10; 0 if destructive | +30 (0 if destructive) | Crop + `thick` slab, or a flat `thick` plate |
| Sheets, the search sheet | +10 | +30 → +50 | Crop + `thick` slab |
| Source card while its menu is open | +15 if it was the focused card, else 0 with a CSS glow | +15 | — |
| Control Center tiles (CC-M) | 0 | 0 | Plates |
| Tooltips | CSS shadow only | Owner + 5 mm | — |

**Dimming [A3, PLAN §1.8].** Menus: no scrim. Alerts and sheets: Steam's `.ModalOverlayBackground` restyled to black .35 (`--lgs-scrim`) in both modes; under a pop the hole treatment's fill follows the scrim. The `t1` tint is not used for in-window modals (in native mode it would dim only the hidden real panel; in CSS-only mode it would also dim the modal); it is used only for CC-A and the sheet-recede variant (S7, off). Control Center (CC-M) hides the window's content with CSS opacity while its tile plates materialize.

The original depth classes (now the wearer profile's reference) with their disparity:

| Element class | Depth (mm) | Units at r = 1 | Disparity (display px) | Paired cue |
|---|---|---|---|---|
| Window glass, content, rows, in-window buttons, fields, platters | 0 | 0 | 0 | Shadows only |
| Home icons at rest | +10 | 0.027 | 0.35–0.43 | Contact shadow (6 px y, 18 px blur, black .35) |
| Primary action capsule (Play, Install, Resume) | +15 | 0.041 | 0.5–0.6 | Tint + shadow |
| Focused or hovered content card (poster, capsule, event card) | +15 (lift) | 0.041 | 0.5–0.6 | `scale: 1.05`, deeper shadow, sheen |
| Tab bar, bottom toolbar, top ornament, Home icon focused | +25 | 0.068 | 0.9–1.1 | Ornament shadow on the window: 10 px y, 30 px blur, black .28 |
| Tooltips | owner + 5 | — | — | — |
| Menus, popovers, alerts | +30 | 0.081 | 1.1–1.3 | Thick glass, 12 px y / 36 px blur shadow |
| Sheets | +30 → +50 | 0.081 → 0.136 | 1.1 → 2.0 | Scrim .35 on the parent (t1 `tint` node, SP §5 [PROVEN]) |
| Dashboard bar | SteamVR's own, ≈ 130 mm nearer | — | — | No extra depth |

Rules:

- **Pop containers, never labels or glyphs on their own.** Text rides its glass.
- **Crops stay at their original x/y** (input lands on Steam's real panel). In the default profile crops are non-interactive, which is why depths stay click-safe (rule 2) [A3]. The wearer profile makes popped crops interactive (`interactive: true`, `steam-input-appid: 769`, `can-take-keyboard-focus: true`) so the laser hits the crop and not Steam's panel behind it; this removes a 4–14 px parallax error on popped menus (SP §2.4). Registration is [PROVEN]; the click is [PLAUSIBLE].
- **Animated depth deltas ≤ 20 mm**, on the `depth` spring (MO M4). Static depths may be larger. Disparity cap: 80 mm (≈ 3 display px).
- **Shadow sized by depth:** y-offset 0.4 px per mm, blur 1.2 px per mm, black .25–.35, only where something of the same page is behind (CSS); glassd draws the contact shadow over the room.
- **Sheet push-back variant (sign-off S7: off, flag `sheetRecede`).** SP §5 proved that the transform above Steam's frame page (`t1`) can recede the window (−0.3 units ≈ 11 cm) while it stays a laser target, and that glassd covers and crops reparented to main recede with it. The visionOS geometry (sheet at the original distance, parent −50 mm) is therefore available: recede `t1` by 50 mm and add +50 mm to the sheet's crop. It moves the window, which MO §4.8 lists under "must not animate" for CSS only; decide after an `hvgrab` comparison of both variants.
- Units: `dz_units = dz_m / (S × r)`. `theme/layers.json` today uses 0.010–0.03 units (3.7–11 mm), which this plan supersedes.

---

## 4. Size scale

All values are main-window px (multiply by m from §2.5 for other surfaces).

| Element | Visible size | Hit region | Spacing | Notes |
|---|---|---|---|---|
| Icon button (circle) | 60 | 80 | centres ≥ 80 apart | Symbol 26–28 px |
| Text button (capsule) | 60 tall, 24 px side padding | 80 tall (transparent padding) | 20 px gap in a row, 24 px when stacked | Label Headline 24 px Semibold |
| Primary action | 70 tall capsule (Play: 80 tall, 280 wide on the game page, GP C.1) | ≥ 80 | — | One per screen, tinted |
| Hero action | 86 tall capsule | 86 | — | Editorial pages only |
| Mini circle (disclosure, clear-field) | 38–44 | 80 clear region | alone only | Never in rows |
| Row (list, sidebar, menu, settings) | 72 tall | 80 pitch (8 px gap) or contiguous 80 inside a platter | hover pill inset 6 px | Free-standing rows 72 + 8 |
| Text / search field | 64 tall capsule | 80 | — | Never below 60 |
| Segmented control | 64 tall track, segments ≥ 140 wide | 80 (padding inside the tab element) | 4 px between segments | Inside an 84 px ornament: 60 tall |
| Toggle | ≈ 66 × 40 (Steam's toggle at `scale: 1.75`, SY C.0) | Whole row where Steam's row handles the click | — | |
| Slider | 64–72 tall capsule | 80 | — | Hit area by padding; track geometry untouched (SY CS2) |
| Checkbox | 40 × 40 rounded square | 80 column pitch | — | |
| Tab-bar item | 62 (56 popup px) circle | 79 pitch (72 popup px) | — | |
| Ornament | 84 tall | — | ≥ 24 px clearance above SteamVR's frame controls | |
| Content grid gap | ≥ 24 | — | — | Posters, tiles |
| Page dot | 12 | in a ≥ 64 px capsule with ‹ › hit areas | 24 pitch | |
| Badge | ≥ 28 tall red capsule, 18 px Semibold | — | top-right, overlapping by a third | |

Audit gates (§17): no focusable element under 80 × 80 px hit box unless its centre is ≥ 80 px from every other target with ≥ 21 px clear gap; `glass.py audit` SHRUNK = 0.

---

## 5. Typography

### 5.1 The face: Inter 4.1 Variable

- **Why Inter.** SF Pro is licensed only for Apple platforms. Inter is the free face closest to SF's proportions, and its `opsz` axis (14–32) switches to a display cut for large titles automatically, as SF switches from Text to Display [VR §13].
- **Licence.** SIL Open Font License 1.1, "Copyright (c) 2016 The Inter Project Authors"; no Reserved Font Name, so subsetting and embedding are allowed. The licence travels with the files: `theme/fonts/LICENSE.txt`.
- **Files (downloaded 2026-10-07 from the Inter 4.1 release, `Inter-4.1.zip` → `web/InterVariable.woff2`):**

| File | Bytes | Content |
|---|---|---|
| `theme/fonts/InterVariable.woff2` | 352,240 (sha256 `693b77d4…a8e3`) | The full variable font: `wght` 100–900, `opsz` 14–32 |
| `theme/fonts/InterVariable-lgs.woff2` | 121,460 | The Phase 2 subset built by `docs/phase2/fontkit.py`: 939 glyphs, 638 codepoints, both axes, features `kern calt ccmp locl mark mkmk case tnum` |
| `theme/fonts/LICENSE.txt` | 4,380 | OFL 1.1 |

- **Subset coverage.** Basic Latin, Latin-1, Latin Extended-A, Romanian comma letters, Greek, Russian/Ukrainian Cyrillic, general punctuation, € ₹ ₽ ™, arrows, a few math signs. Measured alternatives: adding Vietnamese, IPA and Latin Extended-B/Additional doubles the file (229 KB); pinning `opsz` saves 42 KB but loses the display cut. The subset keeps the OFL copyright name record.

### 5.2 How it is embedded

The theme is injected as one `<style>` per Steam and SteamVR window and nothing is written into Steam's files, so the font travels inside the CSS as a `data:` URI.

1. Generate: `python docs/phase2/fontkit.py --css theme/01-font.nowrap.css`. **P4 generated it on 2026-10-07 and it is live [A12]**: 163,504 bytes (the subset as 161,948 bytes of base64, the face rule and the sweep); measured 163,530 bytes inside each window's bundle. Never edit it by hand.
2. It must be a `*.nowrap.css` file: `device/lgs.py` nests every other stylesheet under `html.lgs-on {}` and warns on `@font-face` there; `device/lgs_vr.py` also sends every `theme/*.nowrap.css` to SteamVR's pages, so the same face reaches systemui.
3. The generated rule (base64 elided):

```css
@font-face {
  font-family: "LGS Inter";                 /* private name: never collides with a page's own Inter */
  src: url(data:font/woff2;base64,…) format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: block;                     /* in-memory data: no swap flash */
  unicode-range: U+0000-00FF, U+0100-017F, U+0192, U+0218-021B, U+02C6-02C7, U+02D8-02DD,
                 U+0300-0308, U+030A-030C, U+0326-0328, U+0370-03FF, U+0400-045F, U+0490-0491,
                 U+2000-206F, U+20AC, U+20B9, U+20BD, U+2122, U+2190-2193, U+2212, U+2215,
                 U+2248, U+2260, U+2264-2265, U+FEFF, U+FFFD;
}
```

4. Use it through one token, with Steam's own families after it, so every codepoint outside the range (CJK, Thai, Arabic, Hebrew, Vietnamese) falls through to Steam's fonts:

```css
html.lgs-on { --lgs-font: "LGS Inter", "Motiva Sans", Arial, sans-serif; }
html.lgs-on body {
  font-family: var(--lgs-font); font-synthesis: none; font-optical-sizing: auto;
  -webkit-font-smoothing: antialiased;
}
/* the sweep as generated [A12]: (0,3,2) beats Steam's strongest family rule (".BasicUI .A .B",
   0,3,0) and reaches form controls, which do not inherit font-family in Chromium */
html.lgs-on.lgs-on.lgs-on body :where(:not(code, pre, kbd, samp, tt, code *, pre *, kbd *, samp *)) {
  font-family: var(--lgs-font);
}
```

   - Then sweep every surface for elements whose computed `font-family` sets Motiva Sans explicitly (`python glass.py styles SURF` over the text runs) and point them at `var(--lgs-font)`. Leave monospace, the keyboard's glyph labels and any Steam icon font alone.
   - **Languages that would mix faces in one word** (Vietnamese, and any language whose letters Inter covers only partly) keep Steam's stack: `html.lgs-on:lang(vi) { --lgs-font: "Motiva Sans", Arial, sans-serif; }`. Check what Steam puts in `document.documentElement.lang`; if it is not the UI language, key the rule on Steam's language class instead.
5. Cost: +163 KB of CSS per window that receives the bundle. Measure with `python glass.py perf` and a memory read before and after; abandon `opsz` (−42 KB) before abandoning the face.
6. Verify on each surface: `document.fonts.check('500 24px "LGS Inter"')` is true, a CJK friend name still renders, and no CSP error appears for `font-src data:` (the risk is listed in §18).
   **Measured 2026-10-07 [A12]:** every Steam window (`main`, `bar`, `barpopup`, `keyboard`, `notifications`, `tooltip`, `frame.menu`, `floatingfooter`, `volumelevel`) loads the face, labels and inputs compute `"LGS Inter", …`, CJK falls through to Steam's font at the same width as stock, and scrolling `main` stays within 5 % (88.8 vs 87.7 fps). SteamVR's pages send `Content-Security-Policy: default-src 'self' 'unsafe-eval'`, which blocks `font-src data:`; there the face is added from script as a binary `FontFace` (no fetch, so the CSP does not apply), by the SteamVR theme core (P8). Until then those pages keep Steam's stack.

### 5.3 Type scale

iOS default sizes × 4/3, rounded up for the Frame's density; visionOS weights (Medium body, Bold titles) [VR §13].

| Style | Size (px) | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|
| Extra Large Title 1 | 64 | 700 | 1.10 | −0.02 em | Game hero title |
| Extra Large Title 2 | 52 | 700 | 1.10 | −0.02 em | Section heroes |
| Large Title | 46 | 700 | 1.18 | −0.015 em | Window / sidebar title |
| Title 1 | 38 | 700 | 1.20 | −0.015 em | Detail-pane page title |
| Title 2 | 30 | 700 | 1.25 | −0.01 em | Section headers, nested-page centred title |
| Title 3 | 28 | 600 | 1.25 | −0.01 em | Alert titles, card titles |
| Headline | 24 | 600 | 1.30 | −0.005 em | Button labels, row titles |
| Body | 24 | 500 | 1.30 | −0.005 em | Default text |
| Callout | 22 | 500 | 1.30 | 0 | Descriptions, dense secondary text |
| Subheadline | 20 | 500 | 1.30 | 0 | Secondary row text, Home labels |
| Footnote | 18 | 500 | 1.35 | +0.005 em | Metadata |
| Caption | **18 (floor)** | 600 | 1.35 | +0.01 em | Badges, legends |

Rules:

- **Title case** everywhere in chrome (section headers, tabs, legends, buttons). Undo Steam's `text-transform: uppercase` and `letter-spacing` in CSS; strings that are uppercase in Steam's localisation stay as they are.
- **No italics** (Steam's italic search placeholder becomes upright).
- **No Light, Thin or Ultralight** weights. Text that sits directly on the room (Home labels) is Medium or heavier with the on-room shadow (§8.3), never thin.
- **Tabular figures** (`font-variant-numeric: tabular-nums`) for clocks, battery, download progress, prices and sizes.
- **Never scale text in motion** (§11).
- Inter sets wider than Motiva Sans; with the 1.5× size increase, expect truncation. Every route needs `glass.py audit` and a visual pass for ellipsis on important labels.

---

## 6. Materials

### 6.1 Two glasses, five materials

- **visionOS glass** is the window itself: frosted, adaptive, no light/dark flip, chrome steady [official, DL §0].
- **Liquid Glass** is the functional layer floating over content: ornaments, menus, sheets, toasts, controls that float, with lensing and the iOS 27 tuning (darkened edge, brighter specular) [official, MO §1.3].

| Material | Use | glassd preset (T5, `native/glassd/README.md`, dial 0.5) | Thickness θ (MO §2.3) |
|---|---|---|---|
| `window` | The Steam main window; SteamVR's settings and Now Playing pages | tint .55, frost mip 3.6, bezel 20 mm, lens 6 mm, dispersion .25, soft rim .6 / 12 mm | 1 |
| `panel` | Standalone popup quads over the room: bar popups, Control Center tiles, frame-menu host, toasts, HUDs | tint .50, mip 3.4, bezel 12 mm, lens 4 mm, rim .7 | 0.5 |
| `liquid` | Ornaments: tab bar, toolbars, bar segments, floating controls, Home icon discs | tint .18, mip 1.4, bezel 16 mm, lens 16 mm, dispersion .35, bright rim 1.2 | 0 |
| `thick` | Menus, sheets, alerts, the keyboard platter | tint .45, mip 4.2, bezel 14 mm, rim .7 | 0.5–1 |
| `clear` | Only over media (video controls, the Play group over hero art), always with a 35 % black dimming layer under it | liquid with low tint and low frost, 1.6× refraction | 0 |

Thickness `θ = clamp(log2(shorterSide / 44 px) / 4, 0, 1)` interpolates frost, lens strength, tint, specular, darkened edge and shadow between presets, including during a morph (MO §2.3). θ is taken from the **shorter** side: the longer side made a 600 × 64 px tab bar "thick", against its own `liquid` preset, and the shorter side is what bounds a slab's bezel [A4, GM §1.7]. The CSS presets (T1) do not vary with size; glassd does.

### 6.2 Edges without outlines

The user's requirement: menus and panels have no clear outlines; the outline comes from the glass. Five cues build every edge, none of them a uniform line [MO §2.2, REF D.3]:

| Cue | Look | T1 CSS | T5 glassd |
|---|---|---|---|
| **E1 Tone step** | The glass is frosted and pulled toward a mid luminance, so its silhouette shows as a change of brightness and detail | Window and panel tint (`--lgs-window-bg`); over the room CSS cannot frost | Frost + adaptive tint |
| **E2 Lens band** | What is behind bends inward over a 6–16 px band at the bezel; the centre stays clear | SVG `feDisplacementMap` in `backdrop-filter` on the 1–3 most important small controls in a page (Chromium only); otherwise omitted | `uBezel`, `uRefr`, `uDisp` |
| **E3 Specular arcs** | A bright arc where the edge faces the key light (top, top-left), fading to nothing down the sides; a weaker arc (25–40 %) on the opposite edge; **gaps on both sides**, so never a closed loop | Masked `conic-gradient` ring 1.5–2 px (≥ 1.2 display px) on a free pseudo-element, key alpha .45–.62, plus a **radial lobe at 26 % of the width** (no linear top layer: it read as a full-width line on wide slabs) [A4, WN D-15] | `uRim`, `uSpec`, world-fixed light (the GM v2 crescent) |
| **E4 Darkened edge** | A 2–14 px dark band just inside the arcs, 8–20 % black; more on larger glass | Blurred inset shadow: `inset 0 0 Wpx -0.15W rgb(0 0 0 / A)` | `uDarkEdge` |
| **E5 Thickness and depth shadow** | The lower edge reads slightly occluded; a shadow sized by depth grounds the slab | `inset 0 -2px 4px -1px rgb(0 0 0 / .12)`; outer shadow per §3.8 | Inner shadow, contact shadow |

Rules:

- **R1** No `border`, no `outline`, no uniform `inset 0 0 0 1px` ring on any glass. The Phase 1 rim tokens `--lgs-window-rim`, `--lgs-panel-rim`, `--lgs-glass-rim` lose their closing ring term.
- **R2** One light for the whole scene: from above, 20° left of vertical (`conic-gradient(from 340deg …)`), matching glassd's light. Every arc peaks at the same angle.
- **R3** Arcs scale with size: on a 40 px capsule the key arc spans the top half; on a window it is a band near the top-left corner plus the lobe at 26 % of the width [A4].
- **R4** Selection and focus never add an outline (§10).
- **R5** The only stroke allowed is under Increase Contrast / Steam high contrast: 2 px solid white .70, glass opaque (§13).
- No 1 px lines inside glass either: separate panes by a material step, rows by space, and use a ≥ 2 px soft separator (white .08, inset 72 px) only where grouping is otherwise lost.

The edge CSS (T1), on a pseudo-element Steam leaves free, with the host already positioned by Steam. **As built [A4]:** `theme/03-material.css` draws it on `::before` of any element that sets `--lgs-edge: window|panel|liquid|thick|clear|control` (a CSS style query; contract `docs/phase2/contracts/tokens.md` §2), with the lobe in place of the linear layer below and the rim ×1.5 under gamepad focus. The original recipe:

```css
.lgs-edge::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  padding: var(--lgs-rim-w, 1.5px);
  background:
    conic-gradient(from 340deg,
      rgb(255 255 255 / calc(.62 * var(--lgs-rim, 1))) 0deg, rgb(255 255 255 / calc(.20 * var(--lgs-rim, 1))) 38deg,
      transparent 72deg, transparent 148deg,
      rgb(255 255 255 / calc(.20 * var(--lgs-rim, 1))) 180deg,
      transparent 214deg, transparent 288deg,
      rgb(255 255 255 / calc(.22 * var(--lgs-rim, 1))) 322deg, rgb(255 255 255 / calc(.62 * var(--lgs-rim, 1))) 360deg),
    linear-gradient(180deg, rgb(255 255 255 / calc(.30 * var(--lgs-rim, 1))) 0, transparent 26%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
.lgs-edge { box-shadow: inset 0 0 var(--lgs-de-w, 7px) calc(var(--lgs-de-w, 7px) * -.15) rgb(0 0 0 / var(--lgs-de-a, .14)),
                        inset 0 -2px 4px -1px rgb(0 0 0 / .12); }
```

| Material | Rim width | Rim strength | Dark edge width / alpha |
|---|---|---|---|
| window | 2 px | .78 | 16 px / .20 |
| panel | 1.5 px | .90 | 10 px / .16 |
| liquid | 1.5 px | 1.10 | 6 px / .12 |
| thick | 1.5 px | .85 | 12 px / .20 |
| clear | 1.5 px | 1.20 | 5 px / .10 |

### 6.3 Tone and adaptation

- **Target band.** Glass luminance converges to **L 55–110** of 255 whatever the room [REF D.1]: bright rooms darken by 10–50 %, dark rooms lift by 20–50 %. Text-bearing glass (window, menus) should sit at **L 70–90**, so secondary text keeps 4.5:1 (§8.1).
- **Hue follows the room.** No fixed blue-grey tint: the frosted room carries its own hue; the tint layer is neutral grey.
- **T5:** glassd's adaptive tint (darker and stronger over bright rooms, lighter over dark ones) does this per pixel at a coarse mip.
- **T1 fallback over the room:** `backdrop-filter` cannot see the room (DESIGN.md §1), so the window is a smoky tint `rgb(20 22 30 / .60–.84)` (the dial) plus the edge cues. That keeps contrast but shows the room unblurred at reduced strength; it is the accepted fallback when glassd is not running. In-page Liquid Glass (menus, ornaments over the window) still frosts what is inside the same page.
- **Measured in the mockup kit** (which stands in for T5 by frosting a room photo): window glass L 84 over the bright lounge (room L 134), L 84 over the dim room (room L 51), L 117 under a bright window in the studio photo (above the band; glassd's local adaptation is expected to pull it down). T1 tint: L 57.

### 6.4 Variants in Steam

| Variant | Steam use | Rule |
|---|---|---|
| Regular | Default for everything | Adaptive; text-safe |
| Clear | Media controls over trailers and streams, the Play group over hero art, the screenshot viewer | Only with a 35 % black dimming layer under it and bold, bright content on top; never mixed with Regular in one group |
| Tinted | One primary per screen: Play / Resume (green), Install / Update / confirm (blue), destructive confirm (red) | Colour in the glass or the whole fill, never in the label |
| Identity (off) | Anything already inside glass; everything under Increase Contrast | — |

### 6.5 Fills on glass (no glass on glass)

| Fill | Value | Use | Polarity |
|---|---|---|---|
| Thin | white .10 | Buttons at rest, chips | Raised |
| Navigation selected | white .18 | Selected tab, sidebar row, list selection | Raised |
| Hover add | + white .08 | Hover | — |
| Focus add | + white **.32** (the final value of the .28–.32 tuning range, set from G-FOCUS: .28 failed P-14 and P-15 on the tab bar over glass at L ~95; `docs/phase2/wp/P4.md` P4-D8) [A5, VP D-2] | Gamepad focus | — |
| Regular | black .14 | Sidebar, grouped platters, Control Center inner platter | Recessed |
| Thick | black .30 + `inset 0 2px 5px rgb(0 0 0 / .26)` | Text and search fields, slider tracks, segmented tracks | Recessed |
| Selected | white .94, label `#0d0e12` | Toggled / selected button, selected segment, open-menu source | Raised, reserved |
| Bubble (others) | white .14–.18 | Chat bubbles | Raised |

**Never** make a grouped section lighter than its glass (Phase 1's white .06 platters are inverted).

### 6.6 Tier map for materials

| Element class | T5 (glassd running) | T1 fallback (CSS only) |
|---|---|---|
| Main window | `window` cover over the room (656 or 720 by glass mode), shapes exclude the ornament margin | Smoky tint `rgb(20 22 30 / .60–.84)` (dial) + E3–E5 |
| Windowless routes (Home, folders, `/invites`), Control Center tiles, menus and alerts kept flat | **Plate** [A4]: an opaque glass shape with its own material, phase and tint at the cover's depth; Steam's real panel hidden under it (PLAN §1.6, P9 G1) | CSS plate: black .58 under a white .16 → .04 gradient + edges (`--lgs-mat-plate-bg`) |
| Bottom ornament | `liquid` inset slab behind it at 0 mm [A3] | In-page blur 12 + saturate 1.7 + liquid edges |
| Tab bar | `liquid` cover of the frame-menu popup at +25 mm | Panel tint + edges |
| Menus, sheets, alerts | `thick` slab under the pop at +10 mm (wearer +30 / +50), or a flat `thick` plate [A3, A4] | `backdrop-filter` blur 30 px + tint .30–.40 + edges + shadow |
| Under every pop | **Hole treatment** [A4]: the popped element's contact shadow and its container's tone drawn into the cover, so the hole reads as its shadow, not a bright sliver (PLAN §1.6, P9 G2) | — (nothing pops) |
| Bar segments, popup quads | `liquid` / `panel` cover | Tint + edges, no blur |
| Primary capsule | Tinted `liquid` slab (needs a per-slab tint, GP GQ8) | Tinted fill + edges |
| Content (art, posters, web pages) | Never glass | Never glass |

### 6.7 Scroll edges

Content fades under floating bars instead of hitting a hard clip or an opaque band [official, MO §4.13]: a band of the bar's height + 16 px with a progressive blur and a 30 % → 0 dimming gradient (dimming dominates over Steam's dark content), opacity scroll-linked over the first 24 px of scroll. Where Steam's scroller can take a mask, a `mask-image` gradient over its last 120 px under a bottom ornament is enough (as in the example), but only if nothing inside the scroller uses `backdrop-filter`: a mask makes the scroller a backdrop root (MO R1, R11). One edge effect per view, never stacked.

---

## 7. Spatial components

Each component lists shape and size, material, states, depth and tier. Sizes are main px.

### 7.1 Window anatomy

See §3.2 (window) and §3.1 (the scene).

### 7.2 Tab-bar ornament

See §3.3.

### 7.3 Bottom toolbar ornament

- Holds Steam's footer actions as **real buttons**: a mixed-case label 22–24 px with the controller glyph as a small leading or trailing badge (30 px circle, white .20, 16 px Bold letter) that teaches the gamepad mapping (SN C.4). The legend stays Steam's node; its click dispatch is unchanged.
- Shows current state: the current sort ("Recently Played"), the active filter count (a badge), the VR segment.
- Library example: Sort capsule, Filter capsule with count, `All · VR · Non-VR` segmented control, More circle; 896 px wide (`shots/p2_example.png`).

### 7.4 Corner buttons, back and close

60 px circles concentric with the window corner (inset 24), with 80 px hit boxes at (14, 14). Back top-left on every route, actions top-right. The Large Title therefore starts at x 100 [A1, WN D-3]. Back grows into a capsule with the previous page's title after 0.6 s of hover or focus (Subheadline 20 px Medium, max 240 px, the circle stays in place). B keeps working. Steam's "Back" text shown as the chevron circle is exemption E-BACK (PLAN §1.16).

### 7.5 Search field (the user's named example)

| Property | Value |
|---|---|
| Where | Centred in the window's toolbar row on every route (Steam's `%{SearchBox}` element restyled, SN C.1); the same capsule on the search route; optionally a Safari-style top ornament for web views |
| Shape | 64 px capsule (never below 60): **520** wide on section roots (Library, Photos, Downloads), **640** on nested routes and the search route; or a **60 px circle** in an 80 × 80 box on Home, folders, hero routes, Steam Settings, the `/chat` sidebar row, the photo viewer, `/account`, the `/invites` card and achievements (PLAN §1.9) [A1, WN D-4] |
| Fill | Thick (recessed): black .30 + inner shadow |
| Content | Magnifier 26 px at 22 px inset, placeholder Body 24 px Medium at white .55 (upright), clear as a 44 px circle inside with an 80 px hit area. **No microphone**: Steam has no dictation [A1, WN D-8] |
| Focus | The one ring in the system: 3 px soft white .55 + 16 px glow |
| Keyboard | Opens on activation only. Typed text is echoed on the keyboard's own slab (SM C.2, SQ4), so eyes stay on the keys |
| Search sheet (T3) | Search is window-nav §4: a sheet over a snapshot of the page you were on, with Steam's search route underneath; the whole search stays in the sheet (WN D-17, PLAN §1.9). Other areas add results through C1b's provider API |

### 7.6 Sidebar and split view

- Sidebar runs the full height on the leading side, ≈ 30 % of the glass (340–400 px), **one material step darker** (black .14) with no line, no inset box and no rim (refs 2, 4, 8, 12).
- Rows 72 px, 8 px apart, Body 24 px Medium; selected row = white .18 capsule pill inset 8–12 px; hover/focus adds white .08 / .14 + the light spot. No scale, no lift.
- Settings-style rows have a 40 px coloured circle with a white glyph (T2 decoration keyed by a `data-lgs-page` attribute, SY C.2), trailing value in text-2, chevron.
- Header: Large Title 46 px Bold at 32 px from the top; search capsule under it when it filters the sidebar.

### 7.7 Lists and grouped rows

Platter: black .14, radius 30 (54 − 24), 24 px from the glass edge, rows 80 px contiguous with a hover pill inset 6 px (radius 24). Trailing value + chevron in text-2. No separators, or 2 px white .08 inset 72 px. Platter max width ≈ 760 px centred on wide detail panes, which cuts the label-to-control sweep from 25–28° to 18–20° (SY C.2).

### 7.8 Content cards and posters

Content is opaque and rounded, never tinted or blurred. Posters radius 20 (concentric); focus or hover = lift: `scale: 1.05`, +15 mm, shadow `0 18px 44px /.48`, a soft white glow 30 px, and a diagonal specular sheen (`plus-lighter`, tvOS-style). No ring. Title appears under the focused poster only (Steam's shelf behaviour), Headline 24 px.

### 7.9 Buttons

Circle (icon only) or capsule (text, or text + icon) [official, VR §11]. Rest fill thin; inside ornaments borderless (transparent at rest). One tinted primary per screen. Disabled: content at 40 % opacity, no hover. Destructive: red label at rest, red whole fill on focus.

### 7.10 Segmented control

Recessed capsule track (black .30, 64 px), segments as capsules with 22 px Semibold labels, **selected segment = white pill with a dark label** (this is where white is right). The pill travels on `snappy` (§11). Steam's tab strips with explicit `onMoveLeft/onMoveRight` handlers must stay horizontal (GP §0.5).

### 7.11 Toggle and slider

- Toggle: visionOS proportions ≈ 66 × 40, green whole-fill track when on, white knob; enlarged with the independent `scale` property so Steam's knob translation keeps working (SY C.0, CS1).
- Slider (Control Center style): capsule 64–72 px, value = white .86 fill from the leading edge with a dark glyph inside it, track recessed, knob only on hover or focus. Value follows the pointer directly.

### 7.12 Menus, sheets, alerts, toasts

See §3.7 for sizes and depths, §11.5 for their motion.

### 7.13 Window bar and frame controls (SteamVR systemui)

- Grab handle → the visionOS window-bar pill: 180 × 16 visible (white .52, soft shadow), hit area ≥ 80 px tall, under the dashboard bar where SteamVR places it. Brighter on hover.
- Frame controls (keyboard, float, theater, more) → glass circles in a quiet panel capsule; can be enlarged with CSS because their quad follows the DOM (SP §6.2 [PROVEN]): 64 systemui px circles (= 48 main px; target in systemui px is 107, so prefer 80 systemui px circles where the atlas allows). Keep Steam's idle-dim opacity rule; compensate with brighter fills.

### 7.14 Dashboard bar

Each `%{BarSurface}` becomes one liquid capsule (radius = half its height). Buttons 60–64 popup px circles at ≥ 72 popup px pitch; white only when toggled or when their popup is open; clock 24–28 px tabular; battery as a capsule with level fill and number (only when Steam's Battery Percentage setting is on); unread notifications as a red count badge; running apps as circular art (portrait crop) with a lighter platter and a small white dot when selected (SY C.4, LA C.7).

### 7.15 Keyboard

Keys stay Steam's (geometry fixed); keys become raised fills with radius 10–12, Enter the one blue key, the touched key white with a dark label. A glassd `thick` platter 1 cm behind the keyboard quad (SM SQ14) and a display-only echo row at the top of the slab with the field's label.

---

## 8. Vibrancy and colour

### 8.1 Text on glass

| Level | Value | Use |
|---|---|---|
| Primary | white .96 | Titles, labels, body |
| Secondary | white .70 | Values, metadata, descriptions |
| Tertiary | white .50 | Non-essential hints only, never required information |
| Quaternary | white .32 | Disabled glyphs |

Contrast check: on glass at L 85, secondary white .70 composites to ≈ L 204 → 4.6:1; at L 110 it drops to 3.4:1, which is why text-bearing glass targets L 70–90 (§6.3). Primary white (.96) keeps ≥ 4.8:1 across the whole band (4.85:1 at L 110).

### 8.2 Selection vocabulary

| State | Look |
|---|---|
| Toggled or selected **button**, selected **segment**, button whose **menu is open** | White .94 fill, dark label |
| Current **navigation** location (tab, sidebar row, list selection) | White .18 translucent pill with a specular top arc, white **Semibold** label [A5] |
| Hover (laser) | + white .08 and a light spot (.12) at the pointer, under the label; on **navigation rows** (sidebar, list, tab bar) the spot only, no fill [A5, SM-D13, SET T-SEL] |
| Gamepad focus | + white **.32** uniform, a .16 spot in the upper third, the control's own specular arc ×1.5; the first frame shows 60 % [A5, VP D-2] |
| Focus on a white or coloured fill | A blurred outer glow (`--lgs-white-glow`, 22 px blur, 8 px spread, white .55), never a ring (VP P-16) [A5] |
| Disabled + focus | Fill .10, arc at 60 %, no spot (CTL C-D15) [A5] |
| Text field focus | 3 px soft ring white .55 (the only ring) |

Criteria (gate G-FOCUS, PLAN §1.4): focus ≥ +40 L over rest; focus ≥ selected + 15 L; selected ≥ hovered + 12 L; glow band ≥ +20 L on white and coloured fills; disabled + focus ≥ +10 L; first frame ≥ 60 % of the final contrast. Focus and selection also differ in shape where they share a control (WN D-10: the selected tab is a circle behind the glyph, focus a pill).

### 8.3 Colour

- visionOS uses the dark-appearance system colours [official]: blue rgb(0 145 255), green rgb(48 209 88), red rgb(255 66 69), orange rgb(255 146 48), yellow rgb(255 214 0), teal rgb(0 210 224), indigo rgb(109 124 255), purple rgb(219 52 242). Increased-contrast variants in VR §14.
- **Colour only in whole fills**: on-toggles, the tinted primary, badges, Steam's semantic online/in-game colours as dots or rings. Never thin coloured text on glass (exception: a destructive row's red label, which is an action label at Headline weight).
- Play keeps Steam green (`rgb(48 209 88 / .88)`), Install/confirm blue (`rgb(0 145 255 / .86)`), destructive red (`rgb(255 66 69 / .84)`).
- **Text directly on the room** (Home labels): Medium or heavier, white .92, shadow `0 1px 3px rgb(0 0 0 / .55), 0 0 12px rgb(0 0 0 / .35)`.
- Large white areas glare in a dark room: keep white fills small (selected states, slider values).
- Test colour in both passthrough modes: mono removes room colour, the colour camera brings it back.

---

## 9. Iconography

### 9.1 Symbols

- SF Symbols cannot be used off Apple platforms. Use Steam's own SVG icons where Steam provides them, recoloured white; for new T2/T3 elements, use symbols drawn to SF proportions on a 24-unit grid with ≥ 2 CSS px round strokes (the kit's sprite in `kit.js` is the reference: home, library, store, friends, media, download, gear, VR, power, search, mic, sort, filter, play, keyboard, float, theater, check, xmark, speaker, wifi, bluetooth, bell, controller, grid, recenter, person, star, trash, share, clock, pencil, window, terminal, sparkle, moon, sun, airplane, room). A third-party set must be OFL, MIT or ISC and keep its licence file.
- Sizes: 26–28 px in a 60 px circle (≈ 45 % of the diameter), 24 px in rows and menus, 28 px in tab-bar items, 22 px inside fields and chips.
- Icon-only buttons get an `aria-label` (T2) and a tooltip after 0.8 s.

### 9.2 Circular icons for games (Home and launchers)

Composition for a Steam game (T3 view; LA D.2):

1. A circle mask with the game's **hero** image, `object-fit: cover`, centred (by Steam's asset rules the hero carries no logo).
2. The **logo** centred at 70 % of the diameter with a soft shadow.
3. A specular arc from above and a contact shadow (6 px y, 18 px blur, black .35); no frost, no tint: art is content.
4. Fallbacks in order: portrait capsule cropped at `object-position: 50% 30%`, the user's custom art, then a **monogram** (initials in Bold on a gradient taken from the icon's average colour).
- Sources: Steam's own `appStore` / `appDetailsStore` methods (`GetCachedVerticalCapsuleURL`, `GetHeroImages`, `GetLogoImages`); always the first URL Steam returns, from the local `/assets/` cache. Hero composites only for the visible page (a hero decodes to ≈ 4.8 MB; LA LQ6).
- Badges: red capsule top-right (updates, new); a "Running" badge from `MainRunningAppID`.

### 9.3 Circular icons for programs (Launch Program)

A glass disc (T5 `liquid` slab, or a thin fill + specular arc in CSS) holding the program's icon at **≤ 1.5× its source size**: 48 px for Steam's 64 px `strIconDataBase64`, up to 72 px when the daemon supplies a ≥ 128 px icon-theme file (LA D.3, LQ4). Missing icons: a category glyph (terminal, settings, display) chosen from the name, else the initial. Full-bleed only with a ≥ 192 px source.

### 9.4 Other circles

- **Folders / collections:** a circle holding a 3 × 3 grid of portrait crops; empty collections dimmed, sorted last, labelled "Empty".
- **Avatars:** circles; presence as a 3 px ring in the state colour drawn on the avatar image (Steam's animated status element untouched).
- **Running apps in the bar:** 56 popup px circles of portrait crops.
- **Controller glyph badges:** 30 px circles, white .20, 16 px Bold letter (A, B, X, Y, ≡), on visible buttons that have a gamepad shortcut.

---

## 10. Hover, focus and press

The laser plays the role of the eyes; Steam's gamepad focus (`.gpfocus`) plays the role of the controller focus system. **Every focusable element shows a state in both models, and nothing is reachable by hover alone** [official, VR §12].

**Input-mode keying [A5, VP D-1].** Steam sets `.gpfocus` for the laser too, so every look is keyed on P3's input mode (`html.lgs-input-laser` / `html.lgs-input-pad`, from `FocusNavController.NavigationSource`): laser looks key on `:hover` only, never on `.gpfocus` (a stale `.gpfocus` can survive under the laser); the focus look keys on `.gpfocus` only in gamepad mode. `theme/04-states.css` publishes the states as numbers (`--lgs-hover`, `--lgs-focus`, `--lgs-press`, `--lgs-lift`, `--lgs-dis`) so areas never write input-mode logic (contract `tokens.md` §3).

**Laser dwell [A5, VP D-7].** A laser sweeps through every card in its path, so under the laser brightness changes at once but **lift, scale and depth start only after 80 ms of dwell** (`.lgs-dwell`, sign-off S25). Gamepad focus lifts at once.

### 10.1 The illumination layer

States are drawn on a pseudo-element Steam leaves free (`::after` usually; Steam's FocusRing uses `::after` on some nodes), `pointer-events: none`, never an outline (MO §6.4 recipe "Illumination layer"). **As built:** the hook `--lgs-ill: raised|recessed|row|nav|white|card` on an element draws the layer on its `::after` (`theme/04-states.css`), with **normal alpha compositing**, not `plus-lighter`: VP D-2's "+48 L for .28" is normal compositing, and a blend mode on every hooked control would force isolated groups. Steam's floating FocusRing becomes a light plate (white .12 + the .16 spot + a soft glow, no outline, no pulse) where Steam draws its only focus cue (CTL §4.5).

| State | Laser hover | Gamepad focus |
|---|---|---|
| Fill | + white .08 (navigation rows: none) | + white **.32**, held [A5] |
| Light spot | Radial gradient at the hit point (T2 writes `--hx/--hy` from `pointermove`, throttled to frames), radius 1.5 × the shorter side, peak + .08–.12 additive (MO §4.2) | Static, centred in the upper third, peak + .16 |
| Specular | — | The control's own arc ×1.5 (it "lifts into glass") |
| First frame | — | ≥ 60 % of final contrast immediately (P5's `lgs-focus-in` starts at `--lgs-focus-first` = .60), so focus is never invisible during D-pad auto-repeat |
| Content cards | Lift (§7.8) after 80 ms of dwell [A5] | Lift at once |
| Rows, toolbar buttons, tabs | No scale, no lift | Same |
| Text fields | Fill only | Fill + the 3 px ring |

### 10.2 Press

- Glow from the hit point (laser) or the centre (gamepad A), radius 0.5 → 1.5 × the shorter side, + white .15 additive, + .06 uniform.
- **Glass controls swell** by +6 px on the longest side, capped at ×1.06 (`scale: min(1.06, 1 + 6 / maxSide)`); rows and cards brighten only.
- Release: glow off in 90 ms linear, scale back on `snappy`. The action fires immediately; nothing waits for an animation.
- Gamepad A has no `:active`; T2 must observe Steam's gamepad button events on the focused element to set a `lgs-pressed` class (MO risk 4: event names to verify).

### 10.3 Delayed reveals

| Reveal | Delay in / out |
|---|---|
| Tooltips | 0.8 s / 0.2 s |
| Back button title | 0.6 s |
| Tab bar labels | 0.4 s (gamepad: immediate on entry) |
| Home icon actions (ramp: 2 % scale at once, pop at 0.8 s) | 0.8 s |
| Secondary actions on a card (like, comment) | Revealed by focus as Steam does today, materializing in 250 ms |

### 10.4 Parity rules

- Every hover reveal also appears under gamepad focus.
- Every footer-legend-only action gets a visible button (bottom toolbar, a "⋯" on the hovered or focused row) that dispatches the same Steam handler (SM §A.10, LA C.4).
- Unavailable items give no hover feedback.
- **Controller glyph badges show only in gamepad mode** (keyed on `html[data-lgs-vr-mode="gamepad"]`); in laser mode they would teach buttons the user is not holding. Steam's own laser-mode pill replaces the legend there [A5, VP D-5].

### 10.5 Feedback: sound and haptics [A9]

- **Sound** (VP D-4, IM §6.4): our T2/T3 controls call Steam's sound bus with the same `ENavSound` Steam plays for the same event (navigation move, activate, toggle, back), so new controls do not feel dead next to Steam's. No new sound files, no sound on hover, and Steam's UI-sounds setting is honoured.
- **Haptics: off** (sign-off S17, flag `haptics`). No wearer can judge them.

---

## 11. Motion

Everything in this section comes from `research/liquid-glass-motion.md` (MO). Section numbers in brackets point there. Apple publishes no glass-specific durations; the official numbers are SwiftUI's springs, and glass timings are community 120 fps measurements of iOS 26, subdued for pointer and gamepad as the HIG prescribes ("a more subdued effect when a person interacts using a trackpad") [MO §0, §1].

### 11.1 The spring model [MO §3.1]

Springs are defined by perceptual **duration d** and **bounce b** (SwiftUI `Spring`), mass 1:

```
stiffness k = (2π / d)²          damping c = 4π (1 − b) / d        dampingFraction ζ = 1 − b
settle      = last time |1 − x(t)| > 0.001   (Apple's epsilon)
```

Official presets [MO §3.1]: `Animation.default` = spring(response 0.55, dampingFraction 1.0): settles in 808 ms. `smooth` / `snappy` / `bouncy` = d 0.5 with b 0 / 0.15 / 0.3. `interactiveSpring` = response 0.15, ζ 0.86.

### 11.2 Tokens [MO §3.2]

The CSS duration of a token is the spring's **settling time**; the easing depends only on the bounce.

| Token | d (s) | b | t90 | **CSS duration** | Overshoot | Easing | Use |
|---|---|---|---|---|---|---|---|
| `interactive` | 0.15 | 0.14 | 78 ms | **210 ms** | 0.5 % | b15 | Press-in, drag-follow smoothing, gamepad slider steps |
| `hover-in` | 0.20 | 0 | 124 ms | **294 ms** | 0 | b0 | Hover light in, focus illumination in |
| `fade` | 0.30 | 0 | 186 ms | **441 ms** | 0 | b0 | Hover and focus out, content cross-fades, list insert |
| `snappy` | 0.35 | 0.15 | 178 ms | **488 ms** | 0.6 % | b15 | Selection pill travel, toggle knob, toast in, release |
| `release-touch` | 0.40 | 0.25 | 178 ms | **510 ms** | 2.8 % | b25 | Direct hand poke only (not used with laser or gamepad) |
| `morph-open` | 0.45 | 0.20 | 214 ms | **607 ms** | 1.5 % | b20 | Menu, popover, dropdown grows out of its source |
| `morph-close` | 0.30 | 0 | 186 ms | **441 ms** | 0 | b0 | Menu returns into its source |
| `sheet-in` | 0.50 | 0 | 310 ms | **735 ms** | 0 | b0 | Sheet or modal present; parent dims |
| `sheet-out` | 0.35 | 0 | 217 ms | **514 ms** | 0 | b0 | Sheet dismiss |
| `page` | 0.45 | 0 | 279 ms | **662 ms** | 0 | b0 | Route and tab content transitions |
| `depth` | 0.30 | 0 | 186 ms | **441 ms** | 0 | b0 | z of popped crops and slabs |
| `materialize-in` (small glass) | linear channels | — | — | **250 ms** | — | linear | Toasts, tooltips, chips, ornaments appearing |
| `materialize-out` (small glass) | linear channels | — | — | **350 ms** | — | linear | Small glass leaving |
| `materialize` (large glass) | rides the surface's spring | — | — | `sheet-in` / `sheet-out` | — | — | Sheets, windows |

### 11.3 Easing strings [MO §3.3]

Chromium 126 (Steam's CEF) supports `linear()`. One curve per bounce value:

```css
/* bounce 0      (settle = 1.470 × d) */
--lgs-ease-b0:  linear(0, .005 1.2%, .020 2.3%, .084 5.2%, .159 7.7%, .461 16.9%, .556 20.2%, .639 23.5%, .709 26.9%, .767 30.2%, .817 33.7%, .861 37.6%, .900 42.1%, .930 46.9%, .954 52.4%, .971 58.6%, .991 73.8%, 1);
/* bounce 0.15   (settle = 1.393 × d, overshoot 0.6 %); also interactive (b .14) */
--lgs-ease-b15: linear(0, .006 1.3%, .024 2.7%, .054 4.2%, .093 5.7%, .188 8.7%, .518 18.2%, .613 21.4%, .696 24.5%, .767 27.7%, .825 30.9%, .872 34.1%, .913 37.6%, .945 41.4%, .970 45.6%, .988 50.3%, 1.000 55.8%, 1.006 67.9%, 1);
/* bounce 0.20   (settle = 1.349 × d, overshoot 1.5 %) */
--lgs-ease-b20: linear(0, .006 1.3%, .025 2.8%, .056 4.3%, .099 6.0%, .199 9.2%, .536 18.9%, .633 22.0%, .717 25.2%, .785 28.2%, .844 31.4%, .894 34.7%, .933 38.1%, .964 41.7%, .987 45.7%, 1.003 50.3%, 1.012 55.3%, 1.015 64.8%, 1);
/* bounce 0.25   (settle = 1.274 × d, overshoot 2.8 %) */
--lgs-ease-b25: linear(0, .007 1.5%, .026 3.0%, .058 4.7%, .104 6.5%, .207 9.8%, .556 20.0%, .656 23.4%, .739 26.5%, .806 29.5%, .865 32.7%, .913 35.9%, .952 39.2%, .983 42.9%, 1.005 46.7%, 1.019 50.9%, 1.027 55.8%, 1.027 63.8%, 1);
```

`cubic-bezier()` fallbacks for the rare place `linear()` cannot go: b0 `(.327, .692, .114, 1)`, b15 `(.311, .589, .077, 1.118)`, b20 `(.330, .632, .076, 1.138)`, b25 `(.344, .630, .084, 1.171)` (1.1–1.4 % RMS error). They replace Phase 1's `--lgs-spring` and its 140/220/320 ms durations. `docs/phase2/research/springs.py --css` reproduces every curve.

### 11.4 Choreography rules [MO §3.4–3.5]

- **C1 Two channels.** The glass channel (lensing, frost, tint, rim, shadow, shape) and the content channel (Steam's pixels: opacity, a small blur, a small offset). Small-glass entrance: glass 0–92 % of the time, content 35–100 % with blur σ 8 → 0. Exit: content gone by 55 %, then the glass dissolves to the end.
- **C2** Scale rides the glass channel (`s = s0 + (1 − s0) · g`); no separate curve.
- **C3** Scale depends on size: `s0 = 1 + clamp(12 px / maxSide, 0.01, 0.15)` (1.15 at ≤ 80 px, 1.04 at 300 px, 1.01 for windows).
- **C4** Pointer and gamepad are subdued: press swell +6 px (≤ ×1.06), bounce ≤ 0.2, gel stretch ≤ 5 %, no gel for gamepad.
- **C5** Retarget, never queue: D-pad auto-repeat looks like one moving highlight.
- **C6** Never block: actions fire on release (laser) or A-down (gamepad); no control is disabled during an animation; no transition layer intercepts input.
- **C7** Nothing moves at rest: no shimmer, pulse or breathing; Steam's `Blinker` focus pulse stays neutralised; `document.getAnimations().length === 0` at rest.
- **C8 Reduce Motion:** bounce 0; scale, translate and depth become fades; no blur ramps; drags track input directly; materialize becomes a 150–200 ms cross-dissolve. Fades stay (Phase 1's 1 ms rule is withdrawn).
- **M1** No lateral slide over 24 px of any surface wider than 600 px; use fade + ≤ 16 px parallax.
- **M2** Nothing enters from the periphery; toasts appear in place.
- **M3** No lasting oscillation: b ≤ 0.25 settles within one visible cycle; nothing repeats near 0.2 Hz.
- **M4** Animated depth changes ≤ 20 mm, on `depth` (b 0). Text never gets depth of its own.
- **M5** World-anchored: animations never move or rotate the window.

### 11.5 Interaction matrix [MO §4.1]

| Interaction | In | Out | Animates | Must not animate |
|---|---|---|---|---|
| Hover (laser) | 294 ms `hover-in` [b0] | 441 ms `fade` [b0] | Light spot (follows the pointer), fill alpha | Scale, size, outline, blur radius, text |
| Press | 210 ms `interactive` [b15] | — | Inner glow from the hit point; glass swell (glass controls only, ≤ ×1.06); fill brightness | Position, layout, row and card scale, backdrop blur |
| Release | Glow off 90 ms linear | Swell back 488 ms `snappy` [b15] | Glow, scale | Delaying the action |
| Focus move (gamepad) | 294 ms `hover-in`, first frame ≥ 60 % | 441 ms `fade` | Illumination, glass "lift" look, content-card z (§3.8) | A travelling indicator between items, bounce, delay, row/toolbar scale |
| Selection change (segmented, tabs) | Pill travel 488 ms `snappy`; lift 210 ms `interactive` | Settle 488 ms `snappy` | Pill position and width; pill lifted into clear glass while moving; stretch ≤ 5 % (pointer only); label colours swap at t90 | Tab labels, sizes, layout, bounce > 0.15 |
| Menu open | 607 ms `morph-open` [b20] | — | Shape from the source rect and radius to the menu's; θ; glass channel; content 15–50 %; z from the source's depth to the menu's | Content scale, the source's position, item layout |
| Menu close | — | 441 ms `morph-close` [b0] | Content out by 40 %, shape back into the source, ×1.03 catch on the source | Input capture by the closing menu |
| Popover | As menu | As menu | As menu | As menu |
| Sheet present | 735 ms `sheet-in` [b0] | — | Glass on the sheet spring, scale 0.97 → 1 (or morph from source), content 25–70 %, parent scrim 0 → 35 % on `fade`, sheet z +30 → +50 mm | Slide from an edge, parent position or scale in CSS, blur-radius ramps on large areas |
| Sheet dismiss | — | 514 ms `sheet-out` [b0] | Content out first (0–40 %), glass dissolves, scale → 0.98, scrim → 0 | Swell of large surfaces toward the viewer |
| Alert | Morph from source if known; else materialize 250 ms + swell 1.02 → 1 | Dematerialize 250 ms | Glass channel, scrim 0 → 35 %, small swell | Shake, bounce > 0.15, delayed focusability |
| Toast in | Materialize 250 ms + translate −8 → 0 px `snappy` | — | Glass channel, content 35–100 %, swell `1 + 12/maxSide` | Slide-in from off-screen (Steam's 300 px), pulses |
| Toast out | — | Dematerialize 350 ms | Content out by 55 %, glass dissolves | Sliding away |
| Window open / close | Glass ramp 735 ms `sheet-in` (glassd, geometry fixed) | Glass dissolve 300 ms after content | Lensing, frost, tint, rim | Window position, rotation, scale > 1 % |
| Page / route | Content fade + 16 px parallax 662 ms `page`, 0–60 ms delay | Old content fade 150 ms linear | Opacity, ≤ 16 px translate in the navigation direction | Full-width slides, zoom > 1.5 %, 3D, delays > 60 ms, re-animating persistent chrome |
| Scroll edge | Scroll-linked over 0–24 px | Scroll-linked | Edge-effect opacity | Blur radius, height, stacked effects |
| List insertion | 441 ms `fade` + translate 8 → 0 px, stagger 30 ms, ≤ 5 rows | Removal instant | Opacity, small translate of really new rows | Height, margins, mount animations on virtualised rows |
| Toggle | Knob lift 210 ms `interactive`, travel and settle 488 ms `snappy` | — | Knob scale ×1.3/×1.2, knob fill white → glass → white, track colour at t50 | Track size, bounce > 0.15 |
| Slider drag | Thumb lift 210 ms `interactive` | Settle 488 ms `snappy` | Thumb ×1.25 and glass look; value = pointer, no easing | Easing on the value, track size, glass thumb at rest |
| Tab bar minimize | Not adopted | — | — | — |
| Tooltip / reveal | After 0.8 s, materialize 250 ms | 0.2 s, dematerialize 350 ms | As toast | Instant reveals |

Steam-specific notes [MO §4.10, §4.12, §5]:

- Steam's toast children run `animation: toastEnter, toastExit`; add our entrance in place of `toastEnter` and keep `toastExit` with Steam's timing, or the toast never leaves. Read the real keyframe names from the live stylesheet first.
- Route overrides (`TopLevelTransitionSwitch` Enter / EnterActive / ExitActive) keep each phase at or below Steam's own totals (enter ≤ 800 ms with delay, exit ≤ 200 ms) so React's transition timeouts never cut an animation. Direction (±16 px) needs T2; T1 uses 0 px. These rules lift the Phase 1 ban on touching `TopLevelTransition`. **Adopted** (sign-off S3: the brief asks for Liquid Glass motion): route, card and menu entrance overrides are allowed within Steam's timeouts; toasts keep Steam's `toastExit*` [A10, PLAN §1.5].
- Steam's library tab slide (`translateX(±40 %)`, 320 ms, 80 ms delay) becomes ±16 px + fade on `page`.

### 11.6 Menu morph and materialize recipes [MO §6.4]

- **Materialize (small glass):** two keyframe channels on the glass element and its children, `backwards` fill so nothing stays on Steam's nodes at rest:

```css
.lgs-mat { --s0: calc(1 + min(.15, 12 / var(--lgs-maxside, 80)));
  animation: lgs-mat-glass-in var(--lgs-d-mat-in) linear backwards; }
.lgs-mat > * { animation: lgs-mat-content-in var(--lgs-d-mat-in) linear backwards; }
@keyframes lgs-mat-glass-in {
  0%        { scale: var(--s0); background-color: transparent; backdrop-filter: blur(0px) saturate(1); }
  92%, 100% { scale: 1; background-color: var(--lgs-mat-bg); backdrop-filter: var(--lgs-mat-blur, blur(22px) saturate(1.8)); } }
@keyframes lgs-mat-content-in { 0%, 35% { opacity: 0; filter: blur(8px); } 100% { opacity: 1; filter: blur(0px); } }
```

- **Morph from source (in-page menus):** a `clip-path: inset(… round …)` from the source rect (T2 fills `--sx --sy --sw --sh --sr` from the trigger's rect; T1 default a 64 × 48 capsule at the top-left) to the menu's box on `morph-open` with the b0 curve; content 15–50 %. glassd draws the 1.5 % overshoot and the liquid neck in T5.
- **Cross-quad menus** (bar "+" → its popup): a true morph is possible only in glassd over the union of both world rects; otherwise materialize the popup in place, scale origin at the edge nearest the button.

### 11.7 CEF rules [MO §6.3]

R1 never fade a parent of glass (it becomes a backdrop root); R2 Steam's keyframes beat declarations, so put motion on our pseudo-elements and registered properties and use `!important` for focus colours; R3 replace an entrance animation only by naming a new one and repeating Steam's functional entries; use independent `scale`/`translate`, never stacked `transform`; R4 exits need DOM (instant in T1 unless Steam keeps exit classes); R5 no mount animations on virtualised rows; R6 CSS retargets without velocity (fine for hover and focus); R7 hidden windows do not advance transitions, use keyframes for toasts; **R8 filter and backdrop-filter animations are allowed one-shot on elements ≤ 600 × 600 px, ≤ 350 ms, only if `perf` shows no frames > 34 ms** (amends Phase 1's ban); R9 `clip-path` and custom-property animations run on the main thread, menu-sized only; R10 respect React's timeouts; R11 leave nothing behind at rest (`backwards` fill; no resting `filter: blur(0)`, `scale: 1`, `clip-path: inset(0)` on Steam nodes). View Transitions are not used (MO §6.5).

### 11.8 Scene graph and glassd [MO §7–9, SP §4]

- Scene-graph motion is push-driven. SP measured 30, 60 and 90 pushes/s (≈ 1.6 ms compositor CPU per push of the ≈ 22 KB graph): push at 60/s only while a value moves, push the exact final value once, then stop. Evaluate springs by time (closed-form function, MO §8), not per step.
- Animate only depth (≤ 20 mm) and dim/opacity in the graph; never crop x/y or metres-per-pixel. Keep content motion in CSS (the crops are live).
- glassd runs springs itself at ≤ 72 fps from targets in `glassd.json`: per-shape materialize `m`, `press` + position, morph `k`. Materialize ramps rim/spec (0 → 0.6 of m), lensing (0 → 0.7), frost and tint (0.2 → 0.92), dark edge (0.3 → 0.92), shadow (0.4 → 1), coverage alpha `smoothstep(0, 0.3, m)`. Pad slab atlas regions by 12 Steam px × backdrop scale so swell and overshoot fit. Render at full rate only while a spring is unsettled.
- Reduce Motion: push the end depth once at the lowest-visibility moment; glassd uses coverage alpha only (150–200 ms).

### 11.9 Motion verification [MO §10]

1. Token conformance: `document.getAnimations()` durations equal a token, iterations 1, easing a `--lgs-ease-*` curve or linear.
2. Nothing at rest: `getAnimations().length === 0` one second after any interaction.
3. Filmstrips: pause and seek each animation at f = 0, .15, .35, .5, .75, 1 and CDP-screenshot `shots/p2_motion_<surface>_<interaction>_<f>.png`: glass before content on entry, content before glass on exit, no text scaling, no closed outline in any frame.
4. Reduce Motion and High Contrast through CDP `Emulation.setEmulatedMedia` inside a lab lock (never Steam's settings).
5. `python glass.py perf` while scripting the interaction: no frames > 34 ms, fps within 5 % of stock.
6. glassd: pinned `m`, `press`, `k` per shape and `glassd --once --dump` at m = 0, .15, .35, .6, 1.
7. Scene graph: `native/spike/sg_timeline.py` with a depth animation spec and hvgrab frames at fixed delays (look, then delete).

---

## 12. Layout and focus navigation (what T1 may change)

- **D-pad direction is read from computed CSS.** For every nav node without an explicit `flow-children`, Steam's `GetLayout()` infers row / column / grid from `getComputedStyle` at each key press (GP §0.5). A T1 reflow therefore changes the D-pad mapping consistently with what is drawn.
- **Never reorder focusable siblings with `order`**: inside a row or column the D-pad follows DOM order. Non-focusable siblings may move (GP C.1 moves the stats block with `order: 1`).
- **Nodes with explicit handlers keep their axis**: tab strips with `onMoveLeft/onMoveRight` stay horizontal (that is why game-page tabs are a segmented control, not a vertical ornament).
- **Never turn a row into a column or the reverse** where Steam declares `flow-children`; the D-pad would invert (SN, SM rules).
- **Virtualised lists** (library grid, Storage list) keep their JS-computed geometry: style rows, do not change row heights in CSS; larger posters need T3 props (LA LQ2). The **friends list is not virtualized** (measured, SM-D9), so its rows may change height in CSS [A7].
- **Settings drill-down** may hide a section in one view when it stays visible in exactly one other view and SET's T-CNT sums equal stock (exemption E-DRILL, PLAN §1.16; flag `settingsDrill`) [A7, SET §4.3].
- **New views (T3)** use Steam's `Focusable`, `DialogButton`, `ToggleField`, `GamepadPage`, `Menu` and `showContextMenu`; each has an `onCancel` and an error boundary, and lives under `/library/lgs/…` (SR §3.4, §7).
- **Verification:** `L.pad` traversal after `BTakeFocus(3)` / `FocusApplicationRoot()` (GP §0.4, SR §4): every target reachable; Down-Up and Left-Right return to the start; LB/RB still page; B closes or returns.

---

## 13. Accessibility

| Setting | Behaviour |
|---|---|
| Steam high contrast (`prefers-contrast: more`) | Glass near-opaque (#0b0d10 at .94), a 2 px solid white .70 edge is allowed (the only stroke), text pure white, no light spot |
| Steam reduced animations (`prefers-reduced-motion`) | §11.4 C8: bounce 0, movement → fades ≤ 200 ms, no blur ramps, no lift animation |
| Interface scaling | All sizes are CSS px/pt, so they scale with Steam's zoom; check the largest scale for overflow |
| Screen reader | Keep Steam's DOM order and roles; `aria-label` on every icon-only circle (T2) |
| Transparency | The glass intensity dial (`--lgs-dial`, `lgs dial V`) is the user's Reduce Transparency |
| Input parity | Every hover reveal has a gamepad path (§10.4) |
| Contrast | Body text ≥ 4.5:1 against the rendered glass (`audit` CONTRAST = 0) |

Never change Steam's accessibility settings to test them; emulate media features through CDP.

---

## 14. Implementation tiers: what each one delivers

| Tier | Delivers in this system | Status (capabilities) |
|---|---|---|
| T1 CSS incl. layout | Sizes, shapes, type, fills, edges, in-page Liquid Glass, ornament margin layouts, scroll edges, motion tokens | Layout changes allowed under §12 rules |
| T2 DOM augmentation | Light-spot coordinates, pressed class for gamepad A, selection pill, icon chips (`data-lgs-page`), `aria-label`s, decorative art variables | Allowed: adds only, never removes or moves Steam nodes |
| T3 Steam React views | Home / launcher routes, Control Center side tiles, search sheet, folder art, A–Z program grid, taller header sync | **[PROVEN]** routes, overrides, Steam components, focus (SR, 19/19 selftest); Phase 2 builds them on P2's framework (`contracts/react.md`) [A13] |
| T4 scene graph | Depth for ornaments, menus, sheets, focused cards; popup `z`/`scale`; window dim and recede; frame-height override; enlarged frame controls | Interactive crop registration, popups as ornaments, dim/recede, frame height, frame controls **[PROVEN]**; click on a moved crop, laser on transparent texels, cross-popup gamepad focus **[UNPROVEN]**, so the default profile uses non-interactive, click-safe crops only (§3.8) [A13] |
| T5 glassd | Real frost, lensing, specular, adaptive tint and contact shadows over the room; tinted slabs; materialize; morph | Surfaces, slabs, partial covers **[PROVEN-P1]**; GM v2 material (edges from shape and light, prism lensing, glass-over-glass) built; **plates (G1), hole treatment (G2), per-slab tint (G3) planned** (P9); systemui covers needed (SP §11.2, GP GQ6/GQ8) [A13] |

---

## 15. The mockup kit

`docs/phase2/mockups/kit.css` + `kit.js` render this system as static HTML at true size, so every redesign can be judged in a picture before any Steam code changes.

### 15.1 What it simulates

| Reality | Kit stand-in |
|---|---|
| The headset view | `.lgk-view`, 1920 × 1080 px, a CC0 room photo behind everything (`data-room="lounge"` or `"studio"`; `data-dim` for a dim evening room). At 1:1 the view spans ≈ 59° at 0.0307°/px, close to the framing of the reference shots |
| Steam's main window | `.lgk-overlay`, 1280 × 720 CSS px at 1:1: every DESIGN2 number types in unchanged |
| Other quads | `.lgk-pop` with `--pop-scale` = 1 / m from §2.5: frame menu 1.10, bar and its popups 1.20, SteamVR frame controls 0.75, SteamVR settings / Now Playing 0.69 |
| glassd glass (T5) | `.lgk-glass[data-mat=window|panel|liquid|thick|clear]`: `backdrop-filter` frost of the room + contrast and brightness that pull the room into the L 55–110 band. `kit.js` measures the room under each glass element from an embedded 96 × 54 luma grid and sets the brightness, standing in for glassd's adaptive tint |
| Lensing | `data-lens` on a glass element: `kit.js` builds an SVG displacement map (the bible's engine, with a wider lens band) and sets it as the element's `backdrop-filter` (Chromium only) |
| Edges | The §6.2 recipe exactly: conic specular arcs with side gaps, darkened inner edge, thickness shading, depth shadow (`--dz` in mm) |
| T1 fallback | `data-tier="t1"` on the view: window and panel glass lose the room frost (approximate: ornament glass outside the window still frosts the room in the kit) |
| Depth | Not stereo: shown through the §3.8 shadow; `#annot` in the URL labels every `[data-dz]` element with its depth and tier |
| States | Classes `is-hover` (with `--hx/--hy`), `is-focus`, `is-pressed`, `is-selected`, `is-nav-selected`, `is-disabled`, plus `is-nav-row` (hover = spot only) and `is-onfill` (coloured fill: focus = glow). Same values and compositing as the theme's `04-states.css`; `python docs/phase2/fontkit.py --parity` checks that every shared token is equal |

Not simulated: SteamVR's window curvature, the Frame's 19.6 ppd (judge legibility in an `hvgrab` frame, not in a mockup), stereo, motion.

### 15.2 Building a mockup

```html
<link rel="stylesheet" href="kit.css">
<div class="lgk-view" data-room="lounge">
  <div class="lgk-overlay" style="left:320px; top:66px">             <!-- Steam's 1280 x 720 overlay -->
    <div class="lgk-glass" data-mat="window" style="left:0; top:0; width:1280px; height:656px">
      <div class="t-large" style="position:absolute; left:40px; top:25px">Library</div>
      …fills, rows, posters (never another .lgk-glass inside)…
    </div>
    <div class="lgk-glass lgk-toolbar" data-mat="liquid" data-lens data-dz="0" style="left:192px; top:628px; width:896px">…</div>
  </div>
</div>
<script src="kit.js"></script>
```

- Glass elements are **siblings** in the functional layer, never nested, so each samples the room and the window (a `backdrop-filter` inside another one would only see its parent).
- Icons: `<i data-i="home"></i>`. Art: `<div class="lgk-art" data-art="poster:3:Game Name">` (also `hero`, `avatar`, `program`); all art is procedural, no third-party images or titles.
- Classes: `lgk-btn circle|capsule|plain|lg|xl|sm|primary|play`, `lgk-seg`, `lgk-search`, `lgk-tabbar`/`lgk-tab`, `lgk-toolbar`, `lgk-sidebar`, `lgk-row`, `lgk-platter`, `lgk-toggle on`, `lgk-slider` (`--v`), `lgk-menu`, `lgk-poster`, `lgk-home-icon`, `lgk-badge`, `lgk-glyph`, `lgk-dots`, `lgk-windowbar`, `lgk-tooltip`, `lgk-laser-dot`; type `t-xl1 … t-caption`, vibrancy `v1 v2 v3`. Kit tokens are named `--lg-*`; where §16 has a theme token with the same suffix (`--lgs-*`), the values are equal.
- Render: `python tools/mockshot.py docs/phase2/mockups/<name>.html shots/p2_<name>.png` (headless Chrome, 1920 × 1080). The kit sets `<html data-lgk-ready="1">` when its work is done, well inside the 3 s virtual-time budget.
- Assets and licences: `mockups/assets/LICENSE.md` (Poly Haven CC0 photos; the lounge view is a rectilinear reprojection of the "Lythwood Room" panorama).

### 15.3 The worked example

`_example.html` → `shots/p2_example.png` (variants: `p2_example_studio.png`, `p2_example_dim.png`, `p2_example_t1.png`, rendered before A1–A13). Re-rendered 2026-10-07 with the amendments. It shows:

- the Library window (`window` glass mode: 1280 × 656, radius 54) with the Back circle at (24, 24), a Large Title at x 100, a 520 px search capsule centred at x 640 with no microphone, an account circle at the concentric corner inset, a segmented control (white selected segment), 220 × 330 posters with an update chip and a download-progress capsule [A1];
- the tab-bar ornament (frame menu, 6 + 3 items, Library selected as the navigation pill with its arc, lensing at the bezel);
- the bottom ornament at y 628–712 straddling the glass by 28 px at depth 0: the Sort button white because its menu is open, a Filter capsule with a count, an `All · VR · Non-VR` segmented control; laser mode, so no controller glyph badges [A1, A3, A5];
- the Sort menu (thick glass at +10 mm, the default profile; five items: one column of 72 px rows under a 40 px header) grown upward out of its button, the current sort checked in the leading slot, the laser-hovered row lit at the hit point (hover look only: the laser never paints the focus look) [A3, A5, A6];
- SteamVR's frame controls (idle-dim), the dashboard bar as two liquid capsules (Steam button, running apps as circular art, +; clock, battery capsule, notification badge, Quick Access), and the grab pill under the bar.

---

## 16. Proposed tokens (for `theme/00-tokens.nowrap.css`, owned by Foundation)

Values replace the Phase 1 tokens of the same name; new names are added. Selectors and file ownership as in DESIGN.md §10.

**As built (P4, 2026-10-07).** The live tokens are `theme/00-tokens.nowrap.css`; `docs/phase2/contracts/tokens.md` is their contract. Differences from the proposal below: `--lgs-focus-add` is **.32** (A5); the Phase 2 material values live under new names `--lgs-mat-<m>-bg / -blur / -shade` (window, panel, liquid, liquid-room, thick, clear, plate), because Phase 1 files use `--lgs-glass-bg` and `--lgs-thick-bg` inside `linear-gradient()` and `background-color`, where a gradient value would be invalid and make glass transparent; `--lgs-glass-bg`, `--lgs-thick-bg`, `--lgs-glass-blur`, `--lgs-thick-blur` keep their Phase 1 values until the last area migrates (PLAN §6). Motion tokens live in P5's `theme/02-motion.nowrap.css`. New: the state numbers (`--lgs-hover`, `--lgs-focus`, `--lgs-within`, `--lgs-press`, `--lgs-lift`, `--lgs-dis`), the hook switches `--lgs-edge` and `--lgs-ill`, the PLAN §1.3 size tokens, the selection recipe and `--lgs-white-glow`.

```css
@property --lgs-hover { syntax: "<number>"; inherits: false; initial-value: 0; }
@property --lgs-press { syntax: "<number>"; inherits: false; initial-value: 0; }
@property --lgs-focus { syntax: "<number>"; inherits: false; initial-value: 0; }

html.lgs-on {
  /* type */
  --lgs-font: "LGS Inter", "Motiva Sans", Arial, sans-serif;
  --lgs-text-1: rgb(255 255 255 / .96);  --lgs-text-2: rgb(255 255 255 / .70);
  --lgs-text-3: rgb(255 255 255 / .50);  --lgs-text-disabled: rgb(255 255 255 / .32);
  --lgs-text-on-selected: #0d0e12;

  /* sizes (main-window px; 1 pt = 4/3 px) */
  --lgs-hit: 80px;  --lgs-btn: 60px;  --lgs-btn-lg: 70px;  --lgs-btn-xl: 86px;  --lgs-btn-sm: 44px;
  --lgs-row: 72px;  --lgs-row-gap: 8px;  --lgs-field: 64px;  --lgs-ornament: 84px;
  --lgs-ornament-overlap: 28px;  --lgs-header: 108px;
  --lgs-inset: 24px;  --lgs-inset-text: 40px;  --lgs-gap: 24px;

  /* radii (concentric) */
  --lgs-r-window: 54px;  --lgs-r-sheet: 44px;  --lgs-r-menu: 32px;  --lgs-r-platter: 30px;
  --lgs-r-row: 24px;  --lgs-r-card: 20px;  --lgs-r-small: 14px;  --lgs-r-capsule: 999px;

  /* colour */
  --lgs-blue: rgb(0 145 255);  --lgs-green: rgb(48 209 88);  --lgs-red: rgb(255 66 69);
  --lgs-orange: rgb(255 146 48);  --lgs-yellow: rgb(255 214 0);  --lgs-purple: rgb(219 52 242);
  --lgs-tint-play: rgb(48 209 88 / .88);  --lgs-tint-primary: rgb(0 145 255 / .86);
  --lgs-tint-danger: rgb(255 66 69 / .84);  --lgs-toggle-on: var(--lgs-green);

  /* fills on glass */
  --lgs-fill-thin: rgb(255 255 255 / .10);  --lgs-fill-nav: rgb(255 255 255 / .18);
  --lgs-hover-add: .08;  --lgs-focus-add: .14;
  --lgs-fill-regular: rgb(0 0 0 / .14);  --lgs-fill-thick: rgb(0 0 0 / .30);
  --lgs-well-shadow: inset 0 2px 5px rgb(0 0 0 / .26);
  --lgs-selected-fill: rgb(255 255 255 / .94);
  --lgs-scrim: rgb(0 0 0 / .35);
  --lgs-field-focus: 0 0 0 3px rgb(255 255 255 / .55), 0 0 16px rgb(255 255 255 / .22);

  /* edges (no closed rings: §6.2) */
  --lgs-light: 340deg;
  --lgs-rim-window: .78;  --lgs-rim-panel: .90;  --lgs-rim-liquid: 1.10;  --lgs-rim-thick: .85;
  --lgs-darkedge-window: inset 0 0 16px -2px rgb(0 0 0 / .20), inset 0 -2px 4px -1px rgb(0 0 0 / .12);
  --lgs-darkedge-panel:  inset 0 0 10px -2px rgb(0 0 0 / .16), inset 0 -2px 4px -1px rgb(0 0 0 / .12);
  --lgs-darkedge-liquid: inset 0 0 6px -1px rgb(0 0 0 / .12), inset 0 -2px 4px -1px rgb(0 0 0 / .12);
  --lgs-darkedge-thick:  inset 0 0 12px -2px rgb(0 0 0 / .20), inset 0 -2px 4px -1px rgb(0 0 0 / .12);
  --lgs-shadow-25mm: 0 10px 30px rgb(0 0 0 / .28);     /* ornaments */
  --lgs-shadow-30mm: 0 12px 36px rgb(0 0 0 / .32);     /* menus, alerts */
  --lgs-shadow-15mm: 0 6px 18px rgb(0 0 0 / .30);      /* primary, lifted card */

  /* CSS fallback glass (T1); glassd replaces the room-facing ones in T5 */
  --lgs-glass-blur: blur(12px) saturate(1.7);           /* liquid, over in-page content */
  --lgs-thick-blur: blur(30px) saturate(1.5);
  --lgs-glass-bg: linear-gradient(180deg, rgb(255 255 255 / .12), rgb(255 255 255 / .03) 55%), rgb(80 80 86 / .12);
  --lgs-thick-bg: linear-gradient(180deg, rgb(255 255 255 / .08), rgb(255 255 255 / 0) 35%), rgb(36 37 42 / calc(.30 + var(--lgs-dial) * .2));

  /* motion (MO §6.2) */
  --lgs-ease-b0:  linear(0, .005 1.2%, .020 2.3%, .084 5.2%, .159 7.7%, .461 16.9%, .556 20.2%, .639 23.5%, .709 26.9%, .767 30.2%, .817 33.7%, .861 37.6%, .900 42.1%, .930 46.9%, .954 52.4%, .971 58.6%, .991 73.8%, 1);
  --lgs-ease-b15: linear(0, .006 1.3%, .024 2.7%, .054 4.2%, .093 5.7%, .188 8.7%, .518 18.2%, .613 21.4%, .696 24.5%, .767 27.7%, .825 30.9%, .872 34.1%, .913 37.6%, .945 41.4%, .970 45.6%, .988 50.3%, 1.000 55.8%, 1.006 67.9%, 1);
  --lgs-ease-b20: linear(0, .006 1.3%, .025 2.8%, .056 4.3%, .099 6.0%, .199 9.2%, .536 18.9%, .633 22.0%, .717 25.2%, .785 28.2%, .844 31.4%, .894 34.7%, .933 38.1%, .964 41.7%, .987 45.7%, 1.003 50.3%, 1.012 55.3%, 1.015 64.8%, 1);
  --lgs-d-interactive: 210ms;  --lgs-d-hover-in: 294ms;  --lgs-d-fade: 441ms;  --lgs-d-snappy: 488ms;
  --lgs-d-morph-open: 607ms;  --lgs-d-morph-close: 441ms;  --lgs-d-sheet-in: 735ms;  --lgs-d-sheet-out: 514ms;
  --lgs-d-page: 662ms;  --lgs-d-mat-in: 250ms;  --lgs-d-mat-out: 350ms;
  --lgs-press-grow: 6;  --lgs-press-max: 1.06;
}

@media (prefers-reduced-motion: reduce) {
  html.lgs-on {
    --lgs-ease-b15: var(--lgs-ease-b0);  --lgs-ease-b20: var(--lgs-ease-b0);
    --lgs-press-grow: 0;  --lgs-d-mat-in: 180ms;  --lgs-d-mat-out: 180ms;
  }
}
@media (prefers-contrast: more) {
  html.lgs-on {
    --lgs-dial: 1;  --lgs-text-2: rgb(255 255 255 / .86);  --lgs-text-3: rgb(255 255 255 / .74);
    --lgs-glass-bg: rgb(11 13 16 / .94);  --lgs-thick-bg: rgb(11 13 16 / .96);
  }
}
```

Depths for `theme/layers.json` (scene units at r = 1; the daemon should convert from mm with the live S × r): ornaments 0.068, menus and alerts 0.081, sheets 0.136, primary capsule 0.041, focused card lift 0.041, Home icons 0.027 / 0.068.

---

## 17. Verification checklist (agents only)

**The gates are PLAN §4 [A11]:** the global gates (G-AUD, G-SIZE, G-TYPE, G-OUTLINE, G-FOCUS, G-MOTION, G-PAD, G-DEPTH, G-HV, G-REMOVE), the route matrix, the native gate and the conformance run of VP §6, measured with the lab commands of `docs/phase2/contracts/lab.md`. Where a row below disagrees with PLAN §4 (for example #5's focus threshold, now G-FOCUS's +40 L, or #7's depths, now the §3.8 default profile), PLAN §4 wins. The table stays as the design-level summary.

| # | Check | How |
|---|---|---|
| 1 | Targets | Every focusable rect ≥ 80 × 80 px, or centre ≥ 80 px from others with ≥ 21 px clear gap (≥ 72 px where the quad is fixed); `glass.py audit` SHRUNK/UNCLICKABLE = 0 |
| 2 | Text | No computed `font-size` < 18 px; body ≥ 22 px; CONTRAST = 0; no `text-transform: uppercase`, `font-style: italic` or `letter-spacing > 0` in chrome |
| 3 | No outlines | Glass containers: `border-width: 0`, `outline-style: none`, no 1 px `box-shadow` ring; edge pixel profiles in shots: a peak on the top edge, flat sides |
| 4 | Selection vocabulary | White fill only on toggled/selected buttons, segments and open-menu sources |
| 5 | Focus | With each element `.gpfocus`, its fill differs from rest by ≥ 0.06 luminance in a screenshot; nothing pulses (two shots 1.5 s apart identical) |
| 6 | Tabs | ≤ 6 items per tab-bar capsule |
| 7 | Depth | `__LGS_SG.dump()`: every `dz` matches §3.8 within 2 mm; each lift has its shadow; total ≤ 80 mm |
| 8 | Motion | §11.9 |
| 9 | Parity | Every hover-only reveal also appears under gamepad focus; every legend-only action has a visible button |
| 10 | Font | `document.fonts.check('500 24px "LGS Inter"')` true on every surface; CJK text renders; perf within 5 % |
| 11 | Glass tone | hvgrab frame (look, then delete): glass L 55–110 inside vs outside the window; room-texture sd reduced ≥ 80 % (T5) |
| 12 | Functions | `glass.py audit` GONE/HIDDEN = 0 per route; `L.pad` traversals of §12; launch paths logged, never executed |

---

## 18. Risks and open questions

| # | Risk | Mitigation |
|---|---|---|
| 1 | Inter at 1.5× Steam's sizes truncates and wraps Steam layouts | Audit every route; page or group content (§2.4); Callout 22 px for dense secondary text |
| 2 | `data:` fonts may be blocked by a CSP `font-src` in some Steam or SteamVR windows | Check per surface (§5.2 step 6); fall back to Steam's stack where blocked |
| 3 | +163 KB per injected window | Measure memory and parse time; drop `opsz` (−42 KB) first |
| 4 | The 108 px header needs both a CSS variable and a JS store write (SN CQ1) | Until proven, keep Steam's 40 px header height and centre the larger controls in a scroll-edge band |
| 5 | Hexagonal Home grids change geometric D-pad neighbours | Explicit neighbour maps (T3) or the square-lattice fallback |
| 6 | Sheet push-back (visionOS geometry) moves the window | Default to MO §4.8 (sheet comes forward); compare both in hvgrab before deciding |
| 7 | Interactive crops: click routing on moved crops is unproven without a wearer | Keep every crop at its original x/y; ornaments by the ornament margin |
| 8 | The tab bar (9 Steam destinations in one column) is taller than the window (748 vs 720 px in the example) | Accept the 14 px overhang per side, or shrink the frame-menu popup with its request `scale` to ≥ 72 px pitch in main px |
| 9 | Unpublished visionOS numbers (corner radius, type sizes, ornament depths) | Tagged [ours]; adjust from hvgrab review and, if ever available, Apple's visionOS design kit |
| 10 | Display density: mockups show more detail than the headset | Judge legibility only in hvgrab frames |
| 11 | Stereo depths are justified by disparity math, not perception tests | Shadow paired with every lift; cap 80 mm; review in hvgrab |
| 12 | Gamepad press events for the press glow are unverified | T2 listener; without it gamepad A shows focus only |

---

## Sources

Project documents: `docs/phase2/research/visionos.md`, `liquid-glass-motion.md`, `references.md`, `springs.py`; `docs/phase2/capabilities/spatial.md`, `steam-react.md`; `docs/phase2/audit/shell-nav.md`, `library-apps.md`, `game-pages.md`, `system.md`, `social-media.md`; `docs/DESIGN.md`, `docs/LAB.md`, `docs/NATIVE.md`, `native/glassd/README.md`, `theme/00-tokens.nowrap.css`, `theme/layers.json`, `device/lgs.py`, `device/lgs_vr.py`; the design bible `../bible/index.html` and `../.claude/skills/run-liquid-glass-frame/references/design-language.md`; the reference shots `docs/refs/visionos/1–12`.

External: Apple HIG and WWDC sessions as cited in the research files; Inter 4.1 (https://rsms.me/inter/, https://github.com/rsms/inter/releases/tag/v4.1, licence https://github.com/rsms/inter/blob/master/LICENSE.txt); Poly Haven CC0 licence (https://polyhaven.com/license), assets "Lythwood Room" (Greg Zaal) and "Photo Studio London Hall" (Sergej Majboroda).
