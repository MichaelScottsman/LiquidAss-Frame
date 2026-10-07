#!/usr/bin/env python3
"""Glass Shell lab: inspect, drive and screenshot the Frame's Steam VR UI.

Runs on the headset next to device/lgs.py. Every command that navigates or
captures holds /tmp/lgs/lab.lock, so several agents can share the one live UI
without capturing each other's routes.

  lab.py surfaces                      list UI windows (popups) and sizes
  lab.py route | nav ROUTE | back      read / change the main window route
  lab.py outline SURF [--sel S] [--depth N] [--max N]
                                       readable DOM outline (%{Token} classes)
  lab.py styles SURF SELECTOR          key computed styles of matches
  lab.py classes REGEX                 search readable class names -> tokens
  lab.py click SURF SELECTOR           synthesize a click (opens menus etc.)
  lab.py js 'EXPR'                     eval in SharedJSContext with L=__LGS_LAB
  lab.py eval TARGET 'EXPR'|@file      raw eval in any CEF target
  lab.py shot SURF OUT.png [--route R] [--pre 'JS'] [--settle S]
                           [--theme on|off|keep] [--back]
                                       bring SURF to front, optionally navigate
                                       and run JS first, then capture it
  lab.py perf SURF [--route R] [--pre 'JS'] [--seconds S]
                                       scroll the surface's main scroller for S
                                       seconds with the theme off, then on, and
                                       compare frame pacing (leaves theme on)
  lab.py audit SURF [--route R] [--pre 'JS'] [--json]
                                       stock vs themed diff of every control and
                                       text: HIDDEN / SHRUNK / UNCLICKABLE / GONE
                                       / CONTRAST regressions (leaves theme on)

SURF is main, bar, barpopup, frame.menu, floatingfooter, tooltip,
volumelevel, keyboard or notifications. Selectors accept %{Token} classes.
"""
import asyncio
import base64
import fcntl
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "device"))
import lgs  # noqa: E402

LOCK = "/tmp/lgs/lab.lock"
OVERLAY = {
    "main": "valve.steam.gamepadui.main",
    "keyboard": "valve.steam.gamepadui.keyboard",
    "notifications": "valve.steam.gamepadui.notifications",
}


def helpers():
    with open(os.path.join(os.path.dirname(HERE), "device", "lgs_index.js"), encoding="utf-8") as f:
        idx = f.read()
    with open(os.path.join(HERE, "lab_helpers.js"), encoding="utf-8") as f:
        lab = f.read()
    return idx + "\n" + lab


def lab_js(expr, timeout=60):
    js = f"(async () => {{ {helpers()}\nconst L = window.__LGS_LAB;\nreturn await ({expr}); }})()"
    return lgs.run_js("SharedJSContext", js, timeout)


class Lock:
    def __enter__(self):
        os.makedirs(os.path.dirname(LOCK), exist_ok=True)
        self.f = open(LOCK, "w")
        deadline = time.time() + 240
        while True:
            try:
                fcntl.flock(self.f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return self
            except BlockingIOError:
                if time.time() > deadline:
                    raise SystemExit("lab: lock busy for 240 s")
                time.sleep(0.25)

    def __exit__(self, *a):
        fcntl.flock(self.f, fcntl.LOCK_UN)
        self.f.close()


def target_for(surface):
    key = OVERLAY.get(surface) or "valve.steam.gamepadui." + surface
    for t in lgs.targets():
        if lgs.overlay_key(t).startswith(key):
            return t
    raise SystemExit(f"lab: no CEF target for surface {surface!r}")


async def capture(surface, out, settle):
    t = target_for(surface)
    async with lgs.Session(t["webSocketDebuggerUrl"]) as s:
        await s.send("Page.bringToFront")
        await s.send("Page.setWebLifecycleState", {"state": "active"})
        await asyncio.sleep(settle)
        r = await s.send("Page.captureScreenshot", {"format": "png"}, 30)
    with open(out, "wb") as f:
        f.write(base64.b64decode(r["data"]))


def opt(args, name, default=None):
    if name in args:
        i = args.index(name)
        v = args[i + 1]
        del args[i:i + 2]
        return v
    return default


def flag(args, name):
    if name in args:
        args.remove(name)
        return True
    return False


def main(argv):
    args = argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return
    cmd = args.pop(0)
    if cmd == "surfaces":
        print(json.dumps(lab_js("L.surfaces()"), indent=1))
    elif cmd == "route":
        print(lab_js("L.route()"))
    elif cmd == "nav":
        with Lock():
            print(lab_js(f"L.nav({json.dumps(args[0])})"))
    elif cmd == "back":
        with Lock():
            print(lab_js("L.back()"))
    elif cmd == "outline":
        o = {"sel": opt(args, "--sel"), "depth": int(opt(args, "--depth", 60)), "max": int(opt(args, "--max", 700))}
        route = opt(args, "--route")
        with Lock():
            if route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(float(opt(args, "--settle", 1.5)))
            print(lab_js(f"L.outline({json.dumps(args[0])}, {json.dumps(o)})"))
    elif cmd == "styles":
        print(json.dumps(lab_js(f"L.styles({json.dumps(args[0])}, {json.dumps(args[1])})"), indent=1))
    elif cmd == "classes":
        print(lab_js(f"L.classes({json.dumps(args[0])}, 400)"))
    elif cmd == "click":
        with Lock():
            print(lab_js(f"L.click({json.dumps(args[0])}, {json.dumps(args[1])})"))
    elif cmd == "js":
        v = lab_js(args[0])
        print(v if isinstance(v, str) else json.dumps(v, indent=1))
    elif cmd == "eval":
        js = args[1]
        if js.startswith("@"):
            with open(js[1:], encoding="utf-8") as f:
                js = f.read()
        v = lgs.run_js(args[0], js)
        print(v if isinstance(v, str) else json.dumps(v, indent=1))
    elif cmd == "shot":
        route = opt(args, "--route")
        pre = opt(args, "--pre")
        settle = float(opt(args, "--settle", 1.2))
        theme = opt(args, "--theme", "keep")
        go_back = flag(args, "--back")
        surface, out = args[0], args[1]
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        with Lock():
            if theme == "on":
                lgs.op("on", quiet=True)
            elif theme == "off":
                lgs.op("off", quiet=True)
            if route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(1.2)
            if pre:
                print("pre:", lab_js(pre))
                time.sleep(0.6)
            asyncio.run(capture(surface, out, settle))
            if go_back:
                lab_js("L.back()")
        print(out)
    elif cmd == "perf":
        route = opt(args, "--route")
        pre = opt(args, "--pre")
        secs = float(opt(args, "--seconds", 3))
        surface = args[0]
        res = {}
        with Lock():
            if route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(1.2)
            if pre:
                lab_js(pre)
                time.sleep(0.6)
            for mode in ("off", "on"):
                lgs.op(mode, quiet=True)
                asyncio.run(capture(surface, "/tmp/lgs/perf.png", 0.8))  # brings it to the front
                res[mode] = lab_js(f"L.perf({json.dumps(surface)}, {int(secs * 1000)})", timeout=60 + secs)
        for mode in ("off", "on"):
            r = res[mode]
            print(f"theme {mode:3}: {r['fps']} fps, median {r['median']} ms, p95 {r['p95']} ms, "
                  f"worst {r['worst']} ms, {r['long']} long frames, {r['backdropFilters']} backdrop-filters "
                  f"(scroller {r['scroller']})")
    elif cmd == "audit":
        route = opt(args, "--route")
        pre = opt(args, "--pre")
        as_json = flag(args, "--json")
        surface = args[0]
        with Lock():
            if route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(1.2)
            if pre:
                print("pre:", lab_js(pre))
                time.sleep(0.6)
            lgs.op("off", quiet=True)
            time.sleep(0.4)
            lab_js(f"(window.__LGS_AUDIT = L.snap({json.dumps(surface)}), 1)")
            lgs.op("on", quiet=True)
            time.sleep(0.8)
            res = lab_js(f"L.diff(window.__LGS_AUDIT, L.snap({json.dumps(surface)}))")
        if as_json:
            print(json.dumps(res, indent=1))
        else:
            print(f"audit {surface}{' ' + route if route else ''}: {res['controls']} controls, "
                  f"{res['texts']} text runs, {len(res['issues'])} issues, {res['movedCount']} moved >24px")
            for i in res["issues"]:
                print("  " + i)
            for m in res["moved"][:15]:
                print("  moved " + m)
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    try:
        main(sys.argv)
    except RuntimeError as e:
        print(f"lab: {e}", file=sys.stderr)
        sys.exit(1)
