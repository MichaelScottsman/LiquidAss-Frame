# Contract: scene graph (P7, `device/lgs_sg.js`, `theme/sg/*.json`)

Owner: **P7** (`device/lgs_sg.js`, `theme/sg/00-base.json`, `native/spike/**` except `fakeglassd.cpp` and `hvgrab.cpp`). Readers: **P8** (installs `lgs_sg.js` in `vr:systemui`, builds the spec, sends overrides), **P6** (reports the fields P8 passes through), **C1a** (`theme/sg/20-winbar.json`, tab-bar depth), **C3b** (CC-A window dim), **C1c** (sheet recede, S7), **P10** (`sgcheck`, `hv`), **V1** (native gate).

Status per row: **live** = in `device/lgs_sg.js` in the tree and tested on the Frame; **built** = in the tree, tested offline only; **planned** = specified, not built. P7's evidence log (`docs/phase2/wp/P7.md`) has the tests.

Everything is **backward compatible**: a Phase 1 spec (no new fields) builds exactly the nodes it built before, and an older `lgs_sg.js` ignores the new fields. Feature-detect with `__LGS_SG.caps` (an array of strings, §2) before relying on a field.

---

## 0. Units and planes

- **Rects** `x, y, w, h`, `clip` in **Steam texture px** of the surface (CSS px × 1.5), origin top-left, y down. Unchanged.
- **Depths** (`dz`, `coverDz`, `baseDz`, `from`, `recede`, override `add`) in **scene units** of the parent panel, toward the viewer. One unit is S × r metres (SP §1.1; S = 0.369, r = the user's window resize, 1 by default). Converting: `units = mm / (369 × r)`, so +10 mm = 0.0271, +15 mm = 0.0407, +25 mm = 0.0678 at r = 1. `lgs_sg.js` reads S and r live (`geom()`, §2); override rules may give millimetres (`addMm`) and are converted with the live values.
- **Planes, back to front** (the ordering rule, card item 5). For each surface:

| Item | z (units) | Notes |
|---|---|---|
| Steam's real panel | 0 | Hidden under the cover where the cover is opaque; still the laser and gamepad target |
| **cover** (glassd's backdrop region: the cover shapes **and every plate**, P9 §1.3) | `coverDz` (default 0.001) | Must equal glassd's `coverDz` for that surface (P9 §1.2). May be negative (K-G6 keyboard platter, −0.027) |
| **base** mosaic (Steam's texture minus the popped rects) | `baseDz` (default 0.002) | Pieces overlap their neighbours by 1 px against seams |
| **slab** of a pop | `max(zPop − 0.0008, coverDz + 0.0003)` | Always in front of the cover, always behind its crop |
| **pop** (crop of Steam's texture) | `max(dz(t), baseDz)` | `dz(t)` is the depth channel's current value (§3); the base plane is the floor, so a pop that rises "from 0" starts level with the base |

Plates have **no scene-graph nodes of their own**: glassd draws them inside the cover's texture region (P9 §1.3), so they sit at `coverDz` with the cover. Occluder plates are a glassd material variant, not a separate layer. If P9 ever publishes plates as separate atlas cells, they will be added here as `surfaces[].plates` at `coverDz + 0.0001` (planned only on request).

---

## 1. Installation (P8)

`lgs_sg.js` is evaluated in `vr:systemui` (devtools 8090) as

```
<device/shared/motion.js source>;\n(<device/lgs_sg.js source>)(opts)
```

`motion.js` (P5) is prepended by P8 in the same scope (daemon contract §9: `(() => { <motion.js>; return (<lgs_sg.js>)(opts); })()` with `opts.motion = true`). `lgs_sg.js` uses P5's spring when it finds it (contracts/motion.md); until then, and if it is absent, it uses its own copy of MO §8's closed form with the D2 §11.2 tokens it needs (`depth` d 0.30 b 0, `sheet-in` 0.50/0, `sheet-out` 0.35/0, `fade` 0.30/0, `snappy` 0.35/0.15). SG-1 checks the result against `springs.py`, so both give the same values.

| `opts` field | Default | Meaning | Status |
|---|---|---|---|
| `version` | `"dev"` | Re-evaluating with the same version keeps the running instance; another version replaces it (its nodes are retired first) | live |
| `watchdogMs` | 12000 | Without `update()` / `ping()` / `overrides()` for this long, every node is removed **and every override restored** (the spec and rules are kept; the next `ping()` rebuilds and re-applies them). 0 disables (tests only) | live |
| `maxPushHz` | 15 | Pushes per second for structural changes (spec changes, overrides). Steady state never exceeds it | live |
| `animHz` | 60 | Pushes per second while a depth, dim or recede value is moving (§3). Never above 60 | built |
| `global` | `"__LGS_SG"` | The window property to install as. Tests install a second, independent instance (`"__LGS_SG_TEST"`) with its own root, so they never replace the daemon's | built |
| `debugTint` | — | `{cover\|base\|pop\|slab: [r, g, b]}` wraps that kind's panels in a SteamVR `tint` node (identify copies in `hvgrab` frames) | live |
| `sharedReparent` | true | One `reparent-to-panel` per parent (NATIVE fact 1). False only for the old bisection tests | live |
| `force` | false | Replace an instance of the same version | live |

---

## 2. `window.__LGS_SG` (systemui page)

| Call | Returns | Meaning | Status |
|---|---|---|---|
| `update(spec)` | summary + beat | Build or diff the nodes for `spec` (§3). Counts as a heartbeat | live (+ v2 fields built) |
| `ping()` | beat | Daemon heartbeat (every 1 s). After a watchdog expiry the first `ping()` rebuilds the last spec and re-applies the last overrides (`rebuilt: true`) | live |
| `overrides(set)` | `{applied, missing, errors}` | Replace the active transform overrides with `set` (§4). `overrides({rules: []})` restores everything. Counts as a heartbeat | built |
| `windowState(w)` | `{dim, recede, error}` | Same as `spec.window` (§5), for callers without a spec (CSS-only mode) | built |
| `clear()` | true | Remove every node, restore every override, forget spec and rules, push once | live |
| `destroy()` | true | `clear()` and uninstall (`delete window[global]`) | live |
| `status()` | object | Scheduler, attach state, parents, counts, pushes per second, `anim`, `overrides`, `window`, `sgids` (leak check: `created`, `retired`, `live`, `dom`), errors | live (+ fields built) |
| `dump()` | array | Every injected panel: kind, parent, anchor, `z`, `zTarget`, key, uv, mpp, size, `interactive`, `dimmed`, sgids, pushedAt | live (+ fields built) |
| `geom()` | `{S, r, H0, unitM, unitsPerMm}` | Live geometry read from `DashboardStore` and `FrameStore` (SP §1.2 snippet) | built |
| `timeline(clear?)` | `[{t, z: {key: z}}]` | Every push made while a value was animating, with the pushed values (last 600). For SG-1 and P10's motion checks | built |
| `caps` | array | Features of this build: `"depthAnim"`, `"profile"`, `"dim"`, `"window"`, `"overrides"`, `"timeline"`, `"geom"`, `"sink"` | built |
| `version` | string | `opts.version` | live |

**beat** = `{items, expired, rebuilt, attached, push, pending, pushIn, specSeq, now, anim, surf}`. `surf[steamKey] = {cover, base, pop, slab, coverAt, pops: {id: at}}`, where `at` is the `Date.now()` of the first push that carried that cover, or that pop's crop **and** slab (0 = not pushed yet). Unchanged from Phase 1, so P8's acks keep working; a rising pop counts as pushed from its first push (it is on screen from then on, at the base plane). `anim` = number of values still moving.

---

## 3. The spec (`update(spec)`)

Phase 1 fields are unchanged (NATIVE.md "Daemon → systemui"): `seq`, `M`, `flags` (`{all|cover|base|pop|slab: {prop: value}}` for the six panel properties), `surfaces[]` with `steamKey, texW, texH, visible, glassd {key, backdrop, scale}, coverDz, baseDz, popped[]`, and `popped[]` with `id, x, y, w, h, dz, slab, clip`.

### 3.1 New top-level fields

| Field | Type | Default | Meaning | Status |
|---|---|---|---|---|
| `profile` | `"default"` \| `"wearer"` | `"default"` | Depth profile (PLAN §1.7). Only `"wearer"` honours `popped[].interactive`; in `"default"` every panel is `interactive: false`. P8 sets `"wearer"` only when the flag `interactivePops` is true | built |
| `reduceMotion` | bool | false | Depth, dim and recede changes are applied in one push, never animated (MO §7, D2 §11.4 C8) | built |
| `depthMotion` | token \| `"none"` | `"depth"` | The spring for depth changes. `"none"` applies every change in one push (the kill switch: P8 maps the flag `sgDepthAnim=false` to it) | built |
| `window` | `{dim, recede, motion}` | — | Steam's real window panel (`t1`), §5 | built |
| `unitM` | metres | live `geom()` | Metres per scene unit (P8 daemon §4.1). Used for `addMm` conversions when present | built |

### 3.2 New `surfaces[]` fields

| Field | Type | Default | Meaning | Status |
|---|---|---|---|---|
| `slabsOut` | `[{id, x, y, w, h, dz, slab, until}]` | [] | Slabs glassd is fading out (P8 daemon §7). A pop that is **sinking** (§3.4) keeps using its slab cell from here (or its last one) until it arrives, at most 600 ms (glassd keeps a retired cell drawn that long, GM §5.4). A listed slab without a sinking pop is not drawn (no crop to sit under) | built |
| `dim` | 0..1 \| null | null | **Dim wrapper** (card item 3): this surface's **cover and base** panels are wrapped in a SteamVR `tint` node of colour `[dim, dim, dim]`. Pops and slabs are never wrapped, so a popped sheet stays bright while the window behind it dims (SP §5). Changes animate on `window.motion` (default `sheet-in` going darker, `sheet-out` going back). `null` / absent removes the wrappers (one structural push after the value is back at 1) | built |

### 3.3 New `popped[]` fields

| Field | Type | Default | Meaning | Status |
|---|---|---|---|---|
| `interactive` | bool | false | Wearer profile only: the crop gets `interactive: true`, `steam-input-appid: 769`, `can-take-keyboard-focus: true`, exactly as Steam's `PooledPopup` panels (SP §2.6). Ignored in the default profile. Covers, base pieces and slabs are never interactive | built |
| `from` | units \| `"cut"` | 0 | Where a **new** pop starts: it rises from `from` (0 = the base plane) to `dz` on `depthMotion`. `"cut"` appears at `dz` at once (chrome-sourced menus in the wearer profile, WN §3.7) | built |
| `motion` | token | spec `depthMotion` | Per-pop spring | built |
| `sink` | bool | true | When the pop leaves the spec (or its slot `id` moves to another element), it sinks back to the base plane on `fade`, keeping its hole in the mosaic, and its nodes are removed when it arrives. `false` removes it at once | built |

### 3.4 The depth channel (card item 1)

- Every pop's displayed `z` follows a **closed-form spring** from its current value and velocity to its target (MO §8). A change of target mid-flight retargets and keeps the velocity (no jump).
- Values are evaluated **by time** from the change, so a late push never slows the animation.
- **Push cadence:** while any value moves, one push every `1000 / animHz` ms (≤ 60/s). When every value has settled (|y| < 0.001 × travel and |v| < 0.01 × travel / d), one final push carries the exact targets, then pushes stop. Structural changes are pushed at ≤ `maxPushHz`. At rest: **0 pushes**.
- **Slot ids that move** (the reporter's `card` id moving to the next poster): when a pop's rect moves by more than a quarter of its size or changes size by more than 2.5 px, the old element sinks (as `id~n`) while the new one rises. So a focus change reads as one card settling and the next one lifting.
- **Never** animated: crop x/y, uv, meters-per-pixel (MO §7). Only z, the dim colour and the recede translation move.
- **Reduce Motion** (`reduceMotion: true`) or `depthMotion: "none"`: targets are pushed once.
- Animated deltas are capped at 20 mm by the depth rules (PLAN §1.7); `lgs_sg.js` does not cap them itself.

### 3.5 Example

```json
{"seq": 88, "M": null, "profile": "default", "reduceMotion": false, "depthMotion": "depth",
 "window": {"dim": 1, "recede": 0},
 "surfaces": [
  {"steamKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "visible": true,
   "glassd": {"key": "glassd.main", "backdrop": [0, 0, 1, 0.5], "scale": 0.75},
   "coverDz": 0.001, "baseDz": 0.002, "dim": null,
   "popped": [
     {"id": "menu", "x": 640, "y": 300, "w": 640, "h": 420, "dz": 0.0271, "slab": [0, 0.51, 0.25, 0.66]},
     {"id": "card", "x": 120, "y": 200, "w": 300, "h": 450, "dz": 0.0407, "slab": [0.3, 0.51, 0.42, 0.7],
      "interactive": true}]}]}
```

`card.interactive` is ignored here (default profile).

---

## 4. Transform overrides (card item 2): `theme/sg/*.json` and `overrides(set)`

SteamVR's own chrome around the window is React-owned `vsg-transform` and `vsg-node` elements in `vr:systemui`. An override moves one of them, **composed with React's value**, re-applied on each push and restored on removal.

### 4.1 Fragments (`theme/sg/NN-name.json`, merged in name order by P8)

```json
{"fragment": "20-winbar",
 "supersedes": [],
 "rules": [
   {"id": "fc-left",  "flag": "winbarMove", "target": "frame-controls", "addMm": [-180, 0, 0]},
   {"id": "grab-up",  "flag": "winbarMove", "target": "grab-handle",    "addMm": [0, 95, 0], "resize": false},
   {"id": "tips-below", "flag": "winbarMove", "target": "tooltips",     "mul": [1, -1, 1]}]}
```

| Rule field | Meaning |
|---|---|
| `id` | Unique across fragments. A later fragment's `supersedes: [ids]` drops earlier rules |
| `flag` | The rule is active only while this runtime flag is true (PLAN §1.17: `defaults.json` < `/tmp/lgs/flags.json`). P8 filters; `lgs_sg.js` receives active rules only |
| `target` | A built-in target name (§4.2), or `select`: a CSS selector for `vsg-transform` elements in systemui (every match) |
| `add` | `[dx, dy, dz]` scene units added to React's translation |
| `addMm` | `[dx, dy, dz]` millimetres, converted with the live S × r (or S alone with `"resize": false`, for nodes that do not follow the window's resize: SteamVR marks them `frame-resize-scale-factor="0"`) |
| `mul` | `[mx, my, mz]` multiplies React's translation first (`mul [1, -1, 1]` flips a tooltip below its button) |
| `props` | `{name: value}` for a `vsg-node` target (`frame-node`): its own `buildNode` is wrapped and the properties replaced in its output (S8 frame height: `{"override-pre-resize-main-panel-height": 1.6}`) |
| `motion` | Token: the change animates on this spring (≤ 60 pushes/s while moving); absent = one push |

Written translation = `React × mul + add + addMm × unitsPerMm`.

### 4.2 Built-in targets

| Name | Element (found again on every push; React may re-create it) | Use |
|---|---|---|
| `window` | **t1**: the `vsg-transform` parent of the `mountedscenegraph` whose `mountable_id` matches `frame:\d+:page:3:mountable` (Steam's page of the dashboard frame) | Recede (§5) |
| `frame-left` | The `vsg-transform` with `parent-id` ending `main_CenterLeft` that holds the frame-menu popup panel | Tab bar +15 mm (WN §3.3.6) |
| `frame-controls` | The child `vsg-transform` of `#frame:<id>:bottom-controls-transform` | Window-bar row (WN §3.5.2) |
| `grab-handle` | `#DashboardGrabHandleTransform` | Window bar moved up to the row |
| `resize-corner` | The `vsg-transform` with `parent-id` ending `main_BottomRight` | Resize corner lifted to the glass corner |
| `tooltips` | Every `.v-parent-portal > vsg-transform > vsg-transform` (the y .15, z .05 offset of each frame-control tooltip) | Tooltips below |
| `frame-node` | The `frame-node` that mounts Steam's main overlay (`props` only) | S8 frame height |

### 4.3 Rules of the mechanism

- `vsg-transform` targets: the translation attribute is rewritten with the composed value. A `MutationObserver` sees React write a new value (microtask, before SteamVR's `setTimeout(0)` push), takes it as the new base and re-applies, so no push ever carries React's bare value. Every push also re-checks it.
- `vsg-node` targets (`props`): the element's `buildNode` is wrapped; the original is put back on restore.
- **Restore** (rule removed, `overrides({rules: []})`, `clear()`, `destroy()`, a version change, **the watchdog**): the attribute goes back to React's latest value (or the original `buildNode`), then one push. With the daemon killed, the watchdog restores within `watchdogMs` (12 s) (SG-3).
- An override never adds nodes and never retires an sgid (it changes SteamVR's own node).
- `status().overrides.applied[]` lists `{id, target, n, base, now}` per rule; `missing[]` lists rules whose target is not on the page (for example the frame controls while Now Playing shows).

---

## 5. The window panel: dim and recede (card item 3)

`spec.window = {dim, recede, motion}` (or `windowState(w)` in CSS-only mode).

| Field | Meaning | Mechanism |
|---|---|---|
| `dim` | 0..1 brightness of **Steam's real window panel** | The identity `vsg-transform` above t1 (`scaleForActivePage`) is serialized as a `tint {color: [dim, dim, dim]}` node with its own sgid (SP §5, E4). Applied only while that transform is the identity; otherwise `status().window.error` says why and nothing is dimmed |
| `recede` | units **away** from the viewer (S7 `sheetRecede`) | t1's translation z − `recede`, composed with React's value (§4.3) |
| `motion` | token for both | Default `sheet-in` (dimming, receding), `sheet-out` (back) |

**Which to use.** In CSS-only mode the window you see **is** Steam's panel, so `window.dim` dims it. In native mode the window you see is glassd's cover plus the base mosaic, which are reparented outside t1 (SP §5): dim them with `surfaces[main].dim` (§3.2), and also set `window.dim` so Steam's panel dims where it shows through transparent cover texels (windowless Home). CC-A in native mode = `window.dim 0.6` + `main.dim 0.6`. SG-5 records what a `t1` tint does to the cover in native mode (result below).

**SG-5 result:** not run yet (see `docs/phase2/wp/P7.md`). PLAN §1.8 expects: not visible over the cover.

---

## 6. Hygiene (card item 6)

- Every node `lgs_sg.js` creates gets an sgid from `VRHTML.NextSGID()`. When it leaves the DOM (item removed, wrapper removed, group emptied, `clear()`, watchdog), its sgid is handed to the scheduler module's retire export right before our next push (SP §9.1). This includes `tint` wrappers (dim and debug).
- `status().sgids = {created, retired, live, dom}`: `live` = created − retired; `dom` = sgids under our root. `live == dom` always (SG-2's leak check).
- Pushes: our push calls the module's scheduler export (`my`, found by source text `update_scene_graph`). Retire calls are queued and handed over right before our push, so they join it.
- Nothing persists: everything lives in the systemui page; a reload of the page, `lgs off` (P8 calls `destroy()`) or the watchdog removes it.

---

## 7. What P7 needs from others

| From | What | Status |
|---|---|---|
| P5 | `device/shared/motion.js` with the closed-form spring and the token table (P5 card) | waiting; built-in fallback meanwhile |
| P8 | Prepend `motion.js`; send `profile`, `reduceMotion`, `depthMotion`, `surfaces[].dim`, `window`, `popped[].interactive` / `from` / `sink`; merge `theme/sg/*.json`, filter rules by flags and call `overrides()`; install `lgs_sg.js` in **CSS-only mode too** while any sg rule is active or a window state is requested (heartbeat as in native mode) | REQ P7->P8 in `docs/phase2/wp/P7.md` |
| P6 | Layer fields `interactive` (RP-4), `from`, `sink`, and a report-level `window {dim, recede}` request from Steam's side (CC-A, sheet recede) | REQ P7->P6 |
