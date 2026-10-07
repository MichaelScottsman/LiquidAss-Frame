#!/usr/bin/env python3
"""The depth check model and its rules (P10, contracts/lab.md section 5; G-DEPTH, PLAN 1.7, VP P-46 to P-48).

  python glass.py sgcheck --spec MODEL.json [--json]      rules over a check model (offline; TL-4, fixtures)
  python tools/p2/sgcheck.py MODEL.json [--json]           the same

A check model:

  {"unitsPerMm": 0.00271, "profile": "default", "holes": false,
   "surfaces": [{"key": "main", "scale": 1.5,
     "covers": [{"x", "y", "w", "h", "r"}], "plates": [{"x", "y", "w", "h", "r"}],
     "pops": [{"id", "x", "y", "w", "h", "dz", "r"?, "interactive", "shadow", "media", "destructive", "modal"}],
     "focusables": [{"x", "y", "w", "h"}], "forbidden": [{"name", "x", "y", "w", "h"}]}]}

Rects are texture px (CSS px x scale); dz in scene units (units = mm / (369 x r)). Each failure names its rule:

  R1  covered      the pop, deflated by 2 px (the reporter's tolerance), lies inside the union of covers and plates
                   (rounded rects, sampled on a 4 px grid)
  R1b forbidden    no pop intersects a forbidden rect (bottom ornament, store ornament, tab bar, window-bar row, ...)
  R2  click-safe   dz <= 0.000521 x s (s = shorter side, CSS px, of the smallest focusable the pop holds: one that
                   overlaps it by >= 8 x 8 px and lies >= 50 % inside it, or that contains it), and dz in
                   {0, 10, 15, 25} mm +- 0.5 mm
  R3  media        no pop over media (unless the model says holes: true)
  R4  destructive  no pop holding a destructive button
  R5  container    each pop >= 60 x 60 CSS px (a capsule, r: "capsule", >= 44 tall and >= 60 wide; P6 rule 5)
  R6  modal        while a pop is modal, every other pop lies within the modal
  R7  depths       <= 4 distinct dz at rest per surface, 0 included (+1 with a modal open)
  R8  interactive  interactive: false on every pop in the default profile
  R9  shadow       shadow: true on every pop (P-48)
"""
import json
import sys

ALLOWED_MM = (0.0, 10.0, 15.0, 25.0)
CLICK_SAFE = 0.000521


def inside_rrect(px, py, s):
    x0, y0, x1, y1 = s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]
    if px < x0 or px > x1 or py < y0 or py > y1:
        return False
    r = s.get("r", 0)
    if r == "capsule":
        r = min(s["w"], s["h"]) / 2
    r = min(float(r or 0), s["w"] / 2, s["h"] / 2)
    if r <= 0:
        return True
    cx = min(max(px, x0 + r), x1 - r)
    cy = min(max(py, y0 + r), y1 - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r + 1e-6


def inter(a, b):
    x0, y0 = max(a["x"], b["x"]), max(a["y"], b["y"])
    x1, y1 = min(a["x"] + a["w"], b["x"] + b["w"]), min(a["y"] + a["h"], b["y"] + b["h"])
    return max(0.0, x1 - x0), max(0.0, y1 - y0)


def within(a, b, tol=2.0):
    return a["x"] >= b["x"] - tol and a["y"] >= b["y"] - tol and \
        a["x"] + a["w"] <= b["x"] + b["w"] + tol and a["y"] + a["h"] <= b["y"] + b["h"] + tol


def check(model):
    upm = float(model.get("unitsPerMm") or 1 / 369.0)
    profile = model.get("profile", "default")
    holes = bool(model.get("holes"))
    fails, notes, per = [], [], []
    for s in model.get("surfaces", []):
        key = s.get("key", "?")
        sc = float(s.get("scale") or 1.5)
        shapes = list(s.get("covers", [])) + list(s.get("plates", []))
        pops = s.get("pops", [])
        modal = [p for p in pops if p.get("modal")]
        dzs = set()

        def fail(rule, p, why):
            fails.append({"surface": key, "rule": rule, "pop": p.get("id"), "why": why})

        for p in pops:
            dz = float(p.get("dz", 0))
            dzs.add(round(dz / upm * 2) / 2)          # mm, to 0.5
            # R1 covered (deflated by 2 px; 4 px grid incl. the far edges)
            x0, y0, x1, y1 = p["x"] + 2, p["y"] + 2, p["x"] + p["w"] - 2, p["y"] + p["h"] - 2
            miss = None
            if x1 > x0 and y1 > y0:
                xs = [x0 + i * 4 for i in range(int((x1 - x0) // 4) + 1)] + [x1]
                ys = [y0 + i * 4 for i in range(int((y1 - y0) // 4) + 1)] + [y1]
                for yy in ys:
                    for xx in xs:
                        if not any(inside_rrect(xx, yy, c) for c in shapes):
                            miss = (round(xx), round(yy))
                            break
                    if miss:
                        break
            if miss:
                fail("R1", p, f"not covered at texture px {miss} (covers {len(s.get('covers', []))}, plates {len(s.get('plates', []))})")
            # R1b forbidden
            for fb in s.get("forbidden", []):
                w, h = inter(p, fb)
                if w > 0 and h > 0:
                    fail("R1b", p, f"intersects {fb.get('name', 'forbidden')} by {w:.0f} x {h:.0f} px")
            # R2 click-safe
            held = []
            for f in s.get("focusables", []):
                w, h = inter(p, f)
                if w >= 8 and h >= 8 and (w * h >= 0.5 * f["w"] * f["h"] or within(p, f, 0)):
                    held.append(f)
            dz_mm = dz / upm
            if held:
                sm = min(held, key=lambda f: f["w"] * f["h"])
                short = min(sm["w"], sm["h"]) / sc
                cap = CLICK_SAFE * short
                if dz > cap + 1e-6 and not p.get("interactive"):
                    fail("R2", p, f"dz {dz_mm:.1f} mm > cap {cap / upm:.1f} mm (smallest focusable {sm['w'] / sc:.0f} x "
                                  f"{sm['h'] / sc:.0f} CSS px, s = {short:.0f})")
            if not any(abs(dz_mm - a) <= 0.5 for a in ALLOWED_MM):
                fail("R2", p, f"dz {dz_mm:.2f} mm is not one of 0, 10, 15, 25 mm")
            # R3, R4
            if p.get("media") and not holes:
                fail("R3", p, "over media or opaque art")
            if p.get("destructive"):
                fail("R4", p, "holds a destructive button")
            # R5 container
            wc, hc = p["w"] / sc, p["h"] / sc
            if p.get("r") == "capsule":
                if hc < 44 or wc < 60:
                    fail("R5", p, f"capsule {wc:.0f} x {hc:.0f} CSS px < 60 x 44")
            elif wc < 60 or hc < 60:
                fail("R5", p, f"{wc:.0f} x {hc:.0f} CSS px < 60 x 60")
            # R8, R9
            if profile == "default" and p.get("interactive"):
                fail("R8", p, "interactive in the default profile")
            if not p.get("shadow"):
                fail("R9", p, "no shadow (P-48)")
        # R6 modal
        for m in modal:
            for p in pops:
                if p is m or p.get("modal"):
                    continue
                if not within(p, m):
                    fail("R6", p, f"pops outside the open modal {m.get('id')}")
        # R7 depths (0 always counts: the window and content)
        dzs.add(0.0)
        cap = 4 + (1 if modal else 0)
        if len(dzs) > cap:
            fails.append({"surface": key, "rule": "R7", "pop": None,
                          "why": f"{len(dzs)} distinct depths {sorted(dzs)} mm > {cap}"})
        per.append({"surface": key, "pops": len(pops), "depthsMm": sorted(dzs), "modal": [m.get("id") for m in modal]})
    return {"pass": not fails, "fails": fails, "surfaces": per, "notes": notes}


def model_from_live(data):
    """The check model from `lab.py sgcheck`'s live data: P6's report (`__LGS_LAYERS.snapshot()`), the DOM of each
    reported surface (focusables, forbidden boxes, media, destructive buttons) and P7's `__LGS_SG.dump()`."""
    rep = data.get("report") or {}
    g = rep.get("geom") or {}
    S, r = float(g.get("S") or 0.369), float(g.get("r") or 1.0)
    model = {"unitsPerMm": 1.0 / (S * 1000.0 * r), "profile": rep.get("profile", "default"), "surfaces": [],
             "holes": False}
    notes = []
    for s in rep.get("surfaces", []):
        name = s.get("name")
        dom = (data.get("dom") or {}).get(name) or {}
        if dom.get("error"):
            notes.append(f"{name}: no DOM ({dom['error']})")
        sc = float(s.get("texW") or 1920) / float(dom.get("cssW") or (float(s.get("texW") or 1920) / 1.5))
        tx = lambda b: {"x": b["x"] * sc, "y": b["y"] * sc, "w": b["w"] * sc, "h": b["h"] * sc}  # noqa: E731
        media = [tx(b) for b in dom.get("media", [])]
        destr = [tx(b) for b in dom.get("destructive", [])]
        pops = []
        for ly in s.get("layers", []):
            p = {k: ly.get(k) for k in ("id", "x", "y", "w", "h", "r")}
            p["dz"] = float(ly.get("dz") or 0)
            p["interactive"] = bool(ly.get("interactive"))
            p["modal"] = bool(ly.get("modal"))
            hole = ly.get("hole")
            p["shadow"] = ly.get("material") != "none" or bool(isinstance(hole, dict) and hole.get("shadow"))
            p["media"] = any(min(inter(p, m)) > 0 for m in media)
            p["destructive"] = any(min(inter(p, d)) > 0 for d in destr)
            if hole:
                model["holes"] = True     # the hole treatment is live for this layer (R3 waived, PLAN 1.7 rule 3)
            pops.append(p)
        model["surfaces"].append({
            "key": name, "scale": sc, "covers": s.get("shapes") or [], "plates": s.get("plates") or [], "pops": pops,
            "focusables": [tx(b) for b in dom.get("focusables", [])],
            "forbidden": [dict(tx(b), name=b.get("name")) for b in dom.get("forbidden", [])]})
    sg = data.get("sg") or {}
    nodes = sg.get("dump") or []
    if model["profile"] == "default":
        for n in nodes:
            if n.get("interactive"):
                notes.append(f"R8n scene-graph node {n.get('kind')} {n.get('key')} is interactive in the default profile")
    if not sg or sg.get("error"):
        notes.append("vr:systemui __LGS_SG not reachable: node checks skipped")
    model["_notes"] = notes
    model["_nodes"] = len(nodes)
    return model


def check_live(data):
    model = model_from_live(data)
    res = check(model)
    res["notes"] = model.get("_notes", [])
    res["nodes"] = model.get("_nodes")
    res["model"] = model
    if any(n.startswith("R8n") for n in res["notes"]):
        res["fails"].append({"surface": "vr:systemui", "rule": "R8", "pop": None, "why": "interactive scene-graph node(s)"})
        res["pass"] = False
    return res


def summary(res, title="sgcheck"):
    out = [title]
    for s in res["surfaces"]:
        out.append(f"  {s['surface']}: {s['pops']} pops, depths {s['depthsMm']} mm" + (f", modal {s['modal']}" if s["modal"] else ""))
    for f in res["fails"]:
        out.append(f"  FAIL {f['rule']} {f['surface']}/{f['pop']}: {f['why']}")
    for n in res.get("notes", []):
        out.append(f"  note: {n}")
    out.append("  overall: " + ("PASS" if res["pass"] else "FAIL"))
    return "\n".join(out)


def main(argv):
    argv = list(argv)
    as_json = "--json" in argv
    if as_json:
        argv.remove("--json")
    if "--spec" in argv:
        i = argv.index("--spec")
        path = argv[i + 1]
    elif argv:
        path = argv[0]
    else:
        print(__doc__)
        return 2
    with open(path, encoding="utf-8") as f:
        model = json.load(f)
    res = check(model)
    print(json.dumps(res, indent=1) if as_json else summary(res, f"sgcheck {path}"))
    return 0 if res["pass"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
