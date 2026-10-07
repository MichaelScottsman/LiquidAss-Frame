#!/usr/bin/env python3
"""`glass.py cmp`: a mockup next to a live shot, plus rect deltas of named elements (P10, contracts/lab.md section 3; G-MOCK).

  python glass.py cmp MOCK.html [LIVE.png] [--id PKG] [--name WHAT] [--size 1920x1080] [--live] [--live-rects FILE]
                      [--surface S] [--json] [step options]

1. Renders MOCK.html with tools/mockshot.py --rects (data-id rects, page px; also the `.lgk-overlay` rect, the kit's
   window, used as the default mockup origin) -> shots/p2_cmp_<id>_<what>.rects.json.
2. Live rects: when docs/phase2/wp/<PKG>-cmp.json gives a route (or --live), one locked step navigates, runs the pre,
   reads the rect of every mapped element and, when LIVE.png is missing or not given, captures the surface into
   shots/p2_cmp_<id>_<what>_live.png (or LIVE.png's name) in the same step. --live-rects FILE uses saved rects.
3. Composes shots/p2_cmp_<id>_<what>.png: the mockup's window region scaled to the live shot's size on the left,
   the live shot on the right, labelled, mapped rects outlined (mockup cyan, live magenta).
4. Deltas per mapped data-id in surface CSS px: mock = (page rect - mockOrigin) / mockScale; live = the element's
   getBoundingClientRect. PASS when |dx|, |dy|, |dw|, |dh| <= 8 for every mapped id (G-MOCK); unmapped data-ids
   are listed.

<PKG>-cmp.json (owned by that package), one mockup:

  {"surface": "main", "route": "/library/home", "pre": "JS", "mockOrigin": [320, 66], "mockScale": 1,
   "map": {"window": "%{BasicUIRoot}", "play": "%{PlayButtonContainer>PlayButton}"}}

or several (C1b, C1c, C3a), selected by --name, else the mockup file's stem:

  {"mockups": {"window-nav-search": {"route": ..., "pre": ..., "mockOrigin": [320, 30], "map": {...}},
               "control-center-bar": {"surface": "bar", "mockScale": 1.2, "mockOrigin": [x, y], "map": {...}}}}

Top-level fields are defaults for every entry. A map value is a selector (%{Token}, @text=Label, and a final @last or
@nth=N to pick among the visible matches; default the first) or an object {sel, surface, mockOrigin, mockScale} that
overrides the entry for that element (popup quads drawn at --pop-scale). mockScale: mockup px per surface CSS px.
A mockup that repeats a data-id keeps its first occurrence.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOL = 8.0


def opt(argv, name, default=None):
    if name in argv:
        i = argv.index(name)
        v = argv[i + 1]
        del argv[i:i + 2]
        return v
    return default


def flag(argv, name):
    if name in argv:
        argv.remove(name)
        return True
    return False


def load_cfg(pkg, key):
    if not pkg:
        return {}
    p = ROOT / "docs" / "phase2" / "wp" / f"{pkg}-cmp.json"
    if not p.exists():
        return {"_missing": str(p)}
    cfg = json.loads(p.read_text(encoding="utf-8"))
    if "mockups" in cfg:
        entries = cfg["mockups"]
        ent = entries.get(key)
        if ent is None:
            # tolerate the stem with or without a package prefix (window-nav-search vs search)
            ent = next((v for k, v in entries.items() if key.endswith(k) or k.endswith(key)), None)
        if ent is None:
            return {"_missing": f"{p}: no entry {key!r} in mockups (have {', '.join(entries)})"}
        base = {k: v for k, v in cfg.items() if k != "mockups"}
        base.update(ent)
        return base
    return cfg


def items_of(cfg):
    out = []
    for k, v in (cfg.get("map") or {}).items():
        if isinstance(v, str):
            out.append({"id": k, "sel": v, "surface": cfg.get("surface", "main")})
        else:
            out.append({"id": k, "sel": v["sel"], "surface": v.get("surface", cfg.get("surface", "main")),
                        "mockOrigin": v.get("mockOrigin"), "mockScale": v.get("mockScale")})
    return out


def render(mock, png, size, rects_json):
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "mockshot.py"), str(mock), str(png), size,
                        "--rects", str(rects_json), "--sel", ".lgk-overlay"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
    if r.returncode or not Path(rects_json).exists():
        raise SystemExit(f"cmp: mockshot failed: {r.stdout[-500:]} {r.stderr[-800:]}")
    return json.loads(Path(rects_json).read_text(encoding="utf-8"))


def compose(mock_png, live_png, out_png, origin, live_css, mock_boxes, live_boxes, labels):
    from PIL import Image, ImageDraw
    m = Image.open(mock_png).convert("RGB")
    lv = Image.open(live_png).convert("RGB")
    ox, oy = origin
    cw, ch = live_css
    crop = m.crop((int(round(ox)), int(round(oy)), int(round(ox + cw)), int(round(oy + ch))))
    crop = crop.resize(lv.size)
    sx = lv.width / float(cw)
    W, H = lv.width * 2 + 16, lv.height + 40
    im = Image.new("RGB", (W, H), (18, 18, 20))
    im.paste(crop, (0, 40))
    im.paste(lv, (lv.width + 16, 40))
    d = ImageDraw.Draw(im)
    try:
        from PIL import ImageFont
        font = ImageFont.load_default(size=22)
    except (TypeError, OSError):
        font = None
    d.text((10, 8), labels[0], fill=(230, 230, 230), font=font)
    d.text((lv.width + 26, 8), labels[1], fill=(230, 230, 230), font=font)
    for (x, y, w, h) in mock_boxes:
        d.rectangle([x * sx, 40 + y * sx, (x + w) * sx, 40 + (y + h) * sx], outline=(0, 220, 255), width=2)
    for (x, y, w, h) in live_boxes:
        d.rectangle([lv.width + 16 + x * sx, 40 + y * sx, lv.width + 16 + (x + w) * sx, 40 + (y + h) * sx],
                    outline=(255, 0, 200), width=2)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    im.save(out_png)


def run(argv, live_fn):
    """live_fn(args) -> the device's @@cmprects result (glass.py passes a function holding the SSH client)."""
    argv = list(argv)
    as_json = flag(argv, "--json")
    pkg = opt(argv, "--id")
    name = opt(argv, "--name")
    size = opt(argv, "--size", "1920x1080")
    live_rects_file = opt(argv, "--live-rects")
    surface_opt = opt(argv, "--surface")
    force_live = flag(argv, "--live")
    step_opts = []
    for o in ("--flags", "--mode", "--media"):
        v = opt(argv, o)
        if v:
            step_opts += [o, v]
    if flag(argv, "--stock"):
        step_opts.append("--stock")
    if not argv:
        print(__doc__)
        return 2
    mock = Path(argv[0])
    live_png = Path(argv[1]) if len(argv) > 1 else None
    stem = mock.stem
    what = name or stem
    pid = (pkg or "x").lower()
    cfg = load_cfg(pkg, name or stem)
    if cfg.get("_missing"):
        print(f"cmp: {cfg['_missing']} (side by side only)")
        cfg = {}
    if surface_opt:
        cfg["surface"] = surface_opt
    base = f"p2_cmp_{pid}_{what}"
    shots = ROOT / "shots"
    rects_json = shots / f"{base}.rects.json"
    tmpd = Path(tempfile.mkdtemp(prefix="lgs-cmp-"))
    mock_png = tmpd / "mock.png"
    mr = render(mock, mock_png, size, rects_json)
    ov = (mr.get("sel") or {}).get(".lgk-overlay") or []
    origin_default = cfg.get("mockOrigin") or (ov[0][:2] if ov else [320, 66])
    scale_default = float(cfg.get("mockScale") or 1)
    items = items_of(cfg)
    live = None
    res = {"mockup": str(mock), "id": pkg, "name": what, "rectsFile": str(rects_json.relative_to(ROOT))}
    if live_rects_file:
        live = json.loads(Path(live_rects_file).read_text(encoding="utf-8"))
    elif items and (cfg.get("route") or force_live or not (live_png and live_png.exists())):
        args = ["--items", json.dumps([{k: it[k] for k in ("id", "sel", "surface")} for it in items])] + step_opts
        if cfg.get("route"):
            args += ["--route", cfg["route"]]
        if cfg.get("pre"):
            args += ["--pre", cfg["pre"]]
        if not (live_png and live_png.exists()):
            lname = live_png.stem if live_png else f"{base}_live"
            args += ["--capture", f"{cfg.get('surface', 'main')}:{lname}"]
        live = live_fn(args)
        if live and live.get("file"):
            live_png = ROOT / live["file"]
    elif not (live_png and live_png.exists()):
        lname = live_png.stem if live_png else f"{base}_live"
        live = live_fn(["--items", "[]", "--capture", f"{cfg.get('surface', 'main')}:{lname}"] + step_opts
                       + (["--route", cfg["route"]] if cfg.get("route") else []) + (["--pre", cfg["pre"]] if cfg.get("pre") else []))
        if live and live.get("file"):
            live_png = ROOT / live["file"]
    if live and not live_rects_file:
        (shots / f"{base}.live.json").write_text(json.dumps(live, indent=1), encoding="utf-8")
        res["liveRectsFile"] = f"shots/{base}.live.json"     # re-run offline with --live-rects
    if not live_png or not live_png.exists():
        print("BLOCKED: no live shot (give LIVE.png, or a route in the cmp.json)")
        return 3
    from PIL import Image
    lv = Image.open(live_png)
    lrects = (live or {}).get("rects") or {}
    dpr = next((v.get("dpr") for v in lrects.values() if isinstance(v, dict) and v.get("dpr")), None) or 1.5
    live_css = (lv.width / dpr, lv.height / dpr)
    deltas, unmapped, mock_boxes, live_boxes = [], [], [], []
    mapped = {it["id"] for it in items}
    for k in mr.get("rects", {}):
        if k not in mapped:
            unmapped.append(k)
    for it in items:
        mrect = mr.get("rects", {}).get(it["id"])
        lr = lrects.get(it["id"])
        row = {"id": it["id"], "surface": it["surface"]}
        if not mrect:
            row["error"] = "no data-id in the mockup"
        elif not lr or "rect" not in lr:
            row["error"] = "live: " + ((lr or {}).get("error") or "no live rect")
        else:
            o = it.get("mockOrigin") or origin_default
            sc = float(it.get("mockScale") or scale_default)
            m = [(mrect[0] - o[0]) / sc, (mrect[1] - o[1]) / sc, mrect[2] / sc, mrect[3] / sc]
            l = lr["rect"]
            d = [round(l[i] - m[i], 1) for i in range(4)]
            row.update({"mock": [round(v, 1) for v in m], "live": l, "d": d, "pass": all(abs(v) <= TOL for v in d)})
            if it["surface"] == cfg.get("surface", "main") and not it.get("mockOrigin"):
                mock_boxes.append(m)
                live_boxes.append(l)
        deltas.append(row)
    out_png = shots / f"{base}.png"
    compose(mock_png, live_png, out_png, origin_default, live_css, mock_boxes, live_boxes,
            [f"mockup {mock.name} (window from {origin_default}, x{lv.width / live_css[0]:.2f})",
             f"live {live_png.name} {(live or {}).get('build', '')} {(live or {}).get('date', '')}"])
    try:
        mock_png.unlink()
        tmpd.rmdir()
    except OSError:
        pass
    res.update({"compare": str(out_png.relative_to(ROOT)), "live": str(live_png.relative_to(ROOT)) if live_png.is_relative_to(ROOT) else str(live_png),
                "mockOrigin": origin_default, "mockScale": scale_default, "deltas": deltas, "unmapped": unmapped,
                "build": (live or {}).get("build"), "date": (live or {}).get("date"), "step": (live or {}).get("step")})
    checked = [r for r in deltas if "d" in r]
    res["pass"] = bool(checked) and all(r["pass"] for r in checked) and not any("error" in r for r in deltas)
    if as_json:
        print(json.dumps(res, indent=1))
    else:
        print(f"cmp {mock.name} vs {res['live']}  -> {res['compare']}")
        for r in deltas:
            if "error" in r:
                print(f"  {r['id']:18} ERROR {r['error']}")
            else:
                print(f"  {r['id']:18} dx {r['d'][0]:+6.1f} dy {r['d'][1]:+6.1f} dw {r['d'][2]:+6.1f} dh {r['d'][3]:+6.1f}  "
                      + ("PASS" if r["pass"] else "FAIL"))
        if unmapped:
            print(f"  unmapped data-ids: {', '.join(unmapped[:30])}")
        if not items:
            print("  no map (docs/phase2/wp/<PKG>-cmp.json): side by side only; view it and record a verdict")
        print("  G-MOCK (rects): " + ("PASS" if res["pass"] else ("n/a" if not checked else "FAIL"))
              + "  (the viewer's verdict on the image is recorded separately)")
    return 0 if res["pass"] or not items else 1
