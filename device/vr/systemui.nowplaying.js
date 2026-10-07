// @lgs-flag wp.c5b
/* Glass Shell C5b (GP §4.13, GQ7): Now Playing button keys in vr:systemui.
   Writes data-lgs-np="resume|bindings|video|perf|exit" on each action of
   #nowplayingpanel by comparing its label with SteamVR's own localized
   strings (LocalizationManager.LocalizeString), never by position; and
   data-lgs-np-cap (SteamVR's "#Now_Playing") on the info column for the caption.
   A MutationObserver re-applies the keys after every React re-render,
   before the next paint (MutationObserver callbacks run as microtasks).
   theme/vr/20-nowplaying.css paints Exit red only with the key; without
   it every button is neutral. remove() takes everything away. */
(function (ctx) {
  const TOKENS = {
    resume: ['#Return_To_Game', '#Return_To_Home'],
    bindings: ['#VR_Controller_Bindings'],
    video: ['#VR_App_Video_Settings'],
    perf: ['#Clear_PerfCriteria_Status'],
    exit: ['#Exit_Game', '#Exit_Home'],
  };
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const loc = (t) => {
    try {
      const L = window.LocalizationManager;
      const v = L && L.LocalizeString ? L.LocalizeString(t) : null;
      return v && v !== t ? v : null;
    } catch (e) { return null; }
  };
  let table = null;   // label -> key, built lazily (localization may load late)
  let cap = null;
  const build = () => {
    const m = new Map();
    for (const [key, toks] of Object.entries(TOKENS)) for (const t of toks) { const v = loc(t); if (v) m.set(norm(v), key); }
    if (m.size) table = m;
    cap = loc('#Now_Playing');
  };
  let keyed = 0;
  let runs = 0;
  const SEL = '.NowPlaying .InfoColumn > .GamepadUIButton';
  const apply = () => {
    runs++;
    if (!table) build();
    if (!table) return;
    for (const b of document.querySelectorAll(SEL)) {
      const k = table.get(norm(b.textContent)) || null;
      const cur = b.getAttribute('data-lgs-np');
      if (k && cur !== k) { b.setAttribute('data-lgs-np', k); keyed++; }
      else if (!k && cur !== null) b.removeAttribute('data-lgs-np');
    }
    if (cap) for (const t of document.querySelectorAll('.NowPlaying .InfoColumn')) {
      if (t.getAttribute('data-lgs-np-cap') !== cap) t.setAttribute('data-lgs-np-cap', cap);
    }
  };
  // cheap filter: only mutations that touch a Now Playing panel (or add one)
  const touches = (recs) => {
    for (const r of recs) {
      const n = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      if (n && n.closest && n.closest('.NowPlaying')) return true;
      for (const a of r.addedNodes) if (a.nodeType === 1 && (a.matches('.NowPlaying, .GamepadUIButton') || a.querySelector('.NowPlaying'))) return true;
    }
    return false;
  };
  const mo = new MutationObserver((recs) => { if (touches(recs)) apply(); });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  apply();
  return {
    remove() {
      mo.disconnect();
      for (const b of document.querySelectorAll('[data-lgs-np]')) b.removeAttribute('data-lgs-np');
      for (const t of document.querySelectorAll('[data-lgs-np-cap]')) t.removeAttribute('data-lgs-np-cap');
    },
    status() {
      return { ok: true, strings: table ? table.size : 0, cap: !!cap, keyed, runs, buttons: document.querySelectorAll(SEL).length };
    },
    apply,
  };
})
