# C3b Control Center: evidence log

Package card: PLAN §2.4 "C3b Control Center". Concept: `docs/phase2/concepts/control-center.md` (CC). Mockups: every
`docs/phase2/mockups/control-center-*` file except `-bar.html` and `-hud.html` (C3a), plus `control-center.css`,
`control-center-build.js`, `control-center-icons.js`. Audit script: `docs/phase2/concepts/control-center-mockaudit.py`.

## Status

**READY: wp.c3b** (2026-10-07, session 2, expedited single session; Steam build 11094443). Milestone **M3** for
CC-M and the pill patch; T1 CC-C deltas live; native plates declared (M4 code), native check skipped.

- **Built:** `theme/31-cc.css` (A: page-layer fade, window tint off and white pill while CC-M is open; B: the CC-M
  view; C: CC-C, Steam's Quick Access popup, Phase 2 deltas), `device/rt/31-cc.js` (module `cc`, flag `wp.c3b`,
  deps `react`), `theme/layers/31-cc.json` (no pops: tiles and close circle are plates), `capabilities/cc-focus.md`
  (CS10 not run, so CC-A is not shipped).
- **What the user gets with `wp.c3b` on:** the status pill (laser click or A) opens Control Center inside Steam's
  window while that window is the shown page; otherwise Steam's Quick Access opens as before. ≡ on the pill always
  opens Steam's Quick Access. Three tiles (Now, Controls, Room) and a close circle replace the window; Steam's page
  fades out underneath (opacity only) and comes back exactly as it was. Every Quick Access function stays reachable:
  More Controls renders Steam's own five Quick Access panels (Notifications, Quick Settings, Performance, Battery
  Info, Help) inside CC, and the notification list is Steam's own panel in the Now tile.
- **Bindings (CC §4.10), all Steam's own handlers, found by reading Steam's modules:** Wi-Fi, Bluetooth, Motion
  Smoothing = the `checked`/`onChange` of the element Steam's Quick Access toggle component returns; Airplane Mode =
  Steam's hook and `SetAirplaneMode`; Volume, Microphone, Display and Environment brightness = Steam's slider
  components themselves (C4a's capsule look); Room View, Recenter, Playspace menu = the bar's SteamVR dashboard
  actions through the bar's own hook (`fnInvokeAction`), found by the bar's structure, not ids (live ids are
  74000NN, not CC's 4328000NN); Return to Game = `DashboardTabClicked` of the first non-Steam bar tab; Power =
  `SteamUIStore.OpenPowerMenu`; Settings = `actions.navigate`. Every side effect runs through `act()`: executed only
  in P2's live actions mode (flag `actionsLive`, trusted event), else logged (`rt.use('cc').log()`), plus a test spy.
- **Native:** tiles are `data-lgs-plate="panel"` (`cc-now`, `cc-controls`, `cc-room`), the close circle
  `data-lgs-plate="liquid"` (`cc-close`); with C1a's shell runtime on, `shell.glassMode('*')` makes main
  `windowless` while CC-M is open. During another agent's native session the reporter acknowledged the plates (the
  CDP shot showed the tiles' DOM fill dropped, `05-native.css`). **native check skipped: P7 not ready** (P7.md
  reports M1).
- **Device left:** theme on, CSS only (the native session seen in some steps was another agent's), module `cc` off
  (flag off), no `data-lgs-cc*` attributes or `.lgs-cc` nodes in any window, `c3b.pill` patch gone
  (`react.status().patches` = []), no menus open.
- **Known issues (not blocking READY):** see "Known issues" below.
- **R2 fix pass 1 (2026-10-07 20:3x):** review M1 fixed (see "R2 fix pass 1" under Evidence). `31-cc.css`: the top
  toggle row's focus glow keeps P4's spread and alpha with a 12 px blur, and `.lgs-cc-ctl-main` is clipped to the
  tile shape. CC-M gates PASS (all five) in pad mode on `/settings/controller`, `/settings/display` and
  `/library/home`, and in laser mode on `/settings/controller`; P-16 band of the focused Wi-Fi toggle still +27.8 L.
  READY: wp.c3b still holds. Device left clean (no CC nodes or attributes, `/library/home`, module off).

## M0 note: conflicts with PLAN §1 settled (PLAN §1 wins)

| Topic | CC text | Built (PLAN §1) |
|---|---|---|
| Focus look | D-CC6: circles scale 1.10, + .26, bloom | §1.4: no scale on controls; P4's state recipe (`--lgs-ill`, focus + .32, glow on coloured and white fills) |
| Rows | 72 px in the platter | §1.3: 80 contiguous rows in a platter, hover pill inset 6 |
| Hit regions | circles 60/68 | §1.3: every control is an 80 px hit box holding its visible face (square, transparent) |
| Tile material | `panel` glass, radius 54 | §1.2: CSS-only tiles at .94 (black-blue) + panel edge cues; radius `--lgs-r-window` (54, concentric with the 60 px corner circles at 24) |
| Depth | tiles as slabs (inset method) | §1.6/§1.7: tiles are plates at 0 mm in both profiles; no pops in CC-M |
| Strings | new labels ("Passthrough is on", "Not Playing") | §1.15: Steam tokens first; English only on an English UI; the Room title is SteamVR's own action name |
| Slider glyph zone | always filled | REQ C4a->C3b accepted: CC uses Steam's slider components, so C4a's CTL C-D13 rule applies as is |

Deviations from the concept recorded for V2 (expedited scope): battery chips with numbers are a "Battery Info ›"
capsule (opens Steam's Battery Info panel inside CC); the Controls platter has Performance and Quick Settings rows
(no Refresh Rate value, no Streaming row: Steam's Streaming popup stays on the bar's own button); Room View has no
subtitle; no "N Notifications" count (Steam's panel lists them); CC-A not built (CS10 not run).

## Requests

Outgoing:

- [x] REQ C3b->P6: in `00-base.json` `main.modal`, also count `.lgs-cc` (CC-M's modal root) as an open modal, so no
  other main rule pops under CC-M (Steam's `showModal` renders it as `FullModalOverlay > ModalOverlayContent`,
  without `ModalPosition`, so admission rule 6 does not see it; the legacy `hdr-back`, `footer`, `button` rules
  could otherwise pop faded nodes with a slab).
  - P6 (2026-10-07 11:10, maintenance session): done. `main.modal` ends in `, .lgs-cc` (installed on the Frame;
    reporter.md §4 rule 6). Test RP-CC (`wp/P6.md`) **PASS** (11 checks): with a transparent `.lgs-cc` fixture an
    area rule's pop is dropped `rule6-modal` in `window` and in `windowless` mode, a `modal: true` rule (a menu over
    CC-M) still pops, the old selector let the pop through in both modes, and the pop comes back when CC-M closes.
    Legacy rules are admission-off, so rule 6 does not gate them; under CC-M's real state (`windowless`, no cover)
    they are dropped anyway ("outside the cover"), checked in the same run (no legacy main pop). Only if C1a's
    `glassMode('*')` hook did not make main windowless could a legacy rule pop under CC-M, and then only an
    element whose ancestors are not faded below 5 % opacity. Your `31-cc.json` "about" still names this REQ as open.
- [x] REQ C3b->P10: (1) E-TAB for Quick Access's five tabs (`%{QuickAccessMenu} %{PopupBody>Tab}`): Steam's geometry
  puts five 60 bar-px tabs in the 300 bar-px card, so the 66 px P-08 box always meets a neighbour (83-88 % own,
  5-10 % other); criterion: ≥ 50 visible tall, contiguous. (2) OUTLINE probes the QAM card's bottom edge where it
  meets the popup texture's bottom (ratio .544, `edge: visible`, laser run with native off): the edge is the
  texture boundary, not a drawn line; please skip sides that coincide with the capture edge.
  - P10 (2026-10-07 session 4): (1) **done**: `%{QuickAccessMenu} %{PopupBody>Tab}` is in E-TAB, and E-TAB's
    criterion now follows PLAN §1.16 on any surface and on rows: pitch ≥ 52 frame-menu px (52 × m / 0.9 = 48 bar
    px) along the bar, abutting (gap ≤ 2), visible ≥ 60 × m across (49.8 bar px: your "≥ 50 visible tall").
    `gates barpopup --pre <open QAM> --only size,outline --mode pad` (12:04, native off; without `wp.c3b`, which
    makes the pill open CC-M instead): SIZE **PASS**, the five tabs exempt and passing ("row item 60 x 56, gap 0").
    (2) **done in a narrower form**: the side is still probed, but when it lies on the capture edge its outermost
    texel row is not counted (the band starts one texel inside; the probe says `captureEdge: true`). Evidence: the
    last texture row of a barpopup is a uniform line on the **stock** UI too (every stock barpopup capture in
    `shots/`: 31.0 L ± 0 against 19–26 L in the rows above), so that texel is Steam's popup texture, not your card;
    the rows above it carry your card's real bottom edge, P4's E3 rim (`--lgs-edge: panel`, the conic gradient's
    180° bounce lobe), which varies along the edge (26 → 65 L, left to right) and is still measured. Re-measured
    offline: your 09:47 capture `shots/c3b_qam_pad.png` bottom side ratio 0.544 → **0.0** (segments −3 … 30, PASS);
    P10's 12:04 capture `shots/p2_p10_s4_qam_outline.png` PASS. Skipping the whole side was not done: a rim drawn
    along a card that fills its popup would then never be seen. contracts/lab.md §4 OUTLINE.
- [ ] REQ C3b->C3a: two-step move (PLAN §6): `31-cc.css` part C now carries the Phase 2 Quick Access rules that
  differ (tab focus without outline, .18 selected disc, tab row, separators, weights, Phase 2 card material);
  please delete §2.3 "Quick Access Menu" and the Quick Access parts of §2.4 from `30-bar.css` when you rewrite it,
  and keep `%{QuickAccessButton}` (§1.3, the pill) yours. The open-CC pill look is keyed on `html[data-lgs-cc]` in
  `31-cc.css` part A.
- [x] REQ C3b->C1a: `31-cc.css` part A clears the window tint while CC-M is open with
  `%{BasicUiRoot}[data-lgs-cc] { --lgs-c1a-tint: transparent; --lgs-edge: none }` (your private variable; the
  glass height and its content clip stay, because Steam renders the modal layer inside `%{BasicHome}` on library
  routes and a 0 px clip hid CC-M). Please either own an equivalent rule in `20-shell.css` or keep the variable name.
  - **C1a answer (2026-10-07, R2 fix pass):** keep your rule: the name `--lgs-c1a-tint` is frozen and listed in `20-shell.css`'s interface header (the window tint on `%{BasicUiRoot}`, now `var(--lgs-mat-window-tint)`).

Incoming (answered here; the requesters' files are theirs to tick):

- REQ C1c->C3b (Power mockups): **answered by pointer.** CC's Power circle opens Steam's Power menu, which is C1c's
  (WN §5.2); `window-nav-power.html` / `window-nav-alert.html` are the reference, and `control-center-power*.html`
  are superseded (not re-rendered in expedited mode).
- REQ C3a->C3b (concept text, 11 items): **accepted, not merged this session** (expedited). C3a.md's versions bind
  C3a's area; CC §11.2 (the legends in the in-window ornament) is what CC-M does (Steam's own footer legends of the
  focused control).
- REQ C3a->C3b (mockup files): (1) `control-center-build.js` avatar slot 60 → **64** px: done. (2) `--cc-glow`
  follows P4's `--lgs-white-glow`: noted for the next mockup render. (3) FYI noted.
- REQ Coordinator->C3b (R2-4, R2-5): **accepted.** CC-A is not built (CS10 not run); when it is, native mode uses
  `window {dim: 0.6}` alone with no surface `dim`, and its dim is the CSS scrim, not `t1` (CC §3's Power-alert
  `t1` row is superseded by PLAN §1.8). `control-center-power*.html` get Cancel 60 on the next render (they are
  superseded by C1c's `window-nav-power.html` anyway). Same answer for REQ P7->C3b.
- REQ C4a->C3b (slider glyph zone): **adopted** (Steam's slider components with C4a's T1/T2, CTL C-D13).

## Known issues

- CC-C (Steam's Quick Access popup): tab P-08 overlap (REQ to P10); the "Full" battery row 94 % own (one sample row
  under Steam's title band); OUTLINE at the texture's bottom edge (REQ to P10). AUD passes when native mode is off;
  in steps that ran during another agent's native session every text read 1.5:1 (the DOM tint is transparent there:
  the same artifact C1a recorded), not a CC change.
- pad-bfs: three one-way edges are CC §4.8's spec'd joins (Down from the last control of any tile reaches the close
  circle, whose Up returns to the Controls column; More Controls → Off). The four "unreached" nodes are the inner
  `%{*SliderControlPanelGroup>SliderControlAndNotches}` of Steam's own slider components (focus lands on the outer
  slider group, which is reached).
- CC-M OUTLINE, Controls top side: .341 in pad mode against the .35 limit (the E3 rim alone is .321); thin margin.
- Bar SIZE failures (small buttons 94 %, 18 px status icons) are identical with the flag off (C3a's bar).

## Evidence

| Test | Command | Result | Shots / JSON | Date | Steam build |
|---|---|---|---|---|---|
| Finders | `js --flags wp.c3b` `rt.use('cc').status()` | every finder 1 candidate (qamTabs 70240, wifi 29763, bt 81480, vr 862, audio 40572, sys 75191, bar 34493, icons 69385; vrMsg 92102 after the needle fix); pill patch count 1, live 1 | — | 2026-10-07 | 11094443 |
| CC-M gates, pad | `gates main --only size,type,outline,motion --flags wp.c3b --mode pad --pre <open>` | **PASS** (SIZE 23 checked, TYPE 10, OUTLINE, MOTION) | scratch `g_ccm_pad.json` | 2026-10-07 | 11094443 |
| CC-M gates, laser | same, `--mode laser` | **PASS** (one earlier run during a native session failed OUTLINE on the outer tile sides, ratio .69; rerun PASS) | scratch `g_ccm_laser.json` | 2026-10-07 | 11094443 |
| Main with flag, CC closed | `gates main --route /library/home --flags wp.c3b --mode pad` / `laser` | **PASS** all five (AUD 0 issues) with native off | scratch `g_main_*.json` | 2026-10-07 | 11094443 |
| Bar with flag (pill patched) | `gates bar --flags wp.c3b --mode pad` / `laser` | AUD **PASS** both modes; SIZE fails identical to the no-flag baseline (C3a's bar) | scratch `g_bar_*.json` | 2026-10-07 | 11094443 |
| CC-C (Quick Access) | `gates barpopup --pre "L.click('bar','%{QuickAccessButton}')"` pad / laser | TYPE, MOTION PASS; OUTLINE PASS (native on) / bottom texture edge (native off); AUD PASS (native off); SIZE: tabs (REQ P10), one row 94 % | `shots/c3b_qam_pad.png` | 2026-10-07 | 11094443 |
| Laser path | `js --flags wp.c3b --mode laser` (spy on): pill click, every toggle, Off/On, Recenter, Performance → More, Back, Notifications → list, Back, Battery → More, Back, backdrop | **PASS**: pill opens CC-M (bar `data-lgs-cc=open`); wifi, bt, air, motion, recenter, roomview logged by the spy (nothing executed); pages switch; backdrop closes; 0 fade attributes left | scratch `t7.out` | 2026-10-07 | 11094443 |
| Pad path | `js --flags wp.c3b --mode pad` | first focus **Wi-Fi**; Right → Bluetooth; Down → Performance; Left → Battery (explicit neighbour) | — | 2026-10-07 | 11094443 |
| G-PAD | `pad-bfs --flags wp.c3b --mode pad --pre <open>` | 19 nodes, not truncated, B closes the layer; 3 one-way edges = CC §4.8 joins; 4 inner Steam slider nodes listed unreached (see Known issues) | scratch `bfs.json` | 2026-10-07 | 11094443 |
| R2 fix 1: M1, pad, settings | `gates main --route /settings/controller` (and `/settings/display`) `--flags wp.c3b --mode pad --pre <open; L.gpTake(Wi-Fi)>` | **PASS** all five; Controls tile top ratio **.341** (was .357 FAIL), segments 119 130 116 100 83 66 49 36; Wi-Fi glow visible and inside the tile in the shot. Note: without the explicit `gpTake` in the pre, the settings-route capture sometimes has no focus at all (ratio .321 = the laser value), so that run proves nothing; the pre now takes focus explicitly | `shots/p2_c3b_f1_pad_settings_controller.png`, `_settings_display.png`; scratch `c3bfix/g_*.out` | 2026-10-07 | 11094443 |
| R2 fix 1: M1, pad, home | same, `--route /library/home` | **PASS** all five, top ratio .341 | `shots/p2_c3b_f1_pad_library_home.png` | 2026-10-07 | 11094443 |
| R2 fix 1: laser | same, `--mode laser`, `/settings/controller` | **PASS** all five, top ratio .321 (the E3 rim alone) | `shots/p2_c3b_f1_laser_settings.png` | 2026-10-07 | 11094443 |
| R2 fix 1: P-16 | ring 8-16 px outside the Wi-Fi face (offline, 601 luma) in the pad vs laser shots | focused 60.7 L vs rest 32.9 L: **+27.8** (≥ 20). A first try with no spread gave +7 (FAIL) and was dropped | — | 2026-10-07 | 11094443 |
| R2 fix 1: mockup | pad shot vs `control-center-overview` | three tiles and close circle as before; focus halo now ends inside the tile (no lit band on the rim) | `shots/p2_c3b_f1_pad_settings_controller.png` | 2026-10-07 | 11094443 |
| More Controls (CC12) | `js --flags wp.c3b` `page('more', k)` for each tab | Steam's panels render inside CC: Notifications 1, Quick Settings 27, Performance 37, Battery Info 3, Help 9 focusables | — | 2026-10-07 | 11094443 |
| Cmp by eye | `shot main c3b_ccm_main` vs `p2_control-center_gamepad.png` | same three-tile layout, positions and sizes; Wi-Fi focus glow; differences = the recorded deviations | `shots/c3b_ccm_main.png`, `_more.png`, `_notif.png` | 2026-10-07 | 11094443 |
| G-REMOVE | flag off after the steps | no `data-lgs-cc*` / `.lgs-cc` in any window, `react.status().patches` [], module `off`, no `cc` errors in the runtime log | — | 2026-10-07 | 11094443 |
| Native | — | **skipped: P7 not ready** (P7.md: M1) | — | 2026-10-07 | 11094443 |
