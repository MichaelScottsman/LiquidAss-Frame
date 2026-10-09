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
  chev: 'M9 5l7 7-7 7',
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
    case 'options': return t.text('#ActionButtonLabelContextMenu', 'Options');
    case 'topHit': return t.lang().startsWith('en') ? 'Top Hit' : null;
    case 'library': return t.text('#SearchTab_Library', 'Library');
    case 'store': return t.text('#SearchTab_Store', 'Store');
    case 'friends': return t.text('#SearchTab_Friends', 'Friends');
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
    searchLibEnsure(d);
  } catch (_) { /* a token missing on this build: no decoration */ }
}
// The library-result and results-list patches are optional (Steam mounts its results only on this route)
// and attach once a result is mounted. Steam's results are memos whose props (the app overview, the results
// array) keep their identity, so what is on screen would keep rendering without them: the first time a patch
// is seen attached, Steam's page is remounted once (a new key in SearchRoute), while focus is still in the
// field.
function searchLibEnsure(d) {
  if (!SS) return;
  let tile = null;
  try { tile = d.querySelector(SS.rt.sel('%{GamepadSearch} %{ResultTemplate}')); } catch (_) { return; }
  if (!tile) return;
  let fresh = false;
  for (const [k, h] of [['lib', SS.libHandle], ['list', SS.listHandle]]) {
    if (!h) continue;
    if (!h.count) { try { h.refresh(); } catch (_) { /* still pending */ } }
    if (h.count > 0 && !SS.patchSeen[k]) { SS.patchSeen[k] = true; fresh = true; }
  }
  if (fresh) {
    SS.libGen++;
    SS.rt.log('search: result patches attached; Steam page remounted once', { gen: SS.libGen });
    Promise.resolve().then(searchNotify);
  }
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
// nowhere after a tabbed page's B. So the last content card that took Steam's gamepad focus on a page
// (vgp_onfocus) is remembered with its identity (its art's URL, else its text, and its first class),
// and after a leave back to that route the same card takes Steam's focus again through its own nav node.
// Never by position: Steam's restored scroll differs, and each take scrolls the grid (review R2 M4).

const SEARCH_STATE_CLASS = /^(gpfocus|gpfocuswithin|Panel|Focusable|lgs-.*)$/;
function searchNavNode(el) {
  const R = SS && SS.R;
  for (let f = el && R ? R.fiber.of(el) : null, i = 0; f && i < 12; i++, f = f.return) {
    const n = f.memoizedProps && f.memoizedProps.node;
    if (n && typeof n.BTakeFocus === 'function') return n;
  }
  return null;
}
// Steam's focus onto el's own nav node: its tree activated first (after a modal or a menu in VR Steam
// parks focus in vr-null-tree, where a take alone does nothing; P2 RX-3)
function searchTakeEl(el) {
  const node = searchNavNode(el);
  if (!node) return false;
  try { const tree = node.m_Tree; if (tree && typeof tree.Activate === 'function') tree.Activate(); } catch (_) { /* no tree */ }
  try { node.BTakeFocus(3); return true; } catch (_) { return false; }
}
function searchSig(el) {
  try {
    const im = el.querySelector('img');
    const src = im ? (im.getAttribute('src') || '') : '';
    if (src) return 'img:' + src;
    const t = String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    return t ? 'txt:' + t : '';
  } catch (_) { return ''; }
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
  const cls = Array.from(t.classList).find((c) => !SEARCH_STATE_CLASS.test(c)) || '';
  SS.lastCard = { el: t, route: path, cls, sig: searchSig(t), w: r.width, h: r.height, at: Date.now() };
}
function searchFindCard(d, src) {
  if (src.el && src.el.isConnected) return src.el;
  if (!src.cls || !src.sig) return null;
  let away = '.lgs-search-zero, .lgs-search-layer, .lgs-snap, #header, #Footer';
  try { away += ', ' + SS.rt.sel('%{GamepadSearch}'); } catch (_) { /* token */ }
  for (const e of Array.from(d.getElementsByClassName(src.cls))) {
    if (e.closest(away)) continue;
    if (searchSig(e) === src.sig && searchNavNode(e)) return e;
  }
  return null;     // not mounted (a virtualised row scrolled away): no guess
}
function searchRestoreFocus(src) {
  if (!SS || !src) return;
  const R = SS.R;
  let n = 0, takes = 0;
  const attempt = () => {
    if (!SS || SS.restoreFor !== src) return;
    try {
      if (R.nav.route() !== src.route) return;          // you went on elsewhere
      const d = R.nav.win().document;
      const el = searchFindCard(d, src);
      if (el && (el.classList.contains('gpfocus') || el.querySelector('.gpfocus'))) { SS.restoreFor = null; SS.restoredOk = (SS.restoredOk || 0) + 1; return; }
      if (el && takes < 3) { if (searchTakeEl(el)) { takes++; SS.restored = (SS.restored || 0) + 1; } }
      // the card is gone (another sort, a removed game): at least one focused element (P-13)
      else if (!el && n >= 3 && !d.querySelector('.gpfocus')) R.nav.focusRoot();
    } catch (e) { SS.rt.log('search: focus restore', String(e && e.message || e)); }
    if (++n < 7) SS.rt.setTimeout(attempt, 300);
  };
  SS.rt.setTimeout(attempt, 420);
}
// After Steam's item menu closes (B, Cancel or an item), focus goes back to the tile it was opened from
// (G-PAD: after a menu closes, focus is on its source). Steam parks it in vr-null-tree otherwise.
function searchMenuClosed(el, route) {
  if (!SS || !el) return;
  const R = SS.R;
  let n = 0;
  const attempt = () => {
    if (!SS) return;
    try {
      if (R.nav.route() !== route || !el.isConnected) return;
      const d = R.nav.win().document;
      if (d.querySelector('.BasicUIContextMenu, .ModalOverlayContent.active')) { if (++n < 8) SS.rt.setTimeout(attempt, 200); return; }
      if (d.querySelector('.gpfocus')) return;             // focus is somewhere (Steam's or the item's)
      searchTakeEl(el);
    } catch (e) { SS.rt.log('search: menu focus', String(e && e.message || e)); return; }
    if (++n < 4) SS.rt.setTimeout(attempt, 250);
  };
  SS.rt.setTimeout(attempt, 150);
}

// ---------------------------------------------------------------------------------------------------
// Leaving (WN §4.4, §4.9): every leave is Steam's NavigateBack or a navigation. The history event starts
// the dismiss at once (html.lgs-c1b-leaving: content, then glass, done by 200 ms) instead of after Steam's
// 0.8-1.1 s route exit, plays HideModal once (not when the Back circle already played Steam's), and gives
// focus back to the card you left.

function searchStartLeave() {
  if (!SS || SS.leaving) return false;
  SS.leaving = true;
  let html = null;
  try { html = SS.R.nav.win().document.documentElement; } catch (_) { /* gone */ }
  // (lgs-c1b-presented stays: dropping it would restart Steam's page's present under the dismiss)
  if (html) html.classList.add('lgs-c1b-leaving');
  const steamSounded = SS.hdrAt && Date.now() - SS.hdrAt < 1500;
  if (!steamSounded && SS.P && typeof SS.P.sound === 'function') { try { SS.P.sound('sheetOut'); } catch (_) { /* no sound */ } }
  // the class goes when the route unmounts, when search mounts again, and on removal
  return true;
}
// the history event that leaves /search (every path: ours below, Steam's Back, the tab bar, a jump)
function searchLeave(to) {
  if (!SS || SS.left) return;
  SS.left = true;
  searchStartLeave();
  const src = SS.source;
  SS.source = null;
  if (src && src.route === to) { SS.restoreFor = src; searchRestoreFocus(src); }
}
// Our leaving paths (B anywhere in the sheet, the Back circle, a click on the dimmed page) play the
// dismiss first and navigate when it has played (about 0.2 s): Steam's render of the page you return to holds
// the main thread for about half a second, and no fade advances while it does (review R2 M7: the sheet
// stayed opaque, then was cut in one frame). The picture of that page stays under the sheet, so the wait
// shows nothing but the sheet dissolving; Steam's own NavigateBack then does the leaving. Presses and
// clicks on the dissolving sheet are swallowed meanwhile (searchOnLeavingInput).
const SEARCH_DISMISS_MAX_MS = 600;   // fallback when no animationend comes (animations off, a missing glass)
function searchDismiss() {
  if (!SS || SS.leaving) return;
  const R = SS.R;
  searchStartLeave();
  const s = SS;
  let done = false, offEnd = null, offT = null;
  const go = () => {
    if (done) return;
    done = true;
    try { if (offEnd) offEnd(); } catch (_) { /* gone */ }
    try { if (offT) offT(); } catch (_) { /* fired */ }
    if (SS !== s) return;
    try { if (searchOnRoute(R.nav.route())) R.nav.back(); } catch (e) { s.rt.warn('search: back failed', String(e && e.message || e)); }
  };
  // the glass's fade is the last part of the dismiss (21-search.css: page delay + page-out): navigate when
  // it has played on screen; Steam itself takes about 0.1 s to deliver B, so a fixed timer would cut it
  try {
    const g = R.nav.win().document.querySelector('.lgs-search-layer > .lgs-search-glass');
    if (g) offEnd = s.rt.listen(g, 'animationend', (ev) => { if (ev.target === g) go(); });
  } catch (_) { offEnd = null; }
  offT = s.rt.setTimeout(go, SEARCH_DISMISS_MAX_MS);
}
function searchOnLeavingInput(ev) {
  if (!SS || !SS.leaving || SS.left) return;
  let path = '';
  try { path = SS.R.nav.route(); } catch (_) { return; }
  if (!searchOnRoute(path)) return;
  const t = ev.target;
  if (!t || !t.closest || t.closest('#header')) return;
  ev.stopPropagation();
  ev.preventDefault();
}
// B inside the sheet leaves search at once (WN §4.8, VP P-24: B closes the topmost layer, the sheet;
// review R2 m11: Steam's tabbed page would first send focus to the scope bar). Steam's Focusables take B
// as a vgp_oncancel event that bubbles from the focused node: caught in the capture phase, only on a
// search route, only from inside the sheet, never from a menu or modal over it, the header or the
// ornament.
function searchOnCancel(ev) {
  if (!SS) return;
  const R = SS.R, rt = SS.rt;
  let path = '';
  try { path = R.nav.route(); } catch (_) { return; }
  if (!searchOnRoute(path)) return;
  const t = ev.target;
  if (!t || !t.closest) return;
  if (t.closest('.BasicUIContextMenu, .ModalOverlayContent, [role="dialog"], #header, #Footer')) return;
  let inSheet = false;
  try { inSheet = !!t.closest('.lgs-search-zero, ' + rt.sel('%{GamepadSearch}')); } catch (_) { inSheet = false; }
  if (!inSheet) return;
  ev.stopPropagation();
  ev.preventDefault();
  SS.cancels = (SS.cancels || 0) + 1;
  searchDismiss();
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
  // a second, sharp copy of the same picture over the frosted one, cut out under the sheet (21-search.css
  // .lgs-snap-sharp): only what lies behind the sheet is frosted, the rest of the page stays sharp under
  // the scrim (WN §4.2; review R2 m2)
  const frost = node.cloneNode(true);
  // scroll offsets: Steam's scrollers carry %{ScrollPanel}; both clones list them in the same order
  const scroll = [];
  try {
    const sp = rt.sel('%{ScrollPanel}');
    const a = page.querySelectorAll(sp), b = node.querySelectorAll(sp), c = frost.querySelectorAll(sp);
    for (let i = 0; i < a.length && i < b.length; i++) {
      if (a[i].scrollTop || a[i].scrollLeft) {
        scroll.push([b[i], a[i].scrollTop, a[i].scrollLeft]);
        if (c[i]) scroll.push([c[i], a[i].scrollTop, a[i].scrollLeft]);
      }
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
  return { node, frost, scroll, title, from: R.nav.route(), ms: Date.now() - t0 };
}

function searchOnFocusIn(ev) {
  if (!SS) return;
  const f = ev.target;
  if (!f || f.tagName !== 'INPUT') return;
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
  let inField = false, onBack = false;
  try { inField = !!t.closest(rt.sel('%{SearchAndTitleContainer}')); } catch (_) { /* token */ }
  try { onBack = !!t.closest(rt.sel('%{BackContainer}')); } catch (_) { /* token */ }
  // the Back circle on a search route: the sheet's close (WN §4.4); the same NavigateBack, started after
  // the dismiss (searchDismiss), with one HideModal (ours) instead of Steam's plus ours (C1b-9)
  if (onBack && searchOnRoute(SS.R.nav.route()) && ev.button === 0) {
    ev.stopPropagation();
    ev.preventDefault();
    searchDismiss();
    return;
  }
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
  searchDismiss();
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
function searchCandidates(query, slot, steamBest) {
  const out = [];
  if (!SS || !query) return out;
  const R = SS.R;
  for (const rec of SS.providers.values()) {
    if (rec.failed || rec.slots.indexOf(slot) < 0) continue;
    const now = () => { try { return SS.rt.W.performance.now(); } catch (_) { return Date.now(); } };
    const t0 = now();
    let list = null;
    try {
      list = rec.spec.rank(query, { steamBest: steamBest || null, lang: R.ui.lang() });
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
      if (/liquid ?glass|liquidass/i.test(String(c.name)) || (c.data && c.data.isLiquidGlass)) continue;
      out.push({ rec, c });
    }
  }
  out.sort((a, b) => (a.c.tier || 0) - (b.c.tier || 0));
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Library results: X = Play (S-C) and ☰ = the item menu (L8) on Steam's own result tiles (WN §4.8,
// §4.9, §9.1). Steam's library result is a memo ({item: app overview}, rendered by the result switch
// whose item is {type: 'ownApp', ownAppOverview}) that returns its result template (`lu`: image, icon,
// description, onActivate), whose outer Focusable (ResultTemplate, focusable: false) holds A for the
// focusable art inside it. The memo patch hands that template to LgsLibTile, which renders it itself
// (its hooks run in our component) and adds the two actions to the same outer Focusable, so a press on
// the focused art bubbles to them exactly as A does, and Steam's legends show "Play" and "Options"
// (the ornament becomes the capsule). Everything else on the tile stays Steam's.

// Steam's library app context menu: the export pair the library's own capsule uses (C2a found it for
// Home: 41-home.js homeFindAppMenu; same needles). Optional: without it no ☰ and no More circle.
function searchFindAppMenu(R) {
  try {
    const f = R.find({
      AppMenu: [['#GameAction_DismissPlayNext', '#GameAction_ConfirmStopStreamingTitle', 'bFitToWindow'], (ex, u) => {
        let menu = null, opts = null;
        for (const k of Object.keys(ex)) {
          const v = ex[k];
          if (typeof v !== 'function') continue;
          const s = u.fnSrc(v) || '';
          if (!opts && s.includes('bFitToWindow') && s.includes('LibraryContextMenu')) opts = v;
          else if (!menu && s.includes('navigator:') && s.includes('instance:') && s.length < 400) menu = v;
        }
        return menu && opts ? { menu, opts } : null;
      }],
    });
    return { menu: f.mods.AppMenu || null, count: f.counts.AppMenu, where: f.where.AppMenu };
  } catch (e) { return { menu: null, error: String(e && e.message || e) }; }
}
const SEARCH_LAUNCH_SOURCE = 1000; // Steam's library launch source (what the library capsule's menu passes)

function searchTileMenu(app, anchor) {
  if (!SS || !SS.appMenu || !app) return null;
  const R = SS.R, M = SS.appMenu;
  if (!R.c.showContextMenu) return null;
  try {
    const w = R.nav.win();
    // the source: the focused art inside the tile (gamepad), for focus to return to when the menu closes
    const src = (anchor && anchor.classList && anchor.classList.contains('gpfocus') ? anchor : null)
      || (anchor && anchor.querySelector && anchor.querySelector('.gpfocus')) || w.document.querySelector('.gpfocus');
    const route = R.nav.route();
    const el = R.jsx(M.menu, { overview: app, client: 'mostavailable', launchSource: SEARCH_LAUNCH_SOURCE, bInGamepadUI: true, ownerWindow: w });
    const inst = R.c.showContextMenu(el, anchor || w.document.body, M.opts());
    try { if (src && inst && typeof inst.SetOnHideCallback === 'function') inst.SetOnHideCallback(() => searchMenuClosed(src, route)); }
    catch (_) { /* older client: Steam's own focus */ }
    SS.rt.log('search: item menu', { appid: app.appid });
    return inst;
  } catch (e) { SS.rt.warn('search: item menu failed', String(e && e.message || e)); return null; }
}
function searchTileProps(app) {
  const R = SS.R;
  const appid = app.appid;
  // its name for C1a's frozen target ("Options · Half-Life"; the tile itself only says "In Library")
  const p = { 'data-lgs-search-app': String(appid), 'aria-label': app.display_name || undefined };
  let info = null;
  try { info = R.actions.primaryInfo(appid); } catch (_) { info = null; }
  if (info && info.action) {
    p.onSecondaryButton = (e) => { R.actions.primary(appid, e); };
    p.onSecondaryActionDescription = info.label || searchStr(R, 'play') || undefined;
  }
  if (SS.appMenu && R.c.showContextMenu) {
    p.onMenuButton = (e) => { searchTileMenu(app, e && e.currentTarget); };
    p.onMenuActionDescription = searchStr(R, 'options') || undefined;
  }
  return p;
}
// The laser path to the item menu (L8): C1a's More circle (PLAN §1.11) on every library result tile,
// top right inside the card; it calls the tile's own onMenuButton (above). Registered when the sheet
// first mounts with C1a's helper installed, again if that helper was re-installed since.
function searchMoreRegister(s) {
  const M = s && s.P && s.P.more;
  if (!M || typeof M.register !== 'function' || !s.appMenu) return;
  if (s.moreH && s.moreOwner === M) return;
  try { if (s.moreH) s.moreH.remove(); } catch (_) { /* gone */ }
  try { s.moreH = M.register('[data-lgs-search-app]', { placement: 'card' }); s.moreOwner = M; }
  catch (e) { s.moreH = null; s.rt.warn('search: More circle register failed', String(e && e.message || e)); }
}
function searchLibResultPatch(R) {
  const React = R.React;
  function LgsLibTile(props) {
    const el = props.el;
    const out = el && typeof el.type === 'function' ? el.type(el.props) : el;
    if (!SS || !out || !out.props || !props.app) return out;
    try { return React.cloneElement(out, searchTileProps(props.app)); } catch (_) { return out; }
  }
  const pred = (p, f) => {
    if (!f || (f.tag !== 14 && f.tag !== 15)) return false;
    const k = Object.keys(p);
    if (k.length !== 1 || k[0] !== 'item') return false;
    const it = p.item;
    if (!it || typeof it.appid !== 'number' || !('display_name' in it)) return false;
    const up = f.return && f.return.memoizedProps;
    return !!(up && up.item && up.item.type === 'ownApp' && 'ownAppOverview' in up.item);
  };
  return R.patch.byProps('c1b.libresult', pred, (orig) => function (props, r) {
    const out = orig.call(this, props, r);
    if (!SS || !out || typeof out.type !== 'function' || !props || !props.item) return out;
    return R.jsx(LgsLibTile, { el: out, app: props.item });
  }, { optional: true });
}

// ---------------------------------------------------------------------------------------------------
// The All summary (WN §4.6, Q6; review R2 M9 S-A / S-B, m3, m14). Steam's results list is a memo whose only
// prop is `results` (Steam's own search results, in Steam's order: {type: ownApp | storeApp | storeTag |
// friend | redirectLink, ...}); the same component serves All and every category. Its output wraps an
// AutoSizer whose render prop builds Steam's virtualised result grid with the scroll element. The patch hands
// both to LgsResults, which keeps Steam's output for the categories and, on All, lays the same results out
// as the summary: the Top Hit and the next library matches (ours: art, name, Steam's status; A opens the game
// page, X Steam's primary action, ☰ Steam's menu), the Software cell (providers), and Steam's own result grid
// for the Store row and the other sections, so every store, friend and redirect tile, with its handler, is
// Steam's. Kill switch: flag c1bSummary (default on); without the patch All is Steam's grid.

function searchNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
// match tier of a title for the query (both normalised): 0 exact, 1 title prefix, 2 word prefix, 3 substring,
// 4 matched by Steam otherwise (tags, aliases)
function searchTier(name, qn) {
  const n = searchNorm(name).trim();
  if (!n || !qn) return 4;
  if (n === qn) return 0;
  if (n.startsWith(qn)) return 1;
  if (n.split(/[^a-z0-9]+/).some((w) => w && w.startsWith(qn))) return 2;
  return n.includes(qn) ? 3 : 4;
}
function searchSummaryOn() {
  try { return SS.rt.flags.get('c1bSummary') === undefined || SS.rt.flags.enabled('c1bSummary'); } catch (_) { return true; }
}
// Steam's own tab (the scope bar's segment) of the tabbed page that holds el, clicked as the laser does
function searchOpenTab(el, key) {
  try {
    const panel = el && el.closest('[role="tabpanel"]');
    const pid = panel ? panel.id || '' : '';
    const i = pid.lastIndexOf('_Content');
    const cur = i > 0 ? pid.slice(0, i) : '';
    const pre = cur.endsWith('All') ? cur.slice(0, -3) : null;
    const t = pre !== null ? el.ownerDocument.getElementById(pre + key) : null;
    if (t) { t.click(); return true; }
  } catch (_) { /* no tab */ }
  return false;
}
function searchListPatch(R) {
  const pred = (p, f) => {
    if (!f || (f.tag !== 14 && f.tag !== 15)) return false;
    const k = Object.keys(p);
    if (k.length !== 1 || k[0] !== 'results' || !Array.isArray(p.results)) return false;
    let host = null;
    try { host = R.fiber.firstHost(f); } catch (_) { host = null; }
    try { return !!(host && host.closest && host.closest(SS.rt.sel('%{GamepadSearch}'))); } catch (_) { return false; }
  };
  return R.patch.byProps('c1b.results', pred, (orig) => function (props, r) {
    const out = orig.call(this, props, r);
    if (!SS || !SS.C || !props || !Array.isArray(props.results)) return out;
    return R.jsx(SS.C.LgsResults, { results: props.results, out });
  }, { optional: true });
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

  // The snapshot host: a plain node React never fills; the clone is appended into it (WN §4.10).
  // Scroll offsets apply once a clone is in the document (a detached node keeps no scrollTop).
  function snapScroll(s) {
    for (const [el, top, left] of s.scroll) {
      if (!el.isConnected) continue;
      try { el.scrollTop = top; el.scrollLeft = left; } catch (_) { /* gone */ }
    }
  }
  function SnapHost() {
    const ref = React.useRef(null);
    React.useLayoutEffect(() => {
      const host = ref.current;
      const s = SS && SS.snap;
      if (!host || !s) return undefined;
      host.appendChild(s.node);
      if (s.title) host.appendChild(s.title);
      snapScroll(s);
      return () => {
        try { if (s.node.parentNode === host) host.removeChild(s.node); } catch (_) { /* gone */ }
        try { if (s.title && s.title.parentNode === host) host.removeChild(s.title); } catch (_) { /* gone */ }
      };
    }, [SS && SS.snap]);
    return jsx('div', { ref, className: 'lgs-snap', 'aria-hidden': 'true', inert: true });
  }
  // The sharp copy over the frosted picture, cut out under the sheet (21-search.css .lgs-snap-sharp)
  function FrostHost() {
    const ref = React.useRef(null);
    React.useLayoutEffect(() => {
      const host = ref.current;
      const s = SS && SS.snap;
      if (!host || !s || !s.frost) return undefined;
      host.appendChild(s.frost);
      snapScroll(s);
      return () => { try { if (s.frost.parentNode === host) host.removeChild(s.frost); } catch (_) { /* gone */ } };
    }, [SS && SS.snap]);
    return jsx('div', { ref, className: 'lgs-snap-sharp', 'aria-hidden': 'true', inert: true });
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

  function Plain(p) { return jsx('div', { className: p.className, children: p.children }); }
  function ZeroState(props) {
    const out = !!(props && props.out);
    // the outgoing copy holds no Focusable (no nav node of Steam's for 200 ms): plain boxes
    const Foc = out ? Plain : c.Focusable;
    const back = () => searchDismiss();
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
      kids.push(jsx(Foc, {
        className: 'lgs-search-row', 'flow-children': 'row', 'data-lgs-search': 'recent',
        children: games.map((g) => jsxs(Foc, {
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
      kids.push(jsx(Foc, {
        className: 'lgs-search-row', 'flow-children': 'row', 'data-lgs-search': 'recent-search',
        children: recent.map((q) => jsxs(Foc, {
          className: 'lgs-search-cap', noFocusRing: true, role: 'button',
          onActivate: () => { searchSetQuery(q); },
          onOKActionDescription: open, onCancel: back, onCancelActionDescription: backL,
          children: [svg('clock'), jsx('span', { children: q }, 't')],
        }, 'q:' + q)),
      }, 'searches'));
    }
    kids.push(jsxs(Foc, {
      className: 'lgs-search-foot', 'flow-children': 'row',
      children: [
        jsx(Foc, {
          className: 'lgs-search-cap', noFocusRing: true, role: 'button', 'data-lgs-search': 'seeall',
          onActivate: () => { if (SS) { SS.seeAll = true; searchNotify(); } },
          onOKActionDescription: open, onCancel: back, onCancelActionDescription: backL,
          children: [svg('grid'), jsx('span', { children: seeAll }, 't')],
        }, 'all'),
        hint ? jsx('div', { className: 'lgs-search-hint', children: hint }, 'hint') : null,
      ],
    }, 'foot'));
    // the outgoing copy of the cross-fade (zero state -> results): a picture of the zero state for 200 ms,
    // not a sheet any more (no tags), never focused
    if (out) return jsx('div', { className: 'lgs-search-zero is-out', 'aria-hidden': 'true', inert: true, children: kids });
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
    // zero state -> results: the zero state's content stays 200 ms as it fades out (WN §4.9 cross-fade),
    // while Steam's page fades in and the glass widens 880 -> 960 under both
    const wasZero = React.useRef(zero);
    const [fading, setFading] = React.useState(false);
    React.useLayoutEffect(() => {
      if (wasZero.current && !zero) {
        setFading(true);
        const off = rt.setTimeout(() => setFading(false), 200);
        wasZero.current = zero;
        return off;
      }
      wasZero.current = zero;
      return undefined;
    }, [zero]);
    React.useEffect(() => {
      if (!SS) return undefined;
      const s = SS;
      let html = null;
      try { html = R.nav.win().document.documentElement; } catch (_) { /* gone */ }
      if (html) html.classList.remove('lgs-c1b-leaving');
      s.leaving = false; s.left = false;
      if (s.P && typeof s.P.sound === 'function') { try { s.P.sound('sheetIn'); } catch (_) { /* no sound */ } }
      searchMoreRegister(s);
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
        s.leaving = false; s.left = false;
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
      jsx(FrostHost, {}, 'sharp'),
      jsx('div', { className: 'lgs-search-scrim', 'data-lgs-search-state': state }, 'scrim'),
      jsx('div', { className: 'lgs-search-glass', 'data-lgs-search': 'glass', 'data-lgs-search-state': state }, 'glass'),
    ] }), host, 'lgs-search-layer') : null;
    // Steam's page under a key that changes once, when the library-result patch first attaches
    // (searchLibEnsure): its tiles then render with X and ☰
    const steam = jsx(R.Fragment, { children: props.steam }, 'steam' + ((SS && SS.libGen) || 0));
    // the layer first and keyed (the portal's key): it never remounts while the sheet changes state, so the
    // snapshot, scrim and glass are presented once (review R2 M7: no re-present on the first keystroke)
    return jsxs(R.Fragment, { children: zero ? [layer, jsx(ZeroState, {}, 'zero')]
      : [layer, steam, fading && all ? jsx(ZeroState, { out: true }, 'zero-out') : null] });
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

  // ------------------------------------------------------------------ the All summary (above: searchListPatch)

  // art for a library card: `kind` 'hero' (Top Hit: custom hero first, with its logo) or 'portrait'
  // (posters); each failing URL steps to the next; a monogram last
  function Art({ app, kind }) {
    const A = React.useMemo(() => { try { return R.data.art(app.appid); } catch (_) { return null; } }, [app.appid]);
    const list = React.useMemo(() => {
      if (!A) return [];
      const L = (...xs) => [].concat(...xs.map((x) => (Array.isArray(x) ? x : (x ? [x] : [])))).filter(Boolean);
      const cu = A.custom || {};
      const out = [];
      if (kind === 'hero') {
        const logos = L(cu.logo, A.logo);
        for (const u of L(cu.hero, A.hero)) out.push({ src: u, logos });
        for (const u of L(A.header)) out.push({ src: u });
        for (const u of L(cu.portrait, A.portrait)) out.push({ src: u });
      } else {
        for (const u of L(cu.portrait, A.portrait)) out.push({ src: u });
        for (const u of L(A.header)) out.push({ src: u });
      }
      return out;
    }, [A, kind]);
    const [i, setI] = React.useState(0);
    const [li, setLi] = React.useState(0);
    const cur = list[i] || null;
    const logo = cur && cur.logos ? cur.logos[li] : null;
    const kids = [];
    if (cur) kids.push(jsx('img', { className: 'lgs-all-img', src: cur.src, alt: '', onError: () => setI(i + 1) }, 'a' + i));
    if (logo) kids.push(jsx('img', { className: 'lgs-all-logo', src: logo, alt: '', onError: () => setLi(li + 1) }, 'l' + li));
    if (!cur) kids.push(jsx('span', { className: 'lgs-all-mono', children: String(app.display_name || '?') }, 'm'));
    return jsx('div', { className: 'lgs-all-art', 'aria-hidden': 'true', children: kids });
  }

  // Steam's status line for a library card: playtime, or "Not installed"
  function appStatus(app) {
    try {
      const info = R.actions.primaryInfo(app.appid);
      if (info && info.action && info.action !== 'Play' && info.action !== 'Launch' && !app.minutes_playtime_forever) {
        const ni = R.ui.text('#BasicGameCarousel_NotInstalled', 'Not installed');
        if (ni) return ni;
      }
    } catch (_) { /* no status */ }
    const m = Number(app.minutes_playtime_forever) || 0;
    if (m >= 60) return R.ui.loc('#BasicGameCarousel_TotalPlayTime_Hours', (Math.round(m / 6) / 10).toFixed(1));
    if (m > 0) return R.ui.loc('#BasicGameCarousel_TotalPlayTime_Minutes', String(m));
    return null;
  }

  // a library card (Top Hit or poster): one target; A opens the game page (T3 action, logged in tests),
  // X Steam's primary action and ☰ Steam's menu (searchTileProps, also the More circle's host attribute)
  function AppCard({ app, hit, open }) {
    const name = app.display_name || '';
    const status = appStatus(app);
    const p = Object.assign({
      className: hit ? 'lgs-all-hit' : 'lgs-all-poster', noFocusRing: true,
      'data-lgs-search': hit ? 'tophit' : 'poster',
      onActivate: (e) => { R.actions.navigate(searchAppPath(R, app.appid), {}, e); },
      onOKActionDescription: open || undefined,
    }, searchTileProps(app));
    const kids = [jsx(Art, { app, kind: hit ? 'hero' : 'portrait' }, 'art')];
    if (hit) {
      const tag = searchStr(R, 'topHit');
      if (tag) kids.push(jsx('span', { className: 'lgs-all-tag', children: tag }, 'tag'));
      kids.push(jsx('span', { className: 'lgs-all-hit-name', children: name }, 'n'));
      if (status) kids.push(jsx('span', { className: 'lgs-all-hit-status', children: status }, 's'));
      if (open) kids.push(jsx('span', { className: 'lgs-all-open', 'aria-hidden': 'true', children: open }, 'o'));
    } else {
      kids.push(jsx('span', { className: 'lgs-all-poster-name', children: name }, 'n'));
      if (status) kids.push(jsx('span', { className: 'lgs-all-poster-status', children: status }, 's'));
    }
    return jsx(c.Focusable, Object.assign(p, { children: kids }));
  }

  // a program (S-A: the Top Hit; S-B: the Software cell), from a provider; A runs the provider's open
  function ProgramCard({ cand, hit, more, open }) {
    const c0 = cand.c;
    const nm = String(c0.name || '');
    let line = c0.subtitle || null;
    if (!hit && more > 0) line = R.ui.lang().startsWith('en') ? 'and ' + more + ' more' : '+' + more;
    const icon = c0.icon ? jsx('img', { src: c0.icon, alt: '' }) : jsx('span', { className: 'lgs-all-mono', children: nm.slice(0, 1).toUpperCase() });
    const kids = [];
    if (hit) {
      const tag = searchStr(R, 'topHit');
      if (tag) kids.push(jsx('span', { className: 'lgs-all-tag', children: tag }, 'tag'));
    }
    kids.push(jsx('span', { className: 'lgs-all-chip', 'aria-hidden': 'true', children: icon }, 'i'));
    kids.push(jsx('span', { className: 'lgs-all-prog-name', children: nm }, 'n'));
    if (line) kids.push(jsx('span', { className: 'lgs-all-prog-line', children: line }, 'l'));
    if (hit && open) kids.push(jsx('span', { className: 'lgs-all-open', 'aria-hidden': 'true', children: open }, 'o'));
    return jsx(c.Focusable, {
      className: hit ? 'lgs-all-hit lgs-all-prog' : 'lgs-all-soft', noFocusRing: true,
      'data-lgs-search': hit ? 'tophit' : 'software', 'aria-label': nm,
      // A and B only (REQ C2a->C1b #5 (d)): no X, no ☰, no More circle for programs
      onActivate: (e) => {
        try { cand.rec.spec.open && cand.rec.spec.open(c0, e, hit ? undefined : { slot: 'software', more }); }
        catch (err) { SS && SS.rt.warn('search: provider open failed', { id: cand.rec.spec.id, error: String(err && err.message || err) }); }
      },
      onOKActionDescription: open || undefined,
      children: kids,
    });
  }

  // a run of Steam's own results, through Steam's own grid (its tiles, handlers and virtualiser; the grid
  // measures the sheet's scroll element, and each run is at most a few rows, inside its overscan)
  function SteamRun({ Grid, results, scrollEl, width, cls }) {
    if (!Grid || !results.length) return null;
    return jsx('div', { className: 'lgs-all-run ' + (cls || ''), style: { width: width + 'px' }, children: jsx(Grid, { results, scrollElement: scrollEl, width }) });
  }

  // Steam's counts per category, from its own tab row (the scope bar) of this tabbed page
  function useTabCounts(ref, key) {
    const [counts, setCounts] = React.useState(null);
    React.useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const out = {};
      try {
        const panel = el.closest('[role="tabpanel"]');
        const pid = panel ? panel.id || '' : '';
        const pre = pid.endsWith('All_Content') ? pid.slice(0, -'All_Content'.length) : null;
        const d = el.ownerDocument;
        for (const k of ['All', 'Library', 'Friends', 'Store', 'Tools', 'Hidden']) {
          const t = pre ? d.getElementById(pre + k) : null;
          const n = t && t.querySelector(rt.sel('%{TabCount}'));
          const v = n ? parseInt(String(n.textContent).replace(/[^0-9]/g, ''), 10) : NaN;
          if (!Number.isNaN(v)) out[k] = v;
        }
      } catch (_) { /* tokens or ids: local counts */ }
      const keyOf = JSON.stringify(out);
      setCounts((prev) => (prev && JSON.stringify(prev) === keyOf ? prev : out));
    }, [key]);
    return counts || {};
  }

  function LgsAll({ results, Grid, scrollEl, q }) {
    const ref = React.useRef(null);
    useLive();
    const qn = searchNorm(q).trim();
    const lib = results.filter((r) => r && r.type === 'ownApp' && r.ownAppOverview);
    const store = results.filter((r) => r && (r.type === 'storeApp' || r.type === 'storeTag'));
    const friends = results.filter((r) => r && r.type === 'friend');
    const counts = useTabCounts(ref, results);
    // the Top Hit: Steam's library matches of the best tier, the most recently played; ties keep Steam's order
    let best = null;
    lib.forEach((r, i) => {
      const a = r.ownAppOverview;
      const t = searchTier(a.display_name, qn);
      const last = Number(a.rt_last_time_played) || 0;
      if (!best || t < best.tier || (t === best.tier && last > best.last)) best = { tier: t, r, last, i };
    });
    const steamBest = best ? { tier: best.tier, appid: best.r.ownAppOverview.appid } : null;
    // providers (S-A, S-B): a program is the Top Hit only with a strictly better tier than Steam's best
    const provKey = SS ? SS.providers.size : 0;
    const cands = React.useMemo(() => ({
      top: searchCandidates(q, 'tophit', steamBest),
      soft: searchCandidates(q, 'software', steamBest),
    }), [q, steamBest && steamBest.tier, steamBest && steamBest.appid, provKey]);
    const bestTier = steamBest ? steamBest.tier : 99;
    const progTop = cands.top.find((x) => (Number(x.c.tier) || 0) < bestTier) || null;
    const soft = cands.soft.filter((x) => !(progTop && x.rec === progTop.rec && x.c.key === progTop.c.key));
    const softMore = soft.length ? Math.max(0, (Number(soft[0].c.data && soft[0].c.data.matches) || soft.length) - 1 - (progTop ? 1 : 0)) : 0;
    const open = searchStr(R, 'open');
    // row 1: the Top Hit and the next four library matches in Steam's order
    const libOrder = best ? [best.r].concat(lib.filter((r) => r !== best.r)) : lib.slice();
    const row1 = [];
    if (progTop) row1.push(jsx(ProgramCard, { cand: progTop, hit: true, open }, 'p:' + progTop.c.key));
    const libShown = libOrder.slice(0, progTop ? 4 : 5);
    libShown.forEach((r, i) => row1.push(jsx(AppCard, { app: r.ownAppOverview, hit: !progTop && i === 0, open }, 'a:' + r.ownAppOverview.appid)));
    const rest = lib.filter((r) => libShown.indexOf(r) < 0);
    // row 2: the Software cell, then Steam's first store results and See All (Steam's Store tab)
    const nStore = soft.length ? 2 : 3;
    const pitch = 189; // Steam's result item (177) + its padding (12)
    const kids = [];
    if (row1.length) {
      kids.push(jsx(c.Focusable, { className: 'lgs-all-row1', 'flow-children': 'row', 'data-lgs-search': 'library', children: row1 }, 'r1'));
    }
    const row2 = [];
    if (soft.length) {
      const h = searchStr(R, 'software');
      row2.push(jsxs('div', { className: 'lgs-all-block lgs-all-block-soft', children: [
        h ? jsx('h3', { className: 'lgs-all-h', children: h }, 'h') : null,
        jsx(ProgramCard, { cand: soft[0], hit: false, more: softMore, open }, 's'),
      ] }, 'soft'));
    }
    if (store.length) {
      const n = counts.Store != null ? counts.Store : store.length;
      const h = R.ui.loc('#Search_Results_Header_StoreApps_With_Count', String(n)) || searchStr(R, 'store');
      const seeAll = searchStr(R, 'seeAll');
      row2.push(jsxs('div', { className: 'lgs-all-block lgs-all-block-store', children: [
        h ? jsx('h3', { className: 'lgs-all-h', children: h }, 'h') : null,
        jsxs(c.Focusable, { className: 'lgs-all-storerow', 'flow-children': 'row', 'data-lgs-search': 'store', children: [
          jsx(SteamRun, { Grid, results: store.slice(0, nStore), scrollEl, width: nStore * pitch - 12, cls: 'lgs-all-run-store' }, 'g'),
          store.length > nStore || counts.Store > nStore ? jsx(c.Focusable, {
            className: 'lgs-search-cap lgs-all-seeall', noFocusRing: true, role: 'button', 'data-lgs-search': 'seeall-store',
            onActivate: () => searchOpenTab(ref.current, 'Store'), onOKActionDescription: open || undefined,
            children: [jsx('span', { children: seeAll }, 't'), svg('chev')],
          }, 'all') : null,
        ] }, 'row'),
      ] }, 'store'));
    }
    if (row2.length) kids.push(jsx('div', { className: 'lgs-all-row2', children: row2 }, 'r2'));
    // below the fold, in Steam's order: the other library matches, then friends
    if (rest.length) {
      const h = searchStr(R, 'library');
      kids.push(jsx('h3', { className: 'lgs-all-h', children: h }, 'hl'));
      kids.push(jsx(SteamRun, { Grid, results: rest, scrollEl, width: 5 * pitch - 12, cls: 'lgs-all-run-lib' }, 'gl'));
    }
    if (friends.length) {
      const n = counts.Friends != null ? counts.Friends : friends.length;
      const h = R.ui.loc('#Search_Results_Header_Friends_With_Count', String(n)) || searchStr(R, 'friends');
      kids.push(jsx('h3', { className: 'lgs-all-h', children: h }, 'hf'));
      kids.push(jsx(SteamRun, { Grid, results: friends, scrollEl, width: 5 * pitch - 12, cls: 'lgs-all-run-friends' }, 'gf'));
    }
    kids.unshift(jsx('div', { ref, className: 'lgs-all-anchor', 'aria-hidden': 'true' }, 'anchor'));
    // for tests (the relocation check of G-AUD): where each of Steam's results is, by Steam's id
    if (SS) {
      const id = (r) => String(r.id);
      SS.lastSummary = {
        q, tophit: progTop ? 'program:' + progTop.c.name : (best ? id(best.r) : null),
        row1: libShown.map(id), store: store.slice(0, nStore).map(id), rest: rest.map(id), friends: friends.map(id),
        storeTab: store.slice(nStore).map(id), redirect: results.filter((r) => r && r.type === 'redirectLink').map(id),
        software: soft.length ? { name: soft[0].c.name, more: softMore } : null, steamBest,
      };
    }
    return jsx(c.Focusable, { className: 'lgs-all', 'flow-children': 'column', 'data-lgs-search': 'summary', children: kids });
  }

  // Steam's results list, patched (searchListPatch): its own output on every category; on All, the summary
  function LgsResults({ results, out }) {
    useLive();
    let path = '';
    try { path = R.nav.route(); } catch (_) { path = ''; }
    const onAll = /^\/search\/?$/.test(path) || /^\/search\/tab\/all\/?$/i.test(path);
    // decided while the route is All, then kept by this list (an All panel leaving on LB / RB stays as it was)
    const mode = React.useRef(null);
    if (onAll || mode.current === null) mode.current = onAll ? 'all' : 'steam';
    // with no query (the zero state's See All) All stays Steam's list of everything
    const q = searchQuery();
    if (mode.current !== 'all' || !SS || !searchSummaryOn() || !results.length || !q.trim()) return out;
    let Grid = null, scrollEl = null;
    try {
      const fr = out.props.children.props.children;
      const probe = typeof fr === 'function' ? fr({ width: 932, height: 400 }) : null;
      if (probe && probe.type && probe.props && probe.props.scrollElement) { Grid = probe.type; scrollEl = probe.props.scrollElement; }
    } catch (_) { Grid = null; }
    if (!Grid) return out;
    return jsx(LgsAll, { results, Grid, scrollEl, q });
  }

  return { SearchRoute, LgsResults };
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
    lastCard: null, source: null, restoreFor: null, restored: 0, leaving: false, hdrAt: 0,
    appMenu: null, libHandle: null, listHandle: null, libGen: 0, patchSeen: {}, moreH: null, moreOwner: null };
  SS.query = searchQuery();
  // library results: X = Play and ☰ = Steam's item menu (optional: the results keep A and B without them)
  const am = searchFindAppMenu(R);
  SS.appMenu = am.menu;
  if (!am.menu) rt.warn('search: Steam app menu not found; no item menu on results', am.error || am.count);
  try { SS.libHandle = searchLibResultPatch(R); SS.handles.push(SS.libHandle); }
  catch (e) { SS.libHandle = null; rt.warn('search: library-result patch failed; results keep A and B only', String(e && e.message || e)); }
  // the All summary (Q6): without it All is Steam's own grid in the sheet
  try { SS.listHandle = searchListPatch(R); SS.handles.push(SS.listHandle); }
  catch (e) { SS.listHandle = null; rt.warn('search: results-list patch failed; All is the Steam grid', String(e && e.message || e)); }
  rt.windows.track((w) => {
    if (w.kind !== 'main') return undefined;
    w.html.classList.add('lgs-c1b');
    const offF = rt.listen(w.doc, 'focusin', searchOnFocusIn, true);
    // Steam's gamepad focus (its vgp_onfocus event on the newly focused node; DOM focus does not follow
    // the D-pad everywhere): the card to give focus back to after search (AT-9c)
    const offG = rt.listen(w.doc, 'vgp_onfocus', (ev) => searchTrackFocus(ev.target), true);
    // a click on a field that kept DOM focus (no new focusin) activates too
    const offC = rt.listen(w.doc, 'pointerdown', (ev) => { if (ev.target === searchField()) searchOnFocusIn(ev); }, true);
    const offI = rt.listen(w.doc, 'input', searchOnInput, true);
    // a click on the dimmed page (inside the route's content, outside the sheet) leaves search (WN §4.4)
    const offD = rt.listen(w.doc, 'click', searchOnDimClick);
    // the header: Steam's × (query re-read) and the Back circle (Steam's own HideModal)
    const offH = rt.listen(w.doc, 'click', searchOnHeaderClick, true);
    // B inside the sheet: leave search (capture, before Steam's Focusables see it)
    const offB = rt.listen(w.doc, 'vgp_oncancel', searchOnCancel, true);
    // while the sheet dissolves (200 ms before Steam navigates back), nothing on it acts
    const offL = ['vgp_onok', 'vgp_onbuttondown', 'click'].map((t) => rt.listen(w.doc, t, searchOnLeavingInput, true));
    return () => {
      w.html.classList.remove('lgs-c1b', 'lgs-c1b-leaving', 'lgs-c1b-presented');
      offF(); offG(); offC(); offI(); offD(); offH(); offB(); offL.forEach((f) => f());
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
    summary: () => (SS && SS.lastSummary ? JSON.parse(JSON.stringify(SS.lastSummary)) : null),
    // tests: the focus memory (AT-9c) and the dismiss state
    debug: () => (SS ? {
      leaving: !!SS.leaving, restored: SS.restored || 0, restoredOk: SS.restoredOk || 0,
      source: SS.source ? { route: SS.source.route, w: Math.round(SS.source.w), h: Math.round(SS.source.h), sig: SS.source.sig } : null,
      lastCard: SS.lastCard ? { route: SS.lastCard.route, w: Math.round(SS.lastCard.w), h: Math.round(SS.lastCard.h) } : null,
      cancels: SS.cancels || 0, appMenu: !!SS.appMenu, libPatch: SS.libHandle ? { count: SS.libHandle.count, live: SS.libHandle.live } : null,
      listPatch: SS.listHandle ? { count: SS.listHandle.count, live: SS.listHandle.live } : null, summary: searchSummaryOn(),
      libGen: SS.libGen, more: !!SS.moreH,
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
  try { if (s.moreH) s.moreH.remove(); } catch (_) { /* gone with C1a's helper */ }
  s.moreH = null; s.moreOwner = null; s.appMenu = null; s.libHandle = null; s.listHandle = null;
  try {
    const d = s.R.nav.win().document;
    for (const e of d.querySelectorAll('.lgs-search-layer')) e.remove();
    d.documentElement.classList.remove('lgs-c1b', 'lgs-c1b-leaving', 'lgs-c1b-presented');
    const tab = s.rt.sel('%{GamepadTabbedPage>Tab}');
    for (const e of d.querySelectorAll('[data-lgs-exempt="E-SEG"]')) if (e.matches(tab)) e.removeAttribute('data-lgs-exempt');
    for (const e of d.querySelectorAll('[data-lgs-q]')) e.removeAttribute('data-lgs-q');
  } catch (_) { /* gone */ }
  // the library-result patch went with s.handles (P2 restores the memo); its tiles keep our props only
  // until Steam renders them again, and Steam's page is left at once on removal (P2 re-enters the route)
  return { patchedLeft: 0 };
}
