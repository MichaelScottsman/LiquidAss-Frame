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
    extra = ""
    for name in ("lab_p2.js", "lab_gates.js", "lab_bfs.js", "lab_motion.js", "lab_conf.js"):
        p = os.path.join(HERE, name)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                extra += "\n" + f.read()
    # Reinstall the helpers whenever their source changes (they live on in the
    # page between calls, guarded by version checks that an edit can forget).
    import hashlib
    h = hashlib.sha1((lab + extra).encode()).hexdigest()[:12]
    head = f"if (window.__LGS_LAB && window.__LGS_LAB.hash !== '{h}') delete window.__LGS_LAB;\n"
    tail = f"\nif (window.__LGS_LAB) window.__LGS_LAB.hash = '{h}';\n"
    return idx + "\n" + head + lab + extra + tail


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


def flock_wait(path, seconds, what="lock"):
    """Open and exclusively flock path, polling; returns the open file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    f = open(path, "w")
    deadline = time.time() + seconds
    while True:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return f
        except BlockingIOError:
            if time.time() > deadline:
                f.close()
                raise SystemExit(f"lab: {what} busy for {int(seconds)} s")
            time.sleep(0.25)


class Lock:
    """Device-wide lock for one atomic lab step. On exit it closes every menu,
    dialog and bar popup the step opened (unless keep=True). Step options
    (--flags/--mode/--media) are applied inside it and undone on exit.
    both=True takes lab.lock and then lab-vr.lock (steps that touch Steam and
    systemui). Re-entrant within one process (nested steps reuse the lock)."""

    depth = 0

    def __init__(self, keep=False, surface=None, both=False):
        self.keep = keep
        # SteamVR pages don't share state with Steam's UI: their own lock, so
        # SteamVR work never waits on Steam route captures and vice versa.
        self.vr = bool(surface and surface.startswith("vr:")) and not both
        self.paths = [LOCK, LOCK.replace("lab.lock", "lab-vr.lock")] if both else \
            [LOCK.replace("lab.lock", "lab-vr.lock") if self.vr else LOCK]
        self.files = []
        self.step = None
        self.surface = surface
        self.nested = False

    def _release(self):
        for f in reversed(self.files):
            try:
                fcntl.flock(f, fcntl.LOCK_UN)
            finally:
                f.close()
        self.files = []

    def __enter__(self):
        # Exception-safe (review R1 M4): if taking a lock or applying the step options raises (a lock busy for
        # 240 s, a CDP error), what was applied is undone, the files already taken are released and the depth
        # counter is put back before the exception goes on, so the next `with Lock()` locks again.
        if Lock.depth > 0:
            Lock.depth += 1
            self.nested = True
            return self
        Lock.depth = 1
        try:
            purge_stale_hv()
            for p in self.paths:
                self.files.append(flock_wait(p, 240, "lock"))
            if not self.vr:
                try:
                    lab_js("L.mark()")
                except Exception:  # noqa: BLE001 - the step must still run
                    pass
            self.step = Step(STEP, vr=self.vr, surface=self.surface)
            self.step.apply()
        except BaseException:
            try:
                if self.step:
                    self.step.undo()
            except Exception as e:  # noqa: BLE001
                print(f"lab: step undo after a failed lock entry: {e}", file=sys.stderr)
            finally:
                self.step = None
                try:
                    self._release()
                finally:
                    Lock.depth = 0
            raise
        return self

    def __exit__(self, *a):
        if self.nested:
            Lock.depth = max(0, Lock.depth - 1)
            return
        try:
            if not self.keep and not self.vr:
                n = lab_js("L.restore()")
                if n:
                    print(f"(closed {n} menu/dialog/popup opened by this step)", file=sys.stderr)
        except Exception:  # noqa: BLE001
            pass
        finally:
            try:
                if HOVERED:
                    cdp_unhover()
            except Exception:  # noqa: BLE001 - the step options must still be undone
                pass
            try:
                if self.step:
                    self.step.undo()
            finally:
                self.step = None
                try:
                    self._release()
                finally:
                    Lock.depth = 0


# ---------------------------------------------------------------- room frames (LAB never-list)
HV_GLOB_DIR = "/tmp/lgs"


def purge_stale_hv(max_age=60):
    """Delete headset-view frames (/tmp/lgs/hv-*.png, room imagery) older than max_age s: a glass.py that died
    between hvgrab and its fetch must not leave one behind (review R1 M5). Run at every lock entry."""
    n = 0
    now = time.time()
    try:
        names = os.listdir(HV_GLOB_DIR)
    except OSError:
        return 0
    for nm in names:
        if nm.startswith("hv-") and nm.endswith(".png"):
            p = os.path.join(HV_GLOB_DIR, nm)
            try:
                if now - os.path.getmtime(p) > max_age:
                    os.remove(p)
                    n += 1
            except OSError:
                pass
    return n


# ---------------------------------------------------------------- real laser hover (CDP)
# L.hover dispatches untrusted events, so CSS :hover never applies. A real hover is a CDP
# Input.dispatchMouseEvent on the surface's own target (REQ C1c->P10). Every surface hovered in a
# step gets the pointer sent to (1400, 900) main-window texture px at the lock exit (IM 9).

HOVERED = set()


def cdp_mouse(surface, x, y):
    t = target_for(surface)

    async def go():
        async with lgs.Session(t["webSocketDebuggerUrl"]) as s:
            await s.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": float(x), "y": float(y),
                                                      "button": "none", "pointerType": "mouse"}, 10)
    asyncio.run(go())


HOVER_RECT_JS = r"""
(() => {
  const el = L.q(%s, %s);
  if (!el) return null;
  el.scrollIntoView && el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const r = el.getBoundingClientRect(), w = L.surface(%s);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, dpr: w.devicePixelRatio, w: w.innerWidth, h: w.innerHeight };
})()
"""


def cdp_hover(surface, sel, dwell_ms=0):
    """Move the real (CDP) pointer to the centre of sel in surface; held until the lock exit or unhover."""
    surface = surface or "main"
    js = HOVER_RECT_JS % (json.dumps(surface), json.dumps(sel), json.dumps(surface))
    r = lab_js(js, surface=surface if surface.startswith("vr:") else None)
    if not r:
        raise RuntimeError(f"hover: nothing matches {sel} in {surface}")
    cdp_mouse(surface, r["x"], r["y"])
    HOVERED.add(surface)
    if dwell_ms:
        time.sleep(dwell_ms / 1000.0)
    return r


def cdp_unhover():
    for s in list(HOVERED):
        try:
            dims = lab_js(f"[L.surface({json.dumps(s)}).devicePixelRatio, L.surface({json.dumps(s)}).innerWidth, "
                          f"L.surface({json.dumps(s)}).innerHeight]", surface=s if s.startswith("vr:") else None)
            dpr, w, h = dims
            cdp_mouse(s, min(1400 / dpr, w - 1), min(900 / dpr, h - 1))
        except Exception:  # noqa: BLE001 - a closed popup
            pass
        HOVERED.discard(s)


def hover_spec(spec):
    """'SEL[,MS]' -> (SEL, MS)."""
    sel, _, ms = spec.rpartition(",")
    if sel and ms.strip().isdigit():
        return sel, int(ms)
    return spec, 0


def run_pre(pre, surface=None):
    """A command's --pre: JS, or '@hover SEL[,MS]' for a real CDP hover. Then the step's --hover, if any."""
    out = None
    if pre:
        if pre.startswith("@hover "):
            sel, ms = hover_spec(pre[7:].strip())
            out = cdp_hover(surface or "main", sel, ms or 300)
        else:
            out = lab_js(pre, surface=surface if surface and surface.startswith("vr:") else None)
    if STEP.get("hover"):
        sel, ms = hover_spec(STEP["hover"])
        cdp_hover(surface or "main", sel, ms or 300)
    return out


# ---------------------------------------------------------------- step options

FLAGS_FILE = "/tmp/lgs/flags.json"
FLAGS_LOCK = "/tmp/lgs/flags.lock"


class flags_file_lock:
    """Short flock around a read-modify-write of FLAGS_FILE (independent of the lab locks)."""

    def __enter__(self):
        self.f = flock_wait(FLAGS_LOCK, 30, "flags.lock")
        return self

    def __exit__(self, *a):
        try:
            fcntl.flock(self.f, fcntl.LOCK_UN)
        finally:
            self.f.close()


def read_flags_file():
    """The session flags object, or None when there is no file."""
    try:
        with open(FLAGS_FILE, encoding="utf-8") as f:
            txt = f.read()
    except OSError:
        return None
    try:
        v = json.loads(txt) if txt.strip() else {}
    except ValueError:
        return {}
    return v if isinstance(v, dict) else {}


def write_flags_file(obj):
    """Write the session flags (an empty object removes the file, as P1's `lgs flags` does)."""
    if not obj:
        try:
            os.remove(FLAGS_FILE)
        except OSError:
            pass
        return
    tmp = FLAGS_FILE + f".{os.getpid()}"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=1, sort_keys=True)
    os.replace(tmp, FLAGS_FILE)

STEP_JS_FLAGS = r"""
(async () => {
  const F = %s, st = (window.__LGS_LAB_STEP = window.__LGS_LAB_STEP || {});
  const rt = window.__LGS_RT;
  if (!rt) return 'no runtime';
  const t = rt.test && rt.test.flags;
  try {
    if (t && typeof t.push === 'function') {
      st.flagsTok = t.push(F, { ttlMs: 600000 });
      if (typeof rt.settled === 'function') await Promise.race([rt.settled(), new Promise((r) => setTimeout(r, 5000))]);
      return 'rt.test.flags.push';
    }
  } catch (e) { return 'runtime error: ' + e.message; }
  return 'runtime has no rt.test.flags';
})()
"""

STEP_JS_FLAGS_UNDO = r"""
(async () => {
  const st = window.__LGS_LAB_STEP || {}, rt = window.__LGS_RT;
  const t = rt && rt.test && rt.test.flags, tok = st.flagsTok;
  delete st.flagsTok;
  if (tok === undefined) return 'nothing to undo';
  try {
    if (t && typeof t.pop === 'function') {
      t.pop(tok);
      if (typeof rt.settled === 'function') await Promise.race([rt.settled(), new Promise((r) => setTimeout(r, 5000))]);
      return 'popped';
    }
  } catch (e) { return 'runtime error: ' + e.message; }
  return 'runtime gone';
})()
"""

# Never-list safety net (P1 runtime.md 3.6): Steam actions are logged, not run,
# for the whole locked step.
STEP_JS_ACTIONS = r"""
(() => {
  const rt = window.__LGS_RT, a = rt && rt.test && rt.test.actions;
  if (!a || typeof a.enable !== 'function') return 'no action logger';
  a.enable(%s, { ttlMs: 600000 });
  return 'action logger ' + (%s ? 'on' : 'off');
})()
"""

STEP_JS_MODE = r"""
(() => {
  const mode = %s, vr = mode === 'pad' ? 'gamepad' : 'laser';
  const st = (window.__LGS_LAB_STEP = window.__LGS_LAB_STEP || {});
  const rt = window.__LGS_RT;
  let via;
  if (rt && rt.input && rt.test && rt.test.input && typeof rt.test.input.set === 'function') {
    rt.test.input.set(mode, { vrMode: vr, ttlMs: 600000 });
    st.modeUndo = () => rt.test.input.set(null);
    via = 'rt.test.input.set';
  } else if (rt && rt.input && typeof rt.input.stub === 'function') {
    st.modeUndo = rt.input.stub(mode, { vrMode: vr, ttlMs: 600000 });
    via = 'rt.input.stub';
  } else {
    st.modePrev = [];
    for (const p of g_PopupManager.m_mapPopups.values()) {
      let w = null; try { w = p.window; } catch (_) { /* closing */ }
      if (!w || !w.document) continue;
      const h = w.document.documentElement;
      st.modePrev.push([h, h.classList.contains('lgs-input-pad'), h.classList.contains('lgs-input-laser'), h.getAttribute('data-lgs-vr-mode')]);
      h.classList.toggle('lgs-input-pad', mode === 'pad');
      h.classList.toggle('lgs-input-laser', mode === 'laser');
      h.setAttribute('data-lgs-vr-mode', vr);
    }
    via = 'classes (no rt.input)';
  }
  if (mode === 'pad') { try { SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.FocusApplicationRoot(); } catch (_) { /* no main */ } }
  st.mode = mode;
  return via;
})()
"""

STEP_JS_MODE_UNDO = r"""
(() => {
  const st = window.__LGS_LAB_STEP || {}, rt = window.__LGS_RT;
  let out = 'nothing';
  try {
    if (typeof st.modeUndo === 'function') { st.modeUndo(); out = 'stub restored'; }
    else if (rt && rt.input && typeof rt.input.stub === 'function' && st.modeUndo !== undefined) { rt.input.stub(null); out = 'stub cleared'; }
  } catch (e) { out = 'runtime error: ' + e.message; }
  for (const [h, pad, laser, attr] of st.modePrev || []) {
    h.classList.toggle('lgs-input-pad', pad);
    h.classList.toggle('lgs-input-laser', laser);
    if (attr === null) h.removeAttribute('data-lgs-vr-mode'); else h.setAttribute('data-lgs-vr-mode', attr);
    out = 'classes restored';
  }
  if (st.mode === 'laser') { try { window.__LGS_LAB.unhover && window.__LGS_LAB.unhover(); } catch (_) { /* fine */ } }
  delete st.modeUndo; delete st.modePrev; delete st.mode;
  return out;
})()
"""


class MediaHold:
    """Emulation.setEmulatedMedia on every Steam UI target (or the SteamVR
    page), held by open CDP sessions in a background thread; new popups are
    picked up once a second. Cleared explicitly, then the sessions close."""

    def __init__(self, media, vr_surface=None):
        feats = []
        if "reduce" in media:
            feats.append({"name": "prefers-reduced-motion", "value": "reduce"})
        if "contrast" in media:
            feats.append({"name": "prefers-contrast", "value": "more"})
        self.features = feats
        self.vr_surface = vr_surface
        self.ready = None
        self.stop_evt = None
        self.thread = None
        self.count = 0
        self.error = None

    def _targets(self):
        if self.vr_surface:
            return [vr_target(self.vr_surface)]
        out = []
        for t in lgs.targets():
            k = lgs.overlay_key(t)
            if t.get("type") == "page" and (k.startswith("valve.steam.gamepadui") or t["title"] == "SharedJSContext"):
                out.append(t)
        return out

    async def _run(self):
        sessions = {}
        try:
            while True:
                for t in self._targets():
                    u = t["webSocketDebuggerUrl"]
                    if u in sessions:
                        continue
                    try:
                        s = lgs.Session(u)
                        await s.__aenter__()
                        await s.send("Emulation.setEmulatedMedia", {"features": self.features}, 10)
                        sessions[u] = s
                    except Exception as e:  # noqa: BLE001 - a closing popup
                        self.error = str(e)
                self.count = len(sessions)
                self.ready.set()
                for _ in range(10):
                    if self.stop_evt.is_set():
                        return
                    await asyncio.sleep(0.1)
        finally:
            for s in sessions.values():
                try:
                    await s.send("Emulation.setEmulatedMedia", {"features": []}, 5)
                except Exception:  # noqa: BLE001
                    pass
                try:
                    await s.__aexit__()
                except Exception:  # noqa: BLE001
                    pass
            self.ready.set()

    def start(self):
        import threading
        self.ready = threading.Event()
        self.stop_evt = threading.Event()
        self.thread = threading.Thread(target=lambda: asyncio.run(self._run()), daemon=True)
        self.thread.start()
        self.ready.wait(15)
        time.sleep(0.2)  # let media-query listeners run
        return self.count

    def stop(self):
        if self.thread:
            self.stop_evt.set()
            self.thread.join(15)
            self.thread = None


class Step:
    """Applies one step's --flags/--mode/--media and undoes them."""

    def __init__(self, opts, vr=False, surface=None):
        self.surface = surface
        self.flags = dict(opts.get("flags") or {})
        self.mode = opts.get("mode")
        self.media = list(opts.get("media") or [])
        self.stock = bool(opts.get("stock"))
        self.stock_was_on = False
        self.vr = vr
        self.file_prev = None
        self.file_written = False
        self.own_prev = {}
        self.hold = None
        self.report = {}
        self.actions = False

    def apply(self):
        if self.stock and not self.vr:
            # --stock: the stock UI for this step (theme off), given back at the lock exit.
            try:
                self.stock_was_on = lgs.is_on()
                if self.stock_was_on:
                    lgs.op("off", quiet=True)
                    time.sleep(0.4)
                self.report["stock"] = "theme off" + ("" if self.stock_was_on else " (was off)")
            except Exception as e:  # noqa: BLE001
                self.report["stock"] = f"error: {e}"
        if not self.vr:
            try:
                r = lgs.run_js("SharedJSContext", STEP_JS_ACTIONS % ("true", "true"), 10)
                self.actions = r == "action logger on"
            except Exception:  # noqa: BLE001 - never block a step on it
                pass
        if not (self.flags or self.mode or self.media):
            if self.report:
                self.report["native"] = native_on()
                print("step: " + "  ".join(f"{k}={v}" for k, v in self.report.items()), file=sys.stderr)
            return
        if self.flags:
            # The flags file has its own lock (review R1 m1): a lab.lock step and a lab-vr.lock step can both
            # be running; each one records only its own keys' previous values and restores only those.
            with flags_file_lock():
                cur = read_flags_file()
                self.file_prev = None if cur is None else dict(cur)
                cur = dict(cur or {})
                self.own_prev = {k: (k in cur, cur.get(k)) for k in self.flags}
                cur.update(self.flags)
                write_flags_file(cur)
                self.file_written = True
            via = "file only (vr step)" if self.vr else lab_js(STEP_JS_FLAGS % json.dumps(self.flags))
            self.report["flags"] = f"{json.dumps(self.flags)} via {via} + {FLAGS_FILE}"
        if self.mode:
            self.report["mode"] = f"{self.mode} via " + ("(not for vr: steps)" if self.vr else
                                                        lab_js(STEP_JS_MODE % json.dumps(self.mode)))
        if self.media:
            self.hold = MediaHold(self.media, vr_surface=self.surface if self.vr else None)
            n = self.hold.start()
            self.report["media"] = f"{','.join(self.media)} on {n} targets"
        self.report["native"] = native_on()
        print("step: " + "  ".join(f"{k}={v}" for k, v in self.report.items()), file=sys.stderr)

    def undo(self):
        errs = []
        if self.hold:
            try:
                self.hold.stop()
            except Exception as e:  # noqa: BLE001
                errs.append(f"media: {e}")
        if self.mode and not self.vr:
            try:
                lab_js(STEP_JS_MODE_UNDO)
            except Exception as e:  # noqa: BLE001
                errs.append(f"mode: {e}")
        if self.flags:
            if not self.vr:
                try:
                    lab_js(STEP_JS_FLAGS_UNDO)
                except Exception as e:  # noqa: BLE001
                    errs.append(f"flags: {e}")
            if self.file_written:
                prev = {}
                try:
                    with flags_file_lock():
                        cur = dict(read_flags_file() or {})
                        for k, (had, v) in self.own_prev.items():
                            if had:
                                cur[k] = v
                            else:
                                cur.pop(k, None)
                        write_flags_file(cur)          # empty -> no file (as P1's `lgs flags`)
                        prev = cur
                    self.file_written = False
                except OSError as e:
                    errs.append(f"flags file: {e}")
                # A runtime reload during the step (another agent's `lgs on`, which takes no lab lock) bakes the
                # step's file into the runtime's session layer: give the runtime the restored content (REQ P2->P10).
                if not self.vr:
                    try:
                        lab_js("(() => { const rt = window.__LGS_RT; if (!rt || !rt.flags || typeof rt.flags.setSession !== 'function') "
                               "return 'no runtime'; rt.flags.setSession(" + json.dumps(prev) + "); return 'session set'; })()")
                    except Exception as e:  # noqa: BLE001
                        errs.append(f"flags session: {e}")
        if self.actions:
            try:
                lgs.run_js("SharedJSContext", STEP_JS_ACTIONS % ("false", "false"), 10)
            except Exception as e:  # noqa: BLE001
                errs.append(f"action logger: {e}")
        if self.stock_was_on:
            try:
                lgs.op("on", quiet=True)
            except Exception as e:  # noqa: BLE001
                errs.append(f"theme on: {e}")
        if errs:
            print("step undo: " + "; ".join(errs), file=sys.stderr)


def native_on():
    """'on' / 'off' / 'unknown': the native layer's state (lgs_shell.status), for evidence labels (review R1 m2)."""
    try:
        import lgs_shell
        st = lgs_shell.status()
    except Exception:  # noqa: BLE001
        return "unknown"
    nat = st.get("native") if isinstance(st, dict) else None
    if isinstance(nat, dict):
        return "on" if nat.get("enabled") else "off"
    return "on" if nat else "off"


def steam_build():
    """Steam client build id (the number Valve's own bundle carries, e.g.
    11094443), cached per library.js mtime."""
    import collections
    import re
    lib = os.path.expanduser("~/.steam/steam/steamui/library.js")
    cache = "/tmp/lgs/steam-build.json"
    try:
        mt = os.path.getmtime(lib)
    except OSError:
        return "unknown"
    try:
        with open(cache, encoding="utf-8") as f:
            c = json.load(f)
        if c.get("mtime") == mt:
            return c["build"]
    except (OSError, ValueError, KeyError):
        pass
    with open(lib, "rb") as f:
        data = f.read()
    hits = collections.Counter(re.findall(rb'var [A-Za-z_$]{1,2}="(\d{7,9})"', data))
    build = hits.most_common(1)[0][0].decode() if hits else "unknown"
    try:
        os.makedirs("/tmp/lgs", exist_ok=True)
        with open(cache, "w", encoding="utf-8") as f:
            json.dump({"mtime": mt, "build": build}, f)
    except OSError:
        pass
    return build


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


STEP = {"flags": {}, "mode": None, "media": [], "stock": False, "hover": None}


def parse_step(args):
    """Step options (docs/phase2/contracts/lab.md section 1), valid on every
    command: --flags a,b,c=v  --mode laser|pad  --media reduce|contrast.
    Removed from args; applied inside the lock."""
    raw = opt(args, "--flags")
    if raw:
        for part in raw.split(","):
            part = part.strip()
            if not part:
                continue
            k, _, v = part.partition("=")
            if not v:
                STEP["flags"][k] = True
            else:
                try:
                    STEP["flags"][k] = json.loads(v)
                except ValueError:
                    STEP["flags"][k] = v
    mode = opt(args, "--mode")
    if mode:
        if mode not in ("laser", "pad"):
            raise SystemExit("lab: --mode laser|pad")
        STEP["mode"] = mode
    if flag(args, "--stock"):
        STEP["stock"] = True
    hv = opt(args, "--hover")       # SEL[,MS]: a real CDP hover after the command's pre (REQ C1c->P10)
    if hv:
        STEP["hover"] = hv
    media = opt(args, "--media")
    if media:
        for m in media.split(","):
            if m not in ("reduce", "contrast"):
                raise SystemExit("lab: --media reduce|contrast")
            STEP["media"].append(m)


def main(argv):
    args = argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return
    cmd = args.pop(0)
    parse_step(args)
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
            run_pre(None, where)
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
            # A before-shot (--theme off) gives the theme back at the end of its step (P10:
            # the shared device is left as found; the theme was left off in Phase 1).
            restore_on = theme == "off" and not surface.startswith("vr:") and lgs.is_on()
            try:
                set_theme(theme, surface)
                if route:
                    lab_js(f"L.nav({json.dumps(route)})")
                    time.sleep(1.2)
                if pre or STEP.get("hover"):
                    print("pre:", run_pre(pre, surface))
                    time.sleep(0.6)
                asyncio.run(capture(surface, out, settle))
                if go_back:
                    lab_js("L.back()")
            finally:
                if restore_on:
                    set_theme("on", surface)
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
        stock_route = opt(args, "--stock-route")
        pre = opt(args, "--pre")
        as_json = flag(args, "--json")
        surface = args[0]
        with Lock(surface=surface):
            if route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(1.2)
            if pre or STEP.get("hover"):
                print("pre:", run_pre(pre, surface))
                time.sleep(0.6)
            set_theme("off", surface)
            time.sleep(0.4)
            if stock_route:          # Phase 2 (P10): our route themed vs another route stock (REQ C2a->P10 #4)
                lab_js(f"L.nav({json.dumps(stock_route)})")
                time.sleep(1.2)
            lab_js(f"(window.__LGS_AUDIT = L.snap({json.dumps(surface)}), 1)", surface=surface)
            set_theme("on", surface)
            time.sleep(0.8)
            if stock_route:
                lab_js(f"L.nav({json.dumps(route)})")
                time.sleep(1.2)
                if pre:
                    run_pre(pre, surface)
                    time.sleep(0.6)
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
    elif cmd in ("native-session", "hv-grab", "gates", "pad-bfs", "focus", "motion", "sgcheck", "conformance",
                 "cmp-rects"):
        sys.modules.setdefault("lab", sys.modules[__name__])   # one module state (STEP, Lock) when run as a script
        import lab_p2cmd
        lab_p2cmd.run(cmd, args)
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    try:
        main(sys.argv)
    except RuntimeError as e:
        print(f"lab: {e}", file=sys.stderr)
        sys.exit(1)
