# C1a Shell chrome: adversarial review R2

Reviewer: independent agent (review R2). Package card: PLAN §2.4 "C1a Shell chrome"; builder's log `docs/phase2/wp/C1a.md`
(Status: READY with `wp.c1a`). Concept: `docs/phase2/concepts/window-nav.md` (WN). Steam build `11094443`.
Scratch evidence (JSON, logs, probes): `<scratchpad>/r2/` of this session; kept shots are `shots/p2_c1a_r2_*.png`.

## Status

**In progress** (started 2026-10-07 10:45 EDT; last update 11:50). Static review of code and fragments done. Live so far:
gates `main` AllGames (both modes), `/settings/system` laser, `vr:systemui` (both), pad-bfs Downloads / settings /
AllGames (with and without the flag, and `--stock`), lifecycle probe (3 flag cycles, idle), High Contrast probe.
Still queued: frame.menu and floatingfooter gates, more routes, CSS-only shots, conformance, perf, search-tab probe.
The device is heavily shared (many `lab: lock busy for 240 s`; other agents' native sessions turn native mode on
between steps), so every CSS-tier result below was checked for `native: off`. P7's Status says "Review R1 fixes in
progress", so no native session was run (hard rule 4).

Draft verdict: **fix** (major findings below; no blocker found so far).

## Findings (draft)

Majors (M) and minors (m) as found so far; each is re-checked before the final verdict.

- M1 `theme/vr/10-systemui.css` (C1a) fails G-OUTLINE on `vr:systemui` (P-42, must): the controller status card
  (§4) draws Phase 1's `--lgs-panel-rim`, a closed rim of 1–1.5 px hard inset lines. The same rim is on the More
  Options popout (§3.2), the gamepad-mode pill (§3.3) and every on-demand panel (§5); the More Options focused row is a
  2 px ring (`inset 0 0 0 2px var(--lgs-focus-outline)`, P-17); §3.2/§3.3/§5 still use `--lgs-t-fast`/`--lgs-ease`.
  More Options is not WN §3.5.2's thick glass (radius 44, 72-main-px rows) and the resize corner is SteamVR's hook
  restyled, not WN's concentric arc.
- M2 AT-17 (SteamVR chrome) has no evidence row; ledger rows SN-W1…W8 are all `open`; PLAN-1a-3 for
  `window-nav-chrome.html` compares only main's ornament (`C1a-cmp.json` maps the footer with `mockOrigin [320, -300]`),
  never the window-bar row the mockup is about.
- M3 High Contrast: `--lgs-c1a-tint` stays `.60 + 1 × .24 = .84` under `prefers-contrast: more` (probe), P4's
  `--lgs-mat-window-tint` is `.94` (REQ P4->C1a open): G-A11Y / FD-6's opaque glass misses on the main window.
- M4 Seven open REQs addressed to C1a are unanswered (C1b #9, C1c will-change, C2c REQ-9, C3b, C6a, P4, P6). Two of them
  have visible consequences (see M3, M5) and C1b #9 leaves Phase 1's `20-shell.css` §6 live (rings, rims, non-token
  transitions on the search route; out-specifies C1b's `box-shadow: none !important` on focused scope tabs).
- M5 (pending live look) toolbar-row conflicts the shell owns: the 520 capsule straddles the settings sidebar
  (REQ C6a->C1a); C2c's laser Sort/Filter group (right 24, up to 420 wide) can overlap the 536 px search box (x ≤ 908)
  whenever it is wider than 348 px (REQ C2c->C1a REQ-9).
- M6 Liquid Glass motion of the ornament is not built: capsule ↔ quiet switches instantly (WN §3.4.1 "materializes on
  materialize-in 250 / materialize-out 350", WN §7, PLAN §1.5's materialize row lists ornaments); legend-change fade and
  the backing's `snappy` width morph absent; the tab bar's width transition is Steam's 300 ms (WN §7: retimed).
- M7 READY / M4 claims are not supported by the card's tests: AT-4 not run as specified, AT-17 none, AT-23 has no
  tab-bar measurement, AT-24 (b) fails (slot 1), AT-2 guard fails (blocked on C2c), AT-7 partial, G-PERF absent;
  session 5 (M4) has no log section; its native look predates P7's R1 B1 fix (frame-menu copies half a capsule off)
  and G-HV was withheld, so M4 is not reached by PLAN §2.1's definition.
- m1 `teardownDom` removes `data-lgs-reveal` only from `#header`'s descendants; `reveal()` also sets it on `#header`,
  and P3's `attend(...).off()` leaves silently, so removing the module while the reveal shows leaves
  `#header[data-lgs-reveal]` (G-REMOVE).
- m2 The tab-bar capsules have no E3 edge (WN §8.1: arc + lobe ×1.10, dark edge 6 px .12); AT-23 never measured them.
- m3 P-07: ornament members are 4 px apart (+10 before the quiet group), so hit boxes do not abut (≤ 2).
- m4 More circle: no tooltip; `aria-label` empty in laser mode (WN §3.4.4 "Feedback").
- m5 The tab bar's +25 mm is P7's `tabBarDepth` flag, which neither WN nor C1a's interface table names;
  `tabBarAlways` alone gives no depth. `frame.menu` stays `laserOnly: true` in the reporter while C1a owns the surface.
- m6 Native: the windowless Back plate's hover/focus repaints the full raised fill over glassd's acked plate.
- m7 Back reveal and More/Options use layout transitions (`max-width`, `padding`) where LAB asks for
  opacity/scale/translate only.

## Evidence

(being written)
