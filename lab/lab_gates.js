// Gate sweeps for `glass.py gates` (P10, docs/phase2/contracts/lab.md section 4):
// G-SIZE, G-TYPE, G-OUTLINE (DOM part) and G-MOTION. Evaluated after
// lab_helpers.js and lab_p2.js; extends window.__LGS_LAB with L.gates.
(function () {
  const L = window.__LGS_LAB;
  if (!L || (L.gates && L.gates.v === 3)) return;

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
  function exemptId(alias, el) {
    const host = el.closest('[data-lgs-exempt]');
    if (host) return host.getAttribute('data-lgs-exempt');
    const t = exemptions();
    for (const id of Object.keys(t)) {
      if (!Array.isArray(t[id])) continue;
      for (const s of t[id]) {
        let sel;
        try { sel = L.sel(s); } catch (_) { continue; }
        try { if (el.closest(sel)) return id; } catch (_) { /* bad selector */ }
      }
    }
    return null;
  }

  const rectOf = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  const label = (el) => (L.readable(el).slice(0, 3).join(' ') || el.tagName.toLowerCase()) +
    ((el.innerText || el.getAttribute('aria-label') || '').trim() ? ' "' + (el.innerText || el.getAttribute('aria-label')).trim().replace(/\s+/g, ' ').slice(0, 30) + '"' : '');

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

  // ------------------------------------------------------------ G-SIZE (P-08, P-80, P-83; SM G2b)
  function size(alias, opts) {
    opts = opts || {};
    const w = L.surface(alias);
    const d = w.document;
    const m = mOf(alias);
    const ctls = controls(alias);
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
    const fails = [], exempt = [];
    let checked = 0;
    for (const el of ctls) {
      const ex = exemptId(alias, el);
      const r = el.getBoundingClientRect();
      const name = label(el);
      if (ex) { exempt.push({ el: name, id: ex, rect: rectOf(el) }); continue; }
      // A wrapper around exactly one same-size control is judged by that control.
      const inner = [...el.querySelectorAll(INTERACTIVE)].filter((c) => set.has(c));
      if (inner.length === 1 && Math.abs(inner[0].getBoundingClientRect().width - r.width) < 2 && Math.abs(inner[0].getBoundingClientRect().height - r.height) < 2) continue;
      if (containers.has(el)) continue;
      checked++;
      const short = Math.min(r.width, r.height);
      const isField = el.matches(FIELD);
      const minVis = (isField ? 64 : 60) * m;
      if (short + 0.5 < minVis) fails.push({ el: name, rect: rectOf(el), rule: 'P-80', why: `visible short side ${Math.round(short)} < ${Math.round(minVis)}` });
      // hit sampling over B = max(80m, w) x 80m, centred on the control
      const bw = Math.max(80 * m, r.width), bh = 80 * m;
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      let n = 0, own = 0, other = 0, otherName = null;
      for (let y = cy - bh / 2 + 2; y < cy + bh / 2; y += 4) {
        for (let x = cx - bw / 2 + 2; x < cx + bw / 2; x += 4) {
          if (x < 0 || y < 0 || x >= w.innerWidth || y >= w.innerHeight) continue;
          n++;
          const hit = d.elementFromPoint(x, y);
          if (!hit) continue;
          if (el.contains(hit) || hit.contains(el)) { own++; continue; }
          const hc = isCtl(hit);
          if (hc && hc !== el && !hc.contains(el)) { other++; if (!otherName) otherName = label(hc); }
        }
      }
      const ownPct = n ? own / n : 1, otherPct = n ? other / n : 0;
      if (ownPct < 0.95 || otherPct > 0) {
        fails.push({ el: name, rect: rectOf(el), rule: 'P-08', why: `hit ${Math.round(ownPct * 100)}% own, ${Math.round(otherPct * 100)}% other${otherName ? ' (' + otherName + ')' : ''} over ${Math.round(bw)}x${Math.round(bh)}` });
      }
      // P-83 shape: icon-only circles, text capsules (vertical stacks and keys excepted)
      const cs = w.getComputedStyle(el);
      const rad = parseFloat(cs.borderTopLeftRadius) || 0;
      const text = (el.innerText || '').trim();
      const hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none');
      if (hasBg && !isField) {
        const sib = el.parentElement ? [...el.parentElement.children].filter((s) => s !== el && set.has(s)) : [];
        const stack = sib.some((s) => { const q = s.getBoundingClientRect(); return Math.abs(q.x - r.x) < 4 && Math.abs(q.width - r.width) < 4; });
        const art = /url\(/.test(cs.backgroundImage) || !!el.querySelector('img, video, picture');
        if (!text && !art && short <= 120 * m && rad < 0.48 * short - 0.5) fails.push({ el: name, rect: rectOf(el), rule: 'P-83', why: `icon-only radius ${rad} < 0.48 x ${Math.round(short)}` });
        else if (text && !stack && rad < 0.45 * r.height - 0.5 && r.height <= 120 * m) fails.push({ el: name, rect: rectOf(el), rule: 'P-83', why: `text control radius ${rad} < 0.45 x height ${Math.round(r.height)}` });
      }
    }
    return { pass: fails.length === 0, m, checked, fails: fails.slice(0, opts.max || 80), failCount: fails.length, exempt };
  }

  // ------------------------------------------------------------ G-TYPE (P-38, P-84)
  function type(alias, opts) {
    opts = opts || {};
    const w = L.surface(alias);
    const d = w.document;
    const m = mOf(alias);
    const fails = [], exempt = [];
    let checked = 0;
    const seen = new Set();
    const tw = d.createTreeWalker(d.body, w.NodeFilter.SHOW_TEXT);
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      const s = t.textContent.trim();
      if (s.length < 1 || !/[\p{L}\p{N}]/u.test(s)) continue;
      const el = t.parentElement;
      if (!el || seen.has(el) || el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
      seen.add(el);
      if (el.closest('[id^="lgs-"]') || !L.visible(w, el)) continue;
      const ex = exemptId(alias, el);
      if (ex) { if (exempt.length < 40) exempt.push({ el: label(el), id: ex }); continue; }
      checked++;
      const cs = w.getComputedStyle(el);
      const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10) || 400;
      const why = [];
      if (fs + 0.01 < 18 * m) why.push(`size ${fs} < ${+(18 * m).toFixed(1)}`);
      if (fw < 500) why.push(`weight ${fw} < 500`);
      if (cs.textTransform === 'uppercase') why.push('uppercase');
      const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / fs;
      if (ls > 0.01) why.push(`tracking ${ls.toFixed(3)} em`);
      if (cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique')) why.push('italic');
      if (why.length) fails.push({ el: label(el), rect: rectOf(el), why: why.join(', ') });
    }
    return { pass: fails.length === 0, m, checked, fails: fails.slice(0, opts.max || 80), failCount: fails.length, exempt };
  }

  // ------------------------------------------------------------ G-OUTLINE, DOM part (P-42, P-43) + edge probes
  const alphaOf = (c) => { const p = /rgba?\(([^)]+)\)/.exec(c || ''); if (!p) return 0; const v = p[1].split(/[ ,/]+/).filter(Boolean); return v.length > 3 ? parseFloat(v[3]) : 1; };
  function outline(alias, opts) {
    opts = opts || {};
    const w = L.surface(alias);
    const d = w.document;
    const hc = w.matchMedia('(prefers-contrast: more)').matches;
    const fails = [], probes = [], exempt = [];
    let glass = 0;
    for (const el of d.body.querySelectorAll('*')) {
      if (el.closest('[id^="lgs-"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 && r.height < 2) continue;
      const cs = w.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const bgA = alphaOf(cs.backgroundColor);
      const bdf = cs.backdropFilter && cs.backdropFilter !== 'none';
      const rad = parseFloat(cs.borderTopLeftRadius) || 0;
      // Content (art, posters, media) is never glass (P-45): skip elements painted with an image
      // or covered by an <img>/<video>.
      const content = /url\(/.test(cs.backgroundImage) || [...el.querySelectorAll(':scope > img, :scope > video, :scope > picture, :scope > div > img')].some((m) => { const q = m.getBoundingClientRect(); return q.width * q.height >= 0.6 * r.width * r.height; });
      const isGlass = !content && (bdf || (bgA > 0.02 && bgA < 0.95)) && rad >= 16 && r.width >= 60 && r.height >= 40;
      // P-43: thin lines anywhere (borders < 2 px, 1 px filled elements)
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const bw = parseFloat(cs['border' + side + 'Width']) || 0;
        if (bw > 0 && bw < 2 && alphaOf(cs['border' + side + 'Color']) > 0.05 && cs['border' + side + 'Style'] !== 'none' && L.visible(w, el)) {
          if (!exemptId(alias, el)) fails.push({ el: label(el), rect: rectOf(el), rule: 'P-43', why: `border-${side.toLowerCase()} ${bw}px` });
          break;
        }
      }
      if ((r.height > 0 && r.height < 2 && r.width >= 20) || (r.width > 0 && r.width < 2 && r.height >= 20)) {
        if ((bgA > 0.05 || cs.backgroundImage !== 'none') && L.visible(w, el) && !exemptId(alias, el)) fails.push({ el: label(el), rect: rectOf(el), rule: 'P-43', why: `${Math.round(r.width)}x${Math.round(r.height)} filled line` });
      }
      if (!isGlass || !L.visible(w, el)) continue;
      const ex = exemptId(alias, el);
      if (ex) { exempt.push({ el: label(el), id: ex }); continue; }
      glass++;
      if (!hc) {
        const bwMax = Math.max(...['Top', 'Right', 'Bottom', 'Left'].map((s) => (cs['border' + s + 'Style'] !== 'none' && alphaOf(cs['border' + s + 'Color']) > 0.05) ? parseFloat(cs['border' + s + 'Width']) || 0 : 0));
        if (bwMax > 0) fails.push({ el: label(el), rect: rectOf(el), rule: 'P-42', why: `border ${bwMax}px on glass` });
        if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && !el.matches(FIELD)) fails.push({ el: label(el), rect: rectOf(el), rule: 'P-42', why: `outline ${cs.outlineWidth} on glass` });
        // a uniform ring: a shadow with 0 offsets, 0 blur and a spread of 0.5..2 px
        for (const sh of (cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\))/))) {
          const nums = sh.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/).filter((x) => /px$/.test(x)).map(parseFloat);
          const inset = /inset/.test(sh);
          if (nums.length >= 4 && nums[0] === 0 && nums[1] === 0 && nums[2] === 0 && nums[3] > 0 && nums[3] <= 2 && alphaOf((sh.match(/rgba?\([^)]*\)/) || [''])[0]) > 0.05) {
            fails.push({ el: label(el), rect: rectOf(el), rule: 'P-42', why: `${inset ? 'inset ' : ''}${nums[3]}px ring shadow` });
            break;
          }
        }
      }
      if (r.width >= 200 * mOf(alias) && r.top >= 0 && r.top < w.innerHeight - 20) {
        const inset = Math.max(rad, r.width * 0.06);
        probes.push({ el: label(el), y: Math.round(r.top), x0: Math.round(r.left + inset), x1: Math.round(r.right - inset) });
      }
    }
    return { pass: fails.length === 0, highContrast: hc, glass, fails: fails.slice(0, opts.max || 80), failCount: fails.length, probes: probes.slice(0, 24), exempt };
  }

  // ------------------------------------------------------------ G-MOTION (P-52, P-58, PLAN 1.5)
  function animsNow(alias) {
    const w = L.surface(alias);
    return w.document.getAnimations().map((a) => {
      const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : {};
      const tg = a.effect && a.effect.target;
      return {
        name: a.animationName || (a.transitionProperty ? 'transition:' + a.transitionProperty : a.constructor.name),
        css: a.constructor.name, duration: typeof t.duration === 'number' ? Math.round(t.duration) : t.duration,
        delay: t.delay, easing: t.easing, iterations: t.iterations, fill: t.fill, playState: a.playState,
        target: tg ? L.readable(tg).slice(0, 3).join(' ') || tg.tagName : null,
        kfEasings: (a.effect && a.effect.getKeyframes) ? [...new Set(a.effect.getKeyframes().map((k) => k.easing).filter((x) => x && x !== 'linear'))] : [],
      };
    });
  }
  function motionAudit(list) {
    const nonToken = [];
    for (const a of list) {
      const ours = /^lgs-/.test(a.name || '');
      if (!ours && a.css !== 'CSSTransition') continue;           // Steam's own keyframes are Steam's
      if (!isTokenMs(Number(a.duration))) nonToken.push(`${a.name} on ${a.target}: duration ${a.duration} ms`);
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
    const list = animsNow(alias);
    const running = list.filter((a) => a.playState === 'running' || a.playState === 'pending');
    const left = list.filter((a) => /^lgs-/.test(a.name || ''));
    const infinite = list.filter((a) => a.iterations === Infinity);
    // Steam's finished forwards fills (ItemFocusAnim-*) are allowed (CTL C13)
    return { count: list.length, running: running.map((a) => `${a.name} on ${a.target} (${a.playState})`).slice(0, 30), lgsLeft: left.map((a) => `${a.name} on ${a.target}`).slice(0, 30), infinite: infinite.map((a) => `${a.name} on ${a.target}`) };
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

  // G-AUD with exemptions: drop exempt records from both snapshots, then L.diff.
  function audDiff(a, b) {
    const ex = [];
    const a2 = {}, b2 = {};
    for (const k of Object.keys(a)) {
      const e = a[k].ex || (b[k] && b[k].ex);
      if (e) { if (ex.length < 40) ex.push({ el: a[k].el + (a[k].text ? ' "' + a[k].text + '"' : ''), id: e }); continue; }
      a2[k] = a[k];
      if (b[k]) b2[k] = b[k];
    }
    const r = L.diff(a2, b2);
    r.exempt = ex;
    r.pass = r.issues.length === 0;
    return r;
  }

  L.gates = { v: 3, audDiff, mOf, exemptions, exemptId, controls, size, type, outline, animsNow, motionAudit, atRest, cssAudit, isTokenMs, isTokenEase, TOKENS };
})();
