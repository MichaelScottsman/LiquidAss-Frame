#!/usr/bin/env python3
"""Glass Shell native layer daemon: the transient user unit "lgs-shell".

While the theme is on, this keeps SteamVR's own pages themed (what the old
"lgs-vr" watcher did). With the native layer opted in (lgs on --native), it
also joins three things (docs/NATIVE.md):

  Steam (devtools 8080, SharedJSContext)
      device/lgs_layers.js reports the elements that pop out, through the CDP
      binding "lgsLayers"; html.lgs-native is set on a window, and popped
      elements are acknowledged (data-lgs-pop), only once the compositor
      shows their glass
  glassd (native/glassd/glassd, a child process)
      renders the room-refracting window glass and the Liquid Glass slabs
      into dmabuf overlays "glassd.<surface>"; it reads /dev/shm/lgs/glassd.json
      and answers in /dev/shm/lgs/glassd-out.json
  SteamVR systemui (devtools 8090)
      device/lgs_sg.js builds the scene-graph nodes that layer glassd's glass
      and crops of Steam's own textures in stereo depth (window.__LGS_SG)

Native mode is decided once when the daemon starts (native = auto | on | off;
auto reads /tmp/lgs/flags.json, then device/defaults.json, and is CSS only
unless one of them says native: on): a glassd binary that appears later is
never picked up, and one that disappears ends native mode for the session.
Without it (the default, and what the "+ > Launch Program" toggle runs) the
daemon is CSS only: SteamVR page theming, no reporter in Steam, no glassd, no
camera, and in systemui only what a flagged transform override or a window
dim needs (lgs_sg.js, contracts/sg.md §4-5).

In both modes it also (docs/phase2/contracts/daemon.md):
  - publishes geometry (S, r, Hm, the frame menu's panel) and the shown frame
    page from systemui to Steam's runtime bridge (__LGS_RT.bridge);
  - relays Steam's "lgsAction" binding calls to device/shell_ext plugins,
    strictly validated and rate-limited;
  - injects SteamVR page scripts device/vr/<page>.<name>.js and removes them
    again.

Nothing persists: the unit is transient (systemd-run --collect) and writes no
bytecode (python3 -B); lgs off stops it at once. A theme off without lgs off
(a lab --stock step) makes it dormant: native layer, glassd, reporter and scene
graph off, SteamVR page theming kept; it resumes when the theme is back and
exits after shellThemeGraceS (600 s), at once after a Steam restart, or after
120 s without Steam (contracts/daemon.md §1). On exit it removes every node,
class, binding global and file it made. If it dies without cleaning up,
lgs-native clears itself within 3 s and the scene-graph nodes within 12 s
(heartbeat watchdogs).

  lgs_shell.py start [--native|--css|--auto] [--glassd PATH|none]
                     [--glassd-args "ARGS"] [--feed] [--stay]
                     [--test-report PATH] [--assume-caps CAPS]
                                            start the unit; lgs on does this.
                                            --native opts in to the native layer
                                            (from this command glassd gets
                                            --no-feed unless --feed or
                                            --glassd-args is given); --css is CSS
                                            only; neither (or --auto) keeps a
                                            running unit and resolves "auto" for
                                            a new one. --stay (lab tests and
                                            native-session only): dormant up to
                                            STAY_MAX_S while the theme is off,
                                            and native only for STAY_MAX_S.
                                            --test-report (lab) replaces the
                                            reporter with a report JSON file.
  lgs_shell.py stop                         stop it (clean teardown)
  lgs_shell.py status                       unit + live daemon status (JSON)
  lgs_shell.py selftest NAME                lab checks: actions (offline), dm1,
                                            dm2, dm3, dm4, dm5, dm6, grace,
                                            plates (contract §11)
  lgs_shell.py daemon [--native] [--glassd PATH|none] ...
                                            the unit's process (foreground)
"""
import sys

sys.dont_write_bytecode = True     # no __pycache__ next to the code (hard rule 7); the unit also runs -B
import asyncio  # noqa: E402
import collections  # noqa: E402
import hashlib  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import signal  # noqa: E402
import subprocess  # noqa: E402
import time  # noqa: E402
import traceback  # noqa: E402
import urllib.request  # noqa: E402
import weakref  # noqa: E402

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, HERE)
import lgs  # noqa: E402
import lgs_vr  # noqa: E402
import shell_ext  # noqa: E402

UNIT = "lgs-shell"
SHM = "/dev/shm/lgs"
GLASSD_JSON = os.path.join(SHM, "glassd.json")
GLASSD_OUT = os.path.join(SHM, "glassd-out.json")
STATUS = os.path.join(SHM, "shell.json")
SG_FLAGS = "/tmp/lgs/sg-flags.json"  # optional lgs_sg.js panel flags (wearer tests; transient)
FLAGS_FILE = "/tmp/lgs/flags.json"   # session flags (RAM; P10 writes it for a locked step)
DEFAULTS_FILE = os.path.join(HERE, "defaults.json")   # V1's shipped defaults (PLAN §1.17)
GLASSD_BIN = os.path.join(lgs.ROOT, "native", "glassd", "glassd")
LAYERS_JS = os.path.join(HERE, "lgs_layers.js")
LAYERS_CFG = os.path.join(lgs.THEME_DIR, "layers.json")      # Phase 1 configuration (retired by P6)
LAYERS_DIR = os.path.join(lgs.THEME_DIR, "layers")           # Phase 2 fragments, name order
SG_JS = os.path.join(HERE, "lgs_sg.js")
SG_RULES_DIR = os.path.join(lgs.THEME_DIR, "sg")              # transform overrides (contracts/sg.md §4)
MOTION_JS = os.path.join(HERE, "shared", "motion.js")         # P5's springs, prepended to lgs_sg.js
VR_SCRIPT_DIRS = (os.path.join(HERE, "vr"), "/tmp/lgs/vr-scripts")   # page scripts; the second for tests
VR_PAUSE = lgs_vr.PAUSE

BINDING = "lgsLayers"
ACTION_BINDING = "lgsAction"       # Steam -> daemon actions (shell_ext)
REPORTER = "__LGS_LAYERS"          # global installed by lgs_layers.js
STEAM_MAIN_KEY = "valve.steam.gamepadui.main"
DAEMON_BEAT_S = 2.0                # bridge 'daemon' heartbeat; its ttlMs is 3x this
GEOM_POLL_S = 1.0                  # systemui geometry and page poll
GEOM_DUMP_S = 15.0                 # DumpLaserOverlays (a ~100 ms compositor round trip) as a safety net this often;
GEOM_DUMP_AFTER = (1.0, 3.0, 6.0)  # ... and these many s after the frame menu's node changed (the dump lags it)
ACTION_TICK_S = 1.0                # plugin scan and tick
RAMP_IN_MS = {"window": 735, "thick": 735}     # GM §5.2: covers and thick ride sheet-in (settles ~0.73 s)
RAMP_OUT_MS = {"window": 514, "thick": 514}    # sheet-out (~0.51 s)
RAMP_IN_DEFAULT_MS, RAMP_OUT_DEFAULT_MS, RAMP_REDUCED_MS = 250, 350, 180
# glassd.json v3 fields copied from the report, and the glassd cap each needs
# (contracts/glassd.md; contracts/daemon.md §7)
SURF_V3 = {"plates": "plates", "coverDz": "coverDz", "masks": "masks", "scaleFrom": "scaleFrom"}
SURF_V2 = ("quad", "phase", "appear", "phaseMs")
SLAB_V3 = {"tint": "tint", "hole": "holes", "ox": "offset", "oy": "offset"}
SLAB_V2 = ("phase", "appear", "phaseMs")
PLATE_KEYS = ("id", "x", "y", "w", "h", "r", "material", "phase", "appear", "phaseMs", "tint", "fill",
              "occluder", "shadow")
TOP_V3 = {"unitM": "unitM", "masks": "masks", "roomDim": "roomDim"}
COVER_DZ, BASE_DZ = 0.001, 0.002   # metres toward the viewer (NATIVE.md)
SG_MAX_PUSH_HZ = 15                # lgs_sg.js scheduler pushes per second, at most
SPEC_MIN_INTERVAL = 1 / SG_MAX_PUSH_HZ
GLASSD_JSON_MIN_INTERVAL = 0.25    # position-only changes to glassd.json
WATCHDOG_MS = 12000                # lgs_sg.js clears its nodes without a heartbeat this long
NATIVE_TTL_MS = 3000               # lgs-native clears itself without a heartbeat this long (< WATCHDOG_MS)
NATIVE_BEAT_S = 1.0                # lgs-native / ack heartbeat
SHOWN_MS = 350                     # a pushed scene-graph change is on screen after this (fact 4: ~0.3 s)
SG_BEAT_FRESH_S = 2.5              # lgs-native needs a systemui heartbeat this recent
STILL_S = 0.15                     # a layer pops once its rect has been still this long
STILL_PX = 2.0                     # ... within this many texture px
OVERLAP_CLIP_PX = 2.5              # overlaps this thin are trimmed off, wider ones skip the layer
SLAB_SIZE_TOL_PX = 2.5             # glassd slab vs element x backdropScale
THEME_OFF_POLLS = 3                # Steam theme seen off this many polls (1 s) -> dormant (or exit)
THEME_OFF_GRACE_S = 600            # ... dormant this long before exiting (flag shellThemeGraceS; 0 = exit)
STAY_MAX_S = 2400                  # --stay: dormant at most this long, and native at most this long after start
                                   # (glass.py's native-session client gives up after 2400 s; a unit older than
                                   # that has lost its client, e.g. a usage-limit cut-off)
STEAM_GONE_S = 120                 # Steam's devtools unreachable this long -> exit (also with --stay)
STEAM_SLOW_MAX = 3                 # evaluations timing out in a row before the Steam socket is dropped
GLASSD_MAX_CRASHES = 5             # within GLASSD_CRASH_WINDOW s -> give up (CSS only)
GLASSD_CRASH_WINDOW = 120
GLASSD_TEMP_EXIT = 75              # EX_TEMPFAIL from glassd: SteamVR gone, lock held; not a crash
GLASSD_STALE_S = 6.0               # glassd rewrites glassd-out.json every 2 s ("updated")
GLASSD_FIRST_OUT_S = 20.0          # time for glassd's first glassd-out.json
MAIN_QUAD_W = 0.98                 # main window's nominal world width (m), NATIVE.md fact 4
MAIN_QUAD_TOL = 0.12               # glassd's quadW off by more than this: main stays CSS only
BUG_LIMIT, BUG_WINDOW = 5, 120     # unexpected exceptions in one loop before it is fatal
SPEC_LOG_MIN_S = 1.0               # "systemui: spec" log lines at most this often
START_LOCK = "/tmp/lgs/shell-start.lock"   # serializes start() (two `lgs on` at once; RAM)
TEST_EXT_DIR = "/tmp/lgs/shell-ext-test"   # lab: RAM plugins (kinds echo / read only), selftest dm4


def _net_errors():
    errs = (ConnectionError, OSError, RuntimeError, asyncio.TimeoutError, TimeoutError, ValueError, EOFError)
    try:
        import aiohttp
        errs += (aiohttp.ClientError,)   # WSServerHandshakeError, ServerDisconnectedError, ...
    except ImportError:
        pass
    return errs


NET_ERRORS = _net_errors()             # a lost or refused devtools connection: retry


def log(msg):
    print(time.strftime("%H:%M:%S ") + msg, flush=True)
    lgs.log("shell: " + msg)


def write_json_atomic(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    os.replace(tmp, path)


def read_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def remove_glassd_files():
    for p in (GLASSD_JSON, GLASSD_OUT):
        try:
            os.remove(p)
        except OSError:
            pass


def read_dial():
    try:
        with open(lgs.DIAL, encoding="utf-8") as f:
            return min(1.0, max(0.0, float(f.read().strip())))
    except (OSError, ValueError):
        return 0.5


def http_json(url, timeout=3):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.load(r)


# ------------------------------------------------------------------ flags and the native decision

def flat_flags(d):
    """A flags file is flat ({"native": "on"}) or nested ({"flags": {...}})."""
    if not isinstance(d, dict):
        return {}
    if isinstance(d.get("flags"), dict):
        out = {k: v for k, v in d.items() if k != "flags"}
        out.update(d["flags"])
        return out
    return dict(d)


class FlagReader:
    """defaults.json < /tmp/lgs/flags.json, re-read when either file changes."""

    def __init__(self, paths=(DEFAULTS_FILE, FLAGS_FILE)):
        self.paths = paths
        self.cache = {}
        self.merged = {}
        self.sig = None

    def read(self):
        sig = []
        for p in self.paths:
            try:
                sig.append(os.stat(p).st_mtime_ns)
            except OSError:
                sig.append(None)
        sig = tuple(sig)
        if sig != self.sig:
            self.sig = sig
            m = {}
            for p, s in zip(self.paths, sig):
                if s is not None:
                    m.update(flat_flags(read_json(p)))
            self.merged = m
        return self.merged


def native_word(v):
    if v is True or v in ("on", "true", "1", 1):
        return "on"
    if v is False or v in ("off", "false", "0", 0):
        return "off"
    return "auto"


def resolve_native(requested):
    """(native: bool, source, reason) for start(native=requested). 'auto' reads
    /tmp/lgs/flags.json, then device/defaults.json; 'auto' in a file means
    "not decided" and falls through; the built-in end of the chain is CSS only."""
    req = native_word(requested) if requested is not None else "auto"
    if req != "auto":
        return req == "on", "cli", None if req == "on" else "CSS only requested (lgs on --css)"
    for src, path in (("flags", FLAGS_FILE), ("defaults", DEFAULTS_FILE)):
        v = native_word(flat_flags(read_json(path)).get("native"))
        if v != "auto":
            return v == "on", src, None if v == "on" else f"native=auto: native off in {path}"
    return False, "builtin", "native=auto: the native gate has not passed (device/defaults.json has no native: on)"


def css_reason_for(req, src):
    if req == "off":
        return "CSS only requested (lgs on --css)"
    if req == "auto":
        if src == "builtin":
            return "native=auto: the native gate has not passed (device/defaults.json has no native: on)"
        return f"native=auto: native off in {FLAGS_FILE if src == 'flags' else DEFAULTS_FILE}"
    return "native layer not requested; lgs on --native opts in"


def json_files(folder):
    """*.json in name order, skipping _wip/ and dot files."""
    try:
        names = sorted(n for n in os.listdir(folder) if n.endswith(".json") and not n.startswith((".", "_")))
    except OSError:
        return []
    return [os.path.join(folder, n) for n in names]


def layers_config():
    """The reporter's configuration: theme/layers/*.json as [{file, ...}] in name
    order (contracts/reporter.md §3.1), else Phase 1's theme/layers.json object.
    Returns (config, errors, version)."""
    errors, frags = [], []
    for p in json_files(LAYERS_DIR):
        d = read_json(p)
        if isinstance(d, dict):
            frags.append(dict(d, file=os.path.basename(p)))
        else:
            errors.append(f"{os.path.basename(p)}: not a JSON object")
    if frags:
        cfg = frags
    else:
        cfg = read_json(LAYERS_CFG) if os.path.exists(LAYERS_CFG) else None
        if os.path.exists(LAYERS_CFG) and cfg is None:
            errors.append("theme/layers.json: not valid JSON")
    ver = hashlib.sha1(json.dumps(cfg, sort_keys=True).encode()).hexdigest()[:10] if cfg is not None else None
    return cfg, errors, ver


def sg_rules(flags):
    """Active transform overrides from theme/sg/*.json (contracts/sg.md §4.1):
    merged in name order, `supersedes` drops earlier ids, a rule with a `flag`
    is kept only while that flag is true. Returns (rules, errors)."""
    rules, errors, order = {}, [], []
    for p in json_files(SG_RULES_DIR):
        d = read_json(p)
        if not isinstance(d, dict) or not isinstance(d.get("rules", []), list):
            errors.append(f"{os.path.basename(p)}: not a fragment")
            continue
        for rid in d.get("supersedes") or []:
            if rid in rules:
                del rules[rid]
                order.remove(rid)
        for r in d.get("rules") or []:
            if not isinstance(r, dict) or not isinstance(r.get("id"), str):
                errors.append(f"{os.path.basename(p)}: rule without id")
                continue
            if r["id"] in rules:
                errors.append(f"{os.path.basename(p)}: duplicate rule {r['id']}")
                continue
            rules[r["id"]] = dict(r, fragment=os.path.basename(p))
            order.append(r["id"])
    active = [rules[i] for i in order if not rules[i].get("flag") or flags.get(rules[i]["flag"]) is True]
    return active, errors


def vr_scripts():
    """SteamVR page scripts: {name: {page, path, version, flag, src}} from
    device/vr/<page>.<name>.js and the test folder (the test folder wins)."""
    out = {}
    for folder in VR_SCRIPT_DIRS:
        try:
            names = sorted(os.listdir(folder))
        except OSError:
            continue
        for n in names:
            if not n.endswith(".js") or n.startswith((".", "_")) or n.count(".") < 2:
                continue
            page, name = n[:-3].split(".", 1)
            p = os.path.join(folder, n)
            try:
                with open(p, encoding="utf-8") as f:
                    src = f.read()
            except OSError:
                continue
            flag = None
            for line in src.splitlines()[:5]:
                rest = line.split("@lgs-flag", 1)[1].split() if "@lgs-flag" in line else []
                if rest:
                    flag = rest[0]
            out[name] = {"page": page, "path": p, "flag": flag, "src": src.strip().rstrip(";"),
                         "version": hashlib.sha1(src.encode()).hexdigest()[:10]}
    return out


def _pdeathsig():
    """preexec for glassd: SIGTERM it when the daemon dies (a hand-run daemon
    killed outside systemd must not leave the camera-reading child behind)."""
    try:
        import ctypes
        ctypes.CDLL("libc.so.6", use_errno=True).prctl(1, int(signal.SIGTERM))   # PR_SET_PDEATHSIG
    except Exception:  # noqa: BLE001 - best effort
        pass


# ------------------------------------------------------------------ CDP

class CDP:
    """A persistent devtools websocket: concurrent calls plus event handlers."""

    live = weakref.WeakSet()       # open sockets, closed at the daemon's exit (no aiohttp warnings)

    def __init__(self, name, ws_url):
        self.name = name
        self.ws_url = ws_url
        self.n = 0
        self.pending = {}
        self.handlers = {}
        self.closed = False
        self.ws = None
        self.http = None
        self.reader = None

    async def open(self):
        import aiohttp
        self.http = aiohttp.ClientSession()
        CDP.live.add(self)
        try:
            self.ws = await self.http.ws_connect(self.ws_url, max_msg_size=0)
        except BaseException:
            await self.http.close()
            raise
        self.reader = asyncio.create_task(self._read())
        return self

    async def _read(self):
        import aiohttp
        try:
            async for msg in self.ws:
                if msg.type != aiohttp.WSMsgType.TEXT:
                    if msg.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                        break
                    continue
                d = json.loads(msg.data)
                if "id" in d:
                    fut = self.pending.pop(d["id"], None)
                    if fut and not fut.done():
                        fut.set_result(d)
                else:
                    cb = self.handlers.get(d.get("method"))
                    if cb:
                        try:
                            cb(d.get("params") or {})
                        except Exception as e:  # noqa: BLE001 - a handler bug must not kill the socket
                            log(f"{self.name}: handler {d.get('method')}: {e!r}")
        except Exception:  # noqa: BLE001 - socket torn down
            pass
        finally:
            self.closed = True
            for fut in self.pending.values():
                if not fut.done():
                    fut.set_exception(ConnectionError(f"{self.name}: devtools socket closed"))
            self.pending.clear()

    async def send(self, method, params=None, timeout=20):
        if self.closed:
            raise ConnectionError(f"{self.name}: devtools socket closed")
        self.n += 1
        i = self.n
        fut = asyncio.get_running_loop().create_future()
        self.pending[i] = fut
        try:
            await self.ws.send_json({"id": i, "method": method, "params": params or {}})
            d = await asyncio.wait_for(fut, timeout)
        finally:
            self.pending.pop(i, None)
        if "error" in d:
            raise RuntimeError(f"{method}: {d['error']}")
        return d["result"]

    async def eval(self, expr, timeout=20, by_value=True):
        r = await self.send("Runtime.evaluate", {
            "expression": expr, "returnByValue": by_value, "awaitPromise": True}, timeout)
        if "exceptionDetails" in r:
            ex = r["exceptionDetails"]
            raise RuntimeError("JS: " + str(ex.get("exception", {}).get("description") or ex.get("text")))
        return r["result"].get("value") if by_value else r["result"]

    async def close(self):
        self.closed = True
        CDP.live.discard(self)
        try:
            if self.ws is not None:
                await self.ws.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            if self.http is not None:
                await self.http.close()
        except Exception:  # noqa: BLE001
            pass
        if self.reader is not None:
            self.reader.cancel()


async def eval_once(ws_url, expr, timeout=20, name="page"):
    """One evaluation on a fresh socket that is always closed again."""
    c = CDP(name, ws_url)
    try:
        await c.open()
        return await c.eval(expr, timeout)
    finally:
        await c.close()


# ------------------------------------------------------------------ Steam-side helpers

# Sets html.lgs-native on the Steam windows whose glassd cover the compositor
# shows, and acknowledges the popped layers it shows to the reporter
# (__LGS_LAYERS.ack: only those get data-lgs-pop). Only while the theme
# (__LGS) is on. Without a heartbeat (set()) for ttl ms it removes the class
# again, so a dead daemon never leaves windows unpainted.
NATIVE_JS = r"""
(function (keys, ttl, acks, plates, covers) {
  const W = window;
  let h = W.__LGS_NATIVE;
  if (!h) {
    const ALIAS = { 'valve.steam.gamepadui.main': /^VR_uid/, 'valve.steam.gamepadui.keyboard': /^VRKeyboard_uid/,
                    'valve.steam.gamepadui.notifications': /^VRNotificationToasts_uid/ };
    const matches = (name, key) => (ALIAS[key] ? ALIAS[key].test(name) : (name.startsWith(key + '.') || name.startsWith(key + '_')));
    h = W.__LGS_NATIVE = { keys: [], acks: {}, plates: {}, covers: [], last: 0, ttl, timer: 0, applied: [], tagged: null };
    h.sweep = () => {
      const themeOn = !!(W.__LGS && W.__LGS.state && W.__LGS.state.enabled);
      const live = h.keys.length > 0 && Date.now() - h.last < h.ttl && themeOn;
      const applied = [];
      let pops = [];
      try { pops = [...g_PopupManager.m_mapPopups.values()]; } catch (_) { /* not ready */ }
      for (const p of pops) {
        let doc = null;
        try { doc = p.window && p.window.document; } catch (_) { continue; }
        if (!doc || !doc.documentElement) continue;
        const on = live && h.keys.some((k) => matches(p.m_strName, k));
        const cl = doc.documentElement.classList;
        if (on !== cl.contains('lgs-native')) cl.toggle('lgs-native', on);
        if (on) applied.push(p.m_strName.replace(/_uid\d+$/, ''));
      }
      h.applied = applied;
      if (!live && h.timer) { clearInterval(h.timer); h.timer = 0; }
      return applied;
    };
    // v3 reporters (status().v >= 3) take {key: {cover, pops, plates}}; older
    // ones {key: [pop ids]} (contracts/reporter.md §7)
    h.ack = () => {
      try {
        const L = W.__LGS_LAYERS;
        if (!L || typeof L.ack !== 'function') return;
        let v3 = false;
        try { v3 = typeof L.status === 'function' && (L.status().v | 0) >= 3; } catch (_) { /* old */ }
        const map = {};
        if (h.keys.length) {
          for (const k of h.keys) {
            map[k] = v3 ? { cover: h.covers.includes(k), pops: h.acks[k] || [], plates: h.plates[k] || [] }
                        : (h.acks[k] || []);
          }
        }
        h.tagged = L.ack(map);
      } catch (_) { /* reporter restarting */ }
    };
    h.set = (ks, ac, pl, cv) => {
      h.keys = ks || []; h.acks = ac || {}; h.plates = pl || {}; h.covers = cv || h.keys; h.last = Date.now();
      if (!h.timer && h.keys.length) h.timer = setInterval(h.sweep, 1000);
      const r = h.sweep(); h.ack(); return r;
    };
    h.clear = () => { h.keys = []; h.acks = {}; h.plates = {}; h.covers = []; const r = h.sweep(); h.ack(); if (h.timer) clearInterval(h.timer); delete W.__LGS_NATIVE; return r; };
  }
  h.ttl = ttl;
  const applied = h.set(keys, acks, plates, covers);
  return JSON.stringify({ applied, tagged: h.tagged });
})
"""

# __LGS_RT.bridge (P1's runtime): set() each [name, value]; 'none' without a runtime
BRIDGE_SET_JS = r"""
(function (pairs) {
  const R = window.__LGS_RT, b = R && R.bridge;
  if (!b || typeof b.set !== 'function') return 'none';
  let n = 0;
  for (const [k, v] of pairs) { try { b.set(k, v); n++; } catch (_) { /* a listener threw */ } }
  return 'ok:' + n;
})
"""
# Names the runtime does not hold (it was reinstalled): null without a runtime
BRIDGE_MISSING_JS = r"""
(function (names) {
  const R = window.__LGS_RT, b = R && R.bridge;
  if (!b || typeof b.set !== 'function') return null;
  if (typeof b.get !== 'function') return names;
  return names.filter((n) => { try { return b.get(n) === undefined; } catch (_) { return true; } });
})
"""
# Our CDP binding globals out of SharedJSContext: Runtime.removeBinding does not
# delete the function a closed session installed (G-REMOVE, review R1 M1). Only
# native-code functions (bindings); a test's own JS stand-in is left alone.
# Returns the names deleted, joined ('' when none).
DELETE_BINDINGS_JS = r"""
(function (names) {
  const out = [];
  for (const n of names) {
    const f = window[n];
    if (typeof f === 'function' && /\[native code\]/.test(Function.prototype.toString.call(f))) {
      try { delete window[n]; out.push(n); } catch (_) { /* non-configurable */ }
    }
  }
  return out.join(',');
})
"""
# Steam tick: theme on, Reduce Motion
STEAM_TICK_JS = ("JSON.stringify([!!(window.__LGS && window.__LGS.state && window.__LGS.state.enabled), "
                 "!!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)])")

# systemui, read-only: geometry (the SP §1.2 snippet), the Steam frame's shown
# page (CC15) and, with dump, the frame menu's laser panel (WN §3.3.2)
GEOM_JS = r"""
(async function (wantDump) {
  const out = { geom: null, page: null, err: null };
  try {
    const FS = window.FrameStore, DS = window.DashboardStore;
    if (!FS || !DS || !FS.frames || !FS.frames.length) { out.err = 'no FrameStore'; return JSON.stringify(out); }
    const f = FS.frames.find((x) => /page:3/.test(x.activePage && x.activePage.mountableID)) || FS.frames[0];
    const z = f.activePage.size, S = DS.dashboardScale, H0 = f.size.mainPanelHeightOverride || 1.5;
    const r = z.latestMeasuredPanelLocalHeight / H0, Hw = z.latestMeasuredPanelWorldHeight;
    const g = { S, H0, r, Hm: Hw, unitM: S * r, mmPerCssPx: 1500 * Hw / 1080, dashDist: DS.dashboardDistance, frameMenu: null };
    const MAIN = 'valve.steam.gamepadui.main';
    const sf = FS.frames.find((x) => x.m_mapPages && [...x.m_mapPages.values()].some((p) => p.m_sSummonOverlayKey === MAIN)) || f;
    const pages = {};
    if (sf.m_mapPages) for (const [id, p] of sf.m_mapPages) pages[id] = p.m_sSummonOverlayKey;
    const ap = sf.activePage;
    out.page = { frameID: sf.m_unFrameID, activePageID: sf.m_unActivePageID, summonKey: ap ? ap.m_sSummonOverlayKey : null,
                 steam: !!ap && ap.m_sSummonOverlayKey === MAIN, pages };
    const el = document.querySelector('[id^="PooledPopup-valve.steam.gamepadui.frame.menu"]');
    if (el && typeof el.buildNode === 'function') {
      const p = el.buildNode({}, el)[1].properties;
      g.frameMenu = { key: p.key, mpp: p['meters-per-pixel'], uv: [p.uv_min[0], p.uv_min[1], p.uv_max[0], p.uv_max[1]],
                      visible: p.visibility === 0 || p.visibility === undefined };
      // what can change the laser panel's size: a change re-dumps (not published)
      out.fmSig = JSON.stringify(['key', 'uv_min', 'uv_max', 'meters-per-pixel', 'visibility', 'scale-index',
                                  'frame-resize-scale-factor', 'origin', 'curvature'].map((k) => p[k]));
      if (wantDump && window.OverlayStore && OverlayStore.DumpLaserOverlays) {
        const d = await OverlayStore.DumpLaserOverlays();
        const ov = d && d.overlays || {};
        const k = Object.keys(ov).find((n) => n.startsWith(p.key + ' ') || n.startsWith(p.key + '_'));
        const sp = k && ov[k].scene_graph_panel;
        if (sp) { g.frameMenu.fWidth = sp.fWidth; g.frameMenu.fHeight = sp.fHeight; g.frameMenu.dumped = true; }
      }
    }
    out.geom = g;
  } catch (e) { out.err = String(e && e.message || e).slice(0, 200); }
  return JSON.stringify(out);
})
"""

# systemui: our scene graph out (overrides restored), and P5's springs that
# the daemon prepended (P5's REQ: no global left behind)
SG_DESTROY_JS = r"""
(() => {
  let r = 'absent';
  if (window.__LGS_SG) { try { window.__LGS_SG.destroy(); r = 'cleared'; } catch (e) { r = 'error: ' + e; } }
  const M = globalThis.__LGS_MOTION;
  if (M) { try { if (typeof M.remove === 'function') M.remove(); } catch (_) { /* best effort */ } delete globalThis.__LGS_MOTION; }
  return r;
})()
"""

# SteamVR page scripts (contracts/daemon.md §6). VRX_INSTALL_JS(name, version,
# ctx) wraps the script's function expression.
VRX_PROBE_JS = r"""
(function (want) {
  const R = window.__LGS_VRX || {};
  const out = {};
  for (const [n, v] of Object.entries(want)) out[n] = R[n] ? (R[n].version === v ? 'ok' : 'stale') : 'need';
  for (const n of Object.keys(R)) if (!(n in want)) out[n] = 'extra';
  return JSON.stringify(out);
})
"""
VRX_REMOVE_JS = r"""
(function (names) {
  const R = window.__LGS_VRX;
  if (!R) return 0;
  let n = 0;
  for (const k of Object.keys(R)) {
    if (names && !names.includes(k)) continue;
    try { if (R[k].api && typeof R[k].api.remove === 'function') R[k].api.remove(); } catch (_) { /* its bug */ }
    delete R[k]; n++;
  }
  if (!Object.keys(R).length) delete window.__LGS_VRX;
  return n;
})
"""


def vrx_install_js(name, version, ctx, src):
    return (f"(() => {{ const R = window.__LGS_VRX || (window.__LGS_VRX = {{}}); const N = {json.dumps(name)};\n"
            f"if (R[N] && R[N].version === {json.dumps(version)}) return 'ok';\n"
            "if (R[N]) { try { R[N].api && R[N].api.remove && R[N].api.remove(); } catch (_) {} delete R[N]; }\n"
            f"let api;\ntry {{ api = ({src}\n)({json.dumps(ctx)}); }}\n"
            "catch (e) { if (!Object.keys(R).length) delete window.__LGS_VRX; return 'error: ' + String(e && e.message || e).slice(0, 160); }\n"
            f"R[N] = {{ version: {json.dumps(version)}, api: api || {{}}, at: Date.now() }};\nreturn 'installed'; }})()")

MAIN_SIZE_JS = r"""
(() => { try {
  const w = SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.BrowserWindow;
  return [Math.round(w.innerWidth * w.devicePixelRatio), Math.round(w.innerHeight * w.devicePixelRatio)];
} catch (e) { return null; } })()
"""

REPORTER_STOP_JS = f"""
(() => {{ const r = window.{REPORTER}; if (!r) return 'absent';
  for (const m of ['stop', 'disable', 'destroy']) if (typeof r[m] === 'function') {{ r[m](); return m; }}
  return 'no stop method'; }})()
"""

# The reporter's heartbeat (it stops itself when pings stop), sent only to our
# own instance. 'ok' | 'foreign' (running, but another binding: someone's
# test) | 'waiting' (for the theme's token index) | 'stopped' | 'absent' | 'error'
REPORTER_PING_JS = f"""
(() => {{ const r = window.{REPORTER}; if (!r || typeof r.status !== 'function') return 'absent';
  try {{ const s = r.status();
    if (!s.running) return s.waiting ? 'waiting' : 'stopped';
    if (s.binding !== {json.dumps(BINDING)}) return 'foreign';
    if (typeof r.ping === 'function') r.ping();
    return 'ok';
  }} catch (e) {{ return 'error'; }} }})()
"""

REPORTER_RESEND_JS = f"""
(() => {{ const r = window.{REPORTER}; if (!r) return 'absent';
  for (const m of ['resend', 'flush', 'report', 'refresh']) if (typeof r[m] === 'function') {{ try {{ r[m](true); }} catch (_) {{}} return m; }}
  return 'none'; }})()
"""


def file_version(path):
    try:
        with open(path, "rb") as f:
            return hashlib.sha1(f.read()).hexdigest()[:10]
    except OSError:
        return None


def material_for(surface):
    if surface.get("material"):
        return surface["material"]
    return "window" if surface.get("name") == "main" else "panel"


# ------------------------------------------------------------------ report -> glassd.json v3 checks

def _num(v, lo=-1e7, hi=1e7):
    """A finite number within [lo, hi], else None (bools are not numbers)."""
    if isinstance(v, bool) or not isinstance(v, (int, float, str)):
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    return f if lo <= f <= hi and f == f else None


def _nums(v, n, lo=-1e7, hi=1e7):
    """A list of exactly n finite numbers (floats), else None."""
    if not isinstance(v, (list, tuple)) or len(v) != n:
        return None
    out = [_num(x, lo, hi) for x in v]
    return None if None in out else out


def _round(f):
    return round(f, 4) if f != int(f) else int(f)


def clean_color(c):
    """A CSS colour string or [r, g, b(, a)] in 0..1 (contracts/glassd.md units)."""
    if isinstance(c, str) and 0 < len(c) <= 64:
        return c
    if isinstance(c, list) and len(c) in (3, 4):
        vals = [_num(v, 0, 1) for v in c]
        if all(v is not None for v in vals):
            return [_round(v) for v in vals]
    return None


def clean_rect(d, keys=("x", "y", "w", "h", "r"), optional=("r",)):
    out = {}
    for k in keys:
        if k not in d and k in optional:
            continue
        v = _num(d.get(k))
        if v is None:
            return None
        out[k] = _round(round(v, 5 if k == "dz" else 2))
    return out


def clean_phase_fields(src, dst):
    if "phase" in src and _num(src["phase"], 0, 1) is not None:
        dst["phase"] = _round(_num(src["phase"], 0, 1))
    if src.get("appear") in ("materialize", "dematerialize"):
        dst["appear"] = src["appear"]
    if "phaseMs" in src and _num(src["phaseMs"], 0, 10000) is not None:
        dst["phaseMs"] = int(_num(src["phaseMs"], 0, 10000))


def clean_plate(p, i):
    if not isinstance(p, dict):
        return None
    out = clean_rect(p)
    if out is None or out["w"] < 2 or out["h"] < 2:
        return None
    pid = p.get("id")
    out["id"] = str(pid)[:64] if pid is not None else f"p{i}"
    if isinstance(p.get("material"), str) and len(p["material"]) <= 16:
        out["material"] = p["material"]
    clean_phase_fields(p, out)
    for k in ("tint", "fill"):
        if k in p and clean_color(p[k]) is not None:
            out[k] = clean_color(p[k])
    if isinstance(p.get("occluder"), bool):
        out["occluder"] = p["occluder"]
    if "shadow" in p and _num(p["shadow"], 0, 1) is not None:
        out["shadow"] = _round(_num(p["shadow"], 0, 1))
    return out


def clean_edges(e):
    """hole.edges (contracts/glassd.md §1.4, cap holeEdges): {top, right, bottom,
    left}, each a colour or a list of 1-8 colours; unparsable colours and empty
    edges are dropped. None when nothing is left."""
    if not isinstance(e, dict):
        return None
    out = {}
    for k in ("top", "right", "bottom", "left"):
        v = e.get(k)
        if isinstance(v, list) and v and not (len(v) in (3, 4) and all(_num(x) is not None for x in v)):
            cs = [c for c in (clean_color(x) for x in v[:8]) if c is not None]
            if cs:
                out[k] = cs
        elif v is not None and clean_color(v) is not None:
            out[k] = clean_color(v)
    return out or None


def clean_hole(h, clip=None, edges=False):
    if h is True:
        return {"clip": [_round(round(v, 2)) for v in clip]} if clip else True
    if not isinstance(h, dict):
        return None
    out = {}
    for k, lo, hi in (("shadow", 0, 1), ("y", -500, 500), ("blur", 0, 500)):
        if k in h and _num(h[k], lo, hi) is not None:
            out[k] = _round(_num(h[k], lo, hi))
    if "fill" in h and clean_color(h["fill"]) is not None:
        out["fill"] = clean_color(h["fill"])
    if edges and clean_edges(h.get("edges")) is not None:     # REQ P9->P8, only with glassd's holeEdges cap
        out["edges"] = clean_edges(h["edges"])
    c = h.get("clip")
    if isinstance(c, list) and len(c) == 4 and all(_num(v) is not None for v in c):
        out["clip"] = [_round(round(_num(v), 2)) for v in c]
    elif clip:
        out["clip"] = [_round(round(v, 2)) for v in clip]
    return out or True


def clean_masks(ms, world=False):
    """World quads {O, U, V} (top level) or surface rects {x, y, w, h, dz?}, ≤ 8."""
    out = []
    for m in (ms if isinstance(ms, list) else [])[:8]:
        if not isinstance(m, dict):
            continue
        if world:
            q = {}
            for k in ("O", "U", "V"):
                v = m.get(k)
                if isinstance(v, list) and len(v) == 3 and all(_num(x) is not None for x in v):
                    q[k] = [_round(round(_num(x), 5)) for x in v]
            if len(q) == 3:
                out.append(q)
        else:
            r = clean_rect(m, ("x", "y", "w", "h", "dz"), optional=("dz",))
            if r is not None:
                out.append(r)
    return out


def clean_quad(q):
    m = clean_masks([q], world=True)
    return m[0] if m else None


# ------------------------------------------------------------------ the daemon

class Shell:
    def __init__(self, glassd_path, stay=False, glassd_args=None, native=False, native_req=None, native_src=None,
                 test_report=None, assume_caps=None):
        self.glassd_path = glassd_path
        self.glassd_args = list(glassd_args or [])
        self.stay = stay                      # lab aid: go dormant instead of exiting on theme off
        self.native_requested = bool(native)
        self.native_req = native_req or ("on" if native else "off")   # what start() was asked: auto | on | off
        self.native_src = native_src or "cli"                         # where auto was decided
        self.test_report = test_report        # lab: a report file replaces the reporter
        self.assume_caps = set(assume_caps or [])   # lab: act as if glassd announced these caps
        self.test_report_mtime = None
        # Read once: a binary built mid-session is never picked up.
        if not self.native_requested:
            self.native_enabled, self.css_reason = False, css_reason_for(self.native_req, self.native_src)
        elif not self.glassd_path:
            self.native_enabled, self.css_reason = False, "glassd disabled"
        elif not os.access(self.glassd_path, os.X_OK):
            self.native_enabled, self.css_reason = False, "no glassd binary at start; python glass.py native-build"
        else:
            self.native_enabled, self.css_reason = True, None
        self.stopping = False
        self.stop_task = None
        self.tasks = []
        self.exit_code = 0
        self.torn = False
        self.since = time.time()
        self.errors = collections.deque(maxlen=12)
        self.bugs = {}                        # loop -> [times of unexpected exceptions]
        self.changed = asyncio.Event()        # spec inputs changed
        self.wake_at = None                   # a layer becomes still enough to pop
        # Steam side
        self.steam = None
        self.steam_ok = False
        self.theme_on = None
        self.theme_off_polls = 0
        self.dormant_since = None             # theme off, waiting up to the grace for it to come back
        self.steam_target_id = None           # SharedJSContext's target id: a new one = Steam restarted
        self.steam_restarted = False          # ... and the theme has not been seen on since
        self.steam_lost_at = None             # Steam's devtools unreachable since
        self.slow_evals = 0                   # Steam evaluations that timed out (connection kept)
        self.report = None
        self.report_at = 0.0
        self.reports = 0
        self.dash_hidden = False
        self.layer_still = {}                 # (surface, id) -> (rect, still since)
        self.reporter_state = "not injected"
        self.reporter_injected_at = 0.0
        self.reporter_version = None
        self.fallback = None                  # synthesized report when no reporter
        self.native_applied = []
        self.native_tagged = None
        self.acked = {}
        self.native_force = False
        # systemui side
        self.sysui = None
        self.sysui_ok = False
        self.sg_version = file_version(SG_JS)
        self.sg_status = None
        self.sg_injected_at = 0.0
        self.sg_nosched = 0
        self.sg_reset = False
        self.sysui_ctx = None
        self.sg_beat = None
        self.sg_beat_at = 0.0
        self.spec_sent = None
        self.spec_sent_obj = None
        self.spec_sent_at = 0.0
        self.spec_seq = 0
        self.spec_summary = None
        self.spec_logged_at = 0.0
        self.spec_log_sig = None
        self.spec_log_skipped = 0
        self.flags_mtime = None
        self.flags = None
        self.resized_noted = None
        # glassd
        self.gproc = None
        self.g_pid = None
        self.g_started = 0.0
        self.g_crashes = []
        self.g_restarts = 0
        self.g_temp_exits = 0
        self.g_last_exit = None
        self.g_given_up = False
        self.g_kill_reason = None             # 'dormant' while we stop glassd on purpose
        self.g_frames = False
        self.gout = None
        self.gout_mtime = None
        self.gout_seen = 0.0
        self.g_stale = False
        self.g_files_removed = False
        self.gseq = 0
        self.gjson_struct = None
        self.gjson_full = None
        self.gjson_written_at = 0.0
        self.dial_mtime = None
        # SteamVR page theming and page scripts
        self.vr_version = None
        self.vr_pages = {}
        self.vrx_status = {}                  # page -> {script name: state}
        self.vrx_failed = {}                  # (page, name) -> version that threw
        self.vrx_sig, self.vrx_scripts = None, {}   # page script files: (folder, name, mtime) list, parsed
        # flags (defaults.json < /tmp/lgs/flags.json)
        self.flagreader = FlagReader()
        self.rt_flags = {}
        self.profile = "default"
        self.reduce_motion = False
        # bridge to Steam's runtime (__LGS_RT.bridge)
        self.bridge_values = {}               # name -> value
        self.bridge_sent = {}                 # name -> (json without 'at', time)
        self.bridge_runtime = None            # True / False once checked
        self.bridge_beat_at = 0.0
        # actions
        self.registry = shell_ext.Registry(self, test_dir=TEST_EXT_DIR)   # + RAM test plugins (echo / read)
        self.registry.add_builtin("sgwindow", {
            "args": {"dim": {"type": "num", "min": 0, "max": 1, "optional": True},
                     "recede": {"type": "num", "min": 0, "max": 0.3, "optional": True},
                     "motion": {"type": "str", "max": 24, "re": r"^[a-z][a-z-]{0,23}$", "optional": True},
                     "ttlMs": {"type": "int", "min": 500, "max": 60000, "optional": True},
                     "reset": {"type": "bool", "optional": True}},
            "sources": ["main", "bar", "barpopup", "ccpopup"], "rate": 0.25, "kind": "ui"},
            self.action_sgwindow)
        # echo restricted to the main window: the wrong-source probe of DM-4
        self.registry.add_builtin("echo.main", {"args": {"text": {"type": "str", "max": 200, "optional": True}},
                                                "sources": ["main"], "rate": 0.2, "kind": "echo"},
                                  shell_ext.BUILTIN["echo"][1])
        self.trusted_ctx = None               # SharedJSContext's default execution context id
        self.ctx_probe = None                 # (nonce, future) while probing
        self.ctx_probe_lock = asyncio.Lock()
        self.replies = collections.deque(maxlen=10)
        self.action_tasks = set()
        # geometry and page (systemui, read-only)
        self.geom = None
        self.page = None
        self.geom_err = None
        self.geom_at = 0.0
        self.geom_dump_at = 0.0               # last DumpLaserOverlays read (status geomDumpAt; DM-3 waits for one)
        self.geom_ok = False
        self.vr_conns = {}                    # SteamVR page target id -> CDP (kept open; m4)
        self.vr_http = None                   # aiohttp session for 8090's /json/list (keep-alive)
        # glassd.json v3 and the materialize policy
        self.items_first = {}                 # (surface, kind, id) -> time first written
        self.items_last = {}                  # (surface, kind, id) -> last item written (for its fade-out)
        self.fading = {}                      # (surface, kind, id) -> (item with phase 0, until)
        self.plate_acks = {}
        self.cover_keys = []
        self.pop_clips = {}                   # (surface, id) -> clip rect trimmed by build_spec (hole.clip)
        # transform overrides and the window state (lgs_sg.js v2)
        self.sg_rules = []
        self.sg_rule_errors = []
        self.sg_rules_sig = None
        self.sg_rules_sent = None
        self.window_req = None                # {dim, recede, motion, until} from the sgwindow action
        self.layers_version = None

    # ---------------------------------------------------------------- state
    def mode(self):
        if self.dormant_since is not None:     # theme off without lgs off: waiting for it (contract §1)
            return "dormant"
        if not self.native_enabled:
            return f"css-only ({self.css_reason})"
        if self.native_ok():
            return "native"
        return "starting"

    def native_possible(self):
        """Native mode opted in, with a glassd binary at start, not given up and
        not removed since. Otherwise the daemon only themes SteamVR pages (CSS
        only) and injects neither the reporter nor lgs_sg.js."""
        return self.native_enabled

    def disable_native(self, reason):
        if self.native_enabled:
            self.native_enabled, self.css_reason = False, reason
            self.note(f"native layer off for this session: {reason}")
            self.changed.set()

    def glassd_running(self):
        return bool(self.gproc and self.gproc.returncode is None)

    def glassd_ready(self):
        """glassd draws: frames out, not exiting, healthy, output not stale."""
        g = self.gout
        return bool(g and self.g_frames and not g.get("exiting") and g.get("healthy", True) is not False
                    and not self.g_stale)

    def native_ok(self):
        return bool(self.native_possible() and self.glassd_running() and self.glassd_ready()
                    and self.steam_ok and self.theme_on)

    def native_why(self):
        """Why native_ok() is false (logs and status), or None."""
        for ok, why in ((self.native_possible(), "native off"), (self.glassd_running(), "glassd not running"),
                        (self.glassd_ready(), "glassd not ready"), (self.steam_ok, "steam not connected"),
                        (self.theme_on, "theme off")):
            if not ok:
                return why
        return None

    def current_report(self):
        if self.report is not None:
            return self.report
        return self.fallback

    def note(self, msg):
        self.errors.append(time.strftime("%H:%M:%S ") + msg)
        log(msg)

    def bug(self, where, e):
        """An unexpected exception in a loop: log it, back off; fatal (re-raised)
        after BUG_LIMIT within BUG_WINDOW s. Returns the delay before a retry."""
        now = time.time()
        times = [t for t in self.bugs.get(where, []) if now - t < BUG_WINDOW] + [now]
        self.bugs[where] = times
        tb = traceback.format_exc().strip().splitlines()
        self.note(f"{where}: unexpected {e!r} ({len(times)}/{BUG_LIMIT} in {BUG_WINDOW} s) at {' | '.join(tb[-3:])[:300]}")
        if len(times) >= BUG_LIMIT:
            raise e
        return min(30, 2 ** len(times))

    def caps(self):
        """glassd's v3 features (glassd-out.json caps); empty for a v2 binary."""
        c = (self.gout or {}).get("caps")
        caps = {x for x in c if isinstance(x, str)} if isinstance(c, list) else set()
        return caps | self.assume_caps       # lab only (--assume-caps): test the writer against an older glassd

    def refresh_flags(self):
        """Re-read the flags; returns True when the depth profile changed."""
        self.rt_flags = self.flagreader.read()
        prof = "wearer" if self.rt_flags.get("interactivePops") is True else "default"
        changed = prof != self.profile
        if changed:
            log(f"flags: profile {self.profile} -> {prof}")
            self.profile = prof
        rules, errs = sg_rules(self.rt_flags)
        sig = json.dumps(rules, sort_keys=True)
        if sig != self.sg_rules_sig:
            self.sg_rules_sig, self.sg_rules, self.sg_rule_errors = sig, rules, errs
            log(f"systemui: transform overrides {[r.get('id') for r in rules] or 'none'}"
                + (f" (errors {errs})" if errs else ""))
            self.changed.set()
        if self.window_req and self.window_req.get("until", 0) < time.time():
            log("systemui: window state request expired; restoring")
            self.window_req = None
            self.changed.set()
        return changed

    def window_state(self):
        """The window dim / recede to request (contracts/sg.md §5): the report's
        `window` in native mode wins over the sgwindow action."""
        rep = self.current_report() if self.native_possible() else None
        w = (rep or {}).get("window") if isinstance(rep, dict) else None
        if isinstance(w, dict):
            return {k: w[k] for k in ("dim", "recede", "motion") if k in w}
        if self.window_req:
            return {k: self.window_req[k] for k in ("dim", "recede", "motion") if k in self.window_req}
        return None

    def theme_grace_s(self):
        """How long to stay dormant while the Steam theme is off (flag
        shellThemeGraceS, 0..3600 s; 0 = exit after THEME_OFF_POLLS as in Phase 1).
        A --stay unit (lab, native-session) waits STAY_MAX_S whatever the flag."""
        if self.stay:
            return STAY_MAX_S
        v = _num(self.rt_flags.get("shellThemeGraceS"), 0, 3600)
        return THEME_OFF_GRACE_S if v is None else v

    def check_stay_limit(self):
        """A --stay unit is native for at most STAY_MAX_S: after that its
        native-session client is gone for sure (it gives up after 2400 s), so
        the native layer ends and the unit follows the normal rules (contract §1)."""
        if self.stay and time.time() - self.since >= STAY_MAX_S:
            self.stay = False
            self.note(f"--stay limit: running {STAY_MAX_S} s; its client is gone. Native layer off, normal "
                      "theme-off rules from now on")
            self.disable_native(f"--stay limit ({STAY_MAX_S} s) reached")

    def sg_wanted(self):
        """lgs_sg.js belongs in systemui: native mode, or (CSS only) an active
        transform override or a window state (P7's REQ, contracts/sg.md §1)."""
        if self.dormant_since is not None:   # theme off: Steam's own panels until it is back
            return False
        return self.native_possible() or bool(self.sg_rules) or self.window_state() is not None

    def daemon_value(self):
        return {"v": 1, "at": int(time.time() * 1000), "ttlMs": int(DAEMON_BEAT_S * 3000), "pid": os.getpid(),
                "mode": self.mode(), "native": bool(self.native_ok()), "profile": self.profile,
                "steamvr": bool(self.geom_ok), "actions": sorted(self.registry.types),
                "dryRun": bool(self.rt_flags.get("actionsDryRun"))}

    # ---------------------------------------------------------------- plugin host (shell_ext.Ctx)
    async def ext_steam_eval(self, expr, timeout=10):
        s = self.steam
        if self.steam_ok and s is not None and not s.closed:
            return await s.eval(expr, timeout)
        t = await self.steam_target()
        return await eval_once(t["webSocketDebuggerUrl"], expr, timeout, "steam-ext")

    async def ext_vr_eval(self, page, expr, timeout=10):
        loop = asyncio.get_running_loop()
        for t in await loop.run_in_executor(None, lgs_vr.targets):
            if (t.get("title") or "") == page:
                return await eval_once(t["webSocketDebuggerUrl"], expr, timeout, "vr-ext")
        raise ConnectionError(f"no SteamVR page {page!r}")

    def ext_vr_pages(self):
        return sorted(self.vr_pages)

    def ext_flags(self):
        return self.rt_flags

    def ext_geom(self):
        return self.geom

    def ext_page(self):
        return self.page

    def ext_log(self, msg):
        log(msg)

    async def ext_actions_logger(self, atype, args):
        """True when P1's action logger (rt.test.actions) is on: the call is
        recorded there and not run (the never-list in lab steps)."""
        js = ("(function (t, a) { const R = window.__LGS_RT, A = R && R.test && R.test.actions;"
              " if (!A || typeof A.enabled !== 'function' || !A.enabled()) return false;"
              " try { A.record({ fn: 'daemon.' + t, arg: a }); } catch (_) { /* old runtime */ } return true; })"
              f"({json.dumps(atype)}, {json.dumps(args)})")
        return bool(await self.ext_steam_eval(js, 5))

    async def action_sgwindow(self, ctx, atype, args, call):
        """Built-in 'sgwindow': Steam's window dim / recede for a while (TTL),
        also in CSS-only mode (contracts/sg.md §5; contract §5)."""
        if args.get("reset"):
            self.window_req = None
        else:
            w = {k: args[k] for k in ("dim", "recede", "motion") if k in args}
            if not w:
                raise ValueError("nothing to set")
            self.window_req = dict(w, until=time.time() + args.get("ttlMs", 10000) / 1000, src=call.get("src"))
        self.changed.set()
        return {"window": self.window_state()}

    def status(self):
        g = self.gout or {}
        sg = self.sg_status or {}
        b = self.sg_beat or {}
        rep = self.current_report() or {}
        return {
            "pid": os.getpid(), "since": time.strftime("%H:%M:%S", time.localtime(self.since)),
            "updated": time.time(), "mode": self.mode(),
            "native": {"requested": self.native_req, "resolved": "on" if self.native_requested else "off",
                       "source": self.native_src, "enabled": self.native_enabled, "reason": self.css_reason},
            "flags": self.rt_flags, "profile": self.profile, "reduceMotion": self.reduce_motion,
            "testReport": self.test_report,
            "bridge": {"runtime": self.bridge_runtime,
                       "sent": {k: round(time.time() - t, 1) for k, (_, t) in self.bridge_sent.items()}},
            "geom": self.geom, "page": self.page, "geomError": self.geom_err,
            "geomDumpAt": round(self.geom_dump_at, 2) if self.geom_dump_at else None,
            "actions": dict(self.registry.status(), replies=list(self.replies), trustedCtx=self.trusted_ctx),
            "vrScripts": self.vrx_status,
            "sgRules": {"active": [r.get("id") for r in self.sg_rules], "errors": self.sg_rule_errors,
                        "window": self.window_req},
            "glassd": {"path": self.glassd_path, "args": self.glassd_args, "pid": self.g_pid,
                       "running": self.glassd_running(), "ready": self.glassd_ready(),
                       "healthy": g.get("healthy"), "stale": self.g_stale, "feed": g.get("feed"),
                       "restarts": self.g_restarts, "tempExits": self.g_temp_exits, "lastExit": self.g_last_exit,
                       "givenUp": self.g_given_up, "frames": self.g_frames, "seq": g.get("seq"), "fps": g.get("fps"),
                       "gpu_ms": g.get("gpu_ms"), "surfaces": sorted((g.get("surfaces") or {}).keys()),
                       "configSeq": self.gseq, "version": g.get("version"), "caps": sorted(self.caps()),
                       "fading": len(self.fading)},
            "dormant": ({"since": round(self.dormant_since, 1), "graceS": self.theme_grace_s(),
                         "stay": self.stay} if self.dormant_since is not None else None),
            "steam": {"connected": self.steam_ok, "themeOn": self.theme_on, "reporter": self.reporter_state,
                      "restarted": self.steam_restarted, "slowEvals": self.slow_evals,
                      "reports": self.reports, "reportSeq": (self.report or {}).get("seq"),
                      "reportAgeS": round(time.time() - self.report_at, 1) if self.report_at else None,
                      "dashboardHidden": self.dash_hidden,
                      "source": "reporter" if self.report is not None else ("fallback" if self.fallback else None),
                      "surfaces": [s.get("name") for s in rep.get("surfaces", [])],
                      "lgsNative": self.native_applied, "acked": self.acked, "plateAcks": self.plate_acks,
                      "tagged": self.native_tagged, "layersVersion": self.layers_version},
            "systemui": {"connected": self.sysui_ok, "sgVersion": self.sg_version, "spec": self.spec_summary,
                         "beatAgeS": round(time.time() - self.sg_beat_at, 1) if self.sg_beat_at else None,
                         "items": b.get("items", sg.get("items")), "panels": sg.get("panels"), "nodes": sg.get("nodes"),
                         "attached": b.get("attached", sg.get("attached")), "parents": sg.get("parents"),
                         "relayouts": sg.get("relayouts"), "pushes": sg.get("pushes"),
                         "pushesLastSec": sg.get("pushesLastSec"), "reattaches": sg.get("reattaches"),
                         "scheduler": sg.get("scheduler"), "expired": b.get("expired", sg.get("expired")),
                         "expiries": sg.get("expiries"), "rebuilds": sg.get("rebuilds"),
                         "flags": self.flags, "sgErrors": sg.get("errors")},
            "steamvrPages": {"paused": os.path.exists(VR_PAUSE), "version": self.vr_version, "pages": self.vr_pages},
            "errors": list(self.errors),
        }

    # ---------------------------------------------------------------- glassd.json
    def ramp_ms(self, material, out, kind="slab"):
        if self.reduce_motion:
            return RAMP_REDUCED_MS
        if material == "dim" and kind == "slab":     # a dim slab rides sheet-in / sheet-out (glassd §1.4)
            material = "thick"
        if out:
            return RAMP_OUT_MS.get(material, RAMP_OUT_DEFAULT_MS)
        return RAMP_IN_MS.get(material, RAMP_IN_DEFAULT_MS)

    def glassd_config(self):
        """glassd.json from the report: Phase 1 fields, the v3 fields glassd's
        caps announce, and the materialize policy (contracts/daemon.md §7)."""
        now = time.time()
        caps = self.caps()
        rep = self.current_report() or {"surfaces": []}
        surfaces, by_name, current, shown = [], {}, {}, set()
        for s in rep.get("surfaces", []):
            if not isinstance(s, dict) or not s.get("name") or not s.get("overlayKey"):
                continue
            name = str(s["name"])[:64]
            # every number type-checked (contract §7): a bad field drops its item, never the daemon
            texW, texH, radius = _num(s.get("texW") or 0, 0, 16384), _num(s.get("texH") or 0, 0, 16384), \
                _num(s.get("radius") or 0, 0, 8192)
            if texW is None or texH is None or radius is None or not isinstance(s["overlayKey"], str):
                continue
            slabs = []
            for L in s.get("layers") if isinstance(s.get("layers"), list) else []:
                if not isinstance(L, dict) or L.get("id") is None:
                    continue
                w, h = _num(L.get("w"), 0, 16384), _num(L.get("h"), 0, 16384)
                r, x, y = _num(L.get("r") or 0, 0, 8192), _num(L.get("x") or 0), _num(L.get("y") or 0)
                dz = _num(L.get("dz") or 0, -1, 1)
                if None in (w, h, r, x, y, dz) or w < 2 or h < 2:
                    continue
                mat = L.get("material")[:16] if isinstance(L.get("material"), str) else "liquid"
                if mat == "none" and "none" not in caps:
                    continue          # an older glassd would draw glass over art: the element stays flat
                if mat == "dim" and "dimSlab" not in caps:
                    continue          # ... or glass where a dark room-dim cell was asked for
                sl = {"id": str(L["id"])[:64], "w": round(w), "h": round(h), "r": round(r),
                      "material": mat or "liquid",
                      # for glassd's slab world point:
                      "x": round(x), "y": round(y), "dz": dz}
                clean_phase_fields(L, sl)
                if "tint" in caps and clean_color(L.get("tint")) is not None:
                    sl["tint"] = clean_color(L["tint"])
                if mat == "dim" and clean_color(L.get("fill")) is not None:
                    sl["fill"] = clean_color(L["fill"])
                if "holes" in caps and L.get("hole") not in (None, False):
                    hole = clean_hole(L["hole"], self.pop_clips.get((name, sl["id"])), edges="holeEdges" in caps)
                    if hole is not None:
                        sl["hole"] = hole
                if "offset" in caps:
                    for k in ("ox", "oy"):
                        if _num(L.get(k)) is not None:
                            sl[k] = _round(round(_num(L[k]), 2))
                slabs.append(sl)
            mat_s = material_for(s)
            surf = {"name": name, "overlayKey": s["overlayKey"][:128],
                    "texW": round(texW), "texH": round(texH), "radius": round(radius),
                    "material": mat_s[:16] if isinstance(mat_s, str) else "panel",
                    "visible": bool(s.get("visible", True)), "slabs": slabs}
            # the cover's rounded shapes (bar segments, a popup's card); glassd
            # covers the whole texture with `radius` when absent
            if isinstance(s.get("shapes"), list):
                shapes = []
                for sh in s["shapes"]:
                    if not isinstance(sh, dict):
                        continue
                    vals = {k: _num(sh.get(k) or 0) for k in ("x", "y", "w", "h", "r")}
                    if None not in vals.values():
                        shapes.append({k: round(v) for k, v in vals.items()})
                surf["shapes"] = shapes
            clean_phase_fields(s, surf)            # the cover's own phase: passed through, never set by P8
            q = clean_quad(s.get("quad")) if s.get("quad") is not None else None
            if q:
                surf["quad"] = q
            plates = [p for p in (clean_plate(p, i) for i, p in enumerate(s.get("plates") or [])
                                  if isinstance(s.get("plates"), list)) if p]
            if "dim" not in caps:     # a dim plate is a flat dark tone: never glass instead
                plates = [p for p in plates if p.get("material") != "dim"]
            if plates and "plates" in caps:
                surf["plates"] = plates[:32]
            elif plates and isinstance(surf.get("shapes"), list):
                # a v2 glassd: plates become cover shapes (≤ 8), as P6 suggests
                surf["shapes"] = (surf["shapes"] + [{k: round(p[k]) for k in ("x", "y", "w", "h")}
                                                    | {"r": round(p.get("r", min(p["w"], p["h"]) / 2))}
                                                    for p in plates])[:8]
            if "coverDz" in caps and _num(s.get("coverDz"), -1, 1) is not None:
                surf["coverDz"] = _round(round(_num(s["coverDz"], -1, 1), 5))
            if "masks" in caps and s.get("masks") is not None:
                surf["masks"] = clean_masks(s.get("masks"))
            if "scaleFrom" in caps and s.get("scaleFrom") in ("main", "overlay"):
                surf["scaleFrom"] = s["scaleFrom"]
            # materialize: a new slab or plate id appears with materialize (GM §5.4)
            for kind, items in (("slab", surf["slabs"]), ("plate", surf.get("plates") or [])):
                for it in items:
                    key = (name, kind, it["id"])
                    if key not in self.items_first:
                        self.items_first[key] = now
                    if "appear" not in it and "phase" not in it:
                        it["appear"] = "materialize"
                    current[key] = it
            if surf["visible"]:
                shown.add(name)
            surfaces.append(surf)
            by_name[name] = surf
        # ... and one that leaves dematerializes: phase 0 for its out-ramp, then gone
        for key, it in self.items_last.items():
            if key in current or key in self.fading:
                continue
            if key[0] not in shown:            # its surface closed or hid: nothing to fade on
                continue
            until = now + self.ramp_ms(it.get("material"), True, key[1]) / 1000
            self.fading[key] = ({k: v for k, v in it.items() if k != "appear"} | {"phase": 0}, until)
        for key, (it, until) in list(self.fading.items()):
            surf = by_name.get(key[0])
            if key in current or until <= now or surf is None or not surf["visible"]:
                del self.fading[key]
                continue
            surf.setdefault("slabs" if key[1] == "slab" else "plates", []).append(dict(it))
        self.items_last = current
        for key in [k for k in self.items_first if k not in current and k not in self.fading]:
            del self.items_first[key]
        cfg = {"dial": read_dial(), "reduceMotion": bool(self.reduce_motion), "surfaces": surfaces}
        if "unitM" in caps and self.geom and _num(self.geom.get("unitM"), 0.01, 10) is not None:
            cfg["unitM"] = self.geom["unitM"]
        if "masks" in caps and rep.get("masks") is not None:
            cfg["masks"] = clean_masks(rep.get("masks"), world=True)
        if "roomDim" in caps and _num(rep.get("roomDim"), 0, 0.9) is not None:
            cfg["roomDim"] = _round(_num(rep["roomDim"], 0, 0.9))
        return cfg

    def write_glassd_json(self, force=False):
        if not self.native_possible() or (self.dormant_since is not None and not self.glassd_running()):
            return False             # dormant: glassd is stopped and its files are gone until the theme is back
        cfg = self.glassd_config()
        full = json.dumps(cfg, sort_keys=True)
        moving = ("x", "y", "dz", "ox", "oy")
        struct = json.dumps(dict(cfg, surfaces=[
            dict(s, slabs=[{k: v for k, v in sl.items() if k not in moving} for sl in s["slabs"]],
                 plates=[{k: v for k, v in p.items() if k not in moving} for p in s.get("plates") or []])
            for s in cfg["surfaces"]]), sort_keys=True)
        if not force and full == self.gjson_full:
            return False
        now = time.time()
        # Positions alone change while scrolling: write those at most 4x a second.
        if not force and struct == self.gjson_struct and now - self.gjson_written_at < GLASSD_JSON_MIN_INTERVAL:
            return False
        self.gseq += 1
        write_json_atomic(GLASSD_JSON, dict(cfg, seq=self.gseq))
        self.gjson_full, self.gjson_struct, self.gjson_written_at = full, struct, now
        return True

    # ---------------------------------------------------------------- spec
    def track_layers(self, rep, now):
        """Since when each reported layer's rect has been still (within STILL_PX)."""
        seen = {}
        for s in rep.get("surfaces") or []:
            if not isinstance(s, dict):
                continue
            for L in s.get("layers") if isinstance(s.get("layers"), list) else []:
                try:
                    k = (str(s.get("name")), str(L["id"]))
                    r = (float(L["x"]), float(L["y"]), float(L["w"]), float(L["h"]))
                except (KeyError, TypeError, ValueError):
                    continue
                prev = self.layer_still.get(k)
                if prev is not None and max(abs(a - b) for a, b in zip(prev[0], r)) <= STILL_PX:
                    seen[k] = prev
                else:
                    seen[k] = (r, now)
        self.layer_still = seen

    def read_flags(self):
        """Optional panel flags for lgs_sg.js (spec.flags), from /tmp/lgs/sg-flags.json."""
        try:
            m = os.stat(SG_FLAGS).st_mtime_ns
        except OSError:
            m = None
        if m != self.flags_mtime:
            self.flags_mtime = m
            f = read_json(SG_FLAGS) if m is not None else None
            self.flags = f if isinstance(f, dict) and f else None
            if m is not None:
                log(f"systemui: panel flags {self.flags}")
        return self.flags

    def main_resized(self, g):
        """glassd's world width of the main quad, if it reports one (quadW), far
        from nominal: the user resized the window. Until crops are verified to
        follow a resize, main then stays CSS only."""
        q = _num(g.get("quadW"), 0.01, 100)
        if q is None:
            return False
        bad = abs(q / MAIN_QUAD_W - 1) > MAIN_QUAD_TOL
        if bad != bool(self.resized_noted):
            self.resized_noted = bad
            if bad:
                self.note(f"main window is {q:.2f} m wide (nominal {MAIN_QUAD_W}): resized; main stays CSS only")
            else:
                log(f"main window back to {q:.2f} m wide: native again")
        return bad

    def spec_top(self):
        """The spec's top-level v2 fields (contracts/sg.md §3.1)."""
        top = {"profile": self.profile, "reduceMotion": bool(self.reduce_motion),
               "depthMotion": "none" if self.rt_flags.get("sgDepthAnim") is False else "depth"}
        if self.geom and _num(self.geom.get("unitM"), 0.01, 10) is not None:
            top["unitM"] = self.geom["unitM"]
        w = self.window_state()
        if w is not None:
            top["window"] = w
        return top

    def build_spec(self):
        self.wake_at = None
        if not self.native_ok():
            return dict({"M": None, "surfaces": []}, **self.spec_top())
        rep = self.current_report() or {"surfaces": []}
        clips = {}
        gsurf = (self.gout or {}).get("surfaces")
        gsurf = gsurf if isinstance(gsurf, dict) else {}
        now = time.time()
        out = []
        wake = None
        for s in rep.get("surfaces") if isinstance(rep.get("surfaces"), list) else []:
            if not isinstance(s, dict) or not isinstance(s.get("name"), str) or not isinstance(s.get("overlayKey"), str):
                continue
            g = gsurf.get(s["name"])
            if not isinstance(g, dict) or not s.get("visible", True):
                continue
            if s.get("name") == "main" and self.main_resized(g):
                continue
            texW, texH = _num(s.get("texW"), 1, 16384), _num(s.get("texH"), 1, 16384)
            scale = _num(g.get("backdropScale") or 0.75, 0.05, 4)
            gW, gH = _num(g.get("texW"), 1, 16384), _num(g.get("texH"), 1, 16384)
            backdrop = _nums(g.get("backdrop"), 4)
            if None in (texW, texH, scale, gW, gH) or backdrop is None:
                continue
            slabs = g.get("slabs") if isinstance(g.get("slabs"), dict) else {}
            popped, taken, dims = [], [], []
            for L in s.get("layers") if isinstance(s.get("layers"), list) else []:
                if not isinstance(L, dict) or L.get("id") is None:
                    continue
                lid = str(L["id"])[:64]
                x, y, w, h = (_num(L.get(k)) for k in ("x", "y", "w", "h"))
                if None in (x, y, w, h):
                    continue
                uv = _nums(slabs.get(lid), 4)
                if uv is None:
                    continue           # no slab yet: the element stays flat in the base (with its CSS glass)
                if L.get("material") == "dim":
                    # a room-dim cell (glassd §1.4): no element to crop; P7 places
                    # the cell (behind the window, scaled up). Older lgs_sg.js ignore it.
                    dz = _num(L.get("dz") or 0, -1, 1)
                    if dz is not None:
                        dims.append({"id": lid, "x": round(x, 2), "y": round(y, 2), "w": round(w, 2),
                                     "h": round(h, 2), "dz": dz, "slab": uv})
                    continue
                # glassd draws a slab at the element's size x backdropScale; if
                # the element was resized since, wait for the new slab.
                if abs((uv[2] - uv[0]) * gW - w * scale) > SLAB_SIZE_TOL_PX or \
                        abs((uv[3] - uv[1]) * gH - h * scale) > SLAB_SIZE_TOL_PX:
                    continue
                # pop only once the rect has been still: a moving element
                # (scrolling, a focus change) stays flat instead of being
                # cropped at a stale rect for a scene-graph round trip
                still = self.layer_still.get((str(s.get("name")), lid))
                if still is None:
                    continue
                if now - still[1] < STILL_S:
                    t = still[1] + STILL_S
                    wake = t if wake is None else min(wake, t)
                    continue
                # an overlap of a few px with an already popped element (the
                # reporter allows 2 px) is trimmed off; a wider one skips it
                rect = [x, y, x + w, y + h]
                clipped, conflict = False, False
                for t in taken:
                    ix = min(rect[2], t[2]) - max(rect[0], t[0])
                    iy = min(rect[3], t[3]) - max(rect[1], t[1])
                    if ix <= 0 or iy <= 0:
                        continue
                    if min(ix, iy) > OVERLAP_CLIP_PX:
                        conflict = True
                        break
                    clipped = True
                    if ix <= iy:
                        if t[0] <= rect[0] < t[2]:
                            rect[0] = t[2]
                        else:
                            rect[2] = t[0]
                    else:
                        if t[1] <= rect[1] < t[3]:
                            rect[1] = t[3]
                        else:
                            rect[3] = t[1]
                if conflict or rect[2] - rect[0] < 2 or rect[3] - rect[1] < 2:
                    continue
                dz = _num(L.get("dz") or 0.012, -1, 1)
                if dz is None:
                    continue
                taken.append(tuple(rect))
                p = {"id": lid, "x": round(x, 2), "y": round(y, 2), "w": round(w, 2), "h": round(h, 2),
                     "dz": dz, "slab": uv}
                if clipped:
                    p["clip"] = [round(v, 2) for v in rect]
                    clips[(str(s.get("name")), lid)] = p["clip"]
                # depth-channel fields (contracts/sg.md §3.3); interactive only in the wearer profile
                if L.get("interactive") is True and self.profile == "wearer":
                    p["interactive"] = True
                if L.get("from") == "cut" or _num(L.get("from"), -1, 1) is not None:
                    p["from"] = L["from"] if L.get("from") == "cut" else _num(L["from"], -1, 1)
                if isinstance(L.get("motion"), str) and len(L["motion"]) <= 24:
                    p["motion"] = L["motion"]
                if isinstance(L.get("sink"), bool):
                    p["sink"] = L["sink"]
                popped.append(p)
            sp = {"steamKey": s["overlayKey"], "texW": texW, "texH": texH, "visible": True,
                  "glassd": {"key": g.get("key") or "glassd." + s["name"], "backdrop": backdrop, "scale": scale},
                  "coverDz": COVER_DZ, "baseDz": BASE_DZ, "popped": popped}
            if _num(s.get("coverDz"), -1, 1) is not None:
                sp["coverDz"] = _num(s["coverDz"], -1, 1)
            if _num(s.get("dim"), 0, 1) is not None:
                sp["dim"] = _num(s["dim"], 0, 1)
            if isinstance(s.get("mosaic"), list):
                sp["mosaic"] = [r for r in (clean_rect(m, ("x", "y", "w", "h"), ()) for m in s["mosaic"]
                                            if isinstance(m, dict)) if r][:16]
            # slabs glassd is fading out (contracts/daemon.md §7): no crop, their cell
            outs = []
            for (sname, kind, sid), (it, until) in self.fading.items():
                if sname != s.get("name") or kind != "slab":
                    continue
                uv = _nums(slabs.get(sid), 4)
                if uv is not None:
                    outs.append({"id": sid, "x": it.get("x"), "y": it.get("y"), "w": it.get("w"), "h": it.get("h"),
                                 "dz": it.get("dz"), "slab": uv, "until": int(until * 1000)})
            if outs:
                sp["slabsOut"] = outs
            if dims:
                sp["dimSlabs"] = dims
            out.append(sp)
        self.wake_at = wake
        self.pop_clips = clips
        spec = dict({"M": None, "surfaces": out}, **self.spec_top())
        flags = self.read_flags()
        if flags and out:
            spec["flags"] = flags
        return spec

    def native_state(self):
        """(overlay keys that get lgs-native, {key: popped ids shown}, {key: plate
        ids shown}, keys whose cover glass is shown), from the latest systemui
        heartbeat, the spec it reflects and glassd's output (contract §8)."""
        if not (self.native_ok() and self.sysui_ok and self.sg_beat and self.spec_sent_obj):
            return [], {}, {}, []
        b = self.sg_beat
        if time.time() - self.sg_beat_at > SG_BEAT_FRESH_S or b.get("expired") or not b.get("attached") \
                or not b.get("push"):
            return [], {}, {}, []
        gsurf = (self.gout or {}).get("surfaces")
        gsurf = gsurf if isinstance(gsurf, dict) else {}
        names = {s["overlayKey"]: s["name"] for s in (self.current_report() or {}).get("surfaces", [])
                 if isinstance(s, dict) and isinstance(s.get("overlayKey"), str) and isinstance(s.get("name"), str)}
        spec = {s["steamKey"]: {p["id"] for p in s["popped"]} for s in self.spec_sent_obj.get("surfaces", [])}
        now = time.time()
        now_ms = now * 1000
        keys, acks, plates, covers = [], {}, {}, []
        surf = b.get("surf") if isinstance(b.get("surf"), dict) else {}
        for key, sm in surf.items():
            if key not in spec or not isinstance(sm, dict):
                continue
            name = names.get(key)
            g = gsurf.get(name) if isinstance(gsurf.get(name), dict) else {}
            at = _num(sm.get("coverAt") or 0) or 0
            if not at or now_ms - at < SHOWN_MS:
                continue
            # plates: drawn by glassd (listed in its output), in the cover's
            # region (pushed), and their materialize ramp has had time to end
            pl = []
            for pid in g.get("plates") if isinstance(g.get("plates"), list) else []:
                first = self.items_first.get((name, "plate", str(pid)))
                if first is None or (name, "plate", str(pid)) in self.fading:
                    continue
                item = self.items_last.get((name, "plate", str(pid))) or {}
                if now - max(first, at / 1000) >= (self.ramp_ms(item.get("material"), False, "plate") + SHOWN_MS) / 1000:
                    pl.append(str(pid))
            has_cover = g.get("cover") != 0
            if not has_cover and not pl:     # glassd draws no glass for it
                continue
            keys.append(key)
            if has_cover:
                covers.append(key)
            if pl:
                plates[key] = sorted(pl)
            pops = sm.get("pops") if isinstance(sm.get("pops"), dict) else {}
            acks[key] = sorted(i for i, t in pops.items()
                               if _num(t) and now_ms - _num(t) >= SHOWN_MS and i in spec[key])
        return sorted(keys), acks, plates, sorted(covers)

    # ---------------------------------------------------------------- Steam
    def on_binding(self, params):
        if params.get("name") == ACTION_BINDING:
            payload = params.get("payload")
            probe = self.ctx_probe
            if probe and isinstance(payload, str) and payload == json.dumps({"probe": probe[0]}):
                if not probe[1].done():
                    probe[1].set_result(params.get("executionContextId"))
                return
            t = asyncio.get_running_loop().create_task(self.handle_action(payload, params.get("executionContextId")))
            self.action_tasks.add(t)
            t.add_done_callback(self.action_tasks.discard)
            return
        if params.get("name") != BINDING or self.test_report:
            return
        self.take_report(params.get("payload"))

    def take_report(self, payload):
        try:
            rep = json.loads(payload or "null")
        except ValueError as e:
            self.note(f"bad layer report: {e}")
            return
        if not isinstance(rep, dict) or not isinstance(rep.get("surfaces"), list):
            return
        now = time.time()
        self.report_at = now
        self.reports += 1
        # its last report (every surface invisible) when it stops: re-injected
        # on the next steam tick
        self.reporter_state = "stopped (reporter)" if rep.get("stopped") else "reporting"
        hidden = rep.get("dash") is False
        if hidden != self.dash_hidden:
            log("steam: dashboard " + ("hidden: glass layout kept as is" if hidden else "shown"))
        self.dash_hidden = hidden
        # While the dashboard is hidden every surface reports invisible: keep
        # the last layout (nodes, covers, glassd's atlas) so reopening shows the
        # glass at once instead of rebuilding it.
        if hidden and self.report is not None:
            return
        self.track_layers(rep, now)
        self.report = rep
        self.changed.set()

    def reporter_key(self):
        """What the injected reporter depends on: its file, the layer fragments
        and the depth profile. A change re-injects it."""
        self.layers_version = layers_config()[2]
        return f"{file_version(LAYERS_JS)}/{self.layers_version}/{self.profile}"

    def read_test_report(self):
        """Lab: the report comes from a file (--test-report), re-read on change."""
        try:
            m = os.stat(self.test_report).st_mtime_ns
        except OSError:
            m = None
        if m == self.test_report_mtime:
            return
        self.test_report_mtime = m
        if m is None:
            if self.report is not None:
                self.report = None
                self.changed.set()
            self.reporter_state = "test report missing"
            return
        try:
            with open(self.test_report, encoding="utf-8") as f:
                payload = f.read()
        except OSError:
            return
        self.reporter_state = "test report"
        self.take_report(payload)

    async def steam_target(self):
        loop = asyncio.get_running_loop()
        ts = await loop.run_in_executor(None, lambda: http_json(lgs.CDP + "/json/list", 5))
        for t in ts:
            if t.get("title") == "SharedJSContext":
                return t
        raise ConnectionError("no SharedJSContext target")

    # ---------------------------------------------------------------- actions (contract §5)
    async def probe_context(self):
        """Learn SharedJSContext's default execution context id: our own
        evaluation (which runs there) calls the binding with a nonce."""
        async with self.ctx_probe_lock:
            s = self.steam
            if not (self.steam_ok and s is not None and not s.closed):
                return None
            nonce = os.urandom(8).hex()
            fut = asyncio.get_running_loop().create_future()
            self.ctx_probe = (nonce, fut)
            try:
                await s.eval(f"(window.{ACTION_BINDING}({json.dumps(json.dumps({'probe': nonce}))}), 0)", 5)
                self.trusted_ctx = await asyncio.wait_for(fut, 3)
            except (asyncio.TimeoutError, *NET_ERRORS) as e:
                self.note(f"actions: context probe failed: {e!r}")
            finally:
                self.ctx_probe = None
            return self.trusted_ctx

    async def handle_action(self, payload, ctx_id):
        try:
            if self.trusted_ctx is None or ctx_id != self.trusted_ctx:
                await self.probe_context()      # first call, or the page's context changed
            reply = await self.registry.call(payload, from_default_context=ctx_id == self.trusted_ctx)
            if reply is None:
                return
            self.replies.append({k: reply.get(k) for k in ("id", "ok", "error", "dry")} | {"at": time.strftime("%H:%M:%S")})
            await self.bridge_send([["reply", reply]])
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001 - an action must never take the daemon down
            self.note(f"actions: {e!r}")

    async def actions_loop(self):
        """Plugins: load new or changed files, unload removed ones, tick them."""
        while not self.stopping:
            try:
                ch = await self.registry.scan()
                if ch:
                    log(f"actions: plugins {ch}; types {sorted(self.registry.types)}")
                await self.registry.tick()
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                await asyncio.sleep(self.bug("actions", e))
            await asyncio.sleep(ACTION_TICK_S)

    # ---------------------------------------------------------------- bridge (contract §3)
    async def bridge_send(self, pairs):
        s = self.steam
        if not pairs or not (self.steam_ok and s is not None and not s.closed):
            return False
        r = await s.eval(f"({BRIDGE_SET_JS})({json.dumps(pairs)})", 5)
        ok = isinstance(r, str) and r.startswith("ok")
        if ok != self.bridge_runtime:
            log(f"steam: runtime bridge {'present' if ok else 'absent'}")
        self.bridge_runtime = ok
        now = time.time()
        if ok:
            for name, value in pairs:
                if name != "reply":
                    self.bridge_sent[name] = (json.dumps({k: v for k, v in value.items() if k != "at"}
                                                         if isinstance(value, dict) else value, sort_keys=True), now)
        return ok

    async def bridge_tick(self):
        """Send what changed, what the runtime lost (reinstalled), and the
        daemon heartbeat every DAEMON_BEAT_S."""
        s = self.steam
        if not (self.steam_ok and s is not None and not s.closed):
            return
        now = time.time()
        self.bridge_values["daemon"] = self.daemon_value()
        if self.geom is not None:
            self.bridge_values["geom"] = self.geom
        if self.page is not None:
            self.bridge_values["page"] = self.page
        names = sorted(self.bridge_values)
        missing = await s.eval(f"({BRIDGE_MISSING_JS})({json.dumps(names)})", 5)
        if missing is None:
            if self.bridge_runtime is not False:
                log("steam: runtime bridge absent (no __LGS_RT.bridge); values kept for when it appears")
            self.bridge_runtime = False
            self.bridge_sent = {}
            return
        pairs = []
        for name in names:
            v = self.bridge_values[name]
            js = json.dumps({k: x for k, x in v.items() if k != "at"} if isinstance(v, dict) else v, sort_keys=True)
            prev = self.bridge_sent.get(name)
            due = name in (missing or []) or prev is None or prev[0] != js or \
                (name == "daemon" and now - prev[1] >= DAEMON_BEAT_S - 0.05)
            if due:
                pairs.append([name, v])
        if pairs:
            await self.bridge_send(pairs)

    async def inject_reporter(self):
        if not os.path.exists(LAYERS_JS):
            if self.reporter_state != "missing":
                log("lgs_layers.js not installed: main window glass only, nothing pops out")
            self.reporter_state = "missing"
            return False
        with open(LAYERS_JS, encoding="utf-8") as f:
            src = f.read()
        cfg, errs, _ = layers_config()
        for e in errs:
            self.note(f"layers: {e}")
        opts = {"binding": BINDING, "layers": cfg, "version": file_version(LAYERS_JS), "ackMode": True,
                "profile": self.profile}
        if self.geom and _num(self.geom.get("S"), 0.01, 10) is not None and _num(self.geom.get("r"), 0.05, 10):
            opts["geom"] = {"S": self.geom["S"], "r": self.geom["r"]}
        self.reporter_injected_at = time.time()
        self.reporter_version = self.reporter_key()
        try:
            await self.steam.eval(f"(window.__LGS_LAYERS_OPTS = {json.dumps(opts)}, 0)")
            r = await self.steam.eval(src, timeout=30, by_value=False)
            if r.get("type") == "function" and r.get("objectId"):   # a factory: call it with the options
                await self.steam.send("Runtime.callFunctionOn", {
                    "objectId": r["objectId"], "functionDeclaration": "function (o) { return this(o); }",
                    "arguments": [{"value": opts}], "returnByValue": True, "awaitPromise": True})
            if r.get("objectId"):
                await self.steam.send("Runtime.releaseObject", {"objectId": r["objectId"]})
        except RuntimeError as e:      # their bug: report it, retry only when the file changes
            self.reporter_state = f"error: {str(e)[:160]}"
            self.note(f"reporter: {e}")
            return False
        present = await self.steam.eval(f"typeof window.{REPORTER}")
        self.reporter_state = "injected" if present != "undefined" else "injected (no global)"
        self.native_force = True        # a fresh reporter: send the acknowledgements again
        resend = await self.steam.eval(REPORTER_RESEND_JS)
        log(f"reporter injected ({self.reporter_state}, resend: {resend})")
        return True

    async def steam_loop(self):
        while not self.stopping:
            delay = 2
            try:
                try:
                    t = await self.steam_target()
                except NET_ERRORS:
                    # Steam gone (quit, restarting): nothing of ours is left in it;
                    # wait a while for it, then exit (never outlive a Steam restart)
                    self.steam_lost_at = self.steam_lost_at or time.time()
                    if time.time() - self.steam_lost_at >= STEAM_GONE_S:     # --stay too (review R1 M3)
                        log(f"steam: unreachable for {STEAM_GONE_S} s; exiting")
                        self.request_stop("steam gone", strip_vr=True)
                        return
                    raise
                self.steam_lost_at = None
                if self.steam_target_id and t.get("id") != self.steam_target_id:
                    # a new SharedJSContext: Steam (or its UI) restarted. Until
                    # the theme is seen on again, theme off means exit at once.
                    self.steam_restarted = True
                    log("steam: SharedJSContext is a new target (Steam restarted or its UI reloaded)")
                self.steam_target_id = t.get("id")
                self.steam = await CDP("steam", t["webSocketDebuggerUrl"]).open()
                self.steam.handlers["Runtime.bindingCalled"] = self.on_binding
                # lgsLayers only when a reporter can be injected (native mode);
                # a leftover one from an older unit is removed (G-REMOVE, review R1 M1)
                if self.native_possible():
                    await self.steam.send("Runtime.addBinding", {"name": BINDING})
                else:
                    r = await self.steam.eval(f"({DELETE_BINDINGS_JS})({json.dumps([BINDING])})", 10)
                    if r:
                        log(f"steam: removed a leftover binding global {r}")
                await self.steam.send("Runtime.addBinding", {"name": ACTION_BINDING})
                self.steam_ok = True
                self.trusted_ctx, self.bridge_sent = None, {}
                log("steam: connected")
                await self.probe_context()
                self.refresh_flags()
                if self.native_possible() and not self.test_report:
                    await self.inject_reporter()
                tick, slow = 0, 0
                while not self.stopping and not self.steam.closed:
                    try:
                        r = await self.steam.eval(STEAM_TICK_JS, 10)
                        on, rm = json.loads(r) if isinstance(r, str) else (False, False)
                        if bool(rm) != self.reduce_motion:
                            self.reduce_motion = bool(rm)
                            log(f"steam: Reduce Motion {'on' if rm else 'off'}")
                            self.changed.set()
                        if self.refresh_flags() and self.native_possible() and self.reporter_version \
                                and not self.test_report:
                            await self.inject_reporter()        # the depth profile changed
                        self.theme_on = bool(on)
                        self.theme_off_polls = 0 if on else self.theme_off_polls + 1
                        if on:
                            self.steam_restarted = False
                            if self.dormant_since is not None:
                                log(f"steam: theme is back after {time.time() - self.dormant_since:.0f} s; resuming")
                                self.dormant_since = None
                                self.native_force, self.bridge_sent = True, {}
                                self.changed.set()
                        self.check_stay_limit()
                        if self.theme_off_polls >= THEME_OFF_POLLS:
                            # A theme off without `lgs off` (which stops us first) is a
                            # test toggling it (lab --stock, P1's selftests) or a Steam
                            # restart: stay dormant for the grace, exit on a restart.
                            # --stay only lengthens the grace (STAY_MAX_S): a Steam
                            # restart ends a --stay unit too (review R1 M3).
                            grace = self.theme_grace_s()
                            if self.steam_restarted or grace <= 0 or (
                                    self.dormant_since is not None and time.time() - self.dormant_since >= grace):
                                log("steam: theme is off" + (" after a Steam restart" if self.steam_restarted else
                                                             f" (dormant {grace:.0f} s)" if grace > 0 else "")
                                    + "; tearing down")
                                self.request_stop("steam theme off", strip_vr=True)
                                return
                            if self.dormant_since is None:
                                self.dormant_since = time.time()
                                log(f"steam: theme is off; dormant for up to {grace:.0f} s"
                                    + (" (--stay)" if self.stay else "")
                                    + " (native layer, glassd and reporter off; lgs off stops the daemon at once)")
                                self.changed.set()
                        # reporter installed later, changed on disk, or lost (page reload);
                        # stopped again when native mode ended (CSS only) or while dormant
                        if (tick % 3 == 0 or self.dormant_since is not None) and self.reporter_version and (
                                not self.native_possible() or self.dormant_since is not None):
                            r = await self.steam.eval(REPORTER_STOP_JS, 10)
                            log(f"steam: {'dormant' if self.native_possible() else 'native layer off'}; "
                                f"reporter stopped ({r})")
                            self.reporter_version = None
                            self.reporter_state = "stopped (dormant)" if self.native_possible() else "stopped (css only)"
                            self.report, self.fallback = None, None
                        elif self.dormant_since is not None:
                            pass
                        elif self.native_possible() and self.test_report:
                            self.read_test_report()
                        elif self.native_possible() and os.path.exists(LAYERS_JS):
                            if tick % 3 == 0 and self.reporter_key() != self.reporter_version:
                                await self.inject_reporter()
                            elif self.reporter_state == "stopped (reporter)":
                                log("steam: reporter stopped; re-injecting")
                                await self.inject_reporter()
                            elif self.reporter_state in ("injected", "reporting", "foreign"):
                                rs = await self.steam.eval(REPORTER_PING_JS, 10)   # every tick: its heartbeat
                                if rs in ("absent", "stopped", "error") and tick % 3 == 0:
                                    # page reloaded, it stopped itself (no pings or
                                    # heartbeat while we stalled), or someone stopped it
                                    log(f"steam: reporter {rs}; re-injecting")
                                    await self.inject_reporter()
                                elif rs == "foreign" and self.reporter_state != "foreign":
                                    self.note("steam: another lgs_layers instance (other binding) is running; "
                                              "not replacing it; no layer reports meanwhile")
                                    self.reporter_state = "foreign"
                                elif rs == "ok" and self.reporter_state == "foreign":
                                    self.reporter_state = "injected"
                        # no reporter (or it never reported): glass for the main window only
                        if not self.native_possible() or self.test_report or self.dormant_since is not None:
                            pass
                        elif self.report is None and (self.reporter_state == "missing"
                                                      or time.time() - self.reporter_injected_at > 10):
                            size = await self.steam.eval(MAIN_SIZE_JS, 10)
                            fb = None
                            if size:
                                fb = {"seq": 0, "surfaces": [{"name": "main", "overlayKey": "valve.steam.gamepadui.main",
                                                              "visible": True, "texW": size[0], "texH": size[1],
                                                              "radius": 48, "layers": []}]}
                            if fb != self.fallback:
                                self.fallback = fb
                                self.changed.set()
                        elif self.report is not None:
                            self.fallback = None
                        self.write_glassd_json()
                        await self.bridge_tick()
                        slow = 0
                    except (asyncio.TimeoutError, TimeoutError):
                        # Steam's JS thread busy (another agent's audit, a runtime
                        # reload): one late answer is not a lost connection. Closing
                        # the socket here took the native layer down for 2-4 s.
                        slow += 1
                        if self.steam.closed or slow >= STEAM_SLOW_MAX:
                            raise
                        if slow == 1:
                            self.slow_evals += 1
                            log("steam: an evaluation timed out (Steam busy?); connection kept")
                    tick += 1
                    await asyncio.sleep(1.0)
            except asyncio.CancelledError:
                raise
            except NET_ERRORS as e:
                if not self.stopping:
                    self.note(f"steam: {e!r}")
                    if self.steam_ok:
                        delay = 0.5      # a connection that worked: try again at once
            except Exception as e:  # noqa: BLE001 - see bug()
                if not self.stopping:
                    delay = self.bug("steam", e)
            finally:
                self.steam_ok = False
                self.changed.set()
                if self.steam:
                    await self.steam.close()
            if not self.stopping:
                await asyncio.sleep(delay)

    async def native_loop(self):
        """html.lgs-native per window and the popped-layer acknowledgements:
        sent when they change (within 0.1 s) and as a 1 s heartbeat while any
        window is native. Cleared at once when systemui or glassd drops out."""
        sent, sent_at = None, 0.0
        while not self.stopping:
            await asyncio.sleep(0.1)
            s = self.steam
            if not self.steam_ok or s is None or s.closed:
                sent = None
                continue
            try:
                keys, acks, plates, covers = self.native_state()
                payload = (keys, acks, plates, covers)
                now = time.time()
                if not self.native_force:
                    if payload == sent and (not keys or now - sent_at < NATIVE_BEAT_S):
                        continue
                    if sent is None and not keys and not self.native_applied:
                        sent = payload       # nothing native and nothing applied: no call needed
                        continue
                self.native_force = False
                r = await s.eval(f"({NATIVE_JS})({json.dumps(keys)}, {NATIVE_TTL_MS}, {json.dumps(acks)}, "
                                 f"{json.dumps(plates)}, {json.dumps(covers)})", 5)
                res = json.loads(r) if isinstance(r, str) else {}
                sent, sent_at = payload, now
                applied = res.get("applied") or []
                if applied != self.native_applied:
                    log(f"steam: lgs-native on {applied or 'no windows'}")
                self.native_applied = applied
                self.native_tagged = res.get("tagged")
                if (acks, plates) != (self.acked, self.plate_acks):
                    self.bridge_values["acks"] = {"pops": acks, "plates": plates}
                self.acked, self.plate_acks, self.cover_keys = acks, plates, covers
            except asyncio.CancelledError:
                raise
            except NET_ERRORS as e:
                if not self.stopping:
                    self.note(f"steam: lgs-native: {e!r}")
                sent = None
                await asyncio.sleep(1)
            except Exception as e:  # noqa: BLE001 - see bug()
                if not self.stopping:
                    sent = None
                    await asyncio.sleep(self.bug("lgs-native", e))

    # ---------------------------------------------------------------- systemui
    async def sysui_target(self):
        loop = asyncio.get_running_loop()
        ts = await loop.run_in_executor(None, lambda: http_json(lgs_vr.VR_CDP + "/json/list", 3))
        for t in ts:
            if t.get("type") == "page" and t.get("title") == "systemui":
                return t
        for t in ts:
            if t.get("type") == "page" and "systemui" in (t.get("url") or ""):
                return t
        raise ConnectionError("no systemui page on 8090")

    def on_sysui_context(self, params, cleared=False):
        """systemui's page context went away (reload) while the devtools socket
        stays open: our nodes are gone with it. Drop lgs-native at once and
        re-inject (sysui_loop)."""
        ctx = (params or {}).get("executionContextId")
        if cleared or (ctx is not None and ctx == self.sysui_ctx):
            self.sysui_ctx = None
            self.sg_beat, self.sg_beat_at = None, 0.0
            self.sg_reset = True
            self.changed.set()

    def on_sysui_context_created(self, params):
        c = (params or {}).get("context") or {}
        if (c.get("auxData") or {}).get("isDefault"):
            self.sysui_ctx = c.get("id")

    @staticmethod
    def sg_source_version():
        """lgs_sg.js and, when present, P5's motion.js (prepended): a change to
        either re-injects."""
        v = file_version(SG_JS)
        m = file_version(MOTION_JS)
        return f"{v}+{m}" if m else v

    async def send_overrides(self, force=False):
        """theme/sg rules, filtered by flags (refresh_flags), to lgs_sg.js v2."""
        if not force and self.sg_rules_sent == self.sg_rules_sig:
            return
        payload = json.dumps({"seq": self.spec_seq, "rules": self.sg_rules})
        r = await self.sysui.eval(f"(window.__LGS_SG && typeof window.__LGS_SG.overrides === 'function') ? "
                                  f"JSON.stringify(window.__LGS_SG.overrides({payload})) : 'unsupported'", 10)
        self.sg_rules_sent = self.sg_rules_sig
        if self.sg_rules or r != "unsupported":
            log(f"systemui: overrides {[x.get('id') for x in self.sg_rules]} -> {str(r)[:200]}")

    async def inject_sg(self, force=False):
        with open(SG_JS, encoding="utf-8") as f:
            src = f.read().strip().rstrip(";")
        motion = None
        if os.path.exists(MOTION_JS):
            try:
                with open(MOTION_JS, encoding="utf-8") as f:
                    motion = f.read()
            except OSError:
                motion = None
        self.sg_version = self.sg_source_version()
        opts = {"version": self.sg_version, "watchdogMs": WATCHDOG_MS, "maxPushHz": SG_MAX_PUSH_HZ}
        if force:
            opts["force"] = True
        if motion:
            # the depth channel: P5's springs in the same scope (contracts/sg.md §1)
            opts["motion"] = True
            expr = f"(() => {{\n{motion}\n;return ({src})({json.dumps(opts)});\n}})()"
        else:
            expr = f"({src})({json.dumps(opts)})"
        r = await self.sysui.eval(expr, 20)
        self.sg_rules_sent = None          # a fresh instance: send the overrides again
        st = json.loads(r) if isinstance(r, str) else r
        self.sg_status = st
        self.sg_injected_at = time.time()
        self.sg_beat, self.sg_beat_at = None, 0.0
        sch = (st or {}).get("scheduler") or {}
        log(f"systemui: lgs_sg {self.sg_version} installed (scheduler module {sch.get('module')}, "
            f"retire {sch.get('retire')}{', ' + sch['error'] if sch.get('error') else ''})")
        self.spec_sent = None

    def set_beat(self, b):
        if isinstance(b, dict) and "surf" in b:
            self.sg_beat, self.sg_beat_at = b, time.time()

    async def send_spec(self, spec, js):
        self.spec_seq += 1
        payload = json.dumps(dict(spec, seq=self.spec_seq), separators=(",", ":"))
        r = await self.sysui.eval(f"window.__LGS_SG ? JSON.stringify(window.__LGS_SG.update({payload})) : null", 10)
        if r is None:
            await self.inject_sg()
            r = await self.sysui.eval(f"JSON.stringify(window.__LGS_SG.update({payload}))", 10)
        self.spec_sent, self.spec_sent_obj, self.spec_sent_at = js, spec, time.time()
        res = json.loads(r) if r else {}
        self.set_beat(res)
        self.spec_summary = {"seq": self.spec_seq, "surfaces": len(spec["surfaces"]),
                             "popped": sum(len(s["popped"]) for s in spec["surfaces"]),
                             "items": res.get("items"), "counts": res.get("counts")}
        # Log structural changes only, at most once a second (scrolling moves
        # popped elements many times a second).
        sig = (self.spec_summary["surfaces"], self.spec_summary["popped"], json.dumps(res.get("counts"), sort_keys=True))
        if res.get("changed") and sig != self.spec_log_sig:
            now = time.time()
            if now - self.spec_logged_at >= SPEC_LOG_MIN_S:
                more = f" (+{self.spec_log_skipped} more)" if self.spec_log_skipped else ""
                why = "" if spec["surfaces"] else f" [{self.native_why() or 'no surface ready'}]"
                log(f"systemui: spec -> {self.spec_summary}{more}{why}")
                self.spec_logged_at, self.spec_log_sig, self.spec_log_skipped = now, sig, 0
            else:
                self.spec_log_skipped += 1
        return res

    async def sysui_loop(self):
        while not self.stopping:
            delay = 2
            try:
                if not self.sg_wanted():   # CSS only and no override or window state: leave systemui alone
                    await asyncio.sleep(1)
                    continue
                ok = await asyncio.get_running_loop().run_in_executor(None, lgs_vr.available)
                if not ok:
                    await asyncio.sleep(3)
                    continue
                t = await self.sysui_target()
                self.sysui = await CDP("systemui", t["webSocketDebuggerUrl"]).open()
                self.sysui_ctx, self.sg_reset = None, False
                self.sysui.handlers["Runtime.executionContextCreated"] = self.on_sysui_context_created
                self.sysui.handlers["Runtime.executionContextDestroyed"] = self.on_sysui_context
                self.sysui.handlers["Runtime.executionContextsCleared"] = lambda p: self.on_sysui_context(p, True)
                await self.sysui.send("Runtime.enable")
                await self.inject_sg()
                self.sysui_ok = True
                log("systemui: connected")
                next_beat, next_status = 0.0, 0.0
                while not self.stopping and not self.sysui.closed:
                    now = time.time()
                    # wake for a layer that becomes still and for a fade-out that ends
                    # (its phase-0 item leaves glassd.json and slabsOut on time)
                    fade_end = min((u for _, u in self.fading.values()), default=now + 0.5) + 0.01
                    until = min(next_beat, now + 0.5, self.wake_at or now + 0.5, fade_end)
                    try:
                        await asyncio.wait_for(self.changed.wait(), max(0.02, until - now))
                    except asyncio.TimeoutError:
                        pass
                    self.changed.clear()
                    if self.stopping:
                        break
                    if not self.sg_wanted():   # glassd gave up, its binary was removed, overrides off
                        await self.sysui.eval(SG_DESTROY_JS, 10)
                        log("systemui: nothing left to show (native off, no overrides); scene graph removed")
                        break
                    if self.sg_reset:                  # page reloaded under us
                        self.sg_reset = False
                        log("systemui: page context reset (reload?); re-injecting")
                        await asyncio.sleep(0.5)       # let the new page come up
                        await self.inject_sg()
                        next_beat = 0.0
                    if self.sg_source_version() != self.sg_version:
                        await self.inject_sg()
                        next_beat = 0.0
                    await self.send_overrides()
                    self.write_glassd_json()
                    spec = self.build_spec()
                    js = json.dumps(spec, separators=(",", ":"))
                    if js != self.spec_sent:
                        wait = self.spec_sent_at + SPEC_MIN_INTERVAL - time.time()
                        if wait > 0:
                            await asyncio.sleep(wait)
                            spec = self.build_spec()
                            js = json.dumps(spec, separators=(",", ":"))
                        res = await self.send_spec(spec, js)
                        # look again right after lgs_sg.js pushed, to learn when
                        pin = res.get("pushIn")
                        next_beat = min(next_beat, time.time() + (pin if isinstance(pin, (int, float)) else 50) / 1000 + 0.04)
                    now = time.time()
                    if now >= next_beat:
                        r = await self.sysui.eval("window.__LGS_SG ? JSON.stringify(window.__LGS_SG.ping()) : null", 10)
                        if r is None:
                            log("systemui: __LGS_SG gone (page reloaded?); re-injecting")
                            await self.inject_sg()
                            next_beat = 0.0
                            continue
                        b = json.loads(r)
                        self.set_beat(b)
                        if b.get("push"):
                            self.sg_nosched = 0
                        elif now - self.sg_injected_at > min(60, 3 * 2 ** self.sg_nosched):
                            # installed before the page's bundle was ready (or the
                            # module moved): no scheduler, so nothing reaches the
                            # compositor and nothing is native. Retry, backing off.
                            self.sg_nosched += 1
                            self.note(f"systemui: scene-graph scheduler not found; re-injecting (try {self.sg_nosched})")
                            await self.inject_sg(force=True)
                            next_beat = time.time() + 1
                            continue
                        if b.get("rebuilt") or b.get("expired") or (not b.get("items") and spec["surfaces"]):
                            if b.get("rebuilt") or b.get("expired"):
                                self.note(f"systemui: scene-graph watchdog had fired (rebuilt {b.get('rebuilt')}); "
                                          "sending the spec again")
                            self.spec_sent = None
                            self.changed.set()
                        # poll fast only while a push is pending shortly after a change
                        fast = b.get("pending") and now - self.spec_sent_at < 3
                        next_beat = now + (0.1 if fast else NATIVE_BEAT_S)
                    if now >= next_status:
                        next_status = now + 2
                        r = await self.sysui.eval("window.__LGS_SG ? JSON.stringify(window.__LGS_SG.status()) : null", 10)
                        if r:
                            self.sg_status = json.loads(r)
            except asyncio.CancelledError:
                raise
            except NET_ERRORS as e:
                if not self.stopping:
                    self.note(f"systemui: {e!r}")
            except Exception as e:  # noqa: BLE001 - see bug()
                if not self.stopping:
                    delay = self.bug("systemui", e)
            finally:
                self.sysui_ok = False
                self.sg_beat, self.sg_beat_at = None, 0.0
                if self.sysui:
                    await self.sysui.close()
            if not self.stopping:
                await asyncio.sleep(delay)

    # ---------------------------------------------------------------- glassd
    async def glassd_out_loop(self):
        last_check = 0.0
        while not self.stopping:
            await asyncio.sleep(0.1)
            now = time.time()
            if now - last_check >= 1.0:
                last_check = now
                try:
                    await self.supervise_glassd(now)
                except asyncio.CancelledError:
                    raise
                except Exception as e:  # noqa: BLE001 - see bug()
                    await asyncio.sleep(self.bug("glassd supervisor", e))
            try:
                m = os.stat(GLASSD_OUT).st_mtime_ns
            except OSError:
                if self.gout is not None:
                    self.gout = None
                    self.changed.set()
                continue
            if m == self.gout_mtime:
                continue
            self.gout_mtime = m
            try:
                with open(GLASSD_OUT, encoding="utf-8") as f:
                    d = json.load(f)
            except (OSError, ValueError):
                continue           # mid-write; next poll
            if not isinstance(d, dict) or not self.glassd_running():
                continue
            self.gout_seen = now
            if self.g_stale:
                self.g_stale = False
                log("glassd: output fresh again")
            was_ready = self.glassd_ready()
            self.gout = d
            if not self.g_frames and ((_num(d.get("fps") or 0) or 0) > 0 or (_num(d.get("frames") or 0) or 0) > 0):
                self.g_frames = True
                log(f"glassd: producing frames (fps {d.get('fps')}, gpu {d.get('gpu_ms')} ms); native mode")
            if was_ready != self.glassd_ready():
                log(f"glassd: {'ready' if self.glassd_ready() else 'not ready'} (healthy {d.get('healthy')}, "
                    f"exiting {d.get('exiting', False)})")
            self.changed.set()

    async def supervise_glassd(self, now):
        """Once a second: binary removed -> CSS only; dormant -> glassd stopped
        (glassd_loop starts it again when the theme is back); output stale ->
        restart."""
        if not self.native_possible():
            if self.glassd_running():
                await self.kill_glassd()
            if self.gseq and not self.g_files_removed:   # native mode ended mid-session
                self.g_files_removed = True
                remove_glassd_files()
            return
        if not os.access(self.glassd_path, os.X_OK):
            self.disable_native("glassd binary removed")
            await self.kill_glassd()
            return
        if self.dormant_since is not None:
            # theme off without lgs off: nothing to draw, so no camera reader and
            # no render loop while we wait (review R1 M2); not counted as a crash
            if self.glassd_running():
                await self.kill_glassd("dormant")
                remove_glassd_files()
                self.gjson_full = self.gjson_struct = None
            return
        if not self.glassd_running():
            return
        # The real glassd rewrites glassd-out.json every 2 s ("updated"); the
        # stand-in (fakeglassd) only on changes, so staleness is not checked for it.
        if self.gout and "updated" in self.gout and now - self.gout_seen > GLASSD_STALE_S:
            if not self.g_stale:
                self.g_stale = True
                self.changed.set()
                self.note(f"glassd: no output for {now - self.gout_seen:.0f} s (hung?); restarting it")
                await self.kill_glassd()
        elif not self.gout and now - self.g_started > GLASSD_FIRST_OUT_S:
            self.note(f"glassd: no glassd-out.json after {GLASSD_FIRST_OUT_S:.0f} s; restarting it")
            await self.kill_glassd()

    async def pipe_glassd(self, proc):
        while True:
            try:
                line = await proc.stdout.readline()
            except ValueError:     # a line over the stream limit (the reader dropped it)
                print("glassd: [over-long output line dropped]", flush=True)
                continue
            if not line:
                return
            print("glassd: " + line.decode(errors="replace").rstrip(), flush=True)

    async def glassd_loop(self):
        if not self.native_possible():
            log(f"CSS only + SteamVR page theming ({self.css_reason})")
            return
        temp_streak = 0
        while not self.stopping and self.native_possible():
            if not os.access(self.glassd_path, os.X_OK):
                self.disable_native("glassd binary removed")
                return
            # glassd needs SteamVR and something to cover (and the theme on: not dormant)
            if not (self.sysui_ok and self.steam_ok and self.theme_on and self.dormant_since is None
                    and self.current_report()):
                await asyncio.sleep(1)
                continue
            for p in (GLASSD_OUT,):
                try:
                    os.remove(p)
                except OSError:
                    pass
            self.gout, self.gout_mtime, self.g_frames, self.g_stale = None, None, False, False
            self.write_glassd_json(force=True)
            args = [self.glassd_path] + self.glassd_args + os.environ.get("LGS_GLASSD_ARGS", "").split()
            try:
                self.gproc = await asyncio.create_subprocess_exec(
                    *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
                    stdin=asyncio.subprocess.DEVNULL, start_new_session=False, limit=1 << 20,
                    preexec_fn=_pdeathsig)
            except OSError as e:
                self.note(f"glassd: cannot start: {e}")
                self.g_given_up = True
                self.disable_native(f"glassd cannot start: {e}")
                return
            self.g_pid = self.gproc.pid
            self.g_started = time.time()
            self.gout_seen = self.g_started
            log(f"glassd: started pid {self.g_pid} ({' '.join(args)})")
            piper = asyncio.create_task(self.pipe_glassd(self.gproc))
            rc = await self.gproc.wait()
            await asyncio.gather(piper, return_exceptions=True)
            self.g_last_exit = rc
            self.g_frames = False
            self.gout = None
            self.changed.set()
            if self.stopping or not self.native_possible():
                return
            if self.g_kill_reason == "dormant":    # we stopped it: wait for the theme (top of the loop)
                self.g_kill_reason = None
                temp_streak = 0
                continue
            self.g_kill_reason = None
            self.g_restarts += 1
            if rc == GLASSD_TEMP_EXIT:        # SteamVR went away, or another glassd holds the lock
                self.g_temp_exits += 1
                temp_streak += 1
                if temp_streak == 1 or temp_streak % 10 == 0:
                    self.note(f"glassd: exited {rc} (temporary; SteamVR gone or lock held), "
                              f"retrying ({temp_streak} in a row)")
                await asyncio.sleep(min(30, 3 * temp_streak))
                continue
            temp_streak = 0
            now = time.time()
            self.g_crashes = [t for t in self.g_crashes if now - t < GLASSD_CRASH_WINDOW] + [now]
            self.note(f"glassd: exited with {rc} after {now - self.g_started:.1f} s")
            if len(self.g_crashes) >= GLASSD_MAX_CRASHES:
                self.g_given_up = True
                self.disable_native(f"glassd gave up: {GLASSD_MAX_CRASHES} exits in {GLASSD_CRASH_WINDOW} s")
                return
            await asyncio.sleep(min(30, 2 ** len(self.g_crashes)))

    async def kill_glassd(self, reason=None):
        """SIGTERM glassd (SIGKILL after 4 s). reason 'dormant' = on purpose,
        not a crash (glassd_loop does not count it nor back off)."""
        p = self.gproc
        if not p or p.returncode is not None:
            return
        self.g_kill_reason = reason
        if reason:
            log(f"glassd: stopping it ({reason})")
        try:
            p.terminate()
            await asyncio.wait_for(p.wait(), 4)
        except asyncio.TimeoutError:
            p.kill()
            await p.wait()
        except ProcessLookupError:
            pass
        log(f"glassd: stopped ({p.returncode})")

    # ---------------------------------------------------------------- geometry and page (contract §4)
    @staticmethod
    def round_geom(g, prev):
        def rn(v, nd):
            f = _num(v)
            return None if f is None else round(f, nd)
        out = {"v": 1, "S": rn(g.get("S"), 4), "H0": rn(g.get("H0"), 4), "r": rn(g.get("r"), 4),
               "Hm": rn(g.get("Hm"), 4), "unitM": rn(g.get("unitM"), 4), "mmPerCssPx": rn(g.get("mmPerCssPx"), 4),
               "dashDist": rn(g.get("dashDist"), 3), "frameMenu": None}
        fm = g.get("frameMenu")
        if isinstance(fm, dict) and fm.get("key"):
            m = {"key": fm["key"], "mpp": rn(fm.get("mpp"), 7), "visible": bool(fm.get("visible")),
                 "uv": [rn(v, 4) for v in fm.get("uv") or []]}
            pf = (prev or {}).get("frameMenu") or {}
            if fm.get("dumped"):
                m["fWidth"], m["fHeight"] = rn(fm.get("fWidth"), 4), rn(fm.get("fHeight"), 4)
            elif pf.get("key") == m["key"]:
                m["fWidth"], m["fHeight"] = pf.get("fWidth"), pf.get("fHeight")
            if m.get("fHeight") and m["mpp"]:
                m["clipTexH"] = round(m["fHeight"] / m["mpp"], 1)
                m["clipCssH"] = round(m["clipTexH"] / 1.5, 1)
                if out["S"] and m["clipCssH"]:
                    m["mpMm"] = round(1000 * m["fHeight"] * out["S"] / m["clipCssH"], 3)
            out["frameMenu"] = m
        return out

    async def geom_loop(self):
        """Read-only geometry and page from systemui, in both modes, published
        on the bridge when they change (polled 1/s). DumpLaserOverlays (the
        frame menu's panel size) runs 1, 3 and 6 s after the frame menu's node
        or another value changed (the dump lags the node), and every
        GEOM_DUMP_S as a safety net."""
        loop = asyncio.get_running_loop()
        conn = None
        last_dump, dumps_at, fm_sig = 0.0, [0.0], None
        while not self.stopping:
            delay = 3
            try:
                if not await loop.run_in_executor(None, lgs_vr.available):
                    await asyncio.sleep(3)
                    continue
                t = await self.sysui_target()
                conn = await CDP("systemui-geom", t["webSocketDebuggerUrl"]).open()
                self.geom_ok = True
                dumps_at = [0.0]                            # a fresh connection: dump at once
                while not self.stopping and not conn.closed:
                    now = time.time()
                    want = now - last_dump >= GEOM_DUMP_S or any(a <= now for a in dumps_at)
                    r = await conn.eval(f"({GEOM_JS})({'true' if want else 'false'})", 10)
                    d = json.loads(r) if isinstance(r, str) else {}
                    if want:
                        last_dump = now
                        dumps_at = [a for a in dumps_at if a > now]
                        if isinstance(d.get("geom"), dict) and ((d["geom"].get("frameMenu") or {}).get("dumped")
                                                                 or not d["geom"].get("frameMenu")):
                            self.geom_dump_at = now
                    if d.get("fmSig") != fm_sig:
                        if fm_sig is not None:
                            dumps_at = [now + a for a in GEOM_DUMP_AFTER]   # the panel may have changed size
                        fm_sig = d.get("fmSig")
                    self.geom_err = d.get("err")
                    if isinstance(d.get("geom"), dict):
                        g = self.round_geom(d["geom"], self.geom)
                        old = {k: v for k, v in (self.geom or {}).items() if k != "at"}
                        if g != old:
                            if self.geom is not None and not want and not dumps_at:
                                dumps_at = [now + a for a in GEOM_DUMP_AFTER]   # something moved: the panel too
                            if (self.geom or {}).get("unitM") != g.get("unitM"):
                                self.changed.set()          # glassd's unitM and the spec follow
                            self.geom = dict(g, at=int(now * 1000))
                            self.bridge_values["geom"] = self.geom
                    if isinstance(d.get("page"), dict):
                        p = dict(d["page"], v=1)
                        p["pages"] = {str(k): v for k, v in (p.get("pages") or {}).items()}
                        if p != {k: v for k, v in (self.page or {}).items() if k != "at"}:
                            if self.page is not None:
                                log(f"systemui: frame page {self.page.get('summonKey')} -> {p.get('summonKey')}")
                            self.page = dict(p, at=int(now * 1000))
                            self.bridge_values["page"] = self.page
                    await asyncio.sleep(GEOM_POLL_S)
            except asyncio.CancelledError:
                raise
            except NET_ERRORS as e:
                if not self.stopping:
                    self.note(f"geometry: {e!r}")
            except Exception as e:  # noqa: BLE001 - see bug()
                if not self.stopping:
                    delay = self.bug("geometry", e)
            finally:
                self.geom_ok = False
                if self.page is not None:
                    self.page = {"v": 1, "at": int(time.time() * 1000), "frameID": None, "activePageID": None,
                                 "summonKey": None, "steam": None, "pages": {}}
                    self.bridge_values["page"] = self.page
                if conn:
                    await conn.close()
                    conn = None
            if not self.stopping:
                await asyncio.sleep(delay)

    # ---------------------------------------------------------------- SteamVR page scripts (contract §6)
    async def vr_scripts_for(self, t, scripts):
        """Install, refresh or remove the page scripts of one SteamVR page."""
        name = t.get("title") or t.get("url")
        flags = self.rt_flags
        st = self.vrx_status.setdefault(name, {})
        mine = {n: s for n, s in scripts.items() if s["page"] == name}
        want = {n: s for n, s in mine.items() if not s["flag"] or flags.get(s["flag"]) is True}
        if not want and not any(v in ("installed", "ok") for v in st.values()):
            for n, s in mine.items():
                st[n] = "flag-off"
            for n in [n for n in st if n not in mine]:
                del st[n]
            return
        r = await self.vr_page_eval(t, f"({VRX_PROBE_JS})({json.dumps({n: s['version'] for n, s in want.items()})})", 10)
        probe = json.loads(r) if isinstance(r, str) else {}
        extra = [n for n, v in probe.items() if v == "extra"]
        if extra:
            await self.vr_page_eval(t, f"({VRX_REMOVE_JS})({json.dumps(extra)})", 10)
            log(f"vr: {name}: page scripts removed {extra}")
            for n in extra:
                st[n] = "flag-off" if n in mine else "removed"
        for n in [n for n in st if n not in mine and n not in extra]:
            del st[n]
        for n, s in mine.items():
            if n not in want:
                st[n] = "flag-off"
        for n, s in want.items():
            if probe.get(n) == "ok":
                st[n] = "ok"
                continue
            if self.vrx_failed.get((name, n)) == s["version"]:
                continue
            ctx = {"name": n, "page": name, "version": s["version"], "flags": dict(flags)}
            res = await self.vr_page_eval(t, vrx_install_js(n, s["version"], ctx, s["src"]), 15)
            st[n] = res if isinstance(res, str) else str(res)
            if st[n].startswith("error"):
                self.vrx_failed[(name, n)] = s["version"]
                self.note(f"vr: {name}: page script {n} failed: {st[n][:160]}")
            else:
                self.vrx_failed.pop((name, n), None)
                log(f"vr: {name}: page script {n} {st[n]} ({s['version']})")

    async def vr_scripts_remove_all(self):
        loop = asyncio.get_running_loop()
        out = {}
        try:
            if not await loop.run_in_executor(None, lgs_vr.available):
                return out
            for t in await loop.run_in_executor(None, lgs_vr.targets):
                try:
                    out[t.get("title") or t.get("url")] = await eval_once(
                        t["webSocketDebuggerUrl"], f"({VRX_REMOVE_JS})(null)", 10)
                except Exception:  # noqa: BLE001 - page closing
                    pass
        except Exception as e:  # noqa: BLE001
            log(f"vr: removing page scripts: {e!r}")
        self.vrx_status = {}
        return out

    # ---------------------------------------------------------------- SteamVR page theming
    async def vr_list(self):
        """SteamVR's page targets (8090 /json/list) over one kept-alive HTTP
        session (no new TCP connection per poll; review R1 m4), or None while
        SteamVR's devtools are unreachable."""
        import aiohttp
        if self.vr_http is None or self.vr_http.closed:
            self.vr_http = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=3))
        try:
            async with self.vr_http.get(lgs_vr.VR_CDP + "/json/list") as r:
                ts = await r.json(content_type=None)
        except NET_ERRORS:
            return None
        return [t for t in ts if isinstance(t, dict) and t.get("type") == "page"
                and t.get("webSocketDebuggerUrl")] if isinstance(ts, list) else None

    async def vr_page_eval(self, t, expr, timeout=10):
        """Evaluate in a SteamVR page over its kept socket (opened on first
        use; dropped when it fails, times out or the page goes). A JS error
        keeps the socket."""
        tid = t.get("id") or t["webSocketDebuggerUrl"]
        c = self.vr_conns.get(tid)
        if c is None or c.closed:
            c = await CDP("vr:" + str(t.get("title") or tid), t["webSocketDebuggerUrl"]).open()
            self.vr_conns[tid] = c
        try:
            return await c.eval(expr, timeout)
        except RuntimeError as e:
            if c.closed or not str(e).startswith("JS: "):
                self.vr_conns.pop(tid, None)
                await c.close()
            raise
        except BaseException:
            self.vr_conns.pop(tid, None)
            await c.close()
            raise

    def vr_scripts_cached(self):
        """vr_scripts(), re-read only when a file in its folders changed."""
        sig = []
        for folder in VR_SCRIPT_DIRS:
            try:
                for n in sorted(os.listdir(folder)):
                    if n.endswith(".js"):
                        sig.append((folder, n, os.stat(os.path.join(folder, n)).st_mtime_ns))
            except OSError:
                continue
        if sig != self.vrx_sig:
            self.vrx_sig, self.vrx_scripts = sig, vr_scripts()
        return self.vrx_scripts

    async def vr_conns_close(self, keep=()):
        for tid in [k for k in self.vr_conns if k not in keep]:
            await self.vr_conns.pop(tid).close()

    async def vr_theme_loop(self):
        sig, full, probe = None, None, None
        while not self.stopping:
            await asyncio.sleep(lgs_vr.POLL)
            if os.path.exists(VR_PAUSE):     # lab "--theme off" on a vr: page (page scripts stripped with it)
                self.vrx_status = {}
                await self.vr_conns_close()
                continue
            try:
                ts = await self.vr_list()
                if ts is None:
                    await self.vr_conns_close()
                    continue
                s = lgs_vr.signature()
                if s != sig:
                    sig = s
                    p = lgs_vr.payload()
                    full = lgs_vr.core_call(p)
                    probe = (f"(window.__LGS_VR && window.__LGS_VR.version === {json.dumps(p['version'])})"
                             " ? (window.__LGS_VR.apply() ? 'ok' : 'retry') : 'need'")
                    self.vr_version = p["version"]
                    log(f"vr: theme {p['version']} ({len(p['css'])} bytes)")
                pages = {}
                scripts = self.vr_scripts_cached()
                await self.vr_conns_close(keep={t.get("id") or t["webSocketDebuggerUrl"] for t in ts})
                for t in ts:
                    name = t.get("title") or t.get("url")
                    try:
                        r = await self.vr_page_eval(t, probe, 10)
                        if r == "need":
                            r = await self.vr_page_eval(t, full, 30)
                            log(f"vr: {name}: {r}")
                        pages[name] = r
                        if r in ("ok", "applied"):         # page scripts go in after the page's theme
                            await self.vr_scripts_for(t, scripts)
                    except Exception:  # noqa: BLE001 - page reloading or closing
                        pages[name] = "error"
                self.vr_pages = pages
                for gone in [n for n in self.vrx_status if n not in pages]:
                    del self.vrx_status[gone]
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001 - best effort, like lgs-vr
                self.note(f"vr: {e!r}")

    # ---------------------------------------------------------------- status
    async def status_loop(self):
        while not self.stopping:
            try:
                m = os.stat(lgs.DIAL).st_mtime_ns
            except OSError:
                m = None
            if m != self.dial_mtime:
                self.dial_mtime = m
                self.write_glassd_json()
            try:
                write_json_atomic(STATUS, self.status())
            except OSError:
                pass
            await asyncio.sleep(2)

    # ---------------------------------------------------------------- lifecycle
    def request_stop(self, reason, strip_vr=False, code=0):
        """Start the shutdown once (signal handlers, theme off, fatal errors)."""
        if self.stop_task is None:
            self.stop_task = asyncio.get_running_loop().create_task(self.stop(reason, strip_vr, code))
        return self.stop_task

    async def stop(self, reason, strip_vr=False, code=0):
        # Cancel the workers first, so a late spec push cannot re-create the
        # nodes that teardown removes; teardown uses fresh devtools sessions.
        self.stopping = True
        self.exit_code = code
        log(f"stopping: {reason}")
        try:      # tells "lgs on" (start()) to wait for us instead of calling us running
            st = self.status()
            st.update(mode="stopping", stopping=reason)
            write_json_atomic(STATUS, st)
        except OSError:
            pass
        self.changed.set()
        for t in self.tasks:
            t.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
        await self.teardown(strip_vr)

    async def teardown(self, strip_vr=False):
        if self.torn:
            return
        self.torn = True
        loop = asyncio.get_running_loop()
        try:      # the kept SteamVR page sockets and 8090 HTTP session (teardown uses fresh ones)
            await self.vr_conns_close()
            if self.vr_http is not None:
                await self.vr_http.close()
        except Exception as e:  # noqa: BLE001
            log(f"teardown: closing page sockets: {e!r}")
        # 0. plugins undo what they did (e.g. a deep link switched SteamVR's
        #    frame page), then the SteamVR page scripts come out
        try:
            await asyncio.wait_for(self.registry.stop(), 15)
            log("teardown: action plugins stopped")
        except Exception as e:  # noqa: BLE001
            log(f"teardown: plugins: {e!r}")
        for t in list(self.action_tasks):
            t.cancel()
        r0 = await self.vr_scripts_remove_all()
        if any(r0.values()):
            log(f"teardown: page scripts removed {r0}")
        # 1. scene graph: back to Steam's own panels (also in CSS-only mode:
        #    transform overrides restore with destroy())
        try:
            if await loop.run_in_executor(None, lgs_vr.available):
                t = await self.sysui_target()
                r = await eval_once(t["webSocketDebuggerUrl"],
                                    SG_DESTROY_JS, 10)
                log(f"teardown: scene graph {r}")
        except Exception as e:  # noqa: BLE001
            log(f"teardown: scene graph: {e!r}")
        # 2. Steam: lgs-native off, reporter off, binding removed
        try:
            t = await self.steam_target()
            s = await CDP("steam-teardown", t["webSocketDebuggerUrl"]).open()
            try:
                r = await s.eval("window.__LGS_NATIVE ? JSON.stringify(window.__LGS_NATIVE.clear()) : 'absent'", 10)
                rr = await s.eval(REPORTER_STOP_JS, 10)
                for b in (BINDING, ACTION_BINDING):
                    try:
                        await s.send("Runtime.removeBinding", {"name": b})
                    except RuntimeError:
                        pass
                # the bridge learns the daemon is gone at once (not after its TTL)
                gone = dict(self.daemon_value(), mode="stopped", native=False, actions=[], steamvr=False, ttlMs=0)
                await s.eval(f"({BRIDGE_SET_JS})({json.dumps([['daemon', gone]])})", 5)
                # the inert binding functions (both: removeBinding leaves them):
                # gone, so callers see no daemon and nothing of ours stays (G-REMOVE)
                rb = await s.eval(f"({DELETE_BINDINGS_JS})({json.dumps([BINDING, ACTION_BINDING])})", 5)
            finally:
                await s.close()
            log(f"teardown: lgs-native {r}, reporter {rr}, binding globals deleted [{rb}]")
        except Exception as e:  # noqa: BLE001
            log(f"teardown: steam: {e!r}")
        # 3. glassd
        await self.kill_glassd()
        remove_glassd_files()
        # 4. SteamVR pages (only when the Steam theme went away)
        if strip_vr:
            try:
                await loop.run_in_executor(None, lgs_vr.strip)
                log("teardown: SteamVR pages stripped")
            except Exception as e:  # noqa: BLE001
                log(f"teardown: strip: {e!r}")
        try:
            st = self.status()
            st.update(mode="stopped", stopped=time.time())
            write_json_atomic(STATUS, st)
        except OSError:
            pass

    async def run(self):
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
            loop.add_signal_handler(sig, lambda s=sig: self.request_stop(signal.Signals(s).name))
        os.makedirs(SHM, exist_ok=True)
        log(f"lgs-shell starting (pid {os.getpid()}, "
            + (f"native, glassd {self.glassd_path} {' '.join(self.glassd_args)}".rstrip() if self.native_enabled
               else f"css only: {self.css_reason}") + ")")
        self.refresh_flags()
        self.tasks = [loop.create_task(c) for c in (
            self.steam_loop(), self.native_loop(), self.sysui_loop(), self.glassd_loop(), self.glassd_out_loop(),
            self.vr_theme_loop(), self.status_loop(), self.geom_loop(), self.actions_loop())]
        pending = set(self.tasks)
        while self.stop_task is None and pending:
            done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            if self.stop_task is not None:
                break
            for t in done:
                if not t.cancelled() and t.exception() is not None:   # a bug, not a lost connection
                    log(f"fatal: {t.exception()!r}")
                    self.request_stop(f"fatal {t.exception()!r}", code=1)
                    break
            # a loop that ends normally (CSS only, glassd given up) is fine
        if self.stop_task is None:
            self.request_stop("all loops ended")
        await self.stop_task
        for c in list(CDP.live):          # sockets a cancelled task left open
            await c.close()
        await asyncio.sleep(0)
        log("lgs-shell exited")
        return self.exit_code


# ------------------------------------------------------------------ unit control

def user_env():
    return lgs_vr.user_env()


def unit_info():
    """(ActiveState, MainPID) of the unit."""
    r = subprocess.run(["systemctl", "--user", "show", "-p", "ActiveState", "-p", "MainPID", UNIT],
                       capture_output=True, text=True, env=user_env())
    d = dict(line.split("=", 1) for line in r.stdout.splitlines() if "=" in line)
    try:
        pid = int(d.get("MainPID") or 0)
    except ValueError:
        pid = 0
    return d.get("ActiveState") or "inactive", pid


def unit_active():
    return unit_info()[0] in ("active", "activating", "reloading")


def daemon_argv(pid):
    try:
        with open(f"/proc/{pid}/cmdline", "rb") as f:
            return [a.decode(errors="replace") for a in f.read().split(b"\0") if a]
    except OSError:
        return []


def daemon_stopping(pid):
    st = read_json(STATUS) or {}
    return bool(pid) and st.get("pid") == pid and st.get("mode") in ("stopping", "stopped")


def settle(timeout=20.0):
    """Wait while the unit is stopping (deactivating, or its daemon tearing
    itself down after the theme went off). Returns (state, pid)."""
    end = time.time() + timeout
    while True:
        state, pid = unit_info()
        if not (state == "deactivating" or (state in ("active", "activating") and daemon_stopping(pid))):
            return state, pid
        if time.time() > end:
            subprocess.run(["systemctl", "--user", "stop", UNIT], capture_output=True, env=user_env())
            return unit_info()
        time.sleep(0.25)


def stay_arg(argv):
    return "--stay" in argv


def native_arg(argv):
    """--native: opt in to the native layer; --css: CSS only; neither: None."""
    return True if "--native" in argv else (False if "--css" in argv else None)


def glassd_args_arg(argv):
    """--glassd-args "ARGS": extra glassd arguments (tests: --no-feed, --key-prefix)."""
    if "--glassd-args" in argv:
        return argv[argv.index("--glassd-args") + 1].split()
    return None


def glassd_arg(argv):
    if "--glassd" in argv:
        v = argv[argv.index("--glassd") + 1]
        return None if v == "none" else os.path.abspath(v)
    return GLASSD_BIN


NATIVE_MODES = ("auto", "on", "off")      # start(native=...) takes these (P1 checks for it)


def core_args(argv):
    """A daemon's arguments without the bookkeeping ones (--req, --src)."""
    out, skip = [], False
    for a in argv:
        if skip:
            skip = False
            continue
        if a in ("--req", "--src"):
            skip = True
            continue
        out.append(a)
    return out


def start(glassd=GLASSD_BIN, stay=False, glassd_args=None, native=None, test_report=None, assume_caps=None):
    """Start the unit. Also resumes SteamVR page theming that a lab "--theme
    off" on a vr: page paused.

    native: 'on' / True runs the native layer, 'off' / False CSS only; both
    restart a unit that runs otherwise. None or 'auto' keeps a running unit as
    it is, whatever its mode (a plain `lgs on` never ends another agent's
    native session); a new unit resolves auto (resolve_native: flags.json,
    then defaults.json, else CSS only). A unit that is stopping is waited for
    and then started fresh. stay=True (lab testing only) keeps it running,
    dormant, while the Steam theme is off. test_report (lab) replaces the
    reporter with a report JSON file.

    Serialized by START_LOCK: two `lgs on` at once (one lock-free) made the
    loser's systemd-run fail with "already loaded" although a unit ran (review
    R1 m5); if the lock cannot be had in 60 s, it goes on and treats that
    error as running."""
    try:
        lk = FileLock(START_LOCK, 60).__enter__()
    except (OSError, TimeoutError):
        lk = None
    try:
        return _start(glassd, stay, glassd_args, native, test_report, assume_caps)
    finally:
        if lk is not None:
            lk.__exit__()


def _start(glassd, stay, glassd_args, native, test_report, assume_caps):
    req = "auto" if native is None else native_word(native)
    try:
        os.remove(VR_PAUSE)
    except OSError:
        pass
    # the pre-native watcher, if an older lgs started it
    subprocess.run(["systemctl", "--user", "stop", lgs_vr.UNIT], capture_output=True, env=user_env())

    def daemon_args(nat):
        return ["--glassd", (glassd if nat and glassd else "none")] + (["--native"] if nat else []) + \
            (["--stay"] if stay else []) + (["--glassd-args", " ".join(glassd_args)] if nat and glassd_args else []) + \
            (["--test-report", os.path.abspath(test_report)] if test_report else []) + \
            (["--assume-caps", ",".join(assume_caps)] if assume_caps else [])

    state, pid = settle()
    if state in ("active", "activating", "reloading"):
        argv = daemon_argv(pid)
        cur = "--native" in argv
        running = core_args(argv[argv.index("daemon") + 1:]) if "daemon" in argv else None
        # an explicit request restarts a unit that runs differently
        st = read_json(STATUS) or {}
        stay_over = req == "on" and st.get("pid") == pid and \
            str((st.get("native") or {}).get("reason") or "").startswith("--stay limit")
        if (req == "auto" or running == daemon_args(req == "on")) and not stay_over:
            if cur and st.get("pid") == pid and not (st.get("native") or {}).get("enabled", True):
                return f"running (native requested; {st.get('mode')})"
            return "running (native)" if cur else "running (css only)"
        stop()          # (a --stay unit past its limit is restarted for a new explicit native request)
        settle()
    nat, src, reason = resolve_native(req)
    subprocess.run(["systemctl", "--user", "reset-failed", UNIT], capture_output=True, env=user_env())
    cmd = ["systemd-run", "--user", "--unit", UNIT, "--collect", "--quiet",
           "-p", "KillMode=mixed", "-p", "TimeoutStopSec=15", "-E", "PYTHONDONTWRITEBYTECODE=1",
           "--description=Glass Shell: native glass layer + SteamVR page theming (transient)",
           "/usr/bin/python3", "-B", "-u", os.path.realpath(__file__), "daemon"] + daemon_args(nat) + \
        ["--req", req, "--src", src]
    r = subprocess.run(cmd, capture_output=True, text=True, env=user_env())
    if r.returncode != 0:
        if "already loaded" in r.stderr or "already exists" in r.stderr:
            # another start won a race (one without the start lock): a unit runs
            state, pid = settle()
            if state in ("active", "activating", "reloading"):
                cur = "--native" in daemon_argv(pid)
                return "running (native, started concurrently)" if cur else "running (css only, started concurrently)"
        return f"failed: {r.stderr.strip()}"
    if nat and not (glassd and os.access(glassd, os.X_OK)):
        return "started (css only: native requested but no glassd binary)"
    return "started (native)" if nat else "started (css only)"


def stop():
    """Stop the unit; its SIGTERM handler removes every node, class and file."""
    was = unit_active()
    subprocess.run(["systemctl", "--user", "stop", UNIT], capture_output=True, env=user_env())
    subprocess.run(["systemctl", "--user", "stop", lgs_vr.UNIT], capture_output=True, env=user_env())
    return "stopped" if was else "not running"


def status():
    state, pid = unit_info()
    out = {"unit": "active" if state in ("active", "activating", "reloading") else state}
    st = read_json(STATUS)
    if isinstance(st, dict) and (out["unit"] == "active" or st.get("mode") == "stopped"):
        age = time.time() - st.get("updated", 0)
        out.update(st)
        out["statusAgeS"] = round(age, 1)
    return out


def brief(st):
    """One-level summary for lgs status."""
    if st.get("unit") != "active":
        return {"unit": st.get("unit")}
    g, s, u = st.get("glassd", {}), st.get("steam", {}), st.get("systemui", {})
    a, geo = st.get("actions") or {}, st.get("geom") or {}
    return {"unit": "active", "mode": st.get("mode"), "native": st.get("native"), "dormant": st.get("dormant"),
            "glassd": {k: g.get(k) for k in ("running", "ready", "pid", "restarts", "fps", "gpu_ms", "surfaces",
                                              "caps")},
            "layers": {"source": s.get("source"), "reporter": s.get("reporter"), "surfaces": s.get("surfaces")},
            "lgsNative": s.get("lgsNative"),
            "sceneGraph": {"items": u.get("items"), "panels": u.get("panels"), "attached": u.get("attached"),
                           "overrides": (st.get("sgRules") or {}).get("active")},
            "steamvrPages": len((st.get("steamvrPages") or {}).get("pages") or {}),
            "vrScripts": st.get("vrScripts"),
            "bridge": (st.get("bridge") or {}).get("runtime"),
            "geom": {k: geo.get(k) for k in ("S", "r", "Hm", "unitM")} if geo else None,
            "page": (st.get("page") or {}).get("summonKey"),
            "actions": {"types": a.get("types"), "calls": a.get("calls"), "failed": a.get("failed")},
            "profile": st.get("profile"),
            "errors": (st.get("errors") or [])[-3:]}


# ------------------------------------------------------------------ lab self-tests (contract §11)

TEST_SCRIPT_JS = r"""// lgs_shell.py selftest dm5: a test page script (RAM only; the test removes it)
(function (ctx) {
  const el = document.documentElement;
  el.dataset.lgsEcho = ctx.version;
  return { remove() { delete el.dataset.lgsEcho; }, status() { return { echo: el.dataset.lgsEcho || null }; } };
})
"""
TEST_SCRIPT = "/tmp/lgs/vr-scripts/systemui.p8echo.js"
SP12_SNIPPET = ("(()=>{const f=FrameStore.frames.find(x=>/page:3/.test(x.activePage&&x.activePage.mountableID))"
                "||FrameStore.frames[0]; const z=f.activePage.size, S=DashboardStore.dashboardScale, "
                "H0=f.size.mainPanelHeightOverride||1.5; const r=z.latestMeasuredPanelLocalHeight/H0, "
                "Hw=z.latestMeasuredPanelWorldHeight; return JSON.stringify({S,H0,r,Hw,unitToM:S*r,"
                "mmPerCssPx:1500*Hw/1080,dashDist:DashboardStore.dashboardDistance});})()")
FAKEGLASSD = os.path.join(lgs.ROOT, "native", "spike", "fakeglassd")


class FileLock:
    """flock with a timeout (the lab's lock files; order native -> lab -> lab-vr)."""

    def __init__(self, path, timeout):
        self.path, self.timeout, self.f = path, timeout, None

    def __enter__(self):
        import fcntl
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        self.f = open(self.path, "a")
        end = time.time() + self.timeout
        while True:
            try:
                fcntl.flock(self.f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return self
            except OSError:
                if time.time() > end:
                    self.f.close()
                    raise TimeoutError(f"lock busy: {self.path}")
                time.sleep(0.5)

    def __exit__(self, *exc):
        import fcntl
        fcntl.flock(self.f, fcntl.LOCK_UN)
        self.f.close()


def _wait(pred, timeout, step=0.25):
    end = time.time() + timeout
    while True:
        v = pred()
        if v or time.time() > end:
            return v
        time.sleep(step)


def _vr_js(page, expr, timeout=10):
    for t in lgs_vr.targets():
        if t.get("title") == page:
            return asyncio.run(eval_once(t["webSocketDebuggerUrl"], expr, timeout))
    raise RuntimeError(f"no SteamVR page {page!r}")


def _steam_js(expr, timeout=10):
    return lgs.run_js("SharedJSContext", expr, timeout)


def _close(a, b, tol):
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return False


def _journal(since):
    r = subprocess.run(["journalctl", "--user", "-u", UNIT, "--no-pager", "-o", "cat", "--since", since],
                       capture_output=True, text=True, env=user_env())
    return r.stdout.splitlines()


TEST_REPORT = "/tmp/lgs/p8-test-report.json"
TEST_DUMP = "/tmp/lgs/p8-dump"
MAIN_NATIVE_JS = ("(() => { try { for (const p of g_PopupManager.m_mapPopups.values()) if (/^VR_uid/.test(p.m_strName)) "
                  "return p.window.document.documentElement.classList.contains('lgs-native'); } catch (e) {} return null; })()")


def _main_native():
    try:
        return _steam_js(MAIN_NATIVE_JS, 5)
    except Exception:  # noqa: BLE001
        return None


def _bindings():
    """typeof the daemon's binding globals in SharedJSContext."""
    try:
        return json.loads(_steam_js(f"JSON.stringify({{{BINDING}: typeof window.{BINDING}, "
                                    f"{ACTION_BINDING}: typeof window.{ACTION_BINDING}}})", 5))
    except Exception as e:  # noqa: BLE001
        return {"error": repr(e)}


def _alive(pid):
    try:
        os.kill(int(pid), 0)
        return True
    except (OSError, TypeError, ValueError):
        return False


def _sg_items():
    try:
        r = _vr_js("systemui", "window.__LGS_SG ? JSON.stringify((s => ({items: s.items, expired: s.expired}))"
                               "(__LGS_SG.status())) : null", 5)
        return json.loads(r) if r else None
    except Exception:  # noqa: BLE001
        return None


def _main_size():
    try:
        r = _steam_js(MAIN_SIZE_JS, 5)
        if isinstance(r, list) and len(r) == 2:
            return r
    except Exception:  # noqa: BLE001
        pass
    return [1920, 1080]


def _native_start(report, caps=None, gargs=None):
    write_json_atomic(TEST_REPORT, report)
    print("start native:", start(glassd=FAKEGLASSD, stay=True, glassd_args=gargs or [], native="on",
                                 test_report=TEST_REPORT, assume_caps=caps), flush=True)
    st = _wait(lambda: (lambda s: s if s.get("mode") == "native" else None)(status()), 45, 0.5)
    return st or status()


def _report_window(W, H, layers=True):
    return {"seq": 1, "dash": True, "surfaces": [
        {"name": "main", "overlayKey": STEAM_MAIN_KEY, "visible": True, "texW": W, "texH": H, "radius": 81,
         "material": "window", "shapes": [{"x": 0, "y": 0, "w": W, "h": round(H * 656 / 720), "r": 81}],
         "layers": [{"id": "p8-cap", "x": round(W * 0.42), "y": round(H * 0.05), "w": 300, "h": 90, "r": 45,
                     "dz": 0.0271, "material": "liquid"}] if layers else []}]}


def _journal_times(lines, needle):
    out = []
    for x in lines:
        if needle in x:
            try:
                h, m, s = x[:8].split(":")
                out.append(int(h) * 3600 + int(m) * 60 + int(s))
            except ValueError:
                pass
    return out


def _selftest_dm1(check, args):
    """NAT regressions with fakeglassd: freeze (SIGSTOP 15 s), teardown order,
    restart backoff and give-up."""
    import signal as sg
    W, H = _main_size()
    st = _native_start(_report_window(W, H))
    check("native mode with fakeglassd", st.get("mode") == "native", st.get("mode"))
    check("lgs-native on main", _wait(lambda: _main_native() is True, 20, 0.5))
    s0 = _sg_items()
    check("scene graph built", bool(s0 and s0.get("items")), s0)
    # (a) freeze
    pid = status().get("pid")
    t_off = t_nodes = None
    os.kill(pid, sg.SIGSTOP)
    t0 = time.time()
    try:
        while time.time() - t0 < 15:
            if t_off is None and _main_native() is False:
                t_off = round(time.time() - t0, 1)
            if t_nodes is None:
                s = _sg_items()
                if s is None or not s.get("items") or s.get("expired"):
                    t_nodes = round(time.time() - t0, 1)
            time.sleep(0.25)
    finally:
        os.kill(pid, sg.SIGCONT)
    t1 = time.time()
    t_nb = t_sb = None
    while time.time() - t1 < 15 and (t_nb is None or t_sb is None):
        si = _sg_items() or {}
        if t_sb is None and (si.get("items") or 0) > 0 and si.get("expired") is False:   # rebuilt, not just kept
            t_sb = round(time.time() - t1, 1)
        if t_nb is None and _main_native() is True:
            t_nb = round(time.time() - t1, 1)
        time.sleep(0.1)
    back = t_nb is not None and t_sb is not None
    t_back = max(t_nb, t_sb) if back else None
    print(f"NOTE after SIGCONT: nodes back {t_sb} s, lgs-native back {t_nb} s", flush=True)
    check("freeze: lgs-native off within 4.5 s", t_off is not None and t_off <= 4.5, t_off)
    check("freeze: nodes off between 11 and 14 s", t_nodes is not None and 11 <= t_nodes <= 14, t_nodes)
    check("freeze: both back within 3 s of SIGCONT", bool(back) and t_back <= 3, t_back)
    check("freeze: lgs-native back within 1.5 s of SIGCONT (NAT: about 1 s)", t_nb is not None and t_nb <= 1.5, t_nb)
    # (b) teardown order
    since = time.strftime("%Y-%m-%d %H:%M:%S")
    time.sleep(1)
    print("stop:", stop(), flush=True)
    lines = _journal(since)
    marks = ["stopping:", "teardown: action plugins stopped", "teardown: scene graph", "teardown: lgs-native",
             "glassd: stopped", "lgs-shell exited"]
    pos = [next((i for i, x in enumerate(lines) if m in x), -1) for m in marks]
    check("teardown order: plugins, scene graph, lgs-native + reporter, glassd, exit",
          all(p >= 0 for p in pos) and pos == sorted(pos), list(zip(marks, pos)))
    check("after stop: no lgs-native, no scene graph, no glassd files",
          _main_native() is False and not (_sg_items() or {}).get("items")
          and not os.path.exists(GLASSD_JSON) and not os.path.exists(GLASSD_OUT),
          f"{_main_native()} {_sg_items()} {os.path.exists(GLASSD_JSON)}")
    gl = _bindings()
    check("after stop: no lgsLayers / lgsAction global in Steam (G-REMOVE)", gl == {"lgsLayers": "undefined",
                                                                                  "lgsAction": "undefined"}, gl)
    # (c) restart backoff and give-up (5 crashes in 120 s)
    st = _native_start(_report_window(W, H))
    check("native again", st.get("mode") == "native", st.get("mode"))
    since = time.strftime("%Y-%m-%d %H:%M:%S")
    time.sleep(1)
    for i in range(5):
        g = (status().get("glassd") or {})
        gp = g.get("pid")
        if not g.get("running") or not gp:
            gone = _wait(lambda: (status().get("glassd") or {}).get("running"), 40, 0.5)
            gp = (status().get("glassd") or {}).get("pid")
            if not gone:
                break
        try:
            os.kill(gp, sg.SIGKILL)
        except OSError:
            pass
        if i < 4:
            _wait(lambda: (lambda g2: g2.get("running") and g2.get("pid") != gp)(status().get("glassd") or {}), 40, 0.5)
    gave_up = _wait(lambda: (status().get("mode") or "").startswith("css-only (glassd gave up"), 30, 0.5)
    lines = _journal(since)
    ex = _journal_times(lines, "glassd: exited with")
    stt = _journal_times(lines, "glassd: started pid")
    delays = [b - a for a, b in zip(ex, stt[1:] if stt and stt[0] < (ex[0] if ex else 0) else stt)][:4]
    check("restart backoff 2, 4, 8, 16 s (±1.5)", len(delays) == 4 and all(abs(d - w) <= 1.5 for d, w in
                                                                       zip(delays, (2, 4, 8, 16))), delays)
    check("gives up after 5 crashes in 120 s: CSS only", bool(gave_up), status().get("mode"))
    check("after give-up: lgs-native off, nodes gone, glassd files gone",
          _wait(lambda: _main_native() is False and not (_sg_items() or {}).get("items")
                and not os.path.exists(GLASSD_JSON), 10, 0.5),
          f"{_main_native()} {_sg_items()} {os.path.exists(GLASSD_JSON)}")


def _selftest_dm2(check, args):
    """glassd.json v3: plates, holes, tints, masks, coverDz, unitM, materialize
    and fades, with fakeglassd (and --assume-caps when its caps lack them)."""
    W, H = _main_size()
    rep = {"seq": 1, "v": 3, "dash": True, "profile": "default", "roomDim": 0.3,
           "masks": [{"O": [-0.6, 1.4, -1.2], "U": [0.2, 0, 0], "V": [0, -0.5, 0]}],
           "surfaces": [{
               "name": "main", "overlayKey": STEAM_MAIN_KEY, "visible": True, "texW": W, "texH": H, "radius": 81,
               "material": "window", "mode": "windowless", "shapes": [], "coverDz": 0.001,
               "masks": [{"x": -300, "y": 0, "w": 200, "h": H, "dz": 0.03}],
               "plates": [{"id": "p8-disc", "x": 300, "y": 200, "w": 180, "h": 180, "r": 90, "material": "liquid"},
                          {"id": "p8-card", "x": 600, "y": 420, "w": 600, "h": 300, "r": 54, "material": "thick",
                           "fill": "rgba(0, 0, 0, 0.14)"},
                          {"id": "p8-dim", "x": 1300, "y": 200, "w": 300, "h": 200, "r": 40, "material": "dim"}],
               "layers": [{"id": "p8-play", "x": 320, "y": 820, "w": 420, "h": 120, "r": 60, "dz": 0.0407,
                           "material": "liquid", "tint": "rgb(48 199 89 / 0.55)", "hole": {"fill": "rgb(18 20 26 / 0.9)"}},
                          {"id": "p8-info", "x": 780, "y": 830, "w": 100, "h": 100, "r": 50, "dz": 0.0271,
                           "material": "none", "hole": True, "tint": [0.1, 0.45, 1.0, 0.5]},
                          {"id": "p8-roomdim", "x": 1700, "y": 900, "w": 64, "h": 64, "r": 0, "dz": -0.05,
                           "material": "dim", "fill": [0, 0, 0, 0.4]}]},
               # the keyboard surface (K-G6 platter behind the keys; K-G2 scale), hidden: glassd.json only
               {"name": "keyboard", "overlayKey": "valve.steam.gamepadui.keyboard", "visible": False,
                "texW": 1500, "texH": 540, "radius": 48, "material": "panel",
                "shapes": [{"x": 0, "y": 0, "w": 1500, "h": 540, "r": 48}], "coverDz": -0.027, "scaleFrom": "overlay",
                "layers": []}]}
    caps = ["plates", "holes", "tint", "masks", "coverDz", "none", "offset", "unitM", "dim", "scaleFrom", "roomDim",
            "dimSlab"]
    os.makedirs(TEST_DUMP, exist_ok=True)       # fakeglassd writes into it, it does not create it
    st = _native_start(rep, caps=caps, gargs=["--dump", TEST_DUMP])
    check("native mode with fakeglassd", st.get("mode") == "native", st.get("mode"))
    out = read_json(GLASSD_OUT) or {}
    print(f"NOTE glassd-out: version {out.get('version')} caps {out.get('caps')} "
          f"(assumed for the writer: {caps})", flush=True)
    g = _wait(lambda: (lambda d: d if d and any(s.get("plates") for s in d.get("surfaces", [])) else None)(
        read_json(GLASSD_JSON)), 10, 0.25) or {}
    m = next((s for s in g.get("surfaces", []) if s.get("name") == "main"), {})
    check("plates carried, in order", [p.get("id") for p in m.get("plates") or []] == ["p8-disc", "p8-card", "p8-dim"],
          m.get("plates"))
    check("new plates and slabs materialize", all(x.get("appear") == "materialize"
                                                  for x in (m.get("plates") or []) + (m.get("slabs") or [])))
    sl = {s.get("id"): s for s in m.get("slabs") or []}
    check("slab tint (CSS string) and hole fill carried",
          (sl.get("p8-play") or {}).get("tint") == "rgb(48 199 89 / 0.55)"
          and ((sl.get("p8-play") or {}).get("hole") or {}).get("fill") == "rgb(18 20 26 / 0.9)", sl.get("p8-play"))
    check("material none slab with hole: true and a colour list tint",
          (sl.get("p8-info") or {}).get("material") == "none" and (sl.get("p8-info") or {}).get("hole") is True
          and (sl.get("p8-info") or {}).get("tint") == [0.1, 0.45, 1, 0.5], sl.get("p8-info"))
    check("surface masks and coverDz", m.get("masks") == [{"x": -300, "y": 0, "w": 200, "h": H, "dz": 0.03}]
          and m.get("coverDz") == 0.001, (m.get("masks"), m.get("coverDz")))
    check("top-level world masks, unitM = live geometry, reduceMotion, roomDim",
          g.get("masks") == [{"O": [-0.6, 1.4, -1.2], "U": [0.2, 0, 0], "V": [0, -0.5, 0]}]
          and g.get("unitM") == (status().get("geom") or {}).get("unitM") and g.get("reduceMotion") is False
          and g.get("roomDim") == 0.3, {k: g.get(k) for k in ("masks", "unitM", "reduceMotion", "roomDim")})
    check("dim slab (room-dim cell) with its fill", (sl.get("p8-roomdim") or {}).get("material") == "dim"
          and (sl.get("p8-roomdim") or {}).get("fill") == [0, 0, 0, 0.4], sl.get("p8-roomdim"))
    kb = next((s for s in g.get("surfaces", []) if s.get("name") == "keyboard"), {})
    check("keyboard surface: coverDz -0.027, scaleFrom overlay, cover shape, hidden",
          kb.get("coverDz") == -0.027 and kb.get("scaleFrom") == "overlay" and kb.get("visible") is False
          and len(kb.get("shapes") or []) == 1, kb)
    out = read_json(GLASSD_OUT) or {}
    om = (out.get("surfaces") or {}).get("main") or {}
    check("fakeglassd drew the plates (glassd-out plates)", om.get("plates") == ["p8-disc", "p8-card", "p8-dim"]
          and (om.get("counts") or {}).get("holes") == 2, {k: om.get(k) for k in ("plates", "counts")})
    sp = _wait(lambda: (lambda s: s if s and s.get("items") else None)(_sg_items()), 10, 0.5)
    check("scene graph built from the v3 spec", bool(sp), sp)
    import shutil
    try:      # the first scene's textures (procedural: fakeglassd paints no camera image)
        for fn in os.listdir(TEST_DUMP):
            if fn.endswith(".png") and not fn.startswith("first-"):
                shutil.copy(os.path.join(TEST_DUMP, fn), os.path.join(TEST_DUMP, "first-" + fn))
    except OSError:
        pass
    # fades: the disc plate and the play slab leave
    time.sleep(1.0)
    rep2 = json.loads(json.dumps(rep))
    rep2["seq"] = 2
    s2 = rep2["surfaces"][0]
    s2["plates"] = [p for p in s2["plates"] if p["id"] != "p8-disc"]
    s2["layers"] = [x for x in s2["layers"] if x["id"] != "p8-play"]
    t0 = time.time()
    write_json_atomic(TEST_REPORT, rep2)

    def item(d, kind, iid):
        mm = next((s for s in (d or {}).get("surfaces", []) if s.get("name") == "main"), {})
        return next((x for x in mm.get(kind) or [] if x.get("id") == iid), None)
    faded = _wait(lambda: (lambda d: d if (item(d, "plates", "p8-disc") or {}).get("phase") == 0
                           and (item(d, "slabs", "p8-play") or {}).get("phase") == 0 else None)(read_json(GLASSD_JSON)),
                  6, 0.02)      # the test report is re-read on the 1 s Steam tick; a busy Steam slows it
    t_faded = time.time()
    check("leaving plate and slab written with phase 0", bool(faded),
          f"{round(t_faded - t0, 2)} s after the report changed (--test-report is re-read once a second)"
          if faded else str(read_json(GLASSD_JSON))[:300])
    gone = _wait(lambda: (lambda d: d if item(d, "plates", "p8-disc") is None and item(d, "slabs", "p8-play") is None
                          and item(d, "plates", "p8-card") else None)(read_json(GLASSD_JSON)), 4, 0.02)
    t_gone = round(time.time() - t_faded, 2)
    check("then removed after the 350 ms out-ramp (≤ 0.35 + 0.3 s)", bool(gone) and 0.3 <= t_gone <= 0.65, t_gone)
    try:
        pngs = sorted(os.listdir(TEST_DUMP))
    except OSError:
        pngs = []
    print(f"NOTE fakeglassd dumps (procedural, no camera): {pngs}"
          + ("" if "--keep-dump" in args else " (deleted after the test; --keep-dump keeps them)"), flush=True)
    check("fakeglassd --dump wrote textures", bool(pngs), pngs)



FM_DUMP_JS = ("(async()=>{const d=await OverlayStore.DumpLaserOverlays();const o=d.overlays||{};"
              "const k=Object.keys(o).find(n=>/frame\\.menu/.test(n));const p=k&&o[k].scene_graph_panel;"
              "return JSON.stringify(p?{fWidth:p.fWidth,fHeight:p.fHeight}:null)})()")


def _selftest_dm3(check, args):
    """Geometry against the SP §1.2 snippet, and the frame menu's panel against
    a DumpLaserOverlays of our own: atomic (review R1 m3), i.e. the daemon's own
    dump came after ours and the panel did not change between our two dumps."""
    st = status()
    g = st.get("geom") or {}
    ref = json.loads(_vr_js("systemui", SP12_SNIPPET))
    for k, rk, tol in (("S", "S", 6e-5), ("H0", "H0", 6e-5), ("r", "r", 6e-5), ("Hm", "Hw", 6e-5),
                       ("unitM", "unitToM", 6e-5), ("mmPerCssPx", "mmPerCssPx", 6e-5), ("dashDist", "dashDist", 6e-4)):
        check(f"geom.{k} = snippet {rk}", _close(g.get(k), ref.get(rk), tol), f"{g.get(k)} vs {ref.get(rk)}")
    got = None
    for attempt in range(3):
        d0 = json.loads(_vr_js("systemui", FM_DUMP_JS, 15))
        t0 = time.time()
        s1 = _wait(lambda: (lambda x: x if (x.get("geomDumpAt") or 0) > t0 else None)(status()), GEOM_DUMP_S + 6, 0.5)
        d1 = json.loads(_vr_js("systemui", FM_DUMP_JS, 15))
        if s1 and d0 == d1:
            got = (s1, d1, round(s1["geomDumpAt"] - t0, 1), attempt + 1)
            break
        print(f"NOTE frame menu panel changed during the step ({d0} -> {d1}) or no daemon dump ({bool(s1)}); again",
              flush=True)
    if got is None:
        check("frame menu stable over one daemon dump (3 tries)", False, "panel kept changing or no daemon dump")
    elif got[1] is None:
        check("frame menu present in DumpLaserOverlays", False, "no frame menu panel")
    else:
        s1, dump, lag, tries = got
        fm = (s1.get("geom") or {}).get("frameMenu") or {}
        print(f"NOTE daemon dump {lag} s after ours (try {tries}); our dumps before and after it equal", flush=True)
        check("frameMenu.fHeight = DumpLaserOverlays (same step)", _close(fm.get("fHeight"), dump.get("fHeight"), 6e-5),
              f"{fm.get('fHeight')} vs {dump.get('fHeight')}")
        check("frameMenu.fWidth = DumpLaserOverlays (same step)", _close(fm.get("fWidth"), dump.get("fWidth"), 6e-5),
              f"{fm.get('fWidth')} vs {dump.get('fWidth')}")
        check("frameMenu.clipCssH = fHeight / mpp / 1.5",
              _close(fm.get("clipCssH"), float(dump["fHeight"]) / float(fm.get("mpp") or 1) / 1.5, 0.11),
              f"{fm.get('clipCssH')} mpMm {fm.get('mpMm')}")
        st = s1
    steam = json.loads(_vr_js("systemui", "JSON.stringify((()=>{const sf=FrameStore.frames.find(x=>x.m_mapPages&&"
                                          "[...x.m_mapPages.values()].some(p=>p.m_sSummonOverlayKey==="
                                          "'valve.steam.gamepadui.main'));return sf&&sf.activePage&&"
                                          "sf.activePage.m_sSummonOverlayKey})())"))
    page = st.get("page") or {}
    check("page.summonKey = FrameStore", page.get("summonKey") == steam, f"{page.get('summonKey')} vs {steam}")
    check("page.steam", page.get("steam") == (steam == STEAM_MAIN_KEY))
    g = st.get("geom") or {}
    rt = _steam_js("(() => { const R = window.__LGS_RT, b = R && R.bridge; if (!b || !b.get) return null;"
                   " return JSON.stringify({geom: b.get('geom'), page: b.get('page'), daemon: b.get('daemon')}); })()")
    if rt is None:
        print("NOTE bridge: no __LGS_RT.bridge in Steam (runtime off); bridge delivery not checked", flush=True)
    else:
        b = json.loads(rt)
        check("bridge geom = published geom", (b.get("geom") or {}).get("r") == g.get("r")
              and (b.get("geom") or {}).get("S") == g.get("S")
              and ((b.get("geom") or {}).get("frameMenu") or {}).get("fWidth") == (g.get("frameMenu") or {}).get("fWidth"),
              str(b.get("geom"))[:160])
        check("bridge page = published page", (b.get("page") or {}).get("summonKey") == page.get("summonKey"))
        d = b.get("daemon") or {}
        check("bridge daemon heartbeat fresh", d and time.time() * 1000 - d.get("at", 0) < d.get("ttlMs", 0),
              str(d)[:160])


P8_FIX_JS = r"""
(function (on) {
  for (const p of g_PopupManager.m_mapPopups.values()) {
    if (!/^VR_uid/.test(p.m_strName)) continue;
    const d = p.window.document;
    let f = d.getElementById('lgs-p8-fix');
    if (f) f.remove();
    if (!on) return 'removed';
    f = d.createElement('div');
    f.id = 'lgs-p8-fix';
    f.setAttribute('data-lgs-plate', 'liquid');
    f.setAttribute('data-lgs-plate-id', 'p8-live');
    f.style.cssText = 'position:fixed;left:220px;top:180px;width:160px;height:160px;border-radius:80px;' +
      'pointer-events:none;z-index:2147483647;background:rgba(255,255,255,0.08)';
    d.body.appendChild(f);
    return 'added';
  }
  return 'no main window';
})
"""
P8_FIX_STATE_JS = ("(() => { for (const p of g_PopupManager.m_mapPopups.values()) if (/^VR_uid/.test(p.m_strName)) {"
                   " const f = p.window.document.getElementById('lgs-p8-fix'); return JSON.stringify({fix: !!f,"
                   " ack: !!(f && f.hasAttribute('data-lgs-plate-ack'))}); } return null; })()")


def _selftest_plates(check, args):
    """The real reporter (P6 v3) with fakeglassd: options passed, a plate from a
    fixture element goes to glassd.json, is acked (data-lgs-plate-ack), fades
    out when the element goes; motion.js is prepended to lgs_sg.js."""
    print("start native (reporter, fakeglassd):",
          start(glassd=FAKEGLASSD, stay=True, glassd_args=[], native="on"), flush=True)
    st = _wait(lambda: (lambda s: s if s.get("mode") == "native" and (s.get("steam") or {}).get("reports") else None)(
        status()), 45, 0.5) or status()
    check("native with the real reporter reporting", st.get("mode") == "native"
          and (st.get("steam") or {}).get("source") == "reporter", (st.get("mode"), (st.get("steam") or {}).get("reporter")))
    # the reporter deletes __LGS_LAYERS_OPTS once read: its status() shows what it got
    ro = _steam_js("(() => { const L = window.__LGS_LAYERS, s = L && L.status ? L.status() : {};"
                   " return JSON.stringify({v: s.v, fragments: s.fragments, profile: s.profile, geom: s.geom,"
                   " ackMode: s.ackMode}); })()")
    ro = json.loads(ro) if ro else {}
    frags = sorted(os.path.basename(f) for f in json_files(LAYERS_DIR))
    got = ro.get("fragments") or []          # a fragment whose flag is off may be left out
    check("reporter v3 got theme/layers fragments, profile, geom (= ours) and ackMode", (ro.get("v") or 0) >= 3
          and got and set(got) <= set(frags) and frags[0] in got and ro.get("profile") in ("default", "wearer")
          and (ro.get("geom") or {}).get("src") in ("opts", "bridge")      # both are ours; P6 prefers the live bridge
          and _close((ro.get("geom") or {}).get("S"), (status().get("geom") or {}).get("S"), 1e-4)
          and ro.get("ackMode") is True, (ro, frags))
    mot = _vr_js("systemui", "typeof globalThis.__LGS_MOTION")
    check("motion.js prepended to lgs_sg.js (__LGS_MOTION in vr:systemui)", mot == "object", mot)
    try:
        check("plate fixture added to the main window", _steam_js(f"({P8_FIX_JS})(true)") == "added")

        def plate(d):
            m = next((s for s in (d or {}).get("surfaces", []) if s.get("name") == "main"), {})
            return next((p for p in m.get("plates") or [] if p.get("id") == "p8-live"), None)
        t0 = time.time()
        p = _wait(lambda: plate(read_json(GLASSD_JSON)), 6, 0.1)
        check("its plate reaches glassd.json (materialize)", p and p.get("appear") == "materialize"
              and p.get("w", 0) > 200, p)
        drawn = _wait(lambda: "p8-live" in (((read_json(GLASSD_OUT) or {}).get("surfaces") or {}).get("main") or {})
                      .get("plates", []), 5, 0.1)
        check("fakeglassd draws it (glassd-out plates)", bool(drawn))
        ack = _wait(lambda: (json.loads(_steam_js(P8_FIX_STATE_JS) or "{}") or {}).get("ack"), 6, 0.2)
        t_ack = round(time.time() - t0, 2)
        check("plate acked: data-lgs-plate-ack on the element (after its 250 ms ramp + 350 ms)", bool(ack)
              and t_ack >= 0.6, t_ack)
        pa = _wait(lambda: (lambda m: m if any("p8-live" in v for v in m.values()) else None)(
            (status().get("steam") or {}).get("plateAcks") or {}), 5, 0.5)
        check("status lists the plate ack", bool(pa), pa)
        _steam_js(f"({P8_FIX_JS})(false)")
        faded = _wait(lambda: (plate(read_json(GLASSD_JSON)) or {}).get("phase") == 0, 4, 0.05)
        check("element removed: its plate fades (phase 0)", bool(faded))
        gone = _wait(lambda: plate(read_json(GLASSD_JSON)) is None, 3, 0.05)
        check("then leaves glassd.json", bool(gone))
    finally:
        _steam_js(f"({P8_FIX_JS})(false)")


def selftest(args):
    """Lab checks against the running unit. Prints PASS/FAIL lines and a JSON
    summary; exit 0 when every check passed."""
    name = args[0] if args else ""
    results = []

    def check(n, ok, info=""):
        results.append({"check": n, "pass": bool(ok), "info": info if not ok or info else ""})
        print(("PASS " if ok else "FAIL ") + n + (f"  [{info}]" if info != "" else ""), flush=True)

    if name == "actions":
        import shutil
        import tempfile
        tmp = tempfile.mkdtemp(prefix="lgs-p8-", dir="/tmp/lgs" if os.path.isdir("/tmp/lgs") else None)
        try:
            p, f, res = shell_ext.selftest(tmp)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        for n, ok, info in res:
            check(n, ok, "" if ok else info)
    elif name == "dm6":
        nat, src, reason = resolve_native("auto")
        check("auto resolves to CSS only without a gate pass", (not nat) if src == "builtin" else True,
              f"{nat} {src} {reason}")
        if "--live" in args:
            with FileLock("/tmp/lgs/native.lock", 1800), FileLock("/tmp/lgs/lab.lock", 600),                     FileLock("/tmp/lgs/lab-vr.lock", 240):
                print("stop:", stop(), flush=True)
                print("start(auto):", start(native="auto"), flush=True)
                st = _wait(lambda: (status() if status().get("unit") == "active" and
                                    (status().get("mode") or "").startswith("css-only") else None), 20)
                st = st or status()
                nat_st = st.get("native") or {}
                check("status.mode css-only with the reason", (st.get("mode") or "").startswith("css-only (native=auto")
                      and nat_st.get("requested") == "auto", f"{st.get('mode')} / {nat_st}")
                check("a running unit is kept by start(auto)", start(native="auto").startswith("running"))
    elif name == "dm3":
        with FileLock("/tmp/lgs/lab-vr.lock", 240):     # it reads systemui and runs DumpLaserOverlays there
            _selftest_dm3(check, args)
    elif name == "dm4":
        if _steam_js("typeof window.lgsAction") != "function":
            check("lgsAction binding present", False, "typeof window.lgsAction != function")
        else:
            n = os.urandom(3).hex()

            def call(cid, obj):
                return _steam_js(f"(window.lgsAction(JSON.stringify({json.dumps(dict(obj, id=cid))})), 0)")
            call(f"t-echo-{n}", {"type": "echo", "args": {"text": "hi"}, "src": "main"})
            time.sleep(0.3)
            call(f"t-unknown-{n}", {"type": "nope.nope", "args": {}, "src": "main"})
            call(f"t-src-{n}", {"type": "echo.main", "args": {}, "src": "bar"})
            call(f"t-args-{n}", {"type": "echo", "args": {"text": "x" * 300}, "src": "main"})
            time.sleep(0.3)
            _steam_js(f"(window.lgsAction(JSON.stringify({json.dumps({'id': 't-rate1-' + n, 'type': 'echo', 'args': {}, 'src': 'main'})})),"
                      f" window.lgsAction(JSON.stringify({json.dumps({'id': 't-rate2-' + n, 'type': 'echo', 'args': {}, 'src': 'main'})})), 0)")
            time.sleep(2.6)
            st = status()
            reps = {r.get("id"): r for r in (st.get("actions") or {}).get("replies") or []}
            rej = {r.get("id"): r for r in (st.get("actions") or {}).get("rejected") or []}
            exp = {f"t-echo-{n}": None, f"t-unknown-{n}": "unknown-type", f"t-src-{n}": "bad-source",
                   f"t-args-{n}": "bad-args", f"t-rate1-{n}": None, f"t-rate2-{n}": "rate"}
            for cid, err in exp.items():
                r = reps.get(cid) or {}
                if err is None:
                    check(f"{cid.rsplit('-', 1)[0]} answered ok", r.get("ok") is True, str(r))
                else:
                    check(f"{cid.rsplit('-', 1)[0]} rejected {err} and logged",
                          r.get("ok") is False and r.get("error") == err and (rej.get(cid) or {}).get("error") == err,
                          f"{r} / {rej.get(cid)}")
            last = _steam_js("(() => { const R = window.__LGS_RT, b = R && R.bridge; return b && b.get ?"
                             " JSON.stringify(b.get('reply')) : null; })()")
            if last is None:
                print("NOTE bridge: no __LGS_RT.bridge in Steam (runtime off); replies checked in shell.json only",
                      flush=True)
            else:
                lr = json.loads(last) or {}
                check("bridge carries the last reply", lr.get("id") == f"t-rate2-{n}" and lr.get("error") == "rate",
                      str(lr)[:160])
            lines = [x for x in _journal("-2min") if n in x]
            check("every call logged in the journal", len(lines) >= 6, f"{len(lines)} lines")
    elif name == "dm5":
        with FileLock("/tmp/lgs/lab-vr.lock", 240):
            os.makedirs(os.path.dirname(TEST_SCRIPT), exist_ok=True)
            try:
                with open(TEST_SCRIPT, "w", encoding="utf-8") as f:
                    f.write(TEST_SCRIPT_JS)
                ver = hashlib.sha1(TEST_SCRIPT_JS.encode()).hexdigest()[:10]
                probe = ("JSON.stringify({vrx: !!(window.__LGS_VRX && window.__LGS_VRX.p8echo), "
                         "attr: document.documentElement.dataset.lgsEcho || null})")
                got = _wait(lambda: (lambda d: d if d["vrx"] else None)(json.loads(_vr_js("systemui", probe))), 8)
                check("injected into vr:systemui", got and got.get("attr") == ver, str(got))
                st = _wait(lambda: (lambda s: s if s.get("p8echo") in ("installed", "ok") else None)(
                    (status().get("vrScripts") or {}).get("systemui") or {}), 5) or {}
                check("status lists it", st.get("p8echo") in ("installed", "ok"), str(st))
                others = [t.get("title") for t in lgs_vr.targets() if t.get("title") != "systemui"]
                leak = [p for p in others if _vr_js(p, "!!(window.__LGS_VRX && window.__LGS_VRX.p8echo)")]
                check("only in matching pages", not leak, str(leak))
                os.remove(TEST_SCRIPT)
                gone = _wait(lambda: (lambda d: d if not d["vrx"] and not d["attr"] else None)(
                    json.loads(_vr_js("systemui", probe))), 8)
                check("removed when its file goes", bool(gone), str(gone))
                if "--stop" in args:
                    with FileLock("/tmp/lgs/native.lock", 1800):
                        with open(TEST_SCRIPT, "w", encoding="utf-8") as f:
                            f.write(TEST_SCRIPT_JS)
                        got = _wait(lambda: (lambda d: d if d["vrx"] else None)(json.loads(_vr_js("systemui", probe))), 8)
                        check("re-injected", bool(got), str(got))
                        print("stop:", stop(), flush=True)
                        after = json.loads(_vr_js("systemui", probe))
                        check("removed on daemon stop", not after["vrx"] and not after["attr"], str(after))
                        os.remove(TEST_SCRIPT)
                        print("start:", start(native="auto"), flush=True)
            finally:
                try:
                    os.remove(TEST_SCRIPT)
                except OSError:
                    pass
    elif name == "grace":
        # theme off without `lgs off` (lab --stock, P1's selftests): dormant, not gone
        with FileLock("/tmp/lgs/lab.lock", 600), FileLock("/tmp/lgs/lab-vr.lock", 240):
            st0 = status()
            pid0 = st0.get("pid")
            check("unit active before", st0.get("unit") == "active" and not st0.get("dormant"), st0.get("mode"))
            was_on = lgs.is_on()
            try:
                if was_on:
                    lgs.op("off", quiet=True)
                d = _wait(lambda: (lambda s: s if s.get("dormant") else None)(status()), 12, 0.5) or {}
                check("theme off: dormant, same pid", d.get("pid") == pid0 and (d.get("dormant") or {}).get("graceS"),
                      f"{d.get('pid')} vs {pid0} {d.get('dormant')}")
                time.sleep(3)
                s2 = status()
                check("still running 8 s after the theme went off", s2.get("unit") == "active" and s2.get("pid") == pid0,
                      f"{s2.get('unit')} {s2.get('pid')}")
                check("dormant: no scene graph in systemui", not (_sg_items() or {}).get("items"), _sg_items())
            finally:
                if was_on:
                    lgs.op("on", quiet=True)
            r = _wait(lambda: (lambda s: s if s.get("unit") == "active" and not s.get("dormant") else None)(status()),
                      10, 0.5) or {}
            check("theme back: resumed (not dormant, same pid)", r.get("pid") == pid0, f"{r.get('pid')} {r.get('dormant')}")
            back = _wait(lambda: _steam_js("typeof window.lgsAction") == "function", 5)
            check("action binding present after resume", bool(back))
            rt = _wait(lambda: _steam_js("(() => { const R = window.__LGS_RT, b = R && R.bridge; const d = b && b.get && "
                                         "b.get('daemon'); return d ? Date.now() - d.at < d.ttlMs : null; })()") is True, 8)
            if _steam_js("!!(window.__LGS_RT && window.__LGS_RT.bridge)"):
                check("bridge daemon heartbeat fresh after resume", bool(rt))
            pages = (status().get("steamvrPages") or {}).get("pages") or {}
            check("SteamVR pages themed", pages and all(v in ("ok", "applied") for v in pages.values()), pages)
    elif name in ("dm1", "dm2", "plates"):
        if not os.access(FAKEGLASSD, os.X_OK):
            print(f"BLOCKED: no fakeglassd at {FAKEGLASSD} (python glass.py native-build fake)")
            return 3
        # native.lock for the native session; lab-vr.lock too, since systemui's
        # scene graph changes (and is frozen) under other agents' vr: steps
        import contextlib
        # plates edits the Steam main window (a fixture): lab.lock as well
        with FileLock("/tmp/lgs/native.lock", 1800),                 (FileLock("/tmp/lgs/lab.lock", 600) if name == "plates" else contextlib.nullcontext()),                 FileLock("/tmp/lgs/lab-vr.lock", 240):
            try:
                {"dm1": _selftest_dm1, "dm2": _selftest_dm2, "plates": _selftest_plates}[name](check, args)
            finally:
                # always back to CSS only (lgs on --css), then wait for it
                print("back to css:", start(native="off"), flush=True)
                back = _wait(lambda: (status().get("mode") or "").startswith("css-only"), 30)
                check("back to CSS only", back, status().get("mode"))
                time.sleep(2)
                left = {"reporter": _steam_js("typeof window.__LGS_LAYERS"),
                        "motion": _vr_js("systemui", "typeof globalThis.__LGS_MOTION"),
                        "sg": _vr_js("systemui", "typeof window.__LGS_SG"), "glassd.json": os.path.exists(GLASSD_JSON)}
                check("nothing native left (reporter, __LGS_MOTION, __LGS_SG, glassd.json)",
                      left["motion"] == "undefined" and left["glassd.json"] is False
                      and (left["sg"] == "undefined" or not (_sg_items() or {}).get("items")), left)
                gl = _bindings()
                check("CSS-only unit: no lgsLayers global, lgsAction present", gl.get(BINDING) == "undefined"
                      and gl.get(ACTION_BINDING) == "function", gl)
                for p in (TEST_REPORT,):
                    try:
                        os.remove(p)
                    except OSError:
                        pass
                if "--keep-dump" not in args:
                    import shutil
                    shutil.rmtree(TEST_DUMP, ignore_errors=True)
    else:
        print("selftest NAME: actions | dm1 | dm2 [--keep-dump] | dm3 | dm4 | dm5 [--stop] | dm6 [--live] | grace | plates")
        return 2
    ok = all(r["pass"] for r in results)
    print(json.dumps({"selftest": name, "passed": sum(r["pass"] for r in results), "failed":
                      sum(not r["pass"] for r in results), "at": time.strftime("%Y-%m-%d %H:%M:%S")}))
    return 0 if ok else 1


def opt_arg(argv, name):
    if name in argv and argv.index(name) + 1 < len(argv):
        return argv[argv.index(name) + 1]
    return None


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "status"
    if cmd == "daemon":
        try:
            return asyncio.run(Shell(glassd_arg(argv), stay_arg(argv), glassd_args_arg(argv),
                                     native=bool(native_arg(argv)), native_req=opt_arg(argv, "--req"),
                                     native_src=opt_arg(argv, "--src"),
                                     test_report=opt_arg(argv, "--test-report"),
                                     assume_caps=[c for c in (opt_arg(argv, "--assume-caps") or "").split(",") if c]
                                     ).run())
        except KeyboardInterrupt:
            return 0
    if cmd == "start":
        gargs = glassd_args_arg(argv)
        glassd = glassd_arg(argv)
        nat = native_arg(argv)
        # From the command line (lab and tests) the real glassd does not read
        # the camera unless asked to: --feed, or explicit --glassd-args.
        if gargs is None and "--feed" not in argv and glassd and os.path.basename(glassd) == "glassd":
            gargs = ["--no-feed"]
        print(start(glassd, stay_arg(argv), gargs, None if nat is None or "--auto" in argv else nat,
                    test_report=opt_arg(argv, "--test-report"),
                    assume_caps=[c for c in (opt_arg(argv, "--assume-caps") or "").split(",") if c]))
    elif cmd == "stop":
        print(stop())
    elif cmd == "status":
        print(json.dumps(status(), indent=1))
    elif cmd == "selftest":
        return selftest(argv[2:])
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
