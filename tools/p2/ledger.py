#!/usr/bin/env python3
"""`glass.py ledger`: the function ledger (P10, contracts/lab.md section 3; PLAN 4.5).

  python glass.py ledger [--out FILE] [--json] [--quiet]

Reads every audit's function list (docs/phase2/audit/*.md section A: rows whose first cell is an id such as H1,
AC3, PF2) and every concept's function retention table (docs/phase2/concepts/*.md, the "Function retention table"
section), and writes one CSV row per concept row:

  audit_id,function,concept,owner,laser_path,gamepad_path,test_id,status

audit_id is "<AUDIT>-<id>" (SN shell-nav, LA library-apps, GP game-pages, SY system, SM social-media). A concept row's
audit is the one its id names ("SN H1"), else the first audit code in the nearest heading above its table
("### 12.1 Library home (LA A.1)"), else the concept's default audit. Rows whose id is the concept's own (not in
that audit's list) keep their id with the concept's code ("WN-...", "SET-...") and are flagged "own id".

owner: the row's Owner column, else the concept's owner package (PLAN 2.4).

status (review R1 M6: test ids are per concept and per package, so a PASS line elsewhere proves nothing): each test
id in the row's Test column is resolved in its own namespace, and only an evidence-table row in that namespace's
log counts:
  - "C1c AT-13" / "P3 IN-7": package C1c's (P3's) log, docs/phase2/wp/C1c.md;
  - "WN AT-9" / "SET T-VR" / "CC A3-A6": the logs of that concept's packages (window-nav: C1a, C1b, C1c; ...);
  - "PLAN-2c-2": package C2c's log;
  - a bare id ("AT-6", "C4"): the logs of the row's owner packages;
  - a gate name ("G-PAD"): as a bare id, and the evidence line must also name one of the row's routes;
  - exemption ids (E-BACK ...) are not tests.
A log line counts when it is a table row whose first cell starts with the id (or "<concept code> <id>",
"<package> <id>") and a later cell starts with PASS or holds **PASS**. "pass": every id has such a row; "partial":
some do; "static": [x] rows (actions tests never perform) without a test; else "open".

Exit 1 when an audit function is mapped by no concept (they are listed), or a row lacks a laser or gamepad path.
Default output: docs/phase2/verify/functions.csv (V2's file; other packages pass --out).
"""
import csv
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / "docs" / "phase2"
AUDITS = {"shell-nav": "SN", "library-apps": "LA", "game-pages": "GP", "system": "SY", "social-media": "SM"}
CODES = set(AUDITS.values())
CONCEPTS = {  # concept -> (code for its own ids, default audit, owner package)
    "window-nav": ("WN", "SN", "C1a"), "home-apps": ("HA", "LA", "C2a"), "control-center": ("CC", "SY", "C3b"),
    "controls": ("CTL", "SY", "C4a"), "game-pages": ("GPC", "GP", "C5a"), "settings": ("SET", "SY", "C6a"),
    "social-media": ("SMC", "SM", "C7"),
}
ID = re.compile(r"^(?:(SN|LA|GP|SY|SM)[ -])?\**([A-Z]{1,3}\d+[a-z]?)\**(?:$|\s*\()")   # "E6 (new)" too


def cells(line):
    s = line.strip()
    if not (s.startswith("|") and s.endswith("|")):
        return None
    parts = re.split(r"(?<!\\)\|", s[1:-1])
    return [p.strip() for p in parts]


def plain(t):
    return re.sub(r"\s+", " ", re.sub(r"[*`]", "", t or "")).strip()


def audit_functions():
    out = {}
    for f in sorted((D / "audit").glob("*.md")):
        code = AUDITS.get(f.stem)
        if not code:
            continue
        txt = f.read_text(encoding="utf-8").splitlines()
        on = False
        for line in txt:
            if line.startswith("## "):
                on = line.startswith("## A.") or line.startswith("## A ")
                continue
            if not on:
                continue
            c = cells(line)
            if not c or len(c) < 2 or set(c[0]) <= set("-: "):
                continue
            m = ID.match(plain(c[0]))
            if m and c[0] != "#":
                aid = f"{code}-{m.group(2)}"
                out.setdefault(aid, plain(c[1])[:120])
    return out


def concept_rows(audit_ids):
    rows = []
    for f in sorted((D / "concepts").glob("*.md")):
        if f.stem not in CONCEPTS:
            continue
        own, default_audit, owner = CONCEPTS[f.stem]
        lines = f.read_text(encoding="utf-8").splitlines()
        on = False
        heading_code = default_audit
        header = None
        for line in lines:
            if line.startswith("## "):
                on = "etention" in line
                header = None
                continue
            if not on:
                continue
            if line.startswith("#"):
                codes = re.findall(r"\b(SN|LA|GP|SY|SM)\b", line)
                heading_code = codes[0] if codes else default_audit
                header = None
                continue
            c = cells(line)
            if c is None:
                header = None
                continue
            if header is None:
                header = [plain(x).lower() for x in c]
                continue
            if set("".join(c)) <= set("-: "):
                continue
            row = dict(zip(header, c))
            rid = plain(row.get("#") or row.get("id") or c[0])
            m = ID.match(rid)
            if not m:
                continue
            code = m.group(1) or heading_code
            aid = f"{code}-{m.group(2)}"
            own_id = aid not in audit_ids
            if own_id:
                aid = f"{own}-{m.group(2)}"

            def col(*names):
                for n in names:
                    for k, v in row.items():
                        if k == n or k.startswith(n):
                            return plain(v)
                return ""
            fn = col("function")
            rows.append({
                "audit_id": aid, "function": fn[:160], "concept": f.stem,
                "owner": col("owner") or owner, "laser_path": col("laser"),
                "gamepad_path": col("gamepad", "pad"), "test_id": col("test"),
                "action": "[x]" in fn, "own_id": own_id,
            })
    return rows


# Concept code -> its packages (PLAN 2.4); a package's own log is docs/phase2/wp/<PKG>.md.
CONCEPT_PKGS = {"WN": ("C1a", "C1b", "C1c"), "HA": ("C2a", "C2b", "C2c"), "CC": ("C3a", "C3b"),
                "CTL": ("C4a", "C4b"), "GPC": ("C5a", "C5b"), "SET": ("C6a", "C6b"), "SMC": ("C7",)}
CONCEPT_PKGS.update({"SM": CONCEPT_PKGS["SMC"], "GP": CONCEPT_PKGS["GPC"]})   # audit codes used as test namespaces
CODE_OF = {f: v[0] for f, v in CONCEPTS.items()}          # concept file -> code
PKG = re.compile(r"^(?:C\d[a-z]?|P\d{1,2}|V\d)$")
TEST_ID = re.compile(r"^(?:AT-\d+[a-z]?|[A-Z]{1,4}-[A-Z][A-Z0-9-]*|[A-Z]{1,4}-\d+[a-z]?|PLAN-\d+[a-z]?-\d+[a-z]?|G-[A-Z]+|"
                     r"[A-Z]{1,3}\d+[a-z]?(?:[\u2013-][A-Z]{0,3}\d+[a-z]?)?)$")
_LOGS = {}


def log_rows(pkg):
    """[(first cell, [other cells])] of the table rows in docs/phase2/wp/<pkg>.md (cached)."""
    if pkg not in _LOGS:
        rows = []
        f = D / "wp" / f"{pkg}.md"
        if f.exists():
            for line in f.read_text(encoding="utf-8").splitlines():
                c = cells(line)
                if c and len(c) >= 3 and not set("".join(c)) <= set("-: "):
                    rows.append((plain(c[0]), [plain(x) for x in c[1:]], line))
        _LOGS[pkg] = rows
    return _LOGS[pkg]


def passed(cells_):
    return any(x.startswith("PASS") for x in cells_) or any("**PASS**" in x for x in cells_)


def test_refs(text):
    """[(namespace or None, id)] from a Test cell: "C1c AT-11, AT-11b; SET T-MENU" -> (C1c, AT-11), (C1c, AT-11b),
    (SET, T-MENU). A namespace (package or concept code) holds until the next ';'. Ranges "A3-A6" expand."""
    out = []
    for group in re.split(r";| and ", text or ""):
        toks = re.findall(r"[A-Za-z][\w.\u2013-]*|[,()]", group)
        ns = None
        for k, t in enumerate(toks):
            nxt = toks[k + 1] if k + 1 < len(toks) else ""
            if (t in CONCEPT_PKGS or PKG.match(t)) and nxt and TEST_ID.match(nxt) and not t.startswith("E-"):
                ns = t
                continue
            if t.startswith("E-") or not TEST_ID.match(t) or t in ("A", "AT"):
                continue
            m = re.match(r"^([A-Z]{1,3})(\d+)[\u2013-]\1?(\d+)$", t)
            if m:
                out += [(ns, f"{m.group(1)}{n}") for n in range(int(m.group(2)), int(m.group(3)) + 1)]
            else:
                out.append((ns, t))
    return out


def row_pkgs(row):
    pk = re.findall(r"\b(C\d[a-z]?|P\d{1,2})\b", row["owner"] or "")
    return list(dict.fromkeys(pk)) or [CONCEPTS[row["concept"]][2]]


def ref_passes(row, ns, tid):
    """Evidence for one test id of a row: (True, "PKG: first cell") or (False, None)."""
    code = CODE_OF.get(row["concept"])
    m = re.match(r"^PLAN-(\d+)([a-z]?)-", tid)
    if m:
        pkgs, prefixes = [f"C{m.group(1)}{m.group(2)}"], [tid]
    elif ns and PKG.match(ns):
        pkgs, prefixes = [ns], [tid, f"{ns} {tid}"]
    elif ns in CONCEPT_PKGS:
        pkgs, prefixes = list(CONCEPT_PKGS[ns]), [tid, f"{ns} {tid}"]
    else:
        # A bare id is the row's concept's test: owners from that concept accept "AT-6" or "HA AT-6"; an owner
        # from another concept (C1a on a home-apps row) only an explicit "HA AT-6" (its own AT-6 is another test).
        mine = set(CONCEPT_PKGS.get(code, ()))
        cands = []
        for pk in row_pkgs(row):
            cands.append((pk, [tid] + ([f"{code} {tid}"] if code else []) if (pk in mine or not mine)
                          else [f"{code} {tid}"]))
        return _find(cands, routes_of(row), tid.startswith("G-"))
    return _find([(pk, prefixes) for pk in pkgs], routes_of(row), tid.startswith("G-"))


def routes_of(row):
    return set(re.findall(r"(/[a-z][\w/-]*[\w])", " ".join(str(row.get(k) or "") for k in
                                                         ("function", "laser_path", "gamepad_path", "test_id"))))


def _find(cands, routes, gate):
    """cands: [(package, accepted first-cell prefixes)]; a gate name also needs one of the row's routes."""
    for pkg, prefixes in cands:
        for first, rest, line in log_rows(pkg):
            if not any(first == p or re.match(re.escape(p) + r"(?![\w-])", first) for p in prefixes):
                continue
            if not passed(rest):
                continue
            if gate and not any(r in line for r in routes):
                continue
            return True, f"{pkg}: {first[:40]}"
    return False, None


def status(row, _passes=None):
    refs = test_refs(row["test_id"])
    if not refs:
        row["evidence"] = ""
        return "static" if row["action"] else "open"
    ok, ev = [], []
    for ns, tid in refs:
        good, where = ref_passes(row, ns, tid)
        if good:
            ok.append(tid)
            ev.append(where)
    row["evidence"] = "; ".join(ev)
    return "pass" if len(ok) == len(refs) else ("partial" if ok else "open")


def build():
    audit = audit_functions()
    rows = concept_rows(set(audit))
    for r in rows:
        r["status"] = status(r)
    mapped = {r["audit_id"] for r in rows}
    unmapped = sorted(a for a in audit if a not in mapped)
    nopath = [r for r in rows if not r["laser_path"] or not r["gamepad_path"]]
    return audit, rows, unmapped, nopath


def main(argv):
    argv = list(argv)
    as_json = "--json" in argv
    quiet = "--quiet" in argv
    out = D / "verify" / "functions.csv"
    if "--out" in argv:
        out = Path(argv[argv.index("--out") + 1])
    audit, rows, unmapped, nopath = build()
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    cols = ["audit_id", "function", "concept", "owner", "laser_path", "gamepad_path", "test_id", "status", "evidence"]
    w.writerow(cols)
    for r in rows:
        w.writerow([r[c] for c in cols])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(buf.getvalue(), encoding="utf-8")
    by_status = {}
    for r in rows:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
    res = {"out": str(out), "auditFunctions": len(audit), "conceptRows": len(rows),
           "mappedAuditFunctions": len(audit) - len(unmapped), "unmapped": unmapped,
           "ownIds": sum(1 for r in rows if r["own_id"]),
           "missingPath": [f"{r['concept']} {r['audit_id']}: {'laser' if not r['laser_path'] else 'gamepad'}" for r in nopath],
           "status": by_status, "pass": not unmapped and not nopath}
    if as_json:
        print(json.dumps(res, indent=1))
    else:
        print(f"ledger -> {out}: {len(rows)} rows from {len({r['concept'] for r in rows})} concepts; "
              f"{res['mappedAuditFunctions']} of {len(audit)} audit functions mapped; status {by_status}")
        print(f"  unmapped audit functions: {len(unmapped)}")
        if not quiet:
            for a in unmapped:
                print(f"    {a}  {audit[a]}")
        print(f"  rows without a laser or gamepad path: {len(nopath)}")
        if not quiet:
            for x in res["missingPath"][:40]:
                print("    " + x)
        print(f"  rows with the concept's own id (not an audit id): {res['ownIds']}")
        print("  overall: " + ("PASS" if res["pass"] else "FAIL"))
    return 0 if res["pass"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
