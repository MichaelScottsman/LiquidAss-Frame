# Inventory: appdetails (game pages, play bar, options menu, tabs, Properties, running-app overview)

Surface: `main` (VR_uid0, 1280x720 CSS px, shots are 1920x1080). Every screen below lives in `main` unless stated otherwise.
Mapped 2026-10-06 against Steam build 1790377368 (webpack chunk id "11041156"), theme OFF for every before-shot.

Test apps used (all owned; pick others via `appStore.GetAppOverviewByAppID(id)`):

| Role | appid | Name | Why |
|---|---|---|---|
| Installed Steam game | 620980 | Beat Saber | Play + Play-from, achievements, DLC, marked Private (shows the private badge), Frame "Verified" |
| Not installed | 751630 | After The Fall | Blue "Install" button, "Space Required" stat |
| Non-Steam shortcut | 2258399336 | AMID EVIL VR | No Play-from, fallback hero art, Shortcut property page |
| "Stream from PC" variant | 377160 | Fallout 4 | Green "Stream / from Ben-PC2" button + Friends who play section |
| Workshop | 546560 | Half-Life: Alyx | Steam Workshop section + Workshop property page |
| Trading cards | 2379780 | Balatro | Trading Cards section |

---

## 0. Driver notes that matter for this area (read before reproducing)

1. **Git Bash mangles routes.** `--route /library/app/620980` from Git Bash becomes `C:/Program Files/Git/library/...`. Always `export MSYS_NO_PATHCONV=1` (or run glass.py from Python/PowerShell). The live route history already contains mangled entries from other agents.
2. **Context menus and modals survive navigation AND the end of the lock.** `L.back()` is only `history.goBack()`; it does **not** close a menu. A menu left open is drawn over every other agent's shot. Close it in the same locked step. The reliable close is Steam's own gamepad Cancel (B) event dispatched inside the menu:
   ```js
   // CLOSE = run on the menu root (.BasicUIContextMenu) or a ModalPosition element
   (m => m.dispatchEvent(new (m.ownerDocument.defaultView.CustomEvent)('vgp_onbuttondown',
       {bubbles:true, cancelable:true, detail:{button:2, source:1, is_repeat:false}})))(EL)
   ```
   Because `shot` captures *after* `--pre`, schedule the close for after the capture, scoped to the menu you opened:
   ```js
   // pattern used for every menu shot below (settle 1.0 -> capture finishes ~2 s after pre)
   const W=L.surface('main'), m=W.document.querySelectorAll('.BasicUIContextMenu'), mine=m[m.length-1];
   setTimeout(()=>{ if(mine&&mine.isConnected) mine.dispatchEvent(new W.CustomEvent('vgp_onbuttondown',
       {bubbles:true,cancelable:true,detail:{button:2,source:1,is_repeat:false}})) }, 5200)
   ```
   Fallback: tap the menu's own `Cancel` item (it has no side effect).
3. **`python glass.py js` does not take the device lock.** Some agents navigate with it, so a route can change under a locked step. Navigate *inside* `--pre` (`L.nav(...)` + `await` 1.5 to 2.5 s) and check `L.route()` in the pre's return value.
4. **Moving gamepad focus** (`.gpfocus`) programmatically: `el.focus()` does not set `.gpfocus`. Use the nav node:
   ```js
   const gpFocus = el => { const k=Object.keys(el).find(k=>k.startsWith('__reactFiber')); let f=el[k];
     for (let i=0;i<10&&f;i++,f=f.return){ const n=f.memoizedProps&&f.memoizedProps.node; if(n&&n.BTakeFocus) return n.BTakeFocus(3); } };
   ```
   On a tab strip, focusing a tab also **selects** it (Steam behaviour).
5. In Git Bash never put `$('…')` / `$$` inside a double-quoted `--pre`: bash expands them. Put long pre JS in a file and pass `"$(cat file.js)"`, or use only `L.q/L.qa`.
6. Text that is CSS `text-transform: uppercase` (tabs) comes back uppercase from `innerText`; match case-insensitively.
7. A token already expands to a class selector *with* its dot, so a compound is written `%{A}%{B}` (no dot between), e.g. `%{GamepadTabbedPage>Tab}%{GamepadTabbedPage>Selected}`, `%{ShutdownAppButton}.gpfocus`. In this file `[%{X}]` after a tag means "this class is present only in that state". Bare `%{Active}`, `%{Selected}`, `%{Green}`, `%{ButtonChild}` are ambiguous: always use the anchored forms written here (every token in this file was checked against `L.sel` on 2026-10-06).

---

## 1. Page skeleton shared by every game page (`/library/app/:appid`)

Reach: `--route /library/app/620980` (also `/library/app/:appid/tab/{Activity|YourStuff|Community|GameInfo}` selects a tab directly; `/library/collection/:cid/:appid` renders the same page).
Before-shots: `appdetails_installed_top.png` (Play focused), `appdetails_installed_gearfocus.png` (gear focused, Play unfocused), `appdetails_installed_deepscroll.png` (Steam-scrolled by focusing a deep item).

```
body %{*PopupBody} GamepadMode BasicUI ... LowPerfMode
 div %{BasicHome} %{OpaqueBackground}                       page bg: radial-gradient(155% 100% at 0 0, #060a0e -> #0e141b)
  div %{Profile>Header} GamepadMode FlexGrowUniversalSearch   global header (Back + search), 1280x40; ::before rgba(0,0,0,.5); inline vars --gamepadui-header-opacity/--gamepadui-header-background-opacity (Steam animates these) [header belongs to the header/nav area]
  div %{PopupBody>Content}
   div %{PartnerEventOverlayContainer>AppDetailsMain}
    div %{TopLevelTransitionSwitch} > div %{ContentWrapper} %{TopLevelTransition} %{TopLevelTransitionSwitch>Enter} %{TopLevelTransitionSwitch>EnterActive}   (route transition classes; do not restyle transform/opacity)
     div %{AbsoluteDiv}
      div %{ScrollToTopButtonPosition>Container} %{PreventScrolling>Container}
       div %{ScrollToTopButtonPosition>Body} %{PreventScrolling>ScrollContainer} %{ScrollContainer>Glassy}   <- OUTER SCROLLER (overflow-y:scroll, overflow-x:hidden, 1280x720, content 1096 tall); bg #24282f + radial-gradient(100% 100% at 45% 35%, #2c323d, #151616)
        div %{ScrollContainer>InnerContainer}
         div %{PreventScrolling>Header} %{HeaderLoaded} %{HeroImageContainer>Container}   hero (section 2); opacity transition on load
         div %{AppDetailsOverviewPanel}
          div %{ColumnContainer>Container} %{ColumnContainer>Glassy}
           div %{Backdrop} > div %{BackdropGlass}                  450px tall; in BasicUI Steam sets backdrop-filter:none; background:none (stock = invisible)
           div %{AppDetailsRoot}                                   bg rgba(14,20,27,.25)
            div %{PlaySection}                                     play bar (section 3), 1280x80
            div %{AppDetailsContainer} > div %{GamepadTabbedPage} %{CanBeHeaderBackground}   tabs (section 5)
      div %{PartnerEventOverlayContainer} > div %{Container>TransitionWrapper}   full-screen event-overlay scrim, bg rgba(16,16,16,.75) + backdrop blur, opacity 0 until an event is opened
 div %{BasicFooter}                                         footer legend bar, bg rgba(0,0,0,.5) + backdrop-filter blur(100px) [footer area]
 div %{FocusRingRoot} > div %{FocusRing}                    Steam's moving focus ring (section 9)
```

Scrolling / virtualization:
- Two nested scrollers: the OUTER `%{PreventScrolling>ScrollContainer}` (scrolls hero + play bar away, max scrollTop 376) and the INNER `%{TabContentsScroll}` (`_TabContentsScroll %{ScrollPanel} %{ScrollY}`, overflow-y:auto, 1280x680) that scrolls tab content. Steam drives both from gamepad focus (`appdetails_installed_deepscroll.png` = outer 80, inner 480). Programmatic: `L.q('main','%{PreventScrolling>ScrollContainer}').scrollTop=376`.
- No windowed virtualization on this page. Community tab is an infinite-append grid (rows added as you scroll); Activity is a plain list.
- When scrolled, page content passes *under* the 40 px global header (its ::before is only 50% black), so the play bar shows through the header in `appdetails_tab_yourstuff_scrolled.png`.
- The outer scroller has scrollWidth 1920 (the mirrored hero backdrop image is 2560 wide at x=-640) hidden by overflow-x:hidden; never change overflow here.

---

## 2. Hero / header art

Outline (`--sel "%{TopCapsule}"`):
```
div %{TopCapsule} [0,0 1280x336]                       (shortcut with no hero asset: %{TopCapsule} %{FallbackArt}, height 24vw = 307px)
 div %{HeaderBackgroundImage}
  img %{ImgSrc} %{ImgBlur}                              blurred copy, opacity 0 in BasicUI
  div %{ImgContainer} > img %{ImgSrc}                   the hero image
  img %{ImgSrc} %{ImgBlur} %{ImgBlurBackdrop}           mirrored (scaleY(-1)), 200%x200%, opacity .2, mask-image gradient, sits BELOW the hero behind the play bar (the faint reflection)
 div %{BoxSizerContainer} > div %{BoxSizerValidRegion}
  div %{BoxSizer} + one of %{CenterCenter} / %{BottomLeft} / %{UpperLeft} (asset-defined)   logo box; INLINE left/top/width/height from library assets (e.g. "left:25.5%;top:0%;width:49%;height:100%") - never override
   div %{TitleImageContainer} > img %{TitleLogo} %{TopCapsule>Loaded}
 div %{TopCapsule>TitleSection} [0,274 1280x62]
  div %{Features} > div %{HeroImageContainer>Column}
   div %{PurchaseNoticeContainer}                       "VR required" badge: radius 2, box-shadow 2px 2px 8px rgba(0,0,0,.25)
    div %{PurchaseNoticeImageContainer}                 yellow #ffc82c tile, radius 0 2 2 0, svg %{PurchaseNoticeImage} %{VROnly}
    div %{PurchaseNoticeLabel}                          linear-gradient(90.41deg,#2c3c49 16%,#576674 100%), radius 2 0 0 2, opacity .75
 div %{TopCapsule>TopGradient} [0,0 1280x75]            linear-gradient(rgba(0,0,0,.5) -> 0), pointer-events none
```
No ::before/::after, no scroll parallax (checked inline styles while scrolled: none added).

---

## 3. Play bar (`%{PlaySection}`)

```
div %{PlaySection} [0,336 1280x80]
 div %{Header>ActionRow} [36,352 1208x48]
  div %{ActionButtonAndStatusPanel}
   div %{AppActionButton} %{PlayButtonContainer} [%{PlayButtonContainer>Green}] [%{ShowingStreaming}] [%{PlayButtonContainer>Disabled}]   48px tall, bg rgba(220,222,223,.17), radius 2  <- the grey you see when the button is NOT focused
    div %{PlayButtonContainer>PlayButton} %{PlayButtonContainer>ButtonChild} [%{HasRemoteText}] [%{NoAction}] Focusable role=button   min-width 210, radius "2 0 0 2" when streaming selector present
     svg (action icon)  div %{PlayButtonContainer>ButtonText} "Play"|"Install"|"Stream"|"Resume"
       (Stream variant) div %{RemotePlayTextContainer} > div %{PlayButtonContainer>ButtonText} > div %{PlayButtonContainer>ButtonText} %{ButtonRemoteText} "from Ben-PC2"
     (launching) div %{PlayButtonContainer>ThrobberContainer} > %{PlayButtonContainer>Throbber}
    div %{StreamingSelector} %{PlayButtonContainer>ButtonChild} Focusable aria="Play from" [246,352 24x48]   the dropdown caret (absent for non-Steam shortcuts)
    (running only) div %{ShutdownAppButton} Focusable   48x48 Stop button, see 3.3
  div %{StatusAndStats} > div %{StatusNameContainer}
   div %{GameStatsSection}
    div tool-tip-source > div %{GameStat} %{LastPlayed} > div %{GameStatRight} > %{PlayBarLabel} "LAST PLAYED" (rgba(255,255,255,.7)) + %{PlayBarDetailLabel} %{LastPlayedInfo} "Oct 2" (#fff)
    div %{GameStat} %{PlayBar>Playtime} ...                    "PLAY TIME"; not-installed shows "SPACE REQUIRED 42.05 GB" in the first stat
   div %{PlayBarIconAndGame} op=0                              compact icon+name, only used by the sticky/narrow play bar (never visible in VR)
    div %{PortraitImage>Container} %{GreyBackground} %{PlayBarGameIcon} > img   span %{PlayBarGameName}
  div %{AppButtons}
   div > div %{Container>MenuButton} %{ControllerConfigButton} aria="Configure Controller"   48x48 bg rgba(172,178,201,.14) radius 2 (section 8)
   div %{MenuButtonContainer}
    div %{PrivateAppActiveIndicator} (only when the app is Marked Private)  position:absolute -8px corner badge, svg %{FeatureHidden}
    div %{Container>MenuButton} aria="Manage" role=button   the gear (section 4)
```

### 3.1 Button variants (what paints them)

| State | Classes | Paint today |
|---|---|---|
| Play/Launch/Stream/Connect, **unfocused** | `%{PlayButtonContainer>Green}` | ButtonChild bg transparent (BasicUI rule) so you see the container grey rgba(220,222,223,.17); svg/text #fff |
| Play, **focused** (`.gpfocus` + DOM `:focus`) | `.BasicUI %{PlayButtonContainer>Green} %{PlayButtonContainer>ButtonChild}.Focusable:focus` | bg rgb(89,191,64) green; **::after** shine sweep `linear-gradient(75deg, rgba(89,191,64,0) 33%, #bde5b3 50%, …) 300% 100%`, `clip-path` ring polygon, keyframe animation; radius 2 |
| Play, hover | `.BasicUI %{PlayButtonContainer>Green} %{PlayButtonContainer>ButtonChild}:hover` | same green + ::after shine |
| Install/Update/Download/Resume (no Green), focused | `.BasicUI %{PlayButtonContainer>ButtonChild}.Focusable:focus` | bg rgb(26,159,255) blue + ::after blue shine (`appdetails_notinstalled_top.png`) |
| Disabled (no action) | `%{PlayButtonContainer>Disabled}` | PlayButton bg #23262e, text/icon #3d4450, ::after hidden |
| Streaming selector | `%{StreamingSelector}` | transparent, caret #dcdedf; focus/hover bg #fff, caret #0e141b, ::after hidden |
| Stream from PC | `%{HasRemoteText}` + Green | two-line label (`appdetails_stream_friends.png`) |

Steam already uses **::after** on `%{PlayButtonContainer>ButtonChild}` (focus/hover shine with clip-path and keyframes `_3rmo1U-8M7_Hu57ndWeuIN`, `_2Ca2Rjcd06sD4qVaU6pG-j`). A theme must restyle that ::after rather than add a new one, and must not touch the container `min-width` / button `min-width:210px`.

### 3.2 Gear / controller buttons

`%{Container>MenuButton}` (both): `.BasicUI` 48x48, radius 2, bg rgba(172,178,201,.14), transition background-color .12s. `:focus` -> bg #fff, icon #0e141b (`appdetails_installed_gearfocus.png`). `%{MenuActive}` (menu open) -> rgba(172,178,201,.28). A stylesheet rule with `background:#000; border:1px solid #fff` also exists (high-contrast variant). No pseudos.

### 3.3 Running state (cannot be rendered: nothing may be launched; from source, module 85273)

When the app's action is `ResumeGameInProgress` (and `IN_GAMEPADUI`):
- main button label "Resume" (`#GameAction_ResumeGameInProgress`), **not** Green, so focused = blue rgb(26,159,255);
- an extra `div %{ShutdownAppButton}` (Stop, `#GameAction_Stop`) after it: 48x48, radius 2, bg rgba(172,178,201,.14); `.gpfocus` -> bg #fff color #000; `.gpfocus%{ForceShutdownButton}` -> bg rgb(222,54,24); hover rgba(205,213,226,.26); svg circle/polyline stroke rgba(255,255,255,.5);
- while stopping: `%{WaitingForShutdownSpinner}` (40x40 ring, border #1a9fff top/left, `%{WaitingForForceShutdown}` white) absolutely positioned;
- `Launching` state: `%{PlayButtonContainer>ThrobberContainer}` + throbber, label "Launching".
Activating Stop opens the "Exit game?" confirm (`#GameAction_ConfirmExitGameTitle`, `#AppOverlay_UnsavedDataWarning`) - a global modal; never confirm.

### 3.4 Private badge
`%{PrivateAppActiveIndicator}`: position absolute, 21x21, `inset-inline: auto -8px`, top -8px; inner `svg%{FeatureHidden}` white. Do not move it.

---

## 4. Options ("Manage", gear) context menu

Reach (installed): `--route /library/app/620980 --pre "L.click('main','%{Container>MenuButton}[aria-label=\"Manage\"]')"` **plus the delayed CLOSE from section 0** (or click Cancel). Before-shots:
- `appdetails_manage_menu.png` root menu (Beat Saber): Add to Favorites / Add to > / Manage > / Developer > / --- / Properties... / --- / Cancel
- `appdetails_manage_submenu_manage.png`: Hide this game, Unmark as Private, Uninstall
- `appdetails_manage_submenu_addto.png`: collections list (DS, Epic, GameCube, ... Xbox 360) / --- / + New collection...
- `appdetails_manage_submenu_developer.png`: Delete Proton Files
- `appdetails_manage_menu_notinstalled.png` (751630): Add to Favorites / Add to > / Remove from > / Manage > (Hide this game, Mark as Private) / Developer > / Properties... / Cancel
- `appdetails_manage_menu_shortcut.png` (2258399336): Manage > Hide this game, **disabled** "Mark as Private (Not available for non-Steam games)", Remove non-Steam game from your library
- Other items Steam can add (source, module 43394): Browse local files, Back up game files..., Add desktop shortcut, Controller layout, Clear/Reset Controller Layout, CD keys, Family > Allow/Deny for child, Remove from account, Dismiss from Play Next, Exit game / Stop streaming (running). Submenu open = tap the item (no side effect); NEVER activate a leaf item.

Structure (`--sel ".BasicUIContextMenu"`), rendered inside the shared modal stack:
```
div %{GamepadDialogOverlay} GamepadMode FullModalOverlay
 div ModalOverlayContent active   (+ sibling .ModalOverlayBackground: bg rgba(0,0,0,.85), backdrop-filter blur(3px)  <- the dim)
  div > div %{*GamepadDialogContent>ModalPosition} %{*GamepadDialogContent>VR} %{*GamepadDialogContent>FooterVisible}
   div BasicUIContextMenu %{*BasicContextMenuHeader>BasicContextMenuModal}   position:absolute; inset:0; flex column centered; transparent
    div %{*BasicContextMenuModal>BasicContextMenuHeader}   title text ("Beat Saber", or the open submenu name), #dcdedf, transparent
    div %{*BasicContextMenuModal>BasicContextMenuContainer}   flex row, max-width 70%; ENTRANCE KEYFRAME ANIMATION (transform) - do not override animation/transform
     div %{*BasicContextMenuModal>contextMenuContents} role=menu          one column per open level (submenu = 2nd contents column to the right)
      div %{*BasicContextMenuModal>contextMenuItem} contextMenuItem [%{*BasicContextMenuModal>SubMenu}] role=menuitem   280x48, padding 14, bg #23262e, text #b8bcbf, radius 0
        (submenu) div %{*BasicContextMenuModal>Label} + div %{*BasicContextMenuModal>Arrow} > svg SVGIcon_DownArrowContextMenu
      div %{*BasicContextMenuModal>ContextMenuSeparator} role=separator    2px, bg #000
```
States (all from stylesheet; Steam ships the same rules under the `%{*GamepadDialogContent>contextMenuItem}` and `%{*BasicContextMenuModal>contextMenuItem}` builds, use the `*` forms):
- focused: `%{*BasicContextMenuModal>Focused}` + `.gpfocus` -> bg #fff, text #0e141b (no outline)
- open-submenu parent: `%{*BasicContextMenuModal>active}` -> bg #fff, text #000
- hover: bg #3d4450 (Destructive/`.Stop` hover rgb(138,34,15); Positive/`.Play .Launch .Stream .Connect` and Emphasis/`.Download .Update .PreLoad` have coloured hover/focus variants)
- `%{*GamepadDialogContent>Selected}` bg #3d4450 #fff; `.disabled` text rgba(255,255,255,.3) (focused disabled rgba(0,0,0,.5)); `.menuChecked` #6dcff6
- No ::before/::after on menu, container or items.

### 4.1 "Play from" (streaming target) menu
Reach: `--route /library/app/620980 --pre "L.click('main','%{StreamingSelector}')"` + delayed CLOSE. Shot `appdetails_playfrom_menu.png`. Same modal/menu shell, header "Play from", items `div %{StreamingContextMenuItem} %{*BasicContextMenuModal>contextMenuItem}` with `span %{CheckContainer}` (svg SVGIcon_DialogCheck, blue check) + `span %{StreamingTargetLabel}` ("This Steam Frame", "Stream from: Ben-PC2"), separator, Cancel. Selecting a target changes a setting: look only.

---

## 5. Detail tabs (`%{GamepadTabbedPage}`)

```
div %{GamepadTabbedPage} %{CanBeHeaderBackground} [%{IsUnderHeader}] [%{AnimateDownwardExpansion}]
 div %{TabHeaderRowWrapper} [%{GamepadTabbedPage>Pinned}] [%{ScrolledDown}]   position:absolute top 0, padding 0 2.8vw, z-index 2, transform-style preserve-3d
  div %{TabRow}
   div %{Arrows} Panel Focusable (left/right chevrons, #8b929a, hover #fff)
   div %{TabRowTabs} role=tablist > div %{TabsRowScroll} > div %{FixCenterAlignScroll} %{ScrollPanel} %{ScrollX}   (horizontal scroller)
    div %{TabRowSpacer}
    div %{GamepadTabbedPage>Tab} [%{GamepadTabbedPage>Selected}] [%{HasAddon}] %{RightAddon} role=tab    pill, radius 64, 12px bold uppercase
      span %{GamepadTabbedPage>TabTitle}   (+ Game Info addon: svg %{HasHorizontalDirection>SteamDeckCompatIcon} %{HasHorizontalDirection>SteamDeckCompatVerified} (or %{HasHorizontalDirection>SteamDeckCompatUnknown}) %{Header>InvertFocusedIcon})
 div %{TabContents} > div %{ContentWrapper>TransitionGroup} > div %{ContentWrapper} %{GamepadTabbedPage>ContentTransition}   (tab-switch transition)
  div %{TabContentsScroll} _TabContentsScroll %{ScrollPanel} %{ScrollY} role=tabpanel     INNER SCROLLER
   div %{AppDetailsContent} > div %{SeekTarget} > sections...
```
Tab states: unselected transparent #dcdedf; `%{GamepadTabbedPage>Selected}` bg rgba(255,255,255,.15) (a second build rule uses rgba(189,197,206,.48)) #fff; hover rgba(255,255,255,.15) #fff; `.gpfocus` bg #fff text #23262e + box-shadow 0 3px 6px rgba(0,0,0,.32). Focusing a tab selects it.
Pinned/scrolled header: `%{GamepadTabbedPage}%{IsUnderHeader} %{TabHeaderRowWrapper}::before` and `%{TabHeaderRowWrapper}%{ScrolledDown}::before` = Steam's own **::before** (abs inset 0, z -1, bg rgba(0,0,0,.5), backdrop-filter blur(100px), shadow 0 4px 8px rgba(0,0,0,.5)), keyframe-animated in with `%{AnimateDownwardExpansion}` (`appdetails_installed_deepscroll.png`). Restyle this ::before; do not add another.

Shared section shell inside every tab:
```
div %{AppDetailsSection} [+ per-section modifier class] role=region
 h2 %{*Reset} %{SectionHeader} %{PadLeft} > div %{SectionHeader>Label} > div %{SectionHeader>LabelText}   (#fff 22px)
 div %{AppDetailsSectionContainer} %{AppDetailsSectionHasLabel} %{RightColumnSection}   bg rgba(103,112,123,.2), radius 0
  div %{AppDetailsSection>Highlight}   top strip, bg #23262e
  div %{AppDetailsSection>Body}
 button %{AppDetailsButton} %{AppDetailsButton>BottomRight} DialogButton _DialogLayout Secondary %{*GamepadDialogContent>Button}   bg #3d4450 radius 2 (generic dialog button styling)
```

### 5.1 Activity tab (default) — `--route /library/app/620980/tab/Activity`
Shots: `appdetails_installed_top.png`, `appdetails_activity_eventfocus.png` (card focused, scrolled), `appdetails_activity_friends.png` (377160, Friends who play).
- `div %{AppDetailsSection} %{ActivityFeedContainer}` > Body `%{ActivityFeedContainer>InnerContainer}`
- Post box: `div %{PostTextEntryArea>PostTextEntry} %{AddToFeed} %{ActivityFeedContainer>PostTextEntry}` > `textarea %{PostTextEntryArea}` (bg rgba(255,255,255,.1), radius 4, 0.67px transparent border, inset shadow; INLINE `height:20px;overflow:hidden;resize:none` (auto-grow) ; `:focus` bg #fff text #0e141b) + `div %{PostButton}` (bg #3d4450 r2, "Post"). Focusing/typing opens the keyboard and posting is a social action: look only.
- Day groups: `div %{AppActivityDay} role=region` > `h4 %{*Reset} %{AppActivityDate}` (#8a8a8a uppercase, rule line) > event:
  - medium: `div %{PartnerEventMediumImage} %{AppActivityDay>PartnerEvent} %{PartnerEventUpdate} %{Event}` (radial-gradient card, 0.67px transparent border, shadow 0 0 12px rgba(0,0,0,.145)) > `div %{PartnerEventMediumImage_Container} role=button` (same gradient; hover radial-gradient brighter + title #fff) > `%{PartnerEventMediumImage_Contents}` > `%{PartnerEventMediumImage_TextColumn}` > `%{PartnerEventType}`, `%{PartnerEventMediumImage_Title}`, `%{PartnerEventMediumImage_Summary}` (INLINE -webkit-line-clamp:2)
  - large/major: `div %{PartnerEventLargeUpdate} %{Event}` (blue linear-gradient from left, shadow 0 0 12px rgba(0,0,0,.675)) > `%{MajorUpdateContentContainer}` > `div %{LeftSideMajorUpdateBar}` (blue bar) + `div %{PartnerEventLargeImage_Container}` > `img %{PartnerEventLargeImage_Image} %{AppActivityDay>Blur}` (filter blur(32px) brightness .6 saturate 0) + `%{AppActivityDay>ImageContainer}` + `%{PartnerEventLargeImage_TextColumn}` > `%{PartnerEventType} %{PartnerEventTypeUpdate}`, `%{AppActivityDay>PartnerEventLargeImage_Title}`, `%{PartnerEventLargeImage_Summary}`
  - text-only: `div %{PartnerEventTextOnly} %{Event}` > `%{PartnerEventTextOnly_Container}` > `%{PartnerEventTextOnly_Icon}` (SVGIcon_Patch) + `%{PartnerEventTextOnly_TextColumn}`
  - `div %{RatingBar}` opacity 0, becomes visible when its event has focus > `%{CommentButton} %{CanClick}` (count + `%{ActivityCommentThreadMinimized>CommentIcon}`) and `%{LikeButton} %{CanClick}` (`%{LikeCount}`, `%{BackgroundEffects}` op 0, `%{LikeIcon}`); hover bg #323941. Like/comment are social actions: look only.
  - Focus on a card is drawn by the moving `%{FocusRing}` (section 9), the card itself gets `.gpfocus` without paint change. Footer gains "OPTIONS" legend.
  - Opening an event (A) shows the full-screen event overlay `%{PartnerEventOverlayContainer}` (not mapped; harmless but its contents are another surface of content).
- Friends who play (only when friends own it; e.g. 377160): `div %{FriendsSection>FriendsContainer} role=region` > SectionHeader "Friends" > `div %{AppDetailsSection} %{FriendsPlayingHalfSection}` > `h2 … div %{FriendsSectionSubHeading}` ("PLAYED PREVIOUSLY" / "playing now") > `%{AppDetailsSectionContainer}` > `div %{CollapsedFriendList}` > `%{ItemWrapper>InnerContainer}` > `%{ItemWrapper}` > `div %{GamepadFriendSectionItem} role=link` > `div %{avatarHolder} avatarHolder no-drag Small ingame` > `div %{avatarHolder>avatarStatus} avatarStatus bottom` (3px bar: green #59bf40 in-game, blue online) + `img %{avatar}`. Activating a friend opens their profile/menu: look only.
- Non-Steam shortcut: Activity tab is empty (`appdetails_shortcut_top.png`).

### 5.2 Your stuff — `--route /library/app/620980/tab/YourStuff`
Shots: `appdetails_tab_yourstuff.png`, `appdetails_tab_yourstuff_scrolled.png` (`--pre "L.q('main','%{PreventScrolling>ScrollContainer}').scrollTop=420"`), `appdetails_yourstuff_achievement_focus.png` (focused locked achievement expands), `appdetails_yourstuff_tradingcards.png` (2379780), `appdetails_yourstuff_workshop.png` (546560).
Sections, in order Steam renders them when applicable: Achievements, Steam Workshop, Trading Cards, DLC, Media, My Review, Notes.
- Achievements: Highlight `%{AppDetailsSection>Highlight} %{HighlightDiv}` > `%{UnlockedLabel}` (+ `%{UnlockedLabelPercent}` grey) + `%{AchievementProgressContainer}` (rgba(255,255,255,.24) r3) > `%{AchievementProgress}` (#1a9fff r2, INLINE width %). Body `%{AppDetailsSection>Body} %{BodyStopJiggle} %{BasicAppDetailsAchievementsSectionBody}` > `%{BoxCarousel}` > `%{BoxCarousel>BoxCarouselContents} [%{OnLastPage}]` (INLINE padding/scroll-padding) > `div %{AchievementCarouselItem} [%{Detailed}] role=button` (bg #3d4450 when detailed; Steam ANIMATES width/height .15s when focus expands it - never set width/height) > `div %{Achieved}|%{Container>NotAchieved} role=link` > `%{AchievementHoverContainer}` > `%{AchievementIconWrapper} %{InnerContainerLower>Icon} %{CarouselIcon} [%{Prioritized}]` > `img %{IconGlow>Icon}` (has **::after** loading-placeholder gradient) ; details `%{AchivementCarouselItemDetails}` > `%{InnerContainerLower>Name}`, `%{InnerContainerLower>Description}`, `%{Achieved}` %; `h3 %{*Reset} %{LockedAchievementsLabel}`. Activating -> achievements page (section 6).
- Steam Workshop: `%{AppDetailsSection} %{WorkshopSection}` > `%{AppDetailsSection>Highlight} %{WorkshopHightlight}` > `%{WorkshopContainer>WorkshopHeader}` > `%{FeaturedItem}` (`img %{FeaturedItemImage}`, `%{FeaturedItemDetailsContainer}` > `%{FeaturedItemHeader}`, `%{FeaturedItemName}`, `%{FeaturedItemDesc}`, `div %{FeaturedItemHideButton}` r4 X - **hides the item: never click**) ; Body `%{WorkshopContainer}` with two `%{AppDetailsButton}` links.
- Trading Cards: `%{AppDetailsSection} %{BadgeSection>Container}` > Highlight `%{Container>BadgeSection}` > `%{Container>Badge} %{Container>EmptyCircle}` (r50) + `%{Container>BadgeInfo}` (`%{Container>BadgeName}`, `%{Container>BadgeLevel}`) ; Body `%{CardsLeft}` + carousel of `%{TradingCardCarouselItem} %{Unowned}` > `%{CardWrapper}` (INLINE height) > `%{Container>Loaded} %{Card} %{Unowned}` (INLINE transform scale + left/top/size) > `%{CardContainer}` (bg #394149 r2, INLINE rotate3d tilt) > `img %{CardImage}` (INLINE filter saturate, op .3 unowned) + `%{CardShineContainer_W}` / `%{CardShineContainer_E}` / `%{CardShineContainer_S}` > `%{CardShine}` (INLINE position; animated shine). All those inline transforms are Steam's: do not touch.
- DLC: `%{AppDetailsSection} %{DLCSection}` > `%{DLC}` > `%{DLCSection>Item}` > `%{DLCArt}` > `%{PortraitImage>Container} %{GreyBackground} %{LandscapeImage} %{DLCSection>Art}` + `%{Gloss}` (gradient op .5) ; `%{DLCSection>Remainder}` "+ 9 More" (rgba(103,112,123,.2)).
- Media: `%{AppDetailsSection} %{ScreenshotsSection}` > `%{NoRecent}` (text + `%{LargeChordRow} %{NoButton}` > `%{ControllerInputDisplay} %{FieldInput}` > `%{ChordControlBinding}` glyphs) + button "Go to my media library" (navigates to /media, other area).
- My Review: `%{AppDetailsSection} %{InnerContainerLower2>Container}` > `%{Container>PlayedForTime}` + button "View all my reviews" (opens web).
- Notes: `button %{NoteLink} DialogButton … ` "New Note" (bg rgba(255,255,255,.15) r2; opens the notes editor - look only).

### 5.3 Community (guides, artwork, videos) — `--route /library/app/620980/tab/Community`
Shot `appdetails_tab_community.png` (outer scrolled 376).
```
div %{AppDetailsSection} %{CommunityContentContainer}  > h2 … %{HeaderStyles}
 div %{AppDetailsSectionContainer} > div %{HasBlanks>InnerContainer} role=grid
  div %{AppOverviewRow} %{AutoRow} %{Singles} role=row   INLINE grid-template-columns: repeat(4, minmax(250px,1fr)) (Steam-computed)
   div %{CommunityItem} %{InnerContainer>Small}|%{VideoAspect} IndexN role=gridcell   bg #23262e; hover multi-layer box-shadow
    div %{ChildItem}
     (guide) div %{Guide} role=button > %{InnerContainer>GuideTitle} "COMMUNITY GUIDE", %{HasBlanks>Body} > %{HasBlanks>TopSection} (r2) > %{InnerContainer>TopSectionInner} > %{PreviewContainer} > img %{InnerContainer>Preview} + %{HasBlanks>Header} > %{HasBlanks>Title}; %{InnerContainer>BottomSection} > %{HasBlanks>Description}
     (video/art) div %{ArtItem} > %{PreviewContainer} > div role=button > div %{InnerContainer>VideoPreview} (bg image) > img %{PlayLogo};  %{InnerContainer>BottomSection} (bg rgba(14,20,27,.72)) > %{DescriptionRow}
    div %{AuthorSection} > %{avatarHolder} … %{InnerContainer>Avatar} > img %{avatar}; %{AuthorName}
    div %{HasBlanks>MenuButton}  28x28 bg rgba(0,0,0,.5) r2, opacity 0 -> on hover opacity 1 + transform scale(1) (Steam animates; opens a per-item context menu: look only)
```
Infinite list: 18 rows / 7280 px after first load, more appended while scrolling. Focus = moving `%{FocusRing}`.

### 5.4 Game Info — `--route /library/app/620980/tab/GameInfo`
Shot `appdetails_tab_gameinfo.png`, compat modal `appdetails_compat_details_modal.png`.
```
div %{GameInfoContainer}
 div %{AppGameInfoContainer} %{AppDetailsExpanded} (or %{AppDetailsCollapsed}) %{SuppressTransition} %{AppGameInfoContainer>Glassy}   (> div:not(GameInfoShadow) gets transform scale(.5|.98|1) transitions: Steam-animated, do not touch)
  div %{ConciseContainer>Container}
   div %{ConciseContainer>InnerContainer} r4
    div %{ConciseContainer>Portrait} r2 > %{PortraitImage>Container} %{GreyBackground} %{Container>PortraitImage} %{BoxArt} > img
    div %{ConciseContainer>Description} %{SectionContainer} > %{GameDescription}
    div %{ConciseContainer>Stats} %{SectionContainer} > %{AssociationList} (%{ConciseContainer>Label} grey + %{Association} > a %{ConciseContainer>Name}) ; %{Release} > %{Container>Date}
    div %{FeaturesList} %{SectionContainer} > %{ExtraMargin>Container} Focusable > %{ExtraMargin>Icon} (op .5) + %{ExtraMargin>Label}
   div > div %{DeckVerifiedInfo} (bg #23262e r2) > %{ConciseContainer>Title} "Steam Frame Compatibility", %{ConciseContainer>CompatLabel} (+ compat icon), div %{ConciseContainer>Details} role=button (bg #3d4450 r2) -> opens modal 5.4.1
   div %{CompatToolContainer} "Runs on this computer via Steam Play …"
  div %{GameInfoShadow}  rgba(0,0,0,.667) r4, opacity 0 when expanded (transition .4s)
 div %{GameInfoQuickLinks} > %{BoxCarousel} > … > div %{Anchor} role=link (bg #3d4450 r2) > div %{LinksSection>Link} > span %{LinksSection>Text}   (Store Page, DLC, Community Hub, Discussions, Guides, Support: open the web browser surface)
     link states: `:focus-within` bg #fff text #0e141b; hover rgba(101,113,128,.357)
 div %{GameInfoCollections} > %{CollectionsHeaderContainer} > %{CollectionsHeader} ; %{CSSGrid>Container} (INLINE height) > %{CSSGrid} role=grid (INLINE grid-template-columns/rows/gap)
   div %{Collection} %{ScrollContainer>Medium} role=link (bg #313d53)  :focus bg #6278a3 + shadow; has Steam **::after** (diagonal gloss sweep + clip-path border, animated on .gpfocus)
     %{CollectionImage} > %{DisplayCaseContainerBounds} > %{DisplayCaseContainer} > %{AppGrid} > %{Container>CapsuleImage}… (tilted capsule wall, Steam transforms) ; %{CollectionLabel} > %{CollectionLabelCount}
```
Shortcut: Game Info has only the collections block.

#### 5.4.1 Steam Frame Compatibility modal
Reach: `--route /library/app/620980/tab/GameInfo --pre "L.click('main','%{ConciseContainer>Details}')"` + delayed CLOSE on the new `%{*GamepadDialogContent>ModalPosition}`. Read-only info dialog.
```
div %{*GamepadDialogContent>ModalPosition} %{*GamepadDialogContent>WithStandardPadding} %{*GamepadDialogContent>ScrollWithin} %{*GamepadDialogContent>VR} %{*GamepadDialogContent>FooterVisible} DeckVerifiedModalDialogClient
 div %{*GamepadDialogContent>ModalClickToDismiss}
 div %{*GamepadDialogContent_InnerWidth>GamepadDialogContent} DialogContent _DialogLayout role=dialog   bg #0e141b, 660 wide
  div %{GraphicalAssetsTabs} %{CompatibilityTabs} > div %{GraphicalAssetsTab} [%{GraphicalAssetsTabs>Active} ActiveTab] role=button  (pill r80, bg #17202c; active/focused bg #fff) > %{pillContent} (op .5 inactive) > device logo svg (%{SteamDeckDeviceIcon} %{SteamMachineDeviceIcon} %{SteamFrameDeviceIcon}) + rating icon %{BannerContainer>RatingIcon}
  div %{CompatibilityTabContent} > %{CompatibilityDetailsContainer} > %{BannerContainer>DialogHeader} (%{BannerContainer>DialogTitle}, %{AppTitleCategory}) ; %{CompatibilityDetailRatingSummary} (span %{Verified} green) ; %{CompatibilityDetailsInterior_NoScroll} %{ScrollPanel} %{ScrollY} > %{CompatibilityDetailsRow}…
```
Some ratings show feedback buttons (`%{DeckVerifiedFeedbackButton}` etc.): never click.

---

## 6. Achievements page — `/library/app/:appid/achievements/my/individual`
Shots `appdetails_achievements_my.png`, `appdetails_achievements_global.png` (tap the "Global Achievements" tab; the `/achievements/my/global` route alone does NOT switch tabs). Friend comparison: `/library/app/:appid/achievements/friend/:accountid[/individual|/global]` (needs a friend accountid; not captured).
```
div %{OverflowHidden>GamepadPage} %{Flexed} %{OverflowHidden}
 div %{AchievementList>Page} %{ScrollPanel} %{ScrollY}            OUTER scroller, bg #0e141b
  div %{FocusRing}
  div %{AchievementList>Background} > %{AchievementList>Blur} (gradient + backdrop-filter) + %{PortraitImage>Container} … %{AchievementList>HeaderImage}
  div %{Page>Container}
   div %{AchievementList>HeaderContainer} > %{LeaderboardsButton>Container} > %{Content>Portrait} (box art) + %{Portrait>Content}
     %{LeaderboardsButton>Title} ; focusable div > %{StatsBlock} (bg rgba(103,112,123,.2)) > %{Container>Stat} %{BigStat} > %{StatLabelAndValue} > %{Portrait>ProgressLabel} (%{LeaderboardsButton>Label}) + %{Container>Progress} > %{ProgressBarIndeterminate>ProgressBar} (#23262e r10) > %{Indeterminate>Percent} (#1a9fff r10) ; other %{Container>Stat} %{TextValue}
     div %{LeaderboardsButton} > button %{DropDownControlButton} … role=combobox "Leaderboards" (dropdown: look only)
   div %{AchievementTabs} > %{GamepadTabbedPage} (same tab strip as section 5)
    %{TabContentsScroll} > div %{*ListTitle>AchievementList} %{AchievementList>List} (bg #0e141b)
      %{AchievementSearchHeader} [%{MyAchievementsHeader}] > %{Portrait>SearchField} > DialogInput (search box) ; (global) %{LeftContent} > %{*AchievementList>Avatar} ; %{*AchievementList>HeaderText} "% of all players"
      My:   div %{*AchievementList>AchievementListItemBase} (bg #23262e) > %{*AchievementList>Container} > %{AchievementIconWrapper} > img %{IconGlow>Icon} ; %{*AchievementList>Content} > %{*AchievementList>VerticalContent} %{*AchievementList>AchievementContent} > %{*AchievementList>AchievementTitle}, %{*AchievementList>AchievementDescription}, %{*AchievementList>AchievementGlobalPercentage} %{*AchievementList>InBody} ; %{*AchievementList>Right} > %{*AchievementList>UnlockDate}
            div %{*AchievementList>ListTitle} (op .5) "LOCKED ACHIEVEMENTS"
      Global: div %{*AchievementList>GlobalAchievementListItem} role=button (bg #23262e) > %{*AchievementList>UnlockContainer} (check svg when unlocked) ; %{*AchievementList>Content} > %{*AchievementList>ImageContainer}, %{*AchievementList>Right} > %{*AchievementList>Info} (%{*AchievementList>Title}, %{*AchievementList>Description}) + %{*AchievementList>Percent} ; %{*AchievementList>ProgressFill} (rgba(103,112,123,.2), width = global % - Steam-set, do not touch width)
```
Not virtualized (full list, 2.4k px).

---

## 7. Properties (full-page PagedSettingsDialog) — `/app/:appid/properties[/page]`

Reach directly by route (no click needed): `--route /app/620980/properties/general`. Opening via the menu "Properties..." is identical. Pages present depend on the app:
- Installed Steam game (620980): General, Compatibility, Updates, Installed Files (`localfiles`), Game Versions & Betas (`betas`), Controller, DLC, Game Recording (`gamerecording`), Privacy, Customization, Performance. Shots `appdetails_props_<page>.png` for each.
- With Workshop (546560): + Workshop (`workshop`) -> `appdetails_props_workshop.png`.
- Not installed (751630): same minus Installed Files.
- Non-Steam shortcut (2258399336): Shortcut, Compatibility, Controller, Game Recording, Customization, Performance -> `appdetails_props_shortcut.png`.
- Other route keys Steam knows (conditional, not present on these apps): `language`, `feedback`.
Never toggle, pick dropdown values, type, or press Verify/Move/Check Code/Browse/Unsubscribe.

```
div %{OverflowHidden>GamepadPage} %{Flexed} %{OverflowHidden} %{DialogBackground}   bg radial-gradient (same as BasicHome); INLINE --gamepad-page-content-max-width
 div %{*GamepadDialogContent_InnerWidth>GamepadDialogContent} DialogContent _DialogLayout %{GamepadPageDialogContent} %{NoVerticalPadding} %{NoHorizontalPadding} %{GamepadPage>FullWidth}
  div %{*GamepadDialogContent>GamepadDialogContent_InnerWidth} DialogContent_InnerWidth
   div %{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog} %{AppProperties} %{GamepadUI}       bg #0e141b
    div %{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageListColumn} PageListColumn   256 wide, bg #2b2d33
     div %{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_Title} "Beat Saber" (#fff bold)
     div %{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageList} %{PagedSettingsDialog_PageList_ShowTitle} role=tablist
      div %{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageListItem} [%{PagedSettingsDialog_PageList_ShowTitle>Active}] role=tab
        div %{ScaledChildren} > div %{PagedSettingsDialog_PageList_ShowTitle>PageListItem_Title}
    div DialogContentTransition %{PagedSettingsDialog_PageList_ShowTitle>PagedSettingDialog_ContentColumn}   bg #1a1c21
     div %{ContentWrapper>TransitionGroup} [%{PagedSettingsDialog>Down}] > div %{ContentWrapper} %{PagedSettingsDialog>ContentTransition}
      div %{*GamepadDialogContent_InnerWidth>GamepadDialogContent} DialogContent _DialogLayout %{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageContent} role=tabpanel   <- scroller (overflow-y auto) on long pages (DLC, Privacy)
       div %{*GamepadDialogContent>GamepadDialogContent_InnerWidth} DialogContent_InnerWidth
        div DialogHeader role=heading ; div DialogBody [%{NoScroll}]
```
Page-list item states: inactive #b8bcbf transparent; `%{PagedSettingsDialog_PageList_ShowTitle>Active}` linear-gradient(90deg, rgba(26,159,255,.22) -> 0) #fff and `%{ScaledChildren}` transform scale(1.1) (Steam transform, keep); `:focus`/`.gpfocus` gradient rgba(26,159,255,.4) + border-left 2px #1a9fff; hover rgba(255,255,255,.05); `%{PagedSettingsDialog_PageList_ShowTitle>DisabledItem}` dimmed. Item has transition on transform/background; focusing an item opens that page.

Common field primitives on every page (shared with Settings, documented here only for completeness):
`DialogControlsSection [DialogLabelledControlsSection DialogSettingsSection]`, `SettingsDialogSubHeader`, `%{*GamepadDialogContent>Field} %{*GamepadDialogContent>VerticalAlignCenter} %{*GamepadDialogContent>WithBottomSeparatorStandard} %{*GamepadDialogContent>ExtraPaddingOnChildrenBelow} %{*GamepadDialogContent>StandardPadding} %{*GamepadDialogContent>HighlightOnFocus} %{*GamepadDialogContent>Background}` (bg #23262e r2; `.gpfocuswithin` bg #373940; transform transition; INLINE --indent-level) > `%{*GamepadDialogContent>FieldLeftColumn}` > `%{*GamepadDialogContent>FieldLabelRow}` > `%{*GamepadDialogContent>FieldLabel}` / `%{*GamepadDialogContent>FieldDescription}` ; `%{*GamepadDialogContent>FieldRightColumn}` > `%{*GamepadDialogContent>FieldChildrenWithIcon}` > `%{*GamepadDialogContent>FieldChildrenInner}`;
toggles `%{*GamepadDialogContent>Toggle} [%{*GamepadDialogContent>On}] role=checkbox` > `%{*GamepadDialogContent>ToggleRail}` (rgba(255,255,255,.15) r9001; Steam **::before** blue #1a9fff fill when On) + `%{*GamepadDialogContent>ToggleSwitch}` (#fff knob, Steam moves it); focused toggle has Steam **::after** ring (bg #8b929a, inset -3.5px, r16);
dropdowns `button %{DropDownControlButton} DialogButton _DialogLayout Secondary %{*GamepadDialogContent>Button} role=combobox` (rgba(255,255,255,.15) r2) > `%{*GamepadDialogContent>DropDownControlButtonContents}` > `DialogDropDown_CurrentDisplay` (+ rich label `%{DropDownLabelContainer}` > `%{DropDownLabelTextColumn}` > `%{DropDownLabelTitle} %{ThrobberContainer>DropDownLabel}` (`span %{DefaultOptionText}`) + `%{DropDownLabelDescription}`);
text inputs `DialogInput_Wrapper _DialogLayout` > `input %{*GamepadDialogContent>BasicTextInput} DialogInput DialogInputPlaceholder DialogTextInputBase` (rgba(255,255,255,.1)); checkboxes `DialogCheckbox_Container _DialogLayout` > `DialogCheckbox [Active]` (rgba(0,0,0,.267) r2) + `DialogToggle_Label`; buttons `%{ThrobberContainer>SettingsDialogButton}` / `%{SettingsDialogSubHeader>SettingsDialogButton} DialogButton … Secondary`.

Page-specific tokens:
- General: overlay toggle, "Maximum Game Resolution" (`%{TopGapSmall}`, `img %{GameResolutionGlyph}`), Launch Options (`%{Detail}`, `%{AsyncBackedInputChildren}` input), `%{SectionTopLine}`.
- Compatibility: `%{EnableSteamPlayForOthersDropdownButton}` dropdown, "Show all compatibility tools" toggle, `DialogCheckbox_Container … %{ThrobberContainer>Checkbox}` "Override ARM Translation Options" (bg rgba(59,63,72,.5) r3).
- Updates: two full-width rich dropdowns (`%{BottomGap} %{ThrobberContainer>FullWidth} … %{*GamepadDialogContent>WithChildrenBelow}`), `%{BuildInfo}` (App ID / Build ID / updated date).
- Installed Files: `%{BrowseDiskRow}` > `%{BrowseDiskSizeLabel}` + `%{BlueHighlight} %{BrowseDiskSize}` ; `%{SectionTopLine} %{ThrobberContainer>NoPadding}` with "Move install folder" and "Verify integrity of game files" buttons (both are actions: never press).
- Game Versions & Betas: `%{NoBottomGap}` field ; table `%{BetaHeaderRow}` (bg #3d4450, cells `%{BetaRadioButton}`, `%{BetaName}`, `%{BetaLastUpdated}` role=columnheader) ; `%{BetasTable}` role=table > `%{BetaRow} [%{ThrobberContainer>Selected}] %{EvenRow}|%{OddRow}` (even #2c303a, odd #23262e) > radio `input`, `%{NameText}`, `%{DescText}` ; `%{TopGapLarge} %{BetaLabel}` ; `%{BetaAccessCodeRow} %{TopGapSmall}` (input + `%{CheckButton}`). Selecting a row switches branch: never.
- Controller: intro text with `span %{SteamInputLink}` "Controller Configurator" ; override dropdown ; `%{TopGap} %{SteamInputStatus}` ; `%{TopGapSmall} %{SteamInputStatusGrid}` (rgba(59,63,72,.2) r3) > `%{ThrobberContainer>Controller}` (+ `%{ControllerPip}` 8x8 r6) + `span %{SteamInputStatus}`.
- DLC: `%{DlcTopRow}` ("View more in Store" `%{ViewMore}` + filter input) ; `%{DlcGrid}` role=table (bg #23262e) > `%{DlcHeader}` (#3d4450, sort caret `%{ThrobberContainer>TriangleUp}`) ; cells `%{Install}` (DialogCheckbox Active - unchecking uninstalls DLC: never), name link `%{ThrobberContainer>Name}` > `%{DlcArt} %{DLCArt}` + `%{NameText}`, `%{Added}`, `%{SizeDisk}` (tool-tip-source). Page scrolls.
- Game Recording: one field + "Manage Game Recording" button.
- Privacy: two toggles (Hide in library, Mark as Private) ; `%{PrivacyDLCSection}` > field with `%{PrivacyDLCDescription}` + `button %{ThrobberContainer>PrefDetailsToggle} %{ThrobberContainer>Selected} DialogButton _DialogLayout Small` (expand/collapse; harmless) ; `%{PrivacyDLCList}` role=list > `%{PrivacyDLCRow}` > `%{CheckboxCol}` (DialogCheckbox bg #000) + `a %{DLCTitleArea}` (art + `%{NameText}`). Page scrolls (1.4k).
- Customization: `%{SortAs}` field "Custom Sort Name" (input).
- Performance: toggles "Renderpass Optimizations" (`%{SecondaryText}`), "Foveated Rendering", dropdown "ARM Translation Memory Ordering".
- Workshop: `DialogTwoColLayout _DialogColLayout` (two buttons, `%{ThrobberContainer>SortCaret}`) ; `%{WorkshopTopRow}` > `%{WorkshopOptionsContainer}` (DialogLabel + filter input ; Sort By `%{DropDownControlButton} %{SortBy}`) ; `%{WorkshopItemsRowsScrollable}` > `%{WorkshopItemRowsScroll}` role=list (own scroller) > `%{WorkshopItemRow}` (#23262e) > `%{Install}` checkbox, `a` > `%{ThrobberContainer>Details}` > `img %{PreviewArt}`, `%{TextDetails}` (`%{NameText}`, `%{WorkshopItemTagsContainer}`), `svg %{ThrobberContainer>DragHandle}` (op .1) ; `%{SortedColumn}` size ; `%{ThrobberContainer>Controls}` > `button %{UnsubscribeButton} … hasSVGIcon` (**never press**).
- Shortcut (non-Steam): `%{ShortcutRow}` > `%{ThrobberContainer>Icon}` (`%{PortraitImage>Container} %{GreyBackground} %{ThrobberContainer>AssetImage}`) + `%{ThrobberContainer>Name}` (name input) ; `%{SectionTopLine}` > `%{ThrobberContainer>Title}` "Target" + input + `%{ShortcutChange}` "Browse..." ; "Start In" (`%{TopGap}`) ; "Launch Options" ; resolution dropdown ; overlay toggle ; `%{TopGapLarge}` "Include in VR Library" toggle.
Note: in `appdetails_props_privacy.png` gamepad focus happened to sit in the header search box, showing its focused state (white field) - that is the header area's state, not a properties state.

---

## 8. Controller configuration entry

`%{ControllerConfigButton}` in the play bar. In gamepad UI its click runs `EnsureEditingConfiguration(appid)` then pushes `/app/:appid/controllerconfigurator/main` (module 89980). Look only: `--route /app/620980/controllerconfigurator/main` -> `appdetails_controllerconfig.png`. With no gamepad connected it shows only the empty state:
```
div %{OverflowHidden>GamepadPage} %{PadForHeader} %{PadForFooter} %{Flexed} %{OverflowHidden} %{ControllerConfiguratorGamepadPage}
 div %{ControllerConfiguratorMain} %{ScrollPanel} %{ScrollY} role=tabpanel (bg #0e141b)
  div %{ControllerConfiguratorBackgroundContainer>TopSection} %{ControllerConfiguratorBackgroundContainer>Grow} (bg #0a0e13)
   div %{ControllerConfiguratorBackgroundContainer>Inner} > div %{NoControllerColumn} > svg %{NoControllerSVG} + %{NoControllerLabel} "No controller connected."
```
Header switches to title mode ("Beat Saber Controller Settings", no search). The full configurator needs a connected gamepad and belongs with the controller-settings area. Its routes (from the route table, module 80344): `/app/:appid/controllerconfigurator/{main|summary|preview|sharedlayout|actionsets|buttons|dpad|triggers|sticks|touchpads|gyroscopes|virtualmenus|chooseconfiguration|chooseconfiguration/community}` plus `choosebinding/…`, `modesettings/…`, `mouseposition/…`, and `/standalonecontrollerconfigurator`.

---

## 9. Focus, hover, selected, disabled: summary for this area

- Gamepad/laser focus = `.gpfocus` (+ `.gpfocuswithin` on ancestors) and, for real buttons, DOM `:focus`. Most cards (activity events, community items, achievement rows, DLC tiles, stat block on the achievements page, friend avatars) do **not** paint focus themselves: Steam draws a separate ring:
  `div %{FocusRingRoot}` (position absolute, z-index 10000, pointer-events none) > `div %{FocusRing}` — INLINE `left/top/width/height` (Steam moves/resizes it every focus change), `outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px`, 4 keyframe animations (flash, grow, fade, 20x blink). A theme may recolour/round the outline but must not touch position/size/inline style or remove it. One ring lives per page container (the achievements page has its own inside `%{AchievementList>Page}`, the compat modal has one inside the ModalPosition).
- Self-painting focus: Play/Install/Stream button (green/blue fill + ::after shine), gear/controller buttons (#fff), tabs (#fff pill + shadow), context-menu items (#fff), quick links (`:focus-within` #fff), collections (:focus #6278a3 + ::after sweep), properties page list (blue gradient + left border), dialog fields (#373940), toggles (::after ring), compat modal tabs (#fff pill), carousel achievement (expands to %{Detailed}).
- Selected: `%{GamepadTabbedPage>Selected}` (rgba(255,255,255,.15) pill), `%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageListItem}%{PagedSettingsDialog_PageList_ShowTitle>Active}` (faint blue gradient), `%{*BasicContextMenuModal>active}` (open submenu parent, #fff), `%{BetaRow}%{ThrobberContainer>Selected}`, `%{GraphicalAssetsTabs>Active}`.
- Disabled: `%{PlayButtonContainer>Disabled}` (#23262e / #3d4450 text), `contextMenuItem.disabled` (rgba(255,255,255,.3)), `%{ShutdownAppButton}%{PlayButtonContainer>Disabled}` (svg op .3), `%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageListItem}%{PagedSettingsDialog_PageList_ShowTitle>DisabledItem}`.
- Hover rules exist for: play button children, streaming selector, menu buttons (only %{MenuActive}/:focus are distinct in BasicUI), tabs, arrows, event cards (brighter radial gradient), community items (shadow + reveal menu button), quick links, rating buttons, context-menu items, page-list items.

Steam-owned pseudo-elements found (content != none) in this area: `%{Profile>Header}::before` (header dim), `%{BackContainer}::after` (divider, header area), `%{PlayButtonContainer>ButtonChild}::after` (focus/hover shine), `%{IconGlow>Icon}::after` (achievement icon placeholder), `%{Collection}::after` (gloss sweep), `%{TabHeaderRowWrapper}::before` (pinned/scrolled tab bar glass), `%{*GamepadDialogContent>ToggleRail}::before` (on fill), `%{*GamepadDialogContent>Toggle}.gpfocus::after` (ring). Everything else on these screens has free ::before/::after.

Inline styles / transforms Steam owns here (never override): `%{BoxSizer}` left/top/width/height; `%{AchievementProgress}` width; `%{*AchievementList>ProgressFill}` width; `%{AchievementCarouselItem}` animated width/height; trading-card `%{Container>Loaded} %{Card}` transform/size, `%{CardContainer}` rotate3d, `%{CardImage}` filter, `%{CardShine}` position; `%{BoxCarousel>BoxCarouselContents}` padding/scroll-padding; `%{CSSGrid}` grid template; `%{AppOverviewRow}` grid columns; `%{CSSGrid>Container}` height; `%{PostTextEntryArea}` height; `%{PartnerEventMediumImage_Summary}/%{PartnerEventLargeImage_Summary}` line clamp; `%{Profile>Header}` header-opacity vars; `%{FocusRing}` geometry; route/tab transition classes (`%{TopLevelTransition}`, `%{GamepadTabbedPage>ContentTransition}`, `%{PagedSettingsDialog>ContentTransition}`); `%{AppGameInfoContainer}` child scale transitions; `%{*BasicContextMenuModal>BasicContextMenuContainer}` entrance animation; `%{ScaledChildren}` scale(1.1).

---

## 10. Running VR app overview ("Resume Game / VR Controller Bindings / VR Video Settings / Exit Game")

**These four labels are not Steam strings.** They are SteamVR's: `/opt/steamvr/resources/webinterface/dashboard/localization/dashboard_english.json` keys `Return_To_Game` ("Resume Game"; `Return_To_Home` for the home app), `VR_Controller_Bindings`, `VR_App_Video_Settings`, `Exit_Game` (`Exit_Home`), plus `Clear_PerfCriteria_Status` (dev setting). The component is SteamVR's **"Now Playing" dashboard page** in `dashboard/chunk~8012d0c89.js` (loaded by `systemui.html`/`systemui.js`), rendered by **vrwebhelper** (SteamVR's own CEF, pid "vrwebhelper -lang=en_us -forceOnPaint=cpu"), not by steamwebhelper.

Why it cannot be mapped live:
- It is not in Steam's SharedJSContext/webpack and not a `valve.steam.gamepadui.*` overlay; vrwebhelper exposes **no devtools port** (only 8080 = steamwebhelper is listening), so glass-shell cannot inject CSS into it at all.
- It is **suppressed on this Frame right now**: `function k(){ return Capabilities.Q(23, MutualLocal) ? null : <FramePage title="#Now_Playing" …> }` and Steam reports mutual capability 23 (`SteamClient.OpenVR.GetMutualCapabilities()` = [1,2,3,5,6,8,9,10,11,14,15,16,18,19,20,21,23,24,26,28,29,30,31,32,33,34,35,37,38,39]). Capability 23 is Steam's `AN` constant (module 67763); Steam uses it (module 57531) to start a running VR app's overlay window at `/apprunning` instead of `/app/:appid/overlay`. So with 23 mutual, SteamVR hides Now Playing and Steam owns the running-app UI (inference from both sources; the capability has no readable name in either bundle).
- Nothing may be launched, so no running-app state is renderable either way.

What it would look like (source + `css/chunk~93a8598f9.css`, plain unhashed classes):
```
FramePage (summonOverlayKey "…nowplaying") > div#nowplayingpanel.SettingsMain.NowPlaying (DashboardPanel; flex row, padding var(--dashboard-panel-padding) 6rem)
 .HeroBackground (abs, background cover, filter brightness(40%) blur(50px), transform scale(1.15), z -1)
 div.ArtworkColumn  (500px wide, 600x900 portrait ratio, radius calc(var(--settings-control-inner-border-radius)/2), box-shadow 0 7px 70px -5px #000)
  div.PortraitAppImageContainer[.Fallback] > .IconBackgroundBlur (blur 16px) + img + div.Title (only shown for .Fallback, 32px)
 div.InfoColumn (margin 0 200px 0 150px)
  div.NowPlayingAppTitle (3em bold, margins 70/100)
  button.GamepadUIButton.gamepaduibutton_GamepadUIButton_3cM9m[.gamepaduibutton_Primary_lgv_H][.gamepaduibutton_Highlighted_a5G_1].gamepaduibutton_FocusRing_3Fr_z[.gpfocus] x N:
     ResumeButton (primary)  "Resume Game"        margin-bottom 45px
     "VR Controller Bindings"  -> opens SteamVR ManageBindings modal (f.r)
     "VR Video Settings"       -> opens SteamVR per-app video settings modal (y.xR)
     "Exit Game"               -> frame.closing.RequestClose() (only if /settings/dashboard/allowAppQuitting)
```
Button paint: base #3d4450 text #dfe3e6 radius 4 font 1.5em, line-height 32px; hover/.gpfocus #464d58 #fff; active #393f49 + shadow; Primary: linear-gradient(to right,#47bfff 0%,#1a44c2 60%) 330% wide, background-position animates 25% -> 0% on focus; .Disabled rgba(61,68,80,.35) #464d58; ::before = hover drop shadow (0 8px 16px rgba(0,0,0,.3)); .FocusRing.gpfocus::after = 4px rgba(255,255,255,.6) outline offset 4px with Flash/GrowOutline/FadeOutline/Blinker keyframes. Gamepad: L/R shoulder moves focus, A activates, B = Resume.

What Steam shows instead while a VR game runs (cap 23 present), all source-only:
- Game page play bar: "Resume" + `%{ShutdownAppButton}` Stop (section 3.3). Stop opens "Exit game?" confirm.
- The running game's **frame menu** (`frame.menu` surface; Steam module 53487 renders SteamVR-provided frame actions with Steam module 71702's list): "Controller settings" (-> `/app/:appid/overlay/controller`), "Game details" (-> `/library/app/:appid`), "Achievements", "Guides", "Notes", "Game Recording", plus a "Switch Windows" list (`%{NavigationMenuItemSeparator}`, `%{SwitchAppsTitle}`, `%{SelectableAppWindow}`). "Resume game" is omitted in VR and "Exit game" is omitted when mutual cap 28 is present (SteamVR's frame close button labelled "Exit Game" from `#Exit_Game` takes over). Item components there are the frame-menu primitives of the `frame.menu` area.
- Per-app overlay routes `/app/:appid/overlay[/achievements|/controller|/guides|/notes|/browser|/gamerecording]` (`%{NavigationColumn}`, `%{NavigationBox}`, `%{NavigationMenuItem}` + `%{*ActiveDot}`, `%{AppColumn}`, `%{CurrentGameLogo}`) only exist in a running app's overlay window; `L.nav('/app/620980/overlay')` in `main` is a no-op (route unchanged).
- `/apprunning` (GamepadUI.AppRunning, component k5 in module 46307) renders `%{MainPanelAppRunning}` (a loading throbber; after 5 s "abort" is enabled and B calls `SteamClient.Apps.TerminateApp`). With nothing running, the main window runs a one-shot effect (`yo()`, `qo()`; not verified what they do). Not visited during mapping. **Never visit it while a game is running and never press B there.**

---

## 11. Not reached / not captured, and why

- Running-game states (Resume/Stop bar, frame menu items, `/apprunning`, overlay routes, SteamVR Now Playing): would require launching a game (forbidden). Mapped from source above.
- SteamVR Now Playing page: separate vrwebhelper process without a devtools port, and currently disabled by capability 23 (section 10).
- Install flow dialog (Install button), Uninstall confirm, Remove-shortcut confirm, Hide-game, Mark-private, Delete Proton Files, collection add/new, Verify/Move files, beta switch, DLC (un)install checkboxes, workshop unsubscribe, featured-item hide, Post/Like/Comment, New Note: all have side effects; only their entry points are documented.
- Friend achievement comparison (`/achievements/friend/:accountid`), leaderboards dropdown/page, event overlay (opened activity event), community item context menu, media library (`/media`): reachable but not captured (low priority / other areas). Each is look-only safe; open with `L.click` and close with the CANCEL event.
- Full controller configurator: needs a connected gamepad ("No controller connected." is the only reachable state).
- Language / Feedback property pages: not offered by any of the test apps.
- `%{PlayBarIconAndGame}` and `%{PlayBarShowing}`: compact play-bar mode never shown in the VR layout (stays opacity 0).
