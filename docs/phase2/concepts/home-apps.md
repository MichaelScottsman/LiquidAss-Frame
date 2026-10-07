# Concept: Home view and App Library (`concepts/home-apps.md`), revision 3

This concept redesigns everything a user launches from:

- Steam's Library home;
- the library catalogue (tabs, grid, sort, filter, collections);
- search, as a way to find anything you can launch;
- the dashboard bar's "+" popup (Add Desktop Window / Launch Program).

Games, Steam shortcuts and desktop programs become one visionOS-style app-selection experience.

**Revision 3 (Phase 2 build, milestone M0).** This revision brings the text into line with `docs/phase2/PLAN.md` §1, which decides every conflict between concepts. §0.4 lists each §1 decision that touches this concept and where it landed. Where this text and PLAN §1 still disagree, PLAN §1 wins. The main changes from revision 2:

- **Attention, not focus, drives the reveals.** Laser hover never moves Steam's focus (IM D-7, proven), so the card ramp and the name plates run on P3's attention state machine: gamepad focus, or laser dwell (§3.4).
- **Plates.** Every glass element on Home and in folders is a P9 G1 plate tagged for P6's reporter; only the attended item pops, +15 mm, **non-interactive** in the default profile (§10).
- **One control vocabulary.** The top row sits on the 108 px toolbar row's centre line; the section control is a contiguous segmented control; the card's More circle has the shell helper's look (§3.1, §3.4).
- **Search is window-nav's sheet.** This concept's three contributions go through C1b's provider API; the Apps cell becomes an Apps section in the results sheet (§6).
- **Depths and dimming** follow PLAN §1.7 and §1.8: the "+" popup +25 mm, menus and the Filters sheet +10 mm, Steam's overlay at black .35 for the dim (§4, §8, §9, §10).

Revision 2 answered the critic's review point by point (§17). Revision 2's main changes, still valid: real glass on the windowless Home without ghosts; window-nav owns search; What's New is its own route; the Liquid Glass switch lives only in the "+" popup; the card ramp with an 80 px action pitch and hysteresis; a "+" popup that shows all 23 programs; a library ornament specified per input mode; mockups built from the Frame's real data.

Built on `docs/phase2/DESIGN2.md` (cited **D2 §n**) and `docs/phase2/PLAN.md` (**PLAN §n**). Other sources:

| Short name | Document |
|---|---|
| **LA** | `audit/library-apps.md` |
| **SN** | `audit/shell-nav.md` |
| **SR** | `capabilities/steam-react.md` |
| **SP** | `capabilities/spatial.md` |
| **E2E** | `capabilities/native-e2e.md` |
| **IM** | `capabilities/input-mode.md` |
| **WN** | `concepts/window-nav.md` (owner of the window, toolbar, bottom ornament, sheets and search) |
| **CC** | `concepts/control-center.md` |
| **CTL** | `concepts/controls.md` |
| **VP** | `research/visionos-principles.md` (P-01 to P-89) |
| **VR** | `research/visionos.md` |
| **REF** | `research/references.md` |
| **MO** | `research/liquid-glass-motion.md` |
| **INV-L**, **INV-B**, **INV-S** | `docs/inventory/library.md`, `bar.md`, `shell.md` |
| **NATIVE** | `docs/NATIVE.md` |
| Contracts | `docs/phase2/contracts/react.md` (P2), `interaction.md` (P3), `tokens.md` (P4), `motion.md` (P5), `reporter.md` (P6), `glassd.md` (P9), `lab.md` (P10) |

The reference shots are `docs/refs/visionos/1–12`.

---

## 0. Packages, mockups, units, data and conformance

### 0.1 Who builds what (PLAN §2.4, §2.6)

The concept file is owned by **C2a**. The other packages build their sections from it and send text changes to C2a as requests (`docs/phase2/wp/<package>.md`, "Requests").

| Package | Sections it builds | Its files |
|---|---|---|
| **C2a** Home, folders, What's New | §3, §5 (Home launches), §6 (the search provider), §10, §11 (Home rows), §12.1, §12.5 (Home paths), §12.9 | `theme/41-home.css`, `device/rt/41-home.js`, `device/rt/41-search-apps.js`, `theme/layers/41-home.json`; this file and `xc-home-search.md` |
| **C2b** Launcher ("+" popup) | §4, §5 (the toggle row), §12.7 | `theme/32-launcher.css`, `device/rt/32-launcher.js`, `theme/popups/32-launcher.json` |
| **C2c** Library catalogue | §7, §8 (sources and content), §9, §12.2–§12.5 (library paths) | `theme/40-library.css`, `device/rt/40-library.js`, `theme/layers/40-library.json` |
| C1a, C1b, C1c | The window, Back, the search field and circle, the ornament and the More helper (C1a); the search sheet and its provider API (C1b); menus and sheets (C1c) | WN |
| P2, P3, P6, P9 | Routes, actions and data hooks (P2); input mode, attention, tooltips, sounds (P3); plates and pops in the reporter (P6); plates in glassd (P9) | Contracts |

### 0.2 Mockups

All mockups are true size with `mockups/kit.css`. They use window-nav's shared chrome (`window-nav-shared.css/js`, C1a) for the tab bar, window, toolbar, ornament, window-bar row and bar, so both concepts render the same scene. Shared pieces are in `mockups/home-apps.css`, `home-apps.js` and `home-apps-icons.js` (C2a).

| Mockup | Owner | Render | Shows |
|---|---|---|---|
| `home-apps-home.html` | C2a | `p2_home-apps_home.png` | Home › Recent, page 1 of 2, laser mode, with the real 12 most recent games plus All Games. The laser has dwelt on Rise of the Tomb Raider, which has opened into its card; the laser is on Play (pointer proxy, native mode) |
| `home-apps-home-t1.html` | C2a | `p2_home-apps_home-t1.png` | The same Home on the CSS-only path (native mode off): CSS plates (black .58 + white .16 → .04 + edge cues), no frost, no pop, no pointer proxy |
| `home-apps-apps.html` | C2a | `p2_home-apps_apps.png` | Home › Apps: the real launch list A–Z (23 programs, Liquid Glass not among them). The laser has dwelt 0.4 s on Frametop Display Settings: its name plate |
| `home-apps-collections.html` | C2a | `p2_home-apps_collections.png` | Home › Collections: the real collections; the 8 empty ones are grouped in one dimmed folder, attended, with its two-line name plate |
| `home-apps-folder.html` | C2a | `p2_home-apps_folder.png` | The real "VR" collection (27 games) as a folder route, page 1 of 3, **gamepad mode**: focus on Grimlord for 0.8 s has opened its card (Install, not installed) with the X and ≡ glyph badges; five not-installed games show the cloud badge |
| `home-apps-depth.html` | C2a | `p2_home-apps_depth.png` | Depth and glass on Home without ghosts: plates, the occluder plate under the one pop, mosaic bands, the click-safe rule and the static check |
| `home-apps-search.html` | C2a | `p2_home-apps_search.png` | window-nav's results sheet for "half" over the Library snapshot, gamepad mode, with this concept's contributions: the Apps section (Half SBS Toggle) and X = Play in the ornament |
| `home-apps-plus.html` | C2b | `p2_home-apps_plus.png` | The bar's "+" popup (T3): 4 columns, all 23 programs visible, the full-name plate on focus, the Liquid Glass toggle row |
| `home-apps-plus-t1.html` | C2b | `p2_home-apps_plus-t1.png` | The same popup with T1/T2 only: Steam's list in Steam's real scan order, with Liquid Glass as a normal cell carrying a green "on" pip |
| `home-apps-library.html` | C2c | `p2_home-apps_library.png` | Library, laser mode: More circle inside the hovered poster, the tile menu grown from it, and the laser-mode ornament |
| `home-apps-library-pad.html` | C2c | `p2_home-apps_library-pad.png` | Library, gamepad mode: focused poster and the legend ornament, in the same fixed slots |
| `home-apps-filter.html` | C2c | `p2_home-apps_filter.png` | Library Filters as window-nav's 960 px sheet, with Steam's real options |

`home-apps.css` (C2a) also carries the "+" popup and library rules that C2b's and C2c's mockups load. Revision 3 changed two of them: the poster lift shadow is now sized for its +15 mm pop (`0 6px 18px`, VP P-48), and the CSS-only plate recipe is keyed on `data-tier="t1"`.

### 0.3 Real data, not invented data

The mockups read the Frame's own data, fetched read-only by `mockups/fetch-library-refs.py` (C2c).

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
| 5 of the first 13 games of the "VR" collection are not installed | The not-installed state (cloud badge, Install on the card) is part of the folder mockup (§3.3) |
| In the 300 px popup, 11 of 23 names cannot fit two lines at the 15 px floor | A word-aware label fitter plus the full-name plate on focus (§4) |
| Steam's grid shows no title under a focused tile, only a compatibility badge | The library keeps that: no caption, badge restyled (§7) |
| Skyrim VR has no logo | The text fallback shows; acceptable, honest |
| Search for "half": 9 library matches; exactly one program (Half SBS Toggle) | The search mockup shows those, and no invented counts for the other categories (§6) |

### 0.4 Units

- Sizes are main-window CSS px, with visionOS points in brackets (1 pt = 4/3 px, D2 §2.1).
- Popup sizes are in that popup's own px, with the main-window equivalent obtained by dividing by m = 0.83 (D2 §2.5).
- Depths are in mm. Scene units = mm / (369 × r), with S and r read live (PLAN §1.7, SP §1.2); at r = 1, +15 mm = 0.0407 u, and at today's r = 0.863 it is 0.0471 u.
- Off-axis shift of a pop: dz × tan 35° = 0.70 × dz mm, which is 0.91 × dz CSS px (0.77 mm per px).

### 0.5 Conformance with PLAN §1 (revision 3)

Every PLAN §1 decision that touches this concept, and where the text now carries it.

| PLAN | Decision | What changed here | Where |
|---|---|---|---|
| §1.1 | Owners of shared elements: WN owns the window, toolbar, ornament, More circle, search and presentations; HA contributes the windowless routes, the library's five slots and search providers | Package table; the card's More reuses the shell helper's look and dispatch; the Home field is WN's circle | §0.1, §3.1, §3.4, §6, §7 |
| §1.2 | Route glass modes: `/library/home` and `/library/lgs/folder/*` are `windowless` (every glass element a plate; CSS plates black .58 + white .16 → .04 + edge cues); What's New is `window-full` 1280 × 720; library routes `window` 656 | Home and folders tell C1a's route map their mode through `glassMode`, so a failed override falls back to `window-full` (§3.7). CSS plate recipe in §10.5 | §3, §3.6, §3.7, §10.5 |
| §1.3 | One control vocabulary | Back (24, 24) / box (14, 14); search circle (1196, 24) / box (1186, 14); section control as a contiguous 64 px segmented control with 60 px segments; card actions with 80 px hits; More 60 / 80 black .38 + 10 px blur; Home disc 120 on 224 / 188; glyph badges 30 | §3.1, §3.4 |
| §1.4 | Two input signals (`html.lgs-input-*`, `data-lgs-vr-mode`), one accessor; hover never moves focus; laser looks on `:hover`, lift after 80 ms dwell; one attention state machine; focus add .28; only content cards and Home discs lift; glyph badges in gamepad mode only | The ramp and name plates run on `rt.attend`; `lgsInputMode()` replaced by `__LGS_RT.input`; "laser hover moves focus" withdrawn everywhere; badges keyed on `data-lgs-vr-mode="gamepad"` | §1.2, §3.4, §3.5, §7.1, AT-8, AT-20 |
| §1.5 | One motion system (P5 tokens); Steam's entrance animations overridden within its timeouts (S3); nothing at rest; Reduce Motion fades only | Home entry ≤ 800 ms with the stagger; every duration a token; ramp and section changes are C2a's T3 motion | §11 |
| §1.6 | Five materials, four mechanisms; plates ≤ 32 per surface; E3 lobe; no outline; glass L 55–110, 70–90 under text | Plates instead of cover shapes; text-bearing plates (card, name plate) tinted to L 70–90 | §3.4, §10 |
| §1.7 | Two depth profiles; admission rules; {0, +10, +15, +25} mm; Home focused cell, card, name plate +15 non-interactive over the plate's occluder; "+" popup +25; menus and sheets +10 | Depth table replaced; the card's actions use 80 px hit elements so the click-safe rule admits +15 | §4, §8, §9, §10.4 |
| §1.8 | Alert and sheet dimming is Steam's overlay at black .35; no `t1` tint for in-window modals | The Filters sheet's `t1` dim is withdrawn | §9, §10.4 |
| §1.9 | Header 108 or the fallback classes; the field's three variants; search is WN §4; HA contributes through `__LGS_RT.search.addProvider` | Home keys only on `lgs-hdr-108` / `lgs-hdr-40`; §6 rewritten for the provider API | §3.1.1, §6 |
| §1.10 | Legends never hidden; capsule or quiet legend; A and B always present; library five slots 880 px in both modes; compact members, never dropped | §7.1 aligned; xc's "please reconcile" closed | §3.6, §7, `xc-home-search.md` §3 |
| §1.11 | One More helper (C1a, `more.register`), one node per document, host's `onMenuButton`; never on Home's launcher discs | §7.2 rewritten (C2c registers posters); the card's More is the card's own control with the helper's look | §3.4, §7.2 |
| §1.12 | Menus by item count; Cancel a 56 px quiet capsule; anchoring gated; destructive rule by count | Sort is the two-column grid; the tile menu is compact with Developer › | §8 |
| §1.13 | P3 tooltips (0.8 s / 0.2 s); Steam's sounds through its bus, none on hover; haptics off | Tooltips on Home's icon-only controls; sound map for sections and pages | §3.4, §3.5 |
| §1.14 | HA-1 to HA-14 adopted with corrections (attention, +15 non-interactive pop, G1 plates with HA §10.5 as the floor, "+" at +25); HA-3, HA-4, HA-5, HA-10 adopted, D2 §3.5 amended by P4 | HA-3's sign-off note closed; decisions table updated | §2 |
| §1.15 | Strings from Steam's localization; English only when the UI language starts with `en` | New §3.8 lists every string T2/T3 draws | §3.8 |
| §1.16 | Exemptions E-BACK, E-SEG, E-MENU | Back on Home and folders is E-BACK; the section control is E-SEG | §3.1, AT-7 |
| §1.17 | Sign-off register: S2 (interactive pops off), S3, S12 (Home adopted), S14 (More circle), S16 (pointer proxy native only), S25 (dwell) | Defaults recorded; new decisions taken without the user carry a flag (§2, HA-19) | §2, §3.4 |
| §1.18 | DESIGN2 amendments A2 (windowless routes, plates, LB/RB sections, one-line labels, folder pages) | No HA text depends on the unamended D2 §3.5 any more | §2 |
| §2.4 (C2a card) | AT-8(d): the ramp is fed by attention, no CSS `:hover` reveal; AT-10: the focused cell at +15 mm, `interactive: false` in the default profile; PLAN-2a-1 | Tests rewritten | §14 |

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
   - Above them, on the same line as every window's toolbar, a slim centred segmented control offers Recent, Collections and Apps. To its right are a What's New button and a search circle.
   - The Steam tab bar hangs at your left.
   - Everything sits on one plane, as on visionOS Home.
2. **Point at a game and it lifts toward you.**
   - The laser lights a disc at once. After 80 ms on it, the disc scales ×1.10 and, in native mode, rises 15 mm. Gamepad focus does the same at once.
   - Rest on it for 0.8 s and the disc opens into a glass card: the game's hero art and logo, a green **Play** capsule, a **More** circle, the title, compatibility and playtime.
   - A still opens the game page, as it always has. X is Play straight away.
   - With the laser, Play is one click once the card has opened, or two steps through the game page.
3. **Programs are apps too.** The Apps section is Steam's own "+ > Launch Program" list as visionOS would show it:
   - every program is a glass disc with its icon;
   - sorted A–Z, two pages;
   - after 0.4 s on it, a name plate shows the full name.
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
7. **Search is the system's search** (window-nav's sheet). This concept adds desktop programs to it: an Apps section, and programs ranked into the Top Hit. On library items, X plays.
8. **The storefront is one button away, untouched.** What's New opens Steam's own Home feed (shelf, What's New, Friends, Recommended) in a glass window. Every card works as before.

### 1.3 Is the current UI optimal in VR? Per context

| Context | Verdict | Why (evidence) | Redesign |
|---|---|---|---|
| Library Home | **Not optimal** | Launcher and storefront are mixed. The featured tile reflows 11.7° on focus. Status text is 12 px uppercase. The tile menu has no laser path, because the footer is hidden on Home (LA B.3, B.5.1, B.5.4, H3) | A windowless Home view of discs with sections and a card ramp; the feeds move to their own route (§3) |
| "+" Launch Program | **Not optimal** | Icons are 0.6° and rows 1.5°. 40 % of the list is hidden, the order is unstable, and the theme switch sits in a random row (LA B.1, B.3) | A 4-column popup with all programs visible and the switch as a row (§4); the full grid in Home › Apps (§3) |
| Library catalogue (grid) | **Content is fine, chrome is not** | Posters at 5.3° are good. Tabs are 1.04°, the sub-filter 1.35°, legends 1.07°. There are two control sets for Sort/Filter that switch with the input mode, and no position cue in 30 screens of scroll (LA B.1–B.4) | Posters stay in a window (LA D.1); chrome rebuilt as a segmented control, one per-mode ornament with fixed slots, and a scrubber (§7) |
| Sort menu, tile menu | **Not optimal** | Centred console sheets far from their source, 1.47° rows, no current value shown (LA B.4.4) | Glass menus grown from their source, laid out by item count, current sort checked (§8) |
| Library Filters | **Worst screen** | 47 rows of 0.86°, 0.49° checkboxes, 3.8 window heights of scroll (LA B.1) | A sheet with segments, chips and collapsed sections, about 1.2 sheet heights (§9) |
| Collections tab | **Not optimal** | 8 of 9 tiles say "( 0 )" and push the useful one off the first row (LA B.3) | Folders, with the empty ones grouped (§3.2) |
| Search results | **Not optimal** | Category tabs 1.04°; no titles or install state; programs are not searchable (LA A.7, B.2) | window-nav's search sheet plus programs from this concept (§6) |
| Non-Steam tab | **Partly broken-looking** | About half of 54 shortcuts show a title card or an empty tile (LA B.4.6) | Monogram circles on Home; Steam's title card restyled in the grid (§3.3, §7) |

---

## 2. Decisions

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| HA-1 | **Home is windowless.** Every glass element on it is a **plate** (PLAN §1.6): P9 G1 plate glass in native mode, the CSS plate recipe otherwise. Only the attended item pops (§10) | A window of circles; rev 1's popped band without covers | visionOS Home has no window (refs 1, 9, 10; D2 §3.5 as amended, A2). E2E §1 forbids pops that are not covered. PLAN §1.2 makes `/library/home` and folders `windowless` |
| HA-2 | **Sections: Recent · Collections · Apps (· Windows).** What's New is **not** a section | A What's New segment (rev 1) | Inside What's New, Steam's tabbed page takes LB/RB for its feed tabs, so the same button would mean two things on one route (critic) |
| HA-3 | **On Home, LB/RB switch sections, and D-pad Left/Right past a row end turns the page.** LT/RT also turn pages when delivered. **No bumper glyph badges by default**: Steam itself draws arrows instead of LB/RB glyphs on VR tab rows (INV-L §1.4) | LB/RB = pages (D2 §3.5 before A2); reading the controller's button set to decide on badges | **Adopted** (PLAN §1.14, S12; D2 §3.5 amended by P4, A2). On every Steam tabbed page LB/RB means "tabs", and sections are tabs. L.pad cannot prove that the Frame's controllers deliver bumpers in VR, so every section and page also has a D-pad path (AT-3j). VP I-15's LB/RB badges at the control's ends are built behind the flag `home.bumperBadges` (off, HA-19) |
| HA-4 | **A opens the game page; X is Play** (Steam's primary action). The card's Play capsule does the same as X. Programs, folders and windows activate on A | A = Play | Adopted (S12). Keeps Steam's muscle memory and every launch dialog on the game page (H2); one-step Play stays available (LA C.2) |
| HA-5 | **Labels are one line**, ending in an ellipsis. The full name shows on attention (card or name plate) | Two-line labels (D2 §3.5 before A2) | Adopted (S12). Two lines cannot fit under row 3 with the page dots inside 720 px; visionOS Home labels are one line (refs 1, 10) |
| HA-6 | **The card ramp:** after 0.8 s of attention, the disc morphs into a 320 × 240 card holding Play and More, 180 px apart. It is driven by P3's attention state machine (gamepad focus or laser dwell) and has hysteresis (§3.4) | A Play capsule under the label (D2 §3.5); rev 1's 312 × 206 card with circles at a 68 px pitch; rev 2's "focus is the single driver" | The label band cannot hold a 60 px button. The card is visionOS's "pop open to reveal more" (VR §19). An 80 px pitch is D2 rule 1. Laser hover never moves Steam's focus (IM D-7), so focus alone cannot drive it (PLAN §1.4) |
| HA-7 | **The catalogue stays posters in a window** (window-nav's window) | All 350 games as circles | 27 pages with no random access, and circle crops drop logos (LA D.1). Circles are for launching |
| HA-8 | **Search belongs to window-nav** (its sheet, PLAN §1.9). This concept contributes programs (ranking plus an Apps section) and X = Play on library items through C1b's provider API. The Home field is window-nav's **circle variant** | Rev 1's split view at `/search/tab/<id>` | Only one override can render the route (critic). One field spec everywhere |
| HA-9 | **The "+" popup stays Steam's popup in Steam's host** (300 px), restyled. A T3 patch adds A–Z order, 4 columns and the toggle row | Opening Home from "+" | The theme switch must never depend on our route (LA C.1, D.7.1). LQ5 (opening a T3 route from the bar) is unproven |
| HA-10 | **The Liquid Glass switch appears only in the "+" popup.** In T3 it is a toggle row at the bottom that never takes default focus; in T1 it is Steam's own row with a green "on" pip. It is **not** in Home › Apps or in search | Rev 1: first cell of Apps, drawn as a white "on" disc | Adopted (PLAN §1.14). A habitual A on the first cell would turn the theme off. White is this design's selection colour (critic). P2's `useNonSteamApps` leaves it out unless asked |
| HA-11 | **Steam's menu "Cancel" stays**, as WN's 56 px quiet capsule centred under the rows | Removing it | It is Steam's node (the audit would report it HIDDEN); 56 px is at least Steam's 48 px, so not SHRUNK (PLAN §1.12) |
| HA-12 | **Program icons are drawn at 64 CSS px, their source size** (Steam's 64 px `strIconDataBase64`). In Steam's 1.5× texture that is 96 px, D2 §9.3's 1.5× cap. On the display it is 38–47 px (D2 §2.3), so a 64 px source is not visibly upscaled | 72 px (rev 1, 1.7× in the texture); 48 px (D2 §9.3's example) | 48 px leaves a 120 px disc mostly empty. 64 px is the largest size inside the cap. The 6 icons that Steam upscaled from 32 px stay soft until the daemon supplies theme icons (LQ4) |
| HA-13 | **Empty collections are grouped** into one dimmed "Empty Collections" folder when there are two or more | 8 dimmed circles last (rev 1) | 8 of 9 collections here are empty. Grouping keeps every one reachable at one more level (VP P-61: dimmed and last) |
| HA-14 | **Folders and What's New are routes** under `/library/lgs/…` (P2 `routes.add`, D2 §12) | In-page folder state | Steam's Back and B work natively, and focus memory and history stay Steam's |
| HA-15 | **The card's actions are 80 px hit elements** with the 60 px glass drawn inside (Play: capsule hit 80 tall; More: 80 × 80) | 60 px hit boxes | PLAN §1.7 rule 2 measures the smallest focusable inside the crop: s = 80 admits the card's +15 mm pop (s ≥ 78); a 60 px box would cap it at +10 mm, a fifth depth class on Home |
| HA-16 | **The card's More circle is the card's own control** in its action row, with the shell helper's look (60 / 80, black .38 + 10 px blur, white while its menu is open) and the helper's dispatch (the cell's own `onMenuButton`, the same handler as ≡) | Registering the card with C1a's `more.register` (top-right placement on the art) | PLAN §1.11 keeps the helper off Home's launcher discs; one action row (Play, More) reads as visionOS's expanded card; the dispatch is identical, so there is still one menu path |
| HA-17 | **A gamepad focus move closes the open card at once**; the 0.3 s grace bridges laser jitter only | 0.3 s grace for both inputs (rev 2) | A D-pad move is deliberate; VP P-18 wants one lit element shortly after a move. P3's `leaveMs` keeps the grace for the laser, and the new cell's `enter` closes the old card in gamepad mode |
| HA-18 | **The Apps contribution is a section of the results sheet**, after Top Results and before In the Store: up to 3 program capsules (64 visible, 80 hit), the third reading "N More" when there are more matches | Rev 2's Apps cell beside a 704 × 76 Store row, which window-nav's sheet no longer has | WN §4.6's sheet lists categories as sections; visionOS Spotlight lists apps right after the top hit; local programs launch at once, the Store does not (§6) |
| HA-19 | **Decisions taken without the user** (PLAN §1.17's rule: the safe default behind a flag): LB/RB glyph badges on the section control (VP I-15) off (`home.bumperBadges`); Home's runtime gated by `wp.c2a` (PLAN §2.1) | — | Steam's own VR convention is arrows, not bumper glyphs; badges would teach a button whose delivery in VR is unproven (AT-3f). Recorded in `docs/phase2/wp/C2a.md` |

---

## 3. Home (the app-selection view)

**Route.** Steam's `/library/home`, rendered by a T3 route override that receives Steam's children: `rt.react.routes.override(Routes.Library.Home(), fn)` (P2 §4.2; SR §3.5 [PROVEN]). P2 wraps it in an error boundary whose fallback is Steam's own Home.

**Other routes** (P2 `routes.add`, under `/library/lgs/`):

- Steam's Home children render at `/library/lgs/steamhome` (What's New, §3.6).
- Folders render at `/library/lgs/folder/:id` (§3.2).

**Glass mode** (PLAN §1.2). C1a's route map sets `data-lgs-glass` on `%{BasicUiRoot}`. Home and folders are `windowless` **only while the override is installed**: `41-home.js` answers C1a's `__LGS_RT.shell.glassMode('home' | 'folder', fn)` hook with `windowless`, and nothing (so C1a uses `window-full`, Steam's own Home in a window) when it failed to install (§3.7). What's New is `window-full`.

**Footer.** Steam hides its footer on Home today (LA B.3). The override renders inside `ui.Page` (P2) with the footer props Steam's Home page passes, so the footer keeps Steam's visibility on this route; AT-1 compares `#Footer`'s visibility with stock Home. If Steam shows it anyway, it is C1a's quiet legend (PLAN §1.10) at y 652–712, and the page dots move into its leading end.

**Runtime flag.** Everything T2/T3/T5 in this section is behind `wp.c2a` (PLAN §2.1), off until V2 accepts the package.

### 3.1 Layout of the overlay (1280 × 720 px = 960 × 540 pt)

```
 x: 0   24  84       412                 640                868   980         1176 1196  1256 1280
 y 24  ( < )            [ Recent | Collections | Apps ]             ( * What's New )  ( Q )      top row, centre line y 54
 y 136              ( )        ( )        ( )        ( )                        ( ) peek  row 1, centres y 196
 y 324       ( )        ( )        ( )        ( )        ( )                              row 2, centres y 384
 y 512              ( )        ( )        ( )        ( )                        ( ) peek  row 3, centres y 572
 y 690                               o  o   (page dots)
```

The top row sits on the centre line of window-nav's 108 px toolbar row (y 54), so Back and the search circle are exactly where they are on every route.

| Element | Size and position (px [pt]) | Material | Depth | Notes |
|---|---|---|---|---|
| Back | Circle 60 [45] at (24, 24); hit 80 [60], box at (14, 14) | Plate, `liquid` | 0 | Steam's `%{BackContainer}` (C1a), laser only as today (B is the gamepad path). Steam's "Back" text stays in the DOM as the circle's `aria-label`, visually a chevron (E-BACK, PLAN §1.16); after 0.6 s it grows into a titled capsule (C1a) |
| Section control | Track 64 [48] tall at y 22–86, centred on x 640, padding 2. Segments **contiguous**, 60 [45] tall, ≥ 140 wide, padding 28; the visible fill is inset 2 px. Labels 22 px [16.5 pt] Semibold. Width ≈ 456 [342] with 3 segments, ≈ 604 [453] with Windows. Hit 80 tall (y 14–94) by transparent padding | Plate, `liquid`; selected segment = the white .94 pill with a dark label, travelling on `snappy` (D2 §7.10, CTL §8.3) | 0 | Our T3 `Focusable` row (`flow-children: row`). E-SEG (PLAN §1.16). Adjacent hit boxes abut (VP P-07). No bumper badges (HA-3, HA-19) |
| What's New | Capsule 60 [45] tall at y 24, right edge at x 1176, ≈ 196 wide: sparkle 24 + 10 + label 22 px Semibold, padding 20 / 24; hit 80 tall | Plate, `liquid` | 0 | Our T3 `Focusable`, last in the top row's focus order. Navigates to `/library/lgs/steamhome` (`nav.go`) |
| Search | Circle 60 [45] at (1196, 24), magnifier 27 px; box 80 × 80 at (1186, 14) | Plate, `liquid` | 0 | Steam's `%{SearchAndTitleContainer}` in **window-nav's circle variant** (PLAN §1.9; C1a), gated on WN AT-4. A click focuses Steam's input and opens window-nav's search sheet. Tooltip: Steam's search placeholder string, 0.8 s (P3) |
| Honeycomb | 13 cells per page as 4-5-4. Disc 120 [90] (3.7°). Column pitch 224 [168], row pitch 188 [141]. Centres: rows 1 and 3 at x 304, 528, 752, 976; row 2 at x 192, 416, 640, 864, 1088; rows at y 196, 384, 572 | See §3.3 | 0 at rest | Disc / pitch 0.536 and row / column 0.839, inside the refs' 0.52–0.55 and 0.84 (REF C.4) |
| Cell (the focusable) | 200 × 180 [150 × 135], anchored at the disc centre − (100, 60) | — | — | Disc + label; Steam's focus lands on the cell. Its disc carries `data-lgs-dwell` so P3's laser dwell lands on the disc, not on the label |
| Label | Subheadline 20 px [15 pt] Medium, white .92, one line, ≤ 200 px, ellipsis, top at the disc centre + 74. On-room shadow `0 1px 3px /.6, 0 0 12px /.4` | Text on the room (D2 §8.3, VP P-41) | 0, never popped | Fades to .22 while a card or plate covers it |
| Page dots | 12 px [9 pt] dots at a 24 px pitch, centred at (640, 696); current white, others white .40 | — | 0 | Indicator only; hidden when a section has one page |
| Peeks | The neighbour page's first icon of rows 1 and 3, at x 1212 (next) and x 68 (previous); scale .86, opacity .58, blur 1.5 px | CSS only (no plate) | 0 | Laser targets of 120 × 120 that turn the page (ref 9's faded edge items). Not focusable: the gamepad pages with Left/Right past a row end |
| Tab bar | Steam's frame menu at the leading edge, Home as the current route | `liquid` | +25 | Owned by window-nav (WN §3.3) |

Lighter chrome than rev 1:

- **Width:** the top row's controls take 772 px of width at 60–64 px height, against 1,188 px at 72 px before.
- **Glass area:** about 47,000 px² against 84,000 (−44 %).
- **Removed:** the search field (now a circle), the bumper badges and the What's New segment.

#### 3.1.1 Header band and the fallback layout

The section control and What's New are our page's nodes drawn into the toolbar band. Steam's `#header` is `pointer-events: none` except its children (INV-S §3.2), so the laser reaches them through it, and C1a's CQ1 fallback (`html.lgs-hdr-40`) keeps the toolbar row's controls at the same place (WN §3.2 rule 1). Home therefore keys nothing on the header height.

**Fallback layout**, used only if AT-2's click test in the band (y 30) fails, or if WN AT-4 rejects the search circle: the top row holds Back, the search capsule (520, centred) and What's New; the section control moves to y 96–160, centred; the honeycomb rows move to y 232, 412, 592 (row pitch 180); the card's top clamps at y ≥ 172. The class `lgs-home-low` on our page root switches it; it is a T3 decision made once per `lgs on` from AT-2's probe.

### 3.2 Sections and their content

| Section | Content and order | Pages (here) | Data (read-only, P2 `rt.react.data`) |
|---|---|---|---|
| **Recent** | The running game first (green dot), then Steam's MRU merged with programs launched from our surfaces in this session (in-memory timestamps), newest first. Cell 13 of every page is the **All Games** folder (→ `/library/tab/AllGames`) | 2: 12 + 8, each with All Games | `data.recentGames()` (`recentAppsCollection`, 20 here), `data.app()`, `MainRunningAppID` |
| **Collections** | First the library sets as folders: Great On Frame, Ready To Play, Installed, Non-Steam, Soundtracks, and Favorites when non-empty. Then user collections with games, A–Z. Then **one "Empty Collections" folder** when two or more collections are empty (a single empty one is shown by itself, dimmed, with an "Empty" plate) | 1: 7 cells | `data.collection()`, `data.stores().collectionStore` (`frameGamesCollection`, `readyToPlayActiveCollection`, `localGamesCollection`, `deckDesktopApps`, `userCollections`) |
| **Apps** | Every program from Steam's own launch list **except the Liquid Glass entry**, A–Z (`localeCompare`, case- and accent-insensitive) | 2: 13 + 10 | `data.useNonSteamApps({includeLiquidGlass: false})`: Steam's own scan and filter, developer mode honoured, rescanned on every Home entry, keyed by `strCmdline` |
| **Windows** (only when present) | Desktop windows that SteamVR reports, in Steam's order | 1 | The `windows` message Steam's "+" popup uses (LA A.8.4) |

**Folder route** `/library/lgs/folder/:id`, windowless like Home (`p2_home-apps_folder.png`):

| Part | Spec |
|---|---|
| Back | The same Back circle as Home |
| Title | The collection's name, centred on the toolbar row's centre line (top 32, line 44), Title 2 30 px Bold on the room, with the label shadow. Drawn by our page (no Large Title on windowless routes) |
| Show in Library | A plate capsule in What's New's slot, leading to Steam's `/library/collection/<id>` or the matching library tab (`actions.navigate`), where sort and filter live |
| Search | The same search circle as Home |
| Games | Honeycomb pages: 13 per page, same lattice, peeks and dots (VP P-61 allows the Home lattice) |

- **Leaving:** B, or Back, is history back to Home. Focus returns to the folder's cell.
- **The Empty Collections folder** opens the same way. Its cells are the empty collections, each dimmed with an "Empty" plate, and each opens Steam's collection page.
- **Fallback** (adding the route fails): the folder cell opens Steam's collection page directly.

### 3.3 Icons

| Kind | Composition | Source (the first URL Steam returns, local cache; P2 `data.art`) | Fallback |
|---|---|---|---|
| Steam game or shortcut | A `liquid` disc 120 with the art inset **4 px** (art circle 112), so a thin lensing bezel and the specular arc show around the art. Art: **hero** with `object-fit: cover`, centred at 50 % 42 %. **Logo** centred, at most 76 % × 46 % of the art, with a soft shadow. Key light from above, darker lower 40 % (D2 §9.2) | `urlStore.BuildCachedLibraryAssetURL(appid, 'library_hero.jpg' / 'logo.png', ov.local_cache_version)`; custom art via `appStore.GetCustomHeroImageURLs` / `GetCustomLogoImageURLs` (SR §3.7) for the 15 shortcuts in Recent | Portrait crop at `object-position: 50% 28%`; then a **monogram** (initials, 40 px Bold, on a gradient) |
| Program | A `liquid` disc 120 holding the program's icon at **64 × 64** (HA-12) | `strIconDataBase64` (64 px); a ≥ 128 px icon-theme file when the `lgs-shell` daemon supplies one (LQ4), drawn at the same 64 px | No icon (5 of 23 here): a category glyph of 50 px, chosen by name: display (Desktop), remote screen (Frametop Remote Access), two screens (Hide/Show Screens), gear (KDE System Settings), terminal (Konsole) |
| Folder | A `liquid` disc holding a 3 × 3 grid of 26 px portrait crops (radius 7, gap 5) | `GetCachedVerticalCapsuleURL(ov)[0]`; header crops for Soundtracks | Empty Collections: nine empty white .12 tiles, cell at .62 (.86 while attended) |
| Window | A `liquid` disc with the window's icon at 64 | `steamloopback.host/windows/icon?handle=<hwnd>` | Window glyph |
| All Games | A folder disc of the first 9 portraits of All Games | as Folder | — |

**States on icons.** These are all the A.10 states that apply to a launcher; the rest show on the card:

| State | On the icon | On the card (§3.4) |
|---|---|---|
| Running | A green 10 px dot before the label; first in Recent | Play becomes Steam's primary action for a running game |
| Not installed | Art at saturation .6 and brightness .62, plus a 40 px black .55 circle with a cloud glyph at the lower right | Play becomes **Install** (blue whole fill); status "Not installed" |
| Downloading | Art dimmed, with a white progress ring (r 22, 6 px stroke) on a black .45 disc at the centre | Status "Downloading · 62 %" |
| Update available | A blue 28 px badge with a download glyph at the top right, overlapping by a third | Play becomes **Update** (blue) |
| Frame compatibility | — (Steam shows it only on focus) | Status line: Steam's icon and word ("Verified", "Playable", "Untested", "Unsupported") |
| Friends playing, coming soon, locked, copies | — | Status line |
| Missing art | Monogram | Monogram card |
| Hidden apps | Not on Home (Recent never lists hidden apps) | — |

### 3.4 Attention and the card ramp

**Attention is the single driver** (PLAN §1.4). Laser hover never moves Steam's focus [PROVEN, IM D-7]: under the laser Steam removes `.gpfocus` and `.Focusable` and can leave a stale `.gpfocus` behind (IM §3.3). Every reveal on Home is therefore fed by P3's attention state machine (`contracts/interaction.md` §2), never by CSS `:hover`:

- `41-home.js` registers `rt.attend('.lgs-home-disc, .lgs-home-card', {dwellMs: 80, steps: [400, 800], leaveMs: 300, surfaces: ['main']})`.
- **Gamepad:** our cell's `onGamepadFocus` / `onGamepadBlur` feed it through `rt.attention.feed(disc, 'enter' | 'leave', 'pad')`.
- **Laser:** P3's own `mouseover` / `mouseout` plus dwell on the disc. The disc is a circle, so the dwell counts only inside it; moving across the label does not open anything.
- The card and the name plate read only P3's classes (`lgs-attend-400`, `lgs-attend-800`) and our component state set from `onStep` / `onLeave`. One test covers both inputs (AT-8).

| Step | What happens | Motion (P5 tokens) |
|---|---|---|
| Attention arrives | **Gamepad:** at once, disc ×1.10, white glow 26 px, depth shadow `--lgs-shadow-15mm`, label white; the first frame shows ≥ 60 % of the final contrast. **Laser:** brightness at once (the light spot at the pointer, under the art's sheen); ×1.10 and the depth only after 80 ms of dwell (`.lgs-dwell`, VP P-06). Native mode: the disc pops **+15 mm** over its own plate (§10) | `hover-in` 294 ms; out `fade` 441 ms; depth on `depth` 441 ms (P7's depth channel) |
| 0.4 s (programs, folders, windows) | A **name plate** replaces the label: liquid capsule 60 [45] tall (72 with a second line), width = text + 44, top at the disc centre + 74, clamped 16 px inside the overlay. Name 20 px Semibold; optional second line 18 px ("27 games", "8 collections with no games") | `materialize-in` 250 ms (`lgs-mat-glass-in`); out `materialize-out` 350 ms |
| 0.8 s (games) | The disc **morphs into the card**: 320 × 240 [240 × 180], radius 36, centred on the disc horizontally, top at the disc centre − 100, clamped 12 px below the section control's track (y ≥ 98) and 16 px inside the overlay (bottom ≤ 704). **Art** 296 × 140 at (12, 12), radius 24 (concentric), with the logo centred at 31 % of the art's height. **Play** capsule 60 [45] visible at (24, 80), green whole fill, play glyph plus "Play" 22 px Semibold (Install / Update blue), inside an 80 px tall hit element. **More** circle 60 [45] visible at (236, 80), black .38 + 10 px blur (the shell helper's look, PLAN §1.3), inside an 80 × 80 hit element (HA-15, HA-16). Centres are 180 px apart; the hits do not overlap. **Title** Headline 24 px Bold at (24, 162), one line. **Status** 18 px at (24, 194): compatibility icon and word, then playtime | `morph-open` 607 ms (b 0.20) from the disc's rect and radius to the card's (`lgs-morph` clip, 320 × 240 is inside the 600 × 600 limit); content 15–50 %; the two controls `materialize-in` 250 ms at 50 % |
| Attention leaves | **Laser:** the card closes 0.3 s later unless attention returns (P3 `leaveMs`). **Gamepad:** a focus move to another cell closes it at once (HA-17) | `morph-close` 441 ms; content out by 40 % |
| Press | Glass discs and capsules swell by `min(1.06, 1 + 6/maxSide)` (×1.05 on a 120 px disc); content brightens only; glow from the hit point | `interactive` 210 ms; release glow 90 ms linear, swell back on `snappy` 488 ms |

**Hysteresis**, against laser jitter while sweeping the grid:

- The 0.4 / 0.8 s steps start when attention lands on a disc. They restart only when attention moves to another disc.
- A sweep faster than one disc per 80 ms lifts nothing (P3 sets no `.lgs-dwell`).
- The card closes 0.3 s after the laser leaves it. While the pointer is over the card, attention stays, because the card is the attended element and part of the cell's DOM.
- Two attention moves within 0.3 s never open a card.

**Text-bearing plates** (the card, the name plate) are tinted so the glass under their text sits at L 70–90 (D2 §6.3): `data-lgs-plate-tint` in native mode, the plate recipe's darker variant in CSS. Measured in the mockups at L 85 over the bright studio room.

**Gamepad glyph badges** (X on Play, ≡ on More; 30 px, D2 §9.4) show only in gamepad mode, keyed on `html[data-lgs-vr-mode="gamepad"]` (PLAN §1.4, VP P-26), drawn from Steam's own glyph components where they exist (VP P-27). The laser view stays clean (`p2_home-apps_folder.png` shows them, `p2_home-apps_home.png` does not).

**Tooltips** (P3, PLAN §1.13): the search circle and the card's More circle carry `data-lgs-tip` (More: `"above"`, so it never covers the title); 0.8 s in, 0.2 s out. Back's titled capsule is C1a's (E-BACK). Discs, segments and What's New show text and get no tooltip (VP P-12).

**Covering:**

- Neighbouring labels under the card or a plate fade to .22.
- A card covers at most 14 px of a neighbouring row's discs, and the labels it covers fade.

**Reduce Motion:** no scale and no lift animation; the end depth is pushed once; the card cross-dissolves in 180 ms (`--lgs-d-reduce`, D2 §11.4 C8).

### 3.5 Navigation model

**Gamepad.** All handlers are T3 `Focusable` props (SR §3.6).

| Input | Effect |
|---|---|
| D-pad Left / Right | Previous / next cell in the row. **Past the row's end:** the same row on the next page, first cell. **Past the row's start:** the same row on the previous page, last cell. **On the first page, Left at a row's start is not handled.** It bubbles to Steam's `onMoveLeft` and opens the tab bar, exactly as today (SN N2) |
| D-pad Up / Down | **Honeycomb rule:** a vertical move keeps the cell's index within the row, clamped to that row's length. This zig-zags around the column. **One-step memory:** the opposite direction always returns to the cell you came from. **Up from row 1** enters the top row (segments, then What's New); **Up again** leaves the page to Steam's search, as today (SR §4). **Down from the top row** returns to the remembered cell |
| LB / RB | Previous / next section; the white pill travels. What's New is not in this cycle (HA-2) |
| LT / RT (if delivered) | Previous / next page |
| A | **Game:** its page (`actions.navigate('/library/app/<id>')`). **Program:** `actions.launchNonSteam(strCmdline)`. **Window:** `actions.desktopWindow(window_id)`. **Folder:** `/library/lgs/folder/<id>` (`nav.go`). **All Games:** `actions.navigate('/library/tab/AllGames')`. **Segment:** that section. **What's New:** `/library/lgs/steamhome` (`nav.go`) |
| X | Games: `actions.primary(appid)`, Steam's primary action (Play / Install / Update / Resume), the same call as the tile menu's first item |
| ≡ (Menu) | Games: Steam's tile menu (`showContextMenu` with Steam's own menu component, or Steam's `vgp_onmenu` path). Programs: none (Steam has none) |
| B | At the Home root: not handled, so Steam's root `onCancelButton` opens the tab bar, as today (SN N3). In a folder or What's New: history back |
| Route entry | Focus lands on cell 1 of the current section, or on the cell remembered for that section; never on Back or the top row (VP P-22) |
| Focus memory | Returning to Home restores the last focused cell per section (Steam's group focus memory, SR §4) |

**Sounds** (PLAN §1.13, P3 `rt.sound`). Section change: `'tab'` (ChangeTabs). Page change: `'page'` (PagedNavigation). Focus moves between our `Focusable` cells already play Steam's own BasicNav (Steam sounds GAMEPAD-source focus changes of its Panels); we add nothing there. Activation: Steam's own. Nothing on laser hover. Haptics: none (S17).

**Depth during movement.** No pop while a section or page change animates (PLAN §1.7 rule 6): our page root carries `lgs-home-moving` for the transition, and the layer rule excludes it. The attended cell pops again once the new grid has settled.

**Fallback.** If the explicit neighbour map misbehaves, use a 5 × 3 square lattice of the same discs (15 per page) with `flow-children: grid`. SR §4 proved that spatially correct.

**Laser:**

- Click a cell to activate it.
- Dwell 0.8 s on a game for the card, then click Play or More.
- Click a peek to turn the page.
- Click a segment to switch sections.
- The wheel does nothing on Home (pages, not scroll).

Every laser target above also has the gamepad path (D2 §10.4, VP P-89).

### 3.6 What's New (its own route)

**Route and frame.** `/library/lgs/steamhome` renders Steam's Home children (`steamChildren`) inside window-nav's window:

- glass mode `window-full`, 1280 × 720 (PLAN §1.2);
- window-nav's toolbar row: Back circle (nested style), Large Title "What's New" (our route root carries `data-lgs-title`, WN §3.2), the 520 search capsule.
- If Steam renders its footer on this route, it follows PLAN §1.10 on a `window-full` route: the quiet legend inside the glass, or the 84 px capsule at y 628–712 over the glass bottom when it holds actions; the feed fades under it (scroll edge). Legends are never hidden.

**Content.** The content is Steam's own page, restyled by T1 per DESIGN2 in `theme/41-home.css` (the Home shelf and feed rules move here from `40-library.css`: C2a adds them, then C2c deletes its copy, PLAN §6):

- the shelf capsules lift instead of reflowing;
- the feed tabs become a segmented control;
- text is title case;
- cards stay opaque content, ≥ 150 px cards lift ×1.05 and +15 mm when attended (PLAN §1.7).

**Behaviour.**

- LB/RB switch Steam's feed tabs (Steam's handler), as on every tabbed page.
- B and Back return to Home.
- Every card works unchanged.

### 3.7 Home without T3 (fail-closed)

If the route override cannot install, `/library/home` is Steam's Home with the T1 restyle, inside window-nav's window glass:

- `install()` throws when a required finder misses (P2 §0 rule 2); the loader marks `41-home` failed (P1);
- C1a's `glassMode('home')` hook gets no answer, so the route is `window-full` (§3, REQ to C1a);
- a failing override at render time degrades to `steamChildren` (P2's error boundary).

Nothing in §3 is then visible, and nothing is lost: every Home function is Steam's again (AT-22).

### 3.8 Strings (PLAN §1.15)

Text that T2/T3 draws comes from Steam's or SteamVR's localization through `rt.react.ui.loc()`, found by source text (GP `game-pages-locgrep.sh` method) at M3. Where no string exists, the English text is drawn only when the UI language starts with `en`; otherwise the element is icon-only or omitted. This list is copied into `docs/phase2/wp/C2a.md` for V2.

| Text | Where | Steam token to look for | Without a token, UI not `en*` |
|---|---|---|---|
| Recent, Collections, Apps, Windows | Section segments | Library "Recent Games" shelf, library tab "Collections", "+" popup "Launch Program" / "Add Desktop Window" headers | Glyph segments: clock, folder, grid, window |
| What's New | Top-row capsule, Large Title | Steam's Home feed tab "What's New" | Sparkle circle (60 / 80), no title |
| All Games | Folder label | Library tab "All Games" | — (Steam's) |
| Show in Library | Folder capsule | Steam's "View in Library" / "Show in Library" | Library-glyph circle |
| Empty Collections, Empty, "N collections with no games" | Folder label, plate | none expected | Label omitted; the dimmed disc and the count only |
| "N games" | Folder name plate | Steam's game-count string | Omitted |
| Play, Install, Update, Resume, Running, Downloading, compatibility words, playtime | Card | Steam's primary-action, status and compatibility strings | — (Steam's) |
| Not installed | Card status | Steam's "Not installed" | Omitted |
| App, "N More" | Search Apps section | none expected | Omitted; "+N" |
| Liquid Glass, "Glass Shell is on" | "+" toggle row (C2b) | The `.desktop` entry's own name; none for the second | Second line omitted |

---

## 4. The bar's "+" popup (built by C2b)

**Host.** Steam's `%{AddWindowButton}` keeps opening Steam's own popup in Steam's own barpopup host: 300 × 1024 popup px (INV-B §2), at 0.037°/px with m = 0.83.

**What the T3 patch does** (P2 `patch.byProps('c2b.plus', targets.plusButton, …)`):

- it swaps the popup's memo component (SR §3.2, §8) for one that renders Steam's own data;
- it uses Steam's own list hook (`data.useNonSteamApps`, rescanned on every press);
- it uses Steam's launch calls through P2 `actions`.

| Element | Popup px (main-equivalent px [pt]) | Material | Notes |
|---|---|---|---|
| Panel | 300 wide (the host); padding 12 top and bottom, 6 at the sides; radius 40; **726 tall** with 23 programs (12 + 52 + 576 + 10 + 64 + 12; 26.9°, against 600 = 22.2° today) | `panel` (T5 via the barpopup cover; T1 tint fallback) | Grows upward from the + button, as Steam places it (bottom centre on the bar anchor, y +15) |
| Header | 52 tall: "Launch Program" 22 px Bold (Steam's string), padding-left 18 | — | Steam's `%{DashboardBarPopupListHeader}` |
| All Apps | Circle 48 (58 [43]) at the header's right, grid glyph | Thin fill | **T3 only.** Opens Home › Apps (LQ5). Hidden when LQ5 fails |
| Grid | **4 columns of 72 × 96** (87 × 116 [65 × 87], 2.7° × 3.6°). Disc 52 (63 [47]) at white .11, with the program icon at 34 px (a 64 px source shown at 51 texture px). Label 15 px (18 [13.5]) Medium, ≤ 2 lines in 70 px, word-aware (below) | Fills on glass (D2 §6.5) | Hit region = the whole cell, 72 × 96 (≥ 67 popup px both ways, D2 §2.5). **All 23 programs fit: 6 rows = 576** |
| Labels | Line breaks only between words or after "/". A word too long for its line is cut with "…" and ends the label. Text left over after two lines ends in "…" (11 of 23 names here) | — | The full name appears on focus or after 0.4 s of attention: a 34 px capsule over the label (15 px Semibold, white on grey .92), clamped inside the 300 px host (left-aligned in column 1, right-aligned in column 4). Neighbours' labels under it fade to .22 |
| Groups | When SteamVR reports windows: a "Windows" group first (15 px Semibold secondary label), then "Programs". **T3:** a "Recent" row of up to 4 programs launched this session (memory only) above "Programs" | — | With either group present the panel grows to at most 760 (28.1°), and the program grid scrolls under a 56 px edge fade (D2 §6.7) |
| Liquid Glass row (T3) | 64 tall recessed platter (black .22, radius 28). The real Liquid Glass icon on a 44 disc, "Liquid Glass" 19 px Semibold, "Glass Shell is on" 15 px, and a switch shown on (green) | Fills | Pinned at the bottom, outside the grid's focus group. **It never takes default focus:** `preferredFocus` goes to the first program cell |
| Liquid Glass (T1) | Steam's own row stays in Steam's scan order, drawn as a **normal cell with a 14 px green "on" pip** (T2 marks it `data-lgs-row="liquid-glass"` by its text) | — | Today Steam's scan put it first, so Steam's default focus can land on it. That is stock behaviour, unchanged by T1; T3 removes it |
| + button in the bar | White .94 with a dark glyph while the popup is open (D2 §8.2) | — | Steam's Active class, recoloured (C3a) |
| Depth | Popup **+25 mm** in front of the bar (PLAN §1.7, unified with the other bar popups) | — | Popup request `z` via P6's popup wrapper (`theme/popups/32-launcher.json`) [PLAUSIBLE] (SP §3.3); without it, Steam's +3.7 mm |
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

**Launch calls.** Every surface calls exactly what Steam's row calls (LA A.8), through P2's `rt.react.actions` (PLAN §2.3 P2), which log and never run them in test mode:

- `actions.launchNonSteam(strCmdline)` → `SteamClient.Apps.LaunchNonSteamApp(strCmdline)` for programs;
- `actions.desktopWindow(window_id)` → `SteamVR.DashboardDesktopWindowClicked({window_id})` for windows;
- `actions.primary(appid)` → Steam's primary action (X, the card's Play);
- `actions.navigate(path)` for user-intent jumps (a game page, Steam's library tabs). Our own views (sections, folders, What's New) use `nav.go`, which is never logged and never launches anything.

**The list** is Steam's: `data.useNonSteamApps` plus Steam's filter, rescanned on every "+" press and every Home entry, keyed by `strCmdline` (SR §4: duplicate keys break navigation).

**The Liquid Glass entry** is filtered out of every T3 surface except the "+" popup's toggle row (HA-10). P2's hook leaves it out unless `includeLiquidGlass` is set; its match is the entry's `strExePath` ending in `/glass-shell/device/lgs`, or its name.

**The toggle row (T3, C2b)** calls Steam's own launch for that entry (`actions.launchNonSteam` with its `strCmdline`). It applies the LQ10 order whenever the main window is on one of our `/library/lgs/*` routes:

1. navigate main to `/library/home` with `replace`;
2. wait for Steam's route to settle;
3. launch.

The order matters because theme removal drops our routes (AT-16). **Tests log the order instead of executing it** (PLAN-2b-3).

---

## 6. Search: window-nav's sheet, this concept's provider

window-nav owns search: `Routes.Search.Root()` presented as a sheet over a snapshot of the page you were on, with Steam's routes underneath (WN §4, PLAN §1.9; built by C1b in `device/rt/21-search.js`). This concept contributes through C1b's provider API, from `device/rt/41-search-apps.js`:

```js
__LGS_RT.search.addProvider({ id: 'home-apps', rank, render, primary });
```

| # | Contribution | Spec | Through |
|---|---|---|---|
| S-A | **Programs in the ranking** | The program list (`data.useNonSteamApps`, Liquid Glass excluded) is matched on its name with window-nav's rule: exact title prefix > word prefix > substring. `rank(query)` returns `[{key: strCmdline, name, match: 'exact' \| 'prefix' \| 'word' \| 'substring'}]`. A program becomes the **Top Hit** only when its match class beats the best library match (a tie goes to the game). As Top Hit: its icon at 120 on a disc over a neutral glass gradient, status "App", and the **Open** capsule launches it (`actions.launchNonSteam`) | `rank` |
| S-B | **The Apps section** | When programs match, a section after Top Results and before In the Store (HA-18): Title 3 header "Apps", then one row of up to 3 capsules, 64 visible (hit 80), ≤ 310 wide: a 48 px disc with the icon at 36, the name 22 px Semibold, "App" 20 px secondary. A launches. With more than 3 matches the third capsule reads "N More" and opens Home › Apps with the next match focused. No matches: no section | `render(query, ctx)` |
| S-C | **X = primary action on library items** | On the Top Hit and on "Your library" posters, X calls `actions.primary(appid)` (Play / Install / Update), shown in the bottom ornament as "Play" with its X badge in gamepad mode (Steam renders the legend from our `actionDescriptionMap`). A still opens the game page (window-nav's rule) | `primary(item)` |

**Field.**

- One spec everywhere: window-nav's 520 / 640 × 64 capsule, with **no microphone** (Steam has no dictation, WN D-8).
- On Home and folders, the field is window-nav's 60 px **circle variant** (§3.1, PLAN §1.9).

**Mockup.** `p2_home-apps_search.png` shows the query "half" on the real library, in window-nav's results sheet over the Library snapshot:

- Top Hit: Half-Life: Alyx (a game wins the tie with the programs);
- Top Results: 4 of 9 library matches;
- the Apps section: Half SBS Toggle, the one real program match, with its real icon;
- the ornament in gamepad mode: Play (X), Options naming the target, Open (A), Close (B).

It also proposes to C1b that the Top Hit's name keeps the card's full width on its own line, with the status and Open sharing the bottom line, so long names are not cut by the capsule.

**Cross-concept record:** `concepts/xc-home-search.md` holds the agreement with window-nav.

---

## 7. Library catalogue (built by C2c)

**Routes.** `/library/tab/<id>` and `/library/collection/<id>` (Steam's), glass mode `window` (PLAN §1.2): glass 1280 × 656, radius 54, toolbar row 108, bottom ornament 628–712 (WN §3.1–3.4).

| Element | px [pt] | Material / fill | Tier |
|---|---|---|---|
| Toolbar row | window-nav's: Back circle (borderless on section roots), Large Title "Library" at x 100, search 520 × 64 centred | WN | T1 + T2 |
| Tabs | Steam's tab row as a segmented control: 64 [48] track at y 116, segments ≥ 140, contiguous (E-SEG), labels 22 px Semibold title case, counts at white .70 (dark .55 on the white segment). Steam's horizontal scroller with 28 px edge fades; Steam's ‹ › arrows become 60 px plain circles at x 24 and 1196 | Recessed track | T1 (the row keeps its horizontal handlers, D2 §12) |
| VR sub-filter | Steam's `%{VRSubTabFilterContainer}` **in its stock position**: centred under the tab row (y 192), a 60 px segmented capsule "All · VR · Non-VR" (Ready To Play: All · Standalone · Remote PC) | Recessed track on glass | T1. Not moved: its nav-tree position sits between the tabs and the grid |
| Grid | **Baseline: Steam's own geometry**, 172 × 258 posters, 6 per row, gaps 24 × 42, radius 20. **Optional T3:** 200 × 300, 5 columns (LQ2) | Content | T1 (styles only, D2 §12); T3 gated on LQ2 |
| Attended poster | Scale 1.05, depth shadow `0 6px 18px` (`--lgs-shadow-15mm`, VP P-48), glow 30 px, diagonal sheen. Gamepad: on `.gpfocus` at once. Laser: brightness on `:hover` at once, the lift on `.lgs-dwell:hover` (80 ms, PLAN §1.4). Steam's compatibility badge restyled as a 36 px circle at the bottom right (inset 10). **No caption**: Steam shows none, and Steam's 42 px row gap cannot hold one | Content; native +15 mm non-interactive crop over the window cover (PLAN §1.7) | T1 + T4 |
| **More circle** | C1a's shell helper (PLAN §1.11): **60 [45]** circle **inside** the poster's top right (inset 10), **80 px hit**, black .38 with a 10 px blur, white while its menu is open. Shown on the attended poster (hover dwell or focus, parity D2 §10.4). C2c registers posters with `__LGS_RT.more.register('%{LibraryItemBox}', {placement: 'card'})` | Clear fill | T2 (C1a's node) |
| Letter scrubber | 44 × 380 [33 × 285] capsule at right 14, y 196. Letters 18 px Semibold, dots between, the current letter in a 32 px white circle. Hit: the capsule widened to 80 px by transparent padding | Black .16 | T3. Click or drag maps y to a letter and sets the grid scroller's `scrollTop` to that letter's first row (a wheel-equivalent). Shown only for Alphabetical |
| Bottom ornament | window-nav's capsule (84 tall, y 628–712, depth 0, inset slab; PLAN §1.10). On library routes it holds **five fixed slots**: 300 · 130 · 156 · 134 · 120 px, gap 4, padding 12, **880 px wide in both input modes** (≤ 960) | `liquid` (inset slab) | T1 layout + T2 (below) |
| "N apps hidden" notice | Steam's `%{AppGridFilterHeader}` as a 56 px capsule above the grid ("12 games hidden by filters" plus "Clear" when it is the button variant) | Thin fill | T1 |
| Section headers (non-alphabetical sorts) | Title 3 28 px Semibold, title case, no rule lines | — | T1 |
| Missing art | Steam's title card restyled: a gradient tile with the title 22 px Bold | Content | T1 |
| Collections tab | Steam's collection tiles restyled as rounded folder tiles (radius 30), title case labels, count secondary; empty tiles dimmed | Content / fills | T1 (shape, case); Steam's order |

### 7.1 The ornament in each input mode

Steam renders different controls per mode (INV-L §6.1; LA §0.4):

- **Laser mode** (`vrGamepadInput.IsInGamepadNav == false`): the `%{SortAndFilterContainer}` pill shows (Sort with the current sort, Filter), and the footer legend shows only Select and Back.
- **Gamepad mode:** the legend shows X Filter, Y Sort By, ≡ Options (only while a tile is focused), A Select, B Back.

| Slot | Laser mode (`p2_home-apps_library.png`) | Gamepad mode (`p2_home-apps_library-pad.png`) |
|---|---|---|
| 1 Sort (300) | Steam's `%{SortAndFilterButton}` (sort): sort glyph + the current sort ("Alphabetical"), moved by T1 into slot 1 (laser-only node, so moving it cannot change D-pad order; PLAN §1.10) | Steam's legend "Sort By" (Y badge), plus a T2 span " · Alphabetical" from `AppGridDisplaySettings` |
| 2 Filter (130) | Steam's Filter button: filter glyph + "Filter" (Steam's "Filter: [icons]" when active) | Steam's legend "Filter" (X badge; T2 count badge when filters are active) |
| 3 Options (156) | **T2 "Options" button.** It dispatches Steam's `vgp_onmenu` on C1a's frozen target (`__LGS_RT.shell.target()`, WN §3.4.3), named on the button. Disabled (.38, no hover) when there is none | Steam's legend "Options" (≡ badge) while a tile is focused. When none is focused, T2 shows the same disabled "Options" so the slot never empties |
| 4 Select (134) | Steam's legend "Select" (quiet, PLAN §1.10) | Steam's legend "Select" (A badge, quiet) |
| 5 Back (120) | Steam's legend "Back" (quiet) | Steam's legend "Back" (B badge, quiet) |

- **Mode keys** (PLAN §1.4): which of Steam's mode-only nodes exist follows `html[data-lgs-vr-mode]`; every state look follows `html.lgs-input-pad` / `-laser`. Both come from P3's one accessor, `__LGS_RT.input`; tests stub it with `--mode laser|pad` (P10), which changes only our classes, never Steam's getters (AT-14d). Revision 2's `lgsInputMode()` is withdrawn.
- **Glyph badges** only in gamepad mode (VP P-26). **A and B** stay in both modes, as quiet members; no legend node is ever hidden (PLAN §1.10).

### 7.2 The More circle, precisely

The library uses C1a's shell helper (PLAN §1.11, `device/rt/20-more.js`); revision 2's per-poster spans are withdrawn.

- **Node:** **one** decorative node per document, moved to the current attended poster (P3's `rt.attention.current()`: the `.gpfocus` poster in gamepad mode, the dwelt-on poster in laser mode), with `role=button` and `aria-label` = Steam's "Options" string. It is not focusable, so the gamepad keeps ≡. Virtualized rows that recycle need no re-attachment.
- **Isolation:** a capture-phase listener stops `pointerdown`, `mousedown`, `mouseup` and `click`, so the poster never opens and the route does not change.
- **Dispatch:** the poster's own `onMenuButton` from its `Focusable` fiber props (SM-D15); fallback Steam's `vgp_onmenu` (button 14) on `%{LibraryItemBox}` (INV-L §0.3) [PROVEN dispatch]. Never a new menu.
- **Fallback:** the ornament's Options slot on the frozen target.

---

## 8. Menus: Sort and the tile menu (look by C1c, sources by C2c)

Both are Steam's context menus (`BasicUIContextMenu`, INV-L §6.2, §7), drawn with window-nav's menu rules (WN §5.1, PLAN §1.12). Anchoring to the source is T2 and gated on WN AT-11, GP AT-MENU and SET CQ10 (a click outside still dismisses, the D-pad is unchanged). Until those pass the menus stay centred and still morph from their source.

| | Sort | Tile menu |
|---|---|---|
| Source | Ornament slot 1 (laser) or Y (gamepad) | More circle (laser), ≡ (gamepad), ornament slot 3, the Home card's More |
| Layout by count (WN §5.1.1) | 10 options → **two columns** (`lgs-menu-grid`), column-major in Steam's order, 72 px rows, ≤ 592 px wide, 40 px header; groups as 6–8 px of space | 6 actions on this device (Developer › with developer mode on) → **compact**: 60 px visible on a contiguous 64 px pitch, 400 wide, inline label; 5 without developer mode → one column of 72 px rows; header = the game's name |
| Slab | `thick` glass, radius 32, padding 8 | Same |
| Content | 10 sorts: Alphabetical, Friends Playing, % of Achievements, Hours Played, Last Played, Release Date, Date Added, Size on Disk, Metacritic, Steam Review. **The current sort is checked** (a trailing white check glyph, no fill; T2 reads `AppGridDisplaySettings`) | Primary first with its semantic whole fill (Play green, Install / Update blue); Add to Favorites, Add to ›; Manage ›, Developer ›, Properties…; submenus open beside the menu, each with its own count layout |
| Destructive rows | — | Under Manage ›: ≤ 2 destructive rows → red label at rest; always a red whole fill on focus; never reordered; Steam's default focus untouched (PLAN §1.12) |
| Cancel | Steam's item kept as the 56 px quiet capsule centred under the rows (HA-11) | Same |
| Placement (T2, gated) | Grows upward from slot 1, its bottom 14 px above the ornament | Beside its source in GP §3.4's order (above, right, left, then Steam's centred placement); clamped inside the modal box |
| Scrim | None (PLAN §1.8) | None |
| Depth | **+10 mm**, non-interactive, appearing with the materialize (0 → +10 on `depth`); +30 in the wearer profile (PLAN §1.7) | Same. The source card keeps its +15 mm if it was the attended card, else 0 with a CSS glow. Opened over Home, the menu's crop lies inside its own `thick` plate (C1c), since Home has no window cover |
| Motion | `morph-open` 607 ms from the source's rect; `morph-close` 441 ms (glassd); the source turns white while open | Same |

---

## 9. Library Filters (sheet; frame by C1c, content by C2c)

The frame is window-nav's sheet (WN §5.4, PLAN §1.12):

- 960 × 600 [720 × 450], radius 44, `thick`, depth **+10 mm** non-interactive (+30 → +50 in the wearer profile, PLAN §1.7);
- close × circle at (24, 24), Title 2 "Library Filters" centred, "Reset" capsule at the 24 px inset;
- dim: Steam's `.ModalOverlayBackground` at black .35, in both modes (PLAN §1.8; no `t1` tint);
- ornament "Reset (Y) · Select (A) · Done (B)", A and B quiet.

The content is this concept's. It shows Steam's real options (INV-L §6.3).

| Element | px [pt] | Notes |
|---|---|---|
| Compatibility | A segmented control 64 [48] with Steam's four strings: "Verified Only · Verified and Playable · Verified, Playable, and Untested · All Games". Segments contiguous, padding 12; all four fit the 912 px track at 22 px | T3. T1: Steam's four radio rows at 72 px |
| Sections | Label 22 px Bold secondary. Options as **chips**: capsules 60 [45] tall, padding 24, 22 px Semibold, gap 12. Selected = white .94 with a dark label and a check glyph. At most one row per section; the rest sit behind an "N More" chip that expands the section in place. Players: Single player, Multiplayer, Cooperative, Local Multiplayer. Play state: Ready to play, Installed, Played, Unplayed, + 1 More (Private) | T3. T1 fallback: Steam's checkbox rows at 64 px with 40 px boxes (hit area by padding; nodes unchanged) |
| Collapsed sections | A recessed platter (black .14, radius 30) of 72 px rows showing the current value and a chevron: Hardware support (Gamepad Support dropdown + 4 options), Features, Language (Any language), Genre, Store tags, Friends, Gameplay, Visual, Camera Comfort, Audio, Input | Text searches (store tags, friends) are 64 px fields inside the expanded rows. Dropdowns are value menus (PLAN §1.12): ≤ 8 options a slab anchored to the capsule; 9–14 the two-column grid; ≥ 15 (Language) one scrolling column of two-line rows |
| Footer | "Showing all 350 games" (Callout, secondary; the count comes from Steam's filtered collection) and a "Save as Dynamic Collection" capsule 60 px | Done = × or B (ornament) |
| Scroll | About 1.2 sheet heights (against 3.8 window heights today); 56 px scroll-edge fade | |
| Depth / motion | +10 mm on `sheet-in` 735 ms; scrim on `fade`; dismiss on `sheet-out` 514 ms | D2 §11.5, WN §5.4 |

---

## 10. Depth and glass plan (no ghosts)

### 10.1 The rule

From E2E §1 and PLAN §1.7 rule 1, every pixel of Steam's real panel that shows content must be one of:

- **(a)** under opaque glassd glass (a cover or a plate);
- **(b)** shown only at its own position, with no pop.

Rev 1 broke this on Home:

- the popped band (+10 mm) and the popped top row (+25 mm) had no cover, so off-axis they doubled;
- its glassd slabs existed only under pops, so without pops the discs fell back to a CSS tint.

### 10.2 The mechanism: plates

`p2_home-apps_depth.png`.

**1. Every glass element is a plate** (PLAN §1.6, P9 G1, `contracts/glassd.md` §1.3; reported by P6, `contracts/reporter.md` §2.2).

- Home and folders are `windowless`: the main surface reports no cover shape (`shapes: []`) and `plates` = every element tagged `data-lgs-plate="liquid"`: the 13 discs, the top-row controls (Back, the section control's track, What's New, the search circle; Back and search are C1a's nodes, tagged by C1a on windowless routes), and the open card or name plate. Each carries a stable `data-lgs-plate-id` (`home-disc-<key>`, `home-top-<name>`, `home-card`, `home-plate`) so materialize and acks follow the element.
- glassd draws real `liquid` glass inside each plate at the cover's depth (+1 mm). Steam's panel is hidden there.
- Per page: 4 top-row + 13 discs + the card or name plate = **18 plates** of the 32 allowed. Peeks stay CSS only (no plate).
- Text-bearing plates (card, name plate) carry `data-lgs-plate-tint` so their glass sits at L 70–90 under text.
- Once glassd draws a plate, P6 acks it (`data-lgs-plate-ack`) and `theme/05-native.css` drops that element's CSS plate fill; content stays.

**2. The base mosaic covers only the plates' rows.**

- Our page declares four `data-lgs-mosaic` bands: the top row (y 14–94) and one per honeycomb row (disc centre ± 66: y 130–262, 318–450, 506–638). Without them P6 builds equivalent bands from the plates (reporter §2.3).
- Outside the bands, Steam's panel alone shows its pixels: labels, dots, the transparent room. Nothing is drawn twice.

**3. Only the attended item pops** (PLAN §1.7: default profile).

- A layer rule in `theme/layers/41-home.json` selects the attended disc, the open card and the name plate: `mm: 15`, `when: "attended"` (gamepad `.gpfocus` on the cell; laser `.lgs-dwell:hover` on the disc, reporter §3.3), `slab: "liquid"`, `exclude: ".lgs-home-moving *"`, and a `wearer` block `{mm: 15, interactive: true}`.
- In the default profile the crop is **non-interactive**: the laser passes through it to Steam's panel at the same x/y (S2 off).
- The item's own plate stays under the crop and turns into the **occluder** variant (brightness .55, no rim; P6 sets `occluder` automatically when a pop overlaps a plate). While popped the plate takes the lifted rect + 4 px (`data-lgs-plate-inset: -4`): 140 px for a disc at ×1.10, 328 × 248 for the card.
- Off axis you therefore see the lifted disc and, beside it, its plate's glass reading as its shadow, never a second copy.
- **Admission** (PLAN §1.7): covered (the crop + 2 px lies inside its plate); click-safe (rule 2: the disc crop contains no focusable, so no cap; the card contains Play's and More's 80 px hit elements, s = 80 ≥ 78 for +15 mm; HA-15); containers only (disc 132, card 320 × 240, name plate ≥ 60 × 60 capsule); still (no pop while `lgs-home-moving`); ≤ 4 depths at rest ({0, +15, +25}).
- **The card ramp in native mode:** when the ramp starts, the crop and the occluder plate take the card's final rect; the plate's `phase` ramps on `morph-open` while the CSS clip-path morph plays inside the crop, so the depth never changes during the ramp. When P9 offers a plate shape morph (GM §5), it replaces the phase ramp. AT-10c's filmstrip checks that no frame shows a doubled card.

**4. Labels and page dots never pop** (D2 rule 10: text has no depth of its own).

### 10.3 Pop shift at 35° off axis, for reference

| Depth | Shift | CSS px |
|---|---|---|
| +10 mm | 7.0 mm | 9 |
| +15 mm | 10.5 mm | 14 |
| +25 mm | 17.5 mm | 23 |

On plates this shift reveals plate glass, not content. Home uses +15 mm (D2 D10, PLAN §1.7).

### 10.4 Depths (PLAN §1.7)

| Element | Default profile | Wearer profile (`interactivePops`) | Scene units at r = 1 | Paired cue | Mechanism |
|---|---|---|---|---|---|
| Home and folder plates, art, top row | 0 (plates at the cover's depth, +1 mm; mosaic bands +2 mm) | 0 | 0 | Glass bezel and specular arc | Plates + mosaic bands |
| Attended disc, card, name plate | **+15, non-interactive** | +15, interactive | 0.0407 | Disc glow 26 px; depth shadow `0 6px 18px` (VP P-48) | One crop + `liquid` slab over its occluder plate |
| Labels, dots, peeks | 0 | 0 | 0 | Text shadow | Steam's panel only |
| Tab bar | +25 | +25 | 0.068 | — | window-nav (the popup's own transform, no crop) |
| "+" popup | **+25** in front of the bar | +25 | 0.068 | 0 10 30 /.28 | Popup request `z` through P6's wrapper [PLAUSIBLE] |
| Library window, ornament | 0 | 0 | 0 | — | window-nav (cover; ornament inset slab) |
| Library attended poster ≥ 150 px | +15, non-interactive | +15, interactive | 0.0407 | `0 6px 18px` /.44 | Crop over the window cover |
| Menus (Sort, tile menu) | **+10**, non-interactive, 0 → +10 on `depth` | +30 | 0.027 | Thick glass, `0 4px 12px` | Crop + `thick` slab (over Home: inside its own `thick` plate) |
| Filters sheet | **+10**, non-interactive | +30 → +50 | 0.027 | Scrim .35 (Steam's overlay) | Crop + `thick` slab |
| Source card while its menu is open | +15 if it was the attended card, else 0 with a CSS glow | +15 | — | — | — |

**Rules for every crop:**

- Crops stay at their element's x/y: input lands on Steam's panel (D2 §3.8). In the default profile every crop is `interactive: false`.
- Every lift is under 80 mm; animated deltas ≤ 20 mm.
- Scene-graph pushes happen only while a depth value moves (P7, SP §4.2).

### 10.5 Without glassd (CSS-only path, the default today)

`p2_home-apps_home-t1.png`.

- Steam's page cannot see the room, so a plate is the CSS plate of PLAN §1.2: black .58 with a white .16 → .04 gradient (`--lgs-mat-plate-bg`, P4) plus the D2 §6.2 edge cues (`--lgs-edge: liquid`), never frost.
- There is no pop and no pointer proxy (PLAN §1.11, S16).
- Every plate keeps a fill (SP §6.4 design rule), and labels keep the on-room shadow.
- This is the honest floor, and it is what ships until the native gate passes (PLAN §4.3). Real glass on Home needs the native layer, as it does for every concept. Home never waits on glassd: the CSS plates are C2a's first deliverable (PLAN §3.2).

---

## 11. Motion summary (P5 tokens, PLAN §1.5)

| Interaction | Token(s) | Notes |
|---|---|---|
| Enter Home (route) | `page` 662 ms content fade + ≤ 16 px parallax (`lgs-page-in`). Plates materialize (`lgs-mat-glass-in`: glass 0–92 %, content 35–100 %), scale from `1 + 12/120 = 1.10` riding the glass channel. 30 ms stagger by ring distance from the focused cell, ≤ 3 rings | ≤ 800 ms including delay and stagger (662 + 90 + 40 = 792), inside Steam's route timeout (S3). glassd runs the plates' phase ramp in native mode |
| Section change (LB/RB, segment) | Pill travel `snappy` 488 ms; old grid fades `page-out` 150 ms linear; new grid `page` 662 ms with 16 px parallax in the travel direction | M1: no lateral slide over 24 px. Sound `'tab'`. No pop during it |
| Page change | As a section change; the active dot moves on `snappy` | Sound `'page'` |
| Attention on a cell | Gamepad: `hover-in` 294 ms at once (out `fade` 441 ms). Laser: brightness at once; scale and depth after 80 ms of dwell; depth on `depth` 441 ms | Retarget, never queue (C5) |
| Name plate | After 0.4 s: `materialize-in` 250 ms; out `materialize-out` 350 ms | |
| Card ramp | After 0.8 s: `morph-open` 607 ms; close on `morph-close` 441 ms (laser 0.3 s after leave; gamepad at once) | Native: the plate's phase ramp under the crop (§10.2) |
| Press | `interactive` 210 ms swell ≤ ×1.06 (glass only); release glow 90 ms; `snappy` swell back | |
| Open a folder / What's New | Route `page` 662 ms; the folder disc's plate materializes out and the new page's plates materialize in | No zoom over 1.5 % |
| "+" popup | `materialize-in` 250 ms / `materialize-out` 350 ms | C2b |
| Menus | `morph-open` 607 / `morph-close` 441; depth 0 → +10 on `depth` | C1c |
| Filter sheet | `sheet-in` 735 / `sheet-out` 514; scrim on `fade` | C1c frame |
| Library tab switch | Steam's slide shortened to ±16 px + fade on `page` (`theme/23-transitions.css`) | C1c |
| At rest | Nothing animates: `getAnimations()` has nothing running and no `lgs-*` animation one second after any interaction | C7, PLAN §1.5 |
| Reduce Motion | Fades of 150–200 ms only (`--lgs-d-reduce`); depth pushed once at the end; morphs become cross-dissolves | C8 |

---

## 12. Function retention table

**Scope.** Every function from LA §A (library-apps), plus the SN §A rows that live on these screens.

**Columns.**

- "Laser" = the controller laser. "Gamepad" = Steam's FocusNavController.
- "Owner" = the package that builds the new path. "Test" = the acceptance test that proves it (§14, or another package's test). `glass.py ledger` (P10) reads these columns.
- The new path's tier is in brackets. Unless stated, the fallback path is Steam's own control, restyled (T1).
- Launch-type rows are proven by the action logger (P2 `actions`), never by executing them.

### 12.1 Library home (LA A.1)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| H1 | See recent games (MRU, 20) | Home › Recent, 2 pages; the running game first with a green dot [T3] | Look; dwell on a disc shows the card | D-pad; focus shows the card | C2a | AT-1, AT-8 |
| H2 | Open a game's page | A Recent cell's activation | Click the disc, or the card outside Play and More | A | C2a | AT-4 |
| H3 | Game tile menu (Play/Install, Favorites, Add to, Manage, Properties) | The card's More circle; ≡ | Dwell 0.8 s, click More (**new: no laser path today**) | ≡ on a cell | C2a | AT-4, AT-8(f) |
| H4 | Go to the library ("View more in your Library") | The All Games folder, cell 13 of each Recent page; the tab bar's Library | Click the folder, or the tab bar's Library | D-pad to All Games + A; or Left at page 1's edge into the tab bar, then Library + A | C2a | AT-4, AT-3(g) |
| H5 | Switch feed: What's New / Friends / Recommended | `/library/lgs/steamhome` (Steam's Home page with its tab row) [T3] | Click What's New, then Steam's segments | Up to the top row, Right to What's New, A; then Steam's LB/RB and D-pad | C2a | AT-3(i), AT-6 |
| H6 | What's New cards (sale, recently updated, trending, offers) | What's New route, unchanged | Click | Focus + A | C2a (look; Steam's handlers) | AT-6 |
| H7 | Friends feed (playing now, activity, comment/like/rate) | What's New route, Friends tab | Click | Focus + A | C2a (look) | AT-6 |
| H8 | Recommended (calendar, queue, play next, new releases, top sellers) | What's New route, Recommended tab | Click | Focus + A | C2a (look) | AT-6 |
| H9 | Background art of the focused game | The card's hero art (Home); Steam's background on the What's New route | Passive | Passive | C2a | AT-1 |

### 12.2 Library tabs and grid (LA A.2)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| L1 | Switch tab (All Games, Great On Frame, Ready To Play, Collections, Non-Steam, Soundtracks, conditional tabs) | Steam's tab row as a segmented control; the same sets as Home › Collections folders | Click a segment or a ‹ › circle | LB / RB; or Up to the row + Left/Right | C2c | AT-6, G-PAD |
| L2 | VR sub-filter All / VR / Non-VR (Ready To Play: All / Standalone / Remote PC) | Steam's control in its stock position, restyled [T1] | Click a segment | Up from the grid + Left/Right + A (stock) | C2c | AT-6 |
| L3 | Browse the grid | Steam's virtualized grid, restyled | Wheel/drag scroll; dwell lifts | D-pad; the page scrolls | C2c | G-PAD, AT-14(b) |
| L4 | Fast scroll by letter | Steam's fast-scroll overlay (unchanged) + letter scrubber [T3] | Click/drag the scrubber (**new**) | Steam's fast-scroll, unchanged | C2c | AT-14(c) |
| L5 | Open a game | Poster activation | Click | A | C2c | AT-6 |
| L6 | Sort (10 options, persisted) | Ornament slot 1, current sort shown in both modes → glass menu (two columns) with the current sort checked | Click slot 1 (Steam's Sort button) | Y | C2c | AT-6 (Sort snippet), AT-14(d) |
| L7 | Filter | Ornament slot 2 → Filters sheet | Click slot 2 (Steam's Filter button) | X | C2c | AT-15 |
| L8 | Tile menu | C1a's More circle in the attended poster [T2]; ornament slot 3 Options on the frozen target | Click More (**new direct path**) or slot 3 | ≡ | C2c (registers), C1a (helper) | AT-14(a) |
| L9 | "N apps hidden due to filter" (button variant clears) | Capsule notice above the grid | Click | Focus + A | C2c | AT-6 |
| L10 | Back | Toolbar Back circle (WN) | Click | B | C1a | WN AT (E-BACK) |

### 12.3 Game tile and its menu (LA A.3)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| T1 | Primary action Play / Install / Launch / Download / Update | First menu row with its semantic whole fill; Home card's Play capsule; search X (S-C) | Click | ≡ → A; **X on a Home cell or a search item** | C2a (card, X), C2c (menu source), C1c (menu look) | AT-4 (identity against Steam's tile-menu Play), AT-13 |
| T2 | Add to / Remove from Favorites | Menu row | Click | Menu + A | C1c | AT-6 (capsule menu snippet) |
| T3 | Add to › (collections, New collection…) | Submenu beside the menu | Click | Right / A | C1c | AT-6 |
| T4 | Manage › | Submenu | Click | Right / A | C1c | AT-6 |
| T5 | Developer › | Submenu (developer mode) | Click | Right / A | C1c | AT-6 |
| T6 | Properties… | Menu row | Click | A | C1c | AT-6 |
| T7 | Cancel | Quiet 56 px capsule; click outside | Click | B | C1c | AT-6, G-PAD |
| T8 | Status on the tile (compatibility, download progress, update, friends playing, coming soon, locked, copies, missing-art title) | Library: Steam's badges restyled; Home: icon states + card (§3.3) | Look | Look | C2c (library), C2a (Home) | AT-1, AT-6 |

### 12.4 Library Filters (LA A.4)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| F1 | Frame compatibility level (4, persisted) | Segmented control at the top of the sheet [T3] / Steam's rows at 72 px [T1] | Click | Left/Right + A [T3]; Up/Down + A [T1] | C2c | AT-15 |
| F2 | 47 checkboxes in 11 sections + Gamepad Support and Language dropdowns | Chips (one row per section + "N More") and collapsed rows [T3] / Steam's rows at 64 px with 40 px boxes [T1] | Click | D-pad + A | C2c | AT-15 |
| F3 | Store tags / Friends text search | 64 px fields inside their expanded rows | Click → keyboard | Focus + A → keyboard | C2c | AT-15 |
| F4 | Reset | Header capsule; ornament "Reset" (Y) | Click | Y, or D-pad + A | C2c | AT-15 |
| F5 | Save as Dynamic Collection | Footer capsule | Click | D-pad + A | C2c | AT-15 |
| F6 | Close | × circle; B | Click | B ("Done") | C1c (frame) | AT-15, G-PAD |

### 12.5 Collections, Non-Steam, Soundtracks (LA A.5, A.6)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| C1 | Browse collections | Home › Collections folders (empties grouped); Library Collections tab (restyled tiles) | Click | D-pad + A | C2a (Home), C2c (tab) | AT-1, AT-6 |
| C2 | Open a collection | Home: `/library/lgs/folder/<id>` + "Show in Library"; Library: Steam's `/library/collection/<id>` | Click | A | C2a (Home), C2c (tab) | AT-4, AT-6 |
| C3 | Back to all collections | Folder: Back/B (history); Library: toolbar Back | Click Back | B | C2a (folder), C1a (Back) | AT-3 |
| C4 | Create / edit collections | Tile menu Add to › New collection…; Filters › Save as Dynamic Collection | Click | Menu / sheet | C1c, C2c | AT-6, AT-15 |
| N1 | Browse and open Steam shortcuts | Library Non-Steam tab (title cards restyled); Home › Collections › Non-Steam folder; Recent when played | Click | D-pad + A | C2c (tab), C2a (Home) | AT-6, AT-4 |
| N2 | First-run "Add Chrome" dialog and Learn More (empty tab only) | Unchanged in the Non-Steam tab | Click | Focus + A | C2c | Static: Steam's node restyled only (not reachable here: the tab is not empty) |
| N3 | Soundtracks | Library Soundtracks tab; Home › Collections › Soundtracks folder (header crops) | Click | D-pad + A | C2c (tab), C2a (Home) | AT-6, AT-1 |

### 12.6 Search (LA A.7; SN A.1 H2–H4, A.2): owner window-nav

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| SN-H2 | Start a search | Steam's search: a 60 px circle on Home and folders; window-nav's capsule elsewhere | Click the circle or the field | Up from a page's top row (Home: Up twice, via the section row) | C1a (field), C1b (sheet) | WN AT-9a/b |
| SN-H3 | Type / edit the query | Steam's VR keyboard (+ echo row, WN §4.7) | Click keys | D-pad + A on keys | C4b, C1b | WN AT-10 |
| SN-H4 | Clear the query | Clear × in the field (WN) | Click | Backspace on the keyboard | C1a | WN AT-9 |
| S1 | Switch result category (All, Library, Friends, Store, Tools, Hidden) | window-nav's segmented control in the sheet | Click | LB / RB; Up to the row | C1b | WN AT-9c |
| S2 | Open a result | window-nav's sheet and Steam's grids; **programs: Top Hit and the Apps section [T3, S-A/S-B]** | Click | D-pad + A; X = Play on library items (S-C) | C1b, C2a (provider) | WN AT-9, AT-13 |
| S3 | "View more in the Store" | Steam's Store grid, via window-nav's Store section | Click | Focus + A | C1b | WN AT-9 |
| S4 | No results | Steam's "No Results Found", restyled (WN) | Look | Look | C1b | WN AT-9 |

### 12.7 The "+" popup (LA A.8)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| P1 | Open the list | Steam's + button (white while open) | Click + | View → bar, Left/Right to +, A | C3a (button), C2b (popup) | AT-12 |
| P2 | Launch a program (24 rows, 23 programs + the switch) | 4-column grid in the popup, all visible [T1/T3]; Home › Apps [T3]; search Apps section [T3] | Click a cell | D-pad + A | C2b, C2a (Apps, search) | AT-12, AT-4, AT-13 |
| P3 | Toggle Liquid Glass | **Popup only:** toggle row [T3] or Steam's own row with a green pip [T1] | Click | D-pad + A (never default focus in T3) | C2b | AT-5, PLAN-2b-3 |
| P4 | Add a desktop window to VR | Popup "Windows" group first; Home › Windows section | Click | D-pad + A | C2b, C2a (Windows) | AT-12, AT-4 |
| P5 | Close the list | Click outside; auto-close after 2 s; opening another popup | Click elsewhere | B | C2b (Steam's, unchanged) | AT-12 |

### 12.8 Running apps in the bar (LA A.9)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| R1 | Switch the dashboard to a frame | Bar tab (control-center concept); Home: the running game's card Play = Steam's primary action for a running game | Click | View → bar + A | C3a (bar), C2a (card) | AT-4 |
| R2 | Tab menu of a frame (incl. Close) | Bar (unchanged here) | Hover the tab | Focus the tab, Up | C3a | CC A-tests |
| R3 | Identify a running item | Bar tooltips; Home green dot and "Running" on the card | Hover | Focus | C3a, C2a | AT-1 |
| R4 | "Current Game" on Home | Recent page 1, cell 1, green dot | Look | Look | C2a | AT-1 |

### 12.9 Navigation shared with the shell (SN A.1, A.3, A.4)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| SN-H1 | Go back (history) on Home, folders and What's New | Steam's Back as the 60 px circle at (24, 24) (E-BACK) | Click Back | B (folders, What's New); at the Home root B opens the tab bar (SN-N3) | C1a | WN AT (E-BACK), AT-3 |
| SN-N2 | Open the tab bar from a page's left edge | Unchanged on every route. On Home it works from page 1 (Left at a row's start); later pages page back first | Click a tab bar item | D-pad Left at page 1's left edge | C1a, C2a | AT-3(g) |
| SN-N3 | Open the tab bar with B at the root | Unchanged (the Home root does not handle B) | — | B | C1a, C2a | AT-3(h) |
| SN-F1 | Footer legend actions (X Filter, Y Sort By, ≡ Options, A Select, B Back) | window-nav's bottom ornament; library slots per input mode (§7.1); legends never hidden | Click the member (laser-mode nodes, or T2 Options) | The physical button | C1a (ornament), C2c (slots) | AT-14(d), PLAN-1a-1 |

**Count:** 60 functions (53 from LA §A + 7 from SN §A: H1–H4, N2, N3, F1); 60 mapped, 0 dropped, each with a laser path, a gamepad path, an owner and a test. A.10 states are covered in §3.3 (Home) and §7 (Library).

---

## 13. Implementation tiers, evidence and fallbacks

| Element | Tier | Evidence | Status | Fallback |
|---|---|---|---|---|
| Home route override | T3 (P2 `routes.override`) | SR §3.5: our page rendered at `/library/home` with controller focus; `clearOverrides()` restored Steam's Home (774 nodes). SR §5: 90 fps, 43 nodes | PROVEN | Steam's Home, T1 restyle, `window-full` (§3.7) |
| Folder and What's New routes (`/library/lgs/…`) | T3 (P2 `routes.add`) | SR §3.4: patching a route fiber's type [PROVEN]; `steamChildren` handed to the override (SR §3.5) | Routes PROVEN; rendering `steamChildren` in our route PLAUSIBLE | Folder → Steam's collection page. What's New → our error boundary offers "Show Steam Home", which clears the override for the session |
| Windowless Home with **plates** | T1 + T5 (P6 `data-lgs-plate`, P9 G1) | SP §6.4 E6 (transparent Steam window over the room); G1 plates built in glassd and fakeglassd (`contracts/glassd.md` §1.3, "built") | Visually PROVEN; plates built offline, not yet live with the Phase 2 reporter | CSS plates (§10.5) |
| Mosaic restricted to declared bands | T5 (P6 `data-lgs-mosaic`, P7) | Reporter §2.3; the daemon decomposes the mosaic (NATIVE.md "guillotine cuts") | PLAUSIBLE | Full mosaic: labels drawn at 0 and +2 mm (≈ 1.8 px at 35°), a minor softening, no doubling of popped content |
| Occluder variant of a plate | T5 (G1 `occluder`) | `contracts/glassd.md` §1.3: brightness × .55, no key specular, no lip, no Fresnel, no contact shadow; P6 sets it automatically under a pop | Built offline | The plain `liquid` plate under the pop (reads as a socket) |
| Attended-item pop at +15 mm, non-interactive | T4 (P6 rule, P7) | SP E1 (crop registration), SP §4.2 (push animation 60/s, 1.6 ms CPU per push); E2E: pops render in front with their slabs; non-interactive crops pass the laser through [PROVEN, `skippingDueToNonInteractivity`] | PROVEN mechanisms; the rule is new | No pop (glow and scale only) |
| Laser on transparent texels between plates | — | SP §6.4 | UNPROVEN (wearer, PLAN §5.3 item 3) | Harmless: a hit on empty page area does nothing; a pass-through hits the room |
| Section control in the header band | T3 | `#header` is `pointer-events: none` except its children (INV-S §3.2) | Source-verified; AT-2 clicks it | The fallback layout (§3.1.1) |
| Honeycomb with explicit neighbours | T3 | `onMoveUp/Down/Left/Right` are `Focusable` props (SR §3.6); `grid` / `geometric` proven on a 3 × 2 grid (SR §4) | PLAUSIBLE | 5 × 3 square lattice with `flow-children: grid` |
| LB/RB, X, ≡ on Home | T3 | `onButtonDown`, `onSecondaryButton`, `onMenuButton`, EGamepadButton 3, 5–8, 14 (SR §3.6). X is delivered in VR (Steam's legend shows "X Filter", INV-L §1.3) | ≡ PROVEN live (SR §4); X and bumpers PLAUSIBLE | Every section and page is reachable by D-pad (AT-3j) |
| Card ramp and name plate (attention, hysteresis) | T3 + P3 `rt.attend` | `contracts/interaction.md` §2 (`steps`, `leaveMs`, `feed`); IM §4 (80 ms dwell [PROVEN with the prototype]) | PLAUSIBLE (P3 at M1) | Name plate only; Play via X and the game page |
| Game art (hero + logo, custom art) | T3 (P2 `data.art`) | SR §3.7 (`BuildCachedLibraryAssetURL`, `GetCustom*ImageURLs`); live read: all 20 Recent items have hero + logo; 322/350 games have logos (LA §0.3) | Data PROVEN (read); rendering PLAUSIBLE | Portrait crop (proven in `p2_react_proto_home.png`), then monogram |
| Program icons at 64 px | T3 | `strIconDataBase64` 64 px (LA §0.3; fetched for this revision) | PROVEN | Theme icons need the daemon (LQ4, UNPROVEN) |
| "+" popup 4-column grid | T1 (C2b) | No `flow-children` on the list (LA LQ1), so Steam infers the grid from computed style (D2 §12, GP §0.5); raise `max-height` 600 → 760 | PLAUSIBLE | Steam's list restyled as 64 px rows with 40 px icons |
| "+" popup A–Z, plates, toggle row, preferred focus | T3 (C2b, P2 `patch.byProps`) | The popup's memo fiber `{allowLaunchProgram}` located; same type-swap as the route switch (SR §3.2, §8) | PLAUSIBLE (not patched) | T1 grid in scan order (`p2_home-apps_plus-t1.png`) |
| All Apps → Home › Apps from the bar | T3 | LQ5 | UNPROVEN | Circle hidden; Home › Apps via the tab bar |
| Popup +25 mm | T4 (Steam side, P6 wrapper) | SP §3.3 wrapper of `SendPendingInstanceParamsToSteamVR`; parameter path exercised in E2 | PLAUSIBLE | Steam's +3.7 mm |
| Search contributions (S-A, S-B, S-C) | T3 provider in C1b's `LgsSearch` | WN §4.9 (override of `Routes.Search.Root()`, SR §3.5 mechanism); C1b's provider API | Depends on WN AT-9 and the provider API | Programs not in search; Home › Apps and "+" remain |
| Library ornament slots | T1 + T2 (C2c) | WN §3.4 (ornament from `#Footer`); laser-mode pill is laser-only, so moving it is safe for focus (INV-L §6.1) | PLAUSIBLE | Steam's pill and legend restyled in place (two capsules) |
| More circle in posters | T2 (C1a helper) | `vgp_onmenu` (button 14) dispatch on `%{LibraryItemBox}` opens the capsule menu (INV-L §0.3); the host's `onMenuButton` (SM-D15) | Dispatch PROVEN; capture-phase isolation PLAUSIBLE | Ornament slot 3 |
| Letter scrubber | T3 (C2c) | Writes `scrollTop` on Steam's grid scroller (a wheel-equivalent) | PLAUSIBLE | Steam's gamepad fast-scroll only |
| Larger posters (200 × 300) | T3 (C2c) | LA LQ2 (props of Steam's CSSGrid) | UNPROVEN | Steam's 172 × 258 (the baseline shown) |
| Anchored menus | T2 (C1c) | WN AT-11, GP AT-MENU, SET CQ10 | UNPROVEN | Centred menus that still morph from the source |
| Filter sheet with chips | T3 (C2c) | Type swap of Steam's filter dialog component (SR §3.4 technique) | PLAUSIBLE | T1: Steam's dialog, 64 px rows, 40 px boxes, thick glass, sheet depth |

---

## 14. Acceptance tests (agents only)

**General rules:**

- Every live step runs inside the locked lab commands (`docs/phase2/contracts/lab.md`, LAB.md), with this package's runtime on only for the step: `--flags wp.c2a` (plus `wp.p3` while P3's flag is off). Input modes come from the stub: `--mode laser` or `--mode pad` (P10), never Steam's getter.
- **Launch calls are logged, never executed.** They go through P2's `rt.react.actions` (`launchNonSteam`, `primary`, `desktopWindow`, `navigate`), whose test mode is on whenever `actionsLive` is not true, the action logger is on, or the event is synthetic (`contracts/react.md` §8). Tests read `actions.log`.
- Before any gamepad sequence: `L.root()` (`FocusApplicationRoot()`, SR §4). After any synthetic hover: `L.unhover()` (pointer to 1400, 900).
- Native steps run only inside `python glass.py native-session` (PLAN §7). `hv` frames are looked at and deleted (LAB never-list).
- Evidence: `docs/phase2/wp/C2a.md`, with the command, the result, the shot or JSON names (`shots/p2_c2a_<what>.png`, filmstrips `shots/p2_motion_c2a_<interaction>_<f>.png`), the date and the Steam build.
- The global gates of PLAN §4.1 run on `/library/home` (Recent, Collections, Apps), `/library/lgs/folder/<id>` and `/library/lgs/steamhome`, in both input modes, CSS-only and native: `python glass.py gates main --route R --mode laser|pad --flags wp.c2a`, `pad-bfs`, `focus`, `motion`, `sgcheck`, `hv`. The tests below add what the gates do not cover.

| ID | Package | What | How | Pass |
|---|---|---|---|---|
| AT-1 | C2a | Home renders | `python glass.py shot main p2_c2a_home_recent --route /library/home --flags wp.c2a` (and `_collections`, `_apps` with the segment clicked in the pre) | 13 cells, 2 dots, top row with 3 segments + What's New + search circle; side by side with `p2_home-apps_home.png` (same 12 games, same order); `#Footer` visibility equals stock Home's; `data-lgs-glass="windowless"` |
| AT-2 | C2a | Geometry | `glass.py js` reading rects | Column pitch 224 ± 2, row pitch 188 ± 2, disc 120; Back box (14, 14, 80, 80) and search box (1186, 14, 80, 80) ± 2; section track y 22–86, segments contiguous (gap ≤ 2), each ≥ 60 × 140; the 4 top-row centres ≥ 80 apart; `elementFromPoint` at (640, 30) hits the section control (else the fallback layout, §3.1.1) |
| AT-3 | C2a | Gamepad traversal | `L.pad` from cell 1: (a) Right ×3; (b) every cell reachable (`glass.py pad-bfs --route /library/home`); (c) for each cell, Down-Up and Up-Down return to it; (d) Right at row 1's end → page 2, row 1; (e) RB → Collections, LB back; (f) LT/RT page (skip if not delivered); (g) Left at page 1's left edge → `.gpfocus` in `frame.menu`; (h) B at root → `frame.menu`; **(i)** RB from Apps wraps or stops without entering What's New; on `/library/lgs/steamhome`, RB changes Steam's feed tab and B returns to `/library/home`; **(j)** **D-pad only**, no LB/RB/LT/RT: reach every section (Up to the row, Left/Right, A) and every page (Right past row ends); (k) route entry focus on cell 1 (VP P-22) | All pass; `L.focused('main')` never empty inside the page |
| AT-4 | C2a | Launch wiring (action logger) | Click (synthetic, so logged) and A on: a game (expect `navigate('/library/app/<id>')`); a game's X and the card's Play (expect `primary(appid)`, and `actions.handler('primary')` identical to Steam's tile-menu Play handler for that app); the card's More and ≡ (expect the same handler, Steam's tile menu); a program (expect `launchNonSteam` with the same `strCmdline` as Steam's popup row of that name); a window (`desktopWindow`); a folder (route becomes `/library/lgs/folder/<id>`, nothing logged); All Games (`navigate('/library/tab/AllGames')`); What's New (route `/library/lgs/steamhome`) | All logged calls equal Steam's; `mode` is `logged` for every launch |
| AT-5 | C2b, C2a | Switch safety | (a) T1 only and T3 on: `glass.py js` finds the row whose text is exactly "Liquid Glass" in `barpopup` after the OPEN pre (INV-B §0.3) [C2b]; (b) Home › Apps lists no cell named "Liquid Glass" [C2a]; (c) the search sheet for "liquid" shows no program for it, neither as Top Hit nor in the Apps section [C2a, with C1b]; (d) T3 popup: the first `.gpfocus` after opening by gamepad is the first program cell, not the toggle row [C2b]; (e) the toggle row while main is on `/library/lgs/folder/…` logs `Navigate('/library/home', replace)` **before** the launch [C2b] | All pass |
| AT-6 | C2a, C2c | No functional loss | C2a: `glass.py gates main --route /library/lgs/steamhome --only aud` against stock `/library/home`'s Steam nodes (the override moves them there), and `gates` on `/library/home` for our nodes plus Steam's Back and search (E-BACK); C2c: `audit main --route /library/tab/AllGames`, `/library/tab/Collections`, `--pre <Sort snippet>`, `<capsule menu snippet>`, `<Filter snippet>` (INV-L §0.3) | 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST outside PLAN §1.16's exemptions (search: WN AT-4) |
| AT-7 | C2a (C2b popup) | Sizes and type | `glass.py gates main --route /library/home --only size,type` + a rect scan of the card | Every focusable meets G-SIZE or its exemption (E-SEG on segments, E-BACK); card Play/More hit elements 80 tall, centres 180 apart, non-overlapping; More 60 visible with an 80 hit; no text < 18 px (popup 15); no uppercase, italics or positive tracking in chrome |
| AT-8 | C2a | Attention ramp (both inputs, one mechanism) | (a) `--mode pad`: focus a game by `L.pad`; shots at 0.5 s and 1.5 s: no card, then card; `--mode laser`: `L.hover('main', <disc>, 1500)`, the same two shots; (b) jitter: two moves within 0.3 s (pad), and a laser sweep at 45 ms per disc: no `.lgs-dwell`, no lift, no card; (c) leave: laser card gone ≤ 0.3 s + 441 ms after `L.unhover()`; pad card starts closing at the next `L.pad` and is gone ≤ 441 ms later; (d) static: `41-home.css` has no `:hover` selector that shows the card or plate; the card's state is set only from `rt.attend` (`lgs-attend-*` classes or `onStep`/`onLeave`) and `rt.attention.feed`; (e) rects: the card overlaps no other disc by more than 16 px; (f) after the card opens, a synthetic click on Play logs `primary` and the route does not change; (g) laser: no `scale` above 1 on a disc before `.lgs-dwell` is set (VP P-06) | All pass |
| AT-9 | C2a | Motion | `glass.py motion main --route /library/home --pre <ramp> --name c2a_ramp`; the same for a section change, a page change and an attention move | Every duration and easing a P5 token; 0 animations at rest 1 s after; route entry ≤ 800 ms; filmstrips `shots/p2_motion_c2a_ramp_<f>.png` at f = 0, .15, .35, .5, .75, 1 show glass before content, no text scaling, no closed outline |
| AT-10 | C2a | Depth (native) | In `native-session`: `__LGS_SG.dump()` and the reporter's `debug()` with a cell attended (pad and laser), with the card open, and with a name plate | The attended item at 15 mm ± 0.5 (converted with the live S, r: 0.0471 u at r = 0.863), `interactive: false` in the default profile; only the attended item's crops on Home (the disc, or the card, or the disc and its name plate); with `--flags interactivePops`: the same crops `interactive: true` |
| **AT-10b** | C2a | **No ghosts (static)** | `glass.py sgcheck --route /library/home` (attended cell, open card) and on a folder | R1 covered (each pop + 2 px inside its plate), R2, R5, R7, R8, R9 hold; mosaic pieces only inside the declared bands, covering no Steam texel with alpha > 0.05 outside a plate; ≤ 32 plates |
| AT-10c | C2a | No ghosts (look) | `glass.py hv home_attended --offaxis 30 --look` with a cell attended, and once during the card ramp (look, then delete) | One copy of the icon; its plate visible beside it as glass; labels single; no doubled card in the ramp frame |
| AT-11 | C2a | Performance | `glass.py perf main --route /library/home --pre <page through 10 pages>`; GPU time from `glassd-out.json`; `img.naturalWidth` of visible icons | fps within 5 % of stock, no frames > 34 ms; heroes decoded only for the visible page and the open card; program icons at 64 CSS px from ≥ 64 px sources; glassd ≤ 2.5 ms (GL-3's Home scene) |
| AT-12 | C2b | "+" popup | OPEN pre, then `L.pad` inside `barpopup`: every cell reachable; Down-Up returns; B closes; rect scan | Computed `display` of the list is `grid` with 4 columns; with 23 programs and no extra groups, every cell's rect lies inside the scroller's client rect (no scroll); every label ≤ 70 px wide and ≤ 2 lines; the name plate stays inside x 0–300 |
| AT-13 | C2a, C1b | Search contributions | WN AT-9 steps with "half": the Apps section lists "Half SBS Toggle"; A on it logs `launchNonSteam` with Steam's `strCmdline`; X on the Top Hit logs `primary`; with "vlc" the Top Hit is the program "VLC media player" and Open logs its launch; with "liquid" nothing of ours appears | All pass |
| AT-14 | C2c | Library | (a) `L.click` on C1a's More circle: the route is unchanged and the menu labels equal those of the `vgp_onmenu` menu for that poster; (b) scroll the grid 2,000 px and back: exactly one More node in the document, on the attended poster or hidden; (c) a scrubber click on "M" scrolls so the first visible poster's title starts with "M"; (d) **both input modes** (`--mode laser`, then `--mode pad`): shot + audit each | (a)–(c) pass; (d) the ornament's width is 880 ± 1 in both modes, all 5 slots are present, A and B visible in both, glyph badges only in pad mode, and every slot's click is handled (logged) |
| AT-15 | C2c | Filters | (a) Filter snippet, then `L.pad` through every control; (b) `audit` with the sheet open; (c) sheet crop depth (native) | All pass; (c) +10 mm, `interactive: false` |
| AT-16 | C2a | Removal | `lgs off` path: `remove()`; navigate `/library/home`; `glass.py status` | Steam's Home (774 nodes ± 5 %); no `[class*=lgs]` nodes and no `data-lgs-*` attributes; history entries under `/library/lgs/` fall back to Steam's library; no scene-graph nodes (G-REMOVE) |
| AT-17 | C2a (others for their surfaces) | Headset view | One `hv` frame each of Home, the "+" popup, the catalogue with a menu, and the Filter sheet (look, then delete) | Labels legible over the room; glass L 55–110, 70–90 under the card's text; no closed outline on any glass edge |
| AT-18 | C2a | Accessibility | `gates` with `--media reduce` and `--media contrast` on `/library/home` with the card ramp in the pre | Fades only (≤ 200 ms); near-opaque plates with the 2 px edge; contrast audit clean |
| AT-19 | C2a | Real-data parity of the mockups | Re-run `fetch-library-refs.py` (C2c's), re-render every mockup, compare names and order with AT-1's live shot | Same names, same order; differences explained by real changes in the library |
| AT-20 | C2a | Input modes and states | CSS audit of `41-home.css`; `glass.py focus main --route /library/home --pairs <file>` in pad mode; DOM in both modes | Every laser look in `41-home.css` is keyed on `:hover`, `.lgs-dwell` or `lgs-attend-*` under `html.lgs-input-laser`, never on `.gpfocus` alone (VP P-01, P-02); glyph badges only under `data-lgs-vr-mode="gamepad"` (P-26); exactly one lit cell in pad mode at rest (P-13); G-FOCUS on the section control: focused segment ≥ rest + 40 L, the white selected segment's glow band ≥ +20 L (P-14, P-16) |
| AT-21 | C2a | Sounds | Section change (RB, and a segment click), page change, A on a cell, and a laser sweep, with `PlayAudioURL` intercepted | Section change requests ChangeTabs (20), page change PagedNavigation (15); no request of ours during the laser sweep; no duplicate of Steam's BasicNav on focus moves (VP P-74) |
| AT-22 | C2a | Fail closed | Break a required finder through P2's test hook (RX-5 method) in a locked step, then `lgs on` | `41-home` reported failed in `lgs status`; `/library/home` is Steam's Home in `window-full` glass; no `/library/lgs/*` route; every Home function works (spot check H2, H5) |
| AT-23 | C2a | Strings | With our language accessor stubbed to `de` in a locked step (never Steam's setting) | No English string of §3.8's "without a token" rows is drawn; the glyph variants show |
| PLAN-2a-1 | C2a | Looks like the design | Native off: `python glass.py cmp docs/phase2/mockups/home-apps-home-t1.html shots/p2_c2a_home_t1.png --id C2a --name home_t1` (mapping in `docs/phase2/wp/C2a-cmp.json`; mockup `data-id`s on the top row, cells, dots and card). Native on: `hv` look | Named rects within ± 8 px, or the difference explained in the log; the agent views both and records a verdict. Native: one copy of each icon, plate glass beside the lifted disc |

---

## 15. Risks and open questions

| # | Item | Mitigation |
|---|---|---|
| 1 | HA-3 changes D2 §3.5's LB/RB meaning on Home | Resolved: adopted (PLAN §1.14, S12; A2) |
| 2 | The honeycomb neighbour map is untested live | AT-3; square-lattice fallback |
| 3 | The header band is shared with our section row (CQ1) | AT-2's click test; the fallback layout (§3.1.1) |
| 4 | Plates have not yet run with the Phase 2 reporter; the mosaic bands and the occluder need P6, P7, P8 and P9 together | AT-10b and AT-10c; CSS plates as the floor (§10.5); the full mosaic softens labels slightly at most |
| 5 | "+" popup T3 patch and the All Apps route jump (LQ5) | T1 grid fallback; All Apps hidden |
| 6 | T1 popup: Steam's default focus may land on Liquid Glass (stock behaviour) | T3 fixes it; until then it is unchanged from today, and the pip shows that A would act on the theme |
| 7 | Larger posters need the grid props patch (LQ2) | Steam's 172 × 258 is the baseline |
| 8 | Hero decode cost on the shared GPU (LQ6) | Heroes only for the visible page and the open card; portraits for peeks |
| 9 | Laser on transparent texels (SP §6.4) | Harmless either way; a wearer question (PLAN §5.3 item 3) |
| 10 | Session MRU of programs is in memory only and resets with Steam | Intended (no persistence) |
| 11 | window-nav must carry the windowless routes and the search contributions | Resolved by PLAN §1.2 and §1.9; WN §3.1.1 lists the routes; the provider API is C1b's (`xc-home-search.md`) |
| 12 | window-nav's laser-mode ornament dropped the A/B legends | Resolved by PLAN §1.10 (A and B always present) |
| 13 | The override could change the footer's visibility on Home | `ui.Page` with Steam's footer props; AT-1 checks; the quiet legend is the fallback (§3) |
| 14 | G-AUD compares a route with its stock self; on `/library/home` the override moves Steam's Home nodes to `/library/lgs/steamhome` by design | AT-6 audits them on `/library/lgs/steamhome` against stock Home; requested from P10 (stock-route option) and recorded for the coordinator |
| 15 | The card ramp's plate cannot morph in glassd yet | Phase ramp under the crop (§10.2); AT-10c's ramp frame |

---

## 16. Cross-concept agreements

| With | Agreement | Where recorded |
|---|---|---|
| window-nav (C1a) | `/library/home` and `/library/lgs/folder/*` are **windowless** (plates, one pop on attention); `/library/lgs/steamhome` is `window-full`; Home answers `glassMode` so a failed override falls back to a window | PLAN §1.2, WN §3.1.1, `xc-home-search.md` §1 |
| window-nav (C1a) | The Home field is WN's circle variant; no microphone anywhere; Back and the search circle are plates on windowless routes | PLAN §1.9, §3.1 |
| window-nav (C1b) | Search is window-nav's sheet; this concept adds programs in the ranking, the Apps section and X = Play through the provider API | PLAN §1.9, §6, `xc-home-search.md` §2 |
| window-nav (C1a, C1c) | Library routes: the bottom ornament's five fixed slots per input mode (§7.1); the More helper on posters; menus by count; the Filters content inside WN's sheet frame (§9) | PLAN §1.10–§1.12, §7–§9 |
| control-center | The Liquid Glass switch stays only in the "+" popup (CC row "+": "Liquid Glass stays a row there") | HA-10 |

---

## 17. Critique responses (revision 2)

| # | Critic's issue | Response | Where |
|---|---|---|---|
| 1 | **Blocker:** a windowless Home with uncovered pops ghosts, and without pops the glass falls back to tint | **Accepted. Mechanism chosen: covered plates.** Every plate is opaque glassd glass (Steam's panel hidden under it). The mosaic is restricted to the plates' bands. Only the attended item pops (+15 mm), over its own plate in an occluder variant. **Not chosen, option (a)** (opacity 0 on `t1` + full mosaic): it depends on the main panel staying a laser target at opacity 0, which only a wearer can confirm, and a full mosaic with holes approaches the 24-layer limit. **Not chosen, plain option (b)** (slabs inflated by dz · tan 35°): it needs 9–23 px of empty glass around every popped element, and it still leaves unpopped discs without glass. **Correction to the critic's numbers:** "≈ 7 px at +10 mm, ≈ 18 px at +25 mm" are millimetres; in CSS px they are **9 and 23** (0.77 mm per px). AT-10b (static) and AT-10c (off-axis look) added | §2 HA-1, §10, §14, `p2_home-apps_depth.png` |
| 2 | Conflict with window-nav over search, Home's glass and field geometry | **Accepted.** window-nav owns search. Contributions: programs in the ranking, the Apps section, X = Play. The field is WN's spec, with WN's circle variant on Home | §6, §16, `xc-home-search.md`, `p2_home-apps_search.png` |
| 3 | A dead microphone in the search field | **Accepted.** Removed everywhere; the clear × is the only control in the field (WN D-8) | §3.1, §6 |
| 4 | The Liquid Glass switch as default-focused cell 1 of Apps, drawn white like a selection; also in search | **Accepted.** Removed from Apps and search. In the "+" popup: T3 toggle row, never default focus; T1 normal cell with a green pip. AT-5 extended (b–e) | HA-10, §4, §5, AT-5 |
| 5 | Card circles at a 68 px pitch; Play not one click; jitter; hover-keyed and untestable | **Accepted.** A Play capsule and a More circle, 180 px apart, with non-overlapping 80 px hits. Hysteresis (0.8 s inside the disc circle; close 0.3 s after the laser leaves; two moves within 0.3 s open nothing). Revision 3: driven by P3's attention machine (gamepad focus or laser dwell), since laser hover does not move focus. AT-8 (a–g) | §3.4, §1.2, AT-8 |
| 6 | Poster More circle: 52 px, on the corner, click bubbles, recycling | **Accepted.** 60 px with an 80 px hit, inside the poster (inset 10). Revision 3: C1a's one helper per document (PLAN §1.11), capture-phase isolation, the host's own `onMenuButton`. AT-14a/b | §7, §7.2 |
| 7 | The library toolbar ignores laser and gamepad modes | **Accepted.** Five fixed slots (880 px in both modes), filled from Steam's laser-mode pill or legend; T2 Options in laser mode; current sort shown in both. AT-14d tests both by stubbing only our own input classes, since faking Steam's getter would affect every agent (INV-L §6.1) | §7.1, AT-14d |
| 8 | LB/RB mean two things inside What's New; bumper badges | **Accepted.** What's New is its own route; LB/RB on Home only change sections. **Partly different fix for the badges:** instead of reading the controller's button set, Home follows Steam's own VR convention (arrows instead of bumper glyphs, INV-L §1.4) and shows no bumper badges by default. AT-3 (i), (j) added | HA-2, HA-3, §3.6, AT-3 |
| 9 | The "+" popup still hides about 44 % | **Accepted, option (a):** 4 columns of 72 × 96 popup px (side padding 6, so 72 px rather than 69), 52 px discs. All 23 visible in 576 px; panel 726 = 26.9° against 22.2° today. Option (b) is rejected: 35° tall. The Windows group and the session "Recent" row come first when present; with them the grid scrolls by at most 1.4 rows | §4, `p2_home-apps_plus.png`, AT-12 |
| 10 | Invented mockup data and too-crisp icons | **Accepted.** Mockups use the Frame's real data through a read-only fetch script (git-ignored refs, licence kept). Icons at 64 CSS px, their source size (the D2 §9.3 1.5× texture cap; 38–47 display px). The honest renders exposed issues that changed the design (§0.3) | §0.3, HA-12, all renders |
| 11 | The Home's top band is heavier than visionOS Home | **Accepted.** 60–64 px controls; a centred 3-segment control without badges; a search circle instead of a field; What's New as one small capsule. About −44 % glass area | §3.1 |
| — | AT-10 checked only crop depths | **Accepted.** AT-10b and AT-10c added (see 1) | §14 |

---

## Sources

- **Phase 2 plan and design system:** `docs/phase2/PLAN.md`, `docs/phase2/DESIGN2.md`.
- **Contracts:** `docs/phase2/contracts/react.md`, `interaction.md`, `tokens.md`, `motion.md`, `reporter.md`, `glassd.md`, `lab.md`.
- **Audits:** `docs/phase2/audit/library-apps.md`, `shell-nav.md`, `system.md`.
- **Capabilities:** `docs/phase2/capabilities/steam-react.md`, `spatial.md`, `native-e2e.md`, `input-mode.md`.
- **Other concepts:** `docs/phase2/concepts/window-nav.md`, `control-center.md`, `controls.md`.
- **Research:** `docs/phase2/research/visionos-principles.md`, `visionos.md`, `references.md`, `liquid-glass-motion.md`.
- **Inventories:** `docs/inventory/library.md`, `bar.md`, `shell.md`.
- **Native layer and lab:** `docs/NATIVE.md`, `docs/LAB.md`.
- **References:** `docs/refs/visionos/1–12`.
- **Mockup kit:** `docs/phase2/mockups/kit.css`, `kit.js`, `window-nav-shared.css/js`.
- **Live read-only data** (2026-10-07): via `mockups/fetch-library-refs.py`.
