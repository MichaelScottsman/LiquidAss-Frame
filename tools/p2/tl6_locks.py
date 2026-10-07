#!/usr/bin/env python3
"""TL-6 (P10): lock audit of the lab commands.

  python tools/p2/tl6_locks.py [--static-only]

1. Static review: every live command in lab/lab_p2cmd.py COMMANDS and the Phase 1 commands in lab/lab.py that
   navigate, click or capture take the locks contracts/lab.md section 2 gives them (read from the source).
2. Concurrent run on the device: A holds lab.lock for 6 s (`glass.py js` sleeping); B (`glass.py js`) starts 1.5 s
   later and must not run inside A's interval; C (`glass.py js --in vr:systemui`, lab-vr.lock) starts at the same
   time as B and is expected to run during A (the two locks are independent). Each records Date.now() on the Frame.
"""
import ast
import json
import re
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# command -> the lock it must take (contracts/lab.md section 2)
EXPECT = {
    "native_session": "native.lock, then lab.lock + lab-vr.lock for setup and return",
    "hv_grab": "lab-vr.lock", "gates": "lab.lock (lab-vr.lock for vr: surfaces)", "pad_bfs": "lab.lock",
    "focus_live": "lab.lock (lab-vr.lock for vr:)", "motion": "lab.lock (lab-vr.lock for vr:)",
    "sgcheck_live": "lab.lock + lab-vr.lock", "cmp_rects": "lab.lock (lab-vr.lock for vr:)",
    "conformance": "lab.lock (lab-vr.lock for vr:)",
}


def static_review():
    src = (ROOT / "lab" / "lab_p2cmd.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    funcs = {n.name: ast.get_source_segment(src, n) for n in tree.body if isinstance(n, ast.FunctionDef)}
    m = re.search(r"COMMANDS = \{(.*?)\}", src, re.S)
    cmds = dict(re.findall(r'"([\w-]+)":\s*(\w+)', m.group(1)))
    rows = []
    ok = True
    for cmd, fn in sorted(cmds.items()):
        body = funcs.get(fn, "")
        locks = []
        if "NATIVE_LOCK" in body:
            locks.append("native.lock")
        for lk in re.findall(r"with Lock\(([^)]*)\)", body):
            locks.append("lab.lock + lab-vr.lock" if "both=True" in lk else
                         ("lab-vr.lock" if 'vr:systemui' in lk else "lab.lock (by surface)"))
        good = bool(locks)
        if fn == "sgcheck_live":
            good = "lab.lock + lab-vr.lock" in locks
        if fn == "native_session":
            good = locks[:1] == ["native.lock"] and locks.count("lab.lock + lab-vr.lock") >= 2
        if fn == "hv_grab":
            good = "lab-vr.lock" in locks
        ok &= good
        rows.append({"command": cmd, "function": fn, "takes": locks, "expected": EXPECT.get(fn, "a lock"), "ok": good})
    lab = (ROOT / "lab" / "lab.py").read_text(encoding="utf-8")
    p1 = {}
    for c in ("nav", "back", "outline", "click", "js", "shot", "perf", "audit"):
        seg = re.search(r'elif cmd == "%s":(.*?)(?=\n    elif |\n    else:)' % c, lab, re.S)
        p1[c] = bool(seg and "with Lock(" in seg.group(1))
        ok &= p1[c]
    order_ok = "flock_wait(NATIVE_LOCK" in funcs.get("native_session", "") and \
        funcs["native_session"].index("flock_wait(NATIVE_LOCK") < funcs["native_session"].index("with Lock(both=True")
    ok &= order_ok
    # What each command touches (review R1 m1): a function that reads vr:systemui holds lab-vr.lock for it
    # (Lock(both=True), Lock(surface="vr:systemui") or vr_lock()); the flags file is written only under flags.lock.
    touches = {}
    for name, body in funcs.items():
        if 'surface="vr:systemui"' in body:
            touches[name] = ("both=True" in body or 'Lock(surface="vr:systemui")' in body or "with vr_lock()" in body)
    ok &= all(touches.values())
    step_src = lab[lab.index("class Step:"):lab.index("def native_on(")] if "def native_on(" in lab else ""
    flags_ok = step_src.count("with flags_file_lock()") >= 2 and "open(FLAGS_FILE, \"w\"" not in step_src \
        and "self.own_prev" in step_src
    ok &= flags_ok
    return {"commands": rows, "phase1": p1, "nativeBeforeLab": order_ok, "systemuiReads": touches,
            "flagsFileLocked": flags_ok, "pass": ok}


# Offline on the Frame (no Steam): lab.Lock with flock_wait stubbed to time out once, then a Step.apply that raises
# after writing; test lock files under /tmp/lgs/tl6-*.lock, never the real lab locks (review R1 M4).
LOCK_SAFETY_PY = r"""
import json, os, sys
sys.path.insert(0, os.path.expanduser('~/.local/share/glass-shell/lab'))
import lab
real = lab.flock_wait
st = {'n': 0, 'calls': [], 'undo': 0, 'applied': 0}
def fw(path, secs, what='lock'):
    st['n'] += 1
    if st['n'] == 1:
        raise SystemExit('lab: lock busy for 240 s (stub)')
    st['calls'].append(os.path.basename(path))
    return real(path.replace('lab.lock', 'tl6-test.lock').replace('lab-vr.lock', 'tl6-test-vr.lock'), 5, what)
lab.flock_wait = fw
lab.lab_js = lambda *a, **k: 0
class StepOK:
    def __init__(self, *a, **k): pass
    def apply(self): st['applied'] += 1
    def undo(self): st['undo'] += 1
class StepBad(StepOK):
    def apply(self):
        st['applied'] += 1
        raise RuntimeError('cdp error after writing (stub)')
out = {}
lab.Step = StepOK
try:
    with lab.Lock():
        pass
except SystemExit as e:
    out['firstRaised'] = str(e)
out['depthAfterTimeout'] = lab.Lock.depth
with lab.Lock():
    out['depthInside'] = lab.Lock.depth
    out['lockedOnSecond'] = len(st['calls']) == 1
out['depthAfterSecond'] = lab.Lock.depth
lab.Step = StepBad
try:
    with lab.Lock():
        out['bodyRanAfterBadApply'] = True
except RuntimeError as e:
    out['applyRaised'] = str(e)
out['undoAfterBadApply'] = st['undo']
out['depthAfterBadApply'] = lab.Lock.depth
lab.Step = StepOK
with lab.Lock():
    out['lockedAgain'] = len(st['calls']) == 3
out['pass'] = (out.get('firstRaised') is not None and out['depthAfterTimeout'] == 0 and out['lockedOnSecond']
               and out['depthAfterSecond'] == 0 and out.get('applyRaised') is not None and not out.get('bodyRanAfterBadApply')
               and out['undoAfterBadApply'] >= 2 and out['depthAfterBadApply'] == 0 and out['lockedAgain'])
for f in ('/tmp/lgs/tl6-test.lock', '/tmp/lgs/tl6-test-vr.lock'):
    try:
        os.remove(f)
    except OSError:
        pass
print(json.dumps(out))
"""


def lock_safety():
    sys.path.insert(0, str(ROOT))
    import glass
    import shlex
    c = glass.connect()
    try:
        code, o, e = glass.sh(c, f"{glass.PY} -c {shlex.quote(LOCK_SAFETY_PY)}", echo=False, timeout=60)
    finally:
        c.close()
    try:
        return json.loads(o.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return {"error": (o + e)[-600:], "pass": False}


def run(args, out, key):
    t = time.time()
    r = subprocess.run([sys.executable, str(ROOT / "glass.py")] + args, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=600)
    out[key] = {"start": t, "end": time.time(), "stdout": r.stdout.strip(), "code": r.returncode}


def concurrent():
    out = {}
    a = threading.Thread(target=run, args=(["js", "(async()=>{const t0=Date.now(); await L.sleep(6000); return [t0, Date.now()]})()"], out, "A"))
    b = threading.Thread(target=run, args=(["js", "Date.now()"], out, "B"))
    c = threading.Thread(target=run, args=(["js", "Date.now()", "--in", "vr:systemui"], out, "C"))
    a.start()
    time.sleep(1.5)
    b.start()
    c.start()
    for t in (a, b, c):
        t.join()
    try:
        a0, a1 = json.loads(out["A"]["stdout"])
        tb = int(out["B"]["stdout"].splitlines()[-1])
        tc = int(out["C"]["stdout"].splitlines()[-1])
    except (ValueError, KeyError, IndexError) as e:
        return {"error": f"could not parse: {e}", "raw": out, "pass": False}
    res = {"A": [a0, a1], "B": tb, "C": tc,
           "B_outside_A": not (a0 <= tb <= a1), "B_after_A_ms": tb - a1,
           "C_during_A": a0 <= tc <= a1}
    res["pass"] = res["B_outside_A"]
    return res


def main(argv):
    st = static_review()
    print("static review:")
    for r in st["commands"]:
        print(f"  {'ok ' if r['ok'] else 'BAD'} {r['command']:15} takes {', '.join(r['takes']) or 'nothing'}  (expected {r['expected']})")
    print("  Phase 1 steps under lab.lock: " + ", ".join(f"{k} {'ok' if v else 'BAD'}" for k, v in st["phase1"].items()))
    print(f"  native.lock taken before any lab lock: {'ok' if st['nativeBeforeLab'] else 'BAD'}")
    print("  vr:systemui reads under lab-vr.lock: " + (", ".join(f"{k} {'ok' if v else 'BAD'}" for k, v in st["systemuiReads"].items()) or "none"))
    print(f"  flags file under its own flags.lock, own keys restored: {'ok' if st['flagsFileLocked'] else 'BAD'}")
    ok = st["pass"]
    if "--static-only" not in argv:
        ls = lock_safety()
        print("lock exception safety (on the Frame, stubbed, test lock files):", json.dumps(ls))
        ok &= ls.get("pass", False)
        cc = concurrent()
        print("concurrent run:", json.dumps(cc))
        ok &= cc.get("pass", False)
    print("overall:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
