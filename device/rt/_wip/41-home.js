// Glass Shell runtime module "home" (package C2a): Home, folders, What's New (T3).
// Concept: docs/phase2/concepts/home-apps.md (HA) §3, §5, §10, §11; PLAN §1.4, §1.7, §1.14.
// Contracts: react.md (P2: routes, actions, data, ui, find), interaction.md (P3: attend, attention,
// sound), runtime.md (P1: define, rt.*), reporter.md (P6: data-lgs-plate*, data-lgs-mosaic).
// Behind flag wp.c2a (PLAN §2.1). The DOM class names are the contract with theme/41-home.css part C.
//
// What it does while installed:
//   - overrides Steam's /library/home with our Home (sections Recent, Collections, Apps; the 4-5-4
//     honeycomb with explicit neighbours, one-step memory and D-pad page turning; pages, peeks, dots;
//     the attention ramp: name plate at 0.4 s, card at 0.8 s);
//   - adds /library/lgs/folder/:id (a collection as honeycomb pages) and /library/lgs/steamhome (Steam's
//     own Home page, the What's New route);
//   - hides Steam's footer on Home and folders exactly as Steam's own Home does (the footer store's
//     HideFooter(), Steam's useHideFooter hook), never with CSS (PLAN §1.10, HA §3 "Footer");
//   - answers C1a's glassMode('home') hook with 'windowless' while our Home is mounted;
//   - opens Steam's own tile menu (Steam's library app context menu component, found by source) from the
//     card's More circle and the menu button;
//   - launches only through rt.react.actions (logged, never run, in test mode).
// Every Steam-facing call fails closed: rt.react.ready() throws out of install() when a required finder
// misses, so the loader marks the module failed and Home stays Steam's own page (HA §3.7).

/* eslint-disable no-var */
__LGS_RT.define({
  name: 'home',
  deps: ['react', 'input', 'attention'],
  flag: 'wp.c2a',
  install(rt) { return homeInstall(rt); },
  remove() { return homeRemove(); },
});

// ------------------------------------------------------------------ constants (HA §3.1)
var HOME_CELLS = [[304, 196], [528, 196], [752, 196], [976, 196], [192, 384], [416, 384], [640, 384], [864, 384],
  [1088, 384], [304, 572], [528, 572], [752, 572], [976, 572]];
// the fallback layout (HA §3.1.1): the search capsule takes the top row's centre, so the section
// control moves below it, to y 102-166 (its 80 px hits start at y 94, where the capsule's hit box
// ends), and the rows to y 236, 416, 596 (the cells' boxes start 2 px below the segments' hits)
var HOME_LOW_Y = { 196: 236, 384: 416, 572: 596 };
var HOME_LOW_CARD_TOP = 178; // 12 px below the low section track
var HOME_ROW_START = [0, 4, 9];
var HOME_ROW_LEN = [4, 5, 4];
var HOME_PER_PAGE = 13;
var HOME_PER_PAGE_FOOTER = 9; // two rows when Steam shows a footer anyway (D-C2a-2, HA §3.2)
// Recent, Collections, Apps, and Windows only while SteamVR reports desktop windows (HA-2, HA §3.2)
var HOME_SECTIONS = ['recent', 'collections', 'apps', 'windows'];
var HOME_PLATE_BOTTOM = 704; // name plates are clamped 16 px inside the 720 px overlay (HA §3.4)
var HOME_CARD_CLOSE_MS = 460; // morph-close 441 ms, then the closing card is removed
var HOME_PLATE_CLOSE_MS = 360; // materialize-out 350 ms
var HOME_GRID_OUT_MS = 170; // page-out 150 ms
var HOME_BANDS = [[14, 94], [130, 262], [318, 450], [506, 638]];
// the low layout (D-C2a-9): rows at 236 / 416 / 596, section track at 102-166 (the native check at 09:23 had
// the discs' lower 34 px outside the bands, so their art was hidden under the plate glass)
var HOME_BANDS_LOW = [[14, 172], [170, 302], [350, 482], [530, 662]];
var HOME_LAUNCH_SOURCE = 1000; // Steam's library launch source (the capsule's own menu passes it)
// Strings (HA §3.8): Steam's token first; the English text only when the UI language starts with "en"
var HOME_STR = {
  recent: ['#LibraryTab_RecentlyPlayed', 'Recent'],
  collections: ['#LibraryTab_Collections', 'Collections'],
  apps: [null, 'Apps'],
  whatsnew: ['#HomeTab_WhatsNew', "What's New"],
  allgames: ['#LibraryTab_AllGames', 'All Games'],
  showlib: ['#Generic_ViewInLibrary', 'Show in Library'],
  options: ['#ActionButtonLabelContextMenu', 'Options'],
  notinstalled: ['#BasicGameCarousel_NotInstalled', 'Not installed'],
  windows: [null, 'Windows'],
  downloading: [null, 'Downloading'],
  update: [null, 'Update available'],
  emptyall: [null, 'Empty Collections'],
  empty: [null, 'Empty'],
  back: ['#Button_Back', 'Back'],
};
// The library sets shown first under Collections (HA §3.2): store member or collection id, Steam's tab
// label token, and the library tab "Show in Library" leads to
var HOME_SETS = [
  ['frameGamesCollection', '#LibraryTab_GreatOnFrame', 'GreatOnFrame', 'Great On Frame'],
  ['readyToPlayActiveCollection', '#LibraryTab_ReadyToPlay', 'ReadyToPlay', 'Ready To Play'],
  ['localGamesCollection', '#LibraryTab_Installed', 'Installed', 'Installed'],
  ['deckDesktopApps', '#LibraryTab_NonSteam', 'DesktopApps', 'Non-Steam'],
  ['type-music', '#LibraryTab_Soundtracks', 'Soundtracks', 'Soundtracks'],
  ['favorite', '#LibraryTab_Favorites', 'Favorites', 'Favorites'],
];
// Steam's system collections that are not user collections
var HOME_SYSTEM_IDS = /^(favorite|hidden|uncategorized|local-install|my-games|recent|local-played|type-.*|all-apps-.*)$/;
var HOME_GLYPH = {
  sparkle: 'M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z',
  play: 'M7 4.5v15l12.5-7.5z',
  more: 'M5 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  library: 'M4 4h4v16H4zm6 0h4v16h-4zm6.5.5 3.9 1-3.6 15.4-3.9-1z',
  cloud: 'M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5zm5-8v5m0 0-2.2-2.2M12 15l2.2-2.2',
  display: 'M3 5h18v11H3zM9 19h6v1H9z',
  gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8 3.5-2.1-.6-.5-1.3 1-1.9-1.6-1.6-1.9 1-1.3-.5L13 4h-2l-.6 2.1-1.3.5-1.9-1-1.6 1.6 1 1.9-.5 1.3L4 11v2l2.1.6.5 1.3-1 1.9 1.6 1.6 1.9-1 1.3.5L11 20h2l.6-2.1 1.3-.5 1.9 1 1.6-1.6-1-1.9.5-1.3L20 13z',
  terminal: 'M3 5h18v14H3zm3 4 3 3-3 3m5 0h6',
  window: 'M3 5h18v14H3zm0 4h18',
  // glyph segments (HA §3.8): clock, folder, grid
  recent: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm-1 2v5.4l4.3 2.6 1-1.7-3.3-2V7z',
  collections: 'M3 6a2 2 0 0 1 2-2h4.2l2 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  apps: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',
  windows: 'M3 5h18v14H3zm0 4h18',
  arrow: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14',
};
// Steam's per-client display status (EDisplayStatus) for Home's disc states (HA §3.3, LA-T8)
var HOME_DL_STATUS = new Set([3, 6, 7, 18, 19, 22, 23]); // installing, updating, downloading, paused, queued
var HOME_UPDATE_STATUS = new Set([20]); // update required

var HS = null; // live state while installed

function homeRowOf(i) { return i < 4 ? 0 : (i < 9 ? 1 : 2); }
function homeRowCells(row, n) {
  const out = [];
  if (row < 0 || row > 2) return out;
  for (let i = HOME_ROW_START[row]; i < HOME_ROW_START[row] + HOME_ROW_LEN[row] && i < n; i++) out.push(i);
  return out;
}

// Steam's library app context menu (the capsule's onMenuButton renders it): an export that wraps the
// menu with Steam's navigator and window instance, and the options function that names it
// LibraryContextMenu. Optional: without it the More circle is not drawn and the menu button is not taken.
function homeFindAppMenu(R) {
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

function homeInstall(rt) {
  const R = rt.react || rt.use('react');
  R.ready(); // throws when a required finder is missing (fail closed, P2 §0 rule 2)
  const P = rt.W.__LGS_RT; // the public runtime object: attend, attention, sound (P3)
  if (!P || typeof P.attend !== 'function') throw new Error('home: rt.attend missing (P3)');
  HS = {
    rt, R, P, steam: null, live: 0, subs: new Set(), att: null, cardHover: null, menu: null, lang: null,
    section: 'recent', page: {}, focusKey: {}, topMem: {}, reveal: null, handles: [], glass: null, attend: null,
    failed: false, programs: null, selfMove: 0, test: { windows: null, status: {} },
  };
  HS.win = homeFindWindows(R, rt);
  if (!HS.win) rt.log('home: desktop window list not found; no Windows section');
  const am = homeFindAppMenu(R);
  HS.appMenu = am.menu;
  if (!am.menu) rt.warn('home: Steam app menu not found; More circle and menu button off', am.error || am.count);
  else if (am.count > 1) rt.warn('home: app menu finder matched ' + am.count + ' modules; using ' + am.where);
  const C = homeComponents(R, rt);
  HS.C = C;
  HS.handles.push(R.routes.add('/library/lgs/folder/:id', C.FolderRoute, { owner: 'c2a' }));
  HS.handles.push(R.routes.add('/library/lgs/steamhome', C.SteamHomeRoute, { owner: 'c2a', exact: true }));
  HS.handles.push(R.routes.override(R.Routes.Library.Home(), (steamChildren) => {
    HS.steam = steamChildren;
    if (HS.wnPending) { HS.wnPending = false; rt.setTimeout(() => { try { R.nav.go('/library/lgs/steamhome', true); } catch (_) { /* gone */ } }, 0); }
    return R.jsx(C.HomeRoute, { kind: 'home' });
  }, { owner: 'c2a' }));
  if (rt.has('shell')) {
    // windowless only while our Home renders; a render failure falls back to Steam's Home in a window (M7)
    try { HS.glass = rt.use('shell').glassMode('home', () => (HS && HS.live > 0 && !HS.failed ? 'windowless' : null)); } catch (e) { rt.warn('glassMode hook failed', String(e)); }
  }
  HS.attend = P.attend('.lgs-home-grid:not(.is-leaving) .lgs-home-disc, .lgs-home-card[data-state="open"]', {
    dwellMs: 80, steps: [400, 800], leaveMs: 300, surfaces: ['main'],
    onEnter(el) { const k = homeKeyOf(el); if (k && el.classList.contains('lgs-home-card')) { HS.cardHover = k; } },
    // attention came back within the leave grace (a quick bounce, or the pad's immediate close, HA-17):
    // restore what its reached steps had shown
    onReenter(el, ev) {
      const k = homeKeyOf(el);
      if (!k || el.classList.contains('lgs-home-card')) { if (k) HS.cardHover = k; return; }
      const st = Math.max(0, ...((ev && ev.reached) || []));
      if (st >= 400 && !(HS.att && HS.att.key === k && HS.att.step >= st)) { HS.att = { key: k, step: st }; homeNotify(); }
    },
    onStep(el, ms) {
      const k = homeKeyOf(el);
      if (!k) return;
      if (el.classList.contains('lgs-home-card')) return; // the card keeps the ramp it opened with
      if (HS.att && HS.att.key === k && HS.att.step >= ms) return;
      HS.att = { key: k, step: ms };
      homeNotify();
    },
    onLeave(el) {
      const k = homeKeyOf(el);
      if (!k) return;
      if (HS.menu && HS.menu.key === k) return; // its tile menu is open: the card stays, flat (rule 6)
      if (el.classList.contains('lgs-home-card')) { if (HS.cardHover === k) HS.cardHover = null; }
      else if (HS.cardHover === k) return; // the pointer moved from the disc onto its card
      if (HS.att && HS.att.key === k && HS.cardHover !== k) { HS.att = null; homeNotify(); }
    },
  });
  const api = {
    // C1b's Software cell and the bar's "All Apps": Home with a section (and a program) shown
    reveal(opts) {
      const o = opts || {};
      HS.reveal = { section: HOME_SECTIONS.includes(o.section) ? o.section : 'recent', key: o.key || null };
      R.nav.go(R.Routes.Library.Home());
      homeNotify();
      return true;
    },
    state() {
      return { live: HS.live, section: HS.section, page: Object.assign({}, HS.page), att: HS.att, reveal: HS.reveal,
        menu: HS.menu ? { key: HS.menu.key } : null, appMenu: !!HS.appMenu, footer: HS.footerState || null, lang: HS.lang,
        failed: HS.failed, windows: !!HS.win, programs: HS.programs ? HS.programs.length : null };
    },
    // the programs Home's Apps section shows (Steam's own scan and filter), for C2a's search provider
    programs() { return HS.programs || []; },
    test: {
      // AT-23: draw as if the UI language were `code` (never Steam's setting); null resets
      lang(code) { HS.lang = code || null; homeNotify(); return HS.lang; },
      // AT-4: desktop windows as SteamVR's message would list them ([{window_id, hwnd, title}]); null resets
      windows(list) { HS.test.windows = Array.isArray(list) ? list : null; homeNotify(); return HS.test.windows; },
      // LA-T8: a download or update state for one app ({pct} or {update: true}); null clears
      status(appid, st) { if (st) HS.test.status[appid] = st; else delete HS.test.status[appid]; homeNotify(); return Object.assign({}, HS.test.status); },
    },
  };
  try { rt.expose('home', api); } catch (e) { rt.warn('home: expose failed', String(e)); }
  return api;
}

function homeRemove() {
  const s = HS;
  HS = null;
  if (!s) return { patchedLeft: 0 };
  try { if (s.menu && s.menu.inst) s.menu.inst.Hide(); } catch (_) { /* gone */ }
  try { if (s.attend) s.attend.off(); } catch (_) { /* gone */ }
  try { if (s.glass) s.glass.remove(); } catch (_) { /* gone */ }
  for (const h of s.handles.reverse()) { try { h.remove(); } catch (_) { /* gone */ } }
  return { patchedLeft: 0 };
}

// the fallback layout applies while the shell shows the search capsule instead of the circle (WN AT-4)
function homeLow(R) {
  try { const r = R.nav.win().document.querySelector('[data-lgs-search]'); const v = r && r.getAttribute('data-lgs-search'); return !!v && v !== 'circle'; } catch (_) { return false; }
}
function homePad() { try { const i = HS && HS.P && HS.P.input; return !i || i.mode === 'pad'; } catch (_) { return true; } }
function homeNotify() { if (HS) for (const f of HS.subs) { try { f(); } catch (_) { /* unmounted */ } } }
function homeKeyOf(el) { const c = el && el.closest ? el.closest('[data-lgs-home-key]') : null; return c ? c.getAttribute('data-lgs-home-key') : null; }
function homeSound(name) { try { if (HS && HS.P && typeof HS.P.sound === 'function') HS.P.sound(name); } catch (_) { /* no bus */ } }
function homeChunk(list, n) { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out.length ? out : [[]]; }
function homeLangEn(R) {
  if (HS && HS.lang) return /^en/i.test(HS.lang);
  try { return /^en/i.test(String(R.ui.lang() || 'english')); } catch (_) { return true; }
}
function homeEn(R, s) { return homeLangEn(R) ? s : null; }
function homeLoc(R, token) { try { return token ? R.ui.loc(token) : null; } catch (_) { return null; } }
// Steam's string for a HOME_STR key, else English on an English UI, else null (the glyph variant)
function homeStr(R, key) { const t = HOME_STR[key]; return (t[0] && homeLoc(R, t[0])) || homeEn(R, t[1]); }
function homeInstalled(ov) { if (!ov) return true; try { if ('installed' in ov) return !!ov.installed; } catch (_) { /* no getter */ } const p = ov.per_client_data; return !(p && p.length && p.every((c) => !c.installed)); }
function homeCmp(a, b) { return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }); }
function homeRunning(rt) { try { const s = rt.W.SteamUIStore; const id = s && s.MainRunningAppID; return id ? Number(id) : 0; } catch (_) { return 0; } }
// Steam's nav node behind one of our Focusables (the lab's navNode method, GP §0.4)
function homeNavNode(R, el) {
  for (let f = el ? R.fiber.of(el) : null, i = 0; f && i < 12; i++, f = f.return) {
    const n = f.memoizedProps && f.memoizedProps.node;
    if (n && typeof n.BTakeFocus === 'function') return n;
  }
  return null;
}
// our own focus moves (explicit neighbours): Steam plays no navigation sound for BTakeFocus, so the move
// requests BasicNav itself, as Steam's own Home does for every D-pad move (P-74, AT-21)
function homeFocusEl(R, el, quiet) {
  const n = homeNavNode(R, el);
  if (!n) return false;
  try { if (HS) HS.selfMove = Date.now(); n.BTakeFocus(3); if (!quiet) homeSound('nav'); return true; } catch (_) { return false; }
}
// plate ids are [A-Za-z0-9-_.:] (reporter §2.2); program keys are command lines, so they are hashed
function homePlateKey(key) {
  const s = String(key || '');
  if (/^[A-Za-z0-9_.:-]{1,64}$/.test(s)) return s;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return s.charAt(0).replace(/[^A-Za-z0-9]/, 'x') + h.toString(36);
}
// Steam's "+" popup reads the desktop windows from a VR message hook, `(0,V.H)(y.T)?.windows` (build
// 11094443: the popup module's function Et). Found from the popup's own source; optional: without it there
// is no Windows section and Steam's "+" keeps the function (HA §3.2).
function homeFindWindows(R, rt) {
  try {
    const f = R.find({ Plus: [['IsVRSimulatedOnDesktopWindow', 'DashboardDesktopWindowClicked', 'LaunchNonSteamApp'], (ex) => ex] });
    const id = f.where.Plus;
    if (!id || f.counts.Plus !== 1) return null;
    const ch = rt.W.webpackChunksteamui;
    if (!ch || typeof ch.push !== 'function') return null;
    const sym = Symbol('lgs-c2a');
    let req = null;
    ch.push([[sym], {}, (r) => { req = r; }]);
    for (let i = ch.length - 1; i >= 0; i--) { const c = ch[i]; if (c && c[0] && c[0][0] === sym) { ch.splice(i, 1); break; } }
    if (!req || !req.m || !req.m[id]) return null;
    const src = Function.prototype.toString.call(req.m[id]);
    const m = /\(0,([\w$]+)\.([\w$]+)\)\(([\w$]+)\.([\w$]+)\)\?\?\{\}\)\?\.windows/.exec(src);
    if (!m) return null;
    const imp = (a) => { const r = new RegExp('[,;\\s]' + a.replace(/\$/g, '\\$') + '=[\\w$]+\\((\\d+)\\)').exec(src); return r ? r[1] : null; };
    const hid = imp(m[1]), cid = imp(m[3]);
    if (!hid || !cid) return null;
    const hook = req(hid)[m[2]], type = req(cid)[m[4]];
    if (typeof hook !== 'function' || type == null) return null;
    return { hook, type, where: id };
  } catch (e) { rt.warn('home: window finder failed', String(e && e.message || e)); return null; }
}
// a game's download or update state from Steam's local client data (EDisplayStatus), or a test override
function homeDlState(ov) {
  if (!ov) return null;
  const t = HS && HS.test.status[ov.appid];
  if (t) return t.update ? { update: true } : { pct: Math.max(0, Math.min(100, Number(t.pct) || 0)) };
  try {
    const p = ov.local_per_client_data || (ov.per_client_data || []).find((c) => String(c.clientid) === '0') || null;
    const s = p ? Number(p.display_status) : 0;
    if (HOME_DL_STATUS.has(s)) return { pct: Math.max(0, Math.min(100, Number(p.status_percentage) || 0)) };
    if (HOME_UPDATE_STATUS.has(s)) return { update: true };
  } catch (_) { /* no client data */ }
  return null;
}

// ------------------------------------------------------------------ data (HA §3.2, §3.3)
function homeArt(R, ov) {
  // every candidate in Steam's order: custom art first (a shortcut lists .jpg and .png; one exists),
  // then Steam's cached asset (SR §3.7); each failed load moves on to the next
  const a = R.data.art(ov);
  const list = (...xs) => [].concat(...xs.map((x) => (Array.isArray(x) ? x : (x ? [x] : [])))).filter(Boolean);
  const heroes = list(a.custom.hero, a.hero), logos = list(a.custom.logo, a.logo), ports = list(a.custom.portrait, a.portrait);
  // a folder's 26 px crops: the portrait candidates, then the header and the hero (soundtracks and
  // shortcuts often have no portrait), then the icon (M4)
  const minis = list(ports, a.custom.landscape, a.header, heroes, a.icon);
  return { heroes, logos, ports, minis, hero: heroes[0] || null, logo: logos[0] || null, portrait: ports[0] || null };
}
function homeGameItem(R, ov, running) {
  return { kind: 'game', key: 'g' + ov.appid, appid: ov.appid, name: ov.display_name, ov, running: !!running && ov.appid === running };
}
function homeFolderItem(R, coll, opts) {
  const apps = (coll.visibleApps || coll.allApps || []);
  const o = opts || {};
  return {
    kind: o.kind || 'folder', key: 'c' + coll.id, id: coll.id, name: o.name || coll.displayName,
    count: apps.length, minis: apps.slice(0, 9).map((ov) => homeArt(R, ov).minis).filter((l) => l.length),
    nav: o.nav, tab: o.tab,
  };
}
function homeSetColl(cs, R, member) { return member.indexOf('-') > 0 || member === 'favorite' ? R.data.collection(member) : cs[member]; }
function homeSets(R) {
  const cs = R.data.stores().collectionStore;
  if (!cs) return [];
  const out = [];
  for (const [member, token, tab, en] of HOME_SETS) {
    const c = homeSetColl(cs, R, member);
    if (!c) continue;
    const n = (c.visibleApps || c.allApps || []).length;
    if ((member === 'favorite' || member === 'type-music') && !n) continue;
    out.push({ coll: c, name: homeLoc(R, token) || homeEn(R, en) || c.displayName, tab });
  }
  return out;
}
function homeUserColls(R, setIds) {
  const cs = R.data.stores().collectionStore;
  return ((cs && cs.userCollections) || []).filter((c) => c && !setIds.has(c.id) && !HOME_SYSTEM_IDS.test(String(c.id)));
}
function homeRecent(R, cap, running) {
  let ovs = R.data.recentGames(20).map((g) => g.overview).filter(Boolean);
  if (running) { // the running game first (HA §3.2)
    const i = ovs.findIndex((ov) => ov.appid === running);
    if (i > 0) ovs = [ovs[i]].concat(ovs.slice(0, i), ovs.slice(i + 1));
    else if (i < 0) { const ov = R.data.app(running); if (ov) ovs = [ov].concat(ovs); }
  }
  const games = ovs.map((ov) => homeGameItem(R, ov, running));
  const cs = R.data.stores().collectionStore;
  const all = cs && cs.allGamesCollection;
  const allItem = {
    kind: 'all', key: 'all', name: homeStr(R, 'allgames') || '',
    minis: all ? (all.visibleApps || all.allApps || []).slice(0, 9).map((ov) => homeArt(R, ov).minis).filter((l) => l.length) : [],
  };
  // cap - 1 games and the All Games folder on every page (HA §3.2)
  return homeChunk(games, cap - 1).map((p) => p.concat([allItem]));
}
function homeCollections(R, cap) {
  const sets = homeSets(R);
  const setIds = new Set(sets.map((s) => s.coll.id));
  const items = sets.map((s) => homeFolderItem(R, s.coll, { name: s.name, tab: s.tab }));
  const user = homeUserColls(R, setIds);
  const full = user.filter((c) => (c.allApps || []).length > 0).map((c) => homeFolderItem(R, c)).sort(homeCmp);
  const empty = user.filter((c) => !(c.allApps || []).length);
  items.push(...full);
  if (empty.length >= 2) {
    items.push({ kind: 'empty', key: 'empty', id: 'empty', name: homeStr(R, 'emptyall') || '', count: empty.length, minis: [] });
  } else if (empty.length === 1) {
    items.push(homeFolderItem(R, empty[0], { kind: 'empty', nav: '/library/collection/' + encodeURIComponent(empty[0].id) }));
  }
  return homeChunk(items, cap);
}
function homeApps(R, programs, cap) {
  const items = (programs || []).filter((p) => !p.isLiquidGlass).map((p) => ({ kind: 'program', key: 'p' + p.key, cmdline: p.cmdline, name: p.name, icon: p.iconUrl }));
  items.sort(homeCmp);
  return homeChunk(items, cap);
}
// desktop windows, in Steam's order (HA §3.2); the icon is the one Steam's "+" popup shows
function homeWindows(list, cap) {
  const items = (list || []).filter((w) => w && w.window_id != null).map((w) => ({
    kind: 'window', key: 'w' + w.window_id, windowId: w.window_id, name: String(w.title || ''),
    icon: w.hwnd != null ? 'https://steamloopback.host/windows/icon?handle=' + encodeURIComponent(w.hwnd) : null,
  }));
  return homeChunk(items, cap);
}
// a folder: its title, where "Show in Library" leads, and its pages
function homeFolder(R, id, cap, running) {
  if (id === 'empty') {
    const sets = homeSets(R);
    const empty = homeUserColls(R, new Set(sets.map((s) => s.coll.id))).filter((c) => !(c.allApps || []).length);
    empty.sort((a, b) => String(a.displayName).localeCompare(String(b.displayName), undefined, { sensitivity: 'base' }));
    return {
      title: homeStr(R, 'emptyall') || '', lib: '/library/tab/Collections',
      pages: homeChunk(empty.map((c) => homeFolderItem(R, c, { kind: 'empty', nav: '/library/collection/' + encodeURIComponent(c.id) })), cap),
    };
  }
  const set = homeSets(R).find((s) => s.coll.id === id);
  const coll = set ? set.coll : R.data.collection(id);
  if (!coll) return { title: '', lib: null, pages: [[]] };
  const apps = (coll.visibleApps || coll.allApps || []).slice().sort((a, b) => String(a.display_name).localeCompare(String(b.display_name), undefined, { sensitivity: 'base' }));
  return {
    title: (set && set.name) || coll.displayName || '',
    lib: set ? '/library/tab/' + set.tab : '/library/collection/' + encodeURIComponent(id),
    pages: homeChunk(apps.map((ov) => homeGameItem(R, ov, running)), cap),
  };
}
// the card's status line: Steam's own playtime strings ("6.4 hrs played all time"). Steam's
// LocalizeString returns the raw "%1$s" form, so the argument is put in here.
function homeFmt(s, ...args) { return s ? String(s).replace(/%(\d)\$s/g, (m, n) => (args[n - 1] != null ? String(args[n - 1]) : m)) : null; }
function homePlaytime(R, ov) {
  const m = Number(ov && ov.minutes_playtime_forever) || 0;
  if (m <= 0) return null;
  try {
    if (m < 60) return homeFmt(homeLoc(R, '#Playtime_Total_Minutes') || homeEn(R, '%1$s mins played all time'), m.toLocaleString());
    const h = (Math.round(m / 6) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });
    return homeFmt(homeLoc(R, '#Playtime_Total_Hours') || homeEn(R, '%1$s hrs played all time'), h);
  } catch (_) { return null; }
}
function homeGlyphFor(name) {
  const n = String(name || '').toLowerCase();
  if (/setting|config/.test(n)) return 'gear';
  if (/konsole|terminal/.test(n)) return 'terminal';
  if (/window/.test(n)) return 'window';
  return 'display';
}

// ------------------------------------------------------------------ the tile menu (HA §3.5, §8)
// Steam's own library app context menu, rendered and shown exactly as Steam's capsule does it
// (showContextMenu(<AppMenu overview client launchSource bInGamepadUI ownerWindow/>, anchor, options)).
// Its items and handlers stay Steam's; tests open it and close it with B or Hide(), never by an item.
function homeTileMenu(R, item, anchor) {
  if (!HS || !item || item.kind !== 'game' || !item.ov) return null;
  const M = HS.appMenu;
  if (!M || !R.c.showContextMenu) { HS.rt.log('tile menu unavailable', { appid: item.appid }); return null; }
  try {
    const w = R.nav.win();
    const el = R.jsx(M.menu, { overview: item.ov, client: 'mostavailable', launchSource: HOME_LAUNCH_SOURCE, bInGamepadUI: true, ownerWindow: w });
    const inst = R.c.showContextMenu(el, anchor || w.document.body, M.opts());
    const rec = { key: item.key, appid: item.appid, inst };
    HS.menu = rec;
    HS.rt.log('tile menu', { appid: item.appid });
    try {
      inst.SetOnHideCallback(() => {
        if (!HS || HS.menu !== rec) return;
        HS.menu = null;
        // the card stays only while attention is still on its cell or card (P3's current target)
        HS.rt.setTimeout(() => {
          if (!HS) return;
          let cur = null;
          try { const c = HS.P.attention.current(w); cur = c && c.el ? homeKeyOf(c.el) : null; } catch (_) { cur = null; }
          if (HS.att && HS.att.key === rec.key && cur !== rec.key) HS.att = null;
          homeNotify();
        }, 120);
        homeNotify();
      });
    } catch (_) { /* older instance: the card closes with attention */ }
    homeNotify();
    return inst;
  } catch (e) {
    HS.rt.warn('tile menu failed', String(e && e.message || e));
    HS.menu = null;
    return null;
  }
}

// ------------------------------------------------------------------ components
function homeComponents(R, rt) {
  const React = R.React, jsx = R.jsx, jsxs = R.jsxs, c = R.c;
  const svg = (name, cls) => jsx('svg', { className: cls || undefined, viewBox: '0 0 24 24', 'aria-hidden': 'true', children: jsx('path', { d: HOME_GLYPH[name] }) });

  // hero + logo, then the portrait crop, then a monogram (HA §3.3); one candidate per failed load
  function useArt(ov) {
    const art = homeArt(R, ov);
    const [h, setH] = React.useState(0);
    const [p, setP] = React.useState(0);
    const [l, setL] = React.useState(0);
    const hero = art.heroes[h] || null;
    const port = hero ? null : (art.ports[p] || null);
    const logo = hero ? (art.logos[l] || null) : null;
    return {
      hero, port, logo,
      heroFail: () => setH((x) => x + 1), portFail: () => setP((x) => x + 1), logoFail: () => setL((x) => x + 1),
    };
  }
  const artKids = (A, withMono, name) => {
    const kids = [];
    if (A.hero) kids.push(jsx('img', { className: 'lgs-home-hero', src: A.hero, alt: '', onError: A.heroFail }, 'h:' + A.hero));
    else if (A.port) kids.push(jsx('img', { className: 'lgs-home-port', src: A.port, alt: '', onError: A.portFail }, 'p:' + A.port));
    if (A.logo) kids.push(jsx('img', { className: 'lgs-home-logo', src: A.logo, alt: '', onError: A.logoFail }, 'l:' + A.logo));
    if (!A.hero && !A.port && withMono) kids.push(jsx('span', { className: 'lgs-home-mono', children: (String(name || '?').match(/[A-Za-z0-9À-￯]+/g) || ['?']).slice(0, 2).map((w) => w[0].toUpperCase()).join('') }, 'm'));
    return kids;
  };
  // one 26 px crop: each failed load moves on to the next candidate, the last failure leaves the empty
  // tile (never Chromium's broken-image glyph, M4)
  function Mini({ list }) {
    const [i, setI] = React.useState(0);
    const u = list && list[i];
    return jsx('i', { className: 'lgs-home-mini', children: u ? jsx('img', { src: u, alt: '', onError: () => setI((x) => x + 1) }, u) : null });
  }
  function Icon({ item }) {
    const [bad, setBad] = React.useState(false);
    return jsx('div', { className: 'lgs-home-prog', children: item.icon && !bad
      ? jsx('img', { src: item.icon, alt: '', onError: () => setBad(true) })
      : svg(item.kind === 'window' ? 'window' : homeGlyphFor(item.name), 'lgs-home-glyph-ic') });
  }
  function Art({ item }) {
    if (item.kind === 'game') {
      const A = useArt(item.ov);
      return jsx('div', { className: 'lgs-home-art', children: artKids(A, true, item.name) });
    }
    if (item.kind === 'program' || item.kind === 'window') return jsx(Icon, { item });
    // folders, All Games, empty collections: a 3 x 3 grid of crops
    const minis = [];
    for (let i = 0; i < 9; i++) minis.push(jsx(Mini, { list: item.minis && item.minis[i] }, i));
    return jsx('div', { className: 'lgs-home-folder', children: minis });
  }

  function activate(item, ev) {
    const A = R.actions;
    switch (item.kind) {
      case 'game': return A.navigate(R.Routes.Library.App.Root(item.appid), {}, ev);
      case 'program': return A.launchNonSteam(item.cmdline, ev);
      case 'window': return A.desktopWindow(item.windowId, ev);
      case 'all': return A.navigate('/library/tab/AllGames', {}, ev);
      case 'folder':
      case 'empty':
        if (item.nav) return A.navigate(item.nav, {}, ev);
        return R.nav.go('/library/lgs/folder/' + encodeURIComponent(item.id));
      default: return null;
    }
  }

  function Cell({ item, index, focusMe, under, underCard, hidden, low, move, card, cardOpen, cardOn, clip, ring, kind }) {
    const x = HOME_CELLS[index][0], y = low ? HOME_LOW_Y[HOME_CELLS[index][1]] : HOME_CELLS[index][1];
    const isGame = item.kind === 'game';
    const dl = isGame ? homeDlState(item.ov) : null;
    const cls = ['lgs-home-cell', 'c2a-cell']; // c2a-cell: a stable first class for pad-bfs node keys (is-* change with state)
    if (under) cls.push('is-under');
    if (underCard) cls.push('is-under-card');
    if (hidden) cls.push('is-hidden-label');
    if (cardOpen) cls.push('has-card');
    if (item.running) cls.push('is-running');
    if (isGame && !homeInstalled(item.ov) && !(dl && dl.pct != null)) cls.push('is-notinstalled');
    if (dl && dl.pct != null) cls.push('is-downloading');
    if (dl && dl.update) cls.push('is-update');
    const label = item.kind === 'empty' && item.key !== 'empty' && !item.name ? homeStr(R, 'empty') : item.name;
    const discStyle = clip ? { clipPath: clip } : undefined;
    return jsxs(c.Focusable, {
      className: cls.join(' '),
      style: { '--x': x + 'px', '--y': y + 'px', '--lgs-home-ring': ring || 0 },
      'data-kind': item.kind === 'empty' ? 'empty' : item.kind,
      'data-lgs-home-key': item.key,
      'data-lgs-home-index': index,
      'data-row': homeRowOf(index),
      // the cell's name, stable while its card opens inside it (the card adds Play, status and title text)
      'aria-label': item.name || label || undefined,
      autoFocus: !!focusMe,
      noFocusRing: true,
      onActivate: (e) => activate(item, e),
      // explicit honeycomb neighbours (HA §3.5): a handler returns true when it moved focus itself
      onMoveLeft: () => move(index, 'left'),
      onMoveRight: () => move(index, 'right'),
      onMoveUp: () => move(index, 'up'),
      onMoveDown: () => move(index, 'down'),
      // Steam's own Home shows no footer (D-C2a-2); these labels show only if Steam renders one anyway
      onSecondaryButton: isGame ? (e) => R.actions.primary(item.appid, e) : undefined,
      onMenuButton: isGame && HS.appMenu ? (e) => homeTileMenu(R, item, e && e.currentTarget) : undefined,
      onMenuActionDescription: isGame && HS.appMenu ? (homeStr(R, 'options') || undefined) : undefined,
      onGamepadFocus: (e) => {
        const sk = HS.sectionKey || 'x';
        HS.focusKey[sk] = item.key;
        // focus that Steam moved into the grid from outside it (C1a's search capsule above a folder's grid):
        // Up from this cell gives the move back to Steam, so it returns where it came from (P-20, M15)
        if (kind === 'folder' && Date.now() - HS.selfMove > 250 && Date.now() - (HS.mountedAt || 0) > 600 && homeRowOf(index) === 0) HS.topBack = { ext: true, to: index, sKey: sk };
        const d = e && e.currentTarget && e.currentTarget.querySelector ? e.currentTarget.querySelector('.lgs-home-disc') : null;
        if (d && HS.P.attention && homePad()) HS.P.attention.feed(d, 'enter', 'pad');
      },
      onGamepadBlur: (e) => {
        const d = e && e.currentTarget && e.currentTarget.querySelector ? e.currentTarget.querySelector('.lgs-home-disc') : null;
        if (d && HS.P.attention) HS.P.attention.feed(d, 'leave', 'pad');
        // gamepad: the card starts closing at the move, not after the 0.3 s grace (HA-17); a bounce back
        // within the grace restores it through onReenter
        if (homePad() && HS.att && HS.att.key === item.key && !(HS.menu && HS.menu.key === item.key)) { HS.att = null; homeNotify(); }
      },
      children: [
        jsxs('div', {
          className: 'lgs-home-disc', 'data-lgs-dwell': '', 'data-lgs-plate': 'liquid', 'data-lgs-plate-id': 'home-disc-' + homePlateKey(item.key),
          // a circle (Steam's 50 % radius would be read as 50 px); a neighbour the open card overlaps keeps its
          // full glass (only the card's own cell reads as its shadow; native check 09:23 had row-3 discs dimmed)
          'data-lgs-plate-r': 'capsule',
          'data-lgs-plate-occluder': (under || underCard || clip || (cardOn && !card)) ? 'false' : undefined,
          style: discStyle,
          children: [
            jsx(Art, { item }, 'a'),
            (isGame && !homeInstalled(item.ov) && !(dl && dl.pct != null)) ? jsx('span', { className: 'lgs-home-cloud', children: svg('cloud') }, 'c') : null,
            (dl && dl.pct != null) ? jsx('span', { className: 'lgs-home-ring-progress', children: jsxs('svg', { viewBox: '0 0 56 56', 'aria-hidden': 'true', children: [
              jsx('circle', { cx: 28, cy: 28, r: 22, className: 'track' }, 't'),
              jsx('circle', { cx: 28, cy: 28, r: 22, pathLength: 100, style: { strokeDasharray: dl.pct + ' 100' } }, 'p'),
            ] }) }, 'dl') : null,
            (dl && dl.update) ? jsx('span', { className: 'lgs-home-update', children: svg('arrow') }, 'up') : null,
          ],
        }, 'disc'),
        jsxs('div', { className: 'lgs-home-label', children: [item.running ? jsx('i', { className: 'lgs-home-run' }, 'r') : null, label] }, 'label'),
        // the card is the cell's expanded state, so it lives inside the cell: a click on its body is
        // the cell's own activation, and its hits are the cell's (HA §3.4)
        card || null,
      ],
    }, item.key);
  }

  function cellXY(index, low) { const x = HOME_CELLS[index][0], y = HOME_CELLS[index][1]; return [x, low ? HOME_LOW_Y[y] : y]; }
  function cardRect(index, low) {
    const [x, y] = cellXY(index, low);
    const left = Math.max(16, Math.min(1280 - 16 - 320, x - 160));
    // low layout: rows are 180 apart, so the card sits 10 px higher to cover no more than 10 px of the
    // next row's discs (AT-8e); row 1 still reaches 62 px into row 2 (D-C2a-9), whose discs are cut away
    // under it (cardClips)
    const top = Math.max(low ? HOME_LOW_CARD_TOP : 98, Math.min(HOME_PLATE_BOTTOM - 240, y - (low ? 110 : 100)));
    return { left, top };
  }
  // the card's Play leaves the comfort zone (|x - 640| <= 400, P-29) on cells left of x 400: their
  // action row is mirrored (More first, Play at the trailing edge, nearer the centre)
  function cardMirror(index) { return HOME_CELLS[index][0] < 400; }
  // what the open card covers of the other discs is cut out of them (a rounded-rect hole in the disc's
  // clip path), so neither the CSS card nor the native crop at +15 mm carries a neighbour's art (M1)
  function cardClips(attIndex, n, low) {
    const out = {};
    if (attIndex < 0) return out;
    const { left, top } = cardRect(attIndex, low);
    const W = 320, H = 240, r = 36, pad = 6;
    for (let i = 0; i < n; i++) {
      if (i === attIndex) continue;
      const [x, y] = cellXY(i, low);
      const dx = x - 60, dy = y - 60; // the disc's box
      if (dx + 120 <= left - pad || dx >= left + W + pad || dy + 120 <= top - pad || dy >= top + H + pad) continue;
      // in the disc's own coordinates: a large box (keeps the disc's shade), minus the card's rect + pad
      const L = left - pad - dx, T = top - pad - dy, R2 = L + W + 2 * pad, B = T + H + 2 * pad, rr = r + pad;
      const box = 'M-40 -40H160V160H-40Z';
      const hole = 'M' + (L + rr) + ' ' + T + 'H' + (R2 - rr) + 'A' + rr + ' ' + rr + ' 0 0 1 ' + R2 + ' ' + (T + rr) + 'V' + (B - rr)
        + 'A' + rr + ' ' + rr + ' 0 0 1 ' + (R2 - rr) + ' ' + B + 'H' + (L + rr) + 'A' + rr + ' ' + rr + ' 0 0 1 ' + L + ' ' + (B - rr)
        + 'V' + (T + rr) + 'A' + rr + ' ' + rr + ' 0 0 1 ' + (L + rr) + ' ' + T + 'Z';
      out[i] = 'path(evenodd, "' + box + hole + '")';
    }
    return out;
  }

  function CardStatus({ item }) {
    const dl = homeDlState(item.ov);
    if (dl && dl.pct != null) return jsxs(R.Fragment, { children: [svg('arrow'), jsx('span', { children: (homeLoc(R, '#Downloads_Downloading') || homeStr(R, 'downloading') || '') + ' ' + Math.round(dl.pct) + '%' }, 't')] });
    if (dl && dl.update) return jsxs(R.Fragment, { children: [svg('arrow'), jsx('span', { children: homeStr(R, 'update') || '' }, 't')] });
    return (!homeInstalled(item.ov) ? homeStr(R, 'notinstalled') : homePlaytime(R, item.ov)) || null;
  }

  function Card({ item, index, low, menuOpen, closing }) {
    const { left, top } = cardRect(index, low);
    const [x, y] = cellXY(index, low);
    const A = useArt(item.ov);
    const info = R.actions.primaryInfo(item.appid);
    const kind = /install/i.test(info.action || '') ? 'install' : (/update/i.test(info.action || '') ? 'update' : 'play');
    const label = info.label || R.ui.text('#AppDetails_PlayButton', 'Play') || '';
    // placed relative to its cell's box (x - 100, y - 60); it morphs from the disc's rect, relative to
    // the card box (P5 lgs-morph)
    const style = { left: (left - (x - 100)) + 'px', top: (top - (y - 60)) + 'px', '--sx': (x - 60 - left) + 'px', '--sy': (y - 60 - top) + 'px', '--sw': '120px', '--sh': '120px', '--sr': '60px' };
    const optLabel = homeStr(R, 'options');
    const cls = ['lgs-home-card'];
    if (menuOpen) cls.push('is-menu-source');
    if (cardMirror(index)) cls.push('is-mirror');
    return jsxs('div', {
      className: cls.join(' '), 'data-state': closing ? 'closing' : 'open', 'data-lgs-home-key': item.key,
      'aria-hidden': closing ? 'true' : undefined,
      // a transient expansion over its neighbours while attended (REQ C2a->P10 #12)
      'data-lgs-transient': '',
      // the closing card is CSS only: glassd's slab dissolves with the pop (the layer rule wants "open")
      'data-lgs-plate': closing ? undefined : 'liquid', 'data-lgs-plate-id': closing ? undefined : 'home-card', 'data-lgs-plate-tint': 'rgb(0 0 0 / .30)', style,
      children: [
        jsxs('div', { className: 'lgs-home-card-art', children: [
          ...artKids(A, false, item.name),
        ] }, 'art'),
        jsx('div', { className: 'lgs-home-play', 'data-kind': kind, role: closing ? undefined : 'button', 'aria-label': label,
          onClick: closing ? undefined : (e) => { e.stopPropagation(); R.actions.primary(item.appid, e); },
          children: jsxs('span', { className: 'lgs-home-play-fill', children: [svg('play'), jsx('span', { children: label }, 't'), jsx('span', { className: 'lgs-home-badge', children: 'X' }, 'b')] }) }, 'play'),
        HS.appMenu ? jsx('div', { className: 'lgs-home-more' + (menuOpen ? ' is-open' : ''), role: closing ? undefined : 'button', 'aria-label': optLabel || undefined, 'data-lgs-tip': optLabel && !closing ? 'above' : undefined,
          onClick: closing ? undefined : (e) => { e.stopPropagation(); homeTileMenu(R, item, e.currentTarget); },
          children: jsxs('span', { className: 'lgs-home-more-fill', children: [svg('more'), jsx('span', { className: 'lgs-home-badge', children: '≡' }, 'b')] }) }, 'more') : null,
        jsx('div', { className: 'lgs-home-card-title', children: item.name }, 'title'),
        jsx('div', { className: 'lgs-home-card-status', children: jsx(CardStatus, { item }) }, 'status'),
      ],
    }, 'card-' + item.key);
  }
  // the card in its own error boundary: a render failure closes the card and leaves Home as it was (M7)
  function SafeCard(props) {
    return jsx(R.ui.ErrorBoundary, { name: 'c2a-card', fallback: null,
      onError: () => { if (HS && HS.att && HS.att.key === props.item.key) { HS.att = null; HS.rt.setTimeout(homeNotify, 0); } },
      children: jsx(Card, props) });
  }

  function NamePlate({ item, index, low, closing, onMeasure }) {
    const [x, y] = cellXY(index, low);
    const left = Math.max(16, Math.min(1264, x));
    const ref = React.useRef(null);
    // its real rect decides which labels it covers (D-C2a-5: text overlap only, m2)
    React.useLayoutEffect(() => { if (!closing && onMeasure && ref.current) onMeasure(item.key, ref.current); }, [item.key, closing]);
    return jsxs('div', {
      ref, className: 'lgs-home-plate', 'data-state': closing ? 'closing' : 'open', 'data-lgs-home-key': item.key,
      'aria-hidden': closing ? 'true' : undefined,
      'data-lgs-plate': closing ? undefined : 'liquid', 'data-lgs-plate-id': closing ? undefined : 'home-plate', 'data-lgs-plate-tint': 'rgb(0 0 0 / .30)',
      // its bottom is clamped 16 px inside the overlay (HA §3.4): row 3 of the low layout (M3)
      style: { left: left + 'px', top: Math.min(y + 74, HOME_PLATE_BOTTOM - 60) + 'px', translate: '-50% 0' },
      children: [jsx('span', { className: 'lgs-home-plate-name', children: item.name }, 'n')],
    }, 'plate-' + item.key);
  }

  function TopRow({ kind, section, sections, onSection, title, libPath, toGrid }) {
    const [pill, setPill] = React.useState(null);
    React.useLayoutEffect(() => {
      let el = null;
      try { el = R.nav.win().document.querySelector('.lgs-home .lgs-home-seg-item.is-selected'); } catch (_) { el = null; }
      if (el && (!pill || pill.x !== el.offsetLeft || pill.w !== el.offsetWidth)) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    });
    // Down from the top row returns to the remembered cell (HA §3.5); Up is Steam's (its search)
    const down = (sel) => () => toGrid(sel);
    const WN_SEL = '.lgs-home .lgs-home-top .lgs-home-wn';
    if (kind === 'folder') {
      const lib = homeStr(R, 'showlib');
      // a plain row, not a Focusable: with one control in it, a Focusable row would itself be a 1280 x 108
      // target over Steam's header (Up and Down are explicit: focusTop / toGrid)
      return jsxs('div', { className: 'lgs-home-top', children: [
        jsx('h1', { className: 'lgs-home-title', children: title }, 't'),
        libPath ? jsx(c.Focusable, { className: 'lgs-home-wn', noFocusRing: true, onMoveDown: down(WN_SEL),
          onActivate: (e) => R.actions.navigate(libPath, {}, e),
          children: jsxs('div', { className: 'lgs-home-wn-glass' + (lib ? '' : ' is-icon'), 'data-lgs-plate': 'liquid', 'data-lgs-plate-id': 'home-top-showlib',
            'aria-label': lib || undefined,
            children: [svg('library'), lib ? jsx('span', { className: 'lgs-home-wn-label', children: lib }, 'l') : null] }) }, 'lib') : null,
      ] });
    }
    const wn = homeStr(R, 'whatsnew');
    return jsxs(c.Focusable, { className: 'lgs-home-top', 'flow-children': 'row', children: [
      jsxs(c.Focusable, {
        className: 'lgs-home-seg', 'flow-children': 'row', 'data-lgs-plate': 'liquid', 'data-lgs-plate-id': 'home-top-seg',
        style: pill ? { '--lgs-home-pill-x': pill.x + 'px', '--lgs-home-pill-w': pill.w + 'px' } : undefined,
        children: [jsx('div', { className: 'lgs-home-seg-pill' }, 'pill')].concat((sections || HOME_SECTIONS).map((s) => {
          const label = homeStr(R, s);
          return jsx(c.Focusable, {
            className: 'lgs-home-seg-item c2a-seg' + (s === section ? ' is-selected' : '') + (label ? '' : ' is-glyph'), noFocusRing: true, role: 'tab', 'aria-selected': s === section,
            'aria-label': label ? undefined : s, 'data-lgs-home-sec': s, onMoveDown: down('.lgs-home .lgs-home-seg-item[data-lgs-home-sec="' + s + '"]'),
            onActivate: () => onSection(s),
            children: jsx('span', { className: 'lgs-home-seg-fill', children: label ? jsx('span', { className: 'lgs-home-seg-label', children: label }) : svg(s) }),
          }, s);
        })),
      }, 'seg'),
      jsx(c.Focusable, { className: 'lgs-home-wn', noFocusRing: true, onMoveDown: down(WN_SEL), onActivate: () => R.nav.go('/library/lgs/steamhome'),
        children: jsxs('div', { className: 'lgs-home-wn-glass' + (wn ? '' : ' is-icon'), 'data-lgs-plate': 'liquid', 'data-lgs-plate-id': 'home-top-wn',
          'aria-label': wn || undefined,
          children: [svg('sparkle'), wn ? jsx('span', { className: 'lgs-home-wn-label', children: wn }, 'l') : null] }) }, 'wn'),
    ] });
  }

  function useLive() {
    const [, force] = React.useReducer((n) => n + 1, 0);
    React.useEffect(() => {
      HS.live++;
      HS.subs.add(force);
      try { if (rt.has('shell')) rt.use('shell').refreshGlass(); } catch (_) { /* no shell */ }
      return () => {
        if (!HS) return;
        HS.live--;
        HS.subs.delete(force);
        try { if (rt.has('shell')) rt.use('shell').refreshGlass(); } catch (_) { /* no shell */ }
      };
    }, []);
  }
  // Steam's footer on Home and folders: hidden exactly as Steam's own Home hides it (the footer store's
  // HideFooter(), Steam's useHideFooter hook). If the store is not there, or Steam shows a footer
  // anyway, the page makes room instead (two rows, `lgs-home-footer`; the legend is never hidden).
  function useSteamFooter() {
    const [shown, setShown] = React.useState(false);
    React.useEffect(() => {
      let h = null;
      try { const fs = R.nav.inst().FooterStore; if (fs && typeof fs.HideFooter === 'function') h = fs.HideFooter(); } catch (_) { h = null; }
      if (HS) HS.footerState = h ? 'hidden' : 'shown';
      if (!h) setShown(true);
      const t = rt.setTimeout(() => {
        try {
          const f = R.nav.win().document.getElementById('Footer');
          const vis = !!(f && f.getBoundingClientRect().height > 0 && R.nav.win().getComputedStyle(f).display !== 'none');
          if (vis) { setShown(true); if (HS) HS.footerState = 'shown'; }
        } catch (_) { /* no window */ }
      }, 400);
      return () => { try { rt.clearTimeout(t); } catch (_) { /* gone */ } try { if (h) h.unhide(); } catch (_) { /* gone */ } };
    }, []);
    return shown;
  }

  // SteamVR's desktop windows (the "+" popup's own hook); HS.win is fixed for the install, so the hook is
  // called on every render or on none
  function useWindows() {
    const W = HS.win;
    let msg = null;
    if (W) { try { msg = W.hook(W.type); } catch (_) { msg = null; } }
    const list = HS.test.windows || (msg && msg.windows) || [];
    return Array.isArray(list) ? list : [];
  }

  // a cell of the grid that is leaving (section or page change): the same look, no Focusable, no plate,
  // no hits; removed when page-out ends (M10)
  function GhostCell({ item, index, low }) {
    const [x, y] = cellXY(index, low);
    const label = item.kind === 'empty' && item.key !== 'empty' && !item.name ? homeStr(R, 'empty') : item.name;
    return jsxs('div', {
      className: 'lgs-home-cell is-ghost', style: { '--x': x + 'px', '--y': y + 'px' }, 'data-kind': item.kind === 'empty' ? 'empty' : item.kind,
      children: [
        jsx('div', { className: 'lgs-home-disc', children: jsx(Art, { item }) }, 'disc'),
        jsx('div', { className: 'lgs-home-label', children: label }, 'label'),
      ],
    });
  }

  function HomeView({ kind, folderId }) {
    useLive();
    React.useLayoutEffect(() => { HS.failed = false; HS.mountedAt = Date.now(); }, []);
    const footer = useSteamFooter();
    const cap = footer ? HOME_PER_PAGE_FOOTER : HOME_PER_PAGE;
    const programs = R.data.useNonSteamApps({});
    if (programs) HS.programs = programs;
    const wins = useWindows();
    const sections = wins.length ? HOME_SECTIONS : HOME_SECTIONS.filter((s) => s !== 'windows');
    const [sectionState, setSectionState] = React.useState(() => (HS.reveal && HS.reveal.section) || HS.section);
    const section = sections.includes(sectionState) ? sectionState : 'recent';
    const sKey = kind === 'folder' ? 'folder:' + folderId : section;
    const [page, setPageState] = React.useState(() => HS.page[sKey] || 0);
    const [moving, setMoving] = React.useState(false);
    const [dir, setDir] = React.useState(0);
    const vmem = React.useRef(null); // one-step memory of the last vertical move {from, to, dir}
    const pend = React.useRef(null); // the cell to focus once the next page or section has rendered
    HS.sectionKey = sKey;
    const low = homeLow(R);
    const running = homeRunning(rt);
    const folder = React.useMemo(() => (kind === 'folder' ? homeFolder(R, folderId, cap, running) : null), [kind, folderId, cap, running]);
    const pages = React.useMemo(() => {
      if (folder) return folder.pages;
      if (section === 'collections') return homeCollections(R, cap);
      if (section === 'apps') return homeApps(R, programs, cap);
      if (section === 'windows') return homeWindows(wins, cap);
      return homeRecent(R, cap, running);
    }, [folder, section, programs, cap, running, section === 'windows' ? wins : null]);
    // reveal({section, key}): the page that holds the program
    const rkey = HS.reveal && HS.reveal.key ? 'p' + HS.reveal.key : null;
    let pg = Math.min(page, pages.length - 1);
    if (rkey) { const rp = pages.findIndex((p) => p.some((it) => it.key === rkey)); if (rp >= 0) pg = rp; }
    const items = pages[pg] || [];
    const gridKey = sKey + '-' + pg;
    const move = (fn, d) => {
      setDir(d);
      setMoving(true);
      fn();
      rt.setTimeout(() => setMoving(false), 800);
    };
    // gamepad focus inside the grid (or lost) when the grid is replaced: put it on the remembered cell
    const focusInGrid = () => {
      try {
        const f = R.nav.win().document.querySelector('.lgs-home .gpfocus');
        return f ? !!f.closest('.lgs-home-grid') : homePad();
      } catch (_) { return false; }
    };
    const setSection = (s) => {
      if (s === section) return;
      const d = sections.indexOf(s) > sections.indexOf(section) ? 1 : -1;
      if (focusInGrid()) pend.current = 'mem';
      vmem.current = null;
      move(() => { HS.section = s; HS.att = null; setSectionState(s); setPageState(HS.page[s] || 0); }, d);
      homeSound('tab');
    };
    const setPage = (p, focusIndex) => {
      if (p < 0 || p >= pages.length || p === pg) return false;
      if (focusIndex != null) pend.current = focusIndex;
      vmem.current = null;
      move(() => { HS.page[sKey] = p; HS.att = null; setPageState(p); }, p > pg ? 1 : -1);
      homeSound('page');
      return true;
    };
    React.useEffect(() => {
      if (!HS.reveal) return;
      HS.page[sKey] = pg;
      if (rkey) HS.focusKey[sKey] = rkey;
      HS.reveal = null;
      setPageState(pg);
    }, []);
    const att = HS.att;
    const menuKey = HS.menu ? HS.menu.key : null;
    const attIndex = att ? items.findIndex((it) => it.key === att.key) : -1;
    const attItem = attIndex >= 0 ? items[attIndex] : null;
    const showCard = !!(attItem && attItem.kind === 'game' && ((att.step >= 800 && !moving) || menuKey === attItem.key));
    const showPlate = !!(attItem && attItem.kind !== 'game' && att.step >= 400 && !moving);

    // exits (M10): a card or name plate that closes stays as a closing copy until its exit motion ends;
    // a grid that is replaced stays as a leaving copy for page-out
    const [closing, setClosing] = React.useState({ card: null, plate: null });
    const shown = React.useRef({ card: null, plate: null });
    const lastGrid = React.useRef(null);
    const [leaving, setLeaving] = React.useState(null);
    React.useLayoutEffect(() => {
      const prev = shown.current;
      const cur = {
        card: showCard ? { key: attItem.key, item: attItem, index: attIndex, grid: gridKey } : null,
        plate: showPlate ? { key: attItem.key, item: attItem, index: attIndex, grid: gridKey } : null,
      };
      shown.current = cur;
      for (const k of ['card', 'plate']) {
        const p = prev[k];
        if (p && (!cur[k] || cur[k].key !== p.key) && p.grid === gridKey) {
          setClosing((c) => Object.assign({}, c, { [k]: p }));
          rt.setTimeout(() => setClosing((c) => (c[k] === p ? Object.assign({}, c, { [k]: null }) : c)), k === 'card' ? HOME_CARD_CLOSE_MS : HOME_PLATE_CLOSE_MS);
        }
      }
      const g = lastGrid.current;
      lastGrid.current = { key: gridKey, items, low, dir };
      if (g && g.key !== gridKey) {
        setLeaving(g);
        rt.setTimeout(() => setLeaving((l) => (l === g ? null : l)), HOME_GRID_OUT_MS);
      }
    });
    const closingCard = closing.card && closing.card.grid === gridKey && !(showCard && attIndex === closing.card.index) ? closing.card : null;
    const closingPlate = closing.plate && closing.plate.grid === gridKey && !(showPlate && attIndex === closing.plate.index) ? closing.plate : null;

    // labels whose text the card or plate covers fade (D-C2a-5); under the card they go (its native crop
    // carries nothing but the card)
    const covered = new Set(), coveredCard = new Set();
    if (showCard) {
      const { left, top } = cardRect(attIndex, low);
      items.forEach((it, i) => {
        if (i === attIndex) return;
        const [x, y] = cellXY(i, low);
        const lx0 = x - 100, lx1 = x + 100, ly = y + 74;
        if (ly + 26 > top && ly < top + 240 && lx1 > left && lx0 < left + 320) coveredCard.add(i);
      });
    }
    // the plate's real rect against each label's text (m2): measured once the plate has rendered
    const [plateCover, setPlateCover] = React.useState(null);
    const measurePlate = React.useCallback((key, el) => {
      try {
        const pr = el.getBoundingClientRect();
        const doc = el.ownerDocument;
        const hit = [];
        for (const lab of doc.querySelectorAll('.lgs-home-grid:not(.is-leaving) > .lgs-home-cell > .lgs-home-label')) {
          const cell = lab.parentElement;
          if (!cell || cell.getAttribute('data-lgs-home-key') === key) continue;
          const rg = doc.createRange();
          rg.selectNodeContents(lab);
          const tr = rg.getBoundingClientRect();
          if (tr.width > 0 && tr.right > pr.left && tr.left < pr.right && tr.bottom > pr.top && tr.top < pr.bottom) hit.push(Number(cell.getAttribute('data-lgs-home-index')));
        }
        setPlateCover((pc) => (pc && pc.key === key && pc.set.length === hit.length && pc.set.every((v, j) => v === hit[j]) ? pc : { key, set: hit }));
      } catch (_) { /* measured next time */ }
    }, []);
    if (showPlate && plateCover && plateCover.key === attItem.key) for (const i of plateCover.set) covered.add(i);
    const clips = showCard ? cardClips(attIndex, items.length, low) : {};
    const focusKey = rkey || HS.focusKey[sKey];
    let memIdx = items.findIndex((it) => it.key === focusKey);
    if (memIdx < 0) memIdx = 0;
    // route entry: discs materialize in rings from the focused cell, 30 ms apart, at most 3 (HA §11)
    const [mx, my] = cellXY(memIdx, low);
    const ringOf = (i) => { const [x, y] = cellXY(i, low); return Math.min(3, Math.round(Math.hypot((x - mx) / 224, (y - my) / 184))); };

    // ---- explicit neighbours (HA §3.5)
    const cellEl = (i) => { try { return R.nav.win().document.querySelector('.lgs-home-grid:not(.is-leaving) > .lgs-home-cell[data-lgs-home-index="' + i + '"]'); } catch (_) { return null; } };
    const focusCell = (i, quiet) => homeFocusEl(R, cellEl(i), quiet);
    // one-step memory for the top row too (HA §3.5): Up from the cell that Down from a top-row control
    // reached returns to that control; Up from a cell that Steam's own move brought into a folder's grid
    // (from C1a's search capsule) is Steam's move back (P-20); otherwise Up goes to the selected segment
    const focusTop = (fromIdx) => {
      let el = null;
      const tm = HS.topBack;
      HS.topBack = null;
      if (tm && tm.ext && tm.to === fromIdx && tm.sKey === sKey) return false;
      try {
        const doc = R.nav.win().document;
        if (tm && tm.to === fromIdx && tm.sKey === sKey && tm.sel) el = doc.querySelector(tm.sel);
        if (!el) el = doc.querySelector(kind === 'folder' ? '.lgs-home .lgs-home-top .lgs-home-wn' : '.lgs-home .lgs-home-seg-item.is-selected');
      } catch (_) { el = null; }
      return homeFocusEl(R, el);
    };
    const toGrid = (fromSel) => {
      const k = HS.topMem[sKey];
      let i = k != null ? items.findIndex((it) => it.key === k) : -1;
      if (i < 0) i = memIdx;
      HS.topBack = fromSel ? { sel: fromSel, to: i, sKey } : null;
      return focusCell(i);
    };
    const moveFrom = (i, d) => {
      const n = items.length;
      const row = homeRowOf(i);
      const maxRow = footer ? 1 : 2;
      if (d === 'left' || d === 'right') {
        const cells = homeRowCells(row, n);
        const k = cells.indexOf(i) + (d === 'right' ? 1 : -1);
        if (k >= 0 && k < cells.length) { vmem.current = null; return focusCell(cells[k]); }
        // past the row's end or start: the same row on the next or previous page
        const np = pg + (d === 'right' ? 1 : -1);
        // first page, Left at a row's start: Steam's own move (focus leaves the main window for the tab bar,
        // exactly as Left on the first capsule of Steam's Home: stock probe 2026-10-07, SN N2)
        if (np < 0) return false;
        if (np >= pages.length) return true; // the last page's row end: focus stays
        const nn = pages[np].length;
        const tr = homeRowCells(row, nn);
        const target = tr.length ? (d === 'right' ? tr[0] : tr[tr.length - 1]) : nn - 1;
        setPage(np, target);
        return true;
      }
      const m = vmem.current;
      if (m && m.to === i && m.dir === (d === 'up' ? 'down' : 'up')) { // one-step memory
        vmem.current = { from: i, to: m.from, dir: d };
        return focusCell(m.from);
      }
      if (d === 'up' && row === 0) { HS.topMem[sKey] = items[i] && items[i].key; vmem.current = null; return focusTop(i); }
      HS.topBack = null; // any other vertical move ends the top row's one-step memory
      const nr = row + (d === 'up' ? -1 : 1);
      if (nr > maxRow) return true; // bottom row: nothing below
      const tr = homeRowCells(nr, n);
      if (!tr.length) return true;
      const t = tr[Math.min(i - HOME_ROW_START[row], tr.length - 1)];
      vmem.current = { from: i, to: t, dir: d };
      return focusCell(t);
    };
    React.useEffect(() => {
      if (pend.current == null) return undefined;
      const want = pend.current;
      pend.current = null;
      // the page or section change already played its own sound
      const t = rt.setTimeout(() => focusCell(want === 'mem' ? memIdx : Math.min(want, items.length - 1), true), 30);
      return () => { try { rt.clearTimeout(t); } catch (_) { /* gone */ } };
    }, [pg, section]);

    const rootCls = ['lgs-home'];
    if (low) rootCls.push('lgs-home-low');
    if (footer) rootCls.push('lgs-home-footer');
    if (moving) rootCls.push('lgs-home-moving');
    const onButtonDown = (e) => {
      const b = e && e.detail && (e.detail.button != null ? e.detail.button : e.detail);
      if (kind !== 'folder' && (b === 5 || b === 6)) { // LB / RB: sections (HA-3); What's New is not in the cycle
        const i = sections.indexOf(section) + (b === 6 ? 1 : -1);
        if (i >= 0 && i < sections.length) setSection(sections[i]);
        return;
      }
      if (b === 7 || b === 8) setPage(pg + (b === 8 ? 1 : -1), focusInGrid() ? 0 : null); // LT / RT: pages
    };
    const next = pages[pg + 1], prev = pages[pg - 1];
    const peek = (side, list) => {
      const out = [];
      if (!list) return out;
      const rows = footer ? [[0, low ? HOME_LOW_Y[196] : 196]] : [[0, low ? HOME_LOW_Y[196] : 196], [2, low ? HOME_LOW_Y[572] : 572]];
      const turn = () => setPage(pg + (side === 'next' ? 1 : -1), focusInGrid() ? 0 : null);
      for (const [row, cy] of rows) {
        const it = side === 'next' ? list[HOME_ROW_START[row]] : list[Math.min(list.length, HOME_ROW_START[row] + HOME_ROW_LEN[row]) - 1];
        if (!it) continue;
        // the laser's page turn: P3's dwell look and the press swell (m1); the gamepad turns pages at row ends
        out.push(jsx('div', { className: 'lgs-home-peek', 'data-side': side, 'data-kind': it.kind, 'data-lgs-dwell': '', role: 'button', 'aria-label': it.name || undefined,
          style: { left: (side === 'next' ? 1212 : 68) + 'px', top: cy + 'px' },
          onClick: turn, children: jsx(Art, { item: it }) }, side + row));
      }
      return out;
    };
    const rootProps = { className: rootCls.join(' '), 'flow-children': 'column', onButtonDown, 'data-lgs-kind': kind, 'data-lgs-home': '1' };
    if (kind !== 'folder') rootProps['data-lgs-section'] = section;
    if (kind === 'folder') { rootProps.onCancel = () => R.nav.back(); rootProps.onCancelActionDescription = homeStr(R, 'back') || undefined; }
    // At the Home root B is not handled: it bubbles to Steam's root, which goes back in history exactly as on
    // Steam's own Home (stock probe 2026-10-07: /library/tab/AllGames -> /library/home, B -> AllGames)
    const cardFor = (i) => {
      if (showCard && i === attIndex) return jsx(SafeCard, { item: attItem, index: attIndex, low, menuOpen: menuKey === attItem.key }, 'card-' + attItem.key);
      if (closingCard && closingCard.index === i && items[i] && items[i].key === closingCard.key) return jsx(SafeCard, { item: closingCard.item, index: i, low, closing: true }, 'card-' + closingCard.key);
      return null;
    };
    // A render failure inside Home: Steam's own Home in a window (M7, HA §3.7); a folder shows P2's page
    const onFail = () => {
      if (!HS || kind === 'folder') return;
      HS.failed = true;
      try { if (rt.has('shell')) rt.use('shell').refreshGlass(); } catch (_) { /* no shell */ }
    };
    // the page props Steam's own Home passes (its GamepadPage: no header or footer padding, header
    // visibility 'default', minimum opacity 0)
    return jsx(R.ui.ErrorBoundary, { name: 'c2a-home', fallback: kind === 'folder' ? undefined : (HS.steam || null), onError: onFail, children: jsx(c.GamepadPage, { scrollable: false, padForHeader: false, padForFooter: false, headerVisibility: 'default', minimumOpacity: 0, children: jsxs(c.Focusable, Object.assign(rootProps, {
      children: [
        jsx(TopRow, { kind, section, sections, onSection: setSection, title: folder ? folder.title : null, libPath: folder ? folder.lib : null, toGrid }, 'top'),
        leaving ? jsx('div', { className: 'lgs-home-grid is-leaving', 'aria-hidden': 'true',
          children: leaving.items.map((it, i) => jsx(GhostCell, { item: it, index: i, low: leaving.low }, it.key)) }, 'leave-' + leaving.key) : null,
        jsx(c.Focusable, {
          className: 'lgs-home-grid is-entering', style: { '--lgs-page-dx': (dir * 16) + 'px' },
          children: items.map((it, i) => jsx(Cell, { item: it, index: i, low, focusMe: i === memIdx, under: covered.has(i), underCard: coveredCard.has(i),
            hidden: (showCard || showPlate) && i === attIndex, move: moveFrom, cardOn: showCard, clip: clips[i] || null, ring: ringOf(i), kind,
            card: cardFor(i), cardOpen: showCard && i === attIndex }, it.key)),
        }, 'grid-' + gridKey),
        ...peek('next', next), ...peek('prev', prev),
        pages.length > 1 ? jsx('div', { className: 'lgs-home-dots', children: pages.map((_, i) => jsx('i', { className: i === pg ? 'is-on' : undefined }, i)) }, 'dots') : null,
        ...(low ? HOME_BANDS_LOW : HOME_BANDS).map(([y0, y1], i) => jsx('div', { className: 'lgs-home-band', 'data-lgs-mosaic': '', style: { top: y0 + 'px', height: (y1 - y0) + 'px' } }, 'band' + i)),
        showPlate ? jsx(NamePlate, { item: attItem, index: attIndex, low, onMeasure: measurePlate }, 'plate-' + attItem.key) : null,
        closingPlate && items[closingPlate.index] && items[closingPlate.index].key === closingPlate.key
          ? jsx(NamePlate, { item: closingPlate.item, index: closingPlate.index, low, closing: true }, 'plate-out-' + closingPlate.key) : null,
      ],
    })) }) });
  }

  function HomeRoute() { return jsx(HomeView, { kind: 'home' }); }
  function FolderRoute(props) {
    const id = props && props.match && props.match.params ? decodeURIComponent(props.match.params.id) : '';
    return jsx(HomeView, { kind: 'folder', folderId: id }, 'folder-' + id);
  }
  // What's New: Steam's own Home page (its children, captured by the override) in a window-full
  // window. B goes back to Home (HA §3.6) instead of opening the tab bar as on Steam's root.
  function SteamHomeRoute() {
    useLive();
    // entered before our Home rendered once in this install (a history entry): Steam's Home children are
    // captured by the Home override, so pass through Home and come back (m15)
    React.useEffect(() => {
      if (HS && !HS.steam) { HS.wnPending = true; R.nav.go(R.Routes.Library.Home(), true); }
    }, []);
    if (!HS || !HS.steam) return null;
    const wn = homeStr(R, 'whatsnew');
    return jsx(c.Focusable, {
      className: 'lgs-home-steamhome', 'data-lgs-title': wn || undefined,
      onCancel: () => R.nav.back(), onCancelActionDescription: homeStr(R, 'back') || undefined,
      children: HS.steam,
    });
  }
  return { HomeRoute, FolderRoute, SteamHomeRoute, HomeView };
}
