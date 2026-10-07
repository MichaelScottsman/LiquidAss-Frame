#!/usr/bin/env python3
"""Glass Shell for SteamVR's own web UI.

SteamVR draws part of the Frame's interface itself (vrwebhelper pages served
from 127.0.0.1:27062/dashboard: the window frame controls and grab bar, Now
Playing, SteamVR settings, controller bindings, message overlays). With the
SteamVR developer setting VRWebHelper/DebuggerEnabled (port 8090) those pages
have a devtools socket too. Unlike Steam's popups they don't share one JS
context, and pages come and go, so while the theme is on a watcher keeps
every page themed. That watcher is now part of the transient unit
"lgs-shell" (lgs_shell.py, which also runs the native glass layer); this
module keeps the page-theming functions it and the lab use. "lgs_vr.py
daemon" (the old standalone "lgs-vr" watcher) still works on its own.

  lgs_vr.py daemon    run the standalone watcher
  lgs_vr.py strip     remove the theme from every SteamVR page
  lgs_vr.py stop      pause the watcher's page theming and strip every page (until the
                      next apply_once / lgs on, or VR_PAUSE_MAX_S in lgs_shell.py)
  lgs_vr.py status    per-page status
"""
import asyncio
import glob
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, HERE)
import lgs  # noqa: E402

VR_CDP = "http://127.0.0.1:8090"
UNIT = "lgs-vr"            # the pre-native standalone watcher
SHELL_UNIT = "lgs-shell"   # runs the watcher now (lgs_shell.py)
PAUSE = "/tmp/lgs/vr-theme-paused"   # while present, the watcher leaves pages alone
VR_THEME = os.path.join(lgs.THEME_DIR, "vr")
POLL = 1.5


def available():
    try:
        with urllib.request.urlopen(VR_CDP + "/json/version", timeout=2):
            return True
    except OSError:
        return False


def targets():
    with urllib.request.urlopen(VR_CDP + "/json/list", timeout=3) as r:
        return [t for t in json.load(r) if t.get("type") == "page"]


def theme_files():
    """Shared tokens first, then the SteamVR stylesheets."""
    return sorted(glob.glob(os.path.join(lgs.THEME_DIR, "*.nowrap.css"))) + \
        sorted(glob.glob(os.path.join(VR_THEME, "*.css")))


def signature():
    parts = []
    for p in theme_files() + [lgs.DIAL]:
        try:
            parts.append(f"{p}:{os.stat(p).st_mtime_ns}")
        except OSError:
            pass
    return "|".join(parts)


def payload():
    css = lgs.bundle_files(theme_files())
    return {"op": "on", "css": css, "version": hashlib.sha1(css.encode()).hexdigest()[:10]}


def core_call(p):
    with open(os.path.join(HERE, "lgs_index.js"), encoding="utf-8") as f:
        index_js = f.read()
    with open(os.path.join(HERE, "lgs_vr_core.js"), encoding="utf-8") as f:
        core_js = f.read().strip().rstrip(";")
    return f"(() => {{\n{index_js}\nreturn ({core_js})({json.dumps(p)}, lgsBuildIndex);\n}})()"


async def eval_in(t, expr, timeout=20):
    async with lgs.Session(t["webSocketDebuggerUrl"]) as s:
        return await s.eval(expr, timeout)


async def each_page(expr_for):
    out = {}
    for t in targets():
        try:
            out[t["title"] or t["url"]] = await eval_in(t, expr_for(t))
        except Exception as e:  # noqa: BLE001 - a page closing mid-call
            out[t["title"] or t["url"]] = f"error: {e}"
    return out


def resume():
    """End a pause left by stop(): the daemon's watcher themes pages and injects the page scripts again."""
    try:
        os.remove(PAUSE)
        return True
    except OSError:
        return False


def apply_once():
    """Theme every SteamVR page now (the lab's `--theme on` for vr: pages; users get the watcher). The theme
    is on again, so a pause left by stop() (the lab's `--theme off`, e.g. the stock snapshot of `gates` and
    `audit` on a vr: page) ends too: until then the daemon injected no page script and themed no new page
    (REQ C6b->P8)."""
    if not available():
        resume()
        return {}
    full = core_call(payload())
    try:
        return asyncio.run(each_page(lambda t: full))
    finally:
        resume()


def strip():
    if not available():
        return {}
    return asyncio.run(each_page(lambda t: core_call({"op": "off"})))


def status():
    if not available():
        return {"available": False}
    pages = asyncio.run(each_page(lambda t: core_call({"op": "status"})))
    return {"available": True, "watcher": unit_active() or unit_active(SHELL_UNIT),
            "paused": os.path.exists(PAUSE),
            "pages": {k: (json.loads(v) if isinstance(v, str) and v.startswith("{") else v) for k, v in pages.items()}}


def steam_theme_on():
    try:
        return bool(lgs.run_js("SharedJSContext", "!!(window.__LGS && window.__LGS.state.enabled)", 10))
    except Exception:  # noqa: BLE001 - Steam restarting
        return None


async def watch():
    sig, p, probe, full = None, None, None, None
    steam_off = 0
    while True:
        s = signature()
        if s != sig:
            sig, p = s, payload()
            full = core_call(p)
            probe = (f"(window.__LGS_VR && window.__LGS_VR.version === {json.dumps(p['version'])})"
                     " ? (window.__LGS_VR.apply() ? 'ok' : 'retry') : 'need'")
            lgs.log(f"vr: theme {p['version']} ({len(p['css'])} bytes)")
        # The Steam side is the switch: if it went away (Steam restarted, or
        # "lgs off" raced us) the SteamVR side follows.
        on = steam_theme_on()
        steam_off = steam_off + 1 if on is False else 0
        if steam_off >= 2:
            lgs.log("vr: Steam theme is off; stripping SteamVR pages and exiting")
            strip()
            return
        if available():
            for t in targets():
                try:
                    if await eval_in(t, probe, 10) == "need":
                        r = await eval_in(t, full, 30)
                        lgs.log(f"vr: {t['title'] or t['url']}: {r}")
                except Exception:  # noqa: BLE001 - page reloading or closing
                    pass
        await asyncio.sleep(POLL)


def unit_active(unit=UNIT):
    r = subprocess.run(["systemctl", "--user", "is-active", unit], capture_output=True, text=True,
                       env=user_env())
    return r.stdout.strip() == "active"


def user_env():
    env = dict(os.environ)
    env.setdefault("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}")
    for k in ("LD_LIBRARY_PATH", "LD_PRELOAD", "PYTHONHOME", "PYTHONPATH"):
        env.pop(k, None)
    return env


def start():
    """Start the watcher, which now lives in the lgs-shell unit. Idempotent."""
    import lgs_shell
    return lgs_shell.start()


def start_standalone():
    """The pre-native standalone watcher unit "lgs-vr" (not used by lgs)."""
    if not available():
        return "steamvr devtools off"
    if unit_active():
        return "running"
    subprocess.run(["systemctl", "--user", "reset-failed", UNIT], capture_output=True, env=user_env())
    r = subprocess.run(["systemd-run", "--user", "--unit", UNIT, "--collect", "--quiet",
                        "--description=Glass Shell: theme SteamVR pages (transient)",
                        "/usr/bin/python3", os.path.realpath(__file__), "daemon"],
                       capture_output=True, text=True, env=user_env())
    return "started" if r.returncode == 0 else f"failed: {r.stderr.strip()}"


def stop():
    """Strip every SteamVR page and keep them stripped until the next
    "lgs on" (lab --theme off on a vr: page). The running lgs-shell keeps its
    native layer and only pauses its page theming; a standalone lgs-vr
    watcher is stopped as before."""
    try:
        os.makedirs(os.path.dirname(PAUSE), exist_ok=True)
        with open(PAUSE, "w", encoding="utf-8") as f:
            f.write(str(time.time()))
    except OSError:
        pass
    subprocess.run(["systemctl", "--user", "stop", UNIT], capture_output=True, env=user_env())
    return strip()


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "status"
    if cmd == "daemon":
        try:
            os.remove(PAUSE)
        except OSError:
            pass
        try:
            asyncio.run(watch())
        except KeyboardInterrupt:
            pass
        return 0
    if cmd == "strip":
        print(json.dumps(strip(), indent=1))
    elif cmd == "status":
        print(json.dumps(status(), indent=1))
    elif cmd == "start":
        print(start())
    elif cmd == "stop":
        print(json.dumps(stop(), indent=1))
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
