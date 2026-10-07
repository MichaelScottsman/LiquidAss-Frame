// Passthrough feed for the room model. SteamVR's v4l2cam publishes the
// compositor's right-eye view on a v4l2loopback device (/dev/video99,
// 1920x1080 RGB24). A capture thread streams it with V4L2 mmap buffers (falls
// back to read()), and box-downsamples the frames it is asked for to a quarter
// resolution RGBA image. Frames stay in RAM; nothing is recorded.
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
    std::atomic<int> state{0};  // 0 idle, 1 opening, 2 streaming, -1 failed
    std::atomic<uint64_t> framesSeen{0}, framesKept{0};
    std::atomic<uint64_t> minIntervalNs{27000000ull};  // process at most ~36 Hz
    std::string device = "/dev/video99";
    std::string mode = "none";
    std::string error;
    int factor = 4;  // downsample factor (4: 1920x1080 -> 480x270)

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
    std::mutex mu;
    FeedFrame front, back;
    uint64_t lastSeq = 0, nextSeq = 1;
    uint64_t lastKeptNs = 0;
    int W = 0, H = 0, stride = 0;

    struct Buf {
        void *p = MAP_FAILED;
        size_t len = 0;
    };

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

    bool runMmap(int fd) {
        v4l2_requestbuffers rb{};
        rb.count = 4;
        rb.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        rb.memory = V4L2_MEMORY_MMAP;
        if (ioctl(fd, VIDIOC_REQBUFS, &rb) < 0 || rb.count == 0) {
            error = std::string("REQBUFS: ") + strerror(errno);
            return false;
        }
        std::vector<Buf> bufs(rb.count);
        bool ok = true;
        for (uint32_t i = 0; i < rb.count && ok; i++) {
            v4l2_buffer b{};
            b.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
            b.memory = V4L2_MEMORY_MMAP;
            b.index = i;
            if (ioctl(fd, VIDIOC_QUERYBUF, &b) < 0) { error = std::string("QUERYBUF: ") + strerror(errno); ok = false; break; }
            bufs[i].len = b.length;
            bufs[i].p = mmap(nullptr, b.length, PROT_READ, MAP_SHARED, fd, b.m.offset);
            if (bufs[i].p == MAP_FAILED) { error = std::string("mmap: ") + strerror(errno); ok = false; break; }
            if (ioctl(fd, VIDIOC_QBUF, &b) < 0) { error = std::string("QBUF: ") + strerror(errno); ok = false; break; }
        }
        int type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        if (ok && ioctl(fd, VIDIOC_STREAMON, &type) < 0) { error = std::string("STREAMON: ") + strerror(errno); ok = false; }
        if (ok) {
            mode = "mmap x" + std::to_string(rb.count);
            std::printf("feed %s %dx%d RGB24 via mmap (%u buffers), kept at 1/%d\n", device.c_str(), W, H, rb.count, factor);
            std::fflush(stdout);
            int failures = 0;
            while (!quit) {
                pollfd pfd{fd, POLLIN, 0};
                int pr = poll(&pfd, 1, 200);
                if (pr <= 0) continue;
                v4l2_buffer b{};
                b.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
                b.memory = V4L2_MEMORY_MMAP;
                if (ioctl(fd, VIDIOC_DQBUF, &b) < 0) {
                    if (errno == EAGAIN || errno == EINTR) continue;
                    if (++failures > 50) { error = std::string("DQBUF: ") + strerror(errno); break; }
                    usleep(5000);
                    continue;
                }
                failures = 0;
                framesSeen++;
                uint64_t t = monoNowNs();
                if (b.index < bufs.size() && wanted(t) && b.bytesused >= size_t(stride) * H) {
                    if (process(static_cast<const uint8_t *>(bufs[b.index].p), t)) {
                        lastKeptNs = t;
                        state = 2;
                    }
                }
                ioctl(fd, VIDIOC_QBUF, &b);
            }
            ioctl(fd, VIDIOC_STREAMOFF, &type);
        }
        for (auto &b : bufs)
            if (b.p != MAP_FAILED) munmap(b.p, b.len);
        return ok;
    }

    void runRead(int fd) {
        // Non-blocking reads gated by poll(), so stop() never waits on a stalled feed.
        int fl = fcntl(fd, F_GETFL);
        fcntl(fd, F_SETFL, fl | O_NONBLOCK);
        mode = "read";
        std::printf("feed %s %dx%d RGB24 via read(), kept at 1/%d\n", device.c_str(), W, H, factor);
        std::fflush(stdout);
        const size_t size = size_t(stride) * H;
        std::vector<uint8_t> raw(size);
        while (!quit) {
            size_t got = 0;
            while (got < size && !quit) {
                pollfd pfd{fd, POLLIN, 0};
                if (poll(&pfd, 1, 200) <= 0) continue;
                ssize_t n = ::read(fd, raw.data() + got, size - got);
                if (n <= 0) {
                    if (n < 0 && (errno == EINTR || errno == EAGAIN)) continue;
                    error = "feed read ended";
                    state = -1;
                    return;
                }
                got += size_t(n);
            }
            if (quit) break;
            framesSeen++;
            uint64_t t = monoNowNs();
            if (wanted(t) && process(raw.data(), t)) {
                lastKeptNs = t;
                state = 2;
            }
        }
    }

    void run() {
        state = 1;
        int fd = ::open(device.c_str(), O_RDONLY | O_NONBLOCK | O_CLOEXEC);
        if (fd < 0) {
            error = "open " + device + ": " + strerror(errno);
            state = -1;
            std::printf("feed unavailable (%s); room map stays on its fill colour\n", error.c_str());
            std::fflush(stdout);
            return;
        }
        v4l2_format fmt{};
        fmt.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        if (ioctl(fd, VIDIOC_G_FMT, &fmt) < 0 || fmt.fmt.pix.pixelformat != V4L2_PIX_FMT_RGB24) {
            error = "unexpected feed format";
            state = -1;
            ::close(fd);
            std::printf("feed unavailable (%s)\n", error.c_str());
            std::fflush(stdout);
            return;
        }
        W = int(fmt.fmt.pix.width);
        H = int(fmt.fmt.pix.height);
        stride = fmt.fmt.pix.bytesperline ? int(fmt.fmt.pix.bytesperline) : W * 3;
        if (!runMmap(fd) && !quit) {
            std::printf("feed mmap streaming failed (%s); using read()\n", error.c_str());
            std::fflush(stdout);
            ::close(fd);
            fd = ::open(device.c_str(), O_RDONLY | O_NONBLOCK | O_CLOEXEC);
            if (fd < 0) {
                error = "reopen " + device + ": " + strerror(errno);
                state = -1;
                return;
            }
            runRead(fd);
        }
        ::close(fd);
        if (state != -1) state = 0;
    }
};
