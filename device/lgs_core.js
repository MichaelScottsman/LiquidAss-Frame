// Liquid Glass Shell: in-memory theme injector for the Steam Frame's VR gamepadui.
//
// lgs.py evaluates this inside Steam's SharedJSContext (CEF devtools on
// 127.0.0.1:8080) as  (CORE)(payload, lgsBuildIndex, lgsLens).  Nothing is written to
// disk: the theme lives only in the running steamwebhelper, so a Steam restart
// or a reboot always brings back the stock UI.
//
// It only adds one <style> and one hidden SVG <defs> holder per window and a
// class on <html>. It never moves, removes or re-parents Steam's own nodes, so
// every control, route and gamepad focus path keeps working.
(function lgsCore(payload, lgsBuildIndex, lgsLens) {
  'use strict';
  const W = window;
  const IDS = { style: 'lgs-theme', defs: 'lgs-defs', toast: 'lgs-toast' };
  const ROOT_CLASS = 'lgs-on';
  const SWEEP_MS = 1500;

  if (payload.op === 'off' || payload.op === 'status' || payload.op === 'toast') {
    const cur = W.__LGS;
    if (payload.op === 'status') return JSON.stringify(cur ? cur.status() : { enabled: false });
    if (payload.op === 'toast') { if (cur) cur.toast(payload.text); return 'ok'; }
    if (cur) cur.disable(payload.quiet);
    return JSON.stringify({ enabled: false });
  }

  // op === 'on': (re)install. A previous instance is torn down silently first,
  // so "reload" swaps the CSS without leaving duplicates behind.
  if (W.__LGS) { try { W.__LGS.disable(true); } catch (_) { /* stale */ } }

  const index = (W.__LGS_INDEX && W.__LGS_INDEX.selector) ? W.__LGS_INDEX : (W.__LGS_INDEX = lgsBuildIndex());
  const unresolved = new Set();
  const ambiguous = new Set();
  const css = payload.css.replace(/%\{([^}]+)\}/g, (_, tok) => {
    const r = index.selector(tok);
    if (r.sel) return r.sel;
    (r.err === 'ambiguous' ? ambiguous : unresolved).add(tok.trim());
    return '.lgs-' + r.err;
  });

  // Optional lensing (theme/lens.json): per-element refraction filters for a
  // few floating capsules over in-page content.
  const lensSpecs = (payload.lens || []).map((spec) => {
    const sel = spec.sel.replace(/%\{([^}]+)\}/g, (_, tok) => {
      const r = index.selector(tok);
      if (r.sel) return r.sel;
      (r.err === 'ambiguous' ? ambiguous : unresolved).add(tok.trim());
      return '.lgs-' + r.err;
    });
    return Object.assign({}, spec, { sel });
  });
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
      if (w && w.document) return w.document;
    } catch (_) { /* fall through */ }
    const p = popups().find((x) => /^VR_uid/.test(x.name));
    return p ? p.win.document : null;
  }

  function apply(doc) {
    if (!doc || !doc.head || !doc.body || !doc.documentElement) return false;
    const root = doc.documentElement;
    if (!root.classList.contains(ROOT_CLASS)) root.classList.add(ROOT_CLASS);
    let st = doc.getElementById(IDS.style);
    if (!st) {
      st = doc.createElement('style');
      st.id = IDS.style;
      st.textContent = state.css;
      doc.head.appendChild(st);
    } else if (st.textContent !== state.css) {
      st.textContent = state.css;
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
      try { if (apply(win.document)) state.applied.add(name); } catch (_) { /* window closing */ }
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

  function toast(text) {
    const doc = mainDoc();
    if (!doc || !doc.body) return;
    const old = doc.getElementById(IDS.toast);
    if (old) old.remove();
    const t = doc.createElement('div');
    t.id = IDS.toast;
    t.textContent = text;
    // Self-contained styling: it must also look right after the theme is removed.
    t.style.cssText = [
      'position:fixed', 'left:50%', 'top:28px', 'z-index:2147483647', 'pointer-events:none',
      'transform:translate(-50%,-12px) scale(.94)', 'opacity:0',
      'transition:transform 260ms cubic-bezier(.2,.9,.25,1.2),opacity 200ms ease',
      'padding:14px 30px', 'border-radius:999px',
      'font:600 22px/1.2 "Motiva Sans",Arial,sans-serif', 'letter-spacing:.2px', 'color:#fff',
      'background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.06)) ,rgba(38,40,48,.62)',
      'backdrop-filter:blur(24px) saturate(1.7)',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 0 0 1px rgba(255,255,255,.18),0 10px 34px rgba(0,0,0,.35)',
    ].join(';');
    doc.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translate(-50%,0) scale(1)';
    }));
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translate(-50%,-8px) scale(.97)'; }, 1700);
    setTimeout(() => t.remove(), 2100);
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
