// node --test device/asspod/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../src/media/player.js';
import { DEFAULTS } from '../src/settings.js';
import { Emitter } from '../src/util/emitter.js';
import { mulberry32 } from '../src/util/rng.js';

// ---------------------------------------------------------------- fakes
class FakeEngine {
  pos = 0; playing = false; item = null; volume = null; calls = [];
  play(item, offset) { this.item = item; this.pos = offset; this.playing = true; this.calls.push(['play', item.id, offset]); }
  stop() { this.playing = false; this.calls.push(['stop']); }
  get position() { return this.pos; }
  setVolume(v) { this.volume = v; }
  advance(sec) { if (this.playing) this.pos += sec; }
}

/** Same API as the settings singleton, but fresh per test. */
class FakeSettings extends Emitter {
  values = { ...DEFAULTS, ratings: {} };
  get(k) { return this.values[k]; }
  set(k, v) { if (Object.is(this.values[k], v)) return; this.values[k] = v; this.emit('change', { key: k, value: v }); }
  reset() { this.values = { ...DEFAULTS, ratings: {} }; this.emit('change', { key: '*', value: null }); }
}

const song = (id, duration = 100, albumId = 'a') => ({ id, kind: 'song', title: id, albumId, duration, rating: 0, playCount: 0, lastPlayed: 0 });
const items = (n, duration = 100) => Array.from({ length: n }, (_, i) => song('t' + i, duration, 'a' + Math.floor(i / 3)));

function setup(over = {}) {
  const engine = new FakeEngine();
  const settings = new FakeSettings();
  Object.assign(settings.values, over);
  let clock = 1000;
  const player = createPlayer({ engine, settings, random: mulberry32(42), now: () => clock });
  const events = [];
  for (const type of ['state', 'track', 'queue', 'volume', 'seek', 'rating']) player.on(type, (p) => events.push([type, p]));
  const run = (sec, dt = 0.1) => {
    for (let t = 0; t < sec - 1e-9; t += dt) { engine.advance(dt); clock += dt * 1000; player.update(dt); }
  };
  return { engine, settings, player, events, run, tick: (ms) => { clock += ms; } };
}

// ---------------------------------------------------------------- transport
test('playQueue starts the chosen item and emits queue, track and state', () => {
  const { player, engine, events } = setup();
  const q = items(5);
  player.playQueue(q, 2);
  assert.equal(player.state, 'playing');
  assert.equal(player.current, q[2]);
  assert.equal(player.index, 2);
  assert.deepEqual(engine.calls.at(-1), ['play', 't2', 0]);
  assert.deepEqual(events.map((e) => e[0]), ['queue', 'track', 'state']);
  assert.equal(events[1][1].item, q[2]);
  assert.equal(events[2][1].state, 'playing');
});

test('position follows the engine; pause and play resume where they left off', () => {
  const { player, engine, run } = setup();
  player.playQueue(items(3));
  run(5);
  assert.ok(Math.abs(player.position - 5) < 1e-6);
  player.pause();
  assert.equal(player.state, 'paused');
  assert.equal(engine.playing, false);
  run(3);
  assert.ok(Math.abs(player.position - 5) < 1e-6, 'paused position holds');
  player.togglePlay();
  assert.equal(player.state, 'playing');
  assert.ok(Math.abs(engine.calls.at(-1)[2] - 5) < 1e-6, 'engine resumes at the paused offset');
});

test('prev restarts after 3 s and goes back before that', () => {
  const { player, run } = setup();
  const q = items(3);
  player.playQueue(q, 1);
  run(4);
  player.prev();
  assert.equal(player.current, q[1], 'restarted, same item');
  assert.ok(player.position < 0.01);
  run(1);
  player.prev();
  assert.equal(player.current, q[0], 'went to the previous item');
  player.prev();
  assert.equal(player.current, q[0], 'first item just restarts');
  assert.equal(player.state, 'playing');
});

test('next advances, and next on the last item stops (repeat off)', () => {
  const { player, events } = setup();
  const q = items(2);
  player.playQueue(q);
  player.next();
  assert.equal(player.current, q[1]);
  player.next();
  assert.equal(player.state, 'stopped');
  assert.equal(player.current, null);
  assert.deepEqual(events.at(-1), ['state', { state: 'stopped' }]);
});

test('next while paused stays paused', () => {
  const { player, engine } = setup();
  const q = items(3);
  player.playQueue(q);
  player.pause();
  player.next();
  assert.equal(player.current, q[1]);
  assert.equal(player.state, 'paused');
  assert.equal(engine.playing, false);
});

test('end of an item advances; end of the queue stops', () => {
  const { player, run } = setup();
  const q = items(2, 10);
  player.playQueue(q);
  run(10.5);
  assert.equal(player.current, q[1]);
  assert.equal(player.state, 'playing');
  run(10.5);
  assert.equal(player.state, 'stopped');
  assert.equal(player.current, null);
});

test('repeat one replays the item; repeat all wraps to the start', () => {
  {
    const { player, run } = setup({ repeat: 'one' });
    const q = items(2, 10);
    player.playQueue(q);
    run(10.5);
    assert.equal(player.current, q[0]);
    assert.ok(player.position < 1);
    player.next();
    assert.equal(player.current, q[1], 'manual next still moves on');
  }
  {
    const { player, run } = setup({ repeat: 'all' });
    const q = items(2, 10);
    player.playQueue(q);
    run(21);
    assert.equal(player.current, q[0]);
    assert.equal(player.state, 'playing');
    player.prev();
    assert.equal(player.current, q[1], 'prev from the first item wraps with repeat all');
  }
});

// ---------------------------------------------------------------- shuffle
test("shuffle 'songs' keeps the chosen item first and shuffles the rest", () => {
  const { player } = setup({ shuffle: 'songs' });
  const q = items(12);
  player.playQueue(q, 5);
  assert.equal(player.queue[0], q[5]);
  assert.equal(player.index, 0);
  assert.equal(player.current, q[5]);
  assert.equal(player.queue.length, q.length);
  assert.deepEqual(new Set(player.queue), new Set(q));
  assert.notDeepEqual(player.queue.slice(1).map((t) => t.id), q.filter((_, i) => i !== 5).map((t) => t.id), 'rest is shuffled');
  assert.equal(q[0].id, 't0', 'the caller array is not mutated');
});

test("shuffle 'albums' keeps albums together and starts with the chosen album", () => {
  const { player } = setup({ shuffle: 'albums' });
  const q = items(12);                     // albums a0..a3 with 3 tracks each
  player.playQueue(q, 7);                  // t7 is the 2nd track of a2
  const ids = player.queue.map((t) => t.id);
  assert.deepEqual(ids.slice(0, 3), ['t7', 't8', 't6']);
  for (let g = 0; g < 4; g++) {
    const albums = new Set(player.queue.slice(g * 3, g * 3 + 3).map((t) => t.albumId));
    assert.equal(albums.size, 1, 'albums stay contiguous');
  }
  assert.equal(new Set(ids).size, 12);
  const rest = player.queue.slice(3).map((t) => t.albumId);
  assert.ok(rest.every((a) => a !== 'a2'));
});

// ---------------------------------------------------------------- seeking
test('seek is clamped to [0, duration] and emits seek', () => {
  const { player, engine, events, run } = setup();
  player.playQueue(items(2, 100));
  player.seek(-5);
  assert.equal(player.position, 0);
  player.seek(42);
  assert.equal(player.position, 42);
  assert.deepEqual(events.at(-1), ['seek', { position: 42 }]);
  run(0.3);
  assert.deepEqual(engine.calls.at(-1), ['play', 't0', 42]);
  player.seek(1e6);
  assert.equal(player.position, 100);
  player.pause();
  player.seek(30);
  assert.equal(player.position, 30);
  assert.equal(engine.playing, false, 'seeking while paused stays silent');
});

test('rapid seeks while playing restart the engine once, at the last target, after they settle', () => {
  const { player, engine, run } = setup();
  player.playQueue(items(1, 200));
  run(10);
  engine.calls.length = 0;
  for (let i = 1; i <= 10; i++) {
    player.seek(10 + 2 * i);
    assert.equal(player.position, 10 + 2 * i, 'position reads the scrub target at once');
    run(0.1);                          // one detent every 100 ms: still settling
  }
  assert.equal(engine.playing, false, 'silent while the seeks settle');
  assert.deepEqual(engine.calls, [['stop']], 'one stop for the whole gesture, no restarts yet');
  run(0.3);
  assert.deepEqual(engine.calls, [['stop'], ['play', 't0', 30]]);
  assert.equal(player.state, 'playing');
  run(1);
  assert.ok(Math.abs(player.position - 31) < 0.15, `plays on from the target: ${player.position}`);
});

test('pausing while a seek settles keeps the target and stays silent', () => {
  const { player, engine, run } = setup();
  player.playQueue(items(1, 200));
  player.seek(50);
  player.pause();
  run(1);
  assert.equal(player.position, 50);
  assert.equal(engine.playing, false);
  player.play();
  assert.deepEqual(engine.calls.at(-1), ['play', 't0', 50]);
});

test('prev past 3 s restarts the item at once, without the settling gap', () => {
  const { player, engine, run } = setup();
  player.playQueue(items(2, 100));
  run(10);
  player.prev();
  assert.deepEqual(engine.calls.at(-1), ['play', 't0', 0]);
  assert.equal(engine.playing, true);
});

test('FF/REW is silent at 4x, then 16x after 2 s, and resumes on release', () => {
  const { player, engine, run } = setup();
  player.playQueue(items(2, 200));
  run(10);
  player.startSeek(1);
  assert.equal(player.seeking, 1);
  assert.equal(engine.playing, false, 'silent while seeking');
  run(1);
  assert.ok(Math.abs(player.position - 14) < 0.05, `4x: ${player.position}`);
  run(2);
  // 1 more second at 4x, then 1 s at 16x (one 0.1 s frame of slack at the 2 s switch).
  assert.ok(Math.abs(player.position - 34) < 1.3, `16x: ${player.position}`);
  const at = player.position;
  player.stopSeek();
  assert.equal(player.seeking, 0);
  assert.equal(engine.playing, true);
  assert.ok(Math.abs(engine.calls.at(-1)[2] - player.position) < 1e-6);
  player.startSeek(-1);
  run(1);
  assert.ok(Math.abs(player.position - (at - 4)) < 0.05, `rewind: ${player.position}`);
  run(5);
  assert.equal(player.position, 0, 'rewind clamps at 0');
  player.stopSeek();
});

test('fast-forward off the end rolls into the next item', () => {
  const { player, run } = setup();
  const q = items(2, 10);
  player.playQueue(q);
  player.startSeek(1);
  run(3);
  assert.equal(player.current, q[1]);
  player.stopSeek();
  assert.equal(player.state, 'playing');
});

// ---------------------------------------------------------------- volume, ratings, history
test('volume is clamped, applied to the engine and persisted to settings.volume', () => {
  const { player, engine, settings, events } = setup();
  assert.equal(player.volume, DEFAULTS.volume);
  assert.equal(engine.volume, DEFAULTS.volume, 'initial volume reaches the engine');
  player.setVolume(1.7);
  assert.equal(player.volume, 1);
  assert.equal(settings.get('volume'), 1);
  assert.equal(engine.volume, 1);
  player.setVolume(-1);
  assert.equal(player.volume, 0);
  assert.deepEqual(events.filter((e) => e[0] === 'volume').map((e) => e[1].volume), [1, 0]);
  settings.set('volume', 0.25);
  assert.equal(player.volume, 0.25, 'external settings changes are followed');
  assert.equal(engine.volume, 0.25);
  settings.reset();
  assert.equal(player.volume, DEFAULTS.volume);
});

test('ratings persist to settings.ratings by replacing the object', () => {
  const { player, settings, events } = setup();
  const q = items(2);
  const before = settings.get('ratings');
  player.rate(q[0], 4);
  assert.equal(q[0].rating, 4);
  assert.deepEqual(settings.get('ratings'), { t0: 4 });
  assert.notEqual(settings.get('ratings'), before, 'a new object');
  assert.deepEqual(before, {}, 'the old object was not mutated');
  player.rate(q[1], 9);
  assert.equal(q[1].rating, 5);
  assert.deepEqual(settings.get('ratings'), { t0: 4, t1: 5 });
  assert.deepEqual(events.at(-1), ['rating', { item: q[1] }]);
});

test('playCount and lastPlayed update', () => {
  const { player, settings, run } = setup();
  const q = items(3, 10);
  player.playQueue(q);
  assert.equal(q[0].lastPlayed, 1000, 'lastPlayed is stamped when an item starts');
  run(10.5);
  assert.equal(q[0].playCount, 1, 'a finished item counts');
  assert.equal(player.current, q[1]);
  player.next();
  assert.equal(q[1].playCount, 0, 'an early skip does not count');
  assert.ok(q[1].lastPlayed > 0);
  run(6);
  player.next();
  assert.equal(q[2].playCount, 1, 'a skip after half the item counts');
  assert.deepEqual(settings.get('plays').t0, [1, q[0].lastPlayed]);
});

test('stop() clears the current item; play() with no current item restarts the queue', () => {
  const { player, engine } = setup();
  const q = items(3);
  player.playQueue(q, 1);
  player.stop();
  assert.equal(player.state, 'stopped');
  assert.equal(player.current, null);
  assert.equal(player.position, 0);
  assert.equal(engine.playing, false);
  player.play();
  assert.equal(player.current, q[0]);
  assert.equal(player.state, 'playing');
});

test('calls with no current item are harmless', () => {
  const { player } = setup();
  player.togglePlay(); player.next(); player.prev(); player.seek(5); player.startSeek(1); player.stopSeek(); player.update(0.1);
  player.playQueue([]);
  assert.equal(player.state, 'stopped');
  assert.equal(player.duration, 0);
});

test('update() drives an engine tick hook when the engine has one', () => {
  const { player, engine } = setup();
  let ticks = 0;
  engine.tick = () => { ticks++; };
  player.update(0.016);
  player.update(0.016);
  assert.equal(ticks, 2);
});
