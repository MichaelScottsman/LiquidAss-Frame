#!/usr/bin/env python3
"""Render an HTML mockup to PNG with headless Chrome (on this PC).

  python tools/mockshot.py docs/phase2/mockups/home.html shots/p2_home_mock.png [1920x1080] [--scale 1]

Each call uses its own throwaway Chrome profile, so several agents can render
at once. Backdrop-filter, SVG filters and web fonts all work (Chromium).
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def main(argv):
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
