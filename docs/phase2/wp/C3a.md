# C3a Bar, HUD, toasts, tooltips look: evidence log

Package card: PLAN §2.4 "C3a". Owns `theme/30-bar.css`, `theme/35-hud.css`, `theme/vr/60-overlays.css`,
`theme/vr/pre/sys_zoo.js`, `device/rt/30-bar.js`, `device/rt/35-hud.js`, `theme/popups/30-bar.json`,
`theme/layers/30-bar.json`, and the mockups `control-center-bar.html`, `control-center-hud.html`, `window-nav-toast.html`.
Surfaces: `bar`, bar popups other than "+" and Quick Access, `tooltip`, `volumelevel`, `notifications`, `floatingfooter`
(look only), SteamVR overlays. Concept text is not C3a's: CC (`concepts/control-center.md`) is C3b's and WN
(`concepts/window-nav.md`) is C1a's, so text changes go to them as requests (below); the operative test list for this
package is in "Acceptance tests" here.

## Status

- **READY: wp.c3a** (2026-10-07 10:45, build 11094443). Evidence in the table below: with `--flags wp.c3a` in both
  `--mode laser` and `--mode pad`, G-AUD has no GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST finding on `bar`,
  `barpopup` (Playspace, Streaming, the Steam tab menu), `tooltip`, `volumelevel`, `floatingfooter`; the bar's gamepad
  traversal (View x2, Right x8, Left x8) reaches every item in Steam's order both ways with wrap and a visible focus
  light, no outline; the modules `bar` and `hud` log no error and leave no attribute when the flag goes off.
- **M2 (T1) reached** for C3a's surfaces: `theme/30-bar.css` and `theme/35-hud.css` rewritten (drafts identical in
  `theme/_wip/`). Bar = Home circle, apps capsule, system capsule (liquid-over-room tint + E3 edges), 56 pp discs at a
  64 pp pitch, white on/open discs, focus light (+.32, spot, arc) or the scaled white glow, .18 selected disc + white
  dot, the pill on one line (clock 26 Semibold tabular). Bar popups and tab menus are panel glass with 64 pp rows,
  tab-menu current route = navigation selection; Streaming's primary is the blue capsule. Tooltip = thick capsule 40 pp,
  18 Semibold; volume HUD panel capsule; floating hint 40 pp capsule; toasts 320 x 76, r 30, entrance by
  `@starting-style` (Steam's `toastEnterVR` / `toastExitVR` list untouched). `theme/vr/60-overlays.css`: the one ring
  (binding callout active) is now light. All DashboardMenu rules are scoped to `%{Variant_TabMenu}` (C1a's REQ done).
  `python docs/phase2/fontkit.py --hooks` was run for the new `--lgs-edge` / `--lgs-ill` hosts (tokens.md §2 allows it).
- **M3 (T2) reached:** `device/rt/30-bar.js` (module `bar`, flag `wp.c3a`: unread count from
  `NotificationStore.m_nUnviewedNotifications` as `data-lgs-unread` on Steam's bell, badge drawn in CSS; `data-lgs-exempt=
  "E-BAR"` on the disc slots) and `device/rt/35-hud.js` (module `hud`: `data-lgs-val` = round(100 x
  `--normalized-slider-value`), seen live as "30"). `hudPlacement` is **not built**: P6's wrapper cannot set a popup's
  y or pitch (reporter.md §5.2), so the HUD keeps Steam's placement (S21 default).
- **Native fragments written:** `theme/layers/30-bar.json` (`owns: ["bar"]`, cover = the three pieces, unflagged because
  the T1 look is always on) and `theme/popups/30-bar.json` (`owns: ["barpopup"]`, +25 mm, flag `wp.c3a`, needs `wp.p6`).
  **Native check: deferred to V1: P7 fix in progress.** The coordinator put a hold on the native lock (P7's
  scene-graph fix has priority) at about 10:45. Before that message arrived, one `native-session` had already run
  (10:34, `sgcheck --flags wp.c3a` plus one `hv --look`). Treat its result as **provisional only**: `bar`,
  `barpopup`, `tooltip` x3, `volumelevel`, `notifications` and `floatingfooter` had 0 pops at 0 mm and no C3a finding.
  The run's only FAILs were main's `hdr-back` (5.54 mm) and `footer` (4.43 mm) (R2), which are not C3a rules. The hv
  frame showed the bar as three separate glass pieces; it was viewed and then deleted (`hv --clean`, nothing kept). No
  native-mode run followed the hold. V1 should rerun `native-session --step "sgcheck --flags wp.c3a,wp.p6"` (also to
  read back the +25 mm barpopup request through P6's wrapper) once P7 releases the lock.
- **Known, not fixed:** (1) G-SIZE on `bar` lists Steam's pill glyphs (stock too; REQ C3a->P10). (2) G-OUTLINE: one
  bottom-edge probe on Streaming's first card (ratio .78), see Evidence. (3) D-9: capsules keep Steam's 80 pp height
  (mockup 72): the Bookend tab and avatar are 80-86 tall and BarSurface clips; bar 774 pp wide with no app tabs (mock
  ~728). (4) The Quick Access rules stay in 30-bar.css §4 and the keyboard in 35-hud.css §5 until C3b / C4b ask (PLAN §6).
  (5) PLAN-3a-1 `cmp` and G-FOCUS live pairs not run (expedited). (6) Toast look verified on a class-exact mock in the
  hidden notifications window (computed styles), not on a live toast.
- Device left: theme on, CSS-only (native-session returned), no C3a flag set, bar popups and tooltips closed, pointer
  parked with `L.unhover()`. The main route was changed by other agents' steps during this session; C3a navigates none.
- **M0 reached** (2026-10-07). Done this session:
  - The three owned mockups follow PLAN §1 (every §1 decision that touches C3a is in the table below) and are re-rendered:
    `shots/p2_control-center_bar.png`, `shots/p2_control-center_hud.png`, `shots/p2_window-nav_toast.png`. Each image was
    looked at and fixed until it matched the spec (label overlaps, a laser dot over text, an art override, the E-BAR slot).
  - Focus contrast measured on the bar render, bright and dim room (A/B twin renders): all G-FOCUS criteria pass with one
    noted change (the white-fill glow; REQ to P4).
  - The concept text changes for C3a's area are written out as requests to C3b (CC) and C1a (WN); the updated acceptance
    tests and the function retention table for C3a's area are in this file.
- **Open from M0 (owned by others, not blocking C3a):** the requests below (C3b, C1a, P4, P6, P10). When C3b/C1a apply
  them, their concept text matches this file; if they decline, this file's versions still bind C3a's own tests.
- **Next session: M2 (T1).** Rewrite `theme/30-bar.css` and `theme/35-hud.css` per the specs below; first the two-step
  moves of PLAN §6 (frame-menu rules → C1a `20-shell.css`, "+" popup rules → C2b `32-launcher.css`, Quick Access rules →
  C3b `31-cc.css`, keyboard sections of `35-hud.css` → C4b `36-keyboard.css`): wait for each receiver's request, then delete.
  Use `theme/_wip/` for work in progress and `python glass.py check-theme` before saving into `theme/`. Then gates
  G-AUD / G-SIZE / G-TYPE / G-OUTLINE on `bar`, `barpopup` (Playspace, Streaming, tab menus), `tooltip`, `volumelevel`,
  `notifications` (mock), `floatingfooter` (two-legend recipe), both input modes, and `glass.py cmp` (needs REQ C3a->P10).
- No device access this session (M0 is offline). Device left untouched.

## Session log

### 2026-10-07 — M0 (conformance)

1. Read PLAN §0–§7, the C3a card, CC §2–§3, §6–§11, §13, WN §3.5.3, §5.5, §5.6, §8, §9.6, AT-18, D2 §2.5, §3.4, §3.7,
   §5.3, §11, VP P-01..P-89, inventories `bar.md`, `hud.md`, `steamvr.md` §5.2, GM §1.5, contracts `tokens.md`,
   `interaction.md`, `reporter.md`, `lab.md`.
2. `grep -n "REQ [A-Za-z0-9]*->C3a:" docs/phase2/wp/*.md` at start: no wp directory yet (no requests). At end: none.
3. Rewrote the three mockups (details per §1 item below), rendered, looked, fixed, re-rendered.
4. Ran the CC mockup audit (A2) on the bar mockup and the focus A/B measurements.
5. Wrote the requests.

Note on shots: PLAN §2.6 freezes the Phase 2 `shots/p2_*` files, but this session's M0 instruction is to re-render the
owned mockups to `shots/p2_<concept>_<name>.png`, so the three files above were overwritten with the §1-conformant renders.

## PLAN §1 conformance: every decision that touches C3a

| §1 | Decision | What it means for C3a | Applied |
|---|---|---|---|
| 1.1 | Toasts, bar tooltips, volume HUD, floating footer → C3a; WN §5.5 card size | Toast card **320 × 76** (CC's 336 × 76 at a 2 tp inset is withdrawn). Steam's `%{GamepadToastPopup}` keeps `inset: 0 0 0 20px` (do-not-touch, `hud.md` §4.4), so the card sits at x 20, y 2 of the 340 × 80 quad | Both toast mockups; REQ C3b (CC §8, A16), REQ C1a (WN §5.5) |
| 1.2 | Route glass modes; CC-M is windowless while open | The bar stays as it is while CC-M is open (always visible); only the pill turns white | Bar mockup unchanged in this respect |
| 1.3 | Bar disc 56 bar px at 64 pitch, slot 64 × 72 | Unchanged sizes. **E-BAR applies to every slot, the avatar's too**: CC's 60 × 72 avatar slot becomes 64 × 72 (bar ≈ 728 pp with no app tabs, ≈ 856 pp with two) | Bar mockup (page-local override of the builder); REQ C3b (CC §3.1, builder) |
| 1.4 | Two input signals; laser looks on `:hover`; focus + white .28; selection .18 + arc; white-fill glow; no scale except cards and Home discs | Bar looks keyed on `html.lgs-input-laser` / `-pad` (P3 sets them on every popup, the bar included). Laser hover: + .08 and a .12 spot at the pointer, under the glyph (P-10). **Gamepad focus: + .28, a static .16 spot at (50 %, 30 %), the disc's own arc ×1.5; no scale, no contact shadow** (D-CC6 scale withdrawn: bar buttons are toolbar buttons, VP P-05). Pill: same, no ×1.06. Selected frame: .18 disc + top arc + Steam's indicator as a 6 pp white dot. White ("on", open source, pill open), coloured and art discs: the outer glow only, no fill (`--lgs-ill: white`). Steam's FocusRing on `bar`/`barpopup` stays transparent (the disc carries the focus; one focused look, P-13). Disabled: content and fill at 40 %, no hover | Bar mockup rows D–F; measured (below); REQ C3b (CC §3.2, §9, §15 D-CC6) |
| 1.4 | G-FOCUS criteria | Replace CC A25's "≥ 25, or ≥ 15 + scale ≥ 1.08" with G-FOCUS: ≥ +40 L over rest, ≥ selected + 15 L, glow band ≥ +20 L on white / coloured fills, first frame ≥ 60 % | Tests below; REQ C3b (A25) |
| 1.4 | Glyph badges only in gamepad mode | None added on the bar. The floating hint's glyphs are Steam's own legend nodes (§1.10: never hidden), shown in either mode | Toast mockup hint |
| 1.5 | One motion system: P5 tokens and `lgs-mat-*` keyframes; toasts keep `toastExit*`; nothing at rest; Reduce Motion fades | Toasts, tooltips and bar popups materialize with P5's keyframes (250 / 350 ms); toast entry replaces `toastEnterVR`, `toastExitVR` kept; HUD value steps on `interactive`; bar selection dot retimed to `snappy` (timing only). **White-fill transitions (pill white, Room View on, popup source) run on `fade` 441 ms, not `hover-in` 294 ms**: their mean luma rises > 80 L, which VP P-57 wants over ≥ 300 ms | Spec only (no motion in static mockups); REQ C3b (CC §9) |
| 1.6 | Materials: bar segments `liquid`; **bar popups, toasts, HUD `panel`**; menus `thick` (in-window); edges = conic arc + lobe, no linear top layer, no outline | Playspace / Streaming / tab menus are **panel** (they are bar popups on their own quad; CC said thick). T1 on separate quads = panel tint `rgb(28 30 40 / .78)` + edges (in-page blur sees nothing there). All three mockups draw E3 as arc + lobe (page-local copy of WN D-15 until P4's kit carries it) | All mockups; REQ C3b (CC §3.4, §10) |
| 1.7 | Depth: bar popups +25 mm (popup z through P6's wrapper, fallback 3.7 mm); tooltips CSS shadow only (wearer: owner + 5 mm); toasts and HUD are SteamVR-placed | `theme/popups/30-bar.json` (M4) asks +25 mm for Playspace, Streaming, tab menus (barpopup host type 1, except "+" = C2b, Quick Access = C3b). Separate quads clip any outer CSS shadow (`hud.md` §0, `bar.md` §2.0), so tooltip, toast, HUD and bar popups draw no outer CSS shadow; in T5 glassd adds its small contact shadow (GM §1.5) | Mockups: no outer shadow on tooltip / HUD / toasts; the menu's shadow set to glassd's contact size |
| 1.8 | Dimming | Nothing in C3a's area | — |
| 1.10 | Legends never hidden; quiet A/B; ornament capsule rules | Floating hint (`floatingfooter`, look only): Steam's legends and glyphs as Steam renders them. The in-window ornament is C1a's. CC-M's legends live in that in-window ornament, not in the floating footer (CC §2.2, §14 say otherwise) | Toast mockup; REQ C3b (CC §2.2, §14 wording) |
| 1.12 | Menu layouts by count; E-MENU; destructive rule by count; Steam's order and default focus | **Bar menus stay one column**: the barpopup host is 300 pp wide (D2 §3.4), so the ≥ 8 two-column layout cannot fit; Steam's tab menu (up to 10 rows with Console in developer mode, ≈ 710 pp) fits the 1024 pp host. E-MENU in pp (m .83): rows ≥ 50 visible on a contiguous pitch ≥ 53 (compact) or 65 (regular), ≥ 266 wide. Spec: 64 pp rows 5 pp apart (pitch 69, 6 main px gap), 20 pp Medium labels, 22 pp glyphs, 280–300 pp wide. Destructive rows by count (an app tab's Close, if Steam marks it); Steam's order and first focus untouched | Bar mockup menu; REQ C3b (CC §3.4) |
| 1.13 | Tooltips: thick capsule 48 px, 20 px Semibold, 0.8 s in / 0.2 s out (P3); bar tooltips through a `ShowTooltip` wrapper | Bar tooltip = Steam's `tooltip` host, **400 × 40 tp, a hard maximum** (`hud.md` §1.3: the pill is 100 % of the 40 px window). So the capsule fills the host: **40 tall** (= 48 main px at m .83, 44 at .90), **18 Semibold** (= 22 / 20 main px), padding 0 18, thick glass, no outer shadow, Steam's below-the-bar placement and marquee untouched. Delay in: P3's wrapper (≥ 800 ms); out: Steam closes the host at once (no exit animation possible, MO R4) | Bar mockup row C; REQ C1a (WN §5.6, §8.1 "tooltips: panel" → thick), REQ C3b (CC §3.1, §3.4), REQ P6 (tooltip surface) |
| 1.13 | No sound on hover; haptics off | C3a adds no sounds | — |
| 1.15 | Strings from Steam's localization only | C3a draws only numerals (unread count, HUD number). **The toast time label ("now", 15 tp) is dropped**: Steam's template has none, it would be a new string, and 15 tp is under the G-TYPE floor (18 × .90 = 16.2 tp) | Toast mockups; REQ C3b (CC §8) |
| 1.16 | E-BAR: slots ≥ 64 × 72 bar px | As 1.3 (avatar slot) | Bar mockup; A4 |
| 1.17 S21 | HUD moved to 12° below the eye line: **off** (`hudPlacement`) | **The HUD ships at Steam's placement** (y −0.4, z −0.8, pitch −20°: 27° below, 0.89 m) with the new look; the 12° placement only behind the flag | HUD mockup redrawn (default at 27°, the option labelled "flag off"); REQ C3b (CC §0, §1, §2.1, §6, §11.4, A15) |
| 1.17 S3 | Entrance overrides adopted; Steam's timeouts | Toast entrance replaced, `toastExitVR` kept | Spec |
| 1.17 S16 | Pointer proxy in native mode (C1a), also on `bar` | Nothing for C3a to draw; the bar CSS must not hide `div.lgs-pointer` | Note for M2 |
| 1.18 A8 | Bar pitch 64 bar px | As 1.3 | — |

Other conformance fixes found while doing this (not a §1 change, but required by a §1 gate):

- **Floating hint height.** WN §3.5.3 says a 44 popup px capsule, but the `floatingfooter` host is 600 × 40 and its clip
  rect is the content box (`hud.md` §3.3), so the capsule is **40 tall, radius 20**. Toast mockup fixed; REQ C1a.
- **Glyph colour on icon discs** (CC §7 rule): dark on green and orange, white on blue and red. The WN toast mockup had a
  white glyph on green: now game art. Incoming call: Steam's green whole fill with **dark** text (white on green ≈ 2:1).
- **Achievement toasts** show the achievement art as a rounded square (SM C.6, CC §8); the WN variant had a star disc.
- **Game-page cluster depth** in `window-nav-toast.html`: Play was `data-dz="15"`; §1.7 keeps the cluster over art at
  0 mm until G2 and GP AT-HV-OFFAXIS pass. Now 0.

## Decisions taken without the user (PLAN §1.17 rule: safe default, noted)

| # | Question | Safe default taken | Flag |
|---|---|---|---|
| D-1 | §1.4's white-fill glow `0 0 18px 2px white .30` measures **+4 L** in P-16's 8–16 px band on the bar render; the gate needs +20 | Mockup shows `0 0 22px 8px white .55` (+23 L bright room, +27 L dim), the weakest tested value that passes. P4 owns `--lgs-white-glow` and sets the final value (REQ C3a->P4). Visibility of focus is the safer reading of §1 | — |
| D-2 | Bar menus and §1.12's two-column rule | One column (the 300 pp host cannot hold two); E-MENU converted to pp (× .83) | — |
| D-3 | Tooltip height 48 vs the 40 px host | Fill the host (40 tp). A popup-scale request ×1.2 on tooltip hosts through `popups/30-bar.json` would reach 48 main-px-equivalent; not built unless a gate asks for it | `barTipScale` (not built; off) |
| D-4 | Press on bar discs | Keep Steam's own press transform (`%{PopupBody>Inner}` scale .9 + `%{ClickPop}`, on the inventory's do-not-touch list, CC R6) and add only our glow on `interactive`; no extra swell, so scales never stack | `barPressSwell` (off; M2 decides with A4) |
| D-5 | Art discs (app tabs) under focus | `--lgs-ill: white` treatment: outer glow, no white fill (a fill would wash the art) | — |
| D-6 | The pill's "Quick Access Menu" tooltip vs VP P-12 ("no tooltip on controls with visible text") | Kept: the pill's visible content is status (clock, glyphs), not its name; the tooltip is the only label of the action. Recorded deviation (P-12 is a "should") | — |
| D-7 | White-fill transitions | `fade` 441 ms (VP P-57), not `hover-in` | — |
| D-8 | Toast header icon (`%{ShortTemplate>Icon}`, 13 tp svg) | Restyle to 18 tp (never hide a Steam node) | — |

## Measurements (mockup)

Focus contrast on `shots/p2_control-center_bar.png` against a twin render with every focus state removed (same pixels,
same room; rest twin rendered from the same HTML with `"focus"` / `"state":"focus"` stripped). Mean luma 0–255, Rec.601
(VP SHOT) and Rec.709 agree within 0.2. Regions from the DOM rects of the render (`--pop-scale` 1.2: 56 pp disc = 67.2 px).
Scripts in the session scratchpad (`c3a/focus_ab.py`, `c3a/dim_ab.py`, `c3a/t1_ab.py`, `c3a/glow_test.py`); not kept in the repo.
The T1 column renders the same page with the kit's CSS-only rule (separate quads: panel tint .78 + edges); it was
viewed as well (dark capsules, labels and focus clearly legible) and not kept.

| Check | Criterion | Bright (studio) | Dim (`data-dim`) | T1 look (`data-tier="t1"`) | Result |
|---|---|---|---|---|---|
| P-14 status pill, focus vs rest (capsule shape) | ≥ +40 | +40.4 | +44.1 | +55.8 | PASS (bright at the edge; P4's tuning range .28–.32 gives margin) |
| P-14 Streaming disc, focus vs rest | ≥ +40 | +47.4 | +50.6 | +65.2 | PASS |
| P-15 focused Streaming (159.7) vs selected Steam disc (136.9), same image | ≥ +15 | +22.8 (`glass.py focus --png`) | +33.5 | +35.7 | PASS |
| P-16 white Room View, glow band 8–16 pp | ≥ +20 | +23.1 (at `0 0 22 8 .55`) | +27.1 | +30.8 | PASS; at §1.4's literal `0 0 18 2 .30`: **+4.1, FAIL** (D-1) |
| P-16 glow variants (bright) | — | 18/2/.30 +4.1 · 18/5/.42 +10.6 · 18/8/.45 +17.6 · 22/8/.55 +23.1 · 16/10/.50 +24.7 · 24/12/.50 +30.7 | — | — | inside the bar's 80 pp clip box the values are within 0.6 L |
| A2 (CC mockup audit) on the bar mockup | discs ≥ 56, pitch 64, text ≥ 15 pp | `python docs/phase2/concepts/control-center-mockaudit.py bar` → PASS, min text 16 pp, slots [64], widths 740–856 pp, 51 targets, none below floor | — | — | PASS (before the avatar fix it reported a 60 pp slot) |

## Acceptance tests for C3a, updated to PLAN §1

These are the operative versions for C3a (card: CC A3–A6, A15, A16, A25 (bar), A26; WN AT-18; PLAN-3a-1, PLAN-3a-2;
plus the global gates of §4.1 on C3a's surfaces). C3b and C1a are asked to carry the same text in their concepts.
All live steps hold the lab locks, follow the never-list, use `--mode laser|pad`, end hover steps with the pointer at
(1400, 900) and check `vrPooledPopupStore.m_mapTooltips` is empty.

| Id | Test | Command / method | Pass |
|---|---|---|---|
| CC A3 | Bar functions kept | `glass.py audit bar` and `audit barpopup` with the OPEN snippets for Playspace, Streaming, the Steam tab menu, an app tab menu (`inventory/bar.md` §0.3), both modes | GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST = 0 (exemption E-BAR only) |
| CC A4 | Bar target sizes | `elementFromPoint` sweep over the bar at 2 pp steps | Every slot ≥ 64 × 72 pp (E-BAR, avatar included); "+" disc renders 56 ± 2 pp; adjacent slot hit boxes abut (gap ≤ 2 pp, VP P-07) |
| CC A5 | Bar states | `shot bar p2_c3a_bar_{rest,hover,focus,open}` (laser: rest, hover; pad: focus), CLEANUP after | White only on Room View on, an open popup's source, the pill while CC or QA is open; no ring or outline; computed `scale` none on every focused bar element (VP P-05); exactly one focused look in pad mode (P-13); none in laser mode even with a stale `.gpfocus` (P-02) |
| CC A6 / PLAN-3a-2 | Battery setting honoured | Read Steam's Battery Percentage value; `shot bar` | No number on the pill when the setting is off; a dark number (#0d0e12) on the whole-fill capsule when on |
| CC A15 | Volume HUD | `inventory/hud.md` §2.2 trigger (volume never changes); `shot volumelevel p2_c3a_hud`; `audit volumelevel`; popup params read back | Capsule 224 × 40 hp, glyph inside the white fill, number = `round(100 × --normalized-slider-value)`; **placement = Steam's (y −0.4, z −0.8, pitch −20°) with `hudPlacement` off**; with `--flags hudPlacement` inside the step: y −0.17, pitch −12° (or Steam's if CC7 fails, recorded) |
| CC A16 + WN AT-18 | Toast | Class-exact mock: `hud.md` §4.3 (b) in a tooltip host for the shot, (a) in the real `notifications` window for computed styles | Card 320 × 76 tp at x 20, y 2 of the quad (Steam's inset unchanged), radius 30; icon 48 circle (achievements: rounded square); title 20, body 18 (TwoLine: 2 × 18, card 80); no `outline` / `border` (P-42); `toastExitVR` still in the computed `animation-name`, our entry in place of `toastEnterVR`; no text < 16.2 tp; dark text on the green call fill |
| CC A25 (bar) | Focus visibility (G-FOCUS) | `glass.py focus bar --pairs` (pad mode): focused disc vs the same disc at rest, focused plain disc vs the selected Steam disc, white disc band; first-frame shot at t0; one `hvgrab` look (then delete) | ≥ +40 L over rest (P-14); ≥ selected + 15 L (P-15); glow band 8–16 pp ≥ +20 L on white / coloured / art discs, measured inside the bar's clip box (P-16); first frame ≥ 60 % (P-18). Mockup values: table above |
| CC A26 | Contrast | `audit` CONTRAST on `bar`, `barpopup` (each popup), `tooltip`, `volumelevel`, `notifications` (mock); script: text on whole-fill colours | CONTRAST = 0; text on green / orange / yellow / red fills is #0d0e12; white text only on glass, the deep-red badge and blue fills |
| C3a-HINT | Floating hint | `hud.md` §3.2 two-legend recipe with 9 s timers; `audit floatingfooter`; computed styles | Capsule ≤ 40 fp tall inside the content box; no `filter: brightness(.6)`; `text-transform: none`, letter-spacing ≤ .01 em (P-84); labels ≥ 18 fp; CONTRAST 0; defaults restored to `[0,1,8,9]` |
| C3a-TIP | Bar tooltip | TOOLTIP snippet on Room View and "+", both modes, with P3's wrapper on | None at 500 ms, shown by 900 ms; capsule 40 tp, 18 Semibold, no outline; `%{Marquee>Content}` transform / animation and the container's inline vars unchanged; `m_mapTooltips` empty after the leave |
| C3a-MOT | Motion (G-MOTION) | `glass.py motion bar` / `barpopup` / `notifications` (mock) per interaction | Every duration and easing a token (P-58); white fills on `fade`; popups materialize from the edge nearest the button; toast entry ≤ 16 px from rest (P-54); nothing at rest 1 s later; Reduce Motion: opacity only, ≤ 200 ms |
| C3a-NAT | Native (G-DEPTH, M4) | `glass.py native-session` with `sgcheck`; popup params read back (P6 RP-7 method); glassd spec | Bar popups at +25 mm (popup z), no crop pops on `bar`, `barpopup`, `tooltip`, `notifications`, `volumelevel`; the bar cover = 3 shapes (Home circle, apps capsule, `%{Tray}`); covers acked before CSS glass drops |
| PLAN-3a-1 | Looks like the mockups (G-MOCK) | `glass.py cmp docs/phase2/mockups/control-center-bar.html shots/p2_c3a_bar_live.png --id C3a --name bar`, same for `-hud.html` | Named rects ±8 px or the difference explained here; both images viewed, verdict recorded. Needs popup-scale support (REQ C3a->P10) |
| G-REMOVE | Nothing persists | `lgs off`, then `outline bar` + `status` | Stock bar, popups, tooltip, HUD; popup wrapper params restored; no `data-lgs-*` |

## Function retention (C3a's area)

The full list as CC §11 / WN §9 should carry it, with owner and test columns (PLAN §4.5 ledger). "Unchanged" = Steam's node
and handler, restyled. Pad to bar = View ("Cycle View").

| # | Function | Phase 2 place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| B1 | Select the Steam frame | Home circle (Steam's tab node) | Click | View → bar, Left/Right, A | T1 | C3a | A3, A5 |
| B2 / N4 | Steam tab menu: Home, Library, Store, Friends & Chat, Media, Downloads, Console, Steam Settings, VR Settings, Power | Panel-glass menu up from the Home circle, one column, Steam's order | Hover 200 ms, click | Bar focus on Home, Up, Up/Down + A | T1 | C3a | A3 (OPEN tab menu) |
| B3 | Switch to an app or desktop-window frame; its tab menu (Close) | Art discs in the apps capsule; the same menu look | Click; hover for the menu | Left/Right + A; Up for the menu | T1 | C3a | A3, A5 |
| B4 | "+" list (Launch Program, Add Desktop Window, Liquid Glass) | "+" disc (white while open) | Click | Left/Right to "+", A | T1 | C3a (disc), C2b (popup) | A3; C2b PLAN-2b-1 |
| B5 | Playspace Menu: Playspace Setup, Adjust Floor Height, Recenter | System capsule slot 1 → panel-glass menu, 64 pp rows | Click, then click a row | A, then Up/Down + A | T1 | C3a (bar), C3b (CC circles) | A3 (OPEN Playspace) |
| B6 | Toggle Room View | System capsule slot 2, white when on | Click | A | T1 | C3a (bar), C3b (CC segment) | A3, A5 |
| B7 | Streaming Status: Select game to stream, hosts, Advanced › Stream VR Without Game | Slot 3 → panel-glass card, the one blue primary | Click | A, then D-pad + A | T1 | C3a (bar), C3b (More) | A3 (OPEN Streaming) |
| B8 | Quick Access | The status pill (opens CC: C3b's patch; ≡ opens QA) | Click | A on the pill; ≡ | T1 (look), T3 | C3a (look), C3b (behaviour) | A3, A5; C3b A7 |
| B9 / S13 | Read the time and status | Pill: 26 pp clock, battery, glyphs 23 pp | Look | Look | T1 | C3a | A5, A26 |
| B10 | Account page | Avatar disc, 64 × 72 slot | Click | Left/Right + A | T1 | C3a | A3, A4 |
| B11 / R3 | Tooltips (identify a button or running item) | Thick-glass capsule below the bar, 0.8 s | Hover | Focus | T1 (+ P3 wrapper) | C3a (look), P3 (delay) | C3a-TIP |
| B12 | Conditional items: Downloads progress, Family View / Kiosk lock, unformatted SD, low disk (+ boot-reserve dialog), connection warning, voice chat | Slots and pill glyphs, Steam's order; Downloads as art in a progress ring | Click | Left/Right + A | T1 | C3a | A3 (static: same primitives) |
| B13 | Close a bar popup (outside press, B, 2 s after leaving, another popup) | Unchanged | Click outside | B | — | C3a | A3 |
| B14 | Focus the bar from anywhere | Unchanged (the floating hint names it) | — | View | — | C3a | A3 |
| S1 | Headset battery | Pill capsule (level; dark number only with Battery Percentage on) | Look | Look | T1 | C3a | A6 / PLAN-3a-2 |
| S2 | Controller batteries | Steam's status items as small capsules (hidden by Steam during an alert) | Look | Look | T1 | C3a | A5 |
| S3, S4 | Volume and Wi-Fi glyphs | Pill glyphs 23 pp | Look | Look | T1 | C3a | A5 |
| S5, S6 | Connection warning, unformatted SD | Pill glyphs (Steam's items) | Look | Look | T1 | C3a | A3 |
| S7 / NO1 | See that something is unread | Deep-red count badge on the pill (count from Steam's store, T2) | Look | Look | T1, T2 | C3a | A5, A26 |
| S11 | Low-battery toast | System banner: orange disc, dark glyph | Look | — | T1 | C3a | A16 |
| NO4 | Read a toast (hover and click as Steam) | 320 × 76 card where SteamVR places it | Look / hover / click | — (as today) | T1 | C3a | A16 |
| NO5 | SteamVR's own toasts (`notificationtoast.html`) | Same card language in `theme/vr/60-overlays.css` | Look | — | T1 | C3a | A16 (`shot vr:systemui` with `sys_zoo.js` part 2) |
| V1 | See the level after a volume press | HUD capsule at Steam's placement (12° behind `hudPlacement`) | Look | Look | T1, T2 (number) | C3a | A15 |
| V2 | Drag while it shows | Unchanged | Drag | — | — | C3a | A15 |
| FF1 | Learn Cycle View and Laser Mouse | Full-brightness hint capsule | — (hint) | The shown buttons | T1 | C3a (look), C1a (content) | C3a-HINT |
| VR-MO | Answer an app's SteamVR message overlay (up to 4 buttons) | Panel-glass card, capsule buttons, the first one the tinted primary (`theme/vr/60-overlays.css`) | Click (SteamVR's) | SteamVR's | T1 (vr) | C3a | `shot vr:systemui` with `theme/vr/pre/sys_zoo.js` part 2 (static mock; no live trigger, `steamvr.md` §5.1) |
| VR-BC | Read an app's binding callouts | Panel-glass callouts (same file) | Look | Look | T1 (vr) | C3a | `shot vr:systemui` with `sys_zoo.js` part 2 (static mock; `steamvr.md` §5.3) |

Owned elsewhere and only reached from the bar: B3b, V3, S9, S10, QS*, QP*, QB*, QH*, QN*, Q0, Q1, QT, P0–P9 (C3b, C1c),
S8, NO6 (C6a, C6b), NO2, NO3 (C3b).

## Evidence

| Test | Command | Result | Shots / JSON | Date | Steam build |
|---|---|---|---|---|---|
| M0 render: bar | `python tools/mockshot.py docs/phase2/mockups/control-center-bar.html shots/p2_control-center_bar.png` | Rendered, viewed; six states, one input mode per row, labels clear | `shots/p2_control-center_bar.png` | 2026-10-07 | n/a (offline mockup) |
| M0 render: HUD and banners | `python tools/mockshot.py docs/phase2/mockups/control-center-hud.html shots/p2_control-center_hud.png` | Rendered, viewed; HUD default at 27°, option at 12° labelled "flag off" | `shots/p2_control-center_hud.png` | 2026-10-07 | n/a |
| M0 render: toast, hint | `python tools/mockshot.py docs/phase2/mockups/window-nav-toast.html shots/p2_window-nav_toast.png` | Rendered, viewed; card at Steam's x 20, hint 40 tall, four variants | `shots/p2_window-nav_toast.png` | 2026-10-07 | n/a |
| CC A2 (bar mockup) | `python docs/phase2/concepts/control-center-mockaudit.py bar` | PASS (min text 16 pp; slots [64]; widths 740–856 pp; 0 below floor) | — | 2026-10-07 | n/a |
| G-FOCUS (mockup) | twin A/B (`focus_ab.py`, `dim_ab.py`) and `python glass.py focus --png shots/p2_control-center_bar.png --pair ...` | P-14 +40.4 / +47.4, P-15 +22.8, P-16 +23.1 (bright); +44.1 / +50.6, +33.5, +27.1 (dim) | `shots/p2_control-center_bar.png` | 2026-10-07 | n/a |
| M2 gates `bar` | `gates bar --flags wp.c3a --mode laser` and `--mode pad` | AUD, TYPE, OUTLINE, MOTION **PASS** both modes; SIZE: only Steam's pill glyphs (battery, volume, Wi-Fi, bell: `focusable:false`, clicks bubble to the pill), the same in `--stock` (REQ C3a->P10). Disc slots tagged E-BAR by `30-bar.js`: 5 exempt, all pass (64 x 80 pp slots, 56 pp discs, + 70 x 72) | — | 2026-10-07 09:52-10:00 | 11094443 |
| M2 gates `barpopup` Playspace | OPEN Playspace pre, both modes | **PASS** (laser and pad; one earlier pad AUD CONTRAST run was a timing artefact of the materialize, gone after `lgs-mat-large-in`) | `shots/p2_c3a_play_t1.png` | 2026-10-07 10:25 | 11094443 |
| M2 gates `barpopup` tab menu | HOVER Steam tab pre, both modes | **PASS** after `--lgs-light: 305deg` on the tall menu (edge ratio .479 before) | `shots/p2_c3a_tabmenu_t1.png` | 2026-10-07 10:12 | 11094443 |
| M2 gates `barpopup` Streaming | OPEN Streaming pre, both modes | AUD, SIZE, TYPE, MOTION **PASS** (fixed: blue primary over C4a's raised button, 66 pp tall, 20 pp one line; host status 16/500 at white .86; Advanced 50 pp target; no rings on the host card, the status dot or the divider). **G-OUTLINE: 1 probe** on the first card's bottom edge, ratio .78 (dL 27.9): the card's bottom rows are 30 L vs 32 inside in our capture, so the probe sees the antialiased edge over its bright room; recorded, not fixed | `shots/p2_c3a_stream_t1.png` | 2026-10-07 10:20 | 11094443 |
| M2 gates `tooltip`, `volumelevel`, `floatingfooter` | TOOLTIP (Room View hover), volume `m_VolumePressedSubscribable` (no volume change), two-legend footer recipe; both modes | **PASS** all three in both modes (tooltip pad MOTION once caught the materialize running at +1 s; rerun PASS; volume pad once hit a CDP timeout, rerun PASS) | `shots/p2_c3a_tip_t1.png`, `p2_c3a_hud_t1.png` (HUD number 30 drawn by `35-hud.js`), `p2_c3a_hint_t1.png` | 2026-10-07 10:26-10:36 | 11094443 |
| Toast (A16, mock (a) in the real notifications window) | class-exact mock, computed styles | card 320 x 76 (measured 308 x 73 at the entrance's scale .962, the hidden window does not tick), radius 30, no outline or border, Steam's animation list (`toastEnterVR`, `toastExitVR` hashed names) untouched, panel tint, title 20/600, body 18/400, logo 48 | — | 2026-10-07 10:28 | 11094443 |
| G-PAD on the bar | View x2 (frame menu, then bar), Right x8, Left x8, `FocusApplicationRoot()` | Every bar item reached in Steam's order in both directions with wrap (Home, +, Playspace, Room View, Streaming, pill, avatar); each shows the light (+.32 spot/arc) or, on white Room View, the glow; no outline anywhere; focus returned to main | — | 2026-10-07 10:33 | 11094443 |

New strings drawn by C3a (PLAN §1.15): none (numerals only).

## Requests

- [ ] REQ C3a->C3b: CC concept text for C3a's area, to PLAN §1 (details and numbers in `docs/phase2/wp/C3a.md`, "PLAN §1 conformance" and "Acceptance tests"). (1) Mockup table: `-bar` = "six states in two input modes: Playspace open, rest, laser hover with tooltip, gamepad focus on the pill, on a plain disc beside the selected Steam circle, on the white Room View disc"; `-hud` = "HUD at Steam's placement (default) and the 12° option behind `hudPlacement` (off); two banners". (2) §0, §1, §2.1 hp row, §6 Placement and Shape rows, §11.4 V1, A15: the HUD ships at Steam's placement (S21); 12° / 0.82 m only behind the flag. (3) §3.1: avatar slot 64 × 72 (E-BAR); widths ≈ 728 pp (no tabs) / ≈ 856 pp (two); tooltip row = thick capsule filling the 400 × 40 host (40 tp, 18 Semibold), 0.8 s via P3's wrapper. (4) §3.2 and §9: D-CC6 replaced by PLAN §1.4 (+ .28, static .16 spot, arc ×1.5, no scale, no contact shadow; white / coloured / art discs: outer glow only; selected = .18 + top arc + dot); press = glow only, Steam's press transform kept (R6); white fills on `fade` (VP P-57); laser looks keyed on `html.lgs-input-laser`. Delete the "visibly larger and haloed" sentence (use the measured values). (5) §3.4: bar popups are **panel** glass (§1.6), one column (300 pp host), 64 pp rows 5 pp apart, 22 pp glyphs, E-MENU in pp, destructive rule by count. (6) §8: card 320 × 76 at Steam's x 20 (inset untouched); remove the time label (not Steam's, new string, 15 tp < G-TYPE floor); TwoLine = 2 × 18 tp, card 80; 3 px presence ring; header icon 18 tp; swell 1 + 12/320. (7) §2.3: add a tooltip row (CSS shadow only, clipped on the bar host: inner cues; wearer owner + 5 mm). (8) §10: add a tooltip row (T1 tint .80 + edges; T5 `thick` cover on `tooltip`, surface pending P6). (9) §13: replace A3–A6, A15, A16, A25 (bar part), A26 with the versions in C3a.md (A25: G-FOCUS criteria instead of "≥ 25 / ≥ 15 + scale"); add C3a-HINT, C3a-TIP, C3a-MOT. (10) §11: add Owner and Test columns (PLAN §4.5 ledger reads them); C3a's rows are listed in C3a.md. (11) §2.2 / §14: CC-M's legends are in the in-window ornament (§1.10), not Steam's floating footer.
- [ ] REQ C3a->C3b: shared mockup files. (1) `control-center-build.js` `buildBar`: avatar slot `width:60px` → 64 (E-BAR); C3a's page currently overrides it. (2) `--cc-glow` follows P4's final `--lgs-white-glow` (REQ C3a->P4: the §1.4 literal fails P-16 on the bar render). (3) FYI: `control-center-bar.html` no longer uses `.mrow` (bar menus use the kit's `.lgk-row` with page-local pp sizes), and it draws the E3 lobe locally rather than loading `window-nav-shared.css`.
- [x] REQ C3a->C1a: WN text for C3a's area. (1) §3.5.3: the floating hint capsule is **40** popup px tall, radius 20 (the `floatingfooter` host is 600 × 40 and clips to its content box; 44 does not fit). (2) §5.5: the card sits at x 20, y 2 of the quad (Steam's `inset: 0 0 0 20px` stays); icon discs: dark glyph on green and orange, white on blue and red; incoming call: green fill with **dark** text; achievements: art as a rounded square; no time label. (3) §5.6: on the bar's `tooltip` host the 48 px capsule becomes the host's full 40 tp (= 48 main px at m .83), 18 Semibold; Steam closes the host at once (no 0.2 s exit there). (4) §8.1 / §8.4 rows "Toasts, hint, window-bar row, tooltips": tooltips are **thick** (PLAN §1.13), the others panel. (5) AT-18: use the C3a.md A16 + AT-18 row (inset, TwoLine, no outline, `toastExitVR`, G-TYPE 16.2 tp). **C1a answer (2026-10-07, session 2):** merged (1) §3.5.3 40 px / radius 20, (2) §5.5 inset, icon discs, dark call text, rounded-square achievements, no time label, (3) §5.6 the bar host's 40 tp capsule, no exit, (4) §8.1/§8.4 tooltips thick, others panel (also §3.5.2's frame-control tooltips), (5) AT-18 = your A16 + AT-18 row, owner C3a.
- [x] REQ C3a->P4: `--lgs-white-glow` (`0 0 18px 2px white .30`, PLAN §1.4) measures +4.1 L in VP P-16's 8–16 px band on a white 56 pp bar disc (`shots/p2_control-center_bar.png`, twin A/B; scripts and numbers in C3a.md "Measurements"); P-16 / G-FOCUS need ≥ +20. Tested: 18/5/.42 → +10.6, 18/8/.45 → +17.6, **22/8/.55 → +23.1** (dim room +27.1), 16/10/.50 → +24.7. Please set the token to a value that passes (C3a's mockup shows 22/8/.55) and record it in tokens.md; C3b's `--cc-glow` mirrors it. **P4 (2026-10-07):** done, your 22/8/.55: `--lgs-white-glow` = `0 0 22px 8px white .55` with parts `--lgs-white-glow-blur/-spread/-a` so the bar can scale blur and spread by `--lgs-m-bar` (contracts/tokens.md §1.6); the `--lgs-ill: white` hook uses it.
- [x] REQ C3a->P6: surfaces for C3a's quads. PLAN's P6 card lists `notifications` and `volumelevel` in `theme/layers/00-base.json`; today it defines main, bar, barpopup, frame.menu, floatingfooter only. C3a needs (M4): `notifications` (key `valve.steam.gamepadui.notifications`, `panel`, cover `%{ShortTemplate}`), `volumelevel` (`panel`, cover `%{VolumeSliderLabel>VolumePopin}`, capsule) and `tooltip` (prefix `valve.steam.gamepadui.tooltip.`, `thick`, cover `%{PopupBody>Tooltip}`, capsule). Please add them to 00-base.json, or answer that C3a should define them in `theme/layers/30-bar.json` (C3a will also declare `owns: ["bar"]` there for the three-shape bar cover). **P6 (2026-10-07):** done in `00-base.json`: `notifications` (key, `panel`, cover `%{ShortTemplate}` with `all`), `volumelevel` (key `valve.steam.gamepadui.volumelevel`, `panel`, `%{VolumeSliderLabel>VolumePopin}`, capsule), `tooltip` (prefix `valve.steam.gamepadui.tooltip.`, `thick`, `%{PopupBody>Tooltip}`, capsule). Each carries the new surface field `"flag": "wp.c3a"` (contract reporter.md §3.1): reported only while your package flag is on, so RP-1 and native sessions without C3a are unchanged. Define the bar's three shapes in `30-bar.json` with `owns: ["bar"]`.
- [x] REQ C3a->P10: `glass.py cmp` for popup quads. C3a's mockups draw quads at `--pop-scale` (bar and bar popups ×1.2, toasts ×1.107, HUD ×1.93) with no `mockOrigin` window. Please let `<PKG>-cmp.json` give a mockup scale and origin per mapping (or per file), e.g. `{"mockScale": 1.2, "mockOrigin": [x, y]}`, so mockup rects in view px compare with live surface px. The bar mockup repeats `data-id`s in six rows; `--rects` keeps the first (row A), which is fine if documented.
  - P10 (2026-10-07 06:00): done. `glass.py cmp` accepts `{"mockups": {"<stem>": {surface, route, pre, mockOrigin, mockScale, map}}}`, chosen by `--name` or the mockup's file stem; top-level fields are defaults; a map value may be `{sel, surface, mockOrigin, mockScale}`; selectors take `@text=`, `@last`, `@nth=N`. A repeated `data-id` keeps its first occurrence. contracts/lab.md §3.
- [x] REQ C3a->P10: G-SIZE on `bar` lists Steam's pill glyphs (`%{QuickAccessButton} %{PopupBody>StatusItem}`: headset
  battery, volume, Wi-Fi, the bell) as targets (P-80 18 x 18, P-08). They are `Panel Focusable` by class but
  `focusable: false` in Steam, and a click bubbles to the pill (`docs/inventory/bar.md` §1.2); stock shows the same
  findings (`gates bar --only size --stock`, 2026-10-07 09:57). The pill is one target (CC §3.1, 232 x 80 live). Please
  add them to `lab/exemptions.json` (e.g. an `E-BAR` entry judged on the closest `%{QuickAccessButton}`) or skip
  descendants of a target whose own `focusable` is false. C3a's T2 already tags the disc slots `data-lgs-exempt="E-BAR"`.
  - P10 (2026-10-07 session 4): done, the second way, from Steam's own data: a Panel rendered `Focusable` whose
    Panel props say `focusable: false` and that has no activation handler of its own (read from its React fibers
    up to that Panel: `onClick`, `onActivate`, pointer/mouse/touch down/up, the gamepad button handlers; probe of
    the live pill: the glyphs carry only `onContextMenu`, the pill `onClick` + `onActivate`), inside another
    control, is part of that control's target: SIZE lists it as `skipped: part of its host` and judges the pill
    whole (it is no longer a container). Native buttons and anything with its own handler (a bell with its own
    `onClick`, if Steam ever gives it one) stay targets. No E-BAR entry needed. `gates bar --only size --flags
    wp.c3a --mode laser` (11:10): **PASS**, 0 findings, 5 exempt (your E-BAR slots), 3 glyphs part of the host;
    `--stock` (11:16): the same 3 glyphs part of the host, the pill passes; the 5 findings left are Steam's small
    bar buttons (48 px, stock only). contracts/lab.md §4 SIZE.
