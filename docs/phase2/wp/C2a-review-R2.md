# C2a Home, folders, What's New: independent review, round R2

Reviewer: an independent adversarial review agent. Date: 2026-10-07 (Frame clock 10:49 onward). Steam build 11094443.
Scope: package C2a as its log (`docs/phase2/wp/C2a.md`) reports it, "READY: `wp.c2a`" with `wp.p3` and `wp.c1a`, M3 reached. Everything was re-derived from the code and the live device; nothing in the builder's log was taken on trust.

## Status

**In progress** (session from 10:49; last update 12:05). Static review done; most live checks done (below). Still queued on the shared device (43 lab steps waiting at 11:58): T1 Home gates with AUD, the strings and fail-closed bundle, three shots, pad-bfs ×3, motion ×3, `--media contrast` gates, live `cmp`. Native checks deferred: `docs/phase2/wp/P7.md` Status says "Review R1 fixes in progress" (rule 4).

Deployed files on the Frame are byte-identical to the tree (md5 `41-home.js` 8e0aae98…, `41-home.css` 5d9990f3…, `41-home.json` 8c8a0faa…).

## Verdict (provisional)

**fix.** Home works and feels right in most of what was built: the honeycomb, the attention ramp, the explicit neighbours, the folder and What's New routes, Steam's own tile menu, the footer handling and removal all pass live. The package is not at the M3 it claims, though, and the headline card has two visible defects in the shipping (CSS-only) tier.

## 1. What was re-run

All steps through `python glass.py …` with `--flags wp.c2a,wp.p3,wp.c1a` (unless stated) and `--mode laser|pad`; scripts in the reviewer's scratch. "CSS-only" means the step line said `native=off`; steps marked "native on" overlapped another agent's native session and are used only for things the native layer cannot change (navigation, wiring, removal).

| Id | Command | Result |
|---|---|---|
| R2-S1 | `shot main p2_c2arev_home_laser --route /library/home --mode laser` (CSS-only) | Viewed against `p2_home-apps_home-t1.png`. Low layout (C1a shows the search capsule, `lgs-hdr-40`): track y 102–166, rows 236 / 416 / 596, 13 cells with hero + logo art, 2 dots, one peek. Matches HA §3.1.1 |
| R2-S2 | `shot main p2_c2arev_home_card_pad --mode pad`, pre `L.gpTake` cell 6, 1.7 s (CSS-only) | Card at (256, 316) 320 × 240, "Install" (blue) with the X badge, More with ≡, title, "Not installed". Viewed at 3× over grey: **the card's own disc and its cloud badge show through the card body below the art** (finding M4) |
| R2-G1 | `js t_geom.js --mode laser` (native on) | Segments contiguous 140 / 172 / 140 × 80 (y 94–174), track y 102–166, cells 200 × 180 from y 176, discs 120, What's New (973, 24) 203 × 60, dots y 700; `elementFromPoint(640,134)` = segment label; 17 plates (13 discs `r=capsule`, track, What's New, `shell-back`, `shell-search`); 4 mosaic bands 14–172, 170–302, 350–482, 530–662; label 20 px / 500 with the room shadow; 28 focusables (P-33 ≤ 30) |
| R2-P1 | `js t_pad.js --mode pad` (CSS-only) | **PASS:** entry on cell 1 (P-22); Right ×3, Right past the row end → page 2, Left back; Down/Up one-step memory; bottom row stays; Up → selected segment; along the top row to What's New; Down → remembered cell, Up → back to What's New; RB → Collections → Apps, RB at the end stays, LB back with the remembered cell; RT/LT pages. X → `primary(3699252713)` logged; A → `navigate(/library/app/3699252713)` logged, route unchanged; ≡ → Steam's tile menu (Play, Add to Favorites, Add to, Manage, Developer, Properties..., Cancel), card `is-menu-source`, More white; B closes it and focus is back on the cell (P-21). Folder: A on VR → `/library/lgs/folder/uc-…`, title "VR", 13 cells, 3 dots, windowless, no `#Footer`, entry on cell 1; Up → Show in Library; B → Home › Collections with focus on the VR cell |
| R2-L1 | `js t_laser.js --mode laser` (native on), `PlayAudioURL` spy (records, never plays) | **PASS:** 40 ms into a hover `scale: 1`, no dwell (AT-8g); no card at 0.5 s, card at 1.5 s (AT-8a); Play hit 171 × 80, More 80 × 80, centres 166 apart, no overlap; badges hidden in laser mode (P-26); Play → `primary(391220)` logged, route unchanged (AT-8f); card body → `navigate` logged; More → Steam's tile menu, B closes it; 45 ms sweep: no dwell, no card (AT-8b); peek click turns the page; Apps A–Z from "Camera Switch", no Liquid Glass (AT-5b); name plate after 0.4 s; program click → `launchNonSteam` logged; All Games → `navigate(/library/tab/AllGames)` logged; nothing running at rest. Sounds: section change `deck_ui_tab_transition_01` (ChangeTabs 20), page turn `deck_ui_navigation` (PagedNavigation 15), none during hover or the sweep (AT-21, laser part). **But:** card gone 332 ms after the pointer leaves (no `morph-close`, M5); peek hover sets no dwell and changes nothing (m1); the card's own disc stays at opacity 1 under a card whose fill is `rgb(0 0 0 / .66)` (M4) |
| R2-W1 | `js t_sweep.js` (`L.gates.size/type/outline/atRest` per state), laser (CSS-only) and pad (native on) | Rest, card on row 2, card on row 1, Collections, folder, What's New: SIZE, TYPE, OUTLINE, at rest **PASS** in both modes. **Apps with a row-1 program attended: SIZE FAIL** in both modes, "Apps" segment "P-08 hit 99 % own, 1 % other (`lgs-home-cell … CMake`)" (M6) |
| R2-W2 | `gates main --route /library/home --mode laser --json` (CSS-only, full gate with capture) | SIZE (18), TYPE (17), OUTLINE (with edge probes), MOTION at rest **PASS**. AUD lists every Steam Home node GONE: expected, the override moves them (AT-6 needs the relative audit) |
| R2-F1 | `focus main --route /library/home --pairs … --mode pad --keep p2_c2arev_focus` (CSS-only), then the kept frames composited over the mockups' `room-studio`, `room-lounge`, a dark (L 18) and a bright (L 225) backdrop and measured offline (601 luma) | P-14 Collections segment focus vs rest: +63.4 / +63.9 / +73.3 / +47.7 **PASS**; What's New: +60.6 / +59.4 / +73.7 / +47.9 **PASS**. P-16 band 8–16 px outside the focused selected (white) Recent segment: +21.7 / **+18.0** / +31.2 / **+6.1** (m3). The live `focus` numbers themselves are meaningless on a windowless route: the tool reads RGB of transparent pixels (La 254.7 everywhere) |
| R2-R1 | `js t_remove.js --flags wp.p3,wp.c1a --mode pad`, pushing and popping `wp.c2a` itself (native on) | **PASS (G-REMOVE for the module):** after removal on Home with Steam's tile menu open, on a folder route and on What's New: no `.lgs-home*` node, no C2a class or `data-lgs-*` attribute, `routes.list()` empty, `__LGS_RT.home` gone, the menu closed, route `/library/home` with Steam's Home (`%{RecentSection}`), glass `window-full`, Steam's footer hide count back to 1 (Steam's own Home), attention registrations 2 → 2. A stale `/library/lgs/folder/xyz` entry falls back to Steam's library. **But:** What's New entered before Home has rendered in an install is a blank page with only Back (m2) |
| R2-L2 | `ledger --out <scratch>` | All 24 rows owned by C2a are `open`: the log's evidence rows are named M3-xx, never AT-xx (M3) |
| R2-H1 | `/dev/shm/lgs/shell.json` (read only) | Live geometry `S 0.369, r 1.0` |

## 2. Findings

### Blocker

None confirmed (the injected render-failure test is still queued; see M7 when it lands).

### Major

**M1. Two card builds are missing: the search provider and the Windows section.**
- `device/rt/41-search-apps.js` does not exist. The card's T3 list has "the search provider (S-A, S-B, S-C)"; HA AT-13 and AT-5(c) depend on it. The log says it was not written because "C1b is at M0", but C1b is READY with `__LGS_RT.search.addProvider` live (`docs/phase2/wp/C1b.md` Status; `device/rt/21-search.js` 223, 487). Retention rows LA-S2 and LA-P2 lose their search path.
- `HOME_SECTIONS = ['recent', 'collections', 'apps']` (`41-home.js` 43): there is no Windows section (card: "sections Recent, Collections, Apps, Windows"; HA §3.2; AT-4 "a window (`desktopWindow`)"; retention LA-P4's Home path). Nothing renders desktop windows; nothing calls `actions.desktopWindow`.
- Steam keeps both functions (the "+" popup launches programs and adds windows), so nothing is lost, but the card's scope and two acceptance tests are not met.

**M2. Home's icon states are only half built (HA §3.3, retention LA-T8 on Home).** `41-home.css` styles `.is-downloading`, `.lgs-home-ring-progress` and `.lgs-home-update`, but `41-home.js` never sets or renders them. A downloading game and a game with an update look like any other installed game on Home and on its card. Stock Home's shelf shows that status; it survives only on the What's New route. (The Frame compatibility word was left out on purpose, D-C2a-11.)

**M3. The READY / M3 claim rests on tests that were not run or not recorded.**
- No evidence row exists for HA AT-2 (live), AT-9, AT-10b, AT-10c, AT-11, AT-16, AT-17, AT-18, AT-19, AT-20 (live), AT-21, AT-22, AT-23 or PLAN-2a-1 (live `cmp`). PLAN §2.1 M3 needs "the package's own tests pass in both input modes".
- `glass.py ledger` resolves test ids against evidence rows whose first cell starts with the id; C2a's rows are named M3-N1, M3-M1 and so on, so all 24 C2a functions are `open` (PLAN §4.5).
- This review ran several of them (R2-P1, R2-L1, R2-R1, R2-F1); they belong in C2a's log under their AT ids.

**M4. CSS-only card: its own disc shows through it.** The card is mounted inside the attended cell and the cell's disc stays (`opacity: 1`, R2-L1). The card's text plate is `linear-gradient(white .14 → .03), rgb(0 0 0 / .66)` (`41-home.css` 550), so about a third of what is underneath shows. In R2-S2 (zoomed over grey), the SteamVR disc's lower edge and its 40 px cloud badge are visible through the card body under the art, and the row-3 discs through its bottom edge. HA §3.4 says the disc morphs into the card; `p2_home-apps_home-t1.png` shows no disc under it. This is a doubled element in the headline state of the tier that ships. Fix: hide the attended cell's disc while its card is open (it can fade on `morph-open`); consider a more opaque text plate in CSS-only mode.

**M5. Nothing on Home has an exit motion.**
- The card and the name plate are unmounted the moment attention leaves: R2-L1 measured the card gone 332 ms after the pointer left, which is the 300 ms grace plus one render. HA §3.4 and §11 ask for `morph-close` 441 ms and `materialize-out` 350 ms. The `[data-state="closing"]` rules (`41-home.css` 1103, 1136–1142, 1384) are never used: `41-home.js` only ever renders `data-state="open"`.
- Section and page changes replace the grid at once: `.is-leaving` (the 150 ms fade-out, `41-home.css` 753) is never set. The route-entry stagger reads `--lgs-home-ring`, which `41-home.js` never sets (all discs start together).
- G-MOTION's filmstrip criterion "content before glass on exit" cannot hold when nothing animates out. Liquid Glass motion is one of the quality bar's five points.

**M6. G-SIZE fails in a route-matrix state ("focus on a cell", Apps).** In the low layout (the default until C1a's `searchCircle`), the segments' hit band ends at y 174 and the row-1 cells start at y 176. An attended row-1 disc lifts ×1.10 (`--lgs-disc-lift`), so its top moves to y 170 and covers the bottom 4 px of the segments' 80 px hit band: "Apps" segment "P-08 hit 99 % own, 1 % other" in both input modes (R2-W1). The same happens under the "Collections" segment for the cells at x 528 and 752. Fix: 6 more px between the segments' hits and row 1 in the low layout, or lift from the disc's bottom edge.

**M7. (pending: the injected render-failure test, R2-M1.)** Statically, a render-time exception inside our Home does not fall back to Steam's Home. `HomeView` wraps its page in its own `R.ui.ErrorBoundary` with no `fallback` (`41-home.js` 817), so P2 shows its error page (a Back capsule) instead of `steamChildren`. HA §3.7 and P2's override contract promise Steam's own page. `useLive()` runs in `HomeView` outside that boundary, so `glassMode('home')` keeps answering `windowless` over the error page.

**M8. Native fragment: the legacy `tabs` pop on What's New is not retired, and C2a's open REQs are unanswered.**
- `theme/layers/41-home.json` has no `supersedes`, and no C2a rule pops Steam's feed tab row first. On `/library/lgs/steamhome` the legacy `tabs` rule (`99-legacy.json`, `%{TabHeaderRowWrapper}`, dz 0.012 = 4.4 mm) still pops the row, including C2a's own track, which is drawn on `%{TabHeaderRowWrapper}::after` (`41-home.css` 247). 4.4 mm is outside PLAN §1.7's set {0, 10, 15, 25}, so sgcheck R2 fails on a route-matrix route. Contract §3.5 names C2a among the owners who retire `tabs` and `card`.
- REQ C2c->C2a REQ-11 (`docs/phase2/wp/C2c.md` 53) reports exactly this and is open. REQ P6->C2a (`docs/phase2/wp/P6.md` 34: the literal `inset 0 1.5px 1.5px -1px` highlight on the Home tab arrows, `41-home.css` 337, 352) is open too.

**M9. Native fragment: the attended disc pops as a rounded square.** The `home-disc` rule sets no `"r": "capsule"`. The reporter reads the disc's computed `border-radius: 50%` with `parseFloat`, so 50 CSS px (`device/lgs_layers.js` 1090), and sends `r = min(50 × 1.5, w/2, h/2) = 75` texture px for a 198 px crop (1127). The `liquid` slab under the lifted disc is therefore a rounded square whose corners stand about 10 texture px outside the circle on each diagonal, a squircle halo around the round disc. The builder fixed the same parse for the plates (`data-lgs-plate-r="capsule"`) but not for the layer. With P10's new R1 (REQ #16: R1 samples inside the pop's own rounded rect), sgcheck will also fail R1 at those corners. Static only; native checks deferred (rule 4).

### Minor

- **m1. Peeks have no laser hover look.** P3's dwell selector is `.Panel, button, [role="button"], [role="tab"], a[href], [data-lgs-dwell]`; the peek is none of these, so `.lgs-home-peek:is(.lgs-dwell:hover, .lgs-attend-80)` (`41-home.css` 1058) never matches, and the peek sets no `--lgs-ill`. Live: hover 300 ms, `dwell: false`, opacity .58 unchanged (R2-L1). They are the laser's only page-turn targets. Fix: `data-lgs-dwell` or `role="button"` plus an `aria-label`.
- **m2. What's New entered before Home has rendered is blank.** `SteamHomeRoute` renders `HS.steam`, which only the Home override sets (`41-home.js` 141, 842). R2-R1 navigated to `/library/lgs/steamhome` right after the module installed: no content, only Back. Users reach the route only from Home, so this hits mainly tests (`gates --route /library/lgs/steamhome`) and future deep links. Fix: render `steamChildren` captured at install, or redirect to `/library/home` first.
- **m3. P-16 glow band below +20 L over the lounge (+18.0) and a bright room (+6.1)** (R2-F1; AT-20 lists it). P-16 is a "should"; over a bright room no white glow can reach +20.
- **m4. The card's +15 mm has 2.4 % click-safe margin.** Its smallest focusables are the 80 px Play and More hits: cap `0.000521 × 80 = 0.0417` u against 15 mm = `0.0407 / r` u. Any window scale below r 0.975 caps the card to +10 mm (HA §0.4 quotes r 0.863), so the card and the lifted disc would sit at different depths and AT-10 fails. Live r is 1.0 today (R2-H1).
- **m5. P-29:** a row-2 edge card puts Play at about x 120 (|x − 640| = 520 > 400). Record it as a deviation (the card follows its cell) or clamp cards further in.
- **m6. Glyph badges are text letters** ("X", "≡"; P-27, a "should"). Recorded as D-C2a-12.
- **m7. Mosaic bands do not follow a flat card or name plate (native).** Bands are fixed per row; base pieces exist only inside them (`contracts/sg.md` §2, `mosaic`). A card that does not pop (its tile menu is open, rule 6) loses whatever lies outside the bands. Example: in the low layout a row-2 card spans y 316–556, so its art top (328–350), title (478–508) and status (510–532) fall outside the bands [350, 482] and [530, 662] and show only plate glass. Fix: give the card and the name plate `data-lgs-mosaic` too. Static only.
- **m8. Dead code.** `.is-attended`, `.is-leaving`, `[data-state="closing"]`, `.lgs-home-update`, `.lgs-home-ring-progress`, `.lgs-home-plate.two` and `.lgs-home-plate-sub` (the two-line plate of HA §3.4 is not built: "27 games" / "N collections with no games"), and part B (C1a adopted the `glassMode` hook, so `window-full` is already the fallback).
- **m9. Stale log text.** C2a's Status says `41-search-apps.js` waits for "C1b at M0", and lists REQ #16 as open (P10 answered it).

## 3. Function retention (HA §12, C2a rows)

| Row | Laser path | Gamepad path | Verified here |
|---|---|---|---|
| H1 recent games, running first | look, dwell → card | D-pad, focus → card | R2-S1, R2-L1, R2-P1 |
| H2 open a game page | click disc / card body | A | `navigate` logged both ways |
| H3 tile menu | card More | ≡ | Steam's menu both ways, closed with B |
| H4 library | All Games cell | D-pad + A | `navigate(/library/tab/AllGames)` logged (laser); pad by D-pad to cell 13 |
| H5–H8 feeds | What's New capsule | Up, Right to What's New, A | route works (R2-W1 swept it); pending pad-bfs |
| H9, T8, R3, R4 status | card art, dots | same | partial: no downloading or update state (M2) |
| C1, C2, C3, N1, N3 collections and folders | click | D-pad + A, B back | R2-P1 |
| P2 launch a program | Apps cell click | A | `launchNonSteam` logged; search path missing (M1) |
| P4 desktop window | — | — | no Home path (M1); Steam's "+" keeps it |
| R1 running game | card Play | X | `primary` logged |
| SN-N2, SN-N3 | — | Left at page 1 / B at root | pending pad-bfs |

## 3. Requests

- [ ] REQ C2a-R2->C1a: on `windowless` routes the shell reports Steam's 80 × 80 Back hit box (`shell-back`) and the 536 × 80 search box (`shell-search`) as `liquid` plates (`r=capsule`), while in CSS-only mode Back is the borderless section-root chevron (`[data-lgs-back="root"]`) and the search capsule is a recessed black .30 fill. Native mode would therefore draw an 80 px glass circle and a 536 × 80 glass capsule that CSS-only mode does not show, and neither is the 60 px control of HA §3.1 / XC §1. Please report the visible 60 px control (or the 520 × 64 capsule) as the plate, and decide whether Home's Back is a glass circle (mockups) or a bare chevron.
