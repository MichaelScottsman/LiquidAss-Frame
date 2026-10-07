#!/usr/bin/env python3
"""Phase 2 lab commands, device side (P10, docs/phase2/contracts/lab.md).

Imported lazily by lab.py; runs on the Frame next to it. Files a command wants
on the PC are announced on stdout as one line each:

  @@file <remote path> <local path relative to glass-shell/>   fetch, then delete remotely
  @@hv <remote path> <name>                                    headset-view frame: glass.py
                                                               measures it and deletes both copies
"""
import json
import os
import shlex
import sys
import time

import lab
from lab import Lock, flock_wait, lab_js, opt, flag, STEP, steam_build, run_pre

NATIVE_LOCK = "/tmp/lgs/native.lock"
SHOTS_REMOTE = "/tmp/lgs/shots"            # runtime state only under /tmp/lgs (hard rule 7, review R1 m9)


def stamp():
    """Evidence label of a result: Steam build, date and the native layer's state at the time (review R1 m2: a
    CSS-tier step can run while another agent's native-session has native mode on)."""
    return {"build": steam_build(), "date": time.strftime("%Y-%m-%dT%H:%M:%S"), "native": lab.native_on()}


class vr_lock:
    """lab-vr.lock for a short read inside a lab.lock step (lock order lab.lock -> lab-vr.lock, as Lock(both=True))."""

    def __enter__(self):
        self.f = flock_wait(lab.LOCK.replace("lab.lock", "lab-vr.lock"), 240, "lab-vr.lock")
        return self

    def __exit__(self, *a):
        import fcntl
        try:
            fcntl.flock(self.f, fcntl.LOCK_UN)
        finally:
            self.f.close()


def remote_shot_path(name):
    os.makedirs(SHOTS_REMOTE, exist_ok=True)
    return f"{SHOTS_REMOTE}/{os.path.basename(name)}-{os.getpid()}-{int(time.time() * 1000) % 100000}.png"


def announce_file(remote, local):
    print(f"@@file {remote} {local}", flush=True)


# ---------------------------------------------------------------- native-session

def shell_status():
    import lgs_shell
    try:
        return lgs_shell.status()
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


def native_state(st):
    """(enabled, glassd ok, reason) from lgs_shell.status()."""
    shell = st.get("shell") if isinstance(st.get("shell"), dict) else st
    nat = (shell or {}).get("native") or {}
    g = (shell or {}).get("glassd") or {}
    enabled = bool(nat.get("enabled"))
    gok = bool(g.get("running")) and g.get("healthy") is not False and bool(g.get("ready", True))
    return enabled, gok, nat.get("reason") or (shell or {}).get("mode") or st.get("error")


def main_html_native():
    try:
        return lab_js("L.surface('main').document.documentElement.classList.contains('lgs-native')")
    except Exception:  # noqa: BLE001
        return None


def set_step(base=None):
    """Reset the module's step options (to a native session's own options, when given)."""
    base = base or {}
    STEP["flags"].clear()
    STEP["flags"].update(base.get("flags") or {})
    STEP["mode"] = base.get("mode")
    STEP["media"].clear()
    STEP["media"].extend(base.get("media") or [])
    STEP["stock"] = bool(base.get("stock"))
    STEP["hover"] = base.get("hover")


def run_step(argv, base=None):
    """One nested lab command, in this process: the session's step options (base), then its own on top."""
    set_step(base)
    argv = list(argv)
    if not argv:
        return 0
    if argv[0] == "shot" and len(argv) >= 3 and "/" not in argv[2]:
        name = argv[2]
        remote = remote_shot_path(name)
        argv[2] = remote
        code = _call(argv)
        if os.path.exists(remote):
            announce_file(remote, f"shots/{name}.png")
        return code
    if argv[0] == "hv":
        # The step's own --flags/--mode/--media/--hover/--stock go on top of the session's, as for every other step
        # (lab.main parses them there). Until session 5 this path skipped parse_step(): an hv step's own
        # `--mode laser` was dropped, and the look was taken in the session's mode (P7 recheck 12:46).
        args = argv[1:]
        lab.parse_step(args)
        return hv_grab(args)
    return _call(argv)


def _call(argv):
    try:
        lab.main(["lab.py"] + argv)
        return 0
    except SystemExit as e:
        if e.code not in (0, None):
            print(f"step {argv[0]} exited: {e.code}", file=sys.stderr)
        return e.code if isinstance(e.code, int) else 1


def native_session(args):
    pre = opt(args, "--pre")
    settle = float(opt(args, "--settle", 2.0))
    wait = float(opt(args, "--wait", 1800))
    ready_s = float(opt(args, "--ready", 60))
    steps = []
    while "--step" in args:
        steps.append(shlex.split(opt(args, "--step")))
    if "--" in args:
        i = args.index("--")
        steps.append(args[i + 1:])
        del args[i:]
    import lgs
    import lgs_shell
    # Step options given to native-session itself apply to every step (each step's own go on top).
    sess = {"flags": dict(STEP["flags"]), "mode": STEP["mode"], "media": list(STEP["media"]), "stock": STEP["stock"],
            "hover": STEP.get("hover")}
    set_step()
    t0 = time.time()
    f = flock_wait(NATIVE_LOCK, wait, "native.lock")      # order: native.lock -> lab.lock -> lab-vr.lock
    out = {"waitedS": round(time.time() - t0, 1), **stamp(), "steps": []}
    code = 0
    started = False
    try:
        # Turning the native layer on changes Steam's windows and systemui: hold both lab locks for it.
        with Lock(both=True, keep=True):
            if not lgs.is_on():
                lgs.op("on", quiet=True)
            started = True
            res = lgs_shell.start(native="on", stay=True)
            out["start"] = res
            deadline = time.time() + ready_s
            enabled = gok = False
            reason = None
            while time.time() < deadline:
                enabled, gok, reason = native_state(shell_status())
                if enabled and gok:
                    break
                time.sleep(0.5)
        out["native"] = {"enabled": enabled, "glassd": gok, "reason": reason,
                         "readyS": round(time.time() - (deadline - ready_s), 1)}
        if not (enabled and gok):
            print(json.dumps(out, indent=1))
            print(f"BLOCKED: native layer did not come up in {ready_s:g} s ({reason})")
            code = 3
            return code
        time.sleep(settle)
        out["lgsNativeOnMain"] = main_html_native()
        print(json.dumps(out, indent=1), flush=True)
        if pre:
            set_step(sess)
            with Lock():
                print("pre:", lab_js(pre), flush=True)
        for s in steps:
            print(f"== step: {' '.join(shlex.quote(a) for a in s)}", flush=True)
            c = run_step(s, base=sess)
            code = code or (c if c in (1, 3) else 0)
    finally:
        # Always back to CSS only (lgs on --css), then check it really is; under both lab locks when they
        # can be had, and without them rather than leave native mode on.
        set_step()
        back = None

        def to_css():
            try:
                lgs.op("on", quiet=True, vr=True, native=False)
            except Exception as e:  # noqa: BLE001
                print(f"native-session: lgs on --css failed: {e}", file=sys.stderr)
            for _ in range(20):
                enabled, _, _ = native_state(shell_status())
                if not enabled and not main_html_native():
                    return True
                time.sleep(0.5)
            return None
        if not started:
            # the lab locks were never had (busy for 240 s): native mode was not touched, nothing to give back
            print("native-session: native mode was not turned on (the lab locks were busy); nothing to undo", flush=True)
        else:
            try:
                with Lock(both=True, keep=True):
                    back = to_css()
            except SystemExit:
                back = to_css()
            print(f"native-session: back to CSS only: {'yes' if back else 'NOT CONFIRMED'}", flush=True)
        n = purge_own_hv()
        if n:
            print(f"native-session: deleted {n} unfetched headset-view frame(s) on the Frame", flush=True)
        f.close()
    return code


# ---------------------------------------------------------------- hv (device half)

HVGRAB = os.path.join(os.path.dirname(lab.HERE), "native", "spike", "hvgrab")


def hv_build():
    if os.path.exists(HVGRAB):
        return None
    d = os.path.dirname(HVGRAB)
    cmd = (f"cd {shlex.quote(d)} && g++ -O2 -std=c++17 -I$HOME/frametop/screens/build/include -I. hvgrab.cpp -o hvgrab "
           "-L/opt/steamvr/bin/linuxarm64 -lopenvr_api -Wl,-rpath,/opt/steamvr/bin/linuxarm64 -lvulkan 2>&1")
    r = os.popen(cmd).read()
    return None if os.path.exists(HVGRAB) else r[-1500:]


HV_REAP_S = 90


def hv_reaper(path):
    """The room frame is deleted on the Frame HV_REAP_S s after capture even if no PC fetches it (glass.py killed
    mid-session): a detached `sleep; rm -f` that ends with it (nothing survives a reboot; /tmp is RAM). glass.py
    fetches and deletes it within seconds as the @@hv line streams; lab.py also purges stale frames at every lock
    entry (review R1 M5)."""
    import subprocess
    try:
        subprocess.Popen(["sh", "-c", f"sleep {HV_REAP_S}; rm -f {shlex.quote(path)}"], stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True, close_fds=True)
    except OSError as e:
        print(f"hv: could not start the frame reaper: {e}", file=sys.stderr)


def purge_own_hv():
    """This process's headset-view frames (native-session's finally)."""
    pre = f"hv-{os.getpid()}-"
    n = 0
    try:
        for nm in os.listdir("/tmp/lgs"):
            if nm.startswith(pre) and nm.endswith(".png"):
                try:
                    os.remove(os.path.join("/tmp/lgs", nm))
                    n += 1
                except OSError:
                    pass
    except OSError:
        pass
    return n


HV_GAP_S = 0.5      # between the warm-up grab and the measured one (REQ P7->P10)


def hvgrab_once(out, scale):
    """One hvgrab run into `out`; returns its output (stdout + stderr, stripped)."""
    return os.popen(f"env -u LD_PRELOAD {shlex.quote(HVGRAB)} {out} {scale} 2>&1").read().strip()


def hv_grab(args):
    """Capture system.HeadsetView; announce it for glass.py (which measures and deletes it). The frame shows the
    room: never kept.

    SteamVR refreshes system.HeadsetView only while someone samples it, so the first grab after a pause can return a
    picture minutes old (REQ P7->P10, SG-2 rerun 09:15). Every hv therefore grabs `--grabs N` times (default 2),
    `--gap S` apart (default 0.5 s), deletes each earlier frame at once (it never leaves the Frame) and measures the
    last one only.

    `--route R`, `--pre JS|@hover SEL[,MS]` (with `--surface S` for the pre, default main) and `--settle S` open a
    lab layer (a menu, an alert) for the capture (REQ C1c->P10): the step then holds lab.lock and lab-vr.lock (in that
    order), runs the route and the pre, waits the settle, grabs, and only then gives the usual restore at the lock
    exit (menus the step opened are closed, the pointer goes to (1400, 900)). Steam step options apply to it, and any
    of them (`--mode`, `--flags`, `--media`, `--stock`) also makes hv such a Steam step (session 5: a plain hv held
    only lab-vr.lock, where they are not applied). The settle defaults to 1.5 s in native mode, 0.8 s otherwise."""
    offaxis = opt(args, "--offaxis")
    rect = opt(args, "--rect")
    look = flag(args, "--look")
    scale = 1 if flag(args, "--full") else 2          # --full: full-resolution HeadsetView (REQ P9->P10)
    route = opt(args, "--route")
    pre = opt(args, "--pre")
    psurf = opt(args, "--surface", "main")
    grabs = max(1, int(opt(args, "--grabs", 2)))
    gap = max(0.0, float(opt(args, "--gap", HV_GAP_S)))
    # Steam's state for the look: a route, a pre, a hover, or any Steam step option (--mode, --flags, --media,
    # --stock). Each makes hv a Steam step (both lab locks; the options applied inside it), so `hv NAME --mode
    # laser` alone really is a laser look: P6 reports the laser-only frame menu and P7 builds its copy only in laser
    # mode. Until session 5 a plain hv held only lab-vr.lock, where Steam's options are not applied (vr: steps), so
    # its --mode was silently dropped (P7 recheck 12:46).
    opts_on = bool(STEP.get("mode") or STEP.get("flags") or STEP.get("media") or STEP.get("stock"))
    layer = bool(route or pre or STEP.get("hover") or opts_on)
    # the scene graph follows a Steam change through P6's report and the daemon's push: 1.5 s in native mode (as
    # sgcheck's settle, springs at rest), 0.8 s for the CSS look
    settle = float(opt(args, "--settle", (1.5 if lab.native_on() == "on" else 0.8) if layer else 0))
    name = args[0] if args and not args[0].startswith("--") else "hv"
    err = hv_build()
    if err:
        print(f"BLOCKED: hvgrab does not build: {err}")
        return 3
    out = f"/tmp/lgs/hv-{os.getpid()}-{int(time.time() * 1000) % 100000}.png"
    info = {"grabs": grabs, "gapS": gap}
    # A lab layer kept open for the capture is a Steam step: both lab locks (lab.lock -> lab-vr.lock), Steam's step
    # options, and the usual restore at the exit. A plain hv only reads systemui: lab-vr.lock.
    with (Lock(both=True) if layer else Lock(surface="vr:systemui")):
        if route:
            lab_js(f"L.nav({json.dumps(route)})")
            time.sleep(1.2)
        if pre or STEP.get("hover"):
            info["preResult"] = run_pre(pre, psurf)
        if settle:
            time.sleep(settle)
        yawed = None
        if offaxis:
            # P7's lab hook (contracts/sg.md, lgs_sg.js test.yaw): turn Steam's window about its vertical axis,
            # restored below (and by its own 20 s TTL and the watchdog).
            try:
                yawed = lab_js(f"(window.__LGS_SG && window.__LGS_SG.test && typeof window.__LGS_SG.test.yaw === 'function') ? "
                               f"window.__LGS_SG.test.yaw({float(offaxis)}, 15000) : null", surface="vr:systemui")
            except SystemExit as e:
                yawed = {"error": str(e)}
            if not yawed or yawed.get("error"):
                print(f"BLOCKED: no off-axis hook in vr:systemui ({(yawed or {}).get('error', '__LGS_SG not installed: run hv as a native-session step')})")
                return 3
            time.sleep(0.6)
        r = ""
        try:
            for i in range(grabs):
                if os.path.exists(out):
                    os.remove(out)           # an earlier (warm-up) frame: room imagery, never fetched
                if i:
                    time.sleep(gap)
                r = hvgrab_once(out, scale)
        finally:
            if yawed:
                try:
                    lab_js("window.__LGS_SG.test.yaw(0)", surface="vr:systemui")
                except Exception:  # noqa: BLE001 - the hook's TTL restores it anyway
                    pass
    if not os.path.exists(out):
        print(f"BLOCKED: hvgrab produced no frame ({r[-300:]})")
        return 3
    hv_reaper(out)
    hv_opts = {"look": look, "full": scale == 1, "grabs": grabs, "layer": layer, "mode": STEP.get("mode"),
               "native": lab.native_on()}
    if rect:
        hv_opts["rect"] = [int(float(v)) for v in rect.split(",")]
    print(f"@@hv {out} {name} {json.dumps(hv_opts, separators=(',', ':'))}", flush=True)
    if info.get("preResult") is not None:
        print(f"hv: pre -> {json.dumps(info['preResult'])[:200]}", file=sys.stderr, flush=True)
    return 0


# ---------------------------------------------------------------- gates

def load_exemptions():
    p = os.path.join(lab.HERE, "exemptions.json")
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def surf_js(surface):
    """lab_js keyword for a surface: vr: pages evaluate inside the page."""
    return surface if surface.startswith("vr:") else None


def capture_remote(surface, name):
    import asyncio
    remote = remote_shot_path(name)
    asyncio.run(lab.capture(surface, remote, 0.3))
    return remote


def gates(args):
    route = opt(args, "--route")
    pre = opt(args, "--pre")
    only = set((opt(args, "--only") or "aud,size,type,outline,motion").split(","))
    keep = opt(args, "--shot")
    flag(args, "--json")            # glass.py prints JSON either way
    rest_ms = float(opt(args, "--rest", 1.0))
    theme = opt(args, "--theme", "keep")
    stock_route = opt(args, "--stock-route")
    surface = args[0]
    sj = surf_js(surface)
    S = json.dumps(surface)
    if theme == "off" or STEP.get("stock"):
        only.discard("aud")             # stock vs stock: nothing to diff
    res = {"surface": surface, "route": route, "pre": bool(pre), "theme": theme, "keep": keep, "stockRoute": stock_route,
           "step": {"flags": dict(STEP["flags"]), "mode": STEP["mode"], "media": list(STEP["media"]), "stock": STEP["stock"]},
           **stamp(), "gates": {}}
    g = res["gates"]
    with Lock(surface=surface):
        restore_on = theme == "off" and not surface.startswith("vr:") and __import__("lgs").is_on()
        try:
            _gates_body(surface, sj, S, route, pre, only, keep, rest_ms, theme, res, g)
        finally:
            if restore_on:
                lab.set_theme("on", surface)
    print("@@gates " + json.dumps(res), flush=True)
    return 0


def _gates_body(surface, sj, S, route, pre, only, keep, rest_ms, theme, res, g):
    if True:
        if theme in ("on", "off"):
            lab.set_theme(theme, surface)
            time.sleep(0.4)
        lab_js(f"(L.gates.exemptions({json.dumps(load_exemptions())}), 1)", surface=sj)
        if route:
            lab_js(f"L.nav({json.dumps(route)})")
            time.sleep(1.2)
        t0 = time.time()
        if pre or STEP.get("hover"):
            res["preResult"] = run_pre(pre, surface)
            t0 = time.time()
        if "motion" in only:
            early = lab_js(f"L.gates.motionAudit(L.gates.animsNow({S}))", surface=sj)
            time.sleep(max(0.0, rest_ms - (time.time() - t0)))
            rest = lab_js(f"L.gates.atRest({S})", surface=sj)
            css = lab_js(f"L.gates.cssAudit({S})", surface=sj)
            g["MOTION"] = {"pass": not early and not rest["running"] and not rest["lgsLeft"] and not rest["infinite"] and not css,
                           "nonToken": early, "atRest": rest, "cssNonToken": css}
        else:
            time.sleep(0.3)
        if "size" in only:
            g["SIZE"] = lab_js(f"L.gates.size({S})", surface=sj)
        if "type" in only:
            g["TYPE"] = lab_js(f"L.gates.type({S})", surface=sj)
        if "outline" in only:
            o = lab_js(f"L.gates.outline({S})", surface=sj)
            o["dpr"] = lab_js(f"L.surface({S}).devicePixelRatio", surface=sj)
            remote = capture_remote(surface, keep or f"_gates_{os.getpid()}")
            o["shotRemote"] = remote
            # the PC measures exactly this file (not the newest _gates_tmp_* of any process: review R1 m3)
            o["shotLocal"] = f"shots/{keep}.png" if keep else f"shots/_gates_tmp_{os.getpid()}_{int(time.time() * 1000) % 1000000}.png"
            g["OUTLINE"] = o
            announce_file(remote, o["shotLocal"])
        if "aud" in only:
            stock_route = res.get("stockRoute")
            # How many controls the surface shows: a theme switch can close a popup the pre opened (or a runtime
            # patch can unmount what it drew), and an AUD over an empty snapshot compares nothing (REQ C2b-R2->P10:
            # "controls 0, texts 0" on the "+" popup with wp.c2b). The pre is run again when the surface emptied.
            count = f"(() => {{ try {{ return L.gates.controls({S}).length; }} catch (e) {{ return 0; }} }})()"
            n0 = lab_js(count, surface=sj)
            reran = []
            lab.set_theme("off", surface)
            time.sleep(0.4)
            if stock_route:          # REQ C2a->P10 #4: our route themed vs another route stock
                lab_js(f"L.nav({json.dumps(stock_route)})")
                time.sleep(1.2)
            if pre and not stock_route and n0 and not lab_js(count, surface=sj):
                run_pre(pre, surface)
                time.sleep(0.6)
                reran.append("stock")
            lab_js(f"(window.__LGS_AUDIT = L.snap({S}), 1)", surface=sj)
            lab.set_theme("on", surface)
            time.sleep(0.8)
            if stock_route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(1.2)
                if pre:
                    run_pre(pre, surface)
                    time.sleep(0.5)
            elif pre and n0 and not lab_js(count, surface=sj):
                run_pre(pre, surface)
                time.sleep(0.6)
                reran.append("themed")
            g["AUD"] = lab_js(f"L.gates.audDiff(window.__LGS_AUDIT, L.snap({S}))", surface=sj)
            g["AUD"].pop("moved", None)
            if reran:
                g["AUD"]["preRerun"] = reran
            # No data never reads as a pass (review R1 M3): a snapshot without a single control or text run is an
            # error, not an AUD with 0 issues
            a_n, b_n = g["AUD"].get("stockRecords", 1), g["AUD"].get("themedRecords", 1)
            if not a_n or not b_n:
                g["AUD"]["pass"] = False
                g["AUD"]["error"] = (f"vacuous: the {'stock' if not a_n else 'themed'} snapshot of {surface} holds no "
                                     "control or text (the surface closed or was empty when the theme was switched)")
                g["AUD"].setdefault("issues", []).append("VACUOUS " + g["AUD"]["error"])


# ---------------------------------------------------------------- pad-bfs

def pad_bfs(args):
    route = opt(args, "--route")
    pre = opt(args, "--pre")
    start = opt(args, "--start")
    mx = int(opt(args, "--max", 120))
    budget = float(opt(args, "--budget", 150))
    no_b = flag(args, "--no-b")
    flag(args, "--json")
    res = {"route": route, **stamp(), "step": {"flags": dict(STEP["flags"]), "mode": STEP["mode"], "stock": STEP["stock"]}}
    with Lock():
        if route:
            lab_js(f"L.nav({json.dumps(route)})")
            time.sleep(1.5)
        if pre or STEP.get("hover"):
            res["preResult"] = run_pre(pre, "main")      # JS, '@hover SEL[,MS]', then the step's --hover
            time.sleep(0.6)
        init = lab_js(f"L.bfs.init({json.dumps({'start': start, 'max': mx})})", timeout=30)
        if init.get("error"):
            print(f"BLOCKED: {init['error']}")
            return 3
        res["init"] = init
        t0 = time.time()
        while True:
            left = budget - (time.time() - t0)
            if left <= 1:
                break
            st = lab_js(f"L.bfs.step({int(min(40, left) * 1000)})", timeout=75)
            print(f"bfs: {st}", file=sys.stderr, flush=True)
            if st.get("done"):
                break
        out = lab_js(f"L.bfs.finish({json.dumps({'noB': no_b})})", timeout=40)
        res.update(out)
        if route:
            lab_js(f"L.nav({json.dumps(route)})")
    print("@@bfs " + json.dumps(res), flush=True)
    return 0


# ---------------------------------------------------------------- focus (live luma pairs)

RECTS_JS = r"""
(() => {
  const w = L.surface(%(surf)s), dpr = w.devicePixelRatio || 1, out = {};
  for (const s of %(sels)s) {
    let el = null;
    try { el = L.q(%(surf)s, s); } catch (e) { out[s] = { error: e.message }; continue; }
    if (!el) { out[s] = { error: 'nothing matches' }; continue; }
    const r = el.getBoundingClientRect();
    out[s] = { rect: [r.x * dpr, r.y * dpr, r.width * dpr, r.height * dpr], radius: (parseFloat(w.getComputedStyle(el).borderTopLeftRadius) || 0) * dpr };
  }
  return { dpr, rects: out };
})()
"""


def focus_live(args):
    """Captures for `glass.py focus SURF --pairs ...`: one capture per distinct state (the JS run before it),
    with the rects of every selector the pairs measure in that state (shot px). The PC computes the luma."""
    route = opt(args, "--route")
    pre = opt(args, "--pre")
    pairs = json.loads(opt(args, "--pairs-json") or opt(args, "--pairs") or "[]")   # --pairs: inline JSON (native-session steps)
    settle = float(opt(args, "--settle", 0.8))
    keep = opt(args, "--keep")          # a name prefix: captures kept as shots/<keep>_<n>.png
    surface = args[0]
    sj = surf_js(surface)
    states = []
    for p in pairs:
        for side in ("a", "b"):
            st = (p.get(side) or {}).get("state") or ""
            if st not in states:
                states.append(st)
    res = {"surface": surface, "route": route, **stamp(),
           "step": {"flags": dict(STEP["flags"]), "mode": STEP["mode"], "media": list(STEP["media"]), "stock": STEP["stock"]},
           "states": [], "pairsIn": pairs, "keep": keep}
    with Lock(surface=surface):
        try:
            if route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(1.2)
            if pre or STEP.get("hover"):
                res["preResult"] = run_pre(pre, surface)
                time.sleep(0.5)
            for i, st in enumerate(states):
                sels = sorted({(p.get(side) or {}).get("sel") for p in pairs for side in ("a", "b")
                               if ((p.get(side) or {}).get("state") or "") == st and (p.get(side) or {}).get("sel")})
                out = {"state": st}
                if st:
                    try:
                        # '@hover SEL[,MS]': a real CDP hover (laser look); '@unhover': pointer away; else JS
                        if st.startswith("@unhover"):
                            lab.cdp_unhover()
                            out["result"] = "unhovered"
                        else:
                            out["result"] = run_pre(st, surface) if st.startswith("@hover ") else lab_js(st, surface=sj)
                    except Exception as e:  # noqa: BLE001
                        out["error"] = str(e)
                time.sleep(settle)
                r = lab_js(RECTS_JS % {"surf": json.dumps(surface), "sels": json.dumps(sels)}, surface=sj)
                out.update(r)
                name = f"{keep}_{i}" if keep else f"_focus_{os.getpid()}_{i}"
                remote = capture_remote(surface, name)
                out["file"] = f"shots/{name}.png"
                announce_file(remote, out["file"])
                res["states"].append(out)
        finally:
            try:
                lab_js("L.unhover()", surface=sj)     # IM 9: pointer to (1400, 900) after a synthetic hover
            except Exception:  # noqa: BLE001
                pass
            if route:
                try:
                    lab_js(f"L.nav({json.dumps(route)})")
                except Exception:  # noqa: BLE001
                    pass
    print("@@focus " + json.dumps(res), flush=True)
    return 0


# ---------------------------------------------------------------- motion (filmstrips)

def capture_now(surface, remote):
    """Capture the surface as it is (no settle: the strip's animations are paused at the seeked time)."""
    import asyncio
    import base64
    import lgs

    async def go():
        t = lab.target_for(surface)
        async with lgs.Session(t["webSocketDebuggerUrl"]) as s:
            await s.send("Page.bringToFront")
            r = await s.send("Page.captureScreenshot", {"format": "png"}, 30)
        with open(remote, "wb") as f:
            f.write(base64.b64decode(r["data"]))
    asyncio.run(go())


MOTION_PROBE = "@@probe"          # --selftest: the two-box probe as the pre (review R1 M1)


def motion(args):
    route = opt(args, "--route")
    pre = opt(args, "--pre")
    name = opt(args, "--name") or "motion"
    at = [float(x) for x in (opt(args, "--at") or "0,.15,.35,.5,.75,1").split(",")]
    rest_s = float(opt(args, "--rest", 1.0))
    selftest = opt(args, "--selftest")        # MS: the probe's duration
    flag(args, "--json")
    surface = args[0] if args else "main"
    if selftest:
        pre, name = MOTION_PROBE, name if name != "motion" else f"_p10_selftest_{int(float(selftest))}"
    if not pre:
        print("usage: lab.py motion SURF --pre JS [--route R] [--name ID_INTERACTION] [--at 0,.15,...]")
        return 2
    sj = surf_js(surface)
    S = json.dumps(surface)
    res = {"surface": surface, "route": route, "name": name, "at": at, **stamp(),
           "step": {"flags": dict(STEP["flags"]), "mode": STEP["mode"], "media": list(STEP["media"]), "stock": STEP["stock"]},
           "frames": [], "freeze": "pause+seek+2raf"}
    if selftest:
        res["selftest"] = {"ms": float(selftest)}
    with Lock(surface=surface):
        try:
            if route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(1.2)
            # Let anything already running settle, so the strip holds only what the pre starts.
            time.sleep(0.3)
            res["before"] = lab_js(f"L.gates.atRest({S})", surface=sj)
            os.remove(capture_remote(surface, f"_warm_{os.getpid()}"))   # brings the surface to the front
            lab_js(f"L.motion.mark({S})", surface=sj)        # what runs now is not part of the strip
            if pre == MOTION_PROBE:
                res["selftest"]["boxes"] = lab_js(f"(() => {{ const r = L.motion.probe({S}, {float(selftest)}); "
                                                  f"r.frozen = L.motion.freeze({S}); return r; }})()", surface=sj)
                res["frozen"] = res["selftest"]["boxes"].get("frozen")
            elif pre.startswith("@hover "):
                res["preResult"] = run_pre(pre, surface)      # a real hover-in (CDP), then pause what it started
                res["frozen"] = lab_js(f"L.motion.freeze({S})", surface=sj)
            else:
                # The pre and the pause in one evaluation: getAnimations() flushes style, so the CSS animations
                # and transitions the pre starts exist and are paused before a frame runs.
                r = lab_js(f"(async () => {{ const v = await ({pre}); const n = L.motion.freeze({S}); return [v, n]; }})()",
                           surface=sj)
                res["preResult"], res["frozen"] = (r if isinstance(r, list) and len(r) == 2 else [r, None])
                if STEP.get("hover"):
                    run_pre(None, surface)
                    lab_js(f"L.motion.freeze({S})", surface=sj)
            anims = lab_js(f"L.motion.list({S})", surface=sj)
            res["animations"] = anims
            res["nonToken"] = lab_js(f"L.gates.motionAudit(L.motion.list({S}))", surface=sj)
            res["motionLib"] = lab_js(f"L.motion.moAudit({S})", surface=sj)
            for f in at:
                sk = lab_js(f"L.motion.seek({S}, {f})", surface=sj)     # pause, set the time, two rAFs
                fname = f"p2_motion_{name}_{f:g}"
                remote = remote_shot_path(fname)
                capture_now(surface, remote)
                announce_file(remote, f"shots/{fname}.png")
                res["frames"].append({"f": f, "file": f"shots/{fname}.png", "seeked": sk["seeked"], "rects": sk["rects"],
                                      "raf": sk.get("raf"), "times": sk.get("times")})
        finally:
            try:
                res["released"] = lab_js("L.motion.release()", surface=sj)     # play again from the last f
            except Exception as e:  # noqa: BLE001
                res["releaseError"] = str(e)
            if pre == MOTION_PROBE:
                try:
                    lab_js(f"L.motion.probeRemove({S})", surface=sj)
                except Exception:  # noqa: BLE001
                    pass
        # P-52 / PLAN 1.5: nothing left 1 s after the interaction
        time.sleep(rest_s)
        res["atRest"] = lab_js(f"L.gates.atRest({S})", surface=sj)
        res["dpr"] = lab_js(f"L.surface({S}).devicePixelRatio", surface=sj)
        res["width"] = lab_js(f"L.surface({S}).innerWidth", surface=sj)
        if route:
            lab_js(f"L.nav({json.dumps(route)})")
    print("@@motion " + json.dumps(res), flush=True)
    return 0


# ---------------------------------------------------------------- sgcheck (live data for the depth model)

SG_DOM_JS = r"""
(() => {
  const out = {};
  const ex = %(extra)s;
  for (const name of %(names)s) {
    let w;
    try { w = L.surface(name); } catch (e) { out[name] = { error: e.message }; continue; }
    const d = w.document, R = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const vis = (el) => L.visible(w, el);
    const boxes = (sel) => { let els = []; try { els = [...d.querySelectorAll(L.sel(sel))]; } catch (_) { /* unresolved token */ } return els.filter(vis).map(R); };
    const fb = [];
    for (const el of [...d.querySelectorAll('[data-lgs-nopop]')].filter(vis)) fb.push(Object.assign(R(el), { name: '[data-lgs-nopop] ' + (L.readable(el).slice(0, 2).join(' ') || el.tagName) }));
    for (const f of (ex[name] || [])) for (const b of boxes(f.sel)) fb.push(Object.assign(b, { name: f.name || f.sel }));
    out[name] = {
      cssW: w.innerWidth, cssH: w.innerHeight, dpr: w.devicePixelRatio,
      focusables: L.focusables(name).map((f) => ({ x: f.rect[0], y: f.rect[1], w: f.rect[2], h: f.rect[3] })),
      forbidden: fb,
      media: boxes('video, [data-lgs-media]'),
      destructive: boxes('[data-lgs-destructive]'),
    };
  }
  return out;
})()
"""

SG_SYS_JS = r"""
(() => {
  const S = window.__LGS_SG;
  if (!S) return null;
  const o = { version: S.version, caps: S.caps || [] };
  try { o.dump = S.dump(); } catch (e) { o.dumpError = e.message; }
  try { if (S.geom) o.geom = S.geom(); } catch (_) { /* old build */ }
  try { if (S.spec) o.spec = S.spec(); } catch (_) { /* not yet (REQ P10->P7) */ }
  return o;
})()
"""


def sgcheck_live(args):
    route = opt(args, "--route")
    pre = opt(args, "--pre")
    settle = float(opt(args, "--settle", 1.5))
    flag(args, "--json")
    res = {"route": route, **stamp(),
           "step": {"flags": dict(STEP["flags"]), "mode": STEP["mode"], "media": list(STEP["media"]), "stock": STEP["stock"]}}
    try:
        with open(os.path.join(lab.HERE, "sgcheck.json"), encoding="utf-8") as f:
            extra = json.load(f).get("forbidden", {})
    except (OSError, ValueError):
        extra = {}
    with Lock(both=True):
        if route:
            lab_js(f"L.nav({json.dumps(route)})")
            time.sleep(1.2)
        if pre or STEP.get("hover"):
            res["preResult"] = run_pre(pre, "main")
        time.sleep(settle)                   # depth springs settle (at rest)
        rep = lab_js("(window.__LGS_LAYERS && typeof window.__LGS_LAYERS.snapshot === 'function') ? "
                     "window.__LGS_LAYERS.snapshot() : null")
        if not rep:
            print(json.dumps(res))
            print("BLOCKED: native layer off (no reporter: run sgcheck as a native-session step)")
            return 3
        res["report"] = rep
        names = [s.get("name") for s in rep.get("surfaces", []) if s.get("name")]
        res["dom"] = lab_js(SG_DOM_JS % {"names": json.dumps(names), "extra": json.dumps(extra)})
        try:
            res["sg"] = lab_js(SG_SYS_JS, surface="vr:systemui")
        except SystemExit as e:
            res["sg"] = {"error": str(e)}
        if route:
            lab_js(f"L.nav({json.dumps(route)})")
    print("@@sgmodel " + json.dumps(res), flush=True)
    return 0


# ---------------------------------------------------------------- cmp (live rects, optional capture)

CMP_RECTS_JS = r"""
(() => {
  const out = {};
  for (const it of %s) {
    let w;
    try { w = L.surface(it.surface || 'main'); } catch (e) { out[it.id] = { error: e.message }; continue; }
    let s = it.sel, pick = 0;
    const m = /@(last|nth=(\d+))$/.exec(s);
    if (m) { s = s.slice(0, m.index); pick = m[1] === 'last' ? -1 : parseInt(m[2], 10); }
    let els;
    try { els = L.qa(it.surface || 'main', s).filter((e) => L.visible(w, e)); } catch (e) { out[it.id] = { error: e.message }; continue; }
    const el = pick === -1 ? els[els.length - 1] : els[pick];
    if (!el) { out[it.id] = { error: 'nothing visible matches ' + it.sel }; continue; }
    const r = el.getBoundingClientRect();
    out[it.id] = { surface: it.surface || 'main', rect: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10), dpr: w.devicePixelRatio, n: els.length };
  }
  return out;
})()
"""


def cmp_rects(args):
    route = opt(args, "--route")
    pre = opt(args, "--pre")
    items = json.loads(opt(args, "--items") or "[]")
    cap = opt(args, "--capture")          # SURF:NAME -> shots/NAME.png
    settle = float(opt(args, "--settle", 0.8))
    res = {"route": route, **stamp(),
           "step": {"flags": dict(STEP["flags"]), "mode": STEP["mode"], "media": list(STEP["media"]), "stock": STEP["stock"]}}
    surf = cap.split(":", 1)[0] if cap else (items[0].get("surface", "main") if items else "main")
    with Lock(surface=surf):
        if route:
            lab_js(f"L.nav({json.dumps(route)})")
            time.sleep(1.2)
        if pre or STEP.get("hover"):
            res["preResult"] = run_pre(pre, surf)
        time.sleep(settle)
        res["rects"] = lab_js(CMP_RECTS_JS % json.dumps(items), surface=surf_js(surf))
        if cap:
            s, name = cap.split(":", 1)
            remote = capture_remote(s, name)
            res["file"] = f"shots/{name}.png"
            announce_file(remote, res["file"])
        try:
            lab_js("L.unhover()", surface=surf_js(surf))
        except Exception:  # noqa: BLE001
            pass
        if route:
            lab_js(f"L.nav({json.dumps(route)})")
    print("@@cmprects " + json.dumps(res), flush=True)
    return 0


# ---------------------------------------------------------------- conformance (one route per step)

# The route's bottom ornament and glass bottom (PLAN R2-11): an ornament is a rendered #Footer legend (C1a's bottom
# ornament restyles Steam's #Footer); the glass bottom is C1a's --lgs-c1a-gh where it is published, else the window.
LAYOUT_JS = r"""
(() => {
  const w = L.surface('main'), d = w.document, f = d.querySelector('#Footer');
  const legends = f && L.visible(w, f) ? [...f.querySelectorAll('*')].filter((e) => !e.children.length && (e.textContent || '').trim() && L.visible(w, e)).length : 0;
  let gh = NaN;
  for (const el of [d.documentElement, (() => { try { return L.q('main', '%{BasicUiRoot}'); } catch (_) { return null; } })()]) {
    if (el) { const v = parseFloat(w.getComputedStyle(el).getPropertyValue('--lgs-c1a-gh')); if (v > 0) gh = v; }
  }
  return { ornament: legends > 0, legends, glassBottom: gh > 0 ? gh : w.innerHeight, height: w.innerHeight };
})()
"""


def conformance(args):
    route = opt(args, "--route")
    pre = opt(args, "--pre")
    surface = opt(args, "--surface", "main")
    settle = float(opt(args, "--settle", 1.0))
    flag(args, "--json")
    sj = surf_js(surface)
    S = json.dumps(surface)
    res = {"route": route, "surface": surface, **stamp(),
           "step": {"flags": dict(STEP["flags"]), "mode": STEP["mode"], "media": list(STEP["media"]), "stock": STEP["stock"]},
           "gates": {}}
    g = res["gates"]
    with Lock(surface=surface):
        lab_js(f"(L.gates.exemptions({json.dumps(load_exemptions())}), 1)", surface=sj)
        if route:
            lab_js(f"L.nav({json.dumps(route)})")
            time.sleep(1.2)
        if pre or STEP.get("hover"):
            res["preResult"] = run_pre(pre, surface)
        if STEP["mode"] == "pad" and not sj:
            lab_js("L.root()")
        time.sleep(settle)
        res["route"] = route or lab_js("L.route()")
        rest = lab_js(f"L.gates.atRest({S})", surface=sj)
        css = lab_js(f"L.gates.cssAudit({S})", surface=sj)
        g["MOTION"] = {"atRest": rest, "cssNonToken": css}
        g["SIZE"] = lab_js(f"L.gates.size({S})", surface=sj)
        g["TYPE"] = lab_js(f"L.gates.type({S})", surface=sj)
        g["OUTLINE"] = lab_js(f"L.gates.outline({S})", surface=sj)
        res["conf"] = lab_js(f"L.conf.run({S}, {json.dumps({'mode': STEP['mode']})})", surface=sj)
        if not sj:
            res["layout"] = lab_js(LAYOUT_JS)      # P-23's bottom bound (PLAN R2-11, REQ Coordinator->P10 (2))
        if not STEP["stock"] and not sj:
            lab.set_theme("off", surface)
            time.sleep(0.4)
            lab_js(f"(window.__LGS_AUDIT = L.snap({S}), 1)", surface=sj)
            lab.set_theme("on", surface)
            time.sleep(0.8)
            g["AUD"] = lab_js(f"L.gates.audDiff(window.__LGS_AUDIT, L.snap({S}))", surface=sj)
            g["AUD"].pop("moved", None)
            if not g["AUD"].get("stockRecords", 1) or not g["AUD"].get("themedRecords", 1):   # vacuous (session 5)
                g["AUD"]["pass"] = False
                g["AUD"].setdefault("issues", []).append(f"VACUOUS: an empty {surface} snapshot (stock or themed)")
        if not sj:
            rep = lab_js("(window.__LGS_LAYERS && typeof window.__LGS_LAYERS.snapshot === 'function') ? "
                         "window.__LGS_LAYERS.snapshot() : null")
            if rep:
                names = [s.get("name") for s in rep.get("surfaces", []) if s.get("name")]
                res["sgmodel"] = {"report": rep, "dom": lab_js(SG_DOM_JS % {"names": json.dumps(names), "extra": "{}"})}
                try:
                    with vr_lock():          # systemui is lab-vr.lock's (review R1 m1); order lab -> lab-vr
                        res["sgmodel"]["sg"] = lab_js(SG_SYS_JS, surface="vr:systemui")
                except SystemExit as e:
                    res["sgmodel"]["sg"] = {"error": str(e)}
    print("@@conf " + json.dumps(res), flush=True)
    return 0


# ---------------------------------------------------------------- perf --ab (PLAN R2-13, REQ Coordinator->P10 (3))

def _median(xs):
    xs = sorted(xs)
    n = len(xs)
    return None if not n else (xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2)


def perf_ab_verdict(runs):
    """R2-13's statistic over the pooled runs ({mode: ref|sub, fps, long, native}): only `native == "off"` runs count
    (a CSS-only verdict). PASS: median fps ratio sub / ref >= 0.95 and median extra long frames (> 34 ms) <= the
    reference's A/A spread (max - min of its long frames, min 1). None when either side has fewer than 2 runs."""
    use = [r for r in runs if r.get("native") == "off"]
    ref = [r for r in use if r["mode"] == "ref"]
    sub = [r for r in use if r["mode"] == "sub"]
    out = {"pooled": len(use), "excludedNative": len(runs) - len(use)}
    if len(ref) < 2 or len(sub) < 2:
        out.update({"pass": None, "why": f"{len(ref)} reference and {len(sub)} subject runs with native=off (need 2 each)"})
        return out
    rf, sf = [r["fps"] for r in ref], [r["fps"] for r in sub]
    rl, sl = [r["long"] for r in ref], [r["long"] for r in sub]
    ratio = _median(sf) / max(0.1, _median(rf))
    extra = _median(sl) - _median(rl)
    spread = max(1, max(rl) - min(rl))
    out.update(fpsMedian={"ref": _median(rf), "sub": _median(sf)}, fpsRatio=round(ratio, 3),
               longMedian={"ref": _median(rl), "sub": _median(sl)}, extraLong=extra, aaSpread=spread)
    out["pass"] = ratio >= 0.95 and extra <= spread
    return out


def perf_ab(surface, route, pre, secs, ab, rounds):
    """`perf SURF --ab stock|theme [--rounds N]`: ABBA x 2 per round (ref sub sub ref, twice), a further round pooled
    while the verdict fails (at most N rounds, default 2). ref/sub: `stock` = theme off / theme on (G-PERF);
    `theme` = theme only (runtime off) / theme + runtime (RT-7). Every run prints fps, long frames and `native`;
    the verdict is R2-13's (perf_ab_verdict). Exit 0 PASS, 1 FAIL, 3 BLOCKED. The theme is given back as found."""
    import lgs
    if ab not in ("stock", "theme"):
        print("usage: lab.py perf SURF --ab stock|theme [--rounds N] [--route R] [--pre JS] [--seconds S]")
        return 2
    if surface.startswith("vr:"):
        print("BLOCKED: perf --ab compares Steam UI states; vr: pages have no stock/runtime toggle here")
        return 3
    sj = surf_js(surface)
    S = json.dumps(surface)
    ms = int(secs * 1000)
    runs = []
    res = {"surface": surface, "route": route, "ab": ab, **stamp(),
           "step": {"flags": dict(STEP["flags"]), "mode": STEP["mode"], "media": list(STEP["media"])}}

    step = {}

    def put(mode):
        if ab == "stock":
            lgs.op("off" if mode == "ref" else "on", quiet=True)
        else:
            lgs.op("on", quiet=True, rt=(mode == "sub"))
        # each `lgs on` starts a new runtime: the subject runs get the step's --flags overlay, --mode stub and the
        # action logger again (the new runtime reads only the flags file); the reference has no runtime (stock) or
        # runs without it (theme only)
        if mode == "sub" and step.get("obj") is not None:
            step["last"] = step["obj"].reapply_runtime()
        time.sleep(0.4)

    def one(mode, rnd):
        put(mode)
        tmp = remote_shot_path(f"_perf_{os.getpid()}")
        try:
            import asyncio
            asyncio.run(lab.capture(surface, tmp, 0.8))       # brings the surface to the front (as plain perf)
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass
        p = lab_js(f"L.perf({S}, {ms})", timeout=60 + secs, surface=sj)
        r = {"round": rnd, "mode": mode, "fps": p.get("fps"), "long": p.get("long"), "p95": p.get("p95"),
             "median": p.get("median"), "worst": p.get("worst"), "native": lab.native_on()}
        if mode == "sub" and step.get("last"):
            r["reapplied"] = step["last"]            # the step's runtime options in this run's runtime
        runs.append(r)
        print(f"run {len(runs):2d} r{rnd} {mode}: {r['fps']} fps, {r['long']} long frames, p95 {r['p95']} ms, "
              f"native {r['native']}", flush=True)

    v = None
    with Lock(surface=surface) as lk:
        step["obj"] = lk.step            # None when nested in another lab step (its options are that step's)
        # checked once the lock is held (the wait can be minutes): a CSS-only verdict pools only native=off runs
        # (R2-13), and toggling the theme under another agent's native session would make its daemon dormant
        res.update(stamp())
        if res["native"] == "on":
            print("BLOCKED: a native session is on (R2-13 pools only native=off runs); run perf --ab when it has ended")
            return 3
        was_on = lgs.is_on()
        try:
            if route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(1.2)
            if pre or STEP.get("hover"):
                res["preResult"] = run_pre(pre, surface)
                time.sleep(0.6)
            stop = False
            for rnd in range(1, max(1, rounds) + 1):
                for mode in ("ref", "sub", "sub", "ref") * 2:
                    one(mode, rnd)
                    if runs[-1]["native"] == "on":       # a native session began: stop toggling the theme
                        print("perf --ab: a native session began during the runs; stopped", flush=True)
                        stop = True
                        break
                v = perf_ab_verdict(runs)
                if stop or v.get("pass"):
                    break
        finally:
            try:
                lgs.op("on" if was_on else "off", quiet=True)     # as found (the default runtime with it)
            except Exception as e:  # noqa: BLE001
                print(f"perf --ab: theme not given back: {e}", file=sys.stderr)
    res.update(runs=runs, rounds=max(r["round"] for r in runs) if runs else 0, verdict=v)
    ok = (v or {}).get("pass")
    ref_name = "stock" if ab == "stock" else "theme only (runtime off)"
    if ok is None:
        print(f"perf --ab {ab}: BLOCKED: {(v or {}).get('why')}")
    else:
        print(f"perf --ab {ab} {surface} {route or ''} (build {res['build']}, {res['date']}): reference = {ref_name}; "
              f"fps median ref {v['fpsMedian']['ref']} / subject {v['fpsMedian']['sub']} = {v['fpsRatio']} (needs >= 0.95); "
              f"long frames median ref {v['longMedian']['ref']} / subject {v['longMedian']['sub']}: extra {v['extraLong']} "
              f"(needs <= A/A spread {v['aaSpread']}); pooled {v['pooled']} runs over {res['rounds']} round(s), "
              f"{v['excludedNative']} excluded (native on) -> {'PASS' if ok else 'FAIL'}")
    print("@@perfab " + json.dumps(res), flush=True)
    return 3 if ok is None else (0 if ok else 1)


COMMANDS = {
    "conformance": conformance,
    "cmp-rects": cmp_rects,
    "sgcheck": sgcheck_live,
    "motion": motion,
    "native-session": native_session,
    "hv-grab": hv_grab,
    "gates": gates,
    "pad-bfs": pad_bfs,
    "focus": focus_live,
}


def run(cmd, args):
    fn = COMMANDS.get(cmd)
    if not fn:
        print(f"BLOCKED: lab.py {cmd} is not implemented yet")
        sys.exit(3)
    code = fn(args)
    if code:
        sys.exit(code)
