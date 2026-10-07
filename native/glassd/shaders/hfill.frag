// Unknown-room fill, step 2 (rows): each sector that knows little of its row
// takes the colour of the nearest known sectors to its left and right in the
// same row (the map wraps), interpolated by distance. Rooms are mostly
// horizontal structure (floor, desk, wall, ceiling), so a large hole, such as
// the room behind a dashboard that never closed, continues the room beside it
// at the same height instead of becoming one flat average.
// Output (32 x H/2): straight linear colour, alpha = 1 where a row had any
// known sector.
uniform sampler2D uSrc;   // row.frag output
out vec4 oColor;

vec4 sec(int x, int y) { return texelFetch(uSrc, ivec2((x + 32) % 32, y), 0); }

void main() {
  int x = int(gl_FragCoord.x), y = int(gl_FragCoord.y);
  vec4 c = sec(x, y);
  if (c.a > 0.35) { oColor = vec4(c.rgb / c.a, 1.0); return; }
  vec4 l = vec4(0.0), r = vec4(0.0);
  float dl = 0.0, dr = 0.0;
  for (int i = 1; i <= 16; i++) {
    vec4 s = sec(x - i, y);
    if (s.a > 0.15) { l = vec4(s.rgb / s.a, 1.0); dl = float(i); break; }
  }
  for (int i = 1; i <= 16; i++) {
    vec4 s = sec(x + i, y);
    if (s.a > 0.15) { r = vec4(s.rgb / s.a, 1.0); dr = float(i); break; }
  }
  vec4 h;
  if (l.a > 0.0 && r.a > 0.0) h = vec4(mix(l.rgb, r.rgb, dl / (dl + dr)), 1.0);
  else h = l.a > 0.0 ? l : r;
  // a partly known sector keeps its own share
  if (c.a > 1e-3 && h.a > 0.0) h.rgb = mix(h.rgb, c.rgb / c.a, c.a / 0.35);
  else if (c.a > 1e-3) h = vec4(c.rgb / c.a, 1.0);
  oColor = h;
}
