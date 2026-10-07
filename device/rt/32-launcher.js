// device/rt/32-launcher.js (C2b): the bar's "+" popup (PLAN 2.4 C2b; HA 4, 5, 12.7).
//
// Flag wp.c2b (off until V1/V2 turn it on). Two tiers, each failing closed on its own:
//
// T2  Steam's own "Liquid Glass" row is tagged data-lgs-row="liquid-glass" by its text, so the
//     T1 grid (theme/32-launcher.css) draws its green "on" pip without the icon match.
//
// T3  P2's memo patch on the bar's "+" button (patch.targets.plusButton). The wrap does not call
//     hooks (P2 rule 9): it only rewrites the element tree Steam built for the popup:
//       - the program list (Steam's own DashboardBarPopupList and Steam's own rows, so Steam's
//         row components, launch calls, focus and T1 CSS all stay Steam's) is sorted A-Z with
//         Steam's collation;
//       - while P2's actions run live (flag actionsLive, V1 at release; tests: flag c2bToggle),
//         the Liquid Glass row is taken out of the grid (HA-10: never default focus; Steam's
//         popup focuses its first focusable, which is now the first program);
//       - the list is wrapped in our panel (.lgs-c2b-panel, which also carries Steam's
//         DashboardBarPopupContents class so P6's barpopup cover covers it in native mode), and
//         a pinned Liquid Glass toggle row is added below the grid, outside its focus group.
//     The toggle row launches the switch through P2's logged action and applies the LQ10 order:
//     when main is on one of our /library/lgs/* routes it first navigates main to /library/home
//     (replace) and waits for the route to settle (PLAN-2b-3). In test mode both calls are
//     logged, never run.
//     It fails closed (review R2 B1): Steam's own switch row element rides along in the pinned
//     slot, and whenever P2's launch cannot run (the optional useNonSteamApps finder is missing,
//     its scan has not answered yet, or launchNonSteam comes back refused) the press goes to
//     Steam's own row handler instead (live), or is logged as "c2b.steamRow" (test mode). So the
//     theme can always be switched off from "+" (HA-10).
//
// Strings: the toggle title is the program's own name; "Glass Shell is on" is drawn only when
// Steam's UI language starts with "en" (PLAN 1.15). Nothing persists; remove() restores all.

const LAUNCHER_STATE = { cur: null };
const LG_NAME = 'Liquid Glass';
// a fragment of the switch's own icon as Steam encodes it (the T1 CSS match uses the same one)
const LG_ICON_MARK = 'zP9VZWZ7917z2Fx78vM6qqe7pHEinkTt9+rzKys9';

__LGS_RT.define({
  name: 'launcher',
  deps: [],
  flag: 'wp.c2b',
  install(rt) {
    const S = { rt, R: null, handle: null, busy: false, t3: false, t3Error: null, marked: 0, steamRowLog: [] };
    LAUNCHER_STATE.cur = S;

    // ---------------------------------------------------------------- T2: tag the switch row
    const tagRows = (doc) => {
      try {
        for (const el of doc.querySelectorAll('[role=button]')) {
          if ((el.textContent || '').trim() === LG_NAME) {
            if (el.getAttribute('data-lgs-row') !== 'liquid-glass') { el.setAttribute('data-lgs-row', 'liquid-glass'); S.marked++; }
          }
        }
      } catch (_) { /* window gone */ }
    };
    rt.windows.track((w) => {
      if (w.kind !== 'barpopup') return undefined;
      if (w.visible()) tagRows(w.doc);
      return () => untag(w.doc);
    });
    rt.windows.onShow((w) => {
      if (w.kind !== 'barpopup') return;
      tagRows(w.doc);
      rt.setTimeout(() => tagRows(w.doc), 120);
      rt.setTimeout(() => tagRows(w.doc), 500);
    });

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
      status: () => ({ t3: S.t3, t3Error: S.t3Error, patch: S.handle ? { count: S.handle.count, live: S.handle.live } : null, marked: S.marked, steamRow: S.steamRowLog.slice() }),
      // lab hook (PLAN-2b-3): run the toggle row's action path with a synthetic event; in test mode
      // P2 logs both calls and runs neither
      toggleForTest: (cmdline) => runToggle(S, { cmdline: String(cmdline || 'lgs-test') }, null, null),
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
  try { for (const el of doc.querySelectorAll('[data-lgs-row="liquid-glass"]')) el.removeAttribute('data-lgs-row'); } catch (_) { /* gone */ }
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

  // Steam's program list: sorted A-Z, the switch row taken out
  function splitPrograms(list, keepLg) {
    const kids = React.Children.toArray(list.props.children);
    if (!kids.length || !kids.every(isItem)) return null;
    let lg = null;
    const progs = [];
    for (const k of kids) { if (!lg && !keepLg && isLgItem(k)) lg = k; else progs.push(k); }
    progs.sort((a, b) => coll.compare(String(a.props.label || ''), String(b.props.label || '')));
    return { list: React.cloneElement(list, null, progs), lg };
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

  function Toggle(props) {
    // P2's hook: Steam's own scan, which carries the switch's command line (the action logger
    // needs it; Steam's row handler is never called directly)
    // (P2's hook throws only before its own hooks run, so the hook order stays fixed)
    let apps = null;
    try { apps = R.data.useNonSteamApps({ enabled: true, includeLiquidGlass: true }); } catch (_) { apps = null; }
    const entry = Array.isArray(apps) ? apps.find((a) => a.isLiquidGlass) || null : null;
    let lang = 'english';
    try { lang = String(R.ui.lang() || 'english'); } catch (_) { /* default */ }
    const sub = /^en/i.test(lang) ? 'Glass Shell is on' : null;
    const title = (entry && entry.name) || LG_NAME;
    return jsxs(Focusable, {
      className: 'lgs-c2b-toggle',
      role: 'switch',
      'aria-checked': 'true',
      'aria-label': title,
      'data-lgs-wait': entry ? undefined : 'scan',
      noFocusRing: true,
      // never inert: without P2's entry (finder missing, scan pending) or with a refused launch,
      // the press goes to Steam's own switch row (props.lg) inside runToggle
      onActivate: (e) => { runToggle(S, entry, e, props.lg); },
      children: [
        jsx('div', { className: 'lgs-c2b-toggle-disc', 'aria-hidden': 'true', children: props.icon || null }, 'i'),
        jsxs('div', { className: 'lgs-c2b-toggle-text', children: [
          jsx('div', { className: 'lgs-c2b-toggle-title', children: title }, 't'),
          sub ? jsx('div', { className: 'lgs-c2b-toggle-sub', children: sub }, 's') : null,
        ] }, 'x'),
        jsx('span', { className: 'lgs-c2b-switch', 'aria-hidden': 'true' }, 'w'),
      ],
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
        props.lg ? jsx(Toggle, { icon: props.lg.props.icon, lg: props.lg, popupRef: props.popupRef }, 'lg') : null,
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
      const popupRef = out.props.refBarPopopHandle || out.props.refBarPopupHandle || null;
      return React.cloneElement(out, { popupContents: jsx(Panel, { contents: t.list, lg: t.lg, popupRef }) });
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
// row's onActivate (Steam's LaunchNonSteamApp of the switch). Test mode (P2's rules, the same
// reasons as every action): logged as "c2b.steamRow", never run.
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
    if (!r) r = steamRowPress(S, steamRow, ev, 'the switch is not in P2\'s scan (finder missing or scan pending)');
    else if (r.mode === 'refused') r = steamRowPress(S, steamRow, ev, 'P2 launch refused: ' + (r.reason || ''));
    done.push(r);
    return done;
  } finally {
    S.busy = false;
  }
}
