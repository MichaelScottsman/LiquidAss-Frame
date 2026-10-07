# Cross-concept record: Home, search and the window (home-apps ↔ window-nav)

Written by home-apps, revision 2, in answer to the critic's review of `home-apps.md`.

It records the decisions that touch `window-nav.md` (WN), so that both documents say the same thing. window-nav was being revised at the same moment, so the proposed WN text is collected here for the coordinator to merge. home-apps did not edit WN's file.

## 1. Windowless routes (proposed addition to WN §3.1 and §3.7)

**Add to WN §3.1, the window table:**

| Property | Value | Notes |
|---|---|---|
| Glass on windowless routes (`/library/home`, `/library/lgs/folder/*`) | **None.** The Home view floats over the room (owner: home-apps §3). `/library/lgs/steamhome` (What's New) is a normal window, 1280 × 720 | The cover is partial: one cover shape per plate (home-apps §10) |

**Add to WN §3.7, the depth plan:**

| Element | Depth | How | Ghost rule (`native-e2e.md` §1) |
|---|---|---|---|
| Plates on windowless routes (discs, top-row controls, card, name plate) | 0 | glassd cover **shapes** (one per plate, opaque at +1 mm) + base-mosaic bands over them | The real panel is hidden under each plate; outside the plates only Steam's panel shows its pixels (labels, dots) |
| The focused item on a windowless route | +15 mm | Interactive in-place crop + `liquid` slab over its own plate (occluder variant) | Covered by its plate; off axis the plate reads as its shadow |

## 2. Search (proposed addition to WN §4.4 and §4.6)

window-nav owns `Routes.Search.Root()` and all of its states. home-apps contributes:

1. **Programs in the ranking.** The "+ > Launch Program" list, without the Liquid Glass entry, is matched on `strAppName` with WN's rule. A program can be the **Top Hit**: its icon on a disc, status "App", and the **Open** capsule launches it with `SteamClient.Apps.LaunchNonSteamApp(strCmdline)`.
2. **The Apps cell.** When programs match, the bottom row (the Store hand-off, 704 × 76) splits into two 346 px cells:
   - left: the best program, A = launch; with more matches it reads "<name> and N more", and A opens Home › Apps with that program focused;
   - right: "Search the Steam Store" (WN's).
3. **X = primary action** on the Top Hit and on "In Your Library" posters (Steam's Play / Install / Update), shown in the bottom ornament as "X Play". A still opens the game page, as WN specifies.
4. **Field.** WN's capsule everywhere, with no microphone. On Home and folder routes, WN's **circle variant** (60 px magnifier, the same `%{SearchAndTitleContainer}` in an 80 × 80 box), gated on WN's audit (no SHRUNK).

Mockup: `shots/p2_home-apps_search.png` (`mockups/home-apps-search.html`). It is WN's §4.4 layout with the Apps cell outlined, on the real library (query "half").

Tests: home-apps AT-13 runs on top of WN AT-9.

## 3. Library routes

- **Bottom ornament.** On `/library/tab/*` and `/library/collection/*`, WN's ornament holds home-apps' five fixed slots (Sort 300 · Filter 130 · Options 156 · Select 134 · Back 120; 880 px), filled per input mode (home-apps §7.1).
- **Open item, laser mode.** window-nav's current mockup builder (`window-nav-shared.js`, `data-mode="laser"`) drops the A Select / B Back legends in laser mode. Steam renders them in laser mode (`shots/p2_lib_collections_on.png` shows "A SELECT  B BACK" under the laser pill), so hiding them would count as HIDDEN in `glass.py audit`. home-apps keeps them in slots 4 and 5 in both modes. Please reconcile.
- **Filters.** The Filters content (home-apps §9) is shown inside WN's sheet frame (WN §5.4). WN's `p2_window-nav_sheet.png` is illustrative; home-apps' `p2_home-apps_filter.png` shows Steam's real options.

## 4. Decision log

| Date | Decision | By |
|---|---|---|
| 2026-10-07 | window-nav is the single owner of search; home-apps' split view (rev 1) is withdrawn | home-apps rev 2, following the critic |
| 2026-10-07 | Home is windowless with plate cover shapes; What's New is a window route | home-apps rev 2 |
| 2026-10-07 | No microphone in any search field | Both (WN D-8) |
