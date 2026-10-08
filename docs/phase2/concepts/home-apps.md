# Concept: Home view and App Library (`concepts/home-apps.md`), revision 3

This concept redesigns everything a user launches from:

- Steam's Library home;
- the library catalogue (tabs, grid, sort, filter, collections);
- search, as a way to find anything you can launch;
- the dashboard bar's "+" popup (Add Desktop Window / Launch Program).

Games, Steam shortcuts and desktop programs become one visionOS-style app-selection experience.

**Revision 3 (Phase 2 build, milestone M0).** This revision brings the text into line with `docs/phase2/PLAN.md` §1, which decides every conflict between concepts. §0.5 lists each §1 decision that touches this concept and where it landed. Where this text and PLAN §1 still disagree, PLAN §1 wins. The main changes from revision 2:

- **Attention, not focus, drives the reveals.** Laser hover never moves Steam's focus (IM D-7, proven), so the card ramp and the name plates run on P3's attention state machine: gamepad focus, or laser dwell (§3.4).
- **Plates.** Every glass element on Home and in folders is a P9 G1 plate tagged for P6's reporter; only the attended item pops, +15 mm, **non-interactive** in the default profile (§10).
- **One control vocabulary.** The top row sits on the 108 px toolbar row's centre line; the section control is a contiguous segmented control; the card's More circle has the shell helper's look (§3.1, §3.4).
- **Search is window-nav's sheet.** This concept's contributions go through C1b's provider API (`docs/phase2/wp/C1b.md`, "Interface announced"): programs can be the Top Hit, and a **Software cell** starts the Store row of the results (§6).
- **Depths and dimming** follow PLAN §1.7 and §1.8: the "+" popup +25 mm, menus and the Filters sheet +10 mm, Steam's overlay at black .35 for the dim (§4, §8, §9, §10).
- **The library sections (§7–§9, and their rows in §10–§16) are C2c's text**, merged from C2c's M0 request (`docs/phase2/wp/C2c.md`, REQ-1): a fixed five-slot ornament, the More helper on posters, menus by count, and a Filters sheet with toggle capsules.

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
| `home-apps-collections.html` | C2a | `p2_home-apps_collections.png` | Home › Collections in a dimmed room (legibility check): the real collections; the 8 empty ones are grouped in one dimmed folder, attended by the laser, with its two-line name plate |
| `home-apps-folder.html` | C2a | `p2_home-apps_folder.png` | The real "VR" collection (27 games) as a folder route, page 1 of 3, **gamepad mode**: focus on Grimlord for 0.8 s has opened its card (Install, not installed) with the X and ≡ glyph badges; five not-installed games show the cloud badge |
| `home-apps-depth.html` | C2a | `p2_home-apps_depth.png` | Depth and glass on Home without ghosts: plates, the occluder plate under the one pop, mosaic bands, the click-safe rule and the static check |
| `home-apps-search.html` | C2a | `p2_home-apps_search.png` | C1b's results sheet for "half" over the Library snapshot (layout and data as `p2_window-nav_results.png`), gamepad mode, with gamepad focus on this concept's **Software cell** (Half SBS Toggle, the one real program match). A program has no X or ≡ action, so the ornament holds only A and B and is the quiet legend in the margin (PLAN §1.10) |
| `home-apps-plus.html` | C2b | `p2_home-apps_plus.png` | The bar's "+" popup (T3): 4 columns, all 23 programs visible, the full-name plate on focus, the Liquid Glass toggle row |
| `home-apps-plus-t1.html` | C2b | `p2_home-apps_plus-t1.png` | The same popup with T1/T2 only: Steam's list in Steam's real scan order, with Liquid Glass as a normal cell carrying a green "on" pip |
| `home-apps-library.html` | C2c | `p2_home-apps_library.png` | Library, laser mode. Steam's tile menu grows from the white More circle of its source poster: compact layout, +10 mm. The source is flat with its glow. The laser-mode ornament: Steam's Sort and Filter in slots 1–2, the shell's Options member disabled while the menu is open, Select and Back as labels only. The letter scrubber |
| `home-apps-library-pad.html` | C2c | `p2_home-apps_library-pad.png` | Library, gamepad mode. The focused poster is lifted (+15 mm) with the More circle and Steam's compatibility badge. Steam's legends sit in the same five slots with glyph badges. The scrubber is a passive position cue |
| `home-apps-filter.html` | C2c | `p2_home-apps_filter.png` | Library Filters in C1c's sheet frame: Steam's real options as a compatibility pop-up, toggle capsules and collapsed sections. The ornament recedes, with Select and Back lit |

`home-apps.css` (C2a) also carries the "+" popup rules that C2b's mockups load, and the `.ha-poster` base rule that C2c's mockups load (with `home-apps.js`'s `[data-app]` art fill). C2c's library styles now live inline in its own three mockups (class prefix `lc-`), so revision 3 removed the old `hl-*` block and `.ha-poster.is-lift` from `home-apps.css` (C2c REQ-2). The CSS-only plate recipe is keyed on `data-tier="t1"`.

**Mockup ids for `glass.py cmp`.** The Home mockups carry `data-id`s on the top row (`back`, `seg`, `seg-recent`, `seg-collections`, `seg-apps`, `whatsnew`, `search`), the cells (`cell-1` … `cell-13`, with `disc-<n>` and `label-<n>`), the page dots (`dots`), the peeks (`peek-r1`, `peek-r3`) and the card or name plate (`card`, `card-play`, `card-more`, `plate`). `docs/phase2/wp/C2a-cmp.json` (M2) maps them to live selectors (PLAN-2a-1).

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
| §1.2 | Route glass modes: `/library/home` and `/library/lgs/folder/*` are `windowless` (every glass element a plate; CSS plates black .58 + white .16 → .04 + edge cues); What's New is `window-full` 1280 × 720; library routes `window` 656 | Home answers C1a's `__LGS_RT.shell.glassMode('home', fn)` hook, so a failed override falls back to `window-full` (§3.7; REQ C2a->C1a #1). CSS plate recipe in §10.5 | §3, §3.6, §3.7, §10.5 |
| §1.3 | One control vocabulary | Back (24, 24) / box (14, 14); search circle (1196, 24) / box (1186, 14); section control as a contiguous 64 px segmented control with 60 px segments; card actions with 80 px hits; More 60 / 80 black .38 + 10 px blur; Home disc 120 on 224 / 188; glyph badges 30 | §3.1, §3.4 |
| §1.4 | Two input signals (`html.lgs-input-*`, `data-lgs-vr-mode`), one accessor; hover never moves focus; laser looks on `:hover`, lift after 80 ms dwell; one attention state machine; focus add .28; only content cards and Home discs lift; glyph badges in gamepad mode only | The ramp and name plates run on `rt.attend`; `lgsInputMode()` replaced by `__LGS_RT.input`; "laser hover moves focus" withdrawn everywhere; badges keyed on `data-lgs-vr-mode="gamepad"` | §1.2, §3.4, §3.5, §7.1, AT-8, AT-20 |
| §1.5 | One motion system (P5 tokens); Steam's entrance animations overridden within its timeouts (S3); nothing at rest; Reduce Motion fades only | Home entry ≤ 800 ms with the stagger; every duration a token; ramp and section changes are C2a's T3 motion | §11 |
| §1.6 | Five materials, four mechanisms; plates ≤ 32 per surface; E3 lobe; no outline; glass L 55–110, 70–90 under text | Plates instead of cover shapes; text-bearing plates (card, name plate) tinted to L 70–90 | §3.4, §10 |
| §1.7 | Two depth profiles; admission rules; {0, +10, +15, +25} mm; Home focused cell, card, name plate +15 non-interactive over the plate's occluder; "+" popup +25; menus and sheets +10 | Depth table replaced; the card's actions use 80 px hit elements so the click-safe rule admits +15. While a menu is open, only the menu pops (rule 6): the source card or poster goes to 0 with a CSS glow. PLAN R2-3 amended §1.7's table row to say the same ("Source card while its menu is open: 0 with a CSS glow, in both input modes"), so the earlier conflict (C2c REQ-7) is closed | §4, §8, §9, §10.4 |
| §1.8 | Alert and sheet dimming is Steam's overlay at black .35; no `t1` tint for in-window modals | The Filters sheet's `t1` dim is withdrawn | §9, §10.4 |
| §1.9 | Header 108 or the fallback classes; the field's three variants; search is WN §4; HA contributes through `__LGS_RT.search.addProvider` | Home keys only on `lgs-hdr-108` / `lgs-hdr-40`. §6 follows C1b's announced provider API: `{id: 'c2a.programs', slots: ['tophit', 'software'], rank, open}`, match tiers 0–3, a program is the Top Hit only with a strictly better tier, and the **Software cell** (300 × 84) starts the Store row (C1b REQ #5) | §3.1.1, §6 |
| §1.10 | Legends never hidden; capsule or quiet legend; A and B always present; the library ornament hugs its members and Steam's laser Sort & Filter pill is the toolbar's trailing group (R2-2), the five 880 px slots only behind `libFixedSlots` (off, S28); compact members, never dropped | §7.1 is C2c's slot text. Home and folders keep Steam's own footer visibility (Steam's Home hides its footer by its own props, not by CSS); if a footer shows, it is C1a's quiet legend or capsule and the honeycomb gives it room (§3, §3.2). XC's "please reconcile" closed | §3, §3.2, §3.6, §7, `xc-home-search.md` §3 |
| §1.11 | One More helper (C1a, `more.register`), one node per document, host's `onMenuButton`; never on Home's launcher discs | §7.2 rewritten (C2c registers posters); the card's More is the card's own control with the helper's look | §3.4, §7.2 |
| §1.12 | Menus by item count (6 compact, 7–10 grid, 11–14 grid scrolling inside the slab); Cancel a 60 px quiet capsule (R2-5); anchoring gated; destructive rule by count | Sort (10) is the two-column grid; the tile menu (6 actions with developer mode) is compact; anchored menus stay 12 px clear of the ornament. Over Home, the menu's crop needs its own `thick` plate (no window cover: rule 1; REQ C2a->C1c #3) | §8 |
| §1.13 | P3 tooltips (0.8 s / 0.2 s); Steam's sounds through its bus, none on hover; haptics off | Tooltips on Home's icon-only controls; sound map for sections and pages | §3.4, §3.5 |
| §1.14 | HA-1 to HA-14 adopted with corrections (attention, +15 non-interactive pop, G1 plates with HA §10.5 as the floor, "+" at +25); HA-3, HA-4, HA-5, HA-10 adopted, D2 §3.5 amended by P4 | HA-3's sign-off note closed; decisions table updated | §2 |
| §1.15 | Strings from Steam's localization; English only when the UI language starts with `en` | New §3.8 lists every string T2/T3 draws | §3.8 |
| §1.16 | Exemptions E-BACK, E-SEG, E-MENU, E-GRID and E-GRID (labels) [R2-15] | Back on Home and folders is E-BACK; the section control is E-SEG; the "+" popup's launcher cells are E-GRID, their labels E-GRID (labels): no glyph cut, the full name in the DOM and on the plate (§4, AT-12) | §3.1, §4, AT-7, AT-12 |
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
6. **Browsing stays a window.** All Games (or the Library tab) opens window-nav's glass window. It holds:
   - posters;
   - a More circle on the poster you look at or focus, the laser's direct path to a game's menu;
   - a letter scrubber;
   - one bottom ornament of five fixed slots that shows the current sort in both input modes.
7. **Search is the system's search** (window-nav's sheet). This concept adds desktop programs to it: a Software cell at the start of the Store row, and programs ranked into the Top Hit. On library items, X plays.
8. **The storefront is one button away, untouched.** What's New opens Steam's own Home feed (shelf, What's New, Friends, Recommended) in a glass window. Every card works as before.

### 1.3 Is the current UI optimal in VR? Per context

| Context | Verdict | Why (evidence) | Redesign |
|---|---|---|---|
| Library Home | **Not optimal** | Launcher and storefront are mixed. The featured tile reflows 11.7° on focus. Status text is 12 px uppercase. The tile menu has no laser path, because the footer is hidden on Home (LA B.3, B.5.1, B.5.4, H3) | A windowless Home view of discs with sections and a card ramp; the feeds move to their own route (§3) |
| "+" Launch Program | **Not optimal** | Icons are 0.6° and rows 1.5°. 40 % of the list is hidden, the order is unstable, and the theme switch sits in a random row (LA B.1, B.3) | A 4-column popup with all programs visible and the switch as a row (§4); the full grid in Home › Apps (§3) |
| Library catalogue (grid) | **Content is fine, chrome is not** | Posters at 5.3° are good. Tabs are 1.04°, the sub-filter 1.35°, legends 1.07°. There are two control sets for Sort/Filter that switch with the input mode, and no position cue in 30 screens of scroll (LA B.1–B.4) | Posters stay in a window (LA D.1); chrome rebuilt as a segmented control, one per-mode ornament with fixed slots, and a scrubber (§7) |
| Sort menu, tile menu | **Not optimal** | Centred console sheets far from their source, 1.47° rows, no current value shown (LA B.4.4) | Glass menus grown from their source, laid out by item count, current sort checked (§8) |
| Library Filters | **Worst screen** | 47 rows of 0.86°, 0.49° checkboxes, 3.8 window heights of scroll (LA B.1) | A sheet with a compatibility pop-up, toggle capsules and collapsed sections: about 1,280 px of content (3.3 sheet heights) against Steam's 2,742 px (§9) |
| Collections tab | **Not optimal** | 8 of 9 tiles say "( 0 )" and push the useful one off the first row (LA B.3) | Folders, with the empty ones grouped (§3.2) |
| Search results | **Not optimal** | Category tabs 1.04°; no titles or install state; programs are not searchable (LA A.7, B.2) | window-nav's search sheet plus programs from this concept: the Top Hit and the Software cell (§6) |
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
| HA-6 | **The card ramp:** after 0.8 s of attention, the disc morphs into a 320 × 240 card holding Play and More, about 184 px apart (centre to centre). It is driven by P3's attention state machine (gamepad focus or laser dwell) and has hysteresis (§3.4) | A Play capsule under the label (D2 §3.5); rev 1's 312 × 206 card with circles at a 68 px pitch; rev 2's "focus is the single driver" | The label band cannot hold a 60 px button. The card is visionOS's "pop open to reveal more" (VR §19). An 80 px pitch is D2 rule 1. Laser hover never moves Steam's focus (IM D-7), so focus alone cannot drive it (PLAN §1.4) |
| HA-7 | **The catalogue stays posters in a window** (window-nav's window) | All 350 games as circles | 27 pages with no random access, and circle crops drop logos (LA D.1). Circles are for launching |
| HA-8 | **Search belongs to window-nav** (its sheet, PLAN §1.9). This concept contributes programs (the Top Hit and the Software cell) through C1b's provider API, and X = Play on library items, which C1b's sheet declares on its own items. The Home field is window-nav's **circle variant** | Rev 1's split view at `/search/tab/<id>` | Only one override can render the route (critic). One field spec everywhere |
| HA-9 | **The "+" popup stays Steam's popup in Steam's host** (300 px), restyled. A T3 patch adds A–Z order, 4 columns and the toggle row | Opening Home from "+" | The theme switch must never depend on our route (LA C.1, D.7.1). LQ5 (opening a T3 route from the bar) is unproven |
| HA-10 | **The Liquid Glass switch appears only in the "+" popup.** In T3 it is a toggle row at the bottom that never takes default focus; in T1 it is Steam's own row with a green "on" pip. It is **not** in Home › Apps or in search | Rev 1: first cell of Apps, drawn as a white "on" disc | Adopted (PLAN §1.14). A habitual A on the first cell would turn the theme off. White is this design's selection colour (critic). P2's `useNonSteamApps` leaves it out unless asked |
| HA-11 | **Steam's menu "Cancel" stays**, as WN's 60 px quiet capsule centred under the rows (PLAN R2-5; VP P-80) | Removing it | It is Steam's node (the audit would report it HIDDEN); 60 px visible on its 60 px element and ≥ 192 wide keeps ≥ 85 % of Steam's 280 × 48, so not SHRUNK; its own E-MENU (Cancel) line (PLAN §1.12, §1.16) |
| HA-12 | **Program icons are drawn at 64 CSS px, their source size** (Steam's 64 px `strIconDataBase64`). In Steam's 1.5× texture that is 96 px, D2 §9.3's 1.5× cap. On the display it is 38–47 px (D2 §2.3), so a 64 px source is not visibly upscaled | 72 px (rev 1, 1.7× in the texture); 48 px (D2 §9.3's example) | 48 px leaves a 120 px disc mostly empty. 64 px is the largest size inside the cap. The 6 icons that Steam upscaled from 32 px stay soft until the daemon supplies theme icons (LQ4) |
| HA-13 | **Empty collections are grouped** into one dimmed "Empty Collections" folder when there are two or more | 8 dimmed circles last (rev 1) | 8 of 9 collections here are empty. Grouping keeps every one reachable at one more level (VP P-61: dimmed and last) |
| HA-14 | **Folders and What's New are routes** under `/library/lgs/…` (P2 `routes.add`, D2 §12) | In-page folder state | Steam's Back and B work natively, and focus memory and history stay Steam's |
| HA-15 | **The card's actions are 96 px hit elements** with the 60 px glass drawn inside (Play: capsule hit 96 tall, 4 px wider on each side; More: 96 × 96; the two hits abut at Play's widest label) | 60 px hit boxes; 80 px (rev 3, too tight: s = 80 admits +15 mm only at a window scale r ≥ .975, review R2 m4) | PLAN §1.7 rule 2 measures the smallest focusable inside the crop: +15 mm needs s ≥ 15 / (369 r) / .000521, so s = 96 keeps the card at +15 down to r = .81 (the lifted disc's own s is 180); a 60 px box would cap it at +10 mm, a fifth depth class on Home |
| HA-16 | **The card's More circle is the card's own control** in its action row, with the shell helper's look (60 / 80, black .38 + 10 px blur, white while its menu is open) and the helper's dispatch (the cell's own `onMenuButton`, the same handler as ≡) | Registering the card with C1a's `more.register` (top-right placement on the art) | PLAN §1.11 keeps the helper off Home's launcher discs; one action row (Play, More) reads as visionOS's expanded card; the dispatch is identical, so there is still one menu path |
| HA-17 | **A gamepad focus move closes the open card at once**; the 0.3 s grace bridges laser jitter only | 0.3 s grace for both inputs (rev 2) | A D-pad move is deliberate; VP P-18 wants one lit element shortly after a move. P3's `leaveMs` keeps the grace for the laser, and the new cell's `enter` closes the old card in gamepad mode |
| HA-18 | **The programs' place in the results is C1b's Software cell**: Steam's header "Software" (`#AppType_2`) over one 300 × 84 cell at the start of the Store row, holding the best program (56 px disc with its icon at 48, name 24 Semibold) and "and N more" when more programs match. The store keeps two cards beside it | Rev 2's Apps cell splitting a 704 × 76 Store row; session 1 of revision 3's Apps section of three capsules after Top Results | C1b owns the sheet (PLAN §1.1) and announced this geometry (C1b REQ #5). One cell keeps the Store row's height, so the sheet's layout does not change with the query; programs launch at once, the Store does not, so the program comes first in that row (§6) |
| HA-19 | **Decisions taken without the user** (PLAN §1.17's rule: the safe default behind a flag): LB/RB glyph badges on the section control (VP I-15) off (`home.bumperBadges`); Home's runtime gated by `wp.c2a` (PLAN §2.1); folder routes keep Steam's Home footer props, and if Steam shows a footer anyway the folder drops to two rows (§3.2); a source card drops to 0 mm while its menu is open (PLAN §1.7 rule 6) | — | Steam's own VR convention is arrows, not bumper glyphs; badges would teach a button whose delivery in VR is unproven (AT-3f). A footer may never be hidden (PLAN §1.10), so the page makes room instead. Rule 6 is what P6's reporter enforces. Recorded in `docs/phase2/wp/C2a.md` |

---

## 3. Home (the app-selection view)

**Route.** Steam's `/library/home`, rendered by a T3 route override that receives Steam's children: `rt.react.routes.override(Routes.Library.Home(), fn)` (P2 §4.2; SR §3.5 [PROVEN]). P2 wraps it in an error boundary whose fallback is Steam's own Home.

**Other routes** (P2 `routes.add`, under `/library/lgs/`):

- Steam's Home children render at `/library/lgs/steamhome` (What's New, §3.6).
- Folders render at `/library/lgs/folder/:id` (§3.2).

**Glass mode** (PLAN §1.2). C1a's route map (WN §3.1.1) sets `data-lgs-glass` and `data-lgs-route` (`home`, `folder`, `steamhome`) on `%{BasicUiRoot}`. Home is `windowless` **only while the override is installed**: `41-home.js` registers `__LGS_RT.shell.glassMode('home', () => live ? 'windowless' : null)` (the hook WN §3.1.1 already offers C5a and C3b), and C1a uses `window-full`, Steam's own Home in a window, when the answer is `null` or the hook is missing (§3.7; REQ C2a->C1a #1). Folder routes exist only while the override runs, so they are `windowless` unconditionally. What's New is `window-full`. Without the runtime there is no attribute and the CSS default is `window` (WN §3.1.1), with Steam's Home in it.

**Footer.** Steam hides its footer on Home today (LA B.3), with its own code, not with CSS: Steam's footer store counts hide requests (`FooterStore.HideFooter()` returns `{unhide}`; Steam's `useHideFooter` hook, module 5757 on build 11094443) and renders no `#Footer` node while the count is above 0. Our Home and folder pages make the same call while mounted (`useSteamFooter` in `41-home.js`) and pass the page props Steam's Home passes (`padForHeader: false`, `padForFooter: false`, `headerVisibility: 'default'`, `minimumOpacity: 0`), so the footer keeps Steam's visibility on these routes; AT-1 compares `#Footer` with stock Home (both: no node). What's New renders Steam's own Home component, which makes the call itself. Folder routes render the same way (§3.2). Steam's legend nodes are never hidden by our CSS (PLAN §1.10). If Steam shows a footer anyway, it is C1a's ornament: the quiet legend when it holds only A and B (y 652–712, the page dots move into its leading end), or the 84 px capsule at y 628–712 when it holds X or ≡; the page then uses two honeycomb rows (§3.2, "Footer fallback").

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

**Fallback layout**, used only if AT-2's click test in the band (y 30) fails, or if WN AT-4 rejects the search circle: the top row holds Back, the search capsule (520, centred) and What's New; the section control moves to y 102–166, centred (its 80 px hits start at y 94, where the search capsule's hit box ends); a folder's title moves to the same band; the honeycomb rows move to y 236, 416, 596 (row pitch 180; the cells' boxes start 2 px below the segments' hits); the card's top clamps at y ≥ 178. The class `lgs-home-low` on our page root switches it; `41-home.js` sets it while C1a's shell shows the search capsule (`data-lgs-search` other than `circle`), which is the default until C1a's flag `searchCircle` is on (WN AT-4 not yet passed, C1a log). In this layout a row-1 card covers the row-2 discs it overlaps by up to 62 px (AT-8(e)'s 16 px holds in the standard layout); their labels fade as usual (decision D-C2a-9).

### 3.2 Sections and their content

| Section | Content and order | Pages (here) | Data (read-only, P2 `rt.react.data`) |
|---|---|---|---|
| **Recent** | The running game first (green dot), then Steam's MRU merged with programs launched from our surfaces in this session (in-memory timestamps), newest first. Cell 13 of every page is the **All Games** folder (→ `/library/tab/AllGames`) | 2: 12 + 8, each with All Games | `data.recentGames()` (`recentAppsCollection`, 20 here), `data.app()`, `MainRunningAppID` |
| **Collections** | First the library sets as folders: Great On Frame, Ready To Play, Installed, Non-Steam, Soundtracks, and Favorites when non-empty. Then user collections with games, A–Z. Then **one "Empty Collections" folder** when two or more collections are empty (a single empty one is shown by itself, dimmed, with an "Empty" plate) | 1: 7 cells | `data.collection()`, `data.stores().collectionStore` (`frameGamesCollection`, `readyToPlayActiveCollection`, `localGamesCollection`, `deckDesktopApps`, `userCollections`) |
| **Apps** | Every program from Steam's own launch list **except the Liquid Glass entry**, A–Z (`localeCompare`, case- and accent-insensitive) | 2: 13 + 10 | `data.useNonSteamApps({includeLiquidGlass: false})`: Steam's own scan and filter, developer mode honoured, rescanned on every Home entry, keyed by `strCmdline` |
| **Windows** (only when present) | Desktop windows that SteamVR reports, in Steam's order; the segment appears only while the list is not empty (a selected Windows section that empties falls back to Recent). A on a window is `actions.desktopWindow(window_id)` | 1 | The `windows` message Steam's "+" popup uses (LA A.8.4): `41-home.js` finds the popup's own hook by source (the module with `IsVRSimulatedOnDesktopWindow`, `DashboardDesktopWindowClicked`, `LaunchNonSteamApp`) and calls it with the same message type. Tests use `rt.home.test.windows([...])` |

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
- **Footer:** the folder page passes Steam's Home footer props to `ui.Page`, so no footer shows, as on Home. The card's glyph badges carry X and ≡ in gamepad mode (§3.4).
- **Footer fallback** (Steam renders a footer on the route anyway; AT-1 on a folder detects it): the ornament is never hidden, so the page makes room. With the capsule (y 628–712) the folder shows **two rows (4-5, 9 per page)** with centres at y 196 and 384, and the page dots move to y 560; with the quiet legend only the dots move into its leading end. The class `lgs-home-footer` on our page root switches it.
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
| Downloading (also installing, updating, paused, queued) | Art dimmed, with a white progress ring (r 22, 6 px stroke, white .22 track) on a black .45 disc at the centre; no cloud badge | Status: Steam's own word for the state (`#DisplayStatus_<state>`: "Downloading", "Installing", "Update Paused" …) and the percentage, "Downloading · 62%". From the client data Steam's own UI reads (`selected_per_client_data.display_status`, EDisplayStatus 3, 6, 7, 18, 19, 22, 23; `status_percentage`) |
| Update available | A blue 28 px badge with a download glyph at the top right, overlapping by a third (EDisplayStatus 20, UpdateRequired; in row 1 of the low layout the badge sits at the disc's top edge, clear of the segments' hits) | Play becomes **Update** (blue); status Steam's "Update Required" |
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
| 0.8 s (games) | The disc **morphs into the card** (the disc fades out under it while the card's clip grows from the disc's rect; it fades back in as the card closes into it): 320 × 240 [240 × 180], radius 36, centred on the disc horizontally, top at the disc centre − 100 (− 110 in the low layout, §3.1.1), clamped 12 px below the section control's track (y ≥ 98) and 40 px inside the window's left and right edges and 16 px inside its bottom (bottom ≤ 704). On cells left of x 400 the **action row is mirrored** (More at (24, 80), Play at the trailing edge), so Play's centre stays within 400 px of the centre line with any label up to 190 px (VP P-29; measured 36–379 px off centre on every cell in both modes). In CSS-only mode the card is the darker text plate (black .78 under white .12 → .02) with PLAN §1.6's in-page `liquid` blur; the discs and labels it covers are cut away under it (a rectangular `inset()` clip that keeps each one's part beyond the card's rect + 2 px), so nothing shows through it and its native crop carries only the card. **Art** 296 × 140 at (12, 12), radius 24 (concentric), with the logo centred at 31 % of the art's height. **Play** capsule 60 [45] visible at (24, 80), width from its content (115 with the English label) and at most 190 (the label ellipsizes), green whole fill, play glyph plus "Play" 22 px Semibold (Install / Update blue), inside a 96 px tall hit element 4 px wider on each side. **More** circle 60 [45] visible at (236, 80), black .38 + 10 px blur (the shell helper's look, PLAN §1.3), inside a 96 × 96 hit element (HA-15, HA-16). Centres are 186 px apart with the English label (149 with the widest, 190 px capsule); the hits never overlap (they abut at the widest label). **Title** Headline 24 px Bold at (24, 162), one line. **Status** 18 px at (24, 194): compatibility icon and word, then playtime | `morph-open` 607 ms from the disc's rect and radius to the card's (`lgs-morph` clip, 320 × 240 is inside the 600 × 600 limit). The CSS clip rides the bounce-0 curve, as P5's `lgs-morph` and MO §6.4 require (a negative `inset()` overshoot is not dependable); glassd draws the token's b 0.20 overshoot of the glass in native mode. Content 15–50 %; the two controls `materialize-in` 250 ms at 50 % |
| Attention leaves | **Laser:** the card closes 0.3 s later unless attention returns (P3 `leaveMs`). **Gamepad:** a focus move to another cell starts the close at once (HA-17); a move back within P3's 0.3 s grace restores the card (`onReenter`). The closing card keeps its node: its content leaves on `materialize-out` (gone by 55 %), its clip returns into the disc's rect on `morph-close` (a transition from its rest clip, so no keyframe of our own), its glass dissolves on `materialize-out` while the disc fades back in, and it is removed on its `transitionend` | `morph-close` 441 ms (b0); content out by 55 % of 350 ms |
| Press | Glass discs and capsules swell by `min(1.06, 1 + 6/maxSide)` (×1.05 on a 120 px disc); content brightens only; glow from the hit point | `interactive` 210 ms; release glow 90 ms linear, swell back on `snappy` 488 ms |

**Hysteresis**, against laser jitter while sweeping the grid:

- The 0.4 / 0.8 s steps start when attention lands on a disc. They restart only when attention moves to another disc.
- A sweep faster than one disc per 80 ms lifts nothing (P3 sets no `.lgs-dwell`).
- The card closes 0.3 s after the laser leaves it. While the pointer is over the card, attention stays, because the card is the attended element and part of the cell's DOM.
- Two attention moves within 0.3 s never open a card.

**Text-bearing plates** (the card, the name plate) are tinted so the glass under their text sits at L 70–90 (D2 §6.3): in native mode `data-lgs-plate-tint` with a CSS colour (start value `rgb(0 0 0 / .30)`, tuned at M4 with `hv` against L 70–90; reporter §2.2), in CSS the plate recipe's darker variant. Measured in the mockups at L 85 over the bright studio room.

**Gamepad glyph badges** (X on Play, ≡ on More; 30 px, D2 §9.4) show only in gamepad mode, keyed on `html[data-lgs-vr-mode="gamepad"]` (PLAN §1.4, VP P-26), drawn from Steam's own glyph components where they exist (VP P-27). The laser view stays clean (`p2_home-apps_folder.png` shows them, `p2_home-apps_home.png` does not).

**Tooltips** (P3, PLAN §1.13): the card's More circle carries `data-lgs-tip="above"` (so it never covers the title) with Steam's "Options" string; 0.8 s in, 0.2 s out. The search circle's tooltip (Steam's search placeholder) and Back's titled capsule (E-BACK) are C1a's, as on every route. Discs, segments and What's New show text and get no tooltip (VP P-12).

**Covering:**

- A neighbouring label whose text the card or a name plate overlaps fades to .22; a label whose 200 px box is touched but whose text is clear stays as it is. The text is measured (its `Range` rect against the card's rect or the plate's layout box), not estimated from the 200 px box.
- Under the open card, the parts of other discs and labels it covers are cut away (a rectangular clip on the card's far side; a `path()` hole drew corrupted tiles in native mode), so the CSS card hides them and its native crop at +15 mm never lifts a neighbour's art; the rest of those discs keep their full glass (their plates are not occluders).
- A card covers at most 10 px of the next row's discs in either layout, except a row-1 card in the low layout, which reaches 62 px into row 2 (D-C2a-9); those discs are cut away under it.

**Reduce Motion:** no scale and no lift animation; the end depth is pushed once; the card cross-dissolves in 180 ms (`--lgs-d-reduce`, D2 §11.4 C8).

### 3.5 Navigation model

**Gamepad.** All handlers are T3 `Focusable` props (SR §3.6).

| Input | Effect |
|---|---|
| D-pad Left / Right | Previous / next cell in the row. **Past the row's end:** the same row on the next page, first cell. **Past the row's start:** the same row on the previous page, last cell. **On the first page, Left at a row's start is not handled.** It bubbles to Steam's `onMoveLeft` and opens the tab bar, exactly as today (SN N2) |
| D-pad Up / Down | **Honeycomb rule:** a vertical move keeps the cell's index within the row, clamped to that row's length. This zig-zags around the column. **One-step memory:** the opposite direction always returns to the cell you came from. **Up from row 1** enters the top row (segments, then What's New); **Up again** leaves the page to Steam's search, as today (SR §4). **Down from the top row** returns to the remembered cell. The one-step memory also covers moves Steam made into our grid (Up from a row-1 cell that Steam's own move brought in from C1a's search capsule returns to the capsule) and page turns (Left from the cell a Right page turn reached returns to the cell it came from, also when a short last page put it on another row) |
| LB / RB | Previous / next section; the white pill travels. What's New is not in this cycle (HA-2) |
| LT / RT (if delivered) | Previous / next page |
| A | **Game:** its page (`actions.navigate('/library/app/<id>')`). **Program:** `actions.launchNonSteam(strCmdline)`. **Window:** `actions.desktopWindow(window_id)`. **Folder:** `/library/lgs/folder/<id>` (`nav.go`). **All Games:** `actions.navigate('/library/tab/AllGames')`. **Segment:** that section. **What's New:** `/library/lgs/steamhome` (`nav.go`) |
| X | Games: `actions.primary(appid)`, Steam's primary action (Play / Install / Update / Resume), the same call as the tile menu's first item |
| ≡ (Menu) | Games: Steam's tile menu (`showContextMenu` with Steam's own menu component, or Steam's `vgp_onmenu` path). While it is open, only the menu pops (PLAN §1.7 rule 6): the card drops to 0 and keeps a CSS glow. Programs: none (Steam has none) |
| B | At the Home root: not handled, so Steam's root handles it exactly as on Steam's own Home: history back (stock probe 2026-10-07: `/library/tab/AllGames` → `/library/home`, B → AllGames), the tab bar only when there is no history (SN N3). In a folder or What's New: history back |
| Route entry | Focus lands on cell 1 of the current section, or on the cell remembered for that section; never on Back or the top row (VP P-22) |
| Focus memory | Returning to Home restores the last focused cell per section (Steam's group focus memory, SR §4) |

**Sounds** (PLAN §1.13, P3 `rt.sound`). Section change: `'tab'` (ChangeTabs). Page change: `'page'` (PagedNavigation). Our explicit neighbour moves take focus with the nav node's `BTakeFocus`, for which Steam plays nothing (measured: stock Home requests `deck_ui_misc_10` on every D-pad move, our grid requested none, R2 review M8), so each move we make requests BasicNav (`'nav'`, `deck_ui_misc_10`) once; moves Steam makes itself (the top row) keep Steam's own sound, never doubled. A dead end we handle (Down on the bottom row, Right at the last page's row end, RB at the last section, LB at the first, LT/RT at the ends) requests FailedNav (`'fail'`, `deck_ui_bumper_end_02`), as Steam does for an unhandled press (VP P-79). Activation: Steam's own. Nothing on laser hover. Haptics: none (S17).

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
- C1a's `glassMode('home')` hook gets no answer, so the route is `window-full` (§3, REQ C2a->C1a #1);
- a failing override at render time degrades to `steamChildren` (P2's error boundary).

Nothing in §3 is then visible, and nothing is lost: every Home function is Steam's again (AT-22).

**Render failures after install** (review R2 M7, fault-injected live): an exception inside the card closes the card (its own error boundary) and Home stays; one anywhere else in Home renders Steam's own Home in its place and the `glassMode('home')` hook answers `null`, so the route is `window-full` (Steam's Home in a window); one in a folder replaces the folder in history with Steam's collection page (or library tab), in its window glass. P2's error page never floats on the room. The next visit to Home renders ours again.

**The T1 restyle of Steam's Home** (`theme/41-home.css` part A, M2; also what What's New shows, §3.6): the feed tabs are a segmented control (64 recessed track, 60 visible segments in 80 px hit boxes, ≥ 140 wide, Steam's title-case labels at 22 Semibold); the arrows are 60 circles in 80 boxes; the shelf capsules lift ×1.05 (the 552 px featured one by 12 px) with a depth shadow and a blurred glow instead of Steam's pulsing outline; the focused game's name and status read 22 Semibold and 18 Medium in title case; feed headers are Headline. In the toolbar fallback (no `lgs-hdr-108`) the shelf is padded by C1a's `--lgs-hdr-pad` and the feed's wrapper is 96 px shorter, so the parked tab row sits below the toolbar row (decisions D-C2a-6 to D-C2a-8 in `docs/phase2/wp/C2a.md`).

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
| Software | A program's status line as the search Top Hit (the `subtitle` this concept's provider returns) | `#AppType_2` (C1b found it; the same string heads C1b's Software cell) | — (Steam's) |
| "and N more" | C1b's Software cell | none (C1b's string list) | "+N" (drawn by C1b) |
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
| Labels | Line breaks only between words or after "/". A word too long for its line is cut with "…" and ends the label. Text left over after two lines ends in "…" (11 of 23 names here) | — | The full name appears on focus or after 0.4 s of attention: a 34 px capsule over the label (15 px Semibold, white on grey .92), clamped inside the 300 px host (left-aligned in column 1, right-aligned in column 4). Neighbours' labels under it fade to .22. Without T3 (R23's fallback), the attended cell's own label shows the whole name in the plate's look, in CSS: on `.gpfocus` in gamepad mode, on `:hover` after the 0.4 s dwell in laser mode (PLAN-2b-4). No label cuts a glyph: a name that does not fit ends in "…", drawn by the box that clips it (PLAN §1.16 E-GRID (labels), R2-15) |
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

window-nav owns search: `Routes.Search.Root()` presented as a sheet over a snapshot of the page you were on, with Steam's routes underneath (WN §4, PLAN §1.9; built by C1b in `device/rt/21-search.js`). Its layout, the Top Hit rule and the provider API are C1b's, announced in `docs/phase2/wp/C1b.md` ("Interface announced") and in its proposed WN §4.6. This concept registers one provider from `device/rt/41-search-apps.js` (module `search-apps`, deps `['react', 'search', 'home']`, flag `wp.c2a`; built in round R2; the program list is the one Home's Apps section shows, so programs are known once Home has rendered in the session). For tests the module exposes `rt.searchApps.rank` and `.open`:

```js
const handle = rt.search.addProvider({
  id: 'c2a.programs',
  slots: ['tophit', 'software'],
  rank(query, ctx) { /* sync, ≤ 2 ms */ return [{ key, name, tier, icon, subtitle, data }]; },
  open(candidate, ev, opts) { /* A or a click; the Software cell passes {slot: 'software', more: N} */ },
  // no primary(): a program has no X action (Steam's "+" popup has none either)
});
```

| # | Contribution | Spec | Through |
|---|---|---|---|
| S-A | **Programs in the ranking; a program can be the Top Hit** | The program list is P2's `data.useNonSteamApps()` (Liquid Glass left out; C1b drops it again whatever a provider returns, HA-10). `rank` matches each program's name with C1b's tiers, case- and accent-insensitive: **0** exact title, **1** title prefix, **2** word prefix, **3** substring. It returns the matches best first as `{key: cmdline, name, tier, icon: iconUrl, subtitle: loc('#AppType_2'), data: {cmdline}}`. The list is read once per sheet presentation and kept in memory for that query only. **Top Hit rule (C1b's):** among Steam's library matches of the best tier, the most recently played; a program becomes the Top Hit only with a **strictly better** tier than Steam's best (`ctx.steamBest`). "half" → Half-Life: Alyx (every "Half-Life" title is tier 1, as is Half SBS Toggle; the tie goes to the game). "vlc" → the program VLC media player (Steam has no library match). As Top Hit, C1b's card shows the program's icon at 120 on a disc over a neutral glass gradient (no hero art exists), the name, the status "Software", and Open; it has no More circle, because Steam has no menu for a program | `rank`, slot `tophit` |
| S-B | **The Software cell** | When programs match, C1b's sheet draws Steam's header "Software" (`#AppType_2`) over **one 300 × 84 cell at the start of the Store row**: the best program that is not already the Top Hit, as a 56 px disc with its icon at 48 and the name in 24 Semibold, plus "and N more" (English only; "+N" in other languages) when N more programs match. The store keeps two cards beside it, then See All. The cell is **one target** (A or a click calls `open`): with one match, `actions.launchNonSteam(cmdline, ev)`, the same call as Steam's "+" row; with more matches, Home's Apps section with that program focused, where every program is one step away: `rt.home.reveal({section: 'apps', key})` sets the section and the remembered cell, then `nav.go('/library/home')` (never logged; it also works while Home is already showing). C1b's sheet tells `open` which cell it is by passing `{slot: 'software', more: N}` (REQ C2a->C1b #5); without that third argument `open` launches. No program left to show: no cell, and the Store row keeps its three cards. The cell is a fill inside the sheet's glass, never glass itself (VP P-45), and never pops (WN §4.9) | slot `software`, `open` |
| S-C | **X = primary action on library items** | On the Top Hit and on Steam's library posters in the sheet, X is Steam's primary action (Play / Install / Update) through `actions.primary(appid)`, shown in the ornament as Steam's "Play" (`#GameAction_Play`) with its X badge in gamepad mode. A still opens the game page. C1b's sheet declares it on its own items (WN §4.9), so this concept's provider adds no `primary`. On the Software cell X does nothing and the ornament shows only A and B (the quiet legend, `p2_home-apps_search.png`) | C1b's sheet |

**Field.**

- One spec everywhere: window-nav's 520 / 640 × 64 capsule, with **no microphone** (Steam has no dictation, WN D-8).
- On Home and folders, the field is window-nav's 60 px **circle variant** (§3.1, PLAN §1.9).

**Mockups.**

- `p2_window-nav_results.png` (C1b) is the results sheet for "half" with gamepad focus on the Top Hit: the scope bar with Steam's counts, Half-Life: Alyx as the Top Hit, Steam's next four library matches, the Software cell (Half SBS Toggle, its real icon) and Steam's first two store results.
- `p2_home-apps_search.png` (C2a) is the same sheet and data with gamepad focus on the **Software cell**: the cell takes the gamepad focus look (+ white .28, a .16 spot in the upper third, its arc); nothing lifts or pops (it is not a content card); the Top Hit is at rest without its More circle; and the ornament is the quiet legend (Open A, Back B), because a program has no X or ≡ action.

**Failure.** A provider that throws is disabled by C1b for the session; programs then do not appear in search, and Home › Apps and the "+" popup still launch them.

**Cross-concept record:** `concepts/xc-home-search.md` holds the agreement with window-nav.

---

## 7. Library catalogue (built by C2c)

**Owner:** C2c (PLAN §2.4).

**Routes.** `/library/tab/<id>` and `/library/collection/<id>` (Steam's) are glass mode `window` (PLAN §1.2), in window-nav's window:

- glass 1280 × 656, radius 54;
- toolbar row 108 (`html.lgs-hdr-108`; under `lgs-hdr-40` WN §3.2's fallback rules move every row below);
- bottom ornament 628–712 (WN §3.1–§3.4).

CSS-only look: WN §8.4's tint. Area rules key only on C1a's classes and variables (`lgs-hdr-*`, `--lgs-guard-top` / `--lgs-guard-bottom`, `data-lgs-glass`).

| Element | px [pt] | Material / fill | Tier |
|---|---|---|---|
| Toolbar row | window-nav's. Back circle: borderless on the library tabs (section roots), white .10 on `/library/collection/<id>`. Large Title "Library" at x 100 on section roots. Search 520 × 64 on section roots, 640 × 64 on collection pages (PLAN §1.9) | WN | C1a |
| Tabs | Steam's tab row as a segmented control (CTL §8.3, E-SEG). Track 64 [48] at y 116, padding 2. Segments contiguous (hit boxes abut), 60 tall, ≥ 140 wide; the visible fill is inset 2 px. Labels 22 px Semibold in Steam's text without its uppercase and tracking; counts Medium white .70 (dark .55 on the white segment). States: selected white .94 with a dark label; gamepad focus + white .28, a spot of .16 and the arc (on the selected segment: the outer glow, P-16); laser hover + .08 and the light spot. Steam's horizontal scroller keeps its 28 px edge fades. Steam's ‹ › arrows: 60 px plain circles at x 24 and 1196, y 118, 80 hit | Recessed track on glass | T1 (the row keeps its horizontal handlers, D2 §12) |
| VR sub-filter | Steam's `%{VRSubTabFilterContainer}` **in its stock position**, centred under the tabs at y 192: the same segmented control, 3 × 140 = 424 wide. Labels "All · VR · Non-VR"; Ready To Play: "All · Standalone · Remote PC" | Recessed track on glass | T1. Not moved: its nav position sits between the tabs and the grid |
| Grid | **Steam's geometry**: 172 × 258 posters, 6 per row, row pitch 300 (gap 42), radius 20, first row at y 270. Steam spreads the columns across its scroller (pitch 204 today). While the scrubber is mounted (T3 class on the grid), T1 adds `padding-inline-end: 72px` to `%{GridWithControls}`. Steam's grid then keeps 6 columns at a 189.7 px pitch (x 44–1164), and x 1196–1256 is free for the scrubber. **Optional T3:** 200 × 300, 5 columns (LQ2) | Content | T1 (styles only, D2 §12; the padding only with the scrubber) |
| Scroll guard | Steam's grid scroller gets a `scroll-padding-top` that keeps a focused poster below the pinned tab and sub-filter rows (y ≥ 270 with CQ1), and a `scroll-padding-bottom` that keeps it above `--lgs-guard-bottom` (612) (VP P-23) | — | T1 |
| The attention target (gamepad focus; laser after 80 ms of dwell, `.lgs-dwell:hover`) | **Lift:** `scale: 1.05` (the independent property; Steam's `transform` is untouched); shadow `0 6px 18px` black .50 (P-48 for +15 mm); white glow 30 px .16; the diagonal sheen (P4's `--lgs-ill: card`). **Timing:** under the laser, brightness changes at once; scale, shadow and depth start after the dwell (P-06). **Removed:** Steam's 2 px outline, its focus pulse (1.2 s × 20) and its shine sweep (P-42, P-52). **Badge:** Steam's compatibility badge, which Steam shows on hover and focus only, becomes a 36 px circle at the bottom right, inset 10. **No caption:** Steam shows none, and its 42 px row gap cannot hold one | Content; native: a +15 mm non-interactive crop over the window cover | T1 + T4 |
| The source of an open menu | Flat (0 mm) while its menu is open (PLAN §1.7 rule 6). It is marked by a CSS glow `0 0 26px 2px` white .18 and by its white More circle | Content | T1 + T4 |
| **More circle** | The shell's one-per-document helper (PLAN §1.11, WN §3.4.4). C2c registers posters: `__LGS_RT.more.register('%{LibraryItemBox}', {placement: 'card'})`. Size: **60 [45]** visible, **80** hit, inside the poster's top right (inset 10). Look: black .38 with a 10 px blur, white .94 while its menu is open. It follows the attention target, so it shows on gamepad focus and after the laser's dwell (parity, P-89), and it rides the poster's crop (no pop of its own) | Clear over the art | T2 (C1a's helper) |
| Letter scrubber | A 60 × 340 [45 × 255] recessed capsule (black .14) at x 1196, y 270–610. Letters 20 px Semibold white .70, condensed with 6 px dots; they are the first characters of the titles in the current sort (digits as "#"), so no string is added. The current letter sits in a 40 px white circle; hit 80 wide. **Laser:** a click or drag maps y to a letter and sets the grid scroller's `scrollTop` to that letter's first row (a wheel-equivalent; Steam's virtualizer renders the rows). **Gamepad:** passive (no focusable), the current letter follows the focused poster, and Steam's fast-scroll stays the pad path. Shown only for Alphabetical. A letter change plays Steam's own scroll sound through `rt.sound` (P-74) | Fill on glass | T3 behind `libScrubber` (default on with `wp.c2c`). It unmounts, and the padding goes, if Steam's grid does not keep 6 columns with gaps ≥ 16 |
| Bottom ornament | §7.1 | `liquid` (inset slab), depth 0 | T1 + T2 |
| "N apps hidden" notice | Steam's `%{AppGridFilterHeader}` with Steam's own text, as a 60 px quiet capsule (white .08, Callout 22 Medium white .70) above the grid. The button variant (`…AsButton`, clears the filter) is a 60 px text button (24 Semibold) with an 80 hit. Steam's two 1 px rules go (P-43) | Fill | T1 |
| Section headers (non-alphabetical sorts) | Steam's `%{AppGridSectionHeader}`: Title 3 28 px Semibold, Steam's text without its uppercase and tracking. Its 1 px rule goes; its sticky background becomes the toolbar's scroll-edge band | — | T1 |
| Missing art | Steam's title card restyled: a gradient tile with the title 22 px Bold | Content | T1 |
| Collections tab | Steam's collection tiles, radius 30. Label 20 px Semibold without uppercase or tracking; the count Medium white .70. Empty collections are tagged by T2 from Steam's collection data (`data-lgs-empty`) and dimmed to .62 by T1. Steam's 3D display case and order are kept | Content / fills | T1 + T2 |

### 7.1 The ornament in each input mode

Steam renders different controls per mode (INV-L §1.3, §6.1):

- **Laser mode** (`data-lgs-vr-mode="laser"`): the `%{SortAndFilterContainer}` pill (Sort with the current sort, Filter), plus the legend's Select and Back.
- **Gamepad mode:** the legend shows X Filter, Y Sort By, ≡ Options (only while a poster is focused), A Select and B Back.

**Default (PLAN R2-2, §1.10; D-C2c-12):** the ornament **hugs its members**, as on every other route (WN §3.4.1), and in laser mode Steam's `%{SortAndFilterContainer}` pill (Sort and Filter) is the **toolbar row's trailing group**, not an ornament member (C1a, WN §3.2): a page node in the ornament margin was cut by the window clip at y 656 and took no clicks there. In gamepad mode the same functions stay Steam's X and Y legends in the ornament. C2c's library text for these routes is C2c's (its log); the slot layout below is kept only as a variant.

**Five fixed slots** (variant behind C2c's flag `libFixedSlots`, off, PLAN §1.17 S28; inside WN's contract):

- widths 300 · 130 · 156 · 134 · 120 px, gap 4, padding 12, so **880 px in both modes**, centred at x 200–1080;
- members 60 tall at y 640–700;
- each slot's hit box takes its 2 px share of the gaps, so neighbours abut (P-07);
- the capsule's backing is the fixed slot rect, not the measured union of members, so its width never changes when Steam switches modes or drops a legend (C1a's API, C2c REQ-5);
- A and B are quiet trailing members in both modes;
- glyph badges show only in gamepad mode (P-26).

| Slot | Laser mode (`p2_home-apps_library.png`) | Gamepad mode (`p2_home-apps_library-pad.png`) |
|---|---|---|
| 1 Sort (300) | (`libFixedSlots` only) Steam's `%{SortAndFilterButton}` (sort), moved by T1 into slot 1 (WN §3.4.2): sort glyph and the current sort ("Alphabetical") | Steam's legend "Sort By", then C2c's T2 state span " · Alphabetical", then the Y badge. The span uses Steam's sort name from `AppGridDisplaySettings` and ellipsizes inside the slot; the longest name is "% of Achievements" |
| 2 Filter (130) | Steam's Filter button: filter glyph and Steam's "Filter" ("Filter: [icons]" when active) | Steam's legend "Filter" and the X badge. When advanced filters are active, C2c's T2 adds a count badge (a number) |
| 3 Options (156) | The shell's T2 Options member (C1a, WN §3.4.2): ⋯ glyph and "Options" (Steam's legend string). It acts on the frozen target (WN §3.4.3) with the More circle's dispatch, and is disabled (.38) without a target. There is no name suffix in this fixed slot: the More circle stays on the frozen target while the pointer is in the ornament, so the target is shown on its own poster | Steam's legend "Options" and the ≡ badge while a poster is focused. When none is (focus on the tab row), the shell's Options member shows disabled in its place, so the slot never empties |
| 4 Select (134) | Steam's legend "Select", quiet, label only | Steam's legend "Select" and the A badge, quiet |
| 5 Back (120) | Steam's legend "Back", quiet, label only | Steam's legend "Back" and the B badge, quiet |

- **While a modal is open** (Sort or tile menu, the Filters sheet, an alert):
  - In **laser mode**, Steam's pill stays a member, so the ornament stays the 880 capsule. During alerts and sheets it recedes with the window: a black .35 layer, as on the tab bar (WN §3.3.4). Steam's A and B legends, which now act on the modal, stay lit above it (`p2_home-apps_filter.png`). The Options member is disabled during any modal.
  - In **gamepad mode**, Steam's footer holds only A and B, so the ornament is the quiet legend (PLAN §1.10), its items keeping their slot 4–5 places.
- **Source of an open menu:** slot 1 (Sort) or slot 3 (Options) turns white .94 while its menu shows (WN §3.4.2).
- **Input mode:** read only through P3's accessor (`__LGS_RT.input`, `data-lgs-vr-mode`). Tests stub it with `rt.input.stub` (P10's `--mode`), never through Steam's getter (AT-14d).

### 7.2 The More circle on posters

The circle is the shell's helper (PLAN §1.11, WN §3.4.4). C2c only registers posters and owns the poster's lift and depth.

- **Node.** One decorative node per document. It is moved to the current attention target (gamepad focus, or the laser's dwell) and sits inside its `%{LibraryItemBox}` at the top right, inset 10. It is not focusable, so the gamepad keeps ≡.
- **Click.** A capture-phase listener stops `pointerdown`, `mousedown`, `mouseup` and `click`, so the poster never opens. The helper then calls the poster's own `onMenuButton` from its `Focusable` fiber props, falling back to Steam's `vgp_onmenu` (button 14) on the `%{LibraryItemBox}` (INV-L §0.3) [dispatch PROVEN].
- **Recycling.** Nothing is attached per poster, so the virtualized grid's recycling cannot duplicate the circle. If the target's node is recycled for another app, the helper hides until the next attention event (AT-14b).
- **Fallback:** the ornament's slot 3.

---

## 8. Menus: Sort and the tile menu (frames by C1c, content by C2c)

**Owner:** C2c for the library's content; the frames are C1c's (WN §5.1, PLAN §1.12).

Both are Steam's context menus (`BasicUIContextMenu`, INV-L §6.2, §7). **Anchoring** (T2 `translate`) is gated on WN AT-11, GP AT-MENU and SET CQ10: a click outside must still dismiss, and the D-pad must be unchanged. Until those pass, the menus stay centred and still morph from their source.

| | Sort | Tile menu |
|---|---|---|
| Items | 10 actionable sorts, plus Cancel | Install or Play (primary), Add to Favorites, Add to ›, Manage ›, Developer › (developer mode only), Properties..., plus Cancel. That is 6 actions on this device, 5 without developer mode |
| Layout (PLAN §1.12) | ≥ 8: **two columns**, column-major in Steam's order, rows 72 px 6 apart, a 40 px header row, 592 wide, about 508 tall | 6–7: **compact**, 60 px visible on a contiguous 64 px pitch, the game's name as an inline label (19 px Semibold), 400 wide, about 506 tall (`p2_home-apps_library.png`). ≤ 5: one column of 72 px rows with a 40 px header |
| Content | Steam's 10 sorts in Steam's groups; **the current sort carries a white check** (Steam's `.menuChecked`) | The primary row takes its semantic whole fill (Play green; Install and Update blue; Stop red). Submenus open beside the menu (8 px gap) and choose their own layout. Destructive rows follow the count rule (red label for ≤ 2, red glyph for more; red fill on focus); Steam's order and default focus are unchanged |
| Cancel | Steam's row as a 60 px quiet capsule, centred under the rows (HA-11, PLAN R2-5) | Same |
| Source and placement (T2) | Slot 1 (laser: Steam's Sort button; gamepad: the Y legend), white while open. The slab grows upward from the ornament with its bottom ≥ 12 px above it (y ≤ 616), clamped to the modal box | The More circle (white while open), the focused poster (≡), or slot 3. GP §3.4's order for sources in a page row: above; else right, 16 px from the poster; else left; else centred. Vertically centred on the poster and clamped to y 108–616 |
| Depth (PLAN §1.7) | +10 mm, non-interactive, appearing with the materialize (0 → +10 on `depth`); wearer profile +30 | Same. The source poster goes to 0 while its menu is open (rule 6) |
| Motion | `morph-open` 607 ms from the source's rect (clip-path, ≤ 600 × 600); `morph-close` 441 ms (glassd); no scrim | Same |

**The tile menu on Home and in folders** (C2a's sources): the card's More circle and ≡ on a game cell open the same Steam menu with the same handler. It takes the same layout and depth. Home is windowless, so there is no window cover for the menu's crop to lie in (PLAN §1.7 rule 1): C1c's menu slab is reported as a `thick` plate on windowless routes (`data-lgs-plate="thick"` on the menu box), so the +10 mm crop is covered (REQ C2a->C1c #3). Its placement follows GP §3.4's order from the card, clamped to y 98–704 (the top row stays clear; Home has no ornament). While it is open the card drops to 0 with its glow (rule 6).

---

## 9. Library Filters (sheet; frame by C1c, content by C2c)

**Owner:** C2c for the content; the sheet frame is C1c's (WN §5.4, PLAN §1.12).

**Frame:**

- ≤ 960 wide inside the 108–628 modal box (960 × 488 at (160, 128) in the mockup), radius 44, `thick`;
- a 60 px close circle at (24, 24), and Title 2 "Library Filters" (Steam's string) centred;
- the scrim is Steam's overlay restyled to black .35 (PLAN §1.8);
- depth +10 mm, non-interactive (+30 → +50 in the wearer profile);
- the ornament shows Steam's footer for the dialog, Select and Back (§7.1, "While a modal is open"). Steam has no Reset legend.

**Content** (T3: C2c's re-render of Steam's filter dialog, bound to Steam's own filter setters; every string is Steam's):

| Element | px [pt] | Notes |
|---|---|---|
| Reset | A 60 px text capsule at the sheet's trailing 24 px inset (WN §5.4 trailing action) | Steam's Reset handler |
| Compatibility | A grouped row (80, platter black .14, radius 30). "Steam Frame Compatibility" (Body 24 Medium) on the left; on the right a pop-up button (CTL §8.1: a 60 px capsule, value 22 Medium, Steam's caret) showing Steam's four compatibility icons for the chosen level and its name ("All Games") | Its value menu holds Steam's 4 options with their icons, the current one checked (CTL §8.2): ≤ 5 options, so one column of 72 px rows, anchored below or above the button. **Not a segmented control:** CTL §8.3 rules them out for labels over 16 characters ("Verified, Playable, and Untested" has 31) |
| Players, Play state | A section label 22 px Semibold white .70 (CTL §10). Below it, the options as **toggle capsules**: text buttons (PLAN §1.3), 60 visible, padding 24, 24 px Semibold, 12 px apart, with 80 px hit boxes that abut across the gaps (P-08). On = white .94, a dark label and a leading check. One row each: Players (4 options) and Play state (5, "Private" included, so there is no "N More" chip) | Steam's options |
| Collapsed sections | A platter of 80 px rows with 2 px separators (CTL §10): Hardware support, Features, Language, Genre, Store tags, Friends, Gameplay, Visual, Camera Comfort, Audio, Input. Each row shows its current value at the trailing edge, then a chevron. The value is Steam's names of the chosen options, or the dropdown's value ("Any language"), or nothing when none is chosen. A or a click expands the section in place: | Steam's sections and order |
| | • its options as toggle capsules, wrapping if needed; | |
| | • its dropdown as a pop-up row: Gamepad Support has 5 options (one column), Language about 29 (CTL C-D19's scrolling column); | |
| | • Store tags and Friends as 64 px text fields (CTL §9; the keyboard opens on activation only). | |
| Save as Dynamic Collection | Steam's "Save as ⚡ Dynamic Collection" as a 60 px capsule at the end of the content | Steam's handler |
| Scroll | About 1,280 px of content in a 384 px viewport (3.3 sheet heights), against Steam's 2,742 px dialog (5.3 heights of its 520 px box). The 56 px scroll-edge fade sits at the sheet's bottom edge | — |

**T1 fallback** (the type swap fails): Steam's dialog in C1c's sheet frame, restyled.

- The 4 compatibility radio rows become single-choice rows of 80 px in a platter, with a trailing blue check and Steam's icons.
- Each FilterBucket becomes a platter with its section header.
- Checkbox rows become 80 px rows with a trailing 40 px check circle (CTL §6.2, E-CHECK).
- Dropdowns become pop-up rows, and fields are 64 px.
- Reset and Save become 60 px capsules at the end, in Steam's order.

The scroll is longer; nothing is lost.

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

- Home and folders are `windowless`: the main surface reports no cover shape (`shapes: []`) and `plates` = every element tagged `data-lgs-plate="liquid"`: the 13 discs, the top-row controls (Back, the section control's track, What's New, the search circle; Back and search are Steam's nodes styled by C1a, which tags them as plates on every windowless route, REQ C2a->C1a #2), and the open card or name plate. Each carries a stable `data-lgs-plate-id` (`home-disc-<key>`, `home-top-<name>`, `home-card`, `home-plate`) so materialize and acks follow the element.
- glassd draws real `liquid` glass inside each plate at the cover's depth (+1 mm). Steam's panel is hidden there.
- Per page: 4 top-row + 13 discs + the card or name plate = **at most 18 plates** of the 32 allowed (the open card replaces its disc's plate). Peeks stay CSS only (no plate).
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
- **Admission** (PLAN §1.7): covered (the crop + 2 px lies inside its plate); click-safe (rule 2: the smallest focusable a disc's crop touches is its own 200 × 180 cell, s = 180, and P6's reporter, which counts only focusables inside the crop, finds none and applies no cap; the card contains Play's and More's 96 px hit elements, s = 96 ≥ 78 for +15 mm at r = 1, and down to r = .81; HA-15); containers only (disc 132, card 320 × 240, name plate ≥ 60 × 60 capsule); still (no pop while `lgs-home-moving`, and while a menu is open only the menu pops, rule 6); ≤ 4 depths at rest ({0, +15, +25}, or {0, +10, +25} with a menu open).
- **Rule details (`theme/layers/41-home.json`, round R2):** the disc and the name plate pop as a circle / capsule (`r: "capsule"`; the disc's 50 % radius read as 50 px gave a squircle over its round plate, sgcheck R1); the name plate takes no pointer events, so its rule sets `hitTest: false`; the card appears at +15 at once (`fromMm: 15`), so the depth does not change while the disc morphs into it; the open card and the name plate carry their own `data-lgs-mosaic` band, so a card kept flat by rule 6 still shows its content outside the row bands. The legacy `tab-arrow` rule (4.43 mm, outside the allowed set) is superseded while `wp.c2a` is on, and What's New draws its tab track on the tab row's `::before`, which the legacy `tabs` rule does not match.
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
| Library window, ornament | 0 | 0 | 0 | — | window-nav (cover; ornament inset slab, WN D-7) |
| Library attention-target poster (and its More circle) | +15, non-interactive (the reporter's click-safe cap may lower it to +10) | +15, interactive | 0.0407 | `0 6px 18px` /.50 (P-48) | Crop over the window cover |
| Source poster while its menu is open | 0, with a CSS glow (rule 6) | 0 (rule 6 holds in both profiles) | 0 | CSS glow | — |
| Menus (Sort, tile menu) | **+10**, non-interactive, 0 → +10 on `depth` | +30 | 0.027 (wearer 0.081) | Thick glass, slab shadow `0 4px 12px` | Crop + `thick` slab (over Home: inside its own `thick` plate, §8) |
| Filters sheet | **+10**, non-interactive | +30 → +50 | 0.027 (wearer 0.081 → 0.136) | Scrim .35 (Steam's overlay, PLAN §1.8; no `t1` tint) | Crop + `thick` slab |
| Home card while its menu is open | 0, with its CSS glow (rule 6: only the modal pops) | 0 | 0 | Disc glow 26 px | Its plate stays (no occluder) |

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
| Section change (LB/RB, segment) | Pill travel `snappy` 488 ms; old grid fades `page-out` 150 ms linear (a non-interactive copy of the old grid kept until its `animationend`); new grid `page` 662 ms with 16 px parallax in the travel direction | M1: no lateral slide over 24 px. Sound `'tab'`. No pop during it |
| Page change | As a section change; the active dot moves on `snappy` | Sound `'page'` |
| Attention on a cell | Gamepad: `hover-in` 294 ms at once (out `fade` 441 ms). Laser: brightness at once; scale and depth after 80 ms of dwell; depth on `depth` 441 ms | Retarget, never queue (C5) |
| Name plate | After 0.4 s: `materialize-in` 250 ms; out `materialize-out` 350 ms (a closing copy kept until its `animationend`) | Bottom clamped at y 704 |
| Card ramp | After 0.8 s: `morph-open` 607 ms (clip on b0, MO §6.4); the disc fades on `materialize-in`. Close: content `materialize-out`, the clip back into the disc on `morph-close` 441 ms, the glass on `materialize-out`, the disc back on `fade` (laser 0.3 s after leave; gamepad at once) | Native: the plate's phase ramp under the crop (§10.2) |
| Press | `interactive` 210 ms swell ≤ ×1.06 (glass only); release glow 90 ms; `snappy` swell back | |
| Open a folder / What's New | Route `page` 662 ms; the folder disc's plate materializes out and the new page's plates materialize in | No zoom over 1.5 % |
| "+" popup | `materialize-in` 250 ms / `materialize-out` 350 ms | C2b |
| Menus | `morph-open` 607 / `morph-close` 441 (C1c); depth 0 → +10 on `depth` | — |
| Filters sheet | `sheet-in` 735 / `sheet-out` 514; scrim on `fade` (C1c) | — |
| Library tab switch | C1c's `23-transitions.css`: ±16 px + fade on `page`, replacing Steam's ±40 % slide | Timing only |
| Poster lift | In `hover-in` 294 ms, out `fade` 441 ms; laser after 80 ms of dwell; depth on `depth` (P7) | Rows and tabs never scale (C2c) |
| More circle | P5's `lgs-mat-*`: materialize 250 ms, dematerialize 350 ms | C1a's helper |
| Scrubber | Current letter on `snappy`; appears with the materialize | C2c |
| At rest | Nothing animates: `getAnimations()` has nothing running and no `lgs-*` animation one second after any interaction | C7, PLAN §1.5 |
| Reduce Motion | Fades of 150–200 ms only (`--lgs-d-reduce`); depth pushed once at the end; morphs become cross-dissolves; the discs' lift glow, focus light and label colour change at once | C8, VP P-56 |

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
| L1 | Switch tab (All Games, Great On Frame, Ready To Play, Collections, Non-Steam, Soundtracks, conditional tabs) | Steam's tab row as a segmented control; the same sets as the Home › Collections folders | Click a segment or a ‹ › circle | LB / RB; or Up to the row + Left/Right | C2c | AT-6, G-PAD |
| L2 | VR sub-filter All / VR / Non-VR (Ready To Play: All / Standalone / Remote PC) | Steam's control in its stock position, as a 64 px segmented control [T1] | Click a segment | Up from the grid + Left/Right + A (stock) | C2c | AT-6, G-PAD |
| L3 | Browse the grid | Steam's virtualized grid, restyled; the attention target lifts | Wheel/drag scroll; an 80 ms dwell lifts | D-pad; Steam scrolls focus into view (guard 124–612) | C2c | G-PAD, AT-14(b) |
| L4 | Fast scroll by letter | Steam's fast-scroll overlay (unchanged) + the letter scrubber [T3] | Click/drag the scrubber (**new**) | Steam's fast-scroll; the scrubber shows the position (passive) | C2c | AT-14(c) |
| L5 | Open a game | Poster activation | Click | A | C2c | AT-6 |
| L6 | Sort (10 options, persisted) | Ornament slot 1, the current sort shown in both modes → Steam's Sort menu as the two-column grid, the current sort checked | Click slot 1 (Steam's laser-mode Sort button) | Y | C2c | AT-6 (Sort snippet), AT-14(d), AT-14(f) |
| L7 | Filter | Ornament slot 2 → the Library Filters sheet (§9) | Click slot 2 (Steam's laser-mode Filter button) | X | C2c | AT-15 |
| L8 | Tile menu | The More circle on the attention target [T2, C1a's helper]; ornament slot 3 Options [T2, C1a] | Click the More circle (**new direct path**) or slot 3 (frozen target) | ≡ | C2c (registers), C1a (helper) | AT-14(a), AT-14(d) |
| L9 | "N apps hidden due to filter" (the button variant clears) | Steam's notice as a 60 px capsule above the grid | Click | Focus + A | C2c | AT-6 |
| L10 | Back | Toolbar Back circle (WN) | Click | B | C1a | WN AT (E-BACK) |

### 12.3 Game tile and its menu (LA A.3)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| T1 | Primary action Play / Install / Launch / Download / Update | First menu row with its semantic whole fill (compact or one-column layout by count); the Home card's Play capsule; search X (S-C) | Click | ≡ → A; **X on a Home cell or a search item** | C2a (card, X), C2c (menu source), C1c (menu look), C1b (search X) | AT-4 (identity against Steam's tile-menu Play), AT-13 |
| T2 | Add to / Remove from Favorites | Menu row | Click | Menu + A | C1c | AT-6 (capsule menu snippet) |
| T3 | Add to › (collections, New collection…) | Submenu beside the menu | Click | Right / A | C1c | AT-6 |
| T4 | Manage › | Submenu | Click | Right / A | C1c | AT-6 |
| T5 | Developer › | Submenu (developer mode) | Click | Right / A | C1c | AT-6 |
| T6 | Properties… | Menu row | Click | A | C1c | AT-6 |
| T7 | Cancel | A 56 px quiet capsule under the rows; click outside (Steam's dismiss) | Click | B | C1c | AT-6, G-PAD |
| T8 | Status on the tile (compatibility, download progress, update, friends playing, coming soon, locked, copies, missing-art title) | Library: Steam's badges restyled; Home: icon states + card (§3.3) | Look | Look | C2c (library), C2a (Home) | AT-1, AT-6 |

### 12.4 Library Filters (LA A.4)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| F1 | Frame compatibility level (4, persisted) | A pop-up row at the top of the sheet → its 4-option value menu [T3]; single-choice rows of 80 px [T1] | Click the pop-up, then an option [T3]; click a row [T1] | A, then D-pad + A [T3]; Up/Down + A [T1] | C2c | AT-15 |
| F2 | 47 checkboxes in 11 sections + the Gamepad Support and Language dropdowns | Players and Play state as toggle capsules; the other sections as collapsed rows that expand in place into capsules and pop-up rows [T3]; Steam's rows at 80 px with check circles and pop-up rows [T1] | Click | D-pad + A | C2c | AT-15 |
| F3 | Store tags / Friends text search | 64 px fields inside their expanded rows | Click → keyboard | Focus + A → keyboard | C2c | AT-15 |
| F4 | Reset | The sheet's trailing capsule [T3]; Steam's button at the end [T1] | Click | D-pad Up to the header + A [T3]; D-pad + A [T1] | C2c | AT-15 |
| F5 | Save as Dynamic Collection | A 60 px capsule at the end of the content | Click | D-pad + A | C2c | AT-15 |
| F6 | Close | The sheet's close circle (C1c) | Click | B | C1c (frame) | AT-15, G-PAD |

### 12.5 Collections, Non-Steam, Soundtracks (LA A.5, A.6)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| C1 | Browse collections | Home › Collections folders (empties grouped); the Library Collections tab (rounded tiles, empties dimmed through a T2 tag) | Click | D-pad + A | C2a (Home), C2c (tab) | AT-1, AT-6 |
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
| S2 | Open a result | window-nav's sheet and Steam's grids; **programs: the Top Hit and the Software cell [T3, S-A/S-B]** | Click | D-pad + A; X = Play on library items (S-C) | C1b, C2a (provider) | WN AT-9, AT-13 |
| S3 | "View more in the Store" | Steam's Store grid, via window-nav's Store section | Click | Focus + A | C1b | WN AT-9 |
| S4 | No results | Steam's "No Results Found", restyled (WN) | Look | Look | C1b | WN AT-9 |

### 12.7 The "+" popup (LA A.8)

| # | Function | New place | Laser | Gamepad | Owner | Test |
|---|---|---|---|---|---|---|
| P1 | Open the list | Steam's + button (white while open) | Click + | View → bar, Left/Right to +, A | C3a (button), C2b (popup) | AT-12 |
| P2 | Launch a program (24 rows, 23 programs + the switch) | 4-column grid in the popup, all visible [T1/T3]; Home › Apps [T3]; search Top Hit and Software cell [T3] | Click a cell | D-pad + A | C2b, C2a (Apps, search) | AT-12, AT-4, AT-13 |
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
| SN-F1 | Footer legend actions (X Filter, Y Sort By, ≡ Options, A Select, B Back) | window-nav's bottom ornament; library routes: the five fixed slots per input mode (§7.1); legends never hidden | Click the slot: Steam's laser-mode Sort and Filter, the shell's Options member, Steam's Select and Back legends | The physical button | C1a (ornament), C2c (slots) | AT-14(d), PLAN-1a-1, PLAN-2c-1 |

**Count:** 60 functions (53 from LA §A + 7 from SN §A: H1–H4, N2, N3, F1); 60 mapped, 0 dropped, each with a laser path, a gamepad path, an owner and a test. A.10 states are covered in §3.3 (Home) and §7 (Library).

---

## 13. Implementation tiers, evidence and fallbacks

| Element | Tier | Evidence | Status | Fallback |
|---|---|---|---|---|
| Home route override | T3 (P2 `routes.override`) | SR §3.5: our page rendered at `/library/home` with controller focus; `clearOverrides()` restored Steam's Home (774 nodes). SR §5: 90 fps, 43 nodes | PROVEN | Steam's Home, T1 restyle, `window-full` (§3.7) |
| Footer hidden on Home and folders the way Steam's Home hides it (never by CSS) | T3 (Steam's `FooterStore.HideFooter()`, the call of Steam's `useHideFooter` hook) | LA B.3; live 2026-10-07: stock Home and our Home, folders and What's New render no `#Footer` (C2a log M3-F1) | PROVEN | Steam's footer shows as C1a's ornament; the page drops to two honeycomb rows (`lgs-home-footer`, §3.2) |
| Glass mode from the override (`glassMode('home')`) | T2 (C1a's hook, REQ C2a->C1a #1) | WN §3.1.1 offers the same hook to C5a and C3b | Interface requested | Without it, WN's map makes Home `windowless` even when the override failed (Steam's Home over the room with no glass): C2a's `41-home.css` then keys its T1 restyle of Steam's Home on `[data-lgs-route="home"]:not(:has(.lgs-home))` and draws a window-full tint itself |
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
| Search contributions (S-A, S-B; S-C is C1b's) | T3 provider registered with C1b's `LgsSearch` (`rt.search.addProvider`) | C1b's announced interface (`docs/phase2/wp/C1b.md`); WN §4.10 (override of `Routes.Search.Root()`, SR §3.5 mechanism) | Depends on WN AT-9 and C1b M3 | Programs not in search; Home › Apps and "+" remain |
| Library ornament slots | T1 + T2 (C2c) | WN §3.4 (ornament from `#Footer`); the laser pill is laser-only, so moving it cannot change D-pad order (INV-L §6.1); fixed backing through C1a's API (C2c REQ-5) | PLAUSIBLE | Steam's pill and legend restyled in place, in the capsule material (WN's no-T2 fallback) |
| More circle on posters | T2 (C1a's helper) | The host's `onMenuButton` (SM-D15); the `vgp_onmenu` dispatch opens the capsule menu (INV-L §0.3) | Dispatch PROVEN; capture-phase isolation PLAUSIBLE | Ornament slot 3 |
| Letter scrubber | T3 + a T1 padding (C2c) | `scrollTop` on Steam's grid scroller (a wheel-equivalent); the 6-column check after the padding | PLAUSIBLE | Steam's fast-scroll; wheel and drag |
| Larger posters (200 × 300) | T3 (C2c) | LA LQ2 (props of Steam's CSSGrid) | UNPROVEN | Steam's 172 × 258 (the baseline shown) |
| Anchored menus | T2 (C1c) | WN AT-11, GP AT-MENU, SET CQ10 | UNPROVEN | Centred menus that still morph from the source |
| Filters content | T3 (C2c) | Type swap of Steam's filter dialog component (SR §3.4 technique) | PLAUSIBLE | T1 restyle of Steam's dialog (§9) |

---

## 14. Acceptance tests (agents only)

**General rules:**

- Every live step runs inside the locked lab commands (`docs/phase2/contracts/lab.md`, LAB.md), with this package's runtime on only for the step: `--flags wp.c2a` (plus `wp.p3` while P3's flag is off). Input modes come from the stub: `--mode laser` or `--mode pad` (P10), never Steam's getter.
- **Launch calls are logged, never executed.** They go through P2's `rt.react.actions` (`launchNonSteam`, `primary`, `desktopWindow`, `navigate`), whose test mode is on whenever `actionsLive` is not true, the action logger is on, or the event is synthetic (`contracts/react.md` §8). Tests read `actions.log`.
- Before any gamepad sequence: `L.root()` (`FocusApplicationRoot()`, SR §4). After any synthetic hover: `L.unhover()` (pointer to 1400, 900).
- Native steps run only inside `python glass.py native-session` (PLAN §7). `hv` frames are looked at and deleted (LAB never-list).
- Evidence: `docs/phase2/wp/C2a.md`, with the command, the result, the shot or JSON names (`shots/p2_c2a_<what>.png`, filmstrips `shots/p2_motion_c2a_<interaction>_<f>.png`), the date and the Steam build.
- **Library filter state (C2c's tests):** filters and sorts are persisted (`AppGridDisplaySettings`, `collectionsAppFilterVR`, the compatibility level). Tests **never** select a sort, a filter option, Reset or Save. Activation goes through P2's action logger or a spy on Steam's setter, which logs `{fn, arg}` and does not run (never-list).
- **Home never launches in a test.** X, Play, A on a program or window, and the Software cell are clicked only with synthetic events or with `actions.test(true)`, so `actions.log` shows `mode: logged`.
- The global gates of PLAN §4.1 run on `/library/home` (Recent, Collections, Apps), `/library/lgs/folder/<id>` and `/library/lgs/steamhome`, in both input modes, CSS-only and native: `python glass.py gates main --route R --mode laser|pad --flags wp.c2a`, `pad-bfs`, `focus`, `motion`, `sgcheck`, `hv`. The tests below add what the gates do not cover.

| ID | Package | What | How | Pass |
|---|---|---|---|---|
| AT-1 | C2a | Home renders | `python glass.py shot main p2_c2a_home_recent --route /library/home --flags wp.c2a` (and `_collections`, `_apps` with the segment clicked in the pre; `p2_c2a_folder` on `/library/lgs/folder/<VR id>`) | 13 cells, 2 dots, top row with 3 segments + What's New + search circle; side by side with `p2_home-apps_home.png` (same 12 games, same order); `#Footer` visibility equals stock Home's, on Home and on the folder route (if a footer shows, `lgs-home-footer` is set and the honeycomb has two rows, §3.2); no legend node has `display: none`; `data-lgs-glass="windowless"`, `data-lgs-route="home"` / `"folder"` |
| AT-2 | C2a | Geometry | `glass.py js` reading rects | Column pitch 224 ± 2, row pitch 188 ± 2, disc 120; Back box (14, 14, 80, 80) and search box (1186, 14, 80, 80) ± 2; section track y 22–86, segments contiguous (gap ≤ 2), each ≥ 60 × 140; the 4 top-row centres ≥ 80 apart; `elementFromPoint` at (640, 30) hits the section control (else the fallback layout, §3.1.1) |
| AT-3 | C2a | Gamepad traversal | `L.pad` from cell 1: (a) Right ×3; (b) every cell reachable (`glass.py pad-bfs --route /library/home`); (c) for each cell, Down-Up and Up-Down return to it; (d) Right at row 1's end → page 2, row 1; (e) RB → Collections, LB back; (f) LT/RT page (skip if not delivered); (g) Left at page 1's left edge → `.gpfocus` in `frame.menu`; (h) B at root → Steam's own handling, as on stock Home (history back; the tab bar without history); **(i)** RB from Apps wraps or stops without entering What's New; on `/library/lgs/steamhome`, RB changes Steam's feed tab and B returns to `/library/home`; **(j)** **D-pad only**, no LB/RB/LT/RT: reach every section (Up to the row, Left/Right, A) and every page (Right past row ends); (k) route entry focus on cell 1 (VP P-22) | All pass; `L.focused('main')` never empty inside the page |
| AT-4 | C2a | Launch wiring (action logger) | Click (synthetic, so logged) and A on: a game (expect `navigate('/library/app/<id>')`); a game's X and the card's Play (expect `primary(appid)`, and `actions.handler('primary')` identical to Steam's tile-menu Play handler for that app); the card's More and ≡ (expect the same handler, Steam's tile menu); a program (expect `launchNonSteam` with the same `strCmdline` as Steam's popup row of that name); a window (`desktopWindow`); a folder (route becomes `/library/lgs/folder/<id>`, nothing logged); All Games (`navigate('/library/tab/AllGames')`); What's New (route `/library/lgs/steamhome`) | All logged calls equal Steam's; `mode` is `logged` for every launch |
| AT-5 | C2b, C2a | Switch safety | (a) T1 only and T3 on: `glass.py js` finds the row whose text is exactly "Liquid Glass" in `barpopup` after the OPEN pre (INV-B §0.3) [C2b]; (b) Home › Apps lists no cell named "Liquid Glass" [C2a]; (c) the search sheet for "liquid" shows no program for it, neither as Top Hit nor in the Software cell, and `rank('liquid')` of our provider returns nothing for it [C2a, with C1b]; (d) T3 popup: the first `.gpfocus` after opening by gamepad is the first program cell, not the toggle row [C2b]; (e) the toggle row while main is on `/library/lgs/folder/…` logs `Navigate('/library/home', replace)` **before** the launch [C2b] | All pass |
| AT-6 (Home part, C2a) | C2a | No functional loss | `glass.py gates main --route /library/lgs/steamhome --only aud` against stock `/library/home`'s Steam nodes (the override moves them there; needs P10's stock-route option, REQ C2a->P10 #4), and `gates` on `/library/home` and a folder for our nodes plus Steam's Back and search (E-BACK) | 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST outside PLAN §1.16's exemptions (search circle: WN AT-4) |
| AT-6 (library part, C2c) | C2c | No functional loss | `glass.py audit main --route /library/tab/AllGames` with `--mode laser` and `--mode pad`; the same on `/library/tab/Collections`, `/library/tab/DesktopApps` and `/library/collection/<VR id>`; and on AllGames with `--pre` the Sort snippet, the capsule-menu snippet (`vgp_onmenu`) and the Filter snippet (INV-L §0.3), each in both modes, with `wp.c2c` off and on | 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST, apart from §1.16's E-SEG and E-MENU. No legend node has `display: none`. The laser-mode glyph collapse is not counted (WN §3.4.2) |
| AT-7 (Home part, C2a) | C2a | Sizes and type | `glass.py gates main --route /library/home --only size,type` (and a folder) + a rect scan of the card | Every focusable meets G-SIZE or its exemption (E-SEG on segments, E-BACK); card Play/More hit elements 96 tall, non-overlapping, centres ≥ 145 apart (186 with the English label); More 60 visible with a 96 hit; no text < 18 px; no uppercase, italics or positive tracking in chrome |
| AT-7 (library part, C2c) | C2c | Sizes, type, outlines | `glass.py gates main --route /library/tab/AllGames` in both modes, bare and with each of the three `--pre` snippets | **G-SIZE:** every focusable ≥ 80 × 80 or its exemption (segments: E-SEG, ≥ 60 × 140 and contiguous; menu rows: E-MENU). The More circle is 60 visible with an 80 hit, fully inside its poster (WN AT-26). The scrubber is 60 visible with an 80 hit. Ornament members are 60 tall with abutting hit boxes. Toggle capsules are 60 visible with an 80 hit. Filter rows are 80. **G-TYPE:** no text under 18 px, no weight under 500, no uppercase, tracking > .01 em or italics in chrome (tab labels, the sub-filter, section headers, collection labels, legends). **G-OUTLINE:** no outline or 1 px ring on posters, tabs, the ornament, menus or the sheet |
| AT-8 | C2a | Attention ramp (both inputs, one mechanism) | (a) `--mode pad`: focus a game by `L.pad`; shots at 0.5 s and 1.5 s: no card, then card; `--mode laser`: `L.hover('main', <disc>, 1500)`, the same two shots; (b) jitter: two moves within 0.3 s (pad), and a laser sweep at 45 ms per disc: no `.lgs-dwell`, no lift, no card; (c) leave: laser card gone ≤ 0.3 s + 441 ms after `L.unhover()`; pad card starts closing at the next `L.pad` and is gone ≤ 441 ms later; (d) static: `41-home.css` has no `:hover` selector that shows the card or plate; the card's state is set only from `rt.attend` (`lgs-attend-*` classes or `onStep`/`onLeave`) and `rt.attention.feed`; (e) rects: the card overlaps no other disc by more than 16 px, except a row-1 card in the low layout (62 px, D-C2a-9), and every disc and label it overlaps is cut away under it (clip-path); its Play centre is within 400 px of x 640 (P-29); (f) after the card opens, a synthetic click on Play logs `primary` and the route does not change; (g) laser: no `scale` above 1 on a disc before `.lgs-dwell` is set (VP P-06) | All pass |
| AT-9 | C2a | Motion | `glass.py motion main --route /library/home --pre <ramp> --name c2a_ramp`; the same for a section change, a page change and an attention move | Every duration and easing a P5 token; 0 animations at rest 1 s after; route entry ≤ 800 ms; filmstrips `shots/p2_motion_c2a_ramp_<f>.png` at f = 0, .15, .35, .5, .75, 1 show glass before content, no text scaling, no closed outline |
| AT-10 | C2a | Depth (native) | In `native-session`: `__LGS_SG.dump()` and the reporter's `debug()` with a cell attended (pad and laser), with the card open, with a name plate, and with the card's menu open | The attended item at 15 mm ± 0.5 (converted with the live S, r: 0.0471 u at r = 0.863), `interactive: false` in the default profile; only the attended item's crops on Home (the disc, or the card, or the disc and its name plate); with the menu open, only the menu's crop (+10, inside its `thick` plate) and the card at 0 (rule 6); with `--flags interactivePops`: the same crops `interactive: true` |
| **AT-10b** | C2a | **No ghosts (static)** | `glass.py sgcheck --route /library/home` (attended cell, open card) and on a folder | R1 covered (each pop + 2 px inside its plate), R2, R5, R7, R8, R9 hold; mosaic pieces only inside the declared bands, covering no Steam texel with alpha > 0.05 outside a plate; ≤ 32 plates |
| AT-10c | C2a | No ghosts (look) | `glass.py hv home_attended --offaxis 30 --look` with a cell attended, and once during the card ramp (look, then delete) | One copy of the icon; its plate visible beside it as glass; labels single; no doubled card in the ramp frame |
| AT-11 | C2a | Performance | `glass.py perf main --route /library/home --pre <page through 10 pages>`; GPU time from `glassd-out.json`; `img.naturalWidth` of visible icons | fps within 5 % of stock, no frames > 34 ms; heroes decoded only for the visible page and the open card; program icons at 64 CSS px from ≥ 64 px sources; glassd ≤ 2.5 ms (GL-3's Home scene) |
| AT-12 | C2b | "+" popup | OPEN pre, then `L.pad` inside `barpopup`: every cell reachable; Down-Up returns; B closes; rect scan | Computed `display` of the list is `grid` with 4 columns; with 23 programs and no extra groups, every cell's rect lies inside the scroller's client rect (no scroll); every label ≤ 70 px wide and ≤ 2 lines; no label cuts a glyph: a name that does not fit ends in "…" (PLAN §1.16 E-GRID (labels)); the name plate stays inside x 0–300 |
| AT-13 | C2a, C1b | Search contributions | WN AT-9 steps with `--flags wp.c1b,wp.c2a`: 'half', 'vlc', 'liquid'; `rt.search.providers()` | 'half': the Software cell lists "Half SBS Toggle"; A on it logs `launchNonSteam` with Steam's `strCmdline` for that row; X on the Top Hit logs `primary(546560)` (C1b's sheet). 'vlc': the Top Hit is the program "VLC media player" (tier 1 against no Steam match), Open logs its launch, and no Software cell repeats it. 'liquid': no Top Hit or Software cell for Liquid Glass. `providers()` lists `c2a.programs` with `failed: false` and every `rank` call ≤ 2 ms |
| AT-14 | C2c | Library | (a) **More circle:** under `--mode laser`, `L.click` on the More circle over a poster. (b) **Recycling:** scroll the grid 2,000 px and back (`scrollTop`, a wheel-equivalent). (c) **Scrubber:** under `--mode laser`, click "M"; under `--mode pad`, 5 × `L.pad` Down. (d) **Both modes:** `--mode laser`, then `--mode pad`, on `/library/tab/AllGames`: shot and audit each; click every slot through the action logger and spies (Sort and Filter open Steam's menu or dialog, which is then closed with B; Options logs its dispatch; A and B log Steam's legend dispatch). (e) **Depth** (M4, in `glass.py native-session`): `glass.py sgcheck` with a poster focused (pad) and dwelt (laser), then with the tile menu open, then with the Filters sheet open. (f) **Sort label:** open the Sort menu (look only) | (a) The route is unchanged; the menu's labels equal those ≡ opens on the same poster; the log shows the host's `onMenuButton` (or the `vgp_onmenu` fallback); the menu is closed with B, never by an item. (b) At most one More node in the document; it is hidden or inside the current target's `%{LibraryItemBox}` (same appid), never on another poster. (c) Laser: the first fully visible poster's title starts with the first letter ≥ "M" that exists. Pad: the scrubber has no focusable, and its current letter equals the focused poster title's first letter. (d) The ornament is 880 ± 1 px wide in both modes (PLAN-2c-1); all 5 slots are present; every slot's click is handled. (e) One pop at +15 mm (0.041 ± 0.005 u at r = 1; +10 if the click-safe cap applies) with `interactive: false`. With the menu open: the menu at 0.027 u and the source poster not popped (rule 6). With the sheet open: the sheet at 0.027 u and nothing else. ≤ 4 distinct dz on the route. Each lift's shadow within P-48. (f) The checked row equals slot 1's label in both modes |
| AT-15 | C2c | Filters | (a) The Filter snippet in both modes, then `L.pad` through every control of the sheet, T3 and T1. (b) `glass.py audit main --pre <Filter snippet>` in both modes, T3 and T1. (c) The sheet's crop (M4). (d) Spies: activate each toggle capsule, pop-up option, Reset and Save through the action logger. (e) Rect scan of the sheet | (a) Every control is reachable; Down-Up returns; B closes the sheet and focus returns to its source (slot 2, P-21). (b) 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST; in T3 every Steam filter control has a twin bound to the same setter: the compatibility level, the 47 options, 2 dropdowns, 2 text fields, Reset, Save. (c) The sheet at +10 mm (0.027 u), `interactive: false`, and no other pop. (d) Every call equals Steam's own row's setter and arguments (identity check), logged, not run. (e) The sheet is ≤ 960 wide inside 108–628; the close circle is at (24, 24) of the card; toggle capsules are 60 visible with 80 hits; rows are 80; text ≥ 18 px; the T3 content is ≤ 1,400 px tall |
| AT-16 | C2a | Removal | `lgs off` path: `remove()`; navigate `/library/home`; `glass.py status` | Steam's Home (774 nodes ± 5 %); no `[class*=lgs]` nodes and no `data-lgs-*` attributes; history entries under `/library/lgs/` fall back to Steam's library; no scene-graph nodes (G-REMOVE) |
| AT-17 | C2a (others for their surfaces) | Headset view | One `hv` frame each of Home, the "+" popup, the catalogue with a menu, and the Filter sheet (look, then delete) | Labels legible over the room; glass L 55–110, 70–90 under the card's text; no closed outline on any glass edge |
| AT-18 | C2a | Accessibility | `gates` with `--media reduce` and `--media contrast` on `/library/home` with the card ramp in the pre | Fades only (≤ 200 ms); near-opaque plates with the 2 px edge; contrast audit clean |
| AT-19 | C2a | Real-data parity of the mockups | Re-run `fetch-library-refs.py` (C2c's), re-render every mockup, compare names and order with AT-1's live shot | Same names, same order; differences explained by real changes in the library |
| AT-20 | C2a | Input modes and states | CSS audit of `41-home.css`; `glass.py focus main --route /library/home --pairs <file>` in pad mode; DOM in both modes | Every laser look in `41-home.css` is keyed on `:hover`, `.lgs-dwell` or `lgs-attend-*` under `html.lgs-input-laser`, never on `.gpfocus` alone (VP P-01, P-02); glyph badges only under `data-lgs-vr-mode="gamepad"` (P-26); exactly one lit cell in pad mode at rest (P-13); G-FOCUS on the section control: focused segment ≥ rest + 40 L, the white selected segment's glow band ≥ +20 L (P-14, P-16) |
| AT-21 | C2a | Sounds | Section change (RB, and a segment click), page change, A on a cell, and a laser sweep, with `PlayAudioURL` intercepted | Section change requests ChangeTabs (20), page change PagedNavigation (15); every D-pad move in the grid requests BasicNav (24, `deck_ui_misc_10`) exactly once, as stock Home does; a dead end requests FailedNav (25); no request of ours during the laser sweep (VP P-74, P-79) |
| AT-22 | C2a | Fail closed | Break a required finder through P2's test hook (RX-5 method) in a locked step, then `lgs on` | `41-home` reported failed in `lgs status`; `/library/home` is Steam's Home in `window-full` glass; no `/library/lgs/*` route; every Home function works (spot check H2, H5) |
| AT-23 | C2a | Strings | With our language accessor stubbed to `de` in a locked step (never Steam's setting) | No English string of §3.8's "without a token" rows is drawn; the glyph variants show |
| PLAN-2a-1 | C2a | Looks like the design | Native off: `python glass.py cmp docs/phase2/mockups/home-apps-home-t1.html shots/p2_c2a_home_t1.png --id C2a --name home_t1` (mapping in `docs/phase2/wp/C2a-cmp.json`; mockup `data-id`s on the top row, cells, dots and card). Native on: `hv` look | Named rects within ± 8 px, or the difference explained in the log; the agent views both and records a verdict. Native: one copy of each icon, plate glass beside the lifted disc |

C2c's card tests also stay: PLAN-2c-1 (ornament 880 ± 1 in both modes), PLAN-2c-2 (`glass.py cmp` against `home-apps-library.html`, `-library-pad.html` and `-filter.html`, with `docs/phase2/wp/C2c-cmp.json`), and G-PAD on AllGames, including Up to the sub-filter and the tab row and back.

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
| 12 | window-nav's laser-mode ornament dropped the A/B legends that Steam renders in laser mode | Resolved by PLAN §1.10: A and B are never hidden; the library keeps them in slots 4–5 in both modes |
| 13 | The override could change the footer's visibility on Home | `ui.Page` with Steam's footer props; AT-1 checks; the quiet legend is the fallback (§3) |
| 14 | G-AUD compares a route with its stock self; on `/library/home` the override moves Steam's Home nodes to `/library/lgs/steamhome` by design | AT-6 audits them on `/library/lgs/steamhome` against stock Home; needs a stock-route option in P10's `gates`/`audit` (REQ C2a->P10 #4) |
| 15 | The card ramp's plate cannot morph in glassd yet | Phase ramp under the crop (§10.2); AT-10c's ramp frame |
| 16 | Steam may render a footer on our folder routes (Steam's route wrapper for added routes) | Pass Steam's Home footer props; if it shows anyway, the two-row layout (`lgs-home-footer`, §3.2). Never hide it (PLAN §1.10) |
| 17 | WN's route map makes `/library/home` `windowless` even when the override failed | REQ C2a->C1a #1 (the `glassMode('home')` hook); until answered, `41-home.css` draws a `window-full` tint behind Steam's own Home when our page is absent (§13) |
| 18 | PLAN §1.7's row "the source card keeps +15" contradicted admission rule 6 | Resolved by PLAN R2-3: the row now says 0 with a CSS glow in both profiles (rule 6), as this text and P6's reporter have it |
| 19 | On windowless routes a menu's +10 crop has no cover to lie in (rule 1) | C1c reports the menu box as a `thick` plate there (REQ C2a->C1c #3); without it the menu stays flat (rule 1 drops the pop), which is safe |

---

## 16. Cross-concept agreements

| With | Agreement | Where recorded |
|---|---|---|
| window-nav (C1a) | `/library/home` and `/library/lgs/folder/*` are **windowless** (plates, one pop on attention); `/library/lgs/steamhome` is `window-full`; Home answers `glassMode('home')` so a failed override falls back to `window-full` (REQ C2a->C1a #1); C1a tags Back and the search circle as plates on windowless routes (REQ C2a->C1a #2) | PLAN §1.2, WN §3.1.1, `xc-home-search.md` §1 |
| window-nav (C1a) | The Home field is WN's circle variant; no microphone anywhere; Back and the search circle are plates on windowless routes | PLAN §1.9, §3.1 |
| window-nav (C1b) | Search is window-nav's sheet; this concept adds programs (Top Hit tiers, the Software cell) through C1b's provider API (`c2a.programs`); X = Play on library items is declared by C1b's sheet | PLAN §1.9, §6, `docs/phase2/wp/C1b.md` ("Interface announced"), `xc-home-search.md` §2 |
| window-nav (C1a, C1c) | Library routes: the five fixed slots per input mode (§7.1) inside WN's ornament contract; the More circle is WN's helper registered on posters (§7.2); the Filters content inside WN's sheet frame (§9); menus over Home reported as `thick` plates (§8) | §7.1, §7.2, §8, §9; WN §3.4.6 |
| control-center | The Liquid Glass switch stays only in the "+" popup (CC row "+": "Liquid Glass stays a row there") | HA-10 |

---

## 17. Critique responses (revision 2)

| # | Critic's issue | Response | Where |
|---|---|---|---|
| 1 | **Blocker:** a windowless Home with uncovered pops ghosts, and without pops the glass falls back to tint | **Accepted. Mechanism chosen: covered plates.** Every plate is opaque glassd glass (Steam's panel hidden under it). The mosaic is restricted to the plates' bands. Only the attended item pops (+15 mm), over its own plate in an occluder variant. **Not chosen, option (a)** (opacity 0 on `t1` + full mosaic): it depends on the main panel staying a laser target at opacity 0, which only a wearer can confirm, and a full mosaic with holes approaches the 24-layer limit. **Not chosen, plain option (b)** (slabs inflated by dz · tan 35°): it needs 9–23 px of empty glass around every popped element, and it still leaves unpopped discs without glass. **Correction to the critic's numbers:** "≈ 7 px at +10 mm, ≈ 18 px at +25 mm" are millimetres; in CSS px they are **9 and 23** (0.77 mm per px). AT-10b (static) and AT-10c (off-axis look) added | §2 HA-1, §10, §14, `p2_home-apps_depth.png` |
| 2 | Conflict with window-nav over search, Home's glass and field geometry | **Accepted.** window-nav owns search. Contributions: programs in the ranking, the Apps cell (revision 3: C1b's Software cell), X = Play. The field is WN's spec, with WN's circle variant on Home | §6, §16, `xc-home-search.md`, `p2_home-apps_search.png` |
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
