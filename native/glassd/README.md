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
| `--debug-view N` | 0 | Debug shading: 1 backdrop only, 2 light only, 3 bezel (`t`, rim `t`, slope), 4 room-map UV |

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

### Room model (`src/room.h`, `shaders/room_update.frag`, `push.frag`, `pull.frag`)

1. **Feed camera.**
   - The calibration comes from `~/.config/liquid-glass-frame/feed.cfg` (`a b c d latency_ms eye`), as written by the Liquid Glass Frame app.
   - Fallback: `u = 0.5617x + 0.4998`, `v = −0.9998y + 0.4997`, 14 ms, right eye.
   - The feed eye pose = HMD pose at `recv − latency`, interpolated from a 1.5 s pose history sampled at about 250 Hz (100 Hz while hidden), × `GetEyeToHeadTransform(eye)`.
2. **Map.** A 1024×512 equirectangular map in standing space; each texel is a direction from the map centre. The centre follows the head with a 10 s time constant. The room is assumed to lie on a 2.2 m sphere. Each texel:
   - projects into the feed (tangent → affine → feed UV), and fades out within 4% of the feed's edge;
   - **is masked** when the feed ray to it crosses a visible Steam surface's world quad, plus `--margin` (see *Masks*);
   - **blends** with an exponential moving average: 0.22 per update, but a texel seen for the first time takes the feed value outright. Unknown texels keep their last value. Alpha records how well the texel is known.
3. **When it integrates.** Never within 0.4 s of a dashboard visibility change (the UI fades in or out, and SteamVR places the window again when the dashboard opens), and never a frame captured before that. While the dashboard shows, only with masks built after that from geometry fetched then, and only if **every** visible spec surface got a mask (`masks=N(incomplete)` in the status line otherwise). Skipped frames are counted (`room=… skipped`).
4. **Fill.** A push-pull pyramid (RGBA16F) fills texels that were never seen with low-frequency colour from the known ones (a dark grey before anything is known). The result is an sRGB, mipmapped, horizontally wrapping texture that the glass samples.

The map takes a shot every 5 s while the dashboard is hidden, so when the dashboard opens the room behind the window is already known, although the window then hides it from the feed.

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

### Glass (`shaders/glass.frag`, ported from `vr/shaders/glass.frag`)

One fullscreen draw per piece of glass: the cover (the union of its shapes) in the backdrop region, and each slab in its atlas cell. For every texel:

- **Shape.** The signed distance is the minimum over the shapes (up to 8), so coverage, bezel and rims follow the union's outline; magnification and sheen span the union's bounding box.
- **World point.** The texel's world point is computed on the surface quad: the element offset plus `dz` for slabs.
- **Backdrop.** The view ray from the head (pose predicted 20 ms ahead) hits the room sphere and samples the map with a 4-tap frosted lookup at the material's mip level.
- **Squircle bezel.** `h = (1 − (1 − t)⁴)^¼` tilts the normal and drives lensing: an inward shift in panel space (the same in both eyes) plus slight interior magnification.
- **Dispersion.** R and B are sampled at ± the bezel shift, only where the bezel bends the ray.
- **Adaptive tint.** Room luminance behind the glass (mip 6.5) drives the tint: over bright rooms the tint is darker and stronger (`tintA × 1.45`); over dark rooms it is lighter (`× 0.75`).
- **Inner shadow.** A darkened band just inside the rim.
- **Light from above.**
  - Fresnel and key specular;
  - a key rim on the top edge and a 0.4× fill rim on the bottom edge;
  - a crisp edge line;
  - a top-down sheen.
  The rim and inner-shadow widths are independent of the bezel, so 30 mm capsules still get a slim rim.
- **Output.** Antialiased coverage, premultiplied.

Material widths are converted to pixels with the **main window's** metres per pixel for every surface (see *Geometry*).

### Materials (at `dial` 0.5)

| | tint | frost (mip) | bezel | lens shift | dispersion | rim | rim width |
|---|---|---|---|---|---|---|---|
| `window` | 0.55 | 3.6 | 20 mm | 6 mm | 0.25 | 0.6 (soft) | 12 mm |
| `panel` | 0.50 | 3.4 | 12 mm | 4 mm | 0.20 | 0.7 | 7 mm |
| `liquid` | 0.18 | 1.4 | 16 mm | 16 mm | 0.35 | 1.2 (bright) | 5 mm |
| `thick` | 0.45 | 4.2 | 14 mm | — | — | 0.7 | 8 mm |

- The dial scales tint ×0.7 → ×1.3 and frost −1 → +1 mip.
- One map texel is 0.35°, so mip 3.6 is a blur of about 4°.
- The values live in `materialFor()` in `src/glassd.cpp`.

### Scheduling

- **Dashboard visible** (`IsDashboardVisible`) and a surface visible:
  - glassd renders when the head moves (> 0.08° or 1 mm) or the layout changes, up to `--fps`;
  - room-map changes alone re-render at most at about 6 Hz.
- **Dashboard hidden:**
  - one priming frame after any layout change (no geometry fetch), nothing else;
  - a one-frame feed shot every `1/--idle-hz` s.
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
| Render, `main` 1440×810 backdrop + 2–3 slabs, bar, footer | 0.9–1.7 ms GPU (timer queries); 2.2–2.7 ms CPU including `glFinish` |
| Room update (upload, map, push-pull, mips) | 0.3–0.6 ms GPU, about 30/s while showing |
| Spec → `glassd-out.json` | median 2.1 ms, p95 4.2 ms, max 6.6 ms (600 random slab changes, `tools/test_atlas.py`) |
| Atlas churn (600 random focus moves, cards, buttons, a 900×700 sheet) | 0 live slabs moved, 0 overlaps, 0 UVs outside the texture, 0 texture resizes, 0 re-packs |
| Leaks over that churn | vrcompositor fds and dmabufs and glassd's fds and RSS (60 MB) flat |
| Feed | mmap with 2 buffers, about 90 frames/s delivered while streaming, 30/s kept |

## Verifying without the headset

All tools use a test key prefix and private output paths, so they run next to a live daemon. Build them with `build.sh`; run them on the Frame.

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

```sh
mkdir -p /tmp/lgs/t
./glassd --demo --key-prefix glassd-test. --out /tmp/lgs/t/out.json --once --warmup 3 \
         --dump /tmp/lgs/t/d --dump-room /tmp/lgs/t/room.png    # look, then: rm -rf /tmp/lgs/t
./glassd --demo --no-mask --debug-view 1 ...   # backdrop only: the feed's view lands on the window
/opt/steamvr/bin/linuxarm64/vrcmd --overlays | grep -A1 glassd
```

- `vrcmd` prints **no size** for an overlay without a texture and **`0x0`** once a dmabuf shared texture is set, the same as Steam's own panels.
- `IVROverlayView` (`build/ovgrab`, hvgrab) returns `RequestFailed` for dmabuf overlays, ours and Steam's alike, so the compositor's copy cannot be read back.
- `--debug-view 1` with `--no-mask` and a low-frost spec (material `liquid`, `dial` 0) shows each surface as the feed sees it, registered on the surface's own texture. That checks calibration, pose history, the map and the surface quad together, including a popup's rescaled quad.

## Files

| Path | What |
|---|---|
| `src/glassd.cpp` | Options, spec and output, overlays and dmabufs, layout, geometry, masks, materials, scheduling, health, dumps |
| `src/atlas.h` | Stable shelf allocator for slab cells |
| `src/gfx.h` | GBM, EGL, GLES context; targets; programs; dmabuf render targets |
| `src/feed.h` | V4L2 capture thread (attach on demand), feed calibration |
| `src/room.h` | Room map: integrate, push-pull fill, stats |
| `src/json.h`, `src/vmath.h` | Minimal JSON reader; vectors and poses |
| `shaders/` | `common.glsl`, `fullscreen.vert`, `room_update.frag`, `push.frag`, `pull.frag`, `glass.frag` (embedded at build time) |
| `tools/` | Verification tools and tests (above); `ovgrab.cpp` reads an overlay back through `IVROverlayView` |
| `third_party/stb_image_write.h` | PNG writer (public domain) |
