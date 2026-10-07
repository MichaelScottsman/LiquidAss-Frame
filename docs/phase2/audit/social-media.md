# UX audit: friends, chat, profile, notifications, media, downloads, store chrome, achievements, keyboard (`audit:social-media`)

Scope: every surface where the user reads or writes to other people, looks at their own captures, or types:

- **Friends & Chat** (`/chat`): friend list, tabs, group headers, the friend menu, the conversation pane, the compose field;
- **Add a Friend** (`/invites`);
- **Account**, the gamepad "profile" page (`/account`), plus the community profile web pages;
- **Notifications**: there is no notifications page. Notifications are the Quick Access (QAM) Notifications tab and the toasts;
- **Media** (`/media/grid`, the screenshot viewer, the clip player, the share sheet, `/media/list`);
- **Downloads** (`/library/downloads`);
- **Store chrome** (`/steamweb`, `/externalweb`): Steam's browser header and footer around the store and community web pages;
- **Achievements routes**: only the parts that touch this area. The achievements page itself is audited in `game-pages.md` §A.10 and §C.9;
- **The VR keyboard and text input**: Steam's keyboard (`keyboard` surface), SteamVR's own keyboard (`vr:keyboard`), and every text field in this area.

Audited live on 2026-10-07 (Steam build `11041156`), with the theme off and on.

**Inputs:**
- the Phase 1 inventories `docs/inventory/social.md` and `hud.md`, plus `steamvr.md` §4 and `bar.md` §QAM;
- the research files `docs/phase2/research/visionos.md`, `references.md` and `liquid-glass-motion.md`;
- the 12 visionOS references in `docs/refs/visionos/` (ref 4, Messages, matters most here);
- the sibling audits `shell-nav.md`, `library-apps.md` and `game-pages.md`;
- Apple's Vision Pro user guide and the HIG page *Virtual keyboards*, for the keyboard (sources at the end).

`docs/phase2/capabilities/` was still empty when this was written. §C.0 therefore lists the open capability questions (SQ1–SQ14) that each proposal depends on.

**Evidence tags:**
- **[measured]**: read live on the Frame for this audit (DOM rects, computed styles, `ovprobe` overlay geometry, `glass.py perf`).
- **[source]**: read from Steam's webpack code on the device.
- **[inventory]**: taken from the Phase 1 inventories.
- **[inferred]**: my reading, still to be verified.

**Privacy.** The shots contain the user's persona name, account name and friend code, and friends' names and avatars. This document never repeats any of them.

---

## Top findings (read this if nothing else)

1. **This is the most Steam Deck-like part of the UI, and the smallest.**
   - The worst targets in the area:
     - the Friends tab icons: 24×30 px, **0.74°**, 30 % of the visionOS 2.45° minimum;
     - the Do Not Disturb toggle: 38×22 px, **0.68°**;
     - Add Friend: 26 px, 0.80°;
     - the clip-player transport buttons: 28 px, 0.86°;
     - the store back/forward/reload buttons: 32 px, 0.98°.
   - Text runs at 10–15 px (0.31–0.46°), which is 44–65 % of visionOS body text. The smallest is the chat date divider: 10 px bold uppercase.
2. **For the laser, ten groups of functions in this area exist only as text in the footer legend.** The friend menu (View Profile, Trading, Manage › Remove/Block), View Game in Library, the media Filter, Select Game and item Options, Delete Clip, the Downloads Options menu (including Uninstall), Change Device, the store menu and Add to Cart all fall in this group. Nothing on screen looks like a button for any of them (§A.10).
3. **Typing has no echo.**
   - Steam opens its VR keyboard with flags `13` = Minimal | ShowArrowKeys | HideDoneKey [measured]. In Minimal mode each key goes straight into the field, so the keyboard shows no preview of the text.
   - `ovprobe` placed the keyboard [measured]:
     - 0.74 × 0.24 m, about 1.19 m away;
     - its centre about **22° below** the window centre, tilted back 50°, about **34° wide**.
   - The text being typed is therefore **≈ 32° of gaze** away from the keys for the header search field, ≈ 28° for the friend-code field and ≈ 13° for the chat compose field.
   - visionOS shows the typed text in a preview at the top of the keyboard [official].
4. **Friends & Chat already has the structure of visionOS Messages (a split view), at Deck scale.**
   - The sidebar is 300 px wide (23 % of the window).
   - Friend rows are 42 px tall with 32 px square avatars and a 3 px status bar.
   - The voice and invite buttons are 46×53 px squares glued to the right edge.
   - The selected conversation is not highlighted once focus leaves the list.
   - The compose field is 44 px tall, and focusing it changes nothing visible.
   - This calls for a re-layout and re-skin, not a rebuild.
5. **Media tiles are already big; the controls around them are not.**
   - Grid tiles are 405×228 px (12.4° × 7.0°).
   - Filter, Select Game and Options exist only as legend text.
   - The viewer's buttons are 36 px tall (1.1°).
   - Previous/next appear only while the laser hovers the window edges (or by LB/RB).
   - There is no time structure: dates exist only in `/media/list`, which nothing links to.
   - visionOS Photos supplies the pattern: a grid by date, a bottom segmented ornament, and an immersive viewer with an ornament.
6. **Three pages are mostly empty.**
   - Downloads spends a 240 px band (a third of the window) on an empty "active download" hero when nothing is downloading.
   - Add a Friend leaves about 85 % of the window empty around one 40 px field.
   - On Account, the only targets above the visionOS minimum are three 394×124 px tiles, and all three leave the app for web pages.
7. **Destructive actions sit within one press:**
   - **Delete Clip** on X, next to Hide;
   - the trash button next to Share;
   - **Uninstall** first and focused in the Downloads Options menu;
   - **Sign Out** beside Change Account;
   - Remove/Block one level down in the friend menu.
   - None of them looks different at rest.
8. **Store and profile pages are web pages in a separate browser view.**
   - They are a separate CDP target (`store.steampowered.com…`), framed by opaque black chrome with 32 px buttons and a grey 16 px URL string.
   - The theme reaches only the chrome.
9. **Notifications have no home in the main window.**
   - The QAM tab is a 300 px column, empty today.
   - Toasts are 300×40 cards with 11–12 px text (0.37–0.41°).
   - SteamVR has a second, differently styled toast of its own.
10. **Performance budget.**
    - The media grid scrolls at 73.1 fps with 5–7 long frames per 3 s, both stock and themed [measured]. The long frames come from thumbnail decoding.
    - Steam already draws a 50 px blur glow behind the focused tile.
    - A redesign here must add no long frames. Replacing the glow saves GPU time.

---

## 0. Evidence and units

### 0.1 Shots taken for this audit (`shots/`, 1.5x, transparent = room)

| file | what it shows |
|---|---|
| `p2_social_chat_off.png` / `_on` | `/chat`, FRIEND-FOCUS: a friend focused, its conversation open, footer legend |
| `p2_social_invites_off.png` | `/invites`, default focus on the friend-code field |
| `p2_social_account_off.png` | `/account` |
| `p2_social_downloads_off.png` | `/library/downloads`: an empty Up Next section, one Scheduled item, the empty 240 px hero |
| `p2_social_media_grid_off.png` | `/media/grid` |
| `p2_social_media_item_off.png` | screenshot viewer with controls visible |
| `p2_social_media_clip_off.png` | clip player with timeline and controls |
| `p2_social_achievements_off.png` | `/library/app/620980/achievements/my/individual` |

**Phase 1 shots reused (`_after` = themed):**
- friends: `social_chat_*` (tabs, group headers, entry focus, friend options);
- other routes: `social_invites_after`, `social_account_after`, `social_downloads_after`, `social_media_*` (grid, filter modal, select-game menu, item options, share sheet, viewer, clip controls), `social_store.png`;
- hud: `hud_keyboard_hover_before/after`, `hud_keyboard_buffered_after`, `hud_keyboard_padfocus_after`, `hud_toast_before`, `hud_toast_variants_after`;
- the QAM: `p2_sys_qam_notifications_on`.

### 0.2 Units

| surface | metres per CSS px | degrees per CSS px | 2.45° (visionOS 60 pt) = | visionOS body text 0.71° = |
|---|---|---|---|---|
| main window | 0.768 mm (0.984 m / 1280 px [measured]) | **0.0307°** at 1.44 m | **80 px** | 23 px |
| Steam keyboard (`keyboard`) | 0.864 mm (0.738 m / 854 px [measured]) | **0.0416°** across, **0.0366°** vertically (key plane tilted back 50°, seen 28° off its normal) | 59 px wide, 67 px tall | 17 px across, 19 px tall |
| toasts, QAM (`notifications`, `barpopup`) | 0.847 mm (`shell-nav.md` §0.2) | 0.034° | 72 px | 21 px |

### 0.3 Live data read for this audit

1. **DOM sizes** for every control below come from `getBoundingClientRect` and `getComputedStyle`, read in a `--pre` script during each `shot` [measured]. Sizes are the stock theme (theme off). Phase 1 changes paint, not sizes.
2. **Keyboard geometry** comes from `native/spike/ovprobe` (read-only), run while the keyboard was shown with the safe trigger in `hud.md` §5.2 (auto-hidden after 12 s) [measured]:
   ```
   main:      (0,0) (-0.456 0.844 -1.359)  (W,H) ( 0.528 1.397 -1.335)  centre ( 0.036 1.121 -1.347)
   keyboard:  (0,0) (-0.344 0.593 -0.932)  (W,0) ( 0.394 0.593 -0.914)
              (0,H) (-0.340 0.748 -1.117)  (W,H) ( 0.398 0.748 -1.099)  centre ( 0.027 0.671 -1.016)
   bar:       centre ( 0.033 0.766 -1.212)
   ```
   - The keyboard's bottom edge is 0.19 m nearer than its top edge, so it leans back 50° from vertical like a lectern.
   - **Eye assumption:** angles are computed from a point on the window's centre normal, 1.44 m from the window. That point is where the window subtends the 37.8° used everywhere in Phase 2.
   - The head pose was not read (the headset was not worn). One `native/spike/hvgrab` capture with the keyboard up would confirm the numbers.
   - The keyboard then spans about **−17° to −27°** below the window centre, and the bar centre sits at −15°. **The keyboard sits directly under the dashboard bar in the view, its top edge about 10 cm nearer than the bar.**
3. **Keyboard state while open** [measured]: `m_eVRKeyboardFlags = 13`. The OpenVR `EKeyboardFlags` bits are:
   - Minimal = 1: send key events immediately, no buffer;
   - ShowArrowKeys = 4;
   - HideDoneKey = 8.

   That is why Steam's own fields never show the buffered preview row that apps get (`hud.md` §5.1).
4. **The keyboard does not open when a field merely receives focus.** On `/invites` the friend-code field takes gamepad focus on arrival, and `m_bIsOpen` stayed `false` [measured]. It opens on activation (A or a click).
5. **Keyboard keys** [measured]:
   - 58 keys in 5 rows;
   - a letter key's hit area is 60×47 px with a visible 57×44 px key and a 16 px label;
   - the extra keys are `SwitchKeys_Steam` (emoji / Steam Chat Items), `ArrowLeft`, `ArrowRight` and `VKClose`;
   - no controller-shortcut glyphs render on keys with no controller active.
6. **Media viewer bindings** [source, module 64086]:
   - previous/next item: **LB/RB**, or a click on the edge arrows;
   - the arrows sit in 100×360 px hover zones and are opacity 0 until hovered.
7. **Performance** [measured]: `glass.py perf main --route /media/grid`:
   - off: 73.1 fps, median 11.1 ms, p95 22.6 ms, 7 long frames;
   - on: 73.1 fps, median 11.1 ms, p95 22.5 ms, 5 long frames.
8. **Store page** [measured]: the store's web content is its own CDP target ("Great on Frame", `https://store.steampowered.com/greatonframe/`). It is not part of `main`'s DOM.

### 0.4 What could not be exercised

- **No side-effect-free path exists for these, so they are mapped from the inventories and source only:**
  - chat message bubbles, voice-call UI, group chats and pending invites;
  - recent chats, favourites content, "is typing" and the quick-message radial (`social.md` §11);
  - an active, queued or remote download.
- **Media:** multi-select and applied filters.
- **Notification rows:** the QAM list is empty, and real toasts are forbidden (only developer test notifications exist).
- **Profile pages:** the community profile web page itself.
- **Keyboard:** typing, pressed keys, Shift/Caps, the long-press accent row and the emoji layout. They need key presses; Phase 1 covers their looks from CSS.
- **Laser behaviour of some rows:**
  - what a laser click on a friend row does: it opens the chat, and probably focuses the compose field like A does [inferred];
  - whether a click on the Downloads device row or on a toast does anything.

  Laser clicks on live rows were avoided.

---

## A. Function list

"Laser" means the controller laser, which sets `:hover` and Steam's laser focus. "Gamepad" means Steam's FocusNavController (`.gpfocus`), or SteamVR's own focus where noted. A dash (—) means there is no path today.

**Every row must stay reachable both ways after the redesign.** Footer-legend clicks count as a laser path, but a weak one (§A.10).

### A.1 Friends & Chat (`/chat`)

Reached from the main menu item "Friends & Chat" (in VR this is the `/chat` route, not the QAM friends tab [inventory]).

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| F1 | Switch tab: Favorites / Friends / Groups / Recent Chats | click a 24×30 px icon | **L1 / R1** (bumper glyphs drawn beside the icons), or Up to the tab row + Left/Right + A | icon-only; the sidebar title changes to the tab name |
| F2 | Add a Friend (→ `/invites`) | click the 26×26 px person-plus button | focus + A | also from Account (P7) |
| F3 | Open pending invites (waving-arm button with a red count) | click | focus + A | only with pending invites; not seen live |
| F4 | Create Group Chat | Groups tab: header button, or the empty-state button | focus + A | never activated |
| F5 | Collapse / expand a group | click the group header (300×30 px) | A ("Collapse") | **persisted**; one stray click hides a whole group |
| F6 | View Game in Library (in-game group header) | footer legend "View Game in Library" | **Y** | legend-only for the laser |
| F7 | Sort Offline by recent | hover the Offline header reveals `SortByRecent` | focus reveals it | opacity 0 until revealed [inventory] |
| F8 | Select a friend (preview the conversation) | click the row (42 px) | D-pad onto the row: **focus alone opens the chat on the right** | nothing marks the open conversation once focus moves on |
| F9 | Write to the friend | click the compose field | A on the friend ("Send Message"), or Right into the compose field | |
| F10 | Friend menu: Send Message, Start Voice Chat, View Profile, Find Games to Play Together, Trading ›, Manage › (Remove / Block), Cancel | **footer legend "Options"** | **≡** | legend-only for the laser; context-menu rows 48 px |
| F11 | Quick message (radial menu) | — | **hold** the button shown in the hint "Hold [glyph] to send a quick message" | gamepad only; the laser types instead |
| F12 | Type and send | VR keyboard (K1–K9); send arrow (44 px) or Enter | keyboard + A; Enter | |
| F13 | Start a voice chat | 46×53 px side button (online friends only) | Right from the history onto it + A; or **Y** in the compose field | a call; never pressed |
| F14 | Invite another friend to this chat | 46×53 px side button | focus + A | |
| F15 | Read history, load older messages | scroll (laser scroll input) | focus the history (`role=button`) + D-pad | infinite upward load |
| F16 | Conversation header (`ChatTab`, 980×100 px, `role=button`) | click | focus + A | effect not verified |
| F17 | Voice-call controls (mute, leave), group chats (channels, members), Recent Chats rows, Favorites content | — | — | not reachable without side effects; must keep working |
| F18 | Leave | Back (header) or a main-menu item | B | |

### A.2 Add a Friend (`/invites`)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| I1 | Enter a friend code | click the 376×40 px field → keyboard | **default focus on arrival** + A → keyboard | digits only, but the full QWERTY keyboard opens |
| I2 | Send the invite | "OK" 71×40 px | Right + A | |
| I3 | Read your own friend code | text (28 px digits, 16 px uppercase caption) | — | not focusable; there is no copy action |
| I4 | Accept / ignore incoming invites, cancel outgoing ones, see mutual friends | rows | rows | not reachable now (no invites) |

### A.3 Account and profile (`/account`; the bar avatar opens it)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| P1 | View your community profile (→ `/steamweb`) | "View Profile" 250×40 px | focus + A | the profile is a web page (S8) |
| P2 | Status: Online / Away / Invisible / Signed out | dropdown 259×56 px → menu | focus + A, Up/Down, A | |
| P3 | Do Not Disturb | toggle **38×22 px** | focus the row + A | |
| P4–P6 | Add Funds / Privacy Settings / Account Details (web pages) | 394×124 px tiles | Left/Right in the tile row + A | the only large targets on the page |
| P7 | Friend code; Add Friends (→ `/invites`) | "Add Friends" 250×40 px | focus + A | |
| P8 | **Sign Out** | 250×40 px, beside Change Account | focus + A | destructive, looks like any other button |
| P9 | Change Account | 250×40 px | focus + A | |

### A.4 Notifications

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| N1 | See a toast (friend online, playing, achievement, clip saved, low battery, incoming call…) | passive; hover fill on the card | — | `notifications` overlay 340×80 popup px; card 300×40; placed by SteamVR |
| N2 | Act on a toast (open the chat, accept a call…) | click (behaviour not verified) | — | no safe trigger |
| N3 | See that unread notifications exist | the bar's bell (only while unread) | bar focus (View) + Left/Right | |
| N4 | Read the notification list | QAM › Notifications tab (`barpopup`, 300 px wide) | QAM + tab row | empty now ("No new notifications"); rows have 1 px dividers [inventory] |
| N5 | Open what a notification refers to | click a row | focus + A | not seen live [inferred] |
| N6 | SteamVR's own toasts (`notificationtoast.html`) | passive | — | a different card: blue gradient, 100 px image (`steamvr.md` §5.2) |

### A.5 Media (`/media/grid`, `/media/item/:type/:id`, `/media/list`)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| M1 | Browse captures | scroll the grid (3 per row, 405×228 px tiles) | D-pad (virtualized grid) | |
| M2 | Open an item | click a tile | A | |
| M3 | **Filter**: All Media / Clips / Screenshots / Background Recordings | **footer legend "Filter"** → modal | **Y** → modal | legend-only for the laser |
| M4 | **Select Game** (with "Search games…") | **footer legend "Select Game"** → menu | **X** → menu | legend-only for the laser |
| M5 | Item **Options**: View, Share…, Show on disk, **Delete** | **footer legend "Options"** | **≡** | legend-only for the laser |
| M6 | Multi-select | — | — | not reachable |
| M7 | Viewer: show or hide its controls | legend "Show/Hide" | **Y** | |
| M8 | Viewer: previous / next item | hover the window edge → 48 px arrow → click | **LB / RB** [source] | invisible until hovered |
| M9 | Viewer: Share → share sheet (Share on Steam…, Copy to Clipboard, Save Image…, Send to Phone…, Share to a chat: All chats + recent chats, Cancel) | "Share" 76×36 px | D-pad + A | |
| M10 | Viewer: **Delete** | trash 48×36 px, next to Share | D-pad + A | Share is the focused default; the trash is one Left away |
| M11 | Clip: play / pause | 40 px button | **A** | |
| M12 | Clip: jump ±10 s, frame step | 32 px / 28 px buttons | D-pad + A | |
| M13 | Clip: scrub the timeline | drag (1142×68 px band) | **LT / RT** (glyphs at both ends) | |
| M14 | Clip: markers, view recordings | 28 px buttons | D-pad + A | "add marker" creates data; never pressed |
| M15 | Clip: **Clip** (create a clip), **Share** | 92×32 / 102×32 px | D-pad + A; ≡ = Share | create = side effect |
| M16 | Clip: **Delete Clip** | **footer legend only** | **X** | destructive, legend-only, next to Hide |
| M17 | Day/game overview (`/media/list`) | route only | route only | not linked from anywhere; non-interactive |

### A.6 Downloads (`/library/downloads`)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| D1 | See the active download (art, progress, speed, Pause/Resume, throttle) | 240 px hero | focus + A | empty now: the band is blank |
| D2 | **Change Device** (manage another PC's downloads) | legend "Change Device"; the 264×29 px "Managing downloads for" row is focusable, but whether it takes a click is not verified | **Y**, or focus the row + A | a listbox: This Device / paired PC |
| D3 | Up Next queue: reorder, remove, play | drag; 36 px row buttons | D-pad + A | not reachable now |
| D4 | Scheduled: **Download Now** | 36 px blue circle | **A** on the row | |
| D5 | Completed: Go To Game Page; Clear All | row; "Clear All" button | A; focus + A | |
| D6 | Item **Options**: **Uninstall** (first and focused), Remove from List, View in Library, Add to Favorites, Add to ›, Manage ›, Developer ›, Properties… | **legend "Options"** | **≡** | legend-only for the laser |
| D7 | Read "Auto-updates enabled" and schedule times | text (12 px uppercase) | — | |

### A.7 Store chrome and web views (`/steamweb`, `/externalweb`)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| S1–S3 | Back / Forward / Reload | 32×32 px icons | focus + A; B = back | |
| S4 | Security (lock) | 32 px icon | — | status only |
| S5 | URL | grey 16 px text (an editable `URLInput` variant exists) | — | |
| S6 | **Store menu** | **legend "Store menu"** | **≡** | the menu is drawn by the web page itself |
| S7 | **Add to Cart** | **legend "Add to Cart"** | **Y** | purchase flow; never pressed |
| S8 | Use the page (store, community profile, friend profile, Add Funds, Privacy, Account Details) | click inside the web view | the page's own gamepad mode (A, D-pad) | separate CDP target; out of the theme's reach |

### A.8 Achievements routes (this area's share; the page itself is `game-pages.md` A.10 AP1–AP6)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| AC1 | My / Global achievements, search, leaderboards, rows | see `game-pages.md` AP1–AP5 | | tabs 155×34, search 220×40, rows 80 px [measured] |
| AC2 | Compare with a friend | route `/achievements/friend/:accountid` only | — | no entry point in this area |
| AC3 | Achievement unlocked toast | passive (N1) | — | "Achievement Unlocked" toast with a count badge |
| AC4 | In-game overlay achievements (`/app/:id/overlay/achievements`) | — | — | only exists while a game runs |

### A.9 VR keyboard and text input

**Steam's keyboard** (`keyboard` surface, 854×280 popup px) is used by every Steam field in this area.

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| K1 | Raise the keyboard | click a field | A on a focused field | not on focus arrival [measured]; frame control "Show Keyboard" (SteamVR chrome under the window) also toggles it |
| K2 | Type a character | point at the key (it turns white on hover) + click | D-pad over keys (virtual focus) + A | dual pointer discs exist (`--key-pointer-*`); which Frame input drives them is not verified |
| K3 | Shift (one-shot), Caps lock | key | key | `ToggleOneShot` / `ToggleOn` |
| K4 | Accents and extended characters | press and hold a key → accent row | hold A | `KeyboardExtendedRow` |
| K5 | Emoji / Steam Chat Items layout | `SwitchKeys_Steam` key | key | |
| K6 | Move the caret | ArrowLeft / ArrowRight keys | keys | ShowArrowKeys flag |
| K7 | Delete, Enter (send chat / run search / submit code), Tab | keys | keys | Enter is always labelled "Enter" |
| K8 | Close the keyboard | `VKClose` key | key, or B [inferred] | no Done key (HideDoneKey flag) |
| K9 | IME (CJK) candidate rows, dead keys | keys | keys | `Row_IME` |
| K10 | Buffered preview row (apps only) | — | — | rendered only without the Minimal flag |

**SteamVR's keyboard** (`vr:keyboard`) serves OpenVR apps and SteamVR's own fields. It has:
- a preview row and 4 suggestion chips;
- a Done key;
- no gamepad focus ("Use Laser Mouse to Interact") [inventory].

**Text fields in this area** [measured]:

| field | size (px) | angle (height) | focus visible today? | gaze to the keyboard centre |
|---|---|---|---|---|
| Header search (shell) | 1128×40 | 1.23° | stock: white field | ≈ 32° |
| Chat compose (`chatTextarea`) | 866×44 (+ 44 px send) | 1.35° | **no** (only the legend changes) | ≈ 13° |
| Friend code | 376×40 | 1.23° | stock: white field | ≈ 28° |
| Media "Search games…" (in the Select Game menu) | ≈ 279×37 | 1.14° | yes (menu) | ≈ 30° |
| Achievements search | 220×40 | 1.23° | stock: white field | ≈ 22° |
| Notes editor, console, URL | — | — | — | — |

### A.10 Laser paths that exist only as footer-legend text

The footer legend is 12 px bold uppercase, 35 px tall (1.07°). Nothing in it looks clickable (`shell-nav.md` B.3).

| route | legend item | what it opens |
|---|---|---|
| `/chat` (friend focused) | Options (≡) | the whole friend menu: profile, Find Games, Trading, Manage › Remove/Block |
| `/chat` (in-game group) | View Game in Library (Y) | the game page |
| `/media/grid` | Filter (Y), Select Game (X), Options (≡) | filter modal, game menu, item menu (incl. Delete) |
| clip player | Delete Clip (X) | deletion |
| `/library/downloads` | Change Device (Y), Options (≡) | device listbox, item menu (incl. Uninstall) |
| `/steamweb` | Store menu (≡), Add to Cart (Y) | the store's own menu, the cart |

---

## B. UX critique for VR

### B.1 Target sizes (main window 0.0307°/px; keyboard per §0.2)

| control | size (px) | angle (limiting side) | vs 2.45° |
|---|---|---|---|
| Friends tab icon | 24×30 | **0.74°** | 30 % |
| Add Friend | 26×26 | **0.80°** | 33 % |
| Group header (collapse) | 300×30 | 0.92° | 38 % |
| Friend row | 300×42 | 1.29° | 53 % |
| Voice / invite side buttons | 46×53 | 1.41° | 58 % |
| Compose field / send | 910×44 / 44×44 | 1.35° | 55 % |
| Friend menu rows | 48 tall | 1.47° | 60 % |
| Footer legend item | 106×35 | 1.07° | 44 % |
| Friend-code field / OK | 376×40 / 71×40 | 1.23° | 50 % |
| Account buttons (View Profile, Add Friends, Sign Out, Change Account) | 250×40 | 1.23° | 50 % |
| Status dropdown | 259×56 | 1.72° | 70 % |
| **Do Not Disturb toggle** | 38×22 | **0.68°** | 28 % |
| Account tiles | 394×124 | 3.81° | OK |
| Downloads device row | 264×29 | 0.89° | 36 % |
| Download item row / Download Now circle | 1256×83 / 36×36 | 2.55° / 1.11° | OK / 45 % |
| Media grid tile | 405×228 | 7.0° | OK |
| Viewer trash / Share | 48×36 / 76×36 | 1.11° | 45 % |
| Viewer previous / next arrow | 48 circle (hover-only) | 1.47° | 60 % |
| Clip transport small / jump / play | 28 / 32 / 40 | **0.86°** / 0.98° / 1.23° | 35 / 40 / 50 % |
| Clip "Clip" / "Share" | 92×32 / 102×32 | 0.98° | 40 % |
| Clip timeline band | 1142×68 | 2.09° | 85 % |
| Select Game menu: search / rows | ≈279×37 / 52 | 1.14° / 1.60° | 47 / 65 % |
| Achievements tabs / search / rows | 155×34 / 220×40 / 1240×80 | 1.04° / 1.23° / 2.46° | 42 / 50 % / OK |
| Store back / forward / reload | 32×32 | 0.98° | 40 % |
| Keyboard letter key (hit) | 60×47 (popup px) | 2.50° × **1.72°** | 70 % (height) |
| Keyboard Close / arrow keys | 73×47 | 3.0° × 1.72° | 70 % |
| Toast card | 300×40 (popup px) | 10.2° × 1.36° | 56 % (if it takes clicks) |

**Findings**

- **Size follows Deck habit, not importance.**
  - The two big targets are the media tiles and the Account tiles. The Account tiles leave the app.
  - The controls used constantly are 30–58 % of the minimum: switching friends tabs, picking a friend, sending, the compose field.
- **The smallest targets are toggles and icon buttons that sit next to each other:**
  - the friends tab icons sit 46 px apart (1.4°);
  - the clip transport buttons sit 4–8 px apart.
  - visionOS wants centres ≥ 60 pt (80 px) apart.
- **The keyboard is the best-sized control in the area:** 2.5° wide, 1.7° tall. Its weakness is not size (§B.3).

### B.2 Legibility (em angle; visionOS body ≈ 0.71°, minimum 0.49°)

| text | size | angle | vs body |
|---|---|---|---|
| Chat date divider ("WEDNESDAY, OCTOBER 7, 2026") | 10 px bold UC | **0.31°** | 44 % |
| Download details ("2.9 MB"), toast title | 11 px (UC in downloads) | 0.34–0.37° | 48–52 % |
| Presence ("Online", "Away", game), field descriptions, dropdown description, legends, metadata ("Taken: …"), achievement descriptions, "MANAGING DOWNLOADS FOR", "AUTO-UPDATES ENABLED", status times, "SELECT A FRIEND OR GROUP TO START" | 12 px (most UC) | 0.37° | 52 % |
| Clip duration on tiles | 13 px | 0.40° | 56 % |
| Group headers, invite description, quick-message hint, clip time | 14 px | 0.43° | 61 % |
| Friend names, Account field labels | 15 px | 0.46° | 65 % |
| Buttons, menus, compose text, store URL (grey `#67707b` on black) | 16 px | 0.49° | 69 % |
| Download name | 18 px | 0.55° | 78 % |
| Sidebar title "Friends", "Add a Friend" | 22 px | 0.68° | 95 % |
| Keyboard letter labels | 16 px popup | ≈ 0.59° | 83 % |
| Keyboard shifted labels | 14 px at 45 % opacity | ≈ 0.51°, dim | — |

**Findings**

- In **status text** (presence, times, sizes, auto-update state), the area mixes the two worst habits: 12 px *and* uppercase tracked. It is the information people scan most in a friends list or a download list.
- The chat's **date divider at 10 px** is the smallest text in the Frame UI audited so far.
- Persona names at 15 px are the primary content of the friends list. visionOS Messages uses bold names at headline size, about 24 px on the Frame.

### B.3 Typing ergonomics

1. **No echo.**
   - With the Minimal flag the keyboard sends each key straight to the field (§0.3). The only copy of the text is in the field, 13–32° away from the keys.
   - To check a word, the eye leaves the keys, crosses the dashboard bar (which sits between them in the view, §0.3), finds the caret, then comes back.
   - On visionOS "the text you're entering appears in the preview at the top of the keyboard" [official].
2. **No context.**
   - The keyboard does not say which field it types into (message to whom, search, friend code).
   - Enter is always "Enter", where the HIG asks for a context label such as "Send" or "Search" [official, HIG Virtual keyboards].
   - The friend-code field (digits only) gets the full QWERTY layout.
3. **Placement is good.**
   - Low (−17° to −27°), tilted back 50° and 0.33 m nearer than the window: this matches how visionOS places its keyboard, below and closer.
   - It is 34° wide. A laser sweep from Q to P is about 26°: wide for one wrist, fine for two hands.
4. **Hover is right, pressing is generic.**
   - Laser hover turns a key white at once (`%{Modal>Focused}`), which is visionOS's instant highlight.
   - A press turns the key blue with a shine (`Touched`). visionOS keys are raised over a platter and move down in z when pressed [press, UploadVR].
5. **Two keyboards.**
   - Apps get SteamVR's keyboard: a different layout, with a preview, suggestions and Done. Steam fields get Steam's keyboard: no preview, an emoji key, arrows.
   - The same user sees two text-entry designs in one session.
6. **Focus is invisible in the compose field.** Stock Steam paints nothing when `chatTextarea` takes focus; only the footer legend changes [inventory].

### B.4 Is each context the right experience? (verdicts)

| context | verdict | why |
|---|---|---|
| Friends list | **Right structure, wrong scale and idiom.** Re-layout and re-skin | It is a sidebar + detail split, like Messages. But: 23 % width, 42 px rows, icon-only 24 px tabs with bumper glyphs, square avatars, colour-coded names, presence where Messages shows the last message |
| Conversation | **Wrong idiom for a messenger.** Restyle the history as bubbles; enlarge compose; move the call buttons | Steam renders a log of name + text blocks. Voice/invite are edge-glued squares halfway down. The compose field shows no focus. The conversation header (`ChatTab`, y 0–100) has its top 40 px under the window's 40 px header |
| Add a Friend | **Wrong container.** A whole page for one field: make it a compact sheet-like card | 85 % empty; the field is 1.23° tall; QWERTY for digits |
| Account | **Acceptable settings page with weak hierarchy.** Re-skin as a visionOS account page | Smallest toggle in the UI; destructive Sign Out sits beside Change Account; the 3 big tiles are exits to web pages |
| Notifications | **No home.** Keep Steam's places; make them legible cards | A 300 px QAM column and 300×40 toasts; visionOS 27 puts notifications in Control Center's left tile and expands them when looked at [press] (Quick Access itself belongs to the bar audit) |
| Media grid | **Content right, structure missing.** Rebuild the navigation around the grid (Photos) | Tiles are large and good. There are no dates, and the filter and game picker are invisible to the laser |
| Media viewers | **Content-first is right; controls too small and too hidden** | 36 px buttons; edge arrows on hover only; 28 px transport; destructive actions adjacent |
| Downloads | **List right; the idle hero wastes a third of the window** | 240 px empty band; 11–12 px uppercase status; 36 px buttons |
| Store chrome | **Acceptable idiom (a browser is a browser), wrong styling** | visionOS Safari is also a browser, with a glass navigation ornament. Steam's is an opaque black strip with 32 px icons |
| Achievements | **Fine list; small text** (see `game-pages.md`) | rows 2.46°; 12 px descriptions and uppercase tabs |
| Keyboard | **Placement right; echo and context missing; looks like a Deck keyboard** | §B.3 |

### B.5 "Window into another app" seams

Ranked by how often the user meets them:

1. **Typing.**
   - A black, square-keyed keyboard (stock) appears under the bar.
   - The typed text stays in a field up to 32° away.
   - Apps use a second, different keyboard.
2. **The friends UI is a Deck app inside the window:**
   - L1/R1 glyph tabs with no labels;
   - `TrueBlackBackground` (#000) on `/chat` in stock;
   - colour-coded names (blue online, green in-game);
   - a 3 px status bar on square avatars;
   - Deck focus fills (keyframes);
   - "Hold [glyph] to send a quick message".
3. **Profiles, Add Funds, Privacy and Account Details are websites.**
   - They open in a black-framed browser view with a grey URL.
   - The user's own profile, the most personal page, is the least native.
4. **Footer legends as the only door to menus** (§A.10): a console convention, not a spatial-OS one.
5. **Media viewer chrome** is a gradient band with Deck buttons (36 px, square trash). The clip player is a desktop video editor timeline with LT/RT trigger glyphs.
6. **Toasts.**
   - Stock: square 300×40 cards with an outline and 11 px titles.
   - SteamVR's own toasts are a third style (blue gradient).

### B.6 Destructive actions within one press

| where | action | today | risk |
|---|---|---|---|
| Clip player | **Delete Clip** = X, legend next to Hide (Y) | legend text, no colour | X and Y are adjacent face buttons; a laser click on the wrong legend word |
| Screenshot viewer | trash, 48×36 px, beside Share | same grey as Share | Share is the focused default; Left once lands on Delete |
| Media item Options | Delete | normal row until focused (then red) | |
| Downloads Options | **Uninstall: first row, focused on open** | normal row until focused | Options + A uninstalls |
| Account | **Sign Out** beside Change Account | same style | |
| Friend menu | Manage › Remove / Block | one level down | |
| `/chat` | group header click | persisted collapse | low; it only hides a group |

Whether each of these asks for confirmation was not verified (it would need pressing them).

### B.7 Motion versus the Liquid Glass spec (tokens from `liquid-glass-motion.md` §3.2)

| element | today | spec |
|---|---|---|
| Friend row / group focus fill | `ItemFocusAnim-darkGrey` 0.5 s keyframes, forwards | `hover-in` 294 ms in, `fade` 441 ms out; illumination, no fill keyframes |
| Friend rows / download rows | Steam's BasicUI tilt (`rotateX` ≈ 1°, 0.32 s) on focus | Keep (Steam-owned transform, small) |
| Friends tab panels | slide `translateX(∓64 px)` + fade, 0.5 s | Keep (Steam-owned); the timing function may become `page` |
| Media focused tile | `blur(50px)` glow, translate + scale 1.05, 0.4 s; hover `scale(1.02)` | lift: `scale 1.04` + deeper shadow (`depth` 441 ms), T4 +1.5 cm; no blurred glow |
| Viewer / clip controls | opacity 0.2 s fade | `materialize-in` 250 ms / `materialize-out` 350 ms |
| Share sheet, friend menu, Select Game, Options | centred sheet, scale + opacity 0.5 s | `morph-open` 607 ms / `morph-close` 441 ms (centred until anchoring exists, shell-nav CQ10) |
| Filters modal | 0.5 s fade | `sheet-in` 735 ms / `sheet-out` 514 ms |
| Keyboard appear | `keyboard_appear` 300 ms: height 40 → 240 px + opacity | materialize-in (optics first, keys at 35 %); keep Steam's animation, add the glass ramp |
| Key press | blue + shine 0.3 s | `interactive` 210 ms: `scale .96` + brighter centre; release `snappy` |
| Toasts (VR) | none (opacity 1 → 1) | `materialize-in` 250 ms, out 350 ms (shell-nav C.9) |
| Snooze "zZ" | animates on hover and focus | fine (user-driven, one-shot) |
| Achievements focus ring | `Blinker 1.2s ×20` | static (Phase 1 already neutralised it) |

### B.8 Materials (Phase 1 state, from the `_on` / `_after` shots)

- **Friends.**
  - The sidebar and the conversation are the same grey glass, split by a hairline. visionOS separates them by a material step (sidebar darker), with no line.
  - The focused friend has a 2 px white ring around a lighter fill: an outline, which the brief rules out.
- **Selection.** The Friends tab shows a white circle on the selected icon. That fits visionOS's segmented-control rule (white = selected segment) [research §14].
- **Account tiles** became full capsules 394×124 px (stadium shapes). visionOS uses capsules for buttons in rows and rounded rectangles for large tiles.
- **Toasts** became capsules (`hud_toast_variants_after`). A two-line notification in a stadium shape reads like a pill, not a card. visionOS notifications are rounded rectangles.
- **Glass.**
  - Everything is tint + rim in CSS. No room frost or lensing is possible without glassd (T5) (`references.md` finding 1).
  - Over a bright room the keyboard shows the room sharply behind the keys (`hud_keyboard_hover_after_rooms.png`).

### B.9 Side by side with visionOS Messages, Photos and the keyboard

| trait | visionOS | Steam today | gap |
|---|---|---|---|
| **Messages**: sidebar | ≈ 30–33 % width, darker material, Large Title, filter circle + Edit capsule, search capsule with mic (ref 4) | 300 px (23 %), same material + hairline, 22 px title, 26 px square button, no search | width, material step, title size, a search entry |
| Messages: pinned people | 3-column grid of large circular avatars | Favorites is a separate icon tab (empty here) | favourites as avatars on top |
| Messages: list rows | pitch ≈ 11 % of the window height (two-line rows; ≈ 80 px on a 720 px window); 36 pt avatar; bold name; time; 2-line preview; selected = raised rounded rect, white ≈ 20–25 % | 42 px; 32 px square avatar + 3 px status bar; 15 px coloured name; 12 px presence; focus-only fill | size, circle avatars, persistent selection |
| Messages: conversation | title + avatar at the top; compose and video as circles in the corners; raised glass bubbles, own = blue; recessed compose capsule with mic and a "+" circle | 100 px header half under the window header; voice/invite squares on the right edge; log blocks; 44 px compose, no focus state | bubbles, compose size and focus, call buttons as corner circles |
| **Photos**: navigation | tab bar ornament; bottom segmented ornament (Years / Months / All) [official] | Filter and game picker only via X/Y legends; `/media/list` hidden | a visible segmented ornament |
| Photos: grid | full-bleed, grouped by time | 3-up stream, no grouping | date sections |
| Photos: viewer | the photo grows from its tile; surroundings dim; controls in an ornament | new route; 83 px gradient band; 36 px buttons; hover-only arrows | ornament, 60 px circles, visible previous/next |
| **Keyboard**: window | own window; moved with its window bar, resized from the bottom corners [official] | SteamVR-placed quad; no handle | (placement is already good; moving is optional) |
| Keyboard: keys | raised over a platter; brighten on approach; pressing moves them down in z with a sound [press] | flat (stock radius 0; Phase 1 rounded); instant white on hover; blue on press | depth and press feedback |
| Keyboard: text | preview at the top of the keyboard [official] | none (Minimal flag) | **echo row** |
| Keyboard: extras | dictation mic; long-press accents [official]; context Return label [official HIG] | long-press accents yes; no dictation; "Enter" always | context label (dictation does not exist in Steam; not proposed) |

---

## C. Redesign opportunities, ranked by impact

Impact = how often the user meets it × how far it is from visionOS × how much it fixes size, input parity or safety.

**Tiers:**
- T1: CSS, including layout;
- T2: DOM augmentation (decorative nodes, classes, attributes);
- T3: Steam React views;
- T4: spatial compositor;
- T5: glassd.

**Rules for every item:**
- Steam's nodes keep their identity, focus and handlers.
- `glass.py audit` stays at 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE.
- A Steam row never becomes a column (nav trees declare `flow-children`, so the D-pad would invert).
- Never touch the "do not touch" lists in `social.md` §12.5 and `hud.md` §7.5.
- Sizes are main-window CSS px unless marked "popup px".

### C.0 Capability questions this area depends on

| id | question | needed by |
|---|---|---|
| SQ1 | Can the friends split be re-laid out in CSS? The sidebar (`%{FriendListContainerPanel}`, 300 px) would widen to ≈ 400 px, with `.SteamDeckChats` following, and rows would go from 42 to 72–80 px. **Is `friendlistListContainer` virtualized with fixed JS row heights?** Do the tab-panel slide transforms and D-pad (list → Right → chat) stay correct? | C.1 |
| SQ2 | Can the friend whose conversation is open be identified in the DOM (steamid via React props on `.friend` and `%{ChatTab}`), so a T2 class can keep a "selected" pill on its row? | C.1 |
| SQ3 | Can a T3 "⋯" button on the hovered/focused friend row open Steam's own friend menu (the same handler as ≡), giving the laser a visible path? | C.1 |
| SQ4 | **Keyboard echo.** Can a decorative node in the `VRKeyboard` window mirror the target field read-only? It would show the value, the caret, the field's placeholder or label as a hint, mask password fields, and show IME composition. Can the key block move down 41 px into the transparent band with CSS so the echo sits at the top, without moving hit areas off their keys (`audit keyboard`, `L.pad` over keys)? | C.2 |
| SQ5 | Does Steam's virtual keyboard accept a per-field Enter label (T3 prop on the keyboard request), so chat shows "Send" and search shows "Search"? | C.2 |
| SQ6 | Can a T3 ornament on `/media/grid` call the same store actions as the Filters modal and the Select Game menu (or open those exact Steam components), so the state stays Steam's and X/Y/≡ keep working? | C.3 |
| SQ7 | Can date section headers be injected into the virtualized media grid (T3)? Or should the "Days" view reuse the `/media/list` phase data? What does it cost (perf baseline §0.3)? | C.3 |
| SQ8 | Can the viewer's previous/next arrows (`%{ChangeItem}`, opacity 0 by Steam) be shown whenever the controls are visible (T1 opacity), without them stealing gamepad focus? They are clickable divs, not Focusables [source]. | C.4 |
| SQ9 | Can the Downloads hero (`%{DownloadsPage>TopSection}`, 240 px) shrink when `%{DownloadsPage>Empty}` is set, and does it grow back when a download starts? Test with a class-toggle mock; a real download is not allowed. | C.7 |
| SQ10 | Do VR toasts accept laser clicks, and what does a click do (module 15148, static reading)? | C.6 |
| SQ11 | Is in-memory CSS in the store/community web views (a separate CDP target) acceptable and stable across navigations? **Default: no, out of scope.** | C.8 |
| SQ12 | A static mock of chat history with Steam's classes (`.ChatMessageBlock`, `.msg`, `.isCurrentUser`, …) hosted like the toast mock (`hud.md` §4.3), so bubbles can be verified without messages. Is there a zoo or dev page that renders chat messages? | C.1 |
| SQ13 | Can the VR keyboard open in a numeric layout for the friend-code field (`%{Modal>NumericKeypad}` exists, unused in VR)? | C.9 |
| SQ14 | Can glassd place a platter slab 1 cm behind the keyboard overlay and follow it? The keyboard is head-placed by SteamVR, and `ovprobe` shows its transform is readable. | C.2 |

**Shell-nav questions also used here:**
- CQ4: crops off their x/y with routed input; any ornament outside the window needs it.
- CQ5: the keyboard buffered mode; SQ4 is the display-only alternative.
- CQ8: a T3 overlay as a gamepad nav tree.
- CQ10: anchored menus.

### C.1 Friends & Chat becomes a Messages-style split view (highest impact)

- **Problem:** B.1 (0.74–1.41° targets), B.2 (12–15 px), B.4 (wrong idiom), B.5 item 2, B.8.
- **visionOS pattern:** Messages (ref 4, research §7, §21).

**Proposal (main px):**

1. **Sidebar** (T1, SQ1):
   - Width 300 → **400 px** (31 %). The conversation pane follows.
   - One material step darker than the window glass (black 0.14 over it). No divider line.
2. **Sidebar header:**
   - Title (Steam's `TabPanelHeader`, which already names the tab) at **38 px Bold**.
   - Add Friend becomes a **60 px circle**. The pending-invites button becomes a 60 px circle with a red count badge.
3. **Tabs:**
   - The four icons become **one segmented glass capsule 60 px tall**, 4 × 80 px segments, selected segment white with a dark glyph.
   - The L1/R1 glyphs stay as small badges at the capsule ends, to teach the bumpers.
   - T2 adds `aria-label`s. The title names the active tab, so icons need no labels.
4. **Search entry** (T3, optional, a new affordance using an existing route): a 60 px "Search friends" capsule under the tabs that opens Steam's own `/search/tab/Friends`.
5. **Group headers:**
   - 60 px tall, 20 px Semibold title case, count in secondary text.
   - A visible chevron for collapse (today the only cue is hover).
   - No `hr` line.
6. **Friend rows:**
   - **72 px + 8 px gap (80 px pitch)**.
   - **48 px circular avatar** with the state as a 3 px ring in the state colour. The ring is drawn on the avatar image; Steam's animated `avatarStatus` element is left alone.
   - Name 22 px Semibold white; presence or game 18 px secondary.
   - Option, to be decided by the user: colour stays only in the ring and a status dot, as the visionOS colour rule asks, and the names stop being blue or green.
7. **Selection:**
   - The friend whose conversation is open keeps a **lighter pill** (white 0.16) while focus is elsewhere (T2, SQ2).
   - Hover or focus adds +0.08 and the light spot. No ring, no scale.
8. **Laser path to the friend menu:** a 44 px "⋯" circle appears at the trailing edge of the hovered or focused row (T3, SQ3). Until it exists, the "Options" legend stays the path (C.4 in `shell-nav.md` makes it a real button).
9. **Conversation header:**
   - Avatar 48 px + name 24 px Semibold + presence 18 px, clear of the window header.
   - **Voice and Invite become 60 px circles**, either in the header's trailing corner (as in Messages, where compose and video sit in the corners) or, if the D-pad check fails, kept at the right edge as 60 px circles inset 24 px.
10. **History** (T1, verified on a mock, SQ12):
    - Others' messages become raised glass bubbles (white 0.14–0.18 over the glass, radius 24) with a 36 px avatar.
    - **Own messages (`.isCurrentUser`) become right-aligned blue bubbles** (rgb 0,145,255) with white text.
    - Text 22 px; speaker names 16–18 px secondary.
    - **Date dividers 18 px Semibold, title case, without rules.**
11. **Compose:**
    - A **64 px recessed capsule** (black 0.30 + inner shadow), text 22 px.
    - **A visible focus ring** (3 px soft white 0.55, the one ring visionOS allows on text fields).
    - Send becomes a 52 px circle inside the capsule: blue whole fill when enabled, 40 % when disabled.
    - Optional T2 placeholder "Message" (an attribute, not a node change).
    - The quick-message hint becomes an 18 px caption above the capsule (same text).
12. **Empty states:**
    - "Select a friend or group to start" in title case, 24 px, centred with a glyph.
    - "Create Group Chat" as a 60 px capsule.

**Tiers:**
- T1: layout, sizes, bubbles;
- T2: selection marker, labels, placeholder;
- T3: "⋯" and the search entry;
- T4: the friend menu at +3.5 cm; rows get no depth (a high-use list);
- T5: the sidebar and pane as one glassd window with a material step.

**Retention:**
- Every node stays.
- F1 L1/R1, F5 A on headers, F6 Y, F8 focus-opens-chat, F10 ≡, F11 the radial, F13 Y and the side buttons, and F15 the history all keep working.
- The D-pad stays list → Right → conversation → Right → call buttons. Re-check after any move of the call buttons.

**Verify:**
- The `social.md` §0.3 recipes FRIEND-FOCUS, CHAT-ENTRY-FOCUS, FRIENDS-TAB 0–3 and FRIEND-OPTIONS, with `--theme on`.
- `audit main --route /chat` (with and without FRIEND-FOCUS).
- `L.pad` traversal: Down through rows, Right into the conversation, Up/Down, Left back; L1/R1 through the four tabs.
- `perf main --route /chat`.
- The SQ12 mock for bubbles.
- One `hvgrab` to judge the size and material step in the headset.

### C.2 Typing: an echo row, field context and a glass keyboard

- **Problem:** B.3 (no echo, 13–32° gaze, no context, generic press, two keyboards), B.5 item 1.
- **visionOS pattern:** the keyboard's text preview at the top [official]; raised keys on a platter [press]; context Return labels [official HIG].

**Proposal:**

1. **Echo row** (T2 in the keyboard window, display-only, SQ4):
   - The top of the keyboard slab shows the target field's text with a caret, about 40 popup px tall (≈ 1.5°), in 22–24 px type.
   - A leading secondary label names the field: the field's placeholder or accessible name, e.g. "Search for games or profiles", "Enter a Friend Code", or "Message" plus the conversation's persona name taken from the page at runtime.
   - Password fields show dots.
   - Placement: move the key block down into the 41 px transparent band (T1 inside the keyboard window). If SQ4 fails, put the echo in that bottom band instead (no layout change).
   - It keeps the eyes on the keys. Typing still goes into the field exactly as today.
2. **Context Enter label** (SQ5, T3): "Send" in chat, "Search" in search, "Add" for the friend code. If Steam has no hook, keep "Enter"; never cover Steam's label (it would trip HIDDEN).
3. **Glass keyboard, completing Phase 1:**
   - Keys as raised rounded keys (radius 10–12 popup px, concentric with the slab).
   - **A glassd platter slab 1 cm behind the keyboard overlay** (T5, SQ14), so the keys visibly float over a frosted platter as on visionOS.
   - Hover: instant brighten plus the light spot.
   - Press: `interactive` 210 ms, `scale .96` with an inset shadow (the key "goes down"), keeping Steam's `Touched` shine.
   - Enter as the one blue key.
   - The long-press accent row as a small menu bubble (Phase 1).
   - Over bright rooms, glassd's frost removes the sharp room behind the keys (B.8).
4. **Shifted labels** from 45 % to 60 % opacity, 14 → 16 px (allowed: colour and size; the transform stays Steam's). Special-key labels 12 → 15 px.
5. **Text fields everywhere in this area:**
   - Recessed capsules at **60–64 px** (compose, friend code, achievements search, Select Game search).
   - The 3 px focus ring.
   - Placeholder upright (not italic), white 0.55.
6. **The SteamVR keyboard** keeps the same key and slab tokens (Phase 1). Its preview row is already the model for (1).

**Not proposed:**
- dictation (Steam has none);
- moving or resizing the keyboard (SteamVR places it, and the placement is good, §B.3);
- bigger keys (the 854×280 quad is fixed, and the 5 rows already use 239 px).

**Tiers:** T2 + T1 (echo), T3 (Enter label), T1 (keys and fields), T5 (platter).

**Retention:**
- Hit areas, `Focused` and `Touched` states, the label-span transforms, `keyboard_appear` and `AriaLiveRegion` are untouched.
- User keyboard skins keep working (rules stay scoped to `.DefaultTheme`).

**Verify:**
- `hud.md` §5.2 shot recipes, plus a lab hook that feeds the echo a test string (`'Liquid Glass'`) without touching any Steam field.
- `audit keyboard`.
- `L.pad` across keys with the keyboard shown.
- `ovprobe` before and after (the geometry must be identical).
- `hvgrab` with the keyboard up, to judge the echo's legibility and the platter depth.

### C.3 Media becomes a Photos-style library

- **Problem:** A.10 (Filter, Select Game and Options are legend-only), B.4 (no time structure), B.7 (blur glow).
- **visionOS pattern:** Photos: grid grouped by time, a bottom segmented ornament, content full-bleed [official, research §21].

**Proposal:**

1. **Grid:**
   - Keep Steam's virtualized 3-up grid: the tiles are already 12.4° × 7°.
   - Radius 20 px concentric with the window.
   - Focus and hover become a **lift**: `scale 1.04` + a deeper shadow + **T4 +1.5 cm** for the focused tile, replacing the 2 px white border.
   - Steam's 50 px blur glow is toned down to a dark contact shadow (`filter` on a decorative image is allowed). Removing it entirely would need an exception to the never-hide rule.
2. **Bottom ornament** (T3, SQ6), an 84 px glass capsule overlapping the window's bottom edge (inside the window until CQ4), holding:
   - a segmented control **All · Screenshots · Clips · Recordings**: the Filters modal's four values, selected segment white;
   - a **"Game: All ▾"** capsule that opens Steam's own Select Game menu;
   - a **"⋯"** circle for the focused item's Options.

   All controls 60 px tall, centres ≥ 80 px apart. X, Y and ≡ keep working; this adds the laser path.
3. **Date sections** (T3, SQ7): "Today", "Yesterday", "October 5" headers at 30 px Bold, like Photos. If headers cannot enter the virtualized grid, offer a **Days** segment that shows `/media/list`'s grouping with real thumbnails.
4. **Clip tiles:** duration 13 → 18 px in a small dark capsule (tabular figures).

**Tiers:** T1, T3, T4 (lift), T5 (window glass; the ornament slab).

**Retention:**
- The grid's inline row transforms and heights and `--listTotalHeight` stay untouched.
- The filter modal and game menu remain Steam's.
- Multi-select keeps its classes.

**Verify:**
- MEDIA-BUTTON 4 / 3 / 14 recipes (`social.md` §0.3), the shots, `audit main --route /media/grid`.
- `L.pad` grid traversal (Down, Right, the ornament reached with Down at the last row, or by its own bumper if T3 adds one).
- **`perf main --route /media/grid` must stay at 73 fps with no more long frames than the stock 5–7 per 3 s.**

### C.4 Media viewers: an immersive viewer with a playback ornament

- **Problem:** B.1 (36 px buttons, 28 px transport, hover-only arrows), B.6 (Delete beside Share, Delete Clip on X).
- **visionOS pattern:** the Photos viewer and the system video player: content fills the window, with controls in a glass ornament.

**Proposal:**

1. **Screenshot viewer:**
   - The image fills the window.
   - The controls become one bottom glass ornament, 84 px, with **Share** as a 60 px capsule, **Delete** as a 60 px circle with a red glyph, separated by a gap of ≥ 24 px, and the metadata in 18 px secondary type.
   - Previous/next become **60 px circles at the window edges, visible whenever the controls are visible** (SQ8), with LB/RB badges.
2. **Clip player:**
   - The transport becomes **60 px circles** (−10 s and +10 s), with play/pause as a **70 px** circle.
   - The timeline becomes a 12 px capsule track in an **80 px** hit band. The time reads "0:03 / 0:46" in 18 px tabular figures.
   - **Clip** and **Share** become 60 px capsules. Markers and View Recordings become 60 px circles.
   - The LT/RT glyphs stay as badges at the timeline ends.
   - The "Delete Clip" legend label is tinted red (C.10).
3. **Optional (T5):** while a viewer is open, glassd dims the room behind the window to black ≤ 0.30, fading in over ≥ 0.5 s (research §22). This is the visionOS "surroundings dim" cue.
4. **Share sheet:** a menu bubble (rows 72 px). Its "Share to a chat" people as 60 px circles, which is already the share-sheet idiom.

**Tiers:** T1 (sizes, visibility of arrows), T4 (ornament +2.5 cm, same x/y), T5 (dim, slab).

**Retention:**
- Steam's timeline layers (inline `translateX` and widths) and the `CreateClip`/`Share` `::before` pseudo-elements are untouched.
- Y still toggles the controls.

**Verify:**
- MEDIA-OPEN-ITEM + ITEM-SHOW-CONTROLS and the clip recipes (`social.md` §0.3), as used for `p2_social_media_item_off` and `p2_social_media_clip_off`.
- `audit main` on both routes.
- `L.pad` Left/Right inside the controls (Share → Delete must need a deliberate move).
- An `hvgrab` of the clip player.

### C.5 Account becomes a visionOS account page

- **Problem:** B.1 (0.68° toggle, 1.23° buttons), B.6 (Sign Out), B.8 (capsule tiles).
- **visionOS pattern:** the Settings account page (ref 8): a centred identity block, then grouped rounded rows.

**Proposal:**

1. **Identity card:**
   - **112 px circular avatar** over Steam's animated profile background (kept as content).
   - Name about 38 px effective Bold (Steam's `LabelHolder` `scale(1.4)` stays; size the font accordingly). "Last online" 20 px secondary.
   - **View Profile** as a 60 px capsule.
2. **Status row:** 80 px, "Your Status" 22 px with an 18 px description, the dropdown as a 60 px capsule showing the current value with a chevron.
3. **Do Not Disturb:** the switch visually **64×40 px** via the independent `scale` property on the toggle (not Steam's transform). The whole 80 px row is the target for the gamepad (it already is).
4. **Tiles** (Add Funds, Privacy Settings, Account Details):
   - They stay a row of three (the D-pad rule) as **rounded rectangles (radius 30)**, not stadiums.
   - Each gets a 40 px coloured circular icon, a 22 px label and 18 px details.
   - They open web pages, so an "external" arrow glyph sets the expectation (T2 decorative).
5. **Friend code row:** the code in 24 px tabular figures; Add Friends as a 60 px capsule.
6. **Account group last,** separated by ≥ 32 px: Change Account as a 60 px capsule, **Sign Out as a 60 px capsule with a red label**.

**Tiers:** T1, T2 (glyph, labels), T5.

**Retention:** the same Fields, buttons and combobox; the status menu unchanged.

**Verify:**
- `/account` shots, ACCOUNT-STATUS-DROPDOWN + CLOSE-MENU.
- `audit main --route /account` (SHRUNK must stay empty; the scaled toggle must still hit-test).
- `L.pad` through the page.

### C.6 Notifications become glass cards (toasts with `shell-nav.md` C.9)

- **Problem:** B.2 (11–12 px), B.4 (no home), B.5 item 6, B.8 (stadium toasts).
- **Proposal:**
  1. **Toasts:** as `shell-nav.md` C.9, using the whole 340×80 quad:
     - a **rounded-rectangle** card (radius 24), not a capsule;
     - a 48 px circular icon (avatar or app);
     - an 18 px Semibold title and a 16 px body, 2 lines;
     - materialize in and out.
     - The incoming-call toast keeps its green whole fill. The achievement toast shows the achievement icon as a rounded square (it is art, not an app icon).
  2. **QAM Notifications list:**
     - Rows become separate glass cards (radius 20, 6 px gaps, **no 1 px dividers**): a 40 px icon, an 18 px title, 16 px body, a time, and an unread dot.
     - Empty state as today, at 20 px.
     - Rows ≥ 72 popup px tall.
  3. **SteamVR's own toasts** (`notificationtoast.html`) get the same card (owner: steamvr).
- **Tiers:** T1 (all), T5 (slab) later.
- **Verify:**
  - The tooltip-host toast mock (`hud.md` §4.3; shell-nav CQ9 asks for a taller host).
  - A static QAM row mock built with `bar.md`'s classes (no real notifications are allowed).
  - `audit tooltip` and `audit barpopup`.

### C.7 Downloads: a compact status band and a "Now downloading" card

- **Problem:** B.4 (a 240 px empty band), B.1 (36 px buttons, 29 px device row), B.2 (11–12 px uppercase).
- **Proposal:**
  1. **Idle:** the hero collapses to a **120 px** status band (SQ9). It reads "No downloads in progress" at 22 px and holds the device selector as a **"This Device ▾" 60 px capsule** in title case (the existing focusable row).
  2. **Active:** a card with:
     - art (radius 20) and the name at 28 px Bold;
     - a progress capsule with a 12 px track and a percentage at 20 px tabular;
     - Pause/Resume as a 60 px circle;
     - speed and time left at 18 px.
  3. **Sections:**
     - Titles 30 px Bold in title case, without rules.
     - "Auto-updates enabled" in 18 px secondary, title case.
     - Clear All as a 60 px capsule.
  4. **Rows:**
     - 88–96 px tall; art radius 12.
     - Name 22 px; details and status 18 px in title case (not 11–12 px uppercase).
     - Download Now, Play and Remove as **60 px circles**.
  5. **Options menu:** Uninstall gets a red label at rest (C.10). Moving it off the first, focused position would be a behaviour change and needs the user's approval.
- **Tiers:** T1 (all), T5.
- **Retention:** Steam's row tilt transforms and drag classes stay.
- **Verify:**
  - `shot main --route /library/downloads`, DOWNLOADS-BUTTON 14 / 4 (`social.md` §0.3).
  - `audit`, `L.pad`.
  - The active card from a class-toggle mock (SQ9).

### C.8 Store and profile web views get a Safari-style navigation ornament

- **Problem:** B.1 (32 px buttons), B.5 item 3, A.10 (store menu legend-only).
- **visionOS pattern:** Safari's navigation ornament (ref 7): back and forward circles, an address capsule, action circles.
- **Proposal:**
  - Back, Forward and Reload as **60 px glass circles**.
  - The URL as a **centred capsule** (lock + host, 20 px, white 0.7) instead of a full-width grey string.
  - The opaque black `HeaderOpaque` header and `Opaque` footer become window glass.
  - A visible "⋯" circle for the store menu would need T3 to send the menu button to the browser view. It is listed as an option, not a default, because the menu is the web page's.
  - **The web content itself stays untouched** (SQ11). It is content, and visionOS shows web pages opaque inside a glass window.
- **Tiers:** T1, T4 (ornament +2.5 cm only if the header becomes an ornament above the window, which needs CQ4), T5.
- **Verify:** `shot main` on `/steamweb` (Store menu item) and on a community profile via Account › View Profile (look only); `audit main`.

### C.9 Add a Friend becomes a compact card

- **Problem:** B.4 (85 % empty; 1.23° field), B.3 item 2 (QWERTY for digits).
- **Proposal:**
  - Centre a **≤ 640 px card** (thick glass, radius 44) holding:
    - "Add a Friend" at 30 px Bold;
    - the description at 20 px;
    - a **64 px recessed capsule** for the code in 28 px tabular digits;
    - **OK as a 64 px tinted capsule** (Steam's label stays "OK").
  - "Your Friend Code" becomes a large tabular number in a recessed platter below.
  - Incoming and outgoing invites as grouped rows with 60 px Accept / Ignore capsules (styled from a mock).
  - A numeric keypad for the code if SQ13 allows it.
- **Tiers:** T1, T3 (keypad).
- **Retention:** default focus stays on the field; Right reaches OK.
- **Verify:** `shot main --route /invites`, `audit`, `L.pad` (field → OK); echo with the keyboard shown (C.2).

### C.10 Destructive actions: visible at rest, separated in space

- **Problem:** B.6.
- **Proposal (T1, no behaviour change):**
  - Destructive items carry a red label or glyph **at rest**, not only when focused: Delete, Uninstall, Sign Out, Remove/Block in Manage ›, the trash button, and the "Delete Clip" legend.
  - Destructive buttons sit ≥ 24 px apart from their neighbours.
  - Focus on a destructive item uses the red whole fill (Steam's existing state).
- **Needs the user's approval** (behaviour changes):
  - moving Uninstall off the first, focused position;
  - opening menus on Cancel or on a safe item.
- **Verify:** the item-options, downloads-options and power recipes; screenshots at rest; `audit` CONTRAST on red labels over the three test rooms.

### C.11 Achievements (this area's share)

- **Proposal:**
  - The page follows `game-pages.md` C.9.
  - The **achievement toast** becomes a C.6 card: icon as a rounded square, title "Achievement Unlocked" at 18 px Semibold, the name at 16 px, the count badge as a blue capsule.
  - Friend comparison has no entry point here. Its natural home is the friend menu ("Compare Achievements"). That is a T3 addition for a later phase, not needed for retention.

### Depth plan for this area (T4; values from `visionos.md` §16.2)

| element | dz | note |
|---|---|---|
| Window, sidebar, rows, bubbles, compose capsule, account rows, download rows | 0 | high-use and in-window: shadows only |
| Focused media tile | +1.5 cm | with `scale 1.04` and a deeper shadow |
| Media bottom ornament, viewer and player ornaments | +2.5 cm | same x/y as the in-window DOM |
| Friend menu, share sheet, Select Game, Options, status dropdown | +3.5 cm | thick material |
| Filters modal (sheet) | 0; the window recedes −6 cm and dims | shell-nav CQ7 |
| Keyboard keys over the glassd platter | platter −1 cm behind the keyboard quad | SQ14 |
| Toasts | SteamVR's placement | not moved |

### Summary ranking

| rank | opportunity | main fix | tiers | blocking question |
|---|---|---|---|---|
| 1 | C.1 Friends & Chat as Messages | size (0.74–1.41° → ≥ 2.45° pitch), idiom, selection, compose focus | T1 T2 T3 T4 T5 | SQ1, SQ2, SQ3, SQ12 |
| 2 | C.2 Typing: echo, context, glass keyboard | 13–32° gaze to the text, which field, press feedback | T1 T2 T3 T5 | SQ4, SQ5, SQ14 |
| 3 | C.3 Media as Photos | laser paths to Filter, Game and Options, date structure, lift | T1 T3 T4 T5 | SQ6, SQ7 |
| 4 | C.4 Viewers and player ornament | 0.86–1.1° controls, hidden previous/next | T1 T4 T5 | SQ8 |
| 5 | C.10 Destructive safety | Delete, Uninstall, Sign Out at rest | T1 (+ approval) | — |
| 6 | C.5 Account page | 0.68° toggle, hierarchy, Sign Out | T1 T2 T5 | — |
| 7 | C.6 Notification cards | 11–12 px text, stadium shape | T1 | SQ10, shell-nav CQ9 |
| 8 | C.7 Downloads | empty third of the window, 36 px buttons | T1 T5 | SQ9 |
| 9 | C.8 Store chrome as a Safari ornament | 32 px buttons, black chrome | T1 (T3, T4) | SQ11, CQ4 |
| 10 | C.9 Add a Friend card | empty page, digits keypad | T1 T3 | SQ13 |
| 11 | C.11 Achievements (social parts) | toast, compare entry | T1 (T3) | — |

### Verification matrix (agents only, nothing needs the user)

| check | command | pass |
|---|---|---|
| Functions kept | `python glass.py audit main --route R [--pre P]` for `/chat` (+FRIEND-FOCUS), `/invites`, `/account`, `/library/downloads`, `/media/grid`, the viewer and clip recipes; `audit keyboard`; `audit tooltip` (toast mock) | 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST |
| Gamepad parity | `L.pad` traversals named in each item; the bumpers (L1/R1, LB/RB) via `DispatchVirtualButtonClick` only where the legend confirms a navigation-only action | the same reachable set as stock, with the directions matching the layout |
| Laser parity | every A.10 legend still present and clickable (`audit`); the new T3 buttons call the same handlers (logged, never activated on live data) | — |
| Sizes | a DOM sweep like §0.3 on each route | interactive ≥ 80 px or centres ≥ 80 px apart; text ≥ 18 px |
| No outlines | computed `border`/`outline`/1 px `box-shadow` rings on glass containers | none (except the text-field focus ring) |
| Motion | `document.getAnimations()` at rest; no infinite animations | 0 at rest |
| Perf | `perf main --route /media/grid` and `/chat` | fps within 5 % of stock; long frames ≤ stock |
| Headset view | `native/spike/hvgrab` with the friends page, the clip player and the keyboard (echo) shown; delete the PNGs after looking (they show the room) | legible echo, visible material step, depth reads |
| Keyboard geometry | `ovprobe valve.steam.gamepadui.keyboard` before and after | identical corners |

---

## Sources

- Apple, *Apple Vision Pro User Guide*: typing with the virtual keyboard (text preview at the top of the keyboard, the window bar to move it, resizing from the bottom corners, the dictation button, long-press accents): https://support.apple.com/guide/apple-vision-pro/tana14220eef/visionos
- Apple, *Human Interface Guidelines: Virtual keyboards* (visionOS: a separate movable window, direct and indirect input, "you don't need to account for the location of the keyboard in your layouts"; customize the Return key): https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards
- UploadVR, *Apple Vision Pro visionOS text entry* (keys raised over a platter, highlight brightening on approach, z-axis press animation with sound): https://uploadvr.com/apple-vision-pro-visionos-text-entry-keyboard
- The project's research files: `docs/phase2/research/visionos.md` (units, Messages, Photos, sizes, depth, colour), `references.md` (ref 4 Messages measurements), `liquid-glass-motion.md` (motion tokens).
- OpenVR `EKeyboardFlags` (Minimal = 1, Modal = 2, ShowArrowKeys = 4, HideDoneKey = 8): https://github.com/ValveSoftware/openvr/blob/master/headers/openvr.h
