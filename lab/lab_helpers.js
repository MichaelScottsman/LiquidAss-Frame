// Development helpers evaluated in SharedJSContext (prepended with
// lgs_index.js). Installs window.__LGS_LAB; lives in memory only.
(function () {
  if (window.__LGS_LAB && window.__LGS_LAB.v === 5) return;
  const index = (window.__LGS_INDEX && window.__LGS_INDEX.selector) ? window.__LGS_INDEX : (window.__LGS_INDEX = lgsBuildIndex());

  const ALIAS = {
    main: /^VR_uid/,
    keyboard: /^VRKeyboard_uid/,
    notifications: /^VRNotificationToasts_uid/,
  };

  function popups() {
    return [...g_PopupManager.m_mapPopups.values()].map((p) => {
      let win = null;
      try { win = p.window; } catch (_) { /* closing */ }
      return { name: p.m_strName, win };
    }).filter((p) => p.win && p.win.document);
  }

  function surface(alias) {
    const ps = popups();
    const rx = ALIAS[alias];
    let p = rx ? ps.find((x) => rx.test(x.name)) : null;
    if (!p) p = ps.find((x) => x.name.startsWith('valve.steam.gamepadui.' + alias));
    if (!p) p = ps.find((x) => x.name.includes(alias));
    if (!p) throw new Error('no surface ' + alias + ' (have: ' + ps.map((x) => x.name).join(', ') + ')');
    return p.win;
  }

  // Resolve %{Token} in a selector to hashed classes.
  function sel(s) {
    return s.replace(/%\{([^}]+)\}/g, (_, t) => {
      const r = index.selector(t);
      if (!r.sel) throw new Error('token ' + t + ' ' + r.err);
      return r.sel;
    });
  }

  function q(alias, s) { return surface(alias).document.querySelector(sel(s)); }
  function qa(alias, s) { return [...surface(alias).document.querySelectorAll(sel(s))]; }

  function readable(el) {
    const out = [];
    for (const c of el.classList) {
      if (c === 'lgs-on') continue;
      const t = index.byHash.has(c) ? index.tokenFor(c) : null;
      out.push(t ? '%{' + t + '}' : c);
    }
    return out;
  }

  function click(alias, s) {
    const el = q(alias, s);
    if (!el) throw new Error('nothing matches ' + s + ' in ' + alias);
    el.scrollIntoView && el.scrollIntoView({ block: 'nearest' });
    const w = surface(alias);
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: w, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 };
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const E = t.startsWith('pointer') ? w.PointerEvent : w.MouseEvent;
      el.dispatchEvent(new E(t, Object.assign({ pointerType: 'mouse', isPrimary: true }, o)));
    }
    return readable(el).join(' ') || el.tagName;
  }

  function mainInstance() { return SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance; }
  function route() { return mainInstance().m_history.location.pathname; }
  function nav(path) { mainInstance().Navigate(path); return path; }
  function back() { mainInstance().NavigateBack(); return route(); }

  const STYLE_PROPS = ['background-color', 'background-image', 'backdrop-filter', 'border-radius', 'box-shadow', 'border', 'color', 'opacity', 'font', 'padding', 'margin', 'display', 'position', 'z-index', 'transform', 'filter', 'outline'];

  // Compact readable outline: tag, readable classes, rect, paint hints, text.
  function outline(alias, opts) {
    opts = opts || {};
    const w = surface(alias);
    const doc = w.document;
    const rootEl = opts.sel ? doc.querySelector(sel(opts.sel)) : doc.body;
    if (!rootEl) throw new Error('outline root not found: ' + opts.sel);
    const maxDepth = opts.depth || 60;
    const maxLines = opts.max || 700;
    const lines = [];
    const walk = (el, d) => {
      if (lines.length >= maxLines || d > maxDepth) return;
      if (el.id === 'lgs-defs' || el.tagName === 'STYLE' || el.tagName === 'SCRIPT' || el.tagName === 'LINK') return;
      const r = el.getBoundingClientRect();
      const visible = r.width > 1 && r.height > 1;
      if (!visible) { for (const c of el.children) walk(c, d); return; }
      const cs = w.getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      const tag = el.tagName.toLowerCase();
      if (tag === 'path' || tag === 'g' || tag === 'circle' || tag === 'rect' || tag === 'line' || tag === 'polygon' || tag === 'polyline' || tag === 'ellipse' || tag === 'defs' || tag === 'lineargradient' || tag === 'stop') return;
      let hint = '';
      if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') hint += ' bg=' + cs.backgroundColor.replace(/ /g, '');
      if (cs.backgroundImage !== 'none') hint += cs.backgroundImage.startsWith('url') ? ' bgimg' : ' bggrad';
      if (cs.backdropFilter && cs.backdropFilter !== 'none') hint += ' bdf';
      if (parseFloat(cs.borderTopLeftRadius) > 0) hint += ' r=' + parseFloat(cs.borderTopLeftRadius);
      if (cs.opacity !== '1') hint += ' op=' + cs.opacity;
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean).join(' ').slice(0, 48);
      const extra = [];
      if (el.getAttribute('aria-label')) extra.push('aria="' + el.getAttribute('aria-label').slice(0, 30) + '"');
      if (el.getAttribute('role')) extra.push('role=' + el.getAttribute('role'));
      if (tag === 'img') extra.push('img');
      if (tag === 'input') extra.push('input');
      const cls = readable(el).join(' ');
      lines.push('  '.repeat(d) + tag + (cls ? ' ' + cls : '') + ` [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}]` + hint + (extra.length ? ' ' + extra.join(' ') : '') + (text ? ' "' + text + '"' : ''));
      for (const c of el.children) walk(c, d + 1);
    };
    walk(rootEl, 0);
    if (lines.length >= maxLines) lines.push('... (truncated at ' + maxLines + ' lines; use --sel/--depth)');
    return lines.join('\n');
  }

  function styles(alias, s) {
    const w = surface(alias);
    return qa(alias, s).slice(0, 6).map((el) => {
      const cs = w.getComputedStyle(el);
      const o = { el: readable(el).join(' ') };
      for (const p of STYLE_PROPS) o[p] = cs.getPropertyValue(p);
      return o;
    });
  }

  // Search the class index: readable names matching a regex, with tokens.
  function classes(rx, limit) {
    const re = new RegExp(rx, 'i');
    const out = [];
    for (const [k, mis] of index.byKey) {
      if (!re.test(k)) continue;
      const hashes = [...new Set(mis.map((mi) => index.mods[mi][k]))];
      for (const h of hashes) out.push('%{' + index.tokenFor(h) + '}  ' + h);
      if (hashes.length > 1) out.push('%{*' + k + '}  (all ' + hashes.length + ' variants)');
      if (out.length > (limit || 200)) break;
    }
    return out.join('\n');
  }

  function surfaces() {
    return popups().map((p) => {
      const d = p.win.document;
      return { name: p.name, w: p.win.innerWidth, h: p.win.innerHeight, nodes: d.querySelectorAll('*').length, visibility: d.visibilityState };
    });
  }

  // ---------------------------------------------------------------- audit
  // Snapshot every interactive element and every text leaf of a surface, so
  // the stock UI (theme off) can be diffed against the themed UI (theme on).

  const INTERACTIVE = '.Focusable, [role=button], button, input, textarea, select, a[href], [tabindex]';
  const ROOMS = { grey: [128, 128, 128], bright: [210, 210, 210], dark: [24, 24, 24] };

  function parseColor(c) {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function over(top, under) { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)); }
  function lum(rgb) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }
  function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  // Effective backdrop of an element: solid colours (and the first stop of
  // gradients) of every ancestor composited over the room. Images count as
  // opaque mid-grey content.
  function backdrop(w, el, room) {
    const chain = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
    let bg = room.slice();
    let opacity = 1;
    for (let i = chain.length - 1; i >= 0; i--) {
      const cs = w.getComputedStyle(chain[i]);
      opacity *= parseFloat(cs.opacity);
      const img = cs.backgroundImage;
      if (img && img !== 'none') {
        if (img.startsWith('url')) bg = [96, 96, 96];
        else { const c = parseColor((img.match(/rgba?\([^)]+\)/) || [])[0]); if (c) bg = over(c, bg); }
      }
      const c = parseColor(cs.backgroundColor);
      if (c && c[3] > 0) bg = over(c, bg);
    }
    return { bg, opacity };
  }

  function pathOf(el, root) {
    const p = [];
    for (let n = el; n && n !== root; n = n.parentElement) {
      let i = 0;
      for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (!(s.id && s.id.startsWith('lgs-'))) i++;
      p.push(i);
    }
    return p.reverse().join('.');
  }

  function visibleIn(w, el) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = w.getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    }
    return true;
  }

  function snap(alias) {
    const w = surface(alias);
    const doc = w.document;
    const out = {};
    const add = (el, kind) => {
      if (el.closest('[id^="lgs-"]')) return;
      const key = pathOf(el, doc.body);
      if (out[key] && out[key].kind === 'ctl') return;
      const r = el.getBoundingClientRect();
      const cs = w.getComputedStyle(el);
      const rec = {
        kind, el: (readable(el).slice(0, 3).join(' ') || el.tagName.toLowerCase()),
        text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 40),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        vis: visibleIn(w, el), pe: cs.pointerEvents,
      };
      if (kind === 'text') {
        const fg = parseColor(cs.color) || [255, 255, 255, 1];
        const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
        rec.large = size >= 24 || (size >= 18.66 && weight >= 700);
        rec.cr = {};
        for (const [name, room] of Object.entries(ROOMS)) {
          const { bg, opacity } = backdrop(w, el, room);
          const text = over([fg[0], fg[1], fg[2], fg[3] * opacity], bg);
          rec.cr[name] = Math.round(contrast(text, bg) * 10) / 10;
        }
      }
      out[key] = rec;
    };
    doc.querySelectorAll(INTERACTIVE).forEach((el) => add(el, 'ctl'));
    const tw = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      if (t.textContent.trim().length < 2) continue;
      const el = t.parentElement;
      if (!el || el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
      add(el, 'text');
    }
    return out;
  }

  // Diff two snapshots: regressions in visibility, size, hit-testing and
  // legibility. Moves are reported separately (themes may restyle padding).
  function diff(a, b) {
    const issues = [], moved = [];
    let ctl = 0, text = 0;
    for (const k of Object.keys(a)) {
      const x = a[k], y = b[k];
      if (x.kind === 'ctl') ctl++; else text++;
      const label = `${x.kind} ${x.el}${x.text ? ' "' + x.text + '"' : ''}`;
      if (!y) { issues.push('GONE ' + label); continue; }
      if (x.vis && !y.vis) issues.push('HIDDEN ' + label);
      if (x.vis && y.vis && x.w * x.h > 0 && (y.w * y.h) / (x.w * x.h) < 0.85) issues.push(`SHRUNK ${label} ${x.w}x${x.h} -> ${y.w}x${y.h}`);
      if (x.pe !== 'none' && y.pe === 'none' && x.kind === 'ctl') issues.push('UNCLICKABLE ' + label);
      if (x.vis && y.vis && (Math.abs(x.x - y.x) > 24 || Math.abs(x.y - y.y) > 24)) moved.push(`${label} (${x.x},${x.y}) -> (${y.x},${y.y})`);
      if (y.kind === 'text' && y.vis && y.cr) {
        const need = y.large ? 3 : 4.5;
        const worst = Math.min(y.cr.grey, y.cr.bright, y.cr.dark);
        const before = x.cr ? Math.min(x.cr.grey, x.cr.bright, x.cr.dark) : 0;
        if (worst < need && worst < before - 0.3) issues.push(`CONTRAST ${label} ${before} -> ${worst} (needs ${need}; rooms grey/bright/dark ${y.cr.grey}/${y.cr.bright}/${y.cr.dark})`);
      }
    }
    return { controls: ctl, texts: text, issues, moved: moved.slice(0, 40), movedCount: moved.length };
  }

  window.__LGS_LAB = { v: 5, surface, sel, q, qa, click, nav, back, route, outline, styles, classes, surfaces, readable, index, snap, diff };
})();
