// assPod: a 5th-generation-style music player in your hand in the SteamVR menu, playing the VLC
// media library. This is its half inside SteamVR's systemui page (installed by the daemon as the
// page script device/vr/systemui.asspod.js, built from these sources by tools/build_asspod.py);
// the daemon's plugin device/shell_ext/asspod.py runs VLC and reads the library.
//
// Flow: the bar's music-note button (device/rt/34-asspod.js) -> action asspod.open -> the plugin
// starts VLC (the boot logo shows until it answers) and calls open(): the assPod appears in the hand
// whose laser pressed the button (SteamVR's primary dashboard device): the original 3D model, face
// up in the palm with its wheel over the stick. The whole menu fades out (Steam's windows and the
// native glass); an invisible blocker takes the laser where it was, under "(menu glyph) to close".
// Closing fades the menu back in.
// Controls: both sticks turn the click wheel; a stick click presses the wheel button under it
// (centred: the centre button). A is the centre button, B is the wheel's Menu, and the hamburger
// (menu) button puts the assPod away; so does closing the SteamVR menu. The right controller's
// buttons are read here from its model; the left one's (A and B in the same places) come from Steam
// through the plugin (btn()). Music keeps playing: the player keeps running here at a few Hz, and
// the plugin keeps VLC up while anything plays and stops it when the assPod is away and nothing plays.
//
// The plugin talks to this page only through the returned api: poll() drains the commands for VLC
// and reports the state; setStatus(), setLibrary(), receiveArt(), setLoading() and btn() feed it.
import { SCREEN_W, SCREEN_H, SCREEN_SCALE } from './config.js';
import { settings } from './settings.js';
import { createOS } from './os/os.js';
import { apps } from './apps/index.js';
import { createLibrary } from './media/library.js';
import { createArt } from './media/art.js';
import { createVlcEngine } from './media/engine.js';
import { createPlayer } from './media/player.js';
import { createClickWheel } from './input/clickwheel.js';
import { createControllerReader } from './input/controllers.js';
import { playClick, unlockClicker, clickerState } from './media/clicker.js';
import { createFace, createBack, BODY } from './face.js';
import { drawPeachSilhouette } from './brand/peach.js';
import { createReflector, pose, qmul, qrot, qconj } from './reflect.js';
import { createSceneGraph } from './sg.js';

const FACE_W = 476;                        // px; the body is 61.8 x 103.5 mm
const FACE_H = Math.round(FACE_W * BODY.h / BODY.w);
const FACE_WIDTH_M = 0.085;                // shown about 1.4x the real body, for reading at arm's length
const BODY_M = {                           // the 3D body in metres, at that scale
  w: FACE_WIDTH_M, h: FACE_WIDTH_M * BODY.h / BODY.w, d: FACE_WIDTH_M * 11 / BODY.w, r: FACE_WIDTH_M * BODY.corner / BODY.w,
};
const BACK_W = 238;                        // px: the steel back's live reflection (half the face's resolution)
const BACK_H = Math.round(BACK_W * BODY.h / BODY.w);
const REFLECT_EVERY = 2;                   // frames between reflection updates (about 30 a second)
const MARGIN = 4;                          // px between our page rects
const CAPTION = { w: 820, h: 120 };
const SWATCH = { w: 48, h: 36 };           // the blocker's swatch (invisible; only its aspect matters)
// Steam's own glyph for the controller's menu (hamburger) button (/steaminputglyphs/sd_button_menu.svg)
const MENU_GLYPH = '<svg width="96" height="96" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">'
  + '<path fill-rule="evenodd" clip-rule="evenodd" d="M7.33333 8.66663C3.28324 8.66663 0 11.9499 0 16C0 20.05 3.28325 23.3333 7.33333 '
  + '23.3333H24.6667C28.7168 23.3333 32 20.05 32 16C32 11.9499 28.7168 8.66663 24.6667 8.66663H7.33333ZM20.6667 11.7222H11.3333V13.4333H20.6667V11.7222Z'
  + 'M11.3333 18.5667H20.6667V20.2778H11.3333V18.5667ZM20.6667 15.1444H11.3333V16.8555H20.6667V15.1444Z" fill="white"/></svg>';
const FRAME_MS = 16;
const BACKGROUND_MS = 250;                 // the player's clock while the assPod is away
const OUTBOX_MAX = 200;
const RESUME_MIN_S = 10;                   // a video's place is kept from here (asspod.py RESUME_MIN_S) ...
const RESUME_END_S = 30;                   // ... until this close to its end: then it starts over next time

export default function install(ctx) {
  const W = window;
  const doc = document;
  const t0 = performance.now();
  const now = () => performance.now() - t0;

  // ---------------------------------------------------------------- page elements
  // Bottom of systemui's page: SteamVR lays its own panels out from the top (its tallest, Now
  // Playing and Settings, end near y 1210 of 2048), so this band is free.
  const host = doc.createElement('div');
  host.id = 'lgs-asspod';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483000;display:none';
  const canvas = (w, h) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; };
  const faceCanvas = canvas(FACE_W, FACE_H);
  const backCanvas = canvas(BACK_W, BACK_H);
  const swatch = doc.createElement('div');
  const caption = doc.createElement('div');
  caption.innerHTML = MENU_GLYPH + '<span>to close</span>';
  host.append(faceCanvas, backCanvas, swatch, caption);
  (doc.body || doc.documentElement).appendChild(host);
  // SteamVR's own window chrome on this page (frame controls, grab bar, resize corner) fades with the
  // menu while the assPod is out: opacity only, so the panels keep their sizes
  const CHROME = '[class*="FrameControlsContainer"], [class*="GrabHandleButton"], [class*="ResizeHandleButton"]';
  const chromeStyle = doc.createElement('style');
  chromeStyle.id = 'lgs-asspod-chrome';
  chromeStyle.textContent = `html.lgs-asspod-out :is(${CHROME}) { opacity: 0 !important; transition: opacity 300ms ease !important; }
`
    + `html.lgs-asspod-fadein :is(${CHROME}) { transition: opacity 300ms ease !important; }`;
  (doc.head || doc.documentElement).appendChild(chromeStyle);
  let fadeInTimer = 0;
  const rects = {};
  function layout() {
    const iw = W.innerWidth;
    const ih = W.innerHeight;
    rects.face = { x: iw - FACE_W - MARGIN, y: ih - FACE_H - MARGIN, w: FACE_W, h: FACE_H };
    rects.back = { x: rects.face.x - BACK_W - 2 * MARGIN, y: ih - BACK_H - MARGIN, w: BACK_W, h: BACK_H };
    rects.text = { x: MARGIN, y: ih - CAPTION.h - MARGIN, w: CAPTION.w, h: CAPTION.h };
    rects.swatchBox = { x: MARGIN, y: rects.text.y - SWATCH.h - 2 * MARGIN, w: SWATCH.w, h: SWATCH.h };
    rects.dim = { x: rects.swatchBox.x + 8, y: rects.swatchBox.y + 6, w: SWATCH.w - 16, h: SWATCH.h - 12 };
    const at = (el, r) => { el.style.cssText = `position:fixed;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;margin:0;padding:0;border:0`; };
    at(faceCanvas, rects.face);
    at(backCanvas, rects.back);
    at(swatch, rects.swatchBox);
    swatch.style.background = 'rgba(0,0,0,0.01)';
    at(caption, rects.text);
    caption.style.cssText += ';display:flex;align-items:center;justify-content:center;gap:22px;box-sizing:border-box;'
      + 'font:600 56px "LGS Inter","Helvetica Neue",Helvetica,Arial,sans-serif;color:#fff;letter-spacing:-0.01em;'
      + 'text-shadow:0 2px 12px rgba(0,0,0,.55);background:rgba(28,28,30,.6);border-radius:60px;white-space:nowrap';
  }
  // our page rects must never overlap (one showed in another's panel)
  function overlaps() {
    const list = ['face', 'back', 'swatchBox', 'text'].map((k) => rects[k]);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return true;
    }
    return false;
  }
  layout();

  // ---------------------------------------------------------------- media and OS
  const outbox = [];
  const send = (cmd) => { outbox.push(cmd); if (outbox.length > OUTBOX_MAX) outbox.splice(0, outbox.length - OUTBOX_MAX); };
  const library = createLibrary(settings);
  const engine = createVlcEngine({ send });
  const player = createPlayer({ engine, settings });
  // Where each video was left (path -> s): the daemon's saved places at each open, kept up to date
  // here while one plays (device/shell_ext/asspod.py keeps the same, from VLC, and saves them).
  const resume = new Map();
  player.startAt = (it) => (it && it.kind === 'video' ? resume.get(it.path) || 0 : 0);
  function noteResume() {
    const it = player.current;
    if (!it || it.kind !== 'video' || player.state !== 'playing') return;
    const t = player.position;
    if (!Number.isFinite(t)) return;
    if (it.duration > 0 && t >= it.duration - RESUME_END_S) resume.delete(it.path);
    else if (t >= RESUME_MIN_S) resume.set(it.path, t);
  }
  let os = null;
  const art = createArt({ library, request: (key) => send({ op: 'art', key }), onChange: () => os && os.invalidate() });
  const screenCanvas = doc.createElement('canvas');
  screenCanvas.width = SCREEN_W * SCREEN_SCALE;
  screenCanvas.height = SCREEN_H * SCREEN_SCALE;
  os = createOS({ canvas: screenCanvas, player, library, art, apps, settings, boot: false });
  const wheel = createClickWheel();
  const reader = createControllerReader();
  const face = createFace(faceCanvas, screenCanvas, { overlay: true });
  const back = createBack(backCanvas, drawPeachSilhouette);
  const reflector = createReflector(BODY_M);
  const sg = createSceneGraph();
  library.onLoad(() => { art.clear(); os.ctx.popToRoot(); os.invalidate(); });
  // the EQ follows the setting (VLC's preset by name)
  settings.on('change', ({ key }) => { if (key === 'eq' || key === '*') send({ op: 'eq', name: settings.get('eq') }); });
  // the body's colour: podd follows the finish in the poll; the render-model body is rebuilt
  settings.on('change', ({ key }) => {
    if ((key === 'finish' || key === '*') && st.open && !st.podd) st.holdPose = sg.show(showOpts(st.hand, st.world)) || st.holdPose;
  });

  // ---------------------------------------------------------------- state
  const st = {
    open: false, hand: null, openedAt: 0, closedBy: null, frames: 0, lastFrame: 0, timer: 0, bgTimer: 0,
    loading: false, errors: [], lastStatusAt: 0, polls: 0,
    keys: {},                 // face buttons held: part ('select' | 'menu') -> { t, held, src }
    rightWas: {},             // the right controller's buttons last frame
    menuArmed: false,         // the hamburger must be released once after opening before it closes
    holds: { left: null, right: null },   // where the assPod sits in each hand when not the default (Reposition)
    world: null,              // Reposition: pinned in the room ({rot, centre}, standing space) while you move the hand
  };
  const HOLD_S = 0.5;
  const note = (e) => { st.errors.push(String(e && e.message || e).slice(0, 200)); if (st.errors.length > 8) st.errors.shift(); };

  function dashboardVisible() {
    try { return !!VRHTML.VRCompositor.IsDashboardVisibleInternal(); } catch (_) { return true; }
  }
  // The hand whose laser drives the menu: SteamVR's primary dashboard device and its role.
  function laserHand() {
    try {
      const idx = VRHTML.VROverlay.GetPrimaryDashboardDevice();
      if (idx >= 0) {
        const role = VRHTML.VRSystem.GetControllerRoleForTrackedDeviceIndex(idx);
        if (role === 1) return 'left';
        if (role === 2) return 'right';
      }
    } catch (_) { /* fall through */ }
    return 'right';
  }

  // ---------------------------------------------------------------- input -> OS
  function handle(e) {
    let changed = false;
    try { changed = os.handleWheelEvent(e); } catch (err) { note(err); }
    if (e.type === 'press') playClick('press');
    else if (e.type === 'scroll' && changed) playClick('tick');
  }

  // A and B as the wheel's centre and Menu buttons: press, hold (after HOLD_S) and release, like
  // the wheel's own buttons. src says who pressed it, so one source's release ends only its press.
  function keyDown(part, src) {
    if (st.keys[part]) return;
    st.keys[part] = { t: now(), held: false, src };
    handle({ type: 'press', part });
  }
  function keyUp(part, src, cancelled) {
    const k = st.keys[part];
    if (!k || (src && k.src !== src)) return;
    delete st.keys[part];
    handle(Object.assign({ type: 'release', part, held: k.held }, cancelled ? { cancelled: true } : {}));
  }
  function keysTick() {
    const t = now();
    for (const [part, k] of Object.entries(st.keys)) {
      if (!k.held && t - k.t >= HOLD_S * 1000) { k.held = true; handle({ type: 'hold', part }); }
    }
  }
  // The right controller's A, B and hamburger, from its model.
  function rightButtons() {
    if (!reader.rightButtons) return false;
    const b = reader.buttons;
    const was = st.rightWas;
    const edge = (k, down, up) => { if (b[k] && !was[k]) down(); else if (!b[k] && was[k]) up(); };
    edge('a', () => keyDown('select', 'right'), () => keyUp('select', 'right'));
    edge('b', () => keyDown('menu', 'right'), () => keyUp('menu', 'right'));
    if (!b.menu) st.menuArmed = true;
    const close_ = b.menu && !was.menu && st.menuArmed;
    st.rightWas = Object.assign({}, b);
    if (close_) { close('menu'); return true; }
    return false;
  }

  // ---------------------------------------------------------------- frame loop (while open)
  function frame() {
    st.timer = 0;
    if (!st.open) return;
    const t = now();
    const dt = st.lastFrame ? Math.min(0.1, (t - st.lastFrame) / 1000) : 0;
    st.lastFrame = t;
    st.frames++;
    try {
      if (!dashboardVisible()) { close('dashboard'); return; }
      reader.update();
      if (rightButtons()) return;
      keysTick();
      const evs = wheel.update(reader.wheel(), dt);
      for (let i = 0; i < evs.length; i++) handle(evs[i]);
      player.update(dt);
      videoMode();
      const screenDirty = os.render(t);
      // the painted reflections only without podd (podd shades the glass and the steel itself)
      if (!st.podd && st.frames % REFLECT_EVERY === 0 && reflector.update(st.hand, st.holdPose)) back.draw(reflector.back, reflector.version);
      const ws = wheel.state;
      face.draw({
        reflection: !st.podd && reflector.version ? reflector.front : null, reflVersion: reflector.version, screenOnly: !!st.podd, videoUnder: !!st.videoMode,
        finish: settings.get('finish'), backlight: os.backlight, screenDirty,
        touching: ws.touching, angle: ws.angle, pressed: ws.pressedPart || (st.keys.select ? 'select' : st.keys.menu ? 'menu' : null), now: t,
      });
    } catch (err) { note(err); }
    st.timer = setTimeout(frame, FRAME_MS);
  }

  // The player's clock while the assPod is away: next track, end of the queue.
  function background() {
    st.bgTimer = 0;
    if (st.open) return;
    const t = now();
    const dt = st.lastFrame ? Math.min(1, (t - st.lastFrame) / 1000) : 0;
    st.lastFrame = t;
    try { player.update(dt); } catch (err) { note(err); }
    if (player.state === 'playing') st.bgTimer = setTimeout(background, BACKGROUND_MS);
  }

  function showOpts(hand, world) {
    return { hand, body: BODY_M, rects, modelDir: st.modelDir, finish: settings.get('finish'), podd: st.podd,
      hold: st.holds[hand] || null, world: world || null, video: !!st.videoMode };
  }

  // A video on the screen with podd: podd shows its picture (the daemon's frames, full rate) in a panel
  // under the screen, and the video player draws only its overlays over a clear screen.
  function videoMode() {
    const on = !!(st.podd && st.podd.video && player.current && player.current.kind === 'video'
      && os.ctx.top()?.id === 'videoplayer');
    if (on === !!st.videoMode) return;
    st.videoMode = on;
    art.videoExternal = on;
    os.invalidate();
    st.holdPose = sg.show(showOpts(st.hand, st.world)) || st.holdPose;
  }

  // ---------------------------------------------------------------- Reposition
  // The assPod stays where it is in the room while you move the controller; Select keeps the new
  // place in that hand, Menu leaves it as it was, Play/Pause goes back to the default.
  function pin() {
    const hp = pose('/user/hand/' + st.hand);
    const h = st.holdPose;
    if (!hp || !h) return false;
    st.world = { rot: qmul(hp.q, h.rot), centre: hp.t.map((v, i) => v + qrot(hp.q, h.centre)[i]) };
    st.holdPose = sg.show(showOpts(st.hand, st.world)) || st.holdPose;
    return true;
  }
  function unpin(keep) {
    if (!st.world) return;
    if (keep) {
      const hp = pose('/user/hand/' + st.hand);
      if (hp) {
        const inv = qconj(hp.q);
        st.holds[st.hand] = {
          rot: qmul(inv, st.world.rot),
          centre: qrot(inv, st.world.centre.map((v, i) => v - hp.t[i])),
        };
      }
    }
    st.world = null;
    if (st.open) st.holdPose = sg.show(showOpts(st.hand)) || st.holdPose;
  }
  apps.reposition = (ctx) => {
    let lines = null;
    const done = (fn) => { fn(); ctx.pop(); return true; };
    return {
      id: 'reposition',
      title: 'Reposition',
      keepAwake: true,
      enter() { if (!pin()) note('reposition: no hand pose'); },
      exit() { if (st.world) unpin(false); },
      handle(e) {
        if (e.type === 'scroll') return false;
        if (e.type !== 'press') return e.type === 'release' ? false : undefined;
        if (e.part === 'select') return done(() => unpin(true));
        if (e.part === 'menu') return done(() => unpin(false));
        if (e.part === 'play') return done(() => { st.holds[st.hand] = null; unpin(false); });
        return false;
      },
      draw(g, r) {
        const { C, M, FONTS } = ctx.theme;
        g.fillStyle = C.bg;
        g.fillRect(r.x, r.y, r.w, r.h);
        g.font = FONTS.row;
        g.fillStyle = C.text;
        g.textAlign = 'left';
        g.textBaseline = 'alphabetic';
        if (!lines) {
          lines = [];
          for (const para of ['The assPod stays put. Move your controller to where you want it.',
            'Select: keep it there', 'Menu: cancel', 'Play/Pause: default place']) {
            let line = '';
            for (const w of para.split(' ')) {
              const t = line ? line + ' ' + w : w;
              if (line && g.measureText(t).width > M.W - 2 * M.padX) { lines.push(line); line = w; } else line = t;
            }
            lines.push(line, '');
          }
        }
        lines.forEach((l, i) => g.fillText(l, M.padX, r.y + 24 + i * 19));
      },
      highlight: () => null,
    };
  };

  // The menu's native glass (lgs_sg.js, in this page) fades with Steam's windows (34-asspod.css).
  function fadeMenu(v) {
    try { if (W.__LGS_SG && typeof W.__LGS_SG.fade === 'function') W.__LGS_SG.fade(v); } catch (e) { note(e); }
    const root = doc.documentElement;
    clearTimeout(fadeInTimer);
    root.classList.toggle('lgs-asspod-out', v < 1);
    root.classList.toggle('lgs-asspod-fadein', v >= 1);
    if (v >= 1) fadeInTimer = setTimeout(() => root.classList.remove('lgs-asspod-fadein'), 400);
  }

  // ---------------------------------------------------------------- open / close
  function open(o) {
    const opts = o || {};
    if (st.open) return status();
    const hand = opts.hand === 'left' || opts.hand === 'right' ? opts.hand : laserHand();
    layout();
    host.style.display = 'block';
    if (overlaps()) note('page rects overlap');
    st.podd = opts.podd || null;
    if (opts.modelDir) st.modelDir = opts.modelDir;
    if (opts.resume && typeof opts.resume === 'object') {
      resume.clear();
      for (const [p, t] of Object.entries(opts.resume)) if (Number.isFinite(t)) resume.set(p, t);
    }
    if (opts.holds && typeof opts.holds === 'object') st.holds = Object.assign({ left: null, right: null }, opts.holds);
    st.world = null;
    st.videoMode = false;
    art.videoExternal = false;
    const ok = sg.show(showOpts(hand));
    st.holdPose = ok;
    if (!ok) { host.style.display = 'none'; return Object.assign(status(), { ok: false, error: sg.status().error || 'scene graph' }); }
    fadeMenu(0);
    st.open = true;
    st.hand = hand;
    st.openedAt = Date.now();
    st.closedBy = null;
    st.keys = {};
    reader.update();
    st.rightWas = Object.assign({}, reader.buttons);   // a button still held from before must be released first
    st.menuArmed = !st.rightWas.menu;
    if (st.bgTimer) { clearTimeout(st.bgTimer); st.bgTimer = 0; }
    unlockClicker();
    wheel.reset();
    os.invalidate();
    st.lastFrame = 0;
    frame();
    return status();
  }

  function close(why) {
    if (!st.open) return status();
    st.open = false;
    st.closedBy = why || 'api';
    if (st.timer) { clearTimeout(st.timer); st.timer = 0; }
    for (const e of wheel.reset()) handle(e);
    for (const part of Object.keys(st.keys)) keyUp(part, null, true);
    sg.hide();
    st.videoMode = false;
    art.videoExternal = false;
    fadeMenu(1);
    host.style.display = 'none';
    st.lastFrame = now();
    if (player.state === 'playing') st.bgTimer = setTimeout(background, BACKGROUND_MS);
    return status();
  }

  // Steam's digital buttons, relayed by the plugin: 'ok' (A) is the centre button, 'menu' (B) the
  // wheel's Menu, 'close' (the hamburger) puts the assPod away. side: which controller. The right
  // controller's are read from its model when that works, so Steam's copy of them is ignored then.
  function btn(name, down, side) {
    if (!st.open) return false;
    if (side === 'right' && reader.rightButtons) return true;
    if (name === 'close') { if (down) close('menu'); return true; }
    const part = name === 'ok' ? 'select' : name === 'menu' ? 'menu' : null;
    if (!part) return false;
    if (down) keyDown(part, 'steam'); else keyUp(part, 'steam');
    return true;
  }

  function status() {
    return {
      ok: true, open: st.open, hand: st.hand, closedBy: st.closedBy, loading: st.loading,
      hold: st.holdPose || null, bodyScale: BODY_M.w / 0.0618, finish: settings.get('finish'), podd: !!st.podd,
      player: { state: player.state, current: player.current ? { id: player.current.id, title: player.current.title } : null,
        position: Math.round((player.position || 0) * 10) / 10, queue: player.queue.length, volume: player.volume },
      library: { tracks: library.tracks.length, albums: library.albums.length, videos: library.videos.length },
      frames: st.frames, sg: sg.status(), art: art.stats, clicker: clickerState(), os: os.getState(),
      input: reader.debug(), errors: st.errors.slice(), outbox: outbox.length, videoFrames: st.videoFrames || 0, resume: resume.size,
    };
  }

  // A message on the screen (the plugin's notices: VLC missing), until Select or Menu.
  function notice(title, text) {
    const { C, M, FONTS } = os.ctx.theme;
    let lines = null;
    os.ctx.push({
      id: 'notice',
      title: String(title || 'assPod'),
      handle(e) {
        if (e.type === 'press' && (e.part === 'select' || e.part === 'menu')) { os.ctx.pop(); return true; }
        return e.type === 'scroll' ? false : undefined;
      },
      draw(g, r) {
        g.fillStyle = C.bg;
        g.fillRect(r.x, r.y, r.w, r.h);
        g.font = FONTS.row;
        if (!lines) {
          lines = [];
          let line = '';
          for (const w of String(text || '').split(/\s+/)) {
            const t = line ? line + ' ' + w : w;
            if (line && g.measureText(t).width > M.W - 2 * M.padX) { lines.push(line); line = w; } else line = t;
          }
          if (line) lines.push(line);
        }
        g.fillStyle = C.text;
        g.textAlign = 'left';
        g.textBaseline = 'alphabetic';
        lines.forEach((l, i) => g.fillText(l, M.padX, r.y + 28 + i * 21));
      },
      highlight: () => null,
    });
  }

  // ---------------------------------------------------------------- the plugin's api
  const api = {
    open,
    close: () => close('api'),
    btn,
    /** The commands for VLC since the last poll, and the state the plugin acts on. */
    poll() {
      noteResume();
      st.polls++;
      return {
        cmds: outbox.splice(0),
        open: st.open, hand: st.hand, closedBy: st.closedBy,
        playing: player.state === 'playing', state: player.state,
        current: player.current ? player.current.path : null,
        volume: player.volume, eq: settings.get('eq'),
        hold: st.holdPose || null, world: st.world, holds: st.holds, finish: settings.get('finish'),
        position: Math.round((player.position || 0) * 1000) / 1000,
        video: player.current && player.current.kind === 'video' && os.ctx.top()?.id === 'videoplayer' && st.open,
      };
    },
    setStatus(s) { st.lastStatusAt = Date.now(); engine.status(s); },
    setLibrary(data) { library.load(data); return { tracks: library.tracks.length, videos: library.videos.length }; },
    receiveArt(key, b64) { art.receive(key, b64); },
    /** A frame of the playing video (JPEG, base64) from the daemon, for the video player screen. */
    async videoFrame(path, b64) {
      if (!b64 || player.current?.path !== path) return false;
      try {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
        const old = art.videoFrame;
        art.videoFrame = { path, image: bmp };
        if (old && old.image && old.image.close) old.image.close();
        st.videoFrames = (st.videoFrames || 0) + 1;
        return true;
      } catch (_) { return false; }
    },
    setLoading(on) { st.loading = !!on; os.setLoading(!!on); },
    notice,
    status,
    goto(path) { os.debug.goto(path); return os.getState(); },   // lab
    seekBy(d) { player.seek(player.position + (Number(d) || 0)); return player.position; },   // lab
    remove() {
      close('remove');
      if (st.bgTimer) { clearTimeout(st.bgTimer); st.bgTimer = 0; }
      sg.destroy();
      host.remove();
      chromeStyle.remove();
      doc.documentElement.classList.remove('lgs-asspod-out', 'lgs-asspod-fadein');
    },
  };
  return api;
}
