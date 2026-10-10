// assPod OS drawing kit: the 5G status bar, list rows, highlight, scrollbar, bars, icons, text cache.
// All coordinates are logical 320x240 px; the OS has already applied scale(2,2) and a clip.
// Every helper restores the canvas state it changes, so screens can call them freely.
// Passed to screens and apps as ctx.ui; apps never import this module directly.

import { FONTS, M, C, ANIM } from './theme.js';

// ---------------------------------------------------------------- text cache

/** font -> (text -> width). Cleared by clearCache() once web fonts finish loading. */
const widths = new Map();
/** font -> (maxW -> (text -> ellipsized)) */
const ellipses = new Map();
const CACHE_LIMIT = 4000;   // per font; lists are small, so hitting this means churn (e.g. a clock) and a reset is fine

/**
 * Width of `text` in `font`, cached. Measures on `g` but restores its font, so a cache
 * miss between a caller's `g.font = …` and its `fillText` can't change what gets drawn.
 */
export function measure(g, text, font) {
  let m = widths.get(font);
  if (!m) { m = new Map(); widths.set(font, m); }
  let w = m.get(text);
  if (w === undefined) {
    const prev = g.font;
    g.font = font;
    w = g.measureText(text).width;
    g.font = prev;
    if (m.size >= CACHE_LIMIT) m.clear();
    m.set(text, w);
  }
  return w;
}

/** Longest prefix of `text` that fits `maxW` with a trailing ellipsis (the assPod's "…" truncation). */
export function ellipsize(g, text, font, maxW) {
  if (measure(g, text, font) <= maxW) return text;
  let byW = ellipses.get(font);
  if (!byW) { byW = new Map(); ellipses.set(font, byW); }
  let m = byW.get(maxW);
  if (!m) { m = new Map(); byW.set(maxW, m); }
  let s = m.get(text);
  if (s === undefined) {
    // Binary search on the prefix length; trailing spaces are trimmed so we never get "word …".
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (measure(g, text.slice(0, mid).trimEnd() + '…', font) <= maxW) lo = mid; else hi = mid - 1;
    }
    s = lo > 0 ? text.slice(0, lo).trimEnd() + '…' : '…';
    if (m.size >= CACHE_LIMIT) m.clear();
    m.set(text, s);
  }
  return s;
}

/** Drops every cached measurement (call after fonts load, since widths were taken with a fallback). */
export function clearCache() {
  widths.clear();
  ellipses.clear();
}

// ---------------------------------------------------------------- gradients

/** ctx -> (key -> CanvasGradient). Gradients live in user space, so callers translate rather than re-create. */
const gradients = new WeakMap();
const stopKeys = new WeakMap();

function stopsKey(stops) {
  let k = stopKeys.get(stops);
  if (k === undefined) {
    k = stops.map((s) => s[0] + ':' + s[1]).join('|');
    stopKeys.set(stops, k);
  }
  return k;
}

/**
 * Linear gradient, cached per context by coordinates and stops.
 * @param {CanvasRenderingContext2D} g
 * @param {[number, string][]} stops
 */
export function gradient(g, x0, y0, x1, y1, stops) {
  let m = gradients.get(g);
  if (!m) { m = new Map(); gradients.set(g, m); }
  const key = x0 + ',' + y0 + ',' + x1 + ',' + y1 + '|' + stopsKey(stops);
  let gr = m.get(key);
  if (!gr) {
    gr = g.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    m.set(key, gr);
  }
  return gr;
}

// ---------------------------------------------------------------- shapes

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r);
  g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h);
  g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r);
  g.arcTo(x, y, x + r, y, r);
  g.closePath();
}

// ---------------------------------------------------------------- status bar

const PLAY_GRAD = C.play;
const ICON_Y = 6;

function drawPlayIcon(g, x, y, state) {
  g.save();
  g.translate(x, y);
  g.fillStyle = gradient(g, 0, 0, 0, 10, PLAY_GRAD);
  g.strokeStyle = C.playBorder;
  g.lineWidth = 1;
  g.lineJoin = 'round';
  g.beginPath();
  if (state === 'playing') {
    // 9x10 triangle; the path is inset half a pixel so the 1px outline stays inside the box.
    g.moveTo(0.5, 0.5);
    g.lineTo(8.5, 5);
    g.lineTo(0.5, 9.5);
    g.closePath();
  } else {
    // Two 3x10 bars, 2px apart.
    g.rect(0.5, 0.5, 3, 9);
    g.rect(5.5, 0.5, 3, 9);
  }
  g.fill();
  g.stroke();
  g.restore();
}

function drawLock(g, x, y) {
  // Hold-switch padlock: a 9x7 body under a 5px wide shackle.
  g.save();
  g.translate(x, y);
  g.strokeStyle = '#3c3c3c';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(2.5, 5);
  g.lineTo(2.5, 3);
  g.arc(4.5, 3, 2, Math.PI, 0);
  g.lineTo(6.5, 5);
  g.stroke();
  g.fillStyle = gradient(g, 0, 4, 0, 11, [[0, '#8a8a8a'], [1, '#3a3a3a']]);
  roundRectPath(g, 0, 4.5, 9, 6.5, 1);
  g.fill();
  g.restore();
}

function drawBattery(g, x, y) {
  g.save();
  g.translate(x, y);
  // Full green fill, inset 1.5px from the 24x11 body.
  g.fillStyle = gradient(g, 0, 1.5, 0, 9.5, C.battery);
  roundRectPath(g, 1.5, 1.5, 21, 8, 0.75);
  g.fill();
  // A soft gloss on the upper half, as on the 5G icon.
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(2, 2, 20, 3);
  g.strokeStyle = C.batteryBorder;
  g.lineWidth = 1;
  roundRectPath(g, 0.5, 0.5, 23, 10, 1.5);
  g.stroke();
  // Terminal nub, 2x5 at x = 311.
  g.fillStyle = C.batteryBorder;
  g.fillRect(24, 3, 2, 5);
  g.restore();
}

/**
 * The 22px silver title bar.
 * @param {CanvasRenderingContext2D} g
 * @param {{ title: string, play: 'playing'|'paused'|'stopped', locked?: boolean }} s
 */
export function drawStatusBar(g, s) {
  g.save();
  g.fillStyle = gradient(g, 0, 0, 0, M.statusH - 1, C.status);
  g.fillRect(0, 0, M.W, M.statusH - 1);
  g.fillStyle = C.statusLine;
  g.fillRect(0, M.statusH - 1, M.W, 1);

  const title = ellipsize(g, s.title ?? '', FONTS.title, 220);
  g.font = FONTS.title;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = C.statusShadow;
  g.fillText(title, M.W / 2, 17);
  g.fillStyle = C.text;
  g.fillText(title, M.W / 2, 16);

  if (s.play === 'playing' || s.play === 'paused') drawPlayIcon(g, 8, ICON_Y, s.play);
  if (s.locked) drawLock(g, 22, 5);
  drawBattery(g, 287, ICON_Y);
  g.restore();
}

// ---------------------------------------------------------------- list rows

/** Blue selection bar: C.hi gradient with a light top line and a dark bottom line. */
export function drawHighlight(g, x, y, w, h) {
  g.save();
  g.translate(x, y);
  g.fillStyle = gradient(g, 0, 0, 0, h, C.hi);
  g.fillRect(0, 0, w, h);
  g.fillStyle = C.hiTop;
  g.fillRect(0, 0, w, 1);
  g.fillStyle = C.hiBottom;
  g.fillRect(0, h - 1, w, 1);
  g.restore();
}

/** The ">" disclosure mark: a 6x10 polyline with a 2px stroke whose right edge is at xRight. */
export function drawChevron(g, xRight, cy, color) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.lineCap = 'butt';
  g.lineJoin = 'miter';
  g.beginPath();
  // The miter pokes about 1.5px past the tip, so the tip sits inside xRight.
  g.moveTo(xRight - 6, cy - 5);
  g.lineTo(xRight - 1.5, cy);
  g.lineTo(xRight - 6, cy + 5);
  g.stroke();
  g.restore();
}

/** Small speaker (about 7x10, 13 wide with waves), left edge at x, centered on cy. */
export function drawSpeaker(g, x, cy, color, waves = false) {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, cy - 2);
  g.lineTo(x + 3, cy - 2);
  g.lineTo(x + 7, cy - 5);
  g.lineTo(x + 7, cy + 5);
  g.lineTo(x + 3, cy + 2);
  g.lineTo(x, cy + 2);
  g.closePath();
  g.fill();
  if (waves) {
    g.strokeStyle = color;
    g.lineWidth = 1.2;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(x + 7, cy, 3, -Math.PI / 4, Math.PI / 4);
    g.stroke();
    g.beginPath();
    g.arc(x + 7, cy, 6, -Math.PI / 4, Math.PI / 4);
    g.stroke();
  }
  g.restore();
}

/** Option-list checkmark, about 10x9, left edge at x. */
export function drawCheck(g, x, cy, color) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x + 1, cy);
  g.lineTo(x + 4, cy + 4);
  g.lineTo(x + 10, cy - 5);
  g.stroke();
  g.restore();
}

function resolve(v) {
  return typeof v === 'function' ? v() : v;
}

/**
 * Width available to a row's label, after the right-hand decorations (chevron, detail, icons).
 * Exported so lists can tell whether the highlighted label needs a marquee.
 */
export function rowLabelWidth(g, w, item) {
  let right = w - M.padX;
  if (item.detail != null && item.detail !== '') {
    right = w - M.padX - measure(g, String(resolve(item.detail)), FONTS.detail) - 10;
  } else if (item.chevron) {
    right = w - M.chevronInset - M.chevronW - 6;
  }
  if (item.check) right = Math.min(right, w - 20 - 6);
  if (item.speaker) right = Math.min(right, w - 24 - 6);
  return Math.max(0, right - M.padX);
}

/**
 * One 24px list row starting at y, spanning x = 0..w.
 * Non-highlighted rows draw no background (the list fills white once). A highlighted row whose
 * label overflows scrolls by `marqueeX` (<= 0); at 0 it shows the "…" form like other rows.
 * @param {{ label: string, detail?: string, chevron?: boolean, speaker?: boolean, check?: boolean,
 *           highlighted?: boolean, marqueeX?: number }} item
 */
export function drawRow(g, y, w, item) {
  const hi = !!item.highlighted;
  if (hi) drawHighlight(g, 0, y, w, M.rowH);
  const color = hi ? C.textHi : C.text;
  const label = String(resolve(item.label) ?? '');
  const base = y + M.rowBaseline;
  const cy = y + M.rowH / 2;
  const boxW = rowLabelWidth(g, w, item);

  g.save();
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left'; // callers may leave the context right-aligned
  g.fillStyle = color;
  g.font = FONTS.row;
  const textW = measure(g, label, FONTS.row);
  if (hi && item.marqueeX && textW > boxW) {
    g.save();
    g.beginPath();
    g.rect(M.padX, y, boxW, M.rowH);
    g.clip();
    const x0 = M.padX + item.marqueeX;
    g.fillText(label, x0, base);
    g.fillText(label, x0 + textW + ANIM.marqueeGap, base);
    g.restore();
  } else {
    g.fillText(textW > boxW ? ellipsize(g, label, FONTS.row, boxW) : label, M.padX, base);
  }

  const detail = item.detail != null ? String(resolve(item.detail)) : '';
  if (detail !== '') {
    g.font = FONTS.detail;
    g.fillStyle = color;
    g.textAlign = 'right';
    g.fillText(detail, w - M.padX, base);
  } else if (item.chevron) {
    drawChevron(g, w - M.chevronInset, cy, color);
  }
  if (item.check) drawCheck(g, w - 20, cy, color);
  if (item.speaker) drawSpeaker(g, w - 24, cy, color, true);
  g.restore();
}

/**
 * Vertical scrollbar: 1px border, white track, 6px thumb with a horizontal grey gradient.
 * @param {number} total rows in the list  @param {number} visible rows on screen  @param {number} first top row index
 */
export function drawScrollbar(g, x, y, h, total, visible, first) {
  const w = M.scrollbarW;
  g.save();
  g.fillStyle = C.sbTrack;
  g.fillRect(x, y, w, h);
  g.strokeStyle = C.sbBorder;
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  const inner = h - 2;
  const thumbH = total > visible ? Math.max(10, Math.round(inner * visible / total)) : inner;
  const span = Math.max(0, total - visible);
  const top = y + 1 + (span > 0 ? Math.round((inner - thumbH) * Math.min(1, Math.max(0, first / span))) : 0);
  g.translate(x + 1, 0);
  g.fillStyle = gradient(g, 0, 0, w - 2, 0, C.sbThumb);
  g.fillRect(0, top, w - 2, thumbH);
  g.restore();
}

// ---------------------------------------------------------------- bars

function drawBarTrack(g, x, y, w, h) {
  g.translate(x, y);
  g.fillStyle = gradient(g, 0, 1, 0, h - 1, C.prTrack);
  g.fillRect(1, 1, w - 2, h - 2);
}

function drawBarBorder(g, w, h) {
  g.strokeStyle = C.prBorder;
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function drawBarFill(g, w, h, fraction) {
  const f = Math.min(1, Math.max(0, fraction || 0));
  const fw = Math.round((w - 2) * f * 2) / 2;
  if (fw <= 0) return;
  g.fillStyle = gradient(g, 0, 1, 0, h - 1, C.hi);
  g.fillRect(1, 1, fw, h - 2);
  g.fillStyle = C.prGloss;
  g.fillRect(1, 1, fw, Math.floor((h - 2) / 2));
}

/** Now Playing progress bar: grey track, blue fill with a glossy top half. */
export function drawProgress(g, x, y, w, h, fraction) {
  g.save();
  drawBarTrack(g, x, y, w, h);
  drawBarFill(g, w, h, fraction);
  drawBarBorder(g, w, h);
  g.restore();
}

/** Scrubber: the empty track with a 10x14 white diamond at the play position. */
export function drawScrubber(g, x, y, w, h, fraction) {
  g.save();
  drawBarTrack(g, x, y, w, h);
  drawBarBorder(g, w, h);
  const f = Math.min(1, Math.max(0, fraction || 0));
  const cx = 1 + (w - 2) * f;
  const cy = h / 2;
  g.beginPath();
  g.moveTo(cx, cy - 7);
  g.lineTo(cx + 5, cy);
  g.lineTo(cx, cy + 7);
  g.lineTo(cx - 5, cy);
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  g.strokeStyle = '#000000';
  g.lineWidth = 1;
  g.lineJoin = 'miter';
  g.stroke();
  g.restore();
}

/**
 * Volume row spanning (x, y, w, 14): a small speaker, a 10px bar from x+18 to x+w-18 filled
 * to `fraction`, and a speaker with waves at the right. Now Playing calls it as (10, 180, 300, f).
 */
export function drawVolume(g, x, y, w, fraction) {
  drawSpeaker(g, x, y + 7, C.text, false);
  drawProgress(g, x + 18, y + 2, w - 36, 10, fraction);
  drawSpeaker(g, x + w - 12, y + 7, C.text, true);
}

function starPath(g, cx, cy, ro, ri) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
}

/** Five rating marks centered on (cx, cy), 20px apart: a star when rated, a dot when not. */
export function drawStars(g, cx, cy, rating, color = C.text) {
  g.save();
  g.fillStyle = color;
  const n = Math.round(rating || 0);
  for (let i = 0; i < 5; i++) {
    const x = cx + (i - 2) * 20;
    if (i < n) {
      starPath(g, x, cy, 6.5, 2.7);
      g.fill();
    } else {
      g.beginPath();
      g.arc(x, cy, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

// ---------------------------------------------------------------- text helpers

/** 'm:ss', or 'h:mm:ss' at an hour or more. Negative and NaN read as 0:00. */
export function formatTime(sec) {
  let s = Math.floor(Number.isFinite(sec) && sec > 0 ? sec : 0);
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const ss = s < 10 ? '0' + s : String(s);
  if (h > 0) return h + ':' + (m < 10 ? '0' + m : m) + ':' + ss;
  return m + ':' + ss;
}

/**
 * Marquee x offset (<= 0) for an overflowing label: rests ANIM.marqueeDelayMs at the start,
 * scrolls left at ANIM.marqueeSpeed px/s until the second copy (ANIM.marqueeGap behind) reaches
 * the start, then rests again. 0 while resting or when the text fits.
 */
export function marquee(now, startMs, textW, boxW) {
  if (textW <= boxW) return 0;
  const period = textW + ANIM.marqueeGap;
  const cycle = ANIM.marqueeDelayMs + (period / ANIM.marqueeSpeed) * 1000;
  const t = (now - startMs) % cycle;
  if (!(t > ANIM.marqueeDelayMs)) return 0;
  return -((t - ANIM.marqueeDelayMs) / 1000) * ANIM.marqueeSpeed;
}
