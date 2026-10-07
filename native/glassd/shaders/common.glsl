// Shared helpers, inserted after the #version/precision header of every shader.
// Texture convention throughout glassd: texture row 0 (v = 0) is the image top.
const float PI = 3.14159265;

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Equirectangular room map in standing space: u = azimuth (0.5 = -z forward,
// increasing toward +x), v = 0 straight up, v = 1 straight down.
vec3 dirFromEquirect(vec2 uv) {
  float th = (uv.x - 0.5) * 2.0 * PI;
  float ph = (0.5 - uv.y) * PI;
  return vec3(sin(th) * cos(ph), sin(ph), -cos(th) * cos(ph));
}
vec2 equirectFromDir(vec3 d) {
  return vec2(atan(d.x, -d.z) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(d.y, -1.0, 1.0)) / PI);
}

vec3 linearToSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
