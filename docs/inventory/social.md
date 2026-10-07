# Inventory: area `social` (surface `main`: friends & chat, account, downloads, media, store chrome, power menu, and every other non-library/non-settings route)

Mapped live on the Frame on 2026-10-06 with the theme **off**. Every shot is `shots/social_*.png` (1.5x, 1920x1080). Class tokens are copied from `python glass.py outline` output; paint values are `getComputedStyle` reads; state rules were read from the live stylesheets and are quoted with tokens substituted.

Privacy: the shots contain the user's persona name, account name, friend code and friends' names/avatars (they are on the user's own device). This document never repeats them; it says "friend", "persona name", etc.

Source modules (for re-reading Steam's code through `webpackChunksteamui`):
- `80344` exports the route table `B` (imported as `S.BV`/`d.BV`/`a.BV` elsewhere). Every path below comes from it.
- `46307` (744 KB) is the gamepad UI. Its component `E7` holds the main window `<Switch>` (see 0.2). `eg` wraps it and also mounts the friends overlay (`Pi.ZY`, visible when the path starts with `/chat`).
- `80096` is the main menu item list (Home / Library / Store / Friends & Chat / Media / Downloads / Steam Settings / VR Settings / Power). On the Frame `IN_VR` is true, so **Friends & Chat is the `/chat` route** (`K.Xk()` = `IN_VR`), not the QAM friends tab.
- `20447` (100 KB) is the friends UI (literal, unhashed `friendsui` class names). `5241` is the chat dialog.
- `11698` downloads page, `50165` media list/grid/share, `64086` media item, `42311` screenshot share sheet, `76486` SteamWeb/ExternalWeb routes, `10970` MicroTxnAuth, `39992` in-app Browser route, `79100` power menu (`d4`), `377` context-menu manager (`XX`), `13240` its class, `54069` parental route blocking, `12442` notes routes.

---

## 0. How to reproduce (read first)

### 0.1 Pitfalls found while mapping

1. **MSYS path conversion.** In Git Bash, `--route /chat` arrives as `C:/Program Files/Git/chat` and `L.nav` turns it into `/library/app/<id>/tab/C:/Program Files/Git/...`. Always `export MSYS_NO_PATHCONV=1` first (same finding as `bar.md`).
2. **The route moves under you, even inside the lock.** Other agents use `glass.py js "L.nav(...)"`/`nav`, which do not hold the lab lock. Twice my `--route` had been replaced by a settings route before `--pre` ran. Every `--pre` below therefore re-navigates when `L.route()` is wrong, and ends with a check. After each shot, look at the PNG.
3. **Focus persists between commands.** Steam keeps gamepad focus per route. After a context menu is closed with `Hide()`, `main` has **no** `.gpfocus` at all (`L.focused('main')` = `{}`); one `L.pad('down',1)` restores it.
4. **Opening menus with buttons.** Many sub-UIs are bound to controller buttons, not clickable elements. `FocusNavController.DispatchVirtualButtonClick(code)` sends one: `1` A, `2` B, `3` X (SECONDARY), `4` Y (OPTIONS), `14` Start/≡ (menu). Every snippet checks the footer legend or focus first, so it never presses a button whose action is not the one named. **Never send 1 (A) or 2 (B) on these screens**: A on a friend sends you into a chat entry, A on a menu item performs it.
5. **Programmatic menus are not focused.** A menu opened with `SteamUIStore.OpenPowerMenu(null)` or via the friends Options button renders with no focused item (items have `Panel` but no `Focusable`/`.gpfocus`). In real use the first item is focused. Focused/selected item styling is captured on the Media and Account menus instead.

### 0.2 Every top-level route the main window knows

From `80344` (`B`) plus the `<Switch>` in `46307/E7` (first match wins). "Owner" is the area that maps it.

| Path | Component in `E7` | Owner | On the Frame | Shot |
|---|---|---|---|---|
| `/library`, `/library/home`, `/library/collection/:id`, `/library/collections`, `/library/tab/:id` | `x5`, `r5` | library | reachable | (library) |
| `/library/app/:appid`, `/library/app/:appid/tab/:id` | `T3.xA` | appdetails | reachable | (appdetails) |
| `/library/app/:appid/achievements[/my\|/my/individual\|/my/global\|/friend/:accountid/...]` | `hA.wi` (`bShowGameInfoInHeader`) | appdetails (shots `appdetails_achievements_*`) | reachable from app details | - |
| `/app/:appid/properties/*` | `fA.Z0` | appdetails | reachable | (appdetails) |
| `/settings/*` | `_A.wB` | settings | reachable | (settings) |
| `/search`, `/search/tab/:id` | `eA` | shell / library (`shell_search_*`, `library_search_*`) | reachable | - |
| **`/chat`** | `Xc` with no children; the UI is the friends overlay `Pi.ZY` mounted by `eg` | **social §2** | reachable (menu: Friends & Chat) | `social_chat_*` |
| **`/invites`** | `Pi.u2` (Add a Friend) | **social §3** | reachable (friends header button, Account "Add Friends") | `social_invites` |
| **`/account`** | `je.I` | **social §4** | reachable (bar avatar) | `social_account*` |
| **`/library/downloads`** | `pA.lw` (matched before `/library`) | **social §5** | reachable (menu: Downloads) | `social_downloads*` |
| **`/media`, `/media/grid`, `/media/list`, `/media/item/:type/:id`** | `bA` | **social §6** | reachable (menu: Media → `/media/grid`) | `social_media_*` |
| **`/steamweb`** (state `{url}`) | browser view `x` in `76486` (outside `E7`) | **social §7** (chrome only) | reachable (menu: Store; Account "View Profile"; friend "View Profile") | `social_store` |
| **`/externalweb`** | browser view `j` in `76486` | **social §7** | reachable (external links) | `social_externalweb` |
| `/microtxnauth` | `10970` | social, **not opened** | purchase-authorization flow; never navigated | - |
| `/browser/` (state `strURL`) | `39992` | social, not opened | needs router state; without it Steam logs "Browser route with no state" and blocks | - |
| (no route) **Power menu** | `79100.d4` context menu | **social §8** | `SteamUIStore.OpenPowerMenu(null)` | `social_power_menu` |
| `/about` | `ln` | social §9.1 | reachable by route only (menu shows it only when logged out) | `social_about` |
| `/accessibility` | `x7` | social §9.2 | reachable by route only (menu: logged out only) | `social_accessibility` |
| `/console` | `e8.C` | social §9.3 | reachable by route (menu item only when console enabled) | `social_console` |
| `/colorsettings` | `n8` | social §9.4 (settings may also own it) | reachable by route | `social_colorsettings` |
| `/zoo/*` | `Nr` (22 dev tabs) | shell uses `/zoo/modals`; social §9.5 | reachable by route | `social_zoo` |
| `/decksetup` | `P5` (setup help, QR) | social §9.6 | reachable by route (menu "Help" only during OOBE) | `social_decksetup` |
| `/workshop` | placeholder `<a href="steam://open/workshop">` | social §9.7 | reachable by route | `social_workshop` |
| `/notes/app/:appid/:noteid?` | `o8.u` standalone notes | social §9.8 | reachable by route | `social_notes` |
| `/error` | `Mi` | social §9.9 | renders empty without state | `social_error` |
| `/apprunning` | `k5` in `$2` | social §9.10 | **empty**: no game running (`RunningApps=[]`); launching is forbidden | `social_apprunning` |
| `/keyboard` | `_n` in `$2` | hud (keyboard surface) | only an empty `%{OverlayPosition}` in main | - |
| `/gameapiosk` | `mt` | - | redirects away (needs a game's keyboard request) | - |
| `/app/:appid/overlay[/achievements\|/controller\|/guides\|/notes\|/browser\|/gamerecording]` | `s8.UI` | - | **unreachable**: for a non-running app it navigates back immediately | - |
| `/app/:appid/controllerconfigurator/*`, `/standalonecontrollerconfigurator` | `qt.yE` | appdetails/settings | not mapped here | - |
| `/controller/bindinput/:i`, `/controller/devicesupport/:i`, `/controller/calibration/:i/*` | `L3.Hg`, `L3.cs`, `HA` | settings | not mapped here | - |
| `/login`, `/createaccount`, `/oobe/*` | `w3.GW`, `w3.g`, `w7` | - | **not opened on purpose**: login/OOBE flows on a signed-in device; `w7` restarts Steam/PC on completion | - |
| `/`, `/index.html`, `/sp.html` | empty | - | - | - |
| `/store`, `/routes`, `/init` | none (parental-control map / helpers only) | - | not routes in the switch | - |

There is **no** `/friends`, `/profile`, `/notifications`, `/power` or `/achievements` route. Profiles are community pages shown in `/steamweb`. Notifications live in the QAM (barpopup, mapped in `bar.md`) and toasts (surface `notifications`, hud).

### 0.3 `--pre` snippets (tested verbatim with `python glass.py shot main NAME --route R --theme off --pre "..."`)

`W` and the route guard are repeated in each, so each is self-contained.

**FRIEND-FOCUS** (`--route /chat`): puts controller focus on the first friend row. This also shows that friend's chat on the right (a preview; nothing is sent).
```
(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));if(L.route()!=='/chat'){L.nav('/chat');await W(1200)}let f=L.focused('main').VR||'';for(let k=0;k<6&&!/^friend /.test(f);k++){if(/chatTextarea|chatSubmit|oneOnOne|inviteAnother|ChatTab/.test(f))await L.pad('left',1);else await L.pad('down',1);f=L.focused('main').VR||''}await W(500);return L.route()+' '+f.slice(0,40)})()
```
**CHAT-ENTRY-FOCUS**: FRIEND-FOCUS, then `await L.pad('right',1)` focuses `%{chatTextarea}`. It does not open the keyboard and types nothing.

**FRIENDS-TAB i** (`--route /chat`, i = 0 Favorites, 1 Friends, 2 Groups, 3 Recent Chats). Switching tabs is local UI state (`UIStore.FriendsListSteamDeckActiveTab`). Put it back to 1 afterwards.
```
(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));if(L.route()!=='/chat'){L.nav('/chat');await W(1200)}const t=L.qa('main','.FriendsListTab')[2];t.setAttribute('data-soc','tab');L.click('main','[data-soc="tab"]');t.removeAttribute('data-soc');await W(900);return L.q('main','.TabPanelHeader').innerText})()
```
**FRIEND-OPTIONS** (`--route /chat`): opens the friend context menu with Start.
```
(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));if(L.route()!=='/chat'){L.nav('/chat');await W(1200)}let f=L.focused('main').VR||'';for(let k=0;k<6&&!/^friend /.test(f);k++){if(/chatTextarea|chatSubmit|oneOnOne|inviteAnother|ChatTab/.test(f))await L.pad('left',1);else await L.pad('down',1);f=L.focused('main').VR||''}if(!/^friend /.test(f))return 'ABORT '+f;FocusNavController.DispatchVirtualButtonClick(14);await W(1000);return 'menu open'})()
```
**MEDIA-BUTTON b** (`--route /media/grid`; b = 4 Filter modal, 3 Select Game menu, 14 item Options menu). It refuses unless a grid item has focus.
```
(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));if(L.route()!=='/media/grid'){L.nav('/media/grid');await W(1200)}await W(400);const f=L.focused('main').VR||'';if(!/ListItem/.test(f))return 'ABORT '+f;FocusNavController.DispatchVirtualButtonClick(4);await W(900);return 'ok'})()
```
**MEDIA-OPEN-ITEM** (`--route /media/grid`): `L.click('main','%{ListItemAndGlowContainer>ListItem}')` opens the first item (navigation to `/media/item/screenshot/<id>`; it was `250820_1` here). For a clip, mark the first item that contains `%{ListItemAndGlowContainer>DurationText}` with a data attribute and click it (it was `/media/item/clip/clip_15888169422007828480_20261005_180904`).

**ITEM-SHOW-CONTROLS** (on a `/media/item/...` route): Y toggles the floating controls. It checks that the legend says "Show" first.
```
(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));await W(500);const leg=[...L.surface('main').document.querySelectorAll(L.sel('%{ActionButtonLabel}'))].map(e=>e.innerText).join('|');if(!/Show/i.test(leg))return 'ABORT '+leg;FocusNavController.DispatchVirtualButtonClick(4);await W(900);return leg})()
```
**SHARE-SHEET** (screenshot item): `L.clickText('main','%{ButtonBox}','Share')` opens the share sheet (a context menu). It does not upload.

**ACCOUNT-STATUS-DROPDOWN** (`--route /account`): `L.click('main','%{AccountPanelPage} %{DropDownControlButton}')`. Close it with CLOSE-MENU, **never** pick an option.

**DOWNLOADS-BUTTON b** (`--route /library/downloads`; b = 14 item Options, 4 Change Device). Focus is restored first.
```
(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));if(L.route()!=='/library/downloads'){L.nav('/library/downloads');await W(1200)}if(!/SectionItemWrapper/.test(L.focused('main').VR||'')){await L.pad('down',1);await W(300)}const leg=[...L.surface('main').document.querySelectorAll(L.sel('%{ActionButtonLabel}'))].map(e=>e.innerText).join('|');if(!/Options/i.test(leg))return 'ABORT '+leg;FocusNavController.DispatchVirtualButtonClick(14);await W(1000);return leg})()
```
**POWER-MENU** (any route): `(async()=>{SteamUIStore.OpenPowerMenu(null);await new Promise(r=>setTimeout(r,1200));return 1})()`. `OpenPowerMenu(el, onCancel)` only calls `d4` → `lX(<PowerMenu/>)`, which shows the menu. It renders in `main` (`VR_uid0`).

**CLOSE-MENU**: run with `glass.py js` right after the shot. It hides every open gamepad context menu (dropdowns, share sheet, power, friend options) **without activating anything**.
```
(async()=>{let req;webpackChunksteamui.push([[Symbol()],{},r=>req=r]);const X=req(377).XX;let n=0;for(const w of [L.surface('main'),window]){const m=X.GetContextMenuManager(w);while(m.ActiveMenu&&n<6){m.ActiveMenu.Hide();n++;await new Promise(r=>setTimeout(r,150))}}return 'hidden '+n})()
```
(If `377` moves after a Steam update, find the module whose source contains `GetContextMenuManagerFromWindow`.)

**CLOSE-MODAL** (media Filters modal): `L.clickText('main','.GenericConfirmDialog .DialogFooter .DialogButton','Close')`. "Close" only dismisses the dialog. `SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.ModalManager.modals.length` goes back to 0.

### 0.4 Never click / never press (side effects)

| Where | Element / button | Effect |
|---|---|---|
| /chat | A on a friend, `%{chatSubmitButton}`, typing in `%{chatTextarea}`, **holding Select** (radial quick-message menu) | sends a message |
| /chat | Y on a friend chat ("Start Voice Chat"), `.oneOnOneVoiceChatButton`, `.inviteAnotherFriendButton` | voice call or group invite |
| /chat | Groups tab "Create Group Chat" / `.NewChatGroupButton` | creates a group chat |
| /chat | friend Options items: Send Message, Start Voice Chat, Find Games…, **Trading ›**, **Manage ›** (remove/block) | friend actions. Submenus were not opened |
| /chat | `.groupName` A ("Collapse") | toggles a persisted collapse state. Avoided |
| /invites | typing a code, `%{DialogContent_InnerWidth>SubmitButton}` "OK" | sends a friend invite |
| /account | status dropdown options, Do Not Disturb toggle, Sign Out, Change Account, Add Funds, Privacy Settings, Account Details | settings or sign-out. Add Funds and the others open store pages |
| /library/downloads | "Clear All", item Options (Uninstall is the **first, focused** item; Remove from List; Add to Favorites; Add to ›; Manage ›; Developer ›; Properties…), Change Device options | uninstall, list edits, switch to managing a remote PC |
| /media | item Options "Delete", item-view trash `%{TopList>IconButton}`, X on a clip ("Delete Clip"), share-sheet rows (Share on Steam / Copy / Save / Send to Phone / **All chats**), clip "Clip" and "add marker" buttons | delete, upload, send to chat, create files |
| /steamweb, /externalweb | **Y = "Add to Cart"**, anything inside the page | purchase flow |
| Power menu | every item (Sleep, Shutdown, Restart Device, Restart Steam VR, Change Account, Sign Out, Restart Steam) | power or sign-out |
| /about | Hostname button, Factory Reset, the Wi-Fi toggles | rename, factory reset, settings |
| /colorsettings | left/right on the focused slider (`L.pad` refuses left/right on sliders) | changes display colour |
| /notes | `%{Page>NewNoteButton}`, typing in the ProseMirror editor | creates or edits notes |
| /workshop | the WORKSHOP link | opens `steam://open/workshop` |

Safe and used here: navigating routes, D-pad focus moves, friends tab switches, opening and closing menus, the Filters modal, Y show/hide in the media viewer, opening the share sheet, and the account status dropdown (closed with Hide).

---

## 1. Chrome shared by every route in this area (owned by shell; listed so the per-screen notes make sense)

| Element | Today | Notes |
|---|---|---|
| `body %{*PopupBody} GamepadMode BasicUI … LowPerfMode` → `div BasicUI GamepadMode %{BasicUiRoot} %{SteamUIPopupHTML>VR} MediumWindow WideWindow` (r=6) → `%{MainNavMenuMainSplit}` | | body background is transparent |
| `%{BasicHome}` + one of three background classes (chosen by route in `46307 F9`) | `%{OpaqueBackground}`: `radial-gradient(155.42% 100% at 0% 0%, #060a0e 0%, #0e141b 100%)` (invites, account, downloads, media, about…). **`%{TrueBlackBackground}`: solid `rgb(0,0,0)`** on `/chat`, `/colorsettings`, controller configurator. `%{PopupBody>TransparentBackground}`: no paint on `/steamweb`, `/externalweb`, `/microtxnauth` and overlay paths | The glass theme needs a rule for each. TrueBlack is opaque black in the headset, not passthrough |
| Header `%{Profile>Header} GamepadMode FlexGrowUniversalSearch` (1280x40, abs) | `::before` = `rgba(0,0,0,.5)` + `backdrop-filter: blur(100px)`, z -1. Inline `--gamepadui-header-opacity` / `--gamepadui-header-background-opacity` (Steam animates them). `%{OverrideHeaderBackground}` added on `/account` and home. `%{BackContainer}::after` = 1px `#23262e` divider | Store routes use a different header (§7) |
| Footer `%{BasicFooter}` (1280x42) | `rgba(0,0,0,.5)` + `backdrop-filter: blur(100px)`, top border 0.67px `rgb(172,178,184)`. `%{ActionButtonLegend}` r6, label 12/22 700 uppercase `#fff`, glyph `%{FooterGlyphSize}` 25px | `/steamweb` adds `%{PopupBody>Opaque} %{Relative}`: solid `#000`, not blurred |
| Modal stack | `%{*GamepadDialogContent>ModalPosition} … %{*GamepadDialogContent>VR} %{…>FooterVisible}`, click-catcher `%{…>ModalClickToDismiss}`, moving focus ring `%{FocusRing}` (outline 2px `rgba(255,255,255,.6)`; **inline left/top/width/height, animated**) | the page behind is blurred and dimmed |
| Gamepad context menus | `%{*BasicContextMenuModal>BasicContextMenuContainer}` (280 wide, centred, `transform` animated) › `%{…>contextMenuContents}` (`filter: drop-shadow(0 0 8px rgba(0,0,0,.5))`, overflow-y auto) › rows `%{…>contextMenuItem} contextMenuItem` 48px, bg `#23262e`, text `#b8bcbf` 16/20. Title above: `%{*BasicContextMenuModal>BasicContextMenuHeader}` | Focused = `%{…>Focused}.gpfocus`: bg `#fff`, text `#0e141b`. `%{…>Selected}` marks the current value. **`%{…>Destructive}` + Focused: bg `#de3618`, `#fff`; hover `#8a220f`** (unfocused looks like a normal row). `%{…>ContextMenuSeparator}` 2px `#000`. `%{…>SubMenu}` rows have `%{…>Label}` + `%{…>Arrow}` chevron |

**Focus fills are CSS animations, not static rules.** Most gamepad rows in this area get their focus fill from `animation-name: ItemFocusAnim-<variant>` with `0.5s` and `animation-fill-mode: forwards`. The end keyframe holds the colour, so a theme `background` on `.gpfocus` loses to the animation unless it uses `!important` or replaces `animation-name`. Measured on `.friend.gpfocus` and `.groupName.gpfocus`: `ItemFocusAnim-darkGrey 0.5s forwards`. Keyframes:
- `ItemFocusAnim-darkGrey`: bg `rgba(255,255,255,.25)`→`rgba(255,255,255,.15)`, colour `#8b929a`→`#fff`. Used by friend rows, group headers, chat side buttons.
- `ItemFocusAnim-darkerGrey`: bg `#3d4450`→`#23262e`.
- `ItemFocusAnim-darkGreySettings`: `#23262e`→`#383a41`. Settings Field rows (Account, About, Accessibility).
- `ItemFocusAnim-green`: `#c9ffc9`→`#59bf40`. Voice-requested button.
- Downloads uses hashed `_2_NVaYFaR9KLkBrJC1QqdS` (the same values as darkGrey) on `%{SectionItem}`, and `m8AgfZA3wzAhpLlyIIWfF` (border `#67707b`→`#3d4450`) on `%{SectionList}` when the active section has focus.

---

## 2. Friends & Chat: route `/chat`

Reach it with `python glass.py shot main social_chat_friends --route /chat --theme off` (menu: Steam frame menu › Friends & Chat).

Shots:
- `social_chat_friends.png`: initial; focus on an in-game group header.
- `social_chat_friend_focus.png`: FRIEND-FOCUS, showing the chat preview and the quick-message hint.
- `social_chat_dialog_entry_focus.png`: CHAT-ENTRY-FOCUS.
- `social_chat_tab_favorites.png`, `social_chat_tab_groups.png`, `social_chat_tab_recent.png`: FRIENDS-TAB 0/2/3. All three are empty states.
- `social_chat_friend_options.png`: FRIEND-OPTIONS, then CLOSE-MENU.

### 2.1 Structure

The friends UI uses **literal, unhashed classes** (from `friends.css` in `chunk~2dcc5aaf7.css`). Write them as plain CSS; only the wrappers and a few children are hashed tokens.

```
div %{PopupBody>Content}
  div %{PartnerEventOverlayContainer>AppDetailsMain}
    div %{TopLevelTransitionSwitch} … (empty route content)
    div %{FriendsChatsContainer}            abs 1280x720. INLINE style="--gamepad-page-gutter-width:0px; display:block|none" (Steam toggles it; it stays mounted with display:none on other routes)
      div %{FriendsChats} friendsui-container
        div FriendsListAndChatsSteamDeck
          div %{FriendListContainerPanel}     [0,0 300x720]
            div friendlist GamepadMode        (gpfocuswithin while focus is in the list)
              div FriendsListSteamDeckTopSection   [300x140]
                div TabPanelHeader "Friends|Favorites|Groups|Recent Chats"
                  div FriendActionsContainer
                    div friendListButton AddFriendButton role=button   (Friends tab; → /invites)
                    [div FriendsInvitesButton > .WavingArm + .PendingInviteCount]   (only with pending invites)
                    [div NewChatGroupButton]           (Groups tab; never activate)
                div FriendsListSteamDeckTabs
                  div %{TabBumper} > img %{BumperIcon}   (L1/LB glyph, op .4)
                  div FriendsListTab [Active] role=button > svg SVGIcon_FavoriteFriends | SVGIcon_FriendIcon | SVGIcon_Group | div %{RecentChatIcon}>svg
                  div %{TabBumper} > img %{BumperIcon}   (R1/RB)
              div FriendsListTabPanelContainer          overflow-x scroll (hidden)
                div FavoritesTabList  FriendsListTabPanel [beforeActiveTab|Active|afterActiveTab]
                div FriendsTabList    FriendsListTabPanel Active
                  div FriendsListContent > div friendlistListContainer (SCROLLER, overflow-y auto) > div listContentContainer
                    div DropTarget friendGroup gameGroup            (one per game being played by friends)
                      div groupName role=button  > div gameGroupContainer > img groupIcon (r2) ; span groupCount (op 0) ; hr
                      div friendsContainer > div friend …
                    div DropTarget friendGroup onlineFriends
                      div groupHeaderContainer > div groupName [Collapsed] role=button "Online Friends" > span groupCount "(n)"
                      div groupList > div friendCategoryContainer > div friend …
                    div DropTarget friendGroup offlineFriends
                      div groupHeaderContainer > div groupName Collapsed "Offline" + div SortByRecent Collapsed (op 0) > svg SVGIcon_SortBy
                div GroupsTabList FriendsListTabPanel > div GroupChats > div ChatRoomList CompactFriendsList
                  div ChatRoomList_Empty (text) > div ChatRoomList_Empty_Description ; button DialogButton Secondary %{*GamepadDialogContent>Button} "Create Group Chat"
                div RecentMessagesTabList FriendsListTabPanel > div %{RecentChatsList}
          div SteamDeckChats                   [300,0 980x720]
            div multiChatDialog GamepadMode
              (no chat yet) div emptyChatDialogs "SELECT A FRIEND OR GROUP TO START"
              (chat shown)  div %{ChatTab} no-drag %{ChatTabTransitionGroup>Active} role=button   [980x100]
                              div %{ChatTabRow} > div %{ChatTabContent_Friend} > div friend <state> (same friend markup, 40px avatar)
                            div chatDialogs > div DropTarget chatWindow MultiUserChat
                              div speakerLabelWidthContainer (op 0, measuring only)
                              div ChatRoomGroupDialog_contents > … > div chatBody
                                div %{FriendListInsetShadowTop}                    (8px top fade)
                                div chatStack displayColumn > div chatHistoryAndMembers > …
                                  div ChatRoomGroupDialog_history
                                    div ChatHistoryContainer role=button
                                      div ChatHistorySelector (op 0)  ; div LoadingOlderMessages (op 0)
                                      div chatHistoryScroll  (SCROLLER, loads older messages upward)
                                        div chatHistory > div msg timeDivision "Tuesday, October 6, 2026"  [+ message blocks, see 2.5]
                                      div FriendChatTypingNotification (op 0, "<friend> is typing a message…")
                                  div RightSideButtonContainer
                                    div oneOnOneVoiceChatButton NotInVoiceChat role=button > svg SVGIcon_VoiceRoom   (only for online friends)
                                    div inviteAnotherFriendButton role=button > svg SVGIcon_Invite
                                  div dropTargetBox (op 0)
                                div chatEntry
                                  form %{chatEntryControls}
                                    textarea %{chatTextarea}
                                    button %{chatSubmitButton} [%{disabled}] > svg SVGIcon_Submit %{HasHorizontalDirection>FlipInRTL}
                                div RadialMenuExplainerText [FriendIsTyping]  "Hold [≡] to send a quick message"  (10 s after a chat tab activates)
```

Friend row (`div friend <online|ingame|offline> [awayOrSnooze] %{hoverParent} friendStatusHover`, 300x42–46):
```
div > div %{avatarHolder} avatarHolder no-drag Medium <state>
        div %{avatarHolder>avatarStatus} avatarStatus     3px status bar at the right of the avatar, mask-image (data:png)
        img %{avatar} avatar 32x32
div labelHolder <state> %{noContextMenu} %{twoLine}
  div %{statusAndName} > div %{playerName} "<persona>" [+ div %{SnoozeZ>SnoozeContainer} > div %{SnoozeZ} %{Z1|Z2|Z3} "Z"]
  div %{richPresenceContainer} > div %{gameName} %{richPresenceLabel} no-drag "<game | Online | Away | Last online …>"
```

### 2.2 Paint today

| Element | Paint |
|---|---|
| `%{BasicHome}` on /chat | `%{TrueBlackBackground}` = solid `#000` |
| `.friendlist.GamepadMode` | `radial-gradient(155.42% 100% at 50% 0%, #0e141b 0%, rgba(14,20,27,.5) 60%, rgba(14,20,27,.2) 100%)`. **`.gpfocuswithin`** swaps every stop to `#23262e`. overflow hidden, right border 0.67px (style none) |
| `.FriendsListSteamDeckTopSection` | transparent. Under `.friendlist.gpfocuswithin`: bg `#23262e` + `box-shadow: #0e141b 0 0 10px` |
| `.TabPanelHeader` | `#fff` 22/28 700 |
| `.AddFriendButton` / `.NewChatGroupButton` / `.FriendsInvitesButton` | bg `rgba(103,112,123,.25)`, r3, icon `#67707b`. `.gpfocus`: bg `#67707b`, `#fff`. `.PendingInviteCount`: bg `#de3618` r4, text `#0e141b` |
| `.FriendsListTab` | icon colour `#3d4450` (transition colour 50 ms). `:hover` `#67707b`. `.Active` `#8b929a`. `.gpfocus` `#fff`. There is no background or underline: state is icon colour only |
| `%{TabBumper}` | opacity .4 (L1/R1 or LB/RB glyph image) |
| `.groupName` | text `#c5d6d4` 14/20. Focus: `ItemFocusAnim-darkGrey` → `rgba(255,255,255,.15)` + `#fff`. A separate rule `.friendGroup .groupName.gpfocus { background:#3d4450 }` loses to the animation. `.groupCount` `#73c257` 12/20, op 0 until shown. `hr` inset border transparent |
| `.friend` | transparent. Colours by state: in-game name `#59bf40` 16/20, game `#3e862d` 12/16. Online name `#b3dfff` 15/20, presence `#4cb4ff` 12/15. `.avatarStatus` bar `#59bf40` in-game, `#4cb4ff` online, `#67707b` offline. Avatar img: 0.67px transparent border, `box-shadow: rgba(0,0,0,.3) 2px 2px 8px 1px`, `filter` transition .24 s (offline avatars are desaturated; hover restores `filter: brightness(100%) saturate(100%)`). `%{SnoozeZ}` 8px 700 |
| `.friend.gpfocus` | `ItemFocusAnim-darkGrey 0.5s forwards` → bg `rgba(255,255,255,.15)`, colour `#e8e9eb`. The name keeps its state colour |
| `.SortByRecent` | op 0 (shows on hover or focus of the Offline header) |
| `.multiChatDialog.GamepadMode` | `radial-gradient(… #0e141b 0%, rgba(14,20,27,.5) 60%, rgba(14,20,27,.2) 100%)` |
| `.emptyChatDialogs` | 12px 700 uppercase, `#dcdedf`, centred (line-height 604.8px) |
| `%{ChatTab}` | transparent, `box-shadow: #0e141b 0 0 10px`, padding transition .2 s. `::before` 1px left divider (no colour). `.gpfocus` + Active: `#3d4450`. `%{VoiceActive}`: green radial gradient (unreachable) |
| `%{FriendListInsetShadowTop}` | `linear-gradient(#0e141b 0%, rgba(14,20,27,.5) 25%, transparent 100%)`, 8px |
| `.msg.timeDivision` | 10/18 700 uppercase `#67707b`, r6, flanked by lines |
| `.ChatHistorySelector` | `radial-gradient(120% 160% at 40% 50%, #3d4450 0%, transparent 75%)`, r3, blur(2px), op 0 |
| `.FriendChatTypingNotification` | `linear-gradient(to top, rgba(19,32,44,.9) 0, … 12px, transparent 80%)`, `#8097a1` 14px 100, op 0 → 1 (transition .4 s) |
| `.oneOnOneVoiceChatButton`, `.inviteAnotherFriendButton` | bg `#2b333f`, r `3px 0 0 3px`, icon `#67707b`, 46x53. `.gpfocus`: `ItemFocusAnim-darkGrey`. Voice requested: icon `#fff`, focus `ItemFocusAnim-green` |
| `%{chatEntryControls}` (form) | bg `rgba(255,255,255,.15)`, `box-shadow: #0e141b 0 0 10px`, transform transition .32 s. The textarea has no own fill; **focusing the textarea changes nothing visually** (only the footer legend changes) |
| `%{chatSubmitButton}` | transparent, icon `#898989`. Enabled: bg `#67707b`, `#fff`. Enabled + `.gpfocus`: bg `#fff` |
| `.RadialMenuExplainerText` | `#d3d3d3`, abs bottom, z 12, padding `18px 10px 4px`, glyph img 20px. `.FriendIsTyping` → op 0 |
| `.dropTargetBox` | 2px dashed `rgba(0,217,255,.4)`, r8, op 0 (drag-and-drop only) |
| `.ChatRoomList_Empty` | `rgba(197,214,212,.35)` 14px. Button `rgba(255,255,255,.15)` r2 |

### 2.3 States observed

- **Focus moves the chat**: focusing a friend row opens that friend's chat in the right pane immediately (`%{ChatTab}` + history + entry). A then means "Send Message".
- Footer legends: on a group header `Y View Game in Library · A Collapse · B Back`; on a friend `≡ Options · A Send Message · B Back`; in the chat entry `Y Start Voice Chat · A Select · B Back`. Never press Y or A here.
- `.friendlist.gpfocuswithin` versus focus in the chat (list background darkens), see 2.2.
- Tab panels slide: `.FriendsListTabPanel` is absolute. `.Active` = `opacity 1; transform: translateX(0)`. `.beforeActiveTab`/`.afterActiveTab` = `translateX(∓64px)`, op 0, `pointer-events:none`, with a 0.5 s keyframe animation. **Don't touch transform or opacity on these.**
- `.groupName.Collapsed` / `.groupCount.collapsed`: the Offline group starts collapsed. `.ExpandPlusMinus`/`.ExpandArrow` show on hover.
- Snooze "zZ" animates (`%{SnoozeZ}` animation on focus or hover).

### 2.4 Transforms, inline styles, scrollers (do not touch)

- `.friend` and `.groupName` carry `transform: matrix3d(…)` (≈ rotateX 1°) with `transition: transform .32s` (Steam's BasicUI tilt). `%{avatarHolder}` transitions transform .34 s. `.labelHolder` transitions transform and opacity.
- `%{FriendsChatsContainer}` inline `display`. `%{avatarHolder>avatarStatus}` animates height, width and transform.
- Scrollers: `.friendlistListContainer` (y), `.FriendsListTabPanel > div:first-of-type` (overflow-y scroll), `.chatHistoryScroll` (both axes, infinite upward load), `.FriendsListTabPanelContainer` (overflow-x scroll, hidden).
- Pseudo-elements Steam uses here: only `%{ChatTab}::before` (1px divider) and the header ones (§1). Every other friends element is free for our own `::before`/`::after`.

### 2.5 Friend Options menu (`social_chat_friend_options.png`)

`%{*BasicContextMenuModal>contextMenuContents} friendsContextMenu` with the title = friend name (`BasicContextMenuHeader`). Rows:
1. Send Message
2. Start Voice Chat
3. separator
4. View Profile
5. Find Games to Play Together
6. Trading › (`%{…>SubMenu}`)
7. Manage › (`%{…>SubMenu}`)
8. separator
9. Cancel

Paint is the shared context menu (§1). The submenus were not opened (Manage holds Remove/Block).

### 2.6 Not reachable without side effects

- Message bubbles: none today. Older history loads only by scrolling into private messages. Their classes are `.ChatMessageBlock`, `.msg`, `.msgText` (`#c1c6cf`), `.speakerName`, `.FriendChatTimeStamp`, `.isCurrentUser`, `.serverMsg`, `.ChatMessageErrorSending`, `.spoilerMsgText`.
- Voice chat states (`%{VoiceActive}`, `%{MicMuted}`, `VoiceRequested`), group chats (`ChatRoomList` items, `chatRoomGroupHeader`), pending invites (`.FriendsInvitesButton`), favourites content, recent-chat rows, the radial quick-message menu, the "is typing" banner (needs the friend to type), and a signed-out friends state (needs a status change).

---

## 3. Add a Friend: route `/invites` (`social_invites.png`)

Reach it with `--route /invites` (the friends header `AddFriendButton` posts `FriendsUI NavigateToInvites`).

```
div %{InvitesListWrapper}
  div %{HiddenFrame>InvitesList} friendsui-container                          [0,40 1280x680]
    div %{DialogContent_InnerWidth>InvitesList}         bg #0e141b, overflow-y scroll (SCROLLER)
      div %{DialogContent_InnerWidth>TopSection}
        div %{AddFriendSection}
          div %{IncomingInvites>Title} "Add a Friend"                         #fff 22px
          div %{DialogContent_InnerWidth>Description}                         #fff 14px
          form %{InputForm}
            div DialogInput_Wrapper _DialogLayout > input %{*GamepadDialogContent>BasicTextInput} DialogInput DialogInputPlaceholder DialogTextInputBase %{DialogContent_InnerWidth>Input}
            button %{DialogContent_InnerWidth>SubmitButton} DialogButton Secondary %{*GamepadDialogContent>Button} "OK"
        div %{FriendCodeSection}
          div %{FriendCode}  bg #000 r4  > div %{DialogContent_InnerWidth>Code}   #9bd98c 28px   (the user's friend code)
          div %{DialogContent_InnerWidth>Caption} "Your Friend Code"           16px uppercase
```

States:
- Input: unfocused bg `rgba(255,255,255,.1)`, text `#8b929a`. **`.gpfocus` (the default focus on arrival): bg `#fff`** (caret visible).
- OK button: `rgba(255,255,255,.15)` r2; focus is the shared DialogButton white.

Unreachable (no pending invites): `%{IncomingInvites}`, `%{OutgoingInvites}`, `%{InvitesSectionHeader}`, `%{InvitesRow}`, `%{InvitesFriend}`, `%{MutualFriendRow}`, `%{Divider}` (module anchored by `IncomingInvites>Title`). Prefix them with an anchor when you write them, for example `%{IncomingInvites>InvitesRow}`.

---

## 4. Account (the "profile" page): route `/account`

Shots: `social_account.png`, and `social_account_status_dropdown.png` (ACCOUNT-STATUS-DROPDOWN, then CLOSE-MENU; the status stayed "Invisible", verified afterwards).

```
div %{OverflowHidden>GamepadPage} %{PadForFooter} %{Flexed} %{DialogBackground} %{ScrollPanel} %{ScrollY}   (SCROLLER; gradient bg; inline --gamepad-page-content-max-width)
  div %{*GamepadDialogContent_InnerWidth>GamepadDialogContent} DialogContent _DialogLayout %{GamepadPageDialogContent}
    div … DialogContent_InnerWidth > div DialogControlsSection %{AccountPanelPage}
      Field #1 (profile card): %{*GamepadDialogContent>Field} … %{…>HighlightOnFocus} %{…>Background}
        FieldLabel > div %{CurrentUserProfileBackground>AvatarAndLabel}
          div %{CurrentUserProfileBackground} > video %{CurrentUserProfileBackgroundImage}   (animated profile background, mask gradient, transform+opacity transition .5s)
          div %{avatarHolder} avatarHolder Large <state> %{CurrentUserProfileBackground>Avatar} > avatarStatus right + img %{avatar} 84px
          div %{CurrentUserProfileBackground>LabelHolder} … (transform: scale(1.4) — Steam's)  > %{playerName} #b8bcbf, %{gameName} #6e6e6e "Last online …"
        FieldRightColumn > button DialogButton Secondary %{*GamepadDialogContent>Button} "View Profile"   (→ /steamweb community profile)
      Field "Your Status" + button %{DropDownControlButton} DialogButton role=combobox
          > div %{*GamepadDialogContent>DropDownControlButtonContents} > div DialogDropDown_CurrentDisplay > %{DropDownLabelContainer} > %{DropDownLabelTextColumn} > %{DropDownLabelTitle} + %{DropDownLabelDescription} ; svg (caret)
      Field "Do Not Disturb" + %{*GamepadDialogContent>Toggle} > %{…>ToggleRail} (::before = blue fill, transform-animated) + %{…>ToggleSwitch}
      div DialogThreeColLayout _DialogColLayout %{FatButtonRow}
        3x button %{ParentalButton} %{FatButton} DialogButton Secondary > svg 40px + %{CurrentUserProfileBackground>Label} + %{CurrentUserProfileBackground>Details} + div %{ParentalWrapper} (abs overlay)
          "Add Funds" / "Privacy Settings" / "Account Details"
      Field "Friend Code: <code>" (%{CurrentUserProfileBackground>Highlight}) + button "Add Friends" (→ /invites)
      Field "Account: <name>" + div %{ChangeAccountButtons} > 2x button %{ChangeAccountButton} "Sign Out" | "Change Account"
```

| Element | Paint / states |
|---|---|
| Field rows | bg `#23262e` r2, `--indent-level:0` inline, transform transition .32 s. Focus-within (and the profile card while focused): bg `#383a41` (`ItemFocusAnim-darkGreySettings`), text `#fff`. Same primitive as the settings pages |
| DialogButton (View Profile, Add Friends, Sign Out…) | `rgba(255,255,255,.15)` r2, `#dcdedf` 16/20. **`.gpfocus`: bg `#fff`, text `#23262e`, `box-shadow 0 4px 4px rgba(0,0,0,.25)`** |
| `%{DropDownControlButton}` | same as DialogButton. Title `#dcdedf` 16/20, description `#8b929a` 12/16 |
| Toggle | rail `rgba(255,255,255,.15)` r9001. `::before` = `#1a9fff` fill, slid in with transform (`-27px` when off). Knob `#fff`, `box-shadow 0 0 5px rgba(0,0,0,.35)`. Toggle r16, box-shadow transition (focus ring) |
| `%{FatButton}` | bg `#23262e` r2, 394x124. Label `#fff` 16/20, details `#b8bcbf` 12/20 |
| Status dropdown menu | context menu with `role=listbox`. Options: Online / Away / **Invisible** (`%{…>Selected}`, focused, white) / Signed out, each with `%{DropDownLabelTitle}`/`%{DropDownLabelDescription}`; separator; Cancel |

---

## 5. Downloads: route `/library/downloads`

Shots:
- `social_downloads.png`: empty active section, one completed item, focus on it.
- `social_downloads_item_options.png`: DOWNLOADS-BUTTON 14, then CLOSE-MENU.
- `social_downloads_change_device.png`: DOWNLOADS-BUTTON with 4, then CLOSE-MENU.

```
div %{DownloadsPage} %{DownloadsPage>BasicUI}                  gradient bg (as OpaqueBackground)
  div %{DownloadsPage>TopSection} %{HasRemoteClients}          [1280x240] box-shadow 0 4px 8px rgba(0,0,0,.5)
    div %{DownloadsPage>Section} %{DownloadsPage>Empty} %{DownloadsPage>Active}   bg #0e141b   (active-download hero; empty now)
    div %{RemoteClientManagementRow}  (abs bottom-left)
      div %{RemoteClientManagementBackground}  bg rgba(0,0,0,.667) r5, #fff 12px "MANAGING DOWNLOADS FOR"
        div %{RemoteClientDownloadsSelector} > div %{ManagingRemoteClientName} "THIS DEVICE"  #1a9fff
  div %{ItemListWrapper} > div %{ItemListScrollWrapper} > div %{ItemLists}   (SCROLLER, overflow-y scroll)
    div %{DownloadsPage>Section} %{EmptyQueue}
      h3 %{*Reset} %{DownloadsPage>SectionTitle} > div %{TitleAndCount} > span %{DownloadsPage>Title} "Up Next" + span %{DownloadsPage>Count} "( 0 )"
                                                 div %{DownloadsPage>Rule} (2px rgba(103,112,123,.3)) ; div %{AutoUpdate} > div %{AutoUpdateHours} %{NoHours} %{IsViewingLocalClient}
      div %{SectionList} r5 role=list > div %{EmptyTransfers} > div %{DownloadsPage>Text} rgba(255,255,255,.5)
    div %{DownloadsPage>Section} %{Completed}
      h3 … "Completed" "( 1 )" + button %{RemoveAllButton} DialogButton "Clear All"   bg #3d4450 r2
      div %{SectionList} > div %{SectionItemWrapper} role=button
        div %{SectionItem}  75px, padding 8 0 8 12, overflow hidden
          div %{SectionItemContent}
            div %{AppPortrait} > (library capsule: %{LibraryItemBox} %{Landscape} %{InDownloads} %{FeaturedCapsule} %{BasicMode} …, ::before/::after shine — owned by library)
            div %{SectionItemCenter} > div %{SectionItemColumn} > div %{DownloadItemName} > div %{DownloadsPage>Name} 18/22 #fff ; div %{DetailsAndType}
                                      div %{SectionItemStatus} %{SectionItemColumn} %{DownloadsPage>Right}  "COMPLETED: TODAY 6:18 PM"  #8b929a 12/22 700 uppercase
```

States:
- `%{SectionItemWrapper}.gpfocus %{SectionItem}`: hashed keyframe → `rgba(255,255,255,.15)` + `#fff` (forwards).
- `%{SectionItem}:hover`: `#3d4450` r2.
- `%{DownloadsPage>Active}.gpfocuswithin %{SectionList}`: border pulse.
- Item buttons inside an active item: `%{DownloadsPage>Button}` `#3d4450` r2, white on focus, blue `#1a9fff` in the active section.
- Footer: `Y Change Device · ≡ Options · A Go To Game Page · B Back`.

Menus:
- Item Options: Uninstall (`Uninstall %{AppDetailsOverlayTransitionGroup>ContextMenuAction}`, first and focused), Remove from List, View in Library (`%{DownloadsPage>ContextMenuItem}`), separator, Add to Favorites, Add to ›, Manage ›, Developer ›, separator, Properties…, separator, Cancel.
- Change Device: listbox with "This Device" (Selected) and the paired PC, separator, Cancel.

Inline styles and transforms: `.BasicUI %{SectionList}`/`%{SectionItem}` animate `transform` (scale/rotateX, origin 12% 50%). Drag-and-drop reorder uses `%{Dragging}`/`%{DragOver}`/`%{HoverRing}`.

Unreachable (needs an active, queued or remote download):
- active hero `%{DownloadSectionActiveItem}`, `%{TopSectionInner}`, `%{DownloadGraph}`, `%{GameIconAndName}`, `%{DownloadGameIcon}`, `%{ProgressPercentageAndBar}`, `%{ActiveItemProgressBar}`, `%{DownloadsPage>ProgressBar}`, `%{PauseResumeButton}`, `%{Throttle}`/`%{ThrottleValue}`, `%{DownloadTimeRemaining}`, `%{Suspended}`
- queued rows with `%{DragHandle}`/`%{RemoveFromQueue}`/`%{DownloadsPage>PlayButton}` (focused PlayButton has a green `::after` shine)
- `%{IsViewingRemoteClient}`, `%{LocalNetworkTransferBar}`, `%{OfflineWrapper}`, `%{ParentalLocked}`

All are in the same module: anchor them as `%{DownloadsPage>…}`.

---

## 6. Media: routes `/media/grid`, `/media/item/:type/:id`, `/media/list`

### 6.1 Grid `/media/grid` (`social_media_grid.png`)

```
div %{OverflowHidden>GamepadPage} %{PadForHeader} %{PadForFooter} %{OverflowHidden}
  div %{ListItemAndGlowContainer>FullHeight} ClipManager > … > div %{TopList} (flow column; Y/X handlers live here)
    div %{ScreenshotList}               position:sticky, overflow-y auto (SCROLLER); inline --stickyHeaderHeight
      div %{ScreenshotListInner} role=grid      VIRTUALIZED: inline --listTotalHeight:4484px
        div %{ScreenshotListItemRow} role=row   position:absolute; INLINE height:228px; transform:translateY(Npx); --itemsPerRow:3; margins
          div %{ListItemAndGlowContainer}
            div %{ListItemAndGlowContainer>ListItem} role=button        2px solid transparent border; inline --listItemAspectRatio
              img %{ListItemThumbnailImg}   bg #000, inline aspect-ratio
              [div %{ListItemAndGlowContainer>CornerContent} > div %{ClipCorner} > div %{ClipCornerRow} > div %{ListItemAndGlowContainer>DurationText} %{DurationTextClip} "0:47" (+svg)]   clips only, #ffd55f 13/18
            img %{BackgroundImageGlow} [%{ListItemAndGlowContainer>Clip}]   abs; filter: saturate(3) brightness(2) blur(50px); op 0
```

States:
- `ListItem.gpfocus:not(:hover)`: border `#fff` (2px).
- `:hover`: `transform: scale(1.02)` and img `drop-shadow(black 0 0 8px)`.
- The focused or hovered item's glow: `.gpfocuswithin + %{BackgroundImageGlow}, :hover + …` → op 1, `transform: translateX(-10%) translateY(-95%) scale(1.05)` (Steam animates it; .4 s).
- `%{ListItemAndGlowContainer>Selected}` (multi-select): border `#fff`, brightness 1.1, shadow. Multi-select was not reachable.
- Footer: `X Select Game · Y Filter · ≡ Options · A Select · B Back`.

**Never style the rows' transform/height or the inner list height.** The grid is virtualized. The glow already uses an expensive blur filter, which matters for perf.

Sub-UIs:
- **Filters modal** (`social_media_filter_modal.png`, MEDIA-BUTTON 4, then CLOSE-MODAL). `.GenericConfirmDialog` in `%{*GamepadDialogContent>ModalPosition}`: bg `#0e141b`, border 2px `#23262e`. `DialogHeader` "Filters" `#fff` 22/28 700. `DialogSubHeader` "MEDIA TYPE:" `rgba(255,255,255,.5)` 16/22 600 uppercase. Radio group `%{Group} Shared_Radio_Group` bg `#2a2e36` r2. `%{Group>Button} RadioButton` `#2a2e36`, `#b8bcbf` 14/20. **`%{Group>Active}`: `radial-gradient(rgba(26,159,255,.733), #1a9fff)` `#fff`**. Options: All Media / Clips / Screenshots / Background Recordings. Footer button "Close" `rgba(255,255,255,.15)`. `%{FocusRing}` sits on the focused radio.
- **Select Game menu** (`social_media_selectgame_menu.png`, MEDIA-BUTTON 3, then CLOSE-MENU). Context menu with:
  - `%{TopList>SearchBar}` > `%{TopList>InputContainer}` > input `%{TopList>Input}` bg `#181a21` "Search games…"
  - `%{NoMatches}` (op 0)
  - rows `%{TopList>Option} %{…>contextMenuItem}` 52px > `%{FilterContextOption}` > `%{FilterContextOptionLabel}`. "All Games - Most Recent" (Selected, focused, white), then one row per game
  - separator, Cancel
- **Item Options** (`social_media_item_options.png`, MEDIA-BUTTON 14, then CLOSE-MENU): View, Share…, Show on disk, **Delete** (`%{…>Destructive}`), separator, Cancel.

### 6.2 Screenshot viewer `/media/item/screenshot/<id>` (`social_media_item_screenshot.png` controls hidden; `social_media_item_controls.png` after ITEM-SHOW-CONTROLS)

```
div %{OpenedItemContainer} OpenedItemContainer   abs, overflow hidden
  div %{ChangeItemHoverArea} %{ListItemAndGlowContainer>Left|Right}  [100x360 at each edge]
    div %{ChangeItem} %{…>Left|Right} %{…>Screenshot} [%{ListItemAndGlowContainer>Disabled}]   48px circle bg #23262e, shadow 0 0 20px rgba(0,0,0,.533), op 0, brightness(.8)
      div tool-tip-source > div %{ChangeItemLabel} > svg [%{NextItemSVG}]
  div %{FocusedScreenshotContainer}
    div %{FocusedScreenshotImageContainer}  bg rgba(0,0,0,.6) + inset shadow 0 0 80px rgba(0,0,0,.733) > img %{FocusedScreenshot}
    div %{FloatingItemControls} [%{TopList>Visible}]   linear-gradient(rgba(0,0,0,.5) 0%, #202328 90.78%), backdrop-filter blur(5px), opacity transition .2s
      div %{ScreenshotForm} > div %{Metadata} "Taken: … - 123 KB" (#8b929a 12px)
        div %{ScreenshotFormRow} %{TopList>Stretch} %{JustifyEnd} %{TopList>Grow} > div %{ScreenshotFormActions}
          div %{ButtonBox} %{TopList>Interactable} %{Square} %{TopList>Secondary} %{TopList>IconButton} > svg %{IconButtonIcon}   (trash = DELETE, never)
          div %{ButtonBox} %{TopList>Interactable} %{TopList>Secondary} "Share"
```

States:
- `%{ButtonBox}`: bg `#3d4450` r2, `box-shadow 0 2px 4px rgba(0,0,0,.25)`, `#fff` 14px. `.gpfocus` or `:hover` (Secondary): bg `#fff`, `#0e141b`, shadow `0 4px 4px`. Primary hover/focus: `#00bbff`.
- `%{ChangeItemHoverArea}:hover %{ChangeItem}`: op 1. `%{ChangeItem}:hover`: `scale(1.04)` brightness 1.15 (Disabled stays .8).
- Footer: `Y Show|Hide · A Select · B Back`.

**Share sheet** (`social_media_share_sheet.png`, SHARE-SHEET, then CLOSE-MENU):
```
%{*BasicContextMenuModal>contextMenuContents} %{ShareSheet}
  div %{ContainerGamepad}  bg #23262e
    4x div %{ShareMenuButton} %{…>contextMenuItem} > svg + div %{ShareMenuLabel}   "Share on Steam…" | "Copy to Clipboard" | "Save Image…" | "Send to Phone…"
    div %{ChatLabel} "SHARE TO A CHAT"   12px 800 uppercase #b8bcbf
    div %{ChatRow} > div %{AllChats} %{…>contextMenuItem} > svg %{AllChatsIcon} + div %{ShareSheet>Name} "All chats" (mask fade right)   [+ one tile per recent chat]
  separator, Cancel
```

### 6.3 Clip viewer `/media/item/clip/<id>` (`social_media_item_clip.png` hidden; `social_media_item_clip_controls.png` with ITEM-SHOW-CONTROLS; the clip auto-plays)

```
div %{FocusedClip} > div %{PlayerAndTimeline}
  div %{VideoPlayerContainer}  bg rgba(0,0,0,.533), shadow 0 4px 24px rgba(0,0,0,.533) > div %{GameRecordingPlayer} %{PositionAbsolute} (bg #000, inset shadow) > video
  div %{GamepadTimelineContainer} [%{TimelineAndControls>Visible}]   same gradient + blur(5px) as FloatingItemControls; op 0 → 1
    div %{PlayerAndTimeline>TimelineAndControls} TimelineAndControls Large
      div %{*LoadingTimeline>ScrollAndControlsCtn} %{*LoadingTimeline>GamepadMode}
        img %{TriggerGlyph} %{*LoadingTimeline>PositionLeft|PositionRight}  (L2/R2, brightness .8)
        div %{LeftControlsAndContent} > div %{ContentAndGradient} %{*LoadingTimeline>TimelineScrollContainer} (horizontal SCROLLER) > div %{*LoadingTimeline>ContentContainer}
          layers, each %{*LoadingTimeline>AbsoluteLayer} > %{*LoadingTimeline>RelativeLayer}:
            RecordingDecorators > %{RecordingDecorator} %{LoadingTimeline>Clip}   gold linear-gradient(#8e7120, #c6a750 80%); INLINE width + translateX
            ClipDecorators, GameModes > %{GameModeMarker} %{Unspecified} %{GameModeMarkerClip} rgba(255,255,255,.4) op .3, INLINE translateX/width
            DateDecorator > %{TimelineRelativeDate} "Yesterday" rgba(255,255,255,.15) 16/18 700, INLINE translateX
            BackgroundTicks > %{TimelineBacking} rgba(255,255,255,.2) (INLINE width) ; %{TimeTick} > %{TickLine} %{Major} rgba(255,255,255,.3)  (188 ticks)
            %{MouseListenerContainer} > Highlights, RangeSelector, SeekScrubber > %{GhostPlayheadCtn} > %{TooltipHoverSource} > svg %{GhostPlayhead} ; PlayHead > %{*LoadingTimeline>PlayheadInteractionCtn} > … > %{*LoadingTimeline>PlayHead} svg ; Phases ; RangeHighlights
          div %{ScrollGradientCtn}
        div %{ScrollbarAndSiblings}
      div %{PlaybackControls}
        div %{LeftControls} > %{AddMarkerCtn} (never) ; %{PlaybackControls>PlaybackButton} %{…>Small} %{ViewRecordings}
        div %{PlaybackControlsCtn} > %{PlaybackControls>FlexRow} > FrameStep (disabled, rgba(255,255,255,.1)), %{JumpSecondsButton} x2, %{PlaybackControls>PlayButton}
        div %{PlaybackControls>RightControls} > div %{RightButtons} RightButtons > button %{PlaybackControls>CreateClipButton} %{MoreSpecific} "Clip" (never) ; button %{PlaybackControls>ShareButton} %{MoreSpecific} "Share"
      div %{PlayTimeRow} > div %{TimeBar} "0:00 / " + %{PlaybackControls>TimeDash} + %{TimeRecordingButton} > %{TimeTotal}
```

Paint and states:
- `%{PlaybackControls>PlaybackButton}`: transparent r2, icon `rgba(255,255,255,.7)`, transition colour, transform and opacity .08 s. **`.gpfocus`: bg `#fff`, icon `#0e141b`**. Disabled: `rgba(255,255,255,.1)`.
- CreateClip/Share: bg `#3d4450` r2 `#dfe3e6` 14/32. **`::before` = `box-shadow 0 8px 16px rgba(0,0,0,.3)`, op 0 → 1 on hover or focus (Steam's pseudo; don't reuse).**
- Footer: `X Delete Clip · Y Hide · ≡ Share · A Pause · B Back`. **Never press X.**
- The timeline layers are positioned with inline transforms and widths that Steam updates continuously: never touch them.

### 6.4 `/media/list` (`social_media_list.png`)

A non-interactive "phase list" grouped by date and game. Nothing takes focus; the only legend is `B Back`. The menu does not link it.

```
div %{PhaseListContainer} (bg #0e141b) > div %{PhaseList}
  div %{DateHeader} "1 day and 7 hours ago" ; div %{GameHeader} > %{PortraitImage>Container} … %{TimelineGrid>Icon} + game name
  rows: div %{PhaseGridItem} %{PhaseDetails}  bg rgba(61,68,80,.333) > %{PhaseTimestamp} > %{TimelineGrid>Date} + time
        div %{PhaseGridItem} %{PhaseMediaList}  bg rgba(61,68,80,.333) > %{MediaListItem} > img %{TimelineGrid>Thumbnail} (#67707b) + %{DurationMetric} > %{DurationBar} (#e4be52, inline width) + %{TimelineGrid>DurationText}
                                                                      | %{MediaListItem} > %{OverflowItem} "View All 3" (bg #0e141b)
```

Unreachable in media: multi-select (`%{ListItemAndGlowContainer>CheckboxContainer}`, `%{…>Check}`, `%{…>Selected}`); a filtered-results header (`%{FilteredResultInfo}`, `%{FilterButton}`, `%{PhaseFilterTag}`; applying a filter was avoided); background recordings (`%{BackgroundRecordingListItem}`); the upload or share dialogs (`%{ScreenshotShareDialog}`, `%{UploadProgressIndicatorContainer}`); empty states (`NoContentAvailable`, `AllContentFilteredOut`); loading skeletons (`%{ScreenshotListItemSkeleton}`); the error tile (`%{ListItemErrorScreenshot}`).

---

## 7. Store chrome: routes `/steamweb` and `/externalweb` (`social_store.png`, `social_externalweb.png`)

The web page itself is a separate browser view composited into `%{MainBrowserContainer>Browser}` (it captures as white). Only Steam's chrome is in scope.

```
div %{BasicHome} %{PopupBody>TransparentBackground}            (no page background)
  div %{Profile>Header} GamepadMode %{HeaderOpaque} FlexGrowWebBrowserURLBar   bg #000 (HeaderOpaque) + the usual ::before blur
    div %{HeaderBrowser} > div %{MainBrowserContainer>URLBar}       ::after = 1px #23262e at the right edge
      div %{MainBrowserContainer>StatusIcon} %{MainBrowserContainer>NavigationButton} role=button   back   (32x32, icon #67707b)
      div … %{NavigationButton} %{MainBrowserContainer>Disabled}                                     forward (icon #3d4450)
      div … %{NavigationButton} role=button                                                          reload
      div %{MainBrowserContainer>StatusIcon}                                                         lock / security (icon #67707b)
      div %{MainBrowserContainer>URL} "https://store.steampowered.com/"  #67707b 16/24, no background
  div %{PopupBody>Content} > … > div %{MainBrowserContainer} | %{ExternalBrowserContainer}  %{MainBrowserContainer>Visible} %{MainBrowserContainer>MainBrowser} %{AllowUnderlay}
        div %{BrowserContainer} > div %{BrowserContainer} (.gpfocus while the page has input) > div %{MainBrowserContainer>Browser}
div %{BasicFooter} %{PopupBody>Opaque} %{Relative}    bg #000 (no blur) on /steamweb; /externalweb keeps the translucent blurred footer
```

States (from the CSS):
- `NavigationButton.gpfocus` or `:hover`: bg `#23262e` r2, icon `#fff`.
- `%{MainBrowserContainer>Toggled}`: `#1a9fff` (hover `#00bbff`).
- Disabled: `#3d4450`.
- `%{URLInput}` (editable URL): transparent; `.gpfocus` → bg `#fff`.
- Footer: `Y Add to Cart · ≡ Store menu · A Select · B Back`. The "Store menu" (Start) is drawn by the store web page inside the browser view, so it is not Steam DOM (Start produced no menu in `main`). **Never press Y.**
- Account "View Profile" and friend "View Profile" open `/steamweb` with a community URL, under the same chrome.

---

## 8. Power menu (`social_power_menu.png`)

Opened with POWER-MENU and closed with CLOSE-MENU. Opening a context menu from SharedJSContext rendered it in `main` over the current route (home here).

```
%{*BasicContextMenuModal>BasicContextMenuHeader} "Power"
%{*BasicContextMenuModal>BasicContextMenuContainer} > %{…>contextMenuContents} role=menu
  Sleep | Shutdown (Destructive) | Restart Device (Destructive) | Restart Steam VR (Destructive)
  separator
  Change Account (Destructive) | Sign Out (Destructive) | Restart Steam (Destructive)
  separator
  Cancel
```

The menu is built from `79100 Ve`. On the Frame it shows, in order:
- `can_sleep` → Sleep
- `can_shutdown` → Shutdown
- `can_restart_system` → "Restart Device" (`ON_FRAME`)
- `can_exitvr` → "Restart SteamVR"
- logged in → Change User and Sign Out
- Restart Steam

Items:
- Rows: `#23262e` / `#b8bcbf`.
- **Destructive rows turn `#de3618` with `#fff` when focused, `#8a220f` on hover.** Non-destructive focused rows turn white.
- Selecting Shutdown, Restart Device, Restart Steam VR or Restart Steam opens a confirmation dialog (`T.g2`, via `Le`/`ct`). Change Account and Sign Out go straight to their own flows (`S.u`/`F.j`). This mapping never selected any item.

The bar's frame-menu "Power" item (`bar.md`) calls `SteamUIStore.OpenPowerMenu(event)` with the frame-menu element, so in real use the menu may anchor to that window's manager. Same component and paint.

Not reachable: the power-chord variant (`isPowerChord`: "Guide button shortcuts", "Turn off controller"), streaming-session items, the `FadeToBlackDialog`/`SuspendDialog`, and `DelayedActionDialog` (all need power actions).

---

## 9. Other routes

1. **`/about`** (`social_about.png`): `%{OverflowHidden>GamepadPage} … %{ScrollY}` (content 2022px tall, SCROLLER). Sections are `DialogControlsSection DialogLabelledControlsSection DialogSettingsSection` with a `SettingsDialogSubHeader` each: About, SteamVR, Steam, Hardware, Recovery, Wi-Fi. Rows are the settings `%{*GamepadDialogContent>Field}` primitive with `%{…>LabelFieldValue}` values. Buttons: Hostname (`%{SettingsDialogSubHeader>SettingsDialogButton}`), Third-Party Licenses, **Factory Reset**. Two Wi-Fi toggles. Paint is identical to settings Field rows (§4).
2. **`/accessibility`** (`social_accessibility.png`): `%{AccessibilityPage}` + `DialogBody %{SettingsDialogBodyFade}` with 4 Field rows: High Contrast Mode, Reduce Motion, Color Filter, Mono Audio (toggles or dropdown; never change).
3. **`/console`** (`social_console.png`): `%{Console}` bg `#151f25` > `%{ConsoleInner}` (log) + form `%{ConsoleInput}` > `DialogInput_Wrapper` > input `%{Console>InputBox}` (`.gpfocus` white).
4. **`/colorsettings`** (`social_colorsettings.png`):
   - `%{Floating>PageContainer}` bg `#0e141b`, with `%{PageContainer>PreviewImage}` (bg image, 1280x549) above.
   - `%{FloatingControls}` bg `#0e141b`, holding `%{PageContainer>Section}` cards (focused card bg `rgba(255,255,255,.15)`).
   - Each card has a Field with the shared slider `%{*SliderControlAndNotches>SliderControlPanelGroup}` (Color Vibrance, Color Temperature 6500K, …).
   - Focus lands on a slider: never press left/right. `TrueBlackBackground`.
5. **`/zoo`** (`social_zoo.png`): a `PagedSettingsDialog` with 22 dev tabs: Field Layouts, Dropdowns, Modals, Buttons, Sliders, Toggles, ClientSettings, Other Controls, Glyphs, SVGs, Typography, Focusable Input, Developer Options, VR Developer Options, App Spotlight, Play Next, Notifications, Sound Tester, Web Links, Interstitials, Three.js Tests, GraphEditor. Useful as a primitive gallery; shell owns `/zoo/modals`.
6. **`/decksetup`** (`social_decksetup.png`): `%{SetupHelp}` (bg `#0e141b`, focusable whole panel) > `%{SetupHelp>Content}` > `%{SetupHelp>Heading}` "Having trouble?", `%{SetupHelp>SubHeading}`, link, `%{QRBits} %{SetupHelp>QRCode}` > img `%{QRImg}`.
7. **`/workshop`** (`social_workshop.png`): one `a %{DeveloperPlaceholderButton}` (white, r3) "WORKSHOP" (a dev placeholder).
8. **`/notes/app/:appid/`** (`social_notes.png`, appid 2379780):
   - `%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog} %{NotesPagedSettings} %{ResponsivePageList}` (bg `#0e141b`).
   - Left column `PageListColumn` bg `#2b2d33`: tabs `PagedSettingsDialog_PageListItem` (Active = gradient) "Untitled Note", and `%{Page>NewNoteButton}` at the bottom.
   - Content column `#1a1c21` > `%{NotePage}` > `%{NoteEditorArea}` > `%{EditorInput} %{ToolbarRowOverflowContainer>Container}` (bg `#111`) > `ProseMirror` > `p pm_paragraph %{Paragraph}`.
9. **`/error`** (`social_error.png`): renders nothing without router state (header + "B Back" only).
10. **`/apprunning`** (`social_apprunning.png`): empty and transparent (no running game). `/keyboard` only has an empty `%{OverlayPosition}`. `/gameapiosk` and `/app/:id/overlay/*` bounce away without a running game.

---

## 10. Where "notifications", "profile" and "achievements" live

- **Notifications**: no main route. The list is the QAM Notifications tab in `barpopup` (`%{*PanelSection>QuickAccessNotifications}`, mapped in `bar.md`). Toasts are the `notifications` surface (hud). The bar bell appears only with unread items.
- **Profile**: `/account` (§4) is the gamepad "profile" page. Full profiles are community pages in `/steamweb` (§7). Friend profiles open from the friend Options menu.
- **Achievements**: `/library/app/:appid/achievements/...` uses app-details chrome and is mapped by appdetails (`appdetails_achievements_my.png`, `appdetails_achievements_global.png`). The friend-comparison variant `/achievements/friend/:accountid/...` uses the same component.

---

## 11. Could not reach (and why)

| What | Why |
|---|---|
| Chat message bubbles, voice-chat UI, group chats, pending friend invites, favourites content, recent chats, "is typing", radial quick-message menu | needs messages, calls or invites (side effects), or private history scrolling |
| Friend Options submenus Trading › and Manage › | contain Remove/Block. Not opened |
| Downloads: active, queued, paused or remote-client views | needs a download or switching the managed device |
| Media: multi-select, filtered results, background recordings, upload/share dialogs, empty or skeleton states | needs selections, filter changes, uploads or no media |
| Power-menu confirmations, suspend/fade dialogs, power-chord variant | power actions |
| `/apprunning`, `/app/:id/overlay/*`, `/gameapiosk`, in-game overlay chrome | no Steam game running; launching is forbidden |
| `/microtxnauth`, `/browser/` | purchase flow, or needs router state |
| `/login`, `/createaccount`, `/oobe/*` | sign-in/OOBE flows on a signed-in device (OOBE completion restarts Steam or the PC) |
| Store page content and the "Store menu" | separate browser view (web content), out of scope |

---

## 12. Notes for the CSS author (this area)

1. **Literal classes**: the friends UI needs `.friendlist.GamepadMode …`, `.friend`, `.groupName`, `.FriendsListTab`, `.multiChatDialog`, `.chatEntry`, etc. Scope them under `%{FriendsChats}` (or `.friendsui-container`) so the QAM friends copies are not hit. The same CSS also has `#QuickAccess-Menu …` overrides.
2. **Focus fills are `@keyframes … forwards`** (§1). To restyle focus on friend rows, group headers, download items or chat side buttons, use `!important` on background and colour, or set `animation-name` to your own keyframes in a `*.nowrap.css` file.
3. **Opaque surfaces to replace for glass**:
   - `/chat`: `%{TrueBlackBackground}` `#000`, `.friendlist`/`.multiChatDialog` radial gradients, `.FriendsListSteamDeckTopSection` `#23262e`
   - `/invites`: `%{DialogContent_InnerWidth>InvitesList}` `#0e141b`
   - downloads `%{DownloadsPage>Section}` `#0e141b`
   - `/media/list` `%{PhaseListContainer}`
   - store `%{HeaderOpaque}` and `%{PopupBody>Opaque}` footer `#000`
   - console `#151f25`
   - Filters modal `.GenericConfirmDialog` `#0e141b`
   - every context menu row `#23262e`
4. **Already blurred by Steam** (count them for perf): header `::before` and footer (blur 100px), `%{FloatingItemControls}` and `%{GamepadTimelineContainer}` (blur 5px), modal backdrop, `%{BackgroundImageGlow}` (filter blur 50px, focused item only).
5. **Never touch** (Steam positions or animates them):
   - media rows' inline `transform`/`height` and `--listTotalHeight`
   - timeline layers' inline `translateX`/`width`
   - `%{FocusRing}` inline geometry
   - friends tab panels' transform and opacity
   - `.friend`/`.groupName`/`%{SectionItem}`/`%{SectionList}` transforms
   - `%{CurrentUserProfileBackground>LabelHolder}` `scale(1.4)`
   - `%{FriendsChatsContainer}` inline `display`
   - context-menu container transforms
   - ToggleRail `::before` translate
6. **Steam's own pseudo-elements in this area** (don't add your own on these):
   - `%{Profile>Header}::before`
   - `%{BackContainer}::after`
   - `%{ChatTab}::before`
   - `%{MainBrowserContainer>URLBar}::after`
   - `%{*GamepadDialogContent>ToggleRail}::before`
   - `%{PlaybackControls>CreateClipButton}::before` and `%{PlaybackControls>ShareButton}::before`
   - `%{LibraryItemBox}::before/::after` (download capsule)
   - focused `%{DownloadsPage>PlayButton}::after`

   Every other element mapped here has neither.
