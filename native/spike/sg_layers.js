// Scene-graph layering test (systemui page). Builds, attached to Steam's main
// window panel through reparent-to-panel + panel-anchor:
//   cover  - an opaque panel showing our own overlay "glassd.test", just in
//            front of Steam's window (hides it; Steam still takes the laser)
//   crop   - Steam's window texture, header strip, 3 cm in front
// Options via window.__LGS_SGT_OPTS = { cover: bool, crop: bool, dz: m, mpp: m }.
// window.__LGS_SGT.remove() undoes everything.
(() => {
  if (window.__LGS_SGT) window.__LGS_SGT.remove();
  const o = Object.assign({ cover: true, crop: true, dz: 0.03, cropUV: [0, 0, 0.45, 0.075] }, window.__LGS_SGT_OPTS || {});
  const app = document.querySelector('vsg-app');
  const sgidOf = () => VRHTML.NextSGID();
  // meters per pixel of Steam's VR gamepadui, read from a live pooled popup panel
  let mpp = o.mpp;
  if (!mpp) {
    for (const el of document.querySelectorAll('[id^=PooledPopup] , vsg-node[vsg-type=panel]')) {
      try { const n = el.buildNode({}, el)[1]; if (n && n.properties.key && /gamepadui/.test(n.properties.key) && n.properties['meters-per-pixel']) { mpp = n.properties['meters-per-pixel']; break; } } catch (_) { /* skip */ }
    }
  }
  const MAIN = 'valve.steam.gamepadui.main';
  const made = [];

  function node(type, props, children) {
    const el = document.createElement('vsg-node');
    el.setAttribute('vsg-type', type);
    const sgid = sgidOf();
    el.setAttribute('sgid', String(sgid));
    el.buildNode = (ctx) => [Object.assign({}, ctx, type === 'reparent-to-panel' ? { bInsideReparentedPanel: true, currentPanel: undefined } : {}),
      { type, properties: Object.assign({ sgid }, props) }];
    for (const c of children || []) el.appendChild(c);
    return el;
  }
  function xf(translation, children) {
    const el = document.createElement('vsg-transform');
    el.setAttribute('translation', translation);
    el.setAttribute('rotation', '1 0 0 0');
    el.setAttribute('scale', '1 1 1');
    el.setAttribute('vsg-type', 'base');
    el.setAttribute('sgid', String(sgidOf()));
    for (const c of children || []) el.appendChild(c);
    return el;
  }
  function panel(key, uvMin, uvMax, extra) {
    return node('panel', Object.assign({
      key, uv_min: uvMin, uv_max: uvMax, 'meters-per-pixel': mpp, origin: [0, 0],
      curvature: 'inherit-from-parent-panel', interactive: false, visibility: 0, reflect: 0,
      debug_name: 'lgs:' + key,
    }, extra || {}));
  }
  function attach(u, v, dz, child) {
    const root = node('reparent-to-panel', { 'parent-overlay-key': MAIN }, [
      node('panel-anchor', { 'anchor-u': u, 'anchor-v': v }, [xf(`0 0 ${dz}`, [child])]),
    ]);
    app.appendChild(root);
    made.push(root);
  }

  if (o.cover) {
    // full-window cover from our own overlay, 2 mm in front; width set by meters
    attach(0.5, 0.5, 0.002, panel('glassd.test', [0, 0], [1, 1], { 'meters-per-pixel': mpp * 1920 / 256 }));
  }
  if (o.crop) {
    const [u0, v0, u1, v1] = o.cropUV;
    attach((u0 + u1) / 2, (v0 + v1) / 2, o.dz, o.lift ? xf(`0 ${o.lift} 0`, [panel(MAIN, [u0, v0], [u1, v1])]) : panel(MAIN, [u0, v0], [u1, v1]));
  }
  // The serializer only sends "update_scene_graph" when its scheduler runs:
  // module 5723 exports it as "my".
  let req;
  window.webpackChunkvrwebui.push([[Symbol('lgs-sg')], {}, (r) => { req = r; }]);
  const sg = req('5723');
  const push = () => { try { sg.my(); } catch (e) { /* ignore */ } };
  push();
  window.__LGS_SGT = { remove() { for (const m of made) m.remove(); push(); delete window.__LGS_SGT; }, mpp, push };
  return { mpp, made: made.length, scheduler: typeof sg.my };
})()
