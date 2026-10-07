# P8 Daemon (lgs-shell): independent review, round R1

Reviewer: an independent adversarial review agent. Date: 2026-10-07, 07:18 to 07:36 (Frame clock). Steam build 11094443 (`/tmp/lgs/steam-build.json`).
Scope: everything the builder reported for P8 at M3 / "complete": the card's builds, DM-1 to DM-6, the `grace` and `plates` selftests, REQ P4->P8, the contract `contracts/daemon.md`, and the offline harnesses.

**Verdict: fix.** There are three major findings and eight minor ones.

The acceptance tests are real. Every DM test, `grace`, `plates` and `actions` passes again on the live device, and the builder's offline harnesses reproduce exactly (39/39, 11/11). The problems are in the parts the tests do not look at:

- `lgs off` leaves one of the daemon's globals in Steam (G-REMOVE fails).
- The new theme-off dormancy keeps glassd running.
- A `--stay` unit outlives a Steam restart.

The deployed files on the Frame are byte-identical to the tree (sha1 checked: `lgs_shell.py` 2fdeb0d6…, `lgs_vr_core.js` 0963bbe7…, `lgs_vr.py` 19ade4f7…, `shell_ext/__init__.py` 886ec091…).

## 1. What was re-run

All runs were on the Frame, from `~/.local/share/glass-shell/device`, with `python3 -B` so that the review wrote no bytecode.

| Test | Command | Result | Agrees with builder? |
|---|---|---|---|
| shell_ext offline | `lgs_shell.py selftest actions` | 34/34 PASS | yes |
| DM-3 geometry | `lgs_shell.py selftest dm3` (×3) | 1st run (07:20:41): 14/15. `frameMenu.fWidth` published **0.6338** against a fresh `DumpLaserOverlays` **0.124**. 2nd and 3rd runs (07:21:38, 07:21:42): 15/15 | mostly (m3) |
| DM-4 actions | `flock /tmp/lgs/lab.lock lgs_shell.py selftest dm4` | 8/8 PASS. echo ok, `unknown-type`, `bad-source`, `bad-args`, `rate`; all logged; the bridge `reply` holds the last reply | yes |
| DM-6 native=auto | `selftest dm6`, then `selftest dm6 --live` | 1/1 and 3/3 PASS: `css-only (native=auto: the native gate has not passed (device/defaults.json has no native: on))`, source `builtin`; `start(auto)` keeps a running unit | yes |
| DM-5 page script | `selftest dm5 --stop` | 6/6 PASS: injected only into `vr:systemui`, removed when its file goes, re-injected, removed on stop | yes |
| grace | `selftest grace` | 8/8 PASS: dormant with the same pid, resumed, binding, heartbeat and pages back | yes |
| DM-1 NAT | `selftest dm1` | 15/15 PASS. `lgs-native` off at 2.6 s, nodes off at 11.8 s, `lgs-native` back 0.4 s after SIGCONT; teardown order correct; backoff [2, 4, 8, 16]; gives up after 5 exits; back to CSS only, nothing native left | yes (but see m8 on "nodes back") |
| DM-2 v3 spec | `selftest dm2` | 16/16 PASS. But "leaving plate and slab written with phase 0" took **2.92 s** against a 3 s wait (the log says 0.44 s) | yes, flaky (m8) |
| plates (P6 v3 + acks) | `selftest plates` | 12/12 PASS: v3 reporter with fragments, profile, geom and ackMode; `__LGS_MOTION` present; plate in glassd.json, then drawn, then acked at 0.82 s; fade, then gone; nothing native left | yes |
| Offline harnesses (PC) | the builder's scratch `p8_offline.py`, `p8_steamloop.py` | 25 + 39 PASS (offline), 11/11 PASS (steam loop) | yes |
| interactivePops | `glass.py js --flags interactivePops "…bridge.get('daemon').profile…"` | `wearer` inside the step (heartbeat 1.7 s old), `default` after it | yes |
| Reduce Motion (new) | a 1 Hz poll of `shell.json` during `glass.py js --media reduce "<5 s wait>"` | The daemon logged `Reduce Motion on` 07:31:43 and `off` 07:31:50, so it follows Steam's media query within 1 s (P-56 input to glassd and the spec) | builder had no live test |
| **G-REMOVE (new)** | scratch `p8rev_remove.py` under native.lock → lab.lock → lab-vr.lock: `lgs.py off`, sweep, `lgs.py on --css` | After `off`: no unit, no glassd, no `lgsAction`, no `__LGS_NATIVE`. SteamVR pages: no `__LGS_VR`, `__LGS_VRX`, `#lgs-theme`, `lgs-on`, **no `LGS Inter` FontFace**, no `__LGS_SG`/`__LGS_MOTION`. **But `window.lgsLayers` is still a function in SharedJSContext** (M1) | **no** |
| **Binding leftover (new)** | scratch `p8rev_binding.py` (same locks): stop, delete `window.lgsLayers`, start CSS only, stop again | After the second stop, `typeof window.lgsLayers` = `function` (`function () { [native code] }`), `lgsAction` = `undefined`. So the daemon's own stop leaves it, in CSS-only mode too | **no** |
| **Dormancy in native mode (new)** | scratch `p8rev_dormant.py` (same locks): `start(glassd=fakeglassd, native='on')` with the real reporter, `lgs.op('off')`, sample, `lgs.op('on')`, back to `--css` | Dormant: reporter stopped, `glassd.json` surfaces `[]`, no `lgs-native`, no nodes. **glassd pid 147988 still alive at +1 s and +11 s** (and the same pid on resume). Status `mode` = `starting` while dormant (M2, m7) | **no** |
| **`--stay` and a Steam restart (new, offline)** | scratch `p8rev_stay.py` = the builder's `p8_steamloop.py` fake world with `Shell(stay=True)` | New SharedJSContext target with the theme off: `stops []`, dormant, the task keeps running. Steam unreachable past `STEAM_GONE_S`: `stops []` (M3) | **no** |
| Idle cost (new) | `/proc/<pid>/stat` over 30 s; `ss` TIME_WAIT counts; `DumpLaserOverlays` timed ×5 in `vr:systemui` | CSS only: 27 ticks per 30 s (0.9 % of a core); 81 TIME_WAIT sockets to 8090 in about 60 s; `DumpLaserOverlays` 101–105 ms every 5 s (m4) | — |
| SteamVR font (visual) | `glass.py shot vr:controllerbindingui p2_p8rev_bindingui` (viewed; moved out of `shots/`) | Labels render in LGS Inter ("Show More Applications": Inter's letterforms, not Motiva) | yes |

## 2. Findings

### Major

**M1. `lgs off` leaves the daemon's `window.lgsLayers` binding in Steam (G-REMOVE, DoD 4).**

- The daemon calls `Runtime.addBinding` for both `lgsLayers` and `lgsAction` every time it connects, in CSS-only mode too (`lgs_shell.py` 1823-1824). The `lgsLayers` binding is useless in CSS-only mode, because no reporter is injected.
- Teardown deletes only `lgsAction` (2654: `for (const n of ['lgsAction'])`).
- `Runtime.removeBinding` from the fresh teardown session does not remove the function that the closed session installed, so `window.lgsLayers` (native code) stays in SharedJSContext until Steam restarts.
- Proven twice:
  - In the G-REMOVE run, P1's own `off` sweep lists `lgsLayers` in `leftovers.globals`.
  - In the binding experiment, after deleting it the daemon's start re-adds it and its stop leaves it.
- **Fix:**
  - Delete both binding globals in teardown.
  - Add the `lgsLayers` binding only when `native_possible()`.
  - Add a `typeof window.lgsLayers` check to the teardown selftests.

**M2. In native mode, glassd keeps running for the whole theme-off grace (up to 600 s).**

- Contract §1 says the native layer is "taken away" while the daemon is dormant, but nothing stops glassd:
  - `supervise_glassd` kills it only when `not native_possible()`.
  - `glassd_loop` checks `theme_on` only before a start.
- Live (fakeglassd, the real reporter): the same glassd pid is alive at dormant +1 s and +11 s, with `glassd.json` surfaces `[]`.
- With the real binary, an empty visible set while the dashboard is shown keeps:
  - a ~250 Hz loop;
  - one-frame camera shots every 5 s (`glassd.cpp` around 3036-3048, `--idle-hz` 0.2).
- So after a theme off without `lgs off`, a camera reader runs for up to 10 minutes with nothing to draw. Before session 2 it was gone after 3 s. This is a regression of the "nothing runs at idle" bar.
- **Fix:**
  - Kill glassd when the daemon goes dormant (`glassd_loop` already waits for `theme_on` before it restarts glassd).
  - Or keep it for a short warm window (≤ 30 s), then kill it.
  - Add a glassd-pid check to `selftest grace` in native mode.

**M3. A `--stay` unit survives a Steam restart and the loss of Steam, with no time limit (hard rule 7, contract §1).**

- In `steam_loop`, the "new SharedJSContext target with the theme off, so exit at once" rule sits only in the `not self.stay` branch (1856-1866).
- The `STEAM_GONE_S` exit has `and not self.stay` (1809).
- The offline fake-world run with `stay=True` confirms both: no stop, dormant forever.
- `glass.py native-session` starts the daemon with `--native --stay`. If a native session's client dies before its `finally` (for example the usage-limit cut-off that ended every agent at 04:30), the unit stays in native mode with glassd running. It then outlives a Steam restart, keeps re-theming SteamVR pages and never exits until someone runs `lgs on --css` or `lgs off`.
- Contract §1 promises "at once, so nothing outlives a Steam restart" with no exception for `--stay`.
- **Fix:**
  - Apply the Steam-restart exit and the `STEAM_GONE_S` exit with `--stay` too.
  - Give `--stay` a ceiling, for example 1800 s (the native lock's own wait).

### Minor

**m1. The daemon writes bytecode next to the code on the Frame.**

- The unit runs `/usr/bin/python3 -u lgs_shell.py daemon …`, without `-B`, and its environment has no `PYTHONDONTWRITEBYTECODE` (read from `/proc/<pid>/environ`).
- `device/shell_ext/__pycache__/__init__.cpython-312.pyc` appeared at 04:22:56, two minutes after `shell_ext/__init__.py` was synced. `device/__pycache__/lgs_shell…pyc`, `lgs…pyc` and `lgs_vr…pyc` exist too.
- Plugins loaded by `importlib` would get `.pyc` files as well.
- These files are inert, but they are written outside `/tmp/lgs` and `/dev/shm/lgs` and survive a reboot. P1's `device/lgs` wrapper goes out of its way to avoid exactly this.
- **Fix:** `python3 -B -u` in the `systemd-run` command line, and `sys.dont_write_bytecode = True` at the top of `lgs_shell.py`.

**m2. One malformed report field kills the daemon.**

- Several conversions sit outside any `try`:
  - in `glassd_config`: `float(L.get("r") or 0)`, `x`, `y`, `dz`, the surface's `texW` / `texH` / `radius`, and `round(nan)`;
  - in `build_spec`: `float(L.get("dz") or 0.012)`.
- Offline, all 4 of 4 probes raise (`'12px'`, `'1e'`, `[1]`, `'wide'`). Each raise goes through every loop's `bug()` and becomes fatal after 5 in 120 s, so the whole daemon exits, including SteamVR page upkeep and the actions relay.
- P6's reporter coerces its numbers, so this cannot be reached today. But contract §7 promises "type checks", so use `_num()` for every numeric field and drop the bad item.

**m3. Geometry can be published up to about 5 s stale, and DM-3 is not atomic.**

- `fWidth` / `fHeight` refresh only with the 5 s `DumpLaserOverlays`, unless `uv`, `mpp` or `visible` also change.
- The first DM-3 re-run failed on `fWidth` (0.6338 published against 0.124 live).
- DM-3 compares values taken up to about 7 s apart (`shell.json` every 2 s, plus the dump), not "in the same step".
- Suggestion: dump when the PooledPopup's `rect` changes (SteamVR logs `[PooledPopups] Showing … rect`), and have DM-3 wait for a fresh `geom.at`.

**m4. Idle work in CSS-only mode.**

- 0.9 % of a core.
- `vr_theme_loop` opens a fresh devtools websocket per SteamVR page every 1.5 s (`eval_once`; about 1.3 new 8090 sessions per second).
- `DumpLaserOverlays` (about 100 ms round trip) runs every 5 s forever.
- This is inherited from Phase 1's watcher, but P8 owns it now. Keep one session per page, and dump only on change.

**m5. `start()` is not serialized.**

- Another agent's lock-free `lgs reload` (07:23:13) raced my locked `lgs.py on --css`. Mine returned `failed: Failed to start transient service unit: Unit lgs-shell.service was already loaded`, although a unit was running.
- The two runtime loads in parallel also left P1's runtime off: "rt/07-tooltip.js failed … `_loading`", "load failed, CSS only" (see §5).
- **Fix:** treat "already loaded" as running (re-read `unit_info()`), or take a short start lock.

**m6. Stale text.**

- `contracts/daemon.md` line 7 and the `lgs_shell.py` docstring (38-41) still say the unit "exits when the Steam theme goes off".
- The docstring's selftest list (60-61) lacks `dm1`, `dm2`, `grace` and `plates`.
- Contract §11 does not list `plates`.
- `docs/LAB.md` line 115 (V1) says the SteamVR watcher exits when the Steam side is turned off. The open REQ P8->V1 covers only NATIVE.md; extend it to LAB.md.

**m7. Status during dormancy.**

- While dormant in native mode, `status.mode` and the bridge `daemon.mode` say `starting`.
- They should say `dormant` (with `native: false`), so that areas and the lab can tell a dormant daemon from one that is starting.

**m8. Test strength.**

- DM-1's "nodes back" accepts `items > 0` without `expired === false`, which is why it reports 0.0 s.
- DM-2's phase-0 wait (3 s) is about equal to the measured 2.92 s, so it is flaky.
- `dm3` and `dm4` take no lab lock. `dm5 --stop` and `dm6 --live` restart the daemon without `lab.lock`, under other agents' Steam steps.
- DM-4's "echo plugin" is the built-in echo, so the live path that loads a plugin file (`device/shell_ext/*.py`, scanned by the running daemon) is only tested offline. A RAM test plugin folder (like `/tmp/lgs/vr-scripts`) would close that gap.

### Accepted deviations (checked, no finding)

- **Dormancy is bounded and the user's path is unaffected.** `lgs toggle` → `lgs.py off` → `op('off', vr=True)` stops the unit first. Dormancy only happens on lab `--stock` or P1 tests, or on a Steam UI reload, and it ends at 600 s (`shellThemeGraceS`, 0..3600). The journal shows other agents' `--stock` steps surviving it (07:17:32, 07:17:47). M2 and M3 are about what runs during it, not about the grace itself.
- **`native=auto` follows the plan.** The order is `/tmp/lgs/flags.json`, then `device/defaults.json`, then CSS only. The flags.json override is PLAN §1.17 S1's flag. The coordinator's note holds: without `defaults.json`, the daemon runs CSS only, with the reason given.
- **The actions relay is strict and fails closed.** The checks are the source context (nonce probe), the claimed `src`, the exact argument schema, the flag, the per-type rate, the global 20 per 10 s, and one call in flight. `nav` and `launch` are dry under `actionsDryRun`, under P1's action logger (on in every lab step), and whenever the logger state cannot be read. No launch-type action exists yet, and tests use only echo.
- **REQ P4->P8 is done.** In the G-REMOVE run, `LGS Inter loaded` was present in `systemui`, `controllerbindingui` and `keyboard`, and was gone after `lgs off`. P8's edit to `wp/P4.md` is the sanctioned REQ answer.
- **Ramps match the motion tokens.** 250/350, 735/514 and 180 ms equal `motion_tokens.h` (`kMatInMs`, `kMatOutMs`, `kSheetIn`, `kSheetOut`, `kReduceMs`). They are hard-coded copies, so they could drift; they match today.
- **RAM leftovers are harmless.** `/dev/shm/lgs/shell.json` stays after `lgs off` with mode `stopped`, and `/tmp/lgs/vr-scripts/` stays as an empty folder. Both are RAM-only and harmless.

## 3. Visual review (against "feels native visionOS, no outlines")

P8 draws no surface of its own. Its visible effects are the SteamVR font, the materialize policy and the depth inputs (`unitM`, `profile`, `reduceMotion`).

- **The SteamVR font fix works.** In the `vr:controllerbindingui` shot, the binding UI's labels are set in LGS Inter.
- **Observations for C5b, not for P8:** the same page still uses Steam's all-caps bold titles ("EDIT CONTROLLER BINDINGS"), and its panel shows a light top rim along the rounded corners. Both conflict with the "no outlines" bar.
- **Native glass was not looked at with `hv`** (no room frames were taken). P9's R1 review covered the live plates end to end through P8, and DM-2 / `plates` show the policy fields arriving.

## 4. Checklist (a)–(f)

- **(a) Ownership: pass.** The files changed since `f5190bb` are `device/lgs_shell.py`, `device/lgs_vr_core.js`, `contracts/daemon.md` and `wp/P8.md` (all P8's), plus `wp/P4.md` (the REQ answer). There are no untracked P8 files, and `device/vr/` and `shell_ext/` hold nothing new.
- **(b) Safety: fail (M1, M3, m1).**
  - Transient unit (`systemd-run --user --collect`); nothing autostarts.
  - The never-list is respected; the tests use only echo, SIGSTOP and SIGKILL of the daemon's own children, and fakeglassd.
  - Locks are mostly held (m8).
  - But `lgs off` leaves a global (M1), a `--stay` unit outlives a Steam restart (M3), and bytecode is written outside the runtime folders (m1).
- **(c) Robustness: fail (M2, m2, m4).**
  - Freeze recovery is 0.4 s, the backoff and give-up work, timeouts are tolerated, and the page scripts, fonts and scene graph are removed on stop.
  - But glassd runs through dormancy (M2), a malformed report is fatal (m2), and there is idle polling (m4).
- **(d) Conformance: pass for P8's inputs.** P-56: Reduce Motion is followed within 1 s and the ramps are 180 ms. Depth uses `unitM` = S × r (DM-3). P-71's ≤ 350 ms out-ramp holds for liquid and panel glass; at launch the dashboard hides and P8 keeps the layout rather than animating it.
- **(e) Function retention: pass.** The daemon removes no Steam path. `lgsAction` only adds paths, and callers time out after 2 s when no daemon is running (contract §5). Interactive pops stay off unless `interactivePops` is set.
- **(f) Visual quality: pass for P8's part** (the font). The binding UI's own look is C5b's (§3).

## 5. Incidents during the review

- **Runtime left off by a race, then restored.** At 07:23:13, my locked `lgs.py on --css` (the G-REMOVE restore) raced another agent's lock-free `lgs reload`. The runtime load failed ("Cannot read properties of undefined (reading '_fail')"), leaving `__LGS_RT` absent. I restored it with `flock /tmp/lgs/lab.lock python3 -B lgs.py reload` (07:24): runtime `running`, react installed.
- **Device left as found.**
  - Theme on, runtime loaded, `lgs-shell` CSS only (`--req off`), not dormant, no glassd.
  - `/tmp/lgs/flags.json` held `{"wp.p3": true}` from another agent's step in progress, not mine.
  - No menus were opened and there was no synthetic hover.
- **Review files cleaned up.**
  - The review scripts in `/tmp/lgs/p8rev/` were deleted on the Frame.
  - The shot `p2_p8rev_bindingui.png` was moved out of `shots/` into the reviewer's scratch folder. It shows no room and no personal names.
  - The tree was not changed apart from this file.
