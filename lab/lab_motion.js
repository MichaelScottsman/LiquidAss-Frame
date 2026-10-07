// Motion filmstrips for `glass.py motion` (P10, contracts/lab.md section 4; G-MOTION, VP P-52 to P-58).
// Evaluated after lab_helpers.js, lab_p2.js and lab_gates.js; adds L.motion.
//
// Freezing (review R1 M1): mark() records the animations already running before the pre; right after the
// pre, freeze() pauses every new one (Animation.pause(), which holds CSS animations and transitions too).
// seek(f) pauses any animation that started since, sets currentTime = f x (delay + active duration) and
// waits two requestAnimationFrames of the surface's window, so the compositor has drawn that state before
// the lab captures it. release() plays them again (from the last f) and forgets the step's state.
(function () {
  const L = window.__LGS_LAB;
  if (!L || !L.gates || (L.motion && L.motion.v === 3)) return;

  const PROPS_SKIP = new Set(['offset', 'computedOffset', 'easing', 'composite']);
  function props(a) {
    if (a.transitionProperty) return [a.transitionProperty];
    const out = new Set();
    try { for (const k of a.effect.getKeyframes()) for (const p of Object.keys(k)) if (!PROPS_SKIP.has(p)) out.add(p); } catch (_) { /* none */ }
    return [...out];
  }
  function total(a) {
    const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : {};
    const d = typeof t.duration === 'number' ? t.duration : 0;
    const act = Number.isFinite(t.activeDuration) ? t.activeDuration : d;
    return (t.delay || 0) + act;
  }
  // Per step: the animations that ran before the pre (not part of the strip), and the ids of the strip's ones.
  let before = new WeakSet();
  let tagged = [];
  let paused = [];
  // The elements shown before the pre (rendered, not hidden by display, visibility or opacity 0, with a box that
  // meets the viewport). P-54 ("nothing enters from the periphery: toasts, menus and sheets start <= 16 px from
  // their rest position") judges what ENTERS: an animated target that was not shown before the interaction (a
  // new node, a popup that was hidden, a panel waiting off-screen). A target that was shown and travels to a new
  // place (a segmented control's selection pill) is a move, which P-53 limits on surfaces wider than 600 px
  // (REQ C2a-R2->P10 (4), session 5: the tool flagged Home's pill's designed 156 px travel as P-54).
  let shownBefore = null;
  function shownNow(w) {
    const set = new WeakSet();
    const vw = w.innerWidth, vh = w.innerHeight;
    const opts = { checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true };
    for (const el of w.document.querySelectorAll('body *')) {
      try {
        if (typeof el.checkVisibility === 'function' && !el.checkVisibility(opts)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue;
        set.add(el);
      } catch (_) { /* detached */ }
    }
    return set;
  }
  function mark(alias) {
    const w = L.surface(alias);
    before = new WeakSet(w.document.getAnimations());
    tagged = []; paused = [];
    try { shownBefore = shownNow(w); } catch (_) { shownBefore = null; }
    return true;
  }
  const fresh = (w) => w.document.getAnimations().filter((a) => !before.has(a));
  function hold(a) {
    if (a.playState !== 'paused') { a.pause(); if (!paused.includes(a)) paused.push(a); }
  }
  function freeze(alias) {
    const w = L.surface(alias);
    let n = 0;
    for (const a of fresh(w)) { try { hold(a); n++; } catch (_) { /* finished meanwhile */ } }
    return n;
  }
  // Two animation frames of the surface's window (rendering has run with the seeked state), 500 ms at most.
  function frames(w, n) {
    return new Promise((res) => {
      let k = 0, done = false;
      const to = setTimeout(() => { done = true; res(false); }, 500);
      const tick = () => { if (done) return; if (++k >= n) { done = true; clearTimeout(to); res(true); } else w.requestAnimationFrame(tick); };
      w.requestAnimationFrame(tick);
    });
  }
  function list(alias) {
    const w = L.surface(alias);
    const all = w.document.getAnimations();
    const base = L.gates.animsNow(alias);           // same document order as getAnimations()
    const out = [];
    tagged = [];
    all.forEach((a, i) => {
      if (before.has(a)) return;
      const b = base[i] || {};
      const tg = a.effect && a.effect.target;
      const r = tg && tg.getBoundingClientRect ? tg.getBoundingClientRect() : null;
      tagged.push(a);
      out.push(Object.assign(b, {
        id: tagged.length - 1, props: props(a), total: Math.round(total(a)),
        targetRect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
        text: !!(tg && (tg.innerText || '').trim()),
        // P-54 judges entries only (see shownBefore); null = unknown (judged as an entry)
        entering: shownBefore && tg ? !shownBefore.has(tg) : null,
      }));
    });
    return out;
  }
  async function seek(alias, f) {
    const w = L.surface(alias);
    const anims = fresh(w);
    let n = 0;
    for (const a of anims) {
      try { hold(a); a.currentTime = f * total(a); n++; } catch (_) { /* finished or removed */ }
    }
    const raf = await frames(w, 2);
    // rects of every animated target at this f (geometry checks on the PC: P-53, P-54, text scaling)
    const rects = {};
    anims.forEach((a, i) => {
      const tg = a.effect && a.effect.target;
      if (!tg || !tg.getBoundingClientRect) return;
      const k = tagged.indexOf(a);
      const r = tg.getBoundingClientRect();
      rects[k >= 0 ? k : 'n' + i] = [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10];
    });
    const times = anims.slice(0, 40).map((a) => Math.round(Number(a.currentTime) || 0));
    return { seeked: n, count: anims.length, rects, raf, times };
  }
  function release() {
    let n = 0;
    for (const a of paused) { try { if (a.playState === 'paused') { a.play(); n++; } } catch (_) { /* removed */ } }
    paused = []; tagged = []; before = new WeakSet(); shownBefore = null;
    return n;
  }
  function moAudit(alias) {
    const m = window.__LGS_MOTION;
    if (!m || typeof m.audit !== 'function') return null;
    try { return m.audit(L.surface(alias).document); } catch (e) { return { error: e.message }; }
  }

  // Self-test probe (review R1 M1): two boxes on the surface, a WAAPI opacity 0 -> 1 and a CSS opacity
  // transition 0 -> 1, both linear, white over an opaque black underlay, so the box luma is 255 x f.
  function probe(alias, ms) {
    const w = L.surface(alias), d = w.document;
    probeRemove(alias);
    const mk = (id, x) => {
      const u = d.createElement('div');
      u.id = 'lgs-p10-motion-probe-' + id;
      u.style.cssText = `position:fixed;left:${x}px;top:220px;width:200px;height:140px;background:#000;z-index:2147483646;pointer-events:none;contain:strict`;
      const b = d.createElement('div');
      b.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0';
      u.appendChild(b);
      d.body.appendChild(u);
      return b;
    };
    const a = mk('a', 340), c = mk('b', 640);
    a.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'linear', fill: 'forwards' });
    void w.getComputedStyle(c).opacity;
    c.style.transition = `opacity ${ms}ms linear`;
    c.style.opacity = '1';
    void w.getComputedStyle(c).opacity;              // starts the transition now
    const R = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
    return { a: R(a), b: R(c), dpr: w.devicePixelRatio, ms };
  }
  function probeRemove(alias) {
    const d = L.surface(alias).document;
    let n = 0;
    for (const id of ['a', 'b']) { const e = d.getElementById('lgs-p10-motion-probe-' + id); if (e) { e.remove(); n++; } }
    return n;
  }
  L.motion = { v: 3, mark, freeze, list, seek, release, moAudit, props, probe, probeRemove, shownNow };
})();
