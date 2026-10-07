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

Native mode is an explicit opt-in, read once when the daemon starts: a glassd
binary that appears later is never picked up, and one that disappears ends
native mode for the session. Without the opt-in (the default, and what the
"+ > Launch Program" toggle runs) the daemon is CSS only: SteamVR page theming,
no reporter in Steam, nothing in systemui, no camera.

Nothing persists: the unit is transient (systemd-run --collect), it exits when
the Steam theme goes off, and on exit it removes every node, class and file it
made. If it dies without cleaning up, lgs-native clears itself within 3 s and
the scene-graph nodes within 12 s (heartbeat watchdogs).

  lgs_shell.py start [--native] [--glassd PATH|none] [--glassd-args "ARGS"]
                     [--feed] [--stay]
                                            start the unit; lgs on does this.
                                            --native opts in to the native layer
                                            (from this command glassd gets
                                            --no-feed unless --feed or
                                            --glassd-args is given); --stay, for
                                            lab tests only, keeps it dormant
                                            instead of exiting while the theme
                                            is off. A running unit is kept,
                                            or restarted if --native differs.
  lgs_shell.py stop                         stop it (clean teardown)
  lgs_shell.py status                       unit + live daemon status (JSON)
  lgs_shell.py daemon [--native] [--glassd PATH|none] ...
                                            the unit's process (foreground)
"""
import asyncio
import collections
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
import traceback
import urllib.request

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, HERE)
import lgs  # noqa: E402
import lgs_vr  # noqa: E402

UNIT = "lgs-shell"
SHM = "/dev/shm/lgs"
GLASSD_JSON = os.path.join(SHM, "glassd.json")
GLASSD_OUT = os.path.join(SHM, "glassd-out.json")
STATUS = os.path.join(SHM, "shell.json")
SG_FLAGS = "/tmp/lgs/sg-flags.json"  # optional lgs_sg.js panel flags (wearer tests; transient)
GLASSD_BIN = os.path.join(lgs.ROOT, "native", "glassd", "glassd")
LAYERS_JS = os.path.join(HERE, "lgs_layers.js")
LAYERS_CFG = os.path.join(lgs.THEME_DIR, "layers.json")
SG_JS = os.path.join(HERE, "lgs_sg.js")
VR_PAUSE = lgs_vr.PAUSE

BINDING = "lgsLayers"
REPORTER = "__LGS_LAYERS"          # global installed by lgs_layers.js
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
THEME_OFF_POLLS = 3                # Steam theme seen off this many polls (1 s) -> exit
GLASSD_MAX_CRASHES = 5             # within GLASSD_CRASH_WINDOW s -> give up (CSS only)
GLASSD_CRASH_WINDOW = 120
GLASSD_TEMP_EXIT = 75              # EX_TEMPFAIL from glassd: SteamVR gone, lock held; not a crash
GLASSD_STALE_S = 6.0               # glassd rewrites glassd-out.json every 2 s ("updated")
GLASSD_FIRST_OUT_S = 20.0          # time for glassd's first glassd-out.json
MAIN_QUAD_W = 0.98                 # main window's nominal world width (m), NATIVE.md fact 4
MAIN_QUAD_TOL = 0.12               # glassd's quadW off by more than this: main stays CSS only
BUG_LIMIT, BUG_WINDOW = 5, 120     # unexpected exceptions in one loop before it is fatal
SPEC_LOG_MIN_S = 1.0               # "systemui: spec" log lines at most this often


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
(function (keys, ttl, acks) {
  const W = window;
  let h = W.__LGS_NATIVE;
  if (!h) {
    const ALIAS = { 'valve.steam.gamepadui.main': /^VR_uid/, 'valve.steam.gamepadui.keyboard': /^VRKeyboard_uid/,
                    'valve.steam.gamepadui.notifications': /^VRNotificationToasts_uid/ };
    const matches = (name, key) => (ALIAS[key] ? ALIAS[key].test(name) : (name.startsWith(key + '.') || name.startsWith(key + '_')));
    h = W.__LGS_NATIVE = { keys: [], acks: {}, last: 0, ttl, timer: 0, applied: [], tagged: null };
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
    h.ack = () => {
      try {
        const L = W.__LGS_LAYERS;
        if (L && typeof L.ack === 'function') h.tagged = L.ack(h.keys.length ? h.acks : {});
      } catch (_) { /* reporter restarting */ }
    };
    h.set = (ks, ac) => {
      h.keys = ks || []; h.acks = ac || {}; h.last = Date.now();
      if (!h.timer && h.keys.length) h.timer = setInterval(h.sweep, 1000);
      const r = h.sweep(); h.ack(); return r;
    };
    h.clear = () => { h.keys = []; h.acks = {}; const r = h.sweep(); h.ack(); if (h.timer) clearInterval(h.timer); delete W.__LGS_NATIVE; return r; };
  }
  h.ttl = ttl;
  const applied = h.set(keys, acks);
  return JSON.stringify({ applied, tagged: h.tagged });
})
"""

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


# ------------------------------------------------------------------ the daemon

class Shell:
    def __init__(self, glassd_path, stay=False, glassd_args=None, native=False):
        self.glassd_path = glassd_path
        self.glassd_args = list(glassd_args or [])
        self.stay = stay                      # lab aid: go dormant instead of exiting on theme off
        self.native_requested = bool(native)
        # Read once: a binary built mid-session is never picked up.
        if not self.native_requested:
            self.native_enabled, self.css_reason = False, "native layer not requested; lgs on --native opts in"
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
        # SteamVR page theming
        self.vr_version = None
        self.vr_pages = {}

    # ---------------------------------------------------------------- state
    def mode(self):
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

    def status(self):
        g = self.gout or {}
        sg = self.sg_status or {}
        b = self.sg_beat or {}
        rep = self.current_report() or {}
        return {
            "pid": os.getpid(), "since": time.strftime("%H:%M:%S", time.localtime(self.since)),
            "updated": time.time(), "mode": self.mode(),
            "native": {"requested": self.native_requested, "enabled": self.native_enabled, "reason": self.css_reason},
            "glassd": {"path": self.glassd_path, "args": self.glassd_args, "pid": self.g_pid,
                       "running": self.glassd_running(), "ready": self.glassd_ready(),
                       "healthy": g.get("healthy"), "stale": self.g_stale, "feed": g.get("feed"),
                       "restarts": self.g_restarts, "tempExits": self.g_temp_exits, "lastExit": self.g_last_exit,
                       "givenUp": self.g_given_up, "frames": self.g_frames, "seq": g.get("seq"), "fps": g.get("fps"),
                       "gpu_ms": g.get("gpu_ms"), "surfaces": sorted((g.get("surfaces") or {}).keys()),
                       "configSeq": self.gseq},
            "steam": {"connected": self.steam_ok, "themeOn": self.theme_on, "reporter": self.reporter_state,
                      "reports": self.reports, "reportSeq": (self.report or {}).get("seq"),
                      "reportAgeS": round(time.time() - self.report_at, 1) if self.report_at else None,
                      "dashboardHidden": self.dash_hidden,
                      "source": "reporter" if self.report is not None else ("fallback" if self.fallback else None),
                      "surfaces": [s.get("name") for s in rep.get("surfaces", [])],
                      "lgsNative": self.native_applied, "acked": self.acked, "tagged": self.native_tagged},
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
    def glassd_config(self):
        rep = self.current_report() or {"surfaces": []}
        surfaces = []
        for s in rep.get("surfaces", []):
            if not isinstance(s, dict) or not s.get("name") or not s.get("overlayKey"):
                continue
            slabs = []
            for L in s.get("layers") or []:
                try:
                    w, h = float(L["w"]), float(L["h"])
                except (KeyError, TypeError, ValueError):
                    continue
                if w < 2 or h < 2 or L.get("id") is None:
                    continue
                slabs.append({"id": str(L["id"]), "w": round(w), "h": round(h), "r": round(float(L.get("r") or 0)),
                              "material": L.get("material") or "liquid",
                              # informational, for glassd's slab world point:
                              "x": round(float(L.get("x") or 0)), "y": round(float(L.get("y") or 0)),
                              "dz": float(L.get("dz") or 0)})
            surf = {"name": s["name"], "overlayKey": s["overlayKey"],
                    "texW": round(float(s.get("texW") or 0)), "texH": round(float(s.get("texH") or 0)),
                    "radius": round(float(s.get("radius") or 0)), "material": material_for(s),
                    "visible": bool(s.get("visible", True)), "slabs": slabs}
            # the cover's rounded shapes (bar segments, a popup's card); glassd
            # covers the whole texture with `radius` when absent
            if isinstance(s.get("shapes"), list):
                shapes = []
                for sh in s["shapes"]:
                    try:
                        shapes.append({k: round(float(sh.get(k) or 0)) for k in ("x", "y", "w", "h", "r")})
                    except (AttributeError, TypeError, ValueError):
                        continue
                surf["shapes"] = shapes
            surfaces.append(surf)
        return {"dial": read_dial(), "surfaces": surfaces}

    def write_glassd_json(self, force=False):
        if not self.native_possible():
            return False
        cfg = self.glassd_config()
        full = json.dumps(cfg, sort_keys=True)
        struct = json.dumps({"dial": cfg["dial"], "surfaces": [
            dict(s, slabs=[{k: v for k, v in sl.items() if k not in ("x", "y", "dz")} for sl in s["slabs"]])
            for s in cfg["surfaces"]]}, sort_keys=True)
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
            for L in s.get("layers") or []:
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
        try:
            q = float(g.get("quadW"))
        except (TypeError, ValueError):
            return False
        bad = abs(q / MAIN_QUAD_W - 1) > MAIN_QUAD_TOL
        if bad != bool(self.resized_noted):
            self.resized_noted = bad
            if bad:
                self.note(f"main window is {q:.2f} m wide (nominal {MAIN_QUAD_W}): resized; main stays CSS only")
            else:
                log(f"main window back to {q:.2f} m wide: native again")
        return bad

    def build_spec(self):
        self.wake_at = None
        if not self.native_ok():
            return {"M": None, "surfaces": []}
        rep = self.current_report() or {"surfaces": []}
        gsurf = (self.gout or {}).get("surfaces") or {}
        now = time.time()
        out = []
        wake = None
        for s in rep.get("surfaces", []):
            if not isinstance(s, dict):
                continue
            g = gsurf.get(s.get("name"))
            if not g or not s.get("overlayKey") or not s.get("visible", True):
                continue
            if s.get("name") == "main" and self.main_resized(g):
                continue
            try:
                texW, texH = float(s["texW"]), float(s["texH"])
                scale = float(g.get("backdropScale") or 0.75)
                gW, gH = float(g["texW"]), float(g["texH"])
                backdrop = [float(v) for v in g["backdrop"]]
            except (KeyError, TypeError, ValueError):
                continue
            slabs = g.get("slabs") or {}
            popped, taken = [], []
            for L in s.get("layers") or []:
                try:
                    lid = str(L["id"])
                    x, y, w, h = float(L["x"]), float(L["y"]), float(L["w"]), float(L["h"])
                except (KeyError, TypeError, ValueError):
                    continue
                uv = slabs.get(lid)
                if not uv or len(uv) != 4:
                    continue           # no slab yet: the element stays flat in the base (with its CSS glass)
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
                taken.append(tuple(rect))
                p = {"id": lid, "x": round(x, 2), "y": round(y, 2), "w": round(w, 2), "h": round(h, 2),
                     "dz": float(L.get("dz") or 0.012), "slab": [float(v) for v in uv]}
                if clipped:
                    p["clip"] = [round(v, 2) for v in rect]
                popped.append(p)
            out.append({"steamKey": s["overlayKey"], "texW": texW, "texH": texH, "visible": True,
                        "glassd": {"key": g.get("key") or "glassd." + s["name"], "backdrop": backdrop, "scale": scale},
                        "coverDz": COVER_DZ, "baseDz": BASE_DZ, "popped": popped})
        self.wake_at = wake
        spec = {"M": None, "surfaces": out}
        flags = self.read_flags()
        if flags and out:
            spec["flags"] = flags
        return spec

    def native_state(self):
        """(overlay keys whose cover the compositor shows, {key: popped ids it
        shows}), from the latest systemui heartbeat and the spec it reflects."""
        if not (self.native_ok() and self.sysui_ok and self.sg_beat and self.spec_sent_obj):
            return [], {}
        b = self.sg_beat
        if time.time() - self.sg_beat_at > SG_BEAT_FRESH_S or b.get("expired") or not b.get("attached") \
                or not b.get("push"):
            return [], {}
        gsurf = (self.gout or {}).get("surfaces") or {}
        names = {s.get("overlayKey"): s.get("name") for s in (self.current_report() or {}).get("surfaces", [])
                 if isinstance(s, dict)}
        spec = {s["steamKey"]: {p["id"] for p in s["popped"]} for s in self.spec_sent_obj.get("surfaces", [])}
        now_ms = time.time() * 1000
        keys, acks = [], {}
        for key, sm in (b.get("surf") or {}).items():
            if key not in spec:
                continue
            g = gsurf.get(names.get(key)) or {}
            if g.get("cover") == 0:      # glassd draws no cover glass for it
                continue
            at = sm.get("coverAt") or 0
            if not at or now_ms - at < SHOWN_MS:
                continue
            keys.append(key)
            acks[key] = sorted(i for i, t in (sm.get("pops") or {}).items()
                               if t and now_ms - t >= SHOWN_MS and i in spec[key])
        return sorted(keys), acks

    # ---------------------------------------------------------------- Steam
    def on_binding(self, params):
        if params.get("name") != BINDING:
            return
        try:
            rep = json.loads(params.get("payload") or "null")
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

    async def steam_target(self):
        loop = asyncio.get_running_loop()
        ts = await loop.run_in_executor(None, lambda: http_json(lgs.CDP + "/json/list", 5))
        for t in ts:
            if t.get("title") == "SharedJSContext":
                return t
        raise ConnectionError("no SharedJSContext target")

    async def inject_reporter(self):
        if not os.path.exists(LAYERS_JS):
            if self.reporter_state != "missing":
                log("lgs_layers.js not installed: main window glass only, nothing pops out")
            self.reporter_state = "missing"
            return False
        with open(LAYERS_JS, encoding="utf-8") as f:
            src = f.read()
        cfg = None
        if os.path.exists(LAYERS_CFG):
            try:
                with open(LAYERS_CFG, encoding="utf-8") as f:
                    cfg = json.load(f)
            except ValueError as e:
                self.note(f"theme/layers.json ignored: {e}")
        opts = {"binding": BINDING, "layers": cfg, "version": file_version(LAYERS_JS), "ackMode": True}
        self.reporter_injected_at = time.time()
        self.reporter_version = opts["version"]
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
                t = await self.steam_target()
                self.steam = await CDP("steam", t["webSocketDebuggerUrl"]).open()
                self.steam.handlers["Runtime.bindingCalled"] = self.on_binding
                await self.steam.send("Runtime.addBinding", {"name": BINDING})
                self.steam_ok = True
                log("steam: connected")
                if self.native_possible():
                    await self.inject_reporter()
                tick = 0
                while not self.stopping and not self.steam.closed:
                    on = await self.steam.eval("!!(window.__LGS && window.__LGS.state && window.__LGS.state.enabled)", 10)
                    self.theme_on = bool(on)
                    self.theme_off_polls = 0 if on else self.theme_off_polls + 1
                    if self.theme_off_polls == THEME_OFF_POLLS and self.stay:
                        log("steam: theme is off; dormant (--stay) until it is back")
                    if self.theme_off_polls >= THEME_OFF_POLLS and not self.stay:
                        log("steam: theme is off; tearing down")
                        self.request_stop("steam theme off", strip_vr=True)
                        return
                    # reporter installed later, changed on disk, or lost (page reload);
                    # stopped again when native mode ended (CSS only)
                    if tick % 3 == 0 and not self.native_possible() and self.reporter_version:
                        r = await self.steam.eval(REPORTER_STOP_JS, 10)
                        log(f"steam: native layer off; reporter stopped ({r})")
                        self.reporter_version, self.reporter_state = None, "stopped (css only)"
                        self.report, self.fallback = None, None
                    elif self.native_possible() and os.path.exists(LAYERS_JS):
                        if tick % 3 == 0 and file_version(LAYERS_JS) != self.reporter_version:
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
                    if not self.native_possible():
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
                    tick += 1
                    await asyncio.sleep(1.0)
            except asyncio.CancelledError:
                raise
            except NET_ERRORS as e:
                if not self.stopping:
                    self.note(f"steam: {e!r}")
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
                keys, acks = self.native_state()
                payload = (keys, acks)
                now = time.time()
                if not self.native_force:
                    if payload == sent and (not keys or now - sent_at < NATIVE_BEAT_S):
                        continue
                    if sent is None and not keys and not self.native_applied:
                        sent = payload       # nothing native and nothing applied: no call needed
                        continue
                self.native_force = False
                r = await s.eval(f"({NATIVE_JS})({json.dumps(keys)}, {NATIVE_TTL_MS}, {json.dumps(acks)})", 5)
                res = json.loads(r) if isinstance(r, str) else {}
                sent, sent_at = payload, now
                applied = res.get("applied") or []
                if applied != self.native_applied:
                    log(f"steam: lgs-native on {applied or 'no windows'}")
                self.native_applied = applied
                self.native_tagged = res.get("tagged")
                self.acked = acks
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

    async def inject_sg(self, force=False):
        with open(SG_JS, encoding="utf-8") as f:
            src = f.read().strip().rstrip(";")
        self.sg_version = file_version(SG_JS)
        opts = {"version": self.sg_version, "watchdogMs": WATCHDOG_MS, "maxPushHz": SG_MAX_PUSH_HZ}
        if force:
            opts["force"] = True
        r = await self.sysui.eval(f"({src})({json.dumps(opts)})", 20)
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
                log(f"systemui: spec -> {self.spec_summary}{more}")
                self.spec_logged_at, self.spec_log_sig, self.spec_log_skipped = now, sig, 0
            else:
                self.spec_log_skipped += 1
        return res

    async def sysui_loop(self):
        while not self.stopping:
            delay = 2
            try:
                if not self.native_possible():   # CSS only: leave systemui alone
                    await asyncio.sleep(3)
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
                    until = min(next_beat, now + 0.5, self.wake_at or now + 0.5)
                    try:
                        await asyncio.wait_for(self.changed.wait(), max(0.02, until - now))
                    except asyncio.TimeoutError:
                        pass
                    self.changed.clear()
                    if self.stopping:
                        break
                    if not self.native_possible():   # glassd gave up or its binary was removed
                        await self.sysui.eval("window.__LGS_SG ? (window.__LGS_SG.destroy(), 'cleared') : 'absent'", 10)
                        log("systemui: native layer off; scene graph removed")
                        break
                    if self.sg_reset:                  # page reloaded under us
                        self.sg_reset = False
                        log("systemui: page context reset (reload?); re-injecting")
                        await asyncio.sleep(0.5)       # let the new page come up
                        await self.inject_sg()
                        next_beat = 0.0
                    if file_version(SG_JS) != self.sg_version:
                        await self.inject_sg()
                        next_beat = 0.0
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
                await self.supervise_glassd(now)
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
            if not self.g_frames and (float(d.get("fps") or 0) > 0 or int(d.get("frames") or 0) > 0):
                self.g_frames = True
                log(f"glassd: producing frames (fps {d.get('fps')}, gpu {d.get('gpu_ms')} ms); native mode")
            if was_ready != self.glassd_ready():
                log(f"glassd: {'ready' if self.glassd_ready() else 'not ready'} (healthy {d.get('healthy')}, "
                    f"exiting {d.get('exiting', False)})")
            self.changed.set()

    async def supervise_glassd(self, now):
        """Once a second: binary removed -> CSS only; output stale -> restart."""
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
            # glassd needs SteamVR and something to cover
            if not (self.sysui_ok and self.steam_ok and self.theme_on and self.current_report()):
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

    async def kill_glassd(self):
        p = self.gproc
        if not p or p.returncode is not None:
            return
        try:
            p.terminate()
            await asyncio.wait_for(p.wait(), 4)
        except asyncio.TimeoutError:
            p.kill()
            await p.wait()
        except ProcessLookupError:
            pass
        log(f"glassd: stopped ({p.returncode})")

    # ---------------------------------------------------------------- SteamVR page theming
    async def vr_theme_loop(self):
        loop = asyncio.get_running_loop()
        sig, full, probe = None, None, None
        while not self.stopping:
            await asyncio.sleep(lgs_vr.POLL)
            if os.path.exists(VR_PAUSE):     # lab "--theme off" on a vr: page
                continue
            try:
                if not await loop.run_in_executor(None, lgs_vr.available):
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
                for t in await loop.run_in_executor(None, lgs_vr.targets):
                    name = t["title"] or t["url"]
                    try:
                        r = await eval_once(t["webSocketDebuggerUrl"], probe, 10)
                        if r == "need":
                            r = await eval_once(t["webSocketDebuggerUrl"], full, 30)
                            log(f"vr: {name}: {r}")
                        pages[name] = r
                    except Exception:  # noqa: BLE001 - page reloading or closing
                        pages[name] = "error"
                self.vr_pages = pages
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
        # 1. scene graph: back to Steam's own panels
        try:
            if await loop.run_in_executor(None, lgs_vr.available):
                t = await self.sysui_target()
                r = await eval_once(t["webSocketDebuggerUrl"],
                                    "window.__LGS_SG ? (window.__LGS_SG.destroy(), 'cleared') : 'absent'", 10)
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
                try:
                    await s.send("Runtime.removeBinding", {"name": BINDING})
                except RuntimeError:
                    pass
            finally:
                await s.close()
            log(f"teardown: lgs-native {r}, reporter {rr}")
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
        self.tasks = [loop.create_task(c) for c in (
            self.steam_loop(), self.native_loop(), self.sysui_loop(), self.glassd_loop(), self.glassd_out_loop(),
            self.vr_theme_loop(), self.status_loop())]
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


def start(glassd=GLASSD_BIN, stay=False, glassd_args=None, native=None):
    """Start the unit. Also resumes SteamVR page theming that a lab "--theme
    off" on a vr: page paused. native: True runs the native layer (opt-in),
    False CSS only, None keeps a running unit as it is (a new one is CSS only).
    A unit that is stopping is waited for and then started fresh. stay=True
    (lab testing only) keeps it running, dormant, while the Steam theme is off."""
    try:
        os.remove(VR_PAUSE)
    except OSError:
        pass
    # the pre-native watcher, if an older lgs started it
    subprocess.run(["systemctl", "--user", "stop", lgs_vr.UNIT], capture_output=True, env=user_env())
    def daemon_args(nat):
        return ["--glassd", (glassd if nat and glassd else "none")] + (["--native"] if nat else []) + \
            (["--stay"] if stay else []) + (["--glassd-args", " ".join(glassd_args)] if nat and glassd_args else [])

    state, pid = settle()
    if state in ("active", "activating", "reloading"):
        argv = daemon_argv(pid)
        cur = "--native" in argv
        running = argv[argv.index("daemon") + 1:] if "daemon" in argv else None
        # an explicit request restarts a unit that runs differently
        if native is None or running == daemon_args(bool(native)):
            st = read_json(STATUS) or {}
            if cur and st.get("pid") == pid and not (st.get("native") or {}).get("enabled", True):
                return f"running (native requested; {st.get('mode')})"
            return "running (native)" if cur else "running (css only)"
        stop()
        settle()
    native = bool(native)
    subprocess.run(["systemctl", "--user", "reset-failed", UNIT], capture_output=True, env=user_env())
    cmd = ["systemd-run", "--user", "--unit", UNIT, "--collect", "--quiet",
           "-p", "KillMode=mixed", "-p", "TimeoutStopSec=15",
           "--description=Glass Shell: native glass layer + SteamVR page theming (transient)",
           "/usr/bin/python3", "-u", os.path.realpath(__file__), "daemon"] + daemon_args(native)
    r = subprocess.run(cmd, capture_output=True, text=True, env=user_env())
    if r.returncode != 0:
        return f"failed: {r.stderr.strip()}"
    if native and not (glassd and os.access(glassd, os.X_OK)):
        return "started (css only: native requested but no glassd binary)"
    return "started (native)" if native else "started (css only)"


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
    return {"unit": "active", "mode": st.get("mode"), "native": st.get("native"),
            "glassd": {k: g.get(k) for k in ("running", "ready", "pid", "restarts", "fps", "gpu_ms", "surfaces")},
            "layers": {"source": s.get("source"), "reporter": s.get("reporter"), "surfaces": s.get("surfaces")},
            "lgsNative": s.get("lgsNative"),
            "sceneGraph": {"items": u.get("items"), "panels": u.get("panels"), "attached": u.get("attached")},
            "steamvrPages": len((st.get("steamvrPages") or {}).get("pages") or {}),
            "errors": (st.get("errors") or [])[-3:]}


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "status"
    if cmd == "daemon":
        try:
            return asyncio.run(Shell(glassd_arg(argv), stay_arg(argv), glassd_args_arg(argv),
                                     native=bool(native_arg(argv))).run())
        except KeyboardInterrupt:
            return 0
    if cmd == "start":
        gargs = glassd_args_arg(argv)
        glassd = glassd_arg(argv)
        # From the command line (lab and tests) the real glassd does not read
        # the camera unless asked to: --feed, or explicit --glassd-args.
        if gargs is None and "--feed" not in argv and glassd and os.path.basename(glassd) == "glassd":
            gargs = ["--no-feed"]
        print(start(glassd, stay_arg(argv), gargs, native_arg(argv)))
    elif cmd == "stop":
        print(stop())
    elif cmd == "status":
        print(json.dumps(status(), indent=1))
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
