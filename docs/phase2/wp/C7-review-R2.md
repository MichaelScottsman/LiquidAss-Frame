# C7 People, Photos, Downloads, Store: quick review R2

Reviewer: independent agent (quick review R2, about 20 min, not a full audit). Package card: PLAN §2.4 "C7";
builder's log `docs/phase2/wp/C7.md` (Status "READY: wp.c7", 13:05). Main route: `/chat` (People), the card's first
route. Flags on every step: `--flags wp.c1a,wp.p3,wp.c7` (C7 plus its dependencies). Steam build 11094443.
Out of scope (as asked): native sessions, removal sweeps, perf, full conformance, polish items.

## Status

**Done** (2026-10-07, 16:43-17:00). Verdict **accept**: 0 blockers, 0 majors.

## What was run

All CSS-only (`native=off` on every step line).

| Id | Command | Result |
|---|---|---|
| R2-GL | `gates main --route /chat --mode laser --flags wp.c1a,wp.p3,wp.c7 --shot p2_c7_r2_chat_laser` (16:43) | **PASS** all five: MOTION, SIZE, TYPE, OUTLINE (4 edge probes, 22 pseudo-elements), AUD (0 findings, 6 exempt) |
| R2-GP | same, `--mode pad --shot p2_c7_r2_chat_pad` (16:49) | **PASS** all five, same counts |
| R2-BFS | `pad-bfs --route /chat --mode pad --flags …` (16:50), then `--stock` (16:51) for the baseline | Themed: 18 nodes, entry on the "Online Friends" group header, 9 exits all brought back by the overlay, 7 of 18 unreached, **13** irreversible moves. Stock: 18 nodes, entry on the open chat's invite button, 8 exits, 10 of 24 unreached, **15** irreversible moves. Both say FAIL for the same reason (Steam's own one-way moves between the friends list, the chat pane and the search field); the themed run has no new one-way move and a better entry. **Not worse than stock**. JSON in this session's scratchpad (`c7r2_bfs_chat*.json`) |
| R2-DL | `gates main --route /library/downloads --mode laser --flags … --shot p2_c7_r2_dl_laser` (16:57; extra, the builder ran Downloads only in pad) | **PASS** all five (AUD 0 findings, 1 exempt) |
| R2-RT | read `device/rt/70-social.js` (162 lines) | Sets only `data-lgs-current` and the `/invites` plate attributes and registers More hosts through C1a's helper; no click, dispatch, Steam setter, send, pause or remove call. Safe |

## Shots next to the mockups

- **People** (`shots/p2_c7_r2_chat_laser.png`, `p2_c7_r2_chat_pad.png` vs `p2_social-media_people-t1.png`): the
  512 px black sidebar with the Large Title "Friends", the 60 px add-friend circle, the recessed segmented track with
  the white selected segment and the LB / RB circles, Title-weight group headers, large friend rows, the empty
  conversation pane on bare window glass, and the legend ornament under the window. Pad focus on the group header is
  the white focus platter with the specular, with A / B / ≡ glyphs in the legend; the laser legend has no glyphs. Glass
  slabs have no outlines. Different from the mockup, as recorded by the builder: icons only in the segments (no new
  strings), no search circle (C1a's capsule fallback), no compose placeholder. None of these is a break.
- **Downloads** (`p2_c7_r2_dl_laser.png` vs `p2_social-media_downloads.png`): Large Title, black platters for the
  queue and the completed row, Title 2 section headers without rules, the 60 px device capsule, a Clear All capsule,
  and the ornament legend (Change Device, Options, Go to game page, Back). No active download was present (none may
  be started), so the active card was not seen live.

## Key functions

AUD has 0 GONE, HIDDEN or UNCLICKABLE on `/chat` in both modes and on Downloads under the laser. Gamepad reach on
`/chat` is the same as stock or better. The friend tabs' LB / RB bumpers are laser-only in both themed and stock
(Steam's `focusable: false`). The legends keep Options, Collapse and Back on `/chat`, and Change Device, Options, Go to
game page and Back on Downloads.

## Findings

None at blocker or major level.

## Device left

- Theme on, CSS only.
- Every step used `--flags` and `--mode`, which are given back at the lock exit. `/tmp/lgs/flags.json` afterwards
  holds only another agent's key (`wp.c5b`), and no C7 key.
- No hv frames were taken (Frame `/tmp/lgs/hv-*.png`: 0).
- No dialog or menu was opened, and nothing was sent, bought, paused or cancelled.
- The route was `/library/tab/AllGames` at 16:56, set by another agent on the shared device.
- The pad-bfs runs found a conversation tab open in the friends UI. pad-bfs presses only the D-pad and B, and undoes
  any keyboard it opens, so this review did not open that tab, and the review left it as it was.
