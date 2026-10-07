// Liquid Glass Shell: layer reporter for the native glass compositor.
//
// The daemon (device/lgs_shell.py) evaluates this inside Steam's
// SharedJSContext. If window.__LGS_LAYERS_OPTS = {layers, binding, ackMode} is
// set beforehand, it reads (and deletes) it and starts itself with those
// rules. Tokens resolve through window.__LGS_INDEX (built by lgs_core.js while
// the theme is on) or through lgsBuildIndex when device/lgs_index.js is
// prepended; without either it waits for the theme. It installs
// window.__LGS_LAYERS:
//
//   start(rules, opts)  rules = theme/layers.json (object or JSON text),
//                  opts.binding = binding name (default "lgsLayers"),
//                  opts.ackMode = tag elements only once acknowledged (ack()),
//                  opts.pingTtlMs = self-stop after this long without ping()
//                  once pinged (default 12000), opts.attrPrefix = attribute
//                  names (tests; default "data-lgs"). Starts, or restarts
//                  with new rules. Returns status().
//   stop(o)        stops, removes every data-lgs-* attribute it set, emits a
//                  last report with every surface invisible ("stopped": true)
//                  and deletes window.__LGS_LAYERS, so a daemon that checks
//                  for it re-injects. o.silent: no last report.
//   ping()         the daemon's heartbeat (call it every second or so):
//                  {running, version, seq, paused, dash}. After the first ping
//                  the reporter stops itself when pings stop for pingTtlMs.
//   ack(map)       the daemon's acknowledgement {overlayKey: [popped layer
//                  ids]}, one key per surface that is in the scene-graph spec
//                  (with [] when nothing of it pops). null leaves ack mode.
//                  Returns how many elements carry data-lgs-pop.
//   resend()       measures now and emits the report even if unchanged.
//   snapshot()     the current report as an object, computed fresh. Emits
//                  nothing and changes nothing.
//   status()       counters, timing, wake sources, dashboard state, rule errors.
//   debug(name)    per-rule candidates of one surface (or all) and why each
//                  was kept or dropped.
//   overlay(ms)    debug only: outlines the cover and every layer in each
//                  window for ms milliseconds (default 8000), then removes it.
//   forceDash(v)   tests only: pretend SteamVR's dashboard is shown (true) or
//                  hidden (false); null goes back to asking SteamVR.
//
// Reports go to window.lgsLayers(json), the CDP binding the daemon adds with
// Runtime.addBinding, only when something changed. Format: docs/NATIVE.md,
// "Steam -> daemon: layer report", plus "dash" (SteamVR's dashboard
// visibility) and, while theme/layers.json has problems, "errors". Each
// surface also carries:
//   "material"  the material of the surface's own glass (the cover)
//   "shapes"    [{x, y, w, h, r}] in texture px: the rounded regions the cover
//               fills. Main's is the whole window; the bar's are its segments,
//               a popup's its card(s), the footer's its capsule. [] when the
//               surface is not visible.
// Layer ids name slots, not elements: a rule's first element is reported as
// the rule id, later ones as "<id>.1", "<id>.2"; an id moves with the rule's
// match (the focused card). A layer's w/h only change once its element is
// settled (no geometric transition or animation on it or an ancestor), so
// glassd re-packs slabs once per change, not per animation frame; meanwhile
// its x/y follow with the last settled size. A surface is "visible" while its
// window shows and its cover element is on screen. While SteamVR hides the
// dashboard nothing is measured and the last layout stays reported as it was
// (glassd and SteamVR handle the hidden dashboard). Hidden pooled popups
// (keyPrefix surfaces) are left out of the report.
//
// Attributes: a visible surface's cover element(s) carry data-lgs-cover and
// every popped element data-lgs-pop ("self", "before" or "after", the part
// that pops); theme/05-native.css drops the CSS glass glassd replaces. In ack
// mode (opts.ackMode, or after the first ack()) an attribute is set only
// while the daemon acknowledges it as shown, and removed as soon as it no
// longer does: a layer while its id is in its window's ack list, a cover
// while its overlay key is in the ack map. Because ids name slots, an ack
// applies to an element only once it has held its id for ACK_DELAY_MS (a
// scene-graph round trip). Without ack mode they follow the report at once.
//
// Cost: nothing runs per frame while the UI is still. Mutations, transitions
// and animations that move things wake a sampling loop capped at ~30 Hz that
// runs while they last plus TAIL_MS. Element lists, styles and hit tests are
// cached between samples. A scroll only flattens the layers that move with
// that scroller (they are left out until it has been still for
// SCROLL_SETTLE_MS, so their crops never lag behind the live texture), and
// mutations inside a scrolling scroller wait for it to settle. A 2 s safety
// resample re-measures (every 10 s it also re-queries and re-hit-tests).
// While the theme is off it pauses. It stops itself when the daemon's pings
// stop; without pings (an older daemon), when the daemon's lgs-native
// heartbeat goes stale or the theme stays off for 30 s.
//
// Phase 2 (v3, docs/phase2/contracts/reporter.md): the rules may also be a
// list of fragments (theme/layers/NN-name.json, merged in name order, with
// "owns" and "supersedes"); main's cover follows the glass mode C1a sets as
// data-lgs-glass; [data-lgs-plate] elements are reported as plates and
// [data-lgs-mosaic] as mosaic bands; rules with admission on go through the
// depth plan's admission rules (PLAN 1.7: covered, click-safe cap snapped to
// {10, 15, 25} mm, not over media, not destructive, containers only, modal
// only, at most 4 depths) in the default or wearer profile; lifts key on
// .gpfocus in gamepad mode and .lgs-dwell:hover in laser mode (P3); acks may
// carry plates (data-lgs-plate-ack).
(function lgsLayersInstall() {
  'use strict';
  const W = window;
  const VERSION = 3;
  // The daemon's options are for this evaluation only: a later evaluation of
  // the bare file must not start with a binding nobody listens to.
  const OPTS = W.__LGS_LAYERS_OPTS;
  try { delete W.__LGS_LAYERS_OPTS; } catch (_) { W.__LGS_LAYERS_OPTS = undefined; }
  // tests install a second instance under another name (the daemon's stays)
  const GLOBAL = OPTS && typeof OPTS.global === 'string' && /^__LGS_LAYERS\w*$/.test(OPTS.global) ? OPTS.global : '__LGS_LAYERS';
  if (W[GLOBAL] && typeof W[GLOBAL].stop === 'function') {
    try { W[GLOBAL].stop({ silent: true, keepGlobal: true }); } catch (_) { /* stale instance */ }
  }

  const ATTR_PREFIX = 'data-lgs';
  const DEFAULT_FOCUS = '.gpfocus, .gpfocuswithin';
  const MATERIALS = ['window', 'panel', 'liquid', 'thick'];
  // Phase 2 (admission-on rules and plates)
  const SLAB_MATERIALS = ['window', 'panel', 'liquid', 'thick', 'clear', 'none'];
  const PLATE_MATERIALS = ['window', 'panel', 'liquid', 'thick', 'clear', 'dim'];
  const MODES = ['window', 'window-full', 'hero', 'windowless'];
  const ALLOWED_MM = [10, 15, 25];   // the depth set at rest (PLAN 1.7 rule 7; 0 = no pop)
  const CLICK_SAFE = 0.000521;       // units per CSS px of the smallest target (rule 2)
  const MIN_CONTAINER = 60;          // CSS px (rule 5)
  const MIN_CAPSULE_H = 44;          // CSS px (rule 5, capsules)
  const MIN_VISIBLE_TARGET = 8;      // CSS px of a focusable visible in the crop (rule 2)
  const MAX_PLATES = 32;             // per surface (glassd G1)
  const MAX_DEPTHS = 4;              // distinct dz at rest per surface, 0 included (rule 7)
  const COVER_TOL = 2;               // texture px (rule 1)
  const DEFAULT_S = 0.369;           // dashboard scale (SP 1.1) without P8's geometry
  const DEFAULT_FOCUSABLES = '.Focusable, button, [role="button"], a[href], input, select, textarea, '
    + '[tabindex]:not([tabindex="-1"]), .gpfocus, .gpfocuswithin';
  const TINTS = { green: 'rgb(48 209 88)', blue: 'rgb(10 132 255)' };
  const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
  const COLOR_RE = /^[#a-zA-Z0-9(),.%\s/-]{1,64}$/;
  const POLL_MS = 500;          // dashboard state, window list, liveness, stalled-frame watchdog
  const RESAMPLE_EVERY = 4;     // safety re-measure every N polls (2 s)
  const DEEP_EVERY = 5;         // every Nth resample also re-queries and re-hit-tests (10 s)
  const MIN_TICK_MS = 33;       // sampling cap (~30 Hz; sg pushes <= 30/s anyway)
  const TAIL_MS = 80;           // keep sampling this long after a sample changed something
  const SCROLL_SETTLE_MS = 150; // a scroller is still after this long without a scroll event
  const ANIM_MAX_MS = 1500;     // a running transition/animation counts at most this long
  const COVER_FOLLOW_MS = 150;  // an animating cover's shape is updated at most this often
  const ACK_DELAY_MS = 350;     // an element must hold its id this long before an ack applies to it (scene-graph latency)
  const COVER_FALLBACK_MS = 3000; // ack mode, key never acked but window lgs-native: tag the cover
  const PING_TTL_MS = 12000;    // no ping for this long (once pinged): stop
  const NATIVE_STALE_MS = 15000; // no lgs-native heartbeat for this long (never pinged): stop
  const THEME_OFF_POLLS = 60;   // never pinged: stop after the theme has been off this long (30 s)
  const MIN_PX = 4;            // texture px; smaller layers are dropped
  const MAX_LAYERS = 23;        // hard cap per surface
  // Hover alone never moves a layer; hover effects that do move one animate,
  // and those fire transition/animation events.
  const DOC_EVENTS = ['scroll', 'transitionrun', 'transitionend', 'transitioncancel',
    'animationstart', 'animationend', 'animationcancel', 'visibilitychange', 'focusin', 'focusout'];
  // Properties whose change never moves or resizes a box (camelCase is
  // converted first). Everything else (transform, scale, width, opacity,
  // border-radius, ...) counts as geometric.
  const PAINT_RE = /^(--|background|color$|(border|outline|column-rule|text-decoration|text-emphasis)(-[a-z]+)*-color$|outline|box-shadow|text-shadow|caret-color|accent-color|fill|stroke|filter$|(-?webkit-)?backdrop-filter$|-?webkit-text-(fill|stroke)-color|mask|-?webkit-mask|clip-path|stop-color|flood-color|lighting-color)/;
  const KF_META = new Set(['offset', 'easing', 'composite', 'computedOffset']);
  const NAV_HINTS = ['84114']; // webpack module with IsInGamepadNav in the current Steam build

  let S = null;               // running state; null while stopped
  let API = null;

  // ------------------------------------------------------------ rules

  function getIndex() {
    if (W.__LGS_INDEX && W.__LGS_INDEX.selector) return W.__LGS_INDEX;
    if (typeof lgsBuildIndex !== 'function') return null;
    return (W.__LGS_INDEX = lgsBuildIndex()); // eslint-disable-line no-undef
  }

  function resolveSel(sel, index, errs, where) {
    if (typeof sel !== 'string' || !sel.trim()) { errs.push(where + ': empty selector'); return null; }
    let bad = false;
    const out = sel.replace(/%\{([^}]+)\}/g, (_, tok) => {
      const r = index.selector(tok);
      if (r.sel) return r.sel;
      errs.push(where + ': %{' + tok.trim() + '} ' + r.err);
      bad = true;
      return '.lgs-' + r.err;
    });
    if (bad) return null;
    try { document.createDocumentFragment().querySelector(out); } catch (_) {
      errs.push(where + ': invalid selector ' + out.slice(0, 120));
      return null;
    }
    return out;
  }

  function pseudoOf(p) {
    if (!p) return null;
    const s = String(p).replace(/^:+/, '');
    return s === 'before' || s === 'after' ? '::' + s : null;
  }

  // inset [top, right, bottom, left] (CSS px, positive shrinks) minus outset
  function insetOf(inset, outset) {
    let a = [0, 0, 0, 0];
    if (Array.isArray(inset)) a = [0, 1, 2, 3].map((i) => +inset[i] || 0);
    else if (typeof inset === 'number') a = [inset, inset, inset, inset];
    const o = +outset || 0;
    a = a.map((v) => v - o);
    return a.some((v) => v !== 0) ? a : null;
  }

  function material(m, fallback) { return MATERIALS.includes(m) ? m : fallback; }

  // ------------------------------------------------------------ fragments

  // The configuration as a list of fragments: Phase 1's layers.json object
  // is one legacy fragment (admission off); a v2 fragment object is a list of
  // one; a list is taken as is (P8 passes theme/layers/*.json in name order).
  function fragmentsOf(cfg) {
    if (typeof cfg === 'string') cfg = JSON.parse(cfg);
    if (Array.isArray(cfg)) return cfg.filter((f) => f && typeof f === 'object');
    if (cfg && typeof cfg === 'object' && Array.isArray(cfg.fragments)) return cfg.fragments.filter((f) => f && typeof f === 'object');
    if (!cfg || typeof cfg !== 'object' || !cfg.surfaces) throw new Error('lgs_layers: rules need a "surfaces" object');
    if (+cfg.version >= 2) return [cfg];
    return [Object.assign({ file: 'layers.json', admission: false }, cfg)];
  }

  const SURFACE_FIELDS = ['key', 'keyPrefix', 'cover', 'material', 'modes', 'modal', 'frameKey', 'laserOnly',
    'docVisibility', 'maxLayers', 'coverMm', 'coverDz', 'space', 'enabled'];

  // Merge fragments in order: the first fragment that names a surface defines
  // it; a later one changes its fields only when it "owns" it. Rules are
  // appended; "supersedes" drops other fragments' rules by id.
  function mergeFragments(frags, errs) {
    const surfaces = new Map(); // name -> {def: {...fields}, defFile, maxDefault, rules: [{rc, frag}]}
    const sup = [];             // [{file, surface|null, id}]
    const fragInfo = [];
    frags.forEach((fr, fi) => {
      const file = String(fr.file || fr.name || 'fragment' + fi);
      const owns = Array.isArray(fr.owns) ? fr.owns.map(String) : [];
      const meta = {
        file,
        admission: fr.admission !== false,
        defaults: fr.defaults && typeof fr.defaults === 'object' ? fr.defaults : {},
      };
      fragInfo.push({ file, admission: meta.admission, owns, supersedes: Array.isArray(fr.supersedes) ? fr.supersedes.slice(0, 200) : [] });
      for (const id of Array.isArray(fr.supersedes) ? fr.supersedes : []) {
        // "main.footer" names one surface's rule; a bare id any surface's
        sup.push({ file, raw: String(id) });
      }
      const sfs = fr.surfaces && typeof fr.surfaces === 'object' ? fr.surfaces : {};
      for (const name of Object.keys(sfs)) {
        const sc = sfs[name];
        if (!sc || typeof sc !== 'object') { errs.push(file + ': surface ' + name + ' is not an object'); continue; }
        let ent = surfaces.get(name);
        if (!ent) {
          ent = { def: {}, defFile: file, maxDefault: +meta.defaults.maxLayers || 0, rules: [] };
          for (const k of SURFACE_FIELDS) if (sc[k] !== undefined) ent.def[k] = sc[k];
          surfaces.set(name, ent);
        } else {
          const set = SURFACE_FIELDS.filter((k) => sc[k] !== undefined);
          if (set.length) {
            if (owns.includes(name)) {
              for (const k of set) ent.def[k] = sc[k];
              if (+meta.defaults.maxLayers) ent.maxDefault = +meta.defaults.maxLayers;
            } else {
              errs.push(file + ': ' + name + '.' + set.join(', ') + ' ignored (defined by ' + ent.defFile + '; list "' + name + '" in "owns")');
            }
          }
        }
        if (Array.isArray(sc.layers)) for (const rc of sc.layers) ent.rules.push({ rc, frag: meta });
        else if (sc.layers !== undefined) errs.push(file + ': ' + name + '.layers is not a list');
      }
    });
    // supersedes: drop other fragments' rules by id ("id" or "surface.id")
    const dropped = [];
    for (const [name, ent] of surfaces) {
      ent.rules = ent.rules.filter(({ rc, frag }) => {
        const id = String(rc && rc.id || '');
        if (!id) return true;
        const hit = sup.find((x) => x.file !== frag.file && (x.raw === id || x.raw === name + '.' + id));
        if (hit) { dropped.push(name + '.' + id + ' (by ' + hit.file + ')'); return false; }
        return true;
      });
    }
    return { surfaces, dropped, fragments: fragInfo };
  }

  function mmOrUnits(mm, units) {
    if (mm !== undefined && mm !== null && mm !== '') {
      const v = +mm;
      return Number.isFinite(v) ? { mm: v } : null;
    }
    const u = +units || 0;
    return { units: u };
  }

  function colorOf(c) {
    if (c === undefined || c === null || c === '') return null;
    if (typeof c === 'string' && TINTS[c]) return TINTS[c];
    if (c === 'auto' || c === 'scrim') return c;
    if (Array.isArray(c) && c.length >= 3) {
      const v = c.map((x) => +x);
      if (v.some((x) => !Number.isFinite(x))) return null;
      return 'rgba(' + [0, 1, 2].map((i) => Math.round(Math.max(0, Math.min(1, v[i])) * 255)).join(', ') + ', ' + (v.length > 3 ? Math.max(0, Math.min(1, v[3])) : 1) + ')';
    }
    return typeof c === 'string' && COLOR_RE.test(c) ? c : null;
  }

  function holeOf(h, errs, where) {
    if (h === undefined || h === null || h === false) return null;
    if (h === true) return true;
    if (typeof h !== 'object') { errs.push(where + '.hole: true or an object'); return null; }
    const o = {};
    for (const k of ['shadow', 'y', 'blur']) if (Number.isFinite(+h[k]) && h[k] !== null && h[k] !== '') o[k] = +h[k];
    if (h.fill !== undefined) {
      const f = h.fill === 'scrim' ? 'rgba(0, 0, 0, 0.35)' : colorOf(h.fill);
      if (f) o.fill = f; else errs.push(where + '.hole.fill: not a colour');
    }
    return Object.keys(o).length ? o : true;
  }

  function compile(cfg) {
    const frags = fragmentsOf(cfg);
    const index = getIndex();
    if (!index) return null; // no token index yet (theme off): caller waits
    const errs = [];
    const merged = mergeFragments(frags, errs);
    const out = [];
    for (const [name, ent] of merged.surfaces) {
      const sc = ent.def;
      if (sc.enabled === false) continue;
      const s = {
        name,
        key: sc.key || null,
        keyPrefix: sc.keyPrefix || null,
        material: material(sc.material, 'window'),
        frameKey: sc.frameKey || null,
        laserOnly: !!sc.laserOnly,
        docVisibility: sc.docVisibility !== false,
        maxLayers: Math.max(0, Math.min(+sc.maxLayers || ent.maxDefault || 20, MAX_LAYERS)),
        space: sc.space === 'bar' || sc.space === 'main' ? sc.space : (sc.key === 'valve.steam.gamepadui.main' ? 'main' : 'bar'),
        cover: null,
        modes: null,
        modal: null,
        coverDz: null,
        rules: [],
      };
      if (!s.key && !s.keyPrefix) { errs.push(name + ': needs "key" or "keyPrefix"'); continue; }
      const c = sc.cover || {};
      const csel = resolveSel(c.sel, index, errs, name + '.cover');
      if (!csel) { errs.push(name + ': no usable cover, surface skipped'); continue; }
      s.cover = { sel: csel, pseudo: pseudoOf(c.pseudo), r: c.r, inset: insetOf(c.inset, c.outset), all: !!c.all };
      if (sc.modes && typeof sc.modes === 'object') {
        const m = sc.modes;
        const msel = m.sel ? resolveSel(m.sel, index, errs, name + '.modes.sel') : null;
        const shapes = {};
        for (const k of MODES) {
          const v = m[k];
          if (!v || typeof v !== 'object') continue;
          shapes[k] = v.cover === false ? { none: true } : { h: +v.h > 0 ? +v.h : null, r: Number.isFinite(+v.r) && v.r !== null ? +v.r : null };
        }
        s.modes = { attr: typeof m.attr === 'string' && /^data-[a-z0-9-]+$/.test(m.attr) ? m.attr : 'data-lgs-glass', sel: msel, shapes };
      }
      if (sc.modal) s.modal = resolveSel(sc.modal, index, errs, name + '.modal');
      if (sc.coverMm !== undefined || sc.coverDz !== undefined) s.coverDz = mmOrUnits(sc.coverMm, sc.coverDz);
      const ids = new Set();
      ent.rules.forEach(({ rc, frag }, i) => {
        if (!rc || typeof rc !== 'object') return;
        const id = String(rc.id || 'layer' + i);
        const where = name + '.' + id;
        if (ids.has(id)) { errs.push(where + ': duplicate id (' + frag.file + '), skipped'); return; }
        ids.add(id);
        const sel = resolveSel(rc.sel, index, errs, where);
        if (!sel) return;
        const adm = frag.admission && rc.admission !== false;
        let focus = null;
        if (rc.focus !== 'always') {
          focus = rc.focus ? resolveSel(rc.focus, index, errs, where + '.focus') : DEFAULT_FOCUS;
          if (!focus) return;
        }
        const fdef = frag.defaults || {};
        const base = {
          id, sel, focus,
          pseudo: pseudoOf(rc.pseudo),
          part: pseudoOf(rc.pseudo) ? pseudoOf(rc.pseudo).slice(2) : 'self',
          r: rc.r,
          inset: insetOf(rc.inset, rc.outset),
          max: Math.max(1, Math.floor(+rc.max || 1)),
          hitTest: rc.hitTest !== false,
          clip: rc.clip !== false,
          admission: adm,
          file: frag.file,
        };
        if (!adm) {
          // Phase 1 semantics, unchanged (99-legacy.json, layers.json)
          const dz = +rc.dz || 0;
          const lift = +rc.lift || 0;
          if (!(dz > 0) && !(lift > 0)) { errs.push(where + ': needs dz or lift > 0'); return; }
          s.rules.push(Object.assign(base, {
            dz, lift,
            material: material(rc.material, material(fdef.material, 'liquid')),
          }));
          return;
        }
        // Phase 2 rule
        const slab = rc.slab !== undefined ? rc.slab : rc.material;
        const r = Object.assign(base, {
          depth: mmOrUnits(rc.mm, rc.dz),
          lift: mmOrUnits(rc.liftMm, rc.lift),
          when: rc.when === 'attended' ? 'attended' : 'always',
          interactive: rc.interactive === true,
          profile: rc.profile === 'default' || rc.profile === 'wearer' ? rc.profile : null,
          wearer: null,
          modal: rc.modal === true,
          hole: holeOf(rc.hole, errs, where),
          tint: rc.tint !== undefined ? colorOf(rc.tint) : null,
          material: SLAB_MATERIALS.includes(slab) ? slab : (SLAB_MATERIALS.includes(fdef.material) ? fdef.material : 'liquid'),
          exclude: rc.exclude ? resolveSel(rc.exclude, index, errs, where + '.exclude') : null,
          media: rc.media === 'allow',
          flag: typeof rc.flag === 'string' && rc.flag ? rc.flag : null,
          from: rc.from === 'cut' ? 'cut' : (rc.fromMm !== undefined ? mmOrUnits(rc.fromMm, null) : (Number.isFinite(+rc.from) && rc.from !== null && rc.from !== '' ? { units: +rc.from } : null)),
          sink: rc.sink === false ? false : null,
          focusables: null,
        });
        if (rc.exclude && !r.exclude) return;
        if (rc.tint !== undefined && !r.tint) errs.push(where + '.tint: not a colour');
        const fsel = rc.focusables || fdef.focusables;
        r.focusables = fsel ? resolveSel(fsel, index, errs, where + '.focusables') : null;
        if (rc.wearer && typeof rc.wearer === 'object') {
          const w = rc.wearer;
          r.wearer = {
            depth: w.mm !== undefined || w.dz !== undefined ? mmOrUnits(w.mm, w.dz) : null,
            lift: w.liftMm !== undefined || w.lift !== undefined ? mmOrUnits(w.liftMm, w.lift) : null,
            when: w.when === 'attended' || w.when === 'always' ? w.when : null,
            interactive: typeof w.interactive === 'boolean' ? w.interactive : null,
          };
        }
        const d = r.depth;
        const l = r.lift;
        const pos = (v) => v && ((v.mm !== undefined && v.mm > 0) || (v.units !== undefined && v.units > 0));
        if (!pos(d) && !pos(l) && !(r.wearer && (pos(r.wearer.depth) || pos(r.wearer.lift)))) {
          errs.push(where + ': needs mm, dz, liftMm or lift > 0'); return;
        }
        if (d && d.mm !== undefined && d.mm > 0 && !ALLOWED_MM.includes(d.mm)) {
          errs.push(where + ': mm ' + d.mm + ' is not in {' + ALLOWED_MM.join(', ') + '}; it snaps down');
        }
        s.rules.push(r);
      });
      s.hasAdmission = s.rules.some((r) => r.admission);
      out.push(s);
    }
    return { surfaces: out, errors: errs, fragments: merged.fragments, superseded: merged.dropped };
  }

  // ------------------------------------------------------------ Steam state

  let reqCache = null;
  function webpackReq() {
    if (reqCache) return reqCache;
    try { W.webpackChunksteamui.push([[Symbol('lgs-layers')], {}, (r) => { reqCache = r; }]); } catch (_) { /* no bundle */ }
    return reqCache;
  }

  // The controller-vs-laser mode Steam tracks for SteamVR overlay focus
  // (IsInGamepadNav), located by source text so module ids may move. Only a
  // laserOnly surface asks for it. The known id is tried first; otherwise the
  // search reads every module's source, in slices between frames (one huge
  // module still costs ~45 ms once). The id is kept on window for later
  // injections.
  function navExport(mod) {
    for (const k of Object.keys(mod || {})) {
      try {
        const C = mod[k];
        if (C && C.Instance && 'IsInGamepadNav' in C.Instance) return C;
      } catch (_) { /* getter threw */ }
    }
    return null;
  }

  function navClass() {
    const n = S.nav;
    if (n.C) return n.C;
    if (n.state !== 'idle') return null;
    const req = webpackReq();
    if (!req) { n.state = 'no webpack'; return null; }
    // the id an earlier injection found is loaded already: use it as is
    const cached = W.__LGS_LAYERS_NAVMOD;
    if (cached != null && req.m[cached]) {
      try { n.C = navExport(req(cached)); } catch (_) { /* moved */ }
      if (n.C) { n.state = 'found'; n.id = cached; return n.C; }
    }
    // Otherwise read module sources, the current build's id first, between
    // frames and never inside a sample. One module's source can take ~45 ms
    // to read the first time, so this happens once per Steam session.
    n.state = 'searching';
    const hints = NAV_HINTS.filter((id) => req.m[id]);
    n.ids = hints.concat(Object.keys(req.m).filter((id) => !hints.includes(id)));
    n.i = 0;
    navLater();
    return null;
  }

  function navLater() {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(navStep, { timeout: 1000 });
    else setTimeout(navStep, 16);
  }

  function navStep() {
    if (!S || S.nav.state !== 'searching') return;
    const n = S.nav;
    const req = webpackReq();
    const a = performance.now();
    while (n.i < n.ids.length && performance.now() - a < 3) {
      const id = n.ids[n.i++];
      let src;
      try { src = req.m[id].toString(); } catch (_) { continue; }
      if (src.indexOf('get IsInGamepadNav') < 0) continue;
      let C = null;
      try { C = navExport(req(id)); } catch (_) { /* not loadable */ }
      if (!C) continue;
      n.C = C;
      n.id = id;
      n.state = 'found';
      W.__LGS_LAYERS_NAVMOD = id;
      n.ms += performance.now() - a;
      for (const e of S.ents.values()) if (e.s.laserOnly) e.force = true;
      schedule(0);
      return;
    }
    n.ms += performance.now() - a;
    if (n.i >= n.ids.length) { n.state = 'not found'; n.ids = null; return; }
    navLater();
  }

  // true = controller nav, false = laser, null = unknown (or still searching)
  function gamepadNav() {
    const C = navClass();
    if (!C) return null;
    try { return C.Instance ? !!C.Instance.IsInGamepadNav : null; } catch (_) { return null; }
  }

  // Is the dashboard frame that shows this overlay visible? (A dashboard tab
  // for another app hides Steam's window.) Unknown layouts don't block.
  function frameVisible(key) {
    try {
      const frames = SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.VRFrameStore.frames;
      let found = false;
      for (const f of frames) {
        const keys = Object.values(f.steamUIVROverlayKeysInPages || {});
        if (!keys.includes(key)) continue;
        found = true;
        if (f.isVisible) return true;
      }
      return !found;
    } catch (_) { return true; }
  }

  function refreshDash() {
    if (S.dashForced !== null) { setDash(S.dashForced); return; }
    let api = null;
    try { api = SteamClient.OpenVR.VROverlay; } catch (_) { /* not in VR */ }
    if (!api || typeof api.IsDashboardVisible !== 'function') { setDash(true); return; }
    if (S.dashPending) return;
    S.dashPending = true;
    const me = S;
    Promise.resolve().then(() => api.IsDashboardVisible()).then((v) => {
      me.dashPending = false;
      if (S === me) setDash(v !== false);
    }, () => { me.dashPending = false; });
  }

  // Hidden: measure nothing and keep reporting the last layout (and keep the
  // attributes), so opening the dashboard shows the glass that was there.
  function setDash(v) {
    if (S.dash === v) return;
    S.dash = v;
    S.dashChanges++;
    if (v) {
      for (const e of S.ents.values()) e.force = true;
      schedule(0);
    } else {
      cancelFrame();
    }
    if (S.lastBody !== null) emit(false, true);
  }

  // ------------------------------------------------------------ windows

  function popupList() {
    const out = [];
    let map;
    try { map = g_PopupManager.m_mapPopups; } catch (_) { return out; }
    if (!map) return out;
    for (const p of map.values()) {
      let win = null;
      try {
        win = p.window;
        if (!win || win.closed || !win.document || !win.document.documentElement) continue;
      } catch (_) { continue; }
      let key = '';
      try { key = (p.params && p.params.strVROverlayKey) || ''; } catch (_) { /* no params */ }
      if (!key) key = keyFromName(p.m_strName || '');
      if (key) out.push({ win, key });
    }
    return out;
  }

  // Fallback when a popup has no params: "valve.steam.gamepadui.bar.70880000_uid0"
  // -> "valve.steam.gamepadui.bar", "...barpopup.70880001.70880001_uid0" ->
  // "...barpopup.70880001".
  function keyFromName(n) {
    if (/^VR_uid/.test(n)) return 'valve.steam.gamepadui.main';
    if (/^VRKeyboard_uid/.test(n)) return 'valve.steam.gamepadui.keyboard';
    if (/^VRNotificationToasts_uid/.test(n)) return 'valve.steam.gamepadui.notifications';
    return n.replace(/_uid\d+$/, '').replace(/\.\d+$/, '');
  }

  function surfaceFor(key) {
    for (const s of S.cfg.surfaces) {
      if (s.key && key === s.key) return { s, name: s.name };
      if (s.keyPrefix && key.startsWith(s.keyPrefix) && key.length > s.keyPrefix.length) {
        return { s, name: s.name + '.' + key.slice(s.keyPrefix.length) };
      }
    }
    return null;
  }

  function activeScrollers(ent, now) {
    const act = [];
    for (const [sc, t] of ent.scrolling) if (now - t < SCROLL_SETTLE_MS) act.push(sc);
    return act;
  }

  function isScrolling(ent, sc, now) {
    const t = ent.scrolling.get(sc);
    return t !== undefined && now - t < SCROLL_SETTLE_MS;
  }

  // attributes whose changes we measure again for (never our own outputs)
  const INPUT_ATTRS = ['class', 'style', 'hidden', 'open', 'data-lgs-plate', 'data-lgs-plate-id',
    'data-lgs-plate-phase', 'data-lgs-plate-appear', 'data-lgs-plate-tint', 'data-lgs-plate-fill',
    'data-lgs-plate-occluder', 'data-lgs-plate-r', 'data-lgs-plate-inset', 'data-lgs-mosaic', 'data-lgs-nopop',
    'data-lgs-destructive', 'data-lgs-media', 'data-lgs-window-dim', 'data-lgs-window-recede'];
  const SPOT_RE = /--h[xy]\s*:[^;]*;?/g;

  function spotOnly(r) {
    if (r.type !== 'attributes' || r.attributeName !== 'style') return false;
    let now = '';
    try { now = r.target.getAttribute('style') || ''; } catch (_) { return false; }
    return now.replace(SPOT_RE, '').trim() === (r.oldValue || '').replace(SPOT_RE, '').trim();
  }

  function isPaintProp(p) {
    if (!p || p === 'all') return false;
    const k = p.startsWith('--') ? p : p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    return PAINT_RE.test(k);
  }

  // Does this CSS animation move or resize anything? Read once per name from
  // its keyframes (an animation on ::before/::after is only listed with the
  // host's subtree).
  function animGeometric(T, name, pseudo) {
    if (!name) return true;
    const c = S.animGeo.get(name);
    if (c !== undefined) return c;
    let geo = null;
    try {
      for (const a of T.getAnimations(pseudo ? { subtree: true } : undefined)) {
        if (a.animationName !== name || !a.effect || typeof a.effect.getKeyframes !== 'function') continue;
        const props = new Set();
        for (const kf of a.effect.getKeyframes()) for (const k of Object.keys(kf)) if (!KF_META.has(k)) props.add(k);
        geo = [...props].some((p) => !isPaintProp(p));
        break;
      }
    } catch (_) { /* detached */ }
    if (geo === null) return true; // already gone: assume it moved something
    S.animGeo.set(name, geo);
    return geo;
  }

  function attach(s, name, key, win) {
    const doc = win.document;
    const ent = {
      s, name, key, win, doc,
      mo: null, listeners: [], handler: null,
      force: true, dirty: true, needLight: false, deferred: false,
      domGen: 0, hitGen: 0, animGen: 0, q: null, facts: new WeakMap(),
      csw: new WeakMap(), psw: new WeakMap(), hit: new WeakMap(), settled: new WeakMap(),
      scrolling: new Map(), anims: new Map(), panims: new Map(),
      tailUntil: 0, full: null, cur: null, sig: null, lastIds: null,
      attrPop: S.attrPrefix + '-pop', attrCover: S.attrPrefix + '-cover', attrPlate: S.attrPrefix + '-plate-ack',
      applied: new Map(), hold: new Map(), keyAcked: false, nativeSince: 0,
      wakes: {}, computes: 0, computeMs: 0, lights: 0, changes: 0, queries: 0, hitTests: 0,
    };
    const bump = (t) => { ent.wakes[t] = (ent.wakes[t] || 0) + 1; };
    const wakeUp = () => { if (S && S.dash && !S.paused) schedule(0); };
    const handler = (ev) => {
      if (!S) return;
      const t = ev.type;
      const now = performance.now();
      if (t === 'scroll') {
        let sc = ev.target;
        if (!sc || sc.nodeType !== 1) sc = doc.scrollingElement || doc.documentElement;
        const was = isScrolling(ent, sc, now);
        ent.scrolling.set(sc, now);
        armSettle();
        if (!was) {
          bump('scroll');
          // flatten the layers that move with this scroller right away
          if (ent.cur && ent.cur.kept.some((k) => k.scrollers.includes(sc))) { ent.needLight = true; wakeUp(); }
        }
        return;
      }
      if (t === 'resize') { bump(t); ent.domGen++; ent.hitGen++; ent.dirty = true; wakeUp(); return; }
      if (t === 'visibilitychange') { bump(t); ent.dirty = true; refreshDash(); wakeUp(); return; }
      if (t === 'focusin' || t === 'focusout') {
        // focus following a scroll inside the scroller waits for the settle
        const T = ev.target;
        if (T && T.nodeType === 1 && ent.scrolling.size && activeScrollers(ent, now).some((sc) => sc.contains(T))) {
          ent.deferred = true;
          bump('focus-deferred');
          return;
        }
        bump('focus');
        ent.domGen++;
        ent.dirty = true;
        wakeUp();
        return;
      }
      // transitions and animations
      const T = ev.target;
      if (!T || T.nodeType !== 1) return;
      ent.animGen++; // cached style facts may be stale now
      const pseudo = ev.pseudoElement ? String(ev.pseudoElement).replace(/^:+/, '') : '';
      const geo = t.startsWith('transition') ? !isPaintProp(ev.propertyName) : animGeometric(T, ev.animationName, pseudo);
      if (!geo) { bump('paint-anim'); return; }
      const start = t === 'transitionrun' || t === 'animationstart';
      // a ::before/::after animation moves only that pseudo-element
      const map = pseudo ? ent.panims : ent.anims;
      const key = pseudo ? pseudoKey(T, pseudo) : T;
      const rec = map.get(key);
      // content moving inside a scrolling scroller (virtualized rows fading
      // in and out): the settle handles it
      if (!(rec && !start) && ent.scrolling.size && activeScrollers(ent, now).some((sc) => sc.contains(T))) {
        bump('scrolled-anim');
        return;
      }
      if (start) {
        const r = rec || { n: 0, until: 0, el: T, part: pseudo };
        r.n++;
        r.until = now + ANIM_MAX_MS;
        map.set(key, r);
      } else {
        if (rec && --rec.n <= 0) map.delete(key);
        // something outside the measured elements stopped moving (a side
        // menu slid in?): re-check what covers what
        if (!pseudo && !insideMeasured(ent, T)) ent.hitGen++;
      }
      bump(t);
      ent.dirty = true;
      wakeUp();
    };
    ent.handler = handler;
    try {
      ent.mo = new win.MutationObserver((all) => {
        if (!S) return;
        // P3's light spot rewrites --hx/--hy inline on every pointer move:
        // that alone never moves anything
        const records = all.filter((r) => !spotOnly(r));
        if (!records.length) { bump('spot'); return; }
        // mutations inside a scrolling scroller (virtualized rows) wait for it
        if (ent.scrolling.size) {
          const act = activeScrollers(ent, performance.now());
          if (act.length && records.every((r) => act.some((sc) => sc.contains(r.target)))) {
            ent.deferred = true;
            bump('mutation-deferred');
            return;
          }
        }
        bump('mutation');
        ent.domGen++;
        ent.dirty = true;
        wakeUp();
      });
      ent.mo.observe(doc.documentElement, {
        subtree: true, childList: true, characterData: true,
        attributes: true, attributeOldValue: true,
        attributeFilter: INPUT_ATTRS.concat(s.modes ? [s.modes.attr] : []),
      });
    } catch (_) { /* window closing */ }
    const add = (target, type) => {
      try {
        target.addEventListener(type, handler, { capture: true, passive: true });
        ent.listeners.push([target, type]);
      } catch (_) { /* window closing */ }
    };
    for (const t of DOC_EVENTS) add(doc, t);
    add(win, 'resize');
    return ent;
  }

  function detach(ent) {
    try { if (ent.mo) ent.mo.disconnect(); } catch (_) { /* gone */ }
    for (const [target, type] of ent.listeners) {
      try { target.removeEventListener(type, ent.handler, { capture: true }); } catch (_) { /* gone */ }
    }
    ent.listeners = [];
    applyAttrs(ent, new Map());
  }

  function syncWindows() {
    const seen = new Set();
    let changed = false;
    for (const { win, key } of popupList()) {
      const m = surfaceFor(key);
      if (!m) continue;
      seen.add(key);
      let ent = S.ents.get(key);
      let stale = false;
      try { stale = !!ent && (ent.win !== win || ent.doc !== win.document); } catch (_) { stale = true; }
      if (stale) { detach(ent); ent = null; }
      if (!ent) {
        ent = attach(m.s, m.name, key, win);
        S.ents.set(key, ent);
        changed = true;
      }
    }
    for (const [key, ent] of S.ents) {
      if (seen.has(key)) continue;
      detach(ent);
      S.ents.delete(key);
      changed = true;
    }
    if (changed) S.structureChanged = true;
  }

  // ------------------------------------------------------------ geometry

  // computed styles are live objects: cached per element across samples
  function cs(ent, el) {
    let v = ent.csw.get(el);
    if (!v) { v = ent.win.getComputedStyle(el); ent.csw.set(el, v); }
    return v;
  }

  function pcs(ent, el, pseudo) {
    let m = ent.psw.get(el);
    if (!m) ent.psw.set(el, m = {});
    return m[pseudo] || (m[pseudo] = ent.win.getComputedStyle(el, pseudo));
  }

  // does this style make the element a containing block for fixed (and so
  // also absolute) descendants?
  function fixedCB(s) {
    if (s.transform !== 'none' || s.perspective !== 'none' || s.filter !== 'none') return true;
    if ((s.scale && s.scale !== 'none') || (s.translate && s.translate !== 'none') || (s.rotate && s.rotate !== 'none')) return true;
    if (s.transformStyle === 'preserve-3d') return true;
    if (s.backdropFilter && s.backdropFilter !== 'none') return true;
    if (/transform|perspective|filter|scale|translate|rotate/.test(s.willChange)) return true;
    if (/paint|layout|strict|content/.test(s.contain)) return true;
    if (s.containerType && s.containerType !== 'normal') return true;
    return s.contentVisibility === 'auto';
  }

  // The style facts the walks need, read once per element and kept until
  // the DOM changes (domGen) or an animation starts or ends (animGen):
  // candidates share most of their ancestors.
  function facts(ent, el) {
    let f = ent.facts.get(el);
    if (f && f.dg === ent.domGen && f.ag === ent.animGen) return f;
    const s = cs(ent, el);
    const ovx = s.overflowX;
    const ovy = s.overflowY;
    const paint = /paint|strict|content/.test(s.contain);
    const fix = fixedCB(s);
    f = {
      dg: ent.domGen, ag: ent.animGen,
      position: s.position, opacity: parseFloat(s.opacity),
      cbFixed: fix, cbAbs: fix || s.position !== 'static',
      clipX: paint || ovx !== 'visible', clipY: paint || ovy !== 'visible',
      scroller: (ovx !== 'visible' && ovx !== 'clip') || (ovy !== 'visible' && ovy !== 'clip'),
    };
    ent.facts.set(el, f);
    return f;
  }

  // The box of an absolutely positioned ::before/::after, from its resolved
  // (used) offsets and size, in viewport CSS px.
  function pseudoBox(ctx, el, ps) {
    const pos = ps.position;
    if (pos !== 'absolute' && pos !== 'fixed') return null;
    let w = parseFloat(ps.width);
    let h = parseFloat(ps.height);
    if (!(w >= 0) || !(h >= 0)) return null;
    if (ps.boxSizing !== 'border-box') {
      w += (parseFloat(ps.paddingLeft) || 0) + (parseFloat(ps.paddingRight) || 0)
        + (parseFloat(ps.borderLeftWidth) || 0) + (parseFloat(ps.borderRightWidth) || 0);
      h += (parseFloat(ps.paddingTop) || 0) + (parseFloat(ps.paddingBottom) || 0)
        + (parseFloat(ps.borderTopWidth) || 0) + (parseFloat(ps.borderBottomWidth) || 0);
    }
    let cb = el;
    while (cb && cb.nodeType === 1) {
      const f = facts(ctx.ent, cb);
      if (pos === 'fixed' ? f.cbFixed : f.cbAbs) break;
      cb = cb.parentElement;
    }
    let ox = 0;
    let oy = 0;
    let cw = ctx.vw;
    let ch = ctx.vh;
    if (cb && cb.nodeType === 1) {
      const R = cb.getBoundingClientRect();
      ox = R.left + cb.clientLeft - cb.scrollLeft;
      oy = R.top + cb.clientTop - cb.scrollTop;
      cw = cb.clientWidth;
      ch = cb.clientHeight;
    }
    const ml = parseFloat(ps.marginLeft) || 0;
    const mt = parseFloat(ps.marginTop) || 0;
    let left = parseFloat(ps.left);
    let top = parseFloat(ps.top);
    if (isNaN(left)) {
      const right = parseFloat(ps.right);
      if (isNaN(right)) return null;
      left = cw - right - w - (parseFloat(ps.marginRight) || 0) - ml;
    }
    if (isNaN(top)) {
      const bottom = parseFloat(ps.bottom);
      if (isNaN(bottom)) return null;
      top = ch - bottom - h - (parseFloat(ps.marginBottom) || 0) - mt;
    }
    const l = ox + left + ml;
    const t = oy + top + mt;
    return { l, t, r: l + w, b: t + h };
  }

  // Walk the containing-block chain: clip by every overflow ancestor on it
  // (an absolute element escapes overflow:hidden below its containing block)
  // and collect them as the scrollers the box moves with.
  function clipChain(ctx, a, pos, c, clip, scrollers) {
    for (; a && a.nodeType === 1; a = a.parentElement) {
      const f = facts(ctx.ent, a);
      if (pos === 'absolute' && !f.cbAbs) continue;
      if (pos === 'fixed' && !f.cbFixed) continue;
      if (f.scroller) scrollers.push(a);
      if (clip && c && (f.clipX || f.clipY)) {
        const R = a.getBoundingClientRect();
        if (f.clipX) { c.l = Math.max(c.l, R.left); c.r = Math.min(c.r, R.right); }
        if (f.clipY) { c.t = Math.max(c.t, R.top); c.b = Math.min(c.b, R.bottom); }
        if (c.r - c.l < 1 || c.b - c.t < 1) c = null;
      }
      pos = f.position;
    }
    return c;
  }

  // Is the element hidden under something else (a modal scrim, a sheet)?
  // Hit-tests the centre of its visible box; landing on the element, inside
  // it or on one of its ancestors counts as visible. Cached per element until
  // its box moves or something may have started covering it (hitGen).
  function covered(ctx, el, c) {
    const ent = ctx.ent;
    const x = (c.l + c.r) / 2;
    const y = (c.t + c.b) / 2;
    const key = Math.round(x) + ',' + Math.round(y);
    const prev = ent.hit.get(el);
    if (prev && prev.key === key && prev.gen === ent.hitGen) return prev.covered;
    let hit = null;
    const a = performance.now();
    if (x >= 0 && y >= 0 && x < ctx.vw && y < ctx.vh) {
      try { hit = ctx.doc.elementFromPoint(x, y); } catch (_) { /* detached */ }
    }
    S.prof.hitMs += performance.now() - a;
    ent.hitTests++;
    const res = !!hit && !(hit === el || el.contains(hit) || hit.contains(el));
    ent.hit.set(el, { key, gen: ent.hitGen, covered: res });
    return res;
  }

  // Visible, clipped box of an element (or its pseudo-element) in CSS px,
  // with its corner radius and the scrollers it moves with; or {skip: reason}.
  function measure(ctx, el, spec, hitTest, clip) {
    if (!el.isConnected) return { skip: 'detached' };
    const ent = ctx.ent;
    const ecs = cs(ent, el);
    if (ecs.display === 'none') return { skip: 'display none' };
    if (ecs.visibility !== 'visible') return { skip: 'visibility ' + ecs.visibility };
    let box;
    let rad;
    let pos = ecs.position;
    let first = el.parentElement;
    if (spec.pseudo) {
      const ps = pcs(ent, el, spec.pseudo);
      if (!ps || ps.content === 'none' || ps.content === 'normal' || ps.display === 'none') return { skip: 'no ' + spec.pseudo };
      if (ps.visibility !== 'visible' || parseFloat(ps.opacity) < 0.05) return { skip: spec.pseudo + ' invisible' };
      box = pseudoBox(ctx, el, ps);
      if (!box) return { skip: spec.pseudo + ' not absolutely positioned' };
      rad = parseFloat(ps.borderTopLeftRadius) || 0;
      pos = ps.position;
      first = el; // the host is the pseudo's parent
    } else {
      const R = el.getBoundingClientRect();
      box = { l: R.left, t: R.top, r: R.right, b: R.bottom };
      rad = parseFloat(ecs.borderTopLeftRadius) || 0;
    }
    if (spec.inset) {
      box.t += spec.inset[0];
      box.r -= spec.inset[1];
      box.b -= spec.inset[2];
      box.l += spec.inset[3];
      rad = Math.max(0, rad - spec.inset[0]);
    }
    const w = box.r - box.l;
    const h = box.b - box.t;
    if (!(w > 1 && h > 1)) return { skip: 'zero size' };
    if (spec.r === 'capsule') rad = Math.min(w, h) / 2;
    else if (typeof spec.r === 'number') rad = spec.r;
    rad = Math.min(rad, w / 2, h / 2);
    let op = parseFloat(ecs.opacity);
    for (let a = el.parentElement; a && a.nodeType === 1 && op >= 0.05; a = a.parentElement) op *= facts(ent, a).opacity;
    if (op < 0.05) return { skip: 'transparent (opacity ' + op.toFixed(2) + ')' };
    let c = { l: Math.max(0, box.l), t: Math.max(0, box.t), r: Math.min(ctx.vw, box.r), b: Math.min(ctx.vh, box.b) };
    if (c.r - c.l < 1 || c.b - c.t < 1) return { skip: 'offscreen' };
    const scrollers = [];
    c = clipChain(ctx, first, pos, c, clip, scrollers);
    if (!c) return { skip: 'clipped away' };
    if (hitTest && covered(ctx, el, c)) return { skip: 'covered' };
    return { l: c.l, t: c.t, r: c.r, b: c.b, rad, scrollers };
  }

  function toTex(b, ctx) {
    const d = ctx.dpr;
    const cl = (v, m) => Math.max(0, Math.min(m, v));
    const x0 = cl(Math.round(b.l * d), ctx.texW);
    const y0 = cl(Math.round(b.t * d), ctx.texH);
    const x1 = cl(Math.round(b.r * d), ctx.texW);
    const y1 = cl(Math.round(b.b * d), ctx.texH);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < MIN_PX || h < MIN_PX) return null;
    return { x: x0, y: y0, w, h, r: Math.round(Math.min(b.rad * d, w / 2, h / 2)) };
  }

  function intersectTex(t, c) {
    const x0 = Math.max(t.x, c.x);
    const y0 = Math.max(t.y, c.y);
    const x1 = Math.min(t.x + t.w, c.x + c.w);
    const y1 = Math.min(t.y + t.h, c.y + c.h);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < MIN_PX || h < MIN_PX) return null;
    return { x: x0, y: y0, w, h, r: Math.min(t.r, Math.floor(w / 2), Math.floor(h / 2)) };
  }

  // the cover shape under the centre of t
  function shapeAt(shapes, t) {
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    for (const s of shapes) if (cx >= s.x && cx < s.x + s.w && cy >= s.y && cy < s.y + s.h) return s;
    return null;
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // pseudo-element animations are keyed per host and part
  const pkeys = new WeakMap();
  function pseudoKey(T, part) {
    let m = pkeys.get(T);
    if (!m) pkeys.set(T, m = {});
    return m[part] || (m[part] = { T, part });
  }

  // is T one of the measured elements (a cover or a rule match) or inside one?
  function insideMeasured(ent, T) {
    const q = ent.q;
    if (!q) return false;
    for (const el of q.cover) if (el.contains(T)) return true;
    for (const els of q.rules.values()) for (const el of els) if (el.contains(T)) return true;
    return false;
  }

  // Is a geometric transition or animation running on el (or, for a
  // ::before/::after part, on that pseudo-element) or an ancestor? Its events
  // arrive a frame after the style change that starts it, so el's own
  // running animations are asked for too (a just-focused card).
  function animating(ent, el, now, part) {
    for (const [T, rec] of ent.anims) {
      if (now > rec.until || !T.isConnected) { ent.anims.delete(T); continue; }
      if (T === el || T.contains(el)) return true;
    }
    if (part && part !== 'self' && part !== 'cover' && part !== 'plate' && ent.panims.size) {
      const rec = ent.panims.get(pseudoKey(el, part));
      if (rec) {
        if (now <= rec.until && el.isConnected) return true;
        ent.panims.delete(pseudoKey(el, part));
      }
    }
    let list = [];
    try { list = el.getAnimations(); } catch (_) { /* detached */ }
    for (const a of list) {
      if (a.playState !== 'running') continue;
      const geo = a.transitionProperty !== undefined ? !isPaintProp(a.transitionProperty)
        : a.animationName !== undefined ? animGeometric(el, a.animationName) : true;
      if (!geo) continue;
      return true; // its events follow (the 2 s resample if they never come)
    }
    return false;
  }

  // Does a tracked animation touch anything this window measures (a cover or
  // a rule match, or one of their ancestors)? Others (a row fading, a
  // spinner) do not keep the sampling loop running.
  function animsRelevant(ent, now) {
    if (!ent.anims.size && !ent.panims.size) return false;
    const q = ent.q;
    if (!q || q.gen !== ent.domGen) return true;
    for (const [T, rec] of ent.anims) {
      if (now > rec.until || !T.isConnected) { ent.anims.delete(T); continue; }
      for (const el of q.cover) if (T === el || T.contains(el)) return true;
      for (const els of q.rules.values()) for (const el of els) if (T === el || T.contains(el)) return true;
    }
    for (const [k, rec] of ent.panims) {
      if (now > rec.until || !rec.el.isConnected) { ent.panims.delete(k); continue; }
      for (const [rule, els] of q.rules) if (rule.part === rec.part && els.includes(rec.el)) return true;
    }
    return false;
  }

  function describe(el) {
    let idx = null;
    try { idx = getIndex(); } catch (_) { /* none */ }
    const cls = [];
    for (const c of el.classList) {
      if (cls.length >= 3) break;
      const t = idx && idx.byHash && idx.byHash.has(c) ? idx.tokenFor(c) : null;
      cls.push(t ? '%{' + t + '}' : c);
    }
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls.length ? ' ' + cls.join(' ') : '');
  }

  // ------------------------------------------------------------ runtime inputs (P1, P3, P8)

  function rtObj() { try { return W.__LGS_RT || null; } catch (_) { return null; } }

  // a runtime flag (opts.flags for tests, else P1's rt.flags)
  function flagOn(name) {
    if (S && S.optFlags && Object.prototype.hasOwnProperty.call(S.optFlags, name)) return !!S.optFlags[name];
    const rt = rtObj();
    try {
      if (rt && rt.flags && typeof rt.flags.enabled === 'function') return !!rt.flags.enabled(name);
    } catch (_) { /* no flags */ }
    return false;
  }

  // wearer only while interactivePops is on (PLAN 1.7, S2)
  function profileNow() {
    if (S.optProfile) return S.optProfile;
    return flagOn('interactivePops') ? 'wearer' : 'default';
  }

  // S and r for mm -> units (P8 publishes them as the bridge value "geom")
  function geomNow() {
    if (S.optGeom) return S.optGeom;
    const rt = rtObj();
    let g = null;
    try { if (rt && rt.bridge && typeof rt.bridge.get === 'function') g = rt.bridge.get('geom'); } catch (_) { /* none */ }
    if (g && +g.S > 0) return { S: +g.S, r: +g.r > 0 ? +g.r : 1, src: 'bridge' };
    return { S: DEFAULT_S, r: 1, src: 'default' };
  }

  // {mm} or {units} -> scene units for this surface
  function unitsOf(v, ctx) {
    if (!v) return 0;
    if (v.units !== undefined) return +v.units || 0;
    const g = ctx.geom;
    const per = ctx.ent.s.space === 'main' ? g.S * g.r : g.S;
    return (+v.mm || 0) / (1000 * per);
  }

  function r4(v) { return Math.round(v * 10000) / 10000; }

  // the largest allowed depth (PLAN 1.7 set) not above v; 0 when none
  function snapDown(v, ctx) {
    let best = 0;
    for (const mm of ALLOWED_MM) {
      const u = unitsOf({ mm }, ctx);
      if (u <= v + 1e-6 && u > best) best = u;
    }
    return best;
  }

  // ------------------------------------------------------------ per surface

  // element lists, cached until the DOM (classes, styles, nodes) changes
  function queries(ent) {
    if (ent.q && ent.q.gen === ent.domGen) return ent.q;
    const a = performance.now();
    const s = ent.s;
    const q = { gen: ent.domGen, cover: [], rules: new Map(), modeEl: null, plates: [], mosaic: [], nopop: [], media: [], modal: [] };
    const all = (sel) => { try { return Array.from(ent.doc.querySelectorAll(sel)); } catch (_) { return []; } };
    q.cover = all(s.cover.sel);
    for (const rule of s.rules) q.rules.set(rule, all(rule.sel));
    if (s.modes) {
      q.modeEl = q.cover.find((el) => el.hasAttribute(s.modes.attr)) || null;
      if (!q.modeEl && s.modes.sel) { try { q.modeEl = ent.doc.querySelector(s.modes.sel); } catch (_) { /* gone */ } }
    }
    q.plates = all('[data-lgs-plate]');
    q.mosaic = all('[data-lgs-mosaic]');
    if (s.hasAdmission) {
      q.nopop = all('[data-lgs-nopop]');
      q.media = all('video, [data-lgs-media]');
      if (s.modal) q.modal = all(s.modal);
    }
    ent.q = q;
    ent.queries++;
    S.prof.queryMs += performance.now() - a;
    return q;
  }

  // Full measurement of one window: {surface, kept, covers, plateEls,
  // warnings}. Layers in a scroller that is scrolling right now are left out
  // ('scrolling').
  function computeEntry(ent, why) {
    const s = ent.s;
    const win = ent.win;
    const now = performance.now();
    let doc;
    let dpr;
    let vw;
    let vh;
    try {
      doc = win.document;
      dpr = win.devicePixelRatio || 1;
      vw = win.innerWidth;
      vh = win.innerHeight;
    } catch (_) {
      return { surface: blank(ent, 0, 0), kept: [], covers: [], plateEls: [], warnings: [] };
    }
    const texW = Math.round(vw * dpr);
    const texH = Math.round(vh * dpr);
    const surface = blank(ent, texW, texH);
    const out = { surface, kept: [], covers: [], plateEls: [], warnings: [], windowReq: null };
    const off = (reason) => {
      if (why) why.push({ surface: reason });
      return out;
    };
    if (s.docVisibility && doc.visibilityState !== 'visible') return off('window hidden');
    if (s.frameKey && !frameVisible(s.frameKey)) return off('dashboard frame hidden');
    if (s.laserOnly) {
      const g = gamepadNav();
      if (g !== false) return off(g === null ? 'input mode unknown yet (laser-only surface)' : 'controller navigation (laser-only surface)');
    }
    const ctx = { ent, win, doc, dpr, vw, vh, texW, texH, now, held: 0, geom: S.geom, profile: S.profile };
    const q = queries(ent);

    // glass mode (main): data-lgs-glass on %{BasicUiRoot} (C1a)
    let mode = null;
    const modeEl = q.modeEl;
    if (s.modes && modeEl) {
      const v = modeEl.getAttribute(s.modes.attr);
      if (v && MODES.includes(v) && s.modes.shapes[v]) mode = v;
      else if (v) out.warnings.push(s.name + ': unknown ' + s.modes.attr + '="' + String(v).slice(0, 24) + '" (Phase 1 cover)');
    }

    const shapes = [];
    if (mode) {
      const sh = s.modes.shapes[mode];
      if (!sh.none) {
        const b = measure(ctx, modeEl, { pseudo: null, inset: null, r: sh.r !== null ? sh.r : undefined }, false, true);
        if (b.skip) {
          if (why) why.push({ cover: describe(modeEl), mode, skip: b.skip });
        } else {
          if (sh.h) {
            const R = modeEl.getBoundingClientRect();
            b.b = Math.min(b.b, R.top + sh.h);
          }
          let t = b.b - b.t > 1 ? toTex(b, ctx) : null;
          if (t) t = settleShape(ctx, modeEl, t, 'cover');
          if (t) {
            shapes.push(t);
            out.covers.push(modeEl);
            if (why) why.push({ cover: describe(modeEl), mode, ok: t });
          } else if (why) why.push({ cover: describe(modeEl), mode, skip: 'too small or animating (new)' });
        }
      } else if (why) why.push({ cover: describe(modeEl), mode, skip: 'windowless: plates only' });
    } else {
      // the cover: the first match, or (cover.all) every outermost match
      for (const el of q.cover) {
        if (shapes.length && !s.cover.all) break;
        if (s.cover.all && q.cover.some((o) => o !== el && o.contains(el))) {
          if (why) why.push({ cover: describe(el), skip: 'inside another cover' });
          continue;
        }
        const b = measure(ctx, el, s.cover, false, true);
        if (b.skip) { if (why) why.push({ cover: describe(el), skip: b.skip }); continue; }
        let t = toTex(b, ctx);
        if (!t) { if (why) why.push({ cover: describe(el), skip: 'too small' }); continue; }
        t = settleShape(ctx, el, t, 'cover');
        if (!t) { if (why) why.push({ cover: describe(el), skip: 'animating (new)' }); continue; }
        shapes.push(t);
        out.covers.push(el);
        if (why) why.push({ cover: describe(el), ok: t });
      }
    }

    // plates: [data-lgs-plate] (any mode, any surface)
    const plates = [];
    if (q.plates.length) {
      const seen = new Set();
      let n = 0;
      for (const el of q.plates) {
        const p = plateOf(ctx, el, n, seen, why);
        if (!p) continue;
        n++;
        if (plates.length >= MAX_PLATES) { out.warnings.push(s.name + ': plate ' + p.id + ' dropped (more than ' + MAX_PLATES + ')'); continue; }
        plates.push(p);
        out.plateEls.push({ el, p, occ: el.getAttribute('data-lgs-plate-occluder') });
      }
    }

    if (!shapes.length && !plates.length) return off(mode === 'windowless' ? 'windowless, no plates on screen' : 'no cover on screen');
    surface.visible = true;
    if (shapes.length) surface.radius = shapes[0].r;
    else if (mode && s.modes.shapes.window && s.modes.shapes.window.r !== null) surface.radius = Math.round(s.modes.shapes.window.r * dpr);
    surface.shapes = shapes;
    if (mode) surface.mode = mode;
    if (s.coverDz) surface.coverDz = r4(unitsOf(s.coverDz, ctx));

    // the window request (CC-A dim, sheet recede): main's <html> or the mode element
    if (s.modes) {
      let dim = null;
      let rec = null;
      for (const e of [doc.documentElement, modeEl]) {
        if (!e) continue;
        const d = e.getAttribute('data-lgs-window-dim');
        if (d !== null && d !== '' && Number.isFinite(+d)) dim = Math.max(0, Math.min(1, +d));
        const rr = e.getAttribute('data-lgs-window-recede');
        if (rr !== null && rr !== '' && Number.isFinite(+rr)) rec = +rr;
      }
      if (dim !== null || rec !== null) {
        out.windowReq = {};
        if (dim !== null) out.windowReq.dim = dim;
        if (rec !== null) out.windowReq.recede = r4(unitsOf({ mm: rec }, ctx));
      }
    }

    // admission inputs (rules with admission on)
    const adm = { modalOpen: false, nopop: [], media: [] };
    if (s.hasAdmission) {
      adm.nopop = boxes(ctx, q.nopop);
      adm.media = boxes(ctx, q.media);
      adm.modalOpen = q.modal.some((el) => !measure(ctx, el, {}, false, true).skip)
        || s.rules.some((r) => r.admission && r.modal && (!r.flag || flagOn(r.flag)) && (q.rules.get(r) || []).some((el) => !measure(ctx, el, r, false, true).skip));
    }

    for (const rule of s.rules) {
      if (rule.admission) {
        if (rule.flag && !flagOn(rule.flag)) { if (why) why.push({ rule: rule.id, skip: 'flag ' + rule.flag + ' off' }); continue; }
        if (rule.profile && rule.profile !== ctx.profile) { if (why) why.push({ rule: rule.id, skip: 'profile ' + rule.profile + ' only' }); continue; }
        if (adm.modalOpen && !rule.modal) {
          if (why && (q.rules.get(rule) || []).length) why.push({ rule: rule.id, skip: 'rule6-modal (a modal is open)' });
          continue;
        }
      }
      let n = 0;
      for (const el of q.rules.get(rule) || []) {
        if (n >= rule.max || out.kept.length >= s.maxLayers) break;
        const r = rule.admission ? candidateV3(ctx, rule, el, out.kept, shapes, plates, n, adm)
          : candidate(ctx, rule, el, out.kept, shapes, n);
        if (why) why.push(Object.assign({ rule: rule.id, el: describe(el) }, r.skip ? { skip: r.skip } : { ok: r.layer }));
        if (r.skip) continue;
        out.kept.push(r);
        n++;
      }
    }
    surface.layers = out.kept.map((k) => k.layer);

    // plates under a pop read as its shadow (HA 10.2), unless told otherwise
    if (plates.length) {
      for (const pe of out.plateEls) {
        const p = pe.p;
        if (pe.occ === 'true' || (pe.occ !== 'false' && out.kept.some((k) => overlaps(k.t, p)))) p.occluder = true;
      }
      surface.plates = plates;
    }
    const bands = mosaicOf(ctx, q, mode, plates);
    if (bands) surface.mosaic = bands;

    // rule 7: at most 4 distinct depths at rest (0 counts)
    const depths = new Set([0]);
    for (const k of out.kept) if (k.admission) depths.add(k.layer.dz);
    if (depths.size > MAX_DEPTHS) {
      out.warnings.push(s.name + ': ' + depths.size + ' distinct depths (max ' + MAX_DEPTHS + '): ' + [...depths].sort((a, b) => a - b).join(', '));
    }
    out.held = ctx.held;
    return out;
  }

  // visible boxes of elements, in texture px
  function boxes(ctx, els) {
    const out = [];
    for (const el of els) {
      const b = measure(ctx, el, {}, false, true);
      if (b.skip) continue;
      const t = toTex(b, ctx);
      if (t) out.push(t);
    }
    return out;
  }

  // One [data-lgs-plate] element as a plate, or null.
  function plateOf(ctx, el, n, seen, why) {
    const mat0 = el.getAttribute('data-lgs-plate') || '';
    const mat = PLATE_MATERIALS.includes(mat0) ? mat0 : 'liquid';
    const rA = el.getAttribute('data-lgs-plate-r');
    const iA = el.getAttribute('data-lgs-plate-inset');
    const spec = {
      pseudo: null,
      inset: iA !== null && iA !== '' && Number.isFinite(+iA) ? insetOf(+iA) : null,
      r: rA === 'capsule' ? 'capsule' : (rA !== null && rA !== '' && Number.isFinite(+rA) ? +rA : undefined),
    };
    let id = el.getAttribute('data-lgs-plate-id');
    if (!id || !ID_RE.test(id)) id = 'p' + n;
    while (seen.has(id)) id += '~';
    seen.add(id);
    const b = measure(ctx, el, spec, false, true);
    if (b.skip) { if (why) why.push({ plate: id, el: describe(el), skip: b.skip }); return null; }
    let t = toTex(b, ctx);
    if (!t) { if (why) why.push({ plate: id, el: describe(el), skip: 'too small' }); return null; }
    t = settleShape(ctx, el, t, 'plate');
    if (!t) { if (why) why.push({ plate: id, el: describe(el), skip: 'animating (new)' }); return null; }
    const p = { id, x: t.x, y: t.y, w: t.w, h: t.h, r: t.r, material: mat };
    const ph = el.getAttribute('data-lgs-plate-phase');
    if (ph !== null && ph !== '' && Number.isFinite(+ph)) p.phase = Math.max(0, Math.min(1, +ph));
    const ap = el.getAttribute('data-lgs-plate-appear');
    if (ap === 'materialize' || ap === 'dematerialize') p.appear = ap;
    const tint = colorOf(el.getAttribute('data-lgs-plate-tint'));
    if (tint && tint !== 'auto' && tint !== 'scrim') p.tint = tint;
    const fill = el.getAttribute('data-lgs-plate-fill') === 'scrim' ? 'rgba(0, 0, 0, 0.35)' : colorOf(el.getAttribute('data-lgs-plate-fill'));
    if (fill && fill !== 'auto' && fill !== 'scrim') p.fill = fill;
    if (why) why.push({ plate: id, el: describe(el), ok: p });
    return p;
  }

  // mosaic bands: [data-lgs-mosaic] boxes; in windowless mode without any,
  // plates whose vertical spans overlap merged into one band (+2 px)
  function mosaicOf(ctx, q, mode, plates) {
    if (q.mosaic.length) {
      return boxes(ctx, q.mosaic).map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
    }
    if (mode !== 'windowless' || !plates.length) return null;
    const list = plates.map((p) => ({ x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h })).sort((a, b) => a.y0 - b.y0);
    const bands = [];
    for (const p of list) {
      const last = bands[bands.length - 1];
      if (last && p.y0 <= last.y1) {
        last.x0 = Math.min(last.x0, p.x0);
        last.x1 = Math.max(last.x1, p.x1);
        last.y1 = Math.max(last.y1, p.y1);
      } else bands.push(Object.assign({}, p));
    }
    return bands.map((b) => {
      const x = Math.max(0, b.x0 - 2);
      const y = Math.max(0, b.y0 - 2);
      return { x, y, w: Math.min(ctx.texW, b.x1 + 2) - x, h: Math.min(ctx.texH, b.y1 + 2) - y };
    });
  }

  // An animating cover or plate keeps its last settled shape, updated at most
  // every COVER_FOLLOW_MS; a new one waits until it settles (a materializing
  // popup), so glassd re-renders its shape a few times, not every frame.
  function settleShape(ctx, el, t, key) {
    const ent = ctx.ent;
    let m = ent.settled.get(el);
    if (!m) ent.settled.set(el, m = {});
    const prev = m[key];
    if (!animating(ent, el, ctx.now, key)) {
      m[key] = Object.assign({ at: ctx.now }, t);
      return t;
    }
    if (!prev) return null;
    ctx.held++;
    if (ctx.now - prev.at >= COVER_FOLLOW_MS) m[key] = Object.assign({ at: ctx.now }, t);
    const c = m[key];
    return { x: c.x, y: c.y, w: c.w, h: c.h, r: c.r };
  }

  function blank(ent, texW, texH) {
    return {
      name: ent.name, overlayKey: ent.key, visible: false, texW, texH, radius: 0,
      material: ent.s.material, shapes: [], layers: [],
    };
  }

  // Phase 1 candidate (admission off: 99-legacy.json, layers.json)
  function candidate(ctx, rule, el, kept, shapes, slot) {
    const ent = ctx.ent;
    for (const k of kept) if (k.el === el && k.part === rule.part) return { skip: 'already popped' };
    let focused = true;
    if (rule.focus) { try { focused = el.matches(rule.focus); } catch (_) { focused = false; } }
    const dz = rule.dz + (focused ? rule.lift : 0);
    if (!(dz > 0)) return { skip: 'not focused' };
    const b = measure(ctx, el, rule, rule.hitTest, rule.clip);
    if (b.skip) return b;
    // its crop would lag the live texture while the scroller moves
    if (b.scrollers.some((sc) => isScrolling(ent, sc, ctx.now))) return { skip: 'scrolling' };
    let t = toTex(b, ctx);
    if (!t) return { skip: 'too small' };
    // Steam's own pixels outside the cover would show behind the crop.
    const shape = shapeAt(shapes, t);
    if (!shape) return { skip: 'outside the cover' };
    t = intersectTex(t, shape);
    if (!t) return { skip: 'outside the cover' };
    t = settleSize(ctx, el, rule, t);
    if (!t) return { skip: 'animating (new)' };
    // same rule as the daemon: popped rects never overlap
    for (const k of kept) if (overlaps(t, k.t)) return { skip: 'overlaps ' + k.layer.id };
    const id = slot === 0 ? rule.id : rule.id + '.' + slot;
    return {
      el, part: rule.part, t, scrollers: b.scrollers, admission: false,
      layer: { id, x: t.x, y: t.y, w: t.w, h: t.h, r: t.r, dz: Math.round(dz * 10000) / 10000, material: rule.material },
    };
  }

  // the slab size changes only once the element has settled
  function settleSize(ctx, el, rule, t) {
    const ent = ctx.ent;
    let m = ent.settled.get(el);
    if (!m) ent.settled.set(el, m = {});
    if (!animating(ent, el, ctx.now, rule.part)) {
      m[rule.part] = { w: t.w, h: t.h, r: t.r };
      return t;
    }
    const p = m[rule.part];
    if (!p) return null;
    ctx.held++;
    return { x: Math.round(t.x + t.w / 2 - p.w / 2), y: Math.round(t.y + t.h / 2 - p.h / 2), w: p.w, h: p.h, r: p.r };
  }

  // Is the element attended (PLAN 1.4)? Gamepad: focused (.gpfocus). Laser
  // (P3's html.lgs-input-laser): dwelt on, .lgs-dwell:hover on it, inside it
  // or around it. Without P3's classes: Phase 1 (.gpfocus).
  function attended(ent, el, rule) {
    let html;
    try { html = ent.doc.documentElement; } catch (_) { return false; }
    try {
      if (html.classList.contains('lgs-input-laser')) {
        if (el.matches('.lgs-dwell:hover') || el.querySelector('.lgs-dwell:hover')) return true;
        const d = el.closest('.lgs-dwell');
        return !!(d && el.matches(':hover'));
      }
      return el.matches(rule.focus || DEFAULT_FOCUS);
    } catch (_) { return false; }
  }

  function inputMode(ent) {
    try {
      const c = ent.doc.documentElement.classList;
      return c.contains('lgs-input-laser') ? 'laser' : c.contains('lgs-input-pad') ? 'pad' : null;
    } catch (_) { return null; }
  }

  // the rule's values in the live profile
  function effective(rule, profile) {
    const w = profile === 'wearer' && rule.wearer ? rule.wearer : null;
    return {
      depth: w && w.depth ? w.depth : rule.depth,
      lift: w && w.lift ? w.lift : rule.lift,
      when: w && w.when ? w.when : rule.when,
      interactive: profile === 'wearer' && (w && w.interactive !== null ? w.interactive : rule.interactive),
    };
  }

  // The shorter side (CSS px) of the smallest visible focusable that is the
  // element or inside it and shows in the crop by >= 8 x 8 px; null if none.
  function smallestTarget(ctx, el, rule, b) {
    const F = rule.focusables || DEFAULT_FOCUSABLES;
    let list;
    try {
      list = el.matches(F) ? [el] : [];
      const inner = el.querySelectorAll(F);
      for (let i = 0; i < inner.length && i < 300; i++) list.push(inner[i]);
    } catch (_) { return null; }
    let best = null;
    for (const c of list) {
      const R = c.getBoundingClientRect();
      if (!(R.width >= 1 && R.height >= 1)) continue;
      const ix = Math.min(R.right, b.r) - Math.max(R.left, b.l);
      const iy = Math.min(R.bottom, b.b) - Math.max(R.top, b.t);
      if (ix < MIN_VISIBLE_TARGET || iy < MIN_VISIBLE_TARGET) continue;
      const st = cs(ctx.ent, c);
      if (st.display === 'none' || st.visibility !== 'visible') continue;
      const s = Math.min(R.width, R.height);
      if (best === null || s < best) best = s;
    }
    return best === null ? null : Math.round(best * 10) / 10;
  }

  // the cover shape or plate that contains t (within COVER_TOL)
  function containerOf(t, shapes, plates) {
    const inside = (c) => t.x >= c.x - COVER_TOL && t.y >= c.y - COVER_TOL
      && t.x + t.w <= c.x + c.w + COVER_TOL && t.y + t.h <= c.y + c.h + COVER_TOL;
    for (const c of shapes) if (inside(c)) return c;
    for (const c of plates) if (inside(c)) return c;
    return null;
  }

  function isDestructive(el) {
    try { return el.matches('[data-lgs-destructive]') || !!el.querySelector('[data-lgs-destructive]'); } catch (_) { return false; }
  }

  // a saturated computed background colour of the element, or null
  function autoTint(ent, el) {
    let c;
    try { c = cs(ent, el).backgroundColor; } catch (_) { return null; }
    const m = /rgba?\(([\d.]+),?\s*([\d.]+),?\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?/.exec(c || '');
    if (!m) return null;
    const v = [+m[1], +m[2], +m[3]];
    const a = m[4] === undefined ? 1 : +m[4];
    const mx = Math.max(...v);
    const mn = Math.min(...v);
    if (a < 0.5 || mx < 40 || (mx - mn) / mx < 0.25) return null;
    return 'rgb(' + v.map(Math.round).join(' ') + ')';
  }

  // Phase 2 candidate: the admission rules of PLAN 1.7 (contract section 4).
  function candidateV3(ctx, rule, el, kept, shapes, plates, slot, adm) {
    const ent = ctx.ent;
    for (const k of kept) if (k.el === el && k.part === rule.part) return { skip: 'already popped' };
    const eff = effective(rule, ctx.profile);
    const liftU = unitsOf(eff.lift, ctx);
    const att = eff.when === 'attended' || liftU > 0 ? attended(ent, el, rule) : false;
    if (eff.when === 'attended' && !att) return { skip: 'not attended' };
    const want = unitsOf(eff.depth, ctx) + (att ? liftU : 0);
    if (!(want > 0)) return { skip: 'no depth' };
    if (isDestructive(el)) return { skip: 'rule4-destructive' };
    if (rule.exclude) {
      try { if (el.matches(rule.exclude) || el.querySelector(rule.exclude)) return { skip: 'exclude' }; } catch (_) { /* bad selector */ }
    }
    const b = measure(ctx, el, rule, rule.hitTest, rule.clip);
    if (b.skip) return b;
    if (b.scrollers.some((sc) => isScrolling(ent, sc, ctx.now))) return { skip: 'rule6-scrolling' };
    let t = toTex(b, ctx);
    if (!t) return { skip: 'too small' };
    // rule 5: containers only
    const wc = t.w / ctx.dpr;
    const hc = t.h / ctx.dpr;
    const big = wc >= MIN_CONTAINER - 0.5 && hc >= MIN_CONTAINER - 0.5;
    const capsule = rule.r === 'capsule' && hc >= MIN_CAPSULE_H - 0.5 && wc >= MIN_CONTAINER - 0.5;
    if (!big && !capsule) return { skip: 'rule5-small ' + Math.round(wc) + 'x' + Math.round(hc) };
    // rule 1: inside a cover shape or a plate, never over a nopop element
    const host = containerOf(t, shapes, plates);
    if (!host) return { skip: 'rule1-uncovered' };
    t = intersectTex(t, host) || t;
    if (adm.nopop.some((x) => overlaps(t, x))) return { skip: 'rule1-nopop' };
    // rule 3: not over media
    if (!rule.media && adm.media.some((x) => overlaps(t, x))) return { skip: 'rule3-media' };
    t = settleSize(ctx, el, rule, t);
    if (!t) return { skip: 'animating (new)' };
    for (const k of kept) if (overlaps(t, k.t)) return { skip: 'overlaps ' + k.layer.id };
    // rule 2: click-safe cap, snapped down to the allowed set
    const interactive = !!eff.interactive;
    let dz = want;
    let sMin = null;
    let cap = Infinity;
    if (!interactive) {
      sMin = smallestTarget(ctx, el, rule, b);
      if (sMin !== null) cap = CLICK_SAFE * sMin;
      dz = snapDown(Math.min(want, cap), ctx);
      if (!(dz > 0)) return { skip: 'rule2-click-safe s=' + sMin + ' cap=' + r4(cap) };
    }
    const id = slot === 0 ? rule.id : rule.id + '.' + slot;
    const layer = { id, x: t.x, y: t.y, w: t.w, h: t.h, r: t.r, dz: r4(dz), material: rule.material, interactive };
    if (cap < want - 1e-6) { layer.capped = true; layer.want = r4(want); }
    if (rule.hole) layer.hole = rule.hole;
    if (rule.tint) {
      const tint = rule.tint === 'auto' ? autoTint(ent, el) : rule.tint;
      if (tint) layer.tint = tint;
    }
    if (rule.modal) layer.modal = true;
    if (rule.from === 'cut') layer.from = 'cut';
    else if (rule.from) layer.from = r4(unitsOf(rule.from, ctx));
    if (rule.sink === false) layer.sink = false;
    return { el, part: rule.part, t, scrollers: b.scrollers, admission: true, s: sMin, layer };
  }

  // The last full measurement minus the layers whose scroller started
  // scrolling since.
  function present(ent, now) {
    const f = ent.full;
    const kept = f.kept.filter((k) => !k.scrollers.some((sc) => isScrolling(ent, sc, now)));
    if (kept.length === f.kept.length) return f;
    const surface = Object.assign({}, f.surface, { layers: kept.map((k) => k.layer) });
    return Object.assign({}, f, { surface, kept });
  }

  // ------------------------------------------------------------ attributes

  // Since when each reported (element, part) has held its id. An ack names
  // ids; it can only refer to the element now holding an id once that
  // element has held it for a scene-graph round trip (an id moves, e.g. the
  // focused card). Covers hold the id '#cover', plates their plate id.
  function refreshHold(ent, now) {
    const next = new Map();
    const cur = ent.cur;
    if (cur && cur.surface.visible) {
      const prev = ent.hold;
      const put = (el, part, id) => {
        const o = prev.get(el);
        const r = o && o[part];
        let m = next.get(el);
        if (!m) next.set(el, m = {});
        m[part] = r && r.id === id ? r : { id, since: now };
      };
      for (const el of cur.covers) put(el, 'cover', '#cover');
      for (const k of cur.kept) put(k.el, k.part, k.layer.id);
      for (const pe of cur.plateEls || []) put(pe.el, 'plate', pe.p.id);
    }
    ent.hold = next;
  }

  // ack mode: what the compositor shows for this window, {cover, pops,
  // plates}; null when its key is in neither ack map (nothing shown)
  function ackedFor(ent, now) {
    const a = S.acked && Object.prototype.hasOwnProperty.call(S.acked, ent.key) ? S.acked[ent.key] : undefined;
    let r = null;
    if (Array.isArray(a)) r = { cover: true, pops: a.map(String), plates: [] };
    else if (a && typeof a === 'object') {
      r = {
        cover: a.cover !== false,
        pops: Array.isArray(a.pops) ? a.pops.map(String) : [],
        plates: Array.isArray(a.plates) ? a.plates.map(String) : [],
      };
    }
    // P8's form: ack(popMap, {plates: plateMap})
    if (S.ackedPlates && Object.prototype.hasOwnProperty.call(S.ackedPlates, ent.key) && Array.isArray(S.ackedPlates[ent.key])) {
      if (!r) r = { cover: false, pops: [], plates: [] };
      r.plates = S.ackedPlates[ent.key].map(String);
    }
    if (r) ent.keyAcked = true;
    let native = false;
    try { native = ent.doc.documentElement.classList.contains('lgs-native'); } catch (_) { /* gone */ }
    if (!native) ent.nativeSince = 0; else if (!ent.nativeSince) ent.nativeSince = now;
    return r;
  }

  function updateAttrs() {
    if (!S) return;
    const now = performance.now();
    let due = Infinity;
    for (const ent of S.ents.values()) {
      const plan = new Map();
      const cur = ent.cur;
      refreshHold(ent, now);
      if (cur && cur.surface.visible) {
        const ack = S.ackMode ? ackedFor(ent, now) : null;
        // a daemon that leaves out surfaces with nothing popped: the window's
        // lgs-native (glassd covers it) stands in for the cover's ack
        const fallback = S.ackMode && !ack && !ent.keyAcked && ent.nativeSince && now - ent.nativeSince >= COVER_FALLBACK_MS;
        const ok = (el, part) => {
          if (!S.ackMode) return true;
          const o = ent.hold.get(el);
          const r = o && o[part];
          if (!r) return false;
          let shown;
          if (part === 'cover') shown = !!((ack && ack.cover) || fallback);
          else if (part === 'plate') shown = !!(ack && ack.plates.includes(r.id));
          else shown = !!(ack && ack.pops.includes(r.id));
          if (!shown) return false;
          const t = r.since + S.ackDelay;
          if (now >= t) return true;
          due = Math.min(due, t);
          return false;
        };
        const add = (el, part) => {
          let p = plan.get(el);
          if (!p) plan.set(el, p = { cover: false, pop: [], plate: false });
          if (part === 'cover') p.cover = true;
          else if (part === 'plate') p.plate = true;
          else if (!p.pop.includes(part)) p.pop.push(part);
        };
        for (const el of cur.covers) if (ok(el, 'cover')) add(el, 'cover');
        for (const k of cur.kept) if (ok(k.el, k.part)) add(k.el, k.part);
        for (const pe of cur.plateEls || []) if (ok(pe.el, 'plate')) add(pe.el, 'plate');
      }
      applyAttrs(ent, plan);
    }
    if (S.attrTimer) { clearTimeout(S.attrTimer); S.attrTimer = 0; }
    if (due < Infinity) {
      S.attrTimer = setTimeout(() => { if (S) { S.attrTimer = 0; updateAttrs(); } }, Math.max(5, due - now + 2));
    }
  }

  function applyAttrs(ent, plan) {
    const AP = ent.attrPop;
    const AC = ent.attrCover;
    const APL = ent.attrPlate;
    for (const el of ent.applied.keys()) {
      if (plan.has(el)) continue;
      try {
        el.removeAttribute(AP);
        el.removeAttribute(AC);
        el.removeAttribute(APL);
      } catch (_) { /* window gone */ }
    }
    for (const [el, at] of plan) {
      try {
        const pop = at.pop.join(' ');
        if (pop) { if (el.getAttribute(AP) !== pop) el.setAttribute(AP, pop); } else if (el.hasAttribute(AP)) el.removeAttribute(AP);
        if (at.cover) { if (!el.hasAttribute(AC)) el.setAttribute(AC, ''); } else if (el.hasAttribute(AC)) el.removeAttribute(AC);
        if (at.plate) { if (!el.hasAttribute(APL)) el.setAttribute(APL, ''); } else if (el.hasAttribute(APL)) el.removeAttribute(APL);
      } catch (_) { /* window gone */ }
    }
    ent.applied = plan;
  }

  function popCount() {
    let n = 0;
    for (const ent of S.ents.values()) for (const at of ent.applied.values()) if (at.pop.length) n++;
    return n;
  }

  function plateCount() {
    let n = 0;
    for (const ent of S.ents.values()) for (const at of ent.applied.values()) if (at.plate) n++;
    return n;
  }

  // ------------------------------------------------------------ loop

  function clockWindow() {
    let best = null;
    for (const e of S.ents.values()) {
      try {
        if (e.doc.visibilityState !== 'visible') continue;
        if (e.s.name === 'main') return e.win;
        if (!best) best = e.win;
      } catch (_) { /* closing */ }
    }
    return best;
  }

  // One pending tick at a time: after `delay` ms, on the next animation
  // frame of a visible window (a timer when none renders).
  function schedule(delay, timerOnly) {
    if (!S || S.paused || !S.dash || S.raf) return;
    S.rafAt = performance.now();
    if (delay > 1) {
      S.rafTimer = true;
      S.raf = setTimeout(() => {
        if (!S) return;
        S.raf = 0;
        S.rafTimer = false;
        schedule(0, timerOnly);
      }, delay);
      return;
    }
    const w = timerOnly ? null : clockWindow();
    if (w) {
      try {
        S.raf = w.requestAnimationFrame(tick);
        S.rafWin = w;
        S.rafTimer = false;
        return;
      } catch (_) { /* window closing: fall back to a timer */ }
    }
    S.rafWin = null;
    S.rafTimer = true;
    S.raf = setTimeout(tick, 16);
  }

  function cancelFrame() {
    if (!S || !S.raf) return;
    try { if (S.rafWin) S.rafWin.cancelAnimationFrame(S.raf); else clearTimeout(S.raf); } catch (_) { /* window gone */ }
    S.raf = 0;
    S.rafWin = null;
    S.rafTimer = false;
  }

  // a scroller is "still" SCROLL_SETTLE_MS after its last scroll event
  function armSettle() {
    if (S.settleTimer) clearTimeout(S.settleTimer);
    S.settleTimer = setTimeout(() => {
      if (!S) return;
      S.settleTimer = 0;
      schedule(0);
    }, SCROLL_SETTLE_MS + 10);
  }

  function settleScrolls(ent, now) {
    if (!ent.scrolling.size) return;
    let settled = false;
    for (const [sc, t] of ent.scrolling) {
      if (now - t >= SCROLL_SETTLE_MS) { ent.scrolling.delete(sc); settled = true; }
    }
    if (!settled) return;
    ent.dirty = true;
    if (ent.deferred) { ent.deferred = false; ent.domGen++; }
  }

  function tick() {
    if (!S) return;
    S.raf = 0;
    S.rafWin = null;
    S.rafTimer = false;
    if (S.paused || !S.dash) return;
    const t0 = performance.now();
    const since = t0 - S.lastTickAt;
    if (since < MIN_TICK_MS) { schedule(MIN_TICK_MS - since); return; }
    if (S.dashPending) { schedule(16); return; } // a dashboard check is in flight
    S.lastTickAt = t0;
    let again = false;
    let changed = false;
    for (const ent of S.ents.values()) {
      settleScrolls(ent, t0);
      // per-frame samples only while a reported layer follows an animation;
      // an element that waits to settle is picked up by its end event
      const moving = !!(ent.full && ent.full.held) && animsRelevant(ent, t0);
      const full = ent.force || ent.dirty || !ent.full || moving || t0 < ent.tailUntil;
      if (!full && !ent.needLight) continue;
      ent.needLight = false;
      if (full) {
        ent.force = false;
        ent.dirty = false;
        const a = performance.now();
        try { ent.full = computeEntry(ent, null); } catch (e) {
          S.lastError = String(e && e.stack || e).slice(0, 400);
          ent.full = { surface: blank(ent, 0, 0), kept: [], covers: [] };
        }
        ent.computeMs += performance.now() - a;
        ent.computes++;
        S.fullComputes++;
      } else {
        ent.lights++;
        S.lightComputes++;
      }
      const cur = present(ent, t0);
      const sig = JSON.stringify(cur.surface);
      ent.cur = cur;
      if (sig !== ent.sig) {
        ent.sig = sig;
        ent.changes++;
        changed = true;
        if (full) {
          ent.tailUntil = t0 + TAIL_MS;
          // another layer appeared or went: re-check what covers what once
          const ids = cur.surface.layers.map((l) => l.id).join(',');
          if (ent.lastIds !== null && ids !== ent.lastIds) { ent.hitGen++; ent.dirty = true; }
          ent.lastIds = ids;
        }
      }
      if (ent.dirty || (ent.full.held && animsRelevant(ent, t0)) || t0 < ent.tailUntil) again = true;
    }
    if (changed || S.structureChanged || S.lastBody === null) {
      updateAttrs();
      emit();
    }
    S.structureChanged = false;
    const ms = performance.now() - t0;
    S.ticks++;
    S.lastMs = ms;
    S.totalMs += ms;
    S.maxMs = Math.max(S.maxMs, ms);
    if (again) schedule(MIN_TICK_MS);
  }

  function surfacesNow(final) {
    const out = [];
    for (const ent of S.ents.values()) {
      const r = final ? blank(ent, ent.cur ? ent.cur.surface.texW : 0, ent.cur ? ent.cur.surface.texH : 0) : ent.cur && ent.cur.surface;
      if (!r) continue;
      // a hidden pooled popup costs glassd an overlay and buffers: leave it out
      if (ent.s.keyPrefix && !r.visible) continue;
      out.push(r);
    }
    return out;
  }

  // the window request (CC-A dim, sheet recede) from the main surface
  function windowNow() {
    for (const ent of S.ents.values()) if (ent.cur && ent.cur.windowReq && ent.cur.surface.visible) return ent.cur.windowReq;
    return null;
  }

  // configuration errors plus this moment's warnings (rule 7, dropped plates)
  function errorsNow() {
    const out = (S.errors || []).slice();
    for (const ent of S.ents.values()) if (ent.cur && ent.cur.warnings) for (const w of ent.cur.warnings) out.push(w);
    return out.slice(0, 20);
  }

  function emit(final, force) {
    let body = '"v":' + VERSION + ',"dash":' + (S.dash ? 'true' : 'false')
      + ',"profile":' + JSON.stringify(S.profile) + ',"geom":' + JSON.stringify(S.geom)
      + ',"surfaces":' + JSON.stringify(surfacesNow(final));
    const win = final ? null : windowNow();
    if (win) body += ',"window":' + JSON.stringify(win);
    const errs = errorsNow();
    if (errs.length) body += ',"errors":' + JSON.stringify(errs);
    if (!final && !force && body === S.lastBody) return false;
    S.lastBody = body;
    S.seq++;
    let json = '{"seq":' + S.seq + ',' + body;
    if (final) json += ',"stopped":true';
    json += '}';
    S.last = json;
    S.emits++;
    S.lastEmitAt = Date.now();
    const bind = W[S.binding];
    if (typeof bind === 'function') {
      try { bind(json); } catch (e) { S.bindError = String(e); }
    }
    return true;
  }

  // Liveness: the daemon's pings, or (an older daemon that never pings) its
  // lgs-native heartbeat, or the theme staying off.
  function daemonGone() {
    const now = Date.now();
    if (S.pingAt) return now - S.pingAt > S.pingTtl ? 'no ping for ' + Math.round((now - S.pingAt) / 1000) + ' s' : null;
    // a heartbeat from before this reporter started may be a dead daemon's
    // leftover; only one seen since counts
    let h = null;
    try { h = W.__LGS_NATIVE; } catch (_) { /* none */ }
    if (h && Array.isArray(h.keys) && h.keys.length && +h.last > 0) {
      if (h.last > S.startedAt) S.nativeSeen = true;
      if (S.nativeSeen && now - h.last > NATIVE_STALE_MS) return 'lgs-native heartbeat stale for ' + Math.round((now - h.last) / 1000) + ' s';
    }
    if (S.themeOffPolls >= THEME_OFF_POLLS) return 'theme off for 30 s';
    return null;
  }

  // The live profile, geometry and rule flags; true when one changed.
  function refreshInputs() {
    const p = profileNow();
    const g = geomNow();
    const fs = S.flagNames.map((n) => (flagOn(n) ? '1' : '0')).join('');
    const changed = p !== S.profile || !S.geom || g.S !== S.geom.S || g.r !== S.geom.r || fs !== S.flagSig;
    S.profile = p;
    S.geom = g;
    S.flagSig = fs;
    return changed;
  }

  function pause() {
    if (S.paused) return;
    S.paused = true;
    cancelFrame();
    for (const ent of S.ents.values()) detach(ent);
    S.ents.clear();
    S.lastBody = null;
  }

  function poll() {
    if (!S) return;
    S.polls++;
    let themeOn = true;
    try { themeOn = !!(W.__LGS && W.__LGS.state && W.__LGS.state.enabled); } catch (_) { /* keep running */ }
    S.themeOffPolls = themeOn ? 0 : (S.themeOffPolls || 0) + 1;
    const gone = daemonGone();
    if (gone) { stop({ reason: gone }); return; }
    if (!themeOn) { pause(); return; }
    if (S.paused) { S.paused = false; S.structureChanged = true; }
    try { syncWindows(); } catch (e) { S.lastError = String(e && e.stack || e).slice(0, 400); }
    refreshDash();
    // profile, geometry or a rule's flag changed: measure everything again
    if (refreshInputs()) { for (const e of S.ents.values()) e.force = true; schedule(0); }
    if (!S.dash) return;
    if (S.structureChanged || S.ackMode) updateAttrs(); // new windows; cover fallback timing
    const resample = S.polls % RESAMPLE_EVERY === 0 || S.structureChanged;
    if (resample) {
      S.resamples++;
      const deep = S.resamples % DEEP_EVERY === 0;
      const now = performance.now();
      for (const e of S.ents.values()) {
        // a window that is scrolling gets a full measurement once it settles
        if (!S.structureChanged && e.scrolling.size && activeScrollers(e, now).length) continue;
        e.force = true;
        if (deep) { e.domGen++; e.hitGen++; }
      }
    }
    // a frame request on a window that stopped rendering must not stall us
    let stalled = false;
    if (S.raf && !S.rafTimer && performance.now() - S.rafAt > 250) { cancelFrame(); stalled = true; }
    if (resample || stalled) schedule(0, stalled);
  }

  // ------------------------------------------------------------ API

  let waiting = null; // {timer, tries, rules, opts} while the token index is missing

  function start(rules, opts) {
    if (S) stop({ silent: true, keepGlobal: true });
    if (waiting) { clearInterval(waiting.timer); waiting = null; }
    opts = opts || {};
    const cfg = compile(rules);
    if (!cfg) {
      // The theme (lgs_core.js) builds the token index; wait for it.
      waiting = { tries: 0, rules, opts, timer: setInterval(() => {
        if (!waiting) return;
        waiting.tries++;
        if (getIndex()) { const w = waiting; clearInterval(w.timer); waiting = null; start(w.rules, w.opts); } else if (waiting.tries > 120) { clearInterval(waiting.timer); waiting = null; }
      }, 1000) };
      return status();
    }
    S = {
      cfg, errors: cfg.errors, ents: new Map(),
      binding: opts.binding || 'lgsLayers',
      attrPrefix: typeof opts.attrPrefix === 'string' && /^data-[a-z0-9-]+$/.test(opts.attrPrefix) ? opts.attrPrefix : ATTR_PREFIX,
      dash: true, dashPending: false, dashForced: null, dashChanges: 0,
      nav: { C: null, state: 'idle', id: null, ms: 0 },
      animGeo: new Map(),
      raf: 0, rafWin: null, rafTimer: false, rafAt: 0, timer: 0, polls: 0, resamples: 0,
      settleTimer: 0, attrTimer: 0, lastTickAt: -1e9,
      seq: 0, emits: 0, ticks: 0, fullComputes: 0, lightComputes: 0, prof: { queryMs: 0, hitMs: 0 },
      lastMs: 0, totalMs: 0, maxMs: 0,
      last: null, lastBody: null, lastEmitAt: 0, lastError: null, bindError: null,
      structureChanged: true, startedAt: Date.now(), paused: false, themeOffPolls: 0,
      ackMode: !!opts.ackMode, acked: null, acks: 0, lastAckAt: 0,
      ackDelay: +opts.ackDelayMs >= 0 ? +opts.ackDelayMs : ACK_DELAY_MS,
      pingAt: 0, pings: 0, pingTtl: +opts.pingTtlMs > 0 ? +opts.pingTtlMs : PING_TTL_MS, nativeSeen: false,
      ackedPlates: null,
      optProfile: opts.profile === 'default' || opts.profile === 'wearer' ? opts.profile : null,
      optGeom: opts.geom && +opts.geom.S > 0 ? { S: +opts.geom.S, r: +opts.geom.r > 0 ? +opts.geom.r : 1, src: 'opts' } : null,
      optFlags: opts.flags && typeof opts.flags === 'object' ? Object.assign({}, opts.flags) : null,
      flagNames: [...new Set([].concat(...cfg.surfaces.map((sf) => sf.rules.filter((r) => r.flag).map((r) => r.flag))))],
      profile: 'default', geom: null, flagSig: '',
    };
    refreshInputs();
    syncWindows();
    refreshDash();
    S.timer = setInterval(poll, POLL_MS);
    schedule(0);
    return status();
  }

  function stop(o) {
    o = o || {};
    if (waiting) { clearInterval(waiting.timer); waiting = null; }
    const dropGlobal = () => {
      if (o.keepGlobal || W[GLOBAL] !== API) return;
      try { delete W[GLOBAL]; } catch (_) { W[GLOBAL] = undefined; }
    };
    if (!S) { dropGlobal(); return { running: false }; }
    const st = S;
    clearInterval(st.timer);
    cancelFrame();
    if (st.settleTimer) clearTimeout(st.settleTimer);
    if (st.attrTimer) clearTimeout(st.attrTimer);
    // the daemon must not keep compositing a layout nobody updates
    if (!o.silent && st.lastBody !== null) { try { emit(true); } catch (_) { /* binding gone */ } }
    for (const ent of st.ents.values()) detach(ent);
    st.ents.clear();
    S = null;
    const reason = o.reason || 'stop()';
    W[GLOBAL + '_LAST'] = { reason, at: Date.now(), emits: st.emits, seq: st.seq };
    dropGlobal();
    return { running: false, emits: st.emits, seq: st.seq, reason };
  }

  // running: false means the daemon should inject the reporter again (a
  // reporter still waiting for the theme's token index counts as running)
  function ping(o) {
    if (!S) return { running: !!waiting, version: VERSION, waiting: !!waiting };
    S.pingAt = Date.now();
    S.pings++;
    if (o && +o.ttlMs > 0) S.pingTtl = +o.ttlMs;
    return { running: true, version: VERSION, seq: S.seq, paused: S.paused, dash: S.dash, ackMode: S.ackMode };
  }

  // The daemon's acknowledgement: {overlayKey: [layer ids popped on screen]}.
  // Re-tags every window from its last measurement (no re-measuring). null
  // leaves ack mode (every reported element is tagged again).
  function ack(map, extra) {
    if (!S) return false;
    if (typeof map === 'string') { try { map = JSON.parse(map); } catch (_) { map = null; } }
    if (typeof extra === 'string') { try { extra = JSON.parse(extra); } catch (_) { extra = null; } }
    if (map && typeof map === 'object') {
      S.ackMode = true;
      S.acked = map;
      S.ackedPlates = extra && typeof extra === 'object' && extra.plates && typeof extra.plates === 'object' ? extra.plates : null;
    } else {
      S.ackMode = false;
      S.acked = null;
      S.ackedPlates = null;
    }
    S.acks++;
    S.lastAckAt = Date.now();
    if (S.pingAt) S.pingAt = S.lastAckAt; // an acking daemon is alive
    updateAttrs();
    return popCount();
  }

  // Measure now and emit even if nothing changed (after a daemon reconnect).
  function resend() {
    if (!S) return false;
    if (!S.dash || S.paused) { if (!S.paused) emit(false, true); return S.seq; }
    for (const e of S.ents.values()) e.force = true;
    S.lastBody = null;
    S.lastTickAt = -1e9;
    cancelFrame();
    tick();
    return S ? S.seq : false;
  }

  function forceDash(v) {
    if (!S) return false;
    S.dashForced = v === true || v === false ? v : null;
    refreshDash();
    return S.dash;
  }

  function status() {
    if (!S) {
      return waiting ? { running: false, version: VERSION, waiting: 'token index (theme off?)', tries: waiting.tries }
        : { running: false, version: VERSION, last: W[GLOBAL + '_LAST'] || null };
    }
    const now = performance.now();
    const surfaces = [];
    for (const e of S.ents.values()) {
      surfaces.push({
        name: e.name, key: e.key,
        visible: !!(e.cur && e.cur.surface.visible),
        layers: e.cur ? e.cur.surface.layers.length : 0,
        plates: e.cur && e.cur.surface.plates ? e.cur.surface.plates.length : 0,
        mode: e.cur && e.cur.surface.mode || null,
        input: inputMode(e),
        attrs: e.applied.size,
        computes: e.computes, computeMs: Math.round(e.computeMs * 10) / 10,
        lights: e.lights, changes: e.changes, queries: e.queries, hitTests: e.hitTests,
        scrolling: activeScrollers(e, now).length, animating: e.anims.size,
        wakes: Object.assign({}, e.wakes),
      });
    }
    // reading the input mode never starts the module search
    let nav = null;
    if (S.nav.C) { try { nav = !!S.nav.C.Instance.IsInGamepadNav; } catch (_) { nav = null; } }
    return {
      running: true, version: VERSION, v: VERSION, seq: S.seq, emits: S.emits, ticks: S.ticks, polls: S.polls,
      profile: S.profile, geom: S.geom, fragments: (S.cfg.fragments || []).map((f) => f.file),
      superseded: S.cfg.superseded || [], plateAcks: plateCount(),
      fullComputes: S.fullComputes, lightComputes: S.lightComputes,
      queryMs: Math.round(S.prof.queryMs * 10) / 10, hitMs: Math.round(S.prof.hitMs * 10) / 10,
      uptimeS: Math.round((Date.now() - S.startedAt) / 100) / 10,
      lastMs: Math.round(S.lastMs * 100) / 100,
      avgMs: S.ticks ? Math.round(S.totalMs / S.ticks * 100) / 100 : 0,
      maxMs: Math.round(S.maxMs * 100) / 100,
      dashboardVisible: S.dash, dashForced: S.dashForced, paused: S.paused,
      gamepadNav: nav, navSearch: { state: S.nav.state, module: S.nav.id, ms: Math.round(S.nav.ms * 10) / 10 },
      ackMode: S.ackMode, acks: S.acks, acked: S.acked,
      lastAckAgoMs: S.lastAckAt ? Date.now() - S.lastAckAt : null,
      pings: S.pings, lastPingAgoMs: S.pingAt ? Date.now() - S.pingAt : null, pingTtlMs: S.pingTtl,
      binding: S.binding, bound: typeof W[S.binding] === 'function',
      lastEmitAgoMs: S.lastEmitAt ? Date.now() - S.lastEmitAt : null,
      animations: Object.fromEntries([...S.animGeo].slice(0, 40).map(([k, v]) => [k, v ? 'moves' : 'paint'])),
      surfaces, errors: errorsNow(), lastError: S.lastError, bindError: S.bindError,
    };
  }

  // The report as it would be now, measured fresh; emits nothing.
  function snapshot() {
    if (!S) return null;
    refreshInputs();
    const surfaces = [];
    const warnings = [];
    let win = null;
    for (const ent of S.ents.values()) {
      const r = computeEntry(ent, null);
      surfaces.push(r.surface);
      for (const w of r.warnings) warnings.push(w);
      if (r.windowReq && r.surface.visible && !win) win = r.windowReq;
    }
    const o = { seq: S.seq, v: VERSION, dash: S.dash, profile: S.profile, geom: S.geom, surfaces };
    if (win) o.window = win;
    const errs = (S.errors || []).concat(warnings);
    if (errs.length) o.errors = errs.slice(0, 20);
    return o;
  }

  function debug(name) {
    if (!S) return null;
    refreshInputs();
    const out = {};
    for (const ent of S.ents.values()) {
      if (name && ent.name !== name && ent.s.name !== name) continue;
      const why = [];
      const r = computeEntry(ent, why);
      out[ent.name] = {
        visible: r.surface.visible, mode: r.surface.mode || null, input: inputMode(ent),
        shapes: r.surface.shapes, plates: r.surface.plates || [], mosaic: r.surface.mosaic || null,
        layers: r.surface.layers, warnings: r.warnings, why,
      };
    }
    return out;
  }

  // The merged configuration (fragments, surfaces, rules), for tools.
  function rules() {
    if (!S) return null;
    return {
      fragments: S.cfg.fragments || [], superseded: S.cfg.superseded || [], errors: S.errors,
      profile: S.profile, geom: S.geom,
      surfaces: S.cfg.surfaces.map((sf) => ({
        name: sf.name, key: sf.key, keyPrefix: sf.keyPrefix, material: sf.material, space: sf.space,
        modes: sf.modes ? Object.keys(sf.modes.shapes) : null, modal: !!sf.modal,
        rules: sf.rules.map((r) => ({
          id: r.id, file: r.file, admission: r.admission,
          depth: r.admission ? r.depth : { units: r.dz }, lift: r.admission ? r.lift : { units: r.lift },
          when: r.when || null, interactive: !!r.interactive, profile: r.profile || null, modal: !!r.modal,
          flag: r.flag || null, hole: r.hole || null, tint: r.tint || null, material: r.material,
        })),
      })),
    };
  }

  // Debug only: outline the cover (cyan) and every layer (magenta, with id and
  // dz) of the current snapshot in each window, for ms milliseconds. The nodes
  // are pointer-events:none and removed afterwards.
  function overlay(ms) {
    const snap = snapshot();
    if (!snap) return 0;
    let n = 0;
    for (const ent of S.ents.values()) {
      const sf = snap.surfaces.find((x) => x.name === ent.name);
      if (!sf || !sf.visible) continue;
      let doc;
      let dpr;
      try { doc = ent.doc; dpr = ent.win.devicePixelRatio || 1; } catch (_) { continue; }
      const root = doc.createElement('div');
      root.id = 'lgs-layers-overlay';
      root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
      const box = (t, color, label) => {
        const d = doc.createElement('div');
        d.style.cssText = `position:absolute;left:${t.x / dpr}px;top:${t.y / dpr}px;width:${t.w / dpr}px;height:${t.h / dpr}px;`
          + `border-radius:${t.r / dpr}px;outline:2px solid ${color};outline-offset:-1px;box-sizing:border-box;`;
        if (label) {
          const s = doc.createElement('span');
          s.textContent = label;
          s.style.cssText = `position:absolute;left:0;top:-15px;font:600 11px/14px monospace;color:#000;background:${color};padding:0 3px;white-space:nowrap;`;
          d.appendChild(s);
        }
        root.appendChild(d);
      };
      for (const sh of sf.shapes) box(sh, '#00e5ff', null);
      for (const l of sf.layers) { box(l, '#ff2bd6', l.id + ' ' + l.dz); n++; }
      const old = doc.getElementById('lgs-layers-overlay');
      if (old) old.remove();
      doc.body.appendChild(root);
      setTimeout(() => { try { root.remove(); } catch (_) { /* gone */ } }, ms || 8000);
    }
    return n;
  }

  API = { version: VERSION, start, stop, ping, ack, resend, snapshot, status, debug, rules, overlay, forceDash };
  W[GLOBAL] = API;

  // The daemon sets window.__LGS_LAYERS_OPTS = {layers, binding, ackMode}
  // before evaluating this file: start right away with those rules.
  if (OPTS && OPTS.layers) {
    try { start(OPTS.layers, OPTS); } catch (e) { API.error = String(e && e.message || e); }
  }
  return 'lgs_layers v' + VERSION + (S ? ' running' : waiting ? ' waiting for the token index' : ' installed');
})();
