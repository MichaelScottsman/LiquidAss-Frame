#!/usr/bin/env python3
"""P7 scene-graph acceptance tests (docs/phase2/PLAN.md P7 card, SG-1..SG-4),
run ON the Frame (no SSH round trips inside a test):

  python3 sg_test.py SRC.js TEST[,TEST...] [--grab DIR] [--motion] [--lablock]

TEST: sg1, sg2, sg3, sg4, sg6 (watchdog, 12 s), prof (profiles), order
(z ordering), targets (override targets, tab-bar rule), win (window dim and
recede), yaw (test hook), sink, react, frag, roomdim, and the R1 review tests
win2 (absent window = rest), failclosed (no retire export), revive (any call
after a watchdog expiry), chunk (no webpack residue), popup (copies on popup
parents; --lablock, frames measured by sg_popup.py on the PC), tick (idle
housekeeping cost; --lablock), or all (everything but sg6, popup and tick).
Prints one JSON object per test. --motion prepends device/shared/motion.js as
the daemon does. --lablock holds lab.lock + lab-vr.lock for the run.

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
sys.dont_write_bytecode = True   # no __pycache__ left in the install (REQ P10->P7; like lab/lab.py)
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
        # system.HeadsetView is refreshed only while someone samples it: the
        # first frame after a pause can be minutes old, so grab twice
        scale = os.environ.get("HVS", "3")    # hvgrab's downscale (1 = full 1920 x 1080)
        subprocess.run([HV, path, scale], capture_output=True, timeout=5)
        time.sleep(0.3)
        subprocess.run([HV, path, scale], capture_output=True, timeout=5)
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
    res = {"test": "SG-1", "motion": st.get("motion"), "geom": geom, "frames": len(frames), "final": bool(frames and frames[-1].get("final")),
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
        for d in (0.4, 1.2, 3.0):
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
    # animated dim on sheet-in (not reduceMotion): the timeline carries dim:<key>
    await t.call("timeline", True)
    await t.call("update", {"seq": 3, "surfaces": [surface(pops, dim=0.6)]})
    await t.keep(1.2)
    tl = [e for e in await t.call("timeline", True) if "dim:" + MAIN in e["z"]]
    sg = (await t.call("status"))["sgids"]
    await t.call("clear")
    res = {"test": "SG-4", "kinds": kinds,
           "afterUndim": {it["kind"]: it.get("wrap") for it in after},
           "dimAnim": {"frames": len(tl), "first": tl[:2], "last": tl[-1:]}, "sgids": sg}
    res["pass"] = kinds.get("cover", {}).get("dimmed") == kinds.get("cover", {}).get("n", -1) and \
        kinds.get("base", {}).get("dimmed") == kinds.get("base", {}).get("n", -1) and \
        kinds.get("pop", {}).get("dimmed", 1) == 0 and kinds.get("slab", {}).get("dimmed", 1) == 0 and \
        all(list(c) == [0.6, 0.6, 0.6] for c in kinds["cover"]["colors"] + kinds["base"]["colors"]) and \
        all(w is None for w in res["afterUndim"].values()) and len(tl) > 5 and \
        tl[-1]["z"]["dim:" + MAIN] == 0.6 and sg["live"] == sg["dom"]
    return res


PANEL_PROPS = """JSON.stringify([...document.querySelectorAll('#lgs-sg-root-__LGS_SG_TEST vsg-node[vsg-type=panel]')]
.map(e=>{const p=e.buildNode({})[1].properties;return {name:p.debug_name,interactive:p.interactive,
appid:p['steam-input-appid']===undefined?null:p['steam-input-appid'],kbd:p['can-take-keyboard-focus']===undefined?null:p['can-take-keyboard-focus'],
frs:p['frame-resize-scale-factor']}}))"""


async def sgprof(t, out):
    """Card item 4: interactive and steam-input-appid only in the wearer profile."""
    pops = [{"id": "a", "x": 1500, "y": 760, "w": 180, "h": 120, "dz": 0.0271, "slab": [0, 0.5, 0.2, 0.7],
             "interactive": True},
            {"id": "b", "x": 1200, "y": 760, "w": 180, "h": 120, "dz": 0.0271}]
    res = {"test": "SG-PROF"}
    for prof in ("default", "wearer", "default"):
        await t.call("update", {"seq": 1, "profile": prof, "depthMotion": "none", "surfaces": [surface(pops)]})
        props = await t.js(PANEL_PROPS)
        res.setdefault("runs", []).append({"profile": prof, "panels": props})
    await t.call("clear")

    def ok(run):
        for p in run["panels"]:
            want = run["profile"] == "wearer" and p["name"].startswith("lgs:pop:") and p["name"].endswith(":a")
            if bool(p["interactive"]) != want or (p["appid"] == 769) != want or (p["kbd"] is True) != want:
                return False
            if p["frs"] != 1:
                return False
        return bool(run["panels"])
    res["pass"] = all(ok(r) for r in res["runs"])
    return res


async def sgorder(t, out):
    """Card item 5: back to front cover < base < slab < pop, the floors, a
    negative coverDz (K-G6 platter)."""
    pops = [{"id": "hi", "x": 200, "y": 200, "w": 400, "h": 300, "dz": 0.0271, "slab": [0, 0.5, 0.2, 0.7]},
            {"id": "lo", "x": 900, "y": 200, "w": 400, "h": 300, "dz": 0.0005, "slab": [0.3, 0.5, 0.5, 0.7]}]
    res = {"test": "SG-ORDER", "cases": []}
    for cover in (0.001, -0.027):
        await t.call("update", {"seq": 1, "reduceMotion": True,
                                "surfaces": [surface(pops, coverDz=cover)]})
        d = await t.call("dump")
        z = {}
        for it in d:
            k = it["kind"] + (":" + it["k"].split(":")[-1] if it["kind"] in ("pop", "slab") else "")
            z.setdefault(k, set()).add(it["z"])
        z = {k: sorted(v) for k, v in z.items()}
        exp = {"cover": [cover], "base": [0.002], "pop:hi": [0.0271], "slab:hi": [round(max(0.0271 - 0.0008, cover + 0.0003), 6)],
               "pop:lo": [0.002], "slab:lo": [round(max(0.002 - 0.0008, cover + 0.0003), 6)]}
        res["cases"].append({"coverDz": cover, "z": z, "expected": exp, "ok": z == exp})
    await t.call("clear")
    res["pass"] = all(c["ok"] for c in res["cases"])
    return res


TARGETS = ["window", "window-scale", "frame-left", "frame-controls", "grab-handle", "resize-corner", "tooltips"]
T1_ATTR = """(()=>{let want=null;for(const f of FrameStore.frames)for(const p of f.pages||[])
if(p.m_sSummonOverlayKey==='valve.steam.gamepadui.main')want=p.mountableID;
for(const m of document.querySelectorAll('vsg-node[vsg-type=mountedscenegraph]')){let id='';
try{id=String(m.buildNode({},m)[1].properties.mountable_id||'')}catch(e){continue}
if(want&&id.endsWith('::'+want)){const t=m.parentElement,s=t.parentElement;let sb=null;try{sb=s.buildNode({},s)[1].type}catch(e){}
return JSON.stringify({t:t.getAttribute('translation'),r:t.getAttribute('rotation'),scaleNode:sb,
scaleOwn:Object.prototype.hasOwnProperty.call(s,'buildNode'),tOwn:Object.prototype.hasOwnProperty.call(t,'buildNode')})}}return 'null'})()"""
FL_ATTR = """JSON.stringify([...document.querySelectorAll('vsg-transform[parent-id$="gamepadui.main_CenterLeft"]')]
.filter(e=>e.querySelector('[id^="PooledPopup-valve.steam.gamepadui.frame.menu"]')).map(e=>e.getAttribute('translation')))"""


async def sgtargets(t, out):
    """Card item 2: every built-in target found on the live page; a no-op rule
    leaves the values unchanged; the tab-bar rule composes with React's z."""
    res = {"test": "SG-TARGETS"}
    rules = [{"id": "t-" + n, "target": n, "add": [0, 0, 0]} for n in TARGETS]
    r = await t.call("overrides", {"seq": 1, "rules": rules})
    res["noop"] = {"applied": {a["id"][2:]: a["n"] for a in r["applied"]}, "missing": [m[2:] for m in r["missing"]],
                   "errors": r["errors"]}
    await t.call("overrides", {"seq": 2, "rules": []})
    await t.keep(0.3)
    # tab-bar depth (theme/sg/00-base.json): +21.3 mm on frame-left
    base = json.load(open(os.path.join(GS, "theme", "sg", "00-base.json"), encoding="utf-8"))
    tab = next(x for x in base["rules"] if x["id"] == "tabbar-depth")
    before = await t.js(FL_ATTR)
    g = await t.call("geom")
    r2 = await t.call("overrides", {"seq": 3, "rules": [tab]})
    await t.keep(0.4)
    during = await t.js(FL_ATTR)
    await t.call("overrides", {"seq": 4, "rules": []})
    await t.keep(0.4)
    after = await t.js(FL_ATTR)
    exp = None
    if before:
        z0 = [float(v) for v in before[0].split()]
        exp = [z0[0], z0[1], round(z0[2] + 21.3 * g["unitsPerMm"], 6)]
    got = [float(v) for v in during[0].split()] if during else None
    res["tabbar"] = {"before": before, "during": during, "after": after, "expected": exp, "applied": r2["applied"],
                     "missing": r2["missing"], "totalMm": round(float(during[0].split()[2]) / g["unitsPerMm"], 2) if during else None}
    tab_ok = bool(got and exp) and all(abs(a - b) < 1e-5 for a, b in zip(got, exp)) and after == before
    must = ["window", "window-scale", "frame-left", "frame-controls", "grab-handle", "resize-corner"]
    res["pass"] = all(res["noop"]["applied"].get(n, 0) >= 1 for n in must) and tab_ok
    return res


async def sgwin(t, out):
    """Section 5: window dim on the identity transform above t1, recede composed
    with React's t1 translation, both animated, both restored."""
    res = {"test": "SG-WIN"}
    before = await t.js(T1_ATTR)
    await t.call("timeline", True)
    w1 = await t.call("windowState", {"dim": 0.5, "recede": 0.05})
    await t.keep(1.2)
    during = await t.js(T1_ATTR)
    tl = await t.call("timeline", True)
    st = await t.call("status")
    w2 = await t.call("windowState", {"dim": 1, "recede": 0})
    await t.keep(1.2)
    after = await t.js(T1_ATTR)
    res.update({"before": before, "during": during, "after": after, "set": w1, "statusWindow": st["window"],
                "frames": len(tl), "first": tl[:2], "last": tl[-1:], "back": w2})
    t0 = [float(v) for v in before["t"].split()]
    td = [float(v) for v in during["t"].split()]
    res["pass"] = during["scaleNode"] == "tint" and abs(td[2] - (t0[2] - 0.05)) < 1e-6 and td[:2] == t0[:2] and \
        after == before and not after["scaleOwn"] and len(tl) > 10 and tl[-1]["z"].get("win:dim") == 0.5 and \
        st["window"]["error"] is None
    return res


async def sgyaw(t, out):
    """P10's hook: test.yaw(deg) turns t1 about its vertical axis; yaw(0) and the TTL restore."""
    res = {"test": "SG-YAW"}
    before = await t.js(T1_ATTR)
    r = await t.js(f"JSON.stringify({G}.test.yaw(20, 2000))")
    during = await t.js(T1_ATTR)
    r0 = await t.js(f"JSON.stringify({G}.test.yaw(0))")
    await asyncio.sleep(0.3)
    after0 = await t.js(T1_ATTR)
    await t.js(f"JSON.stringify({G}.test.yaw(-15, 1500))")
    t0 = time.time()
    ttl = None
    while time.time() - t0 < 4:
        await t.js(f"{G}.ping(), 0")
        if await t.js(T1_ATTR) == before:
            ttl = round(time.time() - t0, 2)
            break
        await asyncio.sleep(0.1)
    q = [float(v) for v in during["r"].split()]
    res.update({"before": before, "during": during, "afterYaw0": after0, "ttlRestoredS": ttl, "call": r, "yaw0": r0})
    res["pass"] = abs(q[0] - math.cos(math.radians(10))) < 1e-4 and abs(q[2] - math.sin(math.radians(10))) < 1e-4 and \
        after0 == before and ttl is not None and 1.3 < ttl < 2.5
    return res


FC_SET = """(v=>{const e=[...document.querySelectorAll('vsg-transform[id$=":bottom-controls-transform"]')]
.map(e=>[...e.children].find(k=>k.tagName==='VSG-TRANSFORM')).filter(Boolean)[0];e.setAttribute('translation',v);
return Promise.resolve().then(()=>e.getAttribute('translation'))})"""


async def sgreact(t, out):
    """Section 4.3: React writes a new value while an override is on (simulated by
    writing the attribute): the observer takes it as the new base and re-applies
    before any push; removing the rule leaves React's latest value."""
    res = {"test": "SG-REACT"}
    orig = (await t.js(FC_ATTR))[0]
    o = [float(v) for v in orig.split()]
    react = f"{o[0]:g} {o[1] - 0.01:g} {o[2]:g}"
    try:
        r = await t.call("overrides", {"seq": 1, "rules": [{"id": "fc-r", "target": "frame-controls", "addMm": [-40, 0, 0]}]})
        g = await t.call("geom")
        res["applied"] = (await t.js(FC_ATTR))[0]
        res["afterReactWrite"] = await t.js(f"{FC_SET}({json.dumps(react)})")
        st = await t.call("status")
        res["base"] = next((a["base"] for a in st["overrides"]["applied"] if a["id"] == "fc-r"), None)
        await t.call("overrides", {"seq": 2, "rules": []})
        res["afterRemove"] = (await t.js(FC_ATTR))[0]
    finally:
        await t.js(f"{FC_SET}({json.dumps(orig)})")       # React's real value back
        await t.call("overrides", {"seq": 3, "rules": []})  # and one push carrying it
        await t.keep(0.3)
        res["end"] = (await t.js(FC_ATTR))[0]
    dx = -40 * g["unitsPerMm"]
    got = [float(v) for v in res["afterReactWrite"].split()]
    res["expected"] = [round(o[0] + dx, 6), round(o[1] - 0.01, 6), o[2]]
    res["pass"] = all(abs(a - b) < 1e-6 for a, b in zip(got, res["expected"])) and res["base"] == react and \
        res["afterRemove"] == react and res["end"] == orig
    return res


async def sgfrag(t, out):
    """Every rule of every theme/sg/*.json fragment (flags ignored, supersedes
    honoured as the daemon does) applies on the live page and restores."""
    rules, order = {}, []
    d = os.path.join(GS, "theme", "sg")
    for name in sorted(os.listdir(d)):
        if not name.endswith(".json") or name.startswith("_"):
            continue
        frag = json.load(open(os.path.join(d, name), encoding="utf-8"))
        for rid in frag.get("supersedes") or []:
            if rid in rules:
                del rules[rid]
                order.remove(rid)
        for r in frag.get("rules") or []:
            rules[r["id"]] = r
            order.append(r["id"])
    active = [rules[i] for i in order]
    snap = "JSON.stringify([...document.querySelectorAll('vsg-transform')].filter(e=>!e.closest('[id^=lgs-sg-root]')).map(e=>e.getAttribute('translation')+'|'+e.getAttribute('rotation')).join(';'))"
    before = await t.js(snap)
    r = await t.call("overrides", {"seq": 1, "rules": active})
    await t.keep(0.5)
    await t.call("overrides", {"seq": 2, "rules": []})
    await t.keep(0.5)
    after = await t.js(snap)
    res = {"test": "SG-FRAG", "rules": order, "applied": {a["id"]: [a["n"], a["base"], a["now"]] for a in r["applied"]},
           "missing": r["missing"], "errors": r["errors"], "restored": before == after}
    res["pass"] = not r["errors"] and res["restored"] and len(res["applied"]) + len(r["missing"]) == len(order) and \
        all(k in res["applied"] for k in order if k != "tips-below")
    return res


async def sgroomdim(t, out):
    """Room dim (glassd G7): a `dimSlabs` cell goes behind the window (z <= -0.05),
    centred on its rect, 3x its size, never interactive, removed with the entry.
    With --grab the cell is a tinted crop of Steam's own texture, so it can be
    seen in the headset view (the real cell is glassd's dark tone)."""
    res = {"test": "SG-ROOMDIM"}
    if out:
        await t.js(f"{G}.destroy(), 0")
        await t.install({"debugTint": {"roomdim": [0.25, 0.35, 1]}})
    glassd = {"key": MAIN, "backdrop": [0, 0, 1, 1], "scale": 1} if out else None
    dim = {"id": "rd", "x": 660, "y": 340, "w": 600, "h": 400, "dz": 0.0, "slab": [0.40, 0.40, 0.55, 0.55]}
    if out:   # the visual case: the whole window's rect, so 3x shows well around the window
        dim.update(x=0, y=0, w=1920, h=1080, slab=[0, 0, 1, 1])   # the cell must span the rect (as glassd's does)
    s1 = surface([], dimSlabs=[dim])
    if glassd:
        s1["glassd"] = glassd
    r = await t.call("update", {"seq": 1, "surfaces": [s1]})
    await t.keep(0.5)
    d = [x for x in await t.call("dump") if x["kind"] == "roomdim"]
    props = [p for p in await t.js(PANEL_PROPS) if p["name"].startswith("lgs:roomdim:")]
    shot = grab(out, "roomdim_on") if out else None
    s2 = surface([])
    if glassd:
        s2["glassd"] = glassd
    await t.call("update", {"seq": 2, "surfaces": [s2]})
    await t.keep(0.5)
    left = [x for x in await t.call("dump") if x["kind"] == "roomdim"]
    sg = (await t.call("status"))["sgids"]
    await t.call("clear")
    cover = None
    it = d[0] if d else {}
    res.update({"counts": r.get("counts"), "roomdim": it, "props": props, "leftAfterRemove": len(left), "sgids": sg, "shot": shot})
    scale = 1 if glassd else 0.75
    res["pass"] = len(d) == 1 and it["z"] <= -0.05 and abs(it["mpp"] - 1.5 / 1080 / scale * 3) < 1e-9 and \
        it["px"] == ([5760, 3240] if out else [1800, 1200]) and abs(it["anchor"][0] - 0.5) < 1e-6 and abs(it["anchor"][1] - 0.5) < 1e-6 and \
        props and all(p["interactive"] is False for p in props) and not left and sg["live"] == sg["dom"]
    return res


async def sgsink(t, out):
    """Section 3.3 / 3.4: `from` (units and "cut"), per-pop `motion`, sinking on
    `fade` with the slabsOut cell, `sink: false`, a slot id that moves (the old
    element sinks as id~n while the new one rises)."""
    res = {"test": "SG-SINK"}
    slab = [0, 0.5, 0.2, 0.7]
    a = {"id": "a", "x": 200, "y": 200, "w": 300, "h": 300, "dz": 0.0271, "slab": slab, "from": "cut"}
    b = {"id": "b", "x": 700, "y": 200, "w": 300, "h": 300, "dz": 0.0407, "from": 0.0271, "motion": "snappy"}
    c = {"id": "c", "x": 1200, "y": 200, "w": 300, "h": 300, "dz": 0.0271, "sink": False}
    await t.call("timeline", True)
    await t.call("update", {"seq": 1, "surfaces": [surface([a, b, c])]})
    d0 = {x["k"].split("#")[1]: x["z"] for x in await t.call("dump")}
    rt = await t.js(f"JSON.stringify({G}._retargets())")
    await t.keep(1.0)
    k = MAIN + "#"
    res["start"] = {"a": d0.get("pop:a"), "b": d0.get("pop:b"), "c": d0.get("pop:c")}
    res["tokens"] = {r["key"].split("#")[1]: [r["token"], r["x0"]] for r in rt if r["key"].startswith(k)}
    # a leaves (sinks on fade, slab from slabsOut); c leaves with sink:false (at once)
    out_cell = [0.5, 0.5, 0.7, 0.7]
    await t.call("timeline", True)
    s2 = surface([b], slabsOut=[{"id": "a", "x": 200, "y": 200, "w": 300, "h": 300, "dz": 0.0271, "slab": out_cell}])
    await t.call("update", {"seq": 2, "surfaces": [s2]})
    d1 = await t.call("dump")
    res["rightAfterLeave"] = sorted(x["k"].split("#")[1] for x in d1 if x["kind"] in ("pop", "slab"))
    res["sinkSlabUv"] = next((x["uv"] for x in d1 if x["k"].endswith("#slab:a")), None)
    await t.keep(1.0)
    tl = await t.call("timeline", True)
    za = [e["z"].get(k + "a") for e in tl if k + "a" in e["z"]]
    d2 = await t.call("dump")
    res["sinkA"] = {"frames": len(za), "first": za[:2], "last": za[-1:], "after": sorted(x["k"].split("#")[1] for x in d2 if x["kind"] in ("pop", "slab"))}
    # b's slot moves to another element: the old one sinks as b~n, the new one rises
    b2 = dict(b, x=1300, y=600, **{"from": 0})
    await t.call("timeline", True)
    await t.call("update", {"seq": 3, "surfaces": [surface([b2])]})
    await t.keep(1.0)
    tl = await t.call("timeline", True)
    keys = sorted({kk.split("#")[1] for e in tl for kk in e["z"]})
    ghost = next((kk for kk in keys if kk.startswith("b~")), None)
    zg = [e["z"][k + ghost] for e in tl if ghost and k + ghost in e["z"]]
    zb = [e["z"][k + "b"] for e in tl if k + "b" in e["z"]]
    d3 = await t.call("dump")
    res["move"] = {"keys": keys, "ghostFirstLast": [zg[:1], zg[-1:]], "newFirstLast": [zb[:1], zb[-1:]],
                   "after": sorted(x["k"].split("#")[1] for x in d3 if x["kind"] in ("pop", "slab"))}
    sg = (await t.call("status"))["sgids"]
    await t.call("clear")
    res["sgids"] = sg
    res["pass"] = res["start"]["a"] == 0.0271 and 0.0271 <= res["start"]["b"] < 0.03 and 0.002 <= res["start"]["c"] < 0.006 and \
        res["tokens"].get("b", [None])[0] == "snappy" and "a" not in res["tokens"] and \
        "pop:c" not in res["rightAfterLeave"] and "pop:a" in res["rightAfterLeave"] and \
        res["sinkSlabUv"] is not None and abs(res["sinkSlabUv"][0] - 0.5) < 1e-6 and \
        za and za[0] < 0.0271 and za[-1] == 0.002 and "pop:a" not in res["sinkA"]["after"] and \
        ghost is not None and zg and zg[-1] == 0.002 and zb and zb[0] < 0.01 and zb[-1] == 0.0407 and \
        res["move"]["after"] == ["pop:b"] and sg["live"] == sg["dom"]
    return res


SURF = "JSON.stringify((()=>{const s=" + G + ".status();return {items:s.items,expired:s.expired,ov:s.overrides.elements," \
    "coverAt:(s.surf['" + MAIN + "']||{}).coverAt||0,lastContactMsAgo:s.lastContactMsAgo}})())"


async def sg6(t, out):
    """Watchdog (NAT freeze regression, in-page part): a 12 s watchdog removes
    every node and restores every override 12 s after the last heartbeat; the
    first heartbeat after it rebuilds within 1 s (the daemon's SIGSTOP / SIGCONT
    seen from the page)."""
    await t.js(f"{G}.destroy(), 0")
    await t.install({"watchdogMs": 12000})
    pops = [{"id": "w", "x": 300, "y": 200, "w": 600, "h": 400, "dz": 0.0271}]
    await t.call("update", {"seq": 1, "depthMotion": "none", "surfaces": [surface(pops)]})
    await t.call("overrides", {"seq": 1, "rules": [{"id": "fc-w", "target": "frame-controls", "addMm": [-40, 0, 0]}]})
    fc_moved = await t.js(FC_ATTR)
    await t.keep(1.0)
    last = time.time()                       # the last heartbeat ("SIGSTOP")
    off_at, samples = None, []
    while time.time() - last < 15:
        s = await t.js(SURF)
        samples.append((round(time.time() - last, 2), s["items"], s["ov"]))
        if off_at is None and s["items"] == 0 and s["ov"] == 0:
            off_at = round(time.time() - last, 2)
            fc_off = await t.js(FC_ATTR)
        await asyncio.sleep(0.25)
    cont = time.time()                       # "SIGCONT": the daemon's next ping
    beat = await t.call("ping")
    back_at = None
    while time.time() - cont < 3:
        s = await t.js(SURF)
        if s["items"] > 0 and s["coverAt"] and s["ov"] > 0:
            back_at = round(time.time() - cont, 2)
            break
        await asyncio.sleep(0.05)
    fc_back = await t.js(FC_ATTR)
    await t.call("clear")
    fc_end = await t.js(FC_ATTR)
    res = {"test": "SG-6", "offAtS": off_at, "backAfterS": back_at, "rebuilt": beat.get("rebuilt"),
           "fc": {"moved": fc_moved, "atExpiry": fc_off if off_at else None, "back": fc_back, "end": fc_end},
           "samples": samples[::8]}
    res["pass"] = off_at is not None and 11.9 <= off_at <= 12.9 and back_at is not None and back_at <= 1.0 and \
        bool(beat.get("rebuilt")) and fc_off == fc_end and fc_back == fc_moved
    return res


# ---------------------------------------------------------------- R1 review tests

# Steam's popups: texture size per overlay key (the reporter's texW / texH)
STEAM_SIZES = ("JSON.stringify([...g_PopupManager.m_mapPopups.values()].map(p=>{let k='';try{k=(p.params&&p.params.strVROverlayKey)||''}"
               "catch(e){};let s=null;try{s=[Math.round(p.window.innerWidth*p.window.devicePixelRatio),"
               "Math.round(p.window.innerHeight*p.window.devicePixelRatio)]}catch(e){};return [k,s]}))")
PP_PANELS = ("JSON.stringify([...document.querySelectorAll('[id^=PooledPopup]')].map(el=>{try{const p=el.buildNode({},el)[1].properties;"
             "return {key:p.key,uv:[p.uv_min[0],p.uv_min[1],p.uv_max[0],p.uv_max[1]].map(Number),origin:p.origin}}catch(e){return null}})"
             ".filter(Boolean))")
# the surfaces lgs_sg.js builds on popup parents (theme/layers.json)
POPUP_RE = r"^valve\.steam\.gamepadui\.(bar|barpopup\.\d+|frame\.menu\.\d+|floatingfooter)$"
# rewrite the cover's anchor as the old (pre-R1) code computed it: relative to
# the displayed range, so the displayed centre is (0.5, 0.5) (the control case)
OLD_ANCHOR = ("(()=>{const r=document.getElementById('lgs-sg-root-__LGS_SG_TEST');const a=r&&r.querySelector("
              "'vsg-node[vsg-type=panel-anchor]');if(!a)return 'none';a.__lgsProps={'anchor-u':0.5,'anchor-v':0.5};"
              "__LGS_SG_TEST.test.yaw(0);return 'set'})()")
# docs/inventory/bar.md 0.3 OPEN: close every bar popup, click "+", fake mouseenter
# so the 2 s auto-close never fires; CLOSE closes them again
PLUS_OPEN = ("(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));for(const p of SteamUIStore.WindowStore."
             "VRGamepadUIMainWindowInstance.VRDashboardBarPopups)p.closePopup();await W(400);const el=L.q('bar','%{AddWindowButton}');"
             "L.click('bar','%{AddWindowButton}');el.dispatchEvent(new(L.surface('bar').MouseEvent)('mouseenter'));await W(1200);return 1})()")
PLUS_CLOSE = ("(async()=>{for(const p of SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.VRDashboardBarPopups)p.closePopup();"
              "try{L.unhover&&L.unhover()}catch(e){};await new Promise(r=>setTimeout(r,500));return 1})()")
COVER_TINT = [1, 0, 1]      # magenta: rare in the room and in Steam's chrome


async def steam(expr):
    """Steam's SharedJSContext (lab.lab_js runs its own event loop: a worker thread)."""
    import lab  # noqa: E402 (lab/ is on the path in main)
    r = await asyncio.get_running_loop().run_in_executor(None, lab.lab_js, expr)
    return json.loads(r) if isinstance(r, str) and r[:1] in "{[" else r


async def sgpopup(t, out):
    """R1 B1: a copy of a popup parent's own displayed texture, anchored by
    lgs_sg.js, must sit exactly on Steam's panel. Per popup parent present (the
    bar, the frame menu, a bar popup opened with "+", the floating footer when
    shown): the cover's anchor is the displayed centre in texture uv, within
    one texture px (dump). With --grab a magenta-tinted copy of the parent's
    displayed texture 2 mm in front of Steam's panel gives frame A (it renders;
    the look strip), the same copy 2 mm behind it frame B, and for an
    asymmetric displayed range the copy behind with the old anchor
    (displayed-range centre) frame C (the control). On the spot, Steam's opaque
    glyphs hide the copy's glyphs in B; misplaced, they show. The measure is
    inside each frame (the head pose may move between frames).
    native/spike/sg_popup.py (PC) measures and deletes the frames on both
    machines. Needs --lablock (route, theme and the opened popup stay ours)."""
    import re
    res = {"test": "SG-POPUP", "parents": []}
    if out:
        await t.js(f"{G}.destroy(), 0")
        await t.install({"debugTint": {"cover": COVER_TINT}})
    sizes = {k: s for k, s in (await steam(STEAM_SIZES)) if k and s}

    async def run_parents(phase):
        panels = [p for p in await t.js(PP_PANELS) if re.match(POPUP_RE, p["key"] or "")]
        for p in panels:
            key = p["key"]
            if key in [x["key"] for x in res["parents"]]:
                continue
            sz = sizes.get(key)
            row = {"key": key, "phase": phase, "origin": p["origin"], "tex": sz}
            res["parents"].append(row)
            if not sz:
                row["blocked"] = "no Steam popup with this overlay key (texture size unknown)"
                continue
            spec = {"seq": 1, "depthMotion": "none", "surfaces": [{
                "steamKey": key, "texW": sz[0], "texH": sz[1], "visible": True,
                "glassd": {"key": key, "backdrop": [0, 0, 1, 1], "scale": 1},
                # just in front of Steam's panel, as the real base is (a copy 11 mm in
                # front shows a few px of parallax below or beside the eye line)
                "coverDz": 0.002, "baseDz": 0.003, "popped": [], "mosaic": []}]}
            r = await t.call("update", spec)
            await t.keep(0.6)
            st = await t.call("status")
            info = (st.get("parents") or {}).get(key) or {}
            uv = info.get("uv") or p["uv"]
            d = [x for x in await t.call("dump") if x["kind"] == "cover"]
            row.update({"uv": uv, "parent": info, "counts": r.get("counts"),
                        "anchor": d[0]["anchor"] if d else None, "px": d[0]["px"] if d else None,
                        "sizeM": d[0]["sizeM"] if d else None})
            # the displayed centre in texture uv (R1 B1), within one texture px
            # (the displayed region is rounded to whole px)
            row["expect"] = [round((uv[0] + uv[2]) / 2, 6), round((uv[1] + uv[3]) / 2, 6)]
            row["curv"] = d[0].get("curv") if d else None
            row["anchorOk"] = bool(d) and abs(d[0]["anchor"][0] - row["expect"][0]) <= 1 / sz[0] and \
                abs(d[0]["anchor"][1] - row["expect"][1]) <= 1 / sz[1]
            row["asymmetric"] = any(abs(e - 0.5) > 0.01 for e in row["expect"])
            if out and d:
                n = len(res["parents"])
                # A: the copy 2 mm in front (it renders, and where: the look strip)
                row["A"] = grab(out, f"pop_{phase}_{n}_A")
                # B: the same copy 2 mm BEHIND Steam's panel. On the spot, Steam's
                # opaque glyphs hide the copy's glyphs exactly; misplaced, the
                # copy's magenta glyphs show beside them or through the glass.
                # Pixels of neighbouring panels are white, never magenta, so they
                # cannot be mistaken for it (unlike any comparison with Steam's glyphs)
                spec["surfaces"][0]["coverDz"] = -0.002
                await t.call("update", dict(spec, seq=3))
                await t.keep(0.6)
                row["B"] = grab(out, f"pop_{phase}_{n}_B")
                if row["asymmetric"]:
                    # control: the old (pre-R1) anchor, copy behind: must leak
                    row["control"] = await t.js(OLD_ANCHOR)
                    await t.keep(0.6)
                    row["C"] = grab(out, f"pop_{phase}_{n}_C")
            await t.call("update", {"seq": 2, "surfaces": []})
            await t.keep(0.5)

    await run_parents("p0")
    # a bar popup with an asymmetric displayed range: "+" (Add Window), opened
    # as docs/inventory/bar.md 0.3 does and closed again (the lab lock would too)
    try:
        res["plus"] = await steam(PLUS_OPEN)
        await t.keep(0.8)
        await run_parents("p1")
    finally:
        res["closed"] = await steam(PLUS_CLOSE)
    sg = (await t.call("status"))["sgids"]
    await t.call("clear")
    res["sgids"] = sg
    built = [p for p in res["parents"] if not p.get("blocked")]
    res["pass"] = bool(built) and all(p.get("anchorOk") for p in built) and \
        any(p.get("asymmetric") for p in built) and sg["live"] == sg["dom"]
    return res


async def sgwin2(t, out):
    """R1 M1: an update() without `window` (or window: null) is the window at
    rest: a dim / recede from an earlier spec animates back and the tint goes;
    an unchanged window state pushes nothing."""
    res = {"test": "SG-WIN2"}
    before = await t.js(T1_ATTR)
    await t.call("update", {"seq": 1, "surfaces": [], "window": {"dim": 0.5}})
    await t.keep(1.0)
    dimmed = await t.js(T1_ATTR)
    w1 = (await t.call("status"))["window"]
    p0 = (await t.call("status"))["pushes"]
    await t.call("update", {"seq": 2, "surfaces": [], "window": {"dim": 0.5}})   # same state: no push
    await t.keep(0.6)
    p1 = (await t.call("status"))["pushes"]
    await t.call("update", {"seq": 3, "surfaces": []})                          # no `window`
    await t.keep(1.2)
    absent = await t.js(T1_ATTR)
    w2 = (await t.call("status"))["window"]
    await t.call("update", {"seq": 4, "surfaces": [], "window": {"dim": 0.6, "recede": 0.05}})
    await t.keep(1.2)
    again = await t.js(T1_ATTR)
    await t.call("update", {"seq": 5, "surfaces": [], "window": None})          # window: null
    await t.keep(1.2)
    null = await t.js(T1_ATTR)
    w3 = (await t.call("status"))["window"]
    # reduce motion: the jump back to rest restores in one push
    await t.call("update", {"seq": 6, "reduceMotion": True, "surfaces": [], "window": {"dim": 0.5}})
    await t.keep(0.4)
    rm_on = await t.js(T1_ATTR)
    await t.call("update", {"seq": 7, "reduceMotion": True, "surfaces": []})
    await t.keep(0.4)
    rm_off = await t.js(T1_ATTR)
    res.update({"before": before, "dimmed": dimmed, "w1": w1, "pushesSameState": p1 - p0, "absent": absent, "w2": w2,
                "again": again, "null": null, "w3": w3, "reduceOn": rm_on, "reduceOff": rm_off})
    rest = lambda a: a == before and not a["scaleOwn"]  # noqa: E731
    res["pass"] = dimmed["scaleNode"] == "tint" and w1["dimTarget"] == 0.5 and p1 - p0 == 0 and rest(absent) and \
        w2["dimTarget"] == 1 and w2["recedeTarget"] == 0 and again["scaleNode"] == "tint" and again["t"] != before["t"] and \
        rest(null) and w3["dimTarget"] == 1 and rm_on["scaleNode"] == "tint" and rest(rm_off)
    return res


async def sgfailclosed(t, out):
    """R1 m2: without the scheduler's retire export (simulated: opts.noRetire)
    no node is built (fail closed, SP 9.1), status says why, and overrides of
    SteamVR's own nodes still work."""
    await t.js(f"{G}.destroy(), 0")
    await t.install({"noRetire": True})
    pops = [{"id": "f", "x": 300, "y": 200, "w": 600, "h": 400, "dz": 0.0271, "slab": [0, 0.5, 0.2, 0.7]}]
    r = await t.call("update", {"seq": 1, "depthMotion": "none", "surfaces": [surface(pops)]})
    await t.keep(0.5)
    st = await t.call("status")
    fc0 = await t.js(FC_ATTR)
    o = await t.call("overrides", {"seq": 1, "rules": [{"id": "fc-f", "target": "frame-controls", "addMm": [-40, 0, 0]}]})
    await t.keep(0.4)
    fc1 = await t.js(FC_ATTR)
    await t.call("clear")
    fc2 = await t.js(FC_ATTR)
    res = {"test": "SG-FAILCLOSED", "update": r, "scheduler": st["scheduler"], "items": st["items"], "sgids": st["sgids"],
           "root": st["nodes"], "fc": [fc0, fc1, fc2], "ov": o.get("applied")}
    res["pass"] = st["items"] == 0 and st["sgids"]["created"] == 0 and st["scheduler"]["retire"] is False and \
        "fail closed" in (st["scheduler"]["error"] or "") and "not built" in (r.get("error") or "") and \
        fc1 != fc0 and fc2 == fc0
    return res


async def sgrevive(t, out):
    """R1 m4: after a watchdog expiry, whichever call comes first (overrides,
    windowState, test.yaw, not only ping) brings the nodes back."""
    res = {"test": "SG-REVIVE", "cases": []}
    pops = [{"id": "r", "x": 300, "y": 200, "w": 600, "h": 400, "dz": 0.0271}]
    for name, call in (("overrides", f"JSON.stringify({G}.overrides({{seq: 9, rules: []}}))"),
                       ("windowState", f"JSON.stringify({G}.windowState({{dim: 1}}))"),
                       ("yaw", f"JSON.stringify({G}.test.yaw(0))"),
                       ("ping", f"JSON.stringify({G}.ping())")):
        await t.call("update", {"seq": 1, "depthMotion": "none", "surfaces": [surface(pops)]})
        await asyncio.sleep(WATCHDOG_MS / 1000 + 1.2)        # no heartbeat: expiry
        s0 = await t.js(SURF)
        await t.js(call)
        await asyncio.sleep(0.3)
        s1 = await t.js(SURF)
        res["cases"].append({"first": name, "atExpiry": s0["items"], "expired": s0["expired"], "after": s1["items"],
                             "coverPushed": bool(s1["coverAt"]), "ok": s0["items"] == 0 and s0["expired"] and s1["items"] > 0 and bool(s1["coverAt"])})
    await t.call("clear")
    res["pass"] = all(c["ok"] for c in res["cases"])
    return res


CHUNK_COUNT = ("JSON.stringify({n:webpackChunkvrwebui.length,ours:webpackChunkvrwebui.filter(e=>{try{return Array.isArray(e)&&"
               "Array.isArray(e[0])&&typeof e[0][0]==='symbol'&&e[0][0].description==='lgs-sg'}catch(_){return false}}).length})")


async def sgchunk(t, out):
    """R1 m3: an install leaves no entry in webpackChunkvrwebui (and removes the
    ones older installs left)."""
    before = await t.js(CHUNK_COUNT)
    for _ in range(3):
        await t.js(f"{G}.destroy(), 0")
        await t.install()
    after = await t.js(CHUNK_COUNT)
    st = await t.call("status")
    res = {"test": "SG-CHUNK", "before": before, "after": after, "scheduler": st["scheduler"]}
    res["pass"] = after["ours"] == 0 and after["n"] <= before["n"] and st["scheduler"]["push"] and st["scheduler"]["retire"]
    return res


async def sgtick(t, out):
    """R1 m6: the cost of the 500 ms housekeeping tick at idle with a native-like
    spec (main + every popup parent present), and no pushes at rest."""
    import re
    sizes = {k: s for k, s in (await steam(STEAM_SIZES)) if k and s}
    surfs = [surface([{"id": "p", "x": 300, "y": 200, "w": 300, "h": 450, "dz": 0.0407}])]
    for p in await t.js(PP_PANELS):
        if re.match(POPUP_RE, p["key"] or "") and sizes.get(p["key"]):
            surfs.append({"steamKey": p["key"], "texW": sizes[p["key"]][0], "texH": sizes[p["key"]][1], "visible": True,
                          "glassd": {"key": "glassd.none", "backdrop": [0, 0, 1, 1], "scale": 0.75},
                          "coverDz": 0.001, "baseDz": 0.002, "popped": []})
    await t.call("update", {"seq": 1, "depthMotion": "none", "surfaces": surfs})
    await t.keep(1.5)
    s0 = await t.call("status")
    await t.keep(6.0, every=1.0)
    s1 = await t.call("status")
    await t.call("clear")
    res = {"test": "SG-TICK", "surfaces": len(surfs), "items": s1["items"], "tick": s1["tick"],
           "pushesAtRest": s1["pushes"] - s0["pushes"], "ticks": s1["tick"]["n"] - s0["tick"]["n"]}
    res["pass"] = res["pushesAtRest"] == 0 and res["ticks"] >= 10 and s1["tick"]["avgMs"] < 2.0
    return res


async def main():
    src_path, test = sys.argv[1], sys.argv[2]
    out = sys.argv[sys.argv.index("--grab") + 1] if "--grab" in sys.argv else None
    if out:
        os.makedirs(out, exist_ok=True)
    src = open(src_path, encoding="utf-8").read().strip().rstrip(";")
    # --motion: P5's motion.js prepended in the same scope, as the daemon does
    # (contracts/daemon.md section 9)
    motion = None
    if "--motion" in sys.argv:
        with open(os.path.join(GS, "device", "shared", "motion.js"), encoding="utf-8") as f:
            motion = f.read()
    tg = next(x for x in lgs_vr.targets() if x["title"] == "systemui")
    async with lgs.Session(tg["webSocketDebuggerUrl"]) as s:
        t = T(s)

        async def install(extra=None):
            opts = {"version": "p7test", "global": "__LGS_SG_TEST", "watchdogMs": WATCHDOG_MS, "force": True}
            opts.update(extra or {})
            if motion:
                opts["motion"] = True
                had = await t.js("typeof globalThis.__LGS_MOTION")
                r = await t.js(f"(() => {{\n{motion}\n;return ({src})({json.dumps(opts)});\n}})()", 20)
                if had == "undefined":   # leave no global behind (G-REMOVE)
                    await t.js("(globalThis.__LGS_MOTION && globalThis.__LGS_MOTION.remove(), 0)")
                return r
            return await t.js(f"({src})({json.dumps(opts)})", 20)
        t.install = install
        tests = {"sg1": sg1, "sg2": sg2, "sg3": sg3, "sg4": sg4, "sg6": sg6, "prof": sgprof, "order": sgorder,
                 "targets": sgtargets, "win": sgwin, "yaw": sgyaw, "sink": sgsink, "react": sgreact, "frag": sgfrag, "roomdim": sgroomdim,
                 "win2": sgwin2, "failclosed": sgfailclosed, "revive": sgrevive, "chunk": sgchunk,
                 "popup": sgpopup, "tick": sgtick}
        # "all": everything but sg6 (12 s watchdog) and the tests that need Steam's
        # SharedJSContext under the lab lock (popup, tick: run them with --lablock)
        names = [n for n in tests if n not in ("sg6", "popup", "tick")] if test == "all" else test.split(",")
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


if "--lablock" in sys.argv:
    # lab.lock + lab-vr.lock (no route, theme or popup change by others meanwhile;
    # the lock's exit closes what the step opened). Do not also hold lab-vr.lock
    # from the shell (flock): that would wait on ourselves.
    sys.path.insert(0, os.path.join(GS, "lab"))
    import lab  # noqa: E402
    _lk = lab.Lock(both=True)
    _lk.__enter__()
    try:
        asyncio.run(main())
    finally:
        _lk.__exit__(None, None, None)
else:
    sys.path.insert(0, os.path.join(GS, "lab"))
    asyncio.run(main())
