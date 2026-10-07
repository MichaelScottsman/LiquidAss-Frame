# P1 Runtime core and lifecycle: independent review, round R1

Reviewer: independent adversarial review agent. Date 2026-10-07, 06:36 to 07:15 (Frame clock). Steam build 11094443.
Scope: the builder's M3 / "complete" report for P1 (RT-1 to RT-7, RT-H, the loader, `00-rt.js`, `lgs check`, flags,
the native argument, the contract). Also a crash of SharedJSContext during the review (finding M1, added at the
coordinator's request and checked against the device's own logs).

**Verdict: fix.** Three major findings and nine minor ones.

What holds up:

- The acceptance tests reproduce on the live device. In one run on a fresh SharedJSContext after the crash, 7 of 8
  pass, and RT-6's failure is a gap in the test's own classification list, not a write of ours (m8).
- The card's loader fallback, which the builder never tested live, passes.
- The core's lifecycle is careful work.

What fails:

- **Recovery.** After a SharedJSContext crash the theme injector harvested a 3-module class index (normal: 550) and
  cached it, and every re-injection reused it. The theme stayed effectively off on every surface for 3.5 minutes, and
  the harvest can leave Steam modules half-built (M1).
- **Fail-closed.** A module scope keeps working after it is disposed, so a slow install leaves classes and timers
  behind even after `lgs off` (M2).
- **Look.** P1's own toast, the one thing it shows users, has an outline and non-token motion (M3).

---

## 1. What was re-run

| Check | Command | Result | Agrees with builder? |
|---|---|---|---|
| Files on the Frame = tree | `md5sum` of `device/lgs.py`, `device/rt/*.js`, `lgs_core.js`, `lgs_index.js`, `lab/lab.py` on both machines (06:39) | identical | — |
| Offline bundle check | `python device/lgs.py check` (PC, node present) | 41 files, 0 errors, 0 warnings, 7 `_wip` files skipped | yes |
| Live runtime state at start | `glass.py js "__LGS_RT.status({counts:true})"` (06:39) | running; 13 modules (4 P1 stubs off, `react` installed, the rest off behind `wp.*`); 0 failed loads; popupCreated 6, popupDestroyed 3, NavigationSource 2 | yes |
| "+" creates no window (RT-3 deviation) | `glass.py js` probe: every popup with its visibility, a temporary popup-created callback, `L.click('bar','%{AddWindowButton}')`, 1.2 s, close (06:41) | 0 popup-created callbacks; the same `barpopup.76640001` window went `hidden` → `visible` → `hidden`; no new popup | yes: the `onShow` deviation is real and handled |
| Edge cases of `00-rt.js` (new) | reviewer harness `node h1.js <repo>` (scratchpad; fake popup manager; 9 cases: install timeout, failed install with `expose`, track on a new and a closed window, teardown unhooking, liveness tick-only, no main window, flag-off with a throwing `remove()`, teardown during an install, bridge and `action`) | 8 ok, **1 fail**: a late `install()` after its 5 s timeout leaves its subscriptions behind, also after teardown (M2). Liveness tick-only 2.28 s | builder had no test |
| Full selftest, run 1 | `frame_ssh run "python3 -B …/lgs.py selftest"` (06:40:36) | **no result**: the SSH helper's default 120 s read timeout closed the client before the first test printed; the remote process died at its first `print` (m7) | — |
| **Full selftest, run 2** (fresh SharedJSContext after the crash) | on the Frame, detached: `nohup python3 -B device/lgs.py selftest > /tmp/lgs/p1rev/run1.out` (06:56:32 → 07:07:51); JSON `/tmp/lgs/p1-selftest.json`, copy `/tmp/lgs/p1rev/run1.json` (RAM) | **RT-1 PASS** (18.4 s; on/off deltas popupCreated +2, popupDestroyed +1, NavigationSource +1, identical in every cycle). **RT-2 PASS** (49.8 s; all 8 checks). **RT-3 PASS** (147.2 s with lock waits; opened, tracked, stub class on barpopup, `onShow` fired, closed). **RT-4 PASS** (67.9 s; patchedLeft 0, no problems; foreign global `__LGS_NATIVE` reported, not P1's). **RT-5 PASS** (a 0.62 s, b 2.013 s). **RT-6 FAIL** (68.7 s): 1 unexplained file, `~/.config/openvr/config/chaperone_info.vrchap` (m8). **RT-7 PASS** (50.1 s; median fps 58.75 theme-only vs 60.55 with the runtime, ratio 1.031; long frames css [16, 9, 10, 12], rt [11, 11, 13, 11], median extra 0; tick 0.39 ms/s). **RT-H PASS** (141.2 s; all 9 checks incl. the daemon `echo`) | yes, except RT-6 (m8) |
| RT-6 failure, cause (new) | `ls --full-time` of the file; `~/.local/share/Steam/logs/vrserver.txt`; `grep -i chaperone` over `device/`, `device/rt/`, `lab/` | SteamVR's `CCVTrackedHmdDriver` rewrites the file **every 60 s** ("Preserving worlds … and universes" at hh:mm:58, then "Read chaperone JSON"; last at 07:07:58.33, file mtime 07:07:58.33). Our code never mentions it; our process's write audit lists only `/tmp/lgs/*` | not a write of ours |
| **Loader fallback** (card "Fallback", new) | `fallback.py` on the Frame (scratchpad, uploaded to `/tmp/lgs/p1rev`, deleted after): inside one `lab.Lock()`, `lgs.rt_load` replaced by a function that raises, `lgs.op('on')`, probe, then the original restored and `op('on')` again (07:09:09 → 07:10:21) | **PASS**: `enabled: true`, `runtime: {runtime: 'off', reason: 'loader failed: …'}` in 283 ms; on main `html.lgs-on` and `#lgs-theme` present, no `__LGS_RT`, index 550; after the restore the runtime is running with `react` installed | builder had no live test |
| Steam's webpack `require` (new) | `glass.py js`: push a probe chunk, `String(req)` | `function ve(le){var se=ms[le];if(se!==void 0)return se.exports;var B=ms[le]={id:le,loaded:!1,exports:{}};return ds[le].call(B.exports,B,B.exports,ve),B.loaded=!0,B.exports}`: the cache entry is written **before** the factory runs and never removed if it throws; 2614 module factories registered; `req.c` not exposed | builder had no test (M1c) |
| Crash forensics (new) | `journalctl` 06:49:00–06:50:30; Steam `logs/webhelper.txt`; `/tmp/lgs/lgs.log` | §2 M1 timeline: the renderer died of **`V8 process OOM (Oilpan: Large allocation.)`** at 06:49:37 | — |
| Renderer memory after the crash (new) | `/proc/127041/status` of the new renderer (started 06:49:56), 11 samples every 30 s, 07:02:34 → 07:07:34, with the count of theme bundles in `lgs.log` | VmRSS 0.95 to 2.00 GB, swinging by up to 1 GB inside 30 s; VmHWM up to 2.55 GB; 31 theme bundles in the window; **no monotonic growth** | — |
| P1 toast, live vs mockup | `glass.py shot main p2_p1rev_toast_live --route /library/home --pre "__LGS.toast('Liquid Glass  ·  On')" --settle 0.7` (moved to the reviewer's scratchpad at once, not kept in `shots/`); viewed next to `shots/p2_window-nav_toast.png` | a uniform light ring round the capsule; the toast covers the toolbar's search capsule (M3) | builder had no test |

`/tmp/lgs/p1-selftest.json` held run 2 (07:07:51) until 07:11, when reviewer B (§6) put the builder's 05:40:37 JSON
back there (downloaded first, byte-identical). Run 2's JSON is now at `/tmp/lgs/p1rev/review-p1-selftest.json`
(same content as `run1.json`).

---

## 2. Findings

### M1 (major, coordinator-requested, confirmed) The class-index harvest is not validated, a bad index is cached for the life of the context, and re-injection after a SharedJSContext reload does not wait for the UI

**What happened** (device logs, not the evidence log):

| Time | Source | Event |
|---|---|---|
| 06:49:31 | `/tmp/lgs/lgs.log:2858` | daemon: `Reduce Motion on` (another agent's `--media reduce` step) |
| **06:49:37** | `journalctl` | `steamwebhelper` renderer 4247 (up 16 898 s, 4.7 h): **`V8 process OOM (Oilpan: Large allocation.)`**; the last GCs show 187 MB of JS heap; 06:49:38 `systemd-coredump` |
| 06:49:46 | `lgs.log:2859` | daemon: `an evaluation timed out (Steam busy?)` |
| 06:49:56 | `lgs.log:2860`, `webhelper.txt` | daemon: `Target crashed`; every gamepadui popup shut down; new renderer; SharedJSContext `STARTUP LoadStart` |
| 06:49:58 | `webhelper.txt` | `CreatingPopup name:VR_uid0` (the main window comes back) |
| 06:50:09 | `lgs.log` | a theme `on` (an in-process `lgs.op('on')`: no CLI `on:` line, so a lab step or a selftest restore; not identified) |
| 06:50:11 | `lgs.log:2874` | `status`: `"enabled": true`, **`"classModules": 3`** (normal: 550) |
| 06:50:17 → 06:52:58 | `lgs.log:2879-2950` | eight more re-injections (`since` 10:50:17, :33, :45, :59, 10:51:10 `reload`, 10:51:29 `reload`, 10:52:27, 10:52:58 `reload`): **every one still `classModules: 3`** |
| 06:53:41 | `lgs.log:2960` | `reload` with `classModules: 550`: the index was rebuilt (by hand, per the coordinator) |

The coordinator reports 735 unresolved tokens in that state. `lgs.log` truncates lines at 300 characters, so I could
not count them myself. `cssBytes` fell from 636 414 to 575 057, which fits thousands of selectors rewritten to
`.lgs-unresolved`. The theme was effectively off on every surface for **3 min 32 s** (06:50:09 to 06:53:41).

**Root causes in P1's files.**

a. **The bad index is cached and never rebuilt.** `device/lgs_core.js` has
   `const index = (W.__LGS_INDEX && W.__LGS_INDEX.selector) ? W.__LGS_INDEX : (W.__LGS_INDEX = lgsBuildIndex());`.
   Any object with a `selector` is reused, whatever its size. `disable()` does not delete `__LGS_INDEX`, and
   runtime.md §5 lists it as an expected leftover. So neither `lgs reload` nor `lgs off; lgs on` recovers: only a
   manual `delete __LGS_INDEX` or a Steam restart does. That is why all nine re-injections stayed broken.
b. **No readiness check.** `op('on')` → `core_call` runs `lgsBuildIndex()` as soon as SharedJSContext answers. Thirteen
   seconds after the reload, Steam's UI bundle had registered only a few of its CSS modules. Nothing in `lgs.py`,
   `lgs_core.js` or `lgs_index.js` checks:
   - that `SteamUIStore`, the main window (`SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance`) and the popup
     manager exist;
   - that `webpackChunksteamui` is the live runtime's array (before the runtime loads, `push` is the plain `Array`
     method, the callback never runs and `req.m` throws);
   - that the harvest's size is plausible.
c. **The harvest runs every registered factory, and Steam's `require` keeps half-built modules.** `lgsBuildIndex` calls
   `req(id)` for all 2614 ids in `req.m`, inside `try { … } catch { continue }`.
   - Steam's `require` (probed live, §1) writes the cache entry `{id, loaded: false, exports: {}}` **before** it calls
     the factory, and has no `threw`/`delete` cleanup. A factory that throws because it runs early stays cached with
     empty or partial exports. It runs early when its dependency's chunk is not registered yet, or when it touches a
     global the app sets up later. When Steam's own code requires that module later, it gets the broken object.
   - On a settled UI almost every factory has already run, so the risk is small. **Right after a reload it is the
     normal case**, and the harvest at 06:50:09 ran in exactly that window.
   - Whether it broke a Steam module is not proven: the context has been rebuilt since, and the cache is not
     reachable (`req.c` is undefined). This is the path by which our code could break a Steam function. If V1 or V2
     sees a Steam feature fail after a post-reload harvest, raise M1 to **blocker**.
   - The harvest also runs, out of order, the side effects of modules the app may never load (store constructors,
     `SteamClient` registrations).
d. **The crash itself: cause not proven.**
   - The renderer died of an out-of-memory error in Oilpan (Blink's C++ heap: DOM and CSSOM objects), not in the JS
     heap (187 MB).
   - The "evaluation timed out" at 06:49:46 came 9 s **after** the OOM. It was a symptom of a dying renderer, not the
     trigger.
   - Sampling the new renderer (§1) shows no steady leak: RSS swings between 0.95 and 2.0 GB within 30 s, and peaks
     at 2.55 GB. A transient spike under the shared load explains the OOM better than slow growth. The load includes
     about 3.5 theme bundles per minute (584 between 04:16 and 07:02; each builds a ~637 KB `<style>` in 10 windows),
     full-DOM sweeps, audits and gates from about 20 agents.
   - This review's own first selftest run (06:40:36 onward, §1) was on the device in the minutes before the crash.
     Its last activity is not recorded.
   - RT-1 checks subscriber and listener counts, not memory.

**Required fix** (P1: `device/lgs.py`, `device/lgs_core.js`, `device/lgs_index.js`):

1. **The harvest validates itself.**
   - `lgsBuildIndex()` returns its size, and `lgs_core` caches the index only when it is sane: `size` ≥ 200 (normal
     550) and unresolved tokens in the bundle at their normal level (0 today).
   - When it is not sane, nothing is cached. The CSS stays **off** (or on the previous good map, if this context has
     one), and the harvest retries with backoff: 2, 4 and 8 s, then every 15 s, up to about 2 min.
   - Each attempt is logged to `lgs.log` (size, unresolved count, attempt number), and `status()` reports
     `index: {state: 'waiting' | 'ok' | 'gave-up', size, attempts}`.
   - A cached index below the threshold is discarded. `lgs off` deletes `__LGS_INDEX`, or `on` always revalidates it,
     so `off`/`on` becomes a working recovery.
2. **Re-inject only when the UI is ready.** Before harvesting, `op('on')` waits (bounded, with the same backoff)
   until all of these exist:
   - `window.SteamUIStore` and `SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance`;
   - `g_PopupManager` with the main popup;
   - a `webpackChunksteamui` whose `push` is not `Array.prototype.push`.
3. **Harvest without running factories that have not run.**
   - Prefer reading exports only of modules already in Steam's module cache: reach it through a `__webpack_require__`
     property if Steam exposes one, or through a probe module.
   - Failing that, filter by factory source: CSS-module factories are tiny and only set string exports, and the
     needle check is already in `lgs_index.js`.
   - Calling arbitrary factories is the last resort, and never before the readiness check of item 2.
4. **Keep every evaluation in SharedJSContext time-boxed and cheap.** This applies to every caller (P8's daemon polls,
   P10's lab steps), not only P1. For P1: `SWEEP_JS` runs on every `off`, including every lab `--theme off`, and builds
   an array of every element of every window (`[documentElement, ...querySelectorAll('*')]`). Use
   `querySelectorAll('[class*="lgs-"],[data-lgs-rt-stub],[id^="lgs"]…')` or a `TreeWalker` instead.
5. **Measure memory in RT-1.** Record `Memory.getDOMCounters` (documents, nodes, listeners) and the renderer's RSS
   before and after N `on`/`off` cycles, with a forced GC (`HeapProfiler.collectGarbage` on SharedJSContext and each
   popup). Fail on growth per cycle above a small bound.

### M2 (major) Fail-closed gap in `00-rt.js`: a disposed module scope keeps working

a. **Install timeout.**
   - `installRec` gives up after `INSTALL_TIMEOUT_MS` (5 s): it marks the module failed, calls `remove()` and disposes
     the scope. But the original `install()` promise keeps running.
   - Everything it does afterwards through the disposed scope is live and **never undone**: `scope.windows.track`
     adds to `winSubs`, `scope.setInterval` starts a real interval, and `scope.listen` adds a real listener. Their
     `off` functions go into a `cleanups` array that is never disposed again.
   - Reviewer harness `h1.js`, case 1: a module whose install waits 5.6 s and then calls `rt.windows.track` (adding
     class `lgs-slow`) and `rt.setInterval`. After the timeout, `lgs-slow` is on main and **still there after
     `teardown('off')`**, and the interval keeps firing.
   - This breaks contract §1 rule 2 ("every subscription it made through `rt` is undone") and RT-4/G-REMOVE ("no
     `lgs-*` class").
   - It is the scenario M1 creates: after a context reload, a module that waits for `SteamUIStore` can take more than
     5 s.
b. **Async work after a flag-off removal** has the same cause: a continuation that resumes after `removeRec` (an
   `await` inside a module) subscribes through a dead scope.

**Fix.** `_dispose()` marks the scope dead. After that:

- `track(fn)` runs `fn` at once, which undoes the new subscription, and logs a warning;
- `expose`, `windows.*`, `listen`, `setTimeout`/`setInterval`, `on`, `flags.on*` and `bridge.on` are no-ops that
  return a no-op `off`.

Add the case to the offline harness and to RT-2 (a stub with a slow install).

### M3 (major, visual and conformance) P1's own toast has an outline and non-token motion

`device/lgs_core.js` `toast()` is the one thing P1 shows users: every user `lgs on`/`off` and the "+" →
"Liquid Glass" toggle show it. The live shot (§1), next to `shots/p2_window-nav_toast.png`:

- **Outline.**
  - `box-shadow: inset 0 1px 0 rgba(255,255,255,.55), inset 0 0 0 1px rgba(255,255,255,.18), …` draws a uniform
    1 px ring round the whole capsule, clearly visible in the shot, plus a 1 px top line.
  - VP P-42 ("no uniform 1 px ring on any glass container"), P-43 ("no line thinner than 2 CSS px"), and the "no
    outlines" bar.
  - The mockup's toast has no outline: panel glass, radius 30, edges from the material.
- **Motion.**
  - `transition: transform 260ms cubic-bezier(.2,.9,.25,1.2), opacity 200ms ease`, then an exit at 1700 ms by
    `translate(-50%,-8px) scale(.97)`.
  - None of these is a D2 §11.2 token (P-58). The 1.2 overshoot is a bounce.
  - Reduce Motion is ignored: the toast scales and translates anyway (P-56).
  - D2 §11: toast in = materialize 250 ms + translate −8 → 0 px `snappy`, no scale-in from .94; toast out =
    dematerialize 350 ms.
- **Placement.** At `top: 28px` it covers the toolbar's search capsule for 2 s: in the shot it sits on "Search f…",
  glass over glass.

**Fix.** The toast must also render when the theme is off (`off` shows "Off"), which is why it styles itself.

- Use the theme's variables with literal fallbacks: panel glass, radius 30, no ring.
- Take motion from P5's tokens (`--lgs-d-*` / `--lgs-e-*`, or `rt.shared.motion` when present) with the token values
  as fallbacks, and a fade only under `prefers-reduced-motion`.
- Place it clear of the toolbar row.

Then re-shoot it and compare with the mockup.

### Minor

- **m1 RT-7's pass rule is looser than the card.**
  - The card says "no new frames over 34 ms". The selftest passes when the median extra long frames are within the
    theme-only A/A spread (min 1). Run 2's spread was 7, so up to 7 extra long frames per 3 s would pass.
  - The noise argument is sound on a shared device; run 2 passes the strict reading anyway (median extra 0).
  - The relaxed rule belongs in runtime.md §9 as a stated deviation, for the coordinator to accept.
  - `IDLE_MS_PER_S = 1.0` is P1's own budget, not PLAN's.
- **m2 Something runs at idle.**
  - The runtime keeps a 250 ms `setInterval` (liveness, and a window reconcile every 2 s) for the whole session, and
    `lgs_core` keeps its 1.5 s sweep.
  - The cost is tiny (0.39 ms/s in run 2), but the MutationObserver already covers liveness and the popup callbacks
    cover windows.
  - Run the tick at ≤ 0.5 Hz as a fallback, or only while the observer is missing.
- **m3 Liveness cannot fire without a main window.** If the runtime starts while there is no `main` entry (e.g. right
  after a context reload; harness case 5), `watchMain` never runs, and a later theme-off is never noticed. Fall back to
  checking `__LGS` (gone, or `state.enabled === false`) when there is no main entry.
- **m4 `rt.counts()` leaves out SteamVR's navigation-type callbacks.** IM §8 counts
  `vrGamepadInput.RegisterForNavigationTypeChange` subscribers (P3's module subscribes there). `counts()`, RT-1 and
  RT-4b count only popup-created, popup-destroyed and NavigationSource. Add the vr count, so that P3's leak checks can
  use `rt.counts()`.
- **m5 Bundler warnings come from comments.**
  - `bundle_files` uses a plain substring test (`"@keyframes" in text`). `04-states.css` (a comment mentions
    `@property`) and `70-social.css` (a comment mentions `@keyframes`) log two false warnings on **every** `on`: about
    1168 lines in `lgs.log` since 04:16.
  - `check()` already has the comment-free `_css_scan`: use it here too.
- **m6 `lgs dial` writes outside `/tmp/lgs`.**
  - `main()` writes `~/.local/share/glass-shell/dial` (a Phase 1 feature), which survives `lgs off` and a reboot.
  - It is a preference written only by an explicit `lgs dial`, it is absent on the device today, and no test writes
    it. But it contradicts rule 7 and the install note "launcher + code only".
  - Move it to `/tmp/lgs/dial`, or have the coordinator record an exemption.
- **m7 The SSH helper's 120 s default timeout kills a foreground selftest.**
  - `lgs.py selftest` prints nothing until the first test finishes, and with lab-lock waits that takes more than
    120 s. `frame_ssh run` then gives up, and the selftest dies at its first `print` (broken pipe).
  - The evidence log's re-verify line (`FR run "python3 -B …/lgs.py selftest"`) has this trap.
  - Point to `python glass.py selftest` (P10's passthrough, 1200 s), and print a line when each test starts.
- **m8 RT-6 fails intermittently on SteamVR's own once-a-minute write.**
  - Run 2's RT-6 failed on `~/.config/openvr/config/chaperone_info.vrchap`. vrserver rewrites it every 60 s (§1),
    while RT-6's control windows last about 9 s each and its test window longer. So the file lands in the test
    window and in neither control window, depending on the minute.
  - Our process's audit is clean, and our code never touches the file. **The requirement holds; the test does not.**
  - Add the file to `PERSIST_KNOWN` ("SteamVR rewrites it every 60 s"). Better: classify by a 61 s control window, or
    by the writer: `fuser`, or an inotify watch on the scan roots during the test window.
- **m9 RT-6's full CLI cycle restarts the daemon in `auto`, not in the mode it found.**
  - `st_rt6` runs `op('on', vr=True, native="auto")` and stops the unit again only when it was stopped before.
  - Today `auto` resolves to CSS only. After run 2 the daemon reports `requested: auto` (since 07:04:27) instead of
    the `--css` it was started with; the effective mode is the same.
  - Once V1 sets `native: on` in `defaults.json`, RT-6 would leave a CSS-only device in native mode after releasing
    `native.lock`, which breaks rule 9 and PLAN §7.1 ("never leave native mode … on after a step").
  - Restart with `native=was` (`'on'`/`'off'`).

---

## 3. Checklist

**(a) Ownership.**

- The reported `filesChanged` (`device/lgs.py`, `device/rt/00-rt.js`, `contracts/runtime.md`, `wp/P1.md`) are all
  P1's (PLAN §2.6). `git diff f5190bb` shows no change since the checkpoint in `lgs_core.js`, `lgs_index.js`, `lgs`,
  `glass-shell.desktop` or `icon.png`.
- Changes P1 needed elsewhere went through REQs: P2 added `flag: 'react'`; P6 deleted its globals; P10 added
  `glass.py selftest`. P9's `/tmp/lgs-fx` request is still open.
- Requests addressed to P1 (`grep "REQ [A-Za-z0-9]*->P1:"`): three, all `[x]` (P10 ×2, P6). Verified live:
  `rt.test.flags.push/pop` (RT-H), `lgs.check()` (above), `rt.data('popups')` (loader code; P6's module reads it).
- **PASS.**

**(b) Safety.**

- *Persistence:* RT-6's audit of our own process is clean in both runs (only `/tmp/lgs/*`). There is no unit file
  except the transient `lgs-shell.service`, no autostart entry, and no web-storage keys. The one new persistent file
  in run 2 is SteamVR's own (m8). `lgs dial` is a latent exception (m6).
- *Removal:* RT-4 (patchedLeft 0, no marked element, no runtime global) and RT-5 (0.62 s / 2.013 s) pass. G-REMOVE
  with every flag on (RT-4b) is clean for P1. `__LGS_NATIVE` is left over by another package: for V2's G-REMOVE
  list, not P1's.
- *Never-list:* the selftest opens only "+" (allowed) and runs the action logger inside every lock. `rt.action` is
  used only for the daemon's `echo`.
- *Locks:* every selftest step runs inside `lab.Lock()`. RT-6 holds `sync.lock` shared and takes `native.lock` only if
  free. Gap: m9.
- **PASS with M2 and m9.**

**(c) Robustness.**

- Modules fail closed on throw (RT-2, live), and the loader fallback works (live, new).
- Not on install timeout or after async removal (M2).
- No recovery after a SharedJSContext crash: M1 a/b.
- The harvest can damage Steam's module cache: M1c.
- Idle polling: m2. Liveness without a main window: m3.
- **FAIL (M1, M2).**

**(d) Conformance.**

- P1 has no route of its own. The only P-items in its area are on the toast: P-42, P-43, P-56 and P-58 all fail
  (M3); P-38 (22 px Semibold) and P-84 (tracking .2 px at 22 px = 0.009 em) pass.
- PLAN §1.4's one-accessor rule is met by `rt.expose` (`rt.input` through P3, verified in RT-H).
- **FAIL (M3).**

**(e) Function retention.**

- P1 owns no Steam function. Its user path is Steam's own "+" → Launch Program → "Liquid Glass" entry (laser click,
  or D-pad plus A in Steam's list). `~/.local/share/applications/glass-shell.desktop` is present; it was not launched
  (never-list).
- The runtime keeps the theme and every other module on when a module or the whole loader fails (RT-2, fallback).
- The open risk to Steam functions is M1c.
- **PASS, with M1c open.**

**(f) Visual quality.** The toast fails the "no outlines" and motion bar (M3). Nothing else of P1's is visible.

---

## 4. Device and hygiene

- **Left as found** (07:12): theme on, `classModules` 550, 0 unresolved; runtime running with `react` installed; no
  session flags (`/tmp/lgs/flags.json` absent); no test overlay of mine; no bar popup open; `lgs-shell` active,
  CSS-only. The one difference is the daemon's `requested: auto` from RT-6's cycle (m9).
- **Files on the Frame:**
  - The toast shot was deleted from `/tmp/lgs-shots` by `glass.py shot`.
  - `fallback.py` was deleted.
  - `/tmp/lgs/p1rev/run1.out` and `run1.json` (text, RAM) stay as evidence for the coordinator.
  - The same folder also holds `review-p1-selftest.json`: reviewer B's copy of run 2's JSON (§6).
- **Room imagery:** none taken. The toast shot is the Steam overlay texture, not the camera.
- **Files on the PC:** only this file in the repo. The shot, the harness and the samples are in the reviewer's
  scratchpad.

## 5. For the builder (order of work)

1. M1 items 1 to 3. Test it offline with a fake `webpackChunksteamui` that registers modules late, and live: a
   `lgs on` while `__LGS_INDEX` is deleted and the harvest is forced to see too few modules (e.g. a `lgs_index` test
   hook `minModules`). Do not crash Steam to test it.
2. M2, with a slow-install stub in RT-2.
3. M3, with a live shot next to `shots/p2_window-nav_toast.png`.
4. m8 and m9 in RT-6, m7 in the evidence log, then the rest.

---

## 6. Reviewer B: second independent pass (same round, 06:38 to 07:16)

A second review agent worked in parallel on the same device. It started selftest run 2 (§1, `nohup`, 06:56:32) and
confirms §1 to §5 from its own probes. It reached M1, M2 and M3 independently: the same `classModules: 3` log lines
(47 entries, 06:50:11 to 06:53:40), the same toast shot reading (its own shot `p2_p1rev_toast`, viewed and moved to
its scratchpad), and the same install-timeout leak. Only what is new is listed here.

**Extra re-runs.**

| Check | Command | Result |
|---|---|---|
| M2, quantified | `node h2.js <repo>` (scratchpad): a module whose `install()` waits 5.5 s, then `rt.windows.track` (class `lgs-slow`), `rt.setInterval(100 ms)` and `rt.expose('slowApi')`; `start()`, then `teardown('off')` | Module `failed` ("install() timed out after 5000 ms"); `remove()` called once, before the late work. After `teardown('off')`: `lgs-slow` still on main, **the interval fired 9 times in the next second**, `slowApi` still on the old runtime object. The teardown report says `removed: []`, `failed: ['slow']` and reports nothing left over. `lgs off`'s DOM sweep would catch the class but never the timer |
| Fallback, second variant | `fb2.py` (scratchpad; ran in `/tmp/lgs/p1revb`, deleted after): inside one `lab.Lock()`, `lgs._read` returns `throw new Error(…)` for `rt/00-rt.js` only, `lgs.op('on')`, probe, then a normal `op('on')` | **PASS**: `enabled: true`, `runtime: {runtime: 'off', reason: 'loader failed: JS: Error: review B: 00-rt.js throws at boot'}`; main keeps `lgs-on` and `#lgs-theme`; no `__LGS_RT`; restored to `running` |
| `lgs check`, planted faults | `lgs.check(root=<fixture>)` on 11 files: unclosed brace, `@keyframes` in a wrapped file (and one only in a comment), a bare declaration in a `.nowrap` file, a malformed `%{…}` in `theme/vr`, invalid `theme/popups` JSON, a duplicate module name, a JS syntax error, a badly named runtime file, broken files in `theme/_wip/` and `device/rt/_wip/` | **PASS**: 7 errors, each the planted one; the comment-only `@keyframes` is not reported; both `_wip` files listed as skipped; naming and "never calls define()" warnings |

**Additional minor findings.**

- **mB1 A user's `lgs off` never reports clean.** CLI `off` and the launcher's toggle call `disable(quiet=False)`,
  which appends `div#lgs-toast` ("Liquid Glass · Off") to main. `SWEEP_JS` then runs in the same session, finds an
  element whose id matches `^lgs[-_]` and returns `leftovers.clean: false` with `ids: ['lgs-toast']`. Any G-REMOVE
  sweep within the toast's 2.1 s sees it too. runtime.md §5 shows `clean: true`. From the code path. It was not run
  live, because a CLI `off` stops the shared daemon. Fix: sweep before the toast, or skip `#lgs-toast` while its
  removal timer is pending.
- **mB2 The input-stub comment promises a replay that does not exist.** `00-rt.js:713-714` says a stub set while P3 is
  not installed is "replayed to P3 if it installs later in the step". Only a stub carried over a reload is replayed
  (in `start()`). Nothing re-applies a stub when `input` installs after `rt.test.input.set()`. Either implement it
  (`rt.on('module')` → `input` installed → `rt.input.stub(mode)`), or fix the comment and say it in §3.6.
- **mB3 The loader wrapper runs files in sloppy mode.** `rt_module_js` wraps each file in `try { … }` inside a
  non-strict function. A module written like runtime.md §1's example (a top-level `define`) runs sloppy, even with a
  top-level `'use strict'`, which is no longer a directive inside the block. An accidental implicit global with a
  name that does not start with `lgs` is created silently and survives `lgs off`, untracked. Every current module
  uses its own strict IIFE. Fix: `'use strict'` as the wrapper function's first statement.
- **mB4 RT-6's "Steam's own files" rule is too broad.** `^~/\.local/share/Steam/` also hides any write into Steam's
  `config/htmlcache/Default/` storage (Local Storage, IndexedDB, Session Storage leveldb) and `config/*.vdf`. Those are
  the places a runtime web-storage or settings write would land. The web-storage check only reads
  `localStorage`/`sessionStorage` keys matching `/lgs/` and does not check IndexedDB. List those directories
  separately as "needs an explanation".
- **mB5 Contract drift.** runtime.md §8 gives an idle cost of about 0.1 ms/s, but the measured cost was 0.24 ms/s (the
  builder) and 0.39 ms/s (run 2). daemon.md §2 contracts `shellThemeGraceS` (default 120), but it is missing from
  `BUILTIN_FLAGS` and from runtime.md §4, which says P1 copies other packages' contracted defaults.
- **mB6 The PASS evidence is in RAM only.** The evidence log cites `/tmp/lgs/p1-selftest.json (Frame, RAM)`. Every
  run overwrites it (as run 2 did), and a reboot loses it. P10's `python glass.py selftest` now copies it to
  `shots/p1-selftest.json`: cite a kept file, or copy each final run under a dated name.

**Severity note on m8.** Reviewer B would rate m8 **major** on the letter of the severity rule ("an acceptance test
fails"): the builder's "RT-6 PASS" did not reproduce on demand. RT-6 is P1's deliverable, and V2 will rerun it as a
gate. Both reviewers agree on the substance: the persistence requirement holds, and only the test is broken. The
verdict (fix) is the same either way.

**Hygiene (reviewer B).**

- The builder's selftest JSON was downloaded before run 2 overwrote it, then put back at `/tmp/lgs/p1-selftest.json`
  (07:11). Run 2's JSON is at `/tmp/lgs/p1rev/review-p1-selftest.json`.
- `/tmp/lgs/p1revb` was removed.
- No shot was left in `shots/`, and no room imagery was taken.
- The device was left as §4 says.
