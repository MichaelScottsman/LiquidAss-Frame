# C5b Now Playing, binding UI, VR bindings link: quick review, round R2

Reviewer: quick reviewer (a fast, focused pass, not a full audit). Date: 2026-10-07, 16:48-17:10. Steam build 11094443.
Scope: C5b as its log reports it, "READY: `wp.c5b`" (no dependencies). `vrBindings` is reported NOT ready, so it stayed off.
Main route: `vr:systemui` Now Playing. No scene app was running, so I used the builder's display-only mock (`theme/vr/pre/np_states.js`, perf variant, the same states as the log's final pass).

## Status

**DONE. Verdict: ACCEPT** (0 blockers, 0 majors attributable to C5b).

## Checks run

| Check | Command | Result |
|---|---|---|
| Gates, pad | `gates vr:systemui --flags wp.c5b --mode pad --pre "window.__LGS_NP={focus:1,hover:-1,mock:'perf',keep:40000,waitKeys:true}, $(cat theme/vr/pre/np_states.js)" --json --shot r2q_c5b_pad` (16:51) | SIZE 9/9, TYPE 7/7 and AUD (9 controls, 9 texts, 0 issues) **PASS**. Every Now Playing edge probe is clean: the panel, the art, Resume and Exit. The page-level OUTLINE FAIL (2) is `%{ControllerStatusRoot} %{LargeStatusArea}::before`, which is C1a's area and is already C1a R2 M1 (REQ C5b->C1a). MOTION FAIL: see N1. |
| Gates, laser | same, with `{focus:-1,hover:4,…}`, `--mode laser --shot r2q_c5b_laser` | The same: SIZE, TYPE and AUD **PASS**, and the NP probes are clean. The OUTLINE and MOTION fails are the same two non-C5b findings. |
| pad-bfs | `pad-bfs --route /library/app/620980 --flags wp.c5b --max 40 --json` (16:58) | **PASS**: 38 nodes, 0 unreached, 0 irreversible, `truncated: false`, entry focus Play. With `vrBindings` off, no bindings capsule is rendered (PLAN-5b-1): the only controller node is Steam's own "Configure Controller". |
| Binding view (extra, one run) | `gates vr:controllerbindingui --flags wp.c5b --mode laser --pre "$(cat docs/inventory/steamvr-pre/bind_view.js)" --shot r2q_c5b_bindview` | All five **PASS**. AUD: 51 controls, 0 issues. |
| Shots vs mockup | `shots/r2q_c5b_pad.png` and `r2q_c5b_laser.png` next to `mockups/game-pages-nowplaying.html` (rendered with `tools/mockshot.py`, then deleted) | The layout matches: "Now Playing" caption, the bold title (two lines), the green Resume capsule with its play glyph, one recessed platter of chip rows (indigo bindings, blue video, grey perf) with chevrons, and the Exit capsule with a red label. Pad: the focused Bindings row is lit with no ring. Laser: hovering Exit gives a red fill with a dark label. The dark label on green Resume differs from the mockup's white, which is correct: REQ C4a->C5b and PLAN §1 decide. No outlines and no visual break. |

Key functions:
- **Now Playing.** In both modes, AUD finds Resume, VR Controller Bindings, VR Video Settings, Clear Performance Assessment Status and Exit present, full size and clickable, and the T2 keys are applied. Gamepad order is SteamVR's own. The theme keeps the DOM order of a single vertical stack, so this needs no BFS. A real (non-mock) Now Playing could not be driven, because nothing may be launched.
- **Binding UI.** Back, Options, the action-set tabs, Poses, Haptics and the five bottom actions are all present and clickable in laser mode.
- **Game page.** It is fully pad-reachable with `wp.c5b` on, and nothing of C5b's is rendered there.

I pressed no Resume, Exit, Select, Edit, Export or Replace action, and I changed no binding.

## Findings

No blockers and no majors.

### N1 (note, not in the verdict): MOTION on `vr:systemui` is a side effect of the test harness, not of the theme

The `transition-duration 0.04s` that MOTION flags comes from SteamVR's stock rule `.gamepaduibutton_GamepadUIButton_…:active, …:active:hover, …:active.gpfocus`. C5b's own pre script, `np_states.js`, clones every `:hover` rule into its `#lgs-vr-np-hover` sheet, and this rule is among them. Because the sheet's id starts with `lgs-`, the gate counts the clone as ours. Nothing ships it: the sheet is removed after `keep`, and I confirmed it was gone at 17:08.

The builder's log blames "not in any theme file" (REQ C5b->C1a). C1a's R2 saw MOTION pass when no NP pre was used, which fits this cause. A one-line fix, if the builder wants a green MOTION gate: in `np_states.js`, clone only the `:hover` rules with no `:active` in them, or strip `transition*` from the clone.

## Device left

- Theme on, CSS only (`status`: `css-only`). The flags were scoped to their steps, and `vrScripts.systemui.nowplaying` reads `flag-off` again.
- No mock, hover sheet, `data-lgs-np` key or `__LGS_VRX` is left on `vr:systemui`. The binding pre returned to the app list on its own.
- Laser steps parked the pointer at exit, and no menus are open. pad-bfs restored its route. The main window is now on `/routes/settings/remoteplay`, which is another agent's concurrent run, not mine.
- I used no hv or native session, so no room imagery was taken. The two mockup renders were deleted from the scratchpad.
