# Contract: glassd v3 (P9)

Owner: **P9** (`native/glassd/**`, `native/spike/fakeglassd.cpp`). Readers: **P8** (writes `glassd.json`, reads `glassd-out.json`), **P6** (reports the fields P8 passes through), **P7** (places glassd's panels), **C2a, C3b, C4b, C5a, C6a, C7** (ask for plates, holes and tints through P6's layer rules), **V1** (native gate), **P10** (`hv`, `sgcheck`).

Status of each field is in the last column of every table: **live** = in the installed binary, **built** = in the tree and tested offline, **planned** = specified here, not built yet. P9's evidence log (`docs/phase2/wp/P9.md`) says which build is installed.

Everything below is **backward compatible**: a v2 spec (no new fields) renders as before (only the depth conversion below changes slab shadows and slab optics, which were too deep), and a v3 field sent to an older binary is ignored by it (both the glassd and the fakeglassd parsers skip unknown keys). Feature-detect with `caps` in `glassd-out.json` (§3) before relying on a field: a binary without `caps` is v2.

Units, unless a row says otherwise:

- rects `x, y, w, h, r` in **Steam texture px** of that surface (CSS px × devicePixelRatio, 1.5 on every gamepadui surface), origin top-left, y down;
- depths (`dz`, `coverDz`, mask `dz`) in **scene units** toward the viewer, the same numbers `lgs_sg.js` gets (metres = units × `unitM`; SP §1.1). v2 glassd read them as metres, which put slab shadows and slab optics about 2.7× too deep; v3 converts with `unitM`;
- colours as `[r, g, b, a]` (0..1, sRGB, straight alpha; `[r, g, b]` means a = 1) or a CSS string (`"#rrggbb"`, `"#rrggbbaa"`, `"rgb(r g b / a)"`, `"rgba(r, g, b, a)"`, as `getComputedStyle` prints them). An unparsable colour is ignored (treated as absent) and logged once.

---

## 1. `/dev/shm/lgs/glassd.json` (P8 writes, glassd reads on change)

### 1.1 Top level

| Field | Type | Default | Meaning | Status |
|---|---|---|---|---|
| `seq` | int | 0 | Echoed in the output | live |
| `dial` | 0..1 | 0.5 | Transparency dial (GM §2) | live |
| `reduceMotion` | bool | false | Every phase ramp is a 180 ms coverage fade (MO C8) | live |
| **`unitM`** | metres | 0.369 | Metres per scene unit, S × r (SP §1.1). P8 sends its live geometry value; glassd converts every depth with it | built |
| `masks` | `[{O, U, V}]` | — | Extra **world** quads cut out of the room map (G4): `O` = one corner, `U`, `V` = the two full edge vectors, metres, standing space. For things that are not on a reported surface (SteamVR's own panels, a moved ornament). ≤ 8 | built |

### 1.2 `surfaces[]`

| Field | Type | Default | Meaning | Status |
|---|---|---|---|---|
| `name`, `overlayKey`, `texW`, `texH`, `radius`, `material`, `visible` | | | As NATIVE.md | live |
| `shapes` | `[{x, y, w, h, r}]` | absent | The **cover**: the union of ≤ 8 rounded rects. `[]` = no cover. Absent = whole texture for `material: window`, else no cover | live |
| `quad` | `{O, U, V}` | — | World placement (Steam px (0,0) and steps per Steam px right and down) | live |
| `phase`, `appear`, `phaseMs` | | 1, —, by size | The cover's materialize (GM §5) | live |
| `slabs` | `[slab]` | [] | §1.4 | live (+ v3 fields) |
| **`plates`** | `[plate]` | [] | §1.3. **≤ 32**; extra plates are dropped and listed (§3) | built |
| **`coverDz`** | units | 0.001 | Where the cover and its plates sit relative to the surface plane, for glassd's optics only (the scene graph places the panel; P7 must use the same value as its spec `coverDz`). K-G6: `-0.027` (−10 mm at r = 1) puts the keyboard platter behind the keys | built |
| **`masks`** | `[{x, y, w, h, dz?}]` | [] | Extra rects of **this surface** cut out of the room map (G4), in its Steam px (they may lie outside the texture, e.g. an ornament beside the window at negative x), at `dz` units. ≤ 8 per surface | built |
| **`scaleFrom`** | `"main"` \| `"overlay"` | `"main"` for non-main surfaces | Which metres-per-pixel glassd trusts for a surface without `quad`: Steam's popups report transforms at the wrong scale, so glassd rescales them to the window's (README *Geometry*). `"overlay"` keeps the overlay's own transform (for overlays that report it right, e.g. a keyboard if K-G2 shows so) | built |

### 1.3 `plates[]` (G1): opaque per-shape glass at the cover's depth

A plate is one rounded rect of glass drawn **in the surface's backdrop region** (the same texture region and the same panel as the cover, so at `coverDz`), after the cover, in spec order. Steam's real panel is hidden under it; the base mosaic shows Steam's content in front of it. Plates are what windowless routes use instead of a cover (Home and folder discs, top-row controls, the open card and name plate, the `/invites` card, CC-M tiles and close circle), and what flat menus, alerts and sheets use when the depth rules keep them at 0.

| Field | Type | Default | Meaning | Status |
|---|---|---|---|---|
| `id` | string | `"p<index>"` | Stable id: the phase animation and the acks follow it. Give one whenever plates come and go | built |
| `x, y, w, h, r` | Steam px | r = min(w, h) / 2 | The shape (clipped to the texture) | built |
| `material` | `window` \| `panel` \| `liquid` \| `thick` \| `clear` \| `dim` | `liquid` | GM §2 presets, sized by the plate's shorter side. **`dim`** is not glass: a flat dark plate (`fill`, default black .30) with an 8 px feathered edge, no optics, no light, no shadow; for the room dim (SM-D6) and CC-A dimming | built |
| `phase`, `appear`, `phaseMs` | | 1, —, by size | Materialize, as for slabs (GM §5): `liquid`/`panel`/`clear`/`dim` plates ramp linearly 250 / 350 ms, `window` and `thick` plates ride `sheet-in` / `sheet-out` | built |
| `tint` | colour | — | Coloured glass (G3): the glass is pulled toward this colour with strength `a`, keeping ± 25 % of the room's brightness variation and all of the light terms | built |
| `fill` | colour | — | A flat tone composited over the glass inside the shape, blended in sRGB like CSS (SET's container tone: black .14 inside a platter) | built |
| `occluder` | bool | false | The **occluder variant** (HA §10.2): brightness × .55, no key specular, no transmitted lip, no Fresnel, no contact shadow. Use it under a pop that sits over its own plate (Home's focused cell), so off axis the plate reads as the pop's shadow | built |
| `shadow` | 0..1 | material's contact shadow | Contact-shadow alpha outside the plate (needs transparent texels around it). `0` turns it off | built |

Notes:

- A plate never morphs into another id: to move glass, change its `x/y/w/h` (redrawn at once, no ramp) or retire the old id (`phase` 0, then remove it) and add a new one with `appear: "materialize"`.
- A plate whose id leaves the spec disappears at once (no ghost: plates have no atlas cell that the scene graph might still show).
- Slabs see plates behind them (glass over glass, GM §1.6): a slab over a plate samples the plate, not the room.
- Cost: each plate is one scissored draw over its rect plus its shadow margin. 19 Home plates ≈ 0.45 M texels at scale 0.75; GL-3 measures it.

### 1.4 `slabs[]`: v3 additions

Existing fields (`id`, `x`, `y`, `w`, `h`, `r`, `material`, `dz`, `phase`, `appear`, `phaseMs`) are unchanged.

| Field | Type | Default | Meaning | Status |
|---|---|---|---|---|
| `material: "none"` | | | The slab gets its cell (so P8's pop rule and P7's placement work unchanged) but draws **nothing** there; its hole and its shadow on the cover are still drawn. For pops over opaque art where the glass is in-page (GP's cluster) | built |
| **`tint`** | colour | — | Coloured Liquid Glass (G3): green Play / Resume, blue Install / Update (D2 §6.4 Tinted). As for plates | built |
| **`hole`** | `true` \| `{shadow, y, blur, fill, clip}` | — | **Hole treatment** (G2). Drawn into the cover (and into any plate) under the popped element: the slab's own contact shadow, **not** excluded under the slab, clipped to the crop's rect, plus an optional `fill` tone under the shadow. Off axis the sliver a pop reveals then reads as its shadow over its container's tone, not as a bright sliver of glass or room. `true` = all defaults | built |
| `hole.shadow` | 0..1 | 0.35 | Shadow alpha (black) | built |
| `hole.y`, `hole.blur` | Steam px | 9, 27 | Offset down and blur radius (= GP's 6 / 18 CSS px at 1.5×) | built |
| `hole.fill` | colour | — | The container's tone inside the clip rect (the art's mean colour over hero art; black .14 in a platter; the scrim's black .35 under an alert). Blended in sRGB, hard-edged at the clip rect | built |
| `hole.clip` | `[x0, y0, x1, y1]` | the slab's rect | The crop's rect, i.e. the hole the base mosaic leaves (pass P8's `clip` when it trims a sliver) | built |
| **`ox`, `oy`** | Steam px | 0 | Offset of the slab's **world point** from `x, y` for a crop the scene graph moved (SP §11.2 item 1, moved ornaments). The hole and the cover shadow stay at `x, y` | built |

The cast shadow of a slab on its cover (GM §1.5) is unchanged for slabs without `hole`. With `hole`, the cover shadow uses the hole's alpha, offset and blur everywhere, so the shadow is continuous across the crop's edge.

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
| What slabs see behind them | The cover **and the plates** at quarter resolution (GM §1.6), so a pop over its plate sees that plate |
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
| `version` | top | `3` | built |
| `caps` | top | The v3 features this binary has: any of `"plates"`, `"holes"`, `"tint"`, `"masks"`, `"coverDz"`, `"none"`, `"offset"`, `"dim"`, `"scaleFrom"`, `"unitM"`. P8 sends a field only when its cap is listed | built |
| `plates` | surface | The plate ids drawn (in the backdrop region, so their UV is `backdrop`). P8 acks a plate once its surface's cover node has been pushed ≥ 350 ms and the id is listed here | built |
| `droppedPlates` | surface | Plate ids not drawn (beyond 32, or empty after clipping) | built |
| `counts` | surface | `{"shapes", "plates", "slabs", "holes", "dropped", "droppedPlates"}` | built |

`cover` stays the number of cover **shapes**. A windowless surface (`shapes: []`) with plates reports `cover: 0`; P8 decides `lgs-native` for such a surface from `plates` (P8's contract).

---

## 4. Command line additions (lab and tests only)

| Option | Meaning | Status |
|---|---|---|
| `--bench-scene NAME` | Replaces `--spec` with a built-in Phase 2 scene: `home` (19 plates + 1 slab), `library` (window cover + 3 slabs), `ccm` (4 plates), `keyboard` (library + a keyboard cover) | built |
| `--test-backdrop`, `--test-head`, `--dump-view`, `--bench`, `--phase` | As README | live |

---

## 5. fakeglassd (`native/spike/fakeglassd.cpp`)

Follows this contract: it accepts every v3 field, paints plates (flat frosted gradients, `occluder` at .55, `dim` dark, `tint`/`fill` applied), paints holes as dark rects, and writes the same `glassd-out.json` fields (`version`, `caps`, `plates`, `droppedPlates`, `counts`). It never touches the camera. Test GL-6.

---

## 6. Not in v3

- Morphs of glass between shapes (`morph-open` / `morph-close` across a menu and its source), `press` and press position (D2 §11.8): not built. Menus materialize in place (`phase`); C1c's CSS draws the morph.
- A cover offset per shape: `coverDz` is per surface.
- Room dim **outside** the window's rect (SM-D6) needs glass outside the Steam texture: a `dim` plate draws only inside its surface. G7 note in P9.md.
