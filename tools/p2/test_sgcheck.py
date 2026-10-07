#!/usr/bin/env python3
"""TL-4 (P10): every fixture in tools/p2/fixtures/sg_*.json flags exactly the rules in its "_expect" list.

  python tools/p2/test_sgcheck.py
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sgcheck  # noqa: E402


def main():
    ok = True
    for f in sorted((Path(__file__).parent / "fixtures").glob("sg_*.json")):
        m = json.loads(f.read_text(encoding="utf-8"))
        r = sgcheck.check(m)
        got = sorted({x["rule"] for x in r["fails"]})
        want = m.get("_expect", [])
        good = got == want
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {f.name}: expected {want or 'clean'}, got {got or 'clean'}"
              + ("" if good else "  " + json.dumps(r["fails"])[:400]))
    print("overall:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
