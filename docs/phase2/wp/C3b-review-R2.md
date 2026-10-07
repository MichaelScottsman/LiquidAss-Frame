# C3b Control Center: quick review R2

Reviewer: R2 quick reviewer (2026-10-07, Steam build 11094443). The user asked for faster reviews, so this pass is
narrow: `gates` once in each input mode with CC-M open on `main`, `pad-bfs` once, one shot per mode next to
`control-center-overview` / `-overview-t1`, and a check that the key functions can still be reached. There was no
native session, removal sweep, perf run or full conformance. An earlier thorough R2 pass was cut off at 14:30, and
its interim notes are replaced by this file. I cite its outputs (`scratch/c3brev/`) only where they reproduce or
explain something. Scratch for this pass is the session scratchpad `c3bq/`, called `scratch/` below.

## Status

**DONE, verdict: fix** (16:45). One major: the `gates` OUTLINE check fails in pad mode when CC-M opens over a
transparent page area. No blockers. Every Quick Access function can be reached by laser and by gamepad. The device
is as I found it: theme on, CSS only, native off, all flags were per step, CC closed with no `data-lgs-cc` /
`.lgs-cc` left, no menus open, and the route was restored by each step.

## Findings

### M1 (major): OUTLINE fails in pad mode on the Controls tile's top edge

- **What:** `gates main --flags wp.c3b --mode pad --pre <open>` fails OUTLINE on `lgs-cc-tile lgs-cc-ctl`, the
  "Performance / Quick Settings" tile, along its **top** side: ratio 0.357, `edge: visible`, brightest 119 L. The
  segments go 110 → 128 → 116 → 100 → 83 → 66 → 49 → 36 from left to right, which is brightest over the focused
  Wi-Fi toggle and fades away from it. The laser run of the same step passes, so the cause is the pad focus glow
  of the entry toggle (Wi-Fi), which spreads to the tile's top edge. In `scratch/crop_top_pad.png` the rim at the
  top left of the tile lights up around the focused toggle. The quality bar requires edges that come from the
  material only, so a lit band along the edge counts against it.
- **Reproduced 3 of 3** whenever CC-M opens over a transparent page area (settings routes are white in the
  CSS-only capture): 16:31 `/settings/controller` (wp.c3b only), 16:33 the same route with
  `wp.c3b,wp.c1a,wp.p3`, and the earlier R2 run at 14:25 (`scratch/c3brev/b1_g_main_pad.out`). It **passes** on
  `/library/home` (16:39), where the gray window glass behind the tiles hides the halo. The builder's "PASS" row
  for CC-M gates in pad mode therefore holds only on library routes. In native mode CC-M is `windowless` over
  passthrough, which is the failing case.
- **Fix (C3b):** keep the focused toggle's glow inside its tile. Options: clip it to the tile, give the top
  toggle row a smaller spread, or move the row down so the glow has faded before it reaches the edge. Then rerun
  `gates main --flags wp.c3b --mode pad --pre <open>` on a settings route and on `/library/home`. If C3b believes
  a focus halo meeting an edge should not count, raise a REQ with P10. Until P10 changes the gate, the failure
  stands.

### Checked and fine (no finding)

- **Gates, laser** (`--flags wp.c3b --mode laser`): all five **PASS** (SIZE 23, TYPE 10, OUTLINE 13 glass, 20
  probes; MOTION; AUD 0 issues).
- **Gates, pad:** SIZE (23), TYPE (10), MOTION and AUD **PASS**. OUTLINE is M1.
- **pad-bfs:** 19 nodes, not truncated, entry Wi-Fi, B closes the layer. Every control is reached: the Settings
  and Power circles, Battery Info, Notifications, the Wi-Fi, Bluetooth, Airplane and Motion Smoothing toggles,
  the Performance and Quick Settings rows, the Volume and Microphone sliders, Room View Off/On, the Environment
  and Display brightness sliders, both Room circles and the close circle. `pass: false` comes only from items the
  builder has already documented (Known issues), none of which loses a function:
  - 3 one-way edges, which are CC §4.8's spec'd joins (QS → Off → Performance; Notifications and Brightness ↓
    close ↑ Microphone);
  - 4 "unreached" inner `SliderControlAndNotches` nodes. Focus lands on Steam's outer slider group, which the lab
    recognises as a slider (`skip:slider`).
- **Laser reachability** (`js --flags wp.c3b --mode laser`, `scratch/probe.out`): all 15 `.lgs-cc-hit` targets
  are the top element at their own centre (none covered). More Controls renders Steam's Quick Access panels: the
  14:20 shot `shots/p2_c3b_r2_more_pad.png` lists Notifications, Quick Settings, Performance, Battery Info and
  Help. The notification list page renders. The spy log is empty, so nothing was executed. Closing leaves 0
  attributes, nodes and fades.
- **Shots vs mockup** (`shots/p2_c3b_q_main_pad.png`, `p2_c3b_q_main_laser.png` against
  `p2_control-center_overview.png` / `-overview-t1.png`): the three tiles and the close circle match the mockup's
  layout, sizes and slab look. The differences are Steam-data driven (Battery Info row instead of battery chips,
  "Toggle Room View" title, "Not Playing" with no game running) and not breaks.
- **Not reproduced:** the earlier R2 note that C1a's "⋯" More circle shows over CC-M (14:25). It did not appear in
  3 runs here, including `wp.c1a,wp.p3` on `/library/home` and on a settings route, so it is not counted.

### Minor (not counted toward the verdict)

- With `wp.p3` on, the pad entry focus shows P3's "Wi-Fi" tip chip, which covers the Performance row's icon and
  the start of its title every time CC-M opens by gamepad (`shots/p2_c3b_q_main_c1a_pad.png`). C3b sets
  `data-lgs-tip` on the toggles (`31-cc.js:309`). Placing the tip above the row, or not showing a tip on the
  entry focus, would avoid it.
- In CSS-only mode, library routes keep the gray window glass behind the tiles (`p2_c3b_q_home_c1a_pad.png`), but
  settings routes show none. Both mockups show the tiles floating with no window, which native `windowless`
  provides.
- The Environment slider shows Steam's small default-value notch (▼) above its top right corner.

## Evidence

| # | Command (all `python glass.py`, native off) | Result | Output |
|---|---|---|---|
| Q1 | `gates main --flags wp.c3b --mode pad --pre "<pre_open.js>" --json --shot p2_c3b_q_main_pad` (16:31, route `/settings/controller`) | FAIL: OUTLINE top of `lgs-cc-ctl` 0.357; SIZE 23, TYPE 10, MOTION, AUD PASS | `scratch/g_pad.out`, `shots/p2_c3b_q_main_pad.png` |
| Q2 | same, `--mode laser` (16:31) | PASS, all five | `scratch/g_laser.out`, `shots/p2_c3b_q_main_laser.png` |
| Q3 | `pad-bfs --flags wp.c3b --mode pad --pre "<pre_open.js>" --json` (16:32) | 19 nodes, B closes, `pass: false` from 3 spec'd one-way edges and 4 inner slider nodes | `scratch/bfs.out` |
| Q4 | `js --flags wp.c3b --mode laser "<probe.js>"` | 15 hits, 0 covered; 4 sliders; More and notification pages render; spy log empty; clean close | `scratch/probe.out` |
| Q5 | `gates main --only size,outline --flags wp.c3b,wp.c1a,wp.p3 --mode pad --pre … --shot p2_c3b_q_main_c1a_pad` (settings route) | OUTLINE FAIL, same edge 0.357; SIZE PASS; no "⋯" | `scratch/g_c1a_pad.out` |
| Q6 | same, `--route /library/home --shot p2_c3b_q_home_c1a_pad` | PASS (SIZE, OUTLINE); no "⋯" | `scratch/g_c1a_home.out` |
| Q7 | `js --flags wp.c3b "<probe2.js>"` (what is behind CC-M on home) | no element paints at (30, 540); the gray is the window glass layer; route restored | `scratch/probe2.out` |

`pre_open.js`: `rt.use('cc').spy(true); await cc.open('lab'); sleep 1.3 s`. No real toggle or slider was moved:
every action was spied, and pad-bfs refuses Left/Right on sliders.

## REVIEW

Verdict **fix**. M1: in pad mode the focus glow of the entry toggle lights the Controls tile's top edge over a
transparent backdrop, which fails the OUTLINE gate. Everything else checked passes or is a documented,
non-functional bfs item.
