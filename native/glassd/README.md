# glassd: native glass for Glass Shell

`glassd` renders the parts of the visionOS look that CSS cannot: window glass that frosts and lenses the **room** behind Steam's panels, and Liquid Glass slabs under elements that pop forward in stereo depth. The architecture and interfaces are in [`docs/NATIVE.md`](../../docs/NATIVE.md); this file covers the program itself.

It is a C++17 program built on the Frame. The stack is GBM, surfaceless EGL and GLES 3.2 (Mesa zink on Turnip), rendering into dmabufs that SteamVR imports. It has no window and no X.

## Build and run

On the Frame:

```sh
sh build.sh                 # -> ./glassd, plus build/{ovgrab,fakeov,inview,feedprobe} (verification tools)
DEBUG=1 sh build.sh         # -O0 -g
```

From the PC: `python glass.py sync && python glass.py native-build` builds `~/.local/share/glass-shell/native/glassd/glassd`, which is where `lgs-shell` looks for it.

The build needs `openvr.h` v2.15.6 (with `IVRIPCResourceManagerClient::ImportDmabuf`). `build.sh` uses frametop's copy at `~/frametop/screens/build/include`, or downloads that tag into `build/include`. It links SteamVR's own `/opt/steamvr/bin/linuxarm64/libopenvr_api.so`.

`device/lgs_shell.py` normally starts glassd as a child process. Extra arguments come from `LGS_GLASSD_ARGS`. stdout carries status lines for the unit's journal. glassd:

- refuses to start if SteamVR (`vrserver`) is not running, so it never launches SteamVR;
- runs as one instance per output file **and** per overlay key prefix (`flock` on `<out>.lock` and on `/dev/shm/lgs/<prefix>lock`);
- stops with its parent (`PR_SET_PDEATHSIG` plus a parent-pid check), so an orphan never keeps the overlays and the locks; `--orphan-ok` disables this for detached lab runs;
- exits cleanly on SIGTERM, SIGINT, SIGHUP or SteamVR's `VREvent_Quit`, destroying its overlays (about 25 ms).

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Stopped: signal, `--timeout`, parent gone, `--once` done |
| 1 | Setup error (GPU, shaders, OpenVR interfaces) |
| 2 | Bad arguments |
| 75 | Temporary, **not a crash**: another glassd holds a lock; SteamVR is not running, quits (`VREvent_Quit`) or went away (the `vrserver` or `vrcompositor` process it connected to is gone); or its overlays were lost three times within 30 s. The daemon should retry later without counting it as a crash |

### Options

| Option | Default | Meaning |
|---|---|---|
| `--spec FILE` | `/dev/shm/lgs/glassd.json` | Spec to follow. inotify on its directory picks up a new spec at once (median 2 ms from write to `glassd-out.json`); a 10 Hz stat poll remains as a fallback. A half-written file is ignored and retried |
| `--out FILE` | `/dev/shm/lgs/glassd-out.json` | Layout and stats output (atomic tmp + rename). With another `--key-prefix P` the default is `/dev/shm/lgs/<P>out.json`, so a test instance never writes the daemon's file |
| `--demo` | | Built-in spec instead of `--spec`: main window plus 3 slabs (the NATIVE.md example) |
| `--once` | | Integrate the feed for `--warmup` s, render every surface once, write dumps, exit |
| `--dump DIR` | | Write every surface texture to `DIR/<name>.png` after warm-up (straight alpha) |
| `--dump-room PATH` | | Write the filled room map to `PATH` and the "known" mask to `PATH-known.png` |
| `--force` | | Render even while the dashboard is hidden |
| `--scale S` | 0.75 | `backdropScale` |
| `--fps N` | 72 | Maximum render rate while visible |
| `--feed-hz N` | 36 | Room-map updates per second while the glass shows (the feed streams) |
| `--idle-hz N` | 0.2 | One-frame feed shots per second otherwise (`0` = none; see *Feed*) |
| `--warmup S` | 3 | Feed seconds before `--once` or `--dump` output |
| `--margin M` | 0.06 | Feed mask margin around every Steam surface (m) |
| `--zone S,T,B` | 0.15,0.08,0.25 | Extra mask around the main window: side, top, bottom (m). See *Room model* |
| `--key-prefix P` | `glassd.` | Overlay key prefix. Use e.g. `glassd-test.` for tests next to a running daemon |
| `--shaders DIR` | built in | Load shaders from DIR (for tuning without rebuilding) |
| `--feed DEV` / `--no-feed` | `/dev/video99` | Passthrough feed device |
| `--timeout S` | | Exit after S seconds |
| `--orphan-ok` | | Keep running when the parent exits (detached lab runs only) |
| `--dash on\|off\|auto` | auto | Test override for `IsDashboardVisible` |
| `--no-mask` | | Debug: integrate the feed without masking the UI |
| `--debug-view N` | 0 | Debug shading: 1 backdrop only (what the glass sees, bent), 2 light only, 3 bezel (`t`, lens strength, slope), 4 room-map UV, 5 how well the room behind is known |
| `--test-backdrop P` | | No camera: a procedural room instead of the feed (`room`; `room-hole`, the same with the room behind the UI unknown; `stripes`, a lensing chart), a fixed head and fixed geometry (the spec's `quad`, else the window 1.43 m ahead). Dumps show no room imagery and may be kept |
| `--test-head X,Y,Z` | 0,0,0 | With `--test-backdrop`: move the eye by X, Y, Z metres (off-axis views; the glass stays put) |
| `--dump-view` | | With `--dump`: also write `DIR/<name>-view.png`, what the wearer would see: the room around the surface (with `--test-backdrop` the procedural room itself, as sharp as passthrough), the cover and the slabs at their depths |
| `--bench` | | Render every frame at `--fps` (GPU timing in the status line) |
| `--phase M` | | Pin every cover and slab at materialize progress M (0..1), for dumps (see *Phase*) |
| `--selftest phase` | | Offline: the materialize ramps against `native/shared/motion_tokens.h` at 1 ms steps (no SteamVR); exit 0 = pass |
| `--view-content none\|hero\|hero-art` | none | With `--dump-view`: `hero` draws a stand-in page in front of the cover (opaque art with the popped rects cut out, and the popped crops at their depths), to judge hole treatments off axis; `hero-art` the same without the cut-outs (the reference `tools/test_holes.py` measures against) |

- `kill -USR1 <pid>` writes the room map and every surface to the `--dump` paths. Without them it writes to `/tmp/lgs/glassd-dump/`.
- `kill -USR2 <pid>` (test aid) treats every overlay as lost: it destroys and recreates them, as after a compositor hiccup.

**Privacy:** room-map and surface dumps show the user's room. Look at them, then delete them. Never keep or upload them. Feed frames stay in RAM.

## Interfaces

### Input: `glassd.json`

The fields follow NATIVE.md: `seq`, `dial`, `surfaces[]` with `name`, `overlayKey`, `texW`, `texH`, `radius`, `material`, `visible`, `shapes`, `slabs[]` (`id`, `w`, `h`, `r`, `material`).

- **`surfaces[].shapes`** `[{x, y, w, h, r}]`: the cover's rounded shapes in Steam texture pixels (clipped to the texture; at most 8 are drawn). The cover is their **union**, drawn in one pass, so overlapping shapes merge and rims follow the union's outline. Outside the shapes the cover is transparent.
  - `"shapes": []` (explicit and empty) means **no cover**: nothing is drawn in the backdrop region. The reporter sends this for invisible surfaces.
  - Absent: a `material: "window"` surface is covered whole with `radius`; any other material gets **no cover** and one warning line. An opaque rectangle over a popup's whole, mostly transparent window would hide whatever is behind it.
- **`slabs[].x`, `.y`, `.dz`**: the element's position in Steam texture pixels and its depth (`lgs_shell.py` already sends these). The slab's world point is the element's position on the surface plus `dz − 0.8 mm` toward the viewer. Without them the slab is centred on the surface at 15 mm.
- **`surfaces[].quad`** (optional) `{"O": [x,y,z], "U": [x,y,z], "V": [x,y,z]}`: the surface's world placement (standing space): position of Steam pixel (0,0) and world steps per Steam pixel to the right and down. When present it replaces the overlay transform (see *Geometry*), for a daemon that can read the placement from the scene graph.
- **`material`** (surfaces and slabs): `window`, `panel`, `liquid`, `thick` or `clear` (see *Materials*). Unknown names render as `window`.
- **Phase** (optional, surfaces and slabs; all backward compatible: without them everything is fully materialized at once, as before):
  - `phase` 0..1 (default 1): the materialize target. glassd animates toward it itself; the daemon writes targets only when they change.
  - `appear: "materialize"`: the first time this surface or slab id is seen, it starts at 0 and ramps to `phase`. Without it a new id appears at `phase` at once.
  - `phaseMs`: a linear ramp of that many ms (a full 0 to 1 sweep) instead of the default curve; `0` jumps.
  - top level `reduceMotion: true`: ramps become a 180 ms coverage fade with every optical term at its target.
  - The curves, the optics ramp and the rules for covers are in [`docs/phase2/glassd-material.md`](../../docs/phase2/glassd-material.md) (*Materialize*). To take a slab away with a dematerialize, set its `phase` to 0, wait for the ramp (350 ms, or 514 ms for `thick`), then remove it.

### glassd.json v3 (Phase 2)

The v3 fields are specified in [`docs/phase2/contracts/glassd.md`](../../docs/phase2/contracts/glassd.md), which is the reference; in short:

- **`surfaces[].plates`** (≤ 32): opaque per-shape glass at the cover's depth, each with its own `material` (`window`, `panel`, `liquid`, `thick`, `clear`, or `dim`, a flat dark plate), `phase`/`appear`/`phaseMs`, `tint`, `fill`, `occluder` (brightness × .55, no light terms, no shadow) and `shadow`. Drawn in the backdrop region after the cover, in spec order, so a windowless route (`shapes: []`) can have glass discs and tiles without a window. Slabs see plates behind them. A plate **over a cover** sees that cover behind it (glass over glass, like a slab; its optics sit 2 mm in front of the cover), so it reads as raised, lighter window glass with its own bezel, not a rim of bent room (R1).
- **Slabs:** `material: "none"` (a cell, nothing drawn), `tint` (green Play, blue Install), `hole` (the popped element's contact shadow clipped to its crop rect, plus a `fill` tone or, better, `edges`: the tones just outside each edge of the crop, so the sliver a pop reveals off axis continues what surrounds it and reads as the control's shadow; over such a fill the shadow follows the control's rounded shape and fades out at the crop's edge, so the crop rect never shows as an outline), `ox`/`oy` (a moved crop's world point).
- **Depths are scene units:** `dz`, `coverDz` and mask `dz` are multiplied by top-level `unitM` (metres per unit, default 0.369). v2 read `dz` as metres.
- **Masks:** surface `masks` (rects in that surface's px, may lie outside it) and top-level `masks` (world quads) are cut out of the room map like the surfaces; ≤ 24 mask quads in all, beyond that the map waits rather than integrate UI.
- `coverDz` (the cover and plates' optical depth; K-G6 keyboard platter behind its keys), `scaleFrom: "overlay"` (trust a popup's own transform).
- **Room dim** (G7, SM-D6, optional): top-level `roomDim` (0..0.9, animated on `sheet-in` / `sheet-out`) folds into every cover's and plate's backdrop dimming; a slab with `material: "dim"` is a flat dark cell (`fill`, default black .30, 8 px feather) that the scene graph can stretch behind the window.
- Colours: `[r, g, b(, a)]` 0..1, `#rgb[a]`, `#rrggbb[aa]`, `rgb(r g b / a)`, `rgba(r, g, b, a)`, or the names `green`, `blue`, `red`, `scrim`. An unparsable colour is ignored and logged once per value.
- The output adds `version: 3`, `caps` (what this binary supports; the daemon sends a field only when its cap is listed) and per surface `plates`, `droppedPlates` (the first 32; `counts` has them all) and `counts`. `caps` includes `holeEdges` from R1 on.

### Output: `glassd-out.json`

```json
{"seq": 4, "pid": 4242, "updated": 1791331200.123, "healthy": true, "fps": 6.0, "gpu_ms": 0.99, "frames": 52,
 "dashboard": true, "last_submit_s": 0.1, "room_ms": 0.34, "room_updates": 222, "feed": "live mmap x2",
 "surfaces": {"main": {"key": "glassd.main", "texW": 1440, "texH": 1632, "backdrop": [0, 0, 1, 0.496324],
                       "backdropScale": 0.75, "cover": 1, "geometry": "steam",
                       "slabs": {"tabs": [0.0, 0.497549, 0.3125, 0.526961]}, "dropped": ["sheet"]}}}
```

- `backdrop` and `slabs` are UV rects in that surface's glassd texture, with v = 0 at the top.
- `seq` echoes the spec.
- **Health**, for the daemon:
  - `healthy`: every visible surface has an overlay that accepts textures (false while one is being recreated, and at exit);
  - `updated`: wall-clock time (s) of this write. The file is rewritten at least every 2 s, so an `updated` older than ~5 s means glassd is stuck;
  - `last_submit_s`: seconds since the last texture reached SteamVR (−1 = never). It grows legitimately while the dashboard is hidden, because nothing renders then;
  - `pid`: glassd's pid.
  The daemon should treat a stale `updated` or `healthy: false` as "not native" (CSS window glass back on).
- `cover`: number of cover shapes drawn (0 = no cover).
- `dropped`: slabs that did not fit the atlas (they are not in `slabs`; their elements stay flat).
- `geometry` (see *Geometry*): `steam` when the latest fetch of the Steam overlay's quad succeeded, `steam(rescaled xF)` for a popup rescaled to the window's scale, `spec` for a `quad` from the spec, `stale(reason)` while the last good quad is kept, `fallback(reason)` for a quad 1.43 m in front of the head.
- **When it is written:**
  - after the first frame rendered for a new layout, so the scene graph never points at empty buffers (or after 0.5 s if nothing could render);
  - after the first frame ever;
  - every 2 s with fresh stats;
  - at exit, with `fps: 0`, `healthy: false` and `"exiting": true`.
- `frames > 0` means glassd has produced frames. Extra fields are informational.

### Overlays

- Each surface has one overlay, `<prefix><name>`, with `VROverlayFlags_IsPremultiplied`. glassd **never calls `ShowOverlay`**: the scene graph references the overlay by key.
- **Texture:** three GBM buffer objects per surface (linear ABGR8888 = bytes R,G,B,A), imported once each with `ImportDmabuf`.
  - glassd renders through an EGLImage renderbuffer, calls `glFinish`, then `SetOverlayTexture(TextureType_SharedTextureHandle, ColorSpace_Gamma)`.
  - `SetOverlayMouseScale(texW, texH)` is set together with the **first texture submitted at a new size**, never ahead of it: the scene graph sizes the panel from it.
  - When the texture size changes, the old buffers are released 0.5 s later.
- **Layout:**
  - Backdrop region: `round(texW × scale) × round(texH × scale)` at the top, where `backdropScale = backdropW / texW` exactly.
  - Slab atlas underneath, with its **final height from the start**: backdrop height + 2 px + the backdrop's height clamped to 256–1024 rows, rounded up to 32 (main: 1440×1632, backdrop V 0.496). The window (`material: window`) gets it at once; other surfaces get it with their first slab (one resize) and keep it, so popups that never pop anything stay backdrop-sized. The texture size, the backdrop UV and the mouse scale therefore never change while the Steam window keeps its size.
  - **Stable cells** (`src/atlas.h`): shelf packing in which a cell, once placed, never moves. New slabs go into free space; a slab that leaves (or changes size) keeps its cell, still drawn, for 0.6 s as a "ghost", so a scene graph that is still showing the old UV sees the right glass, and is then freed. Freed space merges back. A new shelf for a tall cell reserves the tallest height seen so far, so a sheet and cards can later share it.
  - Only when a slab fits nowhere are the ghosts reclaimed early, then the live cells re-packed (logged as `atlas … re-packed`: their UVs change). If it still does not fit, the slab is **dropped**: left out of `slabs`, listed in `dropped`, logged once. Slabs wider than the texture or taller than the atlas are dropped the same way. Nothing is ever announced outside the texture.
  - Each slab is exactly `round(w × scale) × round(h × scale)`, with no margin, and 2 px gutters.
- **Pixels:**
  - premultiplied, sRGB-encoded;
  - opaque inside the rounded shapes, `(0,0,0,0)` outside;
  - texture row 0 is the image top;
  - each frame clears and draws only the backdrop and the live cells (plus their gutters); the rest of a buffer is cleared once.
- **Recovery:** every 2 s glassd checks that its overlays still exist (`FindOverlay` of its own keys). An overlay that vanished, or one whose `SetOverlayTexture` fails with `UnknownOverlay`/`InvalidHandle` or keeps failing for a second, is destroyed and recreated with fresh imports and re-announced after its first frame. Losses within 1 s count as one incident; three incidents within 30 s end glassd with 75. A `vrserver` or `vrcompositor` process that is gone (crash or respawn: the dmabuf imports and overlays belong to it) ends glassd with 75 at once.

## How it works

### Feed (`src/feed.h`)

SteamVR's v4l2cam fills `/dev/video99` **only while a reader is attached**, and every attached second costs it about 18% of a core. So the capture thread attaches on demand:

- **Streaming** while the glass shows (dashboard visible and a surface visible, or `--force`/`--once`): V4L2 mmap with 2 buffers (falls back to `read()`), at most `--feed-hz` frames kept per second.
- **Shots** otherwise: every `1/--idle-hz` s it attaches just long enough for one fresh frame (about 30–60 ms) and detaches (STREAMOFF, buffers released, device closed). `--idle-hz 0` never attaches while hidden.
- The **first buffer after STREAMON is stale**: the loopback hands back the last frame of the previous session (sequence 0), seconds or minutes old, but it would be stamped "now" with today's head pose. Every attach skips it (`tools/feedprobe.cpp` shows this).
- Kept frames are box-downsampled to 480×270 RGBA and timestamped at dequeue; all-black frames are skipped.

### Room model (`src/room.h`, `shaders/room_update.frag`, `push.frag`, `row.frag`, `hfill.frag`, `pull.frag`)

1. **Feed camera.**
   - The calibration comes from `~/.config/liquid-glass-frame/feed.cfg` (`a b c d latency_ms eye`), as written by the Liquid Glass Frame app.
   - Fallback: `u = 0.5617x + 0.4998`, `v = −0.9998y + 0.4997`, 14 ms, right eye.
   - The feed eye pose = HMD pose at `recv − latency`, interpolated from a 1.5 s pose history sampled at about 250 Hz (100 Hz while hidden), × `GetEyeToHeadTransform(eye)`.
2. **Map.** A 1024×512 equirectangular map in standing space; each texel is a direction from the map centre. The centre follows the head with a 10 s time constant. The room is assumed to lie on a 2.2 m sphere. Each texel:
   - projects into the feed (tangent → affine → feed UV), and fades out within 4% of the feed's edge;
   - **is masked** when the feed ray to it crosses a visible Steam surface's world quad, plus `--margin` (see *Masks*);
   - **blends** with an exponential moving average: 0.22 per update while the feed streams (30 frames a second), 0.6 per one-frame shot while the dashboard is hidden (shots are sparse, so each counts more and a changed room is caught within a few shots). A texel seen for the first time takes the feed value outright. Texels that are masked or out of view keep their last good value; nothing ever decays. Alpha records how well the texel is known.
3. **When it integrates.** Never within 0.4 s of a dashboard visibility change (the UI fades in or out, and SteamVR places the window again when the dashboard opens), and never a frame captured before that. While the dashboard shows, only with masks built after that from geometry fetched then, and only if **every** visible spec surface got a mask (`masks=N(incomplete)` in the status line otherwise). Skipped frames are counted (`room=… skipped`).
4. **Fill** (texels never seen, e.g. the room behind a dashboard that never closed):
   - a push-pull pyramid (RGBA16F) gives low-frequency colour from the known texels around (a dark grey before anything is known);
   - a **row fill** (`row.frag`, `hfill.frag`) averages the known room per row in 32 azimuth sectors of 11.25°, then continues each row from the nearest known sectors to its left and right, interpolated by distance. Rooms are mostly horizontal structure (floor, desk, wall, ceiling), so the hole behind the window continues the wall beside it at the same height. An unknown texel takes 75 % of the row fill and 25 % of the push-pull;
   - the filled map keeps **alpha = how well the texel is known**, so the glass can tell measured room from fill (more frost there, the room's mean hue, a stronger sheen: *Glass*).
   The result is an sRGB, mipmapped, horizontally wrapping texture that the glass samples.

The map takes a shot every 5 s while the dashboard is hidden, plus two shots 0.6 s and 2 s after it hides (the wearer still faces where the window was, so these see the room it hid). When the dashboard opens, the room behind the window is then already known, although the window hides it from the feed.

### Masks

Rebuilt every 250 ms (and right after the grace period of a dashboard change) while the dashboard is visible, from geometry **fetched at that moment**:

- every visible spec surface (main first);
- Steam's `main`, `bar`, `floatingfooter`, `keyboard`, `notifications` and `volumelevel` overlays when visible and not already masked (this also covers a spec surface whose own fetch failed);
- the main window also gets the `--zone`, because SteamVR's own panels (grab bar, frame controls, frame menus, side panels) sit around it and glassd cannot see them;
- a rescaled popup (below) is masked at both its reported and its rescaled quad, with twice the margin.

### Geometry

- A surface's world quad comes from `GetTransformForOverlayCoordinates` on its Steam overlay at corners (0,0), (mw,0), (0,mh) in mouse-scale pixels, origin bottom-left; or from the spec's `quad`.
- **Fresh:** fetched for every render while the dashboard shows and for every mask build. Priming renders while the dashboard is hidden do not fetch; they use the last quad or a fallback.
- **Handles:** found with `FindOverlay` every 1 s while unknown, re-validated every 2 s (Steam's overlays come back with new handles after a Steam restart), and dropped as soon as a fetch errors (a stale handle answers `VROverlayError` 11).
- **Plausibility:** a quad is rejected when its centre is at the origin (a hidden or unplaced overlay answers in overlay-local coordinates), not 0.3–5 m from the head, or edge-on to it (|cos| < 0.2).
- A rejected or failed fetch keeps the last good quad for rendering (`stale(…)`), or uses a quad 1.43 m in front of the head (`fallback(…)`); masks never use either.
- **Popups use the window's scale.** Steam's popups report overlay transforms whose *size* disagrees with what the scene graph draws: the bar claims 1800 px over 0.37 m (0.2 mm/px) and the footer 900 px over 0.37 m, against main's 0.51 mm/px, although their scene-graph panels (`PooledPopup-…`) use the same metres-per-pixel `M` as the window. For a non-main surface whose scale differs from main's by more than 8%, glassd keeps the reported centre and orientation and uses main's metres-per-pixel (`steam(rescaled x2.50)` for the bar). Checked against the feed on 2026-10-07 (headset resting, dashboard open): the bar's icons spanned feed u 0.47–0.82; the rescaled quad's visible part predicted 0.48–0.79, the reported quad's 0.57–0.70; its height matched. A user-resized main window would change main's scale but probably not the bar's; the spec's `quad` is the way to give exact placements.

### Glass (`shaders/glass.frag`, material v2)

The full model, its parameters and the before/after evidence are in [`docs/phase2/glassd-material.md`](../../docs/phase2/glassd-material.md). In short: **no term draws a line of constant width**; every edge cue comes from the glass's shape and one light.

One fullscreen draw per piece of glass: first the cover (the union of its shapes) in the backdrop region, then each slab in its atlas cell. For every texel:

- **Shape.** Signed distance and its analytic gradient from the nearest of up to 8 rounded rects (the union's outline).
- **World point.** On the surface quad: the element offset plus `dz` for slabs.
- **Bezel.** A squircle `h = (1 − (1 − t)⁴)^¼` over the bezel width (never wider than the corner radius, so corners stay smooth). Its slope tilts the normal.
- **What is behind.** The view ray (head pose predicted 20 ms ahead), bent by the bezel like a prism (Snell at the curved face and the flat back, n = 1.5, toward the thick side), meets the room sphere, or for a slab (and a plate over a cover) the **cover behind it**: the cover's quarter-resolution pass (below; mipmapped, transparent border), so a slab on the window shows window glass, and an ornament straddling the window's edge shows that edge through its own bezel. The copy is read with nine taps (the centre and a ring of eight) at a finer mip, so a small plate behind a slab blurs round, never into a square (R1). The interior is not bent. Frost is a mip level (4 rotated taps), lower in the lens band so the bend shows; R and B bend 2 % less and more (dispersion), with the same filter.
- **Tone.** The frosted room is pulled toward a luminance band around L 80 of 255 (DESIGN2 §6.3), keeping a material-dependent share of the room's swing and all of its hue, then mixed toward a neutral of the same luminance by the tint. Glass over glass adds half its tint and sits slightly lighter. The lens band keeps more of the room (a polished bevel).
- **Unknown room** (the map's alpha): one mip more frost, a little more tint toward the known room's mean hue, a stronger top-down sheen.
- **Light.** One key light fixed in the world (from above, about 20° left of vertical, a little in front), the same for every surface:
  - a Blinn-Phong highlight where the bezel normal faces it: a thin crescent on the top edge, brightest at the upper-left corner, fading to nothing down the sides;
  - a weaker transmitted highlight on the opposite (lower-right) rim;
  - Fresnel reflection of the room on the grazing outer bezel, weighted toward the lit side;
  - a top-down sheen across the shape.
- **Shade.** A soft darkened band inside the edge, strongest away from the light (E4); occlusion just inside the lower edge (E5); on a cover, the soft shadows of the slabs in front of it (offset 0.3 × `dz`, i.e. VP P-48's 0.4 CSS px per mm, softness 3 mm + 0.4 × `dz`; only for slabs whose element held still for 150 ms, never under the slab itself); outside a cover's shapes, where the texture has room, an optional contact shadow.
- **Output.** Antialiased coverage × the materialize alpha, premultiplied, sRGB-encoded.
- **Two passes for covers.** The interior is very low frequency, so pass 1 renders the cover at 1/4 resolution (RGBA16F, linear, premultiplied by coverage) and pass 2 runs the whole shader only within the edge band (the bezel or 1.6 × the darkened band, plus 1.5 low-resolution texels; about 54 Steam px on the window) and reads pass 1 inside it (level 0 explicitly: an implicit level in that branch read the copy's unbuilt mips as black dashes inside the corners of a cover without slabs, R1). Pass 1, mipmapped, is also what slabs see behind them. `--debug-view` renders covers in one pass.

Material widths are converted to pixels with the **main window's** metres per pixel for every surface (see *Geometry*).

### Materials (at `dial` 0.5, at each preset's reference size)

| | tint | frost / band frost (mip) | bezel | lens at rim | key spec | tone swing kept | slab shadow | use |
|---|---|---|---|---|---|---|---|---|
| `window` | 0.50 | 3.6 / 1.2 | 20 mm | 2.0° | 0.70 | 30 % | — | The Steam window, SteamVR settings and Now Playing |
| `panel` | 0.40 | 3.4 / 1.0 | 12 mm | 3.0° | 0.80 | 35 % | 0.24 | Popup quads over the room |
| `thick` | 0.30 | 4.0 / 1.2 | 14 mm | 2.5° | 0.75 | 32 % | 0.28 | Menus, sheets, alerts, the keyboard platter |
| `liquid` | 0.14 | 1.3 / 0.3 | 16 mm | 7.0° | 0.90 | 60 % | 0.22 | Ornaments, toolbars, bar segments, floating controls |
| `clear` | 0.06 | 0.6 / 0.1 | 16 mm | 9.0° | 0.90 | 75 % | 0.20 | Over media only: dims what is behind by 35 % |

- **Size changes the material** (bible P5): thickness θ from the shape's shorter side (0 at 44 px, 0.5 at 176 px, 1 at ≥ 704 px) shifts each preset from its reference θ: bigger glass is frostier (+0.8 mip per unit θ), more tinted, lenses less, has a dimmer highlight and deeper shading and shadow; smaller glass the reverse.
- The dial scales tint ×0.7 → ×1.3, frost −1 → +1 mip, and tightens the tone band.
- One map texel is 0.35°, so mip 3.6 is a blur of about 4°.
- All values live in `materialPreset()` and `materialFor()` in `src/glassd.cpp`.

### Phase (materialize)

Each cover and slab has a materialize progress `m`, animated toward the spec's `phase` (see *Input*): a linear 250 ms ramp up and 350 ms down for small glass (MO `materialize-in/out`), the `sheet-in` / `sheet-out` springs (d 0.5 / 0.35, bounce 0, closed form, retargetable) for covers and `thick` slabs. `m` drives the optics in order (MO §9): highlights over 0–0.6, lensing over 0–0.7, frost and tint over 0.2–0.92, shading over 0.3–0.92, shadows over 0.4–1, coverage `smoothstep(0, 0.3, m)`. glassd renders at full rate while any ramp moves and goes back to on-demand rendering when all have settled.

### Scheduling

- **Dashboard visible** (`IsDashboardVisible`) and a surface visible:
  - glassd renders when the head moves (> 0.08° or 1 mm), the layout changes or a materialize ramp moves, up to `--fps`;
  - room-map changes alone re-render at most at about 6 Hz.
- **Dashboard hidden:**
  - one priming frame after any layout change (no geometry fetch), nothing else;
  - a one-frame feed shot every `1/--idle-hz` s, plus two shots 0.6 s and 2 s after the dashboard hides.
- The loop wakes at once on a spec change (inotify), otherwise every 4 ms while active and 10 ms while hidden.
- **Status line** every 5 s, for example:

```
dash=1 surfaces=3/3 fps=6.2 gpu=0.88ms cpu=2.24ms room=30.0/s (0.35ms, 10 skipped) feed=live mmap x2 90/s attached=100% known=3% lum=0.14 env=0.12 masks=5 slabs=1+0 fading, 0 dropped geo=main:steam,bar:steam(rescaled x2.50),floatingfooter:steam(rescaled x1.25)
```

- `gpu` comes from `GL_EXT_disjoint_timer_query`; `(cpu+finish)` is shown when timer queries are unavailable.
- `attached` is the share of time the feed was attached; `known` is the fraction of the map seen so far.

## Measured on the Frame (2026-10-07, Adreno 750 via zink)

CPU in % of one core, from `/proc/<pid>/stat` over 10 s, with no other feed reader (`tools/test_feedcost.sh`, two runs):

| State | v4l2cam | glassd | Notes |
|---|---|---|---|
| No glassd | 0 | — | v4l2cam idles without a reader |
| Dashboard hidden, default (`--idle-hz 0.2`) | 1.2 | 0.6 | about 60 ms of v4l2cam CPU per shot; feed attached 1% of the time |
| Dashboard hidden, `--idle-hz 2` | 9–11 | 1.2–1.5 | attached 7% |
| Dashboard hidden, `--idle-hz 0` | 0 | 0.4–0.7 | |
| Glass showing (streaming) | 18.6–19.1 | 6.5–7.5 | vrcompositor +2 points; renders at 6 Hz with the headset still |

The previous version streamed for its whole lifetime: v4l2cam 18% even while hidden.

| What | Result |
|---|---|
| Render, material v1, `main` 1440×810 backdrop + 2–3 slabs, bar, footer | 0.9–1.7 ms GPU (timer queries); 2.2–2.7 ms CPU including `glFinish` |
| Render, **material v2**, `--bench` over the test room (2026-10-07, after the SteamOS 20261006 update; median of about 800 frames at 72 fps, GPU clock as the governor chose it) | window cover alone 0.95 ms (629 MHz); window + 6 slabs 1.52 ms (680 MHz); the full test scene (window, 6 slabs, a bar of 2 capsules) 1.69 ms (680 MHz), i.e. 1.27 ms scaled to 903 MHz. Material v1 on the same scene: 1.27 ms (629 MHz). See `docs/phase2/glassd-material.md` |
| Live in `lgs on --native` (window with 6 slabs, bar, footer; headset idle) | status-line EMA 1.9–2.5 ms; the EMA includes frames that overlap the compositor's own GPU work (next row) |
| Frame-time distribution | two modes: about 80 % of frames at the cost above (1.0–2.0 ms for the full scene), 15–20 % at 3.5 ms or more. The second mode is the compositor's GPU work interleaved with ours: `GL_TIME_ELAPSED` counts it. It is as frequent for v1 (p90 3.6 ms) and grows with job length |
| Room update (upload, map, push-pull, mips) | 0.3–0.6 ms GPU, about 30/s while showing (v1); 0.4–1.0 ms with the row fill (v2, live) |
| Spec → `glassd-out.json` | median 2.1 ms, p95 4.2 ms, max 6.6 ms (600 random slab changes, `tools/test_atlas.py`); material v2: median 2.1 ms, p95 4.3 ms, max 10.6–16.7 ms (300 and 900 changes) |
| Atlas churn (600 random focus moves, cards, buttons, a 900×700 sheet) | 0 live slabs moved, 0 overlaps, 0 UVs outside the texture, 0 texture resizes, 0 re-packs |
| Leaks over that churn | vrcompositor fds and dmabufs and glassd's fds and RSS (60 MB) flat; material v2 over 900 changes: glassd 86 fds and 64 MB before and after |
| Materialize timing (`tools/test_phase.sh`) | 0.10 s after `phase` 0 → 1: liquid slabs 0.41 (linear 250 ms), window and menu 0.36 (sheet-in spring; closed form 0.358); 0.38 s: spring 0.956 (closed form 0.953) |
| Feed | mmap with 2 buffers, about 90 frames/s delivered while streaming, 30/s kept |
| **v3 Phase 2 scenes** (`tools/test_bench.sh 15`, test room, 72 fps, GPU clock median 903 MHz in every scene) | Home 19 plates + 1 slab 0.86 ms (p90 1.19); library cover + plate + 3 slabs 1.35 ms; Control Center 4 plates 0.96 ms; keyboard 1.59 ms (p90 3.65). All ≤ 2.5 ms (GL-3). R1 build (nine-tap cover copy, plates over a cover see it): library 1.72 ms, keyboard 1.98 ms, Home 1.03 ms, Control Center 1.00 ms at 903 MHz; the nine taps cost about 0.3 ms in the slab-heavy scenes (a five-tap variant saved 0.15 ms but left a visible X in a slab over a plate) |

## Verifying without the headset

All tools use a test key prefix and private output paths, so they run next to a live daemon. Build them with `build.sh`; run them on the Frame. Their fixtures live under `/tmp/lgs/p9-fx/<test>/` (RAM, removed on any exit; the Python tests write no `__pycache__`).

| Tool | Checks |
|---|---|
| `tools/test_atlas.py [N]` | Adding a slab moves nothing; N random focus moves: no live slab moves, no overlaps, nothing outside the texture, texture size constant; spec → out latency; dmabuf/fd/RSS leaks |
| `tools/test_shapes.py` | Union of two overlapping capsules has no holes; `shapes: []` and a panel without shapes draw nothing; a window without shapes is covered; oversize slabs are dropped and listed. No feed: the dumps are grey and deleted |
| `tools/test_locks.sh` | Two instances on one `--out` or one key prefix: the second exits 75; a test prefix writes its own out file; a SIGKILLed parent takes glassd with it; `--orphan-ok` |
| `tools/test_geometry.sh` | With `build/fakeov` (a texture-less overlay, nothing visible): a hidden overlay's origin quad is rejected; the shown one is accepted; after destroy and re-create (new handle) glassd follows it; then `stale(…)` |
| `tools/test_live.sh` | Against Steam's real overlays with the feed: geometry notes, masks, the dashboard-change grace, health fields; SIGUSR2 overlay recovery; exit 75 after three losses |
| `tools/test_feedcost.sh` | v4l2cam / vrcompositor / glassd CPU while hidden (shots at three rates) and while streaming. Needs no other feed reader (the Liquid Glass Frame app also streams) |
| `build/feedprobe [sessions ms gap buffers]` | How the loopback behaves on short attaches (stale first buffer, time to the first fresh frame). Prints numbers only |
| `build/inview` | Where Steam's window and bar corners land in the feed (u, v) for the current head pose. Prints numbers only |
| `tools/test_phase.sh` | Materialize timing: flips every piece of glass from `phase` 0 to 1 and back, logs the displayed phase at fixed delays (no camera, nothing shown) |
| `tools/test_shapes.py` (v3 part, GL-1) | 35 plates of six materials on a windowless surface: 32 drawn and listed, 3 dropped and listed; plates opaque, gaps empty; the occluder ≈ .55 of its twin; the `dim` plate translucent; a hole's fill only inside its crop; a `none` cell empty; a green-tinted slab green. R1: no opaque near-black texel in a window cover without slabs; a surface mask and a world mask each hide more of the room map (`room-hole`); a slab's cell changes with `coverDz` |
| `tools/test_holes.py` (GL-2, R1) | The hero stand-in's holes in numbers: renders `tools/test_holes.json` with and without the cut-outs, head-on and off axis, and measures each sliver's dL against the art it hides, beside the control (shape), in the crop's corners and along its edge (rim). PASS with edge tones: no bracket, no rim line, a shadow never lighter than the art |
| `tools/test_bench.sh [SECONDS]` (GL-3) | GPU median per frame for the Phase 2 scenes in `tools/bench/` (Home 19 plates + 1 slab, library, Control Center 4 plates, keyboard) over the test room; PASS ≤ 2.5 ms |
| `tools/test_fake.py` (GL-6) | `native/spike/fakeglassd` against the v3 contract: output fields and caps, plate limits, the painted plates, holes, tints and `none` cells |
| `tools/test_material.sh [DIR] [args]` | The material over the procedural test room (no camera, so the dumps may be kept): `tools/test_material.json` (the window with a circle, a capsule, a primary capsule, a menu, a side ornament and a toolbar straddling its bottom edge, plus a bar of liquid capsules below it) over `room`, `room-hole` (the room behind the UI unknown), `stripes` (a lensing chart) and `room-offaxis` (eye 0.35 m right, 0.1 m up). Writes `DIR/<backdrop>/{main,bar}.png` and `…-view.png`. Extra args go to glassd, e.g. `--phase 0.35` or `--debug-view 1`. v3 (GL-2): `holes{,-offaxis}` (`tools/test_holes.json` with `--view-content hero`: tinted Play with a hole, cluster circles with holes, a blue primary, a moved crop without a hole) and `plates{,-offaxis}` (`tools/test_plates.json`: windowless Home, 19 plates, the focused cell over its occluder plate); R1: `platecover{,-offaxis}` (`tools/test_platecover.json`: plates over the window cover) |

```sh
mkdir -p /tmp/lgs/t
./glassd --demo --key-prefix glassd-test. --out /tmp/lgs/t/out.json --once --warmup 3 \
         --dump /tmp/lgs/t/d --dump-room /tmp/lgs/t/room.png    # look, then: rm -rf /tmp/lgs/t
./glassd --demo --no-mask --debug-view 1 ...   # backdrop only: the feed's view lands on the window
./glassd --spec tools/test_material.json --key-prefix glassd-test. --out /tmp/lgs/t/out.json --once --warmup 0          --test-backdrop room --dump /tmp/lgs/t/d --dump-view   # no camera: safe to keep
./glassd --spec tools/test_material.json --key-prefix glassd-test. --out /tmp/lgs/t/out.json          --test-backdrop room --bench --timeout 15               # GPU ms per frame at --fps (status lines)
/opt/steamvr/bin/linuxarm64/vrcmd --overlays | grep -A1 glassd
```

- `vrcmd` prints **no size** for an overlay without a texture and **`0x0`** once a dmabuf shared texture is set, the same as Steam's own panels.
- `IVROverlayView` (`build/ovgrab`, hvgrab) returns `RequestFailed` for dmabuf overlays, ours and Steam's alike, so the compositor's copy cannot be read back.
- `--debug-view 1` with `--no-mask` and a low-frost spec (material `liquid`, `dial` 0) shows each surface as the feed sees it, registered on the surface's own texture. That checks calibration, pose history, the map and the surface quad together, including a popup's rescaled quad.

## Files

| Path | What |
|---|---|
| `src/glassd.cpp` | Options, spec and output, overlays and dmabufs, layout, geometry, masks, materials and phase, scheduling, health, dumps and views |
| `src/atlas.h` | Stable shelf allocator for slab cells |
| `src/gfx.h` | GBM, EGL, GLES context; targets; programs; dmabuf render targets |
| `src/feed.h` | V4L2 capture thread (attach on demand), feed calibration |
| `src/room.h` | Room map: integrate, push-pull and row fill, the test room, stats |
| `src/json.h`, `src/vmath.h` | Minimal JSON reader; vectors and poses |
| `shaders/` | `common.glsl`, `fullscreen.vert`, `room_update.frag`, `push.frag`, `row.frag`, `hfill.frag`, `pull.frag`, `glass.frag`; for verification `testroom.glsl` (the procedural room), `testroom.frag`, `view.frag` (embedded at build time) |
| `tools/` | Verification tools and tests (above), `test_material.json` (the material test spec); `ovgrab.cpp` reads an overlay back through `IVROverlayView` |
| `third_party/stb_image_write.h` | PNG writer (public domain) |
