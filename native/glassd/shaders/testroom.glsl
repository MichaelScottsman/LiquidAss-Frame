// Procedural test room for --test-backdrop (no camera, safe to keep in dumps).
// testRoom(dir, pattern) returns a linear colour for a direction seen from the
// room-map centre. Pattern 0 "room": a box room with wooden slats and LED
// strips on the wall behind the window (straight lines that show lensing), a
// framed picture, a bright window on the left wall, a couch and a plant on the
// right, a checker floor with a rug, ceiling lamps. Pattern 1 "stripes": black
// and white stripes 3 degrees apart in azimuth (about 4 room-map texels each,
// so they survive light frost) plus coloured elevation bands: a lensing and
// dispersion chart.
vec3 srgbIn(vec3 c) { return pow(c, vec3(2.2)); }

float boxMask(vec2 p, vec2 lo, vec2 hi) { return step(lo.x, p.x) * step(p.x, hi.x) * step(lo.y, p.y) * step(p.y, hi.y); }

vec3 testRoom(vec3 d, int pattern) {
  if (pattern == 1) {
    float az = atan(d.x, -d.z) * 57.29578;
    float el = asin(clamp(d.y, -1.0, 1.0)) * 57.29578;
    float s = step(0.5, fract(az / 3.0));
    float band = floor(el / 10.0);
    vec3 bc = mod(band, 3.0) < 0.5 ? vec3(0.9, 0.25, 0.2) : mod(band, 3.0) < 1.5 ? vec3(0.2, 0.75, 0.3) : vec3(0.25, 0.35, 0.95);
    float thin = 1.0 - smoothstep(0.0, 0.35, abs(fract(el / 10.0) - 0.5) * 10.0 - 4.4);
    return srgbIn(mix(vec3(0.08 + 0.84 * s), bc, 0.35 * thin));
  }
  // Box room around the viewer (metres from the map centre, which sits at eye height 1.1 m).
  const vec3 lo = vec3(-2.6, -1.1, -2.3), hi = vec3(2.4, 1.5, 2.8);
  vec3 inv = 1.0 / max(abs(d), vec3(1e-5)) * sign(d + 1e-7);
  vec3 tf = mix(lo, hi, step(0.0, d)) * inv;   // distance to the wall each axis heads for
  float t = min(tf.x, min(tf.y, tf.z));
  vec3 p = d * t;
  vec3 c;
  if (t == tf.z && d.z < 0.0) {
    // Front wall (behind the window): wooden slats, LED strips, desk, picture.
    float u = p.x, v = p.y;
    float slat = fract(u / 0.09);
    c = mix(vec3(0.42, 0.27, 0.16), vec3(0.30, 0.19, 0.11), step(0.5, fract(u / 0.18)));
    c *= 0.55 + 0.45 * smoothstep(0.0, 0.12, slat) * smoothstep(1.0, 0.88, slat);
    float leds = 0.0;
    leds += boxMask(vec2(u, v), vec2(-1.62, -0.25), vec2(-1.595, 1.35));
    leds += boxMask(vec2(u, v), vec2(-0.72, 0.30), vec2(-0.695, 1.50));
    leds += boxMask(vec2(u, v), vec2(0.475, -0.10), vec2(0.50, 1.20));
    leds += boxMask(vec2(u, v), vec2(1.30, 0.40), vec2(1.325, 1.50));
    c = mix(c, vec3(1.0, 0.98, 0.92), clamp(leds, 0.0, 1.0));
    // picture: sky, sun, hill
    vec2 q = vec2(u, v);
    if (boxMask(q, vec2(-0.32, 0.08), vec2(0.30, 0.62)) > 0.0) {
      vec3 sky = mix(vec3(0.95, 0.65, 0.35), vec3(0.25, 0.45, 0.85), smoothstep(0.1, 0.6, v));
      float sun = 1.0 - smoothstep(0.07, 0.08, length(q - vec2(0.10, 0.30)));
      float hill = step(v, 0.20 + 0.08 * sin(u * 9.0));
      c = mix(mix(sky, vec3(1.0, 0.85, 0.3), sun), vec3(0.15, 0.45, 0.2), hill);
    } else if (boxMask(q, vec2(-0.35, 0.05), vec2(0.33, 0.65)) > 0.0) {
      c = vec3(0.92);
    }
    // desk
    if (v < -0.30 && v > -0.36) c = vec3(0.75, 0.62, 0.45);
    else if (v <= -0.36) c *= 0.45;
  } else if (t == tf.x && d.x < 0.0) {
    // Left wall: teal, with a bright daylight window.
    float u = p.z, v = p.y;
    c = vec3(0.30, 0.48, 0.50);
    if (boxMask(vec2(u, v), vec2(-1.6, -0.25), vec2(-0.2, 1.05)) > 0.0) {
      c = vec3(1.0, 0.99, 0.96);
      if (abs(u + 0.9) < 0.025 || abs(v - 0.40) < 0.025) c = vec3(0.85);
    }
  } else if (t == tf.x) {
    // Right wall: warm beige, red couch, green plant.
    float u = p.z, v = p.y;
    c = vec3(0.70, 0.60, 0.48);
    if (v < -0.35 && u > -1.8 && u < 0.2) c = vec3(0.62, 0.12, 0.14) * (v < -0.62 ? 0.75 : 1.0);
    float plant = 1.0 - smoothstep(0.30, 0.34, length(vec2(u + 2.0, v - 0.05) * vec2(1.0, 0.8)));
    c = mix(c, vec3(0.20, 0.50, 0.18), plant);
  } else if (t == tf.z) {
    c = vec3(0.45, 0.45, 0.47);  // back wall
  } else if (d.y < 0.0) {
    // Floor: checker tiles and a blue rug.
    vec2 f = p.xz;
    float ch = mod(floor(f.x / 0.5) + floor(f.y / 0.5), 2.0);
    c = mix(vec3(0.40, 0.38, 0.35), vec3(0.26, 0.25, 0.23), ch);
    if (boxMask(f, vec2(-1.2, -1.8), vec2(1.0, -0.4)) > 0.0) c = vec3(0.16, 0.24, 0.52);
  } else {
    // Ceiling with lamps.
    vec2 f = p.xz;
    c = vec3(0.78, 0.78, 0.76);
    float lamp = 1.0 - smoothstep(0.16, 0.2, length(vec2(fract(f.x / 1.6 + 0.5) - 0.5, fract(f.y / 1.6 + 0.5) - 0.5) * 1.6));
    c = mix(c, vec3(1.0, 0.97, 0.9), lamp);
  }
  return srgbIn(c);
}
