# Native glass compositor (glass rendering and stereo depth)

The CSS theme (`theme/*.css`) restyles Steam's pages. It cannot do two things:

- blur and refract the **room** behind a panel, because an overlay can't see the passthrough;
- give parts of a flat Steam page **stereo depth**.

This layer adds both. It uses SteamVR's own scene graph plus a small native renderer, `glassd`. Like everything else in Glass Shell, it runs only while the theme is on, inside the transient user unit `lgs-shell`, so nothing survives a reboot.

## What was proven on the device (native/spike/)

**1. SteamVR's systemui page (vrwebhelper, devtools on 8090) owns a scene graph.**
- `vrcompositor_systemlayer` renders it natively.
- Nodes are DOM elements under `<vsg-app>`. An element with a `buildNode(ctx, el)` property returns `[ctx, {type, properties}]`. `vsg-transform` elements are parsed from attributes.
- Changes are sent only when the serializer's scheduler runs: webpack module `5723`, export `my`. Find it by source text if the id moves: the module containing `"update_scene_graph"`.

**2. Injected panels can show live crops of Steam's textures anywhere in 3D**, rendered natively with zero copies and correct stereo:

```
vsg-node reparent-to-panel   {parent-overlay-key: "valve.steam.gamepadui.main"}
  vsg-node panel-anchor      {anchor-u: cx/texW, anchor-v: cy/texH}   (point on the parent, 0..1, v down)
    vsg-transform            translation="x y dz"                     (metres; +z = toward the viewer)
      vsg-node panel         {key, uv_min:[u0,v0], uv_max:[u1,v1], meters-per-pixel: M,
                              origin:[0,0], curvature:"inherit-from-parent-panel",
                              interactive:false, visibility:0, reflect:0}
```

- **`M`** is Steam's gamepadui metres-per-pixel. Read it from any `[id^=PooledPopup]` panel's `buildNode()` (≈0.00153). Crops at `M` match the window's scale exactly.
- **Panel size** is (uv span × texture pixel size) × `meters-per-pixel`.

**3. Our own textures render too**, if the overlay's texture is a **dmabuf** submitted as `TextureType_SharedTextureHandle`:
- Allocate with GBM (`gbm_bo_create … LINEAR|RENDERING`), import with `VRIPCResourceManager()->ImportDmabuf`, then submit with `SetOverlayTexture`.
- The overlay **must have `SetOverlayMouseScale(texW, texH)`**, because that is the pixel size the panel uses.
- `SetOverlayRaw` overlays are ignored by the scene graph.

**4. The window's world geometry** comes from `IVROverlay::GetTransformForOverlayCoordinates(steamOverlay, TrackingUniverseStanding, {px, py})`:
- `px`, `py` are texture pixels; the mouse scale is 1920×1080 for main, and the origin is **bottom-left** (y up).
- Example: main spans x −0.39…0.59, y 0.81…1.36, z ≈ −1.43 m (about 0.98 × 0.55 m at 1.43 m).
- The visual curvature comes from the scene graph and is not included.

**5. Capturing what the headset shows**: `native/spike/hvgrab` samples `system.HeadsetView` through `IVROverlayView` (Vulkan) and writes a PNG. The frame shows the room, so delete it after looking.
- `IVROverlayView` **cannot** read Steam's own panels (`RequestFailed`), so glassd never sees Steam's pixels.
- The room source is the passthrough feed `/dev/video99`: the compositor's right-eye view, 1920×1080 RGB, about 12–16 ms latency, with calibration in `~/.config/liquid-glass-frame/feed.cfg` (see `../vr/src/feed.h`).

## Layering per Steam surface (back to front)

| z (towards viewer) | Layer | Source |
|---|---|---|
| 0 | Steam's real panel. **Hidden behind the cover; still receives the laser and controller input** | Steam |
| +1 mm | **Cover**: glassd's window glass for this surface (frosted and lensed room, tint, sheen, rim). Opaque inside the surface's rounded shape | glassd overlay, backdrop region |
| +2 mm | **Base mosaic**: crops of Steam's texture covering the surface *minus* the popped rectangles, so nothing is shown twice. Transparent where Steam's CSS is transparent, letting the cover show through | Steam overlay crops |
| +dz − 0.8 mm | **Slab** for each popped element: glassd's Liquid Glass for that element's shape | glassd overlay, slab atlas region |
| +dz | **Popped element**: a crop of Steam's texture at the element's rect | Steam overlay crop |

Depths (`dz`, metres), from `theme/layers.json`:

| Element | dz |
|---|---|
| Header capsules, tab bars, footer legend | ≈ 0.012–0.02 |
| Play / primary button | 0.015 |
| Focused content card (visionOS hover lift) | +0.008 on top of its rest depth |
| Menus and sheets | 0.03 |

Bar and popup surfaces use the same recipe, with their own covers.

## Interfaces

### Steam → daemon: layer report

Emitted by `device/lgs_layers.js` in SharedJSContext through the CDP binding `lgsLayers`, at most once per animation frame, and only when something changed:

```json
{"seq": 12, "surfaces": [
  {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "visible": true,
   "texW": 1920, "texH": 1080, "radius": 48,
   "layers": [
     {"id": "hdr-back", "x": 18, "y": 6, "w": 210, "h": 60, "r": 30, "dz": 0.015, "material": "liquid"},
     {"id": "tabs",     "x": 900, "y": 70, "w": 600, "h": 64, "r": 32, "dz": 0.012, "material": "liquid"}
   ]}
]}
```

- Rects are in **texture pixels**: CSS px × devicePixelRatio, origin top-left.
- `r` is the corner radius in texture pixels.
- `id` is stable while the element lives (assigned by the reporter, kept in a WeakMap).

### Daemon → glassd: `/dev/shm/lgs/glassd.json` (glassd re-reads it on change)

```json
{"seq": 12, "dial": 0.5, "surfaces": [
  {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "radius": 48,
   "material": "window", "visible": true,
   "slabs": [{"id": "hdr-back", "w": 210, "h": 60, "r": 30, "material": "liquid"}]}
]}
```

### glassd → daemon: `/dev/shm/lgs/glassd-out.json` (written after each layout change)

```json
{"seq": 12, "fps": 36.0, "gpu_ms": 1.9, "surfaces": {
  "main": {"key": "glassd.main", "texW": 1440, "texH": 1080, "backdrop": [0, 0, 1, 0.75],
           "backdropScale": 0.75, "slabs": {"hdr-back": [0.0, 0.76, 0.12, 0.81]}}
}}
```

- `backdrop` and `slabs` are UV rects in glassd's texture for that surface.
- `backdropScale` is glassd texture pixels per Steam texture pixel, so the daemon can set `meters-per-pixel = M / backdropScale`.
- **Slab rule:** a slab is drawn at the element's exact Steam-pixel size × `backdropScale` (plus no margin), so a slab panel at `M / backdropScale` lands exactly under the popped crop.

### Daemon → systemui: `window.__LGS_SG.update(spec)` (device/lgs_sg.js)

```json
{"M": 0.00153, "surfaces": [
  {"steamKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "visible": true,
   "glassd": {"key": "glassd.main", "backdrop": [0, 0, 1, 0.75], "scale": 0.75},
   "coverDz": 0.001, "baseDz": 0.002,
   "popped": [{"id": "hdr-back", "x": 18, "y": 6, "w": 210, "h": 60, "dz": 0.015, "slab": [0, 0.76, 0.12, 0.81]}]}
]}
```

`lgs_sg.js` turns that into the nodes above:
- It reuses DOM nodes by id (diffing), so steady state causes no churn.
- It decomposes the base mosaic itself (guillotine cuts around the popped rects).
- It pushes the scheduler at most 30 times a second.
- `__LGS_SG.clear()` removes everything and pushes once.

## glassd (native/glassd/, C++17, built on the Frame)

**Stack:** GBM + EGL (surfaceless, `EGL_PLATFORM_GBM_KHR`) + GLES 3, rendering into dmabuf BOs (frametop's `screens/handcut.cpp` and `keyboard.cpp` do the same), OpenVR as `VRApplication_Overlay`. No window, no X.

**Per surface:**
- One overlay `glassd.<name>`, triple-buffered dmabuf textures.
- Texture = backdrop region (Steam size × `backdropScale`, default 0.75) plus a slab atlas packed underneath.
- `SetOverlayMouseScale(texW, texH)`.
- Never `ShowOverlay`: the scene graph references it by key.

**Room model** (no UI in it), from `/dev/video99`:
- **Capture:** a capture thread (V4L2 mmap, as in `../vr/src/feed.h`) uploads frames at ≤36 Hz, half resolution is fine. It keeps an HMD pose history (OpenVR `GetDeviceToAbsoluteTrackingPose`) to know the head pose at each frame's capture time (≈ now − 14 ms).
- **World map:** an **equirectangular room map** in standing space (1024×512, RGBA8 + mips).
  - Each feed frame is reprojected into it with the calibration mapping (tangent coords of the right eye → feed UV).
  - Pixels where any Steam surface or any glassd panel projects (from each surface's world quad, via `GetTransformForOverlayCoordinates` corners, plus a margin) are **masked out**, because the feed shows the UI there, not the room.
  - Known pixels blend in with an exponential moving average; unknown pixels keep their last value. Before anything is known, fill from a push-pull of the known pixels.
  - This gives a stable "room behind the UI" even right after the dashboard opens.
- **Backdrop shading**, per texel of a surface (its world point from the quad, plus the view ray from the current head pose):
  - sample the room map along the ray, frosted (mip bias by material);
  - near the rounded edge, bend the ray inward with the squircle bezel profile (`../vr/shaders/glass.frag`, `common.glsl`) for lensing, with slight dispersion;
  - adaptive tint from room luminance;
  - top-down sheen, a key light from above on the rim and a weaker fill on the opposite rim, inner shadow;
  - opaque inside the rounded rect, transparent outside (premultiplied).
- **Materials:** the design bible's presets.

| Material | Tint | Frost | Lensing | Rim |
|---|---|---|---|---|
| `window` | thick ≈0.55 | heavy | low | soft |
| `panel` | 0.5 | heavy | low | — |
| `liquid` | clear 0.18 | light | strong lensing at the bezel | bright rim |
| `thick` (menus, sheets) | 0.45 | strong | — | — |

- **Slabs:** the same shader, using the slab's own rounded rect and the `liquid` material. Their world point is approximated by the element's position on the surface plus `dz` toward the viewer.

**Budget:** render only while the dashboard is visible (`IsDashboardVisible`) and a surface is visible. ≤ 2.5 ms GPU per frame at up to 72 Hz. Room map updates ≤ 36 Hz.

**Logging and status:** stdout lines to the unit's journal. Write `glassd-out.json` with fps and gpu_ms.

## Daemon (`device/lgs_shell.py`)

`lgs_shell.py` replaces the `lgs-vr` watcher and keeps its job of theming SteamVR pages. It is started by `lgs on` with `systemd-run --user --unit lgs-shell --collect`. It:

1. Keeps CDP sessions to Steam (8080, SharedJSContext) and SteamVR systemui (8090).
2. Installs `lgs_layers.js` in Steam and listens to the `lgsLayers` binding (`Runtime.addBinding` + `Runtime.bindingCalled`).
3. Starts `glassd` as a child process, writes `glassd.json`, and watches `glassd-out.json`.
4. Combines both into the `__LGS_SG.update(spec)` call and sets `html.lgs-native` on Steam's windows (through `__LGS`) once glassd is producing frames, so the CSS stops painting window glass.
5. On SIGTERM, on Steam's theme going off, or on any fatal error:
   - `__LGS_SG.clear()`;
   - remove `lgs-native`;
   - kill glassd;
   - exit.
   The stock CSS theme stays on.

## CSS native mode (`theme/05-native.css`)

Applies under `html.lgs-on.lgs-native`:
- Window and panel glass backgrounds become transparent (glassd draws them), and the CSS rims/sheens on surfaces glassd covers are dropped.
- Popped elements keep their CSS `backdrop-filter`. That is the refraction of *in-page* content behind them, and it composites over the glassd slab. They drop their CSS tint (the slab supplies it).
- Everything else (content, states, focus, colours) stays as the CSS theme defines it.

## Risks to verify with the wearer

| Risk | How to check | Fallback |
|---|---|---|
| Laser and controller input still reach Steam's panel through non-interactive panels | Hover and click on library tiles with layers on | — |
| The laser cursor dot is not hidden by the cover | Look for the cursor on the window | `no-depth-write` on cover and mosaic, or sort-order tweaks |
| Mosaic seams | Look for hairlines between base pieces | Overlap pieces by 1 px |
