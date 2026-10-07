# C3a Bar, HUD, toasts, tooltips look: quick review R2

Reviewer: R2 quick reviewer (2026-10-07, Steam build 11094443). Scope per the user's request ("go through these
reviews a little faster"): `gates bar` once per input mode with `--flags wp.c3a` (no dependency flags: the bar's
T1 look is unflagged; `wp.p6` matters only for the native +25 mm request, which is out of scope here), `pad-bfs` once,
one shot per mode next to `control-center-bar`, key bar functions reachable. No native session, removal sweep, perf or
full conformance.

## Status

**DONE (17:15). Verdict: accept.** No blocker, no major. Device left as found: theme on, CSS-only; my steps set no
flag that stayed on (the `flags.json` present at 17:13 holds `wp.c6a`/`wp.p3` from another agent's step); every
step ran under the lab lock with its own mark/restore; no menu, popup or tooltip opened; nothing hovered. Shots
are CDP captures of the bar window only (no room imagery).

## Runs

| Check | Command | Result |
|---|---|---|
| Gates, laser | `gates bar --route /library/home --flags wp.c3a --mode laser --json --shot p2_c3a_rev_laser` (16:39) | **PASS**: AUD (7 controls, 13/13 records stock vs themed, 0 issues), SIZE (5 E-BAR slots pass: Home 80 x 80, + 70 x 72, three discs 64 x 80; the pill glyphs skipped as parts of their host), TYPE, OUTLINE, MOTION (0 running at rest, 0 non-token) |
| Gates, pad | same with `--mode pad --shot p2_c3a_rev_pad` (16:39) | **PASS**, same counts |
| pad-bfs | `pad-bfs --route /library/home --flags wp.c3a --mode pad --json` | Run 1 (16:49): CDP eval timeout inside `L.bfs.step` (75 s), no result; Steam stayed responsive (`check`, `status` fine). Run 2 (16:55): 27 nodes, 172 moves, **truncated** at 165 s; `unreached` = Recent Games posters scrolled off to the right; 2 irreversible edges inside Home's content; 8 Left exits recovered (`overlay`). All on `main`'s Home content (C2a's area). The bar is its own window (`valve.steam.gamepadui.bar.*`), so pad-bfs on main does not sweep it; nothing here involves a C3a surface |
| Bar gamepad path | `glass.py js` (lab lock): bar nav tree `Activate(true)` + `BTakeFocus` on Home, Right/Left | Not measurable this session: no window held a `.gpfocus` and the active nav tree was null (the overlay was probably not in front; headset battery read 25 % to 16 % during the review). Focus was handed back to main (`Activate` + `FocusApplicationRoot`). The builder's G-PAD on the bar (C3a.md Evidence, 10:33: View x2, Right x8, Left x8, all 7 items in Steam's order with wrap, light visible, no outline) stands; not independently rechecked |

## Look (shots next to `shots/p2_control-center_bar.png`, "At rest" row)

`shots/p2_c3a_rev_laser.png` and `shots/p2_c3a_rev_pad.png` (identical, since nothing has focus at rest) match the
mockup's structure: three separate pieces (Home circle with the selected white dot, "+" circle since no app is
running, system capsule), Playspace / Room View (white, on) / Streaming discs, the status pill on one line (clock in
tabular figures, battery as a level capsule **without a number**, as Steam's setting is off: PLAN-3a-2 holds),
volume and Wi-Fi glyphs, avatar at the end. No outlines or rings anywhere. The capture is CSS-only against a white
backdrop, so the glass material itself is not visible here (as in the builder's `p2_c3a_bar_t1.png`).

## Key functions

All 7 bar controls (Home, "+", Playspace, Room View, Streaming, the pill, the avatar) are present, shown and
clickable in both modes (G-AUD: no GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST, theme vs stock). A scan of
`theme/30-bar.css` and `theme/35-hud.css` finds `pointer-events: none` / `opacity: 0` only on decorative
pseudo-elements and the dot's resting state, never on a control.

## Findings

None at blocker or major level.

Notes (minor, not blocking; no action asked of C3a):

- n1 (P10 tooling): the G-OUTLINE probes on the bar came back with a degenerate span (`x0: 1422, x1: -71`, top and
  bottom of the pill) and `edges: []`, so OUTLINE passed without measuring an edge on this surface. The shots show no
  outline by eye.
- n2 (P10 tooling / C2a area): pad-bfs on `/library/home` hit one CDP timeout and then needed more than the 150 s
  default budget; neither touches C3a's surfaces.
