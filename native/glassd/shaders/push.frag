// Push step of the push-pull fill: 2x2 weighted average. Level 1 reads the room
// map itself (straight colour, alpha = known) and premultiplies; deeper levels
// read the previous push level, which is already premultiplied.
uniform sampler2D uSrc;
uniform int uFromMap;
out vec4 oColor;

vec4 tap(ivec2 p, ivec2 m) {
  vec4 s = texelFetch(uSrc, min(p, m), 0);
  return uFromMap == 1 ? vec4(s.rgb * s.a, s.a) : s;
}
void main() {
  ivec2 m = textureSize(uSrc, 0) - 1;
  ivec2 p = ivec2(gl_FragCoord.xy) * 2;
  oColor = 0.25 * (tap(p, m) + tap(p + ivec2(1, 0), m) + tap(p + ivec2(0, 1), m) + tap(p + ivec2(1, 1), m));
}
