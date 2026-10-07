# Cross-concept record: Home, search and the window (home-apps ↔ window-nav), revision 3

Owner: **C2a** (PLAN §2.6). Revision 2 was written by home-apps in answer to the critic, and proposed text for window-nav (WN) to merge. Since then `docs/phase2/PLAN.md` §1 has settled every point (§1.1, §1.2, §1.6, §1.7, §1.9–§1.11), WN revision 3 (C1a) carries the route map, and C1b has announced the search interface (`docs/phase2/wp/C1b.md`, "Interface announced"). This file now records what is agreed, where each point lives, and the requests that are still open. Where it and PLAN §1 disagree, PLAN §1 wins.

## 1. Windowless routes

| Point | Agreed | Where |
|---|---|---|
| Glass modes | `/library/home` (route key `home`) and `/library/lgs/folder/*` (`folder`) are **windowless**; `/library/lgs/steamhome` (What's New, `steamhome`) is `window-full`, 1280 × 720; library routes are `window`, 656 | PLAN §1.2, WN §3.1.1, HA §3, §3.6 |
| Glass on windowless routes | **Plates** (P9 G1, ≤ 32 per surface), reported by P6 from `data-lgs-plate`: Home's discs, the top-row controls, the open card or name plate. Revision 2's "one cover shape per plate" is withdrawn (a cover holds ≤ 8 shapes) | PLAN §1.6, reporter §2.2, HA §10.2 |
| Mosaic | Restricted to the plates' rows through `data-lgs-mosaic` bands, so labels and dots are never drawn twice | reporter §2.3, HA §10.2 |
| Depth | Only the attended item pops: **+15 mm, non-interactive** in the default profile (revision 2 said interactive), over its own plate's occluder variant. Wearer profile: +15, interactive | PLAN §1.7, HA §10.4 |
| A failed Home override | Home falls back to Steam's own Home in a `window-full` window, never to a windowless page | HA §3, §3.7; open: REQ C2a->C1a #1 |
| Back and search on windowless routes | Steam's nodes, styled by C1a (Back circle at (24, 24), search circle at (1196, 24)), reported as plates | HA §3.1, §10.2; open: REQ C2a->C1a #2 |
| Footer on Home and folders | Steam's own visibility (Steam's Home hides it by its page props); never hidden by CSS; if it shows, it is C1a's ornament and the page makes room (two honeycomb rows) | PLAN §1.10, HA §3, §3.2 |

## 2. Search

window-nav owns `Routes.Search.Root()` and all of its states: a sheet over a snapshot of the page you were on (PLAN §1.1, §1.9; WN §4; built by C1b). Revision 2's split view and its 704 × 76 Store row are withdrawn. home-apps contributes through C1b's provider API with one provider, `c2a.programs` in `device/rt/41-search-apps.js` (HA §6):

| # | Contribution | Agreed |
|---|---|---|
| S-A | Programs in the ranking | `rank(query, ctx)` returns the matching programs (Liquid Glass left out) with C1b's tiers: 0 exact title, 1 title prefix, 2 word prefix, 3 substring. A program is the **Top Hit** only with a strictly better tier than Steam's best library match ("half" → Half-Life: Alyx; "vlc" → VLC media player). Its status is Steam's "Software" (`#AppType_2`); it has no More circle |
| S-B | The Software cell | C1b's header "Software" over one 300 × 84 cell at the start of the Store row: 56 px disc, 48 px icon, name 24 Semibold, "and N more" (English only, "+N" otherwise). One target: one match launches (`launchNonSteam`); more matches open Home › Apps with that program focused (`rt.home.reveal`). Replaces revision 2's Apps cell |
| S-C | X = primary action on library items | Steam's Play / Install / Update through `actions.primary(appid)`, shown as Steam's "Play" legend; A still opens the game page. Declared by C1b's sheet on its own items, so the provider has no `primary` |
| Field | One spec | WN's 520 / 640 × 64 capsule everywhere, the 60 px circle variant on Home and folders (gated on WN AT-4), no microphone (WN D-8) |

- **Mockups:** `shots/p2_window-nav_results.png` (C1b: focus on the Top Hit) and `shots/p2_home-apps_search.png` (C2a: the same sheet and data, focus on the Software cell, quiet legend).
- **Tests:** HA AT-13 runs on top of WN AT-9 (C1b's test table lists it); HA AT-5(c) checks that Liquid Glass never appears.
- **Open:** REQ C2a->C1b #5 (below).

## 3. Library routes

| Point | Agreed | Where |
|---|---|---|
| Bottom ornament | WN's ornament holds the library's five fixed slots (Sort 300 · Filter 130 · Options 156 · Select 134 · Back 120; 880 px) in **both** input modes | PLAN §1.10, HA §7.1 (C2c) |
| A and B in laser mode | Kept as quiet members in both modes; no legend node is ever hidden. Revision 2's "please reconcile" is closed by PLAN §1.10 | PLAN §1.10, WN §3.4 |
| More circle | C1a's one helper per document, registered on posters by C2c; never on Home's launcher discs (Home's card has its own More control with the helper's look and dispatch, HA-16) | PLAN §1.11, HA §7.2 |
| Filters | C2c's content inside C1c's sheet frame (WN §5.4), scrim .35, +10 mm | PLAN §1.8, §1.12, HA §9 |
| Open items | C2c's REQ-3 to REQ-5 (C1a: fixed slots, Options member) and REQ-6 (C1c: anchoring, sheet frame), in `docs/phase2/wp/C2c.md` | — |

## 4. Menus over Home

The tile menu opened from Home's card (More, or ≡ on a game cell) is Steam's menu in C1c's frame, laid out by count, at +10 mm (PLAN §1.12, §1.7); while it is open the card drops to 0 (rule 6). Home has no window cover, so the menu needs its own `thick` plate to be admitted (rule 1): REQ C2a->C1c #3.

## 5. Open requests from this record

All in `docs/phase2/wp/C2a.md`, "Requests": C2a->C1a #1 (`glassMode('home')`), #2 (Back and search as plates on windowless routes); C2a->C1c #3 (menus as `thick` plates on windowless routes); C2a->P10 #4 (stock-route audit); C2a->C1b #5 (Software cell details).

## 6. Decision log

| Date | Decision | By |
|---|---|---|
| 2026-10-07 | window-nav is the single owner of search; home-apps' split view (rev 1) is withdrawn | home-apps rev 2, following the critic |
| 2026-10-07 | Home is windowless with plate glass; What's New is a window route | home-apps rev 2; PLAN §1.2 |
| 2026-10-07 | No microphone in any search field | Both (WN D-8); PLAN §1.9 |
| 2026-10-07 | Plates (P9 G1), not cover shapes; the attended item's pop is non-interactive by default | PLAN §1.6, §1.7 |
| 2026-10-07 | A and B stay visible in laser mode; the library's five slots are 880 px in both modes | PLAN §1.10 |
| 2026-10-07 | Search contributions go through C1b's provider API; the Software cell replaces the Apps cell | PLAN §1.9; C1b's interface; HA rev 3 |
