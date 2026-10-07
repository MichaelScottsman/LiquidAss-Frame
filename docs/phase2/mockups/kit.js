/* Glass Shell Phase 2 mockup kit (docs/phase2/DESIGN2.md §14).
 *
 * Loaded by static HTML mockups next to kit.css. It does five things, all at load time
 * (nothing animates at rest, so a screenshot is deterministic):
 *   1. icons:   <i data-i="home"></i> becomes an inline SVG from the sprite below
 *   2. art:     <div class="lgk-art" data-art="poster:3:Starfall Drift"> gets procedural art
 *   3. lensing: .lgk-glass[data-lens] gets an SVG displacement filter as its backdrop-filter
 *               (the bible's engine, trimmed): bezel refraction + dispersion + frost
 *   4. adapt:   every .lgk-glass samples the room photo under itself and sets --lgk-adapt
 *               (brightness) and --lgk-luma, standing in for glassd's adaptive tint
 *   5. annot:   with #annot in the URL, every [data-dz] element is labelled with its depth
 * When everything is done it sets <html data-lgk-ready="1"> (tools/mockshot.py renders
 * with a 3 s virtual-time budget; this kit finishes in well under 1 s).
 *
 * No third-party art: posters, avatars and program icons are generated from a seed.
 */
(() => {
  'use strict';
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const IS_CHROMIUM = /Chrome\/\d+/.test(navigator.userAgent);

  /* ------------------------------------------------------------------ 1. icons */
  // 24 x 24 grid, drawn for 2 px round strokes (SF Symbols "medium" proportions).
  // s: stroked path, f: filled path, c: circle "cx cy r" (stroked), cf: filled circle.
  const ICONS = {
    'chevron-left': { s: ['M14.5 5.5 8 12l6.5 6.5'] },
    'chevron-right': { s: ['M9.5 5.5 16 12l-6.5 6.5'] },
    'chevron-down': { s: ['M6.5 9.5 12 15l5.5-5.5'] },
    'chevron-up': { s: ['M6.5 14.5 12 9l5.5 5.5'] },
    search: { s: ['M15.6 15.6 20 20'], c: ['10.6 10.6 6.4'] },
    mic: { s: ['M12 3.6c1.6 0 2.9 1.3 2.9 2.9v4.9c0 1.6-1.3 2.9-2.9 2.9s-2.9-1.3-2.9-2.9V6.5c0-1.6 1.3-2.9 2.9-2.9z', 'M5.8 11.2a6.2 6.2 0 0 0 12.4 0', 'M12 17.4v3'] },
    home: { f: ['M3.6 10.6 11.1 4.2a1.4 1.4 0 0 1 1.8 0l7.5 6.4c.3.3.5.7.5 1.1v7.4c0 .8-.7 1.5-1.5 1.5h-4.3v-5.2a1 1 0 0 0-1-1h-4.2a1 1 0 0 0-1 1v5.2H4.6c-.8 0-1.5-.7-1.5-1.5v-7.4c0-.4.2-.8.5-1.1z'] },
    library: { s: ['M5 4.5h3.2v15H5z', 'M10.4 4.5h3.2v15h-3.2z', 'M15.6 5.6l3-.8 3.4 14.1-3 .8z'] },
    store: { s: ['M5.2 8.4h13.6l-1 11.1a1.6 1.6 0 0 1-1.6 1.5H7.8a1.6 1.6 0 0 1-1.6-1.5z', 'M9 8.4V7a3 3 0 0 1 6 0v1.4'] },
    friends: { s: ['M2.8 19.6c.7-3.4 3.2-5.3 6.2-5.3s5.5 1.9 6.2 5.3', 'M15.4 14.2c2.9.1 5 1.9 5.8 5'], c: ['9 8.6 3.4', '16.4 8.4 2.7'] },
    media: { s: ['M6 5h12a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-9A2.5 2.5 0 0 1 6 5z', 'M3.8 16.2l4.8-4.3 4 3.4 2.8-2.3 5 4.1'], c: ['9 9.6 1.5'] },
    download: { s: ['M12 7.4v8.8', 'M8.4 12.7 12 16.3l3.6-3.6'], c: ['12 12 8.6'] },
    gear: { c: ['12 12 2.6'], gear: true },
    vr: { s: ['M3.6 9.6a3 3 0 0 1 3-3h10.8a3 3 0 0 1 3 3v3.1a3.4 3.4 0 0 1-3.4 3.4c-1.4 0-2.4-.8-3-2l-.5-1a1.7 1.7 0 0 0-3 0l-.5 1c-.6 1.2-1.6 2-3 2a3.4 3.4 0 0 1-3.4-3.4z'] },
    power: { s: ['M12 3.6v8', 'M7 6.4a7.4 7.4 0 1 0 10 0'] },
    plus: { s: ['M12 5.2v13.6', 'M5.2 12h13.6'] },
    more: { cf: ['6 12 1.85', '12 12 1.85', '18 12 1.85'] },
    sort: { s: ['M8 18.5V5.5', 'M4.6 8.9 8 5.5l3.4 3.4', 'M16 5.5v13', 'M12.6 15.1 16 18.5l3.4-3.4'] },
    filter: { s: ['M4 7h16', 'M7 12h10', 'M10 17h4'] },
    play: { f: ['M8 5.3c0-.8.9-1.3 1.6-.9l9.6 6.1c.6.4.6 1.3 0 1.7l-9.6 6.1c-.7.4-1.6-.1-1.6-.9z'] },
    keyboard: { s: ['M5.5 6h13A2.5 2.5 0 0 1 21 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5.5 6z', 'M8 14.5h8'], cf: ['7.5 10.2 1', '10.5 10.2 1', '13.5 10.2 1', '16.5 10.2 1'] },
    float: { s: ['M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z', 'M10 14l5.4-5.4', 'M10.6 8.4h5v5'] },
    theater: { s: ['M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5z', 'M9 20.5h6'] },
    check: { s: ['M5.4 12.6l4.2 4.2L18.8 7.2'] },
    xmark: { s: ['M6.6 6.6l10.8 10.8', 'M17.4 6.6 6.6 17.4'] },
    speaker: { f: ['M4.4 9.2h3l4.3-3.9c.5-.5 1.3-.1 1.3.6v12.2c0 .7-.8 1.1-1.3.6l-4.3-3.9h-3c-.5 0-.9-.4-.9-.9V10.1c0-.5.4-.9.9-.9z'], s: ['M16 9.2a4.2 4.2 0 0 1 0 5.6', 'M18.6 6.6a8 8 0 0 1 0 10.8'] },
    wifi: { s: ['M3 9.3a12.8 12.8 0 0 1 18 0', 'M6.1 12.4a8.4 8.4 0 0 1 11.8 0', 'M9.2 15.5a4 4 0 0 1 5.6 0'], cf: ['12 18.9 1.3'] },
    bluetooth: { s: ['M7.4 8 16.4 16l-4.4 4V4l4.4 4-9 8'] },
    bell: { s: ['M6.2 16.6V11a5.8 5.8 0 0 1 11.6 0v5.6l1.4 1.8H4.8z', 'M10 20.6a2 2 0 0 0 4 0'] },
    controller: { s: ['M7.6 7.8h8.8a4.6 4.6 0 0 1 4.5 5.5l-.6 3.1a2.7 2.7 0 0 1-4.7 1.3l-1.4-1.6H9.8l-1.4 1.6a2.7 2.7 0 0 1-4.7-1.3l-.6-3.1a4.6 4.6 0 0 1 4.5-5.5z', 'M8.2 10.9v3.2', 'M6.6 12.5h3.2'], cf: ['15.6 11.2 1', '17.4 13.4 1'] },
    grid: { s: ['M5.5 4.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z', 'M14.5 4.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z', 'M5.5 13.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z', 'M14.5 13.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z'] },
    recenter: { s: ['M12 2.8v3.4', 'M12 17.8v3.4', 'M2.8 12h3.4', 'M17.8 12h3.4'], c: ['12 12 6.2'], cf: ['12 12 1.6'] },
    person: { s: ['M4.6 20.2c1-3.9 4-5.9 7.4-5.9s6.4 2 7.4 5.9'], c: ['12 8.6 3.8'] },
    star: { f: ['M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z'] },
    trash: { s: ['M4.8 6.8h14.4', 'M9.6 6.6V5.2c0-.6.5-1 1-1h2.8c.6 0 1 .4 1 1v1.4', 'M6.4 6.8l.9 12.3c.1.9.8 1.6 1.7 1.6h6c.9 0 1.6-.7 1.7-1.6l.9-12.3'] },
    share: { s: ['M12 3.8v11', 'M8.3 7.4 12 3.8l3.7 3.6', 'M8 10.4H6.6A1.6 1.6 0 0 0 5 12v6.4c0 .9.7 1.6 1.6 1.6h10.8c.9 0 1.6-.7 1.6-1.6V12c0-.9-.7-1.6-1.6-1.6H16'] },
    clock: { s: ['M12 7.4V12l3.2 2'], c: ['12 12 8.4'] },
    cloud: { s: ['M7.4 18.2a4.2 4.2 0 0 1-.6-8.4 5.6 5.6 0 0 1 10.8 1.2 3.6 3.6 0 0 1-.4 7.2z'] },
    pencil: { s: ['M15.8 4.6l3.6 3.6L8.6 19H5v-3.6z', 'M13.4 7l3.6 3.6'] },
    window: { s: ['M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z', 'M3.5 9h17'] },
    terminal: { s: ['M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z', 'M7.4 9.4l2.6 2.6-2.6 2.6', 'M12.4 15h4.2'] },
    sparkle: { f: ['M12 3.4c.5 3.9 2.7 6.1 6.6 6.6-3.9.5-6.1 2.7-6.6 6.6-.5-3.9-2.7-6.1-6.6-6.6 3.9-.5 6.1-2.7 6.6-6.6z', 'M18.4 14.6c.2 1.7 1.2 2.7 2.9 2.9-1.7.2-2.7 1.2-2.9 2.9-.2-1.7-1.2-2.7-2.9-2.9 1.7-.2 2.7-1.2 2.9-2.9z'] },
    moon: { f: ['M14.8 3.6a8.6 8.6 0 1 0 5.6 13.6A7.4 7.4 0 0 1 14.8 3.6z'] },
    sun: { s: ['M12 2.6v2', 'M12 19.4v2', 'M2.6 12h2', 'M19.4 12h2', 'M5.4 5.4l1.4 1.4', 'M17.2 17.2l1.4 1.4', 'M5.4 18.6l1.4-1.4', 'M17.2 6.8l1.4-1.4'], c: ['12 12 4.2'] },
    airplane: { f: ['M10.6 3.8c0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4v5.3l7 4.2v1.9l-7-2.1v4.4l2.2 1.6v1.6L12 19.9l-3.6 1v-1.6l2.2-1.6v-4.4l-7 2.1v-1.9l7-4.2z'] },
    room: { s: ['M3.6 10.4 12 4l8.4 6.4', 'M5.8 9v10.4h12.4V9'], c: ['12 14.6 2.4'] },
  };
  function iconSVG(name, cls) {
    const d = ICONS[name];
    if (!d) return `<svg class="lgk-i ${cls || ''}" viewBox="0 0 24 24"><title>${name}?</title><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 3"/></svg>`;
    let out = '';
    (d.s || []).forEach(p => { out += `<path d="${p}" fill="none" stroke="currentColor"/>`; });
    (d.f || []).forEach(p => { out += `<path d="${p}" fill="currentColor"/>`; });
    (d.c || []).forEach(c => { const [x, y, r] = c.split(' '); out += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="currentColor"/>`; });
    (d.cf || []).forEach(c => { const [x, y, r] = c.split(' '); out += `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor"/>`; });
    if (d.gear) {
      // eight rounded teeth + ring, as one stroked outline
      let p = '';
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2 - Math.PI / 8, a1 = a0 + Math.PI / 8 * 0.62, a2 = a0 + Math.PI / 8 * 1.38, a3 = a0 + Math.PI / 4;
        const P = (a, r) => `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`;
        p += (i === 0 ? 'M' : 'L') + P(a0, 6.9) + 'L' + P(a1, 6.9) + 'L' + P(a1 + 0.08, 9.0) + 'L' + P(a2 - 0.08, 9.0) + 'L' + P(a2, 6.9) + 'L' + P(a3, 6.9);
      }
      out += `<path d="${p}Z" fill="none" stroke="currentColor" stroke-linejoin="round"/>`;
    }
    return `<svg class="lgk-i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${out}</svg>`;
  }
  function renderIcons() {
    $$('i[data-i]').forEach(el => {
      const tmp = document.createElement('span');
      tmp.innerHTML = iconSVG(el.dataset.i, el.className);
      const svg = tmp.firstChild;
      if (el.style.cssText) svg.style.cssText = el.style.cssText;
      el.replaceWith(svg);
    });
  }

  /* -------------------------------------------------------------- 2. procedural art */
  const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const PALETTES = [
    ['#0b1240', '#3b2a8f', '#ff6f91', '#ffc75f'],   // dusk
    ['#03201c', '#0f5e4f', '#64d6a6', '#e9ffb0'],   // forest
    ['#1a0633', '#5b0f87', '#ff3cac', '#784ba0'],   // neon
    ['#06131f', '#0e4a6b', '#2fb7e6', '#d6f6ff'],   // ocean
    ['#2b0a0a', '#7a1e12', '#ff7b39', '#ffd36e'],   // ember
    ['#0e0e10', '#33363d', '#9aa4b2', '#f0f3f7'],   // steel
    ['#14072b', '#2d1a6b', '#8a6cff', '#c9b8ff'],   // violet
    ['#1d1405', '#5c4210', '#e0a530', '#fff1c2'],   // amber
    ['#02121f', '#06395c', '#00c2a8', '#a6fff2'],   // teal
    ['#200b18', '#6b1d3f', '#ff8fab', '#ffe5ec'],   // rose
  ];
  function paintPoster(ctx, w, h, seed, title, kind) {
    const r = rng(seed * 7919 + 17), pal = PALETTES[seed % PALETTES.length];
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, pal[0]); g.addColorStop(0.55, pal[1]); g.addColorStop(1, pal[0]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const motif = seed % 5;
    const sx = w * (0.3 + r() * 0.4), sy = h * (0.25 + r() * 0.15), sr = w * (0.18 + r() * 0.12);
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
    glow.addColorStop(0, pal[3]); glow.addColorStop(0.18, pal[2]); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.9; ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
    if (motif === 0 || motif === 3) {           // sun disc
      ctx.fillStyle = pal[3]; ctx.beginPath(); ctx.arc(sx, sy, sr * 0.62, 0, Math.PI * 2); ctx.fill();
    }
    if (motif === 1) {                          // planet with a ring
      ctx.fillStyle = pal[2]; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = pal[3]; ctx.lineWidth = w * 0.018; ctx.beginPath(); ctx.ellipse(sx, sy, sr * 1.8, sr * 0.45, -0.35, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(255,255,255,${(r() * 0.6).toFixed(2)})`; ctx.fillRect(r() * w, r() * h * 0.5, 2, 2); }
    // layered ridges
    const layers = 3 + (seed % 2);
    for (let L = 0; L < layers; L++) {
      const base = 0.52 + L * 0.1, amp = 0.09 - L * 0.012;
      const p = [r() * 6, r() * 6, r() * 6];
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) {
        const u = x / w;
        const n = motif === 2 ? Math.abs(Math.sin(u * 7 + p[0])) * 0.9 - 0.3 : 0.5 * Math.sin(u * 4.1 + p[0]) + 0.3 * Math.sin(u * 9.7 + p[1]) + 0.15 * Math.sin(u * 23 + p[2]);
        ctx.lineTo(x, h * (base - amp * n));
      }
      ctx.lineTo(w, h); ctx.closePath();
      const t = L / layers;
      ctx.fillStyle = mix(pal[1], pal[0], 0.35 + t * 0.6); ctx.fill();
    }
    if (motif === 4) {                          // perspective grid floor
      ctx.strokeStyle = hexA(pal[2], 0.55); ctx.lineWidth = 2;
      const hy = h * 0.72;
      for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.02, hy); ctx.lineTo(w / 2 + i * w * 0.16, h); ctx.stroke(); }
      for (let k = 0; k < 9; k++) { const y = hy + Math.pow(k / 8, 1.8) * (h - hy); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }
    // vignette
    const v = ctx.createLinearGradient(0, h * 0.55, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    if (title && kind !== 'hero-clean') {
      // the "logo": the game's name set large in the display cut
      const words = title.split(' ');
      const lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : words;
      let fs = Math.round(w * 0.16);
      ctx.font = `800 ${fs}px "LGS Inter", system-ui, sans-serif`;
      const widest = Math.max(...lines.map(l => ctx.measureText(l.toUpperCase()).width));
      if (widest > w * 0.84) { fs = Math.floor(fs * (w * 0.84) / widest); ctx.font = `800 ${fs}px "LGS Inter", system-ui, sans-serif`; }
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = fs * 0.25; ctx.shadowOffsetY = fs * 0.06;
      ctx.fillStyle = '#fff';
      const y0 = kind === 'hero' ? h * 0.62 : h * 0.86 - (lines.length - 1) * fs * 0.95;
      lines.forEach((ln, i) => ctx.fillText(ln.toUpperCase(), w / 2, y0 + i * fs * 0.95));
      ctx.shadowColor = 'transparent';
    }
  }
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  function hexA(a, al) { const p = parseInt(a.slice(1), 16); return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${al})`; }
  function paintAvatar(ctx, w, h, seed, initials) {
    const pal = PALETTES[seed % PALETTES.length];
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, pal[2]); g.addColorStop(1, pal[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.font = `700 ${Math.round(w * 0.42)}px "LGS Inter", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(initials || '?', w / 2, h / 2 + w * 0.02);
  }
  function paintProgram(ctx, w, h, seed, glyph) {
    // a program icon: soft gradient tile + white glyph (stands in for an app's own icon)
    const pal = PALETTES[seed % PALETTES.length];
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, pal[2]); g.addColorStop(1, pal[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const img = new Image();
    return new Promise(res => {
      const svg = iconSVG(glyph || 'sparkle').replace('<svg ', `<svg xmlns="${SVGNS}" width="${w * 0.5}" height="${h * 0.5}" style="color:#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" `).replace(/currentColor/g, '#fff');
      img.onload = () => { ctx.drawImage(img, w * 0.25, h * 0.25, w * 0.5, h * 0.5); res(); };
      img.onerror = () => res();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  async function renderArt() {
    const jobs = $$('.lgk-art[data-art]').map(async el => {
      const [kind, seedS, ...rest] = el.dataset.art.split(':');
      const label = rest.join(':');
      const seed = parseInt(seedS, 10) || 0;
      const W = { poster: 600, hero: 1600, avatar: 256, program: 256, square: 512, 'hero-clean': 1600 }[kind] || 512;
      const H = { poster: 900, hero: 900, avatar: 256, program: 256, square: 512, 'hero-clean': 900 }[kind] || 512;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      if (kind === 'avatar') paintAvatar(ctx, W, H, seed, label);
      else if (kind === 'program') await paintProgram(ctx, W, H, seed, label);
      else paintPoster(ctx, W, H, seed, label, kind);
      el.style.backgroundImage = `url(${c.toDataURL('image/jpeg', 0.9)})`;
    });
    await Promise.all(jobs);
  }

  /* -------------------------------------------------------------- 3. lensing engine */
  // Lens band profile. The bible's physically based squircle + Snell curve puts almost all
  // of the shift in the outer 15 % of the bezel (a 2-3 px rim at UI sizes). Liquid Glass
  // shows a wider band where content visibly bends (DESIGN2 §6.2 cue E2: 6-16 px), so the
  // kit blends that curve with a smooth (1 - t)^1.7 falloff; the peak stays at the rim.
  const squircle = t => Math.pow(1 - Math.pow(1 - t, 4), 0.25);
  const CURVE = (() => {
    const n = 128, snell = new Float32Array(n), out = new Float32Array(n), e = 1e-3, IOR = 1.5; let max = 0;
    for (let i = 0; i < n; i++) {
      const t = Math.min(1 - e, Math.max(e, i / (n - 1)));
      const slope = (squircle(Math.min(1, t + e)) - squircle(Math.max(0, t - e))) / (2 * e);
      const th1 = Math.atan(slope * 0.5), th2 = Math.asin(Math.sin(th1) / IOR);
      snell[i] = Math.tan(th1 - th2); max = Math.max(max, Math.abs(snell[i]));
    }
    for (let i = 0; i < n; i++) { const t = i / (n - 1); out[i] = 0.35 * snell[i] / max + 0.65 * Math.pow(1 - t, 1.7); }
    return out;
  })();
  function buildMap(W, H, R, B) {
    // Encode the inward sample offset in R (x) and G (y); 128 = no shift.
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    const hx = W / 2, hy = H / 2; R = Math.max(0, Math.min(R, hx, hy));
    const bx = hx - R, by = hy - R, n = CURVE.length - 1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x + 0.5 - hx, py = y + 0.5 - hy, qx = Math.abs(px) - bx, qy = Math.abs(py) - by;
        let dist, nx, ny;
        if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); dist = R - l; nx = qx / l; ny = qy / l; }
        else if (qx > qy) { dist = R - qx; nx = 1; ny = 0; }
        else { dist = R - qy; nx = 0; ny = 1; }
        nx *= px < 0 ? -1 : 1; ny *= py < 0 ? -1 : 1;
        let r = 128, g = 128;
        if (dist > 0 && dist < B) {
          const f = (dist / B) * n, i0 = Math.floor(f), i1 = Math.min(n, i0 + 1), m = CURVE[i0] + (CURVE[i1] - CURVE[i0]) * (f - i0);
          r = 128 - nx * m * 127; g = 128 - ny * m * 127;
        }
        const k = (y * W + x) * 4; d[k] = r; d[k + 1] = g; d[k + 2] = 128; d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }
  // Material presets for the mockup (DESIGN2 §6.3; bezel/refraction in CSS px of the page).
  // frost = feGaussianBlur stdDeviation; refr = displacement scale; disp = dispersion share.
  const LENS = {
    liquid: { bezel: 18, refr: 34, disp: 0.30, frost: 8, sat: 1.8 },
    panel: { bezel: 16, refr: 22, disp: 0.20, frost: 11, sat: 1.6 },
    thick: { bezel: 16, refr: 18, disp: 0.15, frost: 15, sat: 1.5 },
    clear: { bezel: 20, refr: 44, disp: 0.35, frost: 2, sat: 1.4 },
  };
  let defs = null, nLens = 0;
  function svgEl(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function ensureDefs() {
    if (defs) return defs;
    const svg = svgEl('svg', { width: 0, height: 0, style: 'position:absolute;width:0;height:0', 'aria-hidden': 'true' });
    defs = svgEl('defs', {}); svg.append(defs); document.body.prepend(svg);
    return defs;
  }
  function applyLens(el) {
    const mat = el.dataset.lens || el.dataset.mat || 'liquid';
    const p = Object.assign({}, LENS[mat] || LENS.liquid);
    ['bezel', 'refr', 'frost', 'sat', 'disp'].forEach(k => { if (el.dataset['lens' + k[0].toUpperCase() + k.slice(1)]) p[k] = parseFloat(el.dataset['lens' + k[0].toUpperCase() + k.slice(1)]); });
    const W = Math.round(el.offsetWidth), H = Math.round(el.offsetHeight);
    if (!W || !H) return;
    const R = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const B = Math.min(p.bezel, W / 2, H / 2);
    const id = 'lgk-lens-' + (++nLens);
    const f = svgEl('filter', { id, x: 0, y: 0, width: W, height: H, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
    f.append(svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: p.frost, edgeMode: 'duplicate', result: 'b' }));
    f.append(svgEl('feImage', { x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'none', result: 'm', href: buildMap(W, H, R, B) }));
    ['R', 'G', 'B'].forEach((ch, i) => {
      const s = p.refr * (i === 0 ? 1 + p.disp : i === 2 ? 1 - p.disp : 1);
      f.append(svgEl('feDisplacementMap', { in: 'b', in2: 'm', scale: s.toFixed(2), xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + ch }));
      const row = [0, 0, 0]; row[i] = 1;
      f.append(svgEl('feColorMatrix', { in: 'd' + ch, type: 'matrix', result: 'c' + ch, values: `${row[0]} 0 0 0 0  0 ${row[1]} 0 0 0  0 0 ${row[2]} 0 0  0 0 0 1 0` }));
    });
    f.append(svgEl('feComposite', { in: 'cR', in2: 'cG', operator: 'arithmetic', k1: 0, k2: 1, k3: 1, k4: 0, result: 'rg' }));
    f.append(svgEl('feComposite', { in: 'rg', in2: 'cB', operator: 'arithmetic', k1: 0, k2: 1, k3: 1, k4: 0, result: 'rgb' }));
    f.append(svgEl('feColorMatrix', { in: 'rgb', type: 'saturate', values: p.sat }));
    ensureDefs().append(f);
    // CSS appends the adaptation (brightness/contrast from --lgk-adapt) after the url()
    el.style.setProperty('--lgk-lens', `url(#${id})`);
    el.classList.add('lgk-lensed');
  }

  /* -------------------------------------------------------------- 4. room adaptation */
  // glassd adapts the glass to the room's luminance behind it (NATIVE/glassd README:
  // darker and stronger tint over bright rooms, lighter over dark ones). The mockup does
  // the same from the room photo: mean luma under the element -> brightness factor that
  // pulls the frosted room into the visionOS band (refs: L 55-110 of 255).
  // Luma grids (96 x 54, Rec.709 luma of the sRGB pixels, 0-255) of the room photos, so no
  // canvas read of a file:// image is needed (Chrome taints those). Regenerate if a photo
  // changes: PIL resize((96, 54), BOX) -> uint8 -> base64.
  const ROOM_LUMA = {
    lounge: 'eXl6ent7e3x9fX5+fn9+fn5/f39+fX59fHp5eHuCiI6RkpORkI2LiIiJjY+QkpOSkpiQkI+PjoyLiomIh4WEgoKBgH9+fICKkY1/e31+f4CAgIB/fomJiIeHhoaFhYWEdnd4eXh5eXp6fH19fn5+fn5+fn+Af4B/f35+fXx6eHh7gIaNj5COjYuHhIKDhoiKkIyNjIuLi4mHh4aFg4GAgH9+fXx8g4yOgXt9f3+AgYGBgYCAf4iIiIeHhoWFhIWFKjlIWGdydnd4eXl6e3x9fX5+fn5/gYGBgYCAgIB/fn17eXd2eX2Cio2MioeEgH1/gICCg4WFhISDgoGBf359fXx7eX2Hi4J6fH6AgYGCgoKCgoKBgImJh4eHhoSEhYWFTS8rJB8iMD9OXWx2eHl7e3t9fX1+f3+AgIGBgYKBgYB/fn18end1c3V6goeJh4WBe3h2d3h7fH18fHp5eXh4eHZ3gIqEd3l9gIKDg4ODg4ODg4KCgYmIh4eGhYSEhYSEZlxqa1FSWD0yHSAmNUZWZnV8fH5+fn5/f3+AgIGBgYGBgH5+fXx6d3Z0c3ByeHyAgX98d3RycnJzdHR1dHNzcneChHh1eX2AgoOEhISEhISDg4KCgoiIh4aGhYSEhYWEYltgXW5hd2pmSk1DMCUiJCQsPE5icXx+f39/f39/f4CBgH9/fn19fHp5eHVzcnBsbXF2enx6d3Rwa2tra2tueYB4cXV5fYCChIWFhYWFhYWEg4OCgoiHhoaGhYWEhH5wY19xXHNUbF9ob5mSepB7Z1BOQzQuKys4SVppeH5+f39/f39/fn5/fXt7eXd2dXNxcG1qaGhtc3d4dnFrZ2p0dW5wdHd8f4KFhoaGhoaGhYWFhYSDhIiHh4aFhYRyamNtXVhoYmdkZGJrf4aBiKGMh2NmZ2xqZFtRRDQqKC09Tl5te35+fX19fHp6eHd3dnRzc3BvbWtpZ2dmaGttcG1mam9ydnp+gYOGh4eHh4eHhoeFhYWEhIiIh4aEhX5dcZSYYGFmYGdpVmRqf4aFkI5+h3N1dnRycW1sa21rY1xRRTgtKzRCUmJwent5d3Z1dHR0dHJwb25ta2ppZ2VgW2BmbXJ0d3x/goWHh4eHh4eHh4eHhoWFhYiIh4aEg3xbe5mXbVtlZGNhXHdrg46WmZiNk3x9f39+fnx7e3h1cW5sa2xsZF1TRzsvKzRDUmBtcnJzc3JwcG5vbmxqaWZiXmJob3N2eX2Bg4aHiIiIiIiJiIeHhoWFhYaHhoaEhHpdfJmWcGNiaFpXbXVllaCkq6ylpIqFhoSFhYSCgoGAf358enh1cnBtbGtsY1pROCwiJzZFVGJtcG9vbm1ramhkYWRpcHN3eX6BhIaIiYqJiYiJiIiHhoaFhoWGhoSCgnddfpiVbGZeaGBhbWVhqay0vrnCw7KkmpGLiomHhoaFhIOCgoKBf359fHp5dHKKjoF/al1URTcwJEZwb25ta2llY2VqcHR3en+ChIeJioqKiYiJiIeHhoWGhYaFhoaDhHZdf5iVaWNXaWdwa3VovLi6vb29vaOVlZikqKutqKCYj4eEhYWFhIWEg4KCgICJmIB/cWJmYGJfRlpwcG5vbGpmZGVqcXR3e3+ChYeKjIuKiYiIh4iIh4aGhoeGhoaDg3VhgpiVZmdcaGFxcY14z8fI29HS1sevkmfDwq+dk4uGh5KZoKWoopyTi4mJiImUopGKc2JfXlpcY2xvcG9ubWpmZWZqcXV4e3+DhoiLjIuKiYmIiIiHh4eHhoiFhoWCgnNig5eUbXVfYl91b4yB2dLS497i9Pj/7HHk/v7+//7pzbytqJqLhoWQm5+iqK6ztK+ni21da1ZZam5wcG9ubWpmZWZqcHR3e4CDhomMjIuKiomJiImIiIeHhoeFhIKBgHFlhZeTcYFZX192bIyY29zV4uPl7fX57nDY9vf6+/zw2NfS0Ojl2+Xl7ePOfGmbw8O/oWlpa2NebG9wb29ubWpmZWdqcXR3fICEh4mMjYyMi4uKiYmJiIiGhYWFg4KCgXBrhpaUbGhUX1xxaoio2uLZ4urq6e/s4HTG4drj4/Hh3tvh4eLMxdjl6/jzjs/p3N/YxHRgZGNZbG9vcG9ubWpmZmdqcHR4fICDh4qMjY2NjIyKiomIiIeHhYWEgoKCgXBsh5aSZlRRWUlxa3+u1ePh4/Lv8e/j5IC72s/Z39/WzdDf4czKwszd3Ovsktjy5e7r6YBkYGRWaG5vb25tbGpnZmdqcHR4eoCDh4qNjo6NjIuKiYiIiIiIhoSBgYKCgXBtipWSZXFZUUFzcXWxz97e4uvw7+3Av4HE7OXo5+fi4+bez8O8vM7Pzd3mk9rw5urq7YVoXmVZaG5ub21sa2pnZ2dpb3R2eX+Dh4qN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',
    studio: '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TU1PUVNVVUkcCxkitKxPdGklISMjJScUDTAoIj1eZmRiYl5aWl5eX2FfX19dW2BfYmVmZ21tbGlsbHBsbG1rZ2ViYF9fXlxbXFxbWVpZVVVVVVNSUU9QUVJTVVZVUlJSUlFSSi41LyAbFhEcsapPV0cxMyUjGhEPIDorNERrbHBxcGtoa2tpaGhmZWVlZmlpa25sbnJzcnJycnJvbW1qZ2ZjY2FhYWBeXmBdXFtaWlhYWFVVUlJTU1RTVVRVVVRUVVVSKR4YFBMYFhQPr6dPPUhGNCwjHhMYPTsvQ2RucXV2dW5uc3Jwbm5ub21vb3JxdXZzc3V2dnZ2dHJxb25saWdmZGNjZGNiYmJgYF5dXFtaWlpXV1dWVlhWV1ZWVlZWV1dNIxwZHBYSHBUXrYtMUUpCLiwqLC4rNDtQZ29xdnd4dXFzd3Z1dnV1dXV0dHd2ent4eHl7eXp5eHZyb25uamtqaWpoaWdmZWZkZGJjY2BfX1xcW1tbXF1cW1pZWVpbXFxZUElCMyUgKCwcpUkxMjw8QTw6OSgoQV1xcnN3e31+eXd7fX19f3l7eXh4eH19fn97eHt7ent5d3R0cHBwbm9ubW1rampqaGdoZmRlY2RiYmBfXl5fX15fYF5dW1pbXFxdXFdRTkg3LisojTcsPDEtJ1RSQUQ4W2x0dXmAgYOAfX2BgYB/fn1/fH19foKCg4N/fHx6eXp5eHZzcW9xcHFycXFvbm1sbGloaGdnZmZmZ2NjY2BgZGNjY2NgX15dYGBbXV5bU09PTUpJdzlBPUYsGlFqck9iW3N5e4CGh4iDgIKEgoCBgoKBfoCBgoSFhIWCf4B+fXt6e3p5e3RxcXJzdHN0cHBvcG1sbGpramlra2hnaGhlaGlpZ2hnY2FhYGJjYV5dWFFOTE1K',
  };
  const GW = 96, GH = 54;
  let room = null;
  function loadRoom(view) {
    const name = view.dataset.room || 'lounge';
    const b64 = ROOM_LUMA[name] || ROOM_LUMA.lounge;
    const bin = atob(b64), g = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) g[i] = bin.charCodeAt(i);
    const dim = parseFloat(getComputedStyle(view).getPropertyValue('--lgk-room-dim')) || 1;
    room = { view, g, dim };
  }
  function sampleRoom(rect) {
    if (!room) return null;
    const vr = room.view.getBoundingClientRect();
    const k = Math.max(vr.width / GW, vr.height / GH);   // background-size: cover
    const ox = (vr.width - GW * k) / 2, oy = (vr.height - GH * k) / 2;
    const x0 = Math.max(0, Math.floor((rect.left - vr.left - ox) / k)), y0 = Math.max(0, Math.floor((rect.top - vr.top - oy) / k));
    const x1 = Math.min(GW, Math.ceil((rect.right - vr.left - ox) / k)), y1 = Math.min(GH, Math.ceil((rect.bottom - vr.top - oy) / k));
    let s = 0, n = 0;
    for (let y = y0; y < Math.max(y0 + 1, y1); y++) for (let x = x0; x < Math.max(x0 + 1, x1); x++) { s += room.g[Math.min(GH - 1, y) * GW + Math.min(GW - 1, x)]; n++; }
    return (s / Math.max(1, n) / 255) * room.dim;
  }
  function adapt(el) {
    const L = sampleRoom(el.getBoundingClientRect());
    if (L == null) return;
    // The CSS chain is blur -> saturate -> contrast(c) -> brightness(k). contrast pulls the room
    // toward mid grey (dark rooms lift, bright rooms drop); k then lands the mean on the
    // material's target luma, clamped like glassd's tint range (x0.42 .. x1.6).
    const cs = getComputedStyle(el);
    const target = parseFloat(cs.getPropertyValue('--lgk-target-luma')) || 0.30;
    const c = parseFloat(cs.getPropertyValue('--lgk-contrast')) || 1;
    const Lc = c * (L - 0.5) + 0.5;
    const k = Math.max(0.42, Math.min(1.6, target / Math.max(0.05, Lc)));
    el.style.setProperty('--lgk-adapt', k.toFixed(3));
    el.style.setProperty('--lgk-luma', L.toFixed(3));
    el.dataset.luma = Math.round(L * 255);
  }
  function geometry() {
    $$('[data-dz]').forEach(el => { if (!el.style.getPropertyValue('--dz')) el.style.setProperty('--dz', el.dataset.dz); });
    $$('.lgk-btn').forEach(el => el.style.setProperty('--maxside', Math.max(el.offsetWidth, el.offsetHeight)));
  }

  /* -------------------------------------------------------------- 5. annotations */
  function annotate() {
    if (!/annot/.test(location.hash + location.search)) return;
    $$('[data-dz]').forEach(el => {
      const r = el.getBoundingClientRect(), tag = document.createElement('div');
      tag.className = 'lgk-annot';
      tag.textContent = `${el.dataset.dz} mm${el.dataset.tier ? ' · ' + el.dataset.tier : ''}`;
      tag.style.left = (r.left + window.scrollX + 6) + 'px'; tag.style.top = (r.top + window.scrollY - 22) + 'px';
      document.body.append(tag);
    });
  }

  /* -------------------------------------------------------------- boot */
  async function boot() {
    renderIcons();
    try { await document.fonts.load('500 24px "LGS Inter"'); await document.fonts.load('800 80px "LGS Inter"'); } catch (e) { /* fallback font */ }
    const view = document.querySelector('.lgk-view');
    if (view) loadRoom(view);
    await renderArt();
    geometry();
    $$('.lgk-glass').forEach(adapt);
    if (IS_CHROMIUM) $$('.lgk-glass[data-lens]').forEach(applyLens);
    else document.documentElement.classList.add('lgk-no-lens');
    annotate();
    document.documentElement.dataset.lgkReady = '1';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.LGK = { iconSVG, ICONS, LENS, boot };
})();
