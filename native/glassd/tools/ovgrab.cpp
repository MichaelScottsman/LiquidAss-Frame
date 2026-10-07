// ovgrab: reads an overlay's current texture back from SteamVR through
// IVROverlayView (Vulkan) and writes it as PNG, to check what the compositor
// actually holds for glassd's overlays.
//   ovgrab KEY out.png
// (IVROverlayView cannot read Steam's own panels; it can read ours.)
#include <openvr.h>
#include <vulkan/vulkan.h>

#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

static std::vector<std::string> Split(const char *s) {
    std::vector<std::string> out;
    std::string cur;
    for (const char *p = s; *p; p++) {
        if (*p == ' ') { if (!cur.empty()) out.push_back(cur); cur.clear(); }
        else cur += *p;
    }
    if (!cur.empty()) out.push_back(cur);
    return out;
}

int main(int argc, char **argv) {
    if (argc < 3) { std::fprintf(stderr, "usage: ovgrab KEY out.png\n"); return 2; }
    vr::EVRInitError err = vr::VRInitError_None;
    vr::VR_Init(&err, vr::VRApplication_Overlay);
    if (err != vr::VRInitError_None) { std::fprintf(stderr, "VR_Init failed\n"); return 1; }
    vr::VROverlayHandle_t ov;
    if (vr::VROverlay()->FindOverlay(argv[1], &ov) != vr::VROverlayError_None) { std::fprintf(stderr, "no overlay %s\n", argv[1]); return 3; }

    // Vulkan device with the external-memory extensions SteamVR needs.
    std::vector<std::string> iext = {"VK_KHR_get_physical_device_properties2", "VK_KHR_external_memory_capabilities",
                                     "VK_KHR_external_semaphore_capabilities"};
    std::vector<const char *> ip;
    for (auto &e : iext) ip.push_back(e.c_str());
    VkApplicationInfo app{VK_STRUCTURE_TYPE_APPLICATION_INFO};
    app.pApplicationName = "ovgrab";
    app.apiVersion = VK_API_VERSION_1_1;
    VkInstanceCreateInfo ici{VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO};
    ici.pApplicationInfo = &app;
    ici.enabledExtensionCount = uint32_t(ip.size());
    ici.ppEnabledExtensionNames = ip.data();
    VkInstance inst;
    if (vkCreateInstance(&ici, nullptr, &inst) != VK_SUCCESS) return 4;
    uint32_t n = 0;
    vkEnumeratePhysicalDevices(inst, &n, nullptr);
    std::vector<VkPhysicalDevice> pds(n);
    vkEnumeratePhysicalDevices(inst, &n, pds.data());
    if (!n) return 4;
    VkPhysicalDevice phys = pds[0];
    uint32_t qn = 0, qfam = 0;
    vkGetPhysicalDeviceQueueFamilyProperties(phys, &qn, nullptr);
    std::vector<VkQueueFamilyProperties> qf(qn);
    vkGetPhysicalDeviceQueueFamilyProperties(phys, &qn, qf.data());
    for (uint32_t i = 0; i < qn; i++) if (qf[i].queueFlags & VK_QUEUE_GRAPHICS_BIT) { qfam = i; break; }
    std::vector<std::string> want = {"VK_KHR_external_memory", "VK_KHR_external_memory_fd", "VK_KHR_external_semaphore",
                                     "VK_KHR_external_semaphore_fd", "VK_KHR_dedicated_allocation", "VK_KHR_get_memory_requirements2",
                                     "VK_EXT_external_memory_dma_buf", "VK_KHR_timeline_semaphore", "VK_EXT_image_drm_format_modifier",
                                     "VK_KHR_image_format_list", "VK_KHR_bind_memory2", "VK_KHR_sampler_ycbcr_conversion",
                                     "VK_KHR_maintenance1"};
    uint32_t en = 0;
    vkEnumerateDeviceExtensionProperties(phys, nullptr, &en, nullptr);
    std::vector<VkExtensionProperties> ep(en);
    vkEnumerateDeviceExtensionProperties(phys, nullptr, &en, ep.data());
    std::vector<std::string> keep;
    for (auto &e : want)
        for (auto &p : ep)
            if (e == p.extensionName) keep.push_back(e);
    std::vector<const char *> dp;
    for (auto &e : keep) dp.push_back(e.c_str());
    float prio = 1.f;
    VkDeviceQueueCreateInfo qci{VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO};
    qci.queueFamilyIndex = qfam;
    qci.queueCount = 1;
    qci.pQueuePriorities = &prio;
    VkDeviceCreateInfo dci{VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO};
    dci.queueCreateInfoCount = 1;
    dci.pQueueCreateInfos = &qci;
    dci.enabledExtensionCount = uint32_t(dp.size());
    dci.ppEnabledExtensionNames = dp.data();
    VkDevice dev;
    if (vkCreateDevice(phys, &dci, nullptr, &dev) != VK_SUCCESS) return 4;
    VkQueue q;
    vkGetDeviceQueue(dev, qfam, 0, &q);

    vr::VRVulkanDevice_t vd{inst, dev, phys, q, qfam};
    vr::VRNativeDevice_t nd{&vd, vr::DeviceType_Vulkan};
    vr::VROverlayView_t v{};
    auto e = vr::VROverlayView()->AcquireOverlayView(ov, &nd, &v, sizeof v);
    if (e != vr::VROverlayError_None || !v.texture.handle) {
        std::fprintf(stderr, "AcquireOverlayView(%s): %s\n", argv[1], vr::VROverlay()->GetOverlayErrorNameFromEnum(e));
        return 5;
    }
    auto *t = static_cast<vr::VRVulkanTextureData_t *>(v.texture.handle);
    const uint32_t w = t->m_nWidth, h = t->m_nHeight;
    std::printf("%s: %ux%u vk format %u, bounds (%.2f,%.2f)-(%.2f,%.2f)\n", argv[1], w, h, t->m_nFormat, v.textureBounds.uMin,
                v.textureBounds.vMin, v.textureBounds.uMax, v.textureBounds.vMax);

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
    pci.queueFamilyIndex = qfam;
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
    void *p = nullptr;
    vkMapMemory(dev, mem, 0, bci.size, 0, &p);
    std::vector<uint8_t> px(static_cast<uint8_t *>(p), static_cast<uint8_t *>(p) + bci.size);
    vkUnmapMemory(dev, mem);
    if (t->m_nFormat == VK_FORMAT_B8G8R8A8_UNORM || t->m_nFormat == VK_FORMAT_B8G8R8A8_SRGB)
        for (size_t i = 0; i < px.size(); i += 4) std::swap(px[i], px[i + 2]);
    stbi_write_png(argv[2], int(w), int(h), 4, px.data(), int(w * 4));
    std::printf("wrote %s\n", argv[2]);
    vr::VROverlayView()->ReleaseOverlayView(&v);
    vkDestroyCommandPool(dev, pool, nullptr);
    vkDestroyBuffer(dev, buf, nullptr);
    vkFreeMemory(dev, mem, nullptr);
    vr::VR_Shutdown();
    return 0;
}
