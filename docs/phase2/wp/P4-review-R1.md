# P4 CSS foundation: independent review, round R1

Reviewer: independent adversarial review agent. Date 2026-10-07, 06:58-07:55 (local clock). Steam build 11094443.
Scope: everything the builder reported for P4 as complete (FD-1 to FD-7, G-FOCUS, laser keying, the FocusRing plate,
REQ answers, contract `contracts/tokens.md`, decisions P4-D1 to P4-D12, the kit and DESIGN2 amendments).

**Verdict: fix.** There are two major findings and thirteen minor ones.

- **The acceptance numbers hold.** FD-1 to FD-7 reproduce, and FD-4 and FD-5 now also pass on the *integrated* theme,
  with no test style injected, because C1a, C1c and C4a have adopted the hooks.
- **M1 (performance).** The hook mechanism itself costs the library grid about 20 % of its scroll frame rate. The
  builder deferred this measurement and never made it (P4-D6).
- **M2 (FocusRing plate).** The plate, verified at 05:43, now draws a frame around focused capsule segments. C4a's
  rewrite at 05:48 changed what the plate sits on.

## 1. What was re-run

All live steps were taken through `python glass.py …` with locked lab commands. No flags were set, native mode was not
touched, and no setting values were changed. The only dialog used was the inventory's no-op lab CONFIRM, which closes
itself. Every shot below is Steam UI only: library posters, `/zoo`, Settings › Notifications. No room frames were taken.

| Test | Command | Result | Agrees with builder? |
|---|---|---|---|
| Offline | `python glass.py check-theme` | PASS (43 files) | yes |
| FD-1 | `python glass.py status` | `unresolved: []`, `ambiguous: []` on the Steam bundle (637,072 bytes now) and on `vr:systemui` and `vr:controllerbindingui` (114,045 bytes); `LGS Inter 100 900 loaded` in both pages | yes |
| FD-2 font | `python glass.py js "<fd2.js: per popup window fonts.load/check, faces, canvas widths, computed families, size of the @font-face block>"` | All nine Steam windows (main, keyboard, notifications, bar, barpopup, tooltip, volumelevel, floatingfooter, frame.menu): `check` true, face `loaded`, no load error; body and labels compute `"LGS Inter", "Motiva Sans", …`; the `@font-face` block is 162,398 bytes in each window's bundle | yes |
| FD-2 CJK | `glass.py js "<cjk.js: canvas render of 日本語中文한국어 with our stack vs Steam's stack vs an unassigned-codepoint string>"` on main, `--in vr:systemui`, `--in vr:controllerbindingui` | main: our stack's pixels are **identical** to Steam's stack (same hash) and differ from the tofu string. SteamVR pages: equal ink, and different from tofu. The CJK fall-through works. (The builder's width test cannot prove this: with an unknown family the width is also 306.2, the same value.) | yes (better evidence) |
| FD-3 | `python docs/phase2/fontkit.py --parity` | kit 166 tokens, theme 315; 163 shared, 163 equal: PASS. The recipes are not covered (m10) | yes |
| FD-4 window, integrated | `glass.py shot main p2_p4rev_edge_window --route /library/tab/AllGames`; `glass.py edge shots/p2_p4rev_edge_window.png 0 120 1800` (and row 1) | ratio **0.03** (C1a's `--lgs-edge: window`, no test style) | yes |
| FD-4 CONFIRM, integrated | `glass.py shot main p2_p4rev_edge_alert --route /library/tab/AllGames --mode pad --pre "<lab CONFIRM, self-closing>"`; `glass.py edge … 296 540 1380` and row 297 | ratio **0.00–0.01** (C1c's thick card with P4's edge). Viewed next to `shots/p2_window-nav_alert.png`: the arc and lobe show on the top left and there is no outline | yes |
| FD-5 `/zoo/buttons` | `glass.py focus main --route /zoo/buttons --mode pad --pairs <pairs_rows.json> --keep p2_p4rev_fd5_rows` | row 0 focus vs rest **+92.5 L**; button 0 (lifted, in the lit row) **+85.3**, the builder's number exactly; disabled row +29.3; disabled button +34.1: PASS | yes |
| FD-5 on a live alert (new) | `glass.py focus main --route /library/tab/AllGames --mode pad --pairs <pairs_glow.json> --keep p2_p4rev_alertfocus` | P-16: band 8–16 px around the focused blue OK **+34.5 L**; P-14: Cancel **+69.9 L**: PASS | — |
| FD-5 `/zoo/toggles` | `glass.py shot main p2_p4rev_zoo_tog{0,1}_pad --route /zoo/toggles --mode pad --pre "L.gpTakeEl(…)"`, viewed | The row carries the focus and the green switch glows. See m1 for the row's top line | yes |
| FD-6 Reduce Motion | `glass.py gates main --route /zoo/buttons --only motion --mode pad --media reduce --pre "<focus button 0>" --json` | PASS (no non-token durations, nothing running at rest) | yes |
| FD-6 High Contrast | `glass.py shot main p2_p4rev_fd6_contrast_zoo --route /zoo/toggles --mode pad --media contrast …` + probe | P4's part works: `--lgs-dial` 1, `--lgs-mat-window-bg` .94, and the edge `::before` is the 2 px white .70 stroke. But the **live window tint is .84**, not opaque (m6) | partly |
| FD-7 | `grep -o "\[A<n>[],]" DESIGN2.md`; read §0.3 | A1 11, A2 4, A3 14, A4 6, A5 11, A6 3, A7 2, A8 3, A9–A11 1 each, A12 3, A13 3; §0.3 register present: PASS (two leftover contradictions, m9) | yes |
| P-02 / laser keying | `glass.py focus main --route /zoo/buttons --mode laser --pairs <pairs_laser.json> --keep p2_p4rev_laser`; probe of the FocusRing under `--mode laser` | A stale `.gpfocus` paints nothing: the row luma is identical (61.0 vs 61.0, shots 3 and 4); the ring's `opacity` is 0; `--lgs-focus` is 0 | yes |
| P-03 laser hover (new) | same run, real CDP hover (`@hover`) | button +25.7 L, row (label area) +35.6 L over the transparent window (m7) | builder had no test |
| G-REMOVE (new) | `glass.py js "<remove.js>" --stock` (the real `lgs off` path inside the lock), then the same themed | Theme off, in all nine windows: no `lgs-*` class, no lgs `<style>`, no `LGS` font face, `--lgs-focus` / `--lgs-focus-add` unregistered (empty), body back to Motiva Sans. Theme given back at the lock exit | builder had no test |
| Font sweep vs icon fonts (new) | `glass.py js "<fams.js>" --stock` and themed, on `/zoo/glyphs`, `/zoo/typography`, `/library/home`, `/settings/keyboard` | No text element uses a family other than Motiva Sans in stock, and none other than LGS Inter themed. The `:where(:not(code…))` sweep replaces no icon font | — |
| G-MOTION at rest with the FocusRing (new) | `glass.py gates main --route /settings/notifications --only motion --mode pad --pre "<focus radio 1>"` | Nothing running at rest (the plate kills Steam's pulse). One non-token transition, 140 ms box-shadow on the sidebar item, comes from P4's Phase 1 alias `--lgs-t-fast` (m4) | — |
| Conformance (new) | `glass.py conformance --route /zoo/buttons --route /settings/notifications --only P-01,P-02,P-17,P-42,P-43,P-45,P-52,P-58,P-89 --mode pad` | P-02, P-17, P-42, P-43, P-45, P-52, P-58 PASS. P-01 FAIL (170 selectors; one is P4's, m5). P-89 FAIL (C4a's hover reveals, not P4) | — |
| **G-PERF of the hooks (new)** | `glass.py perf main --route /library/tab/AllGames`; then `glass.py js "<perfab.js>"`: 3 paired rounds of `L.perf('main', 4000)` with P4's 17 hook rules present and then removed through CSSOM (`deleteRule`, re-inserted after; the sheet digest was checked equal afterwards). Variants: hooks present but nobody opting in; ill rules only; edge and band rules only. `/library/home` and `/settings/display` as controls | **M1** | builder had no test |
| **FocusRing plate, integrated (new)** | `glass.py shot main p2_p4rev_ring_{0,1} --route /settings/notifications --mode pad --pre "<scroll radio i into view, L.gpTakeEl>"`; computed-style probe of the segment, its `::after` and `%{FocusRing}` | **M2** | builder's shot predates C4a's segments |

## 2. Findings

### Major

**M1. The hook rules cost the library grid about 20 % of its scroll frame rate (G-PERF fails).**
`theme/03-material.css` §1 and §3 and `theme/04-states.css` §2 put universal rules, `*::before` and `*::after`, inside
`@container style(--lgs-edge|--lgs-ill|--lgs-scroll-band: …)`. There are 17 of them.

- **Whole theme.** `glass.py perf main --route /library/tab/AllGames` gives:
  - stock: 77.1 fps, p95 22.2 ms, 3 long frames;
  - themed: 59.4 fps, p95 44.9 ms, 12 long frames.
  G-PERF allows 5 % and no new frames over 34 ms.
- **Isolation.** Four paired runs (12 rounds), removing only P4's 17 rules from the live sheet and putting them back:

  | | With the rules | Without them |
  |---|---|---|
  | fps (per-run means) | 61.4, 53.8, 53.0, 65.1 | 74.7, 72.0, 71.0, 81.0 |
  | Drop | | −18 % to −25 % |
  | p95 | 44–88 ms | 22–33 ms |
  | Long frames per 4 s | 13–18 | 0–11 |

- **Cause: the presence of the rules, not their painting.**
  - On this route only 7 elements opt in (5 `ill: raised`, 2 edges).
  - Forcing every element to a non-matching value (`* { --lgs-ill: zz !important; … }`) does not recover the frames.
  - Removing only the ill family, or only the edge and band families, recovers little. Any remaining universal
    pseudo-element family keeps most of the cost.
  - The likely mechanism: every element must resolve its `::before` / `::after` style. That is cheap on static pages
    but expensive while the virtualised poster grid creates and recycles nodes as it scrolls.
- **Controls.** No measurable cost on `/library/home` (88–89 fps either way) or on `/settings/display` (86–90).
- **Why it matters.** It fails G-PERF for C2c's library with any area CSS, and for every scroll-heavy route (Downloads,
  Photos grid, search results, store lists). P4-D6 promised "Cost to be measured (G-PERF)"; the log has no such
  measurement.
- **Fix.**
  1. Remove the universal subjects.
     - Option a: publish the light and edge as custom-property recipes (`--lgs-ill-bg`, `--lgs-ill-shadow`,
       `--lgs-edge-bg`, … computed from the state numbers through `inherit`) that areas place on their own
       `%{X}::after` selectors.
     - Option b: narrow the subject to a short list of hookable elements and re-measure.
  2. Add `glass.py perf main --route /library/tab/AllGames` (themed vs stock, and with vs without the hooks) to the P4
     log as a gate.

**M2. The FocusRing plate draws a frame around focused capsule segments, doubles their glow and greys the label on white.**
`theme/04-states.css` §3, live on Settings › Notifications, "Flash window when I receive a chat message". See
`shots/p2_p4rev_ring_0.png` and `_1.png` and the crops viewed during the review.

- **Two lighting layers.** Since C4a's M2 rewrite (05:48) the radio segments are 60 px capsules (radius 30) with
  their own P4 hook: `--lgs-ill: white` on the selected one, the light layer on the others. Steam still draws its
  `%{FocusRing}` overlay **above** the segment, so the focused segment now carries two layers:
  - C4a's `::after` glow, `0 0 22px 8px` white .55 (computed);
  - P4's plate: white .12, the .16 spot and `0 0 22px 6px` white .44, with radius `min(24px, 50%)` = **24 px**.
- **On the white "Always" segment:**
  - the plate's 24 px corners stick out past the capsule's 30 px ends, so a grey rounded-rectangle frame surrounds the
    white pill, with dark crescents at its ends;
  - the plate sits above the label, so the label goes from `#0d0e12` (rest) to **rgb(65, 66, 69)** (darkest pixel).
    VP P-10 asks for the light under the label.
- **On the dark segment.** The horizontal profile at the capsule's vertical centre reads: interior 125, then a
  **3 px band at 49**, then the glow at 96. That is a dark ring between the lit capsule and its halo. The top edge has
  a +32 L line (row 701: 193 against 161 inside).
- **Against the mockup.** The "On + focus" cell of `shots/p2_controls_states.png` shows a clean white capsule with a
  soft glow and no frame. The quality bar is "no outlines"; this reads as a focus ring (P-17's intent).
- **Why the builder missed it.** The builder's plate verification (`p2_p4_focusring_settings.png`, 05:43) was taken on
  Phase 1's 40 px segments, before C4a's rewrite. The contract (§3.4) still says the plate is "the only focus cue for
  radio segments", which is no longer true.
- **Fix.**
  - Where the focused control carries its own hook, the plate should paint nothing: no fill, no glow. For example
    `body:has(:is(.RadioButton, …).gpfocus) %{FocusRing} { background: none; box-shadow: none }`, or a switch that
    areas set and the plate queries.
  - Where it still paints, it should be a capsule (`border-radius: 999px`) for capsule targets.
  - Re-shoot "Always" and "Only when minimized" against the mockup cell, and amend contract §3.4.

### Minor

- **m1. The focus arc draws a full-width top line on wide rows.**
  - The `inset 0 1.5px 1.5px -1px` arc at `--lgs-focus-arc` .55 is uniform along the top edge.
  - On a 952 px focused row (`/zoo/toggles`, `p2_p4rev_zoo_tog1_pad.png`) it is a +45 L line (row 282: 164–174
    against 113–129 inside). `glass.py edge … 283 460 1850` gives ratio 0.89.
  - It reads as a glossy lip at 1:1, but it is the "full-width line" WN D-15 removed from glass.
  - PLAN §1.4 says the control's arc ×1.5 (.22 × 1.5 = .33), and P4 uses .55.
  - Suggestion: for the `row` and `nav` kinds use the E3 conic (non-uniform) or the PLAN value.
- **m2. Contract §6 promises a lens interface that does not exist.**
  - The contract says "areas declare lens targets with the class `lgs-lens` … P4 reads it".
  - `device/lgs_lens.js` is unchanged since Phase 1. The lens is driven only by `theme/lens.json`, which does not
    exist, so `lensed: 0`. Nothing reads `.lgs-lens`, and no area uses it yet.
  - PLAN §6's migration row for the lens is not done. Either build it (with a REQ to P1 for the core's sweep) or state
    in the contract that it is not built.
- **m3. SteamVR pages get no hooks and keep Phase 1 rings.**
  - `03-material.css` and `04-states.css` are not bundled into SteamVR pages. A probe of `vr:systemui` finds no
    `style(--lgs-edge|ill)` rules. C1a had to work around this (`wp/C1a.md`: "P4's edge hook is not bundled into
    SteamVR pages"). The contract does not say so.
  - `theme/vr/00-vr-tokens.css` (P4's) still defines `--lgs-vr-hover-rim` (`inset 0 0 0 1.5px`, a uniform ring) and
    `--lgs-vr-focus-ring` (a 2 px plus 1 px ring). Thirteen rules in `vr/10`–`60` use them.
  - D2 §6.2 R1 was applied to the Steam rim tokens but not to these.
  - Make the hover rim ring-free (or document it as a Phase 1 alias), and either document the hook limitation or carry
    the hooks into `vr/00-vr-tokens.css`, which is a wrapped file P4 owns (after M1's fix).
- **m4. The Phase 1 duration aliases are not tokens.**
  - `--lgs-t-fast/-t/-t-slow` stay at 140/220/320 ms, while `--lgs-spring` and `--lgs-ease` were re-pointed to P5's
    springs. That is a spring curve played at an arbitrary duration.
  - D2 §11.3 says P5's curves "replace Phase 1's `--lgs-spring` and its 140/220/320 ms durations".
  - Live, G-MOTION on `/settings/notifications` reports a non-token 140 ms transition from Phase 1's settings CSS
    through this alias.
  - Map the aliases to `--lgs-d-interactive` / `-hover-in` / `-fade`, or record the deviation.
- **m5. One P4 rule trips the P-01 check.** `04-states.css:123`,
  `:is(:hover, .gpfocus, .gpfocuswithin, :active, .lgs-pressed)::after`, is unscoped. It only sets transition
  timing, so it is harmless, but it is one of the 170 selectors P-01 reports. Scope it by mode, as §1 is scoped.
- **m6. FD-6's "opaque glass" holds only on P4's fixture.**
  - Live in High Contrast, the window (`%{BasicUiRoot}`) is `rgb(20 22 30 / .84)`, because C1a paints it with its
    own `--lgs-c1a-tint` formula, not `--lgs-mat-window-bg` (which is .94 in High Contrast).
  - The bundler appends the remembered dial last (`html.lgs-on { --lgs-dial: X }`, `device/lgs.py:289`). If a user
    has set a dial, it beats P4's High Contrast `--lgs-dial: 1`.
  - File REQ P4->C1a, and give the High Contrast dial rule higher specificity.
- **m7. P-03 (laser hover +10 to +25 L) was never measured by the builder.**
  - With a real hover: button +25.7 L, row +35.6 L. This was over the transparent window (alpha dropped), which is the
    dark end of the band.
  - Measure on the P4 fixture over the dim and bright rooms, and tune `--lgs-hover-add` or the row spot if it is over
    +25.
- **m8. The window rim stays lit under a scrim.**
  - P4-D12 puts the window rim at z 20000, above Steam's modal overlay (1500).
  - Under an alert scrim the window interior dims (23 → 13) but the rim barely does (150 → 134), so it stands out
    more on a dimmed window (`p2_p4rev_edge_alert.png` against `_window.png`).
  - Consider a z between the header (6000) and the modal layer, or dimming the rim while `.ModalOverlayBackground` is
    active.
- **m9. Two DESIGN2 lines contradict A5.**
  - §7.6 says sidebar rows "hover/focus adds white .08 / .14". A5: navigation-row hover is the spot only, and focus is
    .32.
  - §7.8 calls the poster sheen "`plus-lighter`". As built (P4-D5) it uses normal compositing.
- **m10. The kit and the theme differ in their recipes.** The parity check covers only `--lg-*` tokens.
  - The kit's E3 bottom stop is .20; the theme's is .16.
  - The kit's focus rim is .75; the theme's is .62 × 1.5.
  - `kit.css:332` still says "+ .28".
- **m11. A selector name in the contract is wrong.** Contract §3.1 lists `%{*Field>Disabled}`; the CSS uses
  `%{*GamepadDialogContent>Disabled}`.
- **m12. The shipped default has no input-mode classes.**
  - `wp.p3` is off by default (`glass.py status`), so no window has `lgs-input-*`. P4's states then run in
    "runtime off" mode: a stale `.gpfocus` lights under the laser, and a parked pointer's `:hover` lights in pad mode.
  - P4's laser keying passes only with the lab's class stub. This is not P4's switch to flip; V1 should note it for
    `defaults.json`.
- **m13. Session 1's scratch is still on the Frame.** `/tmp/lgs/p4/` holds `p4_hooks.py` and `rects.json`. It is
  RAM-only and harmless; delete it at the next session.

## 3. Checklist

- **(a) Ownership.**
  - The changed files are all P4's: `theme/00-tokens.nowrap.css`, `03-material.css`, `04-states.css`, `DESIGN2.md`,
    `contracts/tokens.md`, `fontkit.py`, `kit.css`, `kit.js`, `_example.html`, `wp/P4.md`. Session 1 also wrote
    `01-font.nowrap.css`, `vr/00-vr-tokens.css` and `theme/fonts/`.
  - In `wp/C1a`, `C1c`, `C3a`, `C4a`, `P3` and `P5`, P4's diff lines are REQ answers only (checked with
    `git diff -U0 … | grep P4`).
  - `shots/p2_example.png` is the render of P4's own `_example.html`.
  - `device/lgs_lens.js` is untouched (m2).
  - Result: no violation.
- **(b) Safety.**
  - P4 has no runtime code and nothing that persists.
  - G-REMOVE passes on every Steam window. SteamVR font removal is P8's `disable()`.
  - The builder used only the no-op lab dialog and focus moves (no A presses) and took no room frames. Scratch is left
    on the Frame (m13).
- **(c) Robustness.**
  - Every saved file parses (`check-theme`).
  - The hooks are opt-in. Nothing runs at rest: the plate disables Steam's pulse.
  - The weak point is cost (M1).
- **(d) Conformance.** P-02, P-14, P-15 (fixture), P-16, P-17 (DOM), P-42, P-43, P-45, P-52 and P-58 pass. P-01 has
  one P4 selector (m5). P-03 is unproven (m7). P-10 fails at the FocusRing plate (M2).
- **(e) Function retention.**
  - P4 paints only `pointer-events: none` pseudo-elements and the FocusRing.
  - Steam removes the ring element when focus leaves, so the forced `opacity: 1` never resurrects a ring.
  - The font sweep displaces no icon font.
  - No laser or gamepad path changes.
- **(f) Visual quality.**
  - The window and alert edges read as light (arc and lobe, ratios 0.00 to 0.03).
  - Focus reads clearly in both modes.
  - The misses against "no outlines" are the FocusRing frame (M2) and the full-width focus lip on wide rows (m1).

## 4. Device left as found

- Theme on, CSS-only. Native mode was never entered by this review.
- No flags were set.
- Every probe navigated back to the route it found.
- The pointer was returned by the lab's lock exits.
- Review globals in SharedJSContext were deleted (`__P4REV_*`: 0 left).
- No files were written on the Frame.
- Review shots are kept as `shots/p2_p4rev_*.png` (Steam UI only, no personal names).
