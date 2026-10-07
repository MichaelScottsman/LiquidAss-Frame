#!/usr/bin/env python3
"""GL-6: fakeglassd follows the glassd v3 contract (docs/phase2/contracts/glassd.md section 5).

Runs native/spike/fakeglassd on a spec that uses every v3 field and checks:
 - glassd-out.json: version 3, every cap, per surface the drawn plate ids, droppedPlates and counts
 - 35 plates on a windowless surface: 32 painted and listed, 3 dropped and listed
 - the painted texture: plates opaque inside, nothing in the gaps, nothing where dropped plates
   would be, the occluder about .55 of its twin, the dim plate translucent, a tinted plate takes
   its colour, a hole darkens the cover inside its crop rect only, a "none" slab's cell stays
   empty, a tinted slab takes its colour
No camera, no room imagery (fakeglassd never touches the feed). Needs SteamVR running; its
overlays use their own key prefix and are never shown, so it runs next to a live daemon.

    FAKEGLASSD=/path/to/fakeglassd python3 tools/test_fake.py
"""
import json
import os
import shutil
import subprocess
import sys
import time

sys.dont_write_bytecode = True  # importing test_shapes must not leave __pycache__ beside the install
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_shapes import alpha, png  # noqa: E402  (same PNG reader)

HERE = os.path.dirname(os.path.abspath(__file__))
F = os.environ.get("FAKEGLASSD") or os.path.join(HERE, "..", "..", "spike", "fakeglassd")
D = "/tmp/lgs/p9-fx/fake"  # rule 7: test state only under /tmp/lgs; removed on any exit
S = 0.75  # fakeglassd's default scale
CAPS = ["plates", "holes", "tint", "masks", "coverDz", "none", "offset", "dim", "scaleFrom", "unitM", "roomDim", "dimSlab", "holeEdges"]


def spec():
    mats = ["liquid", "panel", "thick", "window", "clear", "liquid"]
    plates = []
    for i in range(35):
        col, row = i % 7, i // 7
        plates.append({"id": "pl%02d" % i, "x": 20 + col * 130, "y": 20 + row * 100, "w": 100, "h": 80, "r": 30,
                       "material": mats[i % 6], "phase": 1, "appear": "materialize", "shadow": 0.2})
    plates[8]["occluder"] = True      # thick; its twin plates[2] is thick too
    plates[3]["material"] = "dim"
    plates[3]["fill"] = [0, 0, 0, 0.3]
    plates[5]["tint"] = "#30d158"     # liquid, green
    plates[5]["fill"] = "rgba(0, 0, 0, 0.14)"
    return {
        "seq": 11, "dial": 0.5, "reduceMotion": False, "unitM": 0.3185, "roomDim": 0.3,
        "masks": [{"O": [-0.5, 1.6, -1.4], "U": [0.2, 0, 0], "V": [0, -0.1, 0]}],
        "surfaces": [
            {"name": "plates", "overlayKey": "", "texW": 960, "texH": 540, "radius": 40, "material": "window",
             "visible": True, "shapes": [], "plates": plates, "slabs": [], "coverDz": -0.027,
             "masks": [{"x": -120, "y": 100, "w": 90, "h": 300, "dz": 0.01}], "scaleFrom": "overlay"},
            {"name": "holes", "overlayKey": "", "texW": 960, "texH": 540, "radius": 40, "material": "window",
             "visible": True, "shapes": [{"x": 0, "y": 0, "w": 960, "h": 540, "r": 40}],
             "plates": [{"id": "over", "x": 700, "y": 300, "w": 200, "h": 160, "r": 40, "material": "thick"}],
             "slabs": [
                 {"id": "red", "x": 100, "y": 100, "w": 200, "h": 80, "r": 40, "dz": 0.03, "material": "none",
                  "hole": {"fill": "rgb(255 0 0 / 0.8)", "shadow": 0.35, "y": 9, "blur": 27, "clip": [100, 100, 300, 180]}},
                 {"id": "green", "x": 400, "y": 100, "w": 200, "h": 80, "r": 40, "dz": 0.03, "material": "liquid",
                  "tint": "#30d158", "hole": True},
                 {"id": "blue", "x": 400, "y": 300, "w": 200, "h": 80, "r": 40, "dz": 0.027, "material": "liquid",
                  "tint": "blue", "ox": 12, "oy": -6, "phase": 1},
                 {"id": "dimcell", "x": 100, "y": 300, "w": 160, "h": 100, "r": 0, "dz": -0.05, "material": "dim",
                  "fill": [0, 0, 0, 0.3]},
                 {"id": "edged", "x": 640, "y": 100, "w": 200, "h": 80, "r": 40, "dz": 0.03, "material": "none",
                  "hole": {"edges": {"top": ["#ff00ff", "#f000f0"], "right": "#ff00ff", "bottom": [[1, 0, 1, 1]], "left": "#ff00ff"}}}]},
        ]}


def main():
    shutil.rmtree(D, ignore_errors=True)
    os.makedirs(D + "/d")
    sp = spec()
    json.dump(sp, open(D + "/spec.json", "w"))
    if not os.path.exists(F):
        print("BLOCKED: no fakeglassd at %s (python glass.py native-build --fake)" % F)
        sys.exit(3)
    proc = subprocess.Popen([F, "--in", D + "/spec.json", "--out", D + "/out.json", "--dump", D + "/d", "--seconds", "8",
                             "--key-prefix", "fake-gl6."], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    o = None
    t0 = time.time()
    while time.time() - t0 < 6 and o is None:
        time.sleep(0.2)
        try:
            o = json.load(open(D + "/out.json"))
        except (OSError, ValueError):
            o = None
    while time.time() - t0 < 6 and not all(os.path.exists(D + "/d/fakeglassd-%s.png" % n) for n in ("plates", "holes")):
        time.sleep(0.2)
    proc.terminate()
    log = proc.communicate(timeout=10)[0]
    print("\n".join(l for l in log.splitlines() if l.startswith("fakeglassd:"))[:1500])
    ok = True
    if o is None:
        print("no glassd-out.json while fakeglassd ran")
        print("GL-6: FAIL")
        sys.exit(1)
    caps = o.get("caps", [])
    print("out: version %s, caps %s, seq %s" % (o.get("version"), ",".join(caps), o.get("seq")))
    ok &= o.get("version") == 3 and all(c in caps for c in CAPS) and int(o.get("seq", -1)) == 11
    pl = o["surfaces"]["plates"]
    drawn, dropped = pl.get("plates", []), pl.get("droppedPlates", [])
    print("plates: cover %s, drawn %d (%s..%s), dropped %s, counts %s" % (
        pl.get("cover"), len(drawn), drawn[0] if drawn else "-", drawn[-1] if drawn else "-", dropped, pl.get("counts")))
    c = pl.get("counts", {})
    ok &= pl.get("cover") == 0 and len(drawn) == 32 and drawn == ["pl%02d" % i for i in range(32)]
    ok &= dropped == ["pl32", "pl33", "pl34"] and c.get("plates") == 32 and c.get("droppedPlates") == 3 and c.get("shapes") == 0
    ho = o["surfaces"]["holes"]
    hc = ho.get("counts", {})
    print("holes: cover %s, plates %s, slabs %s, counts %s" % (ho.get("cover"), ho.get("plates"), sorted(ho.get("slabs", {})), hc))
    ok &= ho.get("plates") == ["over"] and hc.get("holes") == 3 and hc.get("slabs") == 5 and hc.get("shapes") == 1
    ok &= sorted(ho.get("slabs", {})) == ["blue", "dimcell", "edged", "green", "red"]

    w, h, rows = png(D + "/d/fakeglassd-plates.png")

    def mean(p, inset=12):
        x0, y0 = int((p["x"] + inset) * S), int((p["y"] + inset) * S)
        x1, y1 = int((p["x"] + p["w"] - inset) * S), int((p["y"] + p["h"] - inset) * S)
        px = [rows[y][x * 4:x * 4 + 4] for y in range(y0, y1) for x in range(x0, x1)]
        return [sum(q[k] for q in px) / len(px) for k in range(4)]
    plates = sp["surfaces"][0]["plates"]
    bad = []
    for p in plates[:32]:
        m = mean(p)
        if p["material"] == "dim":
            print("  dim plate %s: alpha %.0f (expected about %.0f)" % (p["id"], m[3], 0.3 * 255))
            if not 60 < m[3] < 95:
                bad.append(p["id"])
        elif m[3] < 254:
            bad.append(p["id"])
    print("  plates not opaque inside (or dim off): %s" % (bad or "none"))
    ok &= not bad
    gap = [alpha(rows, int((20 + cc * 130 + 115) * S), int((20 + r * 100 + 40) * S)) for r in range(4) for cc in range(6)]
    print("  alpha in the gaps between plates: max %d" % max(gap))
    ok &= max(gap) == 0
    far = sum(1 for y in range(int(430 * S), int(490 * S)) for x in range(int(545 * S), int(895 * S)) if alpha(rows, x, y) > 0)
    print("  texels painted where the dropped plates would be: %d" % far)
    ok &= far == 0
    occ, twin = mean(plates[8]), mean(plates[2])
    lo, lt = sum(occ[:3]) / 3, sum(twin[:3]) / 3
    print("  occluder %s mean %.0f vs its twin %s %.0f (ratio %.2f, expected about .55)" % (
        plates[8]["id"], lo, plates[2]["id"], lt, lo / max(lt, 1)))
    ok &= 0.45 < lo / max(lt, 1) < 0.65
    g5 = mean(plates[5])
    print("  green-tinted plate %s mean %s" % (plates[5]["id"], [round(v) for v in g5]))
    ok &= g5[1] > g5[0] + 40 and g5[1] > g5[2] + 20

    w, h, rows = png(D + "/d/fakeglassd-holes.png")

    def px(x, y):
        return list(rows[int(y * S)][int(x * S) * 4:int(x * S) * 4 + 4])
    inside, below = px(200, 140), px(200, 230)
    print("  cover inside the red hole %s, below it %s" % (inside, below))
    ok &= inside[0] > inside[1] + 60 and inside[0] > inside[2] + 60 and abs(below[0] - below[1]) < 40
    eh = px(740, 140)
    print("  cover inside the hole with magenta edge tones %s" % eh)
    ok &= eh[0] > eh[1] + 60 and eh[2] > eh[1] + 60
    gh, gb = px(500, 140), px(500, 230)
    print("  cover inside the green slab's hole (default black .35) %s, below it %s" % (gh, gb))
    ok &= sum(gh[:3]) < 0.8 * sum(gb[:3])
    cells = ho["slabs"]
    for sid, want in (("red", "empty"), ("green", "green"), ("blue", "blue"), ("dimcell", "dim")):
        u0, v0, u1, v1 = cells[sid]
        cx0, cy0, cx1, cy1 = int(u0 * w), int(v0 * h), int(u1 * w), int(v1 * h)
        if want == "dim":
            q = rows[(cy0 + cy1) // 2][((cx0 + cx1) // 2) * 4:((cx0 + cx1) // 2) * 4 + 4]
            e = rows[(cy0 + cy1) // 2][cx0 * 4:cx0 * 4 + 4]
            print("  dim slab cell centre %s, edge texel %s" % (list(q), list(e)))
            ok &= q[0] == q[1] == q[2] == 0 and 70 <= q[3] <= 84 and e[3] < q[3] // 2
        elif want == "empty":
            nz = sum(1 for y in range(cy0, cy1) for x in range(cx0, cx1) if alpha(rows, x, y) > 0)
            print("  'none' slab cell %dx%d: texels painted %d" % (cx1 - cx0, cy1 - cy0, nz))
            ok &= nz == 0
        else:
            q = rows[(cy0 + cy1) // 2][((cx0 + cx1) // 2) * 4:((cx0 + cx1) // 2) * 4 + 4]
            a = max(q[3], 1)
            r, g, b = q[0] * 255 / a, q[1] * 255 / a, q[2] * 255 / a  # unpremultiply
            print("  %s-tinted slab centre (straight) %s" % (sid, [round(r), round(g), round(b), q[3]]))
            ok &= (g > r + 40 and g > b + 20) if want == "green" else (b > r + 60 and b > g + 20)
    ov = px(800, 380)
    print("  plate over the cover: %s" % ov)
    ok &= ov[3] == 255
    print("GL-6:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    rc = 1
    try:
        rc = main()
    finally:
        shutil.rmtree(D, ignore_errors=True)
        try:
            os.rmdir(os.path.dirname(D))  # /tmp/lgs/p9-fx, when no other P9 test runs
        except OSError:
            pass
    sys.exit(rc)
