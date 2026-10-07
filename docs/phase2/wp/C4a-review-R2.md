# C4a Controls and primitives: quick review R2

Reviewer: R2 quick reviewer (2026-10-07, Steam build 11094443). Scope per the user's request ("go through these
reviews a little faster"): `gates main` on the main route once per input mode with `--flags wp.c4a,wp.p3` (`wp.p3`
because the `controls` module depends on P3's `input` and `states`), `pad-bfs` once, one shot per mode next to
`controls-system.html`, key control functions reachable. No native session, removal sweep, perf or full conformance.
Main route: `/settings/system` (the route of C4a's main mockup `controls-system.html` and of PLAN-4a-1; switches,
pop-ups, rich pop-up labels, buttons, rows and platters all on one page). Scratch JSON:
`<scratchpad>/c4a-r2/` (`gates_laser.json`, `gates_pad.json`, `padbfs.json`, `padbfs2.json`).

## Status

**Complete** (16:50–17:15 EDT). Verdict: **accept** (no blocker, no major). Device left as found: theme on, CSS only,
route `/library/home`, every step's flags popped by the lab (`/tmp/lgs/flags.json` empty afterwards), pointer parked
by the lab's laser exit and by `L.unhover()`, no menu or dialog opened. Kept shots: `shots/p2_c4a_r2_laser.png`,
`shots/p2_c4a_r2_pad.png` (CDP captures of the Steam surface only, no room imagery). No other file touched.

## Results

| Check | Result |
|---|---|
| `gates main --route /settings/system --flags wp.c4a,wp.p3 --mode laser` | **PASS**: AUD 131 controls, 0 issues (no GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST); SIZE 13 checked, 0 fails (5 skipped: obscured, scrollable clear); TYPE 22 checked, 0 fails; OUTLINE 8 glass, 15 probes, 0 fails; MOTION 0 at rest, no non-token |
| same, `--mode pad` | **PASS**: AUD 161 controls, 0 issues; SIZE, TYPE, OUTLINE 0 fails; MOTION clean |
| `pad-bfs --route /settings/system --flags wp.c4a,wp.p3` | Run 1 (default 150 s budget): truncated (it walks the Settings sidebar into 16 other routes); run 2 (`--budget 480 --max 200`, 142 s): `done`, no irreversible move, no untested slider move. Every one of the page's 46 content focusables was reached in pad (language pop-up, Check For Updates, both update-channel pop-ups, all 10 switches including the disabled crash-report ones, Timezone, Hostname, the info rows, Third-Party Licenses, System Information, Create Report, maintenance Run, Factory Reset). `pass: false` only because run 2 recorded System → Down as `exit:none` (the route then changed to Internet late, so the 23 sidebar items count as unreached); run 1 had the same move as a normal edge (System → Internet → … → In Game). Sidebar timing, C6a / C1a ground, not C4a's primitives |
| Pad shot vs `controls-system.html` (`p2_c4a_r2_pad.png`, focus on "Default to Desktop Mode on startup") | Matches the mockup: the whole single-control row lifts as one lit capsule with the switch inside (C4a-D8, one lit thing), platters with no outlines, 60 px pop-up capsules with chevrons, Timezone's rich two-line label, separators inset, 80 px rows, section headers secondary |
| Laser shot (`p2_c4a_r2_laser.png`) | Rest look matches: platters, capsules, sidebar selection, no rims. The hover look is keyed on CSS `:hover`, which the lab's synthetic `L.hover` cannot raise (the pop-up got P3's `lgs-dwell`, its computed background stayed at rest), so laser hover is not visible in a CDP shot; not a C4a defect, and the builder measured it (C4a-D16) |
| Key functions | Laser: AUD finds every stock control still present, visible, full size and clickable in both modes. Pad: every control on the page reachable (above); B leaves the page (history back). Nothing lost |

## Findings

None at blocker or major level.

Notes (not findings, no action asked of C4a in this round):

- n1. `pad-bfs` on a Settings page cannot report `pass: true` today: the sidebar's route-changing Down sometimes
  lands after the BFS's settle and is recorded as `exit:none`. If a green `pad-bfs` on `/settings/*` is wanted as
  evidence, P10's settle after a route-changing move (or a `--start` in the content column) would fix it; C6a owns
  the sidebar.
- n2. Timezone's rich label wraps its second line ("UTC -04:00 · / Miami, Montreal, New York") to three lines in the
  live page, where the mockup shows two (the live zone list is longer than the mockup's). Polish; out of this review's
  scope.

## Verdict

**accept.** With `wp.c4a` (and P3's `wp.p3`) on, the main route passes all five gates in laser and pad, every Steam
control on it stays reachable on both paths, and the pad look matches `controls-system.html`.
