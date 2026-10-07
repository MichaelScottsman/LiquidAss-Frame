"""Small driver for scene-graph experiments in SteamVR's systemui page.

  python sg_run.py OUTDIR js FILE.js [OPTS_JSON]   inject a test script
  python sg_run.py OUTDIR eval 'EXPR'              evaluate in systemui
  python sg_run.py OUTDIR grab NAME [DELAY]        one headset feed frame -> OUTDIR/NAME.jpg

Feed frames show the room: look at them and delete them.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GS = os.path.dirname(os.path.dirname(HERE))
SSH = os.path.expanduser("~/.claude/skills/steam-frame-ssh/scripts/frame_ssh.py")


def js(expr):
    r = subprocess.run(["python", os.path.join(GS, "glass.py"), "js", expr, "--keep", "--in", "vr:systemui"],
                       capture_output=True, text=True, encoding="utf-8", cwd=GS)
    return (r.stdout + r.stderr).strip()[-800:]


def grab(out, name, delay=1.5):
    remote = f"/tmp/lgs/{name}.jpg"
    subprocess.run(["python", SSH, "run", f"sleep {delay}; timeout 15 ffmpeg -loglevel error -y -f v4l2 -i /dev/video99 -frames:v 1 -update 1 {remote}"],
                   capture_output=True)
    local = os.path.join(out, name + ".jpg").replace(os.sep, "/")
    subprocess.run(["python", SSH, "get", remote, local], capture_output=True, env=dict(os.environ, MSYS_NO_PATHCONV="1"))
    subprocess.run(["python", SSH, "run", f"rm -f {remote}"], capture_output=True)
    return local


def main(argv):
    out, cmd = argv[1], argv[2]
    if cmd == "js":
        src = open(os.path.join(HERE, argv[3]), encoding="utf-8").read()
        if len(argv) > 4:
            print(js(f"(window.__LGS_SGT_OPTS=window.__LGS_SGV={argv[4]}, 0)"))
        print(js(src))
    elif cmd == "eval":
        print(js(argv[3]))
    elif cmd == "grab":
        print(grab(out, argv[3], float(argv[4]) if len(argv) > 4 else 1.5))


if __name__ == "__main__":
    main(sys.argv)
