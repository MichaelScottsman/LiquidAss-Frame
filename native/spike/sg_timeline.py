#!/usr/bin/env python3
"""Scene-graph latency timeline, run ON the Frame (no SSH round trips):
installs device/lgs_sg.js in systemui with debug tints, applies a test spec,
grabs the headset view (hvgrab) at fixed delays, destroys the nodes, grabs
again. Frames show the room: look at them, then delete them.

  python3 sg_timeline.py OUTDIR [dz]

The numeric SG-1 check (pushed values against the closed form, push rate,
nothing after the settle) is `sg_test.py SRC sg1`; this tool is the visual
companion (the default dz is the +10 mm step of SG-1).

Safe by construction:
- installs a separate instance, window.__LGS_SG_TEST with its own root, so the
  daemon's __LGS_SG is never replaced (run it under native.lock + lab-vr.lock);
- uses the shipped shared reparent mode (SHARED=0 for the old per-item mode);
- installs with a 5 s watchdog, so a crash or a dropped SSH session leaves
  nothing behind for long, and always destroys the nodes (try/finally);
- every hvgrab call has a timeout.
"""
import asyncio
import json
import os
import subprocess
import sys
import time

GS = os.path.expanduser("~/.local/share/glass-shell")
sys.dont_write_bytecode = True   # no __pycache__ left in the install (REQ P10->P7; like lab/lab.py)
sys.path.insert(0, os.path.join(GS, "device"))
import lgs  # noqa: E402
import lgs_vr  # noqa: E402

HV = os.path.expanduser("~/glass-shell-native/native/spike/hvgrab")
OUT = sys.argv[1]
DZ = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0271
WATCHDOG_MS = 5000
SPEC = {"M": 0, "surfaces": [{"steamKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "visible": True,
                              "glassd": {"key": "glassd.none", "backdrop": [0, 0, 1, 1], "scale": 0.75},
                              "coverDz": 0.001, "baseDz": 0.002,
                              "popped": [{"id": "g", "x": 200, "y": 150, "w": 700, "h": 400, "dz": DZ}]}]}


def shell_active():
    r = subprocess.run(["systemctl", "--user", "is-active", "lgs-shell"], capture_output=True, text=True,
                       env=lgs_vr.user_env(), timeout=10)
    return r.stdout.strip() in ("active", "activating", "deactivating", "reloading")


def grab(tag, t0):
    path = os.path.join(OUT, f"tl_{tag}.png")
    try:
        subprocess.run([HV, path, "3"], capture_output=True, timeout=4)   # < the 5 s watchdog
        print(f"{tag}: grabbed at +{time.time() - t0:.2f}s", flush=True)
    except subprocess.TimeoutExpired:
        print(f"{tag}: hvgrab timed out", flush=True)


async def wait_until(t0, d, s):
    """Sleep until t0 + d, pinging the instance so its watchdog stays quiet."""
    while time.time() - t0 < d:
        await s.eval("window.__LGS_SG_TEST && window.__LGS_SG_TEST.ping(), 0", 5)
        await asyncio.sleep(0.2)


async def main():
    os.makedirs(OUT, exist_ok=True)
    t = next(x for x in lgs_vr.targets() if x["title"] == "systemui")
    src = open(os.path.join(GS, "device", "lgs_sg.js"), encoding="utf-8").read().strip().rstrip(";")
    opts = {"version": "tl", "global": "__LGS_SG_TEST", "watchdogMs": WATCHDOG_MS, "force": True,
            "debugTint": {"pop": [0.2, 1, 0.2], "base": [1, 0.25, 0.25]},
            "sharedReparent": os.environ.get("SHARED", "1") != "0"}
    async with lgs.Session(t["webSocketDebuggerUrl"]) as s:
        try:
            await s.eval(f"({src})({json.dumps(opts)})", 20)
            grab("0_before", time.time())
            t0 = time.time()
            print(await s.eval(f"JSON.stringify(window.__LGS_SG_TEST.update({json.dumps(SPEC)}))", 10), flush=True)
            for d in (0.3, 1.0, 2.5, 5.0):
                await wait_until(t0, d, s)
                await s.eval("window.__LGS_SG_TEST && window.__LGS_SG_TEST.ping(), 0", 5)
                grab(f"1_add_{d}", t0)
        finally:
            t1 = time.time()
            print(await s.eval("window.__LGS_SG_TEST ? (window.__LGS_SG_TEST.destroy(), 'destroyed') : 'absent'", 10), flush=True)
        for d in (0.3, 1.0, 2.5, 5.0):
            while time.time() - t1 < d:
                await asyncio.sleep(0.02)
            grab(f"2_del_{d}", t1)


asyncio.run(main())
