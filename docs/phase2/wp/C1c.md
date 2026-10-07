# C1c System presentations: evidence log

Package C1c (PLAN §2.4): context menus, popovers, dropdown slabs, alerts, sheets, the Power menu layout and route transitions, on `main` (inventory shell §0.2 recipes CONFIRM, ALERT, MENU, SUBMENU, POWER, ZOO). Concept: `window-nav.md` §5.1–§5.4, §7 (transitions), §9.4, §9.5, §9.7 (file owned by C1a). Steam build at the time of writing: `11094443` (no device step was needed for M0).

## Status

- **Milestone reached: M0** (2026-10-07, session 1).
  - The six C1c mockups are conformed to PLAN §1 and re-rendered: `shots/p2_window-nav_{menu,sort,power,alert,sheet,motion}.png`. Each render was viewed and measured (Evidence below).
  - C1c owns no concept text. C1a's revision 3 of `window-nav.md` already carries most of PLAN §1 in C1c's sections. The remaining deltas (decisions D1–D14 below, the updated acceptance tests and the retention rows) are written out as replacement text in **Appendix A** and requested from C1a (REQ 1).
  - Mockups of other packages that draw menus, alerts or sheets have requests for the C1c recipe (REQ 7–12).
- **Open items that do not block M0** (all filed as requests): C1a to paste Appendix A into WN and to adopt the recipe in `window-nav-shared.css`/`.js` (REQ 1–4); P4 to set the focus-glow token (REQ 5); the coordinator to rule on E-MENU for Cancel, the P-65/P-67 deviations and the P-35 box (REQ 6); P10 to allow several mockups per cmp map (REQ 13).
- **Next: M2 (T1).** Write `theme/22-presentations.css` (menu slab, rows, tones, count classes' CSS, alert and sheet cards, scrim .35 clipped to the glass, modal-state chrome rules) and `theme/23-transitions.css` (route and tab transitions on P5's `lgs-page-*`). Use `theme/_wip/` until `glass.py check-theme` passes; read P4's `contracts/tokens.md` (focus token, glow token) and P5's `contracts/motion.md` (keyframe names) first. Then M3: `device/rt/22-menus.js` (count classes, menu type, source tracking and `--sx..--sr`, anchoring `translate`, destructive tags, Power groups and glyphs, sheet close circle, `html.lgs-modal` on every popup) behind `wp.c1c`. Then M4: `theme/layers/22-presentations.json` (+10 mm crops, destructive alerts flat, superseding the legacy `menu`, `sheet`, `sheet-panel` rules).
- **Static mockup parts to replace later:** the quiet legends in `window-nav-menu/-power/-alert.html` are static markup using C1a's `.wn-orn.quiet`; `window-nav-sort.html` adds `mode-laser` after C1a's builder. When C1a's builder supports quiet legends and laser-mode A/B (REQ 3), switch these to `data-wn="ornament"` and re-render.

### M0 checklist

| Step (task) | State | Where |
|---|---|---|
| 1. Concept text and owned mockups updated to PLAN §1 | Mockups done. Text: C1a owns WN; deltas requested with exact text | Mockups; Appendix A; REQ 1 |
| 2. Acceptance tests updated to §1; retention table complete | Done here, requested into WN §13 and §9 | "Acceptance tests", "Function retention"; Appendix A |
| 3. Mockups re-rendered with `tools/mockshot.py`, viewed, fixed | Done (Evidence E1–E9) | Evidence |
| 4. REQs for mockups not owned | Filed | Requests |
| Evidence log with a Status section | This file | — |

## Requests

- [ ] REQ C1c->C1a: `window-nav.md`, C1c's sections (intro mockup table rows for menu/sort/power/alert/sheet/motion, §5.1.1, §5.1.2, §5.1.3, §5.2, §5.3, §5.4, the §7 storyboard line and sheet row, §9.4, §9.5, §9.7, and §13's C1c rows): please replace them with the text in `docs/phase2/wp/C1c.md` Appendix A. Why: PLAN §1 conformance of C1c's area (leading check, value-menu layout by count, Power strings and measured sizes, alerts and sheets centred on the glass, scrim clipped to the glass, P-65/P-67 notes, storyboard f points, PLAN-1c-1..3, CC A13 and C1c-1..7). C1c does not own the file.
- [ ] REQ C1c->C1a: `window-nav-shared.css`: replace the "menus" and "alerts and sheets" blocks with the C1c recipe (the `<style id="c1c-recipe">` block of `window-nav-menu.html`, minus the `.c1c` prefix and the `.c1c.laser` glyph rule). Why: area mockups that use `.wn-menu` / `.wn-alert` / `.wn-sheet` (`home-apps-library`, `-library-pad`, `settings-dropdown`) still get revision 2 values (focus .30, a trailing `.chk` that pushes the check right, white labels on red, Cancel without the quiet recipe).
- [ ] REQ C1c->C1a: `window-nav-shared.js` `buildOrnament`: with `data-mode="laser"`, keep A and B as quiet members (labels only) and add `mode-laser`; emit `.wn-orn.quiet` without `lgk-glass` when only A and B remain. Why: PLAN §1.10; today laser mode drops A/B, so C1c's mockups draw the quiet legend statically and tag laser mode after the build.
- [ ] REQ C1c->C1a: quiet legend legibility on `window` routes. Its labels sit at y 640–700, mostly below the 656 glass edge, over the room. White .70 Medium is unreadable over a bright room: in `p2_window-nav_alert.png` and `p2_window-nav_power.png` "Select" sits on the curtain (background L 236) and disappears. Proposal (safe default): on `window` routes keep a faint capsule (the `liquid` material at reduced strength) behind a quiet legend, or use the on-room label treatment (VP P-41: white .96 Medium with the on-room shadow); keep §1.10's look on `window-full` routes, where the legend sits on glass. Why: VP P-39, P-41; B must stay readable. Needs a §1.10 note if adopted.
- [ ] REQ C1c->P4: focus glow on white and coloured fills. PLAN §1.4 names `0 0 18px 2px` white .30, but on the alert mockup's focused primary it gives a P-16 band (8–16 px outside the capsule) of only **+11.7 L** (needs ≥ +20). `0 0 24px 6px` white .34 gives **+23.5 L**; `0 0 22px 4px` .34 gives +19.0. Please set one shared token (for example `--lgs-focus-glow`) that passes FD-5 / G-FOCUS and record it in `contracts/tokens.md`; C1c's mockups use `0 0 24px 6px` white .34 meanwhile (E8).
- [ ] REQ C1c->Coordinator: (a) PLAN §1.12 keeps Steam's Cancel item as a 56 px quiet capsule, but E-MENU (§1.16) covers rows "≥ 60 visible" and P-80 asks ≥ 60. Please extend E-MENU to "Steam's appended Cancel item: 56 visible on a 64 px element", or raise Cancel to 60. C1c builds 56 meanwhile, because §1.12 says so explicitly. (b) Please record two VP deviations in §4.4: **P-65** (an outside click keeps cancelling alerts and sheets, because that is Steam's `ModalClickToDismiss` and removing it would change a function; default kept, see D9) and **P-67** (alerts keep Steam's default focus, S6). (c) **P-35** asks alerts and sheets to be centred on the glass ± 24 px; WN said "centred in the modal box" (centre 368, 40 px off). C1c centres them on the glass and caps sheets at 488 px tall on `window` routes (552 on `window-full`), see D7. Please confirm.
- [ ] REQ C1c->C3b: `control-center-power.html` and `control-center-power-confirm.html` still show revision 2 values. Per PLAN §1.12, §1.7, §1.8 and S6: the Power menu is WN §5.2's two-column slab, 592 px wide (see `window-nav-power.html`), at +10 mm, with Steam's default focus, and the focused row a red whole fill with a #0d0e12 label. The Power confirmation is flat (0 mm: it holds a destructive button), its confirm capsule red with a #0d0e12 label, and focus stays where Steam puts it (not moved to Cancel). The dim is the scrim at .35 clipped to the glass (no `t1`), and the search field has no microphone. Please align these mockups, or crop them to CC's entry point and point to `window-nav-power.html` / `window-nav-alert.html`.
- [ ] REQ C1c->C2c: `home-apps-library.html` (tile menu at +30 mm), `home-apps-library-pad.html`, `home-apps-filter.html`: menus at +10 mm (PLAN §1.7); layout by count (6 actions compact, 5 one column of 72 px); Cancel a 56 px quiet capsule; laser hover = + .08 and a spot (not the focus look); the source card at 0 with a glow unless it was the gamepad-focused card; the Filters sheet ≤ 960 wide, centred on the glass, at +10 mm. The recipe is the `c1c-recipe` block in `window-nav-menu.html`.
- [ ] REQ C1c->C6a: `settings-dropdown.html` and `settings.md` §4.5–§4.6, §5: dropdown slabs pop to +10 mm (PLAN §1.7 replaces SET §5's 0 for menus, popovers and dropdown slabs; list pages stay at 0). Cancel is a 56 px quiet capsule (§1.12; SET says 60). Layout is always by count: an 8-option value menu takes the two-column grid, because 8 rows of 72 px need 624 px. The leading check is kept and C1c adopts it for every menu. `settings-dialog.html`: alerts at +10 unless destructive (0), centred on the glass, with #0d0e12 text on red fills.
- [ ] REQ C1c->C4a: `controls.md` §8.2 and `controls-pickers.html`: value-menu depth +10 mm (PLAN §1.7; the 2 mm material-only slab is withdrawn); the current value's check in the leading 28 px slot (C1c rule; the mockup already draws it there, the text says trailing); Cancel a 56 px quiet capsule.
- [ ] REQ C1c->C5a: `game-pages-manage.html`, `-manage-sub.html`, `-playfrom.html`, `-running-exit.html`, `-vrbind-confirm.html`: menus at +10 mm; Cancel a 56 px quiet capsule (GP §3.4 says 60); destructive rows by the count rule, with a #0d0e12 label on the red focus fill; confirmations that hold a destructive button (for example "Exit game?") stay flat at 0 mm; laser hover vs gamepad focus as PLAN §1.4. GP §3.4's placement order is adopted unchanged.
- [ ] REQ C1c->C7: `social-media-people-menu.html`, `social-media-people-depth.html`: draw the friend menu with the C1c recipe: +10 mm, layout by count, Cancel 56 quiet, hover vs focus looks, destructive rule by count, #0d0e12 on red focus fills.
- [ ] REQ C1c->P10: `glass.py cmp` reads one `docs/phase2/wp/<PKG>-cmp.json` with a single `route`/`pre`/`map`. C1c compares five mockups (menu, sort, power, alert, sheet), and each needs its own `pre` (MENU, the Sort snippet, POWER, CONFIRM, ZOO). Please accept `{"mockups": {"window-nav-menu": {surface, route, pre, map}, …}}` (or a `--map KEY` option) and document it in `contracts/lab.md`. The proposed map is under "Live selectors for cmp" below.

## Requests to C1c, handled

None so far: `grep -n "REQ [A-Za-z0-9]*->C1c:" docs/phase2/wp/*.md` found nothing at the start (04:21) or the end of session 1.

## Decisions taken at M0 (PLAN §1 applied to C1c; §1.17 rule where §1 is silent)

| # | Topic | Decision | Source | Changed in |
|---|---|---|---|---|
| D1 | Laser vs gamepad looks in menus | Laser: `:hover` under `lgs-input-laser` = + .08 and a .12 spot at the pointer, no arc, no lift. Gamepad: `.gpfocus` / `%{Focused}` under `lgs-input-pad` = + .28, a static .16 spot in the upper third, the row's arc ×1.5. WN rev 2's "hover moves Steam's focus, so hover looks the same" is withdrawn | §1.4; IM D-7 [PROVEN] | menu, sort (laser), power, alert, sheet (gamepad) |
| D2 | Checked value | A check (24 px, stroke 3) in the row's **leading** 28 px slot, no fill; every row of a value menu reserves the slot. Reconciles WN/CTL text (trailing) with SET §4.5, the CTL and SET mockups and visionOS menus | §1.12 (C1c owns value-menu look, §1.1) | sort |
| D3 | Text on coloured fills | #0d0e12 label and glyph on green and red (Play row, focused destructive row, red confirm); white only on blue (Install, Primary). The row's glyph takes the label's colour | §1.12, CC §7 | menu, power, alert inset |
| D4 | Focus on a coloured or white fill | Blurred outer glow; the mockups use `0 0 24px 6px` white .34 because §1.4's value fails its own P-16 band criterion (E8; REQ 5) | §1.4, VP P-16 | power, alert |
| D5 | Cancel | Steam's item kept as a 56 px quiet capsule: white .08, Medium 22 px white .70; grid menus drop the extra 6 px margin (the row gap separates it) | §1.12, HA-11 | all menus; REQ 6a |
| D6 | Source card while its menu is open | Laser (opened from the More circle): the hover ended, so the card is 0 mm with a CSS glow and the 60 px More circle is white. Gamepad (☰ on the focused card): the card keeps +15 | §1.7 table, §1.11 | menu |
| D7 | Alert and sheet position | Centred on the **glass** (VP P-35 ± 24), not on the 108–628 modal box: alert centre y 328 on `window` routes (360 on `window-full`); sheets top-aligned at 108 and ≤ 488 tall on `window` routes (≤ 552 on `window-full`), content scrolling inside. T1 pads `ModalPosition`'s bottom (never its top/bottom position) | VP P-35; LAB never-touch list | alert (centre 328.4), sheet (centre 344) |
| D8 | Scrim | Steam's `.ModalOverlayBackground` at black .35, no blur, in both modes, **clipped to the route's glass shape** (`window`: 1280 × 656 r 54; `window-full`: 1280 × 720; `windowless`: the whole quad r 54), so the ornament margin and corners never darken the room. Menus: no scrim. No `t1` | §1.8 | alert, sheet |
| D9 | Outside click on alerts and sheets | Kept as Steam's (cancel), with B. VP P-65 says an outside click should not close alerts and sheets; removing Steam's dismissal would change a function, so the safe default keeps it. A guard flag `modalOutsideGuard` (off, not built at M0) is reserved should the coordinator decide otherwise | §1.17 rule; VP P-65; REQ 6b | text only |
| D10 | Default focus | Steam's everywhere (Power: Restart Steam VR, its preferred focus; ConfirmModal: the Primary). P-67 deviation recorded | S6 | power, alert |
| D11 | Layout by count also for value menus | "Up to 8 options: a slab anchored to its capsule" is **placement**; layout still follows the count table (≤ 5 one column, 6–7 compact, 8–14 grid, ≥ 15 scrolling column; settings routes > 8: C6a's list page). 8 rows of 72 px need 624 px > 520 | §1.12 | text only (REQ 1, 9) |
| D12 | Power strings | Steam's live labels: Sleep, Shutdown, Restart Device, **Restart Steam VR**, Change Account, Sign Out, Restart Steam, Cancel (inventory shell §4, social §8). Group labels "This Device" and "Steam" are new T2 strings, drawn only when the UI language starts with `en`; otherwise space separates the groups | §1.15 | power |
| D13 | Menu headers | Steam's own header text is kept (Power: "Power"; tile menu: the game's name, inline in compact). Steam leaves the Sort menu's header empty; T2 copies the source's own label ("Sort By", Steam's Y legend string). Settings dropdowns copy the row's label (SET §4.5) | §1.15 | sort |
| D14 | Motion storyboard | Re-scoped to C1c's interactions (menu morph-open, alert present, sheet present, sheet dismiss, route change) and sampled at the G-MOTION points f = 0, .15, .35, .5, .75, 1. The search sheet (C1b) and the toast (C3a) left the board | §1.5, §2.3 P10 `motion`, D2 §11.9 | motion |
| D15 | Morph start rect; glassd's part | `clip-path` cannot reach outside the slab, so T2 carries the source rect to the slab's nearest edge at the source's height (tile menu: a 60 × 60 r 30 start at the slab's left edge level with the More circle). glassd v3 has no morph (`contracts/glassd.md` §6): in T5 the slab materializes in place on its `phase` while the CSS clip-path draws the morph, and on close glassd dematerializes it (CSS close is instant, MO R4) | MO §6.4, R9; glassd contract §6 | motion |
| D16 | Chrome while a modal is open | Toolbar contents .45 (clickable), the tab bar darkened, the ornament lit. The tab bar sits in another popup, so C1c's T2 sets `html.lgs-modal` on every popup while main's ModalManager holds an alert or sheet; C1c's CSS keys on it. No C1a file is touched | WN §5.3; §1.8 | alert, sheet |
| D17 | Tile menu content on this device | An uninstalled game: Install (blue) + Add to Favorites, Add to ›, Manage ›, Developer ›, Properties... = 6 actions → compact. An installed game has no primary in Steam's menu (inventory library §7) → 5 → one column of 72 px rows. Steam's separator before Properties... becomes 6 px of space | §1.12; inventory library §7 | menu |

**New strings (PLAN §1.15)** for V2's list: "This Device", "Steam" (Power group labels, English only). Copied, not new: "Sort By" (Steam's legend), dropdown headers (the row's label), "Options" (C1a).

## Acceptance tests (conformed to PLAN §1; to replace C1c's rows in WN §13)

All steps use LAB's locked atomic forms with P10's options (`--flags wp.c1c`, `--mode laser|pad`, `--media`), `FocusApplicationRoot()` first in gamepad sequences, the pointer back to (1400, 900) after a hover, and never press A on Steam's nodes, confirm, launch, change a setting or pick a power item. Synthetic menus and dialogs come from inventory shell §0.2. Native steps run in `glass.py native-session`.

| Id | Test | How | Pass |
|---|---|---|---|
| AT-8c | Focus vs checked (menus) | MENU pre with a CheckItem (checked) and focus on the next row, `--mode pad`; `glass.py focus` pairs | Focus ≥ checked + 15 L and ≥ rest + 40 L; the checked row has no fill; the check sits in the leading slot |
| AT-11 | Menu anchor and dismiss (gate R13) | MENU pre via `showContextMenu(menu, anchorEl)` with a known source; slab and source rects; a CDP click on `%{*…>ModalClickToDismiss}` outside the slab; then the same with `wp.c1c` off: `L.pad` order down/up through the items | Slab edge 16 ± 2 px from a card source (P-35: gap ≤ 40); ornament sources: left edges aligned (± 2), bottom ≤ 620; `m_rgModals.length` restored; the D-pad visits the same items in the same order with T2 on and off. Else: centred placement ships (still morphing) |
| AT-11b | Menus fit | MENU pre with 5, 6, 7, 8, 10, 14 and 15 items; the Sort snippet on AllGames (look only, then B); Downloads Options if an item exists (look only); POWER (look only) | The class matches the count table (≤ 5 none, 6–7 `lgs-menu-compact`, ≥ 8 `lgs-menu-grid`, ≥ 15 value options `lgs-menu-scroll`); `scrollHeight == clientHeight` up to 14; Cancel inside the slab; slab ≤ 520 tall and ≤ 600 wide; 15: one scroller of two-line rows in a 560 × 520 slab with the current value in view |
| AT-12 | Grid menus' D-pad and default focus | POWER and the Sort menu (look only): `contextMenuContents`'s nav node `m_Properties.layout`; `L.focused()` right after open, with `wp.c1c` on and off; `L.pad` down/right/up/left | Records GEOMETRIC or column; every item reachable; Cancel last; the item focused on open is the same with T2 on and off (S6). **Never press A** |
| AT-13 | Alerts and sheets | CONFIRM, ALERT, ZOO('Text Prompt'), ZOO('Scroll Panel Test'), `--mode pad` and `--mode laser`; `styles` on the scrim, `#header` children, buttons, card; `elementFromPoint` at the Back circle's centre; a CDP click on the sheet's close circle (lab dialog: no action) | Scrim black .35, no blur, painted only inside the glass shape (margin luma under the ornament = the no-modal shot ± 3 L); no `t1` tint node; header contents .45 and Back still hit; alert 640 wide, centre within 24 px of the glass centre; sheet ≤ 960 × 488 (window routes); buttons 60 px capsules in Steam's order, `DialogTwoColLayout` a row; text on red and green fills #0d0e12; the close circle closes the dialog (`m_rgModals.length` restored) |
| AT-14 | Depth (native) | Native session: `__LGS_SG.dump()` and `glass.py sgcheck` with MENU, CONFIRM, CONFIRM-D (below), ZOO sheet, each opened from a focused poster and from a hovered one; `glass.py sg_timeline`-style capture of the menu's dz | Menu, non-destructive alert and sheet crops at 10 mm ± 2 (live S × r), `interactive: false`; CONFIRM-D: no crop, a flat `thick` plate; every other in-page pop dropped while the modal is up, except a source card that was the gamepad-focused card (+15); ≤ 4 distinct dz (+1 for the modal); the menu's dz follows `depth` 0 → 10 within 0.5 mm; none above 15 mm unless `interactivePops` |
| AT-15 | Motion | `glass.py motion main --pre …` for: MENU open, CONFIRM open, ZOO sheet open and close, a route change (AllGames → a collection → back), a library tab change; `getAnimations()` after 1 s; route changes every 50 ms (CQ6) | Durations and easings are tokens (P-58); 0 running and no `lgs-*` 1 s after (§1.5); filmstrips `shots/p2_motion_c1c_<interaction>_<f>.png` at f = 0, .15, .35, .5, .75, 1 show glass before content on entry and content before glass on exit, no text scaling, no closed outline; animated depth ≤ 20 mm; clip-path only on ≤ 600 × 600; route enter ≤ 800 ms with delay, exit ≤ 200 ms |
| AT-19 | Accessibility | `--media reduce` and `--media contrast` on MENU, CONFIRM, a sheet and a route change | Reduce: opacity only, 150–200 ms, no scale, translate, clip-path or depth animation; glassd `reduceMotion: true`. Contrast: opaque glass with the 2 px edge. No Steam setting touched |
| AT-21 | Type | `styles` sweep over menus (all count classes), Power, dialogs, sheets | No `font-size` < 18 px; no weight < 500; no uppercase, tracking or italics; red labels only at ≥ 22 px Semibold (P-40) |
| AT-23 (C1c part) | No outline on glass | `shot main` with MENU, POWER, CONFIRM and a sheet up; `window-nav-measure.py edge` on each slab's top edge | Ratio ≤ 0.35 (mockups 0.00–0.22, E7); no border, outline or 1 px ring (P-42) |
| CC A13 | Power, look only | POWER + `audit main` with it; `L.pad` through every row in both columns (never A); `--mode pad` and `--mode laser` (CDP hover on two rows) | 0 GONE / SHRUNK; 7 items + Cancel in Steam's order; slab ≤ 520 × 600; focus visible on every row (destructive rows: red fill, #0d0e12 label, glow band ≥ +20 L); group labels present only when the language starts with `en` |
| PLAN-1c-1 | A destructive confirmation never pops | CONFIRM-D = CONFIRM with `bDestructiveWarning: true` and C1c's test hook tagging its OK button `data-lgs-destructive` (the tag a Power confirmation gets); CSS-only: P6's report; native: `sgcheck` | No crop for the alert in either profile; native: one flat `thick` plate; the CSS look is the red confirm with a dark label |
| PLAN-1c-2 | G-MOTION filmstrips | = AT-15 for menu morph, alert and sheet; compared with `window-nav-motion.html` | Each frame's glass/content progress within ± 10 % of the storyboard's values at the same f |
| PLAN-1c-3 | Looks like the design | `glass.py cmp` of live MENU (tile menu via the More circle), the Sort menu, POWER, CONFIRM (the mockup's strings) and ZOO sheet against `window-nav-menu`, `-sort`, `-power`, `-alert`, `-sheet` (map below) | Named rects within ± 8 px or the difference explained here; both images viewed and a verdict recorded (G-MOCK) |
| C1c-1 | Input-mode looks in menus | MENU with `--mode pad` (focus on row 2), then `--mode laser` with a CDP hover + 80 ms dwell on row 3 while Steam's stale `.gpfocus` stays on row 1 | Pad: focus ≥ rest + 40 L, first frame ≥ 60 %; laser: the hovered row + 10 to + 25 L, and **no** focus fill on the stale `.gpfocus` row (P-02) |
| C1c-2 | Focus returns to the source (P-21, G-PAD) | Focus a poster, ☰ (`vgp_onmenu`) → MENU; B; `L.focused()`. The Sort menu from the Y legend (look only); B | Focus back on the same poster after each; B closed only the topmost layer (P-24) |
| C1c-3 | Dismissal | Menus: B, an outside click, Cancel. Alerts and sheets: B, the close circle, an outside click | Each closes the topmost layer; outside clicks on alerts and sheets cancel exactly as stock (D9) |
| C1c-4 | Source turns white | While MENU (from the More circle), the Sort menu (from slot 1) and POWER (from the tab) are open: the source's computed background | White .94 with a dark glyph while open; restored on close |
| C1c-5 | Route transitions never block input | A route change; at 300 ms a CDP click on an element of the new page; `getAnimations()` on `TopLevelTransitionSwitch` children | The click reaches the new page's element; translate ≤ 16 px (0 in T1); nothing left at rest |
| C1c-6 | Strings | `--flags wp.c1c` with the UI language read from `LocalizationManager`; POWER | Group labels drawn only for `en*`; every drawn string is listed in this log |
| C1c-7 | Removal | `lgs off` after MENU, CONFIRM and POWER runs; `outline main`; `status` | No `lgs-menu-*`, `data-lgs-*`, `html.lgs-modal`, `--sx..--sr` or `translate` left on Steam's nodes; ModalManager untouched (G-REMOVE) |

Global gates on C1c's surfaces (§4.1, §4.2 row "CONFIRM, ALERT, MENU, SUBMENU, POWER, ZOO dialogs"): G-AUD, G-PAD, G-SIZE (E-MENU; Cancel per REQ 6a), G-TYPE, G-OUTLINE, G-FOCUS, G-MOTION, G-PERF (MENU open/close 5×, CONFIRM 5×), G-DEPTH, G-HV (`hv` with MENU and CONFIRM up, `--offaxis`), G-MOCK, G-REMOVE, G-A11Y, G-FONT, in both input modes, CSS-only and native.

## Function retention (C1c rows; to replace WN §9.4, §9.5, §9.7)

Audit ids from `audit/shell-nav.md` §A.6–§A.8, `audit/system.md`, `audit/library-apps.md`, `audit/game-pages.md`, `audit/social-media.md`. Laser path first, gamepad path second; "same" = unchanged.

### §9.4 Modals, alerts, sheets

| # | Function | New place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| M1 | Confirm / cancel | 640 px alert centred on the glass; capsules in Steam's order (Primary blue; `.Destructive` and Power confirmations red with a #0d0e12 label); an outside click cancels (Steam's, D9) | Click | Left/Right + A; B (same) | T1 (+T2 tag) | C1c | AT-13 (Steam's handlers; never confirmed) |
| M2 | Single-button alert | One full-width 60 px capsule | Click | A / B | T1 | C1c | AT-13 (ALERT) |
| M3 | Text prompt | 64 px recessed field with the focus ring | Click → keyboard | Focus + A → keyboard (tests never type) | T1 | C1c | AT-13 (ZOO 'Text Prompt') |
| M4 | Scroll a long dialog | Sheet ≤ 488 tall on `window` routes; `ModalPosition` / `%{ScrollPanel}` scroll; content fades under the card's edge | Wheel / drag | D-pad (same; the FocusRing as P4's light plate) | T1 | C1c | AT-13 (ZOO 'Scroll Panel Test') |
| M5 | Header and footer during a modal | Toolbar contents .45, still clickable; tab bar darkened (`html.lgs-modal`); the ornament lit with the dialog's legends (capsule or quiet, §3.4) | Same | B to the dialog (same) | T1 + T2 | C1c (C1a chrome) | AT-13 |
| NEW-3 | Close a sheet with a visible control | 60 px close circle at (24, 24) in the card, dispatching Steam's click-outside cancel | Click | B | T2 | C1c | AT-13, C1c-3 |
| LA A.4 | Library Filters dialog | Sheet (content: C2c) | Click | D-pad + A; B | T1 | C1c (frame), C2c (content) | AT-13; PLAN-2c-2 |
| GP | Game-page modals (Exit game, Uninstall, …) | Alert or sheet by size; destructive ones flat | Same | Same | T1 | C1c | AT-13, PLAN-1c-1 |
| — | App-details overlay | Scrim .35, content on `sheet-in` | Same | Same | T1 | C1c | AT-13 |
| CC P9 | Confirm a Power action | Flat alert, red confirm capsule with a #0d0e12 label, Steam's default focus | Click (never in tests) | Left/Right + A; B | T1 + T2 | C1c (look), C3b (CC entry) | PLAN-1c-1, CC A13 |

### §9.5 Context menus, Power, dropdowns

| # | Function | New place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| C1 | Choose an item | Slab grown from its source; layout by count, no scroll up to 14 items | Click (the row under the laser lights; Steam's focus does not follow it) | D-pad + A (geometric in the grid if Steam declares no layout) | T1 + T2 | C1c | AT-11b, AT-12, C1c-1 |
| C2 | Open a submenu | Row with ›; Steam's submenu beside it; the open parent white | Click | A or Right (same) | T1 | C1c | AT-11b (SUBMENU) |
| C3 | Toggle a checked item | Row with the check in its leading slot | Click | A | T1 | C1c | AT-8c |
| C4 | Dismiss | Cancel, a 56 px quiet capsule (last); an outside click | Click | B (same) | T1 | C1c | AT-11, C1c-3 |
| C5 | Scroll a long menu | Value menus of ≥ 15 options: one scrolling column of two-line rows (560 × 520); settings routes > 8: C6a's list page | Wheel | D-pad | T1 | C1c, C6a | AT-11b |
| C6 | Open the menu of the thing I looked at | The More circle inside the card or row (C1a); the menu grows from it | Click | ☰ (same) | T2 | C1a, C1c | WN AT-26, AT-11 |
| SY A.5 | Power: Sleep, Shutdown, Restart Device, Restart Steam VR, Change Account, Sign Out, Restart Steam, Cancel | Two-group Power menu, 592 × 470; Steam's order and default focus; each item opens Steam's own confirmation or flow | Click | D-pad + A; B | T1 + T2 | C1c | CC A13, AT-11b, AT-12 (look only; never A) |
| CC P0 | Power from Control Center | The same menu, opened by CC's Power circle (CC closes first) | Click | Pad to CC, then A | T3 | C3b (entry), C1c (menu) | CC tests |
| GP A.3, A.4 | Manage menu, Play-from menu | Same slab, placed by GP §3.4's order | Click | D-pad + A | T1 + T2 | C1c, C5a | GP AT-MENU |
| SY S6 | Settings dropdown values | Same slab, right-aligned to the dropdown, the value checked; > 8 options: SET's list page | Click | A, Up/Down + A, B | T1 + T2 | C1c, C6a (list page) | SET T-MENU |
| LA sort | Sort By choices | Two-column slab grown up from the white Sort button | Click | Y → D-pad + A | T1 + T2 | C1c | AT-11b |
| SM D6 | Downloads item Options (8) | Two-column slab, Uninstall a red label at rest (≤ 2 destructive) | Click (More circle) | ☰ | T1 + T2 | C1c, C7 | AT-11b |

### §9.7 Page transitions

| # | Function | New place | Laser | Gamepad | Tier | Owner | Test |
|---|---|---|---|---|---|---|---|
| A.8 | Route changes gate input for ~800 ms | Exit 150 ms linear; enter on `page` (662 ms) after ≤ 40 ms with ± 16 px (T2 direction; 0 in T1), inside Steam's React timeouts; nothing blocks input | — | — | T1 (+T2) | C1c | AT-15, C1c-5 |
| LA tabs | Library and search tab content changes | ± 16 px + fade on `page` (replaces Steam's ± 40 % slide) | Click a tab | LB / RB | T1 | C1c | AT-15 |

## Live selectors for cmp (proposal; becomes `C1c-cmp.json` once REQ 13 is answered)

| Mockup | `pre` | `data-id` → live selector |
|---|---|---|
| `window-nav-menu` | Tile-menu snippet (inventory library §7) on AllGames | `menu` → `%{*BasicContextMenuModal>contextMenuContents}`; `menu-label` → `%{*BasicContextMenuModal>BasicContextMenuHeader}`; `row-install` → first `%{*…>contextMenuItem}`; `cancel` → last `%{*…>contextMenuItem}`; `more` → `.lgs-more`; `legend` → `#Footer` |
| `window-nav-sort` | Sort snippet (inventory library §6.2) | `menu`, `menu-header`, `row-checked` → the `%{*…>Selected}` item, `cancel`, `legend` |
| `window-nav-power` | POWER | `menu`, `menu-header`, `group-device`, `group-steam` → `.lgs-pm-group`, `row-focus` → `.gpfocus`, `cancel`, `legend` |
| `window-nav-alert` | CONFIRM with the mockup's strings (title "Install Tidebreaker?", body as drawn, OK "Install") | `alert` → `%{*GamepadDialogContent_InnerWidth>GamepadDialogContent}`; `alert-title` → `.DialogHeader`; `alert-body` → `.DialogBodyText`; `btn-ok` → `.DialogButton.Primary`; `btn-cancel` → `.DialogButton.Secondary`; `scrim` → `.ModalOverlayBackground`; `legend` → `#Footer` |
| `window-nav-sheet` | ZOO('Scroll Panel Test') | `sheet` → the dialog card; `close` → `.lgs-sheet-close`; `scrim`; `legend` |

## Evidence

All renders: `python tools/mockshot.py docs/phase2/mockups/window-nav-<name>.html shots/p2_window-nav_<name>.png` (1920 × 1080), viewed after each change. Rects: a scratch Playwright script reading `[data-id]` rects against `.lgk-overlay` (window px). Luma: `docs/phase2/concepts/window-nav-measure.py` (709) unless noted (601 = VP SHOT).

| Test | Command | Result | Files | Date | Steam build |
|---|---|---|---|---|---|
| E1 menu render | mockshot `window-nav-menu.html` | Compact slab 400 × 502 at (522, 124), bottom 626 ≤ 628; 6 rows on a 64 px pitch; Cancel 158 × 56; More circle 60 at (436, 222) inside the card (inset 10); quiet legend centred (x 640) | `shots/p2_window-nav_menu.png` | 2026-10-07 | n/a (mockup) |
| E2 sort render | mockshot `window-nav-sort.html` | Grid slab 592 × 508 at (347, 108), bottom 616; left edge 8 px left of the Sort button (rows aligned); widest label "% of Achievements" 213 px in a 214 px slot (no ellipsis); A/B kept in laser mode, no glyph badges | `shots/p2_window-nav_sort.png` | 2026-10-07 | n/a |
| E3 power render | mockshot `window-nav-power.html` | 592 × 470 at (24, 146), bottom 616; Steam's preferred focus (Restart Steam VR) red fill, #0d0e12 label; the Power tab white | `shots/p2_window-nav_power.png` | 2026-10-07 | n/a |
| E4 alert render | mockshot `window-nav-alert.html` | 640 × 261 at (320, 198): centre y 328.4 vs glass 328 (P-35); scrim 1280 × 656 inside the glass only | `shots/p2_window-nav_alert.png` | 2026-10-07 | n/a |
| E5 sheet render | mockshot `window-nav-sheet.html` | 960 × 472 at (160, 108): centre y 344, 16 px from the glass centre (P-35); close 60 at (24, 24) in the card | `shots/p2_window-nav_sheet.png` | 2026-10-07 | n/a |
| E6 storyboard | mockshot `window-nav-motion.html` | 5 rows × 6 frames (f 0, .15, .35, .5, .75, 1); glass leads content on entry, content leads glass on exit (sheet dismiss f .35: content 13 %, glass 22 %); morph overshoot 1.0 % at f .75 (b .20) | `shots/p2_window-nav_motion.png` | 2026-10-07 | n/a |
| E7 AT-23 edges (mockups) | `window-nav-measure.py edge` on each slab's top edge: menu `190 882 1202`, sort `174 707 1219`, power `212 384 896`, alert `264 680 1240`, sheet `174 520 1400` | Ratios 0.22, 0.13, 0.12, 0.01, 0.00: all PASS (≤ 0.35) | renders above | 2026-10-07 | n/a |
| E8 G-FOCUS (mockups) | `window-nav-measure.py dl`; 601 luma for P-16 band (scratch script: mean of the 8–16 px band outside the capsule, focused vs unfocused button) | Power focused row vs rest **+61.8 L** (709; +74.2 with 601) (P-14 ≥ 40 PASS); sheet focused chip vs rest **+50.9 L** (601: 115.1 vs 64.2) PASS; sort laser hover vs rest **+22.4 L** (601, P-03 10–25) PASS; alert P-16 band with §1.4's `0 0 18px 2px` .30: **+11.7 L FAIL**; with `0 0 24px 6px` .34: **+23.5 L PASS** (adopted in the mockups; REQ 5) | `shots/p2_window-nav_power.png`, `-sheet.png`, `-sort.png`, `-alert.png` | 2026-10-07 | n/a |
| E9 quiet legend legibility | 601 luma of the room behind "Select" in the alert render | Background L 236 under white .70 labels: unreadable (REQ 4) | `shots/p2_window-nav_alert.png` | 2026-10-07 | n/a |

---

## Appendix A. Replacement text for `window-nav.md` (C1c's sections; REQ 1)

C1a: paste each block over the named part of revision 3. Values come from the M0 renders above.

**A.1 Intro mockup table, the six C1c rows**

| Shot | Source | Owner | Shows |
|---|---|---|---|
| `shots/p2_window-nav_menu.png` | `window-nav-menu.html` | C1c | Laser mode: Steam's 6-action tile menu (developer mode adds Developer ›) in the compact layout, 400 × 502, grown 16 px right of its card out of the white More circle; the row under the pointer lit + .08 with the light spot; the card at 0 mm with a soft glow; Cancel a 56 px quiet capsule; the quiet legend |
| `shots/p2_window-nav_sort.png` | `window-nav-sort.html` | C1c | Laser mode: Sort By (10 options) as a two-column menu, 592 × 508, grown up out of the white Sort button; the current sort's check in the leading slot; the hovered row + .08; A and B as quiet members without glyphs |
| `shots/p2_window-nav_power.png` | `window-nav-power.html` | C1c | Gamepad mode: the Power menu, 592 × 470, two groups, grown from the white Power tab; Steam's default focus (Restart Steam VR) as a red whole fill with a dark label |
| `shots/p2_window-nav_alert.png` | `window-nav-alert.html` | C1c | Gamepad mode: a 640 px alert centred on the glass at +10 mm over Steam's scrim (.35, clipped to the glass); the primary focused (outer glow); inset: the destructive variant, flat, with a red confirm and a dark label |
| `shots/p2_window-nav_sheet.png` | `window-nav-sheet.html` | C1c | Gamepad mode: a 960 × 472 sheet (the library Filters dialog) centred on the glass at +10 mm, with its close circle; a chip with gamepad focus |
| `shots/p2_window-nav_motion.png` | `window-nav-motion.html` | C1c | Motion storyboard at f = 0, .15, .35, .5, .75, 1: menu morph-open, alert present, sheet present, sheet dismiss, route change |

**A.2 §5.1.1** — in the table, row "6–7", column Height: "6 actions: **502** (tile menu, measured)". Replace the value-menu table's first row and the shots line with:

| Options | Layout |
|---|---|
| ≤ 8 | **Placement:** a slab anchored to its capsule, right-aligned, below, above or over it (SET §4.5). **Layout** follows the count table above: ≤ 5 one column, 6–7 compact, 8 the two-column grid (8 rows of 72 px would need 624 px) |

Shots: `p2_window-nav_menu.png` (6 actions, compact, laser hover), `p2_window-nav_sort.png` (10, grid, laser hover), `p2_window-nav_power.png` (7 grouped, grid by S24, gamepad focus).

**A.3 §5.1.2** — replace these rows:

| Property | Value |
|---|---|
| **Checked / selected** (`.menuChecked`, `%{*…>Selected}`) | A white check (24 px, stroke 3) in the row's **leading** 28 px slot, the slot action menus use for their symbols; no fill. Every row of a value menu reserves the slot, so labels align (as SET §4.5, visionOS menus and the CTL and SET mockups; revision 2's trailing check is withdrawn). AT-8c measures focus against a real checked row |
| Primary | `.Play`, `.Launch` and the primary first row: green whole fill. `.Install`, `.Update`: blue whole fill. On a coloured fill the row's label and glyph are #0d0e12 on green, orange, yellow and red, white on blue (CC §7) |
| Destructive | **≤ 2 destructive rows**: red label (Semibold) and red symbol at rest. **More than 2** (Power): red symbol, white label at rest. On focus always a red whole fill (`rgb(255 66 69 / .92)`) with a #0d0e12 Semibold label and glyph, the illumination capped at + .04, and the outer glow. Never reordered (SM-D8, S20); Steam's default focus untouched (S6) |
| Focus on a coloured or white fill | A blurred outer glow (P-16), P4's token. PLAN §1.4 names `0 0 18px 2px` white .30; it measures a + 11.7 L band on the alert mockup, so the mockups use `0 0 24px 6px` white .34 (+ 23.5 L) until P4 sets the token |

Mockup values (C1c log E8): Power's focused row + 61.8 L over a rest row; the sort menu's laser-hovered row + 22 L over rest (P-03: + 10 to + 25).

**A.4 §5.1.3** — add after "Anchor (T2).": "Ornament sources: the slab's left edge 8 px left of the source's, so its rows line up with the button; its bottom clamped above the ornament (Sort By: y 108–616)." Add after "Morph.": "`clip-path` cannot reach outside the slab, so T2 carries the source rect to the slab's nearest edge at the source's height (the tile menu starts as a 60 × 60, radius 30 shape at the slab's left edge, level with the More circle). glassd v3 draws no morph (`contracts/glassd.md` §6): in T5 the slab's glass materializes in place on its `phase` while the CSS morph plays, and on close glassd dematerializes it; replace 'glassd plays `morph-close` (441 ms)' accordingly."

**A.5 §5.2** — "592 × 464 px" → "**592 × 470 px** (measured)"; "bottom at 616 (top 152)" → "bottom at 616 (top 146)"; the item list uses Steam's live labels: Sleep, Shutdown, Restart Device, **Restart Steam VR**, Change Account, Sign Out, Restart Steam (inventory shell §4). Add: "The group labels 'This Device' and 'Steam' are new strings, drawn only when the UI language starts with `en` (PLAN §1.15). The mockup shows Steam's preferred focus, Restart Steam VR, as the focused red whole fill."

**A.6 §5.3** — replace the Scrim and Chrome rows and add three rows:

| Property | Value |
|---|---|
| Position | **Centred on the glass** (VP P-35, ± 24 px): the card's centre at y 328 on `window` routes, 360 on `window-full`. T1 pads `ModalPosition`'s bottom; it never moves its top or bottom (LAB) |
| Scrim | `.ModalOverlayBackground` in `%{GamepadDialogOverlay}`: black .35, no blur, in both modes, **clipped to the route's glass shape** (`window`: 1280 × 656, radius 54; `window-full`: 1280 × 720; `windowless`: the whole quad, radius 54), so the ornament margin and the corners never darken the room. No `t1` tint (PLAN §1.8) |
| Chrome while open | Toolbar contents at opacity .45 (still clickable, as today); the tab bar darkened; the ornament stays lit with the dialog's legends. The tab bar lives in another popup, so C1c's T2 sets `html.lgs-modal` on every popup while main's ModalManager holds an alert or sheet |
| Dismissal | Steam's: an outside click (`ModalClickToDismiss`) and B cancel. VP P-65 asks that an outside click not close alerts and sheets; Steam's behaviour is kept for function retention and recorded as a deviation (PLAN §4.4) |
| Default focus | Steam's (PLAN S6). VP P-67 asks for the non-destructive choice; recorded as a deviation |

Depth row: "… **0 mm** (a flat `thick` plate in native mode) when the alert contains a destructive button …" (unchanged).

**A.7 §5.4** — Card row: "Thick glass, radius 44, max width 960 (75 % of the glass), **centred on the glass** (P-35): top-aligned at 108 and at most 488 px tall on `window` routes (552 on `window-full`), so its centre stays within 24 px of the glass centre; the content scrolls inside." Motion row: append "`sheet-out` plays in CSS only while Steam keeps the node (MO R4); otherwise the CSS close is instant and glassd dematerializes the slab in place". Add a row "Native flat modals: a destructive alert carries `data-lgs-destructive` (never pops, reporter rule 4) and `data-lgs-plate=\"thick\"` (a flat plate)" to §5.3.

**A.8 §7** — replace the storyboard line: "Storyboard: `p2_window-nav_motion.png`, C1c's interactions (menu morph-open, alert present, sheet present, sheet dismiss, route change) sampled at the G-MOTION points f = 0, .15, .35, .5, .75, 1 (PLAN §2.3 P10 `motion`). The search sheet and the toast are filmed by C1b and C3a."

**A.9 §9.4, §9.5, §9.7** — the three tables in "Function retention" above, as they stand.

**A.10 §13** — C1c's rows: AT-8c, AT-11, AT-11b, AT-12, AT-13, AT-14, AT-15, AT-19, AT-21, AT-23 (C1c part) as in "Acceptance tests" above, plus new rows CC A13, PLAN-1c-1, PLAN-1c-2, PLAN-1c-3 and C1c-1 to C1c-7 (owner C1c).
