#!/usr/bin/env python3
"""Liquid Glass Shell for the Steam Frame.

Turns the Liquid Glass theme for the Frame's Steam VR interface (gamepadui
dashboard, bar, popups, keyboard, toasts) on or off. The theme is injected
into the running Steam client over its local devtools socket and is never
written anywhere persistent: restarting Steam or rebooting restores stock.

usage: lgs [toggle|on|off|reload|status|dial 0..1|toast TEXT] [--quiet] [--native|--css]

  toggle   on if off, off if on (what the "+ > Launch Program" entry runs)
  on       inject (or re-inject) the theme. --native also runs the native
           glass layer (glassd, scene-graph depth; docs/NATIVE.md) for this
           session; --css switches a running native layer back off. Without
           either a running layer is kept as it is, and a new one is CSS only
  off      remove every trace of it
  reload   re-read theme/*.css and swap it in without a toast
  status   print what is applied, and any theme tokens that did not resolve
  dial V   transparency dial, 0 = clearest .. 1 = most opaque (default 0.5);
           remembered for the next "on", applied now if the theme is on
"""
import asyncio
import glob
import hashlib
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.realpath(__file__))
ROOT = os.path.dirname(HERE) if os.path.basename(HERE) == "device" else HERE
THEME_DIR = os.path.join(ROOT, "theme")
CDP = "http://127.0.0.1:8080"
LOG = "/tmp/lgs/lgs.log"
LOG_MAX = 512 * 1024   # /tmp is RAM: keep the log and one older copy (lgs.log.1)
DIAL = os.path.join(ROOT, "dial")


def log(msg):
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        try:
            if os.path.getsize(LOG) > LOG_MAX:
                os.replace(LOG, LOG + ".1")
        except OSError:
            pass
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(time.strftime("%H:%M:%S ") + msg + "\n")
    except OSError:
        pass


# ---------------------------------------------------------------- CDP plumbing

def targets():
    with urllib.request.urlopen(CDP + "/json/list", timeout=5) as r:
        return json.load(r)


def overlay_key(t):
    url = t.get("url", "")
    return url.split("vrOverlayKey=")[1].split("&")[0] if "vrOverlayKey=" in url else ""


def find_target(name):
    """SharedJSContext, a gamepadui overlay key, or a short alias (main, bar...)."""
    ts = targets()
    if name in ("shared", "SharedJSContext"):
        name = "SharedJSContext"
    elif name == "main":
        name = "valve.steam.gamepadui.main"
    elif not name.startswith("valve.") and name != "SharedJSContext":
        base = "valve.steam.gamepadui." + name
        for t in ts:
            k = overlay_key(t)
            if k == base or k.startswith(base + "."):  # "bar" must not match "barpopup"
                return t
    for t in ts:
        if t["title"] == name or overlay_key(t) == name:
            return t
    for t in ts:
        if name in t["title"] or name in t["url"]:
            return t
    raise SystemExit(f"lgs: no CEF target matching {name!r}")


class Session:
    """One websocket to a CEF page; several CDP calls in sequence."""

    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.n = 0

    async def __aenter__(self):
        import aiohttp
        self._http = aiohttp.ClientSession()
        self.ws = await self._http.ws_connect(self.ws_url, max_msg_size=0)
        return self

    async def __aexit__(self, *exc):
        await self.ws.close()
        await self._http.close()

    async def send(self, method, params=None, timeout=30):
        import aiohttp
        self.n += 1
        i = self.n
        await self.ws.send_json({"id": i, "method": method, "params": params or {}})
        while True:
            msg = await asyncio.wait_for(self.ws.receive(), timeout)
            if msg.type != aiohttp.WSMsgType.TEXT:
                raise RuntimeError(f"devtools socket closed ({msg.type})")
            d = json.loads(msg.data)
            if d.get("id") == i:
                if "error" in d:
                    raise RuntimeError(f"{method}: {d['error']}")
                return d["result"]

    async def eval(self, expr, timeout=30):
        r = await self.send("Runtime.evaluate", {
            "expression": expr, "returnByValue": True, "awaitPromise": True}, timeout)
        if "exceptionDetails" in r:
            ex = r["exceptionDetails"]
            raise RuntimeError("JS: " + str(ex.get("exception", {}).get("description") or ex.get("text")))
        return r["result"].get("value")


def run_js(target, expr, timeout=30):
    async def go():
        async with Session(find_target(target)["webSocketDebuggerUrl"]) as s:
            return await s.eval(expr, timeout)
    return asyncio.run(go())


# ---------------------------------------------------------------- theme bundle

def bundle():
    """theme/*.css in name order. Files not named *.nowrap.css are nested under
    html.lgs-on, which scopes them to "theme on" and adds (0,1,1) specificity."""
    import fcntl
    os.makedirs("/tmp/lgs", exist_ok=True)
    with open("/tmp/lgs/sync.lock", "a") as lock:  # glass.py sync swaps theme/ under this lock
        fcntl.flock(lock, fcntl.LOCK_SH)
        try:
            return _bundle()
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def brace_error(text):
    """Why a stylesheet would leak into the rest of the bundle, or None.
    One unclosed brace in a wrapped file would swallow every later file."""
    depth, i, n = 0, 0, len(text)
    while i < n:
        c = text[i]
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            if j < 0:
                return "unterminated comment"
            i = j + 2
            continue
        if c in "\"'":
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == "\\" else 1
            if j >= n:
                return "unterminated string"
            i = j + 1
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth < 0:
                return f"unmatched '}}' at offset {i}"
        i += 1
    return f"{depth} unclosed '{{'" if depth else None


SKIPPED = []


def _bundle():
    SKIPPED.clear()
    css = bundle_files(sorted(glob.glob(os.path.join(THEME_DIR, "*.css"))))
    svg = ""
    defs = os.path.join(THEME_DIR, "defs.svg")
    if os.path.exists(defs):
        with open(defs, encoding="utf-8") as f:
            svg = f.read()
    return css, svg


def bundle_files(paths):
    """Concatenate stylesheets: *.nowrap.css as is, everything else nested
    under html.lgs-on; files with unbalanced braces are skipped (SKIPPED)."""
    parts = []
    for path in paths:
        name = os.path.basename(path)
        with open(path, encoding="utf-8") as f:
            text = f.read()
        err = brace_error(text)
        if err:
            SKIPPED.append(f"{name}: {err}")
            log(f"skipped {name}: {err}")
            continue
        if name.endswith(".nowrap.css"):
            parts.append(f"/* {name} */\n{text}")
        else:
            for bad in ("@keyframes", "@font-face", "@import", "@property"):
                if bad in text:
                    log(f"warning: {name} uses {bad}; move it to a *.nowrap.css file")
            parts.append(f"/* {name} */\nhtml.lgs-on {{\n{text}\n}}")
    try:
        with open(DIAL, encoding="utf-8") as f:
            dial = min(1.0, max(0.0, float(f.read().strip())))
        parts.append(f"html.lgs-on {{ --lgs-dial: {dial:g}; }}")
    except (OSError, ValueError):
        pass
    return "\n\n".join(parts)


def core_call(payload):
    with open(os.path.join(HERE, "lgs_index.js"), encoding="utf-8") as f:
        index_js = f.read()
    with open(os.path.join(HERE, "lgs_lens.js"), encoding="utf-8") as f:
        lens_js = f.read()
    with open(os.path.join(HERE, "lgs_core.js"), encoding="utf-8") as f:
        core_js = f.read().strip().rstrip(";")
    return (f"(() => {{\n{index_js}\n{lens_js}\n"
            f"return ({core_js})({json.dumps(payload)}, lgsBuildIndex, lgsLens);\n}})()")


def op(name, quiet=False, text=None, vr=False, native=None):
    """Run one operation on the Steam UI; with vr=True also on the native glass
    layer and SteamVR's pages: on starts the transient unit lgs-shell (SteamVR
    page theming; the native glass layer only with native=True, see
    lgs_shell.start), off stops it and strips the pages."""
    shell_off = None
    if vr and name == "off":
        # Native layer first, so Steam's own panels are back before the CSS goes.
        try:
            import lgs_shell
            shell_off = lgs_shell.stop()
        except Exception as e:  # noqa: BLE001 - best effort
            shell_off = f"error: {e}"
    payload = {"op": name, "quiet": quiet}
    if name == "on":
        css, svg = bundle()
        lens = []
        lens_file = os.path.join(THEME_DIR, "lens.json")
        if os.path.exists(lens_file):
            try:
                with open(lens_file, encoding="utf-8") as f:
                    lens = json.load(f)
            except ValueError as e:
                log(f"lens.json ignored: {e}")
        payload.update(css=css, svg=svg, lens=lens,
                       version=hashlib.sha1((css + svg + json.dumps(lens)).encode()).hexdigest()[:10])
    if text:
        payload["text"] = text
    res = run_js("SharedJSContext", core_call(payload), timeout=60)
    res = json.loads(res) if isinstance(res, str) and res.startswith("{") else res
    if name == "on" and isinstance(res, dict) and SKIPPED:
        res["skipped"] = list(SKIPPED)
    if vr and name in ("on", "off", "status") and isinstance(res, dict):
        try:
            import lgs_shell
            import lgs_vr
            if name == "on":
                res["shell"] = lgs_shell.start(native=native)
            elif name == "off":
                res["shell"] = shell_off
                lgs_vr.strip()
                res["steamvr"] = "stripped"
            else:
                res["shell"] = lgs_shell.brief(lgs_shell.status())
                res["steamvr"] = lgs_vr.status()
        except Exception as e:  # noqa: BLE001 - SteamVR side is best effort
            res["shell"] = f"error: {e}"
    return res


def attribute(tokens):
    """Which theme files mention each unresolved token."""
    out = {}
    for path in sorted(glob.glob(os.path.join(THEME_DIR, "*.css"))):
        with open(path, encoding="utf-8") as f:
            text = f.read()
        for t in tokens:
            if "%{" + t + "}" in text:
                out.setdefault(t, []).append(os.path.basename(path))
    return out


def is_on():
    st = op("status")
    return bool(st and st.get("enabled"))


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    quiet = "--quiet" in argv
    native = True if "--native" in argv else (False if "--css" in argv else None)
    cmd = args[0] if args else "toggle"
    if cmd in ("-h", "help"):
        print(__doc__)
        return 0
    try:
        if cmd == "toggle":
            cmd = "off" if is_on() else "on"
        if cmd == "reload":
            cmd, quiet = "on", True
        if cmd == "dial":
            v = min(1.0, max(0.0, float(args[1])))
            with open(DIAL, "w", encoding="utf-8") as f:
                f.write(f"{v:g}\n")
            res = op("on", quiet=True, vr=True) if is_on() else {"dial": v, "enabled": False}
            if isinstance(res, dict) and res.get("enabled"):
                op("toast", text=f"Glass  ·  {round((1 - v) * 100)}% clear")
        elif cmd == "toast":
            res = op("toast", text=" ".join(args[1:]) or "Liquid Glass")
        elif cmd in ("on", "off", "status"):
            res = op(cmd, quiet=quiet, vr=True, native=native if cmd == "on" else None)
        else:
            print(__doc__)
            return 2
    except Exception as e:  # launched from the Steam UI: leave a trail
        log(f"{cmd} failed: {e!r}")
        print(f"lgs: {cmd} failed: {e}", file=sys.stderr)
        return 1
    log(f"{cmd}: {json.dumps(res)[:300]}")
    print(json.dumps(res, indent=1) if isinstance(res, (dict, list)) else res)
    if isinstance(res, dict) and (res.get("unresolved") or res.get("ambiguous")):
        bad = res.get("unresolved", []) + res.get("ambiguous", [])
        where = attribute(bad)
        print(f"lgs: {len(res.get('unresolved', []))} unresolved / "
              f"{len(res.get('ambiguous', []))} ambiguous theme tokens:", file=sys.stderr)
        for t in bad:
            print(f"  %{{{t}}}  in {', '.join(where.get(t, ['?']))}", file=sys.stderr)
    if isinstance(res, dict) and res.get("skipped"):
        print("lgs: SKIPPED broken stylesheets: " + "; ".join(res["skipped"]), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
