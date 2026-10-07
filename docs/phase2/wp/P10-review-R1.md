# P10 Lab and verification tools: independent review, round R1

Reviewer: independent adversarial review agent. Date 2026-10-07, 07:05-07:45 (Frame clock). Steam build 11094443.
Scope: everything the builder reported for P10 at M3 (the whole card: step options, check-theme, edge, gates, pad-bfs,
focus, motion, sgcheck, hv, cmp, ledger, conformance, native-session; TL-1..TL-6; contract `lab.md` §1-§10).

**Verdict: fix.** Six major findings and nine minor ones; no blocker. The acceptance tests the builder listed reproduce
(TL-2, TL-3, TL-4, TL-5 and TL-6 re-run, same numbers), and most commands do what the contract says. Three things
fail the card's purpose:

- the `motion` filmstrips do not show the frames they are labelled with;
- `gates` passes a visible closed outline;
- `conformance` and the `ledger` status report passes they did not measure.

Two robustness bugs can also break the lab's own safety rules: the lock helper is not exception-safe, and room frames
can be left on the Frame.

## 1. What was re-run

All live steps used the normal locked lab commands while about 20 other agents were working on the device. My own
test files went to a temporary folder and were deleted. No file in the tree was changed except this one. The device
was left in CSS-only mode with the theme on, no override or flag of mine, and no probe element.

| Test | Command | Result | Agrees with builder? |
|---|---|---|---|
| TL-2 focus | `glass.py focus --png shots/p2_window-nav_tabbar.png --pair store-vs-media=… --pair key-focus-vs-rest=…` | +58.5 and +42.5 (WN §13.1 revision 3 gives +58.7 and +42.5); exit 0 | yes. The card's "ΔL 40 ± 2" was the revision 2 render; the tool matches the current WN figures to 0.2 L |
| TL-2 edge | `glass.py edge` on anatomy (y 66, `--luma 709`), power (y 212) and sort (y 174) | Window 45.4 … −3.2 (WN 45 … −3); Power 66.9, 83.5, 98.2, 91.6, 60.0, 33.1, 16.9, 6.3 (WN 69 … 7, max diff 2.5); Sort max diff 2.9 | yes (± 3) |
| TL-3 | `glass.py pad-bfs --route /settings/system --budget 300 --out <tmp> --raw`, then `tools/p2/tl3_settings_pad.py --bfs <tmp>` (the `--bfs` form, so the P10 baseline was not overwritten) | pad-bfs PASS: 93 nodes, 485 moves, 171 s, 0 of 70 unreached, 0 irreversible, 1 slider pair untested. Same set as `settings-pad.js`: 45 = 45, 0 missing, 0 extra. Raw JSON deleted at once | yes |
| TL-4 | `python tools/p2/test_sgcheck.py`; `glass.py sgcheck --spec tools/p2/fixtures/sg_uncovered.json` | 13/13 fixtures flag exactly their rule; uncovered pop `FAIL R1 main/ghost`, exit 1 | yes |
| TL-5 | `glass.py hv p10rev_tl5`, then `ls` of `%TEMP%\lgs-hv`, `%TEMP%\lgs-hv-*`, `/tmp/lgs/hv-*`, `/tmp/lgs-shots` | metrics printed (auto rect not found, verdict withheld); nothing left on either machine. The frame was not viewed | yes for the plain command; see M5 for the native-session path |
| TL-6 | `python tools/p2/tl6_locks.py` | static review all "ok"; concurrent: B 9.3 s after A, C during A; PASS | the test passes, but it is a regex check and misses M4 and m1 |
| TL-1 (sample) | `gates main --route /library/home --stock --only type,motion`; `focus main --route /settings/system --mode pad --pairs tools/p2/baselines/focus_pairs_settings_sidebar.json`; `ledger --out <tmp>`; `check-theme` | gates ran on the stock UI and gave the theme back (`lgs-on` true afterwards); focus +50.9 / band +2.7 (builder +50.1 / +2.4); ledger 449 rows, 268/268 mapped, exit 0 (C1a has added SN-T1); check-theme PASS | yes |
| check-theme, negative (new) | `tools/p2/check_theme.py --root <scratch copy>` with an unclosed `{`, `@keyframes` outside `.nowrap`, a broken layer JSON, a broken `device/rt` file, an unterminated `%{` | all five flagged, exit 1; a `theme/_wip/` file ignored | — |
| Step options (new) | `glass.py js "<probe>" --flags wp.p10rev,p10revx=3 --mode pad --media reduce`, then the same probe without options | inside the step: flags true / 3, `lgs-input-pad`, `data-lgs-vr-mode=gamepad`, reduce true, 1 overlay; after it: no overlay, no class, reduce false | yes |
| motion (new probe) | `glass.py motion main --route /library/home --pre "<two 300×200 boxes: a WAAPI opacity 0→1 and a CSS opacity transition, linear>"`, 1000 ms and 300 ms runs; luma of each box per frame | **frames lag their label by about 100 ms**; see M1 | **no** |
| OUTLINE on Settings (new) | `glass.py gates main --route /settings/system --only outline,size --shot …`, plus a read-only `js` scan of `::before`/`::after` box-shadows | G-OUTLINE PASS with 0 findings while the capture shows a closed ring and a 1 px rim; see M2 | **no** |
| conformance fail-open (new, offline) | `conformance.run(["--route", "/library/home"], lab_conf=lambda a: None, …)` | 86 MANUAL, 3 BLOCKED, "must items failing: none", **exit 0**; see M3 | — |
| Lock re-entry (new, offline) | `lab.Lock` with `flock_wait` stubbed to time out once | `Lock.depth` stays 1, and the next `with Lock()` runs without taking any lock; see M4 | — |
| native-session (new) | `glass.py native-session --step "sgcheck --route /library/home" --step "hv p10rev_ns" --step 'js "<sleep 25 s>"'`, polling `/tmp/lgs/hv-*` on the Frame meanwhile | see §3 | — |

## 2. Findings

### Major

**M1. `motion` filmstrips are not frozen: every frame shows a state about 100 ms later than its label, and f = 0 is
a stale frame.** Files: `lab/lab_p2cmd.py:474-600` (AnimHold, `capture_frozen`, `motion`), `lab/lab_motion.js:40-57`.

- The probe: two boxes on `/library/home`, one with a WAAPI opacity 0→1 and one with a CSS opacity transition, both
  linear. Mean colour in each box per frame:

  | Frame label f | 1000 ms run: box A red / box B green | 300 ms run: red / green |
  |---|---|---|
  | 0 | 18.9 / 75.8 (= the background: nothing drawn) | 16 / 76 |
  | .15 | 79 / 121 (≈ f .25) | 125 / 157 (≈ f .47) |
  | .35 | 126 / 156 (≈ f .45) | **255 / 255 (end state)** |
  | .5 | 162 / 183 (≈ f .60) | 255 / 255 |
  | .75 | 219 / 227 (≈ f .85) | 255 / 255 |
  | 1 | 255 / 255 | 255 / 255 |

- The geometry rects that `seek()` returns are read in the same JS tick, so they are right. The captures are not.
  The CDP `Animation.setPlaybackRate 0` hold does not stop the clock between the seek and `Page.captureScreenshot`,
  and the f = 0 capture returns a frame from before the pre: C1c's menu run shows the previous route at f = 0.
- With the motion tokens (210-488 ms for most interactions) the frames from about f = .35 on are the end state.
  C1c's menu run wrote byte-identical PNGs for f = .15 to 1, and the same happens in the builder's own stock run
  (`p2_motion_p10_stock_settings_focus_{0.5,0.75,1}.png` share one MD5).
- G-MOTION's filmstrip verdicts ("glass before content on entry", "no text scaling", P-18's first frame) and every
  package's motion evidence depend on this. Open request C1c->P10 (`wp/C1c.md`) reports the same.
- Fix:
  - Right after the pre, pause every animation in the surface: `a.pause()` for each of `getAnimations()`, or CDP
    `Animation.setPaused` on the ids reported by `Animation.animationStarted`.
  - Seek with `currentTime`, then wait two `requestAnimationFrame`s in that window before each capture. Do the same
    once before the f = 0 capture.
  - Add this two-box probe as a P10 self-test that checks the luma ramp with linear easing.

**M2. G-OUTLINE passes a visible closed outline: the sweep never looks at `::before` / `::after`.** File:
`lab/lab_gates.js:309-375`.

- `outline()` reads `border`, `outline` and `box-shadow` of elements only. The theme draws most of its glass panes,
  selection fills and P4's `--lgs-edge` on pseudo-elements, and in that case the element itself is not glass either.
  The element has no fill, so no edge probe is placed.
- Live, `/settings/system` (07:22, build 11094443): `gates main --route /settings/system --only outline` gives
  **G-OUTLINE PASS, 0 findings, 1 edge probe**. A read-only scan of the same page found two rims that the sweep misses:
  - The active sidebar row's `::before` has `box-shadow: 0 0 0 2px rgba(0,0,0,.35)`: a closed ring. In the capture,
    the row's top edge reads 196 → 172 → 199 L and its bottom edge 237 → 186 → 237 L (x = 300 shot px). At 3× the
    ring is plainly visible all round the "System" capsule.
  - The sidebar pane is `PageListColumn::before`, with `box-shadow: var(--lgs-glass-rim)`:
    `inset 0 1px 0 rgba(255,255,255,.40)`, `inset 1px 0 0 …` and `inset -1px -1px 0 …`. That is a 1 px rim on all four
    sides. Its left side reads +29 L over the pane at x = 12 shot px (row y = 300: 22 → 86 → 57).
- These come from Phase 1 rules in `theme/60-settings.css` and `00-tokens.nowrap.css`, which are other packages'
  files. But the gate meant to catch exactly this "skin" (P-42, P-43, AT-23, the user's "no outlines" bar) reports
  PASS. `conformance` P-42 and P-43 reuse the same DOM part.
- Fix:
  - Apply the border, ring and line checks to `getComputedStyle(el, '::before' | '::after')` whenever `content` is not
    `none`, using the pseudo-element's box (the element's rect inset by `inset` / `top` / `left`).
  - Count a 1-2 px inset or offset box-shadow with 0 blur as a line (P-43), not only 0-offset spreads.
  - Probe the edges of pseudo-element panes too, and probe all four sides of a closed shape, not only the top.

**M3. `conformance` fails open: a route that returns nothing silently drops out, and with no data at all it exits 0.**
File: `tools/p2/conformance.py:176-189` and `merge()`.

- When `lab_conf` returns `None` (lab lock busy for 240 s, SharedJSContext error, device unreachable),
  `per_route[r] = {}`. The items then fall through to MANUAL with no mention of the route.
- Offline proof: with every route empty, the output is "counts {'MANUAL': 86, 'BLOCKED': 3}; must items failing:
  none", and the exit code is 0.
- V2 runs this for M5 and REPORT.md. An unreachable device must not read as a pass.
- Fix: a route without a result makes every automatable item BLOCKED with the reason, and the command exits 3.
  Print the failing routes.

**M4. `Lock` is not exception-safe, so one lock time-out turns off locking for the rest of the process.** File:
`lab/lab.py:156-169` (and `Step.apply`, 471-519).

- `__enter__` increments the class counter `Lock.depth` before `flock_wait` and `Step.apply`. If either raises
  (`lab: lock busy for 240 s`, or a CDP error in `apply`), `__exit__` never runs and `depth` stays 1.
- Every later `with Lock()` in the same process sees `depth > 1` and returns without taking any lock and without
  applying step options. Offline proof: after one stubbed time-out, the second `Lock()` body ran with
  `flock_wait` never called again.
- This is the normal case in `native-session`: its steps run in one process, `_call` swallows the `SystemExit`, and
  long `pad-bfs` or `conformance --pad` runs hold `lab.lock` for over 240 s. After one busy step, the remaining
  steps and the return to CSS run unlocked, under other agents' steps (PLAN §7 rule 1).
- When `Step.apply` raises after writing `/tmp/lgs/flags.json`, or after turning the theme off for `--stock`, nothing
  restores them (PLAN rule 9: no flag left on).
- TL-6's static check cannot see this.
- Fix: wrap the body of `__enter__`. On any exception, decrement `depth`, call `step.undo()` if the step was
  applied, release the files already taken, then re-raise.

**M5. Room frames from `hv` steps in a `native-session` (and from any interrupted fetch) wait on the Frame until the
session ends, and are left there if `glass.py` dies.** Files: `glass.py:73-82` (`sh` reads all output at the end),
`glass.py:278-315` (`lab_fetch`), `lab/lab_p2cmd.py:90-91, 202-244`.

- `hv_grab` writes `/tmp/lgs/hv-<pid>-<n>.png` and prints `@@hv`. `glass.py` only parses that line after the
  remote command exits, because `sh()` does `out.read()` to EOF. In a session the room frame therefore stays on the
  Frame for every later step: minutes, against LAB's "look, then delete at once".
- If `glass.py` is killed meanwhile, nothing deletes the frame. Agents' shell tools time out after 2-10 min, and a
  session may first wait up to 30 min for `native.lock`. The remote lab process then hits a broken pipe on its next
  print, and the frame stays until someone runs `hv --clean` or the Frame reboots.
- The same applies when an earlier `@@file` fetch raises inside `lab_fetch`: the later `@@hv` lines are never
  handled.
- The never-list forbids keeping room frames. This is a code path, not an observed leak; §3 shows the frame
  waiting during a session.
- Fix:
  - Measure and delete on the Frame side as soon as `hvgrab` returns. The metrics need only numpy, which the Frame's
    python may lack; otherwise stream stdout line by line in `lab_fetch` and fetch each `@@hv` at once.
  - Have `lab.py` delete any `/tmp/lgs/hv-*.png` older than 60 s at the start of every command and in
    `native_session`'s `finally`.
  - Wrap `lab_fetch`'s per-line handling in `try/finally`, so a failed fetch still deletes the remaining
    announced files.

**M6. The ledger's `status` column marks functions as tested from unrelated PASS lines.** File:
`tools/p2/ledger.py:137-156`.

- `status()` accepts any line, in any `wp/*.md`, that contains "PASS" and the test id. Test ids are per concept
  (WN AT-6, HA AT-6, CTL C6 …), and many are generic (G-PAD, E-BACK, A3). From the current tree:
  - `LA-L5` "Open a game" (home-apps, owner C2c, test `AT-6`) is **pass** because C1a's WN AT-6 line (the bottom
    ornament's footer) says PASS. LA-L1, L2, L9, LA-T2…T7 and LA-H6…H8 likewise.
  - `SN-N4` (test "CC A3–A6") is **pass** from P4's FD-7 line, which mentions "A3" in a list of DESIGN2 tags.
  - `LA-L10` Back ("WN AT (E-BACK)") is pass from a C1a AT-22 line that lists E-BACK among attributes.
- PLAN §4.5 point 2 is judged from this column ("either a passing test or … a static check"), so the ledger can
  certify retention of a function nobody tested.
- Fix:
  - Resolve each id in the row's own namespace: the concept's prefix, or the owner package's log.
  - Accept only an evidence-table row whose first cell is that id (or starts with it), in the owner's
    `wp/<OWNER>.md`.
  - Treat gate names (G-PAD …) as needing the route in the same line.

### Minor

- **m1. Lock domains in `--flags` and in conformance.**
  - `Step` writes `/tmp/lgs/flags.json` under whichever lock the step holds, so a `lab.lock` step and a
    `lab-vr.lock` step can overlap on it. Example: A (none → `{a}`), then B (`{a}` → `{a,b}`); A exits and deletes the
    file, B exits and restores `{a}`. `a` stays on until `lgs off`.
  - `conformance` (`lab_p2cmd.py:777-785`) reads `__LGS_SG.dump()` in `vr:systemui` holding only `lab.lock`.
  - Guard the flags file with its own `flock`, and restore by removing the step's own keys. Take both locks in
    conformance when it reads systemui. TL-6 should check what each command touches, not that `with Lock(` appears.
- **m2. Evidence taken during someone else's native session is labelled CSS-only.** `native-session` releases the lab
  locks between steps (by design), so other agents' CSS-tier steps run while native mode is on. Neither `stamp()` nor
  the `step:` line records the native state. Add `native: on|off` (from `lgs_shell.status()`) to both.
- **m3. `gates_finish` uses any process's capture** (`glass.py:318-346`). It measures the newest
  `shots/_gates_tmp_*.png` of any process and deletes them all. A `main` run and a `vr:` run, which take different
  locks, can finish together and swap or lose captures. A missing capture then gives OUTLINE 0 edge probes and still
  PASS. Use the name announced in `@@file`, and make a missing capture an error.
- **m4. `hv --look` is unreliable, and a withheld verdict exits 0.**
  - The shared `%TEMP%\lgs-hv` is wiped by every `glass.py` command of every agent (`glass.py:809-810`). With
    commands every few seconds, the look step often fails; P9's reviewer lost two of three frames this way.
  - Without a look there is no `--rect`, so G-HV gets `pass: null` and exit 0.
  - Use a per-invocation folder that the same agent's next command, or a 120 s timer, deletes. Exit 3
    ("BLOCKED: verdict withheld") when no rect is known.
- **m5. Conformance's depth items can never run, though its output says how to run them.** `native-session`'s
  `finish_results` (`glass.py:706-738`) has no `conf` case, so `--step "conformance …"` prints a raw `@@conf` JSON
  blob. Yet the BLOCKED text says "run conformance as a native-session step", and the "31 automated" count includes
  P-11, P-46, P-47, P-48 and P-51. Either finish `conf` results inside the session, or document that these come from
  `sgcheck`.
- **m6. G-TYPE checks only the 18 px floor.** VP P-38 also requires body text ≥ 22 px.
- **m7. Three requests to P10 are open,** although the Status says "nothing else pending":
  - C1a #99: the helpers keep a stale `__LGS_INDEX`.
  - C1c: the motion filmstrips (= M1).
  - C2a #9: P-08 on partly visible controls.
- **m8. `pad-bfs` runs its `--pre` through `lab_js`,** so `@hover` and `--hover` do not work there, unlike `gates`,
  `focus` and `cmp`. `glass.py --help` lists none of the Phase 2 commands.
- **m9. Lab screenshots go to `/tmp/lgs-shots/`, outside `/tmp/lgs`** (hard rule 7; P1's persistence scan lists it as a
  known exception). `tools/p2/tl3_settings_pad.py` leaves an empty `tl3-*` folder in `%TEMP%`. Both are trivial.

## 3. native-session check

Command: `python glass.py native-session --step "sgcheck --route /library/home" --step "hv p10rev_ns" --step 'js
"(async()=>{await L.sleep(25000); return 1})()"'`, run 07:24-07:25 with `native.lock` free. A poller listed
`/tmp/lgs/hv-*.png` on the Frame every 3 s.

- The native layer came up, all three steps ran, and the session reported "back to CSS only: yes". Afterwards
  `shell status` showed css-only and `lgs-native` was absent from main.
- sgcheck in the session found 27 scene-graph nodes and 5 pops on main, at depths 0, 3.0, 4.5 and 5.5 mm. Every pop
  failed R2 (dz not in {0, 10, 15, 25} mm): `hdr-back`, `tabs`, `tab-arrow` ×2 and `card`. These are the legacy
  Phase 1 pops, as in the builder's baseline, and the exit code was 1 as it should be.
- hv: glassL 68.1 on the auto rect, with the verdict withheld (`pass: null`; see m4). The frame was not viewed.
- **The room frame `/tmp/lgs/hv-144814-92162.png` sat on the Frame from 07:24:52 until the session ended (it was last
  seen at 07:25:13, while the 25 s step was running).** This confirms the first half of M5. After the session it was
  deleted on both machines. `native.lock` was free again, and nothing was left in `%TEMP%\lgs-hv`.

## 4. Checklist

| Item | Result |
|---|---|
| (a) Ownership | Code changes are in P10's patterns (`glass.py`, `lab/**`, `tools/p2/**`, `contracts/lab.md`, `wp/P10.md`, `wp/P10-cmp.json`). In other packages' logs only "P10 (…)" answer lines were added. REQ P10->P7 was closed by P10 itself, with "P10 (06:20): both are in `device/lgs_sg.js`". The hooks are P7's (P7.md line 11 lists `test.yaw`), so the closure is right, but the owner should close it |
| (b) Safety | The never-list holds in what I ran: pad-bfs presses only the D-pad and one B, and refuses Left/Right on sliders; the action logger is on in every Steam step. Risks: M4 (unlocked steps), M5 (room frames), m1 (a flag left on). Nothing autostarts; the `hvgrab` build is code in the install folder |
| (c) Robustness | M3, M4, m3 and m4 fail open. No timers or listeners are left in Steam's pages: the lab JS has no `setInterval`, `MutationObserver` or `addEventListener`, and `__LGS_BFS` is deleted at finish. Nothing runs at idle |
| (d) Conformance | P-items in P10's area are the gates' fidelity: P-42 and P-43 miss pseudo-elements (M2); P-38's 22 px body rule is not checked (m6); the depth items cannot run through conformance (m5); the P-items from motion filmstrips are unreliable (M1) |
| (e) Function retention | The ledger maps 268/268 audit functions with both paths, but its status column overstates tested functions (M6) |
| (f) Visual quality | The `cmp` composites are clear: side by side, labelled, rects outlined (`p2_cmp_c1c_window-nav-menu.png` viewed). The motion strips misrepresent motion (M1). G-OUTLINE passes a ringed selection capsule on Settings (M2) |

Incidental, not P10's: on `/settings/system` the window header's "Back" capsule (C1a) sits on top of the first Settings
sidebar row ("System"). The 07:22 capture shows them overlapping. Reported here for C1a and C6a.
