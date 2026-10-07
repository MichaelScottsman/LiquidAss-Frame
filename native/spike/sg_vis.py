#!/usr/bin/env python3
"""P7 visual probe, run ON the Frame: installs SRC.js as __LGS_SG_TEST with
debug tints (pop green, base red, cover blue), applies one spec, grabs the
headset view at fixed delays, destroys, grabs again. Frames show the room:
look at them, then delete them at once on both machines.

  python3 sg_vis.py SRC.js OUTDIR [MODE]

MODE: pop (default: one big pop at +10 mm), t1dim (window.dim 0.4 on Steam's
real panel), yaw (test.yaw 25 deg), fc (frame controls moved 120 mm left and
shown without the laser). Run under the native and lab-vr locks.
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

HV = os.path.join(GS, "native", "spike", "hvgrab")
G = "window.__LGS_SG_TEST"
MAIN = "valve.steam.gamepadui.main"


def grab(out, tag):
    path = os.path.join(out, f"p7v_{tag}.png")
    try:
        # twice: the first frame after a pause can be an old one
        subprocess.run([HV, path, "3"], capture_output=True, timeout=4)
        time.sleep(0.3)
        subprocess.run([HV, path, "3"], capture_output=True, timeout=4)
    except subprocess.TimeoutExpired:
        pass
    return path if os.path.exists(path) else None


async def main():
    src_path, out = sys.argv[1], sys.argv[2]
    mode = sys.argv[3] if len(sys.argv) > 3 else "pop"
    os.makedirs(out, exist_ok=True)
    src = open(src_path, encoding="utf-8").read().strip().rstrip(";")
    tg = next(x for x in lgs_vr.targets() if x["title"] == "systemui")
    async with lgs.Session(tg["webSocketDebuggerUrl"]) as s:
        async def js(e, timeout=10):
            r = await s.eval(e, timeout)
            return json.loads(r) if isinstance(r, str) and r[:1] in "{[" else r

        async def keep(secs):
            t0 = time.time()
            while time.time() - t0 < secs:
                await js(f"{G} && {G}.ping(), 0")
                await asyncio.sleep(0.2)
        opts = {"version": "p7vis", "global": "__LGS_SG_TEST", "watchdogMs": 5000, "force": True,
                "debugTint": {"pop": [0.2, 1, 0.2], "base": [1, 0.3, 0.3], "cover": [0.3, 0.3, 1]}}
        shots = []
        try:
            print(json.dumps({"install": (await js(f"({src})({json.dumps(opts)})", 20)) is not None}), flush=True)
            shots.append(grab(out, "0_before"))
            if mode in ("pop", "pop1"):
                spec = {"seq": 1, "depthMotion": "none" if mode == "pop1" else "depth", "surfaces": [{"steamKey": MAIN, "texW": 1920, "texH": 1080, "visible": True,
                        "glassd": {"key": "glassd.none", "backdrop": [0, 0, 1, 1], "scale": 0.75},
                        "coverDz": 0.001, "baseDz": 0.002,
                        "popped": [{"id": "vis", "x": 300, "y": 200, "w": 1300, "h": 650, "dz": 0.0271}]}]}
                r = await js(f"JSON.stringify({G}.update({json.dumps(spec)}))")
            elif mode == "t1dim":
                r = await js(f"JSON.stringify({G}.windowState({{dim: 0.4}}))")
            elif mode == "yaw":
                r = await js(f"JSON.stringify({G}.test.yaw(25, 8000))")
            elif mode == "fc":
                r = await js(f"JSON.stringify({G}.overrides({{rules: [{{id: 'fc', target: 'frame-controls', addMm: [-120, 0, 0]}},"
                             f"{{id: 'vis', select: '[id^=\"legacy-frame-controls-\"]', props: {{'only-visible-with-laser': false}}}}]}}))")
            else:
                r = None
            print(json.dumps({"apply": r}), flush=True)
            await keep(1.5)
            shots.append(grab(out, "1_applied"))
            print(json.dumps({"status": await js(f"JSON.stringify({G}.status())")}), flush=True)
        finally:
            print(json.dumps({"destroy": await js(f"{G} ? ({G}.destroy(), 'destroyed') : 'absent'")}), flush=True)
        await asyncio.sleep(1.0)
        shots.append(grab(out, "2_after"))
        print(json.dumps({"shots": shots}), flush=True)


asyncio.run(main())
