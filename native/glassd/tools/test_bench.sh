#!/bin/sh
# GL-3: glassd GPU cost with the Phase 2 scenes over the procedural test room
# (no camera; nothing is shown: glassd's overlays are never shown, and this
# run uses its own key prefix and output, so it runs next to a live daemon).
#   tools/bench/home.json      windowless Home: 19 plates + 1 slab (the focused cell)
#   tools/bench/library.json   window cover (656) + the ornament plate + 3 slabs
#   tools/bench/ccm.json       Control Center (CC-M): 4 plates, no cover
#   tools/bench/keyboard.json  the library scene + a thick keyboard cover
# Each scene renders every frame at 72 fps for SECONDS (default 15); glassd
# prints the median and p90 of GL_TIME_ELAPSED (first tenth skipped), the GPU
# clock median and the median scaled to 903 MHz. PASS = every median <= 2.5 ms.
#   sh tools/test_bench.sh [SECONDS]      GLASSD=build/glassd sh tools/test_bench.sh
set -e
cd "$(dirname "$0")/.."
G=${GLASSD:-./glassd}
T=${1:-15}
D=/tmp/lgs/p9-fx/bench
rm -rf $D
mkdir -p $D
trap 'rm -rf "$D"; rmdir /tmp/lgs/p9-fx 2>/dev/null' EXIT
worst=0
for scene in home library ccm keyboard; do
    $G --spec tools/bench/$scene.json --key-prefix glassd-bench. --out $D/out.json --test-backdrop room --bench \
        --timeout "$T" --orphan-ok > $D/$scene.log 2>&1 || true
    line=$(grep "^bench: [0-9]* frames" $D/$scene.log | tail -1)
    echo "$scene: ${line#bench: }"
    grep "^bench: frames per" $D/$scene.log | sed "s/^bench:/  /"
    med=$(echo "$line" | sed -n 's/.*gpu median \([0-9.]*\) ms.*/\1/p')
    [ -n "$med" ] || med=99
    worst=$(awk -v a="$worst" -v b="$med" 'BEGIN { print (b > a) ? b : a }')
done
rm -rf $D
awk -v w="$worst" 'BEGIN { printf "test_bench: worst median %.2f ms -> %s\n", w, (w <= 2.5) ? "PASS" : "FAIL" }'
