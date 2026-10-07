// Scene-graph injection test, evaluated inside SteamVR's systemui page.
// Adds one panel that shows a crop of Steam's main window texture, floating
// in front of the window. window.__LGS_SG_TEST.remove() undoes it.
(() => {
  if (window.__LGS_SG_TEST) window.__LGS_SG_TEST.remove();
  const app = document.querySelector('vsg-app');
  const next = () => (window.VRHTML && VRHTML.NextSGID ? VRHTML.NextSGID() : Math.floor(Math.random() * 1e6) + 9e5);
  const anchor = 'system.standalone::valve.steam.gamepadui.main_CurvatureOrigin';

  const xf = document.createElement('vsg-transform');
  xf.setAttribute('translation', '0 0 0.05');
  xf.setAttribute('rotation', '1 0 0 0');
  xf.setAttribute('scale', '1 1 1');
  xf.setAttribute('parent-id', anchor);
  xf.setAttribute('vsg-type', 'base');
  xf.setAttribute('sgid', String(next()));
  xf.id = 'lgs-test-transform';

  const panel = document.createElement('vsg-node');
  panel.setAttribute('vsg-type', 'panel');
  const sgid = next();
  panel.setAttribute('sgid', String(sgid));
  panel.id = 'lgs-test-panel';
  panel.buildNode = (ctx) => [ctx, {
    type: 'panel',
    properties: {
      id: 'system.systemui::lgs-test-panel',
      sgid,
      key: 'valve.steam.gamepadui.main',
      uv_min: [0.0, 0.0],
      uv_max: [0.5, 0.12],
      'meters-per-pixel': window.__LGS_MPP || 0.0013,
      origin: [0.5, 0.5],
      interactive: false,
      visibility: 0,
      'sort-depth-bias': 0,
      reflect: 0,
      debug_name: 'lgs-test-panel',
    },
  }];
  xf.appendChild(panel);
  app.appendChild(xf);

  const remove = () => { xf.remove(); delete window.__LGS_SG_TEST; };
  window.__LGS_SG_TEST = { remove, sgid };
  return { added: true, sgid, appChildren: app.children.length };
})()
