// Glass Shell runtime module "gamepage" (package C5a): the game page's T2.
// Concept: docs/phase2/concepts/game-pages.md (GP) §3.2, §4.1, §4.3; PLAN §1.2, §1.13.
// Contracts: runtime.md (P1: define, rt.*); interaction.md §4 (P3's in-window tooltips via data-lgs-tip);
// C1a's shell API (glassMode('app', fn), refreshGlass) when the shell module is installed (optional).
// Behind flag wp.c5a (PLAN §2.1). The DOM hooks are the contract with theme/50-appdetails.css (its header).
//
// What it does while installed, on /library/app/:appid only:
//   - the state: data-lgs-gp="title" | "details" on %{PartnerEventOverlayContainer>AppDetailsMain}, from the
//     outer scroller (details = scrolled to its end, where Steam pins the tab row). Set on change only; the CSS
//     makes the art sticky and cross-fades it; C1a's glass mode follows (hero / window);
//   - content arrival: data-lgs-gp-jump on the outer scroller for 700 ms after Steam's programmatic jump
//     (> 120 px between two scroll events); continuous laser scrolling never sets it;
//   - the adaptive dimming: one 160 x 82 canvas sample of the hero Steam shows, per hero URL, solved for 4.5:1
//     (3:1 for glyphs) and written as --lgs-gp-dimT / -dimL / -dimB on %{HeaderBackgroundImage};
//   - Steam Input's label: data-lgs-label on %{ControllerConfigButton} from Steam's own localized
//     #AppControllerConfiguration_SteamInput (no new string);
//   - tooltips above the icon-only cluster circles (Play from, Stop, Manage): data-lgs-tip="above" and
//     data-lgs-tip-pad="now", text from Steam's aria-label (P3 draws them);
//   - the inline title: one aria-hidden node (.lgs-gp-title) in the route's non-scrolling container, text
//     appStore.GetAppOverviewByAppID(appid).display_name, shown in the details state;
//   - tags the tab segments data-lgs-exempt="E-SEG" (PLAN §1.16).
// It never calls a Steam setter, never moves or removes a React node, and adds one node of its own. Every
// attribute and the node are removed on remove(); a missing Steam node only skips that step.

/* eslint-disable no-var */
__LGS_RT.define({
  name: 'gamepage',
  flag: 'wp.c5a',
  install(rt) { return gpInstall(rt); },
  remove() { return gpRemove(); },
});

var GP = null;
var GP_TICK_MS = 250;
var GP_JUMP_PX = 120;
var GP_JUMP_MS = 700;

function gpInstall(rt) {
  var S = GP = { rt: rt, marks: new Map(), sel: null, scroller: null, offScroll: null, lastTop: 0, jumpOff: null,
    state: null, glassReg: null, title: null, dimFor: null, dims: null, appid: null };
  S.sel = {
    main: rt.sel('%{PartnerEventOverlayContainer>AppDetailsMain}'),
    scroller: rt.sel('%{ScrollToTopButtonPosition>Body}'),
    fixed: rt.sel('%{ScrollToTopButtonPosition>Container}'),
    hbi: rt.sel('%{HeaderBackgroundImage}'),
    heroImg: rt.sel('%{HeaderBackgroundImage} %{ImgContainer} img'),
    logo: rt.sel('%{TitleLogo}'),
    ccb: rt.sel('%{ControllerConfigButton}'),
    stream: rt.sel('%{StreamingSelector}'),
    stop: rt.sel('%{ShutdownAppButton}'),
    menuBtn: rt.sel('%{AppButtons} %{MenuButtonContainer} %{Container>MenuButton}'),
    tab: rt.sel('%{AppDetailsContainer} %{GamepadTabbedPage>Tab}'),
  };
  rt.setInterval(function () { gpTick(S); }, GP_TICK_MS);
  gpTick(S);
  return {
    status: function () { return gpStatus(S); },
  };
}

function gpRemove() {
  var S = GP;
  GP = null;
  if (!S) return { patchedLeft: 0 };
  gpDetachScroller(S);
  if (S.glassReg) { try { S.glassReg.remove(); } catch (_) { /* gone */ } S.glassReg = null; }
  if (S.title) { try { S.title.remove(); } catch (_) { /* gone */ } S.title = null; }
  gpClearMarks(S, null);
  try { if (S.rt.has('shell')) S.rt.use('shell').refreshGlass(); } catch (_) { /* none */ }
  return { patchedLeft: 0 };
}

// ------------------------------------------------------------------ attributes we own
function gpMark(S, el, name, value) {
  if (!el) return;
  if (value === null || value === undefined) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
    var s0 = S.marks.get(el);
    if (s0) { s0.delete(name); if (!s0.size) S.marks.delete(el); }
    return;
  }
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  var set = S.marks.get(el);
  if (!set) { set = new Set(); S.marks.set(el, set); }
  set.add(name);
}

function gpStyle(S, el, prop, value) {
  // custom properties on Steam's node; tracked as a pseudo attribute "style:<prop>"
  if (!el) return;
  if (el.style.getPropertyValue(prop) !== value) el.style.setProperty(prop, value);
  var set = S.marks.get(el);
  if (!set) { set = new Set(); S.marks.set(el, set); }
  set.add('style:' + prop);
}

function gpClearMarks(S, keep) {
  S.marks.forEach(function (names, el) {
    names.forEach(function (name) {
      if (keep && keep.has(el) && keep.get(el).has(name)) return;
      try {
        if (name.indexOf('style:') === 0) el.style.removeProperty(name.slice(6));
        else el.removeAttribute(name);
      } catch (_) { /* gone */ }
      names.delete(name);
    });
    if (!names.size || !el.isConnected) S.marks.delete(el);
  });
}

function gpLoc(rt, token) {
  try {
    var W = rt.W;
    var lm = W.LocalizationManager;
    var s = lm && typeof lm.LocalizeString === 'function' ? lm.LocalizeString(token) : null;
    if (!s && typeof W.LocalizeString === 'function') s = W.LocalizeString(token);
    return s && s !== token ? String(s) : null;
  } catch (_) { return null; }
}

// ------------------------------------------------------------------ the outer scroller
function gpDetachScroller(S) {
  if (S.offScroll) { try { S.offScroll(); } catch (_) { /* gone */ } S.offScroll = null; }
  if (S.jumpOff) { try { S.jumpOff(); } catch (_) { /* gone */ } S.jumpOff = null; }
  if (S.scroller) { try { S.scroller.removeAttribute('data-lgs-gp-jump'); } catch (_) { /* gone */ } }
  S.scroller = null;
}

function gpAttachScroller(S, sc) {
  if (S.scroller === sc) return;
  gpDetachScroller(S);
  S.scroller = sc;
  S.lastTop = sc.scrollTop;
  S.offScroll = S.rt.listen(sc, 'scroll', function () {
    if (GP !== S || S.scroller !== sc) return;
    var top = sc.scrollTop;
    var d = Math.abs(top - S.lastTop);
    S.lastTop = top;
    if (d > GP_JUMP_PX) {
      if (S.jumpOff) { try { S.jumpOff(); } catch (_) { /* gone */ } }
      sc.removeAttribute('data-lgs-gp-jump');
      void sc.offsetWidth; // restart the arrival animation
      sc.setAttribute('data-lgs-gp-jump', '');
      S.jumpOff = S.rt.setTimeout(function () { try { sc.removeAttribute('data-lgs-gp-jump'); } catch (_) { /* gone */ } S.jumpOff = null; }, GP_JUMP_MS);
    }
    gpTick(S);
  }, { passive: true });
}

// ------------------------------------------------------------------ adaptive dimming (GP §4.1)
function gpLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function gpLum(r, g, b) { return 0.2126 * gpLin(r) + 0.7152 * gpLin(g) + 0.0722 * gpLin(b); }
function gpContrast(a, b) { var hi = Math.max(a, b), lo = Math.min(a, b); return (hi + 0.05) / (lo + 0.05); }

// smallest dim alpha in [lo, .70] that gives `ratio` for white text at alpha `t` (over an optional white fill `f`)
function gpSolve(bg, t, f, ratio, lo) {
  for (var a = lo; a <= 0.7001; a += 0.01) {
    var c = bg * (1 - a);                 // sRGB value of the dimmed background (grey approximation)
    if (f) c = c * (1 - f) + 255 * f;     // clear glass white fill
    var txt = 255 * t + c * (1 - t);
    var lb = gpLum(c, c, c), lt = gpLum(txt, txt, txt);
    if (gpContrast(lt, lb) >= ratio) return Math.round(a * 100) / 100;
  }
  return 0.70;
}

function gpSample(S, img) {
  try {
    if (!img || !img.complete || !img.naturalWidth) return null;
    var doc = img.ownerDocument;
    var cv = doc.createElement('canvas');
    var W = 160, H = 82;
    cv.width = W; cv.height = H;
    var cx = cv.getContext('2d', { willReadFrequently: true });
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var sc = Math.max(W / iw, H / ih);
    var dw = iw * sc, dh = ih * sc;
    cx.drawImage(img, (W - dw) * 0.62, (H - dh) * 0.40, dw, dh);
    var px = cx.getImageData(0, 0, W, H).data;
    // 95th-percentile of the max channel (a grey proxy that is conservative for colour) in a box (window px)
    function p95(x0, y0, x1, y1) {
      var a = [];
      var X0 = Math.max(0, Math.floor(x0 / 8)), X1 = Math.min(W, Math.ceil(x1 / 8));
      var Y0 = Math.max(0, Math.floor(y0 / 8)), Y1 = Math.min(H, Math.ceil(y1 / 8));
      for (var y = Y0; y < Y1; y++) for (var x = X0; x < X1; x++) {
        var i = (y * W + x) * 4;
        a.push(Math.max(px[i], px[i + 1], px[i + 2]));
      }
      if (!a.length) return 0;
      a.sort(function (p, q) { return p - q; });
      return a[Math.min(a.length - 1, Math.floor(a.length * 0.95))];
    }
    var text = p95(40, 244, 620, 390);     // chip, stats line (labels white .80)
    var ctl = p95(432, 448, 718, 612);     // Steam Input label, tab labels (white .96 on white .12)
    var tool = Math.max(p95(24, 24, 84, 84), p95(380, 24, 900, 84)); // Back, search glyphs (3:1)
    return {
      dimL: gpSolve(text, 0.80, 0, 4.5, 0.40),
      dimB: gpSolve(ctl, 0.96, 0.12, 4.5, 0.35),
      dimT: gpSolve(tool, 0.96, 0, 3.0, 0.25),
    };
  } catch (_) { return null; } // tainted canvas or no 2D context: keep T1's fixed dimming
}

// ------------------------------------------------------------------ the tick
function gpTick(S) {
  if (GP !== S) return;
  var mainW = S.rt.windows.main();
  if (!mainW || !mainW.doc) return;
  var doc = mainW.doc;
  var want = new Map();
  function keep(el, name, value) {
    if (!el) return;
    gpMark(S, el, name, value);
    var s = want.get(el);
    if (!s) { s = new Set(); want.set(el, s); }
    s.add(name);
  }
  function keepStyle(el, prop, value) {
    if (!el) return;
    gpStyle(S, el, prop, value);
    var s = want.get(el);
    if (!s) { s = new Set(); want.set(el, s); }
    s.add('style:' + prop);
  }
  var root = doc.querySelector(S.sel.main);
  var state = null;
  if (root) {
    var sc = root.querySelector(S.sel.scroller);
    if (sc) gpAttachScroller(S, sc);
    var range = sc ? sc.scrollHeight - sc.clientHeight : 0;
    state = sc && range > 40 && sc.scrollTop >= range - 4 ? 'details' : 'title';
    keep(root, 'data-lgs-gp', state);

    // adaptive dimming, once per hero URL
    var hbi = root.querySelector(S.sel.hbi);
    var img = root.querySelector(S.sel.heroImg);
    var src = img ? img.currentSrc || img.src : null;
    if (src && src !== S.dimFor) {
      var d = gpSample(S, img);
      if (d) { S.dimFor = src; S.dims = d; }
    }
    if (hbi && S.dims && src === S.dimFor) {
      keepStyle(hbi, '--lgs-gp-dimT', String(S.dims.dimT));
      keepStyle(hbi, '--lgs-gp-dimL', String(S.dims.dimL));
      keepStyle(hbi, '--lgs-gp-dimB', String(S.dims.dimB));
    }

    // Steam Input's label, Steam's own string
    var ccb = root.querySelector(S.sel.ccb);
    var lab = gpLoc(S.rt, '#AppControllerConfiguration_SteamInput');
    if (ccb && lab) keep(ccb, 'data-lgs-label', lab);
    else if (ccb) { keep(ccb, 'data-lgs-tip', 'above'); keep(ccb, 'data-lgs-tip-pad', 'now'); }

    // tooltips above the icon-only circles
    var circles = [root.querySelector(S.sel.stream), root.querySelector(S.sel.stop), root.querySelector(S.sel.menuBtn)];
    for (var i = 0; i < circles.length; i++) {
      if (!circles[i] || !circles[i].getAttribute('aria-label')) continue;
      keep(circles[i], 'data-lgs-tip', 'above');
      keep(circles[i], 'data-lgs-tip-pad', 'now');
    }

    // tab segments are a segmented control (E-SEG)
    var tabs = root.querySelectorAll(S.sel.tab);
    for (var j = 0; j < tabs.length && j < 12; j++) keep(tabs[j], 'data-lgs-exempt', 'E-SEG');

    // the inline title
    gpTitle(S, root, state);
  } else {
    if (S.scroller) gpDetachScroller(S);
    if (S.title) { try { S.title.remove(); } catch (_) { /* gone */ } S.title = null; }
  }
  gpClearMarks(S, want);
  if (state !== S.state) {
    S.state = state;
    gpGlass(S);
  }
}

function gpAppId(S) {
  try {
    var inst = S.rt.W.SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
    var m = /\/library\/app\/(\d+)/.exec(String(inst.m_history.location.pathname || ''));
    if (m) return Number(m[1]);
  } catch (_) { /* none */ }
  return null;
}

function gpTitle(S, root, state) {
  var host = root.querySelector(S.sel.fixed);
  if (!host) return;
  if (!S.title || !S.title.isConnected || S.title.parentNode !== host) {
    if (S.title) { try { S.title.remove(); } catch (_) { /* gone */ } }
    var d = host.ownerDocument.createElement('div');
    d.className = 'lgs-gp-title';
    d.setAttribute('aria-hidden', 'true');
    d.setAttribute('data-on', '0');
    d.appendChild(host.ownerDocument.createElement('span'));
    host.appendChild(d);
    S.title = d;
    S.appid = null;
  }
  var id = gpAppId(S);
  if (id !== S.appid) {
    S.appid = id;
    var name = null;
    try {
      var ov = id && S.rt.W.appStore ? S.rt.W.appStore.GetAppOverviewByAppID(id) : null;
      name = ov && ov.display_name ? String(ov.display_name) : null;
    } catch (_) { name = null; }
    if (!name) { var lg = root.querySelector(S.sel.logo); name = lg ? lg.getAttribute('alt') : null; }
    S.title.firstChild.textContent = name || '';
  }
  var on = state === 'details' && S.title.firstChild.textContent ? '1' : '0';
  if (S.title.getAttribute('data-on') !== on) S.title.setAttribute('data-on', on);
}

function gpGlass(S) {
  var rt = S.rt;
  try {
    if (!rt.has('shell')) return;
    var shell = rt.use('shell');
    if (!S.glassReg) {
      S.glassReg = shell.glassMode('app', function () {
        if (GP !== S) return null;
        return S.state === 'details' ? 'window' : (S.state === 'title' ? 'hero' : null);
      });
    }
    shell.refreshGlass();
  } catch (_) { /* the shell is optional */ }
}

function gpStatus(S) {
  var mainW = S.rt.windows.main();
  var doc = mainW && mainW.doc;
  var root = doc ? doc.querySelector(S.sel.main) : null;
  return {
    route: !!root,
    state: S.state,
    dims: S.dims,
    title: S.title ? S.title.textContent : null,
    appid: S.appid,
    glassHook: !!S.glassReg,
    marks: S.marks.size,
  };
}
