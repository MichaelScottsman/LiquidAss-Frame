# C1b Search: review R2

Reviewer: independent adversarial review of package C1b (builder Status: "READY: wp.c1b", M3 + native fragment). Date 2026-10-07: session 1 from 10:50 to 12:30, session 2 from 13:00 to 13:25. Steam build 11094443 (`/tmp/lgs/steam-build.json`). Device steps went only through `python glass.py ...` and the steam-frame-ssh helper, inside the lab locks. Probe scripts and raw outputs are in the review's scratchpad: session 1 in `c1b_r2/` (`p1_struct.js`, `p2_tabs.js`, `f1`–`f9`, `r1`, `r2`, `s1`, `s2`, `m1`, `d1`, `k1`, `k2`, `t*_timeline.js`, `g_*.json`, `bfs_*.out`, `conf_*.out`), session 2 in `c1b_r2b/` (`a_laser.js`, `b_pad.js`, `t_tl.js`, `c_clear.js`, `n_probe.js`, `native.py`, `native2.py`, `m_*.js`, `pre_act_*.js`, `*.out`). Unless a row says otherwise, every live step ran with `--flags wp.c1b,wp.p3,wp.c1a`: the package flag, plus the P3 and C1a modules it builds on.

## Status

**Complete. Verdict: fix** (11 major, 14 minor, no blocker).

- **Files under test** (md5, the same on the PC and the Frame, unchanged from 10:12 to 13:25): `theme/21-search.css` a44a9753, `device/rt/21-search.js` 51e9d8ab, `theme/layers/21-search.json` 81113779. `python glass.py check-theme` gave PASS at 13:00.
- **P7** reported "Review R1 fixes complete" at 12:45, so session 2 ran the live native checks: two `native-session`s at 13:11 and 13:13. The second was needed because `hv` steps ignore `--flags` (see the notes).
- **PLAN** was amended at 13:08 by R2-15 and R2-16. C1b's card is now T1–T4, and it owns `theme/layers/21-search.json` with a T4 line: `modal: true`, and the hole's `fill` follows the scrim. That settles old m3, and m1 and m2 are now card requirements (M6).
- **Device left as found:** theme on, CSS only (both sessions printed "back to CSS only: yes"), route back in the library, keyboard hidden, pointer parked. Room frames: all three `hv --look` frames were viewed and deleted the same minute, with 0 left on the PC and 0 in `/tmp/lgs` on the Frame.
- **Disclosure: flags leaked.** The four steps of the first native session that carried `--flags` (`js`, `sgcheck` ×2, `conformance`) were not popped at step exit. Their overlays (TTL 900 s) kept `wp.c1b` on from 13:12 to 13:21. I removed my four tokens with `__LGS_RT.test.flags.pop` at 13:21; `wp.c1b` is off and `search` is not installed. Eight `{wp.c1a, wp.p3}` overlays from other agents were left alone. This is a lab bug (notes, n1).

## Findings

### Major

**M1. The scope bar does not fit the sheet. "Hidden 4" is clipped, each count reads as part of the next segment, and the segments break E-SEG and G-SIZE.**

- Measured again in session 2 (`a.out`, laser, 13:0x, native off). Six segments of exactly 120 × 60 (`flex: 0 1 auto`, `min-width: 120px`) sit in a `%{TabsRowScroll}` 708 px wide (286–994, no scroll). The content does not fit:
  - "Library 8": label 438–511, count 528–542, next label "Friends" from 555. The label→count gap is 17 px and the count→next-label gap is 13 px, so the shots read "8 Friends", "0 Store", "158 Tools".
  - "Hidden 4": box 910–1030 against a row that ends at 994. The count (1009–1023) is not visible, and `elementFromPoint` at the segment's right end hits the › arrow, not the segment.
  - Shots: `shots/c1b_r2_gates_res_pad.png`, `c1b_r2b_res_hover.png`, the builder's own `c1b_t3_half5.png`.
- **E-SEG** (PLAN §1.16): ≥ 140 wide for a regular segment and 120 only for a compact one. These segments are 120 wide with regular 22 px Semibold labels. The coordinator noted the same gate drift: coordinator.md, REQ Coordinator->P10 (R2-15) item 4.
- **G-SIZE fails.** No-results run (`g_none_laser.json`, 12:08, native off): P-08 FAIL on "Library 0" (430, 118, 142 × 60) and "Friends 0" (572, 118, 146 × 60), because each 80 px hit box reaches the abutting neighbour. `conformance --mode laser` gives the same P-08 FAIL. Steam's `%{GamepadTabbedPage>Tab}` carries no `data-lgs-exempt="E-SEG"` and is not in `lab/exemptions.json`.
- **Track off-centre:** 308–1032 in a 160–1120 sheet. The left inset is 148 and the right 88, a 60 px difference against P-36's 24. The track also runs under the › arrow.
- The mockup (`window-nav-results.html`) shows all six segments, with their counts, inside the 960 sheet.
- **Fix:**
  - Let segments size to their content (`flex-shrink: 0`).
  - Switch to the compact segment (20 px labels, 16 px padding; PLAN §1.10's compact rule) when six do not fit.
  - Keep each count closer to its own label than to the next one, and centre the track between the arrows.
  - Tag the segments E-SEG (T2), or file the selector with P10.
  - Re-check with "a" (longer counts).

**M2. Focus and hover on the scope bar are wrong in both modes: a Phase 1 ring, and P4's light drawn on the whole row instead of the segment.**

- **(a) The ring.** `theme/20-shell.css` §6 still has `%{GamepadSearch} %{GamepadTabbedPage>Tab}.gpfocus { box-shadow: 0 0 0 2px scrim, 0 0 0 4px focus-outline, glow !important }`. REQ C1b->C1a #9 is open.
  - C1b's `box-shadow: none !important` sits on the plain `Tab` selector, one class less specific, so §6 wins. The C1b log's "my rules win (same selectors, later file)" is not true for this rule.
  - Live in `b.out` (pad, 13:0x): the focused "All 162" computes `rgba(0,0,0,.35) 0 0 0 2px, rgba(255,255,255,.92) 0 0 0 4px, …`.
  - `gates --flags wp.c1b --mode laser` (11:18): **OUTLINE FAIL**, P-42 "2px ring on glass" on a stale `.gpfocus`. P-17 is a must.
- **(b) P4's illumination hook is mis-anchored.** C1b sets `--lgs-ill: raised` (`white` when selected or focused) on the segments but does not make them a containing block (`contracts/tokens.md`: "the element must be a containing block").
  - The hook's `::after` resolves to **708 × 120 px** (`b.out` `afterInset`: `0px 0px 708.333px 120px`), the size of the row, not the 120 × 60 segment.
  - Laser hover on "Friends" lights a capsule over the whole bar: `shots/c1b_r2b_res_hover.png`.
  - Gamepad focus on "All" draws P4's `--lgs-white-glow` around the whole row as a halo frame, on top of the §6 ring: `shots/c1b_r2b_res_padseg.png`, and session 1's `c1b_r2_focus_res_0.png`.
- **G-FOCUS fails.** `focus main --route /search/tab/All --pairs pairs_res.json --mode pad` (11:58): P-15 focused+selected vs selected **0.0 L** (needs ≥ +10); P-16 glow band **+9.0 L** (needs ≥ +20). Focus selects in this tabbed page, so the ring is the only thing that sets the focused segment apart.
- **Fix:**
  - `position: relative` on the segments (and check the arrows, which also opt into the hook).
  - Remove the ring with a rule that names `.gpfocus` itself, until C1a deletes §6.
  - Scope by input mode (M8).
  - Re-run G-FOCUS: P4's glow measures +23 L when it is drawn around the right box.

**M3. G-TYPE fails in the zero state: the snapshot's cloned Large Title is unstyled text in a window-sized box.**

- `gates main --route /library/tab/AllGames --pre <activate>` gives **TYPE FAIL** in both modes (laser 11:06, pad 11:41): `lgs-title "Library"` at (100, 14, 1180 × 706), "size 16 < 18, weight 400 < 500". Re-measured in `a.out` (13:0x): the same clone, 16 px / 400, 1180 × 706.
- **Cause:** C1a styles the title as `#header > .lgs-title`. The clone lives in `.lgs-snap`, outside `#header`, so it gets the UA default. Under the 14 px blur it is invisible anyway (`c1b_r2b_zero.png`).
- So the "Large Title rides along at its place" (21-search.js) and AT-9a's "pixel-identical" picture do not hold.
- **Fix:** give the clone its computed font, size, weight, colour and box inline at clone time, or leave it out.

**M4. B does not return focus to the poster you left (AT-9c, the card's G-PAD criterion, VP P-21 must).**

- **Zero state.** From a poster: Up ×3 (VR filter → "All Games" tab → field) opens search, Down, then B. Focus lands on the **"All Games 350" tab**, not the poster. Seen in three runs of session 1 (`f7.out`) and again in session 2 (`b.out` `c_afterB`).
- **Results.** Leaving takes two B presses: the first only moves focus to the scope bar (`g_B1`). After the second there is **no `.gpfocus` at all** on `/library/tab/AllGames` (`b.out` `g_B2`: `none(active=BODY)`), so P-13 ("exactly one focused element") fails at rest after leaving.
- The builder's "focus on the element you left" hides that this element is the tab row the D-pad crossed.
- The coordinator (coordinator.md, second pass) notes that any deviation from AT-9c must still meet P-21: focus back on the sheet's source.
- **Fix:** remember the page's focused content element when the D-pad first leaves it upward (or at activation from a poster), and refocus it after `NavigateBack`.

**M5. The zero state is not A/B-only. Recent Games discs declare X = Play, so the ornament becomes a capsule (C1b-2 fails), and there is an undocumented launch path.**

- `b.out` (pad, 13:0x): focus on the first disc gives `#Footer[data-lgs-orn="capsule"]` "Play · Open · Back". WN §4.9 says "Zero state: A and B only, so the quiet legend". WN §4.5 says "A or a click → the game page" (no X).
- `21-search.js` l. 337 gives every disc `onSecondaryButton: (e) => R.actions.primary(g.appid, e)`. `f9.out` logged `primary(3699252713)` on X. With `actionsLive` on at release, X on a zero-state disc starts the game.
- **Fix:** drop it, or add it to WN §4.5, the retention table and C1b-2, and accept the capsule.

**M6. Native (card T4 [R2-16], C1b-4): the zero state never pops, and the results pop carries the CSS glass's tint over glassd's slab. No `modal: true`, and the hole has no scrim tone.**

- **Session 2 native probe** (`native.out`, `n_probe.js`, 13:11, `__LGS_LAYERS.snapshot()` / `debug('main')`):
  - **Zero state:** rule `search-sheet` on `.lgs-search-glass` gives `skip: "covered"`; `main` has **0 layers**. `sgcheck --pre <zero>` (13:11:57): "main: 0 pops, depths [0.0]".
  - **Cause:** the reporter's hit test (`lgs_layers.js` `covered()`, `elementFromPoint` at the centre) can never land on the glass, which is `pointer-events: none` inside an `inert` layer. So the rule is dead in every state, and the zero state is flat CSS glass in native mode. That gives no stereo depth on the screen users see first.
  - **Results:** only the fallback rule `search-sheet-t1` admits, on Steam's `%{GamepadTabbedPage}`: (240, 150, 1440 × 750) tex, dz 0.0271 (10.0 mm), `thick`, `interactive: false`, `hole: true`. `sgcheck` (13:12:02): "main: 1 pops, depths [0.0, 10.0]", PASS.
  - The pop is on the tabbed page, so `.lgs-search-glass[data-lgs-pop]` never matches. The glass keeps `linear-gradient(rgb(26 28 36/.34)) + thick + blur(30px) saturate(1.5)` in native mode (probe `glassPop`), and the crop carries that CSS tint over glassd's real `thick` slab. That is double material, which hides the refraction the slab exists for.
- **No `"modal": true`** on either rule. This is §1.7 rule 6, and now the card's T4 line.
- **`"hole": {"fill": "auto"}`:** the report carries a bare `hole: true`, with no `edges` and no `fill`. The reporter's samples skip the `pointer-events: none` snapshot and scrim (reporter.md §3.4), so nothing follows the .35 scrim. PLAN §1.8 and the T4 line ask for the scrim.
- The builder's "rule 'search-sheet' pops that slab … for the zero state too" (the fragment's `about`) is not true on the device.
- **Headset view** (second session, flags pushed in the pre with a 14–17 s TTL; frames viewed, then deleted):
  - Both states render in the headset, with no doubling visible. The off-axis (30°) results frame shows the sheet offset from the window, so the +10 mm pop is real.
  - Nobody wore the headset, so the window sat at the frame's bottom edge (about 340 px wide). Material and edges could not be judged; G-HV verdict withheld (auto rect).
- **Fix:**
  - Pop an element that hit-tests (the zero state's `.lgs-search-zero`, and the tabbed page in results), or set the rule's Phase 1 `hitTest` off.
  - Drop the CSS glass paint while the sheet is acked (`:has()` on the acked node).
  - Add `"modal": true` and `"hole": {"fill": "scrim"}`.
  - Re-run `sgcheck` for the zero state, the results and a category.
- **Native conformance** (`conformance --route /search/tab/All` as a native step, 13:12:10): P-11, P-46, P-47, P-48, P-51 **PASS**; P-49 MANUAL. (P-39 and P-43 there are not C1b's: notes, n3.)

**M7. Motion (G-MOTION, C1b-5, VP P-56 must): no dismiss animation, a re-present on the first keystroke, and geometry animated under Reduce Motion.**

- **Dismiss.** Timeline `t_tl.js` (`tl_c1b.out` / `tl_t1.out`, pad, 13:1x, native off), opacity sampled per frame:
  - After B, the sheet stays fully opaque (scrim 1, glass 1) for **0.8 s from the zero state** and **1.1 s from results**. Then it disappears in a single frame: scrim and glass go from 1 to gone with no intermediate frame.
  - Steam's own page with the runtime off (T1) is gone by 0.64 s, fading out.
  - `motion --pre m_out.js` (B, then pause) captured **no animation of ours**. 21-search.css has no exit rule at all.
  - WN §4.9 promises "content and glass fade out in 150 ms linear"; PLAN §1.5 says exit ≤ 200 ms, and G-MOTION wants content before glass on exit.
- **First keystroke.**
  - `motion --pre m_res.js` (`p2_motion_c1b_r2b_results_strip.png`): the zero state's content is cut at once, leaving an **empty glass** for frames f 0–0.15. Steam's page then replays the whole present (`lgs-sheet-in` 735 ms from opacity 0 and scale .97; P-54 "starts 21 px from rest") while the glass widens 880 → 960.
  - WN §4.9 asks for the 880 → 960 morph with a cross-fade.
- **Reduce Motion.** `motion ... --media reduce` (`mrr.out`): **P-56 FAIL**, "transition:left / width on lgs-search-glass: animates left / width under Reduce Motion". Animating `left` / `width` also breaks the LAB performance rule (opacity, `scale` and `translate` only).
- **Stale query.** Steam keeps the last query, so a re-activation first renders "results" for one commit. Session 1's `motion` (`mo_in.out`, 12:17) caught the glass shrinking 931 → 880 during `sheet-in` (P-53 flagged, window scale 1.058): the glass is wider than the zero state's content for about 0.5 s.
- **Open** (`mi.out`, 13:1x) with an empty store: tokens only, nothing at rest. The one P-53 there is P5's shared `sheet-in` scale (.97 → 1), not C1b's.
- **Fix:**
  - A real exit (content, then glass, ≤ 200 ms) driven before `NavigateBack`, or a held clone faded out after it.
  - The 880 → 960 morph with a cross-fade, and no second `sheet-in` on Steam's page once the sheet is presented.
  - No `left` / `width` transitions: use `scale` or a clip, and fades only under Reduce Motion.
  - Set the glass's state before first paint.

**M8. Conformance misses in this area: P-62 (must), P-01 / P-02 (must), P-06 (should).**

- **P-62.** No-results shows Steam's "No Results Found" only. `a.out` (13:0x): the sheet's text is "All 0 Library 0 Friends 0 Store 0 Tools 0 No Results Found", and `zzqxjvkw` appears nowhere (`echo: false`). The builder lists the echo under "What remains", while the card's AT-9e asks for it.
- **P-01 / P-02.** C1b's own focus rules key on `.gpfocus` with no input-mode scope:
  - 21-search.css l. 223, 228 (segments), l. 254 (arrows), l. 309 and 324–325 (results), l. 473 (disc), l. 531 (capsules);
  - `conformance` (both modes): P-01 FAIL and P-02 FAIL on this route. Its list is global, but C1b's selectors are in it.
  - Under the laser a stale `.gpfocus` paints the white fill, the ring (M2), the disc lift and its halo.
- **P-06.** `.lgs-search-game:hover .lgs-search-disc { scale: 1.10 }` lifts at once on hover, ignoring the 80 ms dwell, and overrides the correct `--lgs-lift` hook on the same element.

**M9. Retention-table rows with no path at all: L8 (search), S-A, S-B, S-C, and the results capsule.**

- **L8 (search)**, "the More circle inside the attended card | Click | ☰", with C1b as registration owner. 21-search.js never calls `more.register`, so there is no More circle on results. ☰ on a focused result tile opens nothing: in `f6.out` a tile's props are only `onFocus, onClick, onTouch*, onContextMenu`, and `b.out` `f_tileLegends: []`.
- **S-A / S-B / S-C** (program Top Hit, Software cell, X = Play): no cell renders provider candidates, `searchCandidates()` is never called by the UI, and Steam's tiles have no `onSecondaryButton`. Results with a library item attended show the quiet legend (`b.out` `f_orn` "quiet Select Back"), not WN §4.9's capsule with X and ☰.
- None of these is a stock function that is lost: stock search has no item menu, no programs and no X on tiles. But WN §9.1, which `glass.py ledger` reads, promises both paths with C1b as owner.
- **Fix:** build them, or mark them as later-round rows with the coordinator. The coordinator's second pass says these are C1b's to fix first.

**M10. G-AUD fails in every search state, with no exemption or REQ behind it.**

| State | Run | AUD issues |
|---|---|---|
| Results | `g_res_pad.json`, 11:00, native off | GONE 9: the reflowed sixth-column tiles and "View more in the Store" of Steam's virtualised grid, 6 → 5 columns |
| Zero state | `g_zero_laser.json`, 11:06 | GONE 201 (Steam's list-everything page, replaced by See All by design), SHRUNK 2, CONTRAST 2 |
| Category Library | `g_cat_pad.json`, 12:04 | SHRUNK 4, GONE 3 |

- The relocations are real. In `f6.out` the D-pad reaches the last row (25 tiles, "View more in the Store" at (929, 493)), and See All opens Steam's page (`f7.out`).
- But PLAN §4.1 counts only §1.16's exemptions, and the builder filed neither an exemption (P10, `lab/exemptions.json`) nor a REQ to the coordinator. So the gate stays FAIL.
- The zero state's two CONTRAST lines are C1a's quiet legend (notes, n3).

**M11. The card's own tests: several fail, and others never ran, behind a "READY" status.**

PLAN §2.1 M3 needs "the package's own tests pass in both input modes", and the Definition of done needs every card test.

| Test | Result |
|---|---|
| AT-9c | FAIL (M4) |
| AT-9e | FAIL (no echo, M8) |
| C1b-1 | FAIL (TYPE, M3; SIZE in no-results, M1) |
| C1b-2 | FAIL (M5; results capsule missing, M9) |
| C1b-3 | FAIL (M2) |
| C1b-4 | FAIL (M6) |
| C1b-5 | FAIL (M7) |
| C1b-9 | FAIL on one path: the Back circle plays `hide_modal` **twice** (`s1.out`; Steam once, C1b's `sheetOut` once more; T1 plays it once, `s2.out`). B plays it once (`b.out`) |
| HA AT-13 | No UI path (M9) |
| PLAN-1b-1 | Not run by the builder: `C1b-cmp.json` does not exist. Side by side: the zero state is close to its mockup (`shots/p2_cmp_c1br2_zero.png`), but the results are Steam's grid, not the mockup's All summary |
| AT-10 | Not run; C4b's |
| AT-16 | Partly run (results below) |
| G-PAD zero state | `pad-bfs` 2/7 (notes, n2); the manual D-pad sweep reaches all seven |

### Minor

- **m1. Idle work.** While the search route is mounted, `SearchRoute` runs a 300 ms `setInterval` (stale-query check, query diff) for as long as the sheet stays open. Its cleanup is correct (P1's `rt.setInterval` returns `off`). "Nothing runs at idle": an `input` / `search` event, or a MutationObserver on the field's `value`, would do.
- **m2. The snapshot is blurred everywhere, and the blur arrives as a jump.** `filter: blur(14px)` on the whole picture makes the page you were on unrecognisable outside the sheet (`shots/p2_cmp_c1br2_zero.png`: mockup left, live right). WN §4.2's point is that the page stays. Steam's real page also covers our layer until the route switches: `tl_c1b.out` shows the sharp page held to about 0.3–0.8 s, then replaced in one frame by the blurred, dimmed snapshot. Blur only the part behind the sheet and keep the rest sharp under the .35 scrim.
- **m3. Entry focus.** Down from the field lands on the "All" segment (`b.out` `d_down`), not on the first result (WN §4.8, P-22). Expected while the All summary is missing. The segments at y 118 are also above P-23's 124 line.
- **m4. Provider API.** The interface says a rank call over 2 ms is skipped; the code skips only over 8 ms (`SEARCH_RANK_MS * 4`). `ctx.steamBest` is always `null`.
- **m5. DolphinXR's disc shows the monogram "D"** (`a.out`; no hero, portrait or header found), while the mockup shows its art. Check `data.art()` for the shortcut's custom grid images.
- **m6. Mockup debt.** REQ C1a->C1b (the quiet legend in `window-nav-search.html`) is still open. The results mockup shows a Top Hit, posters, a Software cell and X / ☰ that the build does not have (M9).
- **m7. The VR keyboard stays up after leaving by the dimmed page.** `k1`: `visible /library/tab/AllGames` with the field blurred. Steam does the same when you leave with Back (`k2a`, with the runtime off), but the dimmed-page path is C1b's own. Hide the keyboard there, or say in WN §4.8 that Done is still needed.
- **m8. Sheet placement against R2-6.** The sheet's top is at 100 (R2-6: 108) and it is 500 tall (R2-6: ≤ 488 on `window` routes). Its centre (640, 350) is 22 px off the glass centre, so P-35 (± 24) still passes. Either follow R2-6, or record the search sheet's own geometry (14 px under the field) as a deviation.
- **m9. Disc focus look.** `.lgs-search-game.gpfocus .lgs-search-disc` adds a white halo (`0 0 22px 6px` white .40) and a `0 0 0 0 transparent` ring term. Neither is in PLAN §1.4's Home-disc recipe (lift ×1.10 + shadow).
- **m10. Truncated disc labels.** Cells are 136 px wide with 20 px labels, so "Halo: Comb…", "Rise of the T…" and "Stardew Vall…" are cut. WN §4.5 and the mockup use 160 × 180 cells, where "Stardew Valley" fits.
- **m11. Two B presses to leave from the results grid.** The first B only moves focus to the scope bar (Steam's tabbed page; `b.out` `g_B1`); WN §4.8 says B leaves. Note it in WN, or handle B on the tiles.
- **m12. Bookkeeping.**
  - REQ C1b->C1c #8 is withdrawn but still `- [ ]`.
  - The three REQs to C1b in `C1a.md` (×2) and `C2a.md` (#5) are answered only in C1b.md and are still `- [ ]` where they were filed.
  - REQ Coordinator->C1b (R2-16, FYI) is open.
  - Old m3 (ownership of `21-search.json`) is settled by R2-16.
- **m13. The Recent Searches list can be seeded from Steam's stored query.** The stale-query clear moves Steam's last query, which may have been typed while C1b was off, into Recent Searches (`c1b_r2b_zero.png` showed "half" from an earlier step). That is acceptable, since Steam keeps that query itself, but WN §4.5 says the list is "this session's queries".
- **m14. The results tile label is Steam's "In Library" / "From the store" with no game name.** That is Steam's own design, but together with M9 the All view stays Steam's grid. It is far from the "OS-level search" of the concept and mockup (Top Hit, posters, sections).

### Notes for other owners (not C1b's)

- **n1 (P10).** `native-session` steps do not pop their `--flags` overlays. Four of my steps left `{wp.c1b, wp.p3, wp.c1a}` overlays with a 900 s TTL, which I popped by token at 13:21. Eight `{wp.c1a, wp.p3}` overlays from other agents were still live at 13:21. Separately, `hv --pre` ignores `--flags` and `--mode`: the first session's `hv` pre returned `/library/tab/AllGames` after a field click, and `__LGS_RT.search` was `undefined`. contracts/lab.md §4 says they apply.
- **n2 (P10, or C1b to check).** `pad-bfs --route /search/tab/All` on the zero state (`bfz.out`, 13:1x) visited 2 of 7. From the first disc every take was `untakeable`, while the manual D-pad (`f3.out`, `b.out`) reaches every disc, the capsules and See All, and reverses. Earlier, `L.gpTake` on a disc also failed twice (`s4` pre, session 1's `fz`). If the zero state's `Focusable`s cannot be taken by `BTakeFocus`, Steam's own focus restore may hit the same problem (compare M4).
- **n3 (C1a / P10).**
  - The zero state's quiet legend "Select / Back" measured CONTRAST 1.4 : 1 over the bright room (`g_zero_laser.json`); R2-1's dim band was not there.
  - In the native conformance step, P-43 FAIL is C1a's pointer proxy (1.5 px ring). P-39 FAIL (29 lines) is the AUD contrast model with the CSS glass dropped in native mode; it is not specific to search.
- **n4 (G-PAD universe).** Steam's ‹ › paging arrows are laser-only. `pad-bfs` lists them as unreached with the runtime off as well (`bfs_t1.out`); LB / RB cover the function. G-PAD needs a rule for them.

## Re-run results

Times are the Frame's step times. "native" is the native layer's state as the step reported it: other agents' native sessions run in between. DOM measures are valid either way; CONTRAST, shots and luma pairs only with native off.

| Test | Command (flags as in the header unless noted) | Result | Evidence |
|---|---|---|---|
| Structure, laser activation | `js p1_struct.js --mode laser` (S1); `js a_laser.js --mode laser` (S2, 13:0x, native off) | PASS: a click on the field → `/search/tab/All`; zero state 880 × 500 at (200, 100); glass the same rect; snapshot inert with 0 `[id]` and 0 focusables, 856 nodes, 10–11 ms. Header, Back and `#Footer` lie outside `%{PopupBody>Content}`. Leaving: layer and snapshot gone (the one `[data-lgs-search]` left is C1a's field-variant attribute on `%{BasicUiRoot}`) | `a.out` |
| Scope bar geometry | `a_laser.js` (S2); `p2_tabs.js` (S1) | **FAIL** (M1) | `a.out` |
| Large Title clone | `a_laser.js` | **FAIL** 16 px / 400 at 1180 × 706 (M3) | `a.out` |
| No results | `a_laser.js` with "zzqxjvkw" | "No Results Found" 28 px; **no echo** (M8) | `a.out` |
| C1b-1 results, pad | `gates main --route /search/tab/All --pre pre_half.js --mode pad` (11:00, native off) | SIZE, TYPE, OUTLINE, MOTION pass; **AUD FAIL** (GONE 9, M10); "Hidden 4" skipped as partly visible | `g_res_pad.json` |
| C1b-1 results, laser | same, `--mode laser` (11:01 and 12:15) | Native was **on** in both runs (another agent's session), so CONTRAST is void. SIZE, TYPE, OUTLINE and MOTION pass | `g_res_laser*.json` |
| C1b-1, `wp.c1b` alone, laser | `--flags wp.c1b --mode laser` (11:18) | **OUTLINE FAIL**, P-42 ring on "All 162" (M2) | `g_c1bonly_laser.json` |
| C1b-1, T1 only (no flags) | `--mode pad` (11:16, native off) | SIZE, TYPE, OUTLINE, MOTION pass; AUD as above | `g_t1_pad.json` |
| C1b-1 zero state | `gates main --route /library/tab/AllGames --pre pre_zero.js`, laser (11:06) and pad (11:41) | **TYPE FAIL** in both modes (M3); SIZE, OUTLINE, MOTION pass; **AUD FAIL** (M10) | `g_zero_*.json` |
| No results, laser | `gates --pre pre_none.js --mode laser` (12:08, native off) | **SIZE FAIL** P-08 on the segments (M1); AUD SHRUNK 1 | `g_none_laser.json` |
| Category Library, pad | `gates --pre pre_cat.js --mode pad` (12:04, native off) | SIZE, TYPE, OUTLINE, MOTION pass; **AUD FAIL** (SHRUNK 4, GONE 3) | `g_cat_pad.json` |
| Gamepad paths | `js b_pad.js --mode pad` (S2, 13:0x, native off); `f3`–`f7`, `f9` (S1) | Up ×3 from a poster opens the zero state, DOM focus in the field; Down → first disc (P-22); **capsule "Play · Open · Back" on a disc** (M5); **B → "All Games" tab** (M4); results: Down → "All" segment (m3); Right selects Library (focus = selection); Left back; Down → tile; tile legends only A / B (M9); **B ×2 → AllGames with no focus at all** (M4); X on a disc logs `primary(…)`, A logs `navigate("/library/app/…")`; A on a Recent Searches capsule → results | `b.out`, `f*.out` |
| Laser paths | `f1`, `f2`, `f8` (S1, laser) | Field click → zero state; Recent Searches capsule → results; segment click → `/search/tab/Library`; › → Friends; ‹ → Library; disc click logs `navigate`; See All click → Steam's empty-query page; a library result click → `/library/app/70` (Steam's handler); dimmed-page click → `/library/tab/AllGames` in one step; Back circle → AllGames | `f*.out` |
| H4 clear (laser) | `js c_clear.js --mode laser` (S2) | Not verified. The × (`svg`, 18 × 18 at (924, 43)) has opacity 0 and `pointer-events: none` until the field holds DOM focus, and synthetic clicks do not keep DOM focus (`activeElement` BODY). C1a's AT-3 owns the field | `cl.out`, `cl2.out` |
| Shots (visual verdict) | `shot main c1b_r2b_{res_hover,res_padseg,zero,zero_disc}` (S2, native off) | The zero state reads as a visionOS sheet: thick dark glass, 44 radius, no outline, discs, 60 px capsules, legible over the dimmed page. Against it: the blurred page (m2), the missing title (M3), Dolphin's monogram (m5), truncated labels (m10). Results: the scope bar problems (M1, M2) and Steam's raw grid instead of the mockup's summary (M9, m14) | `shots/c1b_r2b_*.png` |
| G-PAD results | `pad-bfs --route /search/tab/All --pre pre_half.js --mode pad` (11:59, native off) | 32 / 34 reached, none irreversible. Unreached: the two ‹ › arrows, also unreached with the runtime off (n4). Entry is the field. The B effect in this sweep is history from the lab's own navigations | `bfs_res.out`, `bfs_t1.out` |
| G-PAD zero state | `pad-bfs --route /search/tab/All --pre <empty query> --mode pad` (S2) | 2 / 7 (`untakeable`, n2). The manual sweep reaches all 7 | `bfz.out` |
| G-FOCUS zero state | `focus … --pairs pairs_zero.json --mode pad` (11:53, native on: valid inside the sheet) | P-14: capsule +99.8 L and See All +109.3 L, PASS. Disc: lift ×1.10 plus halo (m9) | `fz.out` |
| G-FOCUS results | `focus … --pairs pairs_res.json --mode pad` (11:53) | **P-15 0.0 L FAIL, P-16 +9.0 L FAIL** (M2) | `fr.out` |
| G-MOTION open | `motion main --pre m_in.js --name c1b_r2b_sheet_in --mode laser` (S2, native off) | Tokens only; nothing at rest; P-53 only on P5's shared `sheet-in` scale | `mi.out`, `shots/p2_motion_c1b_r2b_sheet_in_*` |
| G-MOTION first keystroke | `motion --pre m_res.js --name c1b_r2b_results` (S2) | **FAIL**: empty glass, then a second `sheet-in` (M7) | `mr.out`, strip |
| G-MOTION Reduce Motion | same with `--media reduce` (S2) | **P-56 FAIL** on `left` / `width` (M7) | `mrr.out` |
| G-MOTION dismiss | `motion --pre m_out.js --name c1b_r2b_dismiss --mode pad` (S2) | No animation of ours at all (M7) | `mo.out` |
| Dismiss and open timeline | `js t_tl.js --mode pad`, with and without `wp.c1b` (S2, native off) | C1b: sheet fully opaque until 0.8 s (zero) / 1.1 s (results) after B, then cut. T1: Steam's page gone by 0.64 s with a fade. Open: first frame of the sheet 0.45–0.8 s after activation (Steam's navigation dominates) | `tl_c1b.out`, `tl_t1.out` |
| G-PERF (results scroll) | `perf main --route /search/tab/All --pre pre_half.js --ab stock` (S2, 13:16, native off) | **PASS**: fps 89.65 / 89.5 (1.002); extra long frames −0.5 (A/A spread 1); 8 runs pooled | `perf.out` |
| AT-16 snapshot | `p3_perf.js` (S1): 5 activations | Snapshot 11 ms each (no long frame of its own). The open/close long-frame count was not comparable with T1 (the T1 run has no activation route change), so it is not established | `p3on.out`, `p3off.out` |
| C1b-6 memory | `js m1_mem.js` + `frame_ssh grep -r` (S1) | PASS: three queries in memory only. No key in local or session storage of main or SharedJSContext; no file under `/tmp/lgs`, `/dev/shm/lgs`, `~/.local/share/glass-shell` or Steam's Local Storage holds them | `m1.out` |
| C1b-7 removal, flag off live | `js r1_flagoff.js` (S1) | PASS: with the sheet open, `wp.c1b: false` leaves no `.lgs-search-layer`, no snapshot, no zero state, none of C1b's `data-lgs-search*`, no `html.lgs-c1b`, no `__LGS_RT.search`, and the override gone. Steam's page shows the T1 look; the flag back on reinstalls | `r1.out` |
| C1b-7 removal, `lgs off` | `js r2_stock.js --stock` (S1) | PASS: no runtime, `lgs-on` false; Steam's stock search page (sheet 1280 × 680 at (0, 40), uppercase tabs); no `lgs` marks | `r2.out` |
| C1b-8 strings | static review of 21-search.js | PASS: Steam tokens through `R.ui.text`; "Recent Searches" and the hint only for `en*`; no other literal text | — |
| C1b-9 sounds | `s1_sound.js` / `s2_sound_t1.js` (S1, Back circle); `b_pad.js` (S2, B) | Open: `show_modal` once. Leaving by B: `hide_modal` once. **Leaving by the Back circle: twice** (M11). LB / RB play Steam's `tab_transition`; nothing on hover | `s1.out`, `s2.out`, `b.out` |
| Menu over the sheet | `js d1_menu.js` (S1) | A `contextmenu` on a result opens no menu on this build, so the "outside click closes the menu, not search" path could not be exercised | `d1.out` |
| Native (session A, 13:11) | `native-session` with `js n_probe.js`, `sgcheck` zero, `sgcheck` results-tile, `conformance --route /search/tab/All` | Zero: **0 pops** (`search-sheet` covered). Results: 1 pop at 10.0 mm, PASS; CSS glass still painted. P-11, 46, 47, 48, 51 PASS (M6) | `native.out` |
| Native (session B, 13:13) | `native-session` with `hv` zero, results and results `--offaxis 30`, flags pushed in the pre (TTL 14–17 s) | Frames viewed and deleted. The sheet renders; no doubling; off-axis shows the pop. G-HV verdict withheld (window at the frame's edge) | `native2.out` |

## Function retention (WN §9.1: the S rows, H2–H4, L8 (search))

"Live" means exercised in a locked step; "static" means code read only.

| # | Function | Laser path | Gamepad path | Verdict |
|---|---|---|---|---|
| H2 | Start a search | Click the field → zero state (live, `a.out`) | Up from the top row → field → zero state (live, `b.out`) | Kept |
| H3 | Type / edit | Steam's keyboard rises on the click (live, `k1`) | Keyboard via A on the field (C4b's, not pressed) | Kept (Steam's) |
| H4 | Clear | The field's × once the field has DOM focus (Steam's; C1a's AT-3) | Backspace on the keyboard (Steam's) | Not changed by C1b; not verified here |
| S1 | Switch category, with counts | Segment click, ‹ › (live); **"Hidden"'s count not visible and its right part covered by ›** | LB / RB, Up + Left / Right (live) | Kept, count display broken (M1) |
| S2 | Open a result | Steam's tile click → game page (live, `f8`) | D-pad + A on Steam's tiles (handlers untouched) | Kept |
| S3 | View more in the Store | Scroll to it (look only) | D-pad reaches it (live, `f6`) | Kept |
| S4 | Leave search | Back circle, dimmed page (live) | B: one press from the zero state, two from the results grid (m11) | Kept; focus not restored (M4) |
| LA S4 | No results | "No Results Found" | same | Kept; **no echo** (M8) |
| S-T | Other categories from All | Segments with counts | LB / RB | Kept (Steam's All grid; Hidden's count M1) |
| — | Empty query lists everything | See All click (live, `f8`) | See All + A (live, `f7`) | Kept |
| NEW-1 | Reopen a recent game | Disc click logs `navigate` (live, `f8`) | Disc + A logs `navigate` (live, `f9`) | Kept (plus an undocumented X = Play, M5) |
| NEW-2 | Repeat a recent search | Capsule click → results (live, `f1`) | Capsule + A → results (live, `f8`) | Kept |
| S-A, S-B, S-C | Programs, Software cell, X = Play | none | none | **Not built** (M9) |
| L8 (search) | Item menu | no More circle | ☰ does nothing | **No path** (M9) |
| — | Focus returns to the poster | — | B → the "All Games" tab, or no focus | **Fails** (M4) |

## Conformance (VP §6, the items this area touches)

| P | Sev. | Verdict | Evidence |
|---|---|---|---|
| P-01 | must | **FAIL** | C1b's `.gpfocus` rules have no input-mode scope (M8); `conformance` both modes |
| P-02 | must | **FAIL** | stale `.gpfocus` paints under the laser (M2, M8) |
| P-05 | must | PASS | segments, capsules and rows never scale; only the tiles (×1.05) and discs (×1.10) do |
| P-06 | should | **FAIL** | disc `:hover` scale at once (M8) |
| P-08 | must | **FAIL** | segments in no-results (M1) |
| P-13 | must | PASS on the route; **FAIL** after leaving by B ×2 (no focus) | `conformance` pad; `b.out` |
| P-14 | must | PASS | zero-state capsules +99.8 / +109.3 L |
| P-15 / P-16 | must / should | **FAIL** | 0.0 / +9.0 L (M2) |
| P-17 | must | **FAIL** | the 2 px ring on segments (M2); the field's own ring is allowed |
| P-21 | must | **FAIL** | focus not back on the source (M4) |
| P-22 | must | Partial | zero state → first disc; results → the "All" segment (m3) |
| P-24 | must | PASS (Steam's tabbed page takes the first B) | m11 |
| P-35 | must | PASS | sheet centre 22 px from the glass centre (m8) |
| P-36 | should | **FAIL** | scope track insets 148 / 88 (M1) |
| P-38, P-84 | must | **FAIL** in the zero state (M3); PASS in results | gates |
| P-42, P-43 | must | **FAIL** (ring, M2); the rest pass | gates |
| P-45 | must | PASS | 1 glass element, none nested |
| P-46, P-47, P-48, P-51, P-11 | must | PASS (native, results) | `native.out` |
| P-53 / P-54 | must | **FAIL** (first-keystroke re-present; stale-query open) | M7 |
| P-56 | must | **FAIL** | Reduce Motion `left` / `width` (M7) |
| P-58 | must | PASS | tokens only |
| P-62 | must | **FAIL** | no echo (M8) |
| P-63 | must | PASS for the trigger (the keyboard rises on activation, never on arrival); the echo is C4b's | `k1` |
| P-65 | must | Deviation recorded in WN §4.4 (dimmed-page click closes search) | — |
| P-66 | must | PASS | the Back circle at the top left; scrim .35 |
| P-72 | must | PASS | no scrollbar |
| P-86 | must | PASS | scrim .35 |
