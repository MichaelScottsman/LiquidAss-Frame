// Read-only probe: where Steam's main window and bar centres land in the
// passthrough feed (right eye, feed.cfg calibration), for the raw overlay
// quads. Prints feed uv (0..1 = inside the feed) per corner.
#include <openvr.h>

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>

int main() {
    vr::EVRInitError e = vr::VRInitError_None;
    vr::VR_Init(&e, vr::VRApplication_Overlay);
    if (e != vr::VRInitError_None) return 1;
    float a = 0.5617f, b = 0.4998f, c = -0.9998f, d = 0.4997f;
    std::string p = std::string(getenv("HOME")) + "/.config/liquid-glass-frame/feed.cfg";
    if (FILE *f = std::fopen(p.c_str(), "r")) {
        float L; int eye;
        if (std::fscanf(f, "%f %f %f %f %f %d", &a, &b, &c, &d, &L, &eye) < 4) std::printf("feed.cfg unreadable\n");
        std::fclose(f);
    }
    vr::TrackedDevicePose_t pose[1];
    vr::VRSystem()->GetDeviceToAbsoluteTrackingPose(vr::TrackingUniverseStanding, 0, pose, 1);
    vr::HmdMatrix34_t eh = vr::VRSystem()->GetEyeToHeadTransform(vr::Eye_Right);
    // eye = head * eyeToHead
    const auto &H = pose[0].mDeviceToAbsoluteTracking.m;
    float E[3][4];
    for (int i = 0; i < 3; i++)
        for (int j = 0; j < 4; j++) {
            E[i][j] = H[i][0] * eh.m[0][j] + H[i][1] * eh.m[1][j] + H[i][2] * eh.m[2][j] + (j == 3 ? H[i][3] : 0.f);
        }
    std::printf("head valid %d, forward %.2f %.2f %.2f\n", int(pose[0].bPoseIsValid), -H[0][2], -H[1][2], -H[2][2]);
    auto project = [&](float X, float Y, float Z, float &u, float &v) {
        float rx = X - E[0][3], ry = Y - E[1][3], rz = Z - E[2][3];
        // world -> eye: transpose of the rotation
        float ex = E[0][0] * rx + E[1][0] * ry + E[2][0] * rz;
        float ey = E[0][1] * rx + E[1][1] * ry + E[2][1] * rz;
        float ez = E[0][2] * rx + E[1][2] * ry + E[2][2] * rz;
        if (ez > -0.05f) { u = v = NAN; return; }
        u = a * (ex / -ez) + b;
        v = c * (ey / -ez) + d;
    };
    const char *keys[] = {"valve.steam.gamepadui.main", "valve.steam.gamepadui.bar"};
    for (const char *k : keys) {
        vr::VROverlayHandle_t h;
        if (vr::VROverlay()->FindOverlay(k, &h) != vr::VROverlayError_None) continue;
        vr::HmdVector2_t ms{};
        vr::VROverlay()->GetOverlayMouseScale(h, &ms);
        const float pts[][2] = {{0, 0}, {ms.v[0], 0}, {0, ms.v[1]}, {ms.v[0], ms.v[1]}, {ms.v[0] / 2, ms.v[1] / 2}};
        std::printf("%s (visible %d):", k, int(vr::VROverlay()->IsOverlayVisible(h)));
        for (auto &q : pts) {
            vr::HmdMatrix34_t m{};
            vr::VROverlay()->GetTransformForOverlayCoordinates(h, vr::TrackingUniverseStanding, {q[0], q[1]}, &m);
            float u, v;
            project(m.m[0][3], m.m[1][3], m.m[2][3], u, v);
            std::printf("  (%.2f, %.2f)", double(u), double(v));
        }
        std::printf("\n");
    }
    vr::VR_Shutdown();
    return 0;
}
