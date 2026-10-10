// Generic 5G list screen (ctx.menu): full-width rows, blue highlight, no wrap-around,
// a window that only scrolls when the highlight passes its edge, a scrollbar above 9 rows,
// and a marquee on the highlighted label when it doesn't fit.

import { M, C, FONTS } from './theme.js';

/**
 * @typedef {import('./os.js').ScreenContext} ScreenContext
 * @typedef {import('./os.js').Screen} Screen
 * @typedef {{
 *   id?: string,                                // extension: stable id for os.debug.goto
 *   label: string | (() => string),
 *   detail?: string | (() => string),
 *   chevron?: boolean,
 *   check?: () => boolean,
 *   speaker?: () => boolean,
 *   open?: (ctx: ScreenContext) => Screen,
 *   action?: (ctx: ScreenContext) => boolean | void,
 * }} MenuItem
 * @typedef {{
 *   id: string, title: string | (() => string),
 *   items: MenuItem[] | (() => MenuItem[]),
 *   initialIndex?: () => number,                // extension: where the highlight starts on enter
 * }} MenuDef
 */

// ---------------------------------------------------------------- constants

const ACCEL_MIN_ITEMS = 40;   // only long lists accelerate
const ACCEL_WINDOW_MS = 400;

function resolve(v) {
  return typeof v === 'function' ? v() : v;
}

// ---------------------------------------------------------------- list screen

/**
 * @param {ScreenContext} ctx
 * @param {MenuDef} def
 * @returns {Screen & { menuItems(): MenuItem[], setIndex(i: number): void, refresh(): void }}
 */
export function createMenu(ctx, def) {
  const ui = ctx.ui;
  /** @type {MenuItem[]} */
  let items = [];
  let index = 0;
  let first = 0;
  let hiSince = 0;          // when the highlight landed: the marquee clock
  let hiOverflow = false;   // set at draw time, read by animating()
  let hiTextW = 0;
  let hiBoxW = 0;
  let lastMarqueeX = 0;
  const stepTimes = new Float64Array(10);   // ring of recent scroll times, for acceleration
  let stepHead = 0;
  // One scratch row object, reused for every row on every draw.
  const row = { label: '', detail: '', chevron: false, speaker: false, check: false, highlighted: false, marqueeX: 0 };

  function clampWindow() {
    const n = items.length;
    if (index >= n) index = Math.max(0, n - 1);
    if (index < 0) index = 0;
    if (index < first) first = index;
    if (index >= first + M.rows) first = index - M.rows + 1;
    first = Math.max(0, Math.min(first, n - M.rows));
  }

  function refresh() {
    items = resolve(def.items) ?? [];
    clampWindow();
  }

  function setIndex(i) {
    index = i;
    clampWindow();
    hiSince = ctx.now();
  }

  /** Rows to move for this scroll step: 1, or 2/4 when spinning fast through a long list. */
  function accel() {
    if (items.length <= ACCEL_MIN_ITEMS) return 1;
    const now = ctx.now();
    stepTimes[stepHead] = now;
    stepHead = (stepHead + 1) % stepTimes.length;
    let recent = 0;
    for (let i = 0; i < stepTimes.length; i++) if (stepTimes[i] > 0 && now - stepTimes[i] <= ACCEL_WINDOW_MS) recent++;
    return recent >= 10 ? 4 : recent >= 6 ? 2 : 1;
  }

  /** @type {Screen & { menuItems(): MenuItem[], setIndex(i: number): void, refresh(): void }} */
  const screen = {
    id: def.id,
    title: def.title,
    isMenu: true,

    enter() {
      refresh();
      if (def.initialIndex) setIndex(def.initialIndex());
      hiSince = ctx.now();
    },
    resume() {
      refresh();
      hiSince = ctx.now();
    },
    refresh,
    setIndex,
    menuItems: () => items,

    handle(e) {
      if (e.type === 'scroll') {
        if (!items.length) return false;
        const next = Math.max(0, Math.min(items.length - 1, index + e.delta * accel()));
        if (next === index) return false;
        setIndex(next);
        return true;
      }
      if (e.type === 'press' && e.part === 'select') {
        const it = items[index];
        if (!it) return false;
        if (it.open) {
          const s = it.open(ctx);
          if (s) ctx.push(s);
          return true;
        }
        if (it.action) {
          const changed = it.action(ctx) === true;
          refresh();
          return changed;
        }
        return false;
      }
      return undefined;
    },

    draw(g, r, now) {
      g.fillStyle = C.bg;
      g.fillRect(r.x, r.y, r.w, r.h);
      const n = items.length;
      const scroll = n > M.rows;
      const w = scroll ? M.W - M.scrollbarW : M.W;
      const end = Math.min(n, first + M.rows);
      hiOverflow = false;
      for (let i = first; i < end; i++) {
        const it = items[i];
        row.label = String(resolve(it.label) ?? '');
        row.detail = it.detail != null ? String(resolve(it.detail)) : '';
        row.chevron = it.chevron ?? !!it.open;
        row.check = it.check ? !!it.check() : false;
        row.speaker = it.speaker ? !!it.speaker() : false;
        row.highlighted = i === index;
        row.marqueeX = 0;
        if (row.highlighted) {
          hiTextW = ui.measure(g, row.label, FONTS.row);
          hiBoxW = ui.rowLabelWidth(g, w, row);
          hiOverflow = hiTextW > hiBoxW;
          if (hiOverflow) row.marqueeX = ui.marquee(now, hiSince, hiTextW, hiBoxW);
          lastMarqueeX = row.marqueeX;
        }
        ui.drawRow(g, r.y + (i - first) * M.rowH, w, row);
      }
      if (scroll) ui.drawScrollbar(g, M.W - M.scrollbarW, r.y, M.rows * M.rowH, n, M.rows, first);
    },

    // Redraw only while the marquee is moving, plus one frame to settle it back at the start.
    animating(now) {
      if (!hiOverflow) return false;
      return ui.marquee(now, hiSince, hiTextW, hiBoxW) !== 0 || lastMarqueeX !== 0;
    },

    highlight() {
      const it = items[index];
      return it ? { index, label: String(resolve(it.label) ?? '') } : null;
    },
  };
  return screen;
}
