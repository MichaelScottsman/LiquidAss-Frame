# Contract: lab and verification tools (P10)

Owner: P10. Files: `glass.py`, `lab/**`, `tools/mockshot.py`, `tools/p2/**`, `native/spike/hvgrab.cpp`.
Status of each command is in the table in §9 and in `docs/phase2/wp/P10.md` (Status). This file is the
interface other packages call; it changes only by adding things. Anything that changes behaviour is
announced in §10 (changelog) with the date.

**Backward compatibility.** Every Phase 1 command keeps its arguments and output (`check`, `sync`,
`native-build`, `shell`, `install`, `uninstall`, `on|off|toggle|reload|status|toast|dial`, `shot`, `perf`,
`audit`, `outline`, `styles`, `classes`, `click`, `js`, `eval`, `route`, `nav`, `back`, `surfaces`, `logs`).
The lab helper object `L` keeps every Phase 1 member (`L.nav`, `L.pad`, `L.click`, ...); new members are only
added.

**Exit codes** of every new command: `0` PASS (or "ran" for a measuring command), `1` FAIL, `2` usage error,
`3` BLOCKED (a dependency is not there yet: another package's module, the daemon, glassd, hvgrab). A BLOCKED
result always prints one line `BLOCKED: <reason>`.

## 1. Step options (every live lab command)

These options work on **every** command that runs a locked step on the device (`shot`, `audit`, `outline`,
`click`, `js`, `perf`, `nav`, `back`, `gates`, `pad-bfs`, `focus`, `motion`, `sgcheck`, `cmp` live part,
`native-session` steps). They are applied after the lock is taken and undone in the lock's `finally`, so other
agents never see them.

| Option | Effect inside the step | Undone by |
|---|---|---|
| `--flags a,b,c=v` | Runtime flags on for this step only. `a` means `a=true`; `c=v` parses `v` as JSON (`true`, `false`, numbers, `"str"`), else a string. Example: `--flags wp.c2a,interactivePops` | the lock exit |
| `--mode laser\|pad` | Input-mode stub: only **our** classes change, never Steam's getters (§1.2) | the lock exit |
| `--media reduce\|contrast\|reduce,contrast` | CDP `Emulation.setEmulatedMedia` on every Steam UI window (and the SteamVR page for `vr:` surfaces): `prefers-reduced-motion: reduce`, `prefers-contrast: more` | the CDP sessions close at the lock exit |

The options are stripped from the argument list before the command sees it, so they can go anywhere after the
command name. Each step prints one stderr line `step: flags=… mode=… media=…` with what was really applied
(`(none)` when an adapter was missing, see below).

### 1.1 How `--flags` is applied

1. **Runtime (P1).** `__LGS_RT.test.flags.push(obj)` returns a token; at the lock exit the lab calls
   `__LGS_RT.test.flags.pop(token)`. Requested from P1 (REQ P10->P1 in `wp/P10.md`). If P1 publishes another
   form in `contracts/runtime.md`, the lab follows it and this line is updated.
2. **Daemon flags file.** The merged object is also written to `/tmp/lgs/flags.json` (atomic rename) for the
   step, and the previous content (or its absence) is restored at the lock exit. P8 reads this file
   (`interactivePops`). A session override someone put there before the step is kept and merged under the step's
   flags.
3. While `__LGS_RT` is absent the runtime part reports `(no runtime)` and only the file is written.

### 1.2 How `--mode` is applied

1. **Runtime (P3).** `__LGS_RT.input.stub('laser'|'pad')` at the step start and `__LGS_RT.input.stub(null)` at
   the lock exit (REQ P10->P3). P3's stub changes only `html.lgs-input-*` and `data-lgs-vr-mode`.
2. **Fallback (no runtime):** the lab sets the same classes itself on every Steam popup window's `<html>`
   (`lgs-input-pad` or `lgs-input-laser`, and `data-lgs-vr-mode="gamepad"|"laser"`), remembers the previous
   values and restores them at the exit.
3. `--mode pad` also calls `FocusApplicationRoot()` (SR §4, `vr-null-tree`) so gamepad focus exists.
   `--mode laser` also moves the synthetic pointer to (1400, 900) at the exit (IM §9).

## 2. Locks

| Lock (on the Frame) | Held by | Wait |
|---|---|---|
| `/tmp/lgs/lab.lock` | every Steam step (Phase 1 rule) | 240 s, then the command fails with `lab: lock busy` |
| `/tmp/lgs/lab-vr.lock` | every `vr:` step, and Steam steps that also touch systemui (`sgcheck`, `hv`, `native-session` setup) | 240 s |
| `/tmp/lgs/native.lock` | `native-session` for its whole duration | 1800 s |

**Order** (no deadlocks): `native.lock` → `lab.lock` → `lab-vr.lock`. A step that needs both lab locks takes
them in that order. Nobody takes `native.lock` while holding a lab lock.

## 3. Offline commands (PC only, no device)

### `python glass.py check-theme [--json] [--quiet]`

Checks what `python glass.py sync` would upload. Exit 0 when clean, 1 when anything would break the bundle.

- `theme/*.css` and `theme/vr/*.css` (skipping `theme/_wip/`): balanced braces, strings and comments (the
  bundler's `brace_error`), `@keyframes` / `@font-face` / `@property` / `@import` only in `*.nowrap.css`;
  a `*.nowrap.css` file with a bare declaration block outside any rule.
- When `device/lgs.py` has P1's offline check (`lgs.py check` / `lgs.check()`), its result is included
  under `bundler`.
- `theme/layers/*.json`, `theme/popups/*.json`, `theme/sg/*.json`, `theme/layers.json`, `theme/lens.json`,
  `device/defaults.json`: valid JSON.
- `device/rt/*.js`, `device/shared/*.js`, `device/vr/*.js` (skipping `_wip/`): `node --check` syntax.
- Prints one line per problem: `FAIL theme/41-home.css: 1 unclosed '{'`.

### `python glass.py edge PNG Y X0 X1 [--inner 10]`

The WN §8.2 top-edge profile (`tools/p2/edge_profile.py`): 8 segment means and the ratio of the darkest to the
brightest quarter of `dL` along row `Y` (max over 3 rows) minus the glass 10 px inside. Pass: ratio ≤ 0.35
(AT-23, G-OUTLINE). `--json` for machine output.

### `python glass.py focus --png FILE --pair NAME=A:B[:MIN] ... [--luma 601|709] [--inset N]`

Luma of region pairs in an existing image (mockup render or live shot). Regions: `rect:x0,y0,x1,y1`,
`circle:cx,cy,r`. Prints `L(A)`, `L(B)`, `dL = A − B` per pair and PASS when `dL ≥ MIN` (default 40).
`--luma 601` (VP SHOT: 0.299 R + 0.587 G + 0.114 B, the default) or `709` (WN's measure script).
`--inset 6` shrinks each rect by 6 px (VP SHOT definition; default 0 for explicit regions).

### `python glass.py cmp MOCK.html LIVE.png [--id PKG] [--name WHAT] [--size 1920x1080]`

1. Renders `MOCK.html` with `tools/mockshot.py --rects`, which also dumps the rect of every element with a
   `data-id` attribute (mockup CSS px × device scale) to `shots/p2_cmp_<id>_<what>.rects.json`.
2. Composes `shots/p2_cmp_<id>_<what>.png`: mockup left, live right, same scale, labelled.
3. Rect deltas: for each `data-id` listed in `docs/phase2/wp/<PKG>-cmp.json` (schema below) it compares the
   mockup rect with the live rect and prints `id dx dy dw dh` and PASS when every value is within ±8 px
   (G-MOCK). Elements without a mapping are listed as unmapped.

`docs/phase2/wp/<PKG>-cmp.json` (owned by that package):

```json
{"surface": "main", "route": "/library/home", "pre": "optional JS run before the rects are read",
 "scale": 1.5,
 "mockOrigin": [320, 66],
 "map": {"window": "%{BasicUIRoot}", "play": "%{PlayButtonContainer>PlayButton}"}}
```

`mockOrigin` is the top-left of the window inside the mockup page, in mockup px (kit mockups put the window
at 320, 66 in a 1920 × 1080 page); live rects are window px × `scale`. When the JSON has a `route`, `cmp` reads
the live rects in one locked step (`--live` forces it, `--live-rects FILE` gives them instead).

### `python glass.py ledger [--out FILE] [--json]`

Builds the function ledger (§4.5) from every concept's retention table (`docs/phase2/concepts/*.md`). Default
output `docs/phase2/verify/functions.csv` (V2's file; other packages pass `--out`). Columns:
`audit_id,function,concept,owner,laser_path,gamepad_path,test_id,status`. It reports functions from the audits'
§A lists that no concept maps (exit 1 when any). Status is filled from `docs/phase2/wp/*.md` evidence lines of
the form `PASS <test id>` when present, else `open`.

### `python glass.py sgcheck --spec FILE [--json]`

The depth rules over a check model (§5) given as a file (TL-4, unit tests, other packages' fixtures).

## 4. Live commands

All hold `lab.lock` (plus `lab-vr.lock` where noted) for their whole run and leave the UI as they found it
(menus closed by `L.restore()`, pointer at (1400, 900) after a synthetic hover, route restored).

### `python glass.py gates SURF [--route R] [--pre JS] [--only aud,size,type,outline,motion] [--theme on|off] [--rest S] [--json] [--shot NAME]`

G-AUD, G-SIZE, G-TYPE, G-OUTLINE and G-MOTION in one lock. JSON on stdout with `--json`:

```json
{"surface": "main", "route": "/library/home", "step": {"flags": {}, "mode": "pad", "media": []},
 "build": "11094443", "date": "2026-10-07T04:10:00",
 "gates": {
   "AUD": {"pass": true, "controls": 118, "texts": 240, "issues": []},
   "SIZE": {"pass": false, "checked": 64, "fails": [{"el": "...", "rect": [x, y, w, h], "rule": "P-08|P-80|P-83", "why": "..."}], "exempt": [{"el": "...", "id": "E-MENU"}]},
   "TYPE": {"pass": true, "checked": 210, "fails": []},
   "OUTLINE": {"pass": true, "fails": [], "edges": [{"el": "...", "ratio": 0.12, "pass": true}]},
   "MOTION": {"pass": true, "atRest": 0, "running": [], "nonToken": []}},
 "pass": false}
```

Rules, from PLAN §4.1 and VP §6:

- **AUD**: the `audit` diff (theme off vs on in the same lock). GONE / HIDDEN / SHRUNK / UNCLICKABLE /
  CONTRAST = 0, except exempt elements (§6).
- **SIZE** (P-08, P-80, P-83; SM G2b method): every visible focusable or clickable control: visible short side
  ≥ 60 (fields ≥ 64); hit region sampled with `elementFromPoint` on a 4 px grid over B = max(80, w) × 80
  centred on the control: ≥ 95 % of samples hit the control or a descendant and 0 % another interactive
  target (a control nested in a row may also hit its host row); icon-only controls are circles
  (radius ≥ 0.48 × short side), text controls capsules (radius ≥ 0.45 × height) except vertical stacks.
- **TYPE** (P-38, P-84): no text under 18 px, no weight under 500, no `text-transform: uppercase`,
  `letter-spacing` > 0.01 em or `font-style: italic` in chrome (web content exempt, E-WEB).
- **OUTLINE** (P-42, P-43, AT-23): no `border` or `outline` wider than 0, and no uniform 1 px `box-shadow` ring,
  on any glass element (backdrop-filter or translucent fill, radius ≥ 16); no line under 2 CSS px; then a
  capture of the surface and the edge profile on the top edge of each glass element ≥ 200 px wide (ratio ≤ 0.35).
  High Contrast is exempt.
- **MOTION** (P-52, P-58, §1.5): 1 s after the pre, `getAnimations()` has nothing in `playState: running`, no
  `lgs-*` animation left, no infinite iterations; every `lgs-*` animation and every transition seen during the
  step has a token duration (D2 §11.2: 210, 294, 441, 488, 510, 607, 735, 514, 662, 250, 350 ms, and 150–200 ms
  under Reduce Motion) and a token easing (`--lgs-ease-b0|b15|b20|b25` or linear). Steam's finished `forwards`
  fills (`ItemFocusAnim-*`) are allowed.

`--shot NAME` keeps the capture as `shots/NAME.png` (default: deleted after measuring).

### `python glass.py pad-bfs [--route R] [--pre JS] [--start SEL] [--max N] [--budget S] [--no-b] [--json]`

Gamepad reachability over the four directions (G-PAD, P-20 to P-24), one lock:

1. `L.nav(R)`, the pre, `FocusApplicationRoot()`, then a Down + Up to activate focus (SR §4). The start node
   (`--start` selector, else the focused element) is recorded as the **entry focus** (P-22).
2. BFS: for every reached focusable, take focus on it (`node.BTakeFocus(3)` through its fiber, GP §0.4), press
   each direction once, record the edge `from → to` (or `edge` when focus stays, `exit:<surface>` when it leaves
   the main window, `route:<path>` when the route changes).
3. Safety, always on: never A, X, Y or menu; Left/Right refused on sliders (`L.pad`); a move that changes the
   route or opens the keyboard is undone (`SteamClient.OpenVR.Keyboard.Hide()`, `L.nav(R)`) and recorded; a move
   that leaves the window returns with `FocusApplicationRoot()`.
4. Reversibility: for every edge `a -Down-> b` it checks `b -Up-> a` (and Right/Left), except at edges.
5. B (unless `--no-b`): once at the end, B through `DispatchVirtualButtonClick(2)` from the entry focus;
   records whether the topmost layer closed or the route went back, then restores the route.

Output: `{route, entry, nodes: [{id, el, text, rect}], edges: {id: {up, down, left, right}}, unreached: [...],
irreversible: [...], b: {...}, pass}`. `unreached` lists visible focusables never reached. Budget defaults:
`--max 120` nodes, `--budget 150` s (the step then ends with `truncated: true`).

### `python glass.py focus SURF [--route R] [--pre JS] --pairs FILE|JSON [--json] [--keep]`

Live luma pairs (G-FOCUS, VP SHOT): each pair names two states and an element in each; one capture per distinct
state; luma (601 weights) averaged inside the element's rect × 1.5 inset by 6 shot px.

```json
[{"name": "P-14 focus vs rest", "min": 40,
  "a": {"state": "L.gpTake('main', '%{Poster}:nth-child(2)')", "sel": "%{Poster}:nth-child(2)"},
  "b": {"state": "L.gpTake('main', '%{Poster}:nth-child(3)')", "sel": "%{Poster}:nth-child(2)"}}]
```

`a.state` / `b.state` are JS run before that capture (same lock); `sel` (with `%{}` tokens) or `rect` gives the
region; `band: [8, 16]` instead measures the band 8–16 px outside the rect (P-16). Output per pair: `La, Lb, dL,
pass`. Shots are deleted unless `--keep`.

### `python glass.py motion SURF [--route R] --pre JS [--name ID_INTERACTION] [--at 0,.15,.35,.5,.75,1] [--json]`

1. Runs the pre (which starts the interaction), then at once pauses every animation in the surface's document.
2. Token audit of each animation (name, duration, delay, easing, iterations, fill) against D2 §11.2.
3. Filmstrip: for each f, seeks every animation to f × (delay + duration) and captures
   `shots/p2_motion_<name>_<f>.png`.
4. Resumes, waits 1 s, and checks nothing is left (P-52, §1.5).
5. Prints the JSON; G-MOTION's filmstrip verdicts (glass before content, no text scaling, no closed outline)
   are recorded by the agent who views the strip.

### `python glass.py sgcheck [--route R] [--pre JS] [--json]` (live; holds `lab.lock` and `lab-vr.lock`)

Builds the check model (§5) from the live system: the daemon's current spec, `__LGS_SG.dump()` in
`vr:systemui`, and the main window's DOM (focusable rects, `#Footer`, header, ornament zones), then applies the
rules. With no native session running it prints `BLOCKED: native layer off` (exit 3).

### `python glass.py hv NAME [--offaxis DEG] [--rect x0,y0,x1,y1] [--look]` (holds `lab-vr.lock`)

1. Builds `native/spike/hvgrab` on the Frame if missing (`g++`, the spike's own `build.sh`).
2. Captures `system.HeadsetView` to `/tmp/lgs/hv-<pid>.png`, fetches it, deletes the Frame copy at once.
3. Metrics (`tools/p2/hv_metrics.py`): glass luma inside the window rect (auto-detected, or `--rect` in frame
   px) and outside it; the top-edge profile ratio; a doubling score (normalised cross-correlation of the window's
   top band against itself shifted horizontally by 4–40 px; > 0.6 at a shift means a doubled edge).
4. Deletes the local copy (TL-5: no PNG left on either machine). `--look` instead moves it to the PC's temp
   folder (`%TEMP%/lgs-hv/`), prints the path for the agent to view, and **any** next `glass.py` command deletes
   it (and `python glass.py hv --clean` does it at once). Never copy it elsewhere (LAB never-list).
5. `--offaxis DEG` turns the dashboard by DEG degrees about the vertical axis through the scene-graph test hook
   (P7) for the capture and restores it; without that hook it prints `BLOCKED: no off-axis hook` (exit 3).

### `python glass.py native-session [--pre JS] [--settle S] [--step "CMD ARGS"]... [-- CMD ARGS]`

Holds `/tmp/lgs/native.lock` (waits up to 30 min), turns the native layer on
(`lgs_shell.py start --native --stay` after the theme is on), waits until `/dev/shm/lgs/shell.json` reports the
native layer enabled and glassd healthy (60 s; else exit 3 with the daemon's reason), runs the pre in
SharedJSContext, then each step in order, then **always** returns to CSS only (`lgs on --css`) and waits until
the native layer is off.

- A step is any lab command line, quoted (`--step "shot main p2_c2a_home_native --route /library/home"`), or
  one command after `--`. Steps take their own `lab.lock` as usual; step options (§1) work inside them.
- Files a step produces (`shot`, `motion`, `focus --keep`) are fetched to `shots/` like the plain commands.
- `hv` and `sgcheck` are valid steps.

### `python glass.py conformance [--route R]... [--only P-01,P-14] [--json] [--out FILE]`

Runs every automatable VP P-item (VP §6, verification codes AUD, DOM, CSS, PAD, SG, SHOT) on the given routes
(default: the route matrix rows of PLAN §4.2 that need no pre) and prints one line per item:
`P-38 PASS|FAIL|MANUAL|BLOCKED <detail>`. MANUAL marks REV, MOCK, FILM and HV items, which an agent judges.
`--out` writes the JSON (V2 points it at `docs/phase2/verify/`).

## 5. The depth check model (`sgcheck`)

```json
{"unitsPerMm": 0.00271, "profile": "default",
 "surfaces": [{"key": "main", "scale": 1.5,
   "covers": [{"x": 0, "y": 0, "w": 1920, "h": 984, "r": 81}],
   "plates": [{"x": 100, "y": 200, "w": 180, "h": 180, "r": 90}],
   "pops": [{"id": "card-3", "x": 300, "y": 300, "w": 240, "h": 360, "dz": 0.0407,
             "interactive": false, "shadow": true, "media": false, "destructive": false, "modal": false}],
   "focusables": [{"x": 300, "y": 300, "w": 240, "h": 360}],
   "forbidden": [{"name": "#Footer", "x": 420, "y": 942, "w": 1080, "h": 126}]}]}
```

Rects are texture px (CSS px × `scale`); `dz` is scene units (units = mm / (369 × r), PLAN §1.7); the CSS-px
size used by the click-safe rule is texture px / `scale`. Rules (each failure names its rule):

| Rule | Check |
|---|---|
| R1 covered | each pop rect inflated by 2 px lies inside the union of covers and plates (sampled on a 4 px grid) |
| R1b forbidden | no pop intersects a `forbidden` rect (bottom ornament, store ornament, tab bar, window-bar row, `/invites` header) |
| R2 click-safe | `dz ≤ 0.000521 × s`, s = the shorter side (CSS px) of the smallest focusable intersecting the pop; and dz is one of {0, 10, 15, 25} mm ± 0.5 mm |
| R3 media | no pop with `media: true` (unless the model says `holes: true`) |
| R4 destructive | no pop with `destructive: true` |
| R5 container | each pop ≥ 60 × 60 CSS px |
| R6 modal | while a pop has `modal: true`, every other pop is a descendant of the modal (`within` the modal rect) |
| R7 depths | ≤ 4 distinct dz values at rest (+1 with a modal open) |
| R8 interactive | `interactive: false` on every pop in the default profile |
| R9 shadow | `shadow: true` on every pop (P-48) |

## 6. Exemptions (PLAN §1.16)

The size, type and outline sweeps skip an element, and list it under `exempt`, when:

1. it or an ancestor carries `data-lgs-exempt="E-…"` (set by the owning package's T2 code), or
2. it matches a selector in `lab/exemptions.json` (owned by P10; send additions as `REQ <YOU>->P10`), or
3. it is inside web content (`%{MainBrowserContainer}`, `/steamweb`, `/externalweb`: E-WEB), or the keyboard
   (E-KEY).

Each exemption is checked against its own criterion where the table gives one (E-MENU, E-SWITCH, E-CHECK,
E-MINI, E-SEG, E-TAB, E-BAR); the result is reported as `exempt: [{el, id, pass}]`.

## 7. New lab helpers (`L`, in SharedJSContext)

| Helper | What |
|---|---|
| `L.gpTake(surface, sel)` | Give gamepad focus to the element (`node.BTakeFocus(3)` through its fiber). Returns `L.focused()` |
| `L.root()` | `FocusApplicationRoot()` then Down + Up, so gamepad focus exists (SR §4) |
| `L.hover(surface, sel, ms)` | Synthetic laser hover (pointerover/enter/move at the centre) for `ms`, then leaves it; `L.unhover()` moves to (1400, 900) |
| `L.focusables(surface)` | Visible focusable elements with rects |
| `L.anims(surface)` | `getAnimations()` summary (name, duration, delay, easing, iterations, playState, target) |
| `L.gates.*` | The sweeps used by `gates` (size, type, outline, motion) |

## 8. Evidence names

Shots as PLAN §2.1: `shots/p2_<id>_<what>.png`, comparisons `shots/p2_cmp_<id>_<what>.png`, filmstrips
`shots/p2_motion_<id>_<interaction>_<f>.png`. Commands print the shot names they wrote, the Steam build and the
date, ready to paste into an evidence log.

## 9. Command status

| Command | Status | Since |
|---|---|---|
| `--flags`, `--mode`, `--media` | **live** (runtime adapters: `rt.test.flags.push/with` when P1 ships it, else the flags file only; `rt.input.stub` when `wp.p3` is on, else the classes fallback) | 2026-10-07 |
| `check-theme` | **live** (P1's `lgs.check` merged once it exists) | 2026-10-07 |
| `edge` | **live** | 2026-10-07 |
| `native-session` | **live** | 2026-10-07 |
| `gates` | **live** (`--theme off` for stock baselines: AUD skipped, theme given back at the end) | 2026-10-07 |
| `pad-bfs` | stub (exit 3) | 2026-10-07 |
| `focus` | `--png` form **live**; live form stub (exit 3) | 2026-10-07 |
| `hv` | **live** (`--offaxis` BLOCKED until P7's yaw hook) | 2026-10-07 |
| `sgcheck` | stub (exit 3) | 2026-10-07 |
| `motion` | stub (exit 3) | 2026-10-07 |
| `cmp` | stub (exit 3) | 2026-10-07 |
| `ledger` | stub (exit 3) | 2026-10-07 |
| `conformance` | stub (exit 3) | 2026-10-07 |

## 10. Changelog

- 2026-10-07: M1. Contract written; every command parses and exits 3 (stub) until it lands.
- 2026-10-07: step options `--flags`, `--mode`, `--media` live on every locked step; `check-theme`, `edge` and
  `focus --png` live. `focus --png` regions gained `pill:` (capsule) and `rrect:`. `tools/mockshot.py --rects OUT.json
  [--sel CSS]` dumps `data-id` and selector rects from the same render.
- 2026-10-07: `native-session`, `gates`, `hv` live. Every locked Steam step now also turns P1's action logger on
  (`rt.test.actions.enable(true)`, never-list safety net, P1's recommendation) and off at its exit. `shot --theme off`
  (a before-shot) now gives the theme back at the end of its step instead of leaving it off for everyone. The lab
  helpers reinstall themselves whenever their source changes (`L.hash`). `gates --theme off` runs the sweeps on the
  stock UI (TL-1 baselines).
