# HUD inventory: tooltip, volumelevel, floatingfooter, notifications, keyboard

Area id: `hud`. Mapped live on 2026-10-06 against Steam build `11041156` (the webpack chunk id that every module prints). Every token below was resolved with `L.sel()` on the device. Before-shots are in `shots/hud_*.png` at 1.5x.

None of these five surfaces render anything on their own while nobody is using the headset. Each one needs a safe trigger, and every trigger below is local, display-only and self-reverting:

| Surface | Overlay key / window | Quad (CSS px) | Safe trigger used (all auto-revert) | Before-shot(s) |
|---|---|---|---|---|
| `tooltip` | `valve.steam.gamepadui.tooltip.<id>` (pool of up to 3) | 400x40 | synthetic `mouseenter`/`mouseleave` on a bar button, or `vrPooledPopupStore.ShowTooltip(...)` + `hideTooltip()` | `hud_tooltip_before.png`, `hud_tooltip_marquee_before.png` |
| `volumelevel` | `valve.steam.gamepadui.volumelevel` | 250x100 | dispatch the audio store's `m_VolumePressedSubscribable` (volume-button-at-limit event). **The volume is never changed** | `hud_volume_before.png` |
| `floatingfooter` | `valve.steam.gamepadui.floatingfooter` | 600x40 | temporarily add display-only *default action descriptions* with `bShowOnFloatingVRFooter`, then delete them | `hud_footer_before.png`, `hud_footer_two_before.png` |
| `notifications` | window `VRNotificationToasts`, overlay `valve.steam.gamepadui.notifications` | 340x80 | **no real toast**. A static mock with Steam's exact classes is mounted. The notifications window never paints unless SteamVR shows a notification, so screenshots host the mock inside a tooltip window (see 4.3) | `hud_toast_before.png` |
| `keyboard` | window `VRKeyboard`, overlay `valve.steam.gamepadui.keyboard` (SteamVR system keyboard) | 854x280 | main window `SteamClient.OpenVR.Keyboard.Show()`, then `.Hide()` on a timer. No key is ever pressed | `hud_keyboard_before.png`, `hud_keyboard_hover_before.png` |

## 0. Shared facts for all pooled HUD popups (tooltip, volumelevel, floatingfooter)

Source: module `12030` (`VRPooledPopupStore`, exposed as `window.vrPooledPopupStore`) and CSS module `65265`.

- The DOM of every pooled host window:
  ```
  body  %{*PopupBody} GamepadMode BasicUI LowPerfMode     (body has no paint)
    div#popup_target %{PopupRoot}   style="visibility: visible" (set inline by Steam when shown)
      div %{PopupContent} %{AlignCenterX} %{AlignCenterY}   (created per popup instance, removed on close)
        <the popup's own content>
  ```
  - `%{PopupRoot}`: `position:absolute; inset:0; overflow:hidden; display:flex; flex-direction:column; box-sizing:border-box`. **Do not touch.**
  - `%{PopupContent}`: `display:flex; max-width:100%; max-height:100%; overflow:hidden; min-width:0; min-height:0`. Alignment classes add auto margins:
    - `%{AlignCenterX}` / `%{AlignCenterY}` (used by all three surfaces here)
    - `%{PopupContent>AlignLeft}` / `%{PopupContent>AlignRight}` / `%{AlignTop}` / `%{PopupContent>AlignBottom}`
- **The SteamVR clip rect matters most for a reskin.** After mounting, Steam sends `ShowDashboardPopup` with `clip_rect` = the bounding box of the `%{PopupContent}` element in UV space, recomputed by a ResizeObserver. SteamVR only displays that rectangle of the quad. Consequences:
  - Anything you paint outside the content box (outer `box-shadow`, glow, a `::before` that bleeds out) is **cut off in the headset**, even though it shows in a CDP screenshot. `%{PopupContent}` is also `overflow:hidden`.
  - Glass shadows/rims must be drawn *inside* the content box (inset shadows, borders, inner highlights).
  - The only alternative is a small padding increase on the content element. That enlarges the clip rect, which is allowed as a "small padding tweak", but it changes the measured size, so audit it.
- The `#popup_target` inline `visibility` is driven by Steam. Never override `visibility`/`opacity` on root or content.
- Host windows are pooled and reused. Ids such as `62560002` change after a Steam restart, so always match by prefix.

---

## 1. Tooltip (`tooltip`)

### 1.1 How it appears
- Hook `V5` in module `12030`. Only the dashboard bar (module `34493`) uses it. It listens to native `mouseenter`/`mouseleave` and `vgp_onfocus`/`vgp_onblur` on the element. On hover, or on gamepad focus while the nav tree is active, it calls `vrPooledPopupStore.ShowTooltip(el, text, params, overrideFn)`.
- Elements with tooltips (live labels):
  - `%{AddWindowButton}` "Launch Program"
  - the small bar buttons "Playspace Menu", "Toggle Room View", "Streaming Status"
  - `%{QuickAccessButton}` "Quick Access Menu"
  - `%{AvatarButton}` (persona name, or `#Menu_Account`)
  - every `%{BarTab}` (window/app name, e.g. "Steam", "Camera Switch")
  - `%{PopupBody>StatusItem}`, only when the item has a `vrTooltip` (none of the current ones do)
- Placement (module `80384`):
  - Default params: `{unDelayMS:50, normalizedPositionOnElement:{x:0,y:1}, offset:{y_pixels:30, z_pixels:15}}`.
  - The bar overrides that for its own overlay: `offset {y_pixels:-30, z_pixels:10}`, `origin_on_parent.y = -1`. Bar tooltips therefore sit **below the bar**, horizontally centred on the hovered element.
  - `interactive:false`, `inherit_parent_curvature:false`, `parent_overlay_key` = bar.
- Pool: minimum 1, maximum 3 tooltip windows (`tooltip.62560002`, `.62560007`, `.62560008` right now). One tooltip uses the first free host. The `tooltip` surface alias resolves to the first host, which is correct when only one tooltip is up.

### 1.2 Reproduce
Normal tooltip ("Quick Access Menu"):
```bash
python glass.py shot tooltip hud_tooltip_before --theme off --pre "(async()=>{const w=L.surface('bar'); const el=L.q('bar','%{QuickAccessButton}'); el.dispatchEvent(new w.MouseEvent('mouseenter',{bubbles:false,view:w})); setTimeout(()=>el.dispatchEvent(new w.MouseEvent('mouseleave',{bubbles:false,view:w})),6000); await new Promise(r=>setTimeout(r,600)); return 'tooltip shown'})()"
```
Overflowing text, which shows the marquee state. This is a direct store call with no real element state, and the label is synthetic:
```bash
python glass.py shot tooltip hud_tooltip_marquee_before --theme off --settle 1.5 --pre "(async()=>{let req; webpackChunksteamui.push([[Symbol()],{},r=>req=r]); const W=req(80384).hK; const el=L.q('bar','%{QuickAccessButton}'); const h=window.vrPooledPopupStore.ShowTooltip(el,'A very long tooltip label that overflows the 400px tooltip overlay and marquees',W,x=>x); setTimeout(()=>h.hideTooltip(),7000); await new Promise(r=>setTimeout(r,600)); return 'long tooltip'})()"
```
- Use `--theme on` and a new name for after-shots.
- For `audit tooltip`, raise the timeouts to about 9000 ms so the tooltip survives the off/on snapshots.
- **Always** schedule the `mouseleave` or `hideTooltip()`. A synthetic `mouseenter` without a leave leaves a tooltip stuck on the user's bar. Stuck "Launch Program / Playspace Menu / Streaming Status" tooltips were seen during this session and later cleared.
- Check what is up: `python glass.py js "[...vrPooledPopupStore.m_mapTooltips.values()].map(t=>t.m_StrText)"`

### 1.3 DOM and tokens (outline while shown)
```
div %{PopupRoot} [0,0 400x40]
  div %{PopupContent} %{AlignCenterX} %{AlignCenterY} [106,5 187x30]        <- clip rect = this box
    div %{PopupBody>Tooltip} [106,5 187x30] bg=rgba(0,0,0,0.85) r=9000
      div [127,8 145x23]                                                     (unclassed wrapper)
        div %{Marquee>Container} %{Container>Center} %{Container>Playing}   STYLE="--fade-length-left:24px; --fade-length-right:24px; --delay:0.5s; --direction:normal; --duration:4.85s"
          div %{Marquee>Content} "Quick Access Menu"
```
Overflow (marquee) state:
- `%{Marquee}` is added to the container.
- `%{Marquee>Content}` is rendered **twice**, side by side, and scrolls.
- The pill grows to the full 400 px.

### 1.4 What paints today
- **`%{PopupBody>Tooltip}`** (the visible pill)
  - Paint: `background: rgba(0,0,0,.85); color:#fff; border-radius: 9000px`.
  - Box: `padding: .2em 2ch` (3.2px 20.9px); `width: fit-content; height: 100%; max-width: 100%; max-height: 100%; margin: auto; white-space: nowrap; box-sizing: border-box`.
  - Font: 16px Motiva Sans, weight 400.
  - No `::before`/`::after`.
  - A second build exists, so `%{*Tooltip}` expands to two variants. Prefer `%{PopupBody>Tooltip}`.
- **`%{Marquee>Container}`**
  - `display:flex; overflow-x:hidden; position:relative; width:100%`.
  - With `%{Marquee}`: `mask-image: linear-gradient(to right, transparent, black var(--fade-length-left), black calc(100% - var(--fade-length-right)), transparent)`, plus keyframe `fade` (mask-size).
- **`%{Marquee>Content}`**
  - `flex:0 0 auto; display:flex; align-items:center`.
  - With `%{Marquee}`: animation `scroll` (`transform: translateX(0 → -100%)`, linear, infinite, `--duration`) and `padding-right:24px`.
  - `%{Container>Center}` gives the content `justify-content:center`.
- Text colour is inherited from the pill (#fff).

### 1.5 States and things a theme must not touch
- There are no focus or hover states: the tooltip is non-interactive.
- Visibility is popup show/close only. There is no CSS fade apart from the marquee mask fade.
- **Do not touch:**
  - `transform` and `animation` on `%{Marquee>Content}` (Steam's own infinite scroll)
  - the inline custom properties on `%{Marquee>Container}`
  - `mask-image` on the container
  - `width`/`height`/`max-*` on the pill: the clip rect follows the pill size
- Shadows outside the pill are clipped (section 0).
- Glass suggestion: a translucent fill, inset rim and inner highlight inside the pill. Keep #fff text at 4.5:1 or better over bright rooms, because the tooltip floats over passthrough.

---

## 2. Volume HUD (`volumelevel`)

### 2.1 How it appears (module `40572`, component `O`)
- In VR it mounts a pooled popup of host type 5 only while it is visible:
  - visible = `bKeepVisible` (1000 ms after a volume change or volume-button press) or while the user drags the slider
  - otherwise the component returns `false`, so the popup is closed and the DOM removed
- Placement is **head-locked**: `parent_device_path:"/user/head"`, `offset {x:0, y:-0.4 m, z:-0.8 m}`, `rotation.pitch -20°`, `scale 0.4`, `interactive:false`, `only_visible_with_laser:false`, `inherit_parent_curvature/pitch:false`.
- Safe trigger: `req(10652).F5.m_VolumePressedSubscribable.Dispatch()`.
  - This is the event Steam fires when a hardware volume button is pressed at the limit.
  - Its only subscriber is this HUD (`CountRegistered()==1`).
  - It does **not** change the volume and plays no sound. `PlayNavSound(VolSound)` only fires on slider drag-complete.

### 2.2 Reproduce
```bash
python glass.py shot volumelevel hud_volume_before --theme off --pre "(()=>{let req; webpackChunksteamui.push([[Symbol()],{},r=>req=r]); const sub=req(10652).F5.m_VolumePressedSubscribable; const t=setInterval(()=>sub.Dispatch(),300); setTimeout(()=>clearInterval(t),3500); sub.Dispatch(); return 'vol hud shown'})()"
```
Each dispatch re-arms the 1000 ms keep-visible timer. The interval keeps the HUD up for about 3.5 s; use about 9000 ms for `audit`.

### 2.3 DOM and tokens (outline while shown)
```
div %{PopupRoot} [0,0 250x100]
  div %{PopupContent} %{AlignCenterX} %{AlignCenterY} [0,33 250x34]           <- clip rect
    div %{VolumeSliderLabel>VolumePopin} %{VolumeSliderLabel>VR} [0,33 250x34] bg=rgba(14,20,27,0.97) r=15
      div %{VolumeSliderLabel>VolumeSliderPosition} [0,38 250x24]
        div %{*GamepadDialogContent>Field} %{*GamepadDialogContent>WithChildrenBelow} %{*GamepadDialogContent>VerticalAlignCenter} %{*GamepadDialogContent>ChildrenWidthGrow} %{*GamepadDialogContent>ExtraPaddingOnChildrenBelow} %{*GamepadDialogContent>HighlightOnFocus} Panel Focusable  STYLE="--indent-level: 0;"  [17,38 216x24]
          div %{*GamepadDialogContent>FieldLeftColumn}
            div %{*GamepadDialogContent>FieldChildrenWithIcon}
              div %{*GamepadDialogContent>FieldIcon} %{*GamepadDialogContent>BeforeChildren} [17,38 30x24]   (padding-right 10px)
                svg %{IbexDiagramFrontPanelTransparencyEffect>FlipInRTL}   (AudioVolumeIcon, white; the glyph changes with level, muted at 0)
              div %{*GamepadDialogContent>FieldChildrenInner} [47,38 186x24]
                div %{*SliderControlAndNotches>SliderControlPanelGroup} SliderControlPanelGroup Panel Focusable role=button
                  div %{*SliderControlPanelGroup>SliderControlAndNotches} Focusable role=slider  STYLE="--normalized-slider-value: 0.5; --normalized-slider-origin: 0; --slider-extra-notch-padding: 0px;"
                    div %{*SliderControlPanelGroup>SliderControl} SliderControl
                      div %{*SliderControlPanelGroup>SliderTrack} %{*SliderControlPanelGroup>SliderTrackDark} SliderTrack [47,47 186x6] bg=#000 r=3
                        ::before  = the blue fill
```
- `showHandle:false`, so no `%{*SliderControlPanelGroup>SliderHandle}` is rendered.
- `%{VolumeSliderLabel}` (device name) is only rendered outside VR (`!BOnboardAudio && !IsAnyVRWindow`), so it never appears here.

### 2.4 What paints today
- **`%{VolumeSliderLabel>VolumePopin}`**
  - Base rule (desktop/Deck popin): `position:absolute; z-index:7000; background:#23262E; width:268px; padding:5px 0; top:8px; left:8px; display:flex; align-items:center; box-shadow: 0 0 10px rgba(0,0,0,.5); will-change:transform; transition: transform .22s`.
  - With `%{VolumeSliderLabel>VR}`, the effective style is:
    - `position:relative; top:0; left:0; background: rgba(14,20,27,.97); border-radius:15px; padding:5px 0`
    - `box-shadow: 0 0 10px rgba(0,0,0,.5)` (clipped by the clip rect)
    - `will-change:opacity; transition: opacity .5s cubic-bezier(0,.73,.48,1)`
  - This is the only opaque surface: the 250x34 rounded capsule.
- **`%{VolumeSliderLabel>VolumeSliderPosition}`**: `padding:0 17px; flex-grow:1; overflow:hidden`.
- **Field**: `border-radius:2px`; `transform: matrix(1,0,0,1,0,0)` with `transition: transform .32s, background-color 0s`. That is Steam's focus-scale transform: **do not touch**.
- **Track**: `%{*SliderControlPanelGroup>SliderTrack}` + `%{*SliderControlPanelGroup>SliderTrackDark}` paint `background:#000; border-radius:3px; height:6px; transition: background-color .2s`.
- **Fill = `SliderTrack::before`** (Steam's own pseudo-element: do not add your own `::before` there):
  - `content:""; position:absolute; top:0; left:0; height:6px; border-radius:3px; background: rgb(26,159,255)`.
  - Its width is computed from `--normalized-slider-value` (93px at 0.5).
  - Restyle colour, gradient and radius only, never `width`/`left`.
- **Icon**: 20x20 svg, white.

### 2.5 States
- Visible or not: the popup mounts and unmounts.
  - `%{VolumeSliderLabel>VolumePopinHidden}` (VR rule `opacity:0; box-shadow:none`) exists, but in VR the component unmounts instead of applying it, so it is effectively unused here.
- While the user drags (laser on the HUD), the slider is live, but the popup is `interactive:false`, so there are no `.gpfocus` or hover states in practice.
- Muted / 0% shows a different `AudioVolumeIcon` glyph. Not captured, because the volume must never be changed.

---

## 3. Floating footer (`floatingfooter`)

### 3.1 How it appears (module `46307`, components `L9` and `C9`, plus footer module `97502`)
- `L9` renders `C9` only when both hold:
  1. `IsMainVRGamepadUIWindow() && capability DX` (both true now)
  2. at least one current action description has `bShowOnFloatingVRFooter`
- `C9` mounts pooled popup host type 8 with `{special_identifier: Kn.p1, interactive:false}`. SteamVR places it under the dashboard window.
- Inside the popup it renders the normal footer component `pm.w` with `location:"vr-floating"`. That component only shows actions flagged `bShowOnFloatingVRFooter`.
- Real-world sources (module `53487`), set on the null nav tree when the dashboard has no focus:
  - REAR_LEFT_LOWER and REAR_RIGHT_LOWER = "Hide Laser Mouse" / "Laser Mouse", for the Frame controller type
  - SELECT = SteamVR's `cycle_dashboard_focus_label` ("Jump to …")
- Safe trigger:
  - `ActionDescriptionStore.SetDefaultActionsFromMap({25:…, 27:…})` with **descriptions only** (no handlers, nothing bound)
  - then `m_defaultActions.delete(...)` + `Notify()` on a timer
  - Verified restored: defaults back to `[0,1,8,9]`
  - The main window's bottom footer hides `bShowOnFloatingVRFooter` items, so it is unaffected.

### 3.2 Reproduce
One legend (LB/RB "Hide Laser Mouse"):
```bash
python glass.py shot floatingfooter hud_footer_before --theme off --pre "(async()=>{const s=SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.ActionDescriptionStore; const txt=LocalizationManager.LocalizeString('#VRDashboard_HideLaserMouse'); const a={value:txt,bShowOnLeft:true,bShowOnFloatingVRFooter:true}; if(!s.m_defaultActions.has(25)&&!s.m_defaultActions.has(27)){ s.SetDefaultActionsFromMap({25:a,27:{...a}}); setTimeout(()=>{s.m_defaultActions.delete(25); s.m_defaultActions.delete(27); s.Notify();},5000);} await new Promise(r=>setTimeout(r,800)); return 'footer legend injected (display only)'})()"
```
Two legends (SELECT "Jump to Dashboard Bar" + LB/RB):
```bash
python glass.py shot floatingfooter hud_footer_two_before --theme off --pre "(async()=>{const s=SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.ActionDescriptionStore; const a={value:LocalizationManager.LocalizeString('#VRDashboard_HideLaserMouse'),bShowOnLeft:true,bShowOnFloatingVRFooter:true}; const b={value:LocalizationManager.LocalizeString('#VRDashboard_FocusDashboardBar'),bShowOnLeft:true,bShowOnFloatingVRFooter:true}; if(![10,25,27].some(k=>s.m_defaultActions.has(k))){ s.SetDefaultActionsFromMap({10:b,25:a,27:{...a}}); setTimeout(()=>{[10,25,27].forEach(k=>s.m_defaultActions.delete(k)); s.Notify();},5000);} await new Promise(r=>setTimeout(r,800)); return 'ok'})()"
```
- Use about 9000 ms timers for `audit`.
- Check that it is restored: `python glass.py js "[...SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.ActionDescriptionStore.m_defaultActions.keys()]"` should give `[0,1,8,9]`.

### 3.3 DOM and tokens
```
div %{PopupRoot} [0,0 600x40]
  div %{PopupContent} %{AlignCenterX} %{AlignCenterY} [200,0 200x40]        <- clip rect (417x40 with two legends)
    div#Footer %{BasicFooter} %{FloatingVRFooter} [200,0 200x40]
      div %{FooterLegend} [200,0 200x41]
        div %{ActionButtonLegend} [200,3 200x35] r=6                        (one per legend group)
          div %{ActionButtonLegend>ActionButtonGlyph} [208,8 52x25]
            img %{FooterGlyphSize} aria="L5 Button"  src=/steaminputglyphs/sd_l5.svg
            img %{FooterGlyphSize} aria="R5 Button"  src=/steaminputglyphs/sd_r5.svg
          div %{ActionButtonLabel} "Hide Laser Mouse"
```
- Glyph images depend on the active controller type. With no controller active, Steam Deck `L5`/`R5` glyphs are used.
- SELECT renders the pill-shaped "View" glyph: `img %{ControlsListSection>PillShapedIcon} %{FooterGlyphSize}` (28x28).

### 3.4 What paints today
- **`%{BasicFooter}`** (base, shared with the main-window bottom footer):
  - `min-height:40px; position:absolute; bottom:0; left:0; right:0; z-index:7000; display:flex; align-items:center`
  - `background: rgba(0,0,0,.5); border-top:1px solid` + gradient `border-image`
  - `backdrop-filter: blur(100px)`; `padding: 0 calc(4px + 1.4vw)` (unless WithKeyboard)
- **`%{FloatingVRFooter}`** overrides the base:
  - `position:static; width:fit-content; max-width:100%; max-height:100%; padding:0`
  - `border-top:none; border-image:none; background:none`
  - **`filter: brightness(0.6) drop-shadow(black 0 1px 0)`**: the whole legend is dimmed to 60%. The computed `backdrop-filter: blur(100px)` is still present but has nothing to blur (no background).
- **`%{FooterLegend}`**: `display:flex; flex-wrap:wrap; justify-content:flex-end; padding:3px 0; align-items:center; overflow:hidden; flex:1 1 0`. Under floating: `flex:0 0 auto; flex-wrap:nowrap`.
- **`%{ActionButtonLegend}`**
  - `display:flex; align-items:center; padding:5px 8px; border-radius:6px; cursor:pointer; transition: background-color 50ms`
  - `:hover { background: rgba(255,255,255,.1) }`. Never reachable here, because the popup is non-interactive.
- **`%{ActionButtonLegend>ActionButtonGlyph}`**: `display:flex; gap:2px; color: rgb(14,20,27)`.
- **`%{FooterGlyphSize}`**: `height:25px; width:auto`.
- **`%{ActionButtonLabel}`**
  - `margin-left:8px; display:flex`
  - Font: 12px/22px bold, `letter-spacing:.5px; text-transform:uppercase; color:#fff; text-shadow:none`
- No `::before`/`::after` anywhere in the footer. There are no inline styles or transforms.
- Other `%{BasicFooter}` modifiers that do **not** occur on the floating footer: `QuickAccessFooter`, `Opaque`, `Relative`, `WithKeyboard`, `Spacer`, `ScreenReaderEnabledMessage`. The `Spacer` is skipped for `vr-floating`.

### 3.5 Notes for the reskin
- The `brightness(.6)` filter dims any glass fill you add *inside* `%{FloatingVRFooter}`. Restyle the `filter` on `%{FloatingVRFooter}` (it is decorative, so allowed) rather than fighting it.
- Keep the label legible: today it is effectively #999 on passthrough.
- The capsule must fit inside the content box (clip rect).

---

## 4. Notification toasts (`notifications`)

### 4.1 How it works (modules `15148`, `25666`, `21728`, `26711`)
- In VR, component `xe` opens its own popup window `VRNotificationToasts`. This is not pooled:
  - `browserType OpenVROverlay`, `strVROverlayKey valve.steam.gamepadui.notifications`
  - 340x80 = width 320 + 20 and height 80
  - `replace_existing_popup`
  - **`bSuppressGamepadUIStyles:true`**: body has only `LowPerfMode`. There is no `GamepadMode`/`BasicUI`/`%{*PopupBody}` here, so selectors scoped to those classes do not match in this window.
- Each queued toast (from `NotificationStore.PopNextToastNotification`) is portalled into the window. The window is then shown by `SteamClient.OpenVR.VRNotifications.ShowCustomNotification(mainOverlayKey, notificationsOverlayKey, duration)` and hidden with `HideCustomNotification`.
  - SteamVR positions it as a notification relative to the dashboard.
  - There is **no clip rect** here: the whole 340x80 quad is shown, so transparent margins show the room.
- Only notification types where `F7(eType)` is true are shown in VR. Four types are excluded (`e9`, `BP`, `DD`, `C5`).
- **Not triggered for real.** The only test paths are `NotificationStore.Dev_SendTestNotifications` / `Dev_TestNotification` (Settings > Developer). They push into the real toast/tray queue, play a sound, add tray entries, and show a SteamVR notification to whoever wears the headset, so they were not used.

### 4.2 DOM and tokens (structure from source; computed styles verified on a mock in the real window)
Location `PN1` (gamepad toast) always uses the short template `le` (module `25666`), CSS module `21728`:
```
div#popup_target                      (no class, static, 0px tall)
  div[role=alert] %{GamepadToastPopup} %{GamepadToastPlaceholder>VR}  [20,0 320x80]  STYLE="--toast-duration: <ms>"
                                       (+ %{GamepadToastPlaceholder>Warning} for warning types)
                                       (+ the placeholder div stays mounted, empty, when no toast is up)
    div %{ShortTemplate} [%{TwoLine}] [%{ShortTemplate>IncomingCallToast}] Panel Focusable   [20,20 300x40]
      div %{ShortTemplate>ShortLogoDimensions} [40x40]        -> logo: img (avatar / app icon) | div %{ShortTemplate>AppLogo} > div %{ShortTemplate>AppLogoBackgroundImage} + img | div %{GameRecordingLogo} | svg %{GameRecordingLogo>FramePromoLogo} ...
      div %{ShortTemplate>AvatarStatus} online|ingame|offline|awayOrSnooze     (friend toasts only, 3px strip)
      div %{ShortTemplate>Content} [%{ShortTemplate>FullWidth}]
        div %{ShortTemplate>Header}
          div %{ShortTemplate>Icon} > svg (13x13)   (optional)
          div %{ShortTemplate>Title} "Clip Saved"
        div %{ShortTemplate>Body} "View clip in Recordings"
```
- The intermediate `Ay` wrapper is context only (no DOM), so `%{ShortTemplate}` is the **direct child** of `%{GamepadToastPopup}`. It therefore receives the `> *` rules: outline and animations.
- Per-type body/logo classes may appear inside the template. They live in CSS module `48248`:
  - `GameRecordingLogo`, `FramePromoLogo`, `ShortNotificationSteamLogo`, `LowBatterySteamLogo`
  - `AchievementIcon`, `ProgressBar`, `LowBattery*`, `ScreenshotThumbnail`, `FriendName`, `FriendGame`, …
  - Prefix them with `%{GameRecordingLogo>…}` where a name is ambiguous.

### 4.3 Reproduce (static mock, never a real notification)
The notifications window does not paint while SteamVR hides it, and `shot notifications` times out. Two recipes:

**(a) Inspect or measure in the real (hidden) window.**
- `outline`, `styles` and getComputedStyle work without painting.
- Mount the mock into `L.surface('notifications').document.body` with the builder below (change the target document), then run `python glass.py outline notifications`, and remove it afterwards.

**(b) Screenshot.**
- Host the identical mock inside a tooltip window, which paints while a one-character tooltip is up.
- The headset user only sees the tooltip's tiny clip rect for about 4 s.
- The mock uses the real `%{GamepadToastPopup}`/`%{ShortTemplate}` classes, so `--theme on` styles it exactly like a real toast.
- Caveat: the host body carries `GamepadMode BasicUI`, unlike the real notifications window.
- The 40 px host height fits the single-line toast only.

```bash
PRE=$(cat <<'EOF'
(async()=>{
 let req; webpackChunksteamui.push([[Symbol()],{},r=>req=r]);
 const st=window.vrPooledPopupStore; const W=req(80384).hK;
 const h=st.ShowTooltip(L.q('bar','%{QuickAccessButton}'),' ',W,x=>x);
 await new Promise(r=>setTimeout(r,800));
 const inst=[...st.m_mapPooledPopupInstances.values()].find(i=>i.eHostType==2&&i.state==2);
 if(!inst){ h.hideTooltip(); return 'no tooltip host'; }
 const d=inst.hostWindow.popupWindow.document;
 const T=req(26711), S=req(21728); const t=x=>(T.default||T)[x], s=x=>(S.default||S)[x];
 const bd=L.surface('bar').document;
 const logo=bd.querySelector(L.sel('%{SteamSVG}')).cloneNode(true); logo.setAttribute('style','width:40px;height:40px');
 const icon=(bd.querySelector(L.sel('%{NotificationsIcon}')+' svg')||bd.querySelector(L.sel('%{PopupBody>StatusItem}')+' svg')||logo).cloneNode(true);
 const root=d.createElement('div'); root.id='lgs-hud-toast-preview'; root.style.cssText='position:fixed;inset:0;';
 root.innerHTML=`<div role="alert" class="${t('GamepadToastPopup')} ${t('VR')}" style="--toast-duration: 600000ms;"><div class="${s('ShortTemplate')} Panel Focusable"><div class="${s('ShortLogoDimensions')}"></div><div class="${s('Content')}"><div class="${s('Header')}"><div class="${s('Icon')}"></div><div class="${s('Title')}"></div></div><div class="${s('Body')}"></div></div></div></div>`;
 root.querySelector('.'+s('ShortLogoDimensions')).appendChild(logo);
 root.querySelector('.'+s('Icon')).appendChild(icon);
 root.querySelector('.'+s('Title')).textContent=LocalizationManager.LocalizeString('#Notification_InstantClip_Title');
 root.querySelector('.'+s('Body')).textContent=LocalizationManager.LocalizeString('#Notification_InstantClip_Body');
 d.body.appendChild(root);
 setTimeout(()=>{ root.remove(); h.hideTooltip(); }, 4000);
 await new Promise(r=>setTimeout(r,300));
 return 'mock toast hosted in '+inst.hostWindow.overlayKey;
})()
EOF
)
python glass.py shot tooltip hud_toast_before --theme off --pre "$PRE"
```
- The returned host key must be the first tooltip host (the `tooltip` alias). If another tooltip is stuck, shoot `tooltip.<id>` instead.
- For a TwoLine mock add `s('TwoLine')` to the template class and use `#Notification_RedeemFramePromo_*` texts. It needs a host taller than 40 px, so it was not screenshotted: inspect it in the notifications window instead.

### 4.4 What paints today
- **`%{GamepadToastPopup}`**
  - Layout: `position:absolute; inset: 0 0 0 20px; display:flex; align-items:center`. That gives a 320x80 area at x=20 inside the 340x80 quad.
  - Children (`> *`): `animation: toastEnter, toastExit; 300ms; cubic-bezier(0,.73,.48,1); delay 0s, var(--toast-duration); fill-mode forwards`. toastEnter = `translateX(300px → 0)`, toastExit = `opacity 1 → 0`.
  - VR (`%{GamepadToastPlaceholder>VR}`) children use `animation-name: toastEnterVR, toastExitVR` instead (both opacity 1 → 1, so no motion in VR) plus **`outline: 1px solid rgb(96,96,96)`**.
  - `> %{GamepadToastPlaceholder>Show}` / `> %{GamepadToastPlaceholder>Hide}` swap in the single enter/exit animation (used for `fnNotificationResolved` toasts).
  - `%{GamepadToastPlaceholder>Warning}`: `top:20px; bottom:20px; display:block`.
  - **Do not override `animation`, `transform`, `position` or `inset`** on these.
- **`%{ShortTemplate}`** (the visible toast card)
  - `display:flex; flex-direction:row; align-items:center; padding:0; width:300px; height:40px`
  - `background: rgb(14,20,27)`; `box-shadow: 0 0 20px rgba(0,0,0,.5)` (visible, because there is no clip rect: 20 px margins exist on every side)
  - `transition: background-color 50ms`; `:hover { background: rgb(35,38,46) }` (laser hover)
  - Radius **0**.
  - `%{TwoLine}`: `height:auto; max-height:60px` and the body clamps to 2 lines.
  - `%{ShortTemplate>IncomingCallToast}`: `background: radial-gradient(80px 80px at 60px 12px, rgb(89,191,64), rgb(35,108,57) 70%); border-left:1px solid #000`, white body text.
  - No `::before`/`::after`.
- **`%{ShortTemplate>ShortLogoDimensions}`**: 40x40, `flex-shrink:0`.
- **`%{ShortTemplate>AvatarStatus}`**: `width:3px; align-self:stretch; box-shadow:-1px 0 1px rgba(0,0,0,.667)`. Status colours:
  - `.online` #4CB4FF
  - `.ingame` #59BF40
  - `.offline` #67707B
  - `.awayOrSnooze` repeat-y dot mask
- **`%{ShortTemplate>Content}`**: `margin:5px 12px; min-width:0`. With `%{ShortTemplate>FullWidth}`, `flex-grow:1`.
- **`%{ShortTemplate>Header}`**: `display:flex; height:14px; line-height:14px`.
- **`%{ShortTemplate>Icon}`**: 13x13, `margin-right:8px; color:#fff`, svg 13x13.
- **`%{ShortTemplate>Title}`**: 11px/500 Motiva Sans, `#fff`, nowrap, ellipsis.
- **`%{ShortTemplate>Body}`**: 12px/16px, `rgb(184,188,191)`, nowrap, ellipsis, `height:16px` (with TwoLine: 2-line clamp, `height:auto`); `img { height:1em }`.
- **`%{ShortTemplate>Count}`**: blue `#1A9FFF` pill, `border-radius:26px`.
- **`%{ShortTemplate>AppLogo}`**
  - `display:flex; height:100%; position:relative; overflow:hidden`
  - `> img`: 32x31, `border-radius:2px; border:1px solid rgba(0,0,0,.61); box-shadow:0 2px 4px rgba(0,0,0,.5)`
  - `%{ShortTemplate>AppLogoBackgroundImage}`: `position:absolute; transform:scale(6); filter: contrast(1) saturate(7) brightness(2) blur(3px)`. Steam's positioning transform: **don't touch**.
- The placeholder `%{GamepadToastPlaceholder}` (`position:fixed; bottom:30px; right:0; 300x40 + padding`) is the **non-VR** embedded container and is not used in VR.

---

## 5. VR keyboard (`keyboard`)

### 5.1 How it appears
- The `VRKeyboard` window (component `Rg`, module `46307`) is always mounted. Steam's VirtualKeyboardManager shows it with `SteamClient.OpenVR.Keyboard.Show()` whenever a text field gets focus (`BUseVRKeyboard()` is true).
- Status lives in `req(58508).qL.m_VRKeyboardState`: `{m_bIsOpen, m_eVRKeyboardFlags:13, m_sOpenForOverlayKey, m_bDispatchEventsToSteamVR:true}`.
- SteamVR positions the 854x280 keyboard overlay under the overlay that opened it (the main window here).
- Two modes:
  - **minimal** (Steam UI fields; what we get): no text preview, and the bottom 41 px of the quad are transparent
  - **buffered** (when an app opens the keyboard without the minimal flag): a 40 px `%{VirtualKeyboardTextBuffer}` row is rendered **above** the keys
- Safe trigger: `L.surface('main').SteamClient.OpenVR.Keyboard.Show()` / `.Hide()`. Nothing is typed, and `m_bIsOpen` was verified back to `false` afterwards.
- Hover: a bubbling synthetic `mouseover` on a key hit area fires React `onMouseEnter`, which sets `%{Modal>Focused}` on that key. **Never** send `pointerdown`/`click` to keys: that types into the focused field or SteamVR.

### 5.2 Reproduce
```bash
python glass.py shot keyboard hud_keyboard_before --theme off --pre "(async()=>{const mw=L.surface('main'); mw.SteamClient.OpenVR.Keyboard.Show(); setTimeout(()=>mw.SteamClient.OpenVR.Keyboard.Hide(),4500); await new Promise(r=>setTimeout(r,900)); return 'vr keyboard shown (auto-hide 4.5s)'})()"

python glass.py shot keyboard hud_keyboard_hover_before --theme off --pre "(async()=>{const mw=L.surface('main'); mw.SteamClient.OpenVR.Keyboard.Show(); await new Promise(r=>setTimeout(r,700)); const kw=L.surface('keyboard'); const hit=kw.document.querySelector('[data-key=\"g\"]'); const ev=t=>hit.dispatchEvent(new kw.MouseEvent(t,{bubbles:true,view:kw,relatedTarget:null})); ev('mouseover'); setTimeout(()=>{ev('mouseout'); mw.SteamClient.OpenVR.Keyboard.Hide();},4500); await new Promise(r=>setTimeout(r,300)); return L.readable(hit.firstElementChild).join(' ')})()"
```
- `outline keyboard` and `styles keyboard …` work **without** showing it, because the DOM is laid out while hidden.
- `audit keyboard` can run without a trigger.
- Check that it is closed: `python glass.py js "(()=>{let req; webpackChunksteamui.push([[Symbol()],{},r=>req=r]); return req(58508).qL.m_VRKeyboardState.m_bIsOpen})()"`

### 5.3 DOM and tokens
```
body %{*PopupBody} GamepadMode BasicUI LowPerfMode [0,0 854x280]
  div#popup_target [854x280]
    div#"vr virtual keyboard" %{VirtualKeyboardStandaloneContainer>VRFloatingKeyboard} %{VirtualKeyboardStandaloneContainer>VirtualKeyboardContainer}  data-react-nav-root  [0,0 854x280]
      div %{VRVirtualKeyboardContents} [0,0 854x239]
        (buffered mode only) div %{VirtualKeyboardTextBuffer} > span %{VirtualKeyboardTextBufferText} + div %{VirtualKeyboardTextBufferCursorContainer} > div %{VirtualKeyboardTextBufferCursor} + span %{VirtualKeyboardTextBufferText}
        div %{Modal>Keyboard} Layout_qwerty DefaultTheme %{Modal>VRFloatingKeyboard} Panel Focusable role=grid [0,0 854x239] bg=#23262E
          div %{Keyboard>KeyboardRow} Row_0..Row_4 Panel Focusable role=row [850x47]
            div role=gridcell style="display: contents"
              div %{KeyboardKeyHitArea} [size class] Panel Focusable role=button data-key=… data-key-row data-key-col data-keycode [data-extended-chars]   (hit area, padding 1px 1px 2px 2px)
                div %{Modal>KeyboardKey} [special class] Col_N KeyTheme_<key> [%{Modal>Focused}|%{Modal>Touched}|%{Modal>ToggleOn}|%{Modal>ToggleOneShot}|%{Modal>KeyboardKeyDeadKey(Active)}]
                  span %{Modal>ShiftedLabel} "!"   (or span %{Modal>ShiftActive} when shifted)
                  span "1"                         (or span %{Modal>InactiveLabel} when shifted)
                  [span %{Modal>AltGrLabel}]       [div %{Modal>ActionButtonGlyph} %{KeyboardActionButtonLeft|Right|CenterLeft}]
          span %{AriaLiveRegion} (1x1, visually hidden: leave alone)
```
Special keys:

| Key | Hit-area size class | Key class |
|---|---|---|
| backtick | `%{KeyboardHalfKeySize}` (3.3%) | plain key |
| Backspace | `%{KeyboardBackspaceSize}` (11.7%) | `%{Modal>KeyboardBackspace}` |
| Tab | `%{KeyboardTabKeySize}` (7%) | `%{Modal>KeyboardTabKey}` |
| Caps | `%{KeyboardCapsKeySize}` (9.4%) | `%{Modal>KeyboardCapsKey}` |
| Enter | `%{KeyboardEnterSize}` (11.7%) | `%{Modal>KeyboardEnter}` |
| Left / right Shift | `%{KeyboardLeftShiftSize}` / `%{KeyboardRightShiftSize}` (14%) | `%{Modal>KeyboardLeftShift}` / `%{Modal>KeyboardRightShift}` |
| Steam Chat Items (emoji) | `%{KeyboardMetaKeySize}` (8.2%) | `%{Modal>KeyboardMetaKey}` |
| Left, Right | `%{KeyboardMetaKeySize}` | `%{Modal>KeyboardMetaKey}`, with two svgs each |
| Close (`KeyTheme_VKClose`) | `%{KeyboardMetaKeySize}` | plain key, svg |
| Space | `%{KeyboardSpacebarSize}` (grow) | `%{Modal>KeyboardSpacebar}` |

Per-key hooks: `KeyTheme_<key>`, `Col_N` and `Row_N` are **unhashed** classes Steam uses for keyboard skins.

### 5.4 What paints today (Steam keyboard skin = CSS variables)
- **The keyboard is themed through custom properties** set on `%{Modal>Keyboard}.DefaultTheme`. The values in brackets are the defaults:
  - Background: `--background-color` (#23262E, also the gap colour between keys) and `--foreground-color` (#fff).
  - Normal keys:
    - `--key-background-color` (#0e141b), `--key-color` (#fff)
    - `--key-shift-label-color` (#fff, shown at opacity .45)
    - `--key-action-button-glyph-color`
  - Focused key:
    - `--key-focused-background-color` (#fff), `--key-focused-color` (#0e141b)
    - `--key-focused-shift-label-color` (#000)
    - `--key-focused-action-button-left-color` / `--key-focused-action-button-right-color`
  - Special keys, each with a `-color` and a `-background-color` variable:
    - `--key-meta-*`, `--key-tab-*`, `--key-caps-*`, `--key-shift-*`, `--key-enter-*` (#000 backgrounds); `--key-enter-action-button-glyph-color`
    - `--key-backspace-*` (#000 background)
    - `--key-spacebar-*` (#0e141b background)
    - `--key-spacer-background-color`
  - Extended (long-press) keys: `--key-extendedkey-(background-color|color|focused-…|hover-…)`.
  - Toggles: `--key-toggleon-background-color` (#1a9fff), `--key-toggleon-color`, `--key-toggleoneshot-color` (#1a9fff).
  - Emoji layout: `--key-emoji-*`, `--key-emoji-category-*`.
  - Press: `--key-touched-background-color` (#fff), `--key-touched-color` (#000).
  - Trackpad pointer: `--key-pointer-stroke-color`, `--key-pointer-background-color`.
  - Dead keys: `--key-deadkey-background-color`, `--key-deadkeyinactive-color`, `--key-deadkeyactive-color`.
- Steam ships many **user-selectable keyboard skins** as extra classes on the same element. Examples: `Pumpkin`, `Grape`, `Seafoam`, `Cerulean`, `Ruby`, `Spectrum`, `Digital`, `TotallyTubular`, `SteamGreen`, `NightShift`, `DEX`, …
  - Several skins use `::before`/`::after` on `%{Modal>KeyboardKey}`, `transform: skew()`, or infinite glow animations.
  - Decide whether Glass overrides only `.DefaultTheme` (respecting a user's chosen skin) or all skins. Overriding only the variables on `%{Modal>Keyboard}.DefaultTheme` is the least invasive route.
- **`%{Modal>Keyboard}`**: `display:flex; flex-direction:column; background: var(--background-color); padding:3px 3px 1px 1px; overflow:hidden; position:relative; max-width:1280px`. With `%{Modal>VRFloatingKeyboard}`: `margin-top:auto`.
- **Outer container** `%{VirtualKeyboardStandaloneContainer>VirtualKeyboardContainer}`
  - `display:flex; justify-content:center; position:relative; z-index:6000; overflow:hidden`
  - `background: var(--background-color)`. The variable is undefined at this level, so the container is transparent; that is why the bottom 41 px show the room.
  - **`animation: keyboard_appear 300ms`** (height 40 → 240 px, opacity 0 → 1).
  - With `%{VirtualKeyboardStandaloneContainer>VRFloatingKeyboard}`: `height:100vh`.
- **`%{VRVirtualKeyboardContents}`**: `position:absolute; left:0; right:0`. Do not touch.
- **`%{KeyboardKeyHitArea}`**: `position:relative; min/max-height:44px; padding:1px 1px 2px 2px; flex-grow:1; width:0`. Its inner key has `pointer-events:none` (Steam's own).
- **`%{Modal>KeyboardKey}`**
  - `background: var(--key-background-color); color: var(--key-color); display:flex; flex-direction:column; justify-content:center; min/max-height:44px; position:relative; cursor:pointer`
  - **border-radius 0**, no border, no shadow
  - `svg { 24x24 }`
  - `span { margin:2px; transition: transform, opacity .18s }`
- **`%{Modal>ShiftedLabel}`**: 14px, `opacity:.45; line-height:8px; transform:translateY(4px)`; colour `var(--key-shift-label-color)`.
- Special keys (`%{Modal>KeyboardEnter}`, Backspace, Tab, Caps, Shift):
  - 12px/16px, label bottom-aligned (`justify-content:flex-end`; span `margin:0 8px 6px`); Enter, right Shift and Backspace are `text-align:right`
  - each uses its own `--key-*` variables, with #000 backgrounds by default
  - Enter is weight 500
- **`%{Modal>KeyboardMetaKey}`**: `background: var(--key-meta-background-color)`, centred icon.

### 5.5 States

| State | How it shows | Captured? |
|---|---|---|
| Focus / laser hover | **`%{Modal>Focused}`** on the inner `%{Modal>KeyboardKey}`: `background: var(--key-focused-background-color)` (white), `color: var(--key-focused-color)`, `img { filter: invert(1) }`, shift label → `--key-focused-shift-label-color`, action glyph colours switch. The keyboard uses *virtual focus*, so **`.gpfocus` is not used on keys**: style `%{Modal>Focused}` | yes, `hud_keyboard_hover_before.png` |
| Pressed | **`%{Modal>Touched}`**: base `var(--key-touched-*)`. DefaultTheme overrides it to `background: rgb(26,159,255)` plus Steam's own **`::after`** shine (`content:""; background:#fff; border-radius:6px; mix-blend-mode:overlay; position:absolute; transform:translate(-50%,-50%)`, 0.3 s `shine` animation). Do not add another `::after` on keys | no: needs a key press |
| Shift / Caps on | `%{Modal>ToggleOn}` (blue `--key-toggleon-*`, bold) on the Shift/Caps key. Every character key swaps spans: `%{Modal>ShiftActive}` (`translateY(16px)`, 14px) and `%{Modal>InactiveLabel}` (`translateY(6px); opacity:0`, Steam's own hide). `%{Modal>ToggleOneShot}` (blue text) for one-shot shift | no: needs a key press |
| Dead keys | `%{Modal>KeyboardKeyDeadKey}` / `%{Modal>KeyboardKeyDeadKeyActive}` | no |
| Long-press extended characters | `%{KeyboardExtendedRow}` (absolute, `top:-44px`, z 3) of `%{KeyboardExtendedKey}` (48 px, `--key-extendedkey-*`, `%{Modal>Focused}`, `:hover`) | no: needs a press |
| Emoji / Steam Chat Items layout | `%{Modal>EmojiKeyboard}`, `%{Modal>KeyboardEmojiHeader}`, `%{KeyboardEmojiKey}` (55x44, `%{Modal>Focused}`), `%{KeyboardSteamItemKey}` | no: clicking the layout key changes keyboard state |
| IME rows (CJK) | `Row_IME`, `%{KeyboardImeLutKey}`, `KeyboardImeAuxText`, `KeyboardImePreeditText`, `KeyboardImeUnavailable` (all in module `27752`) | no |
| Buffered text preview (app-opened keyboard) | `%{VirtualKeyboardTextBuffer}`: `display:flex; justify-content:center; align-items:baseline; height:40px; background: rgb(21,31,37)`. Text 24px `rgb(223,227,230)`, `white-space:pre-wrap`. Cursor 1x24 `rgb(223,227,230)` | no |
| Numeric layout | `%{Modal>NumericKeypad}`, `%{Modal>Controls}` | not used by the VR keyboard so far |

- **Do not touch:**
  - `transform` and `opacity` on label spans (`%{Modal>ShiftedLabel}`, `%{Modal>ShiftActive}`, `%{Modal>InactiveLabel}`, `%{Modal>AltGrLabel}`)
  - `animation` on the outer container
  - `display:contents` gridcells
  - `pointer-events` on keys
  - the hit-area padding: it is the hit target
  - `%{AriaLiveRegion}`
- There is a second copy of the keyboard CSS module (`67067`, used for the container classes). Its `Keyboard`/`KeyboardKey`/… hashes are different and are not used for the VR keys. `%{*KeyboardKey}` covers 3 variants if you want build-proofing; avoid `%{*Focused}`, which matches unrelated modules.

---

## 6. Not reachable, and why

- **Real notification toasts.**
  - Not triggered: the only test paths are the developer test notifications, which hit the real toast/tray queue and show a SteamVR notification. A class-exact static mock was used instead.
  - Two-line, friend (`AvatarStatus`), incoming-call and Warning variants are mapped from CSS only. The 40 px tooltip host cannot fit a two-line card.
- **The `notifications` surface cannot be screenshotted directly.** CEF does not paint it while SteamVR hides it, and `captureScreenshot` timed out after 30 s. Use the tooltip-host recipe (4.3) or outline/styles.
- **Volume HUD:**
  - muted / 0% glyph and the drag state: needs a volume change, which is forbidden
  - `%{VolumeSliderLabel}`: never rendered in VR
  - `VolumePopinHidden`: never applied in VR
- **Floating footer:** the real Frame-controller glyph art. With no controller active, Steam Deck L5/R5 / View glyphs render. Real labels come from SteamVR (`cycle_dashboard_focus_label`).
- **Keyboard:** pressed (`Touched`), Shift/Caps `ToggleOn`, dead keys, long-press extended row, emoji / Steam items layouts, IME rows and the buffered text preview. All of these need key presses or layout changes, so they are mapped from CSS and source (5.5).
- **Other pooled HUD popups outside this area's surface list:**
  - `vrcontrollers`: 1200x800, head-locked at y −0.5 m / z −1.5 m, scale 0.6; only shown during the Frame guided tour (`S6`/`I6`)
  - `loginqrcode` (500x500)
  - `mainmenu` (300x800)
  - None of these windows exist right now (minimum pool 0).

## 7. Risks for the reskin (summary)

1. **Clip rect.** Tooltip, volume and footer are cropped by SteamVR to the `%{PopupContent}` box. Outer shadows, glows and bleed are invisible in the headset even though screenshots show them. Notifications and keyboard have no clip rect.
2. **Two-layer toast transparency.** The notifications quad has a 20 px transparent margin around the 300x40 card. Steam's 20 px black `box-shadow` currently paints into it.
3. **No GamepadMode/BasicUI on the notifications body.** Theme rules prefixed with `body.GamepadMode` or relying on `.BasicUI` will not apply to toasts.
4. **Steam's own pseudo-elements:**
   - `SliderTrack::before` = volume fill
   - `KeyboardKey.Touched::after` = press shine (DefaultTheme)
   - other keyboard skins use `KeyboardKey::before/::after`
   - tooltip, footer and toast use none
5. **Steam-animated or positioned properties to leave alone:**
   - marquee `transform` animation and inline `--duration`/`--fade-length-*`
   - the volume Field `transform` transition
   - inline `--normalized-slider-value`
   - toast `> *` enter/exit animations and `--toast-duration`
   - keyboard container `keyboard_appear` and label-span transforms
   - `AppLogoBackgroundImage` `scale(6)`
6. **The floating footer's `filter: brightness(.6)`** dims anything painted inside it. Adjust that filter rather than stacking backgrounds.
7. **Keyboard skins.** Users can pick other keyboard themes (Pumpkin, NightShift, DEX …). A Glass override scoped to `.DefaultTheme` variables preserves them; a broader override must also neutralise their pseudo-elements.
8. **Shared pooled tooltip windows.** A stuck synthetic hover moves the next tooltip to host 2 or 3, so `shot tooltip` captures the wrong window. Always schedule `mouseleave`/`hideTooltip()`, and check `m_mapTooltips`.
9. **Every trigger above is timer-reverted.** Keep timers longer than the command, about 9 s for `audit`, which snapshots twice.
