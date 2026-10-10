// Music > Search, after the 5G's firmware 1.2 search: results fill the screen while a strip of
// letters along the bottom spells the query. The wheel picks a letter and select types it; "DONE"
// (or scrolling past the last letter) moves the highlight into the results, and MENU goes back to
// the letters. Results are artists, albums and songs from library.search().

// Song lists are the Music menu's own. (main-menu.js imports this file too; the cycle is harmless
// because both sides only use each other's functions when a screen opens.)
import { songList, albumSongs } from './main-menu.js';

// ---------------------------------------------------------------- keys

const KEYS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ' ', 'DEL', 'DONE'];
const STRIP_H = 44;          // letter band at the bottom of the content area
const RESULT_ROWS = 7;       // 7 x 24 px rows above the band
const KEY_W = 22;

function keyLabel(k) {
  return k === ' ' ? 'SPC' : k;
}

// ---------------------------------------------------------------- screen

export function createSearch(ctx) {
  const { library, ui, theme } = ctx;
  const { C, M, FONTS, font } = theme;
  const keyFont = font(15, 600);
  const smallKeyFont = font(10, 700);

  let query = '';
  let keyIndex = 0;
  let inResults = false;
  let results = [];
  let index = 0;
  let first = 0;
  const row = { label: '', detail: '', chevron: false, speaker: false, check: false, highlighted: false, marqueeX: 0 };

  function runSearch() {
    results = [];
    const q = query.trim();
    if (!q || typeof library.search !== 'function') return;
    const r = library.search(q);
    for (const a of r.artists ?? []) results.push({ label: a, kind: 'Artist', open: () => songList(ctx, 'songs', a, library.tracksBy({ artist: a })) });
    for (const al of r.albums ?? []) results.push({ label: al.title, kind: 'Album', open: () => albumSongs(ctx, al) });
    const tracks = r.tracks ?? [];
    tracks.forEach((t, i) => results.push({ label: t.title, kind: 'Song', play: () => { ctx.player.playQueue(tracks, i); ctx.nowPlaying(); } }));
    index = 0;
    first = 0;
  }

  function type(k) {
    if (k === 'DEL') { if (!query) return false; query = query.slice(0, -1); }
    else if (k === 'DONE') { if (!results.length) return false; inResults = true; return true; }
    else { if (query.length >= 24) return false; query += k; }
    runSearch();
    return true;
  }

  function drawStrip(g, y) {
    // Band: the query on top, letters below with the picked one in the highlight.
    g.fillStyle = gradientBand(g, y);
    g.fillRect(0, y, M.W, STRIP_H);
    g.fillStyle = C.statusLine;
    g.fillRect(0, y, M.W, 1);
    g.save();
    g.font = FONTS.row;
    g.fillStyle = C.text;
    g.textBaseline = 'alphabetic';
    const shown = ui.ellipsize(g, query + (inResults ? '' : '_'), FONTS.row, M.W - 16);
    g.fillText(shown, M.padX, y + 17);
    const ky = y + 22;
    const cx = M.W / 2 - KEY_W / 2;
    g.textAlign = 'center';
    for (let i = -7; i <= 7; i++) {
      const k = KEYS[keyIndex + i];
      if (k === undefined) continue;
      const x = cx + i * KEY_W;
      const hi = i === 0 && !inResults;
      if (hi) ui.drawHighlight(g, x, ky, KEY_W, 20);
      const label = keyLabel(k);
      g.font = label.length > 1 ? smallKeyFont : keyFont;
      g.fillStyle = hi ? C.textHi : C.text;
      g.fillText(label, x + KEY_W / 2, ky + (label.length > 1 ? 14 : 15));
    }
    g.restore();
  }

  const bandStops = [[0, '#f4f4f4'], [1, '#d6d6d6']];
  function gradientBand(g, y) {
    return ui.gradient(g, 0, y, 0, y + STRIP_H, bandStops);
  }

  return {
    id: 'search',
    title: 'Search',
    enter() { runSearch(); },
    handle(e) {
      if (e.type === 'scroll') {
        if (inResults) {
          const next = index + e.delta;
          if (next < 0) { inResults = false; return true; }
          if (next >= results.length) return false;
          index = next;
          if (index < first) first = index;
          if (index >= first + RESULT_ROWS) first = index - RESULT_ROWS + 1;
          return true;
        }
        const next = keyIndex + e.delta;
        if (next >= KEYS.length) { if (!results.length) return false; inResults = true; return true; }
        if (next < 0) return false;
        keyIndex = next;
        return true;
      }
      if (e.type === 'press' && e.part === 'select') {
        if (!inResults) return type(KEYS[keyIndex]);
        const r = results[index];
        if (!r) return false;
        if (r.open) ctx.push(r.open());
        else r.play();
        return true;
      }
      if (e.type === 'press' && e.part === 'menu' && inResults) {
        inResults = false;
        return true;
      }
      return undefined;
    },
    draw(g, r, now) {
      g.fillStyle = C.bg;
      g.fillRect(r.x, r.y, r.w, r.h);
      const listH = RESULT_ROWS * M.rowH;
      const scroll = results.length > RESULT_ROWS;
      const w = scroll ? M.W - M.scrollbarW : M.W;
      for (let i = first; i < Math.min(results.length, first + RESULT_ROWS); i++) {
        const res = results[i];
        row.label = res.label;
        row.detail = res.kind;
        row.highlighted = inResults && i === index;
        ui.drawRow(g, r.y + (i - first) * M.rowH, w, row);
      }
      if (!results.length && query.trim()) {
        g.save();
        g.font = FONTS.small;
        g.fillStyle = C.textDim;
        g.textAlign = 'center';
        g.fillText('No results', M.W / 2, r.y + 60);
        g.restore();
      }
      if (scroll) ui.drawScrollbar(g, M.W - M.scrollbarW, r.y, listH, results.length, RESULT_ROWS, first);
      drawStrip(g, r.y + r.h - STRIP_H);
    },
    highlight() {
      if (inResults) return results[index] ? { index, label: results[index].label } : null;
      return { index: keyIndex, label: keyLabel(KEYS[keyIndex]) };
    },
    get query() { return query; },
  };
}
