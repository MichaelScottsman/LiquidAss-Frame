# C1a Shell chrome: adversarial review R2

Reviewer: independent agent (review R2). Package card: PLAN §2.4 "C1a Shell chrome"; builder's log `docs/phase2/wp/C1a.md`
(Status: READY with `wp.c1a`, M4 claimed 09:08). Concept: `docs/phase2/concepts/window-nav.md` (WN). Steam build `11094443`.
Scratch evidence (JSON, logs, probes): `<scratchpad>/r2/` of this session (`C:/Users/blcha/AppData/Local/Temp/claude/
C--Users-blcha-liquid-glass-frame/9826dd03-.../scratchpad/r2/`). Kept CDP shots: `shots/p2_c1a_r2_*.png` (Steam surfaces
only; no room imagery). Headset frames were looked at and deleted at once on both machines.

## Status

**Complete** (2026-10-07 10:45 – 13:40 EDT, two sittings; the first was cut off at 11:50 and resumed from the scratch
evidence). Verdict: **fix** (8 major, 13 minor findings; no blocker). The device was left as found: theme on in CSS-only
mode (`native-session` reported "back to CSS only: yes"), every step's flags popped by the lab, no flags file key of mine
left, pointer at (1400, 900) after every hover step, no menu or dialog left open (13:35: route `/library/home`, 0
modals, `native` false; the `wp.c1a`/`wp.p3` keys then in `/tmp/lgs/flags.json` belong to other agents' running steps).
Besides this file, only the lab's own captures `shots/p2_c1a_r2_*.png` were written; no package file was touched.
Re-checked 15:15 after a pause (no device change): C1a's files (`theme/20-shell.css`, `theme/layers/20-shell.json`,
`theme/vr/10-systemui.css`, `device/rt/20-shell.js`) and `wp/C1a.md` are unchanged since this review; every request in
"Requests to C1a" is still open; P3's 14:42 edit of `05-attention.js` keeps `attend().off()` silent (no `onLeave`), so
m1 stands; `glass.py status`: theme on, no unresolved tokens. The findings below stand as written.
Re-checked again 16:22 (a quick pass at the user's request): every C1a file still dated 08:33 or earlier (`wp/C1a.md`
11:00); no request to C1a newly answered; `device/defaults.json` still absent and `lgs_layers.js` (edited 13:18) still
applies a fragment's `owns` fields whatever its `flag` (l. 246–283), so M2 stands; under the lab updated since
(`lab_gates.js` and others), `gates vr:systemui --flags wp.c1a --mode pad --only outline` (16:22, `native=off`) still
fails OUTLINE ×2 on `%{ControllerStatusRoot} %{LargeStatusArea}::before` (M1). `glass.py status` afterwards: css-only.

## Verdict in one paragraph

The shell's CSS-only chrome on `main` is solid: route glass modes, the toolbar row, the hugging ornament with its dim-band
quiet legend, the tab bar's two capsules, the More circle and the Options member work, keep every function on both paths,
pass G-AUD / G-SIZE / G-TYPE / G-OUTLINE on the shell's own nodes in both input modes, and remove cleanly. It is not READY:
the SteamVR chrome it owns still draws Phase 1's closed rims (G-OUTLINE fails on `vr:systemui`), the default-flag native
mode draws a square slab around the tab bar, High Contrast misses its gate on the main window, the toolbar on windowless
routes is not glass, the Liquid Glass motion of the shell's own pieces is not built, the focused tab-bar item still
scales, twelve requests addressed to C1a are unanswered (three of them from complete platform packages), and several of
the card's own acceptance tests were never run.

## Findings

Severity per the review brief: blocker = lost function, safety problem or crash; major = a failed gate or test, or a
clear visual or conformance miss; minor = polish. Each finding names its evidence (section "Evidence" below).

### Major

- **M1. `theme/vr/10-systemui.css` draws outlines on SteamVR chrome: G-OUTLINE fails on `vr:systemui` in both modes.**
  The controller status card (§4, lines 265–277) paints Phase 1's `--lgs-panel-rim` (`inset 0 1.5px 0` white .42 +
  `inset 1px 1px 0` + `inset -1px -1px 0`: a closed rim of hard 1–1.5 px lines, P-42/P-43, must). Gate:
  `gates vr:systemui --flags wp.c1a --mode pad|laser` (13:10, `native=off`): OUTLINE FAIL ×2 on
  `%{ControllerStatusRoot} %{LargeStatusArea}::before` (rects 278,516 and 536,516, 220 × 54). Seen on the capture
  (`shots/p2_c1a_r2_vr2_pad.png` over `room-studio`): both cards show a thin light outline round the whole slab. The same
  rim token is on More Options (§3.2, l. 172), the gamepad-mode pill (§3.3, l. 228) and every §5 panel (l. 358–476;
  `--lgs-control-rim`, a 1 px line, on the room-setup buttons, l. 414). More Options also draws a 2 px focus ring on its
  focused row (`inset 0 0 0 2px var(--lgs-focus-outline)`, l. 217: P-17 must) and keeps Steam's 1 px row separators
  "recoloured as hairlines" (l. 167–186: P-43 must). It is not WN §3.5.2's thick glass either (radius 44, 96 systemui px
  rows with 8 px gaps): it is `--lgs-r-menu` panel glass with Steam's rows. Two complete packages filed this (REQ
  C5b->C1a, REQ C6b->C1a): every `vr:systemui` gate run fails for them too. Fix: E4/E5 + the lit top lip (as §3 already
  does for the frame-control capsule) instead of `--lgs-panel-rim` / `--lgs-control-rim`; the focus light recipe of §3
  instead of the ring; separators as space or a ≥ 2 px tone step; thick glass per WN §3.5.2.

- **M2. Native mode with today's defaults draws a square-cornered slab round the tab bar (REQ P7->C1a, open).**
  `theme/layers/20-shell.json` `owns` `frame.menu` and replaces its cover with
  `%{DashboardMenu}%{Variant_FrameMenu} > .lgs-tabcap, %{DashboardMenu}%{Variant_FrameMenu}:not(:has(> .lgs-tabcap))`
  without an `r`. A fragment's `owns` fields apply whatever its `flag` (`device/lgs_layers.js` `mergeFragments`,
  l. 236–283: `flag` gates only rules and `supersedes`). With `wp.c1a` off (the default: there is no
  `device/defaults.json`, V2 has not accepted C1a) there is no `.lgs-tabcap`, so the cover is the whole menu box, and
  C1a's own T1 sets that box to `border-radius: 0` (`theme/20-shell.css` l. 739). The reporter therefore sends a
  radius-0 rectangle the size of the menu box (both capsules and the 10 px gap between them; P7's cover was 102 × 768
  texture px), and glassd draws it: P7's headset frame of 12:36 ("a grey rectangle with square corners around the tab-bar capsule",
  `wp/P7.md` l. 132, l. 186). With `wp.c1a` on, the shapes are right: my native probe (13:06) read
  `frame.menu` shapes `[327,122,123,612, r 62]` and `[327,749,123,330, r 62]`, both acked (`data-lgs-cover`). So the
  shipped state today (runtime flag off, native on once V1's gate passes) shows an outline-like slab, against the
  quality bar's "edges come from the material and shader only". Fix: give the fallback a radius (`"r": "capsule"`, or
  keep a radius on the box when no `.lgs-tabcap` exists), and answer P7.

- **M3. High Contrast: the main window's glass stays at .84, not the near-opaque .94 (G-A11Y; REQ P4->C1a, open).**
  `--lgs-c1a-tint: rgb(20 22 30 / calc(.60 + var(--lgs-dial) * .24))` (`20-shell.css` l. 60) gives .84 under
  `prefers-contrast: more`; P4's `--lgs-mat-window-tint` is `rgb(11 13 16 / .94)` there. Probe `--media contrast`
  (`<scratchpad>/r2/hc.out`): `dial 1`, root background tiles `rgba(20, 22, 30, 0.84)`, `matWindowTint
  rgb(11 13 16 / .94)`. The tab bar (l. 896–900) and the ornament (l. 714–719) do switch to opaque glass in High
  Contrast, so the window is the odd one out. PLAN §4.1 G-A11Y: "near-opaque glass with the 2 px edge".

- **M4. The toolbar row on `windowless` routes is not glass in CSS-only mode, and differs from what native mode
  draws (REQ C2a-R2->C1a, open; WN §3.2 "Windowless routes").** On `/library/home` with C2a's hook (`--flags
  wp.c1a,wp.p3,wp.c2a`, 13:08, `native=off`): `data-lgs-glass="windowless"`, `data-lgs-back="root"`; Back carries
  `data-lgs-plate=liquid`, `data-lgs-plate-inset=10`, `data-lgs-plate-r=capsule` but its CSS fill is none (`::before`
  transparent, no shadow: the section-root borderless rule, l. 271–277); the search field carries the `shell-search` plate
  tags but draws the recessed well (black .30 + inset shadow) straight over the room, with no glass behind it
  (`<scratchpad>/r2/home_probe.json`). Seen on `shots/p2_c1a_r2_home_windowless.png` over both rooms: a bare arrow
  floating over the room and a smoked bar beside C2a's glass "What's New" capsule; the placeholder measures 4.4 : 1 over
  the lounge (borderline). WN §3.2 asks for the CSS plate look there (black .58 with a white .16 → .04 gradient + edge
  cues), and native mode would draw a 60 px liquid circle and a 520 × 64 liquid capsule that CSS-only mode never shows.
  (C2a-R2's "80 × 80 / 536 × 80 plates" is not right: the insets 10 / 8 make them 60 and 520 × 64. The look mismatch
  stands.)

- **M5. The Liquid Glass motion of the shell's own pieces is not built (WN §7; PLAN §1.5; quality bar).**
  `theme/20-shell.css` has exactly ten transition declarations and no animation (grep): nothing on `#Footer::before`/
  `::after`, so the capsule ↔ quiet legend switch is instant (WN §7 l. 787: "`materialize-in` 250 / `materialize-out` 350,
  `lgs-mat-glass-*` on `#Footer::before`"); no label fade or backing `snappy` morph when legends change (l. 786: the
  anchors jump); the More circle is a plain opacity transition of 250 / 350 ms (l. 921–928), not P5's materialize with
  separate glass and content channels (`.lgs-mat`, `lgs-mat-glass-in`, `theme/02-motion.nowrap.css` l. 84–111, 219–221;
  WN l. 788, PLAN §1.5 row "Materialize … More circle, ornaments"); the tab bar keeps Steam's 300 ms width transition
  (l. 744–749, "stay Steam's") where WN §7 l. 774 retimes it to `snappy` / `fade`; no tab-selection cross-fade (l. 775).
  The durations that do exist are tokens (MOTION gates pass); what is missing is the materialize recipe itself.

- **M6. Twelve requests addressed to C1a are unanswered** (`grep -n "REQ [A-Za-z0-9-]*->C1a"`, 13:20; table under
  "Requests to C1a"). Several have visible consequences beyond M1–M4:
  - C1b #9: `20-shell.css` §6 (l. 1022–1167, Phase 1's search route) is still live. It paints unscoped `.gpfocus` rings
    on the search scope tabs (`0 0 0 2px scrim, 0 0 0 4px focus-outline`, l. 1099–1102, outranking C1b's
    `box-shadow: none !important`: C1b review R2), `--lgs-focus-ring` on the arrows (l. 1117), `--lgs-glass-rim` 1 px
    lines (l. 1056, 1156) and Phase 1 aliases: P-17, P-42/P-43 and P-01 (must) on `/search`.
  - Coordinator (R2-1, R2-2, R2-3, R2-5, R2-10, R2-11): WN is not updated. §3.4.1 "Library routes" and §3.4.2 slot 1 still
    put Sort/Filter in ornament slot 1 with five fixed slots; §3.7 still says "until the coordinator rules (O4)"; §9.3
    rows L6/L7 still name "Ornament slot 1"; the mockups `window-nav-anatomy*.html`, `-ornament.html`, `-chrome.html`
    still draw the fixed-slot ornament as the default, so PLAN-1a-3 (G-MOCK) compares the device against a superseded
    design.
  - C2c REQ-9 / R2-2: the toolbar's trailing group. Measured (geometry probe, 12:18): Steam's laser Sort & Filter group
    at x 906–1256 against the shell's 536 px search box at x 372–908 (visible capsule 380–900): 6 px of visible gap
    (R2-2 asks ≥ 20) and 2 px of overlapping hit box. The width is C2c's to cap (REQ Coordinator->C2c), but C1a never
    answered where the group goes or confirmed the area is kept free.
  - C6a: the 520 px capsule straddles the 400 px settings sidebar (x 380–900); seen on `p2_c1a_r2_settings.png`.
  - C3b: CC-M clears the window by writing C1a's private `--lgs-c1a-tint`; C1a has not taken the rule or frozen the name.
  - P6: the window sheen, the ornament capsule and Back are painted with literals. P6's stopgaps in `05-native.css`
    (l. 85, 105–127) key on the legacy `footer` / `hdr-back` pops, which `wp.c1a` now supersedes; C1a's own §4c takes
    over for the ornament plate and the windowless Back plate (my native probe: `#Footer::after` background none once the
    plate is acked) and P6's l. 51 drops the window sheen. No double paint seen, but P6 asked to be told when the
    ornament became a plate so its overrides follow, and was not.

- **M7. READY and M4 are not supported by the card's acceptance tests (PLAN §2.1 definition of done 1, 2).**
  - AT-4 (the function audit on Home, a game page, `/account`, `/controller/calibration/0`, CONFIRM, MENU, POWER,
    `frame.menu`, `floatingfooter`): not run as specified; the log has `gates` on Home, AllGames, a game page,
    Downloads, `/settings/system`, `/media/grid`, `frame.menu`, `floatingfooter` only. (I ran the missing ones, below:
    the shell's nodes are clean there, so this is missing evidence, not a missing function.)
  - AT-7: only the computed pitch; `tabBarAlways` (the always-visible part) never run. AT-20 (headset view with the tab
    bar always visible, MENU and CONFIRM up, the ornament off-axis): not run. AT-17 (SteamVR chrome and the T4 moves):
    no evidence row at all; the ledger rows W1–W8 depend on it.
  - AT-0b: the CSS-only part passes, the native part was not shown (my native session repeats only the DOM part, below).
  - AT-23: the tab-bar capsules were never measured. AT-2: the scroll guard still fails (blocked on C2c, recorded).
  - PLAN-1a-3: `docs/phase2/wp/C1a-cmp.json` maps only the ornament's members for `window-nav-chrome`
    (`mockOrigin [320, -300]`), never the window-bar row the mockup is about (`framecap`, `winbar-pill`, `tooltip`
    rects exist in `p2_cmp_c1a_window-nav-chrome.rects.json` and are not compared).
  - There is no "session 5" section in the log (only Status bullets): no start-of-session request check, no command
    table, no dates for the M4 claim. M4's native look (09:05) predates P7's B1 fix (frame-menu copies half a capsule
    off) and its G-HV verdict was withheld, so M4 is not reached by PLAN §2.1's definition ("G-DEPTH and G-HV pass in a
    native session").

- **M8. The focused tab-bar item scales 1.1× under gamepad focus (VP P-05, must; no deviation recorded).** Steam zooms
  the focused `%{DashboardMenu>Item}` with its own transform; the shell keeps it and widens the pill's inset so the zoomed
  pill stays inside the capsule (C1a log l. 181, l. 242: "Steam zooms the focused tab-bar item 1.1×"; WN §3.3.4 keeps
  Steam's scale on the current route too). P-05: "tabs … never scale or lift on hover or focus"; PLAN §1.4 "rows and
  toolbar buttons never scale"; PLAN §4.4 lists only P-11, P-37, P-65, P-67 as deviations. Either neutralise it without
  touching Steam's `transform` (the independent `scale` property composes with it, LAB allows `scale`) or get a recorded
  deviation. (My own D-pad probe did not enter the bar, so the 1.1 is the builder's measurement, not re-measured.)

### Minor

- **m1. Removal leaves `#header[data-lgs-reveal]` (G-REMOVE in one state).** `reveal()` sets the attribute on `#header`
  (`20-shell.js` l. 256); `teardownDom()` removes it only from `#header`'s descendants (l. 686); P3's `attend().off()`
  leaves without `onLeave`. Live (`<scratchpad>/r2/readback3.json`, 12:01, `native=off`): reveal shown ("Library", Back
  143 wide), `wp.c1a` pushed off → module `off`, `#header` still `data-lgs-reveal` (1 node). While it stays, a re-install
  keeps the Large Title at opacity 0 (`#header[data-lgs-reveal] > .lgs-title`; `applyRoute` checks only Back's
  attribute, l. 164). Reachable when the theme or the flag goes off while the laser rests on Back. One-line fix.
- **m2. The tab-bar capsules have no E3 edge** (WN §8.1: "Arc + lobe ×1.10, dark edge 6 px .12"): only a gradient sheen
  and `--lgs-raised-shadow` on the cap rows; no `--lgs-edge` hook on the menu. AT-23 never measured them.
- **m3. P-07 (should): ornament hit boxes do not abut.** Members are 4 px apart (`gap: 4px`, l. 489) and 10 px more
  before the quiet group (l. 599–601): measured gaps 5, 3, 14, 4 px (geometry probe, laser). WN §3.4.1 itself says
  "adjacent members' hit boxes abut (VP P-07)".
- **m4. The More circle has no tooltip** (WN §3.4.4 "Feedback": "Options" after 0.8 s through P3's tooltip layer) and its
  `aria-label` is empty in laser mode (builder's AT-26 note).
- **m5. The tab bar's +25 mm is P7's `tabBarDepth` flag**, which neither WN nor C1a's interface table names; with
  `tabBarAlways` alone the bar keeps Steam's +10 mm. `frame.menu` stays `laserOnly: true` in the reporter while C1a owns
  the surface, so with `tabBarAlways` in gamepad mode the bar has no glassd cover.
- **m6. Native, windowless routes:** `#header %{BackContainer}[data-lgs-plate-ack]:not(:hover, .gpfocus)::before`
  (l. 1004) drops the CSS fill only at rest; on hover or focus the full raised fill repaints over glassd's acked plate.
- **m7. The Back reveal animates layout** (`max-width`, `padding`, l. 252) where LAB asks for opacity / scale /
  translate; under Reduce Motion the capsule still grows on a 180 ms width transition (P-56 reads "only opacity").
- **m8. The ≡ glyph badge is broken in gamepad mode.** Steam's Menu glyph is a wide pill image; the invert + screen recipe
  (l. 545–551) leaves a dark pill wider than the 30 px badge disc, spilling over its edge (`<scratchpad>/r2/
  badges_grey.png` from `p2_c1a_r2_ag_pad.png`). The letter glyphs also keep Steam's ring inside the badge, not WN's
  "16 px Bold letter".
- **m9. Two must-level false positives on Steam's `#header` that V2 will record against the shell.** P-82 FAIL on
  `/settings/system` (pad, 12:39: `#header`'s `innerText` is E-BACK's hidden "Back", no Large Title there) and G-SIZE
  P-80/P-08 on `/controller/calibration/0` (13:23: "`%{Profile>Header}` 1280 × 40, visible short side 40"). `#header`
  is `pointer-events: none` with a nav node and only mouse/context-menu props (probe `hdr_pad.json`, 13:27; not in
  `L.gates.controls` at that moment), so these are lab-model artefacts, but C1a owns the row and should file the REQ to
  P10 (E-BACK-aware P-82; nav containers with `pointer-events: none` are not targets) so the record is clean.
- **m10. Input-mode scoping:** the search field's ring `:is(.gpfocuswithin, :focus-within)` (l. 328) and the native
  Back rule (l. 1004) have no input-mode class (P-01); the ring can paint under a stale laser `.gpfocuswithin` (P-02).
- **m11. Phase 1 aliases in `vr/10-systemui.css`** (`--lgs-t-fast`, `--lgs-ease`, `--lgs-panel-*`, `--lgs-control-rim`,
  `--lgs-focus-outline`): PLAN §6 removes the aliases once areas reach M2; this file then loses its timing and glass.
- **m12. The pointer proxy's 1.5 px dark ring fails G-OUTLINE (P-43) in native laser runs.** `gates main --pre POWER
  --mode laser` (13:21, `native=on` from another agent's session): OUTLINE FAIL "`lgs-pointer lgs-pointer-on` 1.5px ring
  (box-shadow)". The proxy is a recorded deviation for P-11 (drawing a cursor), not for P-43; a 2 px ring or a soft
  shadow would keep it readable and clear the gate. (Rated minor only because the element is the recorded cursor
  deviation; V2 will see a failed gate until it is fixed.)
- **m13. P-73 (should): no scroll edge at the bottom.** Content is cut hard at the glass edge (the `clip-path` at
  `--lgs-c1a-gh`, l. 120–122) under the ornament; only the top has the 124 px band. Seen on the AllGames shots (the
  second poster row ends in a straight cut behind the capsule).

## Evidence

All CSS-tier rows were checked for `native=off` in the step line (other agents' native sessions run between steps).

### Gates (G-AUD, G-SIZE, G-TYPE, G-OUTLINE, G-MOTION)

| Surface, route, mode | Command (flags `wp.c1a,wp.p3` unless noted) | Result on the shell's nodes | Time |
|---|---|---|---|
| `main` AllGames, pad / laser | `gates main --route /library/tab/AllGames --mode pad\|laser --json` | AUD, TYPE, OUTLINE, MOTION PASS; SIZE 1: C2c's tab "Great On Frame" (not the shell) | 10:51–10:54 |
| `main` `/settings/system`, laser | same | all PASS (quiet legend on the band, AUD CONTRAST 0) | 11:26 |
| `main` `/library/app/1147940`, pad / laser | same | all PASS (hero: Back clear glass) | 12:06, 12:32 |
| `main` `/library/collection/favorite`, pad / laser | same | shell clean; SIZE: C2c's tab and "Favorites" panel | 12:33 |
| `main` `/media/grid`, pad | same | shell clean; SIZE: a C7 media tile | 12:01 |
| `main` `/search/tab/All`, pad | same | shell clean; TYPE: a C1b result label 16 px | 12:37 |
| `main` `/library/home`, pad, `+wp.c2a` | `--only aud,size,type,outline` | SIZE, TYPE, OUTLINE PASS; AUD = C2a's T3 view replacing Steam's Home (GONE ×160, C2a's) | 13:09 |
| `frame.menu` on Downloads, pad / laser | `gates frame.menu --route /library/downloads` | all PASS (E-TAB items) | 12:29, 12:32 |
| `floatingfooter` | `gates floatingfooter --only aud,size,type` | PASS (0 controls while the dashboard has focus) | 12:37 |
| `vr:systemui`, pad / laser | `gates vr:systemui --flags wp.c1a --mode pad\|laser --json --shot p2_c1a_r2_vr2_<m>` | **OUTLINE FAIL ×2** (M1); AUD, SIZE, TYPE, MOTION PASS | 13:10 |
| AT-4: CONFIRM over AllGames, pad / laser | `gates main --route /library/tab/AllGames --pre <pre_confirm.js> --only aud,size,type,outline` | all PASS (header contents and ornament under the modal kept; no GONE / HIDDEN) | 13:21 |
| AT-4: POWER (look only), pad | same with `<pre_power.js>` | AUD, TYPE, OUTLINE PASS; SIZE: only C1c's Cancel line (E-MENU: fill 188 × 56) | 13:21 |
| AT-4: POWER, laser | same | `native=on` (another agent): the proxy's ring (m12); AUD CONTRAST on labels whose CSS glass native mode drops (the AUD model sees no glassd glass: a lab limit, not a shell defect) | 13:22 |
| AT-4: `/account`, pad | `gates main --route /account --only aud,outline` | AUD PASS (the quiet legend inside the `window-full` glass, CONTRAST 0: AT-29's `/account` part); OUTLINE: only a C4a/C7 dropdown's top edge (0.999); the window's edges 0.04 / 0 | 13:33 |
| AT-4: `/controller/calibration/0`, laser | `--only aud,size,type,outline` | AUD, TYPE, OUTLINE PASS; SIZE: `#header` itself (m9) | 13:23 (`native=on`) |

Not obtained (lab lock busy 240 s): Downloads both modes, `/settings/system` pad, `/media/grid` laser (the builder's
rows cover them; nothing contradicts). Names shown on `/account` are not quoted anywhere here (PLAN §1.15).

### Geometry (one locked `js` step per mode, `<scratchpad>/r2/probe_geom.js`, 12:06 laser / 12:18 pad)

- Every route: `#Footer` 0, 628, 1280 × 92; `--gamepadui-current-footer-height` 92px; Back box (14, 14) 80 × 80; search
  box 536 × 80 at x 372 (656 × 80 at x 312 on a collection); Large Title at x 100 on section roots.
- AllGames laser: plate (= capsule) x 333, 614 wide, members 345–935: left − 12 and right + 12 exact, centred at 640,
  largest gap 14 (R2-2 check 1 PASS); `data-lgs-plate=liquid` only as a capsule; `/settings/system` and the collection:
  quiet, plate node without `data-lgs-plate` (R2-1's "no plate for the quiet legend" PASS in the DOM).
- AllGames pad (Steam in its real laser state): Steam's Sort & Filter group at 906, 14, 350 × 80, `position: fixed`,
  right 24; overlap with the search box 2 px, `elementFromPoint` at the seam = the search box's panel (M6).
- Quiet band alpha on `p2_c1a_r2_settings.png`: 155–158 (= .62) over shot y 985–1030, x 720–1200 (R2-1 values hold).

### pad-bfs (G-PAD), with the flags, `--stock` and theme-only

| Route | Shell on (`wp.c1a,wp.p3`) | Stock (`--stock`) | Note |
|---|---|---|---|
| `/library/downloads` (pad) | 3 nodes, 0 irreversible, 4 unreached | the same 3 nodes and 4 unreached | the unreached rows are Steam's (empty queue); identical sets |
| `/settings/system` (laser stub) | 93 nodes, 510 moves, 0 irreversible, 0 unreached | 93, 0, 0 | identical |
| `/library/tab/AllGames` (pad) | 76 nodes (truncated at the 150 s budget), 1 irreversible (30 –up→ 3) | 90 (truncated), the same irreversible edge | Left from a poster exits to `frame.menu` and Right returns (14 exits, all back by the opposite press); the key differences are text case only (stock uppercase) |

Files: `<scratchpad>/r2/bfs_{c1a_pad,c1a_laser,off,stock}_*.{json,txt}` (10:59–11:49). No reachability loss. (The stock
and theme-only runs overlapped another agent's native session; pad-bfs reads only the DOM and Steam's focus, so they
stand.)

### Native session (P7 complete; one batched `native-session`, 13:06–13:08, `<scratchpad>/r2/run_native.py`, `native.log`)

- Probe (AllGames, laser): reporter `main` mode `window`, cover `[0, 0, 1920, 984, r 81]` (656 × 54 × 1.5), plate
  `shell-ornament [500, 942, 920, 126, r 63] liquid`, acked; the CSS capsule and its E3 hook dropped
  (`#Footer::after` background none, `--lgs-edge: none`); the root cover acked and its sheen gone. `frame.menu`
  `liquid`, two capsule shapes r 62, both `.lgs-tabcap` acked. Pointer proxy (AT-0b DOM part): one `.lgs-pointer` in main
  and one in the frame menu, at the synthetic move's point (130, 403), `pointer-events: none`, hit test passes through to
  the poster, off after `pointerleave`; `pointerProxy` mode `native`.
- `sgcheck` AllGames, laser and pad: no R1 (nothing over the ornament's `data-lgs-nopop` box), no `hdr-*`, `footer`,
  `sort-filter` pop; the only failures are R2 on the legacy `tab-arrow` ×2 (4.43 mm) and `card` (2.95 mm), owned by
  C2c / C2a / C5a (reporter §3.5). `/settings/system`: PASS, 0 pops. `/library/home` with `wp.c2a`: PASS, 0 pops.
- `conformance --only P-11,P-34,P-46…P-51` (AllGames, native): P-11, P-46, P-47, P-48, P-51 PASS; P-34, P-49 manual.
- `hv` (4 frames: AllGames with a hover, settings, AllGames 30° off-axis, Home): doubling 0.29–0.31 (< 0.6), window top
  edge ratio 0.0; verdict withheld (auto rect). The headset was not facing the dashboard: the window sat at the frame's
  bottom edge, so the ornament, the tab bar's shape and the proxy ring were out of frame. G-HV for the shell's chrome
  stays open (M7). Frames looked at and deleted (the three later looks expired before I opened them; nothing kept).

### Live looks against the mockups (CDP shots composited over `room-lounge` / `room-studio`, viewed)

- `p2_c1a_r2_ag_pad.png` / `_ag_laser.png` vs `p2_window-nav_anatomy.png`: toolbar row (borderless Back on the section
  root, Large Title, recessed 520 capsule), glass to 656 with rounded bottom corners, the ornament straddling the edge,
  glyph badges only in pad mode. Matches the design except the mockup's (now superseded) fixed slots and the laser pill in
  the ornament. The ornament's top edge profile: 22.9, 45.5, 60.6, 92.6, 23.4, 2.9, 0.7, 1.4 → ratio 0.01 (lounge and
  studio): a lobe, not a line. The ≡ badge glitch (m8).
- `p2_c1a_r2_settings.png`: quiet legend on its band, legible over the bright sill; the capsule over the sidebar edge
  (M6, C6a).
- `p2_c1a_r2_home_windowless.png`: M4.
- `p2_c1a_at8b_focus.png` (builder's) and `p2_c1a_r2_tab_rest.png` over the lounge: two capsules, the focus pill and the
  current-route circle clearly different shapes; labels legible over the bright window. (My own tab-focus pre did not
  move focus into the bar; that shot equals the rest shot and is not used.)
- `p2_c1a_r2_vr2_pad.png`: M1 (the controller cards' outline); frame controls one quiet capsule.
- Not compared: the window-bar row against `window-nav-chrome.html` (no shot of the moved row exists; AT-17).

### Function retention (WN §9, both paths)

Checked against WN §9.1–§9.3 and §9.8 for C1a's rows: Back (click / B), the field (click / Up), the tab bar (click while
laser-visible / D-pad Left from the page edge, Right back: pad-bfs exits), the ornament members (click on Steam's legend
nodes, none hidden in either mode: AUD 0 HIDDEN on every route above; physical buttons), A and B as quiet members in both
modes (geometry probe), the More circle and the Options member (builder's AT-25/26, not re-run), SteamVR chrome restyle
only (AUD PASS on `vr:systemui`). No lost function found. W1/W2 (move, resize) have no gamepad path, as in stock.
Rows L6/L7 still point at "ornament slot 1" (M6). N3 ("B at the window root opens the bar") is unproven (AT-8).

### Removal, robustness, idle

- Flag cycles (`<scratchpad>/r2/cycle2.out`, 11:06): three install/remove cycles of `wp.c1a` on Downloads: 0 shell nodes
  or attributes left in main, frame.menu or bar, 0 listeners after removal, modules `off`; 1 s idle with the shell on: 0
  mutations, 0 running animations. The reveal-state removal leaks (m1).
- `--stock` probe (13:12, `probe_stock.js`): with the theme off inside the lock, 0 `data-lgs-*`/shell nodes, no `lgs-*`
  html classes, no `--lgs-*` inline variables and no `lgs` style on main, frame.menu, bar. (The lab applies `--stock`
  before a step's flags, so this shows the off state is clean, not removal right after an install; the flag cycles
  above show that.)
- Fail-closed: each module is an `RT.define` with its token lookups inside `install()` (a missing token throws there, P1
  marks the module failed); every DOM write is guarded. No unbounded state found (history stack capped at 64).
- Perf (Phase 1 `perf`, one run each, 12:04 / 12:35, `native=off`): `/settings/system` 88.7 vs 90.2 fps stock (−1.7 %,
  1 long frame); AllGames 61.4 vs 84 fps, 11 long frames: that route's G-PERF is C2c's (REQ Coordinator->C2c (3)). The
  ABBA runs below put the shell's runtime and the theme at parity on Downloads.
- Nothing runs at idle: no interval or rAF loop of the shell's at rest (MutationObservers on `#Footer`'s subtree and
  `#header`'s children only; the More circle's 200 ms poll lives only while its menu is open, ≤ 1.5 s when none opens).

### Conformance (VP P-items for the shell)

`conformance` on AllGames, Downloads and `/settings/system` (`<scratchpad>/r2/conf_{pad,laser}.json`, 12:37–12:42,
`native=off`) and the depth items in the native session:

| Item | Result | Shell's share |
|---|---|---|
| P-08, P-80, P-83, P-38, P-84 | P-08 FAIL only on C2c's tabs and posters; the rest PASS | none |
| P-17 | PASS on `main`; FAIL in More Options (static, M1) and on `/search` scope tabs (§6, M6) | yes |
| P-42, P-43 | PASS on `main` (6 glass elements); FAIL on `vr:systemui` | M1 |
| P-01, P-02, P-89 | FAIL (must), mostly other files; the shell adds l. 328 and l. 1004 (P-01) and §6's unscoped rules | m10, M6 |
| P-82 | FAIL on `/settings/system` in pad mode | m9 |
| P-07 | not automated; measured gaps 3–14 px | m3 |
| P-11, P-46, P-47, P-48, P-51 | PASS (native) | — |
| P-23 | see the `--pad` run below | — |
| P-52, P-58 | PASS (nothing at rest, token durations) | the missing materialize is M5 |
| P-60, P-62 | Back at (24, 24) on every route (geometry); the field 64 px capsule | — |
| P-70 | frame-control glyphs .70 × SteamVR's idle .6 = .42 (static) | — |
| P-87 | PASS (`.84` at most); High Contrast exempt, but G-A11Y is not (M3) | M3 |

P-20/P-22/P-23 (`conformance --route /library/downloads --route /settings/system --route /library/tab/AllGames --pad
--only P-20,P-22,P-23 --flags wp.c1a,wp.p3 --mode pad`, 13:11–13:14; Downloads ran while another agent's session had
native on, the other two `native=off`; `<scratchpad>/r2/conf_pad23.json`): P-22 PASS (entry focus on the primary item on
all three). P-23 **FAIL** (must): `/settings/system` the sidebar's first row at y 108–180 (top < 124); AllGames posters at
y 102 and 390–656 (top < 124, bottom > 612). The shell's guard variables and its generic `%{ScrollPanel}%{ScrollY}`
padding are in place; these scrollers and page roots are C6a's and C2c's (REQ C1a->C6a, REQ C1a->C2c (1)–(2)), so it
counts against AT-2 (M7), not as a new C1a defect. P-20's "unreached" come from the conformance step's short BFS budget
(4 nodes); the full pad-bfs runs above are the G-PAD evidence.

### G-FOCUS and G-PERF

- G-FOCUS on the tab bar (PLAN-1a-2), re-measured offline on the builder's `shots/p2_c1a_at8b_focus.png` composited over
  `room-lounge` (`glass.py focus --png … circle r 34` on the icons): focus − rest **+51.3**, focus − current circle
  **+34.6**, current circle − rest +16.7: PASS, matching the builder's +51.0 / +34.8. Not re-shot live (my own tab-focus
  pre did not enter the bar).
- Runtime cost (RT-7 statistic, `perf main --route /library/downloads --ab theme --flags wp.c1a,wp.p3 --mode pad`, 13:17,
  8 runs, all `native=off`): fps ratio **1.0**, extra long frames 0 (A/A spread 1): PASS.
- G-PERF (`--ab stock`, same route, 13:18): fps ratio **1.006**, extra long frames −0.5: PASS.

### Requests to C1a (open at 13:20)

| Request | From | What | Visible effect |
|---|---|---|---|
| REQ C1b->C1a #9 | C1b | delete §6 (search route) | rings and 1 px rims on `/search` (M6) |
| REQ C1c->C1a (info) | C1c | `will-change: auto` on the split during modals; what isolates the tab row from the menu's frost | the library tab row reads sharp behind a menu's top edge |
| REQ C2a-R2->C1a | C2a review | windowless toolbar plates vs CSS look | M4 |
| REQ-9 REQ C2c->C1a | C2c | keep the toolbar trailing area free / say where the group goes | 6 px gap, 2 px overlap (M6) |
| REQ C3b->C1a | C3b | own the CC-M window-clear rule or freeze `--lgs-c1a-tint` | contract risk |
| REQ C5b->C1a | C5b | `vr:systemui` OUTLINE and MOTION | M1 (the 0.04 s MOTION finding did not reproduce at 13:10: MOTION PASS) |
| REQ C6a->C1a | C6a | search capsule over the settings sidebar | M6 |
| REQ C6b->C1a | C6b | `vr:systemui` OUTLINE and frame-control SIZE | M1 (the SIZE finding did not reproduce at 13:10: SIZE PASS) |
| REQ P4->C1a | P4 | High Contrast window tint | M3 |
| REQ P6->C1a | P6 | literal paints; tell P6 when the ornament is a plate | native double paint risk |
| REQ P7->C1a | P7 | frame-menu cover radius | M2 |
| REQ Coordinator->C1a | Coordinator | WN and mockups for R2-1/2/3/5/10/11 | M6, M7 (G-MOCK on superseded mockups) |
| REQ C1a->V1 (C1a's own, open) | — | `quietBacking` in `defaults.json` | none (built-in default) |
