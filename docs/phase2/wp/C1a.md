# C1a Shell chrome: evidence log

Package card: `docs/phase2/PLAN.md` §2.4 "C1a Shell chrome". Concept: `docs/phase2/concepts/window-nav.md` (WN, owned by C1a). Steam build at the time of writing: `11094443`.

## Status

**Milestone reached: M0 in progress** (this session). Next: M1/M2 (T1 CSS in `theme/20-shell.css`), once P4's tokens (`contracts/tokens.md`) and P1's loader (`contracts/runtime.md`) exist.

### Interface announced to every area (names are final; code lands at M2/M3)

Areas key only on these. They do not detect anything themselves.

| What | Name and values | Set by | Notes |
|---|---|---|---|
| Toolbar row (CQ1) | `html.lgs-hdr-108` when the 108 px header holds (WN AT-2); `html.lgs-hdr-40` when it was tried and failed | C1a T2 (`device/rt/20-shell.js`) | **No class** = runtime off; treat it like `lgs-hdr-40`. Write tall-row rules under `html.lgs-hdr-108` and fallback rules under `html:not(.lgs-hdr-108)` |
| Page top padding in the fallback | `--lgs-hdr-pad`: `0px` with `lgs-hdr-108`, `68px` otherwise | C1a T1 (`theme/20-shell.css`) | Page roots: `padding-top: var(--lgs-hdr-pad, 68px)` (WN §3.2 rule 1) |
| Scroll guard (VP P-23) | `--lgs-guard-top: 124px`, `--lgs-guard-bottom: 612px` (window y) | C1a T1 | Focused items stay in y 124–612 on routes with an ornament (628 − 16; A1 moved the ornament from 636 to 628) |
| Route glass mode (PLAN §1.2) | `%{BasicUiRoot}[data-lgs-glass="window" \| "window-full" \| "windowless" \| "hero"]` | C1a T2, from the route map in WN §3.1.1 | Set on route change only, never on focus. **No attribute** (runtime off) = `window` |
| Route key | `%{BasicUiRoot}[data-lgs-route="<key>"]`, keys listed in WN §3.1.1 | C1a T2 | For route-scoped area rules (for example `/chat`, `/invites` header positions) |
| Glass geometry | `window`: 1280 × 656, radius 54, ornament margin 64. `window-full`: 1280 × 720. `windowless`: no window glass (plates only). `hero`: the art fills the window | C1a T1 (CSS tint), P6/C1a T5 (cover) | CSS-only tint `rgb(20 22 30 / .74)` (dial .60–.84) + edge cues (WN §8.4) |
| Bottom ornament | `#Footer` capsule y 628–712 (84), centred, ≤ 960 wide, members 60, radius 42, padding 0 12, gap 4, 14 between groups; `#Footer[data-lgs-orn="capsule" \| "quiet"]`; members tagged `[data-lgs-btn="<Steam button enum>"]` | C1a T1 + T2 | Quiet = only A and B: no capsule material, items 60 tall, labels Medium white .70. Pages end at y 628 (`--gamepadui-current-footer-height` 92). Library routes: C2c's five slots (880 px) inside it |
| Glyph badges | Shown only under `html[data-lgs-vr-mode="gamepad"]` (P3 signal) | C1a T1 | Steam's own glyph nodes, 30 px circle, 16 px Bold, trailing the label |
| More circle | `__LGS_RT.more.register(selector, {placement: 'card' \| 'row'})` | C1a T2 (`device/rt/20-more.js`) | 60 px visible, 80 px hit, black .38 + 10 px blur, white .94 while its menu is open; cards: inside top right, inset 10; rows: trailing, inset 24. Dispatches the host's own `onMenuButton` |
| Frozen target | `__LGS_RT.shell.target()` (the element), `onTarget(fn)` | C1a T2 | Fed by P3's attention (`rt.attend`, dwell 300 ms or `pointerdown`) |
| Pointer proxy | `div.lgs-pointer` in each covered document, native mode only (`pointerProxy` flag, default `"native"`) | C1a T2 (`device/rt/20-pointer.js`) | — |
| Runtime flag | `wp.c1a` (off until V2 accepts); feature flags `tabBarAlways`, `winbarMove`, `pointerProxy` (PLAN §1.17 S9, S10, S16) | V1 `device/defaults.json` | — |

### What remains for M0

See the M0 checklist below; it is complete when every row is ticked.

## Requests

<!-- REQ lines: "- [ ] REQ C1a-><OWNER>: <what and why>" -->

## Requests to C1a, handled

None yet.

## Log

### 2026-10-07, session 1: M0 conformance

- Start-of-session request check: `grep -n "REQ [A-Za-z0-9]*->C1a:" docs/phase2/wp/*.md` → no `docs/phase2/wp/` directory yet; no requests.
- No device steps this session (M0 is documents and mockups only).
