#!/usr/bin/env python3
"""Luma pairs on a controls mockup (G-FOCUS on the mockup; VP §6 SHOT definition, Rec.601 luma 0-255).

  python docs/phase2/mockups/controls-measure.py states        # the state matrix (controls-states.html)
  python docs/phase2/mockups/controls-measure.py system        # focus inside a row (controls-system*.html)
  python docs/phase2/mockups/controls-measure.py all [--json]

Each mockup is loaded in Chrome (the same binary as tools/mockshot.py) at 1920 x 1080, scale 1, after kit.js
sets <html data-lgk-ready>. Regions come from the live layout (getBoundingClientRect of a selector), so the
numbers follow the mockup when it changes. A rect region is the element's box inset by 6 px (VP SHOT); a
band region is the 8-16 px ring outside the box (VP P-16). Laser dots and annotation notes are hidden while
measuring. Prints one line per pair and PASS / FAIL against its minimum.

Pairs (PLAN §1.4 G-FOCUS, controls.md C6 / C20):
  P-14  focus >= rest + 40 L               P-15  focused >= navigation-selected + 15 L
  SEL   selected >= hovered + 12 L         P-16  glow band on a white or coloured fill >= rest band + 20 L
  DIS   disabled + focus >= disabled + 10 L    P-03  laser hover 10..25 L over rest
  C20   spread of the glass along each matrix row <= 8 L (specimens hidden, 40 px square at each cell centre)
"""
import io
import json
import sys
from pathlib import Path

from PIL import Image
import numpy as np
from playwright.sync_api import sync_playwright

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
HERE = Path(__file__).resolve().parent

# states board: data-st="<row>:<column>" on every cell's specimen
COLS = ['rest', 'hover', 'focus', 'pressed', 'on', 'onfocus', 'disabled', 'disfocus']
ROWS = ['capsule', 'circle', 'switch', 'check', 'popup', 'row']


def st(r, c):
    return f'[data-st="{r}:{c}"]'


def states_pairs():
    P = []
    for r in ROWS:
        # a switch's knob is white in every state: its share of the light is measured on the track beside the knob
        sub = '|0.5,0,1,1' if r == 'switch' else ''
        P.append(('P-14 ' + r + (' (track)' if sub else ''), st(r, 'focus') + sub, st(r, 'rest') + sub, 40, 'rect'))
        P.append(('DIS ' + r, st(r, 'disfocus'), st(r, 'disabled'), 10, 'rect'))
        P.append(('P-03 ' + r + (' (track)' if sub else '') + ' (10..25)', st(r, 'hover') + sub, st(r, 'rest') + sub, 10, 'rect', 25))
    for r in ['capsule', 'circle', 'switch', 'check']:
        P.append(('P-16 ' + r + ' on+focus band', st(r, 'onfocus'), st(r, 'on'), 20, 'band'))
    # the row's "on" column is the navigation selection: focus beats selection, selection beats hover
    P.append(('P-15 row focus vs nav-selected', st('row', 'focus'), st('row', 'on'), 15, 'rect'))
    P.append(('P-15b row nav-selected+focus vs nav-selected', st('row', 'onfocus'), st('row', 'on'), 10, 'rect'))
    P.append(('SEL row nav-selected vs hovered', st('row', 'on'), st('row', 'hover'), 12, 'rect'))
    return P


JOBS = {
    'states': ('controls-states.html', states_pairs),
    # a row's own share of the light: its leading 55 % (label side), so the trailing controls (a white knob, a capsule) do not dilute it
    'system': ('controls-system.html', lambda: [
        ('P-14 focused row (switch inside)', '[data-id="row-focus"]|0,0,.55,1', '[data-id="row-rest"]|0,0,.55,1', 40, 'rect')]),
    'system-popup': ('controls-system-popup.html', lambda: [
        ('P-14 focused row (pop-up inside)', '[data-id="row-focus"]|0,0,.55,1', '[data-id="row-rest"]|0,0,.55,1', 40, 'rect')]),
    'system-disabled': ('controls-system-disabled.html', lambda: [
        ('DIS disabled row focus vs disabled row', '[data-id="row-focus"]|0,0,.55,1', '[data-id="row-rest"]|0,0,.55,1', 10, 'rect')]),
    'notifications': ('controls-notifications.html', lambda: [
        ('P-16 focused on-circle band', '[data-id="check-focus"]', '[data-id="check-on"]', 20, 'band')]),
}


def luma(img):
    a = np.asarray(img.convert('RGB'), dtype=np.float64)
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def region_mean(L, r, kind, inset=6):
    x, y, w, h = r
    if kind == 'rect':
        x0, y0, x1, y1 = int(round(x + inset)), int(round(y + inset)), int(round(x + w - inset)), int(round(y + h - inset))
        return float(L[y0:y1, x0:x1].mean())
    # band 8..16 px outside the box
    x0, y0, x1, y1 = int(round(x - 16)), int(round(y - 16)), int(round(x + w + 16)), int(round(y + h + 16))
    m = np.zeros(L.shape, bool)
    m[y0:y1, x0:x1] = True
    m[int(round(y - 8)):int(round(y + h + 8)), int(round(x - 8)):int(round(x + w + 8))] = False
    return float(L[m].mean())


def rect_of(page, sel):
    """Box of a selector; 'sel|fx0,fy0,fx1,fy1' takes that fraction of the box (e.g. a switch's track beside its knob)."""
    sel, _, frac = sel.partition('|')
    x, y, w, h = page.eval_on_selector(sel, 'e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }')
    if frac:
        fx0, fy0, fx1, fy1 = map(float, frac.split(','))
        x, y, w, h = x + w * fx0, y + h * fy0, w * (fx1 - fx0), h * (fy1 - fy0)
    return x, y, w, h


def run(job, page):
    html, pairs_fn = JOBS[job]
    page.goto((HERE / html).as_uri())
    page.wait_for_function('document.documentElement.dataset.lgkReady === "1"', timeout=15000)
    page.wait_for_timeout(400)
    page.add_style_tag(content='.lgk-laser-dot, .wn-proxy, .c-note, svg[viewBox="0 0 1920 1080"] { visibility: hidden !important; }')
    page.wait_for_timeout(100)
    png = page.screenshot(type='png')
    L = luma(Image.open(io.BytesIO(png)))
    out = []
    for p in pairs_fn():
        name, a, b, mn, kind = p[:5]
        mx = p[5] if len(p) > 5 else None
        ra, rb = rect_of(page, a), rect_of(page, b)
        La, Lb = region_mean(L, ra, kind), region_mean(L, rb, kind)
        d = La - Lb
        ok = d >= mn and (mx is None or d <= mx)
        out.append({'job': job, 'pair': name, 'La': round(La, 1), 'Lb': round(Lb, 1), 'dL': round(d, 1), 'min': mn, 'max': mx, 'pass': ok})
    if job == 'states':
        # C20: the glass under every cell, with the specimens hidden (their light and glows are not the backdrop):
        # the mean of a 40 x 40 square at each cell's centre, spread along each matrix row
        page.add_style_tag(content='.st-matrix > .cl > * { visibility: hidden !important; }')
        page.wait_for_timeout(100)
        G = luma(Image.open(io.BytesIO(page.screenshot(type='png'))))
        cells = page.eval_on_selector_all('.st-matrix > .cl', 'els => els.map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })')
        for ri, r in enumerate(ROWS):
            vals = []
            for x, y, w, h in cells[ri * len(COLS):(ri + 1) * len(COLS)]:
                cx, cy = int(x + w / 2), int(y + h / 2)
                vals.append(float(G[cy - 20:cy + 20, cx - 20:cx + 20].mean()))
            spread = max(vals) - min(vals)
            out.append({'job': job, 'pair': 'C20 glass spread ' + r, 'La': round(max(vals), 1), 'Lb': round(min(vals), 1), 'dL': round(spread, 1), 'min': None, 'max': 8, 'pass': spread <= 8})
    return out


def main(argv):
    jobs = [a for a in argv[1:] if not a.startswith('--')] or ['all']
    if jobs == ['all']:
        jobs = list(JOBS)
    res = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=['--hide-scrollbars'])
        page = b.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
        for j in jobs:
            res += run(j, page)
        b.close()
    if '--json' in argv:
        print(json.dumps(res, indent=1))
    else:
        for r in res:
            rng = f">= {r['min']}" if r['max'] is None else (f"<= {r['max']}" if r['min'] is None else f"{r['min']}..{r['max']}")
            print(f"{'PASS' if r['pass'] else 'FAIL'}  {r['job']:<16} {r['pair']:<44} La {r['La']:6.1f}  Lb {r['Lb']:6.1f}  dL {r['dL']:6.1f}  ({rng})")
    return 0 if all(r['pass'] for r in res) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
