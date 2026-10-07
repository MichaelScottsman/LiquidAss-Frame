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
from lab import Lock, flock_wait, lab_js, opt, flag, STEP, steam_build

NATIVE_LOCK = "/tmp/lgs/native.lock"
SHOTS_REMOTE = "/tmp/lgs-shots"


def stamp():
    return {"build": steam_build(), "date": time.strftime("%Y-%m-%dT%H:%M:%S")}


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


def run_step(argv):
    """One nested lab command, in this process, with its own step options."""
    STEP["flags"].clear()
    STEP["mode"] = None
    STEP["media"].clear()
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
        return hv_grab(argv[1:])
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
    t0 = time.time()
    f = flock_wait(NATIVE_LOCK, wait, "native.lock")
    out = {"waitedS": round(time.time() - t0, 1), **stamp(), "steps": []}
    code = 0
    try:
        if not lgs.is_on():
            lgs.op("on", quiet=True)
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
            with Lock():
                print("pre:", lab_js(pre), flush=True)
        for s in steps:
            print(f"== step: {' '.join(shlex.quote(a) for a in s)}", flush=True)
            c = run_step(s)
            code = code or (c if c in (1, 3) else 0)
    finally:
        # Always back to CSS only (lgs on --css), then check it really is.
        try:
            lgs.op("on", quiet=True, vr=True, native=False)
        except Exception as e:  # noqa: BLE001
            print(f"native-session: lgs on --css failed: {e}", file=sys.stderr)
        back = None
        for _ in range(20):
            enabled, _, _ = native_state(shell_status())
            if not enabled and not main_html_native():
                back = True
                break
            time.sleep(0.5)
        print(f"native-session: back to CSS only: {'yes' if back else 'NOT CONFIRMED'}", flush=True)
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


def hv_grab(args):
    """Capture system.HeadsetView once; announce it for glass.py (which measures
    and deletes it). The frame shows the room: never kept."""
    name = args[0] if args and not args[0].startswith("--") else "hv"
    err = hv_build()
    if err:
        print(f"BLOCKED: hvgrab does not build: {err}")
        return 3
    out = f"/tmp/lgs/hv-{os.getpid()}-{int(time.time() * 1000) % 100000}.png"
    with Lock(surface="vr:systemui"):
        r = os.popen(f"env -u LD_PRELOAD {shlex.quote(HVGRAB)} {out} 2 2>&1").read().strip()
    if not os.path.exists(out):
        print(f"BLOCKED: hvgrab produced no frame ({r[-300:]})")
        return 3
    print(f"@@hv {out} {name}", flush=True)
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
    surface = args[0]
    sj = surf_js(surface)
    S = json.dumps(surface)
    if theme == "off":
        only.discard("aud")             # stock vs stock: nothing to diff
    res = {"surface": surface, "route": route, "pre": bool(pre), "theme": theme,
           "step": {"flags": dict(STEP["flags"]), "mode": STEP["mode"], "media": list(STEP["media"])},
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
        if pre:
            res["preResult"] = lab_js(pre, surface=sj)
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
            g["OUTLINE"] = o
            announce_file(remote, f"shots/{keep}.png" if keep else f"shots/_gates_tmp_{os.getpid()}.png")
        if "aud" in only:
            lab.set_theme("off", surface)
            time.sleep(0.4)
            lab_js(f"(window.__LGS_AUDIT = L.snap({S}), 1)", surface=sj)
            lab.set_theme("on", surface)
            time.sleep(0.8)
            g["AUD"] = lab_js(f"L.gates.audDiff(window.__LGS_AUDIT, L.snap({S}))", surface=sj)
            g["AUD"].pop("moved", None)


# ---------------------------------------------------------------- pad-bfs

def pad_bfs(args):
    route = opt(args, "--route")
    pre = opt(args, "--pre")
    start = opt(args, "--start")
    mx = int(opt(args, "--max", 120))
    budget = float(opt(args, "--budget", 150))
    no_b = flag(args, "--no-b")
    flag(args, "--json")
    res = {"route": route, **stamp(), "step": {"flags": dict(STEP["flags"]), "mode": STEP["mode"]}}
    with Lock():
        if route:
            lab_js(f"L.nav({json.dumps(route)})")
            time.sleep(1.5)
        if pre:
            res["preResult"] = lab_js(pre)
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


COMMANDS = {
    "native-session": native_session,
    "hv-grab": hv_grab,
    "gates": gates,
    "pad-bfs": pad_bfs,
}


def run(cmd, args):
    fn = COMMANDS.get(cmd)
    if not fn:
        print(f"BLOCKED: lab.py {cmd} is not implemented yet")
        sys.exit(3)
    code = fn(args)
    if code:
        sys.exit(code)
