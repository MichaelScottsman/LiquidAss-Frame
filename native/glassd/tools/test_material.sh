#!/bin/sh
# Material dumps over the procedural test room: no camera, no room imagery, so
# the PNGs are safe to keep. Runs next to a live daemon (own key prefix and
# output). Needs SteamVR running (glassd creates test overlays, never shown).
#
#   sh tools/test_material.sh [OUTDIR] [extra glassd args, e.g. --phase 0.35]
#
# OUTDIR/<backdrop>/{main,bar}.png       the glassd textures (cover + slab atlas)
# OUTDIR/<backdrop>/{main,bar}-view.png  what the wearer sees: room, cover, slabs
# backdrops: room, room-hole (the room behind the UI unknown), stripes, and
# room-offaxis (the eye 0.35 m right and 0.1 m up).
set -e
cd "$(dirname "$0")/.."
OUT=${1:-/tmp/lgs/mat}
[ $# -gt 0 ] && shift
mkdir -p "$OUT"
run() {
    name=$1; shift
    ./glassd --spec tools/test_material.json --key-prefix glassd-mat. --out "$OUT/out.json" --once --warmup 0 \
        --dump "$OUT/$name" --dump-view "$@" | grep -E "test room|dumped|error|fail" || true
}
run room --test-backdrop room "$@"
run room-hole --test-backdrop room-hole "$@"
run stripes --test-backdrop stripes "$@"
run room-offaxis --test-backdrop room --test-head 0.35,0.1,0 "$@"
