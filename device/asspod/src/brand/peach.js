// The peach logo's geometry: the one shape behind the boot screen and the engraving on the
// assPod's chrome back.
//
// Design box: 100 x 100 units, y down, lit from the top left. The art spans x 8..93 and
// y 2.3..98 (leaf tip to body tip) and is centred on (50.5, 50).
//
// All path data is absolute M/L/H/V/C/Z only, so tests can parse it with a tiny reader.
//
// Node-safe on purpose: no three.js and no DOM at import time. Path2D objects are only built on
// the first draw, so unit tests can import this module without a browser.

// ---------------------------------------------------------------- geometry

export const PEACH = Object.freeze({
  // Outline: two plump lobes meeting in a heart-shaped cleft at the top (dip at 50,24.5), round
  // lower flanks and a soft point at the bottom.
  body: 'M50 24.5C54.5 17.5 61.5 14 69.5 14C84 14 93 28.5 93 49C93 74 74 92.5 51.5 98C29 92.5 8 74 8 50C8 29 17 14.5 31 14.5C39 14.5 45.5 17.5 50 24.5Z',
  // The crease: a closed sliver strictly inside the body. It starts a few units below the cleft
  // dip (so the notch and the groove read as one line without touching the edge), swings right
  // of centre in the upper half and back left toward the tip, tapering to points at both ends
  // (max width 4.2 at y 62). Filled together with the body under 'evenodd', it becomes negative
  // space in one colour.
  crease: 'M50.5 29C56.8 39 58.8 51 55.7 62C53.4 70.5 49.1 80.5 48.6 91C46.9 80.5 49.4 70.5 51.5 62C54.4 51 53.2 39 50.5 29Z',
  // Same centreline at 2.5x the width (max 10.5), y 27.5..92.5, for small sizes: the favicon and
  // silhouettes under ~40 px tall. 2x still blurred into a 1 px line at 16 px.
  creaseBold: 'M50.1 27.5C59.5 39 62.1 51 58.9 62C56.4 70.5 50.7 80.5 48.5 92.5C45.3 80.5 46.4 70.5 48.4 62C51.1 51 50.5 39 50.1 27.5Z',
  // The crease's right edge as an open path. It faces the top-left light, so it carries the
  // glass highlight.
  creaseEdge: 'M50.5 29C56.8 39 58.8 51 55.7 62C53.4 70.5 49.1 80.5 48.6 91',
  creaseBoldEdge: 'M50.1 27.5C59.5 39 62.1 51 58.9 62C56.4 70.5 50.7 80.5 48.5 92.5',
  // Everything left of the crease centreline: a clip that isolates the left lobe.
  leftHalf: 'M0 0H50.5V29C55 39 56.6 51 53.6 62C51.4 70.5 48 80.5 48.6 91V100H0Z',
  // The leaf keeps >= 2.5 units clear of the right lobe, or it merges with the body in a
  // one-colour silhouette. Its base overlaps the stem tip so the two read as one sprig; only the
  // stem touches the body, inside the notch.
  leaf: 'M53.2 13.4C57 5.5 67.5 1.2 80.5 2.6C75.5 9.2 65.5 12.6 53.2 13.4Z',
  leafRib: 'M55.6 11.7C62 8.6 70 5.7 78 3.7',
  stem: 'M48.8 26C48.6 21 49.6 16 52.4 12.5L54.6 14C52.4 17 51.6 21 51.6 26Z',
});

// Where the art is centred in the design box; drawPeachSilhouette puts this point at (cx, cy).
const CENTER_X = 50.5;
const CENTER_Y = 50;

// ---------------------------------------------------------------- silhouette

// Built on first use so importing this module never touches Path2D (absent in Node).
let paths = null;

function getPaths() {
  if (!paths) {
    paths = {
      body: new Path2D(PEACH.body + ' ' + PEACH.crease),
      bodyBold: new Path2D(PEACH.body + ' ' + PEACH.creaseBold),
      stem: new Path2D(PEACH.stem),
      leaf: new Path2D(PEACH.leaf),
    };
  }
  return paths;
}

/**
 * Fills a one-colour peach: the body with the crease cut out as negative space, then the stem
 * and the leaf. The context state is restored afterwards.
 * @param {CanvasRenderingContext2D} g
 * @param {number} cx  centre x in canvas px
 * @param {number} cy  centre y in canvas px
 * @param {number} height  height of the 100-unit design box in canvas px (the art is ~96% of it)
 * @param {string} color  any canvas fillStyle
 * @param {{ bold?: boolean }} [opts]  bold uses the double-width crease, for small sizes
 */
export function drawPeachSilhouette(g, cx, cy, height, color, { bold = false } = {}) {
  const p = getPaths();
  const s = height / 100;
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  g.translate(-CENTER_X, -CENTER_Y);
  g.fillStyle = color;
  // evenodd: the crease sliver lies strictly inside the body, so it punches a hole.
  g.fill(bold ? p.bodyBold : p.body, 'evenodd');
  g.fill(p.stem);
  g.fill(p.leaf);
  g.restore();
}
