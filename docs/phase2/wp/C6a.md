# C6a Steam Settings: evidence log

## Status

**R2 fix pass 1 in progress** (started about 17:00): B1, M1, m1, m2, m7, m8 edited (files promoted, `check-theme`
PASS); live re-check pending: the Frame stopped resolving (`getaddrinfo failed` from `sync` and the ssh helper)
right after the first probe. Until the live re-check lands, the READY line below is **suspended**.

Previous status (session 1): **READY: wp.c6a** (2026-10-07 11:40, session 1, build 11094443). With `wp.c6a` (and `wp.c1a`, `wp.p3`) on, no
GONE, HIDDEN, SHRUNK or UNCLICKABLE on `/settings/system`, `/notifications`, `/audio`, `/display`, `/storage`;
`/settings/system` gates PASS in pad mode (all five), `/settings/audio` PASS; `pad-bfs` on `/settings/system`
identical to the stock baseline (0 irreversible); the module installs in 0.3 ms with no runtime error and removes
cleanly (no `data-lgs-page|hero|title|destructive`, no style property left after the flag pops); native check:
`sgcheck` PASS, the hero pops +10 mm (1 pop, depths {0, 10}), `hv` viewed and deleted. Evidence in the log.

**Milestones:** M0 (note below, no re-render), **M2 reached for the settings skeleton** (sidebar, detail pane,
hero, notifications, audio, display, system); Storage M2 open (SIZE on Steam's small storage focusables = storage
T3). **M3 reached for the T2 card items built** (page keys and colours, hero glyph, "Settings" title via C1a,
destructive tags); T3 (drill-down, list page, Quick Access VR components), the System badge and the inline title
are not built (fallbacks below). **M4 fragment in and checked live** (`theme/layers/60-settings.json`).

**Open, owned by others:** REQ C6a->C1a (search capsule over the detail pane), REQ C6a->C4a (destructive look on
`[data-lgs-destructive]`, `%{ParentalWrapper}` E-SWITCH, wrapped 20 px descriptions). Gate runs from about 11:05
on were taken while other agents held native mode on (results say `native: on`, or flipped during the step): their
only failures are CONTRAST of text over the window, whose CSS tint is off in native mode; a CSS-only re-run is in
the log if it completed.

Files (all C6a's): `theme/60-settings.css` (= `theme/_wip/60-settings.css`), `device/rt/60-settings.js` (=
`device/rt/_wip/60-settings.js`), `theme/layers/60-settings.json`. `fontkit.py --hooks` regenerated the hook host
lists in `theme/03-material.css` / `04-states.css` (P4's generated blocks; any package may run it). Device left:
theme on, CSS only, no flags (lab steps pop their own; the 70 s overlays expired), no frames left.

## M0 note: SET conformed to PLAN §1 (decided here, no mockup re-render in this expedited session)

| # | SET says | PLAN §1 / gate says | Built |
|---|---|---|---|
| D1 | Generic ornament hidden (E-ORN, `visibility: hidden` on Select/Back) | §1.10: legends are never hidden, no audit exceptions; A+B only = C1a's quiet legend | Nothing hidden; the ornament is C1a's |
| D2 | Toolbar row 108 (CQ1) | §1.9: C1a ships `lgs-hdr-40` + `--lgs-hdr-pad` (CQ1 failed) | Sidebar list from y 108 (`--lgs-hdr-pad` + 40), content from y 116 (`--lgs-hdr-pad` + 48) |
| D3 | Search as a 60 px magnifier circle at (1196, 24) | §1.9: circle gated by WN AT-4; C1a's `searchCircle` stays off (AUD SHRUNK) | Capsule (C1a's). REQ C6a->C1a below. **Inline title not built**: it would sit under the capsule |
| D4 | Sidebar selection white .26 | §1.4: navigation selected = `--lgs-fill-nav` (.18) + arc + Semibold; focus = P4's `nav` hook | .18 + Semibold; focus from the hook (+.32) |
| D5 | Specular top arc (full width) | VP P-42 / G-OUTLINE: `--lgs-sel-arc` measured edge ratio 1.0 (a line) on the 368 px pill | The arc is a lobe at 30 % of the width on the row's hit extender (`::before`) |
| D6 | Hero circle 56 px | §1.7 admission rule 5: pops need ≥ 60 × 60 | 60 px circle |
| D7 | 760 px content column | G-AUD SHRUNK: long-value rows' 24 px labels shrank to 342 px (Timezone, build dates) | 816 px (pane 880 − 2 × 32) |
| D8 | Menus, list page, alerts flat (0) | §1.7: menus +10, alerts +10 / 0 destructive (C1c's fragments); list page 0 | Only the hero pops (+10, decorative); C1c owns menu/alert depth |
| D9 | Destructive red labels (T2 tags) | CTL/C4a: areas never restyle a primitive | T2 tags `data-lgs-destructive`; the look is REQ C6a->C4a |
| D10 | Storage has no hero | Steam renders `DialogHeader` "Storage" (keep: AUD) | Title only (Title 2), no circle; storage keeps stock's list height (G-AUD GONE on the virtualised list) |

## Native (M4)

- Fragment written: `theme/layers/60-settings.json` (rule `settings-hero`, `.DialogHeader::before` of a keyed
  page, +10 mm both profiles, `liquid` slab, `hole: true`, non-interactive, behind `wp.c6a`). JSON valid,
  `check-theme` PASS. No plates or popup fragments: the window cover is 00-base's `main.modes` (C1a's
  `data-lgs-glass="window"` on settings routes); menus/alerts are C1c's.
- **native check deferred to V1: P7 fix in progress.** P7's Status reads Complete, but the coordinator
  reported during this session (about 10:50) that P7's scene-graph fix is still in progress and holds the native
  lock, so no `native-session`, `sgcheck` or `hv` was run. V1: run `native-session --flags wp.c6a,wp.c1a,wp.p3
  --step "sgcheck --route /settings/system" --step "hv c6a_settings_native --look"`; expect one pop
  `settings-hero` at +10 mm (decorative, so no click-safe cap; 60 × 60), and no other C6a pop.

## Not built this session (documented fallbacks, SET §10)

- **T3 P-S1 drill-down wrapper** (About/Updates/Advanced sub-views, VR Settings page in Steam's list): fallback =
  Steam's single long page with the compact hero; VR Settings stays reachable from the tab bar.
- **T3 list page for > 8-option value menus**: fallback = C1c's menu slab (scrolling column).
- **P-S2 Quick Access VR components**: fallback = Quick Access › Performance.
- **System badge, inline title, magnifier circle** (D3).
- **Storage T3** (`rowHeight` 80, E-ROW58 tagging): rows stay Steam's 58 px virtualised rows.

## Requests

- [x] REQ C6a->C1a: on `data-lgs-route="settings"` the 520 px search capsule (x 380–900) straddles the 400 px
  sidebar and the detail pane. SET §3.4's fallback: centre it over the detail pane (x 840, i.e. 580–1100), or ship
  the circle at (1186, 14) once AT-4 passes (`searchCircle`). Then C6a can add the inline title.
  - **C1a answer (2026-10-07, R2 fix pass):** done: on `data-lgs-route="settings"` with the capsule variant the search field centres over the detail pane (x 840: visible 580–1100, hit 572–1108); the circle stays behind `searchCircle`.
- [ ] REQ C6a->C4a: (1) `button.DialogButton[data-lgs-destructive]` (C6a T2 tags Steam's destructive buttons by
  Steam's own localised labels: Factory Reset, Format, Unpair, Change & Restart, Reset, Clear All, Change
  password, Uninstall, Clear Cache, Forget) should take your `.Destructive` look (red label at rest, red whole
  fill on gamepad focus); Steam does not put `.Destructive` on them. (2) `%{ParentalWrapper}` (Notifications:
  the Panel around each switch) fails E-SWITCH "hit 62 % own over 86 × 80" (the switch's extender is the hit,
  the wrapper is the focusable). (3) `%{*GamepadDialogContent>FieldDescription}` at 20 px fails G-TYPE "body
  size 20 < 22" when it wraps to 2 lines (Audio: "Position sounds as if they are…", 76 chars, 686 px column).

## Requests to C6a, handled

- REQ C1a->C6a (padding): done. Sidebar list `padding-top: calc(var(--lgs-hdr-pad, 68px) + 40px)`, content
  `calc(var(--lgs-hdr-pad, 68px) + 48px)`; both scrollers use `--lgs-guard-top` / `--lgs-guard-bottom`
  (`scroll-padding`); the content scroller is cut at y 628 (`clip-path`), the sidebar list at y 94 (under the
  Back and search hit boxes).
- REQ C1a->C6a (quiet legend in `settings.css` mockup): acknowledged; mockups are not re-rendered in this
  expedited session. The live ornament is C1a's builder.
- REQ C1c->C6a (dropdown +10 mm, 56 px Cancel, layout by count, alerts +10 / 0 destructive, dark text on red):
  adopted as D8 (PLAN §1.7/§1.12 govern; C1c builds menus and alerts). Concept text not re-edited.
- REQ C4a->C6a (SteamVR refresh circles in `settings.css` mockup): acknowledged, mockup not re-rendered (the live
  SteamVR page is C6b's).
- REQ C4a->C6a (sidebar G-SIZE / G-TYPE, notification headers): done. Rows 72 at an 80 pitch with a 4 px hit
  extender each side (gates SIZE pass on `/settings/system`), labels 24 px Medium, navigation look; headers 18 px
  Semibold, title case, 94 px cells centred on C4a's switch columns.

## Log

### 2026-10-07 session 1 (09:50 onward), build 11094443

- Built T1 (`theme/60-settings.css`), T2 (`device/rt/60-settings.js`), fragment `theme/layers/60-settings.json`;
  `check-theme` PASS, `fontkit.py --hooks` rewritten (new `--lgs-ill` hosts: sidebar rows `nav`, recording modes
  and storage rows `row`, drive tabs `raised`/`white`), `--hooks-check` up to date, `status`: no unresolved token.
- T2 probes: sidebar items carry React key `/settings/<key>` (depth 5); keys on this build: system internet
  storage bluetooth display power audio controller keyboard accessibility security notifications friends
  downloads cloud ingame compatibility family remoteplay gamerecording home library store developer.
  `LocalizationManager.m_mapTokens` gives `MainTabsSettings` = "Settings" and the destructive tokens listed in
  the module.
- Shots: `set_p2_c6a_before.png` (Phase 1 file), `set_p2_c6a_t1.png` (CSS only), `set_p2_c6a_t2.png`
  (`wp.c6a,wp.c1a,wp.p3`: "Settings" Large Title, coloured icon circles, hero circle with Steam's glyph),
  `set_p2_c6a_padfocus.png` (pad focus on Internet: lit pill, page follows). Compared by eye with
  `p2_settings_system_t1.png`: same sidebar, hero and platters; drill-down rows absent (T3, not built).
- `gates main --route /settings/system --flags wp.c6a,wp.c1a,wp.p3`: **pad: PASS** (AUD 0 issues, SIZE, TYPE,
  OUTLINE, MOTION pass; `set_p2_c6a_gates_pad.png`); laser: SIZE/TYPE/OUTLINE/MOTION pass, AUD found
  CONTRAST on the selected label while the arc was a background layer (moved to `::before`; the pad run after
  the move has 0 AUD issues).
- `pad-bfs --route /settings/system` with the flags: 4 nodes (System → Down Internet, Right the language
  capsule, Up the search field, Left exits), 0 irreversible; **identical to the stock baseline** (`--stock`: the
  same 4 nodes and edges; the tool marks further nodes "untakeable" in both, as in C1a's log). B from the entry
  goes to the next page (Steam's history).
- Gates after the layout fixes (`--flags wp.c6a,wp.c1a,wp.p3`): `/settings/notifications` laser and pad: AUD
  PASS (0 issues), TYPE/OUTLINE/MOTION pass, SIZE fails only E-SWITCH on `%{ParentalWrapper}` (REQ C6a->C4a (2));
  headers centred over the switch columns (`set_p2_c6a_t2b.png`). `/settings/audio` pad: **PASS** (all five).
  `/settings/display` laser: SHRUNK on the column and two labels fixed (column fills the pane: `width: 100%`,
  margins inside it); re-run AUD: only CONTRAST lines measured while another agent held native mode on (`native:
  on` in the result: the CSS tint is off then), no GONE/HIDDEN/SHRUNK/UNCLICKABLE. `/settings/storage` laser and
  pad: AUD PASS after keeping the virtualised list's stock height (no GONE), TYPE/OUTLINE pass; SIZE still fails on
  Steam's small storage focusables (usage-bar segment 8 px, legend items 20 px, sort button 28 px, row art 98 × 45)
  = storage T3 (E-ROW58 / `rowHeight`), not built.
- **Native check (P7 complete):** `native-session` (pre: 70 s flag overlay `wp.c6a,wp.c1a,wp.p3`, `/settings/system`)
  1st run (10:52): `sgcheck` PASS but main had **0 pops**: P6 crops only absolutely placed pseudo-elements, and the
  hero circle was a flex `::before`. Fixed: the circle is an absolute `::before`, T2 measures the title's text width
  (`--lgs-set-hero-tw`, `data-lgs-hero`) so circle and title stay centred as one group. 2nd run (11:00):
  `__LGS_LAYERS.debug('main')` keeps `settings-hero` (x 1104, y 174, 90 × 90 texture px, r 45, dz 0.0271 = 10 mm,
  liquid slab, `interactive: false`, hole); **`sgcheck` PASS: main 1 pop, depths {0, 10} mm**, no rule failure.
  `hv c6a_native_sys2 --look`: the Settings window as clear glass over the room with the sidebar pills, platters
  and hero circle readable, quiet legend under the glass; G-HV verdict withheld (auto rect). Both frames viewed
  and deleted at once on both machines (`hv --clean`; Frame `/tmp/lgs/hv-*.png`: 0; no look folder left). Back to
  CSS only: yes (both sessions).
- Runtime: `settings` installs in 0.3 ms with `wp.c6a` (`rt.status`), no error or warning in the runtime log;
  `use('settings').status()` on `/settings/power`: page `power`, glyph, title "Settings", 25 marks.
- Final gate runs (12:37–12:45, `--flags wp.c6a,wp.c1a,wp.p3`, laser): `/settings/system` **PASS** (all five, AUD
  0 issues), `/settings/display` **PASS** (native off), `/settings/storage` (native off): AUD, TYPE, OUTLINE,
  MOTION pass, SIZE 10 fails on Steam's sort button (28 px) and the row art inside the 58 px virtualised rows
  (storage T3). A `pad-bfs` re-run at 12:3x happened while another agent's native session was live (1 node,
  "untakeable"; `native: on`): not comparable; the CSS-only run above (identical to stock) stands.
- G-REMOVE spot check: after the flag step, on `/settings/system`: 0 `data-lgs-page`, `data-lgs-hero`,
  `data-lgs-title`, `data-lgs-destructive`, no `--lgs-set-*` style property, module `off`. Destructive tags with
  the flag: System "Factory Reset", Audio "Reset", Developer "Format | Clear All | Change User Password".
- Device left: theme on, CSS only (`html` has no native class), route `/library/home`, no test flag overlay, no
  `wp.c6a` in `/tmp/lgs/flags.json` (it holds another agent's step flags), 0 headset frames on either machine.
