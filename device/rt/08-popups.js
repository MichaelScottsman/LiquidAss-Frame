// Liquid Glass Shell runtime module "popups" (P6): the popup wrapper.
//
// Contract: docs/phase2/contracts/reporter.md section 5. Flag: wp.p6 (off by
// default). While installed it wraps Steam's vrPooledPopupStore so the
// ShowDashboardPopup requests of the pooled popups (bar popups, the frame
// menu, tooltips, ...) carry the depth (offset.z_meters), scale and flags the
// popup fragments theme/popups/*.json ask for (SP 3.3, 6.3):
//
//   SendPendingInstanceParamsToSteamVR(inst, params)  every request (first,
//       live update, resize) goes through it; wrapped as an own property of
//       the store, shadowing the prototype's method
//   CreatePooledPopup(type, hookParams, cb)  type 3 (frame menu) only: the
//       "set" fields go into initialHookParams too
//
// Values are absolute (setting z_meters, not adding to it), so re-sending is
// idempotent. Steam's own values are remembered per instance and sent again
// on removal. Restored on remove(), and by itself (TTL) when the runtime that
// installed it is gone or the theme has been off for 3 s. A SharedJSContext
// reload drops the wrapper with the page.
//
// Shown popups follow changes at once: when an entry's flag turns on or off
// (rt.flags.onAny) or the geometry that zMm depends on changes (rt.bridge
// "geom"), the live popups an entry matches, or matched, are re-sent.
//
// Config: the fragments in name order, from P1's loader (rt.data('popups')),
// or window.__LGS_POPUPS (tests). Each: {version, owns, hosts: {name: entry}}.
// The last matching entry in merge order applies to a popup.
//
// API: returned from install (rt.use('popups')) and exposed as
// __LGS_RT.popups (rt.expose) for the lab. No global of its own.
(function lgsPopupsModule() {
  'use strict';
  const W = window;
  const SETTABLE = ['only_visible_with_laser', 'interactive', 'inherit_parent_curvature',
    'inherit_parent_pitch', 'sort_order'];
  const TTL_POLL_MS = 1000;
  const TTL_MISSES = 3;
  const S_DEFAULT = 0.369;   // dashboard scale (SP 1.1) when P8 publishes no geometry

  let S = null; // installed state

  // ------------------------------------------------------------ config

  function readFragments(rt) {
    let f = null;
    try { if (rt && typeof rt.data === 'function') f = rt.data('popups'); } catch (_) { /* no data */ }
    if (!f && rt && rt.data && typeof rt.data === 'object' && rt.data.popups) f = rt.data.popups;
    if (!f && W.__LGS_POPUPS) f = W.__LGS_POPUPS;
    if (typeof f === 'string') f = JSON.parse(f);
    if (f && !Array.isArray(f)) f = [f];
    return Array.isArray(f) ? f.filter((x) => x && typeof x === 'object') : [];
  }

  function resolveSel(sel, errs, where) {
    if (typeof sel !== 'string' || !sel.trim()) return null;
    const idx = W.__LGS_INDEX;
    let bad = false;
    const out = sel.replace(/%\{([^}]+)\}/g, (_, tok) => {
      const r = idx && typeof idx.selector === 'function' ? idx.selector(tok) : { err: 'no token index' };
      if (r.sel) return r.sel;
      errs.push(where + ': %{' + tok.trim() + '} ' + r.err);
      bad = true;
      return '.lgs-unresolved';
    });
    if (bad) return null;
    try { document.createDocumentFragment().querySelector(out); } catch (_) {
      errs.push(where + ': invalid selector');
      return null;
    }
    return out;
  }

  // -> {list: [entry], errors}
  function merge(frags) {
    const errors = [];
    const byName = new Map();
    frags.forEach((fr, i) => {
      const file = String(fr.file || fr.name || 'fragment' + i);
      const owns = Array.isArray(fr.owns) ? fr.owns.map(String) : [];
      const hosts = fr.hosts && typeof fr.hosts === 'object' ? fr.hosts : {};
      for (const name of Object.keys(hosts)) {
        const h = hosts[name];
        if (!h || typeof h !== 'object') { errors.push(file + ': ' + name + ' is not an object'); continue; }
        const prev = byName.get(name);
        if (prev && !owns.includes(name)) {
          errors.push(file + ': ' + name + ' is defined by ' + prev.file + ' (list it in "owns" to change it)');
          continue;
        }
        const e = prev ? Object.assign({}, prev.raw, h) : Object.assign({}, h);
        byName.set(name, { name, file, raw: e, order: prev ? prev.order : byName.size, at: i });
      }
    });
    const list = [];
    for (const v of byName.values()) {
      const e = v.raw;
      const where = v.file + ': ' + v.name;
      const type = Number(e.type);
      if (!Number.isInteger(type)) { errors.push(where + ': needs an integer "type"'); continue; }
      const ent = {
        name: v.name, file: v.file, at: v.at, type,
        keyPrefix: typeof e.keyPrefix === 'string' ? e.keyPrefix : null,
        contentSel: e.contentSel ? resolveSel(e.contentSel, errors, where + '.contentSel') : null,
        match: e.match && typeof e.match === 'object' ? e.match : null,
        flag: typeof e.flag === 'string' ? e.flag : null,
        space: e.space === 'bar' || e.space === 'main' ? e.space : (type === 3 ? 'main' : 'bar'),
        z: Number.isFinite(+e.z) && e.z !== null && e.z !== '' ? +e.z : null,
        zMm: Number.isFinite(+e.zMm) && e.zMm !== null && e.zMm !== '' ? +e.zMm : null,
        scale: +e.scale > 0 ? +e.scale : null,
        set: {},
      };
      if (e.contentSel && !ent.contentSel) continue; // unresolved: never match broadly instead
      if (e.set && typeof e.set === 'object') {
        for (const k of Object.keys(e.set)) {
          if (SETTABLE.includes(k)) ent.set[k] = e.set[k];
          else errors.push(where + ': "' + k + '" cannot be set');
        }
      }
      ent.changes = ent.z !== null || ent.zMm !== null || ent.scale !== null || Object.keys(ent.set).length > 0;
      list.push(ent);
    }
    // merge order: by the fragment that last changed the entry, then definition order
    list.sort((a, b) => (a.at - b.at) || 0);
    return { list, errors };
  }

  // ------------------------------------------------------------ runtime glue

  function flagOn(name) {
    if (!name) return true;
    if (S && S.testFlags && Object.prototype.hasOwnProperty.call(S.testFlags, name)) return !!S.testFlags[name];
    const rt = S && S.rt;
    try {
      if (rt && rt.flags && typeof rt.flags.enabled === 'function') return !!rt.flags.enabled(name);
      if (rt && rt.flags && typeof rt.flags.get === 'function') return !!rt.flags.get(name);
    } catch (_) { /* no flags */ }
    return false;
  }

  function geom() {
    if (S && S.testGeom) return S.testGeom;
    const rt = S && S.rt;
    let g = null;
    try {
      if (rt && rt.bridge && typeof rt.bridge.get === 'function') g = rt.bridge.get('geom');
      else if (rt && rt.bridge && rt.bridge.geom) g = rt.bridge.geom;
    } catch (_) { /* none */ }
    const Sv = g && +g.S > 0 ? +g.S : S_DEFAULT;
    const r = g && +g.r > 0 ? +g.r : 1;
    return { S: Sv, r };
  }

  function themeOn() {
    try { return !!(W.__LGS && W.__LGS.state && W.__LGS.state.enabled); } catch (_) { return true; }
  }

  // ------------------------------------------------------------ matching

  function keyOf(inst) {
    try { return (inst.hostWindow && inst.hostWindow.overlayKey) || ''; } catch (_) { return ''; }
  }

  function prefixOk(key, p) {
    if (!p) return true;
    if (!key) return false;
    if (p.endsWith('.')) return key.startsWith(p);
    return key === p || key.startsWith(p + '.');
  }

  function entryFor(inst, params) {
    if (!S) return null;
    let hit = null;
    for (const e of S.cfg.list) {
      if (e.type !== inst.eHostType) continue;
      if (!prefixOk(keyOf(inst), e.keyPrefix)) continue;
      if (e.flag && !flagOn(e.flag)) continue;
      if (e.match) {
        let ok = true;
        for (const k of Object.keys(e.match)) if (!params || params[k] !== e.match[k]) { ok = false; break; }
        if (!ok) continue;
      }
      if (e.contentSel) {
        let ok = false;
        try { ok = !!(inst.contentElement && inst.contentElement.querySelector(e.contentSel)); } catch (_) { ok = false; }
        if (!ok) continue;
      }
      hit = e; // the last matching entry wins
    }
    return hit && hit.changes ? hit : null;
  }

  function zUnits(e) {
    if (e.z !== null) return e.z;
    if (e.zMm === null) return null;
    const g = geom();
    const unit = e.space === 'main' ? g.S * g.r : g.S;
    return Math.round(e.zMm / (1000 * unit) * 1e5) / 1e5;
  }

  // ------------------------------------------------------------ transform

  function copyOf(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  // Steam's own values of the fields an entry changes, from params that did
  // not come from us (our offset objects are marked).
  function capture(params) {
    const off = params && params.offset;
    const sv = {
      hasOffset: !!off,
      z_meters: off ? off.z_meters : undefined,
      z_pixels: off ? off.z_pixels : undefined,
      scale: copyOf(params ? params.scale : undefined),
      set: {},
    };
    for (const k of SETTABLE) sv.set[k] = params && Object.prototype.hasOwnProperty.call(params, k) ? { v: params[k] } : null;
    return sv;
  }

  function transform(inst, params) {
    if (!S || !params || typeof params !== 'object') return params;
    const e = entryFor(inst, params);
    let rec = S.recs.get(inst);
    const ours = !!(params.offset && S.marks.has(params.offset));
    if (!e) {
      // no longer matched (a flag went off): put Steam's values back
      if (rec && ours) return restored(rec, params);
      return params;
    }
    if (!rec || !ours) {
      const sv = capture(params);
      const hook = S.hooks.get(inst.instanceID);
      if (hook) Object.assign(sv.set, hook.set); // values from before our CreatePooledPopup change
      rec = { inst, saved: sv, entry: e.name, sent: 0 };
      S.recs.set(inst, rec);
    }
    rec.entry = e.name;
    const out = Object.assign({}, params);
    const off = Object.assign({}, params.offset || {});
    const z = zUnits(e);
    if (z !== null) {
      off.z_meters = z;
      off.z_pixels = 0;
    }
    S.marks.add(off);
    out.offset = off;
    if (e.scale !== null) out.scale = { scaler_value: e.scale };
    for (const k of Object.keys(e.set)) out[k] = e.set[k];
    rec.sent++;
    rec.z = z;
    rec.scale = e.scale;
    rec.set = Object.assign({}, e.set);
    S.transforms++;
    return out;
  }

  // params with Steam's own values back in the fields we changed
  function restored(rec, params) {
    const sv = rec.saved;
    const out = Object.assign({}, params);
    if (sv.hasOffset || params.offset) {
      const off = Object.assign({}, params.offset || {});
      if (sv.z_meters === undefined) delete off.z_meters; else off.z_meters = sv.z_meters;
      if (sv.z_pixels === undefined) delete off.z_pixels; else off.z_pixels = sv.z_pixels;
      // Steam sent no offset: none goes back (not an empty one)
      if (!sv.hasOffset && !Object.keys(off).length) delete out.offset;
      else out.offset = off;
    }
    if (sv.scale === undefined) delete out.scale; else out.scale = copyOf(sv.scale);
    for (const k of SETTABLE) {
      const s = sv.set[k];
      if (s) out[k] = s.v; else delete out[k];
    }
    return out;
  }

  // ------------------------------------------------------------ install / remove

  function liveInstances() {
    const st = W.vrPooledPopupStore;
    const out = [];
    try { for (const inst of st.m_mapPooledPopupInstances.values()) out.push(inst); } catch (_) { /* none */ }
    return out;
  }

  function latest(inst) {
    try { return inst.latestParams || null; } catch (_) { return null; }
  }

  // re-send live, shown popups so a change (or its undo) applies now
  function resendLive(onlyChanged) {
    const st = W.vrPooledPopupStore;
    let n = 0;
    for (const inst of liveInstances()) {
      if (inst.state !== 2) continue;
      const lp = latest(inst);
      if (!lp) continue;
      const e = entryFor(inst, lp);
      const rec = S.recs.get(inst);
      if (onlyChanged && !e && !rec) continue;
      try {
        // RecomputePooledPopupSize sends {...latestParams, clip_rect} through the wrapper
        st.RecomputePooledPopupSize(inst.instanceID);
        n++;
      } catch (err) { S.errors.push('resend ' + inst.instanceID + ': ' + String(err).slice(0, 120)); }
    }
    S.resends += n;
    return n;
  }

  function install(rt, opts) {
    if (S) return status();
    opts = opts || {};
    const st = W.vrPooledPopupStore;
    if (!st || typeof st.SendPendingInstanceParamsToSteamVR !== 'function' || typeof st.CreatePooledPopup !== 'function') {
      throw new Error('popups: vrPooledPopupStore not found');
    }
    const frags = opts.fragments || readFragments(rt);
    const cfg = merge(frags);
    S = {
      rt: rt || null, rtGlobal: rt ? W.__LGS_RT : null, store: st, cfg, errors: cfg.errors.slice(),
      testFlags: opts.flags || null, testGeom: opts.geom || null,
      recs: new Map(), marks: new WeakSet(), hooks: new Map(),
      origSend: null, origCreate: null, mySend: null, myCreate: null,
      transforms: 0, resends: 0, restores: 0, misses: 0, offs: [],
      flagResends: 0, geomResends: 0, geomKey: null,
      installedAt: Date.now(), reason: null,
    };
    S.geomKey = (() => { const g = geom(); return g.S + ',' + g.r; })();
    const proto = Object.getPrototypeOf(st);
    const hadOwnSend = Object.prototype.hasOwnProperty.call(st, 'SendPendingInstanceParamsToSteamVR');
    const hadOwnCreate = Object.prototype.hasOwnProperty.call(st, 'CreatePooledPopup');
    S.prevSend = hadOwnSend ? st.SendPendingInstanceParamsToSteamVR : null;
    S.prevCreate = hadOwnCreate ? st.CreatePooledPopup : null;
    S.origSend = st.SendPendingInstanceParamsToSteamVR;
    S.origCreate = st.CreatePooledPopup;
    S.protoSend = proto.SendPendingInstanceParamsToSteamVR;
    const me = S;
    S.mySend = function lgsSendPendingInstanceParamsToSteamVR(inst, params) {
      let p = params;
      if (S === me) {
        try { p = transform(inst, params); } catch (err) { me.errors.push('transform: ' + String(err).slice(0, 160)); p = params; }
      }
      return me.origSend.call(this, inst, p);
    };
    S.myCreate = function lgsCreatePooledPopup(type, hookParams, cb) {
      let hp = hookParams;
      if (S === me && type === 3 && hookParams && typeof hookParams === 'object') {
        try {
          const e = me.cfg.list.filter((x) => x.type === 3 && !x.contentSel && !x.match && (!x.flag || flagOn(x.flag))).pop();
          if (e && Object.keys(e.set).length) {
            const before = {};
            for (const k of Object.keys(e.set)) {
              before[k] = Object.prototype.hasOwnProperty.call(hookParams, k) ? { v: hookParams[k] } : null;
            }
            hp = Object.assign({}, hookParams, e.set);
            const id = me.origCreate.call(this, type, hp, cb);
            if (id !== undefined) me.hooks.set(id, { set: before, orig: hookParams });
            return id;
          }
        } catch (err) { me.errors.push('create: ' + String(err).slice(0, 160)); hp = hookParams; }
      }
      return me.origCreate.call(this, type, hp, cb);
    };
    // marks for a later instance's remove(): a wrapper of ours that is no
    // longer live passes through, so it can be dropped from the chain
    S.mySend.__lgsDead = () => S !== me;
    S.mySend.__lgsPrev = S.prevSend;
    S.myCreate.__lgsDead = () => S !== me;
    S.myCreate.__lgsPrev = S.prevCreate;
    st.SendPendingInstanceParamsToSteamVR = S.mySend;
    st.CreatePooledPopup = S.myCreate;
    resendLive(true);
    // follow flag and geometry changes on popups already shown (re-sending
    // is idempotent; only popups an entry matches or matched are re-sent)
    const sub =(f) => { if (typeof f === 'function') S.offs.push(f); };
    try {
      if (rt && rt.flags && typeof rt.flags.onAny === 'function') sub(rt.flags.onAny((changed) => onFlags(me, changed)));
      if (rt && rt.bridge && typeof rt.bridge.on === 'function') {
        sub(rt.bridge.on('geom', (v, prev, key, changed) => { if (changed !== false) onGeom(me); }));
      }
    } catch (err) { S.errors.push('subscribe: ' + String(err).slice(0, 120)); }
    // the TTL poll: the runtime's timer (cleared on removal) when there is one
    if (rt && typeof rt.setInterval === 'function') sub(rt.setInterval(ttlCheck, TTL_POLL_MS));
    else {
      const id = setInterval(ttlCheck, TTL_POLL_MS);
      sub(() => clearInterval(id));
    }
    return status();
  }

  // an entry's flag changed: re-send the popups it matches now (on) or matched
  // (off: transform() puts Steam's values back)
  function onFlags(me, changed) {
    if (S !== me) return;
    const names = Array.isArray(changed) ? changed : [];
    if (names.length && !S.cfg.list.some((e) => e.flag && names.includes(e.flag))) return;
    S.flagResends++;
    resendLive(true);
  }

  // S or r changed: zMm entries map to other units
  function onGeom(me) {
    if (S !== me) return;
    const g = geom();
    const k = g.S + ',' + g.r;
    if (k === S.geomKey) return;
    S.geomKey = k;
    if (!S.cfg.list.some((e) => e.zMm !== null && e.z === null)) return;
    S.geomResends++;
    resendLive(true);
  }

  function ttlCheck() {
    if (!S) return;
    const rtGone = !!(S.rtGlobal && W.__LGS_RT !== S.rtGlobal);
    const alive = themeOn() && !rtGone;
    S.misses = alive ? 0 : S.misses + 1;
    if (S.misses >= TTL_MISSES) remove('ttl: ' + (rtGone ? 'runtime gone' : 'theme off'));
  }

  function remove(reason) {
    if (!S) return { removed: false };
    const st = S.store;
    const me = S;
    // the TTL timer and the flag/geometry subscriptions (the runtime also
    // undoes them on removal; off() runs once)
    for (const off of me.offs.splice(0)) { try { off(); } catch (_) { /* gone */ } }
    // our methods off the store (someone wrapped over us: keep the chain, but
    // our wrapper passes through from now on because S !== me)
    S = null;
    // skip dead wrappers of earlier instances (a runtime re-injected while
    // an old one was still installed): Steam's prototype method comes back
    const live = (f) => {
      while (f && typeof f.__lgsDead === 'function' && f.__lgsDead()) f = f.__lgsPrev || null;
      return f;
    };
    if (st.SendPendingInstanceParamsToSteamVR === me.mySend) {
      const prev = live(me.prevSend);
      if (prev) st.SendPendingInstanceParamsToSteamVR = prev;
      else delete st.SendPendingInstanceParamsToSteamVR;
    }
    if (st.CreatePooledPopup === me.myCreate) {
      const prev = live(me.prevCreate);
      if (prev) st.CreatePooledPopup = prev;
      else delete st.CreatePooledPopup;
    }
    // Steam's own params back on the popups we changed that are still shown
    let resent = 0;
    for (const [inst, rec] of me.recs) {
      try {
        const h = me.hooks.get(inst.instanceID);
        if (h && h.orig && inst.initialHookParams) inst.initialHookParams = h.orig;
        if (inst.state !== 2 || !me.store.m_mapPooledPopupInstances.has(inst.instanceID)) continue;
        const lp = latest(inst);
        if (!lp) continue;
        const p = restored(rec, lp);
        p.clip_rect = lp.clip_rect;
        const r = me.origSend.call(st, inst, p);
        if (r && typeof r.catch === 'function') r.catch(() => { /* Steam logs it */ });
        resent++;
      } catch (err) { me.errors.push('restore ' + String(err).slice(0, 120)); }
    }
    for (const [id, h] of me.hooks) {
      const inst = me.store.m_mapPooledPopupInstances.get(id);
      if (inst && h.orig && inst.initialHookParams !== h.orig) inst.initialHookParams = h.orig;
    }
    me.restores++;
    me.reason = reason || 'remove()';
    LAST ={ reason: me.reason, at: Date.now(), resent, transforms: me.transforms, errors: me.errors.slice(0, 10) };
    return Object.assign({ removed: true }, LAST);
  }

  let LAST = null;

  function status() {
    if (!S) return { installed: false, last: LAST };
    const st = S.store;
    const live = [];
    for (const inst of liveInstances()) {
      const rec = S.recs.get(inst);
      const lp = latest(inst) || {};
      live.push({
        id: inst.instanceID, type: inst.eHostType, key: keyOf(inst), state: inst.state,
        entry: rec ? rec.entry : null,
        z: lp.offset ? lp.offset.z_meters : undefined,
        scale: lp.scale ? lp.scale.scaler_value : undefined,
        set: rec ? rec.set : null,
      });
    }
    return {
      installed: true, testFragments: !!S.testFrags,
      wrapped: st.SendPendingInstanceParamsToSteamVR === S.mySend && st.CreatePooledPopup === S.myCreate,
      hosts: S.cfg.list.map((e) => ({ name: e.name, file: e.file, type: e.type, z: zUnits(e), scale: e.scale, set: e.set, flag: e.flag, on: !e.flag || flagOn(e.flag), changes: e.changes })),
      live, geom: geom(), transforms: S.transforms, resends: S.resends, misses: S.misses,
      flagResends: S.flagResends, geomResends: S.geomResends, subscriptions: S.offs.length,
      ttl: { pollMs: TTL_POLL_MS, misses: TTL_MISSES }, errors: S.errors.slice(0, 20),
    };
  }

  // apply(): re-read the fragments and re-send the live popups they change
  // (or no longer change). apply(list) uses that list of fragments instead
  // until the next apply() (lab tests, RP-7).
  function apply(frags) {
    if (!S) return status();
    S.cfg = merge(Array.isArray(frags) ? frags.filter((x) => x && typeof x === 'object') : readFragments(S.rt));
    S.testFrags = Array.isArray(frags);
    S.errors = S.cfg.errors.slice();
    resendLive(true);
    return status();
  }

  const API = { status, apply, restore: (reason) => remove(reason || 'restore()') };

  const MOD = {
    name: 'popups', deps: [], flag: 'wp.p6',
    install(rt) {
      install(rt);
      // the lab reaches the API as __LGS_RT.popups (undone on removal)
      if (rt && typeof rt.expose === 'function') {
        try { rt.expose('popups', API); } catch (err) { if (S) S.errors.push('expose: ' + String(err).slice(0, 120)); }
      }
      return API;
    },
    remove() { return remove('remove()'); },
    api: API,
    // lab tests that load this file under a stand-in runtime (RP-7's TTL
    // cases) install it with options: {fragments, flags, geom}
    test: { install, remove, status, apply, merge },
  };

  // load time only defines the module (runtime.md rule 1); without P1's
  // runtime nothing happens
  if (W.__LGS_RT && typeof W.__LGS_RT.define === 'function') W.__LGS_RT.define(MOD);
})();
