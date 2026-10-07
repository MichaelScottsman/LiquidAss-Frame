#!/usr/bin/env python3
"""TL-3 (P10): `glass.py pad-bfs` reaches the same set on a Settings page as SET's settings-pad.js.

  python tools/p2/tl3_settings_pad.py [--route /settings/system] [--bfs FILE.json]

1. Runs docs/phase2/concepts/settings-pad.js unchanged ({pages: [route]}) in one locked `glass.py js` step, with
   L.pad wrapped to record, after every D-pad move, the focused element's BFS key (L.bfs.keyOf) and route.
2. Runs `glass.py pad-bfs --route R` (or reads --bfs FILE from an earlier run).
3. Compares the two sets of keys on the route itself (settings-pad only walks the page's content column and the
   sidebar). PASS when every element settings-pad reached on the route is a BFS node, and every BFS node in the
   content column (x >= the sidebar's right edge, below the header) is one settings-pad reached.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

WRAP = r"""
(async () => {
  const keyOf = L.bfs.keyOf, D = L.surface('main').document, seen = [];
  const gp = () => { const a = [...D.querySelectorAll('.gpfocus')].filter((e) => L.navNode(e)); return a.length ? a[a.length - 1] : null; };
  const orig = L.pad;
  L.pad = async (...a) => { const r = await orig(...a); const g = gp(); if (g) { const b = g.getBoundingClientRect(); seen.push({ key: keyOf(g), route: L.route(), x: Math.round(b.x), y: Math.round(b.y), text: (g.innerText || '').trim().slice(0, 30) }); } return r; };
  let out;
  try { out = await (%s)(%s); } finally { L.pad = orig; }
  return { setpad: JSON.parse(out), seen };
})()
"""


def run(args, timeout=900):
    r = subprocess.run([sys.executable, str(ROOT / "glass.py")] + args, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=timeout)
    return r.returncode, r.stdout, r.stderr


def main(argv):
    route = "/settings/system"
    bfs_file = None
    if "--route" in argv:
        route = argv[argv.index("--route") + 1]
        m = re.match(r"^[A-Za-z]:[/\\](?:Program Files[/\\])?Git([/\\].*)$", route)   # Git Bash path mangling
        if m:
            route = m.group(1).replace("\\", "/")
    if "--bfs" in argv:
        bfs_file = argv[argv.index("--bfs") + 1]
    src = (ROOT / "docs/phase2/concepts/settings-pad.js").read_text(encoding="utf-8")
    src = src[src.index("(async (O)"):].rstrip().rstrip(";")
    # L.bfs is installed by the lab helpers (lab_bfs.js); settings-pad.js runs unchanged inside the wrapper.
    js = WRAP % (src, json.dumps({"pages": [route], "maxRows": 70}))
    code, o, e = run(["js", js])
    if code:
        print(o, e)
        return 3
    sp = json.loads(o)
    if not bfs_file:
        tmp = Path(tempfile.mkdtemp(prefix="tl3-")) / "bfs.json"
        code, o, e = run(["pad-bfs", "--route", route, "--budget", "300", "--out", str(tmp), "--raw"])
        bfs_file = str(tmp)
    bfs = json.loads(Path(bfs_file).read_text(encoding="utf-8"))
    nodes = {}
    for n in bfs["nodes"]:
        if n["route"] == route:
            nodes.setdefault(n.get("key") or "", n)
    side_right = 256
    sp_keys = {s["key"]: s for s in sp["seen"] if s["route"] == route}
    bfs_keys = {n["key"]: n for n in bfs["nodes"] if n["route"] == route and "key" in n}
    content_bfs = {k: n for k, n in bfs_keys.items() if n["rect"][0] >= side_right and n["rect"][1] >= 40}
    content_sp = {k: s for k, s in sp_keys.items() if s["x"] >= side_right}
    missing_in_bfs = sorted(set(content_sp) - set(bfs_keys))
    extra_in_bfs = sorted(set(content_bfs) - set(content_sp))
    res = {"route": route, "settingsPadRows": sp["setpad"]["pages"][0]["rows"], "settingsPadContent": len(content_sp),
           "bfsContent": len(content_bfs), "missingInBfs": missing_in_bfs, "extraInBfs": extra_in_bfs,
           "pass": bool(content_sp) and not missing_in_bfs and not extra_in_bfs, "bfsFile": bfs_file}
    if "--bfs" not in argv:
        # keep a redacted copy as the baseline (hashed texts), never the raw one (a serial number is on screen)
        sys.path.insert(0, str(ROOT))
        import glass
        base = ROOT / "tools" / "p2" / "baselines" / f"padbfs_{route.strip('/').replace('/', '_')}.json"
        base.write_text(json.dumps(glass.redact_bfs(bfs), indent=1), encoding="utf-8")
        Path(bfs_file).unlink()
        try:
            Path(bfs_file).parent.rmdir()       # the mkdtemp folder (review R1 m9)
        except OSError:
            pass
        res["bfsFile"] = str(base.relative_to(ROOT))
    for k in ("missingInBfs", "extraInBfs"):
        res[k] = [x.split("|")[0] + "|" + (__import__("glass").redact_text(x.split("|", 1)[1]) if "|" in x else "") for x in res[k]]
    print(json.dumps(res, indent=1))
    return 0 if res["pass"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
