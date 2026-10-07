// GBM + surfaceless EGL + GLES 3 context, render targets, shader programs and
// dmabuf-backed render buffers that SteamVR can import.
#pragma once
#include <EGL/egl.h>
#include <EGL/eglext.h>
#include <GLES3/gl32.h>
#include <GLES2/gl2ext.h>
#include <fcntl.h>
#include <gbm.h>
#include <unistd.h>

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <map>
#include <string>
#include <vector>

#ifndef DRM_FORMAT_MOD_LINEAR
#define DRM_FORMAT_MOD_LINEAR 0ULL
#endif
#ifndef GL_TIME_ELAPSED_EXT
#define GL_TIME_ELAPSED_EXT 0x88BF
#endif
#ifndef GL_GPU_DISJOINT_EXT
#define GL_GPU_DISJOINT_EXT 0x8FBB
#endif

struct Gfx {
    int drm = -1;
    gbm_device *gbm = nullptr;
    EGLDisplay dpy = EGL_NO_DISPLAY;
    EGLContext ctx = EGL_NO_CONTEXT;
    PFNEGLCREATEIMAGEKHRPROC createImage = nullptr;
    PFNEGLDESTROYIMAGEKHRPROC destroyImage = nullptr;
    PFNGLEGLIMAGETARGETRENDERBUFFERSTORAGEOESPROC imageToRenderbuffer = nullptr;
    // GL_EXT_disjoint_timer_query
    bool timerQuery = false;
    void(GL_APIENTRY *getQueryObjectui64v)(GLuint, GLenum, GLuint64 *) = nullptr;
    bool halfFloatTargets = false;
    std::string renderer, version;

    bool init() {
        drm = open("/dev/dri/renderD128", O_RDWR | O_CLOEXEC);
        if (drm < 0) return fail("open /dev/dri/renderD128");
        gbm = gbm_create_device(drm);
        if (!gbm) return fail("gbm_create_device");
        auto getPlatformDisplay = reinterpret_cast<PFNEGLGETPLATFORMDISPLAYEXTPROC>(eglGetProcAddress("eglGetPlatformDisplayEXT"));
        createImage = reinterpret_cast<PFNEGLCREATEIMAGEKHRPROC>(eglGetProcAddress("eglCreateImageKHR"));
        destroyImage = reinterpret_cast<PFNEGLDESTROYIMAGEKHRPROC>(eglGetProcAddress("eglDestroyImageKHR"));
        imageToRenderbuffer = reinterpret_cast<PFNGLEGLIMAGETARGETRENDERBUFFERSTORAGEOESPROC>(
            eglGetProcAddress("glEGLImageTargetRenderbufferStorageOES"));
        if (!getPlatformDisplay || !createImage || !destroyImage || !imageToRenderbuffer) return fail("EGL extensions missing");
        dpy = getPlatformDisplay(EGL_PLATFORM_GBM_KHR, gbm, nullptr);
        if (dpy == EGL_NO_DISPLAY || !eglInitialize(dpy, nullptr, nullptr)) return fail("no EGL display");
        eglBindAPI(EGL_OPENGL_ES_API);
        const EGLint versions[][2] = {{3, 2}, {3, 1}, {3, 0}};
        for (auto &v : versions) {
            const EGLint attrs[] = {EGL_CONTEXT_MAJOR_VERSION, v[0], EGL_CONTEXT_MINOR_VERSION, v[1], EGL_NONE};
            ctx = eglCreateContext(dpy, EGL_NO_CONFIG_KHR, EGL_NO_CONTEXT, attrs);
            if (ctx != EGL_NO_CONTEXT) break;
        }
        if (ctx == EGL_NO_CONTEXT || !eglMakeCurrent(dpy, EGL_NO_SURFACE, EGL_NO_SURFACE, ctx))
            return fail("no surfaceless GLES 3 context");
        renderer = reinterpret_cast<const char *>(glGetString(GL_RENDERER));
        version = reinterpret_cast<const char *>(glGetString(GL_VERSION));
        std::string ext;
        GLint n = 0;
        glGetIntegerv(GL_NUM_EXTENSIONS, &n);
        for (GLint i = 0; i < n; i++) {
            ext += reinterpret_cast<const char *>(glGetStringi(GL_EXTENSIONS, GLuint(i)));
            ext += ' ';
        }
        auto has = [&](const char *e) { return ext.find(std::string(e) + " ") != std::string::npos; };
        if (has("GL_EXT_disjoint_timer_query")) {
            getQueryObjectui64v = reinterpret_cast<void(GL_APIENTRY *)(GLuint, GLenum, GLuint64 *)>(
                eglGetProcAddress("glGetQueryObjectui64vEXT"));
            timerQuery = getQueryObjectui64v != nullptr;
        }
        halfFloatTargets = has("GL_EXT_color_buffer_half_float") || has("GL_EXT_color_buffer_float") ||
                           std::strstr(version.c_str(), "OpenGL ES 3.2") != nullptr;
        return true;
    }
    void shutdown() {
        if (dpy != EGL_NO_DISPLAY) {
            eglMakeCurrent(dpy, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
            if (ctx != EGL_NO_CONTEXT) eglDestroyContext(dpy, ctx);
            eglTerminate(dpy);
        }
        if (gbm) gbm_device_destroy(gbm);
        if (drm >= 0) close(drm);
        dpy = EGL_NO_DISPLAY;
        ctx = EGL_NO_CONTEXT;
        gbm = nullptr;
        drm = -1;
    }
    static bool fail(const char *what) {
        std::fprintf(stderr, "%s\n", what);
        return false;
    }
};

// Offscreen texture + framebuffer.
struct Target {
    GLuint tex = 0, fbo = 0;
    int w = 0, h = 0, levels = 1;
    GLenum fmt = GL_RGBA8;
    bool create(int W, int H, GLenum internalFormat, bool mips, GLenum wrapS = GL_CLAMP_TO_EDGE) {
        w = W;
        h = H;
        fmt = internalFormat;
        levels = 1;
        if (mips) {
            int m = std::max(W, H);
            while (m > 1) { m >>= 1; levels++; }
        }
        glGenTextures(1, &tex);
        glBindTexture(GL_TEXTURE_2D, tex);
        glTexStorage2D(GL_TEXTURE_2D, levels, internalFormat, W, H);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, mips ? GL_LINEAR_MIPMAP_LINEAR : GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrapS);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glGenFramebuffers(1, &fbo);
        glBindFramebuffer(GL_FRAMEBUFFER, fbo);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, tex, 0);
        bool ok = glCheckFramebufferStatus(GL_FRAMEBUFFER) == GL_FRAMEBUFFER_COMPLETE;
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        return ok;
    }
    void bind() const {
        glBindFramebuffer(GL_FRAMEBUFFER, fbo);
        glViewport(0, 0, w, h);
    }
    void mipmap() const {
        if (levels <= 1) return;
        glBindTexture(GL_TEXTURE_2D, tex);
        glGenerateMipmap(GL_TEXTURE_2D);
    }
    void destroy() {
        if (fbo) glDeleteFramebuffers(1, &fbo);
        if (tex) glDeleteTextures(1, &tex);
        fbo = tex = 0;
    }
};

struct Program {
    GLuint id = 0;
    std::map<std::string, GLint> locs;
    GLint loc(const char *n) {
        auto it = locs.find(n);
        if (it != locs.end()) return it->second;
        GLint l = glGetUniformLocation(id, n);
        locs[n] = l;
        return l;
    }
    void use() const { glUseProgram(id); }
    void set(const char *n, float v) { glUniform1f(loc(n), v); }
    void set(const char *n, int v) { glUniform1i(loc(n), v); }
    void set(const char *n, float a, float b) { glUniform2f(loc(n), a, b); }
    void set(const char *n, float a, float b, float c) { glUniform3f(loc(n), a, b, c); }
    void set(const char *n, float a, float b, float c, float d) { glUniform4f(loc(n), a, b, c, d); }
    void mat4(const char *n, const float *m) { glUniformMatrix4fv(loc(n), 1, GL_FALSE, m); }
};

inline GLuint compileShader(GLenum type, const std::string &src, const char *name) {
    GLuint s = glCreateShader(type);
    const char *p = src.c_str();
    glShaderSource(s, 1, &p, nullptr);
    glCompileShader(s);
    GLint ok = 0;
    glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        char log[4096];
        glGetShaderInfoLog(s, sizeof log, nullptr, log);
        std::fprintf(stderr, "shader %s failed:\n%s\n", name, log);
        glDeleteShader(s);
        return 0;
    }
    return s;
}

inline bool linkProgram(Program &p, const std::string &vs, const std::string &fs, const char *name) {
    GLuint v = compileShader(GL_VERTEX_SHADER, vs, name), f = compileShader(GL_FRAGMENT_SHADER, fs, name);
    if (!v || !f) return false;
    p.id = glCreateProgram();
    glAttachShader(p.id, v);
    glAttachShader(p.id, f);
    glLinkProgram(p.id);
    glDeleteShader(v);
    glDeleteShader(f);
    GLint ok = 0;
    glGetProgramiv(p.id, GL_LINK_STATUS, &ok);
    if (!ok) {
        char log[4096];
        glGetProgramInfoLog(p.id, sizeof log, nullptr, log);
        std::fprintf(stderr, "program %s link failed:\n%s\n", name, log);
        return false;
    }
    p.locs.clear();
    return true;
}

// A GBM buffer object (linear ABGR8888 = bytes R,G,B,A) rendered through an
// EGLImage-backed renderbuffer. SteamVR imports the same dmabuf.
struct DmaTarget {
    gbm_bo *bo = nullptr;
    int fd = -1;
    uint32_t stride = 0, offset = 0;
    EGLImageKHR image = EGL_NO_IMAGE_KHR;
    GLuint rb = 0, fbo = 0;
    int w = 0, h = 0;
    uint64_t vrHandle = 0;  // vr::SharedTextureHandle_t

    bool create(Gfx &g, int W, int H) {
        w = W;
        h = H;
        bo = gbm_bo_create(g.gbm, uint32_t(W), uint32_t(H), GBM_FORMAT_ABGR8888, GBM_BO_USE_LINEAR | GBM_BO_USE_RENDERING);
        if (!bo) return Gfx::fail("gbm_bo_create");
        fd = gbm_bo_get_fd(bo);
        stride = gbm_bo_get_stride(bo);
        offset = gbm_bo_get_offset(bo, 0);
        if (fd < 0) return Gfx::fail("gbm_bo_get_fd");
        const EGLint attrs[] = {EGL_WIDTH, W, EGL_HEIGHT, H, EGL_LINUX_DRM_FOURCC_EXT, EGLint(GBM_FORMAT_ABGR8888),
                                EGL_DMA_BUF_PLANE0_FD_EXT, fd, EGL_DMA_BUF_PLANE0_OFFSET_EXT, EGLint(offset),
                                EGL_DMA_BUF_PLANE0_PITCH_EXT, EGLint(stride),
                                EGL_DMA_BUF_PLANE0_MODIFIER_LO_EXT, EGLint(DRM_FORMAT_MOD_LINEAR & 0xffffffff),
                                EGL_DMA_BUF_PLANE0_MODIFIER_HI_EXT, EGLint(DRM_FORMAT_MOD_LINEAR >> 32), EGL_NONE};
        image = g.createImage(g.dpy, EGL_NO_CONTEXT, EGL_LINUX_DMA_BUF_EXT, nullptr, attrs);
        if (image == EGL_NO_IMAGE_KHR) return Gfx::fail("eglCreateImage(dmabuf)");
        glGenRenderbuffers(1, &rb);
        glBindRenderbuffer(GL_RENDERBUFFER, rb);
        g.imageToRenderbuffer(GL_RENDERBUFFER, image);
        glGenFramebuffers(1, &fbo);
        glBindFramebuffer(GL_FRAMEBUFFER, fbo);
        glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, rb);
        bool ok = glCheckFramebufferStatus(GL_FRAMEBUFFER) == GL_FRAMEBUFFER_COMPLETE;
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        if (!ok) return Gfx::fail("dmabuf framebuffer incomplete");
        return true;
    }
    void destroy(Gfx &g) {
        if (fbo) glDeleteFramebuffers(1, &fbo);
        if (rb) glDeleteRenderbuffers(1, &rb);
        if (image != EGL_NO_IMAGE_KHR) g.destroyImage(g.dpy, image);
        if (fd >= 0) close(fd);
        if (bo) gbm_bo_destroy(bo);
        *this = DmaTarget{};
    }
};

// Reads back an RGBA8 framebuffer region (rows in memory order: row 0 first).
inline std::vector<uint8_t> readPixels(GLuint fbo, int w, int h) {
    std::vector<uint8_t> px(size_t(w) * h * 4);
    glBindFramebuffer(GL_FRAMEBUFFER, fbo);
    glPixelStorei(GL_PACK_ALIGNMENT, 1);
    glReadPixels(0, 0, w, h, GL_RGBA, GL_UNSIGNED_BYTE, px.data());
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    return px;
}
