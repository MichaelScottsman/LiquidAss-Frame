#!/usr/bin/env python3
"""Offline check of what `python glass.py sync` uploads (P10, contracts/lab.md section 3).

  python glass.py check-theme [--json] [--quiet]
  python tools/p2/check_theme.py [--json] [--quiet] [--root DIR]

Exit 0 when nothing would break the bundle or the runtime, 1 otherwise.

Checks (work in progress is skipped exactly as P1's loader skips it: names that
start with "_", "." or "#", or end with "~", so theme/_wip/ and device/rt/_wip/
never count):
  * theme/*.css, theme/vr/*.css: balanced braces / strings / comments (the
    bundler's brace_error, so a broken file cannot swallow every later file);
    @keyframes, @font-face, @property, @import only in *.nowrap.css (nesting
    drops them); a *.nowrap.css with a bare declaration outside any rule;
    an unterminated %{Token}.
  * P1's offline bundle check (device/lgs.py `check`), when present.
  * theme/layers/*.json, theme/popups/*.json, theme/sg/*.json, theme/layers.json,
    theme/lens.json, device/defaults.json: valid JSON.
  * device/rt/*.js, device/shared/*.js, device/vr/*.js, lab/*.js: `node --check`.
  * device/*.py, device/shell_ext/*.py, lab/*.py: Python syntax.
"""
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_lgs(root):
    """device/lgs.py as a module (stdlib-only at import time), or None."""
    p = root / "device" / "lgs.py"
    try:
        spec = importlib.util.spec_from_file_location("lgs_offline_check", p)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    except Exception as e:  # noqa: BLE001 - P1's file may be mid-edit
        return e


def skipped(name):
    return name.startswith(("_", ".", "#")) or name.endswith("~")


def files(d, suffix):
    if not d.is_dir():
        return []
    return [p for p in sorted(d.iterdir()) if p.is_file() and p.name.endswith(suffix) and not skipped(p.name)]


def brace_error_fallback(text):
    depth, i, n = 0, 0, len(text)
    while i < n:
        c = text[i]
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            if j < 0:
                return "unterminated comment"
            i = j + 2
            continue
        if c in "\"'":
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == "\\" else 1
            if j >= n:
                return "unterminated string"
            i = j + 1
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth < 0:
                return f"unmatched '}}' at offset {i}"
        i += 1
    return f"{depth} unclosed '{{'" if depth else None


def strip(text):
    """Comments and strings blanked out (same length, newlines kept)."""
    out, i, n = [], 0, len(text)
    while i < n:
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append(re.sub(r"[^\n]", " ", text[i:j]))
            i = j
            continue
        c = text[i]
        if c in "\"'":
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == "\\" else 1
            j = min(n, j + 1)
            out.append(c + " " * max(0, j - i - 2) + (c if j - i >= 2 else ""))
            i = j
            continue
        out.append(c)
        i += 1
    return "".join(out)


def line_of(text, off):
    return text.count("\n", 0, off) + 1


def bare_declarations(text):
    """Top-level `prop: value;` statements (not at-rule statements)."""
    s = strip(text)
    bad, depth, start = [], 0, 0
    for i, c in enumerate(s):
        if c == "{":
            depth += 1
            start = i + 1
        elif c == "}":
            depth -= 1
            start = i + 1
        elif c == ";" and depth == 0:
            seg = s[start:i].strip()
            if seg and not seg.startswith("@") and ":" in seg:
                bad.append(line_of(text, start + (len(s[start:i]) - len(s[start:i].lstrip()))))
            start = i + 1
    return bad


AT_NOWRAP = ("@keyframes", "@font-face", "@import", "@property")


def check_css(path, brace_error, rel):
    probs = []
    text = path.read_text(encoding="utf-8")
    err = brace_error(text)
    if err:
        probs.append(f"{rel}: {err} (the bundler would SKIP this file)")
        return probs
    s = strip(text)
    if path.name.endswith(".nowrap.css"):
        for ln in bare_declarations(text):
            probs.append(f"{rel}:{ln}: declaration outside any rule in a .nowrap file")
    else:
        for at in AT_NOWRAP:
            for m in re.finditer(re.escape(at) + r"\b", s):
                probs.append(f"{rel}:{line_of(text, m.start())}: {at} must live in a *.nowrap.css file")
    for m in re.finditer(r"%\{([^}\n]*)(\}|\n|$)", s):
        if m.group(2) != "}":
            probs.append(f"{rel}:{line_of(text, m.start())}: unterminated %{{Token}}")
    return probs


def check_json(path, rel):
    try:
        json.loads(path.read_text(encoding="utf-8"))
        return []
    except ValueError as e:
        return [f"{rel}: invalid JSON: {e}"]


def check_js(paths, root):
    node = shutil.which("node")
    if not node:
        return [], ["node not found: JS syntax not checked"]
    probs = []
    for p in paths:
        r = subprocess.run([node, "--check", str(p)], capture_output=True, text=True, timeout=60)
        if r.returncode:
            msg = (r.stderr.strip().splitlines() or ["syntax error"])
            # node prints "file:line" then the code line, caret, then the error
            where = msg[0].replace(str(p), "").strip(": ")
            err = next((m for m in msg if "Error" in m), msg[-1])
            probs.append(f"{p.relative_to(root).as_posix()}{(':' + where) if where.isdigit() else ''}: {err.strip()}")
    return probs, []


def check_py(paths, root):
    probs = []
    for p in paths:
        try:
            compile(p.read_text(encoding="utf-8"), str(p), "exec")   # no .pyc written
        except SyntaxError as e:
            probs.append(f"{p.relative_to(root).as_posix()}:{e.lineno}: {e.msg}")
        except (OSError, ValueError):
            pass
    return probs


def run(root=ROOT):
    root = Path(root)
    lgs = load_lgs(root)
    notes = []
    if isinstance(lgs, Exception):
        notes.append(f"device/lgs.py did not import ({lgs}); using the built-in brace check")
        brace_error = brace_error_fallback
        lgs = None
    else:
        brace_error = getattr(lgs, "brace_error", brace_error_fallback)
    probs = []
    theme = root / "theme"
    css = files(theme, ".css") + files(theme / "vr", ".css")
    bundler = None
    p1 = lgs is not None and callable(getattr(lgs, "check", None))
    if p1:
        # P1's offline bundle check (contracts/runtime.md section 6) is the authority for
        # theme CSS, theme JSON and device/rt|shared|vr JS; ours covers the rest.
        try:
            bundler = lgs.check(root=str(root), node=bool(shutil.which("node")))
            for item in bundler.get("errors", []):
                probs.append(f"bundler: {item}")
            for item in bundler.get("warnings", []):
                notes.append(f"bundler warning: {item}")
        except Exception as e:  # noqa: BLE001
            notes.append(f"lgs.check() raised {e!r}; using the built-in checks")
            p1 = False
    if not p1:
        if bundler is None:
            notes.append("P1's offline bundle check (lgs.check) not available; built-in checks used")
        for p in css:
            probs += check_css(p, brace_error, p.relative_to(root).as_posix())
    js_paths = []
    if not p1:
        for d in ("device/rt", "device/shared", "device/vr"):
            js_paths += files(root / d, ".js")
    js_paths += files(root / "lab", ".js")
    jp, jn = check_js(js_paths, root)
    probs += jp
    notes += jn
    jsons = []
    for d in ("theme/layers", "theme/popups", "theme/sg"):
        jsons += files(root / d, ".json")
    for f in ("theme/layers.json", "theme/lens.json", "device/defaults.json"):
        if (root / f).is_file():
            jsons.append(root / f)
    if not p1:
        for p in jsons:
            probs += check_json(p, p.relative_to(root).as_posix())
    pys = files(root / "device", ".py") + files(root / "device" / "shell_ext", ".py") + files(root / "lab", ".py")
    probs += check_py(pys, root)
    return {"pass": not probs, "problems": probs, "notes": notes,
            "checked": {"css": len(css), "js": len(js_paths), "json": len(jsons), "py": len(pys),
                        "bundler": (bundler or {}).get("checked")},
            "bundler": bundler}


def main(argv):
    as_json = "--json" in argv
    quiet = "--quiet" in argv
    root = ROOT
    if "--root" in argv:
        root = Path(argv[argv.index("--root") + 1])
    res = run(root)
    if as_json:
        print(json.dumps(res, indent=1))
    else:
        for p in res["problems"]:
            print("FAIL " + p)
        if not quiet:
            for n in res["notes"]:
                print("note: " + n)
            c = res["checked"]
            print(f"check-theme: bundler (P1) {c['bundler'] if c['bundler'] is not None else 'n/a'} files; "
                  f"{c['css']} css, {c['js']} js, {c['json']} json, {c['py']} py -> "
                  + ("PASS" if res["pass"] else f"FAIL ({len(res['problems'])} problems)"))
    return 0 if res["pass"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
