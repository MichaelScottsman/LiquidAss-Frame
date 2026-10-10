// The assPod's settings, for this session only: kept in memory in SteamVR's page (never written to
// disk, like the rest of LiquidAss), so a SteamVR restart starts from the defaults.
import { Emitter } from './util/emitter.js';

export const DEFAULTS = Object.freeze({
  shuffle: 'off',            // 'off' | 'songs' | 'albums'
  repeat: 'off',             // 'off' | 'one' | 'all'
  backlightTimer: 30,        // seconds; 0 = Off (never lit), -1 = Always On
  brightness: 0.75,          // 0..1
  eq: 'Off',                 // VLC equalizer preset name (os/screens/settings.js EQ_NAMES)
  clicker: true,
  volume: 0.6,               // 0..1
  timeFormat: '12',          // '12' | '24'
  finish: 'black',           // 'black' | 'white': the body
  ratings: {},               // trackId -> 0..5 (always replace the object, never mutate it)
  plays: {},                 // trackId -> [playCount, lastPlayed]
});

class Settings extends Emitter {
  #values = { ...DEFAULTS, ratings: {}, plays: {} };
  get(key) { return this.#values[key]; }
  set(key, value) {
    if (Object.is(this.#values[key], value)) return;
    this.#values[key] = value;
    this.emit('change', { key, value });
  }
  /** A value for this session only; the same as set() here (nothing is stored). */
  override(key, value) { this.set(key, value); }
  reset() {
    this.#values = { ...DEFAULTS, ratings: {}, plays: {} };
    this.emit('change', { key: '*', value: null });
  }
  all() { return { ...this.#values }; }
}
export const settings = new Settings();
