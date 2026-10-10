// The player's sound engine: VLC, run by the daemon (device/shell_ext/asspod.py) with its HTTP
// interface. Commands go out through `send` (the daemon collects them a few times a second);
// VLC's state comes back through status(). Between status reports the position runs on the local
// clock, so the playhead moves smoothly and the player can tell when an item ends.
//
// Engine contract (media/player.js): play(item, offsetSec), stop(), position, setVolume(v), tick().

const RESYNC_S = 0.35;       // a reported position this far from ours wins
const END_GRACE_MS = 2500;   // VLC reporting "stopped" this soon after a play is the play still starting

/** @param {{ send(cmd: object): void, now?: () => number }} opts */
export function createVlcEngine({ send, now = () => Date.now() }) {
  let item = null;          // what we asked VLC to play
  let playing = false;
  let base = 0;             // position (s) at t0
  let t0 = 0;
  let startedAt = 0;
  let ended = false;
  let last = null;          // the last status from the daemon

  const pos = () => (playing ? base + (now() - t0) / 1000 : base);

  return {
    play(it, offsetSec) {
      item = it;
      playing = true;
      ended = false;
      base = Math.max(0, Number(offsetSec) || 0);
      t0 = now();
      startedAt = t0;
      send({ op: 'play', id: it.id, path: it.path, at: Math.round(base * 1000) / 1000 });
    },
    stop() {
      if (!item) return;
      base = pos();
      playing = false;
      send({ op: 'pause' });
    },
    get position() { return ended ? Infinity : pos(); },
    setVolume(v) {
      send({ op: 'volume', v: Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 1000) / 1000 });
    },
    tick() {},

    /**
     * VLC's state from the daemon: { state: 'playing'|'paused'|'stopped', path, time (s), length (s),
     * at (ms, when it was read) }.
     */
    status(s) {
      if (!s || typeof s !== 'object') return;
      last = s;
      if (!item || !playing) return;
      const mine = s.path === item.path;
      if (mine && s.state === 'playing') {
        const t = Number(s.time) + Math.max(0, (now() - Number(s.at || now())) / 1000);
        if (Number.isFinite(t) && Math.abs(t - pos()) > RESYNC_S) { base = t; t0 = now(); }
        if (Number(s.length) > 1 && Math.abs(Number(s.length) - item.duration) > 1) item.duration = Number(s.length);
      } else if ((s.state === 'stopped' || (mine && s.state === 'ended')) && now() - startedAt > END_GRACE_MS) {
        // VLC played it to the end (it stops after each item): the player moves on.
        ended = true;
      }
    },
    get item() { return item; },
    get playing() { return playing; },
    get last() { return last; },
  };
}
