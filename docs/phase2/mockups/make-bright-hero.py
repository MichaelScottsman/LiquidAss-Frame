#!/usr/bin/env python3
"""Generate the bright test hero and its logo PNG for the game-pages legibility mockups.

  python docs/phase2/mockups/make-bright-hero.py

Writes assets/hero-bright.jpg (1920 x 620, Steam's library_hero size: a sunlit snowfield under a pale sky,
the worst case for white text) and assets/logo-bright.png (640 x 360 max, transparent, like Steam's logo.png:
white letters with a thin navy edge, no drop shadow). Both are procedural (own work, CC0); no third-party art.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent / "assets"
W, H = 1920, 620
rng = np.random.default_rng(7)


def lerp(a, b, t):
    return a + (b - a) * t


def hero():
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    sky_top = np.array([118, 170, 222], float)
    sky_hor = np.array([232, 242, 250], float)
    t = np.clip(y / 0.55, 0, 1) ** 0.8
    img = lerp(sky_top, sky_hor, t[..., None]) * np.ones((H, W, 1))
    # sun glare (upper left third: right where a text column would sit)
    d = np.sqrt(((x - 0.30) * 1.9) ** 2 + (y - 0.12) ** 2)
    glare = np.exp(-(d / 0.20) ** 2) * 60 + np.exp(-(d / 0.05) ** 2) * 80
    img += glare[..., None]
    # three mountain ridges, snow-covered, with blue shadow sides
    def ridge(base, amp, freq, seed):
        r = np.random.default_rng(seed)
        ph = r.uniform(0, 6, 4)
        u = np.linspace(0, 1, W)
        h = (0.55 * np.sin(u * freq + ph[0]) + 0.30 * np.sin(u * freq * 2.3 + ph[1]) + 0.15 * np.sin(u * freq * 4.7 + ph[2]))
        return base - amp * h
    for base, amp, freq, seed, lit, shade in [
        (0.50, 0.20, 5.0, 1, (238, 244, 250), (150, 172, 200)),
        (0.60, 0.14, 7.5, 2, (246, 249, 252), (170, 190, 214)),
        (0.70, 0.08, 11.0, 3, (250, 251, 253), (196, 210, 226)),
    ]:
        top = ridge(base, amp, freq, seed)
        slope = np.convolve(np.gradient(top), np.ones(41) / 41, mode="same")
        mask = y >= top[None, :]
        depth = np.clip((y - top[None, :]) / 0.10, 0, 1)            # lighter just under the crest
        shade_amt = np.clip(slope * 900, 0, 1)[None, :] * (0.4 + 0.6 * depth)
        col = lerp(np.array(lit, float), np.array(shade, float), shade_amt[..., None])
        img = np.where(mask[..., None], col, img)
    # bright snowfield foreground with soft drifts
    fg = 0.78 + 0.03 * np.sin(np.linspace(0, 1, W) * 9)[None, :]
    mask = y >= fg
    snow = np.array([247, 249, 251], float) - 14 * np.clip((y - fg) * 3, 0, 1)[..., None]
    img = np.where(mask[..., None], snow * np.ones((1, 1, 1)), img)
    # a small skier (dark) far right, a lift line of dots
    im = Image.fromarray(np.clip(img + rng.normal(0, 2.2, img.shape), 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(im)
    dr.ellipse([1460, 486, 1472, 498], fill=(40, 52, 70))
    dr.polygon([(1458, 498), (1474, 498), (1478, 530), (1454, 530)], fill=(200, 40, 50))
    dr.line([(1440, 534), (1494, 528)], fill=(30, 36, 48), width=3)
    for i in range(14):
        dr.ellipse([1100 + i * 40, 300 + i * 9, 1104 + i * 40, 304 + i * 9], fill=(70, 80, 96))
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    im.save(HERE / "hero-bright.jpg", quality=90)


def logo():
    font = None
    for f in ["C:/Windows/Fonts/ariblk.ttf", "C:/Windows/Fonts/impact.ttf", "C:/Windows/Fonts/arialbd.ttf"]:
        if Path(f).exists():
            font = ImageFont.truetype(f, 150)
            break
    lines = ["GLACIER", "RUN"]
    im = Image.new("RGBA", (1400, 420), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    y = 10
    for ln in lines:
        dr.text((10, y), ln, font=font, fill=(255, 255, 255, 255), stroke_width=5, stroke_fill=(18, 36, 78, 255))
        y += 165
    # icy gradient inside the letters (keep the stroke)
    a = np.asarray(im).astype(float)
    grad = np.linspace(1, 0, a.shape[0])[:, None]
    white = (a[..., 0] > 200)
    a[..., 0] = np.where(white, lerp(200, 255, grad), a[..., 0])
    a[..., 1] = np.where(white, lerp(232, 255, grad), a[..., 1])
    a[..., 2] = np.where(white, 255, a[..., 2])
    im = Image.fromarray(a.astype(np.uint8), "RGBA")
    im = im.crop(im.getbbox())
    im.thumbnail((640, 360))
    im.save(HERE / "logo-bright.png")


if __name__ == "__main__":
    HERE.mkdir(exist_ok=True)
    hero()
    logo()
    print("wrote", HERE / "hero-bright.jpg", HERE / "logo-bright.png")
