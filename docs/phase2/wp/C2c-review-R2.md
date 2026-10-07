# C2c Library catalogue: review, round R2

Reviewer: quick reviewer (independent of the builder). Date: 2026-10-07, 16:23-16:48. Steam build 11094443.
Scope: a quick review, as the user asked ("go through these reviews a little faster"): `gates` on the main route `/library/tab/AllGames` in both input modes, one `pad-bfs`, one shot per mode set beside the mockups, and a reachability check of the catalogue's key functions. No native session, removal sweep, perf run or full conformance was run in this pass. Only what a user would notice is reported.

An earlier full audit of C2c ran from 13:28 to 16:07 and was stopped before it finished (its text is kept as **Appendix A**, as evidence). C2c's files have not changed since the builder's session (`40-library.css` 10:13, `40-library.js` 09:00, `40-library.json` 10:04), and no file in `theme/`, `theme/layers/` or `device/rt/` has changed since 15:00. So that audit's live measurements from session 2 (15:16-16:05) still describe the current build. Findings carried from it below say so and give its id; I re-checked Q1 live in this pass and looked again at the shots for Q2, Q3 and Q4.

## Status

**Done** (16:48). Verdict: **fix**. Edited only this file. Device: every step ran through the lab with `--flags wp.p3,wp.c1a,wp.c2c`; each step restores its own flags, mode and route. Afterwards `status` showed the theme on. No native session, no hover left (the lab parks the pointer), no hv frame taken.

## Verdict

**fix: 0 blockers, 9 majors.** The catalogue keeps every function with a laser path and a gamepad path, and on the main route it passes every gate in both modes. At rest it reads as a visionOS window: a segmented tab row, posters without Steam's rings, a lifted focus target with its More circle, a toolbar Sort & Filter pill, and an ornament that hugs Steam's legends. A user would still meet these problems:
- the cut "Sort By · Alphabetica" legend;
- a Filters sheet with the close button on its title, and gamepad focus hidden below the card's edge;
- an illegible Sort pill while its menu is open;
- focused items under the ornament or cut by the window edge;
- gamepad focus that cannot be seen on a selected segment;
- laser hover on collection tiles that is still Steam's blue;
- a 30 % frame-rate drop;
- the laser fast-scroll path and the compact Filters sheet are not built, so Filters is 12 screens of scroll.

## What this pass ran

| Id | Command | Native | Result |
|---|---|---|---|
| Q-G1 | `python glass.py gates main --route /library/tab/AllGames --flags wp.p3,wp.c1a,wp.c2c --mode laser --shot p2_c2cq_ag_laser` (16:26) | off | **PASS**: MOTION 0, SIZE 0 (8 exempt, 13 obscured skipped), TYPE 0, OUTLINE 0 (4 edge probes, 41 pseudo-elements), AUD 0 (21 exempt) |
| Q-G2 | the same with `--mode pad --shot p2_c2cq_ag_pad` (16:40; two earlier tries hit "lab: lock busy for 240 s") | off | **PASS**: MOTION 0, SIZE 0, TYPE 0, OUTLINE 0 (42 pseudo-elements), AUD 0 |
| Q-B1 | `pad-bfs --route /library/tab/AllGames --flags wp.p3,wp.c1a,wp.c2c --mode pad --max 40 --budget 200` (16:43, 116 s) | off | 48 nodes, 308 moves, **0 irreversible**, 6 exits (Left at a row start, all brought back by `overlay`). Every tab (route changes to GreatOnFrame, ReadyToPlay, Collections, DesktopApps, Soundtracks), the ALL / VR / NON-VR segments, the search box and the posters are reached. Not gamepad-focusable on stock either: ‹ ›, and the pill's Sort and Filter (laser-only, Steam's `focusable: false`). Overall FAIL only because 7 posters further down (y 1171-1471) and the fast-scroll overlay were not reached in the budget. The earlier audit's long sweeps (R-B2 themed, R-B3 stock, 15:41-15:51) left the same kind of set unreached in both, so this is parity, not a regression. Two artifacts, not counted: the entry focus was the search box (the earlier themed and stock sweeps both entered on the first poster), and B went back to `/library/tab/Collections` (route history left by earlier steps) |
| Q-S1 | the two `--shot` captures above, viewed next to `shots/p2_home-apps_library.png` and `shots/p2_home-apps_library-pad.png` | off | See "Shots" below |
| Q-K1 | `python glass.py status` (16:46) | — | Theme on (`enabled: true`) |

Raw output: the session scratchpad, `…/scratchpad/c2cq/` (`g_laser.txt`, `g_pad.txt`, `bfs_pad.txt`, `bfs.json`).

## Shots against the mockups

- **Laser** (`shots/p2_c2cq_ag_laser.png` against `p2_home-apps_library.png`):
  - What matches: the Large Title "Library" and the search capsule; the segmented tab row ("All Games 350" selected white, then Great On Frame, Ready To Play, Collections, Non-Steam), with ‹ › circles; the sub-filter as a segmented control; posters with Steam's outline and shine gone; the ornament.
  - Deliberate changes since the mockup (R2-2, D-C2c-12, adopted): the Sort & Filter pill sits at the toolbar's trailing edge, and the ornament hugs its members ("Filter · Sort By · Alphabetical · Options · Select · Back").
  - Differences: the pill nearly touches the search capsule (Q8); the sub-filter reads "ALL · VR · NON-VR" in capitals; there is no scrubber (Q9).
  - Glass edges come from the material; I saw no outline.
- **Pad** (`shots/p2_c2cq_ag_pad.png` against `p2_home-apps_library-pad.png`):
  - What matches: the focused first poster lifts, with a soft glow and its More circle at the top right, as drawn. The ornament carries badged legends: Filter X, Sort By Y, Options ≡, Select A, Back B.
  - Differences: the Y legend is cut to **"Sort By · Alphabetica"** with no ellipsis (Q1); there is no scrubber.

## Key functions (reachability)

Every catalogue function is reachable by laser and by gamepad, and none is lost.

| Function | Laser | Gamepad |
|---|---|---|
| Tabs and ‹ › | Clicked; AUD 0, so no element is gone, hidden or unclickable (Q-G1) | Left/Right switch tabs (Q-B1) |
| Sub-filter | Clicked (Q-G1) | Up from the grid, then Left/Right (Q-B1) |
| Browse and open a game | Wheel and click | D-pad and A (posters reached in Q-B1) |
| Sort | The pill's Sort opens the Sort menu (audit R-M3, R-G9) | Y legend (Q-S1); the same menu |
| Filter | The pill's Filter opens the sheet (audit R-G8) | X legend; the sheet (audit R-M4) |
| Tile menu | The More circle opens the same menu as ≡ (audit R-M3) | ≡ legend; the More circle shows on focus (Q-S1) |

The "audit" rows were measured live at 13:52-15:38 on the same files.

## Findings

### Blockers

None. No function is lost, nothing crashed, and there is no safety problem.

### Major

**Q1. The gamepad Y legend is cut mid-word: "Sort By · Alphabetica".** Re-checked live in this pass: `shots/p2_c2cq_ag_pad.png` (16:40); also the audit's M6.
- `#Footer [data-lgs-btn="OPTIONS"]` is capped at 300 px (`40-library.css` ~662), and the sort name is drawn by the label's `::after`. The text is clipped and the ellipsis never draws.
- Longer sort names ("% of Achievements Complete") lose most of their text.
- No gate catches it: AUD and G-TYPE do not see a clipped pseudo-element. HA §7.1 and R2-2 say "ellipsizes".
- Fix: let the slot fit "Alphabetical", and make the sort name ellipsize with "…".

**Q2. Library Filters: the close button sits on the title.** (audit M5; `shots/p2_c2crev_filter_pad.png` and `_filter_laser.png`, 15:32-15:33, viewed again here)
- C1c's × circle is at the card's (24, 24), as agreed. C2c's content puts "Library Filters" at (346, 160), so the circle covers its first 48 px: the × sits on "Li".
- HA §9 also asks for the title to be centred; it is start-aligned.
- Fix: start the card's content below the close row (C1c's `[data-lgs-sheet="close"]` gives other sheets 88 px of top padding; C2c's `%{DialogWrapper}` card is outside that rule).

**Q3. Library Filters opened with the gamepad: the focused row is hidden below the card's edge.** (audit M19; same shot)
- Steam focuses the active compatibility row ("All Games") at y 586-685, but the card ends at 596. Only a 10 px white strip of its focus fill shows along the bottom edge, in the CSS shot and in the headset.
- Nothing scrolls it into view: `scroll-padding-block` is set, but no scroll happens.
- A gamepad user opens the sheet and cannot see where focus is (VP P-23 intent). Stock's 520 px dialog shows the row.

**Q4. The Sort pill is illegible while its menu is open: contrast 1.1 : 1.** (audit M3, R-G9 15:38; `shots/p2_c2crev_sort_laser.png`, viewed again here: "Alphabetical" in the pill is dim grey on dark glass)
- C1c's source rule `[data-lgs-menu-source="white"]` (`22-presentations.css` ~714) sets the white fill with `!important` and makes the label dark.
- C2c's `%{SortAndFilterButton} { background: none !important }` (`40-library.css` ~588) has the same specificity and comes later, so the fill is lost while the dark label stays.
- PLAN §1.4 asks for the source of an open menu to be white .94 with label #0d0e12. Fix in C2c's rule, for example `:not([data-lgs-menu-source])`.

**Q5. Gamepad focus moves under the ornament, and on Collections the window edge cuts it.** (audit M1: `p23b.js` 15:40, `pad23.js` 14:42, `conformance --pad` 14:21)
- Collections tab: the second row of tiles lands at y 468-663, 35 px under the ornament (628) and past the glass bottom (656). The window clip cuts the focused tile, and that grid does not scroll.
- VR collection: the last row is at 368-640.
- AllGames: one move ended at 387-658.
- Cause: `%{TabContentsScroll}` has `scroll-padding-bottom: 108px`, but only Steam's 40 px of content padding at the end. Steam's ×1.053 focus scale is not counted. The page needs bottom room equal to the guard (VP P-23 "must", PLAN R2-11's 612 bound).

**Q6. Gamepad focus on a selected segment or tab is nearly invisible.** (audit M2: `focus` gate 13:54 on the main route, `shots/p2_c2crev_focus_3.png`, viewed again here)
- With ALL both selected and focused, the only difference from the laser shot is a faint halo.
- G-FOCUS fails on AllGames:
  - P-16 band: +5.8 L on the tab and +8.6 L on the segment (needs ≥ +20);
  - P-15: −142.7 L (a focused VR segment against the selected ALL).
- A user moving Up from the grid cannot tell that focus reached ALL.
- Needed: a stronger focus ring on white-selected segments, or a coordinator ruling for segmented controls (C1b's review R2 found the same on `/search`).

**Q7. Laser hover on a collection tile is still Steam's light-blue hover: no dwell, no lift.** (audit M8: `colldwell.js` 15:54; `shots/p2_c2crev_coll_hover.png` against `_coll_hover_stock.png`)
- D-C2c-15 spreads Steam's count tooltip source over the whole tile, so the laser's hit target is the tooltip source. P3 sets no `.lgs-dwell`, and C2c's lift rule (`:is(.lgs-dwell:hover, .lgs-attend-80)`) never engages.
- The gamepad path lifts the tile. The laser path looks like stock Steam, with no glass hover (P-89 parity, P-19).

**Q8. The frame rate drops by 30 % on AllGames.** (audit M11: `perf main --route /library/tab/AllGames --ab stock`, 14:09, 16 runs pooled, native off; not re-run in this pass, which skips perf)
- Stock had a median of 81.5 fps and 2 long frames; themed had 56.95 fps and 12 long frames. The ratio is 0.70 against the ≥ 0.95 gate (PLAN §4.1, R2-13).
- Scrolling the library is where a user feels it. C2c owns the route's share (REQ Coordinator->C2c (3), still open).
- Suspects to bisect with P4's `fontkit.py --perf-js` method:
  - the full-width `backdrop-filter: blur(12px)` band on `%{TabHeaderRowWrapper}::before`;
  - the per-poster `box-shadow` transitions.

**Q9. The laser fast-scroll path and the compact Filters sheet are not built.** (the C2c log's "Not built"; audit M15, R-M4)
- Not built: the T3 letter scrubber (HA §7: the laser's way to fast-scroll 350 games; stock has none, so nothing is lost), the T3 Filters re-render and the filter-count badge.
- What a user meets instead: the T1 fallback card holds every control, but it is **5,809 px of scroll in a 488 px card**, about 12 sheet heights, against HA's T3 target of ≤ 1,400 px.
- The package is marked READY while three of the card's build items are missing (PLAN §2.1 definition of done).

Not re-ranked here, but each needs a decision before C2c is accepted:
- **R2-2 check 2 fails.** The pill sits 6 px from the search capsule on section roots and needs ≥ 20 (audit M4). It is visible in both shots of this pass: the two capsules nearly touch. REQ Coordinator->C2c item 1 is open.
- **G-DEPTH fails in native laser mode.** The legacy `card` rule pops a poster that still holds Steam's stale `.gpfocus` at 2.95 mm, next to the dwelt poster at 15 mm (audit M20, native session 15:59). This is the everyday laser state on AllGames. C2c's layer fragment should keep `card` off library posters while `wp.c2c` is on.

### Noted, not counted in this pass (polish, other routes or process)

- The sub-filter reads "ALL · VR · NON-VR" (Steam's own strings in capitals; P-84; audit M7).
- Laser AUD on other routes (Non-Steam, Soundtracks, the VR collection, sheet or menu open) reports `GONE "SELECT"` / `"BACK"`. It is a DOM-path artifact of C1a's Options member, and the legends are present (audit M9, owners P10 and C1a).
- G-SIZE on Soundtracks in laser mode (M10).
- A 100 ms non-token transition on the sheet's entry (M12).
- After `wp.c2c` turns off, the More circle stays clickable until attention moves (M13, root cause C1a's `register().remove()`).
- A 4 Hz idle poll (M14).
- Process gaps: no AT-14 or AT-15 evidence, no `C2c-cmp.json`, mockups not re-rendered for R2-2, and REQs to C2c not marked `[x]` where they were filed (M16-M18).
- Other owners, seen on C2c's routes:
  - the tile menu's header overruns its slab (C1c, O1);
  - with a real laser hover on a poster, the ornament shows only "Options · Back" (C1a, O7).

## Requests

None filed (this review edits no other file). C2c should answer REQ Coordinator->C2c (items 1-4, `wp/coordinator.md`) and file the owner issues listed in Appendix A section 6.

## Appendix A: the interrupted full audit (13:28-16:07), kept as evidence

This is the earlier full audit's text, with its headings demoted and nothing else changed. It stopped after its native session (15:53-16:05); the "session 2" steps it announced in its section 5 were not run. Its finding ids (M1-M20, m1-m9, O1-O9) are the ones the quick review cites. Its verdict and counts are superseded by the list above, which keeps only what a user would notice.

Incidents it disclosed (still relevant to other agents' measurements from that window):

- Session 1 left provisional notes (kept in the scratch, superseded by this text).
- **Incident to disclose (session 1).** My CSSOM A/B probe for G-PERF (`perfab.js`, 14:15-14:18, `--flags wp.p3,wp.c1a,wp.c2c --mode pad`) deleted and re-inserted `40-library.css`'s top-level rule from its serialized `cssText`. Chromium's serialization dropped every `var()` shorthand (`font`, `background`) in that rule, so `main` ran C2c's rules without those declarations until the sheet was re-parsed (another agent's theme reload, before 14:41). At 14:41 and again at 15:31 (`sheetcmp.js`) main's sheet was identical to the bar's (67 rules, 0 differences). **Any agent's library measurement between about 14:15 and 14:41 may have seen C2c's rules without those declarations.** Every step of mine from that window was re-run in session 2 (the four shots, P-21, P-23).
- Also disclosed: in session 1 two of my pres (`motion_sheet` 13:57, `shot_filter_pad` 14:19) armed a 7-9 s timer that cancelled any dialog still open in `main` (`vgp_oncancel`, never a confirm) and, if one remained, navigated `main` to `/library/home`. If another agent's step had a dialog open at that moment, it was cancelled. Session 2's pres have no timers (the lab's own restore closes what a step opened).

Its own verdict, for the record: **fix.** The catalogue's T1 skeleton is good: the tab row as a contiguous segmented control with ‹ › circles, Steam's grid untouched with its outline, pulse and shine gone, the attended poster lifting with its More circle, the toolbar-trailing Sort & Filter pill, an ornament that hugs Steam's legends and stays centred, the Sort grid and the compact tile menu anchored to their sources, and a Filters card in the sheet frame. Function retention holds in both input modes. But the package is not READY: P-23 fails on every library route (the last row and the Collections second row sit under the ornament, one is cut by the window edge), gamepad focus is nearly invisible on a selected segment (G-FOCUS), the Sort pill's open-menu state is illegible (1.1 : 1), R2-2's 20 px spacing is not met, the Filters title sits under the close circle, the Y legend is cut mid-glyph, G-PERF fails at 0.70, the laser gates fail on four states, removal leaves a live More circle, and the card's T3 scrubber, T3 Filters and filter-count badge are not built while AT-14, AT-15 and PLAN-2c-2 were never run. **0 blockers (native pending), 18 majors, 9 minors**, plus 8 issues owned by other packages that C2c should file.

### 1. What was run

All live steps through `python glass.py …` with `--flags wp.p3,wp.c1a,wp.c2c` (plus `wp.c1c` for menus and the sheet) and `--mode laser|pad`. Native state per step is noted; "native=on" means another agent's native session was live when the step started (layout probes only). Scripts and raw outputs: the reviewer's scratch, `…/scratchpad/c2c/` (session 1) and `…/scratchpad/c2c/r2/` (session 2).

| Id | Command | Native | Result |
|---|---|---|---|
| R-G1 | `gates main --route /library/tab/AllGames` laser, pad (13:36-13:37) | off | **PASS** both (AUD 0, SIZE 0 with 8 E-SEG, TYPE 0, OUTLINE 0, MOTION 0) |
| R-G2 | `gates` on `/library/tab/Collections` laser, pad (13:38-13:39) | off | **PASS** both |
| R-G3 | `gates` on `/library/tab/DesktopApps` laser, pad (13:39) | off | pad PASS; **laser AUD FAIL** `GONE text "SELECT"` (M9) |
| R-G4 | `gates` on `/library/collection/uc-QEu45ND5z53u` (VR) laser, pad (13:40-13:41) | off | pad PASS; **laser AUD FAIL** `GONE text "BACK"` (M9) |
| R-G5 | `gates` on `/library/tab/Soundtracks` laser, pad (13:43-13:44) | off | pad PASS; **laser FAIL**: AUD `GONE "SELECT"` (M9), SIZE P-08 on a square poster "hit 81 % own, 19 % other (lgs-more)" (M10) |
| R-G6 | `gates … --hover "%{CSSGrid} %{LibraryItemBox},900" --only size,outline` laser (14:42) | off | PASS (lifted poster with its More circle) |
| R-G7 | `gates /library/tab/Collections --hover "%{GamepadLibrary} %{Collection},1600" --only size,outline` laser (14:49) | on* | **OUTLINE FAIL**: hovered tile edge ratio .788 / .728 "visible" (M8); `lgs-pointer` 1.5 px ring (C1a's proxy, native) |
| R-G8 | `gates … --pre <click the pill's Filter> --only aud,size,type,outline` laser, `wp.c1c` (15:37) | off | **AUD FAIL** `GONE "SELECT"` (M9); SIZE, TYPE, OUTLINE PASS |
| R-G9 | `gates … --pre <click the pill's Sort>` laser, `wp.c1c` (15:38) | off | **FAIL**: AUD CONTRAST `"ALPHABETICAL" 20.2 -> 1.1` (rooms 1.5 / 2.2 / 1.1) (M3); AUD `GONE "SELECT"` (M9); E-MENU Cancel "fill 188 x 56 on a 192 x 60 element" (O2) |
| R-G10 | `gates … --pre <gpTake poster, vgp_onmenu>` pad, `wp.c1c` (15:38) | off | AUD PASS; **E-MENU Cancel fill 56** (O2) |
| R-M1 | `js geom.js` (rects, hits, legends, scroller) AllGames pad (13:31); VR collection laser (13:51) | off / on | R2-2 checks 1 and 3 PASS; **check 2 FAIL** (M4); legends, `data-lgs-lib-sort`, tabs E-SEG 22 px no transform |
| R-M2 | `js more.js` pad and laser (13:33) | off | More circle 60 visible / 80 hit inside its poster (inset 10.0 / 10.0 laser, 10.5 / 10.4 pad); after Right × 2 it sat at 16.5 / 14.5 until the next move (m3) |
| R-M3 | `js menus.js` pad and laser, `wp.c1c` (13:52-13:53) | on / off | Tile menu: compact, 400 × 502 at y 114-616, 6 rows on a 64 pitch + Cancel 192 × 60, 16-20 px right of its source, source `glow`, More circle `lgs-more-open`. Sort: grid 592 × 508, 10 rows 284 × 72 + Cancel, title "Sort By", Alphabetical checked, pill source `white`. Same items via ≡ and via the More circle (AT-14 a) |
| R-M4 | `js filters.js` pad, laser, and pad without `wp.c1c` (13:53-13:54) | off | Card 660 × 488 at (310, 108); thick + .62 tint, radius 44, no border, `lgs-sheet-in`; scrim .35; close circle (334, 132) 60 × 60 over the title (346, 160) 192 × 37 (M5); 4 compat rows (the last 99 tall, m4); 47 filter rows; `scrollHeight` 5,809 / 488 (M15); B closes it |
| R-M5 | `js p21.js` themed (`wp.c1c`) and `--stock`, pad (14:18; re-run 15:41) | off | After B on the tile menu and on the Filters sheet, no window holds `.gpfocus`, **identical on stock**: parity, no C2c finding |
| R-M6 | `js pad23.js` (14:42), `js p23b.js` (15:40), pad | off | **P-23 FAIL** on every library route (M1) |
| R-M7 | `js recycle.js` pad and laser (15:39) | off | AT-14 (b) **PASS**: one node; pad: it follows its host off-screen and back; laser: hidden after the scroll |
| R-M8 | `js remove.js --flags wp.p3,wp.c1a` (13:55), `js moreflag.js` (15:40), `js stock.js --stock` (13:55) | off | Flag pop: C2c's 7 marks → 0, module `off`, fixed-slot API cycle clean; **the More circle stays shown and clickable** (M13). `--stock`: 0 `data-lgs-*`, 0 `lgs-*` classes, no inline `--lgs` on main, frame.menu, bar; Steam's pill back at (1005, 628), header `top` 0 |
| R-M9 | `js sortidle.js` pad (13:52) | on | Module tick 250 ms on every route: 0.063 ms/tick on AllGames, 0.054 Collections, 0.003 Downloads (M14) |
| R-F1 | `focus main --route /library/tab/AllGames --pairs pairs_ag.json --keep p2_c2crev_focus` pad (13:54); band re-measured offline (`r2/band.py`) | off | **G-FOCUS FAIL** (M2): P-14 VR segment +71.1 PASS; P-15 focused VR vs selected ALL **−142.7**; P-16 band (lab, from the 80 px box) **+5.8** tab, **+8.6** segment; from the 60 px visible fill, above and below only: +18.3 / +18.6 |
| R-B1 | `pad-bfs --route /library/tab/AllGames` pad (13:56), VR collection (13:57) | off | 4 nodes each: Left from the first poster `exit:none`, never recovered (tool limit) |
| R-B2 | `pad-bfs … --max 60 --budget 300` pad (15:41-15:45) | off | 67 nodes, done; 41 unreached (posters past the sweep, ‹ ›, fast scroll, the laser-only pill); 13 exits (Left at a row start, all back by `overlay`); 3 irreversible: Up from posters 2, 12, 30 → ALL, Down from ALL → poster 6. Stock: R-B3 |
| R-T1 | `motion … --pre "@hover <poster>,300" --name c2crev_lift` laser (13:57) | off | **PASS**: tokens, nothing at rest |
| R-T2 | `motion … --pre <X on a poster> --name c2crev_sheet3` pad, `wp.c1c` (15:45; first run 13:57) | off | **FAIL** both runs (M12) |
| R-C1 | `conformance` (3 routes) laser (14:01); `--pad --only P-13,P-20,P-22,P-23` pad (14:21) | off | Section 4 |
| R-P1 | `perf main --route /library/tab/AllGames --ab stock` (14:09) | off | **FAIL** (M11) |
| R-S1 | shots `p2_c2crev_{ag,coll,nonsteam,vrcoll,sound}_{laser,pad}` (13:36-13:45), `_focus_0..3`, `_ag_hover(_g)`, `_coll_hover(_g)`, `_filter_{pad,laser}`, `_tile_laser`, `_sort_laser` (15:32-15:37); `cmp` against `home-apps-library.html` and `-pad.html` (13:47) | off | Viewed composited over grey (the Read view drops alpha). Section 3 |
| R-L1 | `ledger --out <scratch>` (13:42) | — | 28 rows owned by C2c: 27 `open`, 1 `partial` (M16) |
| R-B3 | `pad-bfs … --stock --max 60 --budget 300` pad (15:45-15:51) | off | Stock: 67 nodes, 41 unreached (the same set: ‹ ›, fast scroll, the pill, posters past the sweep), 13 exits, 3 irreversible of the same kind (Up from a first-row poster → the selected sub-filter segment, Down → the poster under it). Themed and stock match: G-PAD parity, no C2c regression |
| R-H1 | `gates … --hover <poster>,900 --only aud` laser (15:51) | off | AUD **PASS** with the hover held in both states |
| R-H2 | `shot … --hover <poster> --stock` laser (15:51) | off | Stock's footer under a real laser hover on a poster: X Filter, Y Sort By, ≡ Options, A Select, B Back plus the pill (O7 is not stock behaviour; see O7) |
| R-H3 | `shot /library/tab/Collections --hover <tile> --stock` laser (15:52) | off | Stock: the hovered tile in light blue (the themed tile shows the same blue, M8) |
| R-H4 | `gates /library/tab/Collections --hover <tile> --only size,outline` laser (15:53) | off | SIZE, OUTLINE **PASS** (R-G7's edge failure not reproduced) |
| R-H5 | `js colldwell.js` laser (15:54) | on | Collection tile: centre hit = the spread tooltip source, no `.lgs-dwell` set; poster: `.lgs-dwell` on `%{LibraryItemBox}` (M8) |
| R-K1 | `check-theme --json` (15:47) | — | PASS, 0 problems |

\* The step line said `native=on` (another agent's session); the JSON said `off`. The tile rim is CSS and does not depend on it; R-G7 is re-run in R-H4.

### 2. Findings

#### Blockers

None found in the CSS-only tier. Every function keeps a laser path and a gamepad path (section 4). The native session (section 5) is pending.

#### Major

**M1. P-23 fails on every library route: focused items sit under the ornament, and the Collections second row is cut by the window edge.** (`p23b.js` 15:40, `pad23.js` 14:42, `conformance --pad` 14:21; all pad, native off)
- AllGames: after every Down the focused poster is at y 347-619 (bottom 7 px past the 612 guard); in session 1 one move ended at 387-658 (30 px under the ornament, 2 px past the glass edge at 656).
- VR collection: the last row at 368-640 (12 px into the ornament at 628).
- Soundtracks: 435-617, then 456-637 on the last row.
- **Collections tab: the second row of tiles at 468-663**: 35 px under the ornament and 7 px past the glass bottom, so the window clip cuts the focused tile. The grid there does not scroll, so no scroll padding can help: the page needs bottom room.
- Cause (static): `%{TabContentsScroll}` has `scroll-padding-bottom: 108px` but only Steam's 40 px content padding at the end (`pb 40px` live), and Steam's focus transform (×1.053) is not counted. HA §7 and C2c's own CSS comment promise the guard (VP P-23, "must"; PLAN R2-11's 612 bound). C1a's review R2 also attributes AllGames' P-23 to C2c (REQ C1a->C2c (1)-(2)).

**M2. G-FOCUS fails, and gamepad focus on a selected segment or tab is nearly invisible.** (`focus` 13:54, shots `p2_c2crev_focus_0..3.png`)
- P-16 (the outer glow on a white control): the lab's band (8-16 px outside the element's 80 px box) reads **+5.8 L** on the focused All Games tab and **+8.6 L** on the focused ALL segment (needs ≥ +20). Measured from the 60 px visible fill (offline, `band.py`), the band above and below the pill is +18.3 / +18.6: still under 20. In `p2_c2crev_focus_3.png` I could not tell, by eye, that ALL had focus.
- P-15 (focused-unselected ≥ selected-unfocused + 15 L, "must"): focused VR **92.8** against selected ALL **235.4**, −142.7 L. A white .94 selected pill cannot be beaten in luminance by a .32 focus add, so this needs either a stronger focus treatment on segments (the glow ring is the only lever) or a coordinator ruling for segmented controls (C1b's review R2 M2 found the same on `/search`). C2c never ran G-FOCUS (its log has no row) and filed nothing.
- Static: `40-library.css` 152-158 gives a gamepad-focused tab the selected look (`--lgs-selected-fill`, dark label). Steam selects a tab when it takes focus, so the two coincide today, but the rule makes focus and selection one look by design (PLAN §1.4 keeps them apart).

**M3. The Sort pill's open-menu state is illegible: 1.1 : 1.** (R-G9, 15:38; `p2_c2crev_sort_laser.png`)
- With the Sort menu open from the pill, AUD CONTRAST: "ALPHABETICAL" 20.2 → **1.1** (grey 1.5, bright 2.2, dark 1.1); P-39 is a must.
- Cause (static): C1c's source rule `[data-lgs-menu-source="white"]` (`22-presentations.css` 714) sets `background: var(--lgs-selected-fill) !important` and the dark label colour. C2c's `%{SortAndFilterButton} { background: none !important }` (`40-library.css` 588) has the same specificity and comes later in the bundle, so the white fill is lost while the dark label stays: dark text on dark glass. PLAN §1.4: "the source of an open menu: white .94, label #0d0e12" (R2-2 also asks for it, HA §8).

**M4. R2-2 check 2 fails: the Sort & Filter group is 6 px from the search capsule (needs ≥ 20).** (R-M1)
- Section roots (AllGames, pad and laser): search box (372, 14) 536 × 80, visible capsule to x 900; the group's box starts at 906, so the boxes overlap by 2 px and the visible gap is **6 px**.
- Collection pages: search visible to 960, group at 978: **18 px**.
- `REQ Coordinator->C2c` (`wp/coordinator.md` 196, item 1) asks for exactly this (`max-width` about 336 / 276, the sort name ellipsizing first). It is open and unanswered. R2-2's other two checks pass: the capsule hugs its members (AllGames pad 165-1115, 950 wide, centred at 640.0, gaps 4 / 4 / 14 / 4; VR collection laser 261.2-1018.8, centred 640.0), the group is at y 24-84 with its right edge at 1256 and both buttons take their own hits, and no legend or pill node is hidden.

**M5. Library Filters: the close circle sits on the title, and the title is not centred.** (R-M4; `p2_c2crev_filter_{pad,laser}.png`, 15:32-15:33)
- C1c's close circle is at the card's (24, 24) as agreed (REQ-6), 334-394 × 132-192. C2c's content puts "Library Filters" at (346, 160) 192 × 37: the circle covers its first 48 px. In both shots the × sits on "Li".
- HA §9 (C2c's own frame spec): "Title 2 'Library Filters' (Steam's string) centred". It is 30 px Bold, `text-align: start`. The content must start below the circle's row (C1c gives `[data-lgs-sheet="close"]` sheets 88 px of top padding; C2c's card is a `%{DialogWrapper}` that rule does not reach, REQ-10).

**M6. The gamepad Y legend is cut mid-glyph: "Sort By · Alphabetica".** (shots `p2_c2crev_ag_pad.png`, `_vrcoll_pad.png`, `_focus_2.png`; `cmp` pad)
- `#Footer [data-lgs-btn="OPTIONS"]` is capped at 300 px (`40-library.css` 662); the sort name is the label's `::after`. The label's `text-overflow: ellipsis` does not draw: the text is clipped with no "…". R2-2: "the sort name ellipsizes"; HA §7.1: "ellipsizes inside the slot". The longest name, "% of Achievements Complete", loses most of itself. Neither G-TYPE nor AUD sees a pseudo-element's clip, so the gates pass while the label is broken.

**M7. The VR sub-filter reads "ALL · VR · NON-VR".** (every AllGames shot; `more.js` `segRaw`)
- Steam's strings are uppercase (`textContent` "ALL", "NON-VR"), and `text-transform: none` cannot fix that. HA §7 and C2c's own mockups show "All · VR · Non-VR"; VP P-84 (must) forbids uppercase chrome; D-C2c-11 claims Steam's case is shown without uppercase.
- The gates do not catch it: E-SEG exempts the segments, and the lab's P-84 checks only `text-transform`. A fix within PLAN §1.15: a mixed-case Steam string if one exists (the locgrep method), else T2 draws "All" / "Non-VR" when the UI language starts with `en` and keeps Steam's text otherwise.

**M8. Collection tiles never take the laser's attention: no dwell, no lift, Steam's blue hover stays.** (`colldwell.js` 15:54, laser; shots `p2_c2crev_coll_hover.png` 15:37, `_coll_hover_g3.png` 15:53, `_coll_hover_stock.png` 15:52)
- With the laser on a collection tile, `elementFromPoint` at its centre returns Steam's count tooltip source (`tool-tip-source Focusable`), which D-C2c-15 spreads over the whole tile, and P3 sets **no `.lgs-dwell` anywhere** (`dwell: []`); on a poster the same probe puts `.lgs-dwell` on the `%{LibraryItemBox}`. So C2c's laser lift (`40-library.css` 457-461, `:is(.lgs-dwell:hover, .lgs-attend-80)`) and the native `library-collection` pop never engage under the laser: after 1.6 s of real hover the tile is unscaled, unglowing, and filled with Steam's light blue, the same as stock. The gamepad path lifts (`coll.js`: ×1.05 and the 15 mm shadow).
- That is a laser/gamepad parity miss (P-89, must; P-19 for content cards) and the hover recipe of PLAN §1.4 (+ white .08 and the light spot) is not applied.
- G-OUTLINE on the hovered tile failed once (R-G7, edge ratio .788 / .728, with another agent's native session starting) and passed when re-run CSS-only (R-H4, 15:53). The faint rim in `p2_c2crev_coll_hover_g.png` is recorded, not counted.

**M9. G-AUD fails in laser mode on four states, and no request was filed.** (R-G3, R-G4, R-G5, R-G8, R-G9)
- `GONE text "SELECT"` on Non-Steam and Soundtracks, `GONE "BACK"` on the VR collection, `GONE "SELECT"` on AllGames with the Filters sheet or the Sort menu open. The legends are present, visible and hit (`legends.js`: Select at (624, 628), `hit: true`).
- The cause: once C2c registers posters as More hosts, C1a's T2 Options member is inserted among Steam's legend siblings, which shifts the DOM paths AUD keys on (stock path `0/1` Select → themed `0/2`). The builder recorded one instance (S2-G7) as an artifact, but filed no REQ to P10 (AUD keying) or C1a (insertion point). PLAN §4.1 requires AUD = 0; a gate that fails on an artifact still fails until the owner fixes it.

**M10. G-SIZE fails on Soundtracks in laser mode.** (R-G5)
- The square poster 172 × 172: "hit 81 % own, 19 % other (lgs-more lgs-more-show "Options") over 172x80". The More circle's 80 px hit (C2c's `placement: 'card'` registration) covers a fifth of the band AUD samples. Either the circle's placement on square art or an exemption line is needed; today P-08 fails.

**M11. G-PERF fails on AllGames: fps ratio 0.699, +10 long frames.** (R-P1, 14:09, 16 runs pooled, all `native=off`)
- Reference (stock) median 81.5 fps, 2 long frames; themed 56.95 fps, 12 long frames; A/A spread 2. PLAN §4.1 / R2-13: ratio ≥ 0.95, extra long frames ≤ spread.
- C2c owns the route (§4.2) and the coordinator asked C2c to measure its share and fix what is its own (REQ Coordinator->C2c (3)). C2c's log has no G-PERF run. My own CSSOM A/B of the library rule (session 1) was inconclusive (59.3 / 60.1 fps with the rule against 64.0 / 59.6 without) and caused the incident above; P4's `fontkit.py --perf-js` method is the safe one. Suspects to isolate: the full-width `backdrop-filter: blur(12px)` scroll band (`%{TabHeaderRowWrapper}::before`), the per-poster `box-shadow` transitions, the Filters card's blur.

**M12. G-MOTION fails on the Filters sheet interaction.** (R-T2: `motion_sheet3` 15:45 and 13:57, native off; strip `shots/p2_motion_c2crev_sheet3_strip.png`)
- Non-token: `transition:opacity` **100 ms** `cubic-bezier(0.16, 0.86, 0.4…)` on the focused poster as the sheet takes focus (P-58, must). It is not in C2c's files (C2c's poster rule lists only `filter, box-shadow, transform, scale`), so it is Steam's transition surviving on the poster's pseudo-element layer that P4 and C2c restyle; C2c owns the poster and should replace it with a token.
- The strip at f = .15 shows the sheet's text over the posters before its glass reads (`lgs-sheet-in` fades card and content together): G-MOTION asks for glass before content on entry.
- Also in the result, not C2c's: P-53 "window scale 0.97" on the toolbar row (Back's text scales), from the sheet's window recede (O5).

**M13. Removal: after `wp.c2c` turns off, the More circle stays visible and takes clicks.** (`moreflag.js` 15:40, `--flags wp.p3,wp.c1a`, pad)
- C2c's own marks go (7 → 0) and the module is `off`, but C1a's circle stays `lgs-more-show`, opacity 1, at (344, 264); `elementFromPoint` at its centre returns the circle. After navigating to Collections it is still shown at (344, 267), over the "Epic" tile (242-428 × 278-463), so a laser click there lands on a dead circle (its host is gone, so it does nothing) instead of the tile. It clears only when attention moves.
- Root cause: `more.register(...).remove()` (`20-more.js`, C1a) turns off the attention handle but never hides a circle shown on one of its hosts. C2c's `libRemove()` relies on it. The builder's log says "Install and remove are clean (checked)". C2c needs a REQ to C1a (O4) and a re-check.

**M14. A 4 Hz poll runs on every route, forever, while the module is installed.** (static `40-library.js` 30, 57; R-M9)
- `rt.setInterval(libTick, 250)` queries the library root, the footer, the pill, the grid's fiber props, every tab and up to 200 collection tiles four times a second, on every route, at idle. Measured 0.25 ms/s on AllGames and 0.22 ms/s on Collections (0.01 ms/s elsewhere).
- The review's robustness bar is "nothing runs at idle"; P1 itself moved its own 4 Hz tick to a MutationObserver plus 0.5 Hz in R1 for this reason, and C1a's shell has no interval at rest. The work only needs to run when the footer's legends, the pill's text, the tab row or the collection tiles change (observers on those nodes, started on library routes only).

**M15. The card's build list is not complete, but the package is marked READY.** (PLAN §2.4 C2c; C2c log "Not built")
- T3 **letter scrubber** (HA §7, L4's new laser path; AT-14 (c) cannot pass).
- T3 **Filters content** (pop-up row, toggle capsules, collapsed sections; F1-F5's T3 paths; AT-15's T3 half). The T1 fallback keeps every control (AUD 0 at scroll 0 and 4200 per the builder, and in laser with R-G8 apart from M9), but it is **5,809 px of scroll in a 488 px card: 11.9 sheet heights**, against HA's T3 target of ≤ 1,400 px. That is the opposite of a visionOS sheet.
- T2 **filter-count badge** on the X legend (the card's "state labels on Steam's legends (current sort, filter count)").
- PLAN §2.1's definition of done is "every acceptance test in the card passes"; three of the card's build items are missing.

**M16. The card's acceptance tests and most global gates have no evidence.** (C2c log, Evidence table; R-L1)
- Not run or not recorded: AT-14 (a)-(f), AT-15 (a)-(e), PLAN-2c-1 as R2-2's three checks (the coordinator asked for them, item 2), PLAN-2c-2 (`cmp` against the three mockups; there is no `C2c-cmp.json`), G-FOCUS, G-PERF, G-MOTION filmstrips, G-MOCK, G-HV, G-REMOVE with the More circle. The ledger has 27 of 28 C2c rows `open` (no evidence row names a test id).
- What this review ran for them: AT-14 (a) PASS (same menu via the More circle and ≡), (b) PASS, (c) not buildable, (d) R2-2 checks: M4, (e) pending, (f) PASS (the checked row equals the pill's label); AT-15 (e) partly (M5, M15).
- The log's native rows (S2-N1, S2-N2) were taken while P7 was at M1, and S2-G4's E-MENU note predates R2-5.

**M17. C2c's mockups and its concept text still show the superseded design.**
- `home-apps-library.html` and `-pad.html` (04:25) draw the five fixed 880 px slots with the laser pill in slot 1 and the tile menu's Cancel at 56 (R-S1 `cmp`): R2-2 and R2-5 replaced both. The coordinator asked for the re-render (REQ Coordinator->C2c (4)). G-MOCK against them cannot pass and would not mean anything.
- HA §7.1 (C2a's file, written from C2c's REQ-1 text) still describes the five fixed slots and "Steam's pill moved by T1 into slot 1"; C2c should send C2a the R2-2 text.

**M18. Requests to C2c are open.**
- `wp/coordinator.md` 196 (REQ Coordinator->C2c, items 1-4): no answer anywhere.
- `wp/C1a.md` 102 (REQ C1a->C2c), `wp/C1c.md` 51 (REQ C1c->C2c), `wp/C2a.md` 39 (REQ C2a->C2c #6): answered in C2c's own log but never marked `- [x]` where they were filed, so the requesters' greps still show them open. C1a's (1)-(2) (the scroll guard) is in fact not met (M1).

**M19. On opening Library Filters with the gamepad, the focused row is hidden below the card's edge.** (R-M4; `p2_c2crev_filter_pad.png`; hv `c2crev_sheet_native`)
- Steam's default focus is the active compat row ("All Games", Steam's choice, S6). It is at y 586-685 while the card ends at 596, so 90 % of it is outside the card and only a 10 px white strip of its focus fill shows along the card's bottom edge (in the CSS shot and in the headset). The card does not scroll it into view (`scroll-padding-block: 24px` is set, but nothing scrolls). Title, description and three 80 px rows already fill 488 px.
- PLAN §1.4 / VP P-23's intent (focus never hidden) and P-13 (one visible focus look): a gamepad user opens the sheet and sees no focus. Stock's dialog (520 px) shows its focused row.

**M20. G-DEPTH fails in laser mode: the legacy `card` rule pops a stale-focus poster at 2.95 mm.** (native session 15:53-16:05, `sgcheck … --pre <gpTake poster 1, mark poster 4> --mode laser --hover <poster 4>`, 15:59:28)
- `main: 2 pops, depths [0.0, 3.0, 15.0] mm` and **`FAIL R2 main/card: dz 2.95 mm is not one of 0, 10, 15, 25 mm`**. The dwelt poster pops at 15 through C2c's rule; the poster that still carries Steam's stale `.gpfocus` (IM §3.3: the laser leaves one behind) is popped by `99-legacy.json`'s admission-off `card` rule, which C2c does not supersede: its fragment relies on overlap ("dropped by overlap with the earlier library-poster layer"), and that only works when both rules pick the same poster.
- This is the everyday laser state on AllGames. Reporter §3.5 lets the owner of a shared id retire it on its own routes; C2c needs a rule that keeps `card` off library posters while `wp.c2c` is on (an earlier library rule matching `.gpfocus` posters in laser mode, or a route-scoped supersede), and a re-run of this sgcheck.

#### Minor

- **m1. P-01 selectors without an input-mode scope** (static): `40-library.css` 268-269 (`z-index` on focused segments and tabs), 272 (`:is(:hover, .gpfocus)` reset), 810-811 (description colour on `.gpfocus` / `.gpfocuswithin`). Harmless resets, but they add to the conformance P-01 FAIL (must) list.
- **m2. Glass on glass in the Filters sheet** (static, P-45): the tag-search results drop-down (`40-library.css` 871-876) gets `--lgs-mat-thick-bg` and its blur inside the thick sheet. Only while typing in Store tags or Friends.
- **m3. The More circle lags Steam's focus transition** (R-M2): after Right × 2 it sat 16.5 / 14.5 px inside the poster instead of 10 / 10 until the next move. Placement is C1a's; C2c should report it.
- **m4. Row heights in the Filters card are uneven**: three compat rows are 80, "All Games" is 99 (two-line description).
- **m5. The log's numbers do not match the code**: D-C2c-7 says the lift shadow is black .50, live it is .30 (`--lgs-shadow-15mm`; P-48's offset and blur hold); D-C2c-13 says Steam's focus transform is "about ×1.07", the focused box measures ×1.053 (181.1 / 172).
- **m6. The ‹ › circles** are at x 45.8 and 1174.2 (visible) against HA §7's 24 and 1196, so the tab row is not aligned with the toolbar's 24 px inset.
- **m7. Tabs without the sub-filter** (Collections, Non-Steam, Soundtracks, collection pages) keep an empty 80 px band under the tab row, because the grid top is held at 270 on every tab. It reads as a gap, not a layout.
- **m8. The Filters radio wells** (black .22 on the dark card) are nearly invisible for the unselected compat rows (`p2_c2crev_filter_*.png`); visionOS single-choice rows show only the check.
- **m9. D-C2c-15** spreads Steam's count tooltip source over the whole collection tile; every tile hover is now a tooltip source hover. Not seen to misbehave, but it changes Steam's hover semantics and is not tested.

#### Issues owned by other packages, seen on C2c's routes (C2c should file these)

| Id | Owner | What | Evidence |
|---|---|---|---|
| O1 | C1c | The compact tile menu's header (the game's name, 19 px) has no width limit: "AaaaaAAaaaAAAaaAAAAaAAAAA!!! for the Awesome" runs past the slab's right edge over the tab row | `p2_c2crev_tile_laser.png`; `22-presentations.css` 92-108, 411-420 |
| O2 | C1c | E-MENU Cancel: "fill 188 x 56 on a 192 x 60 element" in the tile menu and the Sort menu (R2-5 asks 60 on 60) | R-G9, R-G10 |
| O3 | C1a | The Large Title reads "Sort By" instead of "Library" while the Sort menu is open (not checked against stock) | `p2_c2crev_sort_laser.png` |
| O4 | C1a | `more.register().remove()` does not hide a circle shown on its host (root cause of M13) | `20-more.js` register/remove |
| O5 | C1c / C1a | P-53: the toolbar row (Back's text, search, title) scales to 0.97 while the sheet opens | R-T2 |
| O6 | P10 / C1a | AUD keys on DOM paths; C1a's Options member shifts Steam's legends (root cause of M9) | R-G3..R-G9, `legends.js` |
| O7 | C1a (to confirm) | With a real laser hover on a poster the ornament shows only "Options · Back" (Select, Filter and Sort By gone) | `p2_c2crev_ag_hover(_g).png`; stock comparison R-H2 pending |
| O8 | C1a | The pointer proxy's 1.5 px ring fails P-43 (native mode) | R-G7 |
| O9 | C1a / P10 | Native mode: AUD CONTRAST on the ornament's legends, "FILTER" and "SORT BY" 5.5 → 1.5 over the bright room (P-39 FAIL in the native conformance step); either the ornament's CSS backing is dropped before glassd's glass counts for AUD, or the labels really sit on the room | native `conformance` 16:04 |

### 3. Visual verdict (CSS-only, against the mockups and the quality bar)

Composited over grey, the catalogue reads as a visionOS window: a smoky glass slab with no outlines, a Large Title and a 520 capsule, a recessed segmented tab row with white selection, real posters without Steam's rings, a lifted attention target with a shadow and its More circle, and a centred ornament with quiet Select and Back. Against `p2_home-apps_library(-pad).png` the differences are the R2 changes (pill in the toolbar, hugging ornament) and these misses: the pill crowds the search capsule (M4); "ALL / NON-VR" shouts next to mixed-case tabs (M7); the Y legend's "Alphabetica" (M6); the Filters title under the × (M5); the Sort pill dark-on-dark while its menu is open (M3); the tile menu's header running out of its slab (O1); a collection tile hovered in Steam's blue with a rim (M8); the bottom row's focus under the ornament (M1); and on a selected segment, focus that cannot be seen (M2). The Filters card is a dense, mostly opaque panel with twelve screens of scroll (M15), not a sheet.

Sizes: tabs 80 boxes with 60 visible, ≥ 140 wide, contiguous (E-SEG PASS); sub-filter 3 × 140; ‹ › 60 / 80; pill 60 / 80; More 60 / 80 inside the poster; ornament members 84 tall; menus E-MENU apart from O2; Filters rows 80 (one 99), text ≥ 20 px.

### 4. Function retention and conformance

**Retention (HA §12.2-§12.5).** Every row keeps both paths; none is lost.

| Rows | Laser path (checked) | Gamepad path (checked) |
|---|---|---|
| L1 tabs, L2 sub-filter | segments and ‹ › take their own hits (gates, E-SEG) | Up to the sub-filter and the tab row, Left/Right (R-M1 `up4`, pad-bfs nodes 3, 7, 8, 13, 14, 16, 22, 24, 31) |
| L3 browse, L5 open | wheel scroll; click (Steam's handler, not run) | D-pad (M1's guard aside); A |
| L4 fast scroll | **none new** (scrubber not built, M15); stock has none either | Steam's fast scroll, unchanged |
| L6 sort | the pill's Sort opens the grid menu (R-M3) | Y opens the same menu |
| L7 filter | the pill's Filter opens the sheet (R-G8) | X opens the sheet (R-M4) |
| L8 tile menu | the More circle opens the same menu as ≡ (AT-14 a); C1a's Options member | ≡ |
| L9 hidden-apps notice | static only (no filter may be set, never-list) | static only |
| T1-T8, F1-F6, C1-C4, N1-N3 | Steam's menu rows, Steam's dialog rows (T1), tiles and tabs, restyled | the same |

After B closes the tile menu or the sheet, no window holds `.gpfocus`, on stock too (R-M5): P-21 is a Steam limitation here, not a C2c regression.

**Conformance (VP §6), C2c's area.** P-08 PASS on the three conformance routes (fails on Soundtracks laser, M10); P-13 PASS (one focus look); **P-14 PASS, P-15 FAIL, P-16 FAIL** (M2); P-17 PASS; P-19 PASS for posters (×1.053 pad, ×1.05 laser after the dwell, 15 mm shadow), **FAIL for collection tiles in laser** (M8); P-20 not proven (pad-bfs partial, R-B2; stock comparison pending); P-22 PASS (entry on the first poster); **P-23 FAIL** (M1); P-35 PASS (tile menu 16-20 px from its source, Sort 16 px from the pill, the sheet centred at x 640 from y 108); P-38 PASS; **P-39 FAIL** in the Sort-open state (M3); **P-42 FAIL** on the hovered collection tile (M8); P-43 PASS on C2c's elements; P-45 PASS at rest (m2 static); P-52 PASS; **P-58 FAIL** on the sheet (M12); P-72 PASS; **P-84 FAIL** in substance (M7; the lab passes it); **P-01 FAIL** (must; mostly other files, C2c adds m1); P-02 / P-89 / P-82 FAIL from other files (41-home.css, C1a's Back). Depth items P-11, P-46-P-48, P-51: native, pending.

### 5. Native session

Session 1 of mine: `native-session` 15:53:26-16:05:08 (P7 complete; `native=on`, glassd healthy, 13 steps; "back to CSS only: yes"). Session 2 (one laser step and two reporter reads): see the end of this section.

| Step | State | Result |
|---|---|---|
| sgcheck, pad | poster 3 focused by `gpTakeEl` (More circle shown) | **PASS**: `main` 1 pop, depths [0, 15.0] mm; AT-14 (e) pad PASS |
| sgcheck, laser | real hover on poster 1 (900 ms) | not run: "lab: lock busy for 240 s" (my own CSS probes competed for the lock; re-run in session 2) |
| sgcheck, laser, stale focus | poster 1 holds Steam's `.gpfocus`, the laser dwells on poster 4 | **FAIL** R2: the legacy `card` pop at 2.95 mm beside the 15 mm pop (M20) |
| sgcheck, tile menu by ≡ (pad) | `wp.c1c` | **PASS**: 1 pop, the menu at 10.0 mm, `modal ['c1c-menu']`, the source poster at 0 (R2-3 PASS) |
| sgcheck, tile menu by the More circle (laser) | `wp.c1c` | **PASS**: the same (R2-3 PASS in both modes) |
| sgcheck, Filters sheet (pad) | `wp.c1c` | **PASS**: 1 pop, the sheet at 10.0 mm, `modal ['c1c-sheet']`; the legacy `filters` pop of S2-N2 (11.07 mm) is gone (AT-15 c PASS; C2c's REQ-10 (c) is resolved by C1c) |
| sgcheck, Sort menu by Y (pad) | `wp.c1c` | **PASS**: 1 pop, 10.0 mm, modal |
| sgcheck, Collections tile focused (pad) | | **PASS**: 1 pop at 15.0 mm |
| `conformance --only P-11,P-46,P-47,P-48,P-51` (pad, native) | AllGames | P-11, P-46, P-47, P-48, P-51 **PASS**; P-13, P-17 PASS; P-39 FAIL on the ornament legends (O9); P-01, P-02, P-89 as in CSS-only |
| `hv --look` × 4 (pad focus, laser hover, 30° off axis, sheet open) | | Viewed, then deleted (the lab's 120 s timer; `hv --clean` at the end). The headset faced down, so the dashboard sat at the top edge of every frame and only the window's lower half showed: posters on the native window glass, the ornament (pad: "Filter · Sort By · Alphabetica · Options · Select · Back" with badges, the cut "Alphabetica" visible in the headset too; laser: "Options · Back"), and the Filters card with its compat rows and the white focus sliver along its bottom edge (M19). No doubled element in what was visible; labels legible over the dark shelves. G-HV verdicts were withheld by the tool (auto rect, window cut by the frame edge); the pad-focus frame was deleted before I opened it |

Static review of `theme/layers/40-library.json` against `contracts/reporter.md` §3-§4 and `sg.md`: version 2, fragment `flag: wp.c2c`, rule ids unique, `mm: 15` in the allowed set, `when: "attended"`, `slab: "liquid"`, `interactive` only in the `wearer` block (the default profile is non-interactive, RP-4; P-11 PASS live), flagged supersedes of `sort-filter` and `tab-arrow` (reporter §3.5 makes `sort-filter` C2c's; `tab-arrow` is shared, and superseding it also drops Steam Home's arrows while `wp.c2c` is on: REQ-11 informs C2a). Two risks, checked live: (1) the legacy `card` rule (admission off, keyed on `.gpfocus`) is dropped only by overlap, so it pops a stale-focus poster: **confirmed, M20**; (2) the More circle (`role="button"`, an 80 px box) is a focusable for reporter rule 2, so a poster carrying it should be capped (15 mm at r = 0.863 is 0.0471 u and needs s ≥ 90; s = 80 allows 0.0417 u, which snaps down to 10 mm). In pad mode the poster popped at 15.0 mm with the circle shown, so the circle was not counted there; session 2 reads the reporter's candidates to see why.

### 6. Requests this review suggests C2c files

- To C1a: O3, O4 (and re-check M13), O7 once confirmed, the circle's lag (m3), the Options member's insertion point (O6).
- To C1c: O1, O2, O5; the sheet frame's title row for `%{DialogWrapper}` cards (M5, REQ-10 follow-up).
- To P10: AUD keying on DOM paths (O6); P-84 on literal uppercase text; the P-16 band measured from the visible fill for elements with transparent borders.
- To the coordinator: P-15 for white-selected segments (M2).
- To C2a: the R2-2 text for HA §7.1 (M17).

### 7. Evidence index

Scratch (`C:\Users\blcha\AppData\Local\Temp\claude\C--Users-blcha-liquid-glass-frame\9826dd03-9a3a-4573-a7ad-b9a9bde60bb9\scratchpad\c2c\`): session 1 `gates_*.json`, `geom*.js/json`, `more.*`, `legends.*`, `menus.*`, `filters.*`, `coll.*`, `remove.*`, `stock.*`, `sortidle.*`, `pairs_ag.json`, `focus_ag.out`, `bfs_*.out`, `motion_*.out`, `conf_*.out`, `perf_ab.out`, `pad23.*`, `p21*`, `functions.csv`; session 2 `r2/` (`batch8.sh`, `batch9.sh`, `native_run2.py`, `p23b.*`, `recycle_*`, `moreflag.*`, `gates_{filter,sort}_laser.*`, `gates_tile_pad.*`, `motion_sheet3.*`, `bfs_ag_long.*`, `band.py`). Shots in `shots/`: `p2_c2crev_*`, `p2_cmp_c2crev_lib-{laser,pad}.png`, `p2_motion_c2crev_{lift,sheet,sheet3}_*`.
