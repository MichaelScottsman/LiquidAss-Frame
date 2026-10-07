#!/usr/bin/env python3
"""Scene-graph latency timeline, run ON the Frame (no SSH round trips):
installs device/lgs_sg.js in systemui with debug tints, applies a test spec,
grabs the headset view (hvgrab) at fixed delays, destroys the nodes, grabs
again. Frames show the room: look at them, then delete them.

  python3 sg_timeline.py OUTDIR [dz]
"""
import asyncio
import json
import os
import subprocess
import sys
import time

GS = os.path.expanduser("~/.local/share/glass-shell")
sys.path.insert(0, os.path.join(GS, "device"))
import lgs  # noqa: E402
import lgs_vr  # noqa: E402

HV = os.path.expanduser("~/glass-shell-native/native/spike/hvgrab")
OUT = sys.argv[1]
DZ = float(sys.argv[2]) if len(sys.argv) > 2 else 0.002
SPEC = {"M": 0, "surfaces": [{"steamKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "visible": True,
                              "glassd": {"key": "glassd.none", "backdrop": [0, 0, 1, 1], "scale": 0.75},
                              "coverDz": 0.001, "baseDz": 0.002,
                              "popped": [{"id": "g", "x": 200, "y": 150, "w": 700, "h": 400, "dz": DZ}]}]}


def grab(tag, t0):
    path = os.path.join(OUT, f"tl_{tag}.png")
    subprocess.run([HV, path, "3"], capture_output=True)
    print(f"{tag}: grabbed at +{time.time() - t0:.2f}s", flush=True)


async def main():
    os.makedirs(OUT, exist_ok=True)
    t = next(x for x in lgs_vr.targets() if x["title"] == "systemui")
    src = open(os.path.join(GS, "device", "lgs_sg.js"), encoding="utf-8").read().strip().rstrip(";")
    async with lgs.Session(t["webSocketDebuggerUrl"]) as s:
        await s.eval(f"({src})({json.dumps({'version': 'tl', 'watchdogMs': 0, 'force': True, 'debugTint': {'pop': [0.2, 1, 0.2], 'base': [1, 0.25, 0.25]}, 'sharedReparent': os.environ.get('SHARED') == '1'})})")
        grab("0_before", time.time())
        t0 = time.time()
        print(await s.eval(f"JSON.stringify(window.__LGS_SG.update({json.dumps(SPEC)}))"), flush=True)
        for d in (0.3, 1.0, 2.5, 5.0):
            while time.time() - t0 < d:
                await asyncio.sleep(0.02)
            grab(f"1_add_{d}", t0)
        t1 = time.time()
        print(await s.eval("(window.__LGS_SG.destroy(), 'destroyed')"), flush=True)
        for d in (0.3, 1.0, 2.5, 5.0):
            while time.time() - t1 < d:
                await asyncio.sleep(0.02)
            grab(f"2_del_{d}", t1)


asyncio.run(main())
