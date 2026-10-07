# C2b Launcher ("+" popup): evidence log

Package card: PLAN §2.4 "C2b". Owns `theme/32-launcher.css`, `device/rt/32-launcher.js`, `theme/popups/32-launcher.json`,
`docs/phase2/mockups/home-apps-plus.html`, `home-apps-plus-t1.html`. Surface: `barpopup` (the "+" popup). Flag `wp.c2b`.

## Status

**READY: wp.c2b** (2026-10-07 09:56, Steam build 11094443). Milestones reached: M0 (note below), M2 (T1), M3 (T2/T3 behind
`wp.c2b`), T4 popup fragment in. M4: P7 reports only M1. One native session was still run at the user's request; results are in the log (no pops from C2b, the cover is acknowledged, the headset view is legible, and the G-HV verdict is left to V1).

- **What ships with `wp.c2b`:** the T1 grid (CSS, always on with the theme), T2 (Steam's "Liquid Glass" row tagged
  `data-lgs-row="liquid-glass"`) and T3 (A–Z order through P2's `c2b.plus` memo patch). **The pinned Liquid Glass toggle
  row appears only while P2's actions run live (`actionsLive: true`, set by V1 at release) or under the test flag
  `c2bToggle`.** Until then Steam's own switch row stays in the sorted grid with its green pip and calls Steam's own
  handler, so the user can always turn the theme off from "+". (P2 logs every T3 action while `actionsLive` is not true,
  so a toggle row there would do nothing.) T4: `theme/popups/32-launcher.json` puts the "+" popup at +25 mm (needs P6's
  wrapper, flag `wp.p6`).
- **Evidence (both input modes; details in the log):** gates on `barpopup` with the OPEN pre. SIZE, TYPE, OUTLINE and
  MOTION PASS in T1, in T3 and in T3 with the toggle row. AUD has no GONE, HIDDEN, UNCLICKABLE or CONTRAST finding; it
  shows only SHRUNK on the 24 cells and 10 label runs, because rows of 260 × 40 become cells of 72 × 96 (smaller area,
  larger short side). That is inherent in the design; see the REQ to P10 below. T3 with the toggle row passes all five
  gates. Gamepad traversal was checked with a popup probe (`pad-bfs` covers only `main`): every cell is reached, Down/Up
  and Right/Left are reversible, focus never leaves the popup except at Steam's own edges, B closes, and the entry focus
  is the first cell (in T3 the first program, never the switch). PLAN-2b-3 PASS. G-REMOVE PASS: `patchedLeft` is back to
  its value before the step and no node or attribute is left. The module logged no runtime warnings or errors.
- **Device left:** theme on, CSS only. Native mode was turned on and off during this session by other agents' sessions,
  never by C2b. Every step closed its popup and popped its flags; none of C2b's flags is left on.
- **Not built (documented deviations):** the All Apps circle (HA hides it when LQ5 fails; C2a's Apps route is not wired);
  the session "Recent" row; the word-aware "…" inside a single long word (T1 and T3 clip it at 70 px; the full-name plate
  shows the whole name on focus or dwell).

## M0 note (PLAN §1 conflicts, settled; no mockup re-render)

HA revision 3 already applies PLAN §1 to the "+" popup (HA §0.5, §4, §17 row 9). The mockups `home-apps-plus.html` and
`-plus-t1.html` were rendered at HA revision 3 (`shots/p2_home-apps_plus.png`, `p2_home-apps_plus-t1.png`). Points that
bind C2b:

| §1 | Decision | C2b |
|---|---|---|
| 1.3, 1.16 | Control vocabulary; exemptions | Cells are 72 × 96 popup px (87 × 116 main px at m .83): the whole cell is the hit. The toggle row (T3) is 64 popup px tall (77 main px), a single-control row whose switch is decorative (the row is the control) |
| 1.4 | Laser looks on `:hover`; gamepad focus + white .32 (P4 final); no scale on rows | Cell light on the disc: hover + .08 and a spot, focus + .32 with the arc; no scale (cells are not content cards) |
| 1.5 | P5 tokens | The card materializes with P5's `lgs-mat-large-in` (250 ms, scale from 1 + 12/300 at the bottom centre, HA §4); cell light on `hover-in` |
| 1.6 | Bar popups are `panel`; no outlines | Panel tint + E3 edge (`--lgs-edge: panel`, light from the upper left), no border, no ring |
| 1.7 | "+" popup +25 mm (not HA's old +30), popup `z` through P6's wrapper | `theme/popups/32-launcher.json` (`contentSel` = the list header, flag `wp.c2b`); no crop pops inside the popup (the table lists none) |
| 1.14 | HA-10: the switch lives only in "+", never default focus | T1: Steam's own row in Steam's order with a green pip. T3: A–Z; while actions run live, a pinned toggle row outside the grid's focus group, and Steam's first focus lands on the first program |
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
- [ ] REQ C2b->V1: `wp.c2b` is READY. The T3 toggle row follows `actionsLive` by design (see Status). When V1 sets
  `actionsLive: true` at release, re-run PLAN-2b-3 with `--flags wp.c2b` only (no `c2bToggle`), and have a wearer or the
  user check once with the real laser that the switch row turns the theme off and on (agents never press it).
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
