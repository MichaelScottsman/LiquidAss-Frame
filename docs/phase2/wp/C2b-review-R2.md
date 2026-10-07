# C2b Launcher ("+" popup): adversarial review R2

Reviewer: independent agent (review R2). Package card: PLAN §2.4 "C2b Launcher ("+" popup)" as amended by R2-15
(13:10); builder's log `docs/phase2/wp/C2b.md` (Status: "READY: wp.c2b", 09:56). Concept: `docs/phase2/concepts/home-apps.md`
(HA) §4, §5, §11, §12.7, AT-5, AT-12. Steam build `11094443`. Device clock = PC clock (EDT). Scratch evidence (probes,
JSON): `<scratchpad>/c2b_r2/` of this session (first session: `<scratchpad>/r2/`); kept shots are
`shots/p2_c2b_r2b_*.png` (DOM captures of the popup only, no room).

## Status

**Done** (2026-10-07 13:58 EDT; second session 13:11–13:58, after the first session, 11:07–12:13, was cut off).
Everything below was measured in the second session unless it says "first session". Verdict: **fix**.

- Files under test are unchanged since the first session and byte-identical on the PC and the Frame (md5
  `32-launcher.css` 65fb3649, `32-launcher.js` b232b5b6, `popups/32-launcher.json` 836848cd).
- PLAN changed while the package sat at READY: R2-15 adds E-GRID and E-GRID (labels) to §1.16 and PLAN-2b-4 to the
  card. `REQ Coordinator->C2b` (R2-15) is open and unanswered; the C2b log was last touched at 11:42.
- Every CSS-tier verdict below comes from a step whose `step:` line says `native=off` (steps that ran during another
  agent's native session were repeated).
- **Device note (not caused by C2b's code):** `/tmp/lgs/flags.json` holds `c2bToggle: true` and `wp.c2b: true` as a
  session override (seen from 13:13 to 13:58; `flagSources`: `session`; no running step holds them). A lab step killed
  before its lock exit leaves its keys there for good (until `lgs off`). Effect today: the live "+" popup shows the T3
  toggle row, which only logs while `actionsLive` is off, so for anyone wearing the headset the "+" popup's Liquid Glass
  switch does nothing until the keys go. This review overrode them in every step (`--flags wp.c2b=false,c2bToggle=false`
  for T1) and did not edit the file (not this role's state). See "Requests".

## Verdict

**fix**: 1 blocker, 7 majors, 10 minors. What passes: G-SIZE, G-TYPE, G-OUTLINE and G-MOTION's automatic part in every
tier and both input modes; Reduce Motion; the laser and gamepad paths of "launch a program" and of Steam's own Liquid
Glass row (spied, nothing ran); traversal and B; G-REMOVE and the leak check; the native cover and the popup's +25 mm.

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

### M1 (major) PLAN-2b-1 fails: 9 of 23 labels are cut mid-glyph (E-GRID (labels) clause 3); the gate's PASS is false, and in T3 + toggle it compares nothing

- **The cut.** DOM probe (13:18, T3+toggle; the same names in T1): `scrollWidth > clientWidth` on the label's
  `%{Marquee>Content}` for Chromium (73 > 70), Frametop Display Settings (74), Frametop Remote Access (75), Hide/Show
  Screens (77), KDE System Settings (75), LXTerminal (78), qBittorrent (74), RenderDoc (78), Reset Screen Layout (73).
  The box computes `text-overflow: ellipsis`, but it is a `display: -webkit-box; -webkit-line-clamp: 2` box, where Chrome
  draws no ellipsis across for an unbreakable word: the shots show "LXTermina", "qBittorren" with half a "t", "RenderDo",
  "Chromiun", "Hide/Shov" (`shots/p2_c2b_r2b_t3tog_pad.png`, `p2_c2b_r2b_t1_laser.png`; zoomed crops in the scratch
  folder). "Hide/Show" also does not break after "/" (HA §4 and §1.16 clause 3 allow a break there). Two-line overflow is
  fine: the clamp draws "…" on the second line.
- **The gate.** `gates barpopup` (13:20–13:31, T1 and T3, both modes, native off) reports AUD PASS with 24 E-GRID and
  10 "E-GRID (labels)" waivers whose `why` says "(3) no glyph cut" for these same labels: P10's `labelFacts`
  (`lab/lab_gates.js` line 518) accepts the computed `text-overflow: ellipsis` without checking that the box can draw it.
  PLAN-2b-1 is FAIL by hand; the gate needs the fix (REQ below).
- **T3 + toggle.** `gates barpopup --flags wp.c2b,c2bToggle` (13:25 laser, 13:26 pad): AUD `controls: 0, texts: 0,
  exempt: 0`. With our panel around Steam's list the AUD keys (DOM paths) match nothing, so the AUD half of "T3 with the
  toggle row passes all five gates" (builder's Status) compares nothing; in particular it cannot see that Steam's
  Liquid Glass row left the grid (B1).
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
warm-up capture of the hidden barpopup times out; REQ below.)

### M7 (major) READY is not supported by the card's tests

- PLAN-2b-1 fails (M1); its T3 + toggle AUD evidence compares nothing.
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
  Steam's scan order ("Liquid Glass" first), no tag. "lgs off" itself was not run on the shared device; teardown runs
  the same `remove()`.
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

\* AUD PASS is false for the label runs (M1).

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
| G-MOTION filmstrip (glass before content) | **FAIL** (M6) | `entry.js` |
| G-MOCK | **not run** (M3) | — |

## Requests

- [ ] REQ C2b-R2->P10: `lab/lab_gates.js` `labelFacts` (E-GRID (labels) clause 3) passes a single unbreakable word that
  overflows a `display: -webkit-box; -webkit-line-clamp: 2` box because the box computes `text-overflow: ellipsis`;
  Chrome draws no ellipsis across there (live: LXTerminal, qBittorrent, RenderDoc, Chromium, Hide/Show Screens cut
  mid-glyph while the gate says "no glyph cut"). Suggest: on a clamped box (`clampOf(c) > 0`), horizontal overflow is a
  cut whatever `text-overflow` says. Also: with C2b's T3 panel the AUD diff matches nothing (`controls 0, texts 0`,
  `--flags wp.c2b,c2bToggle`), so G-AUD is vacuous there; and `glass.py motion barpopup` times out in its warm-up
  capture (first session, 11:22–11:27). For the fixture: a clamped label with one long word (SHRUNK kept).
- [ ] REQ C2b-R2->Coordinator: device hygiene, not C2b's code: `/tmp/lgs/flags.json` has carried `c2bToggle: true`
  and `wp.c2b: true` as a session override since at least 13:13 (a step killed before its lock exit), so the live "+"
  shows an inert switch. Someone with the authority should drop the two keys (`lgs flags`), and P10 might make the
  step's flags-file entries expire with its runtime overlay (TTL) rather than live until `lgs off`.

## Evidence

Scratch probes and JSON in `<scratchpad>/c2b_r2/` (`spy_t1.js`, `pad.js`, `padopen.js`, `misc.js`,
`mkpairs.py`, `mklaser.py`, `mkfirst.py`, `entry.js`, `b1.js`, `remove.js`, `nprobe.js`, `run_native.py`, and their
`.out` files); the label probe `p1_t1.js` and the gates outputs `g_*.out` in `<scratchpad>/r2/`. Kept shots: `shots/p2_c2b_r2b_{t1,t3,t3tog}_{laser,pad}.png`,
`p2_c2b_r2b_t3tog_{reduce,contrast}.png`, `p2_c2b_r2b_t1_contrast.png`, `p2_c2b_r2b_pf3_*.png` and `pf1_*` (gamepad
focus per cell), `p2_c2b_r2b_lf3_*.png` and `lf1_*` (laser hover), `p2_c2b_r2b_native_t3.png` (DOM only).
