#!/bin/sh
# Feed cost: CPU ticks (10 ms) of v4l2cam / vrcompositor per 10 s, with and
# without glassd, while glassd believes the dashboard is hidden (one-frame
# shots) or visible (streaming). Test prefix, private out dir, no dumps.
G=${GLASSD:-$(cd "$(dirname "$0")/.." && pwd)/glassd}
OUT=/tmp/lgs/p9-fx/feedcost  # rule 7: test state only under /tmp/lgs
rm -rf $OUT
mkdir -p $OUT
trap 'rm -rf "$OUT"; rmdir /tmp/lgs/p9-fx 2>/dev/null' EXIT
V=$(pgrep -x V4L2Cam | head -1)
C=$(pgrep -x vrcompositor | head -1)
ticks() { awk '{print $14+$15}' /proc/$1/stat; }
measure() {
  a=$(ticks $V); b=$(ticks $C)
  sleep $1
  echo "  v4l2cam $(( $(ticks $V) - a ))  vrcompositor $(( $(ticks $C) - b ))  (ticks in $1 s)"
}
run() {  # label, args...
  label=$1; shift
  $G --demo --key-prefix glassd-fx. --out $OUT/out.json --timeout 26 "$@" > $OUT/g.log 2>&1 &
  GP=$!
  sleep 5
  echo "$label:"; measure 10
  g0=$(ticks $GP); sleep 10; echo "  glassd itself: $(( $(ticks $GP) - g0 )) ticks in 10 s"
  wait $GP; echo "  exit $?"
  grep -E '^dash=' $OUT/g.log | tail -1 | cut -c1-200
}
echo "baseline (no reader):"; measure 10
run "hidden, default idle (0.2 Hz shots)" --dash off
run "hidden, --idle-hz 2" --dash off --idle-hz 2
run "hidden, --idle-hz 0" --dash off --idle-hz 0
run "visible (--dash on): streaming" --dash on
echo "after:"; measure 10
rm -rf $OUT
