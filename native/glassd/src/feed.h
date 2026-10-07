// Passthrough feed for the room model. SteamVR's v4l2cam publishes the
// compositor's right-eye view on a v4l2loopback device (/dev/video99,
// 1920x1080 RGB24), but only while a reader is attached: every attached second
// costs v4l2cam about 18% of a core. So the capture thread attaches only on
// demand:
//   - streaming: while the glass is on screen, it streams with V4L2 mmap
//     buffers (falls back to read()) and keeps at most minIntervalNs' worth;
//   - shots: otherwise, each requestShot() attaches just long enough for one
//     fresh frame (about 30-60 ms) and detaches again.
// The first buffer after STREAMON is a stale frame left over from the previous
// session (sequence 0), so every attach skips it. Kept frames are
// box-downsampled to RGBA and stay in RAM; nothing is recorded.
#pragma once
#include <fcntl.h>
#include <linux/videodev2.h>
#include <poll.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <time.h>
#include <unistd.h>

#include <algorithm>
#include <atomic>
#include <cerrno>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

inline uint64_t monoNowNs() {
    timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return uint64_t(ts.tv_sec) * 1000000000ull + uint64_t(ts.tv_nsec);
}

// Feed calibration (tangent coords of the feed eye -> feed uv), as written by
// the Liquid Glass Frame app: "a b c d latency_ms eye" with u = a*x + b,
// v = c*y + d. Fallback: the latest worn-headset fit in frame-platform.md.
struct FeedCalib {
    float a = 0.5617f, b = 0.4998f, c = -0.9998f, d = 0.4997f;
    float latencyMs = 14.f;
    int eye = 1;  // 0 left, 1 right (the feed is the right-eye view on this Frame)
    bool loaded = false;
    std::string source = "fallback";
    void load() {
        const char *home = getenv("HOME");
        std::string p = std::string(home ? home : "/home/steamos") + "/.config/liquid-glass-frame/feed.cfg";
        FILE *f = std::fopen(p.c_str(), "r");
        if (!f) return;
        float A, B, C, D, L;
        int e = 1;
        int n = std::fscanf(f, "%f %f %f %f %f %d", &A, &B, &C, &D, &L, &e);
        std::fclose(f);
        // Reject nonsense fits (the scale terms are ~0.56 and ~-1.0 on this device).
        if (n >= 5 && std::fabs(A) > 0.2f && std::fabs(A) < 2.f && std::fabs(C) > 0.2f && std::fabs(C) < 3.f) {
            a = A; b = B; c = C; d = D;
            if (L > 2 && L < 200) latencyMs = L;
            eye = (n >= 6) ? (e == 0 ? 0 : 1) : 1;
            loaded = true;
            source = p;
        }
    }
};

struct FeedFrame {
    std::vector<uint8_t> rgba;  // w*h*4, top row first, alpha 255
    int w = 0, h = 0;
    uint64_t recvNs = 0, seq = 0;
    float meanLuma = 0;  // sRGB-encoded mean luma, 0..1
};

class FeedCapture {
 public:
    // 0 detached (standby), 1 attaching / no fresh frame yet, 2 attached with
    // fresh frames, -1 failed (retried every 5 s while there is demand)
    std::atomic<int> state{0};
    std::atomic<uint64_t> framesSeen{0}, framesKept{0};
    std::atomic<uint64_t> minIntervalNs{27000000ull};  // while streaming: process at most ~36 Hz
    std::atomic<uint64_t> attaches{0}, attachedNs{0};  // stats: sessions, total time attached
    std::string device = "/dev/video99";
    int factor = 4;  // downsample factor (4: 1920x1080 -> 480x270)

    // Thread-safe copies of the capture mode ("mmap x2", "read") and the last error.
    std::string mode() const {
        std::lock_guard<std::mutex> lock(smu);
        return mode_;
    }
    std::string error() const {
        std::lock_guard<std::mutex> lock(smu);
        return error_;
    }

    ~FeedCapture() { stop(); }
    void start(const std::string &dev, int downsample) {
        device = dev;
        factor = std::max(1, downsample);
        quit = false;
        worker = std::thread([this] { run(); });
    }
    void stop() {
        quit = true;
        if (worker.joinable()) worker.join();
    }
    // Demand. Streaming keeps the device attached; a shot attaches for one
    // fresh frame (pending shots are merged).
    void setStreaming(bool on) { streaming = on; }
    void requestShot() { shotsWanted++; }
    bool attached() const { return attachedFlag.load(); }
    // Total time attached, including the current attach.
    uint64_t attachedTotalNs() const {
        const uint64_t t0 = attachStartNs.load();
        return attachedNs.load() + (attachedFlag.load() && t0 ? monoNowNs() - t0 : 0);
    }
    bool isStreaming() const { return streaming.load(); }

    // Hands over the newest frame (buffer swap) if it is newer than `have`.
    bool latest(FeedFrame &out, uint64_t have) {
        std::lock_guard<std::mutex> lock(mu);
        if (front.seq == 0 || front.seq == have) return false;
        out.rgba.swap(front.rgba);
        out.w = front.w;
        out.h = front.h;
        out.recvNs = front.recvNs;
        out.seq = front.seq;
        out.meanLuma = front.meanLuma;
        front.seq = 0;  // consumed (the swapped-in buffer is stale)
        lastSeq = out.seq;
        return true;
    }

 private:
    std::thread worker;
    std::atomic<bool> quit{false};
    std::atomic<bool> streaming{false}, attachedFlag{false};
    std::atomic<uint64_t> attachStartNs{0};
    std::atomic<uint64_t> shotsWanted{0};
    uint64_t shotsDone = 0;  // capture thread only
    std::mutex mu;
    mutable std::mutex smu;  // guards mode_ and error_
    std::string mode_ = "none", error_;
    FeedFrame front, back;
    uint64_t lastSeq = 0, nextSeq = 1;
    uint64_t lastKeptNs = 0;
    int W = 0, H = 0, stride = 0;
    bool announced = false;
    std::string lastError;

    static constexpr uint64_t kShotTimeoutNs = 700000000ull;  // give up a shot without a fresh frame

    struct Buf {
        void *p = MAP_FAILED;
        size_t len = 0;
    };

    void setMode(const std::string &m) {
        std::lock_guard<std::mutex> lock(smu);
        mode_ = m;
    }
    void setError(const std::string &e) {
        std::lock_guard<std::mutex> lock(smu);
        error_ = e;
    }

    bool shotPending() const { return shotsDone < shotsWanted.load(); }
    bool demand() const { return streaming.load() || shotPending(); }

    // Returns false for frames that are all black (the loopback hands out zero
    // frames until SteamVR publishes one).
    bool process(const uint8_t *src, uint64_t t) {
        const int f = factor, ow = W / f, oh = H / f;
        back.rgba.resize(size_t(ow) * oh * 4);
        back.w = ow;
        back.h = oh;
        // Average the two middle rows of each f-row block, f pixels across.
        const int r0 = f >= 4 ? f / 2 - 1 : 0, r1 = f >= 2 ? r0 + 1 : 0;
        const int n = f * ((r1 != r0) ? 2 : 1);
        double lsum = 0;
        int samples = 0;
        unsigned peak = 0;
        for (int y = 0; y < oh; y++) {
            const uint8_t *ra = src + size_t(y * f + r0) * stride;
            const uint8_t *rb = src + size_t(y * f + r1) * stride;
            uint8_t *o = back.rgba.data() + size_t(y) * ow * 4;
            for (int x = 0; x < ow; x++) {
                unsigned s[3] = {0, 0, 0};
                for (int k = 0; k < f; k++) {
                    const uint8_t *pa = ra + size_t(x * f + k) * 3;
                    s[0] += pa[0]; s[1] += pa[1]; s[2] += pa[2];
                    if (r1 != r0) {
                        const uint8_t *pb = rb + size_t(x * f + k) * 3;
                        s[0] += pb[0]; s[1] += pb[1]; s[2] += pb[2];
                    }
                }
                o[x * 4 + 0] = uint8_t(s[0] / n);
                o[x * 4 + 1] = uint8_t(s[1] / n);
                o[x * 4 + 2] = uint8_t(s[2] / n);
                o[x * 4 + 3] = 255;
                if (((x | y) & 3) == 0) {
                    unsigned R = o[x * 4], G = o[x * 4 + 1], B = o[x * 4 + 2];
                    lsum += (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255.0;
                    samples++;
                    peak = std::max(peak, std::max(R, std::max(G, B)));
                }
            }
        }
        if (peak == 0) return false;
        back.recvNs = t;
        back.meanLuma = samples ? float(lsum / samples) : 0.f;
        {
            std::lock_guard<std::mutex> lock(mu);
            back.seq = nextSeq++;
            std::swap(front, back);
        }
        framesKept++;
        return true;
    }

    bool wanted(uint64_t now) const { return now - lastKeptNs >= minIntervalNs.load(); }

    // Handles one dequeued frame. `fresh` is false for the stale buffer the
    // loopback hands out first. Returns true when the frame was kept.
    bool consume(const uint8_t *src, bool fresh, uint64_t t) {
        framesSeen++;
        if (!fresh) return false;
        const bool shot = shotPending();
        if (!(shot || (streaming.load() && wanted(t)))) return false;
        if (!process(src, t)) return false;
        lastKeptNs = t;
        state = 2;
        if (shot) shotsDone = shotsWanted.load();
        return true;
    }

    // True while this attach should continue. A shot that found no fresh
    // frame within kShotTimeoutNs is dropped.
    bool keepAttached(uint64_t t0) {
        if (quit) return false;
        if (streaming.load()) return true;
        if (!shotPending()) return false;
        if (monoNowNs() - t0 > kShotTimeoutNs) {
            shotsDone = shotsWanted.load();
            return false;
        }
        return true;
    }

    // Returns false when mmap streaming could not be set up.
    bool runMmap(int fd) {
        v4l2_requestbuffers rb{};
        rb.count = 2;
        rb.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        rb.memory = V4L2_MEMORY_MMAP;
        if (ioctl(fd, VIDIOC_REQBUFS, &rb) < 0 || rb.count == 0) {
            setError(std::string("REQBUFS: ") + strerror(errno));
            return false;
        }
        std::vector<Buf> bufs(rb.count);
        bool ok = true;
        for (uint32_t i = 0; i < rb.count && ok; i++) {
            v4l2_buffer b{};
            b.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
            b.memory = V4L2_MEMORY_MMAP;
            b.index = i;
            if (ioctl(fd, VIDIOC_QUERYBUF, &b) < 0) { setError(std::string("QUERYBUF: ") + strerror(errno)); ok = false; break; }
            bufs[i].len = b.length;
            bufs[i].p = mmap(nullptr, b.length, PROT_READ, MAP_SHARED, fd, b.m.offset);
            if (bufs[i].p == MAP_FAILED) { setError(std::string("mmap: ") + strerror(errno)); ok = false; break; }
            if (ioctl(fd, VIDIOC_QBUF, &b) < 0) { setError(std::string("QBUF: ") + strerror(errno)); ok = false; break; }
        }
        int type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        if (ok && ioctl(fd, VIDIOC_STREAMON, &type) < 0) { setError(std::string("STREAMON: ") + strerror(errno)); ok = false; }
        if (ok) {
            setMode("mmap x" + std::to_string(rb.count));
            if (!announced) {
                std::printf("feed %s %dx%d RGB24 via mmap (%u buffers), kept at 1/%d, attached on demand\n", device.c_str(), W, H,
                            rb.count, factor);
                std::fflush(stdout);
                announced = true;
            }
            const uint64_t t0 = monoNowNs();
            int failures = 0, dequeued = 0;
            while (keepAttached(t0)) {
                pollfd pfd{fd, POLLIN, 0};
                int pr = poll(&pfd, 1, 50);
                if (pr <= 0) continue;
                v4l2_buffer b{};
                b.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
                b.memory = V4L2_MEMORY_MMAP;
                if (ioctl(fd, VIDIOC_DQBUF, &b) < 0) {
                    if (errno == EAGAIN || errno == EINTR) continue;
                    if (++failures > 50) { setError(std::string("DQBUF: ") + strerror(errno)); break; }
                    usleep(5000);
                    continue;
                }
                failures = 0;
                const bool fresh = dequeued++ > 0 && b.sequence != 0;
                if (b.index < bufs.size() && b.bytesused >= size_t(stride) * H)
                    consume(static_cast<const uint8_t *>(bufs[b.index].p), fresh, monoNowNs());
                ioctl(fd, VIDIOC_QBUF, &b);
            }
            ioctl(fd, VIDIOC_STREAMOFF, &type);
        }
        for (auto &b : bufs)
            if (b.p != MAP_FAILED) munmap(b.p, b.len);
        v4l2_requestbuffers rel{};
        rel.count = 0;
        rel.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        rel.memory = V4L2_MEMORY_MMAP;
        ioctl(fd, VIDIOC_REQBUFS, &rel);
        return ok;
    }

    void runRead(int fd) {
        // Non-blocking reads gated by poll(), so stop() never waits on a stalled feed.
        int fl = fcntl(fd, F_GETFL);
        fcntl(fd, F_SETFL, fl | O_NONBLOCK);
        setMode("read");
        if (!announced) {
            std::printf("feed %s %dx%d RGB24 via read(), kept at 1/%d, attached on demand\n", device.c_str(), W, H, factor);
            std::fflush(stdout);
            announced = true;
        }
        const size_t size = size_t(stride) * H;
        std::vector<uint8_t> raw(size);
        const uint64_t t0 = monoNowNs();
        int frames = 0;
        while (keepAttached(t0)) {
            size_t got = 0;
            while (got < size && keepAttached(t0)) {
                pollfd pfd{fd, POLLIN, 0};
                if (poll(&pfd, 1, 50) <= 0) continue;
                ssize_t n = ::read(fd, raw.data() + got, size - got);
                if (n <= 0) {
                    if (n < 0 && (errno == EINTR || errno == EAGAIN)) continue;
                    setError("feed read ended");
                    return;
                }
                got += size_t(n);
            }
            if (got < size) break;
            consume(raw.data(), frames++ > 0, monoNowNs());
        }
    }

    // One attach: open, stream until the demand ends, close. Returns false when
    // the device could not be opened or set up.
    bool session() {
        state = 1;
        int fd = ::open(device.c_str(), O_RDONLY | O_NONBLOCK | O_CLOEXEC);
        if (fd < 0) {
            setError("open " + device + ": " + strerror(errno));
            return false;
        }
        v4l2_format fmt{};
        fmt.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        if (ioctl(fd, VIDIOC_G_FMT, &fmt) < 0 || fmt.fmt.pix.pixelformat != V4L2_PIX_FMT_RGB24) {
            setError("unexpected feed format");
            ::close(fd);
            return false;
        }
        W = int(fmt.fmt.pix.width);
        H = int(fmt.fmt.pix.height);
        stride = fmt.fmt.pix.bytesperline ? int(fmt.fmt.pix.bytesperline) : W * 3;
        const uint64_t t0 = monoNowNs();
        attachStartNs = t0;
        attachedFlag = true;
        attaches++;
        if (!runMmap(fd) && !quit) {
            const std::string e = error();
            if (e != lastError) std::printf("feed mmap streaming failed (%s); using read()\n", e.c_str());
            lastError = e;
            std::fflush(stdout);
            ::close(fd);
            fd = ::open(device.c_str(), O_RDONLY | O_NONBLOCK | O_CLOEXEC);
            if (fd < 0) {
                setError("reopen " + device + ": " + strerror(errno));
                attachedNs += monoNowNs() - t0;
                attachedFlag = false;
                return false;
            }
            runRead(fd);
        }
        ::close(fd);
        attachedNs += monoNowNs() - t0;
        attachedFlag = false;
        return true;
    }

    void run() {
        uint64_t retryAt = 0;
        while (!quit) {
            if (!demand() || monoNowNs() < retryAt) {
                if (state.load() != -1) state = 0;
                usleep(5000);
                continue;
            }
            const uint64_t keptBefore = framesKept.load();
            if (session()) {
                state = 0;
                lastError.clear();
                // a stream that ended without a single fresh frame: don't spin
                if (framesKept.load() == keptBefore && streaming.load()) usleep(200000);
                continue;
            }
            state = -1;
            const std::string e = error();
            if (e != lastError) {
                std::printf("feed unavailable (%s); retrying every 5 s, the room map keeps its last state\n", e.c_str());
                std::fflush(stdout);
                lastError = e;
            }
            shotsDone = shotsWanted.load();  // drop pending shots
            retryAt = monoNowNs() + 5000000000ull;
        }
    }
};
