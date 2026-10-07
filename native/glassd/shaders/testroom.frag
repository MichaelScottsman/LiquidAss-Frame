// --test-backdrop: writes the procedural test room (testroom.glsl) into the
// room map instead of feed frames. With uHole = 1 every texel whose ray from
// the map centre crosses a mask quad (the UI and its margins, as the feed
// would see them) stays unknown, to exercise the unknown-room fill.
in vec2 vUv;
uniform int uPattern;
uniform int uHole;
uniform vec3 uCenter;
uniform int uNQ;
uniform vec3 uQO[16];
uniform vec3 uQU[16];
uniform vec3 uQV[16];
uniform vec4 uQE[16];
out vec4 oColor;

void main() {
  vec3 dir = dirFromEquirect(vUv);
  vec3 c = testRoom(dir, uPattern);
  float known = 1.0;
  if (uHole == 1) {
    for (int i = 0; i < 16; i++) {
      if (i >= uNQ) break;
      vec3 n = cross(uQU[i], uQV[i]);
      float dn = dot(dir, n);
      if (abs(dn) < 1e-6) continue;
      float t = dot(uQO[i] - uCenter, n) / dn;
      if (t <= 0.0) continue;
      vec3 h = uCenter + dir * t - uQO[i];
      float a = dot(h, uQU[i]), b = dot(h, uQV[i]);
      if (a > uQE[i].x && a < uQE[i].y && b > uQE[i].z && b < uQE[i].w) { known = 0.0; break; }
    }
  }
  oColor = vec4(c * known, known);
}
