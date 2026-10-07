# UX audit: game pages, Now Playing and controller bindings (`audit:game-pages`)

Scope:

- the game page `/library/app/:appid`: hero, play bar, the Manage (gear) menu and the Play-from menu, the four tabs (Activity, Your Stuff, Community, Game Info) and their content;
- the achievements page `/library/app/:appid/achievements/...`;
- the Properties dialog `/app/:appid/properties/...`;
- the controller entry of the play bar (`/app/:appid/controllerconfigurator/main`);
- the running-game state (Resume / Stop) on the game page;
- SteamVR's **Now Playing** panel (Resume Game, VR Controller Bindings, VR Video Settings, Exit Game) and the two settings modals it opens;
- SteamVR's controller binding UI (`vr:controllerbindingui`).

The global header (Back, search), the footer legend, the VR main menu and SteamVR's window chrome are covered in `docs/phase2/audit/shell-nav.md` and are referred to, not repeated.

Audited live on 2026-10-07 (Steam build `11041156`, SteamVR web UI `11065908`) with the theme off and on. Inputs: `docs/inventory/appdetails.md`, `docs/inventory/steamvr.md`, `docs/DESIGN.md`, `docs/NATIVE.md`, `theme/layers.json`, `docs/phase2/research/references.md`, `docs/phase2/audit/shell-nav.md`, the visionOS references 5 (TV) and 11 (Music) in `docs/refs/visionos/`, and the bible rulebook `../.claude/skills/run-liquid-glass-frame/references/design-language.md`.

`docs/phase2/capabilities/` was empty when this was written. Each proposal in §C names the capability question (GQ*n*, listed at the end) it depends on.

---

## 0. Evidence, units and new facts

### 0.1 Shots taken for this audit (all in `shots/`)

| file | what it shows |
|---|---|
| `p2_audit_game_top_off.png` | Beat Saber (620980), stock, top of the page |
| `p2_audit_game_top_on.png` | the same with Phase 1 on |
| `p2_audit_game_padfocus_on.png` | after the gamepad traversal in §0.4: Your Stuff tab, outer scroller at its maximum, tab focused |
| `p2_audit_game_scrolled_on.png` | Half-Life: Alyx (546560), outer scroller at its maximum: the play bar shows through the header, plus the Steam Cloud status row |
| `p2_audit_bind_view_on.png` | `vr:controllerbindingui`, "Viewing default VR Dashboard bindings" (read-only preview), themed |

Phase 1 shots reused: `appdetails_*` (stock, every tab, menu, modal and Properties page), `appdetails_v1`…`v6_*` (Phase 1 themed), `vr_np_*` (Now Playing stock and themed, rest / Resume focus / Exit focus), `vr_bind_*` (binding UI stock and themed), `vr_settings_*`.

Measurement snippets (all read-only, run as `--pre` of a locked `shot` step) are reproduced in §0.4 and §0.5 where they matter.

### 0.2 Physical scale of each surface

| surface | how it is sized in the scene | CSS px across the 0.98 m window width | degrees per CSS px at 1.43 m | 2.5° target = |
|---|---|---|---|---|
| main window (game page, achievements, Properties) | `docs/NATIVE.md`; frame node `override-pre-resize-main-panel-height: 1.5` | 1280 | **0.031°** | **80 px** |
| Now Playing panel (`#nowplayingpanel`, 1858×1045) | SteamVR source: the frame-page main panel (`DashboardPanel`, `is_frame_page_main_panel:true`) gets `width: 2.67` scene metres in VR gamepad UI, the same width as the Steam window (2.67 × 1.5) | 1858 | **0.0213°** | **117 px** |
| binding UI (`vr:controllerbindingui`, 2400×1350, devicePixelRatio 1) | page 2 of the Steam dashboard frame 681000001; all three pages of that frame share `override-pre-resize-main-panel-height: 1.5`, so the page fills the same 16:9 quad as the Steam window (inference; confirm with one `hvgrab` frame) | 2400 | **0.0164°** | **152 px** |

visionOS body text (17 pt) is ≈ 0.71° per em (`references.md` A.3): **23 px** in the main window, **33 px** in Now Playing, **43 px** in the binding UI.

### 0.3 Where the game page puts things (Beat Saber, stock, CSS px)

Top of the page (outer scroller at 0):

| band | y | share of the 720 px height |
|---|---|---|
| global header (overlaps the hero) | 0–40 | 6% |
| hero art (`%{TopCapsule}`, logo, "VR required" badge) | 0–336 | 47% |
| play bar (`%{PlaySection}`) | 336–416 | 11% |
| Steam Cloud status row (`%{CloudStatusRow}`, only for games with cloud saves, e.g. Alyx) | 416–446 | 4% |
| tab row (`%{TabHeaderRowWrapper}`) | 416–474 | 8% |
| tab content visible | 474–678 | **28%** |
| footer legend | 678–720 | 6% |

At the outer scroller's maximum (376 px): the tab row pins at 40–98 and the tab content gets 98–678 = **580 px (81%)**.

Horizontal placement of the play-bar controls, as angles from the window centre:

- Play: centre x = 141 px → **−15.5°**
- Play-from caret: x = 258 → −11.8°
- Configure Controller: x = 1162 → **+16.2°**
- Manage (gear): x = 1220 → **+18.0°**

The Manage menu opens as a sheet centred at x = 640: an **18° gaze jump** from the gear that opened it.

Hero art: the hero asset is 1920×620 (aspect 3.1), shown in a 1280×336 box (`object-fit` crop). The logo is a separate 640×360 asset placed by inline percentages from the library assets (`%{BoxSizer}`).

### 0.4 Gamepad traversal now works unattended (answers shell-nav C.0.2)

`L.pad` does nothing while Steam's navigation source is the laser. It works once a nav node takes gamepad focus with `BTakeFocus(3)` (the `gpFocus` helper from `appdetails.md` §0.4). Verified on 2026-10-07:

```js
// --pre of a locked shot step; never press A/B/menu; never Left at the page's left edge
// (opens the main menu) and never Up past the top row (focuses the header search,
// which navigates to /search and raises the keyboard)
L.nav('/library/app/620980'); await L.sleep(2200);
gpFocus(L.q('main','%{PlayButtonContainer>PlayButton}'));   // node.BTakeFocus(3)
await L.pad('right'); ...
```

Result (Beat Saber, Phase 1 on):

| step | focus lands on | rect (x,y,w,h) |
|---|---|---|
| start | Play | 36,352,210,48 |
| Right ×3 | Play from → Configure Controller → Manage | 246,352,24,48 / 1138,352,48,48 / 1196,352,48,48 |
| Left ×3 | back to Play, in the same order | |
| Down | ACTIVITY tab; **the outer scroller jumps 277 px** (tab y 428 → 151) | 419,151,90,34 |
| Right | YOUR STUFF (focusing a tab selects it); the outer scroller goes to its maximum | 512,52,110,34 |
| Down ×3 | Drill (expanded achievement) → Pure (locked achievement) → the DLC section | 46,199,610,90 / 46,303,610,90 / 36,459,1208,117 |
| Up ×3 | Pure → Drill → YOUR STUFF tab | |

The "Last Played" stat is a `tool-tip-source Focusable` (84×46) but D-pad Right from Play skips it: it is a laser-hover tooltip only.

### 0.5 How Steam decides D-pad direction (decides what T1 layout may change)

Read from Steam's source (module 74562, `GetLayout()`, and module 92393, export `ko`):

```js
GetLayout(){ return this.m_Properties?.layout ? this.m_Properties.layout
               : this.m_rgChildren.length < 2 ? 0 : ko(this.m_element) }
// ko(el): getComputedStyle(el): display:flex + flex-direction row -> ROW (row + wrap -> GRID),
//         row-reverse -> ROW_REVERSE, column -> COLUMN, column-reverse -> COLUMN_REVERSE;
//         display:grid -> GRID (GEOMETRIC when grid-template-areas is set); floats/inline children -> ROW/GRID
```

So for every nav node **without an explicit `flow-children`**, the D-pad layout is **read from the element's computed CSS at the moment of each key press**. A T1 reflow of such a node (row to column, adding wrap) changes the D-pad mapping with it, consistently. Within a ROW or COLUMN, the order is the DOM order of the children, not the visual order, so the CSS `order` property must not reorder focusable children.

Nodes on the game page and what they declare (read from the React fiber's `node.m_Properties`):

| node | explicit layout | explicit handlers | consequence for T1 |
|---|---|---|---|
| `%{Header>ActionRow}` (play bar row, 3 children) | none (inferred) | — | free to restyle; keep focusable children in DOM order visually |
| `%{AppButtons}` (controller, gear) | none | — | free |
| `%{PlayButtonContainer>PlayButton}` | `layout: 0`, `autoFocus`, `noFocusRing` | — | Steam draws no ring here: the button paints its own focus |
| tab strip `%{FixCenterAlignScroll}` | none | **`onMoveLeft`, `onMoveRight`** | Left/Right switch tabs whatever the layout; a vertical tab column would not map Up/Down to tabs |
| `%{TabContentsScroll}` | none | `onMoveUp` | Up from the first content row goes to the tabs |
| `%{AbsoluteDiv}` (page root) | none | `fnCanTakeFocus` | — |
| an Activity event card | none | `actionDescriptionMap {14: "Options"}` | the ☰ button opens the event's menu |

Now Playing does not use Steam's navigation at all. Its source (module 6848) keeps a flat button list: D-pad Up/Down move through the list **in array order**, A invokes, B = Resume. Any Now Playing layout must therefore stay a single vertical stack.

### 0.6 What could not be exercised

- **Running-game states** (Resume, Stop, Launching, the "Exit game?" confirm, the launching-details overlay, the running game's frame menu): nothing may be launched. They are mapped from source (`appdetails.md` §3.3, §10).
- **Now Playing live:** it needs a scene app. The Phase 1 shots `vr_np_*` (taken with the Liquid Glass Frame showcase) were reused. Its two modals were read from source (modules 2928 and 6882), not opened.
- **Which running-game UI a Steam-launched VR game gets on this Frame.** The two inventories disagree. `appdetails.md` §10 reads that SteamVR suppresses Now Playing when mutual capability 23 is present and Steam's game page and frame menu take over. `steamvr.md` §2.7 rendered Now Playing for the showcase, an OpenXR app that Steam did not launch. This audit therefore designs both paths to look the same (§C.5); GQ9 asks which one appears.
- **Steam Input configurator:** only the "No controller connected." state is reachable.
- **Binding UI edit mode** and every write action there (Activate, Edit, Select, Export, Replace Default).
- **Laser `:hover`** cannot be synthesised; hover looks come from CSS.

---

## A. Function list

"Laser" = the controller laser (sets `:hover` and Steam's laser focus). "Gamepad" = Steam's FocusNavController (`.gpfocus`), or SteamVR's own focus where noted. Every row must stay reachable both ways after the redesign. A dash (—) means there is no path today.

### A.1 Hero (`%{TopCapsule}`)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| G1 | See the game's art, logo and "VR required" badge | — (passive) | — | Non-Steam shortcuts without art get `%{FallbackArt}` (307 px tall) |
| G2 | Go back | header Back (shell-nav H1) | B | — |

### A.2 Play bar (`%{PlaySection}`)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| P1 | **Play / Install / Update / Stream / Resume** (one button, label by state) | click (210×48) | focus (default focus of the page) + A | Green = Play/Stream/Launch/Connect; blue on focus = Install/Update/Resume; disabled = no action |
| P2 | Play from (choose This Steam Frame / Stream from: PC) | click the caret (24×48) | Right from Play, A | Opens a menu (A.4); selecting changes a setting |
| P3 | Stop a running game (running state only, source) | click the Stop square (48×48) | Right from Resume, A | Opens "Exit game?" (global confirm); a second press force-stops (red) |
| P4 | See Launching progress | — | — | Throbber inside the button; Steam can open a full-page launching-details view |
| P5 | Read Last played / Play time / Space required | read; hover Last played for a tooltip | read only (not focusable by D-pad) | 12 px uppercase labels |
| P6 | Configure Controller (Steam Input) | click (48×48) | Right, A | Goes to `/app/:appid/controllerconfigurator/main`; on this Frame it showed only "No controller connected." (`appdetails_controllerconfig.png`), see B.4 |
| P7 | Open the Manage menu | click the gear (48×48) | Right ×3, A | A.3 |
| P8 | See that the game is marked private | — (badge) | — | 21 px badge on the gear |
| P9 | See Steam Cloud status | — | — | `%{CloudStatusRow}` (30 px band, "Steam Cloud: Up to date"); conflict and error states exist; clickability in those states not verified |

### A.3 Manage menu (gear; centred gamepad sheet)

Root (installed game): Add to Favorites · Add to › · Manage › · Developer › · Properties… · Cancel. Conditional items: Remove from ›, Controller layout, Clear/Reset Controller Layout, CD keys, Family › Allow/Deny, Dismiss from Play Next, Remove from account, Exit game / Stop streaming (running).

Submenus:

- **Add to ›**: every collection, + New collection…
- **Manage ›**: Hide this game; Mark / Unmark as Private (disabled for non-Steam games); Uninstall; Remove non-Steam game; Browse local files; Back up game files…; Add desktop shortcut.
- **Developer ›**: Delete Proton Files.

| # | function | laser | gamepad |
|---|---|---|---|
| M1 | Choose an item, open a submenu | click (rows 280×48) | D-pad + A; Right or A opens a submenu |
| M2 | Dismiss | click outside or Cancel | B |

### A.4 Play-from menu

"This Steam Frame", "Stream from: Ben-PC2" (checked item = current target), Cancel. Laser click / gamepad D-pad + A; B dismisses.

### A.5 Tabs (`%{GamepadTabbedPage}`)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| T1 | Switch tab (Activity, Your Stuff, Community, Game Info) | click a tab (90–124×34) or the ‹ › arrows (32×32, not D-pad focusable) | Down from the play bar, then Left/Right (explicit handlers; **focusing a tab selects it**); LB/RB per shell-nav A.2 (not re-verified here) | `/library/app/:appid/tab/<Name>` selects a tab directly |
| T2 | Read the compat verdict at a glance | — | — | Game Info tab carries a Verified / Unknown icon |
| T3 | Scroll the tab's content | wheel / thumbstick on the page | D-pad moves focus; Steam scrolls both scrollers | two nested scrollers (outer: hero + play bar; inner: tab content) |

### A.6 Activity tab

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| AC1 | Post to friends | click the field → VR keyboard → Post | focus + A → keyboard | social action |
| AC2 | Open an event (news, update) | click a card | focus + A | opens the full-screen event overlay |
| AC3 | Event menu | — (no visible button) | ☰ (button 14, "Options") on the focused card | |
| AC4 | Like / comment | click the rating bar (visible only while the card has focus) | focus the bar + A | social |
| AC5 | Friends who play: open a friend | click an avatar | focus + A | only when friends own the game |

### A.7 Your Stuff tab (sections appear when they apply)

| # | function | laser | gamepad |
|---|---|---|---|
| YS1 | Achievements: see progress; open the achievements page | click an achievement (locked icons 74×74; the focused one expands to 610×90) | focus (carousel, Left/Right) + A |
| YS2 | Workshop: two link buttons; hide the featured item | click | focus + A |
| YS3 | Trading cards: see the badge and cards | click | focus + A |
| YS4 | DLC: open a DLC tile, "+ N More" | click (190×89) | focus + A |
| YS5 | Media: "Go to my media library" | click (219×40) | focus + A |
| YS6 | My Review: "View all my reviews" (opens the web view) | click | focus + A |
| YS7 | Notes: "New Note" (opens the notes editor) | click (160×44) | focus + A |

### A.8 Community tab

| # | function | laser | gamepad |
|---|---|---|---|
| CM1 | Open a guide, artwork or video | click an item (598×388) | grid D-pad + A |
| CM2 | Item menu | the 28×28 button that appears on hover | ☰ on the focused item (from Steam's legend) |
| CM3 | Load more | scroll (infinite append) | move focus down |

### A.9 Game Info tab

| # | function | laser | gamepad |
|---|---|---|---|
| GI1 | Read description, developer, publisher, release date | — | — |
| GI2 | Feature rows (Single-Player, VR Support…) | hover (126×24, focusable) | focus |
| GI3 | Steam Frame Compatibility → **Details** modal (device tabs, rating rows) | click "Details" (66×29) | focus + A; B closes |
| GI4 | Quick links: Store Page, DLC, Community Hub, Discussions, Guides, Support (open the web view) | click (128×43) | focus + A |
| GI5 | Found in these collections → a collection | click (185×185) | focus + A |

### A.10 Achievements page (`/library/app/:appid/achievements/my/individual`)

| # | function | laser | gamepad |
|---|---|---|---|
| AP1 | My / Global achievements | click a tab (155×34) | tab row + Left/Right |
| AP2 | Search achievements | click the field (220×40) → keyboard | focus + A |
| AP3 | Leaderboards (dropdown → leaderboard page) | click (200×40) | focus + A |
| AP4 | Read the stats block (earned, play time, last two weeks) | — | focusable block |
| AP5 | Read rows (80 px; global rows are buttons) | click (global) | focus + A |
| AP6 | Compare with a friend | route `/achievements/friend/:accountid` | — |

### A.11 Properties (`/app/:appid/properties/<page>`)

Pages (installed Steam game): General, Compatibility, Updates, Installed Files, Game Versions & Betas, Controller, DLC, Game Recording, Privacy, Customization, Performance; + Workshop (when present); non-Steam shortcuts get Shortcut instead of General/Updates/Installed Files/Betas/DLC/Privacy.

| # | function | laser | gamepad |
|---|---|---|---|
| PR1 | Switch page | click a page-list item (256×42) | D-pad Up/Down in the list (focusing an item opens its page) |
| PR2 | Change a field: toggles (38×22), dropdowns (255×40), text inputs (952×40), checkboxes, radio rows (Betas), buttons (Verify, Move, Browse…, Check Code, Unsubscribe) | click | focus + A (Left/Right on sliders) |
| PR3 | Read info rows (Build ID, disk size, Steam Input status) | — | focus moves over them |
| PR4 | Leave | header Back | B |

### A.12 Controller entry (Steam Input configurator)

| # | function | laser | gamepad | notes |
|---|---|---|---|---|
| CC1 | Configure the Steam Input layout | P6 | P6 | With no Steam Input gamepad connected it shows only "No controller connected." The full configurator has 15 sub-routes (`appdetails.md` §8) |

### A.13 SteamVR Now Playing (`vr:systemui` panel; shown while a scene app runs and the dashboard shows its frame)

| # | function | laser | gamepad (SteamVR's own list focus) | notes |
|---|---|---|---|---|
| NP1 | Resume Game / Return to Home | click | first in the list; A; **B anywhere = Resume** | |
| NP2 | VR Controller Bindings → modal: active controller, active binding (default / custom), **Edit binding / Choose another** (opens the binding UI), dominant hand, show binding callouts | click | Down, A | inside the modal: laser only; B closes it |
| NP3 | VR Video Settings → modal, per app: resolution (custom / auto supersampling), motion smoothing (global / on / off / always on), foveated sharpening, FOV scale, world scale, refresh-rate override, reprojection, throttling override, reset to defaults | click | Down, A | inside the modal: laser only; B closes it |
| NP4 | Clear Performance Assessment Status | click | Down, A | only with that developer setting |
| NP5 | Exit Game / Exit Home | click | Down, A | only if `/settings/dashboard/allowAppQuitting` |
| NP6 | Frame controls of the game frame: Float in World, View in Theater, More Options, **Close** | see shell-nav W3–W6 | see shell-nav | Close exits the app |

Not shown in arcade mode: NP2, NP3.

### A.14 SteamVR controller binding UI (`vr:controllerbindingui`; laser only, **no gamepad path**)

| # | function | where | notes |
|---|---|---|---|
| B1 | Back | title bar (144×70) | |
| B2 | Choose an application | app rows (984×156); "Show More Applications" (371×65) lists all 107 | the current scene app and VR Dashboard first |
| B3 | Current binding: Edit | list page, "Edit" (100×65) | |
| B4 | Choose the controller type | list page, controller card dropdown | |
| B5 | Community bindings: View, Activate, Delete (own) | list page buttons (100×65) | Activate switches the binding |
| B6 | Create New Binding | list page (269×58) | |
| B7 | Browse a binding: action-set tabs (10 here; warning/error states with counts), Poses / Haptics toggles, left/right controller columns | view page (tabs 137×72) | the mirrored right column is at opacity .5 |
| B8 | Select this Binding · Edit this Binding · Show Developer output · Export Binding File · Replace Default Binding | view page bottom row (359×75 each) | developer actions sit beside the main ones at equal weight |
| B9 | Options menu | title bar (140×68) | |
| B10 | Edit mode (Save Personal Binding, per-input editors) | edit page (source) | |

### A.15 Running game in Steam (source only)

| # | function | path |
|---|---|---|
| R1 | Resume | play bar P1 ("Resume", blue on focus) |
| R2 | Stop / Force stop | P3 → "Exit game?" confirm (never confirm) |
| R3 | Running game's frame menu: Controller settings, Game details, Achievements, Guides, Notes, Game Recording, Switch Windows | `frame.menu` (bar inventory) |
| R4 | Overlay routes `/app/:appid/overlay[/achievements|/controller|/guides|/notes|/browser|/gamerecording]` | only in a running app's overlay window |

---

## B. VR UX critique

### B.1 Target sizes

Main window (0.031°/px; 2.5° = 80 px):

| control | size (px) | angle (limiting side) | vs 2.5° |
|---|---|---|---|
| Play button | 210×48 | 1.49° tall | 60% |
| **Play-from caret** | **24**×48 | **0.74° wide** | **30%** |
| Configure Controller, Manage | 48×48 | 1.49° | 60% |
| Tabs | 90–124×34 | 1.05° | 42% |
| Tab arrows ‹ › | 32×32 | 0.99° | 40% |
| Post field | 1188×37 | 1.15° | 46% |
| Achievement icon (locked) / expanded | 74×74 / 610×90 | 2.29° / 2.79° | 92% / OK |
| DLC tile | 190×89 | 2.76° | OK |
| Section buttons ("Go to my media library"…) / New Note | 219×40 / 160×44 | 1.24° / 1.36° | 50% / 55% |
| Game Info quick links | 128×43 | 1.33° | 53% |
| **Compat "Details"** | 66×**29** | **0.90°** | **36%** |
| **Feature rows** (focusable) | 126×**24** | **0.74°** | **30%** |
| **Community item menu** | **28×28**, opacity 0 until hover | 0.87° | 35% |
| Manage menu rows | 280×48 | 1.48° | 59% |
| Achievements page: tabs / search / Leaderboards / rows | 155×34 / 220×40 / 200×40 / 1240×80 | 1.05° / 1.24° / 1.24° / 2.48° | 42% / 50% / 50% / 99% |
| Properties: page-list item / field row / **toggle** / dropdown / input | 256×42 / 952×46 / **38×22** / 255×40 / 952×40 | 1.30° / 1.43° / **0.68°** / 1.24° / 1.24° | 52% / 57% / 27% / 50% / 50% |

Now Playing (0.0213°/px; 2.5° = 117 px):

| control | size (px) | angle | vs 2.5° |
|---|---|---|---|
| Resume / Bindings / Video Settings / Exit | 610×66 | 13°×1.41° | 56% |
| gap between buttons | 25 (Resume 45) | 0.53° | visionOS wants ≥ 16 pt ≈ 0.67° between stacked buttons |

Binding UI (0.0164°/px; 2.5° = 152 px):

| control | size (px) | angle | vs 2.5° |
|---|---|---|---|
| Back / Options | 144×70 / 140×68 | 1.15° / 1.12° | 46% / 45% |
| App row | 984×156 | 2.56° | OK |
| Show More Applications | 371×65 | 1.07° | 43% |
| Edit / View / Activate | 100×65 | 1.07° | 43% |
| Create New Binding | 269×58 | 0.95° | 38% |
| Action-set tabs | 137×72 | 1.18° | 47% |
| Poses / Haptics | 132×68 | 1.12° | 45% |
| Select / Edit / Developer output / Export / Replace Default | 359×75 | 1.23° | 49% |

**Findings**

1. The page's one primary action, **Play, is 60% of the visionOS target**, and its companion **Play-from caret is a 0.74° sliver**. These are the controls used most on this page.
2. Everything except content tiles (achievements, DLC, community items, collections, event cards) is **0.7–1.5°**. The smallest are exactly the less obvious functions: Compat Details, feature rows, the community item menu, Properties toggles.
3. SteamVR's surfaces are no better in angle, even though their pixel sizes look large: Now Playing's 66 px buttons are 1.41°, the binding UI's 65–75 px buttons 1.07–1.23°.

### B.2 Legibility (em angle; visionOS body ≈ 0.71°)

| text | size and style | em angle | vs 0.71° |
|---|---|---|---|
| Stat labels ("LAST PLAYED"), tab titles, "LOCKED ACHIEVEMENTS" | 12 px Bold, uppercase, tracked .5 px | **0.37°** | 52% |
| Stat values, Play label | 16 px Medium | 0.50° | 70% |
| Section headers ("Activity") | 18 px Medium | 0.56° | 79% |
| Day labels ("SEPTEMBER 29") | 14 px, uppercase, tracked 1 px | 0.43° | 61% |
| Event type ("REGULAR UPDATE") | 13 px uppercase | 0.40° | 56% |
| **Event title** | 18 px **Light (300)** | 0.56° | 79%, thin strokes on glass |
| Event summary | 13 px | 0.40° | 56% |
| Post placeholder | 14 px **italic** | 0.43° | 61% |
| Compat "Details", achievement descriptions (achievements page) | 12 px | 0.37° | 52% |
| Feature rows | 13 px | 0.40° | 56% |
| Properties labels / page title | 16 px / 22 px Bold | 0.50° / 0.68° | 70% / 96% |
| Now Playing buttons / title | 36 px / 72 px Bold | **0.77°** / 1.53° | **108%** / OK |
| Binding UI body (binding labels, descriptions) | 24 px | 0.39° | 55% |
| Binding UI "Last Updated…" | 19.2 px | **0.31°** | 44% |
| Binding UI titles, app names | 36 px Bold **uppercase** | 0.59° | 83%, no word shapes |

**Findings**

- On the game page, all secondary text is **50–60% of visionOS body**, and the most-read labels (stats, tabs, day headers, event types) are tracked uppercase, which removes word shapes.
- The event title uses Light (300), the weakest stroke on translucent glass. visionOS uses Medium for body and Bold for titles.
- Now Playing is the only surface already at visionOS text size. Its problem is shape, colour and target size, not type.
- The binding UI is the least legible surface in this scope: its whole content is 0.31–0.39° text.

### B.3 Is the game page's layout right for the task?

What people do on a game page, most to least often: **play / resume**; check friends, achievements and news; manage (favourites, collections, uninstall); change properties; browse community content.

1. **The first view is right in intent and wrong in proportion.** The hero (47%) and the play bar (11%) give the game identity and put Play first, which matches the TV reference. But:
   - the hero is a letterbox strip, not the window: on the TV page the art *is* the window and the title, metadata and Play sit on it;
   - the play bar is a separate opaque band under the art, so the page reads as "banner + toolbar + web page";
   - only 28% of the window shows tab content at rest, and the content starts with a social post box (Activity is the default tab).
2. **The actions are split across 34° of the window.** Play sits at −15.5°, the controller and gear at +16° and +18°. The Manage menu then opens at the centre, 18° away from the gear. Every "Play / manage" loop sweeps the full width.
3. **One D-pad press moves the whole page.** Down from Play jumps the outer scroller by 277 px (§0.4), and the next tab press by another 99. This is a 38°-wide field moving about 8° and 3°. The bible keeps motion away from the periphery and prefers fade-move-fade for long moves.
4. **Two scrollers.** The outer one scrolls the hero away, the inner one scrolls the tab content. With the laser, wheel input goes to whichever scroller is under the ray; a user on the hero who scrolls moves the outer one only.
5. **The header collides with the page when scrolled.** At the outer maximum the play bar (Play capsule, "Sep 28", "6.3 hours", the two circles) shows through the 40 px header and overlaps "Back" and the search placeholder: two layers of text in one band (`p2_audit_game_scrolled_on.png`, `p2_audit_game_padfocus_on.png`). Stock does the same with a 50% black header (`appdetails_tab_yourstuff_scrolled.png`).
6. **Too many controls look the same.** Tab pills, quick links, section buttons, the post field and the Details button are all small grey rectangles or pills of similar weight. Nothing tells "navigate" (tabs) from "go somewhere else" (quick links open the web view) from "type" (post field).
7. **Properties is a desktop dialog in the window.** 11 pages in a 256 px list, a second title ("Beat Saber"), 46 px fields with 38×22 toggles. visionOS presents per-app settings as Settings-style grouped rows (reference 8).

### B.4 Discoverability and dead ends

1. **The controller button leads to a dead end on this Frame.** "Configure Controller" opens Steam Input's configurator, which showed only "No controller connected." The per-app **VR** controller bindings (SteamVR) are reachable only:
   - while the game runs, from Now Playing › VR Controller Bindings (if Now Playing appears at all, §0.6), or
   - through SteamVR Settings › Controllers › Manage controller bindings (laser only).
   
   A VR player looking for "controls" on the game page finds the wrong system.
2. **Play from** is a 24 px caret attached to Play with no label; many users will not know streaming targets exist.
3. **Hidden until hover or focus:** like/comment (only on the focused card), the community item menu (opacity 0 until hover), event menus (☰ only, no button).
4. **Properties is two steps deep** (gear → Properties…) and the gear has no label. visionOS would show a labelled "…" or a settings circle with a tooltip.
5. **Developer and destructive items look like normal ones:** Uninstall and Remove non-Steam game look like Add to Favorites in the Manage menu; in the binding UI, Replace Default Binding sits beside Select this Binding at equal weight.

### B.5 "Window into another app" seams

1. **Two running-game UIs.** A running game shows either Steam's "Resume + Stop" in the play bar, or SteamVR's Now Playing: a separate full panel with a 72 px title, a gradient-blue primary and a blinking 4 px outline ring. They use different words (Stop vs Exit Game), shapes and focus styles for the same job.
2. **The binding UI is a desktop app in the dashboard frame:** an AllCaps title bar band, an "← BACK" text button, square-ish grey buttons, 0.39° text, a dark gradient page, laser only.
3. **The Manage menu is a centred full-window sheet** with a floating text title, not a menu that grows from the gear.
4. **Properties** reuses the desktop PagedSettingsDialog pattern (the blue-gradient selected item in stock; a white pill in Phase 1).
5. **Uppercase micro-type** everywhere on the game page (stats, tabs, day headers, event types, "LOCKED ACHIEVEMENTS"), against visionOS's title case.

### B.6 Gamepad model

- The game page's gamepad graph is sound and matches the layout (§0.4): Play → Play from → Controller → Manage in a row; Down to tabs; Down into content; Up back. The proposals in §C keep it.
- **Now Playing:** SteamVR's own list focus (Up/Down/A, B = Resume). Its two modals are laser-only inside (B only closes them).
- **The binding UI has no gamepad path at all.** A gamepad user who reaches it (from NP2's "Edit binding / Choose another") must switch to the laser. CSS cannot fix this; it needs work in SteamVR's own React (out of scope, flagged).
- **Three focus styles in one flow:** Steam's white fills on the game page, SteamVR's blue gradient + blinking ring on Now Playing, nothing on the binding UI.

### B.7 Motion versus the Liquid Glass spec

| moment | today | bible / Liquid Glass |
|---|---|---|
| Enter the game page | ≈ 800 ms route transition with 200 ms dead time (shell-nav A.8) | materialize, no dead time (shell-nav C.8) |
| Focus Play | green fill + a `::after` shine **sweep** (clip-path ring, keyframes) | "illuminate from within" (P6): a glow that spreads; shimmer and sweeps are not allowed |
| Press Play | no feedback before the route or launch | press shrinks ≈ 5% on the press spring (420/30) |
| Down from Play | page jumps 277 px | long moves: fade-move-fade; keep motion out of the periphery |
| Tab change | Steam's content transition | segmented selection spring (210/22) on the pill; content cross-fade |
| Manage menu | Steam's entrance keyframe (transform) on a centred sheet | menu bubble grows out of its button (210/19) |
| Achievement focus | Steam animates the item's width/height .15 s | fine (content) |
| Now Playing Resume focus | gradient `background-position` slides 25% → 0% + 4 px ring blinking 20× (≈ 24 s) | no rest motion, no blinking; static ring or glow |
| Focus ring (`%{FocusRing}`) | 20× blink in stock (Phase 1 holds it steady) | keep steady |

### B.8 Materials and stereo versus the brief (Phase 1 state)

- **Play** is a green capsule with a 2 px light ring (`p2_audit_game_top_on.png`). The ring reads as an outline, which the brief rules out.
- **Tabs, the Manage menu and the Now Playing buttons** all carry the uniform inset 1 px ring of the Phase 1 tokens.
- The hero sits under a CSS window glass that **cannot frost the room**. On the scrolled page the window looks like flat grey (`p2_audit_game_padfocus_on.png`).
- **Stereo today:** `theme/layers.json` already pops the Play container (+15 mm), the two play-bar circles (+10 mm), the tab row (+12 mm), menus (+30 mm) and dialogs (+30 mm). But:
  - no focused content card on this page lifts (the `card` rule lists library and search cards only);
  - Now Playing and the binding UI are SteamVR pages, which the native layer does not cover at all.

---

## C. Redesign opportunities, ranked by impact

Impact = how often the user meets it × how far it is from visionOS × how much it fixes size, ergonomics or navigation. Tiers: T1 CSS (incl. layout), T2 DOM augmentation, T3 Steam React views, T4 spatial compositor, T5 glassd.

Rules for every item:

- Steam's and SteamVR's nodes keep their identity, focusability and handlers.
- `glass.py audit` reports 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE ("moved >24px" is expected in Phase 2).
- **D-pad direction matches the visual layout:** reflow only nodes without explicit `flow-children` (§0.5), and never reorder focusable siblings with `order`.
- No outline strokes on glass: edges come from the material (rim light from above), per `references.md` E.2.
- **Depth:** text and art stay on their plane; only controls, ornaments, menus and the focused card pop.

### C.0 Prerequisites and facts found by this audit

1. **Layout is CSS-driven for most nav nodes** (§0.5). This makes T1 layout changes on the play bar safe. It also makes them dangerous where an explicit `onMoveLeft/onMoveRight` exists, as on the tab strip.
2. **Gamepad traversal can be verified unattended:** `BTakeFocus(3)` on a node, then `L.pad` (§0.4). It should become a lab helper (`L.gpTake(surface, sel)`) with the two safety rules from §0.4 built in.
3. **Header seam (B.3 item 5)** must be fixed before any taller hero lands, because a taller hero makes more art scroll under the header. Fix: a scroll-edge fade under the toolbar (`mask-image` on the outer scroller's top 56 px), plus the toolbar redesign in shell-nav C.3.
4. **One of two running-game UIs is visible at a time** and the audit cannot tell which (GQ9). Design both (C.5).

### C.1 Play capsule and one action cluster (highest impact, T1 only)

- **Problem:** B.1 (Play 60%, Play-from 30%, circles 60%), B.3 item 2 (actions spread over 34°), B.4 item 2, B.8 (outlined Play).
- **visionOS pattern:** ref 5 TV: one "Play" capsule with a glyph and a label, and beside it a circle of the same height (✓ / add). Secondary window actions are circles.
- **Proposal** (main CSS px):
  - **Play / Install / Stream / Resume:** a capsule **80 px tall** (2.5°), 280 px wide (never below Steam's 210 px minimum), 28 px glyph, **22 px Bold** title-case label. The only tinted control on the page: `--lgs-tint-play` (green) for Play, Stream and Resume, `--lgs-tint-primary` (blue) for Install and Update. The "Stream from Ben-PC2" two-line label fits in 80 px. **No ring**: focus = brighter fill + inner glow (P6).
  - **Play from:** the 24 px caret becomes a separate **80 px circle** with a chevron-down glyph, 16 px right of the capsule. The container `%{PlayButtonContainer}` stays one element; its grey background goes transparent so the two shapes read separately. Its hit area grows from 24 to 80 px wide.
  - **Configure Controller, Manage:** 80 px circles with 32 px glyphs, **directly after Play-from** (gaps 16 px), not at the far right. Visual order = DOM order (Play, Play from, Controller, Manage), so Right/Left keep their meaning.
    - Mechanism: the `%{StatusAndStats}` block (not focusable) moves after the circles with `order: 1` on it alone. It is a non-focusable sibling, so the ROW navigation (DOM order: action panel, stats, app buttons) still goes Play → … → Manage.
  - **Running state:** Resume uses the same capsule; **Stop** becomes the next 80 px circle, red fill only on focus or hover (Steam's `%{ForceShutdownButton}` red stays).
  - **Stats:** a metadata line in title case to the right of the cluster:
    - "Last played Oct 2", "10.2 hours played", "42 GB required";
    - labels 15 px Medium at `--lgs-text-2`, values 18–20 px Medium at `--lgs-text-1`, no uppercase, no tracking;
    - the private badge stays on the gear circle.
  - **Placement:** Play 64–344, Play from 360–440, Controller 456–536, Manage 552–632. The centres move from −15.5° / +18° to −13.5° … −1.5°, so the gear is next to the screen centre where its menu opens: an 18° jump becomes ≈ 1.5°.
- **Tiers:**
  - T1: sizes, shapes, `order` on the stats block only;
  - T4: Play capsule +15 mm, circles +12 mm, focus lift +5 mm (split `layers.json` "play" into `%{PlayButtonContainer>PlayButton}` and a new `%{StreamingSelector}` circle; "app-button" stays);
  - T5: the Play slab as **tinted** Liquid Glass (green in the glass, not a flat fill), which needs a tint per slab in `glassd.json` (GQ8).
- **Retention:**
  - same elements, same click and A handlers;
  - `min-width:210px` on the button is only exceeded, never reduced;
  - the Disabled, Launching and Stream variants and the Steam `::after` keep existing. The `::after` is restyled from a sweep into a static inner glow (Steam-owned pseudo: restyle, don't add).
- **Verify:**
  - shots `p2_game_play_*` on 620980 (Play), 751630 (Install), 377160 (Stream from PC), 2258399336 (shortcut, no Play-from);
  - `audit main --route /library/app/<id>` for each;
  - the §0.4 traversal (Right ×3 must reach Play from, Controller, Manage in that order; Left ×3 back);
  - `hvgrab` for the depth.
  - Running state: a static mock with Steam's classes (`%{ShutdownAppButton}`, Resume label) hosted like shell.md's synthetic dialogs (GQ10).

### C.2 The game page becomes a full-bleed title page (TV reference)

- **Problem:** B.3 items 1, 3, 4, 5; B.5.
- **visionOS pattern:** ref 5: the art fills the window. Logo, metadata, synopsis, the Play capsule and a circle sit at the lower left over a darkened part of the art. The back circle is in the top-left corner. Circular actions are in the top-right corner. A row of content peeks at the bottom edge.
- **Proposal (rest state, main CSS px):**

  | element | today | proposed |
  |---|---|---|
  | hero `%{TopCapsule}` | 0–336 | **0–560** (78% of H). The 1920×620 hero is cropped to 2.29:1 (≈ 74% of its width shown); it is upscaled ≈ 1.35× in texture px but still finer than the headset's ≈ 25 px/° |
  | darkening | `%{TopCapsule>TopGradient}` (top 75 px only) | `%{TopCapsule}::after` (free per the inventory): bottom-up dim, black 55% → 0 over the lower 45%. This is the bible's 35–55% dim layer for Clear glass over media |
  | logo | inline-placed box over the whole hero | constrain **`%{BoxSizerContainer}`** (never the inline `%{BoxSizer}`) to a lower-left region x 64–624, y 200–420; CenterCenter / BottomLeft / UpperLeft assets then land inside it |
  | "VR required" badge | 1130,274 | a glass chip at the top of the metadata line |
  | play bar | separate band 336–416 | **overlaid on the hero**: `%{PlaySection}` `margin-top: −128px`, transparent; Play row at y 448–528 (centre −4° below the window centre, slightly below eye line as the bible prefers) |
  | Steam Cloud row | 30 px band | a 15 px caption chip in the metadata line area; it keeps its own Panel and its states |
  | tab row | 416–474 band | a segmented-control capsule **straddling the hero's bottom edge** at y ≈ 552–616 (C.3) |
  | content | 474–678 (28%) | starts at ≈ 624; the section header ("Activity") peeks above the footer as the "more below" cue |

- **Scrolled state:**
  - The hero dims as it scrolls away: a **scroll-driven** opacity animation (`animation-timeline: scroll()` on the outer scroller), 1 → 0.35 over the first 400 px. The 277–520 px jump of a D-pad press then reads as a depth change, not a slide (bible: fade-move-fade).
  - The tab capsule pins under the toolbar. Content passes under it with a scroll-edge fade, not Steam's opaque blurred band.
- **Shortcuts without art** (`%{FallbackArt}`): the same 560 px region shows the blurred capsule art (Steam already renders `%{ImgBlur}` copies) with the name in 40 px Bold.
- **Why this is the right experience, not only a look:**
  - the page's job is "this game, play it"; the TV composition puts identity and the primary action in one glance at the eye line;
  - the actions cluster (C.1) is within −14° … −1°;
  - content is one D-pad press away, as today.
- **Tiers:**
  - T1: sizes, overlay, dim, scroll-driven dim;
  - T4: Play cluster and tab capsule popped; the hero and logo stay flat (art and title have no depth);
  - T5: the toolbar over the hero is **Clear** glass (low tint, strong lensing) over a dimmed area, as the bible requires for media-rich backgrounds.
- **Retention:**
  - no Steam node moves in the DOM;
  - `overflow` of both scrollers unchanged;
  - the inline logo geometry untouched;
  - the hero stays non-interactive, so the overlapped play bar covers no control (`z-index` only above the art).
- **Verify:**
  - shots at scroll 0 / mid / max on 620980, 546560 (cloud row), 751630 (not installed), 2258399336 (fallback art), 377160 (stream);
  - audit per route;
  - the §0.4 traversal: Down from Play must reach the tabs and pin them; Up must come back to Play with the hero visible;
  - `perf main --route /library/app/620980` (scroll-driven opacity must not cost frames);
  - hvgrab for the dim and depth.
- **Open:** GQ1 (taller hero vs pinning, scroll-into-view and laser tab clicks), GQ2 (logo region for all asset anchors), GQ3 (scroll-driven animation cost and interplay with Steam's `HeaderLoaded` opacity transition).

### C.3 Section tabs become a glass segmented control (not a vertical tab ornament)

- **Problem:** B.1 (tabs 1.05°, arrows 0.99°), B.2 (12 px uppercase), B.8 (outlined pills, pinned band).
- **Evaluation of the TV reference's vertical tab ornament for these tabs:**
  - Rejected for the game page. The vertical ornament outside the left edge is visionOS's slot for the **app's main navigation**. On the Frame that slot already holds Steam's VR main menu, which shell-nav C.2 turns into exactly that ornament. Two vertical bars on one edge would compete.
  - The four tabs are **sections of one item**. visionOS draws those as a segmented control (Photos' Years / Months / All; the TV page itself uses scrolling sections, not tabs).
  - The tab strip has explicit `onMoveLeft/onMoveRight` handlers (§0.5). In a vertical column, Up/Down would move focus while Left/Right still switched tabs: a D-pad mismatch.
  - An ornament outside the window needs a T4 crop moved off its x/y with routed input (shell-nav CQ4) or a T3 view.
  - Keep it as a later option only if CQ4 lands, and then on the window's bottom edge (horizontal), not the left.
- **Proposal:**
  - One Liquid Glass capsule, **64 px tall** (2.0°; the hit area grows to 80 px with transparent padding inside the tab element), segments ≥ 140 px wide, labels **18–20 px Medium, title case** (`text-transform: none; letter-spacing: 0`).
  - The Game Info compat icon stays inside its segment.
  - Selected segment = the white pill with a dark label (DESIGN §3; `references.md` H.2 agrees that white suits the selected segment of a segmented control).
  - Focus = the pill plus a lift (T4 +5 mm) and an inner glow, no ring.
  - Arrows ‹ › become 64 px circles at the two ends of the capsule (`%{TabRow}` `justify-content: center` + gap). They are laser-only Panels today and stay so.
  - Rest position: straddling the hero's bottom edge (C.2). Pinned: under the toolbar. Steam's own `::before` band (`%{TabHeaderRowWrapper}::before`) is restyled to transparent, plus a scroll-edge fade on the inner scroller top.
  - Motion: segmented-selection spring (210/22) on a moving pill. That needs a T2 decorative element (pointer-events none, outside the nav tree) that translates to the selected tab's rect; otherwise a 140 ms cross-fade of the pill.
- **Same treatment:** the achievements page's My / Global tabs; library tabs (library audit).
- **Tiers:** T1 (shape, size, case), T2 (moving pill, optional), T4 (+12 mm at rest, +20 mm pinned), T5 (capsule slab).
- **Verify:** shots at rest and pinned on all four tabs; audit; traversal Down from Play then Right ×3 / Left ×3; LB/RB (GQ4).

### C.4 The Manage menu grows from the gear

- **Problem:** B.1 (rows 1.48°), B.3 item 2 (18° jump), B.4 items 4–5, B.5 item 3.
- **visionOS pattern:** a menu bubble that grows out of its button; rows ≈ 44–52 pt; destructive items red.
- **Proposal:**
  - Rows **64 px** (2.0°), labels 20 px Medium; submenu chevrons at `--lgs-text-2`.
  - The title ("Beat Saber", the submenu name) becomes a header row **inside** the slab (22 px Bold), not floating above it.
  - **Destructive items get a red label at rest** and a red fill on focus: Uninstall, Remove non-Steam game, Delete Proton Files, Remove from account. Hide this game and Mark as Private stay neutral.
  - Separators become spacing (8 px) rather than lines.
  - Cancel becomes a tertiary row. Steam always appends it; it is kept.
  - The submenu column is a second slab adjoining the first.
  - Thick glass, `--lgs-r-menu`, no rim ring; depth +30 mm (`layers.json` "menu" already).
  - **Anchoring:** Steam's VR presentation is always centred. With C.1 the gear sits ≈ 1.5° from the centre, so the centred sheet already appears next to its button.
    - True anchoring stays research (shell-nav CQ10).
    - The bubble motion is T5: glassd ramps lensing and frost in from the gear's rect. Steam's own entrance keyframe on `%{BasicContextMenuContainer}` must not be overridden.
- **Same treatment:** the Play-from menu (two target rows with the blue check as a whole-fill circle).
- **Verify:**
  - MANAGE, SUBMENU (each of the three), NOT INSTALLED and SHORTCUT menu shots (`appdetails.md` §4 recipes, look only, close with the CANCEL event);
  - audit with the menu open;
  - pad Up/Down/Right inside the menu.

### C.5 One "Now Playing" card for a running game (Steam and SteamVR)

- **Problem:** B.5 item 1, B.1 (NP 1.41°), B.6, B.7 (sliding gradient, blinking ring).
- **visionOS pattern:** ref 11's playback ornament and ref 5's Play capsule: art, a bold title, one tinted primary, circular or capsule secondaries, and no outline.
- **Now Playing proposal** (NP px; 0.0213°/px; inside `#nowplayingpanel`, whose box never changes because it is the quad):
  - **Background:** the panel becomes window glass. The game art, blurred, fills it (SteamVR's own `.HeroBackground` rule exists but is not rendered in this build). T2: copy the inline art URL of `.Icon` into a CSS variable on `.NowPlaying` so a decorative layer can use it (GQ7).
  - **Art column:** 500×750 stays; radius 32 (concentric).
  - **Title:** 64 px Bold (1.36°), one or two lines; margins reduced from 70/100 to 40/56.
  - **Buttons:** stay one **vertical stack**, because SteamVR's gamepad moves Up/Down in list order (§0.5).
    - **Resume Game:** **120 px** capsule (2.56°), 40 px Bold label, `--lgs-tint-play`.
    - **VR Controller Bindings, VR Video Settings:** 100 px capsules (2.1°), fill-2, 34 px labels.
    - **Exit Game:** 100 px, separated by an extra 40 px, red label and red fill on hover / focus only.
    - Gaps **32 px** (0.68°, the visionOS minimum between stacked buttons).
    - Total ≈ 590 px, which fits the 917 px inner height with the title.
  - **Focus:** SteamVR's `::after` ring becomes a static soft ring at most. The 20× `Blinker` and the `background-position` slide go. `::before` (hover shadow) is restyled as an inner glow.
  - **The two modals:** SteamVR settings modals, styled with SteamVR settings (theme/vr/30-settings.css, owned elsewhere). Flag their gamepad gap: B closes, nothing else works.
- **Steam path (play bar Resume / Stop):** uses the same words and shapes as C.1: Resume capsule in the play tint (today it turns blue on focus) and Stop as a circle that turns red on focus. "Stop" vs "Exit Game" are Steam's and SteamVR's own strings and stay. T2 may add an `aria-label` but must not rename them.
- **Tiers:**
  - T1 (both pages);
  - T2 (art variable);
  - T4/T5 for Now Playing need the native layer to cover a **systemui** panel. Today `lgs_sg.js` reparents only to Steam overlays (GQ6).
- **Verify:**
  - `np_open.js`, `np_states.js` and `np_resumefocus.js` with the showcase (LAB.md rules: only if `driver.py status` says inactive; stop it after);
  - `audit vr:systemui`;
  - the panel-size check in `steamvr.md` §7 (identical with the theme on and off);
  - two shots 1.5 s apart with focus on Resume must be pixel-identical (no rest motion).

### C.6 Tab content: legible type, real buttons, visible secondary actions

- **Problem:** B.1 (Details 0.90°, feature rows 0.74°, quick links 1.33°, community menu 0.87° and invisible), B.2, B.3 item 6, B.4 item 3.
- **Proposal** (main CSS px):

  | element | today | proposed |
  |---|---|---|
  | section headers | 18 px Medium | 26 px Bold |
  | day labels | 14 px uppercase, tracked | 17 px Semibold, title case, `--lgs-text-2` |
  | event type | 13 px uppercase | 15 px Medium, title case, `--lgs-text-2` |
  | event title | 18 px **Light** | 22 px **Medium** |
  | event summary | 13 px | 17 px; Steam's inline 2-line clamp stays (it clamps whatever the size) |
  | post field | 37 px, italic placeholder | 56 px recessed capsule, upright placeholder 18 px |
  | like / comment | shown only on the focused card | 48 px capsules; still revealed by focus (Steam's opacity rule) but with a 140 ms materialize |
  | "LOCKED ACHIEVEMENTS", progress line | 12 px uppercase / 4 px bar | 15 px title case / 12 px capsule progress |
  | section buttons, New Note | 40–44 px | 56 px capsules, 18 px labels |
  | Game Info quick links | 128×43 grey rectangles | 64 px capsules with a leading glyph (T2 decorative icon per link). They open the web view, so they read as "go somewhere": capsules with a trailing ↗ glyph |
  | compat "Details" | 66×29, 12 px | 56 px capsule, 17 px |
  | feature rows | 24 px, 13 px | 44 px rows, 16 px, glyph 20 px |
  | community item menu | 28 px, opacity 0 until hover | 48 px circle, opacity 0.6 at rest (raising Steam's opacity is allowed; lowering is not), 1 on hover |

- **Not changed:**
  - achievement carousel items (Steam animates their width and height);
  - trading cards (inline transforms);
  - DLC tiles and collections (content, already ≥ 2.7°).
  
  Inside the carousel, text may grow by at most 2 px, because the item's size is Steam's.
- **Depth:** add the focused content cards of this page to `layers.json` "card" (lift +8 mm): `%{Event}.gpfocus`, `%{AchievementCarouselItem}.gpfocus`, `%{DLCSection>Item}.gpfocus`, `%{CommunityItem}.gpfocus`, `%{Anchor}:focus-within`, `%{Collection}.gpfocus`.
- **Verify:**
  - shots of every tab (Activity with a large and a small event, Friends who play on 377160, Your Stuff with Workshop 546560 and Trading Cards 2379780, Community, Game Info);
  - audit per tab route (CONTRAST and SHRUNK must stay 0);
  - the traversal into each tab;
  - `perf main --route /library/app/620980/tab/Community` (infinite grid).

### C.7 Properties becomes visionOS Settings (coordinate with the settings audit)

- **Problem:** B.1 (rows 1.30–1.43°, toggles 0.68°), B.3 item 7, B.5 item 4.
- **visionOS pattern:** ref 8: a full-height sidebar of rows with circular coloured icon chips, the selected row a raised capsule, a centred title, grouped recessed rows with inset hairlines.
- **Proposal:**
  - **Sidebar** (`%{PagedSettingsDialog_PageListColumn}`):
    - 256 → **336 px** wide, full-height tone shift, no inset box;
    - large title (the game's name) 30 px Bold;
    - rows **60 px** with 32 px **circular icon chips** (T2: a decorative `::before` keyed by a `data-lgs-page` attribute read from each item's React props, not from its localized text);
    - Steam's `%{ScaledChildren}` `scale(1.1)` on the active item stays.
    - Selected-row treatment follows the bible owner's decision on `references.md` H.2 (raised translucent capsule per the references, or the white pill per DESIGN §3).
  - **Content:**
    - page title centred, 26 px Bold;
    - grouped sections as recessed platters (`--lgs-fill-sunken` polarity, `references.md` E.8) with **60 px** rows, labels 18 px Medium, descriptions 15 px at `--lgs-text-2`;
    - **toggles scaled with the independent `scale: 1.3`**: Steam's knob travel and transform stay internal, and the hit rect grows to ≈ 49×29 (GQ5);
    - dropdowns and text inputs as 56 px capsules.
  - Long pages (DLC, Privacy, Workshop) keep their own scrollers.
- **Tiers:** T1, T2 (icon chips), T5 none (the sidebar is part of the window plane; visionOS sidebars do not float).
- **Verify:** `appdetails_props_<page>` recipes for all 12 pages (look only: never toggle or pick); audit per page; pad Up/Down in the page list (no Left/Right on these pages, per LAB.md).

### C.8 Controller: remove the dead end (needs the user's approval for the addition)

- **Problem:** B.4 item 1.
- **Proposal:**
  1. **T1 (no approval needed):** the Controller circle shows its name on hover and focus (a glass tooltip from `aria-label`, "Configure Controller"), so it is not mistaken for VR bindings.
  2. **T3 addition (approval needed: it adds a function, though it changes none):**
     - for games with VR support (`VR required` / `VR Support` feature), a fourth circle, **"VR Bindings"**, after Configure Controller;
     - it opens SteamVR's binding UI on this app's binding list: the `show_app_binding` mailbox message plus switching the Steam dashboard frame to page 2;
     - first-class focusable node in the same ROW, so Right from Controller reaches it;
     - this is the only path to per-app VR bindings while the game is not running.
- **Verify:** GQ11 (deep link side-effect free: navigation only, no `SelectConfig`); traversal; `shot vr:controllerbindingui` after the deep link; return to the app list with `inputUI.ShowAppSelect()`.

### C.9 Achievements page

- **Proposal:**
  - Header: box art left (radius 16), the game title 34 px Bold. The stats block becomes a progress capsule (12 px track, `--lgs-text-1` fill) with title-case metadata ("1 of 26 earned · 10.2 hrs · 53 min in the last two weeks").
  - **Leaderboards** becomes a 56 px capsule.
  - Tabs: the C.3 segmented control.
  - **Search:** a 56 px recessed capsule with a magnifier.
  - Rows: 80 px stay (2.48°); description 12 → 16 px; unlock date 15 px secondary; "LOCKED ACHIEVEMENTS" in title case.
  - The global-% fill (Steam-set width) becomes a recessed tint.
- **Verify:** `appdetails_achievements_my/global` recipes; audit; traversal (tabs, search, rows).

### C.10 SteamVR binding UI: a visionOS window, still laser-only

- **Problem:** B.1 (1.0–1.2° buttons), B.2 (0.31–0.39° text, uppercase titles), B.5 item 2, B.4 item 5.
- **Proposal** (binding px; 0.0164°/px; inside the page, never `body`):
  - **Title bar → toolbar:** height 108 → 140; **Back as a 128 px circle** (2.1°) with a chevron; title in title case, 44 px Bold (0.72°); subtitle 30 px secondary; Options as a 128 px "⋯" circle with its label in a tooltip. Hiding Steam text trips the audit, so the "Options" label stays visible beside the glyph if needed.
  - **App select:** rows stay 156 px; names in title case, 40 px Bold; art radius 24; "Show More Applications" becomes a 112 px capsule.
  - **List:**
    - Current Binding and Current Controller become one grouped platter;
    - community bindings become two-line list rows (name 36 px Medium, description 28 px, "Last updated" 24 px secondary instead of 19.2);
    - View / Activate become **112 px** capsules (1.84°); Create New Binding a 112 px capsule.
  - **View:**
    - action-set tabs become a horizontally scrolling segmented control, 96 px tall, 28 px title case; warning / error tabs become a tinted segment with a count badge circle;
    - binding text 24 → 30 px; "USE AS BUTTON" in title case, 26 px Bold secondary;
    - the bottom row becomes 112 px capsules. **Select this Binding** is the tinted primary, but only on a binding that is not already active.
    - Show Developer output, Export Binding File and Replace Default Binding take a quieter secondary style to the right of the existing divider. They stay visible and in place.
  - Window glass on `.InputContainer`, as Phase 1 does.
- **Gamepad gap:** none of this adds a gamepad path. Flag it to the SteamVR owner as T3-level work in SteamVR's own React (out of scope here).
- **Verify:**
  - `bind_list.js`, `bind_view.js` (or this audit's measuring pre, which also returns to the app list after 6 s);
  - `audit vr:controllerbindingui`;
  - a text-overflow check: no `.BindingLabel` wider than its column with the theme on.

### C.11 Motion for these surfaces (Liquid Glass springs, CSS-exact)

CEF here is Chrome 126, so CSS `linear()` easing can encode the bible's springs exactly, instead of the overshooting béziers in `00-tokens.nowrap.css`. Computed for mass 1, sampled at 17 points (proposal for the foundation owner):

| bible spring | k / c | ζ | settles (±0.5%) | overshoot | `linear()` |
|---|---|---|---|---|---|
| hover | 260 / 30 | 0.93 | 380 ms | 0% | `linear(0, .058, .186, .331, .471, .596, .698, .780, .842, .889, .924, .948, .966, .978, .986, .992, 1)` |
| press | 420 / 30 | 0.73 | 350 ms | 3.3% | `linear(0, .080, .257, .452, .632, .781, .887, .960, 1.003, 1.025, 1.033, 1.032, 1.027, 1.021, 1.014, 1.009, 1)` |
| segmented selection | 210 / 22 | 0.76 | 500 ms | 2.5% | `linear(0, .082, .255, .450, .628, .771, .876, .947, .990, 1.014, 1.023, 1.025, 1.022, 1.017, 1.013, 1.008, 1)` |
| menu bubble | 210 / 19 | 0.66 | 470 ms | 6.5% | `linear(0, .074, .242, .443, .632, .789, .908, .990, 1.038, 1.060, 1.065, 1.058, 1.047, 1.034, 1.022, 1.012, 1)` |
| materialize / toast | 140 / 20 | 0.85 | 575 ms | 0.7% | `linear(0, .072, .226, .400, .558, .693, .798, .874, .927, .962, .984, .997, 1.003, 1.006, 1.007, 1.006, 1)` |

Applied here:

- Play and the circles: hover / focus glow on *hover*. Press `scale: .95` on *press*: the independent property, never `transform`.
- Tab pill: *segmented selection*.
- Manage menu: Steam's entrance stays. The slab's lensing and frost ramp is T5 *materialize* (glassd needs a per-slab "born" time or `mat` value in `glassd.json`; GQ8).
- Like / comment reveal and the hero dim: *materialize* / scroll-driven.
- Now Playing: *hover* for fills, no sweeps, no blinking.
- Reduced motion keeps every duration at 1 ms.
- CSS can only scale and fade. The bible's "materialize = lensing ramps in" exists only in glassd.

### C.12 Stereo layer plan (`theme/layers.json`, surface `main`)

| layer | today | proposed dz (m) | lift (focus) |
|---|---|---|---|
| Play capsule | "play" = whole `%{PlayButtonContainer}`, 0.015 | `%{PlayButtonContainer>PlayButton}` 0.015 | +0.005 |
| Play-from circle | inside "play" | new: `%{StreamingSelector}` 0.012 | +0.004 |
| Controller, Manage, (Stop), (VR Bindings) | "app-button" 0.010 | 0.012 | +0.004 |
| tab segmented control | "tabs" 0.012 | 0.012 at rest, 0.020 pinned (a pinned selector variant) | — |
| focused content card | not covered on this page | add to "card" (C.6) | +0.008 |
| Manage / Play-from menu | "menu" 0.03 | keep | — |
| compat modal | "sheet" 0.03 | keep | — |
| hero art, logo, metadata, tab text | — | **0** (art and text stay on the window plane) | — |

Now Playing and the binding UI are SteamVR pages. They get depth only if the native layer learns to cover systemui panels (GQ6).

### Summary ranking

| rank | opportunity | main fix | tiers | blocking question |
|---|---|---|---|---|
| 1 | C.1 Play capsule + action cluster | size of the #1 action, 34° spread, Play-from sliver | T1 (T4 T5) | GQ8 (tinted slab), GQ10 (running mock) |
| 2 | C.2 Full-bleed title page | identity + hierarchy, header seam, big-jump motion | T1 T4 T5 | GQ1, GQ2, GQ3 |
| 3 | C.3 Tabs as segmented control | 1.05° tabs, uppercase, band | T1 (T2) T4 T5 | GQ4 |
| 4 | C.4 Manage menu bubble | row size, destructive safety, 18° jump | T1 T4 T5 | shell-nav CQ10 |
| 5 | C.5 One Now Playing card | two running UIs, 1.41° buttons, blinking | T1 T2 (T4 T5) | GQ6, GQ7, GQ9 |
| 6 | C.6 Tab content legibility | 0.37–0.43° text, tiny secondary targets | T1 T2 T4 | — |
| 7 | C.7 Properties as Settings | 0.68° toggles, desktop dialog | T1 T2 | GQ5; settings owner |
| 8 | C.8 Controller dead end | wrong system behind the button | T1; T3 (approval) | GQ11 |
| 9 | C.9 Achievements page | 12 px text, small controls | T1 | — |
| 10 | C.10 Binding UI | 0.31–0.39° text, 1.1° buttons | T1 | — (gamepad gap flagged) |
| 11 | C.11 Motion (cross-cutting) | springs, no sweeps or blinking | T1 T5 | GQ8 |
| 12 | C.12 Stereo plan (cross-cutting) | depth hierarchy | T4 | GQ6 |

### Capability questions for `docs/phase2/capabilities/`

| id | question |
|---|---|
| GQ1 | With `%{TopCapsule}` at 560 px and `%{PlaySection}` overlaid (`margin-top:-128px`), do the tab-row pin (`%{GamepadTabbedPage>Pinned}`, `%{ScrolledDown}`), Steam's scroll-into-view on D-pad focus, and the mirrored backdrop still behave? Does a **laser** click on a tab scroll the content into view, or must the user scroll the outer scroller first? |
| GQ2 | Does constraining `%{BoxSizerContainer}` (not the inline `%{BoxSizer}`) keep CenterCenter, BottomLeft and UpperLeft logos and `%{FallbackArt}` inside the lower-left region on 620980, 546560, 377160 and 2258399336? |
| GQ3 | Cost and safety of a scroll-driven opacity animation on the hero (`animation-timeline: scroll()` on the outer scroller): `perf` within 5%, no conflict with Steam's `HeaderLoaded` opacity transition? |
| GQ4 | Do LB/RB switch the game page's tabs (and the achievements page's), and does the segmented restyle (arrows moved next to the capsule) keep laser clicks on the arrows working? |
| GQ5 | Does the independent `scale` on `%{*GamepadDialogContent>Toggle}` keep Steam's knob animation and grow the hit rect (audit SHRUNK 0, `elementFromPoint` at the scaled edge)? |
| GQ6 | Can `lgs_sg.js` place glassd covers, slabs and crops on a **systemui** panel (`#nowplayingpanel`, parent key `system.systemui`), not only on Steam overlays? |
| GQ7 | Can a T2 decorative attribute or variable be written into SteamVR's systemui DOM (Now Playing art URL) and survive React re-renders, without touching panel roots or row 0? |
| GQ8 | Can `glassd.json` carry a per-slab tint (green Play, blue Install) and a per-slab materialize start time, so the primary is tinted glass and slabs ramp in instead of popping? |
| GQ9 | Which running-game UI appears for a Steam-launched VR game on this Frame: Steam's Resume / Stop and frame menu, SteamVR's Now Playing, or both? (Inventories disagree; read `SteamClient.OpenVR` capability 23 handling at runtime without launching anything.) |
| GQ10 | A lab host to render Steam's running-state play bar (Resume + `%{ShutdownAppButton}`, Launching throbber) as a static mock with no-op handlers, like shell.md's synthetic dialogs. |
| GQ11 | Is opening SteamVR's binding UI for one app (mailbox `show_app_binding` + switching the dashboard frame to page 2) navigation-only (no `SelectConfig`, no settings write), and can a T3 node in Steam's play bar trigger it? |

Shell-nav questions this audit also depends on: CQ1 (taller header / toolbar), CQ4 (crops off their x/y with routed input; needed for any ornament outside the window), CQ10 (anchored menus).
