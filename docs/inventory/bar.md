# Inventory: area `bar` (surfaces `bar`, `barpopup`, `frame.menu`, plus bar `tooltip`)

Mapped live on the Frame on 2026-10-06 with the theme **off** (no `lgs` styles in any window). All shots are 1.5x and named `shots/bar_*_before.png`. The class tokens below are copied from `python glass.py outline` output. Steam's own CSS was read from the live stylesheets and is quoted with tokens substituted.

Source modules, for anyone re-reading Steam's code via `webpackChunksteamui`:
- `34493` is the dashboard bar: tabs, the **+** button, small buttons, Quick Access, avatar, and the popup host `Jt`.
- `62678` holds the header items that render as bar buttons in region 2 and as status icons in region 3.
- `53318` holds the bar popup list, list item and popup host `fH`.
- `53487` and `46424` are the frame menu / `DashboardMenu`.
- `12031` is the bar CSS module and `64617` is the `DashboardMenu` CSS module.

---

## 0. How to reproduce (read first)

### 0.1 Two driver pitfalls found while mapping

1. **`python glass.py shot bar …` captures the wrong window.**
   - `lab.py target_for()` matches the overlay key by prefix (`valve.steam.gamepadui.bar`).
   - CEF lists `valve.steam.gamepadui.barpopup.62560001` before `valve.steam.gamepadui.bar`, so `shot bar` saves the barpopup window.
   - JS-side `L.surface('bar')` (outline, styles, js) is correct, because it searches `g_PopupManager` in creation order.
   - Workaround used for every `bar` shot here: a shim that monkeypatches `lab.target_for` to prefer an exact overlay-key match, then calls `lab.main()`. It was uploaded to `/tmp/lgs/barshot_shim.py` on the device, so no repo file was changed:
     ```python
     import sys; sys.path.insert(0, "/home/steamos/.local/share/glass-shell/lab")
     import lab, lgs
     def target_for(surface):
         key = lab.OVERLAY.get(surface) or "valve.steam.gamepadui." + surface
         ts = lgs.targets()
         for t in ts:
             if lgs.overlay_key(t) == key: return t
         for t in ts:
             if lgs.overlay_key(t).startswith(key): return t
         raise SystemExit("no CEF target for " + surface)
     lab.target_for = target_for
     lab.main(sys.argv)
     ```
     Run it as `env -u LD_LIBRARY_PATH -u LD_PRELOAD /usr/bin/python3 /tmp/lgs/barshot_shim.py shot bar /tmp/lgs-shots/X.png --theme off [--pre …]`, then sftp the PNG back.
   - **The real fix is a one-line change in `lab.py` (exact match first). Whoever owns lab/ should apply it.** Until then, every `--theme on` after-shot of `bar` taken with `glass.py shot bar` is actually a barpopup capture.
2. **Git Bash rewrites `--route /x` arguments.**
   - MSYS path conversion turns `/apprunning` into `C:/Program Files/Git/apprunning`.
   - The live route was observed as `/library/tab/C:/Program Files/Git/apprunning`, apparently left there by another agent's command.
   - Always prefix with `MSYS_NO_PATHCONV=1` (or `export` it) when you pass `--route`.

### 0.2 Surface ids

| alias | live popup name (this boot) | notes |
|---|---|---|
| `bar` | `valve.steam.gamepadui.bar.62560000` (overlay key `valve.steam.gamepadui.bar`) | 1200x80. See the capture bug above |
| `barpopup` | `valve.steam.gamepadui.barpopup.62560001` | 300x1024. **One** shared window for every bar popup. Opening one popup closes the others |
| `frame.menu.62560005` | Steam frame's left menu | 300x800. Use the full id: `frame.menu` alone resolves to the first one created |
| `frame.menu.62560006` | pooled, empty (`<div id=popup_target>` only) | host for a second frame's left menu. The Camera Switch frame has none |
| `tooltip` | `valve.steam.gamepadui.tooltip.62560002` | 400x40, bar tooltips |

Find the frame menu window that holds the Steam menu (ids change after a Steam restart):
```
python glass.py js "[...g_PopupManager.m_mapPopups.values()].map(p=>p.m_strName).filter(n=>n.includes('frame.menu')).map(n=>{const a=n.replace('valve.steam.gamepadui.','').replace(/_uid\d+$/,'').split('.').slice(0,3).join('.'); let has=false; try{has=!!L.q(a,'%{Variant_FrameMenu}')}catch(e){} return a+' frameMenu='+has})"
```

### 0.3 `--pre` snippets (tested verbatim)

**OPEN**: click a bar button so its popup opens and stays open. It closes all bar popups first, because clicking an open popup's button toggles it closed. It then fakes `mouseenter` so the 2 s auto-close (`Ck=2000`, mouse not over button or popup) never fires. The optional second argument runs after opening.
```
(async(sel,after)=>{const W=ms=>new Promise(r=>setTimeout(r,ms));for(const p of SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.VRDashboardBarPopups)p.closePopup();await W(400);const el=L.q('bar',sel);L.click('bar',sel);el.dispatchEvent(new(L.surface('bar').MouseEvent)('mouseenter'));await W(900);if(after)await after(W);return 1})('%{AddWindowButton}')
```
Selectors used with it:
- `%{AddWindowButton}` opens the + list.
- `%{SmallBarButtons} > .VRDashboardBarSmallButton:nth-child(1)` opens the Playspace Menu.
- `%{SmallBarButtons} > .VRDashboardBarSmallButton:nth-child(3)` opens Streaming Status.
- `%{QuickAccessButton}` opens the Quick Access Menu.
- **Never use `:nth-child(2)` with OPEN.** It is Toggle Room View, an action button with no popup, and clicking it toggles passthrough.

**HOVER**: bar tabs open their tab menu on hover (interactionType `"hover"`, 200 ms timer). Never click a tab, because a click switches the dashboard tab.
```
(async(sel,i)=>{const W=ms=>new Promise(r=>setTimeout(r,ms));for(const p of SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.VRDashboardBarPopups)p.closePopup();await W(400);const w=L.surface('bar'),el=L.qa('bar',sel)[i||0];el.dispatchEvent(new w.MouseEvent('mouseenter'));await W(1000);return 1})('%{BarTab}',0)
```
Use index 0 for the Steam tab and 1 for the Camera Switch app tab.

**CLEANUP**: run this after you finish. It clears the faked hovers, closes popups and hides the tooltip.
```
(()=>{const w=L.surface('bar');for(const e of w.document.querySelectorAll('.Focusable'))e.dispatchEvent(new w.MouseEvent('mouseleave'));for(const p of SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.VRDashboardBarPopups)p.closePopup();return 1})()
```

**FRAME MENU expand**: the menu expands 500 ms after `mouseenter` and collapses 800 ms after `mouseleave`.
```
(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms)); const w=L.surface('frame.menu.62560005'); const el=L.q('frame.menu.62560005','%{DashboardMenu}'); const r=el.getBoundingClientRect(); el.dispatchEvent(new w.MouseEvent('mouseenter',{clientX:r.x+20,clientY:r.y+20})); await W(1100); return 1})()
```

**TOOLTIP**: the tooltip shows on `mouseenter` of any bar button. Clear first, because earlier faked hovers stick.
```
(async(sel,i)=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const w=L.surface('bar');for(const e of w.document.querySelectorAll('.Focusable'))e.dispatchEvent(new w.MouseEvent('mouseleave'));for(const p of SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.VRDashboardBarPopups)p.closePopup();await W(500);L.qa('bar',sel)[i||0].dispatchEvent(new w.MouseEvent('mouseenter'));await W(900);return 1})('%{SmallBarButtons} > .VRDashboardBarSmallButton:nth-child(2)',0)
```
Hovering, not clicking, Room View is safe.

### 0.4 Never click (side effects)

| Element | Effect of a click |
|---|---|
| any row in the **+** list | `SteamClient.Apps.LaunchNonSteamApp` launches the program. The **Liquid Glass** row toggles the theme |
| **Toggle Room View** small button | toggles passthrough (SteamVR action 432800007) |
| any Playspace Menu row (Playspace Setup / Adjust Floor Height / Recenter) | SteamVR action |
| Streaming: "Select game to stream...", "Stream VR Without Game", host actions | starts streaming flows |
| QAM controls: sliders, toggles, Bluetooth device rows, Wi-Fi row, Basic View, Help buttons | settings, connects or launches |
| tab menu or frame menu **Power**, **Close** (app tab), **VR Settings** | power menu, closes window, SteamVR action |
| Bar tabs | switch the dashboard's active frame (`DashboardTabClicked`) |
| Avatar | navigates main to `/account` (harmless navigation, but it changes the main route other agents use) |

Safe and used here: opening and closing popups, switching QAM tabs (`[role=tab]`), and the Streaming **Advanced** disclosure (local state only, source-checked).

---

## 1. Surface `bar`: the dashboard bar (dock)

Shot: `bar_before.png` (idle: Steam tab selected, Room View on, notification dot present).

### 1.1 Structure and paint today

```
div %{PopupRoot} [0,0 1200x80]                         inline style="visibility: visible" (Steam toggles it)
  div %{PopupContent} %{AlignCenterX} %{AlignCenterY}  [250,0 700x80]  centres the bar in the 1200px window
    div %{PopupBody>DashboardBar} %{DynamicWidth} %{HasAvatar}   flex row, gap 15px, overflow hidden, color #8b929a
      div %{BarSurface} %{Bookend}            [80x80]  bg #0e141b r6 overflow hidden   <- left surface: Steam tab(s)
        div %{BarSurfaceSection} %{LowBatteryGauge>Tabs}
          div %{BarTabs} %{ScrollPanel} %{ScrollX} Panel Focusable   (scroller, mask fades)
            div %{BarTab} %{LowBatteryGauge>Selected} role=button   [80x80]  tooltip "Steam"
              div %{PopupBody>Icon} [32x32] > svg %{SteamSVG} (transform scale(1.2))
              div %{FocusRingHint}  (abs, inset 10px, visibility hidden)
      div %{BarSurface}                       [605x80] bg #0e141b r6 overflow hidden   <- main surface
        div %{BarSurfaceSection} %{LowBatteryGauge>Tabs}
          div %{BarTabs} %{ScrollPanel} %{ScrollX}
            div %{BarTab} role=button  tooltip "Camera Switch"   (app / overlay / desktop-window tabs)
              div %{PopupBody>Icon} %{OverlayIcon} [38x38] (transform scale(1.2)) > img (overlay thumbnail)
              div %{FocusRingHint}
          div VRDashboardBarSmallButton %{PanelSection>Item} %{PopupBody>Clickable} %{AddWindowButton} role=button  [54x48]  tooltip "Launch Program"
            div %{PopupBody>Highlight} [34x34] r9001 (transform scale(.7)) > div %{PopupBody>Inner} > svg (plus)
        div %{EmptySpace}                     flex spacer (min 70px)
        div %{BarSurfaceSection} %{SmallButtonSection} %{PopupBody>Right} %{Tray}   bg linear-gradient(90deg, rgba(0,0,0,.5) 0, rgba(0,0,0,.25) 90px)
          div %{SmallBarButtons}
            div VRDashboardBarSmallButton %{PanelSection>Item} %{PopupBody>Clickable} role=button   "Playspace Menu"  (menu -> barpopup)
              div %{PopupBody>Highlight} [48x48] r9001 > div %{PopupBody>Inner} > div %{PopupBody>Icon} > svg
            div VRDashboardBarSmallButton … %{PanelSection>Active} VRDashboardBarSmallButtonActive   "Toggle Room View" (action toggle, NO popup)
            div VRDashboardBarSmallButton …   "Streaming Status" (QAM tab key 9 -> barpopup)
              div %{PopupBody>Highlight} > div %{PopupBody>Inner} > span %{VRLinkQualityIcon} > svg %{IbexDiagramFrontPanelTransparencyEffect>VRLink} %{IbexDiagramFrontPanelTransparencyEffect>Off}
          div %{QuickAccessButton} role=button  [125x80]  tooltip "Quick Access Menu"
            div %{PopupBody>Inner}  (46px tall, ::before = hover/open pill)
              div %{PopupBody>Time} "8:35 PM"
              div %{PopupBody>Icons}
                div %{Profile>BatteryIcon} %{Profile>VR} %{BatteryIconHeaderItem} %{Skinny} %{PopupBody>StatusItem}  aria="Headset Battery Full"
                div %{PopupBody>StatusItem} > svg %{IbexDiagramFrontPanelTransparencyEffect>FlipInRTL}   (volume icon)
                div %{WirelessIcon} %{PopupBody>StatusItem}
                div %{NotificationsIcon} %{PopupBody>StatusItem} role=button   (only when unread notifications exist)
            div %{FocusRingHint}
          div %{AvatarButton} role=button  [79x86]
            div %{PopupBody>Avatar} offline  r4 overflow hidden
              div > div %{avatarHolder} avatarHolder no-drag FillArea offline
                div %{avatarHolder>avatarStatus} avatarStatus right  [3x46] bg #67707b (persona colour)
                img %{avatar} avatar  box-shadow rgba(0,0,0,.3) 2px 2px 8px 1px
            div %{FocusRingHint}
```

### 1.2 Each element: what it is and what it opens

- **Steam tab** (`%{Bookend} %{BarTab}`)
  - Selects the Steam frame and has no other action.
  - Hover opens the **Steam tab menu** in barpopup (section 2.5).
  - The left Bookend surface exists only when there is a Steam tab. Multiple Steam tabs happen with VR Link remotes: non-remote ones go left, remote ones go to the main surface with a `%{PopupBody>Badge}`.
- **App and desktop-window tabs** (`%{BarTab}` in the main surface)
  - Icon variants:
    - `%{OverlayIcon}`: overlay thumbnail img from `steamloopback.host/overlays/thumbnail`.
    - `%{PopupBody>AppIcon}`: Steam app icon, r4.
    - Window icon: img from `steamloopback.host/windows/icon?handle=`.
    - Enum svg icon.
  - Hover opens that frame's **tab menu**, if the frame `hasMenu`. Camera Switch's menu has only "Close".
  - Tooltip = `display_name`.
- **+ (`%{AddWindowButton}`)** opens the **Add Desktop Window / Launch Program** list (section 2.1).
  - Its tooltip is the header text when there is only one section.
  - Each click also increments a counter that refreshes the program list.
  - The button renders only if at least one section is non-empty.
- **Small buttons** (`.VRDashboardBarSmallButton`, in `%{SmallBarButtons}`, order = SteamVR `bar_buttons` then header buttons):
  1. **Playspace Menu**: SteamVR menu button (`bar_buttons` type 3, action 432800001). Opens a list in barpopup (section 2.2).
  2. **Toggle Room View**: SteamVR toggle action (type 1, action 432800007). No popup. `VRDashboardBarSmallButtonActive` is set when it is on.
     - It was on from 20:35 to about 20:53, which is the state in every bar shot.
     - At the end of the session SteamVR reported `active:false`. None of the mapping commands clicked it: only `:nth-child(1)` and `(3)`, the + button and Quick Access were clicked.
     - Its state is live: someone else or SteamVR changes it, so expect either look.
  3. **Streaming Status**: QAM tab "Streaming" (key 9) rendered as a bar button. Opens the Streaming panel (section 2.3). Its icon is the stateful `%{VRLinkQualityIcon}`.
- **Quick Access** (`%{QuickAccessButton}`, clock and status icons)
  - Opens the full **Quick Access Menu** in barpopup, centre-aligned (section 2.4).
  - The status items inside are not separate targets (`focusable:false`); clicks bubble to the button.
  - Status items:
    - headset battery (green level fill `#59BF40`, plus a "check/bolt" variant)
    - left and right controller batteries (only when connected and not in low-battery-alert mode)
    - volume (`AudioVolumeIcon`)
    - Wi-Fi (`%{WirelessIcon}`)
    - Steam-connection warning (`SteamConnectionWarningIcon`, conditional)
    - unformatted-SD (conditional)
    - notifications bell (`%{NotificationsIcon}`, only with unread notifications, always drawn with the blue alert dot in the bar)
- **Avatar** (`%{AvatarButton}`)
  - Activating it navigates main to `/account`.
  - It has **no popup**: its `popupContents` is undefined. A dead `qe` component (Add Friends / Account / Change User) exists in the source but is not rendered.
  - Gamepad DIR_UP would try to open the empty popup.

### 1.3 State classes and what they paint (Steam CSS, module 12031)

| Element | State | Paint |
|---|---|---|
| `%{BarTab}` | idle | transparent, icon colour #8b929a |
| | `:hover` / `%{MenuVisible}` (tab menu open) | bg `rgb(61,68,80)`, colour #dcdedf, `--badge-border-color:#3D4450` (shot `bar_tabmenu_open_bar_before.png`) |
| | `.gpfocus` | colour #dcdedf only. The ring comes from the FocusRing element (section 5.3) |
| | `%{LowBatteryGauge>Selected}` | `::after` blue pill visible (see 1.4) |
| | `%{OldColors}` (legacy SteamVR) | selected/active bg #b8bcbf with dark icon, `::after` hidden. **Not present on this build** |
| `.VRDashboardBarSmallButton` `%{PopupBody>Highlight}` | idle | circle `::before` opacity 0, bg `rgb(35,38,46)` inside `%{Tray}`, `rgb(61,68,80)` elsewhere (+ button) |
| | `:hover` (not active) | `::before` opacity .75, icon #fff |
| | `.gpfocus` (not active) | icon colour #dcdedf only, no fill |
| | `%{PanelSection>Active}` / `VRDashboardBarSmallButtonActive` (toggle on, or its popup open) | `::before` bg `rgb(220,222,223)` opacity .5, icon `rgb(14,20,27)`. Hover: `::before` #fff opacity .8, icon #000. Shots `bar_plus_open_bar_before.png`, `bar_playspace_open_bar_before.png` |
| | `:active` | `%{PopupBody>Inner}` scale(.9). `::before` opacity 1 and scale(1), no transition |
| | `%{ClickAnimation}` (added for .8 s on activate) | `%{PopupBody>Inner}` runs keyframes `%{ClickPop}` (scale 1.1 at 5%) |
| `%{QuickAccessButton}` | `:hover` / `.gpfocus` / `%{MenuVisible}` | text #fff. On hover/MenuVisible, `%{PopupBody>Inner}::before` bg `rgb(35,38,46)` opacity .75 (rounded r8 pill). Shot `bar_qam_open_bar_before.png` |
| `%{AvatarButton}` | `:hover` / `.gpfocus` / `%{MenuVisible}` | `filter: brightness(1.2)` |
| `%{VRLinkQualityIcon}` | per link state | arcs dimmed via `--vrlink-dim-opacity`, animated arcs while connecting, `fill:url(#vrlink-gradient)` in coloured states. Active-button variants darken the gradient |

Typography:
- Clock: `%{PopupBody>Time}` 22px/22px, weight 600, tabular-nums, right-aligned.
- Small-button font size is 24px. Svg is 1em, so the `%{PopupBody>Highlight}` circle is 2em = 48px.

### 1.4 Steam's pseudo-elements on bar elements

Do not add your own `::before`/`::after` on these elements. Restyle Steam's instead.

| Element | Pseudo | Use |
|---|---|---|
| `%{BarTab}` | `::after` | Selected indicator: blue `rgb(26,159,255)` pill, 32px wide (max 80%), 6px tall (`flex:0 0 6px; margin-top:-6px`), radius 10 10 0 0. **`transform: translateY(3px)` when selected or `:active`, `translateY(6px)` (hidden under the BarSurface's overflow) otherwise.** It transitions transform and width with an overshoot curve. Recolouring and reshaping are safe; the transform is not |
| `%{PanelSection>Item} %{PopupBody>Highlight}` | `::before` | the circular hover/active fill. `inset:0; z-index:0`, transform scale(.9) to 1 on `:active`, transitions opacity, bg and transform |
| `%{QuickAccessButton} %{PopupBody>Inner}` | `::before` | hover/open pill: `inset:-8px 6px` (right 0 with avatar), r8, z-index -1 (Inner has `isolation:isolate`) |
| `%{BarTabs}` | none | the fades are a CSS `mask` (see 1.6) |

### 1.5 Inline styles, transforms and animations that a theme must not touch

- `%{PopupRoot}` has `style="visibility: visible"`.
- `.VRDashboardBarSmallButton` has `style="--bar-item-padding-pct: N"`. This is computed from the icon aspect ratio and drives `%{PopupBody>Inner}` padding.
- `%{AddWindowButton} %{PopupBody>Highlight}` has `transform: scale(.7)`. This is why the + circle is smaller (34px).
- `%{OverlayIcon}` and `%{SteamSVG}` have `transform: scale(1.2)`.
- `%{BarTab}::after` uses translateY for the indicator.
- `%{PopupBody>Inner}` uses scale(.9) on `:active` and the `%{ClickPop}` animation.
- `.avatarHolder` has `transform: scale(1)` with a `transition: transform .34s` bounce. Its `avatarStatus` gets inline height/top while in voice chat.
- `%{PanelSection>Item}:has(%{PopupBody>Highlight} > %{PopupBody>Inner} > :nth-child(2))` gets negative margins (multi-icon buttons such as Downloads).

### 1.6 Scrolling and virtualization

- `%{BarTabs} %{ScrollPanel} %{ScrollX}` (overflow-x auto) is the only scroller. Tabs are not virtualized.
  - Steam smooth-scrolls the selected tab into view.
  - `%{FadeLeft}` and `%{FadeRight}` are toggled by scroll position and drive `mask: linear-gradient(90deg, transparent, white 130px, white calc(100% - 130px), transparent)` with animated `mask-size`/`mask-position-x`. With few tabs the mask is pushed fully outside.
  - Don't override `mask` or `mask-size` here.
- Overflow fades are unreachable now: they need about 7+ tabs.

### 1.7 Bar items that exist in code but are not present now

These are rendered by the same small-button or status-item primitives, so styling those primitives covers them.
- **Downloads** small button (`HeaderDownloadContainer`, `HeaderAppPortrait`, inline `width:%` progress bar `HeaderDownloadProgressBar`), shown while downloading.
- **Family View lock** and **Kiosk lock** (`FamilyViewIcon`).
- **Unformatted SD** (`UnformattedDriveIcon`).
- **Low disk space** (HardDriveWarning plus `BootReserve` dialog).
- **Steam connection warning** (`SteamConnectionWarningIcon`).
- **Voice chat status** (`VoiceChatStatus`).
- Controller battery status items.
- Legacy layout only (not present when the mutual capability `bH` exists, which is the case here):
  - **Volume** small button with a `%{VolumePopup}` slider popup
  - the hamburger **Options menu (VR)** button listing dashboard tabs plus Exit VR / Power
  - the `%{OldColors}` tab style
- Avatar `PlaceholderAccount` (the class is undefined in this build), and the `InVoiceChat`/`speaking` avatar status.

---

## 2. Surface `barpopup`: popups opened from the bar

### 2.0 The popup window frame (shared by everything below)

```
div %{PopupRoot}                                   abs inset 0, overflow hidden, flex column
  div %{PopupContent} %{AlignCenterX} %{PopupBody>AlignBottom}   (tab menus: %{PopupBody>AlignLeft} %{PopupBody>AlignBottom})
    div                                            portal host
      <popup body>
```
- **One** 300x1024 window. Content is bottom-aligned, against the bar. SteamVR positions the overlay from the button: `origin_on_parent.x` comes from the button centre (or left edge for tabs) and `offset.y_pixels` is 10. Not CSS.
- Background is transparent. **`%{PopupContent}` is `overflow:hidden` and sized to its content, so any outer box-shadow or glow on the popup body is clipped.** Use inset or inner effects.
- Each popup is a separate overlay, so `backdrop-filter` on a popup body sees only the transparent window, never the room or the bar. It can blur only in-popup content, such as a title over a scrolled list.
- Auto-close:
  - Popups close 2 s after the pointer leaves both button and popup (100 ms with gamepad focus).
  - They close on any SteamVR mouse press outside, on Cancel, and when the bar window hides.
  - Opening one closes the others.

Generic list component (`DashboardBarPopupList`, module 53318), used by the + list and the Playspace Menu:
```
div %{DashboardBarPopupContents} %{DashboardBarPopupList}     bg #0e141b, border 1px rgba(255,255,255,.05), r6, overflow hidden, max-height 600px, flex column
  div %{DashboardBarPopupListHeader}                          (optional) 12px/20px bold uppercase ls .5px colour #b8bcbf, padding 10 20 0, z-index 9002
  div %{DashboardBarPopupListScrollRegion} %{FadeTop}? %{FadeBottom}? %{ScrollPanel} %{ScrollY} Panel Focusable
      ::before / ::after = scroll fades (see below)
    div %{FocusRingHint}                                      abs inset 10px
    div %{DashboardBarPopupListScrollPanel} Panel Focusable   overflow-y auto, padding 10px 20px, --field-negative-horizontal-margin 20px
      div %{DashboardBarPopupListItem} %{PopupBody>Clickable} %{*GamepadDialogContent>Field} %{*GamepadDialogContent>Classic}
          %{*GamepadDialogContent>VerticalAlignCenter} [%{*GamepadDialogContent>WithBottomSeparatorStandard}] %{*GamepadDialogContent>ExtraPaddingOnChildrenBelow}
          %{*GamepadDialogContent>StandardPadding} %{*GamepadDialogContent>Clickable} %{*GamepadDialogContent>HighlightOnFocus} Panel Focusable role=button
          [%{PanelSection>Active}]                             inline --indent-level:0
        div %{*GamepadDialogContent>FieldLeftColumn} > div %{*GamepadDialogContent>FieldLabelRow} > div %{*GamepadDialogContent>FieldLabel}
          div %{*GamepadDialogContent>FieldIcon} %{*GamepadDialogContent>Front} > div %{PopupBody>Icon} [16x16] > img|svg
          div > div %{Marquee>Container} %{ResetOnPause} > div %{Marquee>Content} "label"
```
Row paint:
- Rows are 40px tall, 16px text. The row bleeds to the popup edge (`margin-inline:-20px`, padding 20px) and has r2.
- Idle: label `rgb(220,222,223)`, row colour #8b929a.
- **Separator:** `::after` 1px `rgba(255,255,255,.1)` at `bottom:-.5px`, inset 20px left and right. Present only with `WithBottomSeparatorStandard`, and hidden on the focused or hovered row.
- **Active dot:** `%{DashboardBarPopupListItem}::before` is a 12px `#1a9fff` circle at `left:-6px`, vertically centred, opacity 0. It shows at opacity 1 with `%{PanelSection>Active}` (toggled actions or the selected tab in legacy menus). Not reachable now.
- **Focus** (`.gpfocus`, which laser and controller both set):
  - Bg settles at `rgba(255,255,255,.15)`, text #fff, z-index 1.
  - **This fill comes from `animation-name: _2NVMbdV4wBIACWgwBU2kyz` (25% to 15% white, `animation-fill-mode: forwards`).** The plain rule `background: rgb(61,68,80)` is overridden by the animation's fill.
  - **A theme that sets `background` on `.gpfocus` loses to the animation unless it also sets `animation-name` (own keyframes or `none`) or uses `!important`.**
- **Hover** (`:hover`, not disabled): bg `rgb(61,68,80)`, text #fff, separator hidden. There is no animation on hover.
- **Disabled** (`aIeh3X5T2M074RLW1qn6_`, the Field Disabled class): colour `rgb(103,112,123)`, cursor default.
- Transitions: `transform .32s`. Field rows use `transform: scale(1) rotateX(0)` with `transform-origin: 12% 50%`. Don't touch the transform.

Scroll fades (on `%{DashboardBarPopupListScrollRegion}`):
- `::before` (top) and `::after` (bottom) are 0px-tall absolute lines with `box-shadow: rgb(14,20,27) 0 0 40px 40px`, z-index 9001, `pointer-events:none`.
- They show (opacity 1) with `%{FadeTop}` / `%{FadeBottom}` (set by scroll position) and transition opacity .15s.
- **They paint an opaque #0e141b band.** On glass they will show as dark smudges. Recolour the shadow or replace the technique, but keep these pseudo-elements Steam's.

Popup-wide focus ring: the `%{FocusRingHint}` sizes the gamepad ring (section 5.3).

### 2.1 **+** button popup: "Add Desktop Window" / "Launch Program"

This list is how the user toggles Liquid Glass, so it must stay fully legible and clickable.

- Open: `python glass.py shot barpopup bar_plus_before --theme off --pre "<OPEN>('%{AddWindowButton}')"`
- Shots:
  - `bar_plus_before.png`: top of list, first row focused.
  - `bar_plus_scrolled_before.png`: list scrolled to the end, showing the `%{FadeTop}` band at the top. Pre: `<OPEN>('%{AddWindowButton}', async W=>{L.q('barpopup','%{DashboardBarPopupListScrollPanel}').scrollTop=99999; await W(400);})`.
  - Bar with the popup open: `bar_plus_open_bar_before.png`. The + button shows the Active fill.
- Live DOM is the generic list (2.0) with header **"Launch Program"** and 24 `%{DashboardBarPopupListItem}` rows (each 40px, separators on all but the last). Rows are not virtualized, and the list is capped at `max-height:600px`, so it scrolls.
- **Liquid Glass** is a normal row: icon = the `.desktop` icon as a `data:image/png;base64` `<img>`, label "Liquid Glass".
  - **Row order is not stable.** It was first this session; an earlier `docs/plus_menu.png` shows it seventh.
  - The data-URI icon can't be matched by CSS, so you cannot target the row specifically. Don't try; style all rows.
- Current rows, as data (never click any): Liquid Glass, Visual Studio Code, qBittorrent, Firewall, Frametop Input Settings, Frametop Remote Access, VLC media player, Dolphin, CMake, Discover, Google Chrome, Reset Screen Layout, Konsole, Half SBS Toggle, Chromium, KDE System Settings, Full SBS Toggle, Camera Switch, Mozilla Firefox, LXTerminal, Frametop Display Settings, Desktop, RenderDoc, Hide/Show Screens.
  - Some rows have no icon (empty `%{PopupBody>Icon}`): Frametop Remote Access, Konsole, KDE System Settings, Desktop, Hide/Show Screens.
  - `steamos-nested-desktop` gets an svg Display icon.
- **Unreachable: the "Add Desktop Window" section.** It appears only when SteamVR reports desktop windows; there are none now. With both sections present, Steam renders:
  ```
  div %{DashboardBarPopupSectionStack}      flex column, gap 5px, max-height 100vh
    div %{DashboardBarPopupContents} %{DashboardBarPopupList}   header "Add Desktop Window", rows = window titles with window icons (img from steamloopback.host/windows/icon), scroll region is a focus *group* instead of ScrollPanel
    div %{DashboardBarPopupContents} %{DashboardBarPopupList}   header "Launch Program", rows as above
  ```
  Each list then has `min-height:0; flex-shrink:1; width:auto`, so the two cards share the 1024px height. Clicking a window row adds that desktop window to VR (a side effect).

### 2.2 Playspace Menu (small button 1)

- Open: `<OPEN>('%{SmallBarButtons} > .VRDashboardBarSmallButton:nth-child(1)')`
- Shots: `bar_playspace_before.png`; bar with the popup open: `bar_playspace_open_bar_before.png`.
- Generic list with **no header** and rows with **no separators** (`bottomSeparator:"none"`). Card 212x141, centred on the button.
- Rows (SteamVR actions, never click): **Playspace Setup**, **Adjust Floor Height**, **Recenter**. Svg icons 16px.
- Focus: the first row gets `.gpfocus` on open.

### 2.3 Streaming Status (small button 3)

- Open: `<OPEN>('%{SmallBarButtons} > .VRDashboardBarSmallButton:nth-child(3)')`
- Shots: `bar_streaming_before.png` (button focused, showing the FocusRing outline) and `bar_streaming_advanced_before.png` (Advanced expanded). Pre for the second: `<OPEN>('…:nth-child(3)', async W=>{L.click('barpopup','%{AdvancedToggle}'); await W(500);})`.
- Structure. This is the QAM "Streaming" tab panel hosted in a bar-popup card:
  ```
  div %{DashboardBarPopupContents}                    bg #0e141b border 1px rgba(255,255,255,.05) r6, 300px wide
    div %{QuickAccessPopupPanel}                      overflow-y auto, padding 20 0 20, width 300  (no %{BottomFade} for this one; %{QuickAccessPopupTitle} is empty -> display:none)
      div %{ActiveHostTitle>Streaming} Panel Focusable
        div %{FocusRing}                              (gamepad ring element, see 5.3)
        div %{*PanelSectionTitle>PanelSection}
          div %{*PanelSection>PanelSectionTitle} > div %{*PanelSection>Text} > div %{ActiveHostTitle} > span "Streaming Status"   colour rgba(255,255,255,.7)
          button %{AlwaysBluePrimaryButton} DialogButton _DialogLayout Primary %{*GamepadDialogContent>Button}  "Select game to stream..."   bg rgb(57,112,203) (focused: rgb(99,158,255)), r2
          div %{AvailableHostsHeader} "Available Computers (1)"
          div %{AvailableHosts} > div %{AvailableHost} > div %{AvailableHostContents}   bg rgb(35,38,46)
            div %{HostHeader} > div %{HostIcon} (svg, rgba(255,255,255,.75)) + div %{HostName} "Ben-PC2" (#fff)
            div %{HostStatus} %{Streaming>Ready} ×3   green rgb(89,191,64); ::before = 8px dot (bg + 1px border, r50%)
            div %{AdvancedSection}  (hr)
              button %{AdvancedToggle} > span "Advanced" + span %{AdvancedChevron} [%{Streaming>Open}] (svg rotates, transition .1s)
              div %{AdvancedContents} > button %{AdvancedActionButton} DialogButton Secondary "Stream VR Without Game"  bg rgba(255,255,255,.15)
  ```
- Other host states exist in code but are not reachable: NotReady, Disabled, InstallingSteamVR with progress bar (`--quickaccesspercent`), Pair Wireless Adapter and Install SteamVR buttons, and the `NoneFound` host card.

### 2.4 Quick Access Menu (from `%{QuickAccessButton}`)

- Open: `<OPEN>('%{QuickAccessButton}')`. It opens on the **Quick Settings** tab with that tab focused.
- Shots:
  - `bar_qam_settings_before.png`
  - `bar_qam_settings_scrolled_before.png`, showing the "Other" section and disabled rows. Pre: after OPEN, `p=L.q('barpopup','%{ActiveTab} %{TabGroupPanel}'); p.scrollTop=400`.
  - `bar_qam_notif_before.png`, `bar_qam_perf_before.png`, `bar_qam_battery_before.png`, `bar_qam_help_before.png`
  - `bar_qam_open_bar_before.png`: bar with `%{MenuVisible}` pill on the Quick Access button.
- Switch tabs safely: `<OPEN>('%{QuickAccessButton}', async W=>{L.click('barpopup','[role=tab][aria-label="Performance"]'); await W(700);})`. The labels are Notifications, Quick Settings, Performance, Battery Info, Help.
- Shell structure:
  ```
  div BasicUI %{PanelSection>Container} %{PanelSection>Open} %{BottomTabs} %{Expanded>VR}   300x440 (max-height 440; 370 in a compact variant), transition opacity 2s
    div %{QuickAccessMenu}               bg #0e141b, border 1px rgba(255,255,255,.05), r6, overflow hidden, flex column
      div %{PanelSection>Menu}           (column-reverse because %{BottomTabs}: tabs at the bottom)
        div %{ViewPlaceholder>Tabs}      48px row; ::after = 1px rgba(255,255,255,.1) top divider
          div %{TabList} role=tablist    flex row
            div %{PopupBody>Tab} role=tab aria-label=…   60x48, icon 24px, colour #8b929a
        div %{PanelOuterNav}             overflow hidden
          div %{AllTabContents} %{PopupBody>Down|Up}
            div %{PopupBody>ContentTransition} %{ActiveTab}   abs inset 0; ::after = bottom fade (opaque #0e141b + box-shadow 0 0 40px 40px)
              div %{PopupBody>Title} "Quick Settings"        22px/28px bold #fff, padding 6 0 0 16, bg #0e141b + box-shadow rgb(14,20,27) 0 0 7px 12px (acts as top fade over scrolled content)
              div %{TabGroupPanel} tab_<Name> %{ScrollPanel} %{ScrollY} role=tabpanel   overflow-y auto, padding-bottom 60, scrollbar hidden
                div %{*PanelSectionTitle>PanelSection} …  sections of Field rows (shared gamepaddialog Field/Slider/Toggle primitives)
  ```
- Tab states:
  - idle: #8b929a
  - `:hover`: bg `rgba(255,255,255,.05)`
  - `%{ViewPlaceholder>Selected}`: bg `rgba(255,255,255,.2)` via animation `_2YeD3ssgsSnvTv7ns3TJxH`
  - `.gpfocus`: bg #fff with icon `rgb(14,20,27)`
  - Selected + `.gpfocus`: animation `_2dyj6SNu79q4w35u3hWY--` (30% to 10% white, fill forwards), colour #fff, svg scale(1.1)
  - Green "charging/positive" variant (`_5lc3T6GeSXWcAwdUPhUjP`): bg rgb(89,191,64)
  - Tabs carry `transform: scale(1) rotateX(1deg)`; the svg scales on focus. **Same animation-overrides-background caveat as 2.0.**
- Tab content transitions: `ContentTransition` gets enter and exit classes that animate `transform: translateY(±8–12%)` and opacity (320 ms / 80 ms). Don't touch.
- Tab contents (shared primitives; never operate the controls):
  - **Notifications**: `%{*PanelSection>QuickAccessNotifications} %{*PanelSection>VR}`. The list is empty now: `%{*PanelSection>EmptyNotifications}` "No new notifications", padding-top 40 and centred. With items, the rows get `::before` 1px `rgb(61,68,80)` dividers (`div + div::before`, hidden around the hovered row).
  - **Quick Settings**:
    - Brightness: 2 slider rows (`%{*SliderControlPanelGroup>…}`: track `rgba(255,255,255,.15)` r3, handle #fff r1337, fill #1a9fff).
    - Audio: 2 slider rows (output and mic) with `%{ClickableSliderIcon}` mute icons. The icon `::before` is a hover circle, scale 1.5 to 2.
    - Other:
      - Wi-Fi toggle row, plus the network row (Clickable)
      - Bluetooth toggle row, plus device rows `%{BluetoothDeviceQuickAccessField}`, most of them `%{*GamepadDialogContent>Disabled}`, which renders dimmer
      - "Add Device" row and Airplane mode toggle
  - **Performance**:
    - System Profile slider with notch labels (`%{*SliderControlPanelGroup>SliderNotch…}`)
    - "Basic View" Secondary DialogButton in a `%{*GamepadDialogContent>WithBottomSeparatorThick}` row
    - Common Settings: Manual GPU Clock toggle (`%{*GamepadDialogContent>Toggle}`: rail `rgba(255,255,255,.15)` r9001, knob #fff)
    - Non-VR Settings (Performance Overlay Level etc.)
  - **Battery Info**: one clickable row containing `%{*PanelSection>BatterySectionContainer}`, made of `%{*PanelSection>BatteryIcon}` (24x40 svg) and `%{*PanelSection>BatteryPercentageLabel}` "Full" (36px #fff). Controllers would add rows.
  - **Help**: 4 full-width Secondary DialogButtons (bg `rgba(255,255,255,.15)` r2, 40px): Visit Help Site, Report a Bug, Replay Guided Tour, Show Frame Tutorial Videos.
- Not reachable now: a **low-battery banner** `%{DashboardBar>LowBattery}` (yellow `rgb(255,200,44)` with black text, or `%{DashboardBar>ReallyLow}` red). When a battery alert is active, opening the QAM jumps to Battery Info.

### 2.5 Tab hover menus (`DashboardMenu` `%{Variant_TabMenu}`)

- Open with HOVER: `('%{BarTab}',0)` for Steam, `('%{BarTab}',1)` for Camera Switch.
- Shots: `bar_tabmenu_steam_before.png`, `bar_tabmenu_app_before.png`; bar with the hovered tab in `%{MenuVisible}`: `bar_tabmenu_open_bar_before.png`.
- Alignment is left (`%{PopupBody>AlignLeft}`). Source: `frame.menu.items_for_tab_hover_menu`.
- Steam frame menu items: Steam main-menu items (Home, Library, Store, Friends & Chat, Media, Downloads, Steam Settings), then **VR Settings** (SteamVR action), then `%{SectionGap}`, then **Power** (opens the power menu; never click).
- The Camera Switch frame menu has a single item, **Close** (closes the app window; never click).
- Structure:
  ```
  div %{DashboardMenu} %{Variant_TabMenu} Panel Focusable role=menu   overflow hidden; transition width .32s, transform .3s, background-color .5s
    div %{DashboardMenu>ItemOuter}            bg var(--menu-background)=#0e141b; border 0 1px rgba(255,255,255,.05) (+top on first / bottom on last-before-gap); r6 on the group's first/last
        ::after = 1px rgba(255,255,255,.1) divider at top, inset 20px (hidden on first-of-group and next to hovered/focused)
      div %{DashboardMenu>Item} Panel Focusable role=menuitem aria-label=…   height 30px (+5px pad) → 40px rows, padding 5px 30px 5px 20px
        [div %{DashboardMenu>ActiveDot} style="width:10px;height:50%"]   abs left -3px, #1a9fff r6 (route-active item only)
        div %{DashboardMenu>ItemIcon} > svg|%{PopupBody>Icon}   16px, colour #dcdedf
        div %{DashboardMenu>ItemLabel} > %{Marquee>Container} > %{Marquee>Content}   16px, #dcdedf, margin-left 16
    div %{SectionGap}                         5px transparent gap = splits the menu into separate rounded cards
    [div %{PopupBody>Separator}]              2px gradient line (transparent→#3d4450→transparent), unused here
  ```
- Item states:
  - `:hover`: bg `rgba(255,255,255,.2)`, text #fff
  - `.gpfocus`: `transform: scale(1.1)`, z-index 1, animation `zjENVv5FgxKHB6pjBivSE` (30% to 10% white, fill forwards), icon and label #fff
  - `%{DashboardMenu>Active}`: `transform: scale(1.1) rotateX(1deg)`, z-index 2, ActiveDot
  - `%{DashboardMenu>Blocked}` (parental): icon and label `rgb(61,68,80)`
  - `%{DashboardMenu>Unselectable}` (no action or disabled): opacity .4, `pointer-events:none`
  - Items always carry `transform: scale(1) rotateX(1deg)`
- Not reachable without a running game or desktop windows:
  - game overlay items and game window items (`steam_game_info`)
  - dashboard-tab list items (`visible_in_dashboard_bar_hamburger_menu`)
  - legacy hamburger items with the Exit VR / Power entry

### 2.6 Volume popup (code only)

`%{DashboardBarPopupContents} %{VolumePopup}` is 100vw with padding 0 20. It holds headset volume, audio mirror and mic sliders, each with a `%{ClickableSliderIcon}`. It opens only from the legacy Volume small button, which is not rendered on this build.

---

## 3. Surface `frame.menu`: the window-frame side menu

- **What opens it:** nothing needs opening.
  - SteamVR's frame system gives each frame with a `reservedMenuPopupID` a pooled `frame.menu.*` window (`VRFrameStore.frames[i].menu.items_for_left_frame_menu`). It is rendered by component `H` → `se` (module 53487).
  - It is attached to the **left edge of the main Steam window**: `origin_on_popup {x:1,y:0}`, `offset.x_pixels -6`, inheriting curvature.
  - It is `only_visible_with_laser: true`: the headset shows it only while the laser pointer is active, but CEF renders it always.
  - Right or Cancel moves focus back to the main panel (`frame.FocusMainPanel()`).
  - `VRFrameStore` today: frame 432800001 "Steam" (dock 1, reserved popup 51120001), with left-menu items `[steam main menu, action 432800008 VR Settings, separator, action 432800020 Power]`. Frame 432800029 "Camera Switch" has no left-menu items, which is why `frame.menu.62560006` is empty.
- Shots:
  - `bar_framemenu_collapsed_before.png`: collapsed, no active item (route was not a menu route).
  - `bar_framemenu_collapsed_active_before.png`: collapsed, route `/settings`, so Steam Settings is active with the blue dot.
  - `bar_framemenu_expanded_before.png`: expanded, route `/library/home`. Home appears mid-transition.
  - `bar_framemenu_active_before.png`: expanded, route `/settings`.
  - Commands:
    - `MSYS_NO_PATHCONV=1 python glass.py shot frame.menu.62560005 bar_framemenu_active_before --theme off --route /settings --pre "<FRAME MENU expand>"`
    - For collapsed: same command with a pre that dispatches `mouseleave` on `%{DashboardMenu}` and waits 1.2 s.
- Structure (same `DashboardMenu` component as 2.5, `%{Variant_FrameMenu}`):
  ```
  div %{PopupRoot} > div %{PopupContent} %{PopupBody>AlignRight} %{AlignCenterY} > div
    div [%{DashboardMenu>Collapsed}] %{DashboardMenu} %{Variant_FrameMenu} Panel Focusable role=menu   collapsed 54px wide → expanded fit (242px); transition width 300ms
      div %{DashboardMenu>ItemOuter}     bg #0e141b; r6 top on first, r6 bottom before the gap; (no ::after dividers in this variant, no side borders)
        div %{DashboardMenu>Item} role=menuitem aria-label="Home|Library|Store|Friends & Chat|Media|Downloads|Steam Settings|VR Settings|Power"
            54px rows (--menu-item-height 48 + 3px pad), padding 3px 50px 3px 30px (collapsed: 3px 0, centred)
          [div %{DashboardMenu>ActiveDot}]  inline width:10px;height:50%, bg #1a9fff r6, left -3px
          div %{DashboardMenu>ItemIcon} > svg (20px)  [VR Settings / Power: > div %{PopupBody>Icon} > svg]
          div %{DashboardMenu>ItemLabel} (18px, max-width 160px; display:none when Collapsed) > %{Marquee>Container} > %{Marquee>Content}
      div %{SectionGap}                  5px gap between the 8-item card and the Power card
  ```
- Steam Settings shows a small yellow "!" badge inside its svg, an update or alert glyph in the icon itself.
- Colours: idle icon and label `#8b929a`; active label `#b8bcbf` scaled 1.1; hover bg `rgba(255,255,255,.2)` with #fff text; `.gpfocus` uses the same keyframe fill as 2.5. Variables on `%{DashboardMenu}`: `--menu-background:#0e141b; --menu-item-height:48px; --menu-icon-size:20px; --menu-item-padding:3px 50px 3px 30px; --menu-font-size:18px`. A theme can retint via `--menu-background` instead of overriding each ItemOuter.
- Expand and collapse behaviour (JS, not CSS):
  - expands 500 ms after `mouseenter`, or 1.5 s after a `mouseup` inside, or while it has gamepad focus
  - collapses 800 ms after `mouseleave`
  - **The width animates, so never set width, min-width or max-width on it or its items.**
- Active item: set by route (`/settings` gives Steam Settings). On `/library/home` no item was active.

---

## 4. Surface `tooltip`: bar tooltips

- Shot: `bar_tooltip_roomview_before.png` (TOOLTIP snippet on Room View).
- Shows on `mouseenter`, or gamepad focus, of every bar button and tab. The text is the button's `tooltip`: "Steam", "Camera Switch", "Launch Program", "Playspace Menu", "Toggle Room View", "Streaming Status", "Quick Access Menu". Shown via `VRPooledPopupStore.ShowTooltip`.
- Structure: `div %{PopupRoot} > div %{PopupContent} %{AlignCenterX} %{AlignCenterY} > div %{PopupBody>Tooltip} > div > div %{Marquee>Container} %{Container>Center} %{Container>Playing} > div %{Marquee>Content}`.
- `%{PopupBody>Tooltip}`: bg `rgba(0,0,0,.85)`, #fff, `border-radius:9000px` (capsule), height 100% of the 40px window minus centring (30px), padding `.2em 2ch`, nowrap.
- The Marquee has inline `--fade-length-left/right`, `--delay:.5s`, `--direction` and `--duration`, and scrolls long text.

---

## 5. Cross-cutting facts for the CSS author

### 5.1 Palette in use (stock)

| Colour | Used for |
|---|---|
| `#0e141b` / `rgb(14,20,27)` | every card: bar surfaces, popup lists, QAM, menus. Also the colour of all opaque fade shadows |
| `rgb(35,38,46)` | tray button hover fill, host card, QAM button pill |
| `rgb(61,68,80)` | tab hover and menu-open fill, list hover |
| `rgb(220,222,223)` | active small-button fill (at .5), labels |
| `#8b929a` | idle icons and text |
| `#b8bcbf` | list headers |
| `#1a9fff` | selected tab pill, active dots, slider fill |
| `rgba(255,255,255,.05)` | 1px card borders |
| `rgba(255,255,255,.1)` | dividers |
| `rgba(255,255,255,.15)` | focused row fill (via keyframes) |

### 5.2 Steam-owned pseudo-elements in this area (don't add your own on these)

- `%{BarTab}::after`
- `%{PopupBody>Highlight}::before`
- `%{QuickAccessButton} %{PopupBody>Inner}::before`
- `%{DashboardBarPopupListScrollRegion}::before/::after`
- `%{DashboardBarPopupListItem}::before` (active dot) and `::after` (Field separator)
- `%{QuickAccessPopupPanel}%{BottomFade}::after`
- `%{PopupBody>ContentTransition}::after` (QAM bottom fade)
- `%{ViewPlaceholder>Tabs}::after`
- `%{DashboardMenu>ItemOuter}::after` (tab-menu dividers)
- `%{HostStatus}::before` (status dot)
- `%{ClickableSliderIcon}::before`

Free for our own use: both `::before` and `::after` (content `none` when checked live with `getComputedStyle`) on these elements:
- `%{BarSurface}`, `%{PopupBody>DashboardBar}`, `%{QuickAccessButton}`, `%{AvatarButton}`, `.VRDashboardBarSmallButton`
- `%{DashboardBarPopupContents}`, `%{DashboardBarPopupListHeader}`, `%{DashboardBarPopupListScrollPanel}`
- `%{QuickAccessMenu}`, `%{PanelSection>Container}`, `%{PopupBody>Title}`, `%{PopupBody>Tab}`
- `%{DashboardMenu}`, `%{DashboardMenu>Item}`
- frame-menu `%{DashboardMenu>ItemOuter}`. The tab-menu variant uses `::after`.
- `%{PopupBody>Tooltip}`

Exception: `%{QuickAccessPopupPanel}` uses `::after` when it has `%{BottomFade}`.

### 5.3 Focus ring

- In the gamepad UI a real element, `div %{FocusRing}`, is injected near the focused control when gamepad focus is active.
- `%{FocusRing}`: absolute, `outline: 2px solid rgba(255,255,255,.6)`, `outline-offset: 2px`, pulse animations repeated 20 times.
- Its root is `%{FocusRingRoot}` (abs, z-index 10000, `pointer-events:none`). Its geometry is inline, sized from the nearest `%{FocusRingHint}`.
- Restyle the outline colour, width and offset only. Never touch position, size or animation timing.
- Seen live in the Streaming popup. In laser/mouse mode only `.gpfocus` classes change.

### 5.4 Animations that paint backgrounds

- `.gpfocus` fills on `%{*GamepadDialogContent>Field}` (Classic) rows, `%{DashboardMenu>Item}` and QAM `%{PopupBody>Tab}` are **keyframe animations with `fill-mode: forwards`**:
  - `_2NVMbdV4wBIACWgwBU2kyz`: 25% to 15% white
  - `zjENVv5FgxKHB6pjBivSE`: 30% to 10% white
  - `_2dyj6SNu79q4w35u3hWY--`: 30% to 10% white
  - `_2wp31uHPEwPmxifWYeIBl7`: non-Classic Field, `rgb(35,38,46)` to `rgb(56,58,65)`
  - `_2YeD3ssgsSnvTv7ns3TJxH`: QAM selected tab
- Your `background` on those states needs `animation-name` overridden (your own keyframes in a `*.nowrap.css`, or `none`) or `!important`.

### 5.5 Overflow and clipping

- `%{PopupRoot}`, `%{PopupContent}`, `%{PopupBody>DashboardBar}`, `%{BarSurface}`, `%{DashboardBarPopupContents}`, `%{QuickAccessMenu}` and `%{DashboardMenu}` are all `overflow:hidden`.
- The bar is exactly as tall as its 80px window, and popup windows hug content.
- So outer drop shadows, glows and rims outside the card are clipped. Draw rims inside (inset box-shadow or border) and keep within existing radii.

### 5.6 Performance context

- Every window has `body.LowPerfMode` (plus `GamepadMode BasicUI` and the hashed `%{*PopupBody}`). Steam itself disables some backdrop-filters under LowPerfMode.
- The cards are small floating elements, so `backdrop-filter` on `%{DashboardBarPopupContents}`, `%{QuickAccessMenu}`, the bar `%{BarSurface}` and the tooltip is within the LAB rules. It only blurs content inside the same window, so it is mostly useful for the QAM title and fade over scrolling content, not for blurring the room.

### 5.7 Icons

- Icons are `currentColor` svgs, except:
  - the battery level fill (`#59BF40`, hard-coded `fill` attribute)
  - the VR-link gradient (`url(#vrlink-gradient)`)
  - app, overlay and window `<img>` icons
- Recolour via `color`, not `fill`.

### 5.8 Scrollers in this area (no virtualization anywhere)

- `%{BarTabs}` (x)
- `%{DashboardBarPopupListScrollPanel}` inside `%{DashboardBarPopupListScrollRegion}` (y)
- `%{QuickAccessPopupPanel}` (y)
- QAM `%{TabGroupPanel}` (y, scrollbar hidden)
- `%{TabList}` (overflow auto)

---

## 6. Could not reach (and why)

| Item | Why |
|---|---|
| + popup **Add Desktop Window** section and the two-card `%{DashboardBarPopupSectionStack}` | no desktop windows reported by SteamVR right now. Opening a desktop window would be a side effect |
| Bar tab overflow fades (`%{FadeLeft}`/`%{FadeRight}` mask) | only 2 tabs. Needs many open windows |
| `%{PopupBody>Badge}` on tabs, `%{OldColors}` tabs, legacy hamburger **Options menu** + Exit VR / Power item, **Volume** small button + `%{VolumePopup}` | VR Link remote frames or legacy SteamVR (no `bH` capability) only |
| Conditional small buttons: Downloads progress, Family View / Kiosk lock, unformatted SD, low disk, Steam connection warning, voice chat | no such state on the device now |
| Notifications list in QAM and the bell (bell visible in `bar_before.png`, gone later) | notifications were cleared during the session |
| Controller battery status items, low-battery banner, green "charging" QAM tab variant | controllers off, headset full |
| `%{DashboardBarPopupListItem}` + `%{PanelSection>Active}` (blue dot), `%{DashboardMenu>Blocked}`, `%{DashboardMenu>Unselectable}` | no toggled menu actions, parental blocks or disabled actions present |
| Game-frame tab and frame menus (`steam_game_info` overlay and window items) | requires a running game, and launching is forbidden |
| CSS `:hover` looks and the real `.gpfocus` + `%{FocusRing}` on bar buttons and frame-menu items | synthetic events cannot trigger `:hover`. Driving gamepad focus into the bar would take the user's input focus (`FocusDashboardBar`), so it was not done. States are documented from Steam's CSS above |
| Avatar → `/account` page | it is a main-window route (other areas). Not clicked, so as not to move the shared main route |
