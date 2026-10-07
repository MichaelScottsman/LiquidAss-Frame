// Glass Shell runtime module "search" (package C1b): the search sheet (T2 + T3).
// Concept: docs/phase2/concepts/window-nav.md (WN) §4, §9.1; PLAN §1.9. Interface: docs/phase2/wp/C1b.md
// ("Interface announced"). Contracts: runtime.md (P1), react.md (P2: routes.override, actions, data, ui),
// interaction.md (P3: rt.sound, optional). Behind flag wp.c1b (PLAN §2.1). Look: theme/21-search.css.
//
// What it does while installed:
//   - html.lgs-c1b on the main window (21-search.css keys its T3 rules on it);
//   - activation = DOM focus on the header field (focusin on %{SearchBox}): takes the context snapshot of
//     the page you are on (cloneNode of the route's content, ids removed, inert, scroll offsets copied) and
//     navigates to Steam's /search, so the sheet appears over that picture at once (WN §4.2, §4.3);
//   - overrides Steam's top-level /search route: snapshot + scrim (a click goes back) + the sheet. With an
//     empty query on /search or /search/tab/All the sheet is our zero state (Recent Games, Recent Searches,
//     See All, the hint); otherwise Steam's own search page is the sheet (21-search.css restyles it), so
//     every result, category, count and path stays Steam's (WN §4.6 "All without Q6");
//   - Recent Searches: this session's queries, in this module's memory only (never storage or disk), set
//     back into the field through Steam's own input handler;
//   - the provider API of PLAN §1.9 (__LGS_RT.search.addProvider), consulted for the Software cell.
// Every Steam-facing call fails closed: rt.react.ready() throws out of install() when a finder misses, and
// the override's error boundary falls back to Steam's page (T1 look).

/* eslint-disable no-var */
__LGS_RT.define({
  name: 'search',
  deps: ['react'],
  flag: 'wp.c1b',
  install(rt) { return searchInstall(rt); },
  remove() { return searchRemove(); },
});

let SS = null;

const SEARCH_RECENT_MAX = 8;
const SEARCH_RANK_MS = 2;
const SEARCH_GLYPH = {
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
};

function searchStr(R, key) {
  const t = R.ui;
  switch (key) {
    case 'recentGames': return t.text('#LibraryHome_RecentGames', 'Recent Games');
    case 'recentSearches': return t.lang().startsWith('en') ? 'Recent Searches' : null;
    case 'seeAll': return t.text('#StoreApp_SeeAll', 'See All');
    case 'hint': return t.lang().startsWith('en') ? 'Type to search your library, friends and the Store.' : null;
    case 'open': return t.text('#Generic_Open', 'Open');
    case 'back': return t.text('#ActionButtonLabelBack', 'Back');
    case 'play': return t.text('#GameAction_Play', 'Play');
    case 'software': return t.text('#AppType_2', 'Software');
    default: return null;
  }
}

// ---------------------------------------------------------------------------------------------------
// The field, the query and Steam's input handler

function searchField() {
  const w = SS && SS.R.nav.win();
  if (!w) return null;
  try { return w.document.querySelector('#header ' + SS.rt.sel('%{SearchBox}')); } catch (_) { return null; }
}
function searchQuery() {
  const f = searchField();
  return f ? String(f.value || '') : '';
}
// Sets the query through Steam's own onChange (the native value setter + an input event), exactly as a
// keystroke does: Steam's search store, its route change and its results follow by themselves.
function searchSetQuery(q) {
  const f = searchField();
  if (!f) return false;
  const w = f.ownerDocument.defaultView;
  const set = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set;
  if (SS && q) SS.fresh = 0;     // a query we set (Recent Searches) is not Steam's stale one
  if (SS) SS.selfSet = true;
  try {
    set.call(f, q);
    f.dispatchEvent(new w.Event('input', { bubbles: true }));
  } finally { if (SS) SS.selfSet = false; }
  return true;
}
// A fresh activation starts empty (WN §4.4 "Activated, empty"): Steam's search store keeps the last query
// and shows it again on /search. Within 1 s of activation and before any keystroke, that stale query is
// cleared through Steam's own handler (what its × does), and the sheet shows the zero state from its first
// paint. It is not added to Recent Searches: that list holds this session's queries (WN §4.5), and a query
// typed while search was ours is already in it (review R2 m13).
function searchStale(q) {
  return !!(q && SS && SS.fresh && Date.now() <= SS.fresh && !SS.typed);
}
function searchClearStale() {
  if (!SS || !SS.fresh || Date.now() > SS.fresh || SS.typed) return;
  const q = searchQuery();
  if (!q) return;
  SS.fresh = 0;
  searchSetQuery('');
  searchNotify();
}
function searchRemember(q) {
  q = String(q || '').trim();
  if (q.length < 2 || !SS) return;
  const low = q.toLowerCase();
  SS.recent = [q].concat(SS.recent.filter((x) => x.toLowerCase() !== low)).slice(0, SEARCH_RECENT_MAX);
}
function searchNotify() {
  if (!SS) return;
  for (const fn of Array.from(SS.subs)) { try { fn(); } catch (_) { /* a dead view */ } }
}

// T2 on Steam's search page (results and categories): its tab-row segments carry data-lgs-exempt="E-SEG"
// (PLAN §1.16: judged as segments, contiguous, >= 60 x 120 compact), and Steam's "No Results Found" carries
// the query in data-lgs-q, which 21-search.css echoes under it in quotes (P-62). Attributes only: Steam's
// text and nodes stay Steam's. Removed on unmount and on removal.
function searchDecorate(d) {
  if (!SS || !d) return;
  const rt = SS.rt;
  try {
    for (const t of d.querySelectorAll(rt.sel('%{GamepadSearch} %{GamepadTabbedPage>Tab}'))) {
      if (t.closest('.lgs-snap')) continue;
      if (t.getAttribute('data-lgs-exempt') !== 'E-SEG') t.setAttribute('data-lgs-exempt', 'E-SEG');
    }
    const q = searchQuery().trim();
    for (const n of d.querySelectorAll(rt.sel('%{GamepadSearch} %{NoResultsFound}'))) {
      if (n.closest('.lgs-snap')) continue;
      if (!q) { n.removeAttribute('data-lgs-q'); continue; }
      if (n.getAttribute('data-lgs-q') !== q) n.setAttribute('data-lgs-q', q);
    }
  } catch (_) { /* a token missing on this build: no decoration */ }
}
function searchUndecorate(d) {
  if (!d || !SS) return;
  try {
    const tab = SS.rt.sel('%{GamepadTabbedPage>Tab}');
    for (const e of d.querySelectorAll('[data-lgs-exempt="E-SEG"]')) if (e.matches(tab)) e.removeAttribute('data-lgs-exempt');
    for (const e of d.querySelectorAll('[data-lgs-q]')) e.removeAttribute('data-lgs-q');
  } catch (_) { /* gone */ }
}

// ---------------------------------------------------------------------------------------------------
// Focus memory (AT-9c, VP P-21): B gives focus back to the card you left. Steam's own focus history puts
// it on the last node the D-pad crossed on that page (the "All Games" tab after Up through the tab row), or
// nowhere after a tabbed page's B. So the last content card that took DOM focus on a page (gamepad focus
// moves DOM focus) is remembered, and after a leave back to that route it takes Steam's focus again through
// its own nav node, found at the same place on the remounted page (Steam restores the scroll).

function searchNavNode(el) {
  const R = SS && SS.R;
  for (let f = el && R ? R.fiber.of(el) : null, i = 0; f && i < 12; i++, f = f.return) {
    const n = f.memoizedProps && f.memoizedProps.node;
    if (n && typeof n.BTakeFocus === 'function') return n;
  }
  return null;
}
function searchTrackFocus(t) {
  if (!SS || !t || t.nodeType !== 1 || !t.getBoundingClientRect) return;
  let path = '';
  try { path = SS.R.nav.route(); } catch (_) { return; }
  if (searchOnRoute(path)) return;
  if (t.closest('#header, #Footer, .lgs-snap')) return;
  const r = t.getBoundingClientRect();
  // content cards (posters, tiles, Home's cells): both sides >= 100 px; not rows, tabs or the page itself
  if (Math.min(r.width, r.height) < 100 || r.width > 640 || r.height > 560) return;
  SS.lastCard = { el: t, route: path, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, at: Date.now() };
}
function searchFindCard(d, src) {
  if (src.el && src.el.isConnected) return src.el;
  let list = [];
  try { list = d.elementsFromPoint(src.cx, src.cy); } catch (_) { return null; }
  let away = '.lgs-search-zero, .lgs-search-layer, #header, #Footer';
  try { away += ', ' + SS.rt.sel('%{GamepadSearch}'); } catch (_) { /* token */ }
  for (const e of list) {
    if (e.closest(away)) continue;
    for (let x = e, i = 0; x && i < 6; x = x.parentElement, i++) {
      const r = x.getBoundingClientRect();
      if (Math.abs(r.width - src.w) <= src.w * 0.12 && Math.abs(r.height - src.h) <= src.h * 0.12 && searchNavNode(x)) return x;
    }
  }
  return null;
}
function searchRestoreFocus(src) {
  if (!SS || !src) return;
  const R = SS.R;
  let n = 0;
  const attempt = () => {
    if (!SS || SS.restoreFor !== src) return;
    let ok = false;
    try {
      if (R.nav.route() !== src.route) return;          // you went on elsewhere
      const d = R.nav.win().document;
      const el = searchFindCard(d, src);
      if (el && el.classList.contains('gpfocus')) ok = true;
      else if (el) {
        const node = searchNavNode(el);
        try { const tree = node.m_Tree; if (tree && typeof tree.Activate === 'function') tree.Activate(); } catch (_) { /* no tree */ }
        node.BTakeFocus(3);
        ok = el.classList.contains('gpfocus');
        SS.restored = (SS.restored || 0) + 1;
      }
      // the card is gone (another sort, a removed game): at least one focused element (P-13)
      if (!el && n >= 2 && !d.querySelector('.gpfocus')) R.nav.focusRoot();
    } catch (e) { SS.rt.log('search: focus restore', String(e && e.message || e)); }
    if (!ok && ++n < 4) SS.rt.setTimeout(attempt, 350);
  };
  SS.rt.setTimeout(attempt, 420);
}

// ---------------------------------------------------------------------------------------------------
// Leaving (WN §4.4, §4.9): every leave is Steam's NavigateBack or a navigation. The history event starts
// the dismiss at once (html.lgs-c1b-leaving: content, then glass, done by 200 ms) instead of after Steam's
// 0.8-1.1 s route exit, plays HideModal once (not when the Back circle already played Steam's), and gives
// focus back to the card you left.

function searchLeave(to) {
  if (!SS || SS.leaving) return;
  SS.leaving = true;
  let html = null;
  try { html = SS.R.nav.win().document.documentElement; } catch (_) { /* gone */ }
  if (html) { html.classList.add('lgs-c1b-leaving'); html.classList.remove('lgs-c1b-presented'); }
  const steamSounded = SS.hdrAt && Date.now() - SS.hdrAt < 1500;
  if (!steamSounded && SS.P && typeof SS.P.sound === 'function') { try { SS.P.sound('sheetOut'); } catch (_) { /* no sound */ } }
  const src = SS.source;
  SS.source = null;
  if (src && src.route === to) { SS.restoreFor = src; searchRestoreFocus(src); }
  // the class goes when the route unmounts, when search mounts again, and on removal
}

// ---------------------------------------------------------------------------------------------------
// The context snapshot (WN §4.2 step 1)

function searchAppPath(R, appid) {
  try { const f = R.Routes.Library.App.Root; if (typeof f === 'function') return f(appid); } catch (_) { /* older table */ }
  return '/library/app/' + appid;
}
function searchOnRoute(path) { return /^\/search(\/|$)/.test(String(path || '')); }

function searchTakeSnapshot() {
  const R = SS.R, rt = SS.rt;
  const w = R.nav.win();
  if (!w) return null;
  const d = w.document;
  let sw = null;
  try { sw = d.querySelector(rt.sel('%{TopLevelTransitionSwitch}')); } catch (_) { return null; }
  if (!sw) return null;
  const pages = Array.from(sw.children).filter((e) => e.nodeType === 1);
  const page = pages[pages.length - 1];
  if (!page) return null;
  try { if (page.querySelector(rt.sel('%{GamepadSearch}'))) return null; } catch (_) { /* token missing */ }
  const t0 = Date.now();
  const node = page.cloneNode(true);
  node.removeAttribute('id');
  for (const e of node.querySelectorAll('[id]')) e.removeAttribute('id');
  for (const e of node.querySelectorAll('video, iframe, audio')) e.remove();
  for (const e of node.querySelectorAll('.gpfocus, .gpfocuswithin')) e.classList.remove('gpfocus', 'gpfocuswithin');
  // a picture, not controls: no focusable markers left for Steam, the reporter's click-safe rule or the lab
  for (const e of node.querySelectorAll('.Focusable, [tabindex], [role]')) {
    e.classList.remove('Focusable');
    e.removeAttribute('tabindex');
    e.removeAttribute('role');
  }
  for (const e of node.querySelectorAll('input, button, select, textarea, a[href]')) {
    e.setAttribute('tabindex', '-1');
    if (e.tagName === 'A') e.removeAttribute('href'); else e.disabled = true;
  }
  node.setAttribute('inert', '');
  node.setAttribute('aria-hidden', 'true');
  // scroll offsets: Steam's scrollers carry %{ScrollPanel}; the clone lists them in the same order
  const scroll = [];
  try {
    const sp = rt.sel('%{ScrollPanel}');
    const a = page.querySelectorAll(sp), b = node.querySelectorAll(sp);
    for (let i = 0; i < a.length && i < b.length; i++) {
      if (a[i].scrollTop || a[i].scrollLeft) scroll.push([b[i], a[i].scrollTop, a[i].scrollLeft]);
    }
  } catch (_) { /* no scrollers */ }
  // the Large Title (C1a, #header > .lgs-title) rides along at its place, with its own computed type and
  // box written inline: C1a's rules key on #header > .lgs-title, which the clone is not (review R2 M3)
  let title = null;
  const lt = d.querySelector('#header > .lgs-title');
  if (lt) {
    const r = lt.getBoundingClientRect();
    if (r.width > 0) {
      const cs = w.getComputedStyle(lt);
      title = lt.cloneNode(true);
      title.removeAttribute('id');
      for (const e of title.querySelectorAll('[id]')) e.removeAttribute('id');
      const css = {
        position: 'absolute', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
        right: 'auto', bottom: 'auto', margin: '0', 'box-sizing': 'border-box',
        'font-family': cs.fontFamily, 'font-size': cs.fontSize, 'font-weight': cs.fontWeight, 'line-height': cs.lineHeight,
        'letter-spacing': cs.letterSpacing, 'text-transform': cs.textTransform, color: cs.color, 'text-shadow': cs.textShadow,
        padding: cs.padding, display: cs.display, 'align-items': cs.alignItems, 'justify-content': cs.justifyContent,
        'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis', opacity: cs.opacity, visibility: 'visible',
      };
      for (const k of Object.keys(css)) { try { title.style.setProperty(k, css[k], 'important'); } catch (_) { /* skip */ } }
    }
  }
  return { node, scroll, title, from: R.nav.route(), ms: Date.now() - t0 };
}

function searchOnFocusIn(ev) {
  if (!SS) return;
  const f = ev.target;
  if (!f || f.tagName !== 'INPUT') { if (ev.type === 'focusin') searchTrackFocus(f); return; }
  const field = searchField();
  if (f !== field) return;
  const R = SS.R;
  const path = R.nav.route();
  if (searchOnRoute(path)) return;
  SS.query = searchQuery();
  SS.fresh = Date.now() + 1000;
  SS.typed = false;
  SS.leaving = false;
  // the card to give focus back to: the last one focused on this page, when the D-pad (not the laser)
  // brought focus to the field
  const lc = SS.lastCard;
  const viaPointer = ev.type === 'pointerdown';
  SS.source = (!viaPointer && lc && lc.route === path && Date.now() - lc.at < 10 * 60 * 1000) ? lc : null;
  try { SS.snap = searchTakeSnapshot(); } catch (e) { SS.snap = null; SS.rt.warn('snapshot failed', String(e && e.message || e)); }
  SS.seeAll = false;
  // Steam itself navigates only on the first keystroke; activation opens the sheet now (WN §4.3)
  // to /search/tab/All (not /search): Steam's first keystroke then replaces the entry, so one B leaves
  let to = '/search/tab/All';
  try { const t = R.Routes.GamepadUI.Search.Tab; if (typeof t === 'function' && /^\/search\/tab\/All$/.test(t('All'))) to = t('All'); } catch (_) { /* fixed path */ }
  try { R.nav.go(to); } catch (e) { SS.rt.warn('search: navigate failed', String(e)); }
}

function searchOnInput(ev) {
  if (!SS) return;
  if (ev.target !== searchField()) return;
  if (!SS.selfSet) SS.typed = true;
  searchQueryChanged();
}
function searchQueryChanged() {
  if (!SS) return;
  const q = searchQuery();
  if (SS.query !== q) {
    SS.query = q;
    if (q) SS.seeAll = false;
    // a query is remembered once typing pauses (the last state of a word, not every keystroke)
    if (SS.memT) SS.memT();
    SS.memT = SS.rt.setTimeout(() => { SS.memT = null; searchRemember(SS.query); }, 1200);
    searchNotify();
  }
  try { searchDecorate(SS.R.nav.win().document); } catch (_) { /* gone */ }
}
// Steam's × clears the field without an input event: a click in the header's search container reads the
// query again shortly after (nothing runs while the sheet is idle; review R2 m1). A click elsewhere in the
// header (the Back circle) is noted, because Steam then plays its own HideModal (C1b-9).
function searchOnHeaderClick(ev) {
  if (!SS) return;
  const t = ev.target;
  if (!t || !t.closest || !t.closest('#header')) return;
  const rt = SS.rt;
  let inField = false;
  try { inField = !!t.closest(rt.sel('%{SearchAndTitleContainer}')); } catch (_) { /* token */ }
  if (!inField) { SS.hdrAt = Date.now(); return; }
  for (const ms of [60, 300]) rt.setTimeout(() => searchQueryChanged(), ms);
}

function searchOnDimClick(ev) {
  if (!SS || ev.button !== 0) return;
  const R = SS.R, rt = SS.rt;
  if (!searchOnRoute(R.nav.route())) return;
  const t = ev.target;
  if (!t || !t.closest) return;
  try {
    if (!t.closest(rt.sel('%{PopupBody>Content}'))) return;
    if (t.closest('.lgs-search-zero') || t.closest(rt.sel('%{GamepadSearch} > %{GamepadTabbedPage}'))) return;
    if (t.closest('.lgs-search-zero, [role="dialog"]')) return;
  } catch (_) { return; }
  // the keyboard rose for the field; leaving by the dimmed page is our path, so it goes with the sheet (m7)
  try { const K = R.nav.win().SteamClient.OpenVR.Keyboard; if (K && typeof K.Hide === 'function') K.Hide(); } catch (_) { /* no keyboard API */ }
  R.nav.back();
}

// ---------------------------------------------------------------------------------------------------
// Providers (PLAN §1.9, C1b "Interface announced")

function searchProviders() {
  return Array.from(SS.providers.values()).map((p) => ({ id: p.spec.id, slots: p.slots.slice(), calls: p.calls, ms: p.ms, failed: p.failed, skipped: p.skipped }));
}
function searchAddProvider(spec) {
  if (!SS) throw new Error('search: not installed');
  if (!spec || typeof spec.id !== 'string' || !spec.id) throw new Error('search.addProvider: spec.id required');
  if (SS.providers.has(spec.id)) throw new Error('search.addProvider: duplicate id ' + spec.id);
  if (typeof spec.rank !== 'function') throw new Error('search.addProvider: spec.rank required');
  const slots = (Array.isArray(spec.slots) ? spec.slots : ['software']).filter((s) => s === 'tophit' || s === 'software');
  const rec = { spec, slots, calls: 0, ms: 0, failed: false, skipped: 0 };
  SS.providers.set(spec.id, rec);
  searchNotify();
  return { remove() { if (SS && SS.providers.get(spec.id) === rec) { SS.providers.delete(spec.id); searchNotify(); } } };
}
// Candidates for one slot, best first, Liquid Glass dropped whatever a provider returns (HA-10)
function searchCandidates(query, slot) {
  const out = [];
  if (!SS || !query) return out;
  const R = SS.R;
  for (const rec of SS.providers.values()) {
    if (rec.failed || rec.slots.indexOf(slot) < 0) continue;
    const now = () => { try { return SS.rt.W.performance.now(); } catch (_) { return Date.now(); } };
    const t0 = now();
    let list = null;
    try {
      list = rec.spec.rank(query, { steamBest: null, lang: R.ui.lang() });
    } catch (e) {
      rec.failed = true;
      SS.rt.warn('search provider failed; disabled for the session', { id: rec.spec.id, error: String(e && e.message || e) });
      continue;
    }
    const ms = Math.round((now() - t0) * 100) / 100;
    rec.calls++; rec.ms = ms;
    if (ms > SEARCH_RANK_MS) { rec.skipped++; SS.rt.log('search provider slow; skipped for this query', { id: rec.spec.id, ms }); continue; }
    for (const c of Array.isArray(list) ? list : []) {
      if (!c || !c.name) continue;
      if (/liquid glass/i.test(String(c.name)) || (c.data && c.data.isLiquidGlass)) continue;
      out.push({ rec, c });
    }
  }
  out.sort((a, b) => (a.c.tier || 0) - (b.c.tier || 0));
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Components

function searchComponents(R, rt) {
  const React = R.React, jsx = R.jsx, jsxs = R.jsxs, c = R.c;
  const svg = (name) => jsx('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', children: jsx('path', { d: SEARCH_GLYPH[name] }) });

  function useLive() {
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useLayoutEffect(() => {
      if (!SS) return undefined;
      SS.subs.add(force);
      return () => { if (SS) SS.subs.delete(force); };
    }, []);
  }

  // The snapshot host: a plain node React never fills; the clone is appended into it (WN §4.10)
  function SnapHost() {
    const ref = React.useRef(null);
    React.useLayoutEffect(() => {
      const host = ref.current;
      const s = SS && SS.snap;
      if (!host || !s) return undefined;
      host.appendChild(s.node);
      if (s.title) host.appendChild(s.title);
      for (const [el, top, left] of s.scroll) { try { el.scrollTop = top; el.scrollLeft = left; } catch (_) { /* gone */ } }
      return () => {
        try { if (s.node.parentNode === host) host.removeChild(s.node); } catch (_) { /* gone */ }
        try { if (s.title && s.title.parentNode === host) host.removeChild(s.title); } catch (_) { /* gone */ }
      };
    }, [SS && SS.snap]);
    return jsx('div', { ref, className: 'lgs-snap', 'aria-hidden': 'true', inert: true });
  }

  // art: Steam's hero (custom first) with its logo, else the portrait, else the header, else a monogram;
  // a failing URL steps to the next one
  function Disc({ g }) {
    const A = React.useMemo(() => { try { return R.data.art(g.appid); } catch (_) { return null; } }, [g.appid]);
    // every candidate in Steam's order, custom art first (a shortcut lists .jpg and .png and one exists,
    // as Home's homeArt), then Steam's cached assets; each failed load moves on to the next (m5)
    const list = React.useMemo(() => {
      if (!A) return [];
      const L = (...xs) => [].concat(...xs.map((x) => (Array.isArray(x) ? x : (x ? [x] : [])))).filter(Boolean);
      const cu = A.custom || {};
      const logos = L(cu.logo, A.logo);
      const out = [];
      for (const u of L(cu.hero, A.hero)) out.push({ src: u, logos });
      for (const u of L(cu.portrait, A.portrait)) out.push({ src: u });
      for (const u of L(A.header)) out.push({ src: u });
      return out;
    }, [A]);
    const [i, setI] = React.useState(0);
    const [li, setLi] = React.useState(0);
    const cur = list[i] || null;
    const logo = cur && cur.logos ? cur.logos[li] : null;
    const kids = [];
    if (cur) kids.push(jsx('img', { src: cur.src, alt: '', onError: () => setI(i + 1) }, 'a' + i));
    if (logo) kids.push(jsx('img', { className: 'lgs-search-logo', src: logo, alt: '', onError: () => setLi(li + 1) }, 'l' + li));
    if (!cur) kids.push(jsx('span', { className: 'lgs-search-mono', children: String(g.name || '?').slice(0, 1).toUpperCase() }, 'm'));
    return jsx('div', { className: 'lgs-search-disc', children: kids });
  }

  function ZeroState() {
    const back = () => R.nav.back();
    const games = React.useMemo(() => { try { return R.data.recentGames(5); } catch (_) { return []; } }, []);
    const recent = SS ? SS.recent.slice() : [];
    const open = searchStr(R, 'open') || undefined;
    const backL = searchStr(R, 'back') || undefined;
    const hRG = searchStr(R, 'recentGames');
    const hRS = searchStr(R, 'recentSearches');
    const hint = searchStr(R, 'hint');
    const seeAll = searchStr(R, 'seeAll');
    const kids = [];
    if (games.length) {
      if (hRG) kids.push(jsx('h2', { className: 'lgs-search-h', children: hRG }, 'hg'));
      kids.push(jsx(c.Focusable, {
        className: 'lgs-search-row', 'flow-children': 'row', 'data-lgs-search': 'recent',
        children: games.map((g) => jsxs(c.Focusable, {
          className: 'lgs-search-game', noFocusRing: true, 'data-lgs-appid': g.appid,
          onActivate: (e) => { R.actions.navigate(searchAppPath(R, g.appid), {}, e); },
          // A and B only (WN §4.5, §4.9: the zero state's ornament is the quiet legend; review R2 M5)
          onOKActionDescription: open, onCancel: back, onCancelActionDescription: backL,
          children: [jsx(Disc, { g }, 'd'), jsx('div', { className: 'lgs-search-name', children: g.name }, 'n')],
        }, g.appid)),
      }, 'games'));
    }
    if (recent.length) {
      if (hRS) kids.push(jsx('h2', { className: 'lgs-search-h', children: hRS }, 'hs'));
      kids.push(jsx(c.Focusable, {
        className: 'lgs-search-row', 'flow-children': 'row', 'data-lgs-search': 'recent-search',
        children: recent.map((q) => jsxs(c.Focusable, {
          className: 'lgs-search-cap', noFocusRing: true, role: 'button',
          onActivate: () => { searchSetQuery(q); },
          onOKActionDescription: open, onCancel: back, onCancelActionDescription: backL,
          children: [svg('clock'), jsx('span', { children: q }, 't')],
        }, 'q:' + q)),
      }, 'searches'));
    }
    kids.push(jsxs(c.Focusable, {
      className: 'lgs-search-foot', 'flow-children': 'row',
      children: [
        jsx(c.Focusable, {
          className: 'lgs-search-cap', noFocusRing: true, role: 'button', 'data-lgs-search': 'seeall',
          onActivate: () => { if (SS) { SS.seeAll = true; searchNotify(); } },
          onOKActionDescription: open, onCancel: back, onCancelActionDescription: backL,
          children: [svg('grid'), jsx('span', { children: seeAll }, 't')],
        }, 'all'),
        hint ? jsx('div', { className: 'lgs-search-hint', children: hint }, 'hint') : null,
      ],
    }, 'foot'));
    return jsx(c.Focusable, {
      className: 'lgs-search-zero', 'data-lgs-search': 'sheet', 'data-lgs-search-state': 'zero',
      'flow-children': 'column', onCancel: back, onCancelActionDescription: backL,
      children: kids,
    });
  }

  function SearchRoute(props) {
    useLive();
    const path = (props.location && props.location.pathname) || R.nav.route();
    const q = searchQuery();
    if (SS) SS.query = q;
    // the header's field takes Steam's stored query in the same commit as this route: re-check after every
    // commit (before paint). Steam's × is read again by the header click listener; no timer runs at rest.
    React.useLayoutEffect(() => { searchClearStale(); if (SS && searchQuery() !== q) searchNotify(); });
    const all = /^\/search\/?$/.test(path) || /^\/search\/tab\/all\/?$/i.test(path);
    // Steam's stale query (cleared by the layout effect above) never shows as results: the zero state is
    // on screen from the first paint, and the glass has its zero-state geometry from that paint (M7)
    const zero = (!q || searchStale(q)) && all && !(SS && SS.seeAll);
    const zeroAtMount = React.useRef(zero);
    React.useEffect(() => {
      if (!SS) return undefined;
      const s = SS;
      let html = null;
      try { html = R.nav.win().document.documentElement; } catch (_) { /* gone */ }
      if (html) html.classList.remove('lgs-c1b-leaving');
      s.leaving = false;
      if (s.P && typeof s.P.sound === 'function') { try { s.P.sound('sheetIn'); } catch (_) { /* no sound */ } }
      // the dismiss starts on the history event that leaves /search (searchLeave), not at this unmount
      let unlisten = null;
      try {
        unlisten = R.nav.inst().m_history.listen((loc) => {
          const p = loc && loc.pathname;
          if (typeof p === 'string' && !searchOnRoute(p)) searchLeave(p);
        });
      } catch (e) { s.rt.warn('search: no history listener; the sheet leaves with the route', String(e && e.message || e)); }
      // once the sheet is on screen, Steam's page entering it later (the first keystroke) cross-fades
      // instead of presenting the sheet again; when the route mounted straight into results, only after
      // their own present has run (no cut animation)
      const offP = s.rt.setTimeout(() => {
        if (SS === s && !s.leaving && html) html.classList.add('lgs-c1b-presented');
      }, zeroAtMount.current ? 60 : 800);
      return () => {
        if (unlisten) { try { unlisten(); } catch (_) { /* gone */ } }
        try { offP(); } catch (_) { /* fired */ }
        if (html) html.classList.remove('lgs-c1b-leaving', 'lgs-c1b-presented');
        try { searchUndecorate(R.nav.win().document); } catch (_) { /* gone */ }
        if (SS !== s) return;
        s.leaving = false;
        s.rt.setTimeout(() => {
          if (SS !== s) return;
          if (searchOnRoute(s.R.nav.route())) return;
          searchRemember(s.query);
          s.snap = null; s.seeAll = false;
          // the field keeps DOM focus (and Steam's keyboard) after a click on the dimmed page: let it go
          const f = searchField();
          if (f && f.ownerDocument.activeElement === f) { try { f.blur(); } catch (_) { /* gone */ } }
        }, 400);
      };
    }, []);
    const state = zero ? 'zero' : (all ? 'results' : 'category');
    // T2 tags on Steam's tabbed page (the sheet), for tests and the depth rule, and the decorations of
    // searchDecorate (E-SEG, the query echo), kept up by an observer while Steam's page changes its own
    // nodes (results arriving, the virtualised grid); gone on unmount
    React.useLayoutEffect(() => {
      if (zero) return undefined;
      let el = null, d = null;
      try {
        d = R.nav.win().document;
        el = Array.from(d.querySelectorAll(rt.sel('%{GamepadSearch} > %{GamepadTabbedPage}'))).find((e) => !e.closest('.lgs-snap')) || null;
      } catch (_) { el = null; }
      if (!el) return undefined;
      el.setAttribute('data-lgs-search', 'sheet');
      el.setAttribute('data-lgs-search-state', state);
      searchDecorate(d);
      let mo = null, queued = false;
      try {
        mo = new (R.nav.win().MutationObserver)(() => {
          if (queued) return;
          queued = true;
          Promise.resolve().then(() => { queued = false; searchDecorate(d); });
        });
        mo.observe(el, { childList: true, subtree: true });
      } catch (_) { mo = null; }
      return () => {
        if (mo) { try { mo.disconnect(); } catch (_) { /* gone */ } }
        el.removeAttribute('data-lgs-search'); el.removeAttribute('data-lgs-search-state');
      };
    });
    // The picture layer (snapshot, scrim, the sheet's glass) is portalled into %{BasicHome}, under
    // Steam's content element: Steam's route content sits in a transformed 3D context in which a
    // backdrop-filter samples nothing, so the glass lives outside it (probe, session 2), and Steam's page
    // (or our zero state's content) paints above it. Steam's page keeps its own place in the DOM: no
    // wrapper (paths, focus tree, AUD unchanged).
    const [host, setHost] = React.useState(null);
    React.useLayoutEffect(() => {
      const h = searchLayerHost();
      setHost(h);
      return () => { try { h.remove(); } catch (_) { /* gone */ } };
    }, []);
    const layer = host ? R.ReactDOM.createPortal(jsxs(R.Fragment, { children: [
      jsx(SnapHost, {}, 'snap'),
      jsx('div', { className: 'lgs-search-scrim', 'data-lgs-search-state': state }, 'scrim'),
      jsx('div', { className: 'lgs-search-glass', 'data-lgs-search': 'glass', 'data-lgs-search-state': state }, 'glass'),
    ] }), host) : null;
    return jsxs(R.Fragment, { children: zero ? [jsx(ZeroState, {}, 'zero'), layer] : [props.steam, layer] });
  }

  // %{BasicHome} > div.lgs-search-layer (last child, painted under Steam's content); removed on unmount
  function searchLayerHost() {
    const d = R.nav.win().document;
    const old = d.querySelector('.lgs-search-layer');
    if (old) old.remove();
    const h = d.createElement('div');
    h.className = 'lgs-search-layer';
    h.setAttribute('aria-hidden', 'true');
    h.setAttribute('inert', '');
    let home = null;
    try {
      const hdr = d.querySelector('#header');
      home = hdr ? hdr.parentElement : d.querySelector(rt.sel('%{BasicHome}'));
    } catch (_) { /* tokens */ }
    if (!home) throw new Error('search: no page host');
    // appended last, painted first (z-index -1 in %{BasicHome}'s stacking context, 21-search.css §4):
    // no sibling of Steam's moves, so Steam's DOM paths stay what they are without search
    home.appendChild(h);
    return h;
  }

  return { SearchRoute };
}

// ---------------------------------------------------------------------------------------------------
// Install / remove

function searchInstall(rt) {
  const R = rt.react || rt.use('react');
  R.ready(); // throws when a required finder is missing (fail closed, P2 §0 rule 2)
  const root = R.Routes && R.Routes.GamepadUI && R.Routes.GamepadUI.Search && R.Routes.GamepadUI.Search.Root;
  if (typeof root !== 'function') throw new Error('search: Routes.GamepadUI.Search.Root missing');
  rt.sel('%{SearchBox}'); // throws on an unresolved token (fail closed)
  SS = { rt, R, P: rt.W.__LGS_RT, snap: null, recent: [], providers: new Map(), subs: new Set(), handles: [], query: '', seeAll: false, memT: null, fresh: 0, typed: false, selfSet: false,
    lastCard: null, source: null, restoreFor: null, restored: 0, leaving: false, hdrAt: 0 };
  SS.query = searchQuery();
  rt.windows.track((w) => {
    if (w.kind !== 'main') return undefined;
    w.html.classList.add('lgs-c1b');
    const offF = rt.listen(w.doc, 'focusin', searchOnFocusIn, true);
    // a click on a field that kept DOM focus (no new focusin) activates too
    const offC = rt.listen(w.doc, 'pointerdown', (ev) => { if (ev.target === searchField()) searchOnFocusIn(ev); }, true);
    const offI = rt.listen(w.doc, 'input', searchOnInput, true);
    // a click on the dimmed page (inside the route's content, outside the sheet) leaves search (WN §4.4)
    const offD = rt.listen(w.doc, 'click', searchOnDimClick);
    // the header: Steam's × (query re-read) and the Back circle (Steam's own HideModal)
    const offH = rt.listen(w.doc, 'click', searchOnHeaderClick, true);
    return () => {
      w.html.classList.remove('lgs-c1b', 'lgs-c1b-leaving', 'lgs-c1b-presented');
      offF(); offC(); offI(); offD(); offH();
    };
  });
  const C = searchComponents(R, rt);
  SS.C = C;
  SS.handles.push(R.routes.override(root(), (steam, info) => R.jsx(C.SearchRoute, { steam, location: info && info.location }), { owner: 'c1b' }));
  const api = {
    addProvider: searchAddProvider,
    providers: searchProviders,
    candidates: (q, slot) => searchCandidates(q, slot || 'software').map((x) => Object.assign({ provider: x.rec.spec.id }, x.c)),
    recent: () => (SS ? SS.recent.slice() : []),
    snapshot: () => (SS && SS.snap ? { from: SS.snap.from, ms: SS.snap.ms, nodes: SS.snap.node.getElementsByTagName('*').length, scrolled: SS.snap.scroll.length, title: !!SS.snap.title } : null),
    setQuery: searchSetQuery,
    // tests: the focus memory (AT-9c) and the dismiss state
    debug: () => (SS ? {
      leaving: !!SS.leaving, restored: SS.restored || 0,
      source: SS.source ? { route: SS.source.route, w: Math.round(SS.source.w), h: Math.round(SS.source.h) } : null,
      lastCard: SS.lastCard ? { route: SS.lastCard.route, w: Math.round(SS.lastCard.w), h: Math.round(SS.lastCard.h) } : null,
    } : null),
  };
  rt.expose('search', api);
  return api;
}

function searchRemove() {
  if (!SS) return { patchedLeft: 0 };
  const s = SS;
  SS = null;
  for (const h of s.handles.splice(0)) { try { h.remove(); } catch (_) { /* already gone */ } }
  s.providers.clear();
  s.subs.clear();
  s.recent = [];
  s.snap = null;
  s.source = null; s.lastCard = null; s.restoreFor = null;
  try {
    const d = s.R.nav.win().document;
    for (const e of d.querySelectorAll('.lgs-search-layer')) e.remove();
    d.documentElement.classList.remove('lgs-c1b', 'lgs-c1b-leaving', 'lgs-c1b-presented');
    const tab = s.rt.sel('%{GamepadTabbedPage>Tab}');
    for (const e of d.querySelectorAll('[data-lgs-exempt="E-SEG"]')) if (e.matches(tab)) e.removeAttribute('data-lgs-exempt');
    for (const e of d.querySelectorAll('[data-lgs-q]')) e.removeAttribute('data-lgs-q');
  } catch (_) { /* gone */ }
  return { patchedLeft: 0 };
}
