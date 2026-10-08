# Native glass compositor (glass rendering and stereo depth)

The CSS theme (`theme/*.css`) restyles Steam's pages. It cannot do two things:

- blur and refract the **room** behind a panel, because an overlay can't see the passthrough;
- give parts of a flat Steam page **stereo depth**.

This layer adds both. It uses SteamVR's own scene graph plus a small native renderer, `glassd`. Like everything else in Glass Shell, it runs only while the theme is on, inside the transient user unit `lgs-shell`, so nothing survives a reboot. Until a wearer has checked input, the cursor dot and window resizing (*Risks*), it runs only on explicit request (`lgs on --native`); the default stays CSS only.

## What was proven on the device (native/spike/)

**1. SteamVR's systemui page (vrwebhelper, devtools on 8090) owns a scene graph.**
- `vrcompositor_systemlayer` renders it natively.
- Nodes are DOM elements under `<vsg-app>`. An element with a `buildNode(ctx, el)` property returns `[ctx, {type, properties}]`. `vsg-transform` elements are parsed from attributes.
- Changes are sent only when the serializer's scheduler runs: webpack module `5723`, export `my`. Find it by source text if the id moves: the module containing `"update_scene_graph"`.

**2. Injected panels can show live crops of Steam's textures anywhere in 3D**, rendered natively with zero copies and correct stereo:

```
vsg-node reparent-to-panel   {parent-overlay-key: "valve.steam.gamepadui.main"}   (one per parent: fact 1 below)
  vsg-node panel-anchor      {anchor-u: cx/texW, anchor-v: cy/texH}   (point on the parent, 0..1, v down)
    vsg-transform            translation="x y dz"                     (metres; +z = toward the viewer)
      vsg-node panel         {key, uv_min:[u0,v0], uv_max:[u1,v1], meters-per-pixel: M,
                              origin:[0,0], curvature:"inherit-from-parent-panel",
                              interactive:false, visibility:0, reflect:0,
                              frame-resize-scale-factor:1}
```

- **`M`** is the parent panel's metres-per-pixel, which differs per surface (fact 2 below): popups and the bar use their `PooledPopup-<key>` panel's value (≈0.00153); main uses its frame node's pre-resize height ÷ texture height (≈0.001389). Crops at the parent's `M` match its scale; crops of main at the popups' 0.00153 come out about 10% too big.
- **Panel size** is (uv span × texture pixel size) × `meters-per-pixel`.
- **`frame-resize-scale-factor: 1`** is what Steam's own pooled popups (also reparented panels) carry, so a user resize of the window scales them with it. Ours carry it too. Whether our crops then follow a resize exactly is still to be verified with a wearer (0.5× and 1.5×).

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

Emitted by `device/lgs_layers.js` in SharedJSContext through the CDP binding `lgsLayers`, only when something changed, sampled at most ~30 times a second:

```json
{"seq": 12, "dash": true, "surfaces": [
  {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "visible": true,
   "texW": 1920, "texH": 1080, "radius": 48, "material": "window",
   "shapes": [{"x": 0, "y": 0, "w": 1920, "h": 1080, "r": 48}],
   "layers": [
     {"id": "hdr-back", "x": 18, "y": 6, "w": 210, "h": 60, "r": 30, "dz": 0.015, "material": "liquid"},
     {"id": "tabs",     "x": 900, "y": 70, "w": 600, "h": 64, "r": 32, "dz": 0.012, "material": "liquid"}
   ]}
]}
```

- Rects are in **texture pixels**: CSS px × devicePixelRatio, origin top-left.
- `r` is the corner radius in texture pixels.
- `shapes` are the cover's rounded regions, one per cover element: the whole window for main, each segment for the bar, each card for a popup (two stacked cards are two shapes).
- `id` names a **slot**, not an element: a rule's first match is reported as the rule id, later ones as `<id>.1`, `<id>.2`. An id moves with the match (the focused card), so glassd keeps reusing a slab whose size still fits.
- A layer's `w`/`h` change only once its element has settled (no transition or animation that moves it, or an ancestor, is running). Meanwhile `x`/`y` follow with the last settled size, so glassd re-packs slabs once per change, not every animation frame. A new element is reported once it has settled (a menu after its materialize animation).
- Layers inside a scroller that is scrolling are left out until it has been still for 150 ms, so a popped crop never lags the live texture.
- `dash` is SteamVR's dashboard visibility. While it is hidden nothing is measured and the last layout stays reported as it was.
- A hidden pooled popup (a `keyPrefix` surface) is left out of the report. `errors` lists problems in `theme/layers.json`, when there are any. The reporter's last report when it stops has `"stopped": true` and every surface invisible.
- Calls the daemon makes: `ping()` (heartbeat; once pinged, the reporter stops itself when pings stop for 12 s; an older daemon's `lgs-native` heartbeat going stale for 15 s does the same), `ack(map)` (below), `status()`, `resend()`, `stop()`. `stop()` deletes `window.__LGS_LAYERS`.

### Daemon → glassd: `/dev/shm/lgs/glassd.json` (glassd re-reads it on change)

```json
{"seq": 12, "dial": 0.5, "surfaces": [
  {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "radius": 48,
   "material": "window", "visible": true,
   "shapes": [{"x": 0, "y": 0, "w": 1920, "h": 1080, "r": 48}],
   "slabs": [{"id": "hdr-back", "w": 210, "h": 60, "r": 30, "material": "liquid", "x": 18, "y": 6, "dz": 0.015}]}
]}
```

- `shapes` `[{x, y, w, h, r}]` (Steam texture px): the cover's rounded shapes, i.e. the card or capsule inside a mostly transparent popup texture. The cover is their union. `[]` = no cover (invisible surfaces). Absent = the whole texture for `material: window`, no cover otherwise.
- `slabs[].x`, `.y`, `.dz`: the element's position and depth, for the slab's world point.
- `quad` (optional) `{"O": [x,y,z], "U": [x,y,z], "V": [x,y,z]}`: the surface's world placement (Steam px (0,0) and steps per Steam px right and down), replacing the overlay transform. The transforms of Steam's popups (bar, footer) disagree in scale with what the scene graph draws; glassd rescales them to the window's scale until a `quad` is given (`native/glassd/README.md`, *Geometry*).

### glassd → daemon: `/dev/shm/lgs/glassd-out.json` (written after each layout change)

```json
{"seq": 12, "pid": 4242, "updated": 1791331200.1, "healthy": true, "fps": 36.0, "gpu_ms": 1.9, "frames": 52, "surfaces": {
  "main": {"key": "glassd.main", "texW": 1440, "texH": 1632, "backdrop": [0, 0, 1, 0.496],
           "backdropScale": 0.75, "cover": 1, "slabs": {"hdr-back": [0.0, 0.498, 0.11, 0.525]}}
}}
```

- **Health:** the file is rewritten at least every 2 s. The daemon treats glassd as producing frames only while `healthy` is not false, `exiting` is absent, and the file changed within the last 6 s (when it carries `updated`; the stand-in does not). It restarts a glassd silent for 6 s.
- `cover` (count of cover shapes): with 0 the daemon does not set `lgs-native` on that window.
- `quadW` (optional, metres): the surface's world width as glassd measures it (`GetTransformForOverlayCoordinates`). If main's is more than 12% off the nominal 0.98 m, the daemon leaves main CSS only until crops are verified to follow a resize. glassd does not write it yet. glassd exits with **75** when it cannot run for now (lock held, SteamVR absent, quitting or restarted, overlays lost repeatedly); that is not a crash.
- The texture size and backdrop UV stay constant while the Steam window keeps its size; slab cells never move once announced (a slab that does not fit is left out and listed in `dropped`).
- `backdrop` and `slabs` are UV rects in glassd's texture for that surface.
- `backdropScale` is glassd texture pixels per Steam texture pixel, so the daemon can set `meters-per-pixel = M / backdropScale`.
- **Slab rule:** a slab is drawn at the element's exact Steam-pixel size × `backdropScale` (plus no margin), so a slab panel at `M / backdropScale` lands exactly under the popped crop.

### Daemon → systemui: `window.__LGS_SG.update(spec)` (device/lgs_sg.js)

```json
{"seq": 7, "M": null, "surfaces": [
  {"steamKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "visible": true,
   "glassd": {"key": "glassd.main", "backdrop": [0, 0, 1, 0.75], "scale": 0.75},
   "coverDz": 0.001, "baseDz": 0.002,
   "popped": [{"id": "hdr-back", "x": 18, "y": 6, "w": 210, "h": 60, "dz": 0.015, "slab": [0, 0.76, 0.12, 0.81]},
              {"id": "tab-arrow", "x": 1498, "y": 82, "w": 40, "h": 40, "dz": 0.012, "slab": [0.5, 0.76, 0.52, 0.79],
               "clip": [1500, 82, 1538, 122]}]}
 ],
 "flags": {"cover": {"no-depth-write": true}}}
```

- `M` null: per surface from its parent panel (fact 2). A number overrides it.
- `clip` (optional, texture px): the part of the element to show. The daemon trims a sliver of up to 2.5 px that overlaps an element popped before it; the slab is cropped the same way.
- `flags` (optional) `{all|cover|base|pop|slab: {prop: value}}`: extra panel properties, only `frame-resize-scale-factor`, `sort-depth-bias`, `sort-order`, `no-depth-test`, `no-depth-write` and `reflect`. For wearer tests (the cursor dot); the daemon reads them from `/tmp/lgs/sg-flags.json`.

`lgs_sg.js` turns that into the nodes above:
- It reuses DOM nodes by id (diffing), so steady state causes no churn.
- It decomposes the base mosaic itself (guillotine cuts around the popped rects).
- It builds a surface only while its parent panel is on the page (`PooledPopup-<key>` for popups and the bar, the frame node that mounts it for main). A popup that closed before the next report gets no nodes.
- The scheduler serializes the whole systemui page on each push (about 1.6 ms of JS against the stock graph), so it pushes at most **15** times a second. Retired sgids are queued and handed to the module's retire export right before our own push; each retire call would otherwise schedule an extra push of its own.
- `update()` returns the counts plus `pushIn` (ms until the scheduled push) and the heartbeat fields below.
- `ping()` is the daemon's heartbeat. It returns `{items, expired, rebuilt, attached, push, pending, specSeq, surf}`. `surf[steamKey]` gives `{cover, base, pop, slab}` counts, `coverAt`, and `pops: {id: at}`. Each `at` is the `Date.now()` of the first push that carried that cover, or that element's crop and slab (0 = not pushed yet). The compositor shows a push about 0.3 s later.
- **Watchdog:** after 12 s without `update()`/`ping()` it clears its nodes but keeps the spec. The next `ping()` rebuilds them (`rebuilt: true`), and the daemon then sends a fresh spec.
- `__LGS_SG.clear()` removes everything, forgets the spec and pushes once.

### Daemon → Steam: `html.lgs-native` and acknowledgements

The daemon calls `window.__LGS_NATIVE` (defined in `lgs_shell.py`) in SharedJSContext. It sends changes within 0.1 s and a heartbeat every second while any window is native:
- **`lgs-native`** goes on a window only while systemui's last heartbeat (at most 2.5 s old) shows our root attached, the scheduler found, no watchdog expiry, and that surface's cover pushed at least 350 ms ago (with glassd healthy and reporting a cover for it). It comes off at once when any of that stops, e.g. when systemui disconnects or reloads, and by itself 3 s after the last heartbeat (the scene-graph watchdog is 12 s, so the CSS glass always comes back first).
- **Acknowledgements:** `__LGS_LAYERS.ack({overlayKey: [ids]})`, one key per native window, listing the popped elements whose crop and slab were pushed at least 350 ms ago. In ack mode (the daemon starts the reporter with `ackMode: true`) `data-lgs-pop` goes only on acknowledged elements, and `data-lgs-cover` only on the cover elements of windows whose key is in the map, so `05-native.css` drops CSS glass only where the compositor really shows glassd's. An element that is reported but not (yet) popped keeps its CSS glass. Because ids are slots, an ack applies to an element only once it has held its id for 350 ms (an id that just moved to another element may still name the old one).
- The daemon also calls `__LGS_LAYERS.ping()` every second; the reporter stops itself when the pings stop.

## glassd (native/glassd/, C++17, built on the Frame)

**Stack:** GBM + EGL (surfaceless, `EGL_PLATFORM_GBM_KHR`) + GLES 3, rendering into dmabuf BOs (frametop's `screens/handcut.cpp` and `keyboard.cpp` do the same), OpenVR as `VRApplication_Overlay`. No window, no X.

**Per surface:**
- One overlay `glassd.<name>`, triple-buffered dmabuf textures.
- Texture = backdrop region (Steam size × `backdropScale`, default 0.75) plus a slab atlas packed underneath.
- `SetOverlayMouseScale(texW, texH)`.
- Never `ShowOverlay`: the scene graph references it by key.

**Room model** (no UI in it), from `/dev/video99`:
- **Capture:** a capture thread (V4L2 mmap, as in `../vr/src/feed.h`) uploads frames at ≤36 Hz, half resolution is fine. It keeps an HMD pose history (OpenVR `GetDeviceToAbsoluteTrackingPose`) to know the head pose at each frame's capture time (≈ now − 14 ms).
  - v4l2cam produces frames only while a reader is attached (about 18% of a core), so glassd streams only while its glass shows, and otherwise attaches for one frame every few seconds. The first buffer after each attach is a stale frame from the previous session and is skipped.
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
- **Materials:** the GM v2 materials (`window`, `panel`, `liquid`, `thick`, plates, holes and their curves) are specified in `docs/phase2/glassd-material.md` and the interface in `docs/phase2/contracts/glassd.md`. The v1 preset table that stood here is retired; GM §7 notes what changed.

- **Slabs:** the same shader, using the slab's own rounded rect and the `liquid` material. Their world point is approximated by the element's position on the surface plus `dz` toward the viewer.

**Budget:** render only while the dashboard is visible (`IsDashboardVisible`) and a surface is visible. ≤ 2.5 ms GPU per frame at up to 72 Hz. Room map updates ≤ 36 Hz.

**Logging and status:** stdout lines to the unit's journal. Write `glassd-out.json` with fps and gpu_ms.

## Daemon (`device/lgs_shell.py`)

`lgs_shell.py` replaces the `lgs-vr` watcher and keeps its job of theming SteamVR pages. It is started by `lgs on` with `systemd-run --user --unit lgs-shell --collect`. The native layer is an **explicit opt-in** (`lgs on --native`), read once when the daemon starts. With it, the daemon:

1. Keeps CDP sessions to Steam (8080, SharedJSContext) and SteamVR systemui (8090).
2. Installs `lgs_layers.js` in Steam and listens to the `lgsLayers` binding (`Runtime.addBinding` + `Runtime.bindingCalled`).
3. Starts `glassd` as a child process, writes `glassd.json`, and watches `glassd-out.json`.
4. Combines both into the `__LGS_SG.update(spec)` call. It sets `html.lgs-native` per window, and acknowledges popped elements, only for what the compositor shows (above), so the CSS stops painting only the glass glassd really replaces.
5. On SIGTERM, on Steam's theme going off, or on any fatal error:
   - `__LGS_SG.destroy()`;
   - remove `lgs-native`;
   - stop the reporter;
   - kill glassd;
   - exit.
   The stock CSS theme stays on.

## CSS native mode (`theme/05-native.css`)

Applies under `html.lgs-on.lgs-native`:
- Window and panel glass backgrounds become transparent (glassd draws them), and the CSS rims/sheens on surfaces glassd covers are dropped.
- Popped elements keep their CSS `backdrop-filter`. That is the refraction of *in-page* content behind them, and it composites over the glassd slab. They drop their CSS tint (the slab supplies it).
- It keys off `[data-lgs-cover]` and `[data-lgs-pop]`, which the reporter sets only on what the daemon acknowledged (see *Daemon → Steam*), so glass that is not on screen yet stays CSS glass.
- The scroll-edge bands under tab rows fade from a neutral scrim instead of the CSS window tint, which over glassd's cover would read as a second, darker window.
- Everything else (content, states, focus, colours) stays as the CSS theme defines it.

## Risks to verify with the wearer

None of these has been checked by a wearer yet, which is why the native layer is opt-in (`lgs on --native`) and the user path (the **+ › Launch Program** toggle, plain `lgs on`) stays CSS only. Run the test with the wearer's consent: `lgs on --native`, check each row, then `lgs on --css`.

| Risk | How to check | Fallback |
|---|---|---|
| Laser and controller input still reach Steam's panel through non-interactive panels | Hover and click on library tiles, a context menu and the bar with layers on | — |
| The laser cursor dot is not hidden by the cover | Look for the cursor on the window, on a popped capsule and on the bar | Write `/tmp/lgs/sg-flags.json`, e.g. `{"cover": {"no-depth-test": true}, "base": {"no-depth-write": true}}` or `{"all": {"sort-depth-bias": -0.5}}` (Steam's bar popups use −0.5); the daemon applies it within 0.5 s |
| A resized window (0.5× and 1.5×) keeps cover, mosaic and popped crops aligned | Resize with the window's handles and look at edges and capsules | `{"all": {"frame-resize-scale-factor": 0}}` in the flags file; glassd may also report main's world width (`quadW`), and the daemon then leaves main CSS only when it is more than 12% off 0.98 m |
| Mosaic seams | Look for hairlines between base pieces | Overlap pieces by 1 px (done) |

**Cost, measured** (headset idle, so the compositor ran at about 5 Hz with the dashboard visible; 3 surfaces, 38 panels, stand-in glassd): compositor GPU median 2.2–2.4 ms per frame with the nodes, 1.8 ms without. Compositor CPU per frame stayed at about 0.7 ms, and no frames were dropped. Re-measure while worn (90 Hz) before making native the default.

## Runtime

### How it runs

`lgs on` (the **+ › Launch Program › Liquid Glass** toggle, or `python glass.py on`) injects the CSS and then starts the transient user unit **`lgs-shell`**, CSS only:

```
systemd-run --user --unit lgs-shell --collect -p KillMode=mixed -p TimeoutStopSec=15 \
    /usr/bin/python3 -u device/lgs_shell.py daemon --glassd none
```

**`lgs on --native`** (or `python glass.py on --native`) opts in for this session: `daemon --glassd ~/.local/share/glass-shell/native/glassd/glassd --native`. Then glassd reads `/dev/video99`. `lgs on --css` switches back. A plain `lgs on` (or `lgs dial`) keeps a running unit as it is and starts a new one CSS only. Native mode never outlives the session: the unit exits when the theme goes off, and the next `lgs on` is CSS only again.

It replaces the old `lgs-vr` watcher (`lgs on` stops a leftover `lgs-vr`). Nothing is enabled or written outside `/dev/shm/lgs` and `/tmp/lgs`, so a reboot or a Steam restart leaves nothing behind.

| Mode (`status.mode`) | When | What runs |
|---|---|---|
| `native` | opted in, glassd binary present at daemon start, glassd producing frames (healthy, output fresh), Steam theme on | everything below |
| `starting` | opted in, glassd not ready yet (or restarting) | as native, with an empty scene-graph spec and no `lgs-native` |
| `css-only (native layer not requested; …)` | the default | SteamVR page theming only. No reporter in Steam, nothing in systemui, no glassd |
| `css-only (no glassd binary at start; …)` | opted in, `native/glassd/glassd` not built when the daemon started | same. A binary built later is **not** picked up mid-session |
| `css-only (glassd binary removed)` | the binary was deleted mid-session | same; glassd is killed, the reporter stopped and the nodes removed |
| `css-only (glassd gave up: …)` | glassd crashed 5 times within 120 s (backoff 2, 4, 8, 16 s) | same as above. Exit 75 (SteamVR gone, lock held) is not a crash: it is retried after 3, 6, 9 … ≤ 30 s |

In native mode the daemon:

1. keeps one devtools socket to Steam's SharedJSContext (8080) and one to SteamVR's `systemui` (8090). A lost or refused connection (including `aiohttp` handshake errors on a stale target) is retried after 2 s. Any other exception is logged with its traceback and retried with backoff; 5 of them in 120 s in one loop end the daemon;
2. adds the CDP binding `lgsLayers` and injects `device/lgs_layers.js` with `window.__LGS_LAYERS_OPTS = {binding, layers: theme/layers.json, ackMode: true}`. It pings it every second and re-injects when the file changes, the page reloads or the reporter stopped. A running instance with another binding (someone's test) is left alone. Without the file (or without any report within 10 s) it synthesizes a report for the main window only: the cover, no popped elements;
3. writes `/dev/shm/lgs/glassd.json` atomically. Structural changes are written at once, position-only changes at most 4 times a second. It passes the reporter's `shapes` and each slab's `x`, `y` and `dz` through;
4. starts glassd as a child process (stdout goes to the journal with a `glassd:` prefix; it gets SIGTERM if the daemon dies), removes a stale `glassd-out.json` first, and watches the new one at 10 Hz. glassd counts as ready only while `healthy` is not false, it is not `exiting`, and (when it writes `updated`) the file changed within 6 s. Otherwise the glass comes off at once, and a glassd silent for 6 s is restarted;
5. builds the `__LGS_SG` spec and sends it, at most 15 times a second and only when it changed. It pings `__LGS_SG` every second, every 0.1 s while a push is pending, and re-sends the spec after a watchdog expiry. A popped element is used only when:
   - glassd has a slab for it whose size matches the element × `backdropScale` (±2.5 px);
   - its rect has been still (within 2 px) for 150 ms, so moving elements (scrolling, a focus change) stay flat with their CSS glass instead of being cropped at a stale rect;
   - it overlaps an element popped before it by at most 2.5 px. That sliver is clipped off; wider overlaps skip the element;
6. sets `html.lgs-native` and the acknowledgements as described under *Daemon → Steam*;
7. keeps the last layout while the reporter says the dashboard is hidden (`dash: false`): nodes, covers, `lgs-native` and `glassd.json` stay as they are, so reopening shows the glass at once instead of rebuilding it;
8. themes every SteamVR page like `lgs-vr` did, unless `/tmp/lgs/vr-theme-paused` exists. A lab `--theme off` on a `vr:` page now writes that marker via `lgs_vr.stop()` instead of stopping a unit, and the next `lgs on` removes it.

It stops on SIGTERM (`lgs off`, `lgs_shell.py stop`) or on an internal error. A theme off that did not come from `lgs off` (a lab `--stock` step, P1's selftests) makes it **dormant** (nodes and `lgs-native` cleared) and it resumes when the theme is back; it exits after `shellThemeGraceS` (default 600 s) dormant, at once after a Steam restart, or after 120 s without Steam. The authority is `docs/phase2/contracts/daemon.md` §1. It first writes `mode: stopping` to `shell.json`, so an `lgs on` meanwhile waits for it and then starts a fresh unit. Teardown order:

1. `__LGS_SG.destroy()`;
2. `__LGS_NATIVE.clear()`;
3. `__LGS_LAYERS.stop()` and `Runtime.removeBinding` (the inert `window.lgsLayers` function stays until Steam restarts);
4. glassd SIGTERM (SIGKILL after 4 s);
5. delete `glassd.json` and `glassd-out.json`;
6. if the theme went off: strip the SteamVR pages.

**If the daemon dies or stalls without tearing down** (crash, `kill -9`, a long freeze), the pages clean up after themselves: `__LGS_NATIVE` removes `lgs-native` 3 s after the last heartbeat, `lgs_sg.js` clears its nodes after 12 s, and the reporter stops itself 12 s after the last ping. systemd kills glassd with the unit. After a freeze the daemon rebuilds everything within about 0.4 s (DM-1; first verified on the Frame with a 15 s SIGSTOP: `lgs-native` off at 4 s, nodes off at 12 s).

### Build glassd, or the stand-in

```bash
python glass.py sync                 # also uploads native/ (sources only; never build/ or binaries)
python glass.py native-build         # runs native/glassd/build.sh on the Frame -> native/glassd/glassd
python glass.py native-build fake    # native/spike/fakeglassd: a stand-in glassd (no camera)
```

Building the binary changes nothing by itself: native mode needs `lgs on --native`, and a running daemon never picks up a binary built after it started. To go back to CSS only, use `lgs on --css`. Deleting `~/.local/share/glass-shell/native/glassd/glassd` also ends native mode in a running daemon (glassd is killed within a second).

`native/spike/fakeglassd` follows the same `glassd.json` / `glassd-out.json` contract. It publishes `glassd.<surface>` dmabuf overlays with a static frosted gradient and translucent slabs in an atlas, and it never touches the camera. `--dump DIR` writes its textures to PNG, so you can check them without the headset.

### Run it by hand (tests)

```bash
D=~/.local/share/glass-shell/device
python3 $D/lgs_shell.py start --native --glassd ~/.local/share/glass-shell/native/spike/fakeglassd --stay
python3 $D/lgs_shell.py start --native --stay          # real glassd, no camera (--no-feed is added)
python3 $D/lgs_shell.py start --native --feed --stay   # real glassd with the feed (in memory; allowed since the user asked for real glass in phase 2)
python3 $D/lgs_shell.py start --css                    # CSS only (also the default without --native)
python glass.py shell start --native --stay            # the same from the PC (arguments are passed on)
```

- `--stay` is for tests only (`glass.py native-session` uses it). Other agents' lab steps toggle the Steam theme off and on all the time; with `--stay` the daemon goes dormant (nodes and `lgs-native` cleared) while the theme is off instead of exiting. It is bounded: dormant at most 2400 s, native at most 2400 s after start, and a Steam restart or 120 s without Steam end it too (`contracts/daemon.md` §1).
- From this command line the real glassd gets `--no-feed` unless `--feed` or `--glassd-args "..."` is given. Users' `lgs on --native` runs it with the feed.
- `start` keeps a running unit (`running (native)` / `running (css only)`). With `--native` or `--css` it restarts one that runs with other arguments. It waits for a unit that is stopping.
- `native/spike/sg_timeline.py` refuses to run while `lgs-shell` is active, and it uses the shared reparent mode, a 5 s watchdog and try/finally.

### Inspect

| What | How |
|---|---|
| Unit + summary | `lgs status` (key `shell`), `python glass.py shell status`, `python3 $D/lgs_shell.py status` |
| Live daemon state | `/dev/shm/lgs/shell.json`, rewritten every 2 s: mode, `native` (requested, enabled, reason), glassd pid/ready/healthy/stale/frames/fps/restarts/tempExits, reporter state, report source, `dashboardHidden`, `lgsNative` windows, `acked` ids and how many elements are `tagged`, spec summary, heartbeat age, `__LGS_SG` counts, panel flags, SteamVR pages, last errors |
| Log | `python glass.py shell log` (`journalctl --user -u lgs-shell`), also `/tmp/lgs/lgs.log` (`shell:` lines; spec changes are logged only when their counts change, at most once a second; the file rolls over to `lgs.log.1` at 512 KB) |
| glassd in/out | `/dev/shm/lgs/glassd.json`, `/dev/shm/lgs/glassd-out.json` |
| Scene graph | `python glass.py js "JSON.stringify(__LGS_SG.status())" --in vr:systemui`: scheduler, attached, per-surface `parents` (`src`, displayed `uv`, `mpp`), items by kind, nodes, pushes per second, re-attaches, re-layouts, watchdog. `__LGS_SG.dump()` lists every panel (anchor, z, key, uv, mpp, size in m, sgids) |
| Which copy is ours | Inject `lgs_sg.js` with `{debugTint: {base: [1,.3,.3], pop: [.3,1,.3]}}`: those panels get wrapped in SteamVR `tint` nodes. `native/spike/sg_timeline.py` does this on the Frame and grabs the headset view at fixed delays (frames show the room: look, then delete) |

### Stop it

- `lgs off`: the theme off, `lgs-shell` stopped, SteamVR pages stripped.
- `python glass.py shell stop` (or `lgs_shell.py stop`, `systemctl --user stop lgs-shell`): stops only the native layer and the page watcher. The CSS theme stays on.

### Scene-graph facts found while building `lgs_sg.js` (these correct the spike notes above)

1. **One `reparent-to-panel` per parent.**
   - SteamVR lays out *sibling* `reparent-to-panel` nodes of one parent panel side by side. With several items, each under its own `reparent-to-panel`, the pieces landed beside the window, and the leftovers looked like ghost copies.
   - `lgs_sg.js` therefore puts every item of a surface under a single `reparent-to-panel` (`panel-anchor > vsg-transform > panel` per item). With that, the base mosaic, popped crops, slabs and the cover all sit in place. Verified with tinted panels on the Frame.
2. **Main's metres-per-pixel is not the popups'.**
   - The main window is mounted from Steam's standalone graph. Its frame node says `override-pre-resize-main-panel-height: 1.5`, so M_main = 1.5 / 1080 = **0.001389** m/px.
   - The popups' 0.00153 made main crops about 10% too big. That was measured: content was offset by (+70, +25) px at the bottom-right, against (+74, +24) predicted.
   - `lgs_sg.js` reads M per surface: main from the frame node, popups and the bar from their own `PooledPopup-<key>` panel. A spec `M` overrides it.
   - A user resize of the main window is not visible from systemui (the frame node only gives the range, `frame-resize-scale-min` 0.25 … `max` 2). Steam's own pooled popups carry `frame-resize-scale-factor: 1` on their panel (Steam's popup component sets it, and reparents a popup that has a parent overlay key the same way we do), so ours carry it too. That is a no-op at the default size (checked in the headset view). Whether crops follow a resize is **unverified** (wearer test above).
3. **Popups and the bar show a live sub-range of their texture.**
   - The parent panel shows only part of the texture: the panel's `uv_min`/`uv_max`, e.g. bar 0.208–0.792, floating footer 0.32–0.68, frame menu 0.82–1 × 0.19–0.81. Steam changes that range as the content changes.
   - Anchors are texture uv; SteamVR maps them onto the displayed range (clamped). Items on popup parents name the parent's curvature origin (`curvature-origin-id`, the bar's for a bar popup) and no `inherit-from-parent-panel`, or a bar-popup copy comes out flat. Verified on the bar, the frame menu and the "+" bar popup (`docs/phase2/contracts/sg.md` §0, SG-POPUP). `lgs_sg.js` clips every item to the displayed range and re-lays out within 0.5 s when it changes.
   - Verified: the bar and floating-footer covers line up with their capsules.
4. **Changes reach the compositor within about 0.3 s.** That covers both adding nodes and removing them: DOM removal plus `retired_sgids` through the module's retire export (`Lx`), which is found by source text like the scheduler.
   - The scheduler export (`my`) is `T()`: it debounces with `setTimeout(0)`, then serializes the whole page and sends `update_scene_graph`. `Lx(sgid)` queues the sgid and calls `T()`, so a retire call made just before our push joins that same push.
5. **Depth units.**
   - `vsg-transform` translations and `dz` are in the dashboard's scene metres. In those units the window is 2.67 × 1.5, at about 2.95 from its curvature origin.
   - `GetTransformForOverlayCoordinates` reports a nominal quad of about 0.98 × 0.55 m at about 1.2 m, which has the same angular size, so rays through either quad agree.
   - Tune the stereo `dz` values in `theme/layers.json` with that scale in mind.
6. **The reporter's `visible` flag stays true while the frame shows Now Playing.** Nodes reparented to main are hidden then anyway.
