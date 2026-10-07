// Gate sweeps for `glass.py gates` (P10, docs/phase2/contracts/lab.md section 4):
// G-SIZE, G-TYPE, G-OUTLINE (DOM part) and G-MOTION. Evaluated after
// lab_helpers.js and lab_p2.js; extends window.__LGS_LAB with L.gates.
(function () {
  const L = window.__LGS_LAB;
  if (!L || (L.gates && L.gates.v === 7)) return;

  // D2 2.5: the multiplier m of each surface (sizes in main-window px x m).
  const M = [[/^main$/, 1], [/^frame\.menu|^tooltip|^notifications|^floatingfooter/, 0.9], [/^bar|^barpopup/, 0.83],
    [/^keyboard/, 0.74], [/^volumelevel/, 0.52], [/^vr:controllerbindingui/, 1.87], [/^vr:/, 1.33]];
  const mOf = (alias) => { for (const [rx, m] of M) if (rx.test(alias)) return m; return 1; };

  // D2 11.2 token durations (ms); 150..200 is the Reduce Motion fade.
  // + D2 11.5 matrix values: release glow off 90 ms (linear), window glass dissolve 300 ms.
  const TOKENS = [210, 294, 441, 488, 510, 607, 735, 514, 662, 250, 350, 90, 300];
  // P5's motion library is the authority when loaded (REQ P5->P10): its allowed sets include the
  // composite per-keyframe curves and the Reduce Motion durations, and handle Chromium's serialisation.
  const MO = () => { const m = window.__LGS_MOTION; return m && typeof m.isTokenDuration === 'function' ? m : null; };
  const isTokenMsLocal = (ms) => ms === 0 || TOKENS.some((t) => Math.abs(t - ms) <= 1) || (ms >= 150 && ms <= 200);
  const isTokenMs = (ms) => { const m = MO(); if (m) { try { return ms === 0 || !!m.isTokenDuration(ms); } catch (_) { /* fall back */ } } return isTokenMsLocal(ms); };
  // Easing tokens: the linear() strings (any, compared by their first stops), linear, and the cubic fallbacks.
  const CUBIC = ['0.327, 0.692, 0.114, 1', '0.311, 0.589, 0.077, 1.118', '0.33, 0.632, 0.076, 1.138', '0.344, 0.63, 0.084, 1.171'];
  const isTokenEase = (e) => {
    if (!e) return true;
    const mo = MO();
    if (mo && typeof mo.isTokenEasing === 'function') { try { if (mo.isTokenEasing(String(e))) return true; } catch (_) { /* fall back */ } }
    e = String(e).replace(/\s+/g, ' ').trim();
    if (e === 'linear' || e.startsWith('linear(')) return true;
    const m = e.match(/^cubic-bezier\(([^)]+)\)$/);
    if (m) {
      const v = m[1].split(',').map((x) => parseFloat(x));
      return CUBIC.some((c) => c.split(',').map(parseFloat).every((x, i) => Math.abs(x - v[i]) < 0.002));
    }
    return false;
  };

  const INTERACTIVE = '.Focusable, .ButtonControl, [role=button], [role=tab], [role=link], [role=switch], [role=checkbox], [role=slider], button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])';
  const FIELD = 'input, textarea, select, [role=textbox]';

  // ------------------------------------------------------------ exemptions (PLAN 1.16)
  let exTable = null;
  function exemptions(table) {
    if (table) exTable = table;
    return exTable || {};
  }
  // An exemption may be limited to some sweeps (lab/exemptions.json "_scope": {"E-GRID": {"sweeps": ["aud"],
  // "aud": ["SHRUNK"]}}): elsewhere the element is judged as usual. sweep: 'size' | 'type' | 'outline' | 'aud';
  // none = any exemption (the Phase 1 behaviour).
  const scopeOf = (id) => { const s = (exemptions()._scope || {})[id]; return s && typeof s === 'object' ? s : null; };
  const inScope = (id, sweep) => { const s = scopeOf(id); return !sweep || !s || !Array.isArray(s.sweeps) || s.sweeps.includes(sweep); };
  // -> {id, host}: the exemption and the element that carries it (the tagged ancestor or the selector's match).
  function exemptMatch(alias, el, sweep) {
    const host = el.closest('[data-lgs-exempt]');
    if (host && inScope(host.getAttribute('data-lgs-exempt'), sweep)) return { id: host.getAttribute('data-lgs-exempt'), host };
    const t = exemptions();
    for (const id of Object.keys(t)) {
      if (!Array.isArray(t[id]) || !inScope(id, sweep)) continue;
      for (const s of t[id]) {
        let sel;
        try { sel = L.sel(s); } catch (_) { continue; }
        try { const h = el.closest(sel); if (h) return { id, host: h }; } catch (_) { /* bad selector */ }
      }
    }
    return null;
  }
  function exemptId(alias, el, sweep) {
    const m = exemptMatch(alias, el, sweep);
    return m ? m.id : null;
  }

  const rectOf = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  const label = (el) => (L.readable(el).slice(0, 3).join(' ') || el.tagName.toLowerCase()) +
    ((el.innerText || el.getAttribute('aria-label') || '').trim() ? ' "' + (el.innerText || el.getAttribute('aria-label')).trim().replace(/\s+/g, ' ').slice(0, 30) + '"' : '');

  // Part of its host's target (REQ C3a->P10): Steam renders some Panels with the Focusable class but
  // `focusable: false` (the battery, volume, Wi-Fi and bell glyphs inside the Quick Access pill). With no activation
  // handler of their own (onClick, onActivate, pointer/mouse/touch down/up, the gamepad buttons), a laser click on
  // one bubbles to the control around it and the gamepad never focuses it: it is part of that control's target, which
  // SIZE judges whole. Native controls (button, input, a[href], ...) and anything with its own handler stay targets.
  const ACT = /^on(Click|Activate|MouseDown|MouseUp|PointerDown|PointerUp|TouchStart|TouchEnd|OKButton|SecondaryButton|SecondaryActionDescription|OptionsButton|GamepadDirection)$/;
  const fiberOf = (el) => { const k = Object.keys(el).find((x) => x.startsWith('__reactFiber')); return k ? el[k] : null; };
  function partOfHost(el) {
    if (el.matches('button, input, textarea, select, a[href]')) return false;
    if (!el.parentElement || !el.parentElement.closest(INTERACTIVE)) return false;     // not inside another control
    for (let f = fiberOf(el), i = 0; f && i < 8; f = f.return, i++) {
      const p = f.memoizedProps;
      if (!p || typeof p !== 'object') continue;
      for (const k of Object.keys(p)) if (ACT.test(k) && typeof p[k] === 'function') return false;
      if (Object.prototype.hasOwnProperty.call(p, 'focusable')) return p.focusable === false;   // the Panel that says
    }
    return false;
  }

  // Does el carry an activation handler of its own (its React props up to the Panel that declares `focusable`)?
  // A focusable Panel without one is a focus container, not a hit target (REQ C7->P10, AUD panes).
  function ownHandler(el) {
    for (let f = fiberOf(el), i = 0; f && i < 8; f = f.return, i++) {
      const p = f.memoizedProps;
      if (!p || typeof p !== 'object') continue;
      for (const k of Object.keys(p)) if (ACT.test(k) && typeof p[k] === 'function') return true;
      if (i > 0 && Object.prototype.hasOwnProperty.call(p, 'focusable')) break;
    }
    return el.matches('button, input, textarea, select, a[href]') || typeof el.onclick === 'function';
  }

  function controls(alias) {
    const w = L.surface(alias);
    const out = [];
    for (const el of w.document.querySelectorAll(INTERACTIVE)) {
      if (el.closest('[id^="lgs-"]')) continue;
      if (!L.visible(w, el)) continue;
      out.push(el);
    }
    return out;
  }

  // ------------------------------------------------------------ visibility helpers (clip, modal, obscured)
  // The part of an element that can be seen: its rect cut by every ancestor that clips (overflow other than
  // visible, clip-path) and by the window. REQ C2a->P10 #7: content under the glass bottom is clipped away.
  // A computed length of clip-path inset(): "12px", "5%", "calc(100% - 656px)" (ref = the box side in px).
  function lenOf(v, ref) {
    v = String(v || '0').trim();
    if (!/^calc\(/.test(v)) return /%$/.test(v) ? parseFloat(v) / 100 * ref : (parseFloat(v) || 0);
    let sum = 0;
    const body = v.replace(/^calc\(/, '').replace(/\)$/, '');
    for (const m of body.matchAll(/([+-])?\s*(-?\d*\.?\d+(?:e-?\d+)?)(px|%)/g)) {
      const x = parseFloat(m[2]) * (m[1] === '-' ? -1 : 1);
      sum += m[3] === '%' ? x / 100 * ref : x;
    }
    return sum;
  }
  // The box a clip-path inset() leaves of an element (other shapes: the element's box).
  function clipBox(c, q) {
    const m = /^inset\((.*)\)$/.exec((c.clipPath || '').trim());
    if (!m) return { l: q.left, t: q.top, r: q.right, b: q.bottom };
    const parts = m[1].split(/\s+round\s+/)[0].match(/calc\([^()]*\)|[^\s]+/g) || ['0'];
    const [t, rr, b, l] = parts.length === 1 ? [parts[0], parts[0], parts[0], parts[0]] : parts.length === 2 ? [parts[0], parts[1], parts[0], parts[1]]
      : parts.length === 3 ? [parts[0], parts[1], parts[2], parts[1]] : parts;
    return { l: q.left + lenOf(l, q.width), t: q.top + lenOf(t, q.height), r: q.right - lenOf(rr, q.width), b: q.bottom - lenOf(b, q.height) };
  }
  function visibleRect(w, el) {
    const r = el.getBoundingClientRect();
    let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    for (let n = el.parentElement; n && n.nodeType === 1 && n !== w.document.documentElement; n = n.parentElement) {
      const c = w.getComputedStyle(n);
      const clip = c.clipPath && c.clipPath !== 'none';
      if (c.overflowX !== 'visible' || c.overflowY !== 'visible' || clip) {
        const q = n.getBoundingClientRect();
        // clip-path inset() (C1a's window glass cuts the page at the glass height, REQ C2a->P10 #7/#9)
        const k = clip ? clipBox(c, q) : { l: q.left, t: q.top, r: q.right, b: q.bottom };
        if (c.overflowX !== 'visible' || clip) { x0 = Math.max(x0, c.overflowX !== 'visible' ? Math.max(q.left, k.l) : k.l); x1 = Math.min(x1, c.overflowX !== 'visible' ? Math.min(q.right, k.r) : k.r); }
        if (c.overflowY !== 'visible' || clip) { y0 = Math.max(y0, c.overflowY !== 'visible' ? Math.max(q.top, k.t) : k.t); y1 = Math.min(y1, c.overflowY !== 'visible' ? Math.min(q.bottom, k.b) : k.b); }
      }
    }
    // the window glass height that C1a publishes on window routes (clip-path on the page), if any
    const gh = parseFloat(w.getComputedStyle(w.document.documentElement).getPropertyValue('--lgs-c1a-gh'));
    if (gh > 0) y1 = Math.min(y1, gh);
    x0 = Math.max(x0, 0); y0 = Math.max(y0, 0); x1 = Math.min(x1, w.innerWidth); y1 = Math.min(y1, w.innerHeight);
    return { x0, y0, x1, y1, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  }
  // The topmost open modal's content (REQ C1c->P10 a): while one is shown, controls outside it cannot be reached.
  function topModal(w) {
    const d = w.document;
    let list = [];
    try { list = [...d.querySelectorAll(L.sel('%{*ModalOverlayContent}'))]; } catch (_) { list = [...d.querySelectorAll('.ModalOverlayContent')]; }
    list = list.filter((e) => /\bactive\b/.test(e.className) || L.readable(e).some((c) => /Active|active/.test(c))).filter((e) => L.visible(w, e));
    return list.length ? list[list.length - 1] : null;
  }
  // A scroller between the element and the document (the user scrolls the element into view first).
  function scrollerOf(w, el) {
    for (let n = el.parentElement; n && n.nodeType === 1; n = n.parentElement) {
      const c = w.getComputedStyle(n);
      if (/(auto|scroll)/.test(c.overflowY + c.overflowX) && (n.scrollHeight > n.clientHeight + 2 || n.scrollWidth > n.clientWidth + 2)) return n;
    }
    return null;
  }

  // Can n scroll along the axis ('x' | 'y')?
  function canScroll(w, n, axis) {
    const c = w.getComputedStyle(n);
    return axis === 'y' ? /(auto|scroll)/.test(c.overflowY) && n.scrollHeight > n.clientHeight + 2
      : /(auto|scroll)/.test(c.overflowX) && n.scrollWidth > n.clientWidth + 2;
  }
  // The outermost scroller around el (null: el does not scroll).
  function topScroller(w, el) {
    let top = null;
    for (let n = el.parentElement; n && n.nodeType === 1 && n !== w.document.documentElement; n = n.parentElement) {
      if (canScroll(w, n, 'x') || canScroll(w, n, 'y')) top = n;
    }
    return top;
  }
  // Under chrome or a fixed clip (REQ C4a->P10 (2) and its refinement; review of the obscured rule, session 4).
  // Scrolling moves el relative to: the window, C1a's glass cut, the clips of `top` (the outermost scroller) and its
  // ancestors (clip-path always, overflow on the axes they do not scroll), and chrome (a hit outside `top` that is
  // not its ancestor: the bottom ornament, a header). Samples every 4 px down (at most 40 columns across) over the
  // bw x bh box at (cx, cy):
  // `frac` = the share under those; `clearable` = the scrollers around el have the room to move the whole box out
  // (vertically or horizontally), so the user (or C1a's scroll guard) brings it clear before using it. A control
  // that cannot be scrolled clear is judged where it is: hiding it would hide a real defect.
  function obscuredInfo(w, el, top, cx, cy, bw, bh) {
    const d = w.document;
    let x0 = 0, y0 = 0, x1 = w.innerWidth, y1 = w.innerHeight;
    for (let n = top; n && n.nodeType === 1 && n !== d.documentElement; n = n.parentElement) {
      const c = w.getComputedStyle(n);
      const clip = c.clipPath && c.clipPath !== 'none';
      const ox = c.overflowX !== 'visible' && !canScroll(w, n, 'x'), oy = c.overflowY !== 'visible' && !canScroll(w, n, 'y');
      if (!clip && !ox && !oy) continue;
      const q = n.getBoundingClientRect();
      if (clip) { const k = clipBox(c, q); x0 = Math.max(x0, k.l); x1 = Math.min(x1, k.r); y0 = Math.max(y0, k.t); y1 = Math.min(y1, k.b); }
      if (ox) { x0 = Math.max(x0, q.left); x1 = Math.min(x1, q.right); }
      if (oy) { y0 = Math.max(y0, q.top); y1 = Math.min(y1, q.bottom); }
    }
    const gh = parseFloat(w.getComputedStyle(d.documentElement).getPropertyValue('--lgs-c1a-gh'));
    if (gh > 0) y1 = Math.min(y1, gh);
    const under = (x, y) => {
      if (x < x0 || x >= x1 || y < y0 || y >= y1) return 'clip';
      const h = d.elementFromPoint(x, y);
      return h && !top.contains(h) && !h.contains(top) ? 'chrome' : null;
    };
    let n = 0, ob = 0, chrome = 0, rows = 0, cols = 0;
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    let topRow = false, bottomRow = false, leftCol = false, rightCol = false;
    const ys = [], xs = [];
    for (let y = cy - bh / 2 + 2; y < cy + bh / 2; y += 4) ys.push(y);
    const sx = Math.max(4, bw / 40);            // <= 40 columns: a wide row costs no more than a narrow control
    for (let x = cx - bw / 2 + 2; x < cx + bw / 2; x += sx) xs.push(x);
    rows = ys.length; cols = xs.length;
    ys.forEach((y, iy) => xs.forEach((x, ix) => {
      n++;
      const u = under(x, y);
      if (!u) return;
      ob++;
      if (u === 'chrome') chrome++;
      minY = Math.min(minY, y); maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      if (iy === 0) topRow = true;
      if (iy === rows - 1) bottomRow = true;
      if (ix === 0) leftCol = true;
      if (ix === cols - 1) rightCol = true;
    }));
    const centre = !!under(cx, cy);
    // the room the scrollers around el have, per direction
    let down = 0, up = 0, right = 0, left = 0;
    for (let s = el.parentElement; s && s.nodeType === 1 && s !== d.documentElement; s = s.parentElement) {
      if (canScroll(w, s, 'y')) { down += s.scrollHeight - s.clientHeight - s.scrollTop; up += s.scrollTop; }
      if (canScroll(w, s, 'x')) { right += s.scrollWidth - s.clientWidth - Math.abs(s.scrollLeft); left += Math.abs(s.scrollLeft); }
    }
    // The shift that moves the box off every obscured sample (one 4 px grid step of margin). What is obscured at
    // the box's edge goes on beyond it (a band: the ornament, the window edge, a header), so the box can only move
    // away from that edge: content up (scroll down) off a band at its bottom, content down off one at its top; an
    // obscured patch inside the box may be cleared either way. Obscured at both edges of an axis: not that axis.
    const bTop = cy - bh / 2, bBot = cy + bh / 2, bLeft = cx - bw / 2, bRight = cx + bw / 2;
    const nD = ob ? bBot - (minY - 4) : 0, nU = ob ? (maxY + 4) - bTop : 0;
    const nR = ob ? bRight - (minX - sx) : 0, nL = ob ? (maxX + sx) - bLeft : 0;
    const vOk = !(topRow && bottomRow) && ((!topRow && nD <= down + 1) || (!bottomRow && nU <= up + 1));
    const hOk = !(leftCol && rightCol) && ((!leftCol && nR <= right + 1) || (!rightCol && nL <= left + 1));
    const r1 = (v) => Math.round(v);
    return { frac: n ? ob / n : 0, chromeFrac: n ? chrome / n : 0, centre, clearable: ob === 0 || vOk || hOk,
      edges: { top: topRow, bottom: bottomRow, left: leftCol, right: rightCol },
      need: { down: topRow ? 0 : r1(nD), up: bottomRow ? 0 : r1(nU), right: leftCol ? 0 : r1(nR), left: rightCol ? 0 : r1(nL) },
      room: { down: r1(down), up: r1(up), right: r1(right), left: r1(left) } };
  }

  // Hit statistics over a box bw x bh centred on (cx, cy): own = the element or inside it; other = another control.
  function hitStats(w, el, cx, cy, bw, bh, isCtl, allow) {
    const d = w.document;
    let n = 0, own = 0, other = 0, otherName = null;
    for (let y = cy - bh / 2 + 2; y < cy + bh / 2; y += 4) {
      for (let x = cx - bw / 2 + 2; x < cx + bw / 2; x += 4) {
        if (x < 0 || y < 0 || x >= w.innerWidth || y >= w.innerHeight) continue;
        n++;
        const hit = d.elementFromPoint(x, y);
        if (!hit) continue;
        if (el.contains(hit) || hit.contains(el)) { own++; continue; }
        const hc = isCtl(hit);
        if (hc && hc !== el && !hc.contains(el) && !(allow && allow(hc))) { other++; if (!otherName) otherName = label(hc); }
      }
    }
    return { n, own: n ? own / n : 1, other: n ? other / n : 0, otherName };
  }

  // The drawn fill of an element: its box less a clear border (transparent, with background-clip padding-box or
  // content-box; content-box also drops the padding). A visible border is part of the shape.
  function fillRect(w, el) {
    const r = el.getBoundingClientRect(), c = w.getComputedStyle(el);
    const clip = c.backgroundClip || 'border-box';
    const ins = (side) => {
      const bw = parseFloat(c['border' + side + 'Width']) || 0;
      const clear = c['border' + side + 'Style'] === 'none' || alphaOf(c['border' + side + 'Color']) <= 0.05;
      return (clip !== 'border-box' && clear ? bw : 0) + (clip === 'content-box' ? parseFloat(c['padding' + side]) || 0 : 0);
    };
    const t = ins('Top'), rr = ins('Right'), b = ins('Bottom'), l = ins('Left');
    return { left: r.left + l, top: r.top + t, right: r.right - rr, bottom: r.bottom - b, width: Math.max(0, r.width - l - rr), height: Math.max(0, r.height - t - b) };
  }
  // Steam's appended Cancel (PLAN 1.16 E-MENU (Cancel), R2-5): the last item of a top-level menu's first slab
  // (submenus, the container's second slab, have none), as C1c's 22-presentations.css selects it.
  let cancelSel;
  function isMenuCancel(el) {
    if (cancelSel === undefined) {
      try { cancelSel = L.sel('%{*BasicContextMenuHeader>BasicContextMenuModal} %{*BasicContextMenuModal>BasicContextMenuContainer} > %{*BasicContextMenuModal>contextMenuContents}:first-child > %{*BasicContextMenuModal>contextMenuItem}:last-child'); } catch (_) { cancelSel = null; }
    }
    if (cancelSel) { try { return el.matches(cancelSel); } catch (_) { /* fall back */ } }
    const p = el.parentElement;
    return !!p && p.lastElementChild === el && !!p.parentElement && p.parentElement.firstElementChild === p && !!p.parentElement.parentElement;
  }

  // PLAN 1.16: each exemption's own criterion (contracts/lab.md section 6). Returns {pass, why}.
  function exemptCheck(alias, id, el, w, isCtl, m) {
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const sib = el.parentElement ? [...el.parentElement.children].filter((s) => s !== el && L.visible(w, s)) : [];
    const pitchTo = (axis) => {
      const near = sib.map((s) => s.getBoundingClientRect()).filter((q) => axis === 'y' ? q.top > r.top : q.left > r.left)
        .map((q) => axis === 'y' ? q.top - r.top : q.left - r.left);
      return near.length ? Math.min(...near) : null;
    };
    const gapTo = (axis) => {
      const near = sib.map((s) => s.getBoundingClientRect()).filter((q) => axis === 'y' ? q.top >= r.bottom - 1 : q.left >= r.right - 1)
        .map((q) => axis === 'y' ? q.top - r.bottom : q.left - r.right);
      return near.length ? Math.min(...near) : null;
    };
    switch (id) {
      case 'E-MENU': {
        // PLAN 1.16 [R2-5] (REQ Coordinator->P10 (1)). The visible fill is the element less a clear border (C1c's
        // rows inset their fill by a 2 px transparent border with background-clip: padding-box).
        const fill = fillRect(w, el);
        const items = sib.filter((s) => s.className === el.className || L.readable(s).some((c) => /contextMenuItem/.test(c)));
        const cancel = isMenuCancel(el);
        if (cancel) {
          // Steam's appended Cancel, its own line: visible 60 tall (= its element), >= 192 wide, >= 4 px clear of
          // the last row's visible fill, inside the slab, last in DOM order, its centre hits it. Judged instead of
          // P-08 and the row clauses.
          const slab = el.parentElement.getBoundingClientRect();
          const above = items.filter((s) => s !== el && L.visible(w, s)).map((s) => fillRect(w, s))
            .filter((q) => q.bottom <= fill.top + 1 && q.right > fill.left && q.left < fill.right);
          const clear = above.length ? Math.min(...above.map((q) => fill.top - q.bottom)) : null;
          const inside = r.left >= slab.left - 1 && r.right <= slab.right + 1 && r.top >= slab.top - 1 && r.bottom <= slab.bottom + 1;
          const hit = w.document.elementFromPoint(cx, cy);
          const hits = !!hit && (el.contains(hit) || hit.contains(el));
          const ok = fill.height + 0.5 >= 60 && Math.abs(fill.height - r.height) < 0.5 && fill.width + 0.5 >= 192 && (clear === null || clear >= 3.5) && inside && hits;
          return { pass: ok, why: `Cancel: fill ${Math.round(fill.width)} x ${Math.round(fill.height)} on a ${Math.round(r.width)} x ${Math.round(r.height)} element, ${clear === null ? 'no row above' : Math.round(clear) + ' px clear of the row above'}, ${inside ? 'inside' : 'outside'} the slab, centre hit ${hits ? 'own' : 'other'} (needs a 60 tall fill = its element, >= 192 wide, >= 4 px clear, inside, own centre)` };
        }
        // Rows: >= 60 visible on a contiguous pitch of >= 64 (compact: rows touch) or 78 (regular); >= 320 wide in
        // one column, >= 280 in the two-column grid (rows at two distinct x in the slab, or C1c's .lgs-menu-grid).
        const xs = new Set(items.filter((s) => L.visible(w, s) && !isMenuCancel(s)).map((s) => Math.round(s.getBoundingClientRect().left / 8)));
        xs.add(Math.round(r.left / 8));
        const grid = xs.size >= 2 || !!(el.parentElement && el.parentElement.closest('.lgs-menu-grid'));
        const below = items.filter((s) => s !== el && L.visible(w, s) && !isMenuCancel(s)).map((s) => s.getBoundingClientRect())
          .filter((q) => q.top > r.top + 1 && Math.abs(q.left - r.left) < 8);
        const p = below.length ? Math.min(...below.map((q) => q.top - r.top)) : null;
        const gap = below.length ? Math.min(...below.map((q) => q.top - r.bottom)) : null;
        const compact = gap !== null && gap <= 2;
        const minW = grid ? 280 : 320, minP = compact ? 64 : 78;
        const ok = fill.height + 0.5 >= 60 && r.width + 0.5 >= minW && (p === null || p + 0.5 >= minP);
        return { pass: ok, why: `${grid ? 'grid' : 'column'} row ${Math.round(r.width)} x ${Math.round(r.height)} (fill ${Math.round(fill.height)} tall), pitch ${p === null ? 'last' : Math.round(p)}${p === null ? '' : compact ? ' compact' : ' regular'} (needs fill >= 60, >= ${minW} wide, pitch >= ${minP})` };
      }
      case 'E-TAB': {
        // PLAN 1.16: pitch >= 52 frame-menu px (m .9), so 52 x m / .9 on any surface (48 bar px), items abutting.
        // Vertical bars (the frame menu) or horizontal rows (Quick Access's five tabs, REQ C3b->P10): the axis is
        // the one along which the next item follows; across it the visible item keeps P-80's 60 x m (50 bar px).
        const pitchMin = 52 * m / 0.9, cross = 60 * m;
        const row = sib.some((s) => { const q = s.getBoundingClientRect(); return Math.abs(q.top - r.top) < 4 && Math.abs(q.left - r.left) > 4; });
        const g = gapTo(row ? 'x' : 'y');
        const vr = visibleRect(w, el);
        const along = row ? r.width : r.height, across = row ? vr.h : vr.w;
        const ok = along + 0.5 >= pitchMin && across + 0.5 >= cross && (g === null || g <= 2);
        return { pass: ok, why: `${row ? 'row' : 'column'} item ${Math.round(r.width)} x ${Math.round(r.height)} (visible ${Math.round(vr.w)} x ${Math.round(vr.h)}), gap ${g === null ? 'last' : Math.round(g)} (needs ${row ? 'width' : 'height'} >= ${+pitchMin.toFixed(1)}, visible ${row ? 'height' : 'width'} >= ${+cross.toFixed(1)}, abutting)` };
      }
      case 'E-GRID': {
        // REQ C2b->P10: launcher grid cells (the "+" popup). AUD's SHRUNK is waived for them (rows 260 x 40 become
        // 72 x 96 cells), never GONE / HIDDEN / UNCLICKABLE / CONTRAST, and only while each cell is >= 80m x 96m
        // (67 x 80 bar px), abuts its row and column neighbours (gap <= 2) and is its own whole hit (>= 95 % own,
        // no other target over the cell). SIZE judges the cells as usual (scope "aud" in exemptions.json).
        const inRow = sib.map((s) => s.getBoundingClientRect()).filter((q) => Math.abs(q.top - r.top) < 4 && q.left >= r.right - 1);
        const inCol = sib.map((s) => s.getBoundingClientRect()).filter((q) => Math.abs(q.left - r.left) < 4 && q.top >= r.bottom - 1);
        const gx = inRow.length ? Math.min(...inRow.map((q) => q.left - r.right)) : null;
        const gy = inCol.length ? Math.min(...inCol.map((q) => q.top - r.bottom)) : null;
        const h = hitStats(w, el, cx, cy, Math.max(4, r.width - 2), Math.max(4, r.height - 2), isCtl);
        const ok = r.width + 0.5 >= 80 * m && r.height + 0.5 >= 96 * m && (gx === null || gx <= 2) && (gy === null || gy <= 2) && h.own >= 0.95 && h.other === 0;
        return { pass: ok, why: `cell ${Math.round(r.width)} x ${Math.round(r.height)}, gaps ${gx === null ? 'last' : Math.round(gx)} / ${gy === null ? 'last' : Math.round(gy)}, hit ${Math.round(h.own * 100)}% own, ${Math.round(h.other * 100)}% other (needs >= ${+(80 * m).toFixed(1)} x ${+(96 * m).toFixed(1)}, abutting, whole cell its own hit)` };
      }
      case 'E-SWITCH': {
        const h = hitStats(w, el, cx, cy, 86, 80, isCtl);
        return { pass: h.own >= 0.95 && h.other === 0, why: `hit ${Math.round(h.own * 100)}% own over 86 x 80` };
      }
      case 'E-CHECK': {
        const h = hitStats(w, el, cx, cy, 80, 80, isCtl);
        return { pass: h.own >= 0.95 && h.other === 0, why: `hit ${Math.round(h.own * 100)}% own over 80 x 80` };
      }
      case 'E-MINI': {
        const field = el.closest('label, [role=search], .lgs-field') || null;
        const h = hitStats(w, el, cx, cy, 80, 80, isCtl, (hc) => !!(field && field.contains(hc)) || hc.matches('input, textarea'));
        return { pass: h.own >= 0.95 && h.other === 0, why: `hit ${Math.round(h.own * 100)}% own over 80 x 80, ${Math.round(h.other * 100)}% another target` };
      }
      case 'E-SEG': {
        const g = gapTo('x');
        const ok = r.height + 0.5 >= 60 && r.width + 0.5 >= 120 && (g === null || g <= 2);
        return { pass: ok, why: `${Math.round(r.width)} x ${Math.round(r.height)}, gap ${g === null ? 'last' : Math.round(g)} (needs >= 60 x 120, contiguous)` };
      }
      case 'E-BAR': {
        const ok = r.width + 0.5 >= 64 && r.height + 0.5 >= 72;
        return { pass: ok, why: `${Math.round(r.width)} x ${Math.round(r.height)} bar px (needs >= 64 x 72)` };
      }
      case 'E-BACK': {
        const hit = w.document.elementFromPoint(cx, cy);
        const ok = !!hit && (el.contains(hit) || hit.contains(el)) && !!(el.getAttribute('aria-label') || '').trim();
        return { pass: ok, why: `aria-label "${(el.getAttribute('aria-label') || '').slice(0, 20)}", centre hit ${ok ? 'own' : 'other'}` };
      }
      default:
        return { pass: null, why: 'no criterion of its own (E-KEY, E-WEB, E-ROW58, E-DRILL: judged elsewhere)' };
    }
  }

  // The criterion of one exemption on the element that carries it, outside the SIZE sweep (AUD's snapshots for a
  // scoped exemption such as E-GRID): {pass, why}. `cache` (a Map) shares one result between a host's records.
  function exemptCriterion(alias, id, host, cache) {
    if (cache && cache.has(host)) return cache.get(host);
    const w = L.surface(alias);
    const isCtl = (n) => { for (let x = n; x && x.nodeType === 1; x = x.parentElement) if (x.matches(INTERACTIVE) && L.visible(w, x)) return x; return null; };
    let c;
    try { c = exemptCheck(alias, id, host, w, isCtl, mOf(alias)); } catch (e) { c = { pass: null, why: e.message }; }
    if (cache) cache.set(host, c);
    return c;
  }

  // ------------------------------------------------------------ G-SIZE (P-08, P-80, P-83; SM G2b)
  function size(alias, opts) {
    opts = opts || {};
    const w = L.surface(alias);
    const m = mOf(alias);
    // focusable: false Panels without a handler of their own are part of their host's target (REQ C3a->P10)
    const all = controls(alias);
    const hosted = all.filter(partOfHost);
    const ctls = all.filter((el) => !hosted.includes(el));
    const set = new Set(ctls);
    // Containers are not targets: an element holding several controls (nav rows, headers, tab
    // strips), a scroller, or anything over half the window. A hit on one is empty page area,
    // and the container itself is not checked (its children are).
    const isContainer = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width * r.height > 0.5 * w.innerWidth * w.innerHeight) return true;
      const inner = [...el.querySelectorAll(INTERACTIVE)].filter((c) => set.has(c));
      if (inner.length >= 2) return true;
      const ecs = w.getComputedStyle(el);
      return /(auto|scroll)/.test(ecs.overflowX + ecs.overflowY) && (el.scrollWidth > el.clientWidth + 4 || el.scrollHeight > el.clientHeight + 4);
    };
    const containers = new Set(ctls.filter(isContainer));
    const isCtl = (n) => { for (let x = n; x && x.nodeType === 1; x = x.parentElement) if (set.has(x) && !containers.has(x)) return x; return null; };
    const modal = topModal(w);
    const fails = [], exempt = [], inPlace = [];
    const skipped = hosted.slice(0, 20).map((el) => ({ el: label(el), why: 'part of its host (focusable: false, no handler of its own)' }));
    let checked = 0, transients;
    for (const el of ctls) {
      const r = el.getBoundingClientRect();
      const name = label(el);
      if (modal && !modal.contains(el)) { if (skipped.length < 40) skipped.push({ el: name, why: 'under modal' }); continue; }
      const vr = visibleRect(w, el);
      if (vr.w < 1 || vr.h < 1) { if (skipped.length < 40) skipped.push({ el: name, why: 'clipped' }); continue; }
      // Obscured (REQ C4a->P10 (2) and its refinement): in a scroller, with its centre clipped or under chrome
      // outside the scroller (the bottom ornament, a header), or >= 25 % of its 80 px hit box there. The user (or
      // C1a's scroll guard) scrolls it clear before using it, so it is skipped, but only when the scrollers around
      // it have the room to bring the whole hit box clear; otherwise it is judged where it is (obscuredInfo).
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      const bw = Math.max(80 * m, r.width), bh = 80 * m;
      const sc = scrollerOf(w, el);
      let stuck = null;
      if (sc) {
        const top = topScroller(w, el) || sc;
        const centreClipped = cy < vr.y0 || cy > vr.y1 || cx < vr.x0 || cx > vr.x1;
        const ob = obscuredInfo(w, el, top, cx, cy, bw, bh);
        if (centreClipped || ob.centre || ob.frac >= 0.25) {
          const pct = Math.round(ob.frac * 100);
          if (ob.clearable) {
            if (skipped.length < 40) skipped.push({ el: name, why: 'obscured: scrolled under chrome', under: pct });
            continue;
          }
          const nd = Object.entries(ob.need).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v} (room ${ob.room[k]})`).join(', ');
          stuck = `${pct}% of its hit box under chrome or the glass cut, and its scrollers cannot bring it clear: needs ${nd || 'both ways'} px`;
        }
      }
      const ex = exemptId(alias, el, 'size');
      if (ex) {
        let c = { pass: null, why: '' };
        try { c = exemptCheck(alias, ex, el, w, isCtl, m); } catch (e) { c = { pass: null, why: e.message }; }
        exempt.push({ el: name, id: ex, rect: rectOf(el), pass: c.pass, why: c.why });
        continue;
      }
      // A wrapper around exactly one same-size control is judged by that control.
      const inner = [...el.querySelectorAll(INTERACTIVE)].filter((c) => set.has(c));
      if (inner.length === 1 && Math.abs(inner[0].getBoundingClientRect().width - r.width) < 2 && Math.abs(inner[0].getBoundingClientRect().height - r.height) < 2) continue;
      if (containers.has(el)) continue;
      // Covered by an open transient expansion (REQ C2a->P10 #12): a visible [data-lgs-transient] (Home's
      // attention card, a popover) that meets the control's sampling box and is not its ancestor or descendant.
      if (transients === undefined) transients = [...w.document.querySelectorAll('[data-lgs-transient]')].filter((t) => L.visible(w, t)).map((t) => ({ t, q: t.getBoundingClientRect() }));
      const bw0 = Math.max(80 * m, r.width) / 2, bh0 = 40 * m;
      if (transients.some(({ t, q }) => !t.contains(el) && !el.contains(t) && q.left < cx + bw0 && q.right > cx - bw0 && q.top < cy + bh0 && q.bottom > cy - bh0)) {
        if (skipped.length < 40) skipped.push({ el: name, why: 'covered (transient)' });
        continue;
      }
      checked++;
      const short = Math.min(r.width, r.height);
      const isField = el.matches(FIELD);
      const minVis = (isField ? 64 : 60) * m;
      if (short + 0.5 < minVis) fails.push({ el: name, rect: rectOf(el), rule: 'P-80', why: `visible short side ${Math.round(short)} < ${Math.round(minVis)}` });
      // Hit sampling over B = max(80m, w) x 80m (bw, bh above). A control that is only partly visible (cut by its
      // scroller, the window glass bottom or the window edge) with a visible part shorter or narrower than the box
      // cannot meet P-08 where it is; the scroll guard brings it into view before it takes focus (REQ C2a->P10
      // #9). P-80 and P-83 are still judged.
      const partly = (vr.h + 1 < r.height || vr.w + 1 < r.width) && (vr.h + 0.5 < bh || vr.w + 0.5 < Math.min(bw, 80 * m));
      if (partly) { if (skipped.length < 40) skipped.push({ el: name, why: 'partly visible: P-08 not sampled' }); }
      // The box is centred on the control's VISIBLE rect (REQ C2a->P10 #13): a control whose visible part holds
      // the box can be hit anywhere in it, and nothing can be pointed at in the part that is cut away. For a fully
      // visible control this is its own centre; the box keeps the full width of a wide control's visible part.
      const vcx = (vr.x0 + vr.x1) / 2, vcy = (vr.y0 + vr.y1) / 2, vbw = Math.max(80 * m, vr.w);
      const h = partly ? { own: 1, other: 0 } : hitStats(w, el, vcx, vcy, vbw, bh, isCtl);
      if (h.own < 0.95 || h.other > 0) {
        fails.push({ el: name, rect: rectOf(el), rule: 'P-08', why: `hit ${Math.round(h.own * 100)}% own, ${Math.round(h.other * 100)}% other${h.otherName ? ' (' + h.otherName + ')' : ''} over ${Math.round(vbw)}x${Math.round(bh)}${stuck ? '; ' + stuck : ''}` });
      } else if (stuck && inPlace.length < 40) inPlace.push({ el: name, why: stuck });
      // P-83 shape: icon-only circles, text capsules. Not judged: vertical stacks, settings rows and other
      // list rows (Field, option, tab rows: rounded rectangles, CTL 10), content cards (art >= 100 tall, VP P-45).
      const cs = w.getComputedStyle(el);
      const rad = parseFloat(cs.borderTopLeftRadius) || 0;
      const text = (el.innerText || '').trim();
      const hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none');
      const art = /url\(/.test(cs.backgroundImage) || !!el.querySelector('img, video, picture');
      const row = el.matches('[role=option], [role=tab], [role=row], [role=listitem]') || L.readable(el).some((c) => /GamepadDialogContent>Field\}|>Field\}$/.test(c));
      if (hasBg && !isField && !row && !(art && r.height >= 100 * m)) {
        const sib = el.parentElement ? [...el.parentElement.children].filter((s) => s !== el && set.has(s)) : [];
        const stack = sib.some((s) => { const q = s.getBoundingClientRect(); return Math.abs(q.x - r.x) < 4 && Math.abs(q.width - r.width) < 4; });
        if (!text && !art && short <= 120 * m && rad < 0.48 * short - 0.5) fails.push({ el: name, rect: rectOf(el), rule: 'P-83', why: `icon-only radius ${rad} < 0.48 x ${Math.round(short)}` });
        else if (text && !stack && rad < 0.45 * r.height - 0.5 && r.height <= 120 * m) fails.push({ el: name, rect: rectOf(el), rule: 'P-83', why: `text control radius ${rad} < 0.45 x height ${Math.round(r.height)}` });
      }
    }
    const exFail = exempt.filter((e) => e.pass === false);
    // inPlace: obscured controls whose scrollers cannot bring them clear, judged where they are (and passing)
    return { pass: fails.length === 0 && exFail.length === 0, m, checked, fails: fails.slice(0, opts.max || 80), failCount: fails.length, exempt, exemptFail: exFail.length, skipped, inPlace, modal: !!modal };
  }

  // ------------------------------------------------------------ G-TYPE (P-38, P-84)
  function type(alias, opts) {
    opts = opts || {};
    const w = L.surface(alias);
    const d = w.document;
    const m = mOf(alias);
    const fails = [], exempt = [];
    let checked = 0, skippedN = 0, modal;
    const seen = new Set();
    const tw = d.createTreeWalker(d.body, w.NodeFilter.SHOW_TEXT);
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      const s = t.textContent.trim();
      if (s.length < 1 || !/[\p{L}\p{N}]/u.test(s)) continue;
      const el = t.parentElement;
      if (!el || seen.has(el) || el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
      seen.add(el);
      if (el.closest('[id^="lgs-"]') || !L.visible(w, el)) continue;
      if (modal === undefined) modal = topModal(w);
      if (modal && !modal.contains(el)) continue;                      // under an open modal
      const vr = visibleRect(w, el);
      if (vr.w < 1 || vr.h < 1) { skippedN++; continue; }              // clipped away (under the glass bottom)
      const ex = exemptId(alias, el, 'type');
      if (ex) { if (exempt.length < 40) exempt.push({ el: label(el), id: ex }); continue; }
      checked++;
      const cs = w.getComputedStyle(el);
      const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10) || 400;
      const why = [];
      if (fs + 0.01 < 18 * m) why.push(`size ${fs} < ${+(18 * m).toFixed(1)}`);
      else if (fs + 0.01 < 22 * m && !el.closest(INTERACTIVE)) {
        // VP P-38 "body >= 22 px" (review R1 m6): running text, i.e. a text block outside any control that wraps
        // to 2+ lines with 40+ characters, or holds 80+ characters. Shorter text is a label or metadata
        // (Subheadline 20, Footnote 18, Caption 18 are allowed there, DESIGN2 8.1).
        const lh = parseFloat(cs.lineHeight) || fs * 1.3;
        const lines = Math.round(el.getBoundingClientRect().height / lh);
        const n = (el.innerText || s).trim().length;
        if ((lines >= 2 && n >= 40) || n >= 80) why.push(`body size ${fs} < ${+(22 * m).toFixed(1)} (${lines} lines, ${n} chars)`);
      }
      if (fw < 500) why.push(`weight ${fw} < 500`);
      if (cs.textTransform === 'uppercase') why.push('uppercase');
      const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / fs;
      if (ls > 0.01) why.push(`tracking ${ls.toFixed(3)} em`);
      if (cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique')) why.push('italic');
      if (why.length) fails.push({ el: label(el), rect: rectOf(el), why: why.join(', ') });
    }
    return { pass: fails.length === 0, m, checked, fails: fails.slice(0, opts.max || 80), failCount: fails.length, exempt, skippedClipped: skippedN };
  }

  // ------------------------------------------------------------ G-OUTLINE, DOM part (P-42, P-43) + edge probes
  const alphaOf = (c) => { const p = /rgba?\(([^)]+)\)/.exec(c || ''); if (!p) return 0; const v = p[1].split(/[ ,/]+/).filter(Boolean); return v.length > 3 ? parseFloat(v[3]) : 1; };
  // One computed box-shadow list -> {rings, lines}. A ring: 0 offsets, 0 blur, spread 0 < s <= 2 (a closed line).
  // A line (review R1 M2): 0 blur, spread <= 0 and one offset of 0 < |o| <= 2 px: a hard 1-2 px line on one
  // side (inset 0 1px 0 = the top inner edge). The sides of all lines together tell whether they close a rim.
  function shadowLines(boxShadow) {
    const rings = [], lines = [], sides = new Set();
    for (const sh of (!boxShadow || boxShadow === 'none' ? [] : boxShadow.split(/,(?![^(]*\))/))) {
      const col = (sh.match(/rgba?\([^)]*\)/) || [''])[0];
      if (col && alphaOf(col) <= 0.05) continue;
      const nums = sh.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/).filter((x) => /px$/.test(x)).map(parseFloat);
      if (nums.length < 2) continue;
      const [x, y, blur = 0, spread = 0] = nums;
      const inset = /inset/.test(sh);
      if (blur > 0.5) continue;
      if (x === 0 && y === 0 && spread > 0 && spread <= 2) { rings.push(`${inset ? 'inset ' : ''}${spread}px ring`); ['top', 'right', 'bottom', 'left'].forEach((s) => sides.add(s)); continue; }
      if (spread > 0) continue;
      const ax = Math.abs(x), ay = Math.abs(y);
      if ((ax > 0 && ax <= 2 + 1e-6) || (ay > 0 && ay <= 2 + 1e-6)) {
        const s = [];
        if (ay > 0 && ay <= 2 + 1e-6) s.push(inset ? (y > 0 ? 'top' : 'bottom') : (y > 0 ? 'bottom' : 'top'));
        if (ax > 0 && ax <= 2 + 1e-6) s.push(inset ? (x > 0 ? 'left' : 'right') : (x > 0 ? 'right' : 'left'));
        s.forEach((v) => sides.add(v));
        lines.push(`${inset ? 'inset ' : ''}${x}px ${y}px line (${s.join('+')}) ${col.replace(/\s+/g, '')}`);
      }
    }
    return { rings, lines, closed: sides.size === 4 };
  }
  // The box of a ::before / ::after: absolute and fixed ones from their insets and size against the host's
  // padding box; in-flow ones are taken as the host's box (approximate: flagged so).
  function pseudoBox(w, el, pcs, r) {
    const px = (v) => (v === 'auto' || v === '' || v == null ? null : parseFloat(v));
    let W = px(pcs.width), H = px(pcs.height);
    if (W !== null && pcs.boxSizing !== 'border-box') W += (parseFloat(pcs.paddingLeft) || 0) + (parseFloat(pcs.paddingRight) || 0) + (parseFloat(pcs.borderLeftWidth) || 0) + (parseFloat(pcs.borderRightWidth) || 0);
    if (H !== null && pcs.boxSizing !== 'border-box') H += (parseFloat(pcs.paddingTop) || 0) + (parseFloat(pcs.paddingBottom) || 0) + (parseFloat(pcs.borderTopWidth) || 0) + (parseFloat(pcs.borderBottomWidth) || 0);
    if (pcs.position === 'absolute' || pcs.position === 'fixed') {
      const hcs = w.getComputedStyle(el);
      const cb = pcs.position === 'fixed' ? { l: 0, t: 0, r: w.innerWidth, b: w.innerHeight } : {
        l: r.left + (parseFloat(hcs.borderLeftWidth) || 0), t: r.top + (parseFloat(hcs.borderTopWidth) || 0),
        r: r.right - (parseFloat(hcs.borderRightWidth) || 0), b: r.bottom - (parseFloat(hcs.borderBottomWidth) || 0) };
      const l = px(pcs.left), t = px(pcs.top), rr = px(pcs.right), b = px(pcs.bottom);
      const x0 = l !== null ? cb.l + l : (rr !== null && W !== null ? cb.r - rr - W : cb.l);
      const x1 = W !== null ? x0 + W : (rr !== null ? cb.r - rr : cb.r);
      const y0 = t !== null ? cb.t + t : (b !== null && H !== null ? cb.b - b - H : cb.t);
      const y1 = H !== null ? y0 + H : (b !== null ? cb.b - b : cb.b);
      return { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0, x: x0, y: y0, approx: pcs.position === 'absolute' && hcs.position === 'static' };
    }
    const w2 = W !== null ? W : r.width, h2 = H !== null ? H : r.height;
    return { left: r.left, top: r.top, right: r.left + w2, bottom: r.top + h2, width: w2, height: h2, x: r.left, y: r.top, approx: true };
  }
  function outline(alias, opts) {
    opts = opts || {};
    const w = L.surface(alias);
    const d = w.document;
    const hc = w.matchMedia('(prefers-contrast: more)').matches;
    const m = mOf(alias);
    const fails = [], probes = [], exempt = [];
    let glass = 0, pseudoGlass = 0, pseudoChecked = 0, modalO;
    const rr = (b) => [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)];
    // Edge probes on every side of a glass shape that can be seen (not clipped away, not under an open modal):
    // top and bottom when it is >= 200m wide, left and right when it is >= 120m tall (review R1 M2).
    const addProbes = (el, name, r, rad) => {
      const vr = visibleRect(w, el);
      if (modalO === undefined) modalO = topModal(w);
      if (modalO && !modalO.contains(el) && !el.contains(modalO)) return;
      const vx0 = Math.max(vr.x0, r.left - 1), vx1 = Math.min(vr.x1, r.right + 1);
      const vy0 = Math.max(vr.y0, r.top - 1), vy1 = Math.min(vr.y1, r.bottom + 1);
      if (r.width >= 200 * m) {
        const ins = Math.max(rad, r.width * 0.06);
        const x0 = Math.round(Math.max(r.left + ins, vx0)), x1 = Math.round(Math.min(r.right - ins, vx1));
        if (r.top >= 0 && r.top < w.innerHeight - 20 && vr.y0 <= r.top + 1 && vr.h >= 12) probes.push({ el: name, side: 'top', y: Math.round(r.top), x0, x1 });
        if (r.bottom > 20 && r.bottom <= w.innerHeight && vr.y1 >= r.bottom - 1 && vr.h >= 12) probes.push({ el: name, side: 'bottom', y: Math.round(r.bottom), x0, x1 });
      }
      if (r.height >= 120 * m) {
        const ins = Math.max(rad, r.height * 0.06);
        const y0 = Math.round(Math.max(r.top + ins, vy0)), y1 = Math.round(Math.min(r.bottom - ins, vy1));
        if (r.left >= 0 && r.left < w.innerWidth - 20 && vr.x0 <= r.left + 1 && vr.w >= 12) probes.push({ el: name, side: 'left', x: Math.round(r.left), y0, y1 });
        if (r.right > 20 && r.right <= w.innerWidth && vr.x1 >= r.right - 1 && vr.w >= 12) probes.push({ el: name, side: 'right', x: Math.round(r.right), y0, y1 });
      }
    };
    // The checks of one box: an element or one of its pseudo-elements (whose own style draws the pane).
    const check = (el, cs, r, name, isPseudo) => {
      const bgA = alphaOf(cs.backgroundColor);
      const bdf = cs.backdropFilter && cs.backdropFilter !== 'none';
      const rad = parseFloat(cs.borderTopLeftRadius) || 0;
      // Content (art, posters, media) is never glass (P-45): skip elements painted with an image
      // or covered by an <img>/<video>.
      const content = /url\(/.test(cs.backgroundImage) || (!isPseudo && [...el.querySelectorAll(':scope > img, :scope > video, :scope > picture, :scope > div > img')].some((mm) => { const q = mm.getBoundingClientRect(); return q.width * q.height >= 0.6 * r.width * r.height; }));
      // Glass: a backdrop filter, P4's edge hook (--lgs-edge, REQ C1a->P10: the window's tint is a sized
      // background-image and its edge a ::before), or a translucent fill that is not a plain black tint
      // (a recessed platter fill, REQ C4a->P10). Radius >= 16 and at least 60 x 40 in every case.
      const edgeHook = !isPseudo && (cs.getPropertyValue('--lgs-edge') || '').trim() !== '';
      const rgb = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor || '');
      const blackTint = !!rgb && rgb[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).every((v) => Number(v) === 0) && bgA < 0.5;
      const isGlass = !content && (bdf || edgeHook || (bgA > 0.02 && bgA < 0.95 && !blackTint)) && rad >= 16 && r.width >= 60 && r.height >= 40;
      const exId = () => exemptId(alias, el, 'outline');
      // P-43: thin lines anywhere (borders < 2 px, 1 px filled elements, hard 1-2 px shadow lines)
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const bw = parseFloat(cs['border' + side + 'Width']) || 0;
        if (bw > 0 && bw < 2 && alphaOf(cs['border' + side + 'Color']) > 0.05 && cs['border' + side + 'Style'] !== 'none') {
          if (!exId()) fails.push({ el: name, rect: rr(r), rule: 'P-43', why: `border-${side.toLowerCase()} ${bw}px` });
          break;
        }
      }
      if ((r.height > 0 && r.height < 2 && r.width >= 20) || (r.width > 0 && r.width < 2 && r.height >= 20)) {
        if ((bgA > 0.05 || cs.backgroundImage !== 'none') && !exId()) fails.push({ el: name, rect: rr(r), rule: 'P-43', why: `${Math.round(r.width)}x${Math.round(r.height)} filled line` });
      }
      const sl = hc ? { rings: [], lines: [], closed: false } : shadowLines(cs.boxShadow);
      if (!isGlass) {
        // Not glass: a ring or hard line is still a line thinner than 2 px (P-43), e.g. a selection fill's ring.
        if ((sl.rings.length || sl.lines.length) && !exId()) fails.push({ el: name, rect: rr(r), rule: 'P-43', why: [...sl.rings, ...sl.lines].slice(0, 3).join('; ') + ' (box-shadow)' });
        return;
      }
      const ex = exId();
      if (ex) { exempt.push({ el: name, id: ex }); return; }
      glass++;
      if (isPseudo) pseudoGlass++;
      if (!hc) {
        const bwMax = Math.max(...['Top', 'Right', 'Bottom', 'Left'].map((s) => (cs['border' + s + 'Style'] !== 'none' && alphaOf(cs['border' + s + 'Color']) > 0.05) ? parseFloat(cs['border' + s + 'Width']) || 0 : 0));
        if (bwMax > 0) fails.push({ el: name, rect: rr(r), rule: 'P-42', why: `border ${bwMax}px on glass` });
        if (!isPseudo && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && !el.matches(FIELD)) fails.push({ el: name, rect: rr(r), rule: 'P-42', why: `outline ${cs.outlineWidth} on glass` });
        if (sl.rings.length || sl.closed) fails.push({ el: name, rect: rr(r), rule: 'P-42', why: (sl.rings.length ? sl.rings[0] : 'closed rim of ' + sl.lines.length + ' shadow lines: ' + sl.lines.slice(0, 3).join('; ')) + ' on glass' });
        else if (sl.lines.length) fails.push({ el: name, rect: rr(r), rule: 'P-43', why: sl.lines.slice(0, 3).join('; ') + ' on glass (box-shadow)' });
      }
      addProbes(el, name, r, rad);
    };
    // Shown: no ancestor hidden (display none, visibility hidden, opacity < .05), memoised. Unlike L.visible it
    // keeps elements thinner than 2 px (the 1 px filled lines P-43 is about).
    const memo = new Map();
    const shown = (n) => {
      if (!n || n.nodeType !== 1) return true;
      if (memo.has(n)) return memo.get(n);
      const c = w.getComputedStyle(n);
      const v = !(c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05) && shown(n.parentElement);
      memo.set(n, v);
      return v;
    };
    const onScreen = (r) => r.right > 0 && r.bottom > 0 && r.left < w.innerWidth && r.top < w.innerHeight;
    for (const el of d.body.querySelectorAll('*')) {
      if (el.closest('[id^="lgs-"]')) continue;
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      const cs = w.getComputedStyle(el);
      if (r.width >= 2 || r.height >= 2) {
        if (onScreen(r) && r.width > 0 && r.height > 0) check(el, cs, r, label(el), false);
      }
      // ::before / ::after with content: the theme draws panes, selection fills and rims on them (review R1 M2).
      if (cs.display === 'contents') continue;
      for (const pe of ['::before', '::after']) {
        const pcs = w.getComputedStyle(el, pe);
        if (!pcs || pcs.content === 'none' || pcs.content === 'normal' || pcs.display === 'none' || pcs.visibility === 'hidden' || parseFloat(pcs.opacity) === 0) continue;
        const b = pseudoBox(w, el, pcs, r);
        if ((b.width < 2 && b.height < 2) || b.width <= 0 || b.height <= 0 || !onScreen(b)) continue;
        pseudoChecked++;
        check(el, pcs, b, label(el) + pe, true);
      }
    }
    return { pass: fails.length === 0, highContrast: hc, glass, pseudoGlass, pseudoChecked, fails: fails.slice(0, opts.max || 80), failCount: fails.length, probes: probes.slice(0, 64), probeCount: probes.length, exempt };
  }

  // ------------------------------------------------------------ G-MOTION (P-52, P-58, PLAN 1.5)
  // Which animations are ours: keyframes defined in our stylesheets, or transitions on an element that one
  // of our rules with a transition declaration matches. Steam's own (ItemFocusAnim-*, ScaledChildren's
  // route transform) are Steam's and are listed, not judged.
  const ourCache = new WeakMap();
  function ourSheets(doc) {
    const styles = [...doc.querySelectorAll('style')].filter((st) => /^lgs/.test(st.id || '') || /lgs-on/.test((st.textContent || '').slice(0, 4000)));
    const sig = styles.map((st) => (st.id || '') + ':' + (st.textContent || '').length).join('|');
    const c = ourCache.get(doc);
    if (c && c.sig === sig) return c;
    const sels = [], frames = new Set();
    // CSS nesting: a nested rule's selector is resolved against its parent (& = :is(parent); no & = descendant).
    const resolve = (sel, parent) => {
      if (!parent) return sel;
      return sel.includes('&') ? sel.replace(/&/g, ':is(' + parent + ')') : ':is(' + parent + ') ' + sel;
    };
    const walk = (rules, parent) => {
      for (const r of rules || []) {
        if (r.type === 7 /* KEYFRAMES */) { frames.add(r.name); continue; }
        if (r.cssRules && r.type !== 1) { walk(r.cssRules, parent); continue; }
        if (r.type !== 1 || !r.style) continue;
        const full = resolve(r.selectorText, parent);
        const st = r.style;
        if (st.transitionDuration || st.transitionProperty || st.transition || st.getPropertyValue('transition')) {
          for (const one of full.split(/,(?![^(]*\))/)) sels.push(one.replace(/::?(before|after|backdrop|placeholder|marker|selection)\b/g, '').trim() || '*');
        }
        if (r.cssRules && r.cssRules.length) walk(r.cssRules, full);
      }
    };
    for (const st of styles) { try { walk(st.sheet && st.sheet.cssRules, null); } catch (_) { /* cross-origin */ } }
    const out = { sig, sels, frames };
    ourCache.set(doc, out);
    return out;
  }
  function isOurs(doc, a) {
    const o = ourSheets(doc);
    if (a.animationName) return /^lgs-/.test(a.animationName) || o.frames.has(a.animationName);
    const tg = a.effect && a.effect.target;
    if (!tg || !tg.matches) return false;
    for (const s of o.sels) { try { if (tg.matches(s)) return true; } catch (_) { /* :has etc. */ } }
    return false;
  }
  function animsNow(alias) {
    const w = L.surface(alias);
    const doc = w.document;
    return doc.getAnimations().map((a) => {
      const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : {};
      const tg = a.effect && a.effect.target;
      return {
        name: a.animationName || (a.transitionProperty ? 'transition:' + a.transitionProperty : a.constructor.name),
        css: a.constructor.name, duration: typeof t.duration === 'number' ? Math.round(t.duration) : t.duration,
        delay: t.delay, easing: t.easing, iterations: t.iterations, fill: t.fill, playState: a.playState,
        target: tg ? L.readable(tg).slice(0, 3).join(' ') || tg.tagName : null,
        kfEasings: (a.effect && a.effect.getKeyframes) ? [...new Set(a.effect.getKeyframes().map((k) => k.easing).filter((x) => x && x !== 'linear'))] : [],
        ours: isOurs(doc, a),
        scroll: isScrollDriven(doc, a),
      };
    });
  }
  // A scroll-driven animation (ScrollTimeline / ViewTimeline: P5's scroll edge) does not move while the scroll is
  // still: it is skipped in the at-rest and duration checks, its easing is still checked (REQ P5->P10).
  function isScrollDriven(doc, a) {
    const m = window.__LGS_MOTION;
    if (m && typeof m.isScrollDriven === 'function') { try { return !!m.isScrollDriven(a); } catch (_) { /* fall back */ } }
    return !!(a.timeline && a.timeline !== doc.timeline);
  }
  function motionAudit(list) {
    const nonToken = [];
    for (const a of list) {
      const ours = a.ours !== undefined ? a.ours : /^lgs-/.test(a.name || '');
      if (!ours) continue;                                        // Steam's own animations and transitions are Steam's
      if (!a.scroll && !isTokenMs(Number(a.duration))) nonToken.push(`${a.name} on ${a.target}: duration ${a.duration} ms`);
      else if (!isTokenEase(a.easing)) nonToken.push(`${a.name} on ${a.target}: easing ${a.easing}`);
      else {
        const badKf = (a.kfEasings || []).find((e) => !isTokenEase(e));
        if (badKf) nonToken.push(`${a.name} on ${a.target}: keyframe easing ${String(badKf).slice(0, 60)}`);
      }
      if (a.iterations === Infinity || a.iterations === 'Infinity') nonToken.push(`${a.name} on ${a.target}: infinite`);
    }
    return nonToken;
  }
  function atRest(alias) {
    const all = animsNow(alias).filter((a) => !a.scroll);
    // Only ours are judged (REQ C4a->P10 3): Steam's own running animations (an indeterminate progress sweep,
    // the featured shelf tile) are functional and run identically with the theme off; they are listed apart.
    const list = all.filter((a) => a.ours || /^lgs-/.test(a.name || ''));
    const running = list.filter((a) => a.playState === 'running' || a.playState === 'pending');
    const left = list.filter((a) => /^lgs-/.test(a.name || ''));      // PLAN 1.5: none left, finished fills too
    const infinite = list.filter((a) => a.iterations === Infinity);
    const steam = all.filter((a) => !list.includes(a) && (a.playState === 'running' || a.playState === 'pending'));
    // Steam's finished forwards fills (ItemFocusAnim-*) are allowed (CTL C13)
    return { count: all.length, running: running.map((a) => `${a.name} on ${a.target} (${a.playState})`).slice(0, 30), lgsLeft: left.map((a) => `${a.name} on ${a.target}`).slice(0, 30), infinite: infinite.map((a) => `${a.name} on ${a.target}`), steamRunning: steam.map((a) => `${a.name} on ${a.target}`).slice(0, 10) };
  }
  // Static audit of our injected theme CSS (durations and easings in transition/animation declarations)
  function cssAudit(alias) {
    const w = L.surface(alias);
    const bad = [];
    for (const st of w.document.querySelectorAll('style')) {
      if (!/^lgs/.test(st.id || '') && !/lgs-on/.test((st.textContent || '').slice(0, 4000))) continue;
      const text = st.textContent || '';
      const rx = /(transition|animation)(-duration)?\s*:\s*([^;{}]+)/g;
      // var(...) are tokens by definition (custom properties are checked where they are defined)
      const stripVar = (v) => { let o = v, prev; do { prev = o; o = o.replace(/var\([^()]*\)/g, ' '); } while (o !== prev); return o; };
      let mm;
      while ((mm = rx.exec(text))) {
        const v = stripVar(mm[3]);
        // shorthand: only the first time of each comma item is a duration (the second is a delay)
        const items = v.split(/,(?![^(]*\))/);
        for (const it of items) {
          const times = [...it.matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)];
          for (const t of (mm[2] ? times : times.slice(0, 1))) {
            const ms = t[2] === 's' ? parseFloat(t[1]) * 1000 : parseFloat(t[1]);
            if (!isTokenMs(Math.round(ms))) bad.push(`${mm[1]}${mm[2] || ''} ${t[0]} (not a token) in "${mm[3].replace(/\s+/g, ' ').trim().slice(0, 70)}"`);
          }
        }
        if (bad.length >= 40) break;
      }
    }
    return bad;
  }

  // G-AUD with exemptions: drop exempt records from both snapshots, then L.diff. A scoped exemption (exemptions.json
  // "_scope": {"E-GRID": {"aud": ["SHRUNK"]}}) waives only the listed issue kinds, and only while the themed
  // element meets the exemption's own criterion (`exc`, from L.snap); its other issues are reported as usual.
  function audDiff(a, b) {
    const ex = [], scoped = [];
    const a2 = {}, b2 = {};
    for (const k of Object.keys(a)) {
      const kinds = a[k].exKinds || (b[k] && b[k].exKinds);
      if (kinds && kinds.length) {
        const one = L.diff({ [k]: a[k] }, b[k] ? { [k]: b[k] } : {});
        const c = (b[k] && b[k].exc) || { pass: null, why: 'no themed record' };
        const id = (b[k] && b[k].ex) || a[k].ex;
        for (const iss of one.issues) {
          const kind = iss.split(' ')[0];
          if (kinds.includes(kind) && c.pass === true) { if (ex.length < 40) ex.push({ el: a[k].el + (a[k].text ? ' "' + a[k].text + '"' : ''), id, waived: kind, why: c.why }); }
          else scoped.push(kinds.includes(kind) ? `${iss} (${id} criterion not met: ${c.why})` : iss);
        }
        continue;
      }
      const e = a[k].ex || (b[k] && b[k].ex);
      if (e) { if (ex.length < 40) ex.push({ el: a[k].el + (a[k].text ? ' "' + a[k].text + '"' : ''), id: e }); continue; }
      a2[k] = a[k];
      if (b[k]) b2[k] = b[k];
      // A scroll container that stays >= 300 x 300 is not a small target (REQ C1c->P10 c): a sheet capped at
      // 960 px keeps every row reachable by scrolling. Nor is a pane that stays >= 300 x 300 (REQ C7->P10: /chat's
      // panes under C1a's toolbar and footer pads): a focusable Panel that holds other controls or has no handler
      // of its own, or a text box; its controls are audited one by one. Their size change is listed, not counted as
      // SHRUNK; a leaf target with its own handler is always judged.
      // a pane: a control that holds other controls or has no activation handler of its own (Steam's data), or a
      // text box; a leaf target with its own handler is never one
      const pane = a[k].kind === 'text' || (a[k].kind === 'ctl' && (a[k].nl || (b[k] && b[k].nl) || a[k].act === false));
      if (b[k] && (a[k].sc || b[k].sc || pane) && b[k].w >= 300 && b[k].h >= 300 && b[k].w * b[k].h < a[k].w * a[k].h) {
        if (ex.length < 40) ex.push({ el: a[k].el + (a[k].text ? ' "' + a[k].text + '"' : ''), id: (a[k].sc || b[k].sc) ? 'scroll-container' : 'container-pane', why: `${a[k].w}x${a[k].h} -> ${b[k].w}x${b[k].h}` });
        b2[k] = Object.assign({}, b[k], { w: a[k].w, h: a[k].h });
      }
    }
    const r = L.diff(a2, b2);
    r.issues = r.issues.concat(scoped);
    r.exempt = ex;
    r.pass = r.issues.length === 0;
    return r;
  }

  L.gates = { v: 7, shadowLines, pseudoBox, visibleRect, topModal, hitStats, exemptCheck, exemptMatch, exemptCriterion, obscuredInfo, topScroller, canScroll, partOfHost, ownHandler, fillRect, isMenuCancel, isScrollDriven, isOurs, ourSheets, audDiff, mOf, exemptions, exemptId, controls, size, type, outline, animsNow, motionAudit, atRest, cssAudit, isTokenMs, isTokenEase, TOKENS };
})();
