// Glass Shell runtime module "settings" (package C6a): Steam Settings' T2.
// Concept: docs/phase2/concepts/settings.md (SET) §3.3, §3.5, §4.7; PLAN §1.7 rule 4, §1.15.
// Contracts: runtime.md (P1: define, rt.*); C1a's shell API (refreshGlass, the Large Title from
// [data-lgs-title]); reporter.md §2.4 (data-lgs-destructive). Behind flag wp.c6a (PLAN §2.1).
// The DOM hooks are the contract with theme/60-settings.css (its header lists them).
//
// While installed, on /settings routes only (main window), every 300 ms:
//   - data-lgs-page="<route key>" on each sidebar item (the item's React key, "/settings/<key>")
//     and on the dialog root (the current page): icon-circle colours and the hero circle;
//   - --lgs-set-glyph on the dialog root: Steam's own sidebar glyph of the current page, as a
//     white SVG data: URI, drawn by CSS in the hero circle (no node is inserted);
//   - data-lgs-hero + --lgs-set-hero-tw on the dialog root: the hero title's measured text width, so CSS
//     centres the circle and the title as one group (the circle is an absolute ::before: P6 crops it);
//   - data-lgs-title on the dialog root: Steam's "#MainTabsSettings" (C1a draws the Large Title);
//   - data-lgs-destructive on page buttons whose label equals one of Steam's localised destructive
//     labels (SET §4.7; never popped, PLAN §1.7 rule 4). Unmatched buttons stay neutral.
// It never calls a Steam setter, never clicks, never moves a React node and adds no nodes. Every
// attribute and style property it sets is removed on remove(); a missing Steam node skips a step.

/* eslint-disable no-var */
__LGS_RT.define({
  name: 'settings',
  deps: [],
  flag: 'wp.c6a',
  install(rt) { return setInstall(rt); },
  remove() { return setRemove(); },
});

var SETS = null;
var SET_TICK_MS = 300;
// Steam's own tokens for the destructive labels SET §4.7 names (probed on build 11094443)
var SET_DESTRUCTIVE_TOKENS = [
  'Settings_System_Factory_Reset', 'Settings_System_FormatSD_Btn_Format', 'ContentManagement_Format',
  'Settings_RemotePlay_UnpairDevice', 'Settings_RemotePlay_WifiAP_Unpair', 'Settings_System_Change_Hostname_Set',
  'Audio_Reset_Config', 'Settings_Developer_ClearGameLaunchInterstitialsSeenButton',
  'Settings_System_Change_User_Password_Change', 'ContentManagement_UninstallButton',
  'DownloadSettings_ClearDownloadCacheButton', 'Settings_Internet_Forget', 'Settings_Controller_PairingInfo_Forget',
  'Settings_Controller_Frame_Pairing_Forget',
];

function setInstall(rt) {
  var S = SETS = {
    rt: rt, marks: new Map(), styled: new Set(), keys: new WeakMap(), glyphs: new Map(),
    destructive: null, title: null, lastTitleRoot: null,
  };
  S.sel = {
    dialog: rt.sel('%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog}') +
      ':not(' + rt.sel('%{AppProperties}') + ', ' + rt.sel('%{NotesPagedSettings}') + ')',
    item: rt.sel('%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageListItem}'),
    active: rt.sel('%{PagedSettingsDialog_PageList_ShowTitle>Active}'),
    icon: rt.sel('%{PagedSettingsDialog_PageList_ShowTitle>PageListItem_Icon}'),
    content: rt.sel('%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageContent}'),
  };
  rt.setInterval(function () { setTick(S); }, SET_TICK_MS);
  setTick(S);
  return {
    status: function () { return setStatus(S); },
    tick: function () { setTick(S); return setStatus(S); },
  };
}

function setRemove() {
  var S = SETS;
  SETS = null;
  if (!S) return { patchedLeft: 0 };
  setClear(S, null);
  S.styled.forEach(function (el) { setUnstyle(el); });
  S.styled.clear();
  return { patchedLeft: 0 };
}

// ------------------------------------------------------------------ attributes we own
function setMark(S, want, el, name, value) {
  if (!el) return;
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  var set = S.marks.get(el);
  if (!set) { set = new Set(); S.marks.set(el, set); }
  set.add(name);
  var w = want.get(el);
  if (!w) { w = new Set(); want.set(el, w); }
  w.add(name);
}

function setClear(S, want) {
  S.marks.forEach(function (names, el) {
    names.forEach(function (name) {
      if (want && want.has(el) && want.get(el).has(name)) return;
      try { el.removeAttribute(name); } catch (_) { /* gone */ }
      names.delete(name);
    });
    if (!names.size || !el.isConnected) S.marks.delete(el);
  });
}

function setPath(S) {
  try { return S.rt.W.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.m_history.location.pathname || ''; }
  catch (_) { return ''; }
}

function setLoc(S, token) {
  try {
    var m = S.rt.W.LocalizationManager && S.rt.W.LocalizationManager.m_mapTokens;
    var v = m && m.get(token);
    return v ? String(v).trim() : null;
  } catch (_) { return null; }
}

// the sidebar item's route key, from its React key "/settings/<key>[/...]"
function setItemKey(S, el) {
  if (S.keys.has(el)) return S.keys.get(el);
  var key = null;
  try {
    var k = Object.keys(el).find(function (x) { return x.indexOf('__reactFiber') === 0; });
    var f = k ? el[k] : null;
    for (var i = 0; f && i < 8; i++, f = f.return) {
      if (typeof f.key === 'string' && f.key.indexOf('/settings/') === 0) {
        key = f.key.slice(10).split('/')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
        break;
      }
    }
  } catch (_) { key = null; }
  if (key) S.keys.set(el, key);
  return key;
}

// Steam's own glyph as a white SVG data: URI (cached per page key)
function setGlyph(S, key, item) {
  if (S.glyphs.has(key)) return S.glyphs.get(key);
  var uri = null;
  try {
    var svg = item && item.querySelector(S.sel.icon + ' svg');
    if (svg) {
      var c = svg.cloneNode(true);
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      c.removeAttribute('class');
      c.setAttribute('color', '#fff');
      if (!c.getAttribute('fill')) c.setAttribute('fill', '#fff');
      c.setAttribute('width', '32');
      c.setAttribute('height', '32');
      var txt = new S.rt.W.XMLSerializer().serializeToString(c).replace(/currentColor/g, '#fff');
      if (txt.length < 12000) uri = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(txt) + '")';
    }
  } catch (_) { uri = null; }
  if (uri) S.glyphs.set(key, uri);
  return uri;
}

function setDestructiveLabels(S) {
  if (S.destructive && S.destructive.size) return S.destructive;
  var set = new Set();
  for (var i = 0; i < SET_DESTRUCTIVE_TOKENS.length; i++) {
    var v = setLoc(S, SET_DESTRUCTIVE_TOKENS[i]);
    if (v) set.add(v);
  }
  S.destructive = set;
  return set;
}

// ------------------------------------------------------------------ the tick
function setTick(S) {
  if (SETS !== S) return;
  var want = new Map();
  var path = setPath(S);
  var main = S.rt.windows.main();
  var doc = main && main.doc;
  var root = null;
  if (doc && path.indexOf('/settings') === 0) {
    root = doc.querySelector(S.sel.dialog);
  }
  if (root) {
    var items = root.querySelectorAll(S.sel.item);
    var activeKey = null;
    var activeItem = null;
    for (var i = 0; i < items.length && i < 60; i++) {
      var key = setItemKey(S, items[i]);
      if (!key) continue;
      setMark(S, want, items[i], 'data-lgs-page', key);
      if (items[i].matches(S.sel.active)) { activeKey = key; activeItem = items[i]; }
    }
    var seg = path.split('/')[2] || '';
    var page = (seg.toLowerCase().replace(/[^a-z0-9_-]/g, '')) || activeKey;
    if (page) setMark(S, want, root, 'data-lgs-page', page);
    // the glyph of the current page (its sidebar item is the active one)
    if (page && activeItem && activeKey === page) {
      var g = setGlyph(S, page, activeItem);
      if (g && root.style.getPropertyValue('--lgs-set-glyph') !== g) {
        root.style.setProperty('--lgs-set-glyph', g);
        S.styled.add(root);
      }
    }
    // the hero: the title's text width, so CSS centres the circle and the title as one group
    var hdr = root.querySelector(S.sel.content + ' > .DialogContent_InnerWidth > .DialogHeader');
    var tw = 0;
    if (hdr && root.style.getPropertyValue('--lgs-set-glyph')) {
      try {
        var rg = doc.createRange();
        rg.selectNodeContents(hdr);
        tw = Math.round(rg.getBoundingClientRect().width);
      } catch (_) { tw = 0; }
    }
    if (tw > 0) {
      var twv = tw + 'px';
      if (root.style.getPropertyValue('--lgs-set-hero-tw') !== twv) root.style.setProperty('--lgs-set-hero-tw', twv);
      S.styled.add(root);
      setMark(S, want, root, 'data-lgs-hero', '');
    }
    // the Large Title ("Settings", Steam's own string), drawn by C1a
    var title = setLoc(S, 'MainTabsSettings');
    if (title) {
      setMark(S, want, root, 'data-lgs-title', title);
      if (S.lastTitleRoot !== root && S.rt.has('shell')) {
        S.lastTitleRoot = root;
        try { S.rt.use('shell').refreshGlass(); } catch (_) { /* optional */ }
      }
    }
    // destructive buttons (by Steam's own localised labels)
    var labels = setDestructiveLabels(S);
    var content = root.querySelector(S.sel.content);
    if (content && labels.size) {
      var btns = content.querySelectorAll('button.DialogButton');
      for (var j = 0; j < btns.length && j < 200; j++) {
        var t = (btns[j].textContent || '').trim();
        if (t && labels.has(t)) setMark(S, want, btns[j], 'data-lgs-destructive', '');
      }
    }
  }
  setClear(S, want);
  // leaving Settings: C1a re-reads [data-lgs-title] now that ours is gone
  if (!root && S.lastTitleRoot) {
    S.lastTitleRoot = null;
    if (S.rt.has('shell')) { try { S.rt.use('shell').refreshGlass(); } catch (_) { /* optional */ } }
  }
  // style properties on a root that is gone or no longer current
  S.styled.forEach(function (el) {
    if (el !== root || !el.isConnected) {
      setUnstyle(el);
      S.styled.delete(el);
    }
  });
}

function setUnstyle(el) {
  try {
    el.style.removeProperty('--lgs-set-glyph');
    el.style.removeProperty('--lgs-set-hero-tw');
    if (el.getAttribute('style') === '') el.removeAttribute('style');
  } catch (_) { /* gone */ }
}

function setStatus(S) {
  var main = S.rt.windows.main();
  var doc = main && main.doc;
  var root = doc ? doc.querySelector(S.sel.dialog) : null;
  return {
    route: setPath(S),
    root: !!root,
    page: root ? root.getAttribute('data-lgs-page') : null,
    glyph: root ? !!root.style.getPropertyValue('--lgs-set-glyph') : false,
    title: root ? root.getAttribute('data-lgs-title') : null,
    marks: S.marks.size,
    destructive: doc ? doc.querySelectorAll('[data-lgs-destructive]').length : 0,
    glyphs: S.glyphs.size,
  };
}
