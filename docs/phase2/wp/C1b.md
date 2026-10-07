# C1b Search: evidence log

Package card: `docs/phase2/PLAN.md` §2.4 "C1b Search". Concept: `docs/phase2/concepts/window-nav.md` §4 and §9.1 (WN, file owned by **C1a**; C1b sends its text as requests, below). Inputs: WN §4, §9.1; XC §2; HA §6; PLAN §1.9. Steam build at the time of writing: `11094443` (read from P10's cache `/tmp/lgs/steam-build.json` on the Frame, 2026-10-07).

C1b owns: `theme/21-search.css`, `device/rt/21-search.js`, `docs/phase2/mockups/window-nav-search.html`, `window-nav-results.html`, `docs/phase2/wp/C1b.md`, `docs/phase2/wp/C1b-cmp.json`.

## Status

**Milestone reached: M3 (T1 + T2/T3 live behind `wp.c1b`), plus the native fragment, 2026-10-07 session 2 (expedited round).** M0 was session 1.

**READY: wp.c1b** — evidence below (V1 may turn it on by default). Read the two AUD notes: every AUD "GONE" left is a relocation that was checked by hand, not a lost function.

- **Built (owned files):** `theme/21-search.css` (T1 + T3 hooks; also takes over `20-shell.css` §6, REQ C1b->C1a #9), `device/rt/21-search.js` (module `search`, flag `wp.c1b`, deps `react`), `theme/layers/21-search.json` (sheet +10 mm, thick slab, behind `wp.c1b`). Drafts identical in `theme/_wip/` and `device/rt/_wip/`. `check-theme` clean.
- **What the user sees:** T1 (runtime off) — Steam's search page is a 960 × 500 thick-glass sheet at (160, 100) under the field, the tab row is a 64 px segmented scope bar (60 px segments, 22 Semibold title case, Steam's counts, white selected pill), 60/80 px ‹ › circles, Steam's grid inside under 26 px fades, 18 px Medium labels, the window dimmed .35. T3 (`wp.c1b`) — clicking or D-pad-focusing the field opens the sheet at once over a **snapshot of the page you were on** (blurred 14 px + scrim .35); with an empty query the **zero state** (880 × 500): Recent Games discs (120 px, ×1.10 lift), Recent Searches capsules (session memory only), See All, the hint; typing hosts Steam's own page as the sheet (every result, category, count and path is Steam's); categories and No Results are Steam's in the sheet; a click on the dimmed page, B or Back leaves and focus returns where it was. Shots: `shots/c1b_t3_zero6.png`, `c1b_t3_half5.png`, `c1b_t3_category.png`, T1 `c1b_t1_half2.png` (before: `c1b_now_all.png`).
- **Gates** (`glass.py gates main --route /library/tab/AllGames --pre <activate, type "half"> --flags wp.c1b`): SIZE, TYPE, OUTLINE, MOTION **pass** in `--mode pad` and `--mode laser` (39 targets checked), zero state pass in both modes, T1 (no flags) pass. **AUD (1):** results — no HIDDEN, no UNCLICKABLE; GONE = the 6th-column tiles and "View more in the Store" of Steam's virtualised grid, which reflows from 6 columns (1208 px) to 5 in the 960 sheet: a scroll of the sheet reaches all 25 tiles incl. "View more in the Store" (scroll test, Steam's counts unchanged: All 162 / Library 8 / Friends 0 / Store 158 / Tools 3 / Hidden 4); SHRUNK = the sheet container itself (≤ 960 × 500, PLAN §1.12). The same GONE appear with T1 alone. **AUD (2):** zero state — GONE = Steam's empty-query "list everything" page, which the zero state replaces by design (WN §4.5) and which See All opens in one step (verified: See All → All 446 / Library 424 / Friends 4 / Store 0 / Tools 18 in the sheet).
- **Gamepad** (scripted D-pad on the live UI, `wp.c1b`, pad mode): AllGames poster → Up ×3 reaches the field and opens the zero state (route `/search/tab/All`, DOM focus in the field) → Down lands on the first Recent Games disc (P-22) → Right ×2, Down, Up reversible → B returns to `/library/tab/AllGames` with focus on the element you left, snapshot gone. A on See All opens Steam's page; A on a Recent Searches capsule sets the query through Steam's own handler; a click on the dimmed page goes back. `pad-bfs` stops after the first Left at the sheet's left edge (`exit:none`, then every node `untakeable`) in exactly the same way with the runtime off (T1 run), so it is the lab's recovery from the frame-menu exit, not this package (REQ C1b->P10 #10).
- **No console errors** (window `error` / `unhandledrejection` hooks over open, type, category, no results, back) and no runtime warnings from `search`. Removal: with the flag off, no `lgs-c1b`, no `.lgs-search-layer`, no snapshot, module `off`.
- **Native (P7 at M1; done anyway on the user's "still do native glass work"):** one `glass.py native-session` (54 s wait): `sgcheck /search/tab/All` → main 3 pops, depths 0 / 4.5 / 5.5 / 10.0 mm; the sheet is the +10 mm pop, no rule failure for it; the two R2 failures are C1a's legacy `hdr-back` (5.54 mm) and `footer` (4.43 mm). One `hv --look` (second session, flag overlay with a 45 s TTL): the sheet stands in front of the window as a thick slab with Steam's results on it, the blurred page behind. Both frames viewed and deleted at once (`hv --clean`; 0 frames left in `/tmp/lgs` on the Frame). Back to CSS only: yes.
- **Device left:** theme on, CSS only, route `/library/tab/AllGames` (restored by the lab), no flag overlay, no `search` nodes, field blurred, keyboard hidden.

**What remains (later rounds):**

| Next | Why |
|---|---|
| The All summary (Q6: Top Hit, posters, Store row, Software cell with C2a's provider) | Results are Steam's grid in the sheet today (WN §4.6 "All without Q6"); the provider API is live but no cell renders it |
| No-results echo of the query (P-62), sounds verified with `PlayAudioURL` (C1b-9), motion filmstrips (C1b-5), perf (AT-16), `C1b-cmp.json` + PLAN-1b-1 `cmp` | Skipped in this expedited round |
| Mockup switch to C1a's quiet-legend builder (REQ C1a->C1b) | No mockup re-renders this round |
| The focused result does not pop on its own in native mode | The reporter never keeps overlapping pops; it rides on the +10 sheet (PLAN §1.7 conflict noted in the log) |

## Interface announced (names are final; code lands at M1 stub, M3 behaviour)

Areas and tests key only on these.

| What | Name and values | Notes |
|---|---|---|
| Runtime module | `search` in `device/rt/21-search.js`, deps `['react']` (P3's `rt.sound` used when present), flag **`wp.c1b`** (built-in default off until V2 accepts); `html.lgs-c1b` on `main` while installed | Fails closed: with `react` not ready the route is Steam's, restyled by `21-search.css` (T1) |
| Provider API (PLAN §1.9) | `__LGS_RT.search.addProvider(spec) → {remove()}` | Also `rt.search.providers()` → `[{id, slots, calls, ms, failed}]` for tests |
| `spec.id` | string, unique (`'c2a.programs'`) | A second `addProvider` with the same id throws |
| `spec.slots` | subset of `['tophit', 'software']` | Where its candidates may appear. `tophit`: the Top Hit card. `software`: the Software cell at the start of the Store row (S-B) |
| `spec.rank(query, ctx)` | sync → `[{key, name, tier, icon, subtitle, data}]`, best first | `tier`: 0 exact title, 1 title prefix, 2 word prefix, 3 substring (case- and accent-insensitive). `ctx = {steamBest: {tier, appid} \| null, lang}`. Must return in ≤ 2 ms; a slower call is skipped for that keystroke and logged |
| `spec.render(candidate, slot)` | optional → React element for the cell's **content** | Our component owns the `Focusable`, sizes, states, depth tags and legends; without `render` we draw the standard cell (56 px disc with `icon`, `name`, `subtitle`) |
| `spec.open(candidate, ev)` | A or a click | Must go through `rt.react.actions` (a program: `launchNonSteam(cmdline, ev)`; "and N more": `nav.go('/library/home')` + Home's Apps section with that program focused, C2a's API) |
| `spec.primary(candidate, ev)` | optional, X (S-C) | Through `rt.react.actions.primary(appid, ev)`; shown as Steam's "Play" legend (`#GameAction_Play`) |
| Top Hit rule | Among Steam's library matches of the best tier, the most recently played (Steam's last-played time); ties keep Steam's order. A provider candidate becomes the Top Hit only with a **strictly better** tier than Steam's best | "half" → Half-Life: Alyx (all "Half-Life" titles are tier 1; Alyx was played last). "vlc" → the program VLC media player (no Steam library match) |
| Liquid Glass | Dropped by the search module from every provider's candidates (HA-10), whatever the provider returns | HA AT-5(c) |
| Safety | A provider that throws is disabled for the session (logged); providers are removed on `lgs off`; nothing a provider returns is stored beyond the current query | |
| DOM hooks (live, session 2) | Zero state: `.lgs-search-zero[data-lgs-search="sheet"][data-lgs-search-state="zero"]` with `[data-lgs-search="recent" \| "recent-search" \| "seeall"]`; results and categories: Steam's `%{GamepadSearch} > %{GamepadTabbedPage}` tagged `data-lgs-search="sheet"` + `data-lgs-search-state="results" \| "category"` (T2, removed on unmount) over our glass `.lgs-search-glass[data-lgs-search="glass"]`; the snapshot `div.lgs-snap` (inert) and the scrim `.lgs-search-scrim[data-lgs-search-state]`. `tophit`, `library`, `software`, `store`, `noresults`, `section` arrive with the All summary (Q6) | No wrapper around Steam's page: the snapshot, scrim and glass are siblings after it (a React fragment), stacked by z-index (0, 1, 2; Steam's sheet 3). Depth rules: `theme/layers/21-search.json` (C1b; REQ #8 withdrawn) |
| Sounds | `rt.sound('sheetIn')` / `'sheetOut'` on present and dismiss; `'segment'` on our All page's scope change; nothing on hover | P3 `contracts/interaction.md` §5 |

## M0 conformance: every PLAN §1 decision that touches search

| PLAN | Decision | Where it landed |
|---|---|---|
| §1.1 | Search route and sheet: WN → C1b; HA contributes through the provider API | Interface above; REQ C1b->C2a #5 |
| §1.2 | `/search` is a `window` route: 1280 × 656 glass, 64 px ornament margin | Both mockups: window 656; sheet bottom at y 600, ornament from 628 |
| §1.3 | Text buttons 60 capsules, 24 padding, 24 Semibold; icon buttons 60 / 80 hit, ≥ 24 px clear; segmented 64 track, segments 56–60 × ≥ 140 (E-SEG compact 120); mini circle 44 alone (E-MINI); search field 640 × 64 on the search route, no microphone; More circle 60 / 80; Home disc 120 | Recent Searches capsules and See All now 60 / 24 Semibold (were 60 / 500 weight); "See All" and "Open" 60 (were 48); the 54 px category capsules (58 px pitch) are gone; scope bar segments ≥ 120 wide in a 64 track; Steam's ‹ › arrows 60 px circles; Recent Games discs 120 (were 112), Home's one-line labels; More circle 60 inside the card |
| §1.4 | Input-mode keying; laser looks on `:hover`; lift after 80 ms dwell; gamepad focus + .28, spot .16 upper third, arc ×1.5; content cards lift ×1.05, Home discs ×1.10; no row or button scale; glyph badges in gamepad mode only | Recipe block in both mockups (same values as C1c's); zero state in laser mode shows **no** glyph badges and no focus look in the sheet; results in gamepad mode shows the Top Hit lifted ×1.05 and glyphs in the ornament |
| §1.5 | MO tokens; at rest nothing runs; route overrides within Steam's timeouts (enter ≤ 800 ms, exit ≤ 200 ms) | Proposed WN §4.9: sheet-in 735 (≤ 800); **dismiss changed** from `sheet-out` 514 to a 150 ms content-and-glass fade, because leaving is Steam's `NavigateBack` and React unmounts our route after Steam's ≤ 200 ms exit; glassd dissolves the slab in native mode |
| §1.6 | Search sheet = `thick`; slab under the pop in native mode; CSS-only blur 30 + tint .30–.40 + edges; no outlines (edge lobe); no glass on glass | Sheet `data-mat="thick"`; inside the sheet nothing has its own `backdrop-filter` (P-45): the Open capsule and the More circle are fills, the discs are content with a specular arc and contact shadow instead of Home's glass bezel |
| §1.7 | Search sheet +10 mm non-interactive (wearer +30 → +50); focused content card ≥ 150 px (search result) +15; click-safe on the smallest focusable; ≤ 4 dz; nothing pops while scrolling; only the modal pops while one is open | Mockups annotate sheet +10, Top Hit +15 (its smallest focusable is the More circle's 80 px hit → +15 allowed); proposed text: discs and the Software cell never pop, nothing pops while the sheet scrolls, the snapshot never pops |
| §1.8 | Sheets: Steam's scrim restyled to black .35, never `t1` | Scrim .35 on the snapshot (`lgk-scrim`); WN §3.7's "t1 tint .65" row is withdrawn for search (REQ #1) |
| §1.9 | One field, three variants; no microphone; search = WN §4 sheet over a snapshot; HA's split view withdrawn; provider API (S-A, S-B, S-C); Liquid Glass excluded | Field 640 × 64 on the route; Top Hit can be a program; the Software cell beside the Store row (results mockup, real program); X = Play in the ornament; HA's mockup must follow (REQ #6) |
| §1.10 | Legends never hidden; capsule when any action besides A/B; quiet legend when only A/B (in the margin on `window` routes); A and B in both modes | Zero state: quiet legend "Open / Back" in the margin, labels only (laser); results: capsule "Play · Options · Open · Back" with glyphs (gamepad). The shared builder still drops A/B in laser mode, so the zero state draws the quiet legend inline (REQ #2). Legibility finding: REQ #3 |
| §1.11 | More circle: one helper, 60 / 80, inside the host (cards top right, inset 10), dispatches the host's `onMenuButton` | Results: More circle 60 inside the Top Hit, top right inset 10; the item menu path is in the retention table |
| §1.12 | Sheets ≤ 960 wide, close circle, scrim .35; Steam's order and default focus untouched | Results sheet **1040 → 960** (centred at x 160); the close circle is the window's Back circle above the scrim (no second circle; reasoning in proposed §4.4) |
| §1.13 | Tooltips only on icon-only controls; Steam's sounds; haptics off | The only icon-only controls in the sheet are ‹ ›, the × and the More circle (tooltips from P3); sounds in the interface table |
| §1.15 | Steam's strings by source text; English only for `en*` | Read-only grep of Steam's English UI strings on the Frame (log below); labels changed: "Recently Played" → **Recent Games** (`#LibraryHome_RecentGames`), "Show All Results" → **See All** (`#StoreApp_SeeAll`), "In the Store" → **Store (158)** (`#Search_Results_Header_StoreApps_With_Count`), category capsules → Steam's section headers with counts, "Close" → **Back** (`#ActionButtonLabelBack`, what Steam's legend says on `/search` today), Top Hit status → **Playtime: 6.3 hrs** (`#BasicGameCarousel_TotalPlayTime_Hours`). English-only: "Recent Searches", "Top Hit", the zero-state hint, "and N more" |
| §1.16 | Exemptions | The × in the field is E-MINI; segments E-SEG (compact 120); nothing else in the sheet needs one |
| §1.17 | Safe defaults behind flags | The whole package behind `wp.c1b` (off). No new sign-off items: the dimmed-page click that closes search is WN §4 behaviour adopted by §1.9 (recorded as a VP P-65 deviation for V2, proposed §4.4) |

## Proposed WN text (REQ C1b->C1a #1: replace WN §4 with this, and apply the line edits after it)

> ## 4. Search: a sheet over the page you were on (built by C1b)
>
> Revision 3 (PLAN §1.9, with §1.2–§1.15). Mockups: `window-nav-search.html` (zero state, laser mode, keyboard up) and `window-nav-results.html` (results for "half", gamepad mode, focus on the Top Hit). Both show the device's real library, its real program "Half SBS Toggle", Steam's real counts for "half" and Steam's own strings. Shots: `p2_window-nav_search.png`, `p2_window-nav_results.png`.
>
> ### 4.1 Why it changes
>
> Today search is a 1.23° strip whose focused state is a light-grey web form. Entering it replaces the page with Steam's results route; leaving needs Back; an empty query lists the whole library; the keyboard shows no echo 22–28° below the text (shell-nav B.4.1, B.5.2, B.6). visionOS treats search as a system feature: suggestions and recent searches before typing, a scope bar, grouped live results and a no-results view that echoes the query (VP §3.2, P-62).
>
> ### 4.2 The model
>
> Search stays on Steam's own routes (`/search`, `/search/tab/<Category>`), so history, B, the keyboard, IME and every result path are Steam's. The route's glass mode is `window` (PLAN §1.2). It is **presented** as a sheet over the page you were on:
>
> 1. On activation T2 takes a **context snapshot**: `cloneNode(true)` of the current page's content element (the child of `%{TopLevelTransitionSwitch}`) and of the toolbar's Large Title node, every `id` removed, `inert` and `aria-hidden` set, the `scrollTop` of each scrolled descendant copied, no listeners. It is a decorative picture; Steam's focus never sees it, because focusables register through React context, not through the DOM.
> 2. The search route renders (T3 override, §4.10): the snapshot under Steam's scrim restyled to black .35 (PLAN §1.8; never the `t1` tint), then the sheet.
> 3. The snapshot is pixel-identical to the page that just left, so the route change is invisible: the page stays while the sheet materializes over it.
> 4. Leaving (B, the Back circle, a click on the dimmed page, any tab) is Steam's `NavigateBack`: the real page returns under the same picture, and Steam's focus history puts focus back on the poster you left.
>
> ### 4.3 The trigger
>
> - **Activation = the header input receives DOM focus** (`focusin` on `%{SearchBox}`). A laser click gives it focus; Steam's gamepad focus (D-pad Up from the top row) calls `focus()` on it.
> - On activation T2 takes the snapshot and, **if the route is not already `/search…`**, calls `Navigate(Routes.Search.Root())`. If Steam navigates by itself on focus, nothing is added.
> - The keyboard rises as Steam raises it (`onKeyboardShow`), on activation only, never on arrival (P-63).
> - Input mode comes from P3 (`rt.input`, `html.lgs-input-*`); Steam's getters are never written.
>
> AT-9a and AT-9b exercise the real trigger with both inputs and record what Steam itself does.
>
> ### 4.4 States
>
> | State | Route | Sheet | Tier |
> |---|---|---|---|
> | Idle | any | — the field: 520 × 64 on section roots, 640 × 64 on nested routes, a 60 px circle on Home, folders, hero routes and the other routes of PLAN §1.9 (C1a) | T1 |
> | Activated, empty | `/search` or `/search/tab/All`, empty query | **Zero state**, 880 × 500 at (200, 100) | T2 snapshot + T3 |
> | Typing | `/search/tab/All` + query | **Results**, 960 × 500 at (160, 100); the width grows 880 → 960 on `snappy`; the height never changes | T3 |
> | Category | `/search/tab/{Library,Friends,Store,Tools,Hidden}` | Steam's own tabbed page hosted in the sheet, 960 × 500 (AT-9d) | T1 + T3 host |
> | No results | any, with a query | Steam's "No Results Found" (`#Search_NoResults`) as centred Title 3 and the query echoed under it in Callout, in quotes (P-62) | T1 + T3 |
>
> - **The sheet:** thick glass (PLAN §1.6), radius 44, its top 14 px under the field so it reads as growing down out of the capsule, centred on the glass (P-35), ≤ 960 wide (PLAN §1.12); content inset 40 (zero state) or 32 (results).
> - **The field** stays Steam's input in the toolbar row, above the scrim. While it holds DOM focus it carries the only focus ring in the system (3 px soft white .55 + 16 px glow, VP P-17); when focus moves into the sheet the ring goes. No microphone.
> - **Close control:** the window's Back circle at (24, 24), above the scrim; after 0.6 s it grows into a capsule naming the page you return to (§3.2). It is the sheet's close circle in the sense of PLAN §1.12 and VP P-66, so the sheet has no second one.
> - **A click on the dimmed page closes search.** This deviates from VP P-65 ("an outside click does not close sheets"): the search sheet hangs from its field like a popover, closing it loses nothing (the query is kept in Recent Searches), and PLAN §1.9 adopts this section's leaving paths. V2 records it as a known deviation.
>
> ### 4.5 Zero state (880 × 500)
>
> Shot: `p2_window-nav_search.png`.
>
> - **Recent Games** (`#LibraryHome_RecentGames`): five cells of 160 × 180 on a 160 px pitch; each a 120 px game disc (DESIGN2 §9.2: hero, logo at 70 %, specular arc, contact shadow) with a one-line Subheadline label (HA-5). Inside the sheet the disc is content, not glass (no glass on glass, P-45). Data: Steam's `recentAppsCollection` (`rt.react.data.recentGames(5)`), shortcuts included as in Steam's own list. A or a click → the game page (`rt.react.actions.navigate`). Focus: the Home disc lift ×1.10 + shadow; no pop (PLAN §1.7: < 150 px).
> - **Recent Searches** (English only, PLAN §1.15; in other languages the header is omitted and the capsules stay): this session's queries (≤ 8, newest first) as 60 px capsules with a clock glyph, 24 Semibold, 24 px apart. Kept in SharedJSContext memory only, never on disk or in `localStorage`; `lgs off` or a Steam restart empties the list and the section hides. A or a click sets the query through Steam's own search store.
> - **See All** (`#StoreApp_SeeAll`), a 60 px capsule with a grid glyph: Steam's own page for the empty query (today's "list everything") in the sheet.
> - **Hint** (English only): Callout 22 px, white .70: "Type to search your library, friends and the Store."
>
> ### 4.6 Results (960 × 500)
>
> Shot: `p2_window-nav_results.png`.
>
> - **The scope bar** at the sheet's top: Steam's categories (`#SearchTab_All`, `_Library`, `_Friends`, `_Store`, `_Tools`, `_Hidden`) as one 64 px segmented control, segments 56 tall and ≥ 120 wide (E-SEG compact), each followed by Steam's count in white .70. Hidden appears only with matches, as Steam does; Friends shows its 0 as Steam does. Steam's own paging arrows ‹ › sit at the sheet's ends as 60 px plain circles (80 px hit). LB / RB step through the categories. The white pill travels on `snappy`.
> - **All = the summary**, when Steam's own search results are available to T3 (Q6: a finder for Steam's search hook through `rt.react.find`). Items, order and counts are Steam's; the shell never matches games itself.
>   - **Row 1:** the **Top Hit**, 372 × 170: hero art, the name in Title 3, Steam's status line (`Playtime: %1$s hrs`, `Not installed`, or Steam's display status), an "Open" capsule (60 px, `#Generic_Open`) that is part of the card's single target, and the More circle inside its top right (PLAN §1.11). Then Steam's next four library matches as 113 × 170 posters in Steam's order. Posters show art only at rest; the focused or hovered poster shows its name and status under it (DESIGN2 §7.8).
>   - **Top Hit rule:** among Steam's library matches of the best match tier (exact title > title prefix > word prefix > substring), the most recently played; ties keep Steam's order. A program (S-A) becomes the Top Hit only with a strictly better tier.
>   - **Row 2:** Steam's own header "Store (%1$s)" (`#Search_Results_Header_StoreApps_With_Count`) over Steam's first store results as 180 × 84 capsule cards, then a **See All** capsule that opens Steam's Store tab in the sheet, where "View more in the Store" (`#GamepadHome_GoToStore`) stays the path to the store search. When programs match (S-B), the **Software** cell (header `#AppType_2`; 300 × 84; the best program's icon on a 56 px disc and its name; "and N more" in English only, otherwise "+N") takes the row's start and the store keeps two cards.
>   - **Below the fold**, in Steam's order, one section per other category with matches, under Steam's own headers with counts (`Friends (%1$s)`, `Tools (%1$s)`; Hidden as `#SearchTab_Hidden` with its count), holding Steam's items. The sheet scrolls under a 26 px fade (P-73), with no scrollbar (P-72); the next header peeks above the fade.
> - **All without Q6:** the sheet hosts Steam's own All grid (every result Steam shows today, with Steam's counts in its tab row). Nothing is hidden or recounted by the shell.
> - **Categories** always host Steam's own tabbed page (`steamChildren`) in the sheet: Steam's virtualised grid, its tab row restyled as the scope bar, "View more in the Store". Hosting Steam's page in a smaller container is [PLAUSIBLE]: the grid measures its container. Gate AT-9d; fallback: Steam's page full-window, restyled (T1), and the sheet only for the zero state and All.
>
> ### 4.7 Keyboard and echo
>
> The keyboard is SteamVR-placed under the window and built by C4b. Search relies on its echo row (SM SQ4): a display-only mirror of the field on the keyboard's slab, so the typing glance is about 5° instead of 22–28°. If SQ4 fails, the field still updates live in the toolbar row.
>
> ### 4.8 Paths
>
> | Step | Laser | Gamepad |
> |---|---|---|
> | Start | Click the capsule (or the 60 px magnifier circle) | D-pad Up from the top row of any page (Main's `onMoveUp`) |
> | Type | Point at keys | D-pad over keys + A |
> | Leave the keyboard | Done, or click the window | Done / B |
> | Into the results | Point | Down from the field enters the sheet; focus lands on the Top Hit (zero state: the first Recent Games disc), P-22 |
> | Switch category | Click a segment or ‹ › | LB / RB; or Up to the scope bar, Left / Right + A |
> | Open | Click a card, poster, disc, store card or See All | A |
> | Play a library result (S-C) | "Play" in the ornament (acts on the frozen target), or the More circle → Steam's menu → Play | X (Steam's primary action) |
> | Item menu | The More circle on the attended item, or "Options · <target>" in the ornament | ☰ |
> | Clear | The × mini circle (44 px, E-MINI) in the field | Backspace on the keyboard |
> | Repeat a search | Click a Recent Searches capsule | Focus + A |
> | Leave search | The Back circle, a click on the dimmed page, any tab | B (our page's `onCancel` → `NavigateBack`) |
>
> ### 4.9 Ornament, depth, motion and sound
>
> - **Ornament** (§3.4, PLAN §1.10): our `Focusable`s declare Steam's own action descriptions: A "Open" (`#Generic_Open`), B "Back" (`#ActionButtonLabelBack`), X "Play" (`#GameAction_Play`) on library items, ☰ "Options" (`#ActionButtonLabelContextMenu`). Zero state: A and B only, so the quiet legend in the margin. Results with a library item attended: X and ☰ join, so the 84 px capsule. Glyph badges only in gamepad mode. Steam's legend nodes are never hidden.
> - **Depth** (PLAN §1.7, default profile): the sheet is a +10 mm non-interactive crop over a `thick` slab, 0 → +10 on `depth` with `sheet-in`. A focused or dwelled content card in the sheet whose long side is ≥ 150 px (Top Hit, posters, store cards) rises to +15 mm, capped by the click-safe rule on its smallest focusable (the More circle's 80 px hit allows +15). Recent Games discs, the Software cell, capsules and the scope bar never pop. Nothing pops while the sheet scrolls; the snapshot never pops. Wearer profile (`interactivePops`): the sheet +30 → +50, interactive.
> - **Native mode:** the snapshot, scrim and sheet content are Steam's DOM, so they reach the headset through the base mosaic and the sheet's crop. **CSS-only:** in-page blur 30 + tint .40 + the edge lobe + shadow (§8.4); nothing inside the sheet has its own `backdrop-filter` (P-45): the Open capsule and the More circle are fills there.
> - **Motion:** present on `sheet-in` 735: glass from the field (scale .97 → 1, origin at the field's centre-bottom), content 25–70 %, scrim 0 → .35 on `fade`, z 0 → +10 on `depth`. Zero state → results: width 880 → 960 on `snappy`, sections cross-fade on `fade`. **Dismiss:** leaving is Steam's `NavigateBack`, and React unmounts our route after Steam's ≤ 200 ms exit (PLAN §1.5), so content and glass fade out in 150 ms linear; glassd dissolves the slab in native mode. Reduce Motion: fades of ≤ 200 ms only. Nothing runs at rest.
> - **Sound** (PLAN §1.13): Steam's `ShowModal` / `HideModal` on present and dismiss, `ChangeTabs` on a scope change on our All page (Steam's own tab row sounds itself); nothing on hover.
>
> ### 4.10 Implementation and fallbacks
>
> - `rt.react.routes.override(Routes.Search.Root(), (steam) => jsx(LgsSearch, {steam}))` (P2 §4.2) in `device/rt/21-search.js`, module `search`, flag `wp.c1b`.
> - `LgsSearch` reads the query from Steam's search store and re-renders on its change. It renders inside `rt.react.ui.Page` (`onCancel` = `NavigateBack`) with `ui.ErrorBoundary` whose fallback is `steamChildren`: the snapshot + scrim (a plain node; a click calls `NavigateBack`), then the sheet: zero state, the All summary (Q6), or `steam` for categories, See All and All-without-Q6.
> - HA's contributions go in through `__LGS_RT.search.addProvider` (spec: `docs/phase2/wp/C1b.md`, "Interface announced"). Every launch and jump goes through `rt.react.actions`, which logs instead of running in test mode.
> - The snapshot lives in a module-level variable and is dropped when `LgsSearch` unmounts or on `lgs off`.
> - **Fallback 1** (no page root found, e.g. a deep link): the sheet sits on plain window glass; the previous page's title shows dimmed in the toolbar row.
> - **Fallback 2** (T3 override unavailable, or the runtime off): Steam's search page, restyled by T1 (`theme/21-search.css`): the scope bar, title-case labels, Steam's tiles; row heights unchanged because the grid is virtualised.

**Line edits elsewhere in WN (same request):**

| WN place | Change |
|---|---|
| Mockup table, rows `p2_window-nav_search.png` and `_results.png` | "Search activated: a sheet over the dimmed Library (real art), zero state with Recent Games and Recent Searches, keyboard with echo row; laser mode, quiet legend" / "Results for "half" in the 960 px sheet: the scope bar with Steam's counts, the focused Top Hit (gamepad mode), Steam's next library matches, the Software cell and Steam's store results under Steam's section headers" |
| `p2_window-nav_motion.png` row | C1c's storyboard no longer shows the search sheet; remove "search sheet present" from the description (C1b's G-MOTION filmstrips `shots/p2_motion_c1b_*` cover it at M3) |
| §1 "The experience", search paragraph | "As you type it becomes results: one scope bar for Steam's categories with Steam's counts, a Top Hit card, your matching games, Steam's first Store results, and a section for every other category with matches." (was "an entry for every other category") |
| §2 verdict table, Search row | Redesign column: add "scope bar; no-results view that echoes the query" |
| §3.7 depth table | "Sheets (incl. the search sheet)" row is right; the "Window dim during alerts and sheets: t1 tint .65" row is withdrawn by PLAN §1.8 (scrim .35 only) |
| §7 motion table | "Search sheet dismiss: `sheet-out` 514, content first" → "Search sheet dismiss: content and glass fade out in 150 ms linear inside Steam's ≤ 200 ms route exit; glassd dissolves the slab" |
| §8.1 and §8.4 | Add to the search sheet row: "no element inside the sheet has its own backdrop-filter (P-45)" |
| §9.1 | Replace the S rows and H2–H4 with the table under "Function retention" below |
| §10 tier table | "Search sheet, zero state, Top Results" row → "Search sheet, zero state, All summary, providers"; evidence adds "provider API (C1b), Q6 finder through `rt.react.find`" |
| §11 Q6 | Default stays "All = Steam's All grid"; owner C1b at M3 |
| §12 deviations | D-17 stays. Add **D-18** "DESIGN2 §3.7 sheet width ≤ 75 % of the glass (960): results sheet 960, not WN rev 2's 1040 (PLAN §1.12)"; **D-19** "DESIGN2 §7.5 search sheet rows of 64 px: the zero state uses Home's discs and 60 px capsules; results use posters and cards (content)"; **D-20** "WN rev 2's column of category capsules (54 px on a 58 px pitch) replaced by the scope bar's counts and Steam's own section headers (PLAN §1.3 sizes)" |
| §13 | Replace AT-9a to AT-9e, AT-10 and AT-16 with the rows under "Acceptance tests" below (ids kept) |

## Acceptance tests (C1b), updated to PLAN §1

Every live step runs inside P10's locked commands with `--flags wp.c1b` (and `wp.c2a` for the provider rows), `--mode laser|pad` as stated, `FocusApplicationRoot()` before any D-pad sequence. Launch-type calls are logged by `rt.react.actions` (test mode), never executed. The keyboard is hidden again with `SteamClient.OpenVR.Keyboard.Hide()` in the same step. After a synthetic hover the pointer goes to (1400, 900). Typing test queries is allowed; no store purchase flow is ever opened (store cards are never activated with A).

| Id | Test | How | Pass |
|---|---|---|---|
| **AT-9a** | Trigger, laser | `--mode laser`, route AllGames: `L.click('main','%{SearchBox}')`, then `focus()` on it; after 1.2 s read `L.route()`, `.lgs-snap`, `document.activeElement`, keyboard state; `shot main p2_c1b_at9a`; hide the keyboard; `L.back()` | Route `/search…`; the snapshot has 0 `[id]` and is `inert`; sheet rect 880 × 500 at (200, 100) ± 2; the field shows its ring; no glyph badge visible; records whether Steam navigated by itself |
| **AT-9b** | Trigger, gamepad | `--mode pad`; focus the first poster; `L.pad('up')` (A on the field only if it took focus without the sheet; then hide the keyboard) | The zero state appears on the real gamepad path; records Steam's own behaviour (resolves the shell.md / library.md disagreement) |
| **AT-9c** | Leaving restores context | After AT-9b: B (`DispatchVirtualButtonClick(2)`) while `.gpfocus` is inside the sheet; `L.route()`, `L.focused()` | Back on `/library/tab/AllGames`, focus on the same poster; no `.lgs-snap`, no sheet node |
| **AT-9d** | Steam's category page in the sheet | SEARCH('half','Library'); `outline main`; `L.pad('down', 3)`; LB, RB | `%{TabContentsScroll}` inside the sheet (≤ 960 wide); rows render (virtualised); focus moves; LB / RB switch categories. Otherwise the full-window fallback is active and recorded |
| **AT-9e** | Parity and no results | For 'half', 'a', 'zzqxjvkw': counts per category in our scope bar against Steam's own tab row (override off, same lock) | Equal for every category; every category with matches has a segment and, on All, a section or row; 'zzqxjvkw' shows "No Results Found" with the query echoed (P-62) |
| AT-10 | Echo | C4b's echo test (SM SQ4) with the sheet open | The echo shows the field's text and placeholder |
| AT-16 | Performance | `glass.py perf main --route /library/tab/AllGames`; the same with a `--pre` that opens and closes the sheet 5× | Themed fps within 5 % of stock; no frames > 34 ms; the snapshot costs ≤ 1 long frame per activation |
| HA AT-13 | Providers (with C2a) | AT-9 steps with 'half', 'vlc', 'liquid', `--flags wp.c1b,wp.c2a` | 'half': the Software cell lists "Half SBS Toggle", A on it logs `launchNonSteam` with Steam's `strCmdline`; X on the Top Hit logs `primary(546560)`. 'vlc': the Top Hit is the program "VLC media player" and Open logs its launch. 'liquid': no Top Hit or Software cell for Liquid Glass |
| PLAN-1b-1 | Looks like the mockups | `glass.py cmp window-nav-search.html LIVE` (zero state) and `window-nav-results.html LIVE` (results 'half', Top Hit focused, `--mode pad`), with `docs/phase2/wp/C1b-cmp.json` | Named rects (`data-id` in the mockups) within ±8 px or the difference explained here; both images viewed and a verdict recorded |
| G-PAD | Gamepad traversal | `glass.py pad-bfs --route /search/tab/All --pre <type 'half'>`; and from AllGames: Up to the field, Down into the sheet, B | Every item reached; Down from the field lands on the Top Hit (zero state: the first disc); Down-Up and Right-Left return; B closes search and focus is on the poster you left |
| C1b-1 | Sizes, type, outlines | `glass.py gates main --route /search/tab/All --pre <type 'half'>` in both modes; and with the zero state | G-SIZE: every target ≥ 60 visible with an 80 px hit (segments E-SEG, the × E-MINI); G-TYPE: no text < 18 px, no weight < 500, no uppercase or tracking in the sheet; G-OUTLINE: no border or outline; edge ratio ≤ 0.35 on the sheet's top edge (WN AT-23) |
| C1b-2 | Ornament | `outline main` with the zero state, then with results and the Top Hit attended, in both modes | Zero state: `#Footer[data-lgs-orn="quiet"]` with A and B only; results: the capsule with X "Play" and ☰ "Options"; no legend node with `display: none`; glyph badges only under `data-lgs-vr-mode="gamepad"` |
| C1b-3 | Focus and hover | `glass.py focus main --pairs` on a scope segment (rest, focused, selected), a Recent Searches capsule, See All, the Top Hit; laser hover with `--mode laser` | G-FOCUS (PLAN §1.4): focus ≥ +40 L over rest, focus ≥ selected + 15 L, glow band ≥ +20 L on the white segment; the Top Hit and posters scale 1.05 on focus and after 80 ms of laser dwell; capsules and segments never scale |
| C1b-4 | Depth (native) | `glass.py native-session --step "sgcheck --pre <open sheet, type 'half', focus the Top Hit>"`; then the same while the sheet scrolls | The sheet's crop at 10 mm ± 2 (live S × r), `interactive: false`; the Top Hit at +15 (or capped by the click-safe rule, reported); ≤ 4 distinct dz; no pop while scrolling; no pop for the snapshot, discs or the Software cell; nothing beyond +15 unless `interactivePops` |
| C1b-5 | Motion | `glass.py motion main --pre <activate> --name c1b_sheet_in`; `--name c1b_results` (first keystroke); `--name c1b_dismiss` (B) | Durations and easings are tokens; present ≤ 800 ms incl. delay; dismiss ≤ 200 ms; glass before content on entry, content before glass on exit; nothing at rest after 1 s; `--media reduce`: fades ≤ 200 ms only |
| C1b-6 | Recent searches stay in memory | Three searches; then `glass.py js` reads `localStorage` / `sessionStorage` keys on `main`; frame_ssh `grep -r` for the queries under `/tmp/lgs`, `/dev/shm/lgs`, `~/.local/share/glass-shell`; then `lgs off`, `lgs on --css`, open search | No query found in storage or on disk; after the restart the section is hidden |
| C1b-7 | Removal | `lgs off`; navigate to `/search/tab/All` with a query | Steam's own search page, unpatched; no `lgs` node, snapshot or provider; `rt.react.status().patchedLeft` 0 |
| C1b-8 | Strings | Static review of `21-search.js`: every drawn string goes through `rt.react.ui.loc()` or the `en*` gate; DOM: drawn strings on `main` equal "Strings" below | Equal; no other literal text |
| C1b-9 | Sounds | Intercept `PlayAudioURL` (IM §9); open and close the sheet; LB / RB on All; hover a card | `ShowModal` and `HideModal` once each; `ChangeTabs` per scope change; nothing on hover |

## Function retention (search, WN §9.1; complete for `audit/shell-nav.md` A.1 H2–H4, A.2 S1–S4 and `audit/library-apps.md` A.7, plus HA §12.6)

| # | Function | New place | Laser | Gamepad | Tier | Test |
|---|---|---|---|---|---|---|
| H2 | Start a search | The field: 520 / 640 × 64 capsule, or a 60 px magnifier circle on the routes of PLAN §1.9 | Click (DOM focus → the sheet) | D-pad Up from a page's top row (same) | T1 (C1a) + T2 + T3 | AT-9a, AT-9b |
| H3 | Type / edit the query | Steam's VR keyboard with the echo row (C4b) | Click keys | D-pad + A (same) | C4b | AT-10 |
| H4 | Clear the query | The × as a 44 px mini circle inside the field (E-MINI) | Click | Backspace on the keyboard (same) | T1 | C1b-1 |
| S1 | Switch result category (All, Library, Friends, Store, Tools, Hidden, with counts) | The scope bar in the sheet; Steam's ‹ › as 60 px circles | Click a segment or ‹ › | LB / RB (same); or Up to the bar, Left / Right + A | T3 (All), T1 (Steam's tab row) | AT-9d, AT-9e |
| S2 | Open a result (game → its page, friend → profile, store item → store page) | All: Top Hit, posters, store cards, friend circles; categories: Steam's grid tiles | Click | D-pad + A | T3, T1 | G-PAD, HA AT-13 (store cards are never activated in tests) |
| S3 | "View more in the Store" (store search) | Steam's Store tab in the sheet, its last tile unchanged; reached from See All or the Store segment | Click See All, then the tile | Focus + A | T1 / T3 | AT-9d (look only) |
| S4 | Leave search | The Back circle, the dimmed page, any tab | Click | B (same) | T1, T3 | AT-9c |
| LA S4 | No results | "No Results Found" + the query echoed | Look | Look | T1 + T3 | AT-9e |
| S-T | See Friends, Tools, Hidden and Store results from All | Scope segments with Steam's counts; a section per category on All; or Steam's All grid without Q6 | Click | D-pad + A | T3 / T1 | AT-9e |
| — | Empty query lists everything | Zero state "See All" | Click | Focus + A | T3 | G-PAD |
| NEW-1 | Reopen a recent game | Recent Games discs | Click | Focus + A | T3 | G-PAD |
| NEW-2 | Repeat a recent search (session memory) | Recent Searches capsules | Click | Focus + A | T3 | C1b-6 |
| S-A | Find a program; a program as the Top Hit | Top Hit card (program), Open | Click | A | T3 (C2a provider) | HA AT-13 |
| S-B | Launch a matching program; reach more matches | The Software cell; "and N more" → Home › Apps with it focused | Click | Focus + A | T3 (C2a provider) | HA AT-13 |
| S-C | Play a library result | "Play" in the ornament (frozen target); the More circle → Steam's menu → Play | Click | X (Steam's primary action) | T3 | HA AT-13 |
| L8 (search) | A result's item menu (Steam's tile menu) | The More circle inside the attended card; "Options · <target>" in the ornament | Click | ☰ | T2 (C1a helper) | WN AT-26 on `/search` |
| — | Focus returns to the poster you left | Steam's focus history under `NavigateBack` | — | B | — | AT-9c |

H1, H5, H6 and H7 stay C1a's (WN §9.1).

## Strings (PLAN §1.15)

Found by source text in Steam's English UI strings on the Frame (`~/.local/share/Steam/steamui/localization/*english*`, read-only grep, 2026-10-07, build 11094443).

| Text | Token | Where |
|---|---|---|
| Recent Games | `#LibraryHome_RecentGames` | Zero state header |
| Recent Searches | none: English only; omitted elsewhere | Zero state header |
| See All | `#StoreApp_SeeAll` | Zero state capsule; Store row |
| Type to search your library, friends and the Store. | none: English only; omitted elsewhere | Zero state hint |
| All, Library, Friends, Store, Tools, Hidden | `#SearchTab_All`, `_Library`, `_Friends`, `_Store`, `_Tools`, `_Hidden` | Scope bar |
| Store (%1$s), Friends (%1$s), Tools (%1$s), Library (%1$s) | `#Search_Results_Header_StoreApps_With_Count`, `_Friends_With_Count`, `_Tools_With_Count`, `_OwnApps_With_Count` | Section headers |
| Software | `#AppType_2` | Software cell header (S-B) |
| and %1$s more | none: English only; "+%1$s" elsewhere | Software cell |
| Top Hit | none: English only; no tag elsewhere | Top Hit card |
| Open | `#Generic_Open` | Top Hit capsule; A legend |
| Play | `#GameAction_Play` | X legend |
| Options | `#ActionButtonLabelContextMenu` | ☰ legend |
| Back | `#ActionButtonLabelBack` | B legend |
| Playtime: %1$s hrs / Playtime: %1$s min | `#BasicGameCarousel_TotalPlayTime_Hours`, `_Minutes` | Top Hit and focused-poster status |
| Not installed | `#BasicGameCarousel_NotInstalled` | Status |
| Steam's display status (Update Required, Downloading, …) | `#DisplayStatus_*` | Status |
| No Results Found | `#Search_NoResults` | No-results view |
| View more in the Store | `#GamepadHome_GoToStore` | Steam's Store tab (unchanged) |

## Requests

- [x] REQ C1b->C1a: #1 merge the search text: replace WN §4 with "Proposed WN text" in this file, apply its "Line edits elsewhere in WN" (mockup table, §1, §2, §3.7, §7, §8.1/§8.4, §9.1, §10, §11 Q6, §12 D-18 to D-20, §13 AT-9a–e / AT-10 / AT-16). Why: C1b builds §4 but does not own the file (your table at the top of WN rev 3 already assigns §4 and §9.1 H2–H4 + S rows to C1b). **C1a answer (2026-10-07, session 2):** merged. WN §4 is your text; line edits applied (mockup table, §1, §2, §6.2 B label, §7 dismiss and 880 → 960, §8.1/§8.4 P-45 notes, §9.1 with an Owner column — H3's tier set to T1–T3 and AT-3 added to H4 because the field is C1a's —, §10, §11 Q6, §12 D-18 to D-20, §13 AT-9a–e, AT-10, AT-16 plus HA AT-13, PLAN-1b-1, G-PAD and C1b-1 to -9, owner C1b). §3.7's `t1` row was already withdrawn in revision 3.
- [x] REQ C1b->C1a: #2 shared builder (`window-nav-shared.js` / `.css`) to PLAN §1.10, §1.4, §1.11: (a) `buildOrnament` keeps A and B in laser mode as quiet trailing members; (b) when the legends hold only A and B it renders the quiet legend (no capsule material, 60 px items, Medium white .70, `top: 658px` in the margin on `window` routes) instead of removing the ornament; (c) glyph badges only in gamepad mode (`data-mode="laser"` → labels only); (d) `buildMore` 60 visible / 80 hit, black .38 + 10 px blur, and **no blur when the host sits inside another glass container** such as the search sheet (VP P-45). Why: C1b's zero state draws the quiet legend inline today (`.wn-quiet`, the same values as C1c's recipe); once the builder does it, C1b switches to `data-wn="ornament"`. **C1a answer:** done. (a)–(c) were in the builder since session 1; (d) `data-inglass` on `data-wn="more"` drops the blur (P-45). `data-wn="ornament"` with only A and B renders the quiet legend: in the margin on the dim band (see #3), or inside the glass with `data-inglass` (`window-full`). The items sit at y 640–700 (the 84 px band from 628, WN §3.4.1), not at a 658 top.
- [x] REQ C1b->C1a: #3 quiet-legend legibility (finding for you to take to the coordinator, since PLAN §1.10 fixes the look). In `shots/p2_window-nav_search.png` the quiet "Open" sits on the bright room window: background luma p10 181 / p50 209 / p90 230 behind the label; white .70 text there is about 1.1 : 1, far below VP P-39's 4.5 : 1, and the on-room shadow (P-41) does not rescue it (even white 1.0 is about 1.5 : 1). Suggestion: a dark dimming fill under each quiet member (black .35, 60 px capsule, no rim, no blur: a fill, not glass material), or quiet members sitting inside the glass on `window` routes. Measured with PIL on the render; the same holds on the device wherever the room is bright behind the margin. **C1a answer:** decided under PLAN §1.17's rule (WN §3.4.1, §11 O3): on `window` routes the quiet members sit on a dim band (black .62, 60 px, blurred edges, not glass, no slab), labels white .82; flag `quietBacking` (`"window"` default, `"off"` = §1.10's bare look). Measured 5.1–6.7 : 1 over the curtain (L 236) and the sill; bare 1.3–1.5 : 1. Note to the coordinator filed in C1a's log.
- [x] REQ C1b->C1a: #4 route map for `/search` and `/search/tab/*`: `data-lgs-glass="window"`, a route key `data-lgs-route="search"`, Back in the nested style, **no Large Title** in the toolbar row (the snapshot carries a clone of the previous page's title under the scrim), the field in its 640 px variant. Please publish the Large Title node's selector (e.g. `.lgs-title`) in your interface table so C1b's snapshot can clone it, and confirm the Back circle's 0.6 s titled capsule names the page `NavigateBack` returns to. **C1a answer:** done in WN §3.1.1 and §3.2: `/search*` = `window`, route key `search`, Back nested, no Large Title, the 640 field. The Large Title node is `#header > .lgs-title` (T2, `aria-hidden`; in C1a's interface table). Confirmed: after 0.6 s the Back circle names the page Steam's `NavigateBack` returns to (the previous history entry's title from the route map); without a title it does not grow.
- [x] REQ C1b->C2a: #5 conform HA §6 (S-A, S-B, S-C), HA §12.6 and XC §2 to the provider API and geometry in "Interface announced" and the proposed WN §4.6: the Software cell (header `#AppType_2`, 300 × 84 at the start of the Store row, 56 px disc with the 48 px icon, name 24 Semibold, "and N more" English only) replaces the 704 × 76 bottom row with "Search the Steam Store" (Steam's "View more in the Store" stays on the Store tab); the Top Hit rule (a program wins only with a strictly better tier); your provider registers with `__LGS_RT.search.addProvider({id: 'c2a.programs', slots: ['tophit', 'software'], rank, open, primary?})` from `device/rt/41-search-apps.js`. **C2a, 2026-10-07:** done: HA §6 (provider `c2a.programs`, slots `tophit`/`software`, tiers 0–3, strictly-better Top Hit, the Software cell, no `primary` since S-C is your sheet's), §12.6, AT-5(c), AT-13 and XC §2 conformed. Follow-ups for you in REQ C2a->C1b #5 (`docs/phase2/wp/C2a.md`).
- [x] REQ C1b->C2a: #6 `home-apps-search.html` (route matrix row `/search`): it draws the results in the full window, which PLAN §1.9 withdraws (search is a sheet over a snapshot). Please either redraw it as the 960 × 500 sheet over the dimmed page with the Software cell (layout and data as in `window-nav-results.html`, which now shows "Half SBS Toggle" with its real icon), or retire it and point HA §6 at `p2_window-nav_results.png`. **C2a, 2026-10-07:** done: redrawn as your 960 × 500 sheet with your data for "half", gamepad focus on the Software cell, quiet legend (A, B); re-rendered `shots/p2_home-apps_search.png`.
- [ ] REQ C1b->C1c: #8 native depth for the search sheet (C1b's card is T1–T3 and owns no layer fragment; your `theme/layers/22-presentations.json` holds sheets at +10). Please add two rules, default profile non-interactive: (a) `[data-lgs-search="sheet"]` at +10 mm with a `thick` slab, 0 → +10 on `depth` with the present, wearer profile +30 → +50; destructive rule n/a; (b) inside it, a content card `[data-lgs-search="tophit"], [data-lgs-search="library"] > *, [data-lgs-search="store"] > *` at +15 mm on `.gpfocus` (gamepad) and `.lgs-dwell:hover` (laser), click-safe capped by P6, never while the sheet scrolls. The snapshot (`.lgs-snap`), the discs, the Software cell and the scope bar never pop. Why: PLAN §1.7 rows "Sheets, the search sheet" and "search result"; C1b-4 tests it. Not needed before C1b M3.
  - C1c (2026-10-07, session 2): accepted as written, both rules. They land in `theme/layers/22-presentations.json` with C1c's M4 fragment (next round, after P6's reporter v3); left open until then.
  - **C1b, session 2: withdrawn, please do not add search rules.** C1b wrote the sheet rule itself in `theme/layers/21-search.json` (PLAN §2.1 fragment naming, NN = 21; the coordinator's task for this round asks every area for its own fragments). Rule (b) is dropped: the reporter never keeps two overlapping pops (`lgs_layers.js`: "popped rects never overlap"), so a +15 card inside a +10 sheet cannot exist; the focused result rides on the sheet and keeps its CSS lift ×1.05.
- [x] REQ C1b->P10: #7 `glass.py cmp` with two mockups per package: C1b's two states need different routes, `--pre` and mockup origins (zero state: window at (320, 30), the keyboard below it; results: (320, 66)). Please accept `docs/phase2/wp/<PKG>-cmp.json` as `{"mockups": {"window-nav-search": {route, pre, mockOrigin, map}, "window-nav-results": {…}}}`, selected by the mockup file name or `--name`. Both mockups already carry `data-id` on every named element.
  - P10 (2026-10-07 06:00): done. `glass.py cmp` accepts `{"mockups": {"<stem>": {surface, route, pre, mockOrigin, mockScale, map}}}`, chosen by `--name` or the mockup's file stem; top-level fields are defaults; a map value may be `{sel, surface, mockOrigin, mockScale}`; selectors take `@text=`, `@last`, `@nth=N`. A repeated `data-id` keeps its first occurrence. contracts/lab.md §3.

- [x] REQ C1b->C1a: #9 PLAN §6 two-step move, step 2: `theme/21-search.css` now holds every search-route rule of `theme/20-shell.css` §6 (live since 2026-10-07 session 2 of C1b). Please delete §6 ("Search route (/search/tab/*): Phase 1 …") and the `%{GamepadSearch}` entry of §1's "background: none" list (21-search.css paints the T1 scrim on `%{GamepadSearch}` itself and clears it under `html.lgs-c1b`).
  - **C1a answer (2026-10-07, R2 fix pass):** done. `theme/20-shell.css` §6 (the Phase 1 search route) is deleted and `%{GamepadSearch}` is out of §1's "background: none" list; §6 is now a one-line pointer to `21-search.css`.

- [x] REQ C1b->P10: #10 `pad-bfs` recovery: on `/search/tab/All` (any theme state, also with every runtime flag off) the sweep presses Left at the leftmost item, focus leaves the main window (`exit:none`), `recover()` runs, and from then on `takeDirect` fails for every queued node (`untakeable`), so only 4 of 7 (zero state) or 4 of 34 (results) nodes are visited. A manual D-pad script through the same nodes works. Probably the focus is left in the frame menu after the exit and `L.gpTakeEl` cannot pull it back; please re-take `FocusApplicationRoot()` in the main window before the next `takeDirect` after an `exit:*` edge. Evidence: C1b log, session 2 (bfs runs with and without `wp.c1b`).
  - P10 (2026-10-07 session 5): done. Cause (probes 14:00–14:12 on `/search/tab/All`): Left on the field makes
    `vr-null-tree` Steam's active nav tree, the gamepad has left Steam's overlay, and neither `FocusApplicationRoot()`,
    D-pad presses, `BTakeFocus` nor activating main's tree bring it back; the session 4 sweep also counted a moment
    of focus that Steam undid at once as "back". Now, after an `exit:` edge, each step is counted only if main still
    has the gamepad 150 ms later: the opposite press, main's nav tree activated, the root, then Steam's own
    `EnsureVROverlayVisible()` (what its `Navigate` calls) with the root and Down + Up (`overlay`), and last
    `Navigate(route, replace)`; a take that does not land activates main's tree and takes once more. Steam's tab-row
    scroll arrows (`%{Arrows}`, `focusable: false` in Steam's own nav node, laser-only) are listed as
    `notFocusable`, not unreached. Live with `--flags wp.c1b,wp.p3,wp.c1a --mode pad`: zero state **PASS** 7 of 7
    (3 exits back by `overlay`, 14:16); results ("half") **PASS** 32 of 32 targets, 9 exits all back, 0
    irreversible, the 2 arrows listed apart (16:02, `<P10 scratch>/s5/bfs_search_half2.json`). Before: 4 of 7 and
    4 of 34. contracts/lab.md §4 `pad-bfs`.

## Requests to C1b, handled

Session 1: none. Session 2 (`grep -n "REQ [A-Za-z0-9]*->C1b:" docs/phase2/wp/*.md` → three):

- **REQ C1a->C1b (C1a.md: quiet legend in `window-nav-search.html`)**: deferred. This round runs in expedited mode (no mockup re-renders). Nothing on the device depends on it: the live zero state declares only A and B, so C1a's own ornament draws the quiet legend; the mockup switch to `data-wn="ornament"` is a one-line change for the next mockup pass.
- **REQ C1a->C1b (C1a.md: PLAN §6 two-step move of `20-shell.css` §6)**: **done**. `theme/21-search.css` §2–§3 restate every §6 rule with the Phase 2 look (tab-row capsule → the 64 px recessed track without blur, tabs → 56 px segments, arrows → 60 px circles, art radius, the focused-tile ring → the ×1.05 lift and contact shadow, labels, "View more in the Store", no results). While §6 is still in 20-shell.css my rules win (same selectors, later file, `!important` where §6 has it). **C1a may delete §6 now.**
- **REQ C2a->C1b #5 (C2a.md: Software cell details (a)–(d))**: confirmed as written: (a) the cell shows the best program that is not already the Top Hit, absent when none is left; (b) one target (`open` launches with one match, "and N more" goes to Home › Apps through `rt.home.reveal`); (c) a program Top Hit has no More circle and `subtitle` = `#AppType_2`; (d) with a program attended only A and B are declared. Status: the provider API is live in `device/rt/21-search.js` (`__LGS_RT.search.addProvider / providers / candidates`, Liquid Glass dropped, a throwing provider disabled, a slow one skipped); the cell itself renders with the All summary (Q6), which is not built this round: results are Steam's own grid in the sheet (WN §4.6 "All without Q6").

## Log

### 2026-10-07, session 1: M0 conformance

- **Start-of-session request check:** `grep -n "REQ [A-Za-z0-9]*->C1b:" docs/phase2/wp/*.md` → no `docs/phase2/wp/` directory at the start; re-run after it appeared: no matches.
- **Read:** PLAN §0–§2 (all), §3, §4.1–§4.6, §5–§7; WN (all, and C1a's revision 3 changes in the working tree); XC; HA §6, §12.6, §14; VP §3.2, §5, §6 (P-01 to P-89); D2 §3.5, §3.7, §5.3, §7.5, §7.8–§7.10, §9.2–§9.4, §10, §11.2–§11.7; contracts `react.md` (§0–§8), `interaction.md` (§1, §2, §5), `lab.md` (§1, `cmp`); C1c's mockup recipe (`window-nav-menu.html` working tree) for one illumination model across mockups.
- **Strings on the Frame (read-only):** `frame_ssh.py put` of a read-only lookup script to `/tmp/lgs/`, `frame_ssh.py run "python3 /tmp/lgs/c1b_locgrep.py; rm -f /tmp/lgs/c1b_locgrep.py"`, the same for `c1b_locgrep2.py` (token prefixes `SearchTab_`, `Search_Results_Header_`, `DisplayStatus_`, `Playtime_`, `AppType_`, `LibraryTab_`). Result: the "Strings" table. Both scripts removed from the Frame in the same command; nothing else touched. Steam build: `cat /tmp/lgs/steam-build.json` → `11094443`.
- **Real data used by the mockups** (no device access needed; `docs/refs/library/*` from C2c's `fetch-library-refs.py`, git-ignored, with title-card fallbacks): Recent Games = the first five of `lists.json` `recent` (DolphinXR, Halo: Combat Evolved VR (Native), Rise of the Tomb Raider, Balatro, Stardew Valley); library matches for "half" = app types 1 (9 games; Alyx and the HL2 VR mod installed), tools 90, 254430, 255470 (Steam's live count: Tools 3); programs: "Half SBS Toggle" (`icons/half-sbs-toggle.png`); counts All 162 / Library 8 / Friends 0 / Store 158 / Tools 3 / Hidden 4 and the first store capsules from Steam's own `/search/tab/All` page (`shots/p2_audit_search_on.png`, row 2, columns 3–4, cropped by CSS; no file copied).
- **Mockups edited:** `docs/phase2/mockups/window-nav-search.html`, `docs/phase2/mockups/window-nav-results.html` (changes listed in the conformance table).
- **Renders:**
  - `python tools/mockshot.py docs/phase2/mockups/window-nav-search.html shots/p2_window-nav_search.png` → 1 984 359 bytes. Viewed. Fixed after the first render: Steam's strings (Recent Games, See All, Back). Verdict: the page you were on reads through the .35 scrim; the field's ring is the only ring; discs match Home's vocabulary; every control 60 px; no glyph badges in laser mode. Open issue: the quiet legend's contrast over the bright room (REQ #3).
  - `python tools/mockshot.py docs/phase2/mockups/window-nav-results.html shots/p2_window-nav_results.png` → 2 120 667 bytes. Viewed. Fixed after the first render: store cards needed `position: absolute`; the "Tools (3)" peek moved under the 26 px fade. Verdict: the scope bar (Steam's counts) fits 960 with Steam's arrows; the focused Top Hit lifts ×1.05 with the More circle inside; Steam's section headers replace the category capsule column; the Software cell sits beside the Store row; the ornament is a capsule with glyphs in gamepad mode.
  - Contrast measurement for REQ #3: PIL on `shots/p2_window-nav_search.png`, luma (0.299 R + 0.587 G + 0.114 B) over x 880–945, y 705–735 (behind "Open") → p10 181, p50 209, p90 230; over x 985–1040 (behind "Back") → p50 81, p90 191.
- No theme or runtime code written (M0). No device state changed: no Steam, SteamVR, theme or native-mode action; the two scripts in `/tmp/lgs/` were deleted in the same command that ran them.
- **End-of-session request check:** see the last line of this log.

### 2026-10-07, session 2: M2, M3, native fragment (expedited round)

- **Start-of-session request check:** three REQs to C1b (C1a ×2, C2a #5); answers in "Requests to C1b, handled". P7 reports M1 (not M3).
- **M0 note (PLAN §1 conflicts found while building):** (1) PLAN §1.7 lists both "the search sheet +10" and "search result +15", but the reporter never keeps two overlapping pops (`device/lgs_layers.js` "popped rects never overlap"); the sheet wins (it is the presentation) and the focused result rides on it with its CSS ×1.05 lift. (2) WN §4.3 navigates to `Routes.Search.Root()` on activation; Steam itself only navigates on the first keystroke and then **replaces** the entry when already on `/search/tab/All` (probe: AllGames → go(`/search/tab/All`) → two keystrokes → one back = AllGames; typing from `/search` itself was not probed), so activation goes to `/search/tab/All` and one B leaves. (3) Steam's search store keeps the last query and shows it again on `/search`; a fresh activation therefore clears a stale query within 1 s and before any keystroke (to Recent Searches, then the field emptied through Steam's own handler, what its × does), so "Activated, empty → zero state" (WN §4.4) holds.
- **Live probes (locked `glass.py js` steps):** focusing the field does not navigate (Steam); setting the field through the native value setter + an input event runs Steam's own onChange (route → `/search/tab/All`, results for "half": All 162 / Library 8 / Friends 0 / Store 158 / Tools 3 / Hidden 4); clearing it on `/search` keeps the route and empties Steam's store. `%{GamepadTabbedPage}` is `position: relative` 680 tall, `%{TabContentsScroll}` padding-top 58, tabs `max-height: 22px` (Steam's `.Tab.HasAddon`), header z 6000, `#Footer` z 7000.
- **Built:** `theme/21-search.css` (T1 + T3 hooks; draft identical in `theme/_wip/`), `device/rt/21-search.js` (module `search`, flag `wp.c1b`; draft identical in `device/rt/_wip/`), `theme/layers/21-search.json` (sheet +10 mm, thick slab, behind `wp.c1b`). Workflow each time: `brace_error`, copy, `python glass.py check-theme` (clean), `python glass.py sync`.
- **Fixes after viewing shots:** sheet height 720 → `!important` geometry (Steam's own height rule); segments 22 → 56 tall (`max-height: none`); the snapshot's z-indexed rows (library tab row, Sort/Filter) painted above the scrim and through the sheet → `.lgs-snap` is its own stacking context (z 0, isolate), scrim z 1, sheet z 2; DolphinXR's disc empty → art chain hero → portraits → header → monogram, each failing URL steps on; the zero state showed a stale "half" → the stale-query clear above; a field that kept DOM focus gave no `focusin` → a `pointerdown` on the field activates too.
- **Shots viewed:** `shots/c1b_now_all.png` (before: the tab row under the field, uppercase 12 px labels), `c1b_t1_half2.png` (T1 sheet), `c1b_t3_half.png` (T3 results over the snapshot), `c1b_t3_zero3.png` (T3 zero state). The soft grey capsule behind the second disc in the zero state is the library's white "All" segment seen through the 30 px blur (material behaviour, not a node of ours). `c1b_lib_ref.png` was taken while another agent's native session was on (CSS glass dropped, black in CDP shots); not ours.

- **Backdrop finding (session 2, 09:30–09:45):** the sheet's in-page `backdrop-filter` did not frost the snapshot (the page's text read sharp through the sheet). Probes: `brightness(.15)` added to the sheet's backdrop-filter left the page behind untouched, an opaque red glass hid it (so the stacking was right); the same on Steam's tabbed page, on our zero sheet and on a glass slab of ours portalled into `%{BasicHome}` outside Steam's transformed content. Same as C1c's open M2 finding over the zoo page. Fix: the snapshot itself is blurred (`filter: blur(14px) saturate(1.15)`, static) and the sheet gets a denser tint under text (+ `rgb(26 28 36 / .34)` over the thick preset; both dropped under `[data-lgs-pop]` so glassd's slab is the glass in native mode).
- **Structure after the fixes:** no wrapper around Steam's page; the snapshot, scrim and the sheet's glass are portalled into `%{BasicHome} > .lgs-search-layer` (last child, `z-index: -1`, inert), so Steam's DOM paths are unchanged (AUD went from 108 GONE to the reflow-only GONE) and Steam's content paints above the glass. A click on the dimmed page is a document `click` listener (inside `%{PopupBody>Content}`, outside the sheet → `NavigateBack`). Arrows 80 px boxes with the light inset 10; segments 60 tall in the 64 track; results inset 14 px so Steam's 5 columns stay ≥ 85 % of the 6-column tile (177 × 82).
- **Verification runs (all `--flags wp.c1b` unless noted; JSON in C1b's scratch):** gates results pad / laser, zero laser / pad, T1 laser (no flags): SIZE, TYPE, OUTLINE, MOTION pass; AUD as in Status. Two earlier runs at 09:31 were contaminated by another agent's open context menu ("3dSen") and native session (SIZE checked 0, chrome CONTRAST 1.5) and are discarded. Scroll test: 25 tiles + "View more in the Store" reachable in the sheet. Path tests (pad and laser): see Status. Error hooks: none. 
- **Native:** `python glass.py native-session --flags wp.c1b --mode pad --pre <search "half"> --step "sgcheck --route /search/tab/All …" --step "hv c1b_sheet_native --look"` (exit 1: C1a's legacy R2 pops; the `hv` frame was taken while the route re-entered and shows an empty slab, so a second session ran with only `hv` and a 45 s flag overlay pushed in its pre: `c1b_sheet_native2` shows the sheet with content at +10 mm over the blurred page). Both frames viewed and deleted the same minute; Frame `/tmp/lgs/hv-*.png`: 0.
- **End-of-session request check:** `grep -n "REQ [A-Za-z0-9]*->C1b:" docs/phase2/wp/*.md` → the three handled above; new: REQ C1b->C1a #9, REQ C1b->P10 #10; REQ C1b->C1c #8 withdrawn.
