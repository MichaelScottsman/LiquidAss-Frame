// Scene-graph test 2 (systemui page): hide Steam's main window panel while
// keeping it in the graph, by wrapping the frame-page mountables' buildNode so
// they emit an opacity node. window.__LGS_SG_MT.restore() undoes it.
(() => {
  if (window.__LGS_SG_MT) window.__LGS_SG_MT.restore();
  const mounts = [...document.querySelectorAll('vsg-node[vsg-type=mountable]')].filter((e) => /^frame:\d+:page:\d+:mountable$/.test(e.id));
  const saved = [];
  for (const el of mounts) {
    const orig = el.buildNode;
    saved.push([el, orig]);
    el.buildNode = (ctx, t) => {
      const [c, node] = orig(ctx, t);
      node.properties.opacity = 0.0;   // see whether a mountable honours opacity
      return [c, node];
    };
  }
  // nudge the scene graph to rebuild
  const app = document.querySelector('vsg-app');
  const bump = () => { const n = document.createElement('vsg-node'); n.setAttribute('vsg-type', 'base'); n.setAttribute('sgid', String(VRHTML.NextSGID())); app.appendChild(n); setTimeout(() => n.remove(), 50); };
  bump();
  window.__LGS_SG_MT = {
    restore() { for (const [el, f] of saved) el.buildNode = f; bump(); delete window.__LGS_SG_MT; },
    count: mounts.length,
  };
  return { wrapped: mounts.map((m) => m.id) };
})()
