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
  lab.py js 'EXPR' [--in vr:PAGE]     eval with L=__LGS_LAB in SharedJSContext
                                       (or inside a SteamVR page)
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
volumelevel, keyboard or notifications, or vr:PAGE for SteamVR's own pages
(vr:systemui, vr:controllerbindingui, ...; listed by "surfaces --vr").
Selectors accept %{Token} classes.
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


def vr_target(surface):
    """A SteamVR page (vrwebhelper devtools, port 8090) named vr:<title>."""
    import lgs_vr
    name = surface[3:]
    if not lgs_vr.available():
        raise SystemExit("lab: SteamVR devtools (127.0.0.1:8090) are off; see docs/LAB.md")
    ts = lgs_vr.targets()
    for t in ts:
        if t["title"] == name:
            return t
    for t in ts:
        if name in t["title"] or name in t["url"]:
            return t
    raise SystemExit(f"lab: no SteamVR page {name!r} (have: {', '.join(t['title'] for t in ts)})")


def lab_js(expr, timeout=60, surface=None):
    """Evaluate with L = lab helpers: in Steam's SharedJSContext, or inside the
    SteamVR page when surface is vr:<page>."""
    js = f"(async () => {{ {helpers()}\nconst L = window.__LGS_LAB;\nreturn await ({expr}); }})()"
    if surface and surface.startswith("vr:"):
        t = vr_target(surface)

        async def go():
            async with lgs.Session(t["webSocketDebuggerUrl"]) as s:
                return await s.eval(js, timeout)
        return asyncio.run(go())
    return lgs.run_js("SharedJSContext", js, timeout)


def set_theme(mode, surface=None):
    """--theme on|off for one locked step (SteamVR pages too for vr: surfaces)."""
    if mode not in ("on", "off"):
        return
    if surface and surface.startswith("vr:"):  # SteamVR pages only
        import lgs_vr
        if mode == "on":
            lgs_vr.apply_once()
        else:
            lgs_vr.stop()  # also stops a running watcher, which would re-theme the page
        return
    lgs.op(mode, quiet=True)


class Lock:
    """Device-wide lock for one atomic lab step. On exit it closes every menu,
    dialog and bar popup the step opened (unless keep=True)."""

    def __init__(self, keep=False, surface=None):
        self.keep = keep
        # SteamVR pages don't share state with Steam's UI: their own lock, so
        # SteamVR work never waits on Steam route captures and vice versa.
        self.vr = bool(surface and surface.startswith("vr:"))
        self.path = LOCK.replace("lab.lock", "lab-vr.lock") if self.vr else LOCK

    def __enter__(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        self.f = open(self.path, "w")
        deadline = time.time() + 240
        while True:
            try:
                fcntl.flock(self.f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                if self.vr:
                    return self
                try:
                    lab_js("L.mark()")
                except Exception:  # noqa: BLE001 - the step must still run
                    pass
                return self
            except BlockingIOError:
                if time.time() > deadline:
                    raise SystemExit("lab: lock busy for 240 s")
                time.sleep(0.25)

    def __exit__(self, *a):
        try:
            if not self.keep and not self.vr:
                n = lab_js("L.restore()")
                if n:
                    print(f"(closed {n} menu/dialog/popup opened by this step)", file=sys.stderr)
        except Exception:  # noqa: BLE001
            pass
        finally:
            fcntl.flock(self.f, fcntl.LOCK_UN)
            self.f.close()


def target_for(surface):
    if surface.startswith("vr:"):
        return vr_target(surface)
    key = OVERLAY.get(surface) or "valve.steam.gamepadui." + surface
    for t in lgs.targets():
        k = lgs.overlay_key(t)
        if k == key or k.startswith(key + "."):  # "bar" must not match "barpopup"
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
        import lgs_vr
        if lgs_vr.available():
            print("SteamVR pages: " + ", ".join("vr:" + t["title"] for t in lgs_vr.targets()))
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
        with Lock(surface=args[0]):
            if route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(float(opt(args, "--settle", 1.5)))
            print(lab_js(f"L.outline({json.dumps(args[0])}, {json.dumps(o)})", surface=args[0]))
    elif cmd == "styles":
        print(json.dumps(lab_js(f"L.styles({json.dumps(args[0])}, {json.dumps(args[1])})", surface=args[0]), indent=1))
    elif cmd == "classes":
        print(lab_js(f"L.classes({json.dumps(args[0])}, 400)"))
    elif cmd == "click":
        with Lock(keep=flag(args, "--keep"), surface=args[0]):
            print(lab_js(f"L.click({json.dumps(args[0])}, {json.dumps(args[1])})", surface=args[0]))
    elif cmd == "js":
        keep = flag(args, "--keep")
        where = opt(args, "--in")
        with Lock(keep=keep, surface=where):
            v = lab_js(args[0], surface=where)
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
        keep = flag(args, "--keep")
        surface, out = args[0], args[1]
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        with Lock(keep=keep, surface=surface):
            set_theme(theme, surface)
            if route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(1.2)
            if pre:
                print("pre:", lab_js(pre, surface=surface if surface.startswith("vr:") else None))
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
                set_theme(mode, surface)
                asyncio.run(capture(surface, "/tmp/lgs/perf.png", 0.8))  # brings it to the front
                res[mode] = lab_js(f"L.perf({json.dumps(surface)}, {int(secs * 1000)})", timeout=60 + secs,
                                   surface=surface)
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
        with Lock(surface=surface):
            if route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(1.2)
            if pre:
                print("pre:", lab_js(pre, surface=surface if surface.startswith("vr:") else None))
                time.sleep(0.6)
            set_theme("off", surface)
            time.sleep(0.4)
            lab_js(f"(window.__LGS_AUDIT = L.snap({json.dumps(surface)}), 1)", surface=surface)
            set_theme("on", surface)
            time.sleep(0.8)
            res = lab_js(f"L.diff(window.__LGS_AUDIT, L.snap({json.dumps(surface)}))", surface=surface)
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
