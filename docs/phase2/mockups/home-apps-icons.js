/* Extra symbols for the home-apps mockups, drawn like kit.js's sprite (24-unit grid, 2 px round strokes).
 * Load after kit.js and before DOMContentLoaded: kit.js renders <i data-i> on DOMContentLoaded from the
 * same ICONS object this file extends. Used for programs Steam has no icon for (DESIGN2 §9.3). */
(() => {
  if (!window.LGK) return;
  Object.assign(window.LGK.ICONS, {
    display: { s: ['M4.5 4.8h15a1.5 1.5 0 0 1 1.5 1.5v9.4a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.7V6.3a1.5 1.5 0 0 1 1.5-1.5z', 'M9 20.6h6', 'M12 17.2v3.4'] },
    remote: { s: ['M4.3 6.4h9.4a1.3 1.3 0 0 1 1.3 1.3v7.4a1.3 1.3 0 0 1-1.3 1.3H4.3A1.3 1.3 0 0 1 3 15.1V7.7a1.3 1.3 0 0 1 1.3-1.3z', 'M6.6 20h4.8', 'M9 16.4V20', 'M17.4 9.2a3.6 3.6 0 0 1 0 4.4', 'M19.6 7a7 7 0 0 1 0 8.8'] },
    screens: { s: ['M3.2 5.2h11a1 1 0 0 1 1 1v7.2a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V6.2a1 1 0 0 1 1-1z', 'M18 9.6h2.8a1 1 0 0 1 1 1v7.2a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V17'] },
    folder: { s: ['M3.6 7.2a1.6 1.6 0 0 1 1.6-1.6h4.1l2 2.1h7.5a1.6 1.6 0 0 1 1.6 1.6v8.1a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6z'] },
    stack: { s: ['M12 3.6 20.4 8 12 12.4 3.6 8z', 'M3.6 12 12 16.4 20.4 12', 'M3.6 16 12 20.4 20.4 16'] },
  });
})();
