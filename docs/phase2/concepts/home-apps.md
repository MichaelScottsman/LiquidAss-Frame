# Concept: Home view and App Library (`concepts/home-apps.md`), revision 2

This concept redesigns everything a user launches from:

- Steam's Library home;
- the library catalogue (tabs, grid, sort, filter, collections);
- search, as a way to find anything you can launch;
- the dashboard bar's "+" popup (Add Desktop Window / Launch Program).

Games, Steam shortcuts and desktop programs become one visionOS-style app-selection experience.

Revision 2 answers the critic's review (score 6) point by point (§17). The main changes:

- **Real glass on the windowless Home without ghosts.** Every plate gets its own glassd cover shape, and only the focused item pops (§10).
- **window-nav owns search.** This concept contributes an Apps cell and X = Play (§6).
- **What's New is its own route**, so LB/RB mean one thing on Home (§3.6).
- **The Liquid Glass switch lives only in the "+" popup** (§4, §5).
- **A card ramp with an 80 px action pitch and hysteresis**, driven by focus (§3.4).
- **A "+" popup that shows all 23 programs** without scrolling (§4).
- **A library ornament specified per input mode** (§7).
- **Mockups built from the Frame's real data** (§0.2).

Built on `docs/phase2/DESIGN2.md` (cited **D2 §n**). Other sources:

| Short name | Document |
|---|---|
| **LA** | `audit/library-apps.md` |
| **SN** | `audit/shell-nav.md` |
| **SR** | `capabilities/steam-react.md` |
| **SP** | `capabilities/spatial.md` |
| **E2E** | `capabilities/native-e2e.md` |
| **WN** | `concepts/window-nav.md` (owner of the window, toolbar, bottom ornament, sheets and search) |
| **CC** | `concepts/control-center.md` |
| **VR** | `research/visionos.md` |
| **REF** | `research/references.md` |
| **MO** | `research/liquid-glass-motion.md` |
| **INV-L**, **INV-B**, **INV-S** | `docs/inventory/library.md`, `bar.md`, `shell.md` |
| **NATIVE** | `docs/NATIVE.md` |

The reference shots are `docs/refs/visionos/1–12`.

---

## 0. Mockups, units and data

### 0.1 Mockups

All mockups are true size with `mockups/kit.css`. They use window-nav's shared chrome (`window-nav-shared.css/js`) for the tab bar, window, toolbar, ornament, frame controls and bar, so both concepts render the same scene. Shared pieces are in `mockups/home-apps.css`, `home-apps.js` and `home-apps-icons.js`.

| Mockup | Render | Shows |
|---|---|---|
| `home-apps-home.html` | `p2_home-apps_home.png` | Home › Recent, page 1 of 2, with the real 12 most recent games plus All Games. Rise of the Tomb Raider is focused and has opened into its card; the laser is on Play |
| `home-apps-home-t1.html` | `p2_home-apps_home-t1.png` | The same Home on the CSS-only path (no glassd): plates are tint plus edges, never frost |
| `home-apps-apps.html` | `p2_home-apps_apps.png` | Home › Apps: the real launch list A–Z (23 programs, Liquid Glass not among them). Frametop Display Settings is focused, with its name plate |
| `home-apps-collections.html` | `p2_home-apps_collections.png` | Home › Collections: the real collections; the 8 empty ones are grouped in one dimmed folder |
| `home-apps-folder.html` | `p2_home-apps_folder.png` | The real "VR" collection (27 games) opened as a folder route, page 1 of 3 |
| `home-apps-plus.html` | `p2_home-apps_plus.png` | The bar's "+" popup (T3): 4 columns, all 23 programs visible, the full-name plate on focus, the Liquid Glass toggle row |
| `home-apps-plus-t1.html` | `p2_home-apps_plus-t1.png` | The same popup with T1/T2 only: Steam's list in Steam's real scan order, with Liquid Glass as a normal cell carrying a green "on" pip |
| `home-apps-search.html` | `p2_home-apps_search.png` | window-nav's search summary for "half" with this concept's two contributions: an Apps cell and an X = Play legend |
| `home-apps-library.html` | `p2_home-apps_library.png` | Library, laser mode: More circle inside the hovered poster, the tile menu grown from it, and the laser-mode ornament |
| `home-apps-library-pad.html` | `p2_home-apps_library-pad.png` | Library, gamepad mode: focused poster and the legend ornament, in the same fixed slots |
| `home-apps-filter.html` | `p2_home-apps_filter.png` | Library Filters as window-nav's 960 px sheet, with Steam's real options |
| `home-apps-depth.html` | `p2_home-apps_depth.png` | Depth and glass on Home without ghosts: covered plates, a pop only on focus, and the static check |

### 0.2 Real data, not invented data

The mockups read the Frame's own data, fetched read-only by `mockups/fetch-library-refs.py`.

**What the script reads:**

- `collectionStore` and `appStore` over CDP;
- `ScanForInstalledNonSteamApps(true)`, the same scan Steam's "+" runs on every press;
- art files over SFTP.

**Where the data goes.** It writes to `docs/refs/library/`. That folder is git-ignored, because the art is third-party (see `mockups/assets/LICENSE.md`). Without it, every element falls back to a monogram or a glyph with the same real name.

**What the real data changed:**

| Finding | Effect on the design |
|---|---|
| 15 of the 20 Recent items are non-Steam shortcuts (Quest ports) with custom hero and logo art; SteamVR (a tool) is in Recent too | Icons composite hero + logo from Steam's custom-art methods, not only from Steam's cache (§3.3) |
| Names are long ("Halo: Combat Evolved VR (Native)", "Assassin's Creed Nexus VR") | One-line labels truncate 5 of 12 on page 1; the card and name plate carry the full name (§3.4) |
| 3 programs share one monitor icon (Frametop Display Settings, Full SBS Toggle, Half SBS Toggle); 5 have no icon; 6 icons are Steam's 64 px upscales of 32 px files | Labels carry identity; glyphs stand in for missing icons; icons are drawn at their source size (§3.3) |
| 8 of 9 user collections are empty (Steam ROM Manager) | One "Empty Collections" folder instead of 8 dead circles (§3.2) |
| In the 300 px popup, 11 of 23 names cannot fit two lines at the 15 px floor | A word-aware label fitter plus the full-name plate on focus (§4) |
| Steam's grid shows no title under a focused tile, only a compatibility badge | The library keeps that: no caption, badge restyled (§7) |
| Skyrim VR has no logo | The text fallback shows; acceptable, honest |

### 0.3 Units

- Sizes are main-window CSS px, with visionOS points in brackets (1 pt = 4/3 px, D2 §2.1).
- Popup sizes are in that popup's own px, with the main-window equivalent obtained by dividing by m = 0.83 (D2 §2.5).
- Depths are in mm, and in scene units at r = 1 (units = mm × 0.00271, D2 §2.6).
- Off-axis shift of a pop: dz × tan 35° = 0.70 × dz mm, which is 0.91 × dz CSS px (0.77 mm per px).

---

## 1. The experience

### 1.1 Today

**Home.** Summoning the dashboard lands on Steam's Home:

- a strip of 20 recent games, whose first tile grows sideways when focused;
- below it, a storefront (sale banner, Trending, Special Offers, Discovery Queue).

**Desktop programs** live somewhere else entirely:

- a 300 px desktop context menu above the bar's "+";
- 16 px icons in 40 px rows, unsorted;
- 10 of 24 rows below the fold;
- the Liquid Glass switch in whichever row the scan put it.

**The library.** The 350-game catalogue is a 59-row scroll framed by bands of 12 px uppercase chrome.

**Search** is a 40 px grey strip (LA §B, SN §B).

### 1.2 Phase 2

1. **Your things are in the room.** There is no window on Home.
   - Your recent games float as 120 px glass discs on the visionOS honeycomb (4-5-4, 13 per page). Each disc shows the game's art inside a thin lensing bezel.
   - Above them, a slim centred segmented control offers Recent, Collections and Apps. To its right are a What's New button and a search circle.
   - The Steam tab bar hangs at your left.
   - Everything sits on one plane, as on visionOS Home.
2. **Look at a game and it lifts toward you.**
   - Focus (gamepad, or the laser's hover, which moves Steam's focus) scales the disc ×1.10 and pops it 15 mm forward.
   - Hold it for 0.8 s and the disc opens into a glass card: the game's hero art and logo, a green **Play** capsule, a **More** circle, the title, compatibility and playtime.
   - A still opens the game page, as it always has.
   - X is Play straight away.
   - With the laser, Play is one click once the card has opened (after the 0.8 s dwell), or two steps through the game page.
3. **Programs are apps too.** The Apps section is Steam's own "+ > Launch Program" list as visionOS would show it:
   - every program is a glass disc with its icon;
   - sorted A–Z, two pages;
   - after 0.4 s of focus, a name plate shows the full name.
4. **Collections are folders.**
   - Great On Frame, Ready To Play, Installed, Non-Steam and Soundtracks come first, then your collections.
   - Collections with no games share one dimmed "Empty Collections" folder.
   - A folder opens as its own windowless page, with a "Show in Library" button.
5. **The "+" in the bar stays a quick launcher, and the only home of the Liquid Glass switch.**
   - All 23 programs show at once in four columns.
   - The full name appears on focus.
   - The switch is a Control-Center-style row at the bottom.
6. **Browsing stays a window.** All Games (or the Library tab) opens window-nav's glass window:
   - posters;
   - a More circle inside the hovered or focused poster, the laser's direct path to a game's menu;
   - a letter scrubber;
   - one bottom ornament that shows the current sort in both input modes.
7. **Search is the system's search** (window-nav). This concept adds desktop programs to it: an Apps cell, and programs ranked into the Top Hit. On library items, X plays.
8. **The storefront is one button away, untouched.** What's New opens Steam's own Home feed (shelf, What's New, Friends, Recommended) in a glass window. Every card works as before.

### 1.3 Is the current UI optimal in VR? Per context

| Context | Verdict | Why (evidence) | Redesign |
|---|---|---|---|
| Library Home | **Not optimal** | Launcher and storefront are mixed. The featured tile reflows 11.7° on focus. Status text is 12 px uppercase. The tile menu has no laser path, because the footer is hidden on Home (LA B.3, B.5.1, B.5.4, H3) | A windowless Home view of discs with sections and a card ramp; the feeds move to their own route (§3) |
| "+" Launch Program | **Not optimal** | Icons are 0.6° and rows 1.5°. 40 % of the list is hidden, the order is unstable, and the theme switch sits in a random row (LA B.1, B.3) | A 4-column popup with all programs visible and the switch as a row (§4); the full grid in Home › Apps (§3) |
| Library catalogue (grid) | **Content is fine, chrome is not** | Posters at 5.3° are good. Tabs are 1.04°, the sub-filter 1.35°, legends 1.07°. There are two control sets for Sort/Filter that switch with the input mode, and no position cue in 30 screens of scroll (LA B.1–B.4) | Posters stay in a window (LA D.1); chrome rebuilt as a segmented control, one per-mode ornament with fixed slots, and a scrubber (§7) |
| Sort menu, tile menu | **Not optimal** | Centred console sheets far from their source, 1.47° rows, no current value shown (LA B.4.4) | Glass menus grown from their source, current sort checked (§8) |
| Library Filters | **Worst screen** | 47 rows of 0.86°, 0.49° checkboxes, 3.8 window heights of scroll (LA B.1) | A sheet with segments, chips and collapsed sections, about 1.2 sheet heights (§9) |
| Collections tab | **Not optimal** | 8 of 9 tiles say "( 0 )" and push the useful one off the first row (LA B.3) | Folders, with the empty ones grouped (§3.2) |
| Search results | **Not optimal** | Category tabs 1.04°; no titles or install state; programs are not searchable (LA A.7, B.2) | window-nav's system search plus programs from this concept (§6) |
| Non-Steam tab | **Partly broken-looking** | About half of 54 shortcuts show a title card or an empty tile (LA B.4.6) | Monogram circles on Home; Steam's title card restyled in the grid (§3.3, §7) |

---

## 2. Decisions

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| HA-1 | **Home is windowless.** Every glass element on it is a **plate**: a glassd cover shape in native mode, CSS liquid glass otherwise. Only the focused item pops (§10) | A window of circles; rev 1's popped band without covers | visionOS Home has no window (refs 1, 9, 10; D2 §3.5). E2E §1 forbids pops that are not covered. Partial cover shapes for "Home-view plates" are a native capability (NATIVE.md, SP §11.1 [PROVEN-P1]) |
| HA-2 | **Sections: Recent · Collections · Apps (· Windows).** What's New is **not** a section | A What's New segment (rev 1) | Inside What's New, Steam's tabbed page takes LB/RB for its feed tabs, so the same button would mean two things on one route (critic) |
| HA-3 | **On Home, LB/RB switch sections, and D-pad Left/Right past a row end turns the page.** LT/RT also turn pages when delivered. **No bumper glyph badges**: Steam itself draws arrows instead of LB/RB glyphs on VR tab rows (INV-L §1.4) | LB/RB = pages (D2 §3.5); reading the controller's button set to decide on badges | On every Steam tabbed page, LB/RB means "tabs", and sections are tabs. L.pad cannot prove that the Frame's controllers deliver bumpers in VR, so every section and page also has a D-pad path (AT-3j). **Needs sign-off by the DESIGN2 owner** (amends D2 §3.5) |
| HA-4 | **A opens the game page; X is Play** (Steam's primary action). The card's Play capsule does the same as X. Programs, folders and windows activate on A | A = Play | Keeps Steam's muscle memory and every launch dialog on the game page (H2); one-step Play stays available (LA C.2) |
| HA-5 | **Labels are one line**, ending in an ellipsis. The full name shows on focus (card or name plate) | Two-line labels (D2 §3.5) | Two lines cannot fit under row 3 with the page dots inside 720 px; visionOS Home labels are one line (refs 1, 10) |
| HA-6 | **The card ramp:** after 0.8 s of focus, the disc morphs into a 320 × 240 card holding Play and More, 180 px apart. It is driven by Steam's focus and has hysteresis (§3.4) | A Play capsule under the label (D2 §3.5); rev 1's 312 × 206 card with circles at a 68 px pitch | The label band cannot hold a 60 px button. The card is visionOS's "pop open to reveal more" (VR §19). An 80 px pitch is DESIGN2 rule 1 |
| HA-7 | **The catalogue stays posters in a window** (window-nav's window) | All 350 games as circles | 27 pages with no random access, and circle crops drop logos (LA D.1). Circles are for launching |
| HA-8 | **Search belongs to window-nav.** This concept contributes programs (ranking plus an Apps cell) and X = Play on library items. The Home field is window-nav's documented **circle variant** | Rev 1's split view at `/search/tab/<id>` | Only one override can render the route (critic). One field spec everywhere |
| HA-9 | **The "+" popup stays Steam's popup in Steam's host** (300 px), restyled. A T3 patch adds A–Z order, 4 columns and the toggle row | Opening Home from "+" | The theme switch must never depend on our route (LA C.1, D.7.1). LQ5 (opening a T3 route from the bar) is unproven |
| HA-10 | **The Liquid Glass switch appears only in the "+" popup.** In T3 it is a toggle row at the bottom that never takes default focus; in T1 it is Steam's own row with a green "on" pip. It is **not** in Home › Apps or in search | Rev 1: first cell of Apps, drawn as a white "on" disc | A habitual A on the first cell would turn the theme off. White is this design's selection colour (critic). CC keeps only the + button (CC row "+") |
| HA-11 | **Steam's menu "Cancel" row stays**, as a 56 px quiet recessed row | Removing it | It is Steam's node (the audit would report it HIDDEN); 56 px is at least Steam's 48 px, so not SHRUNK |
| HA-12 | **Program icons are drawn at 64 CSS px, their source size** (Steam's 64 px `strIconDataBase64`). In Steam's 1.5× texture that is 96 px, D2 §9.3's 1.5× cap. On the display it is 38–47 px (D2 §2.3), so a 64 px source is not visibly upscaled | 72 px (rev 1, 1.7× in the texture); 48 px (D2 §9.3's example) | 48 px leaves a 120 px disc mostly empty. 64 px is the largest size inside the cap. The 6 icons that Steam upscaled from 32 px stay soft until the daemon supplies theme icons (LQ4) |
| HA-13 | **Empty collections are grouped** into one dimmed "Empty Collections" folder when there are two or more | 8 dimmed circles last (rev 1) | 8 of 9 collections here are empty. Grouping keeps every one reachable at one more level |
| HA-14 | **Folders and What's New are routes** under `/library/lgs/…` (D2 §12) | In-page folder state | Steam's Back and B work natively, and focus memory and history stay Steam's |

---

## 3. Home (the app-selection view)

**Route.** Steam's `/library/home`, rendered by a T3 route override that receives Steam's children (SR §3.5 [PROVEN]).

**Other routes:**

- Steam's Home children render at `/library/lgs/steamhome` (What's New, §3.6).
- Folders render at `/library/lgs/folder/<collection id>` (§3.2).

### 3.1 Layout of the overlay (1280 × 720 px = 960 × 540 pt)

```
 x: 0   24  84          406                   640                   874        980   1176 1196  1256 1280
 y 20  ( < )                [ Recent | Collections | Apps ]                     ( * What's New )   ( Q )      top row, 60-64 px
 y 136                ( )        ( )        ( )        ( )                       ( ) peek   row 1, centres y 196
 y 324         ( )        ( )        ( )        ( )        ( )                              row 2, centres y 384
 y 512                ( )        ( )        ( )        ( )                       ( ) peek   row 3, centres y 572
 y 690                               o  o   (page dots)
```

| Element | Size and position (px [pt]) | Material | Depth | Notes |
|---|---|---|---|---|
| Back | Circle 60 [45] at (24, 20); hit 80 [60] (box at 14, 10) | Plate, `liquid` | 0 | Steam's `%{BackContainer}`, laser only as today (B is the gamepad path). Steam's "Back" text node stays in the DOM, visually replaced by the chevron (WN §3.2 and its audit exception Q8) |
| Section control | Liquid capsule 64 [48] tall at y 18, centred on x 640. Width ≈ 470 [353] with 3 segments, ≈ 634 [476] with Windows. Segments 56 [42] tall, ≥ 140 wide, padding 26, labels 22 px [16.5 pt] Semibold. Hit 80 tall by transparent padding | Plate, `liquid`; selected segment white .94 with a dark label (D2 §7.10) | 0 | Our T3 `Focusable` row (`flow-children: row`). **No LB/RB badges** (HA-3) |
| What's New | Capsule 60 [45] tall, right edge at x 1176, ≈ 196 wide: sparkle 24 + 10 + label 22 px Semibold, padding 20/24; hit 80 tall | Plate, `liquid` | 0 | Our T3 `Focusable`, last in the top row's focus order. Navigates to `/library/lgs/steamhome` |
| Search | Circle 60 [45] at (1196, 20), magnifier 27 px; box 80 × 80 at (1186, 10) | Plate, `liquid` | 0 | Steam's `%{SearchAndTitleContainer}` in **window-nav's circle variant** (WN §3.2 "Hero routes"), gated on the same audit (no SHRUNK). A click focuses Steam's input and opens window-nav's search |
| Honeycomb | 13 cells per page as 4-5-4. Disc 120 [90] (3.7°). Column pitch 224 [168], row pitch 188 [141]. Centres: rows 1 and 3 at x 304, 528, 752, 976; row 2 at x 192, 416, 640, 864, 1088; rows at y 196, 384, 572 | See §3.3 | 0 at rest | Disc / pitch 0.536 and row / column 0.839, inside the refs' 0.52–0.55 and 0.84 (REF C.4) |
| Cell (the focusable) | 200 × 180 [150 × 135], anchored at the disc centre − (100, 60) | — | — | Disc + label; Steam's focus lands on the cell |
| Label | Subheadline 20 px [15 pt] Medium, white .92, one line, ≤ 200 px, ellipsis, top at the disc centre + 74. On-room shadow `0 1px 3px /.6, 0 0 12px /.4` | Text on the room (D2 §8.3) | 0, never popped | Fades to .22 while a card or plate covers it |
| Page dots | 12 px [9 pt] dots at a 24 px pitch, centred at (640, 696); current white, others white .40 | — | 0 | Indicator only; hidden when a section has one page |
| Peeks | The neighbour page's first icon of rows 1 and 3, at x 1212 (next) and x 68 (previous); scale .86, opacity .58, blur 1.5 px | CSS only (no plate) | 0 | Laser targets of 120 × 120 that turn the page (ref 9's faded edge items) |
| Tab bar | Steam's frame menu at the leading edge, Home selected (white .18 platter) | `liquid` | WN | Owned by window-nav (WN §3.3) |

Lighter chrome than rev 1:

- **Width:** the top row's controls take 784 px of width at 60–64 px height, against 1,188 px at 72 px before.
- **Glass area:** about 47,000 px² against 84,000 (−44 %).
- **Removed:** the search field (now a circle), the bumper badges and the What's New segment.

### 3.2 Sections and their content

| Section | Content and order | Pages (here) | Data (read-only) |
|---|---|---|---|
| **Recent** | The running game first (green dot), then Steam's MRU merged with programs launched from our surfaces in this session (in-memory timestamps), newest first. Cell 13 of every page is the **All Games** folder (→ `/library/tab/AllGames`) | 2: 12 + 8, each with All Games | `collectionStore.recentAppsCollection` (20 here), `appStore.GetAppOverviewByAppID`, `MainRunningAppID` |
| **Collections** | First the library sets as folders: Great On Frame, Ready To Play, Installed, Non-Steam, Soundtracks, and Favorites when non-empty. Then user collections with games, A–Z. Then **one "Empty Collections" folder** when two or more collections are empty (a single empty one is shown by itself, dimmed, with an "Empty" plate) | 1: 7 cells | `collectionStore` (`frameGamesCollection`, `readyToPlayActiveCollection`, `localGamesCollection`, `deckDesktopApps`, `userCollections`, `GetCollection`) |
| **Apps** | Every program from Steam's own launch list **except the Liquid Glass entry**, A–Z (`localeCompare`, case- and accent-insensitive) | 2: 13 + 10 | Steam's `useNonSteamApps` hook and Steam's filter (SR §3.7). This is the same set Steam shows, with developer-mode filtering unchanged, rescanned on every Home entry, keyed by `strCmdline` |
| **Windows** (only when present) | Desktop windows that SteamVR reports, in Steam's order | 1 | The `windows` message Steam's "+" popup uses (LA A.8.4) |

**Folder route** `/library/lgs/folder/<id>`, windowless like Home (`p2_home-apps_folder.png`):

| Part | Spec |
|---|---|
| Back | The same Back circle as Home |
| Title | The collection's name, centred at y 28, Title 2 30 px Bold on the room, with the label shadow |
| Show in Library | A plate capsule in What's New's slot, leading to Steam's `/library/collection/<id>` or the matching library tab, where sort and filter live |
| Search | The same search circle as Home |
| Games | Honeycomb pages: 13 per page, same lattice, peeks and dots |

- **Leaving:** B, or Back, is history back to Home. Focus returns to the folder's cell.
- **The Empty Collections folder** opens the same way. Its cells are the empty collections, each dimmed with an "Empty" plate, and each opens Steam's collection page.
- **Fallback** (adding the route fails): the folder cell opens Steam's collection page directly.

### 3.3 Icons

| Kind | Composition | Source (the first URL Steam returns, local cache) | Fallback |
|---|---|---|---|
| Steam game or shortcut | A `liquid` disc 120 with the art inset **4 px** (art circle 112), so a thin lensing bezel and the specular arc show around the art. Art: **hero** with `object-fit: cover`, centred at 50 % 42 %. **Logo** centred, at most 76 % × 46 % of the art, with a soft shadow. Key light from above, darker lower 40 % (D2 §9.2) | `urlStore.BuildCachedLibraryAssetURL(appid, 'library_hero.jpg' / 'logo.png', ov.local_cache_version)`; custom art via `appStore.GetCustomHeroImageURLs` / `GetCustomLogoImageURLs` (SR §3.7) for the 15 shortcuts in Recent | Portrait crop at `object-position: 50% 28%`; then a **monogram** (initials, 40 px Bold, on a gradient) |
| Program | A `liquid` disc 120 holding the program's icon at **64 × 64** (HA-12) | `strIconDataBase64` (64 px); a ≥ 128 px icon-theme file when the `lgs-shell` daemon supplies one (LQ4), drawn at the same 64 px | No icon (5 of 23 here): a category glyph of 50 px, chosen by name: display (Desktop), remote screen (Frametop Remote Access), two screens (Hide/Show Screens), gear (KDE System Settings), terminal (Konsole) |
| Folder | A `liquid` disc holding a 3 × 3 grid of 26 px portrait crops (radius 7, gap 5) | `GetCachedVerticalCapsuleURL(ov)[0]`; header crops for Soundtracks | Empty Collections: nine empty white .12 tiles, cell at .62 |
| Window | A `liquid` disc with the window's icon at 64 | `steamloopback.host/windows/icon?handle=<hwnd>` | Window glyph |
| All Games | A folder disc of the first 9 portraits of All Games | as Folder | — |

**States on icons.** These are all the A.10 states that apply to a launcher; the rest show on the card:

| State | On the icon | On the card (§3.4) |
|---|---|---|
| Running | A green 10 px dot before the label; first in Recent | Play becomes Steam's primary action for a running game |
| Not installed | Art at saturation .6 and brightness .62, plus a 40 px black .55 circle with a cloud glyph at the lower right | Play becomes **Install** (blue) |
| Downloading | Art dimmed, with a white progress ring (r 22, 6 px stroke) on a black .45 disc at the centre | Status "Downloading · 62 %" |
| Update available | A blue 28 px badge with a download glyph at the top right, overlapping by a third | Play becomes **Update** (blue) |
| Frame compatibility | — (Steam shows it only on focus) | Status line: Steam's icon and word ("Verified", "Playable", "Untested", "Unsupported") |
| Friends playing, coming soon, locked, copies | — | Status line |
| Missing art | Monogram | Monogram card |
| Hidden apps | Not on Home (Recent never lists hidden apps) | — |

### 3.4 Focus, hover and the card ramp

**Focus is the single driver.**

- In VR, laser hover moves Steam's focus: `.gpfocus` is how both controller and laser focus show (LAB.md, hard rules), and LA L8 / LQ7 rely on focus following hover across tiles. Status: PLAUSIBLE for our T3 cells.
- So every reveal on Home is driven by one state machine fed by our cell's `onGamepadFocus` / `onGamepadBlur` (SR §3.6), never by CSS `:hover`.
- If laser hover turns out not to move focus on our cells, the same state machine also takes `pointerenter` / `pointerleave` from our own DOM. These are JS events on our nodes, not CSS `:hover`, so AT-8(d) still holds.
- This lets one acceptance test cover both inputs (AT-8).

| Step | What happens | Motion (D2 §11.2) |
|---|---|---|
| Focus arrives | Disc ×1.10, white glow 26 px, label white; the first frame shows ≥ 60 % of the final contrast. Native mode: the cell pops **+15 mm** (0.041 u) over its own plate (§10) | `hover-in` 294 ms; out `fade` 441 ms; depth on `depth` 441 ms (≈ 26 scene-graph pushes at 60/s, SP §4.2) |
| Dwell 0.4 s (programs, folders, windows) | A **name plate** replaces the label: liquid capsule 60 [45] tall (72 with a second line), width = text + 44, top at the disc centre + 74, clamped 16 px inside the overlay. Name 20 px Semibold; optional second line 18 px ("27 games", "8 collections with no games") | `materialize-in` 250 ms; out `materialize-out` 350 ms |
| Dwell 0.8 s (games) | The disc **morphs into the card**: 320 × 240 [240 × 180], radius 36, centred on the disc horizontally, top at the disc centre − 100, clamped 16 px inside the overlay and ≥ 12 px below the top row. **Art** 296 × 140 at (12, 12), radius 24 (concentric), with the logo centred at 31 % of the art's height. **Play** capsule 60 [45] tall at (24, 80), green whole fill, play glyph plus "Play" 22 px Semibold (Install/Update blue). **More** circle 60 [45] at (236, 80), black .34 clear-glass fill. Centres are 180 px apart; hit areas are 80 tall and do not overlap. **Title** Headline 24 px Bold at (24, 162), one line. **Status** 18 px at (24, 194): compatibility icon and word, then playtime | `morph-open` 607 ms (b 0.20) from the disc's rect and radius to the card's; content 15–50 %; the two controls `materialize-in` 250 ms at 50 % |
| Focus leaves | The card closes 0.3 s later unless focus returns | `morph-close` 441 ms; content out by 40 % |
| Press | Glass discs and capsules swell by `min(1.06, 1 + 6/maxSide)` (×1.05 on a 120 px disc); content brightens only; glow from the hit point | `interactive` 210 ms; release glow 90 ms linear, swell back on `snappy` 488 ms |

**Hysteresis**, against laser jitter while sweeping the grid:

- The 0.4 / 0.8 s timers start when focus lands on a cell. They restart only when focus moves to another cell.
- For the laser, our cell also listens to `pointermove`. The card opens only if the pointer stayed inside the disc's circle (radius 66 px at ×1.10) for the whole 0.8 s. Moving across the label does not open it.
- The card closes 0.3 s after focus leaves it. While the pointer is over the card, focus stays on its cell, because the card is part of the cell's DOM.
- Two focus moves within 0.3 s never open a card.

**Gamepad glyph badges** (X on Play, ≡ on More; 30 px, D2 §9.4) show only while Steam is in gamepad navigation (`IsInGamepadNav`). The laser view stays clean.

**Covering:**

- Neighbouring labels under the card or a plate fade to .22.
- A card covers at most 14 px of the row below (the card's bottom edge is 14 px past the next row's disc top) and nothing of the row above.

**Reduce Motion:** no scale and no lift animation; the end depth is pushed once; the card cross-dissolves in 180 ms (D2 §11.4 C8).

### 3.5 Navigation model

**Gamepad.** All handlers are T3 `Focusable` props (SR §3.6).

| Input | Effect |
|---|---|
| D-pad Left / Right | Previous / next cell in the row. **Past the row's end:** the same row on the next page, first cell. **Past the row's start:** the same row on the previous page, last cell. **On the first page, Left at a row's start is not handled.** It bubbles to Steam's `onMoveLeft` and opens the tab bar, exactly as today (SN N2) |
| D-pad Up / Down | **Honeycomb rule:** a vertical move keeps the cell's index within the row, clamped to that row's length. This zig-zags around the column. **One-step memory:** the opposite direction always returns to the cell you came from. **Up from row 1** enters the top row (segments, then What's New); **Up again** leaves the page to Steam's search, as today (SR §4). **Down from the top row** returns to the remembered cell |
| LB / RB | Previous / next section; the white pill travels. What's New is not in this cycle (HA-2) |
| LT / RT (if delivered) | Previous / next page |
| A | **Game:** its page (`/library/app/<id>`). **Program:** `LaunchNonSteamApp(strCmdline)`. **Window:** `DashboardDesktopWindowClicked({window_id})`. **Folder:** `/library/lgs/folder/<id>`. **All Games:** `/library/tab/AllGames`. **Segment:** that section. **What's New:** `/library/lgs/steamhome` |
| X | Games: Steam's primary action (Play / Install / Update / Resume), the same call as the tile menu's first item |
| ≡ (Menu) | Games: Steam's tile menu (`showContextMenu` with Steam's own menu component, or Steam's `vgp_onmenu` path). Programs: none (Steam has none) |
| B | At the Home root: not handled, so Steam's root `onCancelButton` opens the tab bar, as today (SN N3). In a folder or What's New: history back |
| Focus memory | Returning to Home restores the last focused cell per section (Steam's group focus memory, SR §4) |

**Fallback.** If the explicit neighbour map misbehaves, use a 5 × 3 square lattice of the same discs (15 per page) with `flow-children: grid`. SR §4 proved that spatially correct.

**Laser:**

- Click a cell to activate it.
- Dwell 0.8 s on a game for the card, then click Play or More.
- Click a peek to turn the page.
- Click a segment to switch sections.
- The wheel does nothing on Home (pages, not scroll).

Every laser target above also has the gamepad path (D2 §10.4).

### 3.6 What's New (its own route)

**Route and frame.** `/library/lgs/steamhome` renders Steam's Home children (`steamChildren`) inside window-nav's window:

- glass 1280 × 720, since Steam hides the footer on Home;
- window-nav's toolbar row: Back circle, Large Title "What's New", search capsule.

**Content.** The content is Steam's own page, restyled by T1 per DESIGN2:

- the shelf capsules lift instead of reflowing;
- the feed tabs become a segmented control;
- text is title case;
- cards stay opaque content.

**Behaviour.**

- LB/RB switch Steam's feed tabs (Steam's handler), as on every tabbed page.
- B and Back return to Home.
- Every card works unchanged.

### 3.7 Home without T3 (fail-closed)

If the route override cannot install, `/library/home` is Steam's Home with the T1 restyle, inside window-nav's window glass. (`install()` throws when a required finder misses, SR §3.2.) Nothing in §3 is then visible, and nothing is lost: every Home function is Steam's again.

---

## 4. The bar's "+" popup

**Host.** Steam's `%{AddWindowButton}` keeps opening Steam's own popup in Steam's own barpopup host: 300 × 1024 popup px (INV-B §2), at 0.037°/px with m = 0.83.

**What the T3 patch does:**

- it swaps the popup's memo component (SR §3.2, §8) for one that renders Steam's own data;
- it uses Steam's own list hook (`useNonSteamApps`, rescanned on every press);
- it uses Steam's launch calls.

| Element | Popup px (main-equivalent px [pt]) | Material | Notes |
|---|---|---|---|
| Panel | 300 wide (the host); padding 12 top and bottom, 6 at the sides; radius 40; **726 tall** with 23 programs (12 + 52 + 576 + 10 + 64 + 12; 26.9°, against 600 = 22.2° today) | `panel` (T5 via the barpopup cover; T1 tint fallback) | Grows upward from the + button, as Steam places it (bottom centre on the bar anchor, y +15) |
| Header | 52 tall: "Launch Program" 22 px Bold (Steam's string), padding-left 18 | — | Steam's `%{DashboardBarPopupListHeader}` |
| All Apps | Circle 48 (58 [43]) at the header's right, grid glyph | Thin fill | **T3 only.** Opens Home › Apps (LQ5). Hidden when LQ5 fails |
| Grid | **4 columns of 72 × 96** (87 × 116 [65 × 87], 2.7° × 3.6°). Disc 52 (63 [47]) at white .11, with the program icon at 34 px (a 64 px source shown at 51 texture px). Label 15 px (18 [13.5]) Medium, ≤ 2 lines in 70 px, word-aware (below) | Fills on glass (D2 §6.5) | Hit region = the whole cell, 72 × 96 (≥ 67 popup px both ways, D2 §2.5). **All 23 programs fit: 6 rows = 576** |
| Labels | Line breaks only between words or after "/". A word too long for its line is cut with "…" and ends the label. Text left over after two lines ends in "…" (11 of 23 names here) | — | The full name appears on focus or after 0.4 s of hover: a 34 px capsule over the label (15 px Semibold, white on grey .92), clamped inside the 300 px host (left-aligned in column 1, right-aligned in column 4). Neighbours' labels under it fade to .22 |
| Groups | When SteamVR reports windows: a "Windows" group first (15 px Semibold secondary label), then "Programs". **T3:** a "Recent" row of up to 4 programs launched this session (memory only) above "Programs" | — | With either group present the panel grows to at most 760 (28.1°), and the program grid scrolls under a 56 px edge fade (D2 §6.7) |
| Liquid Glass row (T3) | 64 tall recessed platter (black .22, radius 28). The real Liquid Glass icon on a 44 disc, "Liquid Glass" 19 px Semibold, "Glass Shell is on" 15 px, and a switch shown on (green) | Fills | Pinned at the bottom, outside the grid's focus group. **It never takes default focus:** `preferredFocus` goes to the first program cell |
| Liquid Glass (T1) | Steam's own row stays in Steam's scan order, drawn as a **normal cell with a 14 px green "on" pip** (T2 marks it `data-lgs-row="liquid-glass"` by its text) | — | Today Steam's scan put it first, so Steam's default focus can land on it. That is stock behaviour, unchanged by T1; T3 removes it |
| + button in the bar | White .94 with a dark glyph while the popup is open (D2 §8.2) | — | Steam's Active class, recoloured |
| Depth | Popup +30 mm in front of the bar | — | Popup request `z` via the `SendPendingInstanceParamsToSteamVR` wrapper [PLAUSIBLE] (SP §3.3); without it, Steam's +3.7 mm |
| Motion | `materialize-in` 250 ms in place (glass 0–92 %, content 35–100 %), scale from 1.04 (`1 + 12/300`), origin at the bottom centre; out `materialize-out` 350 ms; cell light on `hover-in` | — | A cross-quad morph from the + button is glassd-only (D2 §11.6) |

**Why 4 columns and not a taller 3-column panel** (critic option b):

- 3 columns of 92 × 100 need 8 rows, so the panel would be 950 popup px = 35° tall. It would rise from the bar to 24° above the view centre and leave the mockup frame.
- 4 columns keep the popup within 5° of today's height, and nothing scrolls.
- The cost is shortened labels, which the focus plate and Home › Apps (200 px labels) repay.

**Ordering.** T3 sorts A–Z. T1 cannot reorder focusable siblings (D2 §12) and keeps Steam's scan order (`p2_home-apps_plus-t1.png`).

**Gamepad.** Steam's own popup focus:

- the D-pad moves between cells;
- with T1, the list becomes a 4-column CSS grid without `flow-children`, so Steam infers grid navigation from the computed style (D2 §12);
- A launches, B closes, and the popup auto-closes 2 s after the pointer leaves, all unchanged.

---

## 5. One launch path, and the switch's safety

**Launch calls.** Every surface calls exactly what Steam's row calls (LA A.8):

- `SteamClient.Apps.LaunchNonSteamApp(strCmdline)` for programs;
- `SteamVR.DashboardDesktopWindowClicked({window_id})` for windows.

**The list** is Steam's: `useNonSteamApps` plus Steam's filter, rescanned on every "+" press and every Home entry, keyed by `strCmdline` (SR §4: duplicate keys break navigation).

**The Liquid Glass entry** is filtered out of every T3 surface except the "+" popup's toggle row (HA-10). The filter matches the entry's `strExePath` ending in `/glass-shell/device/lgs`, or its name, for robustness.

**The toggle row (T3)** calls Steam's own launch for that entry (`LaunchNonSteamApp` with its `strCmdline`). It applies the LQ10 order whenever the main window is on one of our `/library/lgs/*` routes:

1. navigate main to `/library/home` with `replace`;
2. wait for Steam's route to settle;
3. launch.

The order matters because theme removal drops our routes (AT-16). **Tests log the order instead of executing it.**

---

## 6. Search: window-nav's route, this concept's additions

window-nav owns `Routes.Search.Root()`: its zero state, its summary, and Steam's category grids (WN §4). This concept contributes three things.

| # | Contribution | Spec | Tier |
|---|---|---|---|
| S-A | **Programs in the ranking** | The program list (§5, without Liquid Glass) is matched on `strAppName` with the same rule window-nav uses for games: exact title prefix > word prefix > substring. A program that ranks first becomes the **Top Hit**: art = its icon at 120 on a disc, status "App", and the **Open** capsule launches it (`LaunchNonSteamApp`, logged in tests) | T3, inside window-nav's `LgsSearch` |
| S-B | **The Apps cell** | When programs match, window-nav's bottom row (the Store hand-off, 704 × 76) splits into two 346 px cells: **left** the best program (52 px disc with its icon, name 24 px, "App" 20 px secondary), A = launch; **right** "Search the Steam Store" (window-nav's). With two or more matches the left cell reads "Half SBS Toggle and 2 more", and A opens Home › Apps with that program focused. No matches: the Store row stays full width | T3 |
| S-C | **X = primary action on library items** | On the Top Hit and on "In Your Library" posters, X calls Steam's primary action (Play / Install / Update), shown in the bottom ornament as "X Play". A still opens (window-nav's rule: launching stays on the game page) | T3 `onSecondaryButton` |

**Field.**

- One spec everywhere: window-nav's 520/640 × 64 capsule, with **no microphone** (Steam has no dictation, WN D-8).
- On Home, the field is window-nav's documented 60 px **circle variant** (§3.1).

**Mockup.** `p2_home-apps_search.png` shows the query "half" on the real library:

- Top Hit: Half-Life: Alyx;
- In Your Library: 4 of 9 matches;
- the Apps cell: Half SBS Toggle, the real program, with its real icon.

**Cross-concept record:** `concepts/xc-home-search.md` holds the exact text for WN §3.1, §3.7 and §4.4.

---

## 7. Library catalogue

**Routes.** `/library/tab/<id>` and `/library/collection/<id>` (Steam's), in window-nav's window: glass 1280 × 656, radius 54, toolbar row 108, bottom ornament 628–712 (WN §3.1–3.4).

| Element | px [pt] | Material / fill | Tier |
|---|---|---|---|
| Toolbar row | window-nav's: Back circle (borderless on section roots), Large Title "Library" at x 100, search 520 × 64 centred | WN | T1 + T2 |
| Tabs | Steam's tab row as a segmented control: 64 [48] track at y 116, segments ≥ 140, labels 22 px Semibold title case, counts at white .70 (dark .55 on the white segment). Steam's horizontal scroller with 28 px edge fades; Steam's ‹ › arrows become 60 px plain circles at x 24 and 1196 | Recessed track | T1 (the row keeps its horizontal handlers, D2 §12) |
| VR sub-filter | Steam's `%{VRSubTabFilterContainer}` **in its stock position**: centred under the tab row (y 192), a 60 px segmented capsule "All · VR · Non-VR" (Ready To Play: All · Standalone · Remote PC) | Recessed track on glass | T1. Not moved: its nav-tree position sits between the tabs and the grid (rev 1's ornament placement is withdrawn) |
| Grid | **Baseline: Steam's own geometry**, 172 × 258 posters, 6 per row, gaps 24 × 42, radius 20. **Optional T3:** 200 × 300, 5 columns (LQ2) | Content | T1 (styles only, D2 §12); T3 gated on LQ2 |
| Focused / hovered poster | Scale 1.05, shadow 0 18 44 /.48, glow 30 px, diagonal sheen. Steam's compatibility badge restyled as a 36 px circle at the bottom right (inset 10). **No caption**: Steam shows none, and Steam's 42 px row gap cannot hold one | Content; native +15 mm crop over the window cover | T1 + T4 |
| **More circle** | **60 [45]** circle **inside** the poster's top right (inset 10), with an **80 px hit area**, black .38 with a 10 px blur (white while its menu is open). Shown on hover and on focus (parity, D2 §10.4) | Clear fill | T2 node in `%{LibraryItemBox}` (below) |
| Letter scrubber | 44 × 380 [33 × 285] capsule at right 14, y 196. Letters 18 px Semibold, dots between, the current letter in a 32 px white circle. Hit: the capsule widened to 80 px by transparent padding | Black .16 | T3. Click or drag maps y to a letter and sets the grid scroller's `scrollTop` to that letter's first row (a wheel-equivalent). Shown only for Alphabetical |
| Bottom ornament | window-nav's capsule (84 tall, y 628–712, 0 mm). On library routes it holds **five fixed slots**: 300 · 130 · 156 · 134 · 120 px, gap 4, padding 12, **880 px wide in both input modes** (≤ 896, D2 §3.2) | `liquid` (inset slab) | T1 layout + T2 (below) |
| "N apps hidden" notice | Steam's `%{AppGridFilterHeader}` as a 56 px capsule above the grid ("12 games hidden by filters" plus "Clear" when it is the button variant) | Thin fill | T1 |
| Section headers (non-alphabetical sorts) | Title 3 28 px Semibold, title case, no rule lines | — | T1 |
| Missing art | Steam's title card restyled: a gradient tile with the title 22 px Bold | Content | T1 |
| Collections tab | Steam's collection tiles restyled as rounded folder tiles (radius 30), title case labels, count secondary; empty tiles dimmed | Content / fills | T1 (shape, case); Steam's order |

### 7.1 The ornament in each input mode

Steam renders different controls per mode (INV-L §6.1; LA §0.4):

- **Laser mode** (`IsInGamepadNav == false`): the `%{SortAndFilterContainer}` pill shows (Sort with the current sort, Filter), and the footer legend shows only Select and Back.
- **Gamepad mode:** the legend shows X Filter, Y Sort By, ≡ Options (only while a tile is focused), A Select, B Back.

| Slot | Laser mode (`p2_home-apps_library.png`) | Gamepad mode (`p2_home-apps_library-pad.png`) |
|---|---|---|
| 1 Sort (300) | Steam's `%{SortAndFilterButton}` (sort): sort glyph + the current sort ("Alphabetical"), moved by T1 into slot 1 (laser-only node, so moving it cannot change D-pad order) | Steam's legend "Y Sort By", plus a T2 span " · Alphabetical" from `AppGridDisplaySettings` |
| 2 Filter (130) | Steam's Filter button: filter glyph + "Filter" (Steam's "Filter: [icons]" when active) | Steam's legend "X Filter" (T2 count badge when filters are active) |
| 3 Options (156) | **T2 "Options" button.** It dispatches Steam's `vgp_onmenu` on the poster under the pointer, else on the last focused one. Disabled (.38, no hover) when there is neither | Steam's legend "≡ Options" while a tile is focused. When none is focused, T2 shows the same disabled "Options" so the slot never empties |
| 4 Select (134) | Steam's legend "A Select" | Steam's legend "A Select" |
| 5 Back (120) | Steam's legend "B Back" | Steam's legend "B Back" |

The mode is read once per change from Steam's own state, the same flag Steam's tabbed page reads (`IsInGamepadNav`). Our T2 reads it through one function, `lgsInputMode()`, so tests can stub it without touching Steam (AT-14d).

### 7.2 The More circle, precisely

- **Node:** one T2 `<span>` per rendered `%{LibraryItemBox}`, with `role=button` and `aria-label="More"`. It is not focusable, so the gamepad keeps ≡.
- **Click:** a capture-phase `pointerdown` / `click` listener on the span calls `preventDefault()` and `stopPropagation()`, then dispatches Steam's `vgp_onmenu` (button 14) on the poster's `%{LibraryItemBox}`. This is the dispatch the inventory used to open the capsule menu (INV-L §0.3) [PROVEN dispatch]. The poster's own click handler never sees the event, so the route does not change.
- **Recycling:** the virtualized grid recycles row nodes. A `MutationObserver` on the grid's scroller re-attaches spans to new `%{LibraryItemBox}` nodes and removes orphans, so each poster has exactly one span (AT-14b).
- **Fallback:** the ornament's Options slot.

---

## 8. Menus: Sort and the tile menu

Both are Steam's context menus (`BasicUIContextMenu`, INV-L §6.2, §7), restyled per D2 §3.7 and WN §5.1 (T1). Anchoring to the source is T3 (CQ10). Until that is proven they stay centred and only the look changes.

| | Sort | Tile menu |
|---|---|---|
| Source | Ornament slot 1 (laser) or Y (gamepad) | More circle (laser), ≡ (gamepad), ornament slot 3 |
| Shape | `thick` glass, radius 32, padding 8, min width 320, rows 72 [54] with radius 24, 6 px between rows, 8 px between groups, header 44 px (22 px Bold secondary, WN D-5) | Same, 380 px wide, header = the game's name |
| Content | 10 sorts in groups: Alphabetical · Friends Playing, % of Achievements, Hours Played, Last Played · Release Date, Date Added · Size on Disk · Metacritic, Steam Review. **The current sort is checked** (T2 reads Steam's `AppGridDisplaySettings`) | Primary first with its semantic whole fill (Play green, Install/Update blue, Stop red); Add to Favorites, Add to ›; Manage ›, Developer ›, Properties…; submenus open beside the menu |
| Cancel | Steam's row kept as a 56 px quiet recessed row, secondary label (HA-11) | Same |
| Placement (T3) | Grows upward from slot 1, its bottom 14 px above the ornament | Grows from the More circle to the poster's right (left if there is no room), clamped to 8–712 vertically. Longer than the overlay: Steam's scroll |
| Depth | +30 mm (popped interactive crop over the window cover, SP §2.6) | +30 mm |
| Motion | `morph-open` 607 ms from the source's rect; `morph-close` 441 ms; the source turns white while open | Same |

---

## 9. Library Filters (sheet)

The frame is window-nav's sheet (WN §5.4):

- 960 × 600 [720 × 450], radius 44, `thick`, +30 → +50 mm;
- close × circle at (24, 24), Title 2 "Library Filters" centred, "Reset" capsule at the 24 px inset;
- parent scrim .35;
- ornament "Y Reset · A Select · B Done".

The content is this concept's. It shows Steam's real options (INV-L §6.3).

| Element | px [pt] | Notes |
|---|---|---|
| Compatibility | A segmented control 64 [48] with Steam's four strings: "Verified Only · Verified and Playable · Verified, Playable, and Untested · All Games". Segment padding 12; all four fit the 912 px track at 22 px | T3. T1: Steam's four radio rows at 72 px |
| Sections | Label 22 px Bold secondary. Options as **chips**: capsules 60 [45] tall, padding 24, 22 px Semibold, gap 12. Selected = white .94 with a dark label and a check glyph. At most one row per section; the rest sit behind an "N More" chip that expands the section in place. Players: Single player, Multiplayer, Cooperative, Local Multiplayer. Play state: Ready to play, Installed, Played, Unplayed, + 1 More (Private) | T3. T1 fallback: Steam's checkbox rows at 64 px with 40 px boxes (hit area by padding; nodes unchanged) |
| Collapsed sections | A recessed platter (black .14, radius 30) of 72 px rows showing the current value and a chevron: Hardware support (Gamepad Support dropdown + 4 options), Features, Language (Any language), Genre, Store tags, Friends, Gameplay, Visual, Camera Comfort, Audio, Input | Text searches (store tags, friends) are 64 px fields inside the expanded rows |
| Footer | "Showing all 350 games" (Callout, secondary; the count comes from Steam's filtered collection) and a "Save as Dynamic Collection" capsule 60 px | Done = × or B (ornament) |
| Scroll | About 1.2 sheet heights (against 3.8 window heights today); 56 px scroll-edge fade | |
| Depth / motion | +30 → +50 mm on `sheet-in` 735 ms; scrim on `fade`; dismiss on `sheet-out` 514 ms | D2 §11.5, WN §5.4 |

---

## 10. Depth and glass plan (no ghosts)

### 10.1 The rule

From E2E §1, every pixel of Steam's real panel that shows content must be one of:

- **(a)** under an opaque glassd cover;
- **(b)** shown only at its own position, with no pop.

Rev 1 broke this on Home:

- the popped band (+10 mm) and the popped top row (+25 mm) had no cover, so off-axis they doubled;
- its glassd slabs existed only under pops, so without pops the discs fell back to a CSS tint.

### 10.2 The mechanism: covered plates

`p2_home-apps_depth.png`.

**1. Plates are cover shapes.**

- On a coverless route (Home, a folder), the reporter reports the main surface's cover with `shapes` = every plate on the page: the 13 discs, the top-row controls, and the open card or name plate.
- glassd draws real `liquid` glass inside each shape, opaque at +1 mm. Steam's panel at z 0 is hidden there.
- Partial covers for "Home-view plates" are listed as a glassd capability (NATIVE.md, SP §11.1 [PROVEN-P1]).

**2. The base mosaic covers only the plates' rows.**

- Its pieces are the bands the reporter declares (`data-lgs-mosaic`): the top-row band (y 18–82) and one band per honeycomb row (disc centre ± 66). That is about 4 pieces, well under 24 layers (SP §6.4).
- Outside the plates, Steam's panel alone shows its pixels: labels, dots, the transparent room. Nothing is drawn twice.

**3. Only the focused item pops.**

- It is an interactive in-place crop (SP §2.6) at +15 mm (0.041 u), with its `liquid` slab.
- Its cover shape stays at +1 mm under it, drawn in an **occluder** variant: the same glass at brightness .55 with no rim.
- Off axis you therefore see the lifted disc and, beside it, its plate's glass reading as its shadow, never a second copy.
- The pop retargets on focus change (one push) and animates on `depth`.

**4. Labels and page dots never pop** (D2 rule 10: text has no depth of its own).

### 10.3 Pop shift at 35° off axis, for reference

| Depth | Shift | CSS px |
|---|---|---|
| +10 mm | 7.0 mm | 9 |
| +15 mm | 10.5 mm | 14 |
| +25 mm | 17.5 mm | 23 |

On covered plates this shift reveals plate glass, not content, so any depth is safe. Home uses +15 mm (D2 D10).

### 10.4 Depths

| Element | mm | Scene units (r = 1) | Paired cue | Mechanism |
|---|---|---|---|---|
| Home and folder plates, art, top row | 0 (+1 cover, +2 mosaic) | 0 | Glass bezel and specular arc | Cover shapes + mosaic bands |
| Focused cell, card, name plate | +15 | 0.041 | Disc glow 26 px; card shadow 0 18 44 /.48 (CSS on the art) | One interactive crop + slab over its occluder plate |
| Labels, dots, peeks | 0 | 0 | Text shadow | Steam's panel only |
| Tab bar | +25 | 0.068 | — | window-nav (the popup's own transform, no crop) |
| "+" popup | +30 vs the bar | 0.081 | 0 12 36 /.32 | Popup request z [PLAUSIBLE] |
| Library window, ornament | 0 | 0 | — | window-nav (cover; ornament inset, WN D-7) |
| Library focused poster (+ its More circle) | +15 | 0.041 | 0 18 44 /.48 | Crop over the window cover |
| Menus | +30 | 0.081 | 0 12 36 /.32 | Crop over the window cover |
| Filter sheet | +30 → +50 | 0.081 → 0.136 | Scrim .35 | Crop over the window cover; `t1` tint for the dim (SP §5) |

**Rules for every crop:**

- Crops stay at their element's x/y: input lands on Steam's panel (D2 §3.8).
- Every lift is under 80 mm.
- Scene-graph pushes happen only while a depth value moves (SP §4.2).

### 10.5 Without glassd (CSS-only path, the default today)

`p2_home-apps_home-t1.png`.

- Steam's page cannot see the room, so a plate is a tint (black .58 with a white .16 → .04 gradient) plus the D2 §6.2 edge recipe.
- There is no frost and no pop.
- Every plate keeps a fill (SP §6.4 design rule), and labels keep the on-room shadow.
- This is the honest floor. Real glass on Home needs the native layer, as it does for every concept.

---

## 11. Motion summary

| Interaction | Token(s) | Notes |
|---|---|---|
| Enter Home (route) | `page` 662 ms content fade + ≤ 16 px parallax. Plates materialize (glass 0–92 %, content 35–100 %), scale from `1 + 12/120 = 1.10` riding the glass channel. 30 ms stagger by ring distance from the focused cell, ≤ 3 rings | D2 §11.4 C1–C3, list insertion. glassd runs the plates' `m` ramp (D2 §11.8) |
| Section change (LB/RB, segment) | Pill travel `snappy` 488 ms; old grid fades 150 ms linear; new grid `page` 662 ms with 16 px parallax in the travel direction | M1: no lateral slide over 24 px |
| Page change | As a section change; the active dot moves on `snappy` | |
| Focus a cell | `hover-in` 294 ms (out `fade` 441 ms); depth on `depth` 441 ms | Retarget, never queue (C5) |
| Name plate | After 0.4 s: `materialize-in` 250 ms; out 350 ms | |
| Card ramp | After 0.8 s: `morph-open` 607 ms; close 0.3 s after blur on `morph-close` 441 ms | glassd morphs the cover shape (SP §11.2 item 5); until that is acked, CSS glass draws the morph (NATIVE "ack mode") |
| Press | `interactive` 210 ms swell ≤ ×1.06 (glass only); release glow 90 ms; `snappy` swell back | |
| Open a folder / What's New | Route `page` 662 ms; the folder disc's plate materializes out and the new page's plates materialize in | No zoom over 1.5 % |
| "+" popup | `materialize-in` 250 ms / `materialize-out` 350 ms | |
| Menus | `morph-open` 607 / `morph-close` 441 | |
| Filter sheet | `sheet-in` 735 / `sheet-out` 514; scrim on `fade` | |
| Library tab switch | Steam's slide shortened to ±16 px + fade on `page`, through transition durations only | D2 §11.5 note |
| At rest | Nothing animates (`document.getAnimations().length === 0` one second after any interaction) | C7 |
| Reduce Motion | Fades of 150–200 ms only; depth pushed once at the end; morphs become cross-dissolves | C8 |

---

## 12. Function retention table

**Scope.** Every function from LA §A (library-apps), plus the SN §A rows that live on these screens.

**Columns.**

- "Laser" = the controller laser.
- "Gamepad" = Steam's FocusNavController.
- The new path's tier is in brackets.
- Unless stated, the fallback path is Steam's own control, restyled (T1).

### 12.1 Library home (LA A.1)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| H1 | See recent games (MRU, 20) | Home › Recent, 2 pages; the running game first with a green dot [T3] | Look; focus by hover shows the card | D-pad; focus shows the card |
| H2 | Open a game's page | A Recent cell's activation | Click the disc, or the card outside Play and More | A |
| H3 | Game tile menu (Play/Install, Favorites, Add to, Manage, Properties) | The card's More circle; ≡ | Dwell 0.8 s, click More (**new: no laser path today**) | ≡ on a cell |
| H4 | Go to the library ("View more in your Library") | The All Games folder, cell 13 of each Recent page; the tab bar's Library | Click the folder, or the tab bar's Library | D-pad to All Games + A; or Left at page 1's edge into the tab bar, then Library + A |
| H5 | Switch feed: What's New / Friends / Recommended | `/library/lgs/steamhome` (Steam's Home page with its tab row) [T3] | Click What's New, then Steam's segments | Up to the top row, Right to What's New, A; then Steam's LB/RB and D-pad |
| H6 | What's New cards (sale, recently updated, trending, offers) | What's New route, unchanged | Click | Focus + A |
| H7 | Friends feed (playing now, activity, comment/like/rate) | What's New route, Friends tab | Click | Focus + A |
| H8 | Recommended (calendar, queue, play next, new releases, top sellers) | What's New route, Recommended tab | Click | Focus + A |
| H9 | Background art of the focused game | The card's hero art (Home); Steam's background on the What's New route | Passive | Passive |

### 12.2 Library tabs and grid (LA A.2)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| L1 | Switch tab (All Games, Great On Frame, Ready To Play, Collections, Non-Steam, Soundtracks, conditional tabs) | Steam's tab row as a segmented control; the same sets as Home › Collections folders | Click a segment or a ‹ › circle | LB / RB; or Up to the row + Left/Right |
| L2 | VR sub-filter All / VR / Non-VR (Ready To Play: All / Standalone / Remote PC) | Steam's control in its stock position, restyled [T1] | Click a segment | Up from the grid + Left/Right + A (stock) |
| L3 | Browse the grid | Steam's virtualized grid, restyled | Wheel/drag scroll; hover lifts | D-pad; the page scrolls |
| L4 | Fast scroll by letter | Steam's fast-scroll overlay (unchanged) + letter scrubber [T3] | Click/drag the scrubber (**new**) | Steam's fast-scroll, unchanged |
| L5 | Open a game | Poster activation | Click | A |
| L6 | Sort (10 options, persisted) | Ornament slot 1, current sort shown in both modes → glass menu with the current sort checked | Click slot 1 (Steam's Sort button) | Y |
| L7 | Filter | Ornament slot 2 → Filters sheet | Click slot 2 (Steam's Filter button) | X |
| L8 | Tile menu | More circle in the hovered/focused poster [T2]; ornament slot 3 Options | Click More (**new direct path**) or slot 3 | ≡ |
| L9 | "N apps hidden due to filter" (button variant clears) | Capsule notice above the grid | Click | Focus + A |
| L10 | Back | Toolbar Back circle (WN) | Click | B |

### 12.3 Game tile and its menu (LA A.3)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| T1 | Primary action Play / Install / Launch / Download / Update | First menu row with its semantic whole fill; Home card's Play capsule; search X (S-C) | Click | ≡ → A; **X on a Home cell or a search item** |
| T2 | Add to / Remove from Favorites | Menu row | Click | Menu + A |
| T3 | Add to › (collections, New collection…) | Submenu beside the menu | Click | Right / A |
| T4 | Manage › | Submenu | Click | Right / A |
| T5 | Developer › | Submenu (developer mode) | Click | Right / A |
| T6 | Properties… | Menu row | Click | A |
| T7 | Cancel | Quiet 56 px row; click outside | Click | B |
| T8 | Status on the tile (compatibility, download progress, update, friends playing, coming soon, locked, copies, missing-art title) | Library: Steam's badges restyled; Home: icon states + card (§3.3) | Look | Look |

### 12.4 Library Filters (LA A.4)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| F1 | Frame compatibility level (4, persisted) | Segmented control at the top of the sheet [T3] / Steam's rows at 72 px [T1] | Click | Left/Right + A [T3]; Up/Down + A [T1] |
| F2 | 47 checkboxes in 11 sections + Gamepad Support and Language dropdowns | Chips (one row per section + "N More") and collapsed rows [T3] / Steam's rows at 64 px with 40 px boxes [T1] | Click | D-pad + A |
| F3 | Store tags / Friends text search | 64 px fields inside their expanded rows | Click → keyboard | Focus + A → keyboard |
| F4 | Reset | Header capsule; ornament "Y Reset" | Click | Y, or D-pad + A |
| F5 | Save as Dynamic Collection | Footer capsule | Click | D-pad + A |
| F6 | Close | × circle; click outside | Click | B ("Done") |

### 12.5 Collections, Non-Steam, Soundtracks (LA A.5, A.6)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| C1 | Browse collections | Home › Collections folders (empties grouped); Library Collections tab (restyled tiles) | Click | D-pad + A |
| C2 | Open a collection | Home: `/library/lgs/folder/<id>` + "Show in Library"; Library: Steam's `/library/collection/<id>` | Click | A |
| C3 | Back to all collections | Folder: Back/B (history); Library: toolbar Back | Click Back | B |
| C4 | Create / edit collections | Tile menu Add to › New collection…; Filters › Save as Dynamic Collection | Click | Menu / sheet |
| N1 | Browse and open Steam shortcuts | Library Non-Steam tab (title cards restyled); Home › Collections › Non-Steam folder; Recent when played | Click | D-pad + A |
| N2 | First-run "Add Chrome" dialog and Learn More (empty tab only) | Unchanged in the Non-Steam tab | Click | Focus + A |
| N3 | Soundtracks | Library Soundtracks tab; Home › Collections › Soundtracks folder (header crops) | Click | D-pad + A |

### 12.6 Search (LA A.7; SN A.1 H2–H4, A.2): owner window-nav

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| SN-H2 | Start a search | Steam's search: a 60 px circle on Home and folders; window-nav's capsule elsewhere | Click the circle or the field | Up from a page's top row (Home: Up twice, via the section row) |
| SN-H3 | Type / edit the query | Steam's VR keyboard (+ echo row, WN §4.5) | Click keys | D-pad + A on keys |
| SN-H4 | Clear the query | Clear × as a 44 px circle in the field (WN) | Click | Backspace on the keyboard |
| S1 | Switch result category (All, Library, Friends, Store, Tools, Hidden) | window-nav's segmented control | Click | LB / RB; Up to the row |
| S2 | Open a result | window-nav's summary and Steam's grids; **programs: Top Hit and the Apps cell [T3, S-A/S-B]** | Click | D-pad + A; X = Play on library items (S-C) |
| S3 | "View more in the Store" | Steam's Store grid, via window-nav's Store hand-off | Click | Focus + A |
| S4 | No results | Steam's "No Results Found", restyled (WN) | Look | Look |

### 12.7 The "+" popup (LA A.8)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| P1 | Open the list | Steam's + button (white while open) | Click + | View → bar, Left/Right to +, A |
| P2 | Launch a program (24 rows, 23 programs + the switch) | 4-column grid in the popup, all visible [T1/T3]; Home › Apps [T3]; search Apps cell [T3] | Click a cell | D-pad + A |
| P3 | Toggle Liquid Glass | **Popup only:** toggle row [T3] or Steam's own row with a green pip [T1] | Click | D-pad + A (never default focus in T3) |
| P4 | Add a desktop window to VR | Popup "Windows" group first; Home › Windows section | Click | D-pad + A |
| P5 | Close the list | Click outside; auto-close after 2 s; opening another popup | Click elsewhere | B |

### 12.8 Running apps in the bar (LA A.9)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| R1 | Switch the dashboard to a frame | Bar tab (bar/system concept); Home: the running game's card Play = Steam's primary action for a running game | Click | View → bar + A |
| R2 | Tab menu of a frame (incl. Close) | Bar (unchanged here) | Hover the tab | Focus the tab, Up |
| R3 | Identify a running item | Bar tooltips; Home green dot and "Running" on the card | Hover | Focus |
| R4 | "Current Game" on Home | Recent page 1, cell 1, green dot | Look | Look |

### 12.9 Navigation shared with the shell (SN A.3, A.4)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| SN-N2 | Open the tab bar from a page's left edge | Unchanged on every route. On Home it works from page 1 (Left at a row's start); later pages page back first | Click a tab bar item | D-pad Left at page 1's left edge |
| SN-N3 | Open the tab bar with B at the root | Unchanged (the Home root does not handle B) | — | B |
| SN-F1 | Footer legend actions (X Filter, Y Sort By, ≡ Options, A Select, B Back) | window-nav's bottom ornament; library slots per input mode (§7.1) | Click the button (laser-mode nodes, or T2 Options) | The physical button |

**Count:** 59 functions (53 from LA §A + 6 from SN §A); 59 mapped, 0 dropped. A.10 states are covered in §3.3 (Home) and §7 (Library).

---

## 13. Implementation tiers, evidence and fallbacks

| Element | Tier | Evidence | Status | Fallback |
|---|---|---|---|---|
| Home route override | T3 | SR §3.5: our page rendered at `/library/home` with controller focus; `clearOverrides()` restored Steam's Home (774 nodes). SR §5: 90 fps, 43 nodes | PROVEN | Steam's Home, T1 restyle (§3.7) |
| Folder and What's New routes (`/library/lgs/…`) | T3 | SR §3.4: patching a route fiber's type [PROVEN]; `steamChildren` handed to the override (SR §3.5) | Routes PROVEN; rendering `steamChildren` in our route PLAUSIBLE | Folder → Steam's collection page. What's New → our error boundary offers "Show Steam Home", which clears the override for the session |
| Windowless Home with **plate cover shapes** | T1 + T5 | SP §6.4 E6 (transparent Steam window over the room); NATIVE.md partial covers "for Home-view plates", SP §11.1 [PROVEN-P1]; `theme/layers.json` main cover excludes the transparent Home | Visually PROVEN; per-plate shapes PROVEN-P1; not yet run with the Phase 2 reporter | CSS plates (§10.5) |
| Mosaic restricted to declared bands | T5 daemon | The daemon decomposes the mosaic itself (NATIVE.md "guillotine cuts") | PLAUSIBLE (a reporter attribute and a daemon change) | Full mosaic: labels drawn at 0 and +2 mm (≈ 1.8 px at 35°), a minor softening, no doubling of popped content |
| Occluder variant of a cover shape | T5 | glassd's per-shape tint (SP §11.2 "per-slab offset and tint" needed changes) | PLAUSIBLE | The plain `liquid` cover under the pop (reads as a socket) |
| Focused-item pop at +15 mm | T4 | SP E1 (interactive crop registration), SP §4.2 (push animation 60/s, 1.6 ms CPU per push); E2E: pops render in front with their slabs | Registration PROVEN; click on a popped crop PLAUSIBLE | No pop (glow and scale only) |
| Laser on transparent texels between plates | — | SP §6.4 | UNPROVEN | Harmless: a hit on empty page area does nothing; a pass-through hits the room |
| Section control in the header band | T3 | `#header` is `pointer-events: none` except its children (INV-S §3.2) | Source-verified; not exercised with the taller header (CQ1, WN Q1) | Place the row at y 108 and shift the grid down 24 px (row pitch 180) |
| Honeycomb with explicit neighbours | T3 | `onMoveUp/Down/Left/Right` are `Focusable` props (SR §3.6); `grid` / `geometric` proven on a 3 × 2 grid (SR §4) | PLAUSIBLE | 5 × 3 square lattice with `flow-children: grid` |
| LB/RB, X, ≡ on Home | T3 | `onButtonDown`, `onSecondaryButton`, `onMenuButton`, EGamepadButton 3, 5–8, 14 (SR §3.6). X is delivered in VR (Steam's legend shows "X Filter", INV-L §1.3) | ≡ PROVEN live (SR §4); X and bumpers PLAUSIBLE | Every section and page is reachable by D-pad (AT-3j) |
| Card ramp and name plate (focus-driven, hysteresis) | T3 | Plain DOM in our page; `onGamepadFocus`/`onGamepadBlur` (SR §3.6) | PLAUSIBLE | Name plate only; Play via X and the game page |
| Game art (hero + logo, custom art) | T3 | SR §3.7 (`BuildCachedLibraryAssetURL`, `GetCustom*ImageURLs`); live read: all 20 Recent items have hero + logo; 322/350 games have logos (LA §0.3) | Data PROVEN (read); rendering PLAUSIBLE | Portrait crop (proven in `p2_react_proto_home.png`), then monogram |
| Program icons at 64 px | T3 | `strIconDataBase64` 64 px (LA §0.3; fetched for this revision) | PROVEN | Theme icons need the daemon (LQ4, UNPROVEN) |
| "+" popup 4-column grid | T1 | No `flow-children` on the list (LA LQ1), so Steam infers the grid from computed style (D2 §12, GP §0.5); raise `max-height` 600 → 760 | PLAUSIBLE | Steam's list restyled as 64 px rows with 40 px icons |
| "+" popup A–Z, plates, toggle row, preferred focus | T3 | The popup's memo fiber `{allowLaunchProgram}` located; same type-swap as the route switch (SR §3.2, §8) | PLAUSIBLE (not patched) | T1 grid in scan order (`p2_home-apps_plus-t1.png`) |
| All Apps → Home › Apps from the bar | T3 | LQ5 | UNPROVEN | Circle hidden; Home › Apps via the tab bar |
| Popup +30 mm | T4 (Steam side) | SP §3.3 wrapper of `SendPendingInstanceParamsToSteamVR`; parameter path exercised in E2 | PLAUSIBLE | Steam's +3.7 mm |
| Search contributions (S-A, S-B, S-C) | T3 in window-nav's `LgsSearch` | WN §4.7 (override of `Routes.Search.Root()`, SR §3.5 mechanism) | Depends on WN's AT-9 | Programs not in search; Home › Apps and "+" remain |
| Library ornament slots | T1 + T2 | WN §3.4 (ornament from `#Footer`); laser-mode pill is laser-only, so moving it is safe for focus (INV-L §6.1) | PLAUSIBLE | Steam's pill and legend restyled in place (two capsules) |
| More circle in posters | T2 | `vgp_onmenu` (button 14) dispatch on `%{LibraryItemBox}` opens the capsule menu (INV-L §0.3) | Dispatch PROVEN; capture-phase isolation PLAUSIBLE | Ornament slot 3 |
| Letter scrubber | T3 | Writes `scrollTop` on Steam's grid scroller (a wheel-equivalent) | PLAUSIBLE | Steam's gamepad fast-scroll only |
| Larger posters (200 × 300) | T3 | LA LQ2 (props of Steam's CSSGrid) | UNPROVEN | Steam's 172 × 258 (the baseline shown) |
| Anchored menus | T3 | CQ10 | UNPROVEN | Centred menus, D2 §3.7 look |
| Filter sheet with chips | T3 | Type swap of Steam's filter dialog component (SR §3.4 technique) | PLAUSIBLE | T1: Steam's dialog, 64 px rows, 40 px boxes, thick glass, sheet depth |

---

## 14. Acceptance tests (agents only)

**General rules:**

- Every step runs inside the locked lab commands (LAB.md).
- Launch calls are **logged, never executed.** The test build of every T3 view replaces the following with a logger that records `{fn, arg}`, as `react_proto.js` does: `LaunchNonSteamApp`, `DashboardDesktopWindowClicked`, Steam's primary-action call, and `Navigate` to a game page.
- Before any `L.pad` sequence, call `inst.FocusApplicationRoot()` (SR §4).

| ID | What | How | Pass |
|---|---|---|---|
| AT-1 | Home renders | `python glass.py shot main p2_home-apps_live_recent --route /library/home` | 13 cells, 2 dots, top row with 3 segments + What's New + search circle; side by side with `shots/p2_home-apps_home.png` (same 12 games, same order) |
| AT-2 | Lattice and top-row geometry | `glass.py js` reading rects | Column pitch 224 ± 2, row pitch 188 ± 2, disc 120; top-row controls 60–64 tall; the 4 top-row centres ≥ 80 apart |
| AT-3 | Gamepad traversal | `L.pad` from cell 1: (a) Right ×3; (b) every cell reachable (BFS over the 4 directions); (c) for each cell, Down-Up and Up-Down return to it; (d) Right at row 1's end → page 2, row 1; (e) RB → Collections, LB back; (f) LT/RT page (skip if not delivered); (g) Left at page 1's left edge → `.gpfocus` in `frame.menu`; (h) B at root → `frame.menu`; **(i)** RB from Apps wraps or stops without entering What's New; on `/library/lgs/steamhome`, RB changes Steam's feed tab and B returns to `/library/home`; **(j)** **D-pad only**, no LB/RB/LT/RT: reach every section (Up to the row, Left/Right, A) and every page (Right past row ends) | All pass; `L.focused('main')` never empty inside the page |
| AT-4 | Launch wiring | Click and A on: a game (expect `Navigate /library/app/<id>`); a game's X and the card's Play (expect the same `{fn}` as Steam's tile-menu Play for that app, compared by function identity); a program (expect `LaunchNonSteamApp` with the same `strCmdline` as Steam's popup row of that name); a folder (expect `/library/lgs/folder/<id>`); All Games (expect `/library/tab/AllGames`); What's New (expect `/library/lgs/steamhome`) | All logged calls equal Steam's |
| AT-5 | Switch safety | (a) T1 only and T3 on: `glass.py js` finds the row whose text is exactly "Liquid Glass" in `barpopup` after the OPEN pre (INV-B §0.3); (b) Home › Apps lists no cell named "Liquid Glass"; (c) the search summary for "liquid" shows no program cell or Top Hit for it; (d) T3 popup: the first `.gpfocus` after opening by gamepad is the first program cell, not the toggle row; (e) the toggle row while main is on `/library/lgs/folder/…` logs `Navigate('/library/home', replace)` **before** the launch | All pass |
| AT-6 | No functional loss | `glass.py audit main --route /library/lgs/steamhome`; `audit main --route /library/tab/AllGames`; `audit main --route /library/tab/Collections`; `audit barpopup --pre <OPEN '+'>`; `audit main --pre <Sort snippet>`, `<capsule menu snippet>`, `<Filter snippet>` (INV-L §0.3) | 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST (search: WN AT-4) |
| AT-7 | Sizes and type | `glass.py styles` over our nodes + a rect scan of every focusable | No focusable < 80 × 80 unless its centre is ≥ 80 px from every other (popup: 72 popup px); card Play/More centres 180 apart; More circle 60 visible with an 80 hit, fully inside its poster; no text < 18 px (popup 15); no uppercase, italics or positive tracking in chrome |
| AT-8 | Card ramp (both inputs, one mechanism) | (a) Focus a game by `L.pad`; shots at 0.5 s and 1.5 s (`--settle`): no card, then card; (b) jitter: two `L.pad` moves within 0.3 s, shot at 1.2 s: no card; (c) blur: card gone 0.3 s + 441 ms after focus leaves; (d) static: our CSS has no `:hover` selector that shows the card or plate, and the card's state is set only in `onGamepadFocus`/`onGamepadBlur`; (e) rects: the card overlaps no other disc by more than 16 px; (f) after opening the card, a synthetic click on Play logs Play and the route does not change | All pass |
| AT-9 | Motion | `document.getAnimations()` during and 1 s after: section change, page change, focus move, ramp, menu open, sheet open | Durations ∈ D2 §11.2 tokens; easing a `--lgs-ease-*` curve or linear; 0 animations at rest; filmstrips `shots/p2_motion_home_ramp_<f>.png` at f = 0, .15, .35, .5, .75, 1 show glass before content |
| AT-10 | Depth | `__LGS_SG.dump()` with Home open and a cell focused; then with the tile menu and the Filter sheet | Focused cell 0.041 ± 0.005 u, menu 0.081, sheet 0.136; each crop interactive with app id 769 (`DumpLaserOverlays`); exactly one pop on Home |
| **AT-10b** | **No ghosts (static)** | On the same dump, for every surface whose cover is partial: (1) each pop's rect, inflated by 2 px, lies inside the cover shapes; otherwise its slab contains its content rect inflated by dz × tan 35° / 0.77 mm; (2) outside the cover shapes, the mosaic pieces cover no Steam texel with alpha > 0.05 (checked against a transparent `glass.py shot` of the same state) | Both hold for Home, a folder and the library window |
| AT-10c | No ghosts (look) | One off-axis `hvgrab` with a cell focused, taken while the dashboard is turned about 30° (look, then delete) | One copy of the icon; its plate visible beside it as glass; labels single |
| AT-11 | Performance | `glass.py perf main --route /library/home --pre <page through 10 pages>`; `perf main --route /library/tab/AllGames`; GPU time from `glassd-out.json`; `img.naturalWidth` of visible icons | fps within 5 % of stock, no frames > 34 ms; heroes decoded only for the visible page; program icons at 64 CSS px from ≥ 64 px sources; glassd ≤ 2.5 ms |
| AT-12 | "+" popup | OPEN pre, then `L.pad` inside `barpopup`: every cell reachable; Down-Up returns; B closes; rect scan | Computed `display` of the list is `grid` with 4 columns; with 23 programs and no extra groups, every cell's rect lies inside the scroller's client rect (no scroll); every label ≤ 70 px wide and ≤ 2 lines; the name plate stays inside x 0–300 |
| AT-13 | Search contributions | WN AT-9 steps with "half": the Apps cell lists "Half SBS Toggle"; A on it logs `LaunchNonSteamApp` with Steam's `strCmdline`; X on the Top Hit logs Steam's primary action; with "vlc" the Top Hit is the program "VLC media player" and Open logs its launch | All pass |
| AT-14 | Library | (a) `L.click` on a T2 More span: the route is unchanged and the menu labels equal those of the `vgp_onmenu` menu for that poster; (b) scroll the grid 2,000 px and back: exactly one More span per rendered `%{LibraryItemBox}`; (c) a scrubber click on "M" scrolls so the first visible poster's title starts with "M"; (d) **both input modes**: stub `lgsInputMode()` (our T2 only, never Steam's getter) to `mouse`, then `gamepad`; shot + audit each | (a)–(c) pass; (d) the ornament's width is identical (± 1 px) in both modes, all 5 slots are present, and every slot's click is handled (logged) |
| AT-15 | Filters | (a) Filter snippet, then `L.pad` through every control; (b) `audit` with the sheet open; (c) sheet crop depth | All pass |
| AT-16 | Removal | `lgs off` path: `remove()`; navigate `/library/home` | Steam's Home (774 nodes ± 5 %); no `[class*=lgs]` nodes; history entries under `/library/lgs/` fall back to Steam's library |
| AT-17 | Headset view | One `hvgrab` frame each of Home, the "+" popup, the catalogue with a menu, and the Filter sheet (look, then delete) | Labels legible over the room; glass L 55–110; no closed outline on any glass edge |
| AT-18 | Accessibility | CDP `Emulation.setEmulatedMedia` with reduced motion and `prefers-contrast: more`, inside a lab lock | Fades only; near-opaque glass with the 2 px edge; contrast audit clean |
| AT-19 | Real-data parity of the mockups | Re-run `fetch-library-refs.py`, re-render every mockup, compare names and order with AT-1's live shot | Same names, same order; differences explained by real changes in the library |

---

## 15. Risks and open questions

| # | Item | Mitigation |
|---|---|---|
| 1 | HA-3 changes D2 §3.5's LB/RB meaning on Home | Sign-off by the DESIGN2 owner. If refused, LB/RB turn pages and sections stay on the D-pad path |
| 2 | The honeycomb neighbour map is untested live | AT-3; square-lattice fallback |
| 3 | The header band is shared with our section row (CQ1, taller header) | AT-1 and AT-3; fallback places the row under the band |
| 4 | Partial-cover plates have not yet run with the Phase 2 reporter; the mosaic bands and the occluder variant need daemon changes | AT-10b and AT-10c; CSS plates as the floor; the full mosaic softens labels slightly at most |
| 5 | "+" popup T3 patch and the All Apps route jump (LQ5) | T1 grid fallback; All Apps hidden |
| 6 | T1 popup: Steam's default focus may land on Liquid Glass (stock behaviour) | T3 fixes it; until then it is unchanged from today, and the pip shows that A would act on the theme |
| 7 | Larger posters need the grid props patch (LQ2) | Steam's 172 × 258 is the baseline |
| 8 | Hero decode cost on the shared GPU (LQ6) | Heroes only for the visible page and the open card; portraits for peeks |
| 9 | Laser on transparent texels (SP §6.4) | Harmless either way; verify with the wearer when available |
| 10 | Session MRU of programs is in memory only and resets with Steam | Intended (no persistence) |
| 11 | window-nav must adopt the search contributions and the windowless-Home exception | `concepts/xc-home-search.md` holds the text; the coordinator merges |
| 12 | window-nav's laser-mode ornament builder drops the A/B legends that Steam renders in laser mode (audit HIDDEN risk) | home-apps keeps them in slots 4–5; reconcile with window-nav (`xc-home-search.md` §3) |

---

## 16. Cross-concept agreements

| With | Agreement | Where recorded |
|---|---|---|
| window-nav | Search is window-nav's route; this concept adds programs in the ranking, the Apps cell and X = Play (§6) | `xc-home-search.md` §2 |
| window-nav | `/library/home` and `/library/lgs/folder/*` are **windowless**: no window cover; plates as cover shapes; one pop on focus (§10). `/library/lgs/steamhome` is a normal window (WN §3.1) | `xc-home-search.md` §1 |
| window-nav | The Home field is WN's circle variant; the field has no microphone anywhere | §3.1, §6 |
| window-nav | Library routes: the bottom ornament's five fixed slots per input mode (§7.1); the Filters content inside WN's sheet frame (§9) | §7.1, §9 |
| control-center | The Liquid Glass switch stays only in the "+" popup (CC row "+": "Liquid Glass stays a row there") | HA-10 |

---

## 17. Critique responses (revision 2)

| # | Critic's issue | Response | Where |
|---|---|---|---|
| 1 | **Blocker:** a windowless Home with uncovered pops ghosts, and without pops the glass falls back to tint | **Accepted. Mechanism chosen: covered plates.** Every plate is a glassd cover shape (opaque at +1 mm, Steam's panel hidden under it). The mosaic is restricted to the plates' bands. Only the focused item pops (+15 mm), over its own plate in an occluder variant. **Not chosen, option (a)** (opacity 0 on `t1` + full mosaic): it depends on the main panel staying a laser target at opacity 0, which only a wearer can confirm, and a full mosaic with holes approaches the 24-layer limit. **Not chosen, plain option (b)** (slabs inflated by dz · tan 35°): it needs 9–23 px of empty glass around every popped element, and it still leaves unpopped discs without glass. **Correction to the critic's numbers:** "≈ 7 px at +10 mm, ≈ 18 px at +25 mm" are millimetres; in CSS px they are **9 and 23** (0.77 mm per px). AT-10b (static) and AT-10c (off-axis look) added | §2 HA-1, §10, §14, `p2_home-apps_depth.png` |
| 2 | Conflict with window-nav over search, Home's glass and field geometry | **Accepted.** window-nav owns search. Contributions: programs in the ranking, the Apps cell, X = Play. The field is WN's spec, with WN's circle variant on Home. The Home exception and the contributions are written up for WN | §6, §16, `xc-home-search.md`, `p2_home-apps_search.png` |
| 3 | A dead microphone in the search field | **Accepted.** Removed everywhere; the clear × is the only control in the field (WN D-8) | §3.1, §6 |
| 4 | The Liquid Glass switch as default-focused cell 1 of Apps, drawn white like a selection; also in search | **Accepted.** Removed from Apps and search. In the "+" popup: T3 toggle row, never default focus; T1 normal cell with a green pip. AT-5 extended (b–e) | HA-10, §4, §5, AT-5 |
| 5 | Card circles at a 68 px pitch; Play not one click; jitter; hover-keyed and untestable | **Accepted.** A Play capsule and a More circle, 180 px apart, with non-overlapping 80 px hits. Hysteresis (0.8 s inside the disc circle; close 0.3 s after blur; two moves within 0.3 s open nothing). Driven by `onGamepadFocus`/`onGamepadBlur`, which laser hover also triggers. §1.2 reworded. AT-8 (a–f) | §3.4, §1.2, AT-8 |
| 6 | Poster More circle: 52 px, on the corner, click bubbles, recycling | **Accepted.** 60 px with an 80 px hit, inside the poster (inset 10). Capture-phase `preventDefault` + `stopPropagation`, then `vgp_onmenu`. A `MutationObserver` re-attaches it on recycle. AT-14a/b | §7, §7.2 |
| 7 | The library toolbar ignores laser and gamepad modes | **Accepted.** Five fixed slots (880 px in both modes), filled from Steam's laser-mode pill or legend; T2 Options in laser mode; current sort shown in both. AT-14d tests both by stubbing only our own mode function, since faking Steam's getter would affect every agent (INV-L §6.1). The VR sub-filter stays in its stock position | §7.1, AT-14d |
| 8 | LB/RB mean two things inside What's New; bumper badges | **Accepted.** What's New is its own route; LB/RB on Home only change sections. **Partly different fix for the badges:** instead of reading the controller's button set, Home follows Steam's own VR convention (arrows instead of bumper glyphs, INV-L §1.4) and shows no bumper badges at all. AT-3 (i), (j) added | HA-2, HA-3, §3.6, AT-3 |
| 9 | The "+" popup still hides about 44 % | **Accepted, option (a):** 4 columns of 72 × 96 popup px (side padding 6, so 72 px rather than 69), 52 px discs. All 23 visible in 576 px; panel 726 = 26.9° against 22.2° today. Option (b) is rejected: 35° tall. The Windows group and the session "Recent" row come first when present; with them the grid scrolls by at most 1.4 rows | §4, `p2_home-apps_plus.png`, AT-12 |
| 10 | Invented mockup data and too-crisp icons | **Accepted.** Mockups use the Frame's real data through a read-only fetch script (git-ignored refs, licence kept). Icons at 64 CSS px, their source size (the D2 §9.3 1.5× texture cap; 38–47 display px). The honest renders exposed issues that changed the design (§0.2) | §0.2, HA-12, all renders |
| 11 | The Home's top band is heavier than visionOS Home | **Accepted.** 60–64 px controls; a centred 3-segment control without badges; a search circle instead of a field; What's New as one small capsule. About −44 % glass area | §3.1 |
| — | AT-10 checked only crop depths | **Accepted.** AT-10b and AT-10c added (see 1) | §14 |

---

## Sources

- **Phase 2 design system:** `docs/phase2/DESIGN2.md`.
- **Audits:** `docs/phase2/audit/library-apps.md`, `shell-nav.md`, `system.md`.
- **Capabilities:** `docs/phase2/capabilities/steam-react.md`, `spatial.md`, `native-e2e.md`.
- **Other concepts:** `docs/phase2/concepts/window-nav.md`, `control-center.md`.
- **Research:** `docs/phase2/research/visionos.md`, `references.md`, `liquid-glass-motion.md`.
- **Inventories:** `docs/inventory/library.md`, `bar.md`, `shell.md`.
- **Native layer and lab:** `docs/NATIVE.md`, `docs/LAB.md`.
- **References:** `docs/refs/visionos/1–12`.
- **Mockup kit:** `docs/phase2/mockups/kit.css`, `kit.js`, `window-nav-shared.css/js`.
- **Live read-only data** (2026-10-07): via `mockups/fetch-library-refs.py`.
