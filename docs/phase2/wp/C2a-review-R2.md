# C2a Home, folders, What's New: independent review, round R2

Reviewer: an independent adversarial review agent (session 2 of this review; session 1 ran 10:49-12:28 and was cut off). Date: 2026-10-07. Steam build 11094443.
Scope: package C2a as its log (`docs/phase2/wp/C2a.md`) reports it: "READY: `wp.c2a`" with `wp.p3` and `wp.c1a`, M3 reached, native "written and runs". Nothing in the builder's log or in session 1's notes was taken on trust: every finding below was re-derived from the code and re-measured live in session 2, unless it says "static".

## Status

**Done** (session 2, 13:00-13:57). All planned CSS-only checks, two `native-session` runs (P7 is complete) and the static review are finished.

- Deployed files on the Frame are byte-identical to the tree (md5 `41-home.js` 8e0aae98…, `41-home.css` 5d9990f3…, `41-home.json` 8c8a0faa…, checked 13:01).
- Device left as found: theme on, CSS only (my sessions ended "back to CSS only: yes"), no flag of mine left on (every step used `--flags`; the session flags file holds other agents' `c2bToggle`, `wp.c1a`, `wp.c1b`, `wp.c2b`, `wp.p3`, which were there before this review), menus closed by the lab, pointer parked by the lab. All five `hv --look` frames were viewed and deleted at once on the PC; the lab deleted the Frame copies; no look folder of this review is left.
- Evidence files: `shots/p2_c2a_r2_*.png`, `shots/p2_motion_c2a_r2_*`, `shots/p2_cmp_c2a_home_t1_r2*.png`; raw outputs and scripts in the reviewer's scratch (`…/scratchpad/c2arev/`).

## Verdict

**fix.** Home's skeleton is right and much of it is good: the 4-5-4 honeycomb with real art, the segmented control, the explicit neighbours with one-step memory, LB/RB and D-pad page turns, Steam's own tile menu, X = Play through the action logger, folders and What's New, the footer handling, removal, idle cost and the strings fallback all pass live, and the CSS-only gates pass in the states the builder tested. But the headline state (the open card) is visibly layered over what lies beneath it in both tiers, the attention ramp drops the card after an ordinary quick bounce, row-3 name plates are cut by the window edge in the shipping layout, two folders show broken-image icons, the native fragment fails G-DEPTH (R1 and R2) on routes the package owns, grid moves are silent, and the card build list and the M3 evidence are incomplete. 0 blockers, 14 majors, 16 minors.

## 1. What was run (session 2)

All steps through `python glass.py …` with `--flags wp.c2a,wp.p3,wp.c1a` and `--mode laser|pad` unless stated. "CSS-only" means the step line said `native=off`; a CSS step that overlapped another agent's native session was re-run (the batch runner waited for `native` off).

| Id | Command | Result |
|---|---|---|
| S2-P1 | `js probe1.js --mode pad` | Installs in 0.9 s; `windowless`, route `home`, low layout (C1a's capsule: `data-lgs-search="capsule"`); 13 cells (12 games + All Games); segments 140 / 172 / 140 × 80 contiguous at y 94-174, track (412, 102) 456 × 64; What's New (973, 24) 203 × 60; Back box (14, 14, 80, 80); dots centred on x 640 at y 700; 17 plates; mosaic bands 14-172, 170-302, 350-482, 530-662; footer hidden (no `#Footer`). Cards on cells 1, 4, 5, 6, 10 (rects in M9). Collections: Great On Frame, Ready To Play, Installed, Non-Steam, Soundtracks, VR, Empty Collections. Apps page 1 A-Z from Camera Switch |
| S2-A1 | `js probe2_pad.js --mode pad`, `js probe3_laser.js --mode laser` | Re-entry bug (M2); card close 343 ms (pad) / 334 ms (laser) after the move or leave, never `data-state="closing"` (M10); peek hover: no `.lgs-dwell`, opacity .58 unchanged (m1); P-29 rects in laser mode (M9) |
| S2-V1 | `shot main p2_c2a_r2_{home_laser,card_pad,card_laser,coll_pad,apps_laser,folder_pad,wn_pad,allgames_plate}` (CSS-only) | Viewed composited over `room-lounge.jpg`, `room-studio.jpg` and grey (the Read view ignores alpha, so every judgement was made on composites). Findings M1, M3, M4, m2; the rest of the look matches `p2_home-apps_home-t1.png` (see 1.1) |
| S2-G1 | `gates main --route /library/home --only size,type,outline,motion` with the pre for rest, the card by pad focus, and the card by a real CDP laser hover (`--hover`), both modes | **PASS** all four in rest and card states, both modes |
| S2-G2 | `gates` on `/library/lgs/folder/<VR>` (both modes) and What's New (pre: click What's New; both modes) | **PASS** all four |
| S2-G3 | `gates … --media reduce` (card, pad); `--media contrast` (card, pad, shot `p2_c2a_r2_contrast`) | Reduce: **PASS**. Contrast: SIZE/TYPE/MOTION PASS; OUTLINE FAIL only on the edge profile of the discs' High-Contrast 2 px edge (`lgs-home-disc::before` ratios .66-.99), which is the AT-18 look by design; plates near-opaque (viewed). Gate defect, REQ to P10 |
| S2-W1 | `js t_sweep.js` (`L.gates.size/type/outline/atRest` per state), both modes | Rest, card on row 2, card on row 1, Collections, folder, What's New: all PASS. **Apps with a row-1 program attended: SIZE FAIL in both modes** (M11) |
| S2-F1 | `focus main --pairs pairs.json --keep p2_c2a_r2_focus --mode pad`; `focus … --pairs pairs_laser.json --keep p2_c2a_r2_hover --mode laser`; luma recomputed offline over studio / lounge / dark L18 / bright L225 (601 weights, capsule masks, inset 6) | P-14 Collections segment +63.7 / +63.9 / +73.7 / +47.9 **PASS**; What's New +59.4 / +59.6 / +73.9 / +48.0 **PASS**; P-16 band 8-16 px outside the focused selected Recent +28.9 / +24.8 / +41.5 / **+8.9** (m3); P-03 laser hover +21.2 / +21.2 / +24.3 / +15.9 (segment), +19.9 / +19.8 / +24.5 / +16.0 (What's New) **PASS** (inside +10..+25) |
| S2-D1 | `js probe7_pad.js`, `probe9_pad.js` (D-pad, bumpers, triggers, X, ≡, B through `DispatchVirtualButtonClick`; `PlayAudioURL` spy that records and never plays) | Right ×3, page turn at the row end and back, Down/Up memory, RB → Collections → Apps, RB at the end stays, LB back, RT/LT pages, Up into the top row, along it to What's New, Down back to the remembered cell, Up back to What's New, A on a segment changes section with focus on its first cell: **PASS**. X logs `primary(2377520643)` `mode: logged`. ≡ opens Steam's tile menu (Play, Add to Favorites, Add to, Manage, Developer, Properties..., Cancel), card `is-menu-source`, B closes it. Sounds: section `deck_ui_tab_transition_01`, page `deck_ui_navigation`, menu show/hide; **grid moves: no sound at all** (M8) |
| S2-D2 | `js probe10_stock.js --stock --mode pad` | Stock reference: every D-pad move on Steam's Home shelf requests `deck_ui_misc_10`; on the library, ≡ then B leaves no `.gpfocus` in any window, as ours does (so focus after the tile menu is parity, not a C2a defect); Left from the first item leaves main on stock too |
| S2-B1 | `pad-bfs` on Home, folder, What's New (`--mode pad`), Home `--mode laser`, and stock Home (`--stock`) | **Inconclusive (tool / device state):** stock Home reached 4 of 46 targets (exit, focus back by root, then every node untakeable); ours 1 of 20 (first Down → `exit:none`, LOST), folder 4 nodes, What's New BLOCKED ("no gamepad focus after FocusApplicationRoot"). The manual sequences S2-D1 reach every section, page, top-row control and cell. REQ to P10 |
| S2-R1 | `js probe4_robust.js --mode pad` (render failures injected by wrapping P2's `actions.primaryInfo` / `data.recentGames` for the step, restored in `finally`) | M7 confirmed live; HomeView-level failure falls back to Steam's Home in `window-full` (good); Home recovers after re-navigation |
| S2-R2 | `js probe5_install.js --flags wp.p3,wp.c1a` (AT-22: P2's `ready()` made to throw a *transient* error, so P1 retries and the module is not left failed for other agents) | While failed: `/library/home` = Steam's Home in `window-full` **PASS**; the retry installed the module, Home back to `windowless`. A folder route while failed renders nothing on a `windowless` (glass-less) page (m16) |
| S2-R3 | `js probe6_misc.js --mode pad` | AT-23 (`home.test.lang('de')`): Apps segment becomes the grid glyph, Empty Collections label omitted, Steam tokens kept **PASS**. Leaks over 3 cycles Home → folder → What's New: footer hide count 1 → 1, attention registrations 3 → 3, `live` 1 **PASS**. Idle: no running animation, P1 tick 0.5 Hz (0.5 ms / 4 s), listeners 9 → 9 **PASS**. G-REMOVE for the module (flag off on a folder route with Steam's tile menu open, 8 rows): route `/library/home` with Steam's Home in `window-full`, menu closed, 0 C2a nodes or attributes, footer count 1, registrations 3 → 2 **PASS**; flag back on reinstalls |
| S2-R4 | `js probe8_dom.js --mode pad` | Row-3 plates outside the window (M3); broken minis (M4); over-fade (m2); Apps page 2 = Hide/Show Screens … VLC media player: 23 programs, no Liquid Glass **PASS** (AT-5b) |
| S2-R5 | `js probe11_aud.js` with `--stock` and themed | AT-6 sanity (relative): Steam's Home on stock `/library/home` and on our What's New both show 39 visible focusables with identical paths under Steam's page root, 0 shrunk below 85 % **PASS** (visible part at scroll 0) |
| S2-M1 | `motion main --pre m_ramp.js / m_section.js / m_page.js --name c2a_r2_*`, and the ramp with `--media reduce` | Every duration and easing a token, nothing at rest **PASS**; reduce: opacity only, 180 ms **PASS**. Filmstrips viewed: the ramp grows from the disc and shows glass before content (good); the section and page strips show a blank frame at f = 0 (M10). `m_section` "FAIL" is P-54 on the selection pill's designed 156 px travel (tool false positive, REQ to P10) |
| S2-C1 | `cmp docs/phase2/mockups/home-apps-home-t1.html --id C2a --live` with `searchCircle` and without | Standard layout: 46 of 49 rects 0 px off; `back` / `search` +20 (the map points at the 80 px boxes, m13); `card-play` +65 (Steam's "Stream"/"Install" with the X badge in pad mode). Viewed side by side: same scene. Default (low) layout: rows +24..+40, segments +80 (the documented fallback, HA §3.1.1) |
| S2-N1 | `native-session` 13:21-13:25 (16 steps: reporter snapshots, 8 `sgcheck`, 5 `hv --look`, `conformance --only P-11,P-34,P-46..P-51`) | See 1.2 |
| S2-N2 | `native-session` 13:27-13:30 (`__LGS_LAYERS.debug` for the name plate; `shot` of Steam's texture with acked plates) | See 1.2 |
| S2-L1 | `ledger --out <scratch>` | All 24 rows owned by C2a are `open` (M14) |

### 1.1 Visual verdict against the mockups (CSS-only)

Composited over the mockups' rooms, rest Home reads as the visionOS app-selection view: centred honeycomb, one-line labels with the on-room shadow, a light segmented control with the white pill, a small What's New capsule, page dots, a blurred peek. Sizes match `p2_home-apps_home-t1.png` (S2-C1). Two differences come from C1a and are not C2a's: the default layout puts C1a's 536 × 80 search capsule above the section control (the `searchCircle` fallback), and Home's Back is a bare chevron that is hard to see over a bright curtain. The Collections and Apps views and the folder route look right apart from M3, M4 and m2. The open card is where it stops feeling native (M1).

### 1.2 Native (two sessions; P7 complete)

- **Report:** `windowless`, `shapes: []`, 17-18 plates (C1a's `shell-back` 90 × 90 tex = 60 CSS and `shell-search` 780 × 96 = the visible 520 × 64 capsule: session 1's REQ to C1a is resolved), 4 mosaic bands, `errors: []`. Card: one pop `home-card` 480 × 360 r 54 at 0.0407 u (15 mm at r 1.0), `interactive: false`, over its own occluder plate. Menu open (with `wp.c1c`): one pop, the menu at 10.0 mm, `modal`, card at 0: **AT-10 PASS** for the card and the menu.
- **sgcheck:** card pad PASS; card laser PASS; folder card PASS; menu PASS; **All Games attended FAIL R1** (texture px (1443, 797)); **Apps program attended FAIL R1** ((1275, 527)); **laser "rest" FAIL R1** (the lab's parking point (1400, 900) tex lies on the All Games disc, so a disc was attended: REQ to P10); **What's New FAIL R2** (`tabs`, `tab-arrow`, `tab-arrow.1` at 4.43 mm). See M5, M6.
- **conformance (native step):** P-11, P-13, P-17, P-46, P-47, P-48, P-51 PASS. Its failures on `/library/home` are not C2a's: P-01 / P-89 examples come from other sheets (no `.gpfocus` selector of `41-home.css` lacks a mode scope; its `:hover` rules are resets); P-02's one example is `41-home.css`'s Steam-ring reset (`box-shadow: none`), which is fine; P-43 is C1a's pointer-proxy ring; P-82 is C1a's Back text; P-08 is the absolute-path AUD artifact of the moved Home.
- **hv (5 looks: card, laser lift, 30° off axis, ramp, What's New):** the headset faced away from the dashboard, which sat at the bottom edge of every frame, partly out of view. Disc art, plates, the top row, the card with Play and What's New's window glass were visible; **no grey slab** (the REQ #17 symptom was not reproduced at 13:23). Doubling, plate glass beside the lifted disc and the ramp frame (AT-10c, PLAN-2a-1 native) could not be judged at that size. Frames deleted.
- **Steam's texture with acks** (`p2_c2a_r2_native_card_tex.png`): the acked card is transparent (`rgba(0,0,0,0)`), so its crop carries the lifted own disc, its cloud badge and the tops of the row-3 discs (M1).

## 2. Findings

### Blocker

None.

### Major

**M1. The open card does not occlude what lies under it, in either tier.** (session 1's M4, now also native)
- The card is mounted inside its cell (D-C2a-10) and the cell's disc stays at opacity 1 and ×1.10 under it (S2-P1: disc (350, 350) 132 × 132 under a card whose art ends at y 468, so the disc's lower edge, glow and 40 px cloud badge sit under the text area).
- CSS-only: the text plate is `rgb(0 0 0 / .66)` under a white .14 → .03 gradient with `backdrop-filter: none` (`41-home.css` 550-551, 573), so a third of everything below shows through: the own disc, and the neighbours the card overlaps (a row-2 card covers the row-3 discs by 20 px; a row-1 card in the low layout covers the row-2 discs by 62 px, so "Half-Life 2: VR Mod"'s art shows directly under "12.4 hrs played all time" in `p2_c2a_r2_folder_pad.png`). The lifted disc also pokes 8 px above a row-1 card's top edge.
- Native: the card's plate is acked, so its CSS fill becomes transparent (`05-native.css` 222-226) and the crop at +15 mm carries Steam's texture under the card at full strength: the own disc and slices of the neighbouring discs are lifted to +15 mm and cut at the crop's edge (`p2_c2a_r2_native_card_tex.png`, S2-N2).
- HA §3.4 says the disc *morphs into* the card; `p2_home-apps_home-t1.png` shows nothing under it. This is the package's headline state.
- Fix: hide the attended cell's disc (and its cloud badge) while its card is open (fade it on `morph-open`); give the card the in-page `liquid` blur PLAN §1.6 allows in CSS-only mode and a more opaque text plate; keep the card from covering other discs (or give the covered cells `visibility: hidden` art under it); in native mode the crop must not contain other discs (exclude them from the crop, or keep the card inside its own cell's band).

**M2. The card never comes back after a quick bounce (both inputs).** (new)
- Pad: card open on cell 6, Down then Up within 120 ms: at +0.6 s and +2.2 s `card: null`, `att: null`, focus on cell 6 (S2-A1). A 350 ms bounce keeps the card.
- Laser: card open on cell 6, a 120 ms excursion of the pointer onto disc 7 and back onto the card: the card closes and does not reopen while the pointer rests on the card (S2-A1).
- Cause: P3 keeps the old attention record alive during the 300 ms leave grace and does not refire its steps on re-entry (`05-attention.js` 216-224), while the neighbour's 400 ms step still fires during *its* leave grace (234-239: the laser check is skipped once a leave timer is set; the pad path has no check) and sets `HS.att` to the neighbour; the neighbour's `onLeave` then clears `HS.att` (`41-home.js` 150-165). Nothing ever sets the card's key again.
- AT-8 does not test it; a D-pad correction or ordinary laser jitter at the card's edge is enough.
- Fix (C2a): in `onEnter`, restore `HS.att` from the attention record's reached steps (`HS.attend.active()`), and ignore `onStep` from an element whose leave is pending. A P3 change (no step while a leave is pending) would also fix it; REQ to P3.

**M3. Row-3 name plates are cut off by the window edge in the shipping layout.** (new)
- In the low layout (the default while C1a's `searchCircle` is off) a row-3 plate's top is at y 596 + 74 = 670, so its 60 px capsule ends at y 730 on a 720 px window: All Games (906, 670) 139 × 60, Apps cell 11 (433, 670) 190 × 60 (S2-R4). `p2_c2a_r2_allgames_plate.png` shows the capsule's lower half missing and the page dots hidden under it.
- All Games is cell 13 of every Recent page, so this is seen on every Home visit with a gamepad (and every 13th cell of Collections and Apps).
- HA §3.4 asks for the plate to be "clamped 16 px inside the overlay"; `NamePlate` has no clamp (`41-home.js` 538-547).
- Native: the reporter sees the clipped 50 px plate (`home-plate` 210 × 75 tex) and drops its pop (rule 5).
- Fix: clamp the plate's bottom to y 704 (place it above the label line, or above the disc, for row 3).

**M4. Broken-image icons in the Non-Steam and Soundtracks folders.** (new)
- Home › Collections: Non-Steam 9 of 9 and Soundtracks 9 of 9 mini images fail to load (`…/assets/<id>/library_600x900.jpg`), so both discs show nine Chromium broken-image glyphs (`p2_c2a_r2_coll_pad.png`, S2-R4).
- The minis are plain `<img>` without `onError` (`41-home.js` 423); `homeFolderItem` takes `homeArt(R, ov).portrait` only (245), although HA §3.3 says "header crops for Soundtracks" and shortcuts need their custom art.
- Fix: try the same candidates as `useArt` (custom portrait, cached portrait, header, logo) and drop a failed mini to the empty tile.

**M5. Native: the attended disc pops as a rounded square, and sgcheck R1 fails.** (session 1's M9, now live)
- The `home-disc` rule sets no `"r": "capsule"`; the reporter reads the disc's `border-radius: 50%` with `parseFloat` (`device/lgs_layers.js` 1090) and reports `home-disc` 198 × 198 with r 75 (S2-N1), a squircle over the circular occluder plate (r 99).
- `sgcheck`: FAIL R1 "not covered at texture px (1443, 797)" with All Games attended, and at (1275, 527) with a program attended (S2-N1). Every non-game cell (programs, folders, All Games) keeps its disc popped while attended, and games do so for their first 0.8 s.
- The squircle `liquid` slab stands outside the round disc at the four diagonals: a halo around the lifted disc.
- G-DEPTH (AT-10b) fails on the package's own route. Fix: `"r": "capsule"` on `home-disc`.

**M6. Native: the legacy `tabs` and `tab-arrow` pops on What's New fail sgcheck R2.** (session 1's M8, now live)
- `sgcheck` on `/library/lgs/steamhome`: main 4 pops at 0, 4.5, 15 mm; FAIL R2 `tabs`, `tab-arrow`, `tab-arrow.1` at 4.43 mm, outside PLAN §1.7's {0, 10, 15, 25} (S2-N1). `tabs` lifts C2a's own track (`%{TabHeaderRowWrapper}::after`, `41-home.css` 247).
- `41-home.json` has no `supersedes`; contract reporter §3.5 names C2a among the owners who retire `tabs` and `card`. `tab-arrow` is superseded only while `wp.c2c` is on.
- REQ C2c->C2a REQ-11 (`C2c.md` 55) and REQ P6->C2a (`P6.md` 36, the literal `inset 0 1.5px 1.5px -1px` on the Home tab arrows, `41-home.css` 337, 352) are still open.
- Fix: `"supersedes": [{"id": "tabs", "flag": "wp.c2a"}, {"id": "tab-arrow", "flag": "wp.c2a"}]` (or pop the What's New track and arrows with an earlier rule at an allowed depth), answer both REQs.

**M7. A render failure inside Home replaces the whole page with an error page floating on the room.** (session 1's M7, now confirmed live)
- An exception while rendering the card (injected in `actions.primaryInfo`, S2-R1): the inner `R.ui.ErrorBoundary` of `HomeView` (`41-home.js` 817, no `fallback`) shows P2's "This view could not be shown / Back" page; route `/library/home`, glass still `windowless` (`live` 1, because `useLive()` runs outside that boundary), so the error page has no window glass; focus went to C1a's search field.
- HA §3.7 and P2's override contract promise Steam's own Home (the outer boundary's `fallback: steamChildren`); that path works only for an exception in `HomeView` itself (S2-R1 (b): Steam's Home in `window-full`).
- Fix: drop the inner boundary or give it `fallback: HS.steam` and an `onError` that turns `live` off (`refreshGlass()`), so the route falls back to Steam's Home in `window-full`; better, isolate the card in its own boundary that just closes the card.

**M8. D-pad moves inside the honeycomb are silent (P-74, must).** (new)
- Stock Home requests `deck_ui_misc_10` on every D-pad move (S2-D2), and so does our top row (Steam's own flow navigation). Our grid moves (Right, Down, Up between cells) request no sound at all (S2-D1, twice). Page turns (`deck_ui_navigation`) and section changes (`deck_ui_tab_transition_01`) are right.
- Cause: the explicit neighbours move focus with `BTakeFocus(3)` from `onMove*` and return `true` (`41-home.js` 226, 719-775), which bypasses Steam's navigation sound. HA §3.5's "focus moves … already play Steam's own BasicNav" is not true live.
- Fix: play Steam's navigation sound through P3's `rt.sound` (the same `ENavSound` Steam uses for a focus move) whenever `moveFrom` moves focus itself; AT-21 should count it.

**M9. The card's primary action leaves the comfort zone for edge cells (P-29, must).** (session 1's m5, raised: a must with no recorded deviation, PLAN §4.4)
- P-29: Play within |x − 640| ≤ 400. Live (S2-P1, S2-A1): cell 5 (row 2, x 192) puts Play at x 56-176 (laser, centre 116, 524 off) / 56-206 (pad, centre 131, 509 off); cells 1 and 10 (x 304) put it at 168-288 in laser mode (centre 228, 412 off). 3 of 13 positions per page fail in laser mode, 1 in pad mode.
- Fix: mirror the action row (More left, Play right) on cards left of centre, or clamp the card inward; or record a deviation in HA and PLAN §4.4.

**M10. Nothing on Home has an exit motion, so section and page changes blink.** (session 1's M5, confirmed with filmstrips)
- The card and the name plate unmount on leave (pad 343 ms, laser 334 ms after the move, S2-A1); `data-state="closing"` is never rendered, so `morph-close` 441 ms and `materialize-out` 350 ms (HA §3.4, §11; `41-home.css` 1103, 1136-1142, 1384) never run.
- Section and page changes replace the grid at once (it is keyed by section and page, `41-home.js` 824): `p2_motion_c2a_r2_section_strip.png` and `…_page_strip.png` show an empty page at f = 0 before the new grid fades in. `.is-leaving` (the 150 ms `page-out`) is never set.
- The route-entry stagger reads `--lgs-home-ring`, which nothing sets (all discs start together); the card's morph uses `--lgs-ease-b0` (`41-home.css` 1131) where HA §3.4 and the `morph-open` token say b .20.
- G-MOTION's "content before glass on exit" cannot hold; Liquid Glass motion is one of the quality bar's points.

**M11. G-SIZE fails in a route-matrix state ("focus on a cell", Apps).** (session 1's M6, reconfirmed)
- Low layout: the segments' hit band ends at y 174, row 1 starts at 176; an attended row-1 disc lifts ×1.10 to y 170 and takes the bottom of the band: "Apps" segment "P-08 hit 99 % own, 1 % other (`lgs-home-cell … CMake`)" in both modes (S2-W1). Same under "Collections" for cells at x 528 and 752.
- Fix: 6 more px between the segments' hits and row 1 in the low layout, or lift the disc from its bottom edge.

**M12. Two card builds are missing: the search provider and the Windows section.** (session 1's M1, reconfirmed statically)
- `device/rt/41-search-apps.js` does not exist (card T3: "the search provider (S-A, S-B, S-C)"; HA AT-5(c), AT-13). The log's reason ("C1b is at M0") is stale: C1b is READY with `search.addProvider` live (`21-search.js` 223, 487). C1b's own summary row (Q6) is not built either, so nothing would render the provider's cells yet; `rank()` and the "no Liquid Glass" check (AT-5(c)) are testable today through `providers()`.
- `HOME_SECTIONS = ['recent', 'collections', 'apps']` (`41-home.js` 43): no Windows section (card: "sections Recent, Collections, Apps, Windows"; HA §3.2; AT-4 `desktopWindow`; retention LA-P4's Home path). Nothing calls `actions.desktopWindow`.
- Nothing is lost against stock (Steam's "+" keeps both), but the card's scope and two acceptance tests are not met.

**M13. Home's download and update states are not built.** (session 1's M2, reconfirmed statically)
- `41-home.css` styles `.is-downloading`, `.lgs-home-ring-progress` and `.lgs-home-update`; `41-home.js` never sets or renders them. A downloading game or one with an update looks like any installed game on Home and on its card (HA §3.3; retention LA-T8 on Home). Steam's stock Home shelf shows that status; on our Home it survives only on the What's New route.

**M14. The READY / M3 claim rests on tests that were not run or not recorded.** (session 1's M3, reconfirmed)
- No evidence row for HA AT-2 (live), AT-9, AT-10b, AT-10c, AT-11, AT-16, AT-17, AT-18, AT-19, AT-20 (live), AT-21, AT-22, AT-23 or PLAN-2a-1 (live `cmp`); PLAN §2.1 M3 needs "the package's own tests pass in both input modes".
- `glass.py ledger` resolves test ids against evidence rows whose first cell starts with the id; C2a's rows are named M3-N1, M3-M1 …, so all 24 C2a functions are `open` (S2-L1).
- This review ran most of them (table above); C2a should record them under their AT ids after the fixes.

### Minor

- **m1. Peeks have no laser hover look and no press look.** P3's dwell selector is `.Panel, button, [role="button"], [role="tab"], a[href], [data-lgs-dwell]` (`05-attention.js` 20); the peek is a bare `div` (`41-home.js` 805), so `.lgs-home-peek:is(.lgs-dwell:hover, .lgs-attend-80)` never matches (live: no dwell, opacity .58). They are the laser's only page-turn targets. Fix: `data-lgs-dwell` (or `role="button"` + `aria-label`).
- **m2. Name plates fade labels they do not cover** (D-C2a-5 says a label fades only when its text is covered). The plate rule fades every label in the same row within 260 px (`41-home.js` 710-713): the Apps plate (718, 490) 292 wide fades "Firewall" (text 604-676); the VR plate fades "Soundtracks" and "Empty Collections"; All Games fades "Rez Infinite" (S2-R4, shots). Use the plate's real rect, as the card's rule does.
- **m3. P-16 glow band over a bright room: +8.9 L** (studio +28.9, lounge +24.8, dark +41.5; S2-F1). P-16 is a "should"; record it.
- **m4. The card's +15 mm has 2.4 % click-safe margin** (static): its smallest focusables are the 80 px Play and More hits, cap 0.0417 u against 0.0407 u at r 1.0; any window scale below r 0.975 caps the card to +10 mm while the lifted disc stays at +15 (two depths for one item; AT-10 fails). Live r was 1.0.
- **m5. HA-17 not built:** in gamepad mode the old card stays for the 300 ms leave grace after a move (343 ms measured) instead of closing at once.
- **m6. The name plate never pops in native mode:** `debug()` says `{"rule":"home-plate","skip":"covered"}` (S2-N2): the plate is `pointer-events: none`, so the reporter's hit test sees the cell under it. Add `"hitTest": false` to `home-plate` (HA §10.4 wants +15).
- **m7. Program discs lose their stable plate ids** (`p4`, `p5`, `p7` in `debug()`): `'home-disc-' + item.key` contains characters outside `[A-Za-z0-9-_.:]` for most programs (the key comes from the command line), so the reporter falls back to positional ids and glassd's materialize and acks follow positions, not discs. Sanitize the key (hash it).
- **m8. Native card ramp changes depth:** `home-card` has no `from`, so the card rises from 0 while the disc's pop sinks from +15 when the card opens (HA §10.2 says the depth never changes during the ramp). `"from": "cut"` or `fromMm: 15` on `home-card` (static).
- **m9. Glyph badges are text letters** ("X", "≡"; P-27, a should). Recorded as D-C2a-12.
- **m10. Mosaic bands do not follow a flat card or name plate (native, static).** Bands are fixed per row; a card that stays flat (its menu open, rule 6) loses what lies outside the bands (in the low layout a row-2 card spans y 316-556, outside the bands at 328-350 and 482-530). Give the card and the plate `data-lgs-mosaic`.
- **m11. Unbuilt or dead parts:** the two-line name plate (`.two`, `.lgs-home-plate-sub`: "27 games", "N collections with no games"), Recent's session MRU of launched programs (HA §3.2), `data-lgs-plate-inset: -4` while popped (HA §10.2), `.is-attended`, `.is-leaving`, `[data-state="closing"]`, part B of `41-home.css` (C1a adopted the hook).
- **m12. Peeks of an Apps page show a bare icon without a disc** (the VLC cone floats at x 1782 in `p2_c2a_r2_apps_laser.png`), unlike the disc peeks of the other sections.
- **m13. PLAN-2a-1 bookkeeping:** `C2a-cmp.json` maps `back` and `search` to C1a's 80 px boxes (+20 px against the mockup's 60 px circles); no mockup shows the shipping low layout (search capsule above the segments), so `cmp` in the default state fails by design; no PLAN-2a-1 run is recorded in the log.
- **m14. Stale log text:** C2a's Status says `41-search-apps.js` waits for "C1b at M0" and lists REQ #16 as open (P10 answered it). REQ #17 (native grey slab) was not reproduced at 13:23 (discs with art in the headset view); P8 should confirm and close it.
- **m15. What's New entered before Home has rendered in this install is blank** (session 1's m2, static): `SteamHomeRoute` renders `HS.steam`, which only the Home override sets (`41-home.js` 141, 842). S2-R1 (c) entered it after Home had rendered and it worked. Render `steamChildren` captured at install, or redirect to `/library/home` first.
- **m16. A folder route while the module is failed or off is a glass-less empty page:** C1a's route map makes `/library/lgs/folder/*` `windowless` unconditionally, so a history entry into a folder after a failed install shows nothing on the room (S2-R2, `#Footer` present). Ask C1a to make folder routes `windowless` only while the `home` hook answers, or have P2 drop dead `/library/lgs/` entries.

## 3. Function retention (HA §12, rows owned by C2a)

| Row | Laser path | Gamepad path | Verified in session 2 |
|---|---|---|---|
| H1 recent games, running first | dwell → card | D-pad, focus → card | Both work (S2-P1, S2-V1); card drops after a quick bounce (M2) |
| H2 open a game page | click disc / card body | A | Static (cell `onActivate` → `actions.navigate`); session 1 logged both |
| H3 tile menu | card More | ≡ | ≡ → Steam's 7-row menu, B closes (S2-D1); More: session 1 |
| H4 library | All Games cell | D-pad + A | Cell 13 on every Recent page (S2-P1) |
| H5 feeds | What's New capsule | Up, Right to What's New, A | D-pad reaches What's New (S2-D1); route works; What's New gates PASS (S2-G2) |
| H6-H8 What's New, Friends, Recommended cards | click | focus + A | Steam's page: 39 = 39 controls (S2-R5); gamepad traversal inside it not verifiable (pad-bfs BLOCKED, S2-B1) |
| H9, T8, R3, R4 status | card art, dots | same | Not installed shows; downloading / update missing (M13); running dot untested (no running game) |
| T1, R1 primary action | card Play | X | X → `primary` logged (S2-D1) |
| C1-C3, N1, N3 collections and folders | click | D-pad + A, B back | Folders work (S2-V1, S2-G2); Non-Steam and Soundtracks discs show broken images (M4) |
| S2 search result (programs) | — | — | No provider (M12) |
| P2 launch a program | Apps cell click | A | Static (`launchNonSteam`); session 1 logged it; search path missing (M12) |
| P4 desktop window | — | — | No Home path (M12); Steam's "+" keeps it |
| SN-N2 tab bar from the left edge | — | Left at page 1 | Focus leaves main exactly as on stock (S2-D1, S2-D2) |
| SN-N3 B at the root | — | B | History back (`/library/home` → `/library/tab/AllGames`), as stock (S2-D1) |

Every row that exists has both paths; the gaps are the missing builds of M12 and M13, not a lost Steam function.

## 4. Conformance (P-items for this area)

| Item | Result |
|---|---|
| P-01, P-02, P-89 | `41-home.css` clean: every `.gpfocus` selector is mode-scoped; laser looks key on `:hover` / `.lgs-dwell` / `lgs-attend-*`; no hover-only reveal (AT-8(d)). The route-level FAILs come from other sheets |
| P-03 | PASS (+16 to +24.5 L, S2-F1) |
| P-06 | PASS (session 1: no scale before `.lgs-dwell`) |
| P-08, P-80, P-83 | PASS except M11 |
| P-12 | More circle tooltip `above` with Steam's string; no tooltips on text controls (static) |
| P-13, P-17, P-22 | PASS (one lit cell; no ring; entry focus on cell 1) |
| P-14 | PASS; P-16 should: bright room +8.9 (m3) |
| P-19, P-59 | PASS (×1.10 lift, card ramp, page dots, LB/RB, edge paging) |
| P-21 | ≡ then B leaves no `.gpfocus` on our Home and on the stock library alike (S2-D2): parity, not C2a's |
| P-26 / P-27 | badges only in gamepad mode / text letters (m9) |
| P-29 | **FAIL** (M9) |
| P-33 | PASS (18-28 targets) |
| P-38, P-39, P-41 | PASS (labels 20 px Medium with the on-room shadow; card status 18 px) |
| P-42, P-43, P-45 | PASS in CSS-only (gates); High Contrast's 2 px edge flagged by the edge profile (gate defect) |
| P-46, P-47, P-48, P-51, P-11 | PASS in native (S2-N1); G-DEPTH fails R1/R2 (M5, M6) |
| P-52, P-56, P-58 | PASS (gates, motion, reduce) |
| P-53, P-54 | PASS (pill travel flagged by the tool's P-54 heuristic: false positive) |
| P-61 | PASS (Home lattice; empty collections dimmed and last) |
| P-71 | Launch is logged; Home's layers have no dematerialize (M10) |
| P-74 | **FAIL** (M8) |
| P-79 | RB at the last section plays no bumper-end sound (should; minor, not listed above) |

## 5. Requests

- [ ] REQ C2a-R2->C2a: fix M1-M14 and m1-m16 above, then record the HA tests under their AT ids so `glass.py ledger` resolves them (M14); answer REQ C2c->C2a REQ-11 and REQ P6->C2a (M6).
- [ ] REQ C2a-R2->P3: attention steps fire for an element whose leave is pending (`05-attention.js` 234-239), and a re-entered element never refires its steps (216-224); together they lose Home's card after a quick bounce (M2). Please skip `reach()` while `A.leaveTimer` is set, in every input mode, and consider reporting re-entry (`onEnter` with the reached steps) so consumers can restore their state.
- [ ] REQ C2a-R2->P10: (1) `pad-bfs` cannot recover after an `exit:` edge on the current device state: stock `/library/home` (`--stock`) reached 4 of 46 targets (back by root, then every node untakeable), What's New gives "no gamepad focus after FocusApplicationRoot", C2a's Home LOST focus on the first Down (13:32-13:35); G-PAD is unmeasurable for Home until it recovers. (2) The lab parks the pointer at (1400, 900) main texture px = (933, 600) CSS, which lies on Home's All Games disc (low layout), so every later laser step on Home starts with a disc attended (S2-N1 laser "rest" FAIL R1); park it on a point no route uses (e.g. outside the window glass). (3) `focus` reads transparent texels as black on windowless routes (P-16 band 228 vs 8.9 L); composite over a declared room, or warn. (4) `motion`'s P-54 flags a selection pill's designed travel (156 px). (5) `gates` OUTLINE's edge profile fails High Contrast's 2 px edge, which P-42 exempts.
- [ ] REQ C2a-R2->C1a: Home's root Back is a bare white chevron with no backing, nearly invisible over a bright curtain (`ztop` composite of `p2_c2a_r2_home_laser.png`); the mockups draw a 60 px glass circle. Please give it the circle (or the on-room shadow) on `windowless` routes. Also m16 (folder routes `windowless` only while the `home` hook answers).
- [ ] REQ C2a-R2->P8: REQ C2a->P8 #17 (native grey slab on windowless Home) was not reproduced in session 2's native runs (13:21-13:30: discs with art, plates acked, card popped); please confirm the fix and close it in `C2a.md`.
