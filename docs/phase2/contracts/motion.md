# Contract: motion library (P5)

Owner: **P5**. Files: `docs/phase2/research/springs.py` (the one source), and its three generated outputs `theme/02-motion.nowrap.css`, `device/shared/motion.js`, `native/shared/motion_tokens.h`. Sources: PLAN §1.5, §2.3 P5; D2 §11; MO §3, §4, §6, §7, §8, §9; VP P-52 to P-58.

**Status:** see "Status" in `docs/phase2/wp/P5.md`. Every name in this file is stable from M1. Values only change through `springs.py` (PLAN §1.5); a change of meaning gets a new name.

**Ground rules**

- **Never edit an output by hand.** Change `springs.py`, then `python docs/phase2/research/springs.py --write`. `--check` fails when an output is stale (V2 runs it). Each output carries a "GENERATED" banner.
- Every duration and easing in our CSS and JS is one of the tokens below (VP P-58, gate G-MOTION). If you need one that is missing, file `- [ ] REQ <you>->P5: …` in your evidence log.
- `@keyframes`, `@property` must live in a `*.nowrap.css` file, and context packages own none, so **every `lgs-*` keyframe is here**. Need another one? Ask (REQ), do not invent one in a wrapped file (it would be dropped by the bundler warning anyway).
- P4 owns the state tokens that motion reads (`--lgs-focus-first`, `--lgs-press-grow`, `--lgs-press-max`, `--lgs-card-lift`, `--lgs-disc-lift`); see `contracts/tokens.md`. P5 does not define them.
- Bundle order: `00-tokens` → `01-font` → **`02-motion`** → `03-material` → `04-states` → … The file is also bundled into every SteamVR page (all `*.nowrap.css` are), so every name works in `theme/vr/*.css` too.

---

## 1. CSS tokens (`theme/02-motion.nowrap.css`, on `html.lgs-on`)

### 1.1 Spring tokens (D2 §11.2, unchanged)

CSS duration = the spring's settling time (|1 − x| ≤ 0.001); the easing depends only on the bounce.

| Token | d (s) | b | Duration `--lgs-d-<t>` | Easing `--lgs-ease-<t>` | Shorthand `--lgs-motion-<t>` | Use |
|---|---|---|---|---|---|---|
| `interactive` | 0.15 | 0.14 | 210ms | `--lgs-ease-b15` | `210ms <b15>` | Press-in, drag smoothing, gamepad slider steps, pill lift |
| `hover-in` | 0.20 | 0 | 294ms | `--lgs-ease-b0` | | Hover light in, focus illumination in |
| `fade` | 0.30 | 0 | 441ms | `--lgs-ease-b0` | | Hover/focus out, cross-fades, list insert, scrim |
| `snappy` | 0.35 | 0.15 | 488ms | `--lgs-ease-b15` | | Pill travel, toggle knob, toast in, release swell back |
| `release-touch` | 0.40 | 0.25 | 510ms | `--lgs-ease-b25` | | Direct hand poke only (unused with laser and gamepad) |
| `morph-open` | 0.45 | 0.20 | 607ms | `--lgs-ease-b20` | | Menu/popover/dropdown grows out of its source (clip morph uses `--lgs-ease-b0`, MO §6.4) |
| `morph-close` | 0.30 | 0 | 441ms | `--lgs-ease-b0` | | Menu returns into its source |
| `sheet-in` | 0.50 | 0 | 735ms | `--lgs-ease-b0` | | Sheet/modal present; window materialize (glassd) |
| `sheet-out` | 0.35 | 0 | 514ms | `--lgs-ease-b0` | | Sheet dismiss |
| `page` | 0.45 | 0 | 662ms | `--lgs-ease-b0` | | Route and tab content transitions |
| `depth` | 0.30 | 0 | 441ms | `--lgs-ease-b0` | | z of popped crops and slabs (scene graph, JS) |

`--lgs-motion-<t>` = `var(--lgs-d-<t>) var(--lgs-ease-<t>)`, for example `transition: scale var(--lgs-motion-snappy)` or `animation: lgs-page-in var(--lgs-motion-page) backwards`.

### 1.2 Linear and fixed tokens

| Token | Value | Shorthand | Use (source) |
|---|---|---|---|
| `--lgs-d-mat-in` | 250ms | `--lgs-motion-mat-in` = `250ms linear` | Small glass materialize (MO §3.2) |
| `--lgs-d-mat-out` | 350ms | `--lgs-motion-mat-out` = `350ms var(--lgs-ease-mat-out)` | Small glass dematerialize; the easing holds the glass until content is gone at 55 % |
| `--lgs-d-page-out` | 150ms | `--lgs-motion-page-out` = `150ms linear` | Old route content fades out (MO §4.12; within Steam's 200 ms exit) |
| `--lgs-d-glow-off` | 90ms | `--lgs-motion-glow-off` = `90ms linear` | Press glow off on release (MO §4.3) |
| `--lgs-d-swap` | 120ms | `--lgs-motion-swap` = `120ms linear` | Label colour swap at t90 of a pill travel (MO §4.5) |
| `--lgs-d-reduce` | 180ms | — | The Reduce Motion cross-dissolve (MO C8) |

### 1.3 Easing curves

| Token | Value |
|---|---|
| `--lgs-ease-b0`, `-b15`, `-b20`, `-b25` | The `linear()` strings of D2 §11.3, byte-identical (MO-1) |
| `--lgs-ease-b0-cb`, `-b15-cb`, `-b20-cb`, `-b25-cb` | `cubic-bezier()` fallbacks (1.1–1.4 % RMS), only where `linear()` cannot go |
| `--lgs-ease-mat-out` | `linear(0, 0 55%, 1)`: glass held while content leaves, then dissolves |
| `--lgs-ease-<token>` | Per-token alias of the bounce curve (table 1.1), so call sites never hard-code a bounce |

### 1.4 Delays and stagger (VP I-3, P-06; MO §4.14)

| Token | Value | Use |
|---|---|---|
| `--lgs-delay-dwell` | 80ms | Laser: lift, scale and depth start after this dwell; brightness at once (P3 sets `.lgs-dwell`) |
| `--lgs-delay-page` | 40ms | Route/tab content entrance delay (0–60 ms allowed) |
| `--lgs-delay-tab-label` | 400ms | Tab-bar label reveal |
| `--lgs-delay-back-title` | 600ms | Back circle grows into a titled capsule (E-BACK) |
| `--lgs-delay-reveal` | 800ms | Tooltips, card previews (in) |
| `--lgs-delay-reveal-out` | 200ms | Reveals (out) |
| `--lgs-stagger` | 30ms | List insertion, per row, at most 5 rows |

### 1.5 Registered properties

None. The illumination progress values `--lgs-hover`, `--lgs-press`, `--lgs-focus` (D2 §16, MO §6.2) are registered **once, by P4** in `00-tokens.nowrap.css` (with `--lgs-within`, `--lgs-lift`, `--lgs-dis`), next to the states that use them. A second registration in this later file would silently override P4's, so P5 registers nothing. The keyframes need no registered property.

### 1.6 Reduce Motion (`@media (prefers-reduced-motion: reduce)`, MO C8, VP P-56)

Inside the media query, on `html.lgs-on`:

- every bounce curve becomes `--lgs-ease-b0` (no bounce);
- every duration becomes a fade of at most 200 ms: `hover-in` and `interactive` and `morph-close` 150 ms; `fade`, `snappy`, `release-touch`, `morph-open`, `sheet-out`, `page`, `depth`, `mat-in`, `mat-out` 180 ms; `sheet-in` 200 ms; `page-out` 150, `glow-off` 90, `swap` 120 unchanged;
- **every `lgs-*` keyframe is redefined as opacity only** (§2): entrances become `from { opacity: 0 }` (`lgs-focus-in` keeps its `.6` start), exits `to { opacity: 0 }`, and the content and decorative keyframes (`lgs-mat-content-*`, `lgs-sheet-content-*`, `lgs-morph-content`, `lgs-knob-lift`, `lgs-catch`, `lgs-shift-in`) become empty (no effect), because their glass parent already fades.

So a call site that uses the tokens and keyframes is Reduce-Motion-correct without its own media query. Proven on Chromium 126: an `@keyframes` inside a matching `@media` replaces the earlier one of the same name (`wp/P5.md`, probe P5-K2).

---

## 2. Keyframes

All keyframes are written so that **the element's own resting style is the far end** (implicit keyframe): nothing has to be told the rest value, and with `backwards` fill nothing is left on Steam's nodes when the animation ends (MO R11). Entrances: `animation-fill-mode: backwards`. Exits: `forwards` **only** on a node that is removed when the animation ends (Steam's `Exit`/`ExitActive` state, toast exit, our own nodes we remove on `animationend`); never on a node that stays.

Setting `animation` on a Steam node replaces Steam's whole list (MO R3): repeat Steam's functional entries (toast `toastExit*`, focus fills) in your list.

| Keyframe | Animates (from → rest) | Use with | Inputs (custom properties on the element) |
|---|---|---|---|
| `lgs-mat-glass-in` | **Small glass** (≤ 600 × 600 px, MO R8). Glass channel resolves by 92 %: `scale` s0 → rest, `background-color` transparent → rest, `backdrop-filter` `blur(0px) saturate(1)` → rest, `box-shadow` none → rest; coverage `opacity` 0 → 1 by ≈ 28 % (glassd's `smoothstep(0, .3, m)`) | `var(--lgs-motion-mat-in) backwards` on the glass element | `--lgs-maxside` (number, CSS px of the longest side, default 80): s0 = 1 + clamp(.01, 12 / maxSide, .15) (C3) |
| `lgs-mat-glass-out` | Reverse: to s0, transparent, `blur(0px)`, no shadow; coverage `opacity` → 0 over the last ≈ 30 % | `var(--lgs-motion-mat-out) forwards` (node removed after) | `--lgs-maxside` |
| `lgs-mat-large-in` | **Large glass** (alerts, anything > 600 px): `scale` s0 → rest riding the glass (resolved by 92 %), and `opacity` 0 → 1 as `min(1, g / .8)` (≈ 74 % of the time): with no blur ramp allowed (R8), opacity carries the whole glass channel | `var(--lgs-motion-mat-in) backwards` (alert: 250 ms + swell 1.02 → 1, D2 §11.5) | `--lgs-maxside` (default 640 → s0 ≈ 1.019) |
| `lgs-mat-content-in` | Content channel: hidden (opacity 0, `blur(8px)`) until 35 %, then to rest | `var(--lgs-motion-mat-in) backwards` on the glass's children (same duration as the glass) | — |
| `lgs-mat-content-out` | To opacity 0, `blur(8px)` by 55 %, held | `var(--lgs-d-mat-out) linear forwards` on the children | — |
| `lgs-toast-in` | Toast (MO §4.10): the small-glass materialize finishes in the first 250 ms, and `translate` (0, dy) → rest rides the animation's own easing | `var(--lgs-motion-snappy) backwards` (488 ms, b15) in place of Steam's `toastEnter*`; children `lgs-mat-content-in` on `--lgs-motion-mat-in` | `--lgs-toast-dy` (default `-8px`, from the anchor's side), `--lgs-maxside` |
| `lgs-sheet-in` | Sheet (MO §4.8): `scale` s0 → rest on the animation's easing; `opacity` 0 → 1 as `min(1, spring / .8)` (≈ 32 % of the time; it carries the glass channel, since a large slab may not ramp its blur, R8) | `var(--lgs-motion-sheet-in) backwards` | `--lgs-sheet-s0` (default .97) |
| `lgs-sheet-out` | `scale` → s1 on the easing; `opacity` = `min(1, (1 − spring) / .8)`: held to 8.5 %, then dissolves on the spring (≈ .75 at 15 %, .21 at 35 %, .07 at 50 %) | `var(--lgs-motion-sheet-out) forwards` | `--lgs-sheet-s1` (default .98) |
| `lgs-sheet-content-in` | Opacity 0 until 25 %, rest by 70 % | `var(--lgs-motion-sheet-in) backwards` on the sheet's content | — |
| `lgs-sheet-content-out` | Opacity → 0 by 40 % | `var(--lgs-motion-sheet-out) forwards` | — |
| `lgs-morph` | Menu morph from its source: `clip-path: inset(<source rect> round --sr)` → `inset(0 round --lgs-morph-r)` | `var(--lgs-d-morph-open) var(--lgs-ease-b0) backwards` on the menu's glass box (≤ 600 × 600, R9) | `--sx --sy --sw --sh --sr`: the source rect relative to the menu box (T2 writes them; T1 defaults 0 0 64px 48px 24px); `--lgs-morph-r` (default `var(--lgs-r-menu, 32px)`) |
| `lgs-morph-content` | Opacity 0 until 15 %, rest by 50 % | `var(--lgs-d-morph-open) linear backwards` on the menu's children | — |
| `lgs-catch` | `scale` ×1.03 bump at 35 %, back to rest (the source "takes the hit" on menu close) | `var(--lgs-motion-snappy)` on the source, no fill | — |
| `lgs-focus-in` | Focus layers: `opacity` `--lgs-focus-first` (.6) → rest | `var(--lgs-motion-hover-in) backwards` on the focus layers (CTL §4.3; P3's `.lgs-focus-in` class) | P4's `--lgs-focus-first` |
| `lgs-page-in` | Route/tab content: `opacity` 0 and `translate` (dx, dy) → rest | `var(--lgs-motion-page) var(--lgs-delay-page) backwards` (≤ 800 ms with delay, R10) | `--lgs-page-dx`, `--lgs-page-dy` (default 0px; T2 sets ±16px in the navigation direction; ≤ 16 px, M1) |
| `lgs-page-out` | `opacity` → 0 | `var(--lgs-motion-page-out) forwards` (≤ 200 ms, R10) | — |
| `lgs-arrive` | Content arrival: `opacity` 0 and `translate` (0, dy) → rest | `var(--lgs-motion-page) backwards` (GP scroll jump); list insertion: `var(--lgs-motion-fade)`, dy 8px, delay n × `--lgs-stagger` | `--lgs-arrive-dy` (default 16px) |
| `lgs-knob-lift` | Toggle knob lifts into glass: `scale` 1.3 × 1.2 and `background-color` white .35 from 20 % to 65 %, rest at both ends | `var(--lgs-d-snappy) linear` on the knob, no fill (T2 adds the trigger class for 500 ms, MO §4.15) | — |
| `lgs-shift-in` | `translate` (x, y) → rest | e.g. a SteamVR switch knob arriving from the other side: `var(--lgs-motion-snappy) backwards` | `--lgs-shift-x`, `--lgs-shift-y` (default 0px) |
| `lgs-fade-in` / `lgs-fade-out` | `opacity` 0 → rest / rest → 0 | Any cross-dissolve on `fade` | — |
| `lgs-edge-in` | `opacity` 0 → rest | Scroll edge effect, scroll-driven: `animation: lgs-edge-in linear both; animation-timeline: …; animation-range: 0px 24px` (MO §4.13). Live: opacity 0 at the top, .5 at 12 px. It is always `running` in `getAnimations()` (scroll timeline, duration `auto`): `isScrollDriven()` tells it apart | — |

Rules every caller keeps (MO §6.3, D2 §11.4):

- **R1:** never put an opacity keyframe on a *parent* of glass; fade the glass element itself (`lgs-mat-*`, `lgs-sheet-*` do) or its content children. `lgs-page-in` on a container that holds glass controls makes their blur flat during the fade: put it on a content wrapper below the glass, or accept it and say so.
- **R8/R9:** `lgs-mat-glass-*` and `lgs-morph` only on elements ≤ 600 × 600 px; larger glass uses `lgs-mat-large-in` / `lgs-sheet-*`.
- **No resting motion:** iterations 1, never `infinite` or `alternate` (P-52, P-55).
- **Native mode:** where glassd draws the glass (P6 acks), CSS keeps only the content channel and scale; glassd plays the optics ramp from `phase` (§4).

### 2.1 Opt-in utility classes

For our own nodes and for Steam nodes where replacing the `animation` list is fine (§2 R3):

| Class | Rule |
|---|---|
| `.lgs-mat` | `animation: lgs-mat-glass-in var(--lgs-motion-mat-in) backwards`; its children `lgs-mat-content-in` |
| `.lgs-mat-out` | `animation: lgs-mat-glass-out var(--lgs-motion-mat-out) forwards`; its children `lgs-mat-content-out` (remove the node on `animationend` of the glass) |
| `.lgs-arrive` | `animation: lgs-arrive var(--lgs-motion-page) backwards` |

---

## 3. JS (`device/shared/motion.js`)

One file, no dependencies, no side effects at load other than publishing the API:

- **Steam runtime (P1 loader):** `module.exports` → `rt.shared.motion`; also `window.__LGS_MOTION` (P1 tracks and deletes it at teardown).
- **`vr:systemui` (P8 prepends it to `lgs_sg.js`, daemon §9):** `globalThis.__LGS_MOTION`. Call `__LGS_MOTION.remove()` on teardown to delete the global.
- **Node (tests):** `require('device/shared/motion.js')`.

Times are **milliseconds** (`performance.now()` scale) everywhere except `spring()`, which keeps MO §8's seconds.

| Member | Returns |
|---|---|
| `version` | Hash of the token table (same in all three outputs) |
| `tokens[name]` | Frozen `{name, d, b, ms, t50, t90, t98, overshoot, ease, durVar, easeVar}` for spring tokens; `{name, linear: true, ms, durVar}` for `mat-in`, `mat-out`, `page-out`, `glow-off`, `swap`, `reduce` |
| `reduceMs[name]` | The Reduce Motion duration of each token (§1.6) |
| `delays` | `{dwell: 80, page: 40, tabLabel: 400, backTitle: 600, reveal: 800, revealOut: 200, stagger: 30, staggerMax: 5}` |
| `curves` | `{b0, b15, b20, b25, matOut}`: the exact `linear()` strings |
| `spring(y0, v0, t, d, b)` | `[y, v]`: MO §8's closed form (t in s; y = x − target) |
| `sample(token, ms)` | Progress of a 0 → 1 step `ms` after it started (overshoot included; linear tokens clamp) |
| `velocity(token, ms)` | d(progress)/dt per second |
| `settle(token)` | Its CSS duration in ms (`reduce: true` option → the Reduce Motion one) |
| `timing(token, {reduce, delay, fill})` | `{duration, easing, delay, fill}` for `el.animate()` (literal `linear()` string, no `var()`) |
| `css(token)` | `"var(--lgs-d-…) var(--lgs-ease-…)"` |
| `create(token, {value = 0, reduce = false})` | A retargetable spring: `.to(target, now)` (keeps velocity, MO C5), `.value(now)`, `.velocity(now)` (units/s), `.done(now)` (true once |y| < 0.001 × travel and |v| < 0.01 × travel / d; the value is then exactly the target), `.jump(value)`, `.target`. With `reduce`, `.to()` jumps |
| `reduced(win = window)` | `matchMedia('(prefers-reduced-motion: reduce)').matches` |
| `allowed` | `{durations: [ms…], easings: [linear() strings…]}`: every token duration (normal and Reduce Motion) and curve, for G-MOTION / P-58 |
| `isTokenEasing(str)`, `isTokenDuration(ms)` | Match against `allowed`, tolerant of Chromium's serialisation (`linear(0 0%, …)`) |
| `audit(doc = document)` | `[{name, kind, target, duration, easings, iterations, playState, scroll, tokenDuration, tokenEasing}]` for every `doc.getAnimations()` entry (CSS animations report their per-keyframe easings; a scroll-driven one has `scroll: true` and `tokenDuration: true`) |
| `isScrollDriven(anim)` | True when the animation runs on a scroll or view timeline (e.g. `lgs-edge-in`, MO §4.13). Such an animation stays `running` while its scroller exists but moves only with the scroll, so at-rest checks (P-52, G-MOTION) skip it |
| `remove()` | Deletes `globalThis.__LGS_MOTION` |

Depth channel example (P7): `const s = __LGS_MOTION.create('depth', {value: 0}); s.to(dz, now); while (!s.done(t)) push(s.value(t));` then one final push of `s.target`.

---

## 4. C++ (`native/shared/motion_tokens.h`)

Header-only, C++17, `namespace lgs_motion`, no allocation:

- `struct Token {const char *name; float d, b, settleMs, t90Ms, overshoot;}` and `constexpr Token kInteractive, kHoverIn, kFade, kSnappy, kReleaseTouch, kMorphOpen, kMorphClose, kSheetIn, kSheetOut, kPage, kDepth`, plus `kTokens[]`, `kTokenCount`.
- Linear ramps: `kMatInMs = 250`, `kMatOutMs = 350`, `kReduceMs = 180` (GM §5.2: Reduce Motion coverage fade).
- glassd's phase policy (GM §5.2): `kPhaseUp = kSheetIn`, `kPhaseDown = kSheetOut` for covers and `thick`; linear `kMatInMs` / `kMatOutMs` for other slabs.
- Materialize optics ramp (MO §9, GM §5.3): `struct Range {float a, b;}` with `kRampLight {0, .6}`, `kRampLens {0, .7}`, `kRampFrost {.2, .92}`, `kRampTint {.2, .92}`, `kRampShade {.3, .92}`, `kRampShadow {.4, 1}`, `kRampAlpha {0, .3}` (smoothstep); `inline float ramp(float m, Range r)`, `inline float smoothstep01(float x)`.
- `inline void spring(float y0, float v0, float t, float d, float b, float &y, float &v)` (MO §8, any bounce) and `inline bool settled(float y, float v, float travel, float d)`.
- `kVersion`: the same hash as `motion.js`.

---

## 5. `springs.py`

| Command | Does |
|---|---|
| `python springs.py` | The preset/token table (MO §3) |
| `python springs.py --css` | One `linear()` + `cubic-bezier()` per bounce (D2 §11.3) |
| `python springs.py --emit css\|js\|h` | Print one generated output |
| `python springs.py --write` | Regenerate all three outputs in place |
| `python springs.py --check` | MO-1 (D2 §11.3 strings byte-identical) and every output up to date; exit 1 otherwise |
| `python springs.py --test-js` | MO-2: `motion.js` (via node) against the Python closed form at 1 ms steps for every token |
| `python springs.py --live mo3\|mo4\|cef\|film` | Live tests through the locked lab (`glass.py shot … --pre`, `glass.py js`): MO-3 keyframes at rest, MO-4 the same under `--media reduce`, MO-2 inside Steam's CEF, `film` the filmstrips and `shots/p2_cmp_p5_motion.png` (`--mode pad\|laser`, `--media reduce` pass through) |

---

## 6. Changelog

- 2026-10-07 (M1): contract written; names stable.
- 2026-10-07 (session 2): exit coverage curves moved from `0%` to their hold offset (Chromium merges implicit start values into an explicit `0%` keyframe, easing included; `wp/P5.md` D-P5-7). Large glass (`lgs-mat-large-in`, `lgs-sheet-in`, `lgs-sheet-out`) now fades its opacity over the glass channel, `min(1, m / .8)`, instead of glassd's quick coverage alpha, so alerts and sheets materialize like `window-nav-motion.html` instead of popping in (D-P5-8). Ramp plateaus are exactly 1 (no `.998` tail). `allowed.easings` holds only `linear()` strings. Names and call forms unchanged. Added `isScrollDriven(anim)` and the `scroll` field of `audit()` rows.
