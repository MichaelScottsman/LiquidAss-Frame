"""Spring tables for docs/phase2/research/liquid-glass-motion.md (sections 3.1-3.3).

Usage: python springs.py            -> print the preset/token table
       python springs.py --css      -> print one linear() + cubic-bezier per bounce
       python springs.py --json F   -> also write the table as JSON

Model: SwiftUI Spring(duration:bounce:), mass 1.
  stiffness k = (2*pi/d)^2
  damping   c = 4*pi*(1-b)/d            (b >= 0)
  zeta      = 1 - b
Settling uses SwiftUI's epsilon 0.001 (Spring.settlingDuration docs).
Outputs: physics constants, t50/t90/t98, settle, overshoot, a CSS linear()
easing (RDP-simplified) and a least-squares cubic-bezier with its error.
"""
import math, json, sys
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

def main(argv):
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
