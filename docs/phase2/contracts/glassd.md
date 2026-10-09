# Contract: glassd v3 (P9)

Owner: **P9** (`native/glassd/**`, `native/spike/fakeglassd.cpp`). Readers: **P8** (writes `glassd.json`, reads `glassd-out.json`), **P6** (reports the fields P8 passes through), **P7** (places glassd's panels), **C2a, C3b, C4b, C5a, C6a, C7** (ask for plates, holes and tints through P6's layer rules), **V1** (native gate), **P10** (`hv`, `sgcheck`).

Status of each field is in the last column of every table: **live** = in the installed binary, **built** = in the tree and tested offline, **planned** = specified here, not built yet. P9's evidence log (`docs/phase2/wp/P9.md`) says which build is installed.

**2026-10-07 05:28:** the v3 binary is installed (`native/glassd/glassd` and `native/spike/fakeglassd` in the shared install), including G7 (`roomDim`, `dim` slabs). **R1 (review fixes):** hole `edges` (cap `holeEdges`), hole shading that follows the control, plates over a cover seeing the cover, the nine-tap cover copy, the P-48 slab shadow offset and the cover-without-slabs fix; installed 2026-10-07 08:00 (`wp/P9.md`, *Status*). Offline tests GL-1, GL-2, GL-3, GL-4, GL-6 pass; GL-5 is unverified live (`wp/P9.md`).

Everything below is **backward compatible**: a v2 spec (no new fields) renders as before (only the depth conversion below changes slab shadows and slab optics, which were too deep), and a v3 field sent to an older binary is ignored by it (both the glassd and the fakeglassd parsers skip unknown keys). Feature-detect with `caps` in `glassd-out.json` (§3) before relying on a field: a binary without `caps` is v2.

Units, unless a row says otherwise:

- rects `x, y, w, h, r` in **Steam texture px** of that surface (CSS px × devicePixelRatio, 1.5 on every gamepadui surface), origin top-left, y down;
- depths (`dz`, `coverDz`, mask `dz`) in **scene units** toward the viewer, the same numbers `lgs_sg.js` gets (metres = units × `unitM`; SP §1.1). v2 glassd read them as metres, which put slab shadows and slab optics about 2.7× too deep; v3 converts with `unitM`;
- colours as `[r, g, b, a]` (0..1, sRGB, straight alpha; `[r, g, b]` means a = 1) or a CSS string (`"#rrggbb"`, `"#rrggbbaa"`, `"rgb(r g b / a)"`, `"rgba(r, g, b, a)"`, as `getComputedStyle` prints them), or one of the reporter's names `"green"` (#30d158), `"blue"` (#0091ff), `"red"` (#ff4245), `"scrim"` (black .35). An unparsable colour is ignored (treated as absent) and logged once per value (at most 16 values per run).

---

## 1. `/dev/shm/lgs/glassd.json` (P8 writes, glassd reads on change)

### 1.1 Top level

| Field | Type | Default | Meaning | Status |
|---|---|---|---|---|
| `seq` | int | 0 | Echoed in the output | live |
| `dial` | 0..1 | 0.5 | Transparency dial (GM §2). Eased (time constant 40 ms) when it changes, like `tune` | live |
| **`stereo`** | bool | true | false: every surface mono (P8: the flag `glassStereo`). Cap `stereo` | built |
| **`tune`** | `{refract, frost, light, hue?, hueK?}` | all 1, no hue | The wearer's glass tune (the bar's paintbrush panel, `lgs dial`; P8 sends it from `~/.config/glass-shell/tune.json`). Multipliers 0..2 on every material after its preset, size and the dial: `refract` × lens deviation and dispersion, `frost` × interior and edge frost (at most mip 6), `light` × key specular, Fresnel and sheen (not on occluders). `hue` (a colour) with `hueK` 0..1 moves the glass body's neutral toward that colour (`uHue`; the tint deepens by 0.2 × `hueK`); per-piece `tint`s stay on top. glassd eases every value (40 ms) and renders while it moves; `glassd-out.json` `tune` shows the values drawn. Cap `tune` | built |
| `reduceMotion` | bool | false | Every phase ramp is a 180 ms coverage fade (MO C8) | live |
| **`roomDim`** | 0..0.9 | 0 | G7 (SM-D6 "surroundings dim", behind C7's flag `roomDim`, off by default): every cover and plate sees the room darkened by this much (folded into the glass's backdrop dimming), so the glass stays consistent with a dimmed room behind it. glassd animates it itself on `sheet-in` up and `sheet-out` down (180 ms fade under `reduceMotion`); the first spec applies it at once. The dark panel around the window is a `dim` slab (§1.4) that P7 stretches behind the window | live |
| **`unitM`** | metres | 0.369 | Metres per scene unit, S × r (SP §1.1). P8 sends its live geometry value; glassd converts every depth with it | live |
| `masks` | `[{O, U, V}]` | — | Extra **world** quads cut out of the room map (G4): `O` = one corner, `U`, `V` = the two full edge vectors, metres, standing space. For things that are not on a reported surface (SteamVR's own panels, a moved ornament). ≤ 8 | live |

### 1.2 `surfaces[]`

| Field | Type | Default | Meaning | Status |
|---|---|---|---|---|
| `name`, `overlayKey`, `texW`, `texH`, `radius`, `material`, `visible` | | | As NATIVE.md | live |
| `shapes` | `[{x, y, w, h, r}]` | absent | The **cover**: the union of ≤ 8 rounded rects. `[]` = no cover. Absent = whole texture for `material: window`, else no cover | live |
| `quad` | `{O, U, V}` | — | World placement (Steam px (0,0) and steps per Steam px right and down) | live |
| `phase`, `appear`, `phaseMs` | | 1, —, by size | The cover's materialize (GM §5). The target is 0 while the surface has no cover: on a surface that stays visible, a cover that appears materializes on `sheet-in` and one that goes dematerializes on `sheet-out` with the shapes it had (main between windowless and window routes). A surface that appears or hides as a whole is at its target at once; `phaseMs: 0` makes any change instant | live |
| **`armed`** | bool | false | `visible: false` but the content is ready (a pooled popup about to show): the glass is drawn ahead in the surface's texture, which nothing shows until the scene graph attaches it. A surface that hides gets one transparent frame (no stale glass on the next open). Cap `armed` | live |
| **`appearAt`** | epoch ms | — | With `appear: "materialize"` on a cover appearing (a surface appearing, or one that stays shown and gains its cover: main from Home to Library) or a new plate: the ramp runs from this moment (the page's own open animation or the route change), not from when the spec arrived. Cap `appearAt` | live |
| **`morph`** | `{token, at}` | — | The cover's shapes move from what is shown toward `shapes` on the spring `token` (a name in `motion_tokens.h`), from `at` (epoch ms; within 2 s of now, else now), so the glass follows a page that animates its box (the frame menu opening). Only when the shape count is unchanged and the surface stays shown; a new spec with the same `shapes` lets a running morph go on. Cap `morph` | live |
| `slabs` | `[slab]` | [] | §1.4 | live (+ v3 fields) |
| **`plates`** | `[plate]` | [] | §1.3. **≤ 32**; extra plates are dropped and listed (§3) | live |
| **`coverDz`** | units | 0.001 | Where the cover and its plates sit relative to the surface plane, for glassd's optics only (the scene graph places the panel; P7 must use the same value as its spec `coverDz`). K-G6: `-0.027` (−10 mm at r = 1) puts the keyboard platter behind the keys | live |
| **`masks`** | `[{x, y, w, h, dz?}]` | [] | Extra rects of **this surface** cut out of the room map (G4), in its Steam px (they may lie outside the texture, e.g. an ornament beside the window at negative x), at `dz` units. ≤ 8 per surface | live |
| **`stereo`** | bool | false | Per-eye glass (with top-level `stereo`, unless glassd runs `--mono`): every region of the surface's texture is a pair, the left eye's copy then the right eye's, each rendered from that eye (its own rays through the glass and its own highlights), so the room behind the glass has its stereo depth instead of lying on the glass like a picture. Every x doubles: the backdrop's copies at [0, bw) and [bw, 2bw), a slab cell at mono x at [2x, 2x + w) and [2x + w, 2x + 2w); the texture is twice as wide, the mouse scale stays one copy's size (the scene graph sizes panels from it). `glassd-out.json` reports the left copy's uv (`backdrop`, slabs) and `stereo: true`; a scene-graph panel spans the pair (u1 = u0 + 2 (u1 - u0)) with `stereoscopy: 1` (Parallel), which SteamVR splits per eye **at the middle of the panel's own uv rect** (measured 2026-10-09, not the texture's halves). So only a surface the scene graph shows whole can be stereo: P8 sets it for `main` and the SteamVR panels (`vr.*`), not for the bar, the frame menu or popups (their panels are crops). A slab clipped sideways is left out while it is. Cost: the GPU time grew from about 2.9 to 3.5 ms a frame (main in stereo). Cap `stereo` | built |
| **`scaleFrom`** | `"main"` \| `"overlay"` | `"main"` for non-main surfaces | Which metres-per-pixel glassd trusts for a surface without `quad`: Steam's popups report transforms at the wrong scale, so glassd rescales them to the window's (README *Geometry*). `"overlay"` keeps the overlay's own transform (for overlays that report it right, e.g. a keyboard if K-G2 shows so) | live |

### 1.3 `plates[]` (G1): opaque per-shape glass at the cover's depth

A plate is one rounded rect of glass drawn **in the surface's backdrop region** (the same texture region and the same panel as the cover, so at `coverDz`), after the cover, in spec order. Steam's real panel is hidden under it; the base mosaic shows Steam's content in front of it. Plates are what windowless routes use instead of a cover (Home and folder discs, top-row controls, the open card and name plate, the `/invites` card, CC-M tiles and close circle), and what flat menus, alerts and sheets use when the depth rules keep them at 0.

| Field | Type | Default | Meaning | Status |
|---|---|---|---|---|
| `id` | string | `"p<index>"` | Stable id: the phase animation and the acks follow it. Give one whenever plates come and go | live |
| `x, y, w, h, r` | Steam px | r = min(w, h) / 2 | The shape (clipped to the texture) | live |
| `material` | `window` \| `panel` \| `liquid` \| `thick` \| `clear` \| `dim` | `liquid` | GM §2 presets, sized by the plate's shorter side. **`dim`** is not glass: a flat dark plate (`fill`, default black .30) with an 8 px feathered edge, no optics, no light, no shadow; for the room dim (SM-D6) and CC-A dimming | live |
| `phase`, `appear`, `phaseMs` | | 1, —, by size | Materialize, as for slabs (GM §5): `liquid`/`panel`/`clear`/`dim` plates ramp linearly 250 / 350 ms, `window` and `thick` plates ride `sheet-in` / `sheet-out` | live |
| `tint` | colour | — | Coloured glass (G3): the glass is pulled toward this colour with strength `a`, keeping ± 25 % of the room's brightness variation and all of the light terms | live |
| `fill` | colour | — | A flat tone composited over the glass inside the shape, blended in sRGB like CSS (SET's container tone: black .14 inside a platter) | live |
| `occluder` | bool | false | The **occluder variant** (HA §10.2): brightness × .55, no key specular, no transmitted lip, no Fresnel, no contact shadow. Use it under a pop that sits over its own plate (Home's focused cell), so off axis the plate reads as the pop's shadow | live |
| `shadow` | 0..1 | material's contact shadow | Contact-shadow alpha outside the plate (needs transparent texels around it). `0` turns it off | live |
| **`exitAt`, `exitMs`** | epoch ms, ms (≤ 2000) | —, 150 | The plate's content is fading out (a route or a sheet leaving) from `exitAt` over `exitMs`: the glass fades with it, coverage and shadow × (1 − elapsed / `exitMs`), linearly like the page's opacity, its optics unchanged; nothing is drawn after. Kept while repeated with the same `exitAt`. Cap `exitAt` | built |

Notes:

- A plate never morphs into another id: to move glass, change its `x/y/w/h` (redrawn at once, no ramp) or retire the old id (`phase` 0, then remove it) and add a new one with `appear: "materialize"`.
- A plate whose id leaves the spec disappears at once (no ghost: plates have no atlas cell that the scene graph might still show).
- Slabs see plates behind them (glass over glass, GM §1.6): a slab over a plate samples the plate, not the room, through a round nine-tap blur (R1: one coarse tap drew a square inside the slab).
- **A plate over a cover sees that cover** (R1, glass over glass): it samples the cover's quarter-resolution copy as a slab does, with its optics 2 mm in front of the cover, so it reads as raised window glass (half its tint, L +8) with its own bezel and light, never as a closed rim of bent room. Plates on a windowless surface (`shapes: []`) see the room, as before.
- Cost: each plate is one scissored draw over its rect plus its shadow margin. 19 Home plates ≈ 0.45 M texels at scale 0.75; GL-3 measures it.

### 1.4 `slabs[]`: v3 additions

Existing fields (`id`, `x`, `y`, `w`, `h`, `r`, `material`, `dz`, `phase`, `appear`, `phaseMs`) are unchanged.

| Field | Type | Default | Meaning | Status |
|---|---|---|---|---|
| `material: "dim"` | | | G7: the cell is a flat dark tone (`fill`, default black .30) with an 8 px feathered edge: no optics, no light, no shadow, no hole on the cover (unless it has `hole`). It is the texture for the room-dim panel: P7 places this cell as a large quad behind the window (`dz` < 0 or a fixed distance), scaled up, so the feather becomes a soft edge. Rides `sheet-in` / `sheet-out` like `thick` (out-ramp 514 ms) | live |
| `fill` | colour | black .30 | The `dim` slab's tone | live |
| `material: "none"` | | | The slab gets its cell (so P8's pop rule and P7's placement work unchanged) but draws **nothing** there; its hole and its shadow on the cover are still drawn. For pops over opaque art where the glass is in-page (GP's cluster) | live |
| **`tint`** | colour | — | Coloured Liquid Glass (G3): green Play / Resume, blue Install / Update (D2 §6.4 Tinted). As for plates | live |
| **`hole`** | `true` \| `{shadow, y, blur, fill, clip}` | — | **Hole treatment** (G2). Drawn into the cover (and into any plate) under the popped element: the slab's own contact shadow, **not** excluded under the slab, clipped to the crop's rect, plus an optional `fill` tone under the shadow. Off axis the sliver a pop reveals then reads as its shadow over its container's tone, not as a bright sliver of glass or room. `true` = all defaults | live |
| `hole.shadow` | 0..1 | 0.35 | Shadow alpha (black) | live |
| `hole.y`, `hole.blur` | Steam px | 9, 27 | Offset down and blur radius (= GP's 6 / 18 CSS px at 1.5×) | live |
| `hole.fill` | colour | — | The container's tone inside the clip rect (black .14 in a platter; the scrim's black .35 under an alert; over art prefer `edges`). Blended in sRGB, hard-edged at the clip rect | live |
| **`hole.edges`** | `{top, right, bottom, left}`, each a colour or a list of 1-8 colours | — | R1, cap `holeEdges`. The tones **just outside** each edge of the clip rect (a 2 CSS px strip; a list samples along the edge, left to right or top to bottom, about one sample per 27 CSS px). Inside the hole glassd blends them by nearness to each edge (and between the samples along it), so the sliver a pop reveals off axis continues what surrounds the crop. An edge without samples uses `fill`. For pops over art and posters: P6's `fill: "auto"` (REQ P9->P6); P8 must pass it through (REQ P9->P8) | live in glassd (R1) |
| `hole.clip` | `[x0, y0, x1, y1]` | the slab's rect | The crop's rect, i.e. the hole the base mosaic leaves (pass P8's `clip` when it trims a sliver) | live |
| **`ox`, `oy`** | Steam px | 0 | Offset of the slab's **world point** from `x, y` for a crop the scene graph moved (SP §11.2 item 1, moved ornaments). The hole and the cover shadow stay at `x, y` | live |

**Choosing the hole's tone (GL-2, revised in R1).** The hole is a hard-edged rect (the crop's), and off axis only a thin L-shaped sliver of it shows. Where its tone differs from what lies just outside the crop, the sliver draws a crisp L-bracket along the rect, which reads as an outline (VP P-42). One flat `fill` cannot match art that varies by 15-20 L over a crop (R1 review M2), so over art and posters send **`edges`**: with them the sliver's rim matches the art within |dL| 2-3 and its corners within 2-4 (`tools/test_holes.py`). Over a flat container (a platter, the scrim under an alert) a flat `fill` is exact. Without either, the cover glass shows in the sliver: right over glass, wrong over opaque art.

**How the hole is shaded (R1).** Inside the clip rect: the control's own contact shadow (`shadow`, `y`, `blur`), not excluded under the slab, and a small ambient-occlusion floor (30 % of `shadow`) only under the control's rounded shape (6 px falloff), never in the rect's corners beyond its rounded ends. Over an opaque tone (`fill` or `edges`, by their alpha) the shadow also follows the control's shape (falloff 0.4 x `blur`) and fades to nothing at the clip rect's edge (over 0.3 x `blur`), because past that edge the content hides the cover and the shadow cannot continue: the sliver darkens toward the control and meets the content with no step. Over glass (no fill) the shadow stays continuous across the crop's edge.

The cast shadow of a slab on its cover (GM §1.5), for slabs without `hole`: offset down 0.3 x dz (VP P-48: 0.4 CSS px per mm; R1, was 2 mm + 0.4 x dz), softness 3 mm + 0.4 x dz. With `hole`, the cover shadow uses the hole's alpha, offset and blur everywhere.

### 1.5 Example

```json
{"seq": 41, "dial": 0.5, "unitM": 0.3185, "reduceMotion": false, "surfaces": [
  {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "radius": 81,
   "material": "window", "visible": true, "shapes": [],
   "plates": [
     {"id": "disc-0", "x": 330, "y": 120, "w": 180, "h": 180, "material": "liquid", "appear": "materialize"},
     {"id": "disc-1", "x": 666, "y": 120, "w": 180, "h": 180, "material": "liquid", "occluder": true},
     {"id": "card",   "x": 600, "y": 380, "w": 720, "h": 300, "r": 54, "material": "thick", "fill": "rgba(0, 0, 0, 0.14)"}],
   "slabs": [
     {"id": "cell", "x": 666, "y": 120, "w": 180, "h": 180, "r": 90, "material": "liquid", "dz": 0.041},
     {"id": "play", "x": 120, "y": 820, "w": 420, "h": 120, "r": 60, "material": "liquid", "dz": 0.041,
      "tint": [0.19, 0.78, 0.35, 0.55], "hole": {"fill": "rgb(18 20 26 / 0.9)"}},
     {"id": "manage", "x": 600, "y": 832, "w": 90, "h": 90, "r": 45, "material": "none", "dz": 0.027, "hole": true}]}
]}
```

---

## 2. Behaviour

| Topic | Rule |
|---|---|
| Draw order in the backdrop region | cover (with the casters' shadows and holes) → plates in spec order (each with the holes that fall on it) → holes' fills → nothing else. The slab atlas is separate (unchanged) |
| What slabs see behind them | The cover **and the plates** at quarter resolution (GM §1.6), so a pop over its plate sees that plate (nine-tap blur, R1) |
| What plates see behind them | Over a cover: the cover alone, at quarter resolution (R1). On a windowless surface: the room |
| Phase | Covers, plates and slabs animate independently toward their `phase`; glassd renders at full rate while any ramp moves (GM §5) |
| Masks | Every visible surface's quad (unchanged), plus surface `masks` and top-level `masks`. Up to 24 mask quads in all; beyond that the room map stops integrating (`masks=N(incomplete)`), never integrates UI |
| Limits | cover shapes ≤ 8; plates ≤ 32 per surface; casters (slab shadows and holes) on one piece of glass ≤ 16; masks ≤ 24 |
| Unknown values | Unknown material names render as `window` (slabs: `liquid` default unchanged). Unknown fields are ignored |
| Budget | ≤ 2.5 ms median GPU per frame with the Phase 2 scenes (GL-3). If plates push it over, P9 moves plate interiors to the quarter-resolution pass first (R8) |

---

## 3. `/dev/shm/lgs/glassd-out.json` (glassd writes, P8 reads)

Unchanged fields: `seq`, `pid`, `updated`, `healthy`, `fps`, `gpu_ms`, `frames`, `dashboard`, `last_submit_s`, `room_ms`, `room_updates`, `feed`, `exiting`, and per surface `key`, `texW`, `texH`, `backdrop`, `backdropScale`, `cover`, `geometry`, `slabs`, `dropped`.

| New field | Where | Meaning | Status |
|---|---|---|---|
| `version` | top | `3` | live |
| `caps` | top | The v3 features this binary has: any of `"plates"`, `"holes"`, `"tint"`, `"masks"`, `"coverDz"`, `"none"`, `"offset"`, `"dim"`, `"scaleFrom"`, `"unitM"`, `"roomDim"`, `"dimSlab"` (a slab `material: "dim"`), `"holeEdges"` (R1: `hole.edges`). P8 sends a field only when its cap is listed | live (`holeEdges` from R1) |
| `plates` | surface | The plate ids drawn (in the backdrop region, so their UV is `backdrop`). P8 acks a plate once its surface's cover node has been pushed ≥ 350 ms and the id is listed here | live |
| `droppedPlates` | surface | Plate ids not drawn (beyond 32, or empty after clipping): the first 32 (R1; `counts.droppedPlates` counts them all). `dropped` (slabs) is listed the same way | live |
| `counts` | surface | `{"shapes", "plates", "slabs", "holes", "dropped", "droppedPlates"}` | live |

`cover` stays the number of cover **shapes**. A windowless surface (`shapes: []`) with plates reports `cover: 0`; P8 decides `lgs-native` for such a surface from `plates` (P8's contract).

---

## 4. Command line additions (lab and tests only)

| Option | Meaning | Status |
|---|---|---|
| `--spec tools/bench/NAME.json --bench` | The Phase 2 bench scenes (files, not built in): `home` (19 plates + 1 slab), `library` (window cover + ornament plate + 3 slabs), `ccm` (4 plates), `keyboard` (library + a keyboard cover). `tools/test_bench.sh` runs all four (GL-3) | live |
| `--selftest phase` | The materialize ramps against `motion_tokens.h`, no SteamVR (MO-5); exit 0 = pass | live |
| `--test-backdrop`, `--test-head`, `--dump-view`, `--bench`, `--phase` | As README | live |

---

## 5. fakeglassd (`native/spike/fakeglassd.cpp`)

Follows this contract: it accepts every v3 field, paints plates (flat frosted gradients, `occluder` at .55, `dim` dark, `tint`/`fill` applied), paints holes as flat rects (their `fill`, else the mean of their `edges`, else black .35), and writes the same `glassd-out.json` fields (`version`, `caps` with `holeEdges`, `plates`, `droppedPlates` (the first 32), `counts`). It never touches the camera. Test GL-6.

---

## 6. Not in v3

- Morphs of glass between shapes (`morph-open` / `morph-close` across a menu and its source), `press` and press position (D2 §11.8): not built. Menus materialize in place (`phase`); C1c's CSS draws the open morph (C1c D15) and glassd dematerializes on close. This is a PLAN 1.17 decision recorded in `wp/P9.md` (*Notes and decisions*, R1): a glassd `morph-close` needs P8 to keep the closing slab with its source rect and P7 to keep drawing a slab whose pop has gone (P7 does not draw a listed slab without a sinking pop), and no package asks for it yet.
- A cover offset per shape: `coverDz` is per surface.
- Room dim **outside** the window's rect (SM-D6, behind C7's flag `roomDim`, off by default): the compositor side is built (2026-10-07, REQ P7->P9). glassd draws the pieces (top-level `roomDim` and the `dim` slab cell, §1.1, §1.4, `shots/p2_glassd_roomdim.png`); P8 passes `roomDim` (cap `roomDim`) and sends each `dim` slab to the scene graph as `dimSlabs` (cap `dimSlab`, never popped); P7 places each cell as a `roomdim` panel behind the window, at z ≤ −0.05 units, centred on its rect and 3× its size (`contracts/sg.md` §3.2, SG-ROOMDIM). What P7 relies on, and glassd keeps: a `dim` slab's cell spans exactly its rect × `backdropScale` (the slab rule, §1.4), with the 8 px feather inside the cell, so the stretched quad keeps its size and its soft edge. Not built: the report side. P6's reporter has no `dim` layer material (its slab materials are `window`, `panel`, `liquid`, `thick`, `clear`, `none`) and reports no top-level `roomDim`; no area asks for them while C7's `roomDim` flag is off, so today only a lab spec (`--test-report`) drives the chain. A `dim` **plate** draws only inside its surface.
