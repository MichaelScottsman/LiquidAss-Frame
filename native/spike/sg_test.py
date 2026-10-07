#!/usr/bin/env python3
"""P7 scene-graph acceptance tests (docs/phase2/PLAN.md P7 card, SG-1..SG-4),
run ON the Frame (no SSH round trips inside a test):

  python3 sg_test.py SRC.js TEST [--grab DIR]

TEST is one of sg1, sg2, sg3, sg4, all. Prints one JSON object per test.

Safe by construction:
- installs SRC.js (device/lgs_sg.js or a draft) as a separate instance,
  window.__LGS_SG_TEST with its own root node, so the daemon's __LGS_SG is
  never replaced;
- a 5 s watchdog in the page and try/finally destroy(): a crash or a dropped
  SSH session leaves nothing behind for long;
- --grab DIR takes headset-view frames with hvgrab (they show the room: the
  caller looks at them and deletes them at once, on both machines).
Run it under the locks: flock -w 1800 /tmp/lgs/native.lock flock -w 240
/tmp/lgs/lab-vr.lock python3 sg_test.py ...
"""
import asyncio
import json
import math
import os
import subprocess
import sys
import time

GS = os.path.expanduser("~/.local/share/glass-shell")
sys.path.insert(0, os.path.join(GS, "device"))
import lgs  # noqa: E402
import lgs_vr  # noqa: E402

HV = os.path.join(GS, "native", "spike", "hvgrab")
G = "window.__LGS_SG_TEST"
MAIN = "valve.steam.gamepadui.main"
WATCHDOG_MS = 5000


def surface(popped, **kw):
    s = {"steamKey": MAIN, "texW": 1920, "texH": 1080, "visible": True,
         "glassd": {"key": "glassd.none", "backdrop": [0, 0, 1, 1], "scale": 0.75},
         "coverDz": 0.001, "baseDz": 0.002, "popped": popped}
    s.update(kw)
    return s


def step_closed(frm, to, t, d, b=0.0):
    """Independent closed form (springs.py step()), from rest."""
    w = 2 * math.pi / d
    z = 1 - b if b >= 0 else 1 / (1 + b)
    if abs(z - 1) < 1e-9:
        x = 1 - math.exp(-w * t) * (1 + w * t)
    elif z < 1:
        wd = w * math.sqrt(1 - z * z)
        x = 1 - math.exp(-z * w * t) * (math.cos(wd * t) + (z * w / wd) * math.sin(wd * t))
    else:
        r1 = -w * (z - math.sqrt(z * z - 1))
        r2 = -w * (z + math.sqrt(z * z - 1))
        x = 1 - (r2 / (r2 - r1) * math.exp(r1 * t) - r1 / (r2 - r1) * math.exp(r2 * t))
    return frm + (to - frm) * x


def grab(out, tag):
    if not out:
        return None
    path = os.path.join(out, f"p7_{tag}.png")
    try:
        subprocess.run([HV, path, "3"], capture_output=True, timeout=4)
    except subprocess.TimeoutExpired:
        return None
    return path if os.path.exists(path) else None


class T:
    def __init__(self, s):
        self.s = s

    async def js(self, expr, timeout=10):
        r = await self.s.eval(expr, timeout)
        return json.loads(r) if isinstance(r, str) and r[:1] in "{[" else r

    async def call(self, fn, *args):
        a = ",".join(json.dumps(x) for x in args)
        return await self.js(f"JSON.stringify({G}.{fn}({a}))")

    async def keep(self, secs, every=0.2):
        t0 = time.time()
        while time.time() - t0 < secs:
            await self.js(f"{G} && {G}.ping(), 0")
            await asyncio.sleep(every)


async def sg1(t, out):
    """0 -> 10 mm step on `depth`: pushed values against the closed form."""
    geom = await t.call("geom")
    dz = 0.0271                       # +10 mm at r = 1 (PLAN 1.7 units)
    pop = {"id": "g", "x": 200, "y": 150, "w": 700, "h": 400, "dz": dz}
    await t.call("timeline", True)
    p0 = (await t.call("status"))["pushes"]
    await t.call("update", {"seq": 1, "surfaces": [surface([pop])]})
    await t.keep(1.0)
    st = await t.call("status")
    p1 = st["pushes"]
    tl = await t.call("timeline", True)
    rt = await t.js(f"JSON.stringify({G}._retargets ? {G}._retargets() : [])")
    await t.keep(1.5)
    p2 = (await t.call("status"))["pushes"]
    key = MAIN + "#g"
    r = next((x for x in rt if x.get("key") == key and x.get("target") == dz), None)
    errs, frames = [], [e for e in tl if key in e["z"]]
    unit_mm = geom["unitM"] * 1000
    if r:
        for e in frames:
            tt = (e["t"] - r["t0"]) / 1000
            exp = step_closed(r["x0"], dz, tt, r["d"], r["b"]) if not e.get("final") else dz
            errs.append(abs(e["z"][key] - exp) * unit_mm)
    ts = [e["t"] for e in frames]
    gaps = [b - a for a, b in zip(ts, ts[1:])]
    per_s = max((sum(1 for x in ts if a <= x < a + 1000) for a in ts), default=0)
    res = {"test": "SG-1", "geom": geom, "frames": len(frames), "final": bool(frames and frames[-1].get("final")),
           "maxErrMm": round(max(errs), 4) if errs else None, "minGapMs": min(gaps) if gaps else None,
           "maxPushesPerS": per_s, "pushesDuring": p1 - p0, "pushesAfterSettle": p2 - p1,
           "settleMs": (ts[-1] - r["t0"]) if (ts and r) else None, "retarget": r,
           "first": frames[:3], "last": frames[-2:]}
    res["pass"] = bool(errs) and res["maxErrMm"] <= 0.5 and per_s <= 61 and res["pushesAfterSettle"] == 0 and res["final"]
    return res


async def sg2(t, out):
    """300 add/remove cycles: hygiene (no leaked sgids), rendering continues."""
    s0 = (await t.call("status"))["sgids"]
    t0 = time.time()
    cycles = int(os.environ.get("CYCLES", "300"))
    for i in range(cycles):
        x = 100 + (i % 7) * 200
        pops = [{"id": f"c{i % 5}", "x": x, "y": 200 + (i % 3) * 150, "w": 180, "h": 120, "dz": 0.0271}]
        dim = 0.6 if i % 10 < 5 else None
        # each state is pushed (<= 15 pushes/s), so the compositor really sees
        # every add and every retire (the E9-E14 failure mode)
        await t.js(f"{G}.update({json.dumps({'seq': i, 'depthMotion': 'none', 'surfaces': [surface(pops, dim=dim)]})}), 0")
        await asyncio.sleep(0.07)
        await t.js(f"{G}.update({json.dumps({'seq': i, 'depthMotion': 'none', 'surfaces': [surface([])]})}), 0")
        await asyncio.sleep(0.07)
    took = time.time() - t0
    await t.keep(0.5)
    mid = (await t.call("status"))["sgids"]
    await t.call("clear")
    await asyncio.sleep(0.3)
    end = (await t.call("status"))["sgids"]
    # rendering continues: one tinted pop (debug tint), headset view
    shot = []
    if out:
        await t.js(f"{G}.destroy(), 0")
        await t.install({"debugTint": {"pop": [0.2, 1, 0.2], "base": [1, 0.3, 0.3]}})
        await t.call("update", {"seq": 999, "depthMotion": "none",
                                "surfaces": [surface([{"id": "vis", "x": 300, "y": 200, "w": 1300, "h": 650, "dz": 0.0271}])]})
        t1 = time.time()
        for d in (1.2, 3.0, 6.0):
            await t.keep(d - (time.time() - t1))
            shot.append(grab(out, f"sg2_after_{d}"))
    res = {"test": "SG-2", "cycles": cycles, "seconds": round(took, 1), "pushes": (await t.call("status"))["pushes"],
           "before": s0, "afterCycles": mid, "afterClear": end, "shot": shot}
    res["pass"] = mid["live"] == mid["dom"] and end["live"] == 0 and end["dom"] == 0 and end["retireQueued"] == 0 \
        and mid["noRetire"] == 0
    return res


LASER_DUMP = """(async()=>{const d=await OverlayStore.DumpLaserOverlays();const o={};
for(const [k,v] of Object.entries(d.overlays||{})){if(/legacy-frame-controls/.test(k)){const p=v.scene_graph_panel;
o[k]={w:p.fWidth,h:p.fHeight,interactive:p.bInteractive,laserOnly:p.bOnlyVisibleWithLaser}}}return JSON.stringify(o)})()"""
FC_ATTR = """JSON.stringify([...document.querySelectorAll('vsg-transform[id$=":bottom-controls-transform"]')]
.map(e=>{const c=[...e.children].find(k=>k.tagName==='VSG-TRANSFORM');return c&&c.getAttribute('translation')}))"""


async def sg3(t, out):
    """Transform override round trip on the frame controls."""
    before = {"attr": await t.js(FC_ATTR), "laser": await t.js(LASER_DUMP)}
    rules = [{"id": "fc-test", "target": "frame-controls", "addMm": [-120, 0, 0]}]
    if out:   # make the laser-only panel visible for the headset view (restored with the rule)
        rules.append({"id": "fc-visible", "select": '[id^="legacy-frame-controls-"]', "props": {"only-visible-with-laser": False}})
    shot0 = grab(out, "sg3_0_before") if out else None
    r1 = await t.call("overrides", {"seq": 1, "rules": rules})
    await t.keep(0.8)
    during = {"attr": await t.js(FC_ATTR), "laser": await t.js(LASER_DUMP), "applied": r1}
    shot1 = grab(out, "sg3_1_moved")
    await t.call("overrides", {"seq": 2, "rules": []})
    await t.keep(0.8)
    after_clear = {"attr": await t.js(FC_ATTR), "laser": await t.js(LASER_DUMP)}
    # TTL: apply again, then stop the heartbeat
    await t.call("overrides", {"seq": 3, "rules": rules[:1]})
    await asyncio.sleep(0.6)
    applied_again = await t.js(FC_ATTR)
    t0 = time.time()
    restored_at = None
    while time.time() - t0 < WATCHDOG_MS / 1000 + 3:
        a = await t.js(FC_ATTR)
        if a == before["attr"]:
            restored_at = round(time.time() - t0, 2)
            break
        await asyncio.sleep(0.25)
    st = await t.call("status")
    res = {"test": "SG-3", "before": before, "during": during, "afterClear": after_clear,
           "appliedAgain": applied_again, "ttlRestoredAfterS": restored_at, "watchdogMs": WATCHDOG_MS,
           "expired": st["expired"], "shots": [shot0, shot1]}
    moved = during["attr"] != before["attr"]
    same_size = all(during["laser"].get(k, {}).get("w") == v["w"] and during["laser"].get(k, {}).get("h") == v["h"]
                    for k, v in before["laser"].items())
    res["pass"] = moved and same_size and after_clear["attr"] == before["attr"] and applied_again != before["attr"] \
        and restored_at is not None
    return res


async def sg4(t, out):
    """dim on a surface: only cover and base pieces wrapped."""
    pops = [{"id": "a", "x": 300, "y": 200, "w": 400, "h": 300, "dz": 0.0271, "slab": [0, 0.5, 0.2, 0.7]}]
    await t.call("update", {"seq": 1, "reduceMotion": True, "surfaces": [surface(pops, dim=0.6)]})
    await t.keep(0.4)
    d = await t.call("dump")
    kinds = {}
    for it in d:
        k = kinds.setdefault(it["kind"], {"n": 0, "dimmed": 0, "colors": set()})
        k["n"] += 1
        k["dimmed"] += 1 if it["dimmed"] else 0
        if it.get("wrap"):
            k["colors"].add(tuple(it["wrap"]["color"]))
    # animated dim: 1 -> 0.6 on sheet-in, then back to none
    await t.call("update", {"seq": 2, "surfaces": [surface(pops, dim=None)]})
    await t.keep(1.0)
    after = await t.call("dump")
    for k in kinds.values():
        k["colors"] = sorted(k["colors"])
    res = {"test": "SG-4", "kinds": kinds,
           "afterUndim": {it["kind"]: it.get("wrap") for it in after}}
    res["pass"] = kinds.get("cover", {}).get("dimmed") == kinds.get("cover", {}).get("n", -1) and \
        kinds.get("base", {}).get("dimmed") == kinds.get("base", {}).get("n", -1) and \
        kinds.get("pop", {}).get("dimmed", 1) == 0 and kinds.get("slab", {}).get("dimmed", 1) == 0 and \
        all(list(c) == [0.6, 0.6, 0.6] for c in kinds["cover"]["colors"] + kinds["base"]["colors"])
    return res


async def main():
    src_path, test = sys.argv[1], sys.argv[2]
    out = sys.argv[sys.argv.index("--grab") + 1] if "--grab" in sys.argv else None
    if out:
        os.makedirs(out, exist_ok=True)
    src = open(src_path, encoding="utf-8").read().strip().rstrip(";")
    tg = next(x for x in lgs_vr.targets() if x["title"] == "systemui")
    async with lgs.Session(tg["webSocketDebuggerUrl"]) as s:
        t = T(s)

        async def install(extra=None):
            opts = {"version": "p7test", "global": "__LGS_SG_TEST", "watchdogMs": WATCHDOG_MS, "force": True}
            opts.update(extra or {})
            return await t.js(f"({src})({json.dumps(opts)})", 20)
        t.install = install
        tests = {"sg1": sg1, "sg2": sg2, "sg3": sg3, "sg4": sg4}
        names = list(tests) if test == "all" else [test]
        try:
            for n in names:
                await install()
                try:
                    res = await tests[n](t, out)
                except Exception as e:  # noqa: BLE001
                    res = {"test": n, "pass": False, "error": repr(e)}
                print(json.dumps(res, default=list), flush=True)
                await t.js(f"{G} ? ({G}.destroy(), 'destroyed') : 'absent'")
        finally:
            print(json.dumps({"cleanup": await t.js(f"{G} ? ({G}.destroy(), 'destroyed') : 'absent'")}), flush=True)


asyncio.run(main())
