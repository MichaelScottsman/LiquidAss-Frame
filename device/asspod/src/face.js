// The assPod's front, drawn flat into one canvas that SteamVR shows in the hand: the body, the
// screen (the OS canvas, dimmed by the backlight), and the click wheel with its labels, the
// pressed part and the touch marker. Proportions are the 5th-generation body's, in millimetres.
//
// The static body is drawn once per finish into a layer; a frame blits it, then the screen and the
// wheel state. draw() returns false when nothing changed, so the page repaints only on change.

export const BODY = { w: 61.8, h: 103.5, corner: 6.5 };
const LCD = { cy: 24.2, w: 50.8, h: 38.1 };
const WINDOW = { w: 53.2, h: 40.5, r: 0.9 };
const WHEEL = { cy: -24.0, rOuter: 19.7, rCenter: 7.3, rMarker: 13.5, markerSize: 9.5 };
const SECTOR = { menu: 0, next: Math.PI / 2, play: Math.PI, prev: Math.PI * 1.5 };

const FINISHES = {
  black: { front: '#0b0b0c', frontHi: '#2a2a2d', wheel: '#1a1a1b', wheelHi: '#2b2b2d', label: '#9a9a9a',
    wheelEdge: '#060606', well: '#030303', center: '#141415', pressed: 'rgba(255,255,255,0.10)' },
  white: { front: '#f4f4f2', frontHi: '#ffffff', wheel: '#cdcecf', wheelHi: '#d9dadb', label: '#f2f2f2',
    wheelEdge: '#b4b5b6', well: '#8d8d89', center: '#f6f6f4', pressed: 'rgba(0,0,0,0.10)' },
};

const MARKER_IN = 0.06;      // s, the marker fading in on touch
const MARKER_OUT = 0.15;     // s, and out

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * @param {HTMLCanvasElement} canvas  the face, BODY.w : BODY.h
 * @param {HTMLCanvasElement} screen  the OS canvas (4:3)
 */
export function createFace(canvas, screen, opts = {}) {
  // overlay: only what changes (the screen in its black window, the pressed part, the touch marker)
  // and the gloss, over the 3D model's front; otherwise the whole flat face
  const overlay = !!opts.overlay;
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const k = W / BODY.w;                                  // px per mm
  const X = (mm) => W / 2 + mm * k;
  const Y = (mm) => H / 2 - mm * k;
  const layers = new Map();                              // finish -> static body
  let last = '';
  let marker = 0;                                        // 0..1 marker opacity
  let lastT = 0;

  const lcd = { x: X(-LCD.w / 2), y: Y(LCD.cy + LCD.h / 2), w: LCD.w * k, h: LCD.h * k };
  const wc = { x: X(0), y: Y(WHEEL.cy) };

  function bodyLayer(finish) {
    let c = layers.get(finish);
    if (c) return c;
    const f = FINISHES[finish] || FINISHES.black;
    c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const b = c.getContext('2d');
    // The front plate: it covers the whole face (the steel shows only on the edges and the back).
    roundRect(b, 0, 0, W, H, BODY.corner * k);
    b.fillStyle = f.front;
    b.fill();
    // The screen window.
    roundRect(b, X(-WINDOW.w / 2), Y(LCD.cy + WINDOW.h / 2), WINDOW.w * k, WINDOW.h * k, WINDOW.r * k);
    b.fillStyle = '#000';
    b.fill();
    // The wheel: its well, the ring, the labels and the centre button.
    b.beginPath();
    b.arc(wc.x, wc.y, (WHEEL.rOuter + 0.3) * k, 0, Math.PI * 2);
    b.fillStyle = f.well;
    b.fill();
    b.beginPath();
    b.arc(wc.x, wc.y, WHEEL.rOuter * k, 0, Math.PI * 2);
    const ring = b.createRadialGradient(wc.x, wc.y - WHEEL.rOuter * k * 0.6, WHEEL.rOuter * k * 0.1, wc.x, wc.y, WHEEL.rOuter * k);
    ring.addColorStop(0, f.wheelHi);
    ring.addColorStop(1, f.wheel);
    b.fillStyle = ring;
    b.fill();
    drawLabels(b, f.label);
    b.beginPath();
    b.arc(wc.x, wc.y, (WHEEL.rCenter + 0.25) * k, 0, Math.PI * 2);
    b.fillStyle = f.wheelEdge;
    b.fill();
    b.beginPath();
    b.arc(wc.x, wc.y, WHEEL.rCenter * k, 0, Math.PI * 2);
    b.fillStyle = f.center;
    b.fill();
    layers.set(finish, c);
    return c;
  }

  // The glossy finish: a clear-coat sheen over the whole face (a soft reflection from above and a
  // diagonal highlight band), drawn once per finish.
  const glosses = new Map();
  function glossLayer(finish) {
    let c = glosses.get(finish);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const q = c.getContext('2d');
    roundRect(q, 0, 0, W, H, BODY.corner * k);
    q.clip();
    const white = finish === 'white';
    const top = q.createLinearGradient(0, 0, 0, H * 0.55);
    top.addColorStop(0, `rgba(255,255,255,${white ? 0.55 : 0.22})`);
    top.addColorStop(0.35, `rgba(255,255,255,${white ? 0.18 : 0.07})`);
    top.addColorStop(1, 'rgba(255,255,255,0)');
    q.fillStyle = top;
    q.fillRect(0, 0, W, H * 0.55);
    // the diagonal highlight band, as a soft box reflected in the coat
    q.save();
    q.translate(W * 0.15, H * 0.42);
    q.rotate(-0.52);
    const band = q.createLinearGradient(0, -H * 0.09, 0, H * 0.09);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, `rgba(255,255,255,${white ? 0.30 : 0.13})`);
    band.addColorStop(1, 'rgba(255,255,255,0)');
    q.fillStyle = band;
    q.fillRect(-W, -H * 0.09, W * 3, H * 0.18);
    q.restore();
    glosses.set(finish, c);
    return c;
  }

  function drawLabels(b, color) {
    const r = (WHEEL.rOuter + WHEEL.rCenter) / 2 * k + 0.6 * k;
    const s = 1.35 * k;                                   // glyph half-size
    b.fillStyle = color;
    b.textAlign = 'center';
    b.textBaseline = 'middle';
    b.font = `700 ${Math.round(2.9 * k)}px "LGS Inter", "Helvetica Neue", Helvetica, Arial, sans-serif`;
    b.fillText('MENU', wc.x, wc.y - r);
    const tri = (x, y, dir) => {                          // dir 1 = pointing right
      b.beginPath();
      b.moveTo(x - dir * s * 0.8, y - s);
      b.lineTo(x + dir * s * 0.8, y);
      b.lineTo(x - dir * s * 0.8, y + s);
      b.closePath();
      b.fill();
    };
    // Next: two triangles and a bar.
    tri(wc.x + r - s * 1.1, wc.y, 1);
    tri(wc.x + r + s * 0.5, wc.y, 1);
    b.fillRect(wc.x + r + s * 1.3, wc.y - s, s * 0.35, s * 2);
    // Previous: mirrored.
    tri(wc.x - r + s * 1.1, wc.y, -1);
    tri(wc.x - r - s * 0.5, wc.y, -1);
    b.fillRect(wc.x - r - s * 1.65, wc.y - s, s * 0.35, s * 2);
    // Play/Pause: a triangle and two bars.
    const py = wc.y + r;
    tri(wc.x - s * 0.9, py, 1);
    b.fillRect(wc.x + s * 0.5, py - s, s * 0.38, s * 2);
    b.fillRect(wc.x + s * 1.15, py - s, s * 0.38, s * 2);
  }

  function drawPressed(part, f) {
    g.save();
    g.fillStyle = f.pressed;
    if (part === 'select') {
      g.beginPath();
      g.arc(wc.x, wc.y, WHEEL.rCenter * k, 0, Math.PI * 2);
      g.fill();
    } else if (part in SECTOR) {
      const a = SECTOR[part] - Math.PI / 2;               // canvas angle (0 = right, clockwise)
      g.beginPath();
      g.arc(wc.x, wc.y, WHEEL.rOuter * k, a - Math.PI / 4, a + Math.PI / 4);
      g.arc(wc.x, wc.y, (WHEEL.rCenter + 0.3) * k, a + Math.PI / 4, a - Math.PI / 4, true);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function drawMarker(angle, alpha) {
    const a = angle - Math.PI / 2;
    const x = wc.x + Math.cos(a) * WHEEL.rMarker * k;
    const y = wc.y + Math.sin(a) * WHEEL.rMarker * k;
    const r = WHEEL.markerSize / 2 * k;
    const glow = g.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, `rgba(160,200,255,${0.55 * alpha})`);
    glow.addColorStop(0.6, `rgba(120,170,255,${0.22 * alpha})`);
    glow.addColorStop(1, 'rgba(120,170,255,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  /**
   * @param {{ finish: string, backlight: number, screenDirty: boolean, touching: boolean, angle: number,
   *   pressed: string|null, now: number }} s
   * @returns {boolean} whether it drew
   */
  function draw(s) {
    const dt = lastT ? Math.max(0, (s.now - lastT) / 1000) : 0;
    lastT = s.now;
    const target = s.touching ? 1 : 0;
    if (marker !== target) {
      marker = target > marker ? Math.min(1, marker + dt / MARKER_IN) : Math.max(0, marker - dt / MARKER_OUT);
    }
    const key = [s.finish, Math.round(s.backlight * 100), s.pressed || '', marker > 0 ? Math.round(s.angle * 200) : -1,
      Math.round(marker * 20), s.reflVersion || 0, s.screenOnly ? 1 : 0, s.videoUnder ? 1 : 0].join('|');
    if (!s.screenDirty && key === last) return false;
    last = key;
    const f = FINISHES[s.finish] || FINISHES.black;
    g.clearRect(0, 0, W, H);
    if (overlay) {
      roundRect(g, X(-WINDOW.w / 2), Y(LCD.cy + WINDOW.h / 2), WINDOW.w * k, WINDOW.h * k, WINDOW.r * k);
      g.fillStyle = '#000';
      g.fill();
      // podd's video panel lies under the LCD: the LCD is left clear for it
      if (s.videoUnder) g.clearRect(lcd.x, lcd.y, lcd.w, lcd.h);
    } else {
      g.drawImage(bodyLayer(s.finish), 0, 0);
    }
    // The LCD, then the backlight as a black veil (off still shows a dim screen).
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(screen, lcd.x, lcd.y, lcd.w, lcd.h);
    const veil = 1 - Math.max(0, Math.min(1, s.backlight));
    if (veil > 0.001) {
      g.fillStyle = `rgba(0,0,0,${veil})`;
      g.fillRect(lcd.x, lcd.y, lcd.w, lcd.h);
    }
    // A faint reflection across the glass.
    const refl = g.createLinearGradient(lcd.x, lcd.y, lcd.x + lcd.w, lcd.y + lcd.h);
    refl.addColorStop(0, 'rgba(255,255,255,0.07)');
    refl.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = refl;
    g.fillRect(lcd.x, lcd.y, lcd.w, lcd.h);
    if (s.screenOnly) return true;   // podd draws the wheel, the marker and the glass
    if (s.pressed) drawPressed(s.pressed, f);
    if (marker > 0) drawMarker(s.angle, marker);
    if (s.reflection) {
      // the live reflection (reflect.js), scaled up smoothly over the face
      g.save();
      roundRect(g, 0, 0, W, H, BODY.corner * k);
      g.clip();
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(s.reflection, 0, 0, W, H);
      g.restore();
    } else {
      g.drawImage(glossLayer(s.finish), 0, 0);
    }
    return true;
  }

  return { draw, get animating() { return marker > 0 && marker < 1; } };
}

/** The mirror-polished steel back with the peach engraved in it (static: drawn once). Polished
 *  steel shows its surroundings: a bright sky above a dark horizon band, a pale floor below,
 *  soft streaks of light, and one strong highlight. */
export function drawBack(canvas, drawPeach) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const k = W / BODY.w;
  g.clearRect(0, 0, W, H);
  roundRect(g, 0, 0, W, H, BODY.corner * k);
  g.save();
  g.clip();
  const env = g.createLinearGradient(0, 0, W * 0.25, H);
  env.addColorStop(0, '#fbfcfe');
  env.addColorStop(0.18, '#dfe5ec');
  env.addColorStop(0.36, '#a9b1bb');
  env.addColorStop(0.44, '#3a3e45');
  env.addColorStop(0.5, '#575c64');
  env.addColorStop(0.58, '#c7ccd2');
  env.addColorStop(0.8, '#eef0f2');
  env.addColorStop(1, '#9aa0a8');
  g.fillStyle = env;
  g.fillRect(0, 0, W, H);
  // soft vertical streaks: the curve of the steel catching light
  for (const [x, a, w] of [[0.12, 0.28, 0.06], [0.3, 0.12, 0.1], [0.78, 0.22, 0.05], [0.9, 0.35, 0.04]]) {
    const st = g.createLinearGradient(W * (x - w), 0, W * (x + w), 0);
    st.addColorStop(0, 'rgba(255,255,255,0)');
    st.addColorStop(0.5, `rgba(255,255,255,${a})`);
    st.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = st;
    g.fillRect(0, 0, W, H);
  }
  // the highlight
  const hi = g.createRadialGradient(W * 0.3, H * 0.16, 0, W * 0.3, H * 0.16, W * 0.55);
  hi.addColorStop(0, 'rgba(255,255,255,0.85)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi;
  g.fillRect(0, 0, W, H);
  // the rounded edge darkens as it turns away
  const rim = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.62);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(20,24,30,0.35)');
  g.fillStyle = rim;
  g.fillRect(0, 0, W, H);
  g.restore();
  // the engraving, 30 mm below the top edge: a frosted mark in the mirror
  if (drawPeach) drawPeach(g, W / 2, 30 * k, 18.5 * k, 'rgba(60,64,72,0.5)');
  g.fillStyle = 'rgba(60,64,72,0.5)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `600 ${Math.round(5 * k)}px "LGS Inter", "Helvetica Neue", Helvetica, Arial, sans-serif`;
  g.fillText('assPod', W / 2, 52 * k);
}

/** The live steel back: the reflection (reflect.js) scaled over the back, the engraving etched in
 *  it as satin (it takes the reflection, darker and softer), the edge turning away darker. */
export function createBack(canvas, drawPeach) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const k = W / BODY.w;
  let last = -1;
  // the engraving as a mask, drawn once
  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  if (drawPeach) drawPeach(mask.getContext('2d'), W / 2, 30 * k, 18.5 * k, '#000');
  const mg = mask.getContext('2d');
  mg.fillStyle = '#000';
  mg.textAlign = 'center';
  mg.textBaseline = 'middle';
  mg.font = `600 ${Math.round(5 * k)}px "LGS Inter", "Helvetica Neue", Helvetica, Arial, sans-serif`;
  mg.fillText('assPod', W / 2, 52 * k);
  const etch = document.createElement('canvas');
  etch.width = W;
  etch.height = H;
  const eg = etch.getContext('2d');
  return {
    draw(reflection, version) {
      if (!reflection || version === last) return false;
      last = version;
      g.clearRect(0, 0, W, H);
      g.save();
      roundRect(g, 0, 0, W, H, BODY.corner * k);
      g.clip();
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(reflection, 0, 0, W, H);
      // the etch: the reflection, blurred and dimmed, through the logo mask
      eg.clearRect(0, 0, W, H);
      eg.globalCompositeOperation = 'source-over';
      eg.filter = 'blur(3px) brightness(0.72)';
      eg.drawImage(canvas, 0, 0);
      eg.filter = 'none';
      eg.globalCompositeOperation = 'destination-in';
      eg.drawImage(mask, 0, 0);
      eg.globalCompositeOperation = 'source-over';
      g.drawImage(etch, 0, 0);
      const rim = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.62);
      rim.addColorStop(0, 'rgba(0,0,0,0)');
      rim.addColorStop(1, 'rgba(20,24,30,0.3)');
      g.fillStyle = rim;
      g.fillRect(0, 0, W, H);
      g.restore();
      return true;
    },
  };
}

/** The edge: along the strip, the same all the way; across it (the depth), the white front
 *  plate's rim at the top, then the polished steel of the back. */
export function drawEdge(canvas, finish) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  // across the depth: the front plate's thin lip, then the steel rounding back (mirror bands)
  const gr = g.createLinearGradient(0, 0, 0, H);
  const plate = finish === 'white' ? '#ecece9' : '#141416';
  gr.addColorStop(0, plate);
  gr.addColorStop(0.12, plate);
  gr.addColorStop(0.15, '#ffffff');
  gr.addColorStop(0.3, '#c9d0d8');
  gr.addColorStop(0.48, '#4a4f57');
  gr.addColorStop(0.6, '#e9edf1');
  gr.addColorStop(0.82, '#9aa1aa');
  gr.addColorStop(1, '#5f656e');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}
