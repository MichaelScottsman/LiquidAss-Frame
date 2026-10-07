#!/usr/bin/env python3
"""Render an HTML mockup to PNG with headless Chrome (on this PC).

  python tools/mockshot.py docs/phase2/mockups/home.html shots/p2_home_mock.png [1920x1080] [--scale 1]
         [--rects OUT.json] [--sel "CSS"]...

Each call uses its own throwaway Chrome profile, so several agents can render
at once. Backdrop-filter, SVG filters and web fonts all work (Chromium).

--rects OUT.json also dumps, from the same render, the rect of every element
with a data-id attribute (and of every match of each --sel selector) in page
CSS px, as {"size": [w, h], "scale": s, "rects": {"<data-id>": [x, y, w, h]},
"sel": {"<selector>": [[x, y, w, h], ...]}} (glass.py cmp, focus). That path
drives the installed Chrome through Playwright and waits for the page's
scripts the same 3 s the plain path gives them.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

DUMP_JS = r"""
(sels) => {
  const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, Math.round(b.width * 10) / 10, Math.round(b.height * 10) / 10]; };
  const rects = {};
  for (const el of document.querySelectorAll('[data-id]')) {
    const k = el.getAttribute('data-id');
    if (!(k in rects)) rects[k] = r(el);
  }
  const sel = {};
  for (const s of sels) sel[s] = [...document.querySelectorAll(s)].map(r);
  return { rects, sel };
}
"""


def render_rects(src, out, w, h, scale, rects_out, sels):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=["--hide-scrollbars"])
        try:
            pg = b.new_page(viewport={"width": int(w), "height": int(h)}, device_scale_factor=float(scale))
            pg.goto(src.as_uri(), wait_until="load")
            pg.wait_for_timeout(3000)
            data = pg.evaluate(DUMP_JS, sels)
            pg.screenshot(path=str(out))
        finally:
            b.close()
    data.update({"size": [int(w), int(h)], "scale": float(scale), "mockup": src.name})
    Path(rects_out).parent.mkdir(parents=True, exist_ok=True)
    with open(rects_out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1)
    return data


def main(argv):
    argv = list(argv)
    rects_out = None
    sels = []
    if "--rects" in argv:
        i = argv.index("--rects")
        rects_out = argv[i + 1]
        del argv[i:i + 2]
    while "--sel" in argv:
        i = argv.index("--sel")
        sels.append(argv[i + 1])
        del argv[i:i + 2]
    if len(argv) < 3:
        print(__doc__)
        return 2
    src = Path(argv[1]).resolve()
    out = Path(argv[2]).resolve()
    size = argv[3] if len(argv) > 3 and "x" in argv[3] else "1920x1080"
    scale = "1"
    if "--scale" in argv:
        scale = argv[argv.index("--scale") + 1]
    w, h = size.split("x")
    out.parent.mkdir(parents=True, exist_ok=True)
    if rects_out:
        data = render_rects(src, out, w, h, scale, rects_out, sels)
        print(f"{out} ({out.stat().st_size} bytes); {len(data['rects'])} data-id rects -> {rects_out}")
        return 0
    profile = tempfile.mkdtemp(prefix="mockshot-")
    try:
        r = subprocess.run([CHROME, "--headless=new", "--hide-scrollbars", "--no-first-run", "--disable-extensions",
                            f"--user-data-dir={profile}", f"--window-size={w},{h}",
                            f"--force-device-scale-factor={scale}", "--virtual-time-budget=3000",
                            f"--screenshot={out}", src.as_uri()],
                           capture_output=True, text=True, timeout=90)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    if not out.exists():
        print(r.stderr[-2000:])
        return 1
    print(f"{out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
