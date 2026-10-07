#!/usr/bin/env python3
"""PC-side driver for Glass Shell (Liquid Glass theme for the Steam Frame UI).

Talks to the headset through the steam-frame-ssh skill's helper (pinned host
key, STEAMFRAME_SSH_PASSWORD), the same way the run-liquid-glass-frame driver
does.

  python glass.py check                     headset reachable? Steam devtools up?
  python glass.py sync [SUB...]             upload device/ theme/ lab/ native/ (sources),
                                            or only the named subtrees (sync lab)
  python glass.py native-build [fake]       build glassd on the Frame into
                                            ~/.local/share/glass-shell/native/glassd/glassd
                                            ("fake": the stand-in native/spike/fakeglassd)
  python glass.py shell [status|start|stop|log] [ARGS]
                                            the lgs-shell unit (native layer daemon);
                                            start passes ARGS (--native, --glassd PATH,
                                            --glassd-args "...", --feed, --stay) on
  python glass.py install                   sync + add "Liquid Glass" to + > Launch Program
  python glass.py uninstall                 theme off, remove launcher and files
  python glass.py on|off|toggle|reload|status
  python glass.py toast "text"
  python glass.py shot SURF NAME [--route R] [--pre JS] [--theme on|off|keep]
                                 [--settle S] [--back]
                                            capture SURF to shots/NAME.png
  python glass.py perf SURF [--route R] [--pre JS] [--seconds S] [--ab stock|theme [--rounds N]]
                                            theme off vs on frame pacing while scrolling;
                                            --ab: PLAN R2-13's ABBA verdict (contracts/lab.md)
  python glass.py audit SURF [--route R] [--pre JS] [--json]
                                            stock-vs-themed regression diff
  python glass.py outline SURF [--route R] [--sel S] [--depth N] [--max N]
  python glass.py styles SURF SELECTOR
  python glass.py classes REGEX
  python glass.py click SURF SELECTOR
  python glass.py js 'EXPR'                 eval in SharedJSContext, L = lab helpers
  python glass.py route | nav ROUTE | back | surfaces
  python glass.py logs
  python glass.py selftest [RT-1,...] [--mode=pad|laser] [--json]
                                            P1's runtime selftest; JSON -> shots/p1-selftest.json

Phase 2 verification tools (P10; interface: docs/phase2/contracts/lab.md; exit 0 pass, 1 fail, 2 usage,
3 blocked). Offline (no device):
  python glass.py check-theme [--json]      theme/ and device/rt parse, the bundler's own check
  python glass.py edge PNG Y X0 X1          WN 8.2 top-edge profile of a glass slab
  python glass.py focus --png PNG --pair NAME=A:B[:MIN]...   luma pairs in an image
  python glass.py cmp MOCK.html [LIVE.png] [--id PKG] [--live]   mockup vs live, per element
  python glass.py ledger [--out FILE]       the function ledger (audits x concepts)
  python glass.py sgcheck --spec FILE       the depth rules over a check model
Live (each step locked; step options --flags a,b=v --mode laser|pad --media reduce,contrast
--stock --hover SEL[,MS] apply to all of them):
  python glass.py gates SURF [--route R] [--pre JS] [--only aud,size,type,outline,motion] [--shot NAME]
  python glass.py pad-bfs [--route R] [--pre JS] [--budget S] [--out FILE]
  python glass.py focus SURF [--route R] [--pre JS] --pairs FILE|JSON [--keep [NAME]]
  python glass.py motion SURF --pre JS [--route R] [--name ID] [--at 0,.15,...] | --selftest MS
  python glass.py sgcheck [--route R] [--pre JS]   (as a native-session step)
  python glass.py hv NAME [--offaxis DEG] [--rect x0,y0,x1,y1] [--full] [--look] [--route R] [--pre JS]
                          [--settle S] [--grabs N] [--gap S] | --clean
  python glass.py conformance [--route R]... [--only P-..] [--pad] [--out FILE]
  python glass.py native-session [--pre JS] --step "CMD ARGS"...   native mode on, the steps, back to CSS

Install location on the Frame: ~/.local/share/glass-shell (launcher + code
only). The theme itself is never persisted; a reboot or Steam restart always
returns the stock UI.
"""
import importlib.util
import io
import json
import os
import re
import shlex
import sys
import tarfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HELPER = Path.home() / ".claude" / "skills" / "steam-frame-ssh" / "scripts" / "frame_ssh.py"
REMOTE = "/home/steamos/.local/share/glass-shell"
DESKTOP = "/home/steamos/.local/share/applications/glass-shell.desktop"
SHOTS = ROOT / "shots"
# -B and PYTHONDONTWRITEBYTECODE (REQ P8->P10): lab and lgs commands import lgs, lgs_shell, lab_p2cmd; without them
# Python writes device/__pycache__ and lab/__pycache__ on the Frame, which would outlive `lgs off` and a reboot
# (PLAN 7, hard rule: nothing persists). The variable also reaches every Python the command starts.
PY = "env -u LD_LIBRARY_PATH -u LD_PRELOAD PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 -B"


def connect():
    spec = importlib.util.spec_from_file_location("frame_ssh", HELPER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    try:
        client, _ = mod.connect()
    except Exception as e:  # noqa: BLE001
        sys.exit(f"Cannot connect to the Frame: {e}\n(is it awake? FRAME_HOST=<ip> overrides 'frame')")
    return client


def sh(client, cmd, timeout=180, echo=True):
    _, out, err = client.exec_command(cmd, timeout=timeout)
    o = out.read().decode(errors="replace")
    e = err.read().decode(errors="replace")
    code = out.channel.recv_exit_status()
    if echo:
        sys.stdout.write(o)
        if e:
            sys.stderr.write(e)
    return code, o, e


def sh_stream(client, cmd, on_line, timeout=180):
    """Run cmd and call on_line(line) for each stdout line as it arrives (review R1 M5: a room frame a lab step
    announces is fetched and deleted at once, not when the whole command ends). stderr is drained by a thread
    and returned with the exit code. timeout: the longest silence allowed, as in sh()."""
    import socket
    import threading
    chan = client.get_transport().open_session(timeout=timeout)
    chan.settimeout(timeout)
    chan.exec_command(cmd)
    out = chan.makefile("rb", -1)
    errbuf = []
    done = threading.Event()

    def drain():
        # raw recv_stderr: a quiet stderr (longer than the timeout) must not lose what was already read
        while not done.is_set():
            try:
                d = chan.recv_stderr(65536)
            except socket.timeout:
                continue
            except Exception as e:  # noqa: BLE001
                errbuf.append(f"(stderr: {e})\n".encode())
                return
            if not d:
                return
            errbuf.append(d)
    t = threading.Thread(target=drain, daemon=True)
    t.start()
    try:
        for raw in iter(out.readline, b""):
            on_line(raw.decode("utf-8", "replace").rstrip("\r\n"))
        code = chan.recv_exit_status()
    finally:
        t.join(5)
        done.set()
        try:
            chan.close()
        except Exception:  # noqa: BLE001
            pass
    return code, b"".join(errbuf).decode("utf-8", "replace")


def sync(client, only=None):
    """Upload device/ theme/ lab/ native/ (or only the named subtrees, e.g.
    `glass.py sync lab`: P10 tools without touching anyone's theme files)."""
    subs = [x for x in ("device", "theme", "lab", "native") if not only or x in only]
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for sub in subs:
            p = ROOT / sub
            if not p.exists():
                continue
            for f in sorted(p.rglob("*")):
                if f.is_dir() or "__pycache__" in f.parts or f.suffix == ".pyc":
                    continue
                # native/: sources only; builds happen on the Frame
                if sub == "native" and ("build" in f.parts or f.suffix in (".o", ".so", ".png", ".jpg")
                                        or (f.suffix == "" and f.name not in ("Makefile",))):
                    continue
                ti = tar.gettarinfo(str(f), arcname=str(f.relative_to(ROOT)).replace("\\", "/"))
                ti.mode = 0o755 if f.suffix in (".py", ".sh") or f.name == "lgs" else 0o644
                ti.uid = ti.gid = 1000
                ti.uname = ti.gname = "steamos"
                with open(f, "rb") as fh:
                    tar.addfile(ti, fh)
    buf.seek(0)
    tmp = f"/tmp/lgs/sync-{os.getpid()}-{int(time.time() * 1000)}.tgz"
    sh(client, "mkdir -p /tmp/lgs", echo=False)
    sftp = client.open_sftp()
    sftp.putfo(buf, tmp)
    sftp.close()
    # Theme files are replaced as a set so a removed file does not linger.
    clear = f"rm -rf {REMOTE}/theme && " if "theme" in subs else ""
    code, _, _ = sh(client, f"mkdir -p {REMOTE} && flock /tmp/lgs/sync.lock sh -c "
                    + shlex.quote(f"{clear}tar -xzf {tmp} -C {REMOTE} && rm -f {tmp}"))
    if code:
        sys.exit("sync failed")
    print(f"synced {' '.join(subs)} -> {REMOTE}")


def native_build(client, fake=False):
    """Build glassd on the Frame. native/glassd/build.sh wins if present, else
    CMake; the binary lands in native/glassd/glassd, where lgs-shell looks."""
    if fake:
        cmd = (f"cd {REMOTE}/native/spike && "
               "g++ -O2 -std=c++17 -I$HOME/frametop/screens/build/include -I. fakeglassd.cpp -o fakeglassd "
               "-L/opt/steamvr/bin/linuxarm64 -lopenvr_api -Wl,-rpath,/opt/steamvr/bin/linuxarm64 -lgbm "
               f"&& echo built {REMOTE}/native/spike/fakeglassd")
    else:
        d = f"{REMOTE}/native/glassd"
        cmd = (f"if [ ! -d {d} ]; then echo 'native/glassd is not there yet (nothing to build); "
               "lgs-shell runs CSS only without it'; exit 3; fi; cd " + d + " && "
               "if [ -f build.sh ]; then sh build.sh; "
               "elif [ -f CMakeLists.txt ]; then cmake -S . -B build -DCMAKE_BUILD_TYPE=Release >/dev/null "
               "&& cmake --build build -j8 && install -m755 build/glassd glassd; "
               "else echo 'native/glassd has no build.sh or CMakeLists.txt'; exit 3; fi && "
               f"ls -la {d}/glassd")
    code, _, _ = sh(client, cmd, timeout=600)
    return code


def lgs(client, *args):
    q = " ".join(shlex.quote(a) for a in args)
    code, _, _ = sh(client, f"{PY} {REMOTE}/device/lgs.py {q}", timeout=120)
    return code


def lab(client, *args, timeout=300, echo=True):
    q = " ".join(shlex.quote(a) for a in args)
    return sh(client, f"{PY} {REMOTE}/lab/lab.py {q}", timeout=timeout, echo=echo)


def unmangle(arg):
    """Undo Git Bash's MSYS path conversion: '--route /library/home' reaches us
    as 'C:/Program Files/Git/library/home'. Routes are never Windows paths."""
    m = re.match(r"^[A-Za-z]:[/\\](?:Program Files[/\\])?Git([/\\].*)$", arg)
    return m.group(1).replace("\\", "/") if m else arg


# ------------------------------------------------------------ Phase 2 tools (P10)
# docs/phase2/contracts/lab.md is the interface. Exit codes: 0 pass, 1 fail,
# 2 usage, 3 blocked (a dependency is not there yet).

def blocked(what):
    print(f"BLOCKED: {what} (stub; see docs/phase2/contracts/lab.md section 9)")
    return 3


def p2_stub(name):
    def run(*_a):
        return blocked(f"glass.py {name} is not implemented yet")
    return run


def p2_tool(name):
    """tools/p2/<name>.py as a module."""
    p = ROOT / "tools" / "p2" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"p2_{name}", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def cmd_check_theme(rest):
    return p2_tool("check_theme").main(["check-theme"] + rest)


def cmd_edge(rest):
    return p2_tool("edge_profile").main_edge(rest)


def P2_SGCHECK_OFFLINE(rest):
    return p2_tool("sgcheck").main(rest)


def cmd_sgcheck(c, rest):
    """Live sgcheck: the lab gathers P6's report, the DOM and P7's dump in one lock; the rules run here."""
    rest = list(rest)
    as_json = "--json" in rest
    outp = None
    if "--out" in rest:
        i = rest.index("--out")
        outp = rest[i + 1]
        del rest[i:i + 2]
    results = {}
    rc = lab_fetch(c, ["sgcheck"] + rest, timeout=300, results=results)
    if not results.get("sgmodel"):
        return rc or 3
    data = results["sgmodel"][0]
    sg = p2_tool("sgcheck")
    res = sg.check_live(data)
    res.update({k: data.get(k) for k in ("route", "build", "date", "step")})
    if outp:
        Path(outp).write_text(json.dumps(dict(res, live=data), indent=1), encoding="utf-8")
    if as_json:
        print(json.dumps(res, indent=1))
    else:
        print(sg.summary(res, f"sgcheck {data.get('route') or ''} (build {data.get('build')}, {data.get('date')}, native {data.get('native', '?')}, "
                              f"{res.get('nodes')} scene-graph nodes)"))
    return 0 if res["pass"] else 1


TMP = Path(os.environ.get("TEMP", "/tmp"))
HV_LOOK = TMP / "lgs-hv"            # legacy shared look folder (before review R1 m4): emptied by any command
HV_LOOK_PREFIX = "lgs-hv-look-"     # per-invocation look folders, deleted by their own timer or after HV_LOOK_S
HV_LOOK_S = 120


def hv_clean(quiet=True, all_looks=False):
    """Delete kept headset-view frames on this PC (room imagery, LAB never-list): the legacy shared folder, and
    every per-invocation look folder older than HV_LOOK_S s (all of them with all_looks, `hv --clean`)."""
    import shutil
    n = 0
    if HV_LOOK.exists():
        for f in HV_LOOK.iterdir():
            try:
                f.unlink()
                n += 1
            except OSError:
                pass
    now = time.time()
    try:
        for d in TMP.glob(HV_LOOK_PREFIX + "*"):
            try:
                if all_looks or now - d.stat().st_mtime > HV_LOOK_S:
                    n += sum(1 for _ in d.glob("*.png"))
                    shutil.rmtree(d, ignore_errors=True)
            except OSError:
                pass
    except OSError:
        pass
    if n and not quiet:
        print(f"hv: deleted {n} kept headset-view frame(s)")
    return n


def hv_look_timer(folder):
    """A detached process that deletes one look folder HV_LOOK_S s from now (it ends with that; any glass.py
    command also deletes look folders older than HV_LOOK_S)."""
    import subprocess
    code = f"import time, shutil; time.sleep({HV_LOOK_S}); shutil.rmtree({str(folder)!r}, ignore_errors=True)"
    flags = 0
    if os.name == "nt":
        flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) \
            | getattr(subprocess, "CREATE_NO_WINDOW", 0)
    try:
        subprocess.Popen([sys.executable, "-c", code], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, creationflags=flags, close_fds=True,
                         **({} if os.name == "nt" else {"start_new_session": True}))
    except OSError as e:
        print(f"hv: no look timer ({e}); the next glass.py command after {HV_LOOK_S} s deletes it")


def hv_measure(c, remote, name, opts):
    """Fetch one hvgrab frame, measure it, delete both copies (or keep the local one for --look in its own
    folder, deleted after HV_LOOK_S s). Exit 3 when the verdict is withheld (no --rect: the auto rect is a hint,
    review R1 m4), 1 on a failing verdict."""
    import tempfile
    tmpd = Path(tempfile.mkdtemp(prefix="lgs-hv-"))
    local = tmpd / f"{name}.png"
    try:
        sftp = c.open_sftp()
        try:
            sftp.get(remote, str(local))
        finally:
            try:
                sftp.remove(remote)
            except OSError:
                pass
            sftp.close()
    finally:
        sh(c, f"rm -f {shlex.quote(remote)}", echo=False)
    try:
        res = p2_tool("hv_metrics").measure(str(local), rect=opts.get("rect"))
        res["name"] = name
        # the measured frame is the last of N grabs (REQ P7->P10: the first after a pause can be stale)
        res["grabs"] = opts.get("grabs", 1)
        if opts.get("layer"):
            res["layer"] = True          # a --route/--pre layer was held open for the capture (REQ C1c->P10)
        for k in ("mode", "native"):     # the input mode and native state the look was taken in (session 5)
            if opts.get(k):
                res[k] = opts[k]
        print(json.dumps(res, indent=1), flush=True)
        if opts.get("look"):
            look = TMP / f"{HV_LOOK_PREFIX}{os.getpid()}-{int(time.time() * 1000) % 10000000}"
            look.mkdir(parents=True, exist_ok=True)
            keep = look / f"{name}.png"
            local.replace(keep)
            hv_look_timer(look)
            print(f"LOOK: {keep}  (room imagery: view it now; it is deleted in {HV_LOOK_S} s)", flush=True)
        if res.get("pass") is None:
            print(f"BLOCKED: G-HV verdict withheld for {name} ({res.get('note', 'no rect')})", flush=True)
            return 3
        return 1 if res.get("pass") is False else 0
    finally:
        if local.exists():
            local.unlink()
        try:
            tmpd.rmdir()
        except OSError:
            pass


def worst(*codes):
    """Combine exit codes: a FAIL (1) wins over BLOCKED (3), which wins over pass (0); other codes after that."""
    cs = [c for c in codes if c]
    for k in (1, 3):
        if k in cs:
            return k
    return cs[0] if cs else 0


def lab_fetch(c, args, timeout=600, hv_opts=None, results=None, quiet_files=()):
    """Run a lab command whose output may announce files (@@file, @@hv) or
    results (@@<kind> JSON); print the rest, fetch the files, collect results
    into `results` ({kind: [obj]}), and return the exit code.

    Lines are handled as they stream (review R1 M5): a headset-view frame is fetched, measured and deleted on
    both machines while the command (a native-session) is still running. One failed fetch does not stop the
    others, and any announced room frame not handled by the end is deleted on the Frame."""
    q = " ".join(shlex.quote(a) for a in args)
    state = {"rc": 0, "hv": []}

    def handle(line):
        if line.startswith("@@file "):
            _, remote, rel = line.split(" ", 2)
            local = ROOT / rel
            try:
                local.parent.mkdir(parents=True, exist_ok=True)
                sftp = c.open_sftp()
                try:
                    sftp.get(remote, str(local))
                finally:
                    try:
                        sftp.remove(remote)
                    except OSError:
                        pass
                    sftp.close()
                if not any(rel.startswith(qf) for qf in quiet_files):
                    print(f"saved {local}", flush=True)
            except Exception as ex:  # noqa: BLE001 - the next lines (and room frames) are still handled
                print(f"fetch {remote} -> {rel} failed: {ex}", flush=True)
                state["rc"] = worst(state["rc"], 1)
        elif line.startswith("@@hv "):
            parts = line.split(" ", 3)
            remote, name = parts[1], parts[2]
            state["hv"].append(remote)
            try:
                opts = dict(json.loads(parts[3])) if len(parts) > 3 else {}
                opts = {k: v for k, v in opts.items() if v}     # the step's own --look/--rect (native-session)
                opts.update({k: v for k, v in (hv_opts or {}).items() if v})
                r = hv_measure(c, remote, name, opts)
                state["rc"] = worst(state["rc"], r)
                state["hv"].remove(remote)
            except Exception as ex:  # noqa: BLE001
                print(f"hv {name}: {ex}", flush=True)
                state["rc"] = worst(state["rc"], 1)
        elif line.startswith("@@") and " " in line and results is not None:
            kind, payload = line[2:].split(" ", 1)
            try:
                results.setdefault(kind, []).append(json.loads(payload))
            except ValueError:
                print(line, flush=True)
        else:
            print(line, flush=True)
    e = ""
    try:
        code, e = sh_stream(c, f"{PY} {REMOTE}/lab/lab.py {q}", handle, timeout=timeout)
    finally:
        if state["hv"]:     # announced room frames that were not handled: delete them on the Frame now
            try:
                sh(c, "rm -f " + " ".join(shlex.quote(p) for p in state["hv"]), echo=False)
            except Exception:  # noqa: BLE001
                pass
    if e:
        sys.stderr.write(e)
    return worst(code, state["rc"]) if code not in (0, None) else state["rc"]


def edge_probe(ep, L, pr, dpr):
    """One G-OUTLINE edge probe on any side of a shape: the side is turned into a 'top edge' (flip for the
    bottom, transpose for left and right) and measured with WN 8.2's profile (review R1 M2)."""
    side = pr.get("side", "top")
    if side in ("top", "bottom"):
        y, a0, a1 = int(round(pr["y"] * dpr)), int(pr["x0"] * dpr), int(pr["x1"] * dpr)
        P, yy = (L[::-1, :], L.shape[0] - y) if side == "bottom" else (L, y)
    else:
        x, a0, a1 = int(round(pr["x"] * dpr)), int(pr["y0"] * dpr), int(pr["y1"] * dpr)
        P, yy = (L.T[::-1, :], L.shape[1] - x) if side == "right" else (L.T, x)
    # A side on the capture edge (REQ C3b->P10 (2)): Steam's popup textures draw their outermost row uniformly
    # brighter on the stock UI too (every stock barpopup capture: last row 31 L over 19-26), so that texel is not
    # the slab's edge. The band starts one texel inside; the rim rows above it are still measured.
    capture_edge = yy <= 0
    if capture_edge:
        yy = 1
    if a1 - a0 < 16 or yy < 0 or yy + 12 >= P.shape[0]:
        return None
    r = ep.edge(P, yy, a0, a1)
    return {"el": pr["el"], "side": side, "at": int(round((pr["y"] if side in ("top", "bottom") else pr["x"]) * dpr)),
            "from": a0, "to": a1, "ratio": r["ratio"], "brightest": r["brightest"], "edge": r["edge"],
            "segments": r["segments"], "pass": r["pass"], **({"captureEdge": True} if capture_edge else {})}


def gates_finish(res, keep_name=None):
    """PC half of gates: edge profiles on the OUTLINE capture, overall pass. The capture is the one file the
    result names (shotLocal); a missing capture is an error, not a pass (review R1 m3)."""
    g = res["gates"]
    o = g.get("OUTLINE")
    if o:
        rel = o.get("shotLocal") or (f"shots/{keep_name}.png" if keep_name else None)
        path = (ROOT / rel) if rel else None
        edges = []
        if path and path.exists():
            ep = p2_tool("edge_profile")
            L = ep.lum(str(path), ep.W601)
            dpr = float(o.get("dpr") or 1.5)
            for pr in o.get("probes", []):
                e = edge_probe(ep, L, pr, dpr)
                if e:
                    # High Contrast draws its 2 px edge on purpose (D2's HC glass; P-42 exempts it, as the DOM part
                    # already does for rings, rims and lines): measured, not judged (REQ C2a-R2->P10 (5), session 5)
                    if o.get("highContrast"):
                        e["highContrast"] = True
                        e["judgedPass"] = e["pass"]
                        e["pass"] = True
                    edges.append(e)
            o["shot"] = rel if keep_name else None
            if not keep_name and path.name.startswith("_gates_tmp_"):
                path.unlink()
        else:
            o["error"] = f"no OUTLINE capture ({rel or 'none announced'}): edge probes not measured"
        o["edges"] = edges
        o.pop("shotRemote", None)
        o["pass"] = bool(o.get("pass")) and all(e["pass"] for e in edges) and not o.get("error")
    res["pass"] = all(v.get("pass") for v in g.values())
    return res


def gates_summary(res):
    out = [f"gates {res['surface']}{' ' + res['route'] if res.get('route') else ''}  "
           f"(build {res.get('build')}, {res.get('date')}, native {res.get('native', '?')}, step {json.dumps(res.get('step'))})"]
    for k, v in res["gates"].items():
        n = v.get("failCount", len(v.get("fails", v.get("issues", []))))
        extra = ""
        if k == "MOTION":
            n = len(v["nonToken"]) + len(v["atRest"]["running"]) + len(v["atRest"]["lgsLeft"]) + len(v["cssNonToken"])
        if k == "OUTLINE":
            sides = {}
            for e in v.get("edges", []):
                sides[e.get("side", "top")] = sides.get(e.get("side", "top"), 0) + 1
            extra = (f", {len(v.get('edges', []))} edge probes ({', '.join(f'{n} {s}' for s, n in sides.items()) or 'none'})"
                     + (f", {v.get('pseudoChecked')} pseudo-elements checked" if v.get("pseudoChecked") is not None else "")
                     + (" (High Contrast: rings, rims, lines and edge profiles not judged, P-42)" if v.get("highContrast") else "")
                     + (f"; ERROR {v['error']}" if v.get("error") else ""))
        out.append(f"  G-{k:8} {'PASS' if v.get('pass') else 'FAIL'}  {n} findings{extra}"
                   + (f", {len(v.get('exempt', []))} exempt" if v.get("exempt") else ""))
        items = []
        if k == "SIZE" and (v.get("skipped") or v.get("exemptFail")):
            sk = {}
            for x in v.get("skipped", []):
                sk[x["why"]] = sk.get(x["why"], 0) + 1
            out[-1] += (f", skipped {', '.join(f'{n} {w}' for w, n in sk.items())}" if sk else "") +                 (f", {v['exemptFail']} exemption(s) failing their own criterion" if v.get("exemptFail") else "")
        if k == "SIZE" and v.get("inPlace"):     # obscured, but no scroll room to bring them clear: judged (passed)
            out[-1] += f", {len(v['inPlace'])} obscured judged in place (cannot scroll clear)"
        if k in ("SIZE", "TYPE", "OUTLINE"):
            items = [f"{f.get('rule', '')} {f['el']} {f.get('rect', '')}: {f['why']}" for f in v.get("fails", [])[:12]]
            if k == "SIZE":
                items += [f"{e['id']} {e['el']}: {e.get('why', '')}" for e in v.get("exempt", []) if e.get("pass") is False][:8]
            if k == "OUTLINE":
                items += [f"edge {e['el']} ({e.get('side', 'top')} at {e.get('at')}): ratio {e['ratio']}, brightest dL {e.get('brightest')}"
                          for e in v.get("edges", []) if not e["pass"]][:8]
        elif k == "AUD":
            items = v.get("issues", [])[:12]
        elif k == "MOTION":
            items = (v["nonToken"] + v["atRest"]["running"] + v["atRest"]["lgsLeft"] + v["cssNonToken"])[:12]
            if v["atRest"].get("steamRunning"):
                items.append("(Steam's own, not judged: " + "; ".join(v["atRest"]["steamRunning"][:3]) + ")")
        out += ["      " + i for i in items]
    out.append("  overall: " + ("PASS" if res["pass"] else "FAIL"))
    return "\n".join(out)


def cmd_gates(c, rest):
    rest = list(rest)
    as_json = "--json" in rest
    keep = None
    if "--shot" in rest:
        keep = rest[rest.index("--shot") + 1]
    results = {}
    rc = lab_fetch(c, ["gates"] + rest, timeout=900, results=results, quiet_files=("shots/_gates_tmp_",))
    if not results.get("gates"):
        return rc or 3
    res = gates_finish(results["gates"][0], keep)
    print(json.dumps(res, indent=1) if as_json else gates_summary(res))
    return 0 if res["pass"] else 1


def bfs_summary(r):
    name = lambda i: (lambda n: f"#{i} {n['el']}{' \"' + n['text'][:24] + '\"' if n.get('text') else ''}")(r["nodes"][i]) \
        if isinstance(i, int) and i < len(r["nodes"]) else str(i)
    out = [f"pad-bfs {r.get('route')}  (build {r.get('build')}, {r.get('date')}, native {r.get('native', '?')}): {len(r['nodes'])} nodes, "
           f"{r.get('moves')} moves, {r.get('seconds')} s{', TRUNCATED' if r.get('truncated') else ''}",
           f"  entry focus: {r['entry']['el']} \"{r['entry'].get('text', '')[:30]}\" {r['entry']['rect']}"]
    exits = sorted({v for e in r["edges"].values() for v in e.values()
                    if isinstance(v, str) and v.split(":")[0] in ("exit", "route")})
    if exits:
        out.append("  leaves the window or route: " + ", ".join(exits))
    if r.get("exits"):     # REQ C1b->P10 #10, C2a->P10 #14: how focus came back into main after each exit
        how = {}
        for x in r["exits"]:
            how[x.get("back") or "LOST"] = how.get(x.get("back") or "LOST", 0) + 1
        out.append(f"  exits from main: {len(r['exits'])}, focus back by " + ", ".join(f"{k} {n}" for k, n in how.items())
                   + "  (opposite = the reverse press returned)")
        out += [f"      {name(x['from'])} -{x['dir']}-> {x['to']}, back: {x.get('back') or 'LOST'}" for x in r["exits"][:8]]
    # nodes whose focus could not be taken (session 5: the symptom of REQ C1b->P10 #10 / C2a #14), and takes that
    # needed main's nav tree activated again first
    untk = [int(i) if str(i).isdigit() else i for i, e in r["edges"].items() if "untakeable" in e.values()]
    if untk or r.get("retook"):
        out.append(f"  untakeable nodes: {len(untk)}; takes that needed main's nav tree activated again: {r.get('retook', 0)}")
        out += [f"      {name(i)}" for i in untk[:6]]
    out.append(f"  routes visited: {', '.join(r.get('routes', []))}")
    out.append(f"  unreached visible focusables: {len(r['unreached'])} of {r.get('universe', '?')}")
    out += [f"      {u['el']} \"{u.get('text', '')[:30]}\" {u['rect']}" for u in r["unreached"][:12]]
    out.append(f"  irreversible moves: {len(r['irreversible'])}")
    out += [f"      {name(x['from'])} -{x['dir']}-> {name(x['to'])}, back -> {name(x['back'])}" for x in r["irreversible"][:12]]
    if r.get("untested"):
        out.append(f"  reversibility not tested (slider): {len(r['untested'])}")
    if r.get("b"):
        out.append(f"  B from the entry focus: {r['b']['effect']}")
    out.append("  overall: " + ("PASS" if r.get("pass") else "FAIL"))
    return "\n".join(out)


def redact_text(t):
    """Element texts in saved files can hold personal data (friend names in feeds, a serial number, a Wi-Fi
    name): the same text always maps to the same short hash, so saved keys still compare."""
    import hashlib
    if not t or re.match(r"^#[0-9a-f]{8}$", t):    # empty, or already redacted
        return t
    return "#" + hashlib.sha1(t.encode("utf-8")).hexdigest()[:8]


def redact_bfs(r):
    r = json.loads(json.dumps(r))

    def fix(d):
        if isinstance(d, dict):
            if "text" in d:
                d["text"] = redact_text(d["text"])
            if isinstance(d.get("key"), str) and "|" in d["key"]:
                c, _, rest = d["key"].partition("|")
                m = re.match(r"^(.*)#(\d+)$", rest, re.S)
                lab_, n = (m.group(1), "#" + m.group(2)) if m else (rest, "")
                d["key"] = f"{c}|{redact_text(lab_)}{n}"
    for n in r.get("nodes", []):
        fix(n)
    for u in r.get("unreached", []):
        fix(u)
    fix(r.get("entry") or {})
    fix((r.get("init") or {}).get("entry") or {})
    r["redacted"] = True
    return r


def cmd_pad_bfs(c, rest):
    rest = list(rest)
    as_json = "--json" in rest
    raw = "--raw" in rest
    if raw:
        rest.remove("--raw")
    outp = None
    if "--out" in rest:
        i = rest.index("--out")
        outp = rest[i + 1]
        del rest[i:i + 2]
    results = {}
    rc = lab_fetch(c, ["pad-bfs"] + rest, timeout=600, results=results)
    if not results.get("bfs"):
        return rc or 3
    r = results["bfs"][0]
    if outp:   # texts hashed unless --raw (personal data, PLAN 7 rule 5)
        Path(outp).write_text(json.dumps(r if raw else redact_bfs(r), indent=1), encoding="utf-8")
    print(json.dumps(r, indent=1) if as_json else bfs_summary(r))
    return 0 if r.get("pass") else 1


def focus_region(side, st, dpr):
    """Region spec (edge_profile.mask syntax) for one side of a pair, in shot px."""
    shape = side.get("shape", "rect")
    if side.get("rect"):
        x0, y0, x1, y1 = [float(v) for v in side["rect"]]
    else:
        r = (st.get("rects") or {}).get(side.get("sel") or "")
        if not r or "rect" not in r:
            raise ValueError(f"{side.get('sel')}: {(r or {}).get('error', 'no rect')}")
        x, y, w, h = r["rect"]
        x0, y0, x1, y1 = x, y, x + w, y + h
    if side.get("band"):
        d0, d1 = [float(v) * dpr for v in side["band"]]
        return f"band:{x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f},{d0:.1f},{d1:.1f}", 0
    inset = float(side.get("inset", 6))
    if shape == "circle":
        return f"circle:{(x0 + x1) / 2:.1f},{(y0 + y1) / 2:.1f},{min(x1 - x0, y1 - y0) / 2:.1f}", inset
    if shape == "pill":
        return f"pill:{x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f}", inset
    return f"rect:{x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f}", inset


def focus_finish(res, pairs=None):
    """PC half of focus: luma of each pair from the captures (VP SHOT), then the temporary captures go."""
    pairs = pairs if pairs is not None else res.get("pairsIn", [])
    keep = res.get("keep")
    ep = p2_tool("edge_profile")
    planes = {}
    out = []
    for p in pairs:
        row = {"name": p.get("name"), "min": float(p.get("min", 40))}
        try:
            vals = []
            for side in ("a", "b"):
                sd = p[side]
                st = next(s for s in res["states"] if s["state"] == (sd.get("state") or ""))
                path = ROOT / st["file"]
                if str(path) not in planes:
                    planes[str(path)] = ep.lum(str(path), ep.W601)
                spec, inset = focus_region(sd, st, float(st.get("dpr") or 1.5))
                vals.append(ep.region_mean(planes[str(path)], spec, inset))
                row[side + "Region"] = spec
            row.update({"La": round(vals[0], 1), "Lb": round(vals[1], 1), "dL": round(vals[0] - vals[1], 1)})
            row["pass"] = row["dL"] >= row["min"]
        except (ValueError, StopIteration, KeyError) as e:
            row.update({"error": str(e), "pass": False})
        out.append(row)
    if not keep:
        for s in res["states"]:
            f = ROOT / s["file"]
            if f.exists():
                f.unlink()
    res["pairs"] = out
    res["pass"] = bool(out) and all(r["pass"] for r in out)
    return res


def focus_summary(res):
    out = [f"focus {res['surface']}{' ' + res['route'] if res.get('route') else ''}  (build {res.get('build')}, "
           f"{res.get('date')}, step {json.dumps(res.get('step'))})"]
    for i, st in enumerate(res["states"]):
        if st.get("error"):
            out.append(f"  state {i} ({st['state'][:60]}): ERROR {st['error']}")
    for r in res["pairs"]:
        if "error" in r:
            out.append(f"  {r['name']}: ERROR {r['error']}")
        else:
            out.append(f"  {r['name']}: L(A) {r['La']:.1f}  L(B) {r['Lb']:.1f}  dL {r['dL']:+.1f}  (min {r['min']:g})  "
                       + ("PASS" if r["pass"] else "FAIL"))
    if res.get("keep"):
        out.append("  shots: " + ", ".join(s["file"] for s in res["states"]))
    out.append("  overall: " + ("PASS" if res["pass"] else "FAIL"))
    return "\n".join(out)


def cmd_focus(c, rest):
    """glass.py focus SURF --pairs FILE|JSON (live, contracts/lab.md section 4)."""
    rest = list(rest)
    as_json = "--json" in rest
    if as_json:
        rest.remove("--json")
    keep = None
    if "--keep" in rest:
        i = rest.index("--keep")
        keep = rest[i + 1] if i + 1 < len(rest) and not rest[i + 1].startswith("--") else None
        del rest[i:i + (2 if keep else 1)]
        keep = keep or "p2_focus"
    if "--pairs" not in rest:
        print("usage: glass.py focus SURF [--route R] [--pre JS] --pairs FILE|JSON [--keep [NAME]] [--json]")
        return 2
    i = rest.index("--pairs")
    src = rest[i + 1]
    pairs = json.loads(Path(src).read_text(encoding="utf-8") if Path(src).exists() else src)
    del rest[i:i + 2]
    args = ["focus"] + rest + ["--pairs-json", json.dumps(pairs)] + (["--keep", keep] if keep else [])
    results = {}
    rc = lab_fetch(c, args, timeout=600, results=results, quiet_files=("shots/_focus_",))
    if not results.get("focus"):
        return rc or 3
    res = focus_finish(results["focus"][0], pairs)
    print(json.dumps(res, indent=1) if as_json else focus_summary(res))
    return 0 if res["pass"] else 1


def motion_finish(res):
    """PC half of motion: geometry checks from the per-frame rects, Reduce Motion rules, overall verdict,
    and a contact strip shots/p2_motion_<name>_strip.png (the frames side by side, cropped to the
    animated region) for the agent who judges the filmstrip."""
    anims = res.get("animations") or []
    frames = res.get("frames") or []
    width = float(res.get("width") or 1280)
    geo = {}
    if frames:
        last = frames[-1]["rects"]
        for k in last:
            series = [fr["rects"].get(k) for fr in frames if fr["rects"].get(k)]
            if not series:
                continue
            x1, y1, w1, h1 = last[k]
            dx = max(abs(r[0] + r[2] / 2 - (x1 + w1 / 2)) for r in series)
            dy = max(abs(r[1] + r[3] / 2 - (y1 + h1 / 2)) for r in series)
            sc = [r[2] / w1 for r in series if w1 > 0]
            a = next((a for a in anims if str(a.get("id")) == str(k)), {})
            geo[k] = {"target": a.get("target"), "name": a.get("name"), "maxDx": round(dx, 1), "maxDy": round(dy, 1),
                      "scaleMin": round(min(sc), 4) if sc else None, "scaleMax": round(max(sc), 4) if sc else None,
                      "w": w1, "text": a.get("text")}
    issues = []
    for k, g in geo.items():
        wide = (g["w"] or 0) > 600 * (width / 1280.0)
        if wide and g["maxDx"] > 24:
            issues.append(f"P-53 {g['name']} on {g['target']}: lateral travel {g['maxDx']} px on a {g['w']:.0f} px surface")
        if wide and g["scaleMin"] is not None and (g["scaleMin"] < 0.985 or g["scaleMax"] > 1.015):
            issues.append(f"P-53 {g['name']} on {g['target']}: window scale {g['scaleMin']}..{g['scaleMax']}")
        if max(g["maxDx"], g["maxDy"]) > 16:
            issues.append(f"P-54 {g['name']} on {g['target']}: starts {max(g['maxDx'], g['maxDy'])} px from rest")
    reduce = "reduce" in (res.get("step") or {}).get("media", [])
    rm = []
    if reduce:
        for a in anims:
            pr = [p for p in a.get("props", []) if p not in ("opacity",)]
            if pr:
                rm.append(f"P-56 {a['name']} on {a['target']}: animates {', '.join(pr)} under Reduce Motion")
            if (a.get("duration") or 0) > 200:
                rm.append(f"P-56 {a['name']} on {a['target']}: {a['duration']} ms > 200 under Reduce Motion")
    rest = res.get("atRest") or {}
    res["geometry"] = geo
    res["geometryIssues"] = issues
    res["reduceIssues"] = rm
    res["pass"] = not res.get("nonToken") and not rest.get("running") and not rest.get("lgsLeft") \
        and not rest.get("infinite") and not issues and not rm
    st = res.get("selftest")
    if st is not None:
        # The probe's boxes are white over opaque black, linear 0 -> 1: their luma / 255 is the frame's f.
        try:
            ep = p2_tool("edge_profile")
            bx = st["boxes"]
            dpr = float(bx.get("dpr") or 1.5)
            rows = []
            for fr in frames:
                L = ep.lum(str(ROOT / fr["file"]), ep.W601)
                v = {}
                for k in ("a", "b"):
                    x, y, w, h = bx[k]
                    v[k] = ep.region_mean(L, f"rect:{x * dpr:.1f},{y * dpr:.1f},{(x + w) * dpr:.1f},{(y + h) * dpr:.1f}", 8) / 255.0
                rows.append({"f": fr["f"], "waapi": round(v["a"], 3), "css": round(v["b"], 3)})
            st["rows"] = rows
            st["limit"] = 0.05
            st["maxErr"] = round(max(max(abs(r["waapi"] - r["f"]), abs(r["css"] - r["f"])) for r in rows), 3) if rows else None
            st["pass"] = bool(rows) and st["maxErr"] <= st["limit"]
        except Exception as e:  # noqa: BLE001
            st["error"] = str(e)
            st["pass"] = False
        res["pass"] = st["pass"]          # the self-test is judged by its ramp only
    # contact strip
    try:
        from PIL import Image, ImageDraw
        ims = [Image.open(ROOT / f["file"]).convert("RGB") for f in frames if (ROOT / f["file"]).exists()]
        if ims:
            dpr = float(res.get("dpr") or 1.5)
            boxes = [r for fr in frames for r in fr["rects"].values()]
            if boxes:
                x0 = max(0, min(b[0] for b in boxes) * dpr - 24)
                y0 = max(0, min(b[1] for b in boxes) * dpr - 24)
                x1 = min(ims[0].width, max(b[0] + b[2] for b in boxes) * dpr + 24)
                y1 = min(ims[0].height, max(b[1] + b[3] for b in boxes) * dpr + 24)
                if x1 - x0 < 64 or y1 - y0 < 64:
                    x0, y0, x1, y1 = 0, 0, ims[0].width, ims[0].height
            else:
                x0, y0, x1, y1 = 0, 0, ims[0].width, ims[0].height
            crops = [im.crop((int(x0), int(y0), int(x1), int(y1))) for im in ims]
            sc = min(1.0, 640.0 / max(1, crops[0].width))
            crops = [c.resize((max(1, int(c.width * sc)), max(1, int(c.height * sc)))) for c in crops]
            W = sum(c.width for c in crops) + 8 * (len(crops) - 1)
            strip = Image.new("RGB", (W, crops[0].height + 28), (16, 16, 16))
            d = ImageDraw.Draw(strip)
            try:
                from PIL import ImageFont
                font = ImageFont.load_default(size=18)
            except (TypeError, OSError):
                font = None
            x = 0
            for c, fr in zip(crops, frames):
                strip.paste(c, (x, 28))
                d.text((x + 6, 4), f"f = {fr['f']:g}", fill=(235, 235, 235), font=font)
                x += c.width + 8
            out = SHOTS / f"p2_motion_{res['name']}_strip.png"
            strip.save(out)
            res["strip"] = str(out.relative_to(ROOT))
    except Exception as e:  # noqa: BLE001
        res["stripError"] = str(e)
    return res


def motion_summary(res):
    out = [f"motion {res['surface']} {res.get('route') or ''} '{res['name']}'  (build {res.get('build')}, {res.get('date')}, "
           f"native {res.get('native', '?')}, step {json.dumps(res.get('step'))})"]
    if res.get("freezeError"):
        out.append(f"  timeline freeze: ERROR {res['freezeError']}")
    if res.get("freeze"):
        bad = [f"f {fr['f']:g}" for fr in res.get("frames", []) if fr.get("raf") is False]
        out.append(f"  freeze: {res['freeze']} (paused {res.get('frozen')} after the pre, released {res.get('released')})"
                   + (f"; no animation frame before {', '.join(bad)} (capture may be stale)" if bad else ""))
    st = res.get("selftest")
    if st:
        out.append(f"  SELF-TEST two-box probe, linear {st.get('ms'):g} ms: max error {st.get('maxErr')} "
                   f"(limit {st.get('limit')}): {'PASS' if st.get('pass') else 'FAIL'}")
        for r in st.get("rows", []):
            out.append(f"    f {r['f']:<5g} WAAPI {r['waapi']:.3f}  CSS transition {r['css']:.3f}")
        if st.get("error"):
            out.append(f"    ERROR {st['error']}")
    anims = res.get("animations") or []
    out.append(f"  animations started by the pre: {len(anims)}" + ("  (none: nothing to judge)" if not anims else ""))
    for a in anims[:20]:
        out.append(f"    {a['name']} on {a['target']}: {a['duration']} ms, delay {a.get('delay')}, {str(a.get('easing'))[:40]}, "
                   f"props {','.join(a.get('props', []))[:50]}")
    out.append(f"  non-token durations/easings (P-58): {len(res.get('nonToken') or [])}")
    out += ["    " + x for x in (res.get("nonToken") or [])[:12]]
    out.append(f"  geometry (P-53, P-54): {len(res['geometryIssues'])} issues")
    out += ["    " + x for x in res["geometryIssues"][:12]]
    if "reduce" in (res.get("step") or {}).get("media", []):
        out.append(f"  Reduce Motion (P-56): {len(res['reduceIssues'])} issues")
        out += ["    " + x for x in res["reduceIssues"][:12]]
    r = res.get("atRest") or {}
    out.append(f"  1 s later (P-52): {len(r.get('running', []))} running, {len(r.get('lgsLeft', []))} lgs-* left, "
               f"{len(r.get('infinite', []))} infinite")
    out += ["    " + x for x in (r.get("running", []) + r.get("lgsLeft", []))[:8]]
    out.append("  frames: " + ", ".join(f["file"] for f in res.get("frames", [])))
    if res.get("strip"):
        out.append(f"  strip: {res['strip']}  (view it: glass before content on entry, content before glass on exit, "
                   "no text scaling, no closed outline)")
    out.append("  overall: " + ("PASS" if res["pass"] else "FAIL") + " (automatic part; the strip verdict is the viewer's)")
    return "\n".join(out)


def cmd_motion(c, rest):
    rest = list(rest)
    as_json = "--json" in rest
    results = {}
    rc = lab_fetch(c, ["motion"] + rest, timeout=600, results=results)
    if not results.get("motion"):
        return rc or 3
    res = motion_finish(results["motion"][0])
    print(json.dumps(res, indent=1) if as_json else motion_summary(res))
    return 0 if res["pass"] else 1


def finish_results(results):
    """PC halves of the measuring commands for results a native-session announced (@@<kind> lines).
    Returns the worst exit code (1 fail over 3 blocked over 0 pass)."""
    rc = 0
    for kind, items in results.items():
        for r in items:
            try:
                if kind == "conf":        # a conformance step: with the native layer's depth model (review R1 m5)
                    rc = worst(rc, p2_tool("conformance").finish_one(r))
                    continue
                if kind == "gates":
                    r = gates_finish(r, r.get("keep"))
                    print(gates_summary(r))
                elif kind == "bfs":
                    print(bfs_summary(r))
                elif kind == "focus":
                    r = focus_finish(r)
                    print(focus_summary(r))
                elif kind == "motion":
                    r = motion_finish(r)
                    print(motion_summary(r))
                elif kind == "sgmodel":
                    sg = p2_tool("sgcheck")
                    res = sg.check_live(r)
                    print(sg.summary(res, f"sgcheck {r.get('route') or ''} (native, build {r.get('build')}, "
                                          f"{r.get('date')}, {res.get('nodes')} scene-graph nodes)"))
                    r = res
                else:
                    print(f"@@{kind} " + json.dumps(r))
                    continue
            except Exception as e:  # noqa: BLE001 - one bad result must not hide the others
                print(f"{kind}: could not finish the result: {e}")
                rc = worst(rc, 1)
                continue
            rc = worst(rc, 0 if r.get("pass") else 1)
    return rc


def cmd_native_session(c, rest):
    results = {}
    rc = lab_fetch(c, ["native-session"] + rest, timeout=2400, results=results,
                   quiet_files=("shots/_gates_tmp_", "shots/_focus_"))
    return worst(rc, finish_results(results))


def cmd_hv(c, rest):
    rest = list(rest)
    if "--clean" in rest:
        hv_clean(quiet=False, all_looks=True)
        sh(c, "rm -f /tmp/lgs/hv-*.png", echo=False)
        return 0
    opts = {"look": "--look" in rest}     # --full passes through to the device (scale 1)
    if "--look" in rest:
        rest.remove("--look")
    if "--rect" in rest:
        i = rest.index("--rect")
        opts["rect"] = [int(float(v)) for v in rest[i + 1].split(",")]
        del rest[i:i + 2]
    return lab_fetch(c, ["hv-grab"] + rest, timeout=180, hv_opts=opts)


def cmd_cmp(rest):
    """cmp works offline when it has the live shot and rects; it connects only for the live step."""
    state = {}

    def live_fn(args):
        if "c" not in state:
            state["c"] = connect()
        results = {}
        lab_fetch(state["c"], ["cmp-rects"] + args, timeout=300, results=results)
        return (results.get("cmprects") or [None])[0]
    try:
        return p2_tool("cmp").run(rest, live_fn)
    finally:
        if "c" in state:
            state["c"].close()


# Offline commands: no device connection.
P2_OFFLINE = {"cmp": cmd_cmp, "ledger": lambda rest: p2_tool("ledger").main(rest)}
P2_OFFLINE.update({"check-theme": cmd_check_theme, "edge": cmd_edge})
# Live commands: get the SSH client first.
def cmd_conformance(c, rest):
    def lab_conf(args):
        results = {}
        lab_fetch(c, ["conformance"] + args, timeout=600, results=results)
        return (results.get("conf") or [None])[0]

    def lab_bfs(args):
        results = {}
        lab_fetch(c, ["pad-bfs", "--budget", "150"] + args, timeout=600, results=results)
        return (results.get("bfs") or [None])[0]
    return p2_tool("conformance").run(rest, lab_conf, lab_bfs)


P2_LIVE = {}
P2_LIVE.update({"native-session": cmd_native_session, "hv": cmd_hv, "gates": cmd_gates, "pad-bfs": cmd_pad_bfs,
                "focus": cmd_focus, "motion": cmd_motion, "sgcheck": cmd_sgcheck, "conformance": cmd_conformance})


def main(argv):
    argv = [argv[0]] + [unmangle(a) for a in argv[1:]]
    if len(argv) < 2 or argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = argv[1], argv[2:]
    hv_clean(quiet=False)       # kept --look frames older than HV_LOOK_S s (their own timer normally got them)
    if cmd in P2_OFFLINE:
        return P2_OFFLINE[cmd](rest)
    if cmd == "focus" and "--png" in rest:      # offline form: luma pairs in an image
        return p2_tool("edge_profile").main_focus_png(rest)
    if cmd == "sgcheck" and "--spec" in rest:   # offline form: rules over a check model
        return P2_SGCHECK_OFFLINE(rest)
    c = connect()
    try:
        if cmd == "check":
            sh(c, "hostname; uptime; curl -s --max-time 3 http://127.0.0.1:8080/json/version | head -3; "
                  f"ls {REMOTE} 2>/dev/null; ls -la {DESKTOP} 2>/dev/null")
        elif cmd == "sync":
            bad = [x for x in rest if x not in ("device", "theme", "lab", "native")]
            if bad:
                print("usage: glass.py sync [device|theme|lab|native]...")
                return 2
            sync(c, only=rest or None)
        elif cmd == "install":
            sync(c)
            sh(c, f"install -Dm644 {REMOTE}/device/glass-shell.desktop {DESKTOP} && "
                  f"chmod 755 {REMOTE}/device/lgs {REMOTE}/device/lgs.py && "
                  f"(update-desktop-database ~/.local/share/applications >/dev/null 2>&1 || true) && "
                  f"echo installed {DESKTOP}")
        elif cmd == "uninstall":
            lgs(c, "off", "--quiet")
            sh(c, f"rm -f {DESKTOP} && rm -rf {REMOTE} /tmp/lgs && echo removed")
        elif cmd in ("on", "off", "toggle", "reload", "status", "toast", "dial"):
            if cmd in ("on", "reload", "toggle"):
                sync(c)
            return lgs(c, cmd, *rest)
        elif cmd == "shot":
            surface, name = rest[0], rest[1]
            remote = f"/tmp/lgs/shots/{name}-{os.getpid()}.png"     # under /tmp/lgs (hard rule 7)
            code, o, e = lab(c, "shot", surface, remote, *rest[2:])
            if code:
                return code
            SHOTS.mkdir(exist_ok=True)
            local = SHOTS / f"{name}.png"
            sftp = c.open_sftp()
            sftp.get(remote, str(local))
            sftp.remove(remote)
            sftp.close()
            print(f"saved {local}")
        elif cmd == "native-build":
            sync(c)
            return native_build(c, fake=bool(rest and rest[0] == "fake"))
        elif cmd == "shell":
            sub = rest[0] if rest else "status"
            if sub == "log":
                return sh(c, "journalctl --user -u lgs-shell --no-pager -n 80 -o cat", timeout=30)[0]
            if sub not in ("status", "start", "stop"):
                print(__doc__)
                return 2
            extra = " ".join(shlex.quote(a) for a in rest[1:])   # start: --native, --glassd-args "...", --stay
            return sh(c, f"{PY} {REMOTE}/device/lgs_shell.py {sub} {extra}".rstrip(), timeout=60)[0]
        elif cmd == "selftest":
            # P1's runtime acceptance tests (REQ P1->P10): each test takes the lab lock for its own steps, so
            # no lock here; the exit code is kept and the JSON copied to shots/p1-selftest.json.
            q = " ".join(shlex.quote(a) for a in rest)
            code, _, _ = sh(c, f"{PY} {REMOTE}/device/lgs.py selftest {q}".rstrip(), timeout=1200)
            SHOTS.mkdir(exist_ok=True)
            sftp = c.open_sftp()
            try:
                sftp.get("/tmp/lgs/p1-selftest.json", str(SHOTS / "p1-selftest.json"))
                print(f"saved {SHOTS / 'p1-selftest.json'}")
            except OSError:
                print("(no /tmp/lgs/p1-selftest.json)")
            finally:
                sftp.close()
            return code
        elif cmd == "logs":
            sh(c, "tail -n 60 /tmp/lgs/lgs.log 2>/dev/null")
        elif cmd in ("outline", "styles", "classes", "click", "js", "route", "nav", "back", "surfaces", "eval", "audit", "perf"):
            code, _, _ = lab(c, cmd, *rest)
            return code
        elif cmd in P2_LIVE:
            return P2_LIVE[cmd](c, rest)
        else:
            print(__doc__)
            return 2
    finally:
        c.close()
    return 0


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):  # Steam UI text is full of non-cp1252 glyphs
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except AttributeError:
            pass
    sys.exit(main(sys.argv))
