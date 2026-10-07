// Liquid Glass lensing for a few floating capsules (ported from the design
// bible's LiquidGlass engine, bible/app.js).
//
// Each lensed element gets its own SVG filter whose displacement map is built
// for its exact size and corner radius: a squircle bezel that bends the
// backdrop inward at the rim and leaves the centre clear, with slight RGB
// dispersion. Chrome applies it through backdrop-filter: url(#id), so it only
// refracts what is behind the element *inside the page* (header capsules over
// library art, tab pills over the hero), never the room.
//
// lgsLens(spec) returns { track(doc, el, opts), sweep(), stop() }.
function lgsLens() {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const tracked = new Map();          // el -> { doc, filter, img, ro, opts, size }
  let seq = 0;

  // Squircle bezel h(t) = (1 - (1 - t)^4)^(1/4), t = 0 at the rim. The lateral
  // shift per unit depth follows Snell's law on its slope (IOR 1.5), the same
  // curve the bible's engine uses; normalised so the rim bends hardest.
  const CURVE = (() => {
    const n = 128, out = new Float32Array(n), e = 1e-3, IOR = 1.5;
    const f = (t) => Math.pow(1 - Math.pow(1 - t, 4), 0.25);
    let max = 0;
    for (let i = 0; i < n; i++) {
      const t = Math.min(1 - e, Math.max(e, i / (n - 1)));
      const slope = (f(Math.min(1, t + e)) - f(Math.max(0, t - e))) / (2 * e);
      const th1 = Math.atan(slope * 0.5);
      const th2 = Math.asin(Math.sin(th1) / IOR);
      out[i] = Math.tan(th1 - th2);
      max = Math.max(max, Math.abs(out[i]));
    }
    if (max > 0) for (let i = 0; i < n; i++) out[i] /= max;
    return out;
  })();

  function buildMap(doc, W, H, R, B) {
    const cv = doc.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H), d = img.data;
    const hx = W / 2, hy = H / 2;
    R = Math.max(0, Math.min(R, hx, hy));
    const bx = hx - R, by = hy - R, n = CURVE.length - 1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x + 0.5 - hx, py = y + 0.5 - hy;
        const qx = Math.abs(px) - bx, qy = Math.abs(py) - by;
        let dist, nx, ny;
        if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); dist = R - l; nx = qx / l; ny = qy / l; }
        else if (qx > qy) { dist = R - qx; nx = 1; ny = 0; }
        else { dist = R - qy; nx = 0; ny = 1; }
        nx *= px < 0 ? -1 : 1; ny *= py < 0 ? -1 : 1;
        let r = 128, g = 128;
        if (dist > 0 && dist < B) {
          const f = (dist / B) * n, i0 = Math.floor(f), i1 = Math.min(n, i0 + 1);
          const m = CURVE[i0] + (CURVE[i1] - CURVE[i0]) * (f - i0);
          r = 128 - nx * m * 127;   // sample inward: convex lens
          g = 128 - ny * m * 127;
        }
        const k = (y * W + x) * 4;
        d[k] = r; d[k + 1] = g; d[k + 2] = 128; d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  }

  function el(doc, tag, attrs) {
    const e = doc.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function defsOf(doc) {
    let svg = doc.getElementById('lgs-lens-defs');
    if (!svg) {
      svg = el(doc, 'svg', { id: 'lgs-lens-defs', width: '0', height: '0', 'aria-hidden': 'true' });
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
      svg.appendChild(el(doc, 'defs', {}));
      doc.body.appendChild(svg);
    }
    return svg.firstChild;
  }

  function styleOf(doc) {
    let st = doc.getElementById('lgs-lens-style');
    if (!st) {
      st = doc.createElement('style');
      st.id = 'lgs-lens-style';
      doc.head.appendChild(st);
    }
    return st;
  }

  function rules(doc) {
    const lines = [];
    for (const [e, t] of tracked) {
      if (t.doc !== doc) continue;
      const o = t.opts;
      lines.push(`[data-lgs-lens="${t.id}"]{backdrop-filter:url(#${t.id}) saturate(${o.saturation}) !important;}`);
    }
    styleOf(doc).textContent = lines.join('\n');
  }

  function rebuild(e, t, force) {
    const W = Math.round(e.offsetWidth), H = Math.round(e.offsetHeight);
    if (!W || !H) return;
    if (!force && W === t.size[0] && H === t.size[1]) return;
    t.size = [W, H];
    const cs = e.ownerDocument.defaultView.getComputedStyle(e);
    const R = parseFloat(cs.borderTopLeftRadius) || 0;
    const B = Math.min(t.opts.bezel, W / 2, H / 2);
    t.filter.setAttribute('width', W);
    t.filter.setAttribute('height', H);
    t.img.setAttribute('width', W);
    t.img.setAttribute('height', H);
    t.img.setAttribute('href', buildMap(e.ownerDocument, W, H, R, B));
  }

  function track(doc, e, opts) {
    if (tracked.has(e)) return;
    opts = Object.assign({ bezel: 18, refraction: 36, frost: 0.9, saturation: 1.7, dispersion: 0.12 }, opts || {});
    const id = 'lgs-lens-' + (++seq);
    const f = el(doc, 'filter', { id, x: '0', y: '0', filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
    f.appendChild(el(doc, 'feGaussianBlur', { in: 'SourceGraphic', stdDeviation: String(opts.frost), edgeMode: 'duplicate', result: 'b' }));
    const img = el(doc, 'feImage', { x: '0', y: '0', preserveAspectRatio: 'none', result: 'm' });
    f.appendChild(img);
    ['R', 'G', 'B'].forEach((ch, i) => {
      const s = opts.refraction * (1 + (1 - i) * opts.dispersion);
      f.appendChild(el(doc, 'feDisplacementMap', { in: 'b', in2: 'm', scale: s.toFixed(2), xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + ch }));
      const row = [0, 0, 0]; row[i] = 1;
      f.appendChild(el(doc, 'feColorMatrix', { in: 'd' + ch, type: 'matrix', result: 'c' + ch,
        values: `${row[0]} 0 0 0 0  0 ${row[1]} 0 0 0  0 0 ${row[2]} 0 0  0 0 0 1 0` }));
    });
    f.appendChild(el(doc, 'feComposite', { in: 'cR', in2: 'cG', operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0', result: 'rg' }));
    f.appendChild(el(doc, 'feComposite', { in: 'rg', in2: 'cB', operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0' }));
    defsOf(doc).appendChild(f);
    const t = { doc, id, filter: f, img, opts, size: [0, 0], ro: null };
    tracked.set(e, t);
    e.setAttribute('data-lgs-lens', id);
    const RO = doc.defaultView.ResizeObserver;
    t.ro = new RO(() => rebuild(e, t));
    t.ro.observe(e);
    rebuild(e, t, true);
    rules(doc);
  }

  function untrack(e) {
    const t = tracked.get(e);
    if (!t) return;
    tracked.delete(e);
    try { t.ro.disconnect(); } catch (_) { /* gone */ }
    t.filter.remove();
    if (e.getAttribute('data-lgs-lens') === t.id) e.removeAttribute('data-lgs-lens');
    try { rules(t.doc); } catch (_) { /* window closed */ }
  }

  // Forget elements React removed.
  function sweep() {
    for (const e of [...tracked.keys()]) if (!e.isConnected) untrack(e);
  }

  function stop() {
    for (const e of [...tracked.keys()]) untrack(e);
    const docs = new Set();
    for (const t of tracked.values()) docs.add(t.doc);
    return docs.size;
  }

  function strip(doc) {
    for (const id of ['lgs-lens-defs', 'lgs-lens-style']) {
      const n = doc.getElementById(id);
      if (n) n.remove();
    }
  }

  return { track, untrack, sweep, stop, strip, count: () => tracked.size };
}
