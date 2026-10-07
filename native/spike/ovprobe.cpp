// Read-only overlay geometry probe: texture bounds, mouse scale and the world
// position of the corners / centre of each named overlay. Creates nothing.
//   ./ovprobe [key ...]     (default: Steam's main window and bar)
#include <openvr.h>

#include <cstdio>
#include <vector>

int main(int argc, char **argv) {
    vr::EVRInitError err = vr::VRInitError_None;
    vr::VR_Init(&err, vr::VRApplication_Overlay);
    if (err != vr::VRInitError_None) { std::printf("VR_Init: %s\n", vr::VR_GetVRInitErrorAsEnglishDescription(err)); return 1; }
    std::vector<const char *> keys;
    for (int i = 1; i < argc; i++) keys.push_back(argv[i]);
    if (keys.empty()) keys = {"valve.steam.gamepadui.main", "valve.steam.gamepadui.bar"};
    auto *ov = vr::VROverlay();
    std::printf("dashboard visible %d\n", ov->IsDashboardVisible());
    for (const char *key : keys) {
        vr::VROverlayHandle_t h;
        if (ov->FindOverlay(key, &h) != vr::VROverlayError_None) { std::printf("%s: not found\n", key); continue; }
        vr::VRTextureBounds_t tb{};
        ov->GetOverlayTextureBounds(h, &tb);
        vr::HmdVector2_t ms{};
        ov->GetOverlayMouseScale(h, &ms);
        float wm = 0, curv = 0;
        ov->GetOverlayWidthInMeters(h, &wm);
        ov->GetOverlayCurvature(h, &curv);
        uint32_t tw = 0, th = 0;
        ov->GetOverlayTextureSize(h, &tw, &th);
        std::printf("%s: visible %d bounds (%.4f,%.4f)-(%.4f,%.4f) mouse %.0fx%.0f width %.3f m curvature %.3f tex %ux%u\n", key,
                    ov->IsOverlayVisible(h), tb.uMin, tb.vMin, tb.uMax, tb.vMax, ms.v[0], ms.v[1], wm, curv, tw, th);
        const float pts[][2] = {{0, 0}, {ms.v[0], 0}, {0, ms.v[1]}, {ms.v[0], ms.v[1]}, {ms.v[0] / 2, ms.v[1] / 2}};
        const char *names[] = {"(0,0)", "(W,0)", "(0,H)", "(W,H)", "centre"};
        for (int i = 0; i < 5; i++) {
            vr::HmdVector2_t q = {{pts[i][0], pts[i][1]}};
            vr::HmdMatrix34_t m{};
            auto e = ov->GetTransformForOverlayCoordinates(h, vr::TrackingUniverseStanding, q, &m);
            std::printf("  %-7s -> (% .4f % .4f % .4f) %s\n", names[i], m.m[0][3], m.m[1][3], m.m[2][3],
                        e == vr::VROverlayError_None ? "" : ov->GetOverlayErrorNameFromEnum(e));
        }
    }
    vr::VR_Shutdown();
    return 0;
}
