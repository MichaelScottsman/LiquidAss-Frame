#!/usr/bin/env python3
"""Pixel checks for the window-nav acceptance tests (docs/phase2/concepts/window-nav.md §13).

Works on mockup renders (shots/p2_window-nav_*.png) and on device captures (CDP `shot`, 1.5x,
or hvgrab frames; look, measure, then delete hvgrab frames).

  python docs/phase2/concepts/window-nav-measure.py edge SHOT Y X0 X1
      Top-edge profile of a glass slab whose top edge is at row Y, between columns X0..X1.
      Pass (AT-23): the darkest quarter of the edge highlight is <= 35 % of the brightest
      quarter, i.e. a light-dependent lobe, never a line of constant brightness.

  python docs/phase2/concepts/window-nav-measure.py dl SHOT  rect|circle  rect|circle
      Mean luminance difference between two regions, e.g. a focused and a checked menu row (AT-8c).
      Region syntax: rect:x0,y0,x1,y1  or  circle:cx,cy,r.  Pass: |dL| >= 25.

  python docs/phase2/concepts/window-nav-measure.py focus SHOT rest=R focus=R [sel=R] [hover=R]
      G-FOCUS criteria (PLAN §1.4, VP P-14, P-15; AT-8b = PLAN-1a-2) on one capture, each region
      inset by 6 shot px by the caller (VP §6 SHOT definition):
        focus >= rest + 40 L;  focus >= sel + 15 L;  sel >= hover + 12 L.

Luminance is VP §6's SHOT luma, L = 0.299 R + 0.587 G + 0.114 B (0-255), the definition P10's
`glass.py focus` uses (revision 3; revision 2 used Rec. 709 weights).

  python docs/phase2/concepts/window-nav-measure.py ring SHOT_WITH SHOT_WITHOUT X Y
      Pointer-proxy check (AT-0b): two captures of the same surface, one with the synthetic
      pointer at (X, Y) and one after pointerleave. The difference must peak (>= 50 L) within
      2 px of (X, Y) and nowhere else.
"""
import sys

import numpy as np
from PIL import Image


def lum(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def region(L, spec):
    kind, nums = spec.split(':')
    v = [float(x) for x in nums.split(',')]
    yy, xx = np.mgrid[0:L.shape[0], 0:L.shape[1]]
    if kind == 'rect':
        x0, y0, x1, y1 = v
        m = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
    else:
        cx, cy, r = v
        m = (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
    return float(L[m].mean())


def edge(path, y, x0, x1, inner=10):
    L = lum(path)
    e = np.max(np.stack([L[r, x0:x1] for r in range(y, y + 3)]), axis=0)
    d = e - L[y + inner, x0:x1]
    q = [float(s.mean()) for s in np.array_split(d, 4)]
    hi, lo = max(q), min(q)
    ratio = (max(lo, 0) / hi) if hi > 0 else 0.0
    print('segments', [round(float(s.mean()), 1) for s in np.array_split(d, 8)])
    print(f'brightest quarter {hi:.1f}  darkest quarter {lo:.1f}  ratio {ratio:.2f}  ->', 'PASS' if ratio <= 0.35 else 'FAIL')
    return ratio <= 0.35


def dl(path, a, b):
    L = lum(path)
    la, lb = region(L, a), region(L, b)
    print(f'L({a}) = {la:.1f}   L({b}) = {lb:.1f}   dL = {la - lb:.1f}  ->', 'PASS' if abs(la - lb) >= 25 else 'FAIL')
    return abs(la - lb) >= 25


def focus(path, specs):
    L = lum(path)
    v = {}
    for sp in specs:
        k, reg = sp.split('=', 1)
        v[k] = region(L, reg)
        print(f'L({k}) = {v[k]:.1f}   [{reg}]')
    checks = [('focus - rest', 'focus', 'rest', 40), ('focus - sel', 'focus', 'sel', 15), ('sel - hover', 'sel', 'hover', 12)]
    ok = True
    for name, a, b, need in checks:
        if a in v and b in v:
            d = v[a] - v[b]
            good = d >= need
            ok &= good
            print(f'{name:13s} = {d:6.1f}  (need >= {need})  ->', 'PASS' if good else 'FAIL')
    return ok


def ring(path_with, path_without, x, y, r=40):
    # only the neighbourhood of the pointer (r shot px; the ring is 16 CSS px = 24 shot px): the two captures
    # also differ where the page reacted to the move (a dwelled card's light), which is not the ring
    d = np.abs(lum(path_with) - lum(path_without))
    yy, xx = np.mgrid[0:d.shape[0], 0:d.shape[1]]
    d = d * (((xx - x) ** 2 + (yy - y) ** 2) <= r * r)
    w = d * (d >= 30)
    if w.sum() == 0:
        print('no difference between the two captures -> FAIL')
        return False
    cx, cy = float((w * xx).sum() / w.sum()), float((w * yy).sum() / w.sum())
    off = ((cx - x) ** 2 + (cy - y) ** 2) ** .5
    spread = float(np.sqrt((w * ((xx - cx) ** 2 + (yy - cy) ** 2)).sum() / w.sum()))
    ok = off <= 2 and d.max() >= 50 and spread <= 12
    print(f'difference centroid ({cx:.1f},{cy:.1f}), offset {off:.1f} px, peak {d.max():.0f}, spread {spread:.1f} px ->', 'PASS' if ok else 'FAIL')
    return ok


if __name__ == '__main__':
    cmd, shot = sys.argv[1], sys.argv[2]
    if cmd == 'edge':
        ok = edge(shot, int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]))
    elif cmd == 'dl':
        ok = dl(shot, sys.argv[3], sys.argv[4])
    elif cmd == 'focus':
        ok = focus(shot, sys.argv[3:])
    elif cmd == 'ring':
        ok = ring(shot, sys.argv[3], float(sys.argv[4]), float(sys.argv[5]))
    else:
        print(__doc__)
        ok = False
    sys.exit(0 if ok else 1)
