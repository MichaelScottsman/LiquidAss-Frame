# P5 Motion library: independent review, round R1

Reviewer: independent adversarial review agent. Date 2026-10-07, 06:40-07:12 (Frame clock). Steam build 11094443.
Scope: everything the builder reported for P5 at M3 (MO-1..MO-5, live load, filmstrips, G-MOTION smoke, contract
`contracts/motion.md`, decisions D-P5-1..9, the three generated outputs and `springs.py`).

**Verdict: accept.** No blocker or major finding. Every acceptance test re-ran and passed on the live device, in
both input-mode stubs and under emulated Reduce Motion. The numbers match the builder's to the last digit. The
generator is the real single source: `--emit` reproduces each output byte for byte, and the C++ header compiles
cleanly. Live on real Steam menus and alerts, the keyframes behave as the contract says. Nine minor findings follow,
mostly about Reduce Motion polish and contract wording. One incident (a crash of Steam's SharedJSContext during
the review) is recorded in §5. It could not be reproduced and is not attributed to P5.

## 1. What was re-run

| Test | Command | Result | Agrees with builder? |
|---|---|---|---|
| MO-1 | `python docs/phase2/research/springs.py --check` | PASS: b0, b15, b20 and b25 are byte-identical to D2 §11.3 and present in `02-motion.nowrap.css`; all 3 outputs are up to date; version `ed4e044810` in all three. `--emit css\|js\|h` also equals each written file byte for byte (after normalising CRLF on stdout); the files are LF | yes |
| MO-2 (node) | `springs.py --test-js` | PASS, worst 1.01e-3 (sheet-out, at the settle clamp); `create()` is done exactly at 441 / 488 / 735 / 210 / 250 ms; retarget jumps ≤ 3.6e-5 in value and ≤ 4.7e-4 /s in velocity | yes |
| MO-2 in CEF | `springs.py --live cef` (06:44) | PASS, worst 1.01e-3; 5e-10 before the clamp for every token; `create('depth')` done at 441 ms; runtime global restored | yes |
| MO-3 | `springs.py --live mo3` (06:45) | PASS 20/20, nothing left, stage removed, timeline advanced 1866 ms. Samples identical to the builder's (e.g. `lgs-mat-glass-in` coverage .565 at f .15 and 1 at .35, content 0 until 35 %; `lgs-sheet-out` .747 / .209 / .070 at .15 / .35 / .5; `lgs-mat-glass-out` scale 1 until 55 %, 1.0167 at 75 %) | yes |
| MO-3 pad / laser | `--live mo3 --mode pad`, `--mode laser` (06:56) | PASS 20/20 each. The stub reports `mode=… via classes (no rt.input)`: P3's adapter is off, so the class fallback is used. P5's keyframes do not depend on the input mode | yes |
| MO-4 | `--live mo4` (06:49, 06:55), `--live mo4 --mode pad` (06:57), `--mode laser` (06:59) | PASS 20/20 in all four: `matchMedia(reduce)` true; tokens 180 / 200 / 150 / 180 ms; `--lgs-ease-snappy` = b0; every keyframe opacity-only or empty; every duration 150–200 ms; nothing left | yes |
| Reduce Motion exit probe (new) | `glass.py js <one .lgs-mat-out node, removed> --media reduce` | 180 ms, but opacity holds at 1 until 55 % and then fades over 81 ms (finding m1) | builder did not sample it |
| MO-5 | `frame_ssh run "~/.local/share/glass-shell/native/glassd/glassd --selftest phase"` | PASS, worst 0.0010 (sheet-in 735, sheet-out 515, linear 250 / 350, reduce 180). The installed binary reports header `2428c76f74`. Since then the header changed only in `kVersion`: `git diff f5190bb` is one line, and D-P5-8 changed CSS composites only. `test_phase.sh` (GL-4) was not re-run here because it opens SteamVR overlays; P9's reviewer re-ran it (PASS, 40 values) | yes |
| Header compile | `g++ -std=c++17 -Wall -Wextra -Wpedantic -O2` on the Frame (GCC 15.1.1) of a test that includes `motion_tokens.h`; `/tmp/lgs/p5rev` deleted after | PASS, no warnings. \|y\| ≤ 0.00101 at every token's settle time and > 0.001 two ms earlier, so the settle times are the true crossings; `sample(t90)` within .005 of .9; `coverage(.15)` .5000; `kPhaseUp` / `kPhaseDown` = sheet-in / sheet-out | yes |
| check-theme | `python glass.py check-theme` | PASS (41 files) | yes |
| Live load | `glass.py js`; `glass.py js … --in vr:systemui` | `rt.shared` = `[motion]`, `rt.shared.motion === window.__LGS_MOTION`, version `ed4e044810`, frozen. P1's runtime lists `__LGS_MOTION` in `status().globals`, so teardown deletes it. In `vr:systemui` (CSS-only mode) the tokens and keyframes are bundled (`--lgs-d-snappy` 488ms, `lgs-mat-glass-in` rule present), and `__LGS_MOTION` is absent, as expected without the scene graph. 0 animations at rest | yes |
| G-MOTION smoke | `glass.py gates main --route /zoo/buttons --only motion --pre <lgs-mat-glass-in on mat-in, lgs-sheet-in on sheet-in, lgs-fade-in 300ms ease; removed after 6 s>` | Only finding: `lgs-fade-in on DIV: duration 300 ms`. P5's keyframes, with their composite per-keyframe curves, pass the token checks | yes |
| R8 perf (new) | `glass.py shot main p2_p5rev_perf --route /zoo/buttons --back --pre <rAF timing: baseline 700 ms, then 6 visible 320 × 76 glass nodes on .lgs-mat, .lgs-mat-out, lgs-toast-in; removed>` | Baseline median 11.1 ms, max 11.2. `.lgs-mat` ×6: max 22.3 ms (one dropped frame at the class flip). `.lgs-mat-out` ×6: max 12.3. `lgs-toast-in` ×6: max 11.7. **No frame > 34 ms**, so R8's precondition holds for P5's blur ramps | builder had no perf evidence (m3) |
| Real Steam surfaces (new) | `glass.py shot main p2_p5rev_{menu,alert}_f<f> --route /zoo/modals --back --pre <open the zoo's no-op "Simple Menu" / "GenericConfirmDialog Dialog", pause our lgs-* animations at f>`; plus `menu_f0.999` and `menu_rest` | C1c's real menu: `lgs-morph` 607 ms clips from the top-centre capsule (f .15: inset 30 % / 60 %; f .35: 8 % / 17 %, rounded corners), items 0 at f .15 and .57 at .35. Real alert: `lgs-mat-large-in` opacity .20 and scale 1.0157 at f .15, content 0 | builder tested its own scenes only |
| Filmstrips | looked at `shots/p2_cmp_p5_motion.png`, `p2_p5_film_b.png`, `p2_p5_film_a_reduce.png` | See §3 | yes |

## 2. Findings

None blocker, none major.

### Minor

- **m1 Reduce Motion: the small-glass exit is a 99 ms hold, then an 81 ms fade.** `springs.py`'s Reduce Motion
  block (lines 584–598) redefines the durations and the bounce curves, but not `--lgs-ease-mat-out`
  (`linear(0, 0 55%, 1)`). JS has the same gap: `timing('mat-out', {reduce: true})` returns
  `{duration: 180, easing: 'linear(0, 0 55%, 1)'}`.
  - Live under `--media reduce`, a `.lgs-mat-out` node samples opacity 1 / 1 / 1 / .889 / .556 / .222 at
    f 0 / .25 / .55 / .6 / .75 / .9.
  - MO C8, MO §9 and D-P5-1 call for a cross-dissolve of 150–200 ms. P3's tooltips (IN-13) and every other
    `.lgs-mat-out` or `--lgs-motion-mat-out` caller get this abrupt exit.
  - MO-4 passes because it only checks duration ≤ 200 ms.
  - Fix: in the reduce block, emit `--lgs-ease-mat-out: linear`, and in `easingOf()` return `linear` for `mat-out`
    when `reduce`.
- **m2 Contract §1.6 overclaims.** "So a call site that uses the tokens and keyframes is Reduce-Motion-correct
  without its own media query."
  - That is true for P5's keyframes, but not for the contract's own §1.1 idiom, `transition: scale
    var(--lgs-motion-snappy)`. Under Reduce Motion that is still a 180 ms scale (or translate) animation, which
    P-56 forbids. Callers in the tree use the idiom: `theme/41-home.css` 770, 990, 1008, 1029, 1037, 1252–1260 and
    `theme/10-primitives.css` 1087–1090, 1147.
  - Reword the sentence to say keyframes only. Add the rule: a transitioned `scale`/`translate` needs its state
    value at rest under Reduce Motion, as P4 does with `--lgs-press-grow: 0`. Owners' P-56 runs
    (`gates`/`motion --media reduce`) will catch the rest.
- **m3 R8 precondition was not measured by P5.** MO R8 amends the filter-animation ban only "if `perf` shows no
  frames > 34 ms". P5 introduced the `backdrop-filter`/`filter` ramps, but its log has no perf row.
  - This review measured it (§1, R8 perf: no long frames; one 22 ms frame when six nodes start together).
  - Add that row, or the equivalent, to `wp/P5.md` so V2 does not have to rediscover it.
- **m4 `lgs-toast-in` keeps a `backdrop-filter` animation alive for 488 ms.** The ramp ends at 47.1 % (230 ms), but
  the animation object animates `backdrop-filter`, `background-color` and `box-shadow` for the full `snappy` time.
  That exceeds R8's "≤ 350 ms" in letter, though not in visible effect.
  - Measured cost is nil (toast ×6: max 11.7 ms).
  - Either note it in the contract as an accepted reading of R8, or split the toast into a 250 ms glass keyframe
    plus a `snappy` translate (`lgs-shift-in`) on the same node.
- **m5 `lgs-knob-lift` is a linear trapezoid, not a spring.** MO §4.15 specifies a lift on `interactive` (b15,
  210 ms) and a settle on `snappy`. The keyframe instead ramps linearly in 98 ms, holds to 65 %, then returns
  linearly in 171 ms (`var(--lgs-d-snappy) linear`).
  - Visible in `p2_p5_film_b.png`: the knob is already fully translucent at f .15. The return has no b15 ease-out.
  - Have `springs.py` generate per-keyframe literal `linear()` curves for the 0 % and 65 % blocks (the b15 rise
    and the b15 settle, rescaled to their segments), as it already does for the coverage curves of the other
    keyframes.
- **m6 `create()` accepts non-finite targets, and `audit()` throws without a document.**
  `__LGS_MOTION.create('depth').to(NaN, 0)` gives `value()` = NaN and `done()` false for 4 × settle, then NaN
  forever. P7's depth channel would push NaN to the scene graph. `audit()` with no `document` throws `TypeError`.
  Ignore non-finite `to()` targets (keep the old one), and return `[]` from `audit()` without a document.
- **m7 Documentation drift.**
  - `wp/P5.md` Status says REQ P5->P10 and REQ P5->P7 "are answered by their owners", but P5->P7 is still `- [ ]`.
    It is optional, so say so.
  - `contracts/motion.md` §2 says `lgs-mat-glass-out` drops coverage opacity "over the last ≈ 30 %". Measured, it
    is 1 until 86.5 % of the time and falls over the last 13.5 % (30 % of m, not of time).
- **m8 Evidence naming and overwrite.** `springs.py --live mo3|mo4` always writes `shots/p2_p5_mo3.png` /
  `p2_p5_mo4.png`, which show only `/zoo/buttons` after the step, so any re-run overwrites the evidence (this review
  did, 06:50–06:58, with equivalent content). The filmstrips are named `p2_p5_film_*`, while PLAN §2.1 asks for
  `p2_motion_<id>_<interaction>_<f>.png`. Suggest `p2_motion_p5_<set>[_reduce].png`, and either drop the
  uninformative mo3 and mo4 shot or name it per run.
- **m9 The morph clip also clips hit testing for about 200 ms.** In Chromium, `clip-path` limits hit testing, so
  while `lgs-morph` grows, a laser click on an item outside the clip misses it. MO §4.6 says "Items accept input
  from the first frame". In practice the window is too short to aim at an item (the clip covers about 83 % by
  212 ms in the real menu). Gamepad focus is unaffected. Informational: mention it in the contract next to R9.

### Accepted deviations (checked, no finding)

- **D-P5-6:** no `@property` in `02-motion`, although the card lists it. P4 registers `--lgs-hover`, `--lgs-press`
  and `--lgs-focus` (`theme/00-tokens.nowrap.css`), and a second registration would override P4's. The decision is
  sound and documented.
- **D-P5-8:** large glass fades over `min(1, m/.8)`. In the storyboard comparison it removes the pop-in, and it
  matches the mockup's sample points (alert .20 at 66 ms, sheet .50 at 110 ms).
- **D-P5-9:** no overshoot on the clip. MO §6.4 itself prescribes b0 for the clip.

## 3. Visual review (against "feels native visionOS, no outlines")

- **Storyboard comparison** (`shots/p2_cmp_p5_motion.png`, live rows under `window-nav-motion.html`). All five rows
  agree frame by frame:
  - Menu morph: clip about 40 % at 91 ms; content in from 15 % to 50 %.
  - Alert: faint glass at 66 ms; content from 35 %; swell 1.019.
  - Sheet: .97 → 1; glass half at 110 ms; content 25–70 %.
  - Dismiss: content out first, then the glass.
  - Route: old content out in 150 ms; new content in with 16 px parallax.

  Known differences: the clip has no overshoot (D-P5-9), and the storyboard has a room photo behind the window.
  No frame shows a closed outline or a hard rim. The keyframes animate `box-shadow` none → rest, not a stroke.
- **Set B** (`p2_p5_film_b.png`): small glass leads with frost, and content sharpens from 35 % to 100 %. On exit
  the content goes first. The toast materializes with an 8 px drop, and focus starts at .6. The knob lift reads as
  "into clear glass", but linearly (m5).
- **Reduce Motion** (`p2_p5_film_a_reduce.png`): every row is a plain dissolve with no scale, clip morph or parallax.
  That is correct, apart from the exit timing in m1.
- **Real Steam surfaces** (`shots/p2_p5rev_menu_f0.15.png`, `_f0.35`, `_f0.999`, `_rest`,
  `p2_p5rev_alert_f0.15.png`, `_f0.35`):
  - On C1c's real zoo menu, the clip grows from the top-centre capsule with rounded corners and no edge line, and
    the items fade in late as specified.
  - The alert is faint at f .15, half there at .35, with the small swell.
  - P5's part reads as native Liquid Glass motion.
  - Not P5's, recorded for C1c and P4: at rest (`_rest`, identical to `_f0.999`) the zoo menu's thick glass shows
    the buttons behind it **sharp**, with no visible backdrop blur. The morph is not the cause, since the rest
    frame and the paused end frame are the same.

## 4. Checklist (a)–(f)

- **(a) Ownership.**
  - `filesChanged` covers only P5's five owned files (PLAN §2.6), its evidence log and its own `shots/p2_p5_*` /
    `p2_cmp_p5_*`.
  - `git status` shows no P5 file outside its patterns: `lab/lab_motion.js` is P10's, and no `theme/_wip` motion
    file exists.
  - The other agents' edits to `wp/P5.md` are the sanctioned REQ answers from P4, P8, P9 and P10.
- **(b) Safety.**
  - P5 writes nothing at runtime. Its live steps are locked `glass.py` steps whose stage nodes are removed; the
    CEF test restores the runtime's global.
  - Nothing persists, and nothing is installed or restarted. `/tmp/lgs` has no `p5*` folder.
  - `lgs off`: P1 tracks `__LGS_MOTION` as a runtime global and deletes it (`status().globals`). P8 removes it in
    `vr:systemui` (P8's selftest plates).
  - Never-list respected: zoo demo menus and dialogs were only opened, then closed by the step.
- **(c) Robustness.** `motion.js` has no timers, listeners or side effects beyond the frozen global. A throw would
  be caught by P1's fail-closed loader. Nothing runs at idle: 0 `lgs-*` animations in main and in `vr:systemui`
  after every step. Weak spots are listed in m6.
- **(d) Conformance.**
  - P-52 (iterations 1, nothing left), P-53/P-54 (≤ 16 px translate defaults, swell ≤ 1.019 on large glass),
    P-55 (bounce ≤ .25), P-56 (opacity-only ≤ 200 ms under reduce) and P-58 (tokens; `allowed` / `isToken*` used
    by G-MOTION): pass.
  - P-06: `--lgs-delay-dwell` 80 ms provided.
  - MO C1–C3 and C8: pass, except m1. MO §4.15: m5.
- **(e) Function retention.** P5 adds no function of its own. No keyframe touches `pointer-events`, `visibility`
  or layout, and every keyframe ends at the element's own rest (MO-3 rest diff empty in pad and laser). The one
  input-side effect is the transient clip in m9.
- **(f) Visual quality.** See §3. The motion reads as Liquid Glass: glass first, content second, springs settling
  without bounce on large surfaces, and no outlines.

## 5. Incidents during the review

- **06:49:56: Steam's SharedJSContext crashed.**
  - `lgs.log` shows "an evaluation timed out" at 06:49:46, then `Runtime.evaluate: Target crashed`.
  - The gamepadui windows were recreated (ids 7664xxxx → 8510xxxx). The theme was re-injected before Steam's
    webpack modules loaded, and showed 735 unresolved tokens and `classModules` 3 until about 06:53:53.
  - The crash came in the same second that this review's first `springs.py --live mo4` step ended (Reduce Motion
    had been emulated since 06:49:31). Other agents' steps were interleaved: theme reloads at 06:49:24 and 06:49:31.
  - The same MO-4 step then ran three more times (06:55 default, 06:57 pad, 06:59 laser), plus one Reduce Motion
    probe, with no crash, no timeout and no theme loss. MO-3 also ran three times without a problem.
  - The cause is **not established**. It is recorded so the coordinator can correlate it with other agents' logs.
    It is not counted as a P5 finding.
  - The three `--live` runs that fell into the broken window (06:50–06:51) failed with `lgs-on False` / NO
    ANIMATION and are not counted.
  - The theme recovered by itself. Turning it on before Steam's modules exist, and never re-resolving the tokens
    afterwards, may deserve a look by P1/P8.
- Re-running `springs.py --live mo3|mo4` overwrote `shots/p2_p5_mo3.png` and `shots/p2_p5_mo4.png` (m8).
- Device left as found: theme on, CSS-only mode; no flags (`status().flagsSet` `{}`); no Reduce Motion emulation; no
  test node (`#lgs-p5-test`, `#lgs-p5rev-perf`, `#lgs-p5rev-gates` absent); 0 `lgs-*` animations; menus closed by
  each step; `/tmp/lgs/p5rev` deleted. Review shots kept: `shots/p2_p5rev_*` (our own nodes and the zoo's demo
  page; no room imagery, no personal names).
