# C6b SteamVR Settings: quick review, round R2

Reviewer: quick reviewer (a fast, focused pass, not a full audit). Date: 2026-10-07, 16:58-17:15. Steam build 11094443.
Scope: C6b as its log reports it, "READY: wp.c6b". Every step ran with `--flags wp.c6b,wp.c1a,wp.p3`.
Surface: `vr:systemui`, frame page `system.settings`, General section.
Main mockup: `settings-steamvr.html`, rendered earlier as `shots/p2_settings_steamvr.png`.
Files under test (md5): `theme/vr/30-settings.css` 6407380744218cd6bc17a02ff5090dc6 (12:40) and `device/vr/systemui.settings.js` fc46995f20f6347cf7ff30fae0963090 (11:56).

## Status

**DONE. Verdict: ACCEPT.** No blockers and no majors are attributable to C6b.

## Checks run

| Check | Command | Result |
|---|---|---|
| Gates, laser | `gates vr:systemui --flags wp.c6b,wp.c1a,wp.p3 --mode laser --pre "<settings_open.js, hold 70 s, then wait for __LGS_VRX.settings>" --json --shot r2q_c6b_laser` (17:00) | The pre returned `prev=5 now=1 … vrx=true sw=5 back=true`, so the page was shown and C6b's T2 was present. **AUD PASS**: 5 controls, 34 texts, 0 issues, 10 E-SWITCH text exemptions. **TYPE PASS** (22 checked). **MOTION PASS**. **SIZE**: 11 checked; all 3 visible switches pass E-SWITCH ("hit 100% own over 86 x 80"). **SIZE** and **OUTLINE** fail only on C1a's systemui elements, outside the SteamVR panel (see Notes). |
| Gates, pad | same, with `--mode pad --shot r2q_c6b_pad` (17:06, hold 25 s) | Same numbers as laser, because the lab does not apply `--mode` on `vr:` steps (`mode=pad via (not for vr: steps)`). Two earlier pad attempts (17:00:33 and 17:00:49) never got the page (`now=5`), for the reason given in Notes. Those runs measured only the systemui bar and are discarded. |
| pad-bfs | `pad-bfs --route /settings/lgsvr --flags wp.c6b,wp.c6a,wp.c1a,wp.p3 --budget 120 --json` (17:07-17:10) | 0 irreversible moves. The run stopped at its budget (`truncated`). This route is only the Steam-side way in. C6a's VR page there is not built (C6a's documented T3 fallback), so Steam showed its System page and nothing C6b owns was walked. SteamVR's own page has no Steam nav tree: it is laser only in stock too (SET §4.10). Its gamepad path out is the frame menu (D-pad Left → VR Settings), which the builder checked in T-VR-EXIT at 12:12. |
| Shots vs mockup | `shots/r2q_c6b_laser.png` and `shots/r2q_c6b_pad.png` next to `shots/p2_settings_steamvr.png` | They match the mockup's structure: <ul><li>"SteamVR" title next to the Back circle</li><li>coloured icon circles in the sidebar, with the .18 selected pill on General</li><li>compact hero (icon circle and "General" in one row)</li><li>platter rows with separators</li><li>86 px refresh circles with 90 selected</li><li>a slider with the value on the knob</li><li>green switches</li><li>the Advanced Settings Hide/Show ornament straddling the bottom edge of the glass</li></ul> Glass edges have no outlines, and the two shots are identical. Differences from the mockup are live values only: brightness reads 40 % with the knob at the track origin, and IPD HUD is on. |
| Key functions (laser hit test, read only) | `js --in vr:systemui --flags wp.c6b,wp.c1a,wp.p3`, scratch `c6bq/hits.js` (page shown, `elementFromPoint` at each centre; page container scrolled to the end and back; page switched back to Steam) | <ul><li>**Sidebar.** 7 of 8 rows hit themselves. Developer sits below the sidebar's scroll fold.</li><li>**Visible detail-pane controls.** 14 of 19 controls are clear of the ornament. Every one hits itself except the three selected "On" options, which are inert by design: the click lands on the unselected option stretched over the track (T-VR-SW).</li><li>**Scrolled to the end.** The last row ("Track Dominant Eye Only") ends at y 921, above the ornament (top 1066), and its control hits.</li><li>**Ornament.** Hide and Show both hit.</li><li>**Back circle.** It hits.</li></ul> |

No setting was clicked or changed. The page was only switched between Steam's page and `system.settings`, and the detail pane scrolled and was put back.

## Findings

None at blocker or major level.
- **Functions.** Every SteamVR control on General can still be reached with the laser. The Back circle and the sidebar work.
- **Gates.** AUD reports no GONE, HIDDEN or UNCLICKABLE.
- **Look.** The page matches the mockup in both runs.

## Notes (not C6b findings)

- **The gate failures on this route belong to C1a.** They are already listed as C1a-review-R2 M1 and as the open REQ C6b->C1a:
  - OUTLINE P-42 on `%{ControllerStatusRoot} %{LargeStatusArea}::before` (rects 278,1571 and 535,1571).
  - SIZE P-08 on the frame-control `ButtonControl WithIcon LargeIcon` at (139, 1256), 107 × 107.
  
  C1a's review says the SIZE fail did not reproduce at 13:10, but it reproduced at 17:00 and again at 17:06.
- **The page was taken away during the tests (lab interference, worth knowing for V2).** From 17:01 to 17:05, `SwitchToPage(system.settings)` was undone within 0.3-1 s several times. This happened with and without `wp.c6b`, and even while this reviewer held `lab.lock`.
  - A temporary spy on `f.SwitchToPage` (removed in the same step) traced each switch back to Steam's own `onShowOverlayRequestFromSteam` → `switchToOverlayInternal`. C6b's Back handler was not involved.
  - The likely source is other agents' Steam steps that call `Navigate` / `EnsureVROverlayVisible`. That is lab traffic, not the theme.
  - `vr:` gate runs therefore need to check the pre's `now=1` before their numbers are trusted.
- **Display Brightness read 40 % at 17:00 and 17:06,** with the knob at the slider's origin. The builder logged both 40 % and 120 % earlier in the day. This review touched no slider.

## Device left

- **Theme.** Theme on, CSS only (native off throughout).
- **Frame page.** The frame is back on Steam's page (`activePageID` 5, no pending revert timer). No `__LGS_VRX` page script is installed, because the flag is off.
- **Flags.** My flags were popped at each lock exit. At 17:12 `flags.json` held only another agent's `wp.c4b`.
- **Leftovers.** No pause file, and nothing in `/tmp/lgs/vr-scripts/`.
- **Route.** pad-bfs restored `/settings/lgsvr`. At 17:12 main was on `/settings/audio`, which another agent's step set later. I left it so as not to disturb that agent's work.
- **Pointer and room imagery.** No hover, menu or dialog was used. No `hv` frame was taken, so no room imagery was captured.
