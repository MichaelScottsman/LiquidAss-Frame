# visionOS design research: a build spec for Glass Shell Phase 2

Compiled 2026-10-07 for the Phase 2 redesign of the Steam Frame UI. This is a practical spec, not an essay: every section ends in numbers you can type into CSS, `theme/layers.json` or glassd.

**What this file does not repeat.** The material behaviours (lensing, specular, adaptive shadow and tint, size-dependent thickness, illumination, materialize), the Regular/Clear/Tinted variants, the layer rule, concentric shapes, the spring vocabulary of the native showcase and the transparency dial are in `../bible/index.html` and `.claude/skills/run-liquid-glass-frame/references/design-language.md` (cited here as **DL §n**). Their sources are in `references/sources.md`. This file extends them with spatial layout, components, sizes, the visionOS app layouts and the Frame-specific conversions.

**Evidence tags**

| Tag | Meaning |
|---|---|
| **[official]** | Apple HIG page or WWDC session transcript (quoted or closely paraphrased) |
| **[press]** | Reviews and news coverage of visionOS 26/27 (MacStories, MacRumors, 9to5Mac) |
| **[measured]** | Measured by me from the 12 reference shots in `docs/refs/visionos/` (1.png … 12.webp), using a 44 pt circular button as the ruler. Expect ±20 % |
| **[community]** | Developer blogs, forum posts, code samples |
| **[ours]** | Derived for the Steam Frame in this project. A recommendation, not an Apple number |

---

## 0. The ten rules (read this if nothing else)

1. **Size in angles. Write visionOS point values in CSS `pt`.** On the Frame's main window, 1 CSS `pt` (= 4/3 CSS px) subtends 0.041°, and a visionOS point is 0.042°. So `height: 60pt` is the visionOS 60 pt target, 80 CSS px. (§1)
2. **The Steam window is a small visionOS window.** 1280 × 720 CSS px equals 960 × 540 pt, 56 % of the area of a default 1280 × 720 pt visionOS window. Show fewer, larger things; don't shrink visionOS sizes to keep Steam's density. (§1.4)
3. **Chrome lives outside the content.** The tab bar hangs off the leading edge, toolbars are ornaments that overlap the bottom edge by 20 pt, the window bar sits below the window. On the Frame, draw the glass window inset inside the transparent overlay so ornaments live in the margin and still receive input. (§3.3)
4. **Every control is a circle (icon only) or a capsule (text, or text + icon).** No square buttons, no sharp corners, no text "Back" or "Close" buttons. (§11)
5. **No outlines, no hairlines.** Glass edges read from a lit rim, a darkened inner edge, lensing and a shadow. Panes are separated by a change of material, not by a line. (§15)
6. **White text, colour only in whole fills.** White fill + black label means *toggled/selected button* and nothing else. Navigation selection (tab, sidebar row) is a lighter translucent pill. (§14)
7. **Hover = highlight.** The shape brightens and a soft light sits where the pointer is. It is instant. Anything that reveals more waits. No scale on toolbar buttons or list rows; only content cards lift. (§12)
8. **Depth carries hierarchy, a few centimetres at most.** Ornaments +2.5 cm, menus +3.5 cm, sheets stay put while the window pushes back. Never give text depth on its own. (§16)
9. **Motion is springs.** Glass materializes rather than fades, menus grow out of their button, nothing moves at rest, Reduce Motion removes elasticity. (§18)
10. **Text is bigger and heavier than Steam's.** Body 24 px Medium, titles Bold, nothing under 18 px. Inter replaces Motiva Sans for Latin text. (§13)

---

## 1. Units: from visionOS points to Steam CSS pixels

### 1.1 What a visionOS point is

- "visionOS defines a point as an angle, in contrast to other platforms, which define a point as a number of pixels" [official, [HIG Spatial layout][hig-spatial]].
- "60 points is roughly equal to an angular size of two and a half degrees, which is about 4.4 cm for an object one meter away" [official, [WWDC25 Design hover interactions][wwdc25-303]]. So **1 pt ≈ 0.0417°**.
- Windows use *dynamic scale*: they grow as they move away so targets keep the same angular size [official, [WWDC23 Design for spatial input][wwdc23-10073]].
- Caveat: the HIG also says a default 1280 × 720 pt window opens "about two meters" away with "an apparent width of about three meters" [official, [HIG Windows][hig-windows]]. That is about 74° wide, or 0.058°/pt, so a default window is *larger* than the 2.5° rule implies. Treat 0.0417°/pt as the floor that targeting rules are written against.

### 1.2 What a Steam CSS pixel is on the Frame

- The main gamepadui window is 1280 × 720 CSS px (texture 1920 × 1080 at DPR 1.5). It spans about 0.98 × 0.55 m at about 1.43 m (`docs/NATIVE.md` §4).
- **1 CSS px = 0.766 mm = 0.0307° at the window centre.** The whole window subtends **37.8° × 21.8°**.

### 1.3 The conversion

- Exact: 1 visionOS pt = 0.0417° / 0.0307° = **1.36 CSS px**.
- Working rule [ours]: **1 pt = 4/3 CSS px, which is exactly the CSS `pt` unit.** It gives 0.0409°/pt, within 2 % of visionOS. Writing `60pt` in CSS yields 80 px. If Steam's UI scale setting changes the page zoom, `pt` scales with it like `px`.

| visionOS value | pt | CSS px (`pt` × 4/3) | Angle on the Frame | Size at 1.43 m |
|---|---|---|---|---|
| Minimum hit region, minimum centre spacing | 60 | 80 | 2.45° | 61 mm |
| Regular button | 44 | 59 (use 60) | 1.80° | 45 mm |
| Large button | 52 | 69 (use 70) | 2.13° | 53 mm |
| Extra-large button | 64 | 85 (use 86) | 2.62° | 65 mm |
| Mini / small button | 28 / 32 | 37 / 43 | 1.15° / 1.31° | 29 / 33 mm |
| Margin around an interactive item | 16 | 21 (use 24) | 0.65° | 16 mm |
| Space between list or menu items (hover padding) | 4 | 5 (use 6) | 0.16° | 4 mm |
| Bottom ornament overlap | 20 | 27 (use 28) | 0.82° | 20 mm |
| Body text | 17 | 23 (use 24, see §1.5) | 0.70° | 17 mm |
| Minimum text | 12 | 16 (use 18, see §1.5) | 0.49° | 12 mm |

### 1.4 The window-size consequence

- Steam's main window is **960 × 540 pt** in visionOS terms. A default visionOS window is 1280 × 720 pt, so the Steam page has **56 % of its area**, and less than that if the "3 m at 2 m" figure is taken literally.
- Stock Steam packs a 1280 × 800 handheld layout into this window. Its controls are mostly 40–48 px (30–36 pt), half the visionOS target. The header is a 40 px strip with 16 px search text (`docs/inventory/shell.md` §3): 30 pt tall with 12 pt text, which is the visionOS *minimum* text size. That is why the user sees the search bar as "super small".
- **Design rule [ours]:** lay out every surface as if it were a compact visionOS window of 960 × 540 pt. Drop secondary items, move them behind a "More" control, or page them. Never scale visionOS numbers down to keep Steam's density.

### 1.5 Display density: why text and lines need extra care

- Steam Frame: 2160 × 2160 per eye over about 110° (Valve, conservatively quoted) [press, [Frame specs][frame-specs]]: **about 19.6 pixels per degree** on average (pancake lenses put somewhat more in the centre).
- Apple Vision Pro: **about 34 pixels per degree** [press, [IEEE Spectrum][ieee-avp]].
- So **1 CSS px ≈ 0.6–0.74 display pixels** on the Frame. Consequences [ours]:
  - **Text.** visionOS body text (17 pt, 0.71°) lands on about 24 display pixels per em on Vision Pro. The same angle on the Frame is about 14. Keep the visionOS angles as a floor and round up: body 24 px (0.74°), floor 18 px (0.55°, about 11 display pixels per em). Weights stay heavy (Medium body, Bold titles), which helps more than size.
  - **Lines.** A 1 CSS px line is 0.6 of a display pixel and will shimmer as the head moves. No 1 px hairlines anywhere. Any line that must exist is ≥ 2 CSS px and soft-edged. This is one more reason for rule 5.
  - **Glyph strokes** in icons ≥ 2 CSS px.

### 1.6 Depth: centimetres to stereo disparity

- Binocular disparity for an element moved Δz towards the viewer at distance D ≈ IPD × Δz / (D × (D − Δz)), with IPD ≈ 63 mm.
- At D = 1.43 m [ours, computed]:

| Δz | Disparity | Frame display px (19.6–24 ppd) | Vision Pro equivalent (2 m, 34 ppd) |
|---|---|---|---|
| 0.5 cm | 0.53′ | 0.17–0.21 | 0.15 |
| 1 cm | 1.07′ | 0.35–0.43 | 0.31 |
| 1.5 cm | 1.61′ | 0.52–0.64 | 0.46 |
| 2 cm | 2.15′ | 0.70–0.86 | 0.62 |
| 3 cm | 3.25′ | 1.06–1.30 | 0.93 |
| 4 cm | 4.36′ | 1.42–1.74 | 1.25 |
| 5 cm | 5.49′ | 1.79–2.19 | 1.57 |
| 8 cm | 8.98′ | 2.93–3.59 | 2.56 |

- **Reading:** a centimetre of depth at 1.43 m on the Frame produces about the same pixel disparity as a centimetre at 2 m on Vision Pro. Apple's "subtle depth" therefore translates one-to-one in centimetres. Below about 1 cm (≈ 0.35 px) stereo alone is barely perceptible; pair small lifts with a shadow and scale cue (§16).

---

## 2. What the twelve reference shots show

Each trait below is visible in the user's references and is backed by Apple guidance where noted.

| # | Trait | Refs | Rule for Glass Shell |
|---|---|---|---|
| 1 | Navigation hangs **outside** the window: a vertical capsule tab bar off the leading edge | 1, 5, 11 | Tab bar as an ornament, not a column inside the page (§5) |
| 2 | Controls for the window float **in front of its edges**: Safari's navigation capsule above the window, Music's playback capsule across the bottom edge | 7, 11 | Toolbars and search are ornaments (§4, §6, §9) |
| 3 | A **window bar pill below** every window; no title bars anywhere | 2, 4, 8, 12 | Restyle SteamVR's grab bar as the pill; no window title strip (§3) |
| 4 | **Panes are separated by tone, not lines.** The sidebar is a darker material running the full height; no divider | 2, 4, 8, 12 | Split views by material step (§7) |
| 5 | **Circles for icon buttons** (back, close, share, more, +) in the window's top corners, inset concentrically | 2, 5, 6, 8 | §8, §11 |
| 6 | **Capsules** for search, compose and prompt fields, text buttons and sliders | 2, 3, 4, 7 | §9, §11 |
| 7 | **Colour only in whole fills**: blue toggle circles, the blue sent bubble, red badges | 3, 4, 1 | §14 |
| 8 | **Navigation selection is a lighter pill**, not white (Settings "General", widget gallery "Weather", the selected tab circle) | 8, 12, 5, 11 | §5, §7 |
| 9 | **Large bold title** top-left of a sidebar ("Messages"); detail titles centred and bold ("Software Update") | 4, 8 | §8, §13 |
| 10 | **Content is full-bleed and opaque** (TV hero art, Music category tiles, photos) with concentric rounded corners; glass is never on the content | 2, 5, 11 | §10 |
| 11 | **Home and pickers have no window at all**: circular icons float in the room with shadows | 1, 9, 10 | §19 |
| 12 | **Glass edges show as light**: a bright rim along the top and corners, a darker band inside the bottom edge, and the background bending at the border. No stroke | 2, 3, 6, 8 | §15 |

---

## 3. Window anatomy

### 3.1 visionOS facts

- A window is "an upright plane that uses an unmodifiable background material called glass and includes a close button, window bar, and resize controls". It may add a Share button, tab bars, toolbars and ornaments [official, [HIG Windows][hig-windows]].
- "Retain the window's glass background." Opaque windows feel "constricting and heavy" [official, [HIG Windows][hig-windows]; [WWDC24 Design great visionOS apps][wwdc24-10086]].
- Choose a shape that suits the content (Keynote wide, Safari tall) and avoid empty areas. Prefer growing the window over covering content: Safari's window grows when its sidebar opens [official, [WWDC23 Principles of spatial design][wwdc23-10072]].
- Resize controls appear when people look at a window corner [official, [WWDC25-303][wwdc25-303]].
- Scroll indicator: small, fixed size, vertically centred on the trailing edge (horizontally centred on the bottom edge for horizontal scrolling) [official, [HIG Scroll views][hig-scroll]].
- **visionOS 27 curved windows**: Safari, Freeform and TV Multiview "arc around your position for more comfortable viewing at larger sizes" [press, [MacStories 27][macstories-27]]. There is no public API; Safari uses a private `PreferredWindowCurvature` Info.plist key [community, [Apple forums][forum-curved]].

### 3.2 Numbers

| Item | visionOS | Frame value [ours] | Notes |
|---|---|---|---|
| Window size | 1280 × 720 pt default [official] | 1280 × 720 CSS px page = 960 × 540 pt | Fixed by Steam/SteamVR; don't change settings |
| Corner radius | Unpublished. Estimates: 32 pt (Prototypr kit) [community], 46 pt (developer `glassBackgroundEffect` samples) [community], 35–46 pt from refs 2/6 [measured] | **54 px** (≈ 40 pt) | Chosen so a 60 px circular button inset 24 px is concentric: 30 + 24 = 54 |
| Content inset from the glass edge | Unpublished; top-corner buttons sit ≈ 16–24 pt in [measured] | 24 px minimum, 32 px for text columns | |
| Top-corner buttons | 44 pt circles: back or close top-left, actions top-right [measured, refs 2, 5, 6, 8] | 60 px circles at 24 px inset | Close and back always top-left [official, [WWDC23-10076][wwdc23-10076]] |
| Window bar | Pill ≈ 135 pt wide, ≈ 12 pt thick, ≈ 15–25 pt below the bottom edge [measured, refs 2, 8] | 180 × 16 px visible, **hit area ≥ 80 px tall**, 24 px below the glass | SteamVR's grab bar (systemui), `theme/vr/` |
| Curvature | Large windows only, centred on the viewer (visionOS 27) | Optional. For a cylinder centred on the head, OpenVR curvature = width ÷ (2π r) = 0.98 ÷ (2π × 1.43) ≈ 0.11 [[openvr.h][openvr-h]] | SteamVR's scene graph already applies a panel curvature to the dashboard (`NATIVE.md` §4); describe, don't set |
| Scroll indicator | Small fixed capsule, trailing edge, centred | 6 × 48 px capsule, white 0.5, only while scrolling | Only if a tier can draw it; Steam hides scrollbars in gamepadui |

### 3.3 The ornament margin: how chrome can sit "outside" a Steam window [ours]

The Frame's Steam window is one overlay quad with per-pixel alpha (`docs/DESIGN.md` §1). Anything drawn outside Steam's own panel can't receive input, and a T4 crop moved away from its original x/y gets no input (input lands on Steam's real panel underneath). So:

- **Draw the glass window smaller than the overlay.** Leave the margins transparent. Put the tab bar in the left margin and let the toolbar ornament straddle the bottom edge of the glass. Both are still DOM inside Steam's page, so the laser and gamepad focus work unchanged.
- Then give the margin elements stereo depth with T4 crops *at the same x/y* (+2.5 cm, §16).

```
 overlay 1280 x 720 CSS px  (transparent outside the glass)
 +--------------------------------------------------------------+
 |        +---------------------------------------------------+ |
 |  +--+  |  glass window, radius 54 px                       | |
 |  |()|  |                                                   | |
 |  |()|  |                                                   | |
 |  |()|  |  content                                          | |
 |  +--+  |                                                   | |
 |  tab   |          +-----------------------------+          | |
 |  bar   +----------|  toolbar ornament (overlap) |----------+ |
 |                   +-----------------------------+            |
 +--------------------------------------------------------------+
```

| Margin | Size [ours] | Derivation |
|---|---|---|
| Left (tab bar) | 100 px: 84 px bar + 16 px gap | §5 |
| Bottom (toolbar ornament) | 56 px below the glass, only on routes that have a bottom ornament | 84 px ornament overlapping the glass by 28 px (20 pt) |
| Top (Safari-style ornament) | 84 px + 12 px gap, only if search or navigation moves above the window | §9 |

The cost is content area (the glass becomes about 1180 × 663 px on a route with both). That trade is the visionOS one: "use tab bars and toolbars to push outside the window… provide more room for the content" [official, [WWDC23-10072][wwdc23-10072]].

---

## 4. Ornaments (general rules)

- An ornament "floats in a plane that's parallel to its associated window and slightly in front of it along the z-axis". It moves with the window and does not scroll with its content [official, [HIG Ornaments][hig-ornaments]].
- Ornaments can sit on any edge. Toolbars, tab bars and video playback controls are system ornaments [official].
- At the bottom edge, **overlap the window by 20 pt** so the ornament feels attached without hiding much content; it pulls colour from content scrolling under it [official, [WWDC23-10076][wwdc23-10076]].
- Keep the width ≤ the window's, or it collides with the tab bar. Use few ornaments; if one goes, move its controls into the window [official].
- Use **borderless buttons** inside an ornament; the system still hovers them [official].
- Keep ornaments visible. Hide them only while people dive into a single piece of content (watching video, viewing a photo) [official].
- Ornaments are for controls, not supplemental content; supplemental content goes in a separate window or a split view [official, [HIG Layout][hig-layout], [HIG Split views][hig-split]].
- Don't put an extra ornament on the same edge as a toolbar or tab bar; prefer at most one extra [official, [HIG Windows][hig-windows] (volumes)].

| Ornament property | Frame value [ours] |
|---|---|
| Depth | +2.5 cm (≈ 0.9–1.1 display px disparity) |
| Height (horizontal ornament) | 84 px: 60 px buttons + 12 px padding |
| Shape | Capsule, radius = height ÷ 2 |
| Button spacing | Centres ≥ 80 px apart (60 px buttons + 20 px gap) |
| Material | Glass, thinner than the window (DL §1 P5): `liquid` slab in glassd, regular Liquid Glass recipe in CSS |
| Shadow onto the window | y-offset 10 px, blur 30 px, black 0.28 (§16.3) |

---

## 5. Tab bar

**visionOS facts [official]**

- Always vertical, "floating in a position that's fixed relative to the window's leading side" [[HIG Tab bars][hig-tabbars]].
- Symbols are always visible. Looking at the bar expands it to reveal labels, and "while a tab bar is expanded, it can temporarily obscure the content behind it" [[HIG Tab bars][hig-tabbars]].
- An individual tab highlights *before* the bar expands, so people can pick it quickly [[HIG Eyes][hig-eyes]]. The expansion uses a **short delay** [[HIG Eyes][hig-eyes]]. It collapses when people look away [[WWDC23-10076][wwdc23-10076]].
- At most **six** tabs. Labels are single words. Never hide or disable tabs. Badges only for critical information [[WWDC23-10076][wwdc23-10076], [HIG Tab bars][hig-tabbars]].
- A sidebar may live inside a tab for deeper hierarchy, but sidebar selections must not switch tabs [[HIG Tab bars][hig-tabbars]].
- Tab bars are for navigation, never for actions; actions go in a toolbar [[HIG Tab bars][hig-tabbars]].

**Observed [measured, refs 1, 5, 11]**

- A single capsule, vertically centred on the window's leading edge, with a visible gap to the window.
- The selected tab shows a lighter circular platter behind its symbol, not a white fill.
- The Home view uses the same pattern with three tabs (Apps, People, Environments) [official, [Apple Support][support-overview]].

**Frame spec [ours]**

| Property | Value |
|---|---|
| Item | 60 px circular platter, symbol 28 px, centres 80 px apart |
| Bar | Capsule, 84 px wide collapsed (60 + 2 × 12 padding), height = n × 80 + 24 px (≤ 504 px for six) |
| Placement | In the left ornament margin (§3.3), centred vertically on the glass, 16 px gap |
| Depth | +2.5 cm |
| Expanded | Width animates to about 260–280 px (symbol + 16 px + Headline label 24 px Semibold). Overlays content; never pushes it |
| Expand trigger | Laser: hover on the bar for 0.4 s. Gamepad: immediately when focus enters the bar (an explicit, deliberate move) |
| Collapse | 0.3 s after the pointer or focus leaves |
| Animation | Width on the smooth spring (§18), labels fade in staggered by 30 ms |
| Selected tab | Platter white 0.18, symbol and label primary white. Hover/focus on top: +0.08 brighter and the light spot (§12) |
| Steam mapping | Steam's VR main menu (`DashboardMenu`) already collapses to 54 px and expands on laser hover or focus (`docs/inventory/shell.md`). Grow it to these sizes and float it in the margin. More than six destinations: keep five or six top-level, group the rest |

---

## 6. Toolbars and bottom ornaments

**visionOS facts [official, [HIG Toolbars][hig-toolbars]]**

- The system toolbar sits "along the bottom edge of a window, above the window-management controls, and in a parallel plane that's slightly in front of the window". A variable blur keeps items legible while the glass stays "uniform and undivided".
- Items are a symbol *or* a text label. Looking at a symbol reveals its label as a tooltip.
- **No vertical toolbars** (tab bars are vertical). Keep the window from shrinking below the toolbar's width; visionOS has no menu bar, so the toolbar must hold the essentials.
- **Avoid pull-down menus in a toolbar**: at the bottom edge they would cover the window controls below.
- Use the standard Back and Close symbols, never the words "Back" or "Close". Prefer symbols without borders (no outlined-circle symbols).
- One **prominent** (tinted) primary action, on the trailing side.
- Titles under 15 characters; never the app name.
- Modal states may swap in their own toolbar, then restore the standard one.

**Patterns in the references**

| Pattern | Where | Shape |
|---|---|---|
| Bottom segmented ornament (Years / Months / All) | Photos [official, [WWDC23-10076][wwdc23-10076]] | Capsule with a segmented control |
| Playback ornament across the bottom edge | Music (ref 11) [official] | Capsule: transport circles, artwork + title, More; separate circles for lyrics, queue, volume |
| Navigation ornament above the window | Safari (ref 7) [measured] | Circles (sidebar, back, forward), an address capsule with mic and reload, circles (share, +, more) |
| In-window top toolbar | Image Playground (ref 2), TV (ref 5) | Thin-material circles in the top corners of the content pane |

**Frame spec [ours]**

- Bottom ornament: §4 numbers, overlapping the glass by 28 px, centred, width ≤ 70 % of the glass.
- Keep ≥ 24 px clearance above SteamVR's grab bar and frame controls, which sit below the window. Never open a menu downward from a bottom ornament; open it upward or centred (§17).
- Candidates: the game page's Play bar (Play as the one tinted capsule, §11), media playback, the footer legend (A/B/X/Y hints as small glyph + label capsules).

---

## 7. Sidebars and split views

**visionOS facts [official]**

- The sidebar is on the leading side, for top-level collections; show no more than two levels [[HIG Sidebars][hig-sidebars]].
- "In visionOS, a window typically expands to accommodate a sidebar, so people rarely need to hide it." Don't hide it by default [[HIG Sidebars][hig-sidebars]].
- Prefer a split view to a new window for supplementary information; persistently highlight the current selection in each pane [[HIG Split views][hig-split]].
- Material: "The regular material can help you visually separate sections of your app, like a sidebar or a grouped table view" [[HIG Materials][hig-materials]]. WWDC23: use a darker material for a sidebar, a lighter one for interactive elements, a darker one for input fields, and don't stack lighter materials [[WWDC23-10076][wwdc23-10076]].
- Search sits at the top of a sidebar when it filters the sidebar (Settings) [[HIG Search fields][hig-search]].

**Observed [measured, refs 2, 4, 8, 12]**

- The sidebar is about 30–33 % of the window width (≈ 320 pt in refs 2 and 8) and runs the full height.
- The boundary is only a change of tone: no line.
- The selected row is a **capsule pill** of lighter fill inset about 8–12 pt from the sidebar edges.
- Settings rows: a 28–30 pt coloured circle with a white glyph, then the label; trailing value text in secondary vibrancy. Row pitch ≈ 52–60 pt.
- Messages: a Large Title ("Messages") top-left, a circular filter button and an "Edit" capsule top-right, then a search capsule with a mic.

**Frame spec [ours]**

| Property | Value |
|---|---|
| Width | 30 % of the glass width (≈ 340–380 px) |
| Material | One step darker than the window glass: black 0.14 fill over the window glass (DL §3 fills), no blur of its own (no glass on glass) |
| Rows | 72 px tall, 8 px apart (80 px pitch), label Body 24 px Medium |
| Row icon | 40 px circle (30 pt), colour fill + white glyph, for Settings-like lists only |
| Selected row | Capsule pill, white 0.16; text primary. Not white-filled |
| Focus / hover on a row | Pill white 0.24 + the light spot. No scale, no lift (high-use view) |
| Header | Title 1 38 px Bold, 32 px from the top; search capsule (§9) below it |

---

## 8. Back buttons, titles and close buttons

- Back: the standard circular button with the back symbol only [official, [HIG Toolbars][hig-toolbars]]. On a long look it grows into a capsule that shows the previous page's title ("back buttons grow to show the title of the previous page") [official, [WWDC25-303][wwdc25-303], [WWDC24 custom hover effects][wwdc24-10152]].
- Close: top-left, always, for sheets and pushed modal views; a pushed view inside a sheet shows Back instead of Close [official, [WWDC23-10076][wwdc23-10076]].
- Titles: no title bar. A detail pane's title is centred at the top in a bold Headline/Title 3 (Settings, ref 8) [measured]; a sidebar's title is a left-aligned Large Title (Messages, ref 4) [measured].

**Frame spec [ours]:** back is a 60 px circle at the 24 px inset. After 0.6 s of laser hover, or 0.6 s of gamepad focus, it expands to a capsule with the previous title (Subheadline 20 px Medium, max 240 px). The B button keeps working as before. The circle stays at the same place while the capsule grows rightwards (the anchoring element, §12).

---

## 9. Search fields

**Where search lives on Apple platforms [official, [HIG Search fields][hig-search]]** (visionOS has "no additional considerations", so the iPadOS/macOS patterns apply):

1. **As a tab or a sidebar item** when search is a destination for discovery (Music, TV). The page shows suggestions and categories. Focus the field on arrival, *except* when only a virtual keyboard is available, because the keyboard would cover the view.
2. **At the top of the sidebar** when it filters the sidebar (Settings).
3. **On the trailing side of the toolbar** for searching across split-view columns.
4. **Inline above the list it filters** (Music's library filter).

Other rules: start searching as people type; offer recent and suggested searches; use scope bars or tokens to narrow. Looking at the field's mic glyph starts **Speak to Search** [official, [WWDC23-10073][wwdc23-10073]]. Input fields use a darker material for contrast [official, [WWDC23-10076][wwdc23-10076]].

**Shape [community + measured]**

- A capsule about 44 pt tall (corner radius 22 pt), at most min(500 pt, half the window width), front and centre at the top of Music, Safari and TV; TV, Photos and App Store use a rounded-rectangle variant [community, [Christian Selig][selig-search]].
- Magnifier glyph leading, mic trailing, placeholder in secondary vibrancy [measured, refs 4, 8, 12].

**Frame spec [ours]**

| Property | Value |
|---|---|
| Height | 64 px (48 pt), capsule. Never below 60 px |
| Width | min(640 px, 50 % of the glass) when free-standing; full sidebar width minus 2 × 16 px in a sidebar |
| Placement | Library and Store: top centre of the glass, or a Safari-style ornament above the window at +2.5 cm. Global search: also a **Search** tab in the tab bar leading to Steam's `/search` route |
| Fill | Thick (darker) well: black 0.30 + `inset 0 2px 4px rgba(0,0,0,.25)`; no border |
| Text | Body 24 px Medium; placeholder white 0.55 |
| Glyphs | Magnifier 24 px at 20 px inset; clear and mic buttons are 44 px circles inside the field with 80 px-wide hit areas |
| Focus | The one place a ring is right: 3 px soft ring, white 0.55 ("use a focus ring for a text or search field") [official, [HIG Focus][hig-focus]] |
| Keyboard | Don't open the Steam keyboard automatically when arriving on the Search tab; open it on activation |

---

## 10. Lists, grouped rows and collections

- Leave **4 pt between list or menu items** so hover effects don't overlap [official, [WWDC23-10076][wwdc23-10076]].
- A lock-up (image + label acting as one control) needs one containing shape that highlights as a whole [official, [HIG Eyes][hig-eyes]].
- Content is not glass: tables, cards and art stay in the content layer [official, [WWDC25 Meet Liquid Glass][wwdc25-219]]; grouped tables use the regular material on visionOS [official, [HIG Materials][hig-materials]].
- In lists and collections, focus is shown as a **highlight of the whole row**, not a ring [official, [HIG Focus][hig-focus]].
- Look to Scroll suits reading and browsing views (TV rows, a game grid) but not settings or dense control lists [official, [HIG Scroll views][hig-scroll], [WWDC25-303][wwdc25-303]].
- Observed: grouped rows sit on a rounded platter (≈ 24 pt radius) with faint separators inset from the leading edge (ref 8) or no separators at all (ref 3); a trailing value in secondary text plus a chevron [measured].

**Frame spec [ours]**

| Element | Value |
|---|---|
| Grouped platter | Black 0.14 fill on the window glass, radius 30 px (54 − 24 inset), 24 px from the glass edge |
| Row | 80 px tall inside a platter (contiguous rows); the hover/focus pill is inset 6 px, radius 24 px |
| Separators | Prefer none. If needed: 2 px, white 0.08, inset 72 px from the leading edge, never full-bleed |
| Free-standing list rows | 72 px + 8 px gap |
| Content grids (game art) | ≥ 24 px gaps; art radius concentric with the platter (16–20 px); hover/focus = lift (§12) |

---

## 11. Buttons

**visionOS facts [official, [HIG Buttons][hig-buttons]]**

| Shape | Mini 28 | Small 32 | Regular 44 | Large 52 | XL 64 |
|---|---|---|---|---|---|
| Circle (icon only) | yes | yes | yes | yes | yes |
| Capsule (text only) | | yes | yes | yes | |
| Capsule (text + icon) | | | yes | yes | |
| Rounded rectangle | | yes | yes | yes | |

- Icon-only → circle; text-only → rounded rectangle or capsule; icon + text → capsule. Prefer circles and capsules: "the more rounded a button's shape, the easier it is for people to look steadily at it". A button on its own → capsule.
- Background: thin material when the button sits on glass; glass when it floats in space. Buttons inside toolbars, context menus, alerts and ornaments can be borderless.
- States: idle, hover, **selected (white fill, black label: reserved)**, unavailable. Icon buttons show a tooltip after a look; text buttons don't need one.
- Centres ≥ 60 pt apart; buttons ≥ 60 pt get 4 pt of padding so hover effects don't touch; no small or mini buttons in rows or stacks.
- In a vertical stack use rounded rectangles; in a horizontal row use capsules. Stacked buttons ≥ 16 pt apart [official, [WWDC23-10076][wwdc23-10076]].
- visionOS buttons play sounds because Vision Pro has no haptics. The Frame controllers have haptics (DL §6).
- "Keep the shapes flat and avoid thick outlines or effects that call attention to the edges" [official, [WWDC23-10073][wwdc23-10073]].

**Frame sizes [ours]**

| Use | Visible size | Notes |
|---|---|---|
| Default icon button | 60 px circle | Symbol 26–28 px |
| Default text button | 60 px capsule, 24 px side padding | Label Headline 24 px Semibold |
| Primary action (Play, Install, Confirm) | 70 px capsule, tinted fill | One per screen; colour in the fill, white label |
| Hero call to action | 86 px capsule | Editorial pages only |
| Mini (disclosure in a section header) | 38 px circle | Only alone, with an 80 px clear hit region |
| Disabled | Content at 40 % opacity, no hover | |

Steam's DialogButtons and small bar buttons (40–48 px) grow by 25–50 %. Check every layout for overflow with `glass.py audit` (SHRUNK, UNCLICKABLE).

---

## 12. Hover and focus

**How visionOS hover works [official]**

- The system draws hover out of the app's process; apps never learn where people look [[HIG Eyes][hig-eyes]].
- The standard **highlight** is "a subtle visual brightening" of the element's shape [[WWDC23-10076][wwdc23-10076]] that "shows a light source indicating position" [[SwiftUI HoverEffect.highlight][swiftui-highlight]]. It must "work on top of any content" without being prominent [[WWDC23-10073][wwdc23-10073]].
- **Lift** scales the view up and adds a shadow [[SwiftUI HoverEffect.lift][swiftui-lift]]. Don't scale high-use views such as toolbar buttons and table cells, because it moves what people are trying to look at [[WWDC25-303][wwdc25-303]].
- Custom effects come in three timings: **instant** (subtle, invites interaction: a slider knob appears), **delayed** (reveals more: tooltips, Safari's profile button), **ramp** (a hint at once, then a pop after continued attention: Home view environment icons scale slowly, then open) [[WWDC25-303][wwdc25-303]]. "Nearly all effects benefit from even a short delay", which avoids flicker as the eyes wander; Apple's sample delays a reveal by 0.8 s in and 0.2 s out [[WWDC24-10152][wwdc24-10152]].
- Keep an anchoring element unchanged (the icon stays put, the title doesn't shift). Start every effect from something visible. Keep effects small. On imagery, highlight and then fade so true colours return. Avoid unexpected motion: Safari's lesson is to fade a tab's close button to 50 % on looking at the tab and to 100 % only on looking at the button [[WWDC25-303][wwdc25-303]].
- Hover only on interactive elements; data that is only read gets none (Carrot Weather) [[WWDC24-10086][wwdc24-10086]]. Unavailable items stop giving hover feedback [[WWDC23-10076][wwdc23-10076]].
- Controls that auto-hide stay visible while looked at ("persistent controls") [[WWDC25-303][wwdc25-303]].
- **Focus** (keyboard or game controller) is a separate system from hover on visionOS [[HIG Eyes][hig-eyes], [HIG Focus][hig-focus]]: a ring for text and search fields, a highlight for list and collection items; on tvOS the highlight becomes a projection with a specular highlight and parallax [[SwiftUI HoverEffect.highlight][swiftui-highlight]].

**Frame spec [ours]:** the laser plays the role of the eyes; gamepad focus (`.gpfocus`) plays the role of the controller focus system. Both must show a state on every focusable element.

| State | Laser hover | Gamepad focus |
|---|---|---|
| Fill | Rest fill + white 0.08, in 120 ms, out 250 ms | Same, held |
| Light spot | Radial gradient, radius ≈ 0.6 × element height, white 0.14, centred on the laser hit point (T2 `pointermove` → `--lgs-mx/--lgs-my`). Appears at once | Static, centred in the upper third (no motion without input) |
| Content cards (game art, store tiles) | Lift: `scale: 1.05`, +1.5 cm (T4), shadow deepens | Same |
| Rows, toolbar buttons, tabs | No scale, no lift | Same |
| Text and search fields | Fill only | Fill + 3 px soft ring, white 0.55 |
| Pressed | `scale: .97` + a brighter centre glow (DL §1 P6), released on the press spring | Same on A |
| Toggled / selected | White fill, black label | Same; focus adds the light spot on top |
| Tooltip | After 0.8 s of hover; out after 0.2 s; below the button | After 0.8 s of focus |
| Reveal-more effects (back title, tab labels, card details) | Delayed 0.4–0.8 s, or ramp (start a 2 % scale at once, pop at 0.8 s) | Tab bar: immediate on entry. Others: same delays |

Hover is never the only way to reach something: everything revealed on hover must also be reachable with gamepad focus [official, "always give people multiple ways to interact", [HIG Eyes][hig-eyes]].

---

## 13. Typography

**visionOS facts [official]**

- SF Pro. Body text is **Medium** instead of Regular; titles are **Bold** instead of Semibold; tracking is slightly increased [[WWDC23-10076][wwdc23-10076]].
- Two visionOS-only styles, **Extra Large Title 1 and 2**, for wide editorial layouts [[HIG Typography][hig-typography]].
- Default size 17 pt, minimum 12 pt [[HIG Typography][hig-typography]]. Avoid Ultralight, Thin and Light weights.
- Text is white by default. Text that is not on a background gets a bold weight, not a shadow. Prefer 2D text; keep interface text flat [[HIG Typography][hig-typography], [WWDC23-10072][wwdc23-10072]].
- Hierarchy comes from vibrancy (label, secondaryLabel, tertiaryLabel) more than from grey values [[HIG Materials][hig-materials]].
- **visionOS point sizes per style are not published in the HIG.** The styles share their semantic names with iOS and were "tuned on our point-based unit system" [[WWDC23-10076][wwdc23-10076]]. The iOS Large (default) sizes are the closest published baseline; the visionOS kit in [Apple Design Resources](https://developer.apple.com/design/resources/) is the authority if someone can open it.

**Frame type scale [ours]** (iOS baseline × 4/3, rounded up for the Frame's lower pixel density; weights per visionOS)

| Style | iOS default (pt / leading) | Frame size | Weight | Line height | Tracking (Inter) | Typical use |
|---|---|---|---|---|---|---|
| Extra Large Title 1 | visionOS only, unpublished | 64 px | 700 | 1.10 | −0.02 em | Game hero title on the details page |
| Extra Large Title 2 | visionOS only, unpublished | 52 px | 700 | 1.10 | −0.02 em | Store and library section heroes |
| Large Title | 34 / 41 | 46 px | 700 | 1.18 | −0.015 em | Sidebar or page title |
| Title 1 | 28 / 34 | 38 px | 700 | 1.20 | −0.015 em | Page titles in detail panes |
| Title 2 | 22 / 28 | 30 px | 700 | 1.25 | −0.01 em | Section headers |
| Title 3 | 20 / 25 | 28 px | 600 | 1.25 | −0.01 em | Centred detail title, card titles |
| Headline | 17 / 22 | 24 px | 600 | 1.30 | −0.005 em | Button labels, row titles |
| Body | 17 / 22 | 24 px | 500 | 1.30 | −0.005 em | Default text |
| Callout | 16 / 21 | 22 px | 500 | 1.30 | 0 | Descriptions |
| Subheadline | 15 / 20 | 20 px | 500 | 1.30 | 0 | Secondary row text, Home labels |
| Footnote | 13 / 18 | 18 px | 500 | 1.35 | +0.005 em | Metadata |
| Caption 1 and 2 | 12 / 16, 11 / 13 | **18 px floor** | 600 | 1.35 | +0.01 em | Badges, legends. Nothing on the Frame is smaller |

Section headers are title case, not all caps (Liquid Glass, DL §8). The footer legend's 12 px bold uppercase labels go to 18 px Semibold title case.

**Font choice: Inter 4.1** ([rsms.me/inter][inter])

- License: SIL Open Font License 1.1, "Copyright (c) 2016 The Inter Project Authors". The copyright line declares **no Reserved Font Name**, so subsetting and embedding are fine [[LICENSE.txt][inter-license]].
- Verified with fontTools on `InterVariable.woff2` (352,240 bytes, 2,937 glyphs): axes **`wght` 100–900** and **`opsz` 14–32**. Optical sizing selects the Display cut for large titles automatically with `font-optical-sizing: auto`.
- Features worth using: `tnum` (clock, battery, download progress, prices), `case` (punctuation around capitals in legends). `calt` is on by default. Leave the `cv`/`ss` alternates off: the defaults are the closest to SF Pro.
- Why not SF Pro: Apple licenses the SF fonts for building UI for Apple platforms only ([Apple Fonts](https://developer.apple.com/fonts/)). Geist (OFL) is an acceptable second choice; Inter is closer to SF's proportions and has the optical-size axis.
- Delivery: base64 `@font-face` inside the injected CSS (in memory, gone on Steam restart, like the rest of the theme). Subset to Latin, Latin Extended, Greek and Cyrillic with `pyftsubset` (expect roughly 120–160 KB as WOFF2). Put Steam's own families after Inter in `font-family` so CJK and other scripts keep rendering with Motiva Sans and its fallbacks.
- Rendering: `font-synthesis: none; -webkit-font-smoothing: antialiased;`.
- Risk: Inter sets wider and with a taller x-height than Motiva Sans, and the scale above is about 1.5× Steam's sizes. Expect truncation and wrapping; audit every route.

---

## 14. Colour and vibrancy

- Use colour sparingly, especially on glass; prefer it in bold text and large areas; most of the time use white text and symbols; put colour in a background layer or a whole button [official, [HIG Color][hig-color], [WWDC23-10076][wwdc23-10076]].
- **visionOS system colours use the dark-appearance values** [official, [HIG Color][hig-color]]:

| Colour | Default (dark) | Increased contrast (dark) | Use on the Frame |
|---|---|---|---|
| Blue | rgb(0, 145, 255) | rgb(92, 184, 255) | Toggle-on circles, primary confirm, own chat bubble |
| Green | rgb(48, 209, 88) | rgb(74, 217, 104) | Switch track on; Steam's Play keeps its brand green in the fill |
| Red | rgb(255, 66, 69) | rgb(255, 97, 101) | Badges, destructive |
| Orange | rgb(255, 146, 48) | rgb(255, 160, 86) | Warnings, battery low |
| Yellow | rgb(255, 214, 0) | rgb(254, 223, 67) | Favourites |
| Teal / Cyan / Indigo / Purple / Pink | (0,210,224) / (60,211,254) / (109,124,255) / (219,52,242) / (255,55,95) | (59,221,236) / (109,217,255) / (167,170,255) / (234,141,255) / (255,138,196) | Rare accents |

- Liquid Glass: "To emphasize primary actions, apply color to the background rather than to symbols or text", and never colour the backgrounds of several controls [official, [HIG Color][hig-color]].
- Selection vocabulary [measured + official]:
  - **White fill + black label** = toggled or selected *button* state: a segmented control's selected segment, an active toolbar toggle, and the button whose menu or popover is open [official, [WWDC23-10076][wwdc23-10076]].
  - **Lighter translucent pill** = the current navigation location: tab, sidebar row, list selection [measured, refs 5, 8, 11, 12].
- Colour in passthrough: the room shows through the glass and shifts colours, so colourful labels on glass fail first [official]. Mono passthrough removes room colour entirely; the Arcturus colour camera brings it back. Test both.

---

## 15. Materials and edges without outlines

The user's requirement: menus and panels must not have clear outlines; the outline must come from the glass itself.

**What Apple says [official]**

- Window glass uses "specular reflections and shadows to communicate the window's scale and position" [[HIG Windows][hig-windows]].
- "Keep the shapes flat and avoid thick outlines or effects that call attention to the edges" [[WWDC23-10073][wwdc23-10073]].
- "We've all added extra backgrounds or borders to give buttons the right weight. Instead of relying on decoration, hierarchy should be expressed through layout and grouping" [[WWDC25 Get to know the new design system][wwdc25-356]].
- Lensing: "the warping and bending of light of a transparent object communicates to us its presence, its motion, and form". Light sources "producing highlights that respond to geometry"; on interaction "light… travel[s] around the material, defining its silhouette". Shadows make "elements feel grounded and defined", and their opacity rises over text [[WWDC25-219][wwdc25-219]].
- visionOS materials on glass [[HIG Materials][hig-materials]]: **thin** (lighter) brings attention to interactive elements and selected items; **regular** separates sections (sidebar, grouped table); **thick** makes a dark element that stays distinct on top of regular (input fields). Don't stack lighter materials [[WWDC23-10076][wwdc23-10076]].
- Increase Contrast is the one setting that adds "a contrasting border" [[WWDC25-219][wwdc25-219]].

**Edge recipe, in order of importance [ours]**

| # | Cue | Why it works without a line | CSS (T1) | glassd (T5) |
|---|---|---|---|---|
| 1 | **Specular rim**, lit from one direction: brightest along the top edge and the top corners, fading down the sides, a weak counter-highlight along the bottom | Additive light reads against dark rooms | Gradient ring cut out with a mask (the bible's `.glass::before` recipe). On the Frame: ring 2–3 CSS px (≥ 1.2 display px), top 0.55–0.70, sides → 0.08, bottom 0.20–0.30 | `rimKey` / `rimFill`, light fixed in world space |
| 2 | **Darkened inner edge**, a soft dark band just inside the rim | Subtractive, so it reads against bright rooms. Paired with cue 1 the edge holds on any background. This is the WWDC26 retune for iOS 27 ("darkened edge", "brighter specular highlights", per the bible) | `inset 0 0 0 1px` is a line, so instead use `inset 0 -6px 12px -6px rgba(0,0,0,.22)` plus a 10–14 px inner vignette | Inner shadow term |
| 3 | **Lensing at the bezel**: what is behind bends at the border, the centre stays clear | The shape is visible because the background distorts there | Not possible over the room in CSS; possible over in-page content (SVG displacement, Chromium only; see the bible) | Squircle bezel, inward sampling |
| 4 | **Tone step**: the glass is lighter or darker than its surroundings and is frosted | The silhouette appears as a change in brightness and detail | Window/panel tint (`--lgs-window-bg`) | Frost + adaptive tint |
| 5 | **Shadow** cast onto what is behind, sized by depth | Grounds the slab and tells its height | Only where there is something behind inside the same page (§16.3) | `uShadow` contact shadow |
| 6 | **Stereo depth** | The slab sits at a different depth from its surroundings | — | T4 placement |

Rules [ours]:

- No `border`, no `outline` and no full-strength 1 px `box-shadow` ring on any glass container. Exceptions: the text-field focus ring (§9) and Increase Contrast / Steam high-contrast mode.
- No 1 px lines inside glass either (§1.5); use spacing, a tone step or a ≥ 2 px soft separator.
- Bigger glass reads thicker (DL §1 P5): menus and sheets get a stronger inner shadow and a deeper cast shadow than buttons.

---

## 16. Depth plan: subtle stereo

### 16.1 visionOS rules [official]

- Depth shows hierarchy; prefer subtle depth; the system adds shadows and specular highlights to views and controls in a window so they look substantial [[HIG Spatial layout][hig-spatial], [WWDC23-10072][wwdc23-10072], [HIG Windows][hig-windows]].
- "Depth is great for visually separating large, important elements in your app, like making a tab bar or toolbar stand out from a window, but it may not work as well on small objects", for example a symbol popped off its button [[HIG Spatial layout][hig-spatial]].
- Never give text depth on its own [[HIG Spatial layout][hig-spatial]].
- Keep interactive content at one depth; a modal pushes the main view back and appears at the original distance so the eyes don't refocus [[WWDC23-10073][wwdc23-10073]].
- Light and shadow must reinforce depth; conflicting cues cause discomfort [[WWDC23-10078][wwdc23-10078]].

### 16.2 Frame depth table [ours]

These revise the `NATIVE.md` defaults: 0.8–1.2 cm gives ≤ 0.4 display px of disparity on the Frame (§1.6), which is below what people reliably see.

| Element | dz | Disparity (display px) | Paired cue |
|---|---|---|---|
| Window glass, content, rows, in-window buttons | 0 | 0 | Shadows only |
| Primary action capsule (Play) | +1.5 cm | 0.5–0.6 | Tint + shadow |
| Focused or hovered content card (lift) | +1.5 cm | 0.5–0.6 | `scale: 1.05` + deeper shadow |
| Home grid icons at rest / focused | +1 cm / +2.5 cm | 0.35 / 0.9 | Icon shadow; scale 1.10 when focused |
| Tab bar, toolbars, search or navigation ornament | +2.5 cm | 0.9–1.1 | Ornament shadow on the glass |
| Tooltips | depth of their button + 0.5 cm | — | — |
| Menus, popovers, context menus | +3.5 cm | 1.2–1.5 | Thick material, deeper shadow |
| Alerts | +3 cm, parent dimmed | 1.1–1.3 | Scrim |
| Sheets | 0 (stays at the window's depth); the parent's crops go to **−6 cm** and dim | −2 (parent) | Scrim; parent about 4 % smaller in angle |
| Second sheet | 0; everything behind −10 cm | | Extra scrim |

- Pop out containers (bars, cards, capsules), never a label or a glyph by itself.
- T4 crops stay at their original x/y (input lands on Steam's panel). The parent push-back for sheets is possible because the sheet itself does not move.

### 16.3 Shadow sized by depth [ours]

With the light from above, a popped slab casts its shadow onto the glass below it: **y-offset ≈ 0.4 px per mm of dz, blur ≈ 1.2 px per mm, black 0.25–0.35**. At +25 mm: 10 px offset, 30 px blur. The cast shadow is the monocular half of the depth cue and must agree with the stereo half.

---

## 17. Sheets, popovers, menus and alerts

**Sheets [official]**

- "Sheets are presented as modal views, and they appear at the center of the app. Modals contain the same Z position as the parent window. The parent window pushes back and dims." A second modal stacks in front "with an additional layer of dimming pushing everything back"; prefer push navigation inside one sheet [[WWDC23-10076][wwdc23-10076]].
- Don't let a sheet emerge from the bottom edge; centre it in the field of view. Use a default size that keeps context (not covering most of the window) [[HIG Sheets][hig-sheets]].
- Liquid Glass pairs sheets with a dimming layer to signal modality [[WWDC25-356][wwdc25-356]].

**Popovers and menus [official]**

- "Menus and popovers can expand outside the window. They appear centered by default." The invoking button switches to its **selected** (white) state, so no arrow is needed [[WWDC23-10076][wwdc23-10076]].
- Show a menu near the content it controls. Menus use the iOS small or large layout. Over 3D content, presentations "break through" with the subtle effect by default [[HIG Menus][hig-menus], [WWDC25-317][wwdc25-317]].
- Liquid Glass: "When showing a menu, the bubble simply pops open to reveal the content contained within", from the button that summoned it; the larger glass becomes thicker, with deeper shadows and stronger lensing [[WWDC25-219][wwdc25-219]]. Menus favour symbols next to labels [[WWDC25-356][wwdc25-356]].

**Alerts [official, [HIG Alerts][hig-alerts]]**

- In the Shared Space an alert appears in front of its window, "slightly forward along the z-axis", and stays anchored to the window if it moves.
- An accessory view is at most **154 pt tall with a 16 pt corner radius**.
- Liquid Glass alerts use bolder, left-aligned type (DL §8).

**Frame spec [ours]**

| Surface | Spec |
|---|---|
| Sheet | Centred on the glass, width ≤ 75 % of the glass, radius 44 px, thick glass. Close (or back) as a 60 px circle top-left. Parent: −6 cm (T4) or, in CSS only, a black 0.40 scrim; Steam's current 0.85 scrim is too dark for glass |
| Menu / context menu | Radius 32 px, 8 px padding, rows 72 px with radius 24 px (32 − 8), 6 px between rows, min width 320 px, symbols left of labels. +3.5 cm. Grows from the invoking control (§18). The invoking button turns white-selected while open. Opens upward or centred when the source is a bottom ornament |
| Popover | As a menu, but sized to its content; no arrow |
| Alert | Width 640 px, radius 44 px, title Title 3 28 px Bold, left-aligned body, buttons 60 px capsules side by side (rounded rectangles if stacked). +3 cm, parent dimmed. Accessory ≤ 205 px tall (154 pt), radius 21 px (16 pt) |
| Toast / notification | Panel glass, radius 30 px, ≥ 80 px tall. Expands to show actions after a 0.8 s look (visionOS 27 "glance to expand", [press, [MacStories 27][macstories-27]]) |

---

## 18. Motion that complies with the Liquid Glass spec

**Principles [official]**

- **Materialize, don't fade**: "Liquid Glass objects materialize in and out by gradually modulating the light bending and lensing" [[WWDC25-219][wwdc25-219]].
- **Morph** between states and **pop menus out of their source** [[WWDC25-219][wwdc25-219], [WWDC25-356][wwdc25-356]].
- **Flex on touch**: glass "responds to interaction by instantly flexing and energizing with light" and has "gel-like flexibility" [[WWDC25-219][wwdc25-219]].
- **Reduce Motion** "decreases the intensity of some effects and disables any elastic properties" [[WWDC25-219][wwdc25-219]]. Also avoid zooms, multi-axis motion, spinning and persistent background motion when it is on [[WWDC23-10034][wwdc23-10034]].
- **Comfort**: nothing moves at rest; no motion at the edges of the view; fade-move-fade for long moves; no world rotation; no sustained oscillation near 0.2 Hz; slow brightness transitions out of dark scenes [[HIG Motion][hig-motion], [WWDC23-10078][wwdc23-10078]].

**Springs [official]**

- SwiftUI's default animation is a spring with **response 0.55 s and damping fraction 1.0** (critically damped) [[Animation.default][swiftui-default-anim]].
- Presets: `smooth` (no bounce), `snappy` (small bounce), `bouncy` (more bounce), all with a tunable 0.5 s default duration [[Spring][swiftui-spring]]. About 15 % bounce "doesn't feel very bouncy yet", 30 % is noticeable, and values above about 0.4 feel exaggerated for UI [[WWDC23 Animate with springs][wwdc23-10158]].
- A spring's `duration` is perceptual; it settles later. Spring(duration 0.5, bounce 0.3) = stiffness 157.9, damping 17.6 [[Spring][swiftui-spring]].

**CSS tokens [ours, computed from the SwiftUI spring equations]** (stiffness = (2π / duration)², damping fraction = 1 − bounce; the CSS duration is the time to settle within 0.2 %). `linear()` needs Chromium 113 or later; check `CSS.supports('transition-timing-function','linear(0,1)')` once in Steam's CEF and fall back to `cubic-bezier(.2,.8,.2,1)`.

| Token | Spring | CSS duration | Overshoot | Curve |
|---|---|---|---|---|
| `--lgs-ease-smooth` | bounce 0 | 1.36 × perceptual duration | 0 % | `linear(0, .05, .16, .289, .416, .531, .63, .711, .777, .829, .87, .902, .926, .945, .959, .97, .978, .983, .988, .991, .993, .995, .996, .997, 1)` |
| `--lgs-ease-snappy` | bounce 0.15 | 1.30 × | 0.6 % | `linear(0, .048, .157, .292, .43, .556, .666, .757, .829, .884, .925, .955, .975, .989, .997, 1.003, 1.005, 1.006, 1.006, 1.006, 1.005, 1.004, 1.003, 1.002, 1)` |
| `--lgs-ease-pop` | bounce 0.2 | 1.30 × | 1.5 % | `linear(0, .048, .16, .3, .443, .575, .689, .783, .856, .912, .952, .979, .997, 1.008, 1.013, 1.015, 1.015, 1.013, 1.011, 1.009, 1.007, 1.005, 1.004, 1.003, 1)` |
| `--lgs-ease-bouncy` | bounce 0.3 | 1.48 × | 4.6 % | `linear(0, .062, .206, .38, .553, .704, .826, .917, .979, 1.018, 1.038, 1.046, 1.045, 1.039, 1.031, 1.023, 1.016, 1.01, 1.005, 1.002, 1, .999, .998, .998, 1)` |

| Use | Token | Perceptual | CSS duration | What animates |
|---|---|---|---|---|
| Hover / focus fill and light spot | smooth | 0.25 s | 0.35 s (out 0.25 s) | Background, the spot's opacity |
| Press | smooth | 0.30 s | 0.41 s | `scale` 1 → .97, centre glow |
| Toggle, segmented selection | snappy | 0.40 s | 0.52 s | Knob or pill position; the pill may stretch with velocity (DL §10) |
| Tab bar expand / collapse | smooth | 0.50 s | 0.68 s | Width, then labels |
| Menu or popover in | pop | 0.40 s | 0.52 s | From the source button's rect: size, radius, position; the rim and spec ramp up; content fades in 60 ms after the glass |
| Menu out | smooth | 0.25 s | 0.35 s | Back into the source |
| Sheet in, parent push-back | smooth | 0.50 s | 0.68 s | Sheet scale .94 → 1 with the rim ramp; parent dz 0 → −6 cm, scrim 0 → .40 |
| Toast in | snappy | 0.50 s | 0.65 s | From +8 px below, rim ramp |
| Route change inside the window | smooth (default) | 0.55 s | 0.75 s | Cross-fade + ≤ 3 % scale. No full-width slides |
| Reduce Motion (any of the above) | — | — | ≤ 0.15 s | Opacity only |

**Materialize in each tier**

- CSS: animated `backdrop-filter` is too expensive (`docs/DESIGN.md` §1: "no animated filters"). Approximate it: the container grows from its source with the spring, the rim and specular layers ramp from 0 → 1 over the first 60 % of the duration, then the content fades in.
- glassd: animate the material amount `g.mat` (lensing, frost, tint, shadow, specular together; DL §1 P7).

---

## 19. The Home view, as a model for the Library and "Launch Program"

**visionOS facts**

- App icons are three-dimensional: up to three 1024 × 1024 px layers under a circular mask; the system adds a glass layer with specular highlights and shadows. "When people look at them, they expand", and the highlights and shadows deepen the gap between layers [official, [WWDC23-10076][wwdc23-10076]].
- The Home view has a tab bar on the left for **Apps, People and Environments** [official, [Apple Support][support-overview]].
- **13 apps per page**; pages change with a swipe [press, [9to5Mac][9to5-home]; official, [Apple Support][support-arrange]].
- visionOS 26: custom folders created by dragging one icon onto another; folders show apps "in a fun hexagonal honeycomb shape" with up to seven apps per page [press, [MacStories 26][macstories-26]].
- Environment icons use a **ramp** hover: they scale up slowly, then pop open to reveal more of the landscape [official, [WWDC25-303][wwdc25-303]].
- Wide grids turn inward at the sides so they stay readable (Safari's tab overview) [official, [WWDC23-10072][wwdc23-10072]].

**Observed [measured, refs 1, 9, 10]**

- **No window.** Icons float directly in the room, each with its own shadow.
- Rows of **4-5-4**, offset by half a pitch (hexagonal packing). Horizontal pitch ≈ 2.0 × the icon diameter; vertical pitch ≈ 1.75 ×.
- Labels sit under the icons in a small Medium weight, about 0.25 × the diameter below. Badges are red capsules at the top-right. Page dots are centred below the grid.
- The grid follows a gentle curve around the viewer: the outer icons are turned inward.
- The environment picker (ref 9) uses the same circular tiles with a title above ("My Environments") and a "+" tile first.

**Frame translation [ours]**

| Property | Value |
|---|---|
| Window | Transparent on this route: no window glass, icons float over the room (T1). Keep a very faint radial backdrop (black 0.15, 600 px radius) only if the audit fails contrast over bright rooms |
| Icon | 112 px circle (84 pt, 3.4°) of game art: the portrait capsule with `object-fit: cover; object-position: 50% 30%`, or Steam's logo-on-hero composite if available |
| Grid | 13 per page as 4-5-4; horizontal pitch 224 px, vertical pitch 196 px; fits 1280 × 720 with about 60 px margins |
| Label | Subheadline 20 px Medium, white 0.9, at most 2 lines, centred, 14 px below the icon |
| Icon glass | Specular rim on each icon (cue 1, §15) and a contact shadow (offset 6 px, blur 18 px, black 0.35). Icons are content: no frost, no tint |
| Hover / focus | `scale: 1.10`, +2.5 cm, shadow deepens; after 0.8 s (ramp) reveal a Play capsule or details |
| Pagination | Page dots 12 px at 24 px pitch, active white, inactive white 0.35. LB/RB and the stick at the edge change pages; laser drag too |
| Badges | Red capsule ≥ 28 px tall, white 18 px Semibold (updates, new) |
| Tab bar | Left ornament (§5): Library sections such as All, Recent, Collections, Non-Steam |
| Risk | Steam's library grid is virtualized and its gamepad navigation is geometric. A hexagonal 4-5-4 layout changes left/right/up/down neighbours. Verify with `L.pad` traversal before keeping it; a plain 5-column grid of circles is the fallback |

---

## 20. Control Center, as a model for Quick Access

**visionOS 26 [press, [MacStories 26][macstories-26]]:** the full panel opens at once. Top row: time, date, battery, network, Focus, with shortcuts to Notification Center and Spotlight. Left column: Wi-Fi, Bluetooth, AirDrop and Airplane Mode circles, the volume slider, Now Playing, environment controls. Right: a scrollable list of toggles (Mac Virtual Display, mirroring, Guest User, Window Sharing, Focus, Travel Mode, Screen Recording, accessibility).

**visionOS 27 [press, [MacStories 27][macstories-27], [MacRumors][macrumors-27]]:** a three-pane layout. Left: time, date, Now Playing and notifications. Centre: system controls. Right: Environment controls. Notifications expand when looked at.

Control Center's collapsed status view is head-anchored by default; when Zoom is on or people prefer no head anchoring, it moves freely so it can be placed inside the Zoom lens [official, [WWDC23-10034][wwdc23-10034]]. Since visionOS 2 it opens from a palm-flip system overlay [official, [HIG Gestures][hig-gestures]].

**Observed in ref 3 (visionOS 27) [measured]**

- Three separate glass tiles of similar size, each about **290 × 410–430 pt**, about 18 pt apart, corner radius ≈ 40 pt, turned slightly toward the viewer along a curve.
- Centre tile: four **44 pt circular toggles** at ≈ 61 pt pitch (on = blue fill with a white glyph, off = dark fill); an inner rounded platter (regular material, ≈ 24 pt radius) with four rows at ≈ 52 pt pitch (glyph + label, no separators); a full-width **capsule slider ≈ 56 pt tall** whose value is a white fill with a dark speaker glyph inside it.
- Left tile: a large clock (about 2.5 × body), status glyphs, a Now Playing platter with transport circles, a "35 Notifications" capsule row with a chevron.
- Right tile: the environment's name in a large bold title, circular buttons in both top corners, a full-width capsule slider at the bottom.
- A **≈ 36 pt circular close button** centred about 14 pt below the tiles.

**Frame pattern [ours]** (for Steam's Quick Access popup or any settings-at-a-glance surface)

| Property | Value |
|---|---|
| Tiles | 3 × 380 px wide, 24 px gaps (total 1188 px), radius 54 px, panel glass, separated by transparent gaps (the overlay shows the room between them) |
| Toggles | 60 px circles at 80 px pitch; on = whole-fill colour + white glyph; off = black 0.30 fill |
| Rows | 72 px, symbol + label, inside a black 0.14 platter, radius 30 px |
| Sliders | 72 px tall capsule track (black 0.30); value = white 0.85 fill from the leading edge with the dark glyph inside; a knob appears on hover/focus (an instant hover effect, [WWDC24-10152][wwdc24-10152]); left/right on the gamepad adjusts. Horizontal only [official, [HIG Sliders][hig-sliders]] |
| Close | 48 px circle centred 20 px below the tiles (if the surface has a close action) |

---

## 21. App layouts: what to borrow

| visionOS app | Structure | Borrow for |
|---|---|---|
| **Settings** (ref 8) | Sidebar with search at the top, coloured circular icons, capsule selection; detail with a circular back button top-left, a centred bold title, grouped rounded rows, small capsule buttons | Steam Settings, SteamVR settings |
| **Photos** | Vertical tab bar; full-bleed grid; a bottom segmented ornament (Years, Months, All); an opened photo grows and dims the surroundings [official, [WWDC23-10076][wwdc23-10076], [WWDC23-10072][wwdc23-10072]] | Screenshots and media |
| **Music** (ref 11) | Tab bar outside the window; a sidebar inside the Library tab; a Now Playing ornament across the bottom edge; Search as a tab with colourful category tiles | Library browsing, Store browsing, Downloads / now-playing ornament |
| **TV** (ref 5) | Full-bleed hero art in the window, a circular back button top-left, utility circles top-right, a Play capsule plus a circular secondary; rows of art below. Video takes over the window and darkens passthrough [official, [WWDC23-10072][wwdc23-10072]] | The game details page |
| **Safari** (ref 7) | Tall window; a navigation ornament above it (back/forward circles, address capsule with mic, share/+/more circles); the window grows when the sidebar opens; the tab overview is a wide grid turned inward at the sides | Store browser chrome, search placement |
| **Messages** (ref 4) | Sidebar: Large Title, filter circle and Edit capsule, search capsule with mic, pinned contacts as a 3-column grid of large circular avatars, then conversation rows with a lighter selected pill. Conversation: glass bubbles (blue for your own), a compose capsule with mic, a "+" circle | Friends and chat |
| **Image Playground** (ref 2) | Split view: a thumbnail list in the sidebar, the content pane with in-window circular toolbar buttons and a prompt capsule at the bottom | Any list + detail surface |
| **Control Center** (ref 3) | Three tiles (§20) | Quick Access |
| **Home / Environments** (refs 1, 9, 10) | Windowless circular grid (§19) | Library home, "+ > Launch Program" |

---

## 22. Immersion and passthrough on the Frame

- visionOS starts apps in the Shared Space and asks for the minimum immersion a moment needs. Dimming passthrough is the light-weight way to focus attention; the default dim tint is black; prefer subtle tints, never dramatic ones [official, [HIG Immersive experiences][hig-immersive], [WWDC23-10072][wwdc23-10072]].
- Avoid a bright object on a black field; slow down transitions from dark to bright scenes [official, [HIG Color][hig-color], [WWDC23-10078][wwdc23-10078]].
- Large moving objects should be more translucent while they move [official, [HIG Motion][hig-motion]].
- Avoid head-locked content; anchor in the room [official, [HIG Spatial layout][hig-spatial]].

Frame specifics [ours]:

- The dashboard floats over passthrough (mono or Arcturus colour) or over a running game. Treat a game behind the window like a visionOS Environment: the glass takes its colour from it, and it must stay legible over bright, busy frames. glassd's adaptive tint does this; in CSS the window tint has to carry it alone (`DESIGN.md` §1).
- SteamVR settings are off limits (no passthrough or dimming settings). If a focus dim is wanted (sheets, video), draw it as our own overlay layer behind the window: black ≤ 0.30, in over ≥ 0.5 s, and only while the modal is up.
- Large white areas glare in a dark room. Keep white fills small (selected states, slider values) and let glassd darken the glass in dark rooms (DL §1 P4).
- Ornaments, sheets and menus are attached to the window, never to the head.

---

## 23. Accessibility

**visionOS [official]**

- Pointer Control (head or hand), Dwell Control (select by looking), Zoom (a head-anchored lens), VoiceOver, Switch Control, Guided Access; Dynamic Type; Increase Contrast; Reduce Transparency; Reduce Motion [[HIG Accessibility][hig-a11y], [HIG Designing for visionOS][hig-visionos], [WWDC23-10034][wwdc23-10034]].
- Respond to the largest Dynamic Type sizes; keep "at least a four-to-one contrast ratio" between foreground and background [[WWDC23-10034][wwdc23-10034]]. Use 4.5:1 (WCAG AA) for body text on the Frame.
- Prioritise comfort: prefer horizontal layouts, slower animation in the periphery, no head anchoring, no large repetitive gestures [[HIG Accessibility][hig-a11y]].
- Liquid Glass under Increase Contrast becomes predominantly black or white with a contrasting border; under Reduce Motion it loses its elasticity [[WWDC25-219][wwdc25-219]].

**Steam's own settings the theme must honour** (never change them): interface scaling with font size, high-contrast mode, reduced animations, a screen reader on SteamOS, and colour filters [press, [Steam accessibility update][steam-a11y]].

**Frame rules [ours]**

| Setting | Theme behaviour |
|---|---|
| Steam high contrast (`prefers-contrast` in Steam's CSS, see `inventory/shell.md`) | Glass becomes near-opaque #0b0d10 at 0.94; a 2 px white edge is allowed; text pure white; no light spot |
| Steam reduced animations / `prefers-reduced-motion` | Springs off; opacity cross-fades ≤ 0.15 s; no scale, lift or elastic stretch |
| Interface scale | Sizes are in CSS px/pt, so they scale with Steam's zoom; check the largest scale for overflow |
| Screen reader | Keep Steam's DOM order and roles; add `aria-label` to every icon-only button we turn into a circle (T2) |
| Transparency | The Glass intensity dial (DL §11) is the user's Reduce Transparency |
| Input parity | Every hover reveal has a gamepad-focus path (§12); nothing is visible only on hover |

---

## 24. Checks an agent can run without the user

Each rule above has a measurable form. These suit `python glass.py audit`, CDP `getBoundingClientRect`/`getComputedStyle` sweeps and `L.pad` traversals:

1. **Targets:** every focusable element's hit box is ≥ 80 × 80 px, or its centre is ≥ 80 px from every other target's centre with ≥ 21 px of clear gap.
2. **Text:** no computed `font-size` below 18 px; body text ≥ 22 px; contrast ≥ 4.5:1 against the rendered glass (`CONTRAST` = 0).
3. **No outlines:** glass containers have `border-width: 0` and `outline-style: none`; no 1 px `box-shadow` rings; no 1 px separators.
4. **Selection vocabulary:** white fill + dark text only on selected/toggled buttons and open-menu sources; nothing else is white-filled.
5. **Focus:** with each element focused (`.gpfocus`), its fill differs from rest (luminance step ≥ 0.06), in a screenshot.
6. **Tabs:** the tab bar has ≤ 6 items.
7. **Depth:** every T4 layer's `dz` maps to ≤ 3 display px of disparity (≤ 8 cm), and every lift is paired with a shadow (§16.3).
8. **Motion:** no `animation-iteration-count: infinite`; transition durations ≤ 0.8 s; the reduced-motion path leaves only opacity.
9. **Parity:** for every element with a hover-only reveal, the same reveal appears under gamepad focus.
10. **Fonts:** Inter loaded (`document.fonts.check('500 24px Inter')`); CJK strings still render (fallback present).

---

## 25. Numbers table

| Item | visionOS value | Tag | Frame value | Tag |
|---|---|---|---|---|
| Unit | 1 pt ≈ 0.0417° (60 pt ≈ 2.5° ≈ 4.4 cm at 1 m) | official | 1 pt = 4/3 CSS px = CSS `pt` (0.0409°) | ours |
| CSS pixel on the main window | — | — | 0.766 mm, 0.0307°; window 37.8° × 21.8° | ours (NATIVE.md) |
| Display density | ≈ 34 ppd | press | ≈ 19.6 ppd; 1 CSS px ≈ 0.6–0.74 display px | press, ours |
| Default window | 1280 × 720 pt, ≈ 2 m, ≈ 3 m wide | official | 1280 × 720 px = 960 × 540 pt | ours |
| Window corner radius | Unpublished (32–46 pt estimates) | community | 54 px | ours |
| Content inset | — | — | 24 px min, 32 px for text | ours |
| Minimum hit region / centre spacing | 60 pt | official | 80 px | ours |
| Margin around items | 16 pt | official | 21 px (use 24) | ours |
| Space between list/menu items | 4 pt | official | 6 px | ours |
| Hover padding, buttons ≥ 60 pt | 4 pt | official | 6 px | ours |
| Space between stacked buttons | ≥ 16 pt | official | ≥ 24 px | ours |
| Buttons mini / small / regular / large / XL | 28 / 32 / 44 / 52 / 64 pt | official | 38 / 44 / 60 / 70 / 86 px | ours |
| Ornament overlap at the bottom edge | 20 pt | official | 28 px | ours |
| Ornament height | — | — | 84 px (60 px buttons + 12 px padding) | ours |
| Ornament depth | "slightly in front", unpublished | official | +2.5 cm | ours |
| Tab bar | Vertical, leading, ≤ 6 tabs, expands on look after a short delay | official | 84 px wide, 60 px items at 80 px pitch, 16 px gap, expands to ≈ 270 px after 0.4 s hover (at once on gamepad entry), collapses 0.3 s after leaving | ours |
| Window bar | ≈ 135 × 12 pt, ≈ 15–25 pt below | measured | 180 × 16 px visible, ≥ 80 px hit height, 24 px below | ours |
| Sidebar | ≈ 30–33 % of the window, regular (darker) material | measured, official | 30 % of the glass, black 0.14 over the glass | ours |
| Sidebar / list rows | ≈ 52–60 pt pitch | measured | 72 px + 8 px gap, or 80 px contiguous | ours |
| Sidebar icon | ≈ 28–30 pt coloured circle | measured | 40 px | ours |
| Search field | ≈ 44 pt capsule, ≤ min(500 pt, ½ window) | community | 64 px capsule, ≤ min(640 px, 50 %) | ours |
| Alert accessory view | ≤ 154 pt tall, 16 pt radius | official | ≤ 205 px, 21 px radius | ours |
| Menu | Pops from its source; can leave the window | official | Radius 32 px, padding 8 px, rows 72 px (radius 24 px), +3.5 cm | ours |
| Sheet | Same depth as parent; parent pushes back and dims; close top-left | official | Parent −6 cm, scrim black 0.40, radius 44 px, width ≤ 75 % | ours |
| Default / minimum text | 17 pt / 12 pt | official | 24 px / 18 px | ours |
| Weights | Body Medium, titles Bold | official | 500 / 700 (Inter) | ours |
| Type scale | Unpublished for visionOS | — | 64 / 52 / 46 / 38 / 30 / 28 / 24 / 24 / 22 / 20 / 18 / 18 px (§13) | ours |
| Font | SF Pro (Apple platforms only) | official | Inter 4.1, OFL 1.1, wght 100–900, opsz 14–32 | verified |
| System colours | Dark-appearance values | official | Blue (0,145,255), green (48,209,88), red (255,66,69), orange (255,146,48), yellow (255,214,0) | official |
| Clear-glass dimming over bright content | 35 % black | official | 35 % | official |
| Default animation | Spring, response 0.55 s, damping fraction 1.0 | official | `--lgs-ease-smooth`, 0.75 s | ours |
| Bounce guidance | 0.15 subtle, 0.3 noticeable, > 0.4 too much | official | snappy 0.15, pop 0.2, bouncy 0.3 (maximum) | ours |
| Hover reveal delay (Apple sample) | 0.8 s in, 0.2 s out | official | Tooltips 0.8 s; back-title 0.6 s; tab bar 0.4 s | ours |
| Disparity of 1 cm | 0.31 px (2 m, 34 ppd) | ours | 0.35–0.43 px at 1.43 m | ours |
| Depths | Unpublished | — | Lift 1.5, ornaments 2.5, alerts 3, menus 3.5, sheet parent −6 cm | ours |
| Depth shadow | — | — | 0.4 px offset and 1.2 px blur per mm of dz | ours |
| Home view | 13 apps per page; 4-5-4 hex rows; folders up to 7 per page (visionOS 26) | press, measured | 112 px icons, 224 × 196 px pitch, 13 per page | ours |
| Control Center (visionOS 27) | 3 tiles ≈ 290 × 420 pt, 44 pt toggles at ≈ 61 pt pitch, ≈ 56 pt slider, ≈ 36 pt close | measured | 3 × 380 px tiles, 24 px gaps, 60 px toggles at 80 px, 72 px sliders, 48 px close | ours |
| Window curvature | First-party only (visionOS 27) | press, community | Optional; OpenVR curvature ≈ 0.11 for a head-centred cylinder | ours |
| Reading distance | ≥ 1 m | official | 1.43 m (as is) | — |
| Oscillation to avoid | ≈ 0.2 Hz | official | Nothing animates at rest | ours |
| Contrast | ≥ 4:1 | official | ≥ 4.5:1 | ours |

---

## Sources

Apple Human Interface Guidelines (fetched as JSON from `developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json` on 2026-10-06):

- [Windows][hig-windows] · [Ornaments][hig-ornaments] · [Tab bars][hig-tabbars] · [Toolbars][hig-toolbars] · [Sidebars][hig-sidebars] · [Split views][hig-split] · [Search fields][hig-search] · [Buttons][hig-buttons] · [Eyes][hig-eyes] · [Gestures][hig-gestures] · [Spatial layout][hig-spatial] · [Immersive experiences][hig-immersive] · [Typography][hig-typography] · [Materials][hig-materials] · [Color][hig-color] · [Motion][hig-motion] · [Layout][hig-layout] · [Sheets][hig-sheets] · [Alerts][hig-alerts] · [Menus][hig-menus] · [Sliders][hig-sliders] · [Scroll views][hig-scroll] · [Focus and selection][hig-focus] · [Accessibility][hig-a11y] · [Designing for visionOS][hig-visionos]

WWDC session transcripts (developer.apple.com video pages):

- WWDC23: [Principles of spatial design][wwdc23-10072] · [Design for spatial user interfaces][wwdc23-10076] · [Design for spatial input][wwdc23-10073] · [Design considerations for vision and motion][wwdc23-10078] · [Create accessible spatial experiences][wwdc23-10034] · [Explore immersive sound design][wwdc23-10271] · [Meet SwiftUI for spatial computing][wwdc23-10109] · [Animate with springs][wwdc23-10158]
- WWDC24: [Design great visionOS apps][wwdc24-10086] · [Create custom hover effects in visionOS][wwdc24-10152]
- WWDC25: [Meet Liquid Glass][wwdc25-219] · [Get to know the new design system][wwdc25-356] · [Design hover interactions for visionOS][wwdc25-303] · [What's new in visionOS 26][wwdc25-317]
- WWDC26: [Platforms State of the Union][wwdc26-102]

Apple developer documentation and support:

- [SwiftUI `Animation.default`][swiftui-default-anim] · [SwiftUI `Spring`][swiftui-spring] · [SwiftUI `HoverEffect.highlight`][swiftui-highlight] · [SwiftUI `HoverEffect.lift`][swiftui-lift]
- [Apple Vision Pro User Guide: overview (Home view tabs)][support-overview] · [Arrange or delete apps on Apple Vision Pro][support-arrange]
- [Apple Developer Forums: Curved windows in visionOS 27][forum-curved] · [Apple Fonts (SF license)](https://developer.apple.com/fonts/) · [Apple Design Resources](https://developer.apple.com/design/resources/)

Press and community:

- [MacStories: visionOS 26 review, system changes][macstories-26] · [MacStories: visionOS 27 overview][macstories-27] · [MacRumors: visionOS 27][macrumors-27] · [9to5Mac: Vision Pro Home View layout][9to5-home]
- [Christian Selig: Recreating Apple's visionOS search bar][selig-search]
- [vr.org: Steam Frame specs][frame-specs] · [IEEE Spectrum: Apple Vision Pro display][ieee-avp]
- [Steam Deck HQ: Steam client accessibility features][steam-a11y]

Implementation references:

- [OpenVR `openvr.h` (`SetOverlayCurvature`)][openvr-h]
- [Inter][inter] · [Inter license][inter-license] · [Inter 4.1 release][inter-release]

[hig-windows]: https://developer.apple.com/design/human-interface-guidelines/windows
[hig-ornaments]: https://developer.apple.com/design/human-interface-guidelines/ornaments
[hig-tabbars]: https://developer.apple.com/design/human-interface-guidelines/tab-bars
[hig-toolbars]: https://developer.apple.com/design/human-interface-guidelines/toolbars
[hig-sidebars]: https://developer.apple.com/design/human-interface-guidelines/sidebars
[hig-split]: https://developer.apple.com/design/human-interface-guidelines/split-views
[hig-search]: https://developer.apple.com/design/human-interface-guidelines/search-fields
[hig-buttons]: https://developer.apple.com/design/human-interface-guidelines/buttons
[hig-eyes]: https://developer.apple.com/design/human-interface-guidelines/eyes
[hig-gestures]: https://developer.apple.com/design/human-interface-guidelines/gestures
[hig-spatial]: https://developer.apple.com/design/human-interface-guidelines/spatial-layout
[hig-immersive]: https://developer.apple.com/design/human-interface-guidelines/immersive-experiences
[hig-typography]: https://developer.apple.com/design/human-interface-guidelines/typography
[hig-materials]: https://developer.apple.com/design/human-interface-guidelines/materials
[hig-color]: https://developer.apple.com/design/human-interface-guidelines/color
[hig-motion]: https://developer.apple.com/design/human-interface-guidelines/motion
[hig-layout]: https://developer.apple.com/design/human-interface-guidelines/layout
[hig-sheets]: https://developer.apple.com/design/human-interface-guidelines/sheets
[hig-alerts]: https://developer.apple.com/design/human-interface-guidelines/alerts
[hig-menus]: https://developer.apple.com/design/human-interface-guidelines/menus
[hig-sliders]: https://developer.apple.com/design/human-interface-guidelines/sliders
[hig-scroll]: https://developer.apple.com/design/human-interface-guidelines/scroll-views
[hig-focus]: https://developer.apple.com/design/human-interface-guidelines/focus-and-selection
[hig-a11y]: https://developer.apple.com/design/human-interface-guidelines/accessibility
[hig-visionos]: https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos
[wwdc23-10072]: https://developer.apple.com/videos/play/wwdc2023/10072/
[wwdc23-10076]: https://developer.apple.com/videos/play/wwdc2023/10076/
[wwdc23-10073]: https://developer.apple.com/videos/play/wwdc2023/10073/
[wwdc23-10078]: https://developer.apple.com/videos/play/wwdc2023/10078/
[wwdc23-10034]: https://developer.apple.com/videos/play/wwdc2023/10034/
[wwdc23-10271]: https://developer.apple.com/videos/play/wwdc2023/10271/
[wwdc23-10109]: https://developer.apple.com/videos/play/wwdc2023/10109/
[wwdc23-10158]: https://developer.apple.com/videos/play/wwdc2023/10158/
[wwdc24-10086]: https://developer.apple.com/videos/play/wwdc2024/10086/
[wwdc24-10152]: https://developer.apple.com/videos/play/wwdc2024/10152/
[wwdc25-219]: https://developer.apple.com/videos/play/wwdc2025/219/
[wwdc25-356]: https://developer.apple.com/videos/play/wwdc2025/356/
[wwdc25-303]: https://developer.apple.com/videos/play/wwdc2025/303/
[wwdc25-317]: https://developer.apple.com/videos/play/wwdc2025/317/
[wwdc26-102]: https://developer.apple.com/videos/play/wwdc2026/102/
[swiftui-default-anim]: https://developer.apple.com/documentation/swiftui/animation/default
[swiftui-spring]: https://developer.apple.com/documentation/swiftui/spring
[swiftui-highlight]: https://developer.apple.com/documentation/swiftui/hovereffect/highlight
[swiftui-lift]: https://developer.apple.com/documentation/swiftui/hovereffect/lift
[support-overview]: https://support.apple.com/guide/apple-vision-pro/tan39b6bab8f/visionos
[support-arrange]: https://support.apple.com/en-us/118506
[forum-curved]: https://developer.apple.com/forums/thread/829696
[macstories-26]: https://www.macstories.net/stories/visionos-26-the-macstories-review/7/
[macstories-27]: https://www.macstories.net/news/visionos-27-the-macstories-overview/
[macrumors-27]: https://www.macrumors.com/2026/06/09/visionos-27-siri-ai-eye-aware-notifications/
[9to5-home]: https://9to5mac.com/2024/01/30/apple-vison-pro-home-screen-apps-alphabetically/
[selig-search]: https://christianselig.com/2024/03/recreating-visionos-search-bar/
[frame-specs]: https://vr.org/steam-frame-specs
[ieee-avp]: https://spectrum.ieee.org/apple-vision-pro
[steam-a11y]: https://steamdeckhq.com/news/steam-deck-client-update-accessibility-features/
[openvr-h]: https://github.com/ValveSoftware/openvr/blob/master/headers/openvr.h
[inter]: https://rsms.me/inter/
[inter-license]: https://github.com/rsms/inter/blob/master/LICENSE.txt
[inter-release]: https://github.com/rsms/inter/releases/tag/v4.1
