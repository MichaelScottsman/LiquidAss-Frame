// Videos: the 5G's Videos menu over the VLC media library's videos. VLC plays the sound; the
// picture comes from the daemon (device/shell_ext/asspod.py runs ffmpeg on the same file, in step
// with VLC's clock, and sends small frames: art.videoFrame), drawn letterboxed on the screen with the
// overlays on top. Until the first frame arrives the screen shows the thumbnail. Leaving the screen
// keeps it playing; Now Playing brings it back. With podd (art.videoExternal) the frames go to podd
// instead, which shows them in a panel under the screen: this screen is then clear but for its overlays.
import { C, font } from '../os/theme.js';
import { SCREEN_W, SCREEN_H } from '../config.js';

const OVERLAY_MS = 3000;
const VOLUME_MS = 2000;
const SCRUB_MS = 4000;
const SCRUB_STEP_S = 10;
const OV = { x: 0, y: 196, w: 320, h: 44 };
const CATEGORIES = ['Movies', 'Music Videos', 'TV Shows', 'Video Podcasts'];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function text(g, s, x, y, f, color, align = 'center') {
  g.font = f;
  g.fillStyle = color;
  g.textAlign = align;
  g.fillText(s, x, y);
}

// ---------------------------------------------------------------- player screen
export function videoPlayer(ctx, video, opts = {}) {
  const { player, ui, art } = ctx;
  let current = video;
  let started = false;
  let overlayUntil = 0;
  let volumeUntil = 0;
  let showOverlay = true;         // applied on the next frame, which knows the time
  let showVolume = false;
  let scrubUntil = 0;           // scrub mode (Select): the wheel seeks; ends SCRUB_MS after the last turn
  let scrubKick = false;
  let offs = [];
  let lastT = 0;

  const isVideo = (item) => !!item && item.kind === 'video';

  function follow() {
    const cur = player.current;
    if (!isVideo(cur) || player.state === 'stopped') {
      // Leave on the next tick: popping inside a player event would reenter the OS mid-update.
      queueMicrotask(() => {
        const c = player.current;
        if (offs.length && (!isVideo(c) || player.state === 'stopped')) ctx.pop();
      });
      return;
    }
    if (cur !== current) {
      current = cur;
      showOverlay = true;
    }
  }

  function position() {
    if (player.current === current) return Math.min(current.duration, Math.max(0, player.position));
    return lastT;
  }

  const screen = {
    id: 'videoplayer',
    title: () => current.title,
    fullscreen: true,
    keepAwake: true,
    // the picture: redraw as frames arrive (24 a second); with podd only the overlay's clock
    get refreshMs() {
      if (player.state !== 'playing') return 0;
      if (art.videoExternal) return overlayUntil || scrubUntil ? 250 : 0;
      return 40;
    },
    get transparent() { return !!art.videoExternal; },

    enter() {
      if (opts.start && !started) {
        started = true;
        const queue = opts.queue && opts.queue.length ? opts.queue : [video];
        const i = Math.max(0, queue.indexOf(video));
        player.playQueue(queue, i);
      }
      current = isVideo(player.current) ? player.current : video;
      showOverlay = true;
      offs = [player.on('track', follow), player.on('state', follow)];
    },
    exit() {
      for (const off of offs) off?.();
      offs = [];
    },
    resume() { showOverlay = true; },

    animating(now) {
      return showOverlay || showVolume || scrubKick || (overlayUntil > 0 && now >= overlayUntil) || (volumeUntil > 0 && now >= volumeUntil)
        || (scrubUntil > 0 && now >= scrubUntil);
    },

    highlight() { return { index: 0, label: current.title }; },

    handle(e) {
      if (e.type === 'scroll' && scrubUntil) {
        // tracking: 10 s per detent through the video
        const d = current.duration || 0;
        const to = Math.max(0, Math.min(Math.max(0, d - 1), position() + e.delta * SCRUB_STEP_S));
        if (player.current === current) player.seek(to);
        scrubKick = true;
        return true;
      }
      if (e.type === 'scroll') {
        const v = Math.round(Math.max(0, Math.min(1, player.volume + e.delta / 16)) * 16) / 16;
        showVolume = true;
        if (v === player.volume) return false;
        player.setVolume(v);
        return true;
      }
      if (e.type === 'press' && e.part === 'select') {
        // Select: the scrubber (the wheel then tracks through the video); again: back to volume
        if (scrubUntil) scrubUntil = 0;
        else { scrubKick = true; showOverlay = true; }
        return true;
      }
      if (e.type === 'press' && e.part === 'menu') {
        // It keeps playing in the background; Now Playing brings this screen back.
        ctx.pop();
        return true;
      }
      return undefined;
    },

    draw(g, r, now) {
      if (showOverlay) { overlayUntil = now + OVERLAY_MS; showOverlay = false; volumeUntil = 0; }
      if (showVolume) { volumeUntil = now + VOLUME_MS; showVolume = false; overlayUntil = 0; }
      if (overlayUntil && now >= overlayUntil) overlayUntil = 0;
      if (volumeUntil && now >= volumeUntil) volumeUntil = 0;
      if (scrubKick) { scrubUntil = now + SCRUB_MS; overlayUntil = Math.max(overlayUntil, scrubUntil); volumeUntil = 0; scrubKick = false; }
      if (scrubUntil && now >= scrubUntil) scrubUntil = 0;

      const t = position();
      lastT = t;
      g.save();
      if (art.videoExternal) {
        g.textBaseline = 'alphabetic';
        if (overlayUntil || player.state === 'paused') drawOverlay(g, r, t);
        else if (volumeUntil) drawVolumeOverlay(g, r);
        g.restore();
        return;
      }
      g.fillStyle = '#000';
      g.fillRect(r.x, r.y, r.w, r.h);
      // The video's picture (or, until it arrives, its thumbnail), letterboxed to the screen.
      const vf = art.videoFrame && art.videoFrame.path === current.path ? art.videoFrame.image : null;
      const thumb = vf || (art.thumb ? art.thumb(current) : null);
      if (thumb) {
        const k = Math.min(SCREEN_W / thumb.width, SCREEN_H / thumb.height);
        const w = thumb.width * k;
        const h = thumb.height * k;
        g.imageSmoothingQuality = 'high';
        g.drawImage(thumb, r.x + (SCREEN_W - w) / 2, r.y + (SCREEN_H - h) / 2, w, h);
      } else {
        text(g, current.title, r.x + 160, r.y + 112, font(16, 700), '#ffffff');
        if (current.artist) text(g, current.artist, r.x + 160, r.y + 134, font(12, 400), '#9c9c9c');
      }
      g.textBaseline = 'alphabetic';
      if (overlayUntil || player.state === 'paused') drawOverlay(g, r, t);
      else if (volumeUntil) drawVolumeOverlay(g, r);
      g.restore();
    },
  };

  function drawOverlay(g, r, t) {
    const x = r.x + OV.x;
    const y = r.y + OV.y;
    g.fillStyle = C.overlay;
    g.fillRect(x, y, OV.w, OV.h);
    let tx = x + 10;
    if (player.state === 'paused') {
      g.fillStyle = '#ffffff';
      g.fillRect(tx, y + 7, 3, 10);
      g.fillRect(tx + 5, y + 7, 3, 10);
      tx += 14;
    }
    const remain = '-' + ui.formatTime(current.duration - t);
    const tf = font(12, 600);
    const sf = font(11, 600);
    g.font = sf;
    const rw = ui.measure(g, remain, sf);
    text(g, ui.ellipsize(g, current.title, tf, x + 310 - rw - 10 - tx), tx, y + 16, tf, '#ffffff', 'left');
    text(g, remain, x + 310, y + 16, sf, '#ffffff', 'right');
    const f = current.duration > 0 ? clamp01(t / current.duration) : 0;
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(x + 10, y + 26, 300, 6);
    g.fillStyle = '#ffffff';
    g.fillRect(x + 10, y + 26, 300 * f, 6);
    if (scrubUntil) {
      // the scrubber's diamond at the playhead
      const kx = x + 10 + 300 * f, ky = y + 29;
      g.beginPath();
      g.moveTo(kx, ky - 6); g.lineTo(kx + 6, ky); g.lineTo(kx, ky + 6); g.lineTo(kx - 6, ky);
      g.closePath();
      g.fillStyle = '#ffffff';
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 1;
    g.strokeRect(x + 10.5, y + 26.5, 299, 5);
    text(g, ui.formatTime(t), x + 10, y + 42, font(9, 600), '#d0d0d0', 'left');
  }

  function drawVolumeOverlay(g, r) {
    const x = r.x + OV.x;
    const y = r.y + OV.y;
    g.fillStyle = C.overlay;
    g.fillRect(x, y, OV.w, OV.h);
    ui.drawSpeaker(g, x + 12, y + 22, '#ffffff', false);
    ui.drawSpeaker(g, x + 296, y + 22, '#ffffff', true);
    const f = player.volume;
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(x + 30, y + 18, 260, 8);
    g.fillStyle = '#ffffff';
    g.fillRect(x + 30, y + 18, 260 * f, 8);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.strokeRect(x + 30.5, y + 18.5, 259, 7);
  }

  return screen;
}

// ---------------------------------------------------------------- menus
const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });

function playList(ctx, id, title, list) {
  return ctx.menu({
    id,
    title,
    items: () => list().map((v, i, all) => ({
      label: v.title,
      speaker: () => ctx.player.current === v && ctx.player.state !== 'stopped',
      open: (c) => videoPlayer(c, v, { start: true, queue: all }),
    })),
  });
}

// TV shows and podcasts are grouped by show (the artist field), then episodes.
function grouped(ctx, id, title, category) {
  const vids = () => ctx.library.videos.filter((v) => v.category === category);
  return ctx.menu({
    id,
    title,
    items: () => [...new Set(vids().map((v) => v.artist || 'Unknown'))].sort().map((show) => ({
      label: show,
      open: (c) => playList(c, `${id}-show`, show, () => vids().filter((v) => (v.artist || 'Unknown') === show).sort(byTitle)),
    })),
  });
}

export function videos(ctx) {
  const lib = ctx.library;
  const byCat = (cat) => () => lib.videos.filter((v) => v.category === cat).sort(byTitle);
  return ctx.menu({
    id: 'videos',
    title: 'Videos',
    items: [
      { label: 'All Videos', open: (c) => playList(c, 'allvideos', 'All Videos', () => lib.videos.slice().sort(byTitle)) },
      { label: 'Video Playlists', open: (c) => c.menu({
        id: 'videoplaylists',
        title: 'Video Playlists',
        items: () => lib.playlists
          .filter((p) => p.items().some((x) => x.kind === 'video'))
          .map((p) => ({ label: p.title, open: (c2) => playList(c2, 'videoplaylist', p.title, () => p.items().filter((x) => x.kind === 'video')) })),
      }) },
      { label: CATEGORIES[0], open: (c) => playList(c, 'movies', CATEGORIES[0], byCat(CATEGORIES[0])) },
      { label: CATEGORIES[1], open: (c) => playList(c, 'musicvideos', CATEGORIES[1], byCat(CATEGORIES[1])) },
      { label: CATEGORIES[2], open: (c) => grouped(c, 'tvshows', CATEGORIES[2], CATEGORIES[2]) },
      { label: CATEGORIES[3], open: (c) => grouped(c, 'videopodcasts', CATEGORIES[3], CATEGORIES[3]) },
    ],
  });
}
