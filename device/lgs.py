#!/usr/bin/env python3
"""Liquid Glass Shell for the Steam Frame.

Turns the Liquid Glass theme for the Frame's Steam VR interface (gamepadui
dashboard, bar, popups, keyboard, toasts) on or off. The theme is injected
into the running Steam client over its local devtools socket and is never
written anywhere persistent: restarting Steam or rebooting restores stock.

usage: lgs [toggle|on|off|reload|status|dial 0..1|toast TEXT|flags ...|check]
           [--quiet] [--native|--css] [--flags a,b=v] [--no-rt]

  toggle   on if off, off if on (what the "+ > Launch Program" entry runs)
  on       inject (or re-inject) the theme, then load the runtime (device/rt,
           docs/phase2/contracts/runtime.md). --native also runs the native
           glass layer (glassd, scene-graph depth; docs/NATIVE.md) for this
           session; --css switches a running native layer back off. Without
           either, native is "auto": device/defaults.json decides.
           --flags a,b=v  runtime flags for this "on" only (layer "cli")
           --no-rt        CSS theme only (Phase 1 behaviour)
  off      remove every trace of it: runtime modules (reverse order), the
           theme, the native layer, SteamVR page theming, /tmp/lgs/flags.json.
           Prints a cleanup report (runtime.patchedLeft, leftovers)
  reload   re-read theme/*.css and the runtime and swap them in without a toast
  status   print what is applied, module states, and any theme tokens that
           did not resolve
  dial V   transparency dial, 0 = clearest .. 1 = most opaque (default 0.5);
           remembered for the next "on", applied now if the theme is on
  flags    print the effective runtime flags and where each comes from
  flags a=1 b=off c=   set (or with "c=" unset) session flags in
           /tmp/lgs/flags.json (RAM) and apply them live; --reset clears them
  check    offline bundle check (no device needed; also runs on the PC):
           braces, .nowrap at-rules, %{token} syntax, JSON fragments, JS syntax
           (node --check when node is installed). Exit 1 when broken
  selftest [RT-1,RT-2,...]  the P1 acceptance tests on the live UI, inside the
           lab lock (docs/phase2/wp/P1.md)
"""
import asyncio
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.realpath(__file__))
ROOT = os.path.dirname(HERE) if os.path.basename(HERE) == "device" else HERE
THEME_DIR = os.path.join(ROOT, "theme")
RT_DIR = os.path.join(HERE, "rt")
SHARED_DIR = os.path.join(HERE, "shared")
DEFAULTS = os.path.join(HERE, "defaults.json")      # V1's shipped flag defaults
FLAGS_FILE = "/tmp/lgs/flags.json"                  # session overrides (RAM)
CDP = "http://127.0.0.1:8080"
LOG = "/tmp/lgs/lgs.log"
LOG_MAX = 512 * 1024   # /tmp is RAM: keep the log and one older copy (lgs.log.1)
DIAL = os.path.join(ROOT, "dial")

# PLAN §1.17 sign-off register: built-in flag defaults, used when
# device/defaults.json (V1) does not set a flag. "On (gated)" flags stay off
# here; V1 turns them on in defaults.json once their test passes.
BUILTIN_FLAGS = {
    "rt": True,                 # runtime master switch (false = CSS theme only)
    "native": "auto",           # S1: auto | on | off
    "interactivePops": False,   # S2
    "sheetRecede": False,       # S7
    "frameHeight": False,       # S8
    "tabBarAlways": False,      # S9 (gated)
    "winbarMove": False,        # S10 (gated)
    "vrBindings": False,        # S13
    "ccPopup": False,           # S15
    "pointerProxy": "native",   # S16: native | on | off
    "haptics": False,           # S17
    "hudPlacement": False,      # S21
    "storeOrnament": False,     # S22 (gated)
    "settingsDrill": False,     # S23 (gated)
    "rt.stubs": False,          # P1 test stubs (RT-1, RT-3, RT-4)
    "rt.stubThrow": False,      # P1 failing stub (RT-2)
}


def visible_files(directory, suffix):
    """Files of one folder (not recursive) in name order, skipping work in
    progress: names starting with "_" or "." (so _wip/ folders and their
    contents never load), editor backups ("~", "#")."""
    try:
        names = sorted(os.listdir(directory))
    except OSError:
        return []
    out = []
    for n in names:
        p = os.path.join(directory, n)
        if n.startswith(("_", ".", "#")) or n.endswith("~") or not n.endswith(suffix) or not os.path.isfile(p):
            continue
        out.append(p)
    return out


def theme_css_files():
    return visible_files(THEME_DIR, ".css")


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
    css = bundle_files(theme_css_files())
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


# ---------------------------------------------------------------- flags

def read_json_file(path):
    try:
        with open(path, encoding="utf-8") as f:
            v = json.load(f)
        return v if isinstance(v, dict) else {}
    except (OSError, ValueError):
        return {}


def flag_layers(cli=None):
    """The flag layers, lowest first: builtin (this file), defaults
    (device/defaults.json, V1; its optional "flags" object or the top level),
    session (/tmp/lgs/flags.json), cli (lgs on --flags)."""
    d = read_json_file(DEFAULTS)
    if isinstance(d.get("flags"), dict):
        d = d["flags"]
    d = {k: v for k, v in d.items() if not k.startswith(("_", "$"))}   # comments
    return {"builtin": dict(BUILTIN_FLAGS), "defaults": d,
            "session": read_json_file(FLAGS_FILE), "cli": dict(cli or {})}


def flags_effective(cli=None):
    """Merged flags without test overlays (for Python callers such as the daemon)."""
    out = {}
    for layer in flag_layers(cli).values():
        out.update(layer)
    return out


def parse_flag_value(name, v):
    """CLI text -> value. Flags whose built-in default is a string (native,
    pointerProxy) keep the text; others: on/off/true/false/1/0/yes/no are
    booleans, then JSON (numbers, "quoted"), else the text."""
    if isinstance(BUILTIN_FLAGS.get(name), str):
        return v
    lv = v.strip().lower()
    if lv in ("1", "true", "on", "yes"):
        return True
    if lv in ("0", "false", "off", "no"):
        return False
    try:
        return json.loads(v)
    except ValueError:
        return v


def parse_flag_list(text):
    """"a,b=2,c=off" -> {"a": True, "b": 2, "c": False}."""
    out = {}
    for part in (text or "").split(","):
        part = part.strip()
        if not part:
            continue
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = parse_flag_value(k.strip(), v)
        else:
            out[part] = True
    return out


def write_session_flags(obj):
    os.makedirs(os.path.dirname(FLAGS_FILE), exist_ok=True)
    if not obj:
        try:
            os.remove(FLAGS_FILE)
        except OSError:
            pass
        return
    tmp = f"{FLAGS_FILE}.{os.getpid()}"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=1, sort_keys=True)
    os.replace(tmp, FLAGS_FILE)


def truthy(v):
    if v in (None, False, 0, ""):
        return False
    return not (isinstance(v, str) and v.strip().lower() in ("off", "false", "no", "0", "none"))


# ---------------------------------------------------------------- runtime loader

def rt_sources():
    """(label, path) of every runtime file in load order: 00-rt.js (the core)
    first, then device/shared/*.js, then device/rt/NN-*.js in name order.
    _wip/ folders, "_" and "." files are skipped (visible_files)."""
    core = os.path.join(RT_DIR, "00-rt.js")
    out = [("rt/00-rt.js", core)] if os.path.isfile(core) else []
    out += [("shared/" + os.path.basename(p), p) for p in visible_files(SHARED_DIR, ".js")]
    out += [("rt/" + os.path.basename(p), p) for p in visible_files(RT_DIR, ".js")
            if os.path.basename(p) != "00-rt.js"]
    return out


RT_DATA_DIRS = ("popups",)   # theme/<dir>/*.json -> rt.data('<dir>') (P6: popup wrapper fragments)


def rt_data():
    """{dir: [fragment, ...]} for RT_DATA_DIRS, name order, _wip skipped; each
    fragment object gets "file": its name. Invalid files are left out and
    reported as (label, error)."""
    out, errors = {}, []
    for d in RT_DATA_DIRS:
        out[d] = []
        for p in visible_files(os.path.join(THEME_DIR, d), ".json"):
            label = f"theme/{d}/{os.path.basename(p)}"
            try:
                with open(p, encoding="utf-8") as f:
                    v = json.load(f)
            except (OSError, ValueError) as e:
                errors.append((label, f"invalid JSON: {e}"))
                continue
            if isinstance(v, dict):
                v = dict(v, file=os.path.basename(p))
            out[d].append(v)
    return out, errors


def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def rt_module_js(label, src):
    """Wrap one module file: its define() calls are attributed to it, its own
    top-level names stay local, and a throw marks only this file failed."""
    if label.startswith("shared/"):
        name = os.path.splitext(os.path.basename(label))[0]
        return ("(function () {\n const __rt = window.__LGS_RT;\n"
                " const module = { exports: {} }; const exports = module.exports;\n"
                f" __rt._loading({json.dumps(label)});\n try {{\n"
                f"{src}\n;\n __rt._shared({json.dumps(name)}, module.exports);\n"
                f" }} catch (e) {{ __rt._fail({json.dumps(label)}, e); }} finally {{ __rt._loading(null); }}\n"
                f"}}).call(window);\n//# sourceURL=lgs/{label}")
    return ("(function () {\n const __rt = window.__LGS_RT;\n"
            f" __rt._loading({json.dumps(label)});\n try {{\n"
            f"{src}\n;\n"
            f" }} catch (e) {{ __rt._fail({json.dumps(label)}, e); }} finally {{ __rt._loading(null); }}\n"
            f"}}).call(window);\n//# sourceURL=lgs/{label}")


RT_TEARDOWN_JS = ("(async () => { const r = window.__LGS_RT; if (!r || typeof r.teardown !== 'function') return null;"
                  " let carry = null; try { carry = r.test && r.test.carry ? r.test.carry() : null; } catch (_) {}"
                  " const rep = await r.teardown(%s); rep.carry = carry; return JSON.stringify(rep); })()")

# Test hooks (a lab step's flags, action logger, input stub) carried from one
# runtime to the next within this process: the lab's "--theme off/on" inside a
# locked step must not drop the step's --flags. Never across processes.
_TEST_CARRY = {"t": 0, "state": None}
CARRY_MAX_S = 600


async def rt_teardown(s, reason):
    v = await s.eval(RT_TEARDOWN_JS % json.dumps(reason), 30)
    rep = json.loads(v) if isinstance(v, str) else v
    if isinstance(rep, dict):
        carry = rep.pop("carry", None)
        if carry and (carry.get("flags") or carry.get("actions") or carry.get("input")):
            _TEST_CARRY.update(t=time.time(), state=carry)
    return rep


def _carried():
    st = _TEST_CARRY["state"]
    if not st:
        return None
    age = (time.time() - _TEST_CARRY["t"]) * 1000
    out = {"flags": [dict(f, ms=f["ms"] - age) for f in st.get("flags") or [] if f.get("ms", 0) - age > 1000],
           "actions": max(0, (st.get("actions") or 0) - age), "actionLog": st.get("actionLog") or [],
           "input": None}
    inp = st.get("input")
    if inp and inp.get("ms", 0) - age > 1000:
        out["input"] = dict(inp, ms=inp["ms"] - age)
    return out


_RT_EXTRA = []   # [(label, source)] extra module sources: selftest fixtures only (RT-2)


async def rt_load(s, cli_flags=None, version=None):
    """Boot 00-rt.js, load every module file (one evaluation each, so a syntax
    error fails only that file), then start(). Returns a short summary."""
    files = rt_sources()
    if not files or files[0][0] != "rt/00-rt.js":
        return {"runtime": "off", "reason": "device/rt/00-rt.js is missing"}
    layers = flag_layers(cli_flags)
    data, data_errors = rt_data()
    cfg = {"builtin": layers["builtin"], "defaults": layers["defaults"], "session": layers["session"],
           "cli": layers["cli"], "version": version, "files": [f for f, _ in files], "data": data,
           "test": _carried()}
    _TEST_CARRY.update(t=0, state=None)
    t0 = time.time()
    boot = (f"(() => {{\nconst __LGS_RT_CONFIG = {json.dumps(cfg)};\n{_read(files[0][1])}\n}})()\n"
            "//# sourceURL=lgs/rt/00-rt.js")
    await s.eval(boot, 20)
    if not await s.eval("!!(window.__LGS_RT && window.__LGS_RT.define)", 10):
        return {"runtime": "off", "reason": "00-rt.js did not define __LGS_RT"}
    for label, msg in data_errors:
        await s.eval(f"window.__LGS_RT._fail({json.dumps(label)}, {json.dumps(msg)})", 10)
    todo = [(label, path, None) for label, path in files[1:]] + [(label, None, src) for label, src in _RT_EXTRA]
    for label, path, src in todo:
        if src is None:
            try:
                src = _read(path)
            except OSError as e:
                await s.eval(f"window.__LGS_RT._fail({json.dumps(label)}, {json.dumps('unreadable: ' + str(e))})", 10)
                continue
        try:
            await s.eval(rt_module_js(label, src), 20)
        except RuntimeError as e:  # a syntax error: the wrapper never ran
            msg = str(e)[:600]
            log(f"rt: {label} failed to load: {msg}")
            await s.eval(f"window.__LGS_RT._fail({json.dumps(label)}, {json.dumps(msg)})", 10)
    st = await s.eval("(async () => JSON.stringify(await window.__LGS_RT.start()))()", 45)
    st = json.loads(st) if isinstance(st, str) else (st or {})
    return rt_summary(st, round((time.time() - t0) * 1000))


def rt_summary(st, ms=None):
    mods = st.get("modules") or []
    out = {"runtime": st.get("runtime"),
           "modules": {m["name"]: m["state"] for m in mods},
           "installed": sum(1 for m in mods if m["state"] == "installed")}
    bad = [f"{m['name']}: {(m.get('error') or '').splitlines()[0][:160]}" for m in mods if m["state"] == "failed"]
    bad += [f"{f.get('file')}: {(f.get('error') or '').splitlines()[0][:160] if f.get('error') else ''}"
            for f in st.get("failedLoads") or []]
    if bad:
        out["failed"] = bad
    if st.get("flagsSet"):
        out["flagsSet"] = st["flagsSet"]
    if ms is not None:
        out["loadMs"] = ms
    return out


SWEEP_JS = r"""(() => {
  const RX = /^_*lgs/i;
  const out = { windows: {}, globals: [], clean: true };
  try { out.globals = Object.getOwnPropertyNames(window).filter((k) => RX.test(k)); } catch (_) { /* proxy */ }
  let pops = [];
  try { pops = [...g_PopupManager.m_mapPopups.values()]; } catch (_) { /* none */ }
  for (const p of pops) {
    let w = null;
    try { w = p.window; if (!w || !w.document || !w.document.documentElement) continue; } catch (_) { continue; }
    const cls = new Set(), attrs = new Set(), ids = new Set();
    let n = 0;
    const els = [w.document.documentElement, ...w.document.documentElement.querySelectorAll('*')];
    for (const el of els) {
      let hit = false;
      for (const c of el.classList) if (c.startsWith('lgs-') || c === 'lgs') { cls.add(c); hit = true; }
      for (const a of el.getAttributeNames()) if (a.startsWith('data-lgs')) { attrs.add(a); hit = true; }
      if (el.id && /^lgs[-_]/.test(el.id)) { ids.add(el.id); hit = true; }
      if (hit) n++;
    }
    const g = [];
    try { for (const k of Object.getOwnPropertyNames(w)) if (/^__LGS/.test(k)) g.push(k); } catch (_) { /* cross-realm */ }
    if (n || g.length) {
      out.clean = false;
      out.windows[String(p.m_strName || '?').replace(/_uid\d+$/, '')] =
        { elements: n, classes: [...cls], attrs: [...attrs], ids: [...ids], globals: g };
    }
  }
  if (out.globals.includes('__LGS_RT') || out.globals.includes('__LGS')) out.clean = false;
  return JSON.stringify(out);
})()"""


async def _session(fn):
    async with Session(find_target("SharedJSContext")["webSocketDebuggerUrl"]) as s:
        return await fn(s)


def _jsonish(v):
    return json.loads(v) if isinstance(v, str) and v[:1] in ("{", "[") else v


def _shell_start(native):
    """Start lgs-shell with native = "on" | "off" | "auto" | None (keep a
    running unit as it is: reload, dial). P8's start() takes the strings when it
    declares NATIVE_MODES; until then "auto" maps to defaults.json's native."""
    import lgs_shell
    mode = {True: "on", False: "off"}.get(native, native)
    modes = getattr(lgs_shell, "NATIVE_MODES", None)
    if mode is None:
        return lgs_shell.start(native=None)
    if modes and mode in modes:
        return lgs_shell.start(native=mode)
    if mode == "auto":
        d = flag_layers()["defaults"].get("native")
        return lgs_shell.start(native=True if d in (True, "on") else None)
    return lgs_shell.start(native=(mode == "on"))


def op(name, quiet=False, text=None, vr=False, native=None, flags=None, rt=None):
    """Run one operation on the Steam UI; with vr=True also on the native glass
    layer and SteamVR's pages: on starts the transient unit lgs-shell (SteamVR
    page theming; the native glass layer per `native`, see _shell_start), off
    stops it and strips the pages.

    on also (re)loads the runtime (device/rt) after the CSS unless rt=False or
    the flag "rt" is off; flags = {name: value} is the "cli" flag layer. If the
    runtime fails to load, the CSS theme stays on and res["runtime"] says why.
    off removes the runtime modules first and adds a cleanup report."""
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

    async def go(s):
        out = {}
        if name in ("on", "off"):
            try:
                out["rt_off"] = await rt_teardown(s, "off" if name == "off" else "reload")
            except Exception as e:  # noqa: BLE001 - the theme must still switch
                out["rt_off"] = {"error": str(e)[:300]}
        out["res"] = _jsonish(await s.eval(core_call(payload), 60))
        if name == "on":
            want = rt if rt is not None else truthy(flags_effective(flags).get("rt", True))
            if not want:
                out["runtime"] = {"runtime": "off", "reason": "flag rt is off" if rt is None else "--no-rt"}
            else:
                try:
                    out["runtime"] = await rt_load(s, flags, payload.get("version"))
                except Exception as e:  # noqa: BLE001 - fallback: CSS theme only (Phase 1)
                    log(f"rt: load failed, CSS only: {e!r}")
                    try:
                        await rt_teardown(s, "load failed")
                    except Exception:  # noqa: BLE001
                        pass
                    out["runtime"] = {"runtime": "off", "reason": f"loader failed: {str(e)[:300]}"}
        elif name == "off":
            out["sweep"] = _jsonish(await s.eval(SWEEP_JS, 30))
        elif name == "status":
            out["runtime"] = _jsonish(await s.eval(
                "window.__LGS_RT ? JSON.stringify(window.__LGS_RT.status({counts: true})) : null", 15))
        return out

    o = asyncio.run(_session(go))
    res = o["res"]
    if isinstance(res, dict):
        if name == "on":
            res["runtime"] = o.get("runtime")
            if SKIPPED:
                res["skipped"] = list(SKIPPED)
        elif name == "off":
            rep = o.get("rt_off")
            res["runtime"] = rep if rep else {"runtime": "was off"}
            res["leftovers"] = o.get("sweep")
        elif name == "status":
            res["runtime"] = o.get("runtime") or {"runtime": "off"}
    if vr and name in ("on", "off", "status") and isinstance(res, dict):
        try:
            import lgs_shell
            import lgs_vr
            if name == "on":
                res["shell"] = _shell_start(native)
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


def flags_cmd(args):
    """lgs flags [--reset] [name=value ...]"""
    session = read_json_file(FLAGS_FILE)
    changed = False
    if "--reset" in args:
        session, changed = {}, True
    for a in args:
        if a.startswith("--") or "=" not in a:
            continue
        k, v = a.split("=", 1)
        k = k.strip()
        if v == "" or v == "default":
            session.pop(k, None)
        else:
            session[k] = parse_flag_value(k, v)
        changed = True
    if changed:
        write_session_flags(session)
    layers = flag_layers()
    eff, src = {}, {}
    for lname, layer in layers.items():
        for k, v in layer.items():
            eff[k], src[k] = v, lname
    res = {"flags": {k: {"value": eff[k], "from": src[k]} for k in sorted(eff)},
           "file": FLAGS_FILE if os.path.exists(FLAGS_FILE) else None}
    try:
        live = run_js("SharedJSContext", (
            "(async () => { const r = window.__LGS_RT; if (!r) return null;"
            + (f" r.flags.setSession({json.dumps(session)}); await r.settled();" if changed else "")
            + " return JSON.stringify({running: true, test: r.test.flags.list(),"
              " modules: r.status().modules.map((m) => m.name + ': ' + m.state)}); })()"), 30)
        res["live"] = _jsonish(live) or {"running": False}
        if changed and isinstance(res["live"], dict) and res["live"].get("running") \
                and not truthy(eff.get("rt", True)):
            res["live"]["teardown"] = asyncio.run(_session(lambda s: rt_teardown(s, "flag rt off")))
    except Exception as e:  # noqa: BLE001 - Steam not reachable: the file is still set
        res["live"] = f"not applied live: {e}"
    return res


# ---------------------------------------------------------------- offline check

def _css_scan(text):
    """Comment- and string-free CSS text, plus top-level statements (depth 0
    text ending in ';' outside any block)."""
    out, top, cur = [], [], []
    depth, i, n = 0, 0, len(text)
    while i < n:
        c = text[i]
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            i = n if j < 0 else j + 2
            out.append(" ")
            continue
        if c in "\"'":
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == "\\" else 1
            out.append('""')
            if depth == 0:
                cur.append('""')
            i = j + 1
            continue
        if c == "{":
            depth += 1
            cur = []
        elif c == "}":
            depth = max(0, depth - 1)
            cur = []
        elif depth == 0:
            if c == ";":
                stmt = "".join(cur).strip()
                if stmt:
                    top.append(stmt)
                cur = []
            else:
                cur.append(c)
        out.append(c)
        i += 1
    return "".join(out), top


AT_NOWRAP = re.compile(r"@(-webkit-)?(keyframes|font-face|import|property)\b")


def check(root=None, node=True):
    """Offline bundle check. Returns {"ok", "errors": [...], "warnings": [...],
    "checked", "skippedWip"}; each problem is "path: message"."""
    root = root or ROOT
    theme = os.path.join(root, "theme")
    dev = os.path.join(root, "device")
    errors, warnings, skipped = [], [], []
    checked = 0

    def rel(p):
        return os.path.relpath(p, root).replace("\\", "/")

    def note_wip(d):
        try:
            for n in sorted(os.listdir(d)):
                if n.startswith("_") and os.path.isdir(os.path.join(d, n)):
                    for dp, _, fs in os.walk(os.path.join(d, n)):
                        skipped.extend(rel(os.path.join(dp, f)) for f in fs)
        except OSError:
            pass

    css_files = visible_files(theme, ".css") + visible_files(os.path.join(theme, "vr"), ".css")
    note_wip(theme)
    note_wip(os.path.join(theme, "vr"))
    for p in css_files:
        checked += 1
        try:
            text = _read(p)
        except (OSError, UnicodeDecodeError) as e:
            errors.append(f"{rel(p)}: unreadable ({e})")
            continue
        err = brace_error(text)
        if err:
            errors.append(f"{rel(p)}: {err} (the bundler skips this file)")
            continue
        clean, top = _css_scan(text)
        nowrap = p.endswith(".nowrap.css")
        if not nowrap:
            for m in AT_NOWRAP.finditer(clean):
                line = clean.count("\n", 0, m.start()) + 1
                errors.append(f"{rel(p)}:{line}: {m.group(0)} only works in a *.nowrap.css file")
        else:
            for stmt in top:
                if not stmt.startswith("@"):
                    errors.append(f"{rel(p)}: declaration outside any rule in a .nowrap file: {stmt[:60]!r}")
        for m in re.finditer(r"%\{([^}]*)\}", clean):
            tok = m.group(1).strip()
            if not tok or not re.match(r"^\*?[\w+\- >]+$", tok):
                line = clean.count("\n", 0, m.start()) + 1
                errors.append(f"{rel(p)}:{line}: malformed token %{{{m.group(1)}}}")
    json_files = [os.path.join(theme, "layers.json"), os.path.join(theme, "lens.json"),
                  os.path.join(dev, "defaults.json")]
    for sub in ("layers", "popups", "sg"):
        json_files += visible_files(os.path.join(theme, sub), ".json")
        note_wip(os.path.join(theme, sub))
    for p in json_files:
        if not os.path.isfile(p):
            continue
        checked += 1
        try:
            with open(p, encoding="utf-8") as f:
                json.load(f)
        except (OSError, ValueError) as e:
            errors.append(f"{rel(p)}: invalid JSON ({e})")
    js_files = []
    for sub in ("rt", "shared", "vr"):
        js_files += visible_files(os.path.join(dev, sub), ".js")
        note_wip(os.path.join(dev, sub))
    node_bin = shutil.which("node") if node else None
    names = {}
    for p in js_files:
        checked += 1
        base = os.path.basename(p)
        is_rt = os.path.basename(os.path.dirname(p)) == "rt"
        try:
            src = _read(p)
        except (OSError, UnicodeDecodeError) as e:
            errors.append(f"{rel(p)}: unreadable ({e})")
            continue
        if node_bin:
            r = subprocess.run([node_bin, "--check", p], capture_output=True, text=True)
            if r.returncode != 0:
                lines = [ln for ln in (r.stderr or r.stdout).splitlines() if ln.strip()]
                msg = next((ln for ln in lines if "Error" in ln), lines[-1] if lines else "syntax error")
                m = re.match(r".*:(\d+)\s*$", lines[0]) if lines else None
                errors.append(f"{rel(p)}" + (f":{m.group(1)}" if m else "") + f": {msg.strip()}")
        if is_rt and base != "00-rt.js":
            if not re.match(r"^\d\d-[\w.-]+\.js$", base):
                warnings.append(f"{rel(p)}: runtime files are named NN-name.js")
            if "__LGS_RT.define(" not in src.replace(" ", "") and "define(" not in src:
                warnings.append(f"{rel(p)}: never calls __LGS_RT.define(); it will load but install nothing")
            for m in re.finditer(r"define\(\s*\{\s*name\s*:\s*['\"]([^'\"]+)['\"]", src):
                if m.group(1) in names:
                    errors.append(f"{rel(p)}: module name {m.group(1)!r} is also defined in {names[m.group(1)]}")
                names[m.group(1)] = rel(p)
    if js_files and not node_bin:
        warnings.append("node not found: JS syntax not checked (the runtime loader still isolates a broken file)")
    return {"ok": not errors, "errors": errors, "warnings": warnings, "checked": checked,
            "skippedWip": skipped, "node": bool(node_bin)}


# ---------------------------------------------------------------- selftest (P1 acceptance tests)
#
# python3 device/lgs.py selftest [RT-1,RT-3,...] [--json]
# Runs on the Frame. Every test takes the lab lock (lab/lab.py Lock: menus the
# step opened are closed at its exit) for a few seconds only, and leaves the UI
# as it found it: theme on, runtime loaded with the session's flags, CSS-only
# native state untouched, the route restored. Results: stdout and
# /tmp/lgs/p1-selftest.json.

SELFTEST_OUT = "/tmp/lgs/p1-selftest.json"
# Globals that are not the runtime's: the class-index cache (inert data), the lab's
# helpers and step state, and the daemon's inert CDP binding (NATIVE.md).
EXPECTED_GLOBALS = re.compile(r"^(__LGS_(INDEX|LAB\w*|MARK|AUDIT|INV\w*)|lgsLayers|lgsAction)$")
# Leftovers that are the runtime's or the CSS core's (fail RT-1 / RT-4a); any other
# unexpected global belongs to another package and is reported as "foreign".
RUNTIME_GLOBALS = re.compile(r"^__LGS(_RT\w*)?$")

COUNTS_JS = r"""JSON.stringify((() => {
  const n = (x) => { try { x = x && x.m_vecCallbacks ? x.m_vecCallbacks : x; return Array.isArray(x) ? x.length : null; } catch (_) { return null; } };
  const pm = g_PopupManager; let nav = null;
  try { nav = n(FocusNavController.NavigationSource.m_callbacks); } catch (_) { /* not in VR */ }
  return { popupCreated: n(pm.m_rgPopupCreatedCallbacks), popupDestroyed: n(pm.m_rgPopupDestroyedCallbacks), navigationSource: nav };
})())"""

# Evaluated in each popup's own devtools target, where getEventListeners works.
LISTENERS_JS = r"""JSON.stringify((() => {
  const out = {};
  for (const [name, t] of [['window', window], ['document', document], ['html', document.documentElement], ['body', document.body]]) {
    try { const L = getEventListeners(t); for (const k in L) out[name + ':' + k] = L[k].length; } catch (e) { out[name] = 'n/a'; }
  }
  return out;
})())"""

CLASS_SWEEP_JS = r"""JSON.stringify((() => {
  const out = {};
  for (const p of g_PopupManager.m_mapPopups.values()) {
    let w; try { w = p.window; if (!w || !w.document || !w.document.documentElement) continue; } catch (_) { continue; }
    const h = w.document.documentElement;
    out[String(p.m_strName).replace(/_uid\d+$/, '').replace('valve.steam.gamepadui.', '').replace(/(\.\d+)+$/, '')] =
      { classes: [...h.classList].filter((c) => c.startsWith('lgs')), stub: h.getAttribute('data-lgs-rt-stub'),
        style: !!w.document.getElementById('lgs-theme'), visible: w.document.visibilityState };
  }
  return out;
})())"""


def _st_js(expr, timeout=30):
    return _jsonish(run_js("SharedJSContext", expr, timeout))


def _st_eval_cli(expr, timeout=30, surfaces=("main", "bar", "barpopup")):
    """DOM listener counts per surface, evaluated in each popup's own target with
    the DevTools command-line API (getEventListeners)."""
    async def one(t):
        async with Session(t["webSocketDebuggerUrl"]) as s:
            r = await s.send("Runtime.evaluate", {"expression": expr, "returnByValue": True,
                                                  "includeCommandLineAPI": True}, timeout)
            if "exceptionDetails" in r:
                return "error"
            return _jsonish(r["result"].get("value"))
    out = {}
    for name in surfaces:
        try:
            out[name] = asyncio.run(one(find_target(name)))
        except (Exception, SystemExit) as e:  # noqa: BLE001 - a surface may be missing
            out[name] = f"n/a ({str(e)[:60]})"
    return out


def _st_status(**kw):
    return _st_js("window.__LGS_RT ? JSON.stringify(window.__LGS_RT.status(%s)) : null" % json.dumps(kw))


def _st_sig(st):
    return [(m["name"], m["state"]) for m in (st or {}).get("modules", [])]


def _st_shell_ok():
    try:
        import lgs_shell
        return lgs_shell.unit_active()
    except Exception:  # noqa: BLE001
        return None


def _st_restore(lab):
    """Theme on with the runtime (session flags only), the lgs-shell unit kept."""
    res = op("on", quiet=True)
    out = {"theme": bool(isinstance(res, dict) and res.get("enabled")),
           "runtime": (res.get("runtime") or {}).get("runtime") if isinstance(res, dict) else None}
    if _st_shell_ok() is False:
        try:
            out["shell"] = _shell_start(None)
        except Exception as e:  # noqa: BLE001
            out["shell"] = f"error: {e}"
    return out


def _foreign_globals(left):
    return [k for k in (left or {}).get("globals") or []
            if not EXPECTED_GLOBALS.match(k) and not RUNTIME_GLOBALS.match(k)]


def _leftover_problems(left):
    """Runtime/core problems in an "off" sweep: __LGS_RT or __LGS left, or any
    element still carrying an lgs-* class, data-lgs-* attribute or lgs- id.
    Other packages' globals are reported apart (_foreign_globals)."""
    probs = []
    if not isinstance(left, dict):
        return ["no sweep"]
    for k in left.get("globals") or []:
        if RUNTIME_GLOBALS.match(k):
            probs.append(f"global {k}")
    for name, w in (left.get("windows") or {}).items():
        g = [k for k in w.get("globals") or [] if not EXPECTED_GLOBALS.match(k)]
        if w.get("elements") or g:
            probs.append(f"{name}: {w.get('elements')} elements {w.get('classes')} {w.get('attrs')} {w.get('ids')} {g}")
    return probs


def st_rt1(lab, ctx):
    """lgs on / off three times with the three stub modules."""
    ons, offs, reports = [], [], []
    with lab.Lock():
        ctx["route"] = lab.lab_js("L.route()")
        op("on", quiet=True)     # warm-up: the current core and runtime replaced by this build
        op("off", quiet=True)
        offs.append({"counts": _st_js(COUNTS_JS), "listeners": _st_eval_cli(LISTENERS_JS)})
        for _ in range(3):
            r = op("on", quiet=True, flags={"rt.stubs": True})
            st = _st_status(counts=True)
            ons.append({"sig": _st_sig(st), "counts": _st_js(COUNTS_JS), "listeners": _st_eval_cli(LISTENERS_JS),
                        "installed": (r.get("runtime") or {}).get("installed")})
            off = op("off", quiet=True)
            reports.append(off)
            offs.append({"counts": _st_js(COUNTS_JS), "listeners": _st_eval_cli(LISTENERS_JS)})
        restore = _st_restore(lab)
    same_on = all(o["sig"] == ons[0]["sig"] and o["counts"] == ons[0]["counts"]
                  and o["listeners"] == ons[0]["listeners"] for o in ons)
    same_off = all(o["counts"] == offs[0]["counts"] and o["listeners"] == offs[0]["listeners"] for o in offs)
    stubs = dict(ons[0]["sig"])
    stubs_ok = all(stubs.get(n) == "installed" for n in ("rt.stub.a", "rt.stub.b", "rt.stub.c"))
    rep_ok = all((r.get("runtime") or {}).get("patchedLeft") == 0 and not (r.get("runtime") or {}).get("errors")
                 and not _leftover_problems(r.get("leftovers")) for r in reports)
    delta = {k: (ons[0]["counts"].get(k) or 0) - (offs[0]["counts"].get(k) or 0) for k in ons[0]["counts"]}
    ok = same_on and same_off and stubs_ok and rep_ok
    return ok, {"onStatusIdentical": same_on, "offCountsBackToBaseline": same_off, "stubsInstalled": stubs_ok,
                "reportsClean": rep_ok, "countsOff": offs[0]["counts"], "countsOn": ons[0]["counts"],
                "deltaOnOff": delta, "listenersOn": ons[0]["listeners"], "listenersOff": offs[0]["listeners"],
                "modules": ons[0]["sig"], "offReport": reports[-1].get("runtime"),
                "leftovers": [_leftover_problems(r.get("leftovers")) for r in reports],
                "foreignGlobals": _foreign_globals(reports[-1].get("leftovers")), "restore": restore}


def st_rt2(lab, ctx):
    """A stub module that throws in install(); plus a file with a syntax error and one that throws at load."""
    _RT_EXTRA[:] = [("rt/98-selftest-syntax.js", "const = ;"),
                    ("rt/99-selftest-loadthrow.js",
                     "__LGS_RT.define({name: 'selftest.loadthrow', install() {}}); throw new Error('selftest: load throws');")]
    try:
        with lab.Lock():
            op("on", quiet=True)
            base_sig = dict(_st_sig(_st_status()))
            r = op("on", quiet=True, flags={"rt.stubs": True, "rt.stubThrow": True})
            st = _st_status()
            sweep = _st_js(CLASS_SWEEP_JS)
            main = sweep.get("VR") or sweep.get("main") or {}
            restore = _st_restore(lab)
    finally:
        _RT_EXTRA[:] = []
    mods = {m["name"]: m for m in st.get("modules", [])}
    thr = mods.get("rt.stub.throw", {})
    loads = {f["file"]: f["error"] for f in st.get("failedLoads", [])}
    others_same = all(mods.get(n, {}).get("state") == state for n, state in base_sig.items()
                      if not n.startswith("rt.stub"))
    checks = {
        "stubThrowFailed": thr.get("state") == "failed" and "throws on purpose" in (thr.get("error") or ""),
        "stubsInstalled": all(mods.get(n, {}).get("state") == "installed" for n in ("rt.stub.a", "rt.stub.b", "rt.stub.c")),
        "syntaxFileFailed": "rt/98-selftest-syntax.js" in loads,
        "loadThrowFailed": "rt/99-selftest-loadthrow.js" in loads and mods.get("selftest.loadthrow", {}).get("state") == "failed",
        "otherModulesUnchanged": others_same,
        "cssOn": bool(main.get("style")) and "lgs-on" in (main.get("classes") or []),
        "throwStubClassGone": not any("lgs-rt-stub-throw" in (w.get("classes") or []) for w in sweep.values()),
        "runtimeRunning": st.get("runtime") == "running",
    }
    return all(checks.values()), {"checks": checks, "stubThrow": {k: thr.get(k) for k in ("state", "error")},
                                  "failedLoads": loads, "loadResult": r.get("runtime"), "restore": restore}


OPEN_PLUS_JS = r"""(async () => {
  const W = (ms) => new Promise((r) => setTimeout(r, ms));
  const inst = SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
  for (const p of inst.VRDashboardBarPopups) p.closePopup();
  await W(500);
  const before = __LGS_RT.status().windows;
  const el = L.q('bar', '%{AddWindowButton}');
  L.click('bar', '%{AddWindowButton}');
  el.dispatchEvent(new (L.surface('bar').MouseEvent)('mouseenter'));
  await W(900);
  const log = __LGS_RT.log.tail(60).filter((e) => e.mod === 'rt.stub.a').map((e) => e.msg);
  const bp = __LGS_RT.windows.byKind('barpopup').map((e) => ({ key: e.key, visible: e.visible(),
    cls: e.html.classList.contains('lgs-rt-stub'), attr: e.html.getAttribute('data-lgs-rt-stub') }));
  const nOpen = () => [...inst.VRDashboardBarPopups].filter((p) => { try { return p.BPopupOpen(); } catch (_) { return false; } }).length;
  const open = nOpen();
  for (const p of inst.VRDashboardBarPopups) p.closePopup();
  el.dispatchEvent(new (L.surface('bar').MouseEvent)('mouseleave'));
  await W(600);
  const hidden = __LGS_RT.windows.byKind('barpopup').every((e) => !e.visible());
  return JSON.stringify({ before, log, barpopup: bp, open, after: nOpen(), hidden });
})()"""


def st_rt3(lab, ctx):
    """Open the "+" popup (LAB OPEN recipe): the stub sees barpopup and its class is on its <html>."""
    with lab.Lock():
        op("on", quiet=True, flags={"rt.stubs": True})
        res = _jsonish(lab.lab_js(OPEN_PLUS_JS))
        restore = _st_restore(lab)
    bp = (res or {}).get("barpopup") or []
    log = (res or {}).get("log") or []
    checks = {
        "opened": (res or {}).get("open", 0) >= 1,
        "barpopupTracked": bool(bp),
        "stubClassOnBarpopup": bool(bp) and all(b["cls"] and b["attr"] == "barpopup" for b in bp),
        "onShowFired": any(m == "window shown: barpopup" for m in log),
        "closedAgain": (res or {}).get("after") == 0 and (res or {}).get("hidden") is True,
    }
    return all(checks.values()), {"checks": checks, "stubLog": log, "barpopup": bp,
                                  "onAddNote": "Steam pools bar popups: opening + shows the existing barpopup window "
                                               "(no popup-created callback; probe 2026-10-07), so the event is onShow; "
                                               "onAdd covers newly created windows (offline harness)",
                                  "restore": restore}


def st_rt4(lab, ctx):
    """lgs off, then a sweep of every popup: P1 stubs alone (a), then with every module flag on (b)."""
    out, ok = {}, True
    with lab.Lock():
        op("on", quiet=True)
        st0 = _st_status()
        all_flags = {m["flag"]: True for m in (st0 or {}).get("modules", []) if m.get("flag")}
        for name, flags in (("a", {"rt.stubs": True}), ("b", dict(all_flags, **{"rt.stubThrow": False}))):
            r_on = op("on", quiet=True, flags=flags)
            r = op("off", quiet=True)
            rt_rep = r.get("runtime") or {}
            probs = _leftover_problems(r.get("leftovers"))
            this_ok = rt_rep.get("patchedLeft") == 0 and not rt_rep.get("errors") and not probs \
                and not rt_rep.get("globalsLeft")
            out[name] = {"pass": this_ok, "flags": sorted(flags), "installed": (r_on.get("runtime") or {}).get("modules"),
                         "patchedLeft": rt_rep.get("patchedLeft"), "removed": rt_rep.get("removed"),
                         "errors": rt_rep.get("errors"), "globalsLeft": rt_rep.get("globalsLeft"),
                         "problems": probs, "foreignGlobals": _foreign_globals(r.get("leftovers")),
                         "globals": (r.get("leftovers") or {}).get("globals")}
            if name == "a":
                ok = ok and this_ok
        out["restore"] = _st_restore(lab)
    out["note"] = "pass/fail is RT-4a (P1); RT-4b sweeps every package's module with its flag on (integration)"
    return ok, out


def st_rt5(lab, ctx):
    """Lab --theme off step (a), and the liveness watch alone (b): runtime gone within 2.5 s."""
    out = {}
    with lab.Lock():
        op("on", quiet=True, flags={"rt.stubs": True})
        t0 = time.time()
        lab.set_theme("off")
        gone_a = None
        while time.time() - t0 < 4:
            if not _st_js("!!window.__LGS_RT"):
                gone_a = round(time.time() - t0, 2)
                break
            time.sleep(0.05)
        out["a"] = {"path": "lab.set_theme('off') -> lgs.op('off')", "goneAfterS": gone_a}
        lab.set_theme("on")
        op("on", quiet=True, flags={"rt.stubs": True})
        # The CSS core gone without telling the runtime: its 1.5 s sweep stopped (it would put the
        # class back) and html.lgs-on removed from main. __LGS.state.enabled stays true, so the
        # lgs-shell daemon does not see a theme-off. Only the liveness watch can act.
        # Timed in the page: from the class removal to __LGS_RT gone (10 ms poll).
        _st_js("(() => { clearInterval(window.__LGS.state.timer);"
               " const m = [...g_PopupManager.m_mapPopups.values()].find((p) => /^VR_uid/.test(p.m_strName));"
               " const t0 = performance.now(); m.window.document.documentElement.classList.remove('lgs-on');"
               " const iv = setInterval(() => { if (!window.__LGS_RT) { window.__LGS_P1_GONE = performance.now() - t0; clearInterval(iv); }"
               " else if (performance.now() - t0 > 6000) { window.__LGS_P1_GONE = -1; clearInterval(iv); } }, 10); return 1; })()")
        gone_b = None
        t0 = time.time()
        while time.time() - t0 < 8:
            v = _st_js("(() => { const v = window.__LGS_P1_GONE; if (v !== undefined) delete window.__LGS_P1_GONE; return v === undefined ? null : v; })()")
            if v is not None:
                gone_b = round(v / 1000, 3) if v >= 0 else None
                break
            time.sleep(0.2)
        stubs_left = _st_js(CLASS_SWEEP_JS)
        out["b"] = {"path": "html.lgs-on removed from main only (liveness watch)", "goneAfterS": gone_b,
                    "stubClassesLeft": [k for k, v in (stubs_left or {}).items() if "lgs-rt-stub" in (v.get("classes") or [])]}
        out["restore"] = _st_restore(lab)
    ok = gone_a is not None and gone_a <= 2.5 and gone_b is not None and gone_b <= 2.5 and not out["b"]["stubClassesLeft"]
    return ok, out


PERSIST_DIRS = ["~", "/tmp", "/var/tmp", "/dev/shm", "/run/user/%d" % (os.getuid() if hasattr(os, "getuid") else 1000)]
PERSIST_ALLOWED = [re.compile(p) for p in (r"^/tmp/lgs(/|$)", r"^/dev/shm/lgs(/|$)")]
PERSIST_KNOWN = [  # not written by Glass Shell: classified, listed, not failures
    (re.compile(r"^/run/user/\d+/systemd/"), "systemd runtime state of the transient unit (tmpfs, gone at reboot)"),
    (re.compile(r"^~/\.local/share/Steam/|^~/\.steam/"), "Steam's own files"),
    (re.compile(r"^/tmp/lgs-shots(/|$)"), "lab screenshots (P10, /tmp)"),
    (re.compile(r"^/tmp/(steam|\.X11|pulse|dumps|\.steam)"), "Steam / system"),
]


def _persist_scan(marker):
    home = os.path.expanduser("~")
    dirs = [os.path.expanduser(d) for d in PERSIST_DIRS if os.path.isdir(os.path.expanduser(d))]
    cmd = ["find"] + dirs + ["-xdev", "(", "-path", os.path.join(home, ".local/share/Steam/steamapps"),
                             "-o", "-path", os.path.join(home, ".cache"), ")", "-prune",
                             "-o", "-newer", marker, "-print"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    out = set()
    for line in r.stdout.splitlines():
        if line == marker:
            continue
        out.add(("~" + line[len(home):]) if line.startswith(home + "/") else line)
    return out


def st_rt6(lab, ctx):
    """Persistence scan after on/off (runtime cycles, plus one full CLI cycle when native.lock is free)."""
    import fcntl
    sys.dont_write_bytecode = True
    os.makedirs("/tmp/lgs", exist_ok=True)
    mark_c, mark_t = "/tmp/lgs/p1-mark-control", "/tmp/lgs/p1-mark-test"
    for m in (mark_c, mark_t):
        with open(m, "w"):
            pass
    syncl = open("/tmp/lgs/sync.lock", "a")
    fcntl.flock(syncl, fcntl.LOCK_SH)          # no sync while we look (ours use LOCK_SH too)
    native = open("/tmp/lgs/native.lock", "a")
    have_native = False
    try:
        # Control window: nothing of ours runs.
        os.utime(mark_c)
        time.sleep(1.1)
        t0 = time.time()
        time.sleep(8)
        control = _persist_scan(mark_c)
        try:
            fcntl.flock(native, fcntl.LOCK_EX | fcntl.LOCK_NB)
            have_native = True
        except BlockingIOError:
            have_native = False
        os.utime(mark_t)
        time.sleep(1.1)
        t1 = time.time()
        with lab.Lock(both=True):
            for _ in range(2):
                op("on", quiet=True, flags={"rt.stubs": True})
                op("off", quiet=True)
            full = None
            if have_native:
                full = {"off": (op("off", quiet=True, vr=True) or {}).get("shell"),
                        "on": (op("on", quiet=True, vr=True, native="auto") or {}).get("shell")}
            restore = _st_restore(lab)
            storage = _st_js(r"""JSON.stringify((() => { const out = {}; const rx = /lgs/i;
              const scan = (name, w) => { try { out[name] = [...Object.keys(w.localStorage), ...Object.keys(w.sessionStorage)].filter((k) => rx.test(k)); } catch (e) { out[name] = 'n/a'; } };
              scan('shared', window);
              for (const p of g_PopupManager.m_mapPopups.values()) { try { scan(String(p.m_strName).replace(/_uid\d+$/, ''), p.window); } catch (_) {} }
              return out; })())""")
        elapsed = time.time() - t1
        if elapsed < 8:
            time.sleep(8 - elapsed)
        test = _persist_scan(mark_t)
    finally:
        if have_native:
            fcntl.flock(native, fcntl.LOCK_UN)
        native.close()
        fcntl.flock(syncl, fcntl.LOCK_UN)
        syncl.close()
        for m in (mark_c, mark_t):
            try:
                os.remove(m)
            except OSError:
                pass
    new = sorted(test - control)
    allowed, known, unexplained = [], [], []
    for p in new:
        if any(rx.match(p) for rx in PERSIST_ALLOWED):
            allowed.append(p)
            continue
        why = next((w for rx, w in PERSIST_KNOWN if rx.match(p)), None)
        if why:
            known.append(f"{p}  [{why}]")
        else:
            unexplained.append(p)
    ours = [p for p in new if p.startswith("~/.local/share/glass-shell")]
    units = subprocess.run(["systemctl", "--user", "list-unit-files", "lgs*", "--no-legend"],
                           capture_output=True, text=True).stdout.strip()
    autostart = [n for d in ("~/.config/autostart", "~/.config/systemd/user") for n in
                 (os.listdir(os.path.expanduser(d)) if os.path.isdir(os.path.expanduser(d)) else [])
                 if "lgs" in n or "glass" in n]
    stor_bad = {k: v for k, v in (storage or {}).items() if v and v != "n/a"}
    ok = not unexplained and not ours and not units and not autostart and not stor_bad
    return ok, {"controlS": round(t1 - t0, 1), "newInTestWindow": len(new), "allowed": allowed[:40],
                "known": known[:40], "unexplained": unexplained, "underGlassShell": ours,
                "unitFiles": units or None, "autostart": autostart, "webStorage": stor_bad or "none",
                "fullCliCycle": full if have_native else "skipped: native.lock busy", "restore": restore}


def st_rt7(lab, ctx):
    """perf main on /library/tab/AllGames: theme only vs theme + runtime (idle),
    three alternated pairs. Pass: runtime fps >= 95 % of theme-only, mean extra
    long frames (> 34 ms) per run within the theme-only A/A spread (min 1), and
    the runtime's own idle work < 0.1 ms per second."""
    runs, idle = [], None
    with lab.Lock():
        route = lab.lab_js("L.route()")
        lab.lab_js("L.nav('/library/tab/AllGames')")
        time.sleep(1.5)
        for mode in ("css", "rt") * 3:
            r = op("on", quiet=True, rt=(mode == "rt"))
            asyncio.run(lab.capture("main", "/tmp/lgs/p1-perf.png", 0.8))
            i0 = (_st_status() or {}).get("idle") if mode == "rt" else None
            p = _jsonish(lab.lab_js("L.perf('main', 3000)", timeout=60))
            runs.append(dict(p, mode=mode, runtime=(r.get("runtime") or {}).get("runtime")))
            if mode == "rt" and i0:
                i1 = (_st_status() or {}).get("idle") or {}
                dt = max(0.001, (i1.get("t", 0) - i0["t"]) / 1000)
                rate = round((i1.get("tickMsTotal", 0) - i0["tickMsTotal"]) / dt, 4)
                idle = {"ticks": i1.get("ticks", 0) - i0["ticks"], "seconds": round(dt, 2),
                        "tickMsPerSecond": max(rate, (idle or {}).get("tickMsPerSecond", 0))}
        try:
            os.remove("/tmp/lgs/p1-perf.png")
        except OSError:
            pass
        if route and route != "/library/tab/AllGames":
            lab.lab_js(f"L.nav({json.dumps(route)})")
        restore = _st_restore(lab)

    def agg(mode):
        rs = [r for r in runs if r["mode"] == mode]
        return {"fps": round(sum(r["fps"] for r in rs) / len(rs), 1), "median": max(r["median"] for r in rs),
                "p95": max(r["p95"] for r in rs), "long": sum(r["long"] for r in rs),
                "frames": sum(r["frames"] for r in rs)}
    css, rt = agg("css"), agg("rt")
    cl = [r["long"] for r in runs if r["mode"] == "css"]
    rl = [r["long"] for r in runs if r["mode"] == "rt"]
    spread = max(1, max(cl) - min(cl))
    extra = (sum(rl) - sum(cl)) / len(rl)
    idle_ok = bool(idle) and idle.get("tickMsPerSecond", 1) < 0.1
    ok = rt["fps"] >= 0.95 * css["fps"] and extra <= spread and idle_ok
    return ok, {"themeOnly": css, "themeAndRuntime": rt, "fpsRatio": round(rt["fps"] / css["fps"], 3),
                "longPerRun": {"css": cl, "rt": rl, "meanExtra": round(extra, 2), "aaSpread": spread},
                "runtimeIdle": idle, "runs": runs, "routeRestored": route, "restore": restore}


SELFTESTS = [("RT-1", st_rt1), ("RT-2", st_rt2), ("RT-3", st_rt3), ("RT-4", st_rt4),
             ("RT-5", st_rt5), ("RT-6", st_rt6), ("RT-7", st_rt7)]


def selftest_main(args, opts):
    sys.dont_write_bytecode = True
    want = {a.strip().upper() for a in (args[0].split(",") if args else []) if a.strip()}
    sys.path.insert(0, os.path.join(ROOT, "lab"))
    sys.modules.setdefault("lgs", sys.modules[__name__])   # one lgs module for us and the lab
    import lab as labmod
    try:
        build = labmod.steam_build()
    except Exception:  # noqa: BLE001
        build = "unknown"
    results, ctx = [], {}
    for tid, fn in SELFTESTS:
        if want and tid not in want:
            continue
        t0 = time.time()
        try:
            ok, detail = fn(labmod, ctx)
            res = {"id": tid, "pass": bool(ok), "detail": detail}
        except SystemExit as e:
            res = {"id": tid, "pass": False, "blocked": str(e)}
        except Exception as e:  # noqa: BLE001
            import traceback
            res = {"id": tid, "pass": False, "error": f"{e!r}", "trace": traceback.format_exc()[-1500:]}
            try:
                with labmod.Lock():
                    res["restore"] = _st_restore(labmod)
            except BaseException as e2:  # noqa: BLE001
                res["restore"] = f"error: {e2!r}"
        res["seconds"] = round(time.time() - t0, 1)
        results.append(res)
        print(f"{'PASS' if res['pass'] else 'FAIL'} {tid} ({res['seconds']} s)", flush=True)
    out = {"date": time.strftime("%Y-%m-%dT%H:%M:%S"), "steamBuild": build, "results": results,
           "pass": all(r["pass"] for r in results)}
    os.makedirs("/tmp/lgs", exist_ok=True)
    with open(SELFTEST_OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(json.dumps(out, indent=1) if opts.get("json") else f"details: {SELFTEST_OUT}")
    return 0 if out["pass"] else 1


# ---------------------------------------------------------------- CLI

def attribute(tokens):
    """Which theme files mention each unresolved token."""
    out = {}
    for path in theme_css_files():
        with open(path, encoding="utf-8") as f:
            text = f.read()
        for t in tokens:
            if "%{" + t + "}" in text:
                out.setdefault(t, []).append(os.path.basename(path))
    return out


def is_on():
    st = op("status")
    return bool(st and st.get("enabled"))


def parse_args(argv):
    """Positional args and options; --flags takes a value."""
    args, opts = [], {}
    it = iter(argv[1:])
    for a in it:
        if a == "--flags":
            opts["flags"] = next(it, "")
        elif a.startswith("--flags="):
            opts["flags"] = a.split("=", 1)[1]
        elif a.startswith("--"):
            opts[a[2:]] = True
        else:
            args.append(a)
    return args, opts


def main(argv):
    args, opts = parse_args(argv)
    quiet = bool(opts.get("quiet"))
    native = "on" if opts.get("native") else ("off" if opts.get("css") else "auto")
    cli_flags = parse_flag_list(opts["flags"]) if opts.get("flags") else None
    rt = False if opts.get("no-rt") else None
    cmd = args[0] if args else "toggle"
    if cmd in ("-h", "help") or opts.get("help"):
        print(__doc__)
        return 0
    if cmd == "check":
        res = check(node=not opts.get("no-node"))
        if opts.get("json"):
            print(json.dumps(res, indent=1))
        else:
            for e in res["errors"]:
                print("FAIL " + e)
            for w in res["warnings"]:
                print("WARN " + w)
            print(f"lgs check: {res['checked']} files, {len(res['errors'])} errors, "
                  f"{len(res['warnings'])} warnings, {len(res['skippedWip'])} _wip files skipped"
                  + ("" if res["node"] else " (no node: JS not parsed)"))
        return 0 if res["ok"] else 1
    if cmd == "selftest":
        return selftest_main(args[1:], opts)
    try:
        if cmd == "toggle":
            cmd = "off" if is_on() else "on"
        if cmd == "reload":
            res = op("on", quiet=True, vr=True, native=None, flags=cli_flags, rt=rt)
        elif cmd == "dial":
            v = min(1.0, max(0.0, float(args[1])))
            with open(DIAL, "w", encoding="utf-8") as f:
                f.write(f"{v:g}\n")
            res = op("on", quiet=True, vr=True, native=None) if is_on() else {"dial": v, "enabled": False}
            if isinstance(res, dict) and res.get("enabled"):
                op("toast", text=f"Glass  ·  {round((1 - v) * 100)}% clear")
        elif cmd == "toast":
            res = op("toast", text=" ".join(args[1:]) or "Liquid Glass")
        elif cmd == "flags":
            res = flags_cmd(argv[2:])
        elif cmd == "on":
            res = op("on", quiet=quiet, vr=True, native=native, flags=cli_flags, rt=rt)
        elif cmd == "off":
            res = op("off", quiet=quiet, vr=True)
            write_session_flags({})          # G-REMOVE: the session flags file goes too
            if isinstance(res, dict):
                res["flagsFile"] = "cleared"
        elif cmd == "status":
            res = op("status", vr=True)
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
    rtres = res.get("runtime") if isinstance(res, dict) else None
    if isinstance(rtres, dict) and rtres.get("failed"):
        print("lgs: runtime modules failed: " + "; ".join(rtres["failed"]), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
