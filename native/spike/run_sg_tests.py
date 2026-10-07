"""Runs the scene-graph tests with the dashboard open and grabs one headset
feed frame after each step (frames show the room: they are downloaded to the
scratchpad, looked at, and deleted)."""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GS = os.path.dirname(os.path.dirname(HERE))
SSH = os.path.expanduser("~/.claude/skills/steam-frame-ssh/scripts/frame_ssh.py")
OUT = sys.argv[1] if len(sys.argv) > 1 else HERE


def js(expr, where="vr:systemui"):
    args = ["python", os.path.join(GS, "glass.py"), "js", expr, "--keep"]
    if where:
        args += ["--in", where]
    r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", cwd=GS)
    return (r.stdout + r.stderr).strip()[-600:]


def grab(name):
    remote = f"/tmp/lgs/{name}.jpg"
    subprocess.run(["python", SSH, "run", f"sleep 1.5; timeout 15 ffmpeg -loglevel error -y -f v4l2 -i /dev/video99 -frames:v 1 -update 1 {remote}"],
                   capture_output=True)
    env = dict(os.environ, MSYS_NO_PATHCONV="1")
    subprocess.run(["python", SSH, "get", remote, os.path.join(OUT, name + ".jpg").replace("\\", "/")], capture_output=True, env=env)
    subprocess.run(["python", SSH, "run", f"rm -f {remote}"], capture_output=True)
    print("frame", name)


steps = sys.argv[2:] if len(sys.argv) > 2 else ["show", "crop", "mount"]
if "show" in steps:
    print("show:", js("(async()=>{ await SteamClient.OpenVR.VROverlay.ShowDashboard(); return await SteamClient.OpenVR.VROverlay.IsDashboardVisible(); })()", where=None))
    grab("sg0_dashboard")
if "crop" in steps:
    print("crop:", js(open(os.path.join(HERE, "sg_inject.js"), encoding="utf-8").read()))
    grab("sg1_crop")
    print("remove:", js("(window.__LGS_SG_TEST && window.__LGS_SG_TEST.remove(), 'removed')"))
if "mount" in steps:
    print("mount:", js(open(os.path.join(HERE, "sg_mount_test.js"), encoding="utf-8").read()))
    grab("sg2_mount_opacity0")
    print("restore:", js("(window.__LGS_SG_MT && window.__LGS_SG_MT.restore(), 'restored')"))
    grab("sg3_restored")
