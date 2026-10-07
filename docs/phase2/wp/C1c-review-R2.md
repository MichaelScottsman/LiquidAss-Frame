# C1c System presentations: quick review, round R2

Reviewer: a quick review agent (about 30 minutes, not a full audit). Date: 2026-10-07, 16:40-17:10. Steam build 11094443.
Scope: package C1c as its log reports it ("READY: `wp.c1c`", M3 plus the T4 fragment). Main route: the tile menu (MENU recipe: `vgp_onmenu` on the first poster of `/library/tab/AllGames`), with `--flags wp.c1a,wp.c1c` (C1c declares no runtime dependency; C1a's chrome is on because C1c's D34 works against C1a's backdrop roots). Skipped on purpose: native sessions, removal sweeps, performance, full conformance, the other recipes (CONFIRM, sheet, Power).

## Status

Done. Device left as found: every step ran inside `glass.py` locks (flags and mode undone at the lock exit; the lab closed the menu each step opened); no native session, no hover, nothing confirmed or chosen.

## Verdict

**fix.** 0 blockers, 1 major. The tile menu looks and works right in both modes: compact glass slab anchored next to its card, posters under it frosted, rows on a 64 px pitch, every item and submenu reachable by pad and clickable by laser, B closes it. The one major is a failed gate on the main route: Steam's Cancel capsule is still 56 px visible, while the coordinator's ruling R2-5 (PLAN §1.16 "E-MENU (Cancel)") asks for 60 visible on its 60 px element. The builder's Status still names the old "≥ 320 wide" clause as the only red line; that clause is resolved, and the Cancel line now fails instead.

## 1. What was run

Pre snippet: the builder's `run4/tile.js` (C1c scratch). For pad-bfs a copy without its 20 s auto-close timer (`tile_nt.js`), so that B is tested on an open menu. Raw JSON: reviewer scratch `…/scratchpad/c1crev/`.

| Id | Command | Native | Result |
|---|---|---|---|
| R-G1 | `gates main --pre <tile> --flags wp.c1a,wp.c1c --mode pad --shot p2_c1crev_tile_pad` (16:43) | off | AUD **PASS** (212 controls, 0 issues), TYPE **PASS**, OUTLINE **PASS** (slab top edge .256, other sides 0), MOTION **PASS** (0 at rest, nothing `lgs-*` left). SIZE **FAIL**: 0 P-08/P-80 failures, 6 of 7 E-MENU lines pass (rows 384 × 64, fill 60, pitch 64); the **Cancel line fails**: "fill 188 x 56 on a 192 x 60 element" (M1) |
| R-G2 | same, `--mode laser --shot p2_c1crev_tile_laser` (16:45) | off | Same as R-G1: everything passes except the same E-MENU Cancel line (M1) |
| R-B1 | `pad-bfs --pre <tile_nt> --start %{*BasicContextMenuModal>contextMenuItem} --max 40 --budget 150 --flags wp.c1a,wp.c1c --mode pad` (16:52) | off | Done, 20 nodes: Install, Add to Favorites, Add to, Manage, Developer, Properties…, Cancel and the submenu items (collections, Hide this game, Mark as Private, Delete Proton Files…); never A. **B closes the layer** (menus 2 → 0, route kept). 40 unreached = the page under the modal (by design). 10 "irreversible" edges, all of one kind: Left from a submenu item returns to its parent row, and Right then re-enters the submenu at its first item, not the one left (see R-B2) |
| R-B2 | the same with `--stock` (no flags) (about 17:10) | off | Identical to R-B1: 20 nodes, the same 10 submenu edges, B closes. Parity (section 3a) |
| R-S1 | the two `--shot` captures, viewed composited over grey next to `shots/p2_window-nav_menu.png` | — | Section 2 |

## 2. Shots next to the mockup

`shots/p2_c1crev_tile_pad.png`, `shots/p2_c1crev_tile_laser.png` vs `shots/p2_window-nav_menu.png`.

- Same as the mockup: a compact frosted slab with no outline (edge from the material only), the game's name as an inline title, six rows on a 64 px pitch with chevrons on the three submenus, a quiet Cancel capsule at the bottom, the posters behind the slab blurred (D34 works: the second-column poster and the "ALL" segment read frosted, not sharp). The slab sits about 20 px right of its source card (anchored, T2) and inside y 116-616, above the ornament.
- Gamepad focus: "Install" has the blue fill, clearly the focused row (as in the mockup). In the laser shot "Install" also carries the fill, because the menu was opened by a gamepad event (`vgp_onmenu`); the mockup's laser panel shows the same. Not judged further (no real hover in this review).
- Differences a user would see, all polish (not counted): the mockup's leading glyphs on every row (star, plus, gear, terminal, pencil) are absent live except Steam's own Install glyph; the source card shows no visible glow in the capture (its More circle is C2c's, not on here); the title "3dSen" sits over the frosted white "All Games" tab pill, readable but low contrast.

## 3. Findings

### Blockers

None. Every item of the tile menu and its submenus is reachable by pad (R-B1) and judged clickable by laser (AUD: 0 GONE, HIDDEN, SHRUNK, UNCLICKABLE in both modes); B closes the menu; nothing crashed; the lab closed every menu it opened.

### Majors

- **M1. Cancel capsule is 56 px visible; the main-route G-SIZE gate fails (both modes).** Evidence: R-G1, R-G2, E-MENU (Cancel) line "fill 188 x 56 on a 192 x 60 element … (needs a 60 tall fill = its element, ≥ 192 wide …)". Cause: `theme/22-presentations.css` §5 still draws "a 56 px quiet capsule": the element is 60 tall but `border: 2px solid transparent` with `background: … padding-box` leaves a 56 px visible fill. The coordinator answered C1c's own REQ 6a (PLAN §1.19 R2-5, §1.16 "E-MENU (Cancel)"): Cancel goes to **60 visible on its 60 px element** (P-80 is a must). Fix: drop the transparent border (or paint the background to the border box) so the fill is 60 × ≥ 192, keep ≥ 4 px clear of the last row; re-run `gates` on the tile menu, Sort and Power in both modes. Also update the Status line, which still lists the resolved "≥ 320 wide" clause as the only red line and claims "0 P-08/P-80" while the Cancel line fails. (C2c's review R2 saw the same failure on Sort and the pad tile menu, its O2.)

### Not counted (for the builder)

- R-B1's 10 irreversible submenu edges: re-entering a submenu lands on its first item. Stock does the same (section 3a), so this is parity. But the builder's Status says "0 irreversible edges" for the tile menu, and its run had only 12 nodes (the 20 s auto-close cut the sweep). Please correct the evidence row.

### 3a. Stock parity of the submenu edges (R-B2)

`pad-bfs` with `--stock` and the same pre and start (finished about 17:10, after two 240 s lock waits): **identical to the themed run**. Same 20 nodes in the same order, the same 10 irreversible edges (from submenu items 9, 10, 12-19, Left → the parent row, back → the submenu's first item), 40 unreached (the page under the modal), and B closed the layer (menus 2 → 0). So the submenu edges are how Steam behaves, and C1c changes nothing in pad navigation (G-PAD parity). This is not a C1c finding.

## Requests

None filed (the fix is in C1c's own file).
