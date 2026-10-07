"""C25 / C5 rule audit of theme/10-primitives.css (offline, on the source the bundler wraps as html.lgs-on { ... }).

Flattens CSS nesting (& = parent; a nested selector without & is a descendant), then checks every final style rule:
  C25a  a selector that names .gpfocus / .gpfocuswithin and paints (declares anything other than a rest reset)
        must be scoped by html.lgs-on:not(.lgs-input-laser) or html.lgs-on.lgs-input-pad
  C25b  a selector that names :hover and paints must be scoped by :not(.lgs-input-pad) or .lgs-input-laser
  C25c  no selector keys a look on .Focusable
  C5    no box-shadow layer of the form 0 0 0 Npx (zero offset, zero blur, N > 0) outside the allowed cases
        (check-circle glyph ring, the field focus ring token, prefers-contrast)
Rules whose selector names .gpfocus/:hover inside an :is() list together with rest states (:active, :focus, .Primary)
and whose declarations only reset background / box-shadow / color / filter are reported as "neutral" (they put
Steam's state paint back to rest in every mode; they paint no look of their own).
usage: python docs/phase2/mockups/controls-c25.py [file]   (default: theme/10-primitives.css)"""
import re, sys, json

src = open(sys.argv[1] if len(sys.argv) > 1 else __import__("os").path.join(__import__("os").path.dirname(__file__), "..", "..", "..", "theme", "10-primitives.css"),
           encoding="utf-8").read()
src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
src = re.sub(r"%\{([^}]*)\}", lambda m: ".T_" + re.sub(r"[^A-Za-z0-9_]", "_", m.group(1)), src)


def split_sel(s):
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur.strip()); cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def combine(parents, child):
    res = []
    for c in split_sel(child):
        for p in parents:
            res.append(c.replace("&", p) if "&" in c else p + " " + c)
    return res


rules = []  # (selectors, decls, atstack)


def parse(text, i, parents, at):
    buf = ""
    while i < len(text):
        ch = text[i]
        if ch == "{":
            head = buf.strip(); buf = ""
            if head.startswith("@"):
                i = parse(text, i + 1, parents, at + [head])
            else:
                sels = combine(parents, head)
                # collect declarations directly inside, recurse for nested rules
                i = parse_block(text, i + 1, sels, at)
            continue
        if ch == "}":
            return i + 1
        if ch == ";":
            buf = ""  # stray declaration at this level (inside @container blocks etc.)
        else:
            buf += ch
        i += 1
    return i


def parse_block(text, i, sels, at):
    decls, buf = [], ""
    while i < len(text):
        ch = text[i]
        if ch == "{":
            head = buf.strip(); buf = ""
            if head.startswith("@"):
                i = parse(text, i + 1, sels, at + [head])
            else:
                i = parse_block(text, i + 1, combine(sels, head), at)
            continue
        if ch == "}":
            rules.append((sels, decls, at))
            return i + 1
        if ch == ";":
            if buf.strip():
                decls.append(buf.strip())
            buf = ""
        else:
            buf += ch
        i += 1
    return i


parse(src, 0, ["html.lgs-on"], [])

PAD_SCOPE = ("html.lgs-on:not(.lgs-input-laser)", "html.lgs-on.lgs-input-pad")
LASER_SCOPE = ("html.lgs-on:not(.lgs-input-pad)", "html.lgs-on.lgs-input-laser")
REST_VAL = r"(transparent|var\(--lgs-(fill-regular|fill-thick|text-1|text-2|text-disabled|raised-bg|raised-shadow|recessed-shadow)\)|rgb\(0 0 0 / \.22\)|rgb\(11 13 16 / \.94\)|var\(--lgs-fill-thick\),? ?|var\(--lgs-raised-shadow\)|var\(--lgs-recessed-shadow\), inset 0 -2px 3px -1px rgb\(255 255 255 / \.10\))"
REST_PROPS = {"--gpColor-Blue", "border-radius", "background", "background-color", "box-shadow", "color", "filter", "opacity", "content", "transition"}
report = {"rules": 0, "selectors": 0, "C25a": [], "C25b": [], "C25c": [], "C5": [], "neutral": []}
for sels, decls, at in rules:
    report["rules"] += 1
    props = {d.split(":", 1)[0].strip() for d in decls if ":" in d}
    hc = any("prefers-contrast" in a for a in at)
    for s in sels:
        report["selectors"] += 1
        vals = [d.split(":", 1)[1].replace("!important", "").strip() for d in decls if ":" in d]
        rest_vals = all(re.fullmatch(REST_VAL, v) for v in vals)
        neutral = (props <= REST_PROPS and (rest_vals or bool(re.search(r":is\([^)]*(\.gpfocus|:hover)[^)]*(:active|:focus|\.Primary)", s))))             or s.startswith("html.lgs-on.lgs-input-laser") and ".gpfocus" in s and ":hover" not in s and "--lgs-hover" in " ".join(vals)
        if re.search(r"\.gpfocus(within)?\b", s) and not s.startswith(PAD_SCOPE):
            (report["neutral"] if neutral else report["C25a"]).append({"sel": s[:220], "props": sorted(props)})
        if ":hover" in s and not s.startswith(LASER_SCOPE):
            (report["neutral"] if neutral else report["C25b"]).append({"sel": s[:220], "props": sorted(props)})
        if re.search(r"\.Focusable\b", s):
            report["C25c"].append(s[:220])
    for d in decls:
        if d.split(":", 1)[0].strip() != "box-shadow" or hc:
            continue
        for layer in re.split(r",(?![^()]*\))", d.split(":", 1)[1]):
            l = layer.strip()
            if re.match(r"(inset\s+)?0(px)?\s+0(px)?\s+0(px)?\s+[\d.]+px", l):
                report["C5"].append({"sel": sels[0][:160], "layer": l})
report["C25a_n"], report["C25b_n"], report["neutral_n"] = len(report["C25a"]), len(report["C25b"]), len(report["neutral"])
print(json.dumps(report, indent=1))
