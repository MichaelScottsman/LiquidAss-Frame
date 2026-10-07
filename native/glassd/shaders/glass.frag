// glassd glass, material v2 (docs/phase2/glassd-material.md): one piece of
// glass, either a surface's cover (the union of its rounded shapes) or a slab
// under a popped element. No outline anywhere: the edge is drawn by physics.
//
// Each texel maps to a world point on the Steam surface (element position plus
// dz toward the viewer for slabs). The glass is a slab with a flat face and a
// squircle bezel of width uBezel; its normal follows the bezel's slope.
//   Behind      the view ray, bent by the bezel (Snell at the curved face and
//               the flat back: a prism), meets the room (a sphere around the
//               user) or, for slabs, the cover behind them. Frost = mip level,
//               sharper in the lens band so the bend shows; R and B bend a
//               little differently (dispersion). The interior is not bent.
//   Tone        the frosted room is pulled toward a luminance band (L 55-110 of
//               255) keeping its hue, then mixed toward a neutral of the same
//               luminance by the tint. Over unknown room: more frost, the
//               room's average hue, a stronger vertical sheen.
//   Light       one key light fixed in the world (above, slightly left, in
//               front): a specular crescent where the bezel faces it (top edge,
//               upper corners), a weaker transmitted highlight on the opposite
//               edge, Fresnel reflection of the room on grazing bezel, a top-down
//               sheen. Nothing on the sides.
//   Shade       a soft darkened band inside the edge (strongest away from the
//               light), occlusion inside the lower edge, the shadows of slabs on
//               a cover, and outside the shape an optional contact shadow.
//   v3          plates (one rounded rect per draw, the cover's depth) with a
//               colour tint, a flat fill tone, an occluder variant (x.55, no
//               light) and a flat "dim" mode; holes: a slab's shadow that is not
//               excluded under the slab, plus a fill tone inside the crop rect.
// Output: premultiplied, sRGB-encoded; coverage x uAlpha (materialize).
uniform vec2 uOrigin;      // region origin in this texture (px; y = row, row 0 = top)
uniform float uScale;      // glassd px per Steam px
uniform vec2 uElemOff;     // region top-left on the surface (Steam px): the element for slabs, 0 for covers
uniform int uNS;           // number of rounded shapes (1..8); the glass is their union
uniform vec4 uShapes[8];   // per shape: centre x, y (region-local Steam px), half width, half height
uniform float uRads[8];    // per shape: corner radius (Steam px)
uniform vec2 uShapeC;      // centre of the union's bounding box, region-local Steam px
uniform vec2 uHalf;        // half size of that box (Steam px): the sheen spans the union
uniform vec3 uO;           // world position of Steam pixel (0,0) (top-left)
uniform vec3 uU;           // world step per Steam px to the right
uniform vec3 uV;           // world step per Steam px downward
uniform vec3 uN;           // unit surface normal toward the viewer
uniform float uDz;         // metres toward the viewer (slabs)
uniform vec3 uEye;         // head position
uniform vec3 uCenter;      // room map centre
uniform float uRadius;     // room sphere radius
uniform sampler2D uRoom;   // filled room map (sRGB, mipmapped, wraps in u; alpha = how well known)
uniform sampler2D uRoomAvg;  // 1x1: mean of the known room (linear, premultiplied by the known fraction)
uniform vec2 uRoomSize;
// material (C++ applies the dial, the size response and the materialize phase)
uniform float uBezel;      // lens band width (Steam px)
uniform float uThick;      // slab thickness / bezel width: how steep the bezel looks to the light
uniform float uLensThick;  // the same for refraction (deeper: the bend spans the band)
uniform float uLens;       // ray deviation at the rim (radians): lensing strength
uniform float uDisp;       // dispersion: R bends (1 - uDisp) x, B (1 + uDisp) x
uniform float uFrost;      // interior frost (room-map mip)
uniform float uEdgeFrost;  // frost where the bezel bends the most (mip)
uniform float uEdgeClear;  // how much the lens band drops tint and tone compression (0..1)
uniform float uTintA;      // tint: mix toward a neutral of the band luminance
uniform float uBandMid;    // band centre (perceptual luminance 0..1)
uniform float uBandK;      // share of the room's luminance swing the glass keeps
uniform float uDim;        // backdrop dimming (clear glass over media: 0.35; with v3 roomDim folded in by glassd)
uniform float uSpec;       // key specular strength
uniform float uGloss;      // key specular exponent
uniform float uFill;       // opposite (transmitted) highlight, fraction of the key
uniform float uFres;       // Fresnel reflection of the room
uniform float uSheen;      // top-down sheen
uniform float uDark;       // darkened band inside the edge (E4)
uniform float uDarkW;      // its width (Steam px)
uniform float uOcc;        // occlusion inside the lower edge (E5)
uniform float uShadow;     // contact shadow outside the shape (alpha; needs room in the texture)
uniform float uShadowW;    // its softness (Steam px)
uniform float uShadowY;    // its downward offset (Steam px)
uniform float uAlpha;      // coverage alpha (materialize)
uniform vec3 uKeyL;        // key light direction (world, toward the light)
// slabs: the cover behind them (rendered first this frame)
uniform int uUnder;        // 1 = sample the cover where the bent ray meets it
uniform sampler2D uCover;  // the cover at 1/4 resolution (pass 1: linear, premultiplied, alpha = coverage; mipmapped; transparent border), row 0 = top
uniform vec2 uCoverSize;   // its size in texels
uniform float uCoverScale; // its texels per Steam px
uniform vec2 uSteamSize;   // texW, texH
uniform float uCoverLod;   // mip offset: room-map mip -> cover mip
uniform float uCoverDz;    // slabs: the cover's plane (metres toward the viewer)
uniform int uCoverTaps;    // 9: the round nine-tap read of the copy (a plate or a hole fill lies behind); 1: one tap
// covers and plates: shadows of the slabs in front of them, and holes
uniform int uNSh;
uniform vec4 uShBox[16];   // centre x, y (Steam px), half width, half height
uniform vec4 uShPar[16];   // corner radius, alpha, offset down (Steam px), softness (Steam px)
uniform vec4 uShClip[16];  // hole: the crop rect x0, y0, x1, y1 (Steam px); x1 <= x0 = not a hole
uniform vec4 uShFill[16];  // hole: fill tone inside the crop rect (sRGB, alpha)
// hole edge tones (R1): row i = caster i; texel x = edge * 8 + k is sample k of
// edge e (0 top, 1 right, 2 bottom, 3 left; sRGB, straight alpha), texel 32
// holds the sample count of each edge (x 255; 0 = that edge uses uShFill)
uniform sampler2D uHoleTex;
// v3 per-piece looks
uniform vec4 uTintC;       // colour tint: linear rgb, strength (0 = none)
uniform vec4 uFillC;       // flat fill over the glass: sRGB rgb, alpha (0 = none)
uniform int uOccl;         // 1 = occluder variant: brightness x.55, no light
uniform int uFlat;         // 1 = "dim" plate: uFillC only, feathered by uFeather
uniform float uFeather;    // Steam px
uniform int uDebug;        // 0 normal; 1 backdrop only; 2 light only; 3 bezel t, lens, slope; 4 room uv; 5 known
// Covers render in two passes: the flat interior is low-frequency (frost of
// several degrees), so pass 1 computes it at 1/4 resolution; pass 2 runs the
// whole shader only within uInner of the edge and samples pass 1 deeper in.
uniform int uPass;         // 0 one pass; 1 interior at low resolution (linear rgb out); 2 edge band + pass 1
uniform sampler2D uLow;    // pass 2: pass 1's output
uniform vec2 uLowSize;     // its size in texels
uniform float uLowScale;   // its texels per Steam px
uniform float uInner;      // Steam px from the edge beyond which every edge term is zero
out vec4 oColor;

// Rounded rect SDF and its gradient (outward, y down): (d, gx, gy).
vec3 sdRR(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  vec2 m = max(q, 0.0);
  float l = length(m);
  float d = l + min(max(q.x, q.y), 0.0) - r;
  vec2 g = l > 1e-5 ? m / l : (q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  return vec3(d, g * vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0));
}
// Union of the shapes: distance, gradient of the nearest one, its radius.
vec4 sdf(vec2 q) {
  vec4 best = vec4(1e9, 0.0, -1.0, 0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uNS) break;
    vec3 s = sdRR(q - uShapes[i].xy, uShapes[i].zw, uRads[i]);
    if (s.x < best.x) best = vec4(s, uRads[i]);
  }
  return best;
}

float srgbLum(vec3 lin) { return pow(max(luma(lin), 0.0), 1.0 / 2.2); }
vec3 srgbToLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
// Inside caster i's hole (its crop rect)?
bool inClip(int i, vec2 q) {
  vec4 c = uShClip[i];
  return c.z > c.x && q.x >= c.x && q.y >= c.y && q.x < c.z && q.y < c.w;
}
bool inAnyHole(vec2 q) {
  for (int i = 0; i < 16; i++) {
    if (i >= uNSh) break;
    if (inClip(i, q)) return true;
  }
  return false;
}
// The fill tone at q inside caster i's hole (sRGB, straight alpha): each
// edge's tone (its samples interpolated along it, or the flat fill where it
// has none), blended by nearness, so the thin sliver a pop reveals off axis
// takes the tone of what lies just outside that edge of the crop (R1 M2).
vec4 holeTone(int i, vec2 q) {
  vec4 n4 = min(floor(texelFetch(uHoleTex, ivec2(32, i), 0) * 255.0 + 0.5), vec4(8.0));
  if (n4.x + n4.y + n4.z + n4.w < 0.5) return uShFill[i];
  vec4 c = uShClip[i];
  vec2 f = clamp((q - c.xy) / max(c.zw - c.xy, vec2(1.0)), 0.0, 1.0);
  vec4 dist = max(vec4(q.y - c.y, c.z - q.x, c.w - q.y, q.x - c.x), 0.0);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int e = 0; e < 4; e++) {
    float n = n4[e];
    vec4 tone = uShFill[i];
    if (n > 0.5) {
      float t = clamp((e == 0 || e == 2 ? f.x : f.y) * n - 0.5, 0.0, n - 1.0);
      int k0 = int(floor(t));
      int k1 = min(k0 + 1, int(n) - 1);
      tone = mix(texelFetch(uHoleTex, ivec2(e * 8 + k0, i), 0), texelFetch(uHoleTex, ivec2(e * 8 + k1, i), 0), t - float(k0));
    }
    float w = 1.0 / ((dist[e] + 2.0) * (dist[e] + 2.0));
    acc += vec4(tone.rgb * tone.a, tone.a) * w;
    wsum += w;
  }
  acc /= wsum;
  return acc.a > 1e-4 ? vec4(acc.rgb / acc.a, acc.a) : vec4(0.0);
}

// Where a ray from P along dir meets the room sphere, as room-map uv.
vec2 roomUVRay(vec3 P, vec3 dir) {
  vec3 oc = P - uCenter;
  float b = dot(oc, dir);
  float c = dot(oc, oc) - uRadius * uRadius;
  float t = -b + sqrt(max(b * b - c, 0.0));
  return equirectFromDir(normalize(P + dir * t - uCenter));
}
vec4 frosted(vec2 uv, float lod) {
  // Four rotated taps one texel apart at the chosen mip smooth out mip blockiness.
  vec2 texel = exp2(lod) / uRoomSize;
  vec4 s = textureLod(uRoom, uv + vec2(0.5, 0.25) * texel, lod);
  s += textureLod(uRoom, uv + vec2(-0.25, 0.5) * texel, lod);
  s += textureLod(uRoom, uv + vec2(-0.5, -0.25) * texel, lod);
  s += textureLod(uRoom, uv + vec2(0.25, -0.5) * texel, lod);
  return s * 0.25;
}
// The cover copy blurred isotropically by about 2^lod of its texels. One
// bilinear tap at a deep mip turns a plate that spans 1-2 texels there into a
// square inside the slab (R1 M3), so nine taps at a 1.5 finer mip: the
// centre and a ring of eight at 0.6 x 2^lod, each overlapping its neighbours
// (about the same width as one tap at lod, but round).
const vec2 kRing[8] = vec2[8](vec2(0.924, 0.383), vec2(0.383, 0.924), vec2(-0.383, 0.924), vec2(-0.924, 0.383),
                              vec2(-0.924, -0.383), vec2(-0.383, -0.924), vec2(0.383, -0.924), vec2(0.924, -0.383));
vec4 coverFrost(vec2 uv, float lod) {
  float l = max(lod - 1.5, 0.0);
  vec2 r = 0.6 * exp2(lod) / uCoverSize;
  vec4 s = textureLod(uCover, uv, l);
  for (int i = 0; i < 8; i++) s += textureLod(uCover, uv + kRing[i] * r, l);
  return s * (1.0 / 9.0);
}
float gCover = 0.0;  // share of the cover in the last behind() sample
// What lies behind along a (bent) ray leaving the glass at P: for slabs (and
// plates over a cover) the cover where the ray meets its plane (over the room
// where the cover is not opaque), else the room. rgb linear; a = how well the
// room there is known.
vec4 behind(vec3 P, vec3 dir, float lod, bool cheap) {
  gCover = 0.0;
  vec4 cv = vec4(0.0);
  if (uUnder == 1) {
    float dn = dot(dir, uN);
    if (dn < -1e-4) {
      float t = dot(uO + uN * uCoverDz - P, uN) / dn;
      vec3 X = P + dir * t - uO;
      vec2 q = vec2(dot(X, uU) / dot(uU, uU), dot(X, uV) / dot(uV, uV));
      // the copy has a transparent border, so the cover's edge blurs into the room
      vec2 cuv = q * uCoverScale / uCoverSize;
      float clod = clamp(lod + uCoverLod, 0.0, 4.5);
      cv = cheap || uCoverTaps < 2 ? textureLod(uCover, cuv, clod) : coverFrost(cuv, clod);
      gCover = cv.a > 1e-3 ? cv.a : 0.0;
      // fully over the cover: the room behind it does not show
      if (cv.a > 0.996) return vec4(cv.rgb / cv.a, 1.0);
    }
  }
  vec2 ruv = roomUVRay(P, dir);
  vec4 r = cheap ? textureLod(uRoom, ruv, lod) : frosted(ruv, lod);
  if (gCover > 0.0) r.rgb = cv.rgb + r.rgb * (1.0 - cv.a);
  return r;
}

void main() {
  vec2 local = (gl_FragCoord.xy - uOrigin) / uScale;  // region-local Steam px, y down
  vec2 p = local - uShapeC;                            // from the union's centre, y down
  vec4 sd = sdf(local);
  float d = sd.x;
  if (uFlat == 1) {
    // a "dim" plate: a flat tone, feathered inside its edge, no optics
    float cov = clamp(-d / max(uFeather, 1.0), 0.0, 1.0);
    float fa = uFillC.a * cov * uAlpha;
    oColor = uPass == 1 ? vec4(srgbToLin(uFillC.rgb) * fa, fa) : vec4(uFillC.rgb * fa, fa);
    return;
  }
  if (uPass == 2 && -d > uInner && !inAnyHole(local)) {
    // explicit level 0: in this non-uniform branch the derivatives are
    // undefined, and the copy's other levels exist only when slabs need them
    // (R1 M1: black dashes inside the corners of a cover without slabs)
    vec3 c = textureLod(uLow, local * uLowScale / uLowSize, 0.0).rgb;
    oColor = vec4(linearToSrgb(c) * uAlpha, uAlpha);
    return;
  }
  float dpx = d * uScale;                              // in this texture's pixels
  float inside = uPass == 1 ? 1.0 : clamp(0.5 - dpx, 0.0, 1.0);
  if (inside <= 0.0) {
    // Outside: transparent, or a soft contact shadow below the shape.
    float a = 0.0;
    if (uShadow > 0.0) {
      float ds = sdf(local - vec2(0.0, uShadowY)).x;
      float s = 1.0 - smoothstep(-0.3 * uShadowW, uShadowW, ds);
      a = uShadow * s * s;
    }
    oColor = vec4(0.0, 0.0, 0.0, a * uAlpha);
    return;
  }
  vec2 g = sd.yz;
  vec2 gU = vec2(g.x, -g.y);   // outward normal, y up
  vec2 pU = vec2(p.x, -p.y);

  // Panel frame (world): right, up, toward the viewer.
  vec3 Uh = normalize(uU), Vh = normalize(uV);
  vec3 base = uO + uU * (uElemOff.x + local.x) + uV * (uElemOff.y + local.y) + uN * uDz;
  vec3 view = normalize(base - uEye);                  // eye -> glass
  vec3 Vl = -vec3(dot(view, Uh), -dot(view, Vh), dot(view, uN));  // glass -> eye, panel-local
  vec3 L = normalize(vec3(dot(uKeyL, Uh), -dot(uKeyL, Vh), dot(uKeyL, uN)));
  vec2 Lp = normalize(L.xy + vec2(1e-4, 0.0));
  float facing = dot(gU, Lp);                          // +1 edge faces the light, -1 opposite

  // Squircle bezel (narrower than the corner radius, so corners stay smooth).
  float B = max(1.0, min(uBezel, max(sd.w, 6.0)));
  float t = clamp(-d / B, 0.0, 1.0);
  float tt = max(t, 0.015);
  float dh = pow(1.0 - pow(1.0 - tt, 4.0), -0.75) * pow(1.0 - tt, 3.0);  // dh/dt of h = (1-(1-t)^4)^(1/4)
  float slope = t < 1.0 ? dh * uThick : 0.0;
  vec3 n = normalize(vec3(gU * slope, 1.0));

  // How well the room behind is known (coarse), the luminance of what is
  // behind (the cover for slabs on one), and the known room's mean colour.
  vec2 uvC = roomUVRay(base, view);
  vec4 coarse = textureLod(uRoom, uvC, 6.5);
  vec3 coarseB = coarse.rgb;
  if (uUnder == 1) coarseB = behind(base, view, 6.0, true).rgb;
  float known = max(clamp(coarse.a, 0.0, 1.0), gCover);
  vec4 avg = texelFetch(uRoomAvg, ivec2(0, 0), 0);
  vec3 avgCol = avg.a > 1e-4 ? avg.rgb / avg.a : vec3(0.06, 0.06, 0.065);
  float unk = 1.0 - smoothstep(0.25, 0.85, known);

  // Refraction: a vertical ray meets the face, bends (n = 1.5) and leaves
  // through the flat back face: a prism deviation toward the thick side.
  // The optics use a deeper bezel than the highlight (uLensThick), so the
  // bend spans the band instead of its outer pixel. Normalised by the
  // maximum (a vertical face), times uLens.
  float lensF = 0.0;
  if (t < 0.999) {
    float a1 = atan(dh * uLensThick);
    float a2 = asin(sin(a1) / 1.5);
    lensF = tan(a1 - a2) / 1.118;
  }
  float dev = uLens * lensF;
  vec3 inW = -(Uh * gU.x - Vh * gU.y);                 // world, inward along the panel
  // the lens band: less frost, less tint, so the bent room shows there
  float band = uLens > 1e-4 ? smoothstep(0.0, 0.25, lensF) : 0.0;
  float lod = mix(uFrost, uEdgeFrost, band) + 1.0 * unk;
  vec4 bgk;
  vec3 bg;
  if (dev > 1e-4) {
    // Dispersion: R bends less, B more; G sits halfway between them, so it
    // is the mean of their green (two frosted lookups, not three). Every
    // channel uses the same filter as the interior, or edges grow false
    // colour fringes and seams.
    if (uDisp > 0.0) {
      vec4 sr = behind(base, normalize(view + inW * tan(dev * (1.0 - uDisp))), lod, false);
      vec4 sb = behind(base, normalize(view + inW * tan(dev * (1.0 + uDisp))), lod, false);
      bgk = vec4(sr.r, 0.5 * (sr.g + sb.g), sb.b, sb.a);
    } else {
      bgk = behind(base, normalize(view + inW * tan(dev)), lod, false);
    }
    bg = bgk.rgb;
  } else if (uUnder == 1) {
    bgk = behind(base, view, lod, false);
    bg = bgk.rgb;
  } else {
    bgk = frosted(uvC, lod);  // the flat interior of a cover: the ray is not bent
    bg = bgk.rgb;
    gCover = 0.0;
  }
  bg *= 1.0 - uDim;

  // Tone: pull the frosted room toward the band, keep its hue.
  float lumR = max(luma(coarseB * (1.0 - uDim)), 1e-4);
  float Lr = pow(lumR, 1.0 / 2.2);
  float bandK = mix(uBandK, max(uBandK, 0.7), band * uEdgeClear);
  float Lg = uBandMid + 0.03 * gCover + (Lr - uBandMid) * bandK * (Lr < uBandMid ? 1.2 : 0.8);
  float lumG = pow(clamp(Lg, 0.02, 0.95), 2.2);
  vec3 rgb = bg * clamp(lumG / lumR, 0.25, 4.0);
  // neutral tint of the same luminance; over unknown room, the room's mean hue
  vec3 hue = mix(vec3(0.97, 0.99, 1.04), avgCol / max(luma(avgCol), 1e-3), 0.35 * unk);
  // glass over glass (a slab seeing the cover) adds only part of its tint:
  // the cover is already tinted
  rgb = mix(rgb, hue * lumG, clamp(uTintA * (1.0 - 0.5 * gCover) * (1.0 - 0.8 * uEdgeClear * band) + 0.1 * unk, 0.0, 0.95));
  // coloured glass (v3 tint): the tint colour, keeping a little of the room's
  // brightness variation; the light terms below stay on top
  if (uTintC.a > 0.0) {
    float vary = clamp(luma(rgb) / max(lumG, 1e-3), 0.75, 1.25);
    rgb = mix(rgb, uTintC.rgb * vary, uTintC.a);
  }

  // Top-down sheen across the union (stronger over unknown room).
  float ext = abs(uHalf.x * Lp.x) + abs(uHalf.y * Lp.y);
  float along = clamp(dot(pU, Lp) / max(ext, 1.0), -1.0, 1.0);
  rgb *= 1.0 + (uSheen * 0.07 + 0.08 * unk) * along;

  // Shade: darkened band inside the edge, strongest away from the light (E4),
  // occlusion inside the lower edge (E5). Both soft: no line.
  float away = 0.5 - 0.5 * facing;
  float e4 = smoothstep(0.0, 0.3 * uDarkW, -d) * (1.0 - smoothstep(0.3 * uDarkW, uDarkW, -d));
  float shade = uDark * e4 * (0.35 + 0.65 * away);
  float e5 = 1.0 - smoothstep(0.0, 1.6 * uDarkW, -d);
  shade += uOcc * e5 * e5 * smoothstep(0.35, 1.0, away);
  // shadows of the slabs in front of a cover or plate; a hole's shadow is not
  // excluded under its slab inside the crop rect, and is applied in sRGB below
  // (like CSS black at alpha), over the hole's fill tone
  float holeShade = 0.0;
  vec4 holeFill = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uNSh) break;
    vec4 bx = uShBox[i], pr = uShPar[i];
    bool hole = uShClip[i].z > uShClip[i].x;
    bool inside = hole && inClip(i, local);
    // Inside a hole (R1 M2), so its sliver reads as the control's shadow and
    // never as the crop rect's outline:
    // - the ambient-occlusion floor (30 % of the shadow, so the sliver above
    //   the top edge is shaded a little) lies only under the control's own
    //   rounded shape (6 px falloff), never in the crop's corners beyond its
    //   rounded ends, and fades out at the crop's edge;
    // - over opaque content (a fill or edge tones) the shadow cannot go on
    //   past the crop's edge (the content hides the cover there), so inside
    //   the hole it follows the control's shape (falloff 0.4 x its blur) and
    //   fades to nothing at the crop's edge (over 0.3 x its blur), in
    //   proportion to the fill's opacity; the fill then meets the content
    //   with no step.
    float holeK = 1.0, floorA = 0.0;
    if (inside) {
      vec4 hf = holeTone(i, local);
      if (hf.a > 0.0) holeFill = hf;
      vec4 cr = uShClip[i];
      float de = min(min(local.x - cr.x, cr.z - local.x), min(local.y - cr.y, cr.w - local.y));
      float dc = sdRR(local - bx.xy, bx.zw, pr.x).x;
      float atEdge = smoothstep(0.0, max(0.3 * pr.w, 1.0), de);
      floorA = 0.3 * pr.y * (1.0 - smoothstep(0.0, 6.0, dc)) * atEdge;
      holeK = mix(1.0, atEdge * (1.0 - smoothstep(0.0, max(0.4 * pr.w, 1.0), dc)), hf.a);
    }
    vec2 qb = abs(local - bx.xy - vec2(0.0, pr.z)) - bx.zw - pr.w;
    if (max(qb.x, qb.y) > 0.0) {  // beyond this shadow's reach
      if (floorA > 0.0) holeShade = 1.0 - (1.0 - holeShade) * (1.0 - floorA);
      continue;
    }
    float ds = sdRR(local - bx.xy - vec2(0.0, pr.z), bx.zw, pr.x).x;
    float s = 1.0 - smoothstep(-0.4 * pr.w, pr.w, ds);
    float under = inside ? 1.0 : smoothstep(-1.0, 1.5, sdRR(local - bx.xy, bx.zw, pr.x).x);  // not under the slab itself
    if (hole) holeShade = 1.0 - (1.0 - holeShade) * (1.0 - max(pr.y * s * s * under * holeK, floorA));
    else shade = 1.0 - (1.0 - shade) * (1.0 - pr.y * s * s * under);
  }
  rgb *= 1.0 - clamp(shade, 0.0, 0.9);

  // Light (on the bezel only: the flat face has no highlight from this light).
  // The occluder variant has none: it must read as shadowed glass, not a rim.
  vec3 light = vec3(0.0);
  if (t < 0.95 && uOccl == 0) {
    vec3 H = normalize(L + Vl);
    float spec = pow(max(dot(n, H), 0.0), uGloss);
    vec3 Lt = vec3(-L.xy, L.z);                          // leaves through the opposite bezel
    // a broad, soft lobe: light scattered out through the lower bezel, never a
    // thin line (thin lines break up when the compositor resamples the panel)
    float trans = pow(max(dot(n, normalize(Lt + Vl)), 0.0), uGloss * 0.3) * uFill * (1.0 - smoothstep(0.05, 0.5, t));
    float edgeOnly = 1.0 - smoothstep(0.55, 0.95, t);   // speculars live on the bezel
    float ndv = clamp(dot(n, Vl), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 5.0);
    float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.8, facing);
    light = vec3((spec + trans) * edgeOnly * uSpec);
    if (fres * uFres > 2e-3) {
      vec3 Rl = reflect(-Vl, n);
      vec3 Rw = Uh * Rl.x - Vh * Rl.y + uN * Rl.z;
      light += textureLod(uRoom, equirectFromDir(normalize(Rw)), 5.0).rgb * fres * uFres * lit;
    }
  }
  rgb += light;

  // v3 tones in sRGB, as CSS blends them: the fill, the occluder's dimming,
  // the hole's fill and its shadow
  bool post = uFillC.a > 0.0 || uOccl == 1 || holeFill.a > 0.0 || holeShade > 0.0;
  if (post) {
    vec3 c = linearToSrgb(rgb);
    if (uFillC.a > 0.0) c = mix(c, uFillC.rgb, uFillC.a);
    if (uOccl == 1) c *= 0.55;
    if (holeFill.a > 0.0) c = mix(c, holeFill.rgb, holeFill.a);
    c *= 1.0 - clamp(holeShade, 0.0, 0.95);
    rgb = srgbToLin(c);
  }

  // pass 1: linear, premultiplied by coverage (slabs see the cover through it;
  // pass 2 reads it only deeper than uInner, where no edge term reaches)
  if (uPass == 1) { float cov = clamp(0.5 - dpx, 0.0, 1.0); oColor = vec4(rgb * cov, cov); return; }
  if (uDebug == 1) rgb = bg;
  else if (uDebug == 2) rgb = light;
  else if (uDebug == 3) rgb = vec3(t, lensF, slope / 8.0);
  else if (uDebug == 4) rgb = vec3(fract(uvC), 0.0);
  else if (uDebug == 5) rgb = vec3(known);
  float a = inside * uAlpha;
  oColor = vec4(linearToSrgb(rgb) * a, a);
}
