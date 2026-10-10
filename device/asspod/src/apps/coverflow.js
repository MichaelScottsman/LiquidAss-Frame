// Cover Flow, drawn the way the 6th-generation assPod classic drew it: square covers on black, the
// center one facing the viewer, the side ones turned 72° toward it and stacked like cards, all of
// them mirrored in a glossy floor. A center click flips the album over to its track list.
//
// Everything is projected inside the 2D screen canvas with perspective-correct column strips, so
// this screen behaves the same on desktop, in XR and in headless canvas dumps (no render-to-texture
// pass). Each album's cover and reflection are pre-baked into one opaque bitmap, so a strip is a
// single drawImage call.
import { C, FONTS, font } from '../os/theme.js';
import { SCREEN_W, SCREEN_SCALE } from '../config.js';

// ---------------------------------------------------------------- projection
const S = 112;                        // center cover edge in px
const D = 2.4;                        // camera to center cover, in cover widths
const F = S * D;                      // focal length: a 1-unit cover at depth D spans S px
const CX = 160;                       // projection center x
const CY = 68;                        // center line below the content top (y = 90 on screen)
const SIDE = 72 * Math.PI / 180;      // side covers turn to face the center
const SPREAD = 1.05;                  // x of the first side cover: its inner edge lands ~11 px clear of
                                      // the centre cover, the dark gap the 6G classic shows
const STEP = 0.16;                    // x step between the further side covers
const SINK = 0.7;                     // side covers sit this much further back
const REACH = 5.6;                    // |offset| still worth considering; further covers are off-screen
const DIM = 0.15;                     // black overlay on side covers

// ---------------------------------------------------------------- bakes
const TEX = 256;                      // art.cover() size
const REFL = 0.4;                     // reflection height / cover height
const REFL_TOP = 0.35;                // reflection opacity at the cover's bottom edge, fading to 0
const BAKE_BOTTOM = 0.5 + Math.ceil(TEX * REFL) / TEX;   // bottom of the bake in cover heights from center

// ---------------------------------------------------------------- motion and flip
const SPRING = 10;                    // p += (target - p)(1 - e^(-10 dt))
const FLIP_MS = 280;
const FLIP_ZOOM = 1.7;                // the flip is seen through a longer lens (weaker perspective), so its
                                      // near edge stays below the status bar
const PANEL = { x: 70, y: 30, w: 180, h: 150 };   // flipped track list, screen px
const HEAD_H = 32;
const ROW_H = 18;
const PANEL_DIM = 0.6;                // how much the rest of Cover Flow darkens behind the panel
const F_PANEL_TITLE = font(12, 700);
const F_PANEL_ARTIST = font(11, 400);
const F_ROW = font(12, 600);
const F_DUR = font(11, 400);

// ---------------------------------------------------------------- frame budget
// The spec's fallback: if animated frames keep running past 6 ms (Quest, while it is also rendering
// the VR scene), the strips widen to 2 px. That halves the drawImage calls at a small cost in
// smoothness of the slanted edges.
const SLOW_MS = 6;
const SLOW_FRAMES = 3;

// Kept across visits: the assPod reopens Cover Flow where you left it.
let lastAlbumId = null;
let stripPx = 1;
let slowCount = 0;
const bakes = new Map();              // albumId -> { src, full, side }

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Cover plus its floor reflection (flipped, fading from REFL_TOP to 0 over black) in one opaque
// bitmap. Opaque is fine because Cover Flow's background is black.
function bake(cover, size) {
  const rh = Math.ceil(size * REFL);
  const c = makeCanvas(size, size + rh);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size + rh);
  g.drawImage(cover, 0, 0, size, size);
  g.save();
  g.translate(0, 2 * size);
  g.scale(1, -1);
  g.drawImage(cover, 0, 0, size, size);
  g.restore();
  // Darkening with black over black-backed pixels multiplies them, so alpha (1 - k) leaves k of the image.
  const grad = g.createLinearGradient(0, size, 0, size + rh);
  grad.addColorStop(0, `rgba(0,0,0,${1 - REFL_TOP})`);
  grad.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = grad;
  g.fillRect(0, size, size, rh);
  return c;
}

// The side covers are squeezed to about a fifth of their width, so they read from a half-size bake;
// sampling the full one would alias.
function bakeFor(art, id) {
  const src = art.cover(id);
  let b = bakes.get(id);
  if (!b || b.src !== src) {
    b = { src, full: bake(src, TEX), side: bake(src, TEX / 2) };
    bakes.set(id, b);
  }
  return b;
}

// ---------------------------------------------------------------- strip renderer
// Draws a plane centered at (xc, zc), rotated phi about the vertical axis, half-width hw (cover
// widths), between screen columns x0..x1. Image rows sy..sy+sh map to plane heights ya..yb (in units of
// the plane height ph, 0 = the center line). For each column, inverting the projection gives the
// plane coordinate s = (-k·zc - xc) / (cos phi + k·sin phi) with k = (sx - CX) / F, so texture
// columns follow the true perspective rather than a linear stretch.
function drawPlane(g, img, sy, sh, xc, zc, phi, hw, ph, cy, ya, yb, x0, x1, step, f = F) {
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  const iw = img.width;
  const inv = 1 / (2 * hw);
  for (let sx = Math.floor(x0); sx < x1; sx += step) {
    const dl = sx < x0 ? x0 : sx;
    const dr = sx + step > x1 ? x1 : sx + step;
    if (dr - dl < 0.01) continue;
    const ka = (dl - CX) / f;
    const kb = (dr - CX) / f;
    const sa = (-ka * zc - xc) / (c + ka * sn);
    const sb = (-kb * zc - xc) / (c + kb * sn);
    let ua = (sa + hw) * inv;
    let ub = (sb + hw) * inv;
    if (ua < 0) ua = 0;
    if (ub > 1) ub = 1;
    if (ub - ua < 1e-4) continue;
    const z = zc + (sa + sb) * 0.5 * sn;
    const h = ph * f / -z;
    g.drawImage(img, ua * iw, sy, (ub - ua) * iw, sh, dl, cy + ya * h, dr - dl, (yb - ya) * h);
  }
}

// Screen x of the plane's edge at plane coordinate s.
function edgeX(xc, zc, phi, s, f = F) {
  return CX + f * (xc + s * Math.cos(phi)) / -(zc + s * Math.sin(phi));
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Covers on the classic were ordered by artist, ignoring a leading "The".
function sortKey(a) {
  return `${String(a.artist).replace(/^the\s+/i, '')}\u0000${a.year ?? ''}\u0000${a.title}`.toLowerCase();
}

// ---------------------------------------------------------------- screen
export function coverFlow(ctx) {
  const { ui, player, library, art } = ctx;
  const albums = library.albums.slice().sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
  const n = albums.length;

  // Cover slots, reused every frame to avoid allocations.
  const slots = [];
  for (let i = 0; i < 2 * Math.ceil(REACH) + 3; i++) {
    slots.push({ i: 0, o: 0, a: 0, xc: 0, zc: 0, phi: 0, eL: 0, eR: 0, vL: 0, vR: 0 });
  }
  let used = 0;

  let p = 0;                 // continuous position, album index at the center
  let target = 0;
  let lastNow = 0;           // 0 = restart the clock on the next frame
  let flip = 0;              // 0 = cover, 1 = track list
  let flipTarget = 0;
  let flipAlbum = null;
  let row = 0;
  let rowTop = 0;
  let panelCanvas = null;
  // Ellipsized captions per album; cleared on enter, resume and refresh (os.invalidate() after web
  // fonts finish loading), since the fonts change text widths.
  const captions = new Map();

  const stats = { frames: 0, lastMs: 0, maxMs: 0, totalMs: 0, stripPx: 1, columns: 0 };

  function indexOfAlbumId(id) {
    for (let i = 0; i < n; i++) if (albums[i].id === id) return i;
    return -1;
  }

  function visibleRows() {
    return Math.floor((PANEL.h - HEAD_H - 4) / ROW_H);
  }

  function clampRowWindow() {
    const vis = visibleRows();
    if (row < rowTop) rowTop = row;
    if (row >= rowTop + vis) rowTop = row - vis + 1;
  }

  // ---------------------------------------------------------------- track list panel
  function drawPanel(g, x, y, w, h) {
    const album = flipAlbum;
    g.fillStyle = ui.gradient(g, 0, y, 0, y + h, C.cfPanel);
    g.fillRect(x, y, w, h);
    g.strokeStyle = C.cfPanelBorder;
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const tf = F_PANEL_TITLE;
    const af = F_PANEL_ARTIST;
    g.font = tf;
    g.fillStyle = '#ffffff';
    g.fillText(ui.ellipsize(g, album.title, tf, w - 16), x + w / 2, y + 14);
    g.font = af;
    g.fillStyle = '#aaaaaa';
    g.fillText(ui.ellipsize(g, album.artist, af, w - 16), x + w / 2, y + 27);
    g.fillStyle = '#4a4a4a';
    g.fillRect(x + 1, y + HEAD_H, w - 2, 1);
    g.fillStyle = '#0c0c0c';
    g.fillRect(x + 1, y + HEAD_H + 1, w - 2, 1);

    const tracks = album.tracks;
    const vis = visibleRows();
    const overflow = tracks.length > vis;
    const rowW = w - 2 - (overflow ? 5 : 0);
    const rf = F_ROW;
    const df = F_DUR;
    const cur = player.current;
    for (let k = 0; k < vis && rowTop + k < tracks.length; k++) {
      const i = rowTop + k;
      const t = tracks[i];
      const ry = y + HEAD_H + 2 + k * ROW_H;
      const hi = i === row;
      if (hi) ui.drawHighlight(g, x + 1, ry, rowW, ROW_H);
      g.textAlign = 'right';
      g.font = df;
      g.fillStyle = hi ? '#ffffff' : '#9c9c9c';
      const dur = ui.formatTime(t.duration);
      g.fillText(dur, x + rowW - 6, ry + 13);
      let right = x + rowW - 12 - ui.measure(g, dur, df);
      if (cur && cur.id === t.id) {
        ui.drawSpeaker(g, right - 11, ry + ROW_H / 2, hi ? '#ffffff' : '#9fc4f4', player.state === 'playing');
        right -= 16;
      }
      g.textAlign = 'left';
      g.font = rf;
      g.fillStyle = '#ffffff';
      g.fillText(ui.ellipsize(g, t.title, rf, right - (x + 8)), x + 8, ry + 13);
    }
    if (overflow) {
      // A slim dark-theme scrollbar; the 5G list scrollbar would look pasted on here.
      const th = h - HEAD_H - 6;
      const ty = y + HEAD_H + 3;
      g.fillStyle = '#2a2a2a';
      g.fillRect(x + w - 6, ty, 3, th);
      const thumb = Math.max(8, th * vis / tracks.length);
      g.fillStyle = '#8a8a8a';
      g.fillRect(x + w - 6, ty + (th - thumb) * rowTop / (tracks.length - vis), 3, thumb);
    }
  }

  function renderPanelCanvas() {
    if (!panelCanvas) panelCanvas = makeCanvas(PANEL.w * SCREEN_SCALE, PANEL.h * SCREEN_SCALE);
    const g = panelCanvas.getContext('2d');
    g.setTransform(SCREEN_SCALE, 0, 0, SCREEN_SCALE, 0, 0);
    g.clearRect(0, 0, PANEL.w, PANEL.h);
    drawPanel(g, 0, 0, PANEL.w, PANEL.h);
  }

  function startFlip(to) {
    if (to === 1) {
      p = target;                      // flip whatever is (about to be) centered
      flipAlbum = albums[Math.round(target)];
      const cur = player.current;
      row = 0;
      if (cur) for (let i = 0; i < flipAlbum.tracks.length; i++) if (flipAlbum.tracks[i].id === cur.id) row = i;
      rowTop = 0;
      clampRowWindow();
    }
    flipTarget = to;
    renderPanelCanvas();
    lastNow = 0;
  }

  // ---------------------------------------------------------------- layout
  function layout() {
    used = 0;
    const lo = Math.max(0, Math.ceil(p - REACH));
    const hi = Math.min(n - 1, Math.floor(p + REACH));
    for (let i = lo; i <= hi; i++) {
      const o = i - p;
      const a = o < 0 ? -o : o;
      const sg = o < 0 ? -1 : 1;
      const t = a < 1 ? a : 1;
      const s = slots[used++];
      s.i = i; s.o = o; s.a = a;
      s.phi = sg * SIDE * t;
      s.xc = sg * (a < 1 ? SPREAD * a : SPREAD + (a - 1) * STEP);
      s.zc = -D - SINK * t;
      s.eL = edgeX(s.xc, s.zc, s.phi, -0.5);
      s.eR = edgeX(s.xc, s.zc, s.phi, 0.5);
    }
    // Nearest first (insertion sort: at most a dozen slots, no allocation).
    for (let k = 1; k < used; k++) {
      const s = slots[k];
      let j = k - 1;
      while (j >= 0 && slots[j].a > s.a) { slots[j + 1] = slots[j]; j--; }
      slots[j + 1] = s;
    }
    // Each cover only needs the columns that nearer covers leave uncovered. Side covers on one side
    // stack outward, so what is covered so far is a single interval. One column of overlap goes under
    // the nearer cover's antialiased edge so no background seam shows between them.
    let occL = 0;
    let occR = 0;
    for (let k = 0; k < used; k++) {
      const s = slots[k];
      let vL = s.eL;
      let vR = s.eR;
      if (k > 0) {
        if (s.o > 0) vL = Math.max(vL, occR - 1);
        else vR = Math.min(vR, occL + 1);
        occL = Math.min(occL, s.eL);
        occR = Math.max(occR, s.eR);
      } else {
        occL = s.eL;
        occR = s.eR;
      }
      s.vL = vL < 0 ? 0 : vL;
      s.vR = vR > SCREEN_W ? SCREEN_W : vR;
    }
  }

  function caption(album, g) {
    let c = captions.get(album);
    if (!c) {
      c = {
        title: ui.ellipsize(g, album.title, FONTS.cfTitle, 300),
        artist: ui.ellipsize(g, album.artist, FONTS.cfArtist, 300),
      };
      captions.set(album, c);
    }
    return c;
  }

  // ---------------------------------------------------------------- per-frame
  function advance(now) {
    let dt = lastNow ? (now - lastNow) / 1000 : 1 / 40;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    lastNow = now;
    if (p !== target) {
      p += (target - p) * (1 - Math.exp(-SPRING * dt));
      if (Math.abs(target - p) < 0.002) p = target;
    }
    if (flip !== flipTarget) {
      const d = dt * 1000 / FLIP_MS;
      flip = flipTarget > flip ? Math.min(flipTarget, flip + d) : Math.max(flipTarget, flip - d);
    }
  }

  function drawCovers(g, top, cy, skip) {
    let cols = 0;
    for (let k = used - 1; k >= 0; k--) {
      const s = slots[k];
      if (s.i === skip || s.vR - s.vL < 0.01) continue;
      const b = bakeFor(art, albums[s.i].id);
      if (s.a < 1e-4) {
        // At rest the center cover faces the viewer squarely: one drawImage.
        g.drawImage(b.full, CX - S / 2, cy - S / 2, S, S * (BAKE_BOTTOM + 0.5));
        cols += 1;
        continue;
      }
      const img = s.a > 0.6 ? b.side : b.full;
      drawPlane(g, img, 0, img.height, s.xc, s.zc, s.phi, 0.5, 1, cy, -0.5, BAKE_BOTTOM, s.vL, s.vR, stripPx);
      cols += Math.ceil((s.vR - s.vL) / stripPx);
      // Side covers are a touch darker. Only this cover owns these columns (nearer ones are drawn
      // later, on top), and darkening black is a no-op, so a plain rectangle does it.
      g.globalAlpha = DIM * (s.a < 1 ? s.a : 1);
      g.fillStyle = '#000';
      g.fillRect(s.vL, top, s.vR - s.vL, cy + 104 - top);
      g.globalAlpha = 1;
    }
    return cols;
  }

  // The flipping album: a card that turns about its vertical axis while growing from the cover into
  // the panel. The front shows the cover (its reflection fading out), the back the track list.
  function drawFlip(g, r, cy) {
    const e = easeInOut(flip);
    // In cover units (1 = S px when flat at the center depth), seen with focal F·FLIP_ZOOM from D·FLIP_ZOOM.
    const f = F * FLIP_ZOOM;
    const z = -D * FLIP_ZOOM;
    const hw = (S + (PANEL.w - S) * e) / S / 2;
    const ph = (S + (PANEL.h - S) * e) / S;
    const midY = cy + (PANEL.y + PANEL.h / 2 - (r.y + CY)) * e;
    const front = e < 0.5;
    // Past edge-on the back face is what shows; it turns the rest of the way toward the viewer.
    const phi = front ? Math.PI * e : Math.PI * e - Math.PI;
    const ea = edgeX(0, z, phi, -hw, f);
    const eb = edgeX(0, z, phi, hw, f);
    const x0 = Math.max(0, Math.min(ea, eb));
    const x1 = Math.min(SCREEN_W, Math.max(ea, eb));
    if (front) {
      const b = bakeFor(art, flipAlbum.id);
      drawPlane(g, b.full, 0, TEX, 0, z, phi, hw, ph, midY, -0.5, 0.5, x0, x1, stripPx, f);
      const fade = 1 - 2 * e;
      if (fade > 0.01) {
        g.globalAlpha = fade;
        drawPlane(g, b.full, TEX, b.full.height - TEX, 0, z, phi, hw, ph, midY, 0.5, BAKE_BOTTOM, x0, x1, stripPx, f);
        g.globalAlpha = 1;
      }
    } else {
      drawPlane(g, panelCanvas, 0, panelCanvas.height, 0, z, phi, hw, ph, midY, -0.5, 0.5, x0, x1, stripPx, f);
    }
  }

  function drawCaption(g, r) {
    const album = albums[Math.round(flip > 0 ? target : p)];
    if (!album) return;
    const c = caption(album, g);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.font = FONTS.cfTitle;
    g.fillStyle = C.cfTitle;
    g.fillText(c.title, r.x + CX, 208);
    g.font = FONTS.cfArtist;
    g.fillStyle = C.cfArtist;
    g.fillText(c.artist, r.x + CX, 224);
  }

  const screen = {
    id: 'coverflow',
    title: 'Cover Flow',
    stats,

    enter() {
      let i = -1;
      const cur = player.current;
      if (cur && cur.kind === 'song') i = indexOfAlbumId(cur.albumId);
      if (i < 0 && lastAlbumId) i = indexOfAlbumId(lastAlbumId);
      p = target = Math.max(0, i);
      flip = flipTarget = 0;
      lastNow = 0;
      captions.clear();
    },

    resume() {
      lastNow = 0;
      captions.clear();
      if (flip === 1) renderPanelCanvas();
    },

    exit() {
      if (n) lastAlbumId = albums[Math.round(target)].id;
    },

    // The OS calls this on the top screen after player events and os.invalidate().
    refresh() {
      captions.clear();
    },

    animating() {
      return p !== target || flip !== flipTarget;
    },

    highlight() {
      if (!n) return null;
      if (flipTarget === 1 && flipAlbum) return { index: row, label: flipAlbum.tracks[row].title };
      const i = Math.round(target);
      return { index: i, label: albums[i].title };
    },

    handle(e) {
      if (!n) return undefined;
      if (e.type === 'scroll') {
        if (flipTarget === 1) {
          const next = Math.max(0, Math.min(flipAlbum.tracks.length - 1, row + e.delta));
          if (next === row) return false;
          row = next;
          clampRowWindow();
          if (flip !== 1) renderPanelCanvas();
          return true;
        }
        if (flip !== 0) return false;
        const next = Math.max(0, Math.min(n - 1, target + e.delta));
        if (next === target) return false;
        if (p === target) lastNow = 0;
        target = next;
        lastAlbumId = albums[target].id;
        return true;
      }
      if (e.type === 'press' && e.part === 'select') {
        if (flipTarget === 0) {
          startFlip(1);
          return true;
        }
        if (flip !== 1) return false;
        const tracks = flipAlbum.tracks;
        player.playQueue(tracks, row);
        ctx.nowPlaying();
        return true;
      }
      if (e.type === 'press' && e.part === 'menu' && flipTarget === 1) {
        startFlip(0);
        return true;
      }
      return undefined;
    },

    draw(g, r, now) {
      const t0 = performance.now();
      g.save();
      advance(now);
      g.fillStyle = C.cfBg;
      g.fillRect(r.x, r.y, r.w, r.h);
      if (!n) {
        g.font = FONTS.cfTitle;
        g.fillStyle = C.cfArtist;
        g.textAlign = 'center';
        g.fillText('No Albums', r.x + CX, r.y + r.h / 2);
        g.restore();
        return;
      }
      // Columns are in screen space; the OS slides whole screens with translate, so only x shifts.
      g.translate(r.x, 0);
      const cy = r.y + CY;
      layout();
      const flipping = flip > 0 || flipTarget > 0;
      const skip = flipping ? Math.round(target) : -1;
      let cols = drawCovers(g, r.y, cy, skip);
      if (flipping) {
        if (flip > 0) {
          g.globalAlpha = PANEL_DIM * easeInOut(flip);
          g.fillStyle = '#000';
          g.fillRect(0, r.y, SCREEN_W, cy + 104 - r.y);
          g.globalAlpha = 1;
        }
        if (flip === 1) drawPanel(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
        else {
          drawFlip(g, r, cy);
          cols += 112;
        }
      }
      g.translate(-r.x, 0);
      drawCaption(g, r);
      g.restore();

      // Frame cost bookkeeping (and the 2 px strip fallback) for animated frames only.
      const ms = performance.now() - t0;
      if (screen.animating()) {
        stats.frames++;
        stats.lastMs = ms;
        stats.totalMs += ms;
        if (ms > stats.maxMs) stats.maxMs = ms;
        stats.columns = cols;
        if (ms > SLOW_MS) {
          if (++slowCount >= SLOW_FRAMES && stripPx === 1) stripPx = 2;
        } else slowCount = 0;
        stats.stripPx = stripPx;
      }
    },
  };
  return screen;
}
