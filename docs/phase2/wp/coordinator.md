# Coordinator: decision log and requests

Owner: the coordinator (PLAN §2.6). This file records the coordinator's decisions on the requests packages address to it (`REQ <ID>->Coordinator`), the evidence read for each, and the coordinator's own requests to the packages that must change a file. The decisions themselves are PLAN amendments: `docs/phase2/PLAN.md` §1.19 (round R2), applied in place and marked `[R2-n]`.

## Status

- **Round R2 done (2026-10-07, Steam build 11094443).** All nine open requests to the coordinator are decided and marked `[x]` in their logs, each with a one-line answer that points to its amendment:
  - C1a ×1 (it covers WN §11 O1 to O4);
  - C1c ×2;
  - C2c REQ-7 and REQ-8;
  - C4a ×1;
  - P2 ×1;
  - P3 ×1;
  - P7 ×1.
- **Also decided,** without a REQ line of their own: P9's morph sign-off (R2-12), P1's RT-7 deviation (R2-13) and C7's `/chat` circle (R2-14). WN's open items O1 to O4 came in C1a's request and are covered by R2-10, R2-11, R2-1 and R2-3.
- **Amendments:** PLAN §1.19 R2-1 to R2-14. DESIGN2 follow-ups are listed as PLAN §1.18 A14 (P4).
- **Open:** the coordinator's requests below, 14 lines, one per owner: C1c, P10, C2c, C1a, C2a, C4a, P4, P3, V1, V2, C5a, C6a, C7 and C3b. Nothing in them blocks another package's milestone.
- **Device:** none. These are document decisions, so no device step was run and the device was not touched. No native session was run, and no room imagery was taken.
- **How to re-check.**
  - `grep -n "REQ [A-Za-z0-9-]*->[Cc]oordinator" docs/phase2/wp/*.md`: every hit is `[x]`.
  - `grep -n "REQ Coordinator->" docs/phase2/wp/coordinator.md` lists the follow-ups. Each owner answers under its line here, as the cross-file request rule says (PLAN §2.6).

## Decisions

Rules applied (PLAN §1.19):

- §1 decides conflicts.
- A Steam function, with both its paths, is never traded for a look.
- Between two looks, the one closer to visionOS wins when it can be measured.
- A VP "must" passes or is a recorded deviation.
- Every rule has an agent-runnable check.

| Request | Decision | Amendment |
|---|---|---|
| C1a->Coordinator (quiet legend, slot arithmetic, WN O1, O2, O4) | The dim band adopted (S27 `quietBacking`); the slots sum corrected (840 + gaps + padding = 880); achievements stay `window`; P-23 scored at 612; source card: rule 6 | R2-1, R2-2, R2-10, R2-11, R2-3 |
| C1c->Coordinator #1 (REQ 6a–c) | Cancel raised to 60 with its own E-MENU line; P-65 and P-67 recorded deviations; placement on the glass confirmed | R2-5, R2-6 |
| C1c->Coordinator #2 (E-MENU width, D28, Cancel line) | E-MENU ≥ 280 in the grid; 7–10 take the grid, 11–14 scroll inside the slab; Cancel's own line | R2-5 |
| C2c REQ-7 (source card) | The source card drops to 0 with a glow in both modes and profiles | R2-3 |
| C2c REQ-8 (library ornament, PLAN-2c-1) | D-C2c-12 adopted: the ornament hugs its members; the laser pill is the toolbar's trailing group, ≥ 20 px clear of the search field; fixed slots behind `libFixedSlots` (S28); PLAN-2c-1 replaced | R2-2 |
| C4a->Coordinator (white-fill glow) | §1.4 names `--lgs-white-glow` and `--lgs-focus-add` (.32) | R2-7 |
| P2->Coordinator (`actionsLive`) | S26 added; §4.5 item 4; §4.6 item 9 | R2-9 |
| P3->Coordinator (IN-7, P3-D4) | §1.13's delays stand; IN-7's criterion amended with tolerances; `tipQuick` off (S29) | R2-8 |
| P7->Coordinator (SG-5) | §1.8 states the measurement; CC-A `window.dim 0.6` alone; surface `dim` for a dim behind a pop | R2-4 |

### Why, request by request

**C1a: the quiet legend (R2-1).**

- Evidence read:
  - WN §3.4.1 and §13.1: bare labels at 1.3–1.5 : 1 over the curtain; the band at 4.9–6.7 : 1 (sill) and 5.1–6.0 : 1 (curtain).
  - C1b #3: 1.1 : 1 over L 209.
  - C1c REQ 4: "Select" invisible over L 236.
- Alternatives considered:
  - (a) Keep §1.10's bare look. It fails P-39, a must, so a legend a person cannot read is a lost path.
  - (b) Make every A/B-only legend a glass capsule. That brings back the chrome §1.10 removed on purpose ("chrome only where it carries something"), and it adds a slab in native mode.
  - (c) The band. It is a shadow with no edge and no frost: it passes P-39 and keeps G-OUTLINE and "no capsule material".
- Decision: (c).

**C1a: slot arithmetic, O1, O2 (R2-2, R2-10, R2-11).**

- 300 + 130 + 156 + 134 + 120 = 840. With four 4 px gaps and 12 + 12 px padding the capsule is 880, which is what WN §3.4.1 says. Corrected in §1.10, now inside R2-2's flag variant.
- O1: §1.2's table and its note disagreed. SM revision 3, WN §3.1.1 and C5a all build achievements as `window`, so the table holds and the note is fixed.
- O2: A1 moved the ornament from 636 to 628, so P-23's 620 becomes 612 (C1a's `--lgs-guard-bottom`). VP stays frozen; the bound is in PLAN §4.4. P10's `tools/p2/conformance.py:118` still uses 620 (request below).

**C2c REQ-7, C1a O4: the source card (R2-3).**

- §1.7's row contradicted admission rule 6.
- P6's reporter applies rule 6 in both profiles (`contracts/reporter.md` step 6: "While the surface's `modal` selector (or a `modal: true` rule) matches a visible element, only `modal: true` rules pop"; the wearer profile skips only rule 2).
- C2c, C1c (D6b) and C2a (D-C2a-3) already build it, and C2c's S2-N2 shows it live.
- A +15 source beside a +10 menu would also invert the visual order.
- Rule 6 wins; the row is amended.

**C2c REQ-8: the library ornament (R2-2).**

- Evidence read:
  - C2c's log: D-C2c-12; S2-G1, S2-G2 and S2-G6 PASS in both modes; S2-N1 (native look with the toolbar pill).
  - `theme/40-library.css` §7: the pill is `position: fixed`, `right: 24px`, 80 px tall, `max-width` 420, or 288 on nested routes.
- Accepted:
  - The pill cannot live in the ornament: the window clip is C1a's and must stay, so that nothing floats in the margin.
  - A fixed 880 capsule with empty slots is not visionOS; a toolbar keeps its items, it does not show holes.
  - visionOS puts a window's sort and filter in the top bar's trailing group (DESIGN2 §3.2 "Trailing actions"), so the move is a conformance gain.
- Added: the trailing group must stay **≥ 20 px clear** of the search capsule (DESIGN2 §3.2's 20 px between trailing actions).
  - Measured from C2c's own numbers it is 6–8 px today: section roots x ≈ 906 against the capsule's 900; collection pages 968 against 960.
  - Two 60 px capsules 6 px apart read as one control, not as a search field and a separate group.
  - The rule is measurable and keeps every function: Steam's sort name ellipsizes inside the group, while the gap and the inset hold.
- Also added: the account-alert circle (`#header_profile`, WN §3.2) stays outermost when it shows, so the two never overlap.

**C1c: Cancel, E-MENU, D28 (R2-5).**

- Evidence read:
  - C1c's gates run 3 and run 4: the only G-SIZE red lines left were the E-MENU width clause and Cancel.
  - D23 and D28 (the 508 px box: 5 rows → 508, 6 compact → 502, 7 compact → 564).
  - D5 and HA-11 (56).
  - P10's E-MENU check (`lab/exemptions.json`).
- **Cancel: 60, not an exemption at 56.**
  - P-80 is a must ("no control smaller than 60 px visible on its short side").
  - C1c's Cancel element is already 60 tall (56 visible inside a 2 px clear border), so 60 visible costs no height: the 508 px budget is unchanged.
  - The quiet look comes from the fill (.08) and the label (.70), not from 4 px of size.
  - The ≥ 4 px clear rule keeps it apart from the last row. Compact layouts may need a 2 px margin: 502 → 504, still ≤ 508.
  - GP §3.4 and SET already drew Cancel at 60. C1c's requests asking C5a, C6a, C7, C2c and C3b for 56 are superseded.
- **E-MENU width.**
  - 2 × 320 + 8 + 16 = 664 > 592, and 592 is also the clip-path morph limit (≤ 600).
  - Steam's own row min-width is 280, and 284 × 72 rows still meet P-08 by hit.
- **7 → grid.**
  - It turns 7 compact rows (60 on 64) into 72 px rows, which is better on P-64 and P-08.
  - Power (7) was a grid already (S24).
- **11–14 scroll.**
  - Seven 72 px rows per column cannot fit 508 px with a title and Cancel. Three columns would break the 592 / 600 limit and the 280 width.
  - So the row area scrolls inside the slab, with the scroll edge and no scrollbar at rest. These menus are rare on this device: Sort has 10 items, Downloads Options 8.
  - AT-11b's no-scroll check now runs up to 10.

**C1c: P-65, P-67, P-35 (R2-6).**

- **P-35:** C1c's D7 already meets it (live: 958 × 487 at (161, 109); alert centre 328). Confirmed and written into §1.12 with numbers.
- **P-65:** the outside click is Steam's `ModalClickToDismiss`.
  - It only ever cancels; an outside click never confirms. So the loss P-65 guards against cannot come from it.
  - With the runtime off, C1c's sheet close circle is absent. For a sheet without a button of its own (ZOO's Scroll Panel), the outside click is then the only laser dismiss.
  - A guard would also be new T2 code intercepting Steam's dismissal, which no wearer can validate.
  - Recorded as a deviation; `modalOutsideGuard` is reserved (S30).
- **P-67:** decided by S6 at plan time (Steam's default focus untouched). C1c asked only for it to be listed; it is now in §4.4.

**C4a: the glow token (R2-7).**

- P4's `contracts/tokens.md` §1.6: `--lgs-white-glow` 22/8/.55, at +23 L bright and +27 L dim.
- §1.4's 18/2/.30 measured +4 to +12 L, so PLAN contradicted its own gate.
- PLAN now names the token rather than a value, so P4 can tune without reopening PLAN.
- DESIGN2 line 685 already names it (A5).
- The same edit records P4-D8's final focus add (.32), which C1a's REQ to P4 set from G-FOCUS.
- Seen, no change needed: `theme/50-appdetails.css:268` uses `0 0 18px 2px` white .22 for the **laser hover** on Play. Hover is allowed to be weaker than focus, and focus there uses the token.

**P2: `actionsLive` (R2-9).**

- Accepted as proposed. A dead Play button that every gate passes is the worst kind of lost function.
- Added a §4.5 rule as well: a T3 action's ledger row is `partial` until the shipped-state check reads `live`, so the ledger cannot report the launch paths as kept before then.

**P3: IN-7 (R2-8).**

- §1 decides, and it agrees with D2 §11, MO §4.17 and Apple's WWDC24 sample (delays).
- The card's literal numbers cost visible flicker under laser jitter (`tipQuick`: a dip to about 0.6 on a return within 180 ms).
- P3's proposed criterion is adopted, with the tolerances set from P3's own measurements:
  - leave start 210–230 ms, inside 200 ± 40;
  - label 0.9 at about 1050 ms, at or before 1100;
  - label gone at 400–420 ms, at or before 460;
  - node hidden at 560–610 ms, at or before 640.
- P3's recorded runs already pass it.

**P7: SG-5 (R2-4).**

- Read `wp/P7.md`'s SG-5 row and `contracts/sg.md` §5.
- The inference in §1.8 was wrong. The rule it supported ("no `t1` for in-window modals") is still right, for the opposite reason: `t1` dims the modal's own crop.
- CC-A's dim must be `window.dim` alone; P7 measured that the two compound.

**Items without a REQ line (R2-12, R2-13, R2-14).**

- P9's review R1 m2: glassd has no morph. The CSS clip-path is the visible morph in both tiers, so this is signed off.
- P1's RT-7 deviation (runtime.md §9) is accepted, and the same statistic is applied to G-PERF, because every owner faces the same shared-device noise.
- C7's SM-D2 revision 3 moved the `/chat` circle with the 512 px sidebar. It is written as a rule, not a coordinate.

## Requests

<!-- REQ lines: "- [ ] REQ Coordinator-><OWNER>: <what and why>". Owners answer under the line. -->

- [ ] REQ Coordinator->C1c: PLAN R2-5, R2-6. (1) **Cancel at 60.** Draw Steam's appended Cancel 60 visible on its 60 px element (drop the 2 px clear border), keep min-width 192, centred under the rows (across both columns in the grid), and keep ≥ 4 px clear of the last row's visible fill in every layout (compact may need a 2 px margin: 502 → 504 ≤ 508). It keeps `data-lgs-exempt="E-MENU"` and is judged by E-MENU's new Cancel line. (2) **AT-11b and C1c's tests:** no scroll up to 10 items. For 11–14 the grid's row area scrolls inside the slab (scroll edge, no scrollbar at rest, P-72, focused row fully inside the slab); record it. (3) Mark your REQs to C2c, C3b, C5a, C6a and C7 that say "Cancel a 56 px quiet capsule" as superseded: it is 60 (GP and SET already say 60). Re-render your own mockups when you next touch them (the 4 px is inside G-MOCK's ± 8). Placement (D7), D9 and D10 need no change: they are now PLAN §1.12 and §4.4.
- [ ] REQ Coordinator->P10: PLAN R2-5, R2-11, R2-13. (1) **E-MENU in `lab/exemptions.json` / `gates`:** row width ≥ 280 when the row sits in a two-column grid (its slab has rows at two distinct x positions, or C1c's `lgs-menu-grid`), ≥ 320 otherwise. New line for Steam's appended Cancel (the last item of `%{*BasicContextMenuModal>contextMenuItem}` after the actionable rows): visible height ≥ 60, width ≥ 192, ≥ 4 px clear of the previous row's visible fill, inside the slab, `elementFromPoint` at its centre hits it; listed under SIZE `exempt` with `pass`/`why`. (2) **`tools/p2/conformance.py` P-23** (line 118: `> 620`): bottom bound 612 when the route has a bottom ornament (any `#Footer` legend rendered), else the glass bottom − 16 (704 for `window-full` and `windowless`); top 124 unchanged; update `contracts/lab.md` (the P-20/22/23 row) and the stock baseline note. (3) **`perf` ABBA mode** for R2-13: for example `perf SURF --route R --ab stock|theme --rounds 2`. It alternates the reference (`--stock`, or theme-only with the runtime off) and the subject, and prints per run fps, long frames (> 34 ms) and `native`, then the median fps ratio, the median extra long frames, the reference's A/A spread and PASS/FAIL by R2-13. It pools a second round when the first fails. Today RT-7 computes this inside P1's selftest and G-PERF has no tool for it.
- [ ] REQ Coordinator->C2c: PLAN R2-2, R2-13. (1) **Trailing group spacing.** Its visible capsule must stay ≥ 20 px clear of the search field's visible capsule: today it is 6 px on section roots (x ≈ 906 against 900) and 8 px on collection pages (968 against 960). That means `max-width` about 336 on section roots and 276 on nested routes, with the sort name ellipsizing first and the 24 px inset kept. When Steam's `#header_profile` circle shows, the group sits 20 px to its left. (2) **PLAN-2c-1** is now R2-2's three checks (hug, the toolbar pill's rect and hit, nothing hidden), in both modes with focus in the grid and on the tab row; record them. The 880 check runs only with `libFixedSlots`. (3) **G-PERF on `/library/tab/AllGames`.** P4 measured themed 61.1 fps against stock 83.4 (4 s, during another agent's native session, `wp/P4.md`), and P1 measured theme-only at 64–68 fps. Please run G-PERF with R2-13's statistic in CSS-only (`native=off` runs only). If it fails, measure the library CSS's share (A/B with a `--pre` that disables groups of `40-library.css` rules, as P4 did with `fontkit.py --perf-js`), fix what is yours and report the rest here. You own the route (§4.2). (4) Your mockups' tile menu draws Cancel at 56 (M0-G1). It is 60 now (R2-5; C1c's REQ to you is superseded on that point); re-render when you next touch them.
- [ ] REQ Coordinator->C1a: PLAN R2-1, R2-2, R2-3, R2-5, R2-10, R2-11. `window-nav.md` updates:
  - §3.4.1 "Note for the coordinator" → adopted (PLAN §1.10, S27).
  - §3.4.1 "Library routes" row and §3.4.2 slot 1: the fixed slots run only behind C2c's `libFixedSlots` (off). In laser mode the library's Sort & Filter pill is the toolbar row's trailing group, not slot 1. AT-6's fixed-slot part and AT-24 (b) run only with `libFixedSlots`.
  - §3.2: on `library` routes the toolbar's trailing area holds C2c's group (with Steam's account-alert circle outermost). Keep it free of shell items; this answers C2c's REQ-9 in substance, so please answer it there.
  - §3.7 and §11: the source-card row is rule 6 (R2-3); close O1 (R2-10), O2 (R2-11, PLAN §4.4), O3 (R2-1) and O4 (R2-3).
  - §0's §1.10 row ("Sort/Filter in slot 1 in laser mode; library five slots (880)") and §3.2's "V2 is asked to score P-23 at 612" → PLAN §4.4.
  - §5.1.1, §9.5 C4 and §13 AT-11b: the count table (6 compact, 7–10 grid, 11–14 grid scrolling inside the slab), Cancel 60, and AT-11b's no-scroll check up to 10 (R2-5).
  - Mockups that draw the library's fixed slots may keep them as the flag variant, but the default strip should show the hugging capsule and the toolbar pill (`window-nav-ornament.html`, `-anatomy*.html`) when you next re-render.
- [ ] REQ Coordinator->C2a: PLAN R2-2, R2-3, R2-5. `home-apps.md`:
  - §7.1: the five fixed slots, and the laser pill in slot 1, become the `libFixedSlots` variant. The default is the hugging ornament plus the toolbar's trailing Sort & Filter group (D-C2c-12). C2c's text for its sections can be requested from C2c.
  - HA-11: Cancel 60 (P-80), not 56.
  - Line 130 (§1.7 conformance row) and §16 #18: resolved by R2-3 (the row now says rule 6).
- [ ] REQ Coordinator->C4a: PLAN R2-5, R2-8.
  - `controls.md` §18.2 C9: score tooltips by the amended IN-7 criterion (PLAN §2.3 P3), not "label at 900 ms; gone ≤ 250 ms". This answers P3's FYI REQ to you.
  - §8.2, C-D16 and the E-MENU row (line 838): Cancel 60 with its own E-MENU line; the grid-width clause ≥ 280.
  - `controls-pickers.html`, `-timezone.html` and `-steamvr.html` draw Cancel at 56: re-render at 60 when you next touch them.
- [x] REQ Coordinator->P4: PLAN §1.18 A14 (round R2). DESIGN2:
  - §3.2 bottom-ornament row: the quiet legend's dim band on `window` routes (R2-1).
  - §3.7 menu row and the layout-by-count table: 6 compact, 7–10 grid, 11–14 grid with the row area scrolling inside the slab; "No menu scrolls inside the 520 px box" → "no menu of up to 10 items scrolls; the box is y 108–616"; Cancel 60 with its own E-MENU line; E-MENU widths ≥ 320 in one column, ≥ 280 in the grid (R2-5).
  - §3.7 Sheet and Alert rows: the placement numbers of PLAN §1.12 (R2-6).
  - §3.8 depth table "Source card while its menu is open": 0 with a CSS glow in both profiles (R2-3).
  - §3.8 Dimming: replace "in native mode it would dim only the hidden real panel" with SG-5's measurement (R2-4).
  - Nothing to change for R2-7: line 685 already names `--lgs-white-glow`, and line 1027 records .32.
  - P4 (2026-10-07 11:40, maintenance session): done, tagged **[A14]** in place (11 tags) and registered in DESIGN2 §0.3 (A1–A14, with sources). §3.2: the quiet legend's dim band on `window` routes with its values and flag (R2-1), the ornament hugs its members on library routes too and the laser Sort & Filter pill is the toolbar's trailing group (R2-2, also §7.3). §3.7: menu row with the 108–616 box and Cancel 60 with its own E-MENU line; the count table 6 compact, 7–10 grid, 11–14 grid with the row area scrolling inside the slab; "no menu of up to 10 items scrolls; the box is y 108–616"; value menus follow the table, "up to 8" is placement; E-MENU ≥ 320 in one column, ≥ 280 in the grid (R2-5); Alert centred at (640, 328) / (640, 360) and Sheet top 108, ≤ 488 / 552 tall, outside click and default focus as recorded deviations (R2-6). §3.8: source card 0 with a CSS glow in both profiles (R2-3); Dimming rewritten from SG-5's measurement, with the surface `dim` and CC-A's `window.dim` 0.6 alone (R2-4). FD-7 re-checked (`grep -o "\[A<n>[],]"`): A1 11, A2 4, A3 14, A4 6, A5 13, A6 3, A7 2, A8 3, A9 1, A10 1, A11 1, A12 3, A13 3, A14 11; `wp/P4.md`.
- [ ] REQ Coordinator->P3: PLAN R2-8. P3-D4 is decided.
  - `contracts/interaction.md` §0 and §4.1: drop "pending the coordinator" and cite PLAN R2-8; IN-7's pass criterion is the amended one.
  - `tipQuick` stays off (S29) and stays as a test switch.
  - Record IN-7 against the amended criterion in `wp/P3.md`. Your measurements (leave start 210–230 ms; label 0.9 at about 1050 ms; label gone at 400–420; node hidden at 560–610) already meet it.
  - Your `REQ P3->V1` can drop the `tipQuick` part.
- [ ] REQ Coordinator->V1: PLAN R2-1, R2-2, R2-6, R2-8, R2-9.
  - `device/defaults.json`: `"quietBacking": "window"` (C1a's open REQ). `"actionsLive": true` only at release, under §4.6 item 9 (P2's open REQ). Do **not** set `tipQuick`, `libFixedSlots` or `modalOutsideGuard` (S28 to S30 are off).
  - `docs/NATIVE.md`: point its glassd section to `glassd-material.md` (GM v2 materials, not the v1 table; P9's note in GM §7) when you do the §6 update.
- [ ] REQ Coordinator->V2: PLAN R2-2, R2-6, R2-9, R2-11, R2-13. In `REPORT.md` and `conformance.md`:
  - score P-23 at 612 (§4.4);
  - list P-65 and P-67 as recorded deviations (§4.4);
  - use the amended PLAN-2c-1 (R2-2) and IN-7 (R2-8);
  - use R2-13's statistic for G-PERF (CSS-only verdicts from `native=off` runs only);
  - run §4.6 item 9's shipped-state check (P2's open REQ to you) before marking any T3 launch path kept (§4.5 item 4).
- [ ] REQ Coordinator->C5a: PLAN R2-5, R2-10.
  - Keep GP §3.4's Cancel at 60: C1c's REQ asking you for 56 is superseded.
  - Achievements stay `window` with the quiet legend on the dim band, as built (R2-10; C1a's open REQ about `.gp-foot.quiet`).
  - GP §8 Q-B (the binding UI's Back text run) was decided at plan time by S4 (E-BACK, PLAN §1.16; S4's source column lists GP Q-B): close it in GP.
- [ ] REQ Coordinator->C6a: PLAN R2-5. Value menus follow the count table: 6 options compact, 7–8 the grid. "Up to 8: anchored" is placement; settings routes with more than 8 keep your list page. SET's Cancel at 60 stands; C1c's REQ asking you for 56 is superseded.
- [ ] REQ Coordinator->C7: PLAN R2-5, R2-14.
  - The friend menu's Cancel is 60, not 56 (C1c's REQ is superseded on that point).
  - SM-D2's `/chat` circle box is now PLAN's rule, (sidebar width − 94, 14), and applies only while `searchCircle` is on. The People test row in SM §8.2 still expects "(362, 14)" and a 456 px sidebar: update it when you next touch SM.
- [ ] REQ Coordinator->C3b: PLAN R2-4, R2-5.
  - CC-A in native mode uses the report's `window {dim: 0.6}` **alone**, with no surface `dim` (they compound to 0.36). P7's open REQ says the same.
  - `concepts/control-center.md` §3's "Power alert … `t1` tint" row: no `t1`; it is the CSS scrim (§1.8).
  - `control-center-power*.html`: Cancel 60 when you next re-render (C1c's REQ about these mockups stands otherwise).

## Requests to the coordinator, handled

Found at the start of round R2 with `grep -n "REQ [A-Za-z0-9-]*->[Cc]oordinator" docs/phase2/wp/*.md`, 2026-10-07. Each is marked `[x]` in its log, with the answer on the line under it.

| Log | Line (at the time) | Request | Answer |
|---|---|---|---|
| `C1a.md` | 94 | Quiet legend, slots sum, WN O1, O2, O4 | R2-1, R2-2, R2-10, R2-11, R2-3 |
| `C1c.md` | 44 | REQ 6a–c: Cancel, P-65/P-67, P-35 | R2-5, R2-6 |
| `C1c.md` | 45 | E-MENU width, D28, Cancel's own line | R2-5 |
| `C2c.md` | 49 | REQ-7: source card | R2-3 |
| `C2c.md` | 50 | REQ-8: library ornament, PLAN-2c-1 | R2-2 |
| `C4a.md` | 63 | White-fill glow token | R2-7 |
| `P2.md` | 98 | `actionsLive` S-row and §4.6 item | R2-9 |
| `P3.md` | 35 | IN-7 (P3-D4) | R2-8 |
| `P7.md` | 76–80 | §1.8 after SG-5 | R2-4 |

## Other items seen (not requests to the coordinator)

- **`theme/50-appdetails.css:268`** (C5a): laser hover on Play uses a lighter literal glow (`0 0 18px 2px` white .22). It is a hover look, weaker than focus by design; focus uses the token. No action.
- **`device/rt/03-react-lab.js:30`** (P2): a lab fixture uses the old glow literal. Lab only, never shipped. No action.
- **GM §7** (P9's notes): the reporter's wide `hdr-search` slab is superseded under `wp.c1a` (C1a's `layers/20-shell.json`), so nothing in the toolbar row pops. The NATIVE.md pointer is filed with V1 above.
