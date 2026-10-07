#!/usr/bin/env python3
"""PC-side driver for Glass Shell (Liquid Glass theme for the Steam Frame UI).

Talks to the headset through the steam-frame-ssh skill's helper (pinned host
key, STEAMFRAME_SSH_PASSWORD), the same way the run-liquid-glass-frame driver
does.

  python glass.py check                     headset reachable? Steam devtools up?
  python glass.py sync                      upload device/ theme/ lab/
  python glass.py install                   sync + add "Liquid Glass" to + > Launch Program
  python glass.py uninstall                 theme off, remove launcher and files
  python glass.py on|off|toggle|reload|status
  python glass.py toast "text"
  python glass.py shot SURF NAME [--route R] [--pre JS] [--theme on|off|keep]
                                 [--settle S] [--back]
                                            capture SURF to shots/NAME.png
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
import os
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
        for sub in ("device", "theme", "lab"):
            p = ROOT / sub
            if not p.exists():
                continue
            for f in sorted(p.rglob("*")):
                if f.is_dir() or "__pycache__" in f.parts or f.suffix == ".pyc":
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


def lgs(client, *args):
    q = " ".join(shlex.quote(a) for a in args)
    code, _, _ = sh(client, f"{PY} {REMOTE}/device/lgs.py {q}", timeout=120)
    return code


def lab(client, *args, timeout=300, echo=True):
    q = " ".join(shlex.quote(a) for a in args)
    return sh(client, f"{PY} {REMOTE}/lab/lab.py {q}", timeout=timeout, echo=echo)


def main(argv):
    if len(argv) < 2 or argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = argv[1], argv[2:]
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
        elif cmd in ("on", "off", "toggle", "reload", "status", "toast"):
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
        elif cmd == "logs":
            sh(c, "tail -n 60 /tmp/lgs/lgs.log 2>/dev/null")
        elif cmd in ("outline", "styles", "classes", "click", "js", "route", "nav", "back", "surfaces", "eval", "audit"):
            code, _, _ = lab(c, cmd, *rest)
            return code
        else:
            print(__doc__)
            return 2
    finally:
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
