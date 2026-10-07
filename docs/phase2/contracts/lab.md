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
| `--hover SEL[,MS]` | A **real** laser hover: CDP `Input.dispatchMouseEvent` (mouseMoved) to the centre of SEL on the command's surface, after its `--pre`, held MS ms (default 300) and for the rest of the step; CSS `:hover` applies (untrusted `L.hover` events never set it). Also as `--pre "@hover SEL[,MS]"` and as `focus` states `"@hover SEL[,MS]"` / `"@unhover"` | the pointer is **parked** on every hovered surface at the lock exit (PLAN §7 item 2, IM §9): (1400, 900) in CDP coordinates (CSS px), outside the main window's 1280 × 720 viewport, so it rests on nothing (on a viewport that contains that point, just beyond its far corner). Until session 5 the lab divided the point by the pixel ratio and clamped it into the viewport, (933, 600) on main, which lies on Home's All Games disc (REQ C2a-R2->P10 (2)) |
| `--stock` | The stock UI for the step: the theme (CSS and runtime) is turned off after the lock is taken, if it was on (TL-1 baselines, before-shots) | the theme is turned back on at the lock exit |

The options are stripped from the argument list before the command sees it, so they can go anywhere after the
command name. Each step prints one stderr line `step: flags=… mode=… media=… native=on|off` with what was really
applied (`(none)` when an adapter was missing, see below) and the native layer's state at the time. Every result
JSON carries `build`, `date` and `native` (`on`/`off`/`unknown`), taken once the step holds its lock (since session
5; before, they were taken before the lock wait, which can last minutes, and a step that ran during another agent's
native session could say `native: off`): `native-session` releases the lab locks between
its steps, so another agent's CSS-tier step can run while native mode is on, and its evidence says so (R1 m2).

### 1.1 How `--flags` is applied

1. **Runtime (P1).** `__LGS_RT.test.flags.push(obj)` returns a token; at the lock exit the lab calls
   `__LGS_RT.test.flags.pop(token)`. Requested from P1 (REQ P10->P1 in `wp/P10.md`). If P1 publishes another
   form in `contracts/runtime.md`, the lab follows it and this line is updated.
2. **Daemon flags file.** The step's flags are merged into `/tmp/lgs/flags.json` (atomic rename) for the step.
   P8 reads this file (`interactivePops`). The read-modify-write holds its own lock, `/tmp/lgs/flags.lock` (a
   `lab.lock` step and a `lab-vr.lock` step can run at the same time), and at the lock exit only the step's own
   keys are put back to their previous values (or removed); an empty object removes the file, as P1's
   `lgs flags` does. A session override someone put there before or during the step is kept (R1 m1).
3. While `__LGS_RT` is absent the runtime part reports `(no runtime)` and only the file is written.
4. **A step killed before its lock exit** (SIGKILL, a dropped SSH session) would leave its keys in the flags file,
   where they act as session flags for everyone until `lgs off` (C2b review R2: `c2bToggle` and `wp.c2b` stayed on
   from 13:13). Since session 5 each step that writes the file also writes a record
   `/tmp/lgs/flag-steps/<pid>-<n>.json` (its keys, their previous values, its own values, its pid and the process's
   start time) and deletes it at its exit. Every lock entry undoes the records of processes that are gone (pid
   absent, or the pid reused by a process with another start time) as that step's exit would have: each key back to
   its previous value or removed, but only while the file still holds the value that step wrote (a later writer's
   value is kept); the runtime's session flags are then set from the file again, and stderr says `lab: put back
   session flags a killed lab step had left on: …`. Keys a step left before session 5 have no record: `lgs flags`
   (the coordinator) removes them.

### 1.2 How `--mode` is applied

1. **Runtime (P3).** `__LGS_RT.input.stub('laser'|'pad')` at the step start and `__LGS_RT.input.stub(null)` at
   the lock exit (REQ P10->P3). P3's stub changes only `html.lgs-input-*` and `data-lgs-vr-mode`.
2. **Fallback (no runtime):** the lab sets the same classes itself on every Steam popup window's `<html>`
   (`lgs-input-pad` or `lgs-input-laser`, and `data-lgs-vr-mode="gamepad"|"laser"`), remembers the previous
   values and restores them at the exit.
3. `--mode pad` also calls `FocusApplicationRoot()` (SR §4, `vr-null-tree`) so gamepad focus exists.
   `--mode laser` also parks the synthetic pointer at the exit (`L.unhover()`: its leave and move events at
   (1400, 900) CSS px, outside the viewport, as the CDP park above; IM §9).

## 2. Locks

| Lock (on the Frame) | Held by | Wait |
|---|---|---|
| `/tmp/lgs/lab.lock` | every Steam step (Phase 1 rule) | 240 s, then the command fails with `lab: lock busy` |
| `/tmp/lgs/lab-vr.lock` | every `vr:` step, and Steam steps that also touch systemui (`sgcheck`, `hv`, `native-session` setup); `hv` takes `lab.lock` first as well when it holds a `--route`/`--pre`/`--hover` layer open for the capture or has a Steam step option (`--mode`, `--flags`, `--media`, `--stock`; session 5) | 240 s |
| `/tmp/lgs/native.lock` | `native-session` for its whole duration | 1800 s |

**Order** (no deadlocks): `native.lock` → `lab.lock` → `lab-vr.lock`. A step that needs both lab locks takes
them in that order. Nobody takes `native.lock` while holding a lab lock. A `lab.lock` step that reads systemui
briefly (`conformance` in a native session) takes `lab-vr.lock` for that read only. `/tmp/lgs/flags.lock` (30 s)
guards the flags file and is held for milliseconds.

**Exception safety** (R1 M4): if taking a lock or applying the step options raises (a lock busy for 240 s, a CDP
error), the options already applied are undone, the locks already taken are released and the re-entry counter is
reset before the error goes on, so the next step of the same process (a `native-session`) locks normally.

**Room frames** (LAB never-list, R1 M5): every lock entry deletes `/tmp/lgs/hv-*.png` older than 60 s; each `hv`
frame also gets a detached 90 s `sleep; rm -f` on the Frame; `glass.py` handles each `@@hv` line as it streams
(fetch, measure, delete on both machines) and deletes any announced frame it could not handle;
`native-session` deletes its own unfetched frames in its `finally`. Lab captures live under `/tmp/lgs/shots/`
(was `/tmp/lgs-shots`, R1 m9).

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
- P4's hook host lists (REQ P4->P10): `python docs/phase2/fontkit.py --hooks-check`. Stale lists (a theme rule sets
  `--lgs-ill`, `--lgs-edge` or `--lgs-scroll-band` on a selector the generated `lgs-hosts` blocks of
  `03-material.css` / `04-states.css` do not list, so that hook paints nothing) print one `WARN …` line, also with
  `--quiet`, and the JSON carries `warnings`. A warning never fails the check: run
  `python docs/phase2/fontkit.py --hooks` (any package may, contracts/tokens.md §2).

### `python glass.py edge PNG Y X0 X1 [--inner 10]`

The WN §8.2 top-edge profile (`tools/p2/edge_profile.py`): 8 segment means and the ratio of the darkest to the
brightest quarter of `dL` along row `Y` (max over 3 rows) minus the glass 10 px inside. Pass: ratio ≤ 0.35
(AT-23, G-OUTLINE), or no visible edge at all (brightest quarter < 8 dL: `edge: "none"`). Luma 601 by default
(`--luma 709` for WN §8.2's revision 2 table). `--json` for machine output.

### `python glass.py focus --png FILE --pair NAME=A:B[:MIN] ... [--luma 601|709] [--inset N] [--room R]`

Luma of region pairs in an existing image (mockup render or live shot). Regions: `rect:x0,y0,x1,y1`,
`circle:cx,cy,r`. Prints `L(A)`, `L(B)`, `dL = A − B` per pair and PASS when `dL ≥ MIN` (default 40).
`--luma 601` (VP SHOT: 0.299 R + 0.587 G + 0.114 B, the default) or `709` (WN's measure script).
`--inset 6` shrinks each rect by 6 px (VP SHOT definition; default 0 for explicit regions). `--room` as for live
`focus` (§4, session 5): a PNG with translucent texels in a pair's regions is measured over the bright and dark test
rooms by default; an opaque render is measured as stored.

### `python glass.py cmp MOCK.html [LIVE.png] [--id PKG] [--name WHAT] [--size 1920x1080] [--live] [--live-rects FILE] [--surface S] [--json]`

Works offline when it has the live shot and rects; it connects only for its live step. Step options (`--flags`,
`--mode`, `--media`, `--stock`) apply to that step.

1. Renders `MOCK.html` with `tools/mockshot.py --rects`: the rect of every element with a `data-id` (page px; a
   repeated `data-id` keeps its first occurrence) and of `.lgk-overlay` (the kit's window) go to
   `shots/p2_cmp_<id>_<what>.rects.json` (`<id>` = PKG lower case, `<what>` = `--name` or the mockup's stem).
2. Live: when the package's cmp.json gives a `route` (or with `--live`, or when LIVE.png is missing or not given),
   one locked step navigates, runs the `pre`, reads the rect of every mapped element (surface CSS px) and, when
   LIVE.png is missing or not given, captures the surface into it (default `shots/p2_cmp_<id>_<what>_live.png`).
   The live rects are saved as `shots/p2_cmp_<id>_<what>.live.json`; `--live-rects FILE` re-runs offline from it.
3. Composes `shots/p2_cmp_<id>_<what>.png`: the mockup's window region (from `mockOrigin`, the live window's CSS
   size) scaled to the live shot's size on the left, the live shot on the right, labelled with the files, build and
   date; mapped rects outlined (mockup cyan, live magenta).
4. Deltas per mapped `data-id`, in surface CSS px: mockup = (page rect − `mockOrigin`) / `mockScale`, live = the
   element's `getBoundingClientRect()`. Prints `id dx dy dw dh` and PASS when every value is within ±8 px (G-MOCK);
   `data-id`s without a mapping are listed as unmapped. Exit 0 PASS (or no map: side by side only), 1 FAIL.

`docs/phase2/wp/<PKG>-cmp.json` (owned by that package), one mockup:

```json
{"surface": "main", "route": "/library/home", "pre": "optional JS run before the rects are read",
 "mockOrigin": [320, 66], "mockScale": 1,
 "map": {"window": "%{BasicUiRoot}", "play": "%{PlayButtonContainer>PlayButton}"}}
```

or several mockups (C1b, C1c, C3a), each entry selected by `--name`, else by the mockup file's stem (an entry
whose key ends the stem, or the reverse, also matches); top-level fields are defaults for every entry:

```json
{"mockups": {
  "window-nav-search": {"route": "/search", "pre": "...", "mockOrigin": [320, 30], "map": {"field": "..."}},
  "control-center-bar": {"surface": "bar", "mockScale": 1.2, "mockOrigin": [120, 400],
                         "map": {"pill": "%{...}", "toast": {"sel": "%{...}", "surface": "notifications",
                                                             "mockOrigin": [700, 40], "mockScale": 1.107}}}}}
```

- `mockOrigin`: the top-left of the surface inside the mockup page (mockup px). Default: the `.lgk-overlay` rect
  when the mockup has one, else (320, 66).
- `mockScale`: mockup px per surface CSS px (1 for windows drawn at true size; C3a's popup quads at `--pop-scale`
  1.2, 1.107, 1.93). Default 1.
- A `map` value is a selector string (`%{Token}`, `@text=Label`, and a final `@last` or `@nth=N` to pick among the
  visible matches; default the first) or an object `{sel, surface, mockOrigin, mockScale}` that overrides the entry
  for that element.

### `python glass.py ledger [--out FILE] [--json] [--quiet]`

Builds the function ledger (§4.5): one CSV row per row of every concept's "Function retention table"
(`docs/phase2/concepts/*.md`). Default output `docs/phase2/verify/functions.csv` (V2's file; other packages pass
`--out`). Columns: `audit_id,function,concept,owner,laser_path,gamepad_path,test_id,status`.

- **audit_id** = `<AUDIT>-<id>` with SN shell-nav, LA library-apps, GP game-pages, SY system, SM social-media. A row's
  audit is the code its id carries (`SN H1`), else the first code in the nearest heading above its table
  (`### 12.1 Library home (LA A.1)`), else the concept's default (window-nav SN, home-apps LA, control-center,
  controls and settings SY, game-pages GP, social-media SM). An id that is not in that audit's §A list is the
  concept's own and is written as `WN-`, `HA-`, `CC-`, `CTL-`, `GPC-`, `SET-` or `SMC-<id>`. Ids look like `H1`,
  `AC3`, `PF2`, optionally followed by a note (`E6 (new)`); rows without one (per-page lists) are skipped.
- **Columns** are found by their header: `#`, `Function`, `Laser…`, `Gamepad…` or `Pad`, `Owner` (else the concept's
  owner package), `Test`.
- **status** (R1 M6: test ids are per concept and per package): every test id of the row is resolved in its own
  namespace and needs an **evidence-table row in that namespace's log** whose first cell starts with the id (or
  `<code> <id>`) and whose later cell starts with `PASS` or holds `**PASS**`. Namespaces: `C1c AT-13` / `P3 IN-7`
  → that package's `wp/<PKG>.md`; `WN AT-9`, `SET T-VR`, `CC A3–A6` (ranges expand) → the logs of that concept's
  packages (WN: C1a, C1b, C1c; HA: C2a–C2c; CC: C3a, C3b; CTL: C4a, C4b; GPC: C5a, C5b; SET: C6a, C6b; SMC/SM: C7);
  `PLAN-2c-2` → C2c; a bare id (`AT-6`, `C4`) → the row's owner packages; a gate name (`G-PAD`) also needs one of
  the row's routes in the same line; exemption ids (`E-BACK`) are not tests. `pass` when every id has such a row,
  `partial` when some do, `static` for `[x]` rows (actions tests never perform) without a test id, else `open`.
  The CSV's last column `evidence` names the log row each id was found in (`C1a: AT-26`).
- Exit 1 when an audit function (§A rows with an id) is mapped by no concept (listed), or a row has no laser or no
  gamepad path.

### `python glass.py sgcheck --spec FILE [--json]`

The depth rules over a check model (§5) given as a file (TL-4, unit tests, other packages' fixtures).

## 4. Live commands

All hold `lab.lock` (plus `lab-vr.lock` where noted) for their whole run and leave the UI as they found it
(menus closed by `L.restore()`, the pointer parked outside the viewport after a hover (§1), route restored, SteamVR
pages themed again after a `--theme off` step on a `vr:` surface (REQ P8->P10, session 5: until then a before-shot
of a SteamVR page left the daemon's page theming paused for up to 300 s)).

**Surfaces with several windows** (session 5, REQ C2b-R2->P10): Steam keeps two `barpopup` windows (92520001 and
92520007, one per popup kind) and several tooltip windows. An alias names **the one that is shown**
(`document.visibilityState` `visible`), else the first, both in the JS helpers (`L.surface`, `L.surfaceName`) and
for CDP (`target_for`: captures, hovers). Until session 5 the JS helpers took the first window in Steam's popup map
and CDP the first target, even while hidden: `barpopup` could name a closed window while the "+" popup was open in
the other one (an empty AUD snapshot; a capture waiting for a frame that never came).

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
  CONTRAST = 0, except exempt elements (§6). A scoped exemption (§6 `_scope`, E-GRID) waives only the issue kinds
  it lists (SHRUNK), only on the element its criterion judges (the cell, not what the cell holds), and only while
  that element meets its own criterion (listed under `exempt` with `waived` and `why`); otherwise the issue
  stays, with "(E-GRID criterion not met: …)". The text runs inside an E-GRID cell have their own line, **E-GRID
  (labels)** (§6, PLAN §1.16 [R2-15]). **Text runs are judged as text** (session 5, REQ C7->P10): a text run whose
  box shrinks while its whole string stays shown (no ellipsis, line clamp or clip that cannot scroll cuts it: the
  run's own clip, and each clipping ancestor per axis up to the first one that scrolls on that axis; with no
  scroller, the window and C1a's glass cut), with the same text (case and spaces ignored) at a drawn size no
  smaller than stock, is listed under `exempt` as `text-whole` with both sizes, not as SHRUNK (`/invites`' title,
  1032 × 32 → 472 × 38 at 29.6 px for 22). A cut string or smaller type stays SHRUNK whatever the box's size (until
  session 5 a text box ≥ 300 × 300 passed as a pane, cut or not). These AUD rules (`scroll-container`,
  `container-pane`, `text-whole`) say what SHRUNK measures; they are not PLAN §1.16 exemptions and are listed for
  the coordinator in `wp/P10.md` (REQ P10->Coordinator, session 5).
  **Records the theme moved in the DOM** (session 5, REQ C2b-R2->P10): AUD keys are DOM paths, so a control the
  theme re-parents or reorders (C2b's T3 wraps Steam's own "+" rows in its panel and sorts them A–Z) has no record
  at its stock path, and the theme may put a new element at that path (T3's toggle row where Steam's list box was).
  So: (a) records at the same path with another kind or another first readable class are not the same element and
  are not compared (`pathCollisions`); (b) a stock record left without a themed record is matched to the one
  unmatched themed record of the same kind, first class and text (case and spaces ignored; a control's text is its
  innerText, value or aria-label), when that identity is unique among the unmatched records on both sides; (c) then
  to the one of the same kind and first class when that class (not a bare tag name, `Panel` or `Focusable`) occurs
  exactly once in each whole snapshot (a list box whose text changed with its rows). A control with its own
  activation handler on stock is never matched to one without. The pair is then judged as usual (HIDDEN, SHRUNK,
  UNCLICKABLE, CONTRAST, its exemption line). An empty or repeated identity is never matched: its GONE stays. The
  result says `rematched` (count) and `rematch` (the first 12; "(by its class)" for (c)). Until session 5 every row
  in T3 read GONE, and T3's toggle row was compared with Steam's list box (SHRUNK 260 × 569 → 276 × 64). (`audit`,
  the Phase 1 command, keeps its path-only diff.)
  **No data is not a pass** (session 5): when the theme switch closed a popup the pre opened (or a runtime patch
  unmounted what it drew), the pre is run again (`preRerun: ["stock"|"themed"]`); a snapshot that still holds no
  control or text run makes AUD fail with `VACUOUS …` (`conformance`: P-39 BLOCKED) instead of reporting 0 issues
  over nothing (the "+" popup with `wp.c2b`, "controls 0, texts 0").
- **SIZE** (P-08, P-80, P-83; SM G2b method): every visible focusable or clickable control: visible short side
  ≥ 60 (fields ≥ 64); hit region sampled with `elementFromPoint` on a 4 px grid over B = max(80, w) × 80
  centred on the control's **visible** rect (REQ C2a->P10 #13; for a fully visible control its own centre, and
  w is the visible width; since session 5 the obscured test below uses this same box, so a tall control whose
  visible part holds B is sampled there, not skipped): ≥ 95 % of samples hit the control or a descendant and 0 %
  another interactive target (a control nested in a row may also hit its host row); icon-only controls are
  circles (radius ≥ 0.48 × short side), text controls capsules (radius ≥ 0.45 × height) except vertical stacks.
  **Part of its host** (REQ C3a->P10): an element Steam renders with the `Focusable` class whose Panel says
  `focusable: false` and which has no activation handler of its own (`onClick`, `onActivate`, pointer, mouse or
  touch down/up, the gamepad button handlers; read from its React fibers up to that Panel), inside another
  control, is not a target: a click on it bubbles to the control around it and the gamepad never focuses it
  (the Quick Access pill's battery, volume, Wi-Fi and bell glyphs). It is listed under `skipped` ("part of its
  host") and the host is judged whole. Native `button`, `input`, `a[href]` and anything with its own handler stay
  targets.
- **TYPE** (P-38, P-84): no text under 18 px, no weight under 500, no `text-transform: uppercase`,
  `letter-spacing` > 0.01 em or `font-style: italic` in chrome (web content exempt, E-WEB). **Body text ≥ 22 px**
  (P-38, R1 m6): a text block outside any control that wraps to 2+ lines with 40+ characters, or holds 80+
  characters, fails `body size N < 22`; shorter text is a label or metadata (Subheadline 20, Footnote and
  Caption 18 are allowed there, DESIGN2 §8.1).
- **OUTLINE** (P-42, P-43, AT-23): checked on every element **and on its `::before` / `::after`** whenever their
  `content` is not `none` (R1 M2: the theme draws panes, selection fills and rims on pseudo-elements; a
  pseudo-element's box is its insets and size against the host's padding box). On any glass box (backdrop-filter,
  P4's `--lgs-edge` hook or a translucent fill, radius ≥ 16): no `border`, no `outline`, no `box-shadow` ring
  (0 offsets, 0 blur, spread ≤ 2 px) and no **closed rim** of hard shadow lines (P-42). Anywhere: no line under
  2 CSS px (P-43): borders, 1 px filled elements (and pseudo-elements), and **hard shadow lines** (0 blur, spread
  ≤ 0, one offset of 1–2 px, e.g. `inset 0 1px 0 rgba(255,255,255,.4)`), and rings on non-glass boxes (a selection
  fill's `0 0 0 2px`). Then a capture of the surface and the WN §8.2 edge profile on **every side** of each glass
  box that can be seen: top and bottom when it is ≥ 200 px × m wide, left and right when ≥ 120 px × m tall (each
  side measured as a top edge after a flip or transpose; ratio ≤ 0.35, or no visible edge). A side that lies on the
  capture edge is measured from one texel inside (`captureEdge: true`, REQ C3b->P10 (2)): Steam's popup textures
  draw their outermost row as a uniform line on the stock UI too (barpopup: 31 L against 19–26 L above it), so that
  texel is not the slab's edge; the rim rows above it are measured as usual. The capture is the one
  file the result names (`OUTLINE.shotLocal`); a missing capture is an `error` and a FAIL, never 0 probes and a
  PASS (R1 m3). High Contrast is exempt from the ring, rim and shadow-line rules (P-42), and since session 5 from
  the edge profile too (REQ C2a-R2->P10 (5): its 2 px edge is D2's High Contrast glass, which the profile read as a
  line, ratios .66–.99): while the surface matches `prefers-contrast: more` (`--media contrast`) each profile is still
  measured and listed with `highContrast: true` and its own verdict as `judgedPass`, but it does not fail OUTLINE;
  the summary says "High Contrast: rings, rims, lines and edge profiles not judged, P-42".
- **MOTION** (P-52, P-58, §1.5): 1 s after the pre, `getAnimations()` has nothing in `playState: running`, no
  `lgs-*` animation left, no infinite iterations; every `lgs-*` animation and every transition seen during the
  step has a token duration (D2 §11.2: 210, 294, 441, 488, 510, 607, 735, 514, 662, 250, 350 ms, and 150–200 ms
  under Reduce Motion) and a token easing (`--lgs-ease-b0|b15|b20|b25` or linear). Steam's finished `forwards`
  fills (`ItemFocusAnim-*`) are allowed.

`--shot NAME` keeps the capture as `shots/NAME.png` (default: deleted after measuring).

**Sweep scope (all gates).** While a `%{*ModalOverlayContent}` is active, SIZE and TYPE judge only what lies in the
topmost one and OUTLINE probes nothing under it. Each element's visible part is its rect cut by every clipping
ancestor (overflow other than visible, `clip-path`), the window and C1a's `--lgs-c1a-gh`: what is clipped away is
skipped (`skipped: clipped`). **Obscured** (REQ C4a->P10 (2) and its refinement, session 4; session 5): a control
in a scroller whose box B (centred on its visible rect, as above) has its centre or ≥ 25 % under chrome outside
its outermost scroller (bottom ornament, header) or outside the fixed clip (the window, the glass cut, clips of
that scroller and its ancestors on axes they do not scroll), or that is only partly visible (its visible part
shorter or narrower than B), is `skipped: obscured` (or `partly visible: P-08 not sampled (scrolls clear)`; it is
scrolled into view before use; `under` = the share of B), **but only when its scrollers can bring the whole box
clear**: along each axis some scroller around it scrolls, three lines through B (both edges and the centre) are
probed every 4 px across the window with the same test, plus the viewport of the outermost scroller on that axis;
B can clear when a clear run is at least as long as B and the shift that puts B into it is within the scrollers'
room that way (`scrollHeight − clientHeight − scrollTop` to move content up, `scrollTop` to move it down; likewise
across). Until session 5 only B's own samples were compared, so a box lying wholly in the ornament band (obscured
at both of its edges) counted as never clearable. A control that cannot be scrolled clear is judged where it is,
partly visible or not: its P-08 failure says so ("… under chrome or the glass cut, only partly visible, and its
scrollers cannot bring it clear: needs down N (room M) px"), and a passing one is listed under `inPlace`. A
control outside any scroller that is only partly visible, with a visible part shorter (or narrower) than SIZE's
80 px box, is not sampled for P-08 (`skipped: partly visible: P-08 not sampled`, REQ C2a->P10 #9); P-80 and P-83
are still judged. A clipping
ancestor's `clip-path: inset(...)` is resolved (px, %, `calc(100% - Npx)`), so C1a's glass cut at
`--lgs-c1a-gh` is seen wherever that variable lives. A control whose sampling box meets a visible
`[data-lgs-transient]` element (Home's attention card, a popover) that is neither its ancestor nor its descendant
is `skipped: covered (transient)`; the transient's own controls are judged as usual (REQ C2a->P10 #12). SIZE's P-83 skips
list rows (`%{*GamepadDialogContent>Field}`, `role=option|tab|row|listitem`) and content cards (art and ≥ 100 px ×
m tall). OUTLINE's glass is a backdrop filter, P4's `--lgs-edge` hook, or a translucent fill other than a plain black
tint (alpha < .5), radius ≥ 16; an edge probe whose brightest quarter is under 8 dL has `edge: "none"` and passes (no
visible line). MOTION judges only **our** animations (keyframes from our sheets, transitions our rules declare);
Steam's running ones are listed as `steamRunning`; scroll-driven animations (`__LGS_MOTION.isScrollDriven`, else a
non-document timeline) skip the at-rest and duration checks but keep the easing check. AUD lists a scroll container
that stays ≥ 300 × 300 as `exempt: scroll-container` rather than SHRUNK, and likewise a **pane** that stays
≥ 300 × 300 as `exempt: container-pane` (REQ C7->P10: `/chat`'s panes under C1a's toolbar and footer pads): a
focusable Panel that holds other controls, or that has no activation handler of its own (Steam's React props, as
for "part of its host"; `/chat`'s empty `chatDialogs`). Its controls are audited one by one; a leaf target with its
own handler that shrinks is still SHRUNK, whatever its size. Only SHRUNK is waived for a pane. Text runs are not
panes (session 5): they are judged as text (`text-whole`, above). `--stock-route R2` (gates and `audit`)
snaps R2 with the theme off and the `--route` themed, running the pre again (AUD keys are DOM paths: the page must
keep Steam's DOM structure).

### `python glass.py pad-bfs [--route R] [--pre JS] [--start SEL] [--max N] [--budget S] [--no-b] [--json]`

Gamepad reachability over the four directions (G-PAD, P-20 to P-24), one lock:

1. `L.nav(R)`, the pre, `FocusApplicationRoot()`, then a Down + Up to activate focus (SR §4). The start node
   (`--start` selector, else the focused element) is recorded as the **entry focus** (P-22).
2. BFS: for every reached focusable, take focus on it (`node.BTakeFocus(3)` through its fiber, GP §0.4), press
   each direction once, record the edge `from → to` (or `edge` when focus stays, `exit:<surface>` when it leaves
   the main window, `route:<path>` when the route changes).
3. Safety, always on: never A, X, Y or menu; Left/Right refused on sliders (`L.pad`); a move that changes the
   route or opens the keyboard is undone (`SteamClient.OpenVR.Keyboard.Hide()`, `L.nav(R)`) and recorded; a move
   that leaves the window is brought back (below).
   **Exits** (REQ C1b->P10 #10, C2a->P10 #14): main has the gamepad only while Steam's active nav tree lives in
   main's document. After Left from a row's first item it is the frame menu's `VRFrameMenu-…` tree or
   `vr-null-tree` (the gamepad has left Steam's overlay: session 5 probes on `/library/tab/AllGames` and
   `/search/tab/All`); another window's tree, such as the VR keyboard's, can also keep it while main still shows a
   stale `.gpfocus`. After an `exit:` edge the sweep brings focus back, each step counted only if main still has
   the gamepad 150 ms later (session 4 counted a moment Steam undid at once, and every later node was then
   untakeable): (1) the **opposite direction** (which also tells whether the exit is reversible); (2) main's own nav
   tree activated (`FindNavTreeInWindow(main)` → `Activate(true)`, `tree`); (3) `FocusApplicationRoot()` (`root`);
   (4) Steam's `EnsureVROverlayVisible()` on the main window, then the root and Down + Up (`overlay`: what brings
   the gamepad back after `vr-null-tree`; it is what Steam's own `Navigate` calls, here without navigating);
   (5) Steam's `Navigate(route, replace)` to the same route, then the root and Down + Up (`nav`; the history entry is
   replaced, so the final B sees Steam's own history); (6) the tree and the root once more (`tree+root`). A Down that
   changes the page on the way (Settings) is undone. Every exit is listed in `exits: [{from, dir, to, back:
   'opposite'|'tree'|'root'|'overlay'|'nav'|'tree+root'|null}]` (`null`: focus did not come back), and the next
   node is taken only once main has the gamepad again. A take that does not land (main shows `.gpfocus` but its
   tree is not Steam's active one) activates main's tree and takes once more (`retook` counts these); a node that
   still cannot be taken is `untakeable`, and the summary lists such nodes. Exits do not enter `pass` (leaving the
   window at its edge is an edge, as on stock Steam).
4. Reversibility: for every edge `a -Down-> b` it checks `b -Up-> a` (and Right/Left), except at edges. A failed
   check is measured once more on a user path (REQ C2a-R2->P10 (8)): `a` is reached by D-pad from a recorded way
   in (the source taken, then the press that found `a`), because a direct `BTakeFocus` leaves a group's own focus
   memory on whatever the sweep took last; then the same press and its opposite. Back on `a` (or no move at all
   there): the first result was the sweep's take order, listed under `takeOrder` with the user-path target
   (`userTo`), not counted. Otherwise, or when `a` has no way in to replay (the entry), it stays in `irreversible`
   with `recheck` (where the opposite press went the second time, or `not replayable`). Home's What's New
   -Left-> Recent (a direct take of Recent first) is such a case: on the D-pad path What's New -Left-> Apps and back.
5. B (unless `--no-b`): once at the end, B through `DispatchVirtualButtonClick(2)` from the entry focus;
   records whether the topmost layer closed or the route went back, then restores the route.

Output: `{route, entry, nodes: [{id, el, text, rect, route, key}], edges: {id: {up, down, left, right}}, routes,
universe, unreached: [...], notFocusable: [...], inner: [...], irreversible: [{from, dir, to, back, recheck,
userTo}], takeOrder: [...], untested: [...], exits: [...], retook, replayed, navs, b: {...}, pass}`. Budget
defaults: `--max 120` nodes, `--budget 150` s (the step then ends with `truncated: true`; each exit costs about
2–3 s to recover, so a large route such as `/library/tab/AllGames` with 350 posters needs a larger budget or a
`--start`). `--out FILE` (PC) also writes the JSON.

- **Universe.** The targets are the *leaf* focusables of the start route: elements with a Steam nav node that
  hold no other such element (a Settings row whose focus goes to its dropdown is a container, not a target),
  shown (not `display: none`, `visibility: hidden` or opacity < .05) but possibly scrolled out of view.
  `unreached` = universe minus the nodes reached; `pass` = nothing unreached, nothing irreversible, not truncated.
  A nav node Steam itself declares `focusable: false` (its Panel's `m_Properties`) can never take gamepad focus and
  is not a target (session 5): the tab row's scroll arrows `%{Arrows}` (laser-only, with an `onClick`; the gamepad
  pages tabs with the bumpers) were the only "unreached" items left on `/search/tab/All` and two of
  `/library/tab/AllGames`'s. Such leaves are listed under `notFocusable` (and in the summary), never counted; their
  function's gamepad path is the ledger's to show, and a theme patch that made a stock target non-focusable shows as
  a difference against the route's `--stock` run.
  A target must own its nav node (REQ C2a-R2->P10 (6)): the nearest fiber that carries a `node` is the element's
  own (`node.m_element === el`; `L.navNode` walks up to 12 fibers, so a plain `div role="button"` inside a focusable
  cell found the cell's node). Elements with only an ancestor's node, such as Home's card Play and More inside the
  focused cell, are laser targets inside a gamepad target: listed under `inner` (and in the summary), never counted;
  their gamepad path (X, the menu button) is the ledger's to show. The cell holding them is now a leaf itself.
- **Nodes that are not mounted** (a tab panel that follows focus, the other page of a paged grid) are reached again
  by replaying a recorded way in: up to three per node, those whose source is mounted now first (REQ C2a-R2->P10
  (7)). A node that cannot be taken is tried once more at the end of the queue, when later nodes may have given it
  another way in, and only then is `untakeable`. Home's paged grid: All Games repeats on every page under one key,
  so a page-1 cell found only from page 1 could not be replayed while page 2 was shown; on the second try it is
  reached from page 2 (its first cell -Left-> back onto page 1). A node that repeats on every page with one key
  (All Games) is measured on whichever page shows when it is taken.
- **Other routes.** A move that changes the route inside the start route's first segment (Steam Settings:
  selection follows focus) is an ordinary edge; the node remembers its route and is expanded only when it is
  also in the universe (the Settings sidebar), so the sweep walks every sidebar item but not every page.
  Edges are measured in each node's own route (the lab navigates there before taking focus).
- **Node identity** (`key`): the first readable class that is not a state class, the element's text (or its
  nearest labelled ancestor's, for toggles and sliders) and its column (x / 16). It survives re-renders and
  scrolling; `L.bfs.keyOf(el)` gives it for other tools.
- A reversibility check that would press Left/Right on a slider is listed under `untested`, not `irreversible`.
- B is pressed once at the end from the entry focus; `b.effect` is `closed a layer`, `route A -> B` (Steam's
  history back) or `nothing`. It does not enter `pass` (G-PAD's B rule is judged with a `--pre` that opens a layer).

### `python glass.py focus SURF [--route R] [--pre JS] --pairs FILE|JSON [--room auto|none|bright|dark|grey|black|R,G,B] [--json] [--keep]`

Live luma pairs (G-FOCUS, VP SHOT): each pair names two states and an element in each; one capture per distinct
state; luma (601 weights) averaged inside the element's rect × 1.5 inset by 6 shot px.

```json
[{"name": "P-14 focus vs rest", "min": 40,
  "a": {"state": "L.gpTake('main', '%{Poster}:nth-child(2)')", "sel": "%{Poster}:nth-child(2)"},
  "b": {"state": "L.gpTake('main', '%{Poster}:nth-child(3)')", "sel": "%{Poster}:nth-child(2)"}}]
```

`a.state` / `b.state` are JS run before that capture (same lock; equal strings share one capture, an empty or
missing state captures as is); `sel` (with `%{}` tokens, and an optional `@text=Label` suffix: the match whose
innerText is Label, else the first containing it) or `rect: [x0, y0, x1, y1]` (shot px) gives the region. Per side,
optional: `shape: "rect"|"pill"|"circle"` (default rect), `inset` (shot px, default 6), `band: [8, 16]` (CSS px,
× the surface's devicePixelRatio) to measure the band 8–16 px outside the rect instead (P-16). `min` defaults to 40.
Output per pair: `La, Lb, dL, pass`; overall `pass` when every pair passes (exit 0/1). `--settle S` (default 0.8 s)
waits after each state before the capture. The captures are deleted unless `--keep [NAME]`, which keeps them as
`shots/NAME_<n>.png` (default NAME `p2_focus`). The pointer is parked (§1) and the route restored at the end.

**Rooms** (session 5, REQ C2a-R2->P10 (3)): a live capture keeps the window's alpha, and the headset shows a
translucent texel over the room. Read as stored, a transparent texel is black: on a windowless route C2a's P-16 glow
band read +219.5 L where the same capture gives +7.6 over a bright room (the reviewer measured +8.9 at L 225).
`--room auto` (default): a pair whose regions hold translucent texels (alpha < .98 on more than 1 % of either) is
measured over P-14's **bright and dark test rooms** (AUD's uniform rooms, L 210 and L 24) and judged by the worse;
each pair prints `over bright …, dark … (translucent N %, judged: R)` and the JSON carries `rooms`, `room` and
`translucent`. An opaque pair (mockup renders, TL-2) is measured as stored, unchanged. `--room bright|dark|grey|black`
or `--room R,G,B`: that room only; `--room none`: as stored (the behaviour before session 5). The same option works
on `focus --png`.

`@text=` works in every lab selector (`L.q`, `L.qa`, `L.click`, `L.gpTake`, `L.hover`).

### `python glass.py motion SURF [--route R] --pre JS [--name ID_INTERACTION] [--at 0,.15,.35,.5,.75,1] [--json]` (or `--selftest MS`)

1. A warm-up capture brings the surface to the front, then the step records the animations already running (not
   part of the strip) and runs the pre. A surface the pre opens (`motion barpopup` with the "+" popup) is not shown
   before it, and a capture of a hidden window waits for a frame until the CDP timeout (REQ C2b-R2->P10): since
   session 5 its warm-up is taken right after the pre, with the animations already paused (`warm` in the JSON). The
   pre runs and, **in the same evaluation**, the step pauses every animation it started (`Animation.pause()`; `getAnimations()` flushes style, so the
   CSS animations and transitions the pre starts exist and are held at t = 0 before a frame runs). A `@hover` pre
   pauses right after the CDP hover. The pre must not await an animation's `finished`. (Until R1 this used CDP
   `Animation.setPlaybackRate 0`, which did not hold the clock: frames lagged their f by about 100 ms, R1 M1.)
2. Token audit (P-58) of every animation that is **ours** (keyframes defined in our stylesheets, or a transition on
   an element that one of our rules with a `transition` declaration matches, CSS nesting resolved): duration,
   easing and per-keyframe easings, through `__LGS_MOTION.isTokenDuration` / `isTokenEasing` when P5's library is
   loaded (else the D2 §11.2 table); infinite iterations fail. Steam's own animations are listed, not judged.
   `__LGS_MOTION.audit(doc)` is recorded as `motionLib`.
3. Filmstrip: for each f, pauses any animation started since, sets every one to f × (delay + active duration),
   **waits two `requestAnimationFrame`s** of the surface's window (so the compositor has drawn that state; the
   frame records `raf: false` if they did not come within 500 ms) and captures
   `shots/p2_motion_<name>_<f>.png` (f printed with `%g`: `_0`, `_0.15`, …, `_1`), plus
   `shots/p2_motion_<name>_strip.png`: the frames side by side, cropped to the animated region, labelled.
4. Geometry from each animated target's rect per frame (PC): P-53 (lateral travel > 24 px or a scale change > 1.5 %
   on a target wider than 600 main-window px, i.e. 600 × m on a surface with D2 §2.5's multiplier m: 498 bar px on
   the bar's popups; until session 5 the threshold was scaled by the surface's width, 141 px on the 300 px "+"
   popup, which judged the popup's materialize scale as a window scale change), P-54 (a start > 16 px from rest) for a target that **enters**. With `--media
   reduce`: P-56 (anything but opacity, or > 200 ms).
   **Entries** (session 5, REQ C2a-R2->P10 (4)): P-54 reads "nothing enters from the periphery: toasts, menus and
   sheets start ≤ 16 px from their rest position". Before the pre the step records every element that is shown
   (rendered, not hidden by `display`, `visibility` or opacity 0 on it or an ancestor, with a box that meets the
   viewport). An animated target that was not shown (a new node, a popup that was hidden, a panel waiting off-screen)
   enters, and P-54 judges it; one that was shown and travels (Home's segmented-control pill, 156 px) is a **move**:
   listed under `moves`, not P-54 (P-53 still judges travel on targets wider than 600 px). Each animation in the JSON
   says `entering: true|false` (`null` from an older lab, judged as an entry). Offline test:
   `python tools/p2/test_motion_page.py` (`tools/p2/fixtures/motion_page.html`: a pill that moves 156 px, a new menu
   sliding 120 px, a new toast 8 px, a hidden sheet shown with a 40 px slide, an off-screen drawer sliding in 300 px;
   only the pill is a move).
5. Plays the paused animations again (from the last f), waits `--rest` s (default 1), and checks nothing is left
   (P-52, §1.5).
6. Prints a summary (or the JSON with `--json`); exit 0 when the automatic part passes. G-MOTION's filmstrip
   verdicts (glass before content, no text scaling, no closed outline) are recorded by the agent who views the strip.

**Self-test** `python glass.py motion main --route /library/home --selftest 300` (and `1000`): the pre is a probe of
two 200 × 140 boxes, white over opaque black, one a WAAPI opacity 0 → 1 and one a CSS opacity transition, both
linear over MS ms; each frame's box luma / 255 must equal its f within ±0.05 for both boxes, else FAIL. The probe
is removed in the same lock.

### `python glass.py sgcheck [--route R] [--pre JS] [--settle S] [--json] [--out FILE]` (live; holds `lab.lock` and `lab-vr.lock`)

Builds the check model (§5) from the live system in one lock, after `--settle` s (default 1.5, springs at rest):
P6's report (`__LGS_LAYERS.snapshot()`: cover shapes, plates, layers with dz, `interactive`, `modal`, `material`,
`hole`), the DOM of every reported surface (visible focusables; forbidden boxes = every visible
`[data-lgs-nopop]` plus the selectors in `lab/sgcheck.json`; `video, [data-lgs-media]`; `[data-lgs-destructive]`)
and `__LGS_SG.dump()` in `vr:systemui`; then applies the rules on the PC. A pop's `shadow` is its slab
(`material` other than `"none"`) or a hole with a shadow; `media` / `destructive` = its crop meets such a box; a
layer with a `hole` sets `holes: true` (R3 waived, PLAN §1.7 rule 3). Scene-graph nodes marked interactive in the
default profile fail R8. Run it as a `native-session` step: without the reporter it prints
`BLOCKED: native layer off` (exit 3). `--out` writes the result with the raw live data.

### `python glass.py hv NAME [--offaxis DEG] [--rect x0,y0,x1,y1] [--full] [--look] [--route R] [--pre JS|"@hover SEL[,MS]"] [--surface S] [--settle S] [--grabs N] [--gap S]` (holds `lab-vr.lock`; both lab locks with `--route`/`--pre`/`--hover` or any Steam step option)

1. Builds `native/spike/hvgrab` on the Frame if missing (`g++`, the spike's own `build.sh`).
2. **Fresh frames** (REQ P7->P10): SteamVR refreshes `system.HeadsetView` only while someone samples it, so the
   first grab after a pause can show a picture minutes old (seen live in session 4: a lone grab showed another
   route without the step's dialog; with two grabs 0.5 s apart the frame showed the dialog and the current clock). Every `hv`
   grabs `--grabs N` times (default 2) `--gap S` apart (default 0.5), deletes each earlier frame on the Frame at
   once (never fetched) and measures the last one; the metrics JSON says `grabs`.
3. **A layer held open for the capture** (REQ C1c->P10): with `--route R` and/or `--pre JS` (or `"@hover SEL[,MS]"`
   on `--surface S`, default main; the step option `--hover` too) the step takes `lab.lock` then `lab-vr.lock`,
   navigates, runs the pre, waits `--settle` s (default 0.8; 1.5 in native mode, session 5), grabs, and only then
   gives the usual restore at the lock exit (menus, dialogs and popups the step opened closed, pointer to
   (1400, 900)). Steam step options (`--flags`, `--mode`, `--media`, `--stock`) apply to it, and **any of them alone
   also makes `hv` such a Steam step** (session 5): `python glass.py hv NAME --mode laser` is a laser look (P6
   reports the laser-only frame menu and P7 builds its copy only in laser mode). Until session 5 a plain `hv` held
   only `lab-vr.lock`, where Steam's options are not applied, so its `--mode` was silently dropped. The metrics JSON
   says `layer: true`, `mode` and `native`. Example (C1c's G-HV with a dialog up): `python glass.py hv c1c_alert
   --pre "<CONFIRM snippet>" --look`. Without a route, pre, hover or step option `hv` holds only `lab-vr.lock`, as
   before.
4. Captures `system.HeadsetView` to `/tmp/lgs/hv-<pid>-<n>.png` and announces it (`@@hv`); `glass.py` fetches it
   **as the line streams** (also inside a `native-session`, while later steps run), deletes the Frame copy at
   once, and deletes any announced frame it could not handle. A detached `sleep 90; rm -f` on the Frame and the
   purge at every lock entry (frames older than 60 s) cover a `glass.py` that died (R1 M5).
5. Metrics (`tools/p2/hv_metrics.py`): glass luma inside the window rect (auto-detected, or `--rect` in frame
   px) and outside it; the top-edge profile ratio; a doubling score (normalised cross-correlation of the window's
   top band against itself shifted horizontally by 4–40 px; > 0.6 at a shift means a doubled edge).
6. Deletes the local copy (TL-5: no PNG left on either machine). `--full` captures at full resolution (scale 1;
   default 2). The doubling score is the highest local maximum of the correlation at a shift ≥ 6 px (text repeats
   its strokes at the smallest shifts). Inside `native-session`, an `hv` step honours its own `--look`, `--rect`,
   `--full`. `--look` instead moves it to **its own** folder `%TEMP%/lgs-hv-look-<pid>-<n>/`, prints the path for
   the agent to view, and a detached timer deletes it after 120 s (any `glass.py` command also deletes look
   folders older than 120 s, and `python glass.py hv --clean` deletes all of them at once). Never copy it
   elsewhere (LAB never-list). Until R1 the shared `%TEMP%/lgs-hv/` was emptied by every agent's next command.
   **Exit codes:** 0 G-HV pass, 1 fail, **3 when the verdict is withheld** (no `--rect`: the auto rect is a hint;
   `BLOCKED: G-HV verdict withheld`, R1 m4).
7. `--offaxis DEG` turns Steam's window by DEG degrees (−60..60) about its vertical axis with P7's lab hook
   `__LGS_SG.test.yaw(DEG, 15000)` in `vr:systemui` for the capture, and `yaw(0)` right after (the hook also
   restores itself after its TTL and on the watchdog). It works wherever `lgs_sg.js` is installed: native mode
   (use it as a `native-session` step) and CSS-only mode while a scene-graph override is active. Without the hook
   it prints `BLOCKED: no off-axis hook in vr:systemui (...)` (exit 3).

### `python glass.py native-session [--pre JS] [--settle S] [--step "CMD ARGS"]... [-- CMD ARGS]`

Holds `/tmp/lgs/native.lock` (waits up to 30 min), turns the native layer on
(`lgs_shell.py start --native --stay` after the theme is on), waits until `/dev/shm/lgs/shell.json` reports the
native layer enabled and glassd healthy (60 s; else exit 3 with the daemon's reason), runs the pre in
SharedJSContext, then each step in order, then **always** returns to CSS only (`lgs on --css`) and waits until
the native layer is off.

- A step is any lab command line, quoted (`--step "shot main p2_c2a_home_native --route /library/home"`), or
  one command after `--`. Steps take their own `lab.lock` as usual; step options (§1) work inside them, the
  session's own options first and each step's on top. This includes `hv` steps since session 5 (P7's recheck,
  12:46: an `hv` step's own `--mode laser` was dropped, because the session called the grab without parsing the
  step's options; only `native-session --mode laser` reached it). Looks taken before that with a per-step `--mode`
  were in the session's mode (pad by default), without the laser-only frame menu.
- Files a step produces (`shot`, `motion`, `focus --keep`) are fetched to `shots/` like the plain commands, as the
  step announces them (the output streams).
- `hv`, `sgcheck` and `conformance --route R` are valid steps; the PC finishes each measuring step's result
  (`gates`, `pad-bfs`, `focus`, `motion`, `sgcheck`, `conformance` with the depth items P-11, P-46, P-47, P-48,
  P-51, R1 m5). Exit code: 1 if any step failed, else 3 if any was blocked, else 0.
- The lab locks are released between steps, so other agents' CSS-tier steps run while native mode is on; every
  result says `native: on|off` (§1). The session deletes its own unfetched `hv` frames in its `finally`.

### `python glass.py conformance [--route R]... [--only P-01,P-14] [--pad] [--json] [--out FILE]` (+ step options)

Reads the 89 P-items from VP §6 (id, requirement, severity, verify code) and runs, per route (default
`/library/home`, `/library/tab/AllGames`, `/library/downloads`, `/settings/system`, `/media/grid`: PLAN §4.2 rows
that need no pre and show no personal names), one locked step that gathers the gate sweeps (SIZE, TYPE, OUTLINE
DOM part, MOTION at rest and our CSS durations), the AUD diff (theme off vs on; skipped with `--stock`), the DOM and
CSS checks of `lab/lab_conf.js` and, inside a native session, the depth model. `--pad` also runs `pad-bfs` per route
(slow). One line per item: `P-38 PASS|FAIL|MANUAL|BLOCKED|N/A [must|should] <detail>`; exit 1 when a "must" item
fails. `--out` writes the JSON (V2 points it at `docs/phase2/verify/`). **A route that gives no result** (lab lock
busy, CDP error, device unreachable) makes every automated item BLOCKED for it (`missingRoutes` in the JSON, a
`BLOCKED:` line) and the command **exits 3** unless a must item FAILs elsewhere (exit 1): no data never reads as
a pass (R1 M3). The depth items need a native session: `glass.py native-session --step "conformance --route R"`.

| Automated | From |
|---|---|
| P-08, P-80, P-83 | G-SIZE rules (P-08 also AUD SHRUNK) |
| P-38, P-84 | G-TYPE (18 px floor, body ≥ 22 px, weight; uppercase/tracking/italic) |
| P-39 | AUD CONTRAST |
| P-42, P-43 | G-OUTLINE DOM part, elements and their `::before`/`::after` (edge profiles: `gates`) |
| P-52, P-58 | at rest after the route settles; non-token durations in our CSS (interactions: `motion`) |
| P-13 | exactly one `.gpfocus` with a nav node (`--mode pad`; else BLOCKED) |
| P-17, P-31, P-33, P-40, P-45, P-72, P-81, P-82, P-85, P-86, P-87 | DOM predicates of the VP rows |
| P-01, P-02, P-89 | CSS: our rules (nesting resolved). P-01: every `.gpfocus` selector carries an input-mode scope; P-02: laser-scoped `.gpfocus` selectors without `:hover` (candidates: a reset rule is fine, review them); P-89: `:hover` reveals (opacity/visibility/display) without a `.gpfocus` twin after dropping mode scopes (heuristic) |
| P-11, P-46, P-47, P-48, P-51 | depth model rules R8, R7, R5, R9, R6 (native session; else BLOCKED, as are P-34, P-49, P-50) |
| P-20, P-22, P-23 | `--pad`: pad-bfs pass; entry focus not Back, the search field or the tab bar; focused rects inside y 124 to the route's bottom bound (PLAN R2-11, REQ Coordinator->P10 (2)): **612** when the route has a bottom ornament (a rendered `#Footer` legend), else the glass bottom − 16 (640 on `window`, 704 on `window-full` and `windowless`); the conformance step records the route's `layout` ({ornament, legends, glassBottom}); without it (an older lab) 612. VP's 620 is read as 612. The stock baseline `conformance_stock.json` (06:08) ran without `--pad`, so its P-20/22/23 are BLOCKED and the new bound changes nothing in it |

Everything else is MANUAL with its verify code (REV, MOCK, FILM, HV, SHOT pairs: use `focus`, `motion`, `hv`,
`cmp`).

### `python glass.py perf SURF [--route R] [--pre JS] [--seconds S] --ab stock|theme [--rounds N]` (G-PERF, RT-7; holds `lab.lock`)

R2-13's statistic for performance verdicts on the shared device (REQ Coordinator->P10 (3)). Without `--ab`, `perf`
is the Phase 1 command (one theme-off run, one theme-on run). With it:

1. Each round is ABBA × 2: reference, subject, subject, reference, twice (8 runs of `L.perf(SURF, S × 1000)`,
   default 3 s, the surface brought to the front first). `--ab stock`: reference = the theme off (stock), subject =
   the theme on (G-PERF). `--ab theme`: reference = the theme only (`lgs on` with the runtime off), subject = the
   theme with the runtime (RT-7). Step options (`--flags`, `--mode`) apply to the subject runs as usual: each
   `lgs on` starts a new runtime, which reads the step's flags file but not its in-memory flag overlay, input-mode
   stub or action logger, so the step puts these back into every subject run's runtime (session 5; before, a
   subject run after the first toggle ran without `--mode`). Each subject run records them as `reapplied`.
2. Every run prints `fps`, long frames (> 34 ms), p95 and `native`. The verdict pools only runs with `native=off`
   (a CSS-only verdict): **PASS** when the median fps ratio subject / reference ≥ 0.95 and the median extra long
   frames (subject − reference) ≤ the reference's A/A spread (max − min of its long frames, min 1). While it fails,
   another round is pooled, up to `--rounds` (default 2).
3. It does not start while a native session is on (`BLOCKED`, exit 3): toggling the theme would also make that
   session's daemon dormant, and those runs could not be pooled. Fewer than 2 pooled runs a side: BLOCKED.
4. The theme is given back as found (on with the default runtime, or off). The last line is `@@perfab {JSON}` with
   every run and the verdict. Exit 0 PASS, 1 FAIL, 3 BLOCKED.

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
| R1 covered | each pop rect, deflated by 2 px (P6's tolerance, reporter §4 rule 1), lies inside the union of covers and plates (rounded rects, sampled on a 4 px grid). Only points inside the pop's **own rounded rect** are sampled (its `r` from the report, deflated with it, or `capsule`): a rounded crop never draws its corners, so a rounded pop over a plate of its own shape is covered (REQ C2a->P10 #16; fixtures `sg_roundpop*.json`) |
| R1b forbidden | no pop intersects a `forbidden` rect (bottom ornament, store ornament, tab bar, window-bar row, `/invites` header) |
| R2 click-safe | `dz ≤ 0.000521 × s`, s = the shorter side (CSS px) of the smallest focusable intersecting the pop; and dz is one of {0, 10, 15, 25} mm ± 0.5 mm |
| R3 media | no pop with `media: true` (unless the model says `holes: true`) |
| R4 destructive | no pop with `destructive: true` |
| R5 container | each pop ≥ 60 × 60 CSS px (a pop with `r: "capsule"`: ≥ 44 tall and ≥ 60 wide, P6 rule 5) |
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

Only PLAN §1.16 lists exemptions (§1 decides; the coordinator adds rows). Every id in `exemptions.json`, and every
`labels` line named in its `_scope`, is a §1.16 row, or it is listed in `_pending` (below); `test_gates_page.py`
case 0 checks this against PLAN.md.

Each exemption is checked against its own criterion and reported as `exempt: [{el, id, rect, pass, why}]`; one
that fails its criterion fails G-SIZE:

| Id | Check (live) |
|---|---|
| E-MENU | PLAN §1.16 [R2-5] (REQ Coordinator->P10 (1)). **Rows:** visible fill ≥ 60 (the element less a clear border: C1c's rows inset their fill with a 2 px transparent border and `background-clip: padding-box`), ≥ 320 wide in one column and ≥ 280 in the two-column grid (rows at two distinct x in the slab, or C1c's `.lgs-menu-grid`), pitch to the next row below in the same column ≥ 64 when the rows touch (compact, gap ≤ 2) or ≥ 78 (regular); the last row has none. **Steam's appended Cancel** (the last item of a top-level menu's first slab, as `22-presentations.css` selects it), its own line instead of P-08 and the row clauses: visible fill 60 tall and equal to its element (no clear border), ≥ 192 wide, ≥ 4 px clear of the visible fill of the row above, inside the slab, `elementFromPoint` at its centre hits it |
| E-TAB | PLAN §1.16's pitch ≥ 52 frame-menu px on any surface (52 × m / 0.9: 52 on `frame.menu`, 48 on `barpopup`) along the bar, abutting the next item (gap ≤ 2); across it the visible item ≥ 60 × m (P-80: 50 bar px). The axis is the one the next item follows on: a column (the frame menu's tab bar) or a row (Quick Access's five tabs, REQ C3b->P10) |
| E-GRID | PLAN §1.16 [R2-15]. **AUD only** (`_scope`: SHRUNK waived; SIZE, TYPE and OUTLINE judge the cells as usual; GONE, HIDDEN, UNCLICKABLE and CONTRAST never waived), on the cell itself. Each cell ≥ 80 × m by 96 × m (67 × 80 bar px), abutting its row and column neighbours (gap ≤ 2), and its own whole hit (≥ 95 % own, 0 % another target over the cell) (REQ C2b->P10, the "+" launcher's 72 × 96 cells) |
| E-GRID (labels) | PLAN §1.16 [R2-15], AUD's SHRUNK only, for a text run inside an E-GRID cell (`_scope` `labels`), from the themed snapshot and the stock run: (1) the run's box lies inside its cell (± 1); for the attended cell (`.gpfocus` or `:hover`), whose run shows the whole name as the plate, inside the popup's width instead; (2) it shows ≤ 2 line boxes (its text's line rects inside what is left visible); (3) no glyph is cut: wherever the run's text overflows its own box (`scrollWidth`/`scrollHeight`) or a clipping ancestor up to the cell by > 1 px, that box draws the ellipsis (`text-overflow: ellipsis` with overflow clipped, across; `-webkit-line-clamp` ≤ 2 on a vertical `-webkit-box`, down; the text is cut box by box, inside out), and the run breaks lines only between words or after "/" (`word-break` and `overflow-wrap` `normal`, `hyphens` not `auto`); (4) the full name stays in the DOM: the run's `textContent` equals the stock run's, or the cell's `aria-label` does (where T3 draws its own shortened string). Waived entries say `waived: SHRUNK` with the four clauses; otherwise the SHRUNK stays with "(E-GRID (labels) not met: …)" |
| E-SWITCH | hit ≥ 95 % own over 86 × 80 around its centre, no other target |
| E-CHECK | hit ≥ 95 % own over 80 × 80 |
| E-MINI | hit ≥ 95 % own over 80 × 80; another target only if it is the field it clears |
| E-SEG | ≥ 60 × 140, or ≥ 60 × 120 for a compact segment (its label under 22 px: CTL §8.3's regular label is 22 px), and contiguous with the next segment (gap ≤ 2) (PLAN §1.16, CTL §8.3 / §18.1; REQ Coordinator->P10 R2-15 (4), session 5: until then every segment passed at 120) |
| E-BAR | ≥ 64 × 72 bar px |
| E-BACK | `aria-label` set and the centre hits it |
| E-KEY | PLAN §1.16 "Steam's geometry, identical to stock": scoped to SIZE, TYPE and OUTLINE (`_scope`, session 5), so **AUD still judges the keys** against stock (GONE, HIDDEN, SHRUNK, UNCLICKABLE, CONTRAST): the criterion is a comparison with stock, which is what AUD makes. Lists the visible key `%{*KeyboardKey}` and its focusable parent `%{KeyboardKeyHitArea}`, which SIZE judges (REQ C4b->P10); also through C4b's `data-lgs-exempt="E-KEY"` on the key grid. In SIZE `pass: null` |
| E-WEB, E-ROW58, E-DRILL | none here (judged by their owners' tests); `pass: null` |

`lab/exemptions.json` today: E-WEB, E-KEY (scoped), E-TAB (frame-menu items; Quick Access's tabs
`%{QuickAccessMenu} %{PopupBody>Tab}`), E-MENU (context-menu items), E-SWITCH, E-CHECK, E-SEG, E-MINI (Steam's
primitives and the `.lgs-*` controls), E-GRID with its `labels` line (the "+" launcher cells
`%{DashboardBarPopupList}:has(> %{DashboardBarPopupListHeader}) %{DashboardBarPopupListItem}`), `_pending` empty.

**Scope** (session 4): `"_scope": {"E-GRID": {"sweeps": ["aud"], "aud": ["SHRUNK"], "labels": "E-GRID (labels)"},
"E-KEY": {"sweeps": ["size", "type", "outline"]}}` limits an exemption to some sweeps (`size`, `type`, `outline`,
`aud`) and, in AUD, to some issue kinds, which it waives on the element its criterion judges (the cell), not on
what that element holds; `labels` names the §1.16 line that judges the text runs inside it (session 5). Outside its
scope the element is judged as usual. An exemption without a `_scope` entry applies to every sweep and every AUD kind
(as before).

**Pending** (session 5): `"_pending": {"E-X": "why"}` lists ids that PLAN §1.16 does not have yet. The sweeps check
and report a pending exemption's criterion (`pending` in its `exempt` entry, `waived: null`) and waive nothing: the
issue stays, with "(E-X pending: …; its criterion is met / not met: …)". P10 drops an id from `_pending` once
§1.16 lists it (case 0 fails while a pending id is in PLAN). E-GRID was pending in session 5 until the coordinator
added it (R2-15, 13:10); `_pending` is empty today.

**Offline test** of the sweeps: `python tools/p2/test_gates_page.py` runs `tools/p2/fixtures/gates_page.html` in a
local headless Chrome or Edge (1280 × 720, a fresh temporary profile), after case 0 (`exemptions.json` against PLAN
§1.16): obscured with and without scroll room, the visible-rect P-08 box (a control cut by the window; a tall
control cut by its scroller, sampled on its visible part), a partly visible control that cannot scroll clear
(judged in place), E-TAB on a row, E-GRID's AUD waiver (met, not met, GONE kept, pending), the pill's hosted
glyphs, E-MENU rows (column, grid, too narrow) and Cancel (passing, and a 56 px fill inside a clear border
failing), panes versus a leaf target in AUD, text runs judged as text (a narrower box with the whole string and
larger type waived; an ellipsis, smaller type and a cut block ≥ 300 × 300 kept), E-GRID (labels) (an ellipsized
label waived; a label cut without an ellipsis, a three-line label, a T3-shortened label without the cell's
`aria-label` and a plate outside a resting cell kept; with the `aria-label`, the attended cell's plate inside the
popup and a short label waived; a single long word cut by a line-clamped box kept, REQ C2b-R2->P10), E-KEY's scope
(SIZE exempt, AUD still SHRUNK), E-SEG's 140 / 120 widths and AUD's re-match across a DOM move (rows wrapped and
sorted matched by text, the list box by its class, a path collision not compared; a repeated or renamed identity
stays GONE) (38 cases, plus case 0).

## 7. New lab helpers (`L`, in SharedJSContext)

| Helper | What |
|---|---|
| `L.gpTake(surface, sel)` | Give gamepad focus to the element (`node.BTakeFocus(3)` through its fiber). Returns `L.focused()` |
| `L.root()` | `FocusApplicationRoot()` then Down + Up, so gamepad focus exists (SR §4) |
| `L.hover(surface, sel, ms)` | Synthetic laser hover (pointerover/enter/move at the centre) for `ms`, then leaves it; `L.unhover()` sends its leave and move events at (1400, 900) CSS px, outside the viewport (the park point, §1; until session 5 (933, 600)) |
| `L.surfaceName(alias)` | The Steam popup name an alias resolves to: the shown window among several (`barpopup`), else the first (session 5) |
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
| `check-theme` | **live** (P1's `lgs.check` merged once it exists; P4's hook-list warning since session 4) | 2026-10-07 |
| `edge` | **live** | 2026-10-07 |
| `native-session` | **live** | 2026-10-07 |
| `gates` | **live** (`--theme off` for stock baselines: AUD skipped, theme given back at the end) | 2026-10-07 |
| `pad-bfs` | **live** (`--out FILE` saves the JSON) | 2026-10-07 |
| `focus` | **live** (both forms; `--room` since session 5) | 2026-10-07 |
| `hv` | **live** (with `--offaxis`, P7's `test.yaw`; streamed fetch, exit 3 when the verdict is withheld; since session 4 two grabs per frame and `--route`/`--pre` layers; since session 5 step options in `native-session` steps) | 2026-10-07 |
| `sgcheck` | **live** (both forms; live as a `native-session` step) | 2026-10-07 |
| `motion` | **live** (pause + seek + two rAFs since R1; `--selftest MS`; P-54 entries only since session 5) | 2026-10-07 |
| `cmp` | **live** (multi-mockup cmp.json, per-element surface/origin/scale) | 2026-10-07 |
| `ledger` | **live** | 2026-10-07 |
| `perf --ab` | **live** (R2-13's ABBA verdict; session 4) | 2026-10-07 |
| `conformance` | **live** (30 items automated on CSS-only routes, 5 more as a `native-session` step, `--pad` adds 3; exit 3 when a route gives no result) | 2026-10-07 |

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
- 2026-10-07 (session 2): `pad-bfs` live (TL-3: same 45-element set as SET's `settings-pad.js` on
  `/settings/system`, `tools/p2/tl3_settings_pad.py`). `glass.py sync lab` (or any of `device theme lab native`)
  uploads only those subtrees; plain `sync` is unchanged.
- 2026-10-07 (session 2): live `focus` and `motion`; step option `--stock` (stock UI for the step); `@text=Label`
  selector suffix in every lab selector. `edge` now defaults to the 601 luma, as `window-nav-measure.py` rev 3 does
  (`--luma 709` for WN §8.2's revision 2 table). G-MOTION (`gates`, `motion`) judges only our animations: Steam's
  own transitions (for example `%{ScaledChildren}`'s route transform) are no longer counted as non-token.
- 2026-10-07 (session 2): `sgcheck` live (offline `--spec MODEL` and live inside `native-session`); R1 uses P6's 2 px
  tolerance (deflate), R5 accepts P6's capsule size. `native-session` now finishes every measuring step on the PC
  (gates, pad-bfs, focus, motion, sgcheck print their usual summaries; exit 1 when one fails). `focus` steps inside a
  session take `--pairs` as inline JSON.
- 2026-10-07 (session 2): `cmp` live. `<PKG>-cmp.json` may hold several mockups (`{"mockups": {...}}`, REQ C1b->P10,
  C1c->P10) and per-entry or per-element `mockScale` / `mockOrigin` / `surface` (REQ C3a->P10); deltas are in
  surface CSS px; the default origin is the mockup's `.lgk-overlay`.
- 2026-10-07 (session 2): `ledger` live (§3: audit-id rules, own ids, status from evidence lines).
- 2026-10-07 (session 2): `conformance` live (§4 table of automated items).
- 2026-10-07 (session 2): `hv --offaxis DEG` live (P7's `__LGS_SG.test.yaw`). `pad-bfs` node identity is now class + label (aria-label, aria-labelledby, then text) + rank among equals in document order (no x: shelves scroll), and a node that is not mounted any more (a tab panel that follows focus) is reached again by replaying the edge that found it; `--out` files hash element texts (`--raw` keeps them). `native-session` holds both lab locks while it turns the native layer on and off, and its own step options apply to every step.
- 2026-10-07 (session 2, 06:35): answered REQs from C1a, C1c, C2a, C4a, P1, P2, P5, P9: step option `--hover` (real
  CDP hover; `@hover` pre and focus states); gate scope rules (modal, clip, obscured, list rows, content cards, black
  tints, `--lgs-edge`, invisible edges, our animations only, scroll-driven); exemption criteria checked live and six
  exemptions added; `--stock-route`; `hv --full`, local-maximum doubling; `glass.py selftest` (P1's passthrough);
  the lock exit also resets the runtime's session flags to the restored file (`__LGS_RT.flags.setSession`).
- 2026-10-07 (session 3, review R1): **behaviour changes**, all from `wp/P10-review-R1.md`:
  - `motion` freezes by pausing the animations the pre started (in the same evaluation) and waits two
    `requestAnimationFrame`s before each capture; strips taken before this lag their f by about 100 ms and should
    be re-run. `motion --selftest MS` checks the luma ramp of a two-box probe (M1).
  - `gates` OUTLINE (and `conformance` P-42/P-43) checks `::before`/`::after`, counts hard 1–2 px shadow lines and
    closed rims, probes all four sides of each glass box, and measures exactly the capture its result names: some
    routes that passed now fail on Phase 1 rims (`--lgs-glass-rim`) and selection rings (M2, m3).
  - `gates` TYPE fails body text under 22 px (P-38, m6); SIZE skips P-08 sampling on partly visible controls (REQ
    C2a->P10 #9).
  - `conformance` exits 3 with BLOCKED items when a route gives no result (M3); `conformance` is a valid
    `native-session` step and gives the depth items (m5).
  - `ledger` status resolves test ids in their namespace and needs an evidence-table row in that log; new last CSV
    column `evidence` (M6).
  - Locks are exception-safe (M4); the flags file has its own `flags.lock` and restores only the step's keys (m1);
    results and the `step:` line carry `native: on|off` (m2).
  - `hv` frames are fetched as the output streams, reaped on the Frame after 90 s and purged at every lock entry
    (M5); `hv --look` keeps the frame in its own folder for 120 s; a withheld verdict exits 3 (m4).
  - `pad-bfs --pre` accepts `@hover` and the `--hover` option (m8); `glass.py --help` lists the Phase 2 commands;
    lab captures go to `/tmp/lgs/shots/` (m9). The lab helpers take the class index at call time through P1's
    `lgsIndexShared()` and splice their webpack probe records (REQ C1a->P10, P1->P10).
  - SIZE skips controls covered by a visible `[data-lgs-transient]` (REQ C2a->P10 #12); every sweep resolves
    clipping ancestors' `clip-path: inset()` (C1a's glass cut).
  - `native-session` no longer runs `lgs on --css` without the lab locks when it never turned native mode on
    (its setup could not get the locks): nothing to undo then.
- 2026-10-07 (session 4, REQ batch 2): **behaviour changes** for other packages:
  - `gates` SIZE: **obscured** also covers a control with ≥ 25 % of its hit box under chrome or the fixed clip, and
    a control is skipped as obscured only when its scrollers have the room to bring the whole box clear; one that
    cannot be scrolled clear is now judged in place (REQ C4a->P10 refinement; §4 sweep scope). The P-08 box is
    centred on the control's visible rect (REQ C2a->P10 #13). Panels Steam marks `focusable: false` without a
    handler of their own are part of their host's target (REQ C3a->P10: the Quick Access pill is judged whole).
  - Exemptions: E-TAB's criterion follows PLAN §1.16's pitch on any surface and covers rows (Quick Access's tabs,
    REQ C3b->P10); new E-GRID, AUD-only (SHRUNK) for the "+" launcher cells (REQ C2b->P10); `_scope` in
    `exemptions.json` (§6). Offline test `tools/p2/test_gates_page.py`.
  - `sgcheck` R1 samples only points inside the pop's own rounded rect (REQ C2a->P10 #16).
  - `gates` OUTLINE measures a side on the capture edge from one texel inside (`captureEdge`; REQ C3b->P10 (2)).
  - `hv` grabs twice 0.5 s apart and measures the second frame (REQ P7->P10); `hv --route/--pre/--settle` holds a
    lab layer open for the capture under both lab locks (REQ C1c->P10).
  - `check-theme` warns (never fails) when P4's hook host lists are stale (REQ P4->P10).
  - Every lab command on the Frame runs `python3 -B` with `PYTHONDONTWRITEBYTECODE=1`, and `lab/lab.py` sets
    `sys.dont_write_bytecode` before its imports: no `__pycache__` under the install (REQ P8->P10).
  - `pad-bfs` brings focus back after an `exit:` edge (opposite direction, root, main's nav tree) and lists every
    exit under `exits`; main counts as focused only while its nav tree is Steam's active one (REQ C1b->P10 #10,
    C2a->P10 #14).
  - E-MENU follows PLAN §1.16 [R2-5]: rows ≥ 280 wide in the two-column grid, ≥ 320 in one column, pitch 64
    compact / 78 regular, visible fill ≥ 60; Steam's appended Cancel is judged by its own line (REQ
    Coordinator->P10 (1)). E-KEY also lists `%{KeyboardKeyHitArea}` (REQ C4b->P10). AUD lists a pane that stays
    ≥ 300 × 300 (a focusable Panel holding controls or without a handler of its own, or a text box) as
    `container-pane`, not SHRUNK (REQ C7->P10).
  - `conformance` P-23's bottom bound is 612 with a bottom ornament, else the glass bottom − 16 (PLAN R2-11, REQ
    Coordinator->P10 (2)); the conformance step records the route's `layout`.
  - New `perf SURF --ab stock|theme [--rounds N]`: R2-13's ABBA verdict (REQ Coordinator->P10 (3)).
- 2026-10-07 (session 5, REQ batch 3): **behaviour changes** for other packages:
  - `hv` inside `native-session` applies its own step options (`--mode`, `--flags`, `--media`, `--stock`; P7's
    recheck: an `hv` step's `--mode laser` was dropped, so laser-only surfaces such as the frame menu were missing
    from those looks), and any Steam step option makes `hv` a Steam step (both lab locks); the settle is 1.5 s in
    native mode; the metrics JSON says `mode` and `native` (§4 `hv`, `native-session`).
  - The pointer is parked at (1400, 900) CSS px, **outside** the viewport, at every lock exit after a hover and by
    `L.unhover()` (was (933, 600) on main, on Home's All Games disc; REQ C2a-R2->P10 (2)) (§1).
  - An alias with several windows (`barpopup`) names the shown one, in the JS helpers and for CDP alike (REQ
    C2b-R2->P10) (§4); `motion` takes its warm-up capture after the pre when the pre opens the surface.
  - `gates` AUD: E-GRID waives only on the cell; a label run in a cell has its own line, E-GRID (labels) [R2-15],
    which also treats a single word cut by a line-clamped box as a cut (REQ C2b-R2->P10); text runs are judged as
    text (`text-whole`; a cut or smaller string stays SHRUNK, a text box is no longer a pane; REQ C7->P10);
    records the theme moved in the DOM are re-matched by a unique identity (`rematched`; C2b's T3); a popup the theme
    switch closed gets the pre again (`preRerun`) and an empty snapshot is `VACUOUS` (a FAIL; `conformance` P-39
    BLOCKED); E-KEY is scoped to SIZE, TYPE and OUTLINE, so AUD judges the keys against stock (REQ C4b->P10);
    `_pending` exemptions are reported, never waived (§6).
  - `gates` SIZE: the obscured test uses the box on the visible rect and finds where along each axis the box could
    be clear (a box wholly in the ornament band can now be scrolled clear); a partly visible control in a scroller
    that cannot bring it clear is sampled where it is (REQ C2a->P10 #13). E-SEG needs ≥ 140 wide (120 for a compact
    segment, label under 22 px) [R2-15 (4)].
  - `gates` OUTLINE: under `prefers-contrast: more` the edge profiles are measured and listed, not judged (P-42;
    REQ C2a-R2->P10 (5)).
  - `focus --room` (default `auto`): pairs whose regions hold translucent texels are measured over the bright and
    dark test rooms and judged by the worse (was: read over black; REQ C2a-R2->P10 (3)) (§3, §4).
  - `motion` P-54 judges entries only; a target shown before the interaction that travels is listed under `moves`
    (REQ C2a-R2->P10 (4)); offline test `tools/p2/test_motion_page.py`. P-53's 600 px are 600 × m on the surface.
  - Result stamps (`build`, `date`, `native`) are taken once the step holds its lock; `gates` notes when AUD's
    CONTRAST ran with the native layer on (glassd's backing is not in the CSS contrast model).
  - `pad-bfs` recovers after an exit through main's nav tree, the root, Steam's `EnsureVROverlayVisible()` and, last,
    `Navigate(route, replace)`, each held 150 ms; a take that does not land activates main's tree and takes once more
    (`retook`); untakeable nodes are listed; Steam's `focusable: false` nav nodes are `notFocusable`, not unreached
    (REQ C1b->P10 #10, C2a->P10 #14, C2a-R2->P10 (1)) (§4).
  - `perf --ab`: the subject runs get the step's flag overlay, input-mode stub and action logger again after each
    `lgs on` (`reapplied`).
  - `pad-bfs` (REQ C2a-R2->P10 (6)-(8)): a target must own its nav node (others are `inner`, not counted); a node
    that is not mounted is replayed from any of up to three recorded ways in and is retried once at the end of the
    queue before it is `untakeable`; a failed reversibility check is measured again with the source reached by
    D-pad, and a pure take-order result goes to `takeOrder` (not counted) (§4 `pad-bfs`).
  - Flags a killed step left in the flags file are put back at the next lock entry (`/tmp/lgs/flag-steps`, §1.1
    item 4); SteamVR pages a `--theme off` step stripped are themed again at its lock exit (REQ P8->P10).
