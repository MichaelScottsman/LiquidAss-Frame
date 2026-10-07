// Test helper: an overlay "fx.fakesteam" (1920x1080 mouse scale) that never
// gets a texture, so the compositor draws nothing for it, and has no input
// method. A hidden overlay answers GetTransformForOverlayCoordinates in
// overlay-local coordinates (a quad at the origin); shown, in world space.
//   0-4 s   hidden (local coordinates),
//   4-8 s   shown, 0.98 m wide at x = 0, 1.43 m in front of the origin,
//   8 s     destroyed and re-created (new handle), shown 1.96 m wide at x = 1.0,
//   14 s    destroyed.
//   fakeov2 probe   only prints what a shown, texture-less overlay reports, then exits.
#include <openvr.h>

#include <cstdio>
#include <cstring>
#include <unistd.h>

static vr::VROverlayHandle_t make() {
    vr::VROverlayHandle_t h = vr::k_ulOverlayHandleInvalid;
    auto err = vr::VROverlay()->CreateOverlay("fx.fakesteam", "fx fake steam", &h);
    if (err != vr::VROverlayError_None) std::printf("CreateOverlay %d\n", int(err));
    vr::HmdVector2_t ms = {1920.f, 1080.f};
    vr::VROverlay()->SetOverlayMouseScale(h, &ms);
    vr::VROverlay()->SetOverlayInputMethod(h, vr::VROverlayInputMethod_None);
    return h;
}
static void place(vr::VROverlayHandle_t h, float x, float width) {
    vr::VROverlay()->SetOverlayWidthInMeters(h, width);
    vr::HmdMatrix34_t m = {{{1, 0, 0, x}, {0, 1, 0, 1.1f}, {0, 0, 1, -1.43f}}};
    vr::VROverlay()->SetOverlayTransformAbsolute(h, vr::TrackingUniverseStanding, &m);
}
static void report(vr::VROverlayHandle_t h, const char *what) {
    vr::HmdMatrix34_t a{}, b{};
    auto ea = vr::VROverlay()->GetTransformForOverlayCoordinates(h, vr::TrackingUniverseStanding, {0.f, 0.f}, &a);
    vr::VROverlay()->GetTransformForOverlayCoordinates(h, vr::TrackingUniverseStanding, {1920.f, 0.f}, &b);
    std::printf("  %s: visible %d, err %d, bottom-left %.2f %.2f %.2f, bottom edge %.2f m\n", what, int(vr::VROverlay()->IsOverlayVisible(h)),
                int(ea), double(a.m[0][3]), double(a.m[1][3]), double(a.m[2][3]), double(b.m[0][3] - a.m[0][3]));
    std::fflush(stdout);
}

int main(int argc, char **argv) {
    vr::EVRInitError e = vr::VRInitError_None;
    vr::VR_Init(&e, vr::VRApplication_Overlay);
    if (e != vr::VRInitError_None) return 1;
    auto h = make();
    if (argc > 1 && std::strcmp(argv[1], "probe") == 0) {
        place(h, 0.f, 0.98f);
        report(h, "hidden, placed");
        vr::VROverlay()->ShowOverlay(h);
        usleep(100000);
        report(h, "shown, placed, no texture");
        vr::VROverlay()->HideOverlay(h);
        vr::VROverlay()->DestroyOverlay(h);
        vr::VR_Shutdown();
        return 0;
    }
    std::printf("t=0 created 0x%016llx, hidden\n", (unsigned long long)h);
    std::fflush(stdout);
    sleep(4);
    place(h, 0.f, 0.98f);
    vr::VROverlay()->ShowOverlay(h);
    std::printf("t=4 shown at x=0, 0.98 m\n");
    std::fflush(stdout);
    sleep(4);
    vr::VROverlay()->DestroyOverlay(h);
    usleep(200000);
    h = make();
    place(h, 1.0f, 1.96f);
    vr::VROverlay()->ShowOverlay(h);
    std::printf("t=8.2 re-created 0x%016llx at x=1.0, 1.96 m, shown\n", (unsigned long long)h);
    std::fflush(stdout);
    sleep(6);
    vr::VROverlay()->DestroyOverlay(h);
    std::printf("t=14 destroyed\n");
    vr::VR_Shutdown();
    return 0;
}
