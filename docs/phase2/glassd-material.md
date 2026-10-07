# glassd material v2: glass without outlines

This is the material that `glassd` (the native renderer, `native/glassd/`) draws for window covers and for the slabs under popped elements. It replaces the first version, whose live run (`capabilities/native-e2e.md`) showed three problems:

1. the rim was a bright line of constant width around every cover and slab, so it read as a white stroke;
2. the window cover was a flat grey card, because the room behind the window was never seen while the dashboard stayed open;
3. lensing was not perceptible.

The user's requirements: the full glass shader effects, not just transparency; menus without clear outlines, so that the outline comes from how the glass looks; follow the design bible; feel like native visionOS.

| Where | What |
|---|---|
| `native/glassd/shaders/glass.frag` | The material (this document) |
| `native/glassd/src/glassd.cpp` | `materialPreset()`, `materialFor()` (presets, size response, dial), `phaseMap()`, `PhaseAnim` (materialize), `renderSurface()` (two-pass cover, slab shadows) |
| `native/glassd/shaders/row.frag`, `hfill.frag`, `pull.frag` | The unknown-room fill |
| `native/glassd/shaders/testroom.glsl`, `testroom.frag`, `view.frag` | Verification: the procedural test room and the composite view |
| `native/glassd/tools/test_material.sh`, `test_material.json`, `test_phase.sh` | Verification runs |
| `native/glassd/README.md` | Options, interfaces, measurements |
| `shots/p2_glassd_*.png` | The before/after evidence (procedural room only; `shots/` is not in git) |

---

## 1. The model

The glass is a slab: a flat face, and a squircle bezel of width `B` around its outline. Every texel of a piece of glass (a cover: the union of up to 8 rounded rects; a slab: one rounded rect) maps to a world point on the Steam surface (plus `dz` toward the viewer for slabs). The edge appearance comes from five cues, the anatomy measured in the visionOS references (`research/references.md` D.3, DESIGN2 §6.2), and **none of them is a line of constant width**.

### 1.1 Shape and bezel

- Signed distance `d` and its gradient (analytic, from the nearest rounded rect of the union).
- `t = clamp(−d / B, 0, 1)`: 0 at the rim, 1 where the flat face starts. `h(t) = (1 − (1 − t)⁴)^¼` (the bible's squircle).
- `B` is the material's bezel width, never wider than the shape's half size (a 60 px capsule is all bezel: thin glass) or its corner radius (so the bezel's inner contour has no crease at corners).
- Two steepness factors: `thick` (the slope the light sees: a small value puts the highlight near the rim and keeps it thin) and `lensThick` (the slope refraction sees: deeper, so the bend spans the band and not only the outer pixel).

### 1.2 What is behind: refraction, frost, dispersion

- The view ray from the eye through the texel is bent where the face is tilted: Snell at the tilted face (n = 1.5), then out through the flat back face. That is a prism: the deviation `e` toward the thick side is `atan(slope)` minus the refracted angle, normalised by its maximum (a vertical face) and scaled by the material's `lens` (degrees at the rim). The room is about a metre behind the glass, so this angular bend displaces what is seen by centimetres: the bezel shows room from further inward, compressed, the way a thick glass edge does.
- The bent ray meets the room sphere (the room map) or, for a slab, **the cover behind it** (§1.6). The flat interior is not bent.
- Frost is a mip level of the room map (4 rotated taps). In the lens band it drops toward `bandFrost`, and tint and tone compression relax by `bandClear` (a polished bevel on frosted glass), so the bend is visible there and the centre stays calm.
- Dispersion: R bends 2 % less and B 2 % more (about the physical spread of crown glass, n_F − n_C ≈ 0.008), sampled with the same filter as the main lookup (a different filter makes false colour fringes and seams). G is the mean of the two samples' green.

### 1.3 Tone

DESIGN2 §6.3: glass luminance converges to a band (L 55–110 of 255, text-bearing glass around L 70–90) whatever the room, and keeps the room's hue.

- The room's coarse luminance behind the texel (mip 6.5; for a slab, what is really behind it, the cover) sets a target `Lg = 0.314 + (Lr − 0.314) × keep` (perceptual; 0.314 is L 80; `keep` is the material's share of the room's swing, ×1.2 below the middle, ×0.8 above).
- The frosted sample is scaled to that luminance (keeping its hue), then mixed toward a neutral of the same luminance by the tint.
- Glass over glass (a slab seeing the cover) adds half its tint and sits L +8 lighter: raised, never a second darker layer.
- `clear` dims what is behind by 35 % (the HIG's dimming layer for media).

### 1.4 Light

One key light for every surface, fixed in the world: from above, about 20° left of vertical, a little in front (world direction (−0.30, 0.90, 0.32)). DESIGN2 §6.2 R2.

| Term | What it does | Why it is not an outline |
|---|---|---|
| Key specular (Blinn-Phong, exponent `gloss`) | A crescent where the bezel normal faces the light: the top edge, brightest at the upper-left corner | Only bezel normals that face the light light up; the sides and the bottom have none. 3–4 texels wide (measured), never a 1 px line |
| Transmitted highlight | Light leaving through the opposite bezel: a broad, faint glow inside the lower-right rim (references D.3 #4, "bottom lip") | A wide lobe (4–6 texels) of +8 to +15 levels, only on the bezel facing away from the light |
| Fresnel reflection | The room (mip 5) reflected on the grazing outer bezel, `(1 − n·v)⁵`, weighted 0.35 → 1 toward the lit side | Its brightness is the room's, in the reflected direction: the ceiling above, the floor below |
| Sheen | A top-down gradient across the whole shape, ±7 % | A gradient, not an edge |

### 1.5 Shade and shadow

| Term | What it does |
|---|---|
| E4 darkened edge | A soft band inside the edge (width `darkW`; ramps up over 30 % of it, down over the rest), 35 % strength on the lit side and 100 % opposite |
| E5 occlusion | Darkening just inside the lower edge, fading over 1.6 × `darkW` |
| Slab shadows on a cover | Each settled slab casts a soft shadow on the cover behind it: offset down by 0.3 × dz (VP P-48: 0.4 CSS px per mm of depth; R1, was 2 mm + 0.4 × dz), softness 3 mm + 0.4 × dz, alpha `slabShadow`. Only for slabs whose element has held still for 150 ms (the daemon's pop rule; while an element moves the daemon keeps it flat and so the shadow waits), never under the slab itself (so a slab seeing its own cover is not darkened) |
| Contact shadow | Outside a cover's shapes, where its texture has room (popups, the bar): a soft shadow 3 mm below, 6 mm soft, alpha `shadow` (0 for windows). Slabs have no margin in their atlas cells, so their separation comes from the shadow they cast on the cover |

### 1.6 Glass over glass

Behind a popped element there is only the cover (the base mosaic leaves the popped rects out). So a slab samples **the cover**, not the room: where the bent ray meets the cover plane (+1 mm), it reads the cover's quarter-resolution pass (§4, mipmapped, transparent border), composited over the room where the cover does not reach. A capsule on the window therefore shows window glass with its own bezel, highlight and shadow, not a clear hole into the room; a toolbar straddling the window's bottom edge shows that edge, softly, through itself.

R1 (review): the copy is read with nine taps (the centre and a ring of eight at 0.6 × 2^lod, 1.5 mips finer) wherever a plate or a hole's fill tone lies behind the glass, because one bilinear tap at a coarse mip turns a plate that spans 1-2 texels there into a square inside the slab; over plain cover glass one tap looks the same. **Plates over a cover** use the same mechanism (a copy of the cover alone, their optics 2 mm in front of it), so a flat menu, alert or tile kept on the window reads as raised window glass, not as a closed rim of bent room (`shots/p2_glassd_platecover_ab.png`).

### 1.7 Size changes the material

Bible P5: bigger glass is thicker, frostier, lenses less, with deeper shading. glassd takes the thickness `θ = clamp(log2(shorterSide / 44 px) / 4, 0, 1)` (0 at 44 px, 0.5 at 176 px, 1 at 704 px and more) and shifts each preset from its reference θ by `dt = θ − θref`:

| | Per unit of dt | Clamp |
|---|---|---|
| frost (mip) | +0.8 | ≥ 0 |
| lens-band frost | +0.6 | ≥ 0 |
| tint | +0.12 | 0–0.9 |
| lensing | × (1 − 0.55 dt) | 0.4–1.6 |
| key specular | × (1 − 0.25 dt) | 0.6–1.3 |
| E4, E5 | × (1 + 0.5 dt) | 0.5–1.5 |
| slab shadow | × (1 + 0.6 dt) | 0.5–1.6 |

**Deviation from DESIGN2 §6.1:** DESIGN2 defines θ from the longer side. That makes a 600 × 64 px tab bar "thick", against its own `liquid` preset. The shorter side is what bounds a slab's bezel, so glassd uses it.

---

## 2. Materials

At dial 0.5 and each preset's reference size. Widths in metres are converted with the main window's metres per pixel (0.51 mm per Steam px).

| | `window` | `panel` | `thick` | `liquid` | `clear` |
|---|---|---|---|---|---|
| Use (DESIGN2 §6.1) | Steam window, SteamVR settings, Now Playing | Popup quads over the room | Menus, sheets, alerts, keyboard platter | Ornaments, toolbars, bar segments, floating controls | Over media only |
| θ reference | 1.0 | 0.6 | 0.85 | 0.25 | 0.25 |
| Tint | 0.50 | 0.40 | 0.30 | 0.14 | 0.06 |
| Frost / lens-band frost (mip) | 3.6 / 1.2 | 3.4 / 1.0 | 4.0 / 1.2 | 1.3 / 0.3 | 0.6 / 0.1 |
| Lens-band clarity | 0.30 | 0.40 | 0.35 | 0.60 | 0.60 |
| Bezel | 20 mm | 12 mm | 14 mm | 16 mm | 16 mm |
| Steepness: light / refraction | 0.35 / 1.2 | 0.40 / 1.2 | 0.40 / 1.2 | 0.50 / 1.5 | 0.50 / 1.6 |
| Lensing (deviation at the rim) | 2.0° | 3.0° | 2.5° | 7.0° | 9.0° |
| Dispersion | 2 % | 2 % | 2 % | 2 % | 2.5 % |
| Room swing kept (tone) | 30 % | 35 % | 32 % | 60 % | 75 % |
| Backdrop dimming | — | — | — | — | 35 % |
| Key specular / exponent | 0.70 / 60 | 0.80 / 50 | 0.75 / 50 | 0.90 / 40 | 0.90 / 40 |
| Transmitted lip | 0.05 | 0.07 | 0.07 | 0.07 | 0.07 |
| Fresnel | 0.12 | 0.15 | 0.14 | 0.20 | 0.20 |
| Sheen | 1.0 | 1.0 | 1.0 | 0.8 | 0.6 |
| E4 strength / width | 0.10 / 14 mm | 0.08 / 8 mm | 0.09 / 10 mm | 0.05 / 6 mm | 0.04 / 6 mm |
| E5 occlusion | 0.07 | 0.08 | 0.09 | 0.06 | 0.05 |
| Contact shadow (covers) | 0 | 0.12 | 0.12 | 0.10 | 0.08 |
| Shadow cast as a slab | — | 0.24 | 0.28 | 0.22 | 0.20 |

- **Dial** (`glassd.json` `dial`, 0 = most transparent): tint × (0.7 + 0.6 dial), frost −1 → +1 mip, lens-band frost follows (never above the frost), room swing kept × (1.3 − 0.6 dial).
- An unknown material name renders as `window` (unchanged from v1).

---

## 3. When the room is unknown

### 3.1 The fill

The room map is an equirectangular map built from the passthrough feed with the UI masked out. While the dashboard stays open, the room right behind the window is never seen. v1 filled it with a push-pull pyramid, which gives one average colour over a hole that large: a flat grey card.

v2 adds a **row fill**. Rooms are mostly horizontal structure (floor, desk, wall, ceiling), so a hole should continue the room beside it at the same height:

1. `row.frag`: the known room per row (256 rows) in 32 azimuth sectors of 11.25°.
2. `hfill.frag`: a sector that knows little of its row takes the colours of the nearest known sectors to its left and right (up to 180° away; the map wraps), interpolated by distance; a partly known sector keeps its own share.
3. `pull.frag` (level 0): an unknown texel takes 75 % of the row fill (bilinear across sectors) and 25 % of the push-pull.
4. The filled map keeps **alpha = how well each texel is known**.

### 3.2 The glass over unknown room

With `unknown = 1 − smoothstep(0.25, 0.85, known)` (coarse): one mip more frost (the fill has no detail worth showing), +0.1 tint toward a neutral mixed 35 % toward the known room's mean hue, and a stronger sheen (+8 %). Result over the test room's hole: the wall's brown, slightly lighter at the top, instead of grey (`p2_glassd_unknown_room.png`). Over the real room at night (live run, §6) the glass took the room's blue at L ≈ 55.

### 3.3 Updates while the dashboard is hidden

- One-frame shots while hidden now blend with weight 0.6 (0.22 while streaming at 30/s): shots are sparse, so a changed room (lights on) is caught within a few shots.
- Two extra shots 0.6 s and 2 s after the dashboard hides: the wearer still faces where the window was, so these see exactly the room it hid. Then one every 5 s as before.
- Last good pixels: a texel that is masked or out of view keeps its value; nothing decays; alpha only grows.

---

## 4. Performance

The cover renders in **two passes**. Its interior is very low frequency (frost of 4° and more), so pass 1 computes it at a quarter of the resolution (RGBA16F, linear, premultiplied by coverage), and pass 2 runs the full shader only within `inner` of the edge (the bezel or 1.6 × the dark band, whichever is wider, plus 1.5 low-resolution texels: about 54 Steam px on the window) and reads pass 1 deeper in. The same quarter-resolution texture, mipmapped, is what slabs see behind them. Interior texels skip the lens, light and reflection terms; slabs fully over the cover skip the room lookups.

**Method.** `glassd --bench` renders every frame at `--fps 72` over the procedural room and prints the median and p90 of the per-frame `GL_TIME_ELAPSED` values (first tenth skipped), the GPU clock (devfreq, sampled every 100 ms) and a histogram. The headset was idle, so the governor (`simple_ondemand`, 231–903 MHz) chose the clock; numbers are also given scaled to 903 MHz. Measured 2026-10-07 on the Frame (Adreno 750 via zink, SteamOS 20261006).

| Scene (test spec, `tools/test_material.json`) | v2 median | GPU clock | at 903 MHz | v1 median (same harness) |
|---|---|---|---|---|
| Window cover alone (1440 × 810) | 0.95 ms | 629 MHz | 0.66 ms | 0.92 ms (578 MHz; 0.59) |
| Window + 6 slabs (circle, 2 capsules, menu 520 × 560, side ornament, toolbar) | 1.52 ms | 680 MHz | 1.14 ms | — |
| Full scene: the above + a bar of 2 liquid capsules | 1.69 ms | 680 MHz | 1.27 ms | 1.27 ms (629 MHz; 0.89) |
| Bar alone | 0.28 ms | 422 MHz | 0.13 ms | — |
| Live, `lgs on --native` (window with 6 slabs, bar, footer; status-line EMA) | 1.9–2.5 ms | idle clocks | — | 0.96 ms reported in the first live run (fewer slabs) |

- **Within the 2.5 ms budget** at the rate glassd renders (up to 72 Hz while the head moves, about 6 Hz with the headset still).
- **The tail is not ours.** Frame times have two modes: about 80 % of frames at the cost above (full scene: 79 % between 1.0 and 2.0 ms, almost none between 2.0 and 3.0 ms) and 15–20 % at 3.5 ms or more. The second mode is the compositor's own GPU work (about 2.3 ms a frame, NATIVE.md) interleaved with ours, which `GL_TIME_ELAPSED` counts; it is as frequent for v1 (p90 3.6 ms) and grows with the job's length. The status line's EMA mixes both modes.
- v2 costs about +0.4 ms (+40 % at a fixed clock) over v1 on the full scene; the cover alone costs the same as v1 thanks to the quarter-resolution interior.
- Before the two-pass cover and the other savings, the first v2 read 2.7–3.3 ms (EMA) on the same scene, measured while a VR game was also running, so only roughly comparable.
- Room updates (upload, integrate, push-pull, row fill, mips): 0.4–1.0 ms, about 30 a second while the glass shows (v1: 0.3–0.6 ms).

---

## 5. Materialize: the `phase` interface

Liquid Glass materializes by modulating the bend and the light, not by fading (bible P7, MO §9). glassd gives each cover and slab a progress `m` and runs the animation itself; the daemon writes targets only when they change.

### 5.1 `glassd.json` fields (all optional, backward compatible)

| Field | On | Default | Meaning |
|---|---|---|---|
| `phase` | surface, slab | 1 | The target `m`, 0..1 |
| `appear` | surface, slab | — | `"materialize"`: the first time this surface or slab id is seen, `m` starts at 0 and ramps to `phase`. Otherwise a new id appears at `phase` at once (v1 behaviour) |
| `phaseMs` | surface, slab | by size | A linear ramp: a full 0 ↔ 1 sweep takes this many ms (a retarget keeps the speed). `0` jumps (for a daemon that animates `phase` itself, frame by frame; not recommended) |
| `reduceMotion` | top level | false | Every ramp becomes a 180 ms coverage fade with all optical terms at their targets (MO C8) |
| `material: "clear"` | surface, slab | — | New preset (§2) |

`glassd-out.json` is unchanged. While any ramp moves, glassd renders every frame (up to `--fps`) and returns to on-demand rendering when all have settled.

### 5.2 The curves

| Glass | Up (`phase` rises) | Down |
|---|---|---|
| Slabs other than `thick` | Linear, 250 ms for 0 → 1 (`materialize-in`) | Linear, 350 ms (`materialize-out`) |
| Covers and `thick` slabs (menus, sheets) | `sheet-in` spring: d 0.5 s, bounce 0, settles in about 0.73 s | `sheet-out` spring: d 0.35 s, settles in about 0.51 s |

Springs are closed form (MO §8: `y(t) = e^(−ωt) (y0 + (v0 + ω y0) t)`, ω = 2π/d), restarted from the current value and velocity on a retarget, so a reversal mid-way has no jump.

### 5.3 What `m` does (MO §9)

| Range of `m` | Ramps from 0 to full |
|---|---|
| 0 → 0.6 | Key specular, transmitted lip, Fresnel: light defines the silhouette first |
| 0 → 0.7 | Lensing (deviation) |
| 0.2 → 0.92 | Frost (mip 0 → target), tint, tone compression, sheen, dimming |
| 0.3 → 0.92 | E4, E5 shading |
| 0.4 → 1 | Shadows (contact, and the slab's shadow on the cover) |
| 0 → 0.3 | Coverage alpha, `smoothstep` |

At `m = 0` the glass is invisible. `p2_glassd_materialize.png` shows `m` = 0, 0.15, 0.35, 0.6, 1 (pinned with `--phase`): the silhouette and the bend of the LED strips at the window's edge appear before the frost.

### 5.4 How the daemon should use it

- **Slab in:** add the slab with `"appear": "materialize"` (target 1), or with `phase: 0` then `phase: 1` in a later write.
- **Slab out:** set its `phase` to 0, wait for the ramp (350 ms, or 514 ms for `thick`), then remove it. A slab removed from the spec disappears as before (it stays drawn for 0.6 s as a ghost for the scene graph's sake).
- **Covers: caution.** A cover hides Steam's real panel. While its coverage alpha is below 1 (`m` < 0.3), the real panel shows through and its content appears twice (the cover's own content is in the base mosaic in front). Animate a cover's phase only while the window's content is itself hidden or fading with it (for example as the dashboard opens), or keep `m` ≥ 0.3.
- **Not wired yet:** `lgs_shell.py` sends no `phase` today, so nothing changes until it does.

### 5.5 Verified

`tools/test_phase.sh` flips every piece of glass from 0 to 1 and back over the test room and logs `m` at fixed delays: 0.10 s after the change the liquid slabs read 0.41 (linear 250 ms) and the window and menu 0.36 (closed form 0.358); at 0.38 s the spring reads 0.956 (closed form 0.953); on the way down both curves match as well. The first run of this test found a bug (an unsigned underflow made every ramp finish at once), which is fixed.

---

## 6. Verification

### 6.1 Without a wearer: the procedural test room

`--test-backdrop room|room-hole|stripes` replaces the camera with a procedural room (`testroom.glsl`: wooden slats with LED strips behind the window, a picture, a bright window on one wall, a couch, a checker floor, lamps; or a 3° stripe chart), with a fixed head and fixed geometry. `--dump-view` composites what the wearer would see: the procedural room itself (as sharp as passthrough) around the surface, the cover, and the slabs at their depths from the eye. These dumps contain no room imagery, so they are kept. `room-hole` leaves the room behind the UI unknown, as when the dashboard never closed.

The before images come from a throwaway build that plugs the committed v1 shader and v1 material values into the same harness; it reproduces the original v1 dumps pixel for pixel (maximum difference 0).

| Evidence (`shots/`) | Shows |
|---|---|
| `p2_glassd_window.png` | Window cover, top edge and corner: v1's uniform ring against v2's crescent, faint top edge, nothing down the side, the room bent into the bevel |
| `p2_glassd_capsule.png` | Capsule slab on the window: v1 closed outline; v2 top highlight, soft lower lip, depth shadow, window glass inside |
| `p2_glassd_circle.png` | Circular button on the window and over the room: v2 crescent upper left, faint arc lower right, gaps on both sides |
| `p2_glassd_menu.png` | Menu slab (+30 mm): v2 frosted window glass seen through it, slightly lighter, corner arc, depth shadow |
| `p2_glassd_lensing.png` | Bar capsules over the stripe chart: v2 bends the stripes into the top and bottom edges |
| `p2_glassd_unknown_room.png` | Room unknown behind the window: v1 grey card, v2 the wall's colour and structure |
| `p2_glassd_scene.png`, `p2_glassd_offaxis.png` | The whole test scene, and from 0.35 m to the right |
| `p2_glassd_materialize.png` | `m` = 0, 0.15, 0.35, 0.6, 1 |

Profiles across edges (texture rows, `main.png`, room backdrop): the key highlight peaks +150 levels over 3–4 texels at the top edge of capsules and +50 on the window; the lower lip is +8 to +15 levels over 4–6 texels; the sides carry neither.

### 6.2 With the feed and live

- **Feed run** (dashboard open, masks on, as in the first live run): the room was dark (lights off) and only 3.5 % of the map known. The glass came out navy (the room's hue) at about L 55, slabs lighter, a soft top highlight, no outline. Dumps looked at, then deleted on the Frame and locally.
- **Live, `lgs on --native`** (nobody else was in native mode): glassd healthy on the real feed, window with 6 slabs (focused card, side column, Back and search capsules, tab arrows), bar and footer covers. One `hvgrab` capture, looked at and deleted on both sides, then `lgs on --css`. Seen:
  - the window glass shows a soft crescent along the top and around the upper-left corner, fading down the left side; no white stroke anywhere; the side column and the header capsules read as glass slabs;
  - **a faint dashed line** along the bottom of the very wide header slab (`hdr-search`, 1743 × 48 Steam px). Its cause is not certain: the slab's lower lip was then about 2 texels wide, and a line that thin breaks up when the compositor resamples a curved panel (DESIGN2 §2.3); a base-mosaic seam is the other candidate. The lip is now 4–6 texels wide at a third of the strength (§1.4). **Re-checked live 2026-10-07 05:16** (P9 GL-5, v3 binary, the same `hdr-search` slab, 1741 × 48): the lower edge reads as one continuous soft lip, no dashes, edge ratio 0.068; at hvgrab's half resolution, so a full-resolution look is still owed (`wp/P9.md`).
- **Regression tests** on the v2 build: `tools/test_shapes.py` (union without holes, no cover for `shapes: []` and shapeless panels, window covered, oversize slabs dropped) and `tools/test_atlas.py` (300 and 900 random changes: 0 moved, 0 overlaps, nothing outside the texture, no size changes; spec → out median 2.1 ms; fds and RSS flat) pass.

### 6.3 Not verified

- **With a wearer:** comfort of the lens band and of the highlight's head-coupled motion, the depth shadows' strength in stereo, whether the band at the window's edge reads as glass or as a frame at 90 Hz in a lit room. The live run was at night with the headset resting.
- The dashed line (above) at full resolution (seen continuous at half resolution).
- v3 (plates, holes, tints, room dim) in the headset: verified over the procedural room only (`contracts/glassd.md`, `wp/P9.md`); the live look waits on the reporter (P6) and the areas that ask for them.
- The lit-room look on the device: only the procedural room and a dark real room were seen.
- Materialize driven by the daemon: the interface and timing are verified in glassd alone.

---

## 7. Notes for the coordinator

- **NATIVE.md** still lists the v1 materials table and the "rim" description in its glassd section; point it to this file. Its `glassd.json` section can mention the new optional fields (§5.1). `glassd-out.json` is unchanged.
- **The shared binary** `~/.local/share/glass-shell/native/glassd/glassd` was rebuilt from these sources (`python glass.py sync && python glass.py native-build`). The daemon is in CSS-only mode, so nothing changes until `lgs on --native`.
- **The reporter's wide header slab** (`hdr-search`, nearly the window's width) is the kind of full-width band DESIGN2 rule 3 removes; a slab that wide gets straight highlights along its whole top and bottom.
- **The Frame rebooted at 02:07** to apply the SteamOS 20261006 update (journal: `holo-post-update-shutdown`), during this work; that was not caused by glassd. Theme state was reset by the reboot and re-enabled (CSS only) by another session.
