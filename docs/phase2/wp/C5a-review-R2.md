# C5a Game pages, achievements, Properties: quick review, round R2

Reviewer: quick reviewer (a fast, focused pass, not a full audit). Date: 2026-10-07, 16:23-16:45. Steam build 11094443.
Scope: C5a as its log reports it, "READY: `wp.c5a`", run with `wp.c1a` and `wp.p3`. Main route `/library/app/620980` (Beat Saber title view).
An earlier, full R2 session (13:38-15:30) was cut off before it wrote up its findings. This file replaces that session's partial notes. Its unverified leads are listed at the end and are not part of this verdict.

## Status

**DONE. Verdict: FIX** (1 major, 0 blockers).

## Checks run

| Check | Command | Result |
|---|---|---|
| Gates, pad | `gates main --route /library/app/620980 --flags wp.c5a,wp.c1a,wp.p3 --mode pad --json --shot r2q_c5a_pad` (16:24) | AUD, SIZE, TYPE, OUTLINE and MOTION all **PASS**. AUD: 59 controls and 34 texts, 0 issues. SIZE: 0 fails, and the four tab segments pass E-SEG at 60 px tall. OUTLINE: 0 fails. |
| Gates, laser | same, `--mode laser --shot r2q_c5a_laser` | All five **PASS**, with the same numbers. AUD finds 0 GONE, HIDDEN or UNCLICKABLE, so every control can still be clicked with the laser. |
| pad-bfs | `pad-bfs --route /library/app/620980 --flags wp.c5a,wp.c1a,wp.p3 --json` (16:28, 156 s) | `pass: false` only because the run hit its budget (`truncated: true`). There were 0 irreversible moves. The entry focus is Play. Unreached: three feed cards and "Load More Activity". They sit further down the linear Down chain through the Activity feed (nodes 8 to 38), which the walk had not finished when the budget ran out, so no function is lost. |
| Shots vs mockup | `shots/r2q_c5a_pad.png`, `shots/r2q_c5a_laser.png` next to `mockups/game-pages-title.html` (rendered with `tools/mockshot.py`) | The layout matches the mockup: logo, VR chip, Play pill, Play-from circle, Steam Input capsule, Manage circle, the segmented tab track with paired arrows, and no outlines. There is one clear break, M1 below. |
| Extra shots | `shot` of the achievements route (`/library/app/620980/achievements/my/individual`, pad) and of Properties General (`/app/620980/properties/general`, laser) | Both render properly: header slab, segmented My/Global track, rows; the Properties sidebar and the detail pane have no visible break. |

Key functions:
- **Gamepad.** pad-bfs reaches Play, Play-from, Steam Input ("Configure Controller"), Manage, all four tabs, Post and the feed.
- **Laser.** AUD in laser mode finds 0 UNCLICKABLE controls.
- **Achievements and Properties.** Both routes render, and the Your Stuff tab reaches achievement rows.

I pressed no Play, Install, Uninstall or Properties action.

## Findings

### M1 (major): the Last Played and Play Time values are cut off on the main route, in both modes

- **What a user sees.** Under the logo, the stat values "Oct 2" and "10.2 hours" have their bottom third cut off in both shots (`shots/r2q_c5a_pad.png` and `shots/r2q_c5a_laser.png`, at about y 560-570 shot px). The mockup shows the stats as a single clean line: "Last Played Oct 2 · Play Time 10.2 hours".
- **Measured live** (`glass.py js`, flags on, pad mode, route restored afterwards):
  - Each label ("Last Played", "Play Time") occupies y 338-364, and each value occupies y 364-390. Both are 20 px text on a 26 px line.
  - An ancestor 4-5 levels up has `overflow: hidden` and spans only y 334-380, so the bottom 10 px of each value is clipped.
- **Cause.** `theme/50-appdetails.css` lines 187-217 give `%{StatusAndStats}`, `%{GameStatsSection}` and `%{GameStat}` a 60 px height. In that height, the label-over-value stack (52 px) is clipped by Steam's 46 px `overflow: hidden` box.
- **Why the gates missed it.** TYPE skipped this text as "clipped" (`skippedClipped: 1`), and AUD sees the text present.
- **Fix.** Either lift the clip on that ancestor, or set the stats as one line as the mockup does: label 20 Regular at .80 and value 20 Semibold on one baseline.

No blockers: no function was lost, nothing crashed and there was no safety problem.

## Device left

- Theme on, CSS only. The gates and pad-bfs flags were scoped to their steps.
- Laser steps parked the pointer at exit. No menus were opened.
- The one `js` step that navigated restored the route it found (`/library/home`, another agent's).
- No hv or native session was used, so no room imagery was taken.

## Leads from the earlier, cut-off R2 session (not re-checked here, not in the verdict)

These come from the earlier session's status note, which gave no evidence for them. The builder may want to look at them:

- G-SIZE, G-TYPE or G-OUTLINE fails on the other details tabs and on most Properties pages. This was off the main route, so out of this pass's scope.
- The focused tab's glow is cut into a square frame.
- Manage's laser tooltip is Steam's grey tooltip below the gear, over the tab arrows.
- The event "⋯" button (AT-OPT) is not built. The builder already lists this as known.
- The achievements single-column rows are full-width bands (P-81).
