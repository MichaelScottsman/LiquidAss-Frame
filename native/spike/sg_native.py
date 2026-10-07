#!/usr/bin/env python3
"""P7 native-mode acceptance tests (docs/phase2/PLAN.md P7 card), run ON the Frame:

  python3 sg_native.py sg5 OUTDIR   SG-5: does a tint on Steam's window panel (t1) show over glassd's cover?
                                    Frames: base, window.dim 0.35, + main.dim 0.35 (CC-A), restored
  python3 sg_native.py sg6          SG-6: lgs-shell SIGSTOP 15 s: the scene-graph nodes go at the 12 s
                                    watchdog, and come back within 1 s of SIGCONT
  python3 sg_native.py rate         card item 1 with the real daemon: pushes per second at rest, while the
                                    gamepad moves over posters, and after (native session)
  python3 sg_native.py popup OUTDIR R1 B1 with the daemon (native session): frames A as built, B with the
                                    frame-menu surface removed from the daemon's spec, C restored; the
                                    anchors and curvature origins of every popup item
  python3 sg_native.py daemon      CSS only (no native session): the daemon's own lgs_sg.js install with
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
sys.dont_write_bytecode = True   # no __pycache__ left in the install (REQ P10->P7; like lab/lab.py)
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


def stop_daemon(pid, secs=15):
    """SIGSTOP the daemon for a freeze test. First a detached guard (its own
    session, so a killed script or a dropped SSH session cannot take it down)
    sends SIGCONT after secs + 5 s whatever happens to us (R1 m7); the caller
    still sends SIGCONT itself in its finally."""
    subprocess.Popen(["sh", "-c", f"sleep {int(secs) + 5}; kill -CONT {int(pid)} 2>/dev/null"],
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     start_new_session=True, close_fds=True)
    os.kill(pid, signal.SIGSTOP)


def grab(out, tag):
    path = os.path.join(out, f"p7n_{tag}.png")
    try:
        # twice: the first frame after a pause can be an old one (HeadsetView
        # is refreshed only while sampled)
        subprocess.run(["env", "-u", "LD_PRELOAD", lab_p2cmd.HVGRAB, path, os.environ.get("HVS", "2")], capture_output=True, timeout=6)
        time.sleep(0.3)
        subprocess.run(["env", "-u", "LD_PRELOAD", lab_p2cmd.HVGRAB, path, os.environ.get("HVS", "2")], capture_output=True, timeout=6)
    except subprocess.TimeoutExpired:
        return None
    return path if os.path.exists(path) else None


class ALock:
    """lab.Lock(both=True) from async code: its enter and exit run their own
    asyncio.run() (Steam evals), so they go to a worker thread."""

    def __init__(self):
        self.lock = lab.Lock(both=True)

    async def __aenter__(self):
        # lab.Lock gives up after 240 s; with ~20 agents queueing that happens, so
        # wait again (up to LABTRIES x 240 s, default 5) instead of losing the test
        tries = max(1, int(os.environ.get("LABTRIES", "5")))
        for i in range(tries):
            try:
                await asyncio.get_running_loop().run_in_executor(None, self.lock.__enter__)
                return self
            except SystemExit:
                if i == tries - 1:
                    raise
                self.lock = lab.Lock(both=True)
        return self

    async def __aexit__(self, *exc):
        await asyncio.get_running_loop().run_in_executor(None, self.lock.__exit__, None, None, None)
        return False


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


async def steam_js(expr):
    """lab_js (SharedJSContext, its own asyncio.run) from async code."""
    return await asyncio.get_running_loop().run_in_executor(None, lab.lab_js, expr)


SG5_ROUTES = [("win", "/library/tab/AllGames"), ("home", "/library/home")]


async def sg5(out):
    """Holds lab.lock + lab-vr.lock (no other agent moves the route meanwhile); a
    windowed route and windowless Home; per route: base, window.dim 0.35 (t1),
    + main.dim 0.35 (cover and base wrappers: CC-A in native mode), restored."""
    os.makedirs(out, exist_ok=True)
    tg = next(x for x in lgs_vr.targets() if x["title"] == "systemui")
    res = {"test": "SG-5", "shots": [], "routes": {}}
    async with lgs.Session(tg["webSocketDebuggerUrl"]) as s:
        q = Sys(s)
        async with ALock():
            route0 = await steam_js("L.route()")
            res["route0"] = route0
            try:
                for tag, route in SG5_ROUTES:
                    r = res["routes"][tag] = {"route": route}
                    await steam_js(f"L.nav({json.dumps(route)})")
                    await asyncio.sleep(3.0)            # the reporter and the daemon settle
                    r["ready"] = await q.ready()
                    if not (r["ready"] and r["ready"].get("coverAt")):
                        r["blocked"] = "the daemon's scene graph never pushed main's cover"
                        continue
                    spec0 = await q.js(f"JSON.stringify({G}.spec())")
                    main0 = next((x for x in (spec0 or {}).get("surfaces", []) if x.get("steamKey") == MAIN), {})
                    r["main"] = {"mosaic": len(main0.get("mosaic") or []) if "mosaic" in main0 else None,
                                 "popped": len(main0.get("popped") or []), "coverDz": main0.get("coverDz")}
                    try:
                        res["shots"].append(grab(out, f"{tag}_0_base"))
                        r["setWindow"] = await q.js(f"JSON.stringify({G}.windowState({{dim: 0.35}}))")
                        await asyncio.sleep(1.3)
                        r["afterWindow"] = (await q.js(STATUS))["window"]
                        res["shots"].append(grab(out, f"{tag}_1_t1dim"))
                        # the daemon's own spec has no `window`, which (R1 M1) is the window at rest: a
                        # spec the daemon sends meanwhile restores it, so record the state after each grab
                        r["windowAtShot1"] = (await q.js(STATUS))["window"]
                        if isinstance(spec0, dict) and spec0.get("surfaces"):
                            spec1 = dict(spec0, window={"dim": 0.35},
                                         surfaces=[dict(x, dim=0.35) if x.get("steamKey") == MAIN else x
                                                   for x in spec0["surfaces"]])
                            await q.js(f"{G}.update({json.dumps(spec1)}), 0")
                            await asyncio.sleep(1.3)
                            dump = await q.js(f"JSON.stringify({G}.dump().map(d=>[d.kind,d.dimmed,d.parent]))")
                            r["mainDimWrapped"] = {k: [sum(1 for d in dump if d[0] == k and d[1] and d[2] == MAIN),
                                                       sum(1 for d in dump if d[0] == k and d[2] == MAIN)]
                                                   for k in ("cover", "base", "pop", "slab")}
                            r["routeStill"] = await steam_js("L.route()")
                            res["shots"].append(grab(out, f"{tag}_2_t1dim_maindim"))
                            r["windowAtShot2"] = (await q.js(STATUS))["window"]
                    finally:
                        if isinstance(spec0, dict):
                            await q.js(f"{G} && {G}.update({json.dumps(spec0)}), 0")
                        await q.js(f"{G} && {G}.windowState({{dim: 1, recede: 0}}), 0")
                        await asyncio.sleep(1.3)
                        r["restored"] = (await q.js(STATUS))["window"]
                        res["shots"].append(grab(out, f"{tag}_3_restored"))
            finally:
                if route0:
                    await steam_js(f"L.nav({json.dumps(route0)})")
    return res


POPUP_ROUTE = "/library/tab/AllGames"
DUMP_POP = ("JSON.stringify(__LGS_SG.dump().filter(d=>d.parent!=='" + MAIN + "').map(d=>({k:d.k,kind:d.kind,anchor:d.anchor,"
            "uv:d.uv,px:d.px,curv:d.curv||null,z:d.z})))")


PLUS_OPEN = ("(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));for(const p of SteamUIStore.WindowStore."
             "VRGamepadUIMainWindowInstance.VRDashboardBarPopups)p.closePopup();await W(400);const el=L.q('bar','%{AddWindowButton}');"
             "L.click('bar','%{AddWindowButton}');el.dispatchEvent(new(L.surface('bar').MouseEvent)('mouseenter'));await W(1200);return 1})()")
PLUS_CLOSE = ("(async()=>{for(const p of SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.VRDashboardBarPopups)p.closePopup();"
              "try{L.unhover&&L.unhover()}catch(e){};await new Promise(r=>setTimeout(r,500));return 1})()")


async def popup(out):
    """R1 B1 in native mode, the reviewer's A/B with the daemon's own instance:
    frame A as the daemon built it, frame B with one popup surface taken out of
    the daemon's spec (Steam's real panel alone), frame C restored. Before the
    fix A and C showed the frame menu (tab bar) twice; now A, B and C must show
    one panel, in the same place. The parent is the frame menu when the daemon
    builds it (P6 made it a laser-only surface: only in Steam's laser mode,
    MODE=laser), else the "+" bar popup (asymmetric too: v 0.36..1), opened
    as inventory/bar.md 0.3 does and closed again. Also records every popup
    item's anchor and curvature origin. Frames show the room: look, then
    delete on both machines."""
    os.makedirs(out, exist_ok=True)
    tg = next(x for x in lgs_vr.targets() if x["title"] == "systemui")
    res = {"test": "SG-POPUP-N", "shots": []}

    def pick(surfs):
        return next((k for k in surfs if k and ".frame.menu." in k), None) or \
            next((k for k in surfs if k and ".barpopup." in k), None)

    async with lgs.Session(tg["webSocketDebuggerUrl"]) as s:
        q = Sys(s)
        async with ALock():
            route0 = await steam_js("L.route()")
            res["route0"] = route0
            res["mode"] = lab.STEP.get("mode")
            opened = False
            try:
                await steam_js(f"L.nav({json.dumps(POPUP_ROUTE)})")
                await asyncio.sleep(3.0)
                res["ready"] = await q.ready()
                surfs = []
                for phase in ("menu", "plus"):
                    if phase == "plus":
                        res["plus"] = await steam_js(PLUS_OPEN)
                        opened = True
                    t0 = time.time()
                    while True:
                        spec0 = await q.js(f"JSON.stringify({G}.spec())")
                        surfs = [x.get("steamKey") for x in (spec0 or {}).get("surfaces", [])]
                        if pick(surfs) or time.time() - t0 > 10:
                            break
                        await asyncio.sleep(0.5)
                    if pick(surfs):
                        break
                await asyncio.sleep(1.5)        # its nodes pushed
                spec0 = await q.js(f"JSON.stringify({G}.spec())")
                surfs = [x.get("steamKey") for x in (spec0 or {}).get("surfaces", [])]
                res["surfaces"] = surfs
                res["parents"] = (await q.js(f"JSON.stringify({G}.status().parents)"))
                res["items"] = await q.js(DUMP_POP)
                fm = pick(surfs)
                res["target"] = fm
                if not fm:
                    res["blocked"] = "no frame-menu or bar-popup surface in the daemon's spec"
                    return res
                try:
                    res["shots"].append(grab(out, "pop_A_built"))
                    spec1 = dict(spec0, surfaces=[x for x in spec0["surfaces"] if x.get("steamKey") != fm])
                    await q.js(f"{G}.update({json.dumps(spec1)}), 0")
                    await asyncio.sleep(1.0)
                    res["itemsB"] = len([d for d in (await q.js(DUMP_POP)) if d["k"].startswith(fm + "#")])
                    res["shots"].append(grab(out, "pop_B_removed"))
                finally:
                    await q.js(f"{G} && {G}.update({json.dumps(spec0)}), 0")
                await asyncio.sleep(1.0)
                res["itemsC"] = len([d for d in (await q.js(DUMP_POP)) if d["k"].startswith(fm + "#")])
                res["shots"].append(grab(out, "pop_C_restored"))
            finally:
                if opened:
                    res["closed"] = await steam_js(PLUS_CLOSE)
                if route0:
                    await steam_js(f"L.nav({json.dumps(route0)})")
    fmi = [d for d in res.get("items") or [] if d["k"].startswith((res.get("target") or "?") + "#")]
    P = (res.get("parents") or {}).get(res.get("target") or "", {})
    uv = P.get("uv") or [0, 0, 1, 1]
    want = [(uv[0] + uv[2]) / 2, (uv[1] + uv[3]) / 2]
    res["targetItems"] = fmi
    # the cover spans the displayed range: its anchor is the displayed centre (texture uv)
    cov = [d for d in fmi if d["kind"] == "cover"]
    res["anchorOk"] = bool(cov) and abs(cov[0]["anchor"][0] - want[0]) < 0.005 and abs(cov[0]["anchor"][1] - want[1]) < 0.005
    res["curv"] = cov[0].get("curv") if cov else None
    return res


RATE = ("JSON.stringify((()=>{const s=__LGS_SG.status();return {pushes:s.pushes,frames:s.anim.frames,finals:s.anim.finals,"
        "items:s.items,seq:s.specSeq,anim:s.anim.active}})())")


async def rate():
    """Card item 1 with the real daemon: pushes per second at rest, while the
    gamepad moves the focus over posters (pops lift and settle), and after."""
    tg = next(x for x in lgs_vr.targets() if x["title"] == "systemui")
    res = {"test": "SG-RATE"}
    async with lgs.Session(tg["webSocketDebuggerUrl"]) as s:
        q = Sys(s)
        async with ALock():
            route0 = await steam_js("L.route()")
            try:
                await steam_js("L.nav('/library/tab/AllGames')")
                await asyncio.sleep(3.0)
                res["ready"] = await q.ready()

                async def sample(secs, during=None):
                    a = await q.js(RATE)
                    t0 = time.time()
                    per, last = [], a
                    task = asyncio.ensure_future(during()) if during else None
                    while time.time() - t0 < secs:
                        await asyncio.sleep(1.0)
                        b = await q.js(RATE)
                        per.append(b["pushes"] - last["pushes"])
                        last = b
                    if task:
                        await task
                    return {"perSecond": per, "max": max(per) if per else None, "frames": last["frames"] - a["frames"],
                            "finals": last["finals"] - a["finals"], "specs": (last["seq"] or 0) - (a["seq"] or 0)}

                res["rest"] = await sample(5)

                async def moves():
                    await steam_js("(async()=>{L.root(); for (let i = 0; i < 6; i++) { await L.pad(i % 2 ? 'left' : 'right'); await L.sleep(500); } return 1})()")
                res["moving"] = await sample(5, moves)
                res["after"] = await sample(5)
            finally:
                if route0:
                    await steam_js(f"L.nav({json.dumps(route0)})")
    res["pass"] = bool(res.get("rest")) and res["rest"]["max"] <= 15 and res["moving"]["max"] <= 60 and \
        res["after"]["max"] <= 15
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
        async with ALock():
            st0 = await q.js(STATUS)
            stop_daemon(pid, 15)
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
        async with ALock():
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
                stop_daemon(pid, 15)
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

    # several tests in one native session: sg_native.py popup,sg5,sg6 OUTDIR
    def step(argv, **kw):
        if argv and argv[0] == "p7":
            # the session's step options, and MODE=laser|pad for every test: Steam's laser mode makes the
            # reporter report laser-only surfaces (the frame menu, P6's `laserOnly`), so the daemon builds them
            lab_p2cmd.set_step(kw.get("base"))
            if os.environ.get("MODE") in ("laser", "pad"):
                lab.STEP["mode"] = os.environ["MODE"]
            for name in test.split(","):
                try:
                    r = asyncio.run({"sg5": lambda: sg5(out), "sg6": sg6, "rate": rate, "popup": lambda: popup(out)}[name]())
                except (Exception, SystemExit) as e:  # noqa: BLE001 - a busy lab lock exits; the next test still runs
                    r = {"test": name, "pass": False, "error": repr(e)}
                results.append(r)
                print("@@p7 " + json.dumps(r), flush=True)
            return 0
        return 0

    lab_p2cmd.run_step = step
    # NWAIT: seconds to queue for native.lock (other agents' sessions; default 1800)
    code = lab_p2cmd.native_session(["--wait", os.environ.get("NWAIT", "1800"), "--step", "p7"])
    print(json.dumps({"nativeSession": code, "tests": len(results)}), flush=True)


if __name__ == "__main__":
    main()
