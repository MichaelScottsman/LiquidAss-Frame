// Glass Shell runtime module "library" (package C2c): the library catalogue's T2.
// Concept: docs/phase2/concepts/home-apps.md (HA) §7, §7.1, §7.2, §9; PLAN §1.10, §1.11.
// Contracts: runtime.md (P1: define, rt.*); interaction.md (P3: the global dwell selector reads
// [data-lgs-dwell]); C1a's shell API (ornamentSlots, the ornament's member tags) and More helper
// (more.register). Behind flag wp.c2c (PLAN §2.1); needs wp.c1a (deps).
// The DOM hooks are the contract with theme/40-library.css (its header lists them).
//
// What it does while installed:
//   - flag libFixedSlots (off, D-C2c-12): registers PLAN §1.10's five fixed ornament slots with C1a
//     (300 · 130 · 156 · 134 · 120, gap 4, padding 12 = 880 px); off, C1a's capsule hugs Steam's legends;
//   - registers posters as More hosts (C1a's one-per-document circle, placement 'card');
//   - copies Steam's current sort name onto the Y legend's label (`data-lgs-lib-sort`), drawn by CSS as
//     "Sort By · <sort>" in gamepad mode: the pill's own text when Steam shows it, else Steam's
//     #Library_SortBy* string for the grid's eSortBy; no new string;
//   - tags the tab row's segments `data-lgs-exempt="E-SEG"` (PLAN §1.16; the lab judges them as segments);
//   - marks the library root `data-lgs-lib="c2c"` (the legacy 'card' layer's exclude, REQ C2c->P6);
//   - tags collection tiles as dwell hosts (`data-lgs-dwell`, P3's global laser dwell: Steam's tile is a
//     role=link div that the default dwell selector skips) and empty collections (`data-lgs-empty`,
//     Steam's own count of 0) so CSS can lift them under the laser and dim the empties;
//   - Library Filters: keeps the gamepad-focused row inside the sheet's scrolling body (on open, Steam's
//     default focus can sit below the card's edge; review R2 Q3), with a wheel-equivalent scrollIntoView;
//   - T3, flag libScrubber (on with wp.c2c): the letter scrubber, our own node docked at the end of Steam's
//     grid scroller (HA §7, D-C2c-18);
//   - T3, flag libFilterChips (on with wp.c2c): a P2 props patch on Steam's filter section component
//     (flow-children "grid" and the class lgs-lib-chips) so CSS can draw its options as toggle capsules
//     (HA §9, D-C2c-17).
// Nothing runs at idle (review R2 M14): the work is driven by Steam's main-window history (route changes),
// by narrow MutationObservers on library routes only (the footer, the pill, the tab strip, the
// collection tiles), by Steam's vgp_onfocus events (Filters sheet, scrubber) and the grid's scrollend.
// It never calls a Steam setter and never moves a React node; its only nodes are the scrubber's, and
// its only Steam call is BTakeFocus with the mouse source after a scrubber jump (D-C2c-18). Every
// attribute, node and patch is removed on remove(); a missing Steam node only skips that step.

/* eslint-disable no-var */
__LGS_RT.define({
  name: 'library',
  deps: ['shell', 'more'],
  flag: 'wp.c2c',
  install(rt) { return libInstall(rt); },
  remove() { return libRemove(); },
});

var LIB = null;
var LIB_SLOTS = { widths: [300, 130, 156, 134, 120], gap: 4, padding: 12 };
// Steam's ESortBy (module 11726 on build 11094443) -> the strings Steam's own sort menu shows
// (module 71395's sort-name switch). The pill's live text wins whenever Steam renders it.
var LIB_SORT_TOKENS = {
  1: '#Library_SortByAlphabetical',
  2: '#Library_SortByPctAchievementsComplete',
  3: '#Library_SortByLastUpdated',
  4: '#Library_SortByHoursPlayed',
  5: '#Library_SortByLastPlayed',
  6: '#Library_SortByReleaseDate',
  7: '#Library_SortByAddedToLibrary',
  8: '#Library_SortBySizeOnDisk',
  9: '#Library_SortByMetacriticScore',
  10: '#Library_SortByFriendsPlaying',
  11: '#Library_SortBySteamReview',
};

function libInstall(rt) {
  var shell = rt.use('shell');
  var more = rt.use('more');
  var S = LIB = {
    rt: rt, regs: [], marks: new Map(), sortNames: new Map(), sel: null,
    mo: {}, nodes: {}, pending: false, scans: 0, doc: null,
    scrub: null, scrubBlocked: new WeakSet(), chips: null, chipsTried: new WeakSet(),
    cnt: { letters: 0, geom: 0, follow: 0 },
  };
  S.sel = {
    lib: rt.sel('%{GamepadLibrary}'),
    pill: rt.sel('%{SortAndFilterContainer}'),
    pillBtn: rt.sel('%{SortAndFilterButton}'),
    footer: '#Footer' + rt.sel('%{BasicFooter}') + ':not(' + rt.sel('%{FloatingVRFooter}') + ')',
    label: rt.sel('%{ActionButtonLabel}'),
    grid: rt.sel('%{GridWithControls}'),
    coll: rt.sel('%{Collection}'),
    collCount: rt.sel('%{CollectionLabelCount}'),
    tab: rt.sel('%{GamepadTabbedPage>Tab}'),
    tabStrip: rt.sel('%{FixCenterAlignScroll}'),
    filterCard: rt.sel('%{DialogWrapper}') + ':has(> ' + rt.sel('%{DialogWrapper>CompatFilterDialog}') + ')',
    filterBody: rt.sel('%{DialogWrapper>DialogBody}'),
    filterSection: rt.sel('%{FilterBucket}'),
    cssGrid: rt.sel('%{CSSGrid}'),
    poster: rt.sel('%{LibraryItemBox}'),
    scroller: rt.sel('%{TabContentsScroll}'),
    sectionHeader: rt.sel('%{AppGridSectionHeader}'),
  };
  S.slotReg = null;
  function applySlots() {
    var on = rt.flags.enabled('libFixedSlots');
    if (on && !S.slotReg) S.slotReg = shell.ornamentSlots('library', LIB_SLOTS);
    else if (!on && S.slotReg) { try { S.slotReg.remove(); } catch (_) { /* gone */ } S.slotReg = null; }
  }
  applySlots();
  rt.flags.on('libFixedSlots', applySlots);
  S.regs.push(more.register('%{GamepadLibrary} %{LibraryItemBox}', { placement: 'card' }));
  // T3 parts: the Filters toggle capsules (libFilterChips) and the letter scrubber (libScrubber), both on
  // by default while wp.c2c is on
  libChipsInstall(S);
  rt.flags.on('libFilterChips', function () {
    if (libChipsWanted(S)) libChipsInstall(S);
    else if (S.chips) { try { S.chips.remove(); } catch (_) { /* gone */ } S.chips = null; }
  });
  rt.flags.on('libScrubber', function () { libSoon(S, [0]); });

  // route changes: Steam's own history of the main window (React mounts the new route after the event,
  // so the scan runs again a little later)
  try {
    var inst = rt.W.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
    var un = inst.m_history.listen(function () { libSoon(S, [0, 200, 700, 1500]); });
    rt.cleanup(function () { try { un(); } catch (_) { /* gone */ } });
  } catch (e) {
    // no history: a slow re-scan keeps the tags current (never expected on build 11094443)
    rt.warn('no history listener; 2 s re-scan instead', String(e && e.message || e));
    rt.setInterval(function () { libScan(S); }, 2000);
  }
  // the main window (and its replacement if Steam re-creates it)
  rt.windows.track(function (entry) {
    if (!entry || entry.kind !== 'main') return null;
    return libAttachMain(S, entry);
  });
  libSoon(S, [0, 500]);
  return {
    status: function () { return libStatus(S); },
    slots: function () { return { widths: LIB_SLOTS.widths.slice(), gap: LIB_SLOTS.gap, padding: LIB_SLOTS.padding }; },
    scan: function () { libScan(S); return libStatus(S); },
    // test hook (HA AT-14 c): pick a letter as a laser click on the scrubber would; returns what it did
    scrubTo: function (letter) { return libScrubTest(S, letter); },
  };
}

function libRemove() {
  var S = LIB;
  LIB = null;
  if (!S) return { patchedLeft: 0 };
  for (var i = 0; i < S.regs.length; i++) { try { S.regs[i].remove(); } catch (_) { /* gone */ } }
  S.regs.length = 0;
  if (S.slotReg) { try { S.slotReg.remove(); } catch (_) { /* gone */ } S.slotReg = null; }
  libScrubUnmount(S);
  if (S.chips) { try { S.chips.remove(); } catch (_) { /* gone */ } S.chips = null; }
  libDisconnect(S, null);
  libClearMarks(S, null);
  return { patchedLeft: 0 };
}

// ------------------------------------------------------------------ main window wiring
function libAttachMain(S, entry) {
  var rt = S.rt;
  S.doc = entry.doc;
  // the input mode decides whether Steam renders the laser pill (it carries the sort name)
  var H = rt.W;
  var mo = new H.MutationObserver(function () { libSoon(S, [0, 300]); });
  try { mo.observe(entry.html, { attributes: true, attributeFilter: ['data-lgs-vr-mode'] }); } catch (_) { /* closed */ }
  // Library Filters: keep the gamepad focus inside the sheet's scrolling body (Steam's own scroll does
  // not run for the default focus on open); vgp_onfocus is Steam's focus event on the newly focused node
  var offFocus = rt.listen(entry.doc, 'vgp_onfocus', function (ev) {
    var t = ev && ev.target;
    libFilterFocus(S, t);
    // the scrubber's current letter follows gamepad focus in the grid
    if (S.scrub && t && S.scrub.grid && S.scrub.grid.contains(t)) {
      try { H.requestAnimationFrame(function () { libScrubFollow(S); }); } catch (_) { /* closed */ }
    }
  }, { capture: true, passive: true });
  libSoon(S, [0, 300]);
  return function () {
    try { mo.disconnect(); } catch (_) { /* gone */ }
    try { offFocus(); } catch (_) { /* gone */ }
    if (S.doc === entry.doc) { libDisconnect(S, null); S.doc = null; }
  };
}

// schedule scans at these delays (ms); repeated requests coalesce per delay
function libSoon(S, delays) {
  if (LIB !== S) return;
  for (var i = 0; i < delays.length; i++) {
    (function (ms) {
      if (ms === 0) {
        if (S.pending) return;
        S.pending = true;
        S.rt.setTimeout(function () { S.pending = false; libScan(S); }, 0);
      } else {
        S.rt.setTimeout(function () { libScan(S); }, ms);
      }
    })(delays[i]);
  }
}

// one observer per role; re-pointed when Steam replaces the node
function libObserve(S, role, node, opts) {
  var cur = S.mo[role];
  if (cur && cur.node === node) return;
  if (cur) { try { cur.mo.disconnect(); } catch (_) { /* gone */ } delete S.mo[role]; }
  if (!node) return;
  var mo = new S.rt.W.MutationObserver(function () { libSoon(S, [0]); });
  try { mo.observe(node, opts); } catch (_) { return; }
  S.mo[role] = { node: node, mo: mo };
}

function libDisconnect(S, keep) {
  Object.keys(S.mo).forEach(function (role) {
    if (keep && keep[role]) return;
    try { S.mo[role].mo.disconnect(); } catch (_) { /* gone */ }
    delete S.mo[role];
  });
}

// ------------------------------------------------------------------ attributes we own
function libMark(S, el, name, value) {
  if (!el) return;
  if (value === null || value === undefined) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
    var set0 = S.marks.get(el);
    if (set0) { set0.delete(name); if (!set0.size) S.marks.delete(el); }
    return;
  }
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  var set = S.marks.get(el);
  if (!set) { set = new Set(); S.marks.set(el, set); }
  set.add(name);
}

// clear every mark except those in `keep` (Map el -> Set of names), or all of them
function libClearMarks(S, keep) {
  S.marks.forEach(function (names, el) {
    names.forEach(function (name) {
      if (keep && keep.has(el) && keep.get(el).has(name)) return;
      try { el.removeAttribute(name); } catch (_) { /* gone */ }
      names.delete(name);
    });
    if (!names.size || !el.isConnected) S.marks.delete(el);
  });
}

function libFiberProp(el, key, depth) {
  try {
    var k = Object.keys(el).find(function (x) { return x.indexOf('__reactFiber') === 0; });
    var f = k ? el[k] : null;
    for (var i = 0; f && i < (depth || 12); i++, f = f.return) {
      var p = f.memoizedProps;
      if (p && typeof p === 'object' && p[key] !== undefined) return p[key];
    }
  } catch (_) { /* none */ }
  return undefined;
}

function libLoc(rt, token) {
  try {
    var W = rt.W;
    var lm = W.LocalizationManager;
    var s = lm && typeof lm.LocalizeString === 'function' ? lm.LocalizeString(token) : null;
    if (!s && typeof W.LocalizeString === 'function') s = W.LocalizeString(token);
    return s && s !== token ? String(s) : null;
  } catch (_) { return null; }
}

// ------------------------------------------------------------------ the scan (event-driven)
function libScan(S) {
  if (LIB !== S) return;
  S.scans++;
  var main = S.rt.windows.main();
  if (!main || !main.doc) return;
  var doc = main.doc;
  var want = new Map(); // el -> Set(names) we keep this scan
  function keep(el, name, value) {
    libMark(S, el, name, value);
    var s = want.get(el);
    if (!s) { s = new Set(); want.set(el, s); }
    s.add(name);
  }
  var lib = doc.querySelector(S.sel.lib);
  var footer = doc.querySelector(S.sel.footer);
  if (!lib) {
    // not a library route: no observers, no marks, no scrubber
    libScrubUnmount(S);
    libDisconnect(S, null);
    libClearMarks(S, null);
    return;
  }
  // the library root carries the package's mark: the hook for retiring Phase 1's legacy 'card' pop on
  // library posters (REQ C2c->P6: its exclude), and nothing else
  keep(lib, 'data-lgs-lib', 'c2c');
  var pill = lib.querySelector(S.sel.pill);
  var strip = lib.querySelector(S.sel.tabStrip);
  var tiles = lib.querySelectorAll(S.sel.coll);
  libObserve(S, 'footer', footer, { childList: true, subtree: true, characterData: true });
  libObserve(S, 'pill', pill, { childList: true, subtree: true, characterData: true });
  libObserve(S, 'strip', strip, { childList: true });
  libObserve(S, 'tiles', tiles.length ? tiles[0].parentElement : null, { childList: true, subtree: true, characterData: true });

  // the current sort: the pill's own text when Steam shows it (laser mode), else Steam's string for the
  // grid's eSortBy
  // (shown or not: from the style alone; getClientRects forced the new route's whole layout at each scan)
  var pillOn = !!(pill && (typeof pill.checkVisibility === 'function' ? pill.checkVisibility() : pill.getClientRects().length));
  var grid = lib.querySelector(S.sel.grid);
  var eSort = grid ? libFiberProp(grid, 'eSortBy', 12) : undefined;
  var name = null;
  if (pillOn) {
    var b = pill.querySelector(S.sel.pillBtn);
    var t = b ? (b.textContent || '').trim() : '';
    if (t) { name = t; if (eSort !== undefined) S.sortNames.set(eSort, t); }
  }
  if (!name && eSort !== undefined) name = S.sortNames.get(eSort) || null;
  if (!name && eSort !== undefined && LIB_SORT_TOKENS[eSort]) {
    name = libLoc(S.rt, LIB_SORT_TOKENS[eSort]);
    if (name) S.sortNames.set(eSort, name);
  }
  if (footer && name) {
    var y = footer.querySelector('[data-lgs-btn="OPTIONS"]');
    var lab = y ? y.querySelector(S.sel.label) : null;
    if (lab) keep(lab, 'data-lgs-lib-sort', name);
  }

  // the tab row is a segmented control (HA §7, PLAN §1.16 E-SEG): contiguous 60 x >= 140 segments in a
  // horizontal scroller, judged by E-SEG's criterion rather than the 80 x 80 hit box
  var tabs = lib.querySelectorAll(S.sel.tab);
  for (var j = 0; j < tabs.length && j < 40; j++) keep(tabs[j], 'data-lgs-exempt', 'E-SEG');

  // collection tiles: dwell hosts (P3), and the empties (Steam's own count reads 0)
  for (var i = 0; i < tiles.length && i < 200; i++) {
    keep(tiles[i], 'data-lgs-dwell', '');
    var c = tiles[i].querySelector(S.sel.collCount);
    var n = c ? (c.textContent || '').replace(/[^0-9]/g, '') : '';
    if (n === '0') keep(tiles[i], 'data-lgs-empty', '');
  }

  // the letter scrubber on an Alphabetical grid (T3)
  var cssGrid = grid ? grid.querySelector(S.sel.cssGrid) : null;
  var scroller = lib.querySelector(S.sel.scroller);
  if (grid && cssGrid && scroller) libScrubMount(S, lib, grid, cssGrid, scroller, eSort);
  else libScrubUnmount(S);
  if (S.scrub && S.scrub.gw) keep(S.scrub.gw, 'data-lgs-scrub', '');
  libClearMarks(S, want);
}

// ------------------------------------------------------------------ Library Filters: focus in view
// Steam's vgp_onfocus on a node inside the Filters sheet: after layout settles, if the focused node is
// not wholly inside the sheet's scrolling body (less its scroll-padding), scroll it into view
// ('nearest', a wheel-equivalent; Steam's handlers and focus are untouched).
function libFilterFocus(S, target) {
  if (LIB !== S || !target || typeof target.closest !== 'function') return;
  var card = null;
  try { card = target.closest(S.sel.filterCard); } catch (_) { return; }
  if (!card) return;
  libChipsOnOpen(S, card);
  var W = S.rt.W;
  var run = function () {
    if (LIB !== S || !target.isConnected) return;
    var body = card.querySelector(S.sel.filterBody);
    var sc = body && body.scrollHeight > body.clientHeight + 1 ? body : card;
    var r = target.getBoundingClientRect(), b = sc.getBoundingClientRect();
    var cs = sc.ownerDocument.defaultView.getComputedStyle(sc);
    var pt = parseFloat(cs.scrollPaddingTop) || 0, pb = parseFloat(cs.scrollPaddingBottom) || 0;
    if (r.top < b.top + pt - 1 || r.bottom > b.bottom - pb + 1) {
      try { target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { /* gone */ }
    }
  };
  // twice: once the frame after Steam's own handling, once after the sheet's entry settles
  try { W.requestAnimationFrame(function () { W.requestAnimationFrame(run); }); } catch (_) { run(); }
  S.rt.setTimeout(run, 360);
}

// ------------------------------------------------------------------ the letter scrubber (T3, HA §7)
// Flag libScrubber (default on while wp.c2c is on; `libScrubber=false` turns it off). Shown only on a
// library grid sorted Alphabetical (Steam's eSortBy 1, no section headers) with at least 4 rows. A 60 x 340
// recessed capsule (80 wide hit) at the window's trailing edge (x 1196, y 270-610); its letters are the
// first characters of the titles in Steam's own order (Steam's appOverviews prop of the grid, which is
// already sorted; digits and other signs read "#"), so no string is added. Laser: a click or a drag maps y
// to a letter and sets the grid scroller's scrollTop to that letter's first row (a wheel-equivalent; Steam's
// virtualizer renders the rows; Steam's focus is untouched). Gamepad: passive (no focusable), the current
// letter follows the focused poster; Steam's fast scroll stays the pad path. The grid's columns step in by
// 72 px while it is mounted (D-C2c-2); if Steam's grid then has fewer than 6 columns or a gap under 16 px,
// it unmounts and the padding goes.
var LIB_SCRUB = { top: 270, height: 340, x: 1196, w: 60, hit: 80, slot: 20 };

function libFlagDefaultOn(rt, name) {
  var v = rt.flags.get(name);
  return v === undefined ? true : rt.flags.enabled(name);
}

function libLetterOf(o) {
  var s = String((o && (o.sort_as || o.display_name)) || '').trim();
  if (!s) return '#';
  var c = s.charAt(0);
  try { c = c.normalize('NFD').charAt(0); } catch (_) { /* old engine */ }
  c = c.toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
}

function libScrubData(S, gw) {
  var ov = libFiberProp(gw, 'appOverviews', 12);
  if (!Array.isArray(ov)) return null;
  var sc = S.scrub;
  if (sc && sc.ov === ov) return sc.data;
  var letters = [], first = {}, per = new Array(ov.length);
  for (var i = 0; i < ov.length; i++) {
    var l = libLetterOf(ov[i]);
    per[i] = l;
    if (first[l] === undefined) { first[l] = i; letters.push(l); }
  }
  var data = { ov: ov, letters: letters, first: first, per: per, n: ov.length };
  S.cnt.letters++;
  if (sc) { sc.ov = ov; sc.data = data; }
  return data;
}

// grid geometry: columns from Steam's CSS grid, row pitch and origin calibrated on a rendered poster.
// Cached per list (Steam's appOverviews array) and grid node, so scrolling does no layout reads; `fresh`
// recalibrates (a pick, a mount)
function libScrubGeom(S, lib, grid, scroller, data, fresh) {
  var sc = S.scrub;
  var now = Date.now();
  // a measure taken while the page still runs its entry transition (C1c's slide on route and tab entry)
  // is not kept: posters move inside the scroller then
  if (!fresh && sc && sc.geom && sc.geom.ov === data.ov && sc.geom.grid === grid && sc.geom.at - sc.mountedAt > 900) return sc.geom;
  var g = libScrubMeasure(S, lib, grid, scroller, data);
  S.cnt.geom++;
  if (g && sc) { g.ov = data.ov; g.grid = grid; g.at = now; sc.geom = g; }
  return g;
}

function libScrubMeasure(S, lib, grid, scroller, data) {
  var cs = grid.ownerDocument.defaultView.getComputedStyle(grid);
  var cols = (cs.gridTemplateColumns || '').split(' ').filter(Boolean).length;
  var gap = parseFloat(cs.columnGap) || 0;
  var rowGap = parseFloat(cs.rowGap) || 0;
  var posters = grid.querySelectorAll(S.sel.poster);
  var cal = null;
  for (var i = 0; i < posters.length && i < 24; i++) {
    var p = posters[i];
    if (p.classList.contains('gpfocus') || p.classList.contains('lgs-dwell')) continue;
    var app = libFiberProp(p, 'app', 14);
    var id = app && app.appid;
    if (id === undefined) continue;
    var idx = -1;
    for (var j = 0; j < data.ov.length; j++) { if (data.ov[j] && data.ov[j].appid === id) { idx = j; break; } }
    if (idx < 0) continue;
    var r = p.getBoundingClientRect(), sr = scroller.getBoundingClientRect();
    cal = { idx: idx, top: r.top - sr.top + scroller.scrollTop, h: r.height };
    break;
  }
  if (!cols || !cal) return null;
  var pitch = cal.h + rowGap;
  var origin = cal.top - Math.floor(cal.idx / cols) * pitch;
  return { cols: cols, gap: gap, pitch: pitch, origin: origin, scTop: scroller.getBoundingClientRect().top };
}

// a grid split into sort sections ("Over 10 hours" ...) has a visible header with text; Steam keeps one
// empty header node on Alphabetical
function libHasSections(S, lib) {
  var hs = lib.querySelectorAll(S.sel.sectionHeader);
  for (var i = 0; i < hs.length; i++) {
    var r = hs[i].getBoundingClientRect();
    if (r.height > 8 && (hs[i].textContent || '').trim()) return true;
  }
  return false;
}

function libScrubMount(S, lib, gw, grid, scroller, eSort) {
  var rt = S.rt;
  var on = libFlagDefaultOn(rt, 'libScrubber') && eSort === 1 && !S.scrubBlocked.has(gw) && !libHasSections(S, lib);
  var data = on ? libScrubData(S, gw) : null;
  if (on && (!data || data.n < 24 || data.letters.length < 2)) on = false;
  if (!on) { libScrubUnmount(S); return; }
  var sc = S.scrub;
  if (sc && sc.node && sc.node.isConnected && sc.dock && sc.dock.parentNode === scroller && sc.lib === lib && sc.grid === grid && sc.scroller === scroller && sc.gw === gw) {
    libScrubRender(S, data);
    libScrubPlace(S);
    return;
  }
  libScrubUnmount(S);
  var doc = lib.ownerDocument, W = doc.defaultView;
  sc = S.scrub = { lib: lib, gw: gw, grid: grid, scroller: scroller, ov: data.ov, data: data, node: null, cur: null, drag: false, letter: null, offs: [], mountedAt: Date.now() };
  // the grid's columns step in, so the scrubber has its own column (D-C2c-2)
  libMark(S, gw, 'data-lgs-scrub', '');
  var node = doc.createElement('div');
  node.className = 'lgs-lib-scrub';
  node.setAttribute('data-lgs-nopop', '');
  node.setAttribute('aria-hidden', 'true');
  var track = doc.createElement('div');
  track.className = 'lgs-lib-scrub-track';
  node.appendChild(track);
  var list = doc.createElement('div');
  list.className = 'lgs-lib-scrub-list';
  node.appendChild(list);
  var cur = doc.createElement('div');
  cur.className = 'lgs-lib-scrub-cur';
  node.appendChild(cur);
  // docked at the end of the grid's own scroller, in a zero-height sticky wrapper held at the scroller's
  // bottom edge, so the scrubber composites with the scrolling content (a fixed node over the scroller
  // cost 5-13 % of its scroll rate, perfab6/7, 2026-10-07); CSS places it at x 1186-1266, y 270-610
  var dock = doc.createElement('div');
  dock.className = 'lgs-lib-scrub-dock';
  dock.appendChild(node);
  scroller.appendChild(dock);
  sc.dock = dock;
  sc.node = node; sc.list = list; sc.curNode = cur;
  libScrubPlace(S);
  // laser: click or drag; pointer capture keeps the drag on the scrubber
  var onDown = function (ev) {
    if (ev.button !== undefined && ev.button !== 0) return;
    sc.drag = true;
    try { node.setPointerCapture(ev.pointerId); } catch (_) { /* synthetic */ }
    node.classList.add('is-active');
    libScrubPick(S, ev.clientY, true);
    ev.preventDefault();
  };
  var onMove = function (ev) { if (sc.drag) libScrubPick(S, ev.clientY, false); };
  var onUp = function (ev) {
    if (!sc.drag) return;
    sc.drag = false;
    node.classList.remove('is-active');
    try { node.releasePointerCapture(ev.pointerId); } catch (_) { /* gone */ }
  };
  sc.offs.push(rt.listen(node, 'pointerdown', onDown));
  sc.offs.push(rt.listen(node, 'pointermove', onMove));
  sc.offs.push(rt.listen(node, 'pointerup', onUp));
  sc.offs.push(rt.listen(node, 'pointercancel', onUp));
  sc.offs.push(rt.listen(node, 'lostpointercapture', onUp));
  // the current letter: the scroll position once a scroll ends (laser), or the focused poster (gamepad).
  // Nothing runs per scroll frame: reading the scroll position inside Steam's virtualized scroll forced
  // an extra layout every frame (18 % of the grid's scroll rate, perfab4, 2026-10-07)
  // (Chromium's scrollend: no listener runs while the grid scrolls)
  sc.offs.push(rt.listen(scroller, 'scrollend', function () { libScrubFollow(S); }, { passive: true }));
  libScrubRender(S, data);
  rt.setTimeout(function () { if (S.scrub === sc) libScrubFollow(S); }, 1000);
  // Steam's grid after the padding: still 6 columns with gaps >= 16, else no scrubber
  W.requestAnimationFrame(function () {
    W.requestAnimationFrame(function () {
      if (S.scrub !== sc) return;
      var cs = W.getComputedStyle(grid);
      var cols = (cs.gridTemplateColumns || '').split(' ').filter(Boolean).length;
      var row = grid.querySelectorAll(S.sel.poster);
      var gapOk = true;
      if (row.length > 1) {
        var a = row[0].getBoundingClientRect(), b = row[1].getBoundingClientRect();
        if (Math.abs(a.top - b.top) < 2) gapOk = (b.left - a.right) >= 16;
      }
      if (cols < 6 || !gapOk) {
        rt.log('scrubber unmounted: grid has ' + cols + ' columns after the padding', { gapOk: gapOk });
        S.scrubBlocked.add(gw);
        libScrubUnmount(S);
      } else {
        libScrubFollow(S);
      }
    });
  });
}

// the dock is the scroller's content box held at its bottom padding edge; the column goes to x 1186-1266
// and y 270-610 of the window (the scroller spans the window, y 40-720): offsets from the scroller's padding
function libScrubPlace(S) {
  var sc = S.scrub;
  if (!sc || !sc.node) return;
  var cs = sc.scroller.ownerDocument.defaultView.getComputedStyle(sc.scroller);
  var pr = parseFloat(cs.paddingRight) || 0, pb = parseFloat(cs.paddingBottom) || 0;
  var right = Math.round(1280 - LIB_SCRUB.x - (LIB_SCRUB.hit + LIB_SCRUB.w) / 2 - pr);
  var bottom = Math.round((720 - LIB_SCRUB.top - LIB_SCRUB.height) - pb);
  sc.node.style.setProperty('--lgs-scrub-right', right + 'px');
  sc.node.style.setProperty('--lgs-scrub-bottom', bottom + 'px');
}

function libScrubUnmount(S) {
  var sc = S.scrub;
  if (!sc) return;
  S.scrub = null;
  for (var i = 0; i < sc.offs.length; i++) { try { sc.offs[i](); } catch (_) { /* gone */ } }
  try { if (sc.dock) sc.dock.remove(); else if (sc.node) sc.node.remove(); } catch (_) { /* gone */ }
  if (sc.gw) libMark(S, sc.gw, 'data-lgs-scrub', null);
}

// letters in the column: each letter has its own position (i / (n - 1) of the list's height, so a drag
// passes every letter); as many as fit at 20 px are drawn, every s-th one, with a 6 px dot standing for
// the letters skipped between two drawn ones (iOS's condensed index)
function libScrubRender(S, data) {
  var sc = S.scrub;
  if (!sc || !sc.list) return;
  var key = data.letters.join('');
  if (sc.key === key) return;
  sc.key = key;
  var doc = sc.list.ownerDocument;
  while (sc.list.firstChild) sc.list.removeChild(sc.list.firstChild);
  var n = data.letters.length, H = LIB_SCRUB.height - 40;
  var step = 1;
  while (step < n) {
    var shown = Math.ceil(n / step), dots = step > 1 ? shown - 1 : 0;
    if (shown * LIB_SCRUB.slot + dots * 6 + (shown + dots - 1) * 2 <= H) break;
    step++;
  }
  sc.step = step;
  for (var i = 0; i < n; i++) {
    var kind = i % step === 0 ? 'l' : (i % step === Math.floor(step / 2) && i < n - 1 ? 'dot' : null);
    if (i === n - 1 && i % step !== 0 && n > 1) kind = 'l';
    var s = doc.createElement('span');
    s.setAttribute('data-l', data.letters[i]);
    s.style.setProperty('--lgs-scrub-at', (n > 1 ? i / (n - 1) : 0).toFixed(4));
    if (kind === 'l') { s.className = 'lgs-lib-scrub-l'; s.textContent = data.letters[i]; }
    else if (kind === 'dot') s.className = 'lgs-lib-scrub-dot';
    else s.className = 'lgs-lib-scrub-at';
    sc.list.appendChild(s);
  }
}

// y on the scrubber -> a letter (every letter has an equal share of the list's height)
function libScrubPick(S, clientY, first) {
  var sc = S.scrub;
  if (!sc) return;
  var data = libScrubData(S, sc.gw);
  if (!data) return;
  var r = sc.list.getBoundingClientRect();
  var t = (clientY - r.top) / Math.max(1, r.height);
  var k = Math.max(0, Math.min(data.letters.length - 1, Math.floor(t * data.letters.length)));
  var l = data.letters[k];
  if (!first && l === sc.letter) return;
  var geom = libScrubGeom(S, sc.lib, sc.grid, sc.scroller, data, first);
  if (!geom) return;
  var row = Math.floor(data.first[l] / geom.cols);
  // the letter's first row lands where the grid's first row rests (y 270 in the window)
  var top = geom.origin + row * geom.pitch - (LIB_SCRUB.top - geom.scTop);
  // Steam keeps a (stale, under the laser) focused poster in the grid; when the jump unmounts it, Steam
  // re-focuses another poster and scrolls to it (the view drifted by 24 rows, 2026-10-07). So the focus
  // follows the jump: once the letter's first poster is rendered it takes Steam's focus with the mouse
  // source (BTakeFocus(3): no input-mode flip), the same node Steam then keeps in view.
  var hadFocus = !!sc.grid.querySelector('.gpfocus, .gpfocuswithin');
  sc.scroller.scrollTop = Math.max(0, Math.round(top));
  if (hadFocus) libScrubRefocus(S, data.ov[data.first[l]], 0);
  sc.pickedAt = Date.now();
  if (l !== sc.letter) {
    sc.letter = l;
    libScrubShow(S, l);
    try { if (S.rt.sound) S.rt.sound('nav'); } catch (_) { /* no bus */ }
  }
}

function libScrubRefocus(S, app, tries) {
  var sc = S.scrub;
  if (!sc || !app || tries > 6) return;
  var W = S.rt.W;
  W.requestAnimationFrame(function () {
    if (S.scrub !== sc) return;
    var ps = sc.grid.querySelectorAll(S.sel.poster), el = null;
    for (var i = 0; i < ps.length; i++) {
      var a = libFiberProp(ps[i], 'app', 14);
      if (a && a.appid === app.appid) { el = ps[i]; break; }
    }
    if (!el) { libScrubRefocus(S, app, tries + 1); return; }
    try {
      var k = Object.keys(el).find(function (x) { return x.indexOf('__reactFiber') === 0; });
      for (var f = k ? el[k] : null, j = 0; f && j < 12; j++, f = f.return) {
        var n = f.memoizedProps && f.memoizedProps.node;
        if (n && typeof n.BTakeFocus === 'function') { n.BTakeFocus(3); break; }
      }
    } catch (_) { /* Steam's focus stays where it is */ }
  });
}

function libScrubTest(S, letter) {
  var sc = S.scrub;
  if (!sc) return { mounted: false };
  var data = libScrubData(S, sc.gw);
  var k = data ? data.letters.indexOf(letter) : -1;
  if (k < 0) return { mounted: true, letter: letter, found: false };
  var r = sc.list.getBoundingClientRect();
  var y = r.top + (k + 0.5) * r.height / data.letters.length;
  libScrubPick(S, y, true);
  var g = sc.geom;
  return { mounted: true, letter: letter, index: data.first[letter], row: g ? Math.floor(data.first[letter] / g.cols) : null,
    geom: g ? { cols: g.cols, pitch: g.pitch, origin: Math.round(g.origin), scTop: Math.round(g.scTop) } : null,
    scrollTop: Math.round(sc.scroller.scrollTop), shown: sc.letter };
}

// the current letter: the focused poster in gamepad mode, else the first row in view
function libScrubFollow(S) {
  var sc = S.scrub;
  if (!sc) return;
  S.cnt.follow++;
  // a pick shows the letter the user asked for, until the grid is scrolled some other way
  if (sc.drag || (sc.pickedAt && Date.now() - sc.pickedAt < 800)) return;
  var data = libScrubData(S, sc.gw);
  if (!data) return;
  var html = sc.lib.ownerDocument.documentElement;
  var l = null;
  if (!html.classList.contains('lgs-input-laser')) {
    var f = sc.grid.querySelector(S.sel.poster + '.gpfocus');
    var app = f ? libFiberProp(f, 'app', 14) : null;
    if (app) {
      for (var i = 0; i < data.ov.length; i++) { if (data.ov[i] && data.ov[i].appid === app.appid) { l = data.per[i]; break; } }
    }
  }
  if (!l) {
    var geom = libScrubGeom(S, sc.lib, sc.grid, sc.scroller, data);
    if (!geom) return;
    var row = Math.max(0, Math.ceil((sc.scroller.scrollTop + (LIB_SCRUB.top - geom.scTop) - geom.origin - 4) / geom.pitch));
    var idx = Math.min(data.n - 1, row * geom.cols);
    l = data.per[idx];
  }
  if (l && l !== sc.letter) { sc.letter = l; libScrubShow(S, l); }
  else if (l && !sc.curNode.textContent) libScrubShow(S, l);
}

function libScrubShow(S, l) {
  var sc = S.scrub;
  if (!sc) return;
  var el = null, kids = sc.list.children;
  for (var i = 0; i < kids.length; i++) { if (kids[i].getAttribute('data-l') === l) { el = kids[i]; break; } }
  if (!el) return;
  sc.curNode.textContent = l;
  sc.curNode.style.setProperty('--lgs-scrub-at', el.style.getPropertyValue('--lgs-scrub-at') || '0');
  sc.node.setAttribute('data-letter', l);
}

// ------------------------------------------------------------------ Library Filters: toggle capsules (T3)
// Flag libFilterChips (default on while wp.c2c is on). Steam renders each filter section (FilterBucket) as a
// Focusable with flow-children "column"; HA §9's toggle capsules wrap into lines, so the section's D-pad
// must follow what is drawn (D2 §12): a P2 props patch on that section component (props appFilter,
// fnOnChange, label, eGroup, options) changes only its flow-children to "grid" and adds the class
// lgs-lib-chips. Every Steam node, handler and string stays (C4a's primitives keep styling the section's
// drop-downs; the capsule's own rules restyle the check inside it); without the patch the T1 rows stay
// (CSS keys the capsules on the class).
function libChipsWanted(S) { return libFlagDefaultOn(S.rt, 'libFilterChips'); }

function libChipsInstall(S) {
  var rt = S.rt;
  if (S.chips || !libChipsWanted(S) || !rt.has('react')) return;
  var R;
  try { R = rt.use('react'); R.ready(); } catch (e) { rt.log('filter chips: no T3', String(e && e.message || e)); return; }
  var React = R.React;
  var pred = function (p) {
    return !!(p && typeof p === 'object' && p.appFilter && typeof p.fnOnChange === 'function' &&
      Array.isArray(p.options) && p.eGroup !== undefined && Object.prototype.hasOwnProperty.call(p, 'label'));
  };
  try {
    S.chips = R.patch.byProps('c2c.filterSection', pred, function (orig) {
      return function (props, r) {
        var out = orig.call(this, props, r);
        try {
          if (!LIB || !libChipsWanted(LIB) || !out || !out.props || out.props['flow-children'] === undefined) return out;
          return React.cloneElement(out, {
            'flow-children': 'grid',
            className: ((out.props.className || '') + ' lgs-lib-chips').trim(),
          });
        } catch (_) { return out; }
      };
    }, { optional: true, max: 1 });
  } catch (e) {
    rt.warn('filter chips: patch failed; T1 rows stay', String(e && e.message || e));
    S.chips = null;
  }
}

// the sheet opened: attach a pending patch to the mounted sections, then re-render Steam's dialog once so
// the sections mount with the patched component (focus is on the compatibility rows, outside them)
function libChipsOnOpen(S, card) {
  var h = S.chips;
  if (!h || !card) return;
  if (card.querySelector('.lgs-lib-chips')) return;
  if (S.chipsTried.has(card)) return;
  S.chipsTried.add(card);
  try { if (typeof h.refresh === 'function') h.refresh(); } catch (_) { /* keep T1 */ }
  // Steam's dialog class (props appFilter, fnOnChange, closeModal) re-renders its sections
  var any = card.querySelector(S.sel.filterSection);
  var inst = null;
  try {
    var k = any ? Object.keys(any).find(function (x) { return x.indexOf('__reactFiber') === 0; }) : null;
    var f = k ? any[k] : null;
    for (var i = 0; f && i < 24; i++, f = f.return) {
      var p = f.memoizedProps;
      if (f.tag === 1 && p && p.appFilter && typeof p.closeModal === 'function' && f.stateNode && typeof f.stateNode.forceUpdate === 'function') { inst = f.stateNode; break; }
    }
  } catch (_) { inst = null; }
  if (inst) { try { inst.forceUpdate(); } catch (_) { /* keep T1 */ } }
}

function libStatus(S) {
  var main = S.rt.windows.main();
  var doc = main && main.doc;
  var lib = doc ? doc.querySelector(S.sel.lib) : null;
  var footer = doc ? doc.querySelector(S.sel.footer) : null;
  return {
    route: !!lib,
    fixedSlots: !!S.slotReg,
    fixed: footer ? footer.getAttribute('data-lgs-orn-fixed') : null,
    sort: Array.from(S.sortNames.entries()),
    marks: S.marks.size,
    observers: Object.keys(S.mo),
    scans: S.scans,
    scrubber: S.scrub ? {
      letters: S.scrub.data ? S.scrub.data.letters.join('') : '', letter: S.scrub.letter,
      geom: S.scrub.geom ? { cols: S.scrub.geom.cols, pitch: S.scrub.geom.pitch, origin: Math.round(S.scrub.geom.origin), scTop: Math.round(S.scrub.geom.scTop) } : null,
    } : null,
    counts: { letters: S.cnt.letters, geom: S.cnt.geom, follow: S.cnt.follow },
    chips: S.chips ? { count: S.chips.count, live: S.chips.live, pending: !!S.chips.pending, kinds: S.chips.kinds } : null,
  };
}
