// Main menu and the Music subtree, following the 5G menu tree (design spec 6.6), with Cover Flow
// added as the first Music item the way the 6G classic had it.

import { createRng, hashString } from '../../util/rng.js';
import { createSettings } from './settings.js';
import { createSearch } from './search.js';

// ---------------------------------------------------------------- sorting

// The assPod files "The Beatles" under B, so leading articles are ignored when sorting.
function sortKey(s) {
  return String(s ?? '').replace(/^(the|a|an)\s+/i, '').toLowerCase();
}

function byKey(get) {
  return (a, b) => {
    const ka = sortKey(get(a));
    const kb = sortKey(get(b));
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
}

/** Album order, then track number: how "All" lists songs for an artist or genre. */
function albumOrder(library) {
  const pos = new Map(library.albums.map((a, i) => [a.id, i]));
  return (a, b) => (pos.get(a.albumId) ?? 0) - (pos.get(b.albumId) ?? 0) || (a.trackNo ?? 0) - (b.trackNo ?? 0);
}

// ---------------------------------------------------------------- song lists

/**
 * A list of songs (or videos, in playlists). Selecting row i plays the whole list from i,
 * the way the assPod queues whatever list you picked from, then opens Now Playing.
 */
export function songList(ctx, id, title, list) {
  const items = list.map((t, i) => ({
    label: t.title,
    speaker: () => ctx.player.current?.id === t.id && ctx.player.state !== 'stopped',
    action: (c) => {
      c.player.playQueue(list, i);
      c.nowPlaying();
      return true;
    },
  }));
  return ctx.menu({ id, title, items });
}

export function albumSongs(ctx, album) {
  const tracks = album.tracks.slice().sort((a, b) => (a.trackNo ?? 0) - (b.trackNo ?? 0));
  return songList(ctx, 'album', album.title, tracks);
}

/** Artist screen: "All" plus the artist's albums (optionally only those in one genre). */
function artistMenu(ctx, artist, genre) {
  const lib = ctx.library;
  let albums = lib.albumsBy(artist);
  if (genre) albums = albums.filter((a) => a.genre === genre);
  albums = albums.slice().sort(byKey((a) => a.title));
  const filter = genre ? { artist, genre } : { artist };
  return ctx.menu({
    id: 'artist',
    title: artist,
    items: [
      { id: 'all', label: 'All', open: (c) => songList(c, 'songs', artist, lib.tracksBy(filter).slice().sort(albumOrder(lib))) },
      ...albums.map((a) => ({ label: a.title, open: (c) => albumSongs(c, a) })),
    ],
  });
}

function artistsMenu(ctx) {
  return ctx.menu({
    id: 'artists',
    title: 'Artists',
    items: ctx.library.artists.map((name) => ({ label: name, open: (c) => artistMenu(c, name) })),
  });
}

function albumsMenu(ctx) {
  const albums = ctx.library.albums.slice().sort(byKey((a) => a.title));
  return ctx.menu({
    id: 'albums',
    title: 'Albums',
    items: albums.map((a) => ({ label: a.title, open: (c) => albumSongs(c, a) })),
  });
}

function songsMenu(ctx) {
  return songList(ctx, 'songs', 'Songs', ctx.library.tracks.slice().sort(byKey((t) => t.title)));
}

function playlistsMenu(ctx) {
  return ctx.menu({
    id: 'playlists',
    title: 'Playlists',
    // items() is evaluated on open, so Recently Played and Top Rated are current.
    items: ctx.library.playlists.map((p) => ({ label: p.title, open: (c) => songList(c, 'playlist', p.title, p.items()) })),
  });
}

/** Genres -> artists in that genre ("All" first) -> that artist's albums in the genre -> songs. */
function genresMenu(ctx) {
  const lib = ctx.library;
  return ctx.menu({
    id: 'genres',
    title: 'Genres',
    items: lib.genres.map((genre) => ({
      label: genre,
      open: (c) => {
        const tracks = lib.tracksBy({ genre });
        const artists = [...new Set(tracks.map((t) => t.artist))].sort(byKey((a) => a));
        return c.menu({
          id: 'genre',
          title: genre,
          items: [
            { id: 'all', label: 'All', open: (cc) => songList(cc, 'songs', genre, tracks.slice().sort(albumOrder(lib))) },
            ...artists.map((a) => ({ label: a, open: (cc) => artistMenu(cc, a, genre) })),
          ],
        });
      },
    })),
  });
}

function composersMenu(ctx) {
  const lib = ctx.library;
  return ctx.menu({
    id: 'composers',
    title: 'Composers',
    items: lib.composers.map((name) => ({
      label: name,
      open: (c) => songList(c, 'songs', name, lib.tracksBy({ composer: name }).slice().sort(byKey((t) => t.title))),
    })),
  });
}

// ---------------------------------------------------------------- Music

export function createMusicMenu(ctx) {
  const lib = ctx.library;
  return ctx.menu({
    id: 'music',
    title: 'Music',
    items: [
      { id: 'coverflow', label: 'Cover Flow', open: (c) => c.apps.coverFlow(c) },
      { id: 'playlists', label: 'Playlists', open: playlistsMenu },
      { id: 'artists', label: 'Artists', open: artistsMenu },
      { id: 'albums', label: 'Albums', open: albumsMenu },
      { id: 'songs', label: 'Songs', open: songsMenu },
      // The 5G shows Podcasts and Audiobooks even when there are none: an empty white list.
      { id: 'podcasts', label: 'Podcasts', open: (c) => songList(c, 'podcasts', 'Podcasts', lib.podcasts ?? []) },
      { id: 'genres', label: 'Genres', open: genresMenu },
      { id: 'composers', label: 'Composers', open: composersMenu },
      { id: 'audiobooks', label: 'Audiobooks', open: (c) => songList(c, 'audiobooks', 'Audiobooks', lib.audiobooks ?? []) },
      { id: 'search', label: 'Search', open: (c) => createSearch(c) },
    ],
  });
}

// ---------------------------------------------------------------- main menu

let shuffleCount = 0;

function shuffleSongs(ctx) {
  const tracks = ctx.library.tracks;
  if (!tracks.length) return false;
  // A fresh order every time; seeded through rng.js so the shuffle is uniform and cheap.
  const seed = hashString(`${Date.now()}:${ctx.now()}:${++shuffleCount}`);
  ctx.player.playQueue(createRng(seed).shuffle(tracks), 0);
  ctx.nowPlaying();
  return true;
}

export function createMainMenu(ctx) {
  const base = [
    { id: 'music', label: 'Music', open: createMusicMenu },
    { id: 'videos', label: 'Videos', open: (c) => c.apps.videos(c) },
    { id: 'extras', label: 'Extras', open: (c) => c.apps.extras(c) },
    { id: 'settings', label: 'Settings', open: createSettings },
    { id: 'reposition', label: 'Reposition', open: (c) => c.apps.reposition(c) },
    {
      id: 'color',
      label: 'Color',
      detail: () => (ctx.settings.get('finish') === 'white' ? 'White' : 'Black'),
      action: (c) => { c.settings.set('finish', c.settings.get('finish') === 'white' ? 'black' : 'white'); return true; },
    },
    { id: 'shuffle', label: 'Shuffle Songs', action: shuffleSongs },
    { id: 'backlight', label: 'Backlight', action: (c) => { c.os.toggleBacklight(); return false; } },
  ];
  const withNowPlaying = [
    ...base,
    { id: 'nowplaying', label: 'Now Playing', chevron: true, action: (c) => { c.nowPlaying(); return true; } },
  ];
  return ctx.menu({
    id: 'main',
    title: 'assPod',
    // Like the 5G, Now Playing is listed only while something is queued (not after the queue ends).
    items: () => (ctx.player.current && ctx.player.state !== 'stopped' ? withNowPlaying : base),
  });
}
