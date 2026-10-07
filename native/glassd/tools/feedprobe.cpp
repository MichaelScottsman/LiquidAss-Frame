// Feed probe (read-only, nothing is written or kept): how the passthrough
// loopback behaves when a reader attaches briefly. For each session it opens
// /dev/video99, streams with mmap buffers for a short time and prints, per
// dequeued frame, the time since STREAMON, the frame's age (buffer timestamp
// vs CLOCK_MONOTONIC), the sequence number and a cheap checksum (to spot a
// stale frame repeated from the previous session). Pixels are never stored.
//   feedprobe [sessions=3] [ms per session=300] [gap ms=1500] [buffers=2]
#include <fcntl.h>
#include <linux/videodev2.h>
#include <poll.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <time.h>
#include <unistd.h>

#include <cerrno>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

static uint64_t nowNs(clockid_t c = CLOCK_MONOTONIC) {
    timespec ts;
    clock_gettime(c, &ts);
    return uint64_t(ts.tv_sec) * 1000000000ull + uint64_t(ts.tv_nsec);
}

int main(int argc, char **argv) {
    const int sessions = argc > 1 ? std::atoi(argv[1]) : 3;
    const int ms = argc > 2 ? std::atoi(argv[2]) : 300;
    const int gap = argc > 3 ? std::atoi(argv[3]) : 1500;
    const unsigned nbuf = argc > 4 ? unsigned(std::atoi(argv[4])) : 2;
    uint32_t lastSum = 0;
    for (int s = 0; s < sessions; s++) {
        const uint64_t t0 = nowNs();
        int fd = open("/dev/video99", O_RDONLY | O_NONBLOCK | O_CLOEXEC);
        if (fd < 0) { std::printf("open: %s\n", strerror(errno)); return 1; }
        v4l2_format fmt{};
        fmt.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        ioctl(fd, VIDIOC_G_FMT, &fmt);
        const int W = int(fmt.fmt.pix.width), H = int(fmt.fmt.pix.height);
        const int stride = fmt.fmt.pix.bytesperline ? int(fmt.fmt.pix.bytesperline) : W * 3;
        v4l2_requestbuffers rb{};
        rb.count = nbuf;
        rb.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        rb.memory = V4L2_MEMORY_MMAP;
        if (ioctl(fd, VIDIOC_REQBUFS, &rb) < 0) { std::printf("REQBUFS: %s\n", strerror(errno)); return 1; }
        std::vector<void *> maps(rb.count, MAP_FAILED);
        std::vector<size_t> lens(rb.count, 0);
        for (unsigned i = 0; i < rb.count; i++) {
            v4l2_buffer b{};
            b.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
            b.memory = V4L2_MEMORY_MMAP;
            b.index = i;
            ioctl(fd, VIDIOC_QUERYBUF, &b);
            lens[i] = b.length;
            maps[i] = mmap(nullptr, b.length, PROT_READ, MAP_SHARED, fd, b.m.offset);
            ioctl(fd, VIDIOC_QBUF, &b);
        }
        int type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        ioctl(fd, VIDIOC_STREAMON, &type);
        const uint64_t ton = nowNs();
        std::printf("session %d: %dx%d, %u buffers, open+setup %.1f ms\n", s, W, H, rb.count, double(ton - t0) / 1e6);
        int n = 0;
        while (nowNs() - ton < uint64_t(ms) * 1000000ull) {
            pollfd p{fd, POLLIN, 0};
            if (poll(&p, 1, 50) <= 0) continue;
            v4l2_buffer b{};
            b.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
            b.memory = V4L2_MEMORY_MMAP;
            if (ioctl(fd, VIDIOC_DQBUF, &b) < 0) continue;
            const uint64_t t = nowNs();
            const uint64_t ts = uint64_t(b.timestamp.tv_sec) * 1000000000ull + uint64_t(b.timestamp.tv_usec) * 1000ull;
            uint32_t sum = 0;
            unsigned peak = 0;
            const uint8_t *px = static_cast<const uint8_t *>(maps[b.index]);
            for (int y = 0; y < H; y += 37)
                for (int x = 0; x < W * 3; x += 101) {
                    sum = sum * 31 + px[size_t(y) * stride + x];
                    peak = px[size_t(y) * stride + x] > peak ? px[size_t(y) * stride + x] : peak;
                }
            if (n < 6 || n % 10 == 0)
                std::printf("  +%6.1f ms  seq %u  age %8.1f ms  flags 0x%x  sum %08x%s peak %u\n", double(t - ton) / 1e6, b.sequence,
                            ts ? (double(t) - double(ts)) / 1e6 : -1.0, b.flags, sum, sum == lastSum ? " (same as previous)" : "", peak);
            lastSum = sum;
            n++;
            ioctl(fd, VIDIOC_QBUF, &b);
        }
        ioctl(fd, VIDIOC_STREAMOFF, &type);
        for (unsigned i = 0; i < rb.count; i++)
            if (maps[i] != MAP_FAILED) munmap(maps[i], lens[i]);
        close(fd);
        std::printf("  %d frames in %d ms; closed after %.1f ms total\n", n, ms, double(nowNs() - t0) / 1e6);
        if (s + 1 < sessions) usleep(useconds_t(gap) * 1000);
    }
    return 0;
}
