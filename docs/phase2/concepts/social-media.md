# Concept: People, Photos, Downloads, Store (`concept:social-media`)

Phase 2 redesign of every surface where the user talks to people, looks at their captures, watches downloads, browses the store or reads achievements:

| Steam route | Today | Becomes | visionOS model |
|---|---|---|---|
| `/chat` (Friends & Chat) | Deck friends list + chat log | **People**: a Messages split view | Messages (ref 4) |
| `/chat` keyboard | Steam's VR keyboard, no echo | The same keyboard with an **echo row** and context | visionOS keyboard preview |
| `/account` | Settings-style page, full width | **Your profile**: an account page in a centred column, no ornament row | Settings › Account (ref 8) |
| `/invites` | One field on an empty page | **A floating card** that holds the whole page | an alert / sheet card |
| `/media/grid` | 3-up grid, actions only in the legend | **Photos** grid with visible filters | Photos |
| `/media/item/screenshot/:id` | Deck viewer, hidden arrows | **Photo viewer**: content fills the window, room dims | Photos viewer, Image Playground (ref 2) |
| `/media/item/clip/:id` | Desktop editor timeline | **Clip player** with a playback platter | Music / TV player (ref 11, ref 5) |
| `/library/downloads` | 240 px empty hero + list | **Downloads**: "Now Downloading" card + queue | App Store updates, Music Now Playing |
| `/steamweb`, `/externalweb` | Black browser strip | **Safari-style navigation ornament** above the window | Safari (ref 7) |
| `/library/app/:id/achievements/...` | Uppercase tabs, small search | Achievements page on the shared system (owned by `game-pages` C.9) | Settings detail page |
| toasts, QAM notifications | 300×40 cards, 11 px text | Notification cards (spec only; the QAM list belongs to the system concept) | Notification Center |

**Revision 2.** A critic scored revision 1 at 6 of 10. This revision takes the window, toolbar and ornament geometry from `concepts/window-nav.md`, obeys the ghost rule of `capabilities/native-e2e.md` §1 (nothing outside an opaque window cover pops), replaces the +25/+30 mm interactive pops with a **click-safe depth plan that ships without a wearer** (§4), keeps every control over media flat, fixes the selection, tab and search problems in People, replaces the guessed T2 invite buttons with Steam's own (new probe P5), adds component fixtures and a per-class size gate to the tests, and fixes the Store's "theme off = stock" gap. §11 answers each critique point.

**What this document is built from:** `docs/phase2/DESIGN2.md` (the system; every token below comes from it), `research/visionos.md`, `research/references.md`, `research/liquid-glass-motion.md` (MO), `capabilities/spatial.md` (SP), `capabilities/steam-react.md` (SR), **`capabilities/native-e2e.md` (NE)**, **`concepts/window-nav.md` (WN)**, the audits `audit/social-media.md` (SM), `audit/game-pages.md` (GP) and `audit/shell-nav.md` (SN), the inventories `docs/inventory/social.md` and `hud.md`, the twelve reference shots, and five read-only probes of the live device made for this concept (§6.1).

**Evidence tags:** **[PROVEN]** shown on the Frame (capabilities docs), **[source]** read from Steam's webpack code on the device, **[measured]** read live, **[PLAUSIBLE]** same mechanism as something that works, **[UNPROVEN]**, **[ours]** a decision taken here with its reason.

**Privacy:** the live `/chat`, `/account` and `/invites` shots contain the user's persona name, account name, friend code and friends' names. This document and its mockups use invented names, codes and procedural art only.

**Mockups** (all at true size in the 1920×1080 kit view; Steam's window is the 1280×720 overlay at 1:1):

| Mockup (`docs/phase2/mockups/`) | Render (`shots/`) | Shows |
|---|---|---|
| `social-media-people.html` | `p2_social-media_people.png` | People: sidebar, open conversation (the only filled row), laser on another row's "⋯" (light spot only) |
| `social-media-people-menu.html` | `p2_social-media_people-menu.png` | The friend menu grown out of "⋯", anchored beside it, +12 mm, scrolling inside Steam's 520 px modal box |
| `social-media-people-depth.html` | `p2_social-media_people-depth.png` | The same screen with every element's depth and tier labelled, and the crop budget per screen |
| `social-media-people-t1.html` | `p2_social-media_people-t1.png` | The same screen in the CSS-only fallback (no glassd, no pops) |
| `social-media-compose.html` | `p2_social-media_compose.png` | View pitched down: compose focused, the keyboard with its echo row and "Send" |
| `social-media-account.html` | `p2_social-media_account.png` | Your profile, top of the page, gamepad focus on Do Not Disturb, quiet legend inside the glass |
| `social-media-account-end.html` | `p2_social-media_account-end.png` | The end of the page: Friend Code, Sign Out red at rest |
| `social-media-invites.html` | `p2_social-media_invites.png` | Add a Friend as one floating card holding Back, search, the field, the code, an invite with Steam's own buttons and the legend |
| `social-media-photos.html` | `p2_social-media_photos.png` | Photos grid, filter segments, focused tile lifted with its "⋯" |
| `social-media-viewer.html` | `p2_social-media_viewer.png` | Photo viewer, room dimmed, controls as flat clear glass, collapsed search |
| `social-media-clip.html` | `p2_social-media_clip.png` | Clip player, flat playback platter, Delete Clip red |
| `social-media-downloads.html` | `p2_social-media_downloads.png` | Downloads with an active download (fixture state) |
| `social-media-store.html` | `p2_social-media_store.png` | Store with the navigation ornament above the window, both ornaments at 0 mm |
| `social-media-achievements.html` | `p2_social-media_achievements.png` | Achievements with the quiet legend |

Shared mockup files: `social-media.css` (page layout and fills; no glass of its own) and `social-media.js` (extra icons, the shared chrome, the People window builder, the legend builder, the keyboard keys). They extend `kit.css` / `kit.js` without changing them.

---

## 0. The concept in one page

1. **Four apps, one system.** Friends, Media, Downloads and Store are four destinations of the tab-bar ornament (DESIGN2 §3.3, WN §3.3). Each gets the layout of its visionOS counterpart, not a recoloured Deck page: a Messages split view, a Photos grid with an immersive viewer, a Now-Downloading card, a Safari ornament.
2. **Everything at visionOS size.** Every control is a 60 px circle or capsule with an 80 px hit region; rows are 72 px at an 80 px pitch (menus 78); fields are 64 px recessed capsules; segments are 60 px in a 68 px track; body text is 24 px, the floor is 18 px. Today's 24–48 px targets (0.74–1.47°) become ≥ 2.45°.
3. **One frame for every window.** The window, the toolbar row and the bottom ornament use WN's numbers exactly: glass 1280×656, Back in Steam's 80×80 box at (14, 14), Large Title at x 100, the 520 px search capsule centred on x 640 on section roots, a 60 px magnifier circle on nested routes and over media, the ornament at y 628–712. Search never moves between routes and never pretends to be a local filter.
4. **No action lives only in the legend any more.** The ten legend-only laser paths of SM §A.10 each get a visible button. The "⋯" on a row calls **that row's own** menu handler, so it acts on the row it sits on, never on whatever happens to hold focus. On `/invites`, Steam already draws real Block / Accept / Ignore buttons (probe P5); they are restyled, not replaced.
5. **Chrome only where it carries something.** Routes whose legend only ever says "A Select / B Back" (profile, Add a Friend, achievements) lose the floating ornament: the hints sit quietly inside the glass. The window then has no extra row of chrome under it.
6. **Glass carries the edges; content stays content.** Window, ornaments, menus, the keyboard platter and the invite card are glass (glassd in T5). Avatars, screenshots, videos, store pages and achievement icons are opaque content. Nothing has an outline.
7. **Stereo that is safe to ship today.** Menus +12 mm, the focused photo +15 mm, Pause +10 mm, the identity avatar +10 mm, the keyboard keys 10 mm in front of their platter, plus WN's tab bar at +25 mm. Every pop is a non-interactive crop inside the opaque window cover, sized so the laser's parallax error stays inside the central half of the target. Nothing outside a cover and nothing over media pops (no "ghosts", no floating patches of video). Deeper, interactive pops wait for the wearer check.
8. **Nothing is lost.** 93 functions from the audits are mapped in §7, each with a laser path and a gamepad path. No Steam node is removed, hidden or moved out of DOM order; T3 adds, never replaces.

### 0.1 Verdict per screen (is the current experience right in VR?)

| Screen | Verdict | What changes |
|---|---|---|
| Friends list | Right structure (split view), wrong scale, idiom and selection | **Re-layout**: 456 px sidebar with a toolbar row (Back, search circle), a title row (tab name + action circles), four labelled segments, 72 px rows with avatar rings, one filled row for the open conversation |
| Conversation | Wrong idiom for a messenger | **Re-layout**: centred header lockup, call buttons as corner circles, bubbles, 64 px compose with a 60 px Send |
| Typing | Placement right; no echo, no context | **Augment**: echo row and field label on the keyboard, context Enter label, glass platter |
| Account | Acceptable page, weak hierarchy, unsafe Sign Out | **Re-layout** into a 760 px column: identity card, grouped rows, tiles that announce they leave the app, Sign Out red and separated; no ornament row |
| Add a Friend | Wrong container (85 % empty page) | **Re-house**: the window turns off; one floating card holds everything |
| Media grid | Content right, navigation missing | **Augment**: visible filter state and laser paths, larger gaps, lift on focus; geometry unchanged |
| Photo viewer | Content-first right; controls tiny and hidden | **Re-layout**: photo fills the window; Share/Delete top-right; visible previous/next; room dims; search collapses |
| Clip player | Desktop editor in a headset | **Re-layout**: one playback platter, 60/70 px transport, 80 px scrub band |
| Downloads | List right; idle hero wastes a third | **Re-layout**: 208 px Now-Downloading card, 96 px idle band, 96 px rows with circles |
| Store chrome | A browser is right; black strip wrong | **Re-house** the header as a Safari ornament above the window; web content untouched |
| Achievements | Fine list, small text | **Restyle** on the shared tokens (owner: game-pages C.9) |
| Notifications | No home; tiny toasts | **Restyle** toasts as cards (QAM list: system concept) |

---

## 1. Experience narrative

You open the dashboard. The tab-bar ornament floats beside the window's leading edge, a little in front of it; you point at the people glyph and the window becomes **People**.

The left third of the window is one shade darker, like the sidebar in Messages. At its top sit a quiet back chevron and a search circle. Below them, "Friends" in bold, with an invitations circle (a red "2" on it) and an add-person circle beside the title. Under the title a recessed capsule holds four labelled segments, Favorites, Friends, Groups, Recent, with the selected one a white pill; small L1 and R1 badges sit on the capsule's two ends, so a gamepad user sees that the bumpers switch it. Friends playing the same game are grouped under the game's icon. Each friend is a 72 px row: a circular avatar with a thin green, blue or grey ring for their state, the name in white, what they are doing underneath. The person you are talking to is the only row with a light pill behind it and the only name in bold, and it stays that way while your focus is in the chat.

On the right the conversation reads like Messages: the friend's avatar and name centred at the top, a headset circle and an add-person circle in the top-right corner for a voice chat or a group invite, the history as bubbles (theirs light glass-grey, yours Steam-blue on the right), dates as quiet captions, and at the bottom a 64 px recessed capsule that says "Message" with a round Send button at its end. Under the window, the bottom ornament shows what the controller can do right now: "≡ Options", "A Send Message", "B Back". You can click those too.

You point at another friend. A soft light follows the pointer across the row, without filling it, so the open conversation still stands out, and a "⋯" circle materializes at the row's end. Click it and that friend's menu grows out of the circle beside the row, a dark glass slab that settles a centimetre in front of the window with the friend's name at the top: Send Message, Start Voice Chat, View Profile (with an arrow that says it opens a page), Find Games to Play Together, Trading, Manage. The chat you had open does not change.

You click the compose capsule. A ring of light appears around it and the keyboard comes up below the dashboard bar, its keys raised over a frosted platter. Across its top, an echo row reads "Message to Aster Vale" and repeats what you type, so your eyes never leave the keys. The blue key says "Send".

You switch to **Media**. A Large Title, a segmented control (All · Screenshots · Clips · Recordings) and an "All Games ▾" capsule sit above a grid of rounded captures with real gaps between them. The capture you point at rises a centimetre and a half toward you with a soft sheen and shows its own "⋯". Open it: the screenshot fills the window, the room behind you dims, previous and next circles sit at the window's sides, and Share, a red trash circle and a small search circle sit top-right. These controls are clear glass lying on the photo, as in Photos; nothing lifts a piece of the picture off. A clip opens the same way with a playback platter: a scrub track you can actually hit, a 70 px play button between two 10-second jumps, Clip and Share capsules on the right, and the destructive "Delete Clip" in red in the ornament, never next to the play button.

**Downloads** greets you with what is happening: the game's art, its name, a progress capsule, speed and time left, and a pause circle that floats a centimetre forward. Below, the queue in large rows with circular play and remove buttons, and a "⋯" on the row you point at for the full Options menu, where Uninstall is already red before you focus it.

In the **Store**, the browser controls leave the window and float above it in a glass capsule, as in Safari: back, forward, reload, and an address capsule with a lock. The store page fills the window below it, untouched. "Add to Cart" and "Store Menu" are real buttons in the bottom ornament.

From the bar's avatar you reach **your profile**: one window with your animated profile background in a rounded card and your avatar floating a centimetre in front of it, your status and Do Not Disturb as grouped rows, three tiles for Add Funds, Privacy and Account Details that announce with an arrow that they open web pages, and at the very end Sign Out in red, a clear gap away from Change Account. There is no capsule under this window: the "A Select · B Back" hints sit quietly inside its bottom edge. **Add a Friend** is no longer a page at all: the window fades away and a single glass card floats where it was, with its own back and search circles in its corners, the code field focused, your Friend Code in large digits, pending invitations with Steam's own Block, Accept and Ignore buttons, and the hints along its bottom edge.

None of this persists. Turning Liquid Glass off, restarting Steam or rebooting returns Steam's own UI, including the store's web view at its stock size.

---

## 2. Decisions taken in this concept

| # | Decision | Why | Reversible by |
|---|---|---|---|
| SM-D1 | Friend names are **white**; the state colour lives only in the avatar ring (and the in-game group header's game icon) | DESIGN2 §8.3: colour only in whole fills, never thin coloured text; Messages shows white names. The ring keeps all the state information | One rule (`.friend .playerName { color }`) |
| SM-D2 (rev.) | On `/chat` Steam's header is laid out **in the sidebar's toolbar row**: Back at (24, 24), and the global search **collapsed to a 60 px magnifier circle** at (372, 24) with Steam's own placeholder as its tooltip and `aria-label` | Messages puts navigation in the sidebar. Revision 1 made the global search look like a friend filter, but focusing it navigates to `/search` (SN H2); a magnifier in a toolbar reads as "search Steam", which is what it does. Same collapsed form as WN's hero routes | Route-scoped T1 rules |
| SM-D3 (rev.) | The footer legend is **WN's bottom ornament** (WN §3.4) on routes whose legend carries actions; on routes whose legend only ever carries A/B hints it is a **quiet legend inside the glass** (§3.0) | Visible, clickable actions (SM §A.10) without a capsule that says only "A Select / B Back" under the window | Route-scoped T1 rule |
| SM-D4 (rev.) | **`/invites` turns the window glass off** and shows one thick-glass card that also holds Steam's Back, the search circle and the legend | The page is one field; a floating card is the visionOS container for that. Keeping all chrome inside the card means nothing sits outside a cover (NE §1) | `layers.json` cover rule + one class |
| SM-D5 | Media thumbnails are **inset 8 px inside Steam's unchanged 405×228 slots** (visible 389×212, 24 px gaps), cropped to fill | The grid is virtualized (never touch rows, SM §C.3, inventory §12.5); the hit target keeps Steam's size, so SHRUNK stays 0 | One rule |
| SM-D6 | The viewer and the clip player **dim the room** (black .30 over ≥ 0.5 s) | visionOS "surroundings dim" for media (research §22); drawn by glassd, never by changing SteamVR settings | glassd shape off |
| SM-D7 | The store gives up a **96 px top strip** (ornament margin) for the navigation ornament, and `lgs on/off` re-runs Steam's own bounds update (§3.10) | Safari (ref 7); the browser view takes its bounds from its DOM rect [source P2] | Plan B keeps WN's in-row browser mode |
| SM-D8 | Destructive items are **red at rest**, ≥ 24 px from neighbours; **no reordering** (Uninstall stays first and focused; trash stays left of Share; Block stays left of Accept) | SM C.10; reordering is a behaviour change and needs the user's approval, which cannot be obtained | — |
| SM-D9 | DESIGN2 §12 lists "friends" among virtualized lists. **The friends list is not virtualized** (module 20447) [source, measured], so row height may change in T1. Foundation should correct §12 | §6.1 probe P1 | — |
| SM-D10 | **Window geometry comes from WN** §3.1–3.4 (glass 1280×656, ornament 628–712, Back box (14, 14), title x 100, search 520 centred on x 640) | One frame for every window; revision 1 used 664 / 636–720 and moved search on Downloads | — |
| SM-D11 | **Click-safe depth by default** (§4.1): non-interactive in-place crops inside the window cover, dz ≤ ¼ of the smallest target under the crop at a 45° laser | The interactive-crop click needs a wearer (SP §12); the brief asks for stereo now | Push dz 0 |
| SM-D12 | **Nothing over media pops** (viewer, clip, share sheets keep their frost) | A crop carries every pixel in its rect, so a clear control would lift the photo with it | — |
| SM-D13 | **The open conversation is the only filled row** (white .18 + Bold name); laser hover is the light spot alone (peak +.12, radius 108 px, no fill) | In a list the laser sweeps constantly; the current chat must not look like a hover (critique) | One rule |
| SM-D14 | **Four equal labelled segments** for the friends tabs; the bumper glyphs become badges on the track's ends | Labels remove the person/group glyph ambiguity; equal widths keep the selection change a pill travel (DESIGN2 §11.5 forbids animating segment sizes) | One rule + T2 labels |
| SM-D15 | **"⋯" calls the host row's own `onMenuButton`** from the row's fiber props, and stops its own pointer events in the capture phase | It must act on the row it sits on, even when another row holds focus, and must not open that row's chat (P5) | Remove the T2 node; the legend button remains |

---

## 3. Screens

Sizes are main-window CSS px with visionOS points in brackets (1 pt = 4/3 px, DESIGN2 §2.1). Positions are in the 1280×720 overlay (x from the left, y from the top). Depths are in mm in front of the window plane (scene units = mm / (369 × r), DESIGN2 §2.6). Motion names are DESIGN2 §11.2 tokens.

### 3.0 Shared anatomy for every screen here (from WN §3.1–3.4)

| Element | Steam node | Size | Position | Material | Depth | Tier |
|---|---|---|---|---|---|---|
| Window glass | `%{BasicHome}` + page roots made transparent | **1280×656** (960×492 pt), radius 54. **1280×720** on quiet-legend routes (`/account`, achievements). Off on `/invites` | (0, 0) | `window` (T5) / smoky tint `rgb(20 22 30 / .74)` + edge cues (T1) | 0 | T5, T1 fallback |
| Back | `%{BackContainer}` (laser-only; B is the gamepad path) | 60 circle (45 pt) drawn in Steam's 80×80 box (`background-clip: content-box`) | box (14, 14), circle (24, 24) | section roots (Friends, Media, Downloads): borderless, chevron white .70, platter on hover; nested routes: thin fill .10; over media: clear (black .32 + 10 px blur) | 0 | T1 |
| Large Title | WN's T2 decorative label (route map) | Large Title 46 px Bold (34.5 pt) | x 100, centred on y 54 | text | 0 | T2 (WN) |
| Search, section roots (Media, Downloads) | `%{SearchAndTitleContainer}` / `%{SearchBox}` | **520×64 capsule** (390×48 pt), hit 536×80, placeholder Steam's string, 24 px upright | centred on x 640 (x 380–900), y 22–86 | thick fill (recessed) | 0 | T1 (WN) |
| Search, nested routes and media (account, invites, achievements, viewer, clip) | the same container, collapsed | **60 px magnifier circle** in its 80×80 box, tooltip = Steam's placeholder after 0.8 s | top-right: box (1186, 14), circle (1196, 24); on `/invites` in the card's corner | thin (clear over media) | 0 | T1 (WN hero variant; gated by WN AT-4, fallback the full capsule) |
| Search on `/chat` | the same container, collapsed | 60 px magnifier circle | (372, 24) in the sidebar's toolbar row | thin | 0 | T1 (SM-D2) |
| Bottom ornament | `#Footer` legend (`%{ActionButtonLegend}` items) | footer 92 tall; capsule 84 (63 pt) at **y 628–712**, overlapping the glass by 28 px; `fit-content`, ≤ 1232 wide | centred on x 640 | `liquid` (T5 slab behind it, inset method SP §2.5 option 1) / T1 backdrop blur + 0 7 22 shadow | **0** (no crop: 56 of its 84 px lie outside the cover, NE §1) | T1, T5 |
| Legend action item (X, Y, ≡) | one `%{ActionButtonLegend}` | 60 capsule, leading glyph badge 28 px, label 22 px Semibold, transparent at rest | in the ornament | — | — | T1 |
| Legend hint item (A, B) | one `%{ActionButtonLegend}` | same size; label Medium white .70; 14 px larger gap before the first hint | ornament end | — | — | T1 |
| **Quiet legend** (`/account`, `/invites` inside the card, achievements) | `#Footer`, unchanged geometry (y 628–712) | no capsule material and no slab; items keep their 60 px size and stay clickable; an action item that appears gets a thin fill | inside the 720 px glass (or the card) | none | 0 | T1 (route-scoped; never toggled by focus, so the glass never changes size under the user) |
| Scroll edge | page scrollers | bottom fade over the last 64 px; top fade scroll-linked over the first 24 px of scroll | — | mask (one per view) | — | T1 |

Rules shared by all screens: no `border`/`outline`/1 px rings; hover = white +.08 and the light spot (sidebar rows: the spot alone, SM-D13); gamepad focus = +.14, light spot, the control's own arc ×1.5; selected button or segment = white .94 with a dark label; navigation selection = white .18 pill (DESIGN2 §8.2, §10). All Steam focus keyframes (`ItemFocusAnim-*`) are overridden with `!important` fills (inventory §1).

**Fallback when the 108 px toolbar row (CQ1, WN AT-2) is not proven:** WN §3.2's fallback applies (40 px layout, controls overflowing into a 68 px band, 68 px of extra page padding).

**Route-scoped exceptions to WN §3.2 geometry** (listed for WN, which owns `#header`): on `/chat` Back and the search circle sit in the sidebar's toolbar row; on `/invites` they sit in the card's top corners (§3.5). Both are position-only T1 rules; Steam's handlers and D-pad Up (Main's `onMoveUp`) are unchanged.

### 3.1 People: Friends & Chat (`/chat`)

Mockups: `p2_social-media_people.png`, `p2_social-media_people-t1.png` (fallback), `p2_social-media_people-depth.png` (depth plate).

**Layout: sidebar (`%{FriendListContainerPanel}`, 300 → 456 px, 456×656)**

| Element | Steam node | Size | Position | Fill | Tier |
|---|---|---|---|---|---|
| Sidebar | `%{FriendListContainerPanel}`, `.friendlist` | 456×656 (342×492 pt) | x 0–456 | black .14 (one step darker), no line; `.SteamDeckChats` follows at x 456 | T1 |
| Toolbar row: Back | `%{BackContainer}` (header node, positioned here on `/chat`) | 60 circle in an 80 box | (24, 24) | borderless (section root) | T1 |
| Toolbar row: search | `%{SearchAndTitleContainer}` collapsed (SM-D2) | 60 circle in an 80 box | (372, 24) | thin | T1 + T2 `aria-label` |
| Title | `.TabPanelHeader` (names the tab: Friends / Favorites / Groups / Recent Chats; WN's window Large Title opts out on `/chat`) | Title 1 38 px Bold (28.5 pt) | x 24, centred on y 134 | text | T1 |
| Pending invites | `.FriendsInvitesButton` + `.PendingInviteCount` | 60 circle, red 28 px badge top-right | (292, 104) | thin | T1 |
| Add a Friend | `.AddFriendButton` (Groups tab: `.NewChatGroupButton`) | 60 circle | (372, 104); centre 80 px below the search circle | thin | T1 |
| Tabs | `FriendsListSteamDeckTabs` (row: bumper, 4 `FriendsListTab`, bumper; DOM order kept) | track 432×68 (324×51 pt), padding 4; **four equal segments 106×60** (hit 106×80: each tab element carries 10 px of transparent padding above and below the track); labels 20 px Semibold (T2, §6.2); selected = white .94 pill, dark label; others text-2 | track (12, 180) | thick track | T1 + T2 labels |
| Bumper hints | `%{TabBumper}` > `%{BumperIcon}` (images, not focusable) | 36×26 badges, Steam's glyph image at 18 px | centred on the track's two ends, top at y 166 (overlapping the track by a half) | white .30 tint over the badge | T1 (position only) |
| Group header | `.groupName` (role=button; A = collapse) | 72 row, 22 px Semibold text-2, count text-3, chevron 22 px trailing; game groups lead with the 40 px game icon (radius 10) | x 12–444, list from y 260 | none; focus +.14 | T1 |
| Sort by recent (Offline) | `.SortByRecent` | 60 circle at the header's end, shown on hover or focus (Steam's own reveal) | header end | thin | T1 |
| Friend row | `.friend` | 72 tall, 8 gap (80 pitch); avatar 48 circle (36 pt) with a 3 px state ring (green in game, blue online, blue .55 away, grey offline + desaturated); name 24 px Semibold white; presence 20 px text-2 | x 12–444 | **open conversation: white .18 pill + Bold name** (T2 class `lgs-current`), the only filled row; **hover: light spot only** (peak +.12, radius 108 px, no fill); gamepad focus +.14 + spot + arc (focus opens that chat, P1, so it is also the current row) | T1 + T2 |
| "⋯" on the row | new decorative node appended inside the hovered or focused `.friend` | 60 circle, inset 6 from the row end (x 378–438) | row end | thin; white .94 while its menu is open (Steam sets the row's own `bActive` state then) | T2 (SM-D15) |
| Snooze "zZ" | `%{SnoozeZ}` | 16 px Bold text-3 after the name (animation kept: user-driven, one-shot) | — | — | T1 |

**Layout: conversation (`.SteamDeckChats`, x 456–1280, 824×656 (618×492 pt))**

| Element | Steam node | Size | Position | Fill | Tier |
|---|---|---|---|---|---|
| Header lockup | `%{ChatTab}` (role=button) with its friend markup | 72 tall capsule: avatar 52 + name 24 px Semibold / presence 20 px text-2 | centred on the pane (x 868), y 18–90 | none; hover/focus pill | T1 |
| Voice chat | `.oneOnOneVoiceChatButton` (online friends only) | 60 circle, headset glyph | (1116, 24) | thin; voice active = green whole fill | T1 (position) |
| Invite to chat | `.inviteAnotherFriendButton` | 60 circle | (1196, 24) | thin | T1 (position) |
| History | `.chatHistoryScroll` (unchanged scroller) | y 100–496, 32 px side padding; top fade 64 px | — | — | T1 |
| Date divider | `.msg.timeDivision` | 18 px Semibold text-2, title case, centred, no rules | — | — | T1 |
| Speaker caption | `.speakerName`, `.FriendChatTimeStamp` | 18 px Medium text-3 | above each block | — | T1 |
| Their message | `.ChatMessageBlock .msg` | bubble max 560 (420 pt), padding 13/20, radius 26 with the tail corner 10, text 24 px | left, after a 36 px avatar on the last bubble of a group | white .16 (raised) | T1 |
| Your message | `.isCurrentUser` | same, right-aligned | right | `rgb(0 145 255)` whole fill, white text | T1 |
| Typing | `.FriendChatTypingNotification` | 20 px text-2 in a white .10 bubble, static (no animated dots) | under the last bubble | — | T1 |
| Quick-message hint | `.RadialMenuExplainerText` | 18 px text-3 with a 26 px glyph badge | right 48, y 506 | — | T1 |
| Compose | `%{chatEntryControls}` > `%{chatTextarea}` | 776×64 (582×48 pt) capsule, text 24 px, placeholder "Message" (T2 attribute) | (480, 544); 20 px clear of the ornament | thick (recessed); focus = the 3 px ring | T1 + T2 |
| Send | `%{chatSubmitButton}` | **60 circle** 2 px inside the capsule's end; its 80×80 box (10 px transparent padding, the form keeps `overflow: visible`) | compose end | blue whole fill when enabled; white .10 at 40 % when disabled | T1 |
| Bottom ornament | `#Footer` | per focus: "≡ Options" / "A Send Message" / "B Back"; in compose "Y Start Voice Chat" / "A Select" / "B Back" | centred on x 640 (WN) | `liquid`, 0 mm | T1 |
| Empty state | `.emptyChatDialogs` | 24 px text-2 title case, centred, with a 48 px bubble glyph above (T2 decoration) | pane centre | — | T1 + T2 |

**Other tabs:** Favorites (`FavoritesTabList`): favourites as a 3-column grid of 96 px avatar circles (72 pt) with names (20 px Semibold) below at a 136 px row pitch, the Messages pinned grid; T1 if its children are in flow (verify with a fixture, §8), else T3 from `g_FriendsUIApp.FriendStore.m_FavoritesStore` (§6.1 P4) opening chats through `UIStore.ShowFriendChatDialog` (the call Steam's rows make). Groups: group rows with 48 px rounded-square group avatars (radius 12) and "Create Group Chat" as a 60 px capsule. Recent Chats: two-line rows (name, last line of the chat) with the time trailing in 18 px text-2.

**Voice, group chats (F17):** call controls become 60 px circles in the conversation header (mute: white .94 when muted; leave: red whole fill); group member lists become 72 px rows in a recessed platter. These states cannot be produced without side effects; their styling is verified on component fixtures where a component can be found, otherwise on static fragments labelled unverified (§8.3).

**Depth:** everything at 0. No crop on this screen unless a menu is open (crop budget 0, +1 with a menu).

**Motion:** row hover `hover-in` 294 ms / `fade` 441 ms (the spot follows the pointer); the current-row pill cross-fades on `fade` (no travelling indicator); the segment's white pill travels on `snappy` 488 ms (position only: segments are equal); Steam's own tab-panel slide (∓64 px, 0.5 s on a 456 px panel, below M1's 600 px rule) is kept; a new bubble enters with `fade` + 8 px rise (list insertion; never on history loads); the "⋯" materializes in 250 ms and leaves in 350 ms; the conversation swap keeps Steam's `ChatTabTransitionGroup`.

**Gamepad model (unchanged):** D-pad down the list (focus opens the chat, `onGamepadFocus` → `ShowFriendChatDialog` [source 20447]), Right into the history and compose, Up from the list to the tabs, Up again to the title row's action circles, Up again to the header (Steam's `onMoveUp`; the search circle sits directly above Add Friend, so the move matches the picture), L1/R1 switch tabs, ≡ opens the friend menu, hold ≡ = quick message, Y in compose = voice chat, B back. §8.2 checks that this sequence equals stock.

### 3.2 The friend menu

Mockups: `p2_social-media_people-menu.png`, `p2_social-media_people-depth.png`.

WN §5.1 defines menus for the whole system; this is the friend menu on it.

| Element | Steam node | Size | Material | Depth | Tier |
|---|---|---|---|---|---|
| Menu | `%{*BasicContextMenuModal>contextMenuContents} friendsContextMenu` | 420 wide (315 pt), padding 8, radius 32; rows 72 (54 pt), 6 px apart (78 pitch), 24 px symbol left of the label; groups separated by 8 px of space; Cancel a 60 px capsule last (WN §5.1) | `thick` (T5 slab; the T1 frost stays in the texture so the crop never lifts sharp page pixels) | **+12 mm** (0.0325 units), non-interactive in-place crop (click-safe, §4.1); **+30 mm** interactive only after the wearer check | T1, T4, T5 |
| Header row | `BasicContextMenuHeader` (the friend's name) + a T2 28 px avatar | 40 tall, 22 px Bold text-2 (WN D-5) | — | — | T1 + T2 |
| Rows | Send Message · Start Voice Chat · View Profile (↗ trailing: opens a web page) · Find Games to Play Together · Trading › · Manage › · Cancel (Steam's order) | Manage's submenu rows Remove Friend and Block are **red labels at rest**, red fill on focus | — | — | T1 |
| Source | the row's "⋯" | turns white .94 (open-menu source) | — | — | T2 |
| Position | anchored beside the source (WN §5.1 T2 translate: 16 px to the right of the "⋯"), clamped to Steam's modal box y 108–628 | the menu needs 596 px at these sizes, so it scrolls by 76 px with Steam's 72 px scroll padding and a bottom scroll edge (WN §5.1 rule) | — | — | T1 + T2 |
| Ornament while open | `#Footer` | "A Select" / "B Back" (WN: the ornament carries the menu's legends) | — | — | — |

Motion: open `morph-open` 607 ms (b20) from the "⋯" rect (T2 fills `--sx --sy --sw --sh --sr`), content 15–50 %; depth 0 → 12 mm on `depth` 441 ms (pushes at 60/s only while moving, SP §4.2); close `morph-close` 441 ms with depth back to 0; the parent does not dim (menus never dim).

### 3.3 Typing: compose and the keyboard echo

Mockup: `p2_social-media_compose.png` (view pitched down about 14°: the keyboard sits 17–27° below the window centre, under the bar, SM §0.3).

| Element | Steam node | Size (keyboard popup px; m = 0.74 across, 0.84 vertically) | Material | Depth | Tier |
|---|---|---|---|---|---|
| Keyboard quad | `keyboard` surface, 854×280 popup px | geometry unchanged | — | SteamVR's placement | — |
| Platter | glassd slab behind the quad | 854×286, radius 30 | `thick` | **−10 mm** (1 cm behind the keys) | T5 (SM SQ14) |
| Echo row | new display-only node at the top of the keyboard window | 826×40 (≈ 1.5°), recessed capsule; leading label 15 px text-2 (= 20 main px) naming the field ("Message to Aster Vale", "Search for games or profiles", "Enter a Friend Code"); text 19 px (= 26 main px); caret 2 px blue; password fields as dots; IME composition shown | thick fill | 0 | T2 (SQ4) |
| Key block | Steam's keys | moved down 41 px into the transparent band (hit areas move with the keys) | — | 0 | T1 (SQ4) |
| Keys | Steam's keys (`%{Modal>Focused}` hover, `Touched` press) | 57×44 visible, radius 11, label 17 px (= 23 main px), shifted labels 15 px at 60 % (= the 18 px floor) | white .16 raised fills; modifier keys white .09; hovered key white with a dark label | 0 | T1 |
| Enter | Steam's Enter key | blue whole fill; label "Send" in chat, "Search" in search, "Add" for the friend code when SQ5 holds; otherwise "Enter" | — | — | T1 / T3 |
| Accent row | `KeyboardExtendedRow` | a small menu bubble (thick fill on the platter), keys 57×44 | fill | 0 (inside the keyboard quad) | T1 |

Press: a key brightens and takes a 1 px inset shadow (it "goes down") on `interactive` 210 ms; keys never scale (they are fills on a platter, not glass controls). Appear: Steam's `keyboard_appear` kept, the platter materializes first (glass 0–92 %, keys 35–100 %).

Fields elsewhere in this area (friend code, achievements search, Select Game search) use the same 64 px recessed capsule and the same ring.

### 3.4 Your profile (`/account`)

Mockups: `p2_social-media_account.png`, `p2_social-media_account-end.png`.

The page keeps Steam's `GamepadPage` and fields; its content width becomes **760 px (570 pt) centred** through Steam's own `--gamepad-page-content-max-width` (T1, `!important` over the inline variable). That cuts the label-to-control sweep from 37° to 23°. It is a nested route: Back is a thin circle and search is the magnifier circle (§3.0). Its legend only ever holds A/B hints, so the glass is 1280×720 with the quiet legend inside it.

| Element | Steam node | Size | Position (page y) | Fill | Depth | Tier |
|---|---|---|---|---|---|---|
| Identity card | Field #1 (`%{CurrentUserProfileBackground}` video stays content) | 760×160, radius 30, a 35 % left-to-right dimming gradient over the video | (260, 100) | content | 0 | T1 |
| Avatar | `%{CurrentUserProfileBackground>Avatar}` | 112 circle (84 pt), state ring 3 px | card (28, 24) | content | **+10 mm** (0.0271 units), non-interactive in-place crop; not a target (§4.1) | T1, T4 |
| Name, status | `%{…>LabelHolder}` (Steam's `scale(1.4)` untouched) | name font 27 px × 1.4 ≈ 38 px Bold; status 20 px text-2 | card x 168 | — | 0 | T1 |
| View Profile | DialogButton | 60 capsule with ↗ | card right 28 | white .18 | 0 | T1 + T2 glyph |
| Your Status | Field + `%{DropDownControlButton}` | row 80 (60 pt); label 24 px, description 18 px text-2; dropdown 60 capsule "Online ▾" | platter (260, 276) | platter black .14, row pill on focus | 0 | T1 |
| Do Not Disturb | Field + `%{*GamepadDialogContent>Toggle}` | row 80; toggle **66×40** via the independent `scale: 1.75` (Steam's knob translation untouched) | same platter | green when on | 0 | T1 |
| Add Funds · Privacy Settings · Account Details | `%{FatButtonRow}` (a row of three: D-pad Left/Right) | 240×156 tiles (180×117 pt), radius 30; 48 px coloured circle icon (green / blue / grey), label 22 px Semibold, Steam's details 18 px text-2 (wraps to 2 lines), ↗ 22 px top-right | y 466, 20 px gaps | white .10 (raised) | 0 | T1 + T2 glyphs |
| Friend Code + Add Friends | Field + DialogButton | row 80; code 24 px tabular Semibold; capsule 60 | y 654 | platter | 0 | T1 |
| Account: Sign Out · Change Account | `%{ChangeAccountButtons}` | row 80, separated from the group above by 32 px; Sign Out 60 capsule **red label at rest**, red whole fill on focus; 24 px gap; Change Account 60 capsule | y 782 | platter | 0 | T1 |
| Legend | `#Footer` | quiet legend "A Select" / "B Back" inside the glass, y 628–712 | centred | none | 0 | T1 |

Status dropdown menu: WN §5.1 menu at +12 mm (click-safe), 80 px two-line rows (title 24 px, description 18 px), the current value checked.

### 3.5 Add a Friend (`/invites`)

Mockup: `p2_social-media_invites.png`.

The window glass is **off** on this route (SM-D4): page roots transparent, glassd's main cover excludes `/invites` (as it already excludes the transparent Home, `layers.json`). The page is one card, and every piece of chrome on the route lives inside it, so no Steam pixel shows outside a cover (NE §1).

| Element | Steam node | Size | Position (overlay) | Material | Depth | Tier |
|---|---|---|---|---|---|---|
| Card | `%{DialogContent_InnerWidth>InvitesList}` (its `#0e141b` becomes glass) | **720×672** (540×504 pt), radius 44 | (280, 40), to y 712 | `thick` (glassd cover shape on the transparent window; T1: smoky tint card) | 0 | T1, T5 |
| Back | `%{BackContainer}` (positioned into the card) | 60 circle in its 80 box | circle (304, 64) | thin | 0 | T1 |
| Search | `%{SearchAndTitleContainer}`, collapsed | 60 magnifier circle | circle (916, 64) | thin | 0 | T1 |
| Title | Steam's title node | Title 2 30 px Bold, centred on the card | centred on y 94 | — | — | T1 |
| Description | Steam's description node | 20 px text-2 | (320, 144) | — | — | T1 |
| Code field | Steam's input (default focus on arrival) | 464×64 capsule, 26 px tabular digits; the focus ring shows on arrival | (320, 188) | thick fill | 0 | T1 |
| OK | `%{…>SubmitButton}` | 156×64 blue tinted capsule, label stays "OK" (the screen's one primary) | (804, 188) (Right reaches it) | blue tint | 0 | T1 |
| Your Friend Code | `%{FriendCodeSection}` | recessed platter 640×112, radius 24; digits 40 px Bold tabular; caption "Your Friend Code" 18 px text-2 (title case) | (320, 280) | thick fill | 0 | T1 |
| Incoming invites | `%{IncomingInvites}` (`flow-children: grid`) > `%{InvitesRow}` (a Focusable) | header 22 px Semibold text-2 + count; rows 80 in a recessed platter (radius 30); avatar 48, name 24, detail 18 ("2 mutual friends") | from (320, 418) | platter black .14 | 0 | T1 |
| Row buttons | **Steam's own DialogButtons** in DOM order: **Block** (`#Button_Block`), **Accept** (`#Button_Accept`), **Ignore** (`#Button_Ignore`) [source P5] | Block a 60 circle with a red glyph (red whole fill on focus); 24 px gap; Accept and Ignore 60 capsules (thin), 20 px apart | row end | thin | 0 | T1 (no T2 nodes on this route) |
| Row actions without buttons | the row's `onMenuButton` (friend menu) and, only when mutual friends exist, `onOptionsButton` (view mutual friends) [source P5] | legend items "≡ Friend Menu", "Y View Mutual Friends" (Steam's strings) in the quiet legend while the row is focused, thin fill | legend | — | — | T1 |
| Outgoing invites | `%{OutgoingInvites}` > `%{InvitesRow}` with one DialogButton `#Friend_Invites_CancelInvite` | same rows; "Cancel Invite" 60 capsule | below the incoming platter (scrolls) | — | — | T1 |
| Legend | `#Footer` at overlay y 628–712 | quiet legend inside the card's bottom band | centred | none | 0 | T1 |

Numeric keypad for the code when SQ13 holds (T3); otherwise the full keyboard with the echo row "Enter a Friend Code". Gamepad: arrival on the field (Steam's default focus), Right to OK, Down into the invite rows, Left/Right across Block / Accept / Ignore, Up from the field to the header (search circle), B back.

### 3.6 Photos (`/media/grid`)

Mockup: `p2_social-media_photos.png`.

| Element | Steam node | Size | Position | Fill | Depth | Tier |
|---|---|---|---|---|---|---|
| Back | `%{BackContainer}` | 60 circle, borderless (section root) | (24, 24) | — | 0 | T1 |
| Title | WN's Large Title "Media" | 46 px Bold | x 100 | — | 0 | T2 (WN) |
| Search | `%{SearchBox}` | 520×64 capsule | centred on x 640 | thick | 0 | T1 (WN) |
| Media type filter | new segmented control: All · Screenshots · Clips · Recordings (Steam's four filter values) | 68 track, 60 segments, 22 px Semibold, selected white | (24, 106) | thick track | 0 | T3 (SQ6; §6) |
| Game filter | new capsule showing Steam's current game filter ("All Games ▾") with an X badge | 60 capsule | right 24, y 110 | thin | 0 | T2 (calls `%{TopList}`'s own `onSecondaryButton`, P3) |
| Grid | `%{ScreenshotList}` (virtualized; rows, heights, `--listTotalHeight` untouched) | slots 405×228 at x 26 / 439 / 853, 236 px pitch (Steam's) | from y 192 | — | — | — |
| Thumbnail | `%{ListItemThumbnailImg}` inside `%{ListItemAndGlowContainer>ListItem}` | inset 8 px in the slot: 389×212 (292×159 pt), radius 20, `object-fit: cover`; gaps 24 | — | content | 0 | T1 |
| Focused / hovered tile | `ListItem.gpfocus`, `:hover` | lift: independent `scale: 1.05`, shadow `0 18px 44px /.48`, soft white glow 30 px, diagonal sheen; Steam's white 2 px border off; Steam's 50 px blur glow becomes transparent | — | — | **+15 mm** (0.0407 units), non-interactive in-place crop that follows focus/hover (click-safe, §4.1) | T1, T4 |
| Clip duration | `%{…>DurationText}` | 36 tall dark capsule, play glyph + 18 px Semibold tabular | tile bottom-right 12 | black .52 | — | T1 |
| Tile "⋯" | new node on the hovered/focused tile | 60 clear circle, inset 12 from the thumbnail's top-right corner | — | clear (black .32 + blur) | (rides the tile) | T2 (SM-D15: calls the tile's own `onMenuButton`, P5) |
| Multi-select | `%{…>Selected}`, `%{…>CheckboxContainer}` | a 36 px blue check circle top-left, tile brightness .85 | — | — | — | T1 |
| Bottom ornament | `#Footer` | "X Select Game" · "Y Filter" · "≡ Options" · "A Select" · "B Back" | centred | liquid | 0 | T1 |

Filters modal (Y): WN §5.4 sheet (thick, radius 44, 640 wide), click-safe depth +12 mm with the window dimmed by the `t1` tint (SP §5 [PROVEN]) instead of the +30 → +50 mm move; "Filters" Title 3 28 px, "Media Type" subheader in title case, the four choices as 72 px rows with a check on the active one (the radio group laid out as a column only if it has no explicit `flow-children`: verify with `L.pad`), Close as a 60 capsule. Select Game menu (X): WN menu 480 wide at +12 mm, its "Search games…" field a 64 px recessed capsule at the top, game rows 72 px with 40 px rounded game icons. `/media/list` (M17) is restyled with the same tokens (date headers Title 2 30 px, thumbnails radius 16) and stays route-only.

Performance: no `backdrop-filter` on tiles; replacing Steam's blurred glow with a shadow removes the one blur filter per focused tile (SM top finding 10).

### 3.7 Photo viewer (`/media/item/screenshot/:id`)

Mockup: `p2_social-media_viewer.png`.

| Element | Steam node | Size | Position | Material | Depth | Tier |
|---|---|---|---|---|---|---|
| Photo | `%{FocusedScreenshot}` | aspect-fit in the glass: **1166×656** for 16:9, radius 40; the image container's own black fill and inset shadow off | x 57–1223 | content | 0 | T1 |
| Window tint behind the photo | — | glass tint raised to .45 | — | `window` | 0 | T1/T5 |
| Room | — | black .30, in over ≥ 0.5 s on `sheet-in`, out on `sheet-out` | behind the window | glassd dim shape | — | T5 (SM-D6) |
| Top band | — | 35 % dimming gradient, 132 px | over the photo | content dim | — | T1 |
| Back | `%{BackContainer}` | 60 circle | (24, 24) | `clear` + black .18, CSS shadow 0 4 14 | **0** | T1 |
| Trash, Share | `%{ScreenshotFormActions}` (`%{TopList>IconButton}` trash, then "Share"; DOM order kept) | trash 60 circle with a **red glyph**; 24 px gap; Share 144×60 capsule with a share glyph (T2) | trash (948, 24), Share (1032, 24) | `clear` | **0** | T1 |
| Search | `%{SearchAndTitleContainer}`, collapsed | 60 magnifier circle | (1196, 24), 20 px after Share | `clear` | **0** | T1 (WN hero variant) |
| Metadata | `%{Metadata}` (Steam's string kept) | 18 px text at .82 with a text shadow | bottom-left (92, 584) | — | 0 | T1 |
| Previous / next | `%{ChangeItem}` (clickable divs, not Focusables) | 60 clear circles, **visible whenever the controls are** (SQ8), LB / RB badges 30 px below | x 16 and 1204, y 298 | `clear` | **0** | T1 |
| Bottom ornament | `#Footer` | "Y Hide" · "A Select" · "B Back" | centred | `clear` + 22 % black | 0 | T1 |

**Crop budget 0.** Every control here is clear glass over the photo; a crop of its rect would carry the photo's pixels to the crop's depth and cut a hole in the base layer under it (SM-D12). The controls read as lying on the picture, which is how visionOS draws player and viewer controls. The share sheet (M9) is the one exception allowed to pop: it is thick, frosted glass whose texture carries its own 30 px frost, so its crop contains no sharp photo pixels (+12 mm, 1 crop while it is open).

Share sheet (M9): WN menu 440 wide at +12 mm: Share on Steam…, Copy to Clipboard, Save Image…, Send to Phone… as 72 px rows; "Share to a Chat" (title case, 22 px Bold text-2); the chat row as 60 px avatar circles with 18 px names below (All chats first); Cancel last.

Motion: open from the grid with `page` 662 ms (fade + ≤ 16 px parallax, zoom ≤ 1.5 %); controls show/hide (Y) `materialize-in` 250 / `materialize-out` 350 ms; previous/next cross-fade on `fade` with 16 px parallax in the travel direction; the room dim on `sheet-in` / `sheet-out` in glassd.

### 3.8 Clip player (`/media/item/clip/:id`)

Mockup: `p2_social-media_clip.png`.

| Element | Steam node | Size | Position | Material | Depth | Tier |
|---|---|---|---|---|---|---|
| Video | `%{VideoPlayerContainer}` | aspect-fit 1166×656, radius 40 | centred | content | 0 | T1 |
| Back, search | header | as §3.7 | (24, 24), (1196, 24) | `clear` | 0 | T1 |
| Playback platter | `%{GamepadTimelineContainer}` (its gradient and 5 px blur replaced) | 1200×192 (900×144 pt), radius 44, CSS shadow 0 6 20 | (40, 420), 16 px clear of the ornament | `clear` + black .26 | **0** | T1 |
| Timeline | `%{*LoadingTimeline>…}` layers (**inline `translateX`/width untouched**) | 12 px track in an 80 px hit band; recording range white .32, played white .92; playhead SVG recoloured white 32 px; ticks white .22; date label 18 px text-2 | platter top | fills | — | T1 (paint only) |
| LT / RT | `%{TriggerGlyph}` | 44 px glyph circles at the track ends | — | white .18 | — | T1 |
| Transport | `%{PlaybackControls>PlaybackButton}`, `%{JumpSecondsButton}` ×2, `%{…>PlayButton}`, FrameStep | frame step 60 (disabled 40 %), −10 s 60, **play/pause 70 white** (52.5 pt), +10 s 60, frame step 60; centres 80 apart | centred row | thin / white | — | T1 |
| Markers, recordings | `%{AddMarkerCtn}`, `%{ViewRecordings}` | 60 circles, no fill at rest | left of the row | — | — | T1 |
| Time | `%{PlayTimeRow}` | "0:03 / 0:46" 22 px Semibold tabular, total in text-2 | after the left circles | — | — | T1 |
| Clip, Share | `%{…>CreateClipButton}`, `%{…>ShareButton}` (Steam's `::before` shadows untouched) | 60 capsules with glyphs | right of the row | thin | — | T1 |
| Bottom ornament | `#Footer` | "**X Delete Clip**" (red label) · "Y Hide" · "≡ Share" · "A Pause" · "B Back" | centred | `clear` | 0 | T1 |

**Crop budget 0** (SM-D12). Room dim as in §3.7. The red legend label must pass `audit` CONTRAST over the three test rooms; if it fails over bright video, it becomes white with a red glyph badge.

### 3.9 Downloads (`/library/downloads`)

Mockup: `p2_social-media_downloads.png` (active state; verified on Steam's own component in the lab route, §8.3: no real download is allowed).

| Element | Steam node | Size | Position | Fill | Depth | Tier |
|---|---|---|---|---|---|---|
| Back, title, search | header (section root) | borderless Back; Large Title "Downloads" 46 px at x 100 (≈ 250 px wide, it ends before x 380); **520 px search centred on x 640** (same as every section root) | toolbar row | — | 0 | T1, T2 (WN) |
| Now Downloading card | `%{DownloadsPage>TopSection}` (240 px) with `%{DownloadSectionActiveItem}` | **208 px** platter (156 pt), radius 30 (54 − 24) | (24, 108) | black .14 | 0 | T1 |
| Idle band | the same, while `%{DownloadsPage>Empty}` | **96 px**: "No downloads in progress" 22 px text-2 and the device capsule | (24, 108) | black .14 | 0 | T1 (SQ9) |
| Art | `%{DownloadGameIcon}` / hero | 316×176, radius 20 | card (16, 16) | content | 0 | T1 |
| Name, status | `%{GameIconAndName}` | caption 18 px text-2 ("Downloading update"), name Title 2 30 px | x 360 | — | — | T1 |
| Progress | `%{ActiveItemProgressBar}` + `%{ProgressPercentageAndBar}` | 480×12 track, white .9 fill, percentage 22 px tabular | x 360, y 116 | thick track | — | T1 |
| Rate, time left | `%{DownloadTimeRemaining}` | 18 px text-2 tabular | x 360, y 146 | — | — | T1 |
| Pause / Resume | `%{PauseResumeButton}` | 60 circle, the screen's primary | card top-right | white .18 | **+10 mm** (0.0271 units), non-interactive in-place crop (click-safe for a 60 px circle, §4.1) | T1, T4 |
| Throttle | `%{Throttle}` | 60 capsule "Unthrottled ▾" when present | under Pause | thin | 0 | T1 |
| Device | `%{RemoteClientManagementRow}` ("Managing downloads for This Device") | 60 capsule: display glyph, "This Device", chevron, Y badge; Steam's text kept in title case | card bottom-right | thin | 0 | T1 |
| Section header | `%{DownloadsPage>SectionTitle}` | Title 2 30 px Bold + count 24 px text-3; no rule; "Auto-updates enabled" 18 px text-2 with a clock glyph | x 40 | — | — | T1 |
| Row | `%{SectionItemWrapper}` (`flow-children: row`) > `%{SectionItem}` (row tilt transforms untouched) | **96 tall** (72 pt) + 8 gap; art 144×68 radius 12; name 24 px Semibold; details 18 px; status 18 px tabular, title case | x 24–1256 | none; focus pill | 0 | T1 |
| Row buttons | `%{DownloadsPage>PlayButton}`, `%{RemoveFromQueue}`, Download Now | 60 circles, centres 80 apart; **Download Now blue whole fill**; Play thin; remove ✕ thin | row end | — | — | T1 |
| Row "⋯" | new node on the hovered/focused row | 60 circle (the slot is reserved on every row, shown on hover/focus) | row end | thin | — | T2 (SM-D15: calls the row's `onMenuButton`; the row's `onContextMenu` rejects synthetic events, P5) |
| Clear All | `%{RemoveAllButton}` | 60 capsule | section header end | thin | — | T1 |
| Bottom ornament | `#Footer` | "Y Change Device" · "≡ Options" · "A Go To Game Page" (or "Download Now") · "B Back" | centred | liquid | 0 | T1 |

Options menu (D6): WN menu at +12 mm, Steam's order kept: **Uninstall first and focused, red label at rest** (red fill on focus), Remove from List, View in Library, Add to Favorites, Add to ›, Manage ›, Developer ›, Properties…, Cancel. It is taller than the modal box at 72 px rows, so it scrolls with Steam's 72 px scroll padding and a bottom scroll edge.

Motion: the card's height change (idle ↔ active) is Steam's re-render; the progress fill width is data (it moves while downloading, which is not "motion at rest"). The Pause crop appears with the card and its depth is pushed once (no animation).

### 3.10 Store and web views (`/steamweb`, `/externalweb`)

Mockup: `p2_social-media_store.png`.

**Plan A (default): a navigation ornament above the window.**

| Element | Steam node | Size | Position | Material | Depth | Tier |
|---|---|---|---|---|---|---|
| Ornament margin | — | the top 96 px of the overlay are outside the glass | y 0–96 | — | — | T1 |
| Window glass | page roots | **1280×560**, radius 54 | y 96–656 | `window` (glassd cover shape excludes the strip) | 0 | T5 / T1 |
| Navigation ornament | `%{HeaderBrowser}` > `%{MainBrowserContainer>URLBar}` | 752×84 capsule (564×63 pt), centred, 12 px above the glass | y 0–84 | `liquid`: a glassd slab behind Steam's transparent capsule (inset method, SP §2.5 option 1) / T1 backdrop blur + shadow | **0** (outside the cover: no crop, NE §1) | T1, T5 |
| Back, Forward, Reload | `%{MainBrowserContainer>NavigationButton}` ×3 (DOM order kept) | 60 circles, no fill at rest; Forward disabled at 40 % | ornament start | — | — | T1 |
| Address | `%{MainBrowserContainer>StatusIcon}` (lock) + `%{MainBrowserContainer>URL}` (Steam's string) | recessed 60 capsule, lock 20 px, URL 20 px at white .72 | ornament end | thick | — | T1 |
| Editable URL | `%{URLInput}` | same capsule; focus = the ring | — | thick | — | T1 |
| Web view | `%{MainBrowserContainer>Browser}` (separate browser view) | inset 16 px: **1248×500 at (16, 112)**, ending 16 px above the page bottom (628); top corners rounded r 38 by glass-tinted corner fillets **if** the view composites under the DOM (`%{AllowUnderlay}`), else square corners inset 24 px | — | content, untouched | 0 | T1 |
| Bottom ornament | `#Footer` (its opaque black `%{PopupBody>Opaque}` becomes liquid glass) | "Y Add to Cart" (cart glyph) · "≡ Store Menu" · "A Select" · "B Back" | centred | liquid | 0 | T1 |

**Why Plan A is feasible:** Steam's browser host sets the view's bounds from the container's `getBoundingClientRect()` in a layout effect (`SetBounds(x, y, width, height)`) [source P2], so a T1 layout that starts the container at y 112 moves the web view with it.

**Persistence (fixes the critique):** the host re-reads the rect only when it renders. So `lgs on` and `lgs off` both end with a **bounds refresh**: after the CSS is added or removed and two frames have passed, T3 finds each mounted browser host from the `%{MainBrowserContainer>Browser}` element's fiber and makes it render once through its own state (the class component's `forceUpdate`, or a no-op state set on the function component's own hook), so Steam's own layout effect calls `SetBounds` with the new rect [PLAUSIBLE]. If no such path exists, the refresh replaces the route with itself (`inst.Navigate(path, true)`), which remounts the host and reloads the page at the right size [PLAUSIBLE]. If neither works, Plan A is not used while a web view is open: the ornament layout is applied only to web views opened after `lgs on` (T2 marks them), and `lgs off` with a marked view open first navigates Back. A Steam restart or reboot always gives the stock rect. §8.2 tests it.

**Plan B** (if the rect does not follow): WN's in-row browser mode (WN §3.2: a 640×64 recessed capsule centred in the 108 px toolbar row), if CQ1 holds. **Plan C** (minimum): the 40 px header holds 44 px glass circles at an 80 px pitch (DESIGN2 §4 "mini circle, alone, 80 px clear region") and the URL capsule; plus the frame-height lever (SP §7 [PROVEN]).

Store and profile **web content is never styled** (SM SQ11: separate CDP target, out of scope). The store menu (S6) is drawn by the web page itself, so it never needs a crop (crop budget 0).

### 3.11 Achievements (`/library/app/:appid/achievements/my/individual`)

Mockup: `p2_social-media_achievements.png`. The page is owned by `game-pages` C.9; this is the shared-token rendering it should match. Recommendation to game-pages: nested-route search circle and the quiet legend (glass 1280×720), since its legend only carries A/B.

| Element | Steam node | Size | Fill | Tier |
|---|---|---|---|---|
| Portrait | page header art | 112×168, radius 20 | content | T1 |
| Title | game name | Title 1 38 px, caption "Achievements" 20 px text-2 above | — | T1 |
| Stats block (focusable) | `AP4` block | 640×12 progress capsule (white .9 fill) + one line 20 px text-2: "4 of 26 earned · 10.2 hrs played · 53 min in the last two weeks" (Steam's values, title case) | thick track | T1 |
| Leaderboards | dropdown (200×40 today) | 60 capsule with a trophy glyph | thin | T1 |
| My / Global | tab strip (explicit Left/Right handlers: stays horizontal, GP §0.5) | 68 track, 60 segments, selected white | thick track | T1 |
| Search | 220×40 field (the page's own achievement search, not the global search) | 380×64 recessed capsule | thick | T1 |
| Rows | achievement rows (80 px today) | **88 tall** (66 pt) + 8 gap, recessed black .14, radius 24; icon 64 rounded square r 14; name 24 px Semibold; description 20 px text-2; unlock date 18 px text-2; rarity "22.4 % of players" 18 px text-3 with a 160×8 recessed bar (Steam's width, recoloured) | black .14 | T1 |
| Locked header | "LOCKED ACHIEVEMENTS" | "Locked" 22 px Semibold text-2 + count (title case; Steam's string casing via CSS only) | — | T1 |
| Locked rows | — | icon grayscale .55, a 22 px lock glyph | — | T1 |

Compare with a friend (AP6/AC2) keeps its route only; a "Compare Achievements" entry in the friend menu is a possible T3 addition that this concept does **not** add (it would be a new entry point needing approval).

### 3.12 Notifications (toasts) and the achievement toast

No mockup here (WN §5.5 owns the toast card; the QAM list belongs to the system concept, DESIGN2 §3.6).

| Element | Steam node | Size (popup px, m = 0.90) | Material | Tier |
|---|---|---|---|---|
| Toast card | `notifications` quad 340×80 | WN §5.5: 320×76 card, radius 30; 48 px circular avatar or app icon; title 20 px Semibold, body 18 px | `panel` | T1, T5 |
| Incoming call | same | green whole fill, white text, a 48 px headset circle | tinted | T1 |
| Achievement | same | 48 px **rounded-square** achievement art (r 12); "Achievement Unlocked" 20 px Semibold; name 18 px; count as a blue 28 px capsule | `panel` | T1 |
| SteamVR toast | `notificationtoast.html` | same card (owner: steamvr theme) | `panel` | T1 |
| QAM rows (N4) | `%{*PanelSection>QuickAccessNotifications}` | 72 popup px cards, 6 px apart, no 1 px dividers, 40 px icon, unread dot | fills on the tile | T1 (system concept) |

Motion: WN §5.5 (materialize in place 250 ms with a −8 → 0 px settle on `snappy`; out 350 ms; Steam's `toastExitVR` kept).

---

## 4. Depth plan for this concept

### 4.1 The click-safe rule (ships without a wearer)

A pop is a crop of Steam's texture placed in front of the window. Two facts from the capability work decide where one may go:

- **Ghosts** (NE §1). Where Steam's real panel is not under an opaque glassd cover, it shows its own pixels at z 0 and the crop doubles them about 20–25 px off-axis. Pops are therefore allowed only inside the window cover (and the `/invites` card cover), and only in the native tier. The CSS-only tier has no pops at all.
- **Parallax** (SP §2.4). The click on an interactive crop is [PLAUSIBLE] and needs a wearer (SP §12). A non-interactive crop lets the laser pass through to Steam's panel behind it, so the hit lands `dz · tan θ` away from what the user sees: at θ = 45°, the offset equals dz.

**Rule:** a non-interactive pop is click-safe when `dz · tan 45° ≤ ¼ × the smallest dimension of the smallest target under the crop`. An aim anywhere in the central half of that target then lands on it at laser angles up to 45° (at 30°, the offset is 58 % of that). Because both the crop depth (units × S × r) and the CSS pixel (∝ r) scale with the user's resize factor, the rule is the same at every window size. In scene units: **`dz_units ≤ 0.000521 × min(w, h)_css px`** (1 CSS px = 1.5 texture px × M = 0.0020833 units).

| Pop | Smallest target under the crop | ¼ of it | Max dz | **Ships at** | Units (r = 1) | Error at 45° / 30° |
|---|---|---|---|---|---|---|
| Menus, dropdowns, Select Game, Options, share sheet | 72 px row (55 mm) | 18 px = 13.8 mm | 13.8 mm | **+12 mm** | 0.0325 | 15.6 / 9.0 px |
| Filters sheet (Photos) | 72 px row | 13.8 mm | 13.8 mm | **+12 mm**, window dimmed by the `t1` tint (SP §5 [PROVEN]) | 0.0325 | 15.6 / 9.0 px |
| Focused or hovered media tile | 212 px tile (163 mm) | 40.8 mm | 40.8 mm | **+15 mm** | 0.0407 | 19.5 / 11.3 px |
| Pause / Resume on the Now Downloading card | 60 px circle (46 mm) | 11.5 mm | 11.5 mm | **+10 mm** | 0.0271 | 13.0 / 7.5 px |
| Identity avatar (`/account`) | not a target (the identity Field under it is 160 px) | 30.8 mm | — | **+10 mm** | 0.0271 | — |

Paired cues: shadow sized by depth (DESIGN2 §3.8: 0.4 px y and 1.2 px blur per mm): menus 5/14 px, tile 18/44 (its lift shadow), Pause and avatar 4/12. Hover and press feedback are drawn by Steam inside its texture, so they show in the crop on the element that will actually receive the click; a mis-aim is visible before it happens, and the UI stays usable if the laser dot is hidden behind a crop (NE §5).

**What stays at 0 mm:** the window, rows, bubbles, fields and platters (DESIGN2 §3.8); every ornament or chrome element outside the cover (the bottom ornament, the store's navigation ornament, and nothing on `/invites` because its chrome is inside the card); every control over media (viewer and clip controls, the playback platter). A popped element must carry its own frost or be opaque in Steam's texture, so a crop never lifts sharp page or media pixels.

**Other stereo on these screens, not crops:** WN's tab bar at +25 mm (the popup's own transform), the keyboard keys 10 mm in front of their glassd platter, glassd slabs and the room dim.

### 4.2 Crop budget per screen (checked with `__LGS_SG.dump()`)

| Screen | At rest | With a menu or sheet open |
|---|---|---|
| People (`/chat`) | 0 | 1 (friend menu) |
| Profile (`/account`) | 1 (avatar) | 2 (+ status dropdown) |
| Add a Friend (`/invites`) | 0 | 1 (friend menu from an invite row) |
| Photos (`/media/grid`) | 1 (focused tile) | 2 (+ Options menu, Select Game menu or Filters sheet) |
| Photo viewer | 0 | 1 (share sheet) |
| Clip player | 0 | 1 (share menu) |
| Downloads | 1 (Pause, only while a download is active) | 2 (+ Options menu) |
| Store, web views | 0 | 0 (the store menu is web content) |
| Achievements (game-pages) | 0 | 1 (Leaderboards dropdown) |

Totals stay far under DESIGN2's 80 mm cap; animated deltas ≤ 20 mm; crops stay at their original x/y (DESIGN2 §3.8). Crops are pushed only when they change (SP §4.2).

### 4.3 The upgrade after the wearer check (not in the default build)

When SP §12's two checks pass (a click on an in-place interactive pop lands on the right row at a steep angle; the laser dot is visible), menus and dropdowns move to **+30 mm** interactive crops growing from the source's depth, sheets to **+30 → +50 mm**, and Pause to **+15 mm**. The bottom and store ornaments stay at 0 mm unless WN Q11's ghost-free path is also proven (§9 Q13).

---

## 5. Motion summary (DESIGN2 §11 tokens only)

| Interaction | Token | Notes |
|---|---|---|
| Hover in / out on rows, tiles, buttons | `hover-in` 294 ms / `fade` 441 ms | light spot follows the pointer; sidebar rows get the spot without a fill |
| Gamepad focus | first frame ≥ 60 %, then `hover-in` | no travelling indicator; rows never scale |
| Press (glass circles and capsules) | `interactive` 210 ms swell ≤ ×1.06, release `snappy` 488 ms | rows, keys and tiles brighten only |
| Segmented selection (friends tabs, media types, My/Global) | pill travel `snappy` 488 ms, position only (equal segments) | labels swap colour at t90 |
| Navigation selection pill (open conversation) | cross-fade `fade` 441 ms | — |
| Row "⋯", tile "⋯", controls show/hide | `materialize-in` 250 ms / `materialize-out` 350 ms | content 35–100 % |
| Menus (friend, status, Select Game, Options, share) | `morph-open` 607 ms (b20) / `morph-close` 441 ms; depth 0 → 12 mm on `depth` 441 ms | grows from the source rect |
| Filters sheet | `sheet-in` 735 ms / `sheet-out` 514 ms; depth 0 → 12 mm on `depth`; window `t1` tint on `fade` | parent stays, dims |
| New chat message | `fade` 441 ms + 8 px rise, stagger 30 ms, ≤ 5 rows | never on history loads (R5) |
| Route changes (People ↔ Media …, grid → viewer) | `page` 662 ms, fade + ≤ 16 px parallax | within Steam's 800 ms route budget |
| Focused tile depth | `depth` 441 ms, 0 → 15 mm | push 60/s only while moving |
| Pause and avatar depth | pushed once when the element appears | static |
| Room dim (viewer, clip) | `sheet-in` / `sheet-out` in glassd | ≥ 0.5 s, black ≤ .30 |
| Keyboard key press | `interactive` 210 ms brighten + inset shadow | keep Steam's `Touched` shine |
| Toasts | WN §5.5 | in place, no slide |
| Reduce Motion | fades only (150–200 ms), no parallax, no depth animation (end value pushed once) | DESIGN2 C8 |

At rest `document.getAnimations().length === 0` on every route here (Steam's `SnoozeZ` and typing banner are event-driven, not idle).

---

## 6. Implementation tiers and the evidence for each

### 6.1 Probes made for this concept (read-only, 2026-10-07, Steam build `11094443`)

| # | What | Result | Used for |
|---|---|---|---|
| P1 | `glass.py outline main --route /chat --sel .friendlistListContainer` and `styles` on its containers; source scan for `friendCategoryContainer` (module **20447**) | Rows are **static block flow**, rendered one by one in a `CSSTransition` group (`friend-anim`, 320 ms); **no virtualization**. Each row's `onGamepadFocus` calls `UIStore.ShowFriendChatDialog(browserContext, accountid, true, true)`; rows of the sidebar's invite group use `onOKButton` Accept, `onSecondaryButton` Block, `onOptionsButton` Decline [source] | Row height 42 → 72 is a safe T1 change (SM SQ1 answered); SM-D9 |
| P2 | Source scan for the browser host (`SetBounds` + `BrowserView`, module **5689**) | A `useLayoutEffect` reads the container's `getBoundingClientRect()` and calls `SetBounds(x, y, width, height)` when the rect changes [source] | Store Plan A (§3.10) |
| P3 | Source of the media grid's top Focusable (module **50165**) | `%{TopList}` is a `flow-children: column` Focusable with `onOptionsButton` (opens the Filters modal) and `onSecondaryButton` (Select Game) [source] | The game capsule and the filter segment call Steam's exact handlers |
| P4 | `g_FriendsUIApp` in SharedJSContext | Stores present: `m_FriendStore` (with `m_FavoritesStore`), `m_ChatStore`, `m_UIStore` (`ShowFriendChatDialog` is a function), `m_VoiceChatStore` … [measured] | Optional T3 favourites grid; T2 current-conversation marker |
| **P5** | Source scans (no `require`, no state change) of the modules that render invite rows, friend rows, download rows, media tiles and chat history | **(a)** `/invites` (module **71251**): each incoming `%{InvitesRow}` is a Focusable that renders the friend plus **three DialogButtons with `onClick`: `#Button_Block`, `#Button_Accept`, `#Button_Ignore`, in that DOM order**; `onMenuButton` opens the friend menu; `onOptionsButton` ("#Friend_Invites_ViewMutual") exists only when mutual friends exist. Outgoing rows render one DialogButton `#Friend_Invites_CancelInvite`; the outgoing container is `flow-children: grid`. **(b)** Friend rows (20447): in gamepad UI `onContextMenu` and `onMenuButton` are both `OnShowContextMenu(event)`, which builds the menu for that row's friend. **(c)** Download rows (module **11698**): `%{SectionItemWrapper}` is a `flow-children: row` Focusable with `onMenuButton` (shows that item's Options menu) and an `onContextMenu` that **returns early for untrusted events** (`if (!ev.isTrusted)`); the active item `DownloadSectionActiveItem` is in the same module. **(d)** Media tiles (module **64086**): `ListItem` has `onMenuButton` and `onContextMenu` bound to the same handler. **(e)** Chat history (module **24032**): `ChatMessageBlocks` and `ChatMessageBlock` class components (props `block`, `bIsInitialBlock`, `bShowTimePasses`, `friendRenderContext`); the typing notification is in module 5241 [source] | §3.5 (no T2 on invites); SM-D15 ("⋯" mechanism); §8.3 fixtures |

No route, setting or friend state was changed by these probes; the scans use `Function.prototype.toString` on factories after a chunk push and never `require` a module (SR §3.1 rule). Module ids are for checking only; the build uses source-text finders (SR §3.2).

### 6.2 Tier per element

| Element | Tier | Evidence it is feasible | Fallback |
|---|---|---|---|
| Transparent page roots, window glass (656 / 720) | T1 + T5 | Phase 1 theme; glassd covers and shapes [PROVEN-P1, SP §11.1]; the window cover renders live (NE) | T1 smoky tint (DESIGN2 §6.3); `p2_social-media_people-t1.png` |
| Toolbar geometry, collapsed search circle | T1 | WN §3.2 (its AT-3/AT-4 gate the circle) | WN's full capsule in the thin/clear variant |
| Bottom ornament, quiet legend | T1 + T5 slab | WN §3.4: footer height measured by Steam; slabs [PROVEN-P1]; the quiet legend is a route-scoped paint rule on the same node | Capsule ornament on every route (WN default) |
| Friends sidebar 456 px, 72 px rows, segments, bubbles, compose | T1 | Not virtualized (P1); D-pad layout read from computed CSS (GP §0.5); the tab row stays a row of equal flex items in DOM order | Keep 300 px sidebar with 72 px rows (the width is the part most likely to fight `.SteamDeckChats`) |
| Header nodes in the `/chat` sidebar and in the `/invites` card | T1 | Header is an absolutely positioned overlay element (`%{Profile>Header}`, SN A.1); Main's `onMoveUp` still reaches it; position-only change | Header stays in WN's toolbar row and the sidebar/card start below it |
| Segment labels | T2 | Decorative text nodes appended inside each `FriendsListTab`; text from Steam's own localized strings for the tab headers (the tokens the `TabPanelHeader` uses, found by source text in module 20447) [PLAUSIBLE] | Steam's tab SVG icons in the same equal segments (the title above names the selected tab) |
| Compose placeholder "Message" | T2 | Attribute on Steam's input; React does not rewrite an unchanged prop | Steam's string (ellipsized) |
| Open-conversation pill (`lgs-current`) | T2 | Fiber props of `.friend` (accountid) and `%{ChatTab}` read as in SR §3.3; `m_ChatStore` present (P4) [PLAUSIBLE] | No persistent pill (focus pill only) |
| Row "⋯" (friends, downloads, media tiles) | T2 | The host row's own `onMenuButton` from its Focusable fiber props, called with an event-like object whose `currentTarget`/`target` is the row (the gamepad path, which every row has) [source P5; the call itself PLAUSIBLE]; friend rows also accept a dispatched `contextmenu` (no `isTrusted` guard), download rows do not. The node stops `pointerdown`, `mousedown`, `mouseup` and `click` in the capture phase so the row never opens its chat or page | The legend's "≡ Options" button (always present) |
| Invite Block / Accept / Ignore, Cancel Invite | T1 | Steam's own DialogButtons (P5a) | — (nothing to fall back from) |
| Media type segmented control | T3 | SR §1 [PROVEN] for Steam components; the filter state is Steam's (`listSource.type`, `onFilterChange` in module 50165) [source]; setting it directly is [PLAUSIBLE] | A "Filter: All ▾" capsule that calls `%{TopList}` `onOptionsButton` (opens Steam's modal) [source P3] |
| Game filter capsule | T2 | Calls `%{TopList}` `onSecondaryButton` from the node's props [source P3] | Legend "Select Game" button |
| Thumbnail inset and crop, lift | T1 | Image is content inside an unchanged hit slot; independent `scale` composes with Steam's transform (DESIGN2 R3) | No inset (8 px gaps) |
| Viewer arrows visible with the controls | T1 | `%{ChangeItem}` opacity is CSS (SM SQ8); clickable divs, not Focusables, so gamepad focus is unaffected | Hover-only arrows + LB/RB badges on the legend |
| Account column 760 px | T1 | Steam's own `--gamepad-page-content-max-width` | Full width with platters max 760 |
| Toggle 66×40 | T1 | Independent `scale` on the toggle (SY C.0, DESIGN2 §7.11) | Row target only (gamepad A on the row) |
| `/invites` windowless card | T1 + T5 | SP E6 transparent window [PROVEN visually]; glassd `shapes` [PROVEN-P1] | Window glass on, card as a recessed platter inside it |
| Downloads hero 240 → 208 / 96 | T1 | `%{DownloadsPage>Empty}` / `>Active` classes exist (inventory §5); `:has()` in Chromium 126 | Keep 240 px with the new card layout |
| Store navigation ornament (Plan A) | T1 + T5 | Browser bounds from the DOM rect [source P2]; ornament margin + slab behind (SP §2.5 option 1); no crop | Plans B and C (§3.10) |
| Store bounds refresh on `lgs on/off` | T3 | Fiber access as in SR §3.3; Steam's own layout effect does the `SetBounds` [PLAUSIBLE] | Route replace; else Plan A only for views opened after `lgs on` (§3.10) |
| Click-safe pops (menus +12, tile +15, Pause +10, avatar +10) | T4 + T5 cover | In-place crops render where placed [PROVEN, SP E15]; non-interactive crops pass the laser through (SP §2.4, its parallax table is the basis of §4.1); push animation [PROVEN] (SP §4.2); covers hide Steam's panel under them (NE) | Push dz 0 (shadows only) |
| Interactive pops (+30 menus) | T4 | Registration [PROVEN], click [PLAUSIBLE] (SP §2.4, §2.6) | The click-safe depths (default) |
| Sheet dim for the Filters modal | T4 | `t1` tint [PROVEN] (SP §5) | Scrim .35 in CSS |
| Room dim behind viewer/player | T5 | glassd draws arbitrary surfaces [PROVEN-P1]; a dark shape behind the window is new work [PLAUSIBLE] | No dim |
| Keyboard echo row, key block move | T2 + T1 | SM SQ4 [UNPROVEN]; the keyboard is a Steam window themed by Phase 1 | Echo in the keyboard's bottom band without moving keys; else no echo |
| Context Enter label | T3 | SM SQ5 [UNPROVEN] | "Enter" |
| Keyboard platter | T5 | glassd slabs [PROVEN-P1]; keyboard transform readable (`ovprobe`, SM §0.3) [PLAUSIBLE] | Keys over the Phase 1 tinted keyboard background |
| Numeric keypad for the friend code | T3 | SM SQ13 [UNPROVEN] | Full keyboard + echo label "Enter a Friend Code" |
| Favourites avatar grid | T1 or T3 | T1 if the Favorites panel is flow (fixture check); T3 from `m_FavoritesStore` + `ShowFriendChatDialog` (P4) [PLAUSIBLE] | Favourites as 72 px rows like Friends |
| Lab route for fixtures (`/library/lgs/lab`, tests only) | T3 | Route add [PROVEN] (SR §3.4, 19/19 selftest); finders by source text (SR §3.2) for the P5 components | Static fragments labelled unverified (§8.3) |
| Toast cards | T1 | WN §5.5; Phase 1 toast mock host (`hud.md` §4.3) | — |

Everything is in memory: T1/T2 rules and nodes come and go with `lgs on/off`; T3 views under `/library/lgs/…` with `install()`/`remove()` and an error boundary (SR §3.9, §7); T4 nodes are retired on removal (SP §9 rule 1); glassd runs in the transient `lgs-shell` unit; the store's bounds are refreshed on both `on` and `off`. A Steam restart or reboot returns stock UI.

---

## 7. Function retention table

Every function from `audit/social-media.md` §A (F, I, P, N, M, D, S, AC, K), the achievements page functions from `audit/game-pages.md` §A.10 (AP), and the four shell functions these screens re-place (H1, H2/H3, H6, LEG). **"Same"** means the existing Steam path is unchanged. Nothing is dropped; nothing is reachable by hover alone.

| # | Function | New place | Laser path | Gamepad path | Tier |
|---|---|---|---|---|---|
| F1 | Switch Favorites / Friends / Groups / Recent | Four equal labelled segments (106×60, hit 106×80) in the sidebar; L1/R1 badges on the track ends | Click a segment (was 24×30) | L1 / R1; or Up to the tab row + Left/Right + A (same) | T1, T2 labels |
| F2 | Add a Friend (→ `/invites`) | 60 circle, title row (372, 104) | Click | Focus + A (same) | T1 |
| F3 | Open pending invites | 60 circle with red count badge, title row (292, 104) | Click | Focus + A | T1 |
| F4 | Create Group Chat | Groups tab: title-row circle and empty-state 60 capsule | Click | Focus + A | T1 |
| F5 | Collapse / expand a group | 72 px group header with a chevron | Click the header | A ("Collapse") | T1 |
| F6 | View Game in Library (in-game group) | Legend button "Y View Game in Library" in the bottom ornament when the header is focused | Click the legend button | Y | T1 |
| F7 | Sort Offline by recent | 60 circle at the Offline header's end, revealed on hover **and** focus (Steam's rule) | Click | Focus the header, Right/A on the revealed button (same) | T1 |
| F8 | Select a friend (open the chat) | 72 px row; the open conversation is the only filled row (white .18 + Bold name) | Click the row | D-pad onto the row (focus opens the chat, P1) | T1 + T2 |
| F9 | Write to the friend | 64 px compose capsule | Click it | A on the friend ("Send Message"), or Right into compose | T1 |
| F10 | Friend menu (Send Message, Voice, View Profile, Find Games, Trading ›, Manage › Remove/Block, Cancel) | "⋯" on the hovered/focused row (calls that row's own `onMenuButton`, P5) + "≡ Options" legend button; menu anchored beside the row at +12 mm | Click "⋯" (acts on its own row, the open chat unchanged) or the legend button (focused row) | ≡ | T2, T1, T4 |
| F11 | Quick message (radial) | Unchanged; hint caption above compose | — (the laser types instead; unchanged) | Hold ≡ (same) | T1 |
| F12 | Type and send | Keyboard (K) + **60 px** blue Send circle (80 hit) | Keys + click Send, or Enter | Keyboard + A; Enter | T1 |
| F13 | Start a voice chat | 60 circle, pane top-right (1116, 24) | Click | Right from the history + A; Y in compose (same) | T1 |
| F14 | Invite another friend to the chat | 60 circle, pane top-right (1196, 24) | Click | Right / focus + A | T1 |
| F15 | Read history, load older | History scroller, bubbles | Scroll | Focus the history + D-pad (same) | T1 |
| F16 | Conversation header (`%{ChatTab}`) | Centred 72 px lockup | Click | Focus + A | T1 |
| F17 | Voice-call controls, group chats, Recent Chats rows, Favorites content | Same nodes on the same tokens (circles 60, rows 72, Favorites as avatar grid) | Same | Same | T1 (T3 optional for Favorites) |
| F18 | Leave | Back circle in the sidebar's toolbar row; tab bar | Click Back | B | T1 |
| I1 | Enter a friend code | 464×64 field in the card, focused on arrival | Click → keyboard | A → keyboard (same default focus) | T1 (T3 keypad) |
| I2 | Send the invite | 156×64 OK capsule right of the field | Click | Right + A (same) | T1 |
| I3 | Read your friend code | Recessed platter, 40 px digits | — (text) | — (text, same) | T1 |
| I4 | Accept / ignore / block incoming, cancel outgoing, mutual friends, friend menu | **Steam's own** Block (60 circle, red glyph), Accept and Ignore (60 capsules) in each incoming row; Cancel Invite capsule in outgoing rows; "Y View Mutual Friends" and "≡ Friend Menu" in the card's legend while a row is focused (P5a) | Click the buttons; the legend items | D-pad into the row, Left/Right, A (same); Y; ≡ | T1 |
| P1 | View your community profile | 60 capsule with ↗ in the identity card | Click | Focus + A | T1 |
| P2 | Status (Online / Away / Invisible / Signed out) | 60 dropdown capsule in an 80 px row; menu at +12 mm | Click → menu → click | Focus + A, Up/Down, A | T1 |
| P3 | Do Not Disturb | 66×40 toggle at the row end | Click the toggle | Focus the row + A (same) | T1 |
| P4 | Add Funds (web) | 240×156 tile, green icon, ↗ | Click | Left/Right in the tile row + A | T1 |
| P5 | Privacy Settings (web) | Tile, blue icon, ↗ | Click | Same | T1 |
| P6 | Account Details (web) | Tile, grey icon, ↗ | Click | Same | T1 |
| P7 | Friend code; Add Friends | 80 px row + 60 capsule | Click | Focus + A | T1 |
| P8 | Sign Out | 60 capsule, red label at rest, 24 px from Change Account, 32 px below the previous group | Click | Focus + A (never pressed in tests) | T1 |
| P9 | Change Account | 60 capsule | Click | Focus + A | T1 |
| N1 | See a toast | WN toast card | Passive (hover fill) | — (same) | T1 |
| N2 | Act on a toast | The card | Click (unchanged, unverified) | — | T1 |
| N3 | See that unread notifications exist | Bar bell with a red badge (system concept) | Same | Bar focus (View) + Left/Right (same) | T1 |
| N4 | Read the notification list | QAM › Notifications, 72 popup px cards (system concept) | Same | Same | T1 |
| N5 | Open what a notification refers to | Card row | Click | Focus + A | T1 |
| N6 | SteamVR's own toasts | Same card style (steamvr theme) | Passive | — | T1 |
| M1 | Browse captures | Grid, slots unchanged, thumbnails inset | Scroll | D-pad (virtualized, same) | T1 |
| M2 | Open an item | Tile | Click | A | T1 |
| M3 | Filter (All / Clips / Screenshots / Background Recordings) | Segmented control under the title + "Y Filter" legend button + Steam's modal as a sheet | Click a segment, or the legend button | Y → modal (same) | T3 (fallback T2 capsule) |
| M4 | Select Game (with search) | "All Games ▾" capsule + "X Select Game" legend button | Click either | X → menu (same) | T2 |
| M5 | Item Options (View, Share…, Show on disk, Delete) | Tile "⋯" (calls that tile's own `onMenuButton`) + "≡ Options" legend button; Delete red at rest | Click "⋯" or the legend | ≡ | T2, T1 |
| M6 | Multi-select | Same classes; blue check badge | Same as Steam (not reachable today) | Same | T1 |
| M7 | Viewer: show/hide controls | "Y Hide/Show" legend button | Click the legend button | Y | T1 |
| M8 | Viewer: previous / next | 60 px clear circles at the window sides, visible with the controls, LB/RB badges, 0 mm | Click | LB / RB (same) | T1 |
| M9 | Viewer: Share → share sheet | 144×60 Share capsule top-right (0 mm); sheet at +12 mm with people circles | Click | D-pad + A (same) | T1 |
| M10 | Viewer: Delete | 60 trash circle, red glyph, 24 px left of Share, 0 mm | Click (deliberate: separated) | Left from Share + A (same; never pressed in tests) | T1 |
| M11 | Clip: play / pause | 70 px white circle | Click | A (same) | T1 |
| M12 | Clip: ±10 s, frame step | 60 px circles, centres 80 apart | Click | D-pad + A | T1 |
| M13 | Clip: scrub | 80 px band, 12 px track | Drag | LT / RT (badges at the track ends) | T1 |
| M14 | Clip: markers, view recordings | 60 px circles, row start | Click (add marker never pressed in tests) | D-pad + A | T1 |
| M15 | Clip: Clip, Share | 60 px capsules | Click | D-pad + A; ≡ = Share | T1 |
| M16 | Clip: Delete Clip | "X Delete Clip" legend button, red label | Click the legend button | X (same; never pressed in tests) | T1 |
| M17 | `/media/list` overview | Same route, restyled | Route only (same) | Route only (same) | T1 |
| D1 | Active download (art, progress, Pause/Resume, throttle) | 208 px Now Downloading card; Pause 60 circle at +10 mm | Click | Focus + A | T1, T4 |
| D2 | Change Device | "This Device ▾ Y" capsule (Steam's row) + legend button | Click either | Y; or focus the capsule + A | T1 |
| D3 | Up Next: reorder, remove, play | 96 px rows; drag; 60 px ✕ and ▶ circles | Drag / click | D-pad + A | T1 |
| D4 | Scheduled: Download Now | 60 px blue circle | Click | A on the row (same) | T1 |
| D5 | Completed: Go To Game Page; Clear All | Row; 60 px Clear All capsule | Click | A; focus + A | T1 |
| D6 | Item Options (Uninstall first, Remove from List, View in Library, Favorites, Add to ›, Manage ›, Developer ›, Properties…) | Row "⋯" (calls the row's `onMenuButton`; its `onContextMenu` rejects synthetic events, P5c) + "≡ Options" legend button; menu at +12 mm; Uninstall red at rest | Click "⋯" or the legend | ≡ | T2, T1 |
| D7 | Auto-update state and schedule times | 18 px text-2, title case | — (text) | — | T1 |
| S1 | Back (web) | 60 circle in the navigation ornament (0 mm) | Click | Focus + A; B (same) | T1 |
| S2 | Forward | 60 circle | Click | Focus + A | T1 |
| S3 | Reload | 60 circle | Click | Focus + A | T1 |
| S4 | Security (lock) | Lock glyph in the address capsule | — (status) | — | T1 |
| S5 | URL (and the editable `URLInput` variant) | 60 recessed address capsule | Click (editable variant) | Focus + A (editable variant) | T1 |
| S6 | Store menu | "≡ Store Menu" legend button | Click the legend button | ≡ (same) | T1 |
| S7 | Add to Cart | "Y Add to Cart" legend button with a cart glyph | Click the legend button (never pressed in tests) | Y (same) | T1 |
| S8 | Use the page | Web view, untouched | Click inside | The page's own gamepad mode (same) | — |
| AC1 | My / Global, search, leaderboards, rows | See AP1–AP5 | — | — | T1 |
| AC2 | Compare with a friend | Route `/achievements/friend/:accountid` (same) | Route only | Route only | — |
| AC3 | Achievement unlocked toast | Toast card with rounded-square art | Passive | — | T1 |
| AC4 | In-game overlay achievements | Same page tokens under `/app/:id/overlay/achievements` (only while a game runs) | Same | Same | T1 |
| AP1 | My / Global achievements | 68 px segmented control (60 px segments) | Click a segment | Tab row + Left/Right (same handlers) | T1 |
| AP2 | Search achievements | 380×64 recessed capsule | Click → keyboard | Focus + A | T1 |
| AP3 | Leaderboards | 60 capsule with trophy glyph | Click | Focus + A | T1 |
| AP4 | Read the stats block | Progress capsule + one metadata line (focusable block) | — (text) | Focusable block (same) | T1 |
| AP5 | Read rows (global rows are buttons) | 88 px recessed rows | Click (global) | Focus + A | T1 |
| AP6 | Compare with a friend | Route only (same as AC2) | Route only | — | — |
| K1 | Raise the keyboard | Unchanged (field activation, frame control) | Click a field | A on a field (not on focus arrival: same) | — |
| K2 | Type a character | Keys as raised fills on the glass platter | Point + click | D-pad over keys + A | T1, T5 |
| K3 | Shift, Caps lock | Modifier keys; on = white .94 | Click | Key + A | T1 |
| K4 | Accents | Long-press row as a small glass bubble | Press and hold | Hold A | T1 |
| K5 | Emoji / Steam Chat Items | Steam key (sparkle glyph) | Click | Key + A | T1 |
| K6 | Move the caret | Arrow keys | Click | Keys | T1 |
| K7 | Delete, Enter, Tab | Keys; Enter blue, context label when SQ5 holds | Click | Keys | T1 / T3 |
| K8 | Close the keyboard | `VKClose` key (keyboard glyph) | Click | Key, or B | T1 |
| K9 | IME candidate rows, dead keys | Rows restyled with the key tokens | Click | Keys | T1 |
| K10 | Buffered preview row (apps) | SteamVR keyboard keeps its own preview; the Steam keyboard gets the display-only echo row | — | — | T2 |
| H1 | Go back (header) | Back circle: sidebar toolbar row on `/chat`, the card's top-left on `/invites`, clear on the viewers, WN's toolbar row elsewhere | Click | B (same) | T1 |
| H2/H3 | Start a search, type the query | 520 capsule centred on section roots (Media, Downloads); 60 px magnifier circle on `/chat` (sidebar toolbar), nested routes and the viewers; the echo row shows the query | Click → keyboard | D-pad Up to the header + A (same) | T1, T2 |
| H6 | Browser URL bar | Navigation ornament (§3.10), 0 mm | Click | Focus + A | T1 |
| LEG | Footer legend actions | WN's bottom ornament (0 mm) on routes with actions; quiet legend inside the glass on `/account`, `/invites`, achievements | Click a legend button (same dispatch) | The physical buttons (same) | T1 |

**Count:** 93 functions mapped of 93 listed (F 18, I 4, P 9, N 6, M 17, D 7, S 8, AC 4, AP 6, K 10, shell 4).

---

## 8. Acceptance tests (agents only, no human)

Test hooks named below (`__LGS_SM.install/remove/echoTest/moreTest/lab`, the classes `.lgs-more` and `.lgs-current`) are part of this concept's T2/T3 implementation and must ship with it. Every test uses the locked lab forms (`shot --route/--pre`, `audit --route/--pre`, `outline --route`), never presses a button with side effects (inventory `social.md` §0.4), and closes what it opened. Gamepad sequences first call `FocusApplicationRoot()` (SR §4, `vr-null-tree`). Recipes in capitals are those of `docs/inventory/social.md` §0.3 (FRIEND-FOCUS, CHAT-ENTRY-FOCUS, FRIENDS-TAB n, FRIEND-OPTIONS, CLOSE-MENU, ACCOUNT-STATUS-DROPDOWN, MEDIA-BUTTON n, MEDIA-OPEN-ITEM, ITEM-SHOW-CONTROLS, SHARE-SHEET, DOWNLOADS-BUTTON n). Shots of `/chat`, `/account` and `/invites` contain personal names: look at them, never quote them, and keep them out of committed docs. In-page comparisons of names return booleans only.

### 8.1 Gates on every route of this concept

| # | Check | Command | Pass |
|---|---|---|---|
| G1 | Functions kept | `python glass.py audit main --route R [--pre P]` for `/chat` (+FRIEND-FOCUS, +CHAT-ENTRY-FOCUS), `/invites`, `/account`, `/media/grid`, the viewer and clip recipes, `/library/downloads`, `/steamweb`, the achievements route, the lab fixtures (§8.3); `audit keyboard`; `audit tooltip` with the toast mock | GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST = 0 (WN Q8's Back-label exception listed) |
| G2a | Rows | `glass.py js` sweep over every `.friend`, `.groupName`, context-menu item, `%{SectionItem}`, `%{InvitesRow}`, achievement row and Field in `main` | visible height ≥ 72; top-to-top pitch to the next row ≥ 78 (menus 78, lists 80, rows contiguous in a platter 80) |
| G2b | Controls | The same sweep over every other focusable or clickable element (circles, capsules, segments, legend items, fields, Back, search, "⋯", invite buttons): visible box, then `elementFromPoint` on a 4 px grid over the box B = max(80, w) × 80 centred on the control | visible height ≥ 60 (fields ≥ 64); ≥ 95 % of the samples in B resolve to the control or a descendant, **0 %** to any other interactive target. Allowances: (i) a control nested in a row ("⋯", row circles) may also resolve to its host row; (ii) an in-field button (Send, clear) may also resolve to its own field on the field side. This measures padding-drawn and pseudo-element hit regions, which `getBoundingClientRect` cannot see |
| G2c | Text | computed `font-size` sweep | ≥ 18 px in `main`; ≥ 15 popup px in `keyboard` (= 18 main px) |
| G3 | No outlines | `styles` on glass containers and rows | `border-width: 0`, `outline-style: none`, no `0 0 0 1px` ring; only text fields show the ring when focused |
| G4 | Type | computed `text-transform`, `font-style`, `letter-spacing` on legend labels, group headers, section titles, date dividers, status text | none / normal / ≤ 0 |
| G5 | Nothing at rest | `document.getAnimations().length` 1 s after the last action | 0 |
| G6 | Performance | `python glass.py perf main --route /chat`, `/media/grid`, `/library/downloads` | fps within 5 % of stock; long frames ≤ stock (media grid: 73 fps, ≤ 7 long frames / 3 s) |
| G7 | Font | `document.fonts.check('500 24px "LGS Inter"')` in `main` and `keyboard`; a CJK friend name still renders (if present, look only) | true |
| G8 | Persistence | `python glass.py off`, then `shot main --route /chat --theme off`; the store test S-P below | stock UI, no `lgs` nodes, no `/library/lgs` routes (the lab route included), no scene-graph nodes from us (`__LGS_SG.dump()` empty), store bounds stock |
| G9 | Depth and crops | `__LGS_SG.dump()` on each screen of §4.2, at rest and with its menu open; glassd `--once --dump` for the cover shapes | crop count ≤ the §4.2 budget; for every crop `dz_units ≤ 0.000521 × min(w, h)` of the smallest focusable whose rect intersects the crop (§4.1); every crop rect lies inside a cover shape; **no crop intersects `#Footer`, `%{HeaderBrowser}`, the viewer/clip routes or the `/invites` header nodes**; every crop `interactive: false` until the §4.3 upgrade |

### 8.2 Per screen

| Screen | Test | Pass |
|---|---|---|
| People | `shot main p2_sm_chat_on --route /chat --theme on --pre "<FRIEND-FOCUS>"`; compare with `p2_social-media_people.png` | sidebar 456 ± 2 px; toolbar circles at y 24, title-row circles at y 104 (centres 80 apart); segments 106×60 in a 68 track; rows 72 at an 80 pitch; compose 64 tall; Send 60; the search element's rect is the 80 box at (362, 14) |
| People | **Search semantics:** `L.pad` from the tab row: Up, Up, Up with the theme off (stock) and on, recording `L.focused()` after each; then `outline` the header's placeholder | the on-sequence ends on the same element as stock (the header search) after passing the title-row actions; the search circle's tooltip/`aria-label` is Steam's placeholder string; nothing in the sidebar says "Search" alone |
| People | **Current vs hover:** after CHAT-ENTRY-FOCUS, set T2's hover state on another row (`__LGS_SM.hover(i)`), take one shot, sample the mean luminance of each 72 px row rect (with `glass.py js` reading the shot, or the shot file) | current row − hovered row ≥ 0.06 (15/255); the mockup measures 0.078 (124 vs 104); current name computed `font-weight: 700`, others 600 |
| People | `L.pad`: `FocusApplicationRoot()`, Down ×3 through rows, Right into the conversation, Up/Down, Left back; FRIENDS-TAB 0–3 via bumpers (navigation-only) | the same reachable set as stock; directions match the layout; the chat follows focus (P1); segments switch with L1/R1 and with Left/Right + A |
| People | **"⋯" acts on its own row:** `__LGS_SM.moreTest('friend', i)` picks a row that is not the open conversation, shows its "⋯", clicks it with `L.click`, then CLOSE-MENU | `friendsContextMenu` present; its header text equals that row's name (boolean); the open conversation (ChatTab accountid) and the route unchanged; no `pointerdown`/`click` reached the row (a capture-phase spy on the row counts 0) |
| Friend menu | FRIEND-OPTIONS then shot; `__LGS_SG.dump()` | menu crop at 0.0325 ± 0.005 units, `interactive: false`; slab within 16 ± 2 px of its source (WN AT-11); open animation durations 607 ms, close 441 ms; it scrolls when taller than 520 px |
| Keyboard | Safe trigger (`hud.md` §5.2) with CHAT-ENTRY-FOCUS; `__LGS_SM.echoTest('Liquid Glass')` (feeds only the echo node, never the field) | echo row shows "Liquid Glass" with the field label; Steam's field unchanged; `audit keyboard` clean; `ovprobe valve.steam.gamepadui.keyboard` corners identical before/after; `L.pad` across keys reaches every key |
| Keyboard | `native/spike/hvgrab` with the keyboard up (look, then delete) | echo legible; the platter reads behind the keys |
| Account | `shot --route /account`; ACCOUNT-STATUS-DROPDOWN + CLOSE-MENU | column 760 ± 2 px; glass 720 tall with the legend inside (no capsule fill, items 60 tall, `#Footer` still 92 tall); toggle box ≥ 66×38 and `elementFromPoint` at its centre is the toggle; Sign Out computed colour red; Sign Out ↔ Change Account gap ≥ 24 px; avatar crop 0.0271 units |
| Account | `L.pad` Down through the page, Left/Right in the tile row (never A) | tiles stay a row; every field reachable |
| Add a Friend | `shot --route /invites`; `L.focused()` on arrival; `L.pad('right')`; `L.pad('up')` from the field | focus on the input (ring visible), then on OK; Up reaches the header search circle as in stock; no window cover in `glassd --once --dump`; card shape present; Back, search and legend rects all inside the card shape; G9 finds no crop |
| Add a Friend | Steam's real invite rows in the lab route (§8.3, F-INV) | Block / Accept / Ignore and Cancel Invite are Steam's DialogButtons, 60 px, in DOM order; each click calls exactly one matching spy |
| Photos | `shot --route /media/grid`; G1 audit | `ListItem` rects identical to stock (405×228), thumbnails 389×212 inset 8; segmented (60 in 68) and game capsule present; search 520 wide centred on x 640 |
| Photos | `L.pad` grid traversal; MEDIA-BUTTON 4 + CLOSE-MODAL; MEDIA-BUTTON 3 + CLOSE-MENU; `L.click` the game capsule + CLOSE-MENU | the Filters sheet and Select Game menu open from both the buttons and the capsule (handlers from P3) |
| Photos | `__LGS_SM.moreTest('tile', i)` on a tile that is not focused | the item Options menu opens; the route stays `/media/grid` (the tile did not open); `L.focused()` unchanged |
| Photos | Scroll to the end and back while sampling rows | no blank row (virtualization intact) |
| Viewer | MEDIA-OPEN-ITEM + ITEM-SHOW-CONTROLS; shot; `styles` on `%{ChangeItem}`; `__LGS_SG.dump()` | arrows opacity 1 with controls visible, 0 with them hidden (Y); the search element is the 80 box at (1186, 14); **0 crops**; `L.pad` Left from Share lands on the trash only after one deliberate move; nothing pressed |
| Viewer | `glassd --once --dump` with the viewer open, then closed | the room-dim shape at .30, absent after close |
| Clip | Clip recipe + ITEM-SHOW-CONTROLS; snapshot every timeline layer's `style` attribute with the theme off and on; `__LGS_SG.dump()` | inline styles identical; transport buttons 60/70 px; Delete Clip legend red; **0 crops**; never press X |
| Downloads | `shot --route /library/downloads` idle | TopSection 96 px; device capsule 60 px; search rect identical to the Photos route's |
| Downloads | Steam's active item in the lab route (§8.3, F-DL) | TopSection 208 px, layout as §3.9; Pause crop 0.0271 units on the fixture route |
| Downloads | DOWNLOADS-BUTTON 14 (Options) + CLOSE-MENU (only when a queue row exists; no download is ever started) | Uninstall computed colour red at rest; order unchanged; first focus unchanged; if no row exists, the "⋯" path is covered by the friend and tile tests (same T2 code) and marked "not run" |
| Store | `shot main --route /steamweb` (navigate only); `getBoundingClientRect()` of `%{MainBrowserContainer>Browser}`; G9 | rect (16, 112, 1248, 500) (Plan A); ornament 84 tall above the glass; no crop over either ornament; never press Y |
| Store **S-P** | In one locked step: install a spy that wraps the live browser view's `SetBounds` (logs, then calls through; removed at the end); `lgs on` with the store open → read the last call; `lgs off` → read the last call and the container rect; `lgs on` again; remove the spy | after `on`: the last `SetBounds` call describes the themed container rect (top 112, in the units Steam's own call uses); after `off`: it describes the stock rect (container top 40) and an `hvgrab` shows the web content at its stock top edge (look, then delete); after the second `on`: the themed rect again. If the refresh path fails, Plan A's fallback (§3.10) is active and reported |
| Achievements | `appdetails_achievements_my` / `_global` recipes; audit; `L.pad` tabs → search → rows | segmented 60 in 68, search 64, rows 88; tab Left/Right still switch; quiet legend if game-pages adopts it |
| Toasts | WN AT-18 | card 320×76, radius 30, text ≥ 18 popup px |
| Motion | §11.9 of DESIGN2: durations equal tokens; filmstrips at f = 0, .15, .35, .5, .75, 1 for the friend menu and the viewer controls (`shots/p2_motion_sm_*`); `Emulation.setEmulatedMedia` Reduce Motion | glass before content on entry; no text scaling; segment pill moves position only; Reduce Motion = fades only |
| Headset | One `hvgrab` each of People with the friend menu open, Photos (focused tile), Downloads (fixture route, Pause), the viewer (room dim) and the store ornament, each taken once head-on and once 30° off-axis; look, then delete | material step visible; lift visible on the menu, tile and Pause; **no doubled element anywhere** (ornaments, store bar, viewer controls); dim visible; no closed outline in the edge profile |

### 8.3 Component fixtures (Steam's real DOM, not guessed fragments)

States that cannot be produced without side effects (invites, chat bubbles, an active download, voice and group UI) are verified on **Steam's own components rendered with fake props** in a test-only T3 route, `/library/lgs/lab`, mounted by `__LGS_SM.lab.open(name)` inside one locked step and removed with `lab.close()` (SR §3.4, §3.9; our error boundary around each fixture).

| Fixture | Component (finder by source text, SR §3.2) | Fake props | Checks |
|---|---|---|---|
| F-INV | Incoming and outgoing invite lists of module 71251 (needles `InvitesRow` + `Incorrect friend type in IncomingInvites` / `…OutgoingInvites`) | a fake `friendStore` whose invite methods are spies, a friend group `{member_count: 1, member_list: [fakeFriend]}`, a context object | **Handler gate first:** read the source of the three `onClick` targets; if any calls `SteamClient.` or a global store (anything but its own arguments), run shots only. Otherwise click Block, Accept, Ignore, Cancel Invite in turn: exactly one call to the matching spy each, none to the others; a confirm modal that Steam may open for Block is closed with B, never confirmed |
| F-CHAT | `ChatMessageBlock` / `ChatMessageBlocks` of module 24032 (needles `"ChatMessageBlock"` + `chat_message_blocks`) | a fake `block` (`messages`, `BIsInvite() → false`, `BIsServerMsg() → false`, `UniqueKey()`, `is_last_block`), a fake `friendRenderContext` | shot `p2_sm_fixture_chat`; bubbles as §3.1; no interaction |
| F-DL | The component that renders `DownloadSectionActiveItem` (module 11698; needles `DownloadSectionActiveItem` + `DownloadGraph`) | a fake item/app/overview with progress 39 % | shot `p2_sm_fixture_dl`; card 208 px; Pause never clicked |
| F-FAV | The Favorites panel of module 20447 | a fake `m_FavoritesStore` with three friends | whether children are in flow (decides T1 or T3 for the avatar grid) |

For each fixture: diff the rendered class tree against `docs/inventory/social.md` §2 (every class the inventory lists for that node must be present, at the same nesting), apply the theme, shot, then G1 and G2 on the lab route. A fixture whose component cannot be found or throws on render falls back to a static fragment with Steam's class names; its results are labelled **unverified** in the test report and do not count as a pass.

---

## 9. Open questions and risks

| # | Question / risk | Blocks | Default if unresolved |
|---|---|---|---|
| Q1 | CQ1: can the toolbar row be 108 px (WN AT-2)? | §3.0 toolbar on Media, Downloads, Account, Achievements | WN §3.2 fallback |
| Q2 | SM SQ4: echo row and key-block move in the keyboard window | §3.3 | Echo in the bottom band; else none |
| Q3 | SM SQ5: per-field Enter label | §3.3 | "Enter" |
| Q4 | SM SQ6: set the media filter directly from a T3 segment (`onFilterChange`) | §3.6 segmented control | Capsule that opens Steam's modal (P3) |
| Q5 | Click on an in-place interactive crop (SP §12, needs a wearer) | §4.3 upgrade only | Click-safe non-interactive depths (§4.1) ship by default |
| Q6 | CQ10 / WN AT-11: anchored context menus | §3.2 position | Centred sheet, same look |
| Q7 | Store browser view composited under or over the DOM (`%{AllowUnderlay}`) | rounded web corners | Square corners inset 24 px |
| Q8 | Does the friends sidebar width change fight `.SteamDeckChats` (absolute 980 px)? | §3.1 | 300 px sidebar with the new rows |
| Q9 | Favorites panel structure | Favourites grid | F-FAV fixture decides; else rows like Friends |
| Q10 | SM SQ13: numeric keypad for the friend code | §3.5 | Full keyboard + echo label |
| Q11 | glassd "room dim" shape behind the window | §3.7, §3.8 | No dim |
| Q12 | Red legend label on clear glass over bright video (CONTRAST) | §3.8 | White label with a red glyph badge |
| Q13 | A ghost-free path for depth outside the cover: an `opacity: 0` node on `t1` (SP §5) hides Steam's real panel while covers, base pieces and crops (reparented outside `t1`) stay visible. Needs: `DumpLaserOverlays` still lists main as a laser target, and an off-axis `hvgrab` shows no doubling (shared with WN Q11) | +25 mm ornaments (§4.3) | Ornaments at 0 mm |
| Q14 | Store bounds refresh through the host's own render (§3.10) | Plan A with a store open during `lgs on/off` | Route replace; else Plan A only for views opened after `lgs on` |
| Q15 | Localized tab labels: the tokens Steam's `TabPanelHeader` uses, read by T2 | §3.1 segment labels | Steam's tab icons in equal segments |
| Q16 | Calling a row's `onMenuButton` with an event-like object (P5) | "⋯" on friends, tiles, downloads | The legend's "≡ Options" button |
| Q17 | WN adopts the quiet-legend variant and the two route-scoped header positions (`/chat`, `/invites`) | §3.0 | Capsule ornament on every route; header in WN's row with the sidebar and card starting below it |
| R1 | DESIGN2 §12 says friends are virtualized; P1 shows they are not | — | This concept follows P1; Foundation should correct §12 |
| R2 | Large menus (friend menu 7 entries, Downloads Options 10) exceed Steam's 520 px modal box at 72 px rows | §3.2, §3.9 | Steam's scrolling menu with a scroll edge (WN §5.1) |
| R3 | Other agents change routes and theme between steps | all tests | Single locked steps; check `glass.py status` before judging a shot (SN C.0.3) |
| R4 | +10 mm (avatar, Pause) is ≈ 0.35–0.43 display px of disparity, close to the threshold DESIGN2 D10 names | §4.1 | Kept: DESIGN2 uses +10 mm for Home icons; Pause moves to +15 mm in §4.3 |

---

## 10. Files

| File | What |
|---|---|
| `docs/phase2/concepts/social-media.md` | This concept |
| `docs/phase2/mockups/social-media-*.html` (14) | Static mockups at true size |
| `docs/phase2/mockups/social-media.css`, `social-media.js` | Their shared layout, icons, chrome, People window builder, legend builder and keyboard builder |
| `shots/p2_social-media_*.png` (14) | Renders (`python tools/mockshot.py docs/phase2/mockups/social-media-<name>.html shots/p2_social-media_<name>.png`) |

Cross-concept items for the owners: WN — the quiet-legend variant and the `/chat` and `/invites` header positions (Q17); game-pages — the achievements recommendation (§3.11); Foundation — DESIGN2 §12's virtualized-list entry (R1).

---

## 11. Critique responses

The critic's points, in their order, with what changed.

| # | Critique | Response | Where |
|---|---|---|---|
| 1 | Depth plan ignored NE and WN; chrome outside the cover popped at +25 mm and would ghost; WN keeps `#Footer` at 0 | **Accepted.** NE and WN are now sources. Every element outside a cover is at 0 mm with a glassd liquid slab behind it (inset method): the bottom ornament, the store's navigation ornament. On `/invites` the chrome moved *inside* the card, so nothing is outside a cover at all. G9 checks "no crop intersects `#Footer`, `%{HeaderBrowser}` or the `/invites` header nodes" (WN AT-14 equivalent). The ghost-free route for out-of-cover depth (opacity-0 node on `t1`) is recorded as gated experiment Q13 | §3.0, §3.5, §3.10, §4, §8.1 G9, §9 Q13 |
| 2 | Every pop needed an unproven interactive click; the default would ship no stereo | **Accepted.** §4.1 defines the click-safe rule (dz·tan45° ≤ ¼ of the smallest target under the crop) and ships non-interactive pops now: menus and sheets +12 mm, focused tile +15, Pause +10, avatar +10, plus WN's tab bar +25 and the keyboard keys over their platter. G9 computes the rule from `__LGS_SG.dump()` in scene units (`dz ≤ 0.000521 × min(w, h)`, independent of the window's resize); headset captures look for the lift and for doubling. +30 mm interactive waits for the wearer (§4.3) | §4.1, §4.3, §8.1 G9, §8.2 Headset |
| 3 | Controls over media were popped and would lift the photo/video; the viewer needed 7 crops | **Accepted.** All viewer and clip controls and the playback platter are flat clear glass with the dimming band and a CSS shadow. Crop budgets per screen are in §4.2 (viewer 0, clip 0, grid 1, People 0/1 …) and tested with `__LGS_SG.dump()`. Only frosted slabs (the share sheet) may pop over media | §3.7, §3.8, §4.2, SM-D12 |
| 4 | Geometry differed from WN (664 vs 656 glass, ornament 636–720), Downloads moved search, the viewer kept the full search capsule | **Accepted.** WN's numbers are used throughout (SM-D10): glass 656, ornament 628–712, Back box (14, 14), title x 100, search 520 centred on x 640 on both section roots (Media, Downloads). The viewer and clip, and also `/account`, `/invites` and achievements, use WN's collapsed magnifier circle (gated by WN AT-4) | §3.0, §3.4–3.9, all mockups |
| 5 | The open-conversation pill and the hover could not be told apart | **Accepted.** Sidebar hover is the light spot alone (peak +.12, radius 108 px, no fill); the open conversation is the only filled row and the only Bold name. Measured on the new render: row means 124 (current) vs 104 (hovered) vs 91 (rest), a step of 0.078. §8.2 requires ≥ 0.06 on the live screen | §3.1, SM-D13, §8.2 |
| 6 | Icon-only 76×56 tabs broke DESIGN2's sizes; glyphs ambiguous; bumper caps looked like segments | **Accepted in substance, different layout.** Segments are 60 px in a 68 px track, every tab carries a text label, and the bumper glyphs are non-interactive badges on the track's ends. Instead of the suggested labelled pill plus three icon circles, all four segments are equal and labelled (106×60, hit 106×80): with variable widths every selection change would also change the segments' sizes and positions, which DESIGN2 §11.5 lists under "must not animate" for selection changes, and the three icon circles would keep the person/group ambiguity. Deviation recorded: labels are 20 px (DESIGN2 says 22) so "Favorites" fits 106 px; "Recent" is the label for Recent Chats, whose full name stays the title | §3.1, SM-D14, mockup |
| 7 | The sidebar "Search" was really Steam's global search | **Accepted.** On `/chat` the global search is a magnifier circle in the sidebar's toolbar row with Steam's placeholder as tooltip; it no longer looks like a friend filter. No new friend filter is added (it would be a new function needing approval). §8.2 compares the D-pad Up sequence from the tabs with stock | SM-D2, §3.1, §8.2 |
| 8 | T2 buttons inside Steam rows act on the focused row and may bubble into the row; invite actions untestable | **Accepted, with a better mechanism found by probe P5.** (a) `/invites` needs no T2 buttons: Steam already renders Block / Accept / Ignore DialogButtons in every incoming row and Cancel Invite in outgoing rows; they are restyled in DOM order. (b) The "⋯" no longer goes through the legend: it calls the host row's own `onMenuButton` from the row's fiber props (so it acts on its own row whatever holds focus) and stops `pointerdown`, `mousedown`, `mouseup` and `click` in the capture phase. P5 also showed why a synthetic right-click is not enough: download rows reject untrusted `contextmenu` events. Tests: the friend-row "⋯" opens the menu for that friend with the open chat unchanged and zero events reaching the row; the tile "⋯" leaves the route unchanged; invite buttons are exercised on Steam's real component in the lab route with spy handlers, behind a source gate | §3.5, SM-D15, §6.1 P5, §8.2, §8.3 F-INV |
| 9 | Bubbles, invites and the active download were tested on fragments the designer wrote | **Accepted.** §8.3 renders Steam's own components (found by source-text finders; modules identified by P5) with fake props in a test-only lab route, diffs their class tree against the inventory, then shots and audits them. Static fragments remain only where no component renders, and their results are labelled unverified and do not pass | §8.3 |
| 10 | G2 failed by construction and could not see padding hit regions | **Accepted.** G2 is now per class (rows ≥ 72 at ≥ 78 pitch; controls ≥ 60 visible with ≥ 95 % of an 80 px box resolving to the control by `elementFromPoint` sampling, with two declared allowances; text ≥ 18 px). Violators fixed: segments 60, Send 60. While checking, revision 2 also found the sidebar's search circle and Add Friend circle only 72 px apart; the title row moved to y 104 so their centres are 80 apart | §8.1 G2, §3.1 |
| 11 | Store Plan A broke "theme off = stock" while a store is open | **Accepted.** `lgs on` and `lgs off` both refresh the browser view's bounds through Steam's own layout effect, with a route-replace fallback and, failing both, Plan A only for views opened after `lgs on`. Test S-P spies on `SetBounds` across on/off/on in one locked step | §3.10, §8.2 S-P, Q14 |
| 12 | 4–5 rows of chrome under every window; "A Select / B Back"-only capsules were the most Steam-like parts left | **Accepted for what this concept owns.** Routes whose legend only carries A/B hints (`/account`, `/invites`, achievements) get the quiet legend inside the glass or card, so the window has no capsule row under it. On action routes the ornament carries real buttons (Options, Filter, Delete Clip …). The rows below that (SteamVR frame controls, dashboard bar, window bar) belong to WN and the system concept; the quiet variant is proposed to WN (Q17) | §3.0, §3.4, §3.5, mockups |
| — | Found during revision | The friend menu needs 596 px at 72 px rows but Steam's modal box is 520 px, so it scrolls by 76 px (WN §5.1 rule); the mockup shows it scrolled | §3.2, R2 |
