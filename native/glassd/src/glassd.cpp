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
// Writes the layout (UV rects, backdropScale) plus fps / gpu_ms / health to
// /dev/shm/lgs/glassd-out.json. Renders only while the dashboard is visible.
//
// Exit codes: 0 stopped (signal, --timeout, parent gone), 1 setup error,
// 2 bad arguments, 75 temporary (another glassd holds the lock, SteamVR is not
// running or went away, overlays could not be kept alive): not a crash.
#include <openvr.h>

#include <dirent.h>
#include <signal.h>
#include <sys/file.h>
#include <sys/inotify.h>
#include <sys/prctl.h>
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
#include <set>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

#include "atlas.h"
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

constexpr int kExitTemp = 75;  // EX_TEMPFAIL: not a crash, try again later
constexpr const char *kMainKey = "valve.steam.gamepadui.main";
constexpr const char *kDefaultPrefix = "glassd.";
constexpr const char *kShmDir = "/dev/shm/lgs";
constexpr int kMaxShapes = 8;
constexpr uint64_t kMs = 1000000ull;
constexpr uint64_t kGraceNs = 400 * kMs;       // no room integration this long after a dashboard change
constexpr uint64_t kGhostNs = 600 * kMs;       // a removed slab's cell stays drawn (and reserved) this long
constexpr uint64_t kMaskPeriodNs = 250 * kMs;  // feed masks are rebuilt (with fresh geometry) this often

std::atomic<bool> g_quit{false};
std::atomic<bool> g_dumpRequest{false}, g_loseRequest{false};
std::atomic<int> g_exitCode{0};
void onSignal(int s) {
    if (s == SIGUSR1) g_dumpRequest = true;
    else if (s == SIGUSR2) g_loseRequest = true;
    else g_quit = true;
}
void quitWith(int code) {
    g_exitCode = code;
    g_quit = true;
}

// ------------------------------------------------------------------ options
struct Options {
    std::string spec = "/dev/shm/lgs/glassd.json";
    std::string out;  // default: /dev/shm/lgs/glassd-out.json, or /dev/shm/lgs/<prefix>out.json for another prefix
    std::string dumpDir, dumpRoom, shaderDir;
    std::string keyPrefix = kDefaultPrefix;
    std::string feedDev = "/dev/video99";
    bool once = false, force = false, demo = false, noFeed = false, noMask = false, orphanOk = false;
    float zone[3] = {0.15f, 0.08f, 0.25f};  // main window mask zone: side, top, bottom (m)
    int debugView = 0;
    int dashOverride = -1;  // --dash on|off (tests): -1 = ask SteamVR
    float scale = 0.75f;      // backdropScale
    float fps = 72.f;         // max render rate while visible
    float feedHz = 36.f;      // room map updates while visible (the feed streams)
    float idleHz = 0.2f;      // one-frame feed shots per second otherwise (0 = none)
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
        "  --out FILE         layout + stats output (default /dev/shm/lgs/glassd-out.json; with another\n"
        "                     --key-prefix P: /dev/shm/lgs/<P>out.json)\n"
        "  --demo             use a built-in spec (main window + 3 slabs) instead of --spec\n"
        "  --once             integrate the feed for --warmup s, render one frame of every surface, exit\n"
        "  --dump DIR         write every surface texture to DIR/<name>.png after one frame\n"
        "  --dump-room PATH   write the filled room map PNG (and PATH-known.png); delete after looking\n"
        "  --force            render even while the dashboard is hidden\n"
        "  --scale S          backdropScale, glassd px per Steam px (default 0.75)\n"
        "  --fps N            max render rate while visible (default 72)\n"
        "  --feed-hz N        room map updates per second while the glass shows (default 36)\n"
        "  --idle-hz N        one-frame feed shots per second otherwise (default 0.2, 0 = none)\n"
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
        "  --orphan-ok        keep running when the parent process exits (detached lab runs)\n"
        "SIGUSR1 dumps the room map and surfaces (to the --dump paths, else /tmp/lgs/glassd-dump/).\n"
        "SIGUSR2 (test aid) treats every overlay as lost: destroys and recreates it.\n"
        "Exit codes: 0 stopped, 1 setup error, 2 bad arguments, 75 temporary (lock held, SteamVR absent or gone).\n");
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
        else if (a == "--orphan-ok") o.orphanOk = true;
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
    if (o.keyPrefix.empty()) { std::fprintf(stderr, "--key-prefix must not be empty\n"); return false; }
    // A test instance (another key prefix) never shares the daemon's output file.
    if (o.out.empty())
        o.out = o.keyPrefix == kDefaultPrefix ? std::string(kShmDir) + "/glassd-out.json"
                                              : std::string(kShmDir) + "/" + o.keyPrefix + "out.json";
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
    // Cover shapes. Explicit (hasShapes, possibly empty = no cover), or absent:
    // then a "window" surface is covered whole and any other gets no cover.
    bool hasShapes = false;
    std::vector<ShapeSpec> shapes;
    // Optional world quad from the daemon (overrides the overlay transform):
    // world position of Steam px (0,0) and world steps per Steam px right / down.
    bool hasQuad = false;
    v3 qO, qU, qV;
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

bool readVec3(const JVal *v, v3 &out) {
    if (!v || v->type != JVal::Arr || v->a.size() != 3) return false;
    for (const JVal &e : v->a)
        if (e.type != JVal::Num || !std::isfinite(e.n)) return false;
    out = {float(v->a[0].n), float(v->a[1].n), float(v->a[2].n)};
    return true;
}

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
            ss.hasShapes = true;
            for (const JVal &q : sh->a) {
                ShapeSpec p{float(q.num("x", 0)), float(q.num("y", 0)), float(q.num("w", 0)), float(q.num("h", 0)),
                            float(q.num("r", ss.radius))};
                // clip to the texture
                const float x0 = std::max(0.f, p.x), y0 = std::max(0.f, p.y);
                const float x1 = std::min(float(ss.texW), p.x + p.w), y1 = std::min(float(ss.texH), p.y + p.h);
                if (x1 - x0 < 1 || y1 - y0 < 1) continue;
                p = {x0, y0, x1 - x0, y1 - y0, std::max(0.f, p.r)};
                ss.shapes.push_back(p);
            }
        }
        if (const JVal *q = s.get("quad"); q && q->type == JVal::Obj)
            ss.hasQuad = readVec3(q->get("O"), ss.qO) && readVec3(q->get("U"), ss.qU) && readVec3(q->get("V"), ss.qV);
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
    int x = 0, y = 0, w = 0, h = 0;  // cell in the glassd texture
    uint64_t ghostUntilNs = 0;       // ghosts: removed from the spec, drawn until then
};

struct Surface {
    SurfSpec spec;
    std::string key;
    vr::VROverlayHandle_t ov = vr::k_ulOverlayHandleInvalid;
    vr::VROverlayHandle_t steam = vr::k_ulOverlayHandleInvalid;
    int gw = 0, gh = 0, bw = 0, bh = 0;
    float scale = 0.75f;
    Atlas atlas;
    std::vector<SlabSlot> slots, ghosts;
    std::set<std::string> dropped;  // slabs that did not fit (logged once)
    DmaTarget bufs[3];
    bool cleared[3] = {false, false, false};  // buffer fully cleared once since it was created
    int next = 0, last = -1;
    // geometry: geo is the last good quad (or a fallback); geoOk = the latest
    // fetch succeeded and was plausible; rawGeo = the overlay's own quad when
    // geo was rescaled to the main window's scale
    Geometry geo, rawGeo;
    bool geoOk = false, rescaled = false;
    uint64_t geoOkNs = 0, findNs = 0;
    std::string geoNote = "none", geoLogged;
    bool rendered = false, announced = false, warnedShapes = false, atlasOn = false;
    int submittedW = 0, submittedH = 0;  // what SteamVR holds (mouse scale follows it)
    int submitFails = 0, createTries = 0;
    uint64_t createNs = 0, submitFailSinceNs = 0, lastSubmitNs = 0;
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

// First process whose comm is `name` (comm is at most 15 chars), or -1.
int findPid(const char *name) {
    DIR *d = opendir("/proc");
    if (!d) return -1;
    int found = -1;
    while (dirent *e = readdir(d)) {
        if (!std::isdigit((unsigned char)e->d_name[0])) continue;
        std::string p = std::string("/proc/") + e->d_name + "/comm";
        FILE *f = std::fopen(p.c_str(), "r");
        if (!f) continue;
        char comm[64] = {};
        if (std::fgets(comm, sizeof comm, f)) {
            comm[std::strcspn(comm, "\n")] = 0;
            if (std::strcmp(comm, name) == 0) found = std::atoi(e->d_name);
        }
        std::fclose(f);
        if (found > 0) break;
    }
    closedir(d);
    return found;
}
bool pidIs(int pid, const char *name) {
    std::string p = "/proc/" + std::to_string(pid) + "/comm";
    FILE *f = std::fopen(p.c_str(), "r");
    if (!f) return false;
    char comm[64] = {};
    bool ok = std::fgets(comm, sizeof comm, f) != nullptr;
    std::fclose(f);
    comm[std::strcspn(comm, "\n")] = 0;
    return ok && std::strcmp(comm, name) == 0;
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
    return s == std::string::npos ? "." : s == 0 ? "/" : p.substr(0, s);
}
std::string basename(const std::string &p) {
    size_t s = p.rfind('/');
    return s == std::string::npos ? p : p.substr(s + 1);
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
// Exclusive, non-blocking flock on `path` (created). Returns the fd or -1.
int lockPath(const std::string &path) {
    mkdirs(dirname(path));
    int fd = open(path.c_str(), O_CREAT | O_RDWR | O_CLOEXEC, 0644);
    if (fd < 0) return -1;
    if (flock(fd, LOCK_EX | LOCK_NB) != 0) {
        close(fd);
        return -1;
    }
    return fd;
}
int roundUp(int v, int m) { return ((v + m - 1) / m) * m; }

// ===================================================================== glassd
class Glassd {
 public:
    explicit Glassd(const Options &o) : opt(o) {}

    int run() {
        int rc = 1;
        if (!setup(rc)) {
            teardown();
            return rc;
        }
        loop();
        teardown();
        return g_exitCode.load();
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
    uint64_t masksNs = 0, masksBuiltNs = 0;
    bool masksComplete = false;
    int lockOut = -1, lockKey = -1;
    int inoFd = -1, inoWd = -1;
    uint64_t inoRetryNs = 0;
    GpuTimer renderTimer, roomTimer;
    float envLuma = 0.25f;
    bool envSet = false;
    float mainMpp = 0;  // metres per Steam px of the main window, from its overlay (0 = unknown)
    // health
    int origPpid = 0, vrserverPid = -1, compositorPid = -1;
    uint64_t lastHealthNs = 0, lastSubmitNs = 0;
    std::deque<uint64_t> overlayLosses;
    // dashboard / room gating
    uint64_t dashChangeNs = 0, lastShotNs = 0;
    bool graceDone = true;
    uint64_t roomSkipped = 0;
    // stats
    uint64_t startNs = 0, frames = 0, framesWindow = 0, roomWindow = 0, lastStatusNs = 0, lastOutNs = 0;
    uint64_t feedSeenAtStatus = 0, feedAttachedAtStatus = 0, firstRoomNs = 0;
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
    bool setup(int &rc) {
        startNs = monoNowNs();
        // Stop with the parent (lgs_shell): an orphan would keep its overlays
        // and the lock, and block its successor.
        origPpid = getppid();
        if (!opt.orphanOk && origPpid > 1) {
            prctl(PR_SET_PDEATHSIG, SIGTERM);
            if (getppid() != origPpid) {
                std::fprintf(stderr, "parent already gone\n");
                rc = 0;
                return false;
            }
        }
        // One instance per output file and per overlay key prefix.
        mkdirs(dirname(opt.out));
        const std::string outLock = opt.out + ".lock";
        const std::string keyLock = std::string(kShmDir) + "/" + sanitizeKey(opt.keyPrefix) + "lock";
        if ((lockOut = lockPath(outLock)) < 0) {
            std::fprintf(stderr, "another glassd holds %s\n", outLock.c_str());
            rc = kExitTemp;
            return false;
        }
        if ((lockKey = lockPath(keyLock)) < 0) {
            std::fprintf(stderr, "another glassd holds %s (key prefix %s)\n", keyLock.c_str(), opt.keyPrefix.c_str());
            rc = kExitTemp;
            return false;
        }
        vrserverPid = findPid("vrserver");
        if (vrserverPid <= 0) {
            std::fprintf(stderr, "SteamVR (vrserver) is not running; not starting it\n");
            rc = kExitTemp;
            return false;
        }
        compositorPid = findPid("vrcompositor");
        vr::EVRInitError err = vr::VRInitError_None;
        vr::VR_Init(&err, vr::VRApplication_Overlay);
        if (err != vr::VRInitError_None) {
            std::fprintf(stderr, "VR_Init: %s\n", vr::VR_GetVRInitErrorAsEnglishDescription(err));
            rc = kExitTemp;
            return false;
        }
        if (!vr::VROverlay() || !vr::VRSystem() || !vr::VRIPCResourceManager()) {
            std::fprintf(stderr, "OpenVR interfaces missing\n");
            return false;
        }
        if (!gfx.init()) return false;
        std::printf("GL %s | %s | timer queries %s | half-float targets %s\n", gfx.version.c_str(), gfx.renderer.c_str(),
                    gfx.timerQuery ? "yes" : "no", gfx.halfFloatTargets ? "yes" : "no");
        std::printf("vrserver pid %d, vrcompositor pid %d, parent pid %d%s\n", vrserverPid, compositorPid, origPpid,
                    opt.orphanOk ? " (orphan ok)" : "");
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
        } else {
            watchSpec();
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
        if (inoFd >= 0) close(inoFd);
        if (lockKey >= 0) close(lockKey);
        if (lockOut >= 0) close(lockOut);
    }

    // ------------------------------------------------------- spec watching
    // inotify on the spec's directory, so a new spec is picked up at once
    // (the 10 Hz stat poll stays as a fallback).
    void watchSpec() {
        if (inoFd < 0) inoFd = inotify_init1(IN_NONBLOCK | IN_CLOEXEC);
        if (inoFd < 0 || inoWd >= 0) return;
        inoWd = inotify_add_watch(inoFd, dirname(opt.spec).c_str(), IN_CLOSE_WRITE | IN_MOVED_TO | IN_CREATE | IN_DELETE_SELF | IN_MOVE_SELF);
        inoRetryNs = monoNowNs() + 2000000000ull;
    }
    // True when an event concerns the spec file (or the watch needs renewing).
    bool drainSpecEvents() {
        if (inoFd < 0) return false;
        bool hit = false;
        alignas(inotify_event) char buf[4096];
        const std::string base = basename(opt.spec);
        while (true) {
            ssize_t n = read(inoFd, buf, sizeof buf);
            if (n <= 0) break;
            for (ssize_t i = 0; i < n;) {
                auto *e = reinterpret_cast<inotify_event *>(buf + i);
                if (e->mask & (IN_IGNORED | IN_DELETE_SELF | IN_MOVE_SELF)) inoWd = -1;
                if (e->len && base == e->name) hit = true;
                i += ssize_t(sizeof(inotify_event) + e->len);
            }
        }
        return hit;
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
        s.submittedW = s.submittedH = 0;
        vr::VROverlay()->SetOverlayFlag(s.ov, vr::VROverlayFlags_IsPremultiplied, true);
        vr::VROverlay()->SetOverlayWidthInMeters(s.ov, 1.0f);
        std::printf("created overlay %s\n", s.key.c_str());
        return true;
    }

    // Our overlay is gone or refuses textures (e.g. vrcompositor restarted):
    // drop it and its imports; the next render recreates both. Three losses
    // within 30 s end glassd (exit 75) so the daemon starts a fresh one.
    void loseOverlay(Surface &s, const char *why) {
        const uint64_t now = monoNowNs();
        std::printf("overlay %s lost (%s); recreating it\n", s.key.c_str(), why);
        if (s.ov != vr::k_ulOverlayHandleInvalid) vr::VROverlay()->DestroyOverlay(s.ov);
        s.ov = vr::k_ulOverlayHandleInvalid;
        for (auto &b : s.bufs) releaseBuffer(b);
        for (bool &c : s.cleared) c = false;
        s.next = 0;
        s.last = -1;
        s.rendered = s.announced = false;
        s.submittedW = s.submittedH = 0;
        s.submitFails = 0;
        s.createTries = 0;
        layoutDirty = outPending = true;
        outPendingSinceNs = now;
        // losses within 1 s of each other (all surfaces at once) are one incident
        if (!overlayLosses.empty() && now - overlayLosses.back() < 1000000000ull) return;
        overlayLosses.push_back(now);
        while (!overlayLosses.empty() && now - overlayLosses.front() > 30000000000ull) overlayLosses.pop_front();
        if (overlayLosses.size() >= 3) {
            std::printf("overlays keep failing (%zu losses in 30 s); exiting for a fresh start\n", overlayLosses.size());
            quitWith(kExitTemp);
        }
    }

    // ------------------------------------------------------------ layout
    // Texture = backdrop (bw x bh) on top, slab atlas below. The atlas has its
    // final height from the start (the backdrop's height, 256..1024 rows), so
    // slabs coming and going (focus moves, a sheet opening) never change the
    // texture size, the backdrop UV or the mouse scale while the Steam window
    // keeps its size. Rendering touches only the backdrop and live cells, so
    // the headroom costs memory, not bandwidth.
    static int atlasHeight(int bh) { return roundUp(bh + Atlas::kGutter + std::clamp(bh, 256, 1024), 32); }

    void resizeTexture(Surface &s, int gw, int gh) {
        if (s.gw == gw && s.gh == gh) return;
        const uint64_t now = monoNowNs();
        for (auto &b : s.bufs) {
            if (b.bo) retired.push_back({b, now + 500000000ull});
            b = DmaTarget{};
        }
        s.gw = gw;
        s.gh = gh;
        s.next = 0;
        s.last = -1;
        s.rendered = false;
        for (bool &c : s.cleared) c = false;
        std::printf("layout %s -> %s %dx%d, backdrop %dx%d (scale %.4f)\n", s.spec.name.c_str(), s.key.c_str(), gw, gh, s.bw, s.bh,
                    double(s.scale));
    }

    void dropSlab(Surface &s, const SlabSpec &b, int w, int h, const char *why) {
        if (s.dropped.insert(b.id).second)
            std::printf("slab %s/%s (%dx%d px) %s; it stays flat\n", s.spec.name.c_str(), b.id.c_str(), w, h, why);
    }

    // Re-packs every live slab plus `extra` into the atlas. Commits (moving
    // live cells: their UVs change, logged) only if everything fits.
    bool repack(Surface &s, SlabSlot *extra) {
        std::vector<SlabSlot *> items;
        for (auto &sl : s.slots) items.push_back(&sl);
        if (extra) items.push_back(extra);
        std::stable_sort(items.begin(), items.end(), [](const SlabSlot *a, const SlabSlot *b) {
            if (a->h != b->h) return a->h > b->h;
            return a->s.id < b->s.id;
        });
        Atlas a;
        a.reset(s.bw, s.bh + Atlas::kGutter, s.gh);
        a.tallHint = s.atlas.tallHint;
        std::vector<std::pair<int, int>> pos;
        for (SlabSlot *it : items) {
            int x, y;
            if (!a.alloc(it->w, it->h, x, y)) return false;
            pos.push_back({x, y});
        }
        for (size_t i = 0; i < items.size(); i++) {
            items[i]->x = pos[i].first;
            items[i]->y = pos[i].second;
        }
        s.atlas = a;
        std::printf("atlas %s re-packed (%zu slabs placed again)\n", s.spec.name.c_str(), items.size());
        return true;
    }

    bool place(Surface &s, SlabSlot &sl) {
        int x, y;
        if (s.atlas.alloc(sl.w, sl.h, x, y)) {
            sl.x = x;
            sl.y = y;
            return true;
        }
        // reclaim the ghosts' cells early
        if (!s.ghosts.empty()) {
            for (auto &g : s.ghosts) s.atlas.release(g.x, g.y);
            s.ghosts.clear();
            if (s.atlas.alloc(sl.w, sl.h, x, y)) {
                sl.x = x;
                sl.y = y;
                return true;
            }
        }
        // compact (the texture never grows)
        return repack(s, &sl);
    }

    // Brings the surface's slab cells in line with its spec. Existing cells
    // never move; removed or resized slabs become ghosts for kGhostNs (still
    // drawn, so a scene graph that lags behind shows the right glass).
    // Returns true when the layout (texture size or announced UVs) changed.
    bool syncSlots(Surface &s, uint64_t now) {
        const SurfSpec &sp = s.spec;
        const int bw = std::max(1, int(std::lround(sp.texW * opt.scale)));
        const float scale = float(bw) / float(sp.texW);
        const int bh = std::max(1, int(std::lround(sp.texH * scale)));
        bool changed = false;
        // The window (main) has its atlas from the start; other surfaces get
        // one with their first slab (one texture resize) and keep it. Popups
        // that never pop anything stay backdrop-sized.
        const bool wantAtlas = s.atlasOn || sp.material == "window" || !sp.slabs.empty();
        if (bw != s.bw || bh != s.bh || s.gh == 0 || wantAtlas != s.atlasOn) {
            s.bw = bw;
            s.bh = bh;
            s.scale = scale;
            s.slots.clear();
            s.ghosts.clear();
            s.dropped.clear();
            s.atlasOn = wantAtlas;
            resizeTexture(s, bw, wantAtlas ? atlasHeight(bh) : bh);
            s.atlas.reset(bw, bh + Atlas::kGutter, s.gh);
            changed = true;
        }
        auto cellSize = [&](const SlabSpec &b, int &w, int &h) {
            w = std::max(1, int(std::lround(b.w * s.scale)));
            h = std::max(1, int(std::lround(b.h * s.scale)));
        };
        auto findSpec = [&](const std::string &id) -> const SlabSpec * {
            for (const SlabSpec &b : sp.slabs)
                if (b.id == id) return &b;
            return nullptr;
        };
        // removed or resized -> ghosts; the rest take the new positions
        for (size_t i = 0; i < s.slots.size();) {
            SlabSlot &sl = s.slots[i];
            const SlabSpec *b = findSpec(sl.s.id);
            int w = 0, h = 0;
            if (b) cellSize(*b, w, h);
            if (b && w == sl.w && h == sl.h) {
                sl.s = *b;
                i++;
                continue;
            }
            sl.ghostUntilNs = now + kGhostNs;
            s.ghosts.push_back(sl);
            s.slots.erase(s.slots.begin() + long(i));
            changed = true;
        }
        // new slabs, tallest first
        std::vector<const SlabSpec *> fresh;
        for (const SlabSpec &b : sp.slabs) {
            bool have = false;
            for (auto &sl : s.slots) have |= sl.s.id == b.id;
            if (!have) fresh.push_back(&b);
        }
        std::stable_sort(fresh.begin(), fresh.end(), [](const SlabSpec *a, const SlabSpec *b) {
            if (a->h != b->h) return a->h > b->h;
            return a->id < b->id;
        });
        const int maxH = s.gh - (s.bh + Atlas::kGutter);
        for (const SlabSpec *b : fresh) {
            SlabSlot sl;
            sl.s = *b;
            cellSize(*b, sl.w, sl.h);
            // a ghost of the same id and size comes back to life
            bool revived = false;
            for (size_t k = 0; k < s.ghosts.size(); k++) {
                if (s.ghosts[k].s.id == b->id && s.ghosts[k].w == sl.w && s.ghosts[k].h == sl.h) {
                    SlabSlot g = s.ghosts[k];
                    g.s = *b;
                    g.ghostUntilNs = 0;
                    s.ghosts.erase(s.ghosts.begin() + long(k));
                    s.slots.push_back(g);
                    revived = changed = true;
                    break;
                }
            }
            if (revived) continue;
            if (sl.w > s.bw) { dropSlab(s, *b, sl.w, sl.h, "is wider than the texture"); continue; }
            if (sl.h > maxH) { dropSlab(s, *b, sl.w, sl.h, "is taller than the atlas"); continue; }
            if (!place(s, sl)) { dropSlab(s, *b, sl.w, sl.h, "does not fit the atlas"); continue; }
            s.dropped.erase(b->id);
            s.slots.push_back(sl);
            changed = true;
        }
        // forget drop notes of slabs that left the spec
        for (auto it = s.dropped.begin(); it != s.dropped.end();) it = findSpec(*it) ? std::next(it) : s.dropped.erase(it);
        return changed;
    }

    void expireGhosts(uint64_t now) {
        for (auto &s : surfaces)
            for (size_t i = 0; i < s->ghosts.size();) {
                if (now >= s->ghosts[i].ghostUntilNs) {
                    s->atlas.release(s->ghosts[i].x, s->ghosts[i].y);
                    s->ghosts.erase(s->ghosts.begin() + long(i));
                } else {
                    i++;
                }
            }
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
        // The mouse scale is set together with the first texture of this size
        // (renderAll), not here: the scene graph sizes the panel from it.
        return true;
    }

    void applySpec(const Spec &ns) {
        spec = ns;
        haveSpec = true;
        const uint64_t now = monoNowNs();
        // drop surfaces that left the spec
        for (size_t i = 0; i < surfaces.size();) {
            bool keep = false;
            for (auto &s : ns.surfaces) keep |= s.name == surfaces[i]->spec.name;
            if (!keep) {
                std::printf("surface %s removed\n", surfaces[i]->spec.name.c_str());
                releaseSurface(*surfaces[i], true);
                surfaces.erase(surfaces.begin() + long(i));
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
            }
            if (s->spec.overlayKey != ss.overlayKey) {
                s->steam = vr::k_ulOverlayHandleInvalid;
                s->findNs = 0;
                s->geo = s->rawGeo = Geometry{};
                s->geoOk = false;
            }
            if (s->spec.hasShapes != ss.hasShapes || s->spec.material != ss.material || s->spec.shapes.size() != ss.shapes.size())
                s->warnedShapes = false;
            s->spec = ss;
            syncSlots(*s, now);
            ensureOverlay(*s);
            ensureBuffers(*s);
        }
        // The new layout is announced after the next (priming) render, so the
        // scene graph never points at buffers that hold nothing yet.
        layoutDirty = true;
        roomDirty = true;
        outPending = true;
        outPendingSinceNs = now;
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
        if (vr::VROverlay()->GetOverlayMouseScale(h, &ms) != vr::VROverlayError_None) return false;
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
        if (!std::isfinite(g.mpp) || g.mpp < 1e-6f || length(g.V) < 1e-6f || g.mpp > 0.05f) return false;
        g.N = normalize(cross(g.V, g.U));
        g.valid = true;
        g.fallback = false;
        return true;
    }

    // Why a quad cannot be where Steam's panel shows, or nullptr. An overlay
    // without a world placement reports overlay-local coordinates (a quad at
    // the origin), and a hidden one can sit anywhere.
    const char *implausible(const Geometry &g, float texW, float texH, const Pose &head) const {
        const v3 mid = g.O + g.U * (texW * 0.5f) + g.V * (texH * 0.5f);
        if (length(mid) < 0.05f) return "quad at the origin";
        if (!haveLastHead) return nullptr;
        const v3 toHead = head.t - mid;
        const float dist = length(toHead);
        if (dist < 0.3f || dist > 5.f) return "quad not 0.3-5 m from the head";
        if (std::fabs(dot(normalize(toHead), normalize(cross(g.V, g.U)))) < 0.2f) return "quad edge-on to the head";
        return nullptr;
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

    // Steam's popups (bar, footer, ...) report overlay transforms whose scale
    // disagrees with where the scene graph draws them: the bar claims
    // 0.2 mm/px against main's 0.51, although its scene-graph panel uses the
    // same metres-per-pixel as the window. Keep the reported centre and
    // orientation, but use the main window's scale. Returns the ratio found.
    float rescaleToMain(Geometry &g, float texW, float texH) const {
        if (mainMpp <= 0) return 1.f;
        const float ratio = g.mpp / mainMpp;
        if (ratio > 0.92f && ratio < 1.087f) return 1.f;
        const v3 mid = g.O + g.U * (texW * 0.5f) + g.V * (texH * 0.5f);
        g.U = normalize(g.U) * mainMpp;
        g.V = normalize(g.V) * mainMpp;
        g.O = mid - g.U * (texW * 0.5f) - g.V * (texH * 0.5f);
        g.mpp = mainMpp;
        return ratio;
    }

    void faceHead(Geometry &g, float texW, float texH, const Pose &head) {
        const v3 mid = g.O + g.U * (texW * 0.5f) + g.V * (texH * 0.5f);
        if (dot(g.N, head.t - mid) < 0) g.N = -g.N;
    }

    // Brings s.geo up to date. With fetch = false (priming renders while the
    // dashboard is hidden) it never asks SteamVR and only fills a fallback.
    void refreshGeometry(Surface &s, const Pose &head, uint64_t now, bool fetch) {
        const float tw = float(s.spec.texW), th = float(s.spec.texH);
        if (s.spec.hasQuad) {
            Geometry g;
            g.O = s.spec.qO;
            g.U = s.spec.qU;
            g.V = s.spec.qV;
            g.mpp = length(g.U);
            g.N = normalize(cross(g.V, g.U));
            g.valid = g.mpp > 1e-6f && length(g.V) > 1e-6f;
            if (g.valid) {
                s.geo = s.rawGeo = g;
                s.geoOk = true;
                s.rescaled = false;
                s.geoOkNs = now;
                s.geoNote = "spec";
                faceHead(s.geo, tw, th, head);
                return;
            }
        }
        if (!fetch) {
            if (!s.geo.valid) {
                s.geo = fallbackGeometry(s, head);
                s.geoNote = "fallback(not fetched)";
            }
            faceHead(s.geo, tw, th, head);
            return;
        }
        // (Re)find Steam's overlay: every 1 s while unknown, and every 2 s
        // re-validate the handle (Steam's overlays come back with new handles
        // after a Steam restart).
        if (!s.spec.overlayKey.empty() && now - s.findNs > (s.steam == vr::k_ulOverlayHandleInvalid ? 1000000000ull : 2000000000ull)) {
            s.findNs = now;
            vr::VROverlayHandle_t h = vr::k_ulOverlayHandleInvalid;
            if (vr::VROverlay()->FindOverlay(s.spec.overlayKey.c_str(), &h) != vr::VROverlayError_None) h = vr::k_ulOverlayHandleInvalid;
            if (h != s.steam && s.steam != vr::k_ulOverlayHandleInvalid && h != vr::k_ulOverlayHandleInvalid)
                std::printf("%s: Steam overlay %s has a new handle\n", s.spec.name.c_str(), s.spec.overlayKey.c_str());
            s.steam = h;
        }
        Geometry g;
        const char *why = nullptr;
        if (s.spec.overlayKey.empty()) why = "no overlay key";
        else if (s.steam == vr::k_ulOverlayHandleInvalid) why = "no overlay";
        else if (!fetchGeometry(s.steam, tw, th, g)) {
            why = "no transform";
            // a stale handle errors out: find it again (rate-limited above)
            s.steam = vr::k_ulOverlayHandleInvalid;
        } else {
            why = implausible(g, tw, th, head);  // the handle is fine, the overlay is not placed
        }
        if (!why) {
            const bool isMain = s.spec.overlayKey == kMainKey;
            if (isMain) mainMpp = g.mpp;
            s.rawGeo = g;
            const float ratio = isMain ? 1.f : rescaleToMain(g, tw, th);
            s.rescaled = ratio != 1.f;
            s.geo = g;
            s.geoOk = true;
            s.geoOkNs = now;
            if (s.rescaled) {
                char b[64];
                std::snprintf(b, sizeof b, "steam(rescaled x%.2f)", double(1.f / ratio));
                s.geoNote = b;
            } else {
                s.geoNote = "steam";
            }
        } else {
            s.geoOk = false;
            if (s.geo.valid && !s.geo.fallback) {
                s.geoNote = std::string("stale(") + why + ")";
            } else {
                s.geo = fallbackGeometry(s, head);
                s.geoNote = std::string("fallback(") + why + ")";
            }
        }
        if (s.geoNote != s.geoLogged) {
            const v3 mid = s.geo.O + s.geo.U * (tw * 0.5f) + s.geo.V * (th * 0.5f);
            std::printf("geometry %s: %s (centre %.2f %.2f %.2f, %.2f x %.2f m)\n", s.spec.name.c_str(), s.geoNote.c_str(), mid.x,
                        mid.y, mid.z, length(s.geo.U) * tw, length(s.geo.V) * th);
            s.geoLogged = s.geoNote;
        }
        faceHead(s.geo, tw, th, head);
    }

    // Steam surfaces as seen by the feed, from geometry fetched now. Only while
    // the dashboard shows them. masksComplete says whether every visible spec
    // surface got a mask; the room map does not integrate while it is false.
    void updateMasks(bool dash, const Pose &head, uint64_t now) {
        if (now - masksNs < kMaskPeriodNs) return;
        masksNs = now;
        masks.clear();
        masksBuiltNs = now;
        masksComplete = true;
        if (!dash || opt.noMask) return;
        // zone = extra metres beyond the margin: side, top, bottom
        auto add = [&](const Geometry &g, float texW, float texH, const float zone[3], float marginScale) {
            if (!g.valid || g.fallback || masks.size() >= 16) return;
            MaskQuad m;
            float lu = length(g.U), lv = length(g.V);
            const float mg = opt.margin * marginScale;
            m.O = g.O;
            m.U = g.U * (1.f / lu);
            m.V = g.V * (1.f / lv);
            m.u0 = -mg - zone[0];
            m.u1 = texW * lu + mg + zone[0];
            m.v0 = -mg - zone[1];
            m.v1 = texH * lv + mg + zone[2];
            masks.push_back(m);
        };
        // The main window gets a wider "dashboard zone": SteamVR's own panels
        // (grab bar, frame controls, frame menus, side panels) sit around it and
        // glassd cannot see them. A rescaled popup is masked at both its
        // reported and its rescaled quad, with twice the margin.
        const float none[3] = {0, 0, 0};
        auto addSurface = [&](const Geometry &g, const Geometry &raw, bool rescaled, const std::string &key, float tw, float th) {
            const bool isMain = key == kMainKey;
            add(g, tw, th, isMain ? opt.zone : none, rescaled ? 2.f : 1.f);
            if (rescaled) add(raw, tw, th, none, 2.f);
        };
        std::vector<std::string> done;
        int missing = 0;
        // main first, so popups rescale to this moment's main scale
        std::vector<Surface *> order;
        for (auto &s : surfaces)
            if (s->spec.overlayKey == kMainKey) order.insert(order.begin(), s.get());
            else order.push_back(s.get());
        for (Surface *s : order) {
            if (!s->spec.visible) continue;
            refreshGeometry(*s, head, now, true);
            if (!s->geoOk) {
                missing++;
                continue;
            }
            addSurface(s->geo, s->rawGeo, s->rescaled, s->spec.overlayKey, float(s->spec.texW), float(s->spec.texH));
            done.push_back(s->spec.overlayKey);
        }
        // Steam's fixed surfaces, if visible and not masked above.
        static const char *kSteam[] = {kMainKey, "valve.steam.gamepadui.bar", "valve.steam.gamepadui.floatingfooter",
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
            if (!fetchGeometry(h, ms.v[0], ms.v[1], g) || implausible(g, ms.v[0], ms.v[1], head)) continue;
            const bool isMain = std::strcmp(k, kMainKey) == 0;
            if (isMain) mainMpp = g.mpp;
            Geometry raw = g;
            const bool rescaled = !isMain && rescaleToMain(g, ms.v[0], ms.v[1]) != 1.f;
            addSurface(g, raw, rescaled, k, ms.v[0], ms.v[1]);
            done.push_back(k);
            // a spec surface that failed above but is covered here is fine
            for (Surface *s : order)
                if (s->spec.visible && !s->geoOk && s->spec.overlayKey == k) missing--;
        }
        masksComplete = missing <= 0;
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
        // Not around a dashboard change (the UI fades in or out and SteamVR
        // places the window again), and while the dashboard shows only with
        // masks built from geometry fetched after that.
        const uint64_t settled = dashChangeNs + kGraceNs;
        if (now < settled || frame.recvNs < settled ||
            (dash && !opt.noMask && !(masksComplete && masksBuiltNs >= settled))) {
            roomSkipped++;
            return;
        }
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
    }

    // ------------------------------------------------------------ render
    // Metres per Steam texture pixel: the main window's, as SteamVR reports it.
    float designMpp() const { return mainMpp > 0 ? mainMpp : 0.98f / 1920.f; }

    // The cover's shapes in Steam px; empty = no cover.
    std::vector<ShapeSpec> coverShapes(Surface &s) {
        std::vector<ShapeSpec> v;
        if (s.spec.hasShapes) {
            v = s.spec.shapes;
            if (v.size() > size_t(kMaxShapes)) {
                if (!s.warnedShapes) std::printf("surface %s: %zu cover shapes, drawing the first %d\n", s.spec.name.c_str(), v.size(), kMaxShapes);
                s.warnedShapes = true;
                v.resize(size_t(kMaxShapes));
            }
        } else if (s.spec.material == "window") {
            v.push_back({0, 0, float(s.spec.texW), float(s.spec.texH), s.spec.radius});
        } else if (!s.warnedShapes) {
            std::printf("surface %s (material %s) came without cover shapes; drawing no cover\n", s.spec.name.c_str(),
                        s.spec.material.c_str());
            s.warnedShapes = true;
        }
        return v;
    }

    // One piece of glass: the union of `shapes` (region-local Steam px) in the
    // region (rx, ry, rw, rh) of the current target.
    void drawGlass(Surface &s, const Geometry &g, const Pose &head, const Material &m, int rx, int ry, int rw, int rh, v3 elem,
                   const std::vector<ShapeSpec> &shapes, float dz) {
        if (shapes.empty()) return;
        Program &p = progGlass;
        glViewport(rx, ry, rw, rh);
        p.set("uOrigin", float(rx), float(ry));
        p.set("uScale", s.scale);
        p.set("uElemOff", elem.x, elem.y);
        const int n = std::min(int(shapes.size()), kMaxShapes);
        float sh[4 * kMaxShapes] = {}, rads[kMaxShapes] = {};
        float x0 = 1e9f, y0 = 1e9f, x1 = -1e9f, y1 = -1e9f, minHalf = 1e9f;
        for (int i = 0; i < n; i++) {
            const ShapeSpec &q = shapes[size_t(i)];
            sh[i * 4] = q.x + q.w * 0.5f;
            sh[i * 4 + 1] = q.y + q.h * 0.5f;
            sh[i * 4 + 2] = q.w * 0.5f;
            sh[i * 4 + 3] = q.h * 0.5f;
            rads[i] = std::min(q.r, 0.5f * std::min(q.w, q.h));
            x0 = std::min(x0, q.x);
            y0 = std::min(y0, q.y);
            x1 = std::max(x1, q.x + q.w);
            y1 = std::max(y1, q.y + q.h);
            minHalf = std::min(minHalf, 0.5f * std::min(q.w, q.h));
        }
        glUniform1i(p.loc("uNS"), n);
        glUniform4fv(p.loc("uShapes"), n, sh);
        glUniform1fv(p.loc("uRads"), n, rads);
        p.set("uShapeC", 0.5f * (x0 + x1), 0.5f * (y0 + y1));
        p.set("uHalf", 0.5f * (x1 - x0), 0.5f * (y1 - y0));
        p.set("uO", g.O.x, g.O.y, g.O.z);
        p.set("uU", g.U.x, g.U.y, g.U.z);
        p.set("uV", g.V.x, g.V.y, g.V.z);
        p.set("uN", g.N.x, g.N.y, g.N.z);
        p.set("uDz", dz);
        p.set("uEye", head.t.x, head.t.y, head.t.z);
        // Material widths are converted with one design scale for all surfaces:
        // Steam's panels share a metres-per-pixel in the scene graph.
        const float mpp = designMpp();
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
        glClearColor(0, 0, 0, 0);
        // Only the backdrop and the live cells (plus their gutters) are
        // cleared and drawn; the rest of a buffer is cleared once.
        if (!s.cleared[s.next]) {
            glDisable(GL_SCISSOR_TEST);
            glClear(GL_COLOR_BUFFER_BIT);
            s.cleared[s.next] = true;
        }
        glEnable(GL_SCISSOR_TEST);
        glScissor(0, 0, s.bw, s.bh);
        glClear(GL_COLOR_BUFFER_BIT);
        const Geometry &g = s.geo;
        // cover: the union of its shapes, one pass, in the backdrop region
        const std::vector<ShapeSpec> shapes = coverShapes(s);
        if (!shapes.empty()) {
            float x0 = 1e9f, y0 = 1e9f, x1 = -1e9f, y1 = -1e9f;
            for (const ShapeSpec &q : shapes) {
                x0 = std::min(x0, q.x);
                y0 = std::min(y0, q.y);
                x1 = std::max(x1, q.x + q.w);
                y1 = std::max(y1, q.y + q.h);
            }
            const int sx0 = std::max(0, int(std::floor(x0 * s.scale)) - 1), sy0 = std::max(0, int(std::floor(y0 * s.scale)) - 1);
            const int sx1 = std::min(s.bw, int(std::ceil(x1 * s.scale)) + 1), sy1 = std::min(s.bh, int(std::ceil(y1 * s.scale)) + 1);
            if (sx1 > sx0 && sy1 > sy0) {
                glScissor(sx0, sy0, sx1 - sx0, sy1 - sy0);
                drawGlass(s, g, head, materialFor(s.spec.material, spec.dial), 0, 0, s.bw, s.bh, {0, 0, 0}, shapes, 0.f);
            }
        }
        // slabs (and fading ghosts): the element's exact size; world point =
        // element position + dz
        auto drawSlab = [&](const SlabSlot &sl) {
            const Material m = materialFor(sl.s.material, spec.dial);
            const float ex = sl.s.hasPos ? sl.s.x : (s.spec.texW - sl.s.w) * 0.5f;
            const float ey = sl.s.hasPos ? sl.s.y : (s.spec.texH - sl.s.h) * 0.5f;
            // the cell is sl.w x sl.h glassd px = (w, h) Steam px at this scale
            const float sw = sl.w / s.scale, sh = sl.h / s.scale;
            const int gx0 = std::max(0, sl.x - 1), gy0 = std::max(s.bh, sl.y - 1);
            const int gx1 = std::min(s.gw, sl.x + sl.w + 1), gy1 = std::min(s.gh, sl.y + sl.h + 1);
            glScissor(gx0, gy0, gx1 - gx0, gy1 - gy0);
            glClear(GL_COLOR_BUFFER_BIT);  // the cell's gutter may hold an older cell's pixels
            glScissor(sl.x, sl.y, sl.w, sl.h);
            drawGlass(s, g, head, m, sl.x, sl.y, sl.w, sl.h, {ex, ey, 0}, {{0, 0, sw, sh, sl.s.r}}, sl.s.dz - 0.0008f);
        };
        for (const SlabSlot &sl : s.slots) drawSlab(sl);
        for (const SlabSlot &sl : s.ghosts) drawSlab(sl);
        glDisable(GL_SCISSOR_TEST);
        s.last = s.next;
        s.next = (s.next + 1) % 3;
        s.rendered = true;
    }

    // Renders every visible surface, waits for the GPU, then hands the new
    // buffers to SteamVR. fetchGeo: ask SteamVR for the surfaces' quads.
    int renderAll(const Pose &head, bool force, bool fetchGeo, uint64_t now) {
        std::vector<Surface *> todo;
        for (auto &s : surfaces) {
            if (!(s->spec.visible || force)) continue;
            if (s->ov == vr::k_ulOverlayHandleInvalid && !ensureOverlay(*s)) continue;
            if (!s->bufs[0].bo && !ensureBuffers(*s)) continue;
            if (!s->bufs[s->next].bo) continue;
            refreshGeometry(*s, head, now, fetchGeo);
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
            const DmaTarget &b = s->bufs[s->last];
            vr::SharedTextureHandle_t h = vr::SharedTextureHandle_t(b.vrHandle);
            vr::Texture_t tex = {&h, vr::TextureType_SharedTextureHandle, vr::ColorSpace_Gamma};
            auto e = vr::VROverlay()->SetOverlayTexture(s->ov, &tex);
            if (e != vr::VROverlayError_None) {
                if (s->submitFails++ == 0) s->submitFailSinceNs = now;
                if (s->submitFails <= 3)
                    std::printf("SetOverlayTexture(%s): %s\n", s->key.c_str(), vr::VROverlay()->GetOverlayErrorNameFromEnum(e));
                if (e == vr::VROverlayError_UnknownOverlay || e == vr::VROverlayError_InvalidHandle)
                    loseOverlay(*s, vr::VROverlay()->GetOverlayErrorNameFromEnum(e));
                else if (s->submitFails >= 5 && now - s->submitFailSinceNs > 1000000000ull)
                    loseOverlay(*s, "texture submits keep failing");
                continue;
            }
            s->submitFails = 0;
            s->lastSubmitNs = lastSubmitNs = now;
            // The scene graph sizes the panel from the mouse scale: change it
            // together with the first texture of a new size.
            if (b.w != s->submittedW || b.h != s->submittedH) {
                vr::HmdVector2_t mouse = {float(b.w), float(b.h)};
                vr::VROverlay()->SetOverlayMouseScale(s->ov, &mouse);
                s->submittedW = b.w;
                s->submittedH = b.h;
            }
            if (!s->announced) {
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

    // -------------------------------------------------------------- health
    // Every 2 s: SteamVR's processes are still the ones we connected to, and
    // our overlays still exist. A vrserver or vrcompositor that went away
    // (crash, respawn) ends glassd with 75; the daemon starts a fresh one.
    void healthCheck(uint64_t now) {
        if (now - lastHealthNs < 2000000000ull) return;
        lastHealthNs = now;
        if (vrserverPid > 0 && !pidIs(vrserverPid, "vrserver")) {
            std::printf("SteamVR (vrserver %d) went away; exiting\n", vrserverPid);
            quitWith(kExitTemp);
            return;
        }
        if (compositorPid > 0 && !pidIs(compositorPid, "vrcompositor")) {
            std::printf("vrcompositor %d went away; exiting so a fresh glassd can reconnect\n", compositorPid);
            quitWith(kExitTemp);
            return;
        }
        for (auto &s : surfaces) {
            if (s->ov == vr::k_ulOverlayHandleInvalid) continue;
            vr::VROverlayHandle_t h = vr::k_ulOverlayHandleInvalid;
            auto e = vr::VROverlay()->FindOverlay(s->key.c_str(), &h);
            if (e != vr::VROverlayError_None || h != s->ov) loseOverlay(*s, "overlay vanished");
        }
    }

    // Visible surfaces all have an overlay that accepts textures.
    bool healthy() const {
        for (auto &s : surfaces) {
            if (!s->spec.visible) continue;
            if (s->ov == vr::k_ulOverlayHandleInvalid || s->submitFails >= 3) return false;
        }
        return true;
    }

    // -------------------------------------------------------------- output
    void writeOut(bool exiting) {
        std::string o;
        char b[1024];  // parseSpec caps names and slab ids at 128 chars, sanitizeKey keys at 100
        timespec rt;
        clock_gettime(CLOCK_REALTIME, &rt);
        const uint64_t now = monoNowNs();
        std::snprintf(b, sizeof b, "{\"seq\": %lld, \"pid\": %d, \"updated\": %.3f, \"healthy\": %s, \"fps\": %.1f, \"gpu_ms\": %.2f, \"frames\": %llu, \"dashboard\": %s",
                      spec.seq, int(getpid()), double(rt.tv_sec) + double(rt.tv_nsec) / 1e9, !exiting && healthy() ? "true" : "false",
                      exiting ? 0.0 : double(fpsNow), double(gpuMs()), (unsigned long long)frames, lastDash ? "true" : "false");
        o += b;
        std::snprintf(b, sizeof b, ", \"last_submit_s\": %.1f, \"room_ms\": %.2f, \"room_updates\": %llu, \"feed\": %s%s",
                      lastSubmitNs ? double(now - lastSubmitNs) / 1e9 : -1.0, double(roomTimer.have ? roomTimer.ms : roomCpuMs),
                      (unsigned long long)room.updates, jsonEscape(feedState()).c_str(), exiting ? ", \"exiting\": true" : "");
        o += b;
        o += ", \"surfaces\": {";
        bool first = true;
        for (auto &s : surfaces) {
            if (!first) o += ", ";
            first = false;
            const float gw = float(std::max(1, s->gw)), gh = float(std::max(1, s->gh));
            const size_t cover = coverShapes(*s).size();
            std::snprintf(b, sizeof b,
                          "%s: {\"key\": %s, \"texW\": %d, \"texH\": %d, \"backdrop\": [0, 0, %.6f, %.6f], \"backdropScale\": %.6f, \"cover\": %zu",
                          jsonEscape(s->spec.name).c_str(), jsonEscape(s->key).c_str(), s->gw, s->gh, s->bw / gw, s->bh / gh,
                          double(s->scale), cover);
            o += b;
            o += ", \"geometry\": " + jsonEscape(s->geoNote) + ", \"slabs\": {";
            for (size_t i = 0; i < s->slots.size(); i++) {
                const SlabSlot &sl = s->slots[i];
                std::snprintf(b, sizeof b, "%s%s: [%.6f, %.6f, %.6f, %.6f]", i ? ", " : "", jsonEscape(sl.s.id).c_str(), sl.x / gw, sl.y / gh,
                              (sl.x + sl.w) / gw, (sl.y + sl.h) / gh);
                o += b;
            }
            o += "}";
            if (!s->dropped.empty()) {
                o += ", \"dropped\": [";
                bool f = true;
                for (const std::string &id : s->dropped) {
                    o += (f ? "" : ", ") + jsonEscape(id);
                    f = false;
                }
                o += "]";
            }
            o += "}";
        }
        o += "}}\n";
        if (!writeAtomic(opt.out, o)) std::printf("cannot write %s\n", opt.out.c_str());
        lastOutNs = monoNowNs();
    }

    float gpuMs() const { return renderTimer.have ? renderTimer.ms : cpuMs; }
    std::string feedState() const {
        if (opt.noFeed) return "off";
        int st = feed.state.load();
        if (st == -1) return "failed: " + feed.error();
        if (feed.attached()) return (feed.isStreaming() ? "live " : "shot ") + feed.mode();
        return "standby";
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
        const uint64_t seen = feed.framesSeen.load(), att = feed.attachedTotalNs();
        std::string geo;
        int vis = 0;
        size_t slabs = 0, ghosts = 0, dropped = 0;
        for (auto &s : surfaces) {
            geo += (geo.empty() ? "" : ",") + s->spec.name + ":" + s->geoNote;
            vis += s->spec.visible;
            slabs += s->slots.size();
            ghosts += s->ghosts.size();
            dropped += s->dropped.size();
        }
        std::printf("dash=%d surfaces=%d/%zu fps=%.1f gpu=%.2fms%s cpu=%.2fms room=%.1f/s (%.2fms, %llu skipped) feed=%s %.0f/s attached=%.0f%% "
                    "known=%.0f%% lum=%.2f env=%.2f masks=%zu%s slabs=%zu+%zu fading, %zu dropped geo=%s\n",
                    dash, vis, surfaces.size(), double(framesWindow) / dt, double(gpuMs()), renderTimer.have ? "" : "(cpu+finish)",
                    double(cpuMs), double(roomWindow) / dt, double(roomTimer.have ? roomTimer.ms : roomCpuMs),
                    (unsigned long long)roomSkipped, feedState().c_str(), double(seen - feedSeenAtStatus) / dt,
                    100.0 * double(att - feedAttachedAtStatus) / 1e9 / dt, double(known * 100), double(lum), double(envLuma), masks.size(),
                    masksComplete ? "" : "(incomplete)", slabs, ghosts, dropped, geo.empty() ? "-" : geo.c_str());
        feedSeenAtStatus = seen;
        feedAttachedAtStatus = att;
        framesWindow = 0;
        roomWindow = 0;
        lastStatusNs = now;
    }

    void loop() {
        lastStatusNs = lastOutNs = lastLoopNs = lastHealthNs = monoNowNs();
        uint64_t fpsWindowNs = lastStatusNs, fpsFrames = 0, lastSpecCheckNs = 0;
        const bool wantDump = !opt.dumpDir.empty() || !opt.dumpRoom.empty() || opt.once;
        while (!g_quit) {
            const uint64_t now = monoNowNs();
            const float dt = float(double(now - lastLoopNs) / 1e9);
            lastLoopNs = now;
            if (opt.timeout > 0 && now - startNs > uint64_t(opt.timeout * 1e9)) break;
            if (!opt.orphanOk && origPpid > 1 && getppid() != origPpid) {
                std::printf("parent %d exited; stopping\n", origPpid);
                break;
            }

            vr::VREvent_t ev;
            while (vr::VRSystem()->PollNextEvent(&ev, sizeof ev)) {
                if (ev.eventType == vr::VREvent_Quit) {
                    std::printf("SteamVR is quitting\n");
                    vr::VRSystem()->AcknowledgeQuit_Exiting();
                    quitWith(kExitTemp);
                }
            }
            if (g_quit) break;
            if (g_loseRequest.exchange(false))
                for (auto &s : surfaces)
                    if (s->ov != vr::k_ulOverlayHandleInvalid) loseOverlay(*s, "SIGUSR2 test");
            healthCheck(now);
            if (g_quit) break;

            Pose hmd;
            if (samplePose(0.f, hmd)) {
                hist.emplace_back(now, hmd);
                while (hist.size() > 2 && now - hist.front().first > 1500000000ull) hist.pop_front();
                room.follow(hmd.t, dt);
            }
            // the spec: at once on an inotify event, else polled at 10 Hz
            if (!opt.demo) {
                if (inoWd < 0 && now >= inoRetryNs) watchSpec();
                const bool touched = drainSpecEvents();
                if (touched || now - lastSpecCheckNs > 100000000ull) {
                    lastSpecCheckNs = now;
                    checkSpec();
                }
            }
            for (size_t i = 0; i < retired.size();) {
                if (now >= retired[i].freeAtNs) {
                    releaseBuffer(retired[i].buf);
                    retired.erase(retired.begin() + long(i));
                } else {
                    i++;
                }
            }
            expireGhosts(now);

            const bool dash = opt.dashOverride >= 0 ? opt.dashOverride == 1 : vr::VROverlay()->IsDashboardVisible();
            if (dash != lastDash) {
                std::printf("dashboard %s\n", dash ? "visible" : "hidden");
                lastDash = dash;
                dashChangeNs = now;
                graceDone = false;
                masksNs = 0;
            }
            if (!graceDone && now - dashChangeNs >= kGraceNs) {
                graceDone = true;
                masksNs = 0;  // masks from geometry fetched after the window settled
            }
            const bool warm = opt.noFeed || feed.state.load() == -1 ? now - startNs > uint64_t((opt.warmup + 1) * 1e9)
                                                                    : firstRoomNs && now - firstRoomNs > uint64_t(opt.warmup * 1e9);
            const bool dumpDue = (wantDump && !dumpedOnce && warm) || g_dumpRequest.load();
            const bool active = dash || opt.force || opt.once;
            bool anyVisible = false;
            for (auto &s : surfaces) anyVisible |= s->spec.visible;

            // The feed streams only while glass is on screen; otherwise it is
            // attached for one frame every 1/idle-hz s (v4l2cam works only
            // while a reader is attached).
            if (!opt.noFeed) {
                const bool stream = active && (anyVisible || opt.force || opt.once);
                feed.setStreaming(stream);
                feed.minIntervalNs = uint64_t(1e9 / opt.feedHz);
                if (!stream && opt.idleHz > 0 && (!lastShotNs || now - lastShotNs >= uint64_t(1e9 / opt.idleHz))) {
                    feed.requestShot();
                    lastShotNs = now;
                }
            }

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
            updateRoom(dash, now);
            roomTimer.poll();

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
                // priming renders while hidden don't ask SteamVR for quads
                const bool fetchGeo = dash || opt.force || opt.once || dumpDue;
                const uint64_t before = frames;
                if (renderAll(head, forced, fetchGeo, now) > 0) {
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

            // ~250 Hz while active (pose history + frame pacing), ~100 Hz idle;
            // a spec change wakes the loop at once
            const int waitMs = active ? 4 : 10;
            if (inoFd >= 0) {
                pollfd p{inoFd, POLLIN, 0};
                poll(&p, 1, waitMs);
            } else {
                usleep(useconds_t(waitMs) * 1000);
            }
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
    sigaction(SIGUSR2, &sa, nullptr);
    signal(SIGPIPE, SIG_IGN);
    std::printf("starting (spec %s, out %s, key prefix %s, scale %.2f, pid %d)\n", opt.demo ? "<demo>" : opt.spec.c_str(), opt.out.c_str(),
                opt.keyPrefix.c_str(), double(opt.scale), int(getpid()));
    Glassd g(opt);
    int rc = g.run();
    std::printf("exit %d\n", rc);
    return rc;
}
