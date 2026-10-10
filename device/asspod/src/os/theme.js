// 5G visual spec, logical px on the 320x240 screen
import { SCREEN_W, SCREEN_H } from '../config.js';

// "LGS Inter" is the theme's own UI font, which LiquidAss adds to every SteamVR page (theme/01-font.nowrap.css).
export const FONT_FAMILY = '"LGS Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const font = (px, weight = 400) => `${weight} ${px}px ${FONT_FAMILY}`;

export const FONTS = {
  title: font(14, 700),     // status bar title
  row: font(15, 600),       // list labels
  detail: font(14, 400),    // right-aligned values in Settings rows
  npTitle: font(14, 700),
  npMeta: font(13, 400),
  small: font(12, 400),     // "1 of 12", captions
  time: font(11, 600),      // elapsed / remaining
  cfTitle: font(13, 700),
  cfArtist: font(12, 400),
  big: font(30, 600),       // stopwatch / clock digits
};

export const M = {
  W: SCREEN_W, H: SCREEN_H,
  statusH: 22,              // includes the 1px bottom border; content starts at y=22
  rowH: 24, rows: 9,        // list area y=22..238 (2px white margin at the bottom)
  padX: 8,                  // label left inset
  rowBaseline: 17,          // text baseline offset inside a 24px row
  chevronW: 6, chevronH: 10, chevronInset: 9,  // chevron right edge = rowRight - 9
  scrollbarW: 8,            // at x=312..320 when a list overflows; rows then end at 312
};

export const C = {
  bg: '#ffffff', text: '#000000', textHi: '#ffffff', textDim: '#6b6b6b',
  status: [[0, '#fdfdfd'], [0.5, '#e4e4e4'], [1, '#c3c3c3']],
  statusLine: '#7f7f7f', statusShadow: 'rgba(255,255,255,0.85)',
  hi: [[0, '#78b3f4'], [1, '#2d6cd2']], hiTop: '#a2ccf9', hiBottom: '#2457b4',
  sbBorder: '#9b9b9b', sbTrack: '#ffffff', sbThumb: [[0, '#9a9a9a'], [1, '#585858']],
  prBorder: '#6f6f6f', prTrack: [[0, '#ffffff'], [1, '#dcdcdc']], prGloss: 'rgba(255,255,255,0.35)',
  battery: [[0, '#a8ec7a'], [1, '#3a9e22']], batteryBorder: '#4a4a4a',
  play: [[0, '#7fbaf6'], [1, '#1f62c9']], playBorder: '#173f80',
  artBorder: '#c8c8c8',
  cfBg: '#000000', cfTitle: '#ffffff', cfArtist: '#9c9c9c',
  cfPanel: [[0, '#3a3a3a'], [1, '#161616']], cfPanelBorder: '#555555',
  overlay: 'rgba(0,0,0,0.55)',
  bootBg: '#ffffff', bootLogo: '#2c2c2e',   // the 5G boot: a dark logo alone on a white screen
};

export const ANIM = {
  slideMs: 220,            // push/pop slide, ease-out cubic
  maxFps: 40,              // cap for continuous screen animation (texture uploads)
  marqueeDelayMs: 1000, marqueeSpeed: 28, marqueeGap: 32,
  volumeOverlayMs: 2000, npModeTimeoutMs: 4000,
  backlightFadeMs: 300, backlightDim: 0.2,   // "backlight off" still shows a dim screen, as on the 5G
  bootMs: 2000,            // boot logo (os.boot()); the assPod shows it only while VLC starts (os.setLoading)
  wakeBootMs: 1200,        // boot on wake from sleep (unused: the OS is created with boot off)
};
