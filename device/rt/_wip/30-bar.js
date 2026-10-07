// Glass Shell runtime module "bar" (C3a, T2; flag wp.c3a). PLAN §2.4 C3a, CC §3.3.
//
// The unread count on the status pill. Steam shows its bell (%{NotificationsIcon}) in the
// pill only while notifications are unviewed, but never the number. This module writes
// NotificationStore.m_nUnviewedNotifications onto the bell as data-lgs-unread; the theme
// (30-bar.css §1.4) draws the deep-red badge from it with ::after. Numerals only (PLAN §1.15).
//
// It also tags the bar's disc slots (tabs and small buttons, 64 pp pitch) with
// data-lgs-exempt="E-BAR" (PLAN §1.16: bar slots are judged as >= 64 x 72 bar px at a 64 pitch,
// lab.md §6), so the size sweeps apply the bar's own criterion.
//
// Cost: one 1.5 s check while the bar window is visible (a read and a few attribute checks);
// nothing else. Removal: the attributes go with the module (rt.cleanup), so `lgs off` and the
// flag turning off leave the stock bar.
__LGS_RT.define({
  name: 'bar',
  flag: 'wp.c3a',
  install(rt) {
    const ATTR = 'data-lgs-unread';
    const EX = 'data-lgs-exempt';
    const tagged = new Set();
    const exempt = new Set();
    const SLOTS = '%{BarTab}, .VRDashboardBarSmallButton';

    function tagSlots(doc) {
      let sel;
      try { sel = rt.sel(SLOTS); } catch (e) { return; }
      const now = new Set(doc.querySelectorAll(sel));
      for (const el of [...exempt]) {
        if (el.ownerDocument === doc && !now.has(el)) { if (el.getAttribute(EX) === 'E-BAR') el.removeAttribute(EX); exempt.delete(el); }
      }
      for (const el of now) {
        if (el.hasAttribute(EX) && el.getAttribute(EX) !== 'E-BAR') continue;
        if (el.getAttribute(EX) !== 'E-BAR') el.setAttribute(EX, 'E-BAR');
        exempt.add(el);
      }
    }
    function untagSlots(doc) {
      for (const el of [...exempt]) {
        if (doc && el.ownerDocument !== doc) continue;
        if (el.getAttribute && el.getAttribute(EX) === 'E-BAR') el.removeAttribute(EX);
        exempt.delete(el);
      }
    }

    function unviewed() {
      const N = rt.W.NotificationStore;
      const n = N && Number(N.m_nUnviewedNotifications);
      return Number.isFinite(n) && n > 0 ? Math.min(99, Math.floor(n)) : 0;
    }

    function clear(el) {
      if (el && el.removeAttribute) el.removeAttribute(ATTR);
      tagged.delete(el);
    }

    function update(entry) {
      if (!entry || !entry.doc) return;
      tagSlots(entry.doc);
      let sel;
      try { sel = rt.sel('%{NotificationsIcon}'); } catch (e) { return; }
      const bells = entry.doc.querySelectorAll(sel);
      const n = unviewed();
      for (const el of [...tagged]) {
        if (!el.isConnected || el.ownerDocument !== entry.doc) continue;
        if (![...bells].includes(el)) clear(el);
      }
      for (const el of bells) {
        if (n > 0) {
          const v = String(n);
          if (el.getAttribute(ATTR) !== v) el.setAttribute(ATTR, v);
          tagged.add(el);
        } else if (el.hasAttribute(ATTR)) {
          clear(el);
        }
      }
    }

    rt.windows.track((entry) => {
      if (entry.kind !== 'bar') return;
      update(entry);
      const off = rt.setInterval(() => {
        if (entry.visible && !entry.visible()) return;
        update(entry);
      }, 1500);
      return () => {
        off();
        for (const el of [...tagged]) if (el.ownerDocument === entry.doc) clear(el);
        untagSlots(entry.doc);
      };
    });

    rt.cleanup(() => {
      for (const el of [...tagged]) clear(el);
      untagSlots(null);
    });

    return {
      count: unviewed,
      status() { return { tagged: tagged.size, exempt: exempt.size, unviewed: unviewed() }; },
    };
  },
  remove() {
    return {};
  },
});
