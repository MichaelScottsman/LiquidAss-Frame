#!/usr/bin/env python3
"""T-SEL for the Settings concept (docs/phase2/concepts/settings.md §3.3, §12): selection and focus contrast of one
sidebar row, measured the way VP §6 "SHOT" and PLAN §4.1 G-FOCUS define it: the mean luma (0.299 R + 0.587 G + 0.114 B,
0..255) inside the element's rect inset by 6 shot px, compared between captures of the SAME row in different states, so
the room behind the row is the same in every sample (revision 2 compared different rows and so mixed in the backdrop).

  python docs/phase2/concepts/settings-sel.py --row I rest=SHOT hover=SHOT sel=SHOT [focus=SHOT] [--dot X,Y] [--win X,Y] [--scale S]

  --row I       sidebar row index as drawn (0 = first visible row); rows are 72 px at 80 px pitch from y 108, x 16..384
  rest=         the row at rest (unselected, no hover, no focus)
  hover=        the row under the laser (laser mode: the light spot alone, PLAN §1.4)
  sel=          the row selected (current page), focus elsewhere
  focus=        the row selected and holding gamepad focus (Steam's sidebar: selection follows focus)
  --dot X,Y     SteamVR's laser dot in shot px; a 16 px radius around it is excluded from every sample
  --win X,Y     the window's top-left in the shot (mockups: 320,66; live `shot main`: 0,0)
  --scale S     shot px per window px (mockups 1; live shots 1.5)

Criteria (PLAN §1.4; VP P-03, P-14, P-15):
  sel   >= hover + 12        the selected row outranks a hovered one (T-SEL)
  hover -  rest in 10..25     laser hover is subtle (P-03)
  focus >= sel + 10           focused + selected over selected (P-15, second clause)
  focus >= rest + 40          focus contrast over rest (P-14)
Live captures use the theme's test class `lgs-hover` (styled exactly as :hover) with `--mode laser`, and `L.pad` with
`--mode pad` for focus (settings.md §12).
"""
import sys
from PIL import Image


def main(argv):
    args = argv[1:]
    if '--row' not in args:
        print(__doc__)
        return 2
    opt = {}
    shots = {}
    i = 0
    while i < len(args):
        a = args[i]
        if a.startswith('--'):
            opt[a] = args[i + 1]
            i += 2
        else:
            k, v = a.split('=', 1)
            shots[k] = v
            i += 1
    row = int(opt['--row'])
    dx, dy = map(float, opt.get('--dot', '-999,-999').split(','))
    wx, wy = map(float, opt.get('--win', '320,66').split(','))
    sc = float(opt.get('--scale', '1'))
    y0 = 108 + row * 80

    def mean(path):
        im = Image.open(path).convert('RGB')
        px = im.load()
        tot = n = 0
        for y in range(int(y0 * sc + wy) + 6, int((y0 + 72) * sc + wy) - 6):
            for x in range(int(16 * sc + wx) + 6, int(384 * sc + wx) - 6):
                if (x - dx) ** 2 + (y - dy) ** 2 < (16 * sc) ** 2:
                    continue
                r, g, b = px[x, y]
                tot += 0.299 * r + 0.587 * g + 0.114 * b
                n += 1
        return tot / n

    L = {k: mean(v) for k, v in shots.items()}
    print('  '.join(f'{k} {v:.1f}' for k, v in L.items()))
    checks = []
    if 'sel' in L and 'hover' in L:
        checks.append(('sel >= hover + 12', L['sel'] - L['hover'], L['sel'] - L['hover'] >= 12))
    if 'hover' in L and 'rest' in L:
        d = L['hover'] - L['rest']
        checks.append(('hover - rest in 10..25 (P-03)', d, 10 <= d <= 25))
    if 'focus' in L and 'sel' in L:
        checks.append(('focus >= sel + 10 (P-15)', L['focus'] - L['sel'], L['focus'] - L['sel'] >= 10))
    if 'focus' in L and 'rest' in L:
        checks.append(('focus >= rest + 40 (P-14)', L['focus'] - L['rest'], L['focus'] - L['rest'] >= 40))
    ok = True
    for name, d, p in checks:
        print(f'  {name}: {d:+.1f}  {"PASS" if p else "FAIL"}')
        ok = ok and p
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
