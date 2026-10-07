# P7 Scene graph: review R1 (independent, adversarial)

Reviewer session: 2026-10-07, 09:38 to 10:04. Steam build 11094443. The installed `device/lgs_sg.js` was checked
equal to the tree (md5 84581c98). **Verdict: fix**, because of 1 blocker and 1 major finding.

The card's own tests re-run green. But a native-mode headset look found that P7's copies of the frame-menu (tab
bar) surface are placed in the wrong spot, so the tab bar shows twice. This is a stuck, visible defect, and no
SG test covers a popup parent. A spec without `window` also leaves the window dimmed.

## 1. What was re-run on the live device

The reviewer's own probes are scratch scripts, not in the tree. The suite and SG-6 use the builder's tools
unchanged. Every headset frame was looked at, then deleted on both machines: `/tmp/lgs/p7rev/hv` is empty and no
local copy is kept.

| Test | Command (on the Frame) | Result |
|---|---|---|
| Full suite | `flock native.lock flock lab-vr.lock python3 native/spike/sg_test.py device/lgs_sg.js all --motion` (09:40-09:41) | **13/13 PASS**, matching the builder's `suite_final.jsonl`. SG-1: max err 0.0002 mm, 28 pushes, 0 after the settle, final at 443 ms, token `depth` d 0.3 b 0. SG-2: 5101 sgids created, live = dom = 7, 0 / 0 after `clear()`. SG-3: TTL restore at 4.55 s. Cleanup `absent` |
| SG-3 headset look | `sg_test.py ... sg3 --motion --grab` (09:46) | PASS. The frame-controls capsule moved left by about 35 px of a 290 px wide window (about 12 %, which matches 120 mm), at the same size. It came back after the rule was removed |
| SG-3 "DumpLaserOverlays shows the target moved" | reviewer probe: full `DumpLaserOverlays` entry for `legacy-frame-controls-*` before, during and after a -120 mm override | The entry is **byte-identical** during the move. It has no position field (`laser_overlay`, `overlaystate`, `scene_graph_panel` with size and flags only), so the card's wording cannot be met this way. The move is proven by the DOM value and the headset look above (minor m1) |
| SG-6 (daemon) | `python3 native/spike/sg_native.py sg6` (P10 native-session, 09:47-09:49) | **PASS**. Nodes off 12.45 s after the last heartbeat. Cover pushed again 0.10 s after SIGCONT |
| SG-6, whole node set | reviewer probe `p7rev_sg6.py` (native-session, 09:49-09:52, `/library/tab/Collections`): samples every 0.1 s after SIGCONT | **PASS**. At 0.10 s: cover + 1 base (the daemon's first, partial spec). At **0.31 s: all 31 items back** (14 base, 5 pops, 5 slabs), the same as before the stop. Headset frames at 1 s and 4 s matched the frame taken before the stop |
| Watchdog with a window dim | reviewer probe (`__LGS_SG_REV`, 5 s watchdog) | PASS. Tint on t1's parent; the watchdog fired at 5.3 s and the node went back to a plain transform; a ping put the tint back; `{dim: 1}` restored it |
| Reduce Motion (P-56) | reviewer probe | PASS. With `reduceMotion: true` a pop goes to 0.0407 in one push (1 push, 0 timeline frames), a leaving pop is removed at once, and a window dim jumps (0 timeline frames) |
| Malformed input | reviewer probe: `update(null)`, `surfaces: 'x'`, NaN or negative rects, a pop without id, bad `dim` / `mosaic` / `dimSlabs` / `slabsOut` / `cut`, an invalid selector, an unknown target, `windowState({dim: 'abc'})` | No exception. Bad entries were skipped; the invalid selector shows up in `overrides.errors`; live = dom |
| Removal | after every probe | No `__LGS_SG*` and no `__LGS_MOTION` left, no `lgs-sg-root*`, t1 and the frame controls back to their first values, daemon `css-only` with `sgRules.active` empty |

## 2. Findings

### B1 (blocker): in native mode the frame-menu (tab bar) copies are misplaced and the tab bar shows twice

- **Evidence.** Native session, 09:53-09:55, `/library/tab/AllGames`, reviewer probe `p7rev_fmenu.py`. Three
  headset frames were taken: A = as the daemon built it, B = the daemon instance's spec with the
  `frame.menu.85100005` surface removed (P7's 2 items for it gone, everything else unchanged), C = spec restored.
  - A and C show **two tab-bar capsules**. The front one is a sharp copy with the current icons, shifted about
    18-20 px left in a 960 px frame (about half the capsule's width). A grey glass rectangle, the cover, sits
    behind it with the same shift. Steam's real capsule sits to the right, half hidden, so its icons read as
    halves (the Store tag's right half looks like a play arrow).
  - B shows **one clean capsule**, at the real panel's position.
  - The same doubling is visible in every native frame of this session (`/library/tab/Collections` at 09:51,
    before, during and after SG-6).
- **Data.**
  - P7 places the frame-menu cover and base at `panel-anchor` (0.5, 0.5), uv [0.773, 0.18, 1, 0.82], 102 x 768 px.
    The size equals the real laser panel (0.1561 x 1.1757 m).
  - Steam's real `PooledPopup-valve.steam.gamepadui.frame.menu.*` panel has `origin: [1, 0]` and an asymmetric
    displayed range (x 0.773..1).
  - The bar (`origin [0, 1]`, x range 0.153..0.847) and the floating footer (`origin [0, -1]`, x range
    0.292..0.708) have symmetric ranges and line up; NATIVE fact 3 verified only those two.
  - The likely cause is the anchor math in `describe()` / `parentInfo()`: it ignores the parent panel's `origin`,
    or assumes the displayed range is centred on the panel's pivot. This is not proven: the builder must pin it
    down with a debug-tinted copy.
- **Why it is a blocker.**
  - The tab bar is the primary navigation. In native mode the copy the user sees is not over its laser target.
    P7's copies are `interactive: false`, so the laser passes through them to the real panel to the right, and
    a click on a visible icon lands on another tab or on nothing.
  - It also fails G-HV ("no doubled element"), and it is exactly the "stuck node visible to the user" the
    coordinator warned about.
  - The CSS-only default is not affected.
  - The SG suite never builds a popup parent (only `valve.steam.gamepadui.main`), so nothing caught it. SG-5's
    frames contained it too: the log says "frame menu ... unchanged", because only luma was compared.
- **Fix.**
  - Take the parent panel's `origin` (and the asymmetric uv range) into the anchor and origin of every item.
  - Add a test (for example SG-POPUP): in a native session, for every popup parent in the live spec (bar,
    floatingfooter, frame.menu, a barpopup), put a debug-tinted base copy and take an `hv` look with the A/B
    method above (copy present vs removed). Pass = no lateral offset.
  - Re-check the SG-5 frames for this.

### M1 (major): a spec without `window` leaves the window dimmed or receded (no restore, the TTL does not work)

- **Evidence.** Reviewer probe (09:44):
  - `update({window: {dim: 0.5}})`, then `update({...})` with **no** `window` key, then with `window: null`.
    After both, `status().window.dimTarget` was still 0.5, and t1's parent was still serialized as `tint` [0.5,
    0.5, 0.5].
  - Only an explicit `windowState({dim: 1})` restored it.
  - Code: `update()` calls `setWindow()` only when `spec.window` is an object (lgs_sg.js line 942).
- **Why it matters.**
  - P8's `spec_top()` leaves `window` out whenever no request is active (`lgs_shell.py` ~1505). So when CC-A's
    `data-lgs-window-dim` goes away, or the built-in `sgwindow` action's TTL expires ("window state request
    expired; restoring" in the daemon), nothing is restored. The window stays at 0.6 for as long as
    `lgs_sg.js` stays installed: always in native mode, and in CSS-only mode while any sg rule is on.
  - Nothing calls it today: CC-A is gated, S7 is off, there is no `sgwindow` caller, and SG-WIN only tests
    `windowState()` with an explicit restore. So it is not yet a blocker, but it becomes a stuck, visible tint
    the day C3b wires CC-A in.
- **Fix.** The spec is declarative (`surfaces[].dim` absent already animates back to 1), so treat an absent or
  null `window` in `update()` the same way: back to `{dim: 1, recede: 0}` on `sheet-out`. Document it in sg.md
  §3.1 and add the case to SG-WIN. Telling P8 to always send `{dim: 1, recede: 0}` would also work, but the safe
  default belongs in the page.

### Minor

- **m1, SG-3 wording.** `DumpLaserOverlays` carries no position for the frame controls; the entry is identical
  during the move. The PASS rests on the DOM value and the headset look, both of which hold (§1). Say so in the
  log rather than "DumpLaserOverlays shows the target moved".
- **m2, fails open without the retire export.**
  - The retire export is found by an exact regex on minified source
    (`/^function\s*\w*\((\w+)\)\{\w+\.push\(\1\),\w+\(\)\}$/`).
  - If a SteamVR update breaks that match, `sched.retire` is null. `lgs_sg.js` keeps building and removing
    nodes, only counting `noRetire`. SP §9.1 measured that about 45 leaked panels stop new panels from
    rendering.
  - Fail closed instead: with no retire export, build nothing (or the cover only, never removed until
    `destroy()`), and report `scheduler.error`.
- **m3, residue in `webpackChunkvrwebui`.**
  - `locate()` pushes `[[Symbol('lgs-sg')], {}, cb]` on every install, and the entry is never removed.
  - Measured in systemui: 180 Symbol entries at 09:44, 187 after the reviewer's 7 installs.
  - It is invisible and outside G-REMOVE's list, but it is something `lgs off` leaves behind. Splice the entry
    back out after `locate()`.
- **m4, only `ping()` rebuilds after an expiry.**
  - `overrides()`, `windowState()` and `test.yaw()` call `contact()`, which clears `expired`, but they do not
    rebuild the last spec. If one of them is the first call after a watchdog expiry, the nodes stay off until
    the daemon sees `items == 0` and resends (it does).
  - Fix: rebuild in `contact()` itself, or document that `ping()` must come first (P8 does that since 09:26).
- **m5, `destroy()` is not try/finally.** If `clear()` throws, the 500 ms interval keeps running and the global
  stays. Wrap it so `clearInterval`, `destroyed = true` and the `delete` always run.
- **m6, idle housekeeping.**
  - While installed, the 500 ms tick re-reads parent geometry on every call (`parentSig()`: DOM queries plus
    `buildNode()` on each popup and the frame node), and with rules active it also runs `applyOverrides()`.
  - Pushes at rest stay at 0 (SG-RATE, re-checked in the SG-6 samples), so this is light, but it is work at
    idle. Consider skipping when nothing changed (a `MutationObserver` on the popup elements) or a slower tick.
- **m7, test-tool safety.**
  - `sg_native.py sg6` and `daemon` SIGSTOP `lgs-shell` and send SIGCONT only from a Python `finally`. A killed
    script or dropped SSH session (SIGKILL / SIGHUP) would leave the daemon stopped.
  - Add a detached guard such as `sh -c 'sleep 20; kill -CONT <pid>'` before the stop.
- **m8, stale text.**
  - `contracts/sg.md` §7 still says "Open: REQ P7->P8 ... summon key"; P8 closed it at 09:32.
  - The SG-5 evidence row says the frame menu was "unchanged", but the frame menu was doubled in those frames
    (B1).

### Observed in native frames, outside P7 (for P9 / P6 / V1, not counted here)

- The bar's covers and the Steam / "+" circles show a **bright, even white rim**. It reads as an outline, the
  same issue as native-e2e §2, "rims read as outlines". It is glassd's rim (P9). Size and placement of P7's bar
  cover match the real panel (1.9105 x 0.1837 m).
- On `/library/tab/AllGames` blurred poster tiles show through the header band, with the room between them, in
  native mode (P6 / C1a / C2c covers and mosaic bands).
- Steam / SteamVR tooltips ("Launch Program", "Toggle Room View", "Hide Laser Mouse") were open in every frame,
  CSS-only too, and a Playspace menu was open at 10:02. Another agent left them; P7 has nothing to do with them.

## 3. Checklist

| Item | Result |
|---|---|
| (a) Ownership | **OK.** Every changed file is in P7's set (PLAN §2.6): `device/lgs_sg.js`, `contracts/sg.md`, `wp/P7.md`, `native/spike/sg_*.py`, `native/spike/p7_results/`. `theme/sg/00-base.json` is unchanged since f5190bb. The edits to `wp/P10.md` (a P7 line under REQ P10->P7) and `wp/P5.md` (REQ P5->P7 marked `[x]` with a P7 answer) are the REQ protocol. No open REQ is addressed to P7 (`grep "REQ ...->P7:"`) |
| (b) Safety | **OK with m7.** Nothing persists: page state only, runtime files under `/tmp/lgs/p7`; the builder's `/tmp/lgs/p7/hv` is empty. `lgs off` / `destroy()` removes the nodes, overrides, root and global, but not the webpack entry (m3). Tests take native.lock + lab-vr.lock (+ lab.lock for routes) and native work goes through P10's native-session. Nothing from the never-list: `rate` only moves gamepad focus left and right |
| (c) Robustness | **Fix.** M1 (stuck window state); m2 (fails open without retire), m4, m5, m6. The watchdog, TTLs, re-attach and malformed input are robust (§1) |
| (d) Conformance | P-11 OK (`hide-laser-*` can never be set: not in `FLAG_KEYS`). P-55 OK (bounce ≤ 0.25 in every token). P-56 OK (live probe). P-51 OK (recede only moves away). P-49 is not enforced in P7 by design (contract §3.4: the depth rules and G-DEPTH cap it). P-06's laser delay belongs to P6's dwell. **G-HV "no doubled element" fails on the tab bar (B1)** |
| (e) Function retention | CSS-only: the overrides keep the frame controls' laser panel size and interactivity (SG-3); pops are `interactive: false` in the default profile; the gamepad is unaffected. **Native: the tab bar's laser path is broken by B1** (the visible copy is not over its target) |
| (f) Visual quality | P7's own placement: the main window's base, pops and slabs line up; the bar and footer line up; **the frame menu does not (B1)**. Other native visual issues are listed above for P9 / P6 / V1 |

## 4. Device state at the end (10:04)

- Daemon `css-only (CSS only requested)`, `sgRules.active` empty.
- In `vr:systemui`: no `__LGS_SG`, `__LGS_SG_TEST`, `__LGS_SG_REV` or `__LGS_MOTION`, no `lgs-sg-root*`. Frame
  controls at `0 -0.04 0`; t1 `0 0 0` / `1 0 0 0`, and its parent is a plain transform.
- No headset frame left on either machine.
- Every native session ended in CSS-only mode (checked after each).
- The reviewer set no flags. The flags in `/tmp/lgs/flags.json` (`wp.c1a`, `wp.c2c`, `wp.p3`) are other agents'
  step flags.

## Recheck (coordinator)

Session 2026-10-07, 12:45 to 12:56. Steam build 11094443. Independent recheck of the R1 fixes on the live device;
the fix log was not taken on trust. **Verdict: B1 and M1 are fixed.** Two items remain open, both outside P7's
code (§5 of this section). No P7 file was changed, and nothing was committed.

### 1. Installed file

- `md5sum device/lgs_sg.js` on the Frame (`~/.local/share/glass-shell`) and in the tree: both
  `1523504080d697d508dd86b694cb8f91` (P7.md's "15235040"). `motion.js`, `sg_test.py` and `sg_native.py` also match
  the tree.
- In native mode the daemon's own instance reports `version` `f14d16cf2e+a9fdddd1dd`. This equals sha1[:10] of the
  tree's `lgs_sg.js` plus `motion.js` (`lgs_shell.sg_source_version()`), so the fixed code is the code that runs.

### 2. B1 in native mode, with the real daemon

Two `python glass.py native-session` runs were needed, each with `native.lock` waited 0 s and the native layer
ready in 2.6 s. Both ended with "back to CSS only: yes". The native-session code path is unchanged: a scratch
wrapper calls `glass.main()` and only saves the raw `sgcheck` models, because inside a session `sgcheck` prints its
summary only.

- **Why a second session.** In session 1 (12:46:49), the two `hv` steps carried their own `--mode laser`, but an
  `hv` step inside `native-session` ignores its own step options: `lab_p2cmd.run_step()` calls `hv_grab()` without
  `parse_step()`. Only the two `sgcheck` steps logged `step: mode=laser`. So session 1's looks were taken in pad
  mode, where P6 does not report the laser-only frame menu and P7 builds no frame-menu copy. That is the same
  caveat the fixer gave for the SG-5 rerun. Those looks are not counted for the frame menu.
- **Session 2 (12:54:39).** Run as `native-session --mode laser`; the session-level options reach every step, and
  all 4 steps logged `step: mode=laser via rt.test.input.set native=on`. Route `/library/tab/AllGames`. The steps:
  - an `hv` look with "+" open (PLUS_OPEN, as in `sg_native.py`), `--full`;
  - `sgcheck` with the same route, pre and settle;
  - an `hv --offaxis 25` look;
  - `sgcheck` with the same route and settle.

  Each `sgcheck` repeats the conditions of the look just before it.

**P7's popup items in the daemon's spec.** Read from the raw `__LGS_SG.dump()`; the values were the same in both
sessions.

| Parent (live) | Displayed uv (texture) | Cover and base anchor | Displayed centre | `curv` |
|---|---|---|---|---|
| `frame.menu.92520005`, 450 x 1200, origin [1, 0] | x 0.7267..1, y 0.1017..0.8992 | **(0.863333, 0.500417)** | (0.863333, 0.500417) | none (inherit: the frame menu names no origin) |
| `barpopup.92520001` ("+"), 450 x 1536 | x 0..1, v 0.2910..1 | **(0.5, 0.645508)** | (0.5, 0.645508) | `system.systemui::DashboardCurvatureOrigin`, no `inherit` |
| `bar`, 1800 x 120 | x 0.1606..0.8389 | (0.499722, 0.5) | (0.4997, 0.5) | the same origin |
| `floatingfooter`, 900 x 60 (session 1) | x 0.2911..0.7078 | (0.499444, 0.5) | (0.4994, 0.5) | the same origin |

- Steam has resized the frame menu since the fix session (957 px shown, not 768). The anchor followed it, at
  0.8633 rather than the fix log's 0.8867. This shows that the anchor comes from the live range and is not a
  hard-coded value.
- Every item is `connected` and pushed, and `interactive: false`. The main window's items keep `inherit`.

**Looks** (each frame looked at, then deleted at once on the PC; `glass.py` deleted the Frame copy as it fetched it).

| Frame | What it shows |
|---|---|
| `p7rc_look2`: laser mode, "+" open, full size | **One tab-bar capsule.** A 2x crop of it shows each icon once and sharp, with no ghost half a capsule to the left (the R1 picture). The "Launch Program" popup has single, sharp glyphs and curves with the popup. There is no flat middle strip and no z-fighting hatching (the "inherit" defect). `hv` doubling score 0.218 at 15 px, not doubled; the verdict is withheld because the rect was auto-detected |
| `p7rc_off2`: laser mode, window yawed 25 degrees (`test.yaw`) | Window turned, **one tab bar** turning with it, no copy left behind or offset |
| Session 1, `p7rc_look` and `p7rc_off` (pad mode) | Same picture, one tab bar. Not counted for the frame menu (see above) |

- The bar and the floating footer were below the bottom edge of every headset frame in this session. The idle
  headset's pose puts the window in the lower half of the view. So no look covered them; the dump does.
- `sgcheck` (4 runs): overall FAIL on **R2 only**: `main/tab-arrow` and `tab-arrow.1` at dz 4.43 mm. The report asks
  for 0.012 units. This is Phase 1's legacy `tab-arrow` layer (`theme/layers/99-legacy.json`), which C2c
  supersedes only while `wp.c2c` is on, and that flag is off now. P7 places it exactly as reported
  (`z` 0.012), so this is not a P7 finding. No R8 failure: no node is interactive in the default profile.

### 3. The suite, re-run

All runs were on the Frame against the installed file, and every test was run under its documented locks.

| Test | Command / result |
|---|---|
| Subset of the page suite | `flock -w 1800 native.lock flock -w 240 lab-vr.lock python3 -B native/spike/sg_test.py device/lgs_sg.js sg1,sg2,sg3,sg4,win,win2,yaw,revive,chunk,failclosed,sg6 --motion` (12:48-12:50): **11/11 PASS**, cleanup `absent`. Per test below |
| SG-1 | Max error 0.0002 mm against the closed form; 28 pushes during the step, 0 after the settle (452 ms); `motion.js`, token `depth` |
| SG-2 | 300 cycles: 5101 sgids created; live = dom = 7; 0 / 0 after `clear()`; `noRetire` 0 |
| SG-3 | Frame controls `0 -0.04 0` -> `-0.3252033 -0.04 0`; laser size unchanged (0.768 x 0.168); restored by `clear()`; **TTL restore after 4.53 s** (5 s test watchdog) |
| SG-4, SG-WIN | PASS (cover 1/1 and base 4/4 wrapped at 0.6, pop and slab not; window dim and recede, then restored) |
| **SG-WIN2 (M1, page)** | Same state again: **0 pushes**. No `window`: t1 back to its React values, no own node, `dimTarget` 1. `window: null`: the same. `reduceMotion` jump back: restored in one step |
| SG-YAW | Hook TTL restored after 1.55 s |
| SG-REVIVE, SG-CHUNK, SG-FAILCLOSED | PASS: 4 of 4 first calls revive; webpack chunk length 18 -> 18 with 0 `lgs-sg` entries; no retire export means 0 items and the "fail closed" error |
| SG-6 (page) | Nodes and override off **12.11 s** after the last heartbeat; back **0.01 s** after the ping (`rebuilt`) |
| **SG-POPUP** | `python native/spike/sg_popup.py --out <scratch> --look <scratch>` (12:50-12:51; `--out` sent to scratch so `p7_results/popup.jsonl` stays as it was). **Frame menu: anchor 0.863333/0.500417, leak behind 0.0, control (old anchor) 2.211. "+" bar popup: anchor 0.5/0.645508, origin named, copy front 13185 px, leak 0.004, control 0.527.** The script's overall verdict is FAIL only because the bar and the floating footer had `front` 0: their tinted copies were outside the headset frame (pose, §2). The look strips were viewed and then deleted. Frame menu: in A the magenta copy sits exactly over Steam's capsule; B shows nothing; C (old anchor) shows the doubled tab bar. Bar popup: in A a whole curved copy; B shows nothing; C a copy shifted a quarter up. sgids 20 created, 20 retired, live = dom = 0 |
| **M1 with the real daemon** (new) | Scratch probe `p7rc_m1d.py` (CSS only, under `native.lock`, `lab.lock` and `lab-vr.lock`; step flag `tabBarDepth`, so an sg rule keeps `lgs_sg.js` installed: the case that failed in R1), then the daemon's built-in `sgwindow` `{dim: 0.6, ttlMs: 4000}` through `window.lgsAction`. Result: t1's parent tinted from 0.26 s (`tint` 0.6). The daemon's request expired; at 4.31 s `dimTarget` was 1, and by 5.07 s the tint node was gone, **while `__LGS_SG` stayed installed with `tabbar-depth` applied**. Flag off: `__LGS_SG` removed 1.01 s later, and t1 and frame-left back to their first values. **PASS** |
| SG-3d (daemon watchdog and TTL, CSS only) | `flock -w 1800 native.lock python3 -B native/spike/sg_native.py daemon` (12:52:46): installed 1.82 s after the flag (version `f14d16cf2e+a9fdddd1dd`); daemon SIGSTOP: **the watchdog restored the chrome 12.63 s after the last heartbeat**; SIGCONT: re-applied after 0.05 s; flag off: removed after 1.01 s, chrome as before. **PASS** |

Not re-run: SG-6 with the daemon in native mode (`sg_native.py sg6`), because it needs a third native session. The
watchdog is covered by the page SG-6 and by SG-3d with the real daemon frozen, and the R1 page change (m4) by
SG-REVIVE.

### 4. Removal and device state at the end (12:55)

- Both native sessions returned to CSS only (confirmed by `native-session`).
- Daemon state: `css-only (CSS only requested)`, native `enabled: false`, `sgRules` `{active: [], window: null}`.
- In `vr:systemui`:
  - no `__LGS_SG*` and no `__LGS_MOTION`;
  - 0 `lgs-sg-root*`;
  - 0 `Symbol('lgs-sg')` entries in `webpackChunkvrwebui`;
  - frame controls at `0 -0.04 0`;
  - t1 at `0 0 0` / `1 0 0 0`, with a plain (not tinted) parent.
- Flags:
  - The recheck left no flag on. The one step flag it used, `tabBarDepth` (in two tests), was given back at each
    lock exit.
  - `/tmp/lgs/flags.json` holds only other agents' keys (`c2bToggle`, `wp.c1a`, `wp.c2b`, `wp.p3`).
- No headset frame or look strip is left on either machine:
  - on the Frame: no `/tmp/lgs/hv-*.png`; `/tmp/lgs/p7/hv` and `/tmp/lgs/p7/pop` are empty;
  - on the PC: no `lgs-hv-look-*` folders, and the legacy `lgs-hv` folder is empty;
  - the scratch dir `/tmp/lgs/p7rc` is removed, and `sg_popup.py`'s idle reaper was stopped.
- Steam and SteamVR were not restarted; nothing was launched; no settings were changed and no dialogs confirmed.

### 5. Still open (none blocks B1 or M1)

- **SG-POPUP on the bar and the floating footer was not measured in this pose.** Both copies were out of the
  headset frame. Their anchors equal the displayed centre (the dump, §2), and the fix session measured leaks of
  0.001 and 0.002 at 12:40. Re-run `sg_popup.py` once the bar is in view.
- **P10 (lab, not P7):** an `hv` step inside `native-session` ignores its own `--mode` / `--flags` / `--media`,
  because `run_step()` sends it to `hv_grab()` without `parse_step()`. Session-level options work around it.
  Any native `hv` look that relied on a per-step `--mode laser` was in fact taken in pad mode, with no frame-menu
  copy built.
- **Not P7:** `sgcheck` R2 on the legacy `tab-arrow` pop (4.43 mm) while `wp.c2c` is off (C2c / P6).
- REQ P7->V1 (NATIVE fact 3 wording) and REQ P7->C1a (the frame menu's square-cornered glassd cover) are still
  open with their owners.
