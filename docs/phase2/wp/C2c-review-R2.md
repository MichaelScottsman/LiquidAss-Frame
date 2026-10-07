# C2c Library catalogue: independent review, round R2

Reviewer: an independent adversarial review agent. Date: 2026-10-07 (Frame clock 13:28 onward). Steam build 11094443.
Scope: package C2c as its log (`docs/phase2/wp/C2c.md`) reports it, "READY: `wp.c2c`" with `wp.p3` and `wp.c1a`. Nothing in the builder's log is taken on trust.

## Status

**In progress** (session 1, last update 14:45). Since 14:05: removal (flag pop and `--stock`), pad-bfs, motion, conformance, G-PERF (FAIL, 0.70), P-21 against stock, shots of the Filters sheet, tile menu and Sort menu. **Incident to disclose:** my CSSOM A/B probe for G-PERF (`perfab.js`, 14:15–14:18) re-inserted `40-library.css`'s top-level rule from its serialized text, which dropped every `var()` shorthand (`font`, `background`) in that rule on `main` until the sheet was re-parsed; at 14:41 main's sheet was byte-identical to the bar's again (0 rule differences, checked). Library measurements by any agent between about 14:15 and 14:41 may have seen C2c's rules without those declarations. My own steps from that window are re-run. Next: one native session.

**In progress** (session 1, update 14:05). Since 13:43: legends (themed and stock), the VR collection geometry, the idle cost, both menus in both modes, Filters in both modes (with and without `wp.c1c`), G-FOCUS. Running: Collections focus, removal, `--stock`, pad-bfs, motion, conformance, perf; then P-21 and the native session.

Added provisional findings: the collection page's pill is 18 px from the search capsule (needs 20); G-AUD also fails in laser on the VR collection and Soundtracks (DOM-path shift from C1a's T2 Options member, which appears once C2c registers More hosts); G-SIZE fails on Soundtracks in laser (the More circle covers 19 % of a square poster's P-08 box); after B closes the tile menu or the Filters sheet, main has no gamepad focus (P-21, to compare with stock); P-16 glow band +15.7 / +17.9 L from the visible fill (needs 20); P-15 cannot hold on white-selected segments (−142.7 L); the Filters close circle overlaps the sheet title; the T1 Filters scroll is 5,809 px (11.9 sheet heights). Static review of `theme/40-library.css`, `device/rt/40-library.js`, `theme/layers/40-library.json` done; deployed files are byte-identical to the tree. Live so far: geometry probes (pad, laser), gates on AllGames (both modes), Collections (both), Non-Steam (both), VR collection (pad). Queued: remaining gates, focus, filters/menus probes, pad-bfs, conformance, perf, removal, one native session.

Provisional findings (to be confirmed and written up below):
- R2-2 check 2 fails: the toolbar pill is 6 px from the search capsule (needs ≥ 20); its box overlaps the search box by 2 px. REQ Coordinator->C2c (`wp/coordinator.md` 196) is open and unanswered.
- Gamepad ornament: "Sort By · Alphabetica" is clipped mid-word (no ellipsis) at the 300 px cap.
- The VR sub-filter reads "ALL / VR / NON-VR" (Steam's strings are uppercase); E-SEG also exempts these labels from G-TYPE.
- Non-Steam laser: G-AUD FAIL ("GONE text SELECT"), no REQ filed.
- Ledger: all 27 C2c rows `open` (no evidence rows named by test id); AT-14 (a)–(f), AT-15, PLAN-2c-1 (R2-2), PLAN-2c-2 not recorded.
- Card scope not built: letter scrubber, T3 Filters, filter-count badge, `C2c-cmp.json`.
- A 4 Hz polling tick runs on every route while the module is installed.
