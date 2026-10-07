// --dump-view: what the wearer would see of one surface, for checking edges
// without a headset. The output covers the surface rect plus a margin
// (uRect, Steam px) on the surface plane. Back to front, along the eye ray:
//   room   the procedural test room itself (sharp, like passthrough) with
//          --test-backdrop, else the room map at mip 0;
//   cover  the glassd texture's backdrop region (cover and plates) where the
//          ray meets the cover plane (uCoverDz);
//   mosaic (--view-content hero only) a stand-in for Steam's page in the base
//          mosaic: opaque procedural "art" over the whole surface, with the
//          popped rects left out, just in front of the cover;
//   slabs  each atlas cell where the ray meets its plane (dz - 0.8 mm), so the
//          stereo offset of popped glass shows from an off-axis head;
//   crops  (--view-content hero only) each popped element at its dz: an
//          opaque capsule in its colour over the art of its original rect.
// Steam's own content is not available to glassd; the hero stand-in exists to
// judge what a pop's hole looks like off axis (GL-2, GP AT-HV-OFFAXIS).
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
uniform float uCoverDz;    // metres
uniform int uNSlab;
uniform vec4 uSlabRect[16];  // element x, y, w, h (Steam px) where the slab and crop are shown (moved crops included)
uniform vec4 uSlabCell[16];  // cell x, y, w, h (glassd px)
uniform float uSlabDz[16];   // metres
uniform int uContent;        // 0 none; 1 hero stand-in (mosaic art + crops)
uniform vec4 uPopHole[16];   // the hole each pop leaves in the mosaic: x0, y0, x1, y1 (Steam px)
uniform vec4 uPopInfo[16];   // offset x, y of the moved crop (Steam px), corner radius, 1 = draws no slab
uniform vec4 uPopCol[16];    // the element's colour (sRGB)
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
// Hero stand-in: a dark, warm key-art gradient with soft diagonal bands
// (L about 30-90, like game art behind its dimming layer).
vec3 art(vec2 p) {
  vec2 q = p / uSteamSize;
  vec3 top = vec3(0.16, 0.20, 0.30), bottom = vec3(0.38, 0.22, 0.12);
  vec3 c = mix(top, bottom, q.y);
  c *= 0.85 + 0.15 * sin((p.x + p.y) * 0.035);
  c += vec3(0.10, 0.07, 0.03) * smoothstep(0.6, 1.0, sin(p.x * 0.011 - p.y * 0.004));
  return srgbToLinear(c);
}
float sdRR(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
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
  // cover and plates
  vec2 q = planeHit(dir, uCoverDz);
  if (q.x >= 0.0 && q.y >= 0.0 && q.x < uSteamSize.x && q.y < uSteamSize.y) {
    vec4 s = texLin(q * uScale);
    c = c * (1.0 - s.a) + s.rgb;
  }
  // hero stand-in: the base mosaic (opaque art with the popped rects left out)
  if (uContent == 1) {
    vec2 m = planeHit(dir, uCoverDz + 0.0004);
    if (m.x >= 0.0 && m.y >= 0.0 && m.x < uSteamSize.x && m.y < uSteamSize.y) {
      bool hole = false;
      for (int i = 0; i < 16; i++) {
        if (i >= uNSlab) break;
        vec4 h = uPopHole[i];
        if (m.x >= h.x && m.y >= h.y && m.x < h.z && m.y < h.w) { hole = true; break; }
      }
      if (!hole) c = art(m);
    }
  }
  // slabs (and, with the stand-in, their crops), back to front
  for (int i = 0; i < 16; i++) {
    if (i >= uNSlab) break;
    vec2 r = planeHit(dir, uSlabDz[i] - 0.0008) - uSlabRect[i].xy;
    if (r.x >= 0.0 && r.y >= 0.0 && r.x < uSlabRect[i].z && r.y < uSlabRect[i].w && uPopInfo[i].w < 0.5) {
      vec4 s = texLin(uSlabCell[i].xy + r / uSlabRect[i].zw * uSlabCell[i].zw);
      c = c * (1.0 - s.a) + s.rgb;
    }
    if (uContent == 1) {
      vec2 e = planeHit(dir, uSlabDz[i]) - uSlabRect[i].xy;
      vec2 wh = uSlabRect[i].zw;
      if (e.x >= 0.0 && e.y >= 0.0 && e.x < wh.x && e.y < wh.y) {
        float d = sdRR(e - wh * 0.5, wh * 0.5, min(uPopInfo[i].z, 0.5 * min(wh.x, wh.y)));
        float k = clamp(0.5 - d, 0.0, 1.0);
        // the crop shows Steam's pixels of the element's original rect
        vec3 under = art(uSlabRect[i].xy - uPopInfo[i].xy + e);
        c = mix(under, srgbToLinear(uPopCol[i].rgb), k);
      }
    }
  }
  oColor = vec4(linearToSrgb(c), 1.0);
}
