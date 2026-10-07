// Liquid Glass Shell for SteamVR's own web UI (vrwebhelper on 127.0.0.1:8090:
// systemui with the window frame controls and Now Playing, controller
// bindings, message overlays...). Each SteamVR page is a separate document,
// so lgs_vr.py evaluates this in every page as  (CORE)(payload, lgsBuildIndex)
// and re-checks periodically while the theme is on. Memory only, like the
// Steam side: nothing is written to SteamVR's files.
(function lgsVrCore(payload, lgsBuildIndex) {
  'use strict';
  const W = window;
  const ROOT_CLASS = 'lgs-on';
  const STYLE_ID = 'lgs-theme';

  if (payload.op === 'status') {
    const st = W.__LGS_VR ? W.__LGS_VR.status() : { enabled: false };
    st.scripts = W.__LGS_VRX ? Object.keys(W.__LGS_VRX) : [];
    return JSON.stringify(st);
  }
  if (payload.op === 'off') {
    if (W.__LGS_VR) W.__LGS_VR.disable();
    // The daemon's page scripts (device/vr/<page>.<name>.js) go with the theme.
    const R = W.__LGS_VRX;
    let scripts = 0;
    if (R) {
      for (const k of Object.keys(R)) {
        try { if (R[k].api && typeof R[k].api.remove === 'function') R[k].api.remove(); } catch (_) { /* its bug */ }
        delete R[k];
        scripts++;
      }
      delete W.__LGS_VRX;
    }
    return JSON.stringify({ enabled: false, scriptsRemoved: scripts });
  }
  // Same theme already applied: just make sure it is still in place and last.
  if (W.__LGS_VR && W.__LGS_VR.version === payload.version) return W.__LGS_VR.apply() ? 'ok' : 'retry';
  if (W.__LGS_VR) W.__LGS_VR.disable();

  let index = null;
  try {
    index = (W.__LGS_INDEX && W.__LGS_INDEX.selector) ? W.__LGS_INDEX : (W.__LGS_INDEX = lgsBuildIndex());
  } catch (_) { /* page without webpack: tokens stay unresolved */ }
  const unresolved = new Set();
  const ambiguous = new Set();

  // UI fonts. SteamVR pages' CSP (default-src 'self' 'unsafe-eval', no font-src)
  // blocks data: URLs in @font-face (NetworkError), so every @font-face whose
  // src is a data:font/woff2 URL leaves the CSS and becomes a binary FontFace
  // (no fetch, so the CSP does not apply). Built once per payload version;
  // apply() keeps them in document.fonts, disable() deletes them (REQ P4->P8).
  const faces = [];
  const fontErrors = [];
  const cssIn = payload.css.replace(/@font-face\s*\{([^{}]*)\}/g, (all, body) => {
    const src = /src\s*:\s*url\(\s*(["']?)data:font\/woff2;base64,([A-Za-z0-9+/=\s]+)\1\s*\)[^;]*;?/i.exec(body);
    if (!src || typeof W.FontFace !== 'function') return all;
    const rest = body.replace(src[0], ';');
    const desc = (name) => {
      const m = new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;]+)', 'i').exec(rest);
      return m ? m[1].trim() : null;
    };
    const family = (desc('font-family') || '').replace(/^(["'])(.*)\1$/, '$2');
    if (!family) return all;
    try {
      const bin = W.atob(src[2].replace(/\s+/g, ''));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const d = {};
      for (const [prop, key] of [['font-weight', 'weight'], ['font-style', 'style'], ['font-stretch', 'stretch'],
        ['unicode-range', 'unicodeRange'], ['font-display', 'display']]) {
        const v = desc(prop);
        if (v) d[key] = v;
      }
      faces.push(new W.FontFace(family, bytes.buffer, d));
      return '/* @font-face "' + family.replace(/\*\//g, '') + '": a binary FontFace in this page (CSP) */';
    } catch (e) {
      fontErrors.push(family + ': ' + String(e && e.message || e));
      return all;
    }
  });

  const css = cssIn.replace(/%\{([^}]+)\}/g, (_, tok) => {
    if (!index) { unresolved.add(tok.trim()); return '.lgs-unresolved'; }
    const r = index.selector(tok);
    if (r.sel) return r.sel;
    (r.err === 'ambiguous' ? ambiguous : unresolved).add(tok.trim());
    return '.lgs-' + r.err;
  });

  function apply() {
    const doc = W.document;
    if (!doc.head || !doc.documentElement) return false;
    doc.documentElement.classList.add(ROOT_CLASS);
    let st = doc.getElementById(STYLE_ID);
    if (!st) {
      st = doc.createElement('style');
      st.id = STYLE_ID;
      st.textContent = css;
    } else if (st.textContent !== css) {
      st.textContent = css;
    }
    if (doc.head.lastElementChild !== st) doc.head.appendChild(st);
    if (doc.fonts) {
      for (const ff of faces) {
        try { if (!doc.fonts.has(ff)) doc.fonts.add(ff); } catch (_) { /* never block the CSS */ }
      }
    }
    return true;
  }

  function disable() {
    const doc = W.document;
    doc.documentElement.classList.remove(ROOT_CLASS);
    const st = doc.getElementById(STYLE_ID);
    if (st) st.remove();
    if (doc.fonts) {
      for (const ff of faces) {
        try { doc.fonts.delete(ff); } catch (_) { /* already gone */ }
      }
    }
    if (W.__LGS_VR === api) delete W.__LGS_VR;
  }

  function status() {
    return {
      enabled: true, version: payload.version, page: W.document.title, cssBytes: css.length,
      classModules: index ? index.size : 0, unresolved: [...unresolved], ambiguous: [...ambiguous],
      fonts: faces.map((f) => f.family + ' ' + f.weight + ' ' + f.status), fontErrors: fontErrors.slice(),
    };
  }

  const api = { version: payload.version, apply, disable, status };
  W.__LGS_VR = api;
  apply();
  return 'applied';
});
