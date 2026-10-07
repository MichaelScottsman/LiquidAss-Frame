# Capability study: the spatial layer (T4 scene graph, T5 glassd)

What SteamVR's scene graph (T4) and glassd (T5) can do for a visionOS-native Phase 2. Every claim carries a tag:

| Tag | Meaning |
|---|---|
| **[PROVEN]** | Shown on the Frame by this study (2026-10-07, SteamVR web UI `11065908`, Steam `11094443`), with the evidence named |
| **[PROVEN-P1]** | Shown earlier in Phase 1 (`docs/NATIVE.md`, `native/spike/`), not re-tested here |
| **[PLAUSIBLE]** | Strong indirect evidence (same mechanism as something Steam or SteamVR ships), not verified end to end |
| **[UNPROVEN]** | Not tested, or the test was inconclusive |
| **[NO]** | Shown impossible, or unsafe on the shared device |

The probes are in `docs/phase2/capabilities/spatial-probe/` (§10). Every probe restored what it changed. Headset-view captures were looked at and deleted, because they show the room. The parts of other agents' work this builds on are `device/lgs_sg.js`, `device/lgs_shell.py`, `native/glassd/` and `theme/layers.json` (read only).

---

## 0. Answers in one table

| # | Question | Answer |
|---|---|---|
| 1 | Can an injected crop of a Steam overlay take laser input and route it to the right place, so that ornaments can be **moved**? | **Registration [PROVEN]:** an interactive crop (`interactive:true` plus Steam's input app id) becomes a laser target of Steam's own overlay handle, at its own size, wherever it is placed. **Correct hit mapping [PLAUSIBLE]:** it is the mechanism Steam's bar, bar popups, frame menu and tooltips use every day (a panel with a uv sub-rect of an overlay, placed anywhere). **A real laser click on a moved crop [UNPROVEN]:** SteamVR has no API that fires a laser without a human (§2.4). A moved crop also renders correctly [PROVEN, E15]. |
| 2 | How are Steam's dashboard popups placed, and can Steam-side JS ask for popups further forward or larger? | **[PROVEN]** Steam's `window.vrPooledPopupStore` (SharedJSContext) sends `ShowDashboardPopup` requests with a parent overlay, an anchor on the parent, an anchor on the popup, an offset in pixels and/or metres (x, y, **z**), pitch/yaw, a **scale** and flags. Our own popup, parented to the main window, rendered left of the window at +2.9 cm, then at +7.8 cm, ×1.5 and yawed 20°, live. It was an interactive laser target throughout (E2). |
| 3 | Smooth animation of injected transforms? | **No tween nodes usable [PROVEN].** `tint-anim` loops forever (E7). The animated-translation form only follows SteamVR's two theater channels. Grab and elastic transforms are behaviours, not tweens. **Animate by pushing [PROVEN]:** 30, 60 and 90 pushes/s are reachable from systemui (E3). Each push sends the whole graph (about 22 KB) and costs vrcompositor about 1.6 ms of CPU (E8). Push only while something moves. |
| 4 | Push back and dim the window when a sheet opens? | **[PROVEN]** The identity transform that wraps the Steam frame page can be serialized as a `tint` node (dim), an `opacity` node (fade) or a translation (recede). The main window stays a laser target while receded (E4). |
| 5 | Restyle the window bar and frame controls; a Home view of icons with no window? | **Frame controls can be made larger with CSS [PROVEN]:** the quad and its laser target grow with the DOM (E16). Steam's left **frame menu is already a vertical ornament** beside the window's leading edge (laser-only). **A fully transparent Steam window [PROVEN]:** icons float over the room (E6). How the laser behaves on transparent pixels is [UNPROVEN]. |
| 6 | Make the window larger, or change the page DPI, without breaking input? | **[PROVEN]** Overriding the frame node's `override-pre-resize-main-panel-height` (1.5 → 1.8) scales the whole window by 1.2. Its laser target followed (E5b). Mutating the frame's `componentProps` has no effect (E5). Popups have their own `scale`. |

---

## 1. Geometry and units (read this before using any number)

### 1.1 Live values (2026-10-07 00:30)

| Quantity | Value | Where to read it (systemui, `python glass.py js "…" --in vr:systemui`) |
|---|---|---|
| Dashboard scale **S** | 0.369 | `DashboardStore.dashboardScale` |
| Main panel pre-resize height **H0** | 1.5 scene units | frame node `override-pre-resize-main-panel-height`. The value is `FrameStore.frames[0].size.mainPanelHeightOverride`, a module constant (`forcedUniformDashboardHeight`) |
| User resize factor **r** | **0.863 now** (1.0 by default) | `FrameStore.frames[0].activePage.size.latestMeasuredPanelLocalHeight / H0` (1.2951 / 1.5). The laser dump's `fHeight` for the main panel shows the same 1.2951 |
| Window height in the world | **0.478 m now** (0.553 m at r = 1) | `…activePage.size.latestMeasuredPanelWorldHeight` |
| Window width in the world | 0.850 m now (0.984 m at r = 1) | height × 16/9 |
| Scene units → metres inside main's subtree | **× S × r = 0.319 now** (0.369 at r = 1) | — |
| Main window crop metres-per-pixel **M** | 1.5 / 1080 = 0.0013889 units per texture px | `lgs_sg.js` reads it from the frame node |
| Popup metres-per-pixel **Mp** | 0.0015308 units per texture px | `PooledPopup-*` panels; `m_fVRGamepadUI_MetersPerPixel` |
| Eye to window at summon | about 1.15 m (`dashboardDistance`) | The window lies on a cylinder of radius 2.95 units × S ≈ 1.09 m, centred near the head. The user can push or pull the window (grab transform, 0.3–4 m), so read the distance live |

Two corrections to earlier notes:

- **Depth values are scene units, not metres.** `vsg-transform` translations, `theme/layers.json` `dz` and popup offsets are all in the main panel's local units. One unit is S × r metres. The default `dz` 0.015 is therefore 5.5 mm at r = 1, and 4.8 mm today. `docs/NATIVE.md` already says "scene metres". To place something at a real depth, use `dz_units = dz_m / (S × r)`: +1.5 cm is 0.041 units at r = 1, and the bible's tab bar at +3.5 cm is 0.095 units.
- **The user resize is visible from systemui.** NATIVE.md calls it "Unverified". Children reparented to main inherit the resize, so crops at M stay registered. The real-world size of everything scales with r.

### 1.2 Size math for targets

- One CSS px = 1.5 texture px = 1.5 × (window height in m) / 1080.
  - At r = 1: 0.769 mm.
  - Today (r = 0.863): 0.664 mm.
- At 1.15 m, one CSS px subtends 0.038° (r = 1) or 0.033° (today).
- A visionOS 60 pt target (2.4–2.5°) is therefore about **63–66 CSS px at r = 1 and 73–76 CSS px at today's size**. Steam's 40–48 px controls are 1.5–1.8°.
- The brief's 0.031°/px assumes 1.43 m. That is the window's standing-space z, not the eye distance.
- Design for **≥ 72 CSS px** so targets still meet 60 pt when users shrink the window. §7 shows how to enlarge the window instead of the CSS.

JS for the live numbers (systemui):

```js
(()=>{const f=FrameStore.frames.find(x=>/page:3/.test(x.activePage&&x.activePage.mountableID))||FrameStore.frames[0];
 const z=f.activePage.size, S=DashboardStore.dashboardScale, H0=f.size.mainPanelHeightOverride||1.5;
 const r=z.latestMeasuredPanelLocalHeight/H0, Hw=z.latestMeasuredPanelWorldHeight;
 return JSON.stringify({S,H0,r,Hw,unitToM:S*r,mmPerCssPx:1500*Hw/1080,dashDist:DashboardStore.dashboardDistance});})()
```

### 1.3 Things in front of the window plane

- The dashboard **bar** sits about 0.35 units in front of the window plane, below it. A crop placed under the window at small `dz` is **hidden behind the bar** (seen in E10/E11).
- The bar also hosts the grab handle. The window's own controls (frame controls, resize corner) sit at the window plane.

---

## 2. Input routing (Q1)

### 2.1 How SteamVR routes the laser

- Each `panel` node in the scene graph with `interactive:true` becomes a **laser target**. Each target records:
  - its source overlay (`ulSourceOverlay`);
  - its own size (`fWidth`/`fHeight`);
  - keyboard-focus capability, the Steam input app id, visibility and flags.
- Panels with `interactive:false` are listed under `skippingDueToNonInteractivity`, and the laser passes through them.
- Dump the live targets (read-only):

  ```js
  // systemui
  (async()=>JSON.stringify(await OverlayStore.DumpLaserOverlays()))()
  ```

  It sends `{type:"dump_laser_overlays"}` to the compositor's `lasermouse` mailbox. It returns:
  - `overlays` (per panel: `laser_overlay`, `overlaystate`, `scene_graph_panel`);
  - `skippingDueToNonInteractivity`;
  - `overlaysForcingLaserMouseOn`;
  - the laser state.
- **Steam's popups are already crops [PROVEN].**
  - The dashboard bar is itself a pooled popup. Its panel shows uv 0.208–0.792 of the 1800 px bar texture (`clip_rect`). It is a laser target 1.607 units wide, which is exactly the clipped span × Mp.
  - Bar popups, the frame menu and tooltips are all `panel {key: <steam overlay>, uv_min/uv_max: clip rect, interactive}` nodes, placed by a transform chain anywhere relative to their parent.
  - Laser input on them works in daily use. The laser→overlay mapping is therefore uv-based and independent of where the panel sits.

### 2.2 What this study proved

| Probe | Result |
|---|---|
| E1: three injected panels: an in-place pop of the header strip (dz 0.03), a crop moved 0.25 units off the left edge, and an invisible-but-intersectable blocker (`visibility:3`) on an empty atlas region | **All three became laser targets [PROVEN].** The crops were bound to Steam main's overlay handle (`223338299408`), sized 1.2 × 0.1125 and 0.107 × 0.75 units (uv span × M). The blocker was bound to `system.systemui` with `eVisibility 3`. The input focus stack never changed (`RegisterForInputFocusDebugInfo`). After removal, the targets were gone |
| E15: a header crop (Back + search field) moved 0.8 units left of the window, interactive, green-tinted for identification; plus three crops of one region (two with the same uv, one with a nudged uv) | **All rendered where placed [PROVEN].** The moved crop is a live, curved continuation of the window. It was registered as a laser target of Steam main. Two crops with identical key and uv both render |
| E16 (see §6.2) | SteamVR's own interactive systemui panels resize with their DOM, and their laser targets follow |

### 2.3 What is not proven, and why it cannot be tested without a human

- **[UNPROVEN]** that a real laser click on a **moved** crop lands at the element's position in Steam's window.
  - This is expected from §2.1, but nothing in SteamVR fires a laser without a controller pointing at it.
  - **Checked:**
    - the `lasermouse` mailbox: only `dump_laser_overlays`, `remote_laser_mouse_events` (VR Link remote state) and `force_activate_laser_mouse`;
    - systemui's `DebugPointer` and `window.toggleDebugPointer()`: they only visualise mouse events the page already receives;
    - `vrcmd` (`--send-vrevent` posts raw VR events to an overlay and bypasses the hit test, so it cannot prove the mapping; not used, because it would click Steam);
    - `VRDashboardManager.SendOverlayButtonPress` and `VRLink.SendDesktopWindowClickRequest`: overlay buttons and desktop windows, not laser hits;
    - the `laserMouseDebugging` setting: changing settings is forbidden.
- **[UNPROVEN]** what happens to the input focus stack when a crop is clicked.
  - SteamVR pushes the clicked panel's sgid (`focus_panel`).
  - With `steam-input-appid: 769`, focus should resolve to Steam, as it does for bar popups.
- **[UNPROVEN]** hover hand-off between a crop and Steam's panel behind it, and the laser on fully transparent texels (§6.3).

### 2.4 The parallax problem with today's non-interactive pops

- `lgs_sg.js` pops crops at `dz` with `interactive:false`, so the laser passes through them and hits Steam's real panel on the window plane behind.
- The hit is therefore offset from what the user sees by `dz_m × tan(θ)`, where θ is the laser's angle to the window normal:

| dz (units) | dz at r = 1 | θ = 30° | θ = 45° |
|---|---|---|---|
| 0.015 (header capsules) | 5.5 mm | 3.2 mm ≈ 4 CSS px | 5.5 mm ≈ 7 CSS px |
| 0.03 (menus, sheets) | 11 mm | 6.4 mm ≈ 8 CSS px | 11 mm ≈ 14 CSS px |

- A 40–48 px menu row can therefore take a click meant for its neighbour.
- SteamVR also draws the laser dot on Steam's panel, behind the crop, where the crop may hide it (the NATIVE.md risk "cursor dot hidden").
- **Recommendation:** make popped crops interactive.
  - Use the same key and uv, `interactive:true`, `steam-input-appid:769` and `can-take-keyboard-focus:true`, exactly as SteamVR's `PooledPopup` panels do.
  - The hit is then computed on the crop itself and maps to the same Steam pixel. The dot lands on the crop.
  - Registration is [PROVEN]. The click is [PLAUSIBLE] (the bar popups' mechanism).
- Keep **glassd covers and slabs non-interactive**: they are glassd overlays, and a hit there would send mouse events to glassd.

### 2.5 Moving a crop leaves a "ghost" behind

- If a crop is moved and its original area is covered (non-interactive glassd cover or mosaic), the laser still hits Steam's real element at the old spot.
- This is functionally harmless (it is the same element), but it is an invisible hit area.
- **Options:**
  1. **Ornament by inset (preferred, no routing risk).** T1 lays Steam's page out so the ornament's content sits in its own strip of the 1280×720 texture, outside the area the window glass covers. Examples:
     - the search capsule in a top strip;
     - an action capsule overlapping the bottom edge.

     The glass cover's `shapes` (glassd supports `surfaces[].shapes`) cover only the content area, so the strip shows as a separate floating capsule at its original x/y. It is popped in stereo by an in-place (interactive) crop.

     This gives the visionOS toolbar and ornament look, with all input native. §7 restores the content's physical size if strips eat pixels.
  2. **Moved interactive crop + blocker.** Put a `visibility:3`, `interactive:true` panel on the old spot, keyed to an empty `system.systemui` atlas region. Its registration is [PROVEN]; whether it swallows the click is [UNPROVEN].
  3. **Steam-native popup ornament** (§3): a real Steam window of its own, so there is nothing to route.

### 2.6 Recipes

**Interactive in-place pop (fixes parallax).** In `lgs_sg.js`'s `panelProps()`, for `kind === 'pop'` only:

```js
{ key: steamKey, uv_min, uv_max, 'meters-per-pixel': M, origin: [0,0], curvature: 'inherit-from-parent-panel',
  interactive: true, 'steam-input-appid': 769, 'can-take-keyboard-focus': true, visibility: 0, reflect: 0 }
```

**Moved interactive crop (ornament).** Under the one `reparent-to-panel` for that surface:

```
panel-anchor {anchor-u: cx/texW, anchor-v: cy/texH}         // the element's own centre
  vsg-transform translation="dx dy dz"                       // the move, in scene units (§1.1)
    panel {…as above…}
```

Verify on the device without a human:

1. `DumpLaserOverlays` lists the crop with `overlayHandle_key` = the Steam key and the expected `fWidth`/`fHeight`.
2. The focus stack (`RegisterForInputFocusDebugInfo`) is unchanged.
3. An `hvgrab` shows it, with a debug `tint` wrapper. The camera must see the spot (§9).

---

## 3. Dashboard popups (Q2)

### 3.1 The Steam side: `window.vrPooledPopupStore` (SharedJSContext)

Module `12030` in Steam (find it by the text `ShowDashboardPopup`). The store keeps pools of hidden Steam popup windows ("hosts") per type:

| Type | Overlay key prefix | Window (CSS px) | Pool min–max | Used by Steam for |
|---|---|---|---|---|
| 0 | `valve.steam.gamepadui.bar` | 1200×80 | 1–1 | the dashboard bar (`special_identifier` 1) |
| 1 | `…barpopup` | 300×1024 (CSS vars) | 1–2 | + menu, bar menus |
| 2 | `…tooltip` | 400×40 | 1–3 | bar tooltips |
| 3 | `…frame.menu` | 300×800 | 0–4 | the window frame's left menu |
| 4 | `…loginqrcode` | 500×500 | 0–1 | login QR code |
| 5 | `…volumelevel` | 250×100 | 1–1 | volume HUD |
| 6 | `…mainmenu` | 300×800 | 0–1 | legacy floating main menu |
| 7 | `…vrcontrollers` | 1200×800 | 0–1 | VR controllers popup |
| 8 | `…floatingfooter` | 600×40 | 1–1 | footer legend under the window (`special_identifier` 3) |

**API:**

1. `id = store.CreatePooledPopup(type, hookParams, onStateChange)`.
2. The instance's `contentElement` (a `div.PopupContent` in the host window) appears when a host is free. Render into it.
3. Steam then waits for children, measures the element and sends the request. `clip_rect` is the content's bounding box over the host window size.
4. State values: `0` awaiting host, `1` pending, `2` shown, `3` closed, `4` failed.
5. `store.SendPendingInstanceParamsToSteamVR(inst, params)` updates a live popup.
6. `store.ClosePooledPopup(id)` hides it and frees the host.

**Request fields** (`CVRGamepadUI_Message_ShowDashboardPopup_Request`):

| Field | Meaning (as rendered by systemui's `PooledPopup`) |
|---|---|
| `parent_overlay_key` | Attach to this overlay's panel (`reparent-to-panel`). Alternatives: `parent_device_path` (device-locked), or with `parent_enum: 2` an **elastic head-follow** (rotation thresholds 10°/5°, ease-out 20°, 75°/s) |
| `origin_on_parent {x,y}` | Anchor on the parent, normalized −1…1 (x right, y up) on its displayed rect |
| `origin_on_popup {x,y}` | Which point of the popup sits on the anchor (also aligns the content in the host window) |
| `offset {x_pixels,y_pixels,z_pixels, x_meters,y_meters,z_meters}` | Translation = metres + pixels × Mp, in the parent's local units (§1.1). Steam multiplies pixels by the window DPR (1.5). With no z, Steam adds `z_meters: 0.01` |
| `rotation {pitch_degrees, yaw_degrees}` | Rotation about the popup origin |
| `scale {scaler_value}` | Multiplies Mp: **larger popups at the same CSS size** |
| `inherit_parent_pitch` (default true), `inherit_parent_curvature` (default true) | Orientation and curvature inheritance |
| `interactive` (default true), `only_visible_with_laser` (default false) | Laser target; laser-only visibility |
| `sort_order` | `1` = drawn on top (sort-order 101, no depth test or write) |
| `special_identifier` | 1 bar, 2 legacy main menu, 3 floating footer |

What Steam sends today (read live):

| Popup | Parent | Anchor on parent | Offset |
|---|---|---|---|
| + menu (barpopup) | bar | x −0.38, y 1 | popup bottom-centre on it, y +15 px, z 0.01 → **≈ 3.7 mm** in front |
| Tooltips | bar | — | y −45 px, z 15 px → ≈ 8 mm |
| Frame menu | none: placed by the frame's left side panel, under the frame transform | — | interactive, `only_visible_with_laser: true` |
| Floating footer | `special_identifier 3` | — | — |

### 3.2 Proven: a Steam popup as an ornament (E2)

1. The ornament went into an idle barpopup host (type 1), so no new window was spawned.
   - Content: a vertical 80×360 CSS px capsule with five 56 px circles.
   - Params: `parent_overlay_key: main`, `origin_on_parent {-1,0}`, `origin_on_popup {1,0}`, offset x −24, z +40 CSS px, `interactive`, `inherit_parent_curvature`.
2. systemui built `reparent-to-panel(main) > panel-anchor > transform(-0.0551, 0, 0.0919) > panel(barpopup, uv = clip, mpp 0.00153)`.
   - The translation is 36 × Mp and 60 × Mp, as predicted.
   - It became a laser target 0.159 × 0.714 units, keyboard-capable, app id 769.
   - The headset view showed the capsule floating left of the window's leading edge, like the visionOS TV/Music tab bar.
3. A live update via `SendPendingInstanceParamsToSteamVR` to z 160 px (0.245 units ≈ 7.8 cm today), `scale 1.5` and `yaw 20°` gave:
   - mpp 0.0023;
   - laser target 0.238 × 1.071;
   - a capsule toed in toward the user.
4. On close, the host pool was identical before and after.
5. **First-paint latency:** in both runs the popup was **not yet visible 1.0 s after state `2`**; it was visible about 2.5 s later.
   - Open ornaments early (hidden content, or `opacity:0` in the host) and reveal them with CSS.
   - Keep them open, rather than opening them on demand.

### 3.3 Asking for Steam's own popups further forward or larger

- **[PLAUSIBLE]** Wrap `vrPooledPopupStore.SendPendingInstanceParamsToSteamVR` (instance method, in memory, restore on theme off). Add `offset.z_pixels` and `scale` per host type, e.g. bar popups at +3 cm and ×1.15.
- The parameter path is exactly the one E2 exercised. The wrapper itself was not run on Steam's real popups.
- **Limits:**
  - A popup's pixels are capped by its host window (300 px wide for bar popups and frame menus).
  - Pools are small: borrowing the only `vrcontrollers` or `mainmenu` host queues Steam's own popup of that type until ours closes.
  - Use the multi-host pools for long-lived ornaments: type 3 has up to 4 hosts, type 1 up to 2.
- **Context menus and dialogs are not popups.** They are modals inside the main window's texture. They can only come forward as crops (§2.6, interactive to avoid parallax) or be re-hosted by T3 (CQ10).
- **Gamepad:** a popup window gets controller input when its panel holds input focus, as bar popups do. Making an always-visible ornament part of Steam's main nav tree is a T3 question (CQ8).

---

## 4. Animation (Q3)

### 4.1 What the scene graph offers

| Mechanism | Finding |
|---|---|
| Animated translation `{channel, interp, from, to}` (serialized as 8 numbers, interp Constant/Nearest/Linear/SmoothStep/SmootherStep) | **[NO]** The only channels are `TheaterFast` and `TheaterSlow`, driven by the compositor's theater transitions (`VRCompositor.SetAnimatedValue` / `set_animated_value`). Driving them would also move the dashboard's own animated transforms |
| `tint-anim {color: [r,g,b, r,g,b…], animation-seconds}` | **[PROVEN] loops forever.** A copy wrapped in a 4 s tint-anim cycled between brightness 22 and 44 (static copy 40) over 9 s of captures (E7). Only for throbbing, which the design rules forbid |
| `grab-transform` (`lerp-speed` 15.75), `elastic-head-transform` (ease-in/out thresholds) | Behaviours (user drag, lazy head-follow), not tweens. The elastic head-follow is useful for HUD toasts (§3.1 `parent_enum 2`) |
| `opacity {opacity}`, `tint {color}` | Static values: animate by pushing |

### 4.2 Push-driven animation [PROVEN]

| Push rate | Achieved (mean / max gap) | Payload | vrcompositor CPU (one core) |
|---|---|---|---|
| idle | — | — | 17.7 % |
| 30/s | 33.3 / 37.6 ms | ≈ 22 KB (the whole graph every push) | 22.8 % (+5.1) |
| 60/s | 16.3 / 20.1 ms | ≈ 22 KB | 27.4 % (+9.7) |
| 90/s | 11.3 / 15.5 ms | ≈ 22 KB | 31.5 % (+13.8) |

The JavaScript side costs 0.07–0.1 ms per call (E3, E8). The serialization is deferred to a `setTimeout(0)`.

**Recipe:**

1. Sample the motion spec's spring (`docs/phase2/research/liquid-glass-motion.md` §3, e.g. `depth` d 0.30 b 0, `sheet-in` d 0.50 b 0) in JS.
2. Push at **60/s only while a value changes**, then push the final value once and stop.
3. A 441 ms depth settle costs about 26 pushes, about 40 ms of compositor CPU.
4. Prefer depth (z) and dim/opacity for scene-graph motion. Keep x/y motion of content in CSS: the crops are live, so CSS motion shows at CEF's frame rate.
5. Under Reduce Motion, push the end state once.

The research doc's "≤ 30 Hz" assumption can be relaxed to 60/s for short transitions.

---

## 5. Window push-back and dim (Q4) [PROVEN]

The Steam frame page hangs under three transforms in systemui (React-owned):

```
vsg-transform scale=S, ignore-parent-scale, parent-id=<dock transform>      (dashboard scale)
  vsg-transform scale=scaleForActivePage (1)
    vsg-transform translation=panelTranslationForResizeOrigin (0 0 0)        <- "t1": the one to use
      vsg-node mountedscenegraph {mountable_id: frame:<id>:page:3:mountable} (Steam's main panel)
```

E4 results:

| Override of t1 | Result |
|---|---|
| `t1.buildNode = (c) => [c, {type:'tint', properties:{sgid: <t1 sgid>, color:[.4,.4,.4]}}]` | Whole Steam window dimmed |
| Same with `{type:'opacity', properties:{sgid, opacity:.45}}` | Window translucent: the room shows through |
| `t1.setAttribute('translation', '0 0 -0.3')` | Window receded about 0.3 units (≈ 11 cm at r = 1, 9.6 cm today). It stayed a laser target (main panel target unchanged) |
| Restore: `delete t1.buildNode`, translation back to its saved value, push | Identical to before |

Find t1 as the parent of the `mountedscenegraph` whose `mountable_id` matches `frame:\d+:page:3:mountable`.

**Notes:**

- **Panels reparented to main follow the recede**, because `reparent-to-panel` uses the panel's world transform: glassd covers, crops and popups parented to main. They are outside t1's subtree, so **tint and opacity do not reach them**.
  - A popped sheet crop at its own x/y stays bright while the window behind it dims and recedes. This is exactly the visionOS sheet presentation, and it answers CQ7.
  - Dim the glassd cover with its own `tint` wrapper, or through glassd's `dial`.
- **Compose with t1's own translation, don't overwrite it.**
  - In theater and hand docks `panelTranslationForResizeOrigin` is non-zero.
  - React may rewrite the attribute when it changes. Re-apply on each push.
- Keep `scale` changes off t1. A scale changes the window's angular size and the mapping of glassd's quads.
- **Animate** with §4.2:
  - `sheet-in` (735 ms settle): about 44 pushes at 60/s;
  - z from 0 to −0.15 units (≈ 5 cm);
  - tint from 1.0 to 0.55.

---

## 6. Window bar, frame controls, Home view (Q5)

### 6.1 SteamVR's chrome around the window (systemui atlas panels)

| Element | Panel | Size rule | Placement node |
|---|---|---|---|
| Grab handle (moves the whole dashboard) | `GrabHandle`, `system.systemui` atlas | Fixed width 0.66675 units × uniform scale; height from the DOM aspect | Under the dashboard bar (`DashboardGrabHandleTransform`, y −0.1 from the bar's bottom), inside `opacity > tint` (GrabHandleTint) |
| Frame controls (keyboard, float in world, theater, more) | `legacy-frame-controls-<frameID>` | **meters-per-pixel 0.001574 scene units per CSS px: the size follows the DOM** | `frame:<id>:bottom-controls-transform` > `vsg-transform y -0.04` under the window |
| Resize corner | `ResizeHandle`, width 0.1 | Fixed | Window corner |
| Left frame menu (Home, Library, Store, Friends, Media, Downloads, Settings, VR Settings, Power) | Steam popup `frame.menu.<id>` (type 3) | Its host window, 300×800 | The frame's left side panel, beside the window's **leading edge**; laser-only |

### 6.2 Larger frame controls with CSS [PROVEN, E16]

- A temporary systemui style made the frame controls larger:

  ```css
  [class*="FrameControlsContainer"] .ButtonControl{padding:18px 30px}
  [class*="FrameControlsContainer"] svg.Icon{width:56px;height:56px}
  ```

- The container went from 314×51 to 524×92 CSS px.
- The quad and its laser target grew to match, from 0.494 × 0.081 to 0.825 × 0.145 units (exactly proportional). The headset view showed larger circular controls. Removing the style restored both.
- **This lifts the "hard limit" in `audit/shell-nav.md` §C.7.** Meters-per-pixel SteamVR panels (frame controls, their tooltips, More Options, the gamepad-mode pill) can grow to 60 pt targets in T1:
  - The panel's uv comes from the DOM rect, and systemui receives the laser at atlas coordinates, so input stays consistent by construction.
  - Keep the atlas within 1860×2048 and never paint row 0 (`docs/inventory/steamvr.md` §2.1).
- **Fixed-width panels behave differently.** The grab handle and the resize corner keep their width; a larger DOM only changes their aspect.
- **Moving the frame controls** (e.g., into a capsule beside a visionOS-style window-bar pill) uses the t1 technique (§5) on `bottom-controls-transform`'s child. That is [PLAUSIBLE]: same technique, not run on that node.

### 6.3 The frame menu is already a visionOS tab-bar ornament

- Steam's left frame menu is a separate interactive popup that SteamVR places beside the window's leading edge.
- It expands 500 ms after hover and collapses 800 ms after the pointer leaves (`docs/inventory/bar.md` §3).
- Restyle it as a vertical glass capsule (T1 + glassd cover, `theme/layers.json` `frame.menu`).
- **CQ3** (show it without the laser): its popup params carry `only_visible_with_laser: true`. Two ways to show it always:
  - a T3 wrapper on `CreatePooledPopup` (type 3) that clears the flag before Steam sends it;
  - or `SendPendingInstanceParamsToSteamVR` with the flag cleared, for the live instance.

  Both are [PLAUSIBLE]: the flag is a plain request field that §3.2 showed is honoured. Whether gamepad focus can enter it is [UNPROVEN] (inventory N2 says it does when shown).

### 6.4 Home view: icons with no window [PROVEN visually, E6]

- Steam's main overlay has per-pixel alpha. With every background in the main window made transparent, the circular app icons floated over the room with no window at all.
  - The CSS was `background-color: transparent; backdrop-filter: none; box-shadow: none` on every element except images.
  - The leading-edge frame menu stayed as an ornament.
- **Reading over passthrough:**
  - The icon art read well.
  - Small labels and subtitles lost contrast over a busy room.
  - Buttons whose fill was `background-color` became bare text.
- **Design rule for a Home route:**
  - icons on their own plates (opaque art, or a glassd `liquid` slab per icon; keep a surface under 24 layers);
  - labels with a vibrancy plate or a strong text shadow;
  - every button keeps a fill;
  - no window cover: `theme/layers.json` main `cover` already excludes `BasicHome … TransparentBackground`.
- **[UNPROVEN]** whether the laser hits transparent texels.
  - `bIgnoreTextureAlpha` in the laser dump is the rendering flag, not a hit-test rule.
  - SteamVR most likely hit-tests the whole quad. The cursor would then sit on empty space between icons, and scrolling works anywhere in the window rect. That is close to visionOS's invisible window bounds.

---

## 7. Size and scale (Q6)

| Lever | Result |
|---|---|
| Frame node `override-pre-resize-main-panel-height` (wrap the frame-node element's `buildNode` and set the property, then push) | **[PROVEN, E5b]** 1.5 → 1.8: the window became 20 % larger at the same CSS layout, its bottom edge fixed (`main-panel-origin [0,-1]`). The main laser target followed (1.2951 → 1.5542 = × 1.2). Restoring the original `buildNode` returned 1.2951. **Crops must then use M = H0'/1080**: `lgs_sg.js` reads M from the frame node, so wrap before it reads, or push the new M in the spec |
| `FrameStore.frames[0].size.componentProps.forcedUniformDashboardHeight = 1.8` | **[NO]** No effect: `componentProps` is derived from React props each render |
| User resize (resize corner, 0.25–2×) | Native, persists in SteamVR's frame state. It multiplies everything (r, §1.1). Do not set it programmatically |
| Popup `scale.scaler_value` | **[PROVEN]** ×1.5 in E2 |
| Steam main window `SteamClient.Window.ResizeTo` (more CSS px) | **[UNPROVEN, not tried]** It would change the texture size and Steam's layout for every agent on the shared UI. Test only with the lab lock and an agreed plan |
| CSS `zoom` on Steam's page (bigger elements, fewer CSS px) | T1 territory. Chrome 126's `zoom` interacts with `getBoundingClientRect` and virtualized lists |
| Panel `target-dpi-panel-id` / `target-dpi-multiplier` | Properties exist in the compositor and systemui panel class. **[UNPROVEN]** |

**Recommendation:** to reach 60 pt targets without starving Steam's layout of pixels, combine a moderate T1 size increase with a frame-height override of about 1.6–1.7 (+7–13 %). The window stays within comfortable angular size (about 50°). Keep it in the daemon (re-wrap when React replaces the frame node) and restore it on teardown.

---

## 8. Other building blocks found in the compositor (`systemlayer` / `vrcompositor` strings)

**Node types:**

- placement and following: `group`, `dashboardtransform`, `grab-transform`, `grab-scale`, `remote-transform`, `resize-handle`, `frame-node`, `associated-frame-node`, `trackingstatevisibility`, `elasticheadtransform`, `head-facing-transform` (billboard), `pin-to-view-transform`, `callout-transform`, `line-constrained-transform`, `constraint`;
- content: `texture`, `rendermodel`, `rendermodel-component-overrides`, `tilefloor`, `playspace-*`, `ltcquad`, `videocapturequad`;
- the panel family and effects: `panel-anchor`, `reparent-to-panel`, `mountable`, `mountedscenegraph`, `opacity`, `tint`, `tint-anim`, `systemui-root`, `audiosource`.

Only `panel`, `panel-anchor`, `reparent-to-panel`, `transform`, `tint`, `tint-anim`, `opacity` and `mountedscenegraph` (via t1) were used here. The rest are **[UNPROVEN]**.

**Panel properties worth knowing:**

| Property | Use |
|---|---|
| `interactive`, `steam-input-appid`, `can-take-keyboard-focus` | Laser target; owner of gamepad input |
| `visibility` | 0 visible, 1 skip, 2 hidden, 3 invisible but intersectable |
| `sort-order`, `sort-depth-bias`, `no-depth-test`, `no-depth-write` | Layering |
| `hide-laser-intersection`, `hide-laser-when-clicking` | Laser dot |
| `focus-outline` | SteamVR's gamepad-focus outline. A green outline around the main window was seen once in this study, while the main panel held gamepad focus |
| `curvature: inherit-from-parent-panel` | A crop outside the window continues the window's cylinder, so moved ornaments face the user |
| `scrollable`, `only-visible-with-laser`, `stereoscopy`, `sampler`, `reflect` | — |

**The `scene_graph` mailbox:** `focus_panel {sgid}`, `defocus_panel`, `dbg_recompute_input_focus` and `dbg_clear_input_focus_stack` (systemui's `InputFocusStore`). These could hand gamepad focus to an ornament popup. [UNPROVEN]; do not use on the shared UI without a plan.

---

## 9. Hygiene rules (learned on the device)

1. **Always retire removed sgids.**
   - Removing nodes from the DOM is not enough. Send their sgids as `retired_sgids` through the scheduler module's retire export (`Lx`, found by source text, as in `lgs_sg.js`).
   - Without that, the compositor keeps the nodes.
   - Observed: after about 45 probe panels had been removed without retiring, newly injected panels still registered as laser targets but no longer rendered. The same side-crop placement failed at 00:24 and rendered at 00:28.
   - Retiring the 239 leaked ids (the probes' own sgid ranges, minus every live sgid) brought rendering back at once. The likely cause is the stale `reparent-to-panel` registrations; that cause is [UNPROVEN].
   - `p2s_sg.js` `clear()` now retires; `lgs_sg.js` already does.
2. **One `reparent-to-panel` per parent**, as `docs/NATIVE.md` §"Scene-graph facts" says.
3. **Main-window crops only render while the Steam page of the dashboard frame is shown.**
   - Now Playing and SteamVR Settings hide it. Other agents switch pages often.
   - Check that `DumpLaserOverlays` lists `valve.steam.gamepadui.main_sgid…` before capturing.
4. **Place test panels where the headset's current view sees them.**
   - The headset is not worn, so the view is wherever it lies.
   - Avoid the band behind the bar (§1.3).
   - Use a debug `tint` wrapper to identify copies.
5. **Restore React-owned overrides** (`buildNode` on t1 or the frame node, attributes) in `finally`, and add a TTL timer in the page, so a dead driver still restores.
6. Hold `/tmp/lgs/lab-vr.lock` for systemui experiments, plus `/tmp/lgs/lab.lock` when touching Steam (popups, CSS), for the whole inject–capture–remove sequence.

---

## 10. Reproduce

Files: `docs/phase2/capabilities/spatial-probe/p2s_probe.py` (driver, run on the Frame) and `p2s_sg.js` (systemui injector with retire).

```bash
FR=~/.claude/skills/steam-frame-ssh/scripts/frame_ssh.py
python $FR run "mkdir -p /tmp/lgs/p2s"
for f in p2s_probe.py p2s_sg.js; do MSYS_NO_PATHCONV=1 python $FR put docs/phase2/capabilities/spatial-probe/$f /tmp/lgs/p2s/$f; done
python $FR run "cd /tmp/lgs/p2s && env -u LD_LIBRARY_PATH -u LD_PRELOAD /usr/bin/python3 p2s_probe.py e15"
# fetch /tmp/lgs/p2s/*.png, look, delete them locally and on the Frame; then:
python $FR run "cd /tmp/lgs/p2s && env -u LD_LIBRARY_PATH -u LD_PRELOAD /usr/bin/python3 p2s_probe.py cleanup; rm -rf /tmp/lgs/p2s"
```

| Probe | Shows |
|---|---|
| `e1` | Interactive crop registration and focus stack |
| `e2` | Steam popup ornament |
| `e3` | tint-anim and push rates |
| `e4` | Dim, fade, recede |
| `e5` | componentProps (no effect) |
| `e5b` | Frame-height override |
| `e6` | Transparent window |
| `e7` | tint-anim timeline |
| `e8` | Compositor CPU per push rate |
| `e15` | Moved crop and multiple crops |
| `e16` | Frame controls enlarged |

`e9`–`e14` are the bisection steps of rule 1 in §9.

`hvgrab` (`~/glass-shell-native/native/spike/hvgrab out.png [scale]`) takes about 0.15 s per capture.

---

## 11. T5 (glassd) for the redesign

From `native/glassd/README.md` [PROVEN-P1], plus what Phase 2 needs from it.

### 11.1 What glassd can do

| Capability | Detail |
|---|---|
| Surfaces | Per-surface glass of the room behind every Steam surface: window, panel, liquid and thick materials, with frost, lensing bezel, dispersion, adaptive tint, light from above and an inner shadow |
| Slabs | Liquid Glass slabs under popped elements |
| Partial covers | `surfaces[].shapes`, for partial windows, ornament strips and Home-view plates |
| Cost | 0.8–1.4 ms GPU at up to 72 Hz |

### 11.2 Changes Phase 2 needs

1. **Moved ornaments.**
   - Slab world points assume "element position on the surface + dz". A slab under a moved crop samples the room at the wrong place.
   - Add a per-slab offset (the crop's transform translation in scene units, × S × r) to `glassd.json`.
2. **Ornaments outside the main window's mask zone.**
   - The feed mask is the main window's rect plus 0.15 m at the sides, 0.08 m on top and 0.25 m below.
   - Ornaments further out (e.g., a tab bar beyond 0.15 m to the side) would be seen by the camera and leak UI into the room map.
   - Send their world quads as extra mask rects.
3. **Steam popup ornaments (§3)** are Steam surfaces like bar popups. Report them under their `keyPrefix` with a `cover` shape so glassd draws their glass.
4. **Recede and dim (§5).**
   - Reparented glassd covers recede with the window automatically.
   - Their dimming must come from a `tint` wrapper on the cover node, or from glassd's `dial`. Use the `thick` material for the sheet.
5. **Morphs and highlights.** glassd renders at up to 72 Hz, so glass shape morphs (menu grows out of its button) and head-coupled highlights belong in glassd, driven by the spec. Do not drive them by scene-graph scale changes.

---

## 12. Open items that need the wearer (cannot be closed by agents)

| Item | Why | Quick check when the user is available |
|---|---|---|
| Click on a moved interactive crop lands on the right Steam element | No laser injection (§2.3) | Green-tinted moved header crop: click "Back" and the search field; check the route and focus |
| Click on an in-place interactive pop (parallax fix) | Same | Pop a menu at 0.03 units, click each row at a steep laser angle |
| Laser dot visibility on crops and covers | Rendering of the cursor | Point at popped and covered areas |
| Laser on transparent window pixels (Home view) | Hit-test rule | Point between icons; scroll |
| Gamepad focus entering an always-visible frame menu or popup ornament | Steam's nav across windows (CQ8) | D-pad left from the window's first column |
