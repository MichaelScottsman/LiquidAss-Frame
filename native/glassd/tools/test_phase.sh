#!/bin/sh
# Materialize timing over the procedural test room (no camera; nothing is
# shown), covers, slabs and v3 plates (GL-4). Starts glassd with every piece
# of glass at phase 0, flips the spec to phase 1, and logs the displayed phases
# at fixed delays (SIGUSR1 dumps); then back to 0. Each logged value is
# compared with the curve motion_tokens.h defines for that piece (P5, MO-5):
#   window cover, thick slab, window/thick plates: sheet-in up, sheet-out down;
#   liquid slabs and liquid/panel plates: linear 250 ms up, 350 ms down.
# glassd logs when each spec took effect and when the phases were stepped, so
# the comparison needs no clock alignment. PASS = every value within 0.03.
#   sh tools/test_phase.sh            (needs SteamVR running; own key prefix)
#   GLASSD=build/glassd sh tools/test_phase.sh
set -e
cd "$(dirname "$0")/.."
G=${GLASSD:-./glassd}
D=/tmp/lgs/p9-fx/phase
rm -rf $D
mkdir -p $D
trap 'rm -rf "$D"; rmdir /tmp/lgs/p9-fx 2>/dev/null' EXIT
spec() {  # $1 = seq, $2 = phase
    cat > $D/spec.tmp <<EOF
{"seq": $1, "dial": 0.5, "surfaces": [
  {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "radius": 81,
   "material": "window", "visible": true, "phase": $2,
   "shapes": [{"x": 0, "y": 0, "w": 1920, "h": 984, "r": 81}],
   "plates": [{"id": "orn", "x": 240, "y": 942, "w": 1440, "h": 126, "material": "liquid", "phase": $2},
              {"id": "tile", "x": 1300, "y": 100, "w": 500, "h": 600, "r": 54, "material": "thick", "phase": $2}],
   "slabs": [{"id": "back", "x": 36, "y": 36, "w": 90, "h": 90, "r": 45, "material": "liquid", "dz": 0.015, "phase": $2},
             {"id": "menu", "x": 600, "y": 200, "w": 520, "h": 560, "r": 36, "material": "thick", "dz": 0.027, "phase": $2}]}
]}
EOF
    mv $D/spec.tmp $D/spec.json
}
spec 1 0
$G --spec $D/spec.json --key-prefix glassd-phase. --out $D/out.json --test-backdrop room --dump $D/d --dump-room $D/room.png --warmup 1000 \
    --orphan-ok > $D/log 2>&1 &
PID=$!
sleep 2
at() { sleep "$1"; kill -USR1 $PID; }
spec 2 1
at 0.1; at 0.1; at 0.2; at 0.4; at 0.5
spec 3 0
at 0.15; at 0.25; at 0.6
sleep 0.3
kill $PID
wait $PID 2>/dev/null || true
grep -E "^(spec seq|phase main)" $D/log > $D/lines || true
python3 - "$D/lines" "$(dirname "$0")/../../shared/motion_tokens.h" <<'PYEOF'
import math, re, sys
lines = open(sys.argv[1]).read().splitlines()
hdr = open(sys.argv[2]).read()
def tok(name):
    m = re.search(r'Token k%s\{"[^"]+", ([0-9.]+)f, ([0-9.]+)f, ([0-9.]+)f' % name, hdr)
    return float(m.group(1)), float(m.group(2)), float(m.group(3))
def const(name):
    return float(re.search(r'k%s = ([0-9.]+)f' % name, hdr).group(1))
sheet_in, sheet_out = tok("SheetIn"), tok("SheetOut")
mat_in, mat_out = const("MatInMs") / 1000, const("MatOutMs") / 1000
def spring(d, t):  # 0 -> 1 progress, bounce 0 (MO 8), y0 = -1, v0 = 0
    w = 2 * math.pi / d
    return 1 - math.exp(-w * t) * (1 + w * t)
SPRING = {"main", "menu", "plate:tile"}
applied, worst, n, rows = {}, 0.0, 0, []
prev_target = 0.0
for ln in lines:
    m = re.match(r"spec seq (\d+) applied \(t=([0-9.]+)\)", ln)
    if m:
        applied[int(m.group(1))] = float(m.group(2))
        continue
    m = re.match(r"phase (.*) \(t=([0-9.]+), spec seq (\d+)\)", ln)
    if not m:
        continue
    t, seq = float(m.group(2)), int(m.group(3))
    if seq not in (2, 3) or seq not in applied:
        continue
    up = seq == 2
    dt = t - applied[seq]
    for kv in m.group(1).split():
        name, val = kv.rsplit("=", 1)
        val = float(val)
        if name in SPRING:
            p = spring(sheet_in[0] if up else sheet_out[0], dt)
            if dt * 1000 >= (sheet_in[2] if up else sheet_out[2]):
                p = 1.0
        else:
            p = min(1.0, dt / (mat_in if up else mat_out))
        expect = p if up else 1 - p
        err = abs(val - expect)
        worst, n = max(worst, err), n + 1
        rows.append("  seq %d %+6.0f ms %-11s %.3f expected %.3f" % (seq, dt * 1000, name, val, expect))
print("\n".join(rows))
print("test_phase: %d values, worst |measured - motion_tokens.h| %.3f -> %s" % (n, worst, "PASS" if n >= 30 and worst <= 0.03 else "FAIL"))
PYEOF
rm -rf $D
