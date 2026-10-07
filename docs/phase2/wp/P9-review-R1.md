# P9 glassd: independent review, round R1

Reviewer: independent adversarial review agent. Date 2026-10-07, 06:15-06:40 (Frame clock). Steam build 11094443.
Scope: everything the builder reported for P9 at M3 (G1-G7, GL-1..GL-6, MO-5, contract v3, fakeglassd).

**Verdict: fix.** Three major findings (one material bug with a confirmed one-line root cause, two visual misses in
the material's v3 features) and nine minor ones. The offline acceptance numbers are real and reproduce exactly; the
v3 pipeline works live end to end. What fails is the look: the quality bar is "no outlines", and glassd draws three
kinds of line that its own tests did not catch.

## 1. What was re-run

Everything ran on a separate review build. The working tree was copied as a tar to `/tmp/lgs/p9rev/` on the Frame and
built with `NOINSTALL=1 NOTOOLS=1 sh build.sh`, and fakeglassd was built with the `native-build --fake` command line.
The shared install was not touched, and the scratch folder was deleted afterwards. The builder's scratch sources
(`/tmp/lgs/p9/`) are byte-identical to the tree, apart from README.md and a stray `tools/__pycache__`. The installed
`glassd` and `fakeglassd` have the same checksums as the builder's builds (`7660d896…`, `5772d72e…`).
`motion_tokens.h` changed afterwards (P5), but only its version string.

| Test | Command (on the Frame, review build) | Result | Agrees with builder? |
|---|---|---|---|
| MO-5 | `./build/glassd --selftest phase` | PASS, worst 0.0010; sheet-in 735 ms, sheet-out 515 ms | yes |
| GL-1 | `GLASSD=build/glassd python3 tools/test_shapes.py` | PASS: 32 plates drawn and 3 dropped and listed, occluder 0.55, dim alpha 77, red hole only inside its crop, `none` cell 0 texels, green slab [53,199,87], roomDim 75.5 → 71.4 | yes |
| GL-4 | `GLASSD=build/glassd sh tools/test_phase.sh` | PASS, 40 values, worst 0.001 | yes |
| GL-3 | `GLASSD=build/glassd sh tools/test_bench.sh 15` | PASS. Medians: home 1.02 ms (0.82 at 903 MHz), library 1.54 (1.31), ccm 1.08 (1.00), keyboard 1.65 (1.65). The p90 is 3.83 ms in library and keyboard (13-19 % of frames ≥ 3.5 ms), measured while other agents' native sessions were running | yes (medians) |
| GL-6 | `FAKEGLASSD=… python3 tools/test_fake.py` | PASS: version 3, all 12 caps, every v3 field accepted | yes |
| GL-2 | `GLASSD=build/glassd sh tools/test_material.sh /tmp/lgs/p9rev/mat` | The five dumps are **bit-identical** to the builder's `shots/p2_glassd_{holes,holes-offaxis,plates,plates-offaxis,room}_view.png` (max pixel diff 0). **The verdict "hole reads as shadow" is disputed** (finding M2), and the plates dump shows M3 | evidence genuine, verdict no |
| GL-5 | not re-run at full resolution (no `hv --full` yet). In my native session the live spec (`/dev/shm/lgs/glassd.json`) had **no wide thin slab**: main had only `tab-arrow` and `tab-arrow.1` (48 × 48) | see m6 | — |
| Robustness (new) | 7 hostile specs (5000 plates; NaN and ±1e30 numbers; wrong types; 40 holes; duplicate ids; 50+50 masks; control characters and 500-char ids; overflowing numeric id), `--once --dump` | no crash; every run exits 0; caps honoured (32 plates, 16 casters, 24 masks) | — |
| Leaks (new) | 300 random v3 specs at 20/s (plates of six materials coming and going, holes, `none`/`dim` slabs, tints, roomDim), `--bench` over the test room | glassd fds 91 → 91, dmabufs 3 → 3, RSS 64.9 → 64.9 MB; vrcompositor fds 649 → 646; last seq 301 seen | — |
| G4 masks (new) | cover-only spec with and without a surface mask rect at x −700 and a world mask, `--test-backdrop room-hole --dump-room` | Known texels 97.0 % → 96.7 %; the two extra cut-outs show in the known map (procedural room only) | builder had no test |
| **Live G1, end to end** (new) | `python glass.py native-session --settle 150 --step "js <remove fixtures>"`. During it: `glass.py js` added 5 `data-lgs-plate` fixtures (`pointer-events:none`, transparent, self-removing after 120 s) on `/library/home`, then `glass.py hv … --look` | P6's v3 reporter reported 5 plates; P8 passed them on (`glassd.json` main: liquid, liquid occluder, liquid with the green tint, panel, thick); `glassd-out.json` listed all 5, `counts.plates` 5, gpu_ms 1.65, healthy; all 5 elements were `data-lgs-plate-ack`. In the headset frame the plates sat at their DOM positions with the tint and the occluder. Fixtures removed by the cleanup step; "back to CSS only: yes" | builder could not do this (P6 v3 landed at 06:25) |

Room frames: three `hv --look` frames were viewed and are gone (two were removed by other agents' `glass.py`
commands, which clean the shared `%TEMP%\lgs-hv`, and one by me). No `/tmp/lgs/hv-*.png` is left on the Frame.
`/tmp/lgs/glassd-dump/room.png` (written by `test_phase.sh`) was fetched, seen to be the **procedural** room, and the
local copy deleted.

## 2. Findings

### Major

**M1. Dashed black arcs inside every corner of a cover that has no slabs.** `native/glassd/shaders/glass.frag:197`.

- Cover-only spec (`main` 1920 × 984 window cover, no slabs), over the test room: glassd's own texture holds **92
  opaque black texels**, about 23 at each corner. They form a broken quarter circle about 20 glassd px inside the
  corner, which is a dashed dark line on the window glass at 1:1 in the dump view.
- **Root cause (confirmed).** Pass 2 reads the quarter-resolution copy with an implicit-LOD
  `texture(uLow, …)` inside the non-uniform branch `if (uPass == 2 && -d > uInner …)`. Along the branch boundary the
  2 × 2 quads straddle, so the derivatives are undefined, and the sampler picks a mip level. Those levels are only
  generated when the surface has slabs (`if (under) s.lowTex.mipmap()`), so it reads black.
- Proof:
  - The same scene with one 90 px slab: 0 black texels.
  - The same shader with `textureLod(uLow, …, 0.0)` (via `--shaders`): 0 black texels.
  - The Phase 1 v2 binary (built from `b8fea9a`): the same 92 texels. So this was not introduced in v3, but it is
    P9's file now.
- Why it matters now:
  - In the Phase 2 default profile the admission rules leave few pops. The 48 px header capsules are gone from the
    live spec; on `/library/home` only two 48 × 48 tab arrows were left. Windows with a cover and zero slabs are
    therefore likely to be common.
  - Large popup covers take the same two-pass path (inferred from the code's `twoPass` size condition, not
    rendered).
- No GL test catches it: every test scene has a slab.
- **Fix:** `textureLod(uLow, …, 0.0)` in pass 2. Then add a cover-only case with a "no black opaque texel" check to
  `test_shapes.py`.

**M2. The hole treatment leaves a hard-edged rectangular band, so GL-2's "hole reads as shadow" is not met.**

- In the builder's own `p2_glassd_holes-offaxis_view.png` (reproduced bit for bit):
  - above Play (x 400) the art is L 69-73, and the sliver is a flat L 49.2 band 3 px tall with a hard edge;
  - beside each circle there is a dark vertical line;
  - head-on (`p2_glassd_holes_view.png`) a 2 px band still shows at Play's top edge, because every pop is seen a few
    degrees off its own normal;
  - zoomed, it reads as a thin dark L-bracket with **square corners** that run past the rounded ends of the capsule
    and circles. It is the crop rect's outline, not the control's shadow. GP's reference
    (`p2_game-pages_pop_hole.png` (b)) is a soft crescent that follows the control.
- Two causes:
  1. `hole.fill` is a single flat tone (the art's *mean*) against art that varies locally by ±15-20 L.
  2. The "ambient occlusion floor" (`glass.frag` ~332: `floorA = inside ? 0.5 * pr.y : 0.0`) darkens the *whole* clip
     rect, corners included. With the floor removed (shader variant) the band at x 400 is L 52.7-54.6: about 5 L
     lighter, but still a visible bracket. So cause 1 dominates.
- The test fill values were also hand-tuned to the stand-in art's mean (`test_holes.json`). The reporter has no way
  to produce such a value: P6's `hole.fill` is a CSS colour or `"scrim"`, and nothing samples art.
- **Fix:**
  - Limit the darkening to the control's rounded shape. The floor or shadow applies only where the clip rect is near
    the slab's rounded rect, so the corners beyond the rounded ends get no floor.
  - Make the fill less step-like. Options are edge tones (a 2 × 2 or 4-edge `fill` that glassd interpolates) or a
    `fill: "auto"` that P6 computes per edge. File REQ P9->P6 for the data.
  - Then re-judge GL-2 with the band's ΔL measured, not by look alone. AT-HV-OFFAXIS still decides the live case.

**M3. A slab over a plate shows a blocky square inside it (glass over glass).**

- In `p2_glassd_plates_view.png` and `-offaxis` (reproduced), the focused disc popped over its occluder plate has a
  darker **square** interior inside the round slab. Its straight edges are visible at 1:1 and in the atlas cell
  (`main.png`).
- Luma steps of 5-11 L run along straight vertical and horizontal lines: a row through the cell goes 70 → 77-81 at
  x ≈ 104-112, and a column goes 46 → 52-58.
- Cause: `behind()` samples the plate copy with **one bilinear `textureLod` at up to mip 4.5** of a quarter-resolution
  texture. One texel there is about 90 glassd px, so a 180 px plate becomes 1-2 texels, which bilinear filtering
  turns into a square. The room behind uses the multi-tap `frosted()` and does not show this.
- Exposure:
  - Home's focused disc is mostly covered by its icon art.
  - The interior shows wherever text sits on the glass: the name plate, the open card, CC tiles with pops, and flat
    modal plates with lifted rows.
- **Fix:** sample the plate and cover copy with a few taps (as `frosted()` does), or cap the LOD by the plate's size.

### Minor

**m1. Plates over a cover read as rimmed inset panels.**

- An offline cover-plus-plates scene was rendered with the same command as GL-2. It had a thick alert-sized plate,
  a panel tile, a liquid disc and an ornament capsule over the window cover, head-on and 0.35 m off axis.
- Each plate shows a **closed rim** all the way round and no lift. The thick plate's rim is bright at the top,
  tinted on the sides and dark at the bottom, and its interior refracts the room, not the window.
- In the live frame the panel tile and the thick disc read mostly as their outline over the settings page.
- This is the mechanism PLAN §1.6 gives to flat menus, alerts and sheets. GL-2 has no plate-over-cover case.
- Add one, and consider a softer rim or a contact shadow or lift for a plate drawn over a cover.

**m2. PLAN §1.5 gives "glassd plays `morph-close`" to P9 (with C1c). It is not built.**

- Contract §6 defers it, and C1c adapted (C1c D15: in T5 the slab materializes in place).
- There is no PLAN 1.17 note in `wp/P9.md` and no coordinator sign-off. DESIGN2 §11 still says "glassd draws the
  1.5 % overshoot and the liquid neck in T5".
- Record the deviation as a 1.17 decision, or build a phase-driven rect morph for slabs.

**m3. Open REQ P1->P9 is unanswered: test fixtures live outside `/tmp/lgs` (task rule 7).**

- `test_shapes.py`, `test_atlas.py`, `test_locks.sh`, `test_live.sh`, `test_geometry.sh` and `test_feedcost.sh` use
  `/tmp/lgs-fx`.
- The new `test_fake.py` adds `/tmp/lgs-fake-gl6`.
- `test_atlas.py` never deletes its folder. That is the leftover P1's RT-6 found.
- `test_phase.sh` sends SIGUSR1 with `--dump` but no `--dump-room`, so glassd writes the (procedural) room map to
  `/tmp/lgs/glassd-dump/room.png`, which is left behind. It is still there.
- `test_fake.py` imports `test_shapes`. Run from the shared install, it would write `tools/__pycache__` there, which
  survives `lgs off`. The builder's scratch copy has one.
- Fix: `/tmp/lgs/p9-fx/` everywhere, `PYTHONDONTWRITEBYTECODE`, cleanup in `finally` / `trap`, and `--dump-room` in
  `test_phase.sh`.

**m4. P-48 shadow size.** The slab's cast shadow on the cover is offset by `(0.002 m + 0.4·dz)` (glassd.cpp
`buildCasters`):

| Depth | glassd offset | P-48 target (0.4 px/mm ± 50 %) |
|---|---|---|
| 10 mm | 7.8 CSS px | 4 px |
| 15 mm | 10.4 px | 6 px |
| 25 mm | 15.6 px | 10 px |

All three are outside the band. The blur is within its band. Holes use GP's fixed 6 / 18 px, which is right for
15 mm.

**m5. G4 masks and `coverDz` have no test in the evidence.** I checked masks offline (§1, masks row) and they work.
Add the room-hole known-map check to `test_shapes.py`.

**m6. GL-5 evidence is weak, and the case may now be moot.**

- The "edge ratio 0.068" is `hv`'s **window top-edge** profile, not the slab's lower lip. The builder's own two
  captures gave 0.326 and 0.068.
- hvgrab's scale 2 is **point-sampled decimation** (`hvgrab.cpp` reads every 2nd pixel), so a 2-6 texel lip can be
  hidden or turned into dashes by the capture itself.
- The live spec in my session had no wide thin slab. My guess is that admission rule 2 (click-safe) now drops
  32 px-tall fields; I did not confirm this.
- Record GL-5 as unverified until `hv --full` and a wide slab (a fixture rule) exist, not as passing at half
  resolution.

**m7. Contract versus code.**

- Contract units: "an unparsable colour is ignored … and logged once". It is ignored but not logged
  (`parseColor`'s result is dropped).
- The README accepts colour names (`green`, `blue`, `red`, `scrim`). The contract's units section does not list them,
  although the reporter sends `"green"`/`"blue"` tints.
- `droppedPlates` is unbounded: 5000 plates gave a 44 KB `glassd-out.json` rewritten every 2 s.
- A numeric plate id beyond 2^63 overflows `(long long)` (undefined behaviour).

**m8. GL-2's tint judgement uses stand-in paint.** In `holes` views the stand-in paints each crop as an opaque
capsule in the tint colour (`view.frag`, `uPopCol`), so green and blue there are not glassd's tinted glass. The tint
is shown correctly in GL-1/GL-6 numbers and in the plates view; say so in the evidence.

**m9. Cosmetic.** The installed binary reports `motion_tokens.h` version `2428c76f74`; the tree has `ed4e044810`
(values unchanged). Rebuild with the next install.

## 3. Checklist

- **(a) Ownership: pass.**
  - Every file in filesChanged is P9's (`native/glassd/**`, `native/spike/fakeglassd.cpp`, `glassd-material.md`,
    `contracts/glassd.md`, `wp/P9.md`).
  - `wp/P5.md` changed only by marking REQ P5->P9 `[x]` with an answer, which is the sanctioned flow.
  - `shots/p2_glassd_{holes,holes-offaxis,plates,plates-offaxis,room,roomdim}*.png` are new names that GL-2 allows.
    They are procedural and match my dumps.
  - The other `native/` changes since the checkpoint (`motion_tokens.h`, `sg_test.py`) are P5's and P7's work.
- **(b) Safety: pass, apart from m3.**
  - Nothing autostarts. glassd writes only `/dev/shm/lgs` and `/tmp/lgs` (plus the test paths in m3). The binary was
    replaced under `native.lock`.
  - No room imagery is left. The never-list was respected.
  - Installing into `~/.local/share/glass-shell` is the existing product install, not new persistence.
- **(c) Robustness: pass.** Hostile specs do not crash glassd, and limits hold. No fd, dmabuf or RSS growth over 300
  v3 changes. Unknown fields are ignored, and a v2 spec renders. It renders only on change, and nothing runs at idle
  beyond the existing ~100 Hz poll. `roomDim` animates only on change.
- **(d) Conformance:** P-42 / G-OUTLINE fails by M1, M2 and m1. P-48 misses by m4. P-45 (no glass on glass): plates
  over a cover are glass over glass by design (PLAN §1.6, flat modals); see m1. P-46 and P-47 are the reporter's.
  P-56 passes (`reduceMotion` is a 180 ms coverage fade). P-58 passes (glassd ramps equal `motion_tokens.h`).
- **(e) Function retention:** P9 adds no input path. glassd's panels are non-interactive, which is V1's AT-0a and
  not re-run here. Steam's panel under plates keeps its hits (P7). The laser and gamepad paths are unaffected by P9.
- **(f) Visual quality:**
  - Head-on, the plate discs read as refracting Liquid Glass with a crescent rim, close to `home-apps-home`'s discs
    once icons sit on them.
  - The roomDim A/B is subtle and right.
  - The bar is not met where glassd draws lines: the corner arcs (M1), the hole brackets (M2), the square interior
    (M3) and the rims of plates over a cover (m1).

## 4. Suggested order for the builder

1. M1: one line (`textureLod`), plus a cover-only regression check.
2. M3: multi-tap or LOD cap for the cover and plate copy.
3. M2: restrict the floor to the control shape, design an edge-tone fill with P6 (REQ), then re-judge GL-2 with ΔL
   numbers.
4. m3, m7 hygiene. Then the m1 plate-over-cover case, the m2 record, and m6 rewording.

Reproduce M1 offline: a window cover `{"x":0,"y":0,"w":1920,"h":984,"r":81}` and no slabs, then
`glassd --spec S --once --warmup 0 --dump D --test-backdrop room`. Count opaque texels with R+G+B < 30 in
`D/main.png`: 92 before the fix, 0 after.
