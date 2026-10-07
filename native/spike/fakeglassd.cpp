// fakeglassd: a stand-in for native/glassd, so the whole native chain
// (lgs_layers.js -> lgs_shell.py -> glassd.json -> overlays -> glassd-out.json
// -> __LGS_SG spec -> systemui scene-graph nodes) can be exercised before the
// real renderer exists. It follows the docs/NATIVE.md interfaces exactly:
//
//   reads  /dev/shm/lgs/glassd.json      (re-read on change)
//   writes /dev/shm/lgs/glassd-out.json  (after each layout change)
//   publishes one dmabuf overlay "glassd.<surface>" per surface, never shown
//   (the scene graph references it by key), SetOverlayMouseScale(texW, texH)
//
// Instead of room glass it paints a static frosted gradient (CPU, gbm_bo_map)
// for each backdrop and translucent rounded slabs in an atlas underneath.
//
//   ./fakeglassd [--scale 0.75] [--dump DIR] [--seconds N] [--in PATH] [--out PATH] [--key-prefix P]
//
// --dump writes DIR/fakeglassd-<surface>.png after every layout change, so
// the textures can be checked without the headset.
//
// glassd.json v3 (docs/phase2/contracts/glassd.md): it accepts every v3 field.
// Cover shapes are painted as their union; plates as flat frosted rounded
// rects over it (occluder x.55, "dim" dark, tint and fill mixed in); holes as
// a dark rect (their fill, else the mean of their edge tones, else black .35)
// inside the crop rect on the cover; tinted slabs take their colour; "none"
// slabs leave their cell empty. The output carries version 3, caps (with
// glassd's "holeEdges"), cover, plates, droppedPlates (the first 32) and counts.
#include <gbm.h>
#include <openvr.h>

#include <fcntl.h>
#include <signal.h>
#include <sys/stat.h>
#include <unistd.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <map>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

#ifndef DRM_FORMAT_MOD_LINEAR
#define DRM_FORMAT_MOD_LINEAR 0ULL
#endif

// ---------------------------------------------------------------- tiny JSON
struct J {
    enum T { Null, Bool, Num, Str, Arr, Obj } t = Null;
    bool b = false;
    double n = 0;
    std::string s;
    std::vector<J> a;
    std::vector<std::pair<std::string, J>> o;
    const J &operator[](const char *k) const {
        static const J nil;
        for (const auto &p : o)
            if (p.first == k) return p.second;
        return nil;
    }
    double num(double d = 0) const { return t == Num ? n : d; }
    std::string str(const char *d = "") const { return t == Str ? s : std::string(d); }
    bool truthy(bool d) const { return t == Bool ? b : d; }
};

struct Parser {
    const char *p, *e;
    bool ok = true;
    void ws() {
        while (p < e && (*p == ' ' || *p == '\n' || *p == '\r' || *p == '\t')) p++;
    }
    bool lit(const char *w) {
        size_t n = std::strlen(w);
        if (size_t(e - p) >= n && std::strncmp(p, w, n) == 0) { p += n; return true; }
        return false;
    }
    std::string str() {
        std::string out;
        if (p >= e || *p != '"') { ok = false; return out; }
        p++;
        while (p < e && *p != '"') {
            char c = *p++;
            if (c == '\\' && p < e) {
                char x = *p++;
                switch (x) {
                case 'n': out += '\n'; break;
                case 't': out += '\t'; break;
                case 'r': out += '\r'; break;
                case 'b': out += '\b'; break;
                case 'f': out += '\f'; break;
                case 'u': {
                    unsigned cp = 0;
                    for (int i = 0; i < 4 && p < e; i++) {
                        char h = *p++;
                        cp = cp * 16 + unsigned(h >= 'a' ? h - 'a' + 10 : h >= 'A' ? h - 'A' + 10 : h - '0');
                    }
                    if (cp < 0x80) out += char(cp);
                    else if (cp < 0x800) { out += char(0xC0 | (cp >> 6)); out += char(0x80 | (cp & 63)); }
                    else { out += char(0xE0 | (cp >> 12)); out += char(0x80 | ((cp >> 6) & 63)); out += char(0x80 | (cp & 63)); }
                    break;
                }
                default: out += x;
                }
            } else {
                out += c;
            }
        }
        if (p < e) p++; else ok = false;
        return out;
    }
    J val() {
        J v;
        ws();
        if (p >= e) { ok = false; return v; }
        if (*p == '{') {
            v.t = J::Obj;
            p++;
            ws();
            if (p < e && *p == '}') { p++; return v; }
            while (ok) {
                ws();
                std::string k = str();
                ws();
                if (p >= e || *p != ':') { ok = false; break; }
                p++;
                J x = val();
                v.o.emplace_back(std::move(k), std::move(x));
                ws();
                if (p < e && *p == ',') { p++; continue; }
                if (p < e && *p == '}') { p++; break; }
                ok = false;
            }
        } else if (*p == '[') {
            v.t = J::Arr;
            p++;
            ws();
            if (p < e && *p == ']') { p++; return v; }
            while (ok) {
                v.a.push_back(val());
                ws();
                if (p < e && *p == ',') { p++; continue; }
                if (p < e && *p == ']') { p++; break; }
                ok = false;
            }
        } else if (*p == '"') {
            v.t = J::Str;
            v.s = str();
        } else if (lit("true")) {
            v.t = J::Bool; v.b = true;
        } else if (lit("false")) {
            v.t = J::Bool; v.b = false;
        } else if (lit("null")) {
            v.t = J::Null;
        } else {
            char *end = nullptr;
            v.t = J::Num;
            v.n = std::strtod(p, &end);
            if (end == p) ok = false;
            p = end;
        }
        return v;
    }
};

static bool ParseJson(const std::string &text, J &out) {
    Parser ps{text.data(), text.data() + text.size()};
    out = ps.val();
    return ps.ok;
}

static std::string Esc(const std::string &s) {
    std::string o;
    for (char c : s) {
        if (c == '"' || c == '\\') { o += '\\'; o += c; }
        else if (static_cast<unsigned char>(c) < 0x20) o += ' ';
        else o += c;
    }
    return o;
}

static inline float Clamp01(float v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// ---------------------------------------------------------------- surfaces
// v3 colour: [r, g, b(, a)] 0..1, "#rrggbb(aa)", "rgb(r g b / a)", "rgba(r, g, b, a)", named tones.
struct Col {
    bool set = false;
    float r = 0, g = 0, b = 0, a = 1;
};
static Col ParseCol(const J &v) {
    Col c;
    float ch[4] = {0, 0, 0, 1};
    if (v.t == J::Arr && (v.a.size() == 3 || v.a.size() == 4)) {
        for (size_t i = 0; i < v.a.size(); i++) ch[i] = float(v.a[i].num());
    } else if (v.t == J::Str) {
        const std::string &t = v.s;
        if (t == "green") { ch[0] = 48 / 255.f; ch[1] = 209 / 255.f; ch[2] = 88 / 255.f; }
        else if (t == "blue") { ch[0] = 0; ch[1] = 145 / 255.f; ch[2] = 1; }
        else if (t == "red") { ch[0] = 1; ch[1] = 66 / 255.f; ch[2] = 69 / 255.f; }
        else if (t == "scrim") { ch[3] = 0.35f; }
        else if (!t.empty() && t[0] == '#' && (t.size() == 7 || t.size() == 9)) {
            for (size_t i = 0; i < (t.size() - 1) / 2; i++) ch[i] = float(std::strtoul(t.substr(1 + i * 2, 2).c_str(), nullptr, 16)) / 255.f;
        } else if (t.rfind("rgb", 0) == 0 && t.find('(') != std::string::npos) {
            std::string body = t.substr(t.find('(') + 1);
            for (char &k : body)
                if (k == ',' || k == '/' || k == ')') k = ' ';
            const char *q = body.c_str();
            int n = 0;
            while (n < 4) {
                char *end = nullptr;
                float f = std::strtof(q, &end);
                if (end == q) break;
                bool pct = *end == '%';
                ch[n] = n < 3 ? (pct ? f / 100.f : f / 255.f) : (pct ? f / 100.f : f);
                q = end + (pct ? 1 : 0);
                n++;
            }
            if (n < 3) return c;
        } else {
            return c;
        }
    } else {
        return c;
    }
    c.set = true;
    c.r = Clamp01(ch[0]);
    c.g = Clamp01(ch[1]);
    c.b = Clamp01(ch[2]);
    c.a = Clamp01(ch[3]);
    return c;
}

struct Rect {
    float x = 0, y = 0, w = 0, h = 0, r = 0;  // Steam px
};
struct Plate {
    std::string id, material;
    Rect rc;
    Col tint, fill;
    bool occluder = false;
};
struct Slab {
    std::string id, material;
    int w = 0, h = 0, r = 0;      // Steam px
    int x = 0, y = 0, pw = 0, ph = 0;   // atlas rect, glassd px
    float ex = 0, ey = 0;         // element position (Steam px)
    Col tint;
    Col fill;                     // "dim" slab tone (v3 G7)
    bool hole = false;
    Col holeFill;
    float cx0 = 0, cy0 = 0, cx1 = 0, cy1 = 0;  // hole clip (Steam px)
};

struct Tex {
    gbm_bo *bo = nullptr;
    int fd = -1;
    vr::SharedTextureHandle_t h = 0;
    std::chrono::steady_clock::time_point retired;
};

struct Surface {
    std::string name, overlayKey, material;
    int texW = 0, texH = 0, radius = 0;
    bool visible = true;
    int bw = 0, bh = 0, W = 0, H = 0;
    std::vector<Rect> shapes;           // the cover: their union (v2 rules for absent / empty)
    std::vector<Plate> plates;          // v3, at most 32
    std::vector<std::string> droppedPlates;
    size_t droppedN = 0;  // all dropped plates (the list holds the first 32)
    std::vector<Slab> slabs;
    std::string sig;
    vr::VROverlayHandle_t ov = vr::k_ulOverlayHandleInvalid;
    Tex tex;
};

static volatile sig_atomic_t g_quit = 0;
static void OnSignal(int) { g_quit = 1; }

static gbm_device *g_gbm = nullptr;
static std::vector<Tex> g_retired;
static float g_scale = 0.75f;
static std::string g_dump;
static std::string g_prefix = "glassd.";  // --key-prefix (tests next to a live daemon)

static void Release(Tex &t) {
    if (t.h) vr::VRIPCResourceManager()->UnrefResource(t.h);
    if (t.fd >= 0) close(t.fd);
    if (t.bo) gbm_bo_destroy(t.bo);
    t = Tex{};
}

// Signed distance to a rounded rect centred at (cx,cy), half size (hx,hy), radius r.
static inline float RRect(float px, float py, float cx, float cy, float hx, float hy, float r) {
    float qx = std::fabs(px - cx) - hx + r, qy = std::fabs(py - cy) - hy + r;
    float ox = std::max(qx, 0.f), oy = std::max(qy, 0.f);
    return std::sqrt(ox * ox + oy * oy) + std::min(std::max(qx, qy), 0.f) - r;
}

static inline float Hash(int x, int y) {
    unsigned h = unsigned(x) * 374761393u + unsigned(y) * 668265263u;
    h = (h ^ (h >> 13)) * 1274126177u;
    return float((h ^ (h >> 16)) & 0xffff) / 65535.f;
}

// Paint premultiplied RGBA into an R,G,B,A byte buffer (W x H, row stride in bytes).
static void Paint(const Surface &s, uint8_t *px, uint32_t stride) {
    for (int y = 0; y < s.H; y++) std::memset(px + size_t(y) * stride, 0, size_t(s.W) * 4);
    auto put = [&](int x, int y, float r, float g, float b, float a) {
        uint8_t *p = px + size_t(y) * stride + size_t(x) * 4;
        p[0] = uint8_t(Clamp01(r * a) * 255.f + 0.5f);
        p[1] = uint8_t(Clamp01(g * a) * 255.f + 0.5f);
        p[2] = uint8_t(Clamp01(b * a) * 255.f + 0.5f);
        p[3] = uint8_t(Clamp01(a) * 255.f + 0.5f);
    };
    // backdrop: opaque "frosted" window glass inside the union of the cover shapes
    auto coverD = [&](float px_, float py_) {
        float d = 1e9f;
        for (const Rect &q : s.shapes) {
            const float rad = std::min(q.r, std::min(q.w, q.h) * 0.5f) * g_scale;
            d = std::min(d, RRect(px_, py_, (q.x + q.w * 0.5f) * g_scale, (q.y + q.h * 0.5f) * g_scale, q.w * 0.5f * g_scale,
                                  q.h * 0.5f * g_scale, rad));
        }
        return d;
    };
    for (int y = 0; y < s.bh && !s.shapes.empty(); y++)
        for (int x = 0; x < s.bw; x++) {
            const float d = coverD(x + 0.5f, y + 0.5f);
            const float a = Clamp01(0.5f - d);
            if (a <= 0) continue;
            const float u = float(x) / s.bw, v = float(y) / s.bh;
            // soft blobs as if a blurred room were behind the glass
            const float b1 = std::exp(-((u - 0.25f) * (u - 0.25f) + (v - 0.35f) * (v - 0.35f)) * 6.f);
            const float b2 = std::exp(-((u - 0.78f) * (u - 0.78f) + (v - 0.7f) * (v - 0.7f)) * 5.f);
            float r = 0.20f + 0.10f * (1 - v) + 0.16f * b1 + 0.05f * b2;
            float g = 0.23f + 0.10f * (1 - v) + 0.12f * b1 + 0.10f * b2;
            float b = 0.30f + 0.12f * (1 - v) + 0.06f * b1 + 0.16f * b2;
            const float n = (Hash(x, y) - 0.5f) * 0.012f;
            // rim: bright key light along the top, weaker elsewhere
            const float rim = Clamp01(1.f - (-d) / 2.5f);
            const float key = rim * (v < 0.5f ? 0.55f : 0.18f);
            put(x, y, r + n + key, g + n + key, b + n + key, a);
        }
    // v3 plates over the cover: flat frosted rounded rects ("over", premultiplied)
    auto over = [&](int x, int y, float r, float g, float b, float a) {
        uint8_t *p = px + size_t(y) * stride + size_t(x) * 4;
        for (int c = 0; c < 3; c++) {
            const float src = (c == 0 ? r : c == 1 ? g : b) * a;
            p[c] = uint8_t(Clamp01(src + p[c] / 255.f * (1 - a)) * 255.f + 0.5f);
        }
        p[3] = uint8_t(Clamp01(a + p[3] / 255.f * (1 - a)) * 255.f + 0.5f);
    };
    for (const Plate &pl : s.plates) {
        const float x0 = pl.rc.x * g_scale, y0 = pl.rc.y * g_scale, pw = pl.rc.w * g_scale, ph = pl.rc.h * g_scale;
        const float rad = std::min(pl.rc.r * g_scale, std::min(pw, ph) * 0.5f);
        const bool dim = pl.material == "dim";
        float base = pl.material == "thick" ? 0.26f : pl.material == "panel" ? 0.30f : pl.material == "window" ? 0.24f : 0.40f;
        for (int y = std::max(0, int(y0)); y < std::min(s.bh, int(std::ceil(y0 + ph))); y++)
            for (int x = std::max(0, int(x0)); x < std::min(s.bw, int(std::ceil(x0 + pw))); x++) {
                const float d = RRect(x + 0.5f, y + 0.5f, x0 + pw * 0.5f, y0 + ph * 0.5f, pw * 0.5f, ph * 0.5f, rad);
                const float cov = Clamp01(0.5f - d);
                if (cov <= 0) continue;
                if (dim) {
                    const float fa = (pl.fill.set ? pl.fill.a : 0.30f) * Clamp01(-d / (8.f * g_scale));
                    over(x, y, pl.fill.set ? pl.fill.r : 0, pl.fill.set ? pl.fill.g : 0, pl.fill.set ? pl.fill.b : 0, fa);
                    continue;
                }
                const float v = (y - y0) / std::max(1.f, ph);
                float r = base + 0.06f * (1 - v), g = base + 0.07f * (1 - v), b = base + 0.10f * (1 - v);
                if (!pl.occluder) {
                    const float rim = Clamp01(1.f - (-d) / 2.f) * (v < 0.5f ? 0.45f : 0.12f);
                    r += rim; g += rim; b += rim;
                }
                if (pl.tint.set) {
                    const float k = std::min(0.9f, pl.tint.a);
                    r += (pl.tint.r - r) * k; g += (pl.tint.g - g) * k; b += (pl.tint.b - b) * k;
                }
                if (pl.fill.set) {
                    r += (pl.fill.r - r) * pl.fill.a; g += (pl.fill.g - g) * pl.fill.a; b += (pl.fill.b - b) * pl.fill.a;
                }
                if (pl.occluder) { r *= 0.55f; g *= 0.55f; b *= 0.55f; }
                over(x, y, r, g, b, cov);
            }
    }
    // v3 holes: a dark rect inside the crop rect, only where there is glass
    for (const Slab &sl : s.slabs) {
        if (!sl.hole) continue;
        const float fa = sl.holeFill.set ? sl.holeFill.a : 0.35f;
        for (int y = std::max(0, int(sl.cy0 * g_scale)); y < std::min(s.bh, int(std::ceil(sl.cy1 * g_scale))); y++)
            for (int x = std::max(0, int(sl.cx0 * g_scale)); x < std::min(s.bw, int(std::ceil(sl.cx1 * g_scale))); x++) {
                uint8_t *p = px + size_t(y) * stride + size_t(x) * 4;
                const float da = p[3] / 255.f;
                if (da <= 0) continue;
                for (int c = 0; c < 3; c++) {
                    const float f = sl.holeFill.set ? (c == 0 ? sl.holeFill.r : c == 1 ? sl.holeFill.g : sl.holeFill.b) : 0.f;
                    p[c] = uint8_t(Clamp01(p[c] / 255.f * (1 - fa) + f * fa * da) * 255.f + 0.5f);
                }
            }
    }
    // slabs: translucent "liquid" rounded rects (tinted when asked; "none" draws nothing)
    for (const Slab &sl : s.slabs) {
        if (sl.material == "none") continue;
        if (sl.material == "dim") {  // v3 G7: a flat dark cell, feathered 8 px
            const float fa0 = sl.fill.set ? sl.fill.a : 0.30f;
            for (int y = 0; y < sl.ph; y++)
                for (int x = 0; x < sl.pw; x++) {
                    const float e = std::min(std::min(x + 0.5f, sl.pw - x - 0.5f), std::min(y + 0.5f, sl.ph - y - 0.5f));
                    const float a = fa0 * Clamp01(e / (8.f * g_scale));
                    put(sl.x + x, sl.y + y, sl.fill.set ? sl.fill.r : 0, sl.fill.set ? sl.fill.g : 0, sl.fill.set ? sl.fill.b : 0, a);
                }
            continue;
        }
        const float sr = std::min(float(sl.r) * g_scale, std::min(sl.pw, sl.ph) * 0.5f);
        const float shx = sl.pw * 0.5f, shy = sl.ph * 0.5f;
        for (int y = 0; y < sl.ph; y++)
            for (int x = 0; x < sl.pw; x++) {
                const float d = RRect(x + 0.5f, y + 0.5f, shx, shy, shx, shy, sr);
                const float cov = Clamp01(0.5f - d);
                if (cov <= 0) continue;
                const float v = float(y) / std::max(1, sl.ph);
                const float rim = Clamp01(1.f - (-d) / 1.8f);
                const float a = cov * (0.30f + 0.55f * rim * (v < 0.5f ? 1.f : 0.45f));
                const float l = 0.80f + 0.2f * (1 - v);
                float r = l * 0.92f, g = l * 0.97f, b = l;
                if (sl.tint.set) {
                    const float k = std::min(0.9f, sl.tint.a);
                    r += (sl.tint.r - r) * k; g += (sl.tint.g - g) * k; b += (sl.tint.b - b) * k;
                }
                put(sl.x + x, sl.y + y, r, g, b, a);
            }
    }
}

static bool Layout(Surface &s) {
    s.bw = std::max(1, int(std::lround(s.texW * g_scale)));
    s.bh = std::max(1, int(std::lround(s.texH * g_scale)));
    s.W = s.bw;
    int x = 0, y = s.bh + 2, row = 0;
    for (Slab &sl : s.slabs) {
        sl.pw = std::min(s.W, std::max(1, int(std::lround(sl.w * g_scale))));
        sl.ph = std::max(1, int(std::lround(sl.h * g_scale)));
        if (x + sl.pw > s.W) { x = 0; y += row + 2; row = 0; }
        sl.x = x;
        sl.y = y;
        x += sl.pw + 2;
        row = std::max(row, sl.ph);
    }
    s.H = s.slabs.empty() ? s.bh : y + row;
    return s.W <= 8192 && s.H <= 8192;
}

static bool Publish(Surface &s) {
    Tex t;
    t.bo = gbm_bo_create(g_gbm, s.W, s.H, GBM_FORMAT_ABGR8888, GBM_BO_USE_LINEAR | GBM_BO_USE_RENDERING);
    if (!t.bo) { std::printf("fakeglassd: gbm_bo_create %dx%d failed\n", s.W, s.H); return false; }
    uint32_t stride = 0;
    void *map = nullptr;
    auto *px = static_cast<uint8_t *>(gbm_bo_map(t.bo, 0, 0, s.W, s.H, GBM_BO_TRANSFER_WRITE, &stride, &map));
    if (!px) { std::printf("fakeglassd: gbm_bo_map failed\n"); Release(t); return false; }
    Paint(s, px, stride);
    if (!g_dump.empty()) {
        std::vector<uint8_t> copy(size_t(s.W) * s.H * 4);
        for (int y = 0; y < s.H; y++) std::memcpy(&copy[size_t(y) * s.W * 4], px + size_t(y) * stride, size_t(s.W) * 4);
        const std::string path = g_dump + "/fakeglassd-" + s.name + ".png";
        stbi_write_png(path.c_str(), s.W, s.H, 4, copy.data(), s.W * 4);
    }
    gbm_bo_unmap(t.bo, map);

    vr::DmabufAttributes_t a{};
    a.unWidth = s.W;
    a.unHeight = s.H;
    a.unDepth = a.unMipLevels = a.unArrayLayers = a.unSampleCount = 1;
    a.unFormat = GBM_FORMAT_ABGR8888;
    a.ulModifier = DRM_FORMAT_MOD_LINEAR;
    a.unPlaneCount = 1;
    a.plane[0].unOffset = 0;
    a.plane[0].unStride = stride;
    a.plane[0].nFd = t.fd = gbm_bo_get_fd(t.bo);
    if (!vr::VRIPCResourceManager()->ImportDmabuf(vr::VRApplication_Overlay, &a, &t.h)) {
        std::printf("fakeglassd: ImportDmabuf failed\n");
        Release(t);
        return false;
    }
    if (s.ov == vr::k_ulOverlayHandleInvalid) {
        const std::string key = g_prefix + s.name;
        auto e = vr::VROverlay()->CreateOverlay(key.c_str(), ("Glass Shell fake glassd " + s.name).c_str(), &s.ov);
        if (e != vr::VROverlayError_None) {
            std::printf("fakeglassd: CreateOverlay %s: %s\n", key.c_str(), vr::VROverlay()->GetOverlayErrorNameFromEnum(e));
            s.ov = vr::k_ulOverlayHandleInvalid;
            Release(t);
            return false;
        }
        vr::VROverlay()->SetOverlayWidthInMeters(s.ov, 1.0f);
    }
    vr::HmdVector2_t mouse = {float(s.W), float(s.H)};
    vr::VROverlay()->SetOverlayMouseScale(s.ov, &mouse);
    vr::Texture_t vt = {&t.h, vr::TextureType_SharedTextureHandle, vr::ColorSpace_Gamma};
    auto e = vr::VROverlay()->SetOverlayTexture(s.ov, &vt);
    if (e != vr::VROverlayError_None) {
        std::printf("fakeglassd: SetOverlayTexture %s: %s\n", s.name.c_str(), vr::VROverlay()->GetOverlayErrorNameFromEnum(e));
        Release(t);
        return false;
    }
    if (s.tex.bo) {   // the compositor may still sample the old one this frame
        s.tex.retired = std::chrono::steady_clock::now();
        g_retired.push_back(s.tex);
    }
    s.tex = t;
    return true;
}

static void Destroy(Surface &s) {
    if (s.ov != vr::k_ulOverlayHandleInvalid) vr::VROverlay()->DestroyOverlay(s.ov);
    s.ov = vr::k_ulOverlayHandleInvalid;
    Release(s.tex);
}

static bool ReadFile(const std::string &path, std::string &out) {
    FILE *f = std::fopen(path.c_str(), "rb");
    if (!f) return false;
    char buf[65536];
    size_t n;
    out.clear();
    while ((n = std::fread(buf, 1, sizeof buf, f)) > 0) out.append(buf, n);
    std::fclose(f);
    return true;
}

static void WriteOut(const std::string &path, double seq, const std::map<std::string, Surface> &surfs, long frames) {
    std::string o = "{\"seq\":" + std::to_string(long(seq)) + ",\"fps\":1.0,\"gpu_ms\":0.0,\"frames\":" +
                    std::to_string(frames) + ",\"fake\":true,\"version\":3,\"caps\":[\"plates\",\"holes\",\"tint\",\"masks\","
                    "\"coverDz\",\"none\",\"offset\",\"dim\",\"scaleFrom\",\"unitM\",\"roomDim\",\"dimSlab\",\"holeEdges\"],\"surfaces\":{";
    bool first = true;
    char tmp[256];
    for (const auto &kv : surfs) {
        const Surface &s = kv.second;
        if (!s.tex.bo) continue;
        if (!first) o += ",";
        first = false;
        std::snprintf(tmp, sizeof tmp, "\"%s\":{\"key\":\"%s%s\",\"texW\":%d,\"texH\":%d,\"backdrop\":[0,0,1,%.6f],\"backdropScale\":%.6f,\"cover\":%zu,\"slabs\":{",
                      Esc(s.name).c_str(), Esc(g_prefix).c_str(), Esc(s.name).c_str(), s.W, s.H, double(s.bh) / s.H, double(g_scale), s.shapes.size());
        o += tmp;
        bool f2 = true;
        for (const Slab &sl : s.slabs) {
            if (!f2) o += ",";
            f2 = false;
            std::snprintf(tmp, sizeof tmp, "\"%s\":[%.6f,%.6f,%.6f,%.6f]", Esc(sl.id).c_str(), double(sl.x) / s.W, double(sl.y) / s.H,
                          double(sl.x + sl.pw) / s.W, double(sl.y + sl.ph) / s.H);
            o += tmp;
        }
        o += "},\"plates\":[";
        for (size_t i = 0; i < s.plates.size(); i++) o += std::string(i ? "," : "") + "\"" + Esc(s.plates[i].id) + "\"";
        o += "]";
        if (!s.droppedPlates.empty()) {
            o += ",\"droppedPlates\":[";
            for (size_t i = 0; i < s.droppedPlates.size(); i++) o += std::string(i ? "," : "") + "\"" + Esc(s.droppedPlates[i]) + "\"";
            o += "]";
        }
        size_t holes = 0;
        for (const Slab &sl : s.slabs) holes += sl.hole;
        std::snprintf(tmp, sizeof tmp, ",\"counts\":{\"shapes\":%zu,\"plates\":%zu,\"slabs\":%zu,\"holes\":%zu,\"dropped\":0,\"droppedPlates\":%zu}}",
                      s.shapes.size(), s.plates.size(), s.slabs.size(), holes, s.droppedN);
        o += tmp;
    }
    o += "}}\n";
    const std::string t = path + ".tmp";
    FILE *f = std::fopen(t.c_str(), "wb");
    if (!f) return;
    std::fwrite(o.data(), 1, o.size(), f);
    std::fclose(f);
    std::rename(t.c_str(), path.c_str());
}

int main(int argc, char **argv) {
    std::string in = "/dev/shm/lgs/glassd.json", out = "/dev/shm/lgs/glassd-out.json";
    int seconds = 0;
    for (int i = 1; i + 1 < argc; i += 2) {
        const std::string k = argv[i];
        if (k == "--scale") g_scale = float(std::atof(argv[i + 1]));
        else if (k == "--dump") g_dump = argv[i + 1];
        else if (k == "--seconds") seconds = std::atoi(argv[i + 1]);
        else if (k == "--in") in = argv[i + 1];
        else if (k == "--out") out = argv[i + 1];
        else if (k == "--key-prefix") g_prefix = argv[i + 1];
    }
    setvbuf(stdout, nullptr, _IOLBF, 0);
    signal(SIGTERM, OnSignal);
    signal(SIGINT, OnSignal);
    signal(SIGHUP, OnSignal);

    vr::EVRInitError err = vr::VRInitError_None;
    vr::VR_Init(&err, vr::VRApplication_Overlay);
    if (err != vr::VRInitError_None) {
        std::printf("fakeglassd: VR_Init: %s\n", vr::VR_GetVRInitErrorAsEnglishDescription(err));
        return 1;
    }
    int drm = open("/dev/dri/renderD128", O_RDWR | O_CLOEXEC);
    g_gbm = drm >= 0 ? gbm_create_device(drm) : nullptr;
    if (!g_gbm) { std::printf("fakeglassd: no GBM device\n"); vr::VR_Shutdown(); return 1; }
    std::printf("fakeglassd: up (scale %.2f, in %s, out %s%s%s)\n", double(g_scale), in.c_str(), out.c_str(),
                g_dump.empty() ? "" : ", dump ", g_dump.c_str());

    std::map<std::string, Surface> surfs;
    timespec lastM{};
    long frames = 0;
    const auto t0 = std::chrono::steady_clock::now();
    while (!g_quit) {
        if (seconds > 0 && std::chrono::steady_clock::now() - t0 > std::chrono::seconds(seconds)) break;
        vr::VREvent_t ev;
        while (vr::VRSystem() && vr::VRSystem()->PollNextEvent(&ev, sizeof ev))
            if (ev.eventType == vr::VREvent_Quit) g_quit = 1;
        // free textures retired more than a second ago
        const auto now = std::chrono::steady_clock::now();
        g_retired.erase(std::remove_if(g_retired.begin(), g_retired.end(), [&](Tex &t) {
                            if (now - t.retired < std::chrono::seconds(1)) return false;
                            Release(t);
                            return true;
                        }),
                        g_retired.end());

        struct stat stt {};
        if (stat(in.c_str(), &stt) == 0 &&
            (stt.st_mtim.tv_sec != lastM.tv_sec || stt.st_mtim.tv_nsec != lastM.tv_nsec)) {
            std::string text;
            J cfg;
            if (ReadFile(in, text) && ParseJson(text, cfg) && cfg.t == J::Obj) {
                lastM = stt.st_mtim;
                std::map<std::string, bool> seen;
                bool changed = false;
                for (const J &js : cfg["surfaces"].a) {
                    const std::string name = js["name"].str();
                    if (name.empty() || js["texW"].num() < 1 || js["texH"].num() < 1) continue;
                    seen[name] = true;
                    Surface &s = surfs[name];
                    s.name = name;
                    s.overlayKey = js["overlayKey"].str();
                    s.texW = int(js["texW"].num());
                    s.texH = int(js["texH"].num());
                    s.radius = int(js["radius"].num());
                    s.material = js["material"].str("window");
                    s.visible = js["visible"].truthy(true);
                    std::vector<Slab> slabs;
                    std::string sig = std::to_string(s.texW) + "x" + std::to_string(s.texH) + "r" + std::to_string(s.radius) + s.material;
                    auto num = [](double v) { return std::to_string(std::lround(v * 100)); };
                    // cover shapes (as glassd: absent = whole texture for window, [] = none), at most 8
                    std::vector<Rect> shapes;
                    const J &sh = js["shapes"];
                    if (sh.t == J::Arr) {
                        for (const J &q : sh.a) {
                            Rect rc{float(q["x"].num()), float(q["y"].num()), float(q["w"].num()), float(q["h"].num()),
                                    float(q["r"].num(s.radius))};
                            if (rc.w < 1 || rc.h < 1 || shapes.size() >= 8) continue;
                            shapes.push_back(rc);
                        }
                    } else if (s.material == "window") {
                        shapes.push_back(Rect{0, 0, float(s.texW), float(s.texH), float(s.radius)});
                    }
                    for (const Rect &q : shapes) sig += "|s" + num(q.x) + "," + num(q.y) + "," + num(q.w) + "," + num(q.h) + "," + num(q.r);
                    std::vector<Plate> plates;
                    std::vector<std::string> droppedPlates;
                    size_t droppedN = 0;
                    int pi = 0;
                    for (const J &q : js["plates"].a) {
                        Plate pl;
                        pl.id = q["id"].str();
                        if (pl.id.empty()) pl.id = "p" + std::to_string(pi);
                        pi++;
                        pl.material = q["material"].str("liquid");
                        pl.rc = Rect{float(q["x"].num()), float(q["y"].num()), float(q["w"].num()), float(q["h"].num()), 0};
                        pl.rc.r = float(q["r"].num(0.5 * std::min(pl.rc.w, pl.rc.h)));
                        pl.tint = ParseCol(q["tint"]);
                        pl.fill = ParseCol(q["fill"]);
                        pl.occluder = q["occluder"].truthy(false);
                        if (pl.rc.w < 1 || pl.rc.h < 1 || plates.size() >= 32) {
                            if (droppedPlates.size() < 32) droppedPlates.push_back(pl.id);  // listed: the first 32
                            droppedN++;
                            continue;
                        }
                        sig += "|p" + pl.id + pl.material + num(pl.rc.x) + "," + num(pl.rc.y) + "," + num(pl.rc.w) + "," + num(pl.rc.h) +
                               (pl.occluder ? "o" : "") + (pl.tint.set ? "t" + num(pl.tint.r + pl.tint.g * 3 + pl.tint.b * 9 + pl.tint.a * 27) : "") +
                               (pl.fill.set ? "f" + num(pl.fill.r + pl.fill.g * 3 + pl.fill.b * 9 + pl.fill.a * 27) : "");
                        plates.push_back(pl);
                    }
                    for (const J &l : js["slabs"].a) {
                        Slab sl;
                        sl.id = l["id"].t == J::Num ? std::to_string(long(l["id"].num())) : l["id"].str();
                        sl.w = int(std::lround(l["w"].num()));
                        sl.h = int(std::lround(l["h"].num()));
                        sl.r = int(std::lround(l["r"].num()));
                        sl.material = l["material"].str("liquid");
                        sl.ex = float(l["x"].num());
                        sl.ey = float(l["y"].num());
                        sl.tint = ParseCol(l["tint"]);
                        sl.fill = ParseCol(l["fill"]);
                        const J &h = l["hole"];
                        sl.hole = h.t == J::Obj || (h.t == J::Bool && h.b);
                        sl.cx0 = sl.ex; sl.cy0 = sl.ey; sl.cx1 = sl.ex + sl.w; sl.cy1 = sl.ey + sl.h;
                        if (h.t == J::Obj) {
                            sl.holeFill = ParseCol(h["fill"]);
                            // R1 edge tones: fakeglassd paints their mean as a flat fill
                            const J &ed = h["edges"];
                            if (ed.t == J::Obj && !sl.holeFill.set) {
                                float acc[4] = {0, 0, 0, 0};
                                int n = 0;
                                for (const char *k : {"top", "right", "bottom", "left"}) {
                                    const J &e = ed[k];
                                    const bool list = e.t == J::Arr && !e.a.empty() && e.a[0].t != J::Num;
                                    const size_t m = list ? std::min<size_t>(e.a.size(), 8) : 1;
                                    for (size_t i = 0; i < m; i++) {
                                        const Col c = ParseCol(list ? e.a[i] : e);
                                        if (!c.set) continue;
                                        acc[0] += c.r; acc[1] += c.g; acc[2] += c.b; acc[3] += c.a;
                                        n++;
                                    }
                                }
                                if (n) {
                                    sl.holeFill.set = true;
                                    sl.holeFill.r = acc[0] / n; sl.holeFill.g = acc[1] / n; sl.holeFill.b = acc[2] / n; sl.holeFill.a = acc[3] / n;
                                }
                            }
                            const J &c = h["clip"];
                            if (c.t == J::Arr && c.a.size() == 4 && c.a[2].num() > c.a[0].num() && c.a[3].num() > c.a[1].num()) {
                                sl.cx0 = float(c.a[0].num()); sl.cy0 = float(c.a[1].num());
                                sl.cx1 = float(c.a[2].num()); sl.cy1 = float(c.a[3].num());
                            }
                        }
                        if (sl.id.empty() || sl.w < 1 || sl.h < 1) continue;
                        sig += "|" + sl.id + ":" + std::to_string(sl.w) + "x" + std::to_string(sl.h) + "r" + std::to_string(sl.r) + sl.material +
                               (sl.tint.set ? "t" + num(sl.tint.r + sl.tint.g * 3 + sl.tint.b * 9 + sl.tint.a * 27) : "") +
                               (sl.fill.set ? "f" + num(sl.fill.r + sl.fill.g * 3 + sl.fill.b * 9 + sl.fill.a * 27) : "") +
                               (sl.hole ? "h" + num(sl.cx0) + "," + num(sl.cy0) + "," + num(sl.cx1) + "," + num(sl.cy1) +
                                              (sl.holeFill.set ? "f" + num(sl.holeFill.a) : "")
                                        : "");
                        slabs.push_back(sl);
                    }
                    if (sig != s.sig) {
                        s.shapes = shapes;
                        s.plates = plates;
                        s.droppedPlates = droppedPlates;
                        s.droppedN = droppedN;
                        s.slabs = slabs;
                        if (Layout(s) && Publish(s)) {
                            s.sig = sig;
                            changed = true;
                            std::printf("fakeglassd: %s %dx%d -> texture %dx%d, %zu shapes, %zu plates (%zu dropped), %zu slabs\n",
                                        name.c_str(), s.texW, s.texH, s.W, s.H, s.shapes.size(), s.plates.size(),
                                        s.droppedPlates.size(), s.slabs.size());
                        }
                    }
                }
                for (auto it = surfs.begin(); it != surfs.end();) {
                    if (!seen.count(it->first)) {
                        std::printf("fakeglassd: %s removed\n", it->first.c_str());
                        Destroy(it->second);
                        it = surfs.erase(it);
                        changed = true;
                    } else {
                        ++it;
                    }
                }
                (void)changed;
                frames++;
                WriteOut(out, cfg["seq"].num(), surfs, frames);
            }
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
    std::printf("fakeglassd: exiting\n");
    for (auto &kv : surfs) Destroy(kv.second);
    for (Tex &t : g_retired) Release(t);
    std::remove(out.c_str());
    vr::VR_Shutdown();
    return 0;
}
