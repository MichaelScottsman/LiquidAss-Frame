// View-dependent reflections for the assPod's front glass and its polished steel back: what a
// glass or metal shader would do, painted into the two live panels SteamVR shows over the 3D model
// (SteamVR's render models take no shaders of ours).
//
// Each update samples a coarse grid over each face: the eye's ray to that point, mirrored about
// the face's normal, looks up a studio environment (a bright sky, a dark horizon band, a pale floor
// and one key light, fixed in the room). The front stores it as a white sheen whose strength
// follows Fresnel (faint face-on, strong at grazing angles); the back as the steel's colour. The
// grids are tiny canvases the faces scale up smoothly, so a frame costs a few hundred samples.

const COLS = 14;
const ROWS = 24;
const KEY = norm([-0.45, 0.8, -0.4]);       // the key light's direction (room frame, y up)

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function qrot(q, v) {   // q = [w, x, y, z]
  const u = [q[1], q[2], q[3]];
  const cr = (p, r) => [p[1] * r[2] - p[2] * r[1], p[2] * r[0] - p[0] * r[2], p[0] * r[1] - p[1] * r[0]];
  const t = cr(u, v).map((x) => 2 * x);
  const ut = cr(u, t);
  return [v[0] + q[0] * t[0] + ut[0], v[1] + q[0] * t[1] + ut[1], v[2] + q[0] * t[2] + ut[2]];
}
export const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];

// The studio: brightness 0..1.2 for a reflected direction r (unit, y up).
function env(r) {
  const y = r[1];
  let v;
  if (y > 0.3) v = 0.92 + 0.08 * Math.min(1, (y - 0.3) / 0.5);
  else if (y > 0.04) v = 0.42 + 0.5 * ((y - 0.04) / 0.26);
  else if (y > -0.1) v = 0.16 + 0.26 * ((y + 0.1) / 0.14);
  else v = 0.55 + 0.2 * Math.min(1, (-y - 0.1) / 0.6);
  const k = dot(r, KEY);
  v += 0.9 * Math.exp(-(1 - k) / 0.012);
  return v;
}

export const qconj = (q) => [q[0], -q[1], -q[2], -q[3]];

export function pose(path) {
  try {
    const [p] = VRHTML.GetPose(path, 1);     // TrackingUniverseStanding
    if (!p || !p.bPoseIsValid || !p.xfDeviceToAbsoluteTracking) return null;
    const x = p.xfDeviceToAbsoluteTracking;
    return { t: [x.translation.x, x.translation.y, x.translation.z], q: [x.rotation.w, x.rotation.x, x.rotation.y, x.rotation.z] };
  } catch (_) { return null; }
}

/**
 * @param {{ w: number, h: number, d: number }} body  metres
 */
export function createReflector(body) {
  const front = document.createElement('canvas');
  front.width = COLS;
  front.height = ROWS;
  const back = document.createElement('canvas');
  back.width = COLS;
  back.height = ROWS;
  const fg = front.getContext('2d');
  const bg = back.getContext('2d');
  const fimg = fg.createImageData(COLS, ROWS);
  const bimg = bg.createImageData(COLS, ROWS);
  let version = 0;
  let lastKey = '';

  /**
   * @param {string} hand 'left' | 'right'
   * @param {{ rot: number[], centre: number[] }} hold  the body in the controller's frame (sg.js)
   * @returns {boolean} whether the reflections changed
   */
  function update(hand, hold) {
    const hp = pose('/user/hand/' + hand);
    const head = pose('/user/head');
    if (!hp || !head || !hold) return false;
    const rot = qmul(hp.q, hold.rot);
    const c = hp.t.map((v, i) => v + qrot(hp.q, hold.centre)[i]);
    const ax = qrot(rot, [1, 0, 0]);
    const ay = qrot(rot, [0, 1, 0]);
    const n = qrot(rot, [0, 0, 1]);
    const eye = head.t;
    // skip when nothing moved enough to matter (0.5 mm, ~0.3 degrees)
    const key = [...c, ...n, ...ay, ...eye].map((v) => Math.round(v * 2000)).join(',');
    if (key === lastKey) return false;
    lastKey = key;
    for (const [img, side] of [[fimg, 1], [bimg, -1]]) {
      const nn = n.map((v) => v * side);
      for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
          // the back is seen from behind: its image's x runs the other way
          const u = (i + 0.5) / COLS - 0.5;
          const lx = (side > 0 ? u : -u) * body.w;
          const ly = (0.5 - (j + 0.5) / ROWS) * body.h;
          const p = [0, 1, 2].map((k) => c[k] + ax[k] * lx + ay[k] * ly + nn[k] * body.d / 2);
          const v = norm(p.map((x, k) => x - eye[k]));
          const vn = dot(v, nn);
          const r = norm(v.map((x, k) => x - 2 * vn * nn[k]));
          const e = env(r);
          const o = (j * COLS + i) * 4;
          if (side > 0) {
            // glass over a black plate: a white sheen, Fresnel-weighted
            const cos = Math.max(0, -vn);
            const fr = 0.05 + 0.55 * Math.pow(1 - cos, 4);
            const a = Math.min(1, fr * e * 1.4);
            img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255;
            img.data[o + 3] = Math.round(a * 255);
          } else {
            // polished steel: the environment itself, slightly cool, never quite black
            const l = Math.min(1, 0.12 + 0.86 * e);
            img.data[o] = Math.round(232 * l); img.data[o + 1] = Math.round(236 * l); img.data[o + 2] = Math.round(244 * l);
            img.data[o + 3] = 255;
          }
        }
      }
    }
    fg.putImageData(fimg, 0, 0);
    bg.putImageData(bimg, 0, 0);
    version++;
    return true;
  }

  return { update, front, back, get version() { return version; } };
}
