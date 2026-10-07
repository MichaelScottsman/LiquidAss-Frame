// glassd glass: one piece of glass (a surface's cover: the union of its rounded
// shapes; or a slab under a popped element), ported from vr/shaders/glass.frag.
//
// Each texel maps to a world point on the Steam surface (element position plus
// dz toward the viewer for slabs). The view ray from the head through that
// point samples the room map, frosted by a mip bias; across the squircle bezel
// the sample point is pushed inward in panel space (lensing, the same in both
// eyes) with slight dispersion. Then adaptive tint, an inner shadow band, and
// light from above: Fresnel, key specular, a key rim on the top edge and a
// weaker fill rim on the bottom, a crisp edge line and a top-down sheen.
// Output: premultiplied, sRGB-encoded, opaque inside the shape.
uniform vec2 uOrigin;      // region origin in this texture (px; y = row, row 0 = top)
uniform float uScale;      // glassd px per Steam px
uniform vec2 uElemOff;     // region top-left on the surface (Steam px): the element for slabs, 0 for covers
uniform int uNS;           // number of rounded shapes (1..8); the glass is their union
uniform vec4 uShapes[8];   // per shape: centre x, y (region-local Steam px), half width, half height
uniform float uRads[8];    // per shape: corner radius (Steam px)
uniform vec2 uShapeC;      // centre of the union's bounding box, region-local Steam px
uniform vec2 uHalf;        // half size of that box (Steam px): magnification and sheen span the union
uniform vec3 uO;           // world position of Steam pixel (0,0) (top-left)
uniform vec3 uU;           // world step per Steam px to the right
uniform vec3 uV;           // world step per Steam px downward
uniform vec3 uN;           // unit surface normal toward the viewer
uniform float uDz;         // metres toward the viewer (slabs)
uniform vec3 uEye;         // head position
uniform vec3 uCenter;      // room map centre
uniform float uRadius;     // room sphere radius
uniform sampler2D uRoom;   // filled room map (sRGB, mipmapped, wraps in u)
uniform vec2 uRoomSize;
uniform float uBezel;      // Steam px (lensing profile)
uniform float uRimW;       // Steam px (width of the rim light and the inner shadow)
uniform float uRefr;       // Steam px
uniform float uLensMag;
uniform float uFrost;      // mip level
uniform float uDisp, uTintA, uTrans, uRim, uSheen, uSpec, uDarkEdge, uEnvLuma;
uniform vec2 uLight2;      // light direction in the panel plane (x right, y up)
uniform vec3 uLight3;      // light direction, panel-local (x right, y up, z toward viewer)
uniform int uDebug;        // 0 normal; 1 backdrop only; 2 light only; 3 bezel t; 4 room uv
out vec4 oColor;

vec2 roomUV(vec3 P) {
  vec3 d = normalize(P - uEye);
  vec3 oc = uEye - uCenter;
  float b = dot(oc, d);
  float c = dot(oc, oc) - uRadius * uRadius;
  float t = -b + sqrt(max(b * b - c, 0.0));
  return equirectFromDir(normalize(uEye + d * t - uCenter));
}
vec3 frosted(vec2 uv, float lod) {
  // Four rotated taps one texel apart at the chosen mip smooth out mip blockiness.
  vec2 texel = exp2(lod) / uRoomSize;
  vec3 s = textureLod(uRoom, uv + vec2(0.5, 0.25) * texel, lod).rgb;
  s += textureLod(uRoom, uv + vec2(-0.25, 0.5) * texel, lod).rgb;
  s += textureLod(uRoom, uv + vec2(-0.5, -0.25) * texel, lod).rgb;
  s += textureLod(uRoom, uv + vec2(0.25, -0.5) * texel, lod).rgb;
  return s * 0.25;
}
// Signed distance to the union of the shapes (region-local Steam px), so rims,
// bezels and coverage follow the union's outline and overlapping shapes merge.
float sdf(vec2 q) {
  float d = 1e9;
  for (int i = 0; i < 8; i++) {
    if (i >= uNS) break;
    d = min(d, sdRoundRect(q - uShapes[i].xy, uShapes[i].zw, uRads[i]));
  }
  return d;
}

void main() {
  vec2 local = (gl_FragCoord.xy - uOrigin) / uScale;  // region-local Steam px, y down
  vec2 p = local - uShapeC;                            // from the union's centre, y down
  float d = sdf(local);
  float dpx = d * uScale;                              // in this texture's pixels
  float inside = clamp(0.5 - dpx, 0.0, 1.0);
  if (inside <= 0.0) { oColor = vec4(0.0); return; }

  vec2 e = vec2(0.5, 0.0);
  vec2 g = vec2(sdf(local + e.xy) - sdf(local - e.xy), sdf(local + e.yx) - sdf(local - e.yx));
  g = dot(g, g) > 1e-10 ? normalize(g) : vec2(0.0, -1.0);
  vec2 gU = vec2(g.x, -g.y);   // outward normal, y up
  vec2 pU = vec2(p.x, -p.y);

  // Squircle bezel: steep at the rim, flat interior.
  float t = clamp(-d / max(uBezel, 1.0), 0.0, 1.0);
  float h = pow(1.0 - pow(1.0 - t, 4.0), 0.25);
  float tt = max(t, 0.02);
  float slope = pow(1.0 - pow(1.0 - tt, 4.0), -0.75) * pow(1.0 - tt, 3.0);
  vec3 nL = normalize(vec3(gU * min(slope, 8.0) * 0.5, 1.0));

  // Lensing: sample from inward across the bezel, plus a slight interior magnification.
  vec2 offLens = -g * uRefr * (1.0 - h);
  vec2 off = offLens - p * uLensMag * (1.0 - 0.5 * t);
  vec3 base = uO + uU * (uElemOff.x + local.x) + uV * (uElemOff.y + local.y) + uN * uDz;
  vec3 wR = base + uU * off.x + uV * off.y;
  vec3 mid = frosted(roomUV(wR), uFrost);
  vec3 bg = mid;
  // Dispersion only where the bezel bends the ray (the flat interior skips the extra taps).
  if (uDisp * length(offLens) > 0.35) {
    vec3 wD = (uU * offLens.x + uV * offLens.y) * uDisp;
    bg.r = textureLod(uRoom, roomUV(wR + wD), uFrost).r;
    bg.b = textureLod(uRoom, roomUV(wR - wD), uFrost).b;
  }

  // Adaptive tint: darker, stronger tint over bright rooms; lighter over dark ones.
  float lum = pow(max(luma(textureLod(uRoom, roomUV(base), 6.5).rgb), 0.0), 1.0 / 2.2);
  float bright = smoothstep(0.08, 0.5, lum);
  vec3 tint = mix(vec3(0.075, 0.078, 0.088), vec3(0.028, 0.030, 0.035), bright);
  float tA = clamp(uTintA * mix(0.75, 1.45, bright), 0.0, 0.95);
  vec3 rgb = bg * uTrans * (1.0 - tA) + tint * tA;

  // Inner shadow: a darkened band just inside the rim (visionOS depth cue).
  // Rim light and shadow follow their own width, so small capsules whose bezel
  // spans the whole shape still get a crisp rim.
  float tr = clamp(-d / max(min(uRimW, uBezel), 1.0), 0.0, 1.0);
  float tb = clamp(-d / max(1.6 * min(uRimW, uBezel), 1.0), 0.0, 1.0);
  float band = smoothstep(0.0, 0.10, tb) * (1.0 - smoothstep(0.16, 0.6, tb)) * uDarkEdge;
  rgb *= 1.0 - 0.4 * band;

  // Light from above.
  vec3 Uh = normalize(uU), Vh = normalize(uV);
  vec3 Vw = normalize(uEye - base);
  vec3 Vl = normalize(vec3(dot(Vw, Uh), -dot(Vw, Vh), dot(Vw, uN)));
  vec3 L = normalize(uLight3);
  vec3 H = normalize(L + Vl);
  float ndv = clamp(dot(nL, Vl), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-Vl, nL);
  float env = uEnvLuma * (0.55 + 0.45 * clamp(R.y * 0.5 + 0.5, 0.0, 1.0));
  float spec = pow(max(dot(nL, H), 0.0), 140.0) * 1.4;
  vec2 Lp = normalize(uLight2);
  float rimBand = pow(1.0 - tr, 2.2);
  float rimKey = rimBand * pow(max(dot(gU, Lp), 0.0), 1.4);
  float rimFill = rimBand * pow(max(dot(gU, -Lp), 0.0), 2.0) * 0.4;
  float line = 1.0 - smoothstep(0.0, 1.2, -dpx);
  float lineDir = 0.3 + 0.7 * max(dot(gU, Lp), 0.0);
  // top-down sheen across the whole shape (0 at the far edge from the light, 0.05 at the near one)
  float ext = abs(uHalf.x * Lp.x) + abs(uHalf.y * Lp.y);
  float sheen = 0.05 * (0.5 + 0.5 * clamp(dot(pU, Lp) / max(ext, 1.0), -1.0, 1.0));
  float light = fres * (0.18 + 0.9 * env) + spec + uRim * (0.5 * rimKey + rimFill + line * lineDir * 0.55) + sheen * uSheen;
  rgb += vec3(light * uSpec);

  if (uDebug == 1) rgb = bg;
  else if (uDebug == 2) rgb = vec3(light * uSpec);
  else if (uDebug == 3) rgb = vec3(t, tr, slope / 8.0);
  else if (uDebug == 4) rgb = vec3(fract(roomUV(wR)), 0.0);
  oColor = vec4(linearToSrgb(rgb) * inside, inside);
}
