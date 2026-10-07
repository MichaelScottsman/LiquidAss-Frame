#!/usr/bin/env python3
"""AT-LEGIBLE, prototyped on the mockups (the same maths the T2 sampler and the device test use).

  python docs/phase2/mockups/legibility-check.py

1. solve: for the bright test hero (assets/hero-bright.jpg) and the dark procedural hero, compute the left
   dimming alpha the T2 sampler would choose: the smallest a in [.40, .70] such that the 95th-percentile
   luminance under every text box gives >= 4.5:1 for that box's text alpha (synopsis .90, labels .80);
2. measure: render the title mockups with the text hidden (shots/_legib_*.png, deleted afterwards), take the
   real pixels behind each text box, and report the contrast of each text run against its p95 background.

Contrast follows WCAG 2.x (relative luminance, sRGB compositing as the browser does).
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
MOCK = ROOT / "docs/phase2/mockups"
SHOTS = ROOT / "shots"
OVL = (320, 66)                       # overlay origin in the 1920 x 1080 mockup view
# text boxes in window px (revision 3 layout: the hero column starts at x 104, VP P-29; rects from the mockups'
# ?rects dump), the alpha of the white text, the dim layer that serves the box ("L" text column, "B" controls band =
# cluster + tab row, "T" toolbar row) and the glass fill over the art (clear glass composites to about white .15
# at the label line: its .16 -> .06 sheen at mid-height over a .06 base; revision 2 modelled it as .12). "Ctrl Bindings" is C5b's capsule (flag
# vrBindings): the bright mockups draw it on purpose, as the worst case for the controls band.
BOXES = {
    "synopsis": ((104, 294, 684, 352), 0.90, "L", 0.0),
    "stat labels": ((104, 358, 497, 384), 0.80, "L", 0.0),
    "stat values": ((104, 358, 497, 384), 0.96, "L", 0.0),
    "chip label": ((148, 250, 268, 274), 0.96, "L", 0.16),
    "Steam Input": ((560, 478, 694, 498), 0.96, "B", 0.15),
    "Ctrl Bindings": ((802, 478, 1014, 498), 0.96, "B", 0.15),
    "tab labels": ((270, 572, 700, 596), 0.96, "B", 0.15),
}
TARGET = {"L": 4.5, "B": 4.5, "T": 3.0}


def lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def rel_lum(rgb01):
    return lin(rgb01) @ np.array([0.2126, 0.7152, 0.0722])


def contrast(text_alpha, bg_rgb01):
    """white text at text_alpha over a background (sRGB 0..1), composited in sRGB like Chromium"""
    t = text_alpha + (1 - text_alpha) * np.asarray(bg_rgb01)
    Lt, Lb = rel_lum(t), rel_lum(bg_rgb01)
    return (np.maximum(Lt, Lb) + 0.05) / (np.minimum(Lt, Lb) + 0.05)


def left_dim_profile(a, x):
    """the revision-3 left gradient (game-pages.css): a until 51 % of 1280, .45a at 63 %, 0 at 77 %"""
    u = x / 1280
    return np.interp(u, [0, 0.51, 0.63, 0.77, 1], [a, a, 0.45 * a, 0, 0])


def bottom_dim_profile(a, y):
    """the revision-2 bottom gradient: a over the bottom 34 % of 656, .4a at 46 %, 0 at 58 %"""
    u = (656 - y) / 656
    return np.interp(u, [0, 0.34, 0.46, 0.58, 1], [a, a, 0.4 * a, 0, 0])


def hero_window(path):
    """the hero as the window shows it: object-fit cover into 1280 x 656, object-position 62 % 40 %"""
    im = Image.open(path).convert("RGB")
    s = max(1280 / im.width, 656 / im.height)
    w, h = round(im.width * s), round(im.height * s)
    im = im.resize((w, h), Image.LANCZOS)
    ox, oy = round((1280 - w) * 0.62), round((656 - h) * 0.40)
    canvas = Image.new("RGB", (1280, 656))
    canvas.paste(im, (ox, oy))
    return np.asarray(canvas).astype(float) / 255


def solve(path, label):
    img = hero_window(path)
    chosen = {}
    for layer, lo in (("L", 0.40), ("B", 0.35)):
        need_all = lo
        for name, ((x0, y0, x1, y1), ta, lay, fill) in BOXES.items():
            if lay != layer:
                continue
            px = img[y0:y1, x0:x1]
            xs = np.arange(x0, x1)[None, :]
            ys = np.arange(y0, y1)[:, None]
            need = None
            for a in np.arange(lo, 0.701, 0.01):
                d = left_dim_profile(a, xs) if layer == "L" else bottom_dim_profile(a, ys) * np.ones_like(xs)
                bg = px * (1 - d[..., None])
                bg = fill + (1 - fill) * bg                  # the glass or chip fill over the dimmed art
                Lb = rel_lum(bg)
                idx = np.argmin(np.abs(Lb - np.percentile(Lb, 95)))
                if float(contrast(ta, bg.reshape(-1, 3)[idx])) >= TARGET[layer]:
                    need = round(float(a), 2)
                    break
            print(f"         {name:13s} text {ta:.2f} needs {'> .70 (raise text alpha)' if need is None else need}")
            need_all = max(need_all, 0.70 if need is None else need)
        chosen[layer] = need_all
    print(f"[solve] {label}: --dimL {chosen['L']:.2f}  --dimB {chosen['B']:.2f}")
    return chosen


def render_notext(html, out):
    tmp = MOCK / f"_legib_{out}.html"
    s = (MOCK / html).read_text(encoding="utf-8")
    s = s.replace("</head>", "<style>.gp-syn,.gp-stats,.gp-chips .gp-chip,.gp-cap,.gp-seg,.gp-cloud{color:transparent!important;text-shadow:none!important}"
                  ".gp-stats span,.gp-stats b,.gp-seg .ok{color:transparent!important}.gp-cap .lgk-i{opacity:0}</style></head>")
    tmp.write_text(s, encoding="utf-8")
    png = SHOTS / f"_legib_{out}.png"
    subprocess.run([sys.executable, str(ROOT / "tools/mockshot.py"), str(tmp), str(png)], check=True, capture_output=True)
    tmp.unlink()
    a = np.asarray(Image.open(png).convert("RGB")).astype(float) / 255
    png.unlink()
    return a


def measure(html, label):
    a = render_notext(html, label)
    print(f"[measure] {html}")
    worst = 99
    for name, ((x0, y0, x1, y1), ta, _lay, _fill) in BOXES.items():
        px = a[OVL[1] + y0:OVL[1] + y1, OVL[0] + x0:OVL[0] + x1].reshape(-1, 3)
        L = rel_lum(px)
        bg = px[np.argmin(np.abs(L - np.percentile(L, 95)))]
        c = float(contrast(ta, bg))
        worst = min(worst, c)
        print(f"          {name:13s} text {ta:.2f}  p95 bg Y {round(float(np.percentile(L, 95)), 3)}  contrast {c:.2f}:1 {'PASS' if c >= 4.5 else 'FAIL'}")
    return worst


if __name__ == "__main__":
    solve(MOCK / "assets/hero-bright.jpg", "bright hero")
    measure("game-pages-title-bright.html", "bright_t2")
    measure("game-pages-title-bright-t1.html", "bright_t1")
    measure("game-pages-title-bright-r1.html", "bright_r1")
    measure("game-pages-title.html", "dark_t2")
