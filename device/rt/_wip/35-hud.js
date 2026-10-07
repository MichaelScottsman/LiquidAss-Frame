// Glass Shell runtime module "hud" (C3a, T2; flag wp.c3a). PLAN §2.4 C3a, CC §6, A15.
//
// The volume HUD's number. Steam's VR volume popin shows the level only as the slider
// fill (its track carries --normalized-slider-value inline). This module mirrors
// round(100 x that value) onto the popin as data-lgs-val; 35-hud.css §2 draws it with
// ::after (numerals only, PLAN §1.15). Placement stays Steam's (hudPlacement is not built).
//
// It watches only while the volumelevel window is shown (a MutationObserver on the
// popin's style attributes); removal drops the observer and the attribute.
__LGS_RT.define({
  name: 'hud',
  flag: 'wp.c3a',
  install(rt) {
    const ATTR = 'data-lgs-val';
    const live = new Map(); // doc -> {mo, popin}

    function find(doc) {
      let popSel;
      try { popSel = rt.sel('%{VolumeSliderLabel>VolumePopin}'); } catch (e) { return null; }
      return doc.querySelector(popSel);
    }

    function level(popin) {
      const win = popin.ownerDocument.defaultView;
      const els = [popin, ...popin.querySelectorAll('[style*="--normalized-slider-value"]')];
      for (const el of els) {
        const raw = win.getComputedStyle(el).getPropertyValue('--normalized-slider-value');
        const v = parseFloat(raw);
        if (Number.isFinite(v)) return Math.max(0, Math.min(100, Math.round(v * 100)));
      }
      return null;
    }

    function update(doc) {
      const rec = live.get(doc);
      const popin = find(doc);
      if (rec && rec.popin && rec.popin !== popin) rec.popin.removeAttribute(ATTR);
      if (rec) rec.popin = popin;
      if (!popin) return;
      const v = level(popin);
      if (v == null) { popin.removeAttribute(ATTR); return; }
      const s = String(v);
      if (popin.getAttribute(ATTR) !== s) popin.setAttribute(ATTR, s);
    }

    function stop(doc) {
      const rec = live.get(doc);
      if (!rec) return;
      try { rec.mo.disconnect(); } catch (e) { /* window gone */ }
      if (rec.popin && rec.popin.removeAttribute) rec.popin.removeAttribute(ATTR);
      live.delete(doc);
    }

    function start(entry) {
      if (live.has(entry.doc)) { update(entry.doc); return; }
      const MO = entry.win.MutationObserver;
      let pending = false;
      const mo = new MO(() => {
        if (pending) return;
        pending = true;
        entry.win.requestAnimationFrame(() => { pending = false; if (live.has(entry.doc)) update(entry.doc); });
      });
      mo.observe(entry.doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
      live.set(entry.doc, { mo, popin: null });
      update(entry.doc);
    }

    rt.windows.track((entry) => {
      if (entry.kind !== 'volumelevel') return;
      if (!entry.visible || entry.visible()) start(entry);
      return () => stop(entry.doc);
    });
    rt.windows.onShow((entry) => { if (entry.kind === 'volumelevel') start(entry); });
    rt.windows.onHide((entry) => { if (entry.kind === 'volumelevel') stop(entry.doc); });

    rt.cleanup(() => { for (const doc of [...live.keys()]) stop(doc); });

    return {
      status() { return { watching: live.size }; },
    };
  },
  remove() {
    return {};
  },
});
