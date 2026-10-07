#!/usr/bin/env python3
"""glassd GL-2 hole metric (R1): how a pop's hole reads off axis, in numbers.

Renders tools/test_holes.json (a hero page: Play, three cluster circles, a blue
primary, a moved crop) over the procedural test room with the hero stand-in
(--view-content hero: opaque art with the popped rects cut out, the crops at
their depths), and the same view without the cut-outs (hero-art: the art the
sliver hides). Pixels that differ are the visible sliver of each hole; for each
one dL = luma(view) - luma(art there), Rec. 709 luma of sRGB 0..255.

Each hole's sliver is split into
  shape   inside the control's rounded rect (beside its straight edges), where a
          shadow belongs;
  corner  in the crop rect's corners beyond the rounded ends, where any tone
          step draws the crop's square outline (the "L-bracket", R1 M2).

Fill variants for the holes with a fill (play, from, manage):
  edges   hole.edges: the art's tone just outside each edge (what P6's
          `fill: "auto"` reports, REQ P9->P6), sampled here from the stand-in;
  flat    one flat fill per crop (the art's mean over the crop: the Phase 2
          R0 test values; P6 can only send a CSS colour today).
The `input` circle (hole: true, no fill) is the contrast case: the cover glass
shows in its sliver (the case the depth rules forbid over art).

and the rim: sliver pixels within 1.5 Steam px of the crop rect's edge, where
a fill that differs from the content draws a hard line along the rect.

PASS (edges variant, off axis and head-on), for every filled hole: corner
|dL| mean <= 4 and p95 <= 8 (no bracket beyond the rounded ends), rim |dL|
mean <= 4 (no line along the crop rect), shape dL mean between -16 and 0 and
p95 <= +5 (a shadow, never lighter than the art beyond the edge tones' error).
The flat variant is reported for comparison only.

  GLASSD=build/glassd python3 tools/test_holes.py [--keep DIR]
Needs SteamVR running (glassd makes test overlays, never shown). Writes only
/tmp/lgs/p9-fx/holes (deleted afterwards unless --keep), procedural images only.
"""
import json
import math
import os
import shutil
import subprocess
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from test_shapes import png  # noqa: E402  (PNG reader, no dependencies)

G = os.environ.get("GLASSD") or os.path.join(HERE, "..", "glassd")
D = "/tmp/lgs/p9-fx/holes"
OFFAXIS = "0.35,0.1,0"
DEBUG = "--debug" in sys.argv


def luma(q):
    return 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2]


def sd_rr(px, py, cx, cy, hw, hh, r):
    qx, qy = abs(px - cx) - hw + r, abs(py - cy) - hh + r
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r


def render(spec_path, out, content, head):
    args = [G, "--spec", spec_path, "--key-prefix", "glassd-fx-holes.", "--out", out + "/out.json", "--once", "--warmup", "0",
            "--dump", out, "--dump-view", "--test-backdrop", "room", "--view-content", content]
    if head:
        args += ["--test-head", head]
    r = subprocess.run(args, capture_output=True, text=True, timeout=90)
    if r.returncode != 0 or not os.path.exists(out + "/main-view.png"):
        print("glassd failed (%d): %s" % (r.returncode, (r.stdout + r.stderr)[-800:]))
        sys.exit(2)
    return png(out + "/main-view.png")


def measure(spec, view, ref):
    s = spec["surfaces"][0]
    tw, th = s["texW"], s["texH"]
    m = min(max(0.08 * max(tw, th), 48.0), 200.0)
    x0, y0, x1, y1 = -m, -m, tw + m, th + m
    w, h, rows = view
    _, _, rref = ref
    bpp = len(rows[0]) // w
    res = {}
    holes = [sl for sl in s["slabs"] if sl.get("hole")]
    for sl in holes:
        res[sl["id"]] = {"shape": [], "corner": [], "rim": []}
    for y in range(h):
        sy = y0 + (y + 0.5) / h * (y1 - y0)
        ra, rb = rows[y], rref[y]
        for x in range(w):
            a, b = ra[x * bpp:x * bpp + 3], rb[x * bpp:x * bpp + 3]
            if max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2])) <= 1:
                continue
            sx = x0 + (x + 0.5) / w * (x1 - x0)
            for sl in holes:
                c = sl["hole"].get("clip") if isinstance(sl["hole"], dict) else None
                cx0, cy0, cx1, cy1 = c if c else (sl["x"], sl["y"], sl["x"] + sl["w"], sl["y"] + sl["h"])
                if cx0 <= sx < cx1 and cy0 <= sy < cy1:
                    r = min(sl.get("r", 0), 0.5 * min(sl["w"], sl["h"]))
                    d = sd_rr(sx, sy, sl["x"] + sl["w"] / 2, sl["y"] + sl["h"] / 2, sl["w"] / 2, sl["h"] / 2, r)
                    dl = luma(a) - luma(b)
                    res[sl["id"]]["corner" if d > 0.5 else "shape"].append(dl)
                    if min(sx - cx0, cx1 - sx, sy - cy0, cy1 - sy) < 1.5:
                        res[sl["id"]]["rim"].append(dl)
                    if DEBUG and abs(dl) > 6:
                        res[sl["id"]].setdefault("worst", []).append((round(dl, 1), round(sx, 1), round(sy, 1), round(d, 1)))
                    break
    return res


def stats(v):
    if not v:
        return None
    v = sorted(v)
    n = len(v)
    return {"n": n, "mean": sum(v) / n, "absmean": sum(abs(q) for q in v) / n, "min": v[0], "p5": v[int(0.05 * (n - 1))],
            "p95": v[int(0.95 * (n - 1))], "max": v[-1], "absp95": sorted(abs(q) for q in v)[int(0.95 * (n - 1))]}


def main():
    keep = None
    if "--keep" in sys.argv:
        keep = sys.argv[sys.argv.index("--keep") + 1]
    shutil.rmtree(D, ignore_errors=True)
    os.makedirs(D)
    ok = True
    try:
        spec = json.load(open(os.path.join(HERE, "test_holes.json")))
        # the flat variant: each filled hole gets its `flat` value instead of its edges
        flat = json.loads(json.dumps(spec))
        for sl in flat["surfaces"][0]["slabs"]:
            h = sl.get("hole")
            if isinstance(h, dict) and "edges" in h:
                h.pop("edges")
                h["fill"] = h.pop("flat", h.get("fill"))
        for sl in spec["surfaces"][0]["slabs"]:
            h = sl.get("hole")
            if isinstance(h, dict):
                h.pop("flat", None)
        json.dump(spec, open(D + "/edges.json", "w"))
        json.dump(flat, open(D + "/flat.json", "w"))
        filled = [sl["id"] for sl in spec["surfaces"][0]["slabs"]
                  if isinstance(sl.get("hole"), dict) and (sl["hole"].get("edges") or sl["hole"].get("fill"))]
        for head, hname in ((None, "head-on"), (OFFAXIS, "off axis 0.35,0.1,0")):
            tag = "on" if head is None else "off"
            ref = render(D + "/edges.json", D + "/ref-" + tag, "hero-art", head)
            for variant in ("edges", "flat"):
                view = render(D + "/%s.json" % variant, D + "/%s-%s" % (variant, tag), "hero", head)
                res = measure(spec, view, ref)
                print("%s, %s:" % (hname, variant))
                for hid, parts in res.items():
                    line = "  %-7s" % hid
                    for part in ("shape", "corner", "rim"):
                        st = stats(parts[part])
                        if st is None:
                            line += "  %s: none" % part
                            continue
                        line += "\n      %-6s n %4d, dL mean %+5.1f, min %+5.1f, p95 %+5.1f, |dL| mean %4.1f p95 %4.1f" % (
                            part, st["n"], st["mean"], st["min"], st["p95"], st["absmean"], st["absp95"])
                        if variant == "edges" and hid in filled:
                            if part == "corner":
                                good = st["absmean"] <= 4 and st["absp95"] <= 8
                            elif part == "rim":
                                good = st["absmean"] <= 4
                            else:
                                good = st["p95"] <= 5 and -16 <= st["mean"] <= 0
                            if not good:
                                line += "  <- FAIL"
                                ok = False
                    print(line)
                    if DEBUG and parts.get("worst"):
                        print("    |dL| > 6 at (dL, x, y, dist to the control):", sorted(parts["worst"])[:12])
        print("GL-2 holes (edges):", "PASS" if ok else "FAIL")
        if keep:
            os.makedirs(keep, exist_ok=True)
            for tag in ("on", "off"):
                for v in ("edges", "flat", "ref"):
                    src = "%s/%s-%s/main-view.png" % (D, v, tag)
                    if os.path.exists(src):
                        shutil.copy(src, "%s/%s-%s-view.png" % (keep, v, tag))
    finally:
        shutil.rmtree(D, ignore_errors=True)
        try:
            os.rmdir(os.path.dirname(D))  # /tmp/lgs/p9-fx, when no other P9 test runs
        except OSError:
            pass
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
