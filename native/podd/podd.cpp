// podd: the assPod's body with real shaders, for SteamVR's scene graph.
//
// SteamVR draws render models with fixed lighting only, so this renders the original model
// (device/asspod/model, exported from tools/asspod-model) itself on the GPU: clearcoat plastic on
// the front, mirror-polished steel on the back and edges, the engraved peach as satin, glass over the
// screen, all lit by a studio environment and one key light.
//
// How it reaches the headset: the body sits in a box of six panels in SteamVR's scene graph
// (device/asspod/src/sg.js), rigid with the hand. For each face and each eye, podd renders the model
// as seen from that eye through the face (an off-axis projection onto the face's plane), from
// predicted head and hand poses. A face's panel shows its eye pair with SteamVR's "Parallel"
// stereoscopy, so the body looks solid from any side, and the panels themselves move with the hand
// at the compositor's rate. The screen is not drawn here: the window shows the live screen panel
// inside the box (glass reflections over it, transparent otherwise).
//
// Input:  --spec /dev/shm/lgs/podd.json  {open, hand, rot [w,x,y,z], centre [x,y,z], scale, finish}
//         (the body in the controller's frame, written by device/shell_ext/asspod.py)
// Output: --out /dev/shm/lgs/podd-out.json {pid, ok, key, texW, texH, box [hx,hy,hz], tiles {face: [x,y,w,h]}}
//         tiles are the left eye's rect in texture pixels (v = 0 at the top), with `pad` px of
//         overscan around each eye; the right eye's starts tw + 2 pad to its right. A face's panel
//         shows [tx - pad, tx + 2 tw + 3 pad] x [ty - pad, ty + th + pad]. The overlay's mouse scale
//         is half the texture's width (one eye).
//
// Build on the Frame: sh native/podd/build.sh (GBM, EGL, GLES 3.2, SteamVR's libopenvr_api).
#include <openvr.h>
#include <signal.h>
#include <sys/file.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <time.h>

#include <array>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "gfx.h"
#include "json.h"
#include "vmath.h"

// ------------------------------------------------------------------ model constants (tools/asspod-model)
static const float BODY_W = 0.0618f, BODY_H = 0.1035f, BODY_D = 0.0110f;
static const float FRONT_Z = BODY_D / 2;
static const float LCD_CY = 0.0242f, LCD_W = 0.0508f, LCD_H = 0.0381f;
static const float WIN_W = 0.0532f, WIN_H = 0.0405f;
static const float WHEEL_CY = -0.0240f, WHEEL_R = 0.0197f, WHEEL_RC = 0.0073f, WHEEL_RM = 0.0135f;
static const float MARGIN = 0.004f;       // m around the body: the box of panels
static const float PX_PER_M = 4200.f;     // panel pixels per metre (about 1 px per 0.24 mm)
static const int PAD = 3;                 // px rendered past each face's edge: neighbouring faces overlap,
                                          // so no panel edge (where texels blend with the gap) shows

static const float kPi = 3.14159265f;
static volatile sig_atomic_t g_stop = 0;
static void onSignal(int) { g_stop = 1; }

static uint64_t nowNs() {
    timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return uint64_t(ts.tv_sec) * 1000000000ull + uint64_t(ts.tv_nsec);
}

static bool readFile(const std::string &p, std::string &out) {
    std::ifstream f(p, std::ios::binary);
    if (!f) return false;
    std::stringstream ss;
    ss << f.rdbuf();
    out = ss.str();
    return true;
}

static void writeAtomic(const std::string &path, const std::string &text) {
    std::string tmp = path + ".tmp";
    FILE *f = std::fopen(tmp.c_str(), "w");
    if (!f) return;
    std::fwrite(text.data(), 1, text.size(), f);
    std::fclose(f);
    std::rename(tmp.c_str(), path.c_str());
}

// ------------------------------------------------------------------ meshes
struct Mesh {
    GLuint vao = 0, vbo = 0;
    GLsizei count = 0;
};

// Our exporter's OBJ: v / vt / vn, then non-indexed triangles "f i/i/i i/i/i i/i/i".
static bool loadObj(const std::string &path, Mesh &m) {
    std::string text;
    if (!readFile(path, text)) return false;
    std::vector<float> pos, uv, nrm, out;
    std::istringstream in(text);
    std::string line;
    while (std::getline(in, line)) {
        if (line.size() < 2) continue;
        if (line[0] == 'v' && line[1] == ' ') {
            float x, y, z;
            if (std::sscanf(line.c_str() + 2, "%f %f %f", &x, &y, &z) == 3) pos.insert(pos.end(), {x, y, z});
        } else if (line[0] == 'v' && line[1] == 't') {
            float u, v;
            if (std::sscanf(line.c_str() + 3, "%f %f", &u, &v) == 2) uv.insert(uv.end(), {u, v});
        } else if (line[0] == 'v' && line[1] == 'n') {
            float x, y, z;
            if (std::sscanf(line.c_str() + 3, "%f %f %f", &x, &y, &z) == 3) nrm.insert(nrm.end(), {x, y, z});
        } else if (line[0] == 'f' && line[1] == ' ') {
            int a[3][3];
            if (std::sscanf(line.c_str() + 2, "%d/%d/%d %d/%d/%d %d/%d/%d", &a[0][0], &a[0][1], &a[0][2], &a[1][0], &a[1][1],
                            &a[1][2], &a[2][0], &a[2][1], &a[2][2]) != 9)
                continue;
            for (auto &c : a) {
                int p = c[0] - 1, t = c[1] - 1, n = c[2] - 1;
                if (p < 0 || size_t(p) * 3 + 2 >= pos.size() || t < 0 || size_t(t) * 2 + 1 >= uv.size() || n < 0 ||
                    size_t(n) * 3 + 2 >= nrm.size())
                    return false;
                out.insert(out.end(), {pos[p * 3], pos[p * 3 + 1], pos[p * 3 + 2], nrm[n * 3], nrm[n * 3 + 1], nrm[n * 3 + 2],
                                       uv[t * 2], uv[t * 2 + 1]});
            }
        }
    }
    if (out.empty()) return false;
    glGenVertexArrays(1, &m.vao);
    glGenBuffers(1, &m.vbo);
    glBindVertexArray(m.vao);
    glBindBuffer(GL_ARRAY_BUFFER, m.vbo);
    glBufferData(GL_ARRAY_BUFFER, GLsizeiptr(out.size() * sizeof(float)), out.data(), GL_STATIC_DRAW);
    for (int i = 0; i < 3; i++) glEnableVertexAttribArray(GLuint(i));
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 32, reinterpret_cast<void *>(0));
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 32, reinterpret_cast<void *>(12));
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 32, reinterpret_cast<void *>(24));
    glBindVertexArray(0);
    m.count = GLsizei(out.size() / 8);
    return true;
}

// Raw RGBA from the exporter: "RGBA", u32 width, u32 height, rows top first.
static GLuint loadRgba(const std::string &path) {
    std::string d;
    if (!readFile(path, d) || d.size() < 12 || d.compare(0, 4, "RGBA") != 0) return 0;
    uint32_t w, h;
    std::memcpy(&w, d.data() + 4, 4);
    std::memcpy(&h, d.data() + 8, 4);
    if (d.size() < 12 + size_t(w) * h * 4) return 0;
    GLuint t;
    glGenTextures(1, &t);
    glBindTexture(GL_TEXTURE_2D, t);
    int levels = 1;
    for (uint32_t m = std::max(w, h); m > 1; m >>= 1) levels++;
    glTexStorage2D(GL_TEXTURE_2D, levels, GL_RGBA8, GLsizei(w), GLsizei(h));
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, GLsizei(w), GLsizei(h), GL_RGBA, GL_UNSIGNED_BYTE, d.data() + 12);
    glGenerateMipmap(GL_TEXTURE_2D);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    return t;
}

// ------------------------------------------------------------------ shaders
static const char *VS = R"GLSL(#version 320 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNrm;
layout(location = 2) in vec2 aUv;
uniform mat4 uProj, uView, uModel;   // model: the part's own motion (wheel rock, button sink), in body units
uniform float uScale;                // model metres -> body metres
out vec3 vPos;                       // body space (metres)
out vec3 vNrm;
out vec2 vUv;
out vec3 vModel;                     // the model's own coordinates (metres, unscaled)
void main() {
    vec4 p = uModel * vec4(aPos, 1.0);
    vModel = p.xyz;
    vPos = p.xyz * uScale;
    vNrm = mat3(uModel) * aNrm;
    vUv = aUv;
    gl_Position = uProj * uView * vec4(vPos, 1.0);
}
)GLSL";

static const char *FS = R"GLSL(#version 320 es
precision highp float;
in vec3 vPos;
in vec3 vNrm;
in vec2 vUv;
in vec3 vModel;
uniform vec3 uEye;          // body space
uniform mat3 uToWorld;      // body -> world rotation (the environment is fixed in the room)
uniform int uMat;           // 0 plate, 1 steel, 2 steel back (engraving), 3 wheel, 4 well, 5 ports, 6 window glass
uniform vec3 uBase;         // base colour (linear)
uniform sampler2D uTex;     // wheel labels / engraving mask
uniform vec4 uMarker;       // x angle (rad, 0 = top, clockwise), y opacity
out vec4 frag;

const float PI = 3.14159265;
const vec3 KEY = normalize(vec3(-0.45, 0.80, 0.40));
const vec3 FILL = normalize(vec3(0.70, 0.35, 0.60));

// The studio, as seen along world direction r, blurred for roughness: dark surroundings (so glossy
// black stays black and polished steel has contrast), a soft grey ceiling, and bright soft boxes.
vec3 envColor(vec3 r, float rough) {
    float y = r.y;
    float w = 0.03 + rough * 0.6;
    float up = smoothstep(0.05 - w, 0.55 + w, y);
    vec3 c = mix(vec3(0.016, 0.017, 0.019), vec3(0.10, 0.105, 0.115), up);
    c = mix(c, vec3(0.05, 0.048, 0.045), smoothstep(-0.05 + w, -0.35 - w, y));   // the floor
    // the key soft box above-left, a fill on the right, a long strip light behind
    float lk = 0.004 + rough * rough * 0.9;
    float key = exp(-(1.0 - dot(r, KEY)) / lk) * (0.004 / lk) * 6.0;
    float lf = 0.012 + rough * rough * 0.9;
    float fill = exp(-(1.0 - dot(r, FILL)) / lf) * (0.012 / lf) * 1.5;
    float sw = 0.0015 + rough * 0.25;
    float strip = exp(-pow(r.x + 0.55, 2.0) / sw) * smoothstep(-0.2, 0.3, y) * smoothstep(0.95, 0.5, y) * 1.1 * (0.0015 / sw + 0.15 * rough);
    return c + vec3(key + fill) + vec3(1.0, 0.98, 0.95) * strip;
}
vec3 irradiance(vec3 n) {
    vec3 c = mix(vec3(0.05, 0.05, 0.05), vec3(0.22, 0.23, 0.25), n.y * 0.5 + 0.5);
    return c + vec3(1.0, 0.98, 0.95) * max(dot(n, KEY), 0.0) * 0.32 + vec3(0.14) * max(dot(n, FILL), 0.0);
}
float fresnel(float f0, float cosT) { return f0 + (1.0 - f0) * pow(1.0 - cosT, 5.0); }
vec3 fresnel3(vec3 f0, float cosT) { return f0 + (1.0 - f0) * pow(1.0 - cosT, 5.0); }

void main() {
    vec3 n = normalize(vNrm);
    vec3 v = normalize(uEye - vPos);
    if (dot(n, v) < 0.0) n = -n;                 // two-sided (thin parts)
    vec3 nw = normalize(uToWorld * n);
    vec3 r = normalize(uToWorld * reflect(-v, n));
    float cosT = clamp(dot(n, v), 0.0, 1.0);
    vec3 col;
    float alpha = 1.0;
    if (uMat == 1 || uMat == 2) {
        // polished stainless steel; the engraving is a satin etch
        float etch = uMat == 2 ? texture(uTex, vec2(vUv.x, 1.0 - vUv.y)).r : 0.0;
        float rough = mix(0.06, 0.38, etch);
        vec3 f0 = mix(vec3(0.90, 0.91, 0.93), vec3(0.74, 0.75, 0.78), etch);
        col = fresnel3(f0, cosT) * envColor(r, rough);
    } else if (uMat == 3) {
        // the click wheel: printed labels on satin plastic
        vec3 base = texture(uTex, vec2(vUv.x, 1.0 - vUv.y)).rgb;
        base = pow(base, vec3(2.2));
        col = base * irradiance(nw) + fresnel(0.04, cosT) * envColor(r, 0.45);
        // the touch marker: a soft glow where the thumb is
        if (uMarker.y > 0.001) {
            vec2 p = vModel.xy - vec2(0.0, -0.0240);
            vec2 m = vec2(sin(uMarker.x), cos(uMarker.x)) * 0.0135;
            float d = length(p - m);
            col += vec3(0.55, 0.72, 1.0) * uMarker.y * exp(-d * d / (2.0 * 0.0028 * 0.0028)) * 0.9;
        }
    } else if (uMat == 4) {
        col = uBase * irradiance(nw);
    } else if (uMat == 5) {
        col = uBase * irradiance(nw) + fresnel(0.3, cosT) * envColor(r, 0.35) * 0.5;
    } else if (uMat == 6) {
        // the window: black glossy border; the LCD itself transparent, with the glass's reflection
        vec2 p = vModel.xy - vec2(0.0, 0.0242);
        bool lcd = abs(p.x) < 0.0254 && abs(p.y) < 0.01905;
        vec3 refl = fresnel(0.04, cosT) * envColor(r, 0.02);
        if (lcd) {
            float a = clamp(max(refl.r, max(refl.g, refl.b)), 0.0, 1.0);
            frag = vec4(refl, a);   // premultiplied: the reflection over whatever is behind
            frag.rgb = pow(frag.rgb / (1.0 + frag.rgb), vec3(1.0 / 2.2)) * a;
            return;
        }
        col = vec3(0.004) + refl;
    } else {
        // the front plate and centre button: plastic under a clear coat
        vec3 diffuse = uBase * irradiance(nw);
        vec3 spec = fresnel(0.04, cosT) * envColor(r, uBase.r > 0.5 ? 0.18 : 0.12);
        vec3 coat = fresnel(0.04, cosT) * envColor(r, 0.03);
        col = diffuse * (1.0 - fresnel(0.04, cosT)) + spec * 0.5 + coat;
    }
    // filmic tone map and gamma (the overlay is submitted as gamma colour)
    col = col / (1.0 + col * 0.55) * 1.1;
    frag = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), alpha);
}
)GLSL";

// ------------------------------------------------------------------ the box and its atlas
struct Face {
    const char *name;
    v3 c, R, U, N;   // body space: centre, right, up, outward normal
    float w, h;      // metres
    int tx, ty, tw, th;   // the left eye's tile (texture px, top-left origin) inside PAD px of overscan;
                          // the right eye's at tx + tw + 2 PAD
};

struct Layout {
    std::array<Face, 6> f;
    int texW = 0, texH = 0;
    float hx = 0, hy = 0, hz = 0;
    int vx = 0, vy = 0;   // the video tile: the playing video's picture twice (left eye, right eye), like a face block
};

// The video's picture: device/shell_ext/asspod.py writes the latest frame to VIDEO_FILE as
// "PVID", u32 seq, u32 width, u32 height, then RGBA rows top first (letterboxed to 4:3).
static const int VIDEO_W = 320, VIDEO_H = 240;
static const char *VIDEO_FILE = "/dev/shm/lgs/podd-video";

static Layout makeLayout(float scale) {
    Layout L;
    L.hx = BODY_W * scale / 2 + MARGIN;
    L.hy = BODY_H * scale / 2 + MARGIN;
    L.hz = BODY_D * scale / 2 + MARGIN;
    const float hx = L.hx, hy = L.hy, hz = L.hz;
    L.f = {{
        {"front", {0, 0, hz}, {1, 0, 0}, {0, 1, 0}, {0, 0, 1}, 2 * hx, 2 * hy},
        {"back", {0, 0, -hz}, {-1, 0, 0}, {0, 1, 0}, {0, 0, -1}, 2 * hx, 2 * hy},
        {"right", {hx, 0, 0}, {0, 0, -1}, {0, 1, 0}, {1, 0, 0}, 2 * hz, 2 * hy},
        {"left", {-hx, 0, 0}, {0, 0, 1}, {0, 1, 0}, {-1, 0, 0}, 2 * hz, 2 * hy},
        {"top", {0, hy, 0}, {1, 0, 0}, {0, 0, -1}, {0, 1, 0}, 2 * hx, 2 * hz},
        {"bottom", {0, -hy, 0}, {1, 0, 0}, {0, 0, 1}, {0, -1, 0}, 2 * hx, 2 * hz},
    }};
    // two rows: front, back, right, left (all as tall as the body); then top and bottom. A face's block
    // is both eyes with PAD px around each: [PAD | left eye | 2 PAD | right eye | PAD]
    const int gap = 4;
    int x = 0, row0 = 0;
    for (int i = 0; i < 4; i++) {
        Face &F = L.f[size_t(i)];
        F.tw = int(std::lround(F.w * PX_PER_M));
        F.th = int(std::lround(F.h * PX_PER_M));
        F.tx = x + PAD;
        F.ty = PAD;
        x += 2 * F.tw + 4 * PAD + gap;
        row0 = std::max(row0, F.th + 2 * PAD);
    }
    int w0 = x;
    x = 0;
    int row1 = 0;
    for (int i = 4; i < 6; i++) {
        Face &F = L.f[size_t(i)];
        F.tw = int(std::lround(F.w * PX_PER_M));
        F.th = int(std::lround(F.h * PX_PER_M));
        F.tx = x + PAD;
        F.ty = row0 + gap + PAD;
        x += 2 * F.tw + 4 * PAD + gap;
        row1 = std::max(row1, F.th + 2 * PAD);
    }
    // the video tile under the second row
    L.vx = x;
    L.vy = row0 + gap;
    x += 2 * VIDEO_W + gap;
    L.texW = (std::max(w0, x) + 63) / 64 * 64;
    L.texH = (row0 + gap + std::max(row1, VIDEO_H) + 7) / 8 * 8;
    return L;
}

// Off-axis projection through a face (Kooima's generalized perspective), eye in body space.
static bool faceMatrices(const Face &F, v3 e, float proj[16], float view[16]) {
    v3 pa = F.c - F.R * (F.w / 2) - F.U * (F.h / 2);
    v3 pb = F.c + F.R * (F.w / 2) - F.U * (F.h / 2);
    v3 pc = F.c - F.R * (F.w / 2) + F.U * (F.h / 2);
    v3 va = pa - e, vb = pb - e, vc = pc - e;
    float d = -dot(va, F.N);
    if (d < 0.002f) return false;              // the eye is behind (or in) this face's plane
    const float n = 0.002f, f = 4.0f;
    float l = dot(F.R, va) * n / d, r = dot(F.R, vb) * n / d;
    float b = dot(F.U, va) * n / d, t = dot(F.U, vc) * n / d;
    // memory row 0 is the texture's top and GL's y = 0: map the face's top (+U) to y = -1
    std::swap(b, t);
    std::fill(proj, proj + 16, 0.f);
    proj[0] = 2 * n / (r - l);
    proj[5] = 2 * n / (t - b);
    proj[8] = (r + l) / (r - l);
    proj[9] = (t + b) / (t - b);
    proj[10] = -(f + n) / (f - n);
    proj[11] = -1;
    proj[14] = -2 * f * n / (f - n);
    // view: rotate into the face's frame (rows R, U, N), then move the eye to the origin
    const v3 R = F.R, U = F.U, N = F.N;
    view[0] = R.x; view[4] = R.y; view[8] = R.z;
    view[1] = U.x; view[5] = U.y; view[9] = U.z;
    view[2] = N.x; view[6] = N.y; view[10] = N.z;
    view[3] = view[7] = view[11] = 0;
    view[12] = -dot(R, e);
    view[13] = -dot(U, e);
    view[14] = -dot(N, e);
    view[15] = 1;
    return true;
}

// ------------------------------------------------------------------ the thumbstick (as device/asspod/src/input/controllers.js)
struct Stick {
    v3 P, axis;
};
static const Stick STICK_R = {{-0.0218f, -0.0049f, 0.0564f}, {-0.173f, 0.807f, -0.565f}};
static const Stick STICK_L = {{0.0218f, -0.0049f, 0.0565f}, {0.168f, 0.797f, -0.581f}};

struct HandInput {
    std::string rm;
    vr::VRInputValueHandle_t path = 0;
    float x = 0, y = 0;
    bool clicked = false;
};

static void readStick(HandInput &h, const Stick &S) {
    h.x = h.y = 0;
    h.clicked = false;
    if (h.rm.empty() || !h.path || !vr::VRRenderModels()) return;
    vr::RenderModel_ComponentState_t cs{};
    vr::RenderModel_ControllerMode_State_t mode{};
    if (!vr::VRRenderModels()->GetComponentStateForDevicePath(h.rm.c_str(), "thumbstick", h.path, &mode, &cs)) return;
    Pose xf = fromVR(cs.mTrackingToComponentRenderModel);
    quat q = quatFrom(xf);
    if (q.w < 0) q = {-q.w, -q.x, -q.y, -q.z};
    v3 s = normalize(S.axis);
    auto proj = [&](v3 v) { return normalize(v - s * dot(v, s)); };
    v3 right = proj({1, 0, 0}), fwd = proj({0, 0, -1});
    v3 d = cross({q.x, q.y, q.z}, s);
    float x = dot(d, right) / 0.165f, y = dot(d, fwd) / 0.165f;
    float r = std::sqrt(x * x + y * y);
    if (r > 1) { x /= r; y /= r; }
    h.x = x;
    h.y = y;
    v3 rp = poseFrom(q, {}).rotate(S.P);
    v3 resid = xf.t - (S.P - rp);
    h.clicked = -dot(resid, s) > 0.00025f;
}

// ------------------------------------------------------------------ main
struct Spec {
    bool open = false;
    std::string hand = "right";
    quat rot;
    v3 centre;
    float scale = 1.375f;
    std::string finish = "black";
    bool world = false;   // pinned in the room (Reposition): wrot / wcentre in standing space
    quat wrot;
    v3 wcentre;
};

static bool readSpec(const std::string &path, Spec &s) {
    std::string t, err;
    if (!readFile(path, t)) return false;
    JVal j;
    JParser p(t);
    if (!p.parse(j, err)) return false;
    s.open = j.boolean("open", false);
    s.hand = j.str("hand", "right");
    s.scale = float(j.num("scale", 1.375));
    s.finish = j.str("finish", "black");
    const JVal *r = j.get("rot"), *c = j.get("centre");
    if (r && r->type == JVal::Arr && r->a.size() == 4) s.rot = qnorm({float(r->a[0].n), float(r->a[1].n), float(r->a[2].n), float(r->a[3].n)});
    if (c && c->type == JVal::Arr && c->a.size() == 3) s.centre = {float(c->a[0].n), float(c->a[1].n), float(c->a[2].n)};
    s.world = false;
    const JVal *w = j.get("world");
    if (w && w->type == JVal::Obj) {
        const JVal *wr = w->get("rot"), *wc = w->get("centre");
        if (wr && wr->type == JVal::Arr && wr->a.size() == 4 && wc && wc->type == JVal::Arr && wc->a.size() == 3) {
            s.world = true;
            s.wrot = qnorm({float(wr->a[0].n), float(wr->a[1].n), float(wr->a[2].n), float(wr->a[3].n)});
            s.wcentre = {float(wc->a[0].n), float(wc->a[1].n), float(wc->a[2].n)};
        }
    }
    return true;
}

int main(int argc, char **argv) {
    std::string specPath = "/dev/shm/lgs/podd.json", outPath = "/dev/shm/lgs/podd-out.json", modelDir, key = "podd.pod";
    float fps = 72;
    bool orphanOk = false;
    for (int i = 1; i < argc; i++) {
        std::string a = argv[i];
        auto next = [&]() -> std::string { return i + 1 < argc ? argv[++i] : ""; };
        if (a == "--spec") specPath = next();
        else if (a == "--out") outPath = next();
        else if (a == "--model") modelDir = next();
        else if (a == "--key") key = next();
        else if (a == "--fps") fps = std::stof(next());
        else if (a == "--orphan-ok") orphanOk = true;
        else { std::fprintf(stderr, "unknown option %s\n", a.c_str()); return 2; }
    }
    if (modelDir.empty()) { std::fprintf(stderr, "--model DIR is required\n"); return 2; }
    if (!orphanOk) prctl(PR_SET_PDEATHSIG, SIGTERM);
    signal(SIGTERM, onSignal);
    signal(SIGINT, onSignal);
    signal(SIGHUP, onSignal);
    setvbuf(stdout, nullptr, _IOLBF, 0);

    int lock = open((outPath + ".lock").c_str(), O_CREAT | O_RDWR | O_CLOEXEC, 0644);
    if (lock < 0 || flock(lock, LOCK_EX | LOCK_NB) != 0) { std::printf("another podd is running\n"); return 75; }

    vr::EVRInitError err = vr::VRInitError_None;
    vr::VR_Init(&err, vr::VRApplication_Overlay);
    if (err != vr::VRInitError_None) { std::printf("VR_Init: %s\n", vr::VR_GetVRInitErrorAsEnglishDescription(err)); return 75; }
    if (!vr::VROverlay() || !vr::VRSystem() || !vr::VRIPCResourceManager()) { std::printf("OpenVR interfaces missing\n"); return 1; }

    Gfx gfx;
    if (!gfx.init()) return 1;
    std::printf("podd: %s\n", gfx.renderer.c_str());

    Program prog;
    if (!linkProgram(prog, VS, FS, "pod")) return 1;

    // the parts (both finishes' plates, wheels and buttons are loaded; the spec picks)
    struct Part { std::string name; int mat; v3 base; Mesh mesh; GLuint tex = 0; bool wheel = false, center = false; };
    std::vector<Part> parts = {
        {"asspod_steel_back", 2, {0.9f, 0.9f, 0.9f}},
        {"asspod_steel_edge", 1, {0.9f, 0.9f, 0.9f}},
        {"asspod_ports", 5, {0.03f, 0.03f, 0.035f}},
        {"asspod_plate_black", 0, {0.004f, 0.004f, 0.0045f}},
        {"asspod_plate_white", 0, {0.86f, 0.86f, 0.84f}},
        {"asspod_well_black", 4, {0.002f, 0.002f, 0.002f}},
        {"asspod_well_white", 4, {0.25f, 0.25f, 0.24f}},
        {"asspod_wheel_black", 3, {1, 1, 1}},
        {"asspod_wheel_white", 3, {1, 1, 1}},
        {"asspod_center_black", 0, {0.004f, 0.004f, 0.0045f}},
        {"asspod_center_white", 0, {0.86f, 0.86f, 0.84f}},
    };
    for (auto &p : parts) {
        std::string dir = modelDir + "/" + p.name + "/";
        if (!loadObj(dir + p.name + ".obj", p.mesh)) { std::printf("cannot load %s\n", p.name.c_str()); return 1; }
        if (p.mat == 3) p.tex = loadRgba(dir + p.name + "_color.rgba");
        if (p.mat == 2) p.tex = loadRgba(dir + p.name + "_mask.rgba");
        p.wheel = p.name.find("wheel") != std::string::npos;
        p.center = p.name.find("center") != std::string::npos;
    }
    // the window: a quad over the plate's opening (border + transparent LCD), in model metres
    Mesh window;
    {
        const float z = FRONT_Z + 0.00008f, hw = WIN_W / 2, hh = WIN_H / 2, cy = LCD_CY;
        const float q[] = {-hw, cy - hh, z, 0, 0, 1, 0, 0, hw, cy - hh, z, 0, 0, 1, 1, 0, hw, cy + hh, z, 0, 0, 1, 1, 1,
                           -hw, cy - hh, z, 0, 0, 1, 0, 0, hw, cy + hh, z, 0, 0, 1, 1, 1, -hw, cy + hh, z, 0, 0, 1, 0, 1};
        glGenVertexArrays(1, &window.vao);
        glGenBuffers(1, &window.vbo);
        glBindVertexArray(window.vao);
        glBindBuffer(GL_ARRAY_BUFFER, window.vbo);
        glBufferData(GL_ARRAY_BUFFER, sizeof q, q, GL_STATIC_DRAW);
        for (int i = 0; i < 3; i++) glEnableVertexAttribArray(GLuint(i));
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 32, reinterpret_cast<void *>(0));
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 32, reinterpret_cast<void *>(12));
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 32, reinterpret_cast<void *>(24));
        glBindVertexArray(0);
        window.count = 6;
    }
    (void)LCD_W; (void)LCD_H; (void)WHEEL_R; (void)WHEEL_RC; (void)WHEEL_RM;

    Spec spec;
    struct stat lastSt{};
    Layout L = makeLayout(spec.scale);
    float layoutScale = -1;

    vr::VROverlayHandle_t ov = vr::k_ulOverlayHandleInvalid;
    if (vr::VROverlay()->CreateOverlay(key.c_str(), "assPod", &ov) != vr::VROverlayError_None) {
        std::printf("CreateOverlay(%s) failed\n", key.c_str());
        return 75;
    }
    vr::VROverlay()->SetOverlayFlag(ov, vr::VROverlayFlags_IsPremultiplied, true);
    vr::VROverlay()->SetOverlayWidthInMeters(ov, 1.0f);

    std::array<DmaTarget, 3> bufs;
    GLuint depthRb = 0, msColor = 0, msFbo = 0;   // 4x MSAA, resolved into the dmabuf SteamVR reads
    GLint samples = 4;
    int cur = 0;
    bool mouseSet = false;
    auto release = [&]() {
        for (auto &b : bufs) {
            if (b.vrHandle) vr::VRIPCResourceManager()->UnrefResource(vr::SharedTextureHandle_t(b.vrHandle));
            if (b.bo) b.destroy(gfx);
        }
        if (depthRb) { glDeleteRenderbuffers(1, &depthRb); depthRb = 0; }
        if (msColor) { glDeleteRenderbuffers(1, &msColor); msColor = 0; }
        if (msFbo) { glDeleteFramebuffers(1, &msFbo); msFbo = 0; }
    };
    auto allocate = [&]() -> bool {
        release();
        for (auto &b : bufs) {
            if (!b.create(gfx, L.texW, L.texH)) return false;
            vr::DmabufAttributes_t a{};
            a.unWidth = uint32_t(L.texW);
            a.unHeight = uint32_t(L.texH);
            a.unDepth = a.unMipLevels = a.unArrayLayers = a.unSampleCount = 1;
            a.unFormat = GBM_FORMAT_ABGR8888;
            a.ulModifier = DRM_FORMAT_MOD_LINEAR;
            a.unPlaneCount = 1;
            a.plane[0].unOffset = b.offset;
            a.plane[0].unStride = b.stride;
            a.plane[0].nFd = b.fd;
            vr::SharedTextureHandle_t h = 0;
            if (!vr::VRIPCResourceManager()->ImportDmabuf(vr::VRApplication_Overlay, &a, &h) || !h) {
                std::printf("ImportDmabuf failed\n");
                return false;
            }
            b.vrHandle = h;
        }
        GLint maxS = 0;
        glGetIntegerv(GL_MAX_SAMPLES, &maxS);
        samples = std::min<GLint>(4, std::max<GLint>(1, maxS));
        glGenRenderbuffers(1, &msColor);
        glBindRenderbuffer(GL_RENDERBUFFER, msColor);
        glRenderbufferStorageMultisample(GL_RENDERBUFFER, samples, GL_RGBA8, L.texW, L.texH);
        glGenRenderbuffers(1, &depthRb);
        glBindRenderbuffer(GL_RENDERBUFFER, depthRb);
        glRenderbufferStorageMultisample(GL_RENDERBUFFER, samples, GL_DEPTH_COMPONENT24, L.texW, L.texH);
        glGenFramebuffers(1, &msFbo);
        glBindFramebuffer(GL_FRAMEBUFFER, msFbo);
        glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, msColor);
        glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, depthRb);
        if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) { std::printf("MSAA framebuffer incomplete\n"); return false; }
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        std::printf("MSAA x%d\n", samples);
        mouseSet = false;
        return true;
    };

    auto writeOut = [&](bool ok, long frames, float fpsNow, float ms) {
        std::string o = "{\"pid\": " + std::to_string(getpid()) + ", \"ok\": " + (ok ? "true" : "false") + ", \"key\": \"" + key +
                        "\", \"texW\": " + std::to_string(L.texW) + ", \"texH\": " + std::to_string(L.texH) + ", \"pad\": " + std::to_string(PAD) + ", \"box\": [" +
                        std::to_string(L.hx) + ", " + std::to_string(L.hy) + ", " + std::to_string(L.hz) + "], \"tiles\": {";
        for (size_t i = 0; i < L.f.size(); i++) {
            const Face &F = L.f[i];
            o += std::string(i ? ", " : "") + "\"" + F.name + "\": [" + std::to_string(F.tx) + ", " + std::to_string(F.ty) + ", " +
                 std::to_string(F.tw) + ", " + std::to_string(F.th) + "]";
        }
        o += "}, \"video\": [" + std::to_string(L.vx) + ", " + std::to_string(L.vy) + ", " + std::to_string(VIDEO_W) + ", " +
             std::to_string(VIDEO_H) + "]";
        o += ", \"frames\": " + std::to_string(frames) + ", \"fps\": " + std::to_string(fpsNow) + ", \"cpu_ms\": " + std::to_string(ms) +
             ", \"updated\": " + std::to_string(double(time(nullptr))) + "}\n";
        writeAtomic(outPath, o);
    };

    // the video's picture: a texture the frames go into, and a framebuffer to copy it into its tile
    GLuint videoTex = 0, videoFbo = 0;
    long videoFrames = 0;
    struct stat videoSt{};
    {
        glGenTextures(1, &videoTex);
        glBindTexture(GL_TEXTURE_2D, videoTex);
        glTexStorage2D(GL_TEXTURE_2D, 1, GL_RGBA8, VIDEO_W, VIDEO_H);
        std::vector<uint8_t> black(size_t(VIDEO_W) * VIDEO_H * 4, 0);
        for (size_t i = 3; i < black.size(); i += 4) black[i] = 255;
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, VIDEO_W, VIDEO_H, GL_RGBA, GL_UNSIGNED_BYTE, black.data());
        glGenFramebuffers(1, &videoFbo);
        glBindFramebuffer(GL_FRAMEBUFFER, videoFbo);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, videoTex, 0);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
    }
    (void)videoFrames;

    HandInput handIn[2];
    vr::VRInputValueHandle_t pathR = 0, pathL = 0;
    if (vr::VRInput()) {
        vr::VRInput()->GetInputSourceHandle("/user/hand/right", &pathR);
        vr::VRInput()->GetInputSourceHandle("/user/hand/left", &pathL);
    }
    handIn[0].path = pathL;
    handIn[1].path = pathR;
    float marker = 0, markerAngle = 0, sink = 0, rock = 0, rockAngle = 0;

    long frames = 0;
    uint64_t lastOut = 0, fpsT0 = nowNs();
    long fpsFrames = 0;
    float fpsNow = 0, cpuMs = 0;
    const uint64_t frameNs = uint64_t(1e9 / std::max(10.f, fps));
    uint64_t lastFrameNs = nowNs();
    std::printf("podd: ready (%s)\n", key.c_str());

    while (!g_stop) {
        vr::VREvent_t ev;
        while (vr::VRSystem()->PollNextEvent(&ev, sizeof ev)) {
            if (ev.eventType == vr::VREvent_Quit) { g_stop = 1; break; }
        }
        if (!orphanOk && getppid() == 1) break;
        // the spec, when it changed
        struct stat st{};
        if (stat(specPath.c_str(), &st) == 0 && (st.st_mtim.tv_sec != lastSt.st_mtim.tv_sec || st.st_mtim.tv_nsec != lastSt.st_mtim.tv_nsec)) {
            lastSt = st;
            readSpec(specPath, spec);
        }
        if (std::fabs(spec.scale - layoutScale) > 1e-5f) {
            L = makeLayout(spec.scale);
            layoutScale = spec.scale;
            if (!allocate()) { std::printf("cannot allocate %dx%d\n", L.texW, L.texH); return 1; }
            writeOut(true, frames, 0, 0);
            std::printf("layout %dx%d (scale %.3f)\n", L.texW, L.texH, double(spec.scale));
        }
        const bool visible = spec.open && vr::VROverlay()->IsDashboardVisible();
        const uint64_t t0 = nowNs();
        if (!visible) {
            if (t0 - lastOut > 2000000000ull) { writeOut(true, frames, 0, cpuMs); lastOut = t0; }
            struct timespec ts = {0, 50000000};
            nanosleep(&ts, nullptr);
            continue;
        }
        // poses at the time these pixels reach the eyes
        float sinceVsync = 0;
        uint64_t frameCounter = 0;
        vr::VRSystem()->GetTimeSinceLastVsync(&sinceVsync, &frameCounter);
        float hz = vr::VRSystem()->GetFloatTrackedDeviceProperty(vr::k_unTrackedDeviceIndex_Hmd, vr::Prop_DisplayFrequency_Float);
        float toPhotons = vr::VRSystem()->GetFloatTrackedDeviceProperty(vr::k_unTrackedDeviceIndex_Hmd, vr::Prop_SecondsFromVsyncToPhotons_Float);
        float frameS = hz > 1 ? 1.f / hz : 1.f / 90.f;
        float predict = frameS * 2 - sinceVsync + toPhotons;
        vr::TrackedDevicePose_t poses[vr::k_unMaxTrackedDeviceCount];
        vr::VRSystem()->GetDeviceToAbsoluteTrackingPose(vr::TrackingUniverseStanding, predict, poses, vr::k_unMaxTrackedDeviceCount);
        const vr::ETrackedControllerRole role = spec.hand == "left" ? vr::TrackedControllerRole_LeftHand : vr::TrackedControllerRole_RightHand;
        const vr::TrackedDeviceIndex_t hi = vr::VRSystem()->GetTrackedDeviceIndexForControllerRole(role);
        if (hi == vr::k_unTrackedDeviceIndexInvalid || !poses[hi].bPoseIsValid || !poses[0].bPoseIsValid) {
            struct timespec ts = {0, 10000000};
            nanosleep(&ts, nullptr);
            continue;
        }
        const Pose hmd = fromVR(poses[0].mDeviceToAbsoluteTracking);
        const Pose hand = fromVR(poses[hi].mDeviceToAbsoluteTracking);
        const Pose body = spec.world ? poseFrom(spec.wrot, spec.wcentre) : hand * poseFrom(spec.rot, spec.centre);
        const Pose toBody = body.inverse();

        // the wheel: marker and press motion from both sticks (the one tilted further)
        for (int k = 0; k < 2; k++) {
            HandInput &h = handIn[k];
            if (h.rm.empty()) {
                vr::TrackedDeviceIndex_t di = vr::VRSystem()->GetTrackedDeviceIndexForControllerRole(
                    k ? vr::TrackedControllerRole_RightHand : vr::TrackedControllerRole_LeftHand);
                if (di != vr::k_unTrackedDeviceIndexInvalid) {
                    char buf[256] = {};
                    vr::VRSystem()->GetStringTrackedDeviceProperty(di, vr::Prop_RenderModelName_String, buf, sizeof buf);
                    h.rm = buf;
                }
            }
            readStick(h, k ? STICK_R : STICK_L);
        }
        const HandInput &src = std::hypot(handIn[1].x, handIn[1].y) >= std::hypot(handIn[0].x, handIn[0].y) ? handIn[1] : handIn[0];
        const float rad = std::hypot(src.x, src.y);
        const bool touching = rad >= 0.45f;
        if (rad >= 0.3f) markerAngle = std::atan2(src.x, src.y);
        const float dt = float(double(t0 - lastFrameNs) / 1e9);
        lastFrameNs = t0;
        marker += ((touching ? 1.f : 0.f) - marker) * std::min(1.f, dt / (touching ? 0.06f : 0.15f));
        const bool clicked = handIn[0].clicked || handIn[1].clicked;
        const bool centred = rad < 0.45f;
        sink += (((clicked && centred) ? 1.f : 0.f) - sink) * std::min(1.f, dt / 0.05f);
        rock += (((clicked && !centred) ? 1.f : 0.f) - rock) * std::min(1.f, dt / 0.05f);
        if (clicked && !centred) rockAngle = std::round(markerAngle / (kPi / 2)) * (kPi / 2);

        // render: every face, both eyes
        DmaTarget &B = bufs[size_t(cur)];
        glBindFramebuffer(GL_FRAMEBUFFER, msFbo);
        glViewport(0, 0, L.texW, L.texH);
        glDisable(GL_SCISSOR_TEST);
        glClearColor(0, 0, 0, 0);
        glClearDepthf(1);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glEnable(GL_DEPTH_TEST);
        glDisable(GL_CULL_FACE);
        glDisable(GL_BLEND);
        prog.use();
        prog.set("uScale", spec.scale);
        prog.set("uTex", 0);
        float toWorld[9];
        for (int i = 0; i < 3; i++)
            for (int j = 0; j < 3; j++) toWorld[j * 3 + i] = body.r[i][j];   // column-major
        glUniformMatrix3fv(prog.loc("uToWorld"), 1, GL_FALSE, toWorld);
        prog.set("uMarker", markerAngle, marker, 0.f, 0.f);
        const bool white = spec.finish == "white";
        for (int eye = 0; eye < 2; eye++) {
            const Pose e2h = fromVR(vr::VRSystem()->GetEyeToHeadTransform(eye ? vr::Eye_Right : vr::Eye_Left));
            const v3 eyeW = (hmd * e2h).t;
            const v3 eyeB = toBody.apply(eyeW);
            prog.set("uEye", eyeB.x, eyeB.y, eyeB.z);
            for (const Face &F : L.f) {
                float P[16], V[16];
                // the face grown by PAD px on every side (the panel shows it all)
                Face G = F;
                G.w = F.w * float(F.tw + 2 * PAD) / float(F.tw);
                G.h = F.h * float(F.th + 2 * PAD) / float(F.th);
                if (!faceMatrices(G, eyeB, P, V)) continue;
                const int x = F.tx - PAD + eye * (F.tw + 2 * PAD);
                const int y = F.ty - PAD, vw = F.tw + 2 * PAD, vh = F.th + 2 * PAD;
                // GL rows count from the buffer's first row (the texture's top)
                glViewport(x, y, vw, vh);
                glEnable(GL_SCISSOR_TEST);
                glScissor(x, y, vw, vh);
                prog.mat4("uProj", P);
                prog.mat4("uView", V);
                for (auto &p : parts) {
                    const bool isWhite = p.name.find("_white") != std::string::npos, isBlack = p.name.find("_black") != std::string::npos;
                    if ((isWhite && !white) || (isBlack && white)) continue;
                    Pose m;   // the part's own motion, about the wheel's centre (model metres)
                    if (p.center) m.t = {0, 0, -0.0005f * sink};
                    if (p.wheel && rock > 0.001f) {
                        const float ang = -2.5f * kPi / 180 * rock;
                        const v3 axis = normalize(v3{std::cos(rockAngle), -std::sin(rockAngle), 0});
                        Pose R = poseFrom(qnorm({std::cos(ang / 2), axis.x * std::sin(ang / 2), axis.y * std::sin(ang / 2), 0}), {});
                        const v3 pivot = {0, WHEEL_CY, FRONT_Z};
                        R.t = pivot - R.rotate(pivot);
                        m = R;
                    }
                    float M[16];
                    m.toGL(M);
                    prog.mat4("uModel", M);
                    prog.set("uMat", p.mat);
                    prog.set("uBase", p.base.x, p.base.y, p.base.z);
                    glActiveTexture(GL_TEXTURE0);
                    glBindTexture(GL_TEXTURE_2D, p.tex);
                    glBindVertexArray(p.mesh.vao);
                    glDrawArrays(GL_TRIANGLES, 0, p.mesh.count);
                }
                // the window last: it replaces what lies behind it (the screen panel shows through the LCD)
                Pose id;
                float M[16];
                id.toGL(M);
                prog.mat4("uModel", M);
                prog.set("uMat", 6);
                glBindVertexArray(window.vao);
                glDrawArrays(GL_TRIANGLES, 0, window.count);
            }
        }
        glDisable(GL_SCISSOR_TEST);
        glBindVertexArray(0);
        // resolve the samples into the buffer SteamVR reads
        glBindFramebuffer(GL_READ_FRAMEBUFFER, msFbo);
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, B.fbo);
        glBlitFramebuffer(0, 0, L.texW, L.texH, 0, 0, L.texW, L.texH, GL_COLOR_BUFFER_BIT, GL_NEAREST);
        // the video's latest frame, when there is a new one, into its tile (rows top first both ways)
        {
            struct stat vs{};
            if (stat(VIDEO_FILE, &vs) == 0 && (vs.st_mtim.tv_sec != videoSt.st_mtim.tv_sec || vs.st_mtim.tv_nsec != videoSt.st_mtim.tv_nsec)) {
                videoSt = vs;
                std::string d;
                uint32_t vw = 0, vh = 0;
                if (readFile(VIDEO_FILE, d) && d.size() >= 16 && d.compare(0, 4, "PVID") == 0) {
                    std::memcpy(&vw, d.data() + 8, 4);
                    std::memcpy(&vh, d.data() + 12, 4);
                    if (int(vw) == VIDEO_W && int(vh) == VIDEO_H && d.size() >= 16 + size_t(vw) * vh * 4) {
                        glBindTexture(GL_TEXTURE_2D, videoTex);
                        glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
                        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, VIDEO_W, VIDEO_H, GL_RGBA, GL_UNSIGNED_BYTE, d.data() + 16);
                        videoFrames++;
                    }
                }
            }
            glBindFramebuffer(GL_READ_FRAMEBUFFER, videoFbo);
            glBindFramebuffer(GL_DRAW_FRAMEBUFFER, B.fbo);
            for (int eye = 0; eye < 2; eye++) {
                const int x0 = L.vx + eye * VIDEO_W;
                glBlitFramebuffer(0, 0, VIDEO_W, VIDEO_H, x0, L.vy, x0 + VIDEO_W, L.vy + VIDEO_H, GL_COLOR_BUFFER_BIT, GL_NEAREST);
            }
        }
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glFinish();   // SteamVR samples the dmabuf from another process
        vr::SharedTextureHandle_t h = vr::SharedTextureHandle_t(B.vrHandle);
        vr::Texture_t tex = {&h, vr::TextureType_SharedTextureHandle, vr::ColorSpace_Gamma};
        auto e = vr::VROverlay()->SetOverlayTexture(ov, &tex);
        if (e != vr::VROverlayError_None) std::printf("SetOverlayTexture: %s\n", vr::VROverlay()->GetOverlayErrorNameFromEnum(e));
        if (!mouseSet) {
            vr::HmdVector2_t mouse = {float(L.texW / 2), float(L.texH)};   // one eye's width: Parallel stereo
            vr::VROverlay()->SetOverlayMouseScale(ov, &mouse);
            mouseSet = true;
        }
        cur = (cur + 1) % int(bufs.size());
        frames++;
        fpsFrames++;
        const uint64_t t1 = nowNs();
        cpuMs = cpuMs * 0.9f + float(double(t1 - t0) / 1e6) * 0.1f;
        if (t1 - fpsT0 > 1000000000ull) {
            fpsNow = float(fpsFrames * 1e9 / double(t1 - fpsT0));
            fpsFrames = 0;
            fpsT0 = t1;
        }
        if (t1 - lastOut > 1000000000ull) { writeOut(true, frames, fpsNow, cpuMs); lastOut = t1; }
        if (t1 - t0 < frameNs) {
            uint64_t left = frameNs - (t1 - t0);
            struct timespec ts = {time_t(left / 1000000000ull), long(left % 1000000000ull)};
            nanosleep(&ts, nullptr);
        }
    }
    std::printf("podd: stopping\n");
    if (ov != vr::k_ulOverlayHandleInvalid) vr::VROverlay()->DestroyOverlay(ov);
    release();
    writeOut(false, frames, 0, 0);
    vr::VR_Shutdown();
    gfx.shutdown();
    return 0;
}
