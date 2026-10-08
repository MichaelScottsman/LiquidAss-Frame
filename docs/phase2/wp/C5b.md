# C5b Now Playing, binding UI, VR bindings link: evidence log

Package card: `docs/phase2/PLAN.md` §2.4 "C5b Now Playing, binding UI, VR bindings link". Concept: `docs/phase2/concepts/game-pages.md` (GP §4.12, §4.13, §4.14, §9.7, §9.8, §10; owned by C5a, built here). Steam build at the time of writing: `11094443`.

## Status

**Session 1 complete** (2026-10-07 10:25-12:05, expedited, one session; build 11094443).

- **M0** note done (C5b-D1..D5). **M2 T1 done:** `theme/vr/20-nowplaying.css` (GP §4.13 on a mock: no scene app may be started), `theme/vr/40-bindings.css` (§4.14; app list, binding list and binding view gates **PASS**). **M3 T2 done:** `device/vr/systemui.nowplaying.js` (flag `wp.c5b`; AT-NP-VARIANTS PASS with the flag on, no keys and no red with it off).
- **T3 built, stays OFF:** `device/rt/52-vrbind.js` + `device/shell_ext/vrbind.py` (flag `vrBindings`): capsule in `%{AppButtons}`, D-pad reachable and reversible, laser → relay (dry), A → ConfirmModal, gates PASS (pad; laser clean for the capsule). Not run: AT-BIND-RETURN (live deep link), AT-T3-ROUTE; Steam Input page link not built. Q-A pending, so **not** ready.
- **Native:** no fragments by design (SteamVR overlays have no glassd surface; the capsule is 0 mm content under C5a's cover). The native-session check was attempted twice and blocked by lock contention (log below); left for V1.
- Open REQs: C5b->C1a (controller-status rims, a 0.04 s transition in `vr:systemui`), C5b->C5a (private-app indicator size/hit).

**READY: wp.c5b** — evidence: AT-NP-VARIANTS (keys from SteamVR's own strings, re-applied within one frame after a re-render, Exit red only when keyed, nothing red with the flag off); `gates vr:systemui --flags wp.c5b` in pad and laser on the keyed mock: my elements SIZE / TYPE / AUD / edge probes all PASS (the page-level FAIL is C1a's controller status and a foreign transition); no script error in the daemon's `vrScripts` status; nothing left after removal. The T1 CSS is unflagged and already live. `vrBindings` is NOT ready.


## Requests

<!-- "- [ ] REQ C5b-><OWNER>: <what and why>" -->
- [x] REQ C5b->C1a: `gates vr:systemui` (both modes, 10:33-10:55) fails OUTLINE on `%{ControllerStatusRoot} %{LargeStatusArea}(::before)` and `%{ControllerStatusRootRight}::before` ("closed rim of 3 shadow lines": the Phase 1 `--lgs-panel-rim`-style insets 1.5 px top + 1 px sides) and MOTION on one `transition-duration 0.04s` (not in any theme file I could find). Both are outside Now Playing; they make every `vr:systemui` gate run FAIL for the other SteamVR areas too.
  - **C1a answer (2026-10-07, R2 fix pass, session 6):** done. `theme/vr/10-systemui.css` no longer draws a closed rim anywhere: the controller card, the gamepad-mode pill, More Options and the section 5 panels use P4's panel / thick glass with the E4/E5 dark edge and the lit top lip only (no Phase 1 `--lgs-panel-rim` / `--lgs-control-rim`, no Phase 1 alias left in the file). `gates vr:systemui --flags wp.c1a --mode pad` and `--mode laser` (17:49, `native=off`): AUD, SIZE, TYPE, OUTLINE, MOTION all PASS (shots `p2_c1a_r2f_vr_{pad,laser}.png`). The 0.04 s MOTION finding is the pre's clone of SteamVR's own `:active` button rule (your reviewer's N1): C1a's `theme/vr/pre/sys_hover.js` now clones `:hover` rules without their `transition*` declarations; the same fix is needed in your `np_states.js` and C3a's `sys_zoo.js` (with a stripped scratch copy of `sys_zoo.js` the gate is green).
- [x] REQ C5b->C5a: on `/library/app/620980` Steam's 30 x 30 private-app indicator (`%{PrivateAppActiveIndicator}`, the red eye badge after Manage) fails P-80 and P-08 (hit 49 % own, 14 % Manage) in laser mode. My capsule now keeps 72 px clear of it. — **C5a (R2 fix 1, 2026-10-07):** done. The badge is Steam's indicator (`focusable: false`, its one function a laser hover tooltip). It is now a 114 px round hover target (x 822–936, y 416–530) that starts 1 px clear of Manage's box (741–821), with Steam's own red circle as the 30 px disc in its upper left (x 835–865, y 429–459, beside the gear's top right) and the eye centred on it. `L.gates.hitStats` over the gate's 114 × 80 box: 97 % own, 0 % other (19:58); Manage keeps 100 % own. `gates main --route /library/app/620980 --flags wp.c5a,wp.c1a,wp.p3` pad 19:45 and laser 19:46: SIZE PASS (both runs listed the badge as part of its host; an 80 px round target sampled at 19:29 read 92 % own, hence 114). Your capsule sits before Manage, so the badge's target moves with Manage and never reaches it.

## Requests to C5b, handled

- REQ P4->C5b (`40-bindings.css` hover rim restated ring-free; NP focus re-shot): see log.
- REQ C4a->C5b (dark label on the green Resume capsule in `20-nowplaying.css`; re-render NP mockups): label done in CSS; mockup re-render skipped (expedited mode, no re-renders).

## Log

### 2026-10-07, session 1: M0 conformance note (PLAN §1 decides; no mockup re-renders)

Start-of-session request check: `grep -n "REQ [A-Za-z0-9]*->C5b:" docs/phase2/wp/*.md` → P4 (bindings hover rim, NP focus), C4a (dark label on green).

| # | GP said | PLAN §1 / request decides | Built as |
|---|---|---|---|
| C5b-D1 | NP focus = + white .14 inner illumination | §1.4 / tokens §5: `--lgs-vr-focus-ring` (focus add .32 as an inset layer + lit arc + glow, no ring); SteamVR's `%{FocusRing}.gpfocus::after` outline cleared | T1 |
| C5b-D2 | Resume label white on green | REQ C4a->C5b, CTL C-D21: `--lgs-text-on-color` (#0d0e12) on the lit green | T1 |
| C5b-D3 | Sheets +30 → +50 mm (GQ6); Resume crop +15 in the mockup | §1.7 default profile: SteamVR pages are not reported surfaces (no cover, plate or pop fragments exist for `vr:systemui` / `vr:controllerbindingui`); depth stays SteamVR's own. No layer/popup fragment for these pages | none (documented) |
| C5b-D4 | Binding page hover rim restated as a closed ring | REQ P4->C5b: lit top arc only at S 1.875 | T1 |
| C5b-D5 | Capsule and Steam Input link | Off behind `vrBindings` (runtime.md S13) until Q-A; never in READY | T3 |

### 2026-10-07, session 1: M2 T1, M3 T2/T3 (build 11094443)

No scene app was running (`driver.py status`: inactive) and agents never launch anything, so Now Playing was verified on a **mock**: `theme/vr/pre/np_states.js` now builds a display-only copy of the panel from SteamVR's own global classes and localized strings at atlas (0, 700), outside every idle panel's UV rect (inventory §2.2), removed after `keep` ms; on a real Now Playing it marks the live panel instead. Its buttons carry `role=button` only so G-SIZE judges them (SteamVR's own have no role, so the gates never size-check the real ones).

**Files** (all owned): `theme/vr/20-nowplaying.css` (rewritten), `theme/vr/40-bindings.css` (Phase 1 look kept, rims made ring-free, §9 Phase 2 sizes and type added), `theme/vr/pre/np_states.js` (mock + states), `device/vr/systemui.nowplaying.js` (T2 keyer, `// @lgs-flag wp.c5b`), `device/rt/52-vrbind.js` (T3 capsule, flag `vrBindings`), `device/shell_ext/vrbind.py` (relay plugin, actions `vrbind` nav and `vrbind.strings` read, both behind `vrBindings`). The Phase 1 versions are in git history (no copies kept).

**Now Playing (GP §4.13):** panel = window glass (`--lgs-mat-window-bg` + the E3 lobe, no top line), art 540 × 810 r 29 at x 218 (Steam's `--width`), column 760 at x 880, title 92 Bold two lines max with SteamVR's "Now Playing" caption (T2), Resume 760 × 128 green capsule with the 44 px play glyph and the dark label (REQ C4a), sheet rows 116 in one recessed platter (black .14, r 52, pad 8, 2 px separators, 64 px indigo / blue / grey chips only when T2-keyed, chevrons), Exit 760 × 116 capsule: red label and red fill on hover / focus **only** with `data-lgs-np="exit"`. Focus = SteamVR's `.gpfocus` lit with the focus add (+ spot, glow on coloured fills), the Steam-owned `::after` ring and its blinker removed. Sheets (VR Controller Bindings / VR Video Settings modals) are not restyled: their DOM was never opened (opening them is forbidden, GQ15).

**Binding UI (GP §4.14):** capsules 112 visible + 150 hit (transparent `::after`, 19 px above and below), View / Activate 40 apart, title bar 160 with Back / Options capsules (the "Back" text stays visible: Q-B fallback, no HIDDEN exception needed), text ≥ 34 px and ≥ Medium in title case (G-TYPE m 1.87), body text ≥ 42 px (descriptions 3 lines max, meta one line), tabs one line (horizontal scroll kept) with the orange unbound-count capsule, 2 px separators. **Fix of a reachability bug found on the way:** with taller controls the sticky controller-image column (977 px) outgrew the 904 px scroller, so Poses / Haptics could never be reached; images now max 600 px (column 830). The single-column binding list and the blue "Select" tint were not built (identifying Select needs a T2 key; neutral capsules instead).

| Check | Command | Result | Evidence |
|---|---|---|---|
| G-AUD/SIZE/TYPE/OUTLINE/MOTION, binding app list | `gates vr:controllerbindingui --pre bind_apps_more.js` | **PASS** | `shots/p2_c5b_bind_apps.png` |
| same, binding list | `gates vr:controllerbindingui --pre bind_list.js` | SIZE/TYPE/OUTLINE/MOTION PASS; AUD 1 SHRUNK (a long description clamped to 2 lines) → clamp 3 (final re-run below) | `shots/p2_c5b_bind_list.png` |
| same, binding view | `gates vr:controllerbindingui --pre bind_view.js` | **PASS** (was SIZE 18, TYPE 84, OUTLINE 24, AUD 27 fails at the start) | `shots/p2_c5b_bind_view.png` |
| Now Playing mock, pad (focus on Bindings) and laser (hover on Exit, perf variant) | `gates vr:systemui --flags wp.c5b --mode pad\|laser --pre "window.__LGS_NP={…}, $(cat theme/vr/pre/np_states.js)"` | Mock: SIZE, TYPE, AUD PASS; every NP edge probe passes (panel, Resume, Exit: lobe, no top line). Page-level FAIL only from others' areas: `%{ControllerStatusRoot}` rims (P-42) and one 0.04 s transition (not in any theme file) → REQ to C1a | `shots/p2_c5b_np_pad.png`, `p2_c5b_np_mock.png` |
| AT-NP-VARIANTS (T2) | `js` in vr:systemui `--flags wp.c5b`: four mocks (normal, arcade, no-quit, perf; normal with two hidden modal siblings), keys read, children replaced, keys read after one rAF | Keys exactly `resume / bindings / video / [perf] / exit`; Exit label `rgb(255,66,69)` only when present; Exit `.gpfocus` label `--lgs-text-on-color` on the red fill; after the re-render every key back within one frame. **Flag off:** no key, no red label anywhere | scratch `npvar_on.json`, `npvar_off.json` |
| AT-T3 (capsule, dry) | `js` on `/library/app/620980` `--flags vrBindings,actionsDryRun --mode pad` | Capsule is the last child of `%{AppButtons}` ("Controller Bindings", 80 tall); laser click logged `direct` once, daemon replied `{ok, dry: true}` (nothing navigated); A handler opened Steam's ConfirmModal titled "Controller Bindings", B closed it (0 modals left). `.gpfocus` after B not verified (the handler was called directly) | — |
| D-pad on the action row | `js` (`L.pad` right ×6, left ×6) | Play → Play from → Configure Controller → Manage → **capsule** (Right stays); Left walks back the same way | — |
| Capsule gates | `gates main --route /library/app/620980 --only size,type,outline --flags vrBindings,actionsDryRun --mode laser\|pad` | pad **PASS**; laser: capsule clean, the only fails are Steam's 30 px private-app indicator (P-80, and P-08 against Manage): C5a's area. First runs found the capsule overlapping that indicator's hit box: fixed with a 72 px gap when the indicator is present | `shots/p2_c5b_gp_capsule_pad.png`, `_laser.png` |
| pad-bfs `/library/app/620980` | `pad-bfs --flags vrBindings,actionsDryRun` | Not usable this run: another agent's native session was on and most nodes were `untakeable` (Steam's own included); replaced by the D-pad walk above | scratch `bfs.json` |
| pad-bfs `/library/app/620980` (retry 11:20) | `pad-bfs --route /library/app/620980 --flags vrBindings,actionsDryRun --max 30` | 31 nodes; the capsule is reached (Manage → Right) and goes back (Left → Manage); Up → Back, Right → edge. FAIL overall from C5a's page (Last Played, the tab arrows, Post, Load More, three event cards unreached) plus two of mine: (1) the capsule's label changed mid-sweep (aria-label switched to SteamVR's "VR Controller Bindings" when the string retry landed) so it was keyed twice: **fixed**, no aria-label (the visible label is the name); (2) capsule Down → an event card whose Up returns to the card above it, not the capsule: Steam's spatial nav into the activity list (Manage's Down goes to Activity) | scratch `bfs2.json` |
| Binding list after the meta fix | `gates vr:controllerbindingui --pre bind_list.js` + `shot … p2_c5b_bind_list` | **PASS**; meta and descriptions wrap inside their entries (a one-line meta had run over the next entry and made the page scroll sideways; the gate did not see it, the shot did) | `shots/p2_c5b_bind_list.png` |

Not built / not run this session: the Steam Input page link (GP §4.12 step 2, AT-T3-ROUTE); AT-BIND-RETURN (a live deep link: `inputUI.OnShowAppBinding` calls `SetSelectedApp(key, true)`, whose second argument was not traced, so no real call was made without the dry-run logger on `controllerBindingStore`); the NP sheets. `vrBindings` therefore stays **off** and is not offered as ready (Q-A also requires AT-BIND-RETURN and AT-T3-ROUTE).

Native fragments: **none**, by design. `vr:systemui` and `vr:controllerbindingui` are SteamVR overlays with no glassd surface (no cover, plate or pop can be reported for them; PLAN 1.6 "T5 cover once systemui covers exist"), so their glass is the CSS look in both modes. The capsule is in-window content in C5a's action row, at 0 mm under C5a's window cover (PLAN 1.7: cluster over art stays 0 until G2 + AT-HV-OFFAXIS), so it needs no layer of its own.

### 2026-10-07, session 1: final Now Playing pass (11:15-11:25)

- Caption moved from the title to the info column (`data-lgs-np-cap` on `.InfoColumn`): inside the title's two-line clamp it took one of the title's lines ("Liquid Glass…"); long row labels wrap to two lines inside the 116 row (the perf row's chevron had been pushed out), left-aligned.
- Exit hover: one colour layer (stacked translucent layers drew a bright 1 px rim that failed the edge profile), no lit arc on the red fill.
- `np_states.js` option `waitKeys` (waits up to 4 s for the keyer the daemon injects a moment after the step's flags land; without it a shot can catch the unkeyed fallback).

| Check | Command | Result | Evidence |
|---|---|---|---|
| NP mock, perf variant, pad (focus on Bindings) | `gates vr:systemui --flags wp.c5b --mode pad --pre "window.__LGS_NP={focus:1,hover:-1,mock:'perf',keep:40000,waitKeys:true}, $(cat theme/vr/pre/np_states.js)"` | Mine: SIZE 9/9, TYPE, AUD PASS, every edge probe passes. Page FAIL only from C1a's controller-status rims and the 0.04 s transition (REQ above) | `shots/p2_c5b_np_final_pad.png` |
| same, laser (hover on keyed Exit) | same with `{focus:-1,hover:4,…}` `--mode laser` | Mine: PASS (after the single-layer fix); same two foreign findings | `shots/p2_c5b_np_final_laser.png` |
| Keyed look | `shot vr:systemui p2_c5b_np_exit_hover --flags wp.c5b --pre "…{focus:2,hover:4,mock:'perf',waitKeys:true}…"` | Viewed: caption, two-line title, green Resume with dark label, indigo / blue / grey chips, focused Video row lit (no ring), Exit red with dark label on hover. Unkeyed fallback also viewed (neutral Exit, no chips) | `shots/p2_c5b_np_exit_hover.png` |
| Leftovers | `js` in vr:systemui | no mock, no `__LGS_NP`, no hover sheet, no `data-lgs-np*`, `__LGS_VRX` absent with the flag off | — |
| Daemon | `/dev/shm/lgs/shell.json` | plugin types `vrbind`, `vrbind.strings` loaded, `failed` {}; one `vrbind.strings` `flag-off` rejection at install (flag race), covered by the 4 s retry | — |

Gamepad traversal on Now Playing is SteamVR's own (React's `.gpfocus`, Up/Down/A, B = Resume) and could not be driven without a scene app; the theme keeps the DOM order and the single vertical stack, so the order is unchanged.


### 2026-10-07, session 1: native check (P7 at M3)

- Attempt 1 (11:12): `native-session --step "sgcheck --route /library/app/620980 --flags vrBindings,actionsDryRun --json --out …" --step "hv c5b_gp --route /library/app/620980 --flags vrBindings,actionsDryRun --look"`. Waited 1048 s for `native.lock` (P7's `sg_native.py` and another area's session ahead), native on at 11:30 (glassd healthy, `lgsNativeOnMain` true), sgcheck ran, then my **local** client hit its own 1500 s `timeout` during the hv step and its buffered output was lost. The orphaned remote session (holding `native.lock`, waiting for `lab.lock`) was interrupted with SIGINT at 11:44 so its `finally` ran: it exited, released the lock, no `hv-*.png` left on the Frame, no look folder kept on the PC. Lesson for others: run `native-session` with `python -u` and no short local timeout.
- Attempt 2 (11:46, `python -u`, no local timeout): see below.
- Attempt 2 (11:46-12:01): got `native.lock` after ~15 min, then `lab: lock busy for 240 s` at setup (25+ steps queued on `lab.lock`), so native mode was never turned on ("nothing to undo"), exit 1.
- **Result: native check blocked by device contention, not by my area.** My area has no native fragments (see above), so there is nothing of mine for sgcheck to judge beyond C5a's cover; V1 should run `sgcheck --route /library/app/620980 --flags vrBindings` and `hv` once the queue drains.
