/* game-pages concept, revision 2: READ-ONLY probe run 2026-10-07 with  python glass.py js "$(cat docs/phase2/concepts/game-pages-probe.js)"
   Lists SteamClient.OpenVR (no binding-UI API exists) and the main window route switch (/app/:appid/controllerconfigurator is top level). */
(() => {
  // READ-ONLY probe for the game-pages concept (GQ11a, GQ16): no patch, no navigation, no clicks.
  const out = {};
  try { out.openvr = Object.keys(SteamClient.OpenVR || {}).sort().join(','); } catch (e) { out.openvr = 'ERR ' + e; }
  try {
    const sub = {};
    for (const k of Object.keys(SteamClient.OpenVR || {})) {
      const v = SteamClient.OpenVR[k];
      if (v && typeof v === 'object') sub[k] = Object.keys(v).sort().join(',');
    }
    out.openvrSub = sub;
  } catch (e) { out.openvrSub = 'ERR ' + e; }
  try {
    const inst = SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
    const doc = inst.BrowserWindow.document;
    const el = [...doc.body.querySelectorAll('*')].find((n) => Object.keys(n).some((k) => k.startsWith('__reactFiber$')));
    let f = el[Object.keys(el).find((k) => k.startsWith('__reactFiber$'))];
    while (f.return) f = f.return;
    const stack = [f]; let hit = null, n = 0;
    while (stack.length && n < 200000) {
      const x = stack.pop(); n++;
      const ch = x.memoizedProps && x.memoizedProps.children;
      if (x.tag === 0 && Array.isArray(ch) && ch.some((c) => c && c.props && c.props.path === '/zoo')) { hit = x; break; }
      if (x.sibling) stack.push(x.sibling);
      if (x.child) stack.push(x.child);
    }
    if (hit) {
      out.routes = hit.memoizedProps.children.map((c) => c && c.props && (Array.isArray(c.props.path) ? c.props.path.join('|') : c.props.path)).filter(Boolean);
    } else out.routes = 'switch not found';
  } catch (e) { out.routes = 'ERR ' + e; }
  return JSON.stringify(out, null, 1);
})()
