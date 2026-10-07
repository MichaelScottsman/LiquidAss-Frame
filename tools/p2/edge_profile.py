#!/usr/bin/env python3
"""Image measures for the Phase 2 gates (P10, contracts/lab.md sections 3, 4).

  python glass.py edge PNG Y X0 X1 [--inner 10] [--luma 601|709] [--json]
      Top-edge profile of a glass slab whose top edge is at row Y between columns X0..X1
      (WN 8.2, AT-23, G-OUTLINE): dL = max over rows Y..Y+2 minus the glass `inner` px
      inside; 8 segment means; ratio = darkest quarter / brightest quarter. Pass <= 0.35.

  python glass.py focus --png PNG --pair NAME=A:B[:MIN] ... [--luma 601|709] [--inset N] [--room R] [--json]
      Mean luma of region A minus region B per pair (VP SHOT; WN AT-8b). Regions:
      rect:x0,y0,x1,y1 | pill:x0,y0,x1,y1 (capsule) | rrect:x0,y0,x1,y1,r | circle:cx,cy,r |
      band:x0,y0,x1,y1,d0,d1 (the ring d0..d1 px outside the rect, VP P-16).
      Pass: dL >= MIN (default 40).
      --room (session 5, REQ C2a-R2->P10 (3)): what translucent texels are seen over. `auto` (default): when
      either region holds translucent texels (alpha < .98 on more than 1 % of it), the pair is measured over
      the bright and the dark test room (P-14: "over the bright and dark test rooms"; AUD's uniform rooms,
      L 210 and 24) and judged by the worse; an opaque pair is measured as stored. A ROOMS name or R,G,B: that
      room only. `none`: the stored colour with the alpha dropped (the behaviour before session 5, which read a
      transparent texel as black).

Luma: 601 = 0.299 R + 0.587 G + 0.114 B (VP section 6 SHOT; the default for both, as in
window-nav-measure.py revision 3), 709 = 0.2126 R + 0.7152 G + 0.0722 B (--luma 709: revision 2 of
window-nav-measure.py, which WN 8.2's table was measured with).
"""
import json
import sys

import numpy as np
from PIL import Image

NO_EDGE_DL = 8.0     # below this brightest-quarter dL the top edge shows no line at all
W601 = (0.299, 0.587, 0.114)
W709 = (0.2126, 0.7152, 0.0722)


ROOMS = {"bright": (210, 210, 210), "dark": (24, 24, 24), "grey": (128, 128, 128), "black": (0, 0, 0)}  # = AUD's


def lum(img, weights=W601, room=None):
    """Luma plane (float, 0..255) of a path or a PIL image. room None: the stored colour with the alpha dropped
    (opaque renders, mockups; the Phase 1 behaviour). room (r, g, b) or a ROOMS name: each texel composited over that
    room by its alpha, as the headset shows a translucent overlay over the room (session 5, REQ C2a-R2->P10 (3))."""
    im = Image.open(img) if isinstance(img, str) else img
    if room is None or im.mode not in ("RGBA", "LA", "PA") and "transparency" not in im.info:
        a = np.asarray(im.convert("RGB")).astype(float)
    else:
        rgba = np.asarray(im.convert("RGBA")).astype(float)
        bg = np.array(ROOMS[room] if isinstance(room, str) else room, dtype=float)
        al = rgba[..., 3:4] / 255.0
        a = rgba[..., :3] * al + bg * (1.0 - al)
    return weights[0] * a[..., 0] + weights[1] * a[..., 1] + weights[2] * a[..., 2]


AUTO_ROOMS = ("bright", "dark")      # P-14's test rooms, as AUD's uniform rooms
TRANSLUCENT = 0.01                   # a region with more than 1 % translucent texels (alpha < .98) needs a room


def parse_room(spec):
    """'auto' | 'none' | a ROOMS name | 'R,G,B' -> 'auto', None, the name, or an (r, g, b) tuple."""
    spec = (spec or "auto").strip().lower()
    if spec == "auto":
        return "auto"
    if spec in ("none", "stored"):
        return None
    if spec in ROOMS:
        return spec
    try:
        v = tuple(int(float(x)) for x in spec.split(","))
    except ValueError:
        v = ()
    if len(v) != 3 or not all(0 <= x <= 255 for x in v):
        raise ValueError(f"--room: auto, none, {', '.join(ROOMS)} or R,G,B (got {spec!r})")
    return v


def room_name(room):
    return "stored" if room is None else room if isinstance(room, str) else "rgb(%d,%d,%d)" % tuple(room)


def translucent_share(A, spec, inset=0):
    """Share of a region's texels with alpha < .98 (A = alpha_plane)."""
    m = mask(A.shape, spec, inset)
    return float((A[m] < 0.98).mean()) if m.any() else 0.0


def rooms_for(room, share):
    """The rooms a pair is measured over: auto -> the test rooms when translucent, else as stored."""
    if room == "auto":
        return list(AUTO_ROOMS) if share > TRANSLUCENT else [None]
    return [room]


def alpha_plane(img):
    """Alpha (0..1) of a path or PIL image; all ones for an opaque image."""
    im = Image.open(img) if isinstance(img, str) else img
    if im.mode not in ("RGBA", "LA", "PA") and "transparency" not in im.info:
        return np.ones((im.size[1], im.size[0]))
    return np.asarray(im.convert("RGBA"))[..., 3].astype(float) / 255.0


def mask(shape, spec, inset=0):
    kind, nums = spec.split(":", 1)
    v = [float(x) for x in nums.split(",")]
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    if kind == "rect":
        x0, y0, x1, y1 = v
        x0, y0, x1, y1 = x0 + inset, y0 + inset, x1 - inset, y1 - inset
        return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
    if kind == "circle":
        cx, cy, r = v
        return (xx - cx) ** 2 + (yy - cy) ** 2 <= (r - inset) ** 2
    if kind in ("pill", "rrect"):
        x0, y0, x1, y1 = v[:4]
        x0, y0, x1, y1 = x0 + inset, y0 + inset, x1 - inset, y1 - inset
        r = min((y1 - y0) / 2, (x1 - x0) / 2) if kind == "pill" else max(0.0, v[4] - inset)
        cx = np.clip(xx, x0 + r, x1 - r)
        cy = np.clip(yy, y0 + r, y1 - r)
        return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1) & (((xx - cx) ** 2 + (yy - cy) ** 2) <= r * r)
    if kind == "band":
        x0, y0, x1, y1, d0, d1 = v
        outer = (xx >= x0 - d1) & (xx < x1 + d1) & (yy >= y0 - d1) & (yy < y1 + d1)
        inner = (xx >= x0 - d0) & (xx < x1 + d0) & (yy >= y0 - d0) & (yy < y1 + d0)
        return outer & ~inner
    raise ValueError("region: rect:x0,y0,x1,y1 | pill:x0,y0,x1,y1 | rrect:x0,y0,x1,y1,r | circle:cx,cy,r | "
                     "band:x0,y0,x1,y1,d0,d1")


def region_mean(L, spec, inset=0):
    m = mask(L.shape, spec, inset)
    if not m.any():
        raise ValueError(f"region {spec} is empty")
    return float(L[m].mean())


def edge(L, y, x0, x1, inner=10):
    """WN 8.2 top-edge profile. Returns dict(segments, hi, lo, ratio, pass)."""
    y, x0, x1 = int(y), int(x0), int(x1)
    h = L.shape[0]
    rows = [L[r, x0:x1] for r in range(max(0, y), min(h, y + 3))]
    e = np.max(np.stack(rows), axis=0)
    d = e - L[min(h - 1, y + inner), x0:x1]
    q = [float(s.mean()) for s in np.array_split(d, 4)]
    hi, lo = max(q), min(q)
    ratio = (max(lo, 0) / hi) if hi > 0 else 0.0
    segs = [round(float(s.mean()), 1) for s in np.array_split(d, 8)]
    # An outline must be visible to be an outline (VP P-42): with the brightest quarter under 8 dL there is no
    # edge line at all, so the ratio means nothing (REQ C1c->P10 b, C4a->P10: flat fills gave ratio ~1).
    visible = hi >= NO_EDGE_DL
    return {"segments": segs, "brightest": round(hi, 1), "darkest": round(lo, 1), "ratio": round(ratio, 3),
            "edge": "visible" if visible else "none", "pass": (ratio <= 0.35) or not visible}


def measure_pair(plane, A, a, b, ia, ib, room="auto"):
    """dL of region a minus region b over the rooms the pair needs (rooms_for): plane(room) -> luma plane,
    A = alpha plane. Judged by the worse room. -> dict(La, Lb, dL, room, rooms, translucent)."""
    share = max(translucent_share(A, a, ia), translucent_share(A, b, ib))
    per = {}
    for rm in rooms_for(room, share):
        L = plane(rm)
        la, lb = region_mean(L, a, ia), region_mean(L, b, ib)
        per[room_name(rm)] = (la, lb)
    worst = min(per, key=lambda k: per[k][0] - per[k][1])
    la, lb = per[worst]
    return {"La": round(la, 1), "Lb": round(lb, 1), "dL": round(la - lb, 1), "room": worst,
            "rooms": {k: round(v[0] - v[1], 1) for k, v in per.items()}, "translucent": round(share, 3)}


def pairs(path, specs, inset=0, weights=W601, room="auto"):
    planes = {}

    def plane(rm):
        k = room_name(rm)
        if k not in planes:
            planes[k] = lum(path, weights, rm)
        return planes[k]
    A = alpha_plane(path)
    out = []
    for spec in specs:
        name, _, rest = spec.partition("=")
        parts = rest.split(":")
        # A and B are kind:nums each; an optional trailing :MIN
        a = parts[0] + ":" + parts[1]
        b = parts[2] + ":" + parts[3]
        mn = float(parts[4]) if len(parts) > 4 else 40.0
        m = measure_pair(plane, A, a, b, inset, inset, room)
        out.append(dict({"name": name, "a": a, "b": b, "min": mn, "pass": m["dL"] >= mn}, **m))
    return out


def opt(argv, name, default=None):
    if name in argv:
        i = argv.index(name)
        v = argv[i + 1]
        del argv[i:i + 2]
        return v
    return default


def main_edge(argv):
    argv = list(argv)
    as_json = "--json" in argv
    if as_json:
        argv.remove("--json")
    inner = int(opt(argv, "--inner", 10))
    weights = W709 if opt(argv, "--luma", "601") == "709" else W601
    if len(argv) < 4:
        print(__doc__)
        return 2
    path, y, x0, x1 = argv[0], int(argv[1]), int(argv[2]), int(argv[3])
    r = edge(lum(path, weights), y, x0, x1, inner)
    if as_json:
        print(json.dumps(r))
    else:
        print("segments", r["segments"])
        print(f"brightest quarter {r['brightest']:.1f}  darkest quarter {r['darkest']:.1f}  ratio {r['ratio']:.2f}  ->",
              "PASS" if r["pass"] else "FAIL", "" if r["edge"] == "visible" else "(no visible edge)")
    return 0 if r["pass"] else 1


def main_focus_png(argv):
    argv = list(argv)
    as_json = "--json" in argv
    if as_json:
        argv.remove("--json")
    path = opt(argv, "--png")
    weights = W709 if opt(argv, "--luma", "601") == "709" else W601
    inset = int(opt(argv, "--inset", 0))
    try:
        room = parse_room(opt(argv, "--room", "auto"))
    except ValueError as e:
        print(e)
        return 2
    specs = []
    while "--pair" in argv:
        specs.append(opt(argv, "--pair"))
    if not path or not specs:
        print(__doc__)
        return 2
    res = pairs(path, specs, inset, weights, room)
    if as_json:
        print(json.dumps(res, indent=1))
    else:
        for r in res:
            over = "" if list(r["rooms"]) == ["stored"] else                 "  over " + ", ".join(f"{k} {v:+.1f}" for k, v in r["rooms"].items()) + f" (judged: {r['room']})"
            print(f"{r['name']}: L(A) = {r['La']:.1f}  L(B) = {r['Lb']:.1f}  dL = {r['dL']:+.1f}  (min {r['min']:g}){over}  ->",
                  "PASS" if r["pass"] else "FAIL")
    return 0 if all(r["pass"] for r in res) else 1


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "focus":
        sys.exit(main_focus_png(sys.argv[2:]))
    sys.exit(main_edge(sys.argv[1:]))
