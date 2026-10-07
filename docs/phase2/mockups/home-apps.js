/* home-apps mockups: put the Frame's real art and program icons into the page.
 *
 * Data: window.LGS_LIB from ../../refs/library/library.js, written by fetch-library-refs.py (read-only
 * fetch from the Frame; git-ignored because the art is third-party). Without it every element keeps its
 * fallback: a monogram on a neutral gradient, or a glyph, with the same real name. Nothing here invents art.
 *
 * Load order: library.js (optional), home-apps.js, [window-nav-shared.js], kit.js.
 *
 *   <div class="ha-art" data-app="391220"></div>          game circle: hero + logo, else portrait, else monogram
 *   <div class="ha-art" data-app="391220" data-use="port"> portrait crop only
 *   <span class="ha-poster" data-app="735580"></span>       portrait poster (library grid), else title card
 *   <i class="ha-mini" data-app="751630"></i>               3 x 3 folder thumbnail (portrait)
 *   <span class="ha-hero" data-app="391220"></span>         wide hero (card art) + logo
 *   <span class="ha-prog" data-prog="VLC media player"></span> program icon at its real 64 px source, else glyph
 */
(function () {
  const LIB = window.LGS_LIB || null;
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const base = LIB ? LIB.base : '';
  const art = (id) => (LIB && LIB.art[String(id)]) || {};
  const name = (id) => (LIB && LIB.lists && LIB.lists.apps && LIB.lists.apps[String(id)] && LIB.lists.apps[String(id)].name) || '';
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const initials = (s) => {
    const w = s.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
    return ((w[0] || '?')[0] + (w.length > 1 ? w[1][0] : '')).toUpperCase();
  };
  // a stable neutral-ish gradient from the name (stands in for "the icon's average colour")
  const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.codePointAt(0)) % 360; return h; };
  const img = (src, cls, extra = '') => `<img class="${cls}" src="${base}art/${src}" alt="" ${extra}>`;
  const mono = (el, label) => {
    const h = hue(label);
    el.classList.add('is-mono');
    el.style.setProperty('--m1', `hsl(${h} 32% 38%)`); el.style.setProperty('--m2', `hsl(${(h + 30) % 360} 38% 16%)`);
    el.innerHTML = `<span class="mono">${initials(label)}</span>`;
  };

  $$('.ha-art[data-app]').forEach((el) => {
    const a = art(el.dataset.app), label = el.dataset.name || name(el.dataset.app) || '?';
    if (el.dataset.use !== 'port' && a.hero) {
      el.innerHTML = img(a.hero, 'hero', `style="object-position:${el.dataset.pos || '50% 42%'}"`)
        + (a.logo ? img(a.logo, 'logo') : `<span class="logo-txt">${label}</span>`);
    } else if (a.port) {
      el.innerHTML = img(a.port, 'port');
    } else mono(el, label);
  });
  $$('.ha-hero[data-app]').forEach((el) => {
    const a = art(el.dataset.app), label = el.dataset.name || name(el.dataset.app) || '?';
    if (a.hero) el.innerHTML = img(a.hero, 'hero', `style="object-position:${el.dataset.pos || '50% 40%'}"`) + (a.logo ? img(a.logo, 'logo') : '');
    else if (a.header) el.innerHTML = img(a.header, 'hero');
    else mono(el, label);
  });
  $$('.ha-poster[data-app], .ha-mini[data-app]').forEach((el) => {
    const a = art(el.dataset.app), label = el.dataset.name || name(el.dataset.app) || '?';
    if (a.port) el.innerHTML = img(a.port, 'port');
    else if (a.header && el.classList.contains('ha-mini')) el.innerHTML = img(a.header, 'port');
    else if (el.classList.contains('ha-poster')) {           // Steam's own missing-art title card, restyled
      el.classList.add('is-titlecard'); el.innerHTML = `<span class="tc">${label}</span>`;
    } else mono(el, label);
  });
  $$('.ha-prog[data-prog]').forEach((el) => {
    const p = LIB && LIB.programs.find((q) => q.name === el.dataset.prog);
    if (p && p.icon) {
      el.innerHTML = `<img src="${base}icons/${p.slug}.png" alt="" width="${p.icon[0]}" height="${p.icon[1]}">`;
      el.classList.add('has-icon');
    } else {
      // Steam has no icon for it: a category glyph from the name (DESIGN2 §9.3)
      el.innerHTML = `<i data-i="${el.dataset.glyph || 'window'}"></i>`;
      el.classList.add('is-glyph');
    }
  });
  // Word-aware two-line labels (what the T3 launcher renders): break between words only; a word that cannot
  // fit on its line is cut with an ellipsis; a third line is never shown. The full name is on the focus plate.
  const fit = (el) => {
    const cs = getComputedStyle(el), max = parseFloat(el.dataset.fit) || el.clientWidth, lines = +(el.dataset.lines || 2);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const W = (t) => ctx.measureText(t).width;
    // ell: end a line with an ellipsis that fits; cut: shorten one word that is wider than the line
    const ell = (t) => { if (t.endsWith('…')) return t; while (t.length > 1 && W(t + '…') > max) t = t.slice(0, -1); return t.trimEnd() + '…'; };
    const cut = (t) => (W(t) <= max ? t : ell(t));
    // tokens: words, also split after "/" ("Hide/" + "Show"); sp = a space precedes the token
    const words = [];
    el.textContent.trim().split(/\s+/).forEach((w) => w.split(/(?<=\/)/).forEach((t, k) => words.push({ t, sp: k === 0 })));
    const out = [];
    let cur = '', i = 0, cutDone = false;
    for (; i < words.length && out.length < lines; i++) {
      const { t, sp } = words[i], next = cur ? cur + (sp ? ' ' : '') + t : t;
      if (W(next) <= max) { cur = next; continue; }
      if (cur) { out.push(cur); cur = ''; i--; } else { out.push(cut(t)); cutDone = true; i++; break; }  // a cut word ends the label
    }
    if (cur && out.length < lines) { out.push(cur); cur = ''; }
    if (i < words.length || cur || cutDone) out[out.length - 1] = ell(out[out.length - 1]);  // text left over: say so
    el.innerHTML = out.map((l) => `<span>${l}</span>`).join('');
  };
  const fitAll = () => $$('[data-fit]').forEach(fit);
  window.HA_FIT = fitAll;
  document.documentElement.dataset.haLib = LIB ? 'real' : 'fallback';
  window.HA = { LIB, slug };
})();
