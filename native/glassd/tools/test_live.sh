#!/bin/sh
# glassd test: live run against Steam's real overlays (dashboard state
# from SteamVR), with the feed, a spec like lgs_shell's (main, bar capsule,
# footer capsule). Test prefix, private out dir, no dumps. Then SIGUSR2
# overlay-loss recovery, and the exit after three losses in 30 s.
G=${GLASSD:-$(cd "$(dirname "$0")/.." && pwd)/glassd}
D=/tmp/lgs-fx
mkdir -p $D
cat > $D/spec.json <<'EOF'
{"seq": 3, "dial": 0.5, "surfaces": [
 {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "radius": 48, "material": "window",
  "visible": true, "shapes": [{"x": 0, "y": 0, "w": 1920, "h": 1080, "r": 48}],
  "slabs": [{"id": "hdr-back", "w": 210, "h": 60, "r": 30, "x": 18, "y": 6, "dz": 0.015}]},
 {"name": "bar", "overlayKey": "valve.steam.gamepadui.bar", "texW": 1800, "texH": 120, "radius": 60, "material": "liquid",
  "visible": true, "shapes": [{"x": 375, "y": 0, "w": 1050, "h": 120, "r": 60}], "slabs": []},
 {"name": "floatingfooter", "overlayKey": "valve.steam.gamepadui.floatingfooter", "texW": 900, "texH": 60, "radius": 30,
  "material": "panel", "visible": true, "shapes": [{"x": 291, "y": 0, "w": 318, "h": 60, "r": 30}], "slabs": []}
]}
EOF
$G --spec $D/spec.json --out $D/out.json --key-prefix glassd-fx. --timeout 40 > $D/g.log 2>&1 &
GP=$!
sleep 12
echo "--- out.json after 12 s"
python3 -c "
import json; o = json.load(open('$D/out.json'))
print({k: o[k] for k in ('healthy', 'pid', 'fps', 'gpu_ms', 'frames', 'dashboard', 'last_submit_s', 'feed', 'room_updates')})
for n, s in o['surfaces'].items(): print(' ', n, s['texW'], 'x', s['texH'], 'cover', s['cover'], s['geometry'], 'slabs', list(s['slabs']))
"
kill -USR2 $GP; sleep 3
python3 -c "import json; o = json.load(open('$D/out.json')); print('after one SIGUSR2:', {k: o[k] for k in ('healthy', 'frames', 'last_submit_s')})"
echo "--- after one SIGUSR2: healthy $(grep -o '"healthy": [a-z]*' $D/out.json)"
kill -USR2 $GP; sleep 1.5; kill -USR2 $GP
wait $GP; echo "glassd exit $? (75 expected after 3 losses)"
echo "--- glassd log"
grep -vE '^(dumped|GL )' $D/g.log | cut -c1-260
rm -rf $D
