// Integrates one passthrough feed frame into the equirectangular room map.
// Each map texel is a direction from the map centre; the room is assumed to lie
// on a sphere of radius uRadius. That point is projected into the feed camera
// (the feed eye at the frame's display time) and the feed colour is blended in
// with an exponential moving average. Texels whose feed ray passes through a
// Steam surface (or our glass on it) are skipped: the feed shows UI there.
// Alpha = how well the texel is known (0 never seen, 1 seen).
in vec2 vUv;
uniform sampler2D uPrev;   // previous map, SRGB8_ALPHA8
uniform sampler2D uFeed;   // feed frame, SRGB8_ALPHA8 with mips
uniform mat4 uFeedView;    // standing -> feed eye
uniform vec4 uAffine;      // u = a*x + b, v = c*y + d (tangent -> feed uv)
uniform vec3 uFeedPos;     // feed eye position (standing)
uniform vec3 uCenter;
uniform float uRadius;
uniform float uEma;
uniform float uFeedLod;
uniform int uNQ;
uniform vec3 uQO[16];      // quad origin (top-left of the Steam texture)
uniform vec3 uQU[16];      // unit axis right
uniform vec3 uQV[16];      // unit axis down
uniform vec4 uQE[16];      // extents along U (min, max) and V (min, max), margins included
out vec4 oColor;

void main() {
  vec4 prev = texelFetch(uPrev, ivec2(gl_FragCoord.xy), 0);
  vec3 dir = dirFromEquirect(vUv);
  vec3 X = uCenter + dir * uRadius;
  vec3 q = (uFeedView * vec4(X, 1.0)).xyz;
  float w = 0.0;
  vec3 c = prev.rgb;
  if (q.z < -0.05) {
    vec2 tn = q.xy / -q.z;
    vec2 fuv = vec2(uAffine.x * tn.x + uAffine.y, uAffine.z * tn.y + uAffine.w);
    vec2 e = min(fuv, 1.0 - fuv);
    w = smoothstep(0.0, 0.04, min(e.x, e.y));
    if (w > 0.0) {
      vec3 rd = X - uFeedPos;
      for (int i = 0; i < 16; i++) {
        if (i >= uNQ) break;
        vec3 n = cross(uQU[i], uQV[i]);
        float dn = dot(rd, n);
        if (abs(dn) < 1e-6) continue;
        float t = dot(uQO[i] - uFeedPos, n) / dn;
        if (t <= 0.0) continue;
        vec3 h = uFeedPos + rd * t - uQO[i];
        float a = dot(h, uQU[i]), b = dot(h, uQV[i]);
        if (a > uQE[i].x && a < uQE[i].y && b > uQE[i].z && b < uQE[i].w) { w = 0.0; break; }
      }
      if (w > 0.0) c = textureLod(uFeed, fuv, uFeedLod).rgb;
    }
  }
  // First sighting replaces the fill outright; afterwards blend slowly.
  float k = w * max(uEma, 1.0 - prev.a);
  oColor = vec4(mix(prev.rgb, c, k), max(prev.a, w));
}
