// Vulkan device setup for OpenVR interop (overlay views, shared textures):
// asks SteamVR which extensions it needs, then adds the external-memory set.
#pragma once
#include <openvr.h>
#include <vulkan/vulkan.h>

#include <cstdio>
#include <string>
#include <vector>

struct Vk {
    VkInstance inst = VK_NULL_HANDLE;
    VkPhysicalDevice phys = VK_NULL_HANDLE;
    VkDevice dev = VK_NULL_HANDLE;
    VkQueue queue = VK_NULL_HANDLE;
    uint32_t qfam = 0;
};

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

static bool InitVulkan(Vk &vk) {
    std::vector<std::string> iext = {"VK_KHR_get_physical_device_properties2", "VK_KHR_external_memory_capabilities",
                                     "VK_KHR_external_semaphore_capabilities"};
    if (vr::VRCompositor()) {
        char buf[4096] = {};
        vr::VRCompositor()->GetVulkanInstanceExtensionsRequired(buf, sizeof buf);
        for (auto &e : Split(buf)) iext.push_back(e);
        std::printf("openvr instance exts: %s\n", buf);
    } else {
        std::printf("no IVRCompositor in overlay mode; using default extension list\n");
    }
    std::vector<const char *> ip;
    for (auto &e : iext) ip.push_back(e.c_str());
    VkApplicationInfo app{VK_STRUCTURE_TYPE_APPLICATION_INFO};
    app.pApplicationName = "glassd-spike";
    app.apiVersion = VK_API_VERSION_1_1;
    VkInstanceCreateInfo ici{VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO};
    ici.pApplicationInfo = &app;
    ici.enabledExtensionCount = uint32_t(ip.size());
    ici.ppEnabledExtensionNames = ip.data();
    if (vkCreateInstance(&ici, nullptr, &vk.inst) != VK_SUCCESS) { std::printf("vkCreateInstance failed\n"); return false; }
    uint32_t n = 0;
    vkEnumeratePhysicalDevices(vk.inst, &n, nullptr);
    std::vector<VkPhysicalDevice> pds(n);
    vkEnumeratePhysicalDevices(vk.inst, &n, pds.data());
    if (!n) return false;
    vk.phys = pds[0];
    uint64_t want = 0;
    if (vr::VRSystem()) vr::VRSystem()->GetOutputDevice(&want, vr::TextureType_Vulkan, vk.inst);
    for (auto p : pds) if (want && uint64_t(p) == want) vk.phys = p;
    uint32_t qn = 0;
    vkGetPhysicalDeviceQueueFamilyProperties(vk.phys, &qn, nullptr);
    std::vector<VkQueueFamilyProperties> qf(qn);
    vkGetPhysicalDeviceQueueFamilyProperties(vk.phys, &qn, qf.data());
    for (uint32_t i = 0; i < qn; i++) if (qf[i].queueFlags & VK_QUEUE_GRAPHICS_BIT) { vk.qfam = i; break; }
    std::vector<std::string> dext = {"VK_KHR_external_memory", "VK_KHR_external_memory_fd", "VK_KHR_external_semaphore",
                                     "VK_KHR_external_semaphore_fd", "VK_KHR_dedicated_allocation",
                                     "VK_KHR_get_memory_requirements2", "VK_EXT_external_memory_dma_buf", "VK_KHR_timeline_semaphore",
                                     "VK_EXT_image_drm_format_modifier", "VK_KHR_image_format_list",
                                     "VK_KHR_bind_memory2", "VK_KHR_sampler_ycbcr_conversion",
                                     "VK_KHR_maintenance1"};
    if (vr::VRCompositor()) {
        char buf[4096] = {};
        vr::VRCompositor()->GetVulkanDeviceExtensionsRequired(vk.phys, buf, sizeof buf);
        std::printf("openvr device exts: %s\n", buf);
        for (auto &e : Split(buf)) dext.push_back(e);
    }
    // keep only supported, de-duplicated
    uint32_t en = 0;
    vkEnumerateDeviceExtensionProperties(vk.phys, nullptr, &en, nullptr);
    std::vector<VkExtensionProperties> ep(en);
    vkEnumerateDeviceExtensionProperties(vk.phys, nullptr, &en, ep.data());
    std::vector<std::string> keep;
    for (auto &e : dext) {
        bool ok = false, dup = false;
        for (auto &p : ep) if (e == p.extensionName) ok = true;
        for (auto &k : keep) if (k == e) dup = true;
        if (ok && !dup) keep.push_back(e);
    }
    std::vector<const char *> dp;
    for (auto &e : keep) dp.push_back(e.c_str());
    float prio = 1.f;
    VkDeviceQueueCreateInfo qci{VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO};
    qci.queueFamilyIndex = vk.qfam;
    qci.queueCount = 1;
    qci.pQueuePriorities = &prio;
    VkDeviceCreateInfo dci{VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO};
    dci.queueCreateInfoCount = 1;
    dci.pQueueCreateInfos = &qci;
    dci.enabledExtensionCount = uint32_t(dp.size());
    dci.ppEnabledExtensionNames = dp.data();
    if (vkCreateDevice(vk.phys, &dci, nullptr, &vk.dev) != VK_SUCCESS) { std::printf("vkCreateDevice failed\n"); return false; }
    vkGetDeviceQueue(vk.dev, vk.qfam, 0, &vk.queue);
    return true;
}

