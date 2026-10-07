#!/usr/bin/env python3
"""SG-POPUP (P7, review R1 B1), run on the PC:

  python native/spike/sg_popup.py [--src device/lgs_sg.js] [--test native/spike/sg_test.py] [--look DIR]
                                  [--out FILE.jsonl]   (paths on the Frame are relative to the install)

Copies on popup parents must sit exactly on Steam's panel. On the Frame (under
native.lock, with lab.lock + lab-vr.lock held by the test itself) it runs
`sg_test.py SRC popup --grab /tmp/lgs/p7/pop --lablock` with full-size headset
frames. Per popup parent present (the bar, the frame menu, the "+" bar popup it
opens, the floating footer when shown), a magenta-tinted copy of the parent's
own displayed texture, built by lgs_sg.js like every cover:

  A  the copy 2 mm in front of Steam's panel: it renders (and the look strip
     shows where);
  B  the copy 2 mm behind Steam's panel: on the spot, Steam's opaque glyphs hide
     the copy's glyphs exactly; a misplaced copy shows its magenta glyphs beside
     them or through the panel's glass;
  C  (asymmetric displayed range only) B with the pre-R1 anchor: the control.

Each frame is measured on its own (the head pose may move between frames).
front = magenta glyph px of the copy in A (the largest magenta group); leak =
magenta glyph px in B (or C) around that place / front. Pixels of other panels
are white or coloured, never this magenta, so neighbours (the floating footer
above the bar, the window behind a bar popup) cannot disturb it.

PASS: every parent's anchor is its displayed centre in texture uv (within one
texture px), every A renders (front >= 100 px) and every B has leak <= 0.10;
at least one parent has an asymmetric displayed range, and at least one control
C has leak >= 0.15 (the measure sees the pre-R1 defect). The frame menu's
control is always strong (1.3 .. 2.1); a bar popup's varies (0.1 .. 0.8: most of
its shifted copy stays behind the popup's own fairly opaque glass), so it is
recorded, not required. On the spot every B measured 0 .. 0.004.

The frames show the room: they are fetched, measured and deleted at once on both
machines (a detached reaper on the Frame deletes them too if this script dies).
--look DIR also writes a crop strip per parent there (A | B | C) for a look;
delete it right after looking (LAB never-list).
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SSH = os.path.expanduser("~/.claude/skills/steam-frame-ssh/scripts/frame_ssh.py")
REMOTE_DIR = "/tmp/lgs/p7/pop"
FRONT_MIN = 100    # A: the copy renders
LEAK_OK = 0.10     # B: the copy's glyphs hidden behind Steam's
LEAK_BAD = 0.15    # C: the misplaced control shows them (measured 0.26 .. 1.4; on the spot 0 .. 0.001)


def ssh(*args, timeout=900):
    env = dict(os.environ, MSYS_NO_PATHCONV="1")
    return subprocess.run(["python", SSH, *args], capture_output=True, text=True, encoding="utf-8",
                          errors="replace", timeout=timeout, env=env)


def load(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float32)


def magenta(a, lo):
    """Magenta pixels (the copy's tint [1, 0, 1]): R and B >= lo, G well below both."""
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    mn = np.minimum(R, B)
    return (mn >= lo) & (G <= 0.35 * mn)


def components(mask, blk=16, minpx=2):
    """Connected groups of blk x blk blocks holding >= minpx mask pixels;
    returns the pixel count and block bounding box of the largest group."""
    H, W = mask.shape
    h, w = H // blk, W // blk
    m = mask[:h * blk, :w * blk].reshape(h, blk, w, blk).sum(axis=(1, 3))
    on = m >= minpx
    seen = np.zeros_like(on)
    best = None
    for y0 in range(h):
        for x0 in range(w):
            if not on[y0, x0] or seen[y0, x0]:
                continue
            stack, cells = [(y0, x0)], []
            seen[y0, x0] = True
            while stack:
                y, x = stack.pop()
                cells.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and on[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        stack.append((yy, xx))
            n = int(sum(m[y, x] for y, x in cells))
            if not best or n > best[0]:
                ys = [c[0] for c in cells]
                xs = [c[1] for c in cells]
                best = (n, (min(xs) * blk, min(ys) * blk, (max(xs) + 1) * blk, (max(ys) + 1) * blk))
    return best


def front(a):
    """The copy in frame A: its box and its bright magenta glyph px."""
    comp = components(magenta(a, 60))
    if not comp or comp[0] < 60:
        return {"found": False, "front": 0}
    x0, y0, x1, y1 = comp[1]
    glyph = magenta(a, 130)[y0:y1, x0:x1]
    return {"found": True, "box": [x0, y0, x1, y1], "front": int(glyph.sum())}


def leak(a, box, n_front):
    """Magenta glyph px of the copy visible in a behind-the-panel frame, around
    the copy's place in A (generous: the pose may move a little, a misplaced
    copy is off by up to ~130 px), per front glyph px."""
    x0, y0, x1, y1 = box
    m = int(0.6 * max(x1 - x0, y1 - y0)) + 32
    H, W = a.shape[:2]
    X0, Y0, X1, Y1 = max(0, x0 - m), max(0, y0 - m), min(W, x1 + m), min(H, y1 + m)
    # dimmer than in front: through the panel's glass the glyphs lose about half
    n = int(magenta(a[Y0:Y1, X0:X1], 80).sum())
    return {"region": [X0, Y0, X1, Y1], "magenta": n, "leak": round(n / max(n_front, 1), 3)}


def strip(paths, box, out):
    x0, y0, x1, y1 = box
    m = 40
    ims = [Image.open(p).convert("RGB").crop((max(0, x0 - m), max(0, y0 - m), x1 + m, y1 + m)) for p in paths if p]
    if not ims:
        return
    s = Image.new("RGB", (sum(i.width + 8 for i in ims), max(i.height for i in ims)), (255, 255, 255))
    x = 0
    for i in ims:
        s.paste(i, (x, 0))
        x += i.width + 8
    s.save(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="device/lgs_sg.js")
    ap.add_argument("--test", default="native/spike/sg_test.py", help="sg_test.py on the Frame (a draft copy)")
    ap.add_argument("--look")
    ap.add_argument("--out", default=os.path.join(HERE, "p7_results", "popup.jsonl"))
    args = ap.parse_args()
    # a detached reaper deletes the frames even if this script never fetches
    # them (a dropped SSH session; the lock wait can be long)
    cmd = (f"cd ~/.local/share/glass-shell && mkdir -p {REMOTE_DIR} && rm -f {REMOTE_DIR}/*.png; "
           f"setsid sh -c 'sleep 2100; rm -f {REMOTE_DIR}/p7_pop_*.png' >/dev/null 2>&1 < /dev/null & "
           # lab.Lock gives up after 240 s; with many agents queueing, try again (6 x)
           f"for i in 1 2 3 4 5 6; do HVS=1 flock -w 1800 /tmp/lgs/native.lock python3 -B {args.test} {args.src} popup "
           f"--grab {REMOTE_DIR} --lablock > /tmp/lgs/p7/pop.log 2>&1; grep -q 'lock busy' /tmp/lgs/p7/pop.log || break; "
           f"sleep 15; done; cat /tmp/lgs/p7/pop.log")
    r = ssh("run", cmd, "--timeout", "2400", timeout=2500)
    res = None
    for line in r.stdout.splitlines():
        if line.startswith("{") and '"SG-POPUP"' in line:
            res = json.loads(line)
    if not res:
        ssh("run", f"rm -f {REMOTE_DIR}/*.png")
        print(json.dumps({"test": "SG-POPUP", "pass": False, "error": "no result", "out": r.stdout[-1500:],
                          "err": r.stderr[-800:]}))
        return 1
    tmp = tempfile.mkdtemp(prefix="p7pop-")
    local = {}
    try:
        for rp in [p.get(x) for p in res["parents"] for x in ("A", "B", "C") if p.get(x)]:
            lp = os.path.join(tmp, os.path.basename(rp))
            ssh("get", rp, lp, timeout=120)
            if os.path.exists(lp):
                local[rp] = lp
    finally:
        ssh("run", f"rm -f {REMOTE_DIR}/*.png")
    try:
        for p in res["parents"]:
            if p.get("blocked") or not local.get(p.get("A")) or not local.get(p.get("B")):
                p["m"] = {"found": False, "why": p.get("blocked") or "frame missing"}
                continue
            f = front(load(local[p["A"]]))
            p["m"] = f
            if f["found"]:
                p["m"]["B"] = leak(load(local[p["B"]]), f["box"], f["front"])
                if local.get(p.get("C")):
                    p["m"]["C"] = leak(load(local[p["C"]]), f["box"], f["front"])
                if args.look:
                    os.makedirs(args.look, exist_ok=True)
                    strip([local.get(p.get(x)) for x in ("A", "B", "C")], p["m"]["B"]["region"],
                          os.path.join(args.look, "pop_" + p["key"].split("gamepadui.")[-1] + ".png"))
    finally:
        for lp in local.values():
            try:
                os.remove(lp)
            except OSError:
                pass
        try:
            os.rmdir(tmp)
        except OSError:
            pass
    ok, rows = True, []
    for p in res["parents"]:
        m = p.get("m") or {}
        row = {"key": p["key"], "uv": [round(v, 4) for v in (p.get("uv") or [])], "origin": p.get("origin"),
               "tex": p.get("tex"), "px": p.get("px"), "anchor": p.get("anchor"), "expect": p.get("expect"),
               "anchorOk": p.get("anchorOk"), "asymmetric": p.get("asymmetric"), "curv": p.get("curv"),
               "front": m.get("front"), "B": m.get("B"), "C": m.get("C")}
        if p.get("blocked"):
            row["blocked"] = p["blocked"]
        else:
            row["pass"] = bool(p.get("anchorOk")) and bool(m.get("found")) and m["front"] >= FRONT_MIN and \
                bool(m.get("B")) and m["B"]["leak"] <= LEAK_OK
            if p.get("C"):
                row["controlSeen"] = bool(m.get("C")) and m["C"]["leak"] >= LEAK_BAD
            ok = ok and row["pass"]
        rows.append(row)
    built = [x for x in rows if not x.get("blocked")]
    out = {"test": "SG-POPUP", "date": time.strftime("%Y-%m-%d %H:%M"), "parents": rows, "sgids": res.get("sgids"),
           "plus": res.get("plus"), "pass": ok and bool(built) and any(x.get("asymmetric") for x in built) and
           any(x.get("controlSeen") for x in built),
           "frames": "fetched, measured and deleted on both machines"}
    print(json.dumps(out))
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "a", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(out) + "\n")
    return 0 if out["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
