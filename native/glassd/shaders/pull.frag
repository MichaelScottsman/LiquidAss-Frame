// Pull step: fills texels that are not (fully) known from the coarser, already
// filled level. At level 0 the fine input is the room map itself.
in vec2 vUv;
uniform sampler2D uFine;
uniform sampler2D uCoarse;
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
  oColor = vec4(f.rgb + (1.0 - clamp(f.a, 0.0, 1.0)) * c, 1.0);
}
