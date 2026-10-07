#!/usr/bin/env python3
"""glassd test: cover shapes and slab caps (no feed: the room is a flat grey fill, no room imagery).
 - union: two overlapping capsules -> one continuous shape (alpha inside the union)
 - empty: explicit "shapes": [] -> no cover at all
 - panel: material panel without shapes -> no cover (and a warning)
 - window: material window without shapes -> whole texture covered
 - big: 24 slabs of 1900x1000 plus small ones -> nothing outside the texture,
   oversize slabs dropped and listed, small ones kept
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
    spec = {"seq": 7, "dial": 0.5, "surfaces": [
        {"name": "union", "overlayKey": "", "texW": 1200, "texH": 120, "radius": 60, "material": "panel", "visible": True,
         "shapes": [{"x": 0, "y": 0, "w": 640, "h": 120, "r": 60}, {"x": 560, "y": 0, "w": 640, "h": 120, "r": 60}], "slabs": []},
        {"name": "empty", "overlayKey": "", "texW": 450, "texH": 1536, "radius": 24, "material": "panel", "visible": True,
         "shapes": [], "slabs": []},
        {"name": "panel", "overlayKey": "", "texW": 600, "texH": 300, "radius": 24, "material": "panel", "visible": True, "slabs": []},
        {"name": "window", "overlayKey": "", "texW": 640, "texH": 360, "radius": 24, "material": "window", "visible": True, "slabs": []},
        {"name": "big", "overlayKey": "", "texW": 1920, "texH": 1080, "radius": 48, "material": "window", "visible": True,
         "shapes": [{"x": 0, "y": 0, "w": 1920, "h": 1080, "r": 48}], "slabs": big},
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
    subprocess.run(["rm", "-rf", D])


if __name__ == "__main__":
    main()
