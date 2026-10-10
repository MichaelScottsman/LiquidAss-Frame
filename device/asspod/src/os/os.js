// assPod OS core: screen stack, 220 ms slide transitions, status bar, backlight timer and dimming,
// sleep/wake, the boot logo, the default button behavior, and render throttling for the screen
// texture. Draws the 320x240 logical LCD onto the 640x480 canvas that main.js uploads as a texture.

import { SCREEN_W } from '../config.js';
import { settings as defaultSettings } from '../settings.js';
import { drawPeachSilhouette } from '../brand/peach.js';
import * as theme from './theme.js';
import * as ui from './ui.js';
import { createMenu } from './menu.js';
import { createMainMenu } from './screens/main-menu.js';
import { createNowPlaying } from './screens/now-playing.js';

const { M, C, ANIM } = theme;

/**
 * @typedef {import('../input/clickwheel.js').WheelEvent} WheelEvent
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {{
 *   id: string, title: string | (() => string), fullscreen?: boolean, keepAwake?: boolean,
 *   handle?(e: WheelEvent): boolean | undefined, draw(g: CanvasRenderingContext2D, r: Rect, now: number): void,
 *   animating?(now: number): boolean, refreshMs?: number,
 *   enter?(): void, exit?(): void, resume?(): void, refresh?(): void,
 *   highlight?(): { index: number, label: string } | null,
 * }} Screen
 * @typedef {{
 *   os: AssPodOS, player: any, library: any, art: any, apps: any, settings: any,
 *   theme: typeof theme, ui: typeof ui,
 *   push(s: Screen): void, pop(): void, popToRoot(): void, replace(s: Screen): void,
 *   menu(def: import('./menu.js').MenuDef): Screen, nowPlaying(): void, invalidate(): void,
 *   now(): number, top(): Screen,
 * }} ScreenContext
 * @typedef {{
 *   handleWheelEvent(e: WheelEvent): boolean, render(now: number): boolean,
 *   readonly backlight: number, readonly asleep: boolean, invalidate(): void,
 *   getState(): { stack: string[], title: string, highlight: { index: number, label: string } | null,
 *                 asleep: boolean, backlight: number, transitioning: boolean, booting: boolean },
 *   debug: { goto(path: string[]): void },
 *   toggleBacklight(): void, sleep(): void, wake(): void, setHold(on: boolean): void, readonly hold: boolean,
 *   boot(ms?: number): void, setLoading(on: boolean): void,
 *   readonly ctx: ScreenContext,
 * }} AssPodOS
 */

// ---------------------------------------------------------------- constants

const CONTENT = Object.freeze({ x: 0, y: M.statusH, w: M.W, h: M.H - M.statusH });
const FULL = Object.freeze({ x: 0, y: 0, w: M.W, h: M.H });
const FRAME_MS = 1000 / ANIM.maxFps;
// rAF timestamps jitter by a fraction of a ms; without slack a 25 ms cap would skip a frame at 80 Hz.
const FRAME_SLACK_MS = 1;
const DIRTY_NONE = 0;
const DIRTY_SOFT = 1;   // player/settings change: redraw at the next frame the 40 fps cap allows
const DIRTY_NOW = 2;    // input: redraw on this very frame
const BOOT_LOGO_H = 112;   // design-box height of the boot logo: the art is ~45% of the screen, as on the 5G

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

function titleOf(s) {
  return typeof s.title === 'function' ? s.title() : s.title;
}

function normKey(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------- OS

/**
 * `boot` shows the boot logo at startup and on every wake from sleep. It is opt-in, so harnesses
 * that drive the OS directly start on the menu.
 * @param {{ canvas: HTMLCanvasElement, player: any, library: any, art: any, apps: any, settings?: any, boot?: boolean }} opts
 * @returns {AssPodOS}
 */
export function createOS({ canvas, player, library, art, apps, settings = defaultSettings, boot: bootEnabled = false }) {
  const g = canvas.getContext('2d');
  const scale = canvas.width / SCREEN_W;

  /** @type {Screen[]} */
  const stack = [];
  /** @type {{ from: Screen, to: Screen, dir: 1 | -1, start: number } | null} */
  let transition = null;
  let dirty = DIRTY_NOW;
  let lastDraw = -Infinity;
  let lastNow = 0;
  let haveNow = false;

  // Backlight: `lit` is the logical state, `level` the faded multiplier main.js applies to the screen.
  let lit = settings.get('backlightTimer') !== 0;
  let level = 1;
  let lastActivity = 0;
  let litAtPress = true;   // backlight state before the latest press, so MENU-hold toggles what the user saw
  let asleep = false;
  let swallowPart = null;  // the rest of a press gesture that woke the assPod
  let swallowTouch = false;
  let hold = false;        // hold switch (P2): wheel input ignored, lock shown in the status bar
  /** @type {{ ms: number, end: number, painted: boolean } | null} */
  let boot = null;         // boot logo showing; `end` is NaN until the first render times it

  const status = { title: '', play: 'stopped', locked: false };

  // ---------------------------------------------------------------- stack

  function top() {
    return stack[stack.length - 1];
  }

  // Input arrives between frames, so a slide starts at the previous frame's time and the next
  // render already shows it moving. Before the first render there is no clock yet: NaN makes
  // render() start it then.
  function slideStart() {
    return haveNow ? lastNow : NaN;
  }

  function push(s, instant = false) {
    const from = top();
    stack.push(s);
    s.enter?.();
    transition = from && !instant ? { from, to: s, dir: 1, start: slideStart() } : null;
    dirty = DIRTY_NOW;
  }

  function pop(instant = false) {
    if (stack.length <= 1) return;
    const from = stack.pop();
    from.exit?.();
    const to = top();
    to.resume?.();
    transition = instant ? null : { from, to, dir: -1, start: slideStart() };
    dirty = DIRTY_NOW;
  }

  function popToRoot(instant = false) {
    if (stack.length <= 1) return;
    const from = top();
    while (stack.length > 1) stack.pop().exit?.();
    const to = top();
    to.resume?.();
    transition = instant ? null : { from, to, dir: -1, start: slideStart() };
    dirty = DIRTY_NOW;
  }

  /** Swaps the top screen in place, with no slide (e.g. a photo going full screen into a slideshow). */
  function replace(s) {
    const old = stack.pop();
    old?.exit?.();
    stack.push(s);
    s.enter?.();
    if (transition && transition.to === old) transition.to = s;
    dirty = DIRTY_NOW;
  }

  function nowPlaying() {
    const cur = player.current;
    if (!cur) return;
    const t = top();
    if (t && (t.id === 'nowplaying' || t.id === 'videoplayer')) return;
    if (cur.kind === 'video') push(apps.videoPlayer(ctx, cur, { start: false }));
    else push(createNowPlaying(ctx));
  }

  // ---------------------------------------------------------------- backlight and sleep

  function timerSetting() {
    return settings.get('backlightTimer');
  }

  /** Full-on level: the Brightness setting maps 0..1 onto 0.6..1 so even the minimum stays readable. */
  function litLevel() {
    const b = Number(settings.get('brightness'));
    return 0.6 + 0.4 * Math.min(1, Math.max(0, Number.isFinite(b) ? b : 0.75));
  }

  function targetLevel() {
    if (boot) return litLevel();   // the logo always shows lit, whatever the timer says
    if (asleep) return 0;
    return lit ? litLevel() : ANIM.backlightDim;
  }

  /** User activity: lights the backlight (unless the timer is Off) and restarts the timer. */
  function activity() {
    lastActivity = lastNow;
    if (timerSetting() !== 0) lit = true;
  }

  function setLit(on) {
    lit = on;
    litAtPress = on;
    lastActivity = lastNow;
  }

  /**
   * Flips the backlight relative to what the user saw before the press that asked for it
   * (that press has already lit the screen as activity), so a dark screen turns on, not off.
   */
  function toggleBacklight() {
    setLit(!litAtPress);
    dirty = DIRTY_NOW;
  }

  function sleep() {
    if (asleep) return;
    if (player.state === 'playing') player.pause();
    if (player.seeking) player.stopSeek();
    asleep = true;
    boot = null;
    lit = false;
    transition = null;
    dirty = DIRTY_NOW;
  }

  function wake() {
    if (!asleep) return;
    asleep = false;
    lit = timerSetting() !== 0;
    lastActivity = lastNow;
    dirty = DIRTY_NOW;
    // Holding Play is the only "power off" here, so waking is a power-on: show the logo, briefly.
    // (The real 5G resumed instantly from light sleep.) The screen stack is kept underneath.
    if (bootEnabled) startBoot(ANIM.wakeBootMs);
  }

  function updateBacklight(now, dtMs) {
    const timer = timerSetting();
    if (!asleep && !boot && lit && timer > 0 && !top()?.keepAwake && now - lastActivity > timer * 1000) lit = false;
    const target = targetLevel();
    // The first render snaps to the target, except during a boot, which fades up from black.
    if (dtMs <= 0) { if (!boot) level = target; return; }
    const step = dtMs / ANIM.backlightFadeMs;
    level = level < target ? Math.min(target, level + step) : Math.max(target, level - step);
  }

  // ---------------------------------------------------------------- boot

  /**
   * Shows the boot logo for `ms`, timed from the next render. The backlight restarts from 0, so the
   * usual 300 ms fade is the power-on fade (a material change, not a texture upload).
   */
  function startBoot(ms) {
    // Releases are swallowed while booting, so nothing could end a running seek later.
    if (player.seeking) player.stopSeek();
    boot = { ms, end: NaN, painted: false };
    asleep = false;
    transition = null;
    level = 0;
    dirty = DIRTY_NOW;
  }

  /** Idempotent: hands over to the screen stack with the backlight timer restarted. */
  function endBoot() {
    if (!boot) return;
    boot = null;
    lit = timerSetting() !== 0;
    lastActivity = lastNow;
    dirty = DIRTY_NOW;
  }

  // ---------------------------------------------------------------- input

  /** OS default behavior for events a screen leaves to the OS (its handle returned undefined). */
  function defaultHandle(e) {
    const hasItem = !!player.current;
    switch (e.type) {
      case 'press':
        if (e.part === 'menu') {
          if (stack.length > 1) { pop(); return true; }
          return false;
        }
        if (e.part === 'play') {
          if (!hasItem) return false;
          player.togglePlay();
          return true;
        }
        return false;
      case 'hold':
        if (e.part === 'menu') { toggleBacklight(); return true; }
        if ((e.part === 'next' || e.part === 'prev') && hasItem) {
          player.startSeek(e.part === 'next' ? 1 : -1);
          return true;
        }
        return false;
      case 'longhold':
        if (e.part === 'play') { sleep(); return true; }
        return false;
      case 'release':
        if ((e.part === 'next' || e.part === 'prev') && hasItem) {
          if (e.held) player.stopSeek();
          else if (e.part === 'next') player.next();
          else player.prev();
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  /** @param {WheelEvent} e  @returns {boolean} true when the UI visibly reacted */
  function handleWheelEvent(e) {
    if (boot) {
      // Booting: the wheel does nothing. A press or touch that starts now is swallowed to its end,
      // even after the boot, so it can't act on the menu that appears under the thumb.
      if (e.type === 'press') swallowPart = e.part;
      else if (e.type === 'release') { if (e.part === swallowPart) swallowPart = null; }
      else if (e.type === 'touch') swallowTouch = e.active;
      return false;
    }
    if (hold) {
      // Like the 5G with Hold on: a press only lights the screen so the lock icon can be seen.
      if (e.type === 'press' && !asleep) activity();
      return false;
    }
    if (asleep) {
      // Asleep: the first press, touch or scroll only wakes the assPod, and the rest of that
      // gesture (hold, release, scrolls of the same touch) is swallowed too.
      if (e.type === 'release') { if (e.part === swallowPart) swallowPart = null; return false; }
      if (e.type === 'touch' && !e.active) { swallowTouch = false; return false; }
      if (e.type === 'hold' || e.type === 'longhold') return false;
      wake();
      if (e.type === 'press') swallowPart = e.part;
      if (e.type === 'touch') swallowTouch = true;
      return true;
    }
    if (swallowPart && e.part === swallowPart && (e.type === 'hold' || e.type === 'longhold' || e.type === 'release')) {
      if (e.type === 'release') swallowPart = null;
      return false;
    }
    if (swallowTouch) {
      if (e.type === 'scroll') return false;
      if (e.type === 'touch' && !e.active) { swallowTouch = false; return false; }
    }

    // A cancelled release (the assPod was let go mid-press) only ends what the press started, a
    // running seek; it never fires the click (Next, Previous) the user didn't finish.
    if (e.type === 'release' && e.cancelled) {
      if (e.held && player.seeking) { player.stopSeek(); dirty = DIRTY_NOW; return true; }
      return false;
    }

    if (e.type === 'press') litAtPress = lit;
    // Releases and touch-ends don't count as activity: releasing MENU after a hold that turned
    // the light off must not turn it straight back on.
    if (e.type !== 'release' && !(e.type === 'touch' && !e.active)) activity();

    const s = top();
    let r = s.handle ? s.handle(e) : undefined;
    if (r === undefined) r = defaultHandle(e);
    if (r) dirty = DIRTY_NOW;
    return !!r;
  }

  // ---------------------------------------------------------------- drawing

  function drawStatus(s) {
    status.title = titleOf(s) ?? '';
    const st = player.state;
    status.play = st === 'playing' || st === 'paused' ? st : 'stopped';
    status.locked = hold;
    ui.drawStatusBar(g, status);
  }

  const reported = new WeakSet();
  function drawScreen(s, r, now) {
    try {
      s.draw(g, r, now);
    } catch (err) {
      // One broken screen must not take the whole OS down every frame; report it once.
      if (!reported.has(s)) { reported.add(s); console.error('[asspod-os] draw failed in screen', s.id, err); }
    }
  }

  function drawContent(s, dx, now) {
    if (dx <= -M.W || dx >= M.W) return;
    g.save();
    g.beginPath();
    g.rect(CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h);
    g.clip();
    g.translate(dx, 0);
    g.fillStyle = C.bg;
    g.fillRect(CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h);
    drawScreen(s, CONTENT, now);
    g.restore();
  }

  /** A whole screen (status bar included) offset by dx; used when a fullscreen screen slides. */
  function drawWhole(s, dx, now) {
    if (dx <= -M.W || dx >= M.W) return;
    if (s.fullscreen) {
      g.save();
      g.beginPath();
      g.rect(0, 0, M.W, M.H);
      g.clip();
      g.translate(dx, 0);
      // a screen whose picture lies under the page (podd's video panel) is clear, unless it slides
      if (s.transparent && dx === 0 && !transition) g.clearRect(0, 0, M.W, M.H);
      else {
        g.fillStyle = '#000000';
        g.fillRect(0, 0, M.W, M.H);
      }
      drawScreen(s, FULL, now);
      g.restore();
      return;
    }
    g.save();
    g.translate(dx, 0);
    drawStatus(s);
    g.restore();
    drawContent(s, dx, now);
  }

  function paint(now) {
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (asleep) {
      g.fillStyle = '#000000';
      g.fillRect(0, 0, M.W, M.H);
      return;
    }
    if (boot) {
      // Pure vector shapes, no text: the logo never waits for the web font.
      g.fillStyle = C.bootBg;
      g.fillRect(0, 0, M.W, M.H);
      drawPeachSilhouette(g, M.W / 2, M.H / 2, BOOT_LOGO_H, C.bootLogo);
      return;
    }
    if (transition) {
      const tr = transition;
      const t = Math.min(1, Math.max(0, (now - tr.start) / ANIM.slideMs));
      const k = 1 - easeOutCubic(t);
      // Push: old slides out left, new comes in from the right. Pop mirrors it.
      const dxTo = tr.dir > 0 ? M.W * k : -M.W * k;
      const dxFrom = tr.dir > 0 ? dxTo - M.W : dxTo + M.W;
      if (tr.from.fullscreen || tr.to.fullscreen) {
        g.fillStyle = '#000000';
        g.fillRect(0, 0, M.W, M.H);
        drawWhole(tr.from, dxFrom, now);
        drawWhole(tr.to, dxTo, now);
      } else {
        drawStatus(tr.to);   // the title swaps immediately; only the content slides
        drawContent(tr.from, dxFrom, now);
        drawContent(tr.to, dxTo, now);
      }
      if (t >= 1) transition = null;
    } else {
      drawWhole(top(), 0, now);
    }
  }

  /**
   * Redraws when needed and returns whether it drew (main.js then re-uploads the texture).
   * Input redraws immediately; animation, marquees, periodic refresh and player/settings
   * changes are capped at ANIM.maxFps.
   */
  function render(now) {
    const dtMs = haveNow ? now - lastNow : 0;
    lastNow = now;
    haveNow = true;
    // The power-on fade runs from the logo's first frame: a boot started between frames (wake, the
    // XR session start) must not count the gap before it, or the fade is skipped.
    updateBacklight(now, boot && !(boot.end >= 0) ? 0 : dtMs);
    if (boot) {
      // Timed from the first render after it started (NaN until then), like a slide, so a boot
      // started between frames lasts its full length and a virtual clock works.
      if (!(boot.end >= 0)) boot.end = now + boot.ms;
      else if (now >= boot.end) endBoot();
    }
    if (transition && !(transition.start <= now)) transition.start = now;

    let draw = dirty === DIRTY_NOW;
    if (boot) {
      // The logo is static: draw it once and hold it. Soft dirties, animation, refresh and even
      // invalidate() wait for the menu, so a whole boot costs two uploads (the logo, then the menu).
      draw = !boot.painted;
    } else if (!draw) {
      if (now - lastDraw < FRAME_MS - FRAME_SLACK_MS) return false;
      if (asleep) {
        draw = dirty !== DIRTY_NONE;
      } else {
        const s = top();
        draw = dirty !== DIRTY_NONE || !!transition
          || (s.animating ? !!s.animating(now) : false)
          || (s.refreshMs > 0 && now - lastDraw >= s.refreshMs - FRAME_SLACK_MS);
      }
    }
    if (!draw) return false;
    paint(now);
    if (boot) boot.painted = true;
    dirty = DIRTY_NONE;
    lastDraw = now;
    return true;
  }

  function invalidate() {
    ui.clearCache();
    // Screens that keep their own measured text (Cover Flow captions) re-measure on refresh; the
    // ones below re-measure on resume anyway.
    top()?.refresh?.();
    dirty = DIRTY_NOW;
  }

  // ---------------------------------------------------------------- media and settings events

  const soft = () => { if (dirty < DIRTY_SOFT) dirty = DIRTY_SOFT; };
  // Lists built from player state (the main menu's Now Playing row, speaker icons) refresh on changes.
  const playerChanged = () => { top()?.refresh?.(); soft(); };
  if (typeof player.on === 'function') {
    for (const type of ['state', 'track', 'queue']) player.on(type, playerChanged);
    for (const type of ['volume', 'rating']) player.on(type, soft);
    // FF/REW emits a seek every frame. Only the screens that draw the playhead redraw for it; a
    // static menu would otherwise re-upload an unchanged texture 40 times a second.
    player.on('seek', () => {
      const id = top()?.id;
      if (id === 'nowplaying' || id === 'videoplayer') soft();
    });
  }
  if (typeof settings.on === 'function') {
    settings.on('change', ({ key }) => {
      if (key === 'backlightTimer' || key === '*') {
        const t = timerSetting();
        lit = t !== 0;
        lastActivity = lastNow;
      }
      top()?.refresh?.();
      soft();
    });
  }

  // ---------------------------------------------------------------- debug

  function getState() {
    const s = top();
    return {
      stack: stack.map((x) => x.id),
      title: titleOf(s) ?? '',
      highlight: s.highlight ? s.highlight() : null,
      asleep,
      backlight: level,
      transitioning: !!transition,
      booting: !!boot,
    };
  }

  /**
   * Jumps straight to a screen, e.g. ['music', 'albums'] or ['settings', 'eq'], with no slides.
   * Each segment matches a menu item's id, its label (case and punctuation ignored), or the id
   * of the screen the item opens; 'nowplaying' also works from anywhere when something is current.
   */
  function goto(path) {
    if (asleep) wake();
    endBoot();   // tests and tools want the screen they asked for, not the logo
    popToRoot(true);
    for (const seg of path) {
      const key = normKey(seg);
      const s = top();
      if (key === 'nowplaying' && player.current && !(s.menuItems && s.menuItems().some((it) => it.id === 'nowplaying'))) {
        nowPlaying();
        transition = null;
        continue;
      }
      if (!s.menuItems) throw new Error(`goto: screen "${s.id}" is not a menu (at "${seg}")`);
      const items = s.menuItems();
      let idx = items.findIndex((it) => (it.id != null && normKey(it.id) === key)
        || normKey(typeof it.label === 'function' ? it.label() : it.label) === key);
      let opened = null;
      if (idx < 0) {
        for (let i = 0; i < items.length && !opened; i++) {
          if (!items[i].open) continue;
          const candidate = items[i].open(ctx);
          if (candidate && normKey(candidate.id) === key) { idx = i; opened = candidate; }
        }
      }
      if (idx < 0) throw new Error(`goto: no item "${seg}" in "${s.id}"`);
      s.setIndex?.(idx);
      const it = items[idx];
      if (opened) push(opened, true);
      else if (it.open) { const next = it.open(ctx); if (next) push(next, true); }
      else if (it.action) it.action(ctx);
      transition = null;
    }
    dirty = DIRTY_NOW;
  }

  // ---------------------------------------------------------------- assembly

  /** @type {AssPodOS} */
  const os = {
    handleWheelEvent,
    render,
    get backlight() { return level; },
    get asleep() { return asleep; },
    invalidate,
    getState,
    debug: { goto },
    toggleBacklight,
    sleep,
    wake,
    /** Hold switch (P2): while on, wheel events are ignored and the status bar shows a lock. */
    setHold(on) { hold = !!on; dirty = DIRTY_NOW; },
    get hold() { return hold; },
    /** Shows the boot logo for `ms`; it also wakes a sleeping assPod. */
    boot(ms = ANIM.bootMs) { startBoot(Number.isFinite(ms) ? Math.max(0, ms) : ANIM.bootMs); },   // a NaN end would never time out
    /**
     * The boot logo while the player daemon (VLC) is starting: shown until setLoading(false), and
     * only then. The wheel is ignored meanwhile, as during any boot.
     */
    setLoading(on) {
      if (on) { if (!boot) startBoot(Infinity); else boot.ms = Infinity; }
      else if (boot) endBoot();
    },
    get ctx() { return ctx; },
  };

  /** @type {ScreenContext} */
  const ctx = {
    os, player, library, art, apps, settings, theme, ui,
    push: (s) => push(s),
    pop: () => pop(),
    popToRoot: () => popToRoot(),
    replace,
    menu: (def) => createMenu(ctx, def),
    nowPlaying,
    invalidate() { dirty = DIRTY_NOW; },
    now: () => lastNow,
    top,
  };

  push(createMainMenu(ctx), true);
  if (bootEnabled) startBoot(ANIM.bootMs);
  return os;
}
