# UX audit: library, search and launching programs (`audit:library-apps`)

Scope: everything a user browses or launches from:

- **Library home** (`/library/home`): Recent Games shelf and the What's New / Friends / Recommended tabs.
- **Library** (`/library/tab/*`): tabs, VR sub-filter, the game grid, game tiles (capsules) and their menu, Sort, Filter, collections, Non-Steam, Soundtracks.
- **Search results** (`/search/tab/*`). The header field itself is covered in `shell-nav.md` §C.1.
- **The dashboard bar's "+" popup**: "Add Desktop Window" and "Launch Program". This includes how programs are discovered and launched, and where their icons come from.
- **Running apps and desktop windows in the bar** (bar tabs).

It ends with a dedicated evaluation (§D) of turning Library and Launch Program into a visionOS Home-view style grid of circular icons.

Audited live on 2026-10-07 with the Phase 1 theme on and off, using the same Steam build as `shell-nav.md`. Inputs:

- `docs/inventory/library.md` and `bar.md` (stock DOM, states, never-click lists);
- `docs/phase2/research/references.md`, `visionos.md` and `liquid-glass-motion.md`;
- the bible rulebook (`../.claude/skills/run-liquid-glass-frame/references/design-language.md`);
- the sibling audit `docs/phase2/audit/shell-nav.md`;
- the T3 capability prototype `device/proto/react_proto.js` and its shots (`shots/p2_react_proto_*.png`).

`docs/phase2/capabilities/` was still empty when this was written. §C.0 lists the open capability questions (LQ1–LQ10) that each proposal depends on.

Evidence tags: **[measured]** = read live on the Frame for this audit; **[source]** = read from Steam's webpack code on the device; **[inventory]** = from the Phase 1 inventories; **[inferred]** = my reading, to be verified.

---

## 0. Evidence and units

### 0.1 Shots taken for this audit (`shots/`, 1.5x, transparent = room)

| file | what it shows |
|---|---|
| `p2_lib_collections_on.png` | Collections tab: 9 tiles, 8 of them empty. The laser-mode Sort/Filter pill is visible |
| `p2_lib_nonsteam_on.png` | Non-Steam tab: 54 shortcuts. Many show a title card or an empty tile instead of art |
| `p2_lib_collection_vr_on.png` | The "VR" collection page (27 games). The laser Sort/Filter pill and the gamepad footer legend are both shown, stacked |
| `p2_lib_soundtracks_on.png` | Soundtracks tab: square art. The pill and the footer legend touch |
| `p2_lib_sortmenu_on.png` | Sort menu: 10 options + Cancel, centred over a blurred grid |
| `p2_lib_capsulemenu_on.png` | A game tile's menu (3dSen, not installed): Install, Add to Favorites, Add to ›, Manage ›, Developer ›, Properties…, Cancel |
| `p2_lib_filter_on.png` | Library Filters dialog, top (opened with the laser-mode Filter button, closed by the lab step) |
| `p2_lib_pad_grid_on.png` | **Gamepad traversal**: `L.pad` Down 1, Right 2, Down 1 from the first tile lands on row 3, column 3 (Arizona Sunshine Remake). Shows focus, the scrolled grid and the sub-filter floating over game art |
| `p2_lib_plus_on.png` / `p2_lib_plus_off.png` | "+" popup ("Launch Program"), themed and stock |

Reused from other Phase 2 work: `p2_audit_home_on/off`, `p2_audit_alltab_on/off`, `p2_audit_search_on/off`, `p2_audit_bar_on`, `p2_ref_current_launchlist.png`, `p2_react_proto_home.png` and `p2_react_proto_focus.png` (circles built from Steam art at `/lgs/proto`). Phase 1 stock shots: `library_*.png` and `bar_*_before.png` (inventories).

### 0.2 Physical scale

| surface | angle per CSS px | 2.5° target (visionOS 60 pt) | source |
|---|---|---|---|
| main window (library, search) | **0.0307°** (0.766 mm at 1.43 m) | **81 px** | `visionos.md` §1.2 |
| bar and bar popups (the "+" list) | **0.037°** (0.847 mm at about 1.30 m; the bar is 0.13 m nearer) | **67 px** | `shell-nav.md` §0.2 |

visionOS body text (17 pt) is about 0.70° (23 px in the main window). Minimum text (12 pt) is about 0.49° (16 px).

### 0.3 Live data read for this audit

- **Counts** [measured, `collectionStore` / `appStore`]:

  | list | shown |
  |---|---|
  | All Games | 350 |
  | Great On Frame | 21 |
  | Ready To Play | 68 |
  | Collections | 9 (VR 27; DS, Epic, GameCube, Nintendo Switch - Yuzu, PORTS, PSP, Wii, Xbox 360 all 0) |
  | Non-Steam (shortcuts) | 54 |
  | Soundtracks | 18 |
  | Locally installed | 18 |
  | Recent | 20 |
  | Favorites | 0 |
  | Search with an empty query | All 446 / Library 424 [inventory] |
  | "+" Launch Program | 24 (26 scanned, 2 filtered out) |

- **Art in the local cache** (`~/.local/share/Steam/appcache/librarycache`, 1,556 app folders, 556 MB) [measured]:

  | asset | size | coverage |
  |---|---|---|
  | `header.jpg` | 460 × 215 | 1,306 folders |
  | `library_hero.jpg` | 1920 × 620 (697 of 815) | 815 folders |
  | `library_600x900.jpg` | **300 × 450** (639) or 600 × 900 (111) | 750 folders |
  | `library_capsule.jpg` | 300 × 450 | 75 folders |
  | `logo.png` | 640 × 360 (556 of 699) | 699 folders |
  | `library_hero_blur.jpg` | 192 × 62 | 698 folders |
  | icon `<hash>.jpg` | **32 × 32** (920 of 939 files) | 928 folders |

  - **For the 350 games in All Games:** 350 have a portrait, a hero, a header and a 32 px icon. **322 (92%) also have a logo.**
  - **For shortcuts:** custom art lives in `userdata/<id>/config/grid`. That holds 125 files (about 30 portraits, 30 heroes, 30 logos). 26 of the 54 shortcuts report custom images (`BHasCustomImages`).
- **"+" program list** [measured]: `SteamClient.Apps.ScanForInstalledNonSteamApps(true)` returns objects with `bIsApplication, strAppName, strExePath, strArguments, strCmdline, strIconPath, strIconDataBase64`.
  - **Every `strIconDataBase64` is a 64 × 64 PNG** (one is 57 × 64), 2–8 KB.
  - **5 of the 24 shown programs have no icon at all**: Frametop Remote Access, Konsole, KDE System Settings, Desktop, Hide/Show Screens.
  - Several icons are upscaled by Steam from a 32 × 32 source (`strIconPath` → `hicolor/32x32/…`: qBittorrent, Firewall, VLC, CMake, Discover, Firefox).
  - Larger files exist on disk for most of them [measured]:

    | program | larger icon on disk |
    |---|---|
    | VS Code | 512 |
    | Chromium, VLC, Steam | 256 |
    | Firefox, CMake, LXTerminal | 128 |
    | qBittorrent, Firewall, Discover, Chrome | scalable SVG |
    | Konsole, KDE System Settings | Breeze theme SVG only |

### 0.4 What could not be exercised

- **Launching anything.** No game, program or desktop window was launched, and no Sort, Filter or collection item was chosen. Launch paths are documented from source.
- **"Add Desktop Window".** SteamVR reports no desktop windows (inventory). Its rows and window icons (`steamloopback.host/windows/icon?handle=`) were mapped from source only, so the window-icon resolution is unknown.
- **Running-game states** ("Current Game" shelf label, a game tab in the bar, the game's tab menu). These need a running game.
- **Laser `:hover`** cannot be synthesised. Hover looks come from CSS.
- **Gamepad traversal did work this time.** `L.pad` moved `.gpfocus` across the grid (`p2_lib_pad_grid_on.png`). It was used only on the grid. During the session the window switched between laser mode (the Sort/Filter pill shows) and gamepad mode (the footer legend shows the full set).

---

## A. Function list

"Laser" = the controller laser (sets `:hover` and Steam's laser focus; clicks). "Gamepad" = Steam's FocusNavController (`.gpfocus`). Every row must stay reachable both ways after the redesign. "—" = no path today.

### A.1 Library home (`/library/home`)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| H1 | See recent games (MRU order, 20 + "View more in your Library") | look; hover a tile shows its label (title + status line) | focus moves along the shelf; label shows for the focused tile | Horizontal virtualized carousel. The first tile is a 552 × 310 landscape "featured" tile; the others are 172 × 310 portrait. **The featured tile grows from 172 to 552 px wide when focused** (layout change) |
| H2 | Open a game's page | click a tile | A | → `/library/app/<id>` (game page; Play lives there) |
| H3 | Game tile menu (Play/Install, Favorites, Add to ›, Manage ›, Properties…) | — on Home (the footer legend is hidden on Home, `shell-nav.md` A.4) | ≡ (Options) on a tile | Same menu as A.3 |
| H4 | Go to the library | click the "View more in your Library" end tile | Right to the end + A | |
| H5 | Switch the feed: What's New / Friends / Recommended | click a tab or the ‹ › arrows (32 px) | Up/Down to the tab row, Left/Right or LB/RB | Tabbed page below the shelf; the page scrolls (outer max 434 px), then the tab panel scrolls |
| H6 | What's New: seasonal sale banner, "Recently updated on this device", "Trending among friends", "Special Offers" | click a card | focus + A | Store and event targets navigate to store/event pages |
| H7 | Friends: "N friends playing now", activity feed with comment / like / rate | click | focus + A | Social actions (never clicked) |
| H8 | Recommended: Personal Calendar, Discovery Queue, "Play next from your library", "Recommended new releases", "Top sellers" | click | focus + A | Store web widgets with their own carousels and transforms |
| H9 | Background art of the focused game (hero) | passive | passive | `RecentGamesBackground`; its 25 s drift is off under LowPerfMode |

### A.2 Library tabs and grid (`/library/tab/<id>`)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| L1 | Switch tab: All Games 350, Great On Frame 21, Ready To Play 68, Collections 9, Non-Steam 54, Soundtracks 18 | click a tab pill (168 × 34) or the ‹ › arrows (32 × 32) | LB / RB (in VR the row shows arrows instead of bumper glyphs), or Up to the tab row + Left/Right | Counts are part of each tab. Installed, Favorites, Remote Play, Xbox/PS tabs appear only when they apply |
| L2 | VR sub-filter: ALL / VR / NON-VR (Ready To Play: ALL / STANDALONE / REMOTE PC) | click a segment (109 × 44) | Up from the grid to the segments, Left/Right + A | **Persisted** (`collectionsAppFilterVR`). Shown on All Games, Great On Frame, Ready To Play |
| L3 | Browse the grid | wheel/drag scroll; hover lifts a tile (`translateZ(15px)`) and shows the compat badge | D-pad moves one tile; the page scrolls to keep focus in view [measured] | 172 × 258 tiles, 6 per row, gaps 16 × 42 px. All Games: **59 rows, 17,709 px tall** [measured]. Virtualized: visible rows ± 3 in the DOM |
| L4 | Fast scroll by letter | — | gamepad fast-scroll overlay (`FastScrollOverlay`, a large letter) | Not reached; from inventory |
| L5 | Open a game | click | A | → game page |
| L6 | Sort (10 options: Alphabetical, Friends Playing, % of Achievements, Hours Played, Last Played, Release Date, Date Added, Size on Disk, Metacritic, Steam Review) | laser-mode pill button "↑↓ ALPHABETICAL" (152 × 40, bottom right), or the footer legend "Y Sort By" | Y | Context menu, centred (`p2_lib_sortmenu_on.png`). **Persisted.** Non-alphabetical sorts add section headers ("Over 10 hours") |
| L7 | Filter | laser-mode pill button "FILTER", or the footer legend "X Filter" | X | Library Filters dialog (A.4) |
| L8 | Tile menu | footer legend "≡ Options" (shown only while a tile has focus) | ≡ | See A.3. **For the laser this needs the pointer to cross from the tile to the legend; see B.5 and LQ7** |
| L9 | "N apps hidden due to filter" header (button variant clears) | click | focus + A | Only when a filter hides apps |
| L10 | Back | header Back, or the legend "B Back" | B | |

### A.3 A game tile (capsule) and its menu

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| T1 | Primary action: **Play** (installed) / **Install** (not installed), Launch / Download / Update variants | menu item | ≡ → A | Coloured semantics: green = play, blue = install/update, red = stop/cancel |
| T2 | Add to Favorites / Remove | menu | menu | Steam's `favorite` collection |
| T3 | Add to › (each user collection, "+ New collection…") | submenu | Right/A on "Add to" | |
| T4 | Manage › (hide, uninstall, browse local files, …) | submenu | submenu | Look only |
| T5 | Developer › | submenu | submenu | Present because developer mode is on |
| T6 | Properties… | menu | menu | → properties pages |
| T7 | Cancel | menu | B | |
| T8 | Status on the tile | passive | passive | Frame compat badge (Verified / Playable / Unknown / Unsupported), download progress bar, update badge, friends-playing count, coming soon, locked (family), number of copies, title text when art is missing |

### A.4 Library Filters dialog (X / Filter)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| F1 | Steam Frame compatibility: Verified Only / Verified and Playable / Verified, Playable and Untested / All Games | click a row (584 × 39) | Up/Down + A | Radio. Persisted |
| F2 | 47 checkbox rows in sections: Players, Play state, Hardware support (+ "Gamepad Support" dropdown), Features, Language (dropdown), Genre, Gameplay, Visual, Camera Comfort, Audio, Input | click a row (552 × **28**) | Up/Down + A | Dialog is 660 × 2,742 px: **3.8 window heights** of scrolling [measured] |
| F3 | Store tags / Friends text search | click → keyboard | focus + A → keyboard | |
| F4 | Reset | button | button | |
| F5 | Save as ⚡ Dynamic Collection | button | button | Creates a collection |
| F6 | Close | click outside / B | B | |

### A.5 Collections

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| C1 | Browse collections (Collections tab) | click a tile (185 × 185) | D-pad + A | 9 here; 8 are empty Steam ROM Manager / user collections showing "( 0 )" (`p2_lib_collections_on.png`). Sort/Filter apply |
| C2 | Open a collection | click | A | `/library/collection/<id>`: title + the same grid as A.2 |
| C3 | Back to all collections | header Back | B | |
| C4 | Create / edit collections | via tile menu "Add to › + New collection…", or Filters "Save as Dynamic Collection" | same | The create tile is hidden in gamepad mode |

### A.6 Non-Steam and Soundtracks tabs

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| N1 | Browse and open Steam shortcuts (54: ports, recomps, Quest ports, launchers) | click | D-pad + A | No Filter on this tab. **Shortcuts without art show a blue title card or an empty grey tile** (`p2_lib_nonsteam_on.png`) |
| N2 | First-run "Add Chrome" dialog and Learn More (only when empty) | button | button | Installs software; not reached |
| N3 | Soundtracks (18) | click | D-pad + A | Square 172 × 172 art |

**These 54 library shortcuts are not the "+" program list.** The shortcuts are Steam library entries (mostly games), with art. The "+" list (A.8) is the system's installed desktop applications, with 64 px icons and no library entry.

### A.7 Search results (`/search/tab/<id>`)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| S1 | Switch category: All / Library / Friends / Store / Tools / Hidden (with counts) | click a tab or ‹ › | LB/RB, or Up to the tabs | Hidden appears only when a query matches hidden apps |
| S2 | Open a result | click a tile (191 × 140 cell: landscape art + a 12 px uppercase label "IN LIBRARY" / "FROM THE STORE" / persona name) | D-pad + A | Virtualized rows (@tanstack). Library results do not show install state or a title |
| S3 | "View more in the Store" | last tile | focus + A | |
| S4 | No results | — | — | "No Results Found" text |

Typing in the header field navigates to `/search/tab/All` (`shell-nav.md` A.2).

### A.8 The "+" popup: Add Desktop Window / Launch Program

How it works [source: modules 34493, 68472, 5757, 39944]:

1. **Discovery.** The popup component calls `SteamClient.Apps.ScanForInstalledNonSteamApps(true)` (a hook in module 68472).
   - **It rescans every time "+" is activated** (a counter in the hook's dependencies).
   - It reads the system's desktop entries, including flatpak exports and `~/.local/share/applications`. That last folder is where `glass-shell.desktop` (the Liquid Glass toggle) lives.
2. **Filtering** (module 5757):
   - Executables `steam` and `vrurlhandler` are always dropped (so 26 → 24).
   - `firewall-config, vlc, dolphin, cmake-gui, plasma-discover, konsole, systemsettings, qrenderdoc, sh, lxterminal` are dropped **unless Steam's `developer_mode_enabled` setting is on**. It is on here, so without developer mode the list would show 15.
   - "Install Chromium" is always kept.
   - **No sorting**: rows come in scan order, and the order changes between scans (inventory).
3. **Launch.** A row calls `SteamClient.Apps.LaunchNonSteamApp(strCmdline)`. No library shortcut is created.
4. **Desktop windows.**
   - The window list comes from a SteamVR message (`windows`: `hwnd, window_id, title`).
   - Each row's icon is `https://steamloopback.host/windows/icon?handle=<hwnd>`, with a generic window glyph if that fails.
   - A row calls `SteamVR.DashboardDesktopWindowClicked({window_id})`, which adds the window to VR as a bar tab.
5. **Visibility.**
   - The button renders only when at least one section is non-empty and launching programs is allowed (`ON_FRAME`).
   - Its tooltip is the header text when there is a single section.

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| P1 | Open the list | click "+" (hit 54 × 48, visible circle 34 px) | View button cycles focus to the bar → Left/Right to "+" → A (focus moves into the popup) | One shared 300 × 1024 barpopup window. Content is capped at **600 px**, so ~14 of 24 rows show and the rest scroll |
| P2 | Launch a program (24 rows: Liquid Glass, Visual Studio Code, qBittorrent, Firewall, Frametop Input Settings, Frametop Remote Access, VLC, Dolphin, CMake, Discover, Google Chrome, Reset Screen Layout, Konsole, Half SBS Toggle, Chromium, KDE System Settings, Full SBS Toggle, Camera Switch, Mozilla Firefox, LXTerminal, Frametop Display Settings, Desktop, RenderDoc, Hide/Show Screens) | click a row (40 px tall, 16 px icon) | Up/Down + A | **Never click.** Rows mix real applications with one-shot scripts and toggles (Reset Screen Layout, Half/Full SBS Toggle, Hide/Show Screens, **Liquid Glass**) |
| P3 | **Toggle Liquid Glass** | the "Liquid Glass" row | same | **The theme's only on/off switch in the headset.** It must stay reachable and recognisable even if every redesign layer fails |
| P4 | Add a desktop window to VR | click a window row (section "Add Desktop Window", shown first) | Up/Down + A | Only when SteamVR reports windows. With both sections, two cards share the 1,024 px height |
| P5 | Close the list | click elsewhere; it auto-closes 2 s after the pointer leaves | B | Opening another bar popup closes it |

### A.9 Running apps and desktop windows in the bar

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| R1 | Switch the dashboard to a frame (Steam, a running game, an overlay app such as Camera Switch, a desktop window) | click its tab (80 × 80) | View → bar, Left/Right + A | `DashboardTabClicked`. Selected tab has a 6 px blue underline pill |
| R2 | Tab menu of a frame (Steam: Home, Library, Store, Friends & Chat, Media, Downloads, Steam Settings, VR Settings, Power; an app: **Close**) | hover the tab (200 ms) | focus the tab, Up | Close ends the app (never clicked) |
| R3 | Identify a running item | tooltip on hover (name) | tooltip on focus | Icon sources [source]: `hwnd` → `steamloopback.host/windows/icon`; overlay key → `steamloopback.host/overlays/thumbnail?key=`; Steam app → the app's **32 × 32 icon** (`eAssetType` icon); else an enum glyph. Icon box 32–38 px, scaled 1.2 |
| R4 | "Current Game" on Home | passive | passive | The shelf header changes while a game runs (not reached) |

Only the Steam tab existed at audit time (`p2_audit_bar_on.png`). Inventory shots show the Camera Switch tab with an overlay thumbnail.

### A.10 States that must keep showing (any redesign)

- Frame compat (four levels), installed vs not, downloading (progress), update available, running ("Current Game"), friends playing (count), favourite, hidden, coming soon, locked, number of copies.
- Missing-art fallback (title).
- Section headers for non-alphabetical sorts.
- Tab counts and the "N apps hidden due to filter" notice.
- The current Sort and Filter state (today only the laser pill shows the current sort, "ALPHABETICAL").
- Semantic colours: Play green, Install/Update blue, destructive red; store price widgets (discount green, NEW blue).

---

## B. UX critique for VR

### B.1 Target sizes

Main window at 0.0307°/px; bar popup at 0.037°/px. "vs 2.5°" uses the limiting (smaller) side.

| control | size (px) | angle | vs 2.5° | comment |
|---|---|---|---|---|
| Library / search / home tab pill | 168 × 34 (home 115 × 34) | **1.04°** | 42% | Most-used navigation in the area |
| Tab-row arrows ‹ › | 32 × 32 | 0.98° | 39% | |
| VR sub-filter segment | 109 × 44 | 1.35° | 54% | |
| Laser Sort / Filter button | 152 × 40 | 1.23° | 49% | |
| Footer legend item (Filter, Sort By, Options, Select, Back) | 90 × 35 | 1.07° | 43% | The laser's only route to Options |
| Sort / tile menu row | 280 × 48 | 1.47° | 59% | |
| Filter dialog: compat row | 584 × 39 | 1.20° | 48% | |
| **Filter dialog: checkbox row** | 552 × **28** (box 16) | **0.86°** (box 0.49°) | **34%** | 47 of them, the smallest targets in the area |
| Filter dropdown | 552 × 40 | 1.23° | 49% | |
| Game tile | 172 × 258 | 5.3° × 7.9° | OK | Content; large enough |
| Gap between tiles | 16 horizontal | 0.49° | — | Below visionOS's 16 pt (0.65°) margin |
| Featured tile (Home) | 552 × 310 | 16.9° × 9.5° | OK | |
| Collection tile | 185 × 185 | 5.7° | OK | |
| Search result tile | 191 × 140 (art ~89 tall) | 2.7° tall art | OK | |
| **"+" button (bar)** | hit 54 × 48, visible circle 34 | 1.79° hit / **1.27° visible** | 72% / 51% | The entry point to every program |
| **"+" list row** | 300 × 40 | 1.49° | 60% | |
| **"+" list icon** | **16** | **0.60°** | — | About the size of a full stop at reading distance |
| Bar tab | 80 × 80 (icon 38) | 2.98° (icon 1.4°) | OK | Icon is a 32 px source upscaled |

**Findings**

- **Navigation inside the library is half the visionOS size.** Every chrome control (tabs, arrows, sub-filter, Sort/Filter, legends, menus) is 1.0–1.5°. Only content (tiles) is large.
- **The Filters dialog is the worst screen in the area.** It has 47 rows of 0.86° with 0.49° check boxes, in a dialog almost four window heights tall.
- **The "+" list is tiny for what it is**: the system's app launcher. Its icons are 0.6°, its rows 1.5°, and its entry button shows a 1.27° circle.

### B.2 Legibility

| text | size | angle | vs visionOS body 0.70° |
|---|---|---|---|
| Tab labels and counts (`ALL GAMES 350`), 700 uppercase, tracked | 12 px | **0.37°** | 53% |
| Footer legend labels, uppercase | 12 px | 0.37° | 53% |
| Shelf sub-line ("▶ NO PLAYTIME YET"), uppercase | 12 px | 0.37° | 53% |
| Search result label ("IN LIBRARY"), uppercase | 12 px | 0.37° | 53% |
| Collection tile label, uppercase, letter-spacing 2 px | 18 px | 0.55° | 79% |
| Shelf title (focused game) | 18 px bold | 0.55° | 79% |
| "+" list labels | 16 px popup | 0.60° | 86% |
| "+" list header ("LAUNCH PROGRAM", stock uppercase) | 12 px popup | 0.45° | 64% |
| Filter checkbox labels | 16 px | 0.49° | 70% |

**Findings**

- **Tab labels, counts and statuses use the smallest text in the UI (0.37°), in tracked uppercase.** That removes word shapes exactly where scanning matters.
- **Game titles are almost never written.** The grid, the shelf (except the focused tile) and search show art only. A title appears only for the focused shelf tile, or when art is missing. In VR at 5° per tile the art carries recognition, but stylised logos (`AAAAAAAA`, `Ace Combat Assault Horizon` in a 1/3-height banner) are hard to read.

### B.3 Density, scanning and travel

- **All Games is a 59-row scroll.** It is 17,709 px tall, about 30 window heights, with 6 tiles per row and about 1.6 rows visible.
  - With a gamepad, reaching the last row takes 58 Down presses. Held D-pad repeats at 8–12 per second, so that is about 5–7 s. The letter fast-scroll exists but is undiscoverable (no legend hint).
  - With the laser, wheel-like scrolling of a 30-screen page has no position indicator: there is no scrollbar and no letter index.
- **Home mixes launching with shopping.** Below the 20-game shelf, two of the three tabs and most of What's New are store or social feeds (sale banner, Trending, Special Offers, Personal Calendar, Discovery Queue, Top sellers). The first screen is a launcher; everything below it is a storefront. visionOS keeps those apart (Home vs the App Store).
- **Collections are mostly empty noise.** 8 of 9 tiles say "( 0 )" in a 185 px tile, and they push the one useful collection (VR, 27) to the second row.
- **The "+" list hides 40% of its items.** 10 of 24 rows are below the 600 px cap, and the order is unsorted and unstable. Muscle memory cannot form: the Liquid Glass row was seventh in one session and first in another (inventory).

### B.4 "A window into another app": seams in this area

1. **Library chrome is a second, separate navigation system inside the window.**
   - It is a horizontal row of six uppercase tab pills with ‹ › arrows, a second segmented control under it, a floating Sort/Filter pill, and a footer legend.
   - That makes four bands of chrome around the content (header, tabs, sub-filter, footer), while visionOS uses one tab ornament plus one toolbar.
2. **Two control sets for the same action.**
   - In laser mode the Sort/Filter pill appears bottom-right.
   - The gamepad legend also shows "X Filter / Y Sort By".
   - Both are visible at once on the VR collection page and Soundtracks (`p2_lib_collection_vr_on.png`, `p2_lib_soundtracks_on.png`), stacked in the same corner and touching.
3. **The sub-filter floats over content when scrolled.** Phase 1 removed the dark band behind the pinned tab row, so the ALL/VR/NON-VR control sits directly on game art (`p2_lib_pad_grid_on.png`).
4. **Menus are console sheets, not menus.** Sort and the tile menu are centred lists over a blurred window, far from the button that opened them, with "Cancel" as a row. That is Steam Deck idiom (`shell-nav.md` C.6).
5. **The Filters dialog is a web form**: tiny check boxes, dropdowns and text inputs in a 2,742 px scroll.
6. **Missing art looks broken.** A blue gradient card with wrapped text, or an empty grey tile, sits next to professional key art (`p2_lib_nonsteam_on.png`). This affects about half of the 54 shortcuts.
7. **The "+" list is a desktop context menu**: separators, 16 px icons, an uppercase header, a hard scroll. Yet it is the system's app launcher, the thing visionOS presents as its most iconic screen (refs 1, 9, 10).
8. **Bar app icons are 32 px community JPEGs scaled to 38 px.** They are soft next to the crisp Steam glyph.

### B.5 Interaction model problems

1. **Laser path to a game's menu.**
   - The tile menu (Play/Install, Favorites, Add to, Manage, Properties) is reachable by the laser only through the footer legend's "Options". That item exists only while a tile holds focus.
   - With the laser, focus follows hover, and the legend sits at the bottom-right. Moving the pointer from a tile to the legend crosses other tiles, so the legend may open the menu of a different game.
   - The game page offers the same actions, so this is not a dead end, but it is an accuracy trap. **Verify (LQ7).** No right-click or long-press equivalent was found.
2. **Persisted global state behind small controls.** Sort, the VR sub-filter and the compat filter are persisted and affect every library view. The only feedback is a sort label in a laser-only pill and the "N apps hidden" header. A gamepad user sees neither the current sort nor the active filter.
3. **Two launchers that look unrelated.**
   - Steam games launch from Library or Home: big art, game page, Play.
   - Desktop programs launch from "+": a tiny list in the bar.
   - Non-Steam shortcuts are a third kind (library tab, title cards).
   - visionOS has one Home grid for all apps.
4. **The featured shelf tile reflows on focus.** Focusing the first tile widens it by 380 px (11.7°), and moving focus away shrinks it. The whole row shifts by that amount.
5. **Tab content slides.** Switching a library tab slides the content `translateX(±40%)`, about 40 cm of panel sideways (`liquid-glass-motion.md` §4.12).

### B.6 Ergonomics

- The library's main controls sit at the extremes of a 38° × 22° window:
  - tabs along the top (+8°);
  - Sort/Filter and the footer legend in the bottom-right corner (+12° to +19°, −10°);
  - the sub-filter at the top centre.
  
  A "browse → sort → filter → open" loop sweeps the full window.
- **"+" sits in the bar, about 0.44 m below the dashboard origin**, and its list grows upward from there, up to 600 popup px (22°). The user looks down to the bar and then up through a long list.
- Search results put art at 2.7° tall with an uppercase status line. That is fine, but the result category tabs are 1.04°.

### B.7 Motion versus the Liquid Glass spec

| element | today | spec (`liquid-glass-motion.md`) |
|---|---|---|
| Featured shelf tile | width 172 ↔ 552 px on focus (layout animation, the row shifts 11.7°) | No reflow on focus; focus is illumination + lift (§4.4) |
| Tab content switch | `translateX(±40%)` + opacity, 320 ms after an 80 ms delay | ±16 px + fade on `page` (662 ms), no full-width slides (§4.12, M1) |
| Shelf header "Recent Games" | fades out by itself after 8 s without focus change | Nothing changes at rest (C7) |
| Tile focus | Steam's shine sweep (one shot) + 1.2 s pulse ×20 (Phase 1 holds the pulse steady) | One-shot illumination; no pulse (C7) |
| Sort / tile menu | centred sheet, scale + opacity 500 ms | Menu morphs out of its source (§4.6) |
| "+" popup | appears in place (SteamVR overlay), rows static | Materialize in 250 ms; content after glass (C1) |
| Hover on cards | `scale(1.02)` on store cards, `translateZ(15px)` on tiles | Content cards may lift; rows and toolbar buttons must not scale (§4.4) |

### B.8 Materials (Phase 1 state, from the `_on` shots)

- The window glass is a tint with a uniform 1 px rim. Tab pills, the sub-filter, the Sort/Filter pill and the footer legend each carry their own outlined capsule, which reads as **five separately outlined bars**. The brief says the edge must come from the glass itself.
- The selected tab and the selected sub-filter are solid white pills with dark text. visionOS uses a translucent light platter for navigation selection (`references.md` finding 5).
- The "+" list is a grey gradient slab with an outline and hairline separators (`p2_lib_plus_on.png`). It has no frost and no lensing; T5 is required.
- Collections themed as flat grey glass squares with uppercase labels read as empty buttons, not folders (`p2_lib_collections_on.png`).
- No stereo: tiles lift only through Steam's own `translateZ`, which is flattened on the quad.

### B.9 Art quality

| where | source today | displayed at | problem |
|---|---|---|---|
| Bar app tab | 32 × 32 JPEG icon | 38 popup px × DPR 1.5 = 57 device px | 1.8× upscale, soft |
| "+" list | 64 × 64 PNG (often from a 32 px file) | 16 popup px | Fine now; **too small for any launcher** (64 px on a 112 px circle = 2.6× upscale) |
| Non-Steam tiles | custom grid art for ~26 of 54; title card otherwise | 172 × 258 | Half of the tab looks broken |
| Circle crop of a portrait (the T3 prototype) | portrait 300 × 450, `object-fit: cover` | 127 px circle | **Clips the game's logo** (Balatro, Stardew Valley, Sonic CD in `p2_react_proto_home.png`) |

---

## C. Redesign opportunities, ranked by impact

Impact = how often the user meets it × distance from visionOS × how much it fixes size or navigation. Tiers: T1 CSS incl. layout, T2 DOM augmentation, T3 Steam React views, T4 spatial compositor, T5 glassd.

Rules that apply to every item:

- Steam's nodes keep their identity, focusability and handlers.
- `glass.py audit` stays at 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE.
- The D-pad direction must still match the visual layout.
- Every launch path in a new view calls **the same Steam function** as Steam's own control (`LaunchNonSteamApp(strCmdline)`, `DashboardDesktopWindowClicked`, the game page / tile menu for games). In agent tests, activations are logged instead of executed, as `react_proto.js` already does.

### C.0 Capability questions this area depends on

| id | question | needed by |
|---|---|---|
| LQ1 | Can the "+" popup's content be replaced or reflowed? Options: T3 fiber patch of the list (`WD`/`VE` in module 53318), or a T1 CSS grid inside the existing list. The list has no `flow-children` (default spatial navigation) [source]; does the D-pad stay correct in a 3-column grid? Can the 600 px cap be raised, and can the 300 × 1024 barpopup window be widened? | C.1 |
| LQ2 | Can T3 change the library grid's `childWidth`, `childHeight`, `gridColumnGap`, `scaleGridItems` (props of module 25523's CSSGrid) and keep virtualization, scroll restore (`restorescroll`) and fast-scroll? CSS alone cannot: row height and columns are inline styles computed in JS | C.3 |
| LQ3 | Can a T3 Focusable grid define explicit neighbours (`onMoveUp/Down/Left/Right`) so a hexagonal 4-5-4 lattice navigates reversibly (Down then Up returns to the same icon)? | C.1, C.2 |
| LQ4 | Can the transient `lgs-shell` daemon read the best icon file for each program (hicolor ≥ 128 px or Breeze/hicolor SVG) and hand it to the page as a data URI over CDP, with no disk writes? | C.1 |
| LQ5 | Can a T3 route in `main` be opened from the bar (the "+" button or the Steam tab) while the dashboard shows another frame, without changing what Steam's "+" does by default? | C.1 |
| LQ6 | What does decoding 13–26 hero images (1920 × 620, about 4.8 MB each decoded) cost in Steam's CEF on the shared GPU? Does Chromium decode to display size here? (`glass.py perf` + GPU memory) | C.1, C.2 |
| LQ7 | With the laser, does focus follow hover across tiles while the pointer travels to the footer legend's "Options"? (laser test, or a synthetic `mousemove` sequence) | C.4 |
| LQ8 | Can T4 pop 13–16 launcher icons (+1 cm at rest, +2.5 cm focused) with slabs, within glassd's 2.5 ms budget and the 30 Hz scene-graph push rate while paging? | C.1, C.2, C.9 |
| LQ9 | Can the window glass (CSS, or the glassd cover in native mode) be switched off per route, so a launcher page shows icons floating over the room with no window? | C.1, C.2 |
| LQ10 | If the user activates "Liquid Glass" from a T3 launcher, the theme turns off and the route disappears. Does the view navigate back to a Steam route **before** the toggle runs, every time? | C.1 |

### C.1 "+ Launch Program" becomes a visionOS Home-style Apps launcher (highest impact)

- **Problem:** B.1 (0.6° icons, 1.5° rows, 1.27° button), B.3 (40% hidden, unstable order), B.4 item 7, B.5 item 3, B.9.
- **visionOS pattern:** the Home view's Apps tab (refs 1, 10) and the Environments picker (ref 9). Circular icons float on a 4-5-4 hexagonal lattice, with labels below, page dots, faded edge items and no panel. See §D for the full evaluation.
- **Proposal, in three steps; each step is shippable alone:**
  1. **Popup grid (T1, or T3 if LQ1 says CSS breaks the D-pad).** Inside the existing 300 px barpopup, show the programs as a **3-column grid of 72 px circles (2.7°)** in 100 px cells (3.7°), with 15 px labels on up to two lines. Details:
     - **Sorted A–Z** (T3; CSS cannot reorder safely).
     - Raise the cap from 600 to about 960 px so all 24 fit in 8 rows. If LQ1 says the cap cannot move, scroll with an edge fade.
     - Program icons sit at 48 px (native 64 px source, 1.1× upscale) on a glass disc, and missing icons get a monogram disc (C.8).
     - The "Add Desktop Window" section stays first, as its own group of window circles (window icon or title monogram).
     - The header in title case, 18 px.
  2. **Apps page in the main window (T3, after LQ5 and LQ9).** A route such as `/lgs/apps` that is visionOS Home:
     - transparent window (no glass) with icons floating over the room;
     - 112 px circles (3.4°) on a 224 × 196 px hexagonal pitch, 13 per page, page dots, LB/RB to change pages;
     - a left tab ornament: **Apps** (programs) · **Windows** (desktop windows) · **Games** (C.2).
     
     Reached from a "Show all" first cell in the popup grid and from the Steam tab menu. **Steam's "+" keeps opening Steam's own popup**, so the toggle never depends on our route.
  3. **Depth and glass (T4 + T5).**
     - Icons popped +1 cm at rest and +2.5 cm on focus, at their own x/y (`visionos.md` §16.2). Each has a contact shadow (offset 6 px, blur 18 px).
     - Program discs get glassd's `liquid` material, with lensing at the bezel and a specular arc from above.
     - No outlines.
- **Liquid Glass toggle (P3):**
  - Give it a fixed, recognisable place: the first cell, or a separate small glass toggle button at the end of the grid, with an on/off state.
  - Keep its row in Steam's own popup reachable whatever layer is active.
  - In step 2, activating it navigates back to `/library/home` before calling the toggle (LQ10).
- **Retention:**
  - P1–P5 unchanged;
  - the same `LaunchNonSteamApp(strCmdline)` and `DashboardDesktopWindowClicked` calls;
  - the scan still runs on every "+" press;
  - developer-mode filtering unchanged (we read the already-filtered list);
  - B and auto-close unchanged.
- **Verify:**
  - `shot barpopup p2_plus_grid_*` with the OPEN pre (`bar.md` §0.3);
  - `audit barpopup` (no SHRUNK; the circle cell must be ≥ the old 40 px row height in both axes);
  - `L.pad` inside the popup: Up/Down/Left/Right reach every cell, and Down then Up returns (LQ1/LQ3);
  - icon sharpness by cropping a 1.5x shot at 100% zoom;
  - for step 2, `shot main p2_apps_*` plus an hvgrab frame for the floating look (look, then delete);
  - the toggle row found by text in both layers.

### C.2 Library home becomes a Home view of games; the feeds move to their own tab

- **Problem:** B.3 (launcher mixed with storefront), B.5 item 4 (featured reflow), B.2 (12 px uppercase statuses), B.7.
- **visionOS pattern:** Home (circles for things you launch). The App Store and TV "Watch Now" (rounded content tiles) are separate destinations.
- **Proposal (T3 view replacing what Home shows first; Steam's Home stays one tab away):**
  - **Page 1, Recent:** the 12 most recently played games (Steam's MRU order, the same 20 as the shelf) as 112 px circles, plus a 13th circle "All Games" that opens the library.
  - **Page 2, Favorites:** shown only when Favorites is non-empty (0 now).
  - **Page 3, Collections:** collections as **folder circles**. A folder is a circle holding a 3 × 3 mini grid of its games' portrait crops (visionOS "More Apps" folder, ref 1). Empty collections are dimmed and placed last, never hidden.
  - Focus or hover on a circle lifts it (+2.5 cm, `scale 1.10`). After 0.8 s (visionOS "ramp") it reveals a capsule with **Play** (green, when installed) or **Install**, plus the title and the playtime line in title case. A opens the game page, as today; the capsule's Play calls the same action as the tile menu's Play.
  - **Feeds** (What's New, Friends, Recommended) move to a "Discover" entry in the left tab ornament (`shell-nav.md` C.2) as a normal content window. Every card keeps its function.
  - **No featured reflow.** Steam's featured tile is not used on this page.
- **Retention:** H1–H9 all reachable (H5–H8 in Discover). The tile menu stays on ≡. "View more" maps to the "All Games" circle. The running game shows a "Running" badge (from `MainRunningAppID`).
- **Verify:** `shot main p2_home_*` for each page; `L.pad` across the hexagonal lattice and the page change with LB/RB; `perf main` while paging (LQ6); `audit main` on Steam's Home still clean (it is now one tab away).

### C.3 The library catalogue becomes a visionOS media-library window (posters, not circles)

- **Problem:** B.1 (chrome at 1.0–1.5°), B.4 items 1–3, B.8.
- **visionOS pattern:** TV and Music (refs 5, 11). Content is rounded rectangular posters in a window. Navigation is a vertical tab bar ornament. Actions sit in a toolbar.
- **Proposal:**
  - **Tabs become a sidebar or tab ornament.** All Games, Great On Frame, Ready To Play, Collections, Non-Steam and Soundtracks become rows of ≥ 64 px in title case with their counts as secondary text. Either they join the left tab ornament of `shell-nav.md` C.2 as a second level, or they form an in-window sidebar (ref 8) of 320 px.
    - In T1 the tab row can be restyled in place as one glass capsule with 56–64 px segments in title case (a size-only first step).
    - A true sidebar needs T3, because moving the tab row would break its horizontal D-pad flow.
  - **Toolbar ornament (one control set, laser and gamepad alike).**
    - A single glass capsule at the bottom centre: **Sort: Alphabetical ▾**, **Filter (2) ▾**, and the VR segment (All · VR · Non-VR), each ≥ 64 px tall.
    - It replaces the laser pill + footer duplication (B.4 item 2).
    - It always shows the current sort and the number of active filters, which fixes B.5 item 2.
    - Gamepad X/Y keep working (Steam's handlers). The footer legend stays in the DOM (it cannot be hidden) but is restyled as a quiet glyph hint inside the toolbar's area (`shell-nav.md` C.4).
  - **Posters:**
    - Keep Steam's portrait art (it carries the logo).
    - Radius 16 px (concentric).
    - Title in title case, 18–20 px, **under the focused poster only**, as Steam's shelf does.
    - Gaps ≥ 24 px. Columns go from 6 to 5 by T1 padding: items per row are measured from the container width [source], so the virtualizer recomputes. Larger posters need T3 props (LQ2).
  - **Position cue for long lists:** a slim letter index capsule on the right edge (T3), mapped onto Steam's existing fast-scroll; laser-clickable letters ≥ 48 px. Sorting other than A–Z shows Steam's section headers in the index instead.
  - **Sub-filter** no longer floats over art. It lives in the toolbar.
- **Retention:** L1–L10, A.3 unchanged. The virtualized grid stays Steam's. Section headers, the hidden-by-filter notice and all tile badges remain.
- **Verify:** shots of each tab (`p2_lib_*_v2`); `L.pad` from the toolbar into the grid and back; `audit main` per tab; `perf main --route /library/tab/AllGames` (scroll fps within 5%).

### C.4 Sort, Filter and the tile menu become glass menus and a sheet sized for VR

- **Problem:** B.1 (checkbox rows 0.86°, menu rows 1.47°), B.4 items 4–5, B.5 item 1.
- **Proposal:**
  - **Sort:** a glass menu that **grows out of the toolbar's Sort button** (morph-open 607 ms, b 0.20).
    - 64 px rows with a **checkmark on the current sort** (today the menu shows no current value).
    - Grouped by kind: name; play (Hours, Last Played, Friends Playing, Achievements); date (Release, Added); size; reviews.
    - Anchoring needs T3 (`shell-nav.md` CQ10). Until then, restyle the centred sheet.
  - **Filter:** a visionOS sheet.
    - The compat choice becomes a 4-segment control at the top (64 px).
    - Each checkbox section becomes a row of **toggle chips** (capsules ≥ 56 px, multi-select, selected = light platter).
    - Sections collapse, with the active count on the header. That cuts the 2,742 px scroll to about one screen.
    - Reset and "Save as Dynamic Collection" go in the sheet's toolbar.
    - T1 can enlarge rows and boxes in place (taller hit areas only; keep the same nodes). Chips and collapsing need T3.
  - **Tile menu:**
    - Primary action first and tinted (green Play, blue Install).
    - Rows 64 px; submenus open beside the menu.
    - Laser: add a **visible "…" button** on the focused or hovered poster (T2 decorative node that dispatches the same `vgp_onmenu` Steam listens for, or T3). The menu then no longer depends on reaching the footer legend (LQ7).
- **Retention:** every option, the persisted values, Reset, Save as Dynamic Collection, the dropdowns and text searches. Dispatch only Steam's own events and handlers.
- **Verify:** open/close shots via the snippets in `library.md` §0.3 (look only, never choose); `audit main` with the menu or dialog open; `L.pad` through every row.

### C.5 Collections become folders

- **Problem:** B.3 (8 of 9 empty, noise), B.8 (flat squares).
- **Proposal:**
  - Collection tiles become **circular folders** (or rounded squares in the catalogue), showing up to 9 mini covers.
  - Empty collections are dimmed, sorted last, labelled "Empty" in title case.
  - The VR collection's 3-D display case can stay as content.
  - In C.2 they appear on the Collections page of the launcher.
- **Tiers:** T1 (shape, label case), T3 (folder art, ordering).
- **Retention:** C1–C4. Empty collections stay visible and openable.

### C.6 Search results read as an OS search

- **Problem:** B.2 (12 px uppercase status), B.4.
- **Proposal** (the field is `shell-nav.md` C.1):
  - Results grouped as sections in one scroll: **Library** (posters or circles with title and install state), **Friends** (avatar circles), **Store** (landscape tiles with price), **Tools**, with "See all" capsules that switch to Steam's category tabs.
  - Category tabs become a glass segmented control ≥ 56 px in title case.
  - Status labels become 16 px secondary text, not uppercase.
  - Grouping needs T3. In T1: title case, bigger tabs, label size.
- **Retention:** S1–S4, the Hidden category, "View more in the Store", the virtualized grid.

### C.7 Running apps in the bar get real icons and a visionOS selected state

- **Problem:** B.9 (32 px JPEG icons), B.8.
- **Proposal:**
  - App tabs show **circular art** at 56 popup px (2.1°) inside the 80 px hit area. Sources:
    - for a Steam app, a portrait crop from the local cache;
    - for an overlay, its thumbnail;
    - for a window, its window icon.
  - Selected = a lighter platter plus a small white dot under the icon (replaces the 6 px blue underline; recolour and reshape only, its transform stays Steam's).
  - Hover/focus = illumination.
  - The tab menu (Close etc.) becomes a glass menu that grows from the tab.
  - The Steam tab keeps its glyph.
- **Tiers:** T2/T3 (swap the image source inside Steam's icon component, or overlay a decorative image node), T1 (states), T5 (glass circle).
- **Retention:** R1–R4, tooltips, tab menus, the Steam tab's menu.
- **Verify:** `shot bar` with the exact-key shim (`bar.md` §0.1); `audit bar`. A running app is needed for the real check. The only app that may be started is the Liquid Glass Frame showcase (LAB.md), and only if `driver.py status` shows it is not already running.

### C.8 Art fallbacks: never a broken tile

- **Problem:** B.4 item 6, B.9. About half of the 54 shortcuts and 5 of 24 programs have no art or icon.
- **Proposal:**
  - **Shortcuts without a portrait:** use, in order, Steam's own `icon_data` for the shortcut (`RequestIconDataForApp`; several are 50–1,400 KB PNGs [measured]), custom hero + logo, then a **monogram poster**: the title's initials in Bold on a glass gradient tinted from the icon's average colour.
  - **Programs without an icon:** a glass disc with a category glyph (terminal, settings, display, toggle) chosen from the name or command, else the initial.
- **Tiers:** T3 for the library (or T2 decorative layer over Steam's title card, which stays as the accessible text); T3/T4 for the launcher.

### C.9 Depth plan for this area (T4)

| element | dz | note |
|---|---|---|
| Launcher icons, rest / focused | +1 cm / +2.5 cm | Paired with shadow and `scale 1.10` (`visionos.md` §16.2) |
| Focused poster | +1.5 cm | Steam's `translateZ` lift is invisible on a flat quad; the crop stays at its x/y |
| Library toolbar ornament, tab ornament | +2.5 cm | |
| Sort / tile menus | +3.5 cm | |
| Filter sheet | 0, window pushed to −6 cm and dimmed | |
| Text | never alone | Labels ride their icon's or poster's plane |

### C.10 Motion fixes in this area

- Featured shelf reflow: avoided by C.2. If Steam's Home is shown, its width animation is Steam's and stays.
- Tab content slide: shorten to the `page` spec (±16 px + fade) through transition durations only. This depends on `shell-nav.md` CQ6, because Steam's transition groups may end on timers.
- "Recent Games" header auto-fade: hold it at its resting opacity in CSS. Opacity on a label is allowed; it is not a hidden control.
- Launcher paging: cross-fade + 16 px parallax on `page` (662 ms). No full-width slides (M1). Edge icons of the neighbour pages stay faded at 35%.
- Launcher open: materialize, glass first and icons 35% later (C1). Reduce Motion becomes a 150–200 ms cross-fade.

### Summary ranking

| rank | opportunity | main fix | tiers | blocking question |
|---|---|---|---|---|
| 1 | C.1 "+" → Apps launcher | launcher size, order, visionOS Home | T1/T3 → T3 → T4 T5 | LQ1, LQ3, LQ4, LQ5, LQ9, LQ10 |
| 2 | C.2 Home → Home view of games | launch vs shop, circles, no reflow | T3 T4 T5 | LQ3, LQ6, LQ8, LQ9 |
| 3 | C.3 catalogue window | chrome size, one toolbar, sidebar | T1 → T3, T4 | LQ2 |
| 4 | C.4 Sort, Filter, tile menu | 0.86° targets, current state, laser menu path | T1 → T3 | LQ7, `shell-nav.md` CQ10 |
| 5 | C.7 bar running apps | icons, selected state | T2/T3 T1 T5 | — |
| 6 | C.8 art fallbacks | broken-looking tiles | T3 (T2) | — |
| 7 | C.6 search results | OS search look, legibility | T1 → T3 | `shell-nav.md` CQ8 |
| 8 | C.5 collections as folders | noise, folder idiom | T1 T3 | — |
| 9 | C.9 depth | stereo hierarchy | T4 | LQ8 |
| 10 | C.10 motion | spec compliance | T1 | `shell-nav.md` CQ6 |

---

## D. Evaluation: Library and Launch Program as a visionOS Home-view app grid

### D.1 Verdict

- **Launch Program: yes, fully.**
  - It is a short list (24) of applications, which is exactly what visionOS Home shows.
  - Circles, A–Z order and two pages fix every problem in B.1, B.3 and B.9.
- **Library: yes for launching, no for browsing.**
  - Turn Library *Home* into a Home view (recent, favourites, collections as folders).
  - Keep the 350-game *catalogue* as rounded posters in a window.
  - In visionOS itself, circles are for apps. Media catalogues (TV, Music, refs 5, 11) are rectangular posters inside a window, because a catalogue needs scrolling, sorting, filtering and recognisable key art.
  - 350 items as circles would mean 27 pages of 13 with no random access, and a circle crop discards the poster's logo.
  - A circle view of the catalogue can be offered as a second layout (D.5) once LQ2 and LQ3 are answered.

### D.2 Art sources for Steam games

All loads go through `https://steamloopback.host`, the origin of every gamepadui window. URLs are built by Steam's own `appStore` / `appDetailsStore` methods [source], so a T3 view should call those methods rather than build paths itself.

| asset | method (SharedJSContext) | example URL (Beat Saber, 620980) [measured] | size | coverage of the 350 | use in a circle |
|---|---|---|---|---|---|
| Portrait capsule | `appStore.GetCachedVerticalCapsuleURL(ov)[0]` | `/assets/620980/<hash>/library_capsule.jpg?c=<cache>` | **300 × 450** (111 cache folders hold 600 × 900) | 350 | Fallback crop, `object-position: 50% 30%`; clips logos (B.9) |
| Hero | `appDetailsStore.GetHeroImages(ov).rgHeroImages[0]` | `/assets/620980/<hash>/library_hero.jpg` | **1920 × 620** (some 1920 × 1080, a few 3840 × 2160) | 350 | **Background of the icon**: by Steam's asset rules the hero has no logo or text |
| Logo | `appDetailsStore.GetLogoImages(ov)` → `rgLogoImages[0]`, `logoPosition` | `/assets/620980/logo.png` | **640 × 360** transparent PNG | **322 (92%)** | **Foreground of the icon**, scaled to about 70% of the diameter |
| Header | `appDetailsStore.GetHeaderImages(ov)[0]` | `/assets/620980/<hash>/library_header.jpg` | 460 × 215 | 350 | Store-style landscape; not for circles |
| Icon | `appStore.GetIconURLForApp(ov)` | `shared.steamstatic.com/community_assets/images/apps/620980/<hash>.jpg` (network, not loopback) | **32 × 32** | 350 | **Unusable** above about 40 px |
| Pregenerated portrait | `GetPregeneratedVerticalCapsuleForApp` | `shared.steamstatic.com/…/portrait.png?v=2` (network) | — | — | Avoid: network |
| Custom (shortcuts, user overrides) | `GetCustomVerticalCapsuleURLs`, `GetCustomHeroImageURLs`, `GetCustomLogoImageURLs` (jpg, then png) | `/customimages/<appid>p.jpg`, `/customimages/<appid>_hero.jpg` (AMID EVIL VR: 300 × 450 and 1920 × 620) [measured] | user files | ~26–30 of 54 shortcuts | Same composition as Steam apps |
| Album cover (soundtracks) | `GetCachedAlbumCoverURL` | `/assets/<id>/<hash>.jpg` | square | 18 | Square art crops cleanly to a circle |

Legacy URLs (`/assets/<id>_library_600x900.jpg`, `_library_hero.jpg`, `_logo.png`) returned errors for this app; always use the first URL from Steam's methods, with Steam's fallback order.

**Recommended icon composition** (T3, CSS only inside our own view):

1. A circle mask with **the hero**, `object-fit: cover`, centred.
2. **The logo**, centred, at 70% of the diameter, with a soft shadow (Steam's game page already composes hero + logo with `logoPosition`).
3. A specular rim from above and a contact shadow. **No frost or tint: the art is content.**

Fallbacks: portrait crop (no logo), then custom art, then a monogram.

**Cost:** a hero decodes to about 4.8 MB, a portrait to 0.54 MB. Use the portrait-based crop for off-page and peeking icons, and the hero composite only for the visible page. Measure under LQ6.

### D.3 Icon sources for desktop programs

| source | how | size | notes |
|---|---|---|---|
| `strIconDataBase64` (from `ScanForInstalledNonSteamApps`) | inline `data:image/png;base64,` | **64 × 64** PNG (one 57 × 64); often a 32 px file upscaled by Steam | 19 of 24 have one |
| `strIconPath` | path on the headset | 32 px to 128 px files, or undefined | CEF cannot read it directly |
| Better files on disk | icon themes: hicolor 128/256/512, scalable SVG, Breeze SVG | see §0.3 | Needs the daemon to supply them (LQ4) |
| Window icons (Add Desktop Window, bar tabs) | `steamloopback.host/windows/icon?handle=<hwnd>` | unknown (not reached) | Fallback: Steam's window glyph |
| Overlay thumbnails (bar tabs) | `steamloopback.host/overlays/thumbnail?key=<key>` | set by the overlay app | |

**Rule for program circles:** a glass disc (T5 `liquid` material, or a fill in CSS) holding the icon at **no more than 1.5× its source size**. That is 48 px for a 64 px source in the popup grid, and up to 72 px in the main-window launcher. Use full-bleed only when a ≥ 192 px file is available (LQ4).

### D.4 How many items, and pagination versus scroll

| set | items | as a 4-5-4 Home grid (13/page) | recommendation |
|---|---|---|---|
| Launch Program | 24 (15 without developer mode) + Liquid Glass | 2 pages | **Pages** (visionOS-native). In the 300 px popup: a 3 × 8 grid that scrolls; in the main window: 2 pages with dots |
| Desktop windows | 0 now, open-ended | first group / own tab | Separate group shown first; usually 1–5 |
| Recent games | 20 (MRU) | 2 pages | **Pages**: page 1 = 12 most recent + "All Games" |
| Favorites | 0 | — | Page shown only when non-empty |
| Collections | 9 (1 useful) | 1 page of folders | Folders; empties last |
| All Games | 350 | 27 pages | **Scroll, not pages.** Posters in a vertical virtualized grid with a letter index (C.3) |
| Non-Steam shortcuts | 54 | 5 pages | Scroll in the catalogue; optionally a "Non-Steam" folder on the Home view |
| Search | 446 all / 424 library | — | Scroll, grouped (C.6) |

- Pages work when a set fits in about three pages. Nobody pages to item 300.
- visionOS keeps its Home short because people arrange it. Here nothing may persist, so the stable orders must come from Steam's own data:
  - MRU for Recent;
  - Steam's Favorites collection (the user's own Steam data, changed only by the user);
  - A–Z for programs.

### D.5 Layout numbers

| surface | circle | cell or pitch | label | per page / visible | angle of the circle |
|---|---|---|---|---|---|
| "+" popup (300 px window, 0.037°/px) | 72 px | 100 × 120 px cells, 3 columns | 15 px Medium, ≤ 2 lines | 24 in 8 rows (960 px) if the cap can rise; else 15 visible + scroll | 2.7° |
| Main-window launcher (0.0307°/px) | 112 px | 224 × 196 px hexagonal pitch, 4-5-4 | 20 px Medium, ≤ 2 lines, 14 px below | 13 | 3.4° |
| Optional catalogue circle view (square lattice) | 112 px | 168 × 196 px, 7 columns | 18 px | ~3.5 rows visible; 50 rows for 350 | 3.4° |

- **Hit targets.** The focusable element is the whole cell, not the circle: ≥ 100 popup px (3.7°) and ≥ 168 main px (5.2°). The circle is a visual mask on a child image. Steam's `::before` hit-extender idea still applies.
- **Hexagonal lattice and the D-pad.** With a half-pitch offset, Up/Down from a 5-row item has two equidistant neighbours.
  - Steam's spatial navigation will break the tie consistently, but Down then Up may not return to the same icon.
  - Use explicit neighbour maps (LQ3): Up/Down go to the lower-index neighbour and back symmetrically.
  - If that is not possible, use a square lattice (5 × 3 = 15 per page) with circles, which loses only the stagger.
- **Paging input:**
  - LB/RB, or Left/Right at a row's end, change the page.
  - With the laser, the faded neighbour icons at the edges and the page-dot capsule (dots 12 px in a ≥ 64 px capsule with ‹ › hit areas) change the page.
  - There is no swipe gesture on a laser.

### D.6 Sorting, collections and filters to keep

| capability | Home view (C.1/C.2) | catalogue (C.3) |
|---|---|---|
| Order | Fixed and stable: MRU (Recent), Steam's order (Favorites), A–Z (programs, collections) | **All 10 Steam sorts**, persisted by Steam, shown in the toolbar |
| Filters | None on the Home view (it is a launcher). A "Ready to play" badge instead of filtering | **All**: compat level, 47 feature checkboxes, dropdowns, tags, friends, VR sub-filter, Reset, Save as Dynamic Collection |
| Collections | Folders (open → catalogue filtered to that collection) | Tab and pages unchanged; Add to › / New collection in the tile menu |
| Tabs | Tab ornament: Recent · Favorites · Collections · Apps · Windows | All Games, Great On Frame, Ready To Play, Collections, Non-Steam, Soundtracks (+ conditional Installed, Favorites, Remote Play) |
| Search | Header search capsule (`shell-nav.md` C.1) | Same |

### D.7 What must not be lost (checklist for any launcher or grid)

1. **The Liquid Glass row** in Steam's own "+" popup, working and findable by its label, whatever our layers do (P3, LQ10).
2. Every launch path: Play/Install via the game page and the tile menu, `LaunchNonSteamApp`, `DashboardDesktopWindowClicked`. Launching stays one action away (A, or one click), as today.
3. The "Add Desktop Window" section and its live window icons.
4. The rescan on every "+" press, developer-mode filtering and "Install Chromium".
5. All 10 sorts, all filters, the VR sub-filter, dynamic collections, Favorites, Add to › / New collection, Hide/Manage/Properties.
6. Tile states (A.10): compat, installed, downloading, update, running, friends playing, coming soon, locked, copies, missing-art title.
7. Fast-scroll, scroll-position restore when returning from a game page, and section headers for non-alphabetical sorts.
8. Laser and gamepad parity, and the footer legend actions (they stay in the DOM even when restyled).
9. Steam's own Home with its feeds (one tab away, every card still works).
10. Search categories including Friends, Store, Tools and Hidden.
11. High contrast and Reduce Motion.
12. Performance: themed scroll fps within 5% of stock (`glass.py perf`), no animated filters, nothing animating at rest (`document.getAnimations()` empty).
13. Nothing persisted by us: no files, no Steam settings changed. Orders come from Steam data; any arrangement lives in memory only.

### D.8 Verification plan (agents only)

| check | how |
|---|---|
| Layout and look | `python glass.py shot main p2_apps_*` / `shot barpopup p2_plus_grid_*` with the OPEN pre. Measure circle centres in the shot. Compare with refs 1, 9, 10: diameter/pitch 0.52–0.55 and row pitch 0.84 × column pitch measured there. The proposed 112 / 224 / 196 px gives 0.50 and 0.875; anything within about 5% of the references passes |
| No functional loss | `python glass.py audit barpopup --pre OPEN` and `audit main --route …`: 0 GONE/HIDDEN/SHRUNK/UNCLICKABLE |
| Gamepad | `L.pad` sequences: every cell reachable; Down-Up and Left-Right return to the start; LB/RB change pages; B closes or returns |
| Launch wiring | In the test build the view **logs** the call it would make (function + argument, e.g. `LaunchNonSteamApp` + `strCmdline`) and the agent compares it with Steam's own row for the same item. Never execute it |
| Toggle safety | Find "Liquid Glass" by text in Steam's popup with each layer on; in the T3 launcher, check the route change happens before the toggle (logged, not executed) |
| Art | Sample the visible page's `<img>` `naturalWidth` (≥ 1.5 × CSS size × DPR for game art), and count fallbacks |
| Depth | `__LGS_SG.dump()` shows icon crops at +10 mm and the focused one at +25 mm; one hvgrab frame (look, then delete) |
| Performance | `python glass.py perf main --route /lgs/apps`, GPU time from `glassd-out.json`, and a paging test of 10 page changes |
