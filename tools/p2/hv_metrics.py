#!/usr/bin/env python3
"""Metrics for one headset-view frame (hvgrab), for `glass.py hv` (P10, contracts/lab.md section 4).

The frame shows the room. This module only reads it; glass.py deletes it right after.

measure(path, rect=None) -> dict:
  size            frame size
  rect            the window rect used (given with --rect x0,y0,x1,y1 in frame px, else auto)
  glassL          mean luma (601) inside the rect, inset 8 %   (G-HV: 55..110)
  outsideL        mean luma of the band 12..48 px outside the rect
  edge            WN 8.2 profile of the rect's top edge (ratio <= 0.35)
  doubling        max normalised correlation of the x-gradient of the band around the
                  top edge with itself shifted by 4..40 px (> 0.6 at some shift = a doubled edge),
                  and that shift
  pass            all of the above within limits (rect checks only when a rect is known)

Auto rect: the bounding box of the largest bright component (the UI is brighter than the
unlit room passthrough shows). It is a hint; pass --rect for a gate verdict.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from edge_profile import W601, edge, lum  # noqa: E402


def auto_rect(L):
    """Bounding box of the largest bright component (UI is brighter than the
    unlit room the passthrough shows); a hint only."""
    thr = max(40.0, float(np.percentile(L, 60)) + 10.0)
    m = L > thr
    try:
        from scipy import ndimage
        m = ndimage.binary_closing(m, iterations=4)
        lab, n = ndimage.label(m)
        if n == 0:
            return None
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        i = int(np.argmax(sizes)) + 1
        if sizes[i - 1] < 0.02 * m.size:
            return None
        ys, xs = np.nonzero(lab == i)
    except ImportError:
        ys, xs = np.nonzero(m)
        if len(ys) < 0.02 * m.size:
            return None
    return [int(np.percentile(xs, 1)), int(np.percentile(ys, 1)), int(np.percentile(xs, 99)), int(np.percentile(ys, 99))]


def doubling(L, y, x0, x1, half=12):
    y0, y1 = max(0, y - half), min(L.shape[0], y + half)
    band = L[y0:y1, x0:x1]
    g = np.abs(np.diff(band, axis=1)).mean(axis=0)
    g = g - g.mean()
    best, at = 0.0, 0
    for s in range(4, 41):
        a, b = g[:-s], g[s:]
        den = np.sqrt((a * a).sum() * (b * b).sum())
        if den <= 0:
            continue
        c = float((a * b).sum() / den)
        if c > best:
            best, at = c, s
    return round(best, 3), at


def measure(path, rect=None):
    im = Image.open(path)
    L = lum(im, W601)
    h, w = L.shape
    out = {"size": [w, h], "frameL": round(float(L.mean()), 1)}
    auto = False
    if not rect:
        rect = auto_rect(L)
        auto = True
    if not rect:
        out.update({"rect": None, "pass": None, "note": "no window found; pass --rect x0,y0,x1,y1"})
        return out
    x0, y0, x1, y1 = [int(v) for v in rect]
    out["rect"] = [x0, y0, x1, y1]
    out["rectSource"] = "auto (hint only)" if auto else "given"
    ix, iy = int((x1 - x0) * 0.08), int((y1 - y0) * 0.08)
    inside = L[y0 + iy:y1 - iy, x0 + ix:x1 - ix]
    out["glassL"] = round(float(inside.mean()), 1)
    yy, xx = np.mgrid[0:h, 0:w]
    outer = (xx >= x0 - 48) & (xx < x1 + 48) & (yy >= y0 - 48) & (yy < y1 + 48)
    inner = (xx >= x0 - 12) & (xx < x1 + 12) & (yy >= y0 - 12) & (yy < y1 + 12)
    ring = outer & ~inner
    out["outsideL"] = round(float(L[ring].mean()), 1) if ring.any() else None
    span = x1 - x0
    e = edge(L, max(0, y0 - 1), x0 + int(span * 0.06), x1 - int(span * 0.06))
    out["edge"] = e
    score, shift = doubling(L, y0, x0, x1)
    out["doubling"] = {"score": score, "shift": shift, "doubled": score > 0.6}
    ok = 55 <= out["glassL"] <= 110 and e["pass"] and score <= 0.6
    out["pass"] = ok if not auto else None
    if auto:
        out["note"] = "auto rect: verdict withheld; look at the frame (--look) and pass --rect for a gate verdict"
    return out


if __name__ == "__main__":
    r = None
    if "--rect" in sys.argv:
        r = [int(v) for v in sys.argv[sys.argv.index("--rect") + 1].split(",")]
    print(json.dumps(measure(sys.argv[1], r), indent=1))
