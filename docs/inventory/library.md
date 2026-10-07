# Inventory: area `library` (surface `main`)

Covers `/library/home` (Recent Games shelf + the WHAT'S NEW / FRIENDS / RECOMMENDED home tabs), `/library` and every library tab, collection pages, the library grid capsules, sort / filter controls and their menus, empty states, the capsule context menu, and search (`/search`).

Mapped live on the Frame on 2026-10-06 with the theme **off**. Every shot is a before-shot (`--theme off`), 1.5x (1920x1080), saved as `shots/library_*.png`. Tokens are copied from `python glass.py outline` output. Steam's CSS rules quoted below were read from the live stylesheets of the `main` window, with hashes turned back into tokens. A rule prefixed `@Media((prefers-contrast: more))` only applies in high-contrast mode.

Source modules (webpack ids in this Steam build), for re-reading Steam code via `webpackChunksteamui`:
- `46307`: the big gamepadui chunk. It holds `GamepadLibrary` (functions `x5`/`E5`/`M5`: tab list), the VR sub-tab pills (`I5`, `S5`), the collection grid (`q2`), the Collections tab (`T5`, `D5`, `C5`), the Non-Steam tab (`m5`), the home Recent Games shelf, and `GamepadSearch` (`eA`, `Xd`, `rA`, `ju`, `gA`).
- `71395`: grid controls. It holds the sort context menu (`q`), the filter footer label (`Be`), the sticky section header (`et`), the gamepad grid `lx`, the empty-grid message `Ve` and the desktop sort dropdown.
- `10272`: `GamepadTabbedPage` (tab row, arrows, `SortAndFilterContainer`).
- `98729`: the Library Filters dialog.
- `377`: the context menu manager (`lX` creates a menu; `XX.GetContextMenuManager(win)`).
- `54654`: the virtual gamepad events (`vgp_*`).
- `20505`: the gamepad button enum (OK=1, CANCEL=2, SECONDARY=3 (X), OPTIONS=4 (Y), START=14 (menu)).
- `80344`: the route table.
- `84114`: VR gamepad input, which holds `IsInGamepadNav`.

---

## 0. How to reproduce (read first)

### 0.1 Pitfalls

1. **Git Bash rewrites routes.**
   - `--route /library/home` becomes `C:/Program Files/Git/library/home` and Steam navigates to garbage.
   - Several agents hit this today; the live route was seen as `/settings/C:/Program Files/Git/chat`.
   - Always run `export MSYS_NO_PATHCONV=1` first in Git Bash, or use PowerShell.
2. **The UI is shared, and other agents' modals and context menus stay open across navigation.**
   - Context menus and `GamepadDialogOverlay` modals belong to the window, not the route, so `L.nav` does **not** close them.
   - Three of my first shots captured another agent's "Beat Saber" context menu or settings dropdown.
   - Before trusting a shot, check that `L.qa('main','.ModalOverlayContent.active').length` is 0. The `--pre` snippets below return it.
3. **Synthetic events cannot trigger CSS `:hover`.** Every `:hover` state below comes from Steam's stylesheet, not from a shot.
4. **Controller-only actions (Sort, Filter, capsule menu) are reached by dispatching Steam's virtual gamepad events on a capsule.**
   - Steam listens for `vgp_onoptions` (Y = Sort), `vgp_onsecondaryaction` (X = Filter) and `vgp_onmenu` (≡ = capsule menu).
   - These are bubbling `CustomEvent`s with `detail:{button,source:0,is_repeat:false}`.
   - This has no side effects: it only opens the menu or dialog.

### 0.2 Closing what you open (tested)

- **Context menus** (sort menu, capsule menu, submenus):
  - Neither `L.nav` nor `L.back` closes them.
  - `vgp_oncancel` removes the DOM but leaves the menu instance "visible" in the manager. That breaks the next menu, so don't use it.
  - Use the manager, and only on menus you opened yourself. The snippets record the set of menus first, then call `m.Hide()` on the new ones.
  - Avoid `HideActiveMenu()`: it can close another agent's menu.
- **Library Filters dialog**: dispatch `vgp_oncancel` on its focused row. Navigating away also unmounts it, because the dialog is rendered inside `GamepadLibrary`.
- **Dropdown menus inside the filter dialog** (`CompatDropDown`): these are `ModalManager` modals. Close them with `const mm=SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.ModalManager; mm.RemoveModal(<the modal you added>)`. Cancel did **not** close one.

### 0.3 Reusable `--pre` snippets (all tested verbatim from Git Bash with `MSYS_NO_PATHCONV=1`)

Click a tab by its label (works for the home tabs, the library tabs and the search tabs):
```
--pre "(async()=>{const t=L.qa('main','%{GamepadTabbedPage>Tab}').find(e=>/^Friends/i.test(e.textContent.trim()));t.setAttribute('data-x','t');L.click('main','[data-x=t]');t.removeAttribute('data-x');await new Promise(r=>setTimeout(r,1200));L.q('main','%{ScrollArea}').scrollTop=420;return L.route()+' overlays='+L.qa('main','.ModalOverlayContent.active').length})()"
```
(`:nth-child` does not work for tabs: `%{FocusRingRoot}` divs are siblings of the tabs.)

Open the Sort menu (Y) and auto-close it after 5 s (use `--settle 1.5`):
```
--pre "(async()=>{const W=L.surface('main');let q;webpackChunksteamui.push([[Symbol()],{},r=>q=r]);const cm=q('377').XX.GetContextMenuManager(W);const pre=new Set(cm.GetAllMenus());L.q('main','%{CSSGrid} %{LibraryItemBox}').dispatchEvent(new W.CustomEvent('vgp_onoptions',{bubbles:true,cancelable:true,detail:{button:4,source:0,is_repeat:false}}));await new Promise(r=>setTimeout(r,900));const mine=cm.GetAllMenus().filter(m=>!pre.has(m));setTimeout(()=>mine.forEach(m=>m.Hide()),5000);return 'opened '+mine.length})()"
```
- For the **capsule menu**, replace `'vgp_onoptions'` / `button:4` with `'vgp_onmenu'` / `button:14`.
- For the **Add to submenu**, add `L.click('main','.BasicUIContextMenu %{*BasicContextMenuModal>SubMenu}');await new Promise(r=>setTimeout(r,1000));` after opening, and recompute `mine` after that click.
- If module id `377` changes after a Steam update, find it with `Object.keys(q.m).find(k=>q.m[k].toString().includes('GetContextMenuManagerFromWindow'))`.

Open the Library Filters dialog (X) and auto-close it:
```
--pre "(async()=>{const W=L.surface('main');const ev=(el,n,b)=>el.dispatchEvent(new W.CustomEvent(n,{bubbles:true,cancelable:true,detail:{button:b,source:0,is_repeat:false}}));ev(L.q('main','%{CSSGrid} %{LibraryItemBox}'),'vgp_onsecondaryaction',3);await new Promise(r=>setTimeout(r,1000));setTimeout(()=>{const d=W.document.querySelector('[role=dialog]');if(d)ev(d.querySelector('.gpfocus')||d,'vgp_oncancel',2);setTimeout(()=>{if(W.document.querySelector('[role=dialog]'))L.nav('/library/home')},700)},4000);return 'ok'})()"
```
- To scroll inside the dialog before capture, add `L.q('main','%{DialogWrapper}').scrollTop=700;` (or `1500`, or `1e5` for the bottom).

Type into the header search and clear it again 4.5 s later:
```
--pre "(async()=>{const W=L.surface('main');const i=L.q('main','%{SearchBox}');const s=Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype,'value').set;s.call(i,'half');i.dispatchEvent(new W.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,2500));setTimeout(()=>{s.call(i,'');i.dispatchEvent(new W.Event('input',{bubbles:true}))},4500);return L.route()})()"
```

### 0.4 Routes in this area (from module `80344`)

| Route | What it shows |
|---|---|
| `/library/home` | Home: Recent Games shelf, plus a tabbed page with WHAT'S NEW / FRIENDS / RECOMMENDED |
| `/library` | `GamepadLibrary` on the last-used tab (`SetLastLibraryTab`) |
| `/library/tab/<id>` | Library tab. The ids live here: `AllGames`, `GreatOnFrame`, `ReadyToPlay`, `Collections`, `DesktopApps` (label "Non-Steam"), `Soundtracks` |
| | Ids that exist in code but not for this account/device: `Installed` (hidden on the Frame), `Favorites` (0 favourites), `RemotePlay`, `Xbox`/`PS4`/`PS5`, `GreatOnDeck`, `GreatOnMachine`, `SteamOSCompatible`, `VR` |
| `/library/collections` | The Collections tab, all-collections grid |
| `/library/collection/<id>` | One collection, under the Collections tab. Ids from `collectionStore.userCollections`: |
| | `uc-QEu45ND5z53u` = "VR" (27 apps) |
| | `uc-siYTOZsiQgri` = "Epic" (0 apps) |
| | `favorite` = Favorites (0 apps) |
| | `type-music` = Soundtracks, `local-install`, `uncategorized` |
| `/library/collection/<id>/<appid>` | App inside a collection. This is the game page, not this area |
| `/search`, `/search/tab/<id>` | Search results. Tab ids: `All`, `Library`, `Friends`, `Store`, `Tools`, `Hidden`. `Hidden` only shows when there is a query and hidden apps match |

---

## 1. Chrome shared by every screen in this area

### 1.1 Window root (global; listed for context)

```
body %{*PopupBody} GamepadMode BasicUI %{SteamUIPopupWindowBody} %{GamepadUIPopupWindowBody} LowPerfMode WindowFocus
  div %{SteamUIPopupWindow}
    div BasicUI GamepadMode %{BasicUiRoot} %{SteamUIPopupHTML>VR} MediumWindow WideWindow    r=6
        inline: --basicui-header-height: 40px; --gamepadui-current-footer-height: 42px   (Steam-owned)
      div %{MainNavMenuMainSplit}
        div %{BasicHome} %{OpaqueBackground}          <- the opaque page background
          div %{GamepadDialogOverlay} GamepadMode FullModalOverlay   (modals and context menus mount here; inline display:none when empty)
          div %{Profile>Header} …                     (header, 1280x40)
          div %{PopupBody>Content}
            div %{PartnerEventOverlayContainer>AppDetailsMain}
              div %{TopLevelTransitionSwitch} > div %{ContentWrapper} %{TopLevelTransition} [%{NoTransitionZoom}] %{TopLevelTransitionSwitch>Enter} %{TopLevelTransitionSwitch>EnterActive}
                div %{AbsoluteDiv}  -> page (GamepadLibrary / home GamepadPage / GamepadSearch)
            div %{PartnerEventOverlayContainer} > div %{Container>TransitionWrapper}   bg rgba(16,16,16,.75) bdf, op=0 (event overlay, closed)
          div %{BasicFooter}                          (button legend, 1280x42)
```
- `%{BasicHome}%{OpaqueBackground}` paints `radial-gradient(155.42% 100% at 0% 0%, #060a0e 0, #060a0e 0%, #0e141b 100%)`. In high contrast it is solid black.
  - This is what makes the whole main quad opaque.
  - `%{GamepadLibrary}` and `%{GamepadSearch}` repeat **the same gradient** on themselves. A glass theme must clear all three to see the room.
- `.LowPerfMode` is set on body. Steam disables some animations under it, for example the `RecentGamesBackground` drift and `CollectionBG` blur.

### 1.2 Header (global chrome, shared with other areas; here only as it relates to search)

```
div %{Profile>Header} GamepadMode [%{OverrideHeaderBackground} on /library/home] FlexGrowUniversalSearch Panel Focusable [0,0 1280x40]
    inline (home): --gamepadui-header-opacity:1; --gamepadui-header-background-opacity:0   (Steam animates these)
    ::before { content:""; absolute inset 0; bg rgba(0,0,0,.5); opacity driven by the var }  (Steam uses ::before)
  div %{OverridesInteractionSuppression} %{BackContainer} [108x40]   ::after = 1px divider (bg #23262e)  (Steam uses ::after)
    svg %{IbexDiagramFrontPanelTransparencyEffect>FlipInRTL} %{ArrowBack}
    span %{BackContainer>BackButton} "Back"
  div %{SearchAndTitleContainer} %{ShowingSearch} %{ForceExpanded} %{SearchAndTitleContainer>VR} Panel Focusable [1172x40]
    div %{SearchFieldBackground} [+ %{WhiteBackground}]
    svg %{SearchIconLeft} [+ %{WhiteBackground}]
    input %{SearchBox} %{SearchAndTitleContainer>Visible} [+ %{WhiteBackground}] Focusable   placeholder "Search for games or profiles..."
    svg %{SearchIconRight} op=0
```

Search field states:
- **Idle** (any library route): no fill. Placeholder and icons are #8b929a. In VR, hover turns the svg and placeholder #fff.
- **Search route active** (`/search…`): `%{WhiteBackground}` is added.
  - `%{SearchFieldBackground}%{WhiteBackground}` is #b8bcbf while not focused (`%{ForceExpanded}:not(.gpfocuswithin)`), and #fff when `.gpfocuswithin`.
  - The text is #0e141b and the caret is black.
  - Shots: `library_search*.png`.
- `%{SearchFieldBackground}` animates `transform: scaleX(0→1)` (origin 101% 50%). `%{SearchIconLeft}`/`%{SearchIconRight}` animate `translateX` and opacity, and the placeholder animates `translateX`. **Don't touch these transforms.**
- Typing any text in the header input navigates to `/search/tab/All`. Clearing it leaves you on `/search`. There is no separate results popup.

### 1.3 Footer legend (global chrome; appears on every library route while the UI is in gamepad-nav mode)

```
div %{BasicFooter} [0,678 1280x42] bg=rgba(0,0,0,.5) bdf
  div %{FooterLegend}
    div %{ActionButtonLegend} r=6  (x N)   -> div %{ActionButtonLegend>ActionButtonGlyph} > img %{FooterGlyphSize};  div %{ActionButtonLabel} "Filter"/"Sort By"/"Options"/"Select"/"Back"
```
- On library grids it reads X FILTER, Y SORT BY, ≡ OPTIONS, A SELECT, B BACK. Non-Steam, Collections and empty collections drop the items that don't apply.
- `%{ActionButtonLegend}` is clickable with the laser: `cursor:pointer`, `:hover` bg rgba(255,255,255,.1), radius 6px.

### 1.4 Tabbed page and tab row (`%{GamepadTabbedPage}`): used by the library tabs, the home tabs and the search tabs

```
div %{GamepadTabbedPage} %{CanBeHeaderBackground} [%{HasBelowHeaderTabs}] [%{IsUnderHeader}] Panel Focusable
  div %{TabHeaderRowWrapper} [%{GamepadTabbedPage>Pinned}] [%{ScrolledDown}]       absolute, z 2, padding 0 2.8vw, transparent
    div %{TabRow}                                                  flex
      div %{Arrows} Panel Focusable [32x32] > svg (chevron left)   <- VR shows arrows; non-VR shows %{Glyphs} (LB/RB)
      div %{TabRowTabs} role=tablist
        div %{TabsRowScroll}                                       mask-image fade at both ends (24px)
          div %{FixCenterAlignScroll} %{ScrollPanel} %{ScrollX} Panel   <- horizontal scroller of tabs
            div %{FocusRingRoot} (x2, 0x0)
            div %{TabRowSpacer} (24px)
            div %{GamepadTabbedPage>Tab} [%{GamepadTabbedPage>Selected}] %{HasAddon} %{RightAddon} Panel Focusable [.gpfocus] role=tab   r=64
              span %{GamepadTabbedPage>TabTitle} "All Games"
              span %{TabCount} "350"                (addon; home Friends tab uses %{FriendsPlayingNowBadge} %{InFriendsTab} instead)
            … more tabs …
            div %{TabRowSpacer}
      div %{Arrows} (chevron right)
    [belowHeaderTabsContent: %{VRSubTabFilterContainer} … on some library tabs, see 3.2]
  div %{TabContents} [%{GamepadTabbedPage>Floating}] Panel
    div %{ContentWrapper>TransitionGroup} [%{GamepadTabbedPage>Left}|%{GamepadTabbedPage>Right}]
      div %{ContentWrapper} %{GamepadTabbedPage>ContentTransition} [%{GamepadTabbedPage>Enter} %{GamepadTabbedPage>EnterActive}]
        div %{TabContentsScroll} _TabContentsScroll %{ScrollPanel} %{ScrollY} Panel role=tabpanel   <- main vertical scroller
  [div %{SortAndFilterContainer} …  laser mode only, see 6.1]
```

What each part paints today:

| Token | Today | States |
|---|---|---|
| `%{GamepadTabbedPage>Tab}` | Transparent pill: radius 64px, padding 6px 16px, height 22px. Text 12px bold uppercase, letter-spacing .5px, #dcdedf | `:hover` bg rgba(255,255,255,.15), text #fff (150ms) |
| | | `%{GamepadTabbedPage>Selected}` bg rgba(255,255,255,.15), text #fff (high contrast: rgba(189,197,206,.48)) |
| | | `.gpfocus` bg **#fff**, text #23262e, shadow 0 3px 6px rgba(0,0,0,.32). Seen in `library_tab_nonsteam.png` |
| | | Transitions on background-color, color and box-shadow (.1s) |
| `%{TabCount}` | #8b929a, margin-right 8px | Inside `.gpfocus` it is #23262e; high contrast #fff |
| `%{Arrows}` | Chevron svg 32px, #8b929a | `:hover` #fff. These are the "carousel arrows" of the tab row: click = previous/next tab. Hit area 32x32 |
| `%{TabsRowScroll}` | `mask-image: linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)` | Edge fade |
| `%{TabHeaderRowWrapper}` | Transparent (high contrast: black) | `%{ScrolledDown}` or the page `%{IsUnderHeader}` turn on **Steam's `::before`** band: absolute inset 0, z -1, bg rgba(0,0,0,.5), `backdrop-filter: blur(100px)`, shadow 0 4px 8px rgba(0,0,0,.5). Seen in `library_tab_allgames_scrolled.png`, `library_home_scrolled_whatsnew.png` |
| | | `%{AnimateDownwardExpansion}` animates that `::before` |
| | | `%{GamepadTabbedPage>Pinned}` = focus is not inside the tab row |
| | | `.BigArtMode …Pinned` dims to .75 (not used in VR) |

- Tab content switch animation (Steam-owned, **don't touch**): `%{GamepadTabbedPage>Right|Left} > %{ContentTransition}%{Enter}` uses `transform: translateX(±40%); opacity 0`. `EnterActive` goes to 0 / 1 over 320ms with an 80ms delay. Exit is `translateX(∓10%)` and opacity 0 over 80ms.
- `%{TabContentsScroll}` padding: `58px 2.8vw 40px`, or `118px` top with `%{HasBelowHeaderTabs}`. Scroll-padding top is 116px.
- Unused here: `%{TabBadge}`, `%{TabCountBadge}`, `%{TabDotBadge}`, `%{TabIcon}`, `%{LeftAddon}` and `%{BleedGlyphs}` exist in the module but are not rendered on these pages.

---

## 2. `/library/home`

Scroll structure:
- The page is `div %{OverflowHidden>GamepadPage} %{Flexed} %{OverflowHidden}` (inline `--gamepad-page-content-max-width`).
- Inside it is `div %{BackstackRootTest}`, then `div %{ScrollArea} %{ScrollPanel} %{ScrollY}`. This is the **outer** vertical scroller, with inline `scroll-padding-top`, max scrollTop about 434.
- Inside that come `div %{RecentSection}` (shelf, 1280x464) and the home `%{GamepadTabbedPage}` (section 1.4). That tab page's own `%{TabContentsScroll}` is the **inner** scroller for the tab panels.

### 2.1 Recent Games shelf (top of home)
- Reach: surface `main`, `--route /library/home`.
- Shot: `library_home.png`. The first item is the featured, focused, landscape capsule.

```
div %{RecentSection}
  div %{RecentGamesContainer} %{RecentGamesContainer>VR} Panel        padding-top 64px (VR)
    div %{RecentGamesBackgroundContainer}                             absolute, mask radial-gradient(75% 83% at 50% 18%…), contain:strict
      div %{RecentGamesBackgroundImages}
        div %{PortraitImage>Container} %{CustomImage} %{RecentGamesBackground}   animation 25s drift (off in LowPerfMode)
          img %{PortraitImage>Image} … %{RecentGamesBackgroundImage} %{MoveRight}|%{MoveLeft}   opacity .7; keyframe slide when focus moves
      (%{RecentGamesBackgroundFadeGradient})
    div %{RecentGamesInnerContainer}                                  z 2, pointer-events none
      h2 %{*Reset} %{RecentGamesHeader}                               padding 0 2.8vw
        div %{RecentGamesHeaderLabel} %{HeaderEnter}|%{HeaderExit} "Recent Games" ("Current Game" while a game runs)
      div > div Panel > div ReactVirtualized__Grid %{BasicGameCarousel} [1280x368]   <- horizontal virtualized scroller
        div ReactVirtualized__Grid__innerScrollContainer role=list aria="Recent Games"
          div Panel role=listitem   (inline: position:absolute; left/top/width/height)
            div %{BasicGameCarouselItem} Panel
              div %{BasicGameCarouselItemMediaContainer} [%{BasicGameCarousel>Featured}] Panel   (inline width/height; featured = 552x310 vs 172x310)
                div > div %{PortraitImage>Draggable} %{PortraitImage>HoversEnabled} Panel
                  div %{LibraryItemBox} (%{Landscape} %{InRecentGames} %{FeaturedCapsule} | %{PortraitImage>Portrait} %{InRecentGames}) %{BasicMode} Panel Focusable role=link   <- capsule, see section 4
                div %{PortraitImage>Container} %{GreyBackground} … %{CarouselCapsuleBackgroundGlow}  (blurred glow copy of the art)
              div %{CarouselGameLabelWrapper}  (only visible for the focused/hovered item)
                div %{CarouselGameLabel} > div %{PortraitMessage} >
                  div %{PortraitMessage} %{PortraitImage>Message} > div %{Marquee>Container} %{Container>Playing} > div %{Marquee>Content} "DolphinXR — Steam Frame"
                  div %{PortraitMessage} %{PortraitImage>SubMessage} > div %{BasicGameCarousel>Play} %{BasicGameCarousel>SubMessage} > div %{ActionIcon}(svg) + div "No playtime yet"
          … 19 more items …
          div %{TextBoxCarouselContents} %{BasicGameCarouselItemMediaContainer} Panel role=link "View more in your Library"   (last tile)
```

Paints:
- `%{RecentGamesHeaderLabel}`: 22px/28px bold white at opacity .7 (`%{HeaderEnter}`). After 8 s with no focus change it switches to `%{HeaderExit}`: opacity 0, `translateY(-1px)`. **The label fades out on its own.**
- `%{BasicGameCarousel}`: padding `12px 2.8vw 16px`, transparent.
- `%{CarouselGameLabelWrapper}`:
  - Hidden by default: opacity 0, `translateY(4px)`, `visibility:hidden`, pointer-events none.
  - It shows (opacity 1, `translateY(-4px)`, .14s delay) under `.gpfocuswithin >` or `:hover ~`.
  - Title: `%{Marquee>Content}`, white 18px bold. Sub line: `%{BasicGameCarousel>SubMessage}` rgba(255,255,255,.5) 12px uppercase; the play icon `%{BasicGameCarousel>Play} %{ActionIcon}` is #59bf40. `%{FriendsInGame}` variant is #59bf40.
- `%{TextBoxCarouselContents}` ("View more in your Library"): bg `linear-gradient(313deg, rgba(51,51,51,.667), rgba(85,85,85,.667))`, padding 20px, centred text. Shot: `library_home_carousel_end.png`.
  - Reach: `--pre "(async()=>{const g=L.q('main','%{RecentGamesContainer} %{BasicGameCarousel}');g.scrollLeft=g.scrollWidth;await new Promise(r=>setTimeout(r,800));return g.scrollLeft})()"`
- `.gpfocus ~ %{BasicGameCarouselItem}` → opacity .2 (Steam rule).
- `%{CarouselCapsuleBackgroundGlow}`: 10x30 element scaled with `translateY(-280%) translateX(56px) scaleX(22) scaleY(7)`, blur(3px) saturate(3), opacity 0 → .5 on focus/hover.
  - The featured one uses `scaleX(42)` and `%{IsFocused}` at .35.
  - **The transform is Steam's.** In high contrast it is `display:none`.

Content vs chrome:
- **Content**: game art in `img %{PortraitImage>Image}`, the background hero art `%{RecentGamesBackgroundImage}`, and the glow copies.
- **Chrome**: the header label, the label wrapper text, the "View more" tile and the capsule frame/shadow/outline.

### 2.2 Home tabs + WHAT'S NEW panel
- Reach: `--route /library/home`. WHAT'S NEW is the default tab.
  - If another tab is selected, use the click-tab snippet with `/^What/`.
  - Then scroll: `--pre "(async()=>{L.q('main','%{ScrollArea}').scrollTop=420;await new Promise(r=>setTimeout(r,500));return 'ok'})()"`
- Shot: `library_home_whatsnew.png`.
- Tab row: section 1.4. Home tabs: What's New, Friends, Recommended.
  - The Friends tab addon is `div %{FriendsPlayingNowBadge} %{InFriendsTab}` > `svg %{FriendsSection>Icon}` + `div %{FriendsSection>Count}` "2".
  - The badge is a pill: bg #236c39, text #dcdedf, radius 20px, height 22px. With `%{TabSelected}` it becomes #59bf40 / #fff.

```
div %{TabContentsScroll} …
  div %{LibraryHomeWhatsNew}                               flex column, gap 24px
    div %{SeasonalSale} %{SeasonalSale>Loaded} Panel role=button   bg #000, h 215px; :hover transform scale(1.02)
      img %{SeasonalSale>Banner}                            (sale art = content)
    div > div %{RecentlyCompleted} Panel                   "Recently updated on this device"
      h2 %{*Reset} %{RecentlyCompletedCarousel>Header}       18px/22px 500 white
      div Panel > div ReactVirtualized__Grid %{RecentlyCompletedCarousel}   (horizontal virtualized)
        div %{RecentlyCompletedItem} Panel role=link [300x106]  bg rgba(255,255,255,.15) (BasicUI); %{MajorUpdate} variant gradient; :hover scale(1.02)+shadow
          div %{RecentlyCompletedCarousel>TopSection} > div %{RecentlyCompletedCarousel>GameIconAndName} > (icon img) + div %{RecentlyCompletedCarousel>GameName} 16px white
          div %{RecentlyCompletedCarousel>BottomSection}    bg rgba(255,255,255,.05)
            div %{RecentlyCompletedCarousel>DownloadInfo}   12px #8b929a; div %{Bytes} #dcdedf
    div %{StoreCarouselCtn}                                "Trending among friends"
      h2 %{*Reset} %{ItemsCarousel>Header} [span %{ItemsCarousel>SubHeader} op .5]
      div Panel > div ReactVirtualized__Grid %{ItemsCarousel}
        div %{GameCapsule} Panel role=link [228x136]       bg #23262e; :hover scale(1.02)+shadow
          (img landscape art = content)
          div %{GameCapsule>InLibrary}                      10px uppercase, bg #4f95bd, text #000, absolute top 12px (+ %{BurgerWrapper} svg)
          div %{SteamDeckCompatInfo} %{GameCapsule>DeckCompat}   (display:none until .gpfocus)
          div %{GameCapsule>BottomBar}                      bg #3c5d84, h 28px, 12px uppercase
            div %{GameCapsule>Friends} > … %{ItemWrapper} > %{GameCapsule>Avatar} > div Panel > div %{avatarHolder} avatarHolder … > img %{avatar}
            div %{PriceCtn} > div %{StoreSalePriceWidgetContainer} StoreSalePriceWidgetContainer %{Discounted} Discounted %{NewItem}
                 div %{StoreSaleNewItem} "New" (bg #3a9bed) · div %{StoreSaleDiscountBox} "-70%" (bg #5ba32b, r1) · div %{StoreSaleDiscountedPriceCtn} > %{StoreOriginalPrice} (op .6, strike) + %{StoreSalePriceBox}
    div Panel > … div %{MarketingMessages}                 "Special Offers"
      h2 %{*Reset} %{MarketingMessage>Header}
      div Panel > div ReactVirtualized__Grid %{MarketingMessagesCarousel}
        div %{Seen>MarketingMessage} [%{Seen}] Panel role=button [200x210]   bg #000; %{Seen} = filter saturate(.1) + opacity .5; :hover scale(1.02)
          img %{MarketingMessage>Image}
```
- The price widget (`StoreSale*`) is shared store chrome. The colours (green discount, blue NEW) carry meaning.
- **Content**: banner and capsule art, avatars, marketing images. **Chrome**: section headers, item backgrounds, bottom bars, badges.

### 2.3 FRIENDS panel
- Reach: `--route /library/home` plus the click-tab snippet with `/^Friends/`; it also scrolls the ScrollArea to 420.
- Shot: `library_home_friends.png`.
```
div %{LibraryHomeFriends}                               flex column gap 24px
  div > h2 %{*Reset} %{LibraryHomeFriends>FriendsHeader} "1 friend is playing now"   18px 500 white
      div Panel > div ReactVirtualized__Grid %{InGameCarousel}
        div %{InGameGame} Panel role=link [378x152]      bg rgba(172,178,201,.14), padding 12px (:focus same bg)
          div %{CoverImageWrapper} > div %{PortraitImage>Container} … %{CoverImage} > img (content)
          div %{RightSide}
            div %{LibraryHomeFriends>Title} 16px white · div %{LibraryHomeFriends>FriendsPlaying} 12px #59bf40 · avatars (%{ItemWrapper}, %{avatarHolder}) · div %{LibraryHomeFriends>InLibrary} 12px #8b929a
  div > div %{AppDetailsSection} %{ActivityFeedContainer} Panel role=region       (activity feed, shared with the game page)
    h2 %{*Reset} %{SectionHeader} %{PadLeft} > div %{SectionHeader>Label} > div %{SectionHeader>LabelText} "Activity"
    div %{AppDetailsSectionContainer} %{AppDetailsSectionHasLabel} > div %{AppDetailsSection>Body} %{ActivityFeedContainer>InnerContainer}
      div %{AppActivityDay} role=region
        h4 %{*Reset} %{AppActivityDate} "October 4"   (uppercase, rule line to the right)
        div %{Event} [%{ReceivedNewGame} %{NoCommentSupport}] Panel
          div %{EventHeadline} Panel  bg rgba(172,178,201,.14)
            div %{EventActorAvatar} > %{avatarHolder} (+ %{avatarHolder>avatarStatus} green/grey strip)
            span %{SpanEvent} > span %{AppActivityDay>ActorName} > span %{playerName};  span "earned achievements in" > span %{HeadlineGameName} (+ %{AppActivityDay>GameIcon})
          div %{AppActivityDay>EventBody}  bg rgba(172,178,201,.14)
            div %{BoxCarousel} %{ActivityAchievementUnlocked} > div %{BoxCarousel>BoxCarouselContents} > div %{PrimaryAchievement} %{Achieved} %{Container>Featured} … (%{AchievementIconWrapper}, %{RareAchievementIconGlow} bggrad, %{HiddenLabel})
            | div %{GameCarouselWrapper} > div %{HeaderPageControls>PageableContainer} > ReactVirtualized__Grid %{GameCarousel} > … %{GameCarouselItemHeader}
          div Panel > div %{CommentThread} %{Shown} > div %{ActivityCommentThreadMinimized} op=0 (rating/comment/like buttons fade in on focus) …
```
- The activity-feed tokens (`AppActivityDay`, `Event*`, `BoxCarousel`, `CommentThread`, `LikeButton`, `RatingBar`) are the same component as the game-page activity feed. Coordinate with the game-page area.
- Comment and Like buttons are actions. Don't click them; they are styled from CSS only.

### 2.4 RECOMMENDED panel
- Reach: the click-tab snippet with `/^Recommended/` (it scrolls ScrollArea to 420). Shot: `library_home_recommended.png` (top).
- Lower part: shot `library_home_recommended_lower.png`.
  ```
  --pre "(async()=>{const t=L.qa('main','%{GamepadTabbedPage>Tab}').find(e=>/^Recommended/i.test(e.textContent.trim()));t.setAttribute('data-x','t');L.click('main','[data-x=t]');t.removeAttribute('data-x');await new Promise(r=>setTimeout(r,1500));L.q('main','%{ScrollArea}').scrollTop=1250;await new Promise(r=>setTimeout(r,300));L.qa('main','%{TabContentsScroll}').pop().scrollTop=900;return L.route()})()"
  ```
```
div %{PlayNextCarousel>Recommended}                    flex column, padding 8px 0 16px
  div Panel > div %{PersonalCalendarWidget} Panel      "Your Personal Calendar" (store web widget)
    div %{PersonalCalendarWidget>TitleSection} > div %{TitleSectionLeft} > div %{PersonalCalendarWidget>Title} (600, clamp 1–1.5rem) + div %{Subtitle} (rgba(255,255,255,.7))
    div %{carouselBody} items_in_row_5 Panel > div carousel > div %{sliderBody} SliderBody
      button %{carouselBtnCtn} %{carouselNavButton>left} %{carouselNavButton}   (.BasicUI → display:none; 0x0)
      div horizontalSlider___281Ls … carousel__slider > div carousel__slider-tray-wrapper (overflow-x scroll in GamepadMode)
        div sliderTray___-vHFQ %{DisableSliderMotion} carousel__slider-tray %{slideTrayCustomize}   (pure-react-carousel; Steam positions the tray)
          div slide… carousel__slide %{innerSlide} role=listitem (x25, width 260px !important)
            div %{PersonalCalendarWidgetDay} [%{TodayCtn}|%{FutureCtn}] Panel   bg linear-gradient blue (past) / magenta (today, future)
              div %{DayTitle} > div %{DayOfWeek} (uppercase rgba(255,255,255,.6)) + div %{PersonalCalendarWidget>Date} (bold) | div %{Today} "Today" (1px white underline)
              div %{DayAppContainer} Panel > div Panel > div %{StoreAppHover} > a Focusable role=button > div %{StoreAppCapsule} Panel > img %{PersonalCalendarWidget>Image}   (%{PersonalCalendarWidget>Hovered} → scale(1.05))
      button %{carouselBtnCtn} %{right} %{carouselNavButton}
  div %{Recommended>DiscoveryQueueWidgetCtn}           (store widget)
    div %{SaleTopSection} > div %{StickerArrangement} > div %{SaleSticker} x3 (white rounded, rotated ±15deg)
                          div %{WidgetHeaderCtn>SaleTextCtn} (bg rgba(0,0,0,.4), r5; ::after speech-bubble arrow, Steam's) > div %{BoldText}
    div %{WidgetHeaderCtn>DiscoveryQueueWidgetCtn} %{DiscoveryQueueWidget} %{Initialized}   bg #386483; :hover/.gpfocus header brightness(1.2)
      div %{AppCarouselPosition} (rotateZ(-11deg) translateX(14px)) > div %{AppCarouselCtn} (keyframe slide) > div %{AppCapsuleCtn} x15 (bg art, shadow) > %{CapsuleColumn} %{LibraryImage}, %{DiscoveryQueueWidgetCtn>AppName}
      div %{LaunchAction>WidgetHeaderCtn}   gradient purple→blue→transparent > div %{WidgetHeaderText} "Explore Your Discovery Queue" + div %{WidgetHeaderSubText}
  div %{PlayNextCarousel}                              "Play next from your library"
    h2 %{*Reset} %{PlayNextCarouselTitle} · div %{PlayNextCarouselSubHeading} (16px #8b929a)
    … %{BasicGameCarousel} with %{LibraryItemBox} %{PortraitImage>Portrait} %{InRecentGames} capsules (+ %{UninstalledIcon}, %{PortraitImage>UninstalledBar} %{UninstalledBarBottom} > %{UninstalledProgressBar}) and %{TextBoxCarouselContents} "View more in your Library"
  div %{StoreCarouselCtn} x2   "Recommended new releases" (+ %{ItemsCarousel>SubHeader} "based on what you've been playing"), "Top sellers"  -> %{GameCapsule} items as in 2.2
```
- The Personal Calendar and Discovery Queue are store-web widgets. Their inner layout uses `cqi` clamp font sizes and transforms (`.CarouselBtnLeft/Right translateX(±16px)`, `%{SaleSticker}` rotations, `%{AppCarouselPosition}` rotation, `%{AppCarouselCtn}` keyframe). **Don't touch those transforms.**

### 2.5 Home scrolled (tab row pinned under the header)
- Shot: `library_home_scrolled_whatsnew.png`.
  ```
  --pre "(async()=>{const t=L.qa('main','%{GamepadTabbedPage>Tab}').find(e=>/^What/i.test(e.textContent.trim()));t.setAttribute('data-x','t');L.click('main','[data-x=t]');t.removeAttribute('data-x');await new Promise(r=>setTimeout(r,1500));L.q('main','%{ScrollArea}').scrollTop=2000;await new Promise(r=>setTimeout(r,300));L.qa('main','%{TabContentsScroll}').pop().scrollTop=500;return L.route()})()"
  ```
- State: `%{TabHeaderRowWrapper} %{GamepadTabbedPage>Pinned} %{ScrolledDown}` with Steam's `::before` band (rgba(0,0,0,.5), blur 100px, shadow). The header carries `%{OverrideHeaderBackground}` and its inline opacity vars.
- **Layout quirk in VR:** the pinned tab row overlaps the 40px header. The left `%{Arrows}` sits under "Back", and the header search placeholder overlaps the band. That is stock behaviour. A theme that adds glass to both header and band will double-stack blur here.

---

## 3. `/library` tabs (`%{GamepadLibrary}`)

Page:
```
div %{AbsoluteDiv} Panel
  div %{GamepadLibrary} Panel            same radial gradient as BasicHome; padding-top = header height
    [Library Filters dialog mounts here when open — see 6.3]
    div %{GamepadTabbedPage} %{CanBeHeaderBackground} [%{HasBelowHeaderTabs}] …   (section 1.4)
```

### 3.1 Tab shots (each `--route /library/tab/<id>`, no `--pre`)

| Tab (route id) | Shot | Notes |
|---|---|---|
| All Games (`AllGames`) | `library_tab_allgames.png` | VR sub-tabs ALL / VR / NON-VR; first capsule focused (focus ring + Frame-compat badge) |
| Great On Frame (`GreatOnFrame`) | `library_tab_greatonframe.png` | Same sub-tabs; focused capsule has a "Steam Frame Verified" art banner (content) |
| Ready To Play (`ReadyToPlay`) | `library_tab_readytoplay.png` | Sub-tabs ALL / STANDALONE / REMOTE PC (only when remote apps exist) |
| Collections (`Collections`) | `library_tab_collections.png` | Collection tiles, see section 5 |
| Non-Steam (`DesktopApps`) | `library_tab_nonsteam.png` | Tab shown **Selected + .gpfocus** = white pill. No filter (`ignoreFiltering`). Capsules without art show the title text |
| Soundtracks (`Soundtracks`) | `library_tab_soundtracks.png` | Square capsules (`%{Soundtrack}` / `%{SoundtrackCollection}`, 172x172) |
| All Games, scrolled | `library_tab_allgames_scrolled.png` | `--pre "(async()=>{L.q('main','%{TabContentsScroll}').scrollTop=900;await new Promise(r=>setTimeout(r,900));return 'ok'})()"` shows the `%{ScrolledDown}` band behind the tab row and sub-tabs; `%{TabContents}` gains `%{GamepadTabbedPage>Floating}` |

### 3.2 VR sub-tab pills (below the tab row on AllGames, GreatOnFrame, Installed and, conditionally, ReadyToPlay)
```
div %{VRSubTabFilterContainer} [1208x46]          flex, height 40px, padding-bottom 6px
  div %{Group} Shared_Radio_Group %{VRLibraryFilterGroup} %{CenteredPill} Panel role=radiogroup   absolute; left 50%; transform translateX(-50%); width 50%  (Steam centring: don't touch)
    div %{Group>Button} RadioButton [%{Group>Active}] Focusable role=radio [aria-checked] id=VRAllGamesButton  "ALL"
    div %{Group>Button} RadioButton Focusable role=radio id=VRGamesOnlyButton  "VR" (or "STANDALONE")
    div %{Group>Button} RadioButton Focusable role=radio id=NonVRGamesButton   "NON-VR" (or "REMOTE PC")
```
Paints (Steam's rules):
- `%{CenteredPill} %{Group>Button}`: transparent, 2px border #282c2f, white bold 14px, padding 10px, min-width 85px.
- The first child gets a 20px start radius and the last child a 20px end radius. Together they read as one segmented pill.
- Active (`[aria-checked=true]`, `%{Group>Active}`): bg **#fff**, text #000. `:hover` on any button: bg #fff, text #000.
- **Steam uses `::before`** on non-active neighbours as a 1px white separator (`%{Group>Button}:not(%{Group>Active}) + …::before`). Inside `%{CenteredPill}` it is `display:none`.
- Only the ALL-active state was captured. **Clicking VR / NON-VR changes the persisted `collectionsAppFilterVR` filter, so it was not clicked.**

### 3.3 Grid (`%{GridWithControls}`) — virtualized
```
div %{TabContentsScroll} …
  [div %{DesktopApps} Panel  (Non-Steam tab wrapper)]
  div [%{AppGridContents}] > [div %{AppGridFilterHeader} … (only when the filter hides apps, see 6.4)]
  div %{GridWithControls} Panel            padding 4px 0
    div Panel > div Panel > div
      div %{CSSGrid>Container} Panel                inline height: <total px>   (virtual height)
        div (spacer, inline height)                 (rows above the window)
        div %{AppGridSection}? / %{AppGridSectionHeader} %{NotReallySticky} (inline display:none when there are no sections)
        div %{CSSGrid} %{YourCollection} Panel role=grid aria="All Games"
            inline: grid-template-columns: repeat(auto-fill, 172px); grid-auto-rows: 258px; gap: 42px 16px; font-size: 23.45px; padding-left/right: 8px   (Steam layout: don't touch)
          div (display: contents) per item
            div %{PortraitImage>Draggable} %{PortraitImage>HoversEnabled} %{PortraitImage>Large} Panel    <- capsule cell, section 4
            div %{PortraitImage>Container} %{GreyBackground} %{Container>PortraitImage} [%{CustomImage}] %{LibraryImageBackgroundGlow}   <- focus glow, sibling of the box
        div %{AppGridSectionFooter} (0 height in BasicUI)
```
- Only visible rows ±3 (`renderOutsideRows: 3`) are in the DOM. Up to about 30 capsules exist at a time.
- With alphabetical sort there are no section headers. Other sorts create `%{AppGridSectionHeader}`s, see 6.5.
- The type-to-jump overlay `%{FastScrollOverlay}` (fixed, inset 40px 0 0; `%{FastScrollOverlay>Visible}` bg rgba(0,0,0,.753) + blur 3px, 64px uppercase letter) only appears during gamepad fast-scroll. It was not reached.

---

## 4. Library capsule (grid, Recent Games, Play Next, collection pages)

### 4.1 Anatomy
```
div %{PortraitImage>Draggable} %{PortraitImage>HoversEnabled} [%{PortraitImage>Large}] [%{Soundtrack}] Panel  [.gpfocuswithin]
  div %{LibraryItemBox} %{PortraitImage>Portrait}|%{Landscape} [%{PortraitImage>InCollection}|%{InRecentGames}] [%{FeaturedCapsule}] %{BasicMode} [%{SoundtrackCollection}] Panel Focusable [.gpfocus] role=link
    div %{PortraitImage>Container} %{GreyBackground} %{Container>PortraitImage}|%{LandscapeImage} [%{CustomImage}] %{FeaturedCapsule>PortraitImage} %{PortraitImage>Capsule} %{CapsuleVisible} [%{NoCapsuleImage}]   bg #0e141b, padding-top 150% (portrait) / 46.74% (landscape)
      img %{PortraitImage>Image} %{Visibility} %{PortraitImage>Visible}        <- GAME ART (content), absolute inset 0, object-fit cover
      [span %{PortraitImage>Title} [%{LongTitles}]  "Animal Crossing (…)"]     <- only when art is missing; #dcdedf centred, inset 10%, .75em if long
    div %{LibraryItemOverlayOuterArea} > div %{LibraryItemOverlayInnerArea}
      div %{LibraryBottomItems}                     flex column, padding 4px
        [div %{LibraryItemIcons}                    flex row, space-between
           div %{UninstalledIcon} (BasicUI: display none)
           div %{SteamDeckCompatInfo} %{GameCapsule>DeckCompat} %{PortraitImage>SteamDeckCompatIcon}   bg rgba(0,0,0,.7) + backdrop blur(100px), r 20, padding 2px; opacity 0 until hover/focus
             svg %{SteamFrameCompatLogo} (20px) + svg %{HasHorizontalDirection>SteamDeckCompatIcon} %{HasHorizontalDirection>SteamDeckCompatVerified|…Playable|…Unknown|…Unsupported}]
        [div %{PortraitImage>UninstalledBar} %{UninstalledBarBottom} [%{BarDownloading}] > div %{UninstalledProgressBar}]   4px bar rgba(0,0,0,.7)+blur, fill #20aaeb (only while downloading)
    [div %{FriendsBar} %{SummaryView} > %{SummaryLeader} (6px green dot) + %{SummaryCount}]   friends-playing badge (found on some All Games capsules)
  div %{PortraitImage>Container} %{GreyBackground} … %{LibraryImageBackgroundGlow}   (or %{CarouselCapsuleBackgroundGlow} in carousels)  <- blurred art glow
```

### 4.2 States (Steam's CSS; `.BasicUI` variants are the ones that apply)

| State | How it paints today | Shot |
|---|---|---|
| Normal | No border. `box-shadow: 0 4px 10px rgba(0,0,0,.25)`, `filter: brightness(.9)` | any grid shot |
| **Focused** (`.gpfocus` + DOM `:focus`) | `transform: translateZ(15px)` (landscape 7px); `filter: brightness(1)`; `box-shadow: 0 16px 24px rgba(0,0,0,.5)`; z-index 12 | `library_tab_greatonframe.png`, `library_tab_readytoplay.png`, `library_capsule_focused_compat.png`, featured capsule in `library_home.png` |
| | `outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px` | |
| | Three focus animations: grow, fade and a 1.2s pulse ×20 | |
| | `::after` shine sweep at opacity .8 | |
| | `%{SteamDeckCompatInfo}` opacity 1 | |
| | `%{LibraryImageBackgroundGlow}` opacity 1. It is the sibling `.gpfocuswithin ~` glow: blur(50px) saturate(3) brightness(200%), `translateY(20%) scaleY(.8) scaleX(.8)`, z -99 | |
| Hover (laser) | `.BasicUI %{PortraitImage>HoversEnabled} %{LibraryItemBox}:hover:not(%{Landscape})`: `transform: translateZ(15px)`, `brightness(1) contrast(.95)`, shadow 0 12px 10px rgba(0,0,0,.5). Deck-compat badge and glow appear. `%{PortraitImage>ShowAsHovered}` is the class twin | CSS only (`:hover` can't be synthesized) |
| Active / pressed | `filter: brightness(1.2)` (.05s) | CSS only |
| Missing art | `%{PortraitImage>Title}` text over the placeholder art | `library_tab_nonsteam.png` |
| Square soundtrack | `%{Soundtrack}` / `%{SoundtrackCollection}`, 172x172 | `library_tab_soundtracks.png` |
| Featured landscape (Recent Games first item) | `%{Landscape} %{InRecentGames} %{FeaturedCapsule}`, 552x258 (inline width on the media container) | `library_home.png` |

Pseudo-elements Steam already uses on the capsule:
- `%{LibraryItemBox}::before` is a hit-area extender: `content:""; position:absolute; top:-6px; bottom:-6px; width:100%`.
- `.BasicUI %{LibraryItemBox}::after` is the shine: a 300%-wide diagonal gradient, `mix-blend-mode: overlay`, z 2, pointer-events none, opacity 0 → .8 on `.gpfocus` with a 1s keyframe.
- **A theme must not add its own `::before`/`::after` on `%{LibraryItemBox}`.**
- `%{PortraitImage>Draggable}`, `%{PortraitImage>Container}`, `%{LibraryItemOverlayOuterArea}`, `%{LibraryBottomItems}` and `%{SteamDeckCompatInfo}` have **no** pseudo-elements (checked live).

Never touch:
- `transform` and `animation` on `%{LibraryItemBox}`; Steam's focus depth uses `translateZ`, and `transform-style: preserve-3d` is set on the tab page.
- The glow's transform.
- Capsule cell sizes, which come from the grid's inline styles.

Badge classes that exist but did not appear in this library (unreachable, see section 9):
- `%{LibraryItemUpdateBadge}`, `%{GameUpdatedCircle}`
- `%{AppPortraitBannerContainer}` / `%{AppPortraitBanner}`, `%{ComingSoonBanner}`, `%{ComingSoonIcon}`
- `%{LibraryItemActionButton}` (`%{Play}`/`%{Download}`/`%{Update}`), `%{BasicPlayButton}`
- `%{LockedGame}`, `%{NumberOfCopies}`
- `%{SteamReview*}`, `%{MCGreen|MCOrange|MCRed}` (sort-dependent tags)
- `%{FriendsBar}%{IconsView}`

---

## 5. Collections

### 5.1 Collections tab (`/library/tab/Collections` = `/library/collections`)
- Shot: `library_tab_collections.png`. The first tile (DS) is focused.
```
div Panel > div %{CollectionContents} Panel > … div %{CSSGrid>Container} > div %{CSSGrid} %{Grid} Panel role=grid aria="Collections"
  div %{Collection} Focusable role=link [185x185]         bg #313d53, shadow 0 4px 8px rgba(0,0,0,.25), radius 0 (BasicUI), overflow hidden
    div %{CollectionImage} [%{Has1Apps}…%{Has7Apps}]       perspective 1000px, z 4
      [div %{CollectionBG} > img %{Container>BackgroundImage}]   blurred art, mix-blend color (hidden in LowPerfMode)
      div %{DisplayCaseContainerBounds}                     mask gradient
        div %{DisplayCaseContainer}                         transform rotateZ(-35deg) rotateY(20deg) rotateX(20deg), preserve-3d  (Steam's 3D tilt: don't touch)
          div %{AppGrid} > div %{Container>CapsuleImage} > div %{PortraitImage>Container} … %{ScrollContainer>Image} > img   (mini capsules = content)
    div %{CollectionLabel}                                  absolute bottom 16px, 18px 500 uppercase, letter-spacing 2px, white, text-shadow
      div "VR"  ·  div tool-tip-source > div %{CollectionLabelCount} "( 27 )"   16px 400 rgba(255,255,255,.667)
```
- **Focus / hover**: bg #6278a3, shadow 0 14px 22px rgba(0,0,0,.3). The label turns white. `%{AppGrid}` gets `translateZ(10px)` and the mini capsules get a shadow. `.gpfocus` also runs Steam's `::after` shine.
- **Steam uses `::after`** on `.BasicUI %{Collection}`: the shine gradient, `clip-path` to a 3px border ring, opacity .8 on gpfocus.
- `%{DynamicCollection}` (lightning icon) and `%{NewCollection}` / `%{BigPlus}` (create tile) exist. The create tile is hidden in gamepad (`bHideCreateButton`), and there are no dynamic collections.

### 5.2 Collection page (`/library/collection/<id>`)
- Shot: `library_collection_vr.png` (`--route /library/collection/uc-QEu45ND5z53u`). Under the Collections tab:
```
div Panel (onCancel → AllCollections) > div %{CollectionHeader} "VR"     22px/28px bold uppercase white, margin-top 16px
div %{GridWithControls} …  (same grid and capsules as 3.3 / 4)
```

### 5.3 Empty collection
- Shots: `library_collection_empty.png` (`--route /library/collection/uc-siYTOZsiQgri`, "Epic") and `library_collection_favorites.png` (`--route /library/collection/favorite`).
- DOM: `%{CollectionHeader}` "Epic", then an empty `%{GridWithControls}` (1208x8). There is **no message text**: the gamepad grid `lx` never renders `%{EmptyGridMessageContainer}`.
- The visible outline in the shot is Steam's generic focus ring around the focusable empty panel. It is a `%{FocusRing}` element positioned inside `%{FocusRingRoot}` (absolute, z 10000, pointer-events none), with `outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px` and the same pulse animations.
- `%{EmptyGridMessageContainer}` / `%{EmptyGridMessageLine}` (padding 20px; text rgba(255,255,255,.8) centred) belong to the desktop grid. They were not seen in VR.

---

## 6. Sort / filter controls and their menus

### 6.1 Laser-mode Sort & Filter buttons (`%{SortAndFilterContainer}`): **not reachable now**
- Rendered by `GamepadTabbedPage` only when `IN_VR && !IsInGamepadNav && (sort || filter)`.
  - `IsInGamepadNav` comes from the last SteamVR overlay-focus message (`system_panel_interaction_mode == Gamepad`). It was `true` all session.
  - So the buttons appear only while someone points the laser at the main window. In gamepad-nav mode the same actions are on the footer legend (X / Y).
- DOM (from source): `div %{SortAndFilterContainer}` > `div %{SortAndFilterButton}` (svg `SortByGeneric` + current sort label) + `div %{SortAndFilterButton}` (svg `Filter` + `%{CompatFooterDescription}` "Filter" / "Filter: [icons]" / "Filter: Advanced").
- Paints:
  - Container: absolute, bottom 35px, right 8px, flex row, pointer-events none, padding 8px, radius 4px, border 1px rgba(255,255,255,.1), bg rgba(0,0,0,.3), **backdrop-filter blur(100px)**, shadow 0 3px 6px rgba(0,0,0,.32). It is already a glass-ish floating pill.
  - Buttons: pointer-events auto, height 40px, padding 0 15px, 12px bold uppercase, letter-spacing .5px, white, radius 4px; `:hover` bg rgba(255,255,255,.1). The svg is 18px high with an 8px gap.
- `%{CompatFooterIcons}` (inside the filter label): bg #23262e, radius 12px, padding 2px, 12px icons. The `%{LibraryImageBackgroundGlow>Advanced}` variant has padding 0 8px.

### 6.2 Sort menu (Y / "Sort By")
- Reach: `--route /library/tab/AllGames --settle 1.5 --pre <Sort snippet, 0.3>`. Shot: `library_sort_menu.png`.
- **Choosing an item changes the persisted sort (`localStorage AppGridDisplaySettings`). Never click an item.**
- Mounted in `%{GamepadDialogOverlay}` (the generic gamepad context menu, shared with every other area):
```
div %{GamepadDialogOverlay} GamepadMode FullModalOverlay
  div ModalOverlayContent ModalOverlayBackground       bg rgba(0,0,0,.85), backdrop blur(3px)    <- dims the page
  div ModalOverlayContent active
    div %{*GamepadDialogContent>ModalPosition} %{*GamepadDialogContent>VR} %{*GamepadDialogContent>FooterVisible} Panel   absolute top: header height, bottom: footer height
      div %{*GamepadDialogContent>ModalClickToDismiss} Panel     (full-size click-away layer)
      div BasicUIContextMenu %{*BasicContextMenuHeader>BasicContextMenuModal}
        [div %{*BasicContextMenuModal>BasicContextMenuHeader} "<title>"]    18px; :empty → display none (sort menu has none)
        div %{*BasicContextMenuModal>BasicContextMenuContainer} Panel      centred; entry keyframe animation (Steam)
          div %{*BasicContextMenuModal>contextMenuContents} Panel role=listbox   drop-shadow filter; overflow-y auto; first child mt 15px, last child mb 40px
            div %{*BasicContextMenuModal>contextMenuItem} contextMenuItem Panel Focusable [%{*BasicContextMenuModal>Focused} .gpfocus] role=option [280x48] "Alphabetical" … "Steam Review"
            div %{*BasicContextMenuModal>ContextMenuSeparator} role=separator     2px, black (white in high contrast)
            div %{*BasicContextMenuModal>contextMenuItem} contextMenuItem role=menuitem "Cancel"
```
Item paints:
- Base: bg #23262e, text #b8bcbf, padding 14px, min-width 280px.
- `:hover` bg #3d4450. `%{Focused}` bg **#fff**, text #0e141b. `%{*…>Selected}` bg #3d4450, text #fff.
- `.disabled` text rgba(255,255,255,.3); `.disabled.gpfocus` rgba(0,0,0,.5).
- Semantic variants (keep their meaning!):
  - Positive / `.Launch` / `.Stream`: hover #236c39, focused #59bf40.
  - Emphasis / `.Download` / `.Update` / `.Install`: hover #216495, focused **#1a9fff**.
  - Destructive / `.Stop` / `.Cancel`: hover #8a220f, focused #de3618.
- `.menuChecked` text #6dcff6, with a 4px `.contextMenuCheckMark` bar.
- The `%{SortingDropDownContainer}` / `%{SortingDropDownItems}` classes passed in the menu options only style the desktop popup variant.

### 6.3 Library Filters dialog (X / "Filter")
- Reach: `--route /library/tab/AllGames --pre <Filter snippet, 0.3>`.
- Shots: `library_filter_dialog.png` (top), `library_filter_dialog_700.png`, `library_filter_dialog_1500.png`, `library_filter_dialog_bottom.png` (scroll `%{DialogWrapper}`).
- **Every row, checkbox, dropdown, Reset and "Save as Dynamic Collection" changes state. Look only.**
```
div %{GamepadDialogOverlay} … ModalOverlayContent active > div %{*GamepadDialogContent>ModalPosition} %{*GamepadDialogContent>VR} %{*GamepadDialogContent>FooterVisible}
  div %{*GamepadDialogContent>ModalClickToDismiss}
  div %{DialogWrapper}                                   width 660px, margin auto, overflow-y auto  <- the dialog's scroller (scrollHeight ≈ 2790)
    div %{DialogWrapper>CompatFilterDialog} role=dialog  bg #0e141b, border 2px #23262e, padding calc(12px + 2.25vh) 2.8vw, margin 24px 0
      div DialogHeader role=heading > span %{DialogWrapper>CompatFilterDialogTitle} "Library Filters"   bold 34px line-height, white
      div DialogBody %{DialogWrapper>DialogBody}
        div %{DialogWrapper>CompatFilterDialogDescription} "Choose which games… Press [X img] …"
        div "Steam Frame Compatibility:"
        div %{CompatFilterOptions} Panel                 flex column, gap 2px
          div %{DialogWrapper>CompatFilterDialogRow} [%{DialogWrapper>Active}] [%{LastFocused}] Panel Focusable role=radio   bg #23262e, padding 8px 16px; .gpfocus bg #fff text #0e141b
            div %{DialogWrapper>RadioButton}             16px dot: bg #0e141b r8; Active → bg #fff + inset 4px #1a9fff ring
            div > div %{DialogWrapper>CompatFilterLabel} (16px) + div %{DialogWrapper>CompatFilterDescription} (14px #8b929a; max-height 0 unless %{LastFocused}; on .gpfocus #67707b)
            div %{DialogWrapper>CompatFilterDialogIcons} > svg …SteamDeckCompatVerified/Playable/Unknown/Unsupported [%{DialogWrapper>Inactive} op .05] [%{DialogWrapper>InvertFocusedIcon}]
          div %{FilterSummary}                            (selected advanced options summary)
          div %{Filters>Container} > div %{Container>Filters}
            div %{FilterArea} > div %{FilterBucket} %{Filters>Player}|%{PlayState}|%{Hardware}|%{Feature}|%{Genre} %{ExtraTall} Panel role=button   bg #23262e, padding 12px 16px 16px; .gpfocuswithin bg #3d4450
              div %{FilterBucketLabel} "Players"           18px 500 white
              div %{FilterBucketBoxes} > div %{FilterArea>Row} %{NotMoving} Panel (.gpfocuswithin bg #fff text #0e141b)
                 div tool-tip-source > div DialogCheckbox_Container _DialogLayout %{Container>Checkbox} Panel role=checkbox > div DialogCheckbox (16px, bg rgba(0,0,0,.267), r2) > svg SVGIcon_DialogCheck; div DialogToggle_Label > span
              [div %{CompatDropDown} > button %{DropDownControlButton} %{*GamepadDialogContent>Button}  bg rgba(255,255,255,.15) r2, "Gamepad Support ▾" / "Any language ▾"]
            div %{SearchBoxes} > %{SearchBucketLabel} "Store tags"/"Friends" + input %{*GamepadDialogContent>BasicTextInput} (bg rgba(255,255,255,.1))
            div %{Filters>Buttons} > button %{Container>ClearButton} %{*GamepadDialogContent>Button} "Reset" · div %{SaveButtonCtn} > button %{SaveButton} %{*GamepadDialogContent>Button} "Save as ⚡ Dynamic Collection"
```
- Section order in BasicUI: Players, Play state, Hardware support (dropdown + 4 checkboxes), Features, Language (dropdown), Genre, Store tags, Friends, Gameplay, Visual, Camera Comfort…, Audio, Input, then Reset / Save.
- The dropdown in the dialog (`library_filter_dropdown.png`, reached by `L.click('main','%{CompatDropDown} %{DropDownControlButton}')` after opening the dialog) opens a `BasicContextMenuModal` with `%{CompatDropDownOption}` > svg `%{SmallerSVG}`/`%{BiggerSVG}` + `%{Filters>CompatLabel}`. The options are "Any Gamepad Support", "Xbox Controller", "DualShock Controller", "DualSense Controller", "Steam Input API", then Cancel.
  - It mounted in a separate `ModalOverlayContent` that stayed `inactive` behind the dialog, so **the shot shows the dialog without the menu**. The DOM was captured.
  - **Close it with `ModalManager.RemoveModal`**; cancel did not close it.

### 6.4 "N apps hidden due to filter" header: not reached
- `div %{AppGridFilterHeader} [%{AppGridFilterHeaderAsButton}] Panel` > `span %{AppGridFilterText}` (with an X glyph img). Shown above the grid only when the compat or advanced filter hides apps. The filter is "All Games" here.
- Paints:
  - Text: 12px bold uppercase rgba(255,255,255,.7).
  - **Steam uses `::before` and `::after`** as 40%-wide 1px rules (rgba(139,146,154,.4)) left and right of the text. They are hidden for `AsButton` and `.gpfocus`.
  - The `AsButton` variant (when everything is filtered out) has bg rgba(255,255,255,.16); `.gpfocus` bg #fff, text #000.

### 6.5 Sticky section headers: not reached
- `div %{AppGridSectionHeader} [%{NotReallySticky}] [%{IsSticking}]` > `div %{AppGridSectionLabel}` + `div %{LibraryImageBackgroundGlow>Rule}`. They appear when the sort is not Alphabetical (e.g. Hours Played → "Over 10 hours").
- Paints:
  - Sticky top 0, z 30, `transform: translateX(-24px)`, pointer-events none (children all).
  - Label: 12px uppercase, rgba(255,255,255,.6), letter-spacing 2px, weight 100. Rule: 1px gradient line.
  - **Steam uses `::after`** for the sticky background: radial gradient #313d53→#101314 with a shadow. Its opacity is the inline var `--sticky-header-background-opacity`, written by JS on scroll.

---

## 7. Capsule context menu (≡ menu button on a capsule)

- Reach: `--route /library/tab/AllGames --settle 1.5 --pre <Sort snippet with 'vgp_onmenu' / button:14>`. Shot: `library_capsule_menu.png`, showing 3dSen, an uninstalled game.
  - Installed-game variant: `library_capsule_menu_installed.png`, "Beat Saber" (captured from another agent's open menu). It has no primary action; Add to Favorites is focused.
- Add to submenu: `library_capsule_submenu.png`. The submenu opens to the right and the parent row gets `%{*BasicContextMenuModal>active}` (white).
- **Every item here is an action** (Install, Play, Add to Favorites, collection names, New collection…, Manage → Uninstall/Hide, Properties…). Only open, look and close. Hovering or opening the Manage and Developer submenus is fine; clicking any leaf item is not.
```
… same %{GamepadDialogOverlay} / ModalPosition / BasicUIContextMenu shell as 6.2 …
  div %{*BasicContextMenuModal>BasicContextMenuHeader} "3dSen"            (title above the menu, 18px)
  div %{*BasicContextMenuModal>BasicContextMenuContainer} [560 wide when a submenu is open]
    div %{*BasicContextMenuModal>contextMenuContents} [%{hasSubMenu}] role=menu
      div Install %{AppDetailsOverlayTransitionGroup>ContextMenuAction} %{*…>contextMenuItem} contextMenuItem [%{Focused} .gpfocus] role=menuitem  > svg + "Install"   <- focused primary action = bg #1a9fff
      div …contextMenuItem "Add to Favorites"
      div %{*BasicContextMenuModal>SubMenu} %{*…>contextMenuItem} [%{*BasicContextMenuModal>active}]  > div %{*BasicContextMenuModal>Label} "Add to" + div %{*BasicContextMenuModal>Arrow} > svg SVGIcon_DownArrowContextMenu (rotated -90deg)
      div …SubMenu "Manage" ›   div …SubMenu "Developer" ›
      div %{*…>ContextMenuSeparator}   div …contextMenuItem "Properties..."   separator   div …contextMenuItem "Cancel"
    div %{*BasicContextMenuModal>contextMenuContents} role=menu        <- submenu column
      div %{ContextMenuMouseOverlay>UpperCase} %{*…>contextMenuItem} role=menuitem "DS" … "Xbox 360", separator, "+ New collection..."
```
- The first item's class (`Install`, `Play`, `Launch`, `Download`, `Update`…) selects the semantic colour (see 6.2). Keep blue for install/update and green for play.

---

## 8. Search (`/search`, `/search/tab/<id>`)

Reach:
- Empty query: `--route /search` → shot `library_search.png`. Everything is listed: All 446 / Library 424 / Friends 4 / Store 0 / Tools 18.
- Query: the search snippet (0.3) with `--route /search` → `library_search_results.png` ("half": All 162, Library 8, Friends 0, Store 158, Tools 3, Hidden 4).
- No results: the search snippet with `'zzqxvkj'` → `library_search_noresults.png`.
- Store tab: the search snippet plus a tab click with `/^Store/` → `library_search_store.png`. It shows the "View more in the Store" redirect tile.
- Friend result: query `'goth'` plus a click on `/^Friends/` → `library_search_friends.png`.
- Every snippet clears the query again after 4.5 s.

```
div %{GamepadSearch} Panel                       radial gradient bg (same as library), padding-top header height
  div %{GamepadTabbedPage} Panel  (section 1.4; tabs All/Library/Friends/Store/Tools/Hidden with %{TabCount})
    … %{TabContentsScroll}
      div %{ResultsGridWrapper}                  relative, height 100%
        div Panel role=grid (inline: height <total>px; width 100%; position relative)   <- @tanstack virtualizer
          div %{ResultsRow} role=row  (inline: position:absolute; top:0; left:0; width:100%; height:140px; transform: translateY(<n>px))   <- Steam positions rows: never touch transform/position
            div %{ResultTemplate} Panel (onActivate)  [.gpfocuswithin]
              div %{ResultTemplateImage} Panel Focusable role=link    margin 6px 0, min-height 76px, shadow; :hover scale(1.02)+shadow; .gpfocuswithin → scale(1.03) + 0 12px 16px rgba(0,0,0,.32)
                div %{LibraryImageWithName} [%{TagCtn}] > div %{PortraitImage>Container} %{GreyBackground} %{LandscapeImage} %{GamepadSearch>GameIcon} > img   (art = content)
                     [div %{GamepadSearch>Title} > span  (title text if the art is missing)]
                | div %{FriendResultImage} > %{ProfileBackground} > %{miniProfileBackground} (bggrad) + img %{miniProfileBackgroundBlur} op .4; div %{GamepadSearch>ImageContainer} > div %{avatarHolder} %{SearchResultFriendAvatar} (+ %{avatarHolder>avatarStatus}) > img %{avatar}
                | div %{RedirectResultBackground} (linear-gradient 135deg #67707b→#3d4450) + div %{OverlaidText} "View more in the Store"
              div %{ResultTemplateDescriptionRow}
                div %{GamepadSearch>Icon} > svg     16px #8b929a (white when .gpfocuswithin)
                div %{GamepadSearch>Description} "In Library" / "From the store" / "gotharer"   12px bold uppercase (white when .gpfocuswithin)
      | div %{NoResultsFound} "No Results Found"  16px white centred, margin-top 162px
```
- Grid: `%{ResultsRow}` is `display:grid; grid-template-columns: repeat(auto-fill, minmax(168px,1fr)); gap 12px`, with 191x140 cells.
- Tag results (`%{TagCtn}`): purple-blue gradient tile with a frosted `%{GamepadSearch>Title} span` (bg rgba(255,255,255,.3), radius 5px, blur(3px)). This is already glass-like. Not seen with these queries.
- `.gpfocus %{SearchResultFriendAvatar}` → `scale(.92)` (Steam transform).
- No `::before`/`::after` rules exist on any `GamepadSearch` token.

---

## 9. Not reached, and why

| Piece | Why not | What to use instead |
|---|---|---|
| `%{SortAndFilterContainer}` / `%{SortAndFilterButton}` (laser-mode sort and filter pill) | Needs `IsInGamepadNav == false` (laser on the window). The session stayed in gamepad mode, and faking the input-mode getter would affect every agent | CSS in 6.1. Verify by pointing the laser at the main window |
| VR / NON-VR / STANDALONE / REMOTE PC pills selected | Selecting changes the persisted `collectionsAppFilterVR` | Active styling seen on ALL; rules in 3.2 |
| `%{AppGridFilterHeader}` "N apps hidden due to filter" | Needs a non-default compat or advanced filter (a settings change) | 6.4 |
| `%{AppGridSectionHeader}` sections, metacritic / review / achievement tags on capsules | Needs a non-alphabetical sort (persisted) | 6.5 |
| Sort menu or filter dropdown **item** selection states (`.menuChecked`, selected compat row other than "All Games") | Choosing = side effect | 6.2 / 6.3 |
| Filter dialog dropdown menu (visible) | Opened behind the dialog in synthetic mode | DOM in 6.3 |
| Tabs Installed, Favorites, Remote Play, Xbox/PS | Not present for this account/device (Installed is hidden on the Frame, 0 favourites, no remote play) | Same tab markup as section 1.4 |
| Home empty states: `%{LibraryHomeEmptyGames}` (no recent games; Steam `::before` grid image, `%{RecentGamesContainer>Option}` gradient buttons), `LibraryHome_WhatsNew_Empty`, `RecentFriendsActivity_Empty`, `%{EmptyLibraryCarouselItem}` | The account has content | CSS only (rules in the RecentGames module) |
| "Current Game" header label, running-game capsule states | Needs launching a game | 2.1 |
| Non-Steam first-run dialog (`#Library_DesktopApps_DialogHeader`, "Add Chrome"), `HeaderBlock` "Learn more" empty state, Installing Chrome | Only on first visit or with an empty Non-Steam list; the dialog's button installs software | Module `46307` `m5`/`B5`/`f5`/`p5` |
| Capsule badges: `%{LibraryItemUpdateBadge}`, `%{AppPortraitBanner}`, `%{ComingSoonBanner}`, download bar `%{BarDownloading}`, `%{LockedGame}`, `%{NumberOfCopies}` | No such apps in this state (the scan of All Games found only `%{FriendsBar} %{SummaryView}`) | Classes listed in 4.1 |
| All `:hover` states | Synthetic pointer events don't set `:hover` | Rules quoted per section |
| `%{FastScrollOverlay}` | Gamepad fast-scroll only | 3.3 |
| `%{PartnerEventOverlayContainer}` event overlay, sale banner and marketing targets | Clicking navigates to store or event pages (store/event areas) | — |
| `%{EmptyGridMessageContainer}` text | Not rendered by the gamepad grid | 5.3 |

---

## 10. Steam-owned pseudo-elements (a theme must not add its own on these)

| Element | Pseudo | What Steam draws |
|---|---|---|
| `%{LibraryItemBox}` | `::before` | Hit-area extender (top/bottom −6px) |
| `.BasicUI %{LibraryItemBox}` | `::after` | Focus shine sweep (gradient, overlay blend, op .8 on `.gpfocus`) |
| `.BasicUI %{Collection}` | `::after` | Shine sweep clipped to a 3px border ring |
| `%{TabHeaderRowWrapper}` | `::before` | Dark blurred band when `%{ScrolledDown}` / `%{IsUnderHeader}` |
| `%{Group>Button}` | `::before` | 1px separators between inactive radio buttons |
| `%{AppGridFilterHeader}` | `::before`, `::after` | Rule lines either side of the text |
| `%{AppGridSectionHeader}` | `::after` | Sticky background (opacity from inline var) |
| `%{LibraryHomeEmptyGames}` | `::before` | Background grid image |
| `%{WidgetHeaderCtn>SaleTextCtn}` | `::after` | Speech-bubble arrow |
| `%{Profile>Header}` | `::before` | Header background band (global) |
| `%{BackContainer}` | `::after` | Divider (global) |

Checked live with **no** pseudo:
- Home: `RecentGamesContainer`, `RecentGamesBackgroundContainer`, `RecentGamesHeaderLabel`, `BasicGameCarousel`, `BasicGameCarouselItem`, `BasicGameCarouselItemMediaContainer`, `CarouselGameLabelWrapper`, `TextBoxCarouselContents`, `FriendsPlayingNowBadge`, `LibraryHomeWhatsNew`, `SeasonalSale`, `RecentlyCompletedItem`, `StoreCarouselCtn`, `GameCapsule`, `GameCapsule>BottomBar`, `GameCapsule>InLibrary`, `StoreSaleDiscountBox`, `Seen>MarketingMessage`, `ScrollArea`.
- Library and search: `GamepadLibrary`, `GamepadTabbedPage`, `TabRow`, `Arrows`, `GamepadTabbedPage>Tab`, `TabCount`, `VRSubTabFilterContainer`, `VRLibraryFilterGroup`, `TabContentsScroll`, `GridWithControls`, `CSSGrid`, `PortraitImage>Draggable`, `PortraitImage>Container`, `LibraryBottomItems`, `SteamDeckCompatInfo`, `LibraryImageBackgroundGlow`, `CollectionContents`, `CollectionImage`, `CollectionLabel`, `GamepadSearch`, `SearchFieldBackground`, `BasicFooter`, `ActionButtonLegend`.

## 11. Inline styles and transforms Steam positions or animates with (don't override)

- `%{BasicUiRoot}`: `--basicui-header-height`, `--gamepadui-current-footer-height`.
- `%{Profile>Header}`: `--gamepadui-header-opacity`, `--gamepadui-header-background-opacity`.
- `%{OverflowHidden>GamepadPage}`: `--gamepad-page-content-max-width`.
- `%{ScrollArea}`: `scroll-padding-top`. `%{TabContentsScroll}`: inline padding-bottom / scroll-padding-bottom.
- `%{CSSGrid}`: inline `grid-template-columns`, `grid-auto-rows`, `gap`, `font-size`, `padding-left/right`. `%{CSSGrid>Container}`: inline `height`. Spacer divs: inline `height`.
- `ReactVirtualized__Grid` (all horizontal carousels): inline `position:relative; width; height; will-change: transform; overflow: auto hidden`.
  - `…__innerScrollContainer`: inline width/height.
  - List items: inline `position:absolute; left; top; width; height`.
- `%{BasicGameCarouselItemMediaContainer}`: inline width/height. The featured item grows from 172 to 552 px wide when focused.
- `%{Marquee>Container}`: `--fade-length-left/right`, `--delay`, `--direction`, `--duration`.
- `%{ResultsRow}`: inline `position:absolute; transform: translateY(n px)` (search virtualizer).
- `%{AppGridSectionHeader}`: inline `--sticky-header-background-opacity` / `display:none`.
- Chevron svgs: inline `transform: rotate(90deg|270deg)`.
- CSS-driven transforms and animations:
  - Capsule focus/hover `translateZ` and the focus pulse animations.
  - Glow transforms on `%{LibraryImageBackgroundGlow}` and `%{CarouselCapsuleBackgroundGlow}`.
  - `%{CarouselGameLabelWrapper}` translate and visibility.
  - `%{RecentGamesHeaderLabel}` translateY; `%{RecentGamesBackgroundImage}` slide keyframes; `%{RecentGamesBackground}` 25 s drift.
  - Tab-content Enter/Exit `translateX`.
  - `%{VRLibraryFilterGroup}` `translateX(-50%)`.
  - Hover `scale(1.02)` on `%{GameCapsule}`, `%{RecentlyCompletedItem}`, `%{Seen>MarketingMessage}`, `%{SeasonalSale}`, `%{ResultTemplateImage}` (`scale(1.03)` focused).
  - `%{Collection}` 3D tilt (`%{DisplayCaseContainer}`) and `%{AppGrid}` translateZ.
  - Search field `scaleX` and icon `translateX`.
  - `%{FriendsBar}%{IconsView}` `scale(.75)`.
  - Context menu container entry keyframes.
  - Store widgets: `%{AppCarouselPosition}`, `%{AppCarouselCtn}`, `%{SaleSticker}`, `.CarouselBtn*`, and the pure-react-carousel tray.

## 12. Scrolling and virtualization containers

| Container | Axis | Virtualized? |
|---|---|---|
| `%{ScrollArea}` (home outer) | Y | no |
| `%{TabContentsScroll}` (every tabbed page; home inner) | Y | no (its content may be) |
| `%{FixCenterAlignScroll}` (tab row) | X | no |
| `%{CSSGrid>Container}` / `%{CSSGrid}` (library grid, collections grid) | in the Y scroller | **yes**, visible rows ±3 |
| `%{BasicGameCarousel}`, `%{RecentlyCompletedCarousel}`, `%{ItemsCarousel}`, `%{MarketingMessagesCarousel}`, `%{InGameCarousel}`, `%{GameCarousel}` | X | **yes** (react-virtualized) |
| Personal Calendar `carousel__slider-tray-wrapper` | X | no (25 slides, tray positioned by the library) |
| `%{ResultsGridWrapper}` grid (search) | in the Y scroller | **yes** (@tanstack, rows translateY) |
| `%{DialogWrapper}` (filter dialog) | Y | no |
| `%{*GamepadDialogContent>contextMenuContents}` (menus) | Y | no |

## 13. Content versus chrome

- **Content** (leave alone):
  - Every `img %{PortraitImage>Image}` (capsule, landscape, cover and hero art).
  - `%{RecentGamesBackgroundImage}`, `%{CollectionBG}` and the mini capsules, `%{SeasonalSale>Banner}`, `%{MarketingMessage>Image}`.
  - `%{PersonalCalendarWidget>Image}` / `%{StoreAppCapsule}`, the `%{AppCapsuleCtn}` backgrounds, search `%{GamepadSearch>GameIcon}`.
  - Avatars (`img %{avatar}`), achievement icons, profile backgrounds (`%{miniProfileBackground*}`).
  - The placeholder art Steam generates for non-Steam shortcuts.
  - Art-based glows (`%{LibraryImageBackgroundGlow}`, `%{CarouselCapsuleBackgroundGlow}`) are derived from content. Their colour comes from the art.
- **Chrome** (restyle):
  - Page backgrounds (`%{BasicHome}%{OpaqueBackground}`, `%{GamepadLibrary}`, `%{GamepadSearch}`).
  - Header and footer.
  - Tab row, tabs, counts, arrows, the scrolled band.
  - VR sub-tab pills.
  - Capsule frame: shadow, outline, focus ring, compat badge pill, missing-art title text.
  - Carousel labels and "View more" tiles.
  - Section headers.
  - `%{RecentlyCompletedItem}`, `%{GameCapsule}` bottom bar and InLibrary tag, `%{InGameGame}`, activity cards.
  - Calendar day columns, discovery header gradient.
  - Collection tiles (bg, label).
  - Context menus, the filter dialog, and every control in it.
  - Search result description rows, redirect tile, "No Results Found".
- **Keep semantic colours**:
  - Price widgets: discount green, NEW blue.
  - Friends badge green.
  - Play green, install/update blue, destructive red in menus.
  - Compat icons (verified green, playable yellow).
