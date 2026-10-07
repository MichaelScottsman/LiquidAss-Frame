// Pull step: fills texels that are not (fully) known from the coarser, already
// filled level. At level 0 the fine input is the room map itself; there an
// unknown texel takes most of its colour from the row fill (row.frag,
// hfill.frag: the known room to its left and right at the same height), so a
// large hole (the room behind a dashboard that never closed) keeps the room's
// structure instead of one flat average. The final output keeps alpha = how
// well the texel is known, so the glass can tell measured room from fill.
in vec2 vUv;
uniform sampler2D uFine;
uniform sampler2D uCoarse;
uniform sampler2D uRow;    // 32 x H/2 row fill (straight colour, alpha = the row knows something; wraps in u)
uniform int uFineIsMap;
uniform int uLast;
uniform vec3 uEmpty;   // fill colour when nothing at all is known (linear)
out vec4 oColor;

void main() {
  vec4 f = texelFetch(uFine, ivec2(gl_FragCoord.xy), 0);
  if (uFineIsMap == 1) f = vec4(f.rgb * f.a, f.a);
  if (uLast == 1) {
    oColor = vec4(f.a > 1e-4 ? f.rgb / f.a : uEmpty, 1.0);
    return;
  }
  vec3 c = texture(uCoarse, vUv).rgb;
  float k = clamp(f.a, 0.0, 1.0);
  if (uFineIsMap == 1) {
    vec4 r = texture(uRow, vUv);
    if (r.a > 0.0) c = mix(c, r.rgb / r.a, 0.75 * r.a);
    oColor = vec4(f.rgb + (1.0 - k) * c, k);
    return;
  }
  oColor = vec4(f.rgb + (1.0 - k) * c, 1.0);
}
