# C2b Launcher ("+" popup): adversarial review R2

Reviewer: independent agent (review R2). Package card: PLAN §2.4 "C2b Launcher"; builder's log `docs/phase2/wp/C2b.md`
(Status: "READY: wp.c2b"). Concept: `docs/phase2/concepts/home-apps.md` (HA) §4, §5, §11, §12.7, AT-5, AT-12. Steam build
`11094443`. Device clock = PC clock (EDT).

## Status

**In progress** (started 2026-10-07 11:07 EDT). Files under test are byte-identical on the PC and the Frame (md5
`32-launcher.css` 65fb3649, `32-launcher.js` b232b5b6, `popups/32-launcher.json` 836848cd); `glass.py check-theme`
PASS, `node --check device/rt/32-launcher.js` OK. Static review done. Live: the lab lock is heavily contended (about
30 queued steps, 240 s lock waits) and other agents' native sessions keep native mode on for long stretches, so every
step retries; luma and gate steps are only accepted with `native=off`. Done so far: gates T1 laser; G-FOCUS T1 and
T3+toggle; P-03 hover; the T3+toggle DOM, motion and popup-depth probe. Still running: gates (T1 pad, T3, T3+toggle,
reduce, contrast, actionsLive), the toggle row's laser and gamepad paths, the gamepad sweeps, G-REMOVE, P-01/P-02,
P-18 luma. P7's Status says "Review R1 fixes in progress" (rechecked 11:33), so live native checks are deferred (hard
rule 4). Provisional verdict: **fix** (one blocker and several majors so far; findings below are being completed).

## Findings (provisional, being completed)

### B1 (blocker) The pinned Liquid Glass toggle row fails open: the only theme switch can go dead

`device/rt/32-launcher.js`. Whenever the toggle row is on (`actionsLive: true`, which V1 sets at release, S26; or the test
flag `c2bToggle`), the wrap removes **Steam's own working "Liquid Glass" row** from the grid unconditionally
(`splitPrograms(list, keepLg=false)`, line 150), before anything is known about the replacement. The replacement
`Toggle` can only act when **both** of these hold, and does nothing (no feedback, no fallback) otherwise:

- `R.data.useNonSteamApps()` resolved and contains the switch (`entry`, line 175). That hook is P2's **optional** finder
  (`02-react.js` line 1137: `M.useNonSteamApps ? … : undefined`, then `null` for ever); `onActivate` is
  `if (entry) runToggle(…)` (line 187), so with the finder missing the row is permanently dead;
- `R.actions.launchNonSteam()` finds `SteamClient.Apps.LaunchNonSteamApp`; otherwise it returns `refused` and nothing runs.

Failure scenario: a Steam update changes the module that holds `ScanForInstalledNonSteamApps` (PLAN §5.1 R1, the risk
P2's optional finders exist for). Then, in the shipped state, the "+" popup shows a green switch row that does nothing,
and Steam's own row is gone: the user has no Liquid Glass switch anywhere (HA-10: it lives only in "+"), so the theme
cannot be turned off from the UI. This is exactly what PLAN R23 forbids ("+" patch fails → the T1 grid with Steam's row).
Live, the same path also silently drops presses during the scan: a laser click 30–40 ms after the row appears, while
`data-lgs-wait="scan"`, logged nothing (toggle probe `earlyPress: []`; the row became actionable 389 ms after the click
that opened the popup, ≈ 100 ms after it appeared).
Fix: fail closed inside `Toggle` (which may use hooks): render Steam's own row element (`props.lg`, which carries Steam's
own `onActivate`) in the pinned slot until `entry` is resolved, and whenever the finder is missing or the action is
`refused`; or keep Steam's row element as the pinned row and only restyle it. Add a test that breaks the finder
(`rt.react.test.breakFinder('useNonSteamApps')`) and checks that a working switch row remains.

### M1 (major) PLAN-2b-1 / G-AUD is not clean by PLAN's rules: the 35 SHRUNK rest on an exemption PLAN does not have

`glass.py gates barpopup` T1 laser (11:16, native off): AUD PASS only because P10's in-progress `E-GRID` entry in
`lab/exemptions.json` waives **35 SHRUNK** (24 cells and 11 label runs; criterion "cell ≥ 66 × 80, abutting, whole
cell its own hit", met). `E-GRID` is not in PLAN §1.16, and PLAN §4.1 says G-AUD = 0 "apart from the exemptions of
§1.16"; only the coordinator adds exemptions (§1 decides; §1.16 is §1). C2b filed its request to P10, not to the
coordinator (`REQ C2b->P10`), and its Status calls the package READY with the gate open. The 11 waived label runs are
not cells: they are the truncated labels (see M4), which the cell criterion does not judge.
Fix: a `REQ C2b->Coordinator` for an §1.16 line (E-GRID with its criterion, and a separate decision on the label runs);
until it lands, PLAN-2b-1 is FAIL.

### M2 (major) PLAN-2b-2 (`cmp` against both mockups) was never run

There is no `docs/phase2/wp/C2b-cmp.json`, and the log's look rows say "Matches … by eye". G-MOCK needs named rects within
±8 px or each difference explained, with an agent verdict. The by-eye claim also misses visible differences (M4, M5,
the icon glyphs in m4, the All Apps circle, the cell focus style). Fix: write `C2b-cmp.json` (the mockups need
`data-id`s: panel, header, grid, cell-n, disc-n, label-n, plate, toggle) and run `glass.py cmp` for both mockups.

### M3 (major) G-FOCUS (P-14, must) fails on cells with bright icons; the builder never ran `glass.py focus`

`glass.py focus barpopup --pre <OPEN> --mode pad --flags wp.c2b,wp.p3` (12:03, native off), focused disc vs the same
disc at rest: Chromium **+32.4 L**, Google Chrome **+35.1**, Dolphin **+39.7** (FAIL, need ≥ +40); the other nine
cells +46.8 to +79.8. The light is only the 52 px disc's fill (+.32), and a bright 34 px icon covers most of it; the
72 × 96 cell itself changes +31.8 L (T1, 11:21). The mockup lights the whole cell (`.hp-cell.is-focus` white .14)
plus the disc's arc and glow. Fix: light the cell as well as the disc (or add a glow band), then re-measure every cell.

### M4 (major) Labels are hard-clipped mid-glyph with no ellipsis (9 of 23 programs)

DOM probe (T3 + toggle row, 11:53): `scrollWidth > clientWidth` on Chromium (73 > 70), Frametop Display Settings
(74), Frametop Remote Access (75), Hide/Show Screens (77), KDE System Settings (75), LXTerminal (78), qBittorrent (74),
RenderDoc (78), Reset Screen Layout (73). In the shots (`p2_c2b_r2_focus_t3tog_1.png`, `p2_c2b_r2_focus_t1_0.png`)
"Chromiun", "LXTermina", "qBittorren", "RenderDo", "Hide/Shov" end in half a letter. HA §4 (Labels) and both mockups cut
a long word with "…" ("Chromi…", "LXTerm…"); visionOS never clips a glyph. The builder lists this as "not built"; no
coordinator decision covers it. Fix (T2 is already there): tag single-word overflow (`data-lgs-fit`) and give those
labels `white-space: nowrap; text-overflow: ellipsis`, or break long words with `overflow-wrap: anywhere` plus the clamp.

### M5 (major) The full-name plate is drawn over its neighbours' labels; it neither fades them nor animates

`p2_c2b_r2_focus_t1_0.png` (gamepad focus on "Frametop Remote Access", column 2): the plate (about 208 popup px wide) lies
across the labels of columns 1 and 3, whose text still shows above, below and through it (grey .92), three lines of text overlapping. HA §4:
"Neighbours' labels under it fade to .22"; HA §11: the plate materializes (250 ms) and dematerializes (350 ms) after
0.4 s of attention. Live it appears in one frame on focus (and after P3's 80 ms dwell under the laser) and vanishes in
one frame. Fix: fade the other cells' labels (`:has(.gpfocus)` / `:has(.lgs-dwell:hover)` on the scroller, input-scoped)
and give the plate P5's materialize keyframes.

### M6 (major) P-18 (must): the first frame of gamepad focus shows about 10 % of the look

The disc's focus fill runs on a plain `transition: background-color 294ms b0` (CSS lines 173–174), so at 16.7 ms the
fill is `rgba(255 255 255 / .14)` against rest .11 and final .43 (animation probe 11:53: 9 % of the change). P-18 and
PLAN §1.4 need ≥ 60 % on the first frame; P4/P5 provide it (`--lgs-focus-first`, `lgs-focus-in`, P3's `.lgs-focus-in`).
Luma (`glass.py focus barpopup --mode pad`, the transitions paused at 16.7 ms, 12:13, native off): first frame
**+20.8 L** over rest, against **+77.6 L** for the settled look on the same disc = **27 %** (FAIL, needs ≥ 60 %; most of
the 20.8 is the radial spot, which is not transitioned and snaps in). Hover-out also uses 294 ms instead of `fade`
441 ms (tokens.md §3; minor part).

### M7 (major) The popup's entry fades its content together with its glass (G-MOTION: glass before content)

Animation probe (T3 + toggle row, 11:53): the only animation when the popup opens is `lgs-mat-large-in` on the panel;
replayed and sampled, the header's effective opacity equals the glass's at 15 %, 35 % and 60 % (.20/.48/.82). HA §4
specifies "glass 0–92 %, content 35–100 %", and `contracts/motion.md` §2 gives the content channel
(`lgs-mat-content-in` on the glass's children). G-MOTION's filmstrip criterion "glass before content on entry" is not
met. (The swell s0 = 1.04 and the 250 ms duration are right.) Fix: `lgs-mat-content-in` on the panel's / card's
children. Note: `glass.py motion barpopup` cannot film this today (its warm-up capture of the hidden barpopup times
out before the pre opens it: two runs 11:22–11:27); a `REQ <reviewer>->P10` is noted in the Evidence.

(more being written)

## Evidence

(being written)
