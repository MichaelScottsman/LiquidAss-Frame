// One scene-graph variant at a time (systemui page). window.__LGS_SGV = {
//   items: [{ key, uv: [u0,v0,u1,v1], at: [u,v], lift: [x,y], dz, mppScale }] }
// Each item: reparent-to-panel(main) > panel-anchor(at) > transform(lift, dz) > panel(key, uv).
// Replaces the previous variant; window.__LGS_SGV_CLEAR() removes it.
(() => {
  const app = document.querySelector('vsg-app');
  let req;
  window.webpackChunkvrwebui.push([[Symbol('lgs-sgv')], {}, (r) => { req = r; }]);
  const sg = req('5723');
  const push = () => { try { sg.my(); } catch (_) { /* ignore */ } };
  if (window.__LGS_SGV_NODES) for (const n of window.__LGS_SGV_NODES) n.remove();
  window.__LGS_SGV_NODES = [];
  window.__LGS_SGV_CLEAR = () => { for (const n of window.__LGS_SGV_NODES || []) n.remove(); window.__LGS_SGV_NODES = []; push(); };

  let mpp = 0;
  for (const el of document.querySelectorAll('[id^=PooledPopup]')) {
    try { const n = el.buildNode({}, el)[1]; if (n && n.properties['meters-per-pixel']) { mpp = n.properties['meters-per-pixel']; break; } } catch (_) { /* skip */ }
  }
  const MAIN = 'valve.steam.gamepadui.main';

  function node(type, props, children) {
    const el = document.createElement('vsg-node');
    el.setAttribute('vsg-type', type);
    const sgid = VRHTML.NextSGID();
    el.setAttribute('sgid', String(sgid));
    el.buildNode = (ctx) => [Object.assign({}, ctx, type === 'reparent-to-panel' ? { bInsideReparentedPanel: true, currentPanel: undefined } : {}),
      { type, properties: Object.assign({ sgid }, props) }];
    for (const c of children || []) el.appendChild(c);
    return el;
  }
  function xf(t, children) {
    const el = document.createElement('vsg-transform');
    el.setAttribute('translation', t);
    el.setAttribute('rotation', '1 0 0 0');
    el.setAttribute('scale', '1 1 1');
    el.setAttribute('vsg-type', 'base');
    el.setAttribute('sgid', String(VRHTML.NextSGID()));
    for (const c of children || []) el.appendChild(c);
    return el;
  }
  const v = window.__LGS_SGV || { items: [] };
  for (const it of v.items) {
    const [u0, v0, u1, v1] = it.uv || [0, 0, 1, 1];
    const at = it.at || [(u0 + u1) / 2, (v0 + v1) / 2];
    const lift = it.lift || [0, 0];
    const p = node('panel', Object.assign({
      key: it.key || MAIN, uv_min: [u0, v0], uv_max: [u1, v1], 'meters-per-pixel': mpp * (it.mppScale || 1), origin: [0, 0],
      curvature: 'inherit-from-parent-panel', interactive: false, visibility: 0, reflect: 0, debug_name: 'lgs-variant',
    }, it.width ? { width: it.width, height: it.height } : {}));
    const root = node('reparent-to-panel', { 'parent-overlay-key': MAIN }, [
      node('panel-anchor', { 'anchor-u': at[0], 'anchor-v': at[1] }, [xf(`${lift[0]} ${lift[1]} ${it.dz || 0}`, [p])]),
    ]);
    app.appendChild(root);
    window.__LGS_SGV_NODES.push(root);
  }
  push();
  return { mpp, items: v.items.length };
})()
