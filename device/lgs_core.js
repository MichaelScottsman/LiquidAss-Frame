// Liquid Glass Shell: in-memory theme injector for the Steam Frame's VR gamepadui.
//
// lgs.py evaluates this inside Steam's SharedJSContext (CEF devtools on
// 127.0.0.1:8080) as  (CORE)(payload, lgsBuildIndex, lgsLens, lgsIndexShared).
// Nothing is written to disk: the theme lives only in the running steamwebhelper,
// so a Steam restart or a reboot always brings back the stock UI.
//
// It only adds one <style> and one hidden SVG <defs> holder per window and a
// class on <html>. It never moves, removes or re-parents Steam's own nodes, so
// every control, route and gamepad focus path keeps working.
//
// "on" injects only when Steam's UI is ready and the class index is plausible
// (review R1 M1): otherwise it changes nothing and answers {waiting: true,
// index: {state: 'waiting', ...}}; lgs.py retries with backoff (2, 4, 8, then
// every 15 s, about 2 min) and logs each attempt. A short index is never cached.
(function lgsCore(payload, lgsBuildIndex, lgsLens, lgsIndexShared) {
  'use strict';
  const W = window;
  const IDS = { style: 'lgs-theme', defs: 'lgs-defs', toast: 'lgs-toast' };
  const ROOT_CLASS = 'lgs-on';
  const SWEEP_MS = 1500;
  const MIN_MODULES = typeof payload.minModules === 'number' ? payload.minModules : 200;
  const MAX_UNRESOLVED = 0.5;   // more than half the theme's distinct tokens unresolved: a partial harvest

  function popups() {
    const out = [];
    try {
      for (const p of g_PopupManager.m_mapPopups.values()) {
        try {
          const w = p.window;
          if (w && w.document) out.push({ name: p.m_strName, win: w });
        } catch (_) { /* closing */ }
      }
    } catch (_) { /* popup manager not ready */ }
    return out;
  }

  function mainDoc() {
    try {
      const inst = SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
      const w = inst && inst.BrowserWindow;
      if (w && w.document && w.document.body) return w.document;
    } catch (_) { /* fall through */ }
    const p = popups().find((x) => /^VR_uid/.test(x.name));
    return p && p.win.document && p.win.document.body ? p.win.document : null;
  }

  // What Steam still lacks for a sane injection ([] when ready).
  function notReady() {
    const miss = [];
    let store = null, pm = null;
    try { store = W.SteamUIStore; } catch (_) { /* not yet */ }
    if (!store || !store.WindowStore) miss.push('SteamUIStore');
    try { pm = W.g_PopupManager; } catch (_) { /* not yet */ }
    if (!pm || !pm.m_mapPopups) miss.push('g_PopupManager');
    if (!mainDoc()) miss.push('main window');
    const ch = W.webpackChunksteamui;
    if (!ch || typeof ch.push !== 'function' || ch.push === Array.prototype.push) miss.push('webpack runtime');
    return miss;
  }

  function indexInfo(ix, extra) {
    if (!ix || !ix.selector) return Object.assign({ state: 'none' }, extra || {});
    return Object.assign({
      state: ix.ok === false ? 'waiting' : 'ok', size: ix.size, factories: ix.factories, pure: ix.pure,
      built: ix.builtAt ? new Date(ix.builtAt).toISOString() : null, ms: ix.ms,
      current: typeof ix.current === 'function' ? ix.current() : null, why: ix.why || undefined,
    }, extra || {});
  }

  // ---------------------------------------------------------------- toast
  // The one thing this file shows users (lgs on/off, "+ > Liquid Glass", dial).
  // Panel glass card at the toast size (D2 §3.7: 320 x 76, radius 30), no
  // outline: the edge is the material's (class lgs-glass panel, E3 arcs while the
  // theme is on). Self-styled with theme tokens and literal fallbacks, because it
  // also shows "Off" after the theme is gone. Motion from P5's tokens (D2 §11:
  // materialize 250 ms + translate -8 -> 0 snappy; dematerialize 350 ms), a
  // 180 ms fade under Reduce Motion. Placed 16 px below the lowest control of the
  // window's top rows (toolbar, tabs, filters) in its column, never over them.
  const TOAST_HOLD_MS = 1900;
  function toastTop(doc) {
    let bottom = 0;
    try {
      const w = doc.documentElement.clientWidth || 1280;
      const L = w / 2 - 176, R = w / 2 + 176;
      for (const el of doc.querySelectorAll('button, input, [role="button"], [role="tab"], [tabindex], .Focusable')) {
        if (el.id === IDS.toast) continue;
        const q = el.getBoundingClientRect();
        if (q.width <= 0 || q.height <= 0 || q.height > 120 || q.top > 240 || q.bottom <= 0 || q.right < L || q.left > R) continue;
        bottom = Math.max(bottom, q.bottom);
      }
    } catch (_) { /* no layout */ }
    return Math.round(Math.min(260, Math.max(24, bottom + 16)));
  }
  const FB = {
    bg: 'linear-gradient(180deg, rgb(255 255 255 / .08) 0, rgb(255 255 255 / 0) 40%), rgb(28 30 40 / .78)',
    shade: 'inset 0 0 10px -1.5px rgb(0 0 0 / .16), inset 0 -2px 4px -1px rgb(0 0 0 / .12)',
    shadow: '0 10px 30px rgb(0 0 0 / .28)',
    b15: 'linear(0, .006 1.3%, .024 2.7%, .054 4.2%, .093 5.7%, .188 8.7%, .518 18.2%, .613 21.4%, .696 24.5%, .767 27.7%, .825 30.9%, .872 34.1%, .913 37.6%, .945 41.4%, .970 45.6%, .988 50.3%, 1.000 55.8%, 1.006 67.9%, 1)',
    b15cb: 'cubic-bezier(.311, .589, .077, 1.118)',
    matOut: 'linear(0, 0 55%, 1)',
  };
  function toast(text) {
    const doc = mainDoc();
    if (!doc || !doc.body) return false;
    const win = doc.defaultView || W;
    const old = doc.getElementById(IDS.toast);
    if (old) old.remove();
    const cs = (() => { try { return win.getComputedStyle(doc.documentElement); } catch (_) { return null; } })();
    const tok = (name, fb) => { const v = cs ? cs.getPropertyValue(name).trim() : ''; return v || fb; };
    const ms = (name, fb) => { const v = parseFloat(tok(name, '')); return isFinite(v) && v > 0 ? v : fb; };
    let reduce = false;
    try { reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { /* old engine */ }

    const parts = String(text || 'Liquid Glass').split(/\s+·\s+/);
    const t = doc.createElement('div');
    t.id = IDS.toast;
    t.className = 'lgs-glass';
    t.setAttribute('data-lgs-mat', 'panel');
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.style.cssText = [
      'position:fixed', `top:${toastTop(doc)}px`, 'left:0', 'right:0', 'margin:0 auto', 'z-index:2147483647', 'pointer-events:none',
      'box-sizing:border-box', 'width:var(--lgs-toast-w, 320px)', 'height:var(--lgs-toast-h, 76px)',
      'display:flex', 'align-items:center', 'gap:14px', 'padding:0 22px 0 14px',
      'border-radius:var(--lgs-r-toast, 30px)', 'border:0', 'outline:0',
      `background:var(--lgs-mat-panel-bg, ${FB.bg})`,
      // it floats over in-page content (not the room): frost what is behind, as thick glass does
      'backdrop-filter:var(--lgs-mat-thick-blur, blur(30px) saturate(1.5))',
      `box-shadow:var(--lgs-mat-panel-shade, ${FB.shade}), var(--lgs-shadow-25mm, ${FB.shadow})`,
      'color:var(--lgs-text-1, rgb(255 255 255 / .96))', 'font-family:var(--lgs-font, "Motiva Sans", Arial, sans-serif)',
      'text-align:left', 'white-space:nowrap',
    ].join(';');
    // 48 px circular app icon, drawn (device/icon.png's colours): no image to load.
    const icon = doc.createElement('div');
    icon.style.cssText = [
      'flex:none', 'width:48px', 'height:48px', 'border-radius:50%', 'position:relative', 'overflow:hidden',
      'background:radial-gradient(circle at 28% 30%, rgb(84 150 255 / .95), transparent 52%),'
        + 'radial-gradient(circle at 78% 58%, rgb(255 102 170 / .9), transparent 50%),'
        + 'radial-gradient(circle at 38% 82%, rgb(255 206 92 / .95), transparent 50%), rgb(20 21 28)',
    ].join(';');
    const pane = doc.createElement('div');
    pane.style.cssText = 'position:absolute;inset:11px;border-radius:9px;'
      + 'background:linear-gradient(180deg, rgb(255 255 255 / .42), rgb(255 255 255 / .12) 60%);'
      + 'box-shadow:inset 0 -2px 4px rgb(0 0 0 / .12)';
    icon.appendChild(pane);
    const body = doc.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;justify-content:center;min-width:0;overflow:hidden';
    const title = doc.createElement('div');
    title.textContent = parts[0];
    title.style.cssText = 'font-size:20px;font-weight:600;line-height:24px;letter-spacing:.2px;overflow:hidden;text-overflow:ellipsis';
    body.appendChild(title);
    if (parts.length > 1) {
      const sub = doc.createElement('div');
      sub.textContent = parts.slice(1).join(' · ');
      sub.style.cssText = 'font-size:18px;font-weight:500;line-height:22px;color:var(--lgs-text-2, rgb(255 255 255 / .70));overflow:hidden;text-overflow:ellipsis';
      body.appendChild(sub);
    }
    t.appendChild(icon);
    t.appendChild(body);
    doc.body.appendChild(t);

    const anim = (el, frames, o) => { try { return el.animate(frames, o); } catch (_) { return null; } };
    const ease = (v) => { try { if (win.CSS.supports('transition-timing-function', v)) return v; } catch (_) { /* old engine */ } return FB.b15cb; };
    let outMs;
    if (reduce) {
      const d = ms('--lgs-d-reduce', 180);
      anim(t, [{ opacity: 0 }, { opacity: 1 }], { duration: d, easing: 'linear', fill: 'backwards' });
      outMs = d;
      win.setTimeout(() => anim(t, [{ opacity: 1 }, { opacity: 0 }], { duration: d, easing: 'linear', fill: 'forwards' }), TOAST_HOLD_MS);
    } else {
      const matIn = ms('--lgs-d-mat-in', 250);
      const matOut = ms('--lgs-d-mat-out', 350);
      const snappy = ms('--lgs-d-snappy', 488);
      const s0 = 1 + Math.min(0.15, Math.max(0.01, 12 / 320));      // swell 1 + 12/maxSide (MO C3)
      // glass channel: coverage by ~28 %, swell settles by 92 % (lgs-mat-glass-in), on mat-in, linear
      anim(t, [{ opacity: 0, scale: String(s0) }, { opacity: 1, offset: 0.28 }, { scale: '1', offset: 0.92 }, { opacity: 1, scale: '1' }],
        { duration: matIn, easing: 'linear', fill: 'backwards' });
      // position rides snappy (lgs-toast-in: translate -8 px -> rest)
      anim(t, [{ translate: '0 -8px' }, { translate: '0 0' }], { duration: snappy, easing: ease(tok('--lgs-ease-b15', FB.b15)), fill: 'backwards' });
      // content channel: hidden until 35 %, then to rest (lgs-mat-content-in)
      for (const el of [icon, body]) {
        anim(el, [{ opacity: 0, filter: 'blur(8px)' }, { opacity: 0, filter: 'blur(8px)', offset: 0.35 }, { opacity: 1, filter: 'blur(0px)' }],
          { duration: matIn, easing: 'linear', fill: 'backwards' });
      }
      outMs = matOut;
      win.setTimeout(() => {
        for (const el of [icon, body]) {
          anim(el, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)', offset: 0.55 }, { opacity: 0, filter: 'blur(8px)' }],
            { duration: matOut, easing: 'linear', fill: 'forwards' });
        }
        anim(t, [{ opacity: 1, scale: '1' }, { opacity: 1, offset: 0.7 }, { opacity: 0, scale: String(s0) }],
          { duration: matOut, easing: ease(tok('--lgs-ease-mat-out', FB.matOut)), fill: 'forwards' });
      }, TOAST_HOLD_MS);
    }
    win.setTimeout(() => t.remove(), TOAST_HOLD_MS + outMs + 50);
    return true;
  }

  if (payload.op === 'off' || payload.op === 'status' || payload.op === 'toast') {
    const cur = W.__LGS;
    if (payload.op === 'status') return JSON.stringify(cur ? cur.status() : { enabled: false, index: indexInfo(W.__LGS_INDEX) });
    if (payload.op === 'toast') return toast(payload.text) ? 'ok' : 'no main window';
    if (cur) cur.disable(payload.quiet);
    return JSON.stringify({ enabled: false });
  }

  // op === 'on': (re)install, once Steam is ready and the index is plausible.
  const before = W.__LGS;
  const waiting = (index) => JSON.stringify({
    enabled: !!(before && before.state && before.state.enabled), waiting: true,
    version: before && before.state ? before.state.version : null, index,
  });
  const missing = notReady();
  if (missing.length) return waiting({ state: payload.final ? 'gave-up' : 'waiting', missing });
  let index = lgsIndexShared ? lgsIndexShared({ minModules: MIN_MODULES })
    : ((W.__LGS_INDEX && W.__LGS_INDEX.selector) ? W.__LGS_INDEX : (W.__LGS_INDEX = lgsBuildIndex()));
  if (index.ok === false) return waiting(indexInfo(index, { state: payload.final ? 'gave-up' : 'waiting' }));

  function resolveAll(ix) {
    const unresolved = new Set(), ambiguous = new Set(), tokens = new Set();
    const sub = (text) => text.replace(/%\{([^}]+)\}/g, (_, tok) => {
      tokens.add(tok.trim());
      const r = ix.selector(tok);
      if (r.sel) return r.sel;
      (r.err === 'ambiguous' ? ambiguous : unresolved).add(tok.trim());
      return '.lgs-' + r.err;
    });
    const css = sub(payload.css);
    // Optional lensing (theme/lens.json): per-element refraction filters for a
    // few floating capsules over in-page content.
    const lensSpecs = (payload.lens || []).map((spec) => Object.assign({}, spec, { sel: sub(spec.sel) }));
    return { css, lensSpecs, unresolved, ambiguous, tokens };
  }
  let R = resolveAll(index);
  // A plausible size but most tokens unresolved: Steam's bundle is still registering
  // (or the cache is stale). Drop the cache and wait, unless this is the last attempt.
  if (R.tokens.size >= 20 && R.unresolved.size > R.tokens.size * MAX_UNRESOLVED && !payload.final) {
    if (W.__LGS_INDEX === index) { try { delete W.__LGS_INDEX; } catch (_) { W.__LGS_INDEX = undefined; } }
    return waiting(indexInfo(index, { state: 'waiting', why: `${R.unresolved.size} of ${R.tokens.size} theme tokens unresolved` }));
  }

  // A previous instance is torn down silently first, so "reload" swaps the CSS
  // without leaving duplicates behind.
  if (before) { try { before.disable(true); } catch (_) { /* stale */ } }
  const { css, lensSpecs, unresolved, ambiguous } = R;
  R = null;
  const lens = lensSpecs.length && lgsLens ? lgsLens() : null;

  const state = {
    version: payload.version,
    enabled: true,
    since: Date.now(),
    css,
    timer: 0,
    created: null,
    applied: new Set(),
  };

  // Per-window scoping (perf, docs/phase2/perf.md §3.1). An area file that styles
  // exactly one pooled popup is left out of every other window's sheet: its rules
  // can never match there, but Chrome still evaluates their :has() / sibling
  // invalidation on every hover, focus and dwell class change. With 32-launcher.css
  // (the "+" list, surface barpopup) in main's sheet, every laser hover there was a
  // whole-document style recalc: in-step A/B, hover sweep 69 -> 88 fps, long frames
  // 54 -> 16. A rule that must also reach another window does not belong in a file
  // listed here.
  const SCOPED = [
    { file: '32-launcher.css', only: /\.barpopup\./ },
  ];
  const cssCache = new Map();   // scope signature -> css text
  function cssFor(name) {
    const n = String(name || '');
    // window.__LGS_NO_SCOPE = true (then __LGS.sweep()) gives every window the whole bundle: perf A/B only
    const sig = SCOPED.map((s) => (W.__LGS_NO_SCOPE === true || s.only.test(n) ? '1' : '0')).join('');
    let text = cssCache.get(sig);
    if (text === undefined) {
      if (sig.indexOf('0') < 0) text = state.css;
      else {
        const drop = new Set(SCOPED.filter((s, i) => sig[i] === '0').map((s) => s.file));
        text = state.css.split(/(?=\/\* [0-9A-Za-z_.-]+\.css \*\/\n)/)
          .filter((part) => { const m = /^\/\* ([0-9A-Za-z_.-]+\.css) \*\//.exec(part); return !(m && drop.has(m[1])); })
          .join('');
      }
      cssCache.set(sig, text);
    }
    return { text, key: state.version + ':' + sig };
  }

  function apply(doc, name) {
    if (!doc || !doc.head || !doc.body || !doc.documentElement) return false;
    const root = doc.documentElement;
    if (!root.classList.contains(ROOT_CLASS)) root.classList.add(ROOT_CLASS);
    const want = cssFor(name);
    let st = doc.getElementById(IDS.style);
    // The sheet's identity is its key (version + scope), not its ~0.9 MB text:
    // reading textContent every sweep built and compared that string for each
    // window every 1.5 s.
    if (!st) {
      st = doc.createElement('style');
      st.id = IDS.style;
      st.textContent = want.text;
      st.setAttribute('data-lgs-key', want.key);
      doc.head.appendChild(st);
    } else if (st.getAttribute('data-lgs-key') !== want.key) {
      st.textContent = want.text;
      st.setAttribute('data-lgs-key', want.key);
    }
    // Steam appends route CSS chunks as they load; stay last so equal-specificity
    // rules resolve in the theme's favour.
    if (doc.head.lastElementChild !== st) doc.head.appendChild(st);
    if (payload.svg && !doc.getElementById(IDS.defs)) {
      const holder = doc.createElement('div');
      holder.id = IDS.defs;
      holder.setAttribute('aria-hidden', 'true');
      holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
      holder.innerHTML = payload.svg;
      doc.body.appendChild(holder);
    }
    return true;
  }

  function strip(doc) {
    if (!doc || !doc.documentElement) return;
    doc.documentElement.classList.remove(ROOT_CLASS);
    for (const id of [IDS.style, IDS.defs]) {
      const n = doc.getElementById(id);
      if (n) n.remove();
    }
  }

  function sweep() {
    if (!state.enabled) return;
    for (const { name, win } of popups()) {
      try { if (apply(win.document, name)) state.applied.add(name); } catch (_) { /* window closing */ }
      if (lens) {
        for (const spec of lensSpecs) {
          try {
            for (const el of win.document.querySelectorAll(spec.sel)) lens.track(win.document, el, spec);
          } catch (_) { /* bad selector or closing window */ }
        }
      }
    }
    if (lens) lens.sweep();
  }

  function disable(quiet) {
    state.enabled = false;
    clearInterval(state.timer);
    // The runtime (device/rt) never outlives the theme. lgs.py removes it first
    // and awaits the report; this covers any other caller of disable().
    try { if (W.__LGS_RT && typeof W.__LGS_RT.teardown === 'function') W.__LGS_RT.teardown('theme off'); } catch (_) { /* stale */ }
    try { if (state.createdHandle) state.createdHandle.Unregister(); } catch (_) { /* gone */ }
    state.createdHandle = null;
    purgeStale(null);
    if (lens) lens.stop();
    for (const { win } of popups()) {
      try { strip(win.document); if (lens) lens.strip(win.document); } catch (_) { /* closing */ }
    }
    if (W.__LGS === api) delete W.__LGS;
    if (!quiet) toast('Liquid Glass  ·  Off');
  }

  function status() {
    const docs = popups().map(({ name, win }) => {
      let on = false;
      try { on = !!win.document.getElementById(IDS.style); } catch (_) { /* closing */ }
      return name.replace(/_uid\d+$/, '') + (on ? '' : ' (pending)');
    });
    return {
      enabled: state.enabled,
      version: state.version,
      since: new Date(state.since).toISOString(),
      cssBytes: state.css.length,
      classModules: index.size,
      index: indexInfo(index, { cached: W.__LGS_INDEX === index }),
      windows: docs,
      lensed: lens ? lens.count() : 0,
      unresolved: [...unresolved],
      ambiguous: [...ambiguous],
    };
  }

  const api = { disable, status, toast, sweep, state };
  W.__LGS = api;

  // Before the fix below, every "on" left its popup-created callback behind
  // (the list is a CallbackList, not an array, so the old splice never ran).
  // Drop those stale, inert copies so the subscriber count stays flat.
  function purgeStale(keep) {
    try {
      const v = g_PopupManager.m_rgPopupCreatedCallbacks.m_vecCallbacks;
      if (!Array.isArray(v)) return 0;
      let n = 0;
      for (let i = v.length - 1; i >= 0; i--) {
        const f = v[i];
        if (f !== keep && typeof f === 'function' && String(f) === '() => setTimeout(sweep, 0)') { v.splice(i, 1); n++; }
      }
      return n;
    } catch (_) { return 0; }
  }
  state.created = () => setTimeout(sweep, 0);
  state.purged = purgeStale(null);
  try { state.createdHandle = g_PopupManager.AddPopupCreatedCallback(state.created); } catch (_) { /* sweep covers it */ }
  sweep();
  state.timer = setInterval(sweep, SWEEP_MS);
  if (!payload.quiet) toast('Liquid Glass  ·  On');
  return JSON.stringify(status());
});
