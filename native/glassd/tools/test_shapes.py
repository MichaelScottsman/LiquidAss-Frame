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
 R1 (review fixes):
 - cover: a window cover with no slabs (1920 x 984, r 81) and the window
   surface have no opaque near-black texel (M1: black dashes inside the
   corners, from an implicit-LOD read of the quarter-resolution copy)
 - masks (G4): over the procedural room with the room behind the UI unknown
   (--test-backdrop room-hole), a surface mask rect beside the window and a
   world mask quad each make more of the room map unknown, and nothing known
 - coverDz (G4/G7): a slab over a plate sees the cover plane where coverDz
   puts it: its cell changes with coverDz, more for a deeper offset
Fixtures live in /tmp/lgs/p9-fx/shapes and are removed on any exit.
"""
import json
import os
import shutil
import struct
import subprocess
import sys
import zlib

sys.dont_write_bytecode = True  # never leave __pycache__ beside the shared install
G = os.environ.get("GLASSD") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "glassd")
D = "/tmp/lgs/p9-fx/shapes"  # rule 7: test state only under /tmp/lgs


def png(path):
    data = open(path, "rb").read()
    pos, idat, w, h, ct = 8, b"", 0, 0, 6
    while pos < len(data):
        n = struct.unpack(">I", data[pos:pos + 4])[0]
        t = data[pos + 4:pos + 8]
        c = data[pos + 8:pos + 8 + n]
        if t == b"IHDR":
            w, h = struct.unpack(">II", c[:8])
            ct = c[9]  # 6 RGBA, 2 RGB (the -view.png dumps)
        if t == b"IDAT":
            idat += c
        pos += 12 + n
    raw = zlib.decompress(idat)
    bpp = {6: 4, 2: 3, 4: 2, 0: 1}[ct]
    stride = w * bpp
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
                             "tint": "#30d158"},
                            {"id": "dimcell", "x": 100, "y": 300, "w": 160, "h": 100, "r": 0, "dz": -0.05, "material": "dim",
                             "fill": [0, 0, 0, 0.3]}]}
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
        # R1 M1: a window cover with no slabs (the default profile's common case)
        {"name": "cover", "overlayKey": "", "texW": 1920, "texH": 984, "radius": 81, "material": "window", "visible": True,
         "shapes": [{"x": 0, "y": 0, "w": 1920, "h": 984, "r": 81}], "slabs": []},
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
    # v3 G7: a "dim" slab is a flat dark cell (alpha .30 inside, feathered edge) and casts nothing on the cover
    dc = ho["slabs"]["dimcell"]
    dx0, dy0, dx1, dy1 = int(dc[0] * w), int(dc[1] * h), int(dc[2] * w), int(dc[3] * h)
    mid = rows[(dy0 + dy1) // 2][((dx0 + dx1) // 2) * 4:((dx0 + dx1) // 2) * 4 + 4]
    edge = rows[(dy0 + dy1) // 2][dx0 * 4:dx0 * 4 + 4]
    print("  dim slab cell centre %s, edge texel %s" % (list(mid), list(edge)))
    ok &= mid[0] == mid[1] == mid[2] == 0 and 70 <= mid[3] <= 84 and edge[3] < mid[3] // 2
    under, away = px(180, 350), px(600, 350)
    print("  cover under the dim slab %s, same row away from it %s" % (under, away))
    ok &= all(abs(a - b) <= 3 for a, b in zip(under, away))
    # v3 G7: roomDim .30 darkens what every piece of glass sees
    w0, h0, rows0 = png(D + "/d/window.png")
    spec2 = {"seq": 8, "dial": 0.5, "roomDim": 0.3, "surfaces": [s for s in spec["surfaces"] if s["name"] == "window"]}
    json.dump(spec2, open(D + "/spec2.json", "w"))
    r2 = subprocess.run([G, "--spec", D + "/spec2.json", "--out", D + "/out2.json", "--key-prefix", "glassd-fx.", "--no-feed",
                         "--dash", "off", "--once", "--warmup", "0", "--dump", D + "/d2"], capture_output=True, text=True, timeout=60)
    w1, h1, rows1 = png(D + "/d2/window.png")
    o2 = json.load(open(D + "/out2.json"))

    def lum_mean(rr):
        px_ = [rr[y][x * 4:x * 4 + 3] for y in range(40, 230, 6) for x in range(40, 440, 6)]
        return sum(0.299 * q[0] + 0.587 * q[1] + 0.114 * q[2] for q in px_) / len(px_)
    l0, l1 = lum_mean(rows0), lum_mean(rows1)
    print("  roomDim: caps %s; window glass mean luma %.1f -> %.1f with roomDim .30 (exit %d)" % (
        "roomDim" in o2.get("caps", []) and "dimSlab" in o2.get("caps", []), l0, l1, r2.returncode))
    ok &= "roomDim" in o2.get("caps", []) and "dimSlab" in o2.get("caps", []) and l1 < l0 - 2
    print("GL-1 v3:", "PASS" if ok else "FAIL")
    ok1 = r1_checks()
    print("GL-1 R1 (cover-only, masks, coverDz):", "PASS" if ok1 else "FAIL")
    print("GL-1:", "PASS" if ok and ok1 else "FAIL")


def black_opaque(path):
    """Opaque near-black texels (R+G+B < 30, A > 200): glass is never black."""
    w, h, rows = png(path)
    return sum(1 for y in range(h) for x in range(w)
               if rows[y][x * 4 + 3] > 200 and rows[y][x * 4] + rows[y][x * 4 + 1] + rows[y][x * 4 + 2] < 30)


def run(spec, name, *extra):
    """glassd --once on SPEC; returns (stdout, out json, dump dir)."""
    d = D + "/" + name
    os.makedirs(d, exist_ok=True)
    json.dump(spec, open(d + "/spec.json", "w"))
    r = subprocess.run([G, "--spec", d + "/spec.json", "--out", d + "/out.json", "--key-prefix", "glassd-fx.", "--dash", "off",
                        "--once", "--warmup", "0", "--dump", d] + list(extra), capture_output=True, text=True, timeout=90)
    out = json.load(open(d + "/out.json")) if os.path.exists(d + "/out.json") else {}
    return r.stdout + r.stderr, out, d


def r1_checks():
    ok = True
    # M1: no black texels in a cover without slabs (the first run's "cover" and "window"), also over the test room
    nb = black_opaque(D + "/d/cover.png")
    nw = black_opaque(D + "/d/window.png")
    cover = {"seq": 1, "dial": 0.5, "surfaces": [
        {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 984, "radius": 81,
         "material": "window", "visible": True, "shapes": [{"x": 0, "y": 0, "w": 1920, "h": 984, "r": 81}], "slabs": []}]}
    _, _, d = run(cover, "m1room", "--test-backdrop", "room")
    nr = black_opaque(d + "/main.png")
    print("  cover without slabs: opaque near-black texels %d (grey room), %d (test room); window surface %d" % (nb, nr, nw))
    ok &= nb == 0 and nr == 0 and nw == 0

    # G4 masks: room-hole leaves the room behind the UI unknown; each extra mask must hide more of it
    def known(name, sm, wm):
        sp = json.loads(json.dumps(cover))
        if sm:
            sp["surfaces"][0]["masks"] = sm
        if wm:
            sp["masks"] = wm
        txt, _, d = run(sp, name, "--test-backdrop", "room-hole", "--dump-room", D + "/" + name + "/room.png")
        w, h, rows = png(D + "/" + name + "/room-known.png")
        return w, h, rows
    smask = [{"x": -700, "y": 200, "w": 300, "h": 400, "dz": 0}]                    # an ornament left of the window
    wmask = [{"O": [1.2, 1.9, -1.6], "U": [0.4, 0, 0], "V": [0, -0.4, 0]}]           # a SteamVR panel right of it
    w0, h0, k0 = known("mask0", None, None)
    _, _, k1 = known("mask1", smask, None)
    _, _, k2 = known("mask2", None, wmask)
    def diff(ka, kb):
        lost = gained = seen = 0
        for y in range(h0):
            ra, rb = ka[y], kb[y]
            for x in range(w0):
                a, b = ra[x] > 127, rb[x] > 127
                seen += a
                lost += a and not b
                gained += b and not a
        return seen, lost, gained
    seen, lost1, gain1 = diff(k0, k1)
    _, lost2, gain2 = diff(k0, k2)
    n = w0 * h0
    print("  masks (room-hole): known %.1f%% of the map; + surface mask: %d texels hidden, %d revealed; "
          "+ world mask: %d hidden, %d revealed" % (100.0 * seen / n, lost1, gain1, lost2, gain2))
    ok &= lost1 > 20 and lost2 > 20 and gain1 == 0 and gain2 == 0

    # coverDz: a slab over a dark plate's edge sees the cover plane (and its plates) where coverDz puts it,
    # so from an off-axis head the edge shifts inside the slab (dial 0 and clear glass: the least frost)
    def slab_cell(name, cdz):
        sp = {"seq": 1, "dial": 0.0, "unitM": 0.369, "surfaces": [
            {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "radius": 81,
             "material": "window", "visible": True, "coverDz": cdz, "shapes": [{"x": 0, "y": 0, "w": 1920, "h": 1080, "r": 81}],
             "plates": [{"id": "tile", "x": 700, "y": 300, "w": 300, "h": 400, "r": 0, "material": "dim", "fill": [0, 0, 0, 0.9]}],
             "slabs": [{"id": "pop", "x": 860, "y": 450, "w": 300, "h": 160, "r": 60, "material": "clear", "dz": 0.03}]}]}
        _, out, d = run(sp, name, "--test-backdrop", "room", "--test-head", "0.35,0.1,0")
        w, h, rows = png(d + "/main.png")
        u0, v0, u1, v1 = out["surfaces"]["main"]["slabs"]["pop"]
        return [rows[y][x * 4 + c] for y in range(int(v0 * h) + 4, int(v1 * h) - 4) for x in range(int(u0 * w) + 4, int(u1 * w) - 4)
                for c in range(3)]
    c0, c1, c2 = slab_cell("cdz0", 0.001), slab_cell("cdz1", -0.027), slab_cell("cdz2", -0.2)
    d1 = sum(abs(a - b) for a, b in zip(c0, c1)) / len(c0)
    d2 = sum(abs(a - b) for a, b in zip(c0, c2)) / len(c0)
    print("  coverDz: slab cell mean |change| %.2f at coverDz -0.027 (K-G6), %.2f at -0.2 (vs 0.001)" % (d1, d2))
    ok &= d1 > 0.3 and d2 > 2 * d1
    return ok


if __name__ == "__main__":
    shutil.rmtree(D, ignore_errors=True)
    try:
        main()
    finally:
        shutil.rmtree(D, ignore_errors=True)
        try:
            os.rmdir(os.path.dirname(D))  # /tmp/lgs/p9-fx, when no other P9 test runs
        except OSError:
            pass
