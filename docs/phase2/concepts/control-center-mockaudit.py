"""A2 for the Control Center mockups: target sizes, toggle pitch, minimum text size and bar width, read from the rendered DOM.

  python docs/phase2/concepts/control-center-mockaudit.py overview more notifications bar

Each mockup (docs/phase2/mockups/control-center-<name>.html) is copied with a <base> pointing back at the mockups folder into a
temp folder, an audit script is appended, the page is loaded in headless Chrome with --dump-dom, and the result is read back from
<html data-audit>. Nothing is written to the repo. Sizes are divided by the quad's --pop-scale and by any focus `scale`, so they
are in the quad's own CSS px (px = main window, pp = bar).
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
FLOOR = {'px': 56, 'pp': 52}   # smallest visible target: CC close circle (main px); bar art disc (pp)
AUDIT = r'''<script>
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  const out = {targets: [], minFont: {}, pitch: []};
  document.querySelectorAll('[data-id]').forEach(e => {
    const r = e.getBoundingClientRect(); const pop = e.closest('.lgk-pop');
    const s = pop ? parseFloat(getComputedStyle(pop).getPropertyValue('--pop-scale')) || 1 : 1;
    const sc = parseFloat(getComputedStyle(e).scale) || 1;
    out.targets.push([e.dataset.id, Math.round(r.width / s / sc), Math.round(r.height / s / sc), e.closest('.bar2') ? 'pp' : 'px']);
  });
  for (const root of document.querySelectorAll('.ccm, .bar2')) {
    const unit = root.classList.contains('bar2') ? 'pp' : 'px';
    root.querySelectorAll('*').forEach(e => {
      if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
        const f = parseFloat(getComputedStyle(e).fontSize); out.minFont[unit] = Math.min(out.minFont[unit] || 99, f); } });
  }
  const tg = ['wifi', 'bt', 'air', 'ms'].map(id => document.querySelector(`[data-id="${id}"]`)).filter(Boolean).map(e => e.getBoundingClientRect().left);
  for (let i = 1; i < tg.length; i++) out.pitch.push(Math.round(tg[i] - tg[i - 1]));
  out.barSlots = [...new Set([...document.querySelectorAll('.bar2 .slot')].map(e => Math.round(e.getBoundingClientRect().width / 1.2)))];
  out.barWidth = [...document.querySelectorAll('.bar2')].map(b => Math.round(b.getBoundingClientRect().width / 1.2));
  document.documentElement.setAttribute('data-audit', JSON.stringify(out));
}, 400));
</script>'''


def audit(name, tmp):
    src = open(os.path.join(MK, f'control-center-{name}.html'), encoding='utf-8').read()
    base = '<base href="file:///' + MK.replace(os.sep, '/') + '/">'
    src = src.replace('<head>', '<head>' + base, 1).replace('</body>', AUDIT + '</body>')
    fn = os.path.join(tmp, f'audit-{name}.html')
    with open(fn, 'w', encoding='utf-8') as f:
        f.write(src)
    prof = tempfile.mkdtemp(prefix='ccaudit-profile-')
    try:
        r = subprocess.run([CHROME, '--headless=new', f'--user-data-dir={prof}', '--window-size=1920,1080', '--virtual-time-budget=3000',
                            '--dump-dom', 'file:///' + fn.replace(os.sep, '/')], capture_output=True, text=True, encoding='utf-8', timeout=90)
    finally:
        shutil.rmtree(prof, ignore_errors=True)
    m = re.search(r'data-audit="([^"]*)"', r.stdout)
    if not m:
        print(name, 'no audit result', r.stderr[-300:])
        return False
    d = json.loads(m.group(1).replace('&quot;', '"'))
    small = [t for t in d['targets'] if min(t[1], t[2]) < FLOOR[t[3]]]
    ok = not small and d['minFont'].get('px', 99) >= 18 and d['minFont'].get('pp', 99) >= 15 and all(p >= 80 for p in d['pitch'])
    print(f"{name}: {'PASS' if ok else 'FAIL'}  min text {d['minFont']}  toggle pitch {d['pitch']}  bar slots pp {d['barSlots']}  "
          f"bar width pp {d['barWidth']}  targets {len(d['targets'])}  below floor {small}")
    return ok


if __name__ == '__main__':
    tmp = tempfile.mkdtemp(prefix='ccaudit-')
    try:
        results = [audit(n, tmp) for n in (sys.argv[1:] or ['overview', 'gamepad', 'notifications', 'more', 'bar'])]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(0 if all(results) else 1)
