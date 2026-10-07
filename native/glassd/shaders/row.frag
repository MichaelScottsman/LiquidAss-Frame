// Unknown-room fill, step 1 (sectors): the known room per row in 32 azimuth
// sectors of 11.25 deg. Input: push level 0 (half the room map, premultiplied,
// alpha = known). Output (32 x H/2): the sector's mean, premultiplied, alpha =
// known share of the sector.
uniform sampler2D uSrc;
out vec4 oColor;

void main() {
  ivec2 sz = textureSize(uSrc, 0);
  int n = max(1, sz.x / 32);
  int x0 = int(gl_FragCoord.x) * n, y = int(gl_FragCoord.y);
  vec4 s = vec4(0.0);
  for (int i = 0; i < 64; i++) {
    if (i >= n) break;
    s += texelFetch(uSrc, ivec2(x0 + i, y), 0);
  }
  oColor = s / float(n);
}
