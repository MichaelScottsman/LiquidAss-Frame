// Publishes an overlay texture under the key "glassd.test" (a vertical
// frosted-blue gradient with a bright rim) and keeps it alive, so a SteamVR
// scene-graph panel in systemui can show it by key. Never shown on its own.
//   ./keytest [seconds]
#include <openvr.h>

#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <thread>
#include <vector>

int main(int argc, char **argv) {
    const int seconds = argc > 1 ? std::atoi(argv[1]) : 120;
    vr::EVRInitError err = vr::VRInitError_None;
    vr::VR_Init(&err, vr::VRApplication_Overlay);
    if (err != vr::VRInitError_None) { std::printf("VR_Init: %s\n", vr::VR_GetVRInitErrorAsEnglishDescription(err)); return 1; }
    vr::VROverlayHandle_t h;
    auto e = vr::VROverlay()->CreateOverlay("glassd.test", "Glass Shell test backdrop", &h);
    std::printf("CreateOverlay: %s\n", vr::VROverlay()->GetOverlayErrorNameFromEnum(e));
    if (e != vr::VROverlayError_None) return 1;
    const int W = 256, H = 144;
    std::vector<uint8_t> px(W * H * 4);
    for (int y = 0; y < H; y++)
        for (int x = 0; x < W; x++) {
            uint8_t *p = &px[(y * W + x) * 4];
            const float t = float(y) / H;
            const bool rim = x < 3 || y < 3 || x >= W - 3 || y >= H - 3;
            p[0] = uint8_t(rim ? 255 : 40 + 40 * t);
            p[1] = uint8_t(rim ? 255 : 90 + 50 * t);
            p[2] = uint8_t(rim ? 255 : 180 + 40 * t);
            p[3] = 255;   // opaque: it should hide whatever is behind it
        }
    vr::VROverlay()->SetOverlayRaw(h, px.data(), W, H, 4);
    if (argc > 2 && std::string(argv[2]) == "show") {
        // Park it far below the floor so only scene-graph copies are seen.
        vr::HmdMatrix34_t m = {{{1, 0, 0, 0}, {0, 1, 0, -200.f}, {0, 0, 1, 0}}};
        vr::VROverlay()->SetOverlayTransformAbsolute(h, vr::TrackingUniverseStanding, &m);
        vr::VROverlay()->SetOverlayWidthInMeters(h, 0.1f);
        vr::VROverlay()->ShowOverlay(h);
        std::printf("shown (parked)\n");
    }
    std::printf("publishing glassd.test for %d s\n", seconds);
    std::fflush(stdout);
    for (int i = 0; i < seconds * 10; i++) std::this_thread::sleep_for(std::chrono::milliseconds(100));
    vr::VROverlay()->DestroyOverlay(h);
    vr::VR_Shutdown();
    return 0;
}
