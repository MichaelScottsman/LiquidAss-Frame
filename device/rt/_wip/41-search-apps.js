// Glass Shell runtime module "search-apps" (package C2a): Home's programs in C1b's search (HA §6, XC §2).
// Contracts: C1b's provider API (docs/phase2/wp/C1b.md "Interface announced", PLAN §1.9), react.md §8
// (actions), runtime.md (define, deps). Behind flag wp.c2a; needs C1b's `search` (wp.c1b) and C2a's `home`
// (the programs Home's Apps section lists: Steam's own "+ > Launch Program" scan and filter, Liquid Glass
// left out). Without either module it is not installed and search shows Steam's results only.
//
// Provider `c2a.programs`, slots `tophit` and `software`:
//   rank(query) -> [{key, name, tier, icon, subtitle, data}], best first; tier 0 exact title, 1 title prefix,
//                  2 word prefix, 3 substring (case- and accent-insensitive). data.more = the other matches.
//   open(candidate, ev, opts) -> a program launches through rt.react.actions.launchNonSteam (logged, never
//                  run, in test mode); the Software cell that reads "and N more" (opts.slot 'software' with
//                  data.more > 0) opens Home › Apps with that program focused (rt.home.reveal).
// No `primary` (S-C is C1b's sheet). Nothing a query returns is stored.

/* eslint-disable no-var */
__LGS_RT.define({
  name: 'search-apps',
  deps: ['react', 'search', 'home'],
  flag: 'wp.c2a',
  install(rt) { return searchAppsInstall(rt); },
  remove() { return searchAppsRemove(); },
});

var SA = null;

function searchAppsNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function searchAppsTier(name, q) {
  const n = searchAppsNorm(name);
  if (!n || !q) return -1;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(/[^a-z0-9]+/).some((w) => w && w.startsWith(q))) return 2;
  return n.includes(q) ? 3 : -1;
}

function searchAppsInstall(rt) {
  const R = rt.use('react');
  const S = rt.use('search');
  const H = rt.use('home');
  if (!S || typeof S.addProvider !== 'function') throw new Error('search-apps: search.addProvider missing (C1b)');
  const subtitle = () => { try { return R.ui.loc('#AppType_2') || null; } catch (_) { return null; } };
  const spec = {
    id: 'c2a.programs',
    slots: ['tophit', 'software'],
    rank(query) {
      const q = searchAppsNorm(query).trim();
      if (!q) return [];
      const hits = [];
      for (const p of H.programs() || []) {
        if (!p || p.isLiquidGlass) continue; // HA-10 (the search module drops it too)
        const t = searchAppsTier(p.name, q);
        if (t >= 0) hits.push({ p, t });
      }
      hits.sort((a, b) => (a.t - b.t) || String(a.p.name).localeCompare(String(b.p.name), undefined, { sensitivity: 'base' }));
      const sub = subtitle();
      return hits.slice(0, 8).map(({ p, t }, i) => ({
        key: p.key, name: p.name, tier: t, icon: p.iconUrl || null, subtitle: sub,
        data: { cmdline: p.cmdline, isLiquidGlass: false, more: i === 0 ? hits.length - 1 : 0 },
      }));
    },
    open(c, ev, opts) {
      if (!c || !c.data) return null;
      const o = opts || {};
      if (o.slot === 'software' && (o.more != null ? o.more : c.data.more) > 0) return H.reveal({ section: 'apps', key: c.key });
      return R.actions.launchNonSteam(c.data.cmdline, ev);
    },
  };
  SA = { handle: S.addProvider(spec) };
  return { id: spec.id, rank: spec.rank, open: spec.open };
}

function searchAppsRemove() {
  const s = SA;
  SA = null;
  try { if (s && s.handle) s.handle.remove(); } catch (_) { /* search gone first */ }
  return { patchedLeft: 0 };
}
