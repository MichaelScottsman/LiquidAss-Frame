// Publishes "glassd.test" as a dmabuf-backed shared texture (the path Steam
// and frametop use), so a SteamVR scene-graph panel can show it by key.
//   ./dmabuftest [seconds]
#include <gbm.h>
#include <openvr.h>

#include <fcntl.h>
#include <unistd.h>

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <thread>

#ifndef DRM_FORMAT_MOD_LINEAR
#define DRM_FORMAT_MOD_LINEAR 0ULL
#endif

int main(int argc, char **argv) {
    const int seconds = argc > 1 ? std::atoi(argv[1]) : 90;
    vr::EVRInitError err = vr::VRInitError_None;
    vr::VR_Init(&err, vr::VRApplication_Overlay);
    if (err != vr::VRInitError_None) { std::printf("VR_Init: %s\n", vr::VR_GetVRInitErrorAsEnglishDescription(err)); return 1; }

    const int W = 512, H = 288;
    int drm = open("/dev/dri/renderD128", O_RDWR | O_CLOEXEC);
    gbm_device *gbm = gbm_create_device(drm);
    gbm_bo *bo = gbm ? gbm_bo_create(gbm, W, H, GBM_FORMAT_ABGR8888, GBM_BO_USE_LINEAR | GBM_BO_USE_RENDERING) : nullptr;
    if (!bo) { std::printf("gbm_bo_create failed\n"); return 1; }
    uint32_t stride = 0;
    void *mapData = nullptr;
    auto *px = static_cast<uint8_t *>(gbm_bo_map(bo, 0, 0, W, H, GBM_BO_TRANSFER_WRITE, &stride, &mapData));
    if (!px) { std::printf("gbm_bo_map failed\n"); return 1; }
    for (int y = 0; y < H; y++)
        for (int x = 0; x < W; x++) {
            uint8_t *p = px + y * stride + x * 4;   // ABGR8888 = bytes R,G,B,A
            const bool rim = x < 6 || y < 6 || x >= W - 6 || y >= H - 6;
            const float t = float(y) / H;
            p[0] = uint8_t(rim ? 255 : 30 + 30 * t);
            p[1] = uint8_t(rim ? 255 : 110 + 60 * t);
            p[2] = uint8_t(rim ? 255 : 230);
            p[3] = 255;
        }
    gbm_bo_unmap(bo, mapData);

    vr::DmabufAttributes_t a{};
    a.unWidth = W;
    a.unHeight = H;
    a.unDepth = a.unMipLevels = a.unArrayLayers = a.unSampleCount = 1;
    a.unFormat = GBM_FORMAT_ABGR8888;
    a.ulModifier = DRM_FORMAT_MOD_LINEAR;
    a.unPlaneCount = 1;
    a.plane[0].unOffset = 0;
    a.plane[0].unStride = stride;
    a.plane[0].nFd = gbm_bo_get_fd(bo);
    vr::SharedTextureHandle_t h = 0;
    if (!vr::VRIPCResourceManager()->ImportDmabuf(vr::VRApplication_Overlay, &a, &h)) { std::printf("ImportDmabuf failed\n"); return 1; }

    vr::VROverlayHandle_t ov;
    auto e = vr::VROverlay()->CreateOverlay("glassd.test", "Glass Shell dmabuf test", &ov);
    std::printf("CreateOverlay: %s\n", vr::VROverlay()->GetOverlayErrorNameFromEnum(e));
    vr::Texture_t tex = {&h, vr::TextureType_SharedTextureHandle, vr::ColorSpace_Gamma};
    vr::HmdVector2_t mouse = {float(W), float(H)};
    vr::VROverlay()->SetOverlayMouseScale(ov, &mouse);
    vr::VROverlay()->SetOverlayWidthInMeters(ov, 0.6f);
    e = vr::VROverlay()->SetOverlayTexture(ov, &tex);
    std::printf("SetOverlayTexture(dmabuf): %s\n", vr::VROverlay()->GetOverlayErrorNameFromEnum(e));
    std::printf("publishing glassd.test (dmabuf %dx%d) for %d s\n", W, H, seconds);
    std::fflush(stdout);
    for (int i = 0; i < seconds * 10; i++) std::this_thread::sleep_for(std::chrono::milliseconds(100));
    vr::VROverlay()->DestroyOverlay(ov);
    vr::VRIPCResourceManager()->UnrefResource(h);
    vr::VR_Shutdown();
    return 0;
}
