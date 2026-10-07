// Development helpers evaluated in SharedJSContext (prepended with
// lgs_index.js). Installs window.__LGS_LAB; lives in memory only.
(function () {
  if (window.__LGS_LAB && window.__LGS_LAB.v === 13) return;
  // SteamVR's own pages (vrwebhelper) are single documents with no popup
  // manager; every helper then works on this page.
  const SINGLE = typeof window.g_PopupManager === 'undefined';
  // The class index is read at call time (REQ C1a->P10): the core may rebuild window.__LGS_INDEX after a bad
  // index, and the helpers must follow it rather than keep the object they saw at install.
  // Through P1's lgsIndexShared() (device/lgs_index.js, REQ P1->P10): it reuses the cache only while it is ok and
  // current, caches only an ok index and drops a bad one (a short index built while Steam reloads).
  const IX = () => (typeof lgsIndexShared === 'function' ? lgsIndexShared()
    : ((window.__LGS_INDEX && window.__LGS_INDEX.selector) ? window.__LGS_INDEX : (window.__LGS_INDEX = lgsBuildIndex())));

  const ALIAS = {
    main: /^VR_uid/,
    keyboard: /^VRKeyboard_uid/,
    notifications: /^VRNotificationToasts_uid/,
  };

  function popups() {
    if (SINGLE) return [{ name: 'vr:' + (document.title || 'page'), win: window }];
    return [...g_PopupManager.m_mapPopups.values()].map((p) => {
      let win = null;
      try { win = p.window; } catch (_) { /* closing */ }
      return { name: p.m_strName, win };
    }).filter((p) => p.win && p.win.document);
  }

  function surface(alias) {
    if (SINGLE) return window;
    const ps = popups();
    const rx = ALIAS[alias];
    let p = rx ? ps.find((x) => rx.test(x.name)) : null;
    const base = 'valve.steam.gamepadui.' + alias;
    if (!p) p = ps.find((x) => x.name.startsWith(base + '.') || x.name.startsWith(base + '_'));
    if (!p) p = ps.find((x) => x.name.includes(alias));
    if (!p) throw new Error('no surface ' + alias + ' (have: ' + ps.map((x) => x.name).join(', ') + ')');
    return p.win;
  }

  // Resolve %{Token} in a selector to hashed classes.
  function sel(s) {
    return s.replace(/%\{([^}]+)\}/g, (_, t) => {
      const r = IX().selector(t);
      if (!r.sel) throw new Error('token ' + t + ' ' + r.err);
      return r.sel;
    });
  }

  // Phase 2 (P10): a selector may end in `@text=Label` (exact innerText, else the first that contains it).
  function splitText(s) { const i = s.indexOf('@text='); return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 6)]; }
  function byText(els, t) { return t === null ? els : (els.filter((e) => (e.innerText || '').trim() === t).length ? els.filter((e) => (e.innerText || '').trim() === t) : els.filter((e) => (e.innerText || '').includes(t))); }
  function q(alias, s) { const [c, t] = splitText(s); if (t === null) return surface(alias).document.querySelector(sel(c)); return byText([...surface(alias).document.querySelectorAll(sel(c))], t)[0] || null; }
  function qa(alias, s) { const [c, t] = splitText(s); return byText([...surface(alias).document.querySelectorAll(sel(c))], t); }

  function readable(el) {
    const out = [];
    for (const c of el.classList) {
      if (c === 'lgs-on') continue;
      const ix = IX(), t = ix.byHash.has(c) ? ix.tokenFor(c) : null;
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

  // Click the first element matching sel whose text is exactly (or contains) text.
  function clickText(alias, s, text) {
    const el = qa(alias, s).find((e) => e.innerText.trim() === text) || qa(alias, s).find((e) => e.innerText.includes(text));
    if (!el) throw new Error('no ' + s + ' with text ' + JSON.stringify(text) + ' in ' + alias);
    const mark = 'lgs-click-' + Math.random().toString(36).slice(2);
    el.setAttribute('data-lgs-click', mark);
    try { return click(alias, '[data-lgs-click="' + mark + '"]'); } finally { el.removeAttribute('data-lgs-click'); }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Move controller focus like a D-pad (navigation only; never A/B/menu).
  // Left/right on a focused slider would change its value, so pad() refuses
  // horizontal moves while a slider has focus.
  const DIRS = { up: 9, down: 10, left: 11, right: 12 };
  async function pad(dir, times) {
    const code = DIRS[dir];
    if (!code) throw new Error('pad: use up/down/left/right');
    for (let i = 0; i < (times || 1); i++) {
      if (code >= 11) {
        for (const p of popups()) {
          const f = p.win.document.querySelector('.gpfocus');
          if (f && (f.querySelector('input[type=range]') || /Slider/i.test(readable(f).join(' ')) || f.closest('[class*="Slider"]'))) throw new Error('pad: refusing left/right on a slider');
        }
      }
      FocusNavController.DispatchVirtualButtonClick(code);
      await sleep(260);
    }
    return focused();
  }

  // The element that currently shows controller focus, per surface.
  function focused(alias) {
    const out = {};
    for (const p of popups()) {
      const short = p.name.replace(/_uid\d+$/, '').replace('valve.steam.gamepadui.', '');
      if (alias && !short.startsWith(alias) && !(alias === 'main' && /^VR$/.test(short))) continue;
      const f = p.win.document.querySelector('.gpfocus');
      if (f) out[short] = readable(f).slice(0, 4).join(' ') + (f.innerText ? ' "' + f.innerText.trim().slice(0, 30) + '"' : '');
    }
    return out;
  }

  // ------------------------------------------------ leave the UI as we found it
  // Every locked lab step calls mark() first and restore() last, so menus,
  // dialogs and bar popups it opened are closed again, and nothing the wearer
  // (or another agent) had open is touched.
  let cmx = null;
  function contextMenus() {
    if (!cmx) {
      let req = typeof lgsWebpackRequire === 'function' ? lgsWebpackRequire() : null;   // splices its probe record
      if (!req) {
        const chunks = window.webpackChunksteamui, rec = [[Symbol('lgs-cm')], {}, (r) => { req = r; }];
        chunks.push(rec);
        const i = chunks.indexOf(rec);
        if (i >= 0) chunks.splice(i, 1);          // webpack keeps pushed records for the context's life (REQ P1->P10)
      }
      try {   // records older helper builds left behind (they keep their closures alive)
        const chunks = window.webpackChunksteamui;
        for (let i = chunks.length - 1; i >= 0; i--) {
          const c = chunks[i], id = c && Array.isArray(c[0]) ? c[0][0] : null;
          if (typeof id === 'symbol' && id.description === 'lgs-cm') chunks.splice(i, 1);
        }
      } catch (_) { /* array gone */ }
      if (!req || !req.m) return [];
      for (const id of Object.keys(req.m)) {
        if (!req.m[id].toString().includes('GetContextMenuManagerFromWindow')) continue;
        const m = req(id);
        for (const k in m) if (m[k] && typeof m[k].GetContextMenuManager === 'function') { cmx = m[k]; break; }
        if (cmx) break;
      }
    }
    const out = [];
    const seen = new Set();
    if (!cmx) return out;
    for (const p of popups()) {
      let mg = null;
      try { mg = cmx.GetContextMenuManager(p.win); } catch (_) { /* no manager */ }
      if (!mg || seen.has(mg)) continue;
      seen.add(mg);
      try { for (const m of mg.GetVisibleMenus()) out.push([mg, m]); } catch (_) { /* none */ }
    }
    return out;
  }

  function openThings() {
    if (SINGLE) return { modals: [], menus: [], bars: [] };
    const inst = mainInstance();
    let bars = [];
    try { bars = [...(inst.m_setVRDashboardBarPopups || [])].filter((h) => { try { return h.BPopupOpen(); } catch (_) { return false; } }); } catch (_) { /* none */ }
    return { modals: [...inst.ModalManager.m_rgModals], menus: contextMenus(), bars };
  }

  function mark() {
    const o = openThings();
    window.__LGS_MARK = o;
    return { modals: o.modals.length, menus: o.menus.length, bars: o.bars.length };
  }

  async function restore() {
    if (SINGLE) return 0;
    const before = window.__LGS_MARK || { modals: [], menus: [], bars: [] };
    const now = openThings();
    let closed = 0;
    for (const [mg, menu] of now.menus.slice().reverse()) {
      if (before.menus.some(([, m]) => m === menu)) continue;
      try { if (typeof menu.Hide === 'function') menu.Hide(); else mg.HideMenu(menu); closed++; } catch (_) { /* gone */ }
    }
    const MM = mainInstance().ModalManager;
    for (const md of now.modals.slice().reverse()) {
      if (before.modals.includes(md)) continue;
      try { MM.RemoveModal(md); closed++; } catch (_) { /* gone */ }
    }
    for (const h of now.bars) {
      if (before.bars.includes(h)) continue;
      try { h.closePopup(); closed++; } catch (_) { /* gone */ }
    }
    if (closed) await sleep(350);
    window.__LGS_MARK = null;
    return closed;
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
    const ix = IX();
    for (const [k, mis] of ix.byKey) {
      if (!re.test(k)) continue;
      const hashes = [...new Set(mis.map((mi) => ix.mods[mi][k]))];
      for (const h of hashes) out.push('%{' + ix.tokenFor(h) + '}  ' + h);
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

  const INTERACTIVE = '.Focusable, .ButtonControl, [role=button], button, input, textarea, select, a[href], [tabindex]';
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

  // Phase 2 (P10, session 5): does el's own text run past what can be seen of it? Its own clip (overflow other
  // than visible, text-overflow, -webkit-line-clamp: content larger than its box), or a clipping ancestor, per axis
  // up to the first ancestor that scrolls on that axis (scrolling brings the text into view; a clip that cannot
  // scroll cuts it for good); with no scroller on an axis, the window (and C1a's glass cut, vertically) too. Only
  // el's own text nodes are measured (descendant elements have records of their own).
  function textCut(w, el, cs) {
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    if ((cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || clamp) && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) return true;
    let tx0 = Infinity, ty0 = Infinity, tx1 = -Infinity, ty1 = -Infinity;
    const rg = w.document.createRange();
    for (const t of el.childNodes) {
      if (t.nodeType !== 3 || !t.textContent.trim()) continue;
      rg.selectNodeContents(t);
      const q = rg.getBoundingClientRect();
      if (!(q.width > 0 && q.height > 0)) continue;
      tx0 = Math.min(tx0, q.left); ty0 = Math.min(ty0, q.top); tx1 = Math.max(tx1, q.right); ty1 = Math.max(ty1, q.bottom);
    }
    if (!(tx1 > tx0)) return false;
    const fs = parseFloat(cs.fontSize) || 16;
    const tolX = 2, tolY = Math.max(2, 0.3 * fs);        // glyph boxes overhang a tight line-height
    const G = window.__LGS_LAB && window.__LGS_LAB.gates;
    let x0 = -Infinity, y0 = -Infinity, x1 = Infinity, y1 = Infinity, stopX = false, stopY = false;
    for (let n = el.parentElement; n && n.nodeType === 1 && n !== w.document.documentElement && !(stopX && stopY); n = n.parentElement) {
      const c = w.getComputedStyle(n);
      const sX = /(auto|scroll)/.test(c.overflowX) && n.scrollWidth > n.clientWidth + 1;
      const sY = /(auto|scroll)/.test(c.overflowY) && n.scrollHeight > n.clientHeight + 1;
      const clip = c.clipPath && c.clipPath !== 'none';
      const cx = !stopX && ((c.overflowX !== 'visible' && !sX) || clip), cy = !stopY && ((c.overflowY !== 'visible' && !sY) || clip);
      if (cx || cy) {
        const q = n.getBoundingClientRect();
        const k = clip && G && G.clipBox ? G.clipBox(c, q) : { l: q.left, t: q.top, r: q.right, b: q.bottom };
        if (cx) { x0 = Math.max(x0, k.l); x1 = Math.min(x1, k.r); }
        if (cy) { y0 = Math.max(y0, k.t); y1 = Math.min(y1, k.b); }
      }
      if (sX) stopX = true;
      if (sY) stopY = true;
    }
    if (!stopX) { x0 = Math.max(x0, 0); x1 = Math.min(x1, w.innerWidth); }
    if (!stopY) {
      y0 = Math.max(y0, 0); y1 = Math.min(y1, w.innerHeight);
      const gh = parseFloat(w.getComputedStyle(w.document.documentElement).getPropertyValue('--lgs-c1a-gh'));
      if (gh > 0) y1 = Math.min(y1, gh);
    }
    return tx0 < x0 - tolX || tx1 > x1 + tolX || ty0 < y0 - tolY || ty1 > y1 + tolY;
  }

  function snap(alias) {
    const w = surface(alias);
    const doc = w.document;
    const out = {};
    const exCache = new Map();
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
      // Phase 2 (P10): scroll containers (gates' AUD does not report a sheet capped in size as SHRUNK)
      if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) rec.sc = true;
      // Phase 2 (P10, REQ C7->P10): a control that holds other controls is a pane, not a target (gates' AUD)
      if (kind === 'ctl' && el.querySelector(INTERACTIVE)) rec.nl = true;
      if (kind === 'ctl' && window.__LGS_LAB && window.__LGS_LAB.gates && window.__LGS_LAB.gates.ownHandler) {
        try { rec.act = window.__LGS_LAB.gates.ownHandler(el); } catch (_) { /* no fibers */ }
      }
      // Phase 2 (P10): PLAN 1.16 exemption of this element, for `gates` (audit ignores it). A scoped exemption
      // (exemptions.json "_scope", e.g. E-GRID: AUD waives SHRUNK only) carries its kinds and its own criterion,
      // and applies to the element its criterion judges (the cell), not to what the cell holds: a label run inside
      // a cell is text and is judged as text (session 5: a cut label must not pass on its cell's criterion). A
      // pending exemption (not in PLAN 1.16 yet) is matched only to report its criterion (rec.exPending).
      const g = window.__LGS_LAB && window.__LGS_LAB.gates;
      if (g) {
        try {
          const mx = g.exemptMatch ? g.exemptMatch(alias, el, 'aud', true) : null;
          const sc = mx && (g.exemptions()._scope || {})[mx.id];
          const scoped = !!(sc && Array.isArray(sc.aud));
          if (mx && scoped) {
            if (mx.host === el) {
              rec.exKinds = sc.aud; rec.ex = mx.id;
              rec.exc = g.exemptCriterion(alias, mx.id, mx.host, exCache);
              if (mx.pending) rec.exPending = mx.pending;
            } else if (kind === 'text' && sc.labels && g.labelFacts) {
              // a text run inside the cell: its own line (PLAN 1.16 "E-GRID (labels)", R2-15), judged in audDiff
              rec.labLine = String(sc.labels); rec.labKinds = sc.aud;
              try { rec.lab = g.labelFacts(alias, el, mx.host); } catch (e) { rec.lab = { error: String(e && e.message) }; }
              if (mx.pending) rec.exPending = mx.pending;
            }
          } else if (mx && !mx.pending) rec.ex = mx.id;
          else if (!mx && !g.exemptMatch) { const ex = g.exemptId(alias, el); if (ex) rec.ex = ex; }
        } catch (_) { /* none */ }
      }
      if (kind === 'text') {
        // Phase 2 (P10, session 5): is the whole string shown, and at what size? A text run's box may shrink
        // without any loss (a narrower box, larger type, the whole string visible: REQ C7->P10's /invites title);
        // what a reader loses is a cut string or smaller type. fs = font size, efs = the size as drawn (with any
        // transform scale), cut = the text runs past its own clip (ellipsis, overflow, line clamp) or past a
        // clipping ancestor that does not scroll (the window and C1a's glass cut too when nothing scrolls).
        rec.fs = parseFloat(cs.fontSize) || 0;
        const sx = el.offsetWidth ? r.width / el.offsetWidth : 1, sy = el.offsetHeight ? r.height / el.offsetHeight : 1;
        rec.efs = Math.round(rec.fs * Math.min(sx, sy) * 10) / 10;
        try { rec.cut = textCut(w, el, cs); } catch (_) { /* unknown: no waiver */ }
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

  // ---------------------------------------------------------------- perf
  // Scroll the biggest scrollable region of a surface for `ms`, one step per
  // animation frame, and report frame pacing. The surface must be rendering
  // (lab.py perf brings it to the front first).
  async function perf(alias, ms) {
    const w = surface(alias);
    const doc = w.document;
    let best = null, area = 0;
    for (const el of doc.querySelectorAll('*')) {
      if (el.scrollHeight - el.clientHeight < 200 && el.scrollWidth - el.clientWidth < 200) continue;
      const cs = w.getComputedStyle(el);
      if (!/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height > area) { area = r.width * r.height; best = el; }
    }
    const vertical = best ? best.scrollHeight - best.clientHeight >= best.scrollWidth - best.clientWidth : true;
    const start = best ? (vertical ? best.scrollTop : best.scrollLeft) : 0;
    const times = [];
    const t0 = w.performance.now();
    await new Promise((done) => {
      let dir = 1;
      const step = (t) => {
        times.push(t);
        if (best) {
          const max = vertical ? best.scrollHeight - best.clientHeight : best.scrollWidth - best.clientWidth;
          const cur = vertical ? best.scrollTop : best.scrollLeft;
          if (cur >= max - 8) dir = -1; else if (cur <= 8) dir = 1;
          if (vertical) best.scrollTop = cur + dir * 14; else best.scrollLeft = cur + dir * 14;
        }
        if (t - t0 < ms) w.requestAnimationFrame(step); else done();
      };
      w.requestAnimationFrame(step);
    });
    if (best) { if (vertical) best.scrollTop = start; else best.scrollLeft = start; }
    const d = [];
    for (let i = 1; i < times.length; i++) d.push(times[i] - times[i - 1]);
    d.sort((a, b) => a - b);
    const q = (p) => d.length ? Math.round(d[Math.min(d.length - 1, Math.floor(p * d.length))] * 10) / 10 : null;
    return {
      scroller: best ? readable(best).slice(0, 2).join(' ') : null,
      frames: times.length, fps: Math.round((times.length - 1) / ((times[times.length - 1] - times[0]) / 1000) * 10) / 10,
      median: q(0.5), p95: q(0.95), worst: q(0.999), long: d.filter((x) => x > 34).length,
      backdropFilters: [...doc.querySelectorAll('*')].filter((e) => { const v = w.getComputedStyle(e).backdropFilter; return v && v !== 'none'; }).length,
    };
  }

  window.__LGS_LAB = { v: 13, single: SINGLE, mark, restore, openThings, perf, surface, sel, q, qa, click, clickText, sleep, pad, focused, nav, back, route, outline, styles, classes, surfaces, readable, snap, diff, textCut };
  Object.defineProperty(window.__LGS_LAB, 'index', { get: IX, enumerable: true });
})();
