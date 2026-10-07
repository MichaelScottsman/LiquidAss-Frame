// Glass Shell runtime module "library" (package C2c): the library catalogue's T2.
// Concept: docs/phase2/concepts/home-apps.md (HA) §7, §7.1, §7.2; PLAN §1.10, §1.11.
// Contracts: runtime.md (P1: define, rt.*); C1a's shell API (ornamentSlots, the ornament's member
// tags) and More helper (more.register). Behind flag wp.c2c (PLAN §2.1); needs wp.c1a (deps).
// The DOM hooks are the contract with theme/40-library.css (its header lists them).
//
// What it does while installed:
//   - flag libFixedSlots (off, D-C2c-12): registers PLAN §1.10's five fixed ornament slots with C1a
//     (300 · 130 · 156 · 134 · 120, gap 4, padding 12 = 880 px); off, C1a's capsule hugs Steam's legends;
//   - registers posters as More hosts (C1a's one-per-document circle, placement 'card');
//   - copies Steam's current sort name (the pill's own text, or Steam's #Library_SortBy* string for
//     the grid's eSortBy) onto the Y legend's label (`data-lgs-lib-sort`), drawn by CSS as
//     "Sort By · <sort>" in gamepad mode; no new string;
//   - tags the tab row's segments `data-lgs-exempt="E-SEG"` (PLAN §1.16; the lab judges them as segments);
//   - tags empty collections (`data-lgs-empty`, Steam's own count of 0) so CSS can dim them.
// It never calls a Steam setter, never moves a React node and adds no nodes of its own. Every
// attribute it sets is removed on remove(); a missing Steam node only skips that step.

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
var LIB_TICK_MS = 250;

function libInstall(rt) {
  var shell = rt.use('shell');
  var more = rt.use('more');
  var S = LIB = { rt: rt, regs: [], marks: new Map(), sortNames: new Map(), sel: null };
  S.sel = {
    lib: rt.sel('%{GamepadLibrary}'),
    pill: rt.sel('%{SortAndFilterContainer}'),
    pillBtn: rt.sel('%{SortAndFilterButton}'),
    footer: '#Footer' + rt.sel('%{BasicFooter}') + ':not(' + rt.sel('%{FloatingVRFooter}') + ')',
    legend: rt.sel('%{ActionButtonLegend}'),
    label: rt.sel('%{ActionButtonLabel}'),
    grid: rt.sel('%{GridWithControls}'),
    coll: rt.sel('%{Collection}'),
    collCount: rt.sel('%{CollectionLabelCount}'),
    tab: rt.sel('%{GamepadTabbedPage>Tab}'),
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
  rt.setInterval(function () { libTick(S); }, LIB_TICK_MS);
  libTick(S);
  return {
    status: function () { return libStatus(S); },
    slots: function () { return { widths: LIB_SLOTS.widths.slice(), gap: LIB_SLOTS.gap, padding: LIB_SLOTS.padding }; },
  };
}

function libRemove() {
  var S = LIB;
  LIB = null;
  if (!S) return { patchedLeft: 0 };
  for (var i = 0; i < S.regs.length; i++) { try { S.regs[i].remove(); } catch (_) { /* gone */ } }
  S.regs.length = 0;
  if (S.slotReg) { try { S.slotReg.remove(); } catch (_) { /* gone */ } S.slotReg = null; }
  libClearMarks(S, null);
  return { patchedLeft: 0 };
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

// clear every mark except those on `keep` (a Set of "el|name" keys), or all of them
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

// ------------------------------------------------------------------ the tick
function libTick(S) {
  if (LIB !== S) return;
  var main = S.rt.windows.main();
  if (!main || !main.doc) return;
  var doc = main.doc;
  var want = new Map(); // el -> Set(names) we keep this tick
  function keep(el, name, value) {
    libMark(S, el, name, value);
    var s = want.get(el);
    if (!s) { s = new Set(); want.set(el, s); }
    s.add(name);
  }
  var lib = doc.querySelector(S.sel.lib);
  var footer = doc.querySelector(S.sel.footer);
  if (lib) {
    var pill = lib.querySelector(S.sel.pill);
    var pillOn = !!(pill && pill.getClientRects().length);

    // the current sort: the grid's eSortBy, named by the pill's own text when Steam shows it
    var grid = lib.querySelector(S.sel.grid);
    var eSort = grid ? libFiberProp(grid, 'eSortBy', 12) : undefined;
    var name = null;
    if (pillOn) {
      var b = pill.querySelector(S.sel.pillBtn);
      var t = b ? (b.textContent || '').trim() : '';
      if (t) { name = t; if (eSort !== undefined) S.sortNames.set(eSort, t); }
    }
    if (!name && eSort !== undefined) name = S.sortNames.get(eSort) || null;
    if (!name && eSort === 1) name = libLoc(S.rt, '#Library_SortByAlphabetical');
    if (footer && name) {
      var y = footer.querySelector('[data-lgs-btn="OPTIONS"]');
      var lab = y ? y.querySelector(S.sel.label) : null;
      if (lab) keep(lab, 'data-lgs-lib-sort', name);
    }

    // the tab row is a segmented control (HA §7, PLAN §1.16 E-SEG): contiguous 60 x >= 140 segments in
    // a horizontal scroller, judged by E-SEG's criterion rather than the 80 x 80 hit box
    var tabs = lib.querySelectorAll(S.sel.tab);
    for (var j = 0; j < tabs.length && j < 40; j++) keep(tabs[j], 'data-lgs-exempt', 'E-SEG');

    // empty collections (Steam's own count reads 0)
    var tiles = lib.querySelectorAll(S.sel.coll);
    for (var i = 0; i < tiles.length && i < 200; i++) {
      var c = tiles[i].querySelector(S.sel.collCount);
      var n = c ? (c.textContent || '').replace(/[^0-9]/g, '') : '';
      if (n === '0') keep(tiles[i], 'data-lgs-empty', '');
    }
  }
  libClearMarks(S, want);
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
  };
}
