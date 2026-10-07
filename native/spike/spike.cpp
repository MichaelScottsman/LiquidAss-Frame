// Feasibility spike for glassd: can a separate process
//   1. read Steam's gamepadui overlay properties,
//   2. sample their textures through IVROverlayView (Vulkan), and
//   3. attach its own overlay relative to Steam's?
// Build on the Frame:  ./build.sh   Run:  ./spike [seconds]
#include <openvr.h>
#include <vulkan/vulkan.h>

#include <chrono>
#include <cstdio>
#include <cstring>
#include <string>
#include <thread>
#include <vector>

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

static const char *kKeys[] = {
    "valve.steam.gamepadui.main", "system.systemui", "system.HeadsetView", "XRService-CameraOverlay",
    "valve.steam.desktopgame.0",
};

static void PrintMat(const vr::HmdMatrix34_t &m) {
    for (int r = 0; r < 3; r++) std::printf("    [% .3f % .3f % .3f | % .3f]\n", m.m[r][0], m.m[r][1], m.m[r][2], m.m[r][3]);
}

#include "vkinit.h"

static uint32_t MemType(Vk &vk, uint32_t bits, VkMemoryPropertyFlags f) {
    VkPhysicalDeviceMemoryProperties mp;
    vkGetPhysicalDeviceMemoryProperties(vk.phys, &mp);
    for (uint32_t i = 0; i < mp.memoryTypeCount; i++)
        if ((bits & (1u << i)) && (mp.memoryTypes[i].propertyFlags & f) == f) return i;
    return 0;
}

// Copy the overlay view image to host memory and write it as PNG.
static bool SaveView(Vk &vk, const vr::VRVulkanTextureData_t *t, const char *path, VkImageLayout layout) {
    const uint32_t w = t->m_nWidth, h = t->m_nHeight;
    VkBufferCreateInfo bci{VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO};
    bci.size = VkDeviceSize(w) * h * 4;
    bci.usage = VK_BUFFER_USAGE_TRANSFER_DST_BIT;
    VkBuffer buf;
    vkCreateBuffer(vk.dev, &bci, nullptr, &buf);
    VkMemoryRequirements mr;
    vkGetBufferMemoryRequirements(vk.dev, buf, &mr);
    VkMemoryAllocateInfo mai{VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO};
    mai.allocationSize = mr.size;
    mai.memoryTypeIndex = MemType(vk, mr.memoryTypeBits, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT);
    VkDeviceMemory mem;
    vkAllocateMemory(vk.dev, &mai, nullptr, &mem);
    vkBindBufferMemory(vk.dev, buf, mem, 0);

    VkCommandPoolCreateInfo pci{VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO};
    pci.queueFamilyIndex = vk.qfam;
    VkCommandPool pool;
    vkCreateCommandPool(vk.dev, &pci, nullptr, &pool);
    VkCommandBufferAllocateInfo cai{VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO};
    cai.commandPool = pool;
    cai.commandBufferCount = 1;
    VkCommandBuffer cb;
    vkAllocateCommandBuffers(vk.dev, &cai, &cb);
    VkCommandBufferBeginInfo bi{VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO};
    vkBeginCommandBuffer(cb, &bi);
    VkImage img = VkImage(t->m_nImage);
    VkImageMemoryBarrier b{VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER};
    b.oldLayout = layout;
    b.newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
    b.srcQueueFamilyIndex = b.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    b.image = img;
    b.subresourceRange = {VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1};
    b.srcAccessMask = VK_ACCESS_SHADER_READ_BIT;
    b.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
    vkCmdPipelineBarrier(cb, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_TRANSFER_BIT, 0, 0, nullptr, 0, nullptr, 1, &b);
    VkBufferImageCopy r{};
    r.imageSubresource = {VK_IMAGE_ASPECT_COLOR_BIT, 0, 0, 1};
    r.imageExtent = {w, h, 1};
    vkCmdCopyImageToBuffer(cb, img, VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL, buf, 1, &r);
    std::swap(b.oldLayout, b.newLayout);
    b.srcAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
    b.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
    vkCmdPipelineBarrier(cb, VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &b);
    vkEndCommandBuffer(cb);
    VkSubmitInfo si{VK_STRUCTURE_TYPE_SUBMIT_INFO};
    si.commandBufferCount = 1;
    si.pCommandBuffers = &cb;
    vkQueueSubmit(vk.queue, 1, &si, VK_NULL_HANDLE);
    vkQueueWaitIdle(vk.queue);
    void *p = nullptr;
    vkMapMemory(vk.dev, mem, 0, bci.size, 0, &p);
    std::vector<uint8_t> px(static_cast<uint8_t *>(p), static_cast<uint8_t *>(p) + bci.size);
    vkUnmapMemory(vk.dev, mem);
    const bool bgra = t->m_nFormat == VK_FORMAT_B8G8R8A8_UNORM || t->m_nFormat == VK_FORMAT_B8G8R8A8_SRGB;
    if (bgra) for (size_t i = 0; i < px.size(); i += 4) std::swap(px[i], px[i + 2]);
    stbi_write_png(path, int(w), int(h), 4, px.data(), int(w * 4));
    vkDestroyCommandPool(vk.dev, pool, nullptr);
    vkDestroyBuffer(vk.dev, buf, nullptr);
    vkFreeMemory(vk.dev, mem, nullptr);
    return true;
}

int main(int argc, char **argv) {
    const int seconds = argc > 1 ? std::atoi(argv[1]) : 12;
    vr::EVRInitError err = vr::VRInitError_None;
    vr::VR_Init(&err, vr::VRApplication_Overlay);
    if (err != vr::VRInitError_None) { std::printf("VR_Init: %s\n", vr::VR_GetVRInitErrorAsEnglishDescription(err)); return 1; }
    auto *ov = vr::VROverlay();
    auto *view = vr::VROverlayView();
    std::printf("dashboard visible: %d, overlay view iface: %p\n", ov->IsDashboardVisible(), (void *)view);

    vr::VROverlayHandle_t mainH = vr::k_ulOverlayHandleInvalid;
    for (const char *key : kKeys) {
        vr::VROverlayHandle_t h = vr::k_ulOverlayHandleInvalid;
        auto e = ov->FindOverlay(key, &h);
        std::printf("\n%s: %s\n", key, ov->GetOverlayErrorNameFromEnum(e));
        if (e != vr::VROverlayError_None) continue;
        if (!std::strcmp(key, "valve.steam.gamepadui.main")) mainH = h;
        float wm = 0, curv = 0, alpha = 0;
        uint32_t sort = 0, flags = 0, tw = 0, th = 0;
        vr::VROverlayInputMethod im;
        vr::VROverlayTransformType tt;
        ov->GetOverlayWidthInMeters(h, &wm);
        ov->GetOverlayCurvature(h, &curv);
        ov->GetOverlayAlpha(h, &alpha);
        ov->GetOverlaySortOrder(h, &sort);
        ov->GetOverlayFlags(h, &flags);
        ov->GetOverlayTextureSize(h, &tw, &th);
        ov->GetOverlayInputMethod(h, &im);
        ov->GetOverlayTransformType(h, &tt);
        vr::VRTextureBounds_t tb{};
        ov->GetOverlayTextureBounds(h, &tb);
        std::printf("  visible=%d width=%.3fm curvature=%.3f alpha=%.2f sort=%u flags=0x%x tex=%ux%u input=%d transformType=%d bounds=(%.2f,%.2f)-(%.2f,%.2f) pid=%u viewPermitted=%d\n",
                    ov->IsOverlayVisible(h), wm, curv, alpha, sort, flags, tw, th, int(im), int(tt), tb.uMin, tb.vMin, tb.uMax, tb.vMax,
                    ov->GetOverlayRenderingPid(h), view ? view->IsViewingPermitted(h) : -1);
        vr::HmdMatrix34_t m;
        if (tt == vr::VROverlayTransform_Absolute) {
            vr::ETrackingUniverseOrigin o;
            ov->GetOverlayTransformAbsolute(h, &o, &m);
            std::printf("  absolute (origin %d):\n", int(o));
            PrintMat(m);
        } else if (tt == vr::VROverlayTransform_TrackedDeviceRelative) {
            vr::TrackedDeviceIndex_t d;
            ov->GetOverlayTransformTrackedDeviceRelative(h, &d, &m);
            std::printf("  relative to device %u:\n", d);
            PrintMat(m);
        } else {
            std::printf("  transform type %d (not read)\n", int(tt));
        }
    }

    Vk vk;
    if (view && InitVulkan(vk)) {
        vr::VRVulkanDevice_t vd{vk.inst, vk.dev, vk.phys, vk.queue, vk.qfam};
        vr::VRNativeDevice_t nd{&vd, vr::DeviceType_Vulkan};
        int idx = 0;
        for (const char *key : kKeys) {
            vr::VROverlayHandle_t h = vr::k_ulOverlayHandleInvalid;
            if (ov->FindOverlay(key, &h) != vr::VROverlayError_None) continue;
            vr::VROverlayView_t v{};
            auto e = view->AcquireOverlayView(h, &nd, &v, sizeof v);
            std::printf("\nAcquireOverlayView(%s): %s type=%d handle=%p bounds=(%.2f,%.2f)-(%.2f,%.2f)\n", key,
                        ov->GetOverlayErrorNameFromEnum(e), int(v.texture.eType), v.texture.handle, v.textureBounds.uMin,
                        v.textureBounds.vMin, v.textureBounds.uMax, v.textureBounds.vMax);
            if (e == vr::VROverlayError_None && v.texture.handle && v.texture.eType == vr::TextureType_Vulkan) {
                auto *t = static_cast<vr::VRVulkanTextureData_t *>(v.texture.handle);
                std::printf("  vk image %llx %ux%u format=%u samples=%u colorspace=%d\n", (unsigned long long)t->m_nImage,
                            t->m_nWidth, t->m_nHeight, t->m_nFormat, t->m_nSampleCount, int(v.texture.eColorSpace));
                char path[128];
                std::snprintf(path, sizeof path, "/tmp/lgs/spike_%d.png", idx);
                SaveView(vk, t, path, VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL);
                std::printf("  saved %s\n", path);
            }
            if (e == vr::VROverlayError_None) view->ReleaseOverlayView(&v);
            idx++;
        }
    }
    if (mainH != vr::k_ulOverlayHandleInvalid) {
        vr::HmdMatrix34_t c{};
        vr::HmdVector2_t mid = {0.5f, 0.5f};
        auto e = ov->GetTransformForOverlayCoordinates(mainH, vr::TrackingUniverseStanding, mid, &c);
        std::printf("\nmain centre transform (uv .5,.5): %s\n", ov->GetOverlayErrorNameFromEnum(e));
        PrintMat(c);
        vr::HmdVector2_t corner = {0.f, 0.f};
        ov->GetTransformForOverlayCoordinates(mainH, vr::TrackingUniverseStanding, corner, &c);
        std::printf("main corner (0,0):\n");
        PrintMat(c);
        corner = {1.f, 1.f};
        ov->GetTransformForOverlayCoordinates(mainH, vr::TrackingUniverseStanding, corner, &c);
        std::printf("main corner (1,1):\n");
        PrintMat(c);
    }

    // Our own overlay, attached to Steam's main window, 4 cm in front of it.
    if (mainH != vr::k_ulOverlayHandleInvalid) {
        vr::VROverlayHandle_t mine;
        auto e = ov->CreateOverlay("glassd.spike", "Glass Shell spike", &mine);
        std::printf("\nCreateOverlay: %s\n", ov->GetOverlayErrorNameFromEnum(e));
        if (e == vr::VROverlayError_None) {
            std::vector<uint8_t> px(64 * 64 * 4);
            for (int i = 0; i < 64 * 64; i++) { px[i * 4] = 255; px[i * 4 + 1] = 40; px[i * 4 + 2] = 200; px[i * 4 + 3] = 150; }
            ov->SetOverlayRaw(mine, px.data(), 64, 64, 4);
            ov->SetOverlayWidthInMeters(mine, 0.25f);
            // 4 cm in front of Steam's window: Steam's absolute pose times an offset.
            vr::ETrackingUniverseOrigin o = vr::TrackingUniverseStanding;
            vr::HmdMatrix34_t sm{};
            e = ov->GetOverlayTransformAbsolute(mainH, &o, &sm);
            std::printf("steam main absolute: %s\n", ov->GetOverlayErrorNameFromEnum(e));
            vr::HmdMatrix34_t m = sm;
            for (int r = 0; r < 3; r++) m.m[r][3] = sm.m[r][3] + sm.m[r][1] * 0.1f + sm.m[r][2] * 0.04f;
            e = ov->SetOverlayTransformAbsolute(mine, o, &m);
            std::printf("SetOverlayTransformAbsolute: %s\n", ov->GetOverlayErrorNameFromEnum(e));
            uint32_t s = 0;
            ov->GetOverlaySortOrder(mainH, &s);
            ov->SetOverlaySortOrder(mine, s + 1);
            ov->ShowOverlay(mine);
            std::printf("showing for %d s (visible=%d)\n", seconds, ov->IsOverlayVisible(mine));
            std::this_thread::sleep_for(std::chrono::seconds(seconds));
            ov->DestroyOverlay(mine);
        }
    }
    vr::VR_Shutdown();
    return 0;
}
