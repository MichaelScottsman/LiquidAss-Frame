# C6b SteamVR Settings: evidence log

Package card: `docs/phase2/PLAN.md` §2.4 "C6b SteamVR Settings". Concept: `docs/phase2/concepts/settings.md` (SET)
§4.10, §4.12, §9.5; CTL §13, §19.2. Steam build `11094443`. Surface `vr:systemui` (frame page `system.settings`).

## Status

**M2 and M3 reached** (2026-10-07, session 1, 10:50-12:55; the only C6b session). Steam build 11094443.

- **T1 (live, unflagged):** `theme/vr/30-settings.css` rewritten (draft identical in `theme/_wip/vr-30-settings.css`,
  `check-theme` PASS, synced): Steam's footprint (1858 × 952 glass, r 78, on `.SettingsSidebarPageContainer`), the
  scrolling 576 px sidebar (104 / 115 rows, .18 pill + lobe), "SteamVR" title, platter rows (115, 35 px labels,
  32 px descriptions), 86 / 121 refresh circles, 92 px sliders, title-case 86 px capsules, purple advanced dot,
  thick-glass popovers with the leading check slot, the modal fit rule, the Advanced Settings ornament straddling the
  glass bottom. Shared `.SettingsMain` looks (also Now Playing's modals) kept and made gate-clean.
- **T2 (flag `wp.c6b`):** `device/vr/systemui.settings.js`: Back circle (`SwitchToPage` to Steam), icon circles,
  section hero, Off/On → switches (knob = SteamVR's own sliding pill), ARIA `tab` / `switch`, `E-SWITCH` exemption.
  `remove()` takes everything away (checked: 0 attributes, no node after removal).
- **Evidence:** gates on `vr:systemui` (General, laser with T2; pad and laser T1): AUD, TYPE, MOTION PASS; SIZE and
  OUTLINE fail only on C1a's elements (REQ C6b->C1a). P-S5, T-VR-EXIT, T-VR-SW (live, read only), P-S6, T-VR-FOOT
  (DOM) PASS. `pad-bfs`: not applicable (laser-only SteamVR page; its gamepad path is T-VR-EXIT).
- **Native:** no fragment possible (SteamVR pages are not reporter surfaces). Native check run (P7 M3): `hv` look shows
  a stale dark cover over the SteamVR panel in native mode (REQ C6b->P8); `sgcheck /settings/lgsvr`: only legacy R2.
- **Not built (fallbacks documented):** inline title (D6); mockup re-renders (expedited).
- **Device left:** theme on, CSS only (native off after the session), Steam's page active, SteamVR settings on
  General, RAM test script removed (`/tmp/lgs/vr-scripts/` empty), no flags of C6b's left.

READY: wp.c6b (evidence: Evidence rows "laser, T2 present" 12:28, P-S5 12:33, T-VR-EXIT 12:12, T-VR-SW 11:52; no
GONE / HIDDEN / UNCLICKABLE on SteamVR's page; page-script status `err: null`; the remaining gate failures are C1a's).
Caveat for V1: a flag flip during a session is picked up late by the daemon (REQ C6b->P8); with `defaults.json` the
script loads at unit start.

## M0 note: SET conformed to PLAN §1 (expedited: no mockup re-render)

| # | SET / CTL says | PLAN §1 / gate says | Built |
|---|---|---|---|
| D1 | Sidebar selection white .26 + specular top arc | §1.4: navigation selected = `--lgs-fill-nav` (.18) + arc + Semibold; VP P-42 no full-width line | .18 pill + a lobe at 30 % of the width (C6a's D4/D5) + Semibold; hover = the spot only (§1.4 navigation rows) |
| D2 | Refresh Rate: 104 px circles at a 116 pitch (SET §4.10) | CTL §13 / §19.2 V1 (C4a's vocabulary, REQ C4a->C6b): 86 at a 121 pitch | 86 at 121 (35 px gap), under the label |
| D3 | Off/On switch: SteamVR's sliding `::after` pill at opacity 0, knob = the unselected option's `::after` | §1.5 one motion system (a knob that jumps between two elements has no motion) | The knob **is** SteamVR's own sliding pill (transform untouched, 38 px box so its `translateX(100% × index)` moves it 38 px; drawn 50 px round). The click method is SET's (selected option inert and hidden, unselected stretched over the track, hit 128 × 114) |
| D4 | Bottom fade of 104 px on the scrolling sidebar | A `mask-image` on the sidebar would also mask the ornament (it is a DOM descendant) | No fade; the list ends at the glass edge, 48 px end padding |
| D5 | Window E4/E5 dark edge (DESIGN2) | C5b's live finding: on a transparent SteamVR overlay the inset black shadow reads as a bright band | Lobe only (C5b's recipe), no inset edge |
| D6 | Inline title when the hero scrolls away | Needs a scroll-linked T2 (no budget in this expedited session) | Not built (fallback: the selected sidebar row names the section) |
| D7 | Hero 81 px circle + 55 px title on two lines | C6a's compact hero (§1.7 rule 5, one row) | 87 px circle + Title 1 (55 px Bold) in one centred row |
| D8 | Depth (T5 systemui window cover) | §1.7; SteamVR pages are not reporter surfaces (reporter.md §3: surfaces are Steam windows; C5b-D3 same finding) | No layer, plate or popup fragment: none can address `vr:systemui`. Depth stays SteamVR's own (flat panel) |

## Observation for the coordinator

SteamVR's **Display Brightness** read 40 % (the slider at its origin, `--slider-value` 0) at 11:52, 12:21 and 12:29,
and **120 %** in the 12:33 shot. C6b dispatched no input on any SteamVR control: its steps only switch the frame page
(`SwitchToPage`), click sidebar section rows (navigation), click C6b's own Back node, and read (`elementFromPoint`,
computed styles, captures). Between 12:29 and 12:33 C6b ran only a `native-session` (a page switch, an `hv` grab,
`sgcheck`). Either the value is live (adaptive) or another step changed it; worth a check against the action logs.

## Native (PLAN §1.6, §1.7)

No fragment: SteamVR's settings page is drawn by `vr:systemui`, which the reporter does not report (its surfaces are
Steam's windows and popups, `theme/layers/00-base.json`); the window cover, plates and pops cannot address it. The
CSS-only glass above is what native mode shows here too.

## Requests

- [x] REQ C6b->P8: a flagged page script is not (re)installed after a flag flip. `python glass.py js "…" --in
  vr:systemui --flags wp.c6b` (flags.json written for the step, 12:13 and 12:14, CSS-only unit) waited 30 s with no
  `window.__LGS_VRX.settings` and `status.shell.vrScripts` `{}`; the journal shows `page script settings installed`
  only at 12:11:50, the second a frame page change (`valve.steam.gamepadui.main -> system.settings`) happened. So lab
  steps with `--flags wp.<id>` on `vr:` surfaces mostly run **without** the page script. A default-on flag
  (`defaults.json`, V1) is read at unit start, so production is not affected; C6b's evidence below used a RAM test
  copy in `/tmp/lgs/vr-scripts/` (contract §6), removed after each run.
  - P8 (2026-10-07 14:06 EDT, maintenance session 4): **done.** Cause: the daemon's SteamVR page theming was
    **paused** (`/tmp/lgs/vr-theme-paused`), and while paused it injects no page script (hence `vrScripts {}`). The
    lab's `--theme off` on a `vr:` page (also `gates` / `audit`'s stock snapshot) writes that pause, and its
    `--theme on` (`lgs_vr.apply_once()`) never removed it, so after any `gates vr:systemui` with AUD the pause stayed
    until the next `lgs on` or daemon start (a native session's start removes it). Your 12:11:50 install came one
    poll after your step wrote the flags; from then until 12:31 the journal has no page-script line at all, not even
    the removal when your step's flag went, which is what a paused daemon looks like. Seen again live 13:11: `paused: true`, `vrScripts {}`, a 24 s `--flags wp.c6b` step
    never got `__LGS_VRX.settings`. Fixed in `device/lgs_vr.py` (`apply_once()` ends the pause) and
    `device/lgs_shell.py` (a pause older than 300 s is stale and removed; each page-script pass reads the flags files
    itself). Live after the fix: `js … --in vr:systemui --flags wp.c6b` found `__LGS_VRX.settings` at its first
    sample (installed 14:06:13, removed 14:06:14 when the step's flag went); `gates vr:systemui --only aud` 14:06:32
    paused and resumed page theming 2 s later (journal), no pause file left. A step should still wait for
    `window.__LGS_VRX.settings` (≤ 1.5 s after the flag flips). contracts/daemon.md §6.
- [x] REQ C6b->C1a: two `gates vr:systemui` findings in `theme/vr/10-systemui.css` (C1a's), seen on every C6b run:
  OUTLINE P-42 "closed rim of 3 shadow lines" on `%{ControllerStatusRoot} %{LargeStatusArea}::before` (rects
  278,1571 and 535,1571, 220 × 54: `inset 0 1.5px` white .42 + `inset 1px 1px` + `inset -1px …`), and SIZE P-08 on
  the frame-control `ButtonControl WithIcon LargeIcon` at (139, 1256) 107 × 107 ("hit 100% own, 0% other … over
  107x106": the failing part is not the hit; perhaps the 0.48 circle rule).
  - **C1a answer (2026-10-07, R2 fix pass, session 6):** done. (1) OUTLINE: the controller card (and every other C1a panel in `vr/10-systemui.css`) is now P4's panel glass with the E4/E5 dark edge and the lit top lip, no closed rim; More Options is thick glass with light-only rows and focus (no ring, no 1 px separators). (2) SIZE: the frame-control circles keep their 107 × 107 hit and 80 px visible circles; the finding did not reproduce. `gates vr:systemui --flags wp.c1a --mode pad|laser` (17:49): all five gates PASS (`SIZE` 4 controls checked, 0 fails); with C3a's static zoo of the on-demand panels (More Options, the pills, the tooltip, section 5) SIZE, TYPE, OUTLINE and AUD PASS too.

- [x] REQ C6b->P8: in native mode, with the dashboard frame on SteamVR's settings page (`system.settings`, your
  journal logs `systemui: frame page valve.steam.gamepadui.main -> system.settings`), the `hv` frame of 12:31 shows a
  dark glass rectangle over the left ~72 % of SteamVR's panel, top-left aligned with it, the right column outside it on
  the panel's own (lighter) CSS glass. It looks like the main surface's cover (glassd) is still drawn although Steam's
  page is not shown. Please hide main's cover, base and pops (`visible: false`) while the frame's active page is not
  Steam's, as for any hidden surface. (If it is not the cover, the SteamVR panel is physically wider than Steam's
  window, which also matters to SET T-VR-FOOT; C6b's CSS draws one uniform glass over the whole panel.)
  - P8 (2026-10-07 13:45 EDT, maintenance session 4): **done as asked.** While the daemon's `page.steam` is false
    (the frame shows `system.settings` or the binding UI), main stays in `glassd.json` with nothing to draw (its quad
    stays masked out of the room map) and is left out of the scene-graph spec (no cover, base, pop or slab;
    `lgs-native` comes off main); back on Steam's page its plates and slabs materialize again. `status.mainAway`.
    Live (native session 13:45, Home windowless, `FrameStore` switched to `system.settings` for 13 s from
    `vr:systemui`): `mainAway` true and main empty in `glassd.json` from 13:45:51 to 13:45:59 (the reporter had
    already dropped main at 13:45:48 here, Steam's document going hidden); the `hv --look` of the settings page
    showed SteamVR's panel with no dark rectangle; back at 13:46:01, Home's 18 plates and the card slab returned
    by 13:46:04. contracts/daemon.md §4.2.

## Requests to C6b, handled

- REQ C4a->C6b: (1) `settings-steamvr.html` re-render: **not done** (expedited, no mockup re-renders); (2) 86 / 121
  refresh circles: built (D2), measured in T-VR below; (3) SteamVR popovers: the current value is checked in the
  leading slot (a 34 px check at x 38, every row reserves the slot), no fill.

## Evidence

| Test | Date | Command | Result | Artifacts |
|---|---|---|---|---|
| P-S6 free pseudos | 2026-10-07 10:58 | probe in `vr:systemui` (page shown under the Steam lab lock) | **PASS**: `.SettingsMainPanel::before/::after`, `.SegmentedControlGroupOption::after`, `.SettingsSidebarPageContainer::before` are `none` in SteamVR's CSS (the group's own `::before`/`::after` and the option's `:not(:first-child)::before` are SteamVR's: restyled, transforms untouched) | — |
| SET T-VR-FOOT (DOM part) | 2026-10-07 11:52 | probe3 (scratch `c6b/probe3.js`) | **PASS** (DOM): panel box `[2,156,1858,1045]` unchanged (its quad); glass = `.SettingsSidebarPageContainer` 1858 × 952, r 78.3 = 91.1 % of the panel height, Steam's 656 / 720 = 91.1 %; ornament `[498,1066,865,121]` centred (x 930), straddling the glass by 41. The `hvgrab` half: see the native row (the SteamVR panel looks physically wider than Steam's window cover) | — |
| SET T-VR-SW (live, read only) | 2026-10-07 11:52 | probe3: `elementFromPoint` at 9 points (5/50/95 % × 10/50/90 %) of a live `[data-lgs-switch]` group (On) | **PASS** 9/9 on the unselected option (`Off`, hit box 128 × 114 at `[1619,718]`); the selected option opacity 0 / `pointer-events: none`; knob = SteamVR's pill, 38 px box, `translateX(38px)` when On. Nothing was clicked | — |
| SET T-VR-EXIT | 2026-10-07 12:12 | scratch `c6b/p4a.js` in `vr:systemui` (page shown): `frame.inputFocus.FocusLeftFrameMenu()`; then a lock-free read of `.gpfocus` in every Steam popup; then `FocusApplicationRoot()` | **PASS**: `.gpfocus` in `valve.steam.gamepadui.frame.menu…` on the **VR Settings** item: the gamepad path out of SteamVR's page (D-pad Left → tab bar) works with the theme | — |
| G-AUD/SIZE/TYPE/OUTLINE/MOTION, `vr:systemui` General, **laser, T2 present** | 2026-10-07 12:28 | `gates vr:systemui --mode laser --pre <settings_open, hold 70 s> --json`, T2 from a RAM copy in `/tmp/lgs/vr-scripts/` (REQ C6b->P8) | AUD **PASS**, TYPE **PASS** (22), MOTION **PASS**, SIZE: 12 checked, 3 switches **E-SWITCH pass** ("hit 100% own over 86 x 80"); the only failures are C1a's (frame-control P-08, ControllerStatus P-42 rims: REQ C6b->C1a) | scratch `c6b/g4_laser.json` |
| same, **pad** (T1 only: the page script was stripped by the AUD theme toggle and not back yet) | 2026-10-07 12:29 | `gates vr:systemui --mode pad …` | AUD **PASS**, TYPE **PASS** (32), MOTION **PASS**; SIZE / OUTLINE only C1a's findings | scratch `c6b/g4_pad.json` |
| same, Play Area (T1) | 2026-10-07 12:21 | `gates vr:systemui --mode pad` (SteamVR had stayed on Play Area) | AUD 2 SHRUNK (AuroraPalette button 499 × 265 → 499 × 221; "Speed" label 567 × 36 → 351 × 45): **fixed** (column 1180 = 813 main px like C6a's 816, stock right column 500, the colour button keeps its own padding) | scratch `c6b/g3_pad.json` |
| Play Area re-measure after the fix | 2026-10-07 12:50 | scratch `c6b/probe_play.js` (page shown, Play Area row clicked, General clicked again, back to Steam) | **PASS**: "Speed" 437 × 45 (area 0.96 of stock, AUD's floor 0.85), AuroraPalette 499 × 265 = stock. (A full gates re-run on Play Area at 12:42 did not get the page: another agent's step switched the frame back, `now=5`) | — |
| G-AUD/SIZE/TYPE/OUTLINE/MOTION, General, laser (T1, after all fixes) | 2026-10-07 12:44 | `gates vr:systemui --mode laser --pre <settings_open 70 s> --json` | AUD **PASS**, TYPE **PASS**, MOTION **PASS**; SIZE / OUTLINE: only C1a's findings | scratch `c6b/g7_gen.json` |
| SET P-S5 (Back circle) | 2026-10-07 12:33 | scratch `c6b/ps5b.js` in `vr:systemui` (T2 from the RAM copy): show SteamVR's page, wait for `.lgs-c6b-back`, `elementFromPoint` at its centre, dispatch a `click` there (as the laser's mouse event arrives) | **PASS**: Back `[22,176,116,116]` (panel (20, 20), the 86 px disc inside), the centre hits it, `aria-label` "Back" (SteamVR's `#back`); active page 1 (`system.settings`) → 5 (Steam). Same step: hero `data-lgs-title` "General" / `data-lgs-sec` general, 8 `role=tab` rows, 5 `role=switch` groups | — |
| Look vs SET §4.10 / `p2_settings_steamvr.png` (by eye) | 2026-10-07 12:33 | `shot vr:systemui p2_c6b_general_t2c` (T2), `p2_c6b_video_t2b`, `p2_c6b_playarea_t2` (T1) composited over a grey room | Footprint, Back + "SteamVR" at Steam's title place, sidebar icon circles and the .18 selected pill, compact hero, platter rows with 3 px separators, 86 px refresh circles at 121, 92 px slider with the value on the knob, green switches, the Advanced ornament straddling the glass bottom: as the concept. T1 alone (flag off): the same without Back, icons, hero and switches (Off/On stay segmented) | `shots/p2_c6b_*_t2*.png` |
| G-PAD (`pad-bfs`) | — | not applicable | SteamVR's page has no Steam route and no gamepad focus of its own (SET §4.10: laser only); its gamepad path is T-VR-EXIT above (D-pad Left → tab bar). The Steam-side way in (`/settings/lgsvr`) is C6a's route | — |
| Native check (P7 M3) | 2026-10-07 12:29-12:31 | `native-session --flags wp.c6b --step "hv c6b_native --surface vr:systemui --pre <settings_open 9 s> --look" --step "sgcheck --route /settings/lgsvr"` | hv frame viewed, then deleted on both machines: SteamVR's page with T2 (Back, icons, hero, switches), but a **dark rectangle covers the left ~72 % of the panel** while the right column (the switches) sits on the panel's lighter glass: most likely glassd's cover of Steam's main window still drawn while the frame shows `system.settings` (REQ C6b->P8). sgcheck on `/settings/lgsvr` (the Steam-side way in): only R2 on the legacy `hdr-back` (5.54 mm) and `footer` (4.43 mm) pops, not C6b's. Back to CSS only: yes | — (frame deleted) |

## Log

### 2026-10-07 session 1 (10:50 onward), build 11094443

- Read card, SET §4.10/§4.12/§9.5, CTL §13/§19.2, PLAN §1.3-§1.7, tokens §1/§5, reporter §3, daemon §6.
- Live DOM probes (Steam lab lock held by a sleeping `js` step, then `js --in vr:systemui`): panel 1858 × 1045,
  sidebar 416 wide, 8 rows of 74, page container 1442 wide with 100 px padding; free pseudos (P-S6):
  `.SettingsMainPanel::before/::after`, `.SegmentedControlGroupOption::after`, `.SettingsSidebarPageContainer::before`
  are `none`; the page container scrolls natively (React props `onScroll`, no `onWheel`), so the sidebar's
  `overflow-y: auto` is scrolled by the same CEF wheel events; localisation tokens `#settings_togglebutton_off/_on`,
  `#settings_sectiontitle_*`; Chromium 126 (`:has()` supported).
