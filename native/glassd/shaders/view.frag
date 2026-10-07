// --dump-view: what the wearer would see of one surface, for checking edges
// without a headset. The output covers the surface rect plus a margin
// (uRect, Steam px) on the surface plane. Back to front, along the eye ray:
//   room   the procedural test room itself (sharp, like passthrough) with
//          --test-backdrop, else the room map at mip 0;
//   cover  the glassd texture's backdrop region where the ray meets the cover
//          plane (+1 mm);
//   slabs  each atlas cell where the ray meets its plane (dz - 0.8 mm), so the
//          stereo offset of popped glass shows from an off-axis head.
// Steam's own content is not available to glassd and is not drawn.
in vec2 vUv;
uniform vec4 uRect;        // x0, y0, x1, y1 in Steam px
uniform vec3 uO, uU, uV, uN, uEye, uCenter;
uniform float uRadius;
uniform sampler2D uRoom;
uniform int uPattern;      // test room pattern, -1 = room map
uniform sampler2D uTex;    // the surface's glassd texture (premultiplied, sRGB-encoded bytes), row 0 = top
uniform vec2 uTexSize;
uniform float uScale;      // glassd px per Steam px
uniform vec2 uSteamSize;   // texW, texH
uniform int uNSlab;
uniform vec4 uSlabRect[16];  // element x, y, w, h (Steam px)
uniform vec4 uSlabCell[16];  // cell x, y, w, h (glassd px)
uniform float uSlabDz[16];
out vec4 oColor;

vec3 srgbToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }

// Ray from the eye through world point P meets the plane through O + N*dz:
// returns Steam px on that plane.
vec2 planeHit(vec3 dir, float dz) {
  vec3 Q = uO + uN * dz;
  float t = dot(Q - uEye, uN) / dot(dir, uN);
  vec3 X = uEye + dir * t - Q;
  return vec2(dot(X, uU) / dot(uU, uU), dot(X, uV) / dot(uV, uV));
}
// premultiplied sRGB texel -> premultiplied linear
vec4 texLin(vec2 px) {
  vec4 s = texture(uTex, px / uTexSize);
  if (s.a < 1e-4) return vec4(0.0);
  return vec4(srgbToLinear(s.rgb / s.a) * s.a, s.a);
}

void main() {
  vec2 sp = mix(uRect.xy, uRect.zw, vUv);
  vec3 P = uO + uU * sp.x + uV * sp.y;
  vec3 dir = normalize(P - uEye);
  vec3 c;
  if (uPattern >= 0) {
    // the room as seen from the map centre (the room is assumed far, as in glassd)
    vec3 oc = uEye - uCenter;
    float b = dot(oc, dir), cc = dot(oc, oc) - uRadius * uRadius;
    float t = -b + sqrt(max(b * b - cc, 0.0));
    c = testRoom(normalize(uEye + dir * t - uCenter), uPattern);
  } else {
    vec3 oc = uEye - uCenter;
    float b = dot(oc, dir), cc = dot(oc, oc) - uRadius * uRadius;
    float t = -b + sqrt(max(b * b - cc, 0.0));
    c = textureLod(uRoom, equirectFromDir(normalize(uEye + dir * t - uCenter)), 0.0).rgb;
  }
  // cover
  vec2 q = planeHit(dir, 0.001);
  if (q.x >= 0.0 && q.y >= 0.0 && q.x < uSteamSize.x && q.y < uSteamSize.y) {
    vec4 s = texLin(q * uScale);
    c = c * (1.0 - s.a) + s.rgb;
  }
  // slabs, back to front
  for (int i = 0; i < 16; i++) {
    if (i >= uNSlab) break;
    vec2 r = planeHit(dir, uSlabDz[i] - 0.0008) - uSlabRect[i].xy;
    if (r.x < 0.0 || r.y < 0.0 || r.x >= uSlabRect[i].z || r.y >= uSlabRect[i].w) continue;
    vec4 s = texLin(uSlabCell[i].xy + r / uSlabRect[i].zw * uSlabCell[i].zw);
    c = c * (1.0 - s.a) + s.rgb;
  }
  oColor = vec4(linearToSrgb(c), 1.0);
}
