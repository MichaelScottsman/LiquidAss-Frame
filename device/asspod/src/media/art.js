// Cover art and video thumbnails from the VLC media library. The daemon extracts them with ffmpeg
// (embedded art, or a cover.jpg / folder.jpg beside the files; a frame for videos) and hands them
// over as JPEG bytes. SteamVR's pages forbid data: URLs (CSP), so the bytes are decoded with
// createImageBitmap, which fetches nothing.
//
// cover(albumId) always returns a 256 px canvas: a drawn tile (the album's initials on a colour
// from its name) until the real cover arrives, then a new canvas. Screens notice the new object
// (Cover Flow re-bakes, Now Playing re-scales), and onChange() redraws them.
import { hashString } from '../util/rng.js';

const SIZE = 256;
const SANS = '"LGS Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';

function makeCanvas(w = SIZE, h = SIZE) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** A cover for an album without art: a two-tone gradient from its name, and its initials. */
function drawTile(g, title, artist) {
  const h = hashString(`${title}\u0000${artist}`);
  const hue = h % 360;
  const gr = g.createLinearGradient(0, 0, SIZE, SIZE);
  gr.addColorStop(0, `hsl(${hue} 55% 46%)`);
  gr.addColorStop(1, `hsl(${(hue + 40) % 360} 60% 22%)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, SIZE, SIZE);
  const words = String(title || '?').replace(/^(the|a|an)\s+/i, '').split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 96px ${SANS}`;
  g.fillText(initials, SIZE / 2, SIZE / 2 - 10);
  g.font = `600 18px ${SANS}`;
  g.fillStyle = 'rgba(255,255,255,0.7)';
  const a = String(artist || '');
  g.fillText(a.length > 24 ? a.slice(0, 23) + '…' : a, SIZE / 2, SIZE - 34);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * @param {{ library: any, request(key: string): void, onChange(): void }} opts
 *   request(key) asks the daemon for the art behind `key` (a library art key); it answers through
 *   receive(key, base64 | null).
 */
export function createArt({ library, request, onChange }) {
  const tiles = new Map();     // albumId -> drawn tile
  const images = new Map();    // art key -> canvas (null: the daemon has none)
  const asked = new Set();

  function want(key) {
    if (!key || images.has(key) || asked.has(key)) return;
    asked.add(key);
    try { request(key); } catch (_) { asked.delete(key); }
  }

  function tile(album) {
    let c = tiles.get(album.id);
    if (!c) {
      c = makeCanvas();
      drawTile(c.getContext('2d'), album.title, album.artist);
      tiles.set(album.id, c);
    }
    return c;
  }

  return {
    cover(albumId) {
      const album = library.getAlbum(albumId);
      if (!album) return this.placeholder();
      const img = album.art ? images.get(album.art) : undefined;
      if (img) return img;
      want(album.art);
      return tile(album);
    },
    /** A video's thumbnail canvas, or null until it arrives (or when there is none). */
    thumb(video) {
      if (!video || !video.art) return null;
      const img = images.get(video.art);
      if (img === undefined) want(video.art);
      return img || null;
    },
    placeholder() { return null; },
    /** The daemon's answer to request(key). */
    async receive(key, b64) {
      asked.delete(key);
      if (!b64) { images.set(key, null); return; }
      try {
        const bmp = await createImageBitmap(new Blob([b64ToBytes(b64)], { type: 'image/jpeg' }));
        const w = bmp.width >= bmp.height ? SIZE : Math.round(SIZE * bmp.width / bmp.height);
        const h = bmp.width >= bmp.height ? Math.round(SIZE * bmp.height / bmp.width) : SIZE;
        // Covers are square; a thumbnail keeps its aspect.
        const square = !String(key).startsWith('v:');
        const c = makeCanvas(square ? SIZE : w, square ? SIZE : h);
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(bmp, 0, 0, c.width, c.height);
        bmp.close?.();
        images.set(key, c);
      } catch (_) {
        images.set(key, null);
      }
      onChange();
    },
    /** Forgets everything (a new library). */
    clear() {
      tiles.clear();
      images.clear();
      asked.clear();
    },
    get stats() { return { tiles: tiles.size, images: images.size, pending: asked.size }; },
  };
}
