#!/usr/bin/env python3
"""glassd test: atlas stability and spec latency (no feed, dashboard
forced hidden, test key prefix, private out dir; nothing visible).

1. spec A (hdr-back, tabs) -> spec B (+ play): texture size, backdrop UV and
   the existing slabs' UVs must not change.
2. N random "focus moves" (card / button slabs coming and going, some resized):
   - a slab id present in two consecutive outputs keeps its UV unless its size
     changed;
   - announced UVs stay inside [0, 1] and never overlap;
   - count texture size changes;
   - spec -> out latency.
3. dmabuf fds / RSS of vrcompositor and glassd before and after.
"""
import json
import os
import random
import signal
import subprocess
import sys
import time

D = "/tmp/lgs-fx"
SPEC = D + "/spec.json"
OUT = D + "/out.json"
BIN = os.environ.get("GLASSD") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "glassd")
N = int(sys.argv[1]) if len(sys.argv) > 1 else 400
PREFIX = "glassd-fx."


def pid(comm):
    r = subprocess.run(["pgrep", "-x", comm], capture_output=True, text=True)
    return int(r.stdout.split()[0])


def fdinfo(p):
    n = dm = 0
    for f in os.listdir(f"/proc/{p}/fd"):
        n += 1
        try:
            if "dmabuf" in os.readlink(f"/proc/{p}/fd/{f}"):
                dm += 1
        except OSError:
            pass
    rss = 0
    with open(f"/proc/{p}/status") as fh:
        for line in fh:
            if line.startswith("VmRSS"):
                rss = int(line.split()[1])
    return {"fds": n, "dmabuf": dm, "rssKB": rss}


def write_spec(obj):
    tmp = SPEC + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f)
    os.replace(tmp, SPEC)


def read_out():
    try:
        with open(OUT) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def wait_seq(seq, timeout=3.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        o = read_out()
        if o and o.get("seq") == seq and o.get("surfaces"):
            return o, time.time() - t0
        time.sleep(0.002)
    return read_out(), None


def surf(slabs):
    return {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080,
            "radius": 48, "material": "window", "visible": True, "shapes": [{"x": 0, "y": 0, "w": 1920, "h": 1080, "r": 48}],
            "slabs": slabs}


A = [{"id": "hdr-back", "w": 210, "h": 60, "r": 30, "material": "liquid", "x": 18, "y": 6, "dz": 0.015},
     {"id": "tabs", "w": 600, "h": 64, "r": 32, "material": "liquid", "x": 900, "y": 70, "dz": 0.012}]
B = A + [{"id": "play", "w": 260, "h": 72, "r": 36, "material": "liquid", "x": 120, "y": 840, "dz": 0.015}]

# a library-like pool: header capsules always, then 1-3 focused cards/buttons
CARDS = [{"id": f"card{i}", "w": 300, "h": 450, "r": 24, "x": 100 + 320 * (i % 5), "y": 300, "dz": 0.02} for i in range(12)]
BTNS = [{"id": f"btn{i}", "w": 180 + 20 * (i % 4), "h": 64, "r": 32, "x": 200 + 200 * (i % 6), "y": 900, "dz": 0.015} for i in range(10)]
SHEETS = [{"id": "sheet", "w": 900, "h": 700, "r": 40, "x": 510, "y": 190, "dz": 0.03, "material": "thick"}]


def overlap(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def main():
    random.seed(7)
    os.makedirs(D, exist_ok=True)
    C = pid("vrcompositor")
    write_spec({"seq": 1, "dial": 0.5, "surfaces": [surf(A)]})
    log = open(D + "/glassd.log", "w")
    g = subprocess.Popen([BIN, "--spec", SPEC, "--out", OUT, "--key-prefix", PREFIX, "--no-feed", "--dash", "off"],
                         stdout=log, stderr=subprocess.STDOUT)
    o1, lat1 = wait_seq(1, 15)
    m1 = o1["surfaces"]["main"]
    print("spec A:", json.dumps(m1), f"latency {lat1:.3f}")
    write_spec({"seq": 2, "dial": 0.5, "surfaces": [surf(B)]})
    o2, lat2 = wait_seq(2)
    m2 = o2["surfaces"]["main"]
    print("spec B:", json.dumps(m2), f"latency {lat2:.3f}")
    same = m1["texH"] == m2["texH"] and m1["backdrop"] == m2["backdrop"] and all(
        m1["slabs"][k] == m2["slabs"][k] for k in m1["slabs"])
    print("A -> B keeps texture size, backdrop and existing slabs:", same)
    base_c, base_g = fdinfo(C), fdinfo(g.pid)
    print("baseline: compositor", base_c, "glassd", base_g)

    prev, prev_sizes = {}, {}
    moved = resized = overlaps = outside = sizechanges = 0
    lats = []
    texH = m2["texH"]
    seq = 2
    for i in range(N):
        seq += 1
        pick = [dict(s) for s in A]
        pick += random.sample(CARDS, random.randint(0, 2))
        pick += random.sample(BTNS, random.randint(0, 2))
        if random.random() < 0.1:
            pick += SHEETS
        for s in pick:
            if s["id"].startswith("card") and random.random() < 0.15:
                s["h"] = 450 + 30  # focus lift resizes the card a little
        write_spec({"seq": seq, "dial": 0.5, "surfaces": [surf(pick)]})
        o, lat = wait_seq(seq)
        if lat is None:
            print("no echo for", seq)
            continue
        lats.append(lat)
        m = o["surfaces"]["main"]
        if m["texH"] != texH:
            sizechanges += 1
            texH = m["texH"]
        sizes = {s["id"]: (s["w"], s["h"]) for s in pick}
        uvs = m["slabs"]
        for k, uv in uvs.items():
            if any(v < 0 or v > 1 for v in uv):
                outside += 1
            if k in prev and prev[k] != uv:
                if prev_sizes.get(k) == sizes.get(k):
                    moved += 1
                else:
                    resized += 1
        keys = list(uvs)
        for a in range(len(keys)):
            for b in range(a + 1, len(keys)):
                if overlap(uvs[keys[a]], uvs[keys[b]]):
                    overlaps += 1
        prev, prev_sizes = uvs, sizes
    lats.sort()
    print(f"churn {N}: moved {moved}, re-placed after resize {resized}, overlaps {overlaps}, outside [0,1] {outside}, "
          f"texture size changes {sizechanges}")
    print(f"spec->out latency: median {lats[len(lats)//2]*1000:.1f} ms, p95 {lats[int(len(lats)*0.95)]*1000:.1f} ms, "
          f"max {lats[-1]*1000:.1f} ms")
    time.sleep(1.0)
    print("after: compositor", fdinfo(C), "glassd", fdinfo(g.pid))
    g.send_signal(signal.SIGTERM)
    g.wait(10)
    time.sleep(1.0)
    print("exit", g.returncode, "compositor", fdinfo(C))
    log.close()
    txt = open(D + "/glassd.log").read().splitlines()
    print("--- glassd log lines with atlas/drop/layout (first 12):")
    print("\n".join([l for l in txt if "atlas" in l or "stays flat" in l][:12]))
    print("layout lines:", sum(1 for l in txt if l.startswith("layout ")))
    print("\n".join(txt[-4:]))
    for f in os.listdir(D):
        os.remove(os.path.join(D, f))
    os.rmdir(D)


if __name__ == "__main__":
    main()
