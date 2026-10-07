"""Checks for the Control Center mockups (concept §13 A2 and the mockup half of A25), read from the rendered DOM and pixels.

  python docs/phase2/concepts/control-center-mockaudit.py [overview gamepad notifications more ...]
      A2: target sizes, toggle pitch, row / slider / segment heights, minimum text size, the close circle's clearance
      above Steam's footer ornament, and the bar width (PLAN §1.3, §1.10, §1.16).
  python docs/phase2/concepts/control-center-mockaudit.py --focus
      A25 on the mockup: renders control-center-states.html twice (as drawn, and with every hover and focus class removed)
      and prints, per control, the mean luma (VP §6 SHOT: .299 R + .587 G + .114 B, 0-255, rect inset by 4 main px) of the focused / hovered target minus the same target at rest,
      the glow band 8-16 px outside white and coloured targets, and the selection steps of PLAN §1.4 (G-FOCUS).

Each mockup (docs/phase2/mockups/control-center-<name>.html) is copied with a <base> pointing back at the mockups folder
into a temp folder, a script is appended, the page is loaded in headless Chrome, and the result is read back from
<html data-audit> (--dump-dom) or from a screenshot. Nothing is written to the repo. Sizes are divided by the quad's
--pop-scale, so they are in the quad's own CSS px (px = main window, pp = bar).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

MK = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mockups'))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
FLOOR = {'px': 60, 'pp': 52}   # smallest visible target: 60 px circles and capsules (main px); bar art disc 52 pp
FOOTER_TOP = 628               # Steam's footer ornament (PLAN §1.10): y 628-712; members 60 tall from y 640

AUDIT = r'''<script>
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  const out = {targets: [], minFont: {}, pitch: [], rows: [], sliders: [], segs: [], close: null, foot: null};
  const ov = (e) => { const o = e.closest('.lgk-overlay'); return o ? o.getBoundingClientRect() : {left: 0, top: 0}; };
  document.querySelectorAll('.ccm [data-id], .bar2 [data-id]').forEach(e => {
    if (/^tile-/.test(e.dataset.id)) return;
    const r = e.getBoundingClientRect(); const pop = e.closest('.lgk-pop');
    const s = pop ? parseFloat(getComputedStyle(pop).getPropertyValue('--pop-scale')) || 1 : 1;
    out.targets.push([e.dataset.id, Math.round(r.width / s), Math.round(r.height / s), e.closest('.bar2') ? 'pp' : 'px']);
  });
  for (const root of document.querySelectorAll('.ccm, .bar2, .cc-quiet, .wn-orn')) {
    const unit = root.classList.contains('bar2') ? 'pp' : 'px';
    root.querySelectorAll('*').forEach(e => {
      if (e.closest('.lgk-glyph')) return;        // controller glyph badges are symbols (PLAN §1.3: 30 px circle, 16 px Bold letter)
      if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
        const f = parseFloat(getComputedStyle(e).fontSize); out.minFont[unit] = Math.min(out.minFont[unit] || 99, f); } });
  }
  const tg = ['wifi', 'bt', 'air', 'ms'].map(id => document.querySelector(`.ccm [data-id="${id}"]`)).filter(Boolean).map(e => e.getBoundingClientRect().left);
  for (let i = 1; i < tg.length; i++) out.pitch.push(Math.round(tg[i] - tg[i - 1]));
  document.querySelectorAll('.ccm .c-row').forEach(e => out.rows.push([e.dataset.id, e.classList.contains('nav') ? 'nav' : 'platter', Math.round(e.getBoundingClientRect().height)]));
  document.querySelectorAll('.ccm .c-slider').forEach(e => out.sliders.push([e.dataset.id, Math.round(e.getBoundingClientRect().height)]));
  document.querySelectorAll('.ccm .c-seg > span').forEach(e => { const r = e.getBoundingClientRect(); out.segs.push([e.dataset.id, Math.round(r.width), Math.round(r.height)]); });
  const cl = document.querySelector('.ccm [data-id="close"]');
  if (cl) {
    const r = cl.getBoundingClientRect(), o = cl.closest('.ccm').getBoundingClientRect();
    out.close = {top: Math.round(r.top - o.top), bottom: Math.round(r.bottom - o.top), w: Math.round(r.width), host: cl.closest('.lgk-overlay') ? 'main' : 'popup'};
    const bar = document.querySelector('.bar2');
    if (out.close.host === 'popup' && bar) out.close.barClearPP = Math.round((bar.getBoundingClientRect().top - (r.bottom + 10)) / 1.2);   // A27 CC-A
  }
  const ft = document.querySelector('.cc-quiet, .lgk-overlay .wn-orn');
  if (ft) { const r = ft.getBoundingClientRect(), o = ov(ft); out.foot = {top: Math.round(r.top - o.top), bottom: Math.round(r.bottom - o.top)}; }
  out.barSlots = [...new Set([...document.querySelectorAll('.bar2 .slot')].map(e => Math.round(e.getBoundingClientRect().width / 1.2)))];
  out.barWidth = [...document.querySelectorAll('.bar2')].map(b => Math.round(b.getBoundingClientRect().width / 1.2));
  document.documentElement.setAttribute('data-audit', JSON.stringify(out));
}, 400));
</script>'''

RECTS = r'''<script>
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  const out = {};
  document.querySelectorAll('[data-m]').forEach(e => { const r = e.getBoundingClientRect(); out[e.dataset.m] = [r.left, r.top, r.width, r.height]; });
  document.documentElement.setAttribute('data-audit', JSON.stringify(out));
}, 400));
</script>'''

STRIP = r'''<script>document.querySelectorAll('.gp, .is-hover').forEach(e => e.classList.remove('gp', 'is-hover', 'lit'));</script>'''


def chrome(args, timeout=90):
    prof = tempfile.mkdtemp(prefix='ccaudit-profile-')
    try:
        return subprocess.run([CHROME, '--headless=new', '--hide-scrollbars', f'--user-data-dir={prof}', '--window-size=1920,1080',
                               '--force-device-scale-factor=1', '--virtual-time-budget=3000'] + args,
                              capture_output=True, text=True, encoding='utf-8', timeout=timeout)
    finally:
        shutil.rmtree(prof, ignore_errors=True)


def copy(name, tmp, tag, before_kit='', tail=''):
    src = open(os.path.join(MK, f'control-center-{name}.html'), encoding='utf-8').read()
    base = '<base href="file:///' + MK.replace(os.sep, '/') + '/">'
    src = src.replace('<head>', '<head>' + base, 1)
    if before_kit:
        src = src.replace('<script src="kit.js"></script>', before_kit + '<script src="kit.js"></script>', 1)
    src = src.replace('</body>', tail + '</body>')
    fn = os.path.join(tmp, f'{tag}-{name}.html')
    with open(fn, 'w', encoding='utf-8') as f:
        f.write(src)
    return 'file:///' + fn.replace(os.sep, '/')


def dom(url):
    r = chrome(['--dump-dom', url])
    m = re.search(r'data-audit="([^"]*)"', r.stdout)
    return json.loads(m.group(1).replace('&quot;', '"')) if m else None


def audit(name, tmp):
    d = dom(copy(name, tmp, 'audit', tail=AUDIT))
    if d is None:
        print(name, 'no audit result')
        return False
    problems = []
    small = [t for t in d['targets'] if min(t[1], t[2]) < FLOOR[t[3]] and not t[0].endswith('-mute')]
    if small:
        problems.append(f'below floor {small}')
    if d['minFont'].get('px', 99) < 18 or d['minFont'].get('pp', 99) < 15:
        problems.append(f"text {d['minFont']}")
    if any(p < 84 for p in d['pitch']):
        problems.append(f"toggle pitch {d['pitch']}")
    bad_rows = [r for r in d['rows'] if (r[1] == 'platter' and r[2] < 80) or (r[1] == 'nav' and r[2] < 72)]
    if bad_rows:
        problems.append(f'rows {bad_rows}')
    bad_sl = [s for s in d['sliders'] if s[1] < 64]
    if bad_sl:
        problems.append(f'sliders {bad_sl}')
    bad_seg = [s for s in d['segs'] if s[1] < 140 or s[2] < 60]
    if bad_seg:
        problems.append(f'segments {bad_seg}')
    cl = d.get('close')
    if cl and (cl['w'] < 60 or (cl['host'] == 'main' and cl['bottom'] > FOOTER_TOP - 12)    # visible bottom <= 616: 24 px clear of the members at 640
               or (cl['host'] == 'popup' and cl.get('barClearPP', 99) < 36)):                 # A27: CC-A x hit >= 36 pp above the bar
        problems.append(f'close {cl}')
    ok = not problems
    print(f"{name}: {'PASS' if ok else 'FAIL'}  min text {d['minFont']}  toggle pitch {d['pitch']}  rows {sorted(set(r[2] for r in d['rows']))}  "
          f"sliders {sorted(set(s[1] for s in d['sliders']))}  close {cl}  footer {d.get('foot')}  bar slots pp {d['barSlots']}  "
          f"bar width pp {d['barWidth']}  targets {len(d['targets'])}" + ('' if ok else '  PROBLEMS: ' + '; '.join(problems)))
    return ok


def focus(tmp):
    from PIL import Image
    import numpy as np
    rects = dom(copy('states', tmp, 'rects', tail=RECTS))
    shots = {}
    for tag, pre in (('drawn', ''), ('rest', STRIP)):
        png = os.path.join(tmp, f'{tag}.png')
        chrome([f'--screenshot={png}', copy('states', tmp, tag, before_kit=pre)])
        im = np.asarray(Image.open(png).convert('RGB')).astype(float)
        shots[tag] = im[..., 0] * .299 + im[..., 1] * .587 + im[..., 2] * .114      # VP §6 SHOT luma
    def mean(img, r, inset=4):
        # VP §6 SHOT: the element's rect inset by 6 shot px (= 4 main px; mockups are drawn at 1 main px per view px)
        x, y, w, h = [int(round(v)) for v in r]
        return float(img[y + inset:y + h - inset, x + inset:x + w - inset].mean())
    def band(img, r, a=8, b=16):
        x, y, w, h = [int(round(v)) for v in r]
        outer = img[y - b:y + h + b, x - b:x + w + b].astype(float)
        mask = np.ones(outer.shape, bool)
        mask[b - a:b + h + a, b - a:b + w + a] = False
        return float(outer[mask].mean())
    rows, ok = [], True
    for cid in ('wifi', 'air', 'gear', 'row', 'cap', 'vol', 'off', 'on', 'nav'):
        for st in ('h', 'f'):
            k = f'{st}-{cid}'
            if k not in rects:
                continue
            d = mean(shots['drawn'], rects[k]) - mean(shots['rest'], rects[k])
            if st == 'h' and cid in ('off', 'on'):
                pass
            rows.append((k, round(d, 1)))
    print('mean luma step over the same target at rest (VP §6 SHOT luma, 0-255, rect inset 4 px):')
    for k, d in rows:
        print(f'  {k:8s} {d:+6.1f}')
    glow = {k: round(band(shots['drawn'], rects[k]) - band(shots['rest'], rects[k]), 1) for k in ('f-wifi', 'f-on', 'f-vol') if k in rects}
    glow_css = {k: round(band(shots['drawn'], rects[k], 5, 11) - band(shots['rest'], rects[k], 5, 11), 1) for k in glow}
    print('glow band 8-16 px outside (P-16 read as CSS px), focus minus rest:', glow)
    print('glow band 5-11 px outside (P-16 read as shot px = 8-16 / 1.5), focus minus rest:', glow_css)
    sel_vs_focus = round(mean(shots['drawn'], rects['f-nav']) - mean(shots['drawn'], rects['f-nsel']), 1)
    sel_vs_hover = round(mean(shots['drawn'], rects['h-nsel']) - mean(shots['drawn'], rects['h-nav']), 1)
    print(f'P-15 focused unselected row minus selected row (same tile): {sel_vs_focus:+.1f}')
    print(f'T-SEL selected row minus hovered row (same tile): {sel_vs_hover:+.1f}')
    f = dict(rows)
    crit = {
        'P-14 focus >= +40 on uncoloured controls and rows': all(f[f'f-{c}'] >= 40 for c in ('air', 'gear', 'row', 'cap', 'nav')),
        'P-16 glow band >= +20 on white and coloured fills (8-16 px)': all(v >= 20 for k, v in glow.items() if k in ('f-wifi', 'f-on')),
        'P-15 focus >= selected + 15': sel_vs_focus >= 15,
        'T-SEL selected >= hovered + 12': sel_vs_hover >= 12,
        'P-03 hover +10..+25': all(10 <= f[f'h-{c}'] <= 25 for c in ('air', 'gear', 'row', 'cap')),
    }
    for k, v in crit.items():
        print(f"  {'PASS' if v else 'FAIL'}  {k}")
        ok &= v
    print(f"slider (f-vol) {f.get('f-vol')}: the white fill cannot brighten; knob + track lift + glow carry it (glow {glow.get('f-vol')})")
    return ok


if __name__ == '__main__':
    tmp = tempfile.mkdtemp(prefix='ccaudit-')
    try:
        if '--focus' in sys.argv:
            results = [focus(tmp)]
        else:
            results = [audit(n, tmp) for n in (sys.argv[1:] or ['overview', 'overview-t1', 'overview-dim', 'gamepad', 'notifications', 'more', 'popup'])]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(0 if all(results) else 1)
