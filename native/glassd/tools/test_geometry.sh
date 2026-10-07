#!/bin/sh
# glassd test: geometry follows a Steam-like overlay through "no world
# transform" -> placed -> destroyed and re-created with a new handle -> gone.
# No feed, dashboard forced hidden, --force renders (and fetches geometry)
# continuously; test prefix, private out dir, no dumps.
F=$(cd "$(dirname "$0")/.." && pwd)
G=${GLASSD:-$F/glassd}
D=/tmp/lgs/p9-fx/geometry  # rule 7: test state only under /tmp/lgs
rm -rf $D
mkdir -p $D
trap 'rm -rf "$D"; rmdir /tmp/lgs/p9-fx 2>/dev/null' EXIT
[ -x $F/build/fakeov ] || { echo "build/fakeov missing: run build.sh"; exit 1; }
cat > $D/spec.json <<'EOF'
{"seq": 1, "dial": 0.5, "surfaces": [{"name": "fake", "overlayKey": "fx.fakesteam", "texW": 1920, "texH": 1080,
  "radius": 48, "material": "window", "visible": true, "slabs": []}]}
EOF
$F/build/fakeov > $D/fakeov.log 2>&1 &
FP=$!
sleep 0.5
$G --spec $D/spec.json --out $D/out.json --key-prefix glassd-fx. --no-feed --dash on --fps 10 --timeout 17 > $D/g.log 2>&1 &
GP=$!
for t in 1 2 3 4 5 6; do
  sleep 2.5
  printf "t~%.1f s: out.json geometry %s\n" "$(echo "$t * 2.5" | bc)" "$(grep -o '"geometry": "[^"]*"' $D/out.json 2>/dev/null)"
done
wait $GP; echo "glassd exit $?"
wait $FP
echo "--- fakeov"; cat $D/fakeov.log
echo "--- glassd"; grep -E 'geometry |new handle|^dash=' $D/g.log
rm -rf $D
