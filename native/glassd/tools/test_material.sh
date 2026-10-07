#!/bin/sh
# Material dumps over the procedural test room: no camera, no room imagery, so
# the PNGs are safe to keep. Runs next to a live daemon (own key prefix and
# output). Needs SteamVR running (glassd creates test overlays, never shown).
#
#   sh tools/test_material.sh [OUTDIR] [extra glassd args, e.g. --phase 0.35]
#   GLASSD=build/glassd sh tools/test_material.sh ...
#
# OUTDIR/<backdrop>/{main,bar}.png       the glassd textures (cover + slab atlas)
# OUTDIR/<backdrop>/{main,bar}-view.png  what the wearer sees: room, cover, slabs
# backdrops: room, room-hole (the room behind the UI unknown), stripes, and
# room-offaxis (the eye 0.35 m right and 0.1 m up).
# v3 (GL-2): OUTDIR/holes{,-offaxis}/ is tools/test_holes.json (a hero page:
# Play green-tinted with a hole, three cluster circles with holes, one of them
# without fill, a blue primary, a moved crop without hole) drawn with the hero
# stand-in (--view-content hero: opaque art in front of the cover with the
# popped rects cut out, and the crops at their depths), head-on and 0.35 m off
# axis; OUTDIR/plates{,-offaxis}/ is tools/test_plates.json (windowless Home:
# 19 plates, the focused cell popped over its occluder plate).
# R1: OUTDIR/platecover{,-offaxis}/ is tools/test_platecover.json (plates over
# the window cover, PLAN 1.6's flat alerts, tiles and ornaments: a thick alert
# with a blue-tinted button popped over it, a panel tile, a liquid disc, the
# bottom ornament). tools/test_holes.py measures the holes' dL (GL-2).
set -e
cd "$(dirname "$0")/.."
G=${GLASSD:-./glassd}
OUT=${1:-/tmp/lgs/mat}
[ $# -gt 0 ] && shift
mkdir -p "$OUT"
run() {
    name=$1; shift
    spec=$1; shift
    $G --spec "$spec" --key-prefix glassd-mat. --out "$OUT/out.json" --once --warmup 0 \
        --dump "$OUT/$name" --dump-view "$@" | grep -E "test room|dumped|error|fail" || true
}
run room tools/test_material.json --test-backdrop room "$@"
run room-hole tools/test_material.json --test-backdrop room-hole "$@"
run stripes tools/test_material.json --test-backdrop stripes "$@"
run room-offaxis tools/test_material.json --test-backdrop room --test-head 0.35,0.1,0 "$@"
run holes tools/test_holes.json --test-backdrop room --view-content hero "$@"
run holes-offaxis tools/test_holes.json --test-backdrop room --view-content hero --test-head 0.35,0.1,0 "$@"
run plates tools/test_plates.json --test-backdrop room "$@"
run plates-offaxis tools/test_plates.json --test-backdrop room --test-head 0.35,0.1,0 "$@"
run platecover tools/test_platecover.json --test-backdrop room "$@"
run platecover-offaxis tools/test_platecover.json --test-backdrop room --test-head 0.35,0.1,0 "$@"
