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
