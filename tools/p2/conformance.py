#!/usr/bin/env python3
"""`glass.py conformance`: the VP section 6 checklist, automated where it can be (P10, contracts/lab.md section 4).

  python glass.py conformance [--route R]... [--only P-01,P-14] [--pad] [--json] [--out FILE] [step options]

Reads the 89 P-items from docs/phase2/research/visionos-principles.md section 6 (id, requirement, severity, verify
code). For each route (default: the PLAN 4.2 rows that need no pre and show no personal names), one locked step
gathers the G-SIZE / G-TYPE / G-OUTLINE / G-MOTION sweeps, the AUD diff (theme off vs on), the DOM and CSS checks of
lab/lab_conf.js and, inside a native session, the depth model (sgcheck). With --pad it also runs pad-bfs per route
(slow) for P-20, P-22 and P-23. Each item prints one line:

  P-38 PASS|FAIL|MANUAL|BLOCKED|N/A <detail>

MANUAL: REV, MOCK, FILM and HV items and anything not automated (an agent judges and records it). BLOCKED: needs
what this run lacks (a native session for SG items, --pad for PAD items, --mode pad for P-13), or a route that gave
no result at all (lab lock busy, CDP error, device unreachable): then every automated item is BLOCKED for it and the
command exits 3. Exit 1 when a "must" item FAILs, 3 when a route gave no result, else 0.

The depth items (P-11, P-46, P-47, P-48, P-51) need the native layer: run one route as a native-session step,
`glass.py native-session --step "conformance --route R"`; the session finishes it on the PC (finish_one).
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VP = ROOT / "docs" / "phase2" / "research" / "visionos-principles.md"
DEFAULT_ROUTES = ["/library/home", "/library/tab/AllGames", "/library/downloads", "/settings/system", "/media/grid"]


def items():
    out = []
    on = False
    for line in VP.read_text(encoding="utf-8").splitlines():
        if line.startswith("## 6."):
            on = True
            continue
        if on and line.startswith("## ") and not line.startswith("## 6."):
            break
        m = re.match(r"^\| (P-\d+) \| (.+?) \| (must|should) \| (.+?) \| (.*)\|$", line)
        if on and m:
            out.append({"id": m.group(1), "req": re.sub(r"\*\*", "", m.group(2)), "sev": m.group(3), "verify": m.group(4)})
    return out


def p23_bottom(layout):
    """P-23's bottom bound (PLAN R2-11, REQ Coordinator->P10 (2)): 612 (the ornament's top at 628 - 16) on a route
    with a bottom ornament (a rendered #Footer legend), else the glass bottom - 16 (640 on `window`, 704 on
    `window-full` and `windowless`). VP's 620 is read as 612. Without layout data (an older lab) 612."""
    if not layout:
        return 612.0, "bottom ornament assumed (no layout data)"
    if layout.get("ornament"):
        return 612.0, "bottom ornament"
    gb = float(layout.get("glassBottom") or layout.get("height") or 720)
    return gb - 16, f"no ornament: glass bottom {gb:g} - 16"


def verdicts(r, bfs=None):
    """{P-id: (state, detail)} for one route's @@conf result."""
    v = {}
    g = r.get("gates", {})
    size, typ, out = g.get("SIZE", {}), g.get("TYPE", {}), g.get("OUTLINE", {})

    def by_rule(gate, rule):
        return [f for f in gate.get("fails", []) if f.get("rule") == rule]

    def ex(fs, n=3):
        return "; ".join(f"{f['el']} {f['why']}" for f in fs[:n])
    for pid, rule in (("P-08", "P-08"), ("P-80", "P-80"), ("P-83", "P-83")):
        fs = by_rule(size, rule)
        v[pid] = ("FAIL" if fs else "PASS", f"{len(fs)} of {size.get('checked')} controls" + (": " + ex(fs) if fs else ""))
    exf = [e for e in size.get("exempt", []) if e.get("pass") is False]
    if exf:   # an exemption replaces P-80 / P-08 with its own criterion (PLAN 1.16)
        v["P-80"] = ("FAIL", v["P-80"][1] + f"; {len(exf)} exemption(s) failing their criterion: "
                     + "; ".join(f"{e['id']} {e['el']} {e.get('why', '')}" for e in exf[:3]))
    aud = g.get("AUD")
    if aud is not None:
        shr = [i for i in aud.get("issues", []) if i.startswith("SHRUNK")]
        if shr:
            v["P-08"] = ("FAIL", v["P-08"][1] + f"; AUD SHRUNK {len(shr)}: " + "; ".join(shr[:2]))
        con = [i for i in aud.get("issues", []) if i.startswith("CONTRAST")]
        v["P-39"] = ("FAIL" if con else "PASS", f"AUD CONTRAST {len(con)}" + (": " + "; ".join(con[:3]) if con else ""))
    else:
        v["P-39"] = ("N/A", "stock run (--stock): no themed-vs-stock diff")
    t_size = [f for f in typ.get("fails", []) if re.search(r"size|weight", f["why"])]
    t_case = [f for f in typ.get("fails", []) if re.search(r"uppercase|tracking|italic", f["why"])]
    v["P-38"] = ("FAIL" if t_size else "PASS", f"{len(t_size)} of {typ.get('checked')} text runs" + (": " + ex(t_size) if t_size else ""))
    v["P-84"] = ("FAIL" if t_case else "PASS", f"{len(t_case)}" + (": " + ex(t_case) if t_case else ""))
    for pid in ("P-42", "P-43"):
        fs = by_rule(out, pid)
        v[pid] = ("FAIL" if fs else "PASS", f"{len(fs)} on {out.get('glass')} glass elements" + (": " + ex(fs) if fs else ""))
    mo = g.get("MOTION", {})
    rest = mo.get("atRest", {})
    left = rest.get("running", []) + rest.get("lgsLeft", []) + rest.get("infinite", [])
    v["P-52"] = ("FAIL" if left else "PASS", f"{len(left)} animations at rest" + (": " + "; ".join(left[:3]) if left else "")
                 + " (after the route settles; interactions: glass.py motion)")
    css = mo.get("cssNonToken", [])
    v["P-58"] = ("FAIL" if css else "PASS", f"{len(css)} non-token durations in our CSS" + (": " + "; ".join(css[:2]) if css else "")
                 + " (live animations: glass.py motion)")
    for pid, c in (r.get("conf") or {}).items():
        st = "N/A" if c.get("pass") is None else ("PASS" if c["pass"] else "FAIL")
        if pid == "P-13" and c.get("pass") is None:
            st = "BLOCKED"
        v[pid] = (st, c.get("detail", ""))
    sgm = r.get("sgmodel")
    if sgm:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import sgcheck
        res = sgcheck.check_live(sgm)
        for pid, rules in (("P-46", ("R7",)), ("P-47", ("R5",)), ("P-48", ("R9",)), ("P-51", ("R6",))):
            fs = [f for f in res["fails"] if f["rule"] in rules]
            v[pid] = ("FAIL" if fs else "PASS", f"{len(fs)}" + (": " + "; ".join(f"{f['surface']}/{f['pop']} {f['why']}" for f in fs[:2]) if fs else ""))
        r8 = [f for f in res["fails"] if f["rule"] == "R8"]
        v["P-11"] = ("FAIL" if r8 else "PASS", "interactive crops in the default profile: " + str(len(r8))
                     + " (laser-hiding flags: REV)")
    else:
        for pid in ("P-11", "P-34", "P-46", "P-47", "P-48", "P-49", "P-50", "P-51"):
            v.setdefault(pid, ("BLOCKED", "native layer off (run conformance as a native-session step)"))
    if bfs:
        unre, irr = bfs.get("unreached", []), bfs.get("irreversible", [])
        v["P-20"] = ("PASS" if not unre and not irr and not bfs.get("truncated") else "FAIL",
                     f"{len(bfs.get('nodes', []))} nodes, {len(unre)} unreached, {len(irr)} irreversible"
                     + (", truncated" if bfs.get("truncated") else ""))
        e = bfs.get("entry") or {}
        bad = bool(re.search(r"Back|SearchBox|frame\.menu", e.get("el", "") + " " + e.get("text", ""))) or (e.get("rect") or [0, 99])[1] < 40
        v["P-22"] = ("FAIL" if bad else "PASS", f"entry focus {e.get('el', '')[:60]} \"{e.get('text', '')[:24]}\" at {e.get('rect')}")
        bottom, why = p23_bottom(r.get("layout"))
        outside = [n for n in bfs.get("nodes", []) if n.get("route") == bfs.get("route") and n.get("rect")
                   and (n["rect"][1] < 124 or n["rect"][1] + n["rect"][3] > bottom)
                   and not re.search(r"SearchBox|Back", n.get("el", ""))]
        v["P-23"] = ("FAIL" if outside else "PASS", f"{len(outside)} focused rects outside y 124..{bottom:g} ({why})"
                     + (": " + "; ".join(f"{n['el'][:30]} {n['rect']}" for n in outside[:3]) if outside else ""))
    return v


# What one route's result can decide (review R1 M3): the DOM gates, lab_conf.js's checks and, in a native session,
# the depth model; with --pad also pad-bfs's items. A route without a result leaves these BLOCKED, never MANUAL.
AUTO_DOM = ("P-08", "P-80", "P-83", "P-39", "P-38", "P-84", "P-42", "P-43", "P-52", "P-58")
AUTO_JS = ("P-01", "P-02", "P-13", "P-17", "P-31", "P-33", "P-40", "P-45", "P-72", "P-81", "P-82", "P-85", "P-86",
           "P-87", "P-89")
AUTO_SG = ("P-11", "P-34", "P-46", "P-47", "P-48", "P-49", "P-50", "P-51")
AUTO_PAD = ("P-20", "P-22", "P-23")
NO_RESULT = "no result (lab lock busy, CDP error or device unreachable)"


def merge(per_route, catalogue, only=None, pad=False):
    """per_route: {route: {P-id: (state, detail)}, or None when the route gave no result}."""
    auto = set(AUTO_DOM + AUTO_JS + AUTO_SG) | (set(AUTO_PAD) if pad else set())
    missing = [r for r, v in per_route.items() if v is None]
    have = {r: v for r, v in per_route.items() if v is not None}
    rows = []
    for it in catalogue:
        if only and it["id"] not in only:
            continue
        states, details = [], []
        for route, v in have.items():
            if it["id"] in v:
                s, d = v[it["id"]]
                states.append(s)
                if s in ("FAIL", "BLOCKED") or len(have) == 1:
                    details.append(f"{route}: {d}")
        if "FAIL" in states:
            st, det = "FAIL", " | ".join(details)
        elif missing and it["id"] in auto:
            st, det = "BLOCKED", f"{', '.join(missing)}: {NO_RESULT}"
        elif not states:
            code = it["verify"]
            if it["id"] in AUTO_PAD:
                st, det = "BLOCKED", "run with --pad (pad-bfs)"
            else:
                st, det = "MANUAL", f"verify: {code[:110]}"
        elif all(s == "BLOCKED" for s in states):
            st, det = "BLOCKED", " | ".join(details[:1])
        elif all(s in ("N/A", "BLOCKED") for s in states):
            st, det = "N/A", " | ".join(details[:1]) or "not applicable on these routes"
        else:
            st, det = "PASS", " | ".join(details) if details else f"{len(states)} route(s)"
        rows.append({"id": it["id"], "sev": it["sev"], "state": st, "detail": det, "req": it["req"][:120], "verify": it["verify"]})
    return rows


def report(routes, per_route, raw, rows, as_json=False, outp=None, header="conformance"):
    """Print and save one run; returns the exit code: 1 a must item FAILs, 3 a route gave no result, else 0."""
    counts = {}
    for x in rows:
        counts[x["state"]] = counts.get(x["state"], 0) + 1
    must_fail = [x["id"] for x in rows if x["state"] == "FAIL" and x["sev"] == "must"]
    missing = [r for r, v in per_route.items() if v is None]
    out = {"routes": routes, "runs": raw, "items": rows, "counts": counts, "mustFail": must_fail,
           "missingRoutes": missing, "pass": not must_fail and not missing}
    if outp:
        Path(outp).parent.mkdir(parents=True, exist_ok=True)
        Path(outp).write_text(json.dumps(out, indent=1), encoding="utf-8")
    if as_json:
        print(json.dumps(out, indent=1))
    else:
        b = next(iter(raw.values()), {})
        print(f"{header} on {', '.join(routes)}  (build {b.get('build')}, {b.get('date')}, native {b.get('native', '?')}, "
              f"step {json.dumps(b.get('step'))})")
        for x in rows:
            print(f"{x['id']} {x['state']:7} [{x['sev']}] {x['detail'][:260]}")
        print(f"counts {counts}; must items failing: {', '.join(must_fail) or 'none'}")
        if missing:
            print(f"BLOCKED: {', '.join(missing)}: {NO_RESULT}; their automated items are BLOCKED (exit 3)")
    return 1 if must_fail else (3 if missing else 0)


def run(argv, lab_conf, lab_bfs):
    argv = list(argv)
    as_json = "--json" in argv
    if as_json:
        argv.remove("--json")
    pad = "--pad" in argv
    if pad:
        argv.remove("--pad")
    outp = None
    if "--out" in argv:
        i = argv.index("--out")
        outp = argv[i + 1]
        del argv[i:i + 2]
    only = None
    if "--only" in argv:
        i = argv.index("--only")
        only = set(argv[i + 1].split(","))
        del argv[i:i + 2]
    routes = []
    while "--route" in argv:
        i = argv.index("--route")
        routes.append(argv[i + 1])
        del argv[i:i + 2]
    routes = routes or DEFAULT_ROUTES
    cat = items()
    per_route, raw = {}, {}
    for r in routes:
        res = lab_conf(["--route", r] + argv)
        if not res:
            per_route[r] = None          # a route without a result is BLOCKED, never a silent pass (review R1 M3)
            continue
        bfs = lab_bfs(["--route", r] + [a for a in argv if a in ("--stock",)]) if pad else None
        per_route[r] = verdicts(res, bfs)
        if pad and not bfs:
            for pid in AUTO_PAD:
                per_route[r][pid] = ("BLOCKED", "pad-bfs gave no result")
        raw[r] = {"build": res.get("build"), "date": res.get("date"), "native": res.get("native"), "step": res.get("step")}
    rows = merge(per_route, cat, only, pad=pad)
    return report(routes, per_route, raw, rows, as_json=as_json, outp=outp)


def finish_one(res, as_json=False):
    """PC half of one `conformance` step a native-session announced (@@conf): the depth items (P-11, P-46, P-47,
    P-48, P-51) come from its scene-graph model (review R1 m5)."""
    route = res.get("route") or "?"
    per_route = {route: verdicts(res)}
    raw = {route: {"build": res.get("build"), "date": res.get("date"), "native": res.get("native"), "step": res.get("step")}}
    rows = merge(per_route, items(), None)
    return report([route], per_route, raw, rows, as_json=as_json, header="conformance (native-session step)")
