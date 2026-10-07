# P3 Interaction runtime: independent review, round R1

- **Reviewer:** independent adversarial reviewer (not the builder). Date 2026-10-07, 06:38 to 07:05 (Frame clock, EDT). Steam build **11094443** for every live row.
- **Scope:** PLAN §2.3 card "P3 Interaction runtime" (IN-1 to IN-9), the builder's report (M3, done), `docs/phase2/wp/P3.md`, `contracts/interaction.md`, `device/rt/04-input.js` … `07-tooltip.js`.
- **Method:** my own runner (`<scratch>/p3rev/p3rev.py`, copy at `/tmp/lgs/p3rev/p3rev.py` until a reboot), written without reusing the builder's checks. Each run is one `lab.Lock` step with the action logger on. Inside the step, `wp.p3` is pushed through `rt.test.flags` and popped in `finally`. Every popup's `TriggerOverlayHapticEffect` / `SetOverlayInteractionAffordance` and Steam's `PlayAudioURL` were dropped for the whole step: nothing was pulsed or played. The laser was simulated with CDP `Input.dispatchMouseEvent` on the popup's own target. The gamepad was simulated with D-pad moves (`L.pad`) only. Button A was **never** pressed for real; the press test used a non-bubbling event on our own test node. Outputs are `<scratch>/p3rev/out_a.json` to `out_i.json`; `<scratch>` is this workflow's scratchpad. The key numbers are copied below, because scratch can be lost.
- **Device left as found:** CSS-only, no flags of mine, P3 modules `off`, pointer at (1400, 900), pad source 1, starting route restored, no test nodes left. The shot copy on the Frame was deleted.

## Verdict: **fix**

The code is careful and most claims hold under independent tests: IN-1 to IN-6, IN-8 and IN-9 pass. IN-9 still passed when removal happened mid-interaction, and DOM listener counts returned to baseline. The tooltip looks right next to the mockup. Two major findings remain:

1. P3 keeps strong references to every DOM element it ever tagged, so pages the user leaves are never freed while `wp.p3` is on. Proven live.
2. IN-7 does not pass as written. The evidence scores DOM state, not what the user sees.

## Findings

| # | Sev | Title |
|---|---|---|
| F1 | **major** | Detached-DOM leak: `states` and `attention` keep every tagged element alive until the package is removed |
| F2 | **major** | IN-7 fails as written (label nearly invisible at 900 ms, tooltip visible until about 570 ms after leaving); the log reports "PASS 11/11" from DOM-state checks |
| F3 | minor | `input` is not fail-closed on a partial install: Steam subscriptions made before the throw are never undone |
| F4 | minor | Each `input` install leaves a `[Symbol(lgs-p3-input)]` record in `webpackChunksteamui` after removal |
| F5 | minor | Evidence log accuracy: logged times do not match the artifacts; the tooltip live shot predates the final `07-tooltip.js` |
| F6 | minor | `%{Token}` selectors are resolved once at install; an install while P1's class index is incomplete disables ring and disabled tags for the session |

### F1 (major): detached-DOM leak while `wp.p3` is on

- **Code:**
  - `06-states.js` adds to `st.touched` (a `Set`) on every spot host (l.130), press (l.156), focus-in element and FocusRing (l.183), ring-check ring (l.194) and disabled focus (l.221).
  - `05-attention.js` adds every dwelled element to `st.marked` (l.136). `clearDwell` never deletes it, while `delCls` does (l.94) only for attend classes.
  - Both sets are emptied only in `remove()` (06 l.338–341, 05 l.398–401).
  - Every gamepad focus move, laser spot host and dwell therefore pins its element. A pinned element keeps its whole detached subtree alive, which after a route change is the whole page Steam unmounted.
- **Live proof (`out_d.json`, 06:52):** a 120 px test node with `data-lgs-spot`, `data-lgs-press` and `data-lgs-dwell` and an 8 MB payload. Steps: laser over it, one synthetic A down/up on it, pointer off-window, node removed from the DOM, `WeakRef`, then CDP `HeapProfiler.collectGarbage` ×2.
  - **wp.p3 off (control):** `collected`.
  - **wp.p3 on:** `pressed: true`, `--hx 50%`, `lgs-dwell` set, then **`alive`** after GC.
  - **After `flags.pop`:** `collected`.
- **Why major:** with `wp.p3` on by default (REQ P3->V1), memory in the Steam UI renderer grows with every page the user visits and interacts with, for hours. This breaks the "no leaks" robustness bar.
- **Fix:** drop both sets, or use `WeakSet`. `remove()` already sweeps every live popup with `querySelectorAll` for the classes, and can do the same for inline `--hx/--hy`. Alternatively, delete an element from the set when its last tag or property is cleared (`clearSpot`, `unpress`, the focus-in timer, `clearFocusTags`, `clearDwell`).

### F2 (major): IN-7 does not pass as written; the evidence scores DOM state

Card criterion: "None at 500 ms; the label at 900 ms; gone ≤ 250 ms after leaving".

Measured by me, sampling every 20 ms the node's state and the computed opacity of the capsule and of `.lgs-tip-label`:

| Path | 500 ms | Capsule `in` | Label opacity at 900 ms | Label ≥ 0.5 | Leave → `out` | Label 0 | Node hidden |
|---|---|---|---|---|---|---|---|
| Laser (CDP hover, `out_e.json`) | none ✓ | 818 ms | **0.04** | ≈ 985 ms | 223 ms | ≈ 406 ms | **571 ms** (capsule opacity 1.0 until ≈ 510 ms) |
| Gamepad (timed from the real `vgp_onfocus` / `vgp_onblur`, `out_f.json`) | none ✓ | 824 ms | **0.12** | 975 ms | 245 ms | 440 ms | **585 ms** |

- At 250 ms after leaving, the laser tooltip is still fully there: capsule opacity 1.0, label 0.71. "Gone ≤ 250 ms" fails under any reading except "the leave has started".
- The builder's runner scores this exactly that way: `laser_out_le_250` tests `outAt <= 250`, and the pad check is at 650 ms.
- "Label at 900 ms" passes only as `textContent`. P5's content-in lags the glass, so the label is at 4–12 % opacity at 900 ms.
- P3-D1 documents the leave conflict: PLAN §1.13 / CTL §11 give a 0.2 s out delay plus a 350 ms dematerialize, which cannot be gone by 250 ms. It does **not** cover label legibility at 900 ms. Even so, `wp/P3.md` reports IN-7 as "**PASS** (11 / 11 checks)" and the Status says every acceptance test passes.
- **Fix, either:**
  - (a) make IN-7 pass, by timing so the label is readable by 900 ms and the tooltip is gone within 250 ms; or
  - (b) record IN-7 as a deviation (FAIL as written), with both numbers measured on opacity, and get the PLAN §1.17 sign-off / coordinator amendment of the card criterion. Status should then say "M3 except IN-7 (deviation pending)".
- The code follows PLAN §1.13 and CTL §11. The defect is that the evidence and the M3 claim present a criterion conflict as a PASS.

### F3 (minor): `input` leaks Steam subscriptions after a partial install

- In `04-input.js`, `live = st` (l.227), then the subscriptions: `NavigationSource.Subscribe` l.444, `RegisterForNavigationTypeChange` l.447, the MobX `reaction` l.451, and the popup callbacks / 2 s poll without P1. `st.remove` is assigned only at l.486. If any later step throws, P1 calls `remove()`, finds no `st.remove`, and undoes nothing.
- These are direct Steam calls, not `rt.*` helpers, so P1 cannot undo them either. This goes against runtime.md §1 rules 2–3 and §10 ("remove() safe after a partial install") and G-REMOVE.
- **Offline proof** (`<scratch>/p3rev/failclosed.js`, a Steam-like mock that makes one call throw, then `remove()`):

  | Throwing call | NavigationSource subscriber | VR nav-type callback | Popup-created callback | Other |
  |---|---|---|---|---|
  | `RegisterForNavigationTypeChange` | left (1) | — | — | |
  | `AddPopupCreatedCallback` | left (1) | left (1) | — | |
  | `AddPopupDestroyedCallback` | left (1) | left (1) | left (1) | the 2 s poll interval keeps running |
  | Control (no throw) | 0 | 0 | 0 | |

- **Impact:** latent. It needs a Steam change that makes, for example, the needle-found MobX `reaction` or `RegisterForNavigationTypeChange` throw. That is exactly what fail-closed exists for.
- **Fix:** register each undo before or with each subscription and set `st.remove` first, or use `rt.cleanup`. Also use `rt.expose('input', …)` (runtime.md §3.5b), which P1 removes automatically, instead of assigning `PUB().input` directly. The same pattern exists in 05/06/07 (`input.onChange` registered before `st.remove`); it is lower risk there.

### F4 (minor): webpack chunk record left after removal

`findSteamModules()` (04 l.61) pushes `[[Symbol('lgs-p3-input')], {}, fn]` into `webpackChunksteamui` on every install, and it is never removed. Live: the array went 67 → 68 for one install, and the last entry was `Symbol(lgs-p3-input)` after an earlier pop. It is tiny, but it is a global mutation that G-REMOVE says must not survive. Fix: `splice` it out after taking `req`, or cache `req` once per page.

### F5 (minor): evidence-log accuracy

- **Logged times are not the run times.** The output files' mtimes:
  - `out_r2a.json` 05:15:20 (logged 05:27);
  - `out_r2c.json` 05:20:46 (logged 05:42);
  - `out_r2e.json` 05:24:57 (logged 05:47);
  - `out_r3a.json` 05:29:58 / `out_r3b.json` 05:30:13 (logged 06:05 / 06:07).
- `wp/P3.md` was last written at 05:36:41, yet its Status says "complete (session 2, 06:12)". PLAN §2.1 asks for the date of each row; these times are wrong by 12–36 min.
- `shots/p2_p3_tooltip_live.png` (05:19:32) and `p2_cmp_p3_tooltip.png` predate the final `07-tooltip.js` (05:20:01, the 20 px padding change). My fresh shot (below) confirms the final code looks right, but the logged shot is not of the final code.
- The JSON evidence lives only in scratch (`<scratch>/p3/out_*.json`). Copy the key numbers into the log, as this review does.

### F6 (minor): tokens resolved once at install

- `06-states.js` resolves `%{FocusRing}` and the `%{…Disabled}` parts at install (`resolveList`), and `05`/`07` resolve selectors at registration.
- During this review the Steam main page crashed (06:49:56, during another agent's step, with P3 off). For about 4 minutes after the theme came back, P1's class index had **3** modules instead of 550 (`glass.py status` `classModules: 3`; `__LGS_INDEX.selector('FocusRing')` → `unresolved`).
- A P3 install in that window gets `ringSel = ''` and drops the token parts of the disabled selector. `lgs-ring-check` and part of `lgs-focus-disabled` then stay off until the next reinstall, with no error.
- **Fix:** re-resolve lazily on the first use, or on P1's index-ready / module event.

## Re-run results (live, independent)

| Test | Run (Frame time) | What I did differently from the builder | Result |
|---|---|---|---|
| IN-1 | `out_a` 06:45 | Flipped the source from the **bar** window and, separately, from main. A NavigationSource subscriber of my own, registered after P3's, read main's class inside Steam's notification | **PASS**: 10 / 10 popups → `laser` from the bar and from main, → `pad` on `L.pad`. In all 4 notifications the class was already flipped (same task). `onChange` reasons `source` |
| IN-2 | `out_a` 06:45 | Stub with `ttlMs: 400` and checked expiry | **PASS**: our classes only. `NavigationSource.Value`, `IsInGamepadNav` and both objects' own properties unchanged at every step. The stub expired at 400 ms back to the live values (the live source was MOUSE at the start), with 4 `onChange` calls, reason `stub` |
| IN-3 | `out_g` 06:55 | Latency from the **first** `mouseover` inside the dwelled element (the builder used the last one); a slow-sweep sanity check | **PASS**: 80.3 / 84.7 / 84.6 ms (3 cards). Fast sweep at 45 ms per card: **0** dwells on 4 cards. Slow sweep at 140 ms per card: 4 / 4 dwells at 81–84 ms. Cleared on leaving and on the switch to pad |
| IN-4 | `out_c` 06:51 | A real `dispatchEvent` (non-bubbling `CustomEvent`) on our own `[data-lgs-press]` node instead of calling the handler | **PASS**: set on A down, cleared synchronously (0 ms) on A up; B, X and repeats ignored; safety clear at 410 ms; the host is found from a child; `defaultPrevented` false for every event; 0 `.lgs-pressed` left |
| IN-5 | `out_c` 06:51 | MutationObserver on `style`; 5 D-pad moves afterwards | **PASS**: writes 3 / 1 / 1 ms after `pointermove` (20/50 %, 50/30 %, 80/70 %); **0** writes in 1.2 s idle; 0 `--hx` after the switch to pad; **0** writes during 5 pad moves (P-09) |
| IN-6 | `out_d` 06:52 | Same method (P5 keyframe on `.lgs-focus-in.gpfocus::after`), real `L.pad` moves | **PASS** 3 / 3: class present in the `vgp_onfocus` task and at the next frame; `::after` 0.60 at t0, 1.00 at 700 ms; class gone by 700 ms |
| IN-7 | `out_e` 06:53, `out_f` 06:54 | Opacity-sampled timelines (table in F2); gamepad timed from the real focus events; a negative P-12 case; Steam's bar tooltip | **FAIL as written** (F2). Owner with visible text: no tooltip after 1.1 s (P-12 ✓). Bar: wrapper on, `unDelayMS` **800**, not finished at 600 ms, finished at 900 ms, `m_mapTooltips` empty 300 ms after the pointer left ✓ |
| IN-8 | `out_f` 06:54 | Also `'dwell'`; haptic under the laser stub on a non-Panel node | **PASS**: `activate` → 21, one request `/sounds/deck_ui_default_activation.wav` (dropped); `hover` and `dwell` → `null`, 0 requests; 0 requests in a 5-card laser sweep; haptic plan `{effect 3, available, armed false, mode laser, fired false}`, 0 calls |
| IN-9 | `out_b` 06:49 | Removal **from an active state** (laser dwell and spot on a card under the pointer, a tooltip `in`, a held A press, a live `rt.attend`), plus CDP `DOMDebugger.getEventListeners` on the main and bar documents | **PASS**: after the pop, no class, attribute, `--hx`, `.lgs-tip` or `#lgs-tip-style` on any popup; no P3 API; `ShowTooltip` is the prototype's again. Counts back: NavigationSource 2→3→2, VR nav-type 1→2→1, MobX observers 11→12→11, popup callbacks 6/3 unchanged. Listener diff on main and bar documents = **{}**. 0 writes of ours during laser moves and pad presses after removal |
| Motion (P-52, P-56) | `out_h` 06:57 (`--media reduce`), `out_i` 06:59 | — | **PASS**: normal 250 / 350 ms (P5 `lgs-mat-*`; backdrop-filter animation is allowed for small glass by MO R8). Reduce Motion: 180 ms, glass opacity only, label keyframes empty. 0 `lgs-mat` animations 1.1 s after the leave; node `hidden` |
| Idle | `out_g` 06:55 | 1.5 s after the last input with `wp.p3` on | **PASS**: no running animation, none named `lgs-*`, no P3 marks. Install times: input 3.8 ms, attention 0.3, states 0.6, tooltip 0.5 |
| Leak | `out_d` 06:52 | WeakRef + forced GC (F1) | **FAIL** (F1) |

**Not re-run:** IN-10, IN-11, IN-12 and IN-3b (builder extras, not card tests), perf, and `lgs off` itself. `lgs off` would disrupt about 20 agents; it calls the same `remove()` paths that IN-9 exercised from an active state. Wearer-only items (the SteamVR grip-mode path and haptic feel) stay blocked, as the builder says.

## Checklist

- **(a) Ownership: OK.** Changed files are the four P3 modules, `contracts/interaction.md`, `wp/P3.md`, one answered line in `wp/P10.md` (allowed by the request rule), and the two `shots/p2_*p3*` files (PLAN §2.1 naming). `device/proto/input_mode.js` is unchanged. No P3 files in `_wip/` or elsewhere. The open request is handled (REQ P10->P3 `[x]`); no request to P3 is open.
- **(b) Safety:**
  - **Persistence:** no web storage, disk or network in P3 (grep clean); memory only. Nothing autostarts: the modules exist only while `wp.p3` is on, and the default is off (no `device/defaults.json` yet).
  - **Never-list:** respected by the builder's runner and by mine (D-pad and BTakeFocus only, A never pressed for real, sounds and haptics dropped).
  - **Haptics:** disarmed (`armed: false`, `fired: false`).
  - **Locks:** every live step ran under `lab.Lock`.
  - **Removal:** clean except F3 and F4.
- **(c) Robustness:**
  - Leak F1 (major), the fail-closed gap F3, residue F4, and the stale tokens F6.
  - No listeners left (DOMDebugger) and nothing running at idle.
  - Bar wrapper: if another wrapper was stacked on top, `remove()` leaves P3's wrapper in the chain, but it is inert because it checks `live === st`. Acceptable.
- **(d) Conformance:**
  - Pass: P-06 (lift and depth only after 80 ms: `.lgs-dwell`), P-09, P-12 (icon-only, 0.8 s in, 0.2 s grace out, none on visible text), P-25 (P3 never cancels a Steam event), P-42 (tooltip `border 0`, `outline none`, edges from P4's E3 `::before`), P-52, P-56, P-74/P-75 (Steam's enum on Steam's bus; hover refused).
  - Missing: the IN-7 timing vs the card (F2).
- **(e) Function retention:**
  - P3 cancels nothing (IN-4, real D-pad spy in the builder's run).
  - Bar tooltips still appear, at 0.8 s.
  - In-window tooltips work on both the laser path (CDP hover) and the gamepad path (D-pad focus).
  - `pointer-events: none` on the tooltip.
  - No Steam handler replaced; the only patched function is `ShowTooltip`, as the plan says (CTL P-C5).
- **(f) Visual quality:**
  - My live shot with the final code is `<scratch>/p3rev/rev_tooltip_live.png`: a 60 px icon-only test circle over a poster on `/library/home`, real laser attention, 1.3 s.
  - I viewed it next to `shots/p2_controls_tooltips.png` ("Options" over the poster).
  - Computed: 48 px tall, 20 px side padding, 20 px weight 600, capsule radius, P4 thick glass (`blur(30px) saturate(1.5)`, top sheen, inner shade, 5 mm shadow `0 2px 6px rgb(0 0 0 / .3)`), E3 conic arc on `::before`, `border 0`, `outline none`.
  - It reads as a dark glass pill with the poster blurred through it and a faint upper-left specular edge. It matches the mockup in size, weight, placement (12 px under the owner) and tint; the mockup's capsule is slightly denser. No outline.
  - Motion: the glass leads the label on the way in and trails it on the way out, as MO intends. Note the empty capsule visible for about 100 ms at both ends; this feeds F2.

## Notes for the builder and coordinator

- **Environment event (not attributed to P3):**
  - 06:49:56: the Steam main page crashed ("Target crashed") during another agent's Reduce-Motion step, 42 s after my removal run had popped `wp.p3`.
  - The theme came back on at about 06:50:38, with the class index at 3 modules until about 06:53:44.
  - P3 was off at the time of the crash.
- **Reproduce:** `sh run.sh NAME [--media reduce] in1 in2 in3 in4 in5 in6 in7 in7pad in8 motion idle` from `<scratch>/p3rev/`. `rm` and `leak` run outside the flag block, with their own push and pop. The offline check is `node <scratch>/p3rev/failclosed.js`; it hangs on the leaked interval in its last case, which is the point; stop it after it prints.
