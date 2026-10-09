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
  selftest [RT-1,RT-2,...] [--mode=pad|laser]  the P1 acceptance tests on the
           live UI, inside the lab lock (docs/phase2/wp/P1.md); RT-H checks the
           test hooks; --mode runs every step with the lab's input-mode stub
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
DIAL = "/tmp/lgs/dial"                              # lgs dial, mirrored from TUNE (watched by lgs_vr.py)
# The wearer's glass tune (the bar's paintbrush panel, `lgs dial`): the one file kept across reboots, by the
# wearer's choice (README rule 7's exception). Absent = the defaults; a reset removes it.
TUNE = os.path.join(os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config"), "glass-shell", "tune.json")
TUNE_DEFAULT = {"v": 1, "dial": 0.5, "hue": None, "hueK": 0.5, "refract": 1.0, "frost": 1.0, "light": 1.0}
TUNE_HUE = re.compile(r"^#[0-9a-fA-F]{6}$")
READY_WAIT_S = 120     # "on": how long to wait for Steam's UI and a plausible class index (review R1 M1)
READY_BACKOFF_S = (2, 4, 8, 15)                     # then every 15 s
MIN_CLASS_MODULES = 200                             # a sane index of Steam's client bundle (healthy: about 550)

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
    "pointerProxy": "off",      # S16: native | on | off (off: the glass sits behind Steam's panel, SteamVR's laser dot shows)
    "haptics": False,           # S17
    "hudPlacement": False,      # S21
    "storeOrnament": False,     # S22 (gated)
    "settingsDrill": False,     # S23 (gated)
    "rt.stubs": False,          # P1 test stubs (RT-1, RT-3, RT-4)
    "rt.stubThrow": False,      # P1 failing stub (RT-2)
    "rt.stubSlow": False,       # P1 stub whose install() outlives its timeout (RT-2, review R1 M2)
    "rt.stubTransient": False,  # P1 stub failing twice with a transient error, then installed (RT-2, REQ P2->P1)
    # Other packages' flags with a contracted default (shown by `lgs flags`, read by rt.flags)
    "react": True,              # P2 kill switch for every T3 feature (contracts/react.md §1)
    "reactLab": False,          # P2 lab route, tests only (react.md §9)
    "actionsLive": False,       # P2: Steam actions run only when true (react.md §7; V1 sets it at release)
    "actionsDryRun": False,     # P8: nav/launch actions logged, not run (daemon.md §2)
    "sgDepthAnim": True,        # P8/P7: depth motion kill switch (daemon.md §2)
    "shellThemeGraceS": 600,    # P8: dormant seconds while the theme is off without lgs off (daemon.md §2)
    "glassTune": False,         # the bar's paintbrush (glass tuner, rt 33-tune.js); defaults.json turns it on
}


def clean_tune(d):
    """A tune dict onto the defaults: known keys, numbers clamped, the hue "#rrggbb" or None."""
    out = dict(TUNE_DEFAULT)
    if not isinstance(d, dict):
        return out
    for k, lo, hi in (("dial", 0.0, 1.0), ("hueK", 0.0, 1.0), ("refract", 0.0, 2.0), ("frost", 0.0, 2.0),
                      ("light", 0.0, 2.0)):
        v = d.get(k)
        if isinstance(v, (int, float)) and not isinstance(v, bool) and v == v:
            out[k] = round(min(hi, max(lo, float(v))), 3)
    h = d.get("hue")
    out["hue"] = h.lower() if isinstance(h, str) and TUNE_HUE.match(h) else None
    return out


def read_tune():
    try:
        with open(TUNE, encoding="utf-8") as f:
            return clean_tune(json.load(f))
    except (OSError, ValueError):
        return dict(TUNE_DEFAULT)


def write_tune(t):
    """Saves the tune (atomically); the defaults remove the file (and its folder when empty)."""
    t = clean_tune(t)
    if t == TUNE_DEFAULT:
        try:
            os.remove(TUNE)
        except OSError:
            pass
        try:
            os.rmdir(os.path.dirname(TUNE))
        except OSError:
            pass
        return t
    os.makedirs(os.path.dirname(TUNE), exist_ok=True)
    tmp = TUNE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(t, f, sort_keys=True)
    os.replace(tmp, TUNE)
    return t


def read_dial():
    """The dial: the tune's when the wearer saved one, else a session `lgs dial` (older), else 0.5."""
    if os.path.exists(TUNE):
        return read_tune()["dial"]
    try:
        with open(DIAL, encoding="utf-8") as f:
            return min(1.0, max(0.0, float(f.read().strip())))
    except (OSError, ValueError):
        return TUNE_DEFAULT["dial"]


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
            clean = _css_scan(text)[0]          # comments and strings do not count (review R1 m5)
            for m in sorted({m.group(0) for m in AT_NOWRAP.finditer(clean)}):
                log(f"warning: {name} uses {m}; move it to a *.nowrap.css file")
            parts.append(f"/* {name} */\nhtml.lgs-on {{\n{text}\n}}")
    # the dial and the wearer's glass colour (the runtime's tune module overrides both live, rt 33-tune.js)
    tune = read_tune()
    parts.append(f"html.lgs-on {{ --lgs-dial: {read_dial():g}; }}")
    if tune["hue"]:
        parts.append(f"html.lgs-on {{ --lgs-tune-hue: {tune['hue']}; --lgs-tune-hue-k: {tune['hueK']:g}; }}")
    return "\n\n".join(parts)


def core_call(payload):
    with open(os.path.join(HERE, "lgs_index.js"), encoding="utf-8") as f:
        index_js = f.read()
    with open(os.path.join(HERE, "lgs_lens.js"), encoding="utf-8") as f:
        lens_js = f.read()
    with open(os.path.join(HERE, "lgs_core.js"), encoding="utf-8") as f:
        core_js = f.read().strip().rstrip(";")
    return (f"(() => {{\n{index_js}\n{lens_js}\n"
            f"return ({core_js})({json.dumps(payload)}, lgsBuildIndex, lgsLens, lgsIndexShared);\n}})()")


# "on" waits for Steam: evaluated with the theme's distinct tokens before anything is
# torn down or injected. Steam's UI must be up (SteamUIStore, popup manager, main
# window, live webpack runtime) and the shared class index plausible (>= minModules
# CSS modules; at most half the theme's tokens unresolved). A short index is never
# cached (lgsIndexShared). Answers {ready, missing, index, tokens, unresolved}.
CHECK_JS = r"""(() => {
  const P = __P__, W = window, miss = [];
  try { if (!W.SteamUIStore || !W.SteamUIStore.WindowStore) miss.push('SteamUIStore'); } catch (_) { miss.push('SteamUIStore'); }
  let pm = null; try { pm = W.g_PopupManager; } catch (_) { /* not yet */ }
  if (!pm || !pm.m_mapPopups) miss.push('g_PopupManager');
  let main = null;
  try { const w = W.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.BrowserWindow; if (w && w.document && w.document.body) main = w; } catch (_) { /* fall back */ }
  if (!main && pm && pm.m_mapPopups) {
    for (const p of pm.m_mapPopups.values()) { try { if (/^VR_uid/.test(p.m_strName) && p.window && p.window.document && p.window.document.body) main = p.window; } catch (_) { /* closing */ } }
  }
  if (!main) miss.push('main window');
  const ch = W.webpackChunksteamui;
  if (!ch || typeof ch.push !== 'function' || ch.push === Array.prototype.push) miss.push('webpack runtime');
  if (miss.length) return JSON.stringify({ ready: false, missing: miss });
  const ix = lgsIndexShared({ minModules: P.minModules });
  const info = { size: ix.size, factories: ix.factories, ok: ix.ok, why: ix.why || null, ms: ix.ms, cached: W.__LGS_INDEX === ix };
  if (!ix.ok) return JSON.stringify({ ready: false, missing: [], index: info });
  let unresolved = 0;
  for (const t of P.tokens) { const r = ix.selector(t); if (!r.sel && r.err !== 'ambiguous') unresolved++; }
  const bad = P.tokens.length >= 20 && unresolved > P.tokens.length * 0.5;
  if (bad && W.__LGS_INDEX === ix) { try { delete W.__LGS_INDEX; } catch (_) { W.__LGS_INDEX = undefined; } }
  return JSON.stringify({ ready: !bad, missing: [], index: info, tokens: P.tokens.length, unresolved });
})()"""


def check_call(tokens, min_modules):
    with open(os.path.join(HERE, "lgs_index.js"), encoding="utf-8") as f:
        index_js = f.read()
    return f"(() => {{\n{index_js}\nreturn {CHECK_JS.replace('__P__', json.dumps({'tokens': tokens, 'minModules': min_modules}))};\n}})()"


def wait_ready(tokens, min_modules=MIN_CLASS_MODULES, wait=None):
    """Poll Steam until it is ready for an injection (CHECK_JS), with backoff 2, 4,
    8 s, then every 15 s, for up to `wait` seconds (READY_WAIT_S). Each attempt
    connects anew, so a SharedJSContext that reloads meanwhile is followed; each
    attempt that is not ready is logged. Returns {state: 'ok' | 'gave-up',
    attempts, waitedS, last}: 'gave-up' with an index problem other than the
    unresolved share means "do not inject"."""
    wait = READY_WAIT_S if wait is None else wait
    t0, n, last = time.time(), 0, None
    expr = check_call(tokens, min_modules)
    while True:
        n += 1
        try:
            last = _jsonish(run_js("SharedJSContext", expr, 30))
        except (Exception, SystemExit) as e:  # noqa: BLE001 - devtools down (Steam restarting)
            last = {"ready": False, "missing": [f"devtools: {str(e)[:120]}"]}
        if not isinstance(last, dict):
            last = {"ready": False, "missing": [f"unexpected answer {str(last)[:80]}"]}
        waited = round(time.time() - t0, 1)
        if last.get("ready"):
            if n > 1:
                log(f"index: attempt {n}: ready after {waited} s ({json.dumps(last.get('index'))})")
            return {"state": "ok", "attempts": n, "waitedS": waited, "last": last}
        log(f"index: attempt {n}: waiting ({waited} s): missing {last.get('missing')}, "
            f"index {json.dumps(last.get('index'))}, unresolved {last.get('unresolved')}/{last.get('tokens')}")
        if time.time() - t0 >= wait:
            log(f"index: gave up after {n} attempts, {waited} s")
            return {"state": "gave-up", "attempts": n, "waitedS": waited, "last": last}
        delay = READY_BACKOFF_S[min(n - 1, len(READY_BACKOFF_S) - 1)]
        time.sleep(max(0.2, min(delay, wait - (time.time() - t0))))


def theme_tokens(css, lens):
    toks = {m.group(1).strip() for m in re.finditer(r"%\{([^}]+)\}", css)}
    for spec in lens or []:
        if isinstance(spec, dict):
            toks |= {m.group(1).strip() for m in re.finditer(r"%\{([^}]+)\}", str(spec.get("sel", "")))}
    return sorted(toks)


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
    top-level names stay local, and a throw marks only this file failed. The
    wrapper is strict (a file's own top-level 'use strict' is not a directive
    inside the try block), so an accidental implicit global throws instead of
    leaking past lgs off (review R1 mB3)."""
    if label.startswith("shared/"):
        name = os.path.splitext(os.path.basename(label))[0]
        return ("(function () {\n 'use strict';\n const __rt = window.__LGS_RT;\n"
                " const module = { exports: {} }; const exports = module.exports;\n"
                f" __rt._loading({json.dumps(label)});\n try {{\n"
                f"{src}\n;\n __rt._shared({json.dumps(name)}, module.exports);\n"
                f" }} catch (e) {{ __rt._fail({json.dumps(label)}, e); }} finally {{ __rt._loading(null); }}\n"
                f"}}).call(window);\n//# sourceURL=lgs/{label}")
    return ("(function () {\n 'use strict';\n const __rt = window.__LGS_RT;\n"
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


# Marked elements: an lgs-* (or "lgs") class, a data-lgs* attribute, an lgs- / lgs_ id.
# One native XPath query per window instead of walking every element (review R1 M1 item 4).
SWEEP_XPATH = ("//*[starts-with(@id,'lgs-') or starts-with(@id,'lgs_')"
               " or contains(concat(' ',normalize-space(@class),' '),' lgs-')"
               " or contains(concat(' ',normalize-space(@class),' '),' lgs ')"
               " or @*[starts-with(name(),'data-lgs')]]")

SWEEP_JS = r"""(() => {
  const RX = /^_*lgs/i, XP = __XP__;
  const out = { windows: {}, globals: [], clean: true };
  try { out.globals = Object.getOwnPropertyNames(window).filter((k) => RX.test(k)); } catch (_) { /* proxy */ }
  let pops = [];
  try { pops = [...g_PopupManager.m_mapPopups.values()]; } catch (_) { /* none */ }
  for (const p of pops) {
    let w = null;
    try { w = p.window; if (!w || !w.document || !w.document.documentElement) continue; } catch (_) { continue; }
    const cls = new Set(), attrs = new Set(), ids = new Set(), items = [];
    let snap = null;
    try { snap = w.document.evaluate(XP, w.document, null, 7, null); } catch (_) { continue; }
    const n = snap.snapshotLength;
    for (let i = 0; i < n; i++) {
      const el = snap.snapshotItem(i);
      const mc = [], ma = [];
      for (const c of el.classList) if (c.startsWith('lgs-') || c === 'lgs') { cls.add(c); mc.push(c); }
      for (const a of el.getAttributeNames()) if (a.startsWith('data-lgs')) { attrs.add(a); ma.push(a); }
      const lid = el.id && /^lgs[-_]/.test(el.id);
      if (lid) ids.add(el.id);
      // a signature per marked element: tag, lgs id, lgs classes, data-lgs attributes (diffable between sweeps)
      if (items.length < 40) items.push(el.tagName.toLowerCase() + (lid ? '#' + el.id : '')
        + mc.sort().map((c) => '.' + c).join('') + ma.sort().map((a) => '[' + a + ']').join(''));
    }
    const g = [];
    try { for (const k of Object.getOwnPropertyNames(w)) if (/^__LGS/.test(k)) g.push(k); } catch (_) { /* cross-realm */ }
    if (n || g.length) {
      out.clean = false;
      out.windows[String(p.m_strName || '?').replace(/_uid\d+$/, '')] =
        { elements: n, classes: [...cls], attrs: [...attrs], ids: [...ids], globals: g, items };
    }
  }
  if (out.globals.includes('__LGS_RT') || out.globals.includes('__LGS')) out.clean = false;
  return JSON.stringify(out);
})()""".replace("__XP__", json.dumps(SWEEP_XPATH))


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


def op(name, quiet=False, text=None, vr=False, native=None, flags=None, rt=None, wait=None, min_modules=None):
    """Run one operation on the Steam UI; with vr=True also on the native glass
    layer and SteamVR's pages: on starts the transient unit lgs-shell (SteamVR
    page theming; the native glass layer per `native`, see _shell_start), off
    stops it and strips the pages.

    on first waits (wait_ready: up to `wait` s, default READY_WAIT_S) until
    Steam's UI is up and the class index is plausible (>= min_modules CSS
    modules, default MIN_CLASS_MODULES); when it gives up, nothing is changed
    and res["index"]["state"] is "gave-up". Then it (re)loads the runtime
    (device/rt) after the CSS unless rt=False or the flag "rt" is off; flags =
    {name: value} is the "cli" flag layer. If the runtime fails to load, the
    CSS theme stays on and res["runtime"] says why.
    off removes the runtime modules first and adds a cleanup report; its "Off"
    toast is shown after the leftovers sweep (review R1 mB1)."""
    shell_off = None
    if vr and name == "off":
        # Native layer first, so Steam's own panels are back before the CSS goes.
        try:
            import lgs_shell
            shell_off = lgs_shell.stop()
        except Exception as e:  # noqa: BLE001 - best effort
            shell_off = f"error: {e}"
    payload = {"op": name, "quiet": quiet}
    ready = None
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
        mm = MIN_CLASS_MODULES if min_modules is None else min_modules
        payload.update(css=css, svg=svg, lens=lens, minModules=mm,
                       version=hashlib.sha1((css + svg + json.dumps(lens)).encode()).hexdigest()[:10])
        ready = wait_ready(theme_tokens(css, lens), mm, wait)
        last = ready["last"]
        if ready["state"] != "ok":
            idx = last.get("index") or {}
            if last.get("missing") or not idx.get("ok"):
                # Steam not ready or the harvest short: change nothing (the CSS stays as it is).
                try:
                    cur = _jsonish(run_js("SharedJSContext", core_call({"op": "status"}), 30))
                except (Exception, SystemExit) as e:  # noqa: BLE001
                    cur = {"enabled": False, "error": str(e)[:200]}
                res = cur if isinstance(cur, dict) else {"enabled": False}
                res["index"] = dict(idx, state="gave-up", missing=last.get("missing"),
                                    attempts=ready["attempts"], waitedS=ready["waitedS"])
                res["runtime"] = {"runtime": "unchanged", "reason": "Steam not ready or class index too short"}
                return res
            payload["final"] = True     # only the unresolved share is off: inject anyway (Phase 1 behaviour)
    if text:
        payload["text"] = text
    core_payload = dict(payload, quiet=True) if name == "off" else payload

    async def go(s):
        out = {}
        if name in ("on", "off"):
            try:
                out["rt_off"] = await rt_teardown(s, "off" if name == "off" else "reload")
            except Exception as e:  # noqa: BLE001 - the theme must still switch
                out["rt_off"] = {"error": str(e)[:300]}
        out["res"] = _jsonish(await s.eval(core_call(core_payload), 60))
        res0 = out["res"] if isinstance(out["res"], dict) else {}
        if name == "on" and res0.get("enabled"):
            want = rt if rt is not None else truthy(flags_effective(flags).get("rt", True))
            if not want:
                out["runtime"] = {"runtime": "off", "reason": "flag rt is off" if rt is None else "--no-rt"}
            else:
                try:
                    out["runtime"] = await rt_load(s, flags, res0.get("version") or payload.get("version"))
                except Exception as e:  # noqa: BLE001 - fallback: CSS theme only (Phase 1)
                    log(f"rt: load failed, CSS only: {e!r}")
                    try:
                        await rt_teardown(s, "load failed")
                    except Exception:  # noqa: BLE001
                        pass
                    out["runtime"] = {"runtime": "off", "reason": f"loader failed: {str(e)[:300]}"}
        elif name == "on":
            out["runtime"] = {"runtime": "off", "reason": "theme not injected"}
        elif name == "off":
            # Sweep first, then the "Off" toast: the toast is not a leftover (review R1 mB1).
            out["sweep"] = _jsonish(await s.eval(SWEEP_JS, 30))
            if not quiet:
                try:
                    await s.eval(core_call({"op": "toast", "text": "LiquidAss  ·  Off"}), 15)
                except Exception:  # noqa: BLE001 - cosmetic
                    pass
        elif name == "status":
            out["runtime"] = _jsonish(await s.eval(
                "window.__LGS_RT ? JSON.stringify(window.__LGS_RT.status({counts: true})) : null", 15))
        return out

    o = asyncio.run(_session(go))
    res = o["res"]
    if isinstance(res, dict):
        if name == "on":
            res["runtime"] = o.get("runtime")
            if ready is not None and isinstance(res.get("index"), dict):
                res["index"].update(attempts=ready["attempts"], waitedS=ready["waitedS"])
                if payload.get("final"):
                    res["index"]["state"] = "gave-up"
                    res["index"]["note"] = "injected with most tokens unresolved (stale theme for this Steam build?)"
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
  let vrNav = null;
  try { vrNav = n(vrGamepadInput.m_NavigationTypeChangeCallbacks); } catch (_) { /* not in VR */ }
  return { popupCreated: n(pm.m_rgPopupCreatedCallbacks), popupDestroyed: n(pm.m_rgPopupDestroyedCallbacks), navigationSource: nav, vrNavigationType: vrNav };
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


RT1_SURFACES = ("main", "bar", "barpopup", "frame.menu", "tooltip", "volumelevel", "floatingfooter",
                "notifications", "keyboard")


def _st_eval_cli(expr, timeout=30, surfaces=RT1_SURFACES):
    """DOM listener counts per surface, evaluated in each popup's own target with
    the DevTools command-line API (getEventListeners). Every Steam window, not only the three RT-1 once
    sampled: Steam's own window handlers (focus, key and mouse) come and go in all of them, and the leak check
    takes the ones it saw change out of the renderer-wide count."""
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


def _st_shell_mode():
    """'on' (native) / 'off' (CSS only) while the lgs-shell unit runs, None when
    it does not, '?' when it cannot be read."""
    try:
        import lgs_shell
        state, pid = lgs_shell.unit_info()
        if state not in ("active", "activating", "reloading") or lgs_shell.daemon_stopping(pid):
            return None
        return "on" if "--native" in lgs_shell.daemon_argv(pid) else "off"
    except Exception:  # noqa: BLE001
        return "?"


def _st_restore(lab):
    """Theme on with the runtime (session flags only). The lgs-shell unit is left
    as it is: only RT-6's full CLI cycle touches it, and puts it back itself
    (another agent may have it stopped on purpose, e.g. in a native session)."""
    res = op("on", quiet=True)
    return {"theme": bool(isinstance(res, dict) and res.get("enabled")),
            "runtime": (res.get("runtime") or {}).get("runtime") if isinstance(res, dict) else None,
            "shellActive": _st_shell_ok()}


def _foreign_globals(left):
    return [k for k in (left or {}).get("globals") or []
            if not EXPECTED_GLOBALS.match(k) and not RUNTIME_GLOBALS.match(k)]


ITEM_RX = re.compile(r"^([a-z0-9-]+)(#[\w-]+)?((?:\.[\w-]+)*)((?:\[[\w-]+\])*)$")
# Marks the lgs-shell daemon (P8, P6's reporter) sets on Steam's windows from its own process: a native
# session of another agent turns them on or off while a lab-locked step runs, and the lab's "off" path
# (no vr) never touches the daemon. Reported apart, never P1's leftovers (re-run of review R1).
# the native session's reporter (lgs_layers.js): its marks come and go with the theme on its own poll
DAEMON_MARKS = re.compile(r"\.lgs-native$|\[data-lgs-(cover|pop|plate-ack|plate-css|plates|noslab)\]$")


def _item_marks(item):
    """'html.lgs-a.lgs-b[data-lgs-c]' -> ['html.lgs-a', 'html.lgs-b', 'html[data-lgs-c]']; an lgs id is its own mark."""
    m = ITEM_RX.match(item or "")
    if not m:
        return [item]
    tag = m.group(1)
    out = [tag + m.group(2)] if m.group(2) else []
    out += [tag + "." + c for c in m.group(3).split(".") if c]
    out += [tag + x for x in re.findall(r"\[[\w-]+\]", m.group(4))]
    return out or [item]


def _leftover_problems(left, base=None, daemon=None):
    """Runtime/core problems in an "off" sweep: __LGS_RT or __LGS left, or a mark (an
    lgs-* class, a data-lgs-* attribute or an lgs- id) still on an element.
    With base (the sweep of an "off" taken before the test's own on/off), marks are
    diffed one by one (a multiset per window): only marks that are new since the base
    count, so another package's mark that was already there, or one of its classes
    toggling on the same element, is not ours. P1's own marks (OWN_MARKS) always count.
    The daemon's marks (DAEMON_MARKS) never count; they go to `daemon` when a list is
    given. Other packages' globals are reported apart (_foreign_globals)."""
    from collections import Counter
    probs = []
    if not isinstance(left, dict):
        return ["no sweep"]
    for k in left.get("globals") or []:
        if RUNTIME_GLOBALS.match(k):
            probs.append(f"global {k}")
    bw = (base or {}).get("windows") or {}
    for name, w in (left.get("windows") or {}).items():
        g = [k for k in w.get("globals") or [] if not EXPECTED_GLOBALS.match(k)]
        if base is not None and w.get("elements", 0) <= 40:
            now = Counter(mk for it in (w.get("items") or []) for mk in _item_marks(it))
            before = Counter(mk for it in ((bw.get(name) or {}).get("items") or []) for mk in _item_marks(it))
            new = []
            for mk, n in now.items():
                if OWN_MARKS.search(mk):
                    new += [mk] * n                    # ours, baseline or not
                elif DAEMON_MARKS.search(mk):
                    if daemon is not None and n > before.get(mk, 0):
                        daemon.append(f"{name}: {mk}")
                elif n > before.get(mk, 0):
                    new += [mk] * (n - before.get(mk, 0))
            if new or g:
                probs.append(f"{name}: new since baseline {sorted(new)} {g}")
        elif w.get("elements") or g:
            probs.append(f"{name}: {w.get('elements')} elements {w.get('classes')} {w.get('attrs')} {w.get('ids')} {g}")
    return probs


# Marks the CSS core, the lens filters and P1's stubs put in the DOM: one of these
# left after "off" is always ours, baseline or not.
OWN_MARKS = re.compile(r"#lgs-(theme|defs|toast|lens-style)(?![\w-])|\.lgs-on(?![\w-])|\.lgs-rt-stub|\[data-lgs-(lens|rt-stub)")


def _foreign_elements(base):
    """Marked elements already present in the baseline "off" sweep (not ours)."""
    return {name: w.get("items") for name, w in ((base or {}).get("windows") or {}).items() if w.get("items")}


def _st_dom_counters():
    """Memory.getDOMCounters of Steam's UI renderer after a forced GC (documents,
    nodes, JS event listeners; SharedJSContext and its popups share the renderer),
    plus SharedJSContext's JS heap after that GC (Runtime.getHeapUsage, MB): the
    context crashed twice on 2026-10-07 with V8 OOM near a 200 MB heap, so RT-1
    also checks that an on/off cycle retains no JS heap."""
    async def go(s):
        try:
            await s.send("HeapProfiler.collectGarbage", {}, 30)
        except Exception:  # noqa: BLE001 - counts without the GC are still useful
            pass
        out = await s.send("Memory.getDOMCounters", {}, 15)
        try:
            h = await s.send("Runtime.getHeapUsage", {}, 15)
            out["jsHeapUsedMB"] = round(h.get("usedSize", 0) / 1048576, 2)
            out["jsHeapTotalMB"] = round(h.get("totalSize", 0) / 1048576, 2)
        except Exception:  # noqa: BLE001 - recorded only
            pass
        return out
    try:
        return asyncio.run(_session(go))
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)[:160]}


MEM_NODES_PER_CYCLE = 500       # RT-1: growth per on/off cycle above this fails
MEM_LISTENERS_PER_CYCLE = 10
MEM_HEAP_MB_PER_CYCLE = 1.5     # JS heap retained per on/off cycle (after a forced GC) above this fails
RT1_NATIVE_WAIT_S = 900
RT1_OWN_LISTENER_TYPES = {"document:visibilitychange", "document:pointerdown"}   # P1 core + stubs


def _st_hold_native(wait_s=RT1_NATIVE_WAIT_S):
    """RT-1 compares DOM listener counts across on/off phases. Another agent's native
    session adds and removes listeners of its own meanwhile (P6's reporter, injected by
    the daemon, which also goes dormant and resumes with our off/on phases): seen
    2026-10-07 11:17, a native session started 4 s before RT-1 and its reporter's
    animation/transition/scroll/focus listeners came and went between phases. So RT-1
    holds native.lock (lock order native -> lab, contracts/lab.md §2), waiting for a
    running session to end. Returns (file or None, seconds waited)."""
    import fcntl
    try:
        f = open("/tmp/lgs/native.lock", "a")
    except OSError:
        return None, 0.0
    t0 = time.time()
    while True:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return f, round(time.time() - t0, 1)
        except BlockingIOError:
            if time.time() - t0 >= wait_s:
                f.close()
                return None, round(time.time() - t0, 1)
            time.sleep(1.0)


def _st_release(f):
    if f is None:
        return
    try:
        import fcntl
        fcntl.flock(f, fcntl.LOCK_UN)
    finally:
        f.close()


def _st_reporter_settled(paused, wait_s=4.0):
    """The native session's reporter (lgs_layers.js, injected by the daemon) detaches its document listeners
    (visibilitychange among them, a type P1's core uses too) on its own poll after the theme goes off and
    attaches them again after it comes on. RT-1 samples listener counts only once it has settled, so a phase
    is not counted with the reporter half way (seen: off phase 1 with its visibilitychange still on main).
    No reporter: settled at once."""
    js = ("(()=>{const L=window.__LGS_LAYERS;if(!L||typeof L.status!=='function')return 'none';"
          "const s=L.status();return s.running?(s.paused?'paused':'on'):'none'})()")
    t0 = time.time()
    while True:
        try:
            st = _st_js(js)
        except Exception:
            return
        if st == "none" or (st == "paused") == paused:
            return
        if time.time() - t0 >= wait_s:
            return
        time.sleep(0.25)


def st_rt1(lab, ctx):
    """lgs on / off three times with the three stub modules; DOM counters (forced
    GC) before and after the cycles (review R1 M1 item 5). Holds native.lock so no
    native session changes listener counts mid-test (_st_hold_native)."""
    ons, offs, reports = [], [], []
    nlock, nwait = _st_hold_native()
    try:
        with lab.Lock():
            ctx["route"] = lab.lab_js("L.route()")
            op("on", quiet=True)     # warm-up: the current core and runtime replaced by this build
            base = op("off", quiet=True).get("leftovers")   # marked elements not ours (another agent's probe)
            _st_reporter_settled(True)
            mem0 = _st_dom_counters()
            offs.append({"counts": _st_js(COUNTS_JS), "listeners": _st_eval_cli(LISTENERS_JS)})
            # four cycles; the leak check compares the off after cycle 2 with the off after cycle 4: something of
            # Steam's flips with every on/off (~40 renderer listeners, -41 and +41 in consecutive 3-cycle runs),
            # so only phases of the same parity are comparable
            mem_mid = None
            for i in range(4):
                r = op("on", quiet=True, flags={"rt.stubs": True})
                _st_reporter_settled(False)
                st = _st_status(counts=True)
                ons.append({"sig": _st_sig(st), "counts": _st_js(COUNTS_JS), "listeners": _st_eval_cli(LISTENERS_JS),
                            "installed": (r.get("runtime") or {}).get("installed")})
                off = op("off", quiet=True)
                _st_reporter_settled(True)
                reports.append(off)
                offs.append({"counts": _st_js(COUNTS_JS), "listeners": _st_eval_cli(LISTENERS_JS)})
                if i == 1:
                    mem_mid = _st_dom_counters()
            mem1 = _st_dom_counters()
            restore = _st_restore(lab)
    finally:
        _st_release(nlock)
    native_lock = {"held": nlock is not None, "waitedS": nwait}
    # "Identical status() each time; 0 duplicate listeners": module states identical in every on, and what
    # each on adds over the off before it (Steam subscriber counts, DOM listeners) the same in every cycle.
    # Deltas, not absolute counts: another agent's native session (its own process, no lab lock for its
    # ongoing work) may subscribe meanwhile (seen in the R1 re-run: NavigationSource 12-13 instead of 2-3).
    def delta(a, b):
        if isinstance(a, dict) and isinstance(b, dict):
            return {k: delta(a.get(k), b.get(k)) for k in sorted(set(a) | set(b))}
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            return a - b
        return 0 if a == b else f"{a} vs {b}"
    # DOM listeners: judged on the event types P1's code registers in a window (the core's
    # `visibilitychange`, the stubs' `pointerdown`, both on the document); RT-1 runs with every other
    # module off. Other types belong to Steam (a popup's own focus/mouse handlers come and go as Steam
    # shows windows) or to another process (the daemon's reporter): listed in `foreignListenerChanges`,
    # not failed. A listener leak of any type is still caught by the DOM counters below.
    def own(L):
        if not isinstance(L, dict):
            return L
        return {s: ({k: v for k, v in m.items() if k in RT1_OWN_LISTENER_TYPES} if isinstance(m, dict) else m)
                for s, m in L.items()}
    foreign = sorted({f"{s}:{k}" for ph in ons + offs for s, m in (ph.get("listeners") or {}).items()
                      if isinstance(m, dict) for k in m if k not in RT1_OWN_LISTENER_TYPES
                      and any(isinstance((q.get("listeners") or {}).get(s), dict)
                              and (q["listeners"][s].get(k) != m.get(k)) for q in ons + offs)})
    cycle_deltas = [{"counts": delta(ons[i]["counts"], offs[i]["counts"]),
                     "listeners": delta(own(ons[i]["listeners"]), own(offs[i]["listeners"]))} for i in range(len(ons))]
    same_sig = all(o["sig"] == ons[0]["sig"] for o in ons)
    same_on = same_sig and all(d == cycle_deltas[0] for d in cycle_deltas)
    same_on_abs = same_sig and all(o["counts"] == ons[0]["counts"] and o["listeners"] == ons[0]["listeners"] for o in ons)
    same_off = all(o["counts"] == offs[0]["counts"] and own(o["listeners"]) == own(offs[0]["listeners"]) for o in offs)

    def diffs(seq):
        """What differs from the first phase, per later phase (diagnosis when a phase differs)."""
        out = []
        for i, o in enumerate(seq[1:], 1):
            d = {}
            for part in ("sig", "counts", "listeners"):
                a, b = seq[0].get(part), o.get(part)
                if a == b:
                    continue
                if isinstance(a, dict) and isinstance(b, dict):
                    sub = {}
                    for k in sorted(set(a) | set(b)):
                        if a.get(k) != b.get(k):
                            if isinstance(a.get(k), dict) and isinstance(b.get(k), dict):
                                sub[k] = {kk: [a[k].get(kk), b[k].get(kk)] for kk in sorted(set(a[k]) | set(b[k]))
                                          if a[k].get(kk) != b[k].get(kk)}
                            else:
                                sub[k] = [a.get(k), b.get(k)]
                    d[part] = sub
                else:
                    d[part] = "differs"
            if d:
                out.append({"phase": i, "diff": d})
        return out
    daemon_marks = []      # another process's native-session marks that changed meanwhile (not P1's)
    stubs = dict(ons[0]["sig"])
    stubs_ok = all(stubs.get(n) == "installed" for n in ("rt.stub.a", "rt.stub.b", "rt.stub.c"))
    rep_ok = all((r.get("runtime") or {}).get("patchedLeft") == 0 and not (r.get("runtime") or {}).get("errors")
                 and not _leftover_problems(r.get("leftovers"), base, daemon_marks) for r in reports)
    delta = {k: (ons[0]["counts"].get(k) or 0) - (offs[0]["counts"].get(k) or 0) for k in ons[0]["counts"]}
    mem = {"before": mem0, "after": mem1}
    if "error" not in mem0 and "error" not in mem1:
        mm = mem_mid if isinstance(mem_mid, dict) and "error" not in mem_mid else mem0
        mem["mid"] = mm
        mem["perCycle"] = {k: round((mem1.get(k, 0) - mm.get(k, 0)) / 2, 1) for k in ("documents", "nodes", "jsEventListeners")}
        # The renderer-wide listener count includes Steam's own window handlers (focus, key and mouse on the bar
        # windows), which come and go as Steam shows them: seen -13 and +13 per cycle in consecutive runs. Their
        # net change between the first and the last off phase, on the windows counted above, is Steam's.
        def foreign_total(L):
            return sum(v for m in (L or {}).values() if isinstance(m, dict)
                       for k, v in m.items() if k not in RT1_OWN_LISTENER_TYPES and isinstance(v, (int, float)))
        steam_delta = foreign_total(offs[-1].get("listeners")) - foreign_total(offs[2].get("listeners"))
        mem["steamListenerDelta"] = steam_delta
        own_listeners = round((mem1.get("jsEventListeners", 0) - mm.get("jsEventListeners", 0) - steam_delta) / 2, 1)
        mem["perCycle"]["ownListeners"] = own_listeners
        mem_ok = mem["perCycle"]["nodes"] <= MEM_NODES_PER_CYCLE and own_listeners <= MEM_LISTENERS_PER_CYCLE
        if "jsHeapUsedMB" in mem0 and "jsHeapUsedMB" in mem1:
            mem["perCycle"]["jsHeapMB"] = round((mem1["jsHeapUsedMB"] - mm.get("jsHeapUsedMB", mem0["jsHeapUsedMB"])) / 2, 2)
            mem_ok = mem_ok and mem["perCycle"]["jsHeapMB"] <= MEM_HEAP_MB_PER_CYCLE
    else:
        mem_ok = True        # counters unavailable: recorded, not a failure
    mem["ok"] = mem_ok
    ok = same_on and same_off and stubs_ok and rep_ok and mem_ok
    return ok, {"onStatusIdentical": same_on, "offCountsBackToBaseline": same_off, "stubsInstalled": stubs_ok,
                "reportsClean": rep_ok, "onAbsoluteIdentical": same_on_abs, "cycleDeltas": cycle_deltas[0],
                "cycleDeltasIdentical": all(d == cycle_deltas[0] for d in cycle_deltas),
                "onDiffs": diffs(ons), "offDiffs": diffs(offs),
                "domCounters": mem, "countsOff": offs[0]["counts"], "countsOn": ons[0]["counts"],
                "deltaOnOff": delta, "listenersOn": ons[0]["listeners"], "listenersOff": offs[0]["listeners"],
                "modules": ons[0]["sig"], "offReport": reports[-1].get("runtime"),
                "leftovers": [_leftover_problems(r.get("leftovers"), base) for r in reports],
                "daemonMarksChanged": sorted(set(daemon_marks)),
                "foreignElementsBefore": _foreign_elements(base),
                "foreignGlobals": _foreign_globals(reports[-1].get("leftovers")), "restore": restore,
                "nativeLock": native_lock, "foreignListenerChanges": foreign}


def st_rt2(lab, ctx):
    """A stub module that throws in install(); plus a file with a syntax error and one that throws at load."""
    _RT_EXTRA[:] = [("rt/98-selftest-syntax.js", "const = ;"),
                    ("rt/99-selftest-loadthrow.js",
                     "__LGS_RT.define({name: 'selftest.loadthrow', install() {}}); throw new Error('selftest: load throws');")]
    try:
        with lab.Lock():
            op("on", quiet=True)
            base_sig = dict(_st_sig(_st_status()))
            r = op("on", quiet=True, flags={"rt.stubs": True, "rt.stubThrow": True, "rt.stubSlow": True,
                                            "rt.stubTransient": True})
            # rt.stub.slow's install resumes 0.6 s after its 5 s timeout; rt.stub.transient retries twice (1 s each)
            time.sleep(3.0)
            st = _st_status(log=120)
            sweep = _st_js(CLASS_SWEEP_JS)
            main = sweep.get("VR") or sweep.get("main") or {}
            restore = _st_restore(lab)
    finally:
        _RT_EXTRA[:] = []
    mods = {m["name"]: m for m in st.get("modules", [])}
    thr = mods.get("rt.stub.throw", {})
    slow = mods.get("rt.stub.slow", {})
    slow_log = [e.get("msg") for e in st.get("log") or [] if e.get("mod") == "rt.stub.slow"]
    tr = mods.get("rt.stub.transient", {})
    tr_log = [e.get("msg") for e in st.get("log") or [] if e.get("mod") == "rt.stub.transient"]
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
        # review R1 M2: an install that outlives its timeout fails closed, also for what it does afterwards
        "slowStubTimedOut": slow.get("state") == "failed" and "timed out" in (slow.get("error") or ""),
        "slowLateWorkIgnored": any("after the module was removed" in (m or "") for m in slow_log)
        and not any(m in ("late interval tick", "late timer fired") for m in slow_log),
        "slowClassesGone": not any(any(c.startswith("lgs-rt-stub-slow") for c in (w.get("classes") or []))
                                   for w in sweep.values()),
        "slowNotExposed": "rtStubSlow" not in (st.get("exposed") or {}),
        "slowRemoveCalledAgain": any("remove() called again" in (m or "") for m in slow_log),
        # REQ P2->P1: a transient failure is retried (twice here), then the module installs
        "transientRetried": tr.get("state") == "installed" and tr.get("retries") == 2
        and sum(1 for m in tr_log if "transient failure; retry" in (m or "")) == 2,
    }
    return all(checks.values()), {"checks": checks, "stubThrow": {k: thr.get(k) for k in ("state", "error")},
                                  "stubSlow": {"state": slow.get("state"), "error": (slow.get("error") or "")[:120],
                                               "log": slow_log[-10:]},
                                  "stubTransient": {"state": tr.get("state"), "retries": tr.get("retries"), "log": tr_log[-8:]},
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
        base = op("off", quiet=True).get("leftovers")   # marked elements not ours (another agent's probe)
        out["foreignElementsBefore"] = _foreign_elements(base)
        all_flags = {m["flag"]: True for m in (st0 or {}).get("modules", []) if m.get("flag")}
        for name, flags in (("a", {"rt.stubs": True}), ("b", dict(all_flags, **{"rt.stubThrow": False}))):
            r_on = op("on", quiet=True, flags=flags)
            r = op("off", quiet=True)
            rt_rep = r.get("runtime") or {}
            dm = []
            probs = _leftover_problems(r.get("leftovers"), base, dm)
            this_ok = rt_rep.get("patchedLeft") == 0 and not rt_rep.get("errors") and not probs \
                and not rt_rep.get("globalsLeft")
            out[name] = {"pass": this_ok, "flags": sorted(flags), "installed": (r_on.get("runtime") or {}).get("modules"),
                         "patchedLeft": rt_rep.get("patchedLeft"), "removed": rt_rep.get("removed"),
                         "errors": rt_rep.get("errors"), "globalsLeft": rt_rep.get("globalsLeft"),
                         "problems": probs, "daemonMarksChanged": dm, "foreignGlobals": _foreign_globals(r.get("leftovers")),
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
# The wearer's glass tune (TUNE): the one file kept across reboots, written only when the wearer changes it
# (the paintbrush panel, `lgs dial`), never by on / off; allowed by name, nothing else in that folder
TUNE_ALLOWED = re.compile(r"^" + re.escape(os.path.dirname(TUNE)) + r"(/tune\.json(\.tmp)?)?$")
PERSIST_ALLOWED.append(re.compile(r"^" + re.escape(
    ("~" + TUNE[len(os.path.expanduser("~")):]) if TUNE.startswith(os.path.expanduser("~") + "/") else TUNE)
    + r"$"))
PERSIST_KNOWN = [  # not written by Glass Shell: classified, listed, not failures
    (re.compile(r"^/run/user/\d+/systemd/"), "systemd runtime state of the transient unit (tmpfs, gone at reboot)"),
    (re.compile(r"^~/\.local/share/Steam/|^~/\.steam/"), "Steam's own files"),
    (re.compile(r"^/tmp/lgs-shots(/|$)"), "lab screenshots (P10, /tmp)"),
    (re.compile(r"^/tmp/(steam|\.X11|pulse|dumps|\.steam)"), "Steam / system"),
    (re.compile(r"^/tmp/cc\w{6}\.\w+$"), "compiler temporary of another agent's build (gcc -pipe off)"),
    (re.compile(r"^~/\.local/state/wireplumber/"), "PipeWire session manager's own state (stream volumes)"),
    (re.compile(r"^/dev/shm/u\d+-Shm_\w+$"), "Steam / SteamVR IPC shared memory (mapped by vrserver, vrcompositor; RAM)"),
    (re.compile(r"^/tmp/lgs-fx/"), "P9's glassd tool fixtures (native/glassd/tools/test_*.py; REQ P1->P9: under /tmp/lgs)"),
    (re.compile(r"^~/\.local/share/glass-shell/.*/__pycache__/[\w.-]+\.pyc$"),
     "bytecode cache of a synced .py, written by another process's import (our process writes none: audit)"),
    (SYNCED_SOURCE := re.compile(
        r"^~/\.local/share/glass-shell/(device|theme|lab|native|tools)/(.+/)?"
        r"([^/]+\.(py|js|css|json|md|sh|html|svg|cpp|cc|c|h|hpp|txt|cmake|glsl|frag|vert|comp|ttf|otf|woff2?)|Makefile|lgs)$"),
     "synced source: `glass.py sync` or another agent's upload (the card allows synced sources; this process's "
     "write audit shows no write there; seen in the R1 re-run: native/spike/sg_test.py)"),
    (re.compile(r"^~/\.config/openvr/config/cv/xrservice/serializedmap/"),
     "SteamVR xrservice's tracking map, saved by SteamVR itself (seen in the R1 re-run)"),
    (re.compile(r"^~/\.config/openvr/config/chaperone_info\.vrchap$"),
     "SteamVR's vrserver rewrites it every 60 s (hh:mm:58, vrserver.txt 'Read chaperone JSON'); no Glass Shell code "
     "mentions it (review R1 m8)"),
]
# Where a web-storage or settings write of ours would land: never waved through as "Steam's own
# files"; each new file is read and passes only without a Glass Shell marker (review R1 mB4).
PERSIST_CONTENT_CHECKED = re.compile(
    r"^~/\.local/share/Steam/(config/htmlcache/Default/(Local Storage|Session Storage|IndexedDB|WebStorage|"
    r"File System|databases|Service Worker)/|(config|userdata/\d+/config)/[^/]+\.vdf$)")
GS_MARKER = re.compile(rb"__LGS|lgs[-_][a-z]|glass-shell|Liquid Glass|LiquidAss|lgsAction|data-lgs")
PERSIST_AFTER_S = 61    # the after-window outlasts any once-a-minute writer (vrserver's chaperone file, review R1 m8)


def _content_marker(path):
    """The first Glass Shell marker in a file (bytes), or None."""
    try:
        with open(os.path.expanduser(path), "rb") as f:
            data = f.read(16 * 1024 * 1024)
    except OSError as e:
        return f"unreadable: {e}"
    m = GS_MARKER.search(data)
    return m.group(0).decode("latin-1") if m else None
# What our own process may write during on/off (the audit hook below).
AUDIT_ALLOWED = re.compile(r"^(/tmp/lgs(/|$)|/dev/shm/lgs(/|$)|/dev/null$|/proc/self/|pipe:|socket:)")


def _persist_scan(marker):
    """Files and symlinks under PERSIST_DIRS modified after marker. Directories
    are left out: their mtime moves whenever anyone adds a file to them."""
    home = os.path.expanduser("~")
    dirs = [os.path.expanduser(d) for d in PERSIST_DIRS if os.path.isdir(os.path.expanduser(d))]
    cmd = ["find"] + dirs + ["-xdev", "(", "-path", os.path.join(home, ".local/share/Steam/steamapps"),
                             "-o", "-path", os.path.join(home, ".cache"), ")", "-prune",
                             "-o", "(", "-type", "f", "-o", "-type", "l", ")", "-newer", marker, "-print"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    out = set()
    for line in r.stdout.splitlines():
        if line == marker:
            continue
        out.add(("~" + line[len(home):]) if line.startswith(home + "/") else line)
    return out


class _WriteAudit:
    """sys.addaudithook: every path this process opens for writing, creates,
    removes or renames while active (RT-6: positive proof for our own process;
    the find scan covers the daemon and Steam)."""
    hooked = False
    active = None

    def __enter__(self):
        self.paths = set()
        _WriteAudit.active = self
        if not _WriteAudit.hooked:
            sys.addaudithook(_WriteAudit._hook)
            _WriteAudit.hooked = True
        return self

    def __exit__(self, *a):
        _WriteAudit.active = None

    @staticmethod
    def _hook(event, args):
        a = _WriteAudit.active
        if a is None:
            return
        try:
            if event == "open":
                path, mode, flags = args[0], args[1], args[2]
                writing = (isinstance(mode, str) and any(c in mode for c in "wax+")) or \
                          (isinstance(flags, int) and flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_APPEND))
                if writing and isinstance(path, (str, bytes)):
                    a.paths.add(os.path.abspath(os.fsdecode(path)))
            elif event in ("os.remove", "os.rmdir", "os.mkdir", "os.symlink", "os.link", "os.truncate", "os.utime",
                           "os.chmod", "shutil.rmtree", "shutil.copyfile", "shutil.move"):
                if args and isinstance(args[0], (str, bytes)):
                    a.paths.add(os.path.abspath(os.fsdecode(args[0])))
            elif event in ("os.rename", "os.replace"):
                for p in args[:2]:
                    if isinstance(p, (str, bytes)):
                        a.paths.add(os.path.abspath(os.fsdecode(p)))
        except Exception:  # noqa: BLE001 - an audit hook must never raise
            pass


def st_rt6(lab, ctx):
    """Persistence scan after on/off (runtime cycles, plus one full CLI cycle when
    native.lock is free). Three evidence sources: a write audit of this process,
    a find scan of every writable place (control windows before and after the
    test window remove what other agents and Steam wrote meanwhile), and the
    web storage of every Steam window."""
    import fcntl
    sys.dont_write_bytecode = True
    os.makedirs("/tmp/lgs", exist_ok=True)
    mark_c, mark_t, mark_a = "/tmp/lgs/p1-mark-control", "/tmp/lgs/p1-mark-test", "/tmp/lgs/p1-mark-after"
    for m in (mark_c, mark_t, mark_a):
        with open(m, "w"):
            pass
    syncl = open("/tmp/lgs/sync.lock", "a")
    fcntl.flock(syncl, fcntl.LOCK_SH)          # no sync while we look (ours use LOCK_SH too)
    native = open("/tmp/lgs/native.lock", "a")
    have_native = False

    def window(marker, seconds):
        os.utime(marker)
        time.sleep(1.1)                         # mtime granularity
        time.sleep(seconds)
        return _persist_scan(marker)
    try:
        control = window(mark_c, 8)             # before: nothing of ours runs (short; the after-window is 61 s)
        try:
            fcntl.flock(native, fcntl.LOCK_EX | fcntl.LOCK_NB)
            have_native = True
        except BlockingIOError:
            have_native = False
        os.utime(mark_t)
        time.sleep(1.1)
        t1 = time.time()
        with lab.Lock(both=True):
            with _WriteAudit() as audit:
                for _ in range(2):
                    op("on", quiet=True, flags={"rt.stubs": True})
                    op("off", quiet=True)
                full = None
                if have_native:
                    was = _st_shell_mode()
                    # back in the mode it was found in, never "auto" (review R1 m9; PLAN §7.1)
                    full = {"shellBefore": was, "off": (op("off", quiet=True, vr=True) or {}).get("shell"),
                            "on": (op("on", quiet=True, vr=True, native=(was if was in ("on", "off") else "off"))
                                   or {}).get("shell")}
                    if was is None:             # it was stopped when we came: stopped again
                        import lgs_shell
                        full["stoppedAgain"] = lgs_shell.stop()
                restore = _st_restore(lab)
            storage = _st_js(r"""(async () => { const out = {}; const rx = /lgs|glass/i;
              const scan = async (name, w) => {
                const hits = [];
                try { hits.push(...[...Object.keys(w.localStorage), ...Object.keys(w.sessionStorage)].filter((k) => rx.test(k))); } catch (e) { hits.push('storage n/a'); }
                try { if (w.indexedDB && w.indexedDB.databases) hits.push(...(await w.indexedDB.databases()).map((d) => 'idb:' + d.name).filter((k) => rx.test(k))); } catch (e) { /* none */ }
                try { hits.push(...String(w.document.cookie || '').split(';').map((c) => c.split('=')[0].trim()).filter((k) => rx.test(k)).map((k) => 'cookie:' + k)); } catch (e) { /* none */ }
                out[name] = hits;
              };
              await scan('shared', window);
              for (const p of g_PopupManager.m_mapPopups.values()) { try { await scan(String(p.m_strName).replace(/_uid\d+$/, ''), p.window); } catch (_) {} }
              return JSON.stringify(out); })()""")
        elapsed = time.time() - t1
        if elapsed < 8:
            time.sleep(8 - elapsed)
        test = _persist_scan(mark_t)
        after = window(mark_a, PERSIST_AFTER_S)  # after: nothing of ours runs
    finally:
        if have_native:
            fcntl.flock(native, fcntl.LOCK_UN)
        native.close()
        fcntl.flock(syncl, fcntl.LOCK_UN)
        syncl.close()
        for m in (mark_c, mark_t, mark_a):
            try:
                os.remove(m)
            except OSError:
                pass
    background = sorted((test & (control | after)))
    new = sorted(test - control - after)
    ours_written = sorted(audit.paths)
    audit_bad = [p for p in ours_written if not AUDIT_ALLOWED.match(p) and not TUNE_ALLOWED.match(p)]
    allowed, known, unexplained, checked = [], [], [], []
    for p in new:
        if any(rx.match(p) for rx in PERSIST_ALLOWED):
            allowed.append(p)
            continue
        if PERSIST_CONTENT_CHECKED.match(p):
            mark = _content_marker(p)
            if mark:
                unexplained.append(f"{p}  [Glass Shell marker {mark!r}]")
            else:
                checked.append(p)
            continue
        why = next((w for rx, w in PERSIST_KNOWN if rx.match(p)), None)
        if why:
            known.append(f"{p}  [{why}]")
        else:
            unexplained.append(p)
    # Attribution by writer (review R1 m8): the Glass Shell writers that ran in the test window are this
    # process (every write audited above), Steam's SharedJSContext (no file access; its web storage is
    # read above and content-checked) and, only when the full CLI cycle ran, the lgs-shell daemon. Without
    # the daemon, a file outside the install tree and outside Steam's storage cannot be ours: it is listed
    # as "notOurs" (SteamVR, Steam or another agent), never silently dropped.
    daemon_ran = bool(have_native and full)
    not_ours = []
    if not daemon_ran:
        for p in list(unexplained):
            if not p.startswith("~/.local/share/glass-shell") and "Glass Shell marker" not in p:
                not_ours.append(p)
                unexplained.remove(p)
    ours = [p for p in new if p.startswith("~/.local/share/glass-shell")]
    units = subprocess.run(["systemctl", "--user", "list-unit-files", "lgs*", "--no-legend"],
                           capture_output=True, text=True).stdout.strip()
    autostart = [n for d in ("~/.config/autostart", "~/.config/systemd/user") for n in
                 (os.listdir(os.path.expanduser(d)) if os.path.isdir(os.path.expanduser(d)) else [])
                 if "lgs" in n or "glass" in n]
    stor_bad = {k: v for k, v in (storage or {}).items() if v and v != "n/a" and v != ["storage n/a"]}
    # A unit file (not the transient runtime unit) or an autostart entry would survive a reboot.
    persistent_units = [ln for ln in units.splitlines() if ln.strip() and " transient" not in ln]
    ours_bad = [p for p in ours if not re.search(r"/__pycache__/[\w.-]+\.pyc$", p) and not SYNCED_SOURCE.match(p)]
    ok = not unexplained and not ours_bad and not persistent_units and not autostart and not stor_bad and not audit_bad
    return ok, {"newInTestWindow": len(new), "background": len(background), "allowed": allowed[:40],
                "known": known[:40], "unexplained": unexplained, "underGlassShell": ours,
                "notOurs": not_ours, "daemonRanInWindow": daemon_ran,
                "steamStorageContentChecked": checked[:40],
                "windowsS": {"before": 8, "after": PERSIST_AFTER_S},
                "auditOurProcess": {"written": ours_written[:60], "outsideAllowed": audit_bad},
                "unitFiles": units or None, "persistentUnits": persistent_units, "autostart": autostart,
                "webStorage": stor_bad or "none",
                "fullCliCycle": full if have_native else "skipped: native.lock busy", "restore": restore}


IDLE_MS_PER_S = 1.0


def _median(xs):
    xs = sorted(xs)
    n = len(xs)
    return None if not n else (xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2)


def st_rt7(lab, ctx):
    """perf main on /library/tab/AllGames: theme only ("css") vs theme + the
    default runtime, idle ("rt"), in ABBA order (css rt rt css ...) so drift
    cancels, 4 pairs; a second round of 4 pairs is pooled in when the first
    fails (the device is shared: compiles, other agents' steps).
    Pass: median rt fps >= 95 % of median css fps; median long frames (> 34 ms)
    per run at most the css median + its A/A spread (min 1); the runtime's own
    idle work (its 250 ms tick, measured in the page) under IDLE_MS_PER_S,
    i.e. under 0.1 % of one core."""
    runs, idle = [], None

    def one(mode):
        nonlocal idle
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

    def verdict():
        cf = [r["fps"] for r in runs if r["mode"] == "css"]
        rf = [r["fps"] for r in runs if r["mode"] == "rt"]
        cl = [r["long"] for r in runs if r["mode"] == "css"]
        rl = [r["long"] for r in runs if r["mode"] == "rt"]
        spread = max(1, max(cl) - min(cl))
        ratio = _median(rf) / max(0.1, _median(cf))
        extra = _median(rl) - _median(cl)
        idle_ok = bool(idle) and idle.get("tickMsPerSecond", IDLE_MS_PER_S) < IDLE_MS_PER_S
        return (ratio >= 0.95 and extra <= spread and idle_ok), {
            "fpsMedian": {"css": _median(cf), "rt": _median(rf)}, "fpsRatio": round(ratio, 3),
            "fpsPerRun": {"css": cf, "rt": rf},
            "longPerRun": {"css": cl, "rt": rl, "medianExtra": extra, "aaSpread": spread},
            "p95Max": {"css": max(r["p95"] for r in runs if r["mode"] == "css"),
                       "rt": max(r["p95"] for r in runs if r["mode"] == "rt")},
            "runtimeIdle": idle, "idleBudgetMsPerS": IDLE_MS_PER_S}

    rounds = 0
    with lab.Lock():
        route = lab.lab_js("L.route()")
        lab.lab_js("L.nav('/library/tab/AllGames')")
        time.sleep(1.5)
        for rounds in (1, 2):
            for mode in ("css", "rt", "rt", "css") * 2:
                one(mode)
            ok, res = verdict()
            if ok:
                break
        try:
            os.remove("/tmp/lgs/p1-perf.png")
        except OSError:
            pass
        if route and route != "/library/tab/AllGames":
            lab.lab_js(f"L.nav({json.dumps(route)})")
        restore = _st_restore(lab)
    return ok, dict(res, rounds=rounds, runs=runs, routeRestored=route, restore=restore)


HOOKS_JS = r"""(async () => {
  const R = __LGS_RT, out = {}, W = (ms) => new Promise((r) => setTimeout(r, ms));
  const html = () => R.windows.main().html;
  const cls = () => ({ pad: html().classList.contains('lgs-input-pad'), laser: html().classList.contains('lgs-input-laser'),
    vr: html().getAttribute('data-lgs-vr-mode'), mode: R.input ? R.input.mode : null });
  out.inputInstalled = R.has('input');
  out.live = cls();
  let r = R.test.input.set('pad', { vrMode: 'gamepad', ttlMs: 1500 });
  out.pad = Object.assign({ applied: r.applied, get: R.test.input.get() }, cls());
  r = R.test.input.set('laser', { vrMode: 'laser', ttlMs: 1500 });
  out.laser = Object.assign({ applied: r.applied, get: R.test.input.get() }, cls());
  await W(1900);
  out.expired = Object.assign({ get: R.test.input.get() }, cls());
  out.withInside = await R.test.flags.with({ 'rt.stubs': false }, async (rt) => rt.module('rt.stub.a').state);
  out.withAfter = R.module('rt.stub.a').state;
  const tok = R.test.flags.push({ 'rt.stubs': false }, { ttlMs: 1200 });
  await R.settled();
  out.pushed = { state: R.module('rt.stub.a').state, token: typeof tok };
  await W(1500); await R.settled();
  out.ttlExpired = { state: R.module('rt.stub.a').state, overlays: R.test.flags.list().length };
  out.actionsOn = R.test.actions.enabled();
  out.echo = await R.action('echo', { text: 'p1-rt' }, { src: 'main' });
  out.bridge = R.status().bridge;
  out.exposed = R.status().exposed;
  return JSON.stringify(out);
})()"""


def st_rth(lab, ctx):
    """P1 build item 2, live: the test hooks (input-mode stub through P3's
    rt.input.stub, TTL expiry, flags.with / push TTL, action logger on inside a
    locked step), rt.expose (stub c, P3's members) and a daemon action round
    trip (echo) with the bridge it rides on. Not a PLAN acceptance id."""
    with lab.Lock():
        op("on", quiet=True)
        mods = {m["name"]: m for m in (_st_status() or {}).get("modules", [])}
        flags = {"rt.stubs": True}
        if (mods.get("input") or {}).get("flag"):
            flags[mods["input"]["flag"]] = True
        op("on", quiet=True, flags=flags)
        res = _jsonish(_st_js(HOOKS_JS, 60))
        restore = _st_restore(lab)
    res = res or {}
    live, pad, laser, exp = res.get("live") or {}, res.get("pad") or {}, res.get("laser") or {}, res.get("expired") or {}
    echo = res.get("echo") or {}
    daemon = _st_shell_mode()
    checks = {
        "inputInstalled": res.get("inputInstalled") is True,
        "padStub": pad.get("applied") and pad.get("get") == "pad" and pad.get("pad") and not pad.get("laser")
        and pad.get("mode") == "pad" and pad.get("vr") == "gamepad",
        "laserStub": laser.get("applied") and laser.get("get") == "laser" and laser.get("laser") and not laser.get("pad")
        and laser.get("mode") == "laser" and laser.get("vr") == "laser",
        "stubExpired": exp.get("get") is None and {k: exp.get(k) for k in ("pad", "laser", "mode")}
        == {k: live.get(k) for k in ("pad", "laser", "mode")},
        "flagsWith": res.get("withInside") == "off" and res.get("withAfter") == "installed",
        "flagsPushTtl": (res.get("pushed") or {}).get("state") == "off"
        and (res.get("ttlExpired") or {}).get("state") == "installed" and (res.get("ttlExpired") or {}).get("overlays") == 0,
        "actionLoggerOnInStep": res.get("actionsOn") is True,
        "exposed": (res.get("exposed") or {}).get("rtStubC") == "rt.stub.c",
        "daemonEcho": (echo.get("ok") and (echo.get("result") or {}).get("echo") == "p1-rt")
        or (daemon is None and echo.get("error") == "no-daemon"),
    }
    return all(bool(v) for v in checks.values()), {"checks": checks, "result": res, "daemon": daemon, "restore": restore}


INDEX_STATE_JS = r"""JSON.stringify((() => {
  const ix = window.__LGS_INDEX, core = window.__LGS, ch = window.webpackChunksteamui || [];
  const st = core ? core.status() : null;
  return { cached: !!(ix && ix.selector), size: ix ? ix.size : null, ok: ix ? ix.ok : null, current: ix && ix.current ? ix.current() : null,
    enabled: !!(st && st.enabled), version: st ? st.version : null, classModules: st ? st.classModules : null,
    unresolved: st ? st.unresolved.length : null, index: st ? st.index : null, runtime: window.__LGS_RT ? window.__LGS_RT.status().runtime : null,
    probeRecords: ch.filter((c) => c && Array.isArray(c[0]) && typeof c[0][0] === 'symbol' && c[0][0].description === 'lgs-index').length };
})())"""
PLANT_BAD_INDEX_JS = ("(() => { window.__LGS_INDEX = { selector: () => ({ err: 'unresolved' }), resolve: () => ({ err: 'unresolved' }),"
                      " size: 3, mods: [], byKey: new Map() }; return 1; })()")


def _log_lines_since(t0, pattern):
    """lgs.log lines written since t0 (HH:MM:SS stamps, same day) that match pattern."""
    stamp = time.strftime("%H:%M:%S", time.localtime(t0 - 1))
    out = []
    for path in (LOG + ".1", LOG):
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                out += [ln.rstrip() for ln in f if ln[:8] >= stamp and re.search(pattern, ln)]
        except OSError:
            pass
    return out


def st_rti(lab, ctx):
    """Review R1 M1, live: (a) a harvest forced short (floor 100000 modules) waits with
    backoff, logs each attempt, gives up after the bound and changes nothing (theme,
    version and runtime as before); (b) a bad cached index (3 modules, the 06:50
    incident) is rebuilt by the next "on"; (c) also by off + on; no probe chunk record
    is left in Steam's webpack array. Not a PLAN id."""
    out = {}
    with lab.Lock():
        op("on", quiet=True)
        base = _st_js(INDEX_STATE_JS)
        t0 = time.time()
        forced = op("on", quiet=True, wait=12, min_modules=100000)
        out["forced"] = {"result": {k: forced.get(k) for k in ("enabled", "version", "index", "runtime")},
                         "seconds": round(time.time() - t0, 1), "after": _st_js(INDEX_STATE_JS),
                         "log": _log_lines_since(t0, r"index: (attempt|gave up)")}
        _st_js(PLANT_BAD_INDEX_JS)
        op("on", quiet=True)
        out["rebuilt"] = _st_js(INDEX_STATE_JS)
        _st_js(PLANT_BAD_INDEX_JS)
        op("off", quiet=True)
        op("on", quiet=True)
        out["offOn"] = _st_js(INDEX_STATE_JS)
        out["restore"] = _st_restore(lab)
    out["base"] = base
    f, fa = out["forced"]["result"], out["forced"]["after"]

    def good(x):
        return bool(x) and x.get("cached") and x.get("ok") is True and (x.get("size") or 0) >= MIN_CLASS_MODULES \
            and x.get("enabled") and x.get("unresolved") == base.get("unresolved") and x.get("probeRecords") == 0
    checks = {
        "baseHealthy": good(base),
        "forcedGaveUp": (f.get("index") or {}).get("state") == "gave-up" and (f.get("index") or {}).get("attempts", 0) >= 3,
        "forcedBackoffLogged": len([ln for ln in out["forced"]["log"] if "attempt" in ln]) >= 3
        and any("gave up" in ln for ln in out["forced"]["log"]),
        "forcedChangedNothing": bool(fa.get("enabled")) and fa.get("version") == base.get("version")
        and fa.get("runtime") == base.get("runtime") and not fa.get("cached"),
        "forcedWithinBound": out["forced"]["seconds"] < 12 + 10,
        "badCacheRebuilt": good(out["rebuilt"]),
        "offOnRecovers": good(out["offOn"]),
    }
    return all(bool(v) for v in checks.values()), dict(out, checks=checks)


TOAST_PROBE_JS = r"""(async () => {
  const W = (ms) => new Promise((r) => setTimeout(r, ms));
  const doc = SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.BrowserWindow.document, win = doc.defaultView;
  // theme on: show it here (animations sampled at 40 ms); theme off: lgs.py showed the "Off" toast just before
  if (window.__LGS) window.__LGS.toast('LiquidAss  ·  On');
  else for (let i = 0; i < 20 && !doc.getElementById('lgs-toast'); i++) await W(50);
  await W(40);
  const t = doc.getElementById('lgs-toast');
  if (!t) return JSON.stringify({ present: false });
  // every animation while it runs (the materialize lasts 250 ms)
  const anims = [t, ...t.children].flatMap((el) => el.getAnimations()).map((a) => {
    const k = a.effect.getKeyframes(), tm = a.effect.getTiming();
    return { props: [...new Set(k.flatMap((f) => Object.keys(f).filter((x) => !['offset', 'computedOffset', 'easing', 'composite'].includes(x))))],
      duration: tm.duration, easing: String(tm.easing).slice(0, 24) };
  });
  await W(560);   // at rest
  const cs = win.getComputedStyle(t), r = t.getBoundingClientRect();
  // plain values now: the declaration is live and empties once the toast is removed
  const look = { radius: cs.borderTopLeftRadius, border: cs.borderTopWidth, outline: cs.outlineStyle, boxShadow: cs.boxShadow,
    backdrop: cs.backdropFilter, bg: cs.backgroundColor, opacity: cs.opacity };
  // small controls of the top rows (they start above the toast) that it would cover
  const covers = [...doc.querySelectorAll('button, input, [role="button"], [role="tab"], [tabindex], .Focusable')].filter((e) => {
    if (e === t || t.contains(e)) return false;
    const q = e.getBoundingClientRect();
    return q.width > 0 && q.height > 0 && q.height <= 120 && q.top < r.top && q.bottom > r.top && q.right > r.left && q.left < r.right;
  }).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].slice(0, 2).join('.'));
  const t1 = performance.now();
  while (doc.getElementById('lgs-toast') && performance.now() - t1 < 4000) await W(50);
  return JSON.stringify(Object.assign({ present: true, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    view: { w: win.innerWidth, h: win.innerHeight }, cls: t.className, mat: t.getAttribute('data-lgs-mat'), anims,
    reduce: win.matchMedia('(prefers-reduced-motion: reduce)').matches, covers, goneAfterMs: Math.round(600 + performance.now() - t1) }, look));
})()"""


def st_rtt(lab, ctx):
    """Review R1 M3, live: the on/off toast is panel glass without a ring (no
    spread-only box-shadow, no border or outline), radius 30, 320 x 76, clear of
    the top row's controls, and moves on P5's tokens: materialize 250 ms linear +
    translate on snappy (488 ms) with content 250 ms; under Reduce Motion one
    opacity fade of 180 ms (P10's MediaHold emulates the media feature). Removed
    by its own timer. Not a PLAN id."""
    out = {}
    with lab.Lock():
        op("on", quiet=True)
        for media in ([], ["reduce"]):
            name = "reduce" if media else "normal"
            hold = lab.MediaHold(media) if media else None
            if hold:
                hold.start()
            try:
                out[name] = _jsonish(_st_js(TOAST_PROBE_JS, 30))
            finally:
                if hold:
                    hold.stop()
        # theme off: the "Off" toast with the literal fallbacks (no theme tokens, no E3 edge)
        op("off", quiet=True)
        op("toast", text="LiquidAss  ·  Off")
        out["themeOff"] = _jsonish(_st_js(TOAST_PROBE_JS, 30))
        out["restore"] = _st_restore(lab)
    n, rd, to = out.get("normal") or {}, out.get("reduce") or {}, out.get("themeOff") or {}
    ring = re.compile(r"(^|,\s*)(rgba?\([^)]*\)\s+)?0px 0px 0px [0-9.]+px")
    na = n.get("anims") or []

    def props(a):
        return set(a.get("props") or [])
    checks = {
        "present": bool(n.get("present")),
        "noRing": not ring.search(n.get("boxShadow") or "") and n.get("border") == "0px" and n.get("outline") == "none",
        "panelGlass": "lgs-glass" in (n.get("cls") or "") and n.get("mat") == "panel",
        "radius30": n.get("radius") == "30px",
        "size320x76": (n.get("rect") or {}).get("w") == 320 and (n.get("rect") or {}).get("h") == 76,
        "clearOfTopRow": n.get("covers") == [],
        "motionTokens": any(a.get("duration") == 250 and "opacity" in props(a) and "scale" in props(a) for a in na)
        and any(a.get("duration") == 488 and "translate" in props(a) for a in na)
        and all(a.get("duration") in (250, 350, 488) for a in na),
        "reduceFadeOnly": bool(rd.get("present")) and rd.get("reduce") is True and bool(rd.get("anims"))
        and all(props(a) == {"opacity"} and a.get("duration") == 180 for a in rd.get("anims") or []),
        "opaqueAtRest": n.get("opacity") == "1" and "blur" in (n.get("backdrop") or ""),
        "themeOffSameLook": bool(to.get("present")) and all(to.get(k) == n.get(k) for k in ("radius", "border", "outline", "bg", "backdrop", "boxShadow"))
        and (to.get("rect") or {}).get("w") == 320 and (to.get("rect") or {}).get("h") == 76,
        "removed": (n.get("goneAfterMs") or 99999) <= 2700 and (rd.get("goneAfterMs") or 99999) <= 2700,
    }
    return all(bool(v) for v in checks.values()), dict(out, checks=checks)


SELFTESTS = [("RT-1", st_rt1), ("RT-2", st_rt2), ("RT-3", st_rt3), ("RT-4", st_rt4),
             ("RT-5", st_rt5), ("RT-6", st_rt6), ("RT-7", st_rt7), ("RT-H", st_rth),
             ("RT-I", st_rti), ("RT-T", st_rtt)]


def selftest_main(args, opts):
    sys.dont_write_bytecode = True
    # --mode=pad|laser (or "--mode pad"): every locked step runs with the lab's input-mode stub
    argv = sys.argv[1:]
    mode = next((a.split("=", 1)[1] for a in argv if a.startswith("--mode=")), None)
    if "--mode" in argv and argv.index("--mode") + 1 < len(argv):
        mode = argv[argv.index("--mode") + 1]
    args = [a for a in args if a not in ("pad", "laser")]
    want = {a.strip().upper() for a in (args[0].split(",") if args else []) if a.strip()}
    sys.path.insert(0, os.path.join(ROOT, "lab"))
    sys.modules.setdefault("lgs", sys.modules[__name__])   # one lgs module for us and the lab
    import lab as labmod
    if mode in ("pad", "laser"):
        labmod.STEP["mode"] = mode
    try:
        build = labmod.steam_build()
    except Exception:  # noqa: BLE001
        build = "unknown"
    results, ctx = [], {}
    for tid, fn in SELFTESTS:
        if want and tid not in want:
            continue
        t0 = time.time()
        print(f"START {tid} {time.strftime('%H:%M:%S')}", flush=True)   # a line before any lock wait (review R1 m7)
        shell0 = _st_shell_mode()
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
        # The daemon exits by itself after 3 s of theme off (P8); a test's off phases can
        # trigger that. A unit running when the test began runs again, in the same mode.
        if shell0 in ("on", "off"):
            time.sleep(1.2)                  # one daemon poll: a teardown it decided on has begun
        shell1 = _st_shell_mode()
        if shell0 in ("on", "off") and shell1 is None:
            try:
                res["shellRestarted"] = _shell_start(shell0)
            except Exception as e:  # noqa: BLE001
                res["shellRestarted"] = f"error: {e!r}"
        res["shell"] = {"before": shell0, "after": _st_shell_mode()}
        res["seconds"] = round(time.time() - t0, 1)
        results.append(res)
        print(f"{'PASS' if res['pass'] else 'FAIL'} {tid} ({res['seconds']} s)", flush=True)
    out = {"date": time.strftime("%Y-%m-%dT%H:%M:%S"), "steamBuild": build, "mode": mode or "live",
           "results": results, "pass": all(r["pass"] for r in results)}
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


LAB_LOCK = "/tmp/lgs/lab.lock"
CLI_LOCK_WAIT_S = 90


def _cli_lab_lock():
    """CLI on/off/toggle/reload/dial on a device where the lab runs (/tmp/lgs/lab.lock
    exists): wait, bounded, for a locked lab step to end, so a reload never replaces
    the runtime in the middle of another agent's step (PLAN §7.1; seen in review R1's
    re-run: an unlocked `lgs on --css` removed __LGS_RT inside RT-3). After
    CLI_LOCK_WAIT_S it goes on without the lock (a user's toggle must not hang).
    LGS_NO_LAB_LOCK=1 skips it. Callers that already hold lab.lock use op(), not the CLI."""
    if os.environ.get("LGS_NO_LAB_LOCK") or not os.path.exists(LAB_LOCK):
        return None
    import fcntl
    try:
        f = open(LAB_LOCK, "a")
    except OSError:
        return None
    t0, told = time.time(), False
    while True:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            break
        except BlockingIOError:
            if time.time() - t0 >= CLI_LOCK_WAIT_S:
                log(f"cli: lab.lock busy for {CLI_LOCK_WAIT_S} s; going on without it")
                f.close()
                return None
            if not told and time.time() - t0 > 1:
                print("lgs: waiting for a locked lab step to end (lab.lock)", file=sys.stderr, flush=True)
                told = True
            time.sleep(0.25)
    if time.time() - t0 > 1:
        log(f"cli: waited {time.time() - t0:.1f} s for lab.lock")
    return f


def _cli_lab_unlock(f):
    if f is None:
        return
    try:
        import fcntl
        fcntl.flock(f, fcntl.LOCK_UN)
    finally:
        f.close()


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
    held = _cli_lab_lock() if cmd in ("toggle", "on", "off", "reload", "dial") else None
    try:
        if cmd == "toggle":
            cmd = "off" if is_on() else "on"
        if cmd == "reload":
            res = op("on", quiet=True, vr=True, native=None, flags=cli_flags, rt=rt)
        elif cmd == "dial":
            v = min(1.0, max(0.0, float(args[1])))
            write_tune(dict(read_tune(), dial=v))      # the wearer's tune: kept, like the paintbrush panel's
            with open(DIAL, "w", encoding="utf-8") as f:
                f.write(f"{v:g}\n")
            res = op("on", quiet=True, vr=True, native=None) if is_on() else {"dial": v, "enabled": False}
            if isinstance(res, dict) and res.get("enabled"):
                op("toast", text=f"Glass  ·  {round((1 - v) * 100)}% clear")
        elif cmd == "toast":
            res = op("toast", text=" ".join(args[1:]) or "LiquidAss")
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
    finally:
        _cli_lab_unlock(held)
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
