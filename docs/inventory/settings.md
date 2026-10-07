# Inventory: settings (surface `main`)

Area id `settings`. This covers `/settings` and every settings page, plus the sub-pages, menus and dialogs you can open from them. It maps every primitive control in enough detail to build the shared primitives stylesheet from (field rows, toggles, sliders, dropdowns and their open menus, buttons, text inputs, checkboxes, segmented radios, radio cards, headers, the nav list, the focus ring and the modal shell).

Everything below was measured live on 2026-10-06 against the stock UI (`--theme off`) and against Steam's own stylesheets, which were read rule by rule from `document.styleSheets` of the `main` window. The rule text is quoted in readable token form. Screens are 1280×720 CSS px, and the shots are 1.5× (1920×1080).

> Abbreviations used in this file: `G>X` = `%{*GamepadDialogContent>X}` (4 gamepaddialog builds), `P>X` = `%{PagedSettingsDialog_PageList_ShowTitle>X}`, `S>X` = `%{*SliderControlPanelGroup>X}`, `C>X` = `%{*BasicContextMenuModal>X}`. Expand them when writing CSS. Every token below was checked to resolve (`L.index.selector`).

---

## 0. How to reproduce (read first)

### 0.1 Shell gotcha (Git Bash)
Git Bash on this PC rewrites `/settings/...` into `C:/Program Files/Git/settings/...` before python sees it. Always prefix commands with `MSYS_NO_PATHCONV=1`. Use `PYTHONIOENCODING=utf-8` as well, or `outline` crashes on pages with non-cp1252 text (Friends shows `♥♥♥`).

```bash
cd "C:\Users\blcha\liquid_glass_frame\glass-shell"
MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8 python glass.py shot main set_system --route /settings/system --theme off
```

### 0.2 Shared UI pollution
Other agents leave context menus or modals open in `main`, and those survive route changes. Before trusting a shot, have `--pre` return `SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.m_ModalManager.m_rgModals.length` and retake the shot while it is non-zero. All `set_*` page shots listed here were verified with `modals=0`.

### 0.3 Standard `--pre` prelude
Wrap any per-screen JS (the `BODY` column in the tables below) like this:

```js
(async()=>{const W=L.surface('main');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const M=()=>SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.m_ModalManager.m_rgModals.length;
/* HELPERS (0.4) go here when needed */
let res; try{res=await(async()=>{ BODY })()}catch(e){res='ERR '+e.message}
return L.route()+' modals='+M()+' :: '+res})()
```

### 0.4 Helpers for menus and dialogs (paste inside the prelude)
`L.click()` (synthetic pointer events) does **not** open settings dropdowns or settings buttons. Calling the React `onClick` does. **Cancel/close helpers only ever press Cancel, Close or Back, or click outside the dialog. They never press OK, Confirm, Change, Connect, Disconnect or Forget.**

```js
const reactProps=n=>{const k=Object.keys(n).find(k=>k.startsWith('__reactProps'));return k?n[k]:null};
const fire=el=>{for(let n=el;n;n=n.parentElement){const p=reactProps(n);if(p&&p.onClick){p.onClick({currentTarget:n,target:n,preventDefault(){},stopPropagation(){},isPropagationStopped(){return false},nativeEvent:new W.MouseEvent('click'),type:'click',clientX:0,clientY:0,button:0});return 'ok'}}return 'nohandler'};
const synth=el=>{const r=el.getBoundingClientRect();const o={bubbles:true,cancelable:true,view:W,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0};for(const t of['pointerdown','mousedown','pointerup','mouseup','click']){const E=t.startsWith('pointer')?W.PointerEvent:W.MouseEvent;el.dispatchEvent(new E(t,Object.assign({pointerType:'mouse',isPrimary:true},o)))}return 'synth'};
const cancelMenu=()=>{const c=[...W.document.querySelectorAll('[role=listbox] *')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Cancel');return c.length?fire(c[c.length-1]):'nocancel'};
const cancelDialog=()=>{const m=L.qa('main','%{*GamepadDialogContent>ModalPosition}');const card=m.length?m[m.length-1]:W.document;const c=[...card.querySelectorAll('button,.DialogButton,[role=button]')].find(b=>/^(Cancel|Close|Back)$/i.test((b.innerText||'').trim()));if(!c)return 'nocancel';const r=fire(c);return r==='nohandler'?synth(c):r};
const dismiss=()=>{const r=cancelDialog();if(r!=='nocancel')return r;const d=L.qa('main','%{*GamepadDialogContent>ModalClickToDismiss}');if(!d.length)return r;const el=d[d.length-1];const p=reactProps(el);if(p&&p.onClick){p.onClick({currentTarget:el,target:el,preventDefault(){},stopPropagation(){},nativeEvent:new W.MouseEvent('click'),button:0});return 'clicktodismiss'}return synth(el)};
const findBtn=t=>L.qa('main','button.DialogButton').find(e=>e.innerText.trim()===t||e.innerText.trim().startsWith(t));
const fiberHandler=(el,name)=>{let fb=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(let i=0;fb&&i<12;i++,fb=fb.return){if(fb.memoizedProps&&fb.memoizedProps[name])return fb.memoizedProps[name]}return null};
```

**Atomic open, shoot, close pattern.** Open the menu or dialog in `--pre` and schedule the close with `setTimeout(...,2500)`, then pass `--settle 0.8`. The capture happens at about 1.4 s and the close fires at 2.5 s, inside or just after the locked step. Verify afterwards with `python glass.py js "SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.m_ModalManager.m_rgModals.length"`, which must be 0.

**Focus states without side effects:** `element.focus()` on any Focusable makes Steam add `.gpfocus` to it and `.gpfocuswithin` up the tree, exactly as the controller or laser does. It does not activate anything. Text inputs do not open the VR keyboard on focus.

**Scrolling a page:** `L.q('main','%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageContent}').scrollTop=N`.

---

## 1. Screen skeleton (same on every settings page)

Route `/settings` renders System. The leaf routes are listed in §3. DOM from the outline (abbreviated):

```
body %{*PopupBody} GamepadMode BasicUI ... LowPerfMode
 div BasicUI GamepadMode %{BasicUiRoot} %{SteamUIPopupHTML>VR}   style="--basicui-header-height:40px;--gamepadui-current-footer-height:42px"  r=6
  div %{MainNavMenuMainSplit}
   div %{BasicHome} %{OpaqueBackground}                           bg radial-gradient(rgb(6,10,14)...)
    div %{Profile>Header} %{OverrideHeaderBackground} ...          [0,0 1280x40] SHARED CHROME (Back + search). Paints via ::before rgba(0,0,0,.5); inline --gamepadui-header-opacity vars
    div %{PopupBody>Content} > %{PartnerEventOverlayContainer>AppDetailsMain} > %{TopLevelTransitionSwitch}
     div %{ContentWrapper} %{TopLevelTransition} (Enter/EnterActive)   route-level transition (shared)
      div %{AbsoluteDiv}
       div %{OverflowHidden>GamepadPage} %{Flexed} %{OverflowHidden} %{DialogBackground}   bg radial-gradient; inline --gamepad-page-content-max-width
        div G>GamepadDialogContent... DialogContent _DialogLayout %{GamepadPageDialogContent} %{NoVerticalPadding} %{NoHorizontalPadding} %{GamepadPage>FullWidth}
         div G>GamepadDialogContent_InnerWidth DialogContent_InnerWidth
          div P>PagedSettingsDialog                                 bg rgb(14,20,27), flex row
           div P>PagedSettingsDialog_PageListColumn PageListColumn  [0,0 256x720] bg rgb(43,45,51)   <- LEFT NAV (§2)
            div P>PagedSettingsDialog_PageList role=tablist         overflow-y:auto (SCROLLS: 1115px content in 678px)
           div DialogContentTransition P>PagedSettingDialog_ContentColumn   [256,0 1024x720] bg rgb(26,28,33)
            div %{ContentWrapper>TransitionGroup} + %{PagedSettingsDialog>Up}|%{PagedSettingsDialog>Down}
             div %{ContentWrapper} %{PagedSettingsDialog>ContentTransition} (+ %{PagedSettingsDialog>Enter}/%{PagedSettingsDialog>EnterActive} while switching)
              div %{*GamepadDialogContent_InnerWidth>GamepadDialogContent} DialogContent _DialogLayout P>PagedSettingsDialog_PageContent role=tabpanel   <- PAGE SCROLLER
               div G>GamepadDialogContent_InnerWidth DialogContent_InnerWidth   [292,64 952xN]
                div DialogHeader role=heading "System"                  <- page title (§4.1)
                div DialogBody [%{SettingsDialogBodyFade}]              <- sections + fields
    div %{FocusRingRoot} > div %{FocusRing}                            generic focus ring overlay (§4.13)
   div %{BasicFooter}  [0,678 1280x42] bg rgba(0,0,0,.5) + backdrop-filter, 1px top border  SHARED CHROME (A Select / B Back legend: %{FooterLegend} %{ActionButtonLegend} %{ActionButtonLabel} %{FooterGlyphSize})
 div %{GamepadDialogOverlay} GamepadMode FullModalOverlay           modal layer (§4.14). Persists empty after a modal closes
```

| Element | Paints today | Notes for the theme |
|---|---|---|
| `P>PagedSettingsDialog` | `background: rgb(14,20,27)` | Flex row. Do not change the layout |
| `P>PagedSettingsDialog_PageListColumn` | `background: rgb(43,45,51)`; `min-width:240px; max-width:20%; padding-bottom: var(--gamepadui-current-footer-height)` | Natural place for a glass sidebar slab |
| `P>PagedSettingDialog_ContentColumn` (also `.DialogContentTransition`) | `background: rgb(26,28,33)` | Large surface. **No backdrop-filter here** (the page scrolls inside it) |
| `P>PagedSettingsDialog_PageContent` (`.DialogContent`) | transparent; `position:absolute; inset:0; overflow:hidden auto; scroll-padding:250px 0 60px; padding: calc(24px + header 40px) 2.8vw calc(footer 42px + 20px)` (computed `64px 35.84px 62px`) | **Main scroll container of every page.** Never touch overflow, position or padding-top/bottom (they reserve header and footer space) |
| `G>GamepadDialogContent_InnerWidth` | transparent, `max-width:100%` | Content width is 952px |
| `%{OverflowHidden>GamepadPage}` / `%{BasicHome}` | `radial-gradient(155.42% 100% at 0 0, rgb(6,10,14)…)` | Hidden under the columns |
| `%{Profile>Header}` | own `::before` = `rgba(0,0,0,.5)` 1280×40; `z-index:6000` | Shared chrome (shell area). Steam already uses `::before` here |
| `%{BasicFooter}` | `rgba(0,0,0,.5)`, backdrop-filter, `z-index:7000` | Shared chrome |

**Page-switch transition (do not touch transform/opacity):** `%{PagedSettingsDialog>Up}|%{PagedSettingsDialog>Down} > %{PagedSettingsDialog>ContentTransition}%{PagedSettingsDialog>Enter}` starts at `transform: translateY(±12%); opacity:0`. `…EnterActive` goes to `translateY(0); opacity:1` over 320ms (80ms delay). Exit runs to `translateY(∓8%)`, `opacity:0`, 80ms. A `prefers-reduced-motion` variant uses `step-start`.

---

## 2. Left navigation list

Shot: every `set_<page>.png` (left column). Focus: `set_focus_navitem.png` (Keyboard focused while Audio is Active).
Reproduce focus: route `/settings/audio`, BODY `const it=L.qa('main','%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageListItem}')[8]; it.focus(); await sleep(500); return it.innerText`. Focusing a nav item does **not** switch the page.

```
div P>PagedSettingsDialog_PageList role=tablist                          overflow:hidden auto; scroll-snap-type:y mandatory; scroll-padding:36px 0; padding-bottom:16px
 div P>PagedSettingsDialog_PageListItem [P>Active] Panel Focusable role=tab   256x42
  div %{ScaledChildren}                                                   flex row; transform:scale(1) -> scale(1.1) when Active or :focus (ANIMATED, don't touch)
   div P>PageListItem_Icon > svg                                          20x20, margin-right 16px
   div P>PageListItem_Title "System"
 div %{PagedSettingsDialog>Separator}                                     1px rgba(255,255,255,.1), margin 8px calc(12px+1.4vw)  (3 of them, 1px tall so `outline` hides them)
```

| State | Selector | Paint |
|---|---|---|
| default | `P>PagedSettingsDialog_PageListItem` | 16px/22px Motiva, `color rgb(184,188,191)`, `padding 10px calc(12px+1.4vw)`, `border-left: 2px solid transparent`, transitions `transform .32s, background-color 0s`, `transform: scale(1) rotateX(0)` |
| hover | `…PageListItem:hover` | `background-color: rgba(255,255,255,.05)` |
| selected (current page) | `…PageListItem` + `P>Active` | `color #fff; background: linear-gradient(90deg, rgba(26,159,255,.22), rgba(26,159,255,0))`; `ScaledChildren` scale 1.1 |
| focused | `…PageListItem:focus` (**`:focus`, not `.gpfocus`**; it also gets `.gpfocus`) | `color #fff; background: linear-gradient(90deg, rgba(26,159,255,.4), transparent); border-left: 2px solid rgb(26,159,255)`; scale 1.1 |
| disabled | `…PageListItem` + `P>DisabledItem` | `color rgb(65,65,65)` (none seen live) |
| high contrast | `@media (prefers-contrast: more)` | item color white |

Pages in order (24 visible). The separators sit after Bluetooth, after Security and after Game Recording:
System, Internet, Storage, Bluetooth | Display, Power, Audio, Controller, Keyboard, Accessibility, Security | Notifications, Friends & Chat, Downloads, Cloud, In Game, Compatibility, Family, Remote Play, Game Recording | Home, Library, Store, Developer.

No `::before`/`::after` on nav items, so they are free for the theme. `P>PagedSettingsDialog_Title` exists in the module but is not rendered (showTitle false).

---

## 3. Page routes and before-shots

| Page | Route | Before-shots (top, then scrolled) | Page height |
|---|---|---|---|
| System | `/settings/system` (`/settings` = same) | `set_system.png`, `set_system_2..5.png` (scrollTop 650/1300/1950/2669) | 3389 |
| Internet | `/settings/internet` | `set_internet.png`, `set_internet_2.png` | 969 |
| Storage | `/settings/storage` | `set_storage.png`, focus `set_focus_storage.png` | 720 (inner virtual list) |
| Bluetooth | `/settings/bluetooth` | `set_bluetooth.png` | 708 |
| Display | `/settings/display` | `set_display.png` | 720 |
| Power | `/settings/power` | `set_power.png` | 720 |
| Audio | `/settings/audio` | `set_audio.png`, focus `set_focus_slider.png` | 763 |
| Controller | `/settings/controller/:type/:controllerIndex` (**literal string**; `/settings/controller` falls back to System) | `set_controller.png` | 720 |
| Controller → Advanced | `/settings/controller/advanced/:controllerIndex` (literal) | `set_controller_advanced.png` | 720 |
| Keyboard | `/settings/keyboard` | `set_keyboard.png`, `set_keyboard_2.png` | 1299 |
| Accessibility | `/settings/accessibility` | `set_accessibility.png` | 720 |
| Security | `/settings/security` | `set_security.png` | 720 |
| Notifications | `/settings/notifications` | `set_notifications.png`, `_2/_3/_4` (700/1400/1792) | 2512 |
| Friends & Chat | `/settings/friends` | `set_friends.png`, `set_friends_2.png` | 1231 |
| Downloads | `/settings/downloads` | `set_downloads.png`, `set_downloads_2.png` | 887 |
| Cloud | `/settings/cloud` | `set_cloud.png` | 720 |
| In Game | `/settings/ingame` | `set_ingame.png` | 720 |
| Compatibility | `/settings/compatibility` | `set_compatibility.png` | 720 |
| Family | `/settings/family` | `set_family.png` | 720 |
| Remote Play | `/settings/remoteplay` | `set_remoteplay.png`, `set_remoteplay_2.png` | 1372 |
| Game Recording | `/settings/gamerecording` | `set_gamerecording.png`, `set_gamerecording_2.png` | 1065 |
| Home | `/settings/home` | `set_home.png` | 720 |
| Library | `/settings/library` | `set_library.png` | 720 |
| Store | `/settings/store` | `set_store.png` | 720 |
| Developer | `/settings/developer` | `set_developer.png`, `_2/_3/_4` (650/1300/1779) | 2499 |

Scrolled-shot reproduction: route as above, BODY `const pc=L.q('main','%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageContent}'); pc.scrollTop=650; await sleep(400); return pc.scrollTop`.

Pages defined in Steam's source but **hidden in this VR build**: Account, Customization, Interface, Music, Broadcast, Voice, In-Game Voice, Internal, Desktop Security. Their routes (`/settings/account` etc.) fall back to System, so there is nothing extra to style. `/settings/display/advanced` and `/settings/audio/advanced` also just show their parent page.

---

## 4. Primitives (the shared stylesheet)

### 4.1 Page title, section headers, body text

| Token | Where | Paint |
|---|---|---|
| `.DialogHeader` (literal; role=heading) | Page title, first child of `DialogContent_InnerWidth`; also dialog titles | In gamepad: `font: bold 22px/28px "Motiva Sans"; color #fff; margin 0 0 10px; display:flex; gap:10px` |
| `.SettingsDialogSubHeader` (literal; role=heading) | Section header, 926x36, first child of each section | `font-size:16px; font-weight:500; line-height:36px; color rgb(220,222,223); margin-inline-end:26px`. White in high contrast |
| `.DialogControlsSection.DialogLabelledControlsSection.DialogSettingsSection` role=region | Section wrapper | Transparent. `margin-top:24px` between sections (`:not(:first-child)`) and 5px after a `DialogHeader:first-child` |
| `.DialogBody` | Body of the page | Transparent, `overflow: initial` |
| `%{SettingsDialogBodyFade}` | Extra class on some DialogBody | Only sets `--fadeDirection` (no paint) |
| `%{SettingsDialogBodyText}` | Free text such as "Select your recording mode:" or "Flash window when…" | Inherits 16px/20px rgb(220,222,223) |
| `%{SettingsDialogDescriptionText}` | Downloads "To set exceptions…" | `12px/16px rgb(184,188,191); margin-top:8px` |
| plain `div` text | Audio "No apps are currently playing audio.", Developer "Steam Play is enabled for all titles" | Inherits |
| `.DialogControlsSectionHeader` | Network details dialog subheading "IPv4 Address" | Inherits |

`::before`/`::after`: none on these, so they are free.

### 4.2 Field row family (`G>Field`)
Every settings row. Live shots: any page, plus `set_focus_toggle.png`, `set_focus_dropdown.png`, `set_focus_button.png` and `set_focus_clickfield.png` for the focused row.

```
div G>Field [G>VerticalAlignCenter] [G>WithBottomSeparatorStandard] [G>ChildrenWidthFixed|G>ChildrenWidthGrow] [G>ExtraPaddingOnChildrenBelow]
            [G>StandardPadding] [G>HighlightOnFocus] [G>Background] [G>Clickable] [G>Disabled] [G>InlineWrapShiftsChildrenBelow] [G>WithChildrenBelow]
            Panel Focusable [role=button|radio]   style="--indent-level: 0;"
 div G>FieldLeftColumn
  div G>FieldLabelRow
   div G>FieldLabel  "Label"   (optionally contains div G>FieldIcon G>Front > svg; or rich children)
  div G>FieldDescription "small text"     (only when present)
 div G>FieldRightColumn
  div G>FieldChildrenWithIcon
   [div G>FieldIcon G>BeforeChildren]      (slider rows: speaker/mic icon)
   div G>FieldChildrenInner
    <control>: G>Toggle | button DropDownControlButton | button.DialogButton | G>LabelFieldValue | DialogInput_Wrapper | G>ControlsListOuterPanel ...
```

Row geometry (measured): 952 wide. Label-only rows with a toggle are 46px tall, rows with a description or a 40px control are 64px, info rows (`LabelFieldValue`) are 47px, and 2-line descriptions give 80px. Rows are separated by `margin-top:6px` (`:not(.SettingsDialogSubHeader) + G>Field`). Padding is `12px` vertical and `calc(12px + var(--indent-level)*20px)` / `12px` horizontal (20px when the window is ≥1500px wide). The gap between columns is 12px. `FieldRightColumn` has `max-width:50%` unless `ChildrenWidthGrow`, and `FieldChildrenInner` has `min-width:250px` with `ChildrenWidthFixed`.

| Part / state | Selector | Paint today |
|---|---|---|
| row background | `G>Field` + `G>Background` | `background: rgb(35,38,46)`; `border-radius: 2px`; `position:relative` |
| row without Background | `G>Field` alone | Transparent. Used in dialogs (network details footer row) and in the Keyboard quick options inside modals |
| label | `G>FieldLabel` | 16px/20px, `color rgb(220,222,223)` (white in high contrast), flex row |
| description | `G>FieldDescription` | 12px/16px, `color rgb(184,188,191)`, `margin-top:4px` |
| icon | `G>FieldIcon` + `G>Front` | `padding-inline-end:10px`; svg 20px tall |
| value text | `G>LabelFieldValue` | `color rgb(139,146,154)`. In a focused row: `rgb(184,188,191)` |
| **focused row** | `G>Field:not(G>Classic)G>HighlightOnFocus.gpfocus` and `.gpfocuswithin` | Rule: `background: rgb(61,68,80); color:#fff; outline:none; z-index:1; animation-name: <ItemFocusAnim>` with `animation-duration .5s; fill-mode: forwards`. The keyframes go from `background rgb(35,38,46); color rgb(139,146,154)` to `background rgb(56,58,65); color #fff`. **Computed focused background is rgb(56,58,65), from the animation.** Label turns white, description `rgb(220,222,223)`, ToggleRail turns `rgb(35,38,46)` |
| disabled row | `G>Field` + `G>Disabled` | `color rgb(103,112,123)`; label and description `rgb(103,112,123)`; `cursor: default`. Background unchanged |
| clickable row | `G>Field` + `G>Clickable` (role=button) | `cursor:pointer`. Same paint as a normal row. Seen on System "About" info rows, Internet network rows, Bluetooth device rows, Keyboard layout row and Home instructions |
| hover | — | **No hover style for VR (non-Classic) fields.** `:hover` only applies to `G>Classic` rows (desktop). The laser shows focus instead |
| separator | `G>WithBottomSeparatorStandard` / `…Thick` | **Draws nothing in VR.** The separator line is `G>Classic … ::after` only. Rows are separated by the 6px gap |
| standalone separator | `G>StandaloneFieldSeparator` | 1px `rgba(255,255,255,.1)` (not seen in settings pages) |
| motion | `G>Field` | `transform: scale(1) rotateX(0deg); transform-origin:12% 50%; transition: transform .32s, background-color 0s` |

**Theme must:**
- set focused-row backgrounds with `!important` (or `animation-name: none` on `.gpfocus`/`.gpfocuswithin` rows). Otherwise Steam's `forwards` focus animation keeps painting `rgb(56,58,65)` over your rule.
- not touch `transform` or `transition` on `G>Field`.
- leave inline `--indent-level` alone.
- use `::before`/`::after` on `G>Field` freely in VR. They are unused when `G>Classic` is absent, so add `:not(%{*GamepadDialogContent>Classic})` to stay safe in desktop and Quick Access contexts.

`%{*GamepadDialogContent>Field}` resolves to 4 hashes, the same set as `%{*Field}`. The `%{ButtonPickerDialog>…}` and `%{EButtonToggle>…}` names that appear in rule dumps are aliases of those same hashes, so the anchored form covers every copy.

### 4.3 Toggle (`G>Toggle`)
Shots: every page. Focus: `set_focus_toggle.png`, and `set_dlg_proxy.png` / `set_dlg_keyboards.png` (focused toggle inside a dialog). Disabled: System crash-report rows in `set_system_2.png`.

```
div G>Toggle [G>On] [G>Disabled] Focusable role=checkbox    38x22, r=16
 div G>ToggleRail                                           abs inset 0, r=9001, overflow:hidden
   ::before  (Steam's blue "on" fill)
 div G>ToggleSwitch                                         22x22 knob, r=9001
```

| State | Rail | Rail `::before` (Steam-owned) | Knob |
|---|---|---|---|
| off | `background rgba(255,255,255,.15)` | `content:""; abs inset 0; background rgb(26,159,255); transform: translateX(-27px)` (hidden left) | `background #fff; box-shadow 0 0 5px rgba(0,0,0,.35); left:0` |
| on (`G>On`) | same | `transform: translateX(-11px)` (fill visible) | `transform: translateX(16px)`, `transition: transform .2s cubic-bezier(.1,.12,.53,1.72)` (overshoot) |
| disabled (`G>Disabled`) | `background rgb(103,112,123)` | `opacity: 0` | `background rgb(139,146,154)` |
| row focused (`G>Field.gpfocuswithin`) | `background rgb(35,38,46)` | — | — |
| toggle focused (`G>Toggle.gpfocus`) | — | — | `border: 2px solid rgb(103,112,123); margin:-2px` (26x26 live) |
| toggle focus halo | **`G>Toggle.gpfocus::after`** (Steam-owned): `content:""; abs; inset-inline-start:-10%; top:-15%; width:120%; height:132%; border-radius:16px; background rgb(139,146,154); z-index:-1` | | |
| hover | `G>Toggle:not(G>Disabled):hover` → `box-shadow: 0 0 0 4px rgba(255,255,255,.3)`, `transition: box-shadow 100ms` | | |
| RTL | `G>Toggle:dir(rtl) { scale: -1 1 }` | | |

**Theme must not** change `transform` on `ToggleRail::before` or `ToggleSwitch` (they encode the on/off state). It may recolour them. Steam owns `::before` on the rail and `::after` on a focused toggle. Use `%{*GamepadDialogContent>Toggle}` (4 hashes, which already covers the ButtonPickerDialog and EButtonToggle aliases). **Avoid `%{*Toggle}`**: it resolves to 6 hashes and pulls in the speaker ChannelTester toggle plus a separate ToggleRow/Highlight/Off toggle module. Notifications toggles additionally carry `%{ParentalButton}` and have a child `%{ParentalWrapper}` (an absolute, pointer-events:none overlay; leave it alone).

### 4.4 Slider (`S>…`)
Live in settings: Audio "Volume" and "Microphone Volume" (no notches, no value label). Shots `set_audio.png`, focused `set_focus_slider.png` (footer changes to "B Done" while a slider is focused).

```
div G>Field G>WithChildrenBelow ...                         48px row
 div G>FieldChildrenWithIcon
  div G>FieldIcon G>BeforeChildren > svg                    speaker / mic icon 32x24
  div G>FieldChildrenInner
   div %{*SliderControlAndNotches>SliderControlPanelGroup} SliderControlPanelGroup Panel Focusable aria=Volume role=button   flex-grow 1
    div S>SliderControlAndNotches Focusable role=slider   style="--normalized-slider-value:0.5; --normalized-slider-origin:0; --slider-extra-notch-padding:0px"
     div S>SliderControl SliderControl                     height 24, --slider-handle-width:24px, transition filter 50ms
      div S>SliderTrack SliderTrack                        6px tall, r=3, background rgba(255,255,255,.15), overflow hidden, --left-track-color:#1a9fff
        ::before  (Steam-owned blue fill; width computed from --normalized-slider-value)
      div S>SliderHandleContainer                          abs, transform: translateX(calc(...--inverse-normalized-value...))   <- positions the knob
       div S>SliderHandle SliderHandle                     24x24, background #fff, r=1337, shadow 0 0 5px rgba(0,0,0,.35), pointer-events none
     [div S>SliderNotchContainer > div S>SliderNotch [S>AlignToEnds] > div S>SliderNotchTick [S>TickActive] + div S>SliderNotchLabel]   (notched sliders)
   [div S>DescriptionValue > input S>EditableValue | S>FakeEditableValue]   (value box; not present in settings)
```

| Part / state | Paint |
|---|---|
| track | `rgba(255,255,255,.15)`, 6px, r=3; with notches `width: calc(100% - 20px)` |
| fill `S>SliderTrack::before` | `background-color: var(--left-track-color)` (= `#1a9fff`), r=3; geometry from CSS vars (`inset-inline-start`/`width` computed). Disabled: `rgb(103,112,123)`. `DefaultValueColorLeft/Right` variants use a linear-gradient |
| knob | `#fff`, shadow; focused (`S>SliderControlAndNotches:not(S>Disabled).gpfocus S>SliderHandle`): `border:3px solid rgba(255,255,255,.15); margin:-3px; animation: 200ms <pop>` (keyframe `0% { transform: scale(1.4) }`). Disabled: `rgb(139,146,154)` |
| ticks | `S>SliderNotchTick` 4x12 `rgba(255,255,255,.15)`; `S>TickActive` `rgb(26,159,255)` |
| tick labels | `S>SliderNotchLabel` bold 10px/10px, uppercase, letter-spacing .5px, padding-top 5px |
| value box | `S>EditableValue` / `S>FakeEditableValue`: 16px/20px, `background rgb(35,38,46); color rgb(139,146,154); r=3; padding 4px 8px; min-width 4em; text-align end`. `.gpfocus` gives white background and black text. `S>RedBorder` gives a 2px `rgb(222,54,24)` outline |
| default-value tick | `S>DefaultValueTick > svg` `color rgb(139,146,154)` |
| row focus | Same as Field focus (row background via the focus animation). The slider itself shows no FocusRing |

**Theme must not** touch `transform` on `S>SliderHandleContainer`, the inline CSS variables, or geometry and `inset` on `S>SliderTrack::before`. Recolour `--left-track-color` or `background-color` of `::before` instead. The `%{OverlayTabSetting>…}` copy of this module exists for in-game overlay tabs (other areas).

### 4.5 Dropdown button (`%{DropDownControlButton}`)
Shots: any page. Focused: `set_focus_dropdown.png`. Disabled: Game Recording "Record Audio from…" (`set_gamerecording_2.png`).

```
button %{DropDownControlButton} DialogButton _DialogLayout Secondary G>Button Focusable role=combobox aria-expanded   250x40 (Keyboard theme 200x40; Downloads 307x40; Recording Quality modal 584x40)
 div G>DropDownControlButtonContents                         flex, gap .5em
  div DialogDropDown_CurrentDisplay  "English"               flex 1, ellipsis
   [div %{DropDownLabelContainer} > div %{DropDownLabelTextColumn} > %{DropDownLabelUpperDescription} %{DropDownLabelTitle} %{DropDownLabelDescription}]  (Timezone: 72px tall button)
  svg (Carat down)                                           16x16, height 1em
```

Paint: everything from `G>Button.DialogButton` (§4.7) plus `padding: 10px 16px; min-width: initial`. Rich labels use Title 16px/20px `rgb(220,222,223)` and Upper/Description 12px/16px `rgb(139,146,154)`. Inside a `.gpfocus` button the Title becomes `rgb(14,20,27)` and the descriptions `rgb(103,112,123)`. Extra classes seen: `%{EnableSteamPlayForOthersDropdownButton}` (`min-width:12em`), `%{BitrateSetting>DropDownRow}` (modal). Storage uses a different dropdown, `%{BasicHomeDropDownControlButton} %{SortingDropDownControlButton}` ("Size on Disk", transparent, transition on padding) inside `%{LibraryImageBackgroundGlow>SortingDropDown}`. That one belongs to the Library area's sort control. Do not open it.

### 4.6 Dropdown menu (opened state, gamepad context menu)
Shots: `set_dropdown_open.png` (Power "Dim display after", plain options) and `set_dropdown_rich.png` (System Timezone, 64 rich options, scrolled).

Reproduce (Power):
- route `/settings/power`, `--settle 0.8`
- BODY (with helpers): `fire(L.q('main','%{DropDownControlButton}')); await sleep(900); setTimeout(()=>cancelMenu(),2500); return W.document.querySelector('[role=listbox]')?'open':'closed'`

Timezone: `fire(L.qa('main','%{DropDownControlButton}').find(e=>e.innerText.includes('Eastern')))` on `/settings/system`. Every menu ends with a **Cancel** item. The helper presses only that item, and selected values were verified unchanged afterwards.

```
div %{GamepadDialogOverlay} GamepadMode FullModalOverlay (§4.14 backdrop: rgba(0,0,0,.85) + blur(3px))
 div ModalOverlayContent active
  div G>ModalPosition G>VR G>FooterVisible Panel              top: header 40px, bottom: footer 42px
   div BasicUIContextMenu %{*BasicContextMenuHeader>BasicContextMenuModal}   abs inset 0, flex column, centered
    [div C>BasicContextMenuHeader]                             title, 18px/22px centered rgb(220,222,223); :empty hidden (game menus show it)
    div C>BasicContextMenuContainer Panel                      max-width 70%; animation .5s (opacity 0 -> 1); overflow hidden
     div C>contextMenuContents Panel role=listbox             280+ wide; filter: drop-shadow(0 0 8px rgba(0,0,0,.5)); overflow-y:auto (SCROLLS, scrollbar hidden); first child margin-top 15px, last child margin-bottom 40px
      div C>contextMenuItem contextMenuItem [C>Selected] [C>Focused] Panel Focusable role=option   48px tall (rich: 80px)
      div C>ContextMenuSeparator role=separator                2px, background rgb(0,0,0)
      div C>contextMenuItem contextMenuItem role=menuitem "Cancel"
```

| Item state | Paint |
|---|---|
| default | `background rgb(35,38,46); color rgb(184,188,191); padding 14px; min-width 280px; line-height 20px` |
| hover | `background rgb(61,68,80)`, 100ms |
| current value (`C>Selected`) | `background rgb(61,68,80); color #fff` |
| focused (`C>Focused` + `.gpfocus`) | `background #fff; color rgb(14,20,27)`. The menu opens focused on the current value, so it shows white |
| `C>active` | `#fff` / `#000` |
| Destructive / Positive / Emphasis | Focused: `rgb(222,54,24)` / `rgb(89,191,64)` / `rgb(26,159,255)`. Hover variants are darker. Not used by settings dropdowns, but used by game menus that share this module |
| disabled item `.disabled` | `color rgba(255,255,255,.3)` |
| submenu | `C>SubMenu`, `C>Arrow`, `.SVGIcon_DownArrowContextMenu rotateZ(-90deg)` (not in settings) |

The same context-menu module renders the Library and game context menus, so coordinate with those areas. Prefer `%{*BasicContextMenuModal>contextMenuItem}` (4 hashes). `%{*contextMenuItem}` resolves to 5 because it pulls in one unrelated module.

### 4.7 Buttons (`button.DialogButton` + `G>Button`)
Shots: any page. Focused: `set_focus_button.png` (System "Apply"). Disabled: Remote Play "Connected" (`set_remoteplay_2.png`) and the dialog "Continue"/"Confirm" (`set_dlg_proxy.png`, `set_dlg_addgame.png`). Primary focused: "Close" in `set_dlg_explainer.png`, "Disconnect" in `set_dlg_network.png`.

DOM: `button DialogButton _DialogLayout Secondary|Primary [Disabled] G>Button Focusable role=button` with text or icon children. Settings-row variant adds `%{SettingsDialogSubHeader>SettingsDialogButton}`. Sizes: 160x40 standard, wider for longer text (190–331 wide).

| State | Selector | Paint |
|---|---|---|
| base (Secondary **and** Primary in gamepad) | `button G>Button.DialogButton` | `background rgba(255,255,255,.15); color rgb(220,222,223); font 16px/20px; border-radius 2px; padding 10px 24px; min-width 160px; box-shadow none; transition: none; position:relative` |
| hover | `…:hover` | `rgba(255,255,255,.2)`, 150ms. Primary hover `rgba(26,160,255,.486)` |
| focused / pressed | `….gpfocus`, `…:active` | `background #fff; color rgb(35,38,46)`. Inside a Field it also gets `box-shadow 0 4px 4px rgba(0,0,0,.25)` |
| focused Primary | `….gpfocus.Primary` | `background rgb(26,159,255); color #fff` |
| focused Destructive | `….gpfocus.Destructive` | `rgb(222,54,24)` |
| disabled | `.Disabled` / `[disabled]` | `opacity .4; background rgb(19,20,24); color #fff; pointer-events none`. Disabled+focus: `background #000` |
| `ActiveAndUnfocused` | `G>ActiveAndUnfocused` | `rgb(14,20,27)` |
| high contrast | — | black on white |

`::before`: the desktop rule `button.DialogButton::before` (shadow overlay) exists, but the gamepad variant sets `content: none` on it, so `::before` and `::after` are available (keep `pointer-events:none`). Icon-only buttons are `%{ShowKeyboardButton}` (Keyboard, 40x40 keyboard icon), `%{BuiltInLayoutButton}` (Controller advanced, 40x40) and `%{BackButtonContent>BackButton}` (Controller advanced header back arrow, 34x34, inner `%{BackButtonContent}`). Recording Quality is a plain button with a muted span `%{BitrateSetting>Muted}` (`rgb(139,146,154)`). Family uses `%{TrySteamFamiliesButton}` (Primary, 488x40).

### 4.8 Text input (`G>BasicTextInput`)
Shots: `set_keyboard_2.png` (Quick Chat options), focused `set_focus_input.png`, and in dialogs `set_dlg_hostname.png`, `set_dlg_addgame.png`, `set_dlg_pin.png` (auto-focused, white).

```
div DialogInput_Wrapper _DialogLayout Panel Focusable          flex row (relative)
 input G>BasicTextInput DialogInput DialogInputPlaceholder DialogTextInputBase Focusable   250x40 in rows, full width in dialogs
[div DialogInputLabelGroup _DialogLayout > label > div DialogLabel "text" + wrapper]   (Set PIN dialog)
```

| State | Paint |
|---|---|
| default (BasicUI) | `background rgba(255,255,255,.1); color rgb(139,146,154); font 16px/20px; padding 10px 16px; border-radius 0` (the base `.DialogTextInputBase` has r=3, overridden to 0) |
| hover | `…:not(.disabled):not(.gpfocus):hover` keeps the same `rgba(255,255,255,.1)` |
| focused | `.gpfocus` → `background #fff; color #000; box-shadow none` |
| placeholder | `::placeholder` italic `rgb(103,112,123)` |
| disabled / read-only | `color rgba(136,136,136,.7)` |
| `.DialogLabel` | 13px/19px weight 300, uppercase, `rgb(172,178,184)` |

The VR keyboard surface did **not** open on programmatic focus. Opening it needs A or click, and it belongs to the keyboard area.

### 4.9 Segmented radio group (`%{Group}` / Shared_Radio_Group)
Where: Notifications "Flash window…" (Always / Only when minimized / Never) and Friends "Chat Font Size" (Small / Default / Large). Shots: `set_notifications_2.png`, `set_friends_2.png`, focused `set_focus_radio.png`.
Reproduce focus: `/settings/notifications`, BODY `L.qa('main','.RadioButton').find(e=>e.innerText.trim()==='Never').focus(); await sleep(500); return 'ok'`.

```
div Panel
 div %{Group} Shared_Radio_Group Panel role=radiogroup        952x44, background rgb(42,46,54), r=2, padding 6px 0 6px 6px
  div %{Group>Button} RadioButton [%{Group>Active}] Focusable role=radio   309x32
```

| State | Paint |
|---|---|
| button default | `background rgb(42,46,54); color rgb(184,188,191); 14px; padding 6px; margin-inline-end 6px; r=2; text-shadow 0 0 4px rgb(13,79,126); transition background-color .18s` |
| divider | **Steam-owned `::before`** on `%{Group>Button}:not(Active) + %{Group>Button}:not(Active)`: 1px × 80% `rgb(61,68,80)`, abs, inset-inline-start -3px |
| selected | `%{Group>Active}`: `background radial-gradient(rgba(26,159,255,.733), rgb(26,159,255)); color #fff` |
| hover | `:not(%{Group>Disabled}):hover` → `rgb(70,77,88)` |
| focused | No own style. Shows the generic **FocusRing** (§4.13) as a 2px white 60% outline |
| `%{CenteredPill}` variant | Pill borders. Not used in settings |

### 4.10 Checkbox (`.DialogCheckbox`) and sticky column headers
Where: Notifications email/toast/mobile/feed matrices (Store News, Personal Activity, Wishlist, Steam Family, Developer/Game News). Shots `set_notifications_2..4.png`, focused `set_focus_checkbox.png`.

```
div DCS %{NotificationListSection}                         position relative
 div .SettingsDialogSubHeader
 div %{CheckboxHeaders} [%{Scrolling}]                     STICKY: position sticky; top 0; z-index 10; pointer-events none while Scrolling
  div %{NotifyViaHeader} "Notify me via"                   italic 12px; opacity 0 while %{Scrolling}
  div %{CheckboxColumn} "Email" ...                        50px; 12px white; backdrop-filter: blur(2px) while %{Scrolling} (Steam's own)
 div G>Field G>ChildrenWidthGrow ...
  ... div %{SettingTogglesCtn} Panel > div %{CheckboxColumn} > div DialogCheckbox [Active] [Disabled] Panel role=checkbox > svg SVGIcon_Button SVGIcon_DialogCheck
```

| State | Paint |
|---|---|
| box | 22x22, `background rgba(0,0,0,.267); box-shadow inset 1px .5px 3px rgba(1,1,1,.4); r=2` |
| checked `.Active` | check svg `opacity 1`; the path animates `stroke-dashoffset` (transition) |
| hover / focus | `background rgb(9,9,9)`; focus also shows the **FocusRing** |
| disabled `.Disabled` | `opacity .5; filter saturate(.35); box-shadow none` (e.g. the "Feed" column) |

The Notifications page also uses toggle pairs under `%{NotificationSectionHeader}` with `%{Toggles}` labels "Show Toast"/"Play Sound" (bold 10px uppercase white; `%{Sound}` 118px). Those rows are `G>Field` containing `%{Toggles}` with two `%{ParentalButton} G>Toggle`.

### 4.11 Radio cards and radio rows
- **Game Recording mode** (`set_gamerecording.png`): `div %{RecordingMode} role=radiogroup` (flex column, gap 8px) containing `div %{RecordingModeOption} [%{WarningBox>Active}] Focusable role=radio` (952 wide; `background rgb(35,38,46); r=3; border 1px transparent; transition border/bg/color/shadow 300ms`). Hover and `.gpfocus` give `rgba(61,68,80,.314)` plus shadow `0 6px 8px rgba(0,0,0,.16)`. Active gives `rgba(61,68,80,.627)` plus shadow. Inside: `div %{Pip} [%{ActivePip}]` (20px circle `rgb(103,112,123)`; active is `rgb(26,159,255)` with a 3px `rgb(220,222,223)` border) and `div %{WarningBox>Content}` with `%{WarningBox>Header}` (15px/18px 800 `rgb(184,188,191)`, active `rgb(220,222,223)`) and `%{FieldSeparator>Body}` (14px `rgb(139,146,154)`). Focus shows the FocusRing (952x73). **Never click a card; that changes the recording mode.**
- **Keyboard layouts** (`set_keyboard.png`): `div %{RadioGroupWrapper} role=radiogroup` > `div %{KeyboardLayoutOptions} G>Field G>Clickable role=radio` with `G>LabelFieldValue` "Current Layout". Focus is the plain Field focus (no ring).

### 4.12 Info rows, links, misc
- `G>LabelFieldValue`: System About/SteamVR/Steam/Hardware rows (all `G>Clickable G>InlineWrapShiftsChildrenBelow`, 47px), "Update available:".
- `G>ControlsListOuterPanel G>AlignRight G>StandardSpacing` > `G>ControlsListChild`: Remote Play computer rows and the Connection PIN row. Dialogs use `G>AlignCenter`/`G>ExtraSpacing`.
- Links: `a.Focusable` (Family "Steam Families", In Game "Steam Networking", Downloads `%{LastGamePlayed}` underline `rgb(139,146,154)`). Focus shows the FocusRing.
- Badges: `%{BluetoothDeviceQuickAccessField>NotConnectedLabel}` "Not connected" (bold 10px uppercase `rgb(139,146,154)`); `%{NotConnectedLabel>Header}` on the "Available to pair" header (with a spinner svg).
- Display: `img %{GameResolutionGlyph}` (Y glyph inside a description; `filter: brightness(0) invert(70%)`).
- System: `%{SoftwareUpdateSection}` (yellow "!" svg with `transform: translateX(1px) translateY(-2px)`) and `%{OOBEUpdateStatusContainer>UpdateStatusContainer}`.
- Friends: `%{FakeFriend}` preview (avatar `%{avatarHolder}`, `%{avatarStatus}` blue bar, `%{playerName}`, `%{statusAndName>playerNicknameBracket}`), which comes from the friends module.
- Downloads: `%{FakeContainer}` (`background rgb(35,38,46); r=2; padding 12px 10px`), a pseudo-row containing `%{BandwidthInputWrapper>DropDownRow}`.
- Home: `%{HiddenGameLabel}` with `%{GameCount}` (white) and `%{AppSelectorButton>Description}` 12px; `%{Instructions}` 12px `rgb(184,188,191)` inside a `G>WithChildrenBelow G>Clickable` row.
- Developer: `%{HardwareUpdaterField}` (Field, button padding 0 10px).
- Controller advanced: `.DialogHeader %{ControllerSettingsHeader}` (flex with back button), `%{BuiltInLayoutButtons}`.

### 4.13 Generic focus ring (`%{FocusRing}`)
Steam draws one absolutely positioned overlay for focusables that do **not** opt out with `noFocusRing`. In settings that means `.RadioButton`, `.DialogCheckbox`, `%{RecordingModeOption}` and `a.Focusable` links. **Fields, toggles, sliders, DialogButtons, dropdowns, text inputs, nav items, storage tabs and rows draw no ring.**

```
div %{FocusRingRoot}     (child of %{BasicHome}) position abs; top/left 0; z-index 10000; pointer-events none
 div %{FocusRing}        style="left:928.7px; top:478.7px; width:309.4px; height:32px"   <- INLINE GEOMETRY, never touch
```
Paint: `outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px`, no radius. Animations: bg flash `rgba(255,255,255,.08)→0` (0.5s), `outline 12px→2px` (0.4s), `outline-color 0→.6` (0.4s), and a pulse `50% { opacity:.4 }` repeated 20 times over 1.2s after a 0.4s delay. Because animations override normal declarations, recolouring needs `!important` (or overriding `animation`). Adding `border-radius` makes the outline follow it. Pseudo-elements unused. `%{FocusRingHint}` (visibility hidden) is used by bar buttons, not settings.

### 4.14 Modal shell (settings dialogs)
Shots: `set_dlg_hostname.png`, `set_dlg_proxy.png`, `set_dlg_network.png`, `set_dlg_addgame.png`, `set_dlg_keyboards.png`, `set_dlg_pin.png`, `set_dlg_recquality.png`, `set_dlg_explainer.png`.

```
div %{GamepadDialogOverlay} GamepadMode FullModalOverlay        position abs (fixed in desktop), inset 0, z 1500
 div ModalOverlayContent ModalOverlayBackground                  rgba(0,0,0,.85) + backdrop-filter: blur(3px) (Steam's own), z 7
 div ModalOverlayContent active                                  z 10
  div G>ModalPosition G>WithStandardPadding G>VR [G>FooterVisible] Panel   abs; top var(--basicui-header-height); bottom var(--gamepadui-current-footer-height); overflow-y:auto (SCROLLS tall dialogs); padding 24px
   div G>ModalClickToDismiss Panel                               abs inset 0 (click outside = cancel)
   div %{*GamepadDialogContent_InnerWidth>GamepadDialogContent} DialogContent _DialogLayout GenericDialogBase GenericConfirmDialog [extra e.g. %{ActivateProductDialog}]  <- THE CARD
       background rgb(14,20,27); border 2px solid rgb(35,38,46); padding calc(12px+2.25vh) 2.8vw; width 660px; animation .5s (opacity 0->1, transform scale(1))
    div G>GamepadDialogContent_InnerWidth DialogContent_InnerWidth
     form role=dialog
      div DialogHeader                                           22px bold white
      div DialogBody > div DialogBodyText                        16px/20px rgb(220,222,223), margin-bottom 10px
      div DialogFooter                                           padding-top 16px
       div DialogTwoColLayout _DialogColLayout Panel > button.DialogButton ×2   (each ≤ 50%-14px, ≥200px)
```

The ModalOverlayBackground is a natural glass scrim. The card is the glass sheet: a `backdrop-filter` is fine here because it floats. Keep the card's `animation` untouched and don't set `transform` on it.

---

## 5. Per-page details and sub-screens

Notation: **[x]** = not clicked because it has side effects. **open** = opened, captured and closed (see `--pre`).

**System** (`/settings/system`; 3389px): Language dropdown; Updates: `%{SoftwareUpdateSection}` + Apply button [x] + "Update available" info row; Beta Participation: OS / Steam Client channel dropdowns; System Settings: 24-hour clock toggle, Timezone **rich dropdown**, Default to Desktop Mode toggle, Enable Developer Mode toggle (On); SteamOS Crash Report: 1 toggle plus 6 **disabled** toggle rows; About: Hostname button (opens the rename dialog), 8 info rows; SteamVR: 3 info rows; Steam: 4 info rows plus "Third-Party Licenses and Source Code" button (not opened); Hardware: 10 info rows; Advanced: Run Diagnostics [x], Create Report [x], Run (storage maintenance) [x], Factory Reset [x].
- Hostname dialog (open): route `/settings/system`, BODY `const b=findBtn('frame'); b.scrollIntoView({block:'center'}); fire(b); await sleep(1000); setTimeout(()=>dismiss(),2500); return M()`. Shot `set_dlg_hostname.png`. It contains a text input (auto-focused, white) plus Cancel / **Change & Restart [x]**.
- Timezone menu: §4.6, `set_dropdown_rich.png`.

**Internet** (`/settings/internet`): Enable Wi-Fi toggle; Connected Networks: clickable rows with `G>FieldIcon G>Front` (checkmark) and a description "Preferred connection"; Networks Found: clickable rows (lock icon, signal-strength svg on the right) plus "Other network…" row; Advanced: Enter Offline Mode [x], HTTP Proxy "Configure" (open), Delete Web Browser Data [x].
- Proxy dialog (open): BODY `const b=findBtn('Configure'); b.scrollIntoView({block:'center'}); fire(b); await sleep(1100); setTimeout(()=>dismiss(),2500); return M()`. Shot `set_dlg_proxy.png`: a Field+toggle (focused) and Continue (Primary, Disabled) / Cancel.
- Network details (open; view only. The activation opens an info modal and never connects): BODY `const f=L.qa('main','%{*GamepadDialogContent>Field}%{*GamepadDialogContent>Clickable}').find(e=>e.innerText.includes('Wired connection 1')); fiberHandler(f,'onActivate')(); await sleep(1200); setTimeout(()=>dismiss(),2500); return M()`. Shot `set_dlg_network.png`: header, `%{InfoDialogBody}`, **Disconnect [x]** (Primary, auto-focused, blue), info rows, `.DialogControlsSectionHeader`, OK footer. Closed via click-outside.
- "Other network…" (custom SSID or password form) was not opened.

**Storage** (`/settings/storage`): `%{ContentManagement} %{InPagedSettings}`. Drive tabs `%{HeaderPageControls>PageableContainer} %{PageableCarousel}` > `%{BoxCarousel>BoxCarouselContents} %{MaskRight} %{OnLastPage} role=tablist` (horizontal scroller with a Steam `::after` spacer) > `%{InstallFolder} [%{IsSelected}] role=tab` (pill r=40px in BasicUI; text `rgb(103,112,123)`; hover `rgb(61,68,80)`; selected `%{IsSelected}` `rgba(255,255,255,.15)` with white text, selected+hover `rgba(255,255,255,.2)`; `:focus` `#fff` with text `rgb(14,20,27)`. Only the already-selected tab was focused during mapping. Whether focusing the other tab switches the listed drive was not tested), inner `%{FolderInfo}` `%{DriveName}`/`%{DriveSize}`. Usage bar: `%{LibraryHeader}` > `%{DriveUsage}` > `%{DriveUsageIndicator}` (8px, r=10, striped `repeating-linear-gradient`) with `%{DriveUsageBar} %{DriveUsageGames|Workshop|Shader|Media|Other}` (fixed brand colours) and the legend `%{DriveUsageLabels}` > `%{AppUsageItem}` > `%{DriveUsageDot}` `%{DriveUsageText}` `%{DriveUsageNumber}`. App list: `%{ContentManagement>AppsGrid}` > sticky `%{AppHeader}` ("Items 17", `%{ContentManagement>Rule}`, sort dropdown) and `%{LibraryInventory}` > **`ReactVirtualized__Grid ReactVirtualized__List %{ContentManagement>AppList}` (VIRTUALIZED; inline `height:364px; overflow:auto; will-change:transform`)** > `ReactVirtualized__Grid__innerScrollContainer` > `%{AppBody} role=button` (inline `position:absolute; top; height:58px`) with a capsule (`%{LibraryItemBox}` … Library-area tokens), `%{AppBodyInfo}`, `%{ContentManagement>AppName}`, `%{AppInfoItem}`/`%{AppUsageValue}`, `%{AppSize}`. AppBody hover `rgba(255,255,255,.05)`, focus `rgb(61,68,80)` (`set_focus_storage.png`). **When an AppBody is focused, the footer offers UNINSTALL / MOVE CONTENT [x]. Never press A, X or Y there.** Selection mode (`%{AppSelected}` + checkboxes) was not reached because activating selects.

**Bluetooth** (`/settings/bluetooth`): Bluetooth toggle (with `G>FieldIcon`), Show all devices toggle; Paired: clickable device rows, where disconnected ones are `G>Disabled` with "Not connected"; Available to pair: header with spinner, clickable rows. **[x] for all device rows** (pair or connect).

**Display** (`/settings/display`): one dropdown "Maximum Game Resolution" with the description "Press [Y] for more info".
- Explainer modal (open): BODY `const f=L.q('main','%{*GamepadDialogContent>Field}'); fiberHandler(f,'onOptionsButton')(); await sleep(1200); setTimeout(()=>dismiss(),2500); return M()`. Shot `set_dlg_explainer.png` (`%{GameResolutionExplainer}`, `%{InlineIcon>ListHeader}`, ul/li, a single focused Primary "Close"). The same `onOptionsButton` mechanism serves every Field with an `explainer`.

**Power** (`/settings/power`): Battery Percentage toggle and 4 dropdowns (`set_dropdown_open.png` is the open menu).

**Audio** (`/settings/audio`): Output volume slider, Output Device dropdown, Spatialization toggle; Apps (empty text); Voice: mic slider, Input Device dropdown; General: UI sounds toggle, Reset [x].

**Controller** (`/settings/controller/:type/:controllerIndex`): `hideTitle`, so the `DialogHeader` sits inside the body. Connected Controllers: "Add Controller" [x] (starts pairing); Advanced Settings: "Show Advanced Settings" navigates to the sub-page.
- **Controller → Advanced** (`/settings/controller/advanced/:controllerIndex`, or BODY `fire(findBtn('Show Advanced Settings')); await sleep(1200); return L.route()` from Controller). Shot `set_controller_advanced.png`: header with `%{BackButtonContent>BackButton}`, Idle Gamepad Shutdown dropdown, Desktop Layout Edit (opens the controller configurator, another area, not opened) + `%{BuiltInLayoutButton}`, Firmware "Start" [x].

**Keyboard** (`/settings/keyboard`): theme dropdown + `%{ShowKeyboardButton}` (not pressed; it opens the keyboard surface), Points Shop button (navigates to the store, not pressed), Haptics and Initial Location dropdowns; Active Keyboards: Edit (open) + layout radio row; Quick Chat Options: 8 text inputs.
- Layouts dialog (open): BODY `fire(findBtn('Edit')); await sleep(1200); setTimeout(()=>dismiss(),2500); return M()`. Shot `set_dlg_keyboards.png`: a **tall card (1923px) that scrolls inside `G>ModalPosition`**, `%{ScrollPanel} %{ScrollY}` list of Field+toggle rows. Closed via click-outside.

**Accessibility** (`/settings/accessibility`): High Contrast Mode, Reduce Motion, Mono Audio toggles; Color Filter dropdown. (Steam's High Contrast mode drives the `@media (prefers-contrast: more)` rules quoted above, so the theme should keep a high-contrast path.)

**Security** (`/settings/security`): description-only Field (no label) plus a toggle.

**Notifications** (`/settings/notifications`): dropdown, toggle, 2 toggle-pair sections, radio group, 5 checkbox-matrix sections, Email opt-out toggle. See §4.9–4.10.

**Friends & Chat** (`/settings/friends`): toggles (the first row embeds `%{FakeFriend}`), Chat Filtering "Manage" (not opened; external web filter settings), Chat Font Size radio group.

**Downloads** (`/settings/downloads`): region dropdown, toggles, Game Updates section (`%{FakeContainer}` with text, link and dropdown), more toggles, a transfers dropdown. Toggling "Limit download speed" or "Schedule auto-updates" would reveal extra controls; not reachable without changing values.

**Cloud**, **In Game**, **Compatibility**, **Library**: plain Field rows (toggles, dropdowns, link in description, "Add game" button).
- Add game dialog (open, Library): BODY `fire(findBtn('Add game')); await sleep(1200); setTimeout(()=>dismiss(),2500); return M()`. Shot `set_dlg_addgame.png`: `%{ActivateProductDialog}`, `%{ActivateProductDialog>HeaderContainer}`, `%{InfoIconContainer}` (round 28px, `%{InfoIcon}`), `%{CodeInput}`, Confirm (disabled) / Cancel.

**Family** (`/settings/family`): text with link and `%{TrySteamFamiliesButtonContainer}` > Primary `%{TrySteamFamiliesButton}` [x] + `%{UserList>Placeholder}`.

**Remote Play** (`/settings/remoteplay`): toggle; Computers & Devices: host row with "Connect" [x] in `G>ControlsListOuterPanel`, "Pair Steam Link" [x] (starts host pairing); Connection Options: dropdown, "Set PIN" (open); Advanced host/client toggles; Wireless Streaming Adapter: toggle, dropdown, Unpair [x], host row with **disabled "Connected"** button, toggle; Learn More "View FAQ" (opens the web, not pressed).
- Set PIN dialog (open): BODY `fire(findBtn('Set PIN')); await sleep(1200); setTimeout(()=>dismiss(),2500); return M()`. Shot `set_dlg_pin.png` (`%{SegmentedInput>DialogBodyText}`, `.DialogInputLabelGroup`, `.DialogLabel`, input, Confirm/Cancel).

**Game Recording** (`/settings/gamerecording`): radio cards (§4.11), View FAQ, "Shortcut Keys" (empty section header), Recording Quality button (open), 2 dropdowns, Record Microphone toggle, disabled "Record Audio from…" row and dropdown.
- Quality dialog (open): BODY `fire(findBtn('High')); await sleep(1200); setTimeout(()=>dismiss(),2500); return M()`. Shot `set_dlg_recquality.png`: `%{BitRateSettingsModal} %{GameRecordingModal}`, `%{BitrateSetting>Header}`, a focused full-width dropdown with `%{BitrateOption}` + `%{BitrateSetting>Emphasis}`, `%{AutoExplainer}`, a `table %{BitRateTable}` (`rgba(0,0,0,.2)`, r=2), `%{ModalButtonRow}` Confirm/Cancel. (The card has no `GenericConfirmDialog`, and role=dialog sits on the card itself.)

**Home** (`/settings/home`): toggles, hidden-games row whose "Manage" navigates to the Library hidden collection (Library area, not opened), instructions row.

**Store** (`/settings/store`): 7 rows with "Manage" buttons that open store preference web pages (Store area, not opened).

**Developer** (`/settings/developer`, 2499px): toggles, dropdowns, buttons. Pair new host [x], Speaker Test [x], Re-arm Mura [x], Format SD [x], Clear All [x], Steam Console Open [x], Change User Password [x], Update all devices [x]. Visually nothing new beyond the primitives.

---

## 6. Steam's own pseudo-elements (theme must not reuse these)

| Element | Pseudo | What Steam draws |
|---|---|---|
| `G>ToggleRail` (and copies) | `::before` | Blue on-fill, positioned with `transform: translateX(-27px | -11px)` |
| `G>Toggle.gpfocus` | `::after` | Grey focus halo pill behind the toggle (`z-index:-1`) |
| `S>SliderTrack` | `::before` | Blue value fill (geometry from CSS vars) |
| `%{Group>Button}` (2nd+ inactive) | `::before` | 1px divider between segments |
| `%{BoxCarousel>BoxCarouselContents}%{MaskRight}` | `::after` | Flex spacer (Storage drive tabs) |
| `%{Profile>Header}` (shared) | `::before` | `rgba(0,0,0,.5)` header backing |
| `G>Field G>Classic …Separator` | `::after` | Separator line, **Classic only**, so free in VR settings |
| `button.DialogButton` (desktop) | `::before` | Hover shadow; set to `content:none` for gamepad `G>Button`, so free |
| `.DialogDropDown_CurrentDisplay:empty` | `::before` | `" "` placeholder |
| `S>EditableValue` | `::placeholder` | opacity .5 |
| `G>BasicTextInput` | `::placeholder` | italic `rgb(103,112,123)` |

Free (verified `content: none`): nav items, `G>Field` (non-Classic), `G>FieldLabel/Description`, DialogButton (gamepad), DropDownControlButton, `.DialogCheckbox`, `.RadioButton` (first one), headers, `%{FocusRing}`, `S>SliderHandle`, context-menu items.

## 7. Inline styles, transforms and animations a theme must not touch

- `G>Field`: inline `--indent-level`; CSS `transform: scale(1) rotateX(0)` with a transform transition; focus animation (`forwards`, animates background and color). Override the focused background with `!important`.
- Nav: `P>…PageListItem` transform and transition; `%{ScaledChildren}` `transform: scale(1.1)` when Active or focused (`will-change: transform`).
- Page transition: `%{PagedSettingsDialog>ContentTransition}` + Enter/EnterActive/Exit/ExitActive (translateY and opacity). Route-level `%{TopLevelTransition}` (shared).
- Toggle: `G>ToggleSwitch` `transform: translateX(16px)` when On; `G>ToggleRail::before` translateX; `G>Toggle:dir(rtl)` `scale:-1 1`.
- Slider: inline `--normalized-slider-value`, `--normalized-slider-origin` and `--slider-extra-notch-padding` on `S>SliderControlAndNotches`; `S>SliderHandleContainer` `transform: translateX(calc(...))`; handle focus pop animation (`scale(1.4)`).
- `%{FocusRing}` inline `left/top/width/height` plus 4 animations.
- Modal card and context menu container: entrance `animation` (opacity, `transform: scale(1)`).
- Storage: react-virtualized inline styles on `%{ContentManagement>AppList}` and every `%{AppBody}` (`position:absolute; top:Npx; height:58px`).
- `%{BasicUiRoot}` inline `--basicui-header-height` and `--gamepadui-current-footer-height` (used by padding calcs everywhere).
- `%{Profile>Header}` inline `--gamepadui-header-opacity` vars; `%{OverflowHidden>GamepadPage}` inline `--gamepad-page-content-max-width`.
- `%{SoftwareUpdateSection} svg` transform (icon nudge).

## 8. Scroll and virtualization containers

| Container | Axis | Notes |
|---|---|---|
| `P>PagedSettingsDialog_PageContent` | y | Every page. `scroll-padding: 250px 0 60px`; Fields scroll into view on focus (`scroll-margin 20px 0 55px`) |
| `P>PagedSettingsDialog_PageList` | y | Nav list, `scroll-snap-type: y mandatory`, `scroll-padding 36px 0` |
| `C>contextMenuContents` | y | Open dropdown menus (scrollbar hidden; timezone 5065px) |
| `G>ModalPosition` | y | Tall dialogs (keyboard layouts) |
| `%{ScrollPanel} %{ScrollY}` | y | List inside the keyboard layouts dialog |
| `%{BoxCarousel>BoxCarouselContents}` | x | Storage drive tabs |
| `%{ContentManagement>AppList}` (`ReactVirtualized__Grid`) | y, **virtualized** | Storage app rows are recycled: only visible rows exist in the DOM |
| `%{CheckboxHeaders}` | sticky | Notifications column headers, `%{Scrolling}` class toggled while scrolling |
| `%{ContentManagement>AppsGrid} %{AppHeader}` | sticky | Storage "Items" header |

## 9. Not reached and why

- **Values never changed.** Toggles, sliders, dropdown choices, radio cards, segmented radios and checkboxes were inspected only as stored. Dropdown values on System, Power, Display, Keyboard and Game Recording plus the toggle counts were re-verified unchanged at the end.
- Expanded states that need a value change: Downloads "Limit download speed" (bandwidth input) and "Schedule auto-updates" (time pickers); Remote Play advanced host and client options; Bluetooth "Show all devices"; Proxy dialog fields after enabling; Storage multi-select mode (`%{AppSelected}`).
- Side-effect buttons (marked [x] in §5): Apply update, Offline Mode, Delete browser data, Reset audio, Add Controller, Pair Steam Link, Connect, Unpair, Factory Reset, Run Diagnostics, Create Report, storage maintenance, Developer actions, controller firmware, Bluetooth device rows, Family create/join.
- Navigations into other areas: Points Shop, Store "Manage" pages, Home "Manage" hidden games (Library collection), Controller Desktop Layout "Edit" (controller configurator), Friends "Chat Filtering Manage", "View FAQ", "Third-Party Licenses", Show Keyboard (keyboard surface).
- Not opened but likely similar to captured dialogs: "Other network…" (SSID/password form), Language dropdown (long plain list, same as §4.6), Keyboard theme, Color Filter and other dropdowns (same menu primitive).
- Hidden settings pages (Account, Customization, Interface, Music, Broadcast, Voice, In-Game Voice, Internal, Desktop Security) are not shown in this build and their routes fall back to System.
- `:hover` paints were not captured live (synthetic events don't trigger `:hover`). They are documented from Steam's CSS rules instead.
- Notched sliders with value boxes (`S>SliderNotch*`, `S>EditableValue`) do not appear on any settings page. Their rules are documented for the shared stylesheet. They do appear in Quick Access and in-game overlay tabs.
