#!/usr/bin/env python3
"""Offline test of `motion`'s P-54 rule (P10, session 5; REQ C2a-R2->P10 (4)): lab/lab_motion.js on
tools/p2/fixtures/motion_page.html, finished by glass.py's motion_finish.

  python tools/p2/test_motion_page.py [--json]

P-54 ("nothing enters from the periphery: toasts, menus and sheets start <= 16 px from their rest position") judges
what enters; a target that was shown before the interaction and travels (a segmented control's selection pill) is a
move, listed and not judged by P-54. Runs the fixture in a local headless Chromium (Chrome or Edge, a fresh temporary
profile, 1280 x 720) with the lab helpers in their single-page mode. Exit 0 when every case passes, 1 otherwise,
3 when no browser is found. No device, no network.
"""
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import test_gates_page as tg  # noqa: E402  (browser discovery and the headless run)

PAGE = ROOT / "tools" / "p2" / "fixtures" / "motion_page.html"

# element id -> (entering expected, P-54 expected, listed as a move expected)
EXPECT = {
    "pill": (False, False, True),
    "menu": (True, True, False),
    "toast": (True, False, False),
    "sheet": (True, True, False),
    "drawer": (True, True, False),
}


def glass():
    spec = importlib.util.spec_from_file_location("glass_for_test", ROOT / "glass.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def run():
    exe = tg.browser()
    if not exe:
        return None, "no Chrome, Edge or Chromium found"
    tg.PAGE = PAGE                  # test_gates_page.run_once loads its module-level PAGE
    return tg.run()


def main(argv):
    res, err = run()
    if err:
        print(f"BLOCKED: {err}")
        return 3
    if res.get("error"):
        print("ERROR " + res["error"])
        return 1
    ids = {str(k): v for k, v in (res.get("targetIds") or {}).items()}
    fin = glass().motion_finish(dict(res, step={"media": []}, atRest={}, nonToken=[]))
    cases = []
    for name, (ent, p54, move) in EXPECT.items():
        keys = [k for k, v in ids.items() if v == name]
        anims = [a for a in res.get("animations", []) if str(a.get("id")) in keys]
        names = {f"on {a.get('target')}" for a in anims}
        got_ent = [a.get("entering") for a in anims]
        got_p54 = any(i.startswith("P-54") and any(n in i for n in names) for i in fin["geometryIssues"])
        got_move = any(any(n in m for n in names) for m in fin.get("moves", []))
        ok = bool(anims) and all(e is ent for e in got_ent) and got_p54 == p54 and got_move == move
        cases.append({"name": name, "pass": ok, "entering": got_ent, "p54": got_p54, "move": got_move,
                      "expected": {"entering": ent, "p54": p54, "move": move}})
    if "--json" in argv:
        print(json.dumps({"cases": cases, "geometryIssues": fin["geometryIssues"], "moves": fin.get("moves")}, indent=1))
    else:
        for c in cases:
            print(f"{'PASS' if c['pass'] else 'FAIL'} {c['name']}: entering {c['entering']}, P-54 {c['p54']}, "
                  f"move {c['move']}" + ("" if c["pass"] else f"  (expected {c['expected']})"))
        print("geometry issues:", fin["geometryIssues"])
        print("moves:", fin.get("moves"))
    ok = all(c["pass"] for c in cases)
    print("overall:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
