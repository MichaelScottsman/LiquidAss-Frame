#!/usr/bin/env python3
"""glassd test: cover shapes and slab caps (no feed: the room is a flat grey fill, no room imagery).
 - union: two overlapping capsules -> one continuous shape (alpha inside the union)
 - empty: explicit "shapes": [] -> no cover at all
 - panel: material panel without shapes -> no cover (and a warning)
 - window: material window without shapes -> whole texture covered
 - big: 24 slabs of 1900x1000 plus small ones -> nothing outside the texture,
   oversize slabs dropped and listed, small ones kept
 v3 (GL-1, docs/phase2/contracts/glassd.md):
 - plates: 35 plates of six materials on a windowless surface (shapes []) ->
   32 drawn and listed, 3 dropped and listed; each plate opaque inside, nothing
   between them; the occluder darker than its twin; the dim plate translucent;
   plates over a cover stay opaque
 - holes: a hole with a red fill reddens the cover inside its crop rect only;
   a "none" slab's cell stays empty; a green-tinted slab is green
"""
import json
import os
import struct
import subprocess
import sys
import zlib

G = os.environ.get("GLASSD") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "glassd")
D = "/tmp/lgs-fx"


def png(path):
    data = open(path, "rb").read()
    pos, idat, w, h = 8, b"", 0, 0
    while pos < len(data):
        n = struct.unpack(">I", data[pos:pos + 4])[0]
        t = data[pos + 4:pos + 8]
        c = data[pos + 8:pos + 8 + n]
        if t == b"IHDR":
            w, h = struct.unpack(">II", c[:8])
        if t == b"IDAT":
            idat += c
        pos += 12 + n
    raw = zlib.decompress(idat)
    bpp, stride = 4, w * 4
    rows, prev = [], bytearray(stride)
    for y in range(h):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
            if f == 1:
                line[i] = (line[i] + a) & 255
            elif f == 2:
                line[i] = (line[i] + b) & 255
            elif f == 3:
                line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    return w, h, rows


def alpha(rows, x, y):
    return rows[y][x * 4 + 3]


def main():
    os.makedirs(D, exist_ok=True)
    big = [{"id": "s%02d" % i, "w": 1900, "h": 1000} for i in range(1, 25)]
    big += [{"id": "small%d" % i, "w": 300, "h": 80, "r": 40} for i in range(3)]
    mats = ["liquid", "panel", "thick", "window", "clear", "liquid"]
    plates = []
    for i in range(35):
        col, row = i % 7, i // 7
        p = {"id": "pl%02d" % i, "x": 20 + col * 130, "y": 20 + row * 100, "w": 100, "h": 80, "r": 30, "material": mats[i % 6]}
        plates.append(p)
    plates[8]["occluder"] = True    # thick; its twin plates[2] is thick too
    plates[3]["material"] = "dim"
    plates[3]["fill"] = [0, 0, 0, 0.3]
    holes_spec = {"name": "holes", "overlayKey": "", "texW": 960, "texH": 540, "radius": 40, "material": "window", "visible": True,
                  "shapes": [{"x": 0, "y": 0, "w": 960, "h": 540, "r": 40}],
                  "plates": [{"id": "over", "x": 700, "y": 300, "w": 200, "h": 160, "r": 40, "material": "thick"}],
                  "slabs": [{"id": "red", "x": 100, "y": 100, "w": 200, "h": 80, "r": 40, "dz": 0.03, "material": "none",
                             "hole": {"fill": "rgb(255 0 0 / 0.8)", "shadow": 0.35}},
                            {"id": "green", "x": 400, "y": 100, "w": 200, "h": 80, "r": 40, "dz": 0.03, "material": "liquid",
                             "tint": "#30d158"}]}
    spec = {"seq": 7, "dial": 0.5, "surfaces": [
        {"name": "union", "overlayKey": "", "texW": 1200, "texH": 120, "radius": 60, "material": "panel", "visible": True,
         "shapes": [{"x": 0, "y": 0, "w": 640, "h": 120, "r": 60}, {"x": 560, "y": 0, "w": 640, "h": 120, "r": 60}], "slabs": []},
        {"name": "empty", "overlayKey": "", "texW": 450, "texH": 1536, "radius": 24, "material": "panel", "visible": True,
         "shapes": [], "slabs": []},
        {"name": "panel", "overlayKey": "", "texW": 600, "texH": 300, "radius": 24, "material": "panel", "visible": True, "slabs": []},
        {"name": "window", "overlayKey": "", "texW": 640, "texH": 360, "radius": 24, "material": "window", "visible": True, "slabs": []},
        {"name": "big", "overlayKey": "", "texW": 1920, "texH": 1080, "radius": 48, "material": "window", "visible": True,
         "shapes": [{"x": 0, "y": 0, "w": 1920, "h": 1080, "r": 48}], "slabs": big},
        {"name": "plates", "overlayKey": "", "texW": 960, "texH": 540, "radius": 40, "material": "window", "visible": True,
         "shapes": [], "plates": plates, "slabs": []},
        holes_spec,
    ]}
    json.dump(spec, open(D + "/spec.json", "w"))
    r = subprocess.run([G, "--spec", D + "/spec.json", "--out", D + "/out.json", "--key-prefix", "glassd-fx.", "--no-feed",
                        "--dash", "off", "--once", "--warmup", "0", "--dump", D + "/d"], capture_output=True, text=True, timeout=60)
    print("exit", r.returncode)
    print("\n".join(l for l in r.stdout.splitlines() if not l.startswith("dumped") and "stays flat" not in l)[:3000])
    print("drop lines:", sum(1 for l in r.stdout.splitlines() if "stays flat" in l))
    o = json.load(open(D + "/out.json"))
    for name in ("union", "empty", "panel", "window"):
        s = o["surfaces"][name]
        print(name, "texture", s["texW"], "x", s["texH"], "backdrop", s["backdrop"], "cover", s["cover"])
    b = o["surfaces"]["big"]
    out_of = [k for k, v in b["slabs"].items() if any(t < 0 or t > 1 for t in v)]
    print("big: texture %dx%d, backdrop %s, %d slabs announced (%s), %d dropped, outside [0,1]: %d" % (
        b["texW"], b["texH"], b["backdrop"], len(b["slabs"]), ",".join(sorted(b["slabs"])), len(b.get("dropped", [])), len(out_of)))

    # union: alpha inside the union along rows 2, 10, 60 near the join (glassd x 380..520)
    w, h, rows = png(D + "/d/union.png")
    bh = round(120 * 0.75)
    print("union.png %dx%d (backdrop rows 0..%d)" % (w, h, bh - 1))
    for y in (2, 10, 45, 80):
        print("  row %2d alpha x=380..520 step 14:" % y, [alpha(rows, x, y) for x in range(380, 521, 14)])
    # a hard cut would show as alpha 0 strictly inside the union: scan rows 8..81 between the capsule ends
    holes = sum(1 for y in range(8, bh - 8) for x in range(60, w - 60) if alpha(rows, x, y) < 250)
    print("  interior texels with alpha < 250 (rows 8..%d, x 60..%d): %d" % (bh - 9, w - 61, holes))
    for name in ("empty", "panel"):
        w, h, rows = png(D + "/d/%s.png" % name)
        nz = sum(1 for y in range(h) for x in range(w) if alpha(rows, x, y) > 0)
        print("%s.png %dx%d: texels with alpha > 0: %d" % (name, w, h, nz))
    w, h, rows = png(D + "/d/window.png")
    bw, bh = round(640 * 0.75), round(360 * 0.75)
    inside = sum(1 for y in range(20, bh - 20) for x in range(20, bw - 20) if alpha(rows, x, y) == 255)
    print("window.png: opaque texels in the backdrop interior: %d of %d" % (inside, (bw - 40) * (bh - 40)))

    # v3 plates (GL-1)
    ok = True
    pl = o["surfaces"]["plates"]
    drawn, dropped = pl.get("plates", []), pl.get("droppedPlates", [])
    print("plates: version %s, caps %s" % (o.get("version"), ",".join(o.get("caps", []))))
    print("plates: cover %d, drawn %d (%s..%s), dropped %s, counts %s" % (pl["cover"], len(drawn), drawn[0] if drawn else "-",
          drawn[-1] if drawn else "-", dropped, pl.get("counts")))
    ok &= pl["cover"] == 0 and len(drawn) == 32 and dropped == ["pl32", "pl33", "pl34"]
    w, h, rows = png(D + "/d/plates.png")
    S = 0.75

    def mean(p, inset=12):
        x0, y0 = int((p["x"] + inset) * S), int((p["y"] + inset) * S)
        x1, y1 = int((p["x"] + p["w"] - inset) * S), int((p["y"] + p["h"] - inset) * S)
        px = [rows[y][x * 4:x * 4 + 4] for y in range(y0, y1) for x in range(x0, x1)]
        return [sum(q[c] for q in px) / len(px) for c in range(4)]
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
    # between plates (gaps 30 px x, 20 px y): nothing but contact shadows, which stay faint
    gap = [alpha(rows, int((20 + c * 130 + 115) * S), int((20 + r * 100 + 40) * S)) for r in range(4) for c in range(6)]
    print("  alpha in the gaps between plates: max %d" % max(gap))
    ok &= max(gap) <= 60
    # the dropped plates (pl32..pl34: row 4, x 540..900) draw nothing
    far = sum(1 for y in range(int(430 * S), int(490 * S)) for x in range(int(545 * S), int(895 * S)) if alpha(rows, x, y) > 0)
    print("  texels drawn where the dropped plates would be: %d" % far)
    ok &= far == 0
    occ, twin = mean(plates[8]), mean(plates[2])
    lo, lt = (occ[0] + occ[1] + occ[2]) / 3, (twin[0] + twin[1] + twin[2]) / 3
    print("  occluder %s mean %.0f vs its twin %s %.0f (ratio %.2f, expected about .55)" % (plates[8]["id"], lo, plates[2]["id"], lt, lo / max(lt, 1)))
    ok &= 0.4 < lo / max(lt, 1) < 0.7

    # v3 holes and tints
    ho = o["surfaces"]["holes"]
    print("holes: counts %s, plates %s, slabs %s" % (ho.get("counts"), ho.get("plates"), sorted(ho["slabs"])))
    w, h, rows = png(D + "/d/holes.png")
    def px(x, y):
        q = rows[int(y * S)][int(x * S) * 4:int(x * S) * 4 + 4]
        return list(q)
    inside, outside = px(200, 140), px(200, 230)
    print("  cover inside the red hole %s, below it %s" % (inside, outside))
    ok &= inside[0] > inside[1] + 60 and inside[0] > inside[2] + 60 and abs(outside[0] - outside[1]) < 40
    cell = ho["slabs"]["red"]
    cw, chh = int((cell[2] - cell[0]) * w), int((cell[3] - cell[1]) * h)
    cx0, cy0 = int(cell[0] * w), int(cell[1] * h)
    nz = sum(1 for y in range(cy0, cy0 + chh) for x in range(cx0, cx0 + cw) if alpha(rows, x, y) > 0)
    print("  'none' slab cell %dx%d: texels drawn %d" % (cw, chh, nz))
    ok &= nz == 0
    g = ho["slabs"]["green"]
    gx, gy = int((g[0] + g[2]) / 2 * w), int((g[1] + g[3]) / 2 * h)
    gp = rows[gy][gx * 4:gx * 4 + 4]
    print("  green-tinted slab centre %s" % list(gp))
    ok &= gp[1] > gp[0] + 40 and gp[1] > gp[2] + 20
    ov = px(800, 380)
    print("  plate over the cover: %s" % ov)
    ok &= ov[3] == 255
    print("GL-1 v3:", "PASS" if ok else "FAIL")
    subprocess.run(["rm", "-rf", D])


if __name__ == "__main__":
    main()
