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
function lgsBuildIndex() {
  let req;
  window.webpackChunksteamui.push([[Symbol('lgs-index')], {}, (r) => { req = r; }]);
  const CLASSY = /^[A-Za-z_][\w-]*( [A-Za-z_][\w-]*)*$/;
  const mods = [];
  const byKey = new Map();
  const seen = new Set();
  for (const id of Object.keys(req.m)) {
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

  return { mods, byKey, byHash, resolve, selector, tokenFor, size: mods.length };
}
