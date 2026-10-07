# P6 Compositor, Steam side: review R1

Reviewer: independent adversarial review of P6 round R1 (builder report: M3 / complete). Date 2026-10-07, 07:00-07:45. Steam build 11094443 (`/tmp/lgs/steam-build.json`). Every device step ran through `python glass.py ...` or the steam-frame-ssh helper under the lab locks; native work only inside `glass.py native-session`.

**Verdict: fix** (2 major, 10 minor, no blocker).

The reporter, fragments and popup wrapper work as the card asks. I re-ran every acceptance test on the Frame and RP-1 to RP-8 and RP-X pass, with one RP-6 harness flake. Removal is clean.

Two things block acceptance:

1. In native mode, `05-native.css` does not drop the CSS glass on every acknowledged element. The popped bottom ornament keeps its CSS E3 edge and its liquid tint above glassd's slab. The window cover keeps a CSS top sheen.
2. The popup wrapper ignores flag changes while a popup is shown. A flagged host entry does not apply when its flag turns on. A flagged change would stay after the flag turns off, so a lab `--flags` step could leave its effect behind.

## Re-run results

Harness: the builder's `p6test.py` copied to `/tmp/lgs/p6r/`. The files under test were taken fresh from the synced tree; their md5 hashes match the working tree. `p1_layers.js` is checked as `b8fea9a:device/lgs_layers.js` with `__LGS_LAYERS` renamed. My own probes are `rv6*.py`, `rvflag.py` and `rvperf.py` in the same folder. That folder is in RAM: the files hold no camera data and no names.

| Test | Command | Result | Output |
|---|---|---|---|
| RP-1 | `p6test.py rp1` | **PASS**. The surfaces are byte-identical with Phase 1 on `/library/home`, AllGames, AllGames after `L.pad('down')`, and `/library/app/735580`. Both the fragment form and the Phase 1 object form match | `rp1.json` |
| RP-2 | `p6test.py rp2` | **PASS**. 20 plates with the right materials and rects. Window mode is 1920 × 984 r 81, window-full is 1920 × 1080, and windowless has `shapes: []` and 4 mosaic bands | `rp2.json` |
| RP-3/4/5 | `p6test.py rp345` | **PASS** on all three | `rp345.json` |
| RP-6 | `p6test.py rp6`, run twice | First run **FAIL**: the pad state reported `card: null` 400 ms after the D-pad move, while laser, sweep and rest all passed. Second run **PASS**. An independent probe (`rv6.py`) reported the pad lift on the focused poster at 0.3, 0.8 and 1.6 s after each of 4 moves (down, down, right, up). See minor m1 | `rp6.json`, `rp6b.json`, `rv6.json` |
| RP-7 | `p6test.py rp7` | **PASS**, 13 of 13 checks. Systemui z changed 0.0919 → 0.0500 and meters-per-pixel ×1.25; both were restored. Both TTL cases restored Steam | `rp7.json` |
| RP-8 | `glass.py native-session --step "eval SharedJSContext @/tmp/lgs/p6r/rp8.js" --step 'js "..."'` (real glassd) | **PASS**, 8 of 8. Plates were acked in 600 ms; fill transparent, shadow `none`; 4 tagged pops = 4 acked. Back to CSS only. The harness checks too little, though: see major M1 | `scratchpad/rv/native1.txt` |
| RP-X | `p6test.py rpx` | **PASS**, 18 of 18 | `rpx.json` |
| Cost | `rvperf.py`: `rpperf` with the injection order swapped | Not convincing. The builder ran Phase 1 first and got v3 2.0 ms against Phase 1 3.55 ms. With v3 first, v3 takes **3.4 ms** and Phase 1 **1.87 ms**. Whichever runs first pays for the layout flush, so the two cost about the same. See m2 | `rvperf.json` |
| G-DEPTH (info) | `native-session --step "sgcheck --route R"` for AllGames, Home and the game page | FAIL on all three. Every failure is a **legacy** pop: R2 depths 3-7.5 mm are outside the set; R5 `tab-arrow` is 32 × 32 and `play` is 240 × 54; R7 finds 5 depths on the game page. Expected until the areas supersede the legacy rules (PLAN §6); see m3 | `native1.txt` |
| G-REMOVE (P6 part) | `glass.py js` after the native sessions | **PASS**. No `__LGS_LAYERS*`, `__LGS_POPUPS*` or `__LGS_P6*` global; no `data-lgs-cover`, `-pop`, `-plate-ack`, `-noslab` or `data-lgst-*` attribute and no fixture in any window; no own method on `vrPooledPopupStore`; `lgs-native` is on 0 windows | stdout |
| Flag following (new) | `rvflag.py` (wp.p6 on, test popup, `apply([00-base, entry with "flag": "p6RevFlag"])`, then the flag pushed on and popped) | **FAIL**. The request stayed `z_pixels 60` for 2 s with the flag on, although the entry asks for `z 0.05`. See M2 | `rvflag.json` |
| Native visuals | `native-session --step "shot main p2_p6_rev_native_{allgames,home}"`, plus CSS-only shots `p2_p6_rev_css_*`; native PNGs composited over a glass tone rgb(62 66 78) | Clean except the footer edge and tint and the window sheen (M1). The overlapping header on AllGames (the search field over the tab row) appears in CSS-only mode too: not P6 | `shots/p2_p6_rev_*.png` |

## Findings

### Major

**M1. Native mode keeps CSS glass on acknowledged elements that are not painted through tokens.**

- **Files:** `theme/05-native.css` §4, contract `reporter.md` §8.
- **What I measured** (native session, 07:24 and 07:31, `/library/tab/AllGames` and `/library/app/735580`):
  - `#Footer` is popped (`data-lgs-pop="after"`, acked as `footer`).
  - Its computed `--lgs-edge` is still `liquid`, so P4's E3 arc on `#Footer::before` stays: a conic gradient with a white .682 arc at the top.
  - `#Footer::after` keeps C1a's literal liquid tint (`linear-gradient(rgb(255 255 255 / .12), rgb(255 255 255 / .03) 55%)` over a dark tint, with backdrop blur).
  - In `p2_p6_rev_native_allgames.png`, the footer's top edge at (960, 942-943) is white rgb ≈ 200 at alpha 196, the same as in CSS-only mode. glassd's liquid slab under that crop draws its own crescent, so the headset shows a doubled edge and a doubled tint.
  - The acked main cover keeps `%{BasicUiRoot}::after` with a white .08 → 0 top sheen (C1a, `20-shell.css` around line 91) above glassd's window glass.
- **Why it happens:**
  - §4 sets `--lgs-edge: none` only on `[data-lgs-pop~="self"]`. When the popped part is a pseudo-element, the host's E3 edge belongs to that pseudo capsule, and it is never turned off.
  - §4 zeroes only `--lgs-mat-*` tokens, and C1a paints these capsules with literal colours.
  - Contract §8 promises "tint, shading and E3 edge go" for every popped part. RP-8 passed because it checks only `--lgs-glass-bg` on the footer and one token on Back.
- **Fix:**
  - In `05-native.css`, turn off `--lgs-edge` on hosts of popped `before`/`after` parts that are not glass themselves (today only `#Footer` qualifies; a generic `[data-lgs-pop~="after"]:not([data-lgs-pop~="self"]):not([data-lgs-noslab~="after"])` works).
  - On the acked main cover, set `background: none` on `::after`.
  - File a REQ asking C1a to paint the window sheen and the footer capsule through `--lgs-mat-liquid-*` / `--lgs-mat-window-*`, or to key native rules on `[data-lgs-pop~="after"]`.
  - Extend RP-8 to read the computed paint (background-image, box-shadow, `--lgs-edge` and the host's `::before`) of every tagged element.

**M2. The popup wrapper does not follow flag (or geometry) changes on popups that are already shown.**

- **File:** `device/rt/08-popups.js`.
- **The gap:** `entryFor()` checks an entry's `flag` only inside `transform()`, which runs only when Steam sends a request. The module never subscribes to `rt.flags.on` / `onAny` (P1 provides both, runtime.md §3.4) or to `rt.bridge` `geom`.
- **Live evidence (`rvflag.json`):** with `wp.p6` on and a shown test popup matched by an entry `{"z": 0.05, "flag": "p6RevFlag"}`, pushing `p6RevFlag` changed nothing in 2 s (`z_pixels 60`, no `z_meters`).
- **The reverse case:** a flag that goes off leaves the changed request in place until Steam happens to re-send. The frame menu, the tab bar of PLAN §1.7 and the wrapper's main client, stays shown and is rarely re-sent.
- **Consequences:**
  - A lab step with `--flags tabBarDepth` (or `tabBarAlways`) tests nothing on the live tab bar.
  - If the step does apply something, the change can outlast the step (team rule 9: no flag effect left behind).
  - A change of `r` leaves `zMm` entries stale.
- **Why it is latent:** no fragment in the tree uses a flagged popup entry yet, and `wp.p6` is off.
- **Fix:** in `install`, subscribe with `rt.flags.onAny` and the `rt.bridge` geom listener, and call `resendLive(false)` (a re-send is idempotent); add the case to RP-7.

### Minor

- **m1. The RP-6 harness depends on where focus is at route entry.**
  - Sometimes focus is not on a poster when the route opens; the failing run's first poster was unscaled, 172 × 258.
  - The D-pad move then lands on a poster that is still running its focus-scale animation. The reporter skips it (`animating (new)`) past the 400 ms sample.
  - The mechanism itself is fine (`rv6.json`). Put focus on the first poster before the move, or poll for up to 1.2 s.
- **m2. The cost claim is an artifact of run order** (see the table). Say "same cost as Phase 1" in the log, or alternate the injection order between runs.
- **m3. Legacy pops fail G-DEPTH on every route**, and the R2/R5 failures are P-46/P-47 "must" items.
  - This is expected under PLAN §6.
  - Nothing yet records which area supersedes which legacy id, so `99-legacy.json` has no path to empty.
  - Proposed mapping, by PLAN §1.1 ownership: `hdr-back`, `hdr-search` and `footer` to C1a; `tabs`, `tab-arrow`, `sort-filter` and `card` to C2c/C2a; `play` and `app-button` to C5a; `menu`, `sheet`, `sheet-panel` and `filters` to C1c; `button` to whoever claims it.
  - Suggest adding this table to `reporter.md`.
- **m4. Rule 7 counts only admission pops** (`lgs_layers.js` around line 1407). On a mixed route (area plus legacy) the reporter stays silent at 6-7 depths. The card asks for a warning "when a route shows more than 4 distinct dz". Count every kept layer, and mark the legacy ones in the warning.
- **m5. Duplicate-id handling ignores flags** (`compile`, `ids` set).
  - An area rule that reuses a legacy id (say `card` behind `wp.c2a`) always knocks the legacy rule out as a "duplicate", even while the area flag is off.
  - The flag-gated supersedes path is meant to bring the legacy rule back in that case.
  - Make the duplicate check flag-aware, or document "never reuse a legacy id; use supersedes".
- **m6. A rule-level `"admission": false` silently bypasses every admission rule in any fragment.** The contract allows `false` only at fragment level, for `99-legacy.json`. Ignore it outside `99-legacy.json`, or report it in `errors`.
- **m7. Rule 2 counts only focusables inside the popped element.** PLAN §1.7 says "the smallest visible focusable that **intersects the crop**". A neighbour that an `outset` covers is not counted. Low risk; align the code or record the deviation.
- **m8. RP-7's frame-menu check reads back what the wrapper itself wrote.**
  - Systemui reports `only-visible-with-laser: false` for the frame menu in every state, so the check proves only the request.
  - The effect is unverified: record it as PLAUSIBLE (needs a wearer) in the log.
  - `zMm`/`space` conversion is not exercised live either: RP-7 uses `z`.
- **m9. Runtime-contract hygiene in `08-popups.js`:**
  - It uses a raw `setInterval` and a global `__LGS_POPUPS_API`. runtime.md rules 3-4 prefer `rt.setInterval` and an API returned from `install`.
  - It defines `__LGS_POPUPS_MODULE` at load time when no runtime is present.
  - `restored()` leaves an empty `offset: {}` on a request that had none.
- **m10. Evidence log precision:**
  - Logged times do not match the result files: `rpx.json` mtime is 06:32 against "06:40 run", and `rpint.json` is 06:30 against 06:36.
  - Contract §10 says the P7 request is filed in `P6.md` § Requests, but it is not there (P7 consumes `mosaic` anyway: `lgs_sg.js` around line 828).
  - The REQ answers in `C1c.md` are paragraphs, not one line.
  - RP-5's media case is a `<video>` fixture, not a media route (disclosed).

## The six checks

- **(a) Ownership.**
  - `git diff f5190bb` touches only P6 files: `lgs_layers.js`, `08-popups.js`, `05-native.css`, `layers/00-base.json` and `contracts/reporter.md`.
  - `theme/layers.json` is unchanged since `b8fea9a`, as the retired-but-kept rule requires; `99-legacy.json` and `popups/00-base.json` are unchanged this session.
  - The REQ answers in `C3a.md`, `P1.md` and `C1c.md` follow hard rule 1.
  - `shots/p2_p6_rp8_*.png` follow the naming rule (and `shots/` is ignored).
  - OK.
- **(b) Safety.**
  - Nothing autostarts. Runtime and test state live only in `/tmp/lgs/p6*`.
  - The tests stay off the never-list: Steam's CONFIRM is opened with no-op handlers and closed without confirming, and the test popup is non-interactive and closed. Locks are respected: `lab.Lock`, `both=True` for systemui, `native-session`.
  - After my runs the device is in CSS-only mode, native off, with no P6 flag or global. A `wp.p3` test token that appeared afterwards (`fy10893.2`) is not mine or P6's.
  - Exception: M2 (a flagged popup change can outlast its flag).
- **(c) Robustness.**
  - Fail-closed paths are in place: an unresolved token or a bad selector skips the rule or entry and is listed in errors; `transform` errors fall back to Steam's params; install throws before it patches anything.
  - Removal works by flag-off, `remove()` and both TTL paths (RP-7 re-run). The reporter detaches its MutationObservers and listeners and clears its attributes.
  - At idle: the reporter polls every 500 ms, but only in native mode, as in Phase 1. The wrapper polls every 1 s, only while `wp.p6` is on.
  - Exception: M2.
- **(d) Conformance.**
  - The machinery is in place: rule 2 (P-46 set and click-safe cap), rule 5 (P-47), interactive false in the default profile (P-11, R8 clean), and occluder plates.
  - Live native routes fail P-46/P-47, all from legacy rules (m3).
  - In native mode the footer keeps a CSS edge next to glassd's (M1), against the "edges only from the material and shader" bar.
- **(e) Function retention.**
  - P6 changes nothing in CSS-only mode: `05-native.css` is scoped to `.lgs-native`, the wrapper is off, and the reporter only runs in native.
  - In native, the default-profile crops are non-interactive (R8 clean), so the laser reaches Steam's panel.
  - Lifts follow both paths: gamepad `.gpfocus` (`rv6.json`, RP-6) and laser `.lgs-dwell:hover` (RP-6, with no lift during the 45 ms sweep).
- **(f) Visual quality.**
  - P6 has no mockup of its own. I compared the native shots, composited over a glass tone, with the CSS-only shots of the same routes.
  - Covers, plates and pops drop their CSS glass cleanly, except M1.
  - Outside P6, for the coordinator: on AllGames the search field overlaps the tab row and the "Back" label overlaps its arrow, in CSS-only mode as well. That comes from in-progress area CSS (C1a/C1b), not from P6.

## What the builder must do to pass

1. Fix M1: §4 of `05-native.css`, plus a REQ to C1a. Re-run RP-8 with checks on the computed paint of every tagged element, and take a native shot of the footer.
2. Fix M2: subscribe to flags and geometry and re-send. Add an RP-7 case where an entry flag toggles while the popup is shown.
3. Correct the evidence log: the cost wording (m2), the times (m10), and RP-6's flakiness (m1).
