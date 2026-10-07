# C1b Search: review R2

Reviewer: independent adversarial review of package C1b (builder Status: "READY: wp.c1b", M3 + native fragment). Date 2026-10-07, 10:50 onwards. Steam build 11094443 (`/tmp/lgs/steam-build.json`). Device steps only through `python glass.py ...` and the steam-frame-ssh helper, inside the lab locks. Probe scripts and raw JSON are in the session scratchpad, folder `c1b_r2/` (`p1_struct.js`, `p2_tabs.js`, `f1`–`f7`, `r1`, `r2`, `s1`, `m1`, `d1`, `k1`, `g_*.json`). Every live step ran with `--flags wp.c1b,wp.p3,wp.c1a` (the package flag plus the P3 and C1a modules it builds on) unless a row says otherwise.

## Status

**In progress, verdict so far: fix.** Findings M1 to M8 below are established; queued live runs (motion, sounds, removal, perf, pad-bfs, G-FOCUS pairs, conformance) are being added as the shared lab lock lets them through (10 to 30 agents wait on it; most steps need several 240 s rounds). P7 Status at 10:50 and 11:50: "Review R1 fixes in progress" (not complete), so the native checks are **static only** and live native runs are **deferred** (team rule 4).

Files under test (md5, identical on the PC and the Frame): `theme/21-search.css` a44a9753, `device/rt/21-search.js` 51e9d8ab, `theme/layers/21-search.json` 81113779. `python glass.py check-theme`: PASS.

## Findings

### Major

**M1. The scope bar does not fit the sheet: "Hidden 4" is clipped and the counts read as the next segment's.**

- Measured (`p2_tabs.js`, pad, 11:00, native off): each of the six segments is exactly 120 × 60 (the `min-width`; the row `%{TabsRowScroll}` is 708 wide and does not scroll: `scrollWidth` 708 = `clientWidth`), while its content needs 130–160 px (22 px padding × 2 + label + 10 gap + count). The content overflows its own box, centred: "Library 8" spans 438–542 in a 430–550 box, so the gap label→count is 17 px and count→next label ("Friends") 13 px. Visually "8 Friends", "0 Store", "158 Tools" group wrongly (`shots/c1b_r2_gates_res_pad.png`, `c1b_r2_res_pad.png`).
- "Hidden 4" sits at 910–1030 but the row ends at 994: the label is cut mid-word and its count is not visible. G-SIZE skipped it as "partly visible: P-08 not sampled" (`g_res_pad.json`). The builder's own shots (`c1b_t3_half5.png`, `c1b_t3_category.png`) show the same cut. With Library selected (`shots/c1b_r2_gates_cat_pad.png`) the white pill is narrower than "Library 8": the label touches the pill's left edge and "Friends" starts at its right edge. The D-pad scrolls the row so that a focused "Hidden" shows (pad-bfs saw it at x 851), the laser cannot.
- The recessed track runs 308–1032 in a 160–1120 sheet: left inset 148, right 88 (P-36 asks ≤ 24 difference), and it runs under the › arrow (994–1074).
- **G-SIZE fails on the segments.** `gates ... --pre pre_none.js --mode laser` ("zzqxjvkw", 12:08, native off): SIZE FAIL P-08 on "Library 0" (430, 118, 142 × 60) and "Friends 0" (572, 118, 146 × 60): their 80 px hit boxes reach the abutting neighbour. `conformance --route /search/tab/All --mode laser` reports the same P-08 FAIL. Contiguous segments are what E-SEG is for, but Steam's `%{GamepadTabbedPage>Tab}` carries no `data-lgs-exempt="E-SEG"` and is not in `lab/exemptions.json` (it lists Steam's `%{Group>Button}` segments only): C1b should tag them (T2) or file the selector with P10.
- The mockup (`window-nav-results.html`, segments sized to content, `padding 0 18px`, count `margin-left 2px`) shows all six segments with their counts inside the 960 sheet. This is a clear visual and hierarchy miss on the screen's main control.
- Fix: let the segments size to their content (Steam's flex basis is overridden only by `min-width`), use the compact segment (E-SEG compact: 20 px labels, 16 px padding, PLAN §1.10's compact rule) when six do not fit, put the count closer to its own label than to the next one, and centre the track between the arrows. Re-check with "a" (longer counts) and a language with longer labels.

**M2. Focused scope segments and arrows still get Phase 1's white focus ring (P-17, P-42; G-OUTLINE FAIL).**

- `theme/20-shell.css` §6 (still present; REQ C1b->C1a #9 open) has `%{GamepadSearch} %{GamepadTabbedPage>Tab}.gpfocus { box-shadow: 0 0 0 2px scrim, 0 0 0 4px focus-outline, glow !important }` and the same ring on `%{Arrows}.gpfocus`. C1b's `box-shadow: none !important` sits on the plain `Tab` / `Arrows` selectors, one class less specific, so §6 wins. The C1b log says "my rules win (same selectors, later file, `!important` where §6 has it)"; that is not true for these two rules.
- Live (f5, pad, 11:30): the focused "All 162" and "Library 8" segments compute `box-shadow: rgba(0,0,0,.35) 0 0 0 2px, rgba(255,255,255,.92) 0 0 0 4px, rgba(255,255,255,.3) 0 0 22px` (a hard white ring).
- `gates main --route /search/tab/All --flags wp.c1b --mode laser` (11:18): **OUTLINE FAIL**, `"All 162": P-42 2px ring on glass` (the tab kept Steam's `.gpfocus`). The pad runs passed only because no segment held focus at capture time.
- PLAN §1.4: focus on a white fill is an outer glow `0 0 18px 2px` white .30, "blurred, not a ring". Fix in 21-search.css with the `.gpfocus` selectors themselves (and the input-mode scope of M7).
- Without the ring there is no focus look at all. `glass.py focus main --route /search/tab/All --pre <half> --pairs pairs_res.json --mode pad --keep c1b_r2_focus_res` (11:58; capture 0 = "All" focused and selected, capture 1 = a result focused, "All" selected only): inside the pill **dL 0.0** (P-15 asks focused + selected ≥ +10 L over selected: FAIL); the 8–16 px band **+9.0 L** even with the ring (P-16 asks ≥ +20: FAIL). In this tabbed page focus selects (f5: Right on "All" → `/search/tab/Library`), so the focused segment is told apart from the selected one only by that ring. Fix: the PLAN §1.4 glow on `.gpfocus` (≥ +20 L band) and no ring.

**M3. G-TYPE fails in the zero state: the snapshot's cloned Large Title is unstyled text.**

- `gates main --route /library/tab/AllGames --pre <activate>`: **TYPE FAIL** in both modes (laser 11:06, pad 11:41): `lgs-title "Library"`, rect (100, 14, 1180 × 706), "size 16 < 18, weight 400 < 500".
- Cause: C1a styles the title as `#header > .lgs-title`; the clone lives in `.lgs-snap`, outside `#header`, so it renders in the UA default (16 px regular) in a box that spans the window. The "Large Title rides along at its place" (21-search.js) and AT-9a's "pixel-identical" picture do not hold; the builder's "TYPE pass, zero state" is no longer true on this tree.
- Fix: give the clone its computed font, size, weight, colour and box inline at clone time (or wrap it in a scope that 20-shell.css styles), or leave it out.

**M4. AT-9c and the card's G-PAD criterion fail: B does not return focus to the poster you left.**

- f7 (pad, 11:45): from a poster (42, 541; then 447, 267), D-pad Up ×3 goes poster → the VR filter "ALL" → the "All Games 350" tab → the field (search opens). B from a Recent Games disc, and B ×2 from a result tile, land on `/library/tab/AllGames` with focus on the **"All Games 350" tab**, not the poster, in all three runs (also after See All). The card says "B returns to the same poster"; AT-9c's pass is "focus on the same poster".
- Steam's focus history returns to the last element focused on that page, which on the gamepad path is always the tab row the D-pad crossed. The builder's log says "B returns ... with focus on the element you left", which hides that this is the tab, not the poster.
- Also: from the results grid the first B only moves focus to the scope bar (Steam's tabbed page); leaving needs a second B (WN §4.8 says B leaves).
- Fix: remember the page's focused content element when the D-pad first leaves it upward (or at activation from a poster), and refocus it after `NavigateBack`; or record the deviation and change AT-9c with the coordinator.

**M5. The zero state is not A/B-only: Recent Games discs declare X = Play, so the ornament becomes a capsule (C1b-2 fails).**

- f7 (pad): focus on the first disc → `#Footer[data-lgs-orn="capsule"]` "Play · Open · Back". WN §4.9 and C1b-2: "Zero state: A and B only, so the quiet legend"; WN §4.5: "A or a click → the game page" (no X).
- `21-search.js` gives every disc `onSecondaryButton: (e) => R.actions.primary(g.appid, e)`, an undocumented launch path from the search zero state (in the shipped state X starts the game). Either drop it, or add it to WN §4.5, the retention table and C1b-2 and accept the capsule.

**M6. Card acceptance tests not run, or failing, behind a "READY" status.**

PLAN §2.1 M3 needs "the package's own tests pass in both input modes"; the Definition of done needs every card test. Still missing or failing on the builder's side: AT-9e (no-results echo, see M7 / P-62), AT-10 (echo, with C4b), AT-16 (performance), HA AT-13 (providers: nothing renders a provider candidate; `searchCandidates()` is never called by the UI, so S-A, S-B and S-C have no path at all), PLAN-1b-1 (`C1b-cmp.json` does not exist; `glass.py cmp` falls back to side by side), C1b-2 (fails, M5), C1b-3 (G-FOCUS pairs), C1b-5 (motion), C1b-9 (sounds). This review runs the device ones it can (sections below) but the builder's READY claim was premature.

**M7. P-62 (must): no-results view does not echo the query; P-01/P-02 (must): focus looks keyed on `.gpfocus` without an input-mode scope.**

- No results: Steam's "No Results Found" only (`shots/c1b_r2_gates_none_laser.png`, "zzqxjvkw"); nothing draws the query under it (WN §4.4 row "No results", VP P-62 "a no-results view echoes the query"). The builder lists it under "What remains".
- `21-search.css` paints focus on `%{GamepadTabbedPage>Tab}.gpfocus`, `%{Arrows}.gpfocus`, `.lgs-search-cap.gpfocus`, `.lgs-search-game.gpfocus .lgs-search-disc` and `%{ResultTemplate}.gpfocuswithin ...` with no `html:not(.lgs-input-laser)` / `.lgs-input-pad` scope (interaction.md §1.1 CSS rules; P4's `04-states.css` keys its own numbers that way). Under the laser a stale `.gpfocus` paints the white focus fill, the disc lift and glow (R14). And `.lgs-search-game:hover .lgs-search-disc { scale: 1.10 }` lifts at once on hover instead of after the 80 ms dwell (PLAN §1.4, P-06), overriding the correct `--lgs-lift` hook on the same element.

**M8. Retention-table rows with no path at all: L8 (search) item menu, S-A, S-B, S-C.**

- L8 (search), "The More circle inside the attended card | Click | ☰", owner "C1b (registration)": 21-search.js never calls `more.register`, so there is no More circle on results; ☰ on a focused result tile opens nothing (f6: 0 menu items; the tile's props hold only `onFocus, onClick, onTouch*, onContextMenu`).
- S-A / S-B / S-C (program Top Hit, Software cell, X = Play): no cell renders provider candidates (the All summary is not built), and Steam's result tiles have no `onSecondaryButton`. None of these is a stock function that is lost (stock search has no item menu, no programs and no X on tiles), but the concept's retention table (WN §9.1, which `glass.py ledger` reads) promises both paths for each, with C1b as owner. Either build them, or mark them as later-round rows (not "kept") with the coordinator.

### Minor

- **m1. Native fragment, hole fill.** `theme/layers/21-search.json` uses `"hole": {"fill": "auto"}`. The reporter samples tones with `elementsFromPoint`, which skips `pointer-events: none` layers (reporter.md §3.4); the snapshot, scrim and glass are all `pointer-events: none` inside `.lgs-search-layer`, so the sampled sliver will be the window behind, not the dimmed page. PLAN §1.8: "the hole treatment's fill follows the scrim". Use `"fill": "scrim"`.
- **m2. Native fragment, modal.** The sheet rule has no `"modal": true` (reporter.md §3.2: true for menus, alerts and sheets; PLAN §1.7 rule 6: while a sheet is open only it pops). Other areas' admission-on pops stay up under the search sheet.
- **m3. File ownership.** `theme/layers/21-search.json` is not in C1b's card or in the §2.6 index ("a file that is not listed is owned by the coordinator"; "a package creates new files only inside its listed patterns"). The builder cites a coordinator instruction for this round; the coordinator should confirm it and add the row. REQ C1b->C1c #8 is withdrawn but still `- [ ]`; the three REQs to C1b in `C1a.md` (×2) and `C2a.md` (#5) are answered only in C1b.md and are still `- [ ]` where they were filed.
- **m4. Idle work.** While the search route is mounted, `SearchRoute` runs a 300 ms `setInterval` (stale-query check, query diff) for as long as the sheet stays open. "Nothing runs at idle"; an `input`/`search` event or a MutationObserver on the field's `value` would do.
- **m5. Reduce Motion.** The glass's `transition: left, width` (zero state → results) still animates geometry under `prefers-reduced-motion` (P-56: opacity only); animating `left`/`width` is also against the LAB performance rule (opacity, `scale`, `translate` only). The scrim keeps a 441 ms fade there (180 ms after P5's token swap, so only the geometry part matters).
- **m6. The snapshot is blurred everywhere.** `filter: blur(14px)` on the whole picture makes the page you were on unrecognisable outside the sheet (`shots/p2_cmp_c1br2_zero.png`, left mockup vs right live); WN §4.2's point is that the page stays. Blur only the part behind the sheet (a clipped second copy, or a mask), keep the rest sharp under the .35 scrim.
- **m7. Entry focus.** Down from the field lands on the "All" segment, not on the first result (WN §4.8 / P-22: the Top Hit). Expected while the All summary is missing; segments at y 118 are also above P-23's 124 line.
- **m8. G-AUD.** Results: GONE = the reflowed 6th column and "View more in the Store", SHRUNK = the sheet containers. The relocation is real (f6: the D-pad reaches the last row, 25 tiles, "View more in the Store" at (929, 493), scroll 268/296), but it is still a failing gate: it needs an exemption entry (REQ to P10 for virtualised reflow, or a coordinator note), not a log sentence.
- **m9. Provider API.** The interface says a rank call over 2 ms is skipped; the code skips only over 8 ms (`SEARCH_RANK_MS * 4`). `ctx.steamBest` is always `null`.
- **m10. DolphinXR's disc shows the monogram "D"** (no hero, portrait or header found), while the mockup shows its art; check `data.art()` for shortcut art (custom grid images).
- **m12. The VR keyboard stays up after leaving.** After a laser activation (the keyboard rises), leaving by a click on the dimmed page leaves the keyboard visible over the library (`k1`: `visible /library/tab/AllGames`, field blurred). Steam does the same when you leave with Back (`k2` without C1b), so nothing is lost, but the dimmed-page path is C1b's own: hide the keyboard there (`SteamClient.OpenVR.Keyboard.Hide()` is what the lab uses) or say in WN §4.8 that Done is still needed.
- **m11. Mockup debt.** REQ C1a->C1b (quiet legend in `window-nav-search.html`) is still open; the mockup shows the bright-room legibility problem C1b itself reported (REQ #3).

## Re-run results

Times are the Frame's step times. "native" is the native layer's state reported by the step (other agents' native sessions run in between; DOM gates are valid either way, CONTRAST and shots only with native off).

| Test | Command (all `--flags wp.c1b,wp.p3,wp.c1a` unless noted) | Result | Evidence |
|---|---|---|---|
| Structure, laser activation | `js p1_struct.js --mode laser` | PASS: click/focus on the field → `/search/tab/All`, zero state 880 × 500 at (200, 100), glass same rect, snapshot 0 `[id]`, inert, 856 nodes, 10 ms; header, Back and `#Footer` are outside `%{PopupBody>Content}` (so the dimmed-page listener cannot fire on them); B → `/library/tab/AllGames`, layer and snapshot gone | stdout |
| C1b-1 results, pad | `gates main --route /search/tab/All --pre pre_half.js --mode pad --shot c1b_r2_gates_res_pad` (11:00, native off) | SIZE, TYPE, OUTLINE, MOTION pass; AUD FAIL (reflow GONE, m8); "Hidden 4" skipped as partly visible (M1) | `g_res_pad.json`, `shots/c1b_r2_gates_res_pad.png` |
| C1b-1 results, laser | same, `--mode laser` (11:01, **native on**) | SIZE, TYPE, OUTLINE, MOTION pass; AUD CONTRAST lines are void (native on drops the CSS glass); rerun queued | `g_res_laser.json` |
| C1b-1 results, `wp.c1b` alone, laser | `--flags wp.c1b --mode laser` (11:18) | **OUTLINE FAIL** P-42 ring on "All 162" (M2) | `g_c1bonly_laser.json` |
| C1b-1 T1 (no flags), pad | `--mode pad` (11:16) | SIZE, TYPE, OUTLINE, MOTION pass; AUD as above | `g_t1_pad.json`, `shots/c1b_r2_gates_t1_pad.png` |
| C1b-1 zero state | `gates main --route /library/tab/AllGames --pre pre_zero.js`, laser (11:06) and pad (11:41) | **TYPE FAIL** both modes (M3); SIZE, OUTLINE, MOTION pass; AUD GONE = Steam's list-everything page (by design) | `g_zero_*.json`, `shots/c1b_r2_gates_zero_laser.png` |
| Scope bar geometry | `js p2_tabs.js --mode pad` (11:00) | six segments 120 × 60, row 708 wide without scroll, "Hidden 4" past the row end (M1) | stdout |
| Laser paths | `js f1_laser.js`, `f2_laser.js --mode laser` (11:20–11:25) | field click → zero; a Recent Searches capsule → results for "half"; segment click → `/search/tab/Library`; › → Friends; ‹ → Library; the clipped Hidden segment still clicks; dimmed-page click from `/search/tab/Friends` → `/library/tab/AllGames` in one step (tab changes replace the entry); Back circle → `/library/tab/AllGames` (one step, not two) | stdout |
| Gamepad paths, zero state | `js f3_pad.js --mode pad` | Up ×3 from a poster (VR filter, tab row, field) opens the zero state with DOM focus in the field; Down → first disc (P-22); Right ×2, Down, Up reversible; Down to See All; Left at the edge leaves the window (frame menu) | stdout |
| Gamepad paths, results | `js f5_pad.js`, `f6_pad.js`, `f7_pad.js --mode pad` | Down from the field → "All" segment; Right selects Library (focus = selection); LB / RB step All ↔ Library ↔ Friends; the D-pad reaches the last row (25 tiles, "View more in the Store" at (929, 493)); ☰ on a result opens nothing (M8); B from a tile → scope bar, second B leaves; **focus returns to the "All Games" tab, not the poster** (M4); disc focused → ornament capsule "Play · Open · Back" (M5); See All with A → Steam's empty-query page (All 446 / Library 424 / Friends 4 / Store 0 / Tools 18) | stdout |
| G-PAD | `pad-bfs --route /search/tab/All --pre pre_half.js --mode pad` (11:59, native off) | 32 / 34 reached, none irreversible; unreached = the two ‹ › arrows (not D-pad targets; LB / RB cover them); entry = the field. The builder's "pad-bfs stops after the first Left" no longer happens | `bfs_res.out` |
| G-FOCUS zero state | `focus main --pre fpre_zero.js --pairs pairs_zero.json --mode pad --keep c1b_r2_focus_zero` (11:55) | P-14 capsule +99.8 L, See All +109.3 L: PASS. Disc: lift ×1.10 plus a white halo glow (the glow is not in PLAN §1.4's content-card recipe) | `shots/c1b_r2_focus_zero_*.png` |
| G-FOCUS results | `focus main --route /search/tab/All --pre pre_half.js --pairs pairs_res.json --mode pad --keep c1b_r2_focus_res` (11:58) | **P-15 FAIL** (0.0 L), **P-16 FAIL** (+9.0 L); the only focus cue is the forbidden ring (M2). Arrow pair void (the arrow does not take gamepad focus) | `shots/c1b_r2_focus_res_*.png` |
| C1b-6 memory | `js m1_mem.js` (three queries) + `frame_ssh grep -r` | PASS: Recent Searches = the three + "half"; no key in local or session storage of main or SharedJSContext; no file under `/tmp/lgs`, `/dev/shm/lgs`, `~/.local/share/glass-shell` or Steam's Local/Session Storage holds the queries | stdout |
| C1b-7 removal, flag off live | `js r1_flagoff.js` (pushes `wp.c1b: false` while the sheet is open) | PASS: results and zero state both: no `.lgs-search-layer`, snapshot, zero state or `data-lgs-search*` of C1b, no `html.lgs-c1b`, no `__LGS_RT.search`, override gone; Steam's page stays on `/search/tab/All` with the T1 look; flag back on reinstalls | stdout |
| C1b-9 sounds | `js s1_sound.js --mode pad` (PlayAudioURL spy, nothing played) vs the same without `wp.c1b` (`s2_sound_t1.js`) | **FAIL**: open plays `show_modal` once (good), leaving plays `hide_modal` **twice** (Steam plays one itself on `NavigateBack`, C1b adds a second); LB / RB play Steam's `tab_transition`; nothing on hover | stdout |
| Keyboard on leaving | `js k1_kb.js` (C1b) and `k2_kb.js` (no C1b) | The VR keyboard stays up after leaving search, by the dimmed page (C1b) and by Back (Steam, same without C1b): see m12 | stdout |
| Menu over the sheet | `js d1_menu.js` | a `contextmenu` on a result opens no menu on this build, so "outside click closes the menu, not search" could not be exercised | stdout |

## Function retention (WN §9.1, the S rows and H2–H4)

"Live" = exercised in a locked step this session; "static" = code read only.

| # | Function | Laser path | Gamepad path | Verdict |
|---|---|---|---|---|
| H2 | Start a search | Click the field → zero state (live, f1, p1) | Up ×3 from a poster → field → zero state (live, f3) | Kept |
| H3 | Type / edit | Steam's keyboard rises on the click (live, k1) | Keyboard via A on the field (not pressed, C4b's) | Kept (Steam's) |
| H4 | Clear | The field's × (C1a); f8 queued | Y "Clear" legend in results (Steam's), Backspace | See f8 row |
| S1 | Switch category, with counts | Segment click and ‹ › (live, f1); Hidden's count not visible (M1) | LB / RB, Up + Left/Right (live, f5) | Kept, count display broken (M1) |
| S2 | Open a result | Steam's tile click (f8 queued) | D-pad + A (Steam's tiles, not pressed) | Steam's handlers untouched |
| S3 | View more in the Store | Reachable by scroll (look only) | Reached by the D-pad (live, f6) | Kept |
| S4 | Leave search | Back circle (live, one step), dimmed page (live) | B: one press in the zero state, two from the results grid (live) | Kept; focus does not return to the poster (M4) |
| LA S4 | No results | "No Results Found" (see gates run) | same | Kept; no echo (M7) |
| S-T | Other categories from All | Segments with counts | LB / RB | Kept, Hidden count clipped (M1) |
| — | Empty query lists everything | See All click (f8 queued) | See All + A → Steam's page (live, f7) | Kept |
| NEW-1 | Reopen a recent game | Disc click → `actions.navigate` (f8 queued) | Disc + A (f8 queued) | — |
| NEW-2 | Repeat a recent search | Capsule click → results (live, f1) | Capsule + A (f8 queued) | Kept |
| S-A, S-B, S-C | Programs, Software cell, X = Play | none | none | **Not built** (M6, M8) |
| L8 (search) | Item menu | no More circle registered | ☰ does nothing (live, f6) | **No path** (M8) |
| — | Focus returns to the poster | — | B → the "All Games" tab (live, f7) | **Fails** (M4) |
