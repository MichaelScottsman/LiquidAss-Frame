# glassd: native glass for Glass Shell

`glassd` renders the parts of the visionOS look that CSS cannot: window glass that frosts and lenses the **room** behind Steam's panels, and Liquid Glass slabs under elements that pop forward in stereo depth. The architecture and interfaces are in [`docs/NATIVE.md`](../../docs/NATIVE.md); this file covers the program itself.

It is a C++17 program built on the Frame. The stack is GBM, surfaceless EGL and GLES 3.2 (Mesa zink on Turnip), rendering into dmabufs that SteamVR imports. It has no window and no X.

## Build and run

On the Frame:

```sh
sh build.sh                 # -> ./glassd (and build/ovgrab, a verification tool)
DEBUG=1 sh build.sh         # -O0 -g
```

From the PC: `python glass.py sync && python glass.py native-build` builds `~/.local/share/glass-shell/native/glassd/glassd`, which is where `lgs-shell` looks for it.

The build needs `openvr.h` v2.15.6 (with `IVRIPCResourceManagerClient::ImportDmabuf`). `build.sh` uses frametop's copy at `~/frametop/screens/build/include`, or downloads that tag into `build/include`. It links SteamVR's own `/opt/steamvr/bin/linuxarm64/libopenvr_api.so`.

`device/lgs_shell.py` normally starts glassd as a child process. Extra arguments come from `LGS_GLASSD_ARGS`. stdout carries status lines for the unit's journal. glassd:

- refuses to start if SteamVR (`vrserver`) is not running, so it never launches SteamVR;
- runs as one instance per key prefix (an `flock` on `<out dir>/glassd.lock`);
- exits cleanly on SIGTERM, SIGINT, SIGHUP or SteamVR's `VREvent_Quit`, destroying its overlays (about 25 ms).

### Options

| Option | Default | Meaning |
|---|---|---|
| `--spec FILE` | `/dev/shm/lgs/glassd.json` | Spec to follow, re-read when its mtime, size or inode changes (polled at 10 Hz). A half-written file is ignored and retried |
| `--out FILE` | `/dev/shm/lgs/glassd-out.json` | Layout and stats output (atomic tmp + rename) |
| `--demo` | | Built-in spec instead of `--spec`: main window plus 3 slabs (the NATIVE.md example) |
| `--once` | | Integrate the feed for `--warmup` s, render every surface once, write dumps, exit |
| `--dump DIR` | | Write every surface texture to `DIR/<name>.png` after warm-up (straight alpha) |
| `--dump-room PATH` | | Write the filled room map to `PATH` and the "known" mask to `PATH-known.png` |
| `--force` | | Render even while the dashboard is hidden |
| `--scale S` | 0.75 | `backdropScale` |
| `--fps N` | 72 | Maximum render rate while visible |
| `--feed-hz N` / `--idle-hz N` | 36 / 2 | Room-map updates per second while the dashboard is visible / hidden (`--idle-hz 0` = none) |
| `--warmup S` | 3 | Feed seconds before `--once` or `--dump` output |
| `--margin M` | 0.06 | Feed mask margin around every Steam surface (m) |
| `--zone S,T,B` | 0.15,0.08,0.25 | Extra mask around the main window: side, top, bottom (m). See *Room model* |
| `--key-prefix P` | `glassd.` | Overlay key prefix. Use e.g. `glassd-test.` for tests next to a running daemon |
| `--shaders DIR` | built in | Load shaders from DIR (for tuning without rebuilding) |
| `--feed DEV` / `--no-feed` | `/dev/video99` | Passthrough feed device |
| `--timeout S` | | Exit after S seconds |
| `--dash on\|off\|auto` | auto | Test override for `IsDashboardVisible` |
| `--no-mask` | | Debug: integrate the feed without masking the UI |
| `--debug-view N` | 0 | Debug shading: 1 backdrop only, 2 light only, 3 bezel (`t`, rim `t`, slope), 4 room-map UV |

`kill -USR1 <pid>` writes the room map and every surface to the `--dump` paths. Without them it writes to `/tmp/lgs/glassd-dump/`.

**Privacy:** room-map and surface dumps show the user's room. Look at them, then delete them. Never keep or upload them. Feed frames stay in RAM.

## Interfaces

### Input: `glassd.json`

The fields follow NATIVE.md: `seq`, `dial`, `surfaces[]` with `name`, `overlayKey`, `texW`, `texH`, `radius`, `material`, `visible`, `slabs[]` (`id`, `w`, `h`, `r`, `material`).

Optional fields that glassd also reads:

- **`slabs[].x`, `.y`, `.dz`**: the element's position in Steam texture pixels and its depth (`lgs_shell.py` already sends these). The slab's world point is the element's position on the surface plus `dz − 0.8 mm` toward the viewer. Without them the slab is centred on the surface at 15 mm.
- **`surfaces[].shapes`** `[{x, y, w, h, r}]`: the cover's rounded shapes in Steam texture pixels. Use it for surfaces whose glass is not the whole texture, such as bar segments or a popup card smaller than its window. Outside the shapes the cover is transparent. The default is one shape covering the whole texture with `radius`.

### Output: `glassd-out.json`

```json
{"seq": 4, "fps": 6.0, "gpu_ms": 0.99, "frames": 52, "dashboard": true, "room_ms": 0.34, "room_updates": 222,
 "feed": "live mmap x2",
 "surfaces": {"main": {"key": "glassd.main", "texW": 1440, "texH": 864, "backdrop": [0, 0, 1, 0.9375],
                       "backdropScale": 0.75, "geometry": "steam",
                       "slabs": {"tabs": [0.0, 0.939815, 0.3125, 0.99537]}}}}
```

- `backdrop` and `slabs` are UV rects in that surface's glassd texture, with v = 0 at the top.
- `seq` echoes the spec.
- **When it is written:**
  - after the first frame rendered for a new layout, so the scene graph never points at empty buffers (or after 0.5 s if nothing could render);
  - after the first frame ever;
  - every 2 s with fresh stats;
  - at exit, with `fps: 0` and `"exiting": true`.
- `frames > 0` means glassd is producing frames.
- `geometry` is `steam` when the world quad came from SteamVR, or `fallback(...)` for a quad 1.43 m in front of the head.
- Extra fields are informational.

### Overlays

- Each surface has one overlay, `<prefix><name>`, with `VROverlayFlags_IsPremultiplied` and `SetOverlayMouseScale(texW, texH)`. glassd **never calls `ShowOverlay`**: the scene graph references the overlay by key.
- **Texture:** three GBM buffer objects per surface (linear ABGR8888 = bytes R,G,B,A), imported once each with `ImportDmabuf`.
  - glassd renders through an EGLImage renderbuffer, calls `glFinish`, then `SetOverlayTexture(TextureType_SharedTextureHandle, ColorSpace_Gamma)`.
  - When the texture size changes, the old buffers are released 0.5 s later.
- **Layout:**
  - Backdrop region: `round(texW × scale) × round(texH × scale)` at the top, where `backdropScale = backdropW / texW` exactly.
  - Slab atlas underneath: shelf-packed by height, then id, with 2 px gutters.
  - Each slab is exactly `round(w × scale) × round(h × scale)`, with no margin.
  - The texture height rounds up to 32 px when slabs exist.
- **Pixels:**
  - premultiplied, sRGB-encoded;
  - opaque inside the rounded shapes, `(0,0,0,0)` outside;
  - texture row 0 is the image top.

## How it works

### Room model (`src/feed.h`, `src/room.h`, `shaders/room_update.frag`, `push.frag`, `pull.frag`)

1. **Capture thread.**
   - Streams `/dev/video99` with V4L2 mmap buffers (falls back to `read()`) and skips all-black frames.
   - Processes at most `--feed-hz` frames per second (2/s while the dashboard is hidden). Other frames are only re-queued.
   - Box-downsamples to 480×270 RGBA and timestamps each frame at dequeue.
2. **Feed camera.**
   - The calibration comes from `~/.config/liquid-glass-frame/feed.cfg` (`a b c d latency_ms eye`), as written by the Liquid Glass Frame app.
   - Fallback: `u = 0.5617x + 0.4998`, `v = −0.9998y + 0.4997`, 14 ms, right eye.
   - The feed eye pose = HMD pose at `recv − latency`, interpolated from a 1.5 s pose history sampled at about 200 Hz (about 90 Hz while hidden), × `GetEyeToHeadTransform(eye)`.
3. **Map.** A 1024×512 equirectangular map in standing space; each texel is a direction from the map centre. The centre follows the head with a 10 s time constant. The room is assumed to lie on a 2.2 m sphere. Each texel:
   - projects into the feed (tangent → affine → feed UV), and fades out within 4% of the feed's edge;
   - **is masked** when the feed ray to it crosses a visible Steam surface's world quad, plus `--margin`. Quads come from `GetTransformForOverlayCoordinates` at corners (0,0), (mw,0), (0,mh) in mouse-scale pixels, origin bottom-left.
     - Masked surfaces are every visible spec surface, plus Steam's `main`, `bar`, `floatingfooter`, `keyboard`, `notifications` and `volumelevel` overlays when visible.
     - Masks apply only while the dashboard is visible.
     - The main window also gets the `--zone`, because SteamVR's own panels (grab bar, frame controls, frame menus, side panels) sit around it and glassd cannot see them.
   - **blends** with an exponential moving average: 0.22 per update, but a texel seen for the first time takes the feed value outright. Unknown texels keep their last value. Alpha records how well the texel is known.
4. **Fill.** A push-pull pyramid (RGBA16F) fills texels that were never seen with low-frequency colour from the known ones (a dark grey before anything is known). The result is an sRGB, mipmapped, horizontally wrapping texture that the glass samples.

The map keeps integrating at 2 Hz while the dashboard is hidden. When the dashboard opens, the room behind the window is already known, even though the window then hides it from the feed.

### Glass (`shaders/glass.frag`, ported from `vr/shaders/glass.frag`)

One fullscreen draw runs per rounded shape: the cover shapes in the backdrop region, and each slab in its atlas cell. For every texel:

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
- **Output.** Antialiased rounded-rect coverage, premultiplied.

Material widths are converted to pixels with the **main window's** metres per pixel for every surface. Steam's panels share one scale in the scene graph, while the overlay transforms of small popups disagree with it: the bar reports 0.2 mm/px against main's 0.51 mm/px.

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
  - one priming frame after any layout change, nothing else;
  - room updates at `--idle-hz`.
- **Status line** every 5 s, for example:

```
dash=1 surfaces=2/2 fps=7.0 gpu=1.27ms cpu=2.38ms room=29.4/s (0.27ms) feed=live mmap x2 90/s known=4% lum=0.26 env=0.20 masks=3 geo=main:steam,bar:steam
```

- `gpu` comes from `GL_EXT_disjoint_timer_query`; `(cpu+finish)` is shown when timer queries are unavailable.
- `known` is the fraction of the map seen so far.

## Measured on the Frame (2026-10-06, Adreno 750 via zink)

| What | Result |
|---|---|
| Render, `main` 1440×810 + 2–3 slabs | 0.8–1.4 ms GPU (timer queries); 2.3–3 ms CPU including `glFinish` |
| Room update (upload, map, push-pull, mips) | 0.23–0.6 ms GPU, about 29/s while visible, 2/s hidden |
| Feed | mmap with 2 buffers, about 90 frames/s delivered, 29/s kept |
| Process | 11% of one core while visible and rendering, 1.9% while hidden; RSS 77 MB |

## Verifying without the headset

```sh
mkdir -p /tmp/lgs/t
./glassd --demo --key-prefix glassd-test. --out /tmp/lgs/t/out.json --once --warmup 3 \
         --dump /tmp/lgs/t/d --dump-room /tmp/lgs/t/room.png    # look, then: rm -rf /tmp/lgs/t
./glassd --demo --no-mask --debug-view 1 ...   # backdrop only: the feed's view lands on the window
/opt/steamvr/bin/linuxarm64/vrcmd --overlays | grep -A1 glassd
```

- `vrcmd` prints **no size** for an overlay without a texture and **`0x0`** once a dmabuf shared texture is set, the same as Steam's own panels.
- `IVROverlayView` (`build/ovgrab`, hvgrab) returns `RequestFailed` for dmabuf overlays, ours and Steam's alike, so the compositor's copy cannot be read back.
- `--debug-view 1` with `--no-mask` and a low-frost spec (material `liquid`, `dial` 0) shows the Steam window as the feed sees it, registered on the window's own texture. That checks calibration, pose history, the map and the surface quad together.

## Files

| Path | What |
|---|---|
| `src/glassd.cpp` | Options, spec and output, overlays and dmabufs, geometry, masks, materials, scheduling, dumps |
| `src/gfx.h` | GBM, EGL, GLES context; targets; programs; dmabuf render targets |
| `src/feed.h` | V4L2 capture thread, feed calibration |
| `src/room.h` | Room map: integrate, push-pull fill, stats |
| `src/json.h`, `src/vmath.h` | Minimal JSON reader; vectors and poses |
| `shaders/` | `common.glsl`, `fullscreen.vert`, `room_update.frag`, `push.frag`, `pull.frag`, `glass.frag` (embedded at build time) |
| `tools/ovgrab.cpp` | Reads an overlay back through `IVROverlayView` (`ovgrab KEY out.png`). SteamVR refuses dmabuf overlays with `RequestFailed` |
| `third_party/stb_image_write.h` | PNG writer (public domain) |
