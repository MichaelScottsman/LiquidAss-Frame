// device/rt/32-launcher.js (C2b): the bar's "+" popup (PLAN 2.4 C2b; HA 4, 5, 12.7).
//
// Flag wp.c2b (off until V1/V2 turn it on). Two tiers, each failing closed on its own:
//
// T2  On every barpopup window, from a MutationObserver (so the tags land before the first paint):
//       - Steam's own "Liquid Glass" row is tagged data-lgs-row="liquid-glass" by its text, so the
//         T1 grid (theme/32-launcher.css) draws its green "on" pip without the icon match;
//       - each "+" cell is tagged data-lgs-c2b-fit (HA 4 Labels, PLAN 1.16 E-GRID (labels)): "whole"
//         (the full name shows: one line, two lines by wrapping, or T3's two lines), "split" (T3's
//         two lines, the second ends in "..."), "word" (a word wider than the 70 px label) or
//         "lines" (more than two lines without T3): those two stay one line ending in "...".
//         Measured on a hidden probe with the label's own font and width. Without the tag (CSS
//         only) every label is one line with "...". No -webkit-line-clamp anywhere: Chromium draws
//         no ellipsis across inside a clamp, and the clamp's own "..." overflows the label when
//         the last word and the "..." do not fit (seen live: "Remote..", "System..");
//       - data-lgs-c2b-under on a cell with a plate: the row-mates whose labels its plate covers;
//       - data-lgs-c2b-col (0-3, the cell's grid column: the plate's placement) on each cell and
//         data-lgs-c2b-lbl on its label box (a bucketable key for the label rules);
//       - data-lgs-c2b-att on the attended cell (its name plate shows) and data-lgs-c2b-dim on the
//         row-mates its plate covers (their labels fade to .22). The CSS keys on these attributes
//         only: no previous-sibling :has(), no :nth-child, no :root inside :is() (perf.md 2.2 1,
//         5 1: those made the popup's first style recalc cost 500-800 ms). Recomputed in a
//         microtask (before paint) on any class change in the popup (gpfocus, P3's .lgs-dwell /
//         .lgs-attend-400, the html input-mode classes) and on mouseover / mouseout (:hover);
//       - a cell whose program has no icon is tagged data-lgs-c2b-glyph (terminal, gear, remote, screens,
//         display, camera) by keywords of its name, so the CSS can draw a distinct glyph (HA 0.3);
//       - with P3, rt.attend steps the cells at 400 ms (.lgs-attend-400) and each cell is tagged
//         data-lgs-c2b-step="400": the laser's name plate waits for 0.4 s of attention (HA 4, 11);
//         the gamepad's shows on focus.
//
// T3  P2's memo patch on the bar's "+" button (patch.targets.plusButton). The wrap does not call
//     hooks (P2 rule 9): it only rewrites the element tree Steam built for the popup:
//       - the program list (Steam's own DashboardBarPopupList and Steam's own rows, so Steam's
//         row components, launch calls, focus and T1 CSS all stay Steam's) is sorted A-Z with
//         Steam's collation; a name that does not fit one line is drawn as two explicit lines: the
//         longest run of words (or of parts after "/", HA 4) that fits 70 px, then the rest in its
//         own one-line box (.lgs-c2b-l2), which ends in "..." when it does not fit, cut at a word's
//         end rather than after a space (the text stays the stock name);
//       - while P2's actions run live (flag actionsLive, V1 at release; tests: flag c2bToggle),
//         the Liquid Glass row is taken out of the grid (HA-10: never default focus; Steam's
//         popup focuses its first focusable, which is now the first program);
//       - the list is wrapped in our panel (.lgs-c2b-panel, which also carries Steam's
//         DashboardBarPopupContents class so P6's barpopup cover covers it in native mode), and
//         Steam's own Liquid Glass row element is pinned below the grid, outside its focus group,
//         in a wrapper (.lgs-c2b-pin) that the CSS draws as HA 4's toggle row.
//     The pinned row's press applies the LQ10 order: when main is on one of our /library/lgs/* routes it
//     first navigates main to /library/home (replace) and waits for the route to settle
//     (PLAN-2b-3). Then it launches the switch through P2's logged launchNonSteam with the
//     command line from P2's scan (scanned once per module lifetime, then cached: review R2 m6).
//     It fails closed (review R2 B1): whenever that cannot run (P2's optional useNonSteamApps
//     finder is missing, the first scan has not answered yet, or launchNonSteam comes back
//     refused) the press goes to Steam's own switch row handler (the element taken out of the
//     grid, which calls Steam's LaunchNonSteamApp with the switch's strCmdline), gated by P2's
//     test reasons: run live, logged as "c2b.steamRow" in test mode. The row is never inert.
//
// Strings: the toggle title is the program's own name; "Glass Shell is on" is drawn only when
// Steam's UI language starts with "en" (PLAN 1.15). Nothing persists; remove() restores all.

const LAUNCHER_STATE = { cur: null };
const LG_NAME = 'Liquid Glass';
// a fragment of the switch's own icon as Steam encodes it (the T1 CSS match uses the same one)
const LG_ICON_MARK = 'zP9VZWZ7917z2Fx78vM6qqe7pHEinkTt9+rzKys9';
// HA 4 / 11: the laser's name plate after 0.4 s of attention
const PLATE_STEP_MS = 400;
// a plate that loses attention dissolves in place for PLATE_OUT_MS (data-lgs-c2b-out), then the cell's own
// label fades back in over PLATE_BACK_MS (data-lgs-c2b-back): 32-launcher.css 4. (mat-in's 250 ms, + a frame)
const PLATE_OUT_MS = 270;
const PLATE_BACK_MS = 270;
// HA 0.3: distinct glyphs for programs without an icon (decorative; the label names the program)
const GLYPHS = [
  [/terminal|konsole|console|\bshell\b/i, 'terminal'],
  [/remote/i, 'remote'],
  [/settings|preferences|config/i, 'gear'],
  [/screens/i, 'screens'],
  [/camera/i, 'camera'],
  [/desktop|display|monitor/i, 'display'],
];
const ATTRS = ['data-lgs-row', 'data-lgs-c2b-fit', 'data-lgs-c2b-glyph', 'data-lgs-c2b-step', 'data-lgs-c2b-under',
  'data-lgs-c2b-col', 'data-lgs-c2b-lbl', 'data-lgs-c2b-att', 'data-lgs-c2b-dim', 'data-lgs-c2b-out', 'data-lgs-c2b-back'];

__LGS_RT.define({
  name: 'launcher',
  deps: [],
  flag: 'wp.c2b',
  install(rt) {
    const S = {
      rt, R: null, handle: null, busy: false, t3: false, t3Error: null,
      marked: 0, fitted: 0, glyphs: 0, attend: false, fit: new WeakMap(), fitOf: new Map(),
      lgEntry: null, steamRowLog: [], test: { noScan: false },
    };
    LAUNCHER_STATE.cur = S;

    // ---------------------------------------------------------------- T2: tags, from an observer
    rt.windows.track((w) => {
      if (w.kind !== 'barpopup') return undefined;
      let queued = false, dimQueued = false;
      // tagged as its content mounts, hidden or not: a pooled popup is filled ahead of its open, so the open
      // itself has nothing left to tag (on the open it cost ~50 ms before the popup's first frame)
      const run = () => { queued = false; if (LAUNCHER_STATE.cur === S) tagPopup(S, w.doc); };
      const dimRun = () => { dimQueued = false; if (LAUNCHER_STATE.cur === S && w.visible()) attendTags(w.doc); };
      const dimSoon = () => { if (!dimQueued) { dimQueued = true; Promise.resolve().then(dimRun); } };
      let mo = null, moc = null;
      try {
        mo = new w.win.MutationObserver(() => { if (!queued) { queued = true; Promise.resolve().then(run); } });
        mo.observe(w.doc.body || w.doc.documentElement, { childList: true, subtree: true });
        // the attended cell: gamepad focus and P3's attention are classes, the input mode is a class on <html>
        moc = new w.win.MutationObserver(dimSoon);
        moc.observe(w.doc.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
      } catch (e) { rt.warn('launcher: no observer on a barpopup window (tags on show only)', String((e && e.message) || e)); }
      // :hover has no mutation
      const opt = { capture: true, passive: true };
      try { w.doc.addEventListener('mouseover', dimSoon, opt); w.doc.addEventListener('mouseout', dimSoon, opt); } catch (_) { /* gone */ }
      tagPopup(S, w.doc);
      return () => {
        try { if (mo) mo.disconnect(); } catch (_) { /* gone */ }
        try { if (moc) moc.disconnect(); } catch (_) { /* gone */ }
        try { w.doc.removeEventListener('mouseover', dimSoon, opt); w.doc.removeEventListener('mouseout', dimSoon, opt); } catch (_) { /* gone */ }
        untag(w.doc);
      };
    });
    // on show: a check after the popup's first frame (what changed while it was hidden is tagged already),
    // never in the show itself
    rt.windows.onShow((w) => {
      if (w.kind !== 'barpopup') return;
      try { w.win.requestAnimationFrame(() => rt.setTimeout(() => tagPopup(S, w.doc), 0)); } catch (_) { /* gone */ }
      rt.setTimeout(() => tagPopup(S, w.doc), 120);
    });

    // the laser's name plate waits for 0.4 s of attention (P3's steps); without P3 the CSS keys
    // the plate on P3's 80 ms dwell or :hover (the T1 floor)
    if (typeof rt.attend === 'function') {
      try {
        const isCell = cellTest(rt);
        const h = rt.attend(isCell, { dwellMs: 80, steps: [PLATE_STEP_MS], surfaces: ['barpopup'], classes: true });
        rt.cleanup(() => { try { h.off(); } catch (_) { /* gone */ } });
        S.attend = true;
      } catch (e) { rt.warn('launcher: no attention steps (the laser plate keys on the 80 ms dwell)', String((e && e.message) || e)); }
    }

    // ---------------------------------------------------------------- T3: the memo patch
    if (rt.has('react')) {
      try {
        installT3(S);
        S.t3 = true;
      } catch (e) {
        S.t3Error = String((e && e.message) || e);
        rt.warn('launcher T3 off (Steam\'s list and the T1 grid stay)', S.t3Error);
        if (S.handle) { try { S.handle.remove(); } catch (_) { /* gone */ } S.handle = null; }
      }
    } else {
      S.t3Error = 'react module not installed';
    }

    return {
      status: () => ({
        t3: S.t3, t3Error: S.t3Error, patch: S.handle ? { count: S.handle.count, live: S.handle.live } : null,
        marked: S.marked, fitted: S.fitted, glyphs: S.glyphs, attend: S.attend, splitMiss: S.splitMiss || 0,
        lgEntry: S.lgEntry ? { name: S.lgEntry.name, cmdline: S.lgEntry.cmdline } : null,
        steamRow: S.steamRowLog.slice(), test: Object.assign({}, S.test),
      }),
      // lab hooks (PLAN-2b-3, review R2 B1): run the toggle row's action path with a synthetic
      // event (in test mode P2 logs every call and runs none); forget the cached scan entry and
      // ignore P2's scan (as without the finder), so the fallback to Steam's own row is exercised
      toggleForTest: (cmdline) => runToggle(S, cmdline === null ? null : { cmdline: String(cmdline || 'lgs-test'), name: LG_NAME }, null, null),
      testNoScan: (on) => { S.test.noScan = !!on; S.lgEntry = null; return Object.assign({}, S.test); },
    };
  },
  remove() {
    const S = LAUNCHER_STATE.cur;
    LAUNCHER_STATE.cur = null;
    if (!S) return { patchedLeft: 0 };
    // an open "+" popup that shows our panel is closed, so nothing of ours stays drawn
    let closed = 0;
    try {
      const W = S.rt.W;
      for (const w of S.rt.windows.byKind('barpopup') || []) {
        if (w.visible() && w.doc.querySelector('.lgs-c2b-panel')) {
          const inst = W.SteamUIStore && W.SteamUIStore.WindowStore && W.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
          for (const p of (inst && inst.VRDashboardBarPopups) || []) { try { p.closePopup(); closed++; } catch (_) { /* gone */ } }
        }
      }
    } catch (_) { /* no windows */ }
    let patchedLeft = 0;
    if (S.handle) {
      try { S.handle.remove(); } catch (e) { patchedLeft = 1; }
      S.handle = null;
    }
    try { for (const w of S.rt.windows.byKind('barpopup') || []) untag(w.doc); } catch (_) { /* rt dead: track cleanup ran */ }
    return { patchedLeft, closed };
  },
});

// ------------------------------------------------------------------ helpers (file-private)

function untag(doc) {
  try {
    for (const a of ATTRS) for (const el of doc.querySelectorAll('[' + a + ']')) el.removeAttribute(a);
    for (const el of doc.querySelectorAll('.lgs-c2b-probe')) el.remove();
  } catch (_) { /* gone */ }
}

function launcherSels(rt) {
  const LIST = rt.sel('%{DashboardBarPopupList}') + ':has(> ' + rt.sel('%{DashboardBarPopupListHeader}') + ')';
  return {
    LIST,
    ITEM: rt.sel('%{DashboardBarPopupListItem}'),
    MC: rt.sel('%{Marquee>Content}'),
    ICON: rt.sel('%{PopupBody>Icon}'),
    FL: rt.sel('%{*GamepadDialogContent>FieldLabel}'),
    FI: rt.sel('%{*GamepadDialogContent>FieldIcon}'),
  };
}
function cellTest(rt) {
  let s = null;
  return (el) => {
    if (!s) s = launcherSels(rt);
    return !!(el && el.matches && el.matches(s.ITEM) && el.parentElement && el.parentElement.closest(s.LIST));
  };
}

// T2: the switch row's tag, each cell's label fit and glyph. Cheap when nothing changed: a cell is
// measured once per name (WeakMap), and the probe exists only while measuring.
function tagPopup(S, doc) {
  if (!S || LAUNCHER_STATE.cur !== S) return;
  try {
    for (const el of doc.querySelectorAll('[role=button]')) {
      if ((el.textContent || '').trim() === LG_NAME && el.getAttribute('data-lgs-row') !== 'liquid-glass') {
        el.setAttribute('data-lgs-row', 'liquid-glass');
        S.marked++;
      }
    }
  } catch (_) { return; /* window gone */ }
  let s;
  try { s = launcherSels(S.rt); } catch (_) { return; /* tokens not resolved yet */ }
  let cells;
  try { cells = doc.querySelectorAll(s.LIST + ' ' + s.ITEM); } catch (_) { return; }
  if (!cells.length) return;
  const todo = [];
  for (const c of cells) {
    const mc = c.querySelector(s.MC);
    if (!mc) continue;
    const name = mc.textContent || '';
    // keyed on the label's structure and the cell's column too: T3 may re-render the same name as
    // two lines, or in another place
    const l2 = mc.querySelector('.lgs-c2b-l2');
    const col = c.parentElement ? Array.prototype.indexOf.call(c.parentElement.children, c) % 4 : 0;
    if (c.getAttribute('data-lgs-c2b-col') !== String(col)) c.setAttribute('data-lgs-c2b-col', String(col));
    // the label box (the field label's child that is not the icon column): the label rules' key
    const fl = c.querySelector(s.FL);
    if (fl) for (const k of fl.children) { if (!k.matches(s.FI)) { if (!k.hasAttribute('data-lgs-c2b-lbl')) k.setAttribute('data-lgs-c2b-lbl', ''); break; } }
    const key = name + '\u0000' + col + (l2 ? '\u0000' + l2.getAttribute('data-fit') : '');
    if (S.fit.get(c) !== key) {
      // a label measured before (Steam renders new cells on every open): its verdict, no probe
      const known = S.fitOf.get(key);
      if (known) {
        if (c.getAttribute('data-lgs-c2b-fit') !== known.fit) c.setAttribute('data-lgs-c2b-fit', known.fit);
        if (c.getAttribute('data-lgs-c2b-under') !== known.under) c.setAttribute('data-lgs-c2b-under', known.under);
        S.fit.set(c, key);
      } else todo.push([c, mc, name, key, col]);
    }
    // the CSS keys the laser's plate on P3's 0.4 s step only where it is registered
    if (S.attend) { if (c.getAttribute('data-lgs-c2b-step') !== String(PLATE_STEP_MS)) c.setAttribute('data-lgs-c2b-step', String(PLATE_STEP_MS)); }
    else if (c.hasAttribute('data-lgs-c2b-step')) c.removeAttribute('data-lgs-c2b-step');
    const box = c.querySelector(s.ICON);
    if (box && !box.firstElementChild) {
      let g = 'window';
      for (const [rx, id] of GLYPHS) if (rx.test(name)) { g = id; break; }
      if (c.getAttribute('data-lgs-c2b-glyph') !== g) { c.setAttribute('data-lgs-c2b-glyph', g); S.glyphs++; }
    } else if (c.hasAttribute('data-lgs-c2b-glyph')) {
      c.removeAttribute('data-lgs-c2b-glyph');
    }
  }
  if (!todo.length) { attendTags(doc); return; }
  let probe = null;
  try {
    probe = doc.createElement('div');
    probe.className = 'lgs-c2b-probe';
    probe.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(probe);
    const lh = parseFloat(doc.defaultView.getComputedStyle(probe).lineHeight) || 18;
    for (const [c, mc, name, key, col] of todo) {
      let fit;
      const l2 = mc.querySelector('.lgs-c2b-l2');
      probe.className = 'lgs-c2b-probe';
      if (l2) {
        // T3 drew two lines: its own verdict on the second
        fit = l2.getAttribute('data-fit') === 'whole' ? 'whole' : 'split';
      } else {
        probe.textContent = name;
        // a word wider than the label overflows across; otherwise count the lines it wraps to
        fit = probe.scrollWidth > probe.clientWidth ? 'word' : (Math.round(probe.scrollHeight / lh) <= 2 ? 'whole' : 'lines');
      }
      if (c.getAttribute('data-lgs-c2b-fit') !== fit) c.setAttribute('data-lgs-c2b-fit', fit);
      // the row-mates whose labels the name plate covers (HA 4: they fade to .22), from the plate's
      // width in its own type and the CSS placement (32-launcher.css 4.)
      let under = '';
      if (fit !== 'whole') {
        probe.className = 'lgs-c2b-probe lgs-c2b-probe-w lgs-c2b-probe-plate';
        probe.textContent = name;
        under = plateUnder(col, probe.getBoundingClientRect().width);
      }
      if (c.getAttribute('data-lgs-c2b-under') !== under) c.setAttribute('data-lgs-c2b-under', under);
      S.fit.set(c, key);
      if (S.fitOf.size > 400) S.fitOf.clear();
      S.fitOf.set(key, { fit, under });
      S.fitted++;
    }
  } catch (e) {
    try { S.rt.warn('launcher: label fit not measured (the one-line floor stays)', String((e && e.message) || e)); } catch (_) { /* rt dead */ }
  } finally {
    try { if (probe) probe.remove(); } catch (_) { /* gone */ }
  }
  attendTags(doc);
}

// The attended cell (its name plate shows) and the row-mates its plate covers, as attributes, so the
// CSS needs no state logic across siblings. The attended cell, keyed on the input mode (P-01, P-02):
// .gpfocus unless the laser is the input; under the laser :hover after P3's 0.4 s step
// (.lgs-attend-400 on cells tagged data-lgs-c2b-step) or P3's 80 ms dwell without it; plain :hover
// with no input mode. Never a cell whose name shows whole. Covered row-mates: data-lgs-c2b-under
// (l1-l3, r1-r3), or every row-mate when it was not measured. Writes only what changed.
function attendTags(doc) {
  let cells;
  try { cells = doc.querySelectorAll('[data-lgs-c2b-col]'); } catch (_) { return; }
  if (!cells.length) return;
  const de = doc.documentElement;
  const laser = de.classList.contains('lgs-input-laser'), pad = de.classList.contains('lgs-input-pad');
  const att = new Set(), dim = new Set();
  for (const c of cells) {
    if (c.getAttribute('data-lgs-c2b-fit') === 'whole') continue;
    let on = false;
    try {
      if (!laser && c.classList.contains('gpfocus')) on = true;
      else if (laser) on = (c.hasAttribute('data-lgs-c2b-step') ? c.classList.contains('lgs-attend-400') : c.classList.contains('lgs-dwell')) && c.matches(':hover');
      else if (!pad) on = c.matches(':hover');
    } catch (_) { on = false; }
    if (!on) continue;
    att.add(c);
    const sibs = c.parentElement ? c.parentElement.children : [c];
    const i = Array.prototype.indexOf.call(sibs, c), row = Math.floor(i / 4);
    const under = c.getAttribute('data-lgs-c2b-under');
    const offs = under === null ? [-3, -2, -1, 1, 2, 3]
      : under.split(' ').filter(Boolean).map((t) => (t[0] === 'l' ? -1 : 1) * Number(t.slice(1)));
    for (const o of offs) {
      const j = i + o, m = sibs[j];
      if (m && Math.floor(j / 4) === row) dim.add(m);
    }
  }
  for (const c of cells) {
    const a = att.has(c), d = !a && dim.has(c);
    if (a !== c.hasAttribute('data-lgs-c2b-att')) {
      if (a) { plateLeaveEnd(c); c.setAttribute('data-lgs-c2b-att', ''); } else { c.removeAttribute('data-lgs-c2b-att'); plateLeave(c); }
    }
    if (d !== c.hasAttribute('data-lgs-c2b-dim')) { if (d) c.setAttribute('data-lgs-c2b-dim', ''); else c.removeAttribute('data-lgs-c2b-dim'); }
  }
}

// A plate that loses attention leaves in place (PLATE_OUT_MS), then its label fades back into the cell
// (PLATE_BACK_MS). Attention coming back cuts both short. Timers per cell; nothing after the runtime is gone.
const PLATE_LEAVE = new WeakMap();
function plateLeaveEnd(c) {
  const t = PLATE_LEAVE.get(c);
  if (t) { try { t.win.clearTimeout(t.id); } catch (_) { /* gone */ } PLATE_LEAVE.delete(c); }
  c.removeAttribute('data-lgs-c2b-out');
  c.removeAttribute('data-lgs-c2b-back');
}
function plateLeave(c) {
  plateLeaveEnd(c);
  const win = c.ownerDocument && c.ownerDocument.defaultView;
  if (!win || !LAUNCHER_STATE.cur) return;
  c.setAttribute('data-lgs-c2b-out', '');
  const back = () => {
    if (!LAUNCHER_STATE.cur || c.hasAttribute('data-lgs-c2b-att')) { PLATE_LEAVE.delete(c); return; }
    c.removeAttribute('data-lgs-c2b-out');
    c.setAttribute('data-lgs-c2b-back', '');
    PLATE_LEAVE.set(c, { win, id: win.setTimeout(() => { PLATE_LEAVE.delete(c); c.removeAttribute('data-lgs-c2b-back'); }, PLATE_BACK_MS) });
  };
  PLATE_LEAVE.set(c, { win, id: win.setTimeout(back, PLATE_OUT_MS) });
}

// Which row-mates' labels a name plate covers, in grid px (the grid is 4 x 72 = 288 wide; a label
// box spans its column's 1-71). The placement is the CSS's (32-launcher.css 4.): column 0 starts at
// 0, column 3 ends at 288, columns 1 and 2 are centred on 108 and 180 and kept inside 0-288. The
// plate is its text plus 2 x 14 px, at most 288. -> "l1 r1 r2" (left or right, by distance).
function plateUnder(col, textWidth) {
  const w = Math.min(288, textWidth + 28);
  let x0;
  if (col === 0) x0 = 0;
  else if (col === 3) x0 = 288 - w;
  else if (col === 1) x0 = Math.max(0, 108 - w / 2);
  else x0 = Math.min(180 + w / 2, 288) - w;
  const x1 = x0 + w, out = [];
  for (let k = 0; k < 4; k++) {
    if (k === col) continue;
    const ov = Math.min(x1, 72 * k + 71) - Math.max(x0, 72 * k + 1);
    if (ov > 1) out.push((k < col ? 'l' : 'r') + Math.abs(k - col));
  }
  return out.join(' ');
}

// The two lines of a name (HA 4): the longest run of tokens that fits MAXW on line 1 (tokens are
// words, and the parts of a word after "/", where a line may break), the rest on line 2. null when
// the name fits one line, or when its first token alone does not (one line ending in "...").
const LABEL_MAXW = 69.5;
// the label box itself: Chromium fits the "..." into exactly this
const LABEL_BOX = 70;
function splitLabel(label, width) {
  if (width(label) <= LABEL_MAXW) return null;
  const toks = [];
  const words = label.split(' ').filter(Boolean);
  words.forEach((w, wi) => {
    const parts = w.split(/(?<=\/)(?=.)/);
    parts.forEach((p, pi) => toks.push({ t: p, j: pi < parts.length - 1 ? '' : (wi < words.length - 1 ? ' ' : '') }));
  });
  if (toks.length < 2) return null;
  let best = 0, line = '';
  for (let i = 0; i < toks.length - 1; i++) {
    const cand = line + toks[i].t;
    if (width(cand) > LABEL_MAXW) break;
    best = i + 1;
    line = cand + toks[i].j;
  }
  if (!best) return null;
  const join = (a) => a.map((x, i) => x.t + (i < a.length - 1 ? x.j : '')).join('');
  const l1 = join(toks.slice(0, best)), l2 = join(toks.slice(best));
  if (width(l2) <= LABEL_MAXW) return { l1, j: toks[best - 1].j, l2, whole: true, w: 0 };
  // The second line ends in its own box's "..." (text-overflow; its text stays whole in the DOM).
  // Chromium cuts after the last character that fits with the "...", a space included ("System ..."):
  // where that cut lands just after a space, the box is made narrower than that, so the cut lands at
  // the word's end instead ("System..."), as Apple truncates.
  let k = l2.length - 1;
  for (; k > 0; k--) if (width(l2.slice(0, k) + '\u2026') <= LABEL_BOX) break;
  const vis = l2.slice(0, k);
  let w = 0;
  if (k > 0 && /\s$/.test(vis)) {
    const word = vis.trimEnd();
    const tight = width(word + '\u2026') + 1;
    if (tight < width(vis + '\u2026')) w = Math.ceil(tight * 2) / 2;
  }
  return { l1, j: toks[best - 1].j, l2, whole: false, w };
}

function isItem(el) {
  return !!(el && typeof el === 'object' && el.props && typeof el.props.onActivate === 'function' && 'label' in el.props);
}
function iconSrc(icon) {
  for (let el = icon, i = 0; el && typeof el === 'object' && i < 4; i++) {
    const p = el.props || {};
    if (typeof p.src === 'string') return p.src;
    el = Array.isArray(p.children) ? p.children[0] : p.children;
  }
  return '';
}
function isLgItem(el) {
  const p = el && el.props;
  if (!p) return false;
  if (typeof p.label === 'string' && p.label.trim() === LG_NAME) return true;
  return iconSrc(p.icon).includes(LG_ICON_MARK);
}
function isList(el) {
  return !!(el && typeof el === 'object' && el.props && 'header' in el.props && el.props.children != null);
}

function installT3(S) {
  const rt = S.rt;
  const R = rt.use('react');
  R.ready(); // throws when a required finder is missing (fail closed, P2 rule 2)
  S.R = R;
  const React = R.React, jsx = R.jsx, jsxs = R.jsxs, Focusable = R.c && R.c.Focusable;
  if (!Focusable) throw new Error('Focusable not found');
  const coll = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

  // two explicit lines (HA 4 Labels): measured on the probe, once per name for the module's
  // lifetime (only in a document where the theme's font has loaded)
  const splits = new Map();
  // the bar's document (always shown, the theme and its font loaded), else a barpopup's: every
  // window carries the same theme bundle, so the probe has the label's own type in either
  function probeDoc() {
    for (const kind of ['bar', 'barpopup']) {
      for (const w of rt.windows.byKind(kind) || []) {
        try { if (w.doc.body && w.doc.documentElement.classList.contains('lgs-on') && w.doc.fonts && w.doc.fonts.status === 'loaded') return w.doc; } catch (_) { /* gone */ }
      }
    }
    return null;
  }
  function splitOf(label) {
    if (splits.has(label)) return splits.get(label);
    const doc = probeDoc();
    if (!doc) { S.splitMiss = (S.splitMiss || 0) + 1; return null; }
    let probe = null, out = null;
    try {
      probe = doc.createElement('div');
      probe.className = 'lgs-c2b-probe lgs-c2b-probe-w';
      probe.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(probe);
      const width = (t) => { probe.textContent = t; return probe.getBoundingClientRect().width; };
      out = splitLabel(label, width);
    } catch (_) {
      out = null;
    } finally {
      try { if (probe) probe.remove(); } catch (_) { /* gone */ }
    }
    splits.set(label, out);
    return out;
  }
  function withLines(item) {
    const l = item.props.label;
    if (typeof l !== 'string') return item;
    const sp = splitOf(l);
    if (!sp) return item;
    // line 1 and its joiner, then line 2 in its own box (an inline-block, so it wraps below line 1
    // with no <br>: innerText and textContent stay the stock name); the plate shows it inline, whole
    return React.cloneElement(item, { label: jsx(React.Fragment, { children: [
      sp.l1 + sp.j,
      jsx('span', {
        className: 'lgs-c2b-l2',
        'data-fit': sp.whole ? 'whole' : 'cut',
        style: sp.w ? { '--lgs-c2b-l2w': sp.w + 'px' } : undefined,
        children: sp.l2,
      }, 'l2'),
    ] }) });
  }
  // Steam's program list: sorted A-Z, the switch row taken out (Steam's keys kept)
  function splitPrograms(list, keepLg) {
    const kids = [];
    React.Children.forEach(list.props.children, (k) => { if (k != null && typeof k !== 'boolean') kids.push(k); });
    if (!kids.length || !kids.every(isItem)) return null;
    let lg = null;
    const progs = [];
    for (const k of kids) { if (!lg && !keepLg && isLgItem(k)) lg = k; else progs.push(k); }
    progs.sort((a, b) => coll.compare(String(a.props.label || ''), String(b.props.label || '')));
    return { list: React.cloneElement(list, null, progs.map(withLines)), lg };
  }
  // the popup contents are one list (programs) or a stack of lists (windows, then programs)
  function transform(pc, keepLg) {
    if (isList(pc)) return splitPrograms(pc, keepLg);
    const kids = pc && pc.props ? React.Children.toArray(pc.props.children) : [];
    let at = -1;
    kids.forEach((k, i) => { if (isList(k)) at = i; });
    if (at < 0) return null;
    const t = splitPrograms(kids[at], keepLg);
    if (!t) return null;
    const next = kids.slice();
    next[at] = t.list;
    return { list: React.cloneElement(pc, null, next), lg: t.lg };
  }
  function contentsClass() {
    try { const s = rt.sel('%{DashboardBarPopupContents}'); return /^\.[\w-]+$/.test(s) ? s.slice(1) : ''; } catch (_) { return ''; }
  }

  // The pinned row (HA 4, HA-10) is Steam's own Liquid Glass row element: Steam's row component,
  // its Focusable, its icon and its label (G-AUD finds the same control). Only its press is ours:
  // the LQ10 order and P2's logged launch, falling back to Steam's own handler (runToggle, B1). The
  // platter, the subtitle and the switch are drawn by the CSS around it (.lgs-c2b-pin).
  function Pin(props) {
    // P2's hook (Steam's own scan carries the switch's strCmdline for P2's logged launch). It runs
    // only until one scan has answered in this module's lifetime (cached: review R2 m6); every
    // hook below runs on every render, so the hook order stays fixed. Without an entry the press
    // goes to Steam's own row handler (runToggle), so the row is never inert (B1).
    const scan = !S.lgEntry && !S.test.noScan;
    let apps = null;
    try { apps = R.data.useNonSteamApps({ enabled: scan, includeLiquidGlass: true }); } catch (_) { apps = null; }
    if (scan && Array.isArray(apps)) {
      const e = apps.find((a) => a && a.isLiquidGlass && typeof a.cmdline === 'string' && a.cmdline);
      if (e) S.lgEntry = { name: e.name, cmdline: e.cmdline };
    }
    const [busy, setBusy] = React.useState(false);
    const lg = props.lg;
    let lang = 'english';
    try { lang = String(R.ui.lang() || 'english'); } catch (_) { /* default */ }
    const sub = /^en/i.test(lang) ? 'Glass Shell is on' : undefined;
    const onActivate = (e) => {
      const p = runToggle(S, S.test.noScan ? null : S.lgEntry, e, lg);
      if (p && typeof p.then === 'function') {
        p.then((done) => {
          const last = done && done[done.length - 1];
          // the switch shows "off" only once a live press has really run it
          if (last && last.mode === 'executed') { try { setBusy(true); } catch (_) { /* unmounted */ } }
        }, () => { /* logged by P2 */ });
      }
    };
    return jsx('div', {
      className: 'lgs-c2b-pin',
      'data-lgs-sub': sub,
      'data-lgs-busy': busy ? 'true' : undefined,
      children: React.cloneElement(lg, { onActivate, bottomSeparator: 'none' }),
    });
  }
  function Panel(props) {
    const cls = contentsClass();
    // a nav container in a column: Down from any grid cell with nothing below it (the last
    // row, or a short last row) reaches the toggle row here instead of bubbling to the popup
    // frame, which would send focus to the bar and close the popup; Up returns to the grid's
    // last focused cell (Steam remembers the active child)
    return jsxs(Focusable, {
      className: 'lgs-c2b-panel' + (cls ? ' ' + cls : ''),
      'data-lgs-c2b': 't3',
      'flow-children': 'column',
      noFocusRing: true,
      children: [
        jsx(React.Fragment, { children: props.contents }, 'list'),
        props.lg ? jsx(Pin, { lg: props.lg }, 'lg') : null,
      ],
    });
  }

  S.handle = R.patch.byProps('c2b.plus', R.patch.targets.plusButton, (orig) => function (props, r) {
    const out = orig.call(this, props, r);
    if (LAUNCHER_STATE.cur !== S) return out;
    try {
      const pc = out && out.props && out.props.popupContents;
      if (!pc) return out;
      const keepLg = !toggleRowOn(rt);
      const t = transform(pc, keepLg);
      if (!t) return out;
      // without the toggle row Steam's own switch row stays in the (sorted) grid: no panel needed
      if (!t.lg) return React.cloneElement(out, { popupContents: t.list });
      return React.cloneElement(out, { popupContents: jsx(Panel, { contents: t.list, lg: t.lg }) });
    } catch (e) {
      try { rt.warn('launcher: patch render failed, Steam\'s list kept', String((e && e.message) || e)); } catch (_) { /* rt dead */ }
      return out;
    }
  });
  try { R.patch.rerender(S.handle); } catch (_) { /* shows at the next open */ }
  const again = () => { try { if (S.handle) R.patch.rerender(S.handle); } catch (_) { /* next open */ } };
  rt.flags.on('actionsLive', again);
  rt.flags.on('c2bToggle', again);
}

// The pinned toggle row replaces Steam's own switch row only while a user's press really runs
// P2's actions (actionsLive, set by V1 at release). Until then Steam's own row stays in the grid
// (it calls Steam's own handler, so the switch always works). Tests show the row with the flag
// c2bToggle while every action stays logged.
function toggleRowOn(rt) {
  try { return rt.flags.get('c2bToggle') === true || rt.flags.get('actionsLive') === true; } catch (_) { return false; }
}

// Steam's own switch row handler, for the cases P2's launch cannot cover (B1). Live: Steam's
// row's onActivate (Steam's LaunchNonSteamApp of the switch's strCmdline). Test mode (P2's rules,
// the same reasons as every action): logged as "c2b.steamRow", never run.
function steamRowPress(S, steamRow, ev, why) {
  const fn = steamRow && steamRow.props && steamRow.props.onActivate;
  const e = { t: Date.now(), fn: 'c2b.steamRow', arg: LG_NAME, mode: 'executed', reason: why };
  let reasons = [];
  try { reasons = S.R.actions.mode(ev).reasons || []; } catch (_) { reasons = ['test state unreadable (fail closed)']; }
  if (typeof fn !== 'function') { e.mode = 'refused'; e.reason = why + '; Steam\'s row handler missing'; }
  else if (reasons.length) { e.mode = 'logged'; e.reason = why + '; ' + reasons.join('; '); }
  else { try { fn(ev); } catch (err) { e.mode = 'error'; e.reason = why + '; ' + String((err && err.message) || err); } }
  S.steamRowLog.push(e);
  if (S.steamRowLog.length > 20) S.steamRowLog.splice(0, S.steamRowLog.length - 20);
  if (e.mode !== 'executed') {
    try { const t = S.rt.test && S.rt.test.actions; if (t && typeof t.record === 'function') t.record({ fn: e.fn, arg: e.arg, mode: e.mode, reason: e.reason, detail: null }); } catch (_) { /* no logger */ }
  }
  return { fn: e.fn, arg: e.arg, mode: e.mode, reason: e.reason };
}

// The toggle row's action (LQ10 order): leave our routes first, then the launch of the switch:
// P2's launchNonSteam with the scanned command line, or Steam's own row when that cannot run.
async function runToggle(S, entry, ev, steamRow) {
  const R = S && S.R;
  if (!R || S.busy) return null;
  S.busy = true;
  const done = [];
  try {
    let route = '';
    try { route = String(R.nav.route() || ''); } catch (_) { route = ''; }
    if (route.startsWith('/library/lgs/')) {
      done.push(R.actions.navigate('/library/home', { replace: true }, ev));
      let live = false;
      try { live = R.actions.mode(ev).mode === 'live'; } catch (_) { live = false; }
      if (live) {
        for (let i = 0; i < 30; i++) {
          let now = '';
          try { now = String(R.nav.route() || ''); } catch (_) { now = ''; }
          if (now === '/library/home') break;
          await new Promise((res) => setTimeout(res, 50));
        }
      }
    }
    let r = null;
    if (entry && entry.cmdline) r = R.actions.launchNonSteam(entry.cmdline, ev);
    if (!r) r = steamRowPress(S, steamRow, ev, 'no scanned command line for the switch (P2\'s finder missing or its first scan pending)');
    else if (r.mode === 'refused') r = steamRowPress(S, steamRow, ev, 'P2 launch refused: ' + (r.reason || ''));
    done.push(r);
    return done;
  } finally {
    S.busy = false;
  }
}
