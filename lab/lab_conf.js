// DOM and CSS checks for `glass.py conformance` (P10, contracts/lab.md section 4; VP section 6).
// Evaluated after the other lab helper files; adds L.conf. Each check returns {pass, detail, n?}; pass is
// true, false, or null (not applicable on this route / state).
(function () {
  const L = window.__LGS_LAB;
  if (!L || !L.gates || (L.conf && L.conf.v === 2)) return;

  const alphaOf = (c) => { const p = /rgba?\(([^)]+)\)/.exec(c || ''); if (!p) return 0; const v = p[1].split(/[ ,/]+/).filter(Boolean); return v.length > 3 ? parseFloat(v[3]) : 1; };
  const rgbOf = (c) => { const p = /rgba?\(([^)]+)\)/.exec(c || ''); if (!p) return null; return p[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number); };
  const sat = (rgb) => { const [r, g, b] = rgb.map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return 0; const d = mx - mn; return l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); };
  const label = (el) => (L.readable(el).slice(0, 2).join(' ') || el.tagName.toLowerCase()) + ((el.innerText || '').trim() ? ' "' + el.innerText.trim().replace(/\s+/g, ' ').slice(0, 24) + '"' : '');
  const isWeb = (el) => { try { return !!L.gates.exemptId('main', el) && /E-WEB/.test(L.gates.exemptId('main', el)); } catch (_) { return false; } };

  // Our style rules (CSS nesting resolved), for P-01, P-02, P-89.
  function ourRules(doc) {
    const styles = [...doc.querySelectorAll('style')].filter((st) => /^lgs/.test(st.id || '') || /lgs-on/.test((st.textContent || '').slice(0, 4000)));
    const out = [];
    const resolve = (sel, parent) => (!parent ? sel : (sel.includes('&') ? sel.replace(/&/g, ':is(' + parent + ')') : ':is(' + parent + ') ' + sel));
    const walk = (rules, parent) => {
      for (const r of rules || []) {
        if (r.type === 1 && r.style) {
          const full = resolve(r.selectorText, parent);
          out.push({ sel: full, style: r.style });
          if (r.cssRules && r.cssRules.length) walk(r.cssRules, full);
        } else if (r.cssRules) walk(r.cssRules, parent);
      }
    };
    for (const st of styles) { try { walk(st.sheet && st.sheet.cssRules, null); } catch (_) { /* skip */ } }
    return out;
  }
  const splitSel = (s) => s.split(/,(?![^(]*\))/).map((x) => x.trim());

  function run(alias, o) {
    o = o || {};
    const w = L.surface(alias), d = w.document;
    const W = w.innerWidth, H = w.innerHeight;
    const res = {};
    const all = [...d.body.querySelectorAll('*')].filter((el) => !el.closest('[id^="lgs-"]'));
    const cs = (el) => w.getComputedStyle(el);

    // P-13: exactly one element shows gamepad focus (Steam's .gpfocus with a nav node), pad mode only
    const gpf = [...d.querySelectorAll('.gpfocus')].filter((e) => L.navNode(e) && L.visible(w, e));
    res['P-13'] = o.mode === 'pad' ? { pass: gpf.length === 1, detail: `${gpf.length} focused element(s)` + (gpf.length ? ': ' + gpf.slice(0, 3).map(label).join('; ') : '') }
      : { pass: null, detail: 'gamepad mode only (--mode pad)' };

    // P-17: no outline or ring shadow on .gpfocus elements other than text/search fields
    const ring = [];
    for (const e of gpf) {
      if (e.matches('input, textarea, [role=textbox]') || e.querySelector('input, textarea')) continue;
      const c = cs(e);
      if (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) ring.push(label(e) + ' outline ' + c.outlineWidth);
      for (const sh of (c.boxShadow === 'none' ? [] : c.boxShadow.split(/,(?![^(]*\))/))) {
        const nums = sh.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/).filter((x) => /px$/.test(x)).map(parseFloat);
        if (nums.length >= 4 && nums[0] === 0 && nums[1] === 0 && nums[2] <= 1 && nums[3] > 0 && nums[3] <= 3) { ring.push(label(e) + ' ring ' + sh.trim().slice(0, 40)); break; }
      }
    }
    res['P-17'] = gpf.length ? { pass: ring.length === 0, detail: ring.length ? ring.join('; ') : 'no ring on the focused element' } : { pass: null, detail: 'no gamepad focus on this route' };

    // P-31: no paragraph text (>= 2 lines, <= 24 px) above y 108
    const para = [];
    const tw = d.createTreeWalker(d.body, w.NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      const el = t.parentElement;
      if (!el || seen.has(el) || !t.textContent.trim()) continue;
      seen.add(el);
      if (!L.visible(w, el) || isWeb(el)) continue;
      const c = cs(el), fs = parseFloat(c.fontSize), lh = parseFloat(c.lineHeight) || fs * 1.2, r = el.getBoundingClientRect();
      if (fs <= 24 && r.height >= 1.8 * lh && r.top < 108) para.push(label(el) + ` top ${Math.round(r.top)}`);
    }
    res['P-31'] = { pass: para.length === 0, detail: para.length ? para.slice(0, 5).join('; ') : 'none above 108' };

    // P-33: <= 30 visible interactive targets (keyboard and web content excluded)
    const tg = L.gates.controls(alias).filter((e) => !isWeb(e));
    res['P-33'] = { pass: tg.length <= 30, n: tg.length, detail: `${tg.length} visible interactive targets` };

    // P-40: no coloured text (saturation > .35) under 24 px or under weight 600 (red destructive >= 22 Semibold allowed)
    const col = [];
    for (const el of seen) {
      if (!L.visible(w, el) || isWeb(el)) continue;
      const c = cs(el), rgb = rgbOf(c.color);
      if (!rgb || alphaOf(c.color) < 0.3) continue;
      const s = sat(rgb), fs = parseFloat(c.fontSize), fw = parseInt(c.fontWeight, 10) || 400;
      if (s <= 0.35 || (fs >= 24 && fw >= 600)) continue;
      const red = rgb[0] > 180 && rgb[1] < 110 && rgb[2] < 110;
      if (red && fs >= 22 && fw >= 600) continue;
      col.push(label(el) + ` ${c.color} ${fs}px/${fw}`);
    }
    res['P-40'] = { pass: col.length === 0, detail: col.length ? `${col.length}: ` + col.slice(0, 5).join('; ') : 'none' };

    // P-45: no backdrop-filter inside another backdrop-filter
    const bdf = all.filter((e) => { const v = cs(e).backdropFilter; return v && v !== 'none' && L.visible(w, e); });
    const nested = bdf.filter((e) => bdf.some((p) => p !== e && p.contains(e)));
    res['P-45'] = { pass: nested.length === 0, detail: nested.length ? nested.slice(0, 5).map(label).join('; ') : `${bdf.length} glass elements, none nested` };

    // P-72: no visible scrollbars at rest
    const bars = all.filter((e) => { const c = cs(e); return /(auto|scroll)/.test(c.overflowY + c.overflowX) && ((e.offsetWidth - e.clientWidth > 2 && e.scrollHeight > e.clientHeight) || (e.offsetHeight - e.clientHeight > 2 && e.scrollWidth > e.clientWidth)) && L.visible(w, e) && !isWeb(e); });
    res['P-72'] = { pass: bars.length === 0, detail: bars.length ? bars.slice(0, 5).map((e) => label(e) + ` (${e.offsetWidth - e.clientWidth} px)`).join('; ') : 'none' };

    // P-81: no full-width bands (>= 90 % of the window width, <= 120 tall, a visible fill, within 80 px of top or bottom)
    const bands = all.filter((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 0.9 * W || r.height > 120 || r.height < 2) return false;
      if (!(r.top < 80 || r.bottom > H - 80)) return false;
      const c = cs(e);
      return (alphaOf(c.backgroundColor) > 0.05 || (c.backgroundImage !== 'none' && !/url\(/.test(c.backgroundImage))) && L.visible(w, e) && !isWeb(e);
    });
    res['P-81'] = { pass: bands.length === 0, detail: bands.length ? bands.slice(0, 4).map((e) => { const r = e.getBoundingClientRect(); return label(e) + ` ${Math.round(r.width)}x${Math.round(r.height)} at y ${Math.round(r.top)}`; }).join('; ') : 'none' };

    // P-82: no text Back / Close / Cancel / Done buttons in the top 120 px
    const words = /^(back|close|cancel|done)$/i;
    const txtBtn = L.gates.controls(alias).filter((e) => { const r = e.getBoundingClientRect(); const t = (e.innerText || '').trim(); return r.top < 120 && words.test(t) && !e.closest('[data-lgs-sheet-toolbar]'); });
    res['P-82'] = { pass: txtBtn.length === 0, detail: txtBtn.length ? txtBtn.map(label).join('; ') : 'none' };

    // P-85, P-86: modal layers and scrim
    let modals = 0;
    try { modals = L.openThings().modals.length; } catch (_) { /* vr page */ }
    res['P-85'] = { pass: modals <= 1 ? true : null, detail: `${modals} modal(s) open` + (modals > 1 ? ' (an alert over a sheet is allowed: judge)' : '') };
    const scr = all.filter((e) => /ModalOverlayBackground|ModalOverlay/i.test(L.readable(e).join(' ')) && L.visible(w, e));
    const scrA = scr.map((e) => alphaOf(cs(e).backgroundColor));
    res['P-86'] = scr.length ? { pass: scrA.every((a) => a <= 0.45), detail: 'scrim alpha ' + scrA.join(', ') } : { pass: null, detail: 'no modal scrim visible' };

    // P-87: no opaque window or panel fill (alpha <= .84; Increase Contrast exempt)
    const hc = w.matchMedia('(prefers-contrast: more)').matches;
    const opaque = hc ? [] : all.filter((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 300 || r.height < 200) return false;
      const c = cs(e);
      if ((parseFloat(c.borderTopLeftRadius) || 0) < 16) return false;
      if (/url\(/.test(c.backgroundImage) || e.querySelector(':scope > img, :scope > video')) return false;
      return alphaOf(c.backgroundColor) > 0.84 && L.visible(w, e) && !isWeb(e);
    });
    res['P-87'] = hc ? { pass: null, detail: 'Increase Contrast on: exempt' } : { pass: opaque.length === 0, detail: opaque.length ? opaque.slice(0, 4).map((e) => label(e) + ' ' + cs(e).backgroundColor).join('; ') : 'none' };

    // CSS: P-01 (every .gpfocus rule scoped by the input mode), P-02 (laser-mode .gpfocus paint requires :hover),
    // P-89 (every :hover reveal has a .gpfocus twin)
    const rules = ourRules(d);
    const MODE = /lgs-input-(pad|laser)|data-lgs-vr-mode/;
    const unscoped = [], laserNoHover = [], reveals = [];
    const hoverSels = new Set(), focusSels = new Set();
    for (const r of rules) {
      for (const s of splitSel(r.sel)) {
        if (/\.gpfocus\b/.test(s)) {
          focusSels.add(s.replace(/\.gpfocus(within)?\b/g, '§'));
          if (!MODE.test(s)) unscoped.push(s);
          else if (/\.lgs-input-laser/.test(s.replace(/:not\([^()]*\)/g, '')) && !/:hover/.test(s)) laserNoHover.push(s);
        }
        if (/:hover\b/.test(s)) {
          hoverSels.add(s);
          const st = r.style;
          if (st.opacity !== '' || st.visibility === 'visible' || (st.display && st.display !== 'none')) reveals.push(s);
        }
      }
    }
    res['P-01'] = { pass: unscoped.length === 0, n: unscoped.length, detail: unscoped.length ? `${unscoped.length} .gpfocus selectors without an input-mode class, e.g. ` + unscoped.slice(0, 3).join(' | ').slice(0, 300) : `${focusSels.size} .gpfocus selectors, all mode-scoped` };
    res['P-02'] = { pass: laserNoHover.length === 0, n: laserNoHover.length, detail: laserNoHover.length ? laserNoHover.slice(0, 3).join(' | ').slice(0, 300) : 'laser-mode .gpfocus rules all require :hover' };
    // Heuristic twin match: drop every input-mode scope on both sides, then compare with :hover and
    // .gpfocus(within) as the same token (one selector may also list both, e.g. :is(:hover, .gpfocus)).
    const norm = (x) => x.replace(/:not\(\.lgs-input-(pad|laser)\)/g, '').replace(/html\.lgs-input-(pad|laser)|\.lgs-input-(pad|laser)|\[data-lgs-vr-mode[^\]]*\]/g, '')
      .replace(/:hover\b|\.gpfocuswithin\b|\.gpfocus\b/g, '§').replace(/\s+/g, ' ').trim();
    const twins = new Set(rules.flatMap((r) => splitSel(r.sel)).filter((x) => /\.gpfocus/.test(x)).map(norm));
    const noTwin = reveals.filter((s) => !/\.gpfocus/.test(s) && !twins.has(norm(s)));
    res['P-89'] = { pass: noTwin.length === 0, n: noTwin.length, detail: noTwin.length ? `${noTwin.length} :hover reveals without a .gpfocus twin, e.g. ` + noTwin.slice(0, 3).join(' | ').slice(0, 300) : `${reveals.length} :hover reveals, all twinned` };
    return res;
  }
  L.conf = { v: 2, run, ourRules };
})();
