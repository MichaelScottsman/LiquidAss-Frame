# visionOS reference analysis for Phase 2

This file analyses the 12 visionOS screenshots the user attached (`docs/refs/visionos/1.png` … `12.png`), turns them into measurable traits, and compares them with the Steam Frame UI as it looks today with Glass Shell Phase 1 on.

- Part A: method and units.
- Part B: each reference, one by one.
- Part C: consolidated measurements.
- Part D: the glass, quantified.
- Part E: the traits a redesign must reproduce, ranked by how much each one makes the UI feel like native visionOS, with target values in Steam CSS px and a way to verify each one without a human.
- Part F: do and don't rules.
- Part G: the current Steam Frame look and the biggest gaps.
- Part H: tensions and open questions.

Evidence tags used below: **[measured]** = measured on the reference pixels in this study; **[seen]** = visible in the references but not measurable; **[bible]** = from the project's design bible (`../bible/`, rulebook `../.claude/skills/run-liquid-glass-frame/references/design-language.md`); **[inferred]** = my reading, to be confirmed.

---

## Top findings (read this if nothing else)

1. **The glass is frosted room, not tinted transparency.** [measured] Inside visionOS glass the room's local contrast drops by 80–95% (luma standard deviation 10–50 outside, 1–4 inside), the hue of the room is kept (blue in the snow scenes, amber in wooden rooms), and the luminance is pulled into a band of roughly L 55–110 (sRGB luma, 0–255): bright rooms are darkened by 10–50%, dark rooms are *lifted* by 20–50%. Steam Frame today is a fixed `rgba(20,22,30,0.72)` tint: over a dark room it renders at about L 26 (half of visionOS), and over any room it shows 28% of the room *unblurred* behind the text.
2. **No window, panel or control in the 12 references has an outline.** [measured/seen] Edges are visible through (a) the luminance and hue step between frosted glass and the sharp room, (b) a thin specular highlight that is brightest along the top edge and the top corners and fades out down the sides, and (c) a faint highlight on the bottom edge. Glass Shell today draws a uniform 1 px inset ring on every window, panel and capsule, a 2 px white focus ring, and a white selected capsule with a ring.
3. **Chrome sits in corners and in ornaments, never in bands.** [seen] A circular back button sits in the top-left corner, concentric with the window corner. Titles are centred. Toolbars are glass capsules that float over the top or bottom edge. Tab bars are vertical capsules outside the leading edge. A small window-bar pill (and a close button) floats below the window. Steam today has a 40 px header band with a "Back" text pill and a 1160 × 32 px full-width search strip, a footer legend band, and four stacked rows of separate chrome under the window.
4. **visionOS is about 30–50% larger in visual angle than Steam today.** Using the bible's 60 pt ≈ 2.5° and the brief's 1 CSS px ≈ 0.031°, 1 visionOS pt ≈ 1.34 CSS px. visionOS's standard circular buttons (44 pt) are ≈ 59 CSS px; hit targets (60 pt) are ≈ 80 CSS px; body text (17 pt) is ≈ 23 CSS px. Steam's tabs are 33 px, the + button 30 px, the Back pill 32 px, settings rows 42 px, body text 16 px.
5. **Selection is light, not white.** [measured] A selected sidebar row in visionOS is a translucent light capsule about +30 to +40 L above the glass (white ≈ 18–25%) with a white label. Steam Frame today uses a near-opaque white capsule with dark text plus a ring. In the references, solid white is used only for slider fills.
6. **Fill polarity is consistent.** [measured] Containers and inputs are *recessed*: grouped-row platters and search fields are 10–40% darker than the glass around them. Buttons, selected rows and bubbles are *raised*: 15–35% lighter. Glass Shell today makes grouped sections lighter (`--lgs-fill-1`, white 6%).
7. **Type is title case, Medium and Bold, and white.** [seen] There are no uppercase or letter-spaced labels and no italics in any reference. Steam uses 12 px bold uppercase for tabs, footer legends and sub-labels, and an italic search placeholder.
8. **Launchers are free-floating circles.** [measured] Home and the Environments picker use circular items on a hexagonal lattice: diameter/pitch 0.52–0.55, row pitch ≈ 0.84 × column pitch, alternate rows offset by half a pitch, labels below, page dots, and blurred, faded items at the edges to show paging. There is no backing panel. Steam's "+ > Launch Program" is a 300 px wide list with 16 px icons and separators.
9. **Control Center is three separate glass tiles.** [measured] The tiles are portrait (aspect 0.62–0.65), with circular toggle buttons (blue fill when on), thick capsule sliders (11–12% of tile height) with the glyph inside the white fill, recessed inner platters, and one close button centred below. Steam's Quick Access is one tall panel with 4 px slider tracks.
10. **Depth is used for hierarchy, not decoration.** [seen] Ornaments, the window bar, the close button and the Siri orb float in front of the window plane. Text stays flat. Windows face the user on an arc and are curved (visionOS 27). Steam's window is already curved by SteamVR, but everything on it is on one plane.

A side-by-side contact sheet is at `shots/p2_ref_contact_sheet.png` (visionOS Settings, Home, Control Center and TV next to Steam's settings, Launch Program, Quick Access and library home as they render today).

---

## Part A. Method and units

### A.1 Inputs

| # | file | size (px) | what it is |
|---|---|---|---|
| 1 | `1.png` | 763 × 409 | Home view: app icons over the room, tab bar at the left |
| 2 | `2.png` | 1044 × 676 | Image Playground window (sidebar + content) |
| 3 | `3.png` | 949 × 473 | Control Center, three tiles |
| 4 | `4.webp` | 1106 × 707 | Messages (sidebar + conversation) |
| 5 | `5.png` | 920 × 626 | TV app, episode page, tab bar ornament |
| 6 | `6.webp` | 976 × 749 | Siri / assistant card |
| 7 | `7.webp` | 1354 × 787 | Three windows: a trail web page, Safari with its toolbar ornament, a Siri card |
| 8 | `8.webp` | 1162 × 693 | Settings, Software Update |
| 9 | `9.webp` | 1046 × 623 | Environments picker |
| 10 | `10.webp` | 781 × 542 | Home grid over an office |
| 11 | `11.webp` | 860 × 763 | Music (tab bar + playback ornament) above the TV app |
| 12 | `12.png` | 903 × 624 | Widget gallery (sidebar + preview) |

All 12 are photographs or recordings of the headset view at unknown fields of view, with perspective, camera exposure and video compression. **Only ratios are reliable.** Every length below is relative to the window it belongs to and carries about ±10% error from perspective. Luminance values carry the camera's exposure; compare inside versus outside within one image, never across images.

### A.2 How things were measured

- Each image was read whole, then cropped and upscaled 2–4× around corners, edges, controls and type, and overlaid with a 20 px grid to read coordinates.
- Colour statistics are means over patches of empty glass and of the room next to it: L = Rec.709 luma of the sRGB pixel values (0–255), sd = the standard deviation of L inside the patch (a measure of how much room detail shows through).
- "white x%" means the fill looks like white at alpha x over the glass at that spot; "black x%" likewise.

### A.3 Units and conversion to Steam

- **H** = height of the window (or tile) in the screenshot; **W** = its width.
- Steam's main window is 1280 × 720 CSS px, shown ≈ 0.98 m wide at ≈ 1.43 m: 1 CSS px ≈ 0.77 mm ≈ 0.031°.
- [bible] 60 pt ≈ 2.5°, so 1 pt ≈ 0.042° ≈ **1.34 CSS px**.
- Two conversions follow, and they disagree:
  - **Proportional:** keep the reference's ratio to the window height. With H = 720 CSS px, 1% of H = 7.2 px.
  - **Angular:** keep the visual angle of the visionOS point size. A visionOS window of 1280 × 720 pt would be ≈ 53° × 30°; Steam's window is ≈ 40° × 22°, so it is about 0.75 of a default visionOS window in angle.
- **Rule used in this file:** size *targets and text* by the larger of the two (angle wins: the eye and the laser need the angle). Size *layout proportions* (corner radius, sidebar width, gaps) by the proportional conversion.

| visionOS quantity | pt | angular CSS px | proportional CSS px (from refs) | use |
|---|---|---|---|---|
| hit target | 60 | 80 | — | ≥ 80 |
| standard circular button (visible) | 44 | 59 | 36–48 (5–6.7% H) | 56–60 |
| capsule button / field height | 44 | 59 | 43–47 (6–6.5% H) | 56–60 |
| sidebar row pitch (one line) | ≈ 44–52 [inferred] | 59–70 | 53 (7.4% H) | 60–64 |
| body text | 17 | 23 | 17–19 (2.4–2.7% H) | 20–22 |
| large title | ≈ 29 [inferred] | ≈ 39 | 32–36 (4.5–5% H) | 34–38 |
| window corner radius | unpublished: ≈ 44 [bible demo], ≈ 32 [community] | 43–59 | 46–54 (6.4–7.5% H) | 48–56 |

---

## Part B. The references, one by one

### B.1 Home view (`1.png`)

- **Screen.** The visionOS Home: app icons floating in the room, no window. A small vertical tab bar (Apps, People, Environments) floats at the far left.
- **Layout.** [measured] Three rows on a hexagonal lattice: 4 icons, then 5 (offset by half a pitch), then 4. Icon diameter 62–75 px in the image (larger to the right: the grid curves around the viewer and the camera is off-centre). Column pitch 121–133 px; diameter / pitch = 0.52–0.55. Row pitch 104–107 px ≈ 0.84 × column pitch (a perfect hexagonal lattice is 0.866) ≈ 1.6 × diameter.
- **Typography.** Labels centred under each icon, white, cap height ≈ 11% of the icon diameter, about 0.1 × diameter below it, with a soft dark shadow for legibility over the room. Title case. No backing.
- **Glass.** None behind the icons. The tab bar at the left is a small glass capsule (≈ 25 px wide, 3 glyphs).
- **Controls.** Icons are circles. Badges are red capsules (height ≈ 28% of the icon diameter) at the top-right, overlapping the icon edge by about a third, with bold white numerals. Folders ("More Apps") are a circle containing a 3 × 3 grid of mini icons.
- **Depth.** [seen] Icons have their own lighting: a bright highlight along the top edge and a soft darker lower half, so they read as discs, not stickers. They float in front of the room with no panel behind them.
- **Affordances.** The icon is the target. Labels are not separate targets.
- **Maps to Steam.** "+ > Launch Program", the Steam button menu, Non-Steam apps, a library launcher.

### B.2 Image Playground (`2.png`)

- **Screen.** A two-pane window: history list on the left, the current image and prompt on the right. A window-bar pill below.
- **Layout.** [measured] Window ≈ 532 × 457 px (W/H ≈ 1.16). The sidebar is 204 px = 38% of W = 0.45 × H. List rows: thumbnail ≈ 56 × 50 px with radius ≈ 18% of its height, two lines of title, a date line; row pitch ≈ 69 px = 15% of H. Content pane padding ≈ 18–20 px (≈ 4% of W). Hero image ≈ 290 × 168 px, radius ≈ 22 px.
- **Corner radius.** ≈ 32 px = **7% of H**.
- **Toolbar buttons.** Circles ≈ 26–28 px (≈ 6% of H) with a white ≈ 15% fill and white glyphs: list (sidebar, top right of the sidebar), + (top left of the content pane), trash, share, more (top right). The corner buttons are **concentric with the window corner**: the button centre sits about one corner radius in from both edges.
- **Typography.** The prompt title is bold, white, left-aligned, ≈ 3% of H, with a leading pencil glyph. List titles are semibold ≈ 2.5% of H; dates secondary (≈ 50–60% white). The disclaimer is a centred caption ≈ 1.6% of H, ≈ 60% white.
- **Glass.** [measured] Over a sky of L 118, the content pane reads L 62 and the sidebar L 86: the sidebar is a lighter tone of the same slab, with **no divider line**. The top-left corner carries a bright specular arc; the right and bottom edges have a faint light line.
- **Controls.** "Describe a change" is a capsule field ≈ 23 px (5% of H), slightly *darker* than the glass (L 70 vs 77) with a faint lighter rim at the bottom. The selected history row shows a slightly darker rounded platter behind its thumbnail.
- **Depth.** The window bar (≈ 84 × 7 px, ≈ 16% of W, grey ≈ 70% white) floats ≈ 8 px below the bottom edge, centred.
- **Maps to Steam.** Library as sidebar + content (tabs become sidebar rows); a game page with a list of games at the left; the search page.

### B.3 Control Center (`3.png`)

- **Screen.** Three free-standing glass tiles: time and Now Playing; connectivity toggles plus a list and a volume slider; the current environment with an immersion slider. A close button below.
- **Layout.** [measured] Tiles ≈ 170–195 × 275–290 px, aspect W/H = 0.62–0.65, placed on an arc (the right tile is nearer and larger). Gaps between tiles ≈ 10–17 px (6–9% of tile width). Tile corner radius ≈ 26 px ≈ 9–10% of tile height.
- **Controls.**
  - Toggle buttons: circles ≈ 30 px = 17% of tile width, pitch ≈ 42 px (23% of width), inset ≈ 12–15 px from the top and side (concentric with the corner). **On** = solid system blue with a white glyph (Wi-Fi, Bluetooth, AirDrop). **Off** = a darker glass circle with a white glyph (Airplane).
  - Inner platter: a recessed rounded rect (radius ≈ 18 px, concentric) holding a 4-row list (pitch ≈ 36 px, glyph + label).
  - Sliders: capsules ≈ 32 px tall = **11–12% of tile height**. The fill is near-white (L ≈ 208) and carries the dark glyph (speaker, mountain) at its left end; the track is darker glass (L 72 against the tile's 88).
  - Close: one circle ≈ 22 px with a white ×, centred under the middle tile, ≈ 10 px below it.
- **Typography.** The time is huge and light-weight (≈ 16–18% of tile height); "Thórsmörk" is bold, ≈ 9% of tile height; list labels semibold ≈ 4% of tile height.
- **Glass.** [measured] Sky L 123 outside; tile glass L 88–92; inner platter L 61 (black ≈ 30% over the glass). Room detail behind the lower part of the tiles is blurred but its brightness pattern is kept. The top edge of each tile has a crisp light line; it fades down the sides.
- **Maps to Steam.** Quick Access (Quick Settings, Performance, Battery, Notifications) as tiles; the volume HUD; the Playspace / Streaming popups.

### B.4 Messages (`4.webp`)

- **Screen.** Two panes: a sidebar with a large title, search, pinned contacts and the conversation list; the conversation on the right. Siri orb at the lower right.
- **Layout.** [measured] Sidebar height ≈ 500 px in the image (nearest the camera), right pane ≈ 435 px. Large title "Messages" ≈ 4.8% of H, Bold, at the sidebar's leading edge. Search capsule ≈ 30 px (6% of H) across the sidebar. Filter circle and "Edit" capsule ≈ 30 px, to the right of the title. Pinned avatars ≈ 75 px circles, 3 per row, pitch ≈ 100 px, names below (semibold). List rows pitch ≈ 57 px (11.4% of H, two-line rows) with 36 px avatars, a bold name, a secondary right-aligned time, and a two-line secondary preview.
- **Glass.** [measured] The glass takes the room's warm hue. The search field is recessed (L 56 vs 92 around it: black ≈ 40%). The selected row ("The Producers") is a raised rounded rectangle (L 109 vs 73: white ≈ 20–25%, radius ≈ 14 px, *not* a capsule because the row is two lines tall). Message bubbles are raised (L 141 vs 81: white ≈ 35%), with tails; the user's own bubble is solid blue.
- **Controls.** Compose and video are circles in the top corners of the right pane. The "iMessage" field is a recessed capsule ≈ 33 px with a mic glyph and a separate circular + button at its left.
- **Depth.** The window-bar pill floats under the window. The Siri orb is a glass sphere well in front of the window.
- **Maps to Steam.** Friends & Chat (friend list, chat), Notifications.

### B.5 TV app (`5.png`)

- **Screen.** A full-bleed media window (the content *is* the window: dark art, no glass), with a vertical tab bar ornament outside the left edge. Subtitles and the Siri orb below.
- **Layout.** [measured] Window ≈ 680 × 440 px (W/H ≈ 1.55); corner radius ≈ 28 px ≈ 6.4% of H.
- **Tab bar ornament.** A vertical glass capsule ≈ 26 px wide (6% of H), ≈ 218 px tall, holding 8 glyphs (search, home, …) at a pitch of ≈ 27 px. It sits **outside** the window with a gap of ≈ 1 bar width (≈ 28 px) and is vertically centred on the window. The selected tab (Home) has a lighter circular platter behind a white glyph; the rest are white ≈ 70%.
- **Controls.** A circular back button (≈ 22 px, white ≈ 15% fill) in the top-left corner, concentric with it. Three circular buttons at the top right (expand, download, share), pitch ≈ 31 px. "Play Again" is a capsule ≈ 27 px tall (6% of H) with a white ≈ 25% fill and a white glyph and label; next to it a circle of the same height (checkmark).
- **Typography.** Show logo as art. A metadata line ≈ 2.3% of H, secondary. The synopsis ≈ 2.5% of H, white, with a bold lead-in ("S1, E6 · Our History:"). Badges are small outlined boxes (the only outlines in all 12 references, and they are content glyphs, not chrome).
- **Depth.** The tab bar floats in front of and outside the window plane. Below the window a row of thumbnails continues the content.
- **Maps to Steam.** A game page (hero art, Play capsule, circular secondary actions); the main navigation (Home, Library, Store, Friends, Media, Downloads, Settings, Power) as a vertical tab bar ornament: the frame menu already lives exactly there.

### B.6 Siri card (`6.webp`)

- **Screen.** A single portrait glass card answering a question, with the Siri orb in front.
- **Layout.** [measured] Card ≈ 380 × 538 px (W/H ≈ 0.71); radius ≈ 38 px ≈ 7% of H. Close (×) at the top left and expand (↗) at the top right are circles ≈ 36 px (≈ 6.7% of H) whose centres sit ≈ one corner radius from both edges.
- **Typography.** The user's question is a raised grey bubble with a tail, right-aligned, ≈ 2.4% of H. The answer is large white text ≈ 3.2% of H, Medium weight with **Bold** emphasis, left-aligned with a ≈ 10% of W margin; the follow-up paragraph is ≈ 2.3% of H at ≈ 75% white. The text **fades out** over ≈ 7% of H instead of being clipped (a scroll-edge fade).
- **Glass.** [measured] The card is lighter than its dark, warm surroundings (L 93–108 vs 53 at the wall), is brighter near the top (L 108) than the bottom (L 93), and shows the room behind as soft blobs (heavy frost). The edge is visible as a light line along the bottom and right and as the step from sharp room to frosted room; no outline.
- **Maps to Steam.** Toasts and notifications, confirm dialogs, the tooltip, info panels, the "Press Y for more info" help.

### B.7 Safari and two other windows (`7.webp`)

- **Screen.** Three windows on an arc facing the viewer: a hiking-trail web page (left, turned toward the user and curved), Safari with the REI page (centre), a Siri card (right).
- **Toolbar ornament.** [measured] Above the Safari window floats a glass capsule (≈ 5% of the window's height tall) that **overlaps the window's top edge**. It holds circular buttons: sidebar toggle (lighter fill: active), back and forward (dim: unavailable), a long recessed URL capsule (menu glyph, mic, "rei.com", reload), share, +, more. The close button (×) and the minimise button are **separate circles** at the two ends, outside the capsule.
- **Content.** Web pages are opaque white content with rounded corners; there is no glass on content. Glass capsules ("Mark as hiked", "Pin to wishlist") float over the left page's hero image.
- **Depth.** The toolbar sits in front of the window plane. The Siri orb is in front of everything. A soft light area spreads under the Safari window [inferred: light spill or ground shadow].
- **Maps to Steam.** The Store and other Steam web views (Steam's header switches to a URL bar in browser mode); the window's frame controls (keyboard, pop-out, recenter, more) as one ornament.

### B.8 Settings (`8.webp`)

- **Screen.** Settings, Software Update, in a dark room.
- **Layout.** [measured] Window ≈ 600 × 447 px (W/H ≈ 1.34). Sidebar 215 px = 36% of W = 0.48 × H; it runs to the window's left, top and bottom edges. Sidebar rows pitch ≈ 33 px (7.4% of H) with circular coloured icons ≈ 20 px (60% of the pitch): blue for Wi-Fi, Bluetooth, VPN, Accessibility and Appearance, grey for General, purple for Apps and Environments, green for People. Trailing values ("On", "Not Connected") in secondary grey. Groups are separated by a gap of ≈ half a row, **no separators**. The search capsule floats at the top of the sidebar and the list scrolls *under* it (the Wi-Fi row is half hidden).
- **Selected row.** A raised capsule ≈ 35 px tall (≈ the row pitch), inset ≈ 8 px from the sidebar edges, white ≈ 15–20% (L 83 vs 61), white label.
- **Detail pane.** A circular back button (≈ 24 px) at the top left; the title "Software Update" is bold, ≈ 3% of H, **centred** on the same line. Grouped rows sit in a recessed rounded platter (radius ≈ 14 px; L 58 vs 62 around it) with an inset hairline between rows and a trailing value + chevron in secondary grey. Status block centred: a check glyph, a bold line, a secondary line, then a small capsule "More Details" whose label is blue (the one coloured label in the set).
- **Glass.** [measured] In a dark room (wall L 41–69) the glass reads L 61–63: **lighter than the room**. The sidebar is a slightly different (warmer) tone, no divider. A soft blue light pools on the grouped rows [inferred: room light or the gaze-hover glow].
- **Affordances.** The finger points at the bottom-right corner, where a small curved resize handle has appeared. The window-bar pill floats below the centre.
- **Maps to Steam.** Steam Settings and SteamVR Settings (`/settings/*`, systemui settings panels).

### B.9 Environments picker (`9.webp`)

- **Screen.** "My Environments": circular environment thumbnails floating over a snowy environment, no panel.
- **Layout.** [measured] Circles ≈ 65–68 px, column pitch ≈ 125 px (diameter / pitch ≈ 0.53), row pitch ≈ 105 px (0.84 × column pitch), alternate rows offset by half a pitch: the same hexagonal lattice as Home. Title "My Environments" bold, centred ≈ 45 px above the first row. Labels below each circle, secondary.
- **Controls.** "Add Environment" is a glass circle with a white +. The thumbnails have a bright rim along their top edge.
- **Depth.** Items at the left and right periphery are blurred and faded (opacity ≈ 0.3–0.5, like a shallow depth of field): the paging cue. Page dots below.
- **Maps to Steam.** Launch Program; Collections; SteamVR's environment and home picker.

### B.10 Home grid in an office (`10.webp`)

- Same lattice and label rules as B.1 [measured]. Seven page dots below the grid. One icon (Siri) is a spherical glass object; the others are flat discs with a top highlight. The grid curves around the viewer, so outer icons look rotated. Labels stay legible over a busy room through their shadow alone.
- **Maps to Steam.** As B.1.

### B.11 Music above TV (`11.webp`)

- **Screen.** The Music app's Search page with a vertical tab bar ornament on the left and a playback ornament on its bottom edge; below it a TV window with its own tab bar.
- **Layout.** [measured] Tab bar ≈ 26 px wide (≈ 8% of the window's height), 6 glyphs at a pitch of ≈ 26 px; the selected tab (search) has a lighter circle behind it. It floats ≈ one bar width outside the left edge, vertically centred. Category tiles are content: rounded rects (radius ≈ 20% of their height), 3 columns, white semibold labels at the lower left.
- **Playback ornament.** A glass capsule ≈ 75% of the window's width, **straddling the bottom edge** (about half of it below the edge). Inside: transport glyphs (previous, play, next), a nested capsule with artwork, a bold title and a secondary artist line plus a "…" button, then three trailing glyph buttons (lyrics, queue, volume). The window content shows through it, blurred.
- **Glass.** [measured] Over a white wall (L 132) the window glass is L 130: almost the same luminance, but frosted (room texture gone). Over bright rooms visionOS glass becomes light grey, not dark.
- **Maps to Steam.** Media; Now Playing (SteamVR); the dashboard bar as a bottom ornament; the main navigation as a tab bar.

### B.12 Widget gallery (`12.png`)

- **Screen.** A sidebar list of apps (each with its rounded-square app icon) and a preview of the chosen widget with "Add Widget".
- **Layout.** [measured] Sidebar rows pitch ≈ 33 px with ≈ 20 px rounded-square icons; the search capsule (recessed) at the top; the selected row "Weather" is a raised capsule (L 99 vs 89). The preview pane has a centred bold title "Forecast", a centred secondary subtitle, the widget (a rounded square with a light bezel frame), a small "Add Widget" capsule with a + glyph, and two page dots.
- **Glass.** [measured] Against a light grey wall (L 105) the glass is L 89–98, very translucent and light. White text on it is low-contrast but legible because of frost and a slight darkening. The window-bar pill is bright white (the window is being looked at) [inferred].
- **Maps to Steam.** Collections, the Properties pages, Add to collection, controller layout pickers.

---

## Part C. Consolidated measurements

### C.1 Windows

| trait | references | value | Steam target (720 px window) |
|---|---|---|---|
| corner radius | 2, 5, 6, 8 | 6.4–7.5% of H | 48–56 px (today 32) |
| aspect | 2, 4, 5, 8 | 1.16–1.55 (main windows); 0.62–0.71 (tiles, cards) | keep 16:9 for main; tiles and cards portrait |
| sidebar width | 2, 8 | 0.45–0.48 × H (36–38% of W in these narrower windows) | 320–345 px (today ≈ 242) |
| sidebar edge | 2, 4, 8, 12 | a tone shift of a few % luma, full height, no line, no inset box | same |
| content padding | 2, 6 | ≈ 4% of W; text margin up to 10% of W on cards | 40–56 px |
| corner buttons | 2, 5, 6, 8 | circles ≈ 5–6.7% of H, centre ≈ (R, R) from the corner | 56–60 px circles, concentric |
| title | 4, 8, 12 | large title left-aligned ≈ 4.5–5% of H, or nav title centred ≈ 3% of H, Bold | 34–38 px / 24–26 px Bold |
| window bar | 2, 4, 8, 12 | pill ≈ 13–16% of W wide, ≈ 1.5% of H thick, 1.5–2% of H below, centred; grey at rest, bright white when the window is looked at (12) | SteamVR's grab handle, restyled to this |
| close | 3, 6, 7 | circle ≈ 12% of a tile's width, centred below, or a separate circle at the end of the top toolbar | — |

### C.2 Ornaments

| ornament | references | size | position |
|---|---|---|---|
| vertical tab bar | 1, 5, 11 | capsule 6–8% of H wide; items on a pitch ≈ 1.0–1.05 × its width; ≤ 8 items | outside the leading edge, gap ≈ 1 bar width, vertically centred |
| top toolbar | 7 | capsule ≈ 5% of H tall; circular buttons; a recessed field inside | over the top edge, overlapping it; close and minimise as separate circles at the ends |
| bottom (playback) | 11 | capsule ≈ 75% of W wide, ≈ 13–15% of H tall; nested capsule for the track | straddles the bottom edge, about half below it ([bible] overlap 20 pt) |
| selected tab | 5, 11 | a lighter circle (white ≈ 20%) behind a white glyph; rest glyphs white ≈ 70% | — |

### C.3 Controls

| control | references | shape and size | fill |
|---|---|---|---|
| icon button | 2, 4, 5, 6, 7, 8 | circle, 5–6.7% of H | raised, white ≈ 15–20%; active toggle lighter (≈ 30%) |
| text button | 4, 5, 8, 12 | capsule, same height as icon buttons | raised, white ≈ 15–25%; label white (one blue link label in 8) |
| primary action | 5 | capsule with glyph + label (Play) | raised white ≈ 25% (no colour on the TV page) |
| toggle button (on/off) | 3 | circle, 17% of tile width | on: solid blue + white glyph; off: dark glass |
| slider | 3 | capsule 11–12% of tile height | fill near-white with a dark glyph at its start; track recessed |
| search / input field | 2, 4, 7, 8, 12 | capsule 5–6.5% of H | recessed (black ≈ 10–40%), glyph + placeholder at ≈ 55–60% white, regular (not italic) |
| list row, selected | 4, 8, 12 | capsule (one line) or rounded rect r ≈ 14 px (two lines), inset ≈ 8 px | raised, +30–40 L (white ≈ 18–25%) |
| grouped rows | 8 | recessed rounded platter, inset hairlines, trailing value + chevron | black ≈ 5–15% |
| inner platter | 3 | concentric rounded rect | black ≈ 30% |
| bubble | 4, 6 | capsule-like with a tail | raised white ≈ 25–35%; own message blue |
| badge | 1, 10 | red capsule ≈ 28% of the icon diameter | solid red, white bold numerals |
| page dots | 9, 10, 12 | 4–5 px dots, current one brighter | — |

### C.4 Lists and grids

| pattern | references | numbers |
|---|---|---|
| sidebar, one-line rows | 8, 12 | pitch ≈ 7.4% of H; leading icon ≈ 60% of the pitch (circle or rounded square); groups separated by ≈ half a row of space |
| list, two-line rows | 2, 4 | pitch 11–15% of H; avatar or thumbnail ≈ 50–65% of the pitch |
| avatar grid | 4 | circles ≈ 15% of H, 3 per row, names below |
| circular launcher | 1, 9, 10 | diameter / column pitch 0.52–0.55; row pitch ≈ 0.84 × column pitch; alternate rows offset ½ pitch; label cap ≈ 11% of the diameter; page dots; faded, blurred edge items |
| content tiles | 11 | rounded rects r ≈ 20% of their height, 3 columns, gap ≈ 9% of the tile width |

### C.5 Type (relative to the window height H)

| role | size | weight | colour | alignment |
|---|---|---|---|---|
| clock / hero numeral | 16–18% of tile height | light or regular | white | centred |
| large title | 4.5–5% | Bold | white | leading |
| nav title | ≈ 3% | Bold | white | centred |
| card answer / headline | ≈ 3–3.2% | Medium, Bold for emphasis | white | leading |
| row title | 2.5–3% | Semibold/Bold | white | leading |
| body / preview | 2.3–2.5% | Medium | white ≈ 70–75% | leading |
| secondary / trailing values / dates | 2–2.3% | Medium | white ≈ 50–60% | trailing for values |
| caption | ≈ 1.6–2% | Medium | white ≈ 55–60% | centred under content |

No uppercase, no letter-spacing, no italics anywhere. Colour in text only for the blue link label in reference 8.

---

## Part D. The glass, quantified

### D.1 Luminance against the room [measured]

| image | room behind / around | room L | glass L | change |
|---|---|---|---|---|
| 2 | dusk sky | 118 | content 62, sidebar 86 | −48% / −27% |
| 3 | sky | 123 | tile 88–92, platter 61 | −27% |
| 12 | light grey wall | 105 | 89–98 | −7 to −15% |
| 11 | white wall | 132 | 130 | −2% |
| 6 | dark warm room | 53 | 93–108 | **+75 to +100%** |
| 8 | dark room | 41–69 | 61–63 | **+0 to +50%** |
| Steam Frame today (computed: `rgba(20,22,30,.72)` over the room) | dark room | 40 | ≈ 26 | −35% |
| | bright room | 120 | ≈ 49 | −59% |

So visionOS glass **converges toward a mid band** (roughly L 55–110) and keeps the room's hue. Steam's current glass only darkens.

### D.2 Frost [measured]

Room-texture standard deviation outside → inside the glass: 9.5 → 2.7 (3), 25 → 4 (8), 46 → 1.5 (8), 13 → 3.5 (12). The glass removes **80–95%** of the room's local contrast while keeping its large-scale brightness and colour (in 6, the chair and fireplace are still readable as soft blobs). The current CSS glass cannot blur the room at all (`backdrop-filter` sees only the page), so it keeps 100% of the room's detail at 28% strength; see `shots/hud_keyboard_hover_after_rooms.png`, where a bright window behind the keyboard shows as a sharp rectangle.

### D.3 Edge anatomy (how an edge is visible without an outline) [seen in 2, 3, 6, 8, 12]

1. **Material step:** sharp room outside, frosted and re-lit room inside. This alone defines the silhouette.
2. **Top specular:** a thin bright line (≈ 1–2 px at capture scale) along the top edge, brightest at the top-left and top-right corner arcs.
3. **Side falloff:** the line fades to nearly nothing down the vertical sides.
4. **Bottom lip:** a faint light line along the bottom edge (light passing through the slab's lower bezel).
5. **Top-down sheen:** the slab is slightly brighter at the top than the bottom (6: L 108 top vs 93 bottom).
6. **No outer stroke, no inner uniform ring, no visible drop shadow on the room** in these captures (a soft light or shadow area may appear on the floor under a window [inferred from 7]).

### D.4 Fill polarity [measured]

| element | vs glass around it | equivalent |
|---|---|---|
| grouped-row platter (8), inner platter (3) | −4 to −30 L | black 5–30% |
| search / input field (2, 4) | −7 to −37 L | black 10–40% |
| selected sidebar / list row (4, 8, 12) | +10 to +36 L | white 15–25% |
| bubble (4) | +60 L | white ≈ 35% |
| icon button | — | white ≈ 15–20% [seen] |
| slider fill (3) | L 208 | white ≈ 85–90% |

**Recessed = containers and inputs; raised = things you press or have selected.**

### D.5 Hue

The glass takes the room's hue (blue-violet in 2, 3, 9; amber in 4, 6, 8; neutral grey in 11, 12). Grey selection pills slightly *desaturate* that hue (4: the selected row is neutral grey on amber glass). A fixed blue-grey tint, as Steam has today, reads as a screen, not a material.

---

## Part E. Traits a Steam Frame redesign must reproduce, ranked by impact

Each trait has a target in Steam units and a check an agent can run without a human. "Tier" is the likely implementation tier from the brief (T1 CSS + layout, T2 DOM augmentation, T3 new Steam React views, T4 compositor, T5 glassd); the capability results in `docs/phase2/capabilities/` decide what is actually possible.

| rank | trait | target | how to verify | likely tier |
|---|---|---|---|---|
| 1 | **Frosted, adaptive glass** behind every window, panel and ornament | Glass luma inside the band L 55–110 whatever the room; room-texture sd reduced ≥ 80%; hue follows the room | `hvgrab` frames (look, then delete): sample L and sd inside vs outside the window as in D.1–D.2; glassd debug dumps of the backdrop | T5 (CSS cannot see the room) |
| 2 | **No outlines.** Edges come from the material and a light-from-above specular rim | No uniform `inset 0 0 0 1px` rings, no `outline`, no `border` on glass. Rim: top edge white ≈ 0.35–0.5 over 1–2 px, top corners brightest, sides ≤ 0.08, bottom ≈ 0.1 | Grep theme tokens; pixel-profile a vertical and a horizontal line across each edge in shots: the top profile has a peak, the side profile is flat | T1 (rims), T5 (real specular) |
| 3 | **Chrome as corner buttons and ornaments, not bands** | Circular back at the top-left corner, centre ≈ (R, R); centred nav title; search as a capsule inside content or a top ornament; tab bar as a vertical capsule outside the left edge; no full-width header or footer strip | Shots of every route: no element wider than 50% of the window and shorter than 60 px at the top or bottom edge | T1 layout, T3, T4 |
| 4 | **Size by visual angle** | Hit targets ≥ 80 px (2.5°) or ≥ 60 px visible with ≥ 80 px hit area; icon buttons 56–60 px circles; capsules 56–60 px tall; sidebar rows 60–64 px; body ≥ 20 px; nothing interactive < 44 px | `glass.py audit` (SHRUNK must stay 0) plus a size scan of every `.Focusable` / `[role=button]` rect via `outline` | T1 layout |
| 5 | **Selection and focus are light, not white blocks and rings** | Selected nav row: raised capsule +30–40 L (white ≈ 20%), white label. Focus (gamepad and laser): brighter still (+45–60 L) with a soft glow and a lift; no hard ring. Solid white + dark label only for on-state toggle buttons and the selected segment of a segmented control | Shots with `L.pad` moving focus over each control: focused vs rest luma delta ≥ 40 L inside the control and visible over a dark and a bright room (D.1 rooms) | T1, T4 (lift) |
| 6 | **Title-case visionOS type** | Body Medium 20–22 px, titles Bold 26–38 px, secondary white ≈ 0.55–0.62, tertiary ≈ 0.38–0.45; `text-transform: none`; no letter-spacing; no italics | `styles` on text runs: no computed `text-transform: uppercase`, `font-style: italic` or `letter-spacing > 0` in chrome | T1 |
| 7 | **Concentric, rounder geometry** | Window radius 48–56 px; inner platter radius = window radius − padding; controls are capsules or circles; thumbnails r ≈ 18–20% of their height | `styles` on containers; visual check of corners in shots | T1 |
| 8 | **Fill polarity** | Containers and inputs recessed (black 10–30%); buttons, selected rows, bubbles raised (white 15–35%); never a second blurred glass inside a window | Sample fills against the glass in shots | T1 |
| 9 | **Depth hierarchy** | Ornaments and toolbars 2–4 cm in front of the window; menus and sheets ≈ 3 cm; focused content lifts ≈ 8 mm; text never gets its own depth | `hvgrab` stereo checks / scene-graph dumps of `dz` per layer | T4 |
| 10 | **Spatial launchers** | Launch Program (and similar pickers) as floating circles without a panel: hexagonal lattice, diameter / pitch 0.52–0.55, row pitch 0.84 × column pitch, labels below (cap ≈ 11% of the diameter), page dots, edge items faded | Shot of the launcher; measure centres | T3 or T4 (barpopup is a 300 px wide surface) |
| 11 | **Quick Access as tiles** | Separate portrait tiles (aspect 0.62–0.65) with gaps 6–9% of tile width; circular toggle buttons (blue fill when on); capsule sliders 11–12% of tile height (≈ 56–60 px) with the glyph inside the fill; one close button below | Shot of each QAM tab; slider rect heights | T1 layout / T3 |
| 12 | **Sidebars run to the edges** | Full-height tone shift, no inset box, no rim, no divider; width 320–345 px; groups separated by space; coloured circular icon chips | Shot of `/settings/*` | T1 |
| 13 | **Scroll-edge fades** | Lists scroll under floating search capsules and toolbars; text fades out over ≈ 7% of the container instead of hard clips or opaque bands | Shots scrolled mid-list | T1 (mask-image on scrollers, where Steam does not use it) |
| 14 | **No motion at rest; materialize on entry** | No pulsing focus, no looping effects (Phase 1 already holds Steam's pulse steady); panels materialize (scale ≈ 0.94 → 1 with blur and lensing ramping in) on a spring | Two shots 1.5 s apart with focus still: identical pixels | T1 (override animations), T5 (lens ramp) |
| 15 | **Content stays content** | Game art, store pages, web views, hero images: opaque, rounded, never tinted or frosted | Visual check | T1 |

---

## Part F. Do and don't

**Do**

- Let the glass carry the edge: material step plus a top-lit specular rim that fades down the sides.
- Pull the glass toward a mid luminance and the room's hue; frost the room behind it.
- Put back, close, title and actions in the window corners and centre line; put navigation in a vertical tab bar ornament; put transport and window actions in capsule ornaments over the top or bottom edge.
- Make every target at least 2.5° (≈ 80 CSS px) and every visible control at least ≈ 56 px.
- Use circles for icon buttons and capsules for text buttons and fields.
- Show selection as a translucent light platter and focus as a brighter, glowing, lifted platter.
- Use recessed fills for containers and inputs and raised fills for things you press.
- Write in title case, Medium for body, Bold for titles, white at three vibrancy levels.
- Keep corners concentric; place corner buttons on the corner's centre.
- Float launch-type choices as circles on a hexagonal lattice with labels below.
- Fade content at scroll edges.
- Keep game art, store pages and web content opaque and rounded.
- Keep the one coloured element per screen a whole fill (blue on-toggles, the green Play capsule if kept, red badges).

**Don't**

- Don't draw a border, outline or uniform 1 px ring around any glass, menu, panel or capsule.
- Don't draw focus as a hard white ring, and don't pulse it.
- Don't use solid white + dark label for navigation selection.
- Don't run a header or footer band across the full window width; don't put search in a full-width strip.
- Don't use uppercase, letter-spaced or italic labels in chrome.
- Don't nest a separately rimmed glass box (a sidebar card, a list card) inside the window glass.
- Don't make grouped sections lighter than the glass; containers recess.
- Don't leave controls at 30–42 px: that is ≈ 1–1.3°, half the visionOS target.
- Don't show the room through the UI unblurred.
- Don't stack several rows of small separate chrome under the window.
- Don't animate at rest (stock Steam pulses focus 20 × 1.2 s; Phase 1 holds it steady, and Phase 2 must keep that).
- Don't give text its own depth or glass.

---

## Part G. The Steam Frame today (Phase 1 theme on)

### G.1 Captures made for this comparison

| file | surface and route |
|---|---|
| `shots/p2_ref_current_home.png` | main, `/library/home` |
| `shots/p2_ref_current_settings_display.png` | main, `/settings/display` |
| `shots/p2_ref_current_allgames.png` | main, `/library/tab/AllGames` (laser-mode Sort/Filter pill visible) |
| `shots/p2_ref_current_bar.png` | bar |
| `shots/p2_ref_current_launchlist.png` | barpopup, "+ > Launch Program" open |
| `shots/p2_ref_contact_sheet.png` | references 8, 1, 3, 5 next to settings, Launch Program, Quick Access (`bar_qam_settings_after.png`) and home |

One headset-view frame (`native/spike/hvgrab`) was taken to see the UI over the room. It showed the room, so it was deleted from the PC and the headset right after looking. What it showed:

- The main window spans ≈ 38° (≈ 39% of the captured frame) and reads as a **dark slab**: the room is barely visible through it.
- SteamVR curves the window, which matches visionOS 27's curved windows.
- The collapsed **frame menu** is a vertical strip of icons outside the window's left edge: already the position and shape of a visionOS tab bar ornament.
- Under the window there are **four separate rows of chrome**: the frame controls (keyboard, pop-out, recenter, more), the floating footer legend ("Grab view / Laser mouse"), the dashboard bar (Steam circle + a long capsule), and a grab-handle line. visionOS has one window-bar pill (and a close button).
- Tab pills and footer labels are ≈ 1° tall in the view.

### G.2 Current sizes (CSS px, from the 1.5× shots)

| element | today | angle | visionOS-equivalent target |
|---|---|---|---|
| header | 40 px band; Back pill 93 × 32; search capsule ≈ 1160 × 32, italic placeholder | search 1.0° tall, 36° wide | circular back 56–60; search capsule 56–60 tall, ≤ 50% of W |
| home segmented tabs (WHAT'S NEW…) | capsule 342 × 41; segment 113 × 33; 12 px bold uppercase | 1.0–1.3° | 56–60 tall, title case 18–20 px |
| tab-row arrows | 31 px circles | 1.0° | 56–60 |
| library tab row / sub-tabs | 41 / 45 px tall capsules, 12–14 px uppercase | 1.3–1.4° | sidebar or tab ornament rows 60–64 |
| library capsules | 172 × 258 | 5.3° × 8° | already large enough (content) |
| footer legend | 35 px capsule, 12 px uppercase | 1.1° | keep for gamepad, restyle as a quiet ornament |
| settings sidebar | inset box ≈ 242 px wide (0.34 × H) with its own rim; rows 42 px; 16 px labels; monochrome glyphs | rows 1.3° | full-height, 320–345 wide; rows 60–64; coloured icon chips |
| settings selected item | white capsule 227 × 41 + ring, dark label | — | raised light capsule, white label |
| settings dropdown | 39 px capsule | 1.2° | 56–60 |
| dashboard bar | 80 px tall; Steam circle ≈ 79; small buttons ≈ 43; **+ ≈ 30**; clock 22 px | + 0.9° | buttons 56–60, + ≥ 56 |
| Launch Program | 300 px wide list, 40 px rows, **16 px icons**, separators | icons 0.5° | floating circles ≥ 96 px |
| Quick Access sliders | track ≈ 4 px, knob ≈ 24 px | track 0.1° | capsule 56–60 px with the glyph in the fill |
| window corner radius | 32 px (4.4% of H) | — | 48–56 px (≈ 7% of H) |
| body text | 16 px Motiva Sans Regular | 0.5° | 20–22 px Medium |

### G.3 The biggest gaps, ranked

1. **Material: tinted transparency instead of frosted glass.** The window and panels are `rgba(20,22,30,.60–.84)` (`--lgs-window-bg`, `--lgs-panel-bg`). Over a dark room the window is about half as bright as visionOS glass (L ≈ 26 vs 55–65), over a bright room the room's detail shows through sharply (`hud_keyboard_hover_after_rooms.png`), and the hue never follows the room. This is the single largest "not visionOS" cue in the headset. (T5 glassd cover; NATIVE.md's design already targets it.)
2. **Outlines everywhere.** `--lgs-window-rim`, `--lgs-panel-rim` and `--lgs-glass-rim` each end in `inset 0 0 0 1px rgba(255,255,255,.07–.09)`, a uniform ring the user called out ("menus shouldn't have clear outlines"). Focus is a 2 px white ring plus a glow (`--lgs-focus-ring`, and a 2 px outline on `%{FocusRing}`). The active settings page and the active frame-menu item are white capsules with dark labels, and focus adds the ring on top (`p2_ref_current_settings_display.png`, `bar_framemenu_focus_after.png`).
3. **Header and footer bands.** The top of every route is a 40 px strip: a "Back" text pill and a 1160 × 32 px search strip with an italic grey placeholder. It reads as a browser address bar, which is exactly the "window into a different app" the user described. The footer legend is a second strip. visionOS has neither.
4. **Undersized controls.** Tabs (33–41 px), arrows (31), the + button (30), Back (32), footer legends (35), settings rows (42), dropdowns (39), Launch Program rows (40, with 16 px icons) and QAM slider tracks (4) are all 0.1–1.3°, against visionOS's 1.8° visible buttons and 2.5° targets.
5. **Uppercase micro-type.** Tabs, tab counts, footer legends, "NO PLAYTIME YET" and section labels are 12 px bold uppercase with letter-spacing. visionOS has no uppercase chrome.
6. **White selection.** Selected tabs, the selected sub-tab ("ALL"), the selected settings page and the selected QAM tab are solid white capsules with dark text. In visionOS these are translucent light platters with white labels; white is far too loud at this scale.
7. **Launch Program is a list, not a launcher.** A narrow 300 px panel of 40 px rows with 16 px icons, against visionOS Home's floating circles (references 1, 9, 10). The barpopup surface is 300 × 1024 px, so a Home-style launcher needs another surface (T3 view in `main`, or T4 own panel).
8. **Quick Access is one settings-style panel.** Thin sliders with round knobs, a bottom tab strip with a white selected circle, section headers; against Control Center's separate tiles with circular toggles and fat capsule sliders (reference 3).
9. **Settings sidebar is a box inside the window.** It is an inset, separately rimmed rounded rect 0.34 × H wide with monochrome glyphs; visionOS's sidebar runs to the window edges as a tone shift, is 0.45–0.48 × H wide, and uses coloured circular icon chips. Grouped sections are lighter than the glass (white 6%); visionOS recesses them.
10. **Too many strata of chrome under the window.** Frame controls, floating footer, dashboard bar and grab handle are four separate rows. visionOS's answer is one window bar (+ close) and ornaments attached to the window they belong to.
11. **Library chrome.** An uppercase tab row with arrows, a segmented sub-tab pill, a laser-mode Sort/Filter pill and a footer legend stack above and below the grid. visionOS would put the tabs in a sidebar or a tab ornament and the sort/filter in a toolbar capsule.
12. **Everything is on one plane.** Apart from Steam's own `translateZ` on focused capsules, no control floats. visionOS floats ornaments, toolbars, the window bar and menus in front of the window.
13. **Corner radius too small.** 32 px (4.4% of H) against 6.4–7.5% in the references.
14. **Motion (mostly solved in Phase 1; keep it that way).** Stock Steam pulses its focus ring and capsule outline 20 × 1.2 s. Phase 1 already holds `%{FocusRing}` at opacity 1 (`10-primitives.css` §10) and replaces the capsule outline pulse with a steady ring (`40-library.css`). Steam's one-shot focus shine on capsules remains (feedback on a state change, which the bible allows). Phase 2 must not reintroduce rest motion when it replaces the rings, and should add *materialize* entries (the references are stills and say nothing more about motion).
15. **Hard clips and bands at scroll edges.** The pinned tab row gets an opaque blurred band (`%{TabHeaderRowWrapper}::before`), the header has its own band, and lists clip hard; visionOS fades content under floating controls.

What already matches: the window's curvature (SteamVR), the frame menu's position as a left-edge vertical strip, Steam's portrait game art as opaque rounded content, the dashboard bar's capsule shape and its circular Steam button, the green Play and blue/red semantic whole fills, and the theme's white text vibrancy levels (0.96 / 0.72 / 0.56, slightly brighter than visionOS's secondary ≈ 0.55–0.62).

---

## Part H. Tensions and open questions

1. **Gamepad focus has no visionOS equivalent in these references.** visionOS shows a soft gaze-hover glow and never a persistent focus. Steam's controller model needs a focus that is obvious at 1.4 m in every state. Proposal: a raised platter clearly brighter than "selected" (≥ +45 L over the glass), a soft outer glow, and a lift (T4 `dz` ≈ 8 mm, or `scale` ≈ 1.03 on content cards only), with no hard ring. It must pass a measurable check (rank 5 in Part E) in shots over a dark and a bright room.
2. **The bible says "white fill + black label = selected".** The references show navigation selection as a translucent platter (Settings, Messages, widget gallery, tab bars), and none shows a white-filled navigation item. Suggested reading: white is for *on-state buttons* and the *selected segment of a segmented control*; navigation selection (sidebar rows, tab bar items) is a translucent light platter. This needs a decision by whoever owns the bible and `00-tokens.nowrap.css`.
3. **Angle versus proportion.** Sizing by angle makes every control ≈ 1.3–1.5× larger in a window whose physical size Steam fixes (≈ 0.98 m). That means fewer items per row and more scrolling, inside Steam's virtualized lists and carousels. The capability work must confirm which layout changes keep `FocusNavController` and virtualization correct.
4. **Uppercase strings.** Checked live: the home tab's text is "What's New" and the footer legend's is "Back"; both are uppercased by CSS (`text-transform: uppercase; letter-spacing: .5px; font: 700 12px`), which T1 can undo. Any string that is uppercase in Steam's localization itself will stay uppercase; check other labels one by one.
5. **Font.** visionOS uses SF Pro (Medium body, Bold titles). The `main` window has Motiva Sans loaded at weights 100, 300, 400, 500, 700 and 800 (checked live through `document.fonts`); SF cannot be shipped. Use Motiva Sans 500 for body and 700 for titles; the weight shift matters more than the face.
6. **Coloured icon chips in sidebars.** They are a strong Settings cue (reference 8) but need T2 decoration (a background on Steam's icon container, never a new node in the focus tree) and a colour per page. Keep them decorative.
7. **Launchers outside barpopup.** The + list lives in a 300 px wide popup. A Home-style launcher needs a wider surface or a native panel; input routing to T4 panels is not proven (the brief: crops must stay at their original x/y unless routing is proven).
8. **Capture limits.** The references are photos and videos of a headset; colour values include camera exposure. The luminance band (D.1) and frost ratio (D.2) are directional targets, to be tuned on the Frame with `hvgrab` frames, not copied.
9. **Motion.** The references are stills, so they show nothing about animation. Motion rules here come from the bible (materialize, springs, no rest motion), not from these images.
