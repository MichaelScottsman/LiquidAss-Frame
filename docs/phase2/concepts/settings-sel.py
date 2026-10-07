#!/usr/bin/env python3
"""T-SEL for the Settings concept (docs/phase2/concepts/settings.md §3.3, §12): the selected sidebar pill must be
brighter than a hovered one by >= 12 (mean luma, 0..255) in every room.

It measures the pill interior to the right of the label (x +200..+320 from the window's left edge, the row's inner
44 px), excluding a 16 px radius around SteamVR's laser dot, for the selected row, the hovered row and the next
(unlit) row. Rows are 72 px at 80 px pitch from y 108 inside the window (settings.md §3.3).

  python docs/phase2/concepts/settings-sel.py SHOT SEL_INDEX HOVER_INDEX [--dot X,Y] [--win X,Y]

  SHOT          a mockup render (window at 320,66 in a 1920 x 1080 view, the default) or a live `shot main` capture
                (window at 0,0 in the 1920 x 1080 shot at 1.5x: pass --win 0,0 --scale 1.5)
  SEL_INDEX     sidebar row index of the selected page as it is drawn (0 = first visible row)
  HOVER_INDEX   row index of the hovered row
  --dot X,Y     the laser dot in shot px (omit for live captures with the `lgs-hover` test class: no dot)
  --scale S     shot px per window px (1 for mockups, 1.5 for live shots)

Results on the revision-2 mockups (2026-10-07): lounge +12.9, dim studio +36.9, T1 +27.3 (all PASS).
"""
import sys
from PIL import Image


def main(argv):
    if len(argv) < 4:
        print(__doc__)
        return 2
    path, si, hi = argv[1], int(argv[2]), int(argv[3])
    opt = dict(zip(argv[4::2], argv[5::2]))
    dx, dy = map(float, opt.get('--dot', '-999,-999').split(','))
    wx, wy = map(float, opt.get('--win', '320,66').split(','))
    sc = float(opt.get('--scale', '1'))
    im = Image.open(path).convert('L')
    px = im.load()

    def mean(i):
        y0 = 108 + i * 80
        tot = n = 0
        for y in range(int((y0 + 14) * sc + wy), int((y0 + 58) * sc + wy)):
            for x in range(int(200 * sc + wx), int(320 * sc + wx)):
                if (x - dx) ** 2 + (y - dy) ** 2 < (16 * sc) ** 2:
                    continue
                tot += px[x, y]
                n += 1
        return tot / n

    s, h, u = mean(si), mean(hi), mean(hi + 1)
    ok = s - h >= 12
    print(f"{path}: selected {s:.1f}  hovered {h:.1f}  unlit {u:.1f}  diff {s - h:+.1f}  {'PASS' if ok else 'FAIL'} (need >= +12)")
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
