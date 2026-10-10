// Extras: Clock, Contacts, Calendar, Notes, Games (Brick, Music Quiz, Parachute, Solitaire),
// Stopwatch and Screen Lock, laid out like the 5G's Extras menu.
import { C, FONTS, M, font } from '../os/theme.js';
import { SCREEN_W, SCREEN_H } from '../config.js';
import { createRng, hash32 } from '../util/rng.js';
import { settings } from '../settings.js';
import { brick } from './brick.js';

const W = SCREEN_W;
const H = SCREEN_H;
const TAU = Math.PI * 2;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const F_TITLE = font(16, 700);
const F_BODY = font(14, 400);
const F_LABEL = font(12, 400);
const F_VALUE = font(15, 600);
const F_LAP = font(14, 600);
const F_LAP_T = font(14, 400);
const F_CAL = font(12, 600);
const F_CAL_HEAD = font(11, 600);
const F_HUD = font(12, 600);
const F_BIG = font(20, 700);

// ---------------------------------------------------------------- text view
// A scrolling page of wrapped text: contact cards, notes, calendar events. Blocks are
// { text, font, color, gap } and are wrapped on first draw (wrapping needs a canvas to measure).
function wrap(ui, g, text, f, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (line && ui.measure(g, next, f) > maxW) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

function textView(ctx, id, title, blocks) {
  const { ui } = ctx;
  const LINE = 18;
  const PAD = 10;
  let lines = null;           // [{ s, font, color, y }]
  let height = 0;
  let scroll = 0;

  function layout(g) {
    lines = [];
    let y = 8;
    for (const b of blocks) {
      y += b.gap ?? 0;
      const f = b.font ?? F_BODY;
      for (const s of wrap(ui, g, b.text, f, W - 2 * PAD - 10)) {
        lines.push({ s, font: f, color: b.color ?? C.text, y: y + (b.size ?? 14) });
        y += b.line ?? LINE;
      }
    }
    height = y + 8;
  }
  const view = () => H - M.statusH;

  return {
    id,
    title,
    enter() { lines = null; scroll = 0; },
    resume() { lines = null; },
    highlight() { return { index: Math.round(scroll / LINE), label: title }; },
    handle(e) {
      if (e.type === 'scroll') {
        const max = Math.max(0, height - view());
        const next = Math.max(0, Math.min(max, scroll + e.delta * LINE));
        if (next === scroll) return false;
        scroll = next;
        return true;
      }
      if (e.type === 'press' && e.part === 'select') return false;
      return undefined;
    },
    draw(g, r) {
      if (!lines) layout(g);
      g.save();
      g.fillStyle = C.bg;
      g.fillRect(r.x, r.y, r.w, r.h);
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      for (const l of lines) {
        const y = r.y + l.y - scroll;
        if (y < r.y - 4 || y > r.y + r.h + 16) continue;
        g.font = l.font;
        g.fillStyle = l.color;
        g.fillText(l.s, r.x + PAD, y);
      }
      if (height > view()) {
        const total = Math.ceil(height / LINE);
        const vis = Math.floor(view() / LINE);
        ui.drawScrollbar(g, r.x + W - M.scrollbarW, r.y, r.h - 2, total, vis, Math.round(scroll / LINE));
      }
      g.restore();
    },
  };
}

// A centered message, for things this assPod can't do.
function alertScreen(ctx, id, title, heading, body) {
  return {
    id,
    title,
    handle(e) {
      if (e.type === 'press' && e.part === 'select') { ctx.pop(); return true; }
      return undefined;
    },
    draw(g, r) {
      g.save();
      g.fillStyle = C.bg;
      g.fillRect(r.x, r.y, r.w, r.h);
      // A rounded warning badge above the message.
      g.fillStyle = ctx.ui.gradient(g, 0, r.y + 50, 0, r.y + 86, C.hi);
      g.beginPath();
      g.arc(r.x + W / 2, r.y + 68, 18, 0, TAU);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = font(24, 700);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText('!', r.x + W / 2, r.y + 77);
      g.fillStyle = C.text;
      g.font = F_TITLE;
      g.fillText(heading, r.x + W / 2, r.y + 118);
      g.fillStyle = C.textDim;
      g.font = F_BODY;
      let y = r.y + 140;
      for (const line of wrap(ctx.ui, g, body, F_BODY, 260)) { g.fillText(line, r.x + W / 2, y); y += 18; }
      g.restore();
    },
  };
}

// ---------------------------------------------------------------- clock
const WORLD = [
  ['New York', 'America/New_York'], ['London', 'Europe/London'], ['Paris', 'Europe/Paris'],
  ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'], ['Cupertino', 'America/Los_Angeles'],
];

function localCity() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return [tz.split('/').pop().replace(/_/g, ' '), tz];
  } catch { /* no Intl time zones: fall through */ }
  return ['Local', null];
}

// Wall time in a city, from Intl (falls back to the device's local time).
const formatters = new Map();
function cityTime(tz, date) {
  if (!tz) return { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds(), wd: date.getDay() };
  let f = formatters.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' });
    } catch { f = null; }
    formatters.set(tz, f);
  }
  if (!f) return cityTime(null, date);
  const o = { h: 0, m: 0, s: 0, wd: 0 };
  for (const p of f.formatToParts(date)) {
    if (p.type === 'hour') o.h = Number(p.value) % 24;
    else if (p.type === 'minute') o.m = Number(p.value);
    else if (p.type === 'second') o.s = Number(p.value);
    else if (p.type === 'weekday') o.wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.value);
  }
  return o;
}

function formatClock(t) {
  const mm = String(t.m).padStart(2, '0');
  if (settings.get('timeFormat') === '24') return `${String(t.h).padStart(2, '0')}:${mm}`;
  return `${t.h % 12 || 12}:${mm} ${t.h < 12 ? 'AM' : 'PM'}`;
}

const BEZEL_STOPS = [[0, '#f2f2f2'], [0.5, '#9a9a9a'], [1, '#e0e0e0']];
const DAY_STOPS = [[0, '#ffffff'], [1, '#e9e9e9']];
const NIGHT_STOPS = [[0, '#2a2a2a'], [1, '#050505']];

function clockScreen(ctx) {
  const local = localCity();
  const cities = [local, ...WORLD.filter(([, tz]) => tz !== local[1])];
  let index = 0;
  const CX = 160;
  const CY = 124;
  const R = 70;

  function hand(g, angle, len, tail, width, color) {
    g.save();
    g.translate(CX, CY);
    g.rotate(angle);
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, tail);
    g.lineTo(0, -len);
    g.stroke();
    g.restore();
  }

  return {
    id: 'clock',
    title: 'Clock',
    refreshMs: 1000,
    highlight() { return { index, label: cities[index][0] }; },
    handle(e) {
      if (e.type === 'scroll') {
        const next = Math.max(0, Math.min(cities.length - 1, index + e.delta));
        if (next === index) return false;
        index = next;
        return true;
      }
      if (e.type === 'press' && e.part === 'select') return false;
      return undefined;
    },
    draw(g, r) {
      const [city, tz] = cities[index];
      const t = cityTime(tz, new Date());
      // The 5G's clock face is white by day and black at night.
      const day = t.h >= 6 && t.h < 18;
      const ink = day ? '#000000' : '#ffffff';
      g.save();
      g.translate(r.x, 0);
      g.fillStyle = C.bg;
      g.fillRect(0, r.y, W, r.h);
      g.fillStyle = ctx.ui.gradient(g, 0, CY - R - 4, 0, CY + R + 4, BEZEL_STOPS);
      g.beginPath(); g.arc(CX, CY, R + 4, 0, TAU); g.fill();
      g.fillStyle = ctx.ui.gradient(g, 0, CY - R, 0, CY + R, day ? DAY_STOPS : NIGHT_STOPS);
      g.beginPath(); g.arc(CX, CY, R, 0, TAU); g.fill();
      g.strokeStyle = day ? '#5a5a5a' : '#cfcfcf';
      for (let i = 0; i < 60; i++) {
        const a = i * TAU / 60;
        const big = i % 5 === 0;
        const r0 = R - (big ? 11 : 5);
        g.lineWidth = big ? (i % 15 === 0 ? 3.2 : 2.2) : 0.8;
        g.strokeStyle = big ? ink : day ? '#7a7a7a' : '#9a9a9a';
        g.beginPath();
        g.moveTo(CX + Math.sin(a) * r0, CY - Math.cos(a) * r0);
        g.lineTo(CX + Math.sin(a) * (R - 3), CY - Math.cos(a) * (R - 3));
        g.stroke();
      }
      const sec = t.s;
      const min = t.m + sec / 60;
      const hr = (t.h % 12) + min / 60;
      hand(g, hr * TAU / 12, 38, 8, 5, ink);
      hand(g, min * TAU / 60, 56, 10, 3.2, ink);
      hand(g, sec * TAU / 60, 60, 14, 1.2, '#d0021b');
      g.fillStyle = ink;
      g.beginPath(); g.arc(CX, CY, 4.5, 0, TAU); g.fill();
      g.fillStyle = '#d0021b';
      g.beginPath(); g.arc(CX, CY, 2.2, 0, TAU); g.fill();

      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillStyle = C.text;
      g.font = FONTS.row;
      g.fillText(city, CX, 214);
      g.fillStyle = C.textDim;
      g.font = FONTS.npMeta;
      g.fillText(`${DAYS[t.wd].slice(0, 3)} ${formatClock(t)}`, CX, 232);
      if (cities.length > 1) {
        // Page dots: more cities are a wheel turn away.
        for (let i = 0; i < cities.length; i++) {
          g.fillStyle = i === index ? C.hi[1][1] : '#c8c8c8';
          g.beginPath();
          g.arc(CX - (cities.length - 1) * 5 + i * 10, 36, 2.5, 0, TAU);
          g.fill();
        }
      }
      g.restore();
    },
  };
}

// ---------------------------------------------------------------- contacts and notes
const CONTACTS = [
  { first: 'Astrid', last: 'Bellweather', mobile: '(555) 014-2290', email: 'astrid@lunarmail.example', note: 'Bring the telescope Friday.' },
  { first: 'Captain', last: 'Comet', work: '(555) 019-7001', email: 'captain@solarflare.example', note: 'Funk practice, Tuesdays.' },
  { first: 'Dex', last: 'Halloran', mobile: '(555) 011-4432', home: '(555) 011-9000' },
  { first: 'Luna', last: 'Halcyon', mobile: '(555) 018-3321', email: 'luna@velvetorbit.example' },
  { first: 'Marlowe', last: 'Moth', mobile: '(555) 012-6655', email: 'marlowe@papersatellites.example', note: 'Owes me a mixtape.' },
  { first: 'Chef', last: 'Nova', work: '(555) 010-2468', email: 'nova@orbitalkitchen.example', note: 'Zero-G pancakes: whisk, then magnets.' },
  { first: 'Priya', last: 'Raman', mobile: '(555) 016-8080', home: '(555) 016-1212', email: 'priya@stargazing.example' },
  { first: 'Sam', last: 'Sundial', mobile: '(555) 013-1240', note: 'DJ for the launch party.' },
];

const NOTES = [
  ['Read Me', 'Welcome to your assPod.\n\nCircle either thumbstick to turn the click wheel. Click a stick toward MENU, Next, Play/Pause or Previous to press that button, or click it centered (or press A) for Select. Press B to put the assPod away; your music keeps playing.\n\nTry Music > Cover Flow, then press Select to flip an album over.'],
  ['Packing List', 'Mars trip:\n- Spacesuit (the comfy one)\n- Headphones\n- Freeze-dried pancakes\n- Charger cable\n- Postcards for Earth'],
  ['Mixtape Ideas', 'Side A: something loud to open, two to dance to, one slow one to cool down.\n\nSide B: sunrise songs, and end on the quietest track on the assPod.'],
  ['Stargazing Log', 'Saw the Summer Triangle from the backyard: Vega, Deneb, Altair. Saturn\'s rings visible at 120x. Three meteors before midnight.'],
  ['Recipe', 'Zero-G Pancakes (Orbital Kitchen S1 E1)\n\n1 cup flour, 1 egg, 3/4 cup milk, blueberries. Whisk gently; anything you spill will float. Flip with confidence.'],
];

function contactCard(c) {
  const blocks = [{ text: `${c.first} ${c.last}`, font: F_TITLE, size: 16, gap: 4, line: 26 }];
  for (const [k, label] of [['mobile', 'mobile'], ['home', 'home'], ['work', 'work'], ['email', 'email'], ['note', 'note']]) {
    if (!c[k]) continue;
    blocks.push({ text: label, font: F_LABEL, color: C.textDim, size: 12, gap: 2, line: 15 });
    blocks.push({ text: c[k], font: F_VALUE, size: 15, line: 20 });
  }
  return blocks;
}

function contacts(ctx) {
  const sorted = CONTACTS.slice().sort((a, b) => (a.last + a.first < b.last + b.first ? -1 : 1));
  return ctx.menu({
    id: 'contacts',
    title: 'Contacts',
    items: sorted.map((c) => ({ label: `${c.first} ${c.last}`, open: (c2) => textView(c2, 'contact', `${c.first} ${c.last}`, contactCard(c)) })),
  });
}

function notes(ctx) {
  return ctx.menu({
    id: 'notes',
    title: 'Notes',
    items: NOTES.map(([title, body]) => ({ label: title, open: (c) => textView(c, 'note', title, [{ text: body, gap: 2 }]) })),
  });
}

// ---------------------------------------------------------------- calendar
// Sample events, placed relative to the current month so the calendar always has something on it.
function eventsFor(y, m, d) {
  const today = new Date();
  const list = [];
  if (y === today.getFullYear() && m === today.getMonth() && d === today.getDate()) list.push('assPod day');
  const h = hash32(y, m, d) % 97;
  if (d === 3) list.push('9:00 AM  Launch window opens');
  if (d === 12) list.push('8:30 PM  Stargazing Weekly');
  if (d === 18) list.push('2:00 PM  Dentist (Moon Base)');
  if (d === 24) list.push('7:00 PM  The Pixel Lanterns, live');
  if (h === 7 || h === 42) list.push('Pick up pancakes ingredients');
  return list;
}

function calendarMonth(ctx) {
  const { ui } = ctx;
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();
  const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
  const HEAD = 16;
  const CW = W / 7;
  const CH = (H - M.statusH - HEAD) / 6;

  function move(delta) {
    day += delta;
    while (day < 1) { month--; if (month < 0) { month = 11; year--; } day += daysIn(year, month); }
    while (day > daysIn(year, month)) { day -= daysIn(year, month); month++; if (month > 11) { month = 0; year++; } }
  }

  return {
    id: 'calendar',
    title: () => `${MONTHS[month]} ${year}`,
    highlight() { return { index: day, label: `${MONTHS[month]} ${day}` }; },
    handle(e) {
      if (e.type === 'scroll') { move(e.delta); return true; }
      if (e.type === 'press' && e.part === 'select') {
        const ev = eventsFor(year, month, day);
        const title = `${MONTHS[month].slice(0, 3)} ${day}`;
        ctx.push(textView(ctx, 'events', title, ev.length ? ev.map((s) => ({ text: s, font: F_VALUE, gap: 4 }))
          : [{ text: 'No events', color: C.textDim, gap: 4 }]));
        return true;
      }
      return undefined;
    },
    draw(g, r) {
      g.save();
      g.translate(r.x, 0);
      g.fillStyle = C.bg;
      g.fillRect(0, r.y, W, r.h);
      const top = r.y;
      g.fillStyle = ui.gradient(g, 0, top, 0, top + HEAD, [[0, '#f4f4f4'], [1, '#d6d6d6']]);
      g.fillRect(0, top, W, HEAD);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.font = F_CAL_HEAD;
      g.fillStyle = '#4a4a4a';
      for (let i = 0; i < 7; i++) g.fillText(DAYS[i][0], i * CW + CW / 2, top + 12);
      const first = new Date(year, month, 1).getDay();
      const n = daysIn(year, month);
      const prevN = daysIn(year, month === 0 ? 11 : month - 1);
      const isThisMonth = year === now.getFullYear() && month === now.getMonth();
      g.font = F_CAL;
      for (let k = 0; k < 42; k++) {
        const cx = (k % 7) * CW;
        const cy = top + HEAD + Math.floor(k / 7) * CH;
        const d = k - first + 1;
        const inMonth = d >= 1 && d <= n;
        const label = inMonth ? d : d < 1 ? prevN + d : d - n;
        if (inMonth && d === day) ui.drawHighlight(g, cx + 1, cy + 1, CW - 1, CH - 1);
        g.textAlign = 'right';
        g.fillStyle = !inMonth ? '#b4b4b4' : d === day ? C.textHi : C.text;
        g.fillText(String(label), cx + CW - 5, cy + 13);
        if (inMonth && isThisMonth && d === now.getDate() && d !== day) {
          g.strokeStyle = C.hi[1][1];
          g.lineWidth = 1.5;
          g.strokeRect(cx + 2, cy + 2, CW - 3, CH - 3);
        }
        if (inMonth && eventsFor(year, month, d).length) {
          g.fillStyle = d === day ? '#ffffff' : '#d0021b';
          g.beginPath();
          g.moveTo(cx + 4, cy + CH - 4);
          g.lineTo(cx + 11, cy + CH - 4);
          g.lineTo(cx + 4, cy + CH - 11);
          g.fill();
        }
      }
      g.fillStyle = '#d4d4d4';
      for (let i = 1; i < 7; i++) g.fillRect(Math.round(i * CW), top + HEAD, 1, r.h - HEAD);
      for (let j = 0; j <= 6; j++) g.fillRect(0, Math.round(top + HEAD + j * CH), W, 1);
      g.restore();
    },
  };
}

function calendar(ctx) {
  const alarms = { on: false };
  return ctx.menu({
    id: 'calendars',
    title: 'Calendar',
    items: [
      { label: 'All Calendars', open: (c) => calendarMonth(c) },
      { label: 'To Do\'s', open: (c) => c.menu({ id: 'todos', title: 'To Do\'s', items: [
        { label: 'Charge the jetpack', detail: '!' },
        { label: 'Return library telescope' },
        { label: 'Record Side B of mixtape' },
      ] }) },
      { label: 'Alarms', detail: () => (alarms.on ? 'On' : 'Off'), action: () => { alarms.on = !alarms.on; return true; } },
    ],
  });
}

// ---------------------------------------------------------------- stopwatch
// Kept at module level: the stopwatch keeps running while you browse elsewhere, as on the assPod.
const watch = { running: false, base: 0, since: 0, laps: [], lapStart: 0 };
const watchTime = () => watch.base + (watch.running ? performance.now() - watch.since : 0);

function formatWatch(ms) {
  const cs = Math.floor(ms / 10) % 100;
  const s = Math.floor(ms / 1000);
  const p = (n) => (n < 10 ? '0' + n : String(n));
  return `${Math.floor(s / 3600)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}.${p(cs)}`;
}

function stopwatch(ctx) {
  let shown = '';
  let shownMs = -1;
  return {
    id: 'stopwatch',
    title: 'Stopwatch',
    animating() { return watch.running; },
    highlight() { return { index: watch.laps.length, label: formatWatch(watchTime()) }; },
    handle(e) {
      if (e.type === 'press' && e.part === 'play') {
        if (watch.running) {
          watch.base = watchTime();
          watch.running = false;
        } else {
          watch.since = performance.now();
          watch.running = true;
        }
        return true;
      }
      if (e.type === 'press' && e.part === 'select') {
        const t = watchTime();
        if (watch.running) {
          watch.laps.push(t - watch.lapStart);
          watch.lapStart = t;
          return true;
        }
        if (t === 0 && !watch.laps.length) return false;
        watch.base = 0;
        watch.laps = [];
        watch.lapStart = 0;
        return true;
      }
      return undefined;
    },
    draw(g, r) {
      const t = watchTime();
      const cs = Math.floor(t / 10);
      if (cs !== shownMs) { shownMs = cs; shown = formatWatch(t); }
      g.save();
      g.translate(r.x, 0);
      g.fillStyle = C.bg;
      g.fillRect(0, r.y, W, r.h);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillStyle = C.text;
      g.font = FONTS.big;
      g.fillText(shown, W / 2, r.y + 52);
      // The current lap ticks under the total, then the four most recent laps.
      g.font = FONTS.small;
      g.fillStyle = C.textDim;
      if (watch.running || watch.laps.length) g.fillText(`Lap ${watch.laps.length + 1}  ${formatWatch(t - watch.lapStart)}`, W / 2, r.y + 72);
      const n = watch.laps.length;
      for (let k = 0; k < 4 && k < n; k++) {
        const i = n - 1 - k;
        const y = r.y + 88 + k * 26;
        g.fillStyle = '#e2e2e2';
        g.fillRect(16, y, W - 32, 1);
        g.textAlign = 'left';
        g.font = F_LAP;
        g.fillStyle = C.text;
        g.fillText(`Lap ${i + 1}`, 24, y + 18);
        g.textAlign = 'right';
        g.font = F_LAP_T;
        g.fillText(formatWatch(watch.laps[i]), W - 24, y + 18);
      }
      if (!watch.running && t === 0) {
        g.textAlign = 'center';
        g.font = FONTS.small;
        g.fillStyle = C.textDim;
        g.fillText('Play/Pause starts and stops · Select records a lap', W / 2, r.y + 200);
      } else if (!watch.running) {
        g.textAlign = 'center';
        g.font = FONTS.small;
        g.fillStyle = C.textDim;
        g.fillText('Select resets', W / 2, r.y + 200);
      }
      g.restore();
    },
  };
}

// ---------------------------------------------------------------- screen lock
const lock = { combo: [0, 0, 0, 0] };

function comboScreen(ctx, mode) {
  const digits = [0, 0, 0, 0];
  let pos = 0;
  let shakeUntil = 0;
  let shake = false;
  const unlock = mode === 'unlock';

  function drawPadlock(g, x, y, open) {
    g.strokeStyle = '#8a8a8a';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(x, y - (open ? 8 : 2), 13, Math.PI, open ? Math.PI * 1.85 : TAU);
    g.stroke();
    g.fillStyle = ctx.ui.gradient(g, 0, y, 0, y + 30, [[0, '#ffd34d'], [1, '#d99a00']]);
    g.fillRect(x - 19, y, 38, 30);
    g.fillStyle = '#5a4300';
    g.beginPath(); g.arc(x, y + 12, 4, 0, TAU); g.fill();
    g.fillRect(x - 1.5, y + 13, 3, 9);
  }

  return {
    id: unlock ? 'screenlock' : 'setcombination',
    title: unlock ? 'Screen Lock' : 'Set Combination',
    keepAwake: unlock,
    animating(now) { return shake || (shakeUntil > 0 && now < shakeUntil + 40); },
    highlight() { return { index: pos, label: digits.join('') }; },
    handle(e) {
      if (e.type === 'scroll') {
        digits[pos] = (digits[pos] + e.delta + 10) % 10;
        return true;
      }
      if (e.type === 'press' && e.part === 'select') {
        if (pos < 3) { pos++; return true; }
        if (!unlock) {
          lock.combo = digits.slice();
          ctx.pop();
          return true;
        }
        if (digits.every((d, i) => d === lock.combo[i])) { ctx.pop(); return true; }
        digits.fill(0);
        pos = 0;
        shake = true;
        return true;
      }
      // Locked: MENU can't leave. Play/Pause, holds and the rest still reach the OS.
      if (unlock && e.type === 'press' && e.part === 'menu') return false;
      return undefined;
    },
    draw(g, r, now) {
      if (shake) { shakeUntil = now + 400; shake = false; }
      const dx = shakeUntil && now < shakeUntil ? Math.sin(now / 18) * 6 * ((shakeUntil - now) / 400) : 0;
      if (shakeUntil && now >= shakeUntil) shakeUntil = 0;
      g.save();
      g.translate(r.x, 0);
      g.fillStyle = C.bg;
      g.fillRect(0, r.y, W, r.h);
      drawPadlock(g, W / 2, r.y + 40, false);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.font = FONTS.row;
      g.fillStyle = C.text;
      g.fillText(unlock ? 'Enter Combination' : 'New Combination', W / 2, r.y + 102);
      for (let i = 0; i < 4; i++) {
        const x = W / 2 - 98 + i * 50 + dx;
        const y = r.y + 118;
        if (i === pos) ctx.ui.drawHighlight(g, x, y, 46, 50);
        else {
          g.fillStyle = '#f2f2f2';
          g.fillRect(x, y, 46, 50);
        }
        g.strokeStyle = C.sbBorder;
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, 45, 49);
        g.font = FONTS.big;
        g.fillStyle = i === pos ? C.textHi : C.text;
        g.fillText(String(digits[i]), x + 23, y + 36);
      }
      g.font = FONTS.small;
      g.fillStyle = C.textDim;
      g.fillText('Scroll to choose a digit, Select for the next', W / 2, r.y + 196);
      g.restore();
    },
  };
}

function screenLock(ctx) {
  return ctx.menu({
    id: 'screenlockmenu',
    title: 'Screen Lock',
    items: [
      { label: 'Lock', open: (c) => comboScreen(c, 'unlock') },
      { label: 'Set Combination', open: (c) => comboScreen(c, 'set') },
    ],
  });
}

// ---------------------------------------------------------------- music quiz
const QUIZ_ROUNDS = 10;
const QUIZ_SECONDS = 10;

function musicQuiz(ctx) {
  const { ui, player, library } = ctx;
  const tracks = library.tracks.filter((t) => t.kind === 'song');
  const rng = createRng(hash32(Date.now() & 0xffffff, 77));
  let round = 0;
  let score = 0;
  let options = [];
  let answer = 0;
  let sel = 0;
  let roundStart = 0;          // 0 = start the clock on the next frame
  let result = null;           // { right: bool, at: ms }
  let done = false;

  function newRound() {
    round++;
    const pick = rng.shuffle(tracks).slice(0, 5);
    answer = rng.int(0, pick.length - 1);
    options = pick;
    sel = 0;
    result = null;
    roundStart = 0;
    const t = pick[answer];
    player.playQueue([t], 0);
    player.seek(t.duration * rng.range(0.25, 0.6));
  }

  function elapsed(now) { return roundStart ? (now - roundStart) / 1000 : 0; }

  return {
    id: 'musicquiz',
    title: 'Music Quiz',
    enter() { if (!tracks.length) { done = true; return; } newRound(); },
    exit() { if (player.state === 'playing') player.pause(); },
    animating(now) { return !done && (!result || now - result.at < 1300); },
    highlight() { return { index: sel, label: options[sel]?.title ?? '' }; },
    handle(e) {
      if (done) {
        if (e.type === 'press' && e.part === 'select' && tracks.length) { done = false; round = 0; score = 0; newRound(); return true; }
        return e.type === 'scroll' ? false : undefined;
      }
      if (e.type === 'scroll') {
        if (result) return false;
        const next = Math.max(0, Math.min(options.length - 1, sel + e.delta));
        if (next === sel) return false;
        sel = next;
        return true;
      }
      if (e.type === 'press' && e.part === 'select') {
        if (result) return false;
        result = { right: sel === answer, at: 0, choice: sel };
        return true;
      }
      if (e.type === 'press' && e.part === 'play') return false;   // the quiz owns playback
      return undefined;
    },
    draw(g, r, now) {
      if (!done && !result && !roundStart) roundStart = now;
      if (result && !result.at) {
        result.at = now;
        if (result.right) score += Math.max(1, Math.ceil(QUIZ_SECONDS - elapsed(now))) * 10;
        player.pause();
      }
      if (!done && !result && elapsed(now) >= QUIZ_SECONDS) {
        result = { right: false, at: now, choice: -1 };
        player.pause();
      }
      if (result && now - result.at >= 1300 && !done) {
        if (round >= QUIZ_ROUNDS) done = true; else newRound();
        if (!done) roundStart = now;
      }
      g.save();
      g.translate(r.x, 0);
      g.fillStyle = C.bg;
      g.fillRect(0, r.y, W, r.h);
      g.textBaseline = 'alphabetic';
      if (done) {
        g.textAlign = 'center';
        g.font = F_BIG;
        g.fillStyle = C.text;
        g.fillText(tracks.length ? 'Quiz Over' : 'No Songs', W / 2, r.y + 80);
        g.font = FONTS.row;
        if (tracks.length) g.fillText(`Score: ${score}`, W / 2, r.y + 110);
        g.font = FONTS.small;
        g.fillStyle = C.textDim;
        if (tracks.length) g.fillText('Press Select to play again', W / 2, r.y + 140);
        g.restore();
        return;
      }
      // Header: round, score, and the time left as a draining bar.
      g.font = F_HUD;
      g.textAlign = 'left';
      g.fillStyle = C.text;
      g.fillText(`Round ${round} of ${QUIZ_ROUNDS}`, 8, r.y + 16);
      g.textAlign = 'right';
      g.fillText(`Score ${score}`, W - 8, r.y + 16);
      const left = result ? 0 : 1 - Math.min(1, elapsed(now) / QUIZ_SECONDS);
      ui.drawProgress(g, 8, r.y + 22, W - 16, 8, left);
      g.textAlign = 'left';   // drawRow draws its label with whatever alignment is current
      for (let i = 0; i < options.length; i++) {
        const y = r.y + 36 + i * M.rowH;
        let label = options[i].title;
        if (result && i === answer) label = '✓ ' + label;
        else if (result && i === result.choice) label = '✗ ' + label;
        ui.drawRow(g, y, W, { label, highlighted: i === sel && !result });
        if (result && (i === answer || i === result.choice)) {
          g.fillStyle = i === answer ? 'rgba(60,180,60,0.22)' : 'rgba(220,40,40,0.18)';
          g.fillRect(0, y, W, M.rowH);
        }
      }
      g.textAlign = 'center';
      g.font = FONTS.small;
      g.fillStyle = C.textDim;
      g.fillText(result ? (result.right ? 'Correct!' : result.choice < 0 ? 'Time\'s up' : 'Not quite') : 'Name that song', W / 2, r.y + 36 + 5 * M.rowH + 22);
      g.restore();
    },
  };
}

// ---------------------------------------------------------------- parachute
const SKY_STOPS = [[0, '#4a90d9'], [1, '#bfe0ff']];
const GRASS_STOPS = [[0, '#6aa84f'], [1, '#38761d']];

function parachute(ctx) {
  const { ui } = ctx;
  const GROUND = 226;
  const GUN_X = W / 2;
  const GUN_Y = GROUND - 12;
  let rng = createRng(1);
  const g0 = {};
  const heli = [];
  const troopers = [];
  const bullets = [];
  for (let i = 0; i < 3; i++) heli.push({ on: false, x: 0, y: 0, vx: 0, drop: 0 });
  for (let i = 0; i < 16; i++) troopers.push({ on: false, x: 0, y: 0, chute: true, landed: false });
  for (let i = 0; i < 4; i++) bullets.push({ on: false, x: 0, y: 0, vx: 0, vy: 0 });
  let last = 0;

  function reset() {
    rng = createRng(hash32(Date.now() & 0xffff, 9));
    Object.assign(g0, { state: 'ready', angle: 0, score: 0, landed: 0, spawn: 1.2 });
    for (const h of heli) h.on = false;
    for (const t of troopers) t.on = false;
    for (const b of bullets) b.on = false;
  }
  reset();

  function fire() {
    const b = bullets.find((x) => !x.on);
    if (!b) return false;
    b.on = true;
    b.x = GUN_X + Math.sin(g0.angle) * 16;
    b.y = GUN_Y - Math.cos(g0.angle) * 16;
    b.vx = Math.sin(g0.angle) * 260;
    b.vy = -Math.cos(g0.angle) * 260;
    g0.score = Math.max(0, g0.score - 1);
    return true;
  }

  function step(dt) {
    g0.spawn -= dt;
    if (g0.spawn <= 0) {
      const h = heli.find((x) => !x.on);
      if (h) {
        const fromLeft = rng.chance(0.5);
        Object.assign(h, { on: true, x: fromLeft ? -30 : W + 30, y: rng.range(40, 72), vx: (fromLeft ? 1 : -1) * rng.range(45, 70), drop: rng.range(0.6, 1.6) });
      }
      g0.spawn = rng.range(1.6, 3.2);
    }
    for (const h of heli) {
      if (!h.on) continue;
      h.x += h.vx * dt;
      h.drop -= dt;
      if (h.drop <= 0 && h.x > 20 && h.x < W - 20 && Math.abs(h.x - GUN_X) > 24) {
        const t = troopers.find((x) => !x.on);
        if (t) Object.assign(t, { on: true, x: h.x, y: h.y + 8, chute: true, landed: false });
        h.drop = rng.range(1.2, 2.6);
      }
      if (h.x < -40 || h.x > W + 40) h.on = false;
    }
    for (const t of troopers) {
      if (!t.on || t.landed) continue;
      t.y += (t.chute ? 26 : 140) * dt;
      if (t.y >= GROUND - 6) {
        if (t.chute) { t.landed = true; t.y = GROUND - 6; g0.landed++; } else t.on = false;
      }
    }
    for (const b of bullets) {
      if (!b.on) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < 22 || b.x < 0 || b.x > W) { b.on = false; continue; }
      for (const h of heli) {
        if (h.on && Math.abs(b.x - h.x) < 16 && Math.abs(b.y - h.y) < 8) { h.on = false; b.on = false; g0.score += 10; }
      }
      for (const t of troopers) {
        if (!t.on || t.landed || !b.on) continue;
        if (t.chute && Math.abs(b.x - t.x) < 8 && b.y > t.y - 18 && b.y < t.y - 6) { t.chute = false; b.on = false; g0.score += 3; }
        else if (Math.abs(b.x - t.x) < 4 && Math.abs(b.y - t.y) < 6) { t.on = false; b.on = false; g0.score += 5; }
      }
    }
    if (g0.landed >= 5) g0.state = 'over';
  }

  return {
    id: 'parachute',
    title: 'Parachute',
    fullscreen: true,
    enter() { last = 0; },
    animating() { return g0.state === 'playing'; },
    highlight() { return { index: g0.landed, label: `Score ${g0.score}` }; },
    handle(e) {
      if (e.type === 'scroll') {
        if (g0.state === 'over') return false;
        const a = Math.max(-1.35, Math.min(1.35, g0.angle + e.delta * 0.105));
        if (a === g0.angle) return false;
        g0.angle = a;
        return true;
      }
      if (e.type === 'press' && e.part === 'select') {
        if (g0.state === 'over') { reset(); return true; }
        if (g0.state !== 'playing') { g0.state = 'playing'; last = 0; return true; }
        return fire();
      }
      if (e.type === 'press' && e.part === 'play') {
        if (g0.state === 'playing') { g0.state = 'paused'; return true; }
        if (g0.state === 'paused') { g0.state = 'playing'; last = 0; return true; }
      }
      return undefined;
    },
    draw(g, r, now) {
      let dt = last ? (now - last) / 1000 : 1 / 40;
      if (dt > 0.05) dt = 0.05;
      last = now;
      if (g0.state === 'playing') step(dt);
      g.save();
      g.translate(r.x, r.y);
      g.fillStyle = ui.gradient(g, 0, 22, 0, GROUND, SKY_STOPS);
      g.fillRect(0, 22, W, GROUND - 22);
      g.fillStyle = ui.gradient(g, 0, GROUND, 0, H, GRASS_STOPS);
      g.fillRect(0, GROUND, W, H - GROUND);
      // HUD strip, like Brick's.
      g.fillStyle = ui.gradient(g, 0, 0, 0, 21, C.status);
      g.fillRect(0, 0, W, 21);
      g.fillStyle = C.statusLine;
      g.fillRect(0, 21, W, 1);
      g.font = F_HUD;
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      g.fillStyle = C.text;
      g.fillText(`Score: ${g0.score}`, 8, 16);
      g.textAlign = 'right';
      g.fillText(`Landed: ${g0.landed}/5`, W - 8, 16);
      g.textAlign = 'center';
      g.font = FONTS.title;
      g.fillText('Parachute', W / 2, 16);
      for (const h of heli) {
        if (!h.on) continue;
        g.fillStyle = '#2f3b45';
        g.beginPath(); g.ellipse(h.x, h.y, 13, 6, 0, 0, TAU); g.fill();
        g.fillRect(h.x - (h.vx > 0 ? 24 : -11), h.y - 2, 13, 3);
        g.fillStyle = '#9fd3ff';
        g.beginPath(); g.ellipse(h.x + (h.vx > 0 ? 6 : -6), h.y - 1, 5, 3.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#1a1a1a';
        const blade = 16 * Math.abs(Math.sin(now / 30));
        g.fillRect(h.x - blade, h.y - 9, blade * 2, 1.5);
      }
      for (const t of troopers) {
        if (!t.on) continue;
        if (t.chute && !t.landed) {
          g.fillStyle = '#ffffff';
          g.beginPath(); g.arc(t.x, t.y - 14, 8, Math.PI, TAU); g.fill();
          g.strokeStyle = '#d0021b';
          g.lineWidth = 1;
          g.stroke();
          g.strokeStyle = '#555';
          g.beginPath(); g.moveTo(t.x - 8, t.y - 14); g.lineTo(t.x, t.y - 4); g.lineTo(t.x + 8, t.y - 14); g.stroke();
        }
        g.fillStyle = '#3d4a2a';
        g.fillRect(t.x - 2, t.y - 4, 4, 8);
        g.beginPath(); g.arc(t.x, t.y - 6, 2.4, 0, TAU); g.fill();
      }
      for (const b of bullets) if (b.on) { g.fillStyle = '#222'; g.fillRect(b.x - 1, b.y - 1, 2.5, 2.5); }
      // Turret: base, dome and a barrel that follows the wheel.
      g.save();
      g.translate(GUN_X, GUN_Y);
      g.rotate(g0.angle);
      g.fillStyle = '#3a3a3a';
      g.fillRect(-2.5, -18, 5, 16);
      g.restore();
      g.fillStyle = ui.gradient(g, 0, GUN_Y - 8, 0, GUN_Y + 8, C.hi);
      g.beginPath(); g.arc(GUN_X, GUN_Y, 9, Math.PI, TAU); g.fill();
      g.fillStyle = '#4a4a4a';
      g.fillRect(GUN_X - 16, GUN_Y, 32, GROUND - GUN_Y);
      if (g0.state !== 'playing') {
        const lines = g0.state === 'over' ? ['Game Over', 'Press center to play again']
          : g0.state === 'paused' ? ['Paused', 'Press Play/Pause to continue'] : ['Parachute', 'Scroll to aim · center to fire'];
        g.fillStyle = 'rgba(255,255,255,0.88)';
        g.fillRect(40, 96, 240, 50);
        g.strokeStyle = C.sbBorder;
        g.strokeRect(40.5, 96.5, 239, 49);
        g.textAlign = 'center';
        g.fillStyle = C.text;
        g.font = F_BIG;
        g.fillText(lines[0], W / 2, 119);
        g.font = FONTS.small;
        g.fillStyle = C.textDim;
        g.fillText(lines[1], W / 2, 136);
      }
      g.restore();
    },
  };
}

// ---------------------------------------------------------------- menus
function games(ctx) {
  return ctx.menu({
    id: 'games',
    title: 'Games',
    items: [
      { label: 'Brick', open: (c) => brick(c) },
      { label: 'Music Quiz', open: (c) => musicQuiz(c) },
      { label: 'Parachute', open: (c) => parachute(c) },
      { label: 'Solitaire', open: (c) => alertScreen(c, 'solitaire', 'Solitaire', 'Solitaire', 'This game is not available on this assPod.') },
    ],
  });
}

export function extras(ctx) {
  return ctx.menu({
    id: 'extras',
    title: 'Extras',
    items: [
      { label: 'Clock', open: (c) => clockScreen(c) },
      { label: 'Contacts', open: (c) => contacts(c) },
      { label: 'Calendar', open: (c) => calendar(c) },
      { label: 'Notes', open: (c) => notes(c) },
      { label: 'Games', open: (c) => games(c) },
      { label: 'Stopwatch', open: (c) => stopwatch(c) },
      { label: 'Screen Lock', open: (c) => screenLock(c) },
    ],
  });
}
