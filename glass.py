#!/usr/bin/env python3
"""PC-side driver for Glass Shell (Liquid Glass theme for the Steam Frame UI).

Talks to the headset through the steam-frame-ssh skill's helper (pinned host
key, STEAMFRAME_SSH_PASSWORD), the same way the run-liquid-glass-frame driver
does.

  python glass.py check                     headset reachable? Steam devtools up?
  python glass.py sync                      upload device/ theme/ lab/ native/ (sources)
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
  python glass.py perf SURF [--route R] [--pre JS] [--seconds S]
                                            theme off vs on frame pacing while scrolling
  python glass.py audit SURF [--route R] [--pre JS] [--json]
                                            stock-vs-themed regression diff
  python glass.py outline SURF [--route R] [--sel S] [--depth N] [--max N]
  python glass.py styles SURF SELECTOR
  python glass.py classes REGEX
  python glass.py click SURF SELECTOR
  python glass.py js 'EXPR'                 eval in SharedJSContext, L = lab helpers
  python glass.py route | nav ROUTE | back | surfaces
  python glass.py logs

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
PY = "env -u LD_LIBRARY_PATH -u LD_PRELOAD /usr/bin/python3"


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


def sync(client):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for sub in ("device", "theme", "lab", "native"):
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
    code, _, _ = sh(client, f"mkdir -p {REMOTE} && flock /tmp/lgs/sync.lock sh -c "
                    + shlex.quote(f"rm -rf {REMOTE}/theme && tar -xzf {tmp} -C {REMOTE} && rm -f {tmp}"))
    if code:
        sys.exit("sync failed")
    print(f"synced -> {REMOTE}")


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
    return p2_stub("sgcheck --spec")()


HV_LOOK = Path(os.environ.get("TEMP", "/tmp")) / "lgs-hv"


def hv_clean(quiet=True):
    """Delete every kept headset-view frame on this PC (room imagery, LAB never-list)."""
    n = 0
    if HV_LOOK.exists():
        for f in HV_LOOK.iterdir():
            try:
                f.unlink()
                n += 1
            except OSError:
                pass
    if n and not quiet:
        print(f"hv: deleted {n} kept headset-view frame(s) in {HV_LOOK}")
    return n


def hv_measure(c, remote, name, opts):
    """Fetch one hvgrab frame, measure it, delete both copies (or keep the
    local one in HV_LOOK for --look, deleted by the next glass.py command)."""
    import tempfile
    tmpd = Path(tempfile.mkdtemp(prefix="lgs-hv-"))
    local = tmpd / f"{name}.png"
    sftp = c.open_sftp()
    try:
        sftp.get(remote, str(local))
    finally:
        try:
            sftp.remove(remote)
        except OSError:
            pass
        sftp.close()
    sh(c, f"rm -f {shlex.quote(remote)}", echo=False)
    try:
        res = p2_tool("hv_metrics").measure(str(local), rect=opts.get("rect"))
        res["name"] = name
        print(json.dumps(res, indent=1))
        if opts.get("look"):
            HV_LOOK.mkdir(parents=True, exist_ok=True)
            keep = HV_LOOK / f"{name}.png"
            local.replace(keep)
            print(f"LOOK: {keep}  (room imagery: view it now; the next glass.py command deletes it)")
        return 1 if res.get("pass") is False else 0
    finally:
        if local.exists():
            local.unlink()
        try:
            tmpd.rmdir()
        except OSError:
            pass


def lab_fetch(c, args, timeout=600, hv_opts=None, results=None, quiet_files=()):
    """Run a lab command whose output may announce files (@@file, @@hv) or
    results (@@<kind> JSON); print the rest, fetch the files, collect results
    into `results` ({kind: [obj]}), and return the exit code."""
    code, o, e = lab(c, *args, timeout=timeout, echo=False)
    rc = code
    for line in o.splitlines():
        if line.startswith("@@file "):
            _, remote, rel = line.split(" ", 2)
            local = ROOT / rel
            local.parent.mkdir(parents=True, exist_ok=True)
            sftp = c.open_sftp()
            try:
                sftp.get(remote, str(local))
                sftp.remove(remote)
            finally:
                sftp.close()
            if not any(rel.startswith(q) for q in quiet_files):
                print(f"saved {local}")
        elif line.startswith("@@hv "):
            _, remote, name = line.split(" ", 2)
            r = hv_measure(c, remote, name, hv_opts or {})
            rc = rc or r
        elif line.startswith("@@") and " " in line and results is not None:
            kind, payload = line[2:].split(" ", 1)
            try:
                results.setdefault(kind, []).append(json.loads(payload))
            except ValueError:
                print(line)
        else:
            print(line)
    if e:
        sys.stderr.write(e)
    return rc


def gates_finish(res, keep_name=None):
    """PC half of gates: edge profiles on the OUTLINE capture, overall pass."""
    g = res["gates"]
    o = g.get("OUTLINE")
    if o:
        rel = f"shots/{keep_name}.png" if keep_name else None
        tmp = [p for p in SHOTS.glob("_gates_tmp_*.png")]
        path = (ROOT / rel) if rel else (max(tmp, key=lambda p: p.stat().st_mtime) if tmp else None)
        edges = []
        if path and path.exists():
            ep = p2_tool("edge_profile")
            L = ep.lum(str(path), ep.W709)
            dpr = float(o.get("dpr") or 1.5)
            for pr in o.get("probes", []):
                y, x0, x1 = int(pr["y"] * dpr), int(pr["x0"] * dpr), int(pr["x1"] * dpr)
                if x1 - x0 < 16 or y + 12 >= L.shape[0]:
                    continue
                r = ep.edge(L, y, x0, x1)
                edges.append({"el": pr["el"], "y": y, "x0": x0, "x1": x1, "ratio": r["ratio"],
                              "segments": r["segments"], "pass": r["pass"]})
            o["shot"] = str(path.relative_to(ROOT)) if keep_name else None
            if not keep_name:
                for p in tmp:
                    p.unlink()
        o["edges"] = edges
        o.pop("shotRemote", None)
        o["pass"] = bool(o.get("pass")) and all(e["pass"] for e in edges)
    res["pass"] = all(v.get("pass") for v in g.values())
    return res


def gates_summary(res):
    out = [f"gates {res['surface']}{' ' + res['route'] if res.get('route') else ''}  "
           f"(build {res.get('build')}, {res.get('date')}, step {json.dumps(res.get('step'))})"]
    for k, v in res["gates"].items():
        n = v.get("failCount", len(v.get("fails", v.get("issues", []))))
        extra = ""
        if k == "MOTION":
            n = len(v["nonToken"]) + len(v["atRest"]["running"]) + len(v["atRest"]["lgsLeft"]) + len(v["cssNonToken"])
        if k == "OUTLINE":
            extra = f", {len(v.get('edges', []))} edge probes"
        out.append(f"  G-{k:8} {'PASS' if v.get('pass') else 'FAIL'}  {n} findings{extra}"
                   + (f", {len(v.get('exempt', []))} exempt" if v.get("exempt") else ""))
        items = []
        if k in ("SIZE", "TYPE", "OUTLINE"):
            items = [f"{f.get('rule', '')} {f['el']} {f.get('rect', '')}: {f['why']}" for f in v.get("fails", [])[:12]]
            if k == "OUTLINE":
                items += [f"edge {e['el']}: ratio {e['ratio']}" for e in v.get("edges", []) if not e["pass"]][:6]
        elif k == "AUD":
            items = v.get("issues", [])[:12]
        elif k == "MOTION":
            items = (v["nonToken"] + v["atRest"]["running"] + v["atRest"]["lgsLeft"] + v["cssNonToken"])[:12]
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
    out = [f"pad-bfs {r.get('route')}  (build {r.get('build')}, {r.get('date')}): {len(r['nodes'])} nodes, "
           f"{r.get('moves')} moves, {r.get('seconds')} s{', TRUNCATED' if r.get('truncated') else ''}",
           f"  entry focus: {r['entry']['el']} \"{r['entry'].get('text', '')[:30]}\" {r['entry']['rect']}"]
    exits = sorted({v for e in r["edges"].values() for v in e.values() if isinstance(v, str) and ":" in v})
    if exits:
        out.append("  leaves the window: " + ", ".join(exits))
    out.append(f"  unreached visible focusables: {len(r['unreached'])}")
    out += [f"      {u['el']} \"{u.get('text', '')[:30]}\" {u['rect']}" for u in r["unreached"][:12]]
    out.append(f"  irreversible moves: {len(r['irreversible'])}")
    out += [f"      {name(x['from'])} -{x['dir']}-> {name(x['to'])}, back -> {name(x['back'])}" for x in r["irreversible"][:12]]
    if r.get("b"):
        out.append(f"  B from the entry focus: {r['b']['effect']}")
    out.append("  overall: " + ("PASS" if r.get("pass") else "FAIL"))
    return "\n".join(out)


def cmd_pad_bfs(c, rest):
    rest = list(rest)
    as_json = "--json" in rest
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
    if outp:
        Path(outp).write_text(json.dumps(r, indent=1), encoding="utf-8")
    print(json.dumps(r, indent=1) if as_json else bfs_summary(r))
    return 0 if r.get("pass") else 1


def cmd_native_session(c, rest):
    return lab_fetch(c, ["native-session"] + rest, timeout=2400)


def cmd_hv(c, rest):
    rest = list(rest)
    if "--clean" in rest:
        hv_clean(quiet=False)
        sh(c, "rm -f /tmp/lgs/hv-*.png", echo=False)
        return 0
    opts = {"look": "--look" in rest}
    if "--look" in rest:
        rest.remove("--look")
    if "--rect" in rest:
        i = rest.index("--rect")
        opts["rect"] = [int(float(v)) for v in rest[i + 1].split(",")]
        del rest[i:i + 2]
    if "--offaxis" in rest:
        i = rest.index("--offaxis")
        del rest[i:i + 2]
        return blocked("hv --offaxis needs P7's yaw test hook (REQ P10->P7 in docs/phase2/wp/P10.md)")
    return lab_fetch(c, ["hv-grab"] + rest, timeout=180, hv_opts=opts)


# Offline commands: no device connection.
P2_OFFLINE = {name: p2_stub(name) for name in ("cmp", "ledger")}
P2_OFFLINE.update({"check-theme": cmd_check_theme, "edge": cmd_edge})
# Live commands: get the SSH client first.
P2_LIVE = {name: p2_stub(name) for name in ("focus", "motion", "sgcheck", "conformance")}
P2_LIVE.update({"native-session": cmd_native_session, "hv": cmd_hv, "gates": cmd_gates, "pad-bfs": cmd_pad_bfs})


def main(argv):
    argv = [argv[0]] + [unmangle(a) for a in argv[1:]]
    if len(argv) < 2 or argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = argv[1], argv[2:]
    if not (cmd == "hv" and "--look" in rest):
        hv_clean(quiet=False)   # a kept --look frame never outlives the next command
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
            sync(c)
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
            remote = f"/tmp/lgs-shots/{name}-{os.getpid()}.png"
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
