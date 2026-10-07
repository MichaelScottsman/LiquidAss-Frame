// Glass Shell runtime module "keyboard" (C4b, T2 + T3; flag wp.c4b). PLAN §2.4 C4b,
// CTL §12.3 (echo row, masking), §12.5 (context Enter label).
//
// Echo row (T2). While Steam's VR keyboard is shown for the main window, a display-only
// row in the keyboard quad shows the focused field's name and its text with the caret
// (dots and a lock for secret fields, C-D17). Source of truth: the main window's
// document.activeElement, read on input / selection / focus events. It never writes to
// the field, never dispatches keys and never takes focus. The row is one node
// (.lgs-kbe, pointer-events none) in the keyboard window's body; html.lgs-kb-echo on that
// window lets 36-keyboard.css move the key block down 41 kb px into the top band (hit
// areas move with their keys) unless an IME row, the emoji layout or Steam's own text
// buffer is shown (then no echo and no move, C-D18).
//
// Enter label (T3). Steam renders the Enter key's text from the keyboard manager's
// GetEnterKeyLabel() (the active element's strEnterKeyLabel). Where Steam gives none,
// a wrapper on that prototype method (found by source text through rt.react.find,
// restored on removal) supplies one by field type: secret -> "Done", URL -> "Go",
// chat compose -> "Send", search -> "Search". Enter still sends Enter. Strings are
// Steam's own (#Button_Done, #Button_Go) or English for en* UI languages only (PLAN §1.15).
//
// Test hook (C11, C11b): __LGS_RT.kb.echoTest(text, {name, mask}) draws the echo with
// that text (display only; no field touched); echoTest(null) returns to live.
__LGS_RT.define({
  name: 'keyboard',
  flag: 'wp.c4b',
  install(rt) {
    const MAIN_KEY = 'valve.steam.gamepadui.main';
    const HTML_CLASS = 'lgs-kb-echo';
    const MAX_CHARS = 160;
    const SECRET_AC = /^(one-time-code|current-password|new-password)$/i;
    const SECRET_HINT = /pass(word|code)?|\bpin\b|secret|guard|otp/i;
    const TEXT_TYPES = /^(text|search|url|email|tel|number|password)$/i;

    let kbEntry = null;      // the keyboard window entry
    let node = null;         // .lgs-kbe
    let test = null;         // echoTest override {text, name, mask}
    let pending = false;
    let vrStore;             // Steam's VR store (m_VRKeyboardState), undefined = not looked up
    let lastSig = '';

    const R = () => (rt.has && rt.has('react') && rt.react) || null;
    const en = () => {
      try { const r = R(); const l = r && r.ui && r.ui.lang ? r.ui.lang() : 'en'; return /^en/i.test(String(l || 'en')); } catch (e) { return true; }
    };
    const text = (token, english) => {
      try { const r = R(); if (r && r.ui && r.ui.text) return r.ui.text(token, english); } catch (e) { /* fall through */ }
      return en() ? english : null;
    };

    // ---- the field ------------------------------------------------------------------
    function mainWin() {
      const m = rt.windows.main && rt.windows.main();
      return m && m.win && !m.win.closed ? m : null;
    }
    function field() {
      const m = mainWin();
      if (!m) return null;
      const el = m.doc.activeElement;
      if (!el) return null;
      if (el.tagName === 'TEXTAREA') return el;
      if (el.tagName === 'INPUT' && TEXT_TYPES.test(el.type || 'text')) return el;
      return null;
    }
    function inDialog(el) {
      return !!(el.closest && el.closest('[role="dialog"], .ModalPosition, [class*="ModalPosition"], [class*="GamepadDialogContent"]'));
    }
    function masked(el) {
      try {
        if ((el.type || '').toLowerCase() === 'password') return true;
        const cs = el.ownerDocument.defaultView.getComputedStyle(el);
        const ts = cs.getPropertyValue('-webkit-text-security');
        if (ts && ts !== 'none') return true;
        if (SECRET_AC.test(el.getAttribute('autocomplete') || '')) return true;
        const im = (el.getAttribute('inputmode') || '').toLowerCase();
        if ((im === 'numeric' || im === 'tel') && inDialog(el)) return true;
        if (el.closest && el.closest('[data-lgs-secret-dialog]')) return true;
        const hint = [el.name, el.id, el.getAttribute('aria-label'), el.placeholder].join(' ');
        if (SECRET_HINT.test(hint)) return true;
      } catch (e) { return true; }   // unsure: never show characters
      return false;
    }
    function isChat(el) {
      return el.tagName === 'TEXTAREA' && !!(el.closest && el.closest('[class*="chat" i], [class*="Chat"]'));
    }
    function isSearch(el) {
      return (el.type || '').toLowerCase() === 'search' || !!(el.closest && el.closest('#header, [class*="SearchField"], [class*="SearchInput"]'));
    }
    function fieldName(el) {
      const own = (el.getAttribute('aria-label') || el.placeholder || '').trim();
      if (own) return own.slice(0, 40);
      if (isSearch(el)) return text('#Button_Search', 'Search');
      if (isChat(el)) return text('#Chat_Message', 'Message');
      const dlg = el.closest && el.closest('[role="dialog"]');
      const title = dlg && dlg.querySelector('[class*="DialogHeader"], h1, h2');
      if (title && title.textContent) return title.textContent.trim().slice(0, 40);
      return '';
    }

    // ---- is the keyboard open for the main window? ----------------------------------
    function openForMain() {
      if (vrStore === undefined) {
        vrStore = null;
        try {
          const r = R();
          if (r && r.find) {
            const res = r.find({ C4bVrStore: [['m_VRKeyboardState', 'OnKeyboardStatus'], (ex, u) => u.pick(ex, (v) => v && typeof v === 'object' && 'm_VRKeyboardState' in v)] });
            vrStore = (res && res.mods && res.mods.C4bVrStore) || null;
          }
        } catch (e) { vrStore = null; }
      }
      try {
        const st = vrStore && vrStore.m_VRKeyboardState;
        if (st && st.m_bIsOpen && st.m_sOpenForOverlayKey) return st.m_sOpenForOverlayKey === MAIN_KEY;
      } catch (e) { /* unknown: assume main */ }
      return true;
    }

    // ---- drawing ----------------------------------------------------------------------
    function span(doc, cls, s) {
      const e = doc.createElement('span');
      if (cls) e.className = cls;
      if (s != null) e.textContent = s;
      return e;
    }
    function ensureNode() {
      if (!kbEntry || !kbEntry.doc || !kbEntry.doc.body) return null;
      if (node && node.ownerDocument === kbEntry.doc && node.isConnected) return node;
      const doc = kbEntry.doc;
      node = doc.createElement('div');
      node.className = 'lgs-kbe';
      node.setAttribute('aria-hidden', 'true');
      node.setAttribute('data-lgs-kbe', 'off');
      node.appendChild(span(doc, 'lgs-kbe-lbl'));
      node.appendChild(span(doc, 'lgs-kbe-txt'));
      doc.body.appendChild(node);
      return node;
    }
    function setEcho(on) {
      if (!kbEntry || !kbEntry.html) return;
      kbEntry.html.classList.toggle(HTML_CLASS, !!on);
      if (node) node.setAttribute('data-lgs-kbe', on ? 'on' : 'off');
    }
    function model() {
      if (test) {
        const v = String(test.text == null ? '' : test.text);
        return { name: test.name == null ? text('#Button_Search', 'Search') : test.name, mask: !!test.mask, search: test.name == null, value: v, s: v.length, e: v.length, ph: '' };
      }
      if (!openForMain()) return null;
      const el = field();
      if (!el) return null;
      const v = String(el.value || '');
      let s = v.length, e = v.length;
      try { if (typeof el.selectionStart === 'number') { s = el.selectionStart; e = el.selectionEnd; } } catch (err) { /* number inputs */ }
      const name = fieldName(el);
      const ph = (el.placeholder || '').trim();
      return { name, mask: masked(el), search: isSearch(el), value: v, s, e, ph: ph && ph !== name ? ph : '' };
    }
    // PLAN §1.16 E-KEY: the keys keep Steam's geometry (60 x 47 hit areas); the lab's size
    // sweep judges them by CTL C10 instead (contracts/lab.md §6 rule 1). Only the key grid
    // is marked, so the platter and the echo are still judged. Re-applied on every render:
    // Steam re-creates the grid when the layout changes (emoji, symbols)
    function markKeys() {
      try {
        const g = kbEntry.doc.querySelector(rt.sel('%{Modal>Keyboard}'));
        if (g && g.getAttribute('data-lgs-exempt') !== 'E-KEY') g.setAttribute('data-lgs-exempt', 'E-KEY');
      } catch (e) { /* token missing: nothing marked */ }
    }
    function render() {
      pending = false;
      if (!kbEntry) return;
      markKeys();
      // computed whether or not the keyboard is shown: the field takes focus before Steam
      // shows the keyboard, so the key block is already in place when it appears
      const m = model();
      if (!m) { setEcho(false); lastSig = ''; return; }
      const n = ensureNode();
      if (!n) return;
      const sig = JSON.stringify(m);
      setEcho(true);
      if (sig === lastSig) return;
      lastSig = sig;
      const doc = n.ownerDocument;
      n.setAttribute('data-lgs-kbe-mask', m.mask ? '1' : '0');
      n.setAttribute('data-lgs-kbe-kind', m.mask ? 'secret' : m.search ? 'search' : 'text');
      const lbl = n.firstChild, txt = n.lastChild;
      lbl.textContent = m.name || '';
      txt.textContent = '';
      const val = m.mask ? '•'.repeat(Math.min(m.value.length, 32)) : m.value;
      const s = m.mask ? Math.min(m.s, 32) : m.s, e = m.mask ? Math.min(m.e, 32) : m.e;
      if (!val) {
        txt.appendChild(span(doc, 'lgs-kbe-caret'));
        if (m.ph) txt.appendChild(span(doc, 'lgs-kbe-ph', m.ph));
      } else {
        const lo = Math.max(0, s - MAX_CHARS), hi = Math.min(val.length, e + 40);
        const cls = m.mask ? 'lgs-kbe-dots' : '';
        const pre = val.slice(lo, s), sel = val.slice(s, e), post = val.slice(e, hi);
        if (pre) txt.appendChild(span(doc, cls, pre));
        if (sel) txt.appendChild(span(doc, 'lgs-kbe-sel' + (cls ? ' ' + cls : ''), sel));
        else txt.appendChild(span(doc, 'lgs-kbe-caret'));
        if (post) txt.appendChild(span(doc, cls, post));
      }
      // long text: show the end around the caret, fade the left edge (CSS)
      txt.removeAttribute('data-lgs-kbe-over');
      if (txt.scrollWidth > txt.clientWidth + 1) txt.setAttribute('data-lgs-kbe-over', '');
    }
    function schedule() {
      if (pending) return;
      pending = true;
      rt.setTimeout(render, 16);
    }

    // ---- windows and events -------------------------------------------------------------
    rt.windows.track((entry) => {
      if (entry.kind === 'keyboard') {
        kbEntry = entry;
        schedule();
        return () => {
          try { entry.doc.querySelectorAll('[data-lgs-exempt="E-KEY"]').forEach((el) => el.removeAttribute('data-lgs-exempt')); } catch (e) { /* closed */ }
          try { entry.html && entry.html.classList.remove(HTML_CLASS); } catch (e) { /* closed */ }
          try { if (node && node.ownerDocument === entry.doc) node.remove(); } catch (e) { /* closed */ }
          if (kbEntry === entry) { kbEntry = null; node = null; lastSig = ''; }
        };
      }
      if (entry.kind === 'main') {
        const doc = entry.doc;
        const opts = { capture: true, passive: true };
        const offs = ['input', 'focusin', 'focusout', 'keyup', 'compositionupdate', 'compositionend', 'click']
          .map((t) => rt.listen(doc, t, schedule, opts));
        offs.push(rt.listen(doc, 'selectionchange', schedule, { passive: true }));
        return () => offs.forEach((off) => { try { off(); } catch (e) { /* gone */ } });
      }
      return undefined;
    });
    rt.windows.onShow((entry) => { if (entry.kind === 'keyboard') { lastSig = ''; schedule(); } });
    rt.windows.onHide((entry) => { if (entry.kind === 'keyboard') schedule(); });

    // ---- T3: the context Enter label ------------------------------------------------------
    let mgrProto = null, origEnter = null, ourEnter = null;
    function enterLabel() {
      const el = field();
      if (!el) return null;
      if (masked(el)) return text('#Button_Done', 'Done');
      const t = (el.type || '').toLowerCase(), im = (el.getAttribute('inputmode') || '').toLowerCase();
      if (t === 'url' || im === 'url') return text('#Button_Go', 'Go');
      if (isChat(el)) return text('#Button_Send', 'Send');
      if (isSearch(el)) return text('#Button_Search', 'Search');
      return null;
    }
    try {
      const r = R();
      if (r && r.find) {
        const res = r.find({ C4bKbMgr: [['GetEnterKeyLabel', 'RotateKeyboardLocation'], (ex, u) => u.pick(ex, (v) => typeof v === 'function' && v.prototype && typeof v.prototype.GetEnterKeyLabel === 'function')] });
        const C = res && res.mods && res.mods.C4bKbMgr;
        if (C && C.prototype && typeof C.prototype.GetEnterKeyLabel === 'function') {
          mgrProto = C.prototype;
          origEnter = mgrProto.GetEnterKeyLabel;
          ourEnter = function lgsEnterKeyLabel() {
            const steam = origEnter.apply(this, arguments);
            if (steam) return steam;
            try { return enterLabel() || steam; } catch (e) { return steam; }
          };
          mgrProto.GetEnterKeyLabel = ourEnter;
          rt.cleanup(() => {
            if (mgrProto && mgrProto.GetEnterKeyLabel === ourEnter) mgrProto.GetEnterKeyLabel = origEnter;
            mgrProto = null;
          });
        } else {
          rt.log('enter label: keyboard manager not found; Steam\'s label kept');
        }
      }
    } catch (e) {
      rt.warn('enter label: wrapper not installed', String(e && e.message || e));
    }

    const api = {
      echoTest(t, opts) {
        test = t == null ? null : Object.assign({ text: t }, opts || {});
        lastSig = '';
        render();
        return api.state();
      },
      state() {
        return {
          echo: !!(kbEntry && kbEntry.html && kbEntry.html.classList.contains(HTML_CLASS)),
          text: node ? node.lastChild.textContent : null,
          name: node ? node.firstChild.textContent : null,
          mask: node ? node.getAttribute('data-lgs-kbe-mask') === '1' : null,
          enterWrapped: !!(mgrProto && mgrProto.GetEnterKeyLabel === ourEnter),
          test: !!test,
        };
      },
    };
    try { rt.expose('kb', api); } catch (e) { rt.warn('expose kb refused', String(e && e.message || e)); }
    return api;
  },
  remove() {
    // every class, node, listener and the prototype wrapper are undone through rt.windows.track
    // cleanups and rt.cleanup; nothing else to undo
    return {};
  },
});
