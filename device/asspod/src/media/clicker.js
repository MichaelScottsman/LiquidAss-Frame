// The click wheel's clicker: a short tick per detent and a firmer thunk per press, pre-rendered
// once into buffers. Web Audio in SteamVR's own page; silent where there is none.
import { settings } from '../settings.js';

let ctx = null;
let clicks = null;
let gain = null;

function context() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  try { ctx = AC ? new AC({ latencyHint: 'interactive' }) : null; } catch { ctx = null; }
  if (ctx) {
    gain = ctx.createGain();
    gain.gain.value = 0.35;
    gain.connect(ctx.destination);
  }
  return ctx;
}

/** Starts the audio context (pages may need a resume before they make sound). */
export function unlockClicker() {
  const c = context();
  if (!c) return Promise.resolve();
  try { return Promise.resolve(c.resume()).then(() => {}, () => {}); } catch { return Promise.resolve(); }
}

function renderClicks(c) {
  const sr = c.sampleRate;
  const make = (len, fn) => {
    const n = Math.floor(len * sr);
    const buf = c.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = fn(i / sr);
    return buf;
  };
  let s = 0x1234567;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
  return {
    // 2.8 kHz resonance, ~8 ms to silence.
    tick: make(0.012, (t) => 0.9 * Math.exp(-t / 0.0016) * Math.sin(2 * Math.PI * 2800 * t) + 0.25 * Math.exp(-t / 0.0004) * rnd()),
    press: make(0.03, (t) => 1.0 * Math.exp(-t / 0.004) * Math.sin(2 * Math.PI * 1400 * t)
      + 0.45 * Math.exp(-t / 0.0025) * Math.sin(2 * Math.PI * 3100 * t) + 0.3 * Math.exp(-t / 0.0008) * rnd()),
  };
}

/** @param {'tick'|'press'} kind */
export function playClick(kind) {
  if (!settings.get('clicker') || !ctx || ctx.state !== 'running') return;
  clicks ??= renderClicks(ctx);
  const src = ctx.createBufferSource();
  src.buffer = clicks[kind] ?? clicks.tick;
  src.connect(gain);
  src.onended = () => src.disconnect();
  src.start();
}

export function clickerState() { return ctx ? ctx.state : 'none'; }
