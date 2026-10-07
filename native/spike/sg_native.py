#!/usr/bin/env python3
"""P7 native-mode acceptance tests (docs/phase2/PLAN.md P7 card), run ON the Frame:

  python3 sg_native.py sg5 OUTDIR   SG-5: does a tint on Steam's window panel (t1) show over glassd's cover?
                                    Frames: base, window.dim 0.35, + main.dim 0.35 (CC-A), restored
  python3 sg_native.py sg6          SG-6: lgs-shell SIGSTOP 15 s: the scene-graph nodes go at the 12 s
                                    watchdog, and come back within 1 s of SIGCONT
  python3 sg_native.py daemon       CSS only (no native session): the daemon's own lgs_sg.js install with
                                    the flag tabBarDepth (this step only), SIGSTOP 15 s (the watchdog
                                    restores the chrome), SIGCONT (re-applied), flag off (removed)

Native mode only through P10's native-session: this script calls
lab_p2cmd.native_session() with its step runner pointed at the test, so the
native lock, the start (lgs_shell.start(native='on', stay=True)) and the return
to CSS only (lgs on --css, checked) are P10's own code.

- SG-5 frames show the room: the caller fetches them, looks, and deletes them at
  once on both machines (LAB never-list). The daemon's own __LGS_SG instance is
  used; everything it is given is restored before the step ends.
- SG-6 holds lab.lock and lab-vr.lock while the daemon is stopped (other agents'
  steps wait rather than meet a frozen daemon) and always sends SIGCONT.
Prints one JSON line per test (prefix "@@p7 ").
"""
import asyncio
import json
import os
import signal
import subprocess
import sys
import time

GS = os.path.expanduser("~/.local/share/glass-shell")
sys.path.insert(0, os.path.join(GS, "device"))
sys.path.insert(0, os.path.join(GS, "lab"))
import lgs  # noqa: E402
import lgs_vr  # noqa: E402
import lab  # noqa: E402
import lab_p2cmd  # noqa: E402

MAIN = "valve.steam.gamepadui.main"
G = "window.__LGS_SG"
STATUS = ("JSON.stringify((()=>{if(!window.__LGS_SG)return null;const s=__LGS_SG.status();"
          "const m=(s.surf||{})['" + MAIN + "']||{};return {items:s.items,expired:s.expired,coverAt:m.coverAt||0,"
          "cover:m.cover||0,base:m.base||0,pop:m.pop||0,lastContactMsAgo:s.lastContactMsAgo,window:s.window,"
          "expiries:s.expiries,rebuilds:s.rebuilds,steamPage:s.steamPage,motion:s.motion,version:s.version}})())")


def daemon_pid():
    r = subprocess.run(["systemctl", "--user", "show", "-p", "MainPID", "lgs-shell"], capture_output=True, text=True,
                       env=lgs_vr.user_env(), timeout=10)
    try:
        return int(r.stdout.strip().split("=", 1)[1])
    except (IndexError, ValueError):
        return 0


def grab(out, tag):
    path = os.path.join(out, f"p7n_{tag}.png")
    try:
        subprocess.run(["env", "-u", "LD_PRELOAD", lab_p2cmd.HVGRAB, path, "2"], capture_output=True, timeout=6)
    except subprocess.TimeoutExpired:
        return None
    return path if os.path.exists(path) else None


class Sys:
    def __init__(self, s):
        self.s = s

    async def js(self, expr, timeout=10):
        r = await self.s.eval(expr, timeout)
        return json.loads(r) if isinstance(r, str) and r[:1] in "{[" else r

    async def ready(self, secs=25):
        """The daemon's instance has built and pushed main's cover."""
        t0 = time.time()
        st = None
        while time.time() - t0 < secs:
            st = await self.js(STATUS)
            if st and st.get("items") and st.get("coverAt"):
                return st
            await asyncio.sleep(0.25)
        return st


async def sg5(out):
    os.makedirs(out, exist_ok=True)
    tg = next(x for x in lgs_vr.targets() if x["title"] == "systemui")
    res = {"test": "SG-5", "shots": []}
    async with lgs.Session(tg["webSocketDebuggerUrl"]) as s:
        q = Sys(s)
        res["ready"] = await q.ready()
        if not (res["ready"] and res["ready"].get("coverAt")):
            res["blocked"] = "the daemon's scene graph never pushed main's cover"
            return res
        spec0 = await q.js(f"JSON.stringify({G}.spec())")
        try:
            res["shots"].append(grab(out, "0_base"))
            res["setWindow"] = await q.js(f"JSON.stringify({G}.windowState({{dim: 0.35}}))")
            await asyncio.sleep(1.3)
            res["afterWindow"] = await q.js(STATUS)
            res["shots"].append(grab(out, "1_t1dim"))
            # CC-A in native mode: also the cover and base wrappers of main
            if isinstance(spec0, dict) and spec0.get("surfaces"):
                spec1 = dict(spec0, surfaces=[dict(x, dim=0.35) if x.get("steamKey") == MAIN else x
                                              for x in spec0["surfaces"]])
                res["setMainDim"] = await q.js(f"JSON.stringify({G}.update({json.dumps(spec1)}).counts||null)")
                await asyncio.sleep(1.3)
                dump = await q.js(f"JSON.stringify({G}.dump().map(d=>[d.kind,d.dimmed]))")
                res["mainDimWrapped"] = {k: sum(1 for d in dump if d[0] == k and d[1]) for k in ("cover", "base", "pop", "slab")}
                res["mainDimPanels"] = {k: sum(1 for d in dump if d[0] == k) for k in ("cover", "base", "pop", "slab")}
                res["shots"].append(grab(out, "2_t1dim_maindim"))
        finally:
            if isinstance(spec0, dict):
                await q.js(f"{G} && {G}.update({json.dumps(spec0)}), 0")
            await q.js(f"{G} && {G}.windowState({{dim: 1, recede: 0}}), 0")
            await asyncio.sleep(1.3)
            res["restored"] = await q.js(STATUS)
            res["shots"].append(grab(out, "3_restored"))
    return res


async def sg6():
    tg = next(x for x in lgs_vr.targets() if x["title"] == "systemui")
    res = {"test": "SG-6"}
    async with lgs.Session(tg["webSocketDebuggerUrl"]) as s:
        q = Sys(s)
        res["ready"] = await q.ready()
        if not (res["ready"] and res["ready"].get("coverAt")):
            res["blocked"] = "the daemon's scene graph never pushed main's cover"
            return res
        pid = daemon_pid()
        res["pid"] = pid
        if pid <= 1:
            res["blocked"] = "lgs-shell MainPID not found"
            return res
        samples = []
        off = back = None
        with lab.Lock(both=True):
            st0 = await q.js(STATUS)
            os.kill(pid, signal.SIGSTOP)
            t_stop = time.time()
            try:
                res["atStop"] = {"lastContactMsAgo": st0.get("lastContactMsAgo"), "items": st0.get("items")}
                while time.time() - t_stop < 15:
                    st = await q.js(STATUS)
                    dt = round(time.time() - t_stop, 2)
                    samples.append([dt, st.get("items"), st.get("lastContactMsAgo"), st.get("expired")])
                    if off is None and st.get("items") == 0:
                        off = {"sinceStopS": dt, "sinceContactMs": st.get("lastContactMsAgo")}
                    await asyncio.sleep(0.25)
            finally:
                os.kill(pid, signal.SIGCONT)
            t_cont = time.time()
            while time.time() - t_cont < 5:
                st = await q.js(STATUS)
                if st.get("items") and st.get("coverAt") and st["coverAt"] / 1000 >= t_cont - 0.05:
                    back = {"afterContS": round(time.time() - t_cont, 2), "coverPushedAfterContS": round(st["coverAt"] / 1000 - t_cont, 3),
                            "items": st.get("items"), "rebuilds": st.get("rebuilds"), "expiries": st.get("expiries")}
                    break
                await asyncio.sleep(0.05)
        res.update({"off": off, "back": back, "samples": samples[::6]})
        res["pass"] = bool(off) and 11.9 <= off["sinceContactMs"] / 1000 <= 12.8 and bool(back) and \
            back["coverPushedAfterContS"] <= 1.0
    return res


FL = ("JSON.stringify({sg:!!window.__LGS_SG,v:window.__LGS_SG&&__LGS_SG.version,motion:window.__LGS_SG&&__LGS_SG.status().motion,"
      "t:[...document.querySelectorAll('vsg-transform[parent-id$=\"gamepadui.main_CenterLeft\"]')]"
      ".filter(e=>e.querySelector('[id^=\"PooledPopup-valve.steam.gamepadui.frame.menu\"]')).map(e=>e.getAttribute('translation')),"
      "contact:window.__LGS_SG?__LGS_SG.status().lastContactMsAgo:null,"
      "ov:window.__LGS_SG?__LGS_SG.status().overrides.rules:null})")


async def css_daemon():
    """CSS-only mode, the daemon's own path (contracts/daemon.md section 9): with the
    flag tabBarDepth on (this step only, P10's step flags) the daemon installs
    lgs_sg.js and applies theme/sg/00-base.json's tab-bar rule; SIGSTOP of the
    daemon: the watchdog restores the chrome 12 s after the last heartbeat
    (SG-3's "restored by the TTL when the daemon is killed"); SIGCONT: re-applied;
    flag off: lgs_sg.js destroyed, the chrome as before."""
    tg = next(x for x in lgs_vr.targets() if x["title"] == "systemui")
    res = {"test": "SG-3d"}
    async with lgs.Session(tg["webSocketDebuggerUrl"]) as s:
        q = Sys(s)
        res["before"] = await q.js(FL)
        base = res["before"]["t"]
        pid = daemon_pid()
        lab.STEP["flags"].clear()
        lab.STEP["flags"]["tabBarDepth"] = True
        with lab.Lock(both=True):
            t0 = time.time()
            on = None
            while time.time() - t0 < 15:
                st = await q.js(FL)
                if st["sg"] and st["t"] != base:
                    on = {"afterS": round(time.time() - t0, 2), **st}
                    break
                await asyncio.sleep(0.2)
            res["applied"] = on
            if on and pid > 1:
                os.kill(pid, signal.SIGSTOP)
                t_stop = time.time()
                off = None
                try:
                    while time.time() - t_stop < 15:
                        st = await q.js(FL)
                        if off is None and st["t"] == base:
                            off = {"sinceStopS": round(time.time() - t_stop, 2), "sinceContactMs": st["contact"]}
                        await asyncio.sleep(0.2)
                finally:
                    os.kill(pid, signal.SIGCONT)
                t_cont = time.time()
                back = None
                while time.time() - t_cont < 5:
                    st = await q.js(FL)
                    if st["t"] == on["t"]:
                        back = {"afterContS": round(time.time() - t_cont, 2)}
                        break
                    await asyncio.sleep(0.05)
                res.update({"restoredByWatchdog": off, "reapplied": back})
        lab.STEP["flags"].clear()
        t1 = time.time()
        gone = None
        while time.time() - t1 < 12:
            st = await q.js(FL)
            if not st["sg"] and st["t"] == base:
                gone = {"afterS": round(time.time() - t1, 2)}
                break
            await asyncio.sleep(0.25)
        res["flagOff"] = gone
        res["after"] = await q.js(FL)
    o = res.get("restoredByWatchdog") or {}
    res["pass"] = bool(res.get("applied")) and bool(o) and 11.9 <= (o.get("sinceContactMs") or 0) / 1000 <= 12.8 and \
        bool(res.get("reapplied")) and res["reapplied"]["afterContS"] <= 1.5 and bool(gone) and res["after"]["t"] == base
    return res


def main():
    test = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/lgs/p7/hv"
    results = []
    if test == "daemon":     # CSS-only: no native session (the native lock is the caller's flock)
        print("@@p7 " + json.dumps(asyncio.run(css_daemon())), flush=True)
        return

    def step(argv):
        if argv and argv[0] == "p7":
            r = asyncio.run(sg5(out) if test == "sg5" else sg6())
            results.append(r)
            print("@@p7 " + json.dumps(r), flush=True)
            return 0
        return 0

    lab_p2cmd.run_step = step
    code = lab_p2cmd.native_session(["--step", "p7"])
    print(json.dumps({"nativeSession": code, "tests": len(results)}), flush=True)


if __name__ == "__main__":
    main()
