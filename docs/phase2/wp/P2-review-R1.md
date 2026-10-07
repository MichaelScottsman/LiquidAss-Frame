# P2 Steam React framework: independent review, round R1

Reviewer: independent adversarial review agent. Date 2026-10-07, 11:29 to 11:56 UTC (all times here are UTC, as in
`wp/P2.md`; the Frame's local clock is UTC−4). Steam build 11094443.
Scope: the builder's M3 / "complete" report for P2 (RX-1 to RX-7, the five extra lab tests, the kill switch, the
contract v2, the error page). Code under review: `device/rt/02-react.js` md5 `b5e1acc3…`, `device/rt/03-react-lab.js`
`ebe27c13…`, identical on the PC and the Frame (11:29).

**Verdict: fix.** Three major findings and six minor ones.

What holds up:

- **Every acceptance test reproduces** on the live device, in one locked step each, including RX-3 under
  `--mode laser` and `--mode pad`.
- **Removal is clean** through P1's real path. I turned the `react` flag off while a route, an override, a memo patch,
  a bare-function patch and a menu were all live. Nothing of ours was left in 3531 fibers, Steam's `jsx` and
  `createElement` were the originals again, and our only history listener was removed (1 listen, 1 unlisten).
- **Actions never run during tests.** All six spies installed and none was called.
- **The overhead is small.** The scan took 144–156 ms on a busy device, the jsx substitution costs about 0.03 µs per
  element, and a refresh walk takes 0.3 ms. Nothing runs at idle.

What fails:

- **The gamepad path for launches.** Pressing A on Steam's `DialogButton` or `MenuItem` hands the handler an untrusted
  `click` PointerEvent. P2 classifies that event as a lab click, so the action is only logged, even when
  `actionsLive` is on (M1).
- **`optional` patches.** An optional patch never attaches when it is the module's only registration, so the
  contract's "keeps looking on navigation" is false (M2).
- **The error page layout.** On a real route the error page collapses to the window's left edge. The builder's shot
  was taken inside the lab route, whose own CSS centres it (M3).

---

## 1. What was re-run

Every live command ran as `python glass.py js [--flags reactLab] [--mode m] "<expr>"`: one locked step, the action
logger on (P10). Scripts longer than one line were kept in the reviewer's scratchpad (`remove_test2.js`,
`padevent_test2.js`) and passed as one line.

| Check | Command / method | Result | Agrees with builder? |
|---|---|---|---|
| Files on the Frame = tree | `md5sum` of `02-react.js`, `03-react-lab.js`, `00-rt.js` on both machines (11:29) | identical | — |
| Start state | `__LGS_RT.status()` + `react.status()` (11:29) | `react` installed, **unscanned** (`ready: false`); no routes, overrides or patches; `react-lab` off; class index 550; actions `test` (logger on, `actionsLive` not true) | yes |
| **RX-1** | `run('RX-1', L)` (11:30:33) | **PASS** 19/19, 19/19; `patchedLeft 0`; page and routes gone; route restored | yes |
| **RX-2** | `run('RX-2', L)` (11:34:37) | **PASS** 6/6: 1 `simplememo`; `rerender` forced it through its observer (1 wrapper call); barpopup 51/51 and bar 13/13 unchanged; `patchedLeft 0` | yes |
| **RX-3** laser / pad | `--mode laser`, then `--mode pad`, `run('RX-3', L)` (11:35, 11:36) | **PASS** 8/8 both. Nodes 843 → 841 under the modal: the 2 nodes are Steam's focus-dependent ones, and the count is back to 843 after close; `.gpfocus` in the modal; B closes it; focus back on the same poster (app 202750, app 1147940) | yes |
| **RX-4, RX-5, RX-6, RX-7** | one step, `run()` each in turn (11:36:32) | **PASS**. RX-4 3/3. RX-5 4/4 (`cannot find Focusable (fail closed; T3 off)`, sticky, nothing patched). RX-6 146, 144, 144 ms; cached 0.1 ms. RX-7 16/16; **`spies: [true ×6]`**, 0 spy calls, route unchanged, the runtime log has every call | yes |
| **RX-OV, RX-HEAL, RX-FN, RX-TARGETS, RX-REMOVE** | one step (11:37:42) | **PASS** 8/8, 3/3, 5/5, 6/6, 6/6. RX-REMOVE report: `patchedLeft 0`, restored 4, route `/library/lgs/lab/remove` → `/library/home` | yes |
| Achievements override, against stock (new) | stock `/library/app/2379780/achievements` vs an identity-wrapper override, 3 s each (11:40) | 57 vs 58 nodes: the override adds only its wrapper. RX-OV's "9 nodes of Steam content" is simply what this page shows | — |
| Finders (new) | `ready()` + `status().finders` (11:48) | 25/25 found, each with exactly **1** candidate; 2618 factories; scan 156 ms; no `null` re-export | yes |
| **Removal through P1's real path** (new) | `remove_test2.js` (11:42). Live: a route (on it), a `/library/home` override, plus-button memo patch, PagedSettings `fn` patch, one `ui.menu`. Then `__LGS_RT.test.flags.push({react:false})`, which runs `removeRec`, the code `lgs off` runs. Steam's `history.listen` was wrapped for the step only, to attribute listeners | **PASS**: module `off` (flag react is off). Route left to `/library/home`, menu closed, `__LGS_RT.react` gone, `exposed: {}`. Sweep: **0** of our functions in 3531 fibers (4 while live). `jsx`/`jsxs`/`createElement` are the originals. P2's history listener: 1 listen, **1 unlisten**. After the pop: re-installed, unscanned | builder tested `test.cycle()`; not the runtime path |
| Overheads (new) | jsx 100 k elements, plain vs hooked; `h.refresh()`; a `fiber.walk` (11:42) | 4.3–6.4 vs 5.1–9.3 ms per 100 k elements; refresh 0.2–0.3 ms; full walk 0.3 ms over 2976 fibers | — |
| **Optional patch, late attach** (new) | `appButtons` with `{optional:true}` registered on `/library/home` (not mounted there), then a navigation to `/library/app/2379780`; then the same with an unrelated `routes.add` live (11:39:51) | **FAIL**, M2 | builder had no test |
| **Gamepad A event shape** (new) | `padevent_test2.js` (11:47): our own page with a Steam `DialogButton` and a `Focusable`, A through `FocusNavController.DispatchVirtualButtonClick(1)`, then synthetic clicks; also A on our own `ui.menu` item (11:49) | **FAIL**, M1 | builder had no test |
| **Error page on a real route** (new) | `routes.add('/library/lgs/revboom', Boom)` + `shot main p2rev_failroute` (11:44). The shot was moved to the reviewer's scratchpad at once, not kept in `shots/`. Also the same page through the lab route, `p2rev_failpage` (11:43, scratchpad) | **FAIL**, M3 | builder shot only the lab case |
| Error page input paths (new) | `--mode pad` (11:43, 11:45): enter 3× with 2.5 s settles; `FocusApplicationRoot`; B; synthetic click on Back. Control: a page with an autoFocus `DialogButton` | Back focused on every entry (3/3, same as the control); B → `/library/home`; click → `/library/home`; Back is 240 × 60, radius 30, `outline: none`, border 0 | yes |
| Layering on the named targets (new) | two `byProps` layers on each of `appButtons`, `pagedSettings`, `statusPill` (11:56) | `pagedSettings` and `statusPill` layer. `appButtons`: the second layer **throws** (m2) | builder had no test |
| `lab.open` of a throwing fixture (new) | `--flags reactLab`: `lab.fixture('boom2', throwing)`, `open`, `close`, then `open('buttons')` (11:53) | throwing: `{mounted: true, nodes: 5}` with no `error` field. `buttons`: `{mounted: true, nodes: 4}`. The two results look the same (m3) | — |

---

## 2. Findings

### M1 (major) A gamepad A on a Steam `DialogButton` or `MenuItem` is classified "synthetic", so actions wired to Steam's standard controls never run from the gamepad

**Evidence** (11:47, `--mode pad`; our own route; A through `FocusNavController.DispatchVirtualButtonClick(1)`, the
controller-level entry point the real controller's input also goes through):

| Control, input | Event the handler receives | `actions.mode(e)` has "synthetic pointer event" |
|---|---|---|
| `DialogButton` `onClick`, gamepad **A** | `click`, native `PointerEvent`, `isTrusted: false`, `pointerType: ""`, `pointerId: -1` (an `HTMLElement.click()`) | **yes** |
| `ui.menu` item (Steam `MenuItem`) `onSelected`, gamepad **A** (11:49) | the same untrusted `PointerEvent` `click`, `pointerType: ""` | **yes** |
| `Focusable` `onActivate`, gamepad A | `vgp_onok` `CustomEvent` | no |
| `DialogButton` / `Focusable`, lab synthetic click | `click`, native `MouseEvent`, untrusted | yes (intended) |

`02-react.js:970-974` (`untrustedPointer`) treats any untrusted event whose type starts with `click` as a lab click.
`testReasons()` then always adds "synthetic pointer event", so `act()` only logs. This does not depend on
`actionsLive`, so it stays true at release.

**Impact.**

- Contract §8 tells callers to pass `ev` (`primary` even uses `ev.currentTarget`'s window). Contract §0 rule 5 and
  §3 point callers at `DialogButton` and `ui.menu`.
- Any T3 launch built that way has a laser path but **no gamepad path**:
  - C1b's "Open" and the Software cell (HA S-B, `actions.launchNonSteam(cmdline, ev)`);
  - C2b's launcher rows;
  - a menu item that calls `actions.primary`.
- The plan's own tests cannot see it:
  - RX-7 never activates a real Steam control;
  - HA AT-4 and AT-13 expect `logged` anyway;
  - the PLAN §4.5 ledger accepts a static handler identity.
- C2a's current code happens to be safe: it uses `Focusable.onActivate` and gamepad-button callbacks.

**Required fix** (`02-react.js`, `03-react-lab.js`, `contracts/react.md`):

1. Stop treating Steam's own programmatic activation as a lab click. One option is to exempt an untrusted
   `PointerEvent` `click` with `pointerType === ''` (Steam's `.click()` on gamepad OK). The lab's `L.click` and the
   RX helpers dispatch `MouseEvent`s.
   - Locked steps stay in test mode through the action logger, which P10 turns on for every step.
   - Equivalent fix: mark lab-dispatched events and make the marker the synthetic test.
2. Add an RX-7 case that presses A on a `DialogButton` and on a `ui.menu` item on the lab page. It must assert that
   `actions.mode(e).reasons` has no "synthetic pointer event".
3. State the rule in contract §8.

### M2 (major) `patch.byProps(…, {optional: true})` never attaches when it is the only registration

**Evidence** (11:39:51, one locked step; target `appButtons`; nothing else registered):

| Phase | `findAll(appButtons)` | handle |
|---|---|---|
| On `/library/home`, optional patch registered | 0 | `count 0, pending: true` (as specified) |
| After `nav.go('/library/app/2379780')` + 2 s | **1** (mounted) | **`count 0, pending: true`, 0 wrapper calls** |
| Same, with an unrelated `routes.add('/library/lgs/rev')` live | 1 | `count 1`, `fwd`, 4 wrapper calls |

**Cause.** `syncWatchers()` (`02-react.js:448-467`) installs the history listener and the `rt.windows.onAdd`/`onShow`
subscriptions only while `routes || overrides || targets.some(needsRefresh)`. A pending handle is in `S.handles`,
not in `S.targets`. `_attach` calls `syncWatchers()` on the optional path (line 669), but that call installs
nothing. So "keeps looking on navigation" (contract §5.1, §10) holds only when another registration happens to
exist.

**Impact.**

- The two targets that are mounted only on their own routes need `optional`: `pagedSettings` (C6a, SET P-S1) and
  `appButtons` (C5a, GP AT-T3).
- Their T3 patch silently never applies when it is the module's only registration.
- When another package's registration exists (for example a Home override), the patch does attach. So the result
  depends on which `wp.*` flags are on: a package passes or fails depending on other packages.
- No RX test covers `optional`.

**Required fix** (`02-react.js`):

1. Count pending handles in `syncWatchers()`'s `any`.
2. The history listener fires before React renders the new route. For a pending handle, also retry once the
   navigation has committed: a scoped `rt.setTimeout` of about 300 ms with a bounded number of attempts.
   - On the game page it attached only because Steam happens to issue five `REPLACE` navigations in the first
     second (11:55, history trace).
3. Add a lab test: an optional patch alone, a navigation to the target's route, then `count 1` within 1 s.

### M3 (major) The error page collapses to the window's left edge on a real route; the evidence shot hid it

**Evidence** (11:44, `routes.add('/library/lgs/revboom', Boom)`, `shot main p2rev_failroute`, viewed and moved to
scratch):

- `.lgs-react-fail` is `[x 0, y 40, w 426, h 640]` inside a 1280-wide parent.
- The title "This view could not be shown" starts at **x 0**, against the window's rounded edge.
- The Back capsule sits at x 93 to 333.
- The content centroid is near x 213 against the window centre 640. That misses VP P-30 (within ±160) and P-36
  (balanced insets).

The same page through the lab route (`p2rev_failpage`, 11:43) is centred, identical to the builder's
`shots/p2_p2_failpage.png`. It is centred only because the lab's own `.lgsx-lab` rule
(`position:absolute; inset:0; display:flex; align-items:center; justify-content:center`) centres whatever is inside
it.

`ui.ErrorBoundary`'s fallback is the case it exists for: a T3 route or a `ui.Page` whose content throws. There it is
drawn by `FailPage` (`02-react.js:810-821`), whose root `Focusable` has `display:flex; flex-direction:column;
align-items:center; height:100%` but no width. In GamepadPage's row container it shrinks to its content.

**Required fix** (`02-react.js`):

1. Give the `Focusable` `width: '100%'` (or `position:absolute; inset:0`, as the lab does), with a horizontal inset of
   at least 48 px for the title.
2. Re-shoot it on a real `routes.add` route, not on `/library/lgs/lab`.
3. Optionally, add a lab check that the fail page's centroid is within ±160 px of 640.

### m1 (minor) The release switch `actionsLive` has no hand-off

- D-P2-1 keeps every T3 action dry-run until "V1 sets `actionsLive: true` in `device/defaults.json` at release".
- Nothing carries that to V1:
  - no REQ to V1 or to the coordinator;
  - no row in PLAN §1.17's register;
  - no item in the §4.6 release checklist.
- The plan's checks would all pass with every T3 launch dead: HA AT-4 and AT-13 expect `logged`, and the §4.5 ledger
  accepts a static identity check.
- With M1 fixed, this flag is the only thing between the shipped build and dead launch buttons.

**Fix:**

1. File a REQ to the coordinator to add an S-row (`actionsLive`, default false during the build, true at release)
   and a §4.6 item.
2. File a REQ to V2 for a shipped-state check: no lab step, `__LGS_RT.react.actions.mode().mode === 'live'`.

### m2 (minor) `targets.appButtons` stops matching once it is patched, so a second layer throws

- Before patching, `findAll(appButtons)` is 1. After the first layer it is **0**.
- A second `byProps(…, targets.appButtons, …)` throws `nothing matches (fail closed)` (11:56).
- Cause: the predicate reads `fnSrc(f.type)`, which returns our trampoline's source once `.render` is swapped.
- `pagedSettings` and `statusPill` layer correctly. Contract §5.1 promises layering for every target.

**Fix:** make `fnSrc` unwrap `__lgsOrig` (`baseFn`), which also fixes callers' own source-based predicates.

### m3 (minor) `lab.open()` never reports `error`; a throwing fixture looks mounted

- Contract §9 says `open` resolves `{mounted, error}`. The code returns `{mounted, route, nodes}`.
- A fixture that throws gives `mounted: true, nodes: 5`, which looks like success. The `buttons` fixture gives
  `mounted: true, nodes: 4` (11:53).
- SM §8.3 (C7) must label a fixture that throws "unverified". With this result it would count it as verified.

**Fix:** return `error` (the boundary's caught error, or the presence of `.lgs-react-fail` inside `.lgsx-lab`). Set
`mounted: false` in that case.

### m4 (minor) A failed `ready()` is sticky for the whole context, including transient causes

- `ready()` caches `S.error` until `reset()`, which is for tests only.
- Two failures can come from a transient state rather than a Steam change: "main route switch not found" and
  "no React fiber in the main window". This happens when the first scan runs while Steam's UI is still mounting,
  for example on the re-injection after a SharedJSContext restart that broke P1's class index (REQ P2->P1; P1
  review M1).
- In that case T3 stays off for the whole session until the next `lgs on`. This was not observed live.

**Fix:**

- Keep a missing *required finder* sticky.
- Retry the switch and fiber lookups with a short backoff (2, 4, 8 s) before failing for good.
- Coordinate with P1 so that consumers whose `install()` threw get one more try once `react` is ready.

### m5 (minor) Error page polish

- The title is 32 px / 600, which is not a DESIGN2 style. Alerts and empty states use Title 3 (28 / 600); Title 2 is
  30 / 700.
- Colours and sizes are inline literals (`#fff`, `24px`), not tokens.
- With Steam's header present the page shows two "Back" controls. That is acceptable, but the content one could
  drop the duplicate label.
- Back itself is right: a 240 × 60 capsule, radius 30, no outline or border, focused on entry, and B and click both
  work.

### m6 (minor) Contract and evidence nits

- `rt.react.version` is still `1`. Contract §1 says it is "bumped on every contract-visible change", and v2 changed
  `ui.modal`'s return value to a Promise.
- Contract §9 says "four" extra runners and then lists five.
- Evidence rows say "JSON" or "JSON in this log", but no JSON is in the log or the tree. The builder's `rx.py` and
  its outputs lived in a scratch folder. PLAN §7.7 asks for the JSON's name.
- "Both input modes" ran with the class-only stub (P3's `rt.input` was off), which changes nothing P2 reads. The
  real two-path coverage is RX-1's laser click and its D-pad / A / B steps. That is fine, but the log should say it.

---

## 3. Checklist (a)–(f)

| Item | Result |
|---|---|
| (a) Ownership | **OK.** The seven files in `filesChanged` are P2's, except `wp/P1.md`. There the only P2 edit is the sanctioned answer to REQ P1->P2 (`- [x]` plus one line, PLAN §2.6). The two shots are new `shots/p2_p2_*` files |
| (b) Safety | **OK.** No storage, network or file writes in either module. Runtime state is only in SharedJSContext's heap; `/tmp/lgs/p2` holds one 92 KB scratch script from session 1 (RAM). Removal through the runtime's own path leaves nothing (§1). Never-list: tests act only on our own page, menu and modal, open the "+" popup with the OPEN recipe, and RX-7 replaces six Steam launch calls with spies. Every step ran under `lab.lock` |
| (c) Robustness | Fail-closed scan (RX-5), removal, no leftover listeners, nothing at idle: **OK**. Broken: optional late attach (**M2**). Gaps: sticky transient failure (m4), layering on `appButtons` (m2) |
| (d) Conformance (P-xx for P2's surfaces) | Pass: P-20 to P-24 (Back focused on entry, B closes the topmost layer, focus returns to the source after a modal: RX-3), P-38, P-42/P-43 (no outline or border on Back), P-80/P-83 (60 px capsule, radius 30), P-82 (Back in content, not chrome), P-89 (the footer's B Back is also a visible button). **Fail: P-30, P-36 on the error page (M3).** Type ramp: m5 |
| (e) Function retention | Laser path for actions: trusted click → live (code, contract). **Gamepad path: dead for `DialogButton` and `MenuItem` callers (M1).** `Focusable.onActivate` and gamepad-button callbacks are fine. Release switch with no hand-off (m1) |
| (f) Visual quality | The only user-facing surface is the error page. Its material is right (no outlines; the focused capsule is a fill), but the layout is broken on real routes (M3) |

## 4. Observations (no action needed from P2 in this round)

- Like P1's index harvest (P1 review M1c), `findIn` `require`s its candidate modules. With 25 finders at one
  candidate each, all already loaded at the time of the scan, the exposure is small. Callers' own `find()` specs add
  candidates, so keep the "exactly one candidate" rule strict for them.
- Self-healing listens on the history of the main window instance it saw at registration. If Steam ever replaced
  `VRGamepadUIMainWindowInstance` within one renderer's life, the listener would be stale. Not observed.
- The builder cleared the runtime's whole session flag layer by hand (`setSession({})`) during the flag race it
  reported to P10. That restored the device, but it could also have dropped another agent's legitimate session
  flags. P10's lock-exit fix now covers the race.

## 5. Device left (11:55)

- Theme on, CSS-only.
- `react` installed and **unscanned**, as found: the reviewer's own scan (11:48) was reset with `test.cycle()`
  while nothing was registered.
- No routes, overrides or patches; `patchedLeft 0`; `jsxHooked false`.
- `react-lab` off; no session or test flags; no context menu or modal open.
- Route as another agent last left it.
- No synthetic hover was used, so there was no pointer to park.
- No room imagery taken.
- Both review shots (`p2rev_failpage`, `p2rev_failroute`) were moved out of `shots/` into the reviewer's scratchpad.
  No file other than this one was written in the tree.
