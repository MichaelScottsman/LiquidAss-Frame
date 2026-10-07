// Saves what the headset shows (SteamVR's system.HeadsetView overlay, sampled
// through IVROverlayView) as a PNG. It shows the room: delete after looking.
//   ./hvgrab out.png [scale]
#include <openvr.h>
#include <vulkan/vulkan.h>

#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#include "vkinit.h"

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

int main(int argc, char **argv) {
    const char *out = argc > 1 ? argv[1] : "/tmp/lgs/hv.png";
    const int scale = argc > 2 ? std::atoi(argv[2]) : 2;
    vr::EVRInitError err = vr::VRInitError_None;
    vr::VR_Init(&err, vr::VRApplication_Overlay);
    if (err != vr::VRInitError_None) return 1;
    Vk vk;
    if (!InitVulkan(vk)) return 2;
    VkInstance inst = vk.inst;
    VkPhysicalDevice phys = vk.phys;
    VkDevice dev = vk.dev;
    VkQueue q = vk.queue;

    vr::VROverlayHandle_t hv;
    if (vr::VROverlay()->FindOverlay("system.HeadsetView", &hv) != vr::VROverlayError_None) return 4;
    vr::VRVulkanDevice_t vd{inst, dev, phys, q, vk.qfam};
    vr::VRNativeDevice_t nd{&vd, vr::DeviceType_Vulkan};
    vr::VROverlayView_t v{};
    if (vr::VROverlayView()->AcquireOverlayView(hv, &nd, &v, sizeof v) != vr::VROverlayError_None || !v.texture.handle) return 5;
    auto *t = static_cast<vr::VRVulkanTextureData_t *>(v.texture.handle);
    const uint32_t w = t->m_nWidth, h = t->m_nHeight;

    VkBufferCreateInfo bci{VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO};
    bci.size = VkDeviceSize(w) * h * 4;
    bci.usage = VK_BUFFER_USAGE_TRANSFER_DST_BIT;
    VkBuffer buf;
    vkCreateBuffer(dev, &bci, nullptr, &buf);
    VkMemoryRequirements mr;
    vkGetBufferMemoryRequirements(dev, buf, &mr);
    VkPhysicalDeviceMemoryProperties mp;
    vkGetPhysicalDeviceMemoryProperties(phys, &mp);
    uint32_t type = 0;
    for (uint32_t i = 0; i < mp.memoryTypeCount; i++)
        if ((mr.memoryTypeBits & (1u << i)) && (mp.memoryTypes[i].propertyFlags & 6) == 6) { type = i; break; }
    VkMemoryAllocateInfo mai{VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO};
    mai.allocationSize = mr.size;
    mai.memoryTypeIndex = type;
    VkDeviceMemory mem;
    vkAllocateMemory(dev, &mai, nullptr, &mem);
    vkBindBufferMemory(dev, buf, mem, 0);
    VkCommandPoolCreateInfo pci{VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO};
    pci.queueFamilyIndex = vk.qfam;
    VkCommandPool pool;
    vkCreateCommandPool(dev, &pci, nullptr, &pool);
    VkCommandBufferAllocateInfo cai{VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO};
    cai.commandPool = pool;
    cai.commandBufferCount = 1;
    VkCommandBuffer cb;
    vkAllocateCommandBuffers(dev, &cai, &cb);
    VkCommandBufferBeginInfo bi{VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO};
    vkBeginCommandBuffer(cb, &bi);
    VkImageMemoryBarrier b{VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER};
    b.oldLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
    b.newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
    b.srcQueueFamilyIndex = b.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    b.image = VkImage(t->m_nImage);
    b.subresourceRange = {VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1};
    b.srcAccessMask = VK_ACCESS_SHADER_READ_BIT;
    b.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
    vkCmdPipelineBarrier(cb, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_TRANSFER_BIT, 0, 0, nullptr, 0, nullptr, 1, &b);
    VkBufferImageCopy r{};
    r.imageSubresource = {VK_IMAGE_ASPECT_COLOR_BIT, 0, 0, 1};
    r.imageExtent = {w, h, 1};
    vkCmdCopyImageToBuffer(cb, VkImage(t->m_nImage), VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL, buf, 1, &r);
    std::swap(b.oldLayout, b.newLayout);
    b.srcAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
    b.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
    vkCmdPipelineBarrier(cb, VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &b);
    vkEndCommandBuffer(cb);
    VkSubmitInfo si{VK_STRUCTURE_TYPE_SUBMIT_INFO};
    si.commandBufferCount = 1;
    si.pCommandBuffers = &cb;
    vkQueueSubmit(q, 1, &si, VK_NULL_HANDLE);
    vkQueueWaitIdle(q);
    void *p;
    vkMapMemory(dev, mem, 0, bci.size, 0, &p);
    // crop to the valid bounds, downscale by `scale`, drop alpha
    const uint32_t cw = uint32_t(w * v.textureBounds.uMax), ch = uint32_t(h * v.textureBounds.vMax);
    const uint32_t ow = cw / scale, oh = ch / scale;
    std::vector<uint8_t> rgb(size_t(ow) * oh * 3);
    const auto *src = static_cast<const uint8_t *>(p);
    for (uint32_t y = 0; y < oh; y++)
        for (uint32_t x = 0; x < ow; x++) {
            const uint8_t *s = src + (size_t(y * scale) * w + x * scale) * 4;
            uint8_t *d = &rgb[(size_t(y) * ow + x) * 3];
            d[0] = s[0]; d[1] = s[1]; d[2] = s[2];
        }
    vkUnmapMemory(dev, mem);
    stbi_write_png(out, int(ow), int(oh), 3, rgb.data(), int(ow * 3));
    vr::VROverlayView()->ReleaseOverlayView(&v);
    std::printf("%s %ux%u\n", out, ow, oh);
    vr::VR_Shutdown();
    return 0;
}
