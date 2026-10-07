"""C4a gate tools (docs/phase2/wp/C4a.md). Run from the repo root.

  python docs/phase2/mockups/controls-gates.py run OUTDIR [route ...]   # glass.py gates on C4a's routes, both modes
  python docs/phase2/mockups/controls-gates.py summary OUTDIR [--all]   # failures split by owning package

Environment: MODES=pad,laser (default). Wait until no native session runs (no html.lgs-native in the main window),
otherwise AUD contrast is measured over transparent window glass and every text on the window fails.
"""
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ROUTES = ["/zoo/buttons", "/zoo/toggles", "/zoo/sliders", "/zoo/dropdowns", "/zoo/fieldlayouts",
          "/zoo/misc", "/zoo/input", "/settings/system", "/settings/audio", "/settings/notifications"]
OWNERS = [
    (r"PagedSettingsDialog_PageList|PageListItem|PagedSettingsDialog_PageListColumn", "C6a (settings sidebar)"),
    (r"SearchBox|SearchField|SearchAndTitle|BackContainer|Profile>Header|BasicUiRoot|DialogHeader\b", "C1a/C1b (chrome)"),
    (r"contextMenu|BasicContextMenu|ModalPosition|GenericConfirmDialog", "C1c (presentations)"),
    (r"NotificationSectionHeader|%\{Toggles\}|%\{Sound\}|Toggles>|SHOW TOAST|PLAY SOUND", "C6a (notifications page)"),
    (r"Footer|Legend|ActionButton", "C1a (ornament)"),
]


def owner(el):
    for pat, o in OWNERS:
        if re.search(pat, el):
            return o
    return "C4a?"


def run(out, routes):
    os.makedirs(out, exist_ok=True)
    for r in routes or ROUTES:
        for m in os.environ.get("MODES", "pad,laser").split(","):
            name = r.strip("/").replace("/", "_") + "_" + m
            t = time.time()
            p = subprocess.run([sys.executable, "glass.py", "gates", "main", "--route", r, "--mode", m, "--flags", "wp.p3", "--json"],
                               cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900)
            with open(os.path.join(out, name + ".json"), "w", encoding="utf-8") as f:
                f.write(p.stdout)
            try:
                d = json.loads(p.stdout)
            except ValueError:
                print(name, "NO JSON", p.stderr[-400:], flush=True)
                continue
            summ = {k: (v.get("pass"), v.get("failCount", len(v.get("issues", [])) if k == "AUD" else None))
                    for k, v in d["gates"].items()}
            print(f"{name} pass={d['pass']} {summ} {round(time.time() - t)}s", flush=True)


def summary(d, show_all=False):
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".json"):
            continue
        try:
            with open(os.path.join(d, fn), encoding="utf-8") as f:
                r = json.load(f)
        except ValueError as e:
            print(fn, "unreadable", e)
            continue
        g = r["gates"]
        line, mine = [fn[:-5], "PASS" if r["pass"] else "fail"], []
        for k in ("AUD", "SIZE", "TYPE", "OUTLINE", "MOTION"):
            v = g.get(k, {})
            items = list((v.get("issues") if k == "AUD" else v.get("fails")) or [])
            if k == "OUTLINE":
                items += [dict(e, why="edge ratio %s" % e["ratio"]) for e in v.get("edges", []) if not e.get("pass")]
            if k == "MOTION":
                ar = v.get("atRest") or {}
                items = list(v.get("nonToken") or []) if isinstance(v.get("nonToken"), list) else []
                if ar.get("count") or ar.get("running") or ar.get("lgsLeft"):
                    items.append({"el": "atRest", "why": json.dumps(ar)[:200]})
            by = {}
            for it in items:
                it = {"el": it} if isinstance(it, str) else it
                by.setdefault(owner(it.get("el") or json.dumps(it)[:120]), []).append(it)
            line.append(f"{k}:{'P' if v.get('pass') else 'F'}"
                        + ("(" + ", ".join(f"{o}={len(x)}" for o, x in by.items()) + ")" if by else ""))
            mine += [(k, it) for it in by.get("C4a?", [])]
        print("  ".join(line))
        for k, it in mine[: (999 if show_all else 12)]:
            print("     C4a?", k, json.dumps(it)[:330])


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in ("run", "summary"):
        print(__doc__)
        sys.exit(2)
    if sys.argv[1] == "run":
        run(sys.argv[2], sys.argv[3:])
    else:
        summary(sys.argv[2], "--all" in sys.argv)
