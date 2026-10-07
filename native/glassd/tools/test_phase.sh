#!/bin/sh
# Materialize timing over the procedural test room (no camera; nothing is
# shown). Starts glassd with every piece of glass at phase 0, flips the spec
# to phase 1, and logs the displayed phases at fixed delays (SIGUSR1 dumps).
# Expected (README "Phase"): small liquid slabs ramp linearly in 250 ms, the
# thick menu and the window cover ride the sheet-in spring (d 0.5 s, about
# 0.73 s to settle); then back to 0: 350 ms linear, sheet-out spring (0.51 s).
#   sh tools/test_phase.sh
set -e
cd "$(dirname "$0")/.."
D=/tmp/lgs/tphase
rm -rf $D
mkdir -p $D
spec() {  # $1 = phase
    sed -e "s/\"visible\": true,/\"visible\": true, \"phase\": $1,/" \
        -e "s/\"material\": \"liquid\", \"dz\"/\"material\": \"liquid\", \"phase\": $1, \"dz\"/" \
        -e "s/\"material\": \"thick\",  \"dz\"/\"material\": \"thick\", \"phase\": $1, \"dz\"/" \
        tools/test_material.json > $D/spec.tmp
    mv $D/spec.tmp $D/spec.json
}
spec 0
./glassd --spec $D/spec.json --key-prefix glassd-mat. --out $D/out.json --test-backdrop room --dump $D/d --warmup 1000 \
    --orphan-ok > $D/log 2>&1 &
PID=$!
sleep 2
at() { sleep "$1"; kill -USR1 $PID; }
echo "phase 1 written at $(cut -d' ' -f1 /proc/uptime)" >> $D/times
spec 1
at 0.1; at 0.1; at 0.2; at 0.4; at 0.5
echo "phase 0 written at $(cut -d' ' -f1 /proc/uptime)" >> $D/times
spec 0
at 0.15; at 0.25; at 0.6
sleep 0.3
kill $PID
wait $PID 2>/dev/null || true
echo "spec writes (CLOCK_BOOTTIME, = monotonic without suspend) and the phases logged by each dump:"
cat $D/times
grep "^phase main" $D/log
rm -rf $D
