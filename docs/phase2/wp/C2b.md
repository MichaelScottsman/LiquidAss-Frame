# C2b Launcher ("+" popup): evidence log

Package card: PLAN §2.4 "C2b". Owns `theme/32-launcher.css`, `device/rt/32-launcher.js`, `theme/popups/32-launcher.json`,
`docs/phase2/mockups/home-apps-plus.html`, `home-apps-plus-t1.html`. Surface: `barpopup` (the "+" popup). Flag `wp.c2b`.

## Status

**READY: wp.c2b** (2026-10-07 21:05, Steam build 11094443; fix pass R2 done, session 2 17:45–21:05). Every finding of review R2 is
fixed or recorded with its reason (table in session 2), and every test of the card passes on the device in both input
modes: PLAN-2b-1, -2, -3, -4, AT-5, AT-12, G-FOCUS (P-14), P-18, P-03, G-MOTION, G-REMOVE. Milestones: M0, M2 (T1), M3
(T2/T3 behind `wp.c2b`), T4 fragment in; native checked in one session (no pops from C2b, the cover acknowledged, no
plates from C2b).

- **What ships with `wp.c2b`:** the T1 grid (CSS, always on with the theme: 4 × 72 × 96 cells, one-line labels ending
  in "…", the cell light, the name plate on attention); T2 (the switch row's pip tag; each cell's label fit, glyph and
  plate cover tags; P3's 0.4 s attention step for the laser plate); T3 (A–Z through P2's `c2b.plus` memo patch, names
  drawn as two explicit lines, the T3 panel). **The pinned Liquid Glass row** (Steam's own row element in the platter
  of HA §4) appears only while P2's actions run live (`actionsLive`, V1 at release) or under the test flag `c2bToggle`;
  until then Steam's own switch row stays in the sorted grid with its green pip. Its press never goes dead (B1): the
  LQ10 order, then P2's logged launch, else Steam's own row handler. T4: the "+" popup at +25 mm (P6's wrapper, `wp.p6`).
- **Evidence** (session 2, CSS tier `native=off`, both modes; T1 = CSS only, T3 = build state, T3 + toggle = release
  state): gates all five PASS in all three tiers × both modes, plus High Contrast and Reduce Motion; AUD's only waivers
  are E-GRID (cells) and E-GRID (labels), none "not met". G-FOCUS: every cell +40.2 to +60.2 L (T3 + toggle) and +43.9
  to +56.8 L (T1), the pinned row +60.6. P-18: 71–83 % of the final contrast on the first frame. PLAN-2b-4: every
  shortened name whole on attention, inside x 6–294, the labels under the plate at .22, back at rest after. PLAN-2b-2:
  T3 within ±8 px on every mapped rect; T1 the same except the floor's one-line label (explained). Filmstrips: glass
  before content. B1, PLAN-2b-3, traversal, G-REMOVE and leaks PASS.
- **Deviations (recorded with reasons in session 2):** the CSS-only floor's labels are one line (CSS cannot tell a long
  word from a third line; the runtime draws two) and its laser plate comes after P3's 80 ms dwell, not 0.4 s; the plate
  is mid grey, not HA's dark grey (P-14); the pinned row's radius is 32, not 28 (P-83); the first frame of focus starts
  at 75 % on this cell (P-18); the swell is 1 + 12/long side, not 1 + 12/300 (P-54); the grid's side edges stay Steam's
  exits to the bar; no exit motion (Steam hides the window at once); the All Apps circle and the "Recent" row are not
  built (LQ5 unproven; session memory needs live actions). The word-aware "…" is built (the R2-15 deviation is withdrawn).
- **Device left (21:05):** theme on, CSS only (native mode was turned on and off by other agents' sessions; C2b's own
  native session returned to CSS only); both barpopup windows hidden with no C2b node or attribute in them; no C2b
  flag in `/tmp/lgs/flags.json` (it holds only `wp.c1a`, another package's session override that predates this
  session) and no `flag-steps` record; the pointer parked by the lab; PC and Frame copies of the three C2b files
  identical (md5 3c06717e, d2a84004, 836848cd).

## M0 note (PLAN §1 conflicts, settled; no mockup re-render)

HA revision 3 already applies PLAN §1 to the "+" popup (HA §0.5, §4, §17 row 9). The mockups `home-apps-plus.html` and
`-plus-t1.html` were rendered at HA revision 3 (`shots/p2_home-apps_plus.png`, `p2_home-apps_plus-t1.png`). Points that
bind C2b:

| §1 | Decision | C2b |
|---|---|---|
| 1.3, 1.16 | Control vocabulary; exemptions | Cells are 72 × 96 popup px (87 × 116 main px at m .83): the whole cell is the hit. The toggle row (T3) is 64 popup px tall (77 main px), a single-control row whose switch is decorative (the row is the control) |
| 1.4 | Laser looks on `:hover`; gamepad focus + white .32 (P4 final); no scale on rows | The whole cell is the control and carries the light (session 2, review R2 M4): hover + .08 and P3's spot at the pointer, focus + .32 with a .16 spot and the arc, the disc adding its arc × 1.5 and a blurred glow; no scale (cells are not content cards). The first frame of focus starts at 75 % on this cell (P-18) |
| 1.5 | P5 tokens | The card materializes with P5's `lgs-mat-large-in` (250 ms, at the bottom centre, HA §4; the swell is 1 + 12/long side, so the top edge starts 12 px out, P-54: session 2) and its content with `lgs-mat-content-in`; cell light in on `hover-in`, out on `fade`; focus on `lgs-focus-in`; the plate on `lgs-mat-glass-in` (laser) |
| 1.6 | Bar popups are `panel`; no outlines | Panel tint + E3 edge (`--lgs-edge: panel`, light from the upper left), no border, no ring |
| 1.7 | "+" popup +25 mm (not HA's old +30), popup `z` through P6's wrapper | `theme/popups/32-launcher.json` (`contentSel` = the list header, flag `wp.c2b`); no crop pops inside the popup (the table lists none) |
| 1.14 | HA-10: the switch lives only in "+", never default focus | T1: Steam's own row in Steam's order with a green pip. T3: A–Z; while actions run live, Steam's own Liquid Glass row pinned below the grid as the toggle row (session 2), outside the grid's focus group, and Steam's first focus lands on the first program |
| 1.15 | Strings from Steam's localization | Header = Steam's own node; the toggle title is the program's own name; "Glass Shell is on" only when the UI language starts with `en` |

## Requests

- [x] REQ C2b->P10: an exemption for the "+" launcher cells (`%{DashboardBarPopupList}:has(> %{DashboardBarPopupListHeader})
  %{DashboardBarPopupListItem}`), e.g. `E-GRID`. AUD SHRUNK is expected there: stock rows of 260 × 40 become cells of
  72 × 96 popup px (PLAN §2.4 C2b, HA §4). Its own criterion: each cell ≥ 67 × 80 popup px (≥ 80 main px both ways at
  m .83), cells contiguous on a 72 × 96 pitch, the whole cell the hit (G-SIZE already passes). Until then C2b's AUD shows
  34 SHRUNK (24 cells, 10 label runs) and nothing else.
  - P10 (2026-10-07 session 4): done: `E-GRID` in `lab/exemptions.json` with your selector, scoped to AUD's
    SHRUNK only (`_scope`: SIZE, TYPE and OUTLINE still judge the cells; GONE / HIDDEN / UNCLICKABLE / CONTRAST
    are never waived). The waiver holds only while the themed cell meets your criterion, checked live per cell:
    ≥ 80m × 96m (66.4 × 79.7 bar px), abutting its row and column neighbours (gap ≤ 2), the whole cell its own hit
    (≥ 95 % own, 0 % other); otherwise the SHRUNK stays with "(E-GRID criterion not met: …)". `gates barpopup
    --pre <OPEN> --only aud,size --mode laser` (11:15, T1, native off): AUD **PASS**, 0 issues, 35 E-GRID waivers (24 cells +
    label runs, each "cell 72 x 96, gaps 0 / 0, hit 100% own, 0% other"); SIZE PASS (24 checked). E-GRID is not
    in PLAN §1.16 yet: REQ P10->Coordinator asks to add it (HA §4's cell and hit region); name it in your evidence
    until then. contracts/lab.md §6.
- [ ] REQ C2b->V1: the T3 toggle row follows `actionsLive` by design (see Status). When V1 sets `actionsLive: true` at
  release, re-run PLAN-2b-3 with `--flags wp.c2b` only (no `c2bToggle`), and have a wearer or the user check once with
  the real laser and the gamepad that the pinned row turns the theme off and on (agents never press it). Since the fix
  pass (session 2) the pinned row is Steam's own Liquid Glass row element; when P2's scan has not answered, or P2
  refuses, its press goes to Steam's own row handler, so it cannot go dead (review R2 B1).
- [x] REQ Coordinator->C2b (in `coordinator.md`, PLAN R2-15): answered there (session 2): labels cut no glyph,
  PLAN-2b-4 and PLAN-2b-1 PASS in T1 and T3, both modes.
- [ ] REQ C2b->C2a: `home-apps.md` §4 and `home-apps.css` (`.hp-*`, yours) describe four values that the "+" popup's
  measured gates overrule (session 2; no change to C2b is needed, only the concept and the mockup kit): (a) the cell's
  gamepad focus is PLAN §1.4's + white .32 on the whole cell (the kit's `.hp-cell.is-focus` .14 measured +21..+42 L,
  P-14 needs +40); (b) the name plate is mid grey `rgb(112 114 122 / .94)`, not `rgb(66 68 76 / .92)` (with the dark
  plate the attended cell measured +27..+39 L; white text stays 4.8:1); (c) the Liquid Glass row's radius is 32 (P-83:
  a 64 px text control needs ≥ 28.8), not 28; (d) the "+" panel's swell is 1 + 12 / its long side, not 1 + 12/300
  (P-54: the header moved 24.6 px). Labels: §4's "word-aware …" holds; the CSS-only floor (R23) is one line.
- Info for C3a (no change needed): `30-bar.css` resets the "+" card (`%{DashboardBarPopupContents}:has(header)` →
  transparent). `32-launcher.css` draws that card's glass at equal specificity (it is the later file) and the T3 panel with
  `div.lgs-c2b-panel[data-lgs-c2b]`. Keep the reset no stronger than (0,3,1).

## Log

### 2026-10-07 session 1 (08:20–09:56): M0 note, M2, M3, T4, verification

Read: PLAN §0, §1.1–§1.7, §1.14–§1.16, §2.1, the C2b card, §4.1, §7; HA §4, §5, §12.7, AT-5, AT-12; contracts `tokens.md`,
`react.md` §0–§8, `runtime.md` §1–§3, `reporter.md` §3 and §5, `lab.md` §1 plus gates and pad-bfs; LAB.md; inventory
`bar.md` §0.3, §2.0, §2.1; the C1a and C4a interfaces. `grep "REQ [A-Za-z0-9]*->C2b:"` at start and end: none.

Live findings the build relies on:

- The "+" popup is the only list card with a header (Playspace has none), so every rule is scoped with
  `%{DashboardBarPopupList}:has(> %{DashboardBarPopupListHeader})`, and P6's wrapper uses the header as `contentSel`.
- The "+" button (`plusButton`, a mobx memo) renders Steam's bar popup button with `popupContents` =
  `DashboardBarPopupList {header, group, children: 24 rows {icon, label, onActivate, bottomSeparator}}`. The T3 wrap only
  reorders and filters these elements and calls no hooks. Steam's rows, launch handlers and focus stay Steam's.
- In VR, Steam's popup shows no `.gpfocus` without a real controller (its nav tree has `disableFocusClasses`). The gamepad
  probe therefore activates the popup's nav tree and reads each nav node's `BHasFocus()` after
  `FocusNavController.DispatchVirtualButtonClick`. It never presses A, X or Y, and presses B only at the end, to close.
- Steam's row `::before` (the active dot at left −6 px) took 2 % of the neighbouring cell's hits; it now has
  `pointer-events: none`. Steam's separator `::after` (bottom −.5 px) made the grid scroll by 1 px, so Steam set its bottom
  fade; the separator now sits inside the cell.
- A tall 300 px slab sees only ±22° of P4's E3 conic along its top edge (edge ratio .41 > .35). The card sets
  `--lgs-light: 305deg` (light from the upper left), and the ratio now passes with the arc and lobe kept.
- Down from a short last row (23 programs plus the toggle) bubbled to the popup frame, which sends focus to the bar and
  closes the popup. The T3 panel is now a `Focusable` with `flow-children: column`, so Down reaches the toggle row.
- `05-native.css` zeroes `--lgs-mat-panel-bg` on `[data-lgs-cover]`. The T3 panel carries Steam's
  `DashboardBarPopupContents` class, so P6's barpopup cover (`all: true`) covers it in native mode.

| Test | Command | Result | Evidence | Time |
|---|---|---|---|---|
| T1 look | `glass.py shot barpopup p2_c2b_plus_t1_live --pre "<OPEN>; .gpfocus on cell 21" --mode pad` | 300 × 652 panel, header 52 (22 Bold), 4 × 6 grid of 72 × 96, discs 52, labels ≤ 2 lines, green pip on Liquid Glass (first in Steam's order), plate left-aligned in column 1. Matches `p2_home-apps_plus-t1.png` by eye; no bottom fade since the separator fix | `shots/p2_c2b_plus_t1_live.png` | 09:40 |
| T3 look | `glass.py shot barpopup p2_c2b_plus_t3_live --pre "<OPEN>" --flags wp.c2b,c2bToggle --hover "%{DashboardBarPopupListItem}:nth-child(5),700"` | 300 × 726 panel (12 + 52 + 576 + 10 + 64 + 12, exactly HA §4), A–Z, toggle row pinned (44 disc with the icon, "Liquid Glass" 19 Semibold, "Glass Shell is on", green switch), laser plate on "Discover". Matches `p2_home-apps_plus.png` by eye, except the All Apps circle (not built) and clipped single long words | `shots/p2_c2b_plus_t3_live.png` | 09:40 |
| G-AUD/SIZE/TYPE/OUTLINE/MOTION, T1 | `glass.py gates barpopup --pre "<OPEN>" --mode laser`, and `--mode pad` | SIZE, TYPE, OUTLINE, MOTION PASS. AUD: 0 GONE / HIDDEN / UNCLICKABLE / CONTRAST, 34 SHRUNK (cells and labels; REQ P10) | gates JSON (scratch) | 09:50 |
| Same, T3 (switch row in the grid) | `… --mode pad --flags wp.c2b` (laser at 09:20) | As T1 | gates JSON | 09:52 |
| Same, T3 + toggle row | `… --mode laser --flags wp.c2b,c2bToggle`; pad at 09:22 | **All five PASS** (both modes) | gates JSON | 09:51 |
| AT-12 / G-PAD, T1 | Popup probe (`padprobe2.js`: OPEN, nav tree `Activate`, `BTakeFocus` on each cell, D-pad each way, B), `--mode pad` | 24/24 reached, 0 irreversible. Steam's grid navigation (Down = +4, Right = +1); edges either stay or are Steam's exits; B closes. `display: grid`, 4 columns, every cell inside the scroller (scrollHeight 576 = clientHeight), labels 70 px wide | probe JSON | 09:07 |
| AT-12 / G-PAD, T3 | Same, `--flags wp.c2b` and `--flags wp.c2b,c2bToggle` | 24/24 reached. The toggle row is reached from every last-row cell, and from cell 19 through the nearest cell of the short last row. Up from the toggle returns to the last focused cell; B closes. Entry = the first program ("Camera Switch"), which is AT-5 (d) | probe JSON | 09:31, 09:35 |
| AT-5 (a) | T1 and T3 DOM probes | The row whose text is exactly "Liquid Glass" exists in T1 (Steam's row) and in T3 (in the grid, or as the toggle row) | js | 09:20 |
| PLAN-2b-3 | `glass.py js` with `--flags wp.c2b,wp.c2a` (before `c2bToggle` existed the toggle row was always on): `actions.test(true)`, main on `/library/lgs/steamhome`, OPEN, then `L.click('barpopup', '.lgs-c2b-toggle')` only after checking that `actions.mode()` is `test` | Log: `navigate("/library/home") logged`, then `launchNonSteam(".../glass-shell/device/lgs …toggle…") logged`. The route did not change and the theme stayed on (nothing ran) | js | 09:27 |
| T4 popup z | `glass.py js "<OPEN>; popups.status()" --flags wp.p6,wp.c2b` | The live barpopup has entry `launcher`, z 0.06775 units (+25 mm × S, bar space); popped with the step | js | 09:44 |
| G-REMOVE | `glass.py js`, push then pop `wp.c2b` | `react.status().patchedLeft` 2 → 5 → 2 (the 2 are another package's override); `patches` empty afterwards; no `.lgs-c2b-*` or `data-lgs-row` left; stock order back | js | 09:47 |
| Native check (P7 is at M1; run anyway at the user's request, "still do native glass work") | `glass.py native-session --step "shot barpopup p2_c2b_plus_native --pre <OPEN> --flags wp.c2b,c2bToggle,wp.p6" --step "js <OPEN> --keep" --step "hv c2b_plus_native --look" --step "sgcheck --pre <OPEN>"` | Native on and back to CSS only: yes. The DOM shot shows the T3 panel's CSS glass dropped (the cover is acknowledged), with fills, discs and the toggle platter kept. **sgcheck:** `barpopup` has 0 pops, depth 0 (C2b adds no crop). The only FAILs are main's legacy `hdr-back`, `footer` and `tabs` at 4.4–5.5 mm (C1a / legacy, not C2b). **hv (looked at, then deleted on both machines):** the "+" popup sits on real glass in front of the window, and its header, discs and labels are legible. The upper rows may show a faint doubled image: when the shot step popped its flags, the popup swapped from T3 back to T1, so the frame probably caught that re-render. The G-HV verdict is withheld (no `--rect`); a clean re-look belongs in V1's native gate | `shots/p2_c2b_plus_native.png` (DOM only, no room) | 10:02 |

### 2026-10-07 session 2 (17:45–21:05): fix pass R2

Read: `C2b-review-R2.md` (B1, M1–M7, m1–m10), PLAN §1.4, §1.5, §1.16 (E-GRID, E-GRID (labels)), R2-15, the C2b card,
`coordinator.md` R2-15 and `REQ Coordinator->C2b`, HA §4, §5, §11, §12.7, `contracts/lab.md` §1–§4 (gates, focus,
motion, cmp, native-session), `contracts/interaction.md` §2 (`rt.attend`), `contracts/react.md` §0, P2's `actions` and
`data.useNonSteamApps`, P5's keyframes. `grep "REQ [A-Za-z0-9-]*->C2b"`: only `REQ Coordinator->C2b` (answered below).

The last checkpoint (17:43) held an earlier, unlogged start of this pass (a B1 fallback in the toggle component, a
cell light layer, the mockups' `data-id`s, `C2b-cmp.json`). It had never been on the device; this session tested it,
kept what held and rewrote the rest. Scratch probes and JSON: `<scratchpad>/c2b_fix/` of this session.

**What the live device showed, and what changed**

- **Steam's row key is not the command line.** Each "+" row element is keyed by its program's exe path
  (`.../glass-shell/device/lgs` for the switch; `cmake-gui`; `.../CameraSwitch`), and the switch's `strCmdline` carries
  an argument (`.../lgs "toggle"`, from P2's scan). So the key cannot feed `launchNonSteam`. Steam's row handler is
  `()=>Ae(et)` (a closure over the app), read from the fiber (`probe4.js`, 17:54).
- **Chromium's line clamp cuts the ellipsis too.** With `-webkit-line-clamp: 2`, a name whose last shown word plus "…"
  is wider than 70 px draws the "…" past the box: "Remote..", "System..", "Display..", "Screen.." with the third dot
  clipped (`shots/p2_c2b_f1_t3_pad.png`, 18:21, zoomed). And inside a clamp no "…" is drawn across (the review's M1). So no label uses the clamp
  any more (below).
- **A hidden remainder reads as HIDDEN.** An attempt that kept the cut part of a name in the DOM with `display: none`
  failed G-AUD (8 × "HIDDEN text lgs-c2b-more", 18:32): AUD's stock snapshot keeps the runtime's DOM. A `<br>` between
  the two lines failed too: `innerText` read "Hide/ Show Screens", and AUD's re-match by text reported GONE (18:39).
- **`data-lgs-plate` is P6's attribute.** The first T2 tag for the laser's 0.4 s step was named `data-lgs-plate`; P6's
  reporter reports every `[data-lgs-plate]` element as a glassd plate (`device/lgs_layers.js` 1312). All C2b tags are now
  `data-lgs-c2b-*` (found by the removal probe's leftover count, 19:15; re-run clean 19:27).
- **The laser rests on the popup.** In the first laser gate run (18:25) a cell was hovered and attended (its plate on
  "Google Chrome", visible in the OUTLINE capture), so AUD read the faded neighbour labels as CONTRAST. Nothing in the
  step hovered it: the headset's laser or a pointer left over the popup's position. Laser-mode gates now park the pointer
  on the header with `--hover "%{DashboardBarPopupListHeader},300"` (a rest state: no cell attended); pad-mode gates have
  no `.gpfocus` in the popup (the pre does not activate its nav tree), so both modes judge the rest state.

**Fixes, by finding**

| Finding | Fix (files) | Verified by |
|---|---|---|
| B1 the pinned row fails open | The pinned row is now **Steam's own Liquid Glass row element** (Steam's row component, Focusable, icon and label), pinned in `.lgs-c2b-pin` and drawn as HA §4's toggle platter by CSS (the subtitle from the wrapper's `data-lgs-sub`, English only; the switch a decorative pseudo-element). Only its press is ours (`runToggle`): the LQ10 order, then P2's logged `launchNonSteam` with the command line from P2's scan, else **Steam's own row handler** (`()=>Ae(et)`), gated by P2's test reasons (live: run; test: logged as `c2b.steamRow`). Used whenever the finder is missing, the first scan has not answered, or P2 refuses. Never inert. (`32-launcher.js` `Pin`, `runToggle`, `steamRowPress`) | `b1fix.js` (19:03): finder broken → the row is there (23 cells, no Liquid Glass cell, Steam's handler in the slot), a press logs `c2b.steamRow` (no scanned command line); a press 580 ms after opening, before the scan → `c2b.steamRow` logged (not dropped); after the scan → `launchNonSteam logged .../lgs "toggle"`; Steam's launch call missing → P2 `refused`, then `c2b.steamRow` logged. Spy on `LaunchNonSteamApp`: 0 calls; hook and spy restored. G-AUD now finds Steam's row in T3 + toggle (no GONE; 49 records re-matched) |
| M1 labels cut mid-glyph | No line clamp. **CSS-only floor:** one line ending in "…" (`text-overflow` on the label's own box). **T2** (`data-lgs-c2b-fit`, measured on a hidden probe with the label's font and width): `whole` names wrap to two lines; `word` (a word wider than 70 px) and `lines` stay one line with "…". **T3**: a name that does not fit one line is drawn as two explicit lines, the longest run of words (or parts after "/", HA §4) that fits, then the rest in its own one-line box (`.lgs-c2b-l2`, an inline-block: no `<br>`, the text stays the stock name) that ends in "…"; where Chromium's cut would land just after a space ("System …") T3 narrows that box so it lands at the word's end ("System…") | Shots `p2_c2b_f6_t3tog_pad.png` (18:52) and the gate captures: "Frametop / Display…", "KDE / System…", "Hide/ / Show S…", "Visual / Studio…", "Chromi…", "qBittorr…", "LXTerm…", "Render…" (as the mockup). PLAN-2b-1 below |
| M2 plate over full-opacity labels | T2 measures each plate's width in its own type and tags the row-mates it covers (`data-lgs-c2b-under`: l1–l3, r1–r3, from the CSS placement); those labels fade to .22, in on the plate's 250 ms materialize, out on `fade`. The CSS-only floor fades every row-mate. The plate stays inside x 6–294 in every column (columns 2 and 3 are centred unless that crosses the grid edge) | PLAN-2b-4 below: every overlapped label at .22, 0 above |
| M3 cmp never run | `data-id`s in both mockups (kept from the earlier start), `C2b-cmp.json` (pinned-row selector updated) | PLAN-2b-2 below |
| M4 focus +21..+42 L | The whole cell is the control and carries PLAN §1.4's gamepad focus: + white .32 uniform, a .16 spot in the upper third and the arc (`::after`, Steam's separator re-used inside the cell); the disc keeps its fill and adds its arc × 1.5 and a blurred glow. Laser hover: + white .08 and P3's light spot at the pointer on the cell (`::before`, Steam's active dot re-used). The name plate is mid grey (rgb 112/114/122 at .94, white text 4.8:1) instead of HA's 66/68/76: it covers a third of the attended cell, and the darker plate pulled the cell to +27..+39 L (19:07) | G-FOCUS below |
| M5 first frame 25 % | Every focus layer (the cell's light, the disc's arc, the gamepad plate) is on at once and enters through P5's `lgs-focus-in`. On this cell the first frame starts at 75 % (`--lgs-focus-first: .75` on the cell): the focus look also moves the label into the plate, and at P4's 60 % the whole cell measured 50–60 % of its final contrast (19:20). The attended cell's own label snaps to full opacity | P-18 below |
| M6 content fades with the glass | `lgs-mat-content-in` on the card's children (T1: header and scroll region; T3: the list and the pinned row). The swell uses the card's long side (`--lgs-maxside` 680 / 726, so the top edge starts 12 px out): HA's 1 + 12/300 moved the header 24.6 px (P-54 FAIL, 19:31) | G-MOTION below |
| M7 READY unsupported | Status rewritten from the evidence below | — |
| m1 P-01 | Every plate and label rule keys on the input mode (ATT in the CSS header: `.gpfocus` under pad, P3's attention under laser) | gates and focus runs in both modes |
| m2 plate timing | Laser: the plate waits for P3's 0.4 s attention step (`rt.attend(..., {steps: [400]})`, cells tagged `data-lgs-c2b-step`) and materializes in 250 ms (`lgs-mat-glass-in`). Gamepad: on focus, entering with the focus look (`lgs-focus-in`). The hover light (on the cell) in on `hover-in`, out on `fade` | focus runs (attention classes `lgs-attend-400` on the attended cell) |
| m4 one glyph for six programs | T2 tags icon-less cells `data-lgs-c2b-glyph` by name (terminal, gear, remote, screens, display, camera); the CSS draws six masks | shots (Konsole, KDE System Settings, Frametop Remote Access, Hide/Show Screens, Desktop, Camera Switch) |
| m5 spec drifts | Label line-height 18 (two lines end at 96, inside the cell; the disc moved up 1 px); the pinned row's radius **32, not HA's 28**: at 28 G-SIZE failed P-83 (a 64 px text control needs ≥ 28.8, 18:39) | gates |
| m6 a second scan per open | P2's scan runs once per module lifetime (until it answers), then its entry is cached | `b1fix.js` (`entryLater` after the first scan) |
| m8 High Contrast | Cell focus = white .30 + the 2 px stroke; no spot, no glow (cell, disc, pinned row) | `gates --media contrast` below |
| m9 P-03 | The hover light is on the cell (the control), not the disc | P-03 below |
| m10 the switch claims a state | The pinned row is Steam's own row (no `role=switch`, no `aria-checked`); the switch is decorative and shows "off" only after a live press has run the switch (`data-lgs-busy`) | `b1fix.js` facts |

Not changed, with reasons (deviations, recorded):

- **m3, the grid's side edges close the popup.** Left from column 1, Right from column 4 and (T1) Down from the last row
  are Steam's own exits from a bar popup to the bar. Steam's stock list exits the same way on every Left/Right. Keeping
  focus inside would need a nav override on Steam's grid; the pinned row already catches Down in T3 (`pad.js`, 19:05).
- **m7, exit motion.** Steam hides the bar popup's window at once on close; a 350 ms `materialize-out` would need
  Steam's popup kept open after its close. Not built.
- **The plate's own exit** is instant (the plate is Steam's label itself; CSS cannot hold its layout after attention
  ends). PLAN-2b-4 needs it gone within 500 ms: it is gone at once.
- **The CSS-only floor's laser plate** shows on P3's 80 ms dwell, not after 0.4 s: CSS cannot delay a layout switch, and
  the 0.4 s step needs the runtime (present whenever `wp.c2b` is on).
- **The All Apps circle** (HA §4, T3 only): not built. HA hides it while LQ5 fails; LQ5 (Home › Apps from the bar) is
  UNPROVEN and C2a's Apps route is not wired for it.
- **The "Recent" row** (HA §4 Groups, T3): not built (session memory of launches would need P2's live actions).

**Evidence (CSS tier: every step's `step:` line says `native=off`; steps that landed in another agent's native session
were repeated by the runners).** Flags: T1 = `wp.c2b=false,c2bToggle=false,wp.p3` (the CSS-only floor, R23); T3 =
`wp.c2b,c2bToggle=false,wp.p3` (the build state: Steam's switch row stays in the sorted grid); T3 + toggle =
`wp.c2b,c2bToggle,wp.p3` (the release state, as with `actionsLive`). OPEN = open "+" (`open.js`); laser gates add
`--hover "%{DashboardBarPopupListHeader},300"` (above).

| Test | Command | Result | Time |
|---|---|---|---|
| **PLAN-2b-1** (G-AUD/SIZE/TYPE/OUTLINE/MOTION) | `glass.py gates barpopup --pre <OPEN> --json --shot p2_c2b_r2f_<run>` × T1, T3, T3 + toggle × laser, pad | **All 6 runs PASS, all five gates.** AUD 0 issues; waivers only E-GRID (`waived: SHRUNK`, "cell 72 x 96, gaps 0 / 0, hit 100% own, 0% other") and E-GRID (labels) (`waived: SHRUNK`, e.g. "(1) inside its cell (box 1,60,70,36); (2) 1 line(s); (3) no glyph cut; (4) its text is the stock name"); none "not met". T1: 24 + 16; T3: 24 + 16; T3 + toggle: 23 + 9, 49 records re-matched (Steam's "Liquid Glass" row found in the pinned slot, no GONE). SIZE 24 checked (the pinned row a capsule at 32), TYPE 25–38 checked, OUTLINE top-edge ratio .062–.09, MOTION at rest 0. Re-run on the final code: all 6 again PASS after the T3 list width fix (20:34–20:46), and the 3 laser runs again after the hover tokens went back to P4's (21:00–21:01) | 19:45–19:54, 20:34–20:46, 21:00–21:01 |
| Same, `--media contrast` | T3 + toggle pad, T1 pad | PASS, all five (OUTLINE's High Contrast stroke judged as P-42 allows) | 19:57, 20:04 |
| Same, `--media reduce` | T3 + toggle pad | PASS, all five | 20:10 |
| **G-FOCUS P-14** (gamepad) | `glass.py focus barpopup --pairs pairs_*.json --mode pad` (each cell reached by one D-pad move, as a user does; rest = the same cell with focus 8 cells away; `--room auto`: judged over the bright L 210 and dark L 24 rooms, the worse counts) | T3 + toggle: **23/23 cells +40.2 to +60.2 L** (bright; dark +58.5 to +74), the pinned row **+60.6**. T1 floor: **24/24 cells +43.9 to +56.8 L** (dark +63 to +78.7). For information, the disc alone: 18 of 23 ≥ +40; the five bright icons (Chromium, Dolphin, Google Chrome, qBittorrent, RenderDoc) +25.7 to +36.1 (the cell carries the focus). Before the plate was lightened (19:07): plated cells +27.3 to +39.3, FAIL | 19:18, 19:24 |
| **P-18** first frame | `focus --pairs first.json --flags <T3>` (`mkpairs2.py first`: every animation of the cell, its pseudo-elements included, held at 16.7 ms as `.gpfocus` lands after a D-pad move; the cell's `::after` then reads .77) | First / settled frame contrast, bright and dark rooms: CMake (no plate) 79 / 79 %, Frametop Display Settings 79 / 79 %, Frametop Remote Access 76 / 71 %, KDE System Settings 80 / 77 %, qBittorrent 83 / 82 %: **all ≥ 60 %**. (At P4's 60 % start, 19:20: 50–69 %) | 19:44 |
| **PLAN-2b-4** gamepad | the P-14 runs' states: focus moved into each cell; 800 ms later the plate's facts and the previous cell's | T3 + toggle: the 12 shortened cells (4 `word`, 8 `split`) each show the **stock name whole** (no overflow in its box), **inside x 6–294**, the 21 labels they cover **all at .22**; the 11 `whole` cells and the pinned row show no plate; **23/23 previous cells back at rest**. T1 floor: 24/24 plates whole and inside 6–294, 41 covered labels all at .22, 23/23 back at rest | 19:18, 19:24 |
| **PLAN-2b-4** laser | `focus --pairs lpairs_*.json --mode laser` (real CDP hover held 900 ms per cell; 800 ms at 20:19) | T3 + toggle: 10/10 shortened cells whole, inside 6–294, 18 covered labels at .22, 9/9 back at rest; T1 floor: 8/8, 15 covered labels at .22, 7/7 back at rest. Timing: the plate is on at P3's 400 ms step and materializes in 250 ms; the covered labels fade in on the same 250 ms (done by 650 ms, inside the 800 ms); a first build faded them on `fade` 441 ms, still .24–.27 at about 700 ms (19:44), so the fade-in was moved to the plate's own token | 19:20, 19:25, 20:19 |
| **P-03** laser hover | `focus --pairs lwpairs_t3tog.json --mode laser` (CDP hover held 900 ms) on the 11 cells that never show a plate, over P10's rooms (`--room auto`: L 210 and L 24) and P4's tuning rooms (`--room 134,134,134`, `51,51,51`) | Cell (the control) over rest, P4's tokens (+ .08, spot .12): **+14.0 to +17.2** (L 210), **+17.0 to +21.0** (L 24), **+15.2 to +18.8** (L 134), **+16.6 to +20.4** (L 51): inside +10..+25 in all four; the pinned row +18.9 to +23.6. (A cell that shows a plate reads +22 to +37 at 900 ms: that is the plate, the 0.4 s attention reveal, not the hover look; two intermediate tunings at 20:28 and 20:48 were measured with the plate in the capture and are void.) The disc alone, for information: +7 to +14 | 20:57–20:59 |
| Native (one `native-session`, 20:47–20:52) | `run_native.py`: `nprobe.js` (T3 + toggle and T1, `wp.p6`), `sgcheck`, native `gates` (T3 + toggle, pad), a DOM shot with focus, `hv --look` | Back to CSS only: yes. **Cover:** T3 + toggle, the reporter's barpopup cover is our panel `[0, 447, 450, 1089]` texture px, r 60 (= 300 × 726 at (0, 298), radius 40, × 1.5); T1, the list card `[0, 558, 450, 978]`, r 60. Both acknowledged; the CSS glass dropped there (`--lgs-mat-panel-bg` transparent, `--lgs-edge` none). **Plates from C2b: 0** (`[data-lgs-plate]` in the popup: 0; the reporter's barpopup `plates: 0`). **T4:** the live "+" barpopup has entry `launcher`, z 0.06775 (+25 mm); in T1 (`wp.c2b` off) Steam's 0.01. **sgcheck:** barpopup 0 pops, depth {0} (C2b adds no crop); the only FAILs are main's `tab-arrow` (4.43 mm, not C2b). **Native gates:** all five PASS (AUD 0, 32 waivers, 49 re-matched). **hv** (looked at, then deleted; none left on the Frame): the "+" popup in front of the window over the room, one copy (doubling .17), header, cells, the plate on the focused cell and the pinned row legible; G-HV verdict withheld (auto rect), as for every barpopup look | 20:47–20:52 |
| **G-MOTION** filmstrip | `glass.py motion barpopup --pre openfast(_t3).js --name c2b_r2f_<t1|t3tog>` (the pre returns as soon as the popup's content exists) | **PASS.** T1: three of ours, `lgs-mat-large-in` on the card and `lgs-mat-content-in` on the header and the grid, 250 ms linear, tokens PASS, swell 1.0177 (top edge 10.9 px, P-54 PASS), at rest 0. T3 + toggle: the panel's `lgs-mat-large-in` and `lgs-mat-content-in` on the list and the pinned row, swell 1.0167. Strips viewed: glass alone at f .15 and .35, content blurred in at .5, sharp at 1 (**glass before content**; no text scaling; no closed outline). `--media reduce`: PASS (opacity only, P-56) | 19:34, 19:41, 19:43 |
| **PLAN-2b-2** (G-MOCK) | `glass.py cmp docs/phase2/mockups/home-apps-plus-t1.html --id C2b --flags <T1> --mode pad` and `home-apps-plus.html --flags <T3 + toggle>` (`C2b-cmp.json`: each pre moves gamepad focus into the mockup's plate cell) | **T3: PASS**, every mapped rect within ±8 px (panel, header, grid, cell-1/8/23, disc-1 −1, label-1 −2, label-7 −2, plate +3.8/−3.8, pinned row 0), after the T3 list was given the panel's 288 px (the header box was 300, `dw` +12, 20:24). **T1:** all within ±3.8 except `label-1` `dh` −18: the CSS-only floor draws "Liquid …" on one line where the mockup draws two (explained above). Agent's look at matched scale (`mock_vs_live_*.png`, scratch): T3 matches the mockup in layout, order, two-line labels, the plate and the faded labels under it, the pinned row; the differences are the CSS-only tint instead of room glass (PLAN §1.6), the All Apps circle (not built), Steam's real icons (Camera Switch has none: the camera glyph), Chromium's character-level cut on line 2 ("Input S…" where the mockup ends "Input…"), and the brighter focus fill and plate (P-14). T1: the floor's one-line labels and its generic glyph (glyph tags need T2). The composite `shots/p2_cmp_c2b_*.png` crops the mockup at 1:1 though it is drawn at × 1.2 (a `cmp` display quirk; the deltas use `mockScale`) | 20:23, 20:26 |
| AT-5 (d) entry focus | `entry.js` (open "+", activate the popup's nav tree, no key pressed) | T3 and T3 + toggle: Steam's focus lands on the first program, "Camera Switch", never the switch | 20:33 |
| B1 | `glass.py js b1fix.js --flags <T3 + toggle> --mode laser` | See the B1 row above: never inert, every fallback path logged, nothing ran | 19:03 |
| **PLAN-2b-3** | `lq10.js` (`--flags <T3 + toggle>,wp.c2a`): main on `/library/lgs/steamhome`, press the pinned row | Log: `navigate logged /library/home replace=true`, then `launchNonSteam logged .../device/lgs "toggle"`; the route stayed, the spy saw no call, the route was put back. **PASS** | 19:04 |
| AT-12 / P-20 / P-24 (gamepad) | `pad.js` (popup nav tree activated; D-pad from every cell in every direction; A on CMake and on the switch row with Steam's launch call spied; B) | T1 and T3 + toggle: every cell reached, **0 irreversible moves**, B closes. A on CMake → Steam's handler → spy `cmake-gui` (nothing ran). A on the switch: T1 Steam's row → spy; T3 + toggle pinned row → `launchNonSteam logged`. Exits: Left from column 1, Right from column 4 (and T1 Down from the last row) close the popup (Steam's exits, m3 above) | 19:05, 19:06 |
| G-REMOVE + leaks | `remove.js` (8 open/close cycles; then `wp.c2b` off while the T3 popup is open; reopen) | Subscriptions 5 → 5, listeners 9 → 9, popup counters unchanged; off: popup closed, **0 nodes, 0 attributes** (`[data-lgs-row]`, `[data-lgs-c2b*]`, the probe), `c2b.plus` gone, `patchedLeft` 0; reopened: Steam's order, no tag | 19:27 |
