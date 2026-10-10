// Now Playing, laid out like the 5G (design spec 6.3): "n of N", album art on the left, title /
// artist / album on the right, and a progress bar with elapsed and remaining time.
// Center click cycles progress -> scrubber -> rating; the wheel sets volume, seeks or rates.

import { SCREEN_SCALE } from '../../config.js';

// ---------------------------------------------------------------- layout

const POS = { x: 10, y: 40 };
const ART = { x: 10, y: 48, s: 112 };
const TEXT = { x: 132, w: 180, title: 82, artist: 102, album: 122 };
const BAR = { x: 10, y: 182, w: 300, h: 10 };
const TIME_Y = 208;
const STARS = { cx: 160, cy: 187 };
const VOLUME = { x: 10, y: 180, w: 300 };
const VOLUME_STEPS = 16;
const SCRUB_STEP_S = 2;
const SCRUB_FAST_MS = 120;   // steps closer than this count as "scrolling fast"

const MODES = ['progress', 'scrub', 'rating'];
const GLYPH = { right: 310, w: 12, h: 9, gap: 5 };   // shuffle / repeat marks, right of "n of N"

/** Grey square with a beamed note, for items without cover art. */
function drawPlaceholderArt(g, x, y, s) {
  g.save();
  const gr = g.createLinearGradient(0, y, 0, y + s);
  gr.addColorStop(0, '#e9e9e9');
  gr.addColorStop(1, '#bdbdbd');
  g.fillStyle = gr;
  g.fillRect(x, y, s, s);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#ffffff';
  const cx = x + s / 2;
  const cy = y + s / 2;
  g.beginPath();
  g.ellipse(cx - 14, cy + 18, 9, 6.5, -0.4, 0, Math.PI * 2);
  g.ellipse(cx + 18, cy + 12, 9, 6.5, -0.4, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx - 6, cy + 17);
  g.lineTo(cx - 6, cy - 22);
  g.lineTo(cx + 26, cy - 30);
  g.lineTo(cx + 26, cy + 11);
  g.stroke();
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(cx - 6, cy - 19);
  g.lineTo(cx + 26, cy - 27);
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- shuffle and repeat glyphs

/** Two crossing arrows, in a w x h box with its top-left at (x, y). */
function drawShuffleGlyph(g, x, y, color) {
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 1.4;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x, y + 2); g.lineTo(x + 3, y + 2); g.lineTo(x + 7, y + 7); g.lineTo(x + 9.5, y + 7);
  g.moveTo(x, y + 7); g.lineTo(x + 3, y + 7); g.lineTo(x + 7, y + 2); g.lineTo(x + 9.5, y + 2);
  g.stroke();
  g.beginPath();
  g.moveTo(x + 9, y); g.lineTo(x + 12, y + 2); g.lineTo(x + 9, y + 4); g.closePath();
  g.moveTo(x + 9, y + 5); g.lineTo(x + 12, y + 7); g.lineTo(x + 9, y + 9); g.closePath();
  g.fill();
}

/** A looping arrow; for repeat-one the loop narrows and a small "1" sits at its right. */
function drawRepeatGlyph(g, x, y, color, one, oneFont) {
  const w = one ? 8 : 10.6;          // loop width
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 1.4;
  g.beginPath();
  g.roundRect(x + 0.7, y + 2, w, 5.5, 2.2);
  g.stroke();
  const top = x + 0.7 + w * 0.55;     // arrowheads ride the loop: right on top, left underneath
  const bottom = x + 0.7 + w * 0.45;
  g.beginPath();
  g.moveTo(top - 1.5, y); g.lineTo(top + 1.5, y + 2); g.lineTo(top - 1.5, y + 4); g.closePath();
  g.moveTo(bottom + 1.5, y + 5.5); g.lineTo(bottom - 1.5, y + 7.5); g.lineTo(bottom + 1.5, y + 9.5); g.closePath();
  g.fill();
  if (one) {
    g.font = oneFont;
    g.fillText('1', x + 10.2, y + 8.5);
  }
}

// ---------------------------------------------------------------- art cache

// The 256px cover is resampled once per album to the art box's backing-store size (224px), so
// each 4 Hz (or 40 fps marquee) redraw is a 1:1 blit instead of a high-quality downscale.
const ART_PX = ART.s * SCREEN_SCALE;
let artKey = null;
let artSrc = null;
let artCanvas = null;

function scaledCover(src, key) {
  // The source canvas counts too: art.clear() redraws covers (late web fonts) as new canvases.
  if (key === artKey && src === artSrc && artCanvas) return artCanvas;
  if (typeof document === 'undefined') return src;
  artCanvas ??= document.createElement('canvas');
  artCanvas.width = artCanvas.height = ART_PX;
  const g = artCanvas.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, ART_PX, ART_PX);
  artKey = key;
  artSrc = src;
  return artCanvas;
}

// ---------------------------------------------------------------- screen

export function createNowPlaying(ctx) {
  const { player, art, ui, theme, settings } = ctx;
  const { C, FONTS, ANIM } = theme;
  const oneFont = theme.font(8, 700);   // the "1" in the repeat-one glyph

  let mode = 'progress';
  let modeAt = 0;          // last interaction in scrub/rating mode (reverts after npModeTimeoutMs)
  let volumeUntil = 0;     // volume overlay visible until this time
  let lastScrubAt = -1e9;
  let scrubRun = 0;        // consecutive fast scrub steps
  let titleSince = 0;      // marquee clock for the title
  let titleId = null;
  let titleOverflow = false;
  let titleW = 0;
  let lastTitleX = 0;
  let offState = null;
  // "n of N" is rebuilt only when it changes.
  let posKey = -1;
  let posText = '';

  function rating(item) {
    if (!item) return 0;
    const saved = settings.get('ratings')?.[item.id];
    return Number.isFinite(item.rating) ? item.rating : Number.isFinite(saved) ? saved : 0;
  }

  function onState({ state } = {}) {
    // The 5G drops out of Now Playing when the queue runs out.
    if ((state ?? player.state) === 'stopped' && ctx.top() === screen) ctx.pop();
  }

  function setMode(m, now) {
    mode = m;
    modeAt = now;
    volumeUntil = 0;
  }

  let drawnAt = 0;

  const screen = {
    id: 'nowplaying',
    title: 'Now Playing',
    // Only a moving playhead needs the 4 Hz refresh; paused, the screen is static (no uploads).
    get refreshMs() { return player.state === 'playing' || player.seeking ? 250 : 0; },

    enter() {
      offState = player.on?.('state', onState) ?? null;
      titleSince = ctx.now();
      titleId = player.current?.id ?? null;
    },
    exit() {
      offState?.();
      offState = null;
    },
    resume() {
      titleSince = ctx.now();
      if (player.state === 'stopped') onState({ state: 'stopped' });
    },

    handle(e) {
      const now = ctx.now();
      const cur = player.current;
      if (e.type === 'press' && e.part === 'select') {
        if (!cur) return false;
        setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length], now);
        return true;
      }
      if (e.type !== 'scroll') return undefined;
      if (!cur) return false;

      if (mode === 'scrub') {
        // Fast spinning seeks further per detent: 2 s, then 4 s, then 8 s.
        scrubRun = now - lastScrubAt < SCRUB_FAST_MS ? scrubRun + 1 : 0;
        lastScrubAt = now;
        const mult = scrubRun >= 8 ? 4 : scrubRun >= 3 ? 2 : 1;
        const dur = player.duration || cur.duration || 0;
        const pos = Math.max(0, Math.min(dur, player.position + e.delta * SCRUB_STEP_S * mult));
        modeAt = now;
        if (pos === player.position) return false;
        player.seek(pos);
        return true;
      }
      if (mode === 'rating') {
        modeAt = now;
        const r = rating(cur);
        const next = Math.max(0, Math.min(5, r + e.delta));
        if (next === r) return false;
        player.rate(cur, next);
        return true;
      }
      // Progress mode: the wheel is the volume knob, shown on an overlay.
      const v = player.volume;
      const next = Math.max(0, Math.min(1, Math.round(v * VOLUME_STEPS + e.delta) / VOLUME_STEPS));
      const wasShown = now < volumeUntil;
      volumeUntil = now + ANIM.volumeOverlayMs;
      if (next !== v) player.setVolume(next);
      return next !== v || !wasShown;
    },

    draw(g, r, now) {
      g.fillStyle = C.bg;
      g.fillRect(r.x, r.y, r.w, r.h);
      const cur = player.current;
      if (!cur) return;
      drawnAt = now;
      if (mode !== 'progress' && now - modeAt > ANIM.npModeTimeoutMs) mode = 'progress';
      if (cur.id !== titleId) { titleId = cur.id; titleSince = now; }

      g.save();
      g.textBaseline = 'alphabetic';

      // "3 of 12"
      const key = player.index * 100000 + player.queue.length;
      if (key !== posKey) { posKey = key; posText = `${player.index + 1} of ${player.queue.length}`; }
      g.font = FONTS.small;
      g.fillStyle = C.text;
      g.fillText(posText, POS.x, POS.y);

      // Shuffle and repeat marks at the right end of that line, as on the 5G.
      const repeat = settings.get('repeat');
      let gx = GLYPH.right - GLYPH.w;
      if (repeat === 'one' || repeat === 'all') {
        drawRepeatGlyph(g, gx, POS.y - GLYPH.h, C.text, repeat === 'one', oneFont);
        gx -= GLYPH.w + GLYPH.gap;
      }
      if (settings.get('shuffle') !== 'off') drawShuffleGlyph(g, gx, POS.y - GLYPH.h, C.text);

      // Album art with a light grey hairline.
      const cover = cur.albumId ? art.cover(cur.albumId) : art.placeholder?.();
      if (cover) {
        g.drawImage(scaledCover(cover, cur.albumId ?? 'placeholder'), ART.x, ART.y, ART.s, ART.s);
      } else {
        drawPlaceholderArt(g, ART.x, ART.y, ART.s);
      }
      g.strokeStyle = C.artBorder;
      g.lineWidth = 1;
      g.strokeRect(ART.x + 0.5, ART.y + 0.5, ART.s - 1, ART.s - 1);

      // Title (marquee when long), artist, album.
      const title = String(cur.title ?? '');
      titleW = ui.measure(g, title, FONTS.npTitle);
      titleOverflow = titleW > TEXT.w;
      g.font = FONTS.npTitle;
      if (titleOverflow) {
        const x = ui.marquee(now, titleSince, titleW, TEXT.w);
        lastTitleX = x;
        if (x === 0) {
          g.fillText(ui.ellipsize(g, title, FONTS.npTitle, TEXT.w), TEXT.x, TEXT.title);
        } else {
          g.save();
          g.beginPath();
          g.rect(TEXT.x, TEXT.title - 16, TEXT.w, 22);
          g.clip();
          g.fillText(title, TEXT.x + x, TEXT.title);
          g.fillText(title, TEXT.x + x + titleW + ANIM.marqueeGap, TEXT.title);
          g.restore();
        }
      } else {
        lastTitleX = 0;
        g.fillText(title, TEXT.x, TEXT.title);
      }
      g.font = FONTS.npMeta;
      g.fillText(ui.ellipsize(g, String(cur.artist ?? ''), FONTS.npMeta, TEXT.w), TEXT.x, TEXT.artist);
      g.fillText(ui.ellipsize(g, String(cur.album ?? ''), FONTS.npMeta, TEXT.w), TEXT.x, TEXT.album);

      // Bottom band: volume overlay, or the mode's bar.
      const dur = player.duration || cur.duration || 0;
      const pos = Math.max(0, Math.min(dur, player.position || 0));
      const frac = dur > 0 ? pos / dur : 0;
      let showTimes = true;
      if (now < volumeUntil) {
        ui.drawVolume(g, VOLUME.x, VOLUME.y, VOLUME.w, player.volume);
        showTimes = false;
      } else if (mode === 'scrub') {
        ui.drawScrubber(g, BAR.x, BAR.y, BAR.w, BAR.h, frac);
      } else if (mode === 'rating') {
        ui.drawStars(g, STARS.cx, STARS.cy, rating(cur));
        showTimes = false;
      } else {
        ui.drawProgress(g, BAR.x, BAR.y, BAR.w, BAR.h, frac);
      }
      if (showTimes) {
        g.font = FONTS.time;
        g.fillStyle = C.text;
        // Whole seconds that always add up to the track length, as the assPod shows them.
        const elapsed = Math.floor(pos);
        g.fillText(ui.formatTime(elapsed), BAR.x, TIME_Y);
        g.textAlign = 'right';
        g.fillText('-' + ui.formatTime(Math.max(0, Math.round(dur) - elapsed)), BAR.x + BAR.w, TIME_Y);
      }
      g.restore();
    },

    animating(now) {
      // One redraw when the volume overlay or a scrubber/rating mode times out, even when paused.
      if (volumeUntil && drawnAt < volumeUntil && now >= volumeUntil) return true;
      const modeEnd = modeAt + ANIM.npModeTimeoutMs;
      if (mode !== 'progress' && drawnAt <= modeEnd && now > modeEnd) return true;
      if (!titleOverflow) return false;
      return ui.marquee(now, titleSince, titleW, TEXT.w) !== 0 || lastTitleX !== 0;
    },

    highlight: () => null,

    /** Debug/test hook: the current display mode and whether the volume overlay is up. */
    get mode() { return mode; },
    get volumeVisible() { return ctx.now() < volumeUntil; },
  };
  return screen;
}
