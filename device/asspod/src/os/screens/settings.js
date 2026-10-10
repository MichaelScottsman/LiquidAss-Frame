// Settings, following the 5G: values cycle in place (Shuffle, Repeat, Clicker),
// option lists show a checkmark and return to Settings when one is picked (Backlight Timer, EQ),
// Brightness has its own slider screen, plus About, Date & Time, Legal and Reset Settings.
// EQ is VLC's own equalizer presets. (The body's colour is on the main menu: Color.)

// ---------------------------------------------------------------- option tables

const SHUFFLE = [['off', 'Off'], ['songs', 'Songs'], ['albums', 'Albums']];
const REPEAT = [['off', 'Off'], ['one', 'One'], ['all', 'All']];
const ON_OFF = [[false, 'Off'], [true, 'On']];
const TIME_FORMAT = [['12', '12-hour'], ['24', '24-hour']];

const BACKLIGHT_TIMER = [
  [0, 'Off'], [2, '2 Seconds'], [5, '5 Seconds'], [10, '10 Seconds'],
  [15, '15 Seconds'], [20, '20 Seconds'], [30, '30 Seconds'], [-1, 'Always On'],
];

// VLC's equalizer presets, in VLC's own order after 'Off' (the daemon maps a name to VLC's
// preset number; device/shell_ext/asspod.py EQ_PRESETS lists the same names).
export const EQ_NAMES = [
  'Off', 'Flat', 'Classical', 'Club', 'Dance', 'Full Bass', 'Full Bass & Treble', 'Full Treble',
  'Headphones', 'Large Hall', 'Live', 'Party', 'Pop', 'Reggae', 'Rock', 'Ska', 'Soft', 'Soft Rock',
  'Techno',
];

const BRIGHTNESS_STEPS = 16;

// ---------------------------------------------------------------- helpers

function labelFor(table, value) {
  const row = table.find(([v]) => v === value);
  return row ? row[1] : table[0][1];
}

/** A row whose value is shown on the right and advances to the next option on select. */
function cycleItem(ctx, label, key, table) {
  return {
    id: key,
    label,
    detail: () => labelFor(table, ctx.settings.get(key)),
    action: (c) => {
      const i = table.findIndex(([v]) => v === c.settings.get(key));
      c.settings.set(key, table[(i + 1) % table.length][0]);
      return true;
    },
  };
}

/** Option submenu: a checkmark on the current value; picking one sets it and goes back. */
function optionList(ctx, id, title, key, table) {
  return ctx.menu({
    id,
    title,
    initialIndex: () => Math.max(0, table.findIndex(([v]) => v === ctx.settings.get(key))),
    items: table.map(([value, label]) => ({
      label,
      check: () => ctx.settings.get(key) === value,
      action: (c) => {
        c.settings.set(key, value);
        c.pop();
        return true;
      },
    })),
  });
}

// ---------------------------------------------------------------- Brightness

function drawSun(g, cx, cy, r, rays, color) {
  g.save();
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = 1.3;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.moveTo(cx + Math.cos(a) * (r + 1.8), cy + Math.sin(a) * (r + 1.8));
    g.lineTo(cx + Math.cos(a) * (r + 1.8 + rays), cy + Math.sin(a) * (r + 1.8 + rays));
  }
  g.stroke();
  g.restore();
}

/** Slider screen: dim sun, bar, bright sun, laid out like the volume overlay. */
function brightnessScreen(ctx) {
  const { settings, ui, theme } = ctx;
  const { C } = theme;
  const value = () => {
    const b = Number(settings.get('brightness'));
    return Number.isFinite(b) ? Math.min(1, Math.max(0, b)) : 0.75;
  };
  return {
    id: 'brightness',
    title: 'Brightness',
    handle(e) {
      if (e.type === 'scroll') {
        const b = value();
        const next = Math.min(1, Math.max(0, Math.round(b * BRIGHTNESS_STEPS + e.delta) / BRIGHTNESS_STEPS));
        if (next === b) return false;
        settings.set('brightness', next);
        return true;
      }
      if (e.type === 'press' && e.part === 'select') { ctx.pop(); return true; }
      return undefined;
    },
    draw(g, r) {
      g.fillStyle = C.bg;
      g.fillRect(r.x, r.y, r.w, r.h);
      const y = 124;
      drawSun(g, 15, y + 7, 2.2, 1.6, C.text);
      ui.drawProgress(g, 28, y + 2, 264, 10, value());
      drawSun(g, 305, y + 7, 3.4, 2.6, C.text);
    },
    highlight: () => null,
  };
}

// ---------------------------------------------------------------- About

/**
 * The 5G About page: the assPod's name centered in bold, then label/value lines. It is a page,
 * not a menu, so there is no highlight; the wheel scrolls it when it overflows.
 */
function aboutScreen(ctx) {
  const { library: lib, ui, theme } = ctx;
  const { C, M, FONTS } = theme;
  const songs = lib.tracks?.length ?? 0;
  const videos = lib.videos?.length ?? 0;
  const albums = lib.albums?.length ?? 0;
  const secs = (list) => (list ?? []).reduce((s, t) => s + (t.duration || 0), 0);
  const hours = (secs(lib.tracks) + secs(lib.videos)) / 3600;
  const info = lib.info || {};
  const lines = [
    ['Songs', songs.toLocaleString('en-US')],
    ['Albums', albums.toLocaleString('en-US')],
    ['Videos', videos.toLocaleString('en-US')],
    ['Playing Time', `${hours.toFixed(1)} h`],
    ['Sources', String((info.sources || []).length)],
    ['Player', 'VLC'],
    ['Model', 'assPod Video'],
  ];
  const total = lines.length + 1;   // + the name line
  let first = 0;
  return {
    id: 'about',
    title: 'About',
    handle(e) {
      if (e.type === 'scroll') {
        const next = Math.max(0, Math.min(total - M.rows, first + e.delta));
        if (next === first) return false;
        first = next;
        return true;
      }
      if (e.type === 'press' && e.part === 'select') return false;
      return undefined;
    },
    draw(g, r) {
      g.fillStyle = C.bg;
      g.fillRect(r.x, r.y, r.w, r.h);
      const scroll = total > M.rows;
      const w = scroll ? M.W - M.scrollbarW : M.W;
      g.save();
      g.textBaseline = 'alphabetic';
      g.fillStyle = C.text;
      for (let i = first; i < Math.min(total, first + M.rows); i++) {
        const y = r.y + (i - first) * M.rowH + M.rowBaseline;
        if (i === 0) {
          g.font = FONTS.row;
          g.textAlign = 'center';
          g.fillText('assPod', w / 2, y);
          continue;
        }
        const [label, value] = lines[i - 1];
        g.font = FONTS.row;
        g.textAlign = 'left';
        g.fillText(label, M.padX, y);
        g.font = FONTS.detail;
        g.textAlign = 'right';
        g.fillText(value, w - M.padX, y);
      }
      g.restore();
      if (scroll) ui.drawScrollbar(g, M.W - M.scrollbarW, r.y, M.rows * M.rowH, total, M.rows, first);
    },
    highlight: () => null,
  };
}

// ---------------------------------------------------------------- Date & Time

function dateTimeMenu(ctx) {
  const zone = (() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      return tz.split('/').pop().replace(/_/g, ' ');
    } catch { return 'UTC'; }
  })();
  const date = () => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  return ctx.menu({
    id: 'datetime',
    title: 'Date & Time',
    items: [
      { label: 'Set Time Zone', detail: zone },
      { label: 'Set Date & Time', detail: date },
      cycleItem(ctx, 'Time', 'timeFormat', TIME_FORMAT),
    ],
  });
}

// ---------------------------------------------------------------- Legal

const LEGAL = [
  'assPod is part of LiquidAss. Your music and videos come from the VLC media library on this '
    + 'headset, and VLC plays them.',
  'VLC is copyright VideoLAN and licensed under the GNU GPL 2.0 or later. FFmpeg reads the tags '
    + 'and artwork.',
  'Inter is copyright The Inter Project Authors and licensed under the SIL Open Font License 1.1.',
  'Portions of this software are provided "as is", without warranty of any kind, express or '
    + 'implied, including but not limited to the warranties of merchantability, fitness for a '
    + 'particular purpose and noninfringement.',
];

/** Scrolling text page: the wheel moves one line per step, with the list scrollbar on the right. */
function legalScreen(ctx) {
  const { ui, theme } = ctx;
  const { C, M, FONTS } = theme;
  const LINE_H = 16;
  const TEXT_W = 292;
  const VISIBLE = 13;
  let first = 0;
  let lines = [];
  let wrappedWith = -1;

  function wrap(g) {
    // Re-wrap only when glyph metrics change (fonts finishing loading clears the measure cache).
    const probe = ui.measure(g, 'The quick brown fox', FONTS.small);
    if (probe === wrappedWith) return;
    wrappedWith = probe;
    lines = [];
    for (const para of LEGAL) {
      let line = '';
      for (const word of para.split(' ')) {
        const tryLine = line ? line + ' ' + word : word;
        if (line && ui.measure(g, tryLine, FONTS.small) > TEXT_W) { lines.push(line); line = word; } else line = tryLine;
      }
      lines.push(line, '');
    }
    lines.pop();
  }

  return {
    id: 'legal',
    title: 'Legal',
    handle(e) {
      if (e.type === 'scroll') {
        const max = Math.max(0, lines.length - VISIBLE);
        const next = Math.max(0, Math.min(max, first + e.delta));
        if (next === first) return false;
        first = next;
        return true;
      }
      if (e.type === 'press' && e.part === 'select') return false;
      return undefined;
    },
    draw(g, r) {
      wrap(g);
      g.fillStyle = C.bg;
      g.fillRect(r.x, r.y, r.w, r.h);
      g.save();
      g.font = FONTS.small;
      g.fillStyle = C.text;
      g.textBaseline = 'alphabetic';
      for (let i = 0; i < VISIBLE && first + i < lines.length; i++) {
        g.fillText(lines[first + i], M.padX, r.y + 16 + i * LINE_H);
      }
      g.restore();
      if (lines.length > VISIBLE) {
        ui.drawScrollbar(g, M.W - M.scrollbarW, r.y, M.rows * M.rowH, lines.length, VISIBLE, first);
      }
    },
    highlight: () => null,
  };
}

// ---------------------------------------------------------------- Reset

function resetMenu(ctx) {
  return ctx.menu({
    id: 'reset',
    title: 'Reset All',
    items: [
      { id: 'cancel', label: 'Cancel', action: (c) => { c.pop(); return true; } },
      {
        id: 'reset',
        label: 'Reset',
        action: (c) => {
          c.settings.reset();
          c.pop();
          return true;
        },
      },
    ],
  });
}

// ---------------------------------------------------------------- Settings

export function createSettings(ctx) {
  return ctx.menu({
    id: 'settings',
    title: 'Settings',
    items: [
      { id: 'about', label: 'About', open: aboutScreen },
      cycleItem(ctx, 'Shuffle', 'shuffle', SHUFFLE),
      cycleItem(ctx, 'Repeat', 'repeat', REPEAT),
      { id: 'backlighttimer', label: 'Backlight Timer', open: (c) => optionList(c, 'backlighttimer', 'Backlight Timer', 'backlightTimer', BACKLIGHT_TIMER) },
      { id: 'brightness', label: 'Brightness', open: brightnessScreen },
      { id: 'eq', label: 'EQ', open: (c) => optionList(c, 'eq', 'EQ', 'eq', EQ_NAMES.map((n) => [n, n])) },
      cycleItem(ctx, 'Clicker', 'clicker', ON_OFF),
      { id: 'datetime', label: 'Date & Time', open: dateTimeMenu },
      { id: 'legal', label: 'Legal', open: legalScreen },
      { id: 'resetsettings', label: 'Reset Settings', open: resetMenu },
    ],
  });
}
