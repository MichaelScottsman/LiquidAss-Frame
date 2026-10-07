"""Spring tables for docs/phase2/research/liquid-glass-motion.md (sections 3.1-3.3),
and the one source of Glass Shell's motion tokens (PLAN section 1.5, package P5).

Usage: python springs.py              -> print the preset/token table
       python springs.py --css        -> print one linear() + cubic-bezier per bounce
       python springs.py --json F     -> also write the table as JSON
       python springs.py --emit css|js|h
                                      -> print one generated output:
                                         css = theme/02-motion.nowrap.css
                                         js  = device/shared/motion.js
                                         h   = native/shared/motion_tokens.h
       python springs.py --write      -> regenerate all three outputs in place
       python springs.py --check      -> MO-1 (D2 section 11.3 linear() strings
                                         byte-identical) + every output up to date
       python springs.py --test-js    -> MO-2: motion.js (node) against this file's
                                         closed form at 1 ms steps, every token

A change to a token is a change to this file (TOKENS, LINEAR, REDUCE_MS, DELAYS
and the keyframe templates below), never to one of its outputs.
Contract: docs/phase2/contracts/motion.md.

Model: SwiftUI Spring(duration:bounce:), mass 1.
  stiffness k = (2*pi/d)^2
  damping   c = 4*pi*(1-b)/d            (b >= 0)
  zeta      = 1 - b
Settling uses SwiftUI's epsilon 0.001 (Spring.settlingDuration docs).
Outputs: physics constants, t50/t90/t98, settle, overshoot, a CSS linear()
easing (RDP-simplified) and a least-squares cubic-bezier with its error.
"""
import hashlib, math, json, os, re, subprocess, sys, tempfile
import numpy as np
from scipy.optimize import minimize

EPS = 0.001

def from_db(d, b):
    w = 2 * math.pi / d
    z = 1 - b if b >= 0 else 1 / (1 + b)
    return w, z

def from_kz(k, z, m=1.0):
    return math.sqrt(k / m), z

def from_kc(k, c, m=1.0):
    w = math.sqrt(k / m)
    return w, c / (2 * math.sqrt(k * m))

def step(w, z, t):
    t = np.asarray(t, dtype=float)
    if abs(z - 1) < 1e-9:
        return 1 - np.exp(-w * t) * (1 + w * t)
    if z < 1:
        wd = w * math.sqrt(1 - z * z)
        return 1 - np.exp(-z * w * t) * (np.cos(wd * t) + (z * w / wd) * np.sin(wd * t))
    r1 = -w * (z - math.sqrt(z * z - 1))
    r2 = -w * (z + math.sqrt(z * z - 1))
    A = r2 / (r2 - r1)
    B = -r1 / (r2 - r1)
    return 1 - (A * np.exp(r1 * t) + B * np.exp(r2 * t))

def settle(w, z):
    t = np.arange(0, 5, 0.0005)
    x = step(w, z, t)
    out = np.where(np.abs(1 - x) > EPS)[0]
    return float(t[out[-1] + 1]) if len(out) else 0.0

def first_cross(t, x, level):
    i = np.argmax(x >= level)
    return float(t[i])

def rdp(pts, tol):
    if len(pts) < 3:
        return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    dmax, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        # vertical distance to the chord (value error at that time)
        yy = y0 + (y1 - y0) * (x - x0) / (x1 - x0) if x1 != x0 else y0
        d = abs(y - yy)
        if d > dmax:
            dmax, idx = d, i
    if dmax > tol:
        a = rdp(pts[: idx + 1], tol)
        b = rdp(pts[idx:], tol)
        return a[:-1] + b
    return [pts[0], pts[-1]]

def linear_css(w, z, T, tol=0.004):
    t = np.linspace(0, T, 600)
    x = step(w, z, t)
    pts = list(zip((t / T).tolist(), x.tolist()))
    pts[-1] = (1.0, 1.0)
    s = rdp(pts, tol)
    parts = []
    for i, (p, v) in enumerate(s):
        if i == 0:
            parts.append("0")
        elif i == len(s) - 1:
            parts.append("1")
        else:
            parts.append(f"{v:.3f} {p*100:.1f}%".replace("0.", ".", 1) if v < 1 and v >= 0 else f"{v:.3f} {p*100:.1f}%")
    return "linear(" + ", ".join(parts) + ")", len(s)

def bezier_y_at_x(p, xs):
    x1, y1, x2, y2 = p
    # solve x(s) = xs by Newton on parameter s
    s = np.array(xs, dtype=float)
    for _ in range(30):
        bx = 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s ** 2 * x2 + s ** 3
        dbx = 3 * (1 - s) ** 2 * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s ** 2 * (1 - x2)
        dbx = np.where(np.abs(dbx) < 1e-6, 1e-6, dbx)
        s = np.clip(s - (bx - xs) / dbx, 0, 1)
    return 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s ** 2 * y2 + s ** 3

def fit_bezier(w, z, T):
    xs = np.linspace(0, 1, 200)
    ys = step(w, z, xs * T)
    best = None
    for start in ([0.2, 0.8, 0.2, 1.0], [0.3, 1.2, 0.3, 1.0], [0.1, 0.9, 0.3, 1.1], [0.25, 1.0, 0.25, 1.0]):
        def f(p):
            x1, y1, x2, y2 = p
            pen = 0
            if not (0 <= x1 <= 1 and 0 <= x2 <= 1):
                pen = 10
            yb = bezier_y_at_x([min(max(x1, 0), 1), y1, min(max(x2, 0), 1), y2], xs)
            return float(np.sqrt(np.mean((yb - ys) ** 2))) + pen
        r = minimize(f, start, method="Nelder-Mead", options={"maxiter": 4000, "xatol": 1e-5, "fatol": 1e-7})
        if best is None or r.fun < best.fun:
            best = r
    p = [min(max(best.x[0], 0), 1), best.x[1], min(max(best.x[2], 0), 1), best.x[3]]
    yb = bezier_y_at_x(p, xs)
    return p, float(np.sqrt(np.mean((yb - ys) ** 2))), float(np.max(np.abs(yb - ys)))

def describe(name, w, z, use):
    T = settle(w, z)
    t = np.arange(0, T + 0.001, 0.0005)
    x = step(w, z, t)
    peak = float(np.max(x))
    d = 2 * math.pi / w
    b = 1 - z if z <= 1 else -(1 - 1 / z)
    lin, n = linear_css(w, z, T)
    bz, rms, mx = fit_bezier(w, z, T)
    return {
        "name": name, "use": use,
        "duration": round(d, 3), "bounce": round(b, 3), "zeta": round(z, 3),
        "stiffness": round(w * w, 1), "damping": round(2 * z * w, 2),
        "t50_ms": round(first_cross(t, x, 0.5) * 1000), "t90_ms": round(first_cross(t, x, 0.9) * 1000),
        "t98_ms": round(first_cross(t, x, 0.98) * 1000),
        "settle_ms": round(T * 1000), "overshoot_pct": round(max(0, peak - 1) * 100, 1),
        "linear": lin, "linear_points": n,
        "bezier": "cubic-bezier(" + ", ".join(f"{v:.3f}" for v in bz) + ")", "bez_rms": round(rms, 4), "bez_max": round(mx, 4),
    }


def fit_bezier_capped(w, z, T, cap):
    xs = np.linspace(0, 1, 300); ys = step(w, z, xs * T); best = None
    for st in ([0.2, 0.6, 0.1, 1.0], [0.3, 0.9, 0.1, 1.0], [0.25, 0.5, 0.05, 1.0]):
        def f(p):
            x1, y1, x2, y2 = p; pen = 0
            if not (0 <= x1 <= 1 and 0 <= x2 <= 1): pen += 10
            if cap and (y1 > 1 or y2 > 1): pen += 10
            yb = bezier_y_at_x([min(max(x1, 0), 1), y1, min(max(x2, 0), 1), y2], xs)
            return float(np.sqrt(np.mean((yb - ys) ** 2))) + pen
        r = minimize(f, st, method="Nelder-Mead", options={"maxiter": 6000, "xatol": 1e-6, "fatol": 1e-8})
        if best is None or r.fun < best.fun: best = r
    p = best.x; yb = bezier_y_at_x(p, xs)
    return p, float(np.sqrt(np.mean((yb - ys) ** 2))), float(np.max(np.abs(yb - ys)))

def print_css(bounces=(0.0, 0.15, 0.2, 0.25, 0.3)):
    for b in bounces:
        w, z = from_db(1.0, b); T = settle(w, z)
        lin, n = linear_css(w, z, T, tol=0.004)
        p, rms, mx = fit_bezier_capped(w, z, T, cap=(b == 0))
        peak = max(0.0, float(np.max(step(w, z, np.linspace(0, T, 4000)))) - 1)
        print(f"/* bounce {b}: CSS duration = settle = {T:.3f} x d; overshoot {peak*100:.1f}% */")
        print(f"{lin}   /* {n} points */")
        print(f"/* fallback cubic-bezier({p[0]:.3f}, {p[1]:.3f}, {p[2]:.3f}, {p[3]:.3f})  rms {rms:.4f}  max {mx:.4f} */")
        print()

# =============================================================================
# Generator (P5). The one source of the motion tokens (PLAN 1.5): this section
# writes theme/02-motion.nowrap.css, device/shared/motion.js and
# native/shared/motion_tokens.h. Contract: docs/phase2/contracts/motion.md.
# =============================================================================

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
OUTPUTS = {
    "css": os.path.join(REPO, "theme", "02-motion.nowrap.css"),
    "js": os.path.join(REPO, "device", "shared", "motion.js"),
    "h": os.path.join(REPO, "native", "shared", "motion_tokens.h"),
}
D2_PATH = os.path.join(REPO, "docs", "phase2", "DESIGN2.md")

# Spring tokens, D2 11.2 / MO 3.2 (unchanged): (name, d seconds, bounce, curve, use)
TOKENS = [
    ("interactive", 0.15, 0.14, "b15", "press-in, drag smoothing, gamepad slider steps, pill lift"),
    ("hover-in", 0.20, 0.0, "b0", "hover light in, focus illumination in"),
    ("fade", 0.30, 0.0, "b0", "hover and focus out, cross-fades, list insert, scrim"),
    ("snappy", 0.35, 0.15, "b15", "selection pill travel, toggle knob, toast in, release"),
    ("release-touch", 0.40, 0.25, "b25", "direct hand poke only (unused with laser and gamepad)"),
    ("morph-open", 0.45, 0.20, "b20", "menu, popover, dropdown grows out of its source"),
    ("morph-close", 0.30, 0.0, "b0", "menu returns into its source"),
    ("sheet-in", 0.50, 0.0, "b0", "sheet or modal present; window materialize (glassd)"),
    ("sheet-out", 0.35, 0.0, "b0", "sheet dismiss"),
    ("page", 0.45, 0.0, "b0", "route and tab content transitions"),
    ("depth", 0.30, 0.0, "b0", "z of popped crops and slabs (scene graph)"),
]
# One linear() per bounce value (D2 11.3): (curve name, bounce)
CURVES = [("b0", 0.0), ("b15", 0.15), ("b20", 0.20), ("b25", 0.25)]
# Linear and fixed durations: (name, ms, easing of the --lgs-motion- shorthand or None, use)
LINEAR = [
    ("mat-in", 250, "linear", "small glass materialize (MO 3.2)"),
    ("mat-out", 350, "var(--lgs-ease-mat-out)", "small glass dematerialize (MO 3.2)"),
    ("page-out", 150, "linear", "old route content fades out (MO 4.12)"),
    ("glow-off", 90, "linear", "press glow off on release (MO 4.3)"),
    ("swap", 120, "linear", "label colour swap at t90 of a pill travel (MO 4.5)"),
    ("reduce", 180, None, "the Reduce Motion cross-dissolve (MO C8)"),
]
# Reduce Motion durations (ms): fades of at most 200 ms (MO C8, VP P-56, CTL 247).
REDUCE_MS = {"interactive": 150, "hover-in": 150, "fade": 180, "snappy": 180, "release-touch": 180,
             "morph-open": 180, "morph-close": 150, "sheet-in": 200, "sheet-out": 180, "page": 180,
             "depth": 180, "mat-in": 180, "mat-out": 180, "page-out": 150, "glow-off": 90, "swap": 120,
             "reduce": 180}
# Delays (ms): VP I-3 and P-06, PLAN 1.13, WN 3.2.
DELAYS = [
    ("dwell", 80, "laser: lift, scale and depth start after this dwell; brightness at once"),
    ("page", 40, "route and tab content entrance delay (0-60 ms allowed)"),
    ("tab-label", 400, "tab-bar label reveal"),
    ("back-title", 600, "Back circle grows into a titled capsule (E-BACK)"),
    ("reveal", 800, "tooltips and card previews, in"),
    ("reveal-out", 200, "reveals, out"),
]
STAGGER_MS, STAGGER_MAX = 30, 5      # list insertion (MO 4.14)
MAT_RESOLVE = 0.92                   # small glass: glass channel resolved by 92 % (MO C1)
MAT_CONTENT_IN = 0.35                # content channel 35-100 % (MO C1)
MAT_CONTENT_OUT = 0.55               # content gone by 55 % (MO C1)
COVER_M = 0.30                       # glassd coverage alpha = smoothstep(0, .3, m) (MO 9, GM 5.3)
# Large glass in CSS (> 600 px: alerts, sheets) may not ramp its blur (MO R8), so its opacity is the
# whole glass channel: it follows the perceived glassd optics ramp (light 0-.6 with frost/tint .2-.92,
# about min(1, m / .8)) instead of glassd's quick coverage alpha, which in CSS made the slab pop in
# within 30 % of the time. Matches window-nav-motion.html (alert 1.3 g, sheet 1.25 p). wp/P5.md D-P5-8.
LARGE_COVER = 0.80
SHEET_CONTENT_IN = (0.25, 0.70)      # MO 4.8
MORPH_CONTENT_IN = (0.15, 0.50)      # MO 4.6
# glassd materialize optics ramp, ranges of m (MO 9, GM 5.3)
RAMPS = [("Light", 0.0, 0.6), ("Lens", 0.0, 0.7), ("Frost", 0.2, 0.92), ("Tint", 0.2, 0.92),
         ("Shade", 0.3, 0.92), ("Shadow", 0.4, 1.0), ("Alpha", 0.0, COVER_M)]


def num(v, nd=3):
    """Compact CSS/JS number: .327, 1.118, 1, 0."""
    s = f"{v:.{nd}f}".rstrip("0").rstrip(".")
    if s.startswith("0."):
        s = s[1:]
    elif s.startswith("-0."):
        s = "-" + s[2:]
    return s or "0"


def pct(v):
    return num(v * 100, 1) + "%"


def smooth01(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def fmt_points(s):
    """linear() text in linear_css's exact format (first 0, last 1)."""
    parts = []
    for i, (p, v) in enumerate(s):
        if i == 0:
            parts.append("0")
        elif i == len(s) - 1:
            parts.append("1")
        else:
            parts.append(f"{v:.3f} {p*100:.1f}%".replace("0.", ".", 1) if 0 <= v < 1 else f"{v:.3f} {p*100:.1f}%")
    return "linear(" + ", ".join(parts) + ")"


def linear_of(fn, tol=0.004, n=1200):
    """A progress function f -> p (0..1 over 0..1) as an RDP-simplified linear()."""
    f = np.linspace(0, 1, n)
    y = fn(f)
    pts = list(zip(f.tolist(), y.tolist()))
    pts[0], pts[-1] = (0.0, 0.0), (1.0, 1.0)
    s = rdp(pts, tol)
    # A ramp that has arrived stays there: the plateau's first point is exactly 1, so
    # an opacity ramp never rests at .998 for the rest of the animation (MO-3 samples).
    for i in range(1, len(s) - 1):
        p, v = s[i]
        if abs(v - 1) < tol and bool(np.all(np.abs(y[f >= p] - 1) < tol)):
            s[i] = (p, 1.0)
    return fmt_points(s)


def tail_of(fn, eps=5e-4):
    """An exit curve that holds at 0 and then falls: (offset, linear()). The
    keyframe carrying the curve sits at that offset, not at 0 %: Chromium merges
    the implicit start values of the other properties into an explicit 0 %
    keyframe, easing included (wp/P5.md MO-3 first run), so a custom easing at
    0 % would drive them too."""
    f = np.linspace(0, 1, 4001)
    y = fn(f)
    held = np.where(y < eps)[0]
    h = math.floor(float(f[held[-1]]) * 200) / 200 if len(held) else 0.0
    y0 = float(fn(np.array([h]))[0])
    return pct(h), linear_of(lambda g: (fn(h + g * (1 - h)) - y0) / (1 - y0))


def ramp_to(at):
    """linear(0, 1 at%, 1): reach the end at `at` of the time, then hold."""
    return f"linear(0, 1 {pct(at)}, 1)"


def token_stats(d, b):
    w, z = from_db(d, b)
    T = settle(w, z)
    t = np.arange(0, T + 0.001, 0.0005)
    x = step(w, z, t)
    return {"ms": round(T * 1000), "t50": round(first_cross(t, x, 0.5) * 1000),
            "t90": round(first_cross(t, x, 0.9) * 1000), "t98": round(first_cross(t, x, 0.98) * 1000),
            "overshoot": round(max(0.0, float(np.max(x)) - 1), 4)}


_DATA = None


def motion_data():
    """Everything the three outputs are made of (computed once per run)."""
    global _DATA
    if _DATA is not None:
        return _DATA
    curves, beziers = {}, {}
    for name, b in CURVES:
        w, z = from_db(1.0, b)
        T = settle(w, z)
        curves[name] = linear_css(w, z, T, tol=0.004)[0]
        p, rms, mx = fit_bezier_capped(w, z, T, cap=(b == 0))
        beziers[name] = "cubic-bezier(" + ", ".join(num(v) for v in p) + ")"
    tokens = []
    for name, d, b, curve, use in TOKENS:
        st = token_stats(d, b)
        w, z = from_db(d, b)
        tokens.append(dict(name=name, d=d, b=b, ease=curve, use=use, k=round(w * w, 1), c=round(2 * z * w, 2), **st))
    ms = {t["name"]: t["ms"] for t in tokens}
    ms.update({n: v for n, v, _, _ in LINEAR})
    # composite curves used inside the keyframes
    w0, z0 = from_db(1.0, 0.0)
    T0 = settle(w0, z0)
    toast_r = ms["mat-in"] / ms["snappy"]       # the materialize runs in the first 250 ms of 488
    comp = {
        "glassIn": ramp_to(MAT_RESOLVE),
        "covIn": linear_of(lambda f: smooth01(np.minimum(1, f / MAT_RESOLVE) / COVER_M)),
        "covOut": tail_of(lambda f: 1 - smooth01((1 - np.clip((f - MAT_CONTENT_OUT) / (1 - MAT_CONTENT_OUT), 0, 1)) / COVER_M)),
        "toastGlass": ramp_to(MAT_RESOLVE * toast_r),
        "toastCov": linear_of(lambda f: smooth01(np.minimum(1, f / (MAT_RESOLVE * toast_r)) / COVER_M)),
        "largeCovIn": linear_of(lambda f: np.minimum(1, np.minimum(1, f / MAT_RESOLVE) / LARGE_COVER)),
        "sheetCovIn": linear_of(lambda f: np.minimum(1, step(w0, z0, f * T0) / LARGE_COVER)),
        "sheetCovOut": tail_of(lambda f: 1 - np.minimum(1, (1 - step(w0, z0, f * T0)) / LARGE_COVER)),
        "sheetContent": ramp_to((SHEET_CONTENT_IN[1] - SHEET_CONTENT_IN[0]) / (1 - SHEET_CONTENT_IN[0])),
        "morphContent": ramp_to((MORPH_CONTENT_IN[1] - MORPH_CONTENT_IN[0]) / (1 - MORPH_CONTENT_IN[0])),
        "matOut": f"linear(0, 0 {pct(MAT_CONTENT_OUT)}, 1)",
    }
    for key in ("covOut", "sheetCovOut"):       # (hold offset, curve from there) -> two template fields
        comp[key + "At"], comp[key] = comp[key]
    table = {
        "tokens": [{k: t[k] for k in ("name", "d", "b", "ease", "ms", "t50", "t90", "t98", "overshoot")} for t in tokens],
        "linear": [{"name": n, "ms": v} for n, v, _, _ in LINEAR],
        "reduceMs": REDUCE_MS, "delays": {n: v for n, v, _ in DELAYS},
        "stagger": [STAGGER_MS, STAGGER_MAX], "curves": curves, "beziers": beziers, "composites": comp,
        "ramps": [[n, a, b] for n, a, b in RAMPS],
    }
    version = hashlib.sha1(json.dumps(table, sort_keys=True).encode()).hexdigest()[:10]
    _DATA = dict(tokens=tokens, ms=ms, curves=curves, beziers=beziers, comp=comp, table=table, version=version)
    return _DATA


# ------------------------------------------------------------------ CSS output

KEYFRAMES = r"""
/* ------------------------------------------------------------------ keyframes
   Every keyframe leaves the element's own resting style as its far end (an
   implicit keyframe), so no caller has to pass the rest value and, with
   `backwards` fill, nothing stays on Steam's nodes once it ends (MO R11).
   Two `0%` blocks with different animation-timing-function stay separate
   keyframes (proven on Chromium 126, wp/P5.md P5-K1): the glass channel keeps
   its own ramp while scale or translate ride the caller's spring easing.
   But an implicit start value is merged into an explicit 0% keyframe, easing
   included (MO-3), so exits put their custom curve at a later offset.
   How to call each one: docs/phase2/contracts/motion.md section 2. */

/* Small glass (<= 600 x 600 px, MO R8): the glass channel is resolved by 92 %
   and the swell rides it (C1-C3); coverage opacity follows glassd's
   smoothstep(0, .3, m). Call: var(--lgs-motion-mat-in) backwards. */
@keyframes lgs-mat-glass-in {
  0% { scale: calc(1 + clamp(.01, 12 / var(--lgs-maxside, 80), .15));
       background-color: transparent; backdrop-filter: blur(0px) saturate(1); box-shadow: none;
       animation-timing-function: @glassIn@; }
  0% { opacity: 0; animation-timing-function: @covIn@; }
}
/* Reverse: the caller's --lgs-ease-mat-out holds the glass while the content
   leaves (55 %), then it dissolves; coverage goes last. Call:
   var(--lgs-motion-mat-out) forwards, on a node removed when it ends. */
@keyframes lgs-mat-glass-out {
  0% { opacity: 1; }
  @covOutAt@ { opacity: 1; animation-timing-function: @covOut@; }
  100% { scale: calc(1 + clamp(.01, 12 / var(--lgs-maxside, 80), .15));
         background-color: transparent; backdrop-filter: blur(0px) saturate(1); box-shadow: none; opacity: 0; }
}
/* Large glass (> 600 px: alerts): no blur ramp (R8), so opacity carries the
   whole glass channel, min(1, g / .8); the swell rides the glass (C2). */
@keyframes lgs-mat-large-in {
  0% { scale: calc(1 + clamp(.01, 12 / var(--lgs-maxside, 640), .15)); animation-timing-function: @glassIn@; }
  0% { opacity: 0; animation-timing-function: @largeCovIn@; }
}
/* Content channel of small glass: hidden until 35 %, sharpens last (C1). */
@keyframes lgs-mat-content-in {
  0%, 35% { opacity: 0; filter: blur(8px); animation-timing-function: linear; }
}
@keyframes lgs-mat-content-out {
  55%, 100% { opacity: 0; filter: blur(8px); }
}
/* Toast (MO 4.10), called on snappy (488 ms, b15): the materialize ends in the
   first 250 ms; the small drop from the anchor's side rides the b15 easing. */
@keyframes lgs-toast-in {
  0% { scale: calc(1 + clamp(.01, 12 / var(--lgs-maxside, 80), .15));
       background-color: transparent; backdrop-filter: blur(0px) saturate(1); box-shadow: none;
       animation-timing-function: @toastGlass@; }
  0% { opacity: 0; animation-timing-function: @toastCov@; }
  0% { translate: 0 var(--lgs-toast-dy, -8px); }
}
/* Sheet (MO 4.8), called on sheet-in (735 ms, b0): scale .97 -> 1 rides the
   spring; opacity carries the glass channel, min(1, spring / .8), because a
   large slab may not ramp its blur (R8). Dismiss: the mirror, after a hold. */
@keyframes lgs-sheet-in {
  0% { scale: var(--lgs-sheet-s0, .97); }
  0% { opacity: 0; animation-timing-function: @sheetCovIn@; }
}
@keyframes lgs-sheet-out {
  0% { opacity: 1; }
  @sheetCovOutAt@ { opacity: 1; animation-timing-function: @sheetCovOut@; }
  100% { scale: var(--lgs-sheet-s1, .98); opacity: 0; }
}
@keyframes lgs-sheet-content-in {
  0%, 25% { opacity: 0; animation-timing-function: @sheetContent@; }
}
@keyframes lgs-sheet-content-out {
  40%, 100% { opacity: 0; }
}
/* Menu morph from its source (MO 4.6, 6.4), on morph-open with the b0 curve:
   the clip grows from the source rect (--sx --sy --sw --sh --sr, relative to
   the menu box; T1 defaults a 64 x 48 capsule at the top left) to the menu. */
@keyframes lgs-morph {
  from { clip-path: inset(var(--sy, 0px) calc(100% - var(--sx, 0px) - var(--sw, 64px))
                          calc(100% - var(--sy, 0px) - var(--sh, 48px)) var(--sx, 0px) round var(--sr, 24px)); }
  to   { clip-path: inset(0 0 0 0 round var(--lgs-morph-r, var(--lgs-r-menu, 32px))); }
}
@keyframes lgs-morph-content {
  0%, 15% { opacity: 0; animation-timing-function: @morphContent@; }
}
/* The source "takes the hit" as its menu closes (x1.03, MO 4.6). */
@keyframes lgs-catch {
  35% { scale: 1.03; }
}
/* Focus layers: the first frame already shows --lgs-focus-first (CTL 4.3). */
@keyframes lgs-focus-in {
  from { opacity: var(--lgs-focus-first, .6); }
}
/* Route and tab content (MO 4.12): fade with <= 16 px of parallax. */
@keyframes lgs-page-in {
  from { opacity: 0; translate: var(--lgs-page-dx, 0px) var(--lgs-page-dy, 0px); }
}
@keyframes lgs-page-out {
  to { opacity: 0; }
}
/* Content arrival (GP scroll jump; list insertion with --lgs-arrive-dy: 8px). */
@keyframes lgs-arrive {
  from { opacity: 0; translate: 0 var(--lgs-arrive-dy, 16px); }
}
/* Toggle knob lifts into clear glass (MO 4.15, 6.4); rest at both ends. */
@keyframes lgs-knob-lift {
  20%, 65% { scale: 1.3 1.2; background-color: rgb(255 255 255 / .35); }
}
@keyframes lgs-shift-in {
  from { translate: var(--lgs-shift-x, 0px) var(--lgs-shift-y, 0px); }
}
@keyframes lgs-fade-in {
  from { opacity: 0; }
}
@keyframes lgs-fade-out {
  to { opacity: 0; }
}
/* Scroll edge effect, scroll-driven (MO 4.13). */
@keyframes lgs-edge-in {
  from { opacity: 0; }
}

/* Reduce Motion (MO C8, VP P-56): every keyframe becomes opacity only. The
   content and decorative ones are empty, because their glass fades as a whole.
   A later @keyframes of the same name inside a matching @media wins (proven on
   Chromium 126, wp/P5.md P5-K2). */
@media (prefers-reduced-motion: reduce) {
  @keyframes lgs-mat-glass-in { from { opacity: 0; } }
  @keyframes lgs-mat-glass-out { to { opacity: 0; } }
  @keyframes lgs-mat-large-in { from { opacity: 0; } }
  @keyframes lgs-mat-content-in { }
  @keyframes lgs-mat-content-out { }
  @keyframes lgs-toast-in { from { opacity: 0; } }
  @keyframes lgs-sheet-in { from { opacity: 0; } }
  @keyframes lgs-sheet-out { to { opacity: 0; } }
  @keyframes lgs-sheet-content-in { }
  @keyframes lgs-sheet-content-out { }
  @keyframes lgs-morph { from { opacity: 0; } }
  @keyframes lgs-morph-content { }
  @keyframes lgs-catch { }
  @keyframes lgs-focus-in { from { opacity: var(--lgs-focus-first, .6); } }
  @keyframes lgs-page-in { from { opacity: 0; } }
  @keyframes lgs-page-out { to { opacity: 0; } }
  @keyframes lgs-arrive { from { opacity: 0; } }
  @keyframes lgs-knob-lift { }
  @keyframes lgs-shift-in { }
  @keyframes lgs-fade-in { from { opacity: 0; } }
  @keyframes lgs-fade-out { to { opacity: 0; } }
  @keyframes lgs-edge-in { from { opacity: 0; } }
}

/* ------------------------------------------------- opt-in utility classes
   For our own nodes, and for Steam nodes whose `animation` list may be
   replaced (MO R3). Inputs as for the keyframes (--lgs-maxside, ...). */
html.lgs-on .lgs-mat { animation: lgs-mat-glass-in var(--lgs-motion-mat-in) backwards; }
html.lgs-on .lgs-mat > * { animation: lgs-mat-content-in var(--lgs-motion-mat-in) backwards; }
html.lgs-on .lgs-mat-out { animation: lgs-mat-glass-out var(--lgs-motion-mat-out) forwards; }
html.lgs-on .lgs-mat-out > * { animation: lgs-mat-content-out var(--lgs-d-mat-out) linear forwards; }
html.lgs-on .lgs-arrive { animation: lgs-arrive var(--lgs-motion-page) backwards; }
"""

KEYFRAME_NAMES = re.findall(r"@keyframes (lgs-[a-z0-9-]+) \{\n", KEYFRAMES)


def emit_css():
    D = motion_data()
    L = ["/* 02-motion.nowrap.css: Glass Shell motion tokens and keyframes (package P5).",
         "   GENERATED by docs/phase2/research/springs.py --write. Do not edit by hand:",
         "   change springs.py and re-run it (PLAN 1.5). Contract: docs/phase2/contracts/motion.md.",
         f"   version {D['version']} */",
         "",
         "/* No @property here: the illumination progress values (--lgs-hover, --lgs-press,",
         "   --lgs-focus; MO 6.2, D2 16) are registered once, by P4 in 00-tokens.nowrap.css.",
         "   A second registration in this later file would silently override P4's. */",
         "",
         "html.lgs-on {",
         "  /* Easing: one linear() per bounce, normalised to the settling time (D2 11.3). */"]
    for name, b in CURVES:
        L.append(f"  --lgs-ease-{name}: {D['curves'][name]};")
    L.append("  /* cubic-bezier() fallbacks, only where linear() cannot go (1.1-1.4 % RMS). */")
    for name, b in CURVES:
        L.append(f"  --lgs-ease-{name}-cb: {D['beziers'][name]};")
    L.append("  /* Small glass leaving: held while its content goes (55 %), then dissolved. */")
    L.append(f"  --lgs-ease-mat-out: {D['comp']['matOut']};")
    L.append("")
    L.append("  /* Spring tokens (D2 11.2): duration = settling time, easing by bounce, and the")
    L.append("     pair as one shorthand: transition: scale var(--lgs-motion-snappy). */")
    for t in D["tokens"]:
        n = t["name"]
        L.append(f"  --lgs-d-{n}: {t['ms']}ms;  --lgs-ease-{n}: var(--lgs-ease-{t['ease']});"
                 f"  --lgs-motion-{n}: var(--lgs-d-{n}) var(--lgs-ease-{n});"
                 f"  /* d {num(t['d'], 2)} b {num(t['b'], 2)}: {t['use']} */")
    L.append("")
    L.append("  /* Linear and fixed durations. */")
    for n, v, ease, use in LINEAR:
        extra = f"  --lgs-motion-{n}: var(--lgs-d-{n}) {ease};" if ease else ""
        L.append(f"  --lgs-d-{n}: {v}ms;{extra}  /* {use} */")
    L.append("")
    L.append("  /* Delays and stagger (VP I-3, P-06; MO 4.14). */")
    for n, v, use in DELAYS:
        L.append(f"  --lgs-delay-{n}: {v}ms;  /* {use} */")
    L.append(f"  --lgs-stagger: {STAGGER_MS}ms;  /* per inserted row, at most {STAGGER_MAX} rows */")
    L.append("}")
    L.append("")
    L.append("/* Reduce Motion (MO C8, VP P-56): no bounce, every duration a fade of at most 200 ms. */")
    L.append("@media (prefers-reduced-motion: reduce) {")
    L.append("  html.lgs-on {")
    for name, b in CURVES[1:]:
        L.append(f"    --lgs-ease-{name}: var(--lgs-ease-b0);  --lgs-ease-{name}-cb: var(--lgs-ease-b0-cb);")
    names = [t["name"] for t in D["tokens"]] + [n for n, *_ in LINEAR]
    row = []
    for n in names:
        row.append(f"--lgs-d-{n}: {REDUCE_MS[n]}ms;")
        if len(row) == 4:
            L.append("    " + "  ".join(row))
            row = []
    if row:
        L.append("    " + "  ".join(row))
    L.append("  }")
    L.append("}")
    css = "\n".join(L) + "\n" + KEYFRAMES
    for k, v in D["comp"].items():
        css = css.replace(f"@{k}@", v)
    assert "@" not in re.sub(r"@(property|keyframes|media)\b", "", css), "unfilled template field"
    return css


# ------------------------------------------------------------------- JS output

JS = r"""/* device/shared/motion.js: Glass Shell motion library (package P5).
   GENERATED by docs/phase2/research/springs.py --write. Do not edit by hand:
   change springs.py and re-run it (PLAN 1.5). Contract: docs/phase2/contracts/motion.md section 3.
   version @@VERSION@@

   Closed-form springs (MO 8), the token table (D2 11.2) and a motion audit.
   No dependencies and no side effects at load other than publishing the API:
   module.exports (P1's loader: rt.shared.motion; node) and globalThis.__LGS_MOTION
   (P1 deletes it at teardown; in vr:systemui call __LGS_MOTION.remove()).
   Times are milliseconds, except spring(), which keeps MO 8's seconds. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module && typeof module.exports === 'object') module.exports = api;
  if (root) root.__LGS_MOTION = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const DATA = @@DATA@@;

  const clock = () => (root && root.performance && root.performance.now ? root.performance.now() : Date.now());
  const tokens = {};
  for (const t of DATA.tokens) {
    tokens[t.name] = Object.freeze(Object.assign({}, t, {
      durVar: '--lgs-d-' + t.name, easeVar: '--lgs-ease-' + t.ease }));
  }
  for (const t of DATA.linear) {
    tokens[t.name] = Object.freeze({ name: t.name, linear: true, ms: t.ms, durVar: '--lgs-d-' + t.name,
      easing: t.name === 'mat-out' ? DATA.composites.matOut : 'linear' });
  }
  Object.freeze(tokens);
  const curves = Object.freeze(Object.assign({}, DATA.curves, { matOut: DATA.composites.matOut }));
  const reduceMs = Object.freeze(Object.assign({}, DATA.reduceMs));
  const delays = Object.freeze(Object.assign({}, DATA.delays, { stagger: DATA.stagger[0], staggerMax: DATA.stagger[1] }));

  function tok(name) {
    const k = tokens[name];
    if (!k) throw new Error('lgs motion: unknown token ' + name);
    return k;
  }

  // MO 8. y = x - target; returns [y(t), y'(t)] for y(0) = y0, y'(0) = v0.
  // d = perceptual duration (s), b = bounce (-1..1), mass 1, t in seconds.
  function spring(y0, v0, t, d, b) {
    const w = 2 * Math.PI / d, z = b >= 0 ? 1 - b : 1 / (1 + b);
    if (Math.abs(z - 1) < 1e-6) {                                  // critically damped
      const e = Math.exp(-w * t), B = v0 + w * y0;
      return [e * (y0 + B * t), e * (B - w * (y0 + B * t))];
    }
    if (z < 1) {                                                    // underdamped
      const wd = w * Math.sqrt(1 - z * z), e = Math.exp(-z * w * t);
      const B = (v0 + z * w * y0) / wd, c = Math.cos(wd * t), s = Math.sin(wd * t);
      return [e * (y0 * c + B * s), e * ((-z * w) * (y0 * c + B * s) + (-y0 * wd * s + B * wd * c))];
    }
    const q = Math.sqrt(z * z - 1), r1 = -w * (z - q), r2 = -w * (z + q);   // overdamped
    const A = (v0 - r2 * y0) / (r1 - r2), C = y0 - A;
    return [A * Math.exp(r1 * t) + C * Math.exp(r2 * t), A * r1 * Math.exp(r1 * t) + C * r2 * Math.exp(r2 * t)];
  }

  // Progress of a 0 -> 1 step `ms` after it started (overshoot included); 1 from the settle on.
  function sample(name, ms) {
    const k = tok(name);
    if (!(ms > 0)) return 0;
    if (ms >= k.ms) return 1;
    if (k.linear) return ms / k.ms;
    return 1 + spring(-1, 0, ms / 1000, k.d, k.b)[0];
  }
  // d(progress)/dt in 1/s.
  function velocity(name, ms) {
    const k = tok(name);
    if (!(ms >= 0) || ms >= k.ms) return 0;
    if (k.linear) return 1000 / k.ms;
    return spring(-1, 0, ms / 1000, k.d, k.b)[1];
  }
  function settle(name, opts) {
    const k = tok(name);
    return opts && opts.reduce ? reduceMs[name] : k.ms;
  }
  function easingOf(name, reduce) {
    const k = tok(name);
    if (k.linear) return k.easing;
    return reduce ? curves.b0 : curves[k.ease];
  }
  // For el.animate(): literal strings, no var().
  function timing(name, opts) {
    opts = opts || {};
    return { duration: settle(name, opts), easing: easingOf(name, !!opts.reduce), delay: opts.delay || 0,
      fill: opts.fill || 'backwards', iterations: 1 };
  }
  function css(name) {
    const k = tok(name);
    if (k.linear) return 'var(--lgs-d-' + name + ') ' + (name === 'mat-out' ? 'var(--lgs-ease-mat-out)' : 'linear');
    return 'var(--lgs-d-' + name + ') var(--lgs-ease-' + name + ')';
  }

  // A retargetable spring (MO 8, C5): .to() starts from the current value and
  // velocity; .done() latches once |y| < 0.001 travel and |v| < 0.01 travel / d,
  // and the value is then exactly the target (push it once, then stop).
  function create(name, opts) {
    const k = tok(name);
    opts = opts || {};
    const reduce = !!opts.reduce;
    let target = +opts.value || 0, from = target, y0 = 0, v0 = 0, t0 = 0, travel = 1, still = true;
    function state(now) {
      if (still) return [target, 0];
      const ms = Math.max(0, now - t0);
      if (k.linear) {
        if (ms >= k.ms) { still = true; return [target, 0]; }
        return [from + (target - from) * ms / k.ms, (target - from) * 1000 / k.ms];
      }
      const r = spring(y0, v0, ms / 1000, k.d, k.b);
      if ((Math.abs(r[0]) < 1e-3 * travel && Math.abs(r[1]) < 1e-2 * travel / k.d) || ms > 4 * k.ms) {
        still = true;
        return [target, 0];
      }
      return [target + r[0], r[1]];
    }
    const at = (now) => state(now === undefined ? clock() : now);
    const s = {
      get target() { return target; },
      get token() { return name; },
      to(next, now) {
        next = +next;
        if (now === undefined) now = clock();
        const cur = state(now);
        if (next === target) return s;
        target = next;
        if (reduce) { still = true; return s; }
        from = cur[0]; y0 = cur[0] - next; v0 = cur[1]; t0 = now;
        travel = Math.max(Math.abs(y0), Math.abs(v0) * k.d / (2 * Math.PI) || 0, 1e-9);
        still = false;
        return s;
      },
      value(now) { return at(now)[0]; },
      velocity(now) { return at(now)[1]; },
      done(now) { at(now); return still; },
      jump(v) { target = +v; still = true; return s; },
    };
    return s;
  }

  function reduced(win) {
    try { return !!(win || root).matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  // ---- audit (G-MOTION, VP P-52 / P-58)
  function parseLinear(str) {
    const m = /^\s*linear\(([^)]*)\)\s*$/.exec(String(str));
    if (!m) return null;
    const pts = [];
    for (const item of m[1].split(',')) {
      const parts = item.trim().split(/\s+/);
      const v = parseFloat(parts[0]);
      const ps = parts.slice(1).map(parseFloat);
      if (!ps.length) pts.push([v, null]);
      for (const p of ps) pts.push([v, p]);
    }
    if (!pts.length) return null;
    if (pts[0][1] === null) pts[0][1] = 0;
    if (pts[pts.length - 1][1] === null) pts[pts.length - 1][1] = 100;
    let hi = pts[0][1];
    for (const p of pts) if (p[1] !== null) { if (p[1] < hi) p[1] = hi; hi = p[1]; }
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][1] !== null) continue;
      let j = i;
      while (pts[j][1] === null) j++;
      const a = pts[i - 1][1], b = pts[j][1];
      for (let q = i; q < j; q++) pts[q][1] = a + (b - a) * (q - i + 1) / (j - i + 1);
      i = j;
    }
    return pts;
  }
  function sameLinear(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i][0] - b[i][0]) > 1.5e-3 || Math.abs(a[i][1] - b[i][1]) > 0.06) return false;
    }
    return true;
  }
  const allowedEasings = Object.values(DATA.curves).concat(Object.values(DATA.composites).filter((s) => /^linear\(/.test(s)));
  const allowedLinear = allowedEasings.map(parseLinear);
  const allowedBezier = Object.values(DATA.beziers).map((s) => s.match(/-?[\d.]+/g).map(Number));
  const allowedDurations = [...new Set(Object.values(tokens).map((t) => t.ms).concat(Object.values(reduceMs)))].sort((a, b) => a - b);
  function isTokenEasing(str) {
    str = String(str).trim();
    if (str === 'linear') return true;
    if (/^cubic-bezier\(/.test(str)) {
      const v = str.match(/-?[\d.]+/g).map(Number);
      return allowedBezier.some((b) => b.every((x, i) => Math.abs(x - v[i]) < 1.5e-3));
    }
    const p = parseLinear(str);
    return !!p && allowedLinear.some((q) => sameLinear(p, q));
  }
  function isTokenDuration(ms) {
    return allowedDurations.some((d) => Math.abs(d - ms) <= 0.5);
  }
  function describe(el, pseudo) {
    if (!el) return '';
    let s = (el.tagName || '').toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = el.classList ? [...el.classList].slice(0, 3) : [];
    if (cls.length) s += '.' + cls.join('.');
    return s + (pseudo || '');
  }
  // A scroll-driven animation (animation-timeline: a scroll() / view() / named scroll timeline,
  // e.g. lgs-edge-in, MO 4.13) tracks the scroll position, not time: it is "running" for as long
  // as its scroller exists, yet nothing moves while the scroll is still. Probe P5-K4 (wp/P5.md).
  function isScrollDriven(a) {
    const tl = a && a.timeline;
    if (!tl) return false;
    const n = (tl.constructor && tl.constructor.name) || '';
    return /^(Scroll|View)Timeline$/.test(n) || (typeof tl.source !== 'undefined' && typeof tl.axis !== 'undefined');
  }
  function audit(doc) {
    doc = doc || (root && root.document);
    const out = [];
    for (const a of doc.getAnimations()) {
      const e = a.effect;
      if (!e) continue;
      const tm = e.getTiming();
      const kind = (a.constructor && a.constructor.name) || 'Animation';
      const scroll = isScrollDriven(a);
      let easings = [tm.easing];
      if (kind === 'CSSAnimation' && e.getKeyframes) easings = [...new Set(e.getKeyframes().map((f) => f.easing))];
      out.push({ name: a.animationName || a.transitionProperty || a.id || '', kind,
        target: describe(e.target, e.pseudoElement), duration: tm.duration, delay: tm.delay, easings,
        iterations: tm.iterations, fill: tm.fill, playState: a.playState, scroll,
        tokenDuration: scroll || isTokenDuration(+tm.duration), tokenEasing: easings.every(isTokenEasing) });
    }
    return out;
  }

  const api = {
    version: DATA.version,
    tokens, names: Object.keys(tokens), reduceMs, delays, curves,
    beziers: Object.freeze(Object.assign({}, DATA.beziers)),
    composites: Object.freeze(Object.assign({}, DATA.composites)),
    keyframes: Object.freeze(DATA.keyframes.slice()),
    ramps: Object.freeze(DATA.ramps.map((r) => Object.freeze({ name: r[0], a: r[1], b: r[2] }))),
    spring, sample, velocity, settle, timing, css, create, reduced,
    allowed: Object.freeze({ durations: Object.freeze(allowedDurations), easings: Object.freeze(allowedEasings.slice()) }),
    isTokenEasing, isTokenDuration, isScrollDriven, audit,
    remove() { try { if (root && root.__LGS_MOTION === api) delete root.__LGS_MOTION; } catch (e) { /* frozen global */ } },
  };
  return Object.freeze(api);
});
"""


def emit_js():
    D = motion_data()
    data = dict(D["table"])
    data["version"] = D["version"]
    data["keyframes"] = KEYFRAME_NAMES
    blob = json.dumps(data, indent=1, sort_keys=True).replace("\n", "\n  ")
    return JS.replace("@@VERSION@@", D["version"]).replace("@@DATA@@", blob)


# -------------------------------------------------------------------- C++ output

def cname(name):
    return "k" + "".join(p.capitalize() for p in name.split("-"))


def fl(v):
    s = repr(float(v))
    return s + "f"


def emit_h():
    D = motion_data()
    L = ["// native/shared/motion_tokens.h: Glass Shell motion tokens for glassd (package P5).",
         "// GENERATED by docs/phase2/research/springs.py --write. Do not edit by hand:",
         "// change springs.py and re-run it (PLAN 1.5). Contract: docs/phase2/contracts/motion.md section 4.",
         "// Header-only, C++17, no allocation.",
         "#pragma once",
         "#include <algorithm>",
         "#include <cmath>",
         "",
         "namespace lgs_motion {",
         "",
         f'inline constexpr const char *kVersion = "{D["version"]}";',
         "",
         "// A spring token (D2 11.2): SwiftUI Spring(duration d, bounce b), mass 1.",
         "struct Token {",
         "    const char *name;",
         "    float d, b;        // perceptual duration (s), bounce",
         "    float settleMs;    // CSS duration = settling time (|1 - x| <= 0.001)",
         "    float t90Ms;       // time to 90 % of the travel",
         "    float overshoot;   // peak overshoot, fraction of the travel",
         "};",
         ""]
    for t in D["tokens"]:
        L.append(f'inline constexpr Token {cname(t["name"])}{{"{t["name"]}", {fl(t["d"])}, {fl(t["b"])}, '
                 f'{fl(t["ms"])}, {fl(t["t90"])}, {fl(t["overshoot"])}}};  // {t["use"]}')
    L.append("inline constexpr Token kTokens[] = {" + ", ".join(cname(t["name"]) for t in D["tokens"]) + "};")
    L.append(f"inline constexpr int kTokenCount = {len(D['tokens'])};")
    L.append("")
    L.append("// Linear ramps and fixed durations (ms).")
    for n, v, _, use in LINEAR:
        L.append(f"inline constexpr float {cname(n)}Ms = {fl(v)};  // {use}")
    L.append("")
    L.append("// glassd phase policy (GM 5.2): covers and thick slabs ride these springs;")
    L.append("// other slabs ramp linearly in kMatInMs / kMatOutMs; Reduce Motion is a")
    L.append("// kReduceMs coverage fade with every optical term at its target.")
    L.append("inline constexpr const Token &kPhaseUp = kSheetIn;")
    L.append("inline constexpr const Token &kPhaseDown = kSheetOut;")
    L.append("")
    L.append("// Materialize optics ramp: ranges of m (MO 9, GM 5.3).")
    L.append("struct Range { float a, b; };")
    for n, a, b in RAMPS:
        L.append(f"inline constexpr Range kRamp{n}{{{fl(a)}, {fl(b)}}};")
    L.append("inline float ramp(float m, Range r) { return std::clamp((m - r.a) / (r.b - r.a), 0.f, 1.f); }")
    L.append("inline float smoothstep01(float x) { x = std::clamp(x, 0.f, 1.f); return x * x * (3.f - 2.f * x); }")
    L.append("// Coverage alpha of a piece of glass at materialize progress m.")
    L.append("inline float coverage(float m) { return smoothstep01(ramp(m, kRampAlpha)); }")
    L.append("")
    L.append("// MO 8: y = x - target with y(0) = y0, y'(0) = v0; t in seconds.")
    L.append("inline void spring(float y0, float v0, float t, float d, float b, float &y, float &v) {")
    L.append("    const float w = 2.f * 3.14159265358979f / d, z = b >= 0.f ? 1.f - b : 1.f / (1.f + b);")
    L.append("    if (std::fabs(z - 1.f) < 1e-6f) {  // critically damped")
    L.append("        const float e = std::exp(-w * t), B = v0 + w * y0;")
    L.append("        y = e * (y0 + B * t);")
    L.append("        v = e * (B - w * (y0 + B * t));")
    L.append("    } else if (z < 1.f) {  // underdamped")
    L.append("        const float wd = w * std::sqrt(1.f - z * z), e = std::exp(-z * w * t);")
    L.append("        const float B = (v0 + z * w * y0) / wd, c = std::cos(wd * t), s = std::sin(wd * t);")
    L.append("        y = e * (y0 * c + B * s);")
    L.append("        v = e * ((-z * w) * (y0 * c + B * s) + (-y0 * wd * s + B * wd * c));")
    L.append("    } else {  // overdamped")
    L.append("        const float q = std::sqrt(z * z - 1.f), r1 = -w * (z - q), r2 = -w * (z + q);")
    L.append("        const float A = (v0 - r2 * y0) / (r1 - r2), C = y0 - A;")
    L.append("        y = A * std::exp(r1 * t) + C * std::exp(r2 * t);")
    L.append("        v = A * r1 * std::exp(r1 * t) + C * r2 * std::exp(r2 * t);")
    L.append("    }")
    L.append("}")
    L.append("inline void spring(const Token &k, float y0, float v0, float t, float &y, float &v) { spring(y0, v0, t, k.d, k.b, y, v); }")
    L.append("// Settled (MO 8): |y| < 0.001 travel and |v| < 0.01 travel / d.")
    L.append("inline bool settled(float y, float v, float travel, float d) {")
    L.append("    return std::fabs(y) < 1e-3f * travel && std::fabs(v) < 1e-2f * travel / d;")
    L.append("}")
    L.append("// Progress of a 0 -> 1 step ms after it started; 1 from the settle on.")
    L.append("inline float sample(const Token &k, float ms) {")
    L.append("    if (!(ms > 0.f)) return 0.f;")
    L.append("    if (ms >= k.settleMs) return 1.f;")
    L.append("    float y, v;")
    L.append("    spring(k, -1.f, 0.f, ms / 1000.f, y, v);")
    L.append("    return 1.f + y;")
    L.append("}")
    L.append("")
    L.append("}  // namespace lgs_motion")
    return "\n".join(L) + "\n"


EMITTERS = {"css": emit_css, "js": emit_js, "h": emit_h}


def write_outputs():
    for kind, path in OUTPUTS.items():
        text = EMITTERS[kind]()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if old == text:
            print(f"unchanged {os.path.relpath(path, REPO)}")
            continue
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        os.replace(tmp, path)   # atomic: glass.py sync never sees half a file
        print(f"wrote {os.path.relpath(path, REPO)} ({len(text)} bytes)")


def check_outputs():
    """MO-1 and staleness. Returns the number of failures."""
    D = motion_data()
    bad = 0
    d2 = open(D2_PATH, encoding="utf-8").read()
    sec = d2[d2.index("### 11.3"):d2.index("### 11.4")]
    for name, b in CURVES:
        m = re.search(r"--lgs-ease-" + name + r":\s+(linear\([^)]*\));", sec)
        got = D["curves"][name]
        if not m:
            print(f"MO-1 {name}: not found in DESIGN2 11.3"); bad += 1
        elif m.group(1) != got:
            print(f"MO-1 {name}: DIFFERS\n  D2:  {m.group(1)}\n  gen: {got}"); bad += 1
        else:
            print(f"MO-1 {name}: byte-identical ({len(got)} chars)")
    css_text = open(OUTPUTS["css"], encoding="utf-8").read() if os.path.exists(OUTPUTS["css"]) else ""
    for name, b in CURVES:
        line = f"--lgs-ease-{name}: {D['curves'][name]};"
        print(f"MO-1 {name} in 02-motion.nowrap.css: {'present' if line in css_text else 'MISSING'}")
        bad += line not in css_text
    for kind, path in OUTPUTS.items():
        cur = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        ok = cur == EMITTERS[kind]()
        print(f"output {os.path.relpath(path, REPO)}: {'up to date' if ok else 'STALE (run --write)'}")
        bad += not ok
    print(f"version {D['version']}; {bad} failure(s)")
    return bad


NODE_TEST = r"""
const M = require(process.argv[2]);
const out = {version: M.version, samples: {}, retarget: {}, misc: {}};
for (const n of M.names) {
  const k = M.tokens[n], a = [];
  for (let ms = 0; ms <= k.ms; ms++) a.push(M.sample(n, ms));
  out.samples[n] = a;
}
for (const n of ['depth', 'snappy', 'sheet-in', 'interactive', 'mat-in']) {
  const s = M.create(n, {value: 0});
  s.to(10, 0);
  const vals = [];
  let doneAt = null;
  for (let ms = 0; ms <= 3000; ms++) {
    vals.push(s.value(ms));
    if (doneAt === null && s.done(ms)) doneAt = ms;
  }
  const r = M.create(n, {value: 0});
  r.to(10, 0);
  const before = [r.value(149.999), r.velocity(149.999)];
  r.to(0, 150);
  const after = [r.value(150), r.velocity(150)];
  let peak = -1e9; for (let ms = 150; ms < 3000; ms++) peak = Math.max(peak, r.value(ms));
  out.retarget[n] = {vals: vals.slice(0, 800), doneAt, final: s.value(5000), before, after, peakAfter: peak,
                     backDone: r.done(5000), backFinal: r.value(5000)};
}
const rm = M.create('depth', {value: 0, reduce: true}); rm.to(15, 0);
out.misc.reduceJump = [rm.value(0), rm.done(0)];
out.misc.timing = M.timing('snappy');
out.misc.timingReduce = M.timing('snappy', {reduce: true});
out.misc.css = M.css('snappy');
out.misc.tokenEasing = [M.isTokenEasing('linear(0 0%, 1 92%, 1 100%)'), M.isTokenEasing(M.curves.b15),
  M.isTokenEasing('ease'), M.isTokenEasing('cubic-bezier(0.311, 0.589, 0.077, 1.118)'), M.isTokenDuration(488),
  M.isTokenDuration(300)];
out.misc.scroll = [M.isScrollDriven({timeline: {source: null, axis: 'block'}}), M.isScrollDriven({timeline: {currentTime: 5}}),
  M.isScrollDriven({timeline: null}), M.isScrollDriven(null)];
console.log(JSON.stringify(out));
"""


def test_js():
    """MO-2: motion.js against this file's closed form, every token, 1 ms steps."""
    D = motion_data()
    js = OUTPUTS["js"]
    with tempfile.TemporaryDirectory() as tmp:
        script = os.path.join(tmp, "mo2.js")
        with open(script, "w", encoding="utf-8") as f:
            f.write(NODE_TEST)
        r = subprocess.run(["node", script, js], capture_output=True, text=True, timeout=120)
    if r.returncode:
        print(r.stderr)
        return 1
    out = json.loads(r.stdout)
    bad = 0
    print(f"motion.js version {out['version']} (springs.py {D['version']})")
    bad += out["version"] != D["version"]
    worst = 0.0
    for t in D["tokens"]:
        w, z = from_db(t["d"], t["b"])
        a = np.array(out["samples"][t["name"]])
        ms = np.arange(len(a))
        ref = np.where(ms > 0, step(w, z, ms / 1000.0), 0.0)
        err = float(np.max(np.abs(a - ref)))
        worst = max(worst, err)
        ok = err <= 0.002 and len(a) == t["ms"] + 1
        bad += not ok
        print(f"MO-2 {t['name']:14} {len(a):4} samples  max |js - py| = {err:.2e}  {'PASS' if ok else 'FAIL'}")
    for n, v, _, _ in LINEAR:
        a = np.array(out["samples"][n])
        ms = np.arange(len(a))
        err = float(np.max(np.abs(a - np.minimum(1, ms / v))))
        worst = max(worst, err)
        ok = err <= 0.002
        bad += not ok
        print(f"MO-2 {n:14} {len(a):4} samples  max |js - py| = {err:.2e}  {'PASS' if ok else 'FAIL'}")
    print(f"MO-2 worst error {worst:.2e} (limit 2e-3)")
    for n, rt in out["retarget"].items():
        tok = next((t for t in D["tokens"] if t["name"] == n), None)
        vals = np.array(rt["vals"])
        if tok:
            w, z = from_db(tok["d"], tok["b"])
            ms = np.arange(len(vals))
            ref = 10 * np.where(ms > 0, step(w, z, ms / 1000.0), 0.0)
            live = ms < (rt["doneAt"] or len(vals))
            err = float(np.max(np.abs(vals[live] - ref[live])))
        else:
            err = 0.0
        jump = abs(rt["before"][0] - rt["after"][0])
        vjump = abs(rt["before"][1] - rt["after"][1])
        settle_ms = tok["ms"] if tok else dict((a, b) for a, b, _, _ in LINEAR)[n]
        ok = (rt["final"] == 10 and rt["backFinal"] == 0 and rt["backDone"] and jump < 1e-3 and (vjump < 0.05 or not tok)
              and err < 2e-3 * 10 and rt["doneAt"] is not None and rt["doneAt"] <= settle_ms * 1.6)
        bad += not ok
        print(f"create('{n}') 0->10: done at {rt['doneAt']} ms (CSS {settle_ms}), max err {err:.1e}; retarget at 150 ms: "
              f"value jump {jump:.1e}, velocity jump {vjump:.1e}, peak after {rt['peakAfter']:.3f}  {'PASS' if ok else 'FAIL'}")
    m = out["misc"]
    print(f"reduce: to(15) -> value {m['reduceJump'][0]}, done {m['reduceJump'][1]}; timing(snappy) "
          f"{m['timing']['duration']} ms; reduce {m['timingReduce']['duration']} ms b0={m['timingReduce']['easing'] == D['curves']['b0']}")
    print(f"css('snappy') = {m['css']}; isTokenEasing/Duration checks {m['tokenEasing']} (expect T,T,F,T,T,F)")
    print(f"isScrollDriven(scroll timeline, document timeline, none, null) = {m['scroll']} (expect T,F,F,F)")
    bad += m["reduceJump"] != [15, True] or m["tokenEasing"] != [True, True, False, True, True, False]
    bad += m["scroll"] != [True, False, False, False]
    print(f"{bad} failure(s)")
    return bad


# --------------------------------------------------------------- live tests
# Run through the locked lab commands only (docs/LAB.md): a temporary stage of
# off-screen test elements in the main window, removed before the step ends.

LIVE_CASES = r"""[
 {n: 'lgs-mat-glass-in', a: 'lgs-mat-glass-in var(--lgs-motion-mat-in) backwards', cn: 'lgs-mat-content-in', c: 'lgs-mat-content-in var(--lgs-motion-mat-in) backwards'},
 {n: 'lgs-mat-glass-out', a: 'lgs-mat-glass-out var(--lgs-motion-mat-out) backwards', cn: 'lgs-mat-content-out', c: 'lgs-mat-content-out var(--lgs-d-mat-out) linear backwards'},
 {n: 'lgs-mat-large-in', a: 'lgs-mat-large-in var(--lgs-motion-mat-in) backwards', s: '--lgs-maxside: 640;'},
 {n: 'lgs-toast-in', a: 'lgs-toast-in var(--lgs-motion-snappy) backwards', cn: 'lgs-mat-content-in', c: 'lgs-mat-content-in var(--lgs-motion-mat-in) backwards'},
 {n: 'lgs-sheet-in', a: 'lgs-sheet-in var(--lgs-motion-sheet-in) backwards', cn: 'lgs-sheet-content-in', c: 'lgs-sheet-content-in var(--lgs-motion-sheet-in) backwards'},
 {n: 'lgs-sheet-out', a: 'lgs-sheet-out var(--lgs-motion-sheet-out) backwards', cn: 'lgs-sheet-content-out', c: 'lgs-sheet-content-out var(--lgs-motion-sheet-out) backwards'},
 {n: 'lgs-morph', a: 'lgs-morph var(--lgs-d-morph-open) var(--lgs-ease-b0) backwards', cn: 'lgs-morph-content', c: 'lgs-morph-content var(--lgs-d-morph-open) linear backwards', s: '--sx: 20px; --sy: 10px; --sw: 120px; --sh: 40px; --sr: 20px;'},
 {n: 'lgs-catch', a: 'lgs-catch var(--lgs-motion-snappy)'},
 {n: 'lgs-focus-in', a: 'lgs-focus-in var(--lgs-motion-hover-in) backwards'},
 {n: 'lgs-page-in', a: 'lgs-page-in var(--lgs-motion-page) var(--lgs-delay-page) backwards', s: '--lgs-page-dx: 16px;'},
 {n: 'lgs-page-out', a: 'lgs-page-out var(--lgs-motion-page-out) backwards'},
 {n: 'lgs-arrive', a: 'lgs-arrive var(--lgs-motion-page) backwards'},
 {n: 'lgs-knob-lift', a: 'lgs-knob-lift var(--lgs-d-snappy) linear'},
 {n: 'lgs-shift-in', a: 'lgs-shift-in var(--lgs-motion-snappy) backwards', s: '--lgs-shift-x: -37px;'},
 {n: 'lgs-fade-in', a: 'lgs-fade-in var(--lgs-motion-fade) backwards'},
 {n: 'lgs-fade-out', a: 'lgs-fade-out var(--lgs-motion-fade) backwards'},
 {n: 'lgs-edge-in', a: 'lgs-edge-in var(--lgs-motion-fade) backwards'},
 {n: 'lgs-mat-glass-in', cls: 'lgs-mat', cn: 'lgs-mat-content-in', label: '.lgs-mat'},
 {n: 'lgs-mat-glass-out', cls: 'lgs-mat-out', cn: 'lgs-mat-content-out', label: '.lgs-mat-out', exit: true},
 {n: 'lgs-arrive', cls: 'lgs-arrive', label: '.lgs-arrive'}
]"""

LIVE_JS = r"""(async () => {
  const w = L.surface('main'), d = w.document;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const CASES = @@CASES@@;
  const PROPS = ['opacity', 'scale', 'translate', 'filter', 'backdropFilter', 'clipPath', 'backgroundColor', 'boxShadow'];
  const snap = (el) => { const c = w.getComputedStyle(el); const o = {}; for (const p of PROPS) o[p] = c[p]; return o; };
  const html = w.getComputedStyle(d.documentElement);
  const tokens = {};
  for (const n of ['--lgs-d-snappy', '--lgs-d-sheet-in', '--lgs-d-hover-in', '--lgs-d-mat-in', '--lgs-ease-snappy', '--lgs-motion-page', '--lgs-delay-reveal'])
    tokens[n] = html.getPropertyValue(n).trim().slice(0, 48);
  const out = { lgsOn: d.documentElement.classList.contains('lgs-on'), visible: d.visibilityState,
    reduce: w.matchMedia('(prefers-reduced-motion: reduce)').matches, tokens,
    runtime: !!W.__LGS_RT, shared: !!(W.__LGS_RT && W.__LGS_RT.shared && W.__LGS_RT.shared.motion),
    global: typeof W.__LGS_MOTION, rows: [] };
  const stage = d.createElement('div');
  stage.id = 'lgs-p5-test';
  stage.style.cssText = 'position: fixed; left: -3000px; top: 0; width: 1px; height: 1px; overflow: visible; pointer-events: none;';
  d.body.appendChild(stage);
  const rows = CASES.map((cs, i) => {
    const host = d.createElement('div');
    host.style.cssText = 'position: absolute; left: 0; top: ' + (i * 90) + 'px; width: 320px; height: 76px; border-radius: 30px;' +
      ' background-color: rgb(52 54 62 / .5); backdrop-filter: blur(22px) saturate(1.8);' +
      ' box-shadow: inset 0 2px 1px -1px rgb(255 255 255 / .5); --lgs-maxside: 320;' + (cs.s || '');
    const child = d.createElement('div');
    child.textContent = 'P5';
    child.style.cssText = 'padding: 20px; color: #fff;';
    host.appendChild(child);
    stage.appendChild(host);
    return { cs, host, child, rest: snap(host), restChild: snap(child) };
  });
  const tl0 = d.timeline.currentTime;
  for (const r of rows) {
    if (r.cs.cls) r.host.className = r.cs.cls;
    else { r.host.style.animation = r.cs.a; if (r.cs.c) r.child.style.animation = r.cs.c; }
  }
  d.body.getBoundingClientRect();
  const kfs = (a) => a.effect.getKeyframes().map((k) => {
    const o = { o: k.offset, e: k.easing };
    for (const p of Object.keys(k)) if (!['offset', 'easing', 'composite', 'computedOffset'].includes(p)) o[p] = k[p];
    return o;
  });
  const timingOf = (a) => { const t = a.effect.getTiming(); return { duration: t.duration, delay: t.delay, fill: t.fill, iterations: t.iterations, kf: kfs(a) }; };
  let maxEnd = 0;
  for (const r of rows) {
    const a = r.host.getAnimations().find((x) => x.animationName === r.cs.n);
    const ac = r.cs.cn ? r.child.getAnimations().find((x) => x.animationName === r.cs.cn) : null;
    r.anim = a ? timingOf(a) : null;
    r.childAnim = ac ? timingOf(ac) : null;
    r.samples = [];
    if (a) {
      const T = r.anim.duration, D = r.anim.delay;
      maxEnd = Math.max(maxEnd, T + D);
      for (const f of [0, 0.15, 0.35, 0.5, 0.75, 0.999]) {
        a.pause(); a.currentTime = D + f * T;
        if (ac) { ac.pause(); ac.currentTime = r.childAnim.delay + f * r.childAnim.duration; }
        const h = snap(r.host), c = snap(r.child);
        r.samples.push({ f, op: h.opacity, sc: h.scale, tr: h.translate, bf: h.backdropFilter, cp: h.clipPath, bg: h.backgroundColor, cop: c.opacity, cf: c.filter });
      }
      a.currentTime = 0; a.play();
      if (ac) { ac.currentTime = 0; ac.play(); }
    }
  }
  if (W.__LGS_MOTION && W.__LGS_MOTION.audit) out.audit = W.__LGS_MOTION.audit(d).filter((x) => /^lgs-/.test(x.name)).map((x) => [x.name, x.duration, x.tokenDuration, x.tokenEasing]);
  await sleep(maxEnd + 1000);
  out.timelineAdvanced = d.timeline.currentTime - tl0;
  for (const r of rows) {
    const left = [...r.host.getAnimations(), ...r.child.getAnimations()].filter((a) => /^lgs-/.test(a.animationName || '')).map((a) => a.animationName + ':' + a.playState);
    const h = snap(r.host), c = snap(r.child);
    const diff = PROPS.filter((p) => h[p] !== r.rest[p]).map((p) => 'host.' + p + '=' + h[p]).concat(
      PROPS.filter((p) => c[p] !== r.restChild[p]).map((p) => 'child.' + p + '=' + c[p]));
    out.rows.push({ name: r.cs.label || r.cs.n, exit: !!r.cs.exit, anim: r.anim, childAnim: r.childAnim, samples: r.samples, left, diff,
      exitHeld: !!r.cs.exit && left.every((x) => /:finished$/.test(x)) && parseFloat(h.opacity) < 1e-3 });
  }
  stage.remove();
  out.leftover = !!d.getElementById('lgs-p5-test');
  return JSON.stringify(out);
})()"""

CEF_JS = r"""(async () => {
  const module = { exports: {} };
  const saved = W.__LGS_MOTION;
  (function () { @@MOTIONJS@@ }).call(W);
  const M = module.exports;
  if (saved === undefined) delete W.__LGS_MOTION; else W.__LGS_MOTION = saved;
  const out = { version: M.version, samples: {} };
  for (const n of M.names) { const k = M.tokens[n], a = []; for (let ms = 0; ms <= k.ms; ms++) a.push(+M.sample(n, ms).toFixed(9)); out.samples[n] = a; }
  const s = M.create('depth', { value: 0 }); s.to(10, 0);
  out.depthDone = (() => { for (let ms = 0; ms < 3000; ms++) if (s.done(ms)) return ms; return null; })();
  out.left = typeof W.__LGS_MOTION;
  return JSON.stringify(out);
})()"""


# Visual filmstrip (--live film): miniature scenes of our own nodes in the main window, each P5
# keyframe called as contracts/motion.md section 2 says, paused at window-nav-motion.html's sample
# points; set A = the storyboard's 5 rows, set B = small glass, toast, focus, toggle (MO 3.4, 4.x).
FILM_JS = r"""(() => {
  // P5 visual filmstrip: miniature scenes in the main window, every P5 keyframe called as
  // contracts/motion.md section 2 says, paused at f = 0, .15, .35, .5, .75, 1 of the row's time
  // (window-nav-motion.html's sample points). Our own nodes only; removed by a timer and by the caller.
  const SET = '@@SET@@';
  const w = L.surface('main'), d = w.document;
  const old = d.getElementById('lgs-p5-film'); if (old) old.remove();
  const F = [0, 0.15, 0.35, 0.5, 0.75, 1];
  const POST = ['#3b2a8f,#ff6f91', '#0f5e4f,#64d6a6', '#5b0f87,#ff3cac', '#0e4a6b,#2fb7e6', '#7a1e12,#ff7b39'];
  const posters = (y) => POST.map((g, i) => `<div style="position:absolute; left:${42 + i * 244}px; top:${y}px; width:220px; height:330px; border-radius:20px; background:linear-gradient(160deg, ${g})"></div>`).join('');
  const bars = (n, x, y, wd, gap, first) => Array.from({ length: n }, (_, k) =>
    `<div style="position:absolute; left:${x}px; top:${y + k * gap}px; width:${k === 0 && first ? first : wd}px; height:22px; border-radius:11px; background:rgb(255 255 255 / ${k === 0 ? .85 : .38})"></div>`).join('');
  const win = (inner, under) => `<div style="position:absolute; left:0; top:0; width:1280px; height:656px; border-radius:54px; overflow:hidden; background:rgb(38 38 44)">
      ${under || ''}${posters(212)}${posters(566)}
      <div style="position:absolute; left:24px; top:24px; width:60px; height:60px; border-radius:50%; background:rgb(255 255 255 / .12)"></div>
      <div style="position:absolute; left:100px; top:40px; width:150px; height:30px; border-radius:15px; background:rgb(255 255 255 / .8)"></div>
      ${inner || ''}</div>`;
  const glass = (st, cls, inner, anim) => `<div class="lgs-glass" data-lgs-mat="thick" style="position:absolute; ${st}; animation:${anim}">${inner}</div>`;
  const content = (anim, html) => `<div style="position:absolute; inset:0; animation:${anim}">${html}</div>`;

  const ROWS = {
    A: [
      { t: 'Menu: morph-open', ms: 607, crop: { x: 200, y: 90, s: 0.194 }, html: () => win(
          `<div style="position:absolute; left:286px; top:212px; width:220px; height:330px; border-radius:20px; box-shadow:0 0 26px 3px rgb(255 255 255 / .2)"></div>
           <div style="position:absolute; left:436px; top:222px; width:60px; height:60px; border-radius:50%; background:rgb(255 255 255 / .94)"></div>`) +
          glass('left:522px; top:124px; width:400px; height:502px; border-radius:32px; --sx:0px; --sy:98px; --sw:60px; --sh:60px; --sr:30px; --lgs-morph-r:32px', '',
            content('lgs-morph-content var(--lgs-d-morph-open) linear backwards',
              `<div style="position:absolute; left:20px; top:42px; width:360px; height:56px; border-radius:22px; background:rgb(0 145 255 / .86)"></div>${bars(5, 20, 118, 220, 64)}`),
            'lgs-morph var(--lgs-d-morph-open) var(--lgs-ease-b0) backwards') },
      { t: 'Alert: present', ms: 441, crop: { x: 93, y: 0, s: 0.17 }, html: () => win('') +
          `<div style="position:absolute; left:0; top:0; width:1280px; height:656px; border-radius:54px; background:rgb(0 0 0 / .35); animation:lgs-fade-in var(--lgs-motion-fade) backwards"></div>` +
          glass('left:320px; top:198px; width:640px; height:261px; border-radius:44px; --lgs-maxside:640', '',
            content('lgs-mat-content-in var(--lgs-motion-mat-in) backwards',
              `${bars(3, 36, 38, 560, 40, 300)}<div style="position:absolute; left:36px; top:171px; width:276px; height:60px; border-radius:30px; background:rgb(0 145 255 / .86)"></div>
               <div style="position:absolute; left:328px; top:171px; width:276px; height:60px; border-radius:30px; background:rgb(255 255 255 / .10)"></div>`),
            'lgs-mat-large-in var(--lgs-motion-mat-in) backwards') },
      { t: 'Sheet: present', ms: 735, crop: { x: 93, y: 0, s: 0.17 }, html: () => win('') +
          `<div style="position:absolute; left:0; top:0; width:1280px; height:656px; border-radius:54px; background:rgb(0 0 0 / .35); animation:lgs-fade-in var(--lgs-motion-fade) backwards"></div>` +
          glass('left:160px; top:108px; width:960px; height:472px; border-radius:44px', '',
            content('lgs-sheet-content-in var(--lgs-motion-sheet-in) backwards',
              `<div style="position:absolute; left:24px; top:24px; width:60px; height:60px; border-radius:50%; background:rgb(255 255 255 / .12)"></div>${bars(4, 44, 122, 300, 90, 420)}
               <div style="position:absolute; left:40px; top:300px; width:156px; height:60px; border-radius:30px; background:rgb(255 255 255 / .94)"></div>`),
            'lgs-sheet-in var(--lgs-motion-sheet-in) backwards') },
      { t: 'Sheet: dismiss', ms: 514, crop: { x: 93, y: 0, s: 0.17 }, html: () => win('') +
          `<div style="position:absolute; left:0; top:0; width:1280px; height:656px; border-radius:54px; background:rgb(0 0 0 / .35); animation:lgs-fade-out var(--lgs-motion-fade) forwards"></div>` +
          glass('left:160px; top:108px; width:960px; height:472px; border-radius:44px', '',
            content('lgs-sheet-content-out var(--lgs-motion-sheet-out) forwards',
              `<div style="position:absolute; left:24px; top:24px; width:60px; height:60px; border-radius:50%; background:rgb(255 255 255 / .12)"></div>${bars(4, 44, 122, 300, 90, 420)}
               <div style="position:absolute; left:40px; top:300px; width:156px; height:60px; border-radius:30px; background:rgb(255 255 255 / .94)"></div>`),
            'lgs-sheet-out var(--lgs-motion-sheet-out) forwards') },
      { t: 'Route change', ms: 702, crop: { x: 93, y: 0, s: 0.17 }, html: () =>
          `<div style="position:absolute; left:0; top:0; width:1280px; height:656px; border-radius:54px; overflow:hidden; background:rgb(38 38 44)">
             <div style="position:absolute; inset:0; animation:lgs-page-out var(--lgs-motion-page-out) forwards">${posters(212)}${posters(566)}</div>
             <div style="position:absolute; inset:0; --lgs-page-dx:16px; animation:lgs-page-in var(--lgs-motion-page) var(--lgs-delay-page) backwards">
               <div style="position:absolute; inset:0; border-radius:54px; background:linear-gradient(120deg, #0f5e4f, #64d6a6 60%, #03201c)"></div>
               <div style="position:absolute; left:48px; top:330px; width:420px; height:100px; border-radius:20px; background:rgb(255 255 255 / .85)"></div></div>
             <div style="position:absolute; left:24px; top:24px; width:60px; height:60px; border-radius:50%; background:rgb(255 255 255 / .12)"></div>
             <div style="position:absolute; left:100px; top:40px; width:150px; height:30px; border-radius:15px; background:rgb(255 255 255 / .8)"></div></div>` },
    ],
    B: [
      { t: 'Small glass: materialize', ms: 250, crop: { x: 380, y: 230, s: 0.45 }, html: () => win('') +
          glass('left:500px; top:300px; width:280px; height:56px; border-radius:28px; --lgs-maxside:280', '',
            content('lgs-mat-content-in var(--lgs-motion-mat-in) backwards',
              `<div style="position:absolute; left:28px; top:17px; width:224px; height:22px; border-radius:11px; background:rgb(255 255 255 / .9)"></div>`),
            'lgs-mat-glass-in var(--lgs-motion-mat-in) backwards') },
      { t: 'Small glass: dematerialize', ms: 350, crop: { x: 380, y: 230, s: 0.45 }, html: () => win('') +
          glass('left:500px; top:300px; width:280px; height:56px; border-radius:28px; --lgs-maxside:280', '',
            content('lgs-mat-content-out var(--lgs-d-mat-out) linear forwards',
              `<div style="position:absolute; left:28px; top:17px; width:224px; height:22px; border-radius:11px; background:rgb(255 255 255 / .9)"></div>`),
            'lgs-mat-glass-out var(--lgs-motion-mat-out) forwards') },
      { t: 'Toast: in', ms: 488, crop: { x: 820, y: 0, s: 0.4 }, html: () => win('') +
          glass('left:916px; top:28px; width:320px; height:76px; border-radius:38px; --lgs-maxside:320; --lgs-toast-dy:-8px', '',
            content('lgs-mat-content-in var(--lgs-motion-mat-in) backwards',
              `<div style="position:absolute; left:14px; top:14px; width:48px; height:48px; border-radius:50%; background:rgb(0 145 255 / .9)"></div>${bars(2, 76, 16, 140, 26, 200)}`),
            'lgs-toast-in var(--lgs-motion-snappy) backwards') },
      { t: 'Focus: first frame', ms: 294, crop: { x: 440, y: 250, s: 0.6 }, html: () => win('') +
          `<div style="position:absolute; left:520px; top:300px; width:240px; height:64px; border-radius:32px; background:rgb(255 255 255 / .14)">
             <div style="position:absolute; inset:0; border-radius:32px; background:rgb(255 255 255 / .9); animation:lgs-focus-in var(--lgs-motion-hover-in) backwards"></div>
             <div style="position:absolute; left:40px; top:21px; width:160px; height:22px; border-radius:11px; background:rgb(20 20 24 / .9)"></div></div>` },
      { t: 'Toggle: knob lift', ms: 488, crop: { x: 560, y: 290, s: 1.0 }, html: () => win('') +
          `<div style="position:absolute; left:600px; top:330px; width:64px; height:38px; border-radius:19px; background:rgb(48 209 88)">
             <div style="position:absolute; left:30px; top:4px; width:30px; height:30px; border-radius:50%; background:#fff; box-shadow:0 2px 6px rgb(0 0 0 / .3);
                         --lgs-shift-x:-26px; animation:lgs-knob-lift var(--lgs-d-snappy) linear, lgs-shift-in var(--lgs-motion-snappy) backwards"></div></div>` },
    ],
  }[SET];

  const stage = d.createElement('div');
  stage.id = 'lgs-p5-film';
  stage.style.cssText = 'position:fixed; inset:0; z-index:2147483000; background:#15161a; color:#fff; font:600 11px/1.2 sans-serif; pointer-events:none; overflow:hidden;';
  const TW = 186, TH = 110, X0 = 110, RH = 140;
  let h = '';
  ROWS.forEach((r, i) => {
    const y = 8 + i * RH;
    h += `<div style="position:absolute; left:8px; top:${y}px; width:96px; font:700 12px/1.25 sans-serif">${r.t}<div style="font:500 11px/1.3 sans-serif; opacity:.7; margin-top:4px">${r.ms} ms</div></div>`;
    F.forEach((f, k) => {
      const x = X0 + k * (TW + 8), c = r.crop;
      h += `<div class="p5tile" data-row="${i}" data-f="${f}" style="position:absolute; left:${x}px; top:${y}px; width:${TW}px; height:${TH}px; border-radius:8px; overflow:hidden; background:#333">
              <div style="position:absolute; left:0; top:0; width:1280px; height:720px; transform-origin:0 0; transform:scale(${c.s}) translate(${-c.x}px, ${-c.y}px)">${r.html()}</div></div>
            <div style="position:absolute; left:${x}px; top:${y + TH + 3}px; width:${TW}px; text-align:center; opacity:.8">f ${f.toFixed(2)} · ${Math.round(f * r.ms)} ms</div>`;
    });
  });
  stage.innerHTML = h;
  d.body.appendChild(stage);
  const out = { set: SET, rows: [] };
  ROWS.forEach((r, i) => {
    const row = { t: r.t, names: null, seeked: 0 };
    for (const tile of stage.querySelectorAll(`.p5tile[data-row="${i}"]`)) {
      const f = parseFloat(tile.dataset.f);
      const anims = tile.getAnimations({ subtree: true });
      if (!row.names) row.names = anims.map((a) => a.animationName + ' ' + a.effect.getTiming().duration + '/' + a.effect.getTiming().delay + ' ' + a.effect.getTiming().fill);
      for (const a of anims) { a.pause(); a.currentTime = Math.min(f * r.ms, 5000); row.seeked++; }
    }
    out.rows.push(row);
  });
  w.setTimeout(() => { const s = d.getElementById('lgs-p5-film'); if (s) s.remove(); }, 9000);
  return JSON.stringify(out);
})()"""

FILM_CLEAN_JS = ("(()=>{const d=L.surface('main').document;const s=d.getElementById('lgs-p5-film');if(s)s.remove();"
                 "return 'film stage removed: '+!!s+', left: '+!!d.getElementById('lgs-p5-film')})()")


def compose_film(mock_png, live_png, out_png):
    """Storyboard rows (window-nav-motion.html, 1920 x 1080 at 1x) above the live rows (1.5x shot)."""
    from PIL import Image, ImageDraw, ImageFont
    mock, live = Image.open(mock_png).convert("RGB"), Image.open(live_png).convert("RGB")
    W = 1640
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 22)
        small = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 18)
    except OSError:
        font = small = ImageFont.load_default()
    blocks = []
    for i, name in enumerate(["Menu: morph-open", "Alert: present", "Sheet: present", "Sheet: dismiss", "Route change"]):
        m = mock.crop((270, 120 + i * 190, 1900, 120 + i * 190 + 182))
        l = live.crop((160, int((8 + i * 140) * 1.5) - 6, 1905, int((8 + i * 140 + 128) * 1.5)))
        blocks.append((name, m.resize((W, int(m.height * W / m.width))), l.resize((W, int(l.height * W / l.width)))))
    img = Image.new("RGB", (W + 200, 70 + sum(36 + m.height + 26 + l.height + 26 for _, m, l in blocks)), (16, 17, 20))
    d = ImageDraw.Draw(img)
    d.text((20, 18), "P5 motion: window-nav-motion.html storyboard (top of each pair) vs live Steam CEF keyframes "
           "(bottom), f = 0 .15 .35 .5 .75 1", font=font, fill=(255, 255, 255))
    y = 70
    for name, m, l in blocks:
        d.text((20, y + 4), name, font=font, fill=(255, 255, 255)); y += 36
        d.text((20, y + m.height // 2 - 10), "mockup", font=small, fill=(200, 200, 200)); img.paste(m, (190, y)); y += m.height + 26
        d.text((20, y + l.height // 2 - 10), "live (P5)", font=small, fill=(120, 200, 255)); img.paste(l, (190, y)); y += l.height + 26
    img.save(out_png, optimize=True)


def live_film(extra):
    """Two locked shots (sets A and B), stage removed after each, then the comparison with the mockup."""
    bad = 0
    for st in ("A", "B"):
        name = f"p2_p5_film_{st.lower()}" + ("_reduce" if "reduce" in extra else "")
        code, so, se = glass("shot", "main", name, "--pre", FILM_JS.replace("@@SET@@", st), "--settle", "0.8", *extra)
        pre = next((ln[5:] for ln in so.splitlines() if ln.startswith("pre: ")), "{}")
        rows = json.loads(pre).get("rows", [])
        print(f"set {st}: exit {code}; " + "; ".join(f"{r['t']}: {', '.join(r['names'] or [])}" for r in rows))
        c2, so2, _ = glass("js", FILM_CLEAN_JS)
        print("  " + (so2.strip().splitlines() or ["?"])[-1])
        bad += bool(code) or not rows
    if not bad and "reduce" not in extra:
        mock = os.path.join(tempfile.gettempdir(), f"p5_mock_motion_{os.getpid()}.png")
        r = subprocess.run([sys.executable, os.path.join(REPO, "tools", "mockshot.py"),
                            os.path.join(REPO, "docs", "phase2", "mockups", "window-nav-motion.html"), mock, "1920x1080"],
                           cwd=REPO, capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(mock):
            out = os.path.join(REPO, "shots", "p2_cmp_p5_motion.png")
            compose_film(mock, os.path.join(REPO, "shots", "p2_p5_film_a.png"), out)
            os.remove(mock)
            print("comparison:", os.path.relpath(out, REPO))
        else:
            print("mockup render failed:", r.stderr[-500:]); bad += 1
    sfx = "_reduce" if "reduce" in extra else ""
    print(f"shots: shots/p2_p5_film_a{sfx}.png, shots/p2_p5_film_b{sfx}.png (look at them; the verdict is the viewer's)")
    return bad


def glass(*args):
    r = subprocess.run([sys.executable, os.path.join(REPO, "glass.py"), *args], cwd=REPO, capture_output=True,
                       text=True, encoding="utf-8", errors="replace", timeout=600)
    return r.returncode, r.stdout, r.stderr


def pre_result(stdout):
    for line in stdout.splitlines():
        if line.startswith("pre: "):
            return json.loads(line[5:])
    raise SystemExit("no pre: result\n" + stdout[-2000:])


def live(kind):
    """--live mo3 | mo4 | cef | film. Prints the measurements and a verdict; returns failures."""
    D = motion_data()
    if kind == "film":
        extra = []
        for opt in ("--mode", "--media"):
            if opt in sys.argv:
                extra += [opt, sys.argv[sys.argv.index(opt) + 1]]
        return live_film(extra)
    if kind == "cef":
        src = open(OUTPUTS["js"], encoding="utf-8").read()
        js = CEF_JS.replace("@@MOTIONJS@@", src).replace("(async () => {", "(async () => { const W = window;", 1)
        code, so, se = glass("js", js)
        if code:
            print(se[-3000:]); return 1
        out = json.loads(so.strip().splitlines()[-1] if not so.strip().startswith("{") else so.strip())
        if isinstance(out, str):
            out = json.loads(out)
        bad, worst = 0, 0.0
        for t in D["tokens"]:
            w, z = from_db(t["d"], t["b"])
            a = np.array(out["samples"][t["name"]])
            ms = np.arange(len(a))
            ref = np.where(ms > 0, step(w, z, ms / 1000.0), 0.0)
            e_all = float(np.max(np.abs(a - ref)))
            e_live = float(np.max(np.abs(a[:-1] - ref[:-1])))
            worst = max(worst, e_all)
            bad += e_all > 0.002
            print(f"MO-2 in CEF {t['name']:14} max |cef - py| = {e_all:.2e} (before the settle clamp {e_live:.1e})")
        print(f"version {out['version']}; depth create() done at {out['depthDone']} ms; global left after: {out['left']}; "
              f"worst {worst:.2e} -> {'PASS' if not bad else 'FAIL'}")
        return bad
    reduce = kind == "mo4"
    js = LIVE_JS.replace("@@CASES@@", LIVE_CASES).replace("const w = L.surface('main')", "const W = window; const w = L.surface('main')", 1)
    # --back: Steam's history back after the capture, so the route the step found is restored (LAB rule)
    args = ["shot", "main", f"p2_p5_{kind}", "--route", "/zoo/buttons", "--back", "--theme", "on", "--pre", js]
    if reduce:
        args += ["--media", "reduce"]
    if "--mode" in sys.argv:                     # lab input-mode stub (laser | pad), PLAN 2.1 M3
        args += ["--mode", sys.argv[sys.argv.index("--mode") + 1]]
    code, so, se = glass(*args)
    for line in se.splitlines():
        if line.startswith("step:") or "closed" in line:
            print(line)
    if code:
        print(so[-2000:], se[-3000:]); return 1
    out = pre_result(so)
    print(f"lgs-on {out['lgsOn']}, visibility {out['visible']}, reduce {out['reduce']}, timeline advanced "
          f"{out['timelineAdvanced']:.0f} ms, runtime {out['runtime']} shared.motion {out['shared']} global {out['global']}")
    print("tokens on html:", json.dumps(out["tokens"]))
    if out.get("audit"):
        print("audit():", out["audit"])
    bad = 0
    allowed = set(D["ms"].values()) | set(REDUCE_MS.values())
    curve_set = {c for c in D["curves"].values()}
    for r in out["rows"]:
        a = r["anim"]
        msgs = []
        if not a:
            msgs.append("NO ANIMATION")
        else:
            props = sorted({p for k in a["kf"] for p in k if p not in ("o", "e")})
            if r["childAnim"]:
                props_c = sorted({p for k in r["childAnim"]["kf"] for p in k if p not in ("o", "e")})
            else:
                props_c = []
            dur = a["duration"]
            if reduce:
                if any(p != "opacity" for p in props + props_c):
                    msgs.append(f"non-opacity props {props + props_c}")
                if dur > 200 or (r["childAnim"] and r["childAnim"]["duration"] > 200):
                    msgs.append(f"duration {dur} > 200")
            if round(dur) not in allowed:
                msgs.append(f"duration {dur} not a token")
            if a["iterations"] != 1:
                msgs.append("iterations != 1")
        if r.get("exit"):
            # a forwards exit on a node that is removed when it ends: held at opacity 0, finished
            if not r.get("exitHeld"):
                msgs.append(f"exit not held: {r['left']} {r['diff']}")
        else:
            if r["left"]:
                msgs.append(f"left running: {r['left']}")
            if r["diff"]:
                msgs.append(f"rest differs: {r['diff']}")
        bad += bool(msgs)
        head = f"{r['name']:20} {a['duration'] if a else '-':>5} ms"
        if a:
            head += f" props {sorted({p for k in a['kf'] for p in k if p not in ('o', 'e')})}"
            if r["childAnim"]:
                head += f" + child {sorted({p for k in r['childAnim']['kf'] for p in k if p not in ('o', 'e')})} {r['childAnim']['duration']} ms"
        print(head + ("  OK" if not msgs else "  FAIL: " + "; ".join(msgs)))
        if "--verbose" in sys.argv or kind == "mo3":
            for s in r["samples"]:
                print(f"    f {s['f']:<5} op {s['op']:<8} scale {s['sc']:<9} tr {s['tr']:<12} bf {s['bf'][:26]:<26} "
                      f"cp {s['cp'][:22]:<22} | child op {s['cop']:<8} {s['cf']}")
    print(f"leftover stage: {out['leftover']}; {bad} failure(s) -> {'PASS' if not bad and not out['leftover'] else 'FAIL'}")
    return bad + bool(out["leftover"])


def main(argv):
    if "--live" in argv:
        sys.exit(1 if live(argv[argv.index("--live") + 1]) else 0)
    if "--emit" in argv:
        sys.stdout.write(EMITTERS[argv[argv.index("--emit") + 1]]()); return
    if "--write" in argv:
        write_outputs(); return
    if "--check" in argv:
        sys.exit(1 if check_outputs() else 0)
    if "--test-js" in argv:
        sys.exit(1 if test_js() else 0)
    if "--css" in argv:
        print_css(); return
    rows = []

    # Apple, official presets (SwiftUI docs)
    apple = [
        ("swiftui.default (iOS 17+)", from_db(0.55, 0), "withAnimation {} default: response .55, dampingFraction 1"),
        ("swiftui.spring() legacy", from_kz((2*math.pi/0.5)**2, 0.825), "spring(response:.5, dampingFraction:.825)"),
        ("swiftui.interactiveSpring", from_kz((2*math.pi/0.15)**2, 0.86), "response .15, dampingFraction .86"),
        ("swiftui.smooth / UIKit springDuration default", from_db(0.5, 0), "duration .5, bounce 0"),
        ("swiftui.snappy", from_db(0.5, 0.15), "duration .5, bounce .15"),
        ("swiftui.bouncy", from_db(0.5, 0.3), "duration .5, bounce .3"),
    ]
    community = [
        ("kyant.highlight+press (Compose 0.5/300)", from_kz(300, 0.5), "press glow + press scale, AndroidLiquidGlass"),
        ("kyant.value (Compose 1.0/1000)", from_kz(1000, 1.0), "toggle/slider/tab value travel"),
        ("kyant.scaleX (Compose 0.6/250)", from_kz(250, 0.6), "gel: knob width on press"),
        ("kyant.scaleY (Compose 0.7/250)", from_kz(250, 0.7), "gel: knob height on press"),
        ("lgw.menuMorph (k120 c16)", from_kc(120, 16), "menu morph from button, liquid_glass_widgets"),
        ("lgw.sheet (k220 c30)", from_kc(220, 30), "sheet settle, liquid_glass_widgets"),
    ]
    ours = [
        ("lgs-interactive", from_db(0.15, 0.14), "press-in, drag-follow, focus ring snap"),
        ("lgs-hover-in", from_db(0.20, 0.0), "hover light and fill in; focus illumination in"),
        ("lgs-fade", from_db(0.30, 0.0), "hover/focus out; content cross-fades; scroll-edge; list insert"),
        ("lgs-snappy", from_db(0.35, 0.15), "selection pill travel; toggle knob travel; toast in; release (pointer)"),
        ("lgs-release-touch", from_db(0.40, 0.25), "press release when the hand pokes (direct) - more emphasis"),
        ("lgs-morph-open", from_db(0.45, 0.20), "menu / popover / dropdown grows out of its button"),
        ("lgs-morph-close", from_db(0.30, 0.0), "menu / popover returns into its button"),
        ("lgs-sheet-in", from_db(0.50, 0.0), "sheet / modal present; parent recede"),
        ("lgs-sheet-out", from_db(0.35, 0.0), "sheet / modal dismiss"),
        ("lgs-page", from_db(0.45, 0.0), "route / tab content transition"),
        ("lgs-depth", from_db(0.30, 0.0), "z-lift of popped crops (scene graph, 30 Hz)"),
    ]
    for grp, lst in (("apple", apple), ("community", community), ("ours", ours)):
        for name, (w, z), use in lst:
            r = describe(name, w, z, use)
            r["group"] = grp
            rows.append(r)

    if "--json" in argv:
        json.dump(rows, open(argv[argv.index("--json") + 1], "w"), indent=1)
    for r in rows:
        print(f"{r['group']:9} {r['name']:42} d={r['duration']:.3f} b={r['bounce']:+.2f} z={r['zeta']:.2f} k={r['stiffness']:7.1f} c={r['damping']:6.2f} "
              f"t50={r['t50_ms']:4} t90={r['t90_ms']:4} t98={r['t98_ms']:4} settle={r['settle_ms']:4} over={r['overshoot_pct']:4}% pts={r['linear_points']:2} "
              f"{r['bezier']} rms={r['bez_rms']} max={r['bez_max']}")

if __name__ == "__main__":
    main(sys.argv[1:])
