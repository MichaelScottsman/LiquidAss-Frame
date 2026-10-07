# Coverage: area `shell` (`theme/20-shell.css`, surface `main`)

The dashboard window itself and the chrome around every route:

- the window glass;
- transparent page roots;
- Liquid Glass header capsules (Back, search);
- the in-window footer legend capsule;
- page transitions and the app-details scrim;
- the search route's chrome and result tiles.

All shots are in `shots/` (1.5x). Transparent pixels are the room. Preview them over a room colour; the Read tool shows them over black or white.

Reproduction snippets (HOME, FOOTER, TITLE, SEARCH, CONFIRM, MENU) are the ones in `docs/inventory/shell.md` §0.2. Extra ones used here:

| id | `--pre` |
|---|---|
| SCROLL(route, y) | `L.nav(route)`, wait 1.8 s, set `scrollTop = y` on the largest vertical scroller, restore it after 4 s |
| TILEFOCUS | SEARCH('half','All') then `await L.pad('down',2)`. Focus lands on `%{ResultTemplateImage}` |
| TABFOCUS | SEARCH('half','All') then `await L.pad('down',1)`. Focus lands on the selected `%{GamepadTabbedPage>Tab}` |
| FIELDFOCUS | SEARCH('half','All') plus a temporary `gpfocuswithin` class on `%{SearchAndTitleContainer}`, removed after 4.5 s. Real focus raises the VR keyboard and navigates, so it is simulated with Steam's own class |

## 1. Screens and states

Audit numbers are from the final CSS. They are `python glass.py audit main ...`, run with every theme file on.

| screen / state | how to reach | before | after | audit | notes |
|---|---|---|---|---|---|
| Window glass: Home | `--route /library/home` | `shell_library_home_before`, `_before2` | `shell_library_home_after` | 0 GONE/HIDDEN/SHRUNK/UNCLICKABLE. 8 CONTRAST, all library content (see §4) | `%{BasicUiRoot}` paints the window sheen + window bg, radius 32. Its rim is drawn on top of everything by a click-through `::after`. `%{BasicHome}%{OpaqueBackground}` is cleared |
| Home scrolled (content under header) | SCROLL('/library/home', 420) | `shell_home_scrolled_before` | `shell_home_scrolled_after` | as Home | Capsules float over content and blur it. The pinned WHAT'S NEW row (library) tucks under the search capsule, as it did under Steam's bar |
| Header idle (Back + search placeholder) | HOME | `shell_library_home_before` | `shell_library_home_after` | 0 issues on header elements | Two Liquid Glass capsules: sheen + glass tint over the scrim, rim, shadow, 22px blur. Placeholder and icon are `--lgs-text-2`; Back is `--lgs-text-1` |
| Header over a full-bleed hero | `--route /library/app/620980` | `shell_route_gamepage_before` | `shell_route_gamepage_after` | 0 issues | Both capsules really blur the hero (see §3) |
| Header over a scrolled game page | SCROLL('/library/app/620980', 500) | `shell_gamepage_scrolled_before` | `shell_gamepage_scrolled_after` | 0 issues | Play bar slides under the capsules blurred. Stock showed it sharp through the text |
| Search filled (text / on /search) | SEARCH('half','All') | `shell_search_results_before` | `shell_search_results_after` | 0 issues | Steam's grey `#b8bcbf` field becomes the same capsule with a brighter face (`--lgs-fill-2` layer). Text and caret are white. The clear (x) button is a `--lgs-fill-3` circle |
| Search field focused | FIELDFOCUS | n/a (not capturable stock) | `shell_search_focus_after` | n/a | Focus face + full `--lgs-focus-ring`. Real focus opens the keyboard, so it was simulated with the class |
| Search field hover (laser) | CSS only | n/a | n/a | n/a | Hover face (`--lgs-hover-fill` layer); icon and placeholder go `--lgs-text-1`. Synthetic events can't set `:hover` |
| Back hover / pressed (laser) | CSS only | n/a | n/a | n/a | Hover face / `--lgs-pressed-fill` face. Back is not gamepad-focusable (Steam) |
| Title mode | TITLE (`--route /controller/calibration/0`) | `shell_header_title_before` | `shell_header_title_after` | 0 issues | Back capsule, title as `--lgs-text-1` with text shadow, no capsule behind the title |
| Footer legend, 5 actions | FOOTER (`--route /library/tab/AllGames`) | `shell_footer_legend_before` | `shell_footer_legend_after` | 0 GONE/…; 5 CONTRAST on library `%{TabCount}` (§4) | Full-width black strip removed. One Liquid Glass capsule hugs the legend items (CSS anchors on the first and last `%{ActionButtonLegend}`) and blurs the grid under it. Item hover/pressed are capsule fills |
| Footer legend, 1 action | TITLE | `shell_header_title_before` | `shell_header_title_after` | 0 issues | The same capsule around a single "B Back" |
| Footer over a modal | CONFIRM (on AllGames) | `shell_modal_confirm_before` | `shell_modal_confirm_after` | 0 GONE/…; CONTRAST only on library `%{TabCount}` behind the scrim | Header and footer capsules stay crisp above the scrim (Steam z-order unchanged). Dialog chrome is primitives' |
| Context menu over the window | MENU | `shell_contextmenu_before` | `shell_contextmenu_after` | 0 GONE/…; CONTRAST only on library content behind the scrim | Menu chrome is primitives'. Window, rim and capsules are correct around it |
| Footer variants `%{WithKeyboard}`, `%{QuickAccessFooter}`, `%{Relative}`, `%{PopupBody>Opaque}` | CSS only | n/a | n/a | n/a | Same rules apply (anchors follow whatever items exist) |
| Page transitions (`%{TopLevelTransitionSwitch}` / `%{ContentWrapper}%{TopLevelTransition}` / `%{AbsoluteDiv}`) | any route change | n/a | n/a | n/a | Kept transparent. Steam's opacity + transform animations untouched |
| App-details / partner-event scrim | CSS only (What's New is empty, nothing opens it) | n/a | n/a | n/a | `%{PartnerEventOverlayContainer} %{Container>TransitionWrapper}` is `--lgs-scrim`. Verified computed `rgba(0,0,0,.35)`. Steam's opacity/backdrop transitions stay |
| Search results (All) | SEARCH('half','All') | `shell_search_results_before` | `shell_search_results_after` | **0 issues** | Tiles are content: opaque, `--lgs-r-card`. Label rows are `--lgs-text-2` |
| Search tile focused | TILEFOCUS | `shell_search_tilefocus_before` | `shell_search_tilefocus_after` | (as results) | `--lgs-focus-ring-outer` + glass shadow around the art. Steam's scale-up kept; the label goes `--lgs-text-1` |
| Search tab row | SEARCH('half','All') | `shell_search_results_before` | `shell_search_results_after` | 0 issues (the `%{TabCount}` CONTRAST is fixed here) | Segments in one Liquid Glass capsule (anchored `::after` of the 3D-root row wrapper, so it blurs). Selected = white pill with dark label. Counts are `--lgs-text-2` |
| Search tab focused | TABFOCUS | `shell_search_tabfocus_before` | `shell_search_tabfocus_after` | 0 issues | White pill + scrim gap + white ring + glow: distinct from merely selected |
| Search scrolled (pinned row, View more) | SEARCH('half','All') + scroll to bottom | `shell_search_viewmore_before` | `shell_search_viewmore_after` | **0 issues** | Steam's hard-edged pinned band becomes a soft scroll edge (window tint + blur faded by a mask). "View more in the Store" is a glass fill tile with rim |
| Search empty query | SEARCH('','All') | `shell_search_empty_before` | `shell_search_empty_after` | **0 issues** | |
| Search no results | SEARCH('zzqxjvkw','All') | `shell_search_noresults_before` | `shell_search_noresults_after` | **0 issues** | "No Results Found" in `--lgs-text-2` |
| Search friends | SEARCH('a','Friends') | `shell_search_friends_before` | `shell_search_friends_after` | **0 issues** | Profile background and avatar tiles rounded |
| Search store | SEARCH('half','Store') | `shell_search_store_before` | `shell_search_store_after` | **0 issues** | |
| Settings on the window | `--route /settings/system` | `shell_route_settings_before` | `shell_route_settings_after` | 0 issues | Reads well. Its opaque panels are the settings area's |
| Friends & chat on the window | `--route /chat` | `shell_route_chat_before` | `shell_route_chat_after` | 0 issues | `%{TrueBlackBackground}` cleared. `multiChatDialog`'s gradient is social's |
| Downloads on the window | `--route /library/downloads` | `shell_route_downloads_before` | `shell_route_downloads_after` | 0 GONE/…; 4 CONTRAST, social content (§4) | `%{DownloadsPage}` root cleared. The top section is social's |
| Media on the window | `--route /media/grid` | `shell_route_media_before` | `shell_route_media_after` | 0 issues | |
| Transparent-background routes (`/apprunning`, `/keyboard`, overlay, web views) | CSS only (no app was running) | n/a | n/a | n/a | `%{BasicUiRoot}:has(> … %{BasicHome}%{PopupBody>TransparentBackground})` keeps the window clear and drops the rim. Verified the rule is in the injected sheet |
| High contrast | CSS only (it's a setting; not toggled) | n/a | n/a | n/a | The header bar comes back as `--lgs-thick-bg`; the footer capsule goes solid without blur. The tokens raise every alpha |

## 2. Performance (`python glass.py perf main …`, theme off then on, every theme file on)

| route | seconds | stock fps / long frames | themed fps / long frames |
|---|---|---|---|
| `/library/home` | 8 | 89.7 / 0 | 89.8 / 0 |
| `/library/home` | 3 (×3) | 88.2 / 0, 90 / 0, 90 / 0 | 86.1 / 0, 89.7 / 0, 90.2 / 0 |
| `/library/tab/AllGames` | 8 (×2) | 80.1 / 8, 79.2 / 8 | 81.4 / 5, 78.5 / 6 |
| search (`'a'`, 342 results) | 8 | 84.6 / 2 | 83.1 / 0 |
| `/library/app/620980` | 8 | 89.1 / 1 | 89.5 / 0 |

- The 3-second runs on AllGames swing ±5% between runs in both directions: lazy capsule art loads cause the long frames.
- The 8-second runs are the reliable numbers. Themed is within 2% of stock on every route and never adds long frames.
- The isolated window-root backdrop root (`will-change: opacity` on `%{MainNavMenuMainSplit}`) and the click-through rim layer showed no measurable cost.

## 3. Engineering notes (read before changing window-level rules)

- **Backdrop root.** `backdrop-filter` re-composites everything painted before it, up to its backdrop root. Over plain window glass, it blurred the window tint itself and doubled its alpha (.725 → .93, a dark blot over a bright room).
  - `%{MainNavMenuMainSplit} { will-change: opacity }` makes the window's inner wrapper the backdrop root. Every Liquid Glass element in the window now blurs page content only.
  - `isolation: isolate` does **not** do this; tested.
  - The stacking context it creates wraps every Steam layer, so relative z-order is unchanged.
  - This also stops other areas' blurred sheets and menus from double-darkening over the window.
- **Header 3D context.** `#header` is `transform-style: preserve-3d` (Steam). Backdrop filters inside flat children (`%{BackContainer}::before`, the overflow-clipped `%{SearchAndTitleContainer}`) see nothing; Steam's own 100px header blur never blurred anything either.
  - The search capsule is therefore `#header::after`, anchored to the search container.
  - Back opts into the 3D context (`transform-style: preserve-3d` on `%{BackContainer}`: no transform, no fixed children, no geometry).
  - Verified: both capsules blur the Play bar under them.
- **Anchors.** The footer capsule, the search capsule and the search tab capsule are positioned with CSS anchor positioning (Chrome 126). They follow Steam's layout in any language, tab count or legend count. Steam elements keep their own boxes.
- **Clip.** `%{BasicUiRoot}` already clips with `overflow: hidden` + radius. Raising the radius to 32 needed no `clip-path`.

## 4. Not styled here, and why

| item | why |
|---|---|
| VR main menu (`frame.menu`, `%{DashboardMenu}%{Variant_FrameMenu}`) | Owned by bar (`30-bar.css`, DESIGN §9). That file did not exist yet when this was written; see requests |
| Modal scrim, dialog cards, context menus, power menu, `%{FocusRing}` | Primitives (`10-primitives.css`) owns them. Checked in combination with the window (`shell_modal_confirm_after`, `shell_contextmenu_after`) |
| Header browser mode (`%{HeaderBrowser}` URL bar, `%{HeaderOpaque}`) | Needs a live store web view (store area). Steam's opaque header on those routes is left as-is on purpose: the window is transparent there |
| Header account-alert item (`#header_profile`) | Only rendered with active support alerts. Styled from CSS (capsule, hover, focus ring) but not seen live |
| Library and social page panels still opaque (`%{PagedSettingsDialog}` `#0e141b`, content column `#1a1c21`, `%{ScrollContainer>Glassy}`, `multiChatDialog`, `%{DownloadsPage>Section}`, `%{InvitesList}`) | Page interiors belong to settings, appdetails and social |
| Remaining CONTRAST lines | Home "Recently updated" card meta (`%{Bytes}`, "Updated …", "NO PLAYTIME YET"), AllGames `%{TabCount}` (library) and downloads labels (social). These are Steam greys (`#8b929a`, `#67707b`) that now sit on translucent glass; they need `--lgs-text-2`. Not shell elements |
| `:hover` states, laser only | Can't be produced synthetically; written from Steam's CSS |
