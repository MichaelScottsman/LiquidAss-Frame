// Readable-class index for Steam's gamepadui.
//
// Steam ships hashed CSS class names ("_2Y_MrEdtYx5M51OJoFSLB"), but every CSS
// module is also a webpack module whose exports map readable names to hashes
// ({ MainNavMenuMainSplit: "...", OpaqueBackground: "b084m..." }). Theme files
// are written against readable tokens and resolved here at injection time, so
// they survive Steam client updates that reshuffle the hashes.
//
// Token syntax (in theme CSS):  %{Name}  or  %{Anchor>Name}  or  %{A+B>Name}
//   Name   - export key of a CSS module; must map to one hash across modules
//   Anchor - other key(s) that must exist in the same module (disambiguates
//            generic names such as Title or Container)
//   *...   - a leading * matches every module variant that fits, e.g.
//            %{*GamepadDialogContent>Field} covers all four gamepaddialog
//            builds Steam ships; it expands to :is(.a,.b,...)
//
// The harvest only requires "pure" factories, whose whole body is
// `e => { e.exports = { key: "string", ... } }` (CSS modules are; 545 of 552 on
// build 11094443, the rest were localization JSON). Requiring one is side-effect
// free even before Steam loaded it. Every other factory is never run: Steam's
// require caches a module before its factory runs and keeps a half-built one if
// it throws, so running arbitrary factories early (right after a SharedJSContext
// reload) could break Steam modules (review R1 M1c).
//
// The result says whether it is plausible: `ok` is false below `minModules`
// (default 200 for Steam's client bundle, whose healthy size is about 550; 1 for
// SteamVR's vrwebui pages). Callers must not cache an index whose `ok` is false
// (lgsIndexShared does it right).

// Steam's webpack require, or null while the webpack runtime is not loaded. The
// probe record webpack keeps in the chunk array is spliced out again, so nothing
// accumulates however often this runs.
function lgsWebpackRequire() {
  const W = window;
  const chunks = W.webpackChunksteamui || W.webpackChunkvrwebui;
  // Before the runtime loads, push is the plain Array method: the callback would never run.
  if (!chunks || typeof chunks.push !== 'function' || chunks.push === Array.prototype.push) return null;
  let req = null;
  const sym = Symbol('lgs-index');
  const rec = [[sym], {}, (r) => { req = r; }];
  try { chunks.push(rec); } catch (_) { return null; }
  try {
    for (let i = chunks.length - 1; i >= 0; i--) {
      const c = chunks[i];
      const id = c && Array.isArray(c[0]) ? c[0][0] : null;
      // ours, and any record an older build of this file left behind
      if (c === rec || (typeof id === 'symbol' && id.description === 'lgs-index')) chunks.splice(i, 1);
    }
  } catch (_) { /* array gone */ }
  return req && req.m ? req : null;
}

function lgsBuildIndex(opts) {
  const o = opts || {};
  const W = window;
  const bundle = W.webpackChunksteamui ? 'steamui' : (W.webpackChunkvrwebui ? 'vrwebui' : null);
  const minModules = typeof o.minModules === 'number' ? o.minModules : (bundle === 'steamui' ? 200 : 1);
  const t0 = (W.performance ? W.performance.now() : Date.now());
  const req = o.req || lgsWebpackRequire();
  const CLASSY = /^[A-Za-z_][\w-]*( [A-Za-z_][\w-]*)*$/;
  // e=>{e.exports={...}}, (e,t,n)=>{...}, function(e){...}; optional "use strict"; no nested braces
  const PURE = /^\s*(?:function\s*\w*\s*\(\s*\w+(?:\s*,\s*\w+){0,2}\s*\)|\(\s*\w+(?:\s*,\s*\w+){0,2}\s*\)\s*=>|\w+\s*=>)\s*\{\s*(?:(["'])use strict\1;?\s*)?\w+\.exports\s*=\s*\{[^{}]*\}\s*;?\s*\}\s*$/;
  const mods = [];
  const byKey = new Map();
  const seen = new Set();
  let factories = 0, pure = 0;
  const ids = req && req.m ? Object.keys(req.m) : [];
  factories = ids.length;
  for (const id of ids) {
    let src;
    try { src = Function.prototype.toString.call(req.m[id]); } catch (_) { continue; }
    if (src.length > 40000 || !PURE.test(src)) continue;
    pure++;
    let e;
    try { e = req(id); } catch (_) { continue; }
    if (!e || typeof e !== 'object' || seen.has(e)) continue;
    seen.add(e);
    let ks;
    try { ks = Object.keys(e); } catch (_) { continue; }
    if (ks.length < 1 || ks.length > 800) continue;
    let ok = true, hashed = 0;
    for (const k of ks) {
      const v = e[k];
      if (typeof v !== 'string') { ok = false; break; }
      if (CLASSY.test(v)) hashed++;
    }
    if (!ok || hashed === 0) continue;
    const m = {};
    for (const k of ks) if (CLASSY.test(e[k])) m[k] = e[k].split(' ')[0];
    const mi = mods.length;
    mods.push(m);
    for (const k of Object.keys(m)) {
      let a = byKey.get(k);
      if (!a) byKey.set(k, a = []);
      a.push(mi);
    }
  }
  // hash -> [module index, key] for reverse lookups (outline tooling)
  const byHash = new Map();
  mods.forEach((m, mi) => { for (const k in m) { const h = m[k]; let a = byHash.get(h); if (!a) byHash.set(h, a = []); a.push([mi, k]); } });

  function resolve(tok) {
    tok = tok.trim();
    const all = tok.startsWith('*');
    if (all) tok = tok.slice(1);
    const parts = tok.split('>');
    const name = parts.pop().trim();
    const anchors = parts.length ? parts.join('>').split('+').map((s) => s.trim()).filter(Boolean) : [];
    const cands = (byKey.get(name) || []).filter((mi) => anchors.every((a) => a in mods[mi]));
    const vals = [...new Set(cands.map((mi) => mods[mi][name]))];
    if (vals.length === 1) return { cls: vals[0], all: vals };
    if (all && vals.length) return { all: vals };
    return { err: vals.length ? 'ambiguous' : 'unresolved', n: vals.length };
  }

  // Shortest token that resolves back to exactly this hash.
  function tokenFor(hash) {
    const hits = byHash.get(hash);
    if (!hits) return null;
    for (const [mi, name] of hits) {
      if (resolve(name).cls === hash) return name;
      for (const a of Object.keys(mods[mi])) {
        if (a === name) continue;
        if (resolve(a + '>' + name).cls === hash) return a + '>' + name;
      }
    }
    // No key isolates this module (Steam ships several builds of some CSS
    // modules); name the family instead, which covers every variant.
    const [mi, name] = hits[0];
    const first = Object.keys(mods[mi]).find((k) => k !== name);
    return '*' + (first ? first + '>' : '') + name;
  }

  // CSS selector text for a token: .a  or  :is(.a,.b)
  function selector(tok) {
    const r = resolve(tok);
    if (!r.all) return r;
    const cls = r.all.map((c) => '.' + CSS.escape(c));
    return { sel: cls.length === 1 ? cls[0] : ':is(' + cls.join(',') + ')', n: cls.length };
  }

  // Still the index of this page's webpack runtime, with no factory registered since?
  // (A lazily loaded chunk adds factories: rebuild then.)
  function current() {
    try { return !!(req && req.m && Object.keys(req.m).length === factories); } catch (_) { return false; }
  }

  const size = mods.length;
  return {
    mods, byKey, byHash, resolve, selector, tokenFor, current, req,
    size, factories, pure, bundle, minModules,
    ok: !!req && size >= minModules,
    why: !req ? 'webpack runtime not loaded' : (size < minModules ? `${size} CSS modules < ${minModules}` : null),
    builtAt: Date.now(),
    ms: Math.round(((W.performance ? W.performance.now() : Date.now()) - t0) * 10) / 10,
  };
}

// The page's shared index (window.__LGS_INDEX): reused while it is ok and current,
// rebuilt otherwise; a new one is cached only when ok, and a cached one that is not
// ok (from an older build, or built by a caller that did not check) is dropped.
// Returns the index, which may be not ok (and then is not cached): check `.ok`.
function lgsIndexShared(opts) {
  const W = window;
  const cur = W.__LGS_INDEX;
  const min = opts && typeof opts.minModules === 'number' ? opts.minModules : null;
  if (cur && cur.selector && cur.ok === true && typeof cur.current === 'function' && cur.current()
      && (min === null || cur.size >= min)) return cur;
  const fresh = lgsBuildIndex(opts);
  if (fresh.ok) { W.__LGS_INDEX = fresh; return fresh; }
  const curGood = cur && cur.selector && cur.ok === true && (min === null || cur.size >= min);
  if (curGood) return cur;             // a new chunk, but the fresh harvest is short: keep the last good map
  if (cur) { try { delete W.__LGS_INDEX; } catch (_) { W.__LGS_INDEX = undefined; } }
  return fresh;
}
