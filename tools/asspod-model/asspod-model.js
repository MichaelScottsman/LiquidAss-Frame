// Procedural assPod Video (5th generation): glossy front plate, mirror-chrome back that wraps the
// sides with the peach logo etched into it, LCD behind glass, click wheel with vector labels, touch
// marker and press animations. Everything is built from code and canvases; there are no asset files.
//
// Local frame (design spec 3.1): meters, origin at the body center, +X right, +Y toward the
// headphone jack, +Z out of the screen. Wheel angle: 0 = top (MENU), clockwise seen from the front.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { drawPeachSilhouette } from '../../device/asspod/src/brand/peach.js';

// ---------------------------------------------------------------- geometry

export const GEOMETRY = Object.freeze({
  BODY: Object.freeze({ w: 0.0618, h: 0.1035, d: 0.0110, corner: 0.0065 }),
  LCD: Object.freeze({ cx: 0, cy: 0.0242, w: 0.0508, h: 0.0381 }),
  WINDOW: Object.freeze({ w: 0.0532, h: 0.0405 }),
  WHEEL: Object.freeze({ cy: -0.0240, rOuter: 0.0197, rCenter: 0.0073, rMarker: 0.0135, markerSize: 0.0095 }),
});

const { BODY, LCD, WINDOW, WHEEL } = GEOMETRY;
const MM = 0.001;
const FRONT_Z = BODY.d / 2;              // front surface of the plate
const BACK_Z = -BODY.d / 2;
const SEAM_Z = FRONT_Z - 2 * MM;         // where the 2 mm front plate meets the steel
const WELL_R = WHEEL.rOuter + 0.02 * MM; // hole in the plate around the wheel: flush (a visible gap ring aliased into a dotted seam in VR)
const WELL_FLOOR_Z = FRONT_Z - 1.5 * MM;
const WHEEL_T = 1.0 * MM;                // wheel and center button thickness, so their sides show when they rock or sink
const ROCK_ANGLE = -2.5 * Math.PI / 180;
const SINK = 0.5 * MM;
const MARKER_PEAK = 0.9;
const MARKER_IN_S = 0.06;
const MARKER_OUT_S = 0.15;
const MARKER_PRESS_SCALE = 0.85;
const SECTOR_ANGLE = { menu: 0, next: Math.PI / 2, play: Math.PI, prev: Math.PI * 1.5 };
// Back engraving: the 100-unit design box at 18.5 mm (art ~18 x 16 mm), centred 30 mm below the
// top edge like the logo on the real back, well inside the flat area (which ends 2.4 mm in).
const ENGRAVE_SIZE = 18.5 * MM;
const ENGRAVE_Y = BODY.h / 2 - 30 * MM;
const ENGRAVE_PX = 512;

const FINISHES = {
  black: { front: '#0b0b0c', frontRough: 0.12, wheel: '#1a1a1b', label: '#9a9a9a', wheelEdge: '#060606', well: '#030303', shadow: false },
  // The gaps around the white wheel read as a soft grey line, not a black outline.
  white: { front: '#f4f4f2', frontRough: 0.18, wheel: '#cdcecf', label: '#f2f2f2', wheelEdge: '#b4b5b6', well: '#8d8d89', shadow: true },
};

// Rounded-rectangle outline sampled corner by corner. Each point keeps its corner center and the
// outward direction, so a profile can be swept along it with exact offsets and smooth normals.
function roundedOutline(hw, hh, radius, segs) {
  const pts = [];
  const corners = [[hw - radius, hh - radius, 0], [-(hw - radius), hh - radius, 0.5], [-(hw - radius), -(hh - radius), 1], [hw - radius, -(hh - radius), 1.5]];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= segs; i++) {
      const a = (start + 0.5 * i / segs) * Math.PI;
      pts.push({ cx, cy, nx: Math.cos(a), ny: Math.sin(a) });
    }
  }
  return pts;
}

// Sweeps a profile [{ o: outward offset from the outline, z, n: [outward, z] normal }] around the
// outline (counter-clockwise seen from +Z) into an indexed strip mesh.
function sweepGeometry(outline, radius, profile) {
  const pos = [];
  const nor = [];
  const idx = [];
  const ring = outline.length;
  for (const p of profile) {
    const len = Math.hypot(p.n[0], p.n[1]);
    for (const q of outline) {
      const r = radius + p.o;
      pos.push(q.cx + q.nx * r, q.cy + q.ny * r, p.z);
      nor.push(q.nx * p.n[0] / len, q.ny * p.n[0] / len, p.n[1] / len);
    }
  }
  for (let j = 0; j < profile.length - 1; j++) {
    for (let i = 0; i < ring; i++) {
      const a = j * ring + i;
      const b = j * ring + (i + 1) % ring;
      const c = (j + 1) * ring + i;
      const d = (j + 1) * ring + (i + 1) % ring;
      // Profiles run from the front toward the back, so this winding faces outward.
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// Flat cap closing an outline at a given inset. A fan is enough because the outline is convex.
function capGeometry(outline, radius, inset, z, facing) {
  const pos = [0, 0, z];
  const nor = [0, 0, facing];
  const idx = [];
  for (const q of outline) {
    const r = radius - inset;
    pos.push(q.cx + q.nx * r, q.cy + q.ny * r, z);
    nor.push(0, 0, facing);
  }
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = 1 + i;
    const b = 1 + (i + 1) % n;
    if (facing > 0) idx.push(0, a, b); else idx.push(0, b, a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// True circular corners, so flat faces meet the swept bevels without slivers at the corners.
function roundedRectShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const x1 = cx + w / 2;
  const y1 = cy + h / 2;
  const q = Math.PI / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -q, 0, false);
  s.lineTo(x1, y1 - r);
  s.absarc(x1 - r, y1 - r, r, 0, q, false);
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, q, 2 * q, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, 2 * q, 3 * q, false);
  return s;
}

// Keeps merged parts compatible: mergeGeometries needs identical attribute sets.
function onlyPositionNormal(g) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  return out;
}

function paint(g, hex) {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function buildBody() {
  const hw = BODY.w / 2;
  const hh = BODY.h / 2;
  const rc = BODY.corner;
  const outline = roundedOutline(hw, hh, rc, 16);

  // Chrome shell: straight side wall from the seam, then an elliptical roll onto the flat back.
  // A tiny chamfer at the seam makes the plate/steel joint catch a dark line, as on the real one.
  const rollXY = 2.4 * MM;
  const rollZ = 3.4 * MM;
  const chromeProfile = [
    { o: -0.2 * MM, z: SEAM_Z, n: [0.4, 1] },
    { o: 0, z: SEAM_Z - 0.25 * MM, n: [1, 0.15] },
  ];
  const SEG = 10;
  for (let i = 0; i <= SEG; i++) {
    const phi = (i / SEG) * Math.PI / 2;
    chromeProfile.push({
      o: -rollXY * (1 - Math.cos(phi)),
      z: BACK_Z + rollZ * (1 - Math.sin(phi)),
      n: [Math.cos(phi) / rollXY, -Math.sin(phi) / rollZ],
    });
  }
  const chrome = mergeGeometries([
    sweepGeometry(outline, rc, chromeProfile),
    capGeometry(outline, rc, rollXY, BACK_Z, -1),
  ].map(onlyPositionNormal));

  // Front plate: 2 mm of glossy plastic with a 0.6 mm rounded front edge. The front face is a
  // shape with a hole where the click wheel sits, so the wheel can rock into the well.
  const bev = 0.6 * MM;
  const plateProfile = [];
  for (let i = 0; i <= 6; i++) {
    const phi = (i / 6) * Math.PI / 2;
    plateProfile.push({ o: -bev * (1 - Math.sin(phi)), z: FRONT_Z - bev * (1 - Math.cos(phi)), n: [Math.sin(phi), Math.cos(phi)] });
  }
  plateProfile.push({ o: 0, z: SEAM_Z + 0.2 * MM, n: [1, 0] });
  plateProfile.push({ o: -0.2 * MM, z: SEAM_Z, n: [0.4, -1] });
  const faceShape = roundedRectShape(BODY.w - 2 * bev, BODY.h - 2 * bev, rc - bev);
  const hole = new THREE.Path();
  hole.absarc(0, WHEEL.cy, WELL_R, 0, Math.PI * 2, true);
  faceShape.holes.push(hole);
  // and an opening for the screen window: in SteamVR the live screen is a panel in it, and a plate
  // surface just under that panel fought it for depth (the LCD mesh here covers it either way)
  const win = new THREE.Path();
  {
    const hw = WINDOW.w / 2, hh = WINDOW.h / 2, r = 0.9 * MM, cy = LCD.cy;
    win.moveTo(-hw + r, cy - hh);
    win.absarc(-hw + r, cy - hh + r, r, -Math.PI / 2, -Math.PI, true);
    win.lineTo(-hw, cy + hh - r);
    win.absarc(-hw + r, cy + hh - r, r, Math.PI, Math.PI / 2, true);
    win.lineTo(hw - r, cy + hh);
    win.absarc(hw - r, cy + hh - r, r, Math.PI / 2, 0, true);
    win.lineTo(hw, cy - hh + r);
    win.absarc(hw - r, cy - hh + r, r, 0, -Math.PI / 2, true);
  }
  faceShape.holes.push(win);
  const face = new THREE.ShapeGeometry(faceShape, 48);   // arcs get 2x this many segments; the wheel hole needs them
  face.translate(0, 0, FRONT_Z);
  const plate = mergeGeometries([sweepGeometry(outline, rc, plateProfile), face].map(onlyPositionNormal));

  // The well behind the wheel: a dark wall and floor, so a rocking wheel never shows the hollow body.
  const wall = new THREE.CylinderGeometry(WELL_R, WELL_R, FRONT_Z - WELL_FLOOR_Z, 64, 1, true);
  wall.rotateX(Math.PI / 2);
  wall.translate(0, WHEEL.cy, (FRONT_Z + WELL_FLOOR_Z) / 2);
  const floor = new THREE.CircleGeometry(WELL_R, 64);
  floor.translate(0, WHEEL.cy, WELL_FLOOR_Z);
  const well = mergeGeometries([wall, floor].map(onlyPositionNormal));

  return { chrome, plate, well };
}

// Hold switch, headphone jack and dock connector, merged into one vertex-colored mesh.
function buildPorts() {
  const parts = [];
  const top = BODY.h / 2;
  const wallZ = (SEAM_Z + BACK_Z + 3.4 * MM) / 2;  // middle of the straight part of the side wall
  const decal = (w, h, r, color, x, y, z, rotX) => {
    const g = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 6);
    g.rotateX(rotX);
    g.translate(x, y, z);
    return paint(onlyPositionNormal(g), color);
  };
  // Hold switch (top, left): slot plus a slider parked toward the jack side = unlocked.
  parts.push(decal(8.6 * MM, 2.7 * MM, 1.2 * MM, '#050505', -0.0185, top + 0.03 * MM, wallZ, -Math.PI / 2));
  const knob = new THREE.BoxGeometry(4.2 * MM, 0.5 * MM, 1.9 * MM);
  knob.translate(-0.0165, top + 0.15 * MM, wallZ);
  parts.push(paint(onlyPositionNormal(knob), '#1d1d1f'));
  // Headphone jack (top, right): metal ring with a black hole.
  const ring = new THREE.CircleGeometry(2.7 * MM, 32);
  ring.rotateX(-Math.PI / 2);
  ring.translate(0.0195, top + 0.03 * MM, wallZ);
  parts.push(paint(onlyPositionNormal(ring), '#3a3b3e'));
  const holeG = new THREE.CircleGeometry(1.75 * MM, 32);
  holeG.rotateX(-Math.PI / 2);
  holeG.translate(0.0195, top + 0.06 * MM, wallZ);
  parts.push(paint(onlyPositionNormal(holeG), '#000000'));
  // Dock connector (bottom, centered).
  parts.push(decal(21 * MM, 2.6 * MM, 1.0 * MM, '#050505', 0, -top - 0.03 * MM, wallZ, Math.PI / 2));
  parts.push(decal(18.5 * MM, 1.0 * MM, 0.4 * MM, '#26272a', 0, -top - 0.06 * MM, wallZ, Math.PI / 2));
  return mergeGeometries(parts);
}

// ---------------------------------------------------------------- canvases

const LABEL_PX = 512;

// The wheel face: base color, gap rings and the four labels drawn as vector shapes, so they stay
// crisp at any mip level and never depend on a font having the transport glyphs.
function drawWheelLabels(canvas, finish) {
  const f = FINISHES[finish];
  const g = canvas.getContext('2d');
  const S = LABEL_PX;
  const c = S / 2;
  const pxPerM = S / (2 * WHEEL.rOuter);
  const mm = pxPerM * MM;
  g.clearRect(0, 0, S, S);
  g.fillStyle = f.wheelEdge;
  g.fillRect(0, 0, S, S);
  g.beginPath();
  g.arc(c, c, c, 0, Math.PI * 2);   // the wheel colour to its very edge: no dark rim to alias
  g.fillStyle = f.wheel;
  g.fill();
  // A whisper of shading toward the rim, as the real wheel catches less light at its beveled edge.
  const shade = g.createRadialGradient(c, c, c * 0.6, c, c, c);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, finish === 'white' ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.08)');   // light: a dark rim read as a seam
  g.fillStyle = shade;
  g.fill();
  // Inner gap ring around the center button.
  g.beginPath();
  g.arc(c, c, (WHEEL.rCenter + 0.25 * MM) * pxPerM, 0, Math.PI * 2);
  g.lineWidth = 0.35 * mm;
  g.strokeStyle = f.wheelEdge;
  g.stroke();

  g.fillStyle = f.label;
  const labelR = 14.6 * mm;
  // MENU: bold, widely tracked caps.
  g.save();
  g.font = `700 ${Math.round(3.2 * mm)}px "Source Sans 3", "Myriad Pro", "Helvetica Neue", Arial, sans-serif`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const letters = 'MENU';
  const track = 0.32 * mm;
  let total = -track;
  for (const ch of letters) total += g.measureText(ch).width + track;
  let x = c - total / 2;
  for (const ch of letters) { g.fillText(ch, x, c - labelR); x += g.measureText(ch).width + track; }
  g.restore();

  const triH = 2.5 * mm;
  const triW = 2.05 * mm;
  const barW = 0.55 * mm;
  const tri = (x0, cy, dir) => {   // dir 1 = pointing right
    g.beginPath();
    g.moveTo(x0, cy - triH / 2);
    g.lineTo(x0 + dir * triW, cy);
    g.lineTo(x0, cy + triH / 2);
    g.closePath();
    g.fill();
  };
  // Next: two triangles then a bar, centered on the right label position.
  {
    const w = triW * 2 + barW;
    const x0 = c + labelR - w / 2;
    tri(x0, c, 1);
    tri(x0 + triW, c, 1);
    g.fillRect(x0 + triW * 2 - 0.05 * mm, c - triH / 2, barW, triH);
  }
  // Previous: mirror image on the left.
  {
    const w = triW * 2 + barW;
    const x1 = c - labelR + w / 2;
    tri(x1, c, -1);
    tri(x1 - triW, c, -1);
    g.fillRect(x1 - triW * 2 - barW + 0.05 * mm, c - triH / 2, barW, triH);
  }
  // Play/Pause at the bottom: a triangle followed by two bars.
  {
    const gap = 0.55 * mm;
    const pw = 0.5 * mm;
    const w = triW + gap + pw * 2 + 0.45 * mm;
    const x0 = c - w / 2;
    const cy = c + labelR;
    tri(x0, cy, 1);
    g.fillRect(x0 + triW + gap, cy - triH / 2, pw, triH);
    g.fillRect(x0 + triW + gap + pw + 0.45 * mm, cy - triH / 2, pw, triH);
  }
}

// Soft glow for the touch marker: a bright core that rolls off into a halo. It is drawn additively,
// so only the shape of the alpha matters.
function markerCanvas() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.28, 'rgba(255,255,255,0.80)');
  grad.addColorStop(0.42, 'rgba(255,255,255,0.42)');
  grad.addColorStop(0.62, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return cv;
}

// Alpha mask for the back engraving: white peach on black (alphaMap reads the green channel).
function engravingCanvas() {
  const S = ENGRAVE_PX;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, S, S);
  drawPeachSilhouette(g, S / 2, S / 2, S, '#ffffff');
  return cv;
}

function shadowCanvas() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.75)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return cv;
}

// ---------------------------------------------------------------- springs

// Exact critically damped step, stable at any dt (frame hitches must not make the wheel explode).
function springStep(s, target, w, dt) {
  const d = s.x - target;
  const c = s.v + w * d;
  const e = Math.exp(-w * dt);
  s.x = target + (d + c * dt) * e;
  s.v = (s.v - c * w * dt) * e;
}

// ---------------------------------------------------------------- model

/**
 * @param {{ screenCanvas: HTMLCanvasElement, envMap: THREE.Texture, finish?: 'black'|'white', anisotropy?: number }} o
 */
export function createAssPodModel({ screenCanvas, envMap, finish = 'black', anisotropy = 1 }) {
  const root = new THREE.Group();
  root.name = 'asspod';

  const body = buildBody();

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe9eaec, metalness: 1, roughness: 0.08, envMap, envMapIntensity: 1.2,
  });
  const frontMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0b0c, metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMap, envMapIntensity: 0.7,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.7, side: THREE.DoubleSide });

  const chrome = new THREE.Mesh(body.chrome, chromeMat);
  const plate = new THREE.Mesh(body.plate, frontMat);
  const well = new THREE.Mesh(body.well, darkMat);
  const ports = new THREE.Mesh(buildPorts(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3, envMap }));
  root.add(chrome, plate, well, ports);

  // ---- back engraving: a satin etch in the mirror chrome
  // The same steel at a higher roughness. With the PMREM env map that blurs the nebula and studio
  // panels, so the logo reads lighter over dark reflections and darker over bright ones, like the
  // real etched back. 0.35 (tuned on screenshots against 0.4 and 0.45) keeps a soft sheen across
  // the lobes, so it reads as satin metal rather than grey print. Identical for both finishes
  // (the back is always chrome).
  const engraveTex = new THREE.CanvasTexture(engravingCanvas());
  engraveTex.anisotropy = anisotropy;   // linear data (no colour space); mipmaps keep it from shimmering
  const engravingMat = new THREE.MeshStandardMaterial({
    color: 0xd2d5d9, metalness: 1, roughness: 0.35, envMap, envMapIntensity: 1.2,
    alphaMap: engraveTex, transparent: true, depthWrite: false,
  });
  const engravingGeo = new THREE.PlaneGeometry(ENGRAVE_SIZE, ENGRAVE_SIZE);
  // Facing -Z, u = 1 lands at -X: the viewer's right seen from behind, so the logo reads unmirrored.
  engravingGeo.rotateY(Math.PI);
  const engraving = new THREE.Mesh(engravingGeo, engravingMat);
  engraving.position.set(0, ENGRAVE_Y, BACK_Z - 0.05 * MM);   // like the decals: clear of depth precision
  engraving.renderOrder = 1;
  engraving.name = 'engraving';
  root.add(engraving);

  // ---- screen: window border, LCD, glass
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = anisotropy;
  // Mipmapped trilinear (the defaults) keeps 640x480 from shimmering at arm's length.
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, vertexColors: true });
  // The black window border shares the LCD's mesh and draw call: its vertices are coloured black,
  // which zeroes the screen texture there (still unlit pure black). That saved call pays for the
  // back engraving, keeping XR within the 60-call budget with both controllers drawn.
  const lcdGeo = paint(new THREE.PlaneGeometry(LCD.w, LCD.h), '#ffffff');
  const windowGeo = paint(new THREE.ShapeGeometry(roundedRectShape(WINDOW.w, WINDOW.h, 0.9 * MM), 4), '#000000');
  windowGeo.translate(0, 0, -0.04 * MM);   // 0.04 mm under the LCD, as when it was its own mesh
  { const uv = windowGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.5); }
  // LCD first, so early depth rejects the border hidden under it.
  const lcd = new THREE.Mesh(mergeGeometries([lcdGeo, windowGeo]), screenMat);
  lcd.position.set(LCD.cx, LCD.cy, FRONT_Z + 0.08 * MM);
  lcd.name = 'lcd';

  // Glass: black dielectric drawn additively, so it contributes only its reflection and never
  // dims the LCD under it.
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x000000, metalness: 0, roughness: 0.05, envMap, envMapIntensity: 1.0,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(WINDOW.w + 1 * MM, WINDOW.h + 1 * MM, 1.2 * MM), 4), glassMat);
  glass.position.set(LCD.cx, LCD.cy, FRONT_Z + 0.14 * MM);
  glass.renderOrder = 2;
  root.add(lcd, glass);

  // ---- click wheel (rocks as one group; the marker rides on it)
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0, WHEEL.cy, FRONT_Z);
  root.add(wheelGroup);

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = labelCanvas.height = LABEL_PX;
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = anisotropy;
  const wheelMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.55, metalness: 0, envMap, envMapIntensity: 0.6 });
  const innerR = WHEEL.rCenter + 0.3 * MM;
  const wheelTop = new THREE.RingGeometry(innerR, WHEEL.rOuter, 128, 1);
  const wheelSide = new THREE.CylinderGeometry(WHEEL.rOuter, WHEEL.rOuter, WHEEL_T, 128, 1, true);
  wheelSide.rotateX(Math.PI / 2);
  wheelSide.translate(0, 0, -WHEEL_T / 2);
  // The side walls sample the dark rim of the label texture.
  { const uv = wheelSide.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.0008); }
  const wheelInner = new THREE.CylinderGeometry(innerR, innerR, WHEEL_T, 64, 1, true);
  wheelInner.rotateX(Math.PI / 2);
  wheelInner.translate(0, 0, -WHEEL_T / 2);
  { const uv = wheelInner.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.0008); }
  const wheelGeo = mergeGeometries([wheelTop, wheelSide, wheelInner]);
  const wheel = new THREE.Mesh(wheelGeo, wheelMat);
  wheel.name = 'wheel';
  wheelGroup.add(wheel);

  const buttonGeo = new THREE.CylinderGeometry(WHEEL.rCenter, WHEEL.rCenter, WHEEL_T, 96, 1, false);
  buttonGeo.rotateX(Math.PI / 2);
  buttonGeo.translate(0, 0, -WHEEL_T / 2);
  const button = new THREE.Mesh(buttonGeo, frontMat);
  button.name = 'center';
  wheelGroup.add(button);

  const shadowMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas()), transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  shadow.scale.setScalar(WHEEL.markerSize * 1.25);
  shadow.renderOrder = 3;
  const markerTex = new THREE.CanvasTexture(markerCanvas());
  markerTex.colorSpace = THREE.SRGBColorSpace;
  const markerMat = new THREE.MeshBasicMaterial({
    map: markerTex, color: 0xffffff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const marker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), markerMat);
  marker.renderOrder = 4;
  marker.name = 'marker';
  marker.visible = false;
  shadow.visible = false;
  wheelGroup.add(shadow, marker);

  // Ray-grab target; invisible materials are skipped by the renderer but still raycast.
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(BODY.w * 1.6, BODY.h * 1.6, BODY.d * 1.6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  collider.name = 'asspod-collider';
  root.add(collider);

  // ---- state
  let currentFinish = null;
  let screenDirty = false;
  const stats = { uploads: 1 };   // CanvasTexture uploads once on creation
  const touch = { active: false, angle: 0, opacity: 0, scale: 1 };
  let pressCount = 0;
  const rock = { x: 0, v: 0 };
  let rockTarget = 0;
  const rockAxis = new THREE.Vector3(1, 0, 0);
  const sink = { x: 0, v: 0 };
  let sinkTarget = 0;
  const pressed = new Set();

  function setFinish(f) {
    const key = FINISHES[f] ? f : 'black';
    if (key === currentFinish) return;
    currentFinish = key;
    const fin = FINISHES[key];
    frontMat.color.set(fin.front);
    frontMat.roughness = fin.frontRough;
    darkMat.color.set(fin.well);
    drawWheelLabels(labelCanvas, key);
    labelTex.needsUpdate = true;
    // White absorbs an additive glow, so the white finish gets a dark disc under it.
    shadow.userData.enabled = fin.shadow;
  }
  setFinish(finish);

  function setTouch(active, angle) {
    touch.active = !!active;
    if (active && Number.isFinite(angle)) touch.angle = angle;
  }

  function pressDown(part) {
    if (pressed.has(part)) return;
    pressed.add(part);
    pressCount++;
    if (part === 'select') {
      sinkTarget = 1;
    } else if (part in SECTOR_ANGLE) {
      const a = SECTOR_ANGLE[part];
      rockAxis.set(Math.cos(a), -Math.sin(a), 0);
      rockTarget = 1;
    }
  }

  function pressUp(part) {
    if (!pressed.delete(part)) return;
    pressCount = Math.max(0, pressCount - 1);
    if (part === 'select') sinkTarget = 0;
    else if (part in SECTOR_ANGLE) rockTarget = 0;
  }

  function setBacklight(level) {
    screenMat.color.setScalar(Math.max(0, Math.min(1, level)));
  }

  function markScreenDirty() { screenDirty = true; }

  function update(dt) {
    if (screenDirty) {
      screenTex.needsUpdate = true;
      stats.uploads++;
      screenDirty = false;
    }

    // Marker: linear fades with different in/out times, so a touch reads instantly and lingers briefly.
    const target = touch.active ? MARKER_PEAK : 0;
    if (touch.opacity < target) touch.opacity = Math.min(target, touch.opacity + dt * MARKER_PEAK / MARKER_IN_S);
    else if (touch.opacity > target) touch.opacity = Math.max(target, touch.opacity - dt * MARKER_PEAK / MARKER_OUT_S);
    const sTarget = pressCount > 0 ? MARKER_PRESS_SCALE : 1;
    touch.scale += (sTarget - touch.scale) * (1 - Math.exp(-dt / 0.04));
    const on = touch.opacity > 0.001;
    marker.visible = on;
    if (on) {
      const s = Math.sin(touch.angle);
      const c = Math.cos(touch.angle);
      marker.position.set(WHEEL.rMarker * s, WHEEL.rMarker * c, 0.15 * MM);
      marker.scale.setScalar(WHEEL.markerSize * touch.scale);
      markerMat.opacity = touch.opacity;
    }
    shadow.visible = on && shadow.userData.enabled;
    if (shadow.visible) {
      shadow.position.set(marker.position.x, marker.position.y, 0.08 * MM);
      shadowMat.opacity = 0.18 * touch.opacity / MARKER_PEAK;
    }

    // Press feel: fast in, critically damped back out.
    springStep(rock, rockTarget, rockTarget ? 70 : 38, dt);
    springStep(sink, sinkTarget, sinkTarget ? 70 : 38, dt);
    wheelGroup.quaternion.setFromAxisAngle(rockAxis, ROCK_ANGLE * rock.x);
    button.position.z = -SINK * sink.x;
  }

  // ---- wheel hit testing
  const _inv = new THREE.Matrix4();
  const _ray = new THREE.Ray();

  /** Projects a ray onto the wheel plane. Returns wheel coords in units of rOuter (y up), or null. */
  function projectToWheel(raycaster, out = { x: 0, y: 0 }) {
    root.updateWorldMatrix(true, false);
    _inv.copy(root.matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_inv);
    const dz = _ray.direction.z;
    if (dz > -1e-9) return null;   // parallel, or looking at the back
    const t = (FRONT_Z - _ray.origin.z) / dz;
    if (t < 0) return null;
    out.x = (_ray.origin.x + _ray.direction.x * t) / WHEEL.rOuter;
    out.y = (_ray.origin.y + _ray.direction.y * t - WHEEL.cy) / WHEEL.rOuter;
    return out;
  }

  const _p = { x: 0, y: 0 };
  function hitTestWheel(raycaster) {
    if (!projectToWheel(raycaster, _p)) return null;
    const r = Math.hypot(_p.x, _p.y);
    if (r > 1) return null;
    let angle = Math.atan2(_p.x, _p.y);
    if (angle < 0) angle += Math.PI * 2;
    return { angle, r, onCenter: r * WHEEL.rOuter < WHEEL.rCenter };
  }

  return {
    root,
    collider,
    setTouch,
    pressDown,
    pressUp,
    setBacklight,
    markScreenDirty,
    setFinish,
    hitTestWheel,
    projectToWheel,
    update,
    stats,
    get finish() { return currentFinish; },
    // Exposed for tests and the debug handle.
    parts: { chrome, plate, wheel, button, marker, shadow, lcd, glass, wheelGroup, engraving },
    touch,
  };
}
