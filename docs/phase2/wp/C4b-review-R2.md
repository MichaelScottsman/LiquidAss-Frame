# C4b Keyboard: quick review R2

Reviewer: R2 quick reviewer (2026-10-07, Steam build 11094443). Scope per the user's request ("go through these
reviews a little faster"): `gates keyboard` once per input mode with `--flags wp.c4b` (the keyboard has no route of
its own; it is shown over the main window with `SteamClient.OpenVR.Keyboard.Show()` and an auto-hide timer, and the
echo is drawn with the module's `echoTest` hook), `pad-bfs` once, one shot per mode next to `controls-keyboard.html`
and `controls-keyboard-pad.html`, key functions reachable. No native session (`wp.c4b.native` is not READY per the
builder), removal sweep, perf or full conformance. Nothing was typed.

## Status

**DONE (17:15).** Verdict **fix**: one major (M1). No blocker.

## Findings

### M1 (major): AUD gate fails on the keyboard in both modes: the "Enter" label is 3.6 : 1

- `gates keyboard --flags wp.c4b` gives AUD **FAIL** in laser (16:50) and in pad (17:03), with the same single issue
  each time: `CONTRAST text span "Enter" 21 -> 3.6 (needs 4.5; rooms grey/bright/dark 3.7/3.6/3.7)`. SIZE, TYPE,
  OUTLINE and MOTION pass in both modes.
- Cause: `theme/36-keyboard.css` §2 "Enter: the one tinted key". It puts white `--lgs-text-on-tint` on
  `--lgs-tint-primary` (`rgb(0 145 255 / .86)`) and adds a white sheen (`--c4b-sheen-enter`, white .18 to 0 over the
  top 60 %), which lowers the contrast further. Stock is white on black (21 : 1). This is the T1 CSS, which is live
  whether the flag is on or off. P10 reported the same failure to C4b at 13:31 / 13:32 in `wp/C4b.md` (under REQ
  C4b->P10) as "a real finding for you". The builder's READY status (11:50) is older than that report, so the
  failure is still open.
- What the user sees: the Enter key's label is the only key label below 4.5 : 1. With the room bright, "Enter" /
  "Search" / "Send" reads weaker than every other key.
- Fix, in C4b's file: on the Enter key only, drop the white sheen and use a deeper, opaque blue. For example
  `rgb(0 110 220)` gives about 4.9 : 1 with white, and it still reads as the system tint. Alternatively, get a
  coordinator ruling that exempts the tinted key's label. Then re-run `gates keyboard --only aud` in both modes.

### Checked, no finding

| Check | Result |
|---|---|
| Shots `shots/p2_c4b_r2_laser.png` (laser), `shots/p2_c4b_r2_pad.png` (pad), against `p2_controls_keyboard.png` / `-pad.png` | They match the mockups. One dark platter r 30 with no outline: OUTLINE puts the top edge at ratio 0.175 and the other sides at 0. Keys are white .15, modifiers .075, Enter blue, and the corner keys are concentric. The echo row shows the search glyph, "Search", the text and the blue caret, and the key block moves down into the band. In the CSS-only mode the platter is the opaque T1 tint (expected: native is not READY). The mockups' "Search" / "Send" Enter labels and gamepad glyph badges need a live field or Steam's own controller state, so they are not in these synthetic shows. Steam's own label "Enter" shows when no field has focus |
| Key functions (one `js` step, `--mode pad --flags wp.c4b`, 17:07) | All 58 key hit areas are present. The D-pad moves the virtual focus right to Enter, down to Shift, then left to "?/". Each focused key computes white .32 with a white label (Enter keeps its blue). The context-label wrapper is installed (`enterWrapped: true`). The keyboard was hidden in the step's `finally` |
| AUD functional kinds, both modes | 58 controls, 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE (since P10's session 5, E-KEY no longer hides the keys from AUD) |
| `pad-bfs --route /library/home --max 40 --budget 120 --flags wp.c4b --mode pad` (17:10) | Truncated at the budget (22 nodes). The search field (`%{SearchBox}`), which opens the keyboard, is reached by the pad. Its 2 irreversible edges are on Home's tabs, Discovery Queue widget and activity cards (C2a / C2c), not in C4b's area. Not a C4b finding |

Note (not a finding): both shots show two grey cursor dots at the centres of the keyboard's halves ("d", "l"). They
appear in both modes and the theme has no rule for them, so they are most likely Steam's own stick/touch cursors
for the idle controllers. The builder's 10:33 shot has none.

## Evidence

| Step | Command | Result | Time |
|---|---|---|---|
| Gates, laser | `gates keyboard --mode laser --flags wp.c4b --pre "<Show, echoTest('Liquid Glass'), Hide after 90 s>" --shot p2_c4b_r2_laser --json` | AUD FAIL (CONTRAST "Enter" 3.6), SIZE (58 E-KEY exempt) / TYPE / OUTLINE / MOTION PASS; native off | 16:50 |
| Gates, pad | same, `--mode pad`, `--shot p2_c4b_r2_pad` | the same as laser; native off | 17:03 |
| Key functions | `js` (pad, `wp.c4b`): Show, `L.pad` right ×2, down, left, read `%{Modal>Focused}`, Hide | see the table above | 17:07 |
| pad-bfs | as above | truncated, 2 irreversible edges outside C4b | 17:10 |

Device left: every step's flags and mode stub were undone at its lock exit. The keyboard was hidden: the gates
timers fired at 90 s and the `js` step's `finally` hid it. No hover was used, and no native session was run.
