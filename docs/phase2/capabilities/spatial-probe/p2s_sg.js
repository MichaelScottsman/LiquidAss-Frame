// Phase-2 spatial capability probe (systemui page). Builds test nodes under its
// own root <div id="p2s-root"> in <vsg-app>, separate from lgs_sg.js.
//   (SOURCE)({ items: [...], ttlMs })  -> installs window.__P2S
// item: { name, parentKey, at:[u,v], xf:"x y z" | {channel,interp,from,to},
//         rot:"w x y z", wrap:[{type, props}], panel:{...props} }
// __P2S.clear() removes everything and pushes; a TTL timer clears too, so a
// dead driver never leaves nodes behind.
(function p2s(spec) {
  'use strict';
  const W = window;
  if (W.__P2S) { try { W.__P2S.clear(); } catch (_) { /* stale */ } }
  let req = null;
  W.webpackChunkvrwebui.push([[Symbol('p2s')], {}, (r) => { req = r; }]);
  let push = null, retire = null;
  const RET = /^function\s*\w*\((\w+)\)\{\w+\.push\(\1\),\w+\(\)\}$/;
  for (const id of ['5723', ...Object.keys(req.m)]) {
    let src; try { src = String(req.m[id]); } catch (_) { continue; }
    if (src.indexOf('"update_scene_graph"') < 0) continue;
    const ex = req(id);
    for (const k of Object.keys(ex)) {
      try {
        if (typeof ex[k] !== 'function') continue;
        const f = String(ex[k]);
        if (f.indexOf('update_scene_graph') >= 0) push = ex[k]; else if (RET.test(f)) retire = ex[k];
      } catch (_) { /* skip */ }
    }
    if (push) break;
  }
  const allSgids = [];
  const app = document.querySelector('vsg-app');
  const root = document.createElement('div');
  root.id = 'p2s-root';
  root.style.cssText = 'display:none';
  app.appendChild(root);
  const sgids = {};
  function node(type, props) {
    const el = document.createElement('vsg-node');
    el.setAttribute('vsg-type', type);
    const sgid = VRHTML.NextSGID();
    allSgids.push(sgid);
    el.setAttribute('sgid', String(sgid));
    el.__p2sProps = props || {};
    el.buildNode = (ctx) => [
      type === 'reparent-to-panel' ? Object.assign({}, ctx, { bInsideReparentedPanel: true, currentPanel: undefined }) : Object.assign({}, ctx),
      { type, properties: Object.assign({ sgid }, el.__p2sProps) },
    ];
    return el;
  }
  function xform(t, rot) {
    const el = document.createElement('vsg-transform');
    el.setAttribute('translation', typeof t === 'string' ? t : [t.channel, t.interp, ...t.from, ...t.to].join(' '));
    el.setAttribute('rotation', rot || '1 0 0 0');
    el.setAttribute('scale', '1 1 1');
    el.setAttribute('vsg-type', 'base');
    const sg = VRHTML.NextSGID();
    allSgids.push(sg);
    el.setAttribute('sgid', String(sg));
    return el;
  }
  const made = {};
  const groups = {};
  for (const it of spec.items || []) {
    const p = node('panel', Object.assign({ debug_name: 'p2s:' + it.name, origin: [0, 0], visibility: 0, reflect: 0 }, it.panel));
    sgids[it.name] = Number(p.getAttribute('sgid'));
    let inner = p;
    for (const w of (it.wrap || []).slice().reverse()) { const n = node(w.type, w.props); n.appendChild(inner); inner = n; }
    const x = xform(it.xf || '0 0 0', it.rot);
    x.appendChild(inner);
    let top;
    if (it.parentKey) {
      // one reparent-to-panel per parent: siblings under separate ones get laid out side by side
      top = groups[it.parentKey];
      if (!top) { top = groups[it.parentKey] = node('reparent-to-panel', { 'parent-overlay-key': it.parentKey }); root.appendChild(top); }
      const a = node('panel-anchor', { 'anchor-u': it.at[0], 'anchor-v': it.at[1] });
      a.appendChild(x);
      top.appendChild(a);
    } else {
      top = x;
      root.appendChild(top);
    }
    made[it.name] = { top, panel: p, xf: x };
  }
  function doPush() { try { push(); return true; } catch (e) { return String(e); } }
  const pushed = doPush();
  const ttl = setTimeout(() => { if (W.__P2S) W.__P2S.clear(); }, spec.ttlMs || 45000);
  W.__P2S = {
    made, sgids, push: doPush,
    setXf(name, t) { const m = made[name]; m.xf.setAttribute('translation', t); return doPush(); },
    setPanel(name, props) { const m = made[name]; m.panel.__p2sProps = Object.assign({}, m.panel.__p2sProps, props); return doPush(); },
    // Removal must retire the sgids, or the compositor keeps the nodes (and
    // their reparent-to-panel registrations) alive.
    clear() { clearTimeout(ttl); root.remove(); if (retire) for (const s of allSgids) { try { retire(s); } catch (_) { /* best effort */ } } doPush(); delete W.__P2S; return 'cleared+retired:' + (retire ? allSgids.length : 0); },
  };
  return JSON.stringify({ pushed, sgids, push: !!push });
})
