# C2c Library catalogue: evidence log

Package card: `docs/phase2/PLAN.md` §2.4 "C2c Library catalogue". Concept: `docs/phase2/concepts/home-apps.md` (HA) §7, §8, §9, §12.2–§12.6, which **C2a owns**; C2c changes that text only through the requests below. Steam build at the time of writing: `11094443` (no device step was needed in this session).

C2c owns: `theme/40-library.css`, `device/rt/40-library.js`, `theme/layers/40-library.json`, `docs/phase2/mockups/home-apps-library.html`, `home-apps-library-pad.html`, `home-apps-filter.html`, `docs/phase2/mockups/fetch-library-refs.py`, this log and `docs/phase2/wp/C2c-cmp.json` (not yet written). Session 2 ran on the device; Steam build `11094443`.

## Status

**Milestone reached: M3 (T1, T2) plus the T4 layer fragment, 2026-10-07 session 2** (Steam build 11094443). M0 was session 1 (below).

**READY: wp.c2c** (it needs `wp.p3` and `wp.c1a`, its runtime deps; `libFixedSlots` stays **off**). Evidence: session 2 rows under Evidence (S2-G1 to S2-R1). AllGames gates **PASS** in laser and pad (AUD 0: no GONE, HIDDEN or UNCLICKABLE); the collection page gates PASS in both modes, as do the Filters sheet (pad, scrolled to 0 and 4200) and Non-Steam (pad). D-pad traversal is manual and reversible (pad-bfs is limited by a lab issue). The runtime log has no errors. Open findings, not lost functions: a text reflow on Collections (S2-G5), and a DOM-path artifact on Non-Steam laser (S2-G7).

- **Built and live (synced to the Frame):**
  - `theme/40-library.css` (T1), rewritten for the catalogue only; every Home rule is gone (C2a's REQ #6). The header rows sit below C1a's toolbar row (`--lgs-hdr-pad`), with the scroll guard on Steam's grid scroller. The tab row is a segmented control (64 track, contiguous 60/80 segments, 22 Semibold in Steam's case), with 60 px ‹ › circles. The VR sub-filter is the same control in Steam's place. Posters keep Steam's geometry; Steam's outline, focus pulse and shine are gone, and the attention target lifts (gamepad: Steam's focus transform; laser: x1.05 after the dwell, P4's `--lgs-lift`) with the +15 mm shadow and glow. Also restyled: the filter notice, section headers, fast scroll, collection tiles (radius 30, empties dimmed by T2), and Library Filters (T1 fallback: the card in C1c's sheet look, compat rows 80, platters, 80 px check rows).
  - **D-C2c-12 (new):** Steam's laser **Sort & Filter pill** is now the toolbar row's **trailing group** (top right, y 24–84), not ornament slot 1. C1a's window clip cuts page content at y 656, so the pill (a page node) could neither show nor take clicks in the ornament. The ornament **hugs Steam's legends** in Steam's order (no empty slots when Steam drops X/Y/≡). PLAN §1.10's five fixed 880 px slots are kept behind the flag `libFixedSlots` (off).
  - `device/rt/40-library.js` (T2, `wp.c2c`, deps `shell`, `more`):
    - registers posters with C1a's More circle (direct laser path to the tile menu);
    - copies Steam's sort name onto the Y legend, so slot 1 reads "Sort By · Alphabetical" (Steam's own string; no new string);
    - tags the tab segments E-SEG and tags empty collections;
    - when `libFixedSlots` is on, registers the fixed slots.
    - Install and remove are clean (no attribute left after the flags pop; checked).
  - `theme/layers/40-library.json` (T4): the attended poster and collection tile pop at +15 mm (liquid slab, non-interactive). It supersedes the legacy `sort-filter` and `tab-arrow` rules while `wp.c2c` is on. The tab track moved to `%{TabRow}::before`, so legacy `tabs` no longer pops it.
- **Not built (open; nothing is lost without them):**
  - the letter scrubber (T3, `libScrubber`);
  - the T3 Filters re-render (the T1 fallback ships);
  - the filter-count badge;
  - `C2c-cmp.json`, so PLAN-2c-2's `cmp` was not run;
  - anchored menus (C1c's).
  - PLAN-2c-1 (880 ± 1) holds only with `libFixedSlots` (D-C2c-12; REQ-8 to the coordinator).
- **Native:** P7 reports M1, not M3. The user asked for native glass work anyway, so two `native-session` runs went on AllGames:
  - sgcheck: the laser-dwelt poster pops at 15.0 mm; the first run's only R2 failures were legacy `tab-arrow` pops at 4.43 mm (now superseded);
  - with the poster focused by the gamepad, sgcheck **PASSES** (one pop, 15 mm);
  - with the Filters sheet open, only C1c's legacy `filters` pop (11 mm, REQ-10) fails;
  - one hv look: native glass window, segmented tabs, the toolbar pill, the ornament;
  - the frame was deleted on both machines, and the session returned to CSS only. See S2-N1 and S2-N2.

## Requests

- [x] REQ-1 REQ C2c->C2a: home-apps.md, apply C2c's PLAN §1 conformance text for the library catalogue. It covers HA §0.1 (three mockup rows), §1.2 item 6, §1.3 "Library Filters" row, §7 (with §7.1 and §7.2), §8, §9, the library rows of §10.4 and §11, §12.2, §12.3 T1 and T7, §12.4, §12.5 C1, §12.9 SN-F1, the library rows of §13, the library parts of §14 AT-6 and AT-7, AT-14, AT-15, §15 #12 and §16 row 4. The full replacement text is in "Proposed text for home-apps.md" below. Why: this is M0 for C2c's sections, and C2a owns the file. **C2a, 2026-10-07:** done: merged into HA §0.2, §1.2, §1.3, §7–§9, §10.4, §11, §12, §13, §14 (library AT-6/AT-7 as their own rows, AT-14, AT-15), §15, §16, keeping §12's Owner/Test columns; the count is 60 functions, not 59 (details in `docs/phase2/wp/C2a.md`).
- [x] REQ-2 REQ C2c->C2a: home-apps.css. C2c's mockups no longer use the `hl-*` block, `.ha-poster.is-lift` or `.hl-cap` / `.hl-hit` / `.hl-menu`: their styles now live inline in C2c's three mockups (prefix `lc-`). You may delete them. C2c still uses `.ha-poster` (base rule) and home-apps.js's `[data-app]` poster fill, so please keep those names stable. **C2a, 2026-10-07:** done: `hl-*` and `.ha-poster.is-lift` removed from `home-apps.css`; `.ha-poster` (base, `img.port`, `.is-titlecard`) and `home-apps.js`'s `[data-app]` fill kept.
- [x] REQ-3 REQ C2c->C1a: frozen target in library slot 3. On library routes your T2 Options member sits in C2c's fixed 156 px slot (PLAN §1.10; PLAN-2c-1 requires 880 ± 1 px in both modes), so the "· <name>" suffix cannot fit. Please omit the suffix there, for example when `#Footer` carries an attribute that C2c's T2 sets (tell me its name). Instead, keep the More circle on the frozen target while the pointer is inside `#Footer`, so the target stays visible on its own poster (`p2_home-apps_library.png` shows the circle on its source). **C1a answer (2026-10-07, session 2):** adopted (WN §3.4.3 item 4, §3.4.4): on fixed-slot routes there is no name suffix, and the More circle stays on the frozen target while the pointer is inside `#Footer`. The attribute is set by the shell from your registration (REQ-5): `#Footer[data-lgs-orn-fixed="library"]`; C2c's T2 sets nothing for it.
- [x] REQ-4 REQ C2c->C1a: Options member. In gamepad mode, on routes with registered More hosts, show it disabled whenever Steam renders no ≡ legend (focus on the tab row), so the library's slot 3 never empties. Disable it (no dispatch) while any modal is open, in both modes, so it cannot stack a second menu. **C1a answer:** adopted (WN §3.4.2 slot 2): on fixed-slot routes the Options member never leaves its slot; in gamepad mode with no ≡ legend from Steam it shows disabled. In both modes it is disabled (.38, no dispatch) while main's ModalManager holds any modal or context menu.
- [x] REQ-5 REQ C2c->C1a: ornament backing on library routes. Let an area fix the capsule's rect instead of measuring the members' union: C2c needs x 200, width 880, the slots 300 · 130 · 156 · 134 · 120, gap 4, padding 12. Otherwise the capsule changes width when Steam drops a legend (≡ while no poster is focused) or when the input mode flips. A registration call such as `__LGS_RT.shell.ornamentSlots({widths, gap, padding})`, or a CSS variable C2c may set on `#Footer`, would do. Also, during alerts and sheets in laser mode, darken the capsule with the tab bar's black .35 layer (WN §3.3.4) while A and B stay lit (`p2_home-apps_filter.png`). Please answer with the API name. **C1a answer:** API `__LGS_RT.shell.ornamentSlots('library', {widths: [300, 130, 156, 134, 120], gap: 4, padding: 12})` → `{remove()}` (WN §3.4.1); the backing stays at x 200–1080 and never re-measures; you place the members in the slots with your T1 rules. During alerts and sheets (C1c's `html.lgs-modal`) slot 1, Options and the area slot recede under black .35 and stay clickable; A, B and the dialog's legends stay lit (WN §3.4.2). The capsule glass itself is not darkened.
- [x] REQ-6 REQ C2c->C1c: menu anchoring and sheet frame.
  - (1) Keep slabs placed beside or above a source at least 12 px clear of the ornament's top (bottom ≤ 616), as the tile menu in `p2_home-apps_library.png` is (400 × 506 at (421, 110)). At 628 they touch the capsule.
  - (2) C2c's Filters content assumes your sheet frame from `window-nav-sheet.html` (960 × 488 at (160, 128), close circle at (24, 24), a trailing capsule at the 24 px inset).
  - (3) VP P-35 asks for sheets centred on the glass ±24 px (glass centre y 328; this frame's centre is 372, centred in the 108–628 modal box instead). Your call; tell me if the frame moves.
  - **C1c answer (2026-10-07, session 2):** (1) done in T1: `theme/22-presentations.css` pads Steam's menu box to y 108–616 on `main` (bottom ≤ 616 in every layout, measured live: tile menu 400 × 496 at y 107–603); C1c's T2 anchoring (M3) clamps to the same box. (2) and (3): the frame moves up to **y 108** (top-aligned under the toolbar row, D7): ≤ 960 wide, centred horizontally (x 160–1120), at most 488 tall on `window` routes (552 on `window-full`), so its centre stays within 24 px of the glass centre (P-35); live on ZOO('Scroll Panel Test'): 958 × 487 at (161, 109). `ModalPosition`'s own padding does it, so a `%{DialogWrapper}` (your Filters scroller) is held to that box and scrolls inside. Close circle (24, 24) and the trailing capsule at the 24 px inset as drawn; the circle is C1c's T2 (M3).
- [x] REQ-7 REQ C2c->Coordinator: PLAN §1.7 contradicts itself. The table row "Source card while its menu is open: it keeps +15 if it was the focused card" conflicts with admission rule 6 ("while a modal … is open, only the modal itself pops"). P6's reporter implements rule 6 (`contracts/reporter.md`, admission step 6, `modal: true` rules). C2c follows rule 6: the source poster goes to 0 with a CSS glow, and the menu at +10 is then in front of it. A +15 source beside a +10 menu would also put the source in front of its own menu. Please amend the row, or confirm it.
  - Coordinator (2026-10-07, round R2): row amended to rule 6: the source card is at 0 with a CSS glow in both input modes and both profiles; the control that opened the menu is white .94 (PLAN §1.7; §1.19 R2-3). No change needed in C2c's files.
- [x] REQ-8 REQ C2c->Coordinator: PLAN §1.10 and PLAN-2c-1 (five fixed slots, 880 ± 1 px in both modes, Steam's laser Sort/Filter in slot 1) cannot hold on device. (1) C1a's window clip (`clip-path` at `--lgs-c1a-gh`, y 656) cuts every page node below the glass. Steam's laser pill is a page node, so in the ornament (y 628–712) it is half hidden and takes no clicks (`elementFromPoint` returns `#MainNavMenu-Rest`, session 2). (2) Steam drops its X / Y / ≡ legends whenever focus is on the header rows, and in laser mode, so a fixed 880 capsule shows 434 px of empty slots. C2c ships D-C2c-12: the pill is the toolbar row's trailing group, and the ornament hugs Steam's legends. The fixed slots stay available behind `libFixedSlots` (off). Please amend §1.10 and PLAN-2c-1, or rule otherwise.
  - Coordinator (2026-10-07, round R2): D-C2c-12 adopted: the library ornament hugs its members, the laser pill is the toolbar row's trailing group, the fixed slots stay behind `libFixedSlots` (off, S28); PLAN-2c-1 is replaced by R2-2's three checks, which add ≥ 20 px clear of the search capsule (6–8 px today: REQ Coordinator->C2c in `wp/coordinator.md`) (PLAN §1.10, §2.4; §1.19 R2-2).
- [x] REQ-9 REQ C2c->C1a: on library routes, Steam's laser Sort & Filter pill now sits at the toolbar row's trailing edge: right-aligned 24 px from the glass edge, y 14–94 hit (24–84 visible), at most 420 wide. On section roots it starts at x ≈ 908, right of the 520 search capsule; with the sort "Alphabetical" it is x 906–1256. Please keep that area free of shell items on `library` routes, or tell me where it should go. Also: `libFixedSlots` is off, so `ornamentSlots('library')` is not registered by default, and your capsule hugs the legends. Your fixed-slot CSS and API stay in use behind the flag.
  - **C1a answer (2026-10-07, R2 fix pass):** answered (with the coordinator's R2-2): the area right of the search capsule is yours on `library` routes and stays free of shell items (WN §3.2, new "Trailing group" row). The search capsule is visible x 380–900, its hit box 372–908; with PLAN §1.10's ≥ 20 px your group's visible left is ≥ 920 and its hit box starts ≥ 910, so the 2 px hit overlap measured in review R2 goes once the group is capped (your width cap).
- [ ] REQ-10 REQ C2c->C1c: the Library Filters card (Steam's `%{DialogWrapper}` scroller, 660 × ≤ 488 at x 310, inside your modal box) is not a direct `div.Panel` child of `ModalPosition`, so your sheet rule does not give it glass. C2c gives it your look in `40-library.css` (`%{DialogWrapper}:has(> %{DialogWrapper>CompatFilterDialog})`: thick material, radius 44, `lgs-sheet-in`). Two findings: (a) Steam's modal layer acts as the backdrop root, so `backdrop-filter` cannot reach the page and the sheet needs a denser tint (C2c adds black-blue .62 under `--lgs-mat-thick-bg`); (b) a gradient listed after `var(--lgs-mat-thick-bg)` makes the whole `background` invalid, because the token ends in a colour layer. If you cover the scroller in your rule, tell me and I will remove my copy. (c) In native mode the legacy `filters` layer rule still pops this sheet at 11.07 mm, outside PLAN §1.7's set (sgcheck R2, S2-N2); retiring it is yours (reporter.md §3.5).
- [ ] REQ-11 REQ C2c->C2a: FYI. `theme/layers/40-library.json` supersedes the legacy `tab-arrow` rule while `wp.c2c` is on. That rule matches only the library's and Steam's own Home tab rows, and pops the ‹ › circles at 4.43 mm, outside PLAN §1.7's set (sgcheck R2). Steam's Home arrows (`/library/lgs/steamhome`) then stay on the window plane. Your track on `%{TabHeaderRowWrapper}::after` is still popped by the legacy `tabs` rule; C2c moved its own track to `%{TabRow}::before` to escape it.

## Requests to C2c, handled

- 2026-10-07, start of session 1: `grep -n "REQ [A-Za-z0-9]*->C2c:" docs/phase2/wp/*.md` returned nothing (no `docs/phase2/wp/` directory existed yet).
- 2026-10-07, session 2 (three found):
  - **REQ C1a->C2c** (`C1a.md`):
    - (1) Done. The header rows move below the toolbar row by `--lgs-hdr-pad` (`%{TabHeaderRowWrapper}` `top`; Steam's grid scroller is padded to match), so the tab row is at y 108–188 and no longer under the search capsule. G-SIZE has no P-08 failure on tabs or the sub-filter.
    - (2) Done. `scroll-padding-top` / `-bottom` on `%{TabContentsScroll}` come from `--lgs-hdr-pad` and `--lgs-guard-bottom`.
    - (3) Not possible as asked: your window clip cuts the pill in the ornament. It is placed at the toolbar's trailing edge instead (D-C2c-12; REQ-8, REQ-9).
  - **REQ C1c->C2c** (`C1c.md`; mockups): done in session 1 (M0). The three mockups have menus at +10, layout by count, Cancel as a 56 px quiet capsule, laser hover + .08, the source at 0 with a glow (rule 6, REQ-7) and the sheet ≤ 960 at +10.
  - **REQ C2a->C2c #6** (`C2a.md`): done. `theme/40-library.css` was rewritten without any `%{RecentSection}` rule. The file now holds only library-catalogue rules under `%{GamepadLibrary}`, the pill, the ornament's library rules and Library Filters.
- 2026-10-07, end of session 2: the same grep returns only these three (all handled above). The `theme/_wip` and `device/rt/_wip` copies were identical to the landed files and are removed.

## Evidence

| Test | Command | Result | Files | Date | Steam build |
|---|---|---|---|---|---|
| M0-R1 | `python tools/mockshot.py docs/phase2/mockups/home-apps-library.html shots/p2_home-apps_library.png` | Rendered; viewed. Verdict: matches §7, §7.1 and §8 as proposed (details below) | `shots/p2_home-apps_library.png` | 2026-10-07 | n/a (mockup) |
| M0-R2 | `python tools/mockshot.py docs/phase2/mockups/home-apps-library-pad.html shots/p2_home-apps_library-pad.png` | Rendered; viewed. Verdict: matches §7 and §7.1 (gamepad) | `shots/p2_home-apps_library-pad.png` | 2026-10-07 | n/a |
| M0-R3 | `python tools/mockshot.py docs/phase2/mockups/home-apps-filter.html shots/p2_home-apps_filter.png` | Rendered; viewed. Verdict: matches §9 and §7.1 "while a modal is open" | `shots/p2_home-apps_filter.png` | 2026-10-07 | n/a |
| M0-G1 | Rect dump of every `data-id` (and of `.lc-seg > span`, `.lc-orn > *`, `.lc-menu > *`, `.lc-chips > *`) with a scratch Playwright script against the same headless Chrome (not a repo tool; P10's `mockshot.py --rects` will replace it) | Ornament 880 × 84 at (200, 628); slots 300/130/156/134/120 × 60 at x 212, 516, 650, 810, 948 in both modes. Tabs and sub-filter: segments 60 tall, contiguous, ≥ 140 wide (sub-filter 3 × 140 = 424 at x 428). Tile menu 400 × 506 at (421, 110), rows 60 on a 64 pitch, Cancel 56. More circle 60 × 60 at (335, 280) inside the source poster (233–405), and at (719, 274) inside the lifted poster (608.7–789.3 × 263.5–534.4). Scrubber 60 × 340 at (1196, 270). Sheet 960 × 488 at (160, 128). Toggle capsules 60 tall, one row per section (Players ends at x 1003, Play state at 972, inside the 912 px body x 184–1096). Text: 19 px (menu label) is the smallest | stdout only | 2026-10-07 | n/a |
| S2-G1 | `python glass.py gates main --route /library/tab/AllGames --mode laser` `--flags wp.p3,wp.c1a,wp.c2c` | **PASS** (native off): AUD 0 issues (21 exempt), SIZE 0 fails (8 E-SEG: 5 tabs, 3 sub-filter segments, all pass), TYPE 0, OUTLINE 0 (8 probes), MOTION 0 at rest and no non-token durations | stdout | 2026-10-07 10:10 | 11094443 |
| S2-G2 | the same with `--mode pad` | **PASS** (native off): AUD 0, SIZE 0, TYPE 0, OUTLINE 0, MOTION 0 | stdout | 2026-10-07 10:12 | 11094443 |
| S2-G3 | `gates main --route /library/tab/AllGames --mode pad --pre <Filter snippet, INV-L §0.3; + DialogWrapper.scrollTop 0 / 2000 / 4200>` `--flags wp.p3,wp.c1a,wp.c2c` | **PASS** at 0 and 4200 (sheet open: SIZE 0 over 25–40 checked, TYPE 0, OUTLINE 0, AUD 0). At 2000: AUD 1 (CONTRAST of the focused compat row's description, fixed afterwards: it turns white on focus). Earlier runs found 16 px compat labels, 38 px check lines and 14 px check labels, all fixed | stdout | 2026-10-07 09:40–09:55 | 11094443 |
| S2-G4 | `gates … --pre <Sort snippet>` (`--only aud,size,type`), pad | AUD 0, TYPE 0. SIZE: the only failures are 11 E-MENU rows 284 wide in C1c's two-column Sort slab (E-MENU's ≥ 320 rule, C1c's open REQ to the coordinator), none of them C2c's | stdout | 2026-10-07 09:58 | 11094443 |
| S2-G5 | `gates main --route /library/tab/Collections`, laser and pad | SIZE 0 (it had 18 failures before D-C2c-15), TYPE 0, OUTLINE 0 (13 hairline borders on the display case removed), MOTION 0. AUD 1, the same in both modes: "SHRUNK text NINTENDO SWITCH - YUZU 145x76 -> 143x50". This is a reflow (two lines in mixed case instead of three in Steam's uppercase), not a loss | stdout | 2026-10-07 10:16 | 11094443 |
| S2-G6 | `gates main --route /library/collection/<VR collection id>`, laser and pad | **PASS** in both modes, after the nested-search fix (the pill had overlapped the 640 search capsule: P-08 72 %) | stdout | 2026-10-07 10:27 | 11094443 |
| S2-G7 | `gates main --route /library/tab/DesktopApps`, laser and pad | pad **PASS**. Laser: AUD "GONE text SELECT" only with `wp.c2c` on. A live probe in the same mode shows Select present and visible (`OK:Select:624,628,112,84:flex:visible:1`). The cause: once C2c registers posters as More hosts, C1a's T2 Options member is inserted before A and B, which shifts the DOM path the audit keys on (lab.md: AUD keys are DOM paths). Not a lost function; C1a's audits on fixed-slot routes have the same shape. The same gate with `wp.p3,wp.c1a` only: PASS | stdout | 2026-10-07 10:31 | 11094443 |
| S2-P1 | `pad-bfs --route /library/tab/AllGames --mode pad` `--flags wp.p3,wp.c1a,wp.c2c` | 4 nodes, 0 irreversible, 0 untested; Left from the first poster is `exit:none`, after which the tool cannot take focus ("untakeable"). This is the known sweep limit (REQ C2a->P10 #14; C1a measured the same 4-node baseline on stock). Manual D-pad replacement (`L.pad`, below) | stdout | 2026-10-07 09:20 | 11094443 |
| S2-P2 | `js` with `L.root()` then `L.pad` (up, up, down, down, right ×2, down ×2, up ×4, left, down), `--mode pad` `--flags wp.p3,wp.c1a,wp.c2c` | grid → sub-filter "ALL" → tab "All Games" → back down to the sub-filter and the grid; Right moves along the row; Down / Up keep the focused row inside the guard (y 256–340 after Steam's scroll); Left on the first tab wraps to Soundtracks and switches tab (Steam's own behaviour); every move reversible | stdout | 2026-10-07 09:25 | 11094443 |
| S2-S1 | shots `c2c_t2_laser`, `c2c_laser_hover` (`--hover %{CSSGrid} %{LibraryItemBox},900`), `c2c_filter_pad`, `c2c_coll2`, `c2c_collpage` | Viewed: segmented tabs and sub-filter under the toolbar; the toolbar's trailing Sort & Filter group; the ornament reads "Filter · Sort By · Alphabetical · Options · Select · Back"; the dwelt poster lifts with the More circle at its top right; the Filters card is a glass sheet; collections have rounded tiles with labels in Steam's case | `shots/c2c_*.png` | 2026-10-07 | 11094443 |
| S2-N1 | `native-session --step "sgcheck … --mode pad" --step "sgcheck … --mode laser --hover <poster>" --step "hv c2c_lib_native --look"` `--flags wp.p3,wp.c1a,wp.c2c` | Laser dwell: main pops 0 / 4.5 / **15.0 mm**; the poster pops at 15. R2 failed only on the legacy `tab-arrow` (4.43 mm), which is now superseded behind `wp.c2c`. hv look (viewed, then deleted on the PC with `hv --clean`; none left in the Frame's `/tmp/lgs`): native glass window, segmented tabs, sub-filter, posters, the toolbar pill, quiet Select / Back. Doubling 0.39, not doubled. Back to CSS only: yes | stdout | 2026-10-07 10:03 | 11094443 |
| S2-N2 | `native-session` with sgcheck (pad, poster focused with `L.gpTake`) and sgcheck (pad, Filters sheet open) `--flags wp.p3,wp.c1a,wp.c2c` | Poster focused: **PASS**, main pops `[0, 15.0]` mm, one pop. Sheet open: the poster is not popped (rule 6); the only pop is the legacy `filters` rule at 11.07 mm (R2 FAIL). That rule is C1c's to retire (reporter.md §3.5; REQ-10). Back to CSS only: yes | stdout | 2026-10-07 10:06 | 11094443 |
| S2-R1 | `js` after the flags popped | `library` module `off`; no `data-lgs-lib-sort`, `data-lgs-empty` or `data-lgs-exempt="E-SEG"` left; no `[data-lgs-orn-fixed]`. With the flags on, the runtime log holds only "defined" and "installed in 2 ms" (no warning or error) | stdout | 2026-10-07 10:35 | 11094443 |

**Visual verdicts (looked at each render next to the §7–§9 text):**

- `p2_home-apps_library.png` (laser):
  - the tile menu grows to the right of its source, in the compact layout, with Install as the blue whole fill and Cancel as the quiet capsule;
  - the source poster sits flat with its glow, and its More circle is white;
  - the ornament keeps its 880 px; Steam's Sort and Filter are in slots 1–2, Options is disabled while the menu is open, and Select and Back show as labels only;
  - the scrubber shows "#" (digits) as current, which is right for the first row (11-11 …, 112 …, 12 …, 140, 3dSen, 3dSenVR); revision 2 wrongly showed "A".
  - Fixed during review:
    - the sub-filter segments were 188 px wide because of content-box sizing, now 140;
    - the menu touched the ornament, now 12 px clear;
    - the laser dot sat on the label text, now at the row's trailing area.
- `p2_home-apps_library-pad.png`:
  - exactly one focus look (the "140" poster, lifted, with the More circle and Steam's Verified badge inside it);
  - the selected tab and the selected sub-filter segment are white, which is selection, not focus;
  - the glyph badges show (gamepad mode);
  - no window-bar row (SteamVR hides it without the laser).
- `p2_home-apps_filter.png`:
  - the first view shows the compatibility pop-up, both option rows, and the first collapsed row peeking under the 56 px scroll-edge fade;
  - the window, the tab bar and the ornament recede, with Select and Back lit;
  - no outline on any glass.
  - Fixed during review:
    - the laser pointed at the wrong control;
    - the receded Sort and Filter labels floated without a capsule, so they were replaced by the receded capsule;
    - section spacing was tightened so a collapsed row peeks.

## M0 conformance map (PLAN §1 → the library)

| PLAN | What it changes for C2c | Where |
|---|---|---|
| §1.1 | WN (C1a) owns the window, the toolbar, the ornament contract, the More helper and the frozen target. C1c owns the menu and sheet frames. C2c fills the library slots, registers posters and owns the Filters content | §7, §7.1, §7.2, §8, §9 |
| §1.2 | Library routes are `window`: 1280 × 656, radius 54, 64 px ornament margin; the CSS-only tint is WN §8.4's | §7 routes |
| §1.3 | Segments: 64 track, 60 contiguous, ≥ 140 (tabs, sub-filter). Icon buttons 60 / 80 (tab arrows). Text buttons 60, padding 24, 24 Semibold (Reset, Save, toggle capsules). Rows in a platter 80 (Filters). Menu rows per §1.12. Ornament 84, members 60. More circle 60 / 80. Glyph badge 30 / 16 Bold | mockups; §7, §9 |
| §1.4 | Laser looks key on `:hover`; poster lift, scale and depth only after the 80 ms dwell; attention moves the More circle; selected segment white .94; glyph badges only in gamepad mode; rows and tabs never scale; only posters lift (×1.05) | §7, §7.1; laser and pad mockups |
| §1.5 | MO tokens only. Tab switch is C1c's `23-transitions.css`; menus morph (C1c); the sheet uses `sheet-in`/`sheet-out` (C1c). Nothing runs at rest, so Steam's capsule focus pulse, grow and shine sweep must go | §11 |
| §1.6 | Ornament `liquid` with an inset slab; menus and sheet `thick`; the More circle is clear over the art (black .38 + 10 px blur); posters are content; no border, outline or 1 px ring (Steam's capsule outline, the section-header and filter-header rules removed) | §7, §9; mockups |
| §1.7 | Poster +15 mm non-interactive (the click-safe cap may lower it to +10); menus +10; sheet +10; the source poster 0 while its menu is open (rule 6, REQ-7); at most 4 distinct dz on the route (0, +10, +15, +25 tab bar); lift shadow per P-48 | §10.4; mockups' `data-dz` |
| §1.8 | Menus: no scrim. Sheet: Steam's overlay restyled to .35, no `t1` tint (revision 2 used `t1`) | §9, §10.4 |
| §1.9 | Search 520 capsule on section roots (Library tabs), 640 on `/library/collection/*`; area rules keyed only on `html.lgs-hdr-108` / `lgs-hdr-40` | §7 |
| §1.10 | Five fixed slots, 880 px in both modes; A and B quiet trailing in both modes; legend nodes never hidden; the laser-mode Sort/Filter in slot 1; depth 0 with an inset slab | §7.1; both library mockups |
| §1.11 | One More circle per document (C1a's `20-more.js`), registered on `%{LibraryItemBox}`; capture-phase isolation; the host's `onMenuButton`, fallback `vgp_onmenu`. Revision 2's one-span-per-poster plus MutationObserver is withdrawn | §7.2; AT-14a/b |
| §1.12 | Tile menu (6 actions here) → compact 60 / 64, 400 wide, inline label; Sort (10) → two columns, 592; ≤ 5 → 72 rows; Cancel a 56 px quiet capsule; GP §3.4 placement; destructive rule by count; anchoring gated (WN AT-11, GP AT-MENU, SET CQ10) | §8; laser mockup |
| §1.13 | No tooltips (every library control has a visible label except the ‹ › arrows and the More circle, which take P3's tooltip with Steam's own strings, 0.8 s). The scrubber's letter change and the toggle capsules call `rt.sound` with Steam's `ENavSound` for the same event (P-74). Haptics off | §7, §9 |
| §1.15 | Every string is Steam's (tab and sort names, "Options", "Library Filters", options, "Reset", "Save as … Dynamic Collection", "Any language"). Scrubber letters come from the titles. Revision 2's "N More" chip, "Y Reset" legend and "Showing all N games" footer are dropped. **No new strings** | §7, §9 |
| §1.16 | E-SEG (tabs, sub-filter), E-MENU (menus). No other exemption is needed | AT-7 |
| §1.17 | S2 (`interactivePops`) off: every library crop is non-interactive. S11 (ornament pop) off: ornament at 0. S14 (More circle on every host) on | §10.4 |
| §1.18 | P4's DESIGN2 amendments; nothing to apply in C2c files | — |

## Decisions taken without the user (PLAN §1.17 rule: safe default, flag, note)

| Id | Decision | Safe default and flag | Why |
|---|---|---|---|
| D-C2c-1 | The source poster drops to 0 mm (with a CSS glow) while its menu is open | Rule 6, enforced by P6's reporter; no flag (REQ-7 asks the coordinator) | Rule 6 and visual order: the menu must be in front of its source |
| D-C2c-2 | The scrubber's column is reserved with `padding-inline-end: 72px` on `%{GridWithControls}`, only while the scrubber is mounted | Flag `libScrubber` (default on once `wp.c2c` is on). The module checks Steam's grid after the padding (6 columns, gap ≥ 16) and otherwise unmounts and removes the padding | Steam's geometry leaves only 44 px right of the posters, and a 60 px control (P-80) does not fit over them without colliding with the More circle of column 6 |
| D-C2c-3 | The scrubber shows in both modes: interactive under the laser, passive in gamepad mode (no focusable; the current letter follows focus) | Under `libScrubber` | Grid geometry stays the same across mode flips. Gamepad users gain the position cue LA B.1–B.4 asked for |
| D-C2c-4 | The compatibility filter is a pop-up row in T3, not a segmented control; T1 keeps Steam's four rows as single-choice rows | Under `wp.c2c` (the T3 re-render) | CTL §8.3 excludes segmented controls for labels over 16 characters ("Verified, Playable, and Untested") |
| D-C2c-5 | Filter options use the text-button vocabulary as toggle capsules (24 Semibold, 60 visible, 80 hit abutting); Play state shows all five options, with no "N More" chip | Under `wp.c2c` | PLAN §1.3 has one text-button spec; dropping the chip removes a new string |
| D-C2c-6 | Reset is the sheet's trailing capsule; Save is at the end of the content; no Y Reset legend | Under `wp.c2c` | Steam's dialog has only A Select and B Back legends (`library_filter_dialog.png`) |
| D-C2c-7 | The poster lift shadow is `0 6px 18px` black .50 (P-48 at +15 mm), not D2 §7.8's `0 18px 44px` | Always | P-48 is a "must" gated by G-DEPTH |
| D-C2c-8 | During modals on library routes: in laser mode the capsule stays and recedes (.35) with A and B lit; in gamepad mode the quiet legend stays in its slots; Options is disabled | C1a's T2 (REQ-4, REQ-5) | The ornament's geometry stays stable and follows C1a's member-based capsule/quiet rule |
| D-C2c-9 | Anchored menus stay 12 px clear of the ornament (bottom ≤ 616) | C1c's anchoring (REQ-6); centred fallback unchanged | Avoids a slab that touches the capsule |
| D-C2c-10 | No frozen-target name suffix in the library's slot 3; the More circle marks the target instead | C1a (REQ-3) | Keeps PLAN-2c-1's 880 px |
| D-C2c-11 | Steam's uppercase chrome (tab labels, section headers, collection labels, sub-filter, legends) is shown in Steam's own case with no tracking (`text-transform: none`, `letter-spacing: 0`) | Always, T1 | P-84 |
| D-C2c-12 | Steam's laser Sort & Filter pill is the toolbar row's trailing group (top right, 60 px capsule, 80 hits), and the ornament hugs Steam's legends in Steam's order. Slot 1 still carries the sort ("Sort By · Alphabetical") in gamepad mode | Flag `libFixedSlots` (off) brings back PLAN §1.10's fixed 880 px slots | The window clip cuts the pill in the ornament (it was half visible and unclickable), and fixed slots show empty space whenever Steam drops X / Y / ≡ (REQ-8) |
| D-C2c-13 | Gamepad focus keeps Steam's own focus transform (about x1.07); C2c's x1.05 scale applies only to the laser's dwell | Always | Two scales stacked to x1.105, beyond PLAN §1.4's x1.05 |
| D-C2c-14 | The tab row is tagged E-SEG by T2 (`data-lgs-exempt`); with 22 px labels its six tabs need about 1,140 px against 1,048, so it keeps Steam's horizontal scroll and arrows | `wp.c2c` | E-SEG is the card's own exemption for these segments; a partly visible segment at the scroller's edge is otherwise judged by the 80 × 80 box |
| D-C2c-15 | Steam's 20 px collection count (a focusable tooltip source) is spread over the whole tile, with its text kept under the name, so every point of the tile takes the laser. Empty collections dim only their face, not the label | Always (T1) | P-08 / P-80 failed on the count in stock Steam too; dimming the whole tile dropped the label below 4.5 : 1 |

## New strings (PLAN §1.15)

None. Every text C2c draws or restyles is Steam's own (found by source text at M3 with GP's `game-pages-locgrep.sh` method where T2/T3 draws it: the sort names in slot 1's state span, "Options", and the filter dialog's labels in the T3 re-render). Scrubber letters are data.

---

## Proposed text for home-apps.md (for C2a: REQ-1)

Each block replaces the named part of `docs/phase2/concepts/home-apps.md`. Section numbers are HA's.

### HA §0.1, the three library rows

| Mockup | Render | Shows |
|---|---|---|
| `home-apps-library.html` | `p2_home-apps_library.png` | Library, laser mode (owner C2c). Steam's tile menu grows from the white More circle of its source poster: compact layout, +10 mm. The source is flat with its glow. The laser-mode ornament: Steam's Sort and Filter in slots 1–2, the shell's Options member disabled while the menu is open, Select and Back as labels only. The letter scrubber |
| `home-apps-library-pad.html` | `p2_home-apps_library-pad.png` | Library, gamepad mode (owner C2c). The focused poster is lifted (+15 mm) with the More circle and Steam's compatibility badge. Steam's legends sit in the same five slots with glyph badges. The scrubber is a passive position cue |
| `home-apps-filter.html` | `p2_home-apps_filter.png` | Library Filters in C1c's sheet frame (owner C2c): Steam's real options as a compatibility pop-up, toggle capsules and collapsed sections. The ornament recedes, with Select and Back lit |

### HA §1.2, item 6

6. **Browsing stays a window.** All Games (or the Library tab) opens window-nav's glass window. It holds:
   - posters;
   - a More circle on the poster you look at or focus, the laser's direct path to a game's menu;
   - a letter scrubber;
   - one bottom ornament of five fixed slots that shows the current sort in both input modes.

### HA §1.3, the "Library Filters" row

| Library Filters | **Worst screen** | 47 rows of 0.86°, 0.49° checkboxes, 3.8 window heights of scroll (LA B.1) | A sheet with a compatibility pop-up, toggle capsules and collapsed sections: about 1,280 px of content (3.3 sheet heights) against Steam's 2,742 px (§9) |

### HA §7 Library catalogue (replaces §7, §7.1 and §7.2)

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

#### 7.1 The ornament in each input mode

Steam renders different controls per mode (INV-L §1.3, §6.1):

- **Laser mode** (`data-lgs-vr-mode="laser"`): the `%{SortAndFilterContainer}` pill (Sort with the current sort, Filter), plus the legend's Select and Back.
- **Gamepad mode:** the legend shows X Filter, Y Sort By, ≡ Options (only while a poster is focused), A Select and B Back.

**Five fixed slots** (PLAN §1.10, inside WN's contract):

- widths 300 · 130 · 156 · 134 · 120 px, gap 4, padding 12, so **880 px in both modes**, centred at x 200–1080;
- members 60 tall at y 640–700;
- each slot's hit box takes its 2 px share of the gaps, so neighbours abut (P-07);
- the capsule's backing is the fixed slot rect, not the measured union of members, so its width never changes when Steam switches modes or drops a legend (C1a's API, REQ-5);
- A and B are quiet trailing members in both modes;
- glyph badges show only in gamepad mode (P-26).

| Slot | Laser mode (`p2_home-apps_library.png`) | Gamepad mode (`p2_home-apps_library-pad.png`) |
|---|---|---|
| 1 Sort (300) | Steam's `%{SortAndFilterButton}` (sort), moved by T1 into slot 1 (WN §3.4.2): sort glyph and the current sort ("Alphabetical") | Steam's legend "Sort By", then C2c's T2 state span " · Alphabetical", then the Y badge. The span uses Steam's sort name from `AppGridDisplaySettings` and ellipsizes inside the slot; the longest name is "% of Achievements" |
| 2 Filter (130) | Steam's Filter button: filter glyph and Steam's "Filter" ("Filter: [icons]" when active) | Steam's legend "Filter" and the X badge. When advanced filters are active, C2c's T2 adds a count badge (a number) |
| 3 Options (156) | The shell's T2 Options member (C1a, WN §3.4.2): ⋯ glyph and "Options" (Steam's legend string). It acts on the frozen target (WN §3.4.3) with the More circle's dispatch, and is disabled (.38) without a target. There is no name suffix in this fixed slot: the More circle stays on the frozen target while the pointer is in the ornament, so the target is shown on its own poster | Steam's legend "Options" and the ≡ badge while a poster is focused. When none is (focus on the tab row), the shell's Options member shows disabled in its place, so the slot never empties |
| 4 Select (134) | Steam's legend "Select", quiet, label only | Steam's legend "Select" and the A badge, quiet |
| 5 Back (120) | Steam's legend "Back", quiet, label only | Steam's legend "Back" and the B badge, quiet |

- **While a modal is open** (Sort or tile menu, the Filters sheet, an alert):
  - In **laser mode**, Steam's pill stays a member, so the ornament stays the 880 capsule. During alerts and sheets it recedes with the window: a black .35 layer, as on the tab bar (WN §3.3.4). Steam's A and B legends, which now act on the modal, stay lit above it (`p2_home-apps_filter.png`). The Options member is disabled during any modal.
  - In **gamepad mode**, Steam's footer holds only A and B, so the ornament is the quiet legend (PLAN §1.10), its items keeping their slot 4–5 places.
- **Source of an open menu:** slot 1 (Sort) or slot 3 (Options) turns white .94 while its menu shows (WN §3.4.2).
- **Input mode:** read only through P3's accessor (`__LGS_RT.input`, `data-lgs-vr-mode`). Tests stub it with `rt.input.stub` (P10's `--mode`), never through Steam's getter (AT-14d).

#### 7.2 The More circle on posters

The circle is the shell's helper (PLAN §1.11, WN §3.4.4). C2c only registers posters and owns the poster's lift and depth.

- **Node.** One decorative node per document. It is moved to the current attention target (gamepad focus, or the laser's dwell) and sits inside its `%{LibraryItemBox}` at the top right, inset 10. It is not focusable, so the gamepad keeps ≡.
- **Click.** A capture-phase listener stops `pointerdown`, `mousedown`, `mouseup` and `click`, so the poster never opens. The helper then calls the poster's own `onMenuButton` from its `Focusable` fiber props, falling back to Steam's `vgp_onmenu` (button 14) on the `%{LibraryItemBox}` (INV-L §0.3) [dispatch PROVEN].
- **Recycling.** Nothing is attached per poster, so the virtualized grid's recycling cannot duplicate the circle. If the target's node is recycled for another app, the helper hides until the next attention event (AT-14b).
- **Fallback:** the ornament's slot 3.

### HA §8 Menus: Sort and the tile menu (replaces §8)

**Owner:** C2c for the library's content; the frames are C1c's (WN §5.1, PLAN §1.12).

Both are Steam's context menus (`BasicUIContextMenu`, INV-L §6.2, §7). **Anchoring** (T2 `translate`) is gated on WN AT-11, GP AT-MENU and SET CQ10: a click outside must still dismiss, and the D-pad must be unchanged. Until those pass, the menus stay centred and still morph from their source.

| | Sort | Tile menu |
|---|---|---|
| Items | 10 actionable sorts, plus Cancel | Install or Play (primary), Add to Favorites, Add to ›, Manage ›, Developer › (developer mode only), Properties..., plus Cancel. That is 6 actions on this device, 5 without developer mode |
| Layout (PLAN §1.12) | ≥ 8: **two columns**, column-major in Steam's order, rows 72 px 6 apart, a 40 px header row, 592 wide, about 508 tall | 6–7: **compact**, 60 px visible on a contiguous 64 px pitch, the game's name as an inline label (19 px Semibold), 400 wide, about 506 tall (`p2_home-apps_library.png`). ≤ 5: one column of 72 px rows with a 40 px header |
| Content | Steam's 10 sorts in Steam's groups; **the current sort carries a white check** (Steam's `.menuChecked`) | The primary row takes its semantic whole fill (Play green; Install and Update blue; Stop red). Submenus open beside the menu (8 px gap) and choose their own layout. Destructive rows follow the count rule (red label for ≤ 2, red glyph for more; red fill on focus); Steam's order and default focus are unchanged |
| Cancel | Steam's row as a 56 px quiet capsule, centred under the rows (HA-11) | Same |
| Source and placement (T2) | Slot 1 (laser: Steam's Sort button; gamepad: the Y legend), white while open. The slab grows upward from the ornament with its bottom ≥ 12 px above it (y ≤ 616), clamped to the modal box | The More circle (white while open), the focused poster (≡), or slot 3. GP §3.4's order for sources in a page row: above; else right, 16 px from the poster; else left; else centred. Vertically centred on the poster and clamped to y 108–616 |
| Depth (PLAN §1.7) | +10 mm, non-interactive, appearing with the materialize (0 → +10 on `depth`); wearer profile +30 | Same. The source poster goes to 0 while its menu is open (rule 6) |
| Motion | `morph-open` 607 ms from the source's rect (clip-path, ≤ 600 × 600); `morph-close` 441 ms (glassd); no scrim | Same |

### HA §9 Library Filters (replaces §9)

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

### HA §10.4, the library rows (replace the library and menu/sheet rows)

| Element | mm | Scene units (r = 1) | Paired cue | Mechanism |
|---|---|---|---|---|
| Library window, ornament | 0 | 0 | — | window-nav (cover; ornament inset slab, WN D-7) |
| Library attention-target poster (and its More circle) | +15 (the reporter's click-safe cap may lower it to +10) | 0.041 | `0 6px 18px` /.50 (P-48) | Non-interactive crop over the window cover; interactive only in the wearer profile |
| Source poster while its menu is open | 0 | 0 | CSS glow | PLAN §1.7 rule 6 |
| Sort and tile menus | +10 (wearer +30) | 0.027 (0.081) | Slab shadow 4 / 12 px | Non-interactive crop + `thick` slab |
| Filters sheet | +10 (wearer +30 → +50) | 0.027 (0.081 → 0.136) | Scrim .35 (Steam's overlay, PLAN §1.8; no `t1` tint) | Non-interactive crop + `thick` slab |

### HA §11, the library rows (replace "Menus", "Filter sheet", "Library tab switch"; add the rest)

| Interaction | Token(s) | Notes |
|---|---|---|
| Library tab switch | C1c's `23-transitions.css`: ±16 px + fade on `page`, replacing Steam's ±40 % slide | Timing only |
| Poster lift | In `hover-in` 294 ms, out `fade` 441 ms; laser after 80 ms of dwell; depth on `depth` (P7) | Rows and tabs never scale |
| More circle | P5's `lgs-mat-*`: materialize 250 ms, dematerialize 350 ms | — |
| Scrubber | Current letter on `snappy`; appears with the materialize | — |
| Menus | `morph-open` 607 / `morph-close` 441 (C1c) | — |
| Filters sheet | `sheet-in` 735 / `sheet-out` 514; scrim on `fade` (C1c) | — |

### HA §12.2 Library tabs and grid (LA A.2), replacement

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| L1 | Switch tab (All Games, Great On Frame, Ready To Play, Collections, Non-Steam, Soundtracks, conditional tabs) | Steam's tab row as a segmented control; the same sets as the Home › Collections folders | Click a segment or a ‹ › circle | LB / RB; or Up to the row + Left/Right |
| L2 | VR sub-filter All / VR / Non-VR (Ready To Play: All / Standalone / Remote PC) | Steam's control in its stock position, as a 64 px segmented control [T1] | Click a segment | Up from the grid + Left/Right + A (stock) |
| L3 | Browse the grid | Steam's virtualized grid, restyled; the attention target lifts | Wheel/drag scroll; an 80 ms dwell lifts | D-pad; Steam scrolls focus into view (guard 124–612) |
| L4 | Fast scroll by letter | Steam's fast-scroll overlay (unchanged) + the letter scrubber [T3] | Click/drag the scrubber (**new**) | Steam's fast-scroll; the scrubber shows the position (passive) |
| L5 | Open a game | Poster activation | Click | A |
| L6 | Sort (10 options, persisted) | Ornament slot 1, the current sort shown in both modes → Steam's Sort menu as the two-column grid, the current sort checked | Click slot 1 (Steam's laser-mode Sort button) | Y |
| L7 | Filter | Ornament slot 2 → the Library Filters sheet (§9) | Click slot 2 (Steam's laser-mode Filter button) | X |
| L8 | Tile menu | The More circle on the attention target [T2, C1a's helper]; ornament slot 3 Options [T2, C1a] | Click the More circle (**new direct path**) or slot 3 (frozen target) | ≡ |
| L9 | "N apps hidden due to filter" (the button variant clears) | Steam's notice as a 60 px capsule above the grid | Click | Focus + A |
| L10 | Back | Toolbar Back circle (WN) | Click | B |

### HA §12.3, rows T1 and T7 (replacement; T2–T6 and T8 unchanged)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| T1 | Primary action Play / Install / Launch / Download / Update | First menu row with its semantic whole fill (compact or one-column layout by count); the Home card's Play capsule; search X (S-C) | Click | ≡ → A; **X on a Home cell or a search item** |
| T7 | Cancel | A 56 px quiet capsule under the rows; click outside (Steam's dismiss) | Click | B |

### HA §12.4 Library Filters (LA A.4), replacement

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| F1 | Frame compatibility level (4, persisted) | A pop-up row at the top of the sheet → its 4-option value menu [T3]; single-choice rows of 80 px [T1] | Click the pop-up, then an option [T3]; click a row [T1] | A, then D-pad + A [T3]; Up/Down + A [T1] |
| F2 | 47 checkboxes in 11 sections + the Gamepad Support and Language dropdowns | Players and Play state as toggle capsules; the other sections as collapsed rows that expand in place into capsules and pop-up rows [T3]; Steam's rows at 80 px with check circles and pop-up rows [T1] | Click | D-pad + A |
| F3 | Store tags / Friends text search | 64 px fields inside their expanded rows | Click → keyboard | Focus + A → keyboard |
| F4 | Reset | The sheet's trailing capsule [T3]; Steam's button at the end [T1] | Click | D-pad Up to the header + A [T3]; D-pad + A [T1] |
| F5 | Save as Dynamic Collection | A 60 px capsule at the end of the content | Click | D-pad + A |
| F6 | Close | The sheet's close circle (C1c) | Click | B |

### HA §12.5, row C1 (replacement; the other rows unchanged)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| C1 | Browse collections | Home › Collections folders (empties grouped); the Library Collections tab (rounded tiles, empties dimmed through a T2 tag) | Click | D-pad + A |

### HA §12.9, row SN-F1 (replacement)

| # | Function | New place | Laser | Gamepad |
|---|---|---|---|---|
| SN-F1 | Footer legend actions (X Filter, Y Sort By, ≡ Options, A Select, B Back) | window-nav's bottom ornament; library routes: the five fixed slots per input mode (§7.1) | Click the slot: Steam's laser-mode Sort and Filter, the shell's Options member, Steam's Select and Back legends | The physical button |

The count stays 59 functions, all mapped, none dropped.

### HA §13, the library rows (replace "Library ornament slots", "More circle in posters", "Letter scrubber", "Anchored menus", "Filter sheet with chips")

| Element | Tier | Evidence | Status | Fallback |
|---|---|---|---|---|
| Library ornament slots | T1 + T2 | WN §3.4 (ornament from `#Footer`); the laser pill is laser-only, so moving it cannot change D-pad order (INV-L §6.1); fixed backing through C1a's API | PLAUSIBLE | Steam's pill and legend restyled in place, in the capsule material (WN's no-T2 fallback) |
| More circle on posters | T2 (C1a's helper) | The host's `onMenuButton` (SM-D15); the `vgp_onmenu` dispatch opens the capsule menu (INV-L §0.3) | Dispatch PROVEN; capture-phase isolation PLAUSIBLE | Ornament slot 3 |
| Letter scrubber | T3 + a T1 padding | `scrollTop` on Steam's grid scroller (a wheel-equivalent); the 6-column check after the padding | PLAUSIBLE | Steam's fast-scroll; wheel and drag |
| Anchored menus | T2 | WN AT-11, GP AT-MENU, SET CQ10 | UNPROVEN | Centred menus that still morph from the source |
| Filters content | T3 | Type swap of Steam's filter dialog component (SR §3.4 technique) | PLAUSIBLE | T1 restyle of Steam's dialog (§9) |

### HA §14, acceptance tests (the library parts)

General rules as HA §14. In addition:

- **Filter state:** filters and sorts are persisted (`AppGridDisplaySettings`, `collectionsAppFilterVR`, the compatibility level). Tests **never** select a sort, a filter option, Reset or Save. Activation goes through P2's action logger or a spy on Steam's setter, which logs `{fn, arg}` and does not run (never-list).
- **Input mode:** switched only with P10's `--mode laser|pad` (P3's `rt.input.stub`).

| ID | What | How | Pass |
|---|---|---|---|
| AT-6 (library part, C2c) | No functional loss | `glass.py audit main --route /library/tab/AllGames` with `--mode laser` and `--mode pad`; the same on `/library/tab/Collections`, `/library/tab/DesktopApps` and `/library/collection/<VR id>`; and on AllGames with `--pre` the Sort snippet, the capsule-menu snippet (`vgp_onmenu`) and the Filter snippet (INV-L §0.3), each in both modes, with `wp.c2c` off and on | 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST, apart from §1.16's E-SEG and E-MENU. No legend node has `display: none`. The laser-mode glyph collapse is not counted (WN §3.4.2) |
| AT-7 (library part, C2c) | Sizes, type, outlines | `glass.py gates main --route /library/tab/AllGames` in both modes, bare and with each of the three `--pre` snippets | **G-SIZE:** every focusable ≥ 80 × 80 or its exemption (segments: E-SEG, ≥ 60 × 140 and contiguous; menu rows: E-MENU). The More circle is 60 visible with an 80 hit, fully inside its poster (WN AT-26). The scrubber is 60 visible with an 80 hit. Ornament members are 60 tall with abutting hit boxes. Toggle capsules are 60 visible with an 80 hit. Filter rows are 80. **G-TYPE:** no text under 18 px, no weight under 500, no uppercase, tracking > .01 em or italics in chrome (tab labels, the sub-filter, section headers, collection labels, legends). **G-OUTLINE:** no outline or 1 px ring on posters, tabs, the ornament, menus or the sheet |
| AT-14 | Library | (a) **More circle:** under `--mode laser`, `L.click` on the More circle over a poster. (b) **Recycling:** scroll the grid 2,000 px and back (`scrollTop`, a wheel-equivalent). (c) **Scrubber:** under `--mode laser`, click "M"; under `--mode pad`, 5 × `L.pad` Down. (d) **Both modes:** `--mode laser`, then `--mode pad`, on `/library/tab/AllGames`: shot and audit each; click every slot through the action logger and spies (Sort and Filter open Steam's menu or dialog, which is then closed with B; Options logs its dispatch; A and B log Steam's legend dispatch). (e) **Depth** (M4, in `glass.py native-session`): `glass.py sgcheck` with a poster focused (pad) and dwelt (laser), then with the tile menu open, then with the Filters sheet open. (f) **Sort label:** open the Sort menu (look only) | (a) The route is unchanged; the menu's labels equal those ≡ opens on the same poster; the log shows the host's `onMenuButton` (or the `vgp_onmenu` fallback); the menu is closed with B, never by an item. (b) At most one More node in the document; it is hidden or inside the current target's `%{LibraryItemBox}` (same appid), never on another poster. (c) Laser: the first fully visible poster's title starts with the first letter ≥ "M" that exists. Pad: the scrubber has no focusable, and its current letter equals the focused poster title's first letter. (d) The ornament is 880 ± 1 px wide in both modes (PLAN-2c-1); all 5 slots are present; every slot's click is handled. (e) One pop at +15 mm (0.041 ± 0.005 u at r = 1; +10 if the click-safe cap applies) with `interactive: false`. With the menu open: the menu at 0.027 u and the source poster not popped (rule 6). With the sheet open: the sheet at 0.027 u and nothing else. ≤ 4 distinct dz on the route. Each lift's shadow within P-48. (f) The checked row equals slot 1's label in both modes |
| AT-15 | Filters | (a) The Filter snippet in both modes, then `L.pad` through every control of the sheet, T3 and T1. (b) `glass.py audit main --pre <Filter snippet>` in both modes, T3 and T1. (c) The sheet's crop (M4). (d) Spies: activate each toggle capsule, pop-up option, Reset and Save through the action logger. (e) Rect scan of the sheet | (a) Every control is reachable; Down-Up returns; B closes the sheet and focus returns to its source (slot 2, P-21). (b) 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST; in T3 every Steam filter control has a twin bound to the same setter: the compatibility level, the 47 options, 2 dropdowns, 2 text fields, Reset, Save. (c) The sheet at +10 mm (0.027 u), `interactive: false`, and no other pop. (d) Every call equals Steam's own row's setter and arguments (identity check), logged, not run. (e) The sheet is ≤ 960 wide inside 108–628; the close circle is at (24, 24) of the card; toggle capsules are 60 visible with 80 hits; rows are 80; text ≥ 18 px; the T3 content is ≤ 1,400 px tall |

The card's own tests also stay: PLAN-2c-1 (ornament 880 ± 1 in both modes), PLAN-2c-2 (`glass.py cmp` against `home-apps-library.html`, `-library-pad.html` and `-filter.html`, with `docs/phase2/wp/C2c-cmp.json`), and G-PAD on AllGames, including Up to the sub-filter and the tab row and back.

### HA §15, row 12 (replacement)

| 12 | window-nav's laser-mode ornament dropped the A/B legends that Steam renders in laser mode | Resolved by PLAN §1.10: A and B are never hidden; the library keeps them in slots 4–5 in both modes |

### HA §16, row 4 (replacement)

| window-nav | Library routes: the five fixed slots per input mode (§7.1) inside WN's ornament contract; the More circle is WN's helper registered on posters (§7.2); the Filters content inside WN's sheet frame (§9) | §7.1, §7.2, §9; WN §3.4.6 |

---

## Log

### 2026-10-07, session 1: M0 conformance

- Start-of-session request check: none (see "Requests to C2c, handled").
- Read: PLAN §0, §1, §2.1, §2.3, §2.4, §2.6, §4, §7; HA (all); XC; WN §3–§5 (the revision-3 text C1a is writing); CTL §4, §5, §8, §10; VP §6; D2 §6.7, §7.8, §10.4, §12; INV-L §1.3, §1.4, §3, §4, §6, §7; LA A.2–A.5. Contracts: `interaction.md` (P3), `tokens.md` (P4), `reporter.md` (P6), `lab.md` (P10). Logs: C1a (ornament, More and frozen-target interface), C1c.
- Reference shots looked at: `library_tab_allgames.png` (Steam's grid geometry: 172 × 258 at a 204 px column pitch, x 44–1236, rows at a 300 pitch), `library_capsule_menu.png` (tile menu items; footer Select and Back with a menu open), `library_filter_dialog*.png` (real options; footer Select and Back only).
- Rebuilt `home-apps-library.html`, `home-apps-library-pad.html` and `home-apps-filter.html`: library styles inline (`lc-` prefix), real data from `docs/refs/library/` (unchanged; `fetch-library-refs.py` not re-run, since nothing new was needed), and `data-id`s for G-MOCK.
- Re-rendered `shots/p2_home-apps_library.png`, `_library-pad.png` and `_filter.png`. These are the renders of C2c's own mockups, re-rendered as M0 requires; the PLAN §2.6 freeze of earlier `shots/p2_*` covers inputs, not an owner's own re-renders.
- No device steps (M0 is documents and mockups only); the device was not touched.
- End-of-session request check: none.

### 2026-10-07, session 2: M2 (T1), M3 (T2), the T4 fragment, verification

- Start-of-session request check: three requests to C2c (C1a, C1c, C2a), all handled (see "Requests to C2c, handled").
- Read: card, Status, C1a's and C4a's announced interfaces, `contracts/tokens.md` (names), `runtime.md` §1–§3, `reporter.md` §3–§4, §9, `lab.md` §1, §4 (gates, pad-bfs, sgcheck, hv, native-session), §6; C1a's footer CSS and `ornamentSlots` / `more.register` code; C2a's Home tab and poster rules (to share the look).
- Built `theme/40-library.css` (T1, from scratch; the Phase 1 file is replaced), `device/rt/40-library.js` (T2, `wp.c2c`), `theme/layers/40-library.json` (T4). Work in progress lived in `theme/_wip/40-library.css` and `device/rt/_wip/40-library.js`; each copy into `theme/` / `device/rt/` passed `check-theme` before `sync`.
- Device findings that changed the plan:
  - (a) C1a's glass clip cuts the laser pill in the ornament; it became D-C2c-12.
  - (b) Steam pins the tab header with `position: absolute` in the tabbed page (y 40). The header moves by `top` and the grid by its scroller's `padding-top`, and the page root keeps Steam's height, so the scroller still ends at y 720.
  - (c) The legacy layer rules `tabs` and `tab-arrow` popped C2c's recessed track and arrows at 4.43 mm: the track moved to `%{TabRow}::before` and `tab-arrow` is superseded.
  - (d) Steam's tab scroller has a 2 px gap, which broke E-SEG contiguity (fixed: `gap: 0`).
  - (e) Steam's 300 ms poster transform transition beat C2c's tokens on specificity (fixed with `!important`).
  - (f) Steam's Filters card is the `%{DialogWrapper}` scroller, which C1c's sheet rule does not reach (REQ-10).
  - (g) Steam's checkbox lines in the Filters were 38 tall with 14 px labels (fixed: fill the 80 px row, 24 px label).
  - (h) Collection counts are 20 px focusable tooltip sources (D-C2c-15).
- Native: P7 is at M1, not M3. The user's request this round was "still do native glass work", so the fragment was written and checked in two `native-session` runs (S2-N1, S2-N2). One `hv --look` frame was viewed and deleted at once on both machines (`hv --clean`; `/tmp/lgs` holds no `hv-*`).
- Device left as found: theme on in CSS-only mode (each native session ended "back to CSS only: yes"), route `/library/tab/AllGames`, no menu or dialog open, every flag per-step (popped at lock exit; checked: `library` module `off`, no `data-lgs-lib-sort` / `data-lgs-exempt` / `data-lgs-empty` attribute left).
