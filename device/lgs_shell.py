#!/usr/bin/env python3
"""Glass Shell native layer daemon: the transient user unit "lgs-shell".

While the theme is on, this joins three things (docs/NATIVE.md):

  Steam (devtools 8080, SharedJSContext)
      device/lgs_layers.js reports the elements that pop out, through the CDP
      binding "lgsLayers"; html.lgs-native is set on the windows glassd covers
  glassd (native/glassd/glassd, a child process)
      renders the room-refracting window glass and the Liquid Glass slabs
      into dmabuf overlays "glassd.<surface>"; it reads /dev/shm/lgs/glassd.json
      and answers in /dev/shm/lgs/glassd-out.json
  SteamVR systemui (devtools 8090)
      device/lgs_sg.js builds the scene-graph nodes that layer glassd's glass
      and crops of Steam's own textures in stereo depth (window.__LGS_SG)

and it keeps SteamVR's own pages themed (what the old "lgs-vr" watcher did).
Without a glassd binary it runs in "CSS only" mode: SteamVR page theming only.

Nothing persists: the unit is transient (systemd-run --collect), it exits when
the Steam theme goes off, and on exit it removes every node, class and file it
made. If it dies without cleaning up, the scene-graph nodes and the lgs-native
class clear themselves within 12 s (heartbeat watchdogs).

  lgs_shell.py start [--glassd PATH|none] [--glassd-args "ARGS"] [--stay]
                                            start the unit (lgs on does this; --stay,
                                            for lab tests only, keeps it dormant
                                            instead of exiting while the theme is off)
  lgs_shell.py stop                         stop it (clean teardown)
  lgs_shell.py status                       unit + live daemon status (JSON)
  lgs_shell.py daemon [--glassd PATH|none]  the unit's process (foreground)
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
GLASSD_BIN = os.path.join(lgs.ROOT, "native", "glassd", "glassd")
LAYERS_JS = os.path.join(HERE, "lgs_layers.js")
LAYERS_CFG = os.path.join(lgs.THEME_DIR, "layers.json")
SG_JS = os.path.join(HERE, "lgs_sg.js")
VR_PAUSE = lgs_vr.PAUSE

BINDING = "lgsLayers"
REPORTER = "__LGS_LAYERS"          # global installed by lgs_layers.js
COVER_DZ, BASE_DZ = 0.001, 0.002   # metres toward the viewer (NATIVE.md)
SPEC_MIN_INTERVAL = 1 / 30         # <= 30 spec pushes a second
GLASSD_JSON_MIN_INTERVAL = 0.25    # position-only changes to glassd.json
WATCHDOG_MS = 12000                # lgs_sg.js / lgs-native self-clear without heartbeat
THEME_OFF_POLLS = 3                # Steam theme seen off this many polls (1 s) -> exit
GLASSD_MAX_CRASHES = 5             # within GLASSD_CRASH_WINDOW s -> give up (CSS only)
GLASSD_CRASH_WINDOW = 120


def log(msg):
    print(time.strftime("%H:%M:%S ") + msg, flush=True)
    lgs.log("shell: " + msg)


def write_json_atomic(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    os.replace(tmp, path)


def read_dial():
    try:
        with open(lgs.DIAL, encoding="utf-8") as f:
            return min(1.0, max(0.0, float(f.read().strip())))
    except (OSError, ValueError):
        return 0.5


def http_json(url, timeout=3):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.load(r)


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
        await self.ws.send_json({"id": i, "method": method, "params": params or {}})
        try:
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

# Sets html.lgs-native on the Steam windows whose surface glassd covers, and
# only while the theme (__LGS) is on. Without a heartbeat (set()) for ttl ms it
# removes the class again, so a dead daemon never leaves windows unpainted.
NATIVE_JS = r"""
(function (keys, ttl) {
  const W = window;
  let h = W.__LGS_NATIVE;
  if (!h) {
    const ALIAS = { 'valve.steam.gamepadui.main': /^VR_uid/, 'valve.steam.gamepadui.keyboard': /^VRKeyboard_uid/,
                    'valve.steam.gamepadui.notifications': /^VRNotificationToasts_uid/ };
    const matches = (name, key) => (ALIAS[key] ? ALIAS[key].test(name) : (name.startsWith(key + '.') || name.startsWith(key + '_')));
    h = W.__LGS_NATIVE = { keys: [], last: 0, ttl, timer: 0, applied: [] };
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
    h.set = (ks) => { h.keys = ks || []; h.last = Date.now(); if (!h.timer && h.keys.length) h.timer = setInterval(h.sweep, 1000); return h.sweep(); };
    h.clear = () => { h.keys = []; const r = h.sweep(); if (h.timer) clearInterval(h.timer); delete W.__LGS_NATIVE; return r; };
  }
  h.ttl = ttl;
  return JSON.stringify(h.set(keys));
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
    def __init__(self, glassd_path, stay=False, glassd_args=None):
        self.glassd_path = glassd_path
        self.glassd_args = list(glassd_args or [])
        self.stay = stay                      # lab aid: go dormant instead of exiting on theme off
        self.stopping = False
        self.stop_task = None
        self.tasks = []
        self.exit_code = 0
        self.torn = False
        self.since = time.time()
        self.errors = collections.deque(maxlen=12)
        self.changed = asyncio.Event()        # spec inputs changed
        # Steam side
        self.steam = None
        self.steam_ok = False
        self.theme_on = None
        self.theme_off_polls = 0
        self.report = None
        self.report_at = 0.0
        self.reports = 0
        self.reporter_state = "not injected"
        self.reporter_injected_at = 0.0
        self.reporter_version = None
        self.fallback = None                  # synthesized report when no reporter
        self.native_applied = []
        # systemui side
        self.sysui = None
        self.sysui_ok = False
        self.sg_version = file_version(SG_JS)
        self.sg_status = None
        self.spec_sent = None
        self.spec_sent_at = 0.0
        self.spec_summary = None
        # glassd
        self.gproc = None
        self.g_pid = None
        self.g_started = 0.0
        self.g_crashes = []
        self.g_restarts = 0
        self.g_last_exit = None
        self.g_given_up = False
        self.g_frames = False
        self.gout = None
        self.gout_mtime = None
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
        if not self.glassd_path:
            return "css-only (glassd disabled)"
        if self.g_given_up:
            return "css-only (glassd gave up)"
        if not os.access(self.glassd_path, os.X_OK):
            return "css-only (no glassd binary; python glass.py native-build)"
        if self.native_ok():
            return "native"
        return "starting"

    def native_possible(self):
        """A glassd binary to run: without one the daemon only themes SteamVR
        pages (CSS only) and injects neither the reporter nor lgs_sg.js."""
        return bool(self.glassd_path and not self.g_given_up and os.access(self.glassd_path, os.X_OK))

    def native_ok(self):
        return bool(self.native_possible() and self.gproc and self.gproc.returncode is None
                    and self.g_frames and self.gout and self.steam_ok and self.theme_on)

    def current_report(self):
        if self.report is not None:
            return self.report
        return self.fallback

    def note(self, msg):
        self.errors.append(time.strftime("%H:%M:%S ") + msg)
        log(msg)

    def status(self):
        g = self.gout or {}
        sg = self.sg_status or {}
        rep = self.current_report() or {}
        return {
            "pid": os.getpid(), "since": time.strftime("%H:%M:%S", time.localtime(self.since)),
            "updated": time.time(), "mode": self.mode(),
            "glassd": {"path": self.glassd_path, "pid": self.g_pid,
                       "running": bool(self.gproc and self.gproc.returncode is None),
                       "restarts": self.g_restarts, "lastExit": self.g_last_exit, "givenUp": self.g_given_up,
                       "frames": self.g_frames, "seq": g.get("seq"), "fps": g.get("fps"), "gpu_ms": g.get("gpu_ms"),
                       "surfaces": sorted((g.get("surfaces") or {}).keys()), "configSeq": self.gseq},
            "steam": {"connected": self.steam_ok, "themeOn": self.theme_on, "reporter": self.reporter_state,
                      "reports": self.reports, "reportSeq": (self.report or {}).get("seq"),
                      "reportAgeS": round(time.time() - self.report_at, 1) if self.report_at else None,
                      "source": "reporter" if self.report is not None else ("fallback" if self.fallback else None),
                      "surfaces": [s.get("name") for s in rep.get("surfaces", [])],
                      "lgsNative": self.native_applied},
            "systemui": {"connected": self.sysui_ok, "sgVersion": self.sg_version, "spec": self.spec_summary,
                         "items": sg.get("items"), "panels": sg.get("panels"), "nodes": sg.get("nodes"),
                         "attached": sg.get("attached"), "parents": sg.get("parents"),
                         "relayouts": sg.get("relayouts"), "pushes": sg.get("pushes"),
                         "pushesLastSec": sg.get("pushesLastSec"), "reattaches": sg.get("reattaches"),
                         "scheduler": sg.get("scheduler"), "expired": sg.get("expired"), "sgErrors": sg.get("errors")},
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
    def build_spec(self):
        if not self.native_ok():
            return {"M": None, "surfaces": []}
        rep = self.current_report() or {"surfaces": []}
        gsurf = (self.gout or {}).get("surfaces") or {}
        out = []
        for s in rep.get("surfaces", []):
            g = gsurf.get(s.get("name"))
            if not g or not s.get("overlayKey") or not s.get("visible", True):
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
                    continue           # no slab yet: the element stays flat in the base
                # glassd draws a slab at the element's size x backdropScale; if
                # the element was resized since, wait for the new slab.
                if abs((uv[2] - uv[0]) * gW - w * scale) > 2.5 or abs((uv[3] - uv[1]) * gH - h * scale) > 2.5:
                    continue
                if any(x < t[2] and x + w > t[0] and y < t[3] and y + h > t[1] for t in taken):
                    continue           # overlapping popped rects would show pixels twice
                taken.append((x, y, x + w, y + h))
                popped.append({"id": lid, "x": round(x, 2), "y": round(y, 2), "w": round(w, 2), "h": round(h, 2),
                               "dz": float(L.get("dz") or 0.012), "slab": [float(v) for v in uv]})
            out.append({"steamKey": s["overlayKey"], "texW": texW, "texH": texH, "visible": True,
                        "glassd": {"key": g.get("key") or "glassd." + s["name"], "backdrop": backdrop, "scale": scale},
                        "coverDz": COVER_DZ, "baseDz": BASE_DZ, "popped": popped})
        return {"M": None, "surfaces": out}

    def native_keys(self):
        """Overlay keys of the Steam windows glassd currently covers."""
        if not self.native_ok():
            return []
        gsurf = (self.gout or {}).get("surfaces") or {}
        rep = self.current_report() or {"surfaces": []}
        return sorted({s["overlayKey"] for s in rep.get("surfaces", [])
                       if s.get("name") in gsurf and s.get("overlayKey")})

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
        self.report = rep
        self.report_at = time.time()
        self.reports += 1
        self.reporter_state = "reporting"
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
        opts = {"binding": BINDING, "layers": cfg, "version": file_version(LAYERS_JS)}
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
        resend = await self.steam.eval(REPORTER_RESEND_JS)
        log(f"reporter injected ({self.reporter_state}, resend: {resend})")
        return True

    async def steam_loop(self):
        while not self.stopping:
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
                    # stopped again when there is no glassd (CSS only)
                    if tick % 3 == 0 and not self.native_possible() and self.reporter_version:
                        r = await self.steam.eval(REPORTER_STOP_JS, 10)
                        log(f"steam: no glassd; reporter stopped ({r})")
                        self.reporter_version, self.reporter_state = None, "stopped (css only)"
                        self.report, self.fallback = None, None
                    elif tick % 3 == 0 and self.native_possible() and os.path.exists(LAYERS_JS):
                        if file_version(LAYERS_JS) != self.reporter_version:
                            await self.inject_reporter()
                        elif self.reporter_state in ("injected", "reporting") and \
                                await self.steam.eval(f"typeof window.{REPORTER}", 10) == "undefined":
                            log("steam: reporter gone (page reloaded?); re-injecting")
                            await self.inject_reporter()
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
                    # lgs-native heartbeat
                    keys = self.native_keys()
                    if keys or self.native_applied:
                        applied = json.loads(await self.steam.eval(f"({NATIVE_JS})({json.dumps(keys)}, {WATCHDOG_MS})", 10) or "[]")
                        if applied != self.native_applied:
                            log(f"steam: lgs-native on {applied or 'no windows'}")
                        self.native_applied = applied
                    self.write_glassd_json()
                    tick += 1
                    await asyncio.sleep(1.0)
            except asyncio.CancelledError:
                raise
            except (ConnectionError, OSError, RuntimeError, asyncio.TimeoutError, ValueError) as e:
                if not self.stopping:
                    self.note(f"steam: {e!r}")
            finally:
                self.steam_ok = False
                self.changed.set()
                if self.steam:
                    await self.steam.close()
            if not self.stopping:
                await asyncio.sleep(2)

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

    async def inject_sg(self):
        with open(SG_JS, encoding="utf-8") as f:
            src = f.read().strip().rstrip(";")
        self.sg_version = file_version(SG_JS)
        opts = {"version": self.sg_version, "watchdogMs": WATCHDOG_MS}
        r = await self.sysui.eval(f"({src})({json.dumps(opts)})", 20)
        st = json.loads(r) if isinstance(r, str) else r
        self.sg_status = st
        sch = (st or {}).get("scheduler") or {}
        log(f"systemui: lgs_sg {self.sg_version} installed (scheduler module {sch.get('module')}, "
            f"retire {sch.get('retire')}{', ' + sch['error'] if sch.get('error') else ''})")
        self.spec_sent = None

    async def send_spec(self, spec):
        js = json.dumps(spec, separators=(",", ":"))
        r = await self.sysui.eval(f"window.__LGS_SG ? JSON.stringify(window.__LGS_SG.update({js})) : null", 10)
        if r is None:
            await self.inject_sg()
            r = await self.sysui.eval(f"JSON.stringify(window.__LGS_SG.update({js}))", 10)
        self.spec_sent = js
        self.spec_sent_at = time.time()
        res = json.loads(r) if r else {}
        self.spec_summary = {"surfaces": len(spec["surfaces"]),
                             "popped": sum(len(s["popped"]) for s in spec["surfaces"]),
                             "items": res.get("items"), "counts": res.get("counts")}
        if res.get("changed"):
            log(f"systemui: spec -> {self.spec_summary}")

    async def sysui_loop(self):
        last_ping = 0.0
        while not self.stopping:
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
                await self.inject_sg()
                self.sysui_ok = True
                log("systemui: connected")
                while not self.stopping and not self.sysui.closed:
                    try:
                        await asyncio.wait_for(self.changed.wait(), 0.5)
                    except asyncio.TimeoutError:
                        pass
                    self.changed.clear()
                    if self.stopping:
                        break
                    if not self.native_possible():   # glassd gave up or vanished
                        await self.sysui.eval("window.__LGS_SG ? (window.__LGS_SG.destroy(), 'cleared') : 'absent'", 10)
                        log("systemui: no glassd; scene graph removed")
                        break
                    if file_version(SG_JS) != self.sg_version:
                        await self.inject_sg()
                    self.write_glassd_json()
                    spec = self.build_spec()
                    js = json.dumps(spec, separators=(",", ":"))
                    if js != self.spec_sent:
                        wait = self.spec_sent_at + SPEC_MIN_INTERVAL - time.time()
                        if wait > 0:
                            await asyncio.sleep(wait)
                            spec = self.build_spec()
                        await self.send_spec(spec)
                    if time.time() - last_ping > 2:
                        last_ping = time.time()
                        r = await self.sysui.eval("window.__LGS_SG ? (window.__LGS_SG.ping(), "
                                                  "JSON.stringify(window.__LGS_SG.status())) : null", 10)
                        if r is None:
                            log("systemui: __LGS_SG gone (page reloaded?); re-injecting")
                            await self.inject_sg()
                        else:
                            self.sg_status = json.loads(r)
            except asyncio.CancelledError:
                raise
            except (ConnectionError, OSError, RuntimeError, asyncio.TimeoutError, ValueError) as e:
                if not self.stopping:
                    self.note(f"systemui: {e!r}")
            finally:
                self.sysui_ok = False
                if self.sysui:
                    await self.sysui.close()
            if not self.stopping:
                await asyncio.sleep(2)

    # ---------------------------------------------------------------- glassd
    async def glassd_out_loop(self):
        while not self.stopping:
            await asyncio.sleep(0.1)
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
            if not isinstance(d, dict):
                continue
            running = self.gproc is not None and self.gproc.returncode is None
            if not running:
                continue
            self.gout = d
            if not self.g_frames and (float(d.get("fps") or 0) > 0 or int(d.get("frames") or 0) > 0):
                self.g_frames = True
                log(f"glassd: producing frames (fps {d.get('fps')}, gpu {d.get('gpu_ms')} ms); native mode")
            self.changed.set()

    async def pipe_glassd(self, proc):
        while True:
            line = await proc.stdout.readline()
            if not line:
                return
            print("glassd: " + line.decode(errors="replace").rstrip(), flush=True)

    async def glassd_loop(self):
        if not self.glassd_path:
            log("glassd disabled: CSS only + SteamVR page theming")
            return
        announced = False
        while not self.stopping:
            if not os.access(self.glassd_path, os.X_OK):
                if not announced:
                    log(f"no glassd at {self.glassd_path}: CSS only + SteamVR page theming "
                        "(build it with: python glass.py native-build)")
                    announced = True
                await asyncio.sleep(10)
                continue
            # glassd needs SteamVR and something to cover
            if not (self.sysui_ok and self.steam_ok and self.theme_on and self.current_report()):
                await asyncio.sleep(1)
                continue
            for p in (GLASSD_OUT,):
                try:
                    os.remove(p)
                except OSError:
                    pass
            self.gout, self.gout_mtime, self.g_frames = None, None, False
            self.write_glassd_json(force=True)
            args = [self.glassd_path] + self.glassd_args + os.environ.get("LGS_GLASSD_ARGS", "").split()
            try:
                self.gproc = await asyncio.create_subprocess_exec(
                    *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
                    stdin=asyncio.subprocess.DEVNULL, start_new_session=False)
            except OSError as e:
                self.note(f"glassd: cannot start: {e}")
                self.g_given_up = True
                return
            self.g_pid = self.gproc.pid
            self.g_started = time.time()
            log(f"glassd: started pid {self.g_pid} ({' '.join(args)})")
            piper = asyncio.create_task(self.pipe_glassd(self.gproc))
            rc = await self.gproc.wait()
            await asyncio.gather(piper, return_exceptions=True)
            self.g_last_exit = rc
            self.g_frames = False
            self.gout = None
            self.changed.set()
            if self.stopping:
                return
            self.g_restarts += 1
            now = time.time()
            self.g_crashes = [t for t in self.g_crashes if now - t < GLASSD_CRASH_WINDOW] + [now]
            self.note(f"glassd: exited with {rc} after {now - self.g_started:.1f} s")
            if len(self.g_crashes) >= GLASSD_MAX_CRASHES:
                self.g_given_up = True
                self.note(f"glassd: {GLASSD_MAX_CRASHES} exits in {GLASSD_CRASH_WINDOW} s; giving up (CSS only)")
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
        for p in (GLASSD_JSON, GLASSD_OUT):
            try:
                os.remove(p)
            except OSError:
                pass
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
        log(f"lgs-shell starting (pid {os.getpid()}, glassd {self.glassd_path or 'disabled'})")
        self.tasks = [loop.create_task(c) for c in (
            self.steam_loop(), self.sysui_loop(), self.glassd_loop(), self.glassd_out_loop(),
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
            # a loop that ends normally (glassd disabled or given up) is fine
        if self.stop_task is None:
            self.request_stop("all loops ended")
        await self.stop_task
        log("lgs-shell exited")
        return self.exit_code


# ------------------------------------------------------------------ unit control

def user_env():
    return lgs_vr.user_env()


def unit_active():
    r = subprocess.run(["systemctl", "--user", "is-active", UNIT], capture_output=True, text=True, env=user_env())
    return r.stdout.strip() in ("active", "activating", "deactivating")


def stay_arg(argv):
    return "--stay" in argv


def glassd_args_arg(argv):
    """--glassd-args "ARGS": extra glassd arguments (tests: --no-feed, --key-prefix)."""
    if "--glassd-args" in argv:
        return argv[argv.index("--glassd-args") + 1].split()
    return []


def glassd_arg(argv):
    if "--glassd" in argv:
        v = argv[argv.index("--glassd") + 1]
        return None if v == "none" else os.path.abspath(v)
    return GLASSD_BIN


def start(glassd=GLASSD_BIN, stay=False, glassd_args=None):
    """Start the unit (idempotent). Also resumes SteamVR page theming that a
    lab "--theme off" on a vr: page paused. stay=True (lab testing only) keeps
    it running, dormant, while the Steam theme is off."""
    try:
        os.remove(VR_PAUSE)
    except OSError:
        pass
    # the pre-native watcher, if an older lgs started it
    subprocess.run(["systemctl", "--user", "stop", lgs_vr.UNIT], capture_output=True, env=user_env())
    if unit_active():
        return "running"
    subprocess.run(["systemctl", "--user", "reset-failed", UNIT], capture_output=True, env=user_env())
    cmd = ["systemd-run", "--user", "--unit", UNIT, "--collect", "--quiet",
           "-p", "KillMode=mixed", "-p", "TimeoutStopSec=15",
           "--description=Glass Shell: native glass layer + SteamVR page theming (transient)",
           "/usr/bin/python3", "-u", os.path.realpath(__file__), "daemon",
           "--glassd", glassd or "none"] + (["--stay"] if stay else []) + \
        (["--glassd-args", " ".join(glassd_args)] if glassd_args else [])
    r = subprocess.run(cmd, capture_output=True, text=True, env=user_env())
    return "started" if r.returncode == 0 else f"failed: {r.stderr.strip()}"


def stop():
    """Stop the unit; its SIGTERM handler removes every node, class and file."""
    was = unit_active()
    subprocess.run(["systemctl", "--user", "stop", UNIT], capture_output=True, env=user_env())
    subprocess.run(["systemctl", "--user", "stop", lgs_vr.UNIT], capture_output=True, env=user_env())
    return "stopped" if was else "not running"


def status():
    out = {"unit": "active" if unit_active() else "inactive"}
    try:
        with open(STATUS, encoding="utf-8") as f:
            st = json.load(f)
        if out["unit"] == "active" or st.get("mode") == "stopped":
            age = time.time() - st.get("updated", 0)
            out.update(st)
            out["statusAgeS"] = round(age, 1)
    except (OSError, ValueError):
        pass
    return out


def brief(st):
    """One-level summary for lgs status."""
    if st.get("unit") != "active":
        return {"unit": st.get("unit")}
    g, s, u = st.get("glassd", {}), st.get("steam", {}), st.get("systemui", {})
    return {"unit": "active", "mode": st.get("mode"),
            "glassd": {k: g.get(k) for k in ("running", "pid", "restarts", "fps", "gpu_ms", "surfaces")},
            "layers": {"source": s.get("source"), "reporter": s.get("reporter"), "surfaces": s.get("surfaces")},
            "lgsNative": s.get("lgsNative"),
            "sceneGraph": {"items": u.get("items"), "panels": u.get("panels"), "attached": u.get("attached")},
            "steamvrPages": len((st.get("steamvrPages") or {}).get("pages") or {}),
            "errors": (st.get("errors") or [])[-3:]}


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "status"
    if cmd == "daemon":
        try:
            return asyncio.run(Shell(glassd_arg(argv), stay_arg(argv), glassd_args_arg(argv)).run())
        except KeyboardInterrupt:
            return 0
    if cmd == "start":
        print(start(glassd_arg(argv), stay_arg(argv), glassd_args_arg(argv)))
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
