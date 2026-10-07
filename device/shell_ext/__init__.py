"""Glass Shell daemon plugins: the action registry behind the `lgsAction` binding.

Steam-side code calls  window.lgsAction(JSON.stringify({id, type, args, src}))
in SharedJSContext. lgs_shell.py hands every call to Registry.call(), which
validates it strictly (size, JSON, id, type, source, argument schema, flag,
rate) and runs the plugin that registered the type. The reply goes back to
Steam through __LGS_RT.bridge 'reply' (docs/phase2/contracts/daemon.md §5).

Plugins are device/shell_ext/<name>.py files owned by the packages that write
them. Each defines ACTIONS = {type: spec} and `async def run(ctx, type, args)`;
optionally `async def tick(ctx)` (once a second) and `async def stop(ctx)`
(teardown: undo everything). A plugin that fails to import is listed as
failed; the others keep working. Files are re-imported when they change.

This module has no side effects on import and needs nothing outside the
standard library, so it can be unit tested offline (Registry.selftest()).
"""
import asyncio
import collections
import importlib.util
import json
import math
import os
import re
import time
import traceback

HERE = os.path.dirname(os.path.realpath(__file__))

MAX_PAYLOAD = 4096
ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")
TYPE_RE = re.compile(r"^[a-z][a-z0-9_]{0,31}(\.[a-z][a-z0-9_]{0,31})?$")
# Steam window kinds a call may name as its source (contract §5)
SOURCES = ("main", "bar", "barpopup", "frame.menu", "floatingfooter", "keyboard", "notifications",
           "tooltip", "volumelevel", "ccpopup")
KINDS = ("echo", "read", "ui", "nav", "launch")
DRY_KINDS = ("nav", "launch")          # never run while actionsDryRun or the runtime's action logger is on
DEFAULT_RATE = 1.0                     # s between accepted calls of one type
GLOBAL_LIMIT, GLOBAL_WINDOW = 20, 10.0  # accepted calls in any window
DEFAULT_TIMEOUT = 10.0
ARG_TYPES = ("str", "int", "num", "bool", "enum")
SPEC_KEYS = {"args", "sources", "rate", "kind", "flag", "timeout"}
ARG_KEYS = {"type", "optional", "max", "re", "min", "values"}
STR_MAX = 256


class ActionError(Exception):
    def __init__(self, code, detail=None):
        super().__init__(code)
        self.code = code
        self.detail = detail


# ------------------------------------------------------------------ specs and validation

def check_spec(atype, spec):
    """A plugin's ACTIONS entry, normalised; ValueError when it is malformed
    (the plugin is then refused as a whole: a typo must not open a hole)."""
    if not isinstance(atype, str) or not TYPE_RE.match(atype):
        raise ValueError(f"bad action type name {atype!r}")
    if not isinstance(spec, dict):
        raise ValueError(f"{atype}: spec is not a dict")
    extra = set(spec) - SPEC_KEYS
    if extra:
        raise ValueError(f"{atype}: unknown spec keys {sorted(extra)}")
    args = spec.get("args", {})
    if not isinstance(args, dict):
        raise ValueError(f"{atype}: args is not a dict")
    norm_args = {}
    for k, a in args.items():
        if not isinstance(k, str) or not re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,31}$", k):
            raise ValueError(f"{atype}: bad arg name {k!r}")
        if not isinstance(a, dict) or a.get("type") not in ARG_TYPES:
            raise ValueError(f"{atype}.{k}: type must be one of {ARG_TYPES}")
        if set(a) - ARG_KEYS:
            raise ValueError(f"{atype}.{k}: unknown keys {sorted(set(a) - ARG_KEYS)}")
        b = dict(a)
        if b["type"] == "str":
            b["max"] = int(b.get("max", STR_MAX))
            if "re" in b:
                b["re_c"] = re.compile(b["re"])
        if b["type"] == "enum":
            vals = b.get("values")
            if not isinstance(vals, (list, tuple)) or not vals:
                raise ValueError(f"{atype}.{k}: enum needs values")
            b["values"] = list(vals)
        norm_args[k] = b
    sources = spec.get("sources", ["main"])
    if sources == "*":
        sources = list(SOURCES)
    if not isinstance(sources, (list, tuple)) or not sources or any(s not in SOURCES for s in sources):
        raise ValueError(f"{atype}: sources must be a non-empty subset of {SOURCES}")
    kind = spec.get("kind", "nav")
    if kind not in KINDS:
        raise ValueError(f"{atype}: kind must be one of {KINDS}")
    rate = float(spec.get("rate", DEFAULT_RATE))
    timeout = float(spec.get("timeout", DEFAULT_TIMEOUT))
    if not (0 <= rate <= 3600) or not (0 < timeout <= 120):
        raise ValueError(f"{atype}: rate or timeout out of range")
    flag = spec.get("flag")
    if flag is not None and not isinstance(flag, str):
        raise ValueError(f"{atype}: flag must be a string")
    return {"args": norm_args, "sources": list(sources), "kind": kind, "rate": rate,
            "timeout": timeout, "flag": flag}


def validate_args(schema, args):
    """Exactly the schema: no unknown keys, required keys present, types,
    ranges and patterns. Returns a clean dict; raises ActionError('bad-args')."""
    if args is None:
        args = {}
    if not isinstance(args, dict):
        raise ActionError("bad-args", "args is not an object")
    extra = set(args) - set(schema)
    if extra:
        raise ActionError("bad-args", f"unknown args {sorted(extra)[:5]}")
    out = {}
    for k, a in schema.items():
        if k not in args:
            if a.get("optional"):
                continue
            raise ActionError("bad-args", f"missing {k}")
        v = args[k]
        t = a["type"]
        if t == "str":
            if not isinstance(v, str) or len(v) > a["max"]:
                raise ActionError("bad-args", f"{k}: string of at most {a['max']} chars expected")
            if "re_c" in a and not a["re_c"].fullmatch(v):
                raise ActionError("bad-args", f"{k}: does not match {a['re']}")
        elif t in ("int", "num"):
            if isinstance(v, bool) or not isinstance(v, (int, float)) or \
                    (t == "int" and not (isinstance(v, int) or (isinstance(v, float) and v.is_integer()))):
                raise ActionError("bad-args", f"{k}: {t} expected")
            if isinstance(v, float) and not math.isfinite(v):
                raise ActionError("bad-args", f"{k}: not finite")
            if t == "int":
                v = int(v)
            if "min" in a and v < a["min"] or "max" in a and v > a["max"]:
                raise ActionError("bad-args", f"{k}: out of range")
        elif t == "bool":
            if not isinstance(v, bool):
                raise ActionError("bad-args", f"{k}: bool expected")
        elif t == "enum":
            if isinstance(v, bool) or v not in a["values"]:
                raise ActionError("bad-args", f"{k}: one of {a['values']} expected")
        out[k] = v
    return out


# ------------------------------------------------------------------ per-plugin context

class Ctx:
    """What a plugin may use. `host` is the daemon (lgs_shell.Shell) or a test
    double with the same methods."""

    def __init__(self, host, name):
        self._host = host
        self.name = name
        self.state = {}

    async def steam_eval(self, expr, timeout=10):
        return await self._host.ext_steam_eval(expr, timeout)

    async def vr_eval(self, page, expr, timeout=10):
        return await self._host.ext_vr_eval(page, expr, timeout)

    def vr_pages(self):
        return self._host.ext_vr_pages()

    @property
    def flags(self):
        return dict(self._host.ext_flags())

    @property
    def dry(self):
        return bool(self._host.ext_flags().get("actionsDryRun"))

    @property
    def geom(self):
        return self._host.ext_geom()

    @property
    def page(self):
        return self._host.ext_page()

    def log(self, msg):
        self._host.ext_log(f"ext {self.name}: {msg}")


# ------------------------------------------------------------------ built-in actions

async def _echo(ctx, atype, args, call):
    return {"echo": args.get("text", ""), "src": call.get("src"), "at": time.time()}


BUILTIN = {
    "echo": ({"args": {"text": {"type": "str", "max": 200, "optional": True}},
              "sources": "*", "rate": 0.2, "kind": "echo"}, _echo),
}


# ------------------------------------------------------------------ the registry

class Registry:
    def __init__(self, host, plugin_dir=HERE, builtin=True, clock=time.monotonic):
        self.host = host
        self.dir = plugin_dir
        self.clock = clock
        self.plugins = {}        # name -> {"mod", "mtime", "ctx", "types"}
        self.failed = {}         # name -> error
        self.types = {}          # type -> (plugin name, spec, fn)
        self.last_ok = {}        # type -> clock of the last accepted call
        self.recent = collections.deque()   # clocks of accepted calls (global limit)
        self.inflight = set()
        self.calls = 0
        self.rejected = collections.deque(maxlen=10)
        self.log_ring = collections.deque(maxlen=20)
        self.scan_at = 0.0
        if builtin:
            ctx = Ctx(host, "builtin")
            types = {}
            for t, (spec, fn) in BUILTIN.items():
                s = check_spec(t, spec)
                self.types[t] = ("builtin", s, (lambda f: (lambda c, ty, a, call: f(c, ty, a, call)))(fn))
                types[t] = s
            self.plugins["builtin"] = {"mod": None, "mtime": None, "ctx": ctx, "types": sorted(types)}

    def add_builtin(self, atype, spec, fn):
        """A daemon-provided action: fn(ctx, type, args, call) -> result."""
        s = check_spec(atype, spec)
        if atype in self.types:
            raise ValueError(f"type {atype!r} already registered")
        self.types[atype] = ("builtin", s, fn)
        self.plugins["builtin"]["types"] = sorted(set(self.plugins["builtin"]["types"]) | {atype})

    # ---------------------------------------------------------------- loading
    def files(self):
        try:
            names = sorted(os.listdir(self.dir))
        except OSError:
            return {}
        out = {}
        for n in names:
            if n.endswith(".py") and not n.startswith(("_", ".")):
                p = os.path.join(self.dir, n)
                try:
                    out[n[:-3]] = (p, os.stat(p).st_mtime_ns)
                except OSError:
                    pass
        return out

    async def scan(self, force=False):
        """Load new or changed plugins, unload removed ones. Cheap when nothing
        changed; the daemon calls it once a second. Returns what changed."""
        now = self.clock()
        if not force and now - self.scan_at < 1.0:
            return []
        self.scan_at = now
        changed = []
        files = self.files()
        for name in [n for n in self.plugins if n != "builtin" and n not in files]:
            await self._unload(name)
            changed.append(f"-{name}")
        for name in [n for n in self.failed if n not in files]:
            del self.failed[name]
        for name, (path, mtime) in files.items():
            cur = self.plugins.get(name)
            if cur and cur["mtime"] == mtime:
                continue
            if name in self.failed and self.failed[name][0] == mtime:
                continue
            if cur:
                await self._unload(name)
            err = self._load(name, path, mtime)
            changed.append(f"+{name}" if not err else f"!{name}")
        return changed

    def _load(self, name, path, mtime):
        try:
            spec = importlib.util.spec_from_file_location(f"lgs_shell_ext_{name}", path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            actions = getattr(mod, "ACTIONS", None)
            run = getattr(mod, "run", None)
            if not isinstance(actions, dict) or not actions:
                raise ValueError("no ACTIONS dict")
            if not callable(run) or not asyncio.iscoroutinefunction(run):
                raise ValueError("run must be an async function run(ctx, type, args)")
            specs = {}
            for t, s in actions.items():
                if t in self.types:
                    raise ValueError(f"type {t!r} already registered by {self.types[t][0]}")
                specs[t] = check_spec(t, s)
        except Exception as e:  # noqa: BLE001 - a broken plugin must not stop the daemon
            msg = f"{type(e).__name__}: {e}"[:300]
            self.failed[name] = (mtime, msg)
            self._log(f"plugin {name} failed to load: {msg}")
            return msg
        ctx = Ctx(self.host, name)
        for t, s in specs.items():
            self.types[t] = (name, s, (lambda f: (lambda c, ty, a, call: f(c, ty, a)))(run))
        self.plugins[name] = {"mod": mod, "mtime": mtime, "ctx": ctx, "types": sorted(specs)}
        self.failed.pop(name, None)
        self._log(f"plugin {name} loaded: {', '.join(sorted(specs))}")
        return None

    async def _unload(self, name):
        p = self.plugins.pop(name, None)
        if not p:
            return
        for t in p["types"]:
            self.types.pop(t, None)
        await self._call_hook(name, p, "stop")
        self._log(f"plugin {name} unloaded")

    async def _call_hook(self, name, p, hook):
        fn = getattr(p.get("mod"), hook, None) if p.get("mod") else None
        if fn is None or not asyncio.iscoroutinefunction(fn):
            return
        try:
            await asyncio.wait_for(fn(p["ctx"]), 10)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001
            self._log(f"plugin {name} {hook}: {e!r}")

    async def tick(self):
        for name, p in list(self.plugins.items()):
            await self._call_hook(name, p, "tick")

    async def stop(self):
        for name in [n for n in self.plugins if n != "builtin"]:
            await self._unload(name)

    # ---------------------------------------------------------------- calls
    def _log(self, msg):
        self.log_ring.append(time.strftime("%H:%M:%S ") + msg)
        try:
            self.host.ext_log(msg)
        except Exception:  # noqa: BLE001
            pass

    def _reject(self, cid, code, detail, call):
        rec = {"id": cid, "type": (call or {}).get("type") if isinstance(call, dict) else None,
               "src": (call or {}).get("src") if isinstance(call, dict) else None,
               "error": code, "detail": detail, "at": time.strftime("%H:%M:%S")}
        self.rejected.append(rec)
        self._log(f"action {cid} {rec['type']} from {rec['src']}: rejected {code}" + (f" ({detail})" if detail else ""))
        return {"id": cid, "ok": False, "error": code, **({"detail": detail} if detail else {})}

    async def call(self, payload, from_default_context=True):
        """One binding call. Returns the reply dict, or None when no id could be
        read (nothing can be answered then; it is still logged)."""
        self.calls += 1
        call = None
        cid = None
        try:
            if not isinstance(payload, str) or len(payload.encode("utf-8", "replace")) > MAX_PAYLOAD:
                raise ActionError("too-big")
            try:
                call = json.loads(payload)
            except ValueError:
                raise ActionError("bad-json") from None
            if not isinstance(call, dict):
                raise ActionError("bad-json", "not an object")
            cid = call.get("id")
            if not isinstance(cid, str) or not ID_RE.match(cid):
                cid = None
                raise ActionError("bad-id")
            extra = set(call) - {"id", "type", "args", "src"}
            if extra:
                raise ActionError("bad-json", f"unknown keys {sorted(extra)[:5]}")
            atype = call.get("type")
            if not isinstance(atype, str) or atype not in self.types:
                raise ActionError("unknown-type", str(atype)[:40] if atype is not None else None)
            pname, spec, fn = self.types[atype]
            src = call.get("src")
            if not from_default_context:
                raise ActionError("bad-source", "not SharedJSContext's default context")
            if not isinstance(src, str) or src not in spec["sources"]:
                raise ActionError("bad-source", f"{str(src)[:40]} not in {spec['sources']}")
            args = validate_args(spec["args"], call.get("args"))
            flags = self.host.ext_flags()
            if spec["flag"] and not flags.get(spec["flag"]):
                raise ActionError("flag-off", spec["flag"])
            now = self.clock()
            while self.recent and now - self.recent[0] > GLOBAL_WINDOW:
                self.recent.popleft()
            if atype in self.inflight:
                raise ActionError("busy")
            last = self.last_ok.get(atype)
            if last is not None and now - last < spec["rate"]:
                raise ActionError("rate", f"{spec['rate']} s between calls")
            if len(self.recent) >= GLOBAL_LIMIT:
                raise ActionError("rate", f"{GLOBAL_LIMIT} calls in {GLOBAL_WINDOW:g} s")
            self.last_ok[atype] = now
            self.recent.append(now)
        except ActionError as e:
            return self._reject(cid, e.code, e.detail, call) if cid else (self._reject(None, e.code, e.detail, call) and None)
        if spec["kind"] in DRY_KINDS:
            why = "actionsDryRun" if flags.get("actionsDryRun") else None
            if why is None:
                try:      # the runtime's action logger (P1 rt.test.actions): on in every lab step
                    if await self.host.ext_actions_logger(atype, args):
                        why = "runtime action logger"
                except Exception as e:  # noqa: BLE001 - cannot tell: do not run
                    why = f"logger check failed: {e!r}"[:80]
            if why:
                self._log(f"action {cid} {atype} from {src}: dry run ({why}), args {json.dumps(args)[:200]}")
                return {"id": cid, "ok": True, "dry": True, "result": None}
        ctx = self.plugins.get(pname, {}).get("ctx") or Ctx(self.host, pname)
        self.inflight.add(atype)
        try:
            result = await asyncio.wait_for(fn(ctx, atype, args, call), spec["timeout"])
            json.dumps(result)          # must be serialisable
        except asyncio.TimeoutError:
            return self._reject(cid, "timeout", f"{spec['timeout']:g} s", call)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001 - a plugin bug is answered, never fatal
            tb = traceback.format_exc().strip().splitlines()[-1]
            return self._reject(cid, "plugin-error", f"{e!r}"[:200] or tb[:200], call)
        finally:
            self.inflight.discard(atype)
        self._log(f"action {cid} {atype} from {src}: ok")
        return {"id": cid, "ok": True, "result": result}

    def status(self):
        return {"types": sorted(self.types), "plugins": {n: p["types"] for n, p in self.plugins.items()},
                "failed": {n: e for n, (_, e) in self.failed.items()}, "calls": self.calls,
                "rejected": list(self.rejected), "dryRun": bool(self.host.ext_flags().get("actionsDryRun"))}


# ------------------------------------------------------------------ offline self-test

class _TestHost:
    def __init__(self):
        self.flags = {}
        self.lines = []

    async def ext_steam_eval(self, expr, timeout=10):
        return None

    async def ext_vr_eval(self, page, expr, timeout=10):
        return None

    def ext_vr_pages(self):
        return []

    def ext_flags(self):
        return self.flags

    def ext_geom(self):
        return None

    def ext_page(self):
        return None

    def ext_log(self, msg):
        self.lines.append(msg)

    async def ext_actions_logger(self, atype, args):
        return bool(self.flags.get("_logger"))


def selftest(tmpdir):
    """Offline checks of the validator, the rate limits and plugin loading.
    Returns (passed, failed, details)."""
    results = []

    def check(name, cond, info=""):
        results.append((name, bool(cond), info))

    clock = [100.0]
    host = _TestHost()
    # a test plugin with every arg type, a flagged action and a broken twin
    os.makedirs(tmpdir, exist_ok=True)
    with open(os.path.join(tmpdir, "probe.py"), "w", encoding="utf-8") as f:
        f.write(
            "ACTIONS = {\n"
            " 'probe.nav': {'args': {'app': {'type': 'str', 're': r'^steam\\.app\\.\\d{1,10}$'},\n"
            "                        'n': {'type': 'int', 'min': 0, 'max': 9, 'optional': True},\n"
            "                        'mode': {'type': 'enum', 'values': ['a', 'b'], 'optional': True},\n"
            "                        'on': {'type': 'bool', 'optional': True}},\n"
            "               'sources': ['main'], 'kind': 'nav', 'rate': 1.0},\n"
            " 'probe.flagged': {'args': {}, 'kind': 'read', 'flag': 'wp.test', 'rate': 0},\n"
            " 'probe.boom': {'args': {}, 'kind': 'read', 'rate': 0},\n"
            " 'probe.slow': {'args': {}, 'kind': 'read', 'rate': 0, 'timeout': 0.05},\n"
            "}\n"
            "import asyncio\n"
            "async def run(ctx, type, args):\n"
            "    if type == 'probe.boom':\n"
            "        raise RuntimeError('boom')\n"
            "    if type == 'probe.slow':\n"
            "        await asyncio.sleep(1)\n"
            "    return {'type': type, 'args': args}\n")
    with open(os.path.join(tmpdir, "broken.py"), "w", encoding="utf-8") as f:
        f.write("ACTIONS = {'Bad Name': {}}\nasync def run(ctx, t, a):\n    return 1\n")
    with open(os.path.join(tmpdir, "dupe.py"), "w", encoding="utf-8") as f:
        f.write("ACTIONS = {'echo': {'args': {}}}\nasync def run(ctx, t, a):\n    return 1\n")
    reg = Registry(host, plugin_dir=tmpdir, clock=lambda: clock[0])

    async def go():
        await reg.scan(force=True)
        check("plugin loaded", "probe" in reg.plugins and "probe.nav" in reg.types)
        check("broken plugin refused", "broken" in reg.failed and "Bad Name" not in reg.types)
        check("duplicate type refused", "dupe" in reg.failed and reg.types["echo"][0] == "builtin")

        def mk(**kw):
            return json.dumps(kw)

        r = await reg.call(mk(id="e1", type="echo", args={"text": "hi"}, src="bar"))
        check("echo", r and r["ok"] and r["result"]["echo"] == "hi" and r["result"]["src"] == "bar", r)
        r = await reg.call(mk(id="u1", type="nope", args={}, src="main"))
        check("unknown type", r and r["error"] == "unknown-type", r)
        r = await reg.call(mk(id="s1", type="probe.nav", args={"app": "steam.app.620980"}, src="bar"))
        check("wrong source", r and r["error"] == "bad-source", r)
        r = await reg.call(mk(id="s2", type="probe.nav", args={"app": "steam.app.620980"}, src="main"),
                           from_default_context=False)
        check("wrong context", r and r["error"] == "bad-source", r)
        r = await reg.call(mk(id="s3", type="probe.nav", args={"app": "steam.app.620980"}))
        check("missing source", r and r["error"] == "bad-source", r)
        for bad, why in ((
                {"app": "steam.app.62x"}, "pattern"), ({"app": "steam.app.1", "x": 1}, "unknown key"),
                ({}, "missing"), ({"app": 5}, "type"), ({"app": "steam.app.1", "n": 10}, "range"),
                ({"app": "steam.app.1", "n": True}, "bool as int"), ({"app": "steam.app.1", "mode": "c"}, "enum"),
                ({"app": "steam.app.1", "on": 1}, "int as bool"), ({"app": "steam.app.1", "n": 1.5}, "float as int")):
            r = await reg.call(mk(id="a1", type="probe.nav", args=bad, src="main"))
            check(f"bad args: {why}", r and r["error"] == "bad-args", r)
        r = await reg.call(mk(id="n1", type="probe.nav", args={"app": "steam.app.620980", "n": 3}, src="main"))
        check("valid call runs", r and r["ok"] and r["result"]["args"] == {"app": "steam.app.620980", "n": 3}, r)
        r = await reg.call(mk(id="n2", type="probe.nav", args={"app": "steam.app.620980"}, src="main"))
        check("rate limit", r and r["error"] == "rate", r)
        clock[0] += 1.01
        host.flags["actionsDryRun"] = True
        r = await reg.call(mk(id="n3", type="probe.nav", args={"app": "steam.app.620980"}, src="main"))
        check("dry run: nav not executed", r and r["ok"] and r.get("dry") and r["result"] is None, r)
        host.flags.pop("actionsDryRun")
        clock[0] += 1.01
        host.flags["_logger"] = True
        r = await reg.call(mk(id="n4", type="probe.nav", args={"app": "steam.app.620980"}, src="main"))
        check("dry run: runtime action logger on", r and r["ok"] and r.get("dry"), r)
        host.flags.pop("_logger")
        r = await reg.call(mk(id="f1", type="probe.flagged", args={}, src="main"))
        check("flag off refused", r and r["error"] == "flag-off", r)
        host.flags["wp.test"] = True
        r = await reg.call(mk(id="f2", type="probe.flagged", args={}, src="main"))
        check("flag on runs", r and r["ok"], r)
        r = await reg.call(mk(id="b1", type="probe.boom", args={}, src="main"))
        check("plugin error answered", r and r["error"] == "plugin-error", r)
        r = await reg.call(mk(id="t1", type="probe.slow", args={}, src="main"))
        check("timeout answered", r and r["error"] == "timeout", r)
        r = await reg.call("x" * (MAX_PAYLOAD + 1))
        check("too big: no reply", r is None)
        r = await reg.call("{not json")
        check("bad json: no reply", r is None)
        r = await reg.call(mk(id="bad id!", type="echo", args={}, src="main"))
        check("bad id: no reply", r is None)
        r = await reg.call(mk(id="k1", type="echo", args={}, src="main", extra=1))
        check("unknown top-level key", r and r["error"] == "bad-json", r)
        clock[0] += 20
        n_ok = 0
        for i in range(25):
            clock[0] += 0.21
            r = await reg.call(mk(id=f"g{i}", type="echo", args={}, src="main"))
            n_ok += bool(r and r["ok"])
        check("global limit 20 per 10 s", n_ok == 20, n_ok)
        check("rejections logged", len(reg.rejected) == 10 and reg.rejected[-1]["error"] == "rate")
        # reload on change and unload on removal
        with open(os.path.join(tmpdir, "probe.py"), "a", encoding="utf-8") as f:
            f.write("\n# changed\n")
        st = os.stat(os.path.join(tmpdir, "probe.py"))
        os.utime(os.path.join(tmpdir, "probe.py"), ns=(st.st_atime_ns, st.st_mtime_ns + 10 ** 9))
        ch = await reg.scan(force=True)
        check("reload on change", "+probe" in ch and "probe.nav" in reg.types, ch)
        os.remove(os.path.join(tmpdir, "probe.py"))
        ch = await reg.scan(force=True)
        check("unload on removal", "-probe" in ch and "probe.nav" not in reg.types, ch)
        await reg.stop()
        check("stop keeps builtin", list(reg.plugins) == ["builtin"])

    asyncio.run(go())
    for n in ("broken.py", "dupe.py"):
        try:
            os.remove(os.path.join(tmpdir, n))
        except OSError:
            pass
    passed = sum(1 for _, ok, _ in results if ok)
    return passed, len(results) - passed, results
