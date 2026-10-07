# C6a Steam Settings: adversarial review R2

Reviewer: independent agent (review R2). Package card: PLAN §2.4 "C6a Steam Settings"; builder's log
`docs/phase2/wp/C6a.md` (Status: "READY: wp.c6a", 11:40, last touched 12:42). Concept: `docs/phase2/concepts/settings.md`
(SET). Steam build `11094443`. Files under test (md5 at 13:58, identical on the Frame): `theme/60-settings.css`
56b5214c, `device/rt/60-settings.js` 01963e3f, `theme/layers/60-settings.json` f82b8617. Scratch evidence (JSON, probe
scripts): `<scratchpad>/c6a_r2/` of this session. Kept shots: `shots/p2_c6a_r2_*.png`, `shots/p2_cmp_c6a_r2_system.png`
(DOM captures of the main window only; no room imagery is kept).

## Status

**In progress** (session 1, from 13:58; last update 14:45). The device is heavily shared: several `gates` steps
of this review met "lab: lock busy" (240 s) or ran during a native session and are being re-run; every CSS-tier verdict
below comes from a step whose `step:` line or result says `native=off`.

Done: binding documents and C6a's files read; live shots of `/settings/system` (both modes) and `/settings/storage`;
`gates` on system, internet, storage, bluetooth, power (more running); G-FOCUS (both modes); pad-bfs on
`/settings/system` themed and stock (default budget, truncated); destructive-tag probe on 11 pages; Hostname alert
opened and cancelled; Steam's source read for the settings confirmations and the page transition; one
`native-session` (5 `sgcheck`, the hero probe at 5 scroll positions, 2 `hv --look`, frames viewed and deleted).
Open: `gates` on the remaining routes, pad-bfs with a full budget, removal checks, D-pad sidebar walk (P-23),
`perf --ab`, `--media` checks, a second native session (hv of the scrolled hero).

Interim verdict: **fix** (majors below; list not final).

## Findings (interim)

- **M-A (major) A destructive confirmation pops +10 mm in native mode (PLAN §1.7 rule 4).** The Hostname alert
  ("Cancel" / "Change & Restart", SET §4.7's list) carries no `.Destructive`, no `data-lgs-destructive` and no
  `data-lgs-plate` (live, 14:3x, `--flags wp.c6a,wp.c1a,wp.p3,wp.c1c`). `native-session` `sgcheck --route /settings/system
  --pre <open Hostname>` (14:40:39): `main: 1 pops, depths [0.0, 10.0] mm, modal ['c1c-alert']`, PASS only because
  nothing is tagged. C6a's token list has `Settings_System_Change_Hostname_Set`, but `setTick` scans only the page
  content (`60-settings.js` lines 217–225), so every destructive button that lives in a settings modal (Hostname
  Change & Restart, the network-details Forget, Audio Reset's confirm) is never tagged; Steam builds them as plain
  `DialogButton`s (source: Hostname dialog `w.$n`, Audio Reset `GenericConfirmDialog` with `onOK`).
- **M-B (major) G-TYPE fails on `/settings/bluetooth`, both modes:** "NOT CONNECTED" 10 px, uppercase, tracking
  0.05 em (P-38, P-84 must). `60-settings.css` only recolours `%{BluetoothDeviceQuickAccessField>NotConnectedLabel}`;
  SET §4.8 asks for 18 px Semibold title case.
- **M-C (major) G-SIZE fails on `/settings/storage`, both modes:** the sort control `%{SortingDropDownControlButton}`
  "Size on Disk" is 156 × 28 (P-80; P-08 hit 55 %), and each row's art `%{LibraryItemBox}` 98 × 45 is a nested target
  (P-80; P-08 70 % own, 30 % its neighbour). The sort capsule is plain T1 work (SET §4.8: a value capsule).
- **M-D (major) Steam's settings page transition is untouched:** `translateY(±12%)` of the content (≈ 86 px), 320 ms
  `cubic-bezier(0,0,.1,1)` after an 80 ms delay, exit 8 % in 80 ms (Steam's CSS read live). VP P-54 (must, ≤ 16 px)
  and P-58; SET §7 row 1 gives this override to C6a. Not built, and not listed as not built.
- **M-E (major) The hero pops while it is under the toolbar fade and the search capsule.** Native hero probe
  (14:39–14:40): at `scrollTop` 24 and 40 the reporter keeps `settings-hero` at +10 mm with its slab and hole at CSS
  y 92 and y 76 (circle 76–136 at x 736–796), inside C6a's own mask band (transparent at 84, opaque at 116) and over
  the bottom of the search capsule (x 380–900, y to ≈ 88); dropped only from `scrollTop` 56, when its centre hits the
  search field. `sgcheck` passes (the toolbar row is not a forbidden box), so the crop carries a strip of the search
  capsule and a half-faded circle 10 mm forward over a full slab and contact shadow. SET §5: the hero is "dropped
  while its scroller moves" and is a compact hero that slides under the edge.
- **M-F (major) M0 and G-MOCK not done:** no `C6a-cmp.json`, no `data-id` in any `settings-*` mockup, concept text and
  mockups not conformed to PLAN §1 (still: hidden legend and E-ORN in T-AUD, selection .26, 760 column, magnifier,
  flat menus). `glass.py cmp` side by side only (`shots/p2_cmp_c6a_r2_system.png`, verdict below).
- **M-G (major) Most card tests never run** (T-ACC, T-HIT, T-MENU, T-DLG, T-MOT, T-PERF, T-A11Y, T-FONT, T-I18N,
  T-SHOT on 25 routes); the builder's gates covered 5 of 24 routes.
- Minor (interim): the selected-row arc overhangs the pill's left corner; Internet "Delete" (Web Browser Data) is not
  tagged; the 300 ms poll runs on every route; P-44 sidebar step < 8 L over grey and dark rooms; focused nav-row label
  ≈ 3.0 : 1 and the grey icon circle vanishes on the focused pill; Storage usage bar 8 px (SET: 24 px capsule).

## Requests

(none yet)
