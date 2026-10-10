// The music and video catalog, built from what the daemon read out of VLC's media library (its
// saved Media Library list and its My Music / My Videos folders) with ffprobe tags. Same shape as
// the screens expect: albums, tracks, videos, playlists, artists, genres, composers and the
// query helpers. load() swaps the whole catalog in place, so the screens' `ctx.library` stays valid.
//
// Ratings and play counts live in settings (`ratings`, `plays`, memory only) and are mirrored onto
// the track objects.
import { hashString } from '../util/rng.js';

/**
 * @typedef {{ id: string, kind: 'song', path: string, title: string, artist: string, album: string,
 *   albumId: string, genre: string, composer: string, trackNo: number, discNo: number, duration: number,
 *   year: number, added: number, art: string|null, rating: number, playCount: number, lastPlayed: number }} Track
 * @typedef {{ id: string, kind: 'video', path: string, title: string, artist: string,
 *   category: 'Movies'|'Music Videos'|'TV Shows'|'Video Podcasts', duration: number, added: number,
 *   art: string|null }} Video
 * @typedef {{ id: string, title: string, artist: string, genre: string, year: number, composer: string,
 *   art: string|null, tracks: Track[] }} Album
 * @typedef {{ id: string, title: string, items: () => (Track|Video)[] }} Playlist
 */

const UNKNOWN_ARTIST = 'Unknown Artist';
const UNKNOWN_ALBUM = 'Unknown Album';
const CATEGORIES = new Set(['Movies', 'Music Videos', 'TV Shows', 'Video Podcasts']);

const sortKey = (s) => String(s ?? '').replace(/^(the|a|an)\s+/i, '').toLowerCase();
const byKey = (a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { numeric: true });
const str = (v, dflt = '') => (typeof v === 'string' && v.trim() ? v.trim() : dflt);
const num = (v, dflt = 0) => (Number.isFinite(Number(v)) ? Number(v) : dflt);

/** @param {{ get(k: string): any, set(k: string, v: any): void, on(t: string, f: Function): void }} settings */
export function createLibrary(settings) {
  /** @type {Album[]} */ const albums = [];
  /** @type {Track[]} */ const tracks = [];
  /** @type {Video[]} */ const videos = [];
  /** @type {Playlist[]} */ const playlists = [];
  const artists = [];
  const genres = [];
  const composers = [];
  const onTheGo = [];
  const byId = new Map();
  const albumById = new Map();
  const listeners = new Set();
  let info = { sources: [], scanned: 0, at: 0 };

  function applyStored() {
    const ratings = settings.get('ratings') ?? {};
    const plays = settings.get('plays') ?? {};
    for (const t of tracks) {
      const r = ratings[t.id];
      t.rating = Number.isFinite(r) ? r : 0;
      const p = plays[t.id];
      t.playCount = Array.isArray(p) ? p[0] : 0;
      t.lastPlayed = Array.isArray(p) ? p[1] : 0;
    }
  }
  settings.on('change', ({ key }) => {
    if (key === 'ratings' || key === 'plays' || key === '*') applyStored();
  });

  const replace = (arr, items) => { arr.length = 0; arr.push(...items); };

  /**
   * @param {{ tracks?: object[], videos?: object[], playlists?: { id: string, title: string, items: string[] }[],
   *   sources?: string[], scanned?: number }} data
   */
  function load(data) {
    const d = data && typeof data === 'object' ? data : {};
    byId.clear();
    albumById.clear();
    const newTracks = [];
    const albumMap = new Map();
    for (const r of Array.isArray(d.tracks) ? d.tracks : []) {
      if (!r || typeof r.id !== 'string' || typeof r.path !== 'string') continue;
      const artist = str(r.artist, UNKNOWN_ARTIST);
      const albumArtist = str(r.albumArtist, artist);
      const albumTitle = str(r.album, UNKNOWN_ALBUM);
      const albumId = 'al' + hashString(`${sortKey(albumArtist)}\u0000${albumTitle.toLowerCase()}`).toString(36);
      /** @type {Track} */
      const t = {
        id: r.id, kind: 'song', path: r.path,
        title: str(r.title, r.path.split('/').pop()),
        artist, album: albumTitle, albumId,
        genre: str(r.genre, 'Unknown'), composer: str(r.composer, artist),
        trackNo: num(r.trackNo), discNo: num(r.discNo, 1), duration: Math.max(1, num(r.duration, 0)),
        year: num(r.year), added: num(r.added), art: typeof r.art === 'string' ? r.art : null,
        rating: 0, playCount: 0, lastPlayed: 0,
      };
      let al = albumMap.get(albumId);
      if (!al) {
        al = { id: albumId, title: albumTitle, artist: albumArtist, genre: t.genre, year: t.year, composer: t.composer,
          art: t.art, tracks: [] };
        albumMap.set(albumId, al);
      }
      if (!al.art && t.art) al.art = t.art;
      if (!al.year && t.year) al.year = t.year;
      al.tracks.push(t);
      newTracks.push(t);
    }
    for (const al of albumMap.values()) {
      al.tracks.sort((a, b) => a.discNo - b.discNo || a.trackNo - b.trackNo || byKey(a.title, b.title));
      // A compilation (several artists, no album artist): the album is listed under its most common artist.
      if (al.artist === UNKNOWN_ARTIST) al.artist = al.tracks[0].artist;
    }
    const newAlbums = [...albumMap.values()].sort((a, b) => byKey(a.title, b.title));
    replace(albums, newAlbums);
    replace(tracks, newAlbums.flatMap((a) => a.tracks));

    const newVideos = [];
    for (const r of Array.isArray(d.videos) ? d.videos : []) {
      if (!r || typeof r.id !== 'string' || typeof r.path !== 'string') continue;
      newVideos.push({
        id: r.id, kind: 'video', path: r.path, title: str(r.title, r.path.split('/').pop()), artist: str(r.artist),
        category: CATEGORIES.has(r.category) ? r.category : 'Movies',
        duration: Math.max(1, num(r.duration, 0)), added: num(r.added), art: typeof r.art === 'string' ? r.art : null,
      });
    }
    replace(videos, newVideos);
    for (const t of tracks) byId.set(t.id, t);
    for (const v of videos) byId.set(v.id, v);
    for (const a of albums) albumById.set(a.id, a);

    const uniq = (list) => [...new Set(list)].sort(byKey);
    replace(artists, uniq(albums.map((a) => a.artist).concat(tracks.map((t) => t.artist))));
    replace(genres, uniq(tracks.map((t) => t.genre)));
    replace(composers, uniq(tracks.map((t) => t.composer)));
    onTheGo.length = 0;

    // Playlists: the VLC Media Library list and playlist files first, then the smart ones.
    const lists = [];
    for (const p of Array.isArray(d.playlists) ? d.playlists : []) {
      if (!p || typeof p.title !== 'string' || !Array.isArray(p.items)) continue;
      const ids = p.items.filter((x) => typeof x === 'string');
      lists.push({ id: String(p.id || p.title), title: p.title, items: () => ids.map((id) => byId.get(id)).filter(Boolean) });
    }
    lists.push(
      {
        id: 'top-rated', title: 'My Top Rated',
        items: () => tracks.filter((t) => t.rating >= 4).sort((a, b) => b.rating - a.rating || b.playCount - a.playCount),
      },
      {
        id: 'recently-added', title: 'Recently Added',
        items: () => tracks.slice().sort((a, b) => b.added - a.added || a.trackNo - b.trackNo).slice(0, 25),
      },
      {
        id: 'recently-played', title: 'Recently Played',
        items: () => tracks.filter((t) => t.lastPlayed > 0).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 25),
      },
      {
        id: 'top-25', title: 'Top 25 Most Played',
        items: () => tracks.filter((t) => t.playCount > 0).sort((a, b) => b.playCount - a.playCount || b.lastPlayed - a.lastPlayed).slice(0, 25),
      },
      { id: 'on-the-go', title: 'On-The-Go', items: () => onTheGo.slice() },
    );
    replace(playlists, lists);
    info = { sources: Array.isArray(d.sources) ? d.sources.slice(0, 20) : [], scanned: num(d.scanned), at: Date.now() };
    applyStored();
    for (const f of listeners) { try { f(); } catch (_) { /* a listener's bug */ } }
  }

  function getAlbum(id) { return albumById.get(id) ?? null; }
  function getTrack(id) { return byId.get(id) ?? null; }
  function albumsBy(artist) { return albums.filter((a) => a.artist === artist || a.tracks.some((t) => t.artist === artist)); }
  function tracksBy(filter = {}) {
    return tracks.filter((t) => (filter.artist === undefined || t.artist === filter.artist)
      && (filter.albumId === undefined || t.albumId === filter.albumId)
      && (filter.genre === undefined || t.genre === filter.genre)
      && (filter.composer === undefined || t.composer === filter.composer));
  }
  function search(q) {
    const s = String(q ?? '').trim().toLowerCase();
    if (!s) return { artists: [], albums: [], tracks: [] };
    return {
      artists: artists.filter((a) => a.toLowerCase().includes(s)),
      albums: albums.filter((a) => a.title.toLowerCase().includes(s)),
      tracks: tracks.filter((t) => t.title.toLowerCase().includes(s)),
    };
  }

  return {
    albums, tracks, videos, playlists, podcasts: [], audiobooks: [], artists, genres, composers, onTheGo,
    getAlbum, getTrack, albumsBy, tracksBy, search, load,
    get info() { return info; },
    onLoad(f) { listeners.add(f); return () => listeners.delete(f); },
  };
}
