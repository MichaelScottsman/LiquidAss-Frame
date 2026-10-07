# SteamVR inventory: vr:systemui, vr:controllerbindingui, vr:keyboard and the on-demand SteamVR pages

Area id: `steamvr` (prefix `vr_` for shots). Theme files: `theme/vr/*.css` (see DESIGN.md §9, LAB.md "SteamVR's own pages").

Mapped live on 2026-10-06 against SteamVR web UI build `CLSTAMP 11065908` (vrwebhelper pages served from `127.0.0.1:27062/dashboard/`, devtools on port 8090). Every `%{Token}` below was resolved with `L.index.selector()` inside the SteamVR page it belongs to. Page sources were read from `/opt/steamvr/resources/webinterface/dashboard/` (prettified copies are easy to make again; line references below are to the prettified files).

Shots are in `shots/vr_*.png`. **SteamVR pages capture at 1x** (`devicePixelRatio` 1), not 1.5x like Steam's surfaces. Transparent areas show black or white in the PNG and the room in the headset.

Pre-JS helpers used for the state shots are in `docs/inventory/steamvr-pre/*.js`. Each one only changes what is painted, and reverts itself after a few seconds; the header comment of each file says exactly what it touches. Use them as `--pre "$(cat docs/inventory/steamvr-pre/NAME.js)"`.

---

## 0. Every SteamVR page at a glance

| Page (surface) | URL / size (CSS px) | Present when | How to make it render reproducibly | Side-effect free? | Before-shots |
|---|---|---|---|---|---|
| `vr:systemui` | `systemui.html#general_settings`, **1860×2048 atlas** | always (SteamVR's system UI) | already rendering; states via the pre-scripts in §2 | yes (state emulation only) | `vr_sys_before`, `vr_sys_hover_before`, `vr_sys_focus_active_before`, `vr_sys_tooltip_before`, `vr_sys_moreoptions_mock_before` |
| ↳ Now Playing (panel of `vr:systemui`) | panel 1858×1045 inside the atlas | a scene app runs **and** the dashboard is open on its "Now Playing" frame | start the Liquid Glass Frame showcase, then `np_open.js` (§2.7) | showcase start/stop is sanctioned; opening the dashboard is what the Steam button does | `vr_np_before`, `vr_np_states_before`, `vr_np_resumefocus_before` |
| ↳ SteamVR Settings (panel of `vr:systemui`) | panel 1858×1045 inside the atlas | Steam dashboard frame switched to its `system.settings` page (Steam's frame menu, surface `frame.menu`, › **VR Settings**) | `settings_open.js` while holding the Steam lab lock (§2.8) | page switch only, auto-reverts after 4.5 s; hides Steam main in the headset meanwhile | `vr_settings_before` |
| `vr:controllerbindingui` | `controllerbinding.html`, 2400×1350 | always loaded; shown as page 2 of the Steam dashboard frame | app list renders now; list/view via `bind_list.js`, `bind_view.js` (§3) | read-only navigation, auto-returns to the app list | `vr_bind_apps_before`, `vr_bind_apps_more_before`, `vr_bind_list_before`, `vr_bind_view_before` |
| `vr:keyboard` | `keyboard.html`, 1920×1080 | loaded lazily (appeared during this session); renders only while SteamVR's own keyboard is requested | `kb_show.js` (§4) | React state only, no VRHTML call | `vr_kb_before` |
| `messageoverlay` | `messageoverlay.html` | only after an app calls `IVROverlay::ShowMessageOverlay` | no safe trigger (§5.1) | — | — |
| `notificationtoast` | `notificationtoast.html` | only while SteamVR renders a notification toast (`toast_renderer/main` mailbox) | no safe trigger (§5.2) | — | — |
| `bindingcallouts` | `bindingcallouts.html` | only when an app requests binding callouts (`request_binding_callouts`) or a tutorial callout | no safe trigger (§5.3) | — | — |
| `settings_desktop`, `systemreportviewer`, `debugcommands` | `*.html` | desktop (monitor) windows; never in the headset UI on the Frame | not reachable in VR (§5.4) | — | — |

`python glass.py surfaces` prints the live list (`SteamVR pages: vr:…`). Today: `vr:systemui`, `vr:controllerbindingui`, and (from about 22:05) `vr:keyboard`.

---

## 1. Shared facts for every SteamVR page

- **One document per page, no SharedJSContext.** Each page is its own CEF target; `lgs_vr.py` injects one `<style id="lgs-theme">` and `html.lgs-on` per page. Steam-only lab helpers (`nav`, `pad`, `mark/restore`) don't exist here; `outline`, `styles`, `classes`, `q/qa`, `click`, `snap/diff` (audit) work.
- **Two kinds of class names.**
  - Hashed CSS-module classes (`grabhandle_GrabHandleButton_1kjlA`) → write them as tokens (`%{GrabHandleButton}`); they resolve from `webpackChunkvrwebui`.
  - SteamVR's legacy **global, unhashed** classes (`ButtonControl`, `WithIcon`, `LargeIcon`, `DashboardPanel`, `NowPlaying`, `SettingsMain`, `Tab`, `AppSelectContainer`, `VRKBKey` …) → write them literally (`.ButtonControl`). Most of the binding UI, Now Playing, Settings and the keyboard are global classes.
  - Ambiguous names: `%{Primary}`, `%{ForceActive}`, `%{Fading}`, `%{Title}`, `%{Body}`, `%{ButtonRow}`, `%{ButtonControl}` are ambiguous → use `%{GamepadUIButton>Primary}`, `%{GrabHandleBar>ForceActive}` / `%{ResizeHandleButton>ForceActive}`, `%{FramerateRoot>Fading}`, `%{RoomSetupContainer>Title}` and so on. `%{Section}`, `%{Container}`, `%{Disabled}` resolve uniquely today but are generic; prefer the anchored forms `%{FrameControlsContainer>Section}`, `%{ButtonPill>Container}`, `%{ButtonPill>Disabled}`.
- **Root font size differs per page** (`1rem`): systemui `html.VROverlay` 32px (panels set `font-size:24px`), controller binding 24px, keyboard 16px.
- **SteamVR's palette** (CSS variables on `:root`, read live in systemui): `--gamepadui-darkest-grey` #0e141b, `--gamepadui-darkish-grey` #171d25, `--gamepadui-darker-grey` #23262E, `--gamepadui-dark-grey` #3D4450, `--gamepadui-grey` #67707b, `--gamepadui-lightest-grey` #dcdedf, `--dashboard-control-bar-button-color-a` #3d4450, `--text-color` #DEE2E5, `--buttondefault` #23262E, `--buttonhover` #3D4450, `--settings-control-inner-border-radius` .3rem, `--dashboard-panel-padding` 2rem, `--button-fade-time` .15s, `--text-font` "Motiva Sans", Arial. Binding UI adds `--tabbackground` #3d4450, `--tabbackgroundselected` #24272d, `--tabbackgroundhovered` #586170, `--backbuttonbackground` #586170, `--warningbackground` rgb(145,123,24). Advanced settings use `--settings-advanced-control-background-color` #493b4b (the purple fills).
- **Focus model.** SteamVR does not use Steam's `FocusNavController`. Laser hover is plain `:hover`. Gamepad focus is drawn with SteamVR's own classes: `%{GamepadFocused}`/`%{HasGamepadFocus}` (frame controls), `.gpfocus` added by React on `GamepadUIButton`s (Now Playing), nothing at all in the binding UI, SteamVR settings and the keyboard (they are laser-only; SteamVR shows the "Use Laser Mouse to Interact" pill under them). `L.pad()` does not work here, so state shots add those classes for a few seconds instead.
- **Hover emulation.** CDP screenshots can't hover. `sys_hover.js`/`np_states.js` clone each `:hover` rule to `[data-lgs-hover]` and mark elements. Rules written as `:not(:hover)` keep matching, so a hover shot can under-represent a hover (noted where it matters).
- **Hard rules specific to SteamVR pages** (on top of LAB.md's):
  - Never paint `html`, `body`, `#root`, `vsg-app`, `.AppSceneGraph`, `span` wrappers or any `vsg-*` element (systemui is an atlas, §2.1; the binding/keyboard pages are their own overlays and paint only their own containers).
  - Never change the box size of a **panel root** (§2.1): it changes the physical size of the VR quad and its placement.
  - Never touch inline `style` geometry SteamVR writes: `GrabHandleBar width:700px`, `.AppSceneGraph transform:scale(…)`, `div style="position:absolute;left:50%;top:50%"` tooltip/portal anchors, `vsg-node style="display:none"` (hidden panels), keyboard key `style="flex-grow…"` (the pressed/shift key's inline `background:#000` may be recoloured with `!important`, see §4, but must stay distinguishable).

---

## 2. `vr:systemui` (the atlas)

### 2.1 How the atlas works (read this before styling anything here)

Source: `chunk~336cd93ad.js` (module 5178, `SGApp`) and `chunk~1a88854fa.js` (panel class).

```
html.VROverlay                                    (transparent)
  body.VRGamepadUI.SGApp   style="width:100%;height:100%;margin:0;overflow:hidden"   background:#00000000
    div#root  (display:flex)
      vsg-app  [sg-forced-update-number]          margin-top:2px
        div.DebugPointer                          (display:none)
        canvas.EmbeddedData  1860×1 at top:0, z-index:9001      <- PANEL UV TABLE, see below
        div.AppSceneGraph   margin-top:10px; may get inline style="transform: scale(s); transform-origin: top left"
          span
            div.DashboardMain          <- dashboard frames, grab handle, frame controls, resize handles, Now Playing, Settings
            vsg-tracking-state-visibility
            vsg-node[vsg-type=panel] … <- controller status, transition, IPD, toasts of SteamVR, …
            div.Construct              <- tile floor etc. (no DOM paint)
        div.v-parent-portal  (display:inline) … tooltip panels re-parented here
```

- **Each `vsg-node[vsg-type="panel"]` becomes one VR quad.** Base CSS (chunk~66c0d1388.css): `[vsg-type="panel"]{display:inline-block; overflow:hidden; margin:2px 0 0 2px; font-size:24px; position:relative}`, `:empty{display:none}`, `[overlay-key]{display:none}`. Panels are simply laid out **in normal inline flow** inside `.AppSceneGraph`; the atlas position of a panel is wherever the flow puts it. Positions move whenever a panel appears or disappears, so **never key anything on atlas coordinates**.
- **UVs come from layout.** `updateLayoutValues()` takes `getBoundingClientRect()` of the panel's root element and divides by the window size. `SGApp.updateEmbeddedData()` writes those rects into **row 0 of the page** through `canvas.EmbeddedData` (pixel 0 = "VSG", then 3 pixels per panel). The compositor reads that scanline from the rendered page.
  - **Anything painted on row 0 corrupts every panel's UVs.** Never give `html`/`body`/`#root`/`vsg-app` a background, never put an element with `z-index` > 9001 at the top edge, never cover or restyle `.EmbeddedData`/`.DebugPointer`.
  - Unused UV slots are written as `rgba(0,0,0,0)`; a page background would show through them as garbage UVs.
- **Panel size is physical size.** A `ResizeObserver` on each panel root calls `forceLayoutUpdate()`. Panels size themselves either with a fixed width in metres (grab handle `0.66675 m × scale`, resize handle `0.2 m × scale`, transition `1.5 m`) where height follows the DOM aspect ratio, or with `meters_per_pixel = 2.667/1694` (≈1.57 mm per CSS px: frame controls, their tooltips, More Options, the gamepad-mode pill). Changing padding/border/width/height of a panel root resizes or reshapes the quad in the headset. Only colours, backgrounds inside the existing box, inset shadows, radii and filters are safe.
- **`overflow:hidden` on every panel**, plus the UV clip: outer shadows and glows are cut. Draw rims inset.
- **Compositor-side opacity and tint.** The grab handle and resize handle sit under `vsg-node[vsg-type=opacity]` and `[vsg-type=tint]`; in SteamVR dark mode the tint is `{r:.3,g:.3,b:.3}` (`GrabHandleTint`), so whatever the theme paints there is multiplied to ~30% brightness.
- **Laser-only visibility.** Grab handle, resize handle, frame controls, their tooltips and More Options have `only_visible_with_laser` (frame controls follow `frame.frameControlsVisibilityRequiresLaser`, true for the Steam frame). They are always painted in the atlas, but the headset shows them only while a laser points at the dashboard.
- **What is transparent today:** everything outside the panels; inside panels: the grab handle's 60px padding around its 12px bar, the 152×152 resize quad except the corner stroke, the gaps between frame-control sections, the controller-status card except its icons. Opaque today: the frame-control section pills (#23262E at container opacity .6), tooltip pill (rgba(0,0,0,.85)), Now Playing and Settings panels (#0e141b).

### 2.2 Atlas map

Idle (Steam dashboard open, no scene app). From `vr_sys_before.png` / outline:

| Panel (debug_name) | Panel root (DOM) | Atlas rect (x,y w×h) | Becomes in VR |
|---|---|---|---|
| `GrabHandle` | `div %{GrabHandleButton}` | 2,14 820×132 | the bar under the dashboard window (origin BottomCenter, 0.667 m wide), laser-only |
| `legacy-frame-controls-<frameID>` | `div %{FrameControlsContainer}` | 2,264 314×51 | the capsule row under the window (origin TopCenter, 1.57 mm/px), laser-only |
| `ResizeHandle` (`…main_Panel.ResizeHandle`) | `div %{ResizeHandleButton}` | 318,163 152×152 | bottom-right resize corner of the window (0.2 m × scale), laser-only |
| `controllerstatus_<deviceIndex>` (one per controller) | `div %{ControllerStatusRoot}` | 2,332 256×256 (and 260,332 for a 2nd controller) | texture on the controller model's `status` component (`rendermodel_component_name:"status"`), not a floating quad |
| `legacy-tooltip-<n>` (one per frame-control button) | `div.ControlBarButtonTooltip` | hidden (`vsg-node style="display:none"`); 2,605 271×65 while shown | pill 0.15 m above the hovered/focused button |
| `PooledPopup-valve.steam.gamepadui.*` | — | `display:none` (`[overlay-key]`) | Steam's own popups (bar, frame.menu, tooltip…). SteamVR only places them; they are Steam surfaces, not painted here |
| `persistent_notifications` | `div %{PersistentNotificationsContainer}` | 2,297 20×34 (seen during app start) | tracking-recording / casting indicators |

Now Playing open (scene app running, dashboard on its frame). From the outline in `vr_np_before`:

| Panel | Root | Atlas rect |
|---|---|---|
| `nowplaying` (`#nowplayingpanel`, main panel of frame page `system.dashboard.nowplaying`) | `div.ScrollPanel.DashboardPanel.NowPlaying` | 2,163 1858×1045 |
| `GrabHandle` | `%{GrabHandleButton}` | 2,14 819×132 |
| `legacy-frame-controls-<frameID>` (Float in World, View in Theater \| More Options \| wide gap \| **Close**) | `%{FrameControlsContainer}` | 2,1326 334×51 |
| `ResizeHandle` | `%{ResizeHandleButton}` | 338,1225 152×152 |
| controller status ×2 | `%{ControllerStatusRoot}` | 2,1394 / 260,1394 |

SteamVR Settings open: `#vrsettingspanel` `div.ScrollPanel.DashboardPanel.Settings` at 2,163 1858×1045, plus the **frame gamepad-mode pill** ("Use Laser Mouse to Interact") under it (see 2.5.4).

### 2.3 Window grab bar

Source `chunk~8012d0c89.js` ~28200–28290 (components `N`, `x`). CSS module `grabhandle`.

```
vsg-node[vsg-type=opacity] > vsg-node[vsg-type=tint] > vsg-node[vsg-type=panel]   (GrabHandle, sgid stable per session)
  div %{GrabHandleButton}           [2,14 820x132]  padding:60px; pointer-events:all   (transparent hit area)
    div %{GrabHandleBar}            [94,74 636x12]  style="width: 700px;"   (+ %{GrabHandleBar>ForceActive} while dragging)
```

| | Paints today |
|---|---|
| `%{GrabHandleBar}` rest | `background-color: var(--dashboard-control-bar-button-color-a)` (#3d4450), `height:12px`, `border-radius:20px`, `transform: scaleX(calc(1 / var(--grab-handle-grow-scale-x)))` (= .909), `transition: transform .08s, background-color .08s` |
| hover (`%{GrabHandleButton}:hover %{GrabHandleBar}`) | `background-color:#fff; transform:scaleX(1)` |
| dragging (`%{GrabHandleBar}%{GrabHandleBar>ForceActive}`) | same as hover |
| focus | none (the grab handle is not gamepad-focusable; `bCanTakeKeyboardFocus:false`) |

- Shots: rest `vr_sys_before`, hover `vr_sys_hover_before`, dragging `vr_sys_focus_active_before`.
- **Do not touch:** the `transform` (Steam's grow animation, `--grab-handle-grow-scale-x`), inline `width:700px`, the 60px padding (it is the hit area and defines the quad's aspect), height 12px.
- Glass pill per DESIGN §9: recolour the bar (`background` translucent white + inset rim) and brighten it on hover/ForceActive. Keep the `transition` property list or extend it; never animate `transform` yourself.

### 2.4 Resize corner

Source `chunk~8012d0c89.js` ~25760–25880. CSS module `frameresizehandle`.

```
vsg-node[resize-handle] > [opacity] > [tint] > vsg-transform > vsg-node[panel]  (ResizeHandle, width 0.2 m × scale, laser-only)
  div %{ResizeHandleButton}   [318,163 152x152]  --resize-corner-size:128px; --resize-corner-thickness:10px; --resize-corner-offset:12px; position:relative; pointer-events:all
    div %{ResizeCorner}       [330,175 128x128]  position:absolute; right/bottom: offset; cursor:nwse-resize
      svg %{ResizeSVG}        [369,214 50x50]    color: var(--dashboard-control-bar-button-color-a); transition: all .08s
```

| State | Paints |
|---|---|
| rest | stroke colour #3d4450 (SVG uses `currentColor`) |
| hover (`%{ResizeHandleButton}:hover %{ResizeSVG}`) | `color:#fff; transform:scale(1.4)`; `path{stroke-width:4.2857}` |
| dragging (`%{ResizeHandleButton}%{ResizeHandleButton>ForceActive}`) | same as hover |

- Design: thin white strokes at `--lgs-text-2`, brighter (`--lgs-text-1`) on hover/active. Change `color` only.
- **Do not touch** the `transform: scale(1.4)` and `stroke-width` growth, the absolute positioning, or the custom properties (they size the quad).

### 2.5 Frame controls (under the dashboard window)

Source `chunk~8012d0c89.js` module 4562 (~34080–34460). CSS module `legacydashboardframecontrols` (+ global `ButtonControl`).

Live items on the Steam frame: **Show Keyboard** | **Float in World**, **View in Theater** | **More Options** (`FrameStore.frames[0].m_rgControlsItems_BottomFrameControls`). On a game/Now Playing frame: Float in World, View in Theater | More Options | (wide gap) **Close** (closes the frame = exits the app). Sections are separated by `type:1` spacers; two or more spacers in a row add `%{WideGapBefore}`.

```
vsg-node[panel]#legacy-frame-controls-382700001          (origin TopCenter, 1.57 mm/px, reflect .1, laser-only)
  div %{FrameControlsContainer}  [2,264 314x51]   (+ %{HasGamepadFocus} while the controls own gamepad focus)
    div %{Section}               [12,264 67x51]   (+ %{WideGapBefore})
      div ButtonControl WithIcon LargeIcon   [12,264 67x51]   (+ %{GamepadFocused}, .Disabled, %{HasPopoutAnchor} on More Options)
        div style="position:absolute;left:50%;top:50%"  > vsg-node[panel-anchor] …   <- tooltip anchor, 0x0
        svg.Icon                 [26,270 38x38]   path fill: var(--text-color)
        div %{PopoutAnchor}      (More Options only, 0x0)  > vsg-node[panel-anchor]#legacy-frame-controls-additional-options-anchor-<id>
    div %{Section} [99,264 133x51]  (Float in World, View in Theater)
    div %{Section} [252,264 54x51]  (More Options)
```

| Element / state | Paints today |
|---|---|
| `%{FrameControlsContainer}` | `display:flex; background:none; transition: opacity .4s ease-out`; **`opacity:.6` when `:not(:hover):not(%{HasGamepadFocus})`**, 1 on hover/focus (`%{HasGamepadFocus}` sets `transition: opacity 0s`) |
| `%{FrameControlsContainer} %{Section}` | `background: var(--gamepadui-darker-grey)` #23262E, `border-radius:10px`, `margin:0 10px` (`%{WideGapBefore}`: `margin-left:30px`) |
| `… .ButtonControl` | `background:none; margin:0; height:100%`; computed `padding:6.4px 14.08px`, `border-radius:9.6px` (.3rem), colour #DEE2E5 |
| `… .ButtonControl:hover`, `.ButtonControl%{GamepadFocused}` | `background: var(--gamepadui-dark-grey)` #3D4450 |
| `… .ButtonControl:active` | `background: var(--gamepadui-grey)` #67707b |
| `… .ButtonControl.Disabled` | `pointer-events:none; opacity:.3` |
| `… .ButtonControl%{HasPopoutAnchor}` | `position:relative; padding: 0 8px` sides |
| global `.ButtonControl` | `transition-property: background; transition-duration: var(--button-fade-time)` |

- Shots: rest `vr_sys_before` (container at .6), hover `vr_sys_hover_before` (first button #3D4450; container still .6 because of the `:not(:hover)` limitation), gamepad focus `vr_sys_focus_active_before` (container 1, 2nd button #3D4450).
- Design (§9): each `%{Section}` becomes a panel-glass capsule (`--lgs-panel-*`), buttons circular hit areas with white icons; hover `--lgs-hover-fill`, `%{GamepadFocused}` gets `--lgs-focus-fill` + `--lgs-focus-ring` (**inset** parts only: the panel clips outer glow), `:active` `--lgs-pressed-fill`.
- **Do not touch:** the container `opacity` rule (SteamVR's dim-when-idle behaviour; overriding opacity is forbidden anyway), section margins (they set the quad width), button padding/height, the 0×0 anchor divs and `vsg-node`s inside buttons, `%{PopoutAnchor}`.
- **Never press** any of these buttons: Show Keyboard toggles the keyboard, Float in World / View in Theater move the window, More Options moves input focus (2.5.2), Close exits the app.

#### 2.5.1 Frame-control tooltips

Source module 7606 (~34706). One hidden panel per button, re-parented into `div.v-parent-portal` at the end of `.AppSceneGraph`.

```
div.v-parent-portal > vsg-transform (parent-id = the button's anchor) > vsg-transform (y .15, z .05)
  vsg-node[panel] style="display:none"     (legacy-tooltip-<n>; display:none until shown)
    div.ControlBarButtonTooltip            "Float in World"   [2,605 271x65 while shown]
```

- `.ControlBarButtonTooltip` (global, chunk~93a8598f9.css:2387): `display:inline-block; width:fit-content; background: rgba(0,0,0,.85); color:#fff; border-radius:9001px; padding:.3em 1em; font-size:1rem` (32px).
- Shown while `LegacyDashboardStore.m_nCurrentlyShownLegacyTooltipID` equals that tooltip's id (laser hover, or gamepad focus on the button). Reproduce: `python glass.py shot vr:systemui vr_sys_tooltip_before --theme off --pre "$(cat docs/inventory/steamvr-pre/sys_tooltip.js)"`.
- Design: panel glass capsule like Steam's bar tooltip (HUD inventory §1). The panel is `width:fit-content`: keep padding and font so the quad doesn't change size.

#### 2.5.2 More Options popout (`%{AdditionalOptions}`)

Source module 4562 (rows rendered by component `S` with `showLabel`). Items on every frame: **Toggle Curvature** (toggle, `active` shows the on icon), **Dock on Left Controller**, **Dock on Right Controller**.

```
vsg-node[panel]#legacy-frame-controls-additional-options-<frameID>   (parent = %{PopoutAnchor}; origin BottomLeft; 1.57 mm/px; laser-only)
  div %{AdditionalOptions}                                  bg var(--gamepadui-darkish-grey) #171d25; radius 10px; overflow hidden; flex column
    div ButtonControl WithIcon LargeIcon %{AdditionalOptionsRow}   (+ %{GamepadFocused}, .Disabled)   padding 8px 24px 8px 20px (first: top 14, last: bottom 14); gap 16px; radius 0; nowrap
      svg.Icon
      span %{AdditionalOptionsLabel}   "Toggle Curvature"
```

- Row states: `:hover` / `%{GamepadFocused}` → `background: var(--gamepadui-dark-grey)`; `:active` → `var(--gamepadui-grey)`; `.Disabled` → `opacity:.3; pointer-events:none`; rows after the first get `border-top: 1px solid rgba(255,255,255,.07)`.
- **Opening it is NOT side-effect free.** `frame.SetControlAdditionalOptionsOpen(true)` makes the component call `inputFocus.FocusAdditionalOptions()`, which pushes SteamVR input focus to the popout (and closing it moves focus to the frame controls in gamepad mode). It also auto-closes when the frame controls lose focus. An attempt in this session (open 0.5 s) did not paint and left focus where it was, but don't repeat it.
- Shot: **static mock** with SteamVR's own classes, outside `vsg-app` (no panel, no UV change, second row focused, icons are placeholders copied from the frame controls): `vr_sys_moreoptions_mock_before` via `sys_moreoptions_mock.js`. Verify a theme on the real popout only when the user opens it.
- Design: a panel-glass menu (`--lgs-r-menu`), rows `--lgs-r-row`, hairline separators instead of the #fff/.07 border colour.

#### 2.5.3 Laser/gamepad states summary for the frame controls

| Class | Set by | Meaning |
|---|---|---|
| `%{HasGamepadFocus}` (container) | `frame.inputFocus.frameControlsHaveGamepadFocus` | the controls own gamepad focus (D-pad down from the window) |
| `%{GamepadFocused}` (button/row) | that + the focused action id | the gamepad-focused button |
| `:hover` | laser | laser hover |
| `.Disabled` | action `isEnabled:false` | unavailable |
| icon swap | action `active` → `icon_active` | toggled actions (keyboard shown, curvature on) |

#### 2.5.4 Frame gamepad-mode pill

Source module 5484 (~25580). CSS module `framegamepadmodebutton`. Panel `frame-gamepad-mode-button-<frameID>`, anchored at the active page's TopCenter (sits just under the window, next to the frame controls in the atlas), 1.57 mm/px.

```
div %{ButtonPill>Container}                                   display:flex
  div %{ButtonHitArea} (+ %{ButtonPill>Disabled})             padding 20px (first 60px left, last 60px right), gap 20px
    div %{ButtonPill}  "Enter Gamepad Mode" | "Use Laser Mouse to Interact"   uppercase, weight 500, radius 9001px, padding .2em 1em
      div %{GlyphContainer}  svg (A glyph or generic gamepad icon)
```

- Two variants: **Enter Gamepad Mode** (`shouldShowEnterGamepadModeButton`, interactive, `background:#0056d6`, hover `#1a9fff`) and **Use Laser Mouse to Interact** (`showGamepadInputNotSupportedBanner`, `%{ButtonPill>Disabled}` → `background:#3d4450`, not interactive). `box-shadow: 0 4px 10px rgba(0,0,0,.25)` (clipped by the panel).
- Seen in `vr_settings_before` (laser-only page). Design: a panel-glass capsule; the enter-gamepad variant is a tinted primary (`--lgs-tint-primary`). Keep the hit-area padding (quad size).
- **Never click "Enter Gamepad Mode"** (changes the interaction mode).

### 2.6 Controller status

Source `systemui.js` module 998 (~5480–5760). CSS module `controllerstatus`. One panel per tracked controller (`controllerstatus_<index>`), `rendermodel_component_device_index` + `rendermodel_component_name:"status"`: SteamVR maps this card onto the controller model's status area, not as a floating window.

```
vsg-node[panel]
  div %{ControllerStatusRoot} (+ %{LargeStatusArea}, %{ControllerStatusRootLeft}|%{ControllerStatusRootRight})   256x256, flex column
    div %{ControllerPrimaryIconFrame}
      img %{ControllerHand}  src=images/icons/controller_model_left|right.png          (hand role, no gamepad mode)
      | div %{ControllerGamepadIcon} (+ %{ControllerGamepadIconWithApp})                (controller in VR gamepad mode)
          img %{ControllerAppIcon} (+ %{ControllerAppIconLoaded})   focused app's icon, radius 12px
          div %{ControllerConnectionDots} > span×3   7px dots #525252
          div %{ControllerRoleIcon} > svg (gamepad glyph, colour #525252)
    div %{ControllerBatteryFrame}   opacity .85; width var(--battery-status-width)
      img %{ControllerBattery}  src=images/icons/controller_model_{battery_1..4|low|charging|charging_red}.png   filter: brightness(65%)
```

- States: no role → empty card (index 1 today); right hand with battery 2/4 (`vr_sys_hover_before`, `vr_np_before`: grey hand + green/black pips); gamepad mode (`vr_settings_before`: gamepad glyph + one green pip).
- Battery is **a PNG** chosen by level (`<15%` low, `<30%` 1, `<60%` 2, `<90%` 3, else 4; charging variants). There is no DOM fill to recolour. "Whole-fill colour" per DESIGN §9 can only be approximated with `filter` on `%{ControllerBattery}` (it already has `filter: brightness(65%)`) or by a `content: url(...)` swap, which is a decision for the theme owner. Icons are `#525252` greys.
- The card has no background today; a panel-glass card here would paint onto the physical controller's status area.
- No hover/focus states (non-interactive).
- Not side-effect free to force: the state comes from `VRProperties` battery/role events. Turning a controller on/off is the user's.

### 2.7 Now Playing

Source `chunk~8012d0c89.js` ~27640–28100 (components `w` portrait art, `L` button, `k`/`A` page). CSS: global rules in `chunk~93a8598f9.css` 1803–1950 and 2492–2570, module `gamepaduibutton`.

**Render it:**
1. `cd .. && python .claude/skills/run-liquid-glass-frame/driver.py status` → must say `service: inactive` (someone else may be using it).
2. `python .claude/skills/run-liquid-glass-frame/driver.py start`
3. `cd glass-shell && python glass.py shot vr:systemui vr_np_before --theme off --pre "$(cat docs/inventory/steamvr-pre/np_open.js)"` (opens the dashboard on the Now Playing frame with `window.Dashboard.showDashboardOverlay({frameId}, true)`, the same call the Now Playing button makes).
4. State shots: `np_states.js` (gpfocus on VR Controller Bindings, hover on Exit Game), `np_resumefocus.js` (gpfocus on Resume).
5. `cd .. && python .claude/skills/run-liquid-glass-frame/driver.py stop`. The dashboard returns to the Steam frame.

Caveat seen today: the first start was quit by SteamVR after 14 s because **another OpenXR app (a dev build of Dolphin, `/home/steamos/dev/dolphinxr-frame`) was launched by someone else** ("Sending Quit event", transition panel "Next Up"). A new scene app always replaces the current one. Check `pgrep -af dolphin` and `driver.py status` first and keep the window short.

When a scene app runs SteamVR creates a third frame (title = app name) with one page `system.dashboard.nowplaying`, plus a gamescope window frame for the app's desktop window. The page is only painted while that frame is visible in the dashboard.

```
div.DashboardMain > vsg-node[frame-node] > vsg-node[mountable]#frame:<id>:page:1:mountable
  span.SettingsMain > vsg-transform > vsg-node[panel]#nowplayingpanel           (main panel of the frame page)
    div.View > div
      div.ScrollPanel.DashboardPanel.NowPlaying      [2,163 1858x1045]  bg #0e141b, radius 10px, padding 64px 192px, overflow-y auto, colour #dee2e5
        div.ArtworkColumn                            [194,311 499x749]  --width:500px; height width*900/600; radius 4.8px; overflow hidden; box-shadow 0 7px 70px -5px #000
          div.PortraitAppImageContainer(.Fallback)   flex; overflow hidden
            div.IconBackgroundBlur   (only when art is not 600x900: blur(16px), 200% size)  style="background-image:url(…)"
            div.Icon                 style="background-image:url(…)"   contain, position 0% 21.3%
            div.Title                "Liquid Glass Frame"   (display:none unless .Fallback: 32px centred)
        div.InfoColumn                               [843,302 625x767]  margin-left 150px, margin-right 200px
          div.NowPlayingAppTitle                     "Liquid Glass Frame"   3em bold (72px), margin 70px top / 100px bottom
          div.GamepadUIButton %{GamepadUIButton} %{GamepadUIButton>Primary} %{FocusRing} ResumeButton   "Resume Game"  (or "Return to Home")
          div.GamepadUIButton %{GamepadUIButton} %{FocusRing} > span   "VR Controller Bindings"   (not in arcade mode)
          div.GamepadUIButton %{GamepadUIButton} %{FocusRing} > span   "VR Video Settings"        (not in arcade mode)
          [div … "Clear Performance Assessment Status"]  (only with that setting)
          div.GamepadUIButton %{GamepadUIButton} %{FocusRing}          "Exit Game"  (or "Exit Home"; only if allowAppQuitting)
          [hidden modals: ManageBindings / AppVideoSettings (SettingsMain modals, opened by those buttons)]
```

| Element / state | Paints today |
|---|---|
| `.DashboardMain .DashboardPanel.NowPlaying` | `background: var(--gamepadui-darkest-grey)` (#0e141b), `border-radius: var(--settings-border-radius)` (10px), flex row, centred |
| `.NowPlaying .HeroBackground` (rule exists, not rendered in this build) | blurred hero, `filter: brightness(40%) blur(50px); transform:scale(1.15); z-index:-1` |
| `%{GamepadUIButton}` rest | `background:#3d4450; color:#dfe3e6; border-radius:4px; padding:.5em 1em; line-height:32px; width:100%`; here `font-size:1.5em` (36px), `margin-bottom:25px` (Resume 45px); `transition: opacity, background, color, box-shadow .2s` |
| `:hover`, `.gpfocus` | `background:#464d58; color:#fff`; `::before` drop shadow `0 8px 16px rgba(0,0,0,.3)` fades in on hover |
| `:active` | `background:#393f49; box-shadow: 0 1px 4px rgba(0,0,0,.6)` |
| `%{GamepadUIButton>Primary}` rest | same grey as others (only `.Highlighted` gets the gradient) |
| Primary `:hover` / `.gpfocus` / `%{Highlighted}` | `background: linear-gradient(to right, #47bfff 0%, #1a44c2 60%)`, `background-size:330% 100%`, `background-position` 0% (hover/focus), 25% (Highlighted), 40% (active) |
| `%{Highlighted}` | added to the primary in **laser-mouse mode with no controllers** (`m_eSystemPanelInteractionMode == LaserMouse && !hasControllers`) |
| `%{FocusRing}.gpfocus::after` | `outline: 4px solid rgba(255,255,255,.6); outline-offset:4px; inset:0`, animations `Flash .5s, GrowOutline .4s, FadeOutline .4s, Blinker 1.2s ×20` |
| `.Disabled` | `background: rgba(61,68,80,.35); color:#464d58; pointer-events:none` |

- Shots: rest `vr_np_before`; `.gpfocus` on VR Controller Bindings + hover on Exit Game `vr_np_states_before`; Resume focused (blue gradient + focus ring) `vr_np_resumefocus_before`.
- Gamepad focus is SteamVR's own: `.gpfocus` is set by React from `state.sFocusedButtonKey` while the Now Playing page has gamepad focus (D-pad up/down moves it, A invokes, B = Resume). It is not Steam's `.gpfocus` and doesn't use `ItemFocusAnim` keyframes, so no `!important` is needed for focus fills (the `::after` ring animates `outline`/`opacity` only).
- **Steam-owned pseudo-elements:** `%{GamepadUIButton}::before` (hover shadow) and `%{FocusRing}.gpfocus::after` (focus ring). Restyle them rather than adding new ones; the `::after` Blinker animation runs 20 iterations (~24 s), keep or replace it with a static ring (DESIGN §7: no pulsing).
- Design (§9): the panel = window glass (`--lgs-window-*`, `--lgs-r-window`; the panel clips at its rect, so the rim must be inset); art = content (`--lgs-r-card`, keep its shadow inside the panel or drop it); **Resume** = the one tinted primary (`--lgs-tint-play`), other actions fill capsules, **Exit Game** gets `--lgs-tint-danger` only on focus/hover.
- **Never press** Resume Game, VR Controller Bindings, VR Video Settings, Clear Performance Assessment Status, Exit Game, or the frame's Close.

### 2.8 SteamVR Settings page (frame menu › VR Settings)

Source `chunk~8012d0c89.js` ~10380–10660 (component rendering `SettingsMain`), CSS `chunk~b48d3fba7.css`.

The Steam dashboard frame (id 382700001) has three pages: 1 `system.settings` (this, painted in systemui), 2 `system.vrwebhelper.controllerbinding` (the `vr:controllerbindingui` page), 3 `valve.steam.gamepadui.main` (Steam). Steam's left frame menu (`frame.menu` surface, bar inventory) has **VR Settings** (page 1) and **Power**. The page content is only painted while page 1 is active.

**Render it:** the switch hides Steam main in the headset for 4.5 s, so hold the Steam lab lock meanwhile:

```bash
python glass.py js "(async()=>{window.__LGS_INV_HOLD=Date.now(); await L.sleep(22000); window.__LGS_INV_HOLD=0; return 'released'})()" &   # holds lab.lock
# wait until: python glass.py eval SharedJSContext "String(window.__LGS_INV_HOLD||0)"  is non-zero
python glass.py shot vr:systemui vr_settings_before --theme off --pre "$(cat docs/inventory/steamvr-pre/settings_open.js)"
```

```
div.SettingsMain.Overlay  [0,161 1860x1062]                 (.Loading while the schema loads)
  vsg-node[mountable] > span > vsg-transform > vsg-node[panel]#vrsettingspanel
    div.View > div
      div.ScrollPanel.DashboardPanel.Settings   [2,163 1858x1045]  bg #0e141b, radius 10px, overflow visible
        div.SettingsMainPanel
          div.SettingsSidebarPageModalContainer > div.View.SettingsSidebarPageContainer
            div.SettingsSidebar            [2,163 416x1045]  bg rgb(34,39,43), radius 10px
              div.SettingsSidebarButton(.Active) > div.Label   General | Play Area | Dashboard | Controllers | Video | Camera | Startup / Shutdown | Developer
              div.Spacer
              div.Bottom.AdvancedSettingsToggle(.Active|.Fadable) > div.SettingsItem.SegmentedControl  "Advanced Settings  Hide | Show"
            div.ScrollPanel.SettingsPageContainer   [418,163 1442x1045]  bg rgb(10,15,20)
              div.SettingsItem.RadioButtons > div.Label + div.RadioButtonsSet > div.RadioButton(.Selected)(.Disabled) > div.Label
              div.SettingsItem > div.Label + div.SettingsItem.Slider > div.SliderControl.ValueOnHandle > div.Track(> div.Detent) + div.HandleContainer > div.Handle.SmallerText > div.RangeLabel
              div.SettingsItem.SegmentedControl(.Advanced) > div.Label + div.SubsectionStem.Hidden > div.SegmentedControlGroup.DualValue > div.SegmentedControlGroupOption(.Active) > span
              div.SettingsItem.Advanced > … div.ButtonControl.Dropdown > span  +  div.SettingsExplainer
```

- States (all laser; this page shows the "Use Laser Mouse to Interact" pill, so no gamepad focus): `body .SettingsSidebarButton.Active, :hover` (fill #3D4450), `.SettingsSidebarButton::before` (Steam-owned, `transform: scale(.93)` press effect), `.SegmentedControlGroup::after` (**Steam-owned sliding selection pill, positioned with `transform: translateX(…)`**), `::before` (hover), `.SegmentedControlGroupOption.Active > span`, `.RadioButton:hover/.Selected/:active` (`.Selected:after{content:none}`), `.SliderControl:not(.Vertical) .HandleContainer { transform: translateX(…) }` (**slider position, never touch**), `.SliderControl.Sliding .HandleCircle/.RangeLabel` scale, `.ButtonControl.Dropdown::after` chevron (`transform: rotate(45deg)`), `.SettingsMain .ButtonControl:not(.Disabled):hover/:active`, `.Disabled`, **`.Advanced`** controls use the purple `--settings-advanced-*` fills (#493b4b / hover #725b75 / active #2d242e).
- Opened dropdowns and section modals render as `.SettingsMain .Modal` / `.DropdownPopoverButton(.Selected)` inside the same panel (not opened in this pass: they are one click away from a setting).
- Design (§9): window glass panel; sidebar = fills with the white selected item; segmented controls = Liquid Glass capsule with the white selected segment (keep SteamVR's `::after` slider: recolour it, never move it); radio buttons = circular fills, selected white; sliders per DESIGN §4. Advanced controls need a distinct but non-purple marker (e.g. `--lgs-purple` dot or tinted fill) so "advanced" stays recognisable.
- **Never** click any setting, the sidebar's Advanced toggle, Dropdowns, or "Developer" items. Sidebar section buttons only change `routePage` (navigation) but are not needed for mapping.

### 2.9 Other systemui panels (on demand)

All are children of the systemui root (`systemui.js` 9620–9790) and appear as their own panels in the atlas when their condition holds. None has a side-effect-free trigger; style from these notes and verify when they occur naturally.

| Panel (debug_name) | Classes | Shows when |
|---|---|---|
| `transition`, `transition-appstatus`, `transition-waiting` | `div.TransitionAppImage(.FadingIn/.FadingOut/.Waiting)` 552×258 black, radius 10px, 4px black border, bg image `/app/image?app_key=` or `images/dynamictitle.000N.png` + name, 40px bold; `div.TransitionAppLabels` rgba(20,20,20,.97) radius 10px > `div.AppStatus` ("Next Up" / "Now Exiting" / "Waiting..."); `.ActivitySpinner > .Bar×3` | a scene app starts/quits while the dashboard is not fully visible (seen today when the showcase was replaced). Fade animations are SteamVR keyframes on `opacity`, `.Waiting::after` is a Steam-owned dimmer |
| `persistent_notifications` | `%{PersistentNotificationsContainer}` > `%{TrackingDataRecordingNotification}` / `%{CastingVRScreenNotification}` (infinite `AnimationFadeOutIn` 15s, green SVG) | tracking-data recording or casting the VR view |
| `progressindicator`, `recenter_countdown` | `div.ProgressContainer(.Throb)` > `.CircularProgressbar`, `.ProgressIcon`, `.SVGIcon_Button` | hold-to-recenter / long-press progress |
| `ipd` | `.IPDParent(.Fading)` > `.IPDSettingTextDesc`, `.IPDNumberRow > .IPDNumberText`, `.IPDLabelText`, `.IPDLensRow > .IPDLens(.FlipImageHorizontal) svg` | physical IPD dial moves (unless the driver hides it) |
| `room-setup-ui`, `chaperone-popup`, `playspace-laser-receiver-invisible` | module `roomsetup`: `%{RoomSetupContainer}` (gradient #060a0e→#0e141b, radius 10px), `%{RoomSetupContainer>Title}`, `%{RoomSetupContainer>Body}`, `%{RoomSetupContainer>ButtonRow}` > `%{RoomSetupContainer>ButtonControl}`/`%{RoomSetupContainer>Colorful}` (blue), `%{RoomSetupContainer>CloseButtonIcon}`, `%{RoomSetupContainer>LaserReceiverInvalid}` (`Title`, `Body`, `ButtonRow`, `ButtonControl` alone are ambiguous) | play-area setup / boundary prompts |
| `framerate-change` | `%{FramerateRoot}` (+ `%{FramerateRoot>Fading}`) darker-grey pill, 3px border | refresh rate changes |
| `gamepad-unsupported` | `%{GamepadUnsupportedRoot}` (+ `%{GamepadUnsupportedRoot>Fading}`) | gamepad used on a page without gamepad support |
| `steam-loading-throbber`, `steam-loading-boot-overlay` | `loadingthrobber`: `%{LoadingThrobberContainer}::before` (black circle), `%{LoadingThrobber}` (spinner PNG), `%{LoadingRoot}`, `%{SteamLogo}`, `%{LoadingRoot>Title}`, `%{LoadingRoot>Body}`, `%{LoadingRoot>ButtonRow}` > `%{LoadingRoot>ButtonControl}` (#1a9fff) | Steam not up yet / boot |
| `ring_throbber` | `ringthrobber`: `%{BlueHighlight}`, `%{BlueHighlight_Rings}`, `%{BlueHighlight_Ring}` (infinite pulse keyframes on transform) | guided-tour highlight |
| learning panel / guided tour (Frame only, `IsSteamFrame()`) | module `guidedtour_steamframe`: `%{TourTooltipContainer}`, `%{TourTooltipContents}`, `%{TopPanelContainer}`, `%{BottomPanelContainer}`, `%{ButtonContainer}`, `%{CenteredContent}`, `%{LearningTopicBody}`, `%{LearningTopicParagraph}`, `%{BodyText}`, `%{GuideLineContainer}`, `%{GuideLine}`, `%{GuideDot}`, `%{TourConnector}` | first-run tour and unread "learning topics" (auto-show). Re-showing them means resetting tour settings: not allowed |
| `vrlink-info`, `dev-escape-hatch`, `input_focus_dev_ui*`, `testing-stuff` | `inputfocusdevui`, `framedevui` modules (#222 dev panels) | developer/debug only |
| `basestation-1/2` | `.WakingBaseStationsPanel(.Loaded)` | Lighthouse base stations waking (not on the Frame) |
| `vr_error_container` | `.ErrorBoundary` | a systemui component crashed |
| Legacy dashboard (`LegacyDashboardBar`, `StatusBar`, `quicklaunch`, `OverlaysList`, `WindowList`, `control-bar-tray*`, `NowPlayingButton`) | `.DashboardMain .ControlBar…`, `.StatusBar`, `.QuickLaunch`, `.AppCarousel` | SteamVR's old dashboard; **not used on the Frame** (`isVRGamepadUI` → Steam's bar) |

---

## 3. `vr:controllerbindingui` (Edit Controller Bindings)

Source `controllerbindingui.js` (router store `window.inputUI`, binding store `window.controllerBindingStore`), CSS `controllerbindingui.css` (global classes). Page 2400×1350, its own overlay (page 2 of the Steam dashboard frame, `system.vrwebhelper.controllerbinding`). States: `inputUI.GetUIState` 4 = app select, 1 = list, 2 = view binding, 3 = edit binding, debugger.

**Reached by:** SteamVR Settings › Controllers › "Show Binding UI" (advanced), Now Playing › VR Controller Bindings › (custom binding detail), or deep links (`show_app_binding` / `show_app_select` mailbox messages). The page renders even while not shown, so shots work any time.

### 3.1 Page chrome (every state)

```
body.ControllerMainBorderRadius        border-radius 1.3rem (31.2px)   <- the overlay's rounded corners
  div > div.FullPage.InputContainer    background-image: linear-gradient(to bottom right, #32373f, #25282e)   <- the window background (opaque)
    div.PageTitleBar > div.FlexFullWidthRowCentered.TitleBarMainRow   [0,0 2400x108] bg #3d4450
      div.TitleBarSection > div.ButtonControl.FlexRow.PageTitleButton.PageTitleBackButton.AllCaps "Back"  bg #586170 r 7.2  (> img.ActionButtonImage op .8)
      div.AllCaps.PageTitle.TitleBarSection.FlexColumn > div.PageTitleLabel(.SingleTitle) [+ div.PageSubTitle.PageTitleLabel]
      [div.TitleBarSection > div.ButtonControl.FlexRow.OptionsButton.PageTitleButton.AllCaps "Options"]   (view/edit pages)
```

### 3.2 App select (`vr_bind_apps_before`, `vr_bind_apps_more_before`)

```
div.AppSelectPageWrapper > div.AppSelectColumnWrapper > div.AppSelectColumn
  div.AppSelectList > div.AppSelectListItems
    div.AppSelectContainer          [708,132 984x156] bg #23262E r 36   (current scene app, then VR Dashboard, then recents)
      div.AppImage                  bg #000 + style="background-image:url(…)"  r 12
      div.AppSelectName.AllCaps     "Rise of the Tomb Raider"  1.5rem bold
  div.ButtonControl.AppSelectShowMoreButton  "Show More Applications"  bg #23262E r 24   (replaced by the full list, 107 apps, when pressed)
```
Hover: `.AppSelectContainer:hover { background: var(--buttonhover) }`. Reproduce more apps: `--pre "$(cat docs/inventory/steamvr-pre/bind_apps_more.js)"` (resets itself).

### 3.3 Binding list (`vr_bind_list_before`, `bind_list.js`)

```
div.FlexColumn.FullPage
  div.PageTitleBar … "Change bindings for VR Dashboard"
  div.BindingUITopSection.FlexRow
    div.CurrentSection.FlexColumn > div.BindingListSectionHeader "Current Binding" + div.BindingEntry.FlexRow (bg rgb(36,39,45)) > div.BindingDetails
        div.BindingListEntryButton.ButtonControl.BindingSelectButton "Edit"   + span.BindingName + span.BindingDescription
    div.FlexColumn.ControllerTypeWrapper > div.BindingListSectionHeader.Label "Current Controller" + div.FlexRow.ControllerTypeButton.BindingEntry
        img.ControllerImage + div.InlineDropdownLabel > div "Frame Controller"
  hr
  div.AppBindingSection > div > div.BindingListSectionHeader "Community Bindings" + div.FlexRowWithWrap.BindingListSection
      div.BindingEntry.FlexRow > div.SteamCommunityProfileImage + div.BindingDetails
          div.BindingListEntryButton.ButtonControl.BindingSelectButton "Activate" | "View" [| …DeleteButton]
          span.BindingName, span.BindingDescription, span.BindingLastUpdated
    div.ButtonControl.DeveloperLabel.Inline "Create New Binding"
```
- **Never press** Activate (switches the binding), Edit (calls `SelectConfig`), Create New Binding, Delete, the controller dropdown.

### 3.4 View binding (`vr_bind_view_before`, `bind_view.js`)

```
div.TopRow.FlexColumn > div.FlexColumn.DescriptionTopRow > div.PageTitleBar  (title + PageSubTitle + Options button)
  div.ScrollPanel.ActionTabContainer.TabRow > div.Label.Tab.PositionRelative(.Selected|.Warning|.Error) [> div.UnboundActionsCount]
div.BindingSectionWrapper
  div.BindingControllerImageColumns.FlexColumn > div.FlexRow > div.FlexColumn.ControllerImageColumn > img.ControllerImage.ControllerImageLeft
                                                              div.Mirrored.ControllerImageColumn (op .5) > img.ControllerImage.ControllerImageRight
      div.FlexColumnCentered.ControllerImageColumnButtons > div.Label.TitleCenter.ToggleMirror.ButtonControl "Poses" | "Haptics"
  div.BindingSection.FlexRow > div.BindingButtonRow.FlexColumn (left) | div.BindingButtonRow.FlexColumn.Mirrored (right, op .5)
      div.Label.Title.ControllerTitle "Left Frame Controller"
      div.FlexColumn.BindingInputSection > div.FlexRow > div.Label.Title "Trigger"; hr; svg.MenuLeftLine.MenuSVG (op 0, callout line)
        div.SourceModeGroup.FlexColumn (bg rgb(36,39,45) r 2) > div.FlexRow.BindingHeaderWrapper > div.Label.BindingLabel.ReadOnly.BindingHeader "Use as Button"
          div.FlexRow.BindingActionWrapper(.None) > div.Label.BindingLabel.ReadOnly "Click" + div.Label.BindingLabel.ReadOnly.BindingLabelAction "Left Mouse Click"
div.BottomButtonRow > hr.BottomButtonHR + div.BindingManageButtons.FlexFullWidthRowCentered
    div.FlexColumn.ButtonControl(.SteamRequired) "Select this Binding" | "Edit this Binding" | "Show Developer output" | "Export Binding File" | "Replace Default Binding"   (edit mode: "Save Personal Binding")
```
- **Never press** anything in the bottom row or the Options menu; tabs (`.Tab`) are harmless navigation but not needed.

### 3.5 States and things a theme must not touch

| Selector | Today |
|---|---|
| `.ButtonControl:not(.Disabled):hover` | `background-color: var(--settings-control-hover-background)` (#3D4450), `box-shadow: var(--settings-control-box-hover-shadow)` |
| `.ButtonControl:not(.Disabled):active` | active background + smaller shadow |
| `.PageTitleBar .PageTitleBackButton:hover` | `var(--backbuttonbackgroundhover)`; icon opacity 1 |
| `.AppSelectContainer:hover` | `var(--buttonhover)` |
| `.Tab:hover` / `.Tab.Selected` | #586170 / #24272d + `border-bottom: 2px solid rgb(86,142,172)`; `.Tab.Warning` rgb(145,123,24), `.Tab.Error` errorbackground |
| `.InlineDropdownItem:hover/.Selected`, `.InlineDropdownLabel:hover`, `.DropdownPopoverButton:hover/:active/.Selected`, `.BottomButton:hover` | fills |
| dialogs | `rodal` library: `body .rodal-dialog`, `.rodal-mask` (not opened here) |

- No gamepad focus states exist (laser only).
- Content: `.AppImage`, `img.ControllerImage`, `.SteamCommunityProfileImage` stay opaque content.
- The page is its own overlay: `body.ControllerMainBorderRadius` radius is the window shape; `InputContainer` is the paint to turn into window glass (keep `body` itself unpainted). The mirrored right column's `opacity:.5` is Steam's (don't raise it).
- `svg.MenuLeftLine/MenuRightLine.MenuSVG` are absolutely positioned full-page callout lines (op 0 at rest): never give them backgrounds.

---

## 4. `vr:keyboard` (SteamVR's own keyboard)

Source `keyboard.js` (component `_`, ~960–1580), CSS `keyboard.css` + global sheets. Not Steam's VRKeyboard (that is the `keyboard` surface in the HUD inventory). SteamVR uses this one for OpenVR apps' `ShowKeyboard` and SteamVR's own text fields. It registers itself with `VRDashboardManager.SetKeyboardOverlayToThis()` and renders only while `onKeyboardInfoChanged({visible:true})` has been received; presentation is `"overlay"` (the page is the overlay texture) or `"flat"` (a head-locked scene-graph panel, `keyboard-flat`).

Reproduce (DOM only, overlay not shown): `python glass.py shot vr:keyboard vr_kb_before --theme off --pre "$(cat docs/inventory/steamvr-pre/kb_show.js)"` (full mode, text "Liquid", key "r" pressed).

```
div.VRKBContainer.VRKBShiftState.VRKBChooseShift_normal|_shift|_symbols   100%x100%
  div.VRKBBackground   calc(100%-10px) + 5px padding
    div.VRKBPreviewWrapper  (not in minimal mode)  bg #23272d, height 15%
      div.VRKBPreviewText > span.VRKBPreviewTextPart "Liquid" + span.VRKBPreviewTextCursor "|" (#66c0f4) + span.VRKBPreviewTextPart
      div.VRKBSuggestionWrapper > div.VRKBSuggestion ×4  (#363e44, 50px)
    div.VRKBRows (85%) > div.VRKBRow (bg var(--background-color) #0e141b)
      div.VRKBKey  style="flex-grow:N; [background:#000]"   bg #23272d, radius 4px, 72px, colour #a1a2a3
        span.VRKBKeyFace.VRKBShift_normal|_shift|_symbols "q"   | span.VRKBKeyFace > img (backspace, enter, shift, symbols)
      … last row: space bar + div.VRKBDone "Done" (#23272d; hover #373b41; `.VRKBKeyFace .VRKBDone:hover` #5f845a)
```
- States: `.VRKBKey:hover` → `#373b41` / colour `#c1c2c3`. **Pressed key and active shift plane are inline styles** (`style="background:#000"`), so a theme needs `!important` to restyle them, and must keep them distinguishable.
- Shift planes are shown/hidden with `display:none/inline` on `.VRKBShift_*` (Steam-owned).
- Design: like DESIGN §4 keyboard (panel glass slab, fill keys, white pressed key with dark label, Done tinted primary).
- **Never** press keys or Done; never call `VRDashboardManager` methods.

---

## 5. On-demand pages that are not loaded now

These HTML pages exist in `/opt/steamvr/resources/webinterface/dashboard/` and become `vr:<title>` surfaces only while shown. `lgs-vr` themes them automatically when they appear (it polls every 1.5 s).

### 5.1 `messageoverlay.html`
- Shown when an app calls `IVROverlay::ShowMessageOverlay` (mailbox `message_overlay/main`, `OnRenderMessageOverlay` → `VRClient.ShowDashboardOverlay`). Closed by the app or by a button (`OnMessageOverlayResponse`).
- Sheets: chunk~66c0d1388 + chunk~93a8598f9.
- DOM: `div.MessageOverlayContainer` (max 1024×600, transparent) > `div.MessageOverlayPanel` (`background-color: var(--background-color)`, `background-image: var(--background-image)`, radius 15px, padding .85rem) > `div.MessageOverlayTextPanel` (`h1` 1.5rem bold caption, `p` 1rem; max-height 440px, scrolls) + `div.MessageOverlayButtonContainer` > up to 4 `div.ButtonControl > span` (.75rem).
- Design: panel glass (DESIGN §9 "Message overlays"), buttons fill capsules, the first button is the primary.
- No safe trigger: rendering it needs an app call; its buttons answer the app.

### 5.2 `notificationtoast.html`
- Shown while SteamVR renders a notification (mailbox `toast_renderer/main`, `render_toast` → `VROverlayInternal.GetToastInfo`).
- DOM: `div.VRNotificationRoot` > `div.VRNotificationApplicationName` (1.5rem 500, white) + `div.VRNotificationFrame` (`linear-gradient(130deg,#329abf,#0a264e)`, radius 5px, `box-shadow 0 0 10px #00000070`, white text) > `div.VRToastImage` (100px, `style=background-image`, default `notification_steamcog.png`) + `div.VRNotificationTextWrapper` > `div.VRNotificationHeader` (2-line clamp) + `div.VRNotificationText` (3-line clamp); `.VRHintButton`.
- `body { background: none }`. Design: panel glass toast like Steam's (HUD inventory §4).

### 5.3 `bindingcallouts.html`
- Shown when an app asks SteamVR to show binding callouts (`request_binding_callouts` / `cancel_binding_callouts` / `request_tutorial_callout` on the bindingcallouts mailbox). Head-locked panel `bindingcallouts-1`, device-attached panels `bindingcallouts-2` (0.1 m wide) per controller.
- Classes: `CalloutTopLevelContainer`, `CalloutActionSetDialogContainer`, `BindingCalloutAppHeader`, `BindingCalloutConfigName`, `ButtonControl CloseButton`, `DeviceCalloutList > DeviceCalloutListEntry`, `BindingCalloutContainer`, `BindingCalloutImage`, `BindingCalloutContents`, `BindingCalloutColumn`, `BindingCalloutLabelContainer`, `BindingCalloutTitle`, `BindingCalloutIcon`, `BindingCalloutModifierIcon`, `BindingCalloutModeSlot`, `BindingCalloutActionPanel`, `BindingCalloutActionList`, `ChordCalloutHeader`, `ChordCalloutBody`, `ChordCalloutPlus`, `CalloutAnchorPoint` (global, in chunk~93a8598f9.css).
- Design: panel glass callouts.

### 5.4 Desktop-only pages
- `settings_desktop.html` (SteamVR settings in a desktop window; `SettingsMain.Desktop` variant of 2.8), `systemreportviewer.html` (system report: `FullPage`, `TabButtonRow`, `Section`, `PropertyEntry`, `Json*`, `LogContent`…), `debugcommands.html` (developer command palette: `DebugCommands`, `CommandName`, `KeyboardShortcut`…). They open on a monitor from the desktop SteamVR app, never inside the Frame's VR UI. Out of scope unless they appear in `surfaces`.

---

## 6. Never click / never call (SteamVR side)

- Frame controls: Show Keyboard, Float in World, View in Theater, More Options (moves focus), Close; More Options rows (Toggle Curvature, Dock on Left/Right Controller); the gamepad-mode pill "Enter Gamepad Mode".
- Grab handle and resize corner: no mousedown on them (they start a move/resize).
- Now Playing: Resume Game / Return to Home, VR Controller Bindings, VR Video Settings, Clear Performance Assessment Status, Exit Game / Exit Home.
- SteamVR Settings: every control, the Advanced toggle, dropdowns, Developer items.
- Binding UI: Activate, Edit, Create New Binding, Delete, Select this Binding, Edit this Binding, Show Developer output, Export Binding File, Replace Default Binding, Save Personal Binding, Options items, the controller dropdown.
- Keyboard: any key, Done.
- Message overlay buttons.
- APIs: `VRDashboardManager.*` (HideDashboard, CloseKeyboard, OnMessageOverlayResponse…), `frame.SetControlAdditionalOptionsOpen`, `inputFocus.Focus*`, `controllerBindingStore.SelectConfig`, `FrameStore` dock/spatialize setters, `VRPathProperties.Set*`.

Allowed and used here: reading DOM/styles/stores, `outline`/`shot`/`audit`, temporary DOM classes/attributes, the display-only tooltip observable, React state that only decides what is rendered (`bShowRecentApps`, keyboard `bVisible`), read-only binding navigation (`SetSelectedApp`, `ViewBinding(url, true)`, `inputUI.ShowAppSelect`), `window.Dashboard.showDashboardOverlay` for the Now Playing frame while the showcase runs, and the 4.5 s `SwitchToPage` to the settings page under the Steam lab lock.

## 7. Checklist for `theme/vr/*.css`

1. Never paint `html`, `body`, `#root`, `vsg-app`, `.AppSceneGraph`, `vsg-*` elements, `.EmbeddedData`; keep row 0 of systemui untouched.
2. Never change box sizes, padding or margins of panel roots (`%{GrabHandleButton}`, `%{FrameControlsContainer}` and its sections/buttons, `%{ResizeHandleButton}`, `%{ControllerStatusRoot}`, `.ControlBarButtonTooltip`, `%{AdditionalOptions}`, `%{ButtonHitArea}`, `.DashboardPanel`): they are physical quad sizes.
3. Use inset rims and sheens only; panels clip outer shadow and glow.
4. Keep SteamVR's transforms and pseudo-elements: grab bar `scaleX`, resize SVG `scale(1.4)`, `%{GamepadUIButton}::before/::after`, `.SegmentedControlGroup::after` (sliding selection), slider `HandleContainer` `translateX`, `.Dropdown::after` chevron, `.SettingsSidebarButton::before`, `.TransitionAppImage.Waiting::after`, marquee-free.
5. Keep SteamVR's opacity behaviours: frame-controls `.6` idle dim, mirrored binding column `.5`, `.Disabled` `.3`, battery frame `.85`.
6. Run `python glass.py audit vr:systemui` (and `vr:controllerbindingui`) with the theme: 0 GONE/HIDDEN/SHRUNK/UNCLICKABLE/CONTRAST. Baseline today (no `theme/vr` yet): systemui 4 controls / 4 text runs, binding app list 3 controls / 4 text runs, 0 issues. **The audit only sees `.ButtonControl`/`[role=button]`-style controls**, so it does not cover the grab handle, resize corner, controller status, tooltips or `.AppSelectContainer`. For those, compare panel sizes with the theme off and on (they must be identical):
   ```bash
   python glass.py js "JSON.stringify([...document.querySelectorAll('vsg-node[vsg-type=panel]')].filter(n=>n.getBoundingClientRect().width>0).map(n=>{const r=n.getBoundingClientRect(); return [n.getAttribute('sgid'), Math.round(r.width), Math.round(r.height)]}))" --in vr:systemui
   ```
   Re-shoot the states with the pre-scripts and `--theme on`. `audit` and `--theme on` leave the SteamVR pages themed; `shot … --theme off` strips them again.
7. Remember the dark-mode tint: grab/resize panels are multiplied by 0.3 in SteamVR dark mode.
