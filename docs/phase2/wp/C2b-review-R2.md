# C2b Launcher ("+" popup): adversarial review R2

Reviewer: independent agent (review R2). Package card: PLAN §2.4 "C2b Launcher ("+" popup)" as amended by R2-15
(13:10); builder's log `docs/phase2/wp/C2b.md` (Status: "READY: wp.c2b", 09:56). Concept: `docs/phase2/concepts/home-apps.md`
(HA) §4, §5, §11, §12.7, AT-5, AT-12. Steam build `11094443`. Device clock = PC clock (EDT). Scratch evidence (probes,
JSON): `<scratchpad>/c2b_r2/` of this session (first session: `<scratchpad>/r2/`); kept shots are
`shots/p2_c2b_r2b_*.png` (DOM captures of the popup only, no room).

## Status

**Done** (2026-10-07 16:30 EDT). Sessions: first 11:07–12:13 (cut off), second 13:11–13:58, third 15:15–15:31 (a
recheck after a usage-limit pause), fourth 16:22–16:30 (a short recheck after P10's session-5 gate changes).
Everything below was measured in the second session unless it says "first", "third" or "fourth session". Verdict:
**fix**.

- **Fourth session:** the files under test, the C2b log (11:42) and PLAN (13:08) are still unchanged (md5 as below,
  16:22); `REQ Coordinator->C2b` is still open. With P10's 16:09 `lab_gates.js`, `gates barpopup --only aud,motion
  --flags wp.c2b,c2bToggle --mode pad` (16:22, native off) now matches the T3 records across the panel (47 re-matched)
  and FAILs on **7 real issues**: the 5 cut labels and GONE Steam's "Liquid Glass" row and its label (M1, B1); MOTION
  PASS. `glass.py motion barpopup` now films the entry (16:24): one animation only, `lgs-mat-large-in` on the T3 panel
  (scale and opacity), no content channel (M6 confirmed on the filmstrip). Device after: `/tmp/lgs/flags.json` absent,
  no `flag-steps` records, popups closed by the lab's lock exit, native off.

- Files under test are unchanged across all three sessions and byte-identical on the PC and the Frame (md5
  `32-launcher.css` 65fb3649, `32-launcher.js` b232b5b6, `theme/popups/32-launcher.json` 836848cd; rechecked 15:15). The C2b
  log is unchanged since 11:42; PLAN is unchanged since 13:08.
- PLAN changed while the package sat at READY: R2-15 adds E-GRID and E-GRID (labels) to §1.16 and PLAN-2b-4 to the
  card. `REQ Coordinator->C2b` (R2-15) is open and unanswered.
- **Third session:** P10 changed `lab/lab_gates.js` at 14:51 (this review's REQ, label clause 3). `gates --only aud`
  was re-run (15:21–15:28, both modes, native off): PLAN-2b-1 now **FAILs** on the gate too, on 5 cut labels (M1 is
  corrected from 9 to 5), and T3 + toggle now FAILs with 49 GONE (M1). The `lgs off` half of G-REMOVE was added:
  a `--stock` step (15:20) and a leftovers check (15:17), both PASS.
- Every CSS-tier verdict below comes from a step whose `step:` line says `native=off` (steps that ran during another
  agent's native session were repeated).
- **Device note (not caused by C2b's code; resolved by 15:15):** from 13:13 to at least 13:58, `/tmp/lgs/flags.json`
  held `c2bToggle: true` and `wp.c2b: true` as a session override (`flagSources`: `session`; no running step held
  them). A lab step killed before its lock exit leaves its keys there until `lgs off`. While they were there, the live
  "+" popup showed the T3 toggle row, which only logs while `actionsLive` is off, so its Liquid Glass switch did
  nothing for a wearer. This review overrode them in every step (`--flags wp.c2b=false,c2bToggle=false` for T1) and did
  not edit the file. **Third session (15:16):** the file is gone, the runtime's `flagsSet` is `{}` and the `launcher`
  module is `off` ("flag wp.c2b is off"); someone cleared it. See "Requests".
- **Device left (15:31):** this review's last step (15:28) ended with the theme on, CSS only (`lgs-shell` native
  `off`). No flags-file entries or step flags of this review are left (`/tmp/lgs/flags.json` absent), every popup this
  review opened is closed, and the pointer is parked (`L.unhover`; the lab's lock exit). At 15:31 the theme reads off
  because another agent's locked `pad-bfs --route /library/home --stock` step (started about 15:27:30; "theme is off"
  at 15:28:47) holds the lab lock; the lab gives the theme back at that step's exit. No room imagery from this review
  is left on either machine (checked 15:16: no image files on the Frame from 13:40–14:00; the PC keeps only DOM
  captures of the popup).

## Verdict

**fix**: 1 blocker, 7 majors, 10 minors. What passes: G-SIZE, G-TYPE, G-OUTLINE and G-MOTION's automatic part in every
tier and both input modes; Reduce Motion; the laser and gamepad paths of "launch a program" and of Steam's own Liquid
Glass row (spied, nothing ran); traversal and B; G-REMOVE (flag off and `lgs off`) and the leak check; the native cover
and the popup's +25 mm. What fails on a gate: G-AUD (PLAN-2b-1) in T1, T3 and T3 + toggle, in both modes, with the
current gate (M1; T3 + toggle also shows B1's missing row).

## Findings

### B1 (blocker) The pinned Liquid Glass toggle row fails open: the theme switch goes dead, and presses during the scan are dropped

`device/rt/32-launcher.js`. Whenever the toggle row is on (`actionsLive: true`, which V1 sets at release, S26; or the
test flag `c2bToggle`), the wrap removes **Steam's own working "Liquid Glass" row** from the grid unconditionally
(`splitPrograms(list, keepLg=false)`, line 150), before anything is known about the replacement. The replacement
`Toggle` acts only when **both** hold, and otherwise does nothing, with no feedback and no fallback:

- `R.data.useNonSteamApps()` resolved and contains the switch (`entry`, line 175). That hook rests on P2's **optional**
  finder (`02-react.js` line 1137: `M.useNonSteamApps ? … : undefined`, then `null` for good; `REQUIRED` at line 24 does
  not list it). `onActivate` is `if (entry) runToggle(…)` (line 187);
- `R.actions.launchNonSteam()` finds `SteamClient.Apps.LaunchNonSteamApp`; otherwise it returns `refused` and nothing runs.

**Live proof** (`b1.js`, `--flags wp.c2b,c2bToggle --mode laser`, 13:47, native off; Steam's launch call spied, P2 in
test mode, nothing could run):

- Finder missing (P2's hook made to return `null`, exactly what it returns without the finder; restored in `finally`):
  2.5 s after opening, the popup shows a green "Liquid Glass / Glass Shell is on" switch row with
  `data-lgs-wait="scan"` for good, **23 cells and no Liquid Glass cell**; a click on the row logs no action and calls
  nothing. The theme cannot be switched off from the UI (HA-10: the switch lives only in "+").
- Real scan: the toggle row appears 48 ms after the click that opens the popup and stays inert until 268 ms; a click at
  48 ms logged nothing (dropped), a click after the scan logged `launchNonSteam … lgs "toggle"`.

PLAN R23 says a failed "+" patch falls back to the T1 grid with Steam's own row; here a partial failure (one optional
finder, the risk PLAN §5.1 R1 names) removes the working switch and leaves a dead one. Fix: fail closed inside `Toggle`:
render Steam's own row element (`props.lg`, which carries Steam's `onActivate`) in the pinned slot until `entry` is
resolved, and whenever the finder is missing or the action comes back `refused`; or keep Steam's row element as the
pinned row and only restyle it. Add a test that breaks the finder (`rt.react.test.breakFinder('useNonSteamApps')`, or
the hook replacement above) and checks that a working switch row remains.

### M1 (major) PLAN-2b-1 fails: 5 of 24 labels are cut mid-glyph (E-GRID (labels) clause 3), and G-AUD now FAILs in every tier and both modes

- **The cut.** Five names draw a broken last glyph and no "…": qBittorrent ("qBittorren" with half a "t"), Chromium
  ("Chromiun"), LXTerminal ("LXTermina"), RenderDoc ("RenderDo") and Hide/Show Screens ("Hide/Shov" over "Screens")
  (`shots/p2_c2b_r2b_t1_laser.png`, `p2_c2b_r2b_t3tog_pad.png`; zoomed crops in the scratch folder). Each has one
  unbreakable word wider than the 70 px label. The box computes `text-overflow: ellipsis`, but it is a
  `display: -webkit-box; -webkit-line-clamp: 2` box, and Chrome draws no ellipsis across there. "Hide/Show" also does not
  break after "/" (HA §4 and §1.16 clause 3 allow a break there). *Corrected in the third session:* the second session
  counted 9 from `scrollWidth > clientWidth` (73–78 against 70). The four two-line names among them (Frametop Display
  Settings, Frametop Remote Access, KDE System Settings, Reset Screen Layout) are not cut: their shown lines fit and the
  clamp draws "…" at the end of line 2 (same shot). The current gate agrees (below).
- **The gate, second session.** `gates barpopup` (13:20–13:31, T1 and T3, both modes, native off) reported AUD PASS
  with 24 E-GRID and 10 "E-GRID (labels)" waivers, whose `why` said "(3) no glyph cut" for the five cut labels. P10's
  `labelFacts` accepted the computed `text-overflow: ellipsis` without checking that a line-clamped box can draw it.
- **The gate, third session.** P10 changed `labelFacts` at 14:51, answering this review's REQ: on a line-clamped box,
  an overflow across now counts as a cut whatever `text-overflow` says. `gates barpopup --only aud` (native off):
  T1 laser 15:21, T1 pad 15:27 and T3 (`wp.c2b,c2bToggle=false`) laser 15:24 all report **AUD FAIL** (exit 1). Each
  shows exactly 5 issues, "SHRUNK text %{Marquee>Content} "qBittorrent" 81x20 -> 70x17 (E-GRID label criterion not met:
  … (3) cut across at the run without an ellipsis (a line-clamped box draws none across) …)" and the same for the other
  four. Each also shows 24 E-GRID and 5 E-GRID (labels) waivers. The waived labels are the five two-line names that
  end in "…" (Frametop Display Settings, Frametop Input Settings, Frametop Remote Access, KDE System Settings, Reset
  Screen Layout), each "(3) no glyph cut", which matches the shot. PLAN-2b-1 FAILs on the gate as well as by hand.
- **T3 + toggle, fourth session** (P10's 16:09 gate, which re-matches records across the T3 move; `r4_ga_t3tog_pad.out`,
  16:22, pad, native off): **AUD FAIL, 7 issues**: the 5 cut labels above, and "GONE ctl … "Liquid Glass"" and "GONE
  text … "Liquid Glass"" (Steam's row, removed by the toggle row: B1). 49 stock / 50 themed records, 47 re-matched, 28
  waivers. This supersedes the 49-GONE reading below; the gate is no longer vacuous or keyed wrong.
- **T3 + toggle, earlier.** Second session (13:25 laser, 13:26 pad): AUD reported `controls: 0, texts: 0, exempt: 0`, so it
  compared nothing. Third session, with the 14:51 gate (15:21 laser, 15:28 pad): **AUD FAIL, 49 GONE** (all 49 stock
  records: the "LAUNCH PROGRAM" header and 24 program rows with their 24 labels). AUD keys a record by its index path
  from `body` (`pathOf`, `lab/lab_helpers.js` line 325). The T3 panel adds a wrapper `div` (`.lgs-c2b-panel`, no `lgs-`
  id) around Steam's list, which shifts every path. So 47 of the GONEs are key mismatches: the header and the other 23
  cells are present and work (SIZE, TYPE, traversal, the launch spy). Two are real: Steam's "Liquid Glass" row and its
  label are not in the grid (B1). Either way the T3 +
  toggle gate fails, and the builder's "T3 with the toggle row passes all five gates" does not hold. The builder needs
  evidence the gate can read: for example a panel that keeps Steam's own element depth, or P10 matching records across
  a wrapper by kind and text (REQ below).
- REQ Coordinator->C2b (1) is open: "not built: the word-aware …" is not an accepted deviation (R2-15).

Fix: give single-word overflow its own box that can ellipsize (for example T2 tags `data-lgs-fit="word"` on labels whose
longest word is wider than 70 px, and those labels get `display: block; white-space: nowrap; overflow: hidden;
text-overflow: ellipsis`, two lines kept for the rest), allow the break after "/" (T3 can pass Steam's label with a
`<wbr>` after "/", or T2 can insert one in the text node; the cell's `aria-label` keeps the stock name, clause 4).

### M2 (major) PLAN-2b-4 fails in T1 and T3, in both input modes: the plate is drawn over its neighbours' labels, which stay at full opacity

Measured with `glass.py focus barpopup` on every cell (gamepad: a D-pad move into the cell, as a user does, because
Steam paints `.gpfocus` in the popup only for gamepad moves; laser: a real CDP hover held 0.9 s with `wp.p3`):

| Tier, mode | Cells | Whole stock name (no overflow) | Inside x 0–300 | Overlapped labels ≤ .22 | Back at rest 500 ms after | Time |
|---|---|---|---|---|---|---|
| T3 + toggle, gamepad | 23 | 23 / 23 | 23 / 23 (6–294) | **0 / 23: every overlapped label at 1.0** | 22 / 22 | 13:37 |
| T3 + toggle, laser | the 10 shortened | 10 / 10 | 10 / 10 | **0 / 10** | 9 / 9 | 13:39 |
| T1, gamepad | 24 | 24 / 24 | 24 / 24 | **0 / 24** | 23 / 23 | 13:41 |
| T1, laser (`wp.p3`) | the 8 shortened | 8 / 8 | 8 / 8 | **0 / 8** | 7 / 7 | 13:42 |

In the shots (`p2_c2b_r2b_pf3_14.png` gamepad, `p2_c2b_r2b_lf3_3.png` laser, "Frametop Display Settings") the plate
lies across "Dolphin" and "Firewall", whose glyphs show above it and through its .92 grey: two layers of text. HA §4: the
neighbours' labels under the plate fade to .22 (the mockup hides them). Fix: fade the other cells' labels while a plate
shows (`:has()` on the grid, keyed on the input mode: `.gpfocus` under `lgs-input-pad`, `.lgs-dwell:hover` under
`lgs-input-laser`, as the plate itself), with P5's `fade` token. The plate also appears in one frame (m2).

### M3 (major) PLAN-2b-2 (`cmp` against both mockups) was never run

There is no `docs/phase2/wp/C2b-cmp.json`, and neither `home-apps-plus.html` nor `-plus-t1.html` (both C2b's) has a
`data-id`, so `glass.py cmp` can only place them side by side. The log's look rows say "Matches … by eye", but the live
popup differs visibly: cut labels (M1), the plate over its neighbours (M2), focus lighting the disc only where the
mockup lights the cell (M4), one generic window glyph where the mockup draws terminal, gear, remote and screens glyphs
(m4), the All Apps circle (T3; HA hides it while LQ5 fails, which must then be said), the toggle platter's radius (m5).
G-MOCK needs named rects within ±8 px or each difference explained, and an agent verdict. Fix: `data-id`s in both
mockups (panel, header, grid, cell-n, disc-n, label-n, plate, toggle), `C2b-cmp.json`, `glass.py cmp` for both.

### M4 (major) G-FOCUS (P-14, must) fails: the focused cell is +21 to +42 L over rest; on bright icons even the disc misses +40

`glass.py focus barpopup --mode pad` (pairs: the cell focused by a D-pad move vs the same cell at rest; luma per VP SHOT),
native off:

| Tier | Whole cell (the focusable, 72 × 96) | Disc only (52 px) | Toggle row |
|---|---|---|---|
| T3 + toggle (13:37) | +21.8 to +41.7; **22 of 23 FAIL** | +30.6 to +77.0; FAIL: Chromium +38.7, RenderDoc +30.6 | +78.3 PASS |
| T1 (13:41) | +21.0 to +42.5; **22 of 24 FAIL** | FAIL: Liquid Glass +39.8, qBittorrent +38.9, RenderDoc +30.6 | — |

The focus light is the disc's fill only (+.32 and a spot), and a bright 34 px icon covers most of the disc. The mockup
lights the whole cell (`.hp-cell.is-focus` white .14) plus the disc's arc and glow. Fix: light the cell as well (a
`row`-style focus fill on the cell, not a scale), then re-measure every cell, including the Liquid Glass cell in T1.

### M5 (major) P-18 (must): the first frame of gamepad focus shows about a quarter of the look

`theme/32-launcher.css` lines 173–174: the disc's focus fill rides a plain `transition: background-color 294ms b0`
(`hover-in`), with no first-frame step (PLAN §1.4: "the first frame shows 60 %"; P4/P5 provide `--lgs-focus-first`,
`lgs-focus-in` and P3's `.lgs-focus-in`). First session (12:13, native off): first frame +20.8 L over rest against +77.6 L
settled on the same disc = **27 %** (needs ≥ 60 %). Re-measured (`mkfirst.py` pairs, 13:53, native off; the disc's
transitions caught by a MutationObserver as `.gpfocus` lands after a D-pad move, held at 16.7 ms): CMake +14.0 L first
frame against +55.1 L settled = **25 %**; Hide/Show Screens +19.4 against +77.0 = **25 %**. The held transitions are
`background-color` and `box-shadow`, 294 ms; the fill reads white .14 at 16.7 ms (rest .11, final .43). Fix: P4's
first-frame recipe for focus (60 % at once, then the rest on `hover-in`), as the tab bar and rows use.

### M6 (major) G-MOTION: the popup's content fades in with its glass instead of after it

DOM probe of the popup's entry (`entry.js`, 13:43, T3+toggle and T1, native off): the only animation is
`lgs-mat-large-in` (250 ms, linear, `backwards`) on the glass (the panel in T3, the list in T1); paused at 15 %, 35 % and
60 %, the glass, the header and a cell all read opacity .20 / .48 / .82: content and glass are one channel. HA §4:
"glass 0–92 %, content 35–100 %"; `contracts/motion.md` §2 gives the content channel `lgs-mat-content-in` on the
glass's children; G-MOTION's filmstrip criterion "glass before content on entry" is not met. The swell (s0 1.04 at the
bottom centre) and 250 ms are right; Reduce Motion is right (opacity only, 180 ms, `entry_reduce`, PASS P-56). Fix:
`lgs-mat-content-in` on the card's children. (`glass.py motion barpopup` could not film this in the first session: its
warm-up capture of the hidden barpopup times out; REQ below.) **Fourth session, filmed** (P10's fixed `motion`; pre
`openfast.js`: open "+" and return as soon as the first cell exists; `--flags wp.c2b,c2bToggle --mode pad`, 16:24,
native off; `shots/p2_motion_c2b_r4_plus_open_strip.png`, viewed): `frozen: 1`, the only animation is
`lgs-mat-large-in` on `.lgs-c2b-panel` (props `scale`, `opacity`; keyframe easings `linear(0, 1 92 %)` and
`linear(0, 1 73.6 %)`), 250 ms, token PASS, 0 geometry issues. No animation targets the header, the grid or the toggle
row, so they ride the panel's opacity: there is no "content 35–100 %" channel. (The first try with the 1.1 s OPEN pre
caught 0 animations: the entry had finished before the pause; such a strip is vacuous.)

### M7 (major) READY is not supported by the card's tests

- PLAN-2b-1 fails (M1): by hand, and on the current gate in T1 and T3, both modes; T3 + toggle AUD FAILs with 7 issues
  (the 5 cut labels and Steam's missing "Liquid Glass" row, fourth session).
- PLAN-2b-2 never ran (M3); PLAN-2b-4 never ran (M2; it arrived with R2-15, but the open REQ asks for it).
- G-FOCUS was never run with `glass.py focus` (M4); P-18 was never measured (M5); the entry filmstrip was never recorded
  (M6).
- The log's Status still lists the word-aware "…" as a documented deviation, which R2-15 rejects; REQ Coordinator->C2b is
  unanswered.

### Minors

- **m1 P-01 (must) on one rule.** `32-launcher.css` line 294:
  `%{DashboardBarPopupListItem}:is(.gpfocus, :hover) %{Marquee>Content} { display: block; white-space: nowrap; … }` has no
  input-mode scope. Under the laser a stale `.gpfocus` (IM §3.3) turns that cell's label into one truncated line (a
  look change on a cell the laser is not on). Scope the `.gpfocus` half with `&:not(.lgs-input-laser)` and the `:hover`
  half with `&:not(.lgs-input-pad)`, as the plate rules above it are. (Line 314's `z-index` is paint-neutral.)
- **m2 Plate timing and motion.** The plate shows at once on gamepad focus and after P3's 80 ms dwell under the laser,
  and leaves in one frame. HA §4 and §11: after 0.4 s of attention, `materialize-in` 250 ms, `materialize-out` 350 ms.
  Hover-out of the disc uses `hover-in` 294 ms instead of `fade` 441 ms (HA §11, tokens.md §3).
- **m3 Grid edges close the popup.** D-pad traversal (`pad.js`, T1 13:25 and T3+toggle 13:28; popup nav tree active):
  every cell reached, every move reversible (P-20 PASS), B closes (P-24 PASS). But Left from column 1, Right from column
  4, Down from the last row (T1) and Left/Right/Down from the toggle row all close the popup (focus goes back to the
  bar, Steam's exit). The 4-column grid has four times the side edges of Steam's list, so a user stepping sideways loses
  the popup often. visionOS keeps focus inside the container at an edge (P-79's bumper). Consider keeping Left/Right
  inside the grid in T3 (the panel's `Focusable` can take `onGamepadDirection` at the edge) and say so in the log.
- **m4 Program glyphs.** Six programs without an icon (Camera Switch, Desktop, Frametop Remote Access, Hide/Show
  Screens, KDE System Settings, Konsole) all get the same window glyph (CSS line 194). HA §0.3 and the mockup give them
  distinct glyphs (terminal, gear, remote, screens). With labels cut (M1) the identical glyphs leave six cells hard to
  tell apart.
- **m5 Small spec drifts.** Toggle platter radius 32 (CSS line 391) against HA §4's 28; label line-height 17 against
  the mockup's 18; the All Apps circle not built (T3; HA hides it while LQ5 fails: say so in the log and the cmp).
- **m6 A second non-Steam scan per press.** `Toggle` calls `R.data.useNonSteamApps()` (line 174), which runs Steam's
  `ScanForInstalledNonSteamApps` again on every open, beside the scan Steam's own popup runs. The switch's command line
  could be read from Steam's own row element (`props.lg`) or from the scan Steam already did.
- **m7 No exit motion.** Steam hides the popup at once on close; HA §4's `materialize-out` 350 ms is neither built nor
  recorded as a deviation.
- **m8 High Contrast.** `gates --media contrast` (13:30–13:31, T1 and T3+toggle): OUTLINE edge ratio 1.0 on all four sides,
  which is P4's one allowed 2 px stroke (tokens.md, High Contrast), so a gate question for P10, not a C2b defect. But the
  cells' focus look does not follow P4's High Contrast focus (white .30 + the stroke): the disc rule is a literal fill.
- **m9 P-03.** Laser hover on the disc: +9.5 to +26.3 L (RenderDoc +9.5, under 10; Frametop Remote Access, Hide/Show
  Screens, KDE System Settings +26.3, over 25), `lfocus_*` 13:39/13:42. On the whole cell +5.3 to +15.8.
- **m10 Toggle row semantics.** `aria-checked` is always `"true"` and the row draws the switch "on" even when the press
  is only logged (`actionsLive` off) or refused; with B1 fixed, a refused action should leave Steam's own row in place
  rather than a switch that claims a state it cannot change.

## Function retention (HA §12.7) and the card's other tests

Steam's own launch call `SteamClient.Apps.LaunchNonSteamApp` is called by Steam's row as
`Ae=H.useCallback(et=>{SteamClient.Apps?.LaunchNonSteamApp(et.strCmdline)},[])` (read from `steamui/sp.js` on the
Frame), so a spy on that property catches every press. Each probe replaced it with a recorder, pressed A only after
checking that Steam's active nav tree was the popup's and the target's nav node had focus, and restored it in `finally`
(`restored: true` in every run). Nothing was launched and the theme was never toggled.

| # | Function | Laser | Gamepad | Evidence |
|---|---|---|---|---|
| P1 | Open the list | PASS: `L.click` on `%{AddWindowButton}` (every step) | Steam's own bar path, unchanged; not reproducible in the lab (no controller: activating the bar's nav tree parks focus in `vr-null-tree`, `padopen.js`) | Steam's button (C3a) |
| P2 | Launch a program | PASS T1 (`spy_t1`: a click on CMake → `cmake-gui`); in T3 the cells are the same Steam rows and handler (not clicked again) | PASS T1 and T3+toggle: A on CMake → `cmake-gui` (`pad_t1`, `pad_t3tog`, `misc`) | spy |
| P3 | Toggle Liquid Glass | PASS T1 (Steam's row → `lgs "toggle"`); T3 toggle row → P2 `launchNonSteam` logged (`b1` part 2) | PASS T1 (A on Steam's row → `lgs "toggle"`); T3 toggle row: A → logged (`pad_t3tog`, `misc`) | **but B1** |
| P4 | Add a desktop window | Not live: SteamVR reports no desktop windows today. Static: the T1 grid also styles the "Windows" list (both lists have a header); T3 rewrites only the last list; Steam's rows and `DashboardDesktopWindowClicked` handler are kept | as laser | source read |
| P5 | Close the list | Steam's outside click and 2 s auto-close: unchanged (our panel sits inside Steam's popup contents) | PASS: B closes (T1 and T3+toggle) | `pad_*` |

- **AT-5:** (a) PASS: T1's first cell is exactly "Liquid Glass" (Steam's row, green pip); the T3 toggle row's title is
  "Liquid Glass". (d) PASS as far as the lab can open it: with the popup's nav tree activated, the entry focus is
  "Camera Switch", the first program (`misc`, 13:46); the toggle row is reached only by Down from the last row, and Up
  from it returns to the cell it came from. (e) = PLAN-2b-3 below.
- **PLAN-2b-3** (`lq10.js`, `--flags wp.c2b,c2bToggle,wp.c2a`, 13:55, native off): PASS. Main on
  `/library/lgs/steamhome`, a click on the toggle row logs `navigate /library/home replace=true` and then
  `launchNonSteam … lgs "toggle"`, both `logged`; the route stays `/library/lgs/steamhome`; the spy saw no call; the
  route was put back afterwards. (B1 still applies: the row is dead without the finder.)
- **AT-12:** PASS: 4 columns of 72 px, `display: grid`, no `flow-children`, `scrollHeight` 576 = `clientHeight` 576,
  every visible label ≤ 70 wide and ≤ 2 lines, every plate inside x 6–294; every cell reachable, reversible, B closes.
- **G-REMOVE** (`remove.js`, 13:48; native mode was on during the step, which does not touch this DOM and runtime
  check): PASS. Flag off while the T3 popup is open: the popup closes, 0 `lgs-c2b` nodes and 0 `data-lgs-row` /
  `data-lgs-c2b` / `data-lgs-wait` attributes in any popup, `c2b.plus` patch gone, P2 `patchedLeft: 0`; reopened:
  Steam's scan order ("Liquid Glass" first), no tag.
- **G-REMOVE, `lgs off`** (third session): PASS.
  - *Static:* `lgs off` runs `rt_teardown(s, "off")` (`device/lgs.py` line 761), which calls each module's `remove()`.
    That is the launcher's own `remove()`, which closes a "+" popup showing our panel, drops P2's patch and untags
    Steam's row. P1's leftovers sweep (`device/lgs_core.js` line 296) runs after it.
  - *Real teardowns:* the device log shows the theme turned off at 13:32:37, 13:34:25 and 13:36:19, inside the window
    when the stale session flags kept the launcher module live. `leftnow.js` (15:17, theme on, no flags) finds 0
    `lgs-c2b` nodes and 0 `data-lgs-row` / `data-lgs-c2b` / `data-lgs-wait` / `data-lgs-fit` attributes in all 11
    popup documents. It also finds no C2b patch in P2's list, `patchedLeft: 0`, and Steam's own `LaunchNonSteamApp`.
  - *Off state:* `stockoff.js` under `--stock` (15:20; the theme off inside the lock and given back at its exit; native
    off) finds no runtime (`__LGS_RT` and `__LGS_MOTION` undefined) and no Glass Shell stylesheet. The "+" popup opens
    stock: flex list, 24 rows of 260 × 40, Steam's scan order (Liquid Glass, Visual Studio Code, qBittorrent), no
    panel. The only marks are `lgs-input-laser` and `data-lgs-vr-mode` on each document root. The lab's own `--mode`
    stub sets those two (`lab/lab.py` lines 568–571) and removes them at the step's exit, so they are not left by
    `lgs off`.
- **Robustness:** 8 open/close cycles with T3+toggle: the module's subscriptions 4 → 4, runtime listeners 9 → 9,
  `popupCreated`/`popupDestroyed` 6/3 → 6/3; at rest `getAnimations()` is empty (G-MOTION at rest, every gates run);
  the module runs no interval (two `rt.setTimeout`s per show, 120 and 500 ms). Fail-closed install: `installT3` throws
  on a missing required finder or `Focusable` and the T1 grid stays (static); the gap is the optional finder (B1).
- **T4:** PASS, see Native.

## Gates (CSS-only, `native=off`)

`glass.py gates barpopup --pre <OPEN> --flags … --mode … --json --shot p2_c2b_r2b_<name>`:

| Run | Time | AUD | SIZE | TYPE | OUTLINE | MOTION |
|---|---|---|---|---|---|---|
| T1 laser (`wp.c2b=false,c2bToggle=false`) | 13:20 | PASS*, 24 E-GRID + 10 label waivers | PASS (24) | PASS (25) | PASS, top 0.063 | PASS |
| T1 pad | 13:21 | PASS* (same) | PASS | PASS | PASS | PASS |
| T3 laser (`wp.c2b,c2bToggle=false`) | 13:21 | PASS* (same) | PASS | PASS | PASS | PASS |
| T3 pad | 13:21 | PASS* (same) | PASS | PASS | PASS | PASS |
| T3 + toggle laser | 13:25 | PASS*, **0 controls, 0 texts compared** | PASS (24) | PASS (26) | PASS, top 0.09 | PASS |
| T3 + toggle pad | 13:26 | as above | PASS | PASS | PASS | PASS |
| T3 + toggle, `--media reduce` | 13:29 | as above | PASS | PASS | PASS | PASS |
| T3 + toggle, `--media contrast` | 13:30 | as above | PASS | PASS | FAIL: ratio 1.0 (P4's HC stroke, m8) | PASS |
| T1, `--media contrast` | 13:31 | PASS* | PASS | PASS | FAIL: ratio 1.0 (m8) | PASS |
| *Third session, P10's 14:51 gate, `--only aud`:* | | | | | | |
| T1 laser | 15:21 | **FAIL**: 5 SHRUNK (cut labels), 24 E-GRID + 5 label waivers | — | — | — | — |
| T3 laser | 15:24 | **FAIL**: the same 5 | — | — | — | — |
| T1 pad | 15:27 | **FAIL**: the same 5 | — | — | — | — |
| T3 + toggle laser | 15:21 | **FAIL**: 49 GONE (47 path-key mismatches; 2 real, Steam's Liquid Glass row and label: B1) | — | — | — | — |
| T3 + toggle pad | 15:28 | **FAIL**: the same 49 | — | — | — | — |
| *Fourth session, P10's 16:09 gate, `--only aud,motion`:* | | | | | | |
| T3 + toggle pad | 16:22 | **FAIL**: 7 (5 cut labels; GONE Steam's "Liquid Glass" row and label, B1); 47 re-matched, 28 waivers | — | — | — | PASS |

\* AUD PASS was false for the label runs (M1); the third-session re-runs with P10's corrected gate FAIL.

## Native (one `native-session`, 13:46–13:53, P7 complete since 12:45)

`run_native.py`: two probes, two `sgcheck`, native `gates`, two `hv --look`; the session returned to CSS only ("back to
CSS only: yes").

- **Cover** (`nprobe.js`): T3+toggle, the reporter's barpopup cover is our panel, `[0, 447, 450, 1089]` texture px, r 60
  (= the CSS card 300 × 726 at (0, 298), radius 40, × 1.5); T1, the list card `[0, 558, 450, 978]`, r 60 (= 300 × 652 at
  (0, 372)). Both acked (`data-lgs-cover`), and the CSS glass is dropped there (`--lgs-mat-panel-bg: transparent`,
  `--lgs-edge: none`), so glassd's slab and the CSS card have the same shape. No plates, no layers.
- **T4:** `popups.status()`: the live "+" barpopup has entry `launcher`, z 0.06775 units (25 mm / 369 at S, bar space).
  In T1 (`wp.c2b` off) the entry is not used (z 0.01, Steam's 3.7 mm) unless C3a's `wp.c3a` entry applies.
- **G-DEPTH** (`sgcheck`, T3+toggle pad and T1 laser, 13:49): PASS, 0 pops on every surface, depths {0} (C2b adds no
  crop; P-46, P-47, P-48 not engaged).
- **Native gates** (T3+toggle, pad, 13:49): all five PASS; AUD's "0 findings" is the T3+toggle case, whose AUD
  compared nothing in CSS-only mode (M1).
- **G-HV:** T3+toggle look (frame viewed, then deleted on both machines): one copy of the popup in front of the window,
  header, cells and toggle row legible at the frame's 960 × 540, no closed rim. Metrics: doubling 0.315 (not doubled),
  but the auto rect `[591, 8, 953, 476]` is not the popup, so `glassL` 72.9 does not describe it; verdict withheld
  (exit 3, no `--rect`). T1: the look folder was reaped at 120 s before it could be viewed (this agent was blocked in a
  locked step); metrics only (doubling 0.28, not doubled; auto rect again not the popup). A G-HV verdict needs `--rect`
  on the popup's quad; V1's native gate should take it.

## Conformance (VP §6) for this area

| Item | Verdict | Evidence |
|---|---|---|
| P-01 | FAIL on one rule (m1) | CSS line 294 |
| P-02 | PASS | laser looks key on `:hover` (lines 243, 472) |
| P-03 | Mostly PASS (m9) | `lfocus_*` |
| P-04, P-05 | PASS | no scale or translate on cells, rows or the toggle |
| P-07 | PASS | cells abut, gaps 0 (E-GRID `why`) |
| P-08 | PASS by E-GRID | cells 72 × 96 popup px (87 × 116 main), whole-cell hit 100 % own |
| P-13 | PASS | one `.gpfocus` after a D-pad move |
| P-14 | **FAIL** (M4) | `focus_*` |
| P-17 | PASS | FocusRing hidden; the disc's glow is blurred, not a ring |
| P-18 | **FAIL** (M5) | 25 % (CMake, Hide/Show Screens), first session 27 % |
| P-20 | PASS | traversal reversible, all reached |
| P-22 | PASS (lab-reachable path) | entry "Camera Switch" |
| P-24 | PASS | B closes the popup |
| P-38, P-84 | PASS | G-TYPE (15 popup px = 18 main) |
| P-42, P-43 | PASS (CSS-only, both modes) | G-OUTLINE |
| P-46, P-47, P-48 | PASS (no pops) | `sgcheck` |
| P-52, P-58 | PASS | G-MOTION at rest, tokens |
| P-56 | PASS | `entry_reduce` |
| P-89 | PASS | the plate's `:hover` reveal has its `.gpfocus` twin |
| G-MOTION filmstrip (glass before content) | **FAIL** (M6) | `entry.js`; fourth session `motion barpopup` strip (one animation, on the panel) |
| G-MOCK | **not run** (M3) | — |

## Requests

- [x] REQ C2b-R2->P10: `lab/lab_gates.js` `labelFacts` (E-GRID (labels) clause 3) passes a single unbreakable word that
  overflows a `display: -webkit-box; -webkit-line-clamp: 2` box because the box computes `text-overflow: ellipsis`;
  Chrome draws no ellipsis across there (live: LXTerminal, qBittorrent, RenderDoc, Chromium, Hide/Show Screens cut
  mid-glyph while the gate says "no glyph cut"). Suggest: on a clamped box (`clampOf(c) > 0`), horizontal overflow is a
  cut whatever `text-overflow` says. Also: with C2b's T3 panel the AUD diff matches nothing (`controls 0, texts 0`,
  `--flags wp.c2b,c2bToggle`), so G-AUD is vacuous there; and `glass.py motion barpopup` times out in its warm-up
  capture (first session, 11:22–11:27). For the fixture: a clamped label with one long word (SHRUNK kept).
  - P10 (2026-10-07 session 5): done, all four, with the step-flag hygiene you raised to the coordinator.
    (1) **Clamp:** on a line-clamped box (`clampOf(c) > 0`) an overflow across is a cut whatever `text-overflow`
    computes. Fixture case 12a2 (one long word in a clamped box: SHRUNK kept) and 12a3 (the same word on one line with
    `nowrap` + `text-overflow: ellipsis`: waived). Live T1 (16:07) and T3 (16:11): qBittorrent, Chromium, LXTerminal,
    RenderDoc keep their SHRUNK with "(3) cut across at the run without an ellipsis (a line-clamped box draws none
    across)", and Hide/Show Screens too. (2) **T3 AUD:** three causes, all fixed. The theme switch closed the popup
    the pre had opened, so the stock or themed snapshot was empty: the pre now runs again (`preRerun`), and a
    snapshot that is still empty makes AUD fail as `VACUOUS` instead of 0 issues. `barpopup` could name the hidden one
    of Steam's two popup windows: the shown window wins now, in the JS helpers and for CDP. T3 moves Steam's rows into
    its panel and sorts them, so their DOM-path keys changed: AUD re-matches a stock record by a unique identity (kind,
    first class, text; then a class unique in both snapshots), and does not compare records at the same path that are
    other elements (T3's toggle row sat at the old list box's path). Live, `gates barpopup --pre <open "+"> --only aud
    --flags wp.c2b,c2bToggle --mode laser` (16:11; another agent's native session was on, which changes no geometry):
    51 stock and 53 themed records, 49 matched across the move, 1 path collision not compared, 23 cells and 5 labels
    waived, and 7 issues left that are real: the 5 cut labels above, and "GONE … Liquid Glass" (Steam's row and its
    label: your toggle row replaces it, a different control, so AUD cannot count it as the same function; PLAN-2b-3
    and the coordinator judge that). Before: 49 GONE. (3) **`motion barpopup`:** the warm-up capture waited for a
    frame from a popup window that was not shown yet. It is taken after the pre when the pre opens the surface, and
    CDP captures the shown window. Live (16:04): 34 s, six frames of the "+" opening (strip viewed:
    `shots/p2_motion_p10_s5_plus_open_strip.png`), automatic part PASS; its P-53 "window scale 1.0..1.04" false
    positive is gone too (the 600 px of P-53 are now 600 × m, 498 bar px, not 141). (4) **Flags hygiene:** each step
    that writes `/tmp/lgs/flags.json` also records its keys in `/tmp/lgs/flag-steps/`; the next lab lock entry puts
    back the keys of a step whose process is gone (pid and start time), only where the file still holds that step's
    values. The two keys from 13:13 predate the records, so `lgs flags` (your REQ to the coordinator) is still the way
    to drop them. contracts/lab.md §1.1, §4, §10.
  - Reviewer, third session (15:31): the label part is in `lab_gates.js` (14:51) and confirmed live: the five cut
    labels now keep their SHRUNK, and the five two-line "…" names stay waived (M1). Still open: (a) with C2b's T3
    panel, AUD now reports all 49 stock records GONE, because `pathOf` keys by index path and the panel's wrapper
    `div` shifts every path (15:21, 15:28). Matching an unmatched record by kind and text (for example the stock
    record's `text` against the themed records' `text`, before reporting GONE) would let AUD see that the header and
    23 cells are present and Steam's "Liquid Glass" row is not. (b) The `motion barpopup` warm-up timeout (not
    re-tried).
  - Reviewer, fourth session (16:30): both confirmed. (a) T3 + toggle AUD re-matches 47 records and reports the 7 real
    issues (16:22). (b) `motion barpopup` films the entry (16:24); note for users of `motion` on a popup: the pre must
    return as soon as the popup's content exists, or the 250 ms entry is over before the pause and the strip is empty.
- [ ] REQ C2b-R2->Coordinator: device hygiene, not C2b's code: `/tmp/lgs/flags.json` has carried `c2bToggle: true`
  and `wp.c2b: true` as a session override since at least 13:13 (a step killed before its lock exit), so the live "+"
  shows an inert switch. Someone with the authority should drop the two keys (`lgs flags`), and P10 might make the
  step's flags-file entries expire with its runtime overlay (TTL) rather than live until `lgs off`.
  - Reviewer, third session (15:16): the keys are gone. `/tmp/lgs/flags.json` does not exist, the runtime's `flagsSet`
    is `{}` and the `launcher` module is `off`. Only the TTL suggestion remains, as a guard against a recurrence.

## Evidence

Scratch probes and JSON in `<scratchpad>/c2b_r2/` (`spy_t1.js`, `pad.js`, `padopen.js`, `misc.js`,
`mkpairs.py`, `mklaser.py`, `mkfirst.py`, `entry.js`, `b1.js`, `remove.js`, `nprobe.js`, `run_native.py`, and their
`.out` files; third session: `leftnow.js`, `stockoff.js` and the AUD re-runs `ga_{t1,t3_laser,t1_pad,t3tog,t3tog_pad}.out`);
fourth session: `r4_ga_t3tog_pad.out`, `openfast.js`, `r4_motion.out` (vacuous, slow pre) and `r4_motion2.out`;
the label probe `p1_t1.js` and the gates outputs `g_*.out` in `<scratchpad>/r2/`. Kept shots: `shots/p2_c2b_r2b_{t1,t3,t3tog}_{laser,pad}.png`,
`p2_c2b_r2b_t3tog_{reduce,contrast}.png`, `p2_c2b_r2b_t1_contrast.png`, `p2_c2b_r2b_pf3_*.png` and `pf1_*` (gamepad
focus per cell), `p2_c2b_r2b_lf3_*.png` and `lf1_*` (laser hover), `p2_c2b_r2b_native_t3.png` (DOM only).
