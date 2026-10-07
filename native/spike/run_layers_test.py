"""Live layering test with the user looking at the dashboard: publishes the
glassd.test overlay, injects the cover + floating crop into systemui, grabs
headset feed frames, records Steam's route/focus (to see laser clicks land),
then removes everything."""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
GS = os.path.dirname(os.path.dirname(HERE))
SSH = os.path.expanduser("~/.claude/skills/steam-frame-ssh/scripts/frame_ssh.py")
OUT = sys.argv[1]


def ssh(cmd, **kw):
    return subprocess.run(["python", SSH, "run", cmd], capture_output=True, text=True, encoding="utf-8", **kw)


def js(expr, where="vr:systemui"):
    args = ["python", os.path.join(GS, "glass.py"), "js", expr, "--keep"] + (["--in", where] if where else [])
    r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", cwd=GS)
    return (r.stdout + r.stderr).strip()[-500:]


def grab(name, delay=1.0):
    remote = f"/tmp/lgs/{name}.jpg"
    ssh(f"sleep {delay}; timeout 15 ffmpeg -loglevel error -y -f v4l2 -i /dev/video99 -frames:v 1 -update 1 {remote}")
    env = dict(os.environ, MSYS_NO_PATHCONV="1")
    subprocess.run(["python", SSH, "get", remote, os.path.join(OUT, name + ".jpg").replace("\\", "/")], capture_output=True, env=env)
    ssh(f"rm -f {remote}")
    print("frame", name, flush=True)


steam_state = "(()=>({route: SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.m_history.location.pathname, dash: true}))()"
print("before:", js(steam_state, where=None))
ssh("cd ~/glass-shell-native/native/spike && (nohup ./keytest 150 > /tmp/lgs/keytest.log 2>&1 &) ; sleep 1; cat /tmp/lgs/keytest.log")
grab("L0_before", 0.2)
layers = open(os.path.join(HERE, "sg_layers.js"), encoding="utf-8").read()
print("crop only:", js("(window.__LGS_SGT_OPTS={cover:false,crop:true,dz:0.03,lift:0.15}, 0)") , js(layers))
grab("L1_crop_only", 1.5)
print("cover+crop:", js("(window.__LGS_SGT_OPTS={cover:true,crop:true,dz:0.03,lift:0.15}, 0)"), js(layers))
grab("L2_cover_crop", 1.5)
print("now click/point (20 s)...", flush=True)
for i in range(2):
    time.sleep(3)
    print("  state:", js(steam_state, where=None))
grab("L3_cover_crop_late", 0.2)
print("remove:", js("(window.__LGS_SGT && window.__LGS_SGT.remove(), 'removed')"))
ssh("pkill -f 'keytest 150'")
grab("L4_after", 1.0)
print("after:", js(steam_state, where=None))
