/* Extra symbols for the Settings mockups (docs/phase2/concepts/settings.md).
 * kit.js owns <i data-i="…">; this file owns <i data-si="…"> so the two never collide.
 * Same rules as the kit's sprite: 24-unit grid, >= 2 CSS px round strokes, SF Symbols proportions.
 * s: stroked paths, f: filled paths, c: stroked circles "cx cy r", cf: filled circles.
 * Load it before kit.js (it runs synchronously, so kit.js measures the final DOM). */
(() => {
  'use strict';
  const I = {
    drive: { s: ['M4.5 13.2 6.6 6.4A2 2 0 0 1 8.5 5h7a2 2 0 0 1 1.9 1.4l2.1 6.8', 'M5.5 13h13a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-3A1.5 1.5 0 0 1 5.5 13z'], cf: ['16.6 16 1.1'] },
    display: { s: ['M5 4.6h14a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.6a2 2 0 0 1 2-2z', 'M9 20.4h6', 'M12 16.8v3.6'] },
    bolt: { f: ['M13.4 2.8 5.6 13.2c-.3.4 0 .9.5.9h4.9l-1.3 7c-.1.6.6.9 1 .4l7.7-10.4c.3-.4 0-.9-.5-.9H13l1.4-7c.1-.6-.6-.9-1-.4z'] },
    lock: { s: ['M7 10.6h10a1.8 1.8 0 0 1 1.8 1.8v6.4a1.8 1.8 0 0 1-1.8 1.8H7a1.8 1.8 0 0 1-1.8-1.8v-6.4A1.8 1.8 0 0 1 7 10.6z', 'M8.4 10.6V8a3.6 3.6 0 0 1 7.2 0v2.6'] },
    access: { s: ['M5.4 8.6c2.2.6 4.4.9 6.6.9s4.4-.3 6.6-.9', 'M12 9.6v4.4', 'M12 14l-2.6 6', 'M12 14l2.6 6'], cf: ['12 5 1.9'] },
    hammer: { s: ['M13.6 9.8 5.4 18a1.6 1.6 0 0 0 2.3 2.3l8.2-8.2', 'M11.6 6.2l2.6-2.6 6.2 6.2-2.6 2.6z', 'M13.4 8.2l2.4 2.4'] },
    record: { c: ['12 12 8.4'], cf: ['12 12 4.4'] },
    wrench: { s: ['M14.6 4.2a4.6 4.6 0 0 0-5.4 6L4.6 14.8a2 2 0 0 0 2.8 2.8l4.6-4.6a4.6 4.6 0 0 0 6-5.4l-2.6 2.6-2.6-.6-.6-2.6z'] },
    house: { s: ['M4 10.6 12 4l8 6.6', 'M6 9.2v9.4a1.4 1.4 0 0 0 1.4 1.4h9.2a1.4 1.4 0 0 0 1.4-1.4V9.2'], c: ['10 14.4 1.6', '14.6 14.4 1.6'] },
    stream: { s: ['M5.5 5h13a2 2 0 0 1 2 2v7.4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M8 20h8', 'M9.4 12.6a3.6 3.6 0 0 1 5.2 0', 'M7.4 10.4a6.4 6.4 0 0 1 9.2 0'], cf: ['12 14.4 .9'] },
    overlay: { s: ['M4.5 6.5h11a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 17V8a1.5 1.5 0 0 1 1.5-1.5z', 'M7.5 3.5h11.4A2.1 2.1 0 0 1 21 5.6v8.9'] },
    camera: { s: ['M4.6 7.6h3l1.4-2.2h6l1.4 2.2h3a1.6 1.6 0 0 1 1.6 1.6v8.6a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.8V9.2a1.6 1.6 0 0 1 1.6-1.6z'], c: ['12 13.2 3.4'] },
    playarea: { s: ['M3.4 15.6 8 9h8l4.6 6.6z', 'M12 4.2v6', 'M10.2 6.2 12 4.2l1.8 2'] },
    panel: { s: ['M4.5 5h15a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 14.5v-8A1.5 1.5 0 0 1 4.5 5z', 'M8 19.4h8'] },
    sliders: { s: ['M4 7h9', 'M17 7h3', 'M4 17h3', 'M11 17h9'], c: ['15 7 2', '9 17 2'] },
    updown: { s: ['M8 9.4 12 5.6l4 3.8', 'M8 14.6l4 3.8 4-3.8'] },
    chevr: { s: ['M9.5 5.5 16 12l-6.5 6.5'] },
    back: { s: ['M14.5 5.5 8 12l6.5 6.5'] },
    check: { s: ['M5.4 12.6l4.2 4.2L18.8 7.2'] },
    external: { s: ['M9 5.2h9.8V15', 'M18.6 5.4 6 18'] },
    info: { s: ['M12 11v5.6'], c: ['12 12 8.6'], cf: ['12 7.8 1.2'] },
    reset: { s: ['M5.6 9.4A7 7 0 1 1 5 14', 'M5.2 4.6v4.8H10'] },
    textcursor: { s: ['M12 5v14', 'M9 5h6', 'M9 19h6'] },
    speaker0: { f: ['M4.4 9.2h3l4.3-3.9c.5-.5 1.3-.1 1.3.6v12.2c0 .7-.8 1.1-1.3.6l-4.3-3.9h-3c-.5 0-.9-.4-.9-.9V10.1c0-.5.4-.9.9-.9z'], s: ['M16 9.2a4.2 4.2 0 0 1 0 5.6'] },
    globe: { c: ['12 12 8.6'], s: ['M3.6 12h16.8', 'M12 3.4c2.4 2.4 3.4 5.4 3.4 8.6s-1 6.2-3.4 8.6c-2.4-2.4-3.4-5.4-3.4-8.6s1-6.2 3.4-8.6z'] },
    clock: { s: ['M12 7.4V12l3.2 2'], c: ['12 12 8.4'] },
    shield: { s: ['M12 3.4 5 6v5.4c0 4.4 3 7.8 7 9.2 4-1.4 7-4.8 7-9.2V6z', 'M9 12l2.2 2.2L15.4 10'] },
    cpu: { s: ['M7.5 6h9A1.5 1.5 0 0 1 18 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6z', 'M10 10h4v4h-4z', 'M9 3v3', 'M15 3v3', 'M9 18v3', 'M15 18v3', 'M3 9h3', 'M3 15h3', 'M18 9h3', 'M18 15h3'] },
    trash: { s: ['M4.8 6.8h14.4', 'M9.6 6.6V5.2c0-.6.5-1 1-1h2.8c.6 0 1 .4 1 1v1.4', 'M6.4 6.8l.9 12.3c.1.9.8 1.6 1.7 1.6h6c.9 0 1.6-.7 1.7-1.6l.9-12.3'] },
    move: { s: ['M4 12h12', 'M12.4 8 16.4 12l-4 4', 'M19.6 5v14'] },
  };
  function svg(name, cls, style) {
    const d = I[name];
    let out = '';
    if (!d) out = '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-dasharray="2 3"/>';
    else {
      (d.s || []).forEach(p => { out += `<path d="${p}" fill="none" stroke="currentColor"/>`; });
      (d.f || []).forEach(p => { out += `<path d="${p}" fill="currentColor"/>`; });
      (d.c || []).forEach(c => { const [x, y, r] = c.split(' '); out += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="currentColor"/>`; });
      (d.cf || []).forEach(c => { const [x, y, r] = c.split(' '); out += `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor"/>`; });
    }
    return `<svg class="lgk-i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true"${style ? ` style="${style}"` : ''}>${out}</svg>`;
  }
  document.querySelectorAll('i[data-si]').forEach(el => {
    const t = document.createElement('span');
    t.innerHTML = svg(el.dataset.si, el.className, el.style.cssText);
    el.replaceWith(t.firstChild);
  });
})();
