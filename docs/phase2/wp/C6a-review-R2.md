# C6a Steam Settings: review R2 (quick review)

Reviewer: independent agent, quick review (about 20–30 minutes, user-visible blockers and majors only; no native
session, no removal sweep, no perf, no full conformance). Package card: PLAN §2.4 "C6a Steam Settings"; builder's
log `docs/phase2/wp/C6a.md` (Status "READY: wp.c6a"). Steam build `11094443`. Files under test (md5, unchanged since
the builder's 10:53 save): `theme/60-settings.css` 56b5214c, `device/rt/60-settings.js` 01963e3f,
`theme/layers/60-settings.json` f82b8617. Main route: `/settings/system`; main mockup: `settings-system.html`.

An earlier, deeper R2 pass on the same file hashes (13:58–16:05, cut off) is kept below as an **appendix** for its
evidence. Only the findings in this top section count toward this verdict; the appendix's other items are outside a
quick review's scope (polish, other routes, card scope and process) and are left to the builder and V1.

## Status

**Done** (16:25–16:50). Device left: theme on, CSS only; every step used `--flags` and `--mode` (popped at the lock
exit); no hover, no dialog or menu opened, no setting touched; no `hv` frame taken. Shots (CDP captures of the main
window, no room imagery): `shots/p2_c6a_q_sys_laser.png`, `shots/p2_c6a_q_sys_pad.png`.

## Verdict

**fix.** 1 blocker, 1 major. On the main route the package looks and works like the mockup in both input modes, and
every gate passes; but destructive confirmations opened from Settings are never tagged, so in native mode they pop
forward like ordinary alerts (PLAN §1.7 rule 4), and one of them restarts the device.

## What was run

All with `--flags wp.c6a,wp.c1a,wp.p3` (`wp.p3` is the input-mode stub; `wp.c1a` gives the window and toolbar the
page sits in). Each step's line says `native=off`.

| Command | Result |
|---|---|
| `gates main --route /settings/system --mode laser --shot p2_c6a_q_sys_laser` (16:39) | **PASS**: MOTION, SIZE, TYPE, OUTLINE, AUD all 0 findings (AUD 13 exempt; SIZE skipped 1 obscured and 2 clipped rows that scroll clear) |
| `gates main --route /settings/system --mode pad --shot p2_c6a_q_sys_pad` (16:40) | **PASS**: the same five gates, 0 findings |
| `pad-bfs --route /settings/system --mode pad` (16:40, default 150 s budget) | Exit FAIL only because the sweep was **TRUNCATED** by its budget (46 nodes, 255 moves, 165 s). **0 irreversible moves.** Entry focus: the System pill. 16 sidebar pages reached in order (System to In Game) with their content; the 38 unreached focusables are the sidebar's later pages (Compatibility to Developer) and the lower System rows, i.e. budget, not a dead end. Left from a sidebar pill leaves main for the frame menu and comes back (`exit:none`, back by overlay), as on stock in the earlier pass. B from the entry follows Steam's history |
| Static read: `device/rt/60-settings.js` lines 216–224, `device/rt/22-menus.js` `tagDestructive` (lines 437–450), `theme/layers/22-presentations.json` `exclude` | B1 below |

### Shots against the mockup

`settings-system.html` (side by side in the appendix's `shots/p2_cmp_c6a_r2_system.png`) against the two new shots:
the same 400 px sidebar of 72 px pills with colour circles and group gaps; the centred compact hero (60 px grey circle
with Steam's gear and a Title 1 "System"); recessed platters with C4a's value capsules and the "Check For Updates"
capsule; the "Settings" Large Title with the Back circle; the quiet legend under the glass. Laser: the selected
System pill is a lighter fill, no outlines. Pad: the focused and selected System pill is clearly brighter, with A / B
glyphs in the legend. Text is legible; nothing overlaps or clips except rows scrolling under the bottom scroll-edge
fade. Differences a user would see, none a break: no About / Updates drill-down rows (T3 not built; documented
fallback is Steam's single long page), no System badge, the 520 px search capsule straddles the sidebar and the pane
(C1a's, REQ C6a->C1a open), and a thin light streak just above the selected pill (polish, appendix m1).

### Key functions

Laser: G-AUD PASS (no GONE, HIDDEN, SHRUNK or UNCLICKABLE on the page; the sidebar, the language and update-channel
value capsules, Check For Updates, Hostname and the rows stay Steam's own nodes and hit-test as clickable). Pad:
pad-bfs reaches every sidebar page it had time for, their content rows and the search field, with no irreversible
move. C6a hides and moves nothing in the DOM (read of `60-settings.js`: attributes and style properties only).

## Findings

### Blocker

- **B1. Destructive confirmations opened from Settings are not tagged, so they pop +10 mm in native mode (PLAN §1.7
  admission rule 4, "never a destructive confirmation"; SET §5 rule 3; reporter.md §1 gives `data-lgs-destructive`
  to C1c and C6a).** C6a's tag pass scans only the page content: `root.querySelector(S.sel.content)` then
  `button.DialogButton` (`60-settings.js` lines 217–224), never the open `ModalPosition`. C1c's `tagDestructive`
  (`22-menus.js` 437–450) tags only Steam's `.Destructive` buttons and the confirm of a dialog opened from the Power
  menu. Settings' confirmations carry neither, so C1c's alert rule (`22-presentations.json`, `exclude:
  ".DialogButton.Destructive, [data-lgs-destructive]"`) pops them like any alert:
  - Audio "Reset" (tagged on the page) opens a `GenericConfirmDialog` whose plain "Confirm" (default focus) resets the
    audio config **and restarts the device** (`SteamClient.System.RestartPC()`, webpack module 97849, read in the
    earlier pass);
  - System "Hostname" opens an alert whose "Change & Restart" is not tagged, although
    `Settings_System_Change_Hostname_Set` is in C6a's own label list (line 34): that button exists only inside the
    dialog;
  - Internet network details "Forget" (inside the dialog).

  The earlier pass measured it in native mode on these same file hashes: `sgcheck /settings/system --pre <open
  Hostname>` gave `main: 1 pops, depths [0.0, 10.0] mm, modal ['c1c-alert']`; `sgcheck` "passes" only because its
  destructive check reads the same missing tag. **Fix (C6a T2):** run the label scan on the top modal card as well,
  and tag the `.Primary` confirm of a dialog opened within a few seconds of a click on a tagged page button (as C1c
  does for Power), so C1c's existing `tagDestructive` flattens the card (`data-lgs-plate="thick"`). Recheck: open
  the Hostname and Audio Reset dialogs with `--flags wp.c6a,wp.c1a,wp.p3,wp.c1c` and close them by Cancel; in one
  `native-session`, `sgcheck` each with the dialog open: expect no `c1c-alert` pop.

### Major

- **M1. In native mode the hero stays popped while it scrolls under the toolbar row.** Earlier pass, native probe on
  these file hashes: at `scrollTop` 24 and 40 on `/settings/system` the `settings-hero` crop stays at +10 mm (slab,
  hole, contact shadow) at CSS y 92 and 76, inside C6a's own scroll-edge fade and over the bottom of the search
  capsule; it drops only from 56 on. So after a small scroll a half-faded circle, cut by a strip of the search
  capsule, floats 10 mm in front of the page. SET §5: the compact hero "slides under the top edge". **Fix:** drop
  the pop as soon as the content is scrolled (`scrollTop > 0`: remove `data-lgs-hero`, or add a rest attribute the
  rule excludes), then `sgcheck --pre <scrollTop 24>`: expect 0 pops.

### Not counted (seen, outside a quick review)

- The `pad-bfs` FAIL is budget truncation only (above); a full-budget run against `--stock` is V1's.
- Gates fail on other settings routes (type on Bluetooth, Game Recording, Home, Family, Developer, Friends; size on
  Storage, Family, In Game, Notifications): appendix §1.1, M3–M5. Not the main route.
- Steam's own 86 px page slide between sidebar pages is untouched (appendix M1): stock motion, not a break.
- T3 (drill-down, list page, P-S2), the System badge, the inline title and the M0 re-render are not done (appendix
  M7, M8): the builder documents fallbacks; scope, not a user-visible break.

## Requests

(none: this review edits no other file; B1 and M1 are in C6a's own files.)

---

# Appendix: earlier R2 pass (interim, cut off at 16:05; same file hashes)


Reviewer: independent agent (review R2). Package card: PLAN §2.4 "C6a Steam Settings"; builder's log
`docs/phase2/wp/C6a.md` (Status "READY: wp.c6a", 11:40, last touched 12:42). Concept: `docs/phase2/concepts/settings.md`
(SET). Steam build `11094443`. Files under test (md5 at 13:58 and again at 15:33, identical on the Frame):
`theme/60-settings.css` 56b5214c, `device/rt/60-settings.js` 01963e3f, `theme/layers/60-settings.json` f82b8617.
Nothing in the builder's log was taken on trust; every finding below was measured live or read from code, and says
which. Raw JSON, probe scripts and outputs: `<scratchpad>/c6a_r2/` of this review session. Kept shots:
`shots/p2_c6a_r2_*.png`, `shots/p2_cmp_c6a_r2_system.png` (CDP captures of the main window; no room imagery is kept;
the composites over `docs/phase2/mockups/assets/room-*.jpg` used for the legibility judgements stay in the scratch).

### Status of that pass (superseded by the quick review above)

**In progress, session 2** (resumed 15:32 after a usage-limit cut at about 15:14; last update 16:05). Session 1 ran
13:58–15:14. The device is heavily shared: another agent's native session (from about 15:54) contaminated a batch of
CSS-tier steps, which are being re-run behind a guard that waits for `mode != native`. Every CSS-tier verdict below
comes from a step whose `step:` line and result say `native=off`.

Pending (queued): gates on the remaining route/mode pairs, `conformance` (laser), `perf --ab stock` on System and
Notifications, the `--media contrast` shot, one `native-session` (Audio Reset confirm `sgcheck`, scrolled-hero `hv`
look and `sgcheck`, native `conformance`), and full-budget `pad-bfs` (System themed vs stock, Audio).

Device state so far: theme on, CSS only after each of my steps; every step used `--flags` (no flag of mine left); every
dialog and menu I opened was closed by its Cancel (value unchanged, modal count back to 0); session 1's two `hv` frames
were viewed and deleted at once on both machines.

### Verdict (interim, list not final)

**fix.** 1 blocker and 9 majors so far. The sidebar, the compact hero, the page keys and colours, the focus and
selection looks, removal and fail-closed behaviour are good and pass live. But destructive confirmations opened from
settings pages pop +10 mm in native mode against the safety rule (PLAN §1.7 rule 4); several routes fail G-TYPE,
G-AUD, G-SIZE or P-23; Steam's 86 px page slide is untouched; the hero stays popped while it slides under the
toolbar; and the card's T3 work, M0 and most card tests are absent while the log says READY.

### 1. What was run

All steps through `python glass.py …` with `--flags wp.c6a,wp.c1a,wp.p3` (plus `wp.c1c` for dialogs and menus) and
`--mode pad|laser`. "CSS-only" = the step line said `native=off`.

| Id | Command | Result |
|---|---|---|
| R-G | `gates main --route /settings/<page> --json`, both modes, 24 pages | Table in §1.1 |
| R-F | `focus main --route /settings/system --pairs <pad pairs>` (pad) and `<laser pairs>` (laser), 14:21 / 14:25 | **PASS.** Pad: P-14 Internet row focus vs rest +91.9 L (row), +98.9 L (right of label); P-15 System focus+selected vs selected +67.3 / +72.8 L. Laser: T-SEL selected vs hovered +42.4 L (right of label) / +37.0 L (row); P-03 hover vs rest +14.5 L (in 10–25). Shots `p2_c6a_r2_focpad_{0,1,2}`, `foclaser_{0,1}` |
| R-ACC | `js "$(cat docs/phase2/concepts/settings-accept.js)(<12 routes>)"` × 2, laser (T-ACC, T-ROWS) | **0 of 24 routes pass** (§2 M7) |
| R-RM | `js removal.js` with the flags, after the flag step, and with `--stock` | **PASS.** With flags: `data-lgs-page` 25, `-hero` 1, `-title` 1, `-destructive` 1, 1 style property, module installed. Flag popped: all 0, module "off flag wp.c6a is off". `--stock`: all 0, no runtime |
| R-IDLE | `js idle.js` (system, then `/library/home`) | Install 0.5 ms; **0 DOM mutations** in 3 s idle; but the 300 ms tick runs on every route: 0.185 ms per tick on `/settings/system`, 0.075 ms on `/library/home` (m3) |
| R-DES | `js destr.js` (11 pages): which buttons carry `data-lgs-destructive` | System Factory Reset, Audio Reset, Developer Format / Clear All / Change User Password, Remote Play Unpair: tagged. Internet "Delete" (Web Browser Data): **not** (m2) |
| R-DLG | `js dlg_host.js` (laser), `js dlg_audio.js` (pad), `--flags …,wp.c1c` | Hostname alert: Cancel / Change & Restart, both `.Secondary`, no tag, no plate. **Audio Reset confirm: Confirm (`.Primary`, default focus) / Cancel, no tag, no plate.** Both: card 640 wide, centre (640, 328), buttons 60 tall, scrim black .35 (T-DLG geometry PASS). Closed by Cancel, modals back to 0 |
| R-SRC | `js src.js`, `js src2.js` (read-only webpack source text) | Hostname dialog (module 14160): two plain `DialogButton`s. **Audio Reset (module 97849): `GenericConfirmDialog` whose `onOK` resets the audio config then calls `SteamClient.System.RestartPC()`.** Network details (module 45935): "Forget" runs `accessPoint.Forget()` from inside the dialog. Settings page transition: `translateY(±12%)`, 320 ms `cubic-bezier(0,0,.1,1)` after 80 ms; exit `translateY(∓8%)` 80 ms (`trans.js`) |
| R-MENU | `js menu_tz.js` (laser), `menu_power.js` (pad), `menu_lang.js` (laser), `--flags …,wp.c1c` | Timezone (64 options): C1c's single scrolling column 560 × 508 at x 264–824, y 108–616, scroll 4918 / 508, focus on the current value, source capsule white .94, Cancel at the end of the scroll. Power (6 + Cancel): compact 64 px rows, slab 400 × 472 at x 556–956, **left of** the capsule (972–1222). Language (31): column at x 396–956. **No list page.** Every value unchanged after Cancel |
| R-LEG | `js leg_storage.js`, `leg_display.js` (laser, gamepad focus given with `L.gpTake`) | Storage: the ornament is a capsule with Uninstall (X), Move Content (Y), Back; each `elementFromPoint` hits it. Display: More Info (Y), Select, Back, each hit. SET S12 and S13 have a laser path (C1a's ornament) |
| R-P23 | `shot … --pre` reading the focused rect (pad) | `/settings/system` entry: System row [16, **108**, 368, 72]. `/settings/storage` after 4 × Down: Proton row [416, 597, 848, 58], bottom **655** (§2 M6) |
| R-BFS | `pad-bfs --route /settings/{system,audio,notifications}`, themed (pad, laser) and `--stock`, default 150 s budget | Truncated on both sides; same exits, same irreversible edge as stock (Back → Down → Output Device on Audio, Back → Down → toast toggle on Notifications), same B effect (Steam's history). Full-budget runs: pending |
| R-NAT1 | `native-session` 14:38–14:41, steps in `native_run.py` | §1.2 |
| R-SHOT | `shot main p2_c6a_r2_<page>` (CSS-only): system (both modes), sys_scroll, storage, audio, notif, sidebar_end, gamerecording, home, family, friends, developer | §1.3 |

#### 1.1 Gates (CSS-only)

| Route | Pad | Laser |
|---|---|---|
| system | **PASS** | pending |
| internet | **PASS** | AUD GONE "Other network…" (14:12; re-run pending) |
| storage | SIZE 10 (sort 156 × 28; art 98 × 45 nested) | same |
| bluetooth | TYPE 2 ("NOT CONNECTED" 10 px, uppercase, 0.05 em) | same |
| display | pending | pending |
| power | **PASS** | pending |
| audio | pending | pending |
| controller | **PASS** | pending |
| keyboard | pending | **PASS** |
| accessibility | **PASS** | pending |
| security | pending | pending |
| notifications | SIZE 4 (E-SWITCH on `%{ParentalWrapper}`, hit 62 % own) | same |
| friends | TYPE 2 (preview friend 15 px / 400, 12 px) | same |
| downloads | **PASS** | **PASS** |
| cloud | **PASS** | pending |
| ingame | SIZE 2 (link "Steam Networking" 24 px tall, P-80 / P-08) | pending |
| compatibility | pending | pending |
| family | SIZE 2 (link 19 px) + TYPE 2 (16 px / 400) | pending |
| remoteplay | **PASS** | pending |
| gamerecording | TYPE 8 (15 / 14 px) + **AUD SHRUNK** `%{RecordingModeOption}` 952 × 73 → 816 × 70 | pending |
| home | TYPE 2 (12 px; body 20 on 2 lines) + **AUD SHRUNK** 2 text runs | pending |
| library | **PASS** | pending |
| store | **PASS** | pending |
| developer | TYPE 1 (16 px) + AUD SHRUNK (text 952 × 23 → 816 × 19) + OUTLINE (Developer pill top edge ratio 0.559, taken while the list was still scrolling: see m1) | pending |

MOTION passes at rest on every route measured (0 running, no `lgs-*` left).

#### 1.2 Native (P7 complete)

Session 1, one `native-session` (14:38–14:41), `--flags wp.c6a,wp.c1a,wp.p3` (+ `wp.c1c` for the modal steps):

- `sgcheck /settings/system` (laser): **PASS**, main 1 pop, depths {0, 10} mm.
- Hero probe (`js_hero.js`, `__LGS_LAYERS.snapshot()` / `debug('main')` at `scrollTop` 0, 24, 40, 56, 72): the
  `settings-hero` layer is kept at scroll 0, **24 and 40** (texture y 174, 138, 114, i.e. CSS y 116, 92, 76; dz 0.0271,
  liquid slab, hole, `interactive: false`) and is dropped only from 56 on ("covered": the search field is under its
  centre). `sgcheck --pre <scrollTop 40>`: PASS, 1 pop at 10 mm (M2).
- `sgcheck /settings/storage` (pad): PASS, 0 pops (no hero on Storage, as designed).
- `sgcheck /settings/system --pre <open Hostname>` (pad, `wp.c1c`): `main: 1 pops, depths [0.0, 10.0] mm, modal
  ['c1c-alert']`, PASS only because nothing in the alert is tagged (B1).
- `sgcheck /settings/power --pre <open the first dropdown>`: 1 pop, modal `c1c-menu` at 10 mm, hero dropped (rule 6). PASS.
- `hv c6a_r2_sys --look` (laser): glass L 81.1 (55–110), top edge "none" (ratio 0.0), doubling 0.357 (not doubled);
  `--offaxis 30`: glass L 71.9, edge none, doubling 0.391. Looked at: the window reads as clear glass over the room,
  sidebar pills and platters legible, the hero circle in front of the page; verdict withheld by the tool (auto rect).
  Both frames deleted at once (local look folder and Frame `/tmp/lgs/hv-*`).

Static check of `theme/layers/60-settings.json` against `contracts/reporter.md` §3–§4: version 2, fragment flag
`wp.c6a`, one rule `settings-hero` on an absolutely placed `::before` (P6 crops only those), `r` 30 on a 60 × 60 circle
(rule 5), `mm` 10 in the allowed set, slab `liquid`, `hole: true`, no `interactive`, `wearer.mm` 10 (PLAN §1.7 row
"Settings hero icon": +10 in both profiles). Decorative, so rule 2 sets no cap. P-48: the CSS circle carries
`--lgs-shadow-10mm` (`0 4px 12px`, 0.4 px/mm and 1.2 px/mm). Nothing in the fragment keeps the pop off the scroll-edge
band under the toolbar row (M2), and C6a sets no `data-lgs-destructive` inside modals (B1).

#### 1.3 Visual verdict (CSS-only shots, composited over the lounge and studio rooms)

- **System, Audio, Notifications, Friends (top), Home (top):** this is close to visionOS Settings: a 400 px sidebar of
  72 px pills with colour circles and group gaps, a centred compact hero (60 px circle with Steam's own glyph and a
  Title 1), recessed platters and C4a's controls. Legible over both rooms. `p2_cmp_c6a_r2_system.png` against
  `settings-system.html`: same sidebar, hero and platters; differences are the drill-down rows (not built), the
  search capsule (C1a's, straddling the sidebar), the 816 px column and the missing System badge.
- **Every selected pill:** the "specular arc" is a separate light streak 4 px above the pill that starts outside the
  pill's rounded left corner (`pill_zoom.png`, every shot): it reads as a detached hairline, not as an edge of the
  material (m1).
- **Game Recording:** reads as a skin: the three mode cards keep Steam's 15 / 14 px type, their fills are barely
  visible, and the unselected radio pips (black .30) almost vanish over the dim room (M3).
- **Family, Home's last row, In Game:** body text 12–16 px, in-text links 19–24 px tall, the Family primary is a plain
  left-aligned capsule rather than the page's tinted primary (M3, M5).
- **Storage:** Steam's layout with new colours: an 8 px usage bar, a 28 px "Size on Disk" sort control, 58 px rows that
  run to the glass edge and under the ornament when focused (M5, M6, m5).
- **Scrolled System (scrollTop 40):** the hero circle slides up under the search capsule and is cut by it; nothing
  takes over the title (no inline title), so the page has no title once scrolled (M2).

### 2. Findings

#### Blocker

- **B1. Destructive confirmations pop +10 mm in native mode (PLAN §1.7 admission rule 4, SET §5 rule 3 "the safety
  rule", reporter.md §2.4).** C1c's alert rule pops every alert unless it holds `.Destructive` or
  `[data-lgs-destructive]` (`22-presentations.json` `exclude`; `22-menus.js` `tagDestructive` flattens the card only
  when a button is already tagged). For settings, the tag is C6a's job (reporter.md §1: "C1c, C6a"; SET §4.7: "An alert
  whose buttons include a tagged or `.Destructive` button is tagged too"). But `setTick` scans only the page content
  (`60-settings.js` lines 217–225: `root.querySelector(S.sel.content)` → `button.DialogButton`), so nothing inside a
  modal is ever tagged, and the confirm that follows a tagged button is not tagged either:
  - **Hostname** (System): "Change & Restart" (`Settings_System_Change_Hostname_Set` is even in C6a's token list, but
    the button exists only inside the dialog). Live: no tag, no plate; native `sgcheck`: `main: 1 pops, depths [0.0,
    10.0] mm, modal ['c1c-alert']`.
  - **Audio Reset**: the page's "Reset" is tagged (`srcTag: true`), but the `GenericConfirmDialog` it opens has a
    generic "Confirm" (`.Primary`, default focus) whose `onOK` resets the audio config **and restarts the device**
    (`SteamClient.System.RestartPC()`, module 97849). Live: no tag, no plate, so it pops like the Hostname alert.
  - **Network details** (Internet): "Forget" runs `accessPoint.Forget()` from inside the dialog (module 45935); never
    tagged (source read; not opened live, because a wrong row could start a connection).
  `sgcheck` passes in all of these because its destructive check reads the same tags, so G-DEPTH cannot see the
  problem. Fix in C6a's T2: scan the top `ModalPosition` too (Hostname, Forget, and any other label of SET §4.7 inside a
  dialog), and tag the confirm of a dialog opened from a tagged source within a few seconds (as C1c does for Power),
  so C1c's existing `tagDestructive` flattens the card; then re-run `sgcheck` with each dialog open.

#### Major

- **M1. Steam's settings page transition is untouched (VP P-54 must, P-58; SET §7 row 1; PLAN S3).** Each sidebar
  step slides the whole content `translateY(±12%)` (≈ 86 px of a 720 px page) over 320 ms
  `cubic-bezier(0,0,.1,1)` after an 80 ms delay, and exits 8 % in 80 ms (Steam's CSS, read live). SET §7 gives C6a the
  override (≤ 12 px on `page`, old content out in 150 ms); C1c's `23-transitions.css` covers only
  `TopLevelTransitionSwitch` and `GamepadTabbedPage`. Not built, and not listed under "Not built".
- **M2. The hero stays popped while it slides under the toolbar row.** Native probe: at `scrollTop` 24 and 40 the
  `settings-hero` crop stays at +10 mm with its slab and hole at CSS y 92 and 76 (circle 76–136), inside C6a's own
  scroll-edge fade (transparent at 84, opaque at 116) and over the bottom of the search capsule (y to ≈ 88); it drops
  only from 56. So at rest after a small scroll a half-faded circle with a strip of the search capsule floats 10 mm
  in front over a full slab and contact shadow. SET §5: the hero is a compact header that "slides under the top edge".
  In CSS the circle is visibly cut by the search capsule and no inline title takes over (`p2_c6a_r2_sys_scroll.png`).
  Fix: drop the pop (remove `data-lgs-hero` from the rule's match, or add a rest attribute) once `scrollTop > 0`.
- **M3. G-TYPE fails on six routes (P-38, P-84 must), both modes where measured:** Bluetooth "NOT CONNECTED" 10 px
  uppercase 0.05 em (SET §4.8: 18 px Semibold title case; C6a only recolours it); Game Recording 8 runs at 14–15 px
  (C6a restyles `%{RecordingModeOption}` but leaves Steam's type); Home 12 px description and a 20 px body on two lines;
  Family 16 px / 400 body and link; Developer 16 px "Steam Play is enabled…"; Friends & Chat preview friend 15 px / 400
  and 12 px (SET §4.8: a 48 px avatar and name). T-ACC adds Storage "TOTAL ON-DISK CLIPS / SCREENSHOTS" 12 px uppercase
  0.5 px tracking.
- **M4. G-AUD SHRUNK (functions-kept gate) on three routes:** Game Recording `%{RecordingModeOption}` (a control)
  952 × 73 → 816 × 70; Home two text runs (370 × 20 → 379 × 16, 563 × 17 → 568 × 14); Developer one text run 952 × 23 →
  816 × 19. Internet laser had a GONE "Other network…" row in session 1 (re-run pending).
- **M5. G-SIZE fails on four routes (P-80, P-08 must):** Storage: the sort control "Size on Disk" 156 × 28 (hit 55 %),
  each row's art `%{LibraryItemBox}` 98 × 45 as a nested target (SET §4.8 makes the sort a value capsule; that is T1
  work, not the T3 row height); Family and In Game: in-text links 19 and 24 px tall; Notifications: E-SWITCH on
  `%{ParentalWrapper}` (hit 62 % own over 86 × 80) in both modes. The last one is filed as REQ C6a->C4a (2), which C4a
  has not answered (no mention in `C4a.md`); until it is, Notifications cannot reach M2.
- **M6. P-23 (must; PLAN §4.4 bounds 124 / 612) fails on C6a's own layout.** The sidebar list starts at y 108, so the
  gamepad entry focus on `/settings/system` is [16, 108, 368, 72] (conformance `--pad`: "1 focused rect outside y
  124..612"), on every visit. Storage keeps the stock list height and runs to y 720 with no 628 cut: a focused row
  reaches [416, 597, 848, 58], bottom 655, under the ornament capsule (y 628–712) that shows Uninstall / Move Content
  exactly then; conformance found 4 such rects. SET §3.5: "A focused row always stays above y 628".
- **M7. The card's scope is not delivered, yet the log says READY.** PLAN §2.1's definition of done is "every acceptance
  test in the package card passes". Not built: the T3 P-S1 wrapper (drill-down, VR Settings page; S16, S17, E6), the
  list page for value menus over 8 options (PLAN §1.12, decision 9: Timezone, Language and Download region open C1c's
  scrolling column instead, R-MENU), P-S2, the System badge, the inline title, Storage T3. Not run by the builder:
  T-ACC, T-ROWS, T-DRILL, T-AUD per view, T-CNT, T-HIT, T-MENU, T-SHOT on 24 routes, T-MOT, T-PERF, T-FONT, T-A11Y,
  T-I18N, T-T3, P-S1/S2/S4. Measured here: **T-ACC 0 of 24 routes pass** (column 880 > 762 on all, because the 816 px
  column is drawn as an 880 box with 32 px padding; `searchCircle` on all (C1a's capsule); `rowsAtTop` on System,
  Internet, Storage, Power, Downloads, Family, Game Recording and Developer: 3 rows / 241 px at scroll 0 against ≥ 4
  rows or ≥ 260 px; type as M3). T-MENU: the ≤ 8 slab sits **left of** its capsule, not right-aligned (+8) as PLAN
  §1.12 and SET §4.5 require (anchoring is C1c's code; C6a never ran T-MENU, so no REQ exists).
- **M8. M0 and G-MOCK not done.** No `C6a-cmp.json`, no `data-id` in any `settings-*` mockup, `settings.md` unchanged
  since the round started, so concept and mockups still show a hidden legend (E-ORN, withdrawn by PLAN §1.10), a .26
  selection (S18), a 760 column, the magnifier circle and flat menus (§1.7). The log's "M0 note" table is not M0
  (PLAN §2.1: the concept text and mockups updated and re-rendered). `glass.py cmp` side by side only (§1.3).

#### Minor

- **m1.** The selected pill's arc is drawn on the hit extender 4 px above the pill and starts outside its rounded corner,
  so every shot shows a detached light streak above the selected row. On `/settings/developer` (pad) G-OUTLINE measured
  the pill's top edge at ratio 0.559 ("visible") while the list was still scrolling into place (the row at y 616;
  settled it is at 524–596): the transient is real on every route entry that scrolls the sidebar.
- **m2.** Internet "Delete" (Web Browser Data, SET §4.7) is not tagged; Developer "Format" is tagged though it only
  navigates to Storage (`onClick: () => Settings("Storage")`).
- **m3.** A 300 ms `rt.setInterval` runs on every route for as long as the flag is on: 0.075 ms per tick off settings
  (≈ 0.25 ms/s), 0.185 ms per tick on System (≈ 0.6 ms/s), against RT-7's 1 ms/s for the whole runtime. "Nothing runs
  at idle" is not met; a route listener plus a MutationObserver on the page content would do.
- **m4.** Gamepad focus on a sidebar pill: white label on a white .50 composite (≈ 3 : 1), and the grey icon circle
  disappears into the pill (`pill_pad_zoom.png`).
- **m5.** Storage's usage bar is 8 px (SET: a 24 px capsule) and the drive and sort controls keep Steam's proportions.
- **m6.** P-44 (should): the sidebar's step to the detail pane is < 8 L over the grey and dark rooms (session 1).
- **m7.** `a:is(:hover, .gpfocus, :focus)` (in-text links) has no input-mode scope: one of the bundle's P-01 / P-02
  failures is C6a's.
- **m8.** REQ Coordinator->C6a (R2-5, `coordinator.md` line 240) has no answer; REQ C1a->C6a ×2, C1c->C6a and
  C4a->C6a ×2 are answered only in C6a's own log.
- **m9.** The log's "pad-bfs identical to the stock baseline (4 nodes)" is not reproducible: in the same 150 s budget
  the themed sweep reached 48 nodes and stock 60; both truncated (full-budget runs pending).

Observations for other owners (not counted against C6a): a black "⋯" More circle was captured over the sidebar at
(176, 310) on `/settings/notifications` (14:43, laser; not present in a probe at 14:43 or later): a stale node of C1a's
More helper from another route. The 520 px search capsule straddling sidebar and pane is C1a's (REQ C6a->C1a open).

### 3. Function retention (SET §9)

Everything C6a builds restyles Steam's own nodes; no node is hidden (`display`/`visibility` unchanged), moved in the
DOM or replaced, and the clip-paths cut only content scrolled under the toolbar row or past y 628 (still scrollable).
G-AUD shows no GONE, HIDDEN or UNCLICKABLE on the routes measured except Internet laser (pending re-run).

| SET rows | Laser | Gamepad | Evidence |
|---|---|---|---|
| E1–E5, E7, E9 | as stock (tab bar, bar menus, Back circle) | as stock | not changed by C6a |
| E6, E8 (new) | — not built (VR Settings page, SteamVR Back circle is C6b's) | — | nothing lost: SteamVR stays reachable from the tab bar |
| S1–S4 sidebar, rows | click | Up/Down (selection follows focus), Right, Left, B | pad-bfs, sidebar walk (24 pages in order) |
| S5, S8–S11 controls | click | A | AUD (no UNCLICKABLE), SIZE except M5 |
| S6 dropdowns | click → C1c's slab or scrolling column, Cancel, outside click | A, Up/Down, A; B | R-MENU (values unchanged) |
| S7 sliders | drag / click | Left/Right | Audio gates (pending laser) |
| S12 explainer (Display) | ornament "More Info" (clickable) | Y | R-LEG |
| S13 Storage Uninstall / Move Content | ornament buttons (clickable) | X / Y | R-LEG |
| S14 scroll | wheel / drag | focus scrolls (but M6) | P-23 |
| S16, S17 drill-down (new) | — not built | — | M7 |
| S18 Select / Back legends | quiet legend, never hidden (PLAN §1.10) | A / B | R-LEG |
| §9.3 page functions | Steam's nodes | Steam's nodes | AUD per route (§1.1) |
| §9.4 dialogs | Cancel / Confirm, outside click | Left/Right, A, B | R-DLG |

### 4. Conformance (P-items for this area)

From `conformance --route /settings/system --route /settings/storage --pad` (14:52, pad; the System pass overlapped
another agent's native session, so its P-39 lines are discarded), G-FOCUS and the probes above. Laser and native
conformance: pending.

| Item | Result |
|---|---|
| P-03, P-14, P-15, T-SEL | PASS (R-F) |
| P-08, P-80 | FAIL: Storage, Family, In Game, Notifications (M5) |
| P-23 | FAIL: System entry focus at y 108, Storage rows to 655 (M6) |
| P-38, P-84 | FAIL on six routes (M3) |
| P-35 | alerts centred (640, 328) PASS; menus adjacent (gap 16 px) PASS; anchoring per PLAN §1.12 FAIL (M7, C1c) |
| P-42, P-43 | PASS on 23 routes; m1 |
| P-44 (should) | FAIL over grey and dark rooms (m6) |
| P-46, P-47, P-48 | PASS (1 pop, 60 × 60, shadow 0.4 / 1.2 px per mm) |
| P-52, P-58 | PASS at rest; P-58 FAIL for Steam's page transition (M1) |
| P-54 | FAIL (M1) |
| P-64 | source white .94 while open PASS; rows 72 PASS |
| P-67 | Steam's default focus on "Confirm" in Audio Reset: recorded deviation (PLAN §4.4, S6), not C6a's |
| P-72 | PASS |
| P-86 | scrim .35 PASS |
| P-89 | S12 / S13 legends are visible clickable buttons PASS |
| PLAN §1.7 rule 4 | FAIL (B1) |

### Requests (that pass)

(none: this review edits no other file; the findings name their owners.)
