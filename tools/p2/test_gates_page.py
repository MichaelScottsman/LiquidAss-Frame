#!/usr/bin/env python3
"""Offline test of the gate sweeps (P10): lab/lab_gates.js on tools/p2/fixtures/gates_page.html.

  python tools/p2/test_gates_page.py [--json]

Runs the fixture in a local headless Chromium (Chrome or Edge, a fresh temporary profile, 1280 x 720) with the lab
helpers in their single-page mode, and prints each case: SIZE's obscured rule and its scroll-room check (REQ C4a->P10),
the P-08 box on the visible rect (REQ C2a->P10 #13), E-TAB on a tab row (REQ C3b->P10), E-GRID as an AUD-only
SHRUNK waiver (REQ C2b->P10), focusable: false glyphs as part of their host (REQ C3a->P10), E-MENU rows and Steam's
appended Cancel (PLAN R2-5, REQ Coordinator->P10) and container panes in AUD (REQ C7->P10). Exit 0 when every case
passes, 1 otherwise, 3 when no browser is found. No device, no network.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "tools" / "p2" / "fixtures" / "gates_page.html"
CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def browser():
    for c in CANDIDATES:
        if os.path.exists(c):
            return c
    for n in ("chromium", "chromium-browser", "google-chrome", "chrome", "msedge"):
        p = shutil.which(n)
        if p:
            return p
    return None


def run_once(exe, size):
    prof = tempfile.mkdtemp(prefix="p10-gates-")
    try:
        url = PAGE.resolve().as_uri() + "#auto"
        r = subprocess.run([exe, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                            f"--user-data-dir={prof}", f"--window-size={size[0]},{size[1]}", "--hide-scrollbars",
                            "--allow-file-access-from-files", "--virtual-time-budget=4000", "--dump-dom", url],
                           capture_output=True, text=True, timeout=120, encoding="utf-8", errors="replace")
    finally:
        shutil.rmtree(prof, ignore_errors=True)
    m = re.search(r'<pre id="result">(.*?)</pre>', r.stdout, re.S)
    if not m:
        return None, "no result in the page (" + (r.stderr.strip().splitlines() or ["?"])[-1][:200] + ")"
    txt = m.group(1).replace("&quot;", '"').replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    return json.loads(txt), None


def run():
    """The fixture needs a 1280 x 720 viewport (a main window). New headless Chrome counts its window frame in
    --window-size, so the first run measures the difference and the second corrects for it."""
    exe = browser()
    if not exe:
        return None, "no Chrome, Edge or Chromium found"
    size = [1280, 720]
    for _ in range(3):
        res, err = run_once(exe, size)
        if err:
            return None, err
        vp = res.get("viewport") or size
        if list(vp) == [1280, 720]:
            return res, None
        size = [size[0] + 1280 - vp[0], size[1] + 720 - vp[1]]
    return None, f"could not get a 1280 x 720 viewport (got {res.get('viewport')})"


def main(argv):
    res, err = run()
    if err:
        print(f"BLOCKED: {err}")
        return 3
    if "--json" in argv:
        print(json.dumps(res, indent=1))
    else:
        if res.get("error"):
            print("ERROR " + res["error"])
        for c in res.get("cases", []):
            print(f"{'PASS' if c['pass'] else 'FAIL'} {c['name']}" + ("" if c["pass"] else f"  {json.dumps(c.get('detail'))[:300]}"))
        print(f"viewport {res.get('viewport')}; SIZE {json.dumps(res.get('size'))}")
        print("overall:", "PASS" if res.get("pass") else "FAIL")
    return 0 if res.get("pass") else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
