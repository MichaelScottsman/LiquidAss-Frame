# Inventory: area `shell` (surface `main`: the window chrome around every route)

Mapped live on the Frame on 2026-10-06 with the theme **off**. Every shot is 1.5x (1920x1080) and lives at `shots/shell_*_before.png`. Tokens are copied from `python glass.py outline`. Steam's CSS is quoted from the live stylesheets of the `main` document, with hashes replaced by tokens. The client is Steam build `11041156` (the constant every webpack module carries) on Chrome 126.

Scope: the root layers of the `main` window, the page background, the header (Back and search), the search route, the in-window footer legend, the modal layer (scrim and dialogs), the generic gamepad context menu (including the power menu), page transitions, focus rendering and global CSS variables. The VR main menu is drawn in `frame.menu`, and `bar.md` §3 maps it in detail. This file covers only how the main menu is opened.

---

## 0. How to reproduce (read first)

### 0.1 Driver notes

- **Git Bash rewrites routes.** MSYS turns `--route /library/home` into `C:/Program Files/Git/library/home`. Steam then navigates relative to the current route and lands on junk such as `/library/tab/C:/Program Files/Git/apprunning`. Run every command with `export MSYS_NO_PATHCONV=1`. Navigating inside `--pre` (`L.nav('/x')`) is unaffected.
- **Windows console encoding.** Output that contains smart quotes crashes `glass.py` while it prints, before the PNG is downloaded. Set `export PYTHONIOENCODING=utf-8`.
- **Other agents leave menus open.** Modals and context menus live in the `main` window, whatever the route, so another agent's open menu shows up in your shot. Every `--pre` below starts by waiting for the modal stack to be empty:
  ```js
  const MM=SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.ModalManager; for(let i=0;i<40&&MM.m_rgModals.length;i++) await new Promise(r=>setTimeout(r,250));
  ```
- **Multi-line `--pre`.** Write the JS to a file and pass `--pre "$(cat file.js)"`. All snippets below were run that way.
- **Synthetic, side-effect-free dialogs and menus.** These are rendered with Steam's own components through webpack, so they use exactly the production DOM and CSS:
  ```js
  let req; webpackChunksteamui.push([[Symbol()],{},r=>req=r]);
  // module ids (build 11041156; if they move, search req.m sources for the loc token / export)
  //  62540 jsx runtime (J.jsx)          30583 ConfirmModal = .o0
  //  12302 showModal = .pg(el, window)  12711 Menu .tz, MenuItem .kt, SubMenu .Vs, CheckItem .IK, Separator .K5
  //  377 showContextMenu = .lX(menuEl, anchorEl, {})   79100 power menu = .d4(anchorEl, onCancel, false)
  //  4399 universal search text store = .U (SetSearchText / GetSearchText)
  ```
  Each snippet closes what it opened with a `setTimeout` that fires about 1 s after the capture, while the lock is still held or just released. Modals close with `inst.Close()` or `MM.RemoveModal(entry)`, which is exactly what Close does. Menus close with `inst.Hide()`. The modal count was verified to be 0 after every run.

### 0.2 Snippets (all tested verbatim; `WAIT` = the wait line above)

| id | `--pre` body |
|---|---|
| HOME | `(async()=>{ WAIT L.nav('/library/home'); await new Promise(r=>setTimeout(r,1500)); return L.route()})()` |
| FOOTER | the same with `/library/tab/AllGames` (route with 5 legends) |
| TITLE | `(async()=>{L.nav('/controller/calibration/0'); await new Promise(r=>setTimeout(r,1800)); return L.outline('main',{sel:'#header',max:20})})()` |
| SEARCH(q, tab) | `(async()=>{ WAIT let req; webpackChunksteamui.push([[Symbol()],{},r=>req=r]); const U=req(4399).U; U.SetSearchText(q); L.nav('/search/tab/'+tab); await new Promise(r=>setTimeout(r,2500)); setTimeout(()=>U.SetSearchText(''),4500); return L.route()})()`. Used `q='half'` with tab `All`, then `''`, `'zzqxjvkw'`, `'a'` (Friends) and `'half'` (Store). For VIEW MORE add `const sc=L.q('main','%{TabContentsScroll}'); sc.scrollTop=sc.scrollHeight;` and wait 900 ms |
| CONFIRM | `(async()=>{ WAIT L.nav('/library/home'); await new Promise(r=>setTimeout(r,1200)); let req; webpackChunksteamui.push([[Symbol()],{},r=>req=r]); const J=req(62540),D=req(30583),M=req(12302); const inst=await M.pg(J.jsx(D.o0,{strTitle:'Glass Shell lab dialog',strDescription:'Mapping the dialog chrome. This dialog performs no action.',strOKButtonText:'OK',strCancelButtonText:'Cancel',onOK:()=>{},onCancel:()=>{}}), L.surface('main')); setTimeout(()=>inst.Close(),4500); await new Promise(r=>setTimeout(r,800)); return 1})()` |
| ALERT | CONFIRM with `strOKButtonText:'Close', bAlertDialog:true` and no Cancel text |
| MENU | `(async()=>{ WAIT L.nav('/library/home'); await new Promise(r=>setTimeout(r,1200)); let req; webpackChunksteamui.push([[Symbol()],{},r=>req=r]); const J=req(62540),Mn=req(12711),CM=req(377),n=()=>{}; const items=[J.jsx(Mn.kt,{onSelected:n,children:'Lab item (focused)'},'a'),J.jsx(Mn.kt,{onSelected:n,selected:true,children:'Selected item'},'b'),J.jsx(Mn.Vs,{label:'Submenu',children:[J.jsx(Mn.kt,{onSelected:n,children:'Sub item one'},'s1'),J.jsx(Mn.kt,{onSelected:n,children:'Sub item two'},'s2')]},'sub'),J.jsx(Mn.IK,{onSelected:n,bChecked:true,children:'Checked item'},'c'),J.jsx(Mn.K5,{},'sep'),J.jsx(Mn.kt,{onSelected:n,tone:'positive',children:'Positive tone'},'p'),J.jsx(Mn.kt,{onSelected:n,tone:'emphasis',children:'Emphasis tone'},'e'),J.jsx(Mn.kt,{onSelected:n,tone:'destructive',children:'Destructive tone'},'d'),J.jsx(Mn.kt,{onSelected:n,disabled:true,children:'Disabled item'},'x')]; const inst=CM.lX(J.jsx(Mn.tz,{label:'Lab context menu',children:items}), L.q('main','%{SearchAndTitleContainer}'), {}); setTimeout(()=>inst.Hide(),4500); await new Promise(r=>setTimeout(r,1100)); return 1})()` |
| SUBMENU | MENU, then `L.click('main','%{*BasicContextMenuModal>SubMenu}'); await new Promise(r=>setTimeout(r,700));`, with the close at 5500 ms |
| POWER | `(async()=>{ WAIT let req; webpackChunksteamui.push([[Symbol()],{},r=>req=r]); const before=MM.m_rgModals.length; const inst=req(79100).d4(L.surface('main').document.documentElement,()=>{},false); setTimeout(()=>{try{inst.Hide()}catch(e){} for(const m of MM.m_rgModals.slice(before).reverse()) MM.RemoveModal(m)},3800); await new Promise(r=>setTimeout(r,900)); return 1})()`, run with `--settle 0.8`. **Look only. Every item is a power or session action.** |
| ZOO(label) | `(async()=>{ WAIT L.nav('/zoo/modals'); await new Promise(r=>setTimeout(r,1600)); const w=L.surface('main'),d=w.document; const b=[...d.querySelectorAll('button,.DialogButton,[role=button]')].find(e=>e.textContent.trim()===LABEL); b.scrollIntoView({block:'nearest'}); const r=b.getBoundingClientRect(),o={bubbles:true,cancelable:true,view:w,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; const before=MM.m_rgModals.length; for(const t of ['pointerdown','mousedown','pointerup','mouseup','click']){const E=t.startsWith('pointer')?w.PointerEvent:w.MouseEvent; b.dispatchEvent(new E(t,Object.assign({pointerType:'mouse',isPrimary:true},o)))} await new Promise(r=>setTimeout(r,900)); const added=MM.m_rgModals.slice(before); setTimeout(()=>{for(const m of added.reverse()) MM.RemoveModal(m)},4000); return added.length})()`. `/zoo` is Steam's own component zoo: demo modals with no-op handlers |

### 0.3 Before-shots

| file | surface | how | shows |
|---|---|---|---|
| `shell_library_home_before.png` | main | HOME | window chrome with header (`%{OverrideHeaderBackground}`, bg opacity 1), page gradient, **no footer** (Home hides it) |
| `shell_footer_legend_before.png` | main | FOOTER | footer legend with 5 actions; header bg opacity **0**, because the tab row acts as the header background |
| `shell_header_title_before.png` | main | TITLE | header in **title mode** (`%{ShowingTitle}`), an empty page over the bare window gradient, footer with Back only |
| `shell_search_results_before.png` | main | SEARCH('half','All') | search route: grey filled search field, result grid |
| `shell_search_empty_before.png` | main | SEARCH('','All') | search route with empty query (whole library listed), placeholder in the filled field |
| `shell_search_noresults_before.png` | main | SEARCH('zzqxjvkw','All') | `%{NoResultsFound}` |
| `shell_search_friends_before.png` | main | SEARCH('a','Friends') | friend result tiles (profile background + avatar) |
| `shell_search_store_before.png` | main | SEARCH('half','Store') | store result tiles |
| `shell_search_viewmore_before.png` | main | SEARCH('half','All') + scroll to bottom | "View more in the Store" tile; pinned tab row with its `::before` backdrop |
| `shell_modal_confirm_before.png` | main | CONFIRM | scrim + GenericConfirmDialog (Primary focused) |
| `shell_modal_alert_before.png` | main | ALERT | single full-width Primary button |
| `shell_modal_textprompt_before.png` | main | ZOO('Text Prompt') | dialog with focused text input (white) |
| `shell_modal_scrollpanel_before.png` | main | ZOO('Scroll Panel Test') | full-size scrolling dialog plus the **`%{FocusRing}`** outline |
| `shell_modal_noninteractive_before.png` | main | ZOO('Non-Interactive Dialog') | dialog with no buttons; ModalPosition itself takes `.gpfocus` |
| `shell_contextmenu_before.png` | main | MENU | context menu with every item state |
| `shell_contextmenu_submenu_before.png` | main | SUBMENU | submenu open: parent `%{*BasicContextMenuModal>active}`, sibling `%{*BasicContextMenuModal>Selected}` |
| `shell_contextmenu_long_before.png` | main | ZOO('Longboi (long title)') | long title and long list |
| `shell_powermenu_before.png` | main | POWER | real power menu: Destructive items, red focused item |
| `shell_vr_mainmenu_before.png` / `shell_vr_mainmenu_collapsed_before.png` | frame.menu | `shot frame.menu NAME --theme off` | VR main menu expanded and collapsed (see `bar.md` §3) |
| `shell_zoo_modals.png` | main | `L.nav('/zoo/modals')` | the zoo's modal test page (test bench, not product UI) |

---

## 1. Root layer stack of `main`

Live DOM, with the CSS that paints each layer today:

```
html.%{SteamUIPopupHTML}                                   no background (transparent overlay)
 body.%{*PopupBody} .GamepadMode .BasicUI .%{SteamUIPopupWindowBody} .%{GamepadUIPopupWindowBody} .LowPerfMode .WindowFocus
   │  overflow:hidden; user-select:none; ::-webkit-scrollbar {display:none} for every descendant; no bg
   └ div#popup_target.%{SteamUIPopupWindow}               100%x100%, no paint
      └ div.%{Root}.noOpinionatedGlobalStyles             0x0 wrapper
         └ div[data-accent-color=blue][data-dull-color=greyneutral][data-body-text-color=text-light]
             style="--color-success-1..12, --color-warning-*, --color-error-*, --color-text-success-*…" (inline; see §10)
            └ div.BasicUI.GamepadMode.%{BasicUiRoot}.%{SteamUIPopupHTML>VR}.MediumWindow.WideWindow
                 style="--basicui-header-height: 40px; --gamepadui-current-footer-height: 42px;"   ← inline, Steam-owned
                 position:absolute; z-index:5; overflow:hidden; **border-radius:6px** (the window's rounded corners); no bg
               └ div#MainNavMenu-Rest.%{MainNavMenuMainSplit}   flex column, 100% height, no paint
                  ├ div#GamepadUI_VR_Full_Root.%{BasicHome}.%{OpaqueBackground}   ← THE WINDOW BACKGROUND (§2); position:relative; flex column
                  │   ├ div.%{GamepadDialogOverlay}.GamepadMode.FullModalOverlay   modal layer (§6). style="display:none" when idle
                  │   ├ div#header.%{Profile>Header} …                             header bar (§3), abs, z 6000
                  │   ├ div.%{FocusRingRoot}                                       0x0, abs, z 10000, pointer-events none (§9)
                  │   └ div#Main.%{PopupBody>Content}.Panel.Focusable              route content (flex:1)
                  │       └ div.%{PartnerEventOverlayContainer>AppDetailsMain}     position:relative; opacity transitions (§8)
                  │           ├ div.%{TopLevelTransitionSwitch}                    abs inset 0
                  │           │   └ div.%{ContentWrapper}.%{TopLevelTransition}[.%{NoTransitionZoom}][.%{TopLevelTransitionSwitch>Enter}.%{…>EnterActive}]
                  │           │       └ div.%{AbsoluteDiv}                          abs inset 0, flex column
                  │           │           └ <page root>  e.g. %{GamepadLibrary}, %{GamepadSearch}, %{OverflowHidden>GamepadPage}%{DialogBackground}, .BasicUI %{DownloadsPage}
                  │           └ div.%{PartnerEventOverlayContainer}                abs inset 0, z 10, pointer-events none
                  │               └ div.%{Container>TransitionWrapper}             app-details scrim: bg rgba(16,16,16,.75) (LowPerfMode), opacity 0 idle (§8)
                  └ div#Footer.%{BasicFooter}                                       footer legend (§5), abs bottom, z 7000. Absent when hidden
```

Notes:
- Body classes are state. `LowPerfMode` is always on for the Frame and switches some rules, for example the TransitionWrapper colour. `WindowFocus` toggles with window focus. `MediumWindow WideWindow` on `%{BasicUiRoot}` are size breakpoints. None of these may be removed or overridden.
- Outside `%{BasicUiRoot}` nothing paints, so the corners outside the 6px radius are transparent and show passthrough or the game.
- In VR there are no side-menu siblings in `%{MainNavMenuMainSplit}`. In desktop gamepad mode, `P9` would render the main menu and Quick Access side panels here. In VR, `P9` instead portals `VRMainNavMenuContainer` into the `frame.menu` popup (§4).
- `MouseHoverBlockerHack`: when the nav source is not the mouse, Steam can insert `div#MouseHoverBlockerHack` (1x1, inline `position:absolute; pointer-events:all`) inside an inline `contain:layout` wrapper. It was not present during mapping. Never style it.

---

## 2. Window background (what is behind every page)

- **The base layer is `%{BasicHome}`.** It has exactly one of three variants, chosen by route in source module 46307 (`F9`):
  - `%{BasicHome}%{OpaqueBackground}` is the default for all normal routes. It paints `background: radial-gradient(155.42% 100% at 0% 0%, #060a0e 0, #060a0e 0%, #0e141b 100%)`. Under `@media (prefers-contrast: more)` it paints `#000`.
  - `%{BasicHome}%{PopupBody>TransparentBackground}` paints `rgba(0,0,0,0)`. It is used on overlay paths: `/apprunning`, `/keyboard`, `/app/:id/overlay`, `/gameapiosk`, controller mouse-position, `/colorsettings`, `/steamweb`, `/externalweb` and `/microtxnauth` (`SteamUIStore.BIsTransparentBackgroundPath`).
  - `%{BasicHome}%{TrueBlackBackground}` paints `#000`. It is used on `/app/:id/controllerconfigurator` (except Choose Configuration), `/colorsettings` and `/chat`.
  - `%{BasicUiRoot}%{PopupBody>BlackBackground}` paints `#000`. It was not seen.
- **Page roots repaint the same gradient.** Clearing the `%{BasicHome}` gradient alone will **not** make the window glass, because these page roots paint over it:
  - `%{GamepadLibrary}` and `%{GamepadSearch}` paint the same radial gradient #060a0e→#0e141b.
  - `.BasicUI %{DownloadsPage}` and `%{OverflowHidden>GamepadPage}%{DialogBackground}` paint the same gradient. The second is the root of settings-style paged pages and `/zoo`.
  - `%{ContentManagement}:not(%{InPagedSettings})` paints a gradient from #23262e to #0e141b.
  - `%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog}` paints solid #0e141b, and other solid #0e141b page surfaces exist. The library, settings and downloads areas own these.
- **Background art.** The shell draws none. Game pages and Home draw their own hero art inside the page (library and game areas).
- `%{GamepadSearch}` also sets `padding-top: var(--basicui-header-height)` so its content clears the header.

---

## 3. Header bar `#header` (Back and search, or title)

Source: module 62678. In VR the header component is `pe` (memo) wrapped by `Xt`.

### 3.1 Structure (`outline main --sel '#header'`)

```
div#header.%{Profile>Header}.GamepadMode[.%{OverrideHeaderBackground}][.%{HeaderOpaque}][.%{SuppressInteraction}][.%{FadeBackgroundOpacity}].FlexGrowUniversalSearch.Panel.Focusable   [0,0 1280x40]
   style="--gamepadui-header-opacity: 1; --gamepadui-header-background-opacity: 1|0;"   ← inline, Steam-owned state
 ├ div.%{OverridesInteractionSuppression}.%{BackContainer}        [0,0 108x40]   Back (mouse/laser only; NOT .Focusable)
 │   ├ svg.%{IbexDiagramFrontPanelTransparencyEffect>FlipInRTL}.%{ArrowBack}   24x24 at x 20
 │   └ span.%{BackContainer>BackButton} "Back"
 └ div.%{SearchAndTitleContainer}.%{ShowingSearch}.%{ForceExpanded}.%{SearchAndTitleContainer>VR}.Panel.Focusable   [108,0 1172x40]
     ├ div.%{SearchFieldBackground}[.%{WhiteBackground}]          abs inset 0: the field fill
     ├ svg.%{SearchIconLeft}[.%{WhiteBackground}]                 18x18
     ├ input[type=search].%{SearchBox}.%{SearchAndTitleContainer>Visible}[.%{WhiteBackground}].Focusable   placeholder "Search for games or profiles..."
     └ svg.%{SearchIconRight}[.%{WhiteBackground}]                opacity 0 while expanded
   Title mode instead: div.%{SearchAndTitleContainer}.%{ShowingTitle}.%{ForceExpanded}.%{SearchAndTitleContainer>VR}
     └ div (no class) "Calibration & Advanced Settings"            select it as `%{SearchAndTitleContainer}%{ShowingTitle} > div`
   Browser mode (a Steam web view is current): div.%{HeaderBrowser} with the URL bar replaces the search, and the Back container is removed
   Account alert (only with active support alerts): div#header_profile.%{HeaderItem}.%{Profile>Clickable} with %{Profile>HasActiveSupportAlert}, %{Profile>CurrentUserAvatar}
```

### 3.2 What paints, today

| element | paint | source rule |
|---|---|---|
| `%{Profile>Header}` | no own background. `opacity: var(--gamepadui-header-opacity)`, `z-index: 6000`, `pointer-events: none` (children `initial`), `transform-style: preserve-3d`, text #fff | |
| `%{Profile>Header}::before` (**Steam-owned**) | `content:""; position:absolute; inset 0 (height 100%); background-color: rgba(0,0,0,.5); backdrop-filter: blur(100px); z-index:-1; opacity: var(--gamepadui-header-background-opacity)`. Under prefers-contrast it is `#000`, opacity 1 | this **is** the header bar |
| `.%{OverrideHeaderBackground}.gpfocuswithin::before` | same values, with `transition-delay: 0s` | routes `/library/home`, `/apprunning`, `/colorsettings`, `/login`, `/createaccount`, `/account`, `/settings*`, `/media/item` |
| `.%{FadeBackgroundOpacity}::before` | `transition: background-color .1s .1s, opacity .2s` | |
| `.%{HeaderOpaque}` | `background-color: #000; backdrop-filter: none` | `/apprunning`, `/steamweb`, `/externalweb`, `/microtxnauth`. In VR the header is not rendered on `/apprunning` |
| `.%{InQuickAccess}` | `background: #0e141b; position: initial` | not used in VR |
| `%{BackContainer}` | colour #8b929a, **`:hover` #fff**, no bg | |
| `%{BackContainer}:not(:last-child)::after` (**Steam-owned**) | 1px x 2em divider, `background: #23262e`, `right: 0` | |
| `%{BackContainer>BackButton}` | padding 0 20px 0 8px, 16px Motiva | |
| `%{SearchAndTitleContainer}` | `background: transparent`, `overflow: hidden`, `transition: background-color 50ms`, weight 500, colour #0e141b while ForceExpanded. The non-VR `:hover` rgba(255,255,255,.3) is excluded in VR | |
| `%{SearchFieldBackground}` | **transparent** when idle. With `%{WhiteBackground}`: `#fff`, or **`#b8bcbf`** when `%{ForceExpanded}:not(.gpfocuswithin)` (the grey field in the search shots). `transform: scaleX(0→1)` with `transform-origin: 101% 50%` is **Steam-animated** | |
| `%{SearchIconLeft}` | VR colour #8b929a. `translateX(20px→5px)` and opacity are animated. With `%{WhiteBackground}` it is #000 | |
| `%{SearchIconRight}` | opacity 0 and `translateX(-18px)` while expanded (always, in VR) | |
| `%{SearchBox}` (input) | transparent, no border, 16px. Text **#0e141b**, caret #000 while ForceExpanded. `::placeholder` #8b929a italic, with opacity and translateX animated | |
| `input::-webkit-search-cancel-button` | the clear (x) button: 26px **black** circle with a white X svg, `:hover` #3d4450, `:active` #23262e | shown when text is present |
| VR hover | `.%{ShowingSearch}.%{SearchAndTitleContainer>VR}:hover` makes the svgs and placeholder #fff, unless `%{WhiteBackground}` | |
| Title text | inherits #fff and weight 500. `.FlexGrowUniversalSearch .%{ShowingTitle}` sets `padding-left: 2.8vw` | |
| `%{HeaderItem}` (alert/avatar) | padding 0 15px (VR), #fff. `.gpfocus` / `.gpfocuswithin`: **bg #fff, colour #000**. `%{Profile>Clickable}:hover` rgba(255,255,255,.3) | |

### 3.3 States and when they occur

- **Search idle:** you are not on `/search` and there is no text. The field is transparent: icon, then placeholder, on the header glass. Seen in `shell_library_home_before`.
- **Search filled (`%{WhiteBackground}`):** applies when focused, when text is present, or on any `/search…` route. Unfocused it paints the grey #b8bcbf field with dark text. Seen in `shell_search_*`.
- **Search focused:** the gamepad focus is in the field (`.gpfocuswithin` on the container, `.gpfocus` on the input). It paints a #fff field with dark text. Not captured: focusing calls `onKeyboardShow` (it navigates to `/search/tab/All` and raises the VR keyboard surface). The state comes from CSS.
- **Header background opacity:** forced to 1 in VR, except on routes whose tabbed page is the header background (`m_nNumTabbedPagesActingAsHeaderBackground>0`, e.g. `/library/tab/*`, `/search/*`). There the inline var is **0**, the `::before` is invisible, and the page's pinned tab row (`%{TabHeaderRowWrapper}` with its own `::before`) supplies the backdrop. Compare `shell_footer_legend_before` with `shell_library_home_before`.
- **Header hidden (not rendered):** in VR on `/apprunning`, `/keyboard`, `/gameapiosk`, `/oobe*`, on the lock screen and during Frame tutorial videos (`Tr` list), unless `HeaderStore.BShowHeader()` forces it on.
- **Title mode:** pages that call `useHeaderTitle`. In VR these are the controller calibration, controller device support, controller configurator choose-configuration and captive portal pages. Example: `/controller/calibration/0`.
- **Modal open:** the header stays **above** the modal scrim (z 6000 against the overlay's z 1500), so it is never dimmed. A modal's `ModalPosition` starts at `top: var(--basicui-header-height)`.

### 3.4 Do not touch

The inline `--gamepadui-header-opacity` and `--gamepadui-header-background-opacity` (scroll and route driven). `opacity` on `#header`. The transforms on `%{SearchFieldBackground}`, the search icons and `::placeholder`. `overflow: hidden` on `%{SearchAndTitleContainer}`. `pointer-events` on the header. To restyle the bar itself, restyle `%{Profile>Header}::before` and keep its `opacity: var(--gamepadui-header-background-opacity)`.

---

## 4. Main menu and side menus in VR

- **There are no side menus inside `main` in VR.** `MenuStore.OpenSideMenu(e)` returns immediately when `IsAnyVRWindow()`. `m_eOpenSideMenu` stays 0.
- **Main menu:** `MenuStore.OpenMainMenu()` calls `VRFrameStore.frames.find(...).FocusLeftFrameMenu()`. The main menu is `VRMainNavMenuContainer`, portaled by the main window into the **`frame.menu.<id>`** popup to the left of the window (`origin_on_parent {x:-1}`, `only_visible_with_laser`).
  - Tokens: `%{PopupRoot} > %{PopupContent}%{PopupBody>AlignRight}%{AlignCenterY} > div > %{DashboardMenu}%{Variant_FrameMenu}[%{DashboardMenu>Collapsed}] > %{DashboardMenu>ItemOuter} > %{DashboardMenu>Item}[%{DashboardMenu>Active}] > %{DashboardMenu>ItemIcon} + %{DashboardMenu>ItemLabel} > %{Marquee>Container} > %{Marquee>Content}`, with `%{SectionGap}` before Power.
  - Items: Home, Library, Store, Friends & Chat, Media, Downloads, Steam Settings, VR Settings, gap, Power.
  - Paint: `--menu-background: #0e141b` (a custom property on `%{DashboardMenu}`, which is a good lever). Radius 6 on the first and last item of each group. Inactive text and icons #8b929a. Active item `scale(1.1) rotateX(1deg)` with a blue #1a9fff `%{DashboardMenu>ActiveDot}` (inline `width:10px;height:50%`). `.gpfocus` runs a fill-forwards background animation (§9).
  - Collapsed (54px wide, labels `display:none`) until laser hover or focus. See `shell_vr_mainmenu_collapsed_before`.
  - **Full detail, including the hover-expand snippet, is in `bar.md` §3. That agent owns the `frame.menu` surface.**
- **Power menu:** the **Power** item calls `SteamUIStore.OpenPowerMenu(el)`, which calls `79100.d4`, which calls `showContextMenu`. It therefore renders **in `main`** as a standard gamepad context menu (§7):
  - header "Power"
  - items Sleep, Shutdown (Destructive), Restart Device (Destructive), **Restart Steam VR** (Destructive, preferred focus)
  - separator
  - Change Account, Sign Out, Restart Steam (all Destructive)
  - separator, Cancel
  - See `shell_powermenu_before`. Selecting an item opens a confirm modal. **Never select.**
- **Quick Access** (`OpenQuickAccessMenu` / `ToggleSideMenu(QuickAccess)`) is a `barpopup` panel in VR. See `bar.md` §2.4.
- **B button at the root:** `onCancelButton` on `#GamepadUI_VR_Full_Root` calls `OpenMainMenu`, which focuses the frame menu.
- When a modal opens in the VR main window, Steam closes every dashboard-bar popup (`VRDashboardBarPopups.forEach(p => p.closePopup())`, module 46307 `W9`).

---

## 5. Footer legend `#Footer` (in-window button legend)

```
div#Footer.%{BasicFooter}[.%{WithKeyboard}][.%{QuickAccessFooter}][.%{PopupBody>Opaque}][.%{Relative}]   [0,678 1280x42]
 └ div.%{FooterLegend}                                    flex-wrap, justify-content flex-end, overflow hidden
    └ div.%{ActionButtonLegend}  ×N                        clickable (dispatches the action), padding 5px 8px, r 6
       ├ div.%{ActionButtonLegend>ActionButtonGlyph}
       │   └ img.%{FooterGlyphSize}  aria="A Button"|"B Button"|"X Button"|"Y Button"|"Menu Button" (Menu also has %{ControlsListSection>PillShapedIcon})   25px tall raster glyphs
       └ div.%{ActionButtonLabel} "Select" | "Back" | "Options" | "Sort By" | div.%{CompatFooterDescription} "Filter" …
```

| element | paint today |
|---|---|
| `%{BasicFooter}` | `background-color: rgba(0,0,0,.5); backdrop-filter: blur(100px)`. Top hairline via `border-top: 1px solid` plus `border-image: linear-gradient(90deg, transparent, rgba(255,255,255,.05) 25%…75%, transparent) 1 0 0`. Padding `0 calc(4px + 1.4vw)`. **z-index 7000, abs bottom.** Prefers-contrast: #000. `%{PopupBody>Opaque}`: #000, no blur |
| `%{ActionButtonLegend}` | transparent, r 6. **`:hover` rgba(255,255,255,.1)** with a 150 ms transition |
| `%{ActionButtonLabel}` | 12px bold uppercase, letter-spacing .5px, #fff |
| `%{FloatingVRFooter}` variant | used by the separate `floatingfooter` surface (`location:"vr-floating"`). No bg, `filter: brightness(.6) drop-shadow(black 0 1px 0)` |

- **When it shows:** `FooterStore.BShowFooter()`. Home calls `HideFooter` (count 1), so **there is no footer on `/library/home`**. Other routes show the legend for the focused element's actions.
- Modals add `%{*GamepadDialogContent>FooterVisible}` to `ModalPosition` so dialogs end above the footer (`bottom: var(--gamepadui-current-footer-height)`).
- The footer stays above modal scrims (z 7000).
- No pseudo-elements. Glyph `img`s are rasters, so a theme must not recolour them with filters that kill legibility.

---

## 6. Modal layer (scrim + dialogs)

Source: ModalManager on `VRGamepadUIMainWindowInstance` (`SetUsePopups(false)`, so every dialog renders in-window). The wrapper is module 46307 `W9` (`t9.EO`, className `%{GamepadDialogOverlay} GamepadMode`). The VR position wrapper is module 7852 `I`.

### 6.1 Structure

```
div.%{GamepadDialogOverlay}.GamepadMode.FullModalOverlay        abs inset 0, z 1500. Idle: inline style="display:none" (Steam toggles it)
 ├ div.ModalOverlayContent.ModalOverlayBackground               ← SCRIM: background rgba(0,0,0,.85); backdrop-filter: blur(3px); abs inset 0; z 7
 └ div.ModalOverlayContent.active                               abs inset 0, z 10   (.inactive = z 5 for a lower stacked modal)
    └ div.%{*GamepadDialogContent>ModalPosition}[.%{*…>WithStandardPadding}][.%{*…>VR}][.%{*…>FooterVisible}][.%{*…>ScrollWithin}][.%{*…>NoHeaderPadding}].Panel.Focusable
         position:absolute; top: var(--basicui-header-height); bottom: var(--gamepadui-current-footer-height) (0 in VR without FooterVisible);
         overflow: hidden auto (SCROLLS); flex column; WithStandardPadding: padding 24px; .gpfocus outline none
       ├ div.%{*GamepadDialogContent>ModalClickToDismiss}       abs inset 0 (click-outside = cancel). Transparent; keep it
       └ <content>  one of:
          A) dialog:  div.%{*GamepadDialogContent_InnerWidth>GamepadDialogContent}.DialogContent._DialogLayout.GenericDialogBase.GenericConfirmDialog
               └ div.%{*GamepadDialogContent>GamepadDialogContent_InnerWidth}.DialogContent_InnerWidth
                  └ form[role=dialog]
                     ├ div.DialogHeader[role=heading]
                     ├ div.DialogBody.Panel
                     │   ├ div.DialogBodyText
                     │   └ div.DialogFooter > div.DialogTwoColLayout._DialogColLayout > button.DialogButton._DialogLayout.Primary|Secondary.%{*GamepadDialogContent>Button}
                     └ (text prompt) div.DialogInput_Wrapper._DialogLayout > input.%{*GamepadDialogContent>BasicTextInput}.DialogInput.DialogInputPlaceholder.DialogTextInputBase
          B) context menu: div.BasicUIContextMenu.%{*BasicContextMenuHeader>BasicContextMenuModal} … (§7)
          C) custom content (zoo Scroll Panel): div.Panel > div.%{ScrollPanel}.%{ScrollY} (inline flex:1; padding:12px) + DialogButton; with its own %{FocusRingRoot}/%{FocusRing}
```

### 6.2 Paint today

| element | paint |
|---|---|
| scrim `.ModalOverlayBackground` (in `%{GamepadDialogOverlay}`) | `background: rgba(0,0,0,.85); backdrop-filter: blur(3px)`. The global default is .8 without blur. |
| `ModalPosition > %{*…GamepadDialogContent}` (the dialog card) | `background-color: #0e141b; border: 2px solid #23262e; padding: calc(12px + 2.25vh) 2.8vw; width: 660px; margin: auto`, no radius, no shadow. **`animation: <fade> .5s cubic-bezier(.16,.86,.43,.99) both`**, where the keyframes animate `opacity 0→1` and `transform: scale(1)`. `.DeckVerifiedModalDialog .DialogContent` forces `#0e141b !important` |
| `.DialogHeader` | 22px/28px bold #fff, margin-bottom 10px |
| `.DialogBodyText` | 16px/20px #dcdedf, margin-bottom 10px |
| `.DialogSubHeader` / `.DialogControlsSectionHeader` (BasicUI) | 16px 600 uppercase, rgba(255,255,255,.5); the section header has a 1px #23262e bottom border |
| `button.DialogButton.%{…>Button}` base | padding 10px 24px, min-width 160px, r 2px, #dcdedf, **bg rgba(255,255,255,.15)** (Primary too, when unfocused) |
| `:hover` | bg rgba(255,255,255,.2). Primary:hover: rgba(26,160,255,.486) |
| `.gpfocus` / `:active` | **bg #fff, text #23262e**. `.Primary.gpfocus`: **#1a9fff / #fff**. `.Destructive.gpfocus`: **#de3618 / #fff**. `.BarButton.gpfocus`: #fff / #000. `.Glyph.gpfocus`: `filter: brightness(30%)` |
| `.Disabled` / `[disabled]` | opacity .4, bg #131418, `pointer-events: none` (focused: bg #000) |
| `%{…ActiveAndUnfocused}` | bg #0e141b |
| `::before` on `DialogButton` | Steam sets `content: none`, so it is free for a theme |
| `%{*GamepadDialogContent>BasicTextInput}` | `.BasicUI` bg rgba(255,255,255,.1), text #8b929a, padding 10px 16px, r 0. **`.gpfocus`: bg #fff, text #000.** Placeholder italic #67707b |
| `._DialogInputContainer.gpfocus` / `.Active` | #fff / #0e141b |

### 6.3 Variants seen

| variant | notes |
|---|---|
| confirm (OK/Cancel) | `shell_modal_confirm_before`. `bDestructiveWarning:true` has **no visual effect** in gamepad dialogs (checked live, so no separate shot) |
| alert | one full-width Primary button |
| text prompt | Header + input only, no buttons |
| scroll panel (large custom) | the content scrolls inside `%{ScrollPanel}`. **This is where `%{FocusRing}` appears** (§9) |
| non-interactive | no focusables, so `ModalPosition` itself carries `.gpfocus` |
| empty dialog | zoo "Empty Dialog", same chrome |

- **Stacking:** a dialog opened while a context menu is open replaces the menu (the menu hides), so `.ModalOverlayContent.inactive` was not observed. Its CSS is `z-index: 5`.
- **Header and footer are not covered by the scrim.** Plan glass for header and footer over a dimmed page.
- **Never touch:** `display` on `%{GamepadDialogOverlay}` (inline toggle); the position, top or bottom of `ModalPosition` (they use the layout vars); the dialog-card animation, which keeps `transform` animated (use the independent `scale` property if needed); `ModalClickToDismiss`.

---

## 7. Generic context menu (gamepad presentation)

Context menus in `main` (power menu, game Options menus, sort/filter pickers, dropdown lists, zoo menus) all render as a centred modal sheet. Tokens come from the gamepaddialog CSS module, which ships 4 builds, so always use the `%{*…}` forms. For any class name N, the tokens `*BasicContextMenuModal>N` and `*GamepadDialogContent>N` (written inside `%{…}`) expand to the same class set. The outline prints the first form and the CSS dump prints the second.

```
div.%{*GamepadDialogContent>ModalPosition}.%{*…>VR}[.%{*…>FooterVisible}]       (no WithStandardPadding)
 ├ div.%{*…>ModalClickToDismiss}
 └ div.BasicUIContextMenu.%{*BasicContextMenuHeader>BasicContextMenuModal}     abs inset 0; flex column, centred
    ├ div.%{*BasicContextMenuModal>BasicContextMenuHeader} "Power" | menu label    18px/22px #dcdedf centred; :empty hidden
    ├ (div.%{*BasicContextMenuHeaderShrinkableSpacing})
    └ div.%{*BasicContextMenuModal>BasicContextMenuContainer}.Panel   max-width 70%, overflow hidden; ANIMATION (opacity 0→1, transform scale(1)) .5s both
       ├ div.%{*BasicContextMenuModal>contextMenuContents}[.%{*…>hasSubMenu}].Panel[role=menu]
       │    width fit-content; max-height 100%; overflow: hidden auto (SCROLLS); scroll-padding 72px 0;
       │    **filter: drop-shadow(rgba(0,0,0,.5) 0 0 8px)**; :first-child margin-top 15px, :last-child margin-bottom 40px
       │  ├ div.%{*…>contextMenuItem}.contextMenuItem.Panel.Focusable[role=menuitem] [state classes below]
       │  │    flex, min-width 280px, padding 14px, line-height 20px; bg #23262e; text #b8bcbf
       │  ├ div.%{*…>contextMenuItem}.%{*…>SubMenu} > div.%{*…>Label} + div.%{*…>Arrow} > svg.SVGIcon_DownArrowContextMenu (rotated -90deg)
       │  ├ div.%{*…>ContextMenuSeparator}[role=separator]  2px; #MainNavMenu-Rest scope: bg #000 (prefers-contrast: #fff)
       │  └ … Steam always appends a separator + "Cancel" item
       └ (submenu open) a second div.%{*…>contextMenuContents} to the right
```

**Item states** (all live classes; see `shell_contextmenu_before`, `shell_contextmenu_submenu_before` and `shell_powermenu_before`):

| class | paint |
|---|---|
| base | #23262e / #b8bcbf |
| `:hover` (laser) | #3d4450 (100 ms) |
| **`%{*…>Focused}` + `.gpfocus`** (focus is shown by **`%{*BasicContextMenuModal>Focused}`**, the `focusClassName`) | **#fff / #0e141b**, outline none |
| `%{*…>Selected}` (`selected` prop / preferred) | #3d4450 / #fff |
| `%{*…>active}` (submenu open on the parent) | #fff / #000 |
| `%{*…>Destructive}` | normal until hover (#8a220f) or focus (**#de3618 / #fff**). Also `.Stop` and `%{moderation_cancel}` |
| `%{*…>Positive}` | hover #236c39 / #fff, focus **#59bf40 / #fff**. Also `.Play`, `.Launch`, `.Resume`, `.Stream`, `.Connect`, `.PlayMusic`, `.BorrowApp`, which have #dcdedf text even when idle |
| `%{*…>Emphasis}` | hover #216495, focus **#1a9fff**. Also `.Download`, `.Update`, `.PreLoad`, `.Install` |
| `.disabled` | text rgba(255,255,255,.3) (focused: rgba(0,0,0,.5)); not focusable |
| `.menuChecked` | text #6dcff6 (the `.contextMenuCheckMark` 4px bar exists but stays `display:none` in this presentation) |
| `%{*…>MenuSectionHeader}`, `%{*…>Capitalized}`, `%{*…>UpperCase}` | 12px uppercase, uppercase, uppercase |

- **No pseudo-elements** on any context-menu element.
- **Backdrop root warning:** `filter: drop-shadow` on `contextMenuContents` and the opacity animation on `BasicContextMenuContainer` both make **backdrop roots**. A `backdrop-filter` on items inside them would only see the menu itself. Put any glass on `contextMenuContents` (and replace its `filter`) or on the container after the animation ends.
- Related tokens in other modules (desktop-style menus, not seen in VR): `%{ContextMenuMouseOverlay>contextMenu}`, `%{ContextMenuPosition}`, `%{ContextMenuPopup}`, `%{ContextMenuItemDisabled}`.
- Game-specific menu items such as `%{StreamingContextMenuItem}` > `%{CheckContainer}`, `%{StreamingTargetLabel}` ("Play from" menu) and `%{*LibraryContextMenu}` belong to their areas but sit in this same chrome.

---

## 8. Page transitions and overlay scrim

- **Route change:** `%{TopLevelTransitionSwitch}` holds one or two `%{ContentWrapper}.%{TopLevelTransition}` children with these state classes:
  - `%{TopLevelTransitionSwitch>Enter}`: `opacity 0; transform: scale(.95)`, or `scale(1)` when `%{NoTransitionZoom}` (library).
  - `%{…>EnterActive}`: `opacity 1; transform: scale(1)`, transition opacity+transform 600 ms `cubic-bezier(0,0,.1,1)`, delay 200 ms.
  - `%{…>Exit}`: `opacity 1; scale(1); pointer-events: none`.
  - `%{…>ExitActive}`: `opacity 0; scale(.95)` over 200 ms `cubic-bezier(.6,0,1,1)`.
  - The Enter and EnterActive classes stay on the element after the transition ends, as seen in every outline.
  - **The theme must not set `transform` or `opacity` on `%{TopLevelTransition}` or `%{ContentWrapper}`.**
- **App-details overlay** (partner event / app details opened over a page): `%{PartnerEventOverlayContainer>AppDetailsMain}` cross-fades opacity (`…AppDetailsTransitionEnter|EnterActive|Entered|Exit|ExitActive`).
  - The scrim `%{PartnerEventOverlayContainer} %{Container>TransitionWrapper}` has opacity 0 by default. In LowPerfMode its bg is rgba(16,16,16,.75).
  - With `OverlayAppDetailsTransitionEnterActive|Entered|Exit` it shows: opacity 1, `backdrop-filter: blur(5px) brightness(.65) saturate(.7)`.
  - Not reached live, because What's New on Home was empty (`%{LibraryHomeWhatsNew>Empty}`). The state comes from CSS.
- Tab-content transitions (`%{ContentWrapper>TransitionGroup}`, `%{GamepadTabbedPage>ContentTransition}`, `%{GamepadTabbedPage>Left}` / `%{GamepadTabbedPage>Right}`) belong to the tabbed-page component (library/search).

---

## 9. Focus and hover rendering (generic)

- **Mechanics.** The gamepad navigation adds `.gpfocus` to the focused element and `.gpfocuswithin` to all its ancestors. Elements that pass `focusClassName` get that class too: `%{*…>Focused}` on menu items. `SteamUIStore.ActiveNavigationSourceType` was `1` (GAMEPAD). The laser drives `:hover` (MOUSE = 3). Both must stay visible. In the stylesheets, 704 rules use `.gpfocus` and 279 use `.gpfocuswithin`. Generic resets: `div:focus, a:focus, span:focus { outline:none }`, `button.DialogButton:focus { outline:none }`, `.ModalPosition:focus { outline:none }`.
- **Per-control focus looks in this area:**
  - DialogButton and menu item: solid **#fff fill with dark text**. Primary turns blue, Destructive red, Positive green.
  - Text input: #fff fill.
  - Header item: #fff fill with black text.
  - Search result tile: `%{ResultTemplate}.gpfocuswithin %{ResultTemplateImage}` gets `transform: scale(1.03)` (Steam transform) plus `box-shadow rgba(0,0,0,.32) 0 12px 16px`, and its icon and description turn #fff.
  - Settings-style `%{*GamepadDialogContent>Field}%{*…>HighlightOnFocus}.gpfocus|.gpfocuswithin`: bg #3d4450, text #fff, plus the flash animation below.
- **Floating focus ring `%{FocusRing}`:**
  - It is a div inside a `%{FocusRingRoot}` (abs, z 10000, pointer-events none; one under `%{BasicHome}` and others inside providers such as dialogs).
  - Inline `left/top/width/height`.
  - `outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px`.
  - `animation`: bg flash rgba(255,255,255,.08)→0 (.5 s); outline 12px→2px (.4 s); colour fade-in (.4 s); then a **pulse of opacity →.4, 20 iterations of 1.2 s**.
  - It appears only for focusables inside a FocusRingProvider that don't set `noFocusRing`, for example the zoo Scroll Panel (`shell_modal_scrollpanel_before`). On Home the root ring was empty.
  - The `%{DebugFocusRing}` and `%{FocusRingOnHiddenItem}` variants are debug only.
  - `%{FocusRingHint}` is an inset helper used by the bar.
- **Focus-flash animations hold the background.** Many `.gpfocus` rules set an `animation-name` whose keyframes paint `background` and `color`, with **`animation-fill-mode: forwards`** (.5 s). Because animated values beat normal declarations, a theme's `background`/`color` on these focused elements **will not apply** unless it also replaces `animation-name` (with its own keyframes in a `*.nowrap.css` file) or uses `!important`. Instances:
  - `%{*GamepadDialogContent>Field}…HighlightOnFocus.gpfocus` → `_2wp31…` (#23262e→#383a41, text →#fff), or `_2NVMb…` (rgba(255,255,255,.25→.15)) for Classic fields.
  - `%{DashboardMenu>Item}.gpfocus` → `zjENV…` (rgba(255,255,255,.3→.1)).
  - The global `ItemFocusAnim-*` keyframes (`darkGrey`, `darkerGrey`, `grey`, `green`, `translucent-white-10/20`, `darkGreySettings`, `darkerGrey-nocolor`, `ItemFocusAnimBorder-darkGrey`) are used by 135 rules, mostly friends and chat.
- **Hover:** Steam relies on `:hover` for the laser.
  - Back: #8b929a→#fff.
  - Footer legend: rgba(255,255,255,.1).
  - DialogButton: rgba(255,255,255,.2).
  - Menu item: #3d4450.
  - Result tile: `scale(1.02)` plus a shadow.
  - Search (VR): white icons and placeholder.
  - Hover could not be produced synthetically (CSS `:hover` needs a real pointer), so these states come from CSS.

---

## 10. Global CSS variables on the `main` document

- **The design-system variables are not used by the gamepad UI's colours.** 674 custom properties are defined, 557 of them on `:root`, but component rules hard-code colours (#0e141b, #23262e, #3d4450, #1a9fff, #dcdedf, #8b929a …). The palette variables are only referenced to alias each other.
- **Overriding `--color-*` therefore changes almost nothing in this area.** The theme must target tokens. The defined families:
  - **Radix-style colour scales:** `--color-{amber,blue,bronze,brown,crimson,cyan,dull,gold,grass,green,greyneutral,indigo,iris,jade,lime,mauve,mint,olive,orange,pink,plum,purple,red,ruby,sage,sand,sky,slate,storegreen,teal,tomato,valveonly,violet,yellow}-{1..12}` (plus `-a` alpha variants).
  - `--color-accent-1..12` and `--color-dull-1..12` are aliased by `:root:has(%{Root} > div[data-accent-color="blue"])` and `[data-dull-color="greyneutral"]`. Their specificity is about (0,3,1), above `html.lgs-on` (0,1,1). An override needs a matching `:has()` selector or `!important`. `--color-accent-8` = `#1A9FFF`, `--color-accent-contrast` = `white`.
  - **Text:** `--color-text-{light,green,red}-{title,subtitle,body,description,note}` (light: #f1f2f3, #d6d9dc, #acb2b8, #9a9fa5, #636b74) and `--color-text-body-*`.
  - **Inline on the data-accent div:** `--color-success-*`, `--color-warning-*`, `--color-error-*` and `--color-text-success|warning|error-*`.
  - **Type and spacing scales:**
    - `--font-family: "Motiva Sans", Twemoji, "Noto Sans", Helvetica, sans-serif`
    - `--font-weight-{light 300, regular 400, medium 500, heavy 700}`
    - `--text-size-1..9` (11→36px), `--line-height-1..9`, `--letter-spacing-1..9`, `--heading-size|line-height|letter-spacing-1..9`
    - `--spacing-0..9` (0,4,8,12,16,24,32,40,48,64px)
    - `--radius-{none 0, sm 2px, md 4px, lg 8px, full 9999px}`
    - `--control-height-1..3` (24/36/48px)
    - `--box-shadow-elevation-{-1,0,1,2}`
    - `--default-font-size: 13px`, `--scroll-fade-size: 20px`
    - `--gamepad-page-content-max-width: 1100px` (inline-overridden per page)
    - `--field-negative-horizontal-margin`, `--field-row-children-spacing`, `--indent-level`, `--sticky-header-background-opacity: 0`
    - `--virtualmenu-*`, `--touchmenuicon-*` (controller virtual menus)
    - `--debug-pointer-*`
  - **Referenced but never defined** (used with fallbacks): `--gpSpace-Gutter`, `--gpShadow-Medium`, `--gpText-BodyMedium|BodyLarge|HeadingLarge`, `--gpBackground-LightMedium`, `--gpStoreLightestGrey`. Defining them would affect only a handful of rules.
- **Variables that matter for the shell. They are read-only: Steam sets them inline as state.**
  - `--basicui-header-height` (40px) and `--gamepadui-current-footer-height` (42px) on `%{BasicUiRoot}`. They position `ModalPosition`, page padding and tabbed pages. **Never override.**
  - `--gamepadui-header-opacity` and `--gamepadui-header-background-opacity` on `#header`.
  - `--menu-background`, `--menu-item-height`, `--menu-icon-size`, `--menu-item-padding`, `--menu-font-size` on `%{DashboardMenu}`. These are component custom properties a theme **can** set: `--menu-background` is the main menu's item fill.

---

## 11. Search route `/search` and `/search/tab/{All|Library|Friends|Store|Tools|Hidden}`

- **Reaching it:** typing in the header search navigates to `/search/tab/All` (module 62678 `H`). The query lives in `req(4399).U` (`SetSearchText` / `GetSearchText().m_currentValue`). A tab with 0 results may be hidden: "Hidden" appears only when it has matches.
- The search page itself may belong to a content area. It is recorded here because the header search opens it.

```
div.%{GamepadSearch}.Panel                              page root: radial gradient (§2); padding-top var(--basicui-header-height)
 └ div.%{GamepadTabbedPage}.Panel
    ├ div.%{TabHeaderRowWrapper}[.%{GamepadTabbedPage>Pinned}][.%{ScrolledDown}]   abs top, z 2; ::before (Steam) when scrolled: rgba(0,0,0,.5) + blur(100px) + shadow
    │   └ div.%{TabRow} > div.%{Arrows} | div.%{TabRowTabs}[role=tablist] > div.%{TabsRowScroll} > div.%{FixCenterAlignScroll}.%{ScrollPanel}.%{ScrollX}
    │        > div.%{GamepadTabbedPage>Tab}[.%{GamepadTabbedPage>Selected}].%{HasAddon}.%{RightAddon}[role=tab] (r 64; Selected bg rgba(255,255,255,.15))
    │            > span.%{GamepadTabbedPage>TabTitle} + span.%{TabCount}
    └ div.%{TabContents} > div.%{ContentWrapper>TransitionGroup} > div.%{ContentWrapper}.%{GamepadTabbedPage>ContentTransition}
       └ div.%{TabContentsScroll}._TabContentsScroll.%{ScrollPanel}.%{ScrollY}[role=tabpanel]      ← the scroller
          ├ div.%{ResultsGridWrapper}  > div (inline position:absolute; inset:0)
          │   └ div.Panel[role=grid] (inline height: Npx; width:100%; position:relative)            ← VIRTUALIZED
          │      └ div.%{ResultsRow}[role=row] (inline position:absolute; top:0; height:140px; transform: translateY(Ypx))   grid, auto-fill minmax(168px,1fr), gap 12
          │          └ div.%{ResultTemplate}.Panel
          │              ├ div.%{ResultTemplateImage}.Panel[role=link]   margin 6px 0; :hover scale(1.02); focus-within scale(1.03) + shadow
          │              │   ├ game/store: div.%{LibraryImageWithName} > div.%{PortraitImage>Container}.%{GreyBackground}.%{LandscapeImage}.%{GamepadSearch>GameIcon} (bg #0e141b) > img.%{PortraitImage>Image}
          │              │   ├ friend:     div.%{FriendResultImage} > div.%{ProfileBackground} > div.%{miniProfileBackground} > img.%{miniProfileBackgroundBlur} (op .4)
          │              │   │             + div.%{GamepadSearch>ImageContainer} > div.%{avatarHolder}.avatarHolder.%{SearchResultFriendAvatar}[.online|.offline] > div.avatarStatus + img.%{avatar}
          │              │   └ "View more in the Store": div.%{RedirectResultBackground} (linear-gradient 135deg #67707b→#3d4450) + div.%{OverlaidText} (12px bold uppercase #dcdedf)
          │              └ div.%{ResultTemplateDescriptionRow} > div.%{GamepadSearch>Icon} (svg 16px #8b929a) + div.%{GamepadSearch>Description} (12px bold uppercase #8b929a; "In Library" / "From the store" / persona name)
          └ empty: div.%{NoResultsFound} > span "No Results Found"   (16px #fff, centred, margin-top 162px)
```

- **Do not touch:** the inline `transform: translateY()`, `top`, `height` and `position` on `%{ResultsRow}` and the grid wrappers (virtual list). The transforms on `%{ResultTemplateImage}` (hover/focus scale).
- `%{LibraryImageWithName}%{TagCtn} %{GamepadSearch>GameIcon}` gets a purple gradient; it was not observed.

---

## 12. Things a theme must not touch (consolidated, shell)

| element | Steam-owned property |
|---|---|
| `%{BasicUiRoot}` | inline `--basicui-header-height`, `--gamepadui-current-footer-height`; `border-radius: 6px` + `overflow: hidden` (window clip) |
| `#header` | inline `--gamepadui-header-opacity` / `--gamepadui-header-background-opacity`; `opacity`; `pointer-events` |
| `%{SearchFieldBackground}`, `%{SearchIconLeft}`, `%{SearchIconRight}`, `%{SearchBox}::placeholder` | `transform` / `opacity` transitions (expand animation) |
| `%{GamepadDialogOverlay}` | inline `display:none` toggle |
| `ModalPosition` | `top` / `bottom` from vars, `overflow` (scroll) |
| dialog card, `%{*BasicContextMenuModal>BasicContextMenuContainer}` | entrance animations on `opacity` + `transform` |
| `%{TopLevelTransition}` / `%{ContentWrapper}` | route transition `opacity` + `transform` |
| `%{PartnerEventOverlayContainer>AppDetailsMain}`, `%{Container>TransitionWrapper}` | opacity / backdrop-filter transitions |
| `%{FocusRing}` | inline `left/top/width/height` + animations |
| `%{ResultsRow}` + grid wrappers | inline virtual-list `position/top/height/transform` |
| `%{ResultTemplateImage}` | hover/focus `transform: scale()` |
| `%{DashboardMenu>Item}` (frame.menu) | `transform: scale(1|1.1) rotateX(1deg)`; `%{DashboardMenu>ActiveDot}` inline size; Collapsed width transition |
| `#MouseHoverBlockerHack` (if present) | everything |

## 13. Scroll containers in this area

| container | scroll behaviour |
|---|---|
| `%{*GamepadDialogContent>ModalPosition}` | `overflow: hidden auto` |
| `%{*…>contextMenuContents}` | `overflow: hidden auto`, scroll-padding 72px |
| zoo/custom dialog `%{ScrollPanel}.%{ScrollY}` | scrolls |
| search `%{TabContentsScroll}` (`%{ScrollPanel}.%{ScrollY}`) | **virtualized** rows |
| tab strip `%{FixCenterAlignScroll}.%{ScrollPanel}.%{ScrollX}` | horizontal |
| `%{FooterLegend}` | `overflow: hidden` (clips) |

Scrollbars are hidden globally (`body.%{GamepadUIPopupWindowBody} ::-webkit-scrollbar { display:none }`).

## 14. Steam's own pseudo-elements (shell)

| element | pseudo-element |
|---|---|
| `%{Profile>Header}::before` | header backdrop (§3) |
| `%{BackContainer}:not(:last-child)::after` | 1px divider |
| `%{TabHeaderRowWrapper}::before` | when `%{IsUnderHeader}` or `%{ScrolledDown}`: pinned tab-row backdrop (tabbed-page component) |
| `%{Profile>CurrentUserAvatar}.InVoiceChat::after` | header avatar voice indicator; not visible |
| `input[type=search]::-webkit-search-cancel-button` | clear (x) |
| `::placeholder` | styled |
| `button.DialogButton::before` | Steam sets `content: none`, so it is free to use |
| `%{*GamepadDialogContent>Field}%{*…>Classic}…::after` | separators (settings area) |
| `%{DashboardMenu>ItemOuter}::after` | `%{Variant_TabMenu}` only (bar area) |

**No pseudo-elements** on: `%{BasicHome}`, `%{BasicFooter}`, the scrim, the dialog card, `DialogHeader/Body/Footer`, any context-menu element, or the search result tiles. Each was checked with `getComputedStyle(el,'::before'|'::after').content`.

## 15. Stock palette in this area (for mapping to glass tokens)

| colour | used for |
|---|---|
| #0e141b | window gradient end, dialog card, main-menu items, focused text |
| #060a0e | gradient start |
| #23262e | menu item bg, dialog border, divider |
| #3d4450 | hover / selected item, focused field |
| #1a9fff | primary / accent |
| #de3618 | destructive focus (hover #8a220f) |
| #59bf40 | positive focus (hover #236c39) |
| #216495 | emphasis hover |
| #dcdedf | body text |
| #b8bcbf | menu text, filled search field |
| #8b929a | secondary text and icons |
| #67707b | placeholder |
| #6dcff6 | checked item |
| rgba(0,0,0,.5) + blur(100px) | header and footer bars |
| rgba(0,0,0,.85) + blur(3px) | modal scrim |
| rgba(255,255,255,.15) | unfocused button and selected tab |

## 16. Could not reach / not captured (and why)

| item | why |
|---|---|
| Search field gamepad-focused (#fff field) | Focusing triggers `onKeyboardShow` (raises the shared VR keyboard surface and navigates). Documented from CSS |
| All `:hover` states (laser) | Synthetic events don't set CSS `:hover`. Documented from CSS |
| App-details / partner-event overlay scrim (`%{Container>TransitionWrapper}` visible) | What's New was empty, so there was nothing to open |
| Header browser mode (`%{HeaderBrowser}`, URL bar in header on `/steamweb` / `/externalweb`) | Needs a live Store web view; belongs with the store area. Rule: `.FlexGrowWebBrowserURLBar %{HeaderBrowser} { flex-grow: 1 }`, Back container removed |
| Header account-alert item (`#header_profile`, `%{Profile>HasActiveSupportAlert}` red gradient) | Only rendered with active support alerts |
| `%{HeaderOpaque}`, `%{InQuickAccess}`, `%{SuppressInteraction}` header variants | The header is not rendered on the opaque routes in VR. Quick Access is not a side menu in VR. Suppression is disabled in VR (`ci()` returns false when IN_VR) |
| Stacked modals (`.ModalOverlayContent.inactive`) | Opening a dialog over a menu hides the menu, so they never coexisted |
| `.FullModalOverlay.NotReadyToRender` (black) | Transient |
| Desktop-style menus (`%{ContextMenuMouseOverlay}`, `%{ContextMenuPopup}`) | The gamepad presentation is always used in VR |
| Root `%{FocusRingRoot}` ring on Home | Library tiles use their own focus styling (noFocusRing). The ring was captured inside a dialog instead |

## 17. Test bench: `/zoo`

Steam's component zoo works in VR. These routes are safe to **look at**:

- `/zoo/modals`: demo context menus (Simple, Deeply Nested, Confirmation Example, AppActionsMenu, Longboi ×2) and dialogs (OK/Cancel, GenericConfirmDialog, Text Prompt, Empty, Scroll Panel Test, Launch Multiple Games, Non-Interactive, Long Non-Interactive).
- `/zoo/buttons`, `/zoo/dropdowns`, `/zoo/sliders`, `/zoo/toggles`, `/zoo/fieldlayouts`, `/zoo/misc`, `/zoo/glyphs`, `/zoo/type`, `/zoo/input`: generic controls for after-shots of the shared gamepaddialog styles.
- **Avoid** `/zoo/clientsettings`, `/zoo/developeroptions` and `/zoo/vrdeveloperoptions`. They hold real settings.
- **Avoid** "AppActionsMenu" items and "Launch Multiple Games Dialog" confirms.
- Close zoo modals with `MM.RemoveModal(entry)` as in ZOO (§0.2).
