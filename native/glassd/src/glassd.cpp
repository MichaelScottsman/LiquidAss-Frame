// glassd: the native glass renderer of Glass Shell (see docs/NATIVE.md).
//
// For every Steam surface listed in /dev/shm/lgs/glassd.json it publishes one
// SteamVR overlay "glassd.<name>" whose texture is a triple-buffered dmabuf
// (GBM + surfaceless EGL + GLES 3). The texture holds the surface's window
// glass (the "cover": frosted and lensed room, tint, sheen, rims) on top and an
// atlas of Liquid Glass slabs for popped elements underneath. The room comes
// from an equirectangular room map built from the passthrough feed
// (/dev/video99) with every Steam surface masked out. The daemon's scene graph
// shows these overlays by key; glassd never calls ShowOverlay.
//
// Writes the layout (UV rects, backdropScale) plus fps / gpu_ms to
// /dev/shm/lgs/glassd-out.json. Renders only while the dashboard is visible.
#include <openvr.h>

#include <dirent.h>
#include <signal.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <unistd.h>

#include <algorithm>
#include <atomic>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <fstream>
#include <memory>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

#include "feed.h"
#include "gfx.h"
#include "json.h"
#include "room.h"
#include "vmath.h"

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

static_assert(sizeof(vr::SharedTextureHandle_t) == sizeof(uint64_t), "shared handle size");

static const std::pair<const char *, const char *> kShaders[] = {
#include "shaders.inc"
};

namespace {

std::atomic<bool> g_quit{false};
std::atomic<bool> g_dumpRequest{false};
void onSignal(int s) {
    if (s == SIGUSR1) g_dumpRequest = true;
    else g_quit = true;
}

// ------------------------------------------------------------------ options
struct Options {
    std::string spec = "/dev/shm/lgs/glassd.json";
    std::string out = "/dev/shm/lgs/glassd-out.json";
    std::string dumpDir, dumpRoom, shaderDir;
    std::string keyPrefix = "glassd.";
    std::string feedDev = "/dev/video99";
    bool once = false, force = false, demo = false, noFeed = false, noMask = false;
    float zone[3] = {0.15f, 0.08f, 0.25f};  // main window mask zone: side, top, bottom (m)
    int debugView = 0;
    int dashOverride = -1;  // --dash on|off (tests): -1 = ask SteamVR
    float scale = 0.75f;      // backdropScale
    float fps = 72.f;         // max render rate while visible
    float feedHz = 36.f;      // room map updates while visible
    float idleHz = 2.f;       // room map updates while the dashboard is hidden (0 = none)
    float warmup = 3.f;       // seconds of feed before --once / --dump output
    float margin = 0.06f;     // metres around Steam surfaces in the feed mask
    float roomDepth = 2.2f;   // radius of the room sphere
    float predictMs = 20.f;   // head pose prediction for rendering
    float timeout = 0.f;      // exit after N seconds (0 = run until stopped)
    int feedDownsample = 4;
};

void usage() {
    std::printf(
        "glassd [options]\n"
        "  --spec FILE        layer spec to follow (default /dev/shm/lgs/glassd.json; re-read on change)\n"
        "  --out FILE         layout + stats output (default /dev/shm/lgs/glassd-out.json)\n"
        "  --demo             use a built-in spec (main window + 3 slabs) instead of --spec\n"
        "  --once             integrate the feed for --warmup s, render one frame of every surface, exit\n"
        "  --dump DIR         write every surface texture to DIR/<name>.png after one frame\n"
        "  --dump-room PATH   write the filled room map PNG (and PATH-known.png); delete after looking\n"
        "  --force            render even while the dashboard is hidden\n"
        "  --scale S          backdropScale, glassd px per Steam px (default 0.75)\n"
        "  --fps N            max render rate while visible (default 72)\n"
        "  --feed-hz N        room map updates per second while visible (default 36)\n"
        "  --idle-hz N        room map updates per second while hidden (default 2, 0 = none)\n"
        "  --warmup S         feed seconds before dumps (default 3)\n"
        "  --margin M         feed mask margin around Steam surfaces in metres (default 0.06)\n"
        "  --zone S,T,B       extra mask around the main window: side, top, bottom (default 0.15,0.08,0.25)\n"
        "  --no-mask          debug: integrate the feed without masking the UI\n"
        "  --debug-view N     debug shading: 1 backdrop, 2 light, 3 bezel, 4 room uv\n"
        "  --dash on|off|auto test override for SteamVR's dashboard visibility (default auto)\n"
        "  --key-prefix P     overlay key prefix (default glassd.)\n"
        "  --shaders DIR      load shaders from DIR instead of the built-in copies\n"
        "  --feed DEV         passthrough feed device (default /dev/video99); --no-feed to skip it\n"
        "  --timeout S        exit after S seconds\n"
        "SIGUSR1 dumps the room map and surfaces (to the --dump paths, else /tmp/lgs/glassd-dump/).\n");
}

bool parseArgs(int argc, char **argv, Options &o) {
    for (int i = 1; i < argc; i++) {
        std::string a = argv[i];
        auto next = [&](std::string &v) {
            if (i + 1 >= argc) return false;
            v = argv[++i];
            return true;
        };
        auto nextf = [&](float &v) {
            if (i + 1 >= argc) return false;
            v = std::strtof(argv[++i], nullptr);
            return true;
        };
        bool ok = true;
        if (a == "--spec") ok = next(o.spec);
        else if (a == "--out") ok = next(o.out);
        else if (a == "--dump") ok = next(o.dumpDir);
        else if (a == "--dump-room") ok = next(o.dumpRoom);
        else if (a == "--shaders") ok = next(o.shaderDir);
        else if (a == "--key-prefix") ok = next(o.keyPrefix);
        else if (a == "--feed") ok = next(o.feedDev);
        else if (a == "--no-feed") o.noFeed = true;
        else if (a == "--no-mask") o.noMask = true;
        else if (a == "--debug-view") { std::string v; ok = next(v); o.debugView = std::atoi(v.c_str()); }
        else if (a == "--dash") {
            std::string v;
            ok = next(v) && (v == "on" || v == "off" || v == "auto");
            o.dashOverride = v == "on" ? 1 : v == "off" ? 0 : -1;
        }
        else if (a == "--zone") {
            std::string v;
            ok = next(v) && std::sscanf(v.c_str(), "%f,%f,%f", &o.zone[0], &o.zone[1], &o.zone[2]) == 3;
        }
        else if (a == "--once") o.once = true;
        else if (a == "--force") o.force = true;
        else if (a == "--demo") o.demo = true;
        else if (a == "--scale") ok = nextf(o.scale);
        else if (a == "--fps") ok = nextf(o.fps);
        else if (a == "--feed-hz") ok = nextf(o.feedHz);
        else if (a == "--idle-hz") ok = nextf(o.idleHz);
        else if (a == "--warmup") ok = nextf(o.warmup);
        else if (a == "--margin") ok = nextf(o.margin);
        else if (a == "--room-depth") ok = nextf(o.roomDepth);
        else if (a == "--predict-ms") ok = nextf(o.predictMs);
        else if (a == "--timeout") ok = nextf(o.timeout);
        else if (a == "-h" || a == "--help") { usage(); std::exit(0); }
        else { std::fprintf(stderr, "unknown option %s\n", a.c_str()); return false; }
        if (!ok) { std::fprintf(stderr, "%s needs a value\n", a.c_str()); return false; }
    }
    o.scale = std::clamp(o.scale, 0.25f, 1.5f);
    o.fps = std::clamp(o.fps, 1.f, 144.f);
    o.feedHz = std::clamp(o.feedHz, 1.f, 60.f);
    o.idleHz = std::clamp(o.idleHz, 0.f, 60.f);
    return true;
}

// ---------------------------------------------------------------- materials
struct Material {
    float tintA;    // tint opacity (adapted to the room's brightness in the shader)
    float frost;    // room-map mip level
    float bezelM;   // squircle bezel width, metres (lensing profile)
    float refrM;    // max inward shift across the bezel, metres (lensing strength)
    float lensMag;  // interior magnification
    float disp;     // dispersion (fraction of the bezel shift)
    float rim;      // rim light strength (key on top, 0.4x fill below, edge line)
    float rimW;     // rim light / inner shadow width, metres
    float sheen, spec, darkEdge, trans;
};

// The design bible's presets (NATIVE.md "Materials"), at dial 0.5. The dial
// moves tint x0.7 -> x1.3 and frost -1 -> +1 mip.
Material materialFor(const std::string &name, float dial) {
    Material m;
    //                               tint  frost bezel   refr    mag     disp   rim    rimW    sheen spec   dark   trans
    if (name == "liquid")      m = {0.18f, 1.4f, 0.016f, 0.016f, 0.015f, 0.35f, 1.20f, 0.005f, 1.0f, 1.15f, 0.55f, 0.97f};
    else if (name == "panel")  m = {0.50f, 3.4f, 0.012f, 0.004f, 0.004f, 0.20f, 0.70f, 0.007f, 1.0f, 1.00f, 0.40f, 0.93f};
    else if (name == "thick")  m = {0.45f, 4.2f, 0.014f, 0.000f, 0.000f, 0.00f, 0.70f, 0.008f, 1.0f, 1.00f, 0.40f, 0.93f};
    else /* window */          m = {0.55f, 3.6f, 0.020f, 0.006f, 0.006f, 0.25f, 0.60f, 0.012f, 1.0f, 1.00f, 0.45f, 0.93f};
    dial = std::clamp(dial, 0.f, 1.f);
    m.tintA = std::min(0.95f, m.tintA * (0.7f + 0.6f * dial));
    m.frost = std::max(0.f, m.frost - 1.f + 2.f * dial);
    return m;
}

// --------------------------------------------------------------------- spec
struct SlabSpec {
    std::string id, material = "liquid";
    float w = 0, h = 0, r = 0;
    bool hasPos = false;
    float x = 0, y = 0;
    float dz = 0.015f;
};
struct ShapeSpec {
    float x = 0, y = 0, w = 0, h = 0, r = 0;
};
struct SurfSpec {
    std::string name, overlayKey, material = "window";
    int texW = 0, texH = 0;
    float radius = 0;
    bool visible = true;
    std::vector<ShapeSpec> shapes;  // optional; default one shape = whole texture with `radius`
    std::vector<SlabSpec> slabs;
};
struct Spec {
    long long seq = 0;
    float dial = 0.5f;
    std::vector<SurfSpec> surfaces;
};

const char *kDemoSpec = R"({"seq": 1, "dial": 0.5, "surfaces": [
  {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "texW": 1920, "texH": 1080, "radius": 48,
   "material": "window", "visible": true,
   "slabs": [{"id": "hdr-back", "w": 210, "h": 60, "r": 30, "material": "liquid", "x": 18, "y": 6, "dz": 0.015},
             {"id": "tabs", "w": 600, "h": 64, "r": 32, "material": "liquid", "x": 900, "y": 70, "dz": 0.012},
             {"id": "play", "w": 260, "h": 72, "r": 36, "material": "liquid", "x": 120, "y": 840, "dz": 0.015}]}
]})";

bool parseSpec(const std::string &text, Spec &out, std::string &err) {
    JVal root;
    if (!JParser(text).parse(root, err)) return false;
    if (root.type != JVal::Obj) { err = "spec is not an object"; return false; }
    out = Spec{};
    out.seq = (long long)root.num("seq", 0);
    out.dial = float(root.num("dial", 0.5));
    const JVal *surfs = root.get("surfaces");
    if (!surfs || surfs->type != JVal::Arr) return true;
    for (const JVal &s : surfs->a) {
        if (s.type != JVal::Obj) continue;
        SurfSpec ss;
        ss.name = s.str("name", "");
        ss.overlayKey = s.str("overlayKey", "");
        ss.texW = int(s.num("texW", 0));
        ss.texH = int(s.num("texH", 0));
        ss.radius = float(s.num("radius", 0));
        ss.material = s.str("material", "window");
        ss.visible = s.boolean("visible", true);
        if (ss.name.empty() || ss.name.size() > 128 || ss.texW <= 0 || ss.texH <= 0 || ss.texW > 8192 || ss.texH > 8192) continue;
        if (const JVal *sh = s.get("shapes"); sh && sh->type == JVal::Arr) {
            for (const JVal &q : sh->a) {
                ShapeSpec p{float(q.num("x", 0)), float(q.num("y", 0)), float(q.num("w", 0)), float(q.num("h", 0)),
                            float(q.num("r", ss.radius))};
                if (p.w > 0 && p.h > 0) ss.shapes.push_back(p);
            }
        }
        if (const JVal *sl = s.get("slabs"); sl && sl->type == JVal::Arr) {
            for (const JVal &q : sl->a) {
                SlabSpec b;
                b.id = q.str("id", "");
                if (const JVal *idn = q.get("id"); idn && idn->type == JVal::Num) b.id = std::to_string((long long)idn->n);
                b.w = float(q.num("w", 0));
                b.h = float(q.num("h", 0));
                b.r = float(q.num("r", 0));
                b.material = q.str("material", "liquid");
                b.hasPos = q.has("x") && q.has("y");
                b.x = float(q.num("x", 0));
                b.y = float(q.num("y", 0));
                b.dz = float(q.num("dz", 0.015));
                if (b.id.empty() || b.id.size() > 128 || b.w < 1 || b.h < 1) continue;
                ss.slabs.push_back(b);
            }
        }
        out.surfaces.push_back(std::move(ss));
    }
    return true;
}

std::string sanitizeKey(const std::string &s) {
    std::string o;
    for (char c : s) o += (std::isalnum((unsigned char)c) || c == '.' || c == '_' || c == '-') ? c : '_';
    return o.substr(0, 100);
}

// ----------------------------------------------------------------- surfaces
struct Geometry {
    bool valid = false, fallback = false;
    v3 O, U, V, N;  // world: Steam pixel (0,0) top-left; per-pixel right; per-pixel down; unit normal
    float mpp = 0;
};

struct SlabSlot {
    SlabSpec s;
    int x = 0, y = 0, w = 0, h = 0;  // in the glassd texture
};

struct Surface {
    SurfSpec spec;
    std::string key;
    vr::VROverlayHandle_t ov = vr::k_ulOverlayHandleInvalid;
    vr::VROverlayHandle_t steam = vr::k_ulOverlayHandleInvalid;
    int gw = 0, gh = 0, bw = 0, bh = 0;
    float scale = 0.75f;
    std::vector<SlabSlot> slots;
    DmaTarget bufs[3];
    int next = 0, last = -1;
    Geometry geo;
    uint64_t geoNs = 0, findNs = 0;
    std::string geoNote = "none";
    bool rendered = false, announced = false;
    int submitErrors = 0, createTries = 0;
    uint64_t createNs = 0;
};

struct Retired {
    DmaTarget buf;
    uint64_t freeAtNs;
};

// --------------------------------------------------------------- GPU timer
struct GpuTimer {
    Gfx *g = nullptr;
    GLuint q[4] = {0, 0, 0, 0};
    bool busy[4] = {false, false, false, false};
    int head = 0;
    bool active = false;
    float ms = 0;  // EMA
    bool have = false;
    void init(Gfx &gfx) {
        g = &gfx;
        if (g->timerQuery) glGenQueries(4, q);
    }
    void begin() {
        if (!g || !g->timerQuery || busy[head]) return;
        glBeginQuery(GL_TIME_ELAPSED_EXT, q[head]);
        active = true;
    }
    void end() {
        if (!active) return;
        glEndQuery(GL_TIME_ELAPSED_EXT);
        busy[head] = true;
        head = (head + 1) % 4;
        active = false;
    }
    void poll() {
        if (!g || !g->timerQuery) return;
        GLint disjoint = 0;
        glGetIntegerv(GL_GPU_DISJOINT_EXT, &disjoint);
        for (int i = 0; i < 4; i++) {
            if (!busy[i]) continue;
            GLuint avail = 0;
            glGetQueryObjectuiv(q[i], GL_QUERY_RESULT_AVAILABLE, &avail);
            if (!avail) continue;
            GLuint64 ns = 0;
            g->getQueryObjectui64v(q[i], GL_QUERY_RESULT, &ns);
            busy[i] = false;
            if (disjoint) continue;
            float v = float(ns) / 1e6f;
            ms = have ? ms + (v - ms) * 0.1f : v;
            have = true;
        }
    }
};

bool steamvrRunning() {
    DIR *d = opendir("/proc");
    if (!d) return true;
    bool found = false;
    while (dirent *e = readdir(d)) {
        if (!std::isdigit((unsigned char)e->d_name[0])) continue;
        std::string p = std::string("/proc/") + e->d_name + "/comm";
        FILE *f = std::fopen(p.c_str(), "r");
        if (!f) continue;
        char comm[64] = {};
        if (std::fgets(comm, sizeof comm, f) && std::strncmp(comm, "vrserver", 8) == 0) found = true;
        std::fclose(f);
        if (found) break;
    }
    closedir(d);
    return found;
}

void mkdirs(const std::string &dir) {
    std::string cur;
    std::stringstream ss(dir);
    std::string part;
    if (!dir.empty() && dir[0] == '/') cur = "/";
    while (std::getline(ss, part, '/')) {
        if (part.empty()) continue;
        cur += part + "/";
        mkdir(cur.c_str(), 0755);
    }
}
std::string dirname(const std::string &p) {
    size_t s = p.rfind('/');
    return s == std::string::npos ? "." : p.substr(0, s);
}
bool readFile(const std::string &p, std::string &out) {
    std::ifstream f(p, std::ios::binary);
    if (!f) return false;
    std::stringstream ss;
    ss << f.rdbuf();
    out = ss.str();
    return true;
}
bool writeAtomic(const std::string &p, const std::string &text) {
    std::string tmp = p + ".tmp";
    FILE *f = std::fopen(tmp.c_str(), "w");
    if (!f) return false;
    std::fwrite(text.data(), 1, text.size(), f);
    std::fclose(f);
    return std::rename(tmp.c_str(), p.c_str()) == 0;
}

// ===================================================================== glassd
class Glassd {
 public:
    explicit Glassd(const Options &o) : opt(o) {}

    int run() {
        if (!setup()) { teardown(); return 1; }
        loop();
        teardown();
        return 0;
    }

 private:
    Options opt;
    Gfx gfx;
    Program progGlass, progUpdate, progPush, progPull;
    GLuint vao = 0;
    Room room;
    FeedCapture feed;
    FeedFrame frame;
    uint64_t haveSeq = 0;
    FeedCalib cal;
    Pose eyeToHead;
    std::deque<std::pair<uint64_t, Pose>> hist;
    Spec spec;
    bool haveSpec = false;
    struct stat specStat {};
    std::string specError;
    std::vector<std::unique_ptr<Surface>> surfaces;
    std::vector<Retired> retired;
    std::vector<MaskQuad> masks;
    uint64_t masksNs = 0;
    int lockFd = -1;
    GpuTimer renderTimer, roomTimer;
    float envLuma = 0.25f;
    bool envSet = false;
    // stats
    uint64_t startNs = 0, frames = 0, framesWindow = 0, roomWindow = 0, lastStatusNs = 0, lastOutNs = 0;
    uint64_t feedSeenAtStatus = 0, firstRoomNs = 0;
    float fpsNow = 0, cpuMs = 0, roomCpuMs = 0;
    bool lastDash = false;
    Pose lastRenderHead;
    bool roomDirty = true, layoutDirty = true, outPending = false;
    uint64_t outPendingSinceNs = 0;
    Pose lastHead;
    bool haveLastHead = false;
    uint64_t nextRenderNs = 0, lastLoopNs = 0, lastRenderNs = 0;
    bool dumpedOnce = false;

    // ------------------------------------------------------------- shaders
    std::string shaderSource(const std::string &name) {
        if (!opt.shaderDir.empty()) {
            std::string s;
            if (readFile(opt.shaderDir + "/" + name, s)) return s;
            std::fprintf(stderr, "%s/%s missing; using the built-in copy\n", opt.shaderDir.c_str(), name.c_str());
        }
        for (auto &kv : kShaders)
            if (name == kv.first) return kv.second;
        std::fprintf(stderr, "no shader %s\n", name.c_str());
        return "";
    }
    bool loadPrograms() {
        const std::string head = "#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n";
        const std::string common = shaderSource("common.glsl");
        const std::string vs = head + common + "\n" + shaderSource("fullscreen.vert");
        auto fs = [&](const char *n) { return head + common + "\n" + shaderSource(n); };
        return linkProgram(progGlass, vs, fs("glass.frag"), "glass") &&
               linkProgram(progUpdate, vs, fs("room_update.frag"), "room_update") &&
               linkProgram(progPush, vs, fs("push.frag"), "push") && linkProgram(progPull, vs, fs("pull.frag"), "pull");
    }

    // --------------------------------------------------------------- setup
    bool setup() {
        startNs = monoNowNs();
        mkdirs(dirname(opt.out));
        std::string lockPath = dirname(opt.out) + "/" + sanitizeKey(opt.keyPrefix) + "lock";
        lockFd = open(lockPath.c_str(), O_CREAT | O_RDWR | O_CLOEXEC, 0644);
        if (lockFd < 0 || flock(lockFd, LOCK_EX | LOCK_NB) != 0) {
            std::fprintf(stderr, "another glassd holds %s\n", lockPath.c_str());
            return false;
        }
        if (!steamvrRunning()) {
            std::fprintf(stderr, "SteamVR (vrserver) is not running; not starting it\n");
            return false;
        }
        vr::EVRInitError err = vr::VRInitError_None;
        vr::VR_Init(&err, vr::VRApplication_Overlay);
        if (err != vr::VRInitError_None) {
            std::fprintf(stderr, "VR_Init: %s\n", vr::VR_GetVRInitErrorAsEnglishDescription(err));
            return false;
        }
        if (!vr::VROverlay() || !vr::VRSystem() || !vr::VRIPCResourceManager()) {
            std::fprintf(stderr, "OpenVR interfaces missing\n");
            return false;
        }
        if (!gfx.init()) return false;
        std::printf("GL %s | %s | timer queries %s | half-float targets %s\n", gfx.version.c_str(), gfx.renderer.c_str(),
                    gfx.timerQuery ? "yes" : "no", gfx.halfFloatTargets ? "yes" : "no");
        glGenVertexArrays(1, &vao);
        glBindVertexArray(vao);
        if (!loadPrograms()) return false;
        room.radius = opt.roomDepth;
        if (!room.init(gfx, progUpdate, progPush, progPull, vao)) return false;
        renderTimer.init(gfx);
        roomTimer.init(gfx);
        cal.load();
        std::printf("feed calibration %s: u=%.4fx%+.4f v=%.4fy%+.4f latency %.1f ms, %s eye\n", cal.source.c_str(), cal.a, cal.b,
                    cal.c, cal.d, cal.latencyMs, cal.eye ? "right" : "left");
        eyeToHead = fromVR(vr::VRSystem()->GetEyeToHeadTransform(cal.eye ? vr::Eye_Right : vr::Eye_Left));
        if (!opt.noFeed) feed.start(opt.feedDev, opt.feedDownsample);
        if (opt.demo) {
            Spec s;
            std::string e;
            if (parseSpec(kDemoSpec, s, e)) applySpec(s);
            std::printf("using the built-in demo spec\n");
        }
        return true;
    }

    void teardown() {
        feed.stop();
        if (vr::VRSystem()) writeOut(true);  // fps 0, "exiting": the layout stays readable
        if (vr::VROverlay()) {
            for (auto &s : surfaces) releaseSurface(*s, true);
            for (auto &r : retired) releaseBuffer(r.buf);
        }
        surfaces.clear();
        retired.clear();
        if (gfx.dpy != EGL_NO_DISPLAY) gfx.shutdown();
        if (vr::VRSystem()) vr::VR_Shutdown();
        if (lockFd >= 0) close(lockFd);
    }

    // ---------------------------------------------------------- overlays
    void releaseBuffer(DmaTarget &b) {
        if (b.vrHandle) vr::VRIPCResourceManager()->UnrefResource(vr::SharedTextureHandle_t(b.vrHandle));
        b.destroy(gfx);
    }
    void releaseSurface(Surface &s, bool destroyOverlay) {
        if (destroyOverlay && s.ov != vr::k_ulOverlayHandleInvalid) {
            vr::VROverlay()->DestroyOverlay(s.ov);
            s.ov = vr::k_ulOverlayHandleInvalid;
        }
        for (auto &b : s.bufs) releaseBuffer(b);
    }

    bool ensureOverlay(Surface &s) {
        if (s.ov != vr::k_ulOverlayHandleInvalid) return true;
        const uint64_t now = monoNowNs();
        if (s.createTries && now - s.createNs < 5000000000ull) return false;  // retry every 5 s
        s.createNs = now;
        std::string friendly = "Glass Shell glass (" + s.spec.name + ")";
        auto e = vr::VROverlay()->CreateOverlay(s.key.c_str(), friendly.c_str(), &s.ov);
        if (e != vr::VROverlayError_None) {
            if (s.createTries++ == 0)
                std::printf("CreateOverlay(%s): %s (retrying every 5 s)\n", s.key.c_str(), vr::VROverlay()->GetOverlayErrorNameFromEnum(e));
            s.ov = vr::k_ulOverlayHandleInvalid;
            return false;
        }
        s.createTries = 0;
        vr::VROverlay()->SetOverlayFlag(s.ov, vr::VROverlayFlags_IsPremultiplied, true);
        vr::VROverlay()->SetOverlayWidthInMeters(s.ov, 1.0f);
        std::printf("created overlay %s\n", s.key.c_str());
        return true;
    }

    // Shelf-packs the slabs under the backdrop. Returns true when the layout changed.
    bool layout(Surface &s) {
        const SurfSpec &sp = s.spec;
        const int bw = std::max(1, int(std::lround(sp.texW * opt.scale)));
        const float scale = float(bw) / float(sp.texW);
        const int bh = std::max(1, int(std::lround(sp.texH * scale)));
        const int gutter = 2;
        std::vector<SlabSpec> order = sp.slabs;
        std::stable_sort(order.begin(), order.end(), [](const SlabSpec &a, const SlabSpec &b) {
            if (a.h != b.h) return a.h > b.h;
            return a.id < b.id;
        });
        std::vector<SlabSlot> slots;
        int x = 0, y = bh + gutter, shelf = 0;
        for (const SlabSpec &b : order) {
            int w = std::min(bw, std::max(1, int(std::lround(b.w * scale))));
            int h = std::max(1, int(std::lround(b.h * scale)));
            if (x > 0 && x + w > bw) {
                y += shelf + gutter;
                x = 0;
                shelf = 0;
            }
            SlabSlot slot;
            slot.s = b;
            slot.x = x;
            slot.y = y;
            slot.w = w;
            slot.h = h;
            slots.push_back(slot);
            x += w + gutter;
            shelf = std::max(shelf, h);
        }
        int gh = slots.empty() ? bh : ((y + shelf + gutter + 31) / 32) * 32;
        gh = std::min(gh, 16384);
        bool changed = s.gw != bw || s.gh != gh || s.bw != bw || s.bh != bh || s.slots.size() != slots.size();
        for (size_t i = 0; !changed && i < slots.size(); i++) {
            const SlabSlot &a = slots[i], &b = s.slots[i];
            changed = a.s.id != b.s.id || a.x != b.x || a.y != b.y || a.w != b.w || a.h != b.h;
        }
        const bool resized = s.gw != bw || s.gh != gh;
        s.bw = bw;
        s.bh = bh;
        s.scale = scale;
        s.slots = std::move(slots);
        if (resized) {
            const uint64_t now = monoNowNs();
            for (auto &b : s.bufs) {
                if (b.bo) retired.push_back({b, now + 500000000ull});
                b = DmaTarget{};
            }
            s.gw = bw;
            s.gh = gh;
            s.next = 0;
            s.last = -1;
            s.rendered = false;
        }
        return changed;
    }

    bool ensureBuffers(Surface &s) {
        for (auto &b : s.bufs) {
            if (b.bo) continue;
            if (!b.create(gfx, s.gw, s.gh)) return false;
            vr::DmabufAttributes_t a{};
            a.pNext = nullptr;
            a.unWidth = uint32_t(s.gw);
            a.unHeight = uint32_t(s.gh);
            a.unDepth = a.unMipLevels = a.unArrayLayers = a.unSampleCount = 1;
            a.unFormat = GBM_FORMAT_ABGR8888;
            a.ulModifier = DRM_FORMAT_MOD_LINEAR;
            a.unPlaneCount = 1;
            a.plane[0].unOffset = b.offset;
            a.plane[0].unStride = b.stride;
            a.plane[0].nFd = b.fd;
            vr::SharedTextureHandle_t h = 0;
            if (!vr::VRIPCResourceManager()->ImportDmabuf(vr::VRApplication_Overlay, &a, &h) || !h) {
                std::printf("ImportDmabuf failed for %s (%dx%d)\n", s.key.c_str(), s.gw, s.gh);
                b.destroy(gfx);
                return false;
            }
            b.vrHandle = h;
        }
        if (s.ov != vr::k_ulOverlayHandleInvalid) {
            vr::HmdVector2_t mouse = {float(s.gw), float(s.gh)};
            vr::VROverlay()->SetOverlayMouseScale(s.ov, &mouse);
        }
        return true;
    }

    void applySpec(const Spec &ns) {
        spec = ns;
        haveSpec = true;
        bool changed = false;
        // drop surfaces that left the spec
        for (size_t i = 0; i < surfaces.size();) {
            bool keep = false;
            for (auto &s : ns.surfaces) keep |= s.name == surfaces[i]->spec.name;
            if (!keep) {
                std::printf("surface %s removed\n", surfaces[i]->spec.name.c_str());
                releaseSurface(*surfaces[i], true);
                surfaces.erase(surfaces.begin() + long(i));
                changed = true;
            } else {
                i++;
            }
        }
        for (const SurfSpec &ss : ns.surfaces) {
            Surface *s = nullptr;
            for (auto &e : surfaces)
                if (e->spec.name == ss.name) s = e.get();
            if (!s) {
                surfaces.push_back(std::make_unique<Surface>());
                s = surfaces.back().get();
                s->key = opt.keyPrefix + sanitizeKey(ss.name);
                changed = true;
            }
            if (s->spec.overlayKey != ss.overlayKey) {
                s->steam = vr::k_ulOverlayHandleInvalid;
                s->findNs = 0;
                s->geo = Geometry{};
            }
            s->spec = ss;
            changed |= layout(*s);
            ensureOverlay(*s);
            ensureBuffers(*s);
        }
        // The new layout is announced after the next (priming) render, so the
        // scene graph never points at buffers that hold nothing yet.
        layoutDirty = true;
        roomDirty = true;
        outPending = true;
        outPendingSinceNs = monoNowNs();
        if (changed) {
            for (auto &s : surfaces)
                std::printf("layout %s -> %s %dx%d backdrop %dx%d (scale %.4f), %zu slabs\n", s->spec.name.c_str(),
                            s->key.c_str(), s->gw, s->gh, s->bw, s->bh, s->scale, s->slots.size());
        }
    }

    void checkSpec() {
        if (opt.demo) return;
        struct stat st {};
        if (stat(opt.spec.c_str(), &st) != 0) return;
        if (haveSpec && st.st_mtim.tv_sec == specStat.st_mtim.tv_sec && st.st_mtim.tv_nsec == specStat.st_mtim.tv_nsec &&
            st.st_size == specStat.st_size && st.st_ino == specStat.st_ino)
            return;
        std::string text, err;
        if (!readFile(opt.spec, text)) return;
        Spec ns;
        if (!parseSpec(text, ns, err)) {
            if (err != specError) std::printf("%s: %s (keeping the previous spec)\n", opt.spec.c_str(), err.c_str());
            specError = err;
            return;  // retried on the next check (a writer may be mid-write)
        }
        specError.clear();
        specStat = st;
        applySpec(ns);
    }

    // ---------------------------------------------------------- geometry
    bool fetchGeometry(vr::VROverlayHandle_t h, float texW, float texH, Geometry &g) {
        vr::HmdVector2_t ms{};
        vr::VROverlay()->GetOverlayMouseScale(h, &ms);
        const float mw = ms.v[0] > 1 ? ms.v[0] : texW, mh = ms.v[1] > 1 ? ms.v[1] : texH;
        vr::HmdMatrix34_t a{}, b{}, c{};
        auto *ov = vr::VROverlay();
        if (ov->GetTransformForOverlayCoordinates(h, vr::TrackingUniverseStanding, {0.f, 0.f}, &a) != vr::VROverlayError_None ||
            ov->GetTransformForOverlayCoordinates(h, vr::TrackingUniverseStanding, {mw, 0.f}, &b) != vr::VROverlayError_None ||
            ov->GetTransformForOverlayCoordinates(h, vr::TrackingUniverseStanding, {0.f, mh}, &c) != vr::VROverlayError_None)
            return false;
        // origin bottom-left, y up: a = bottom-left, b = bottom-right, c = top-left
        v3 BL{a.m[0][3], a.m[1][3], a.m[2][3]}, BR{b.m[0][3], b.m[1][3], b.m[2][3]}, TL{c.m[0][3], c.m[1][3], c.m[2][3]};
        g.O = TL;
        g.U = (BR - BL) * (1.f / texW);
        g.V = (BL - TL) * (1.f / texH);
        g.mpp = length(g.U);
        if (g.mpp < 1e-6f || length(g.V) < 1e-6f || g.mpp > 0.05f) return false;
        g.N = normalize(cross(g.V, g.U));
        g.valid = true;
        g.fallback = false;
        return true;
    }

    // In front of the head at 1.43 m (the measured dashboard distance); used
    // when Steam's overlay can't be read, e.g. for headless dumps.
    Geometry fallbackGeometry(const Surface &s, const Pose &head) {
        Geometry g;
        v3 fwd = head.rotate({0, 0, -1});
        fwd.y = 0;
        fwd = length(fwd) > 1e-3f ? normalize(fwd) : v3{0, 0, -1};
        v3 right = normalize(cross(fwd, {0, 1, 0}));
        const float mpp = 0.98f / 1920.f;
        v3 centre = head.t + fwd * 1.43f;
        g.U = right * mpp;
        g.V = v3{0, -1, 0} * mpp;
        g.O = centre - g.U * (s.spec.texW * 0.5f) - g.V * (s.spec.texH * 0.5f);
        g.N = -fwd;
        g.mpp = mpp;
        g.valid = true;
        g.fallback = true;
        return g;
    }

    void updateGeometry(Surface &s, const Pose &head, uint64_t now) {
        if (s.steam == vr::k_ulOverlayHandleInvalid && !s.spec.overlayKey.empty() && now - s.findNs > 1000000000ull) {
            s.findNs = now;
            vr::VROverlayHandle_t h = vr::k_ulOverlayHandleInvalid;
            if (vr::VROverlay()->FindOverlay(s.spec.overlayKey.c_str(), &h) == vr::VROverlayError_None) s.steam = h;
        }
        Geometry g;
        if (s.steam != vr::k_ulOverlayHandleInvalid && fetchGeometry(s.steam, float(s.spec.texW), float(s.spec.texH), g)) {
            s.geo = g;
            s.geoNote = "steam";
        } else if (!s.geo.valid || s.geo.fallback) {
            s.geo = fallbackGeometry(s, head);
            s.geoNote = s.steam == vr::k_ulOverlayHandleInvalid ? "fallback(no overlay)" : "fallback(no transform)";
        }
        // the normal must face the viewer
        v3 mid = s.geo.O + s.geo.U * (s.spec.texW * 0.5f) + s.geo.V * (s.spec.texH * 0.5f);
        if (dot(s.geo.N, head.t - mid) < 0) s.geo.N = -s.geo.N;
        s.geoNs = now;
    }

    // Steam surfaces as seen by the feed (only while the dashboard shows them).
    void updateMasks(bool dash, const Pose &head, uint64_t now) {
        if (now - masksNs < 250000000ull) return;
        masksNs = now;
        masks.clear();
        if (!dash || opt.noMask) return;
        // zone = extra metres beyond the margin: side, top, bottom
        auto add = [&](const Geometry &g, float texW, float texH, const float zone[3]) {
            if (!g.valid || g.fallback || masks.size() >= 16) return;
            MaskQuad m;
            float lu = length(g.U), lv = length(g.V);
            m.O = g.O;
            m.U = g.U * (1.f / lu);
            m.V = g.V * (1.f / lv);
            m.u0 = -opt.margin - zone[0];
            m.u1 = texW * lu + opt.margin + zone[0];
            m.v0 = -opt.margin - zone[1];
            m.v1 = texH * lv + opt.margin + zone[2];
            masks.push_back(m);
        };
        // The main window gets a wider "dashboard zone": SteamVR's own panels
        // (grab bar, frame controls, frame menus, side panels) sit around it and
        // glassd cannot see them.
        static const char *kMain = "valve.steam.gamepadui.main";
        const float none[3] = {0, 0, 0};
        std::vector<std::string> done;
        for (auto &s : surfaces) {
            if (!s->spec.visible || !s->geo.valid || s->geo.fallback) continue;
            add(s->geo, float(s->spec.texW), float(s->spec.texH), s->spec.overlayKey == kMain ? opt.zone : none);
            done.push_back(s->spec.overlayKey);
        }
        // Steam's fixed surfaces, if visible and not in the spec.
        static const char *kSteam[] = {kMain, "valve.steam.gamepadui.bar", "valve.steam.gamepadui.floatingfooter",
                                       "valve.steam.gamepadui.keyboard", "valve.steam.gamepadui.notifications",
                                       "valve.steam.gamepadui.volumelevel"};
        for (const char *k : kSteam) {
            if (std::find(done.begin(), done.end(), k) != done.end()) continue;
            vr::VROverlayHandle_t h;
            if (vr::VROverlay()->FindOverlay(k, &h) != vr::VROverlayError_None || !vr::VROverlay()->IsOverlayVisible(h)) continue;
            vr::HmdVector2_t ms{};
            vr::VROverlay()->GetOverlayMouseScale(h, &ms);
            if (ms.v[0] < 2 || ms.v[1] < 2) continue;
            Geometry g;
            if (fetchGeometry(h, ms.v[0], ms.v[1], g)) add(g, ms.v[0], ms.v[1], k == kMain ? opt.zone : none);
        }
        (void)head;
    }

    // -------------------------------------------------------------- poses
    bool samplePose(float predictS, Pose &out) {
        vr::TrackedDevicePose_t p[1];
        vr::VRSystem()->GetDeviceToAbsoluteTrackingPose(vr::TrackingUniverseStanding, predictS, p, 1);
        if (!p[0].bPoseIsValid) return false;
        out = fromVR(p[0].mDeviceToAbsoluteTracking);
        return true;
    }
    bool poseAt(uint64_t ns, Pose &out) {
        if (hist.empty()) return false;
        if (ns <= hist.front().first) { out = hist.front().second; return true; }
        if (ns >= hist.back().first) { out = hist.back().second; return true; }
        for (size_t i = 1; i < hist.size(); i++) {
            if (hist[i].first >= ns) {
                const auto &a = hist[i - 1], &b = hist[i];
                float t = float(double(ns - a.first) / double(std::max<uint64_t>(1, b.first - a.first)));
                out = poseLerp(a.second, b.second, t);
                return true;
            }
        }
        out = hist.back().second;
        return true;
    }

    // ---------------------------------------------------------- room map
    void updateRoom(bool dash, uint64_t now) {
        if (!feed.latest(frame, haveSeq)) return;
        haveSeq = frame.seq;
        envLuma = envSet ? envLuma + (std::max(0.06f, frame.meanLuma) - envLuma) * 0.1f : std::max(0.06f, frame.meanLuma);
        envSet = true;
        Pose hmd;
        const uint64_t target = frame.recvNs - uint64_t(cal.latencyMs * 1e6);
        if (!poseAt(target, hmd)) return;
        const uint64_t t0 = monoNowNs();
        roomTimer.begin();
        room.uploadFeed(frame);
        room.integrate(hmd * eyeToHead, cal, masks);
        room.fill();
        roomTimer.end();
        roomCpuMs = float(double(monoNowNs() - t0) / 1e6);
        roomDirty = true;
        roomWindow++;
        if (!firstRoomNs) firstRoomNs = now;
        (void)dash;
    }

    // ------------------------------------------------------------ render
    // Metres per Steam texture pixel: the main window's, as SteamVR reports it.
    float designMpp() const {
        for (auto &s : surfaces)
            if (s->spec.overlayKey == "valve.steam.gamepadui.main" && s->geo.valid && !s->geo.fallback) return s->geo.mpp;
        return 0.98f / 1920.f;
    }

    void drawGlass(Surface &s, const Geometry &g, const Pose &head, const Material &m, int rx, int ry, int rw, int rh, v3 elem,
                   float shapeCx, float shapeCy, float halfW, float halfH, float rad, float dz) {
        Program &p = progGlass;
        glViewport(rx, ry, rw, rh);
        p.set("uOrigin", float(rx), float(ry));
        p.set("uScale", s.scale);
        p.set("uElemOff", elem.x, elem.y);
        p.set("uShapeC", shapeCx, shapeCy);
        p.set("uHalf", halfW, halfH);
        p.set("uRad", std::min(rad, std::min(halfW, halfH)));
        p.set("uO", g.O.x, g.O.y, g.O.z);
        p.set("uU", g.U.x, g.U.y, g.U.z);
        p.set("uV", g.V.x, g.V.y, g.V.z);
        p.set("uN", g.N.x, g.N.y, g.N.z);
        p.set("uDz", dz);
        p.set("uEye", head.t.x, head.t.y, head.t.z);
        // Material widths are converted with one design scale for all surfaces:
        // Steam's panels share a metres-per-pixel in the scene graph, while the
        // overlay transforms of small popups (e.g. the bar) disagree with it.
        const float mpp = designMpp();
        const float minHalf = std::min(halfW, halfH);
        const float bezel = std::max(1.f, std::min(m.bezelM / mpp, minHalf));
        p.set("uBezel", bezel);
        p.set("uRimW", std::max(1.f, m.rimW / mpp));
        p.set("uRefr", std::min(m.refrM / mpp, 0.8f * bezel));
        p.set("uLensMag", m.lensMag);
        p.set("uFrost", m.frost);
        p.set("uDisp", m.disp);
        p.set("uTintA", m.tintA);
        p.set("uTrans", m.trans);
        p.set("uRim", m.rim);
        p.set("uSheen", m.sheen);
        p.set("uSpec", m.spec);
        p.set("uDarkEdge", m.darkEdge);
        glDrawArrays(GL_TRIANGLES, 0, 3);
    }

    void renderSurface(Surface &s, const Pose &head) {
        DmaTarget &b = s.bufs[s.next];
        glBindFramebuffer(GL_FRAMEBUFFER, b.fbo);
        glViewport(0, 0, s.gw, s.gh);
        glDisable(GL_SCISSOR_TEST);
        glClearColor(0, 0, 0, 0);
        glClear(GL_COLOR_BUFFER_BIT);
        const Geometry &g = s.geo;
        // cover: one or more rounded shapes in the backdrop region
        const Material cover = materialFor(s.spec.material, spec.dial);
        std::vector<ShapeSpec> shapes = s.spec.shapes;
        if (shapes.empty()) shapes.push_back({0, 0, float(s.spec.texW), float(s.spec.texH), s.spec.radius});
        glEnable(GL_SCISSOR_TEST);
        for (const ShapeSpec &q : shapes) {
            int x0 = std::max(0, int(std::floor(q.x * s.scale)) - 1), y0 = std::max(0, int(std::floor(q.y * s.scale)) - 1);
            int x1 = std::min(s.bw, int(std::ceil((q.x + q.w) * s.scale)) + 1), y1 = std::min(s.bh, int(std::ceil((q.y + q.h) * s.scale)) + 1);
            if (x1 <= x0 || y1 <= y0) continue;
            glScissor(x0, y0, x1 - x0, y1 - y0);
            drawGlass(s, g, head, cover, 0, 0, s.bw, s.bh, {0, 0, 0}, q.x + q.w * 0.5f, q.y + q.h * 0.5f, q.w * 0.5f, q.h * 0.5f, q.r, 0.f);
        }
        // slabs: the element's exact size; world point = element position + dz
        for (const SlabSlot &sl : s.slots) {
            const Material m = materialFor(sl.s.material, spec.dial);
            const float ex = sl.s.hasPos ? sl.s.x : (s.spec.texW - sl.s.w) * 0.5f;
            const float ey = sl.s.hasPos ? sl.s.y : (s.spec.texH - sl.s.h) * 0.5f;
            // the slab region is sl.w x sl.h glassd px = (w, h) Steam px at this scale
            const float sw = sl.w / s.scale, sh = sl.h / s.scale;
            glScissor(sl.x, sl.y, sl.w, sl.h);
            drawGlass(s, g, head, m, sl.x, sl.y, sl.w, sl.h, {ex, ey, 0}, sw * 0.5f, sh * 0.5f, sw * 0.5f, sh * 0.5f, sl.s.r, sl.s.dz - 0.0008f);
        }
        glDisable(GL_SCISSOR_TEST);
        s.last = s.next;
        s.next = (s.next + 1) % 3;
        s.rendered = true;
    }

    // Renders every visible surface, waits for the GPU, then hands the new
    // buffers to SteamVR.
    int renderAll(const Pose &head, bool force, uint64_t now) {
        std::vector<Surface *> todo;
        for (auto &s : surfaces) {
            if (!(s->spec.visible || force)) continue;
            if (s->ov == vr::k_ulOverlayHandleInvalid && !ensureOverlay(*s)) continue;
            if (!s->bufs[0].bo && !ensureBuffers(*s)) continue;
            if (!s->bufs[s->next].bo) continue;
            updateGeometry(*s, head, now);
            todo.push_back(s.get());
        }
        if (todo.empty()) return 0;
        const uint64_t t0 = monoNowNs();
        renderTimer.begin();
        Program &p = progGlass;
        p.use();
        glBindVertexArray(vao);
        glDisable(GL_BLEND);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, room.filled.tex);
        p.set("uRoom", 0);
        p.set("uRoomSize", float(room.W), float(room.H));
        p.set("uCenter", room.center.x, room.center.y, room.center.z);
        p.set("uRadius", room.radius);
        p.set("uEnvLuma", envLuma);
        const v3 l2 = normalize(v3{-0.35f, 0.94f, 0});
        p.set("uLight2", l2.x, l2.y);
        const v3 l3 = normalize(v3{-0.3f, 0.85f, 0.45f});
        p.set("uLight3", l3.x, l3.y, l3.z);
        p.set("uDebug", opt.debugView);
        for (Surface *s : todo) renderSurface(*s, head);
        renderTimer.end();
        glFinish();  // SteamVR samples the dmabufs from another process
        cpuMs = cpuMs * 0.9f + float(double(monoNowNs() - t0) / 1e6) * 0.1f;
        renderTimer.poll();
        for (Surface *s : todo) {
            vr::SharedTextureHandle_t h = vr::SharedTextureHandle_t(s->bufs[s->last].vrHandle);
            vr::Texture_t tex = {&h, vr::TextureType_SharedTextureHandle, vr::ColorSpace_Gamma};
            auto e = vr::VROverlay()->SetOverlayTexture(s->ov, &tex);
            if (e != vr::VROverlayError_None && s->submitErrors++ < 3)
                std::printf("SetOverlayTexture(%s): %s\n", s->key.c_str(), vr::VROverlay()->GetOverlayErrorNameFromEnum(e));
            if (e == vr::VROverlayError_None && !s->announced) {
                // what SteamVR now holds for this overlay
                uint32_t tw = 0, th = 0;
                auto te = vr::VROverlay()->GetOverlayTextureSize(s->ov, &tw, &th);
                vr::HmdVector2_t ms{};
                vr::VROverlay()->GetOverlayMouseScale(s->ov, &ms);
                std::printf("first texture on %s: SteamVR reports %ux%u (%s), mouse scale %.0fx%.0f\n", s->key.c_str(), tw, th,
                            vr::VROverlay()->GetOverlayErrorNameFromEnum(te), double(ms.v[0]), double(ms.v[1]));
                s->announced = true;
            }
        }
        frames++;
        framesWindow++;
        return int(todo.size());
    }

    // -------------------------------------------------------------- output
    void writeOut(bool exiting) {
        std::string o;
        char b[1024];  // parseSpec caps names and slab ids at 128 chars, sanitizeKey keys at 100
        std::snprintf(b, sizeof b, "{\"seq\": %lld, \"fps\": %.1f, \"gpu_ms\": %.2f, \"frames\": %llu, \"dashboard\": %s",
                      spec.seq, exiting ? 0.0 : double(fpsNow), double(gpuMs()), (unsigned long long)frames, lastDash ? "true" : "false");
        o += b;
        std::snprintf(b, sizeof b, ", \"room_ms\": %.2f, \"room_updates\": %llu, \"feed\": %s%s", double(roomTimer.have ? roomTimer.ms : roomCpuMs),
                      (unsigned long long)room.updates, jsonEscape(feedState()).c_str(), exiting ? ", \"exiting\": true" : "");
        o += b;
        o += ", \"surfaces\": {";
        bool first = true;
        for (auto &s : surfaces) {
            if (!first) o += ", ";
            first = false;
            const float gw = float(std::max(1, s->gw)), gh = float(std::max(1, s->gh));
            std::snprintf(b, sizeof b, "%s: {\"key\": %s, \"texW\": %d, \"texH\": %d, \"backdrop\": [0, 0, %.6f, %.6f], \"backdropScale\": %.6f",
                          jsonEscape(s->spec.name).c_str(), jsonEscape(s->key).c_str(), s->gw, s->gh, s->bw / gw, s->bh / gh, double(s->scale));
            o += b;
            o += ", \"geometry\": " + jsonEscape(s->geoNote) + ", \"slabs\": {";
            for (size_t i = 0; i < s->slots.size(); i++) {
                const SlabSlot &sl = s->slots[i];
                std::snprintf(b, sizeof b, "%s%s: [%.6f, %.6f, %.6f, %.6f]", i ? ", " : "", jsonEscape(sl.s.id).c_str(), sl.x / gw, sl.y / gh,
                              (sl.x + sl.w) / gw, (sl.y + sl.h) / gh);
                o += b;
            }
            o += "}}";
        }
        o += "}}\n";
        if (!writeAtomic(opt.out, o)) std::printf("cannot write %s\n", opt.out.c_str());
        lastOutNs = monoNowNs();
    }

    float gpuMs() const { return renderTimer.have ? renderTimer.ms : cpuMs; }
    std::string feedState() const {
        if (opt.noFeed) return "off";
        int st = feed.state.load();
        if (st == 2) return "live " + feed.mode;
        if (st == -1) return "failed: " + feed.error;
        return st == 1 ? "opening" : "idle";
    }

    // --------------------------------------------------------------- dumps
    void dumpSurfaces(const std::string &dir) {
        mkdirs(dir);
        for (auto &s : surfaces) {
            if (s->last < 0) continue;
            DmaTarget &b = s->bufs[s->last];
            std::vector<uint8_t> px = readPixels(b.fbo, s->gw, s->gh);
            for (size_t i = 0; i < px.size(); i += 4) {  // premultiplied -> straight for PNG
                unsigned a = px[i + 3];
                if (a > 0 && a < 255)
                    for (int c = 0; c < 3; c++) px[i + c] = uint8_t(std::min(255u, (px[i + c] * 255u + a / 2) / a));
            }
            std::string path = dir + "/" + sanitizeKey(s->spec.name) + ".png";
            stbi_write_png(path.c_str(), s->gw, s->gh, 4, px.data(), s->gw * 4);
            const Geometry &g = s->geo;
            const v3 mid = g.O + g.U * (s->spec.texW * 0.5f) + g.V * (s->spec.texH * 0.5f);
            const v3 toHead = lastRenderHead.t - mid;
            const float ang = std::acos(std::clamp(dot(normalize(toHead), g.N), -1.f, 1.f)) * 57.2958f;
            std::printf("dumped %s (%dx%d, geometry %s: centre %.2f %.2f %.2f, %.2f x %.2f m, head %.2f m away at %.0f deg off-normal)\n",
                        path.c_str(), s->gw, s->gh, s->geoNote.c_str(), mid.x, mid.y, mid.z, length(g.U) * s->spec.texW,
                        length(g.V) * s->spec.texH, length(toHead), ang);
        }
    }
    void dumpRoom(const std::string &path) {
        mkdirs(dirname(path));
        std::vector<uint8_t> px = readPixels(room.filled.fbo, room.W, room.H);
        std::vector<uint8_t> rgb(size_t(room.W) * room.H * 3), known(size_t(room.W) * room.H);
        for (size_t i = 0, n = size_t(room.W) * room.H; i < n; i++)
            for (int c = 0; c < 3; c++) rgb[i * 3 + c] = px[i * 4 + c];
        stbi_write_png(path.c_str(), room.W, room.H, 3, rgb.data(), room.W * 3);
        std::vector<uint8_t> mp = readPixels(room.map[room.cur].fbo, room.W, room.H);
        size_t seen = 0;
        for (size_t i = 0, n = size_t(room.W) * room.H; i < n; i++) {
            known[i] = mp[i * 4 + 3];
            seen += known[i] > 127;
        }
        std::string kp = path;
        size_t dot = kp.rfind(".png");
        kp = (dot == std::string::npos ? kp : kp.substr(0, dot)) + "-known.png";
        stbi_write_png(kp.c_str(), room.W, room.H, 1, known.data(), room.W);
        std::printf("dumped room map %s and %s (%.1f%% of texels seen, %llu updates)\n", path.c_str(), kp.c_str(),
                    100.0 * double(seen) / double(size_t(room.W) * room.H), (unsigned long long)room.updates);
    }

    // ---------------------------------------------------------------- loop
    void status(uint64_t now, bool dash) {
        const double dt = double(now - lastStatusNs) / 1e9;
        float known = 0, lum = 0;
        room.stats(known, lum);
        const uint64_t seen = feed.framesSeen.load();
        std::string geo;
        int vis = 0;
        for (auto &s : surfaces) {
            geo += (geo.empty() ? "" : ",") + s->spec.name + ":" + s->geoNote;
            vis += s->spec.visible;
        }
        std::printf("dash=%d surfaces=%d/%zu fps=%.1f gpu=%.2fms%s cpu=%.2fms room=%.1f/s (%.2fms) feed=%s %.0f/s known=%.0f%% lum=%.2f env=%.2f masks=%zu geo=%s\n",
                    dash, vis, surfaces.size(), double(framesWindow) / dt, double(gpuMs()), renderTimer.have ? "" : "(cpu+finish)",
                    double(cpuMs), double(roomWindow) / dt, double(roomTimer.have ? roomTimer.ms : roomCpuMs), feedState().c_str(),
                    double(seen - feedSeenAtStatus) / dt, double(known * 100), double(lum), double(envLuma), masks.size(),
                    geo.empty() ? "-" : geo.c_str());
        feedSeenAtStatus = seen;
        framesWindow = 0;
        roomWindow = 0;
        lastStatusNs = now;
    }

    void loop() {
        lastStatusNs = lastOutNs = lastLoopNs = monoNowNs();
        uint64_t fpsWindowNs = lastStatusNs, fpsFrames = 0, lastSpecCheckNs = 0;
        const bool wantDump = !opt.dumpDir.empty() || !opt.dumpRoom.empty() || opt.once;
        while (!g_quit) {
            const uint64_t now = monoNowNs();
            const float dt = float(double(now - lastLoopNs) / 1e9);
            lastLoopNs = now;
            if (opt.timeout > 0 && now - startNs > uint64_t(opt.timeout * 1e9)) break;

            vr::VREvent_t ev;
            while (vr::VRSystem()->PollNextEvent(&ev, sizeof ev)) {
                if (ev.eventType == vr::VREvent_Quit) {
                    std::printf("SteamVR is quitting\n");
                    vr::VRSystem()->AcknowledgeQuit_Exiting();
                    g_quit = true;
                }
            }
            if (g_quit) break;

            Pose hmd;
            if (samplePose(0.f, hmd)) {
                hist.emplace_back(now, hmd);
                while (hist.size() > 2 && now - hist.front().first > 1500000000ull) hist.pop_front();
                room.follow(hmd.t, dt);
            }
            if (now - lastSpecCheckNs > 100000000ull) {
                lastSpecCheckNs = now;
                checkSpec();
            }
            for (size_t i = 0; i < retired.size();) {
                if (now >= retired[i].freeAtNs) {
                    releaseBuffer(retired[i].buf);
                    retired.erase(retired.begin() + long(i));
                } else {
                    i++;
                }
            }

            const bool dash = opt.dashOverride >= 0 ? opt.dashOverride == 1 : vr::VROverlay()->IsDashboardVisible();
            if (dash != lastDash) {
                std::printf("dashboard %s\n", dash ? "visible" : "hidden");
                lastDash = dash;
                masksNs = 0;
            }
            const bool warm = opt.noFeed || feed.state.load() == -1 ? now - startNs > uint64_t((opt.warmup + 1) * 1e9)
                                                                    : firstRoomNs && now - firstRoomNs > uint64_t(opt.warmup * 1e9);
            const bool dumpDue = (wantDump && !dumpedOnce && warm) || g_dumpRequest.load();
            const bool active = dash || opt.force || opt.once;
            const float hz = active ? opt.feedHz : opt.idleHz;
            feed.minIntervalNs = hz > 0 ? uint64_t(1e9 / hz) : uint64_t(3600) * 1000000000ull;

            // Head pose for rendering; while tracking is lost keep the last one
            // (or a standing head at the origin) so dumps and priming still work.
            Pose head;
            if (samplePose(opt.predictMs / 1000.f, head)) {
                lastHead = head;
                haveLastHead = true;
            } else if (haveLastHead) {
                head = lastHead;
            } else {
                head.t = {0, 1.6f, 0};
            }
            updateMasks(dash, head, now);
            if (hz > 0) updateRoom(dash, now);
            roomTimer.poll();

            bool anyVisible = false;
            for (auto &s : surfaces) anyVisible |= s->spec.visible;
            // 0.08 deg / 1 mm: well under a frosted texel, above tracking jitter
            const bool moved = poseAngle(head, lastRenderHead) > 0.0014f || length(head.t - lastRenderHead.t) > 0.001f;
            const bool due = now >= nextRenderNs;
            // Room-only changes are slow (EMA, and the area behind the window is
            // masked while it shows): re-render for them at most ~6 Hz.
            const bool roomDue = roomDirty && now - lastRenderNs >= 160000000ull;
            // Continuous rendering only while the dashboard is visible; one priming
            // frame after a layout change so new buffers never sit empty.
            const bool renderNow = !surfaces.empty() &&
                                   ((active && (anyVisible || opt.force || opt.once) && due && (moved || roomDue || layoutDirty)) ||
                                    (layoutDirty && due) || dumpDue);
            if (renderNow) {
                const bool forced = opt.force || opt.once || dumpDue || !active;
                const uint64_t before = frames;
                if (renderAll(head, forced, now) > 0) {
                    lastRenderHead = head;
                    lastRenderNs = now;
                    roomDirty = layoutDirty = false;
                    fpsFrames++;
                }
                nextRenderNs = now + uint64_t(1e9 / opt.fps);
                if (outPending || (before == 0 && frames > 0)) {
                    writeOut(false);
                    outPending = false;
                }
            }
            if (outPending && now - outPendingSinceNs > 500000000ull) {
                writeOut(false);  // nothing could be rendered; announce the layout anyway
                outPending = false;
            }
            if (dumpDue && (renderNow || surfaces.empty())) {
                const bool sig = g_dumpRequest.exchange(false);
                std::string dir = !opt.dumpDir.empty() ? opt.dumpDir : (sig ? "/tmp/lgs/glassd-dump" : "");
                std::string roomPath = !opt.dumpRoom.empty() ? opt.dumpRoom : (sig ? "/tmp/lgs/glassd-dump/room.png" : "");
                if (!roomPath.empty()) dumpRoom(roomPath);
                if (!dir.empty()) dumpSurfaces(dir);
                dumpedOnce = true;
                if (opt.once) {
                    writeOut(false);
                    break;
                }
            }

            if (now - fpsWindowNs >= 1000000000ull) {
                fpsNow = float(double(fpsFrames) * 1e9 / double(now - fpsWindowNs));
                fpsFrames = 0;
                fpsWindowNs = now;
            }
            if (now - lastOutNs >= 2000000000ull) writeOut(false);
            if (now - lastStatusNs >= 5000000000ull) status(now, dash);

            // ~200 Hz while active (pose history + frame pacing), ~100 Hz idle
            usleep(active ? 4000 : 10000);
        }
    }
};

}  // namespace

int main(int argc, char **argv) {
    setvbuf(stdout, nullptr, _IOLBF, 0);
    Options opt;
    if (!parseArgs(argc, argv, opt)) {
        usage();
        return 2;
    }
    struct sigaction sa {};
    sa.sa_handler = onSignal;
    sigaction(SIGTERM, &sa, nullptr);
    sigaction(SIGINT, &sa, nullptr);
    sigaction(SIGHUP, &sa, nullptr);
    sigaction(SIGUSR1, &sa, nullptr);
    signal(SIGPIPE, SIG_IGN);
    std::printf("starting (spec %s, out %s, scale %.2f, pid %d)\n", opt.demo ? "<demo>" : opt.spec.c_str(), opt.out.c_str(),
                double(opt.scale), int(getpid()));
    Glassd g(opt);
    int rc = g.run();
    std::printf("exit %d\n", rc);
    return rc;
}
