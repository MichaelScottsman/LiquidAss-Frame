// Pure transport: queue, shuffle, repeat, seek, volume and ratings. Sound comes from an
// injected Engine (synth.js in the app, a fake in tests), so this module never touches audio.
import { Emitter } from '../util/emitter.js';
import { settings as defaultSettings } from '../settings.js';

/**
 * @typedef {import('./library.js').Track} Track
 * @typedef {import('./library.js').Video} Video
 * @typedef {{ play(item: Track|Video, offsetSec: number): void, stop(): void, readonly position: number,
 *   setVolume(v: number): void, tick?(): void }} Engine
 * @typedef {'stopped'|'playing'|'paused'} PlayState
 */

// ---------------------------------------------------------------- constants
const RESTART_AFTER_SEC = 3;     // Previous restarts the item past this point, as on the 5G
const FF_RATE = 4;               // FF/REW speed for the first FF_RAMP_SEC, then FF_RATE_FAST
const FF_RATE_FAST = 16;
const FF_RAMP_SEC = 2;
const COUNT_MIN_SEC = 30;        // a skip after this much listening (or half the item) still counts as a play
// Scrubbing seeks once per wheel detent, and every engine restart builds a whole synth session, so
// a seek while playing restarts the sound only after the seeks have settled for this long.
const SEEK_SETTLE_SEC = 0.25;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------- player
/**
 * @param {{ engine: Engine, settings?: typeof defaultSettings, random?: () => number, now?: () => number }} opts
 */
export function createPlayer({ engine, settings = defaultSettings, random = Math.random, now = () => Date.now() }) {
  return new Player(engine, settings, random, now);
}

class Player extends Emitter {
  #engine; #settings; #random; #now;
  /** @type {PlayState} */
  #state = 'stopped';
  /** @type {(Track|Video)[]} */
  #queue = [];
  #index = -1;
  #pausePos = 0;
  #seeking = 0;
  #seekPos = 0;
  #seekHeld = 0;
  #volume = 0.6;
  #listened = 0;
  #counted = false;
  #resumeIn = 0;                 // > 0: a seek is settling; the engine restarts at #pausePos when it runs out

  constructor(engine, settings, random, now) {
    super();
    this.#engine = engine;
    this.#settings = settings;
    this.#random = random;
    this.#now = now;
    this.#volume = clamp(Number(settings.get('volume') ?? 0.6) || 0, 0, 1);
    engine.setVolume(this.#volume);
    settings.on('change', ({ key }) => {
      if (key !== 'volume' && key !== '*') return;
      const v = clamp(Number(settings.get('volume') ?? 0.6) || 0, 0, 1);
      if (v === this.#volume) return;
      this.#volume = v;
      this.#engine.setVolume(v);
      this.emit('volume', { volume: v });
    });
  }

  /** (item) -> seconds to start it at (a video's saved place), or null: from the start. */
  startAt = null;

  // ---------------------------------------------------------------- read-only state
  get state() { return this.#state; }
  get current() { return this.#queue[this.#index] ?? null; }
  get queue() { return this.#queue; }
  get index() { return this.#index; }
  get duration() { return this.current?.duration ?? 0; }
  get volume() { return this.#volume; }
  get seeking() { return this.#seeking; }
  get position() {
    if (!this.current) return 0;
    if (this.#seeking) return this.#seekPos;
    if (this.#resumeIn > 0) return this.#pausePos;
    if (this.#state === 'playing') return clamp(this.#engine.position, 0, this.duration);
    return this.#pausePos;
  }

  // ---------------------------------------------------------------- queue
  playQueue(items, start = 0) {
    if (!items?.length) return;
    start = clamp(Math.floor(start) || 0, 0, items.length - 1);
    this.#leaveItem();
    this.#seeking = 0;
    const mode = this.#settings.get('shuffle');
    if (mode === 'songs') {
      const rest = items.filter((_, i) => i !== start);
      this.#queue = [items[start], ...this.#shuffle(rest)];
      this.#index = 0;
    } else if (mode === 'albums') {
      this.#queue = this.#shuffleAlbums(items, start);
      this.#index = 0;
    } else {
      this.#queue = items.slice();
      this.#index = start;
    }
    this.emit('queue', { queue: this.#queue });
    this.#load(this.#index, true);
  }

  #shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.#random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Whole albums in random order; the chosen album comes first, starting at the chosen item. */
  #shuffleAlbums(items, start) {
    const groups = new Map();
    for (const it of items) {
      const k = it.albumId ?? it.id;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    const chosen = items[start];
    const first = groups.get(chosen.albumId ?? chosen.id);
    groups.delete(chosen.albumId ?? chosen.id);
    const at = first.indexOf(chosen);
    const head = first.slice(at).concat(first.slice(0, at));
    return head.concat(...this.#shuffle([...groups.values()]));
  }

  // ---------------------------------------------------------------- transport
  togglePlay() {
    if (this.#state === 'playing') this.pause();
    else this.play();
  }

  play() {
    if (this.#seeking) this.stopSeek();
    if (this.#state === 'playing') return;
    if (!this.current) {
      if (this.#queue.length) this.#load(0, true);
      return;
    }
    this.#engine.play(this.current, this.#pausePos);
    this.#setState('playing');
  }

  pause() {
    if (this.#state !== 'playing') return;
    if (this.#seeking) this.stopSeek();
    this.#pausePos = this.position;
    this.#resumeIn = 0;
    this.#engine.stop();
    this.#setState('paused');
  }

  stop() {
    if (!this.current && this.#state === 'stopped') return;
    this.#leaveItem();
    this.#toStopped();
  }

  next() {
    if (!this.current) return;
    const autoplay = this.#state === 'playing';
    this.#seeking = 0;
    this.#leaveItem();
    if (this.#index + 1 < this.#queue.length) this.#load(this.#index + 1, autoplay);
    else if (this.#settings.get('repeat') === 'all') this.#load(0, autoplay);
    else this.#toStopped();
  }

  prev() {
    if (!this.current) return;
    if (this.position > RESTART_AFTER_SEC) {
      this.seek(0);
      if (this.#resumeIn > 0) this.#resume();   // a deliberate restart, not a scrub: no settling gap
      return;
    }
    const autoplay = this.#state === 'playing';
    this.#seeking = 0;
    this.#leaveItem();
    if (this.#index > 0) this.#load(this.#index - 1, autoplay);
    else if (this.#settings.get('repeat') === 'all' && this.#queue.length > 1) this.#load(this.#queue.length - 1, autoplay);
    else this.#load(this.#index, autoplay);
  }

  // ---------------------------------------------------------------- seeking
  seek(sec) {
    if (!this.current) return;
    const pos = clamp(Number(sec) || 0, 0, this.duration);
    if (this.#seeking) this.#seekPos = pos;
    else if (this.#state === 'playing') {
      // Silent until the seeks settle (update() restarts once); position reads the target meanwhile.
      if (this.#resumeIn <= 0) this.#engine.stop();
      this.#pausePos = pos;
      this.#resumeIn = SEEK_SETTLE_SEC;
    } else this.#pausePos = pos;
    this.emit('seek', { position: pos });
  }

  /** Restarts the sound at the settled seek target. */
  #resume() {
    this.#resumeIn = 0;
    if (this.#state === 'playing' && this.current) this.#engine.play(this.current, this.#pausePos);
  }

  /** FF/REW is silent: the engine stops and the position moves at 4x, then 16x after 2 s. */
  startSeek(dir) {
    if (!this.current || (dir !== 1 && dir !== -1)) return;
    if (this.#seeking === dir) return;
    if (!this.#seeking) {
      this.#seekPos = this.position;
      this.#resumeIn = 0;   // FF/REW takes over a settling seek; stopSeek() restarts the sound
      if (this.#state === 'playing') this.#engine.stop();
    }
    this.#seeking = dir;
    this.#seekHeld = 0;
    this.emit('seek', { position: this.#seekPos });
  }

  stopSeek() {
    if (!this.#seeking) return;
    this.#seeking = 0;
    if (!this.current) return;
    if (this.#state === 'playing') this.#engine.play(this.current, this.#seekPos);
    else this.#pausePos = this.#seekPos;
    this.emit('seek', { position: this.#seekPos });
  }

  // ---------------------------------------------------------------- volume and ratings
  setVolume(v) {
    const vol = clamp(Number(v), 0, 1);
    if (!Number.isFinite(vol) || vol === this.#volume) return;
    this.#volume = vol;
    this.#engine.setVolume(vol);
    this.#settings.set('volume', vol);
    this.emit('volume', { volume: vol });
  }

  rate(item, stars) {
    if (!item) return;
    const s = clamp(Math.round(Number(stars) || 0), 0, 5);
    item.rating = s;
    // Settings values are replaced, never mutated, so change listeners see a new object.
    this.#settings.set('ratings', { ...(this.#settings.get('ratings') ?? {}), [item.id]: s });
    this.emit('rating', { item });
  }

  // ---------------------------------------------------------------- frame update
  update(dt) {
    this.#engine.tick?.();
    const item = this.current;
    if (!item) return;
    if (this.#seeking) {
      this.#seekHeld += dt;
      const rate = this.#seekHeld < FF_RAMP_SEC ? FF_RATE : FF_RATE_FAST;
      let p = this.#seekPos + this.#seeking * rate * dt;
      if (p >= item.duration) {
        const hasNext = this.#index + 1 < this.#queue.length || this.#settings.get('repeat') === 'all';
        if (hasNext) {
          // Fast-forwarding off the end rolls into the next item and keeps going.
          const dir = this.#seeking;
          this.#leaveItem();
          this.#index = this.#index + 1 < this.#queue.length ? this.#index + 1 : 0;
          this.#listened = 0;
          this.#counted = false;
          this.#seeking = dir;
          this.#pausePos = 0;
          p = 0;
          this.#markPlayed(this.current);
          this.emit('track', { item: this.current, index: this.#index });
        } else p = item.duration;
      }
      this.#seekPos = clamp(p, 0, this.current.duration);
      this.emit('seek', { position: this.#seekPos });
      return;
    }
    if (this.#state !== 'playing') return;
    if (this.#resumeIn > 0) {
      // A seek is settling: silent until the seeks stop, then one restart at the target.
      this.#resumeIn -= dt;
      if (this.#resumeIn <= 0) this.#resume();
      return;
    }
    this.#listened += dt;
    if (this.#engine.position >= item.duration) this.#ended();
  }

  // ---------------------------------------------------------------- internals
  #ended() {
    this.#countPlay(true);
    const repeat = this.#settings.get('repeat');
    if (repeat === 'one') { this.#load(this.#index, true); return; }
    if (this.#index + 1 < this.#queue.length) this.#load(this.#index + 1, true);
    else if (repeat === 'all') this.#load(0, true);
    else { this.#engine.stop(); this.#toStopped(); }
  }

  #load(index, autoplay) {
    this.#engine.stop();
    this.#index = index;
    this.#resumeIn = 0;
    this.#listened = 0;
    this.#counted = false;
    const item = this.current;
    let at = this.startAt ? Math.max(0, Number(this.startAt(item)) || 0) : 0;
    if (item.duration > 1) at = Math.min(at, item.duration - 1);
    this.#pausePos = at;
    if (autoplay) {
      this.#engine.play(item, at);
      this.#markPlayed(item);
    }
    this.emit('track', { item, index });
    this.#setState(autoplay ? 'playing' : 'paused');
  }

  #toStopped() {
    this.#engine.stop();
    this.#seeking = 0;
    this.#index = -1;
    this.#pausePos = 0;
    this.#resumeIn = 0;
    this.emit('track', { item: null, index: -1 });
    this.#setState('stopped');
  }

  #setState(s) {
    if (this.#state === s) return;
    this.#state = s;
    this.emit('state', { state: s });
  }

  /** Counts the outgoing item as played if it was listened to long enough, then stops the engine. */
  #leaveItem() {
    if (this.current) this.#countPlay(false);
    this.#engine.stop();
  }

  #countPlay(completed) {
    const item = this.current;
    if (!item || this.#counted) return;
    if (!completed && this.#listened < Math.min(COUNT_MIN_SEC, item.duration * 0.5)) return;
    this.#counted = true;
    item.playCount = (item.playCount ?? 0) + 1;
    item.lastPlayed = this.#now();
    this.#persistPlays(item);
  }

  #markPlayed(item) {
    item.lastPlayed = this.#now();
    this.#persistPlays(item);
  }

  #persistPlays(item) {
    const plays = this.#settings.get('plays') ?? {};
    this.#settings.set('plays', { ...plays, [item.id]: [item.playCount ?? 0, item.lastPlayed] });
  }
}
