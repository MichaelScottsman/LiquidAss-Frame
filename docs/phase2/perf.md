# Glass Shell performance pass (2026-10-07)

The user said the shell "feels kinda laggy". Mid-pass, the user narrowed it down: the glass and its tracking (glassd, the compositor) feel fast enough. The lag is in the menus: they respond slowly and their animations stutter. So this pass measures and fixes Steam's UI side. glassd was measured but not changed.

Device: Steam build 11094443, shipped state (`defaults.json`: native on, every `wp.*` on), laser input mode. The device was shared with other agents the whole time, with a load average of 5 to 7. Absolute numbers are therefore noisy. Every verdict below comes from a **paired, interleaved A/B inside one locked step**: two rounds in A B B A order, never a stock run taken minutes away from a themed run.

## 1. Method

The probe is `ptrace.py`, a scratch tool that was not shipped. It ran on the Frame from `/tmp/lgsperf/` and was deleted afterwards. It holds `lab.lock` the way `lab.py` does and uses lab's `L`. It never toggles the theme or the daemon. Instead it changes the stylesheet inside the step and puts it back in a `finally`:

- `nocss`: `#lgs-theme`'s `sheet.disabled = true` in every Steam window. The runtime, the reporter and native mode keep running, so this isolates the CSS.
- `drop:RE` / `only:RE`: the theme's bundle text without (or with only) the `/* NN-file.css */` chunks whose file matches. The original sheet is disabled while a probe `<style>` holds this text.
- `dropsel:FILE@@RE` and `dropidx:FILE@@a-b`: the same, but dropping only the top-level rules of one file whose prelude matches, or a range of them by index.
- `neut:RE`: a matching rule's `selectorText` becomes `:not(*)` and is restored afterwards. A restore is checked after every step, and all of them succeeded. Unlike CSSOM delete and insert, this loses no `var()` shorthands (the C2c incident).
- `noscope`: `window.__LGS_NO_SCOPE = true` plus `__LGS.sweep()`. Every window gets the whole bundle again, which is the state before §3.1.
- **Measurements:**
  - `interact menu`: the bar's "+" opened and closed three times with `L.click`. Latency runs from the click to the first animation frame in which the barpopup document is visible with content.
  - `interact hover`: a real CDP `mouseMoved` sweep, 60 steps at 30 ms, across three poster rows of `/library/tab/AllGames`, after scrolling to the top.
  - `interact tabs`: route switches home → AllGames → settings.
  - `ab ROUTE`: `L.perf` scroll.
  - `ab --recalc`: forced subtree style recalcs of the main scroller.
  - Every interaction records rAF intervals on main: fps, p95, long frames over 34 ms, and jank (the sum of time over 11.2 ms).
  - `trace`: a Chrome trace from the browser target while one of the above runs. It reports busy time per thread, the main thread broken down (style, layout, JS by script and function), the long tasks and their children, and invalidation tracking (`--inval`).

**Probe gotcha (for P10):** a probe `<style>` appended after `#lgs-theme` is moved behind by `lgs_core.js`'s sweep every 1.5 s, because the theme always re-appends itself last. Each move is a whole-document recalc in every window, and it made my first variant runs look 3× slower than they were. Probe sheets must be inserted **before** `#lgs-theme`. The numbers below come only from the corrected probe.

## 2. Where the lag comes from

### 2.1 Before (shipped state, before any change)

| Interaction (main window) | Themed | CSS off (`nocss`) | Notes |
|---|---|---|---|
| "+" menu open: click → visible | **670–870 ms** (later 920–1070 ms, see §2.3) | 125–190 ms | One 500–800 ms task per open |
| Laser hover sweep, AllGames | **39–57 fps**, 53–83 long frames | 94–106 fps, 1–7 long | Every hover was a whole-document recalc (900–1100 elements, 80–220 ms) |
| Route switches | **26–32 fps**, max frame 565–759 ms | 82 fps | |
| Scroll AllGames (`ab`) | 53–61 fps, 15–18 long | 81–87 fps, 7 long | |
| `glass.py perf` AllGames / home / settings | 58.1 / 95.3 / 107.3 fps | 87.2 / 107 / 108 fps | Themed run taken right after theme on |

The trace of the AllGames scroll shows the renderer main thread 77 % busy. Of that, `UpdateLayoutTree` takes 1458 ms in 4.2 s against 410 ms with CSS off. Recalcs of 1470 elements cost 80–100 ms each. GPU process: `SwapBuffers` takes about 1 s in 4 s both themed and with CSS off, so the **GPU is not the bottleneck**. The jank comes from the main thread, specifically style recalcs.

### 2.2 Root causes, measured

1. **`theme/32-launcher.css` (the "+" grid) is the single largest cost, in two ways:**
   - **(a) In the barpopup, menu open:**
     - The cost is in the row-mate fade and name plate rules of §4. Those are selectors that combine `:is(:root:not(.lgs-input-laser) .gpfocus, :root.lgs-input-laser :is(.lgs-dwell…):hover, :root:not(…) :hover)` with sibling logic (`ITEM:is(…) + ITEM`, `ITEM:has(+ ITEM + ITEM:is(…))`, `:nth-child(4n+k):is(…)`).
     - Many of them end in `%{FieldLabel} > :not(%{FieldIcon})`, a rightmost compound that cannot be bucketed, so every element of the popup is matched against them.
     - The first style recalc after the pooled popup is shown costs 500–800 ms for about 300 elements, at roughly 2.6 ms per element. It is forced synchronously inside `00-rt.js`'s `visibilitychange` handler, whose show subscribers (32-launcher's `tagPopup`, `02-react`) read layout. The cost is the CSS, not the handler.
     - Dropping the rules that contain `:has(+`, `:is(:root` or `:nth-child` (they overlap) takes the open from 980 ms to **240–270 ms**. Stock is 140 ms. Dropping only one of those subsets, or only `:is(:root` without the sibling parts, gives about 900 ms. Replacing the `:root`-in-`:is()` mode test alone gives no gain.
   - **(b) In the main window:** these rules can never match there. Yet with the file in main's sheet, every laser hover in main triggered a whole-document recalc of 900–1100 elements (`noscope` A/B: 69 fps and 54 long frames, against 88 fps and 16 long frames without it). Dropping any third of the file did not help, while dropping all of it did. The cost behaves like a threshold in Chrome's `:has()` / sibling invalidation, so the fix is to keep the file out of main entirely (§3.1).
2. **`theme/40-library.css`** on AllGames hover: `drop:^40-` measured 90 fps against about 57 before §3.1. Part of that is the dwell lift's own transitions. Not bisected further (another agent's file).
3. **`03-material.css` / `04-states.css`** (mine): removing either changes hover by +5 to +10 fps at most, inside the noise.
   - The 14.6 KB `&.lgs-on:has(.gpfocus:where(…))` FocusRing rule on `<html>` gives 175 `:has()` invalidations on `<html>` per 3 s of scrolling, but neutralizing it measured no gain (scroll, hover, recalc). The same holds for the `@container style(--lgs-ill…)` hooks (`neutpath:@CSSContainerRule`).
   - The registered `@property` progress values (`--lgs-hover`, `--lgs-focus`, …) are animated on the main thread. They appear as many `Animation` style recalcs on posters and their `::before`/`::after`, but each costs per element (non-inherited) and is not a jank source on its own.
4. **Runtime JS on input paths** (hover trace, 8 s, before §3):
   - reporter `tick` 1032 ms;
   - `05-attention.js` `over` 969 ms;
   - `06-states.js` light spot (`flushSpot`, `getBoundingClientRect` per pointer frame) 393 ms.
   - Most of that time is the forced style recalc these reads trigger, which is the same CSS cost paid earlier. With CSS off the same modules cost almost nothing and hover runs at 106 fps.
5. **Route switches** are mostly Steam's own React work. Each switch also has 80–130 ms forced recalcs from runtime timers (`00-rt.js:535` is the scoped `setTimeout` wrapper, so the module is not visible in the trace), `40-library.js:167` and `20-shell.js:576`.
6. **Custom-property load:** 219 tokens on `<html>` (36 never read: see the list in §4). An isolated test (250 dummy vars on stock CSS) looked expensive, but that test was distorted by the probe gotcha above. With the corrected probe, the theme plus 250 extra vars cost nothing measurable, so **the token count is not the problem**.

### 2.3 Drift during the pass

At about 22:40 the menu-open baseline moved from about 700 ms to about 980 ms. Neither of my changes caused it: an in-step `noscope` A/B gives 973–1072 ms with and without §3.1. Other agents were syncing the theme throughout.

### 2.4 Native layer, compositor, polling (measured, not changed per the user)

- glassd: `gpu_ms` 1.45–1.67 per rendered frame. It already renders only on head motion over 0.08°, layout changes or room updates (≤ 6 Hz), so `fps` is 0–7 with the headset idle and the dashboard up. Room updates: `room_ms` 0.43 at ≤ 36 Hz.
- Scene-graph pushes at rest: 0/s (`__LGS_SG.status().pushesLastSec` 0, `pushes` unchanged over 15 s). Pushes happen only on layout changes, capped at 15/s.
- Reporter at rest: one safety resample every 2 s (about 0.5 ticks/s, 0 emits over 27 s); avg 3.35 ms per tick, max 91.6 ms (during interactions).
- `lgs_core.js` sweep: every 1.5 s. It used to read and compare the whole ~0.9 MB `textContent` of every window's sheet (9 windows) on each sweep (`sweep` 15–40 ms per 4–8 s trace).
- Daemon: pings the reporter and `__LGS_SG` at 1 s; `__LGS_NATIVE` heartbeat at 1 s; glassd-out watched at 10 Hz.
- The SteamVR compositor's own frame timing was not read in this pass (out of scope after the user's feedback).

## 3. Changes (files this pass may edit)

### 3.1 `device/lgs_core.js`: per-window stylesheet scoping and a cheap sweep

- A `SCOPED` list keeps an area file out of every window it can never style. Today the list has one entry: `32-launcher.css` goes only into `*.barpopup.*` windows.
  - Each window gets the bundle minus those chunks, cut at the bundler's `/* NN-file.css */` markers. The variants are cached per scope signature.
  - Main, the bar, the HUDs, the keyboard and the notifications no longer carry the launcher's rules. The barpopup windows still get the whole bundle, so the "+" grid is unchanged (checked with a shot).
- The sheet's identity is now `data-lgs-key` (theme version + scope) instead of comparing the 0.9 MB `textContent` per window every 1.5 s.
- `window.__LGS_NO_SCOPE = true` with `__LGS.sweep()` restores the old behaviour for A/B tests. It is a test hook only; it was deleted again on the device.
- **A rule that must also reach another window does not belong in a scoped file.**

### 3.2 `device/lgs_layers.js`: reporter sampling cap 30 Hz → 15 Hz

`MIN_TICK_MS` 33 → 66. `lgs_sg.js` pushes at most 15 times a second, so the extra samples were never shown, while each one forced a style and layout flush mid-frame during transitions.

- The reporter's `tick` in the hover trace: 1032 ms before, 720 ms after (§3.1 also took part of its forced recalcs away).
- Popped layers are already held back until their element settles, so nothing visible changes.

### 3.3 Not changed

- glassd, `lgs_shell.py`, `lgs_sg.js`, `00-rt.js` and the three CSS files of this pass. The measurements gave them no share worth a change, and the user ruled glassd out.
- **Deferring `00-rt.js`'s `onShow` subscribers** past the first frame was considered and rejected. The forced recalc is needed for the popup's first frame anyway, and deferring the launcher's tags would flash the untagged list for one frame.

## 4. After (same probes, same session)

| Interaction | Before | After | Stock (CSS off) |
|---|---|---|---|
| Laser hover sweep, AllGames | 39–57 fps, 53–83 long | **85–90 fps, 12–17 long** | 94–107 fps |
| Same, in-step A/B of §3.1 alone | 68.6 fps, 54 long (`noscope`) | 86.8–89.5 fps, 15–17 long | |
| Route switches | 26–32 fps, max 565–759 ms | **42–51 fps**, max 380–398 ms | 83 fps |
| Scroll AllGames (`ab`) | 53–61 fps | **66–72 fps** | 81–82 fps |
| `glass.py perf` AllGames / home (long frames) | 58.1 fps / 9 long | **64.6 fps** / 2 long | 88.2 fps |
| "+" menu open | 670–870 ms | 920–1070 ms (drift §2.3; §3.1 neutral in-step) | 140 ms |

The menu is still slow. The remaining fix is in a file this pass may not edit (§5, item 1). It is the biggest remaining item for the user's complaint.

## 5. Recommended changes in files owned by others

1. **`theme/32-launcher.css` (C2b): the plate and row-mate rules of §4. Highest impact: the "+" opens in about 250 ms instead of about 1 s.**
   - Remove the `:has(+ ITEM …)` / `:has(+ ITEM + ITEM …)` forms. The runtime already measures the plate and tags right-hand row-mates (`data-lgs-c2b-under` l1–l3 / r1–r3). Let it also put one attribute on every covered mate, e.g. `data-lgs-c2b-dim` on the mates themselves, and make the CSS `ITEM[data-lgs-c2b-dim] %{FieldLabel} > … { opacity: .22 }`. That drops every previous-sibling `:has()` and every `:nth-child(4n+k)` fallback.
   - Take the input-mode test out of `:is(:root… …)`. Split each rule into `&:not(.lgs-input-laser) … ITEM.gpfocus`, `&.lgs-input-laser … ITEM:is(.lgs-dwell:not([data-lgs-c2b-step]), .lgs-attend-400[data-lgs-c2b-step]):hover` and `&:not(.lgs-input-laser):not(.lgs-input-pad) … ITEM:hover`. No `:root` should sit inside `:is()` or `:has()`.
   - Give the label rules a bucketable rightmost compound. Use a class the runtime sets on the label text node (or Steam's own label class) instead of `%{FieldLabel} > :not(%{FieldIcon})`.
   - Scope the file's guard `%{DashboardBarPopupList}:has(> %{DashboardBarPopupListHeader})` by a class the runtime puts on the list (`.lgs-c2b-grid`), once T2 is running.
   - Measured upper bound: without those rules, the open takes 240–270 ms against 920–1150 ms.
2. **`theme/40-library.css` (C2c), hover on AllGames:** `drop:^40-` measured 90 fps against 57. Bisect the dwell-lift rules (the poster lift transitions, the More circle, `--lgs-lift`), and prefer `scale` / `translate` / `opacity` transitions on the poster only, with no `box-shadow` transitions on posters (C2c's own suspect list in `C2c-review-R2.md`).
3. **`theme/20-shell.css`, `theme/60-settings.css`:** no measurable share in these probes (hover: `drop:^20-` within noise; settings scroll stays at stock). Nothing to change for performance.
4. **Every area: the selector rules that made the launcher slow.** Never put `:root …` inside `:is()` / `:where()` / `:has()`. Avoid `:has(+ …)` and `:has(~ …)` on lists; tag from the runtime instead. Avoid rightmost compounds that are only `:not(…)`, `*` or a pseudo-element without a class.
5. **Runtime modules (input paths):**
   - `06-states.js` `flushSpot` reads `getBoundingClientRect` on every pointer frame. Cache the host's rect on `pointerenter` and refresh it only on scroll or resize.
   - `05-attention.js` `over` (969 ms in an 8 s hover trace): look for layout reads per `pointerover`.
   - Find the `rt.setTimeout` callers that force 80–130 ms recalcs after a navigation (route-switch trace).
6. **Unused tokens in `00-tokens.nowrap.css`** (36, never read in theme/ or device/): `--lgs-badge-h --lgs-control-outline --lgs-delay-back-title --lgs-delay-dwell --lgs-delay-reveal --lgs-delay-reveal-out --lgs-delay-tab-label --lgs-field-gap --lgs-focus-glow --lgs-focus-outline --lgs-focus-ring --lgs-focus-ring-outer --lgs-fs-title2 --lgs-fs-xl1 --lgs-glass-bg --lgs-glass-blur --lgs-home-disc --lgs-knob-shadow --lgs-m-popup --lgs-m-vr-frame --lgs-mat-panel-blur --lgs-mat-window-blur --lgs-menu-min-w --lgs-menu-scrim-blur --lgs-play-w --lgs-slider-fill-2 --lgs-spring --lgs-t --lgs-t-slow --lgs-target-gap --lgs-track-xl --lgs-type-xl1 --lgs-type-xl2 --lgs-window-bg --lgs-window-rim --lgs-window-sheen`. Not removed: the contract in `tokens.md` may list them, and the probe found no measurable cost.

## 6. Lab requests

- REQ perf->P10: `lab_helpers.js` caches `SINGLE` at install. After a Steam UI renderer restart, the helpers were re-installed in `SharedJSContext` before `g_PopupManager` existed. They stayed in single-page mode (`L.surfaceName('main')` = `vr:SharedJSContext`), so every lab step addressed the wrong window. Fixed by hand at 22:05 (`delete window.__LGS_LAB`). Suggestion: re-check `typeof g_PopupManager` in the version guard, so a single-mode install made in `SharedJSContext` is redone.
- REQ perf->P10: probe stylesheets inserted by lab tools must go before `#lgs-theme` (§1).

## 7. Incident (disclosed)

- **What happened:** at 21:59 a Chrome trace with the `disabled-by-default-blink.debug` selector-stats category, over a 4 s scroll and then over 3 forced recalcs, made Steam's main UI renderer (pid 4265, running 4 h) crash. The cause is presumably the memory the per-recalc selector statistics of a 0.9 MB sheet need.
- **Recovery:** Steam respawned the renderer by itself (pid 111897) within seconds. Steam and SteamVR were not restarted. The theme came back (another agent's `lgs on`, 22:02) and the daemon reconnected in native mode. The lab helpers had to be reset (§6).
- **Afterwards:** selector-stats tracing was not used again, and nobody should use it on the Frame.

The device was left in the shipped state:
- the theme is on, `lgs-shell` runs `native` and glassd is healthy;
- no session flags are set;
- `window.__LGS_NO_SCOPE` is deleted;
- `/tmp/lgsperf` is removed;
- no hv frames were taken.
