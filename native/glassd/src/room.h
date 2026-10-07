// Room model: an equirectangular map of the room in standing space, built from
// passthrough feed frames with the UI masked out, plus a push-pull filled and
// mipmapped copy that the glass shader samples.
#pragma once
#include <cmath>
#include <cstdio>
#include <vector>

#include "feed.h"
#include "gfx.h"
#include "vmath.h"

// A Steam surface as seen by the feed: origin = top-left corner, unit axes
// right (U) and down (V), extents in metres along them (margins included).
struct MaskQuad {
    v3 O, U, V;
    float u0 = 0, u1 = 0, v0 = 0, v1 = 0;
};

class Room {
 public:
    int W = 1024, H = 512;
    Target map[2];
    int cur = 0;
    std::vector<Target> push, pull;
    Target filled;
    Target sectors, rowFill;  // 32 x H/2: known room per row and azimuth sector, and the row fill (row.frag, hfill.frag)
    GLuint feedTex = 0;
    int feedW = 0, feedH = 0, feedLevels = 1;
    Program *upd = nullptr, *pushP = nullptr, *pullP = nullptr, *rowP = nullptr, *hfillP = nullptr;
    GLuint vao = 0;
    v3 center;
    bool centerSet = false;
    float radius = 2.2f;
    float ema = 0.22f;
    uint64_t updates = 0;
    float emptyFill = 0.06f;  // linear grey shown before anything is known

    bool init(Gfx &g, Program &update, Program &pushProg, Program &pullProg, Program &rowProg, Program &hfillProg,
              GLuint vertexArray) {
        upd = &update;
        rowP = &rowProg;
        hfillP = &hfillProg;
        pushP = &pushProg;
        pullP = &pullProg;
        vao = vertexArray;
        for (auto &m : map) {
            if (!m.create(W, H, GL_SRGB8_ALPHA8, false, GL_REPEAT)) return Gfx::fail("room map target");
            m.bind();
            glClearColor(0, 0, 0, 0);
            glClear(GL_COLOR_BUFFER_BIT);
        }
        if (!(g.halfFloatTargets && buildPyramid(GL_RGBA16F)) && !buildPyramid(GL_RGBA8)) return Gfx::fail("room pyramid target");
        if (!filled.create(W, H, GL_SRGB8_ALPHA8, true, GL_REPEAT)) return Gfx::fail("room filled target");
        if (!sectors.create(32, H / 2, push[0].fmt, false) || !rowFill.create(32, H / 2, push[0].fmt, false, GL_REPEAT))
            return Gfx::fail("room row fill targets");
        fill();
        return true;
    }

    bool buildPyramid(GLenum fmt) {
        for (auto &t : push) t.destroy();
        for (auto &t : pull) t.destroy();
        push.clear();
        pull.clear();
        int w = W / 2, h = H / 2;
        while (true) {
            Target a, b;
            bool ok = a.create(w, h, fmt, false);
            ok = b.create(w, h, fmt, false, GL_REPEAT) && ok;
            push.push_back(a);
            pull.push_back(b);
            if (!ok) return false;
            if (w == 1 && h == 1) break;
            w = std::max(1, w / 2);
            h = std::max(1, h / 2);
        }
        return true;
    }

    // Slowly follows the head so the sphere stays centred on the user.
    void follow(v3 head, float dt) {
        if (!centerSet) {
            center = head;
            centerSet = true;
            return;
        }
        center = lerp(center, head, std::min(1.f, dt / 10.f));
    }

    void uploadFeed(const FeedFrame &f) {
        if (!feedTex || feedW != f.w || feedH != f.h) {
            if (feedTex) glDeleteTextures(1, &feedTex);
            feedW = f.w;
            feedH = f.h;
            feedLevels = 1;
            for (int m = std::max(f.w, f.h); m > 1; m >>= 1) feedLevels++;
            glGenTextures(1, &feedTex);
            glBindTexture(GL_TEXTURE_2D, feedTex);
            glTexStorage2D(GL_TEXTURE_2D, feedLevels, GL_SRGB8_ALPHA8, f.w, f.h);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        }
        glBindTexture(GL_TEXTURE_2D, feedTex);
        glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, f.w, f.h, GL_RGBA, GL_UNSIGNED_BYTE, f.rgba.data());
        glGenerateMipmap(GL_TEXTURE_2D);
    }

    static constexpr int kMaxQuads = 24;  // uQO[] etc. in room_update.frag and testroom.frag
    static void setMasks(Program &p, const std::vector<MaskQuad> &masks) {
        const int n = int(std::min<size_t>(masks.size(), kMaxQuads));
        std::vector<float> qo(3 * kMaxQuads), qu(3 * kMaxQuads), qv(3 * kMaxQuads), qe(4 * kMaxQuads);
        for (int i = 0; i < n; i++) {
            const MaskQuad &m = masks[size_t(i)];
            qo[i * 3] = m.O.x; qo[i * 3 + 1] = m.O.y; qo[i * 3 + 2] = m.O.z;
            qu[i * 3] = m.U.x; qu[i * 3 + 1] = m.U.y; qu[i * 3 + 2] = m.U.z;
            qv[i * 3] = m.V.x; qv[i * 3 + 1] = m.V.y; qv[i * 3 + 2] = m.V.z;
            qe[i * 4] = m.u0; qe[i * 4 + 1] = m.u1; qe[i * 4 + 2] = m.v0; qe[i * 4 + 3] = m.v1;
        }
        glUniform1i(p.loc("uNQ"), n);
        if (n) {
            glUniform3fv(p.loc("uQO"), n, qo.data());
            glUniform3fv(p.loc("uQU"), n, qu.data());
            glUniform3fv(p.loc("uQV"), n, qv.data());
            glUniform4fv(p.loc("uQE"), n, qe.data());
        }
    }

    // --test-backdrop: the procedural room replaces every feed frame (once).
    // With hole, texels behind the given quads stay unknown.
    void generate(Program &p, int pattern, bool hole, const std::vector<MaskQuad> &quads) {
        glDisable(GL_BLEND);
        glBindVertexArray(vao);
        Target &dst = map[1 - cur];
        dst.bind();
        p.use();
        p.set("uPattern", pattern);
        p.set("uHole", hole ? 1 : 0);
        p.set("uCenter", center.x, center.y, center.z);
        setMasks(p, quads);
        glDrawArrays(GL_TRIANGLES, 0, 3);
        cur = 1 - cur;
        updates++;
        fill();
    }

    // Blends the uploaded feed frame into the map. feedEye: feed eye pose
    // (eye -> standing) at the frame's display time.
    void integrate(const Pose &feedEye, const FeedCalib &cal, const std::vector<MaskQuad> &masks) {
        if (!feedTex || !centerSet) return;
        glDisable(GL_BLEND);
        glBindVertexArray(vao);
        Target &dst = map[1 - cur];
        dst.bind();
        Program &p = *upd;
        p.use();
        float view[16];
        feedEye.inverse().toGL(view);
        p.mat4("uFeedView", view);
        p.set("uAffine", cal.a, cal.b, cal.c, cal.d);
        p.set("uFeedPos", feedEye.t.x, feedEye.t.y, feedEye.t.z);
        p.set("uCenter", center.x, center.y, center.z);
        p.set("uRadius", radius);
        p.set("uEma", ema);
        // Map texel angle vs feed texel angle (the feed spans 1/a in tangent).
        const float mapTexel = 2.f * 3.14159265f / float(W);
        const float feedTexel = 2.f * std::atan(0.5f / std::fabs(cal.a)) / float(std::max(1, feedW));
        p.set("uFeedLod", std::max(0.f, std::log2(mapTexel / std::max(feedTexel, 1e-6f))));
        setMasks(p, masks);
        p.set("uPrev", 0);
        p.set("uFeed", 1);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, map[cur].tex);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, feedTex);
        glDrawArrays(GL_TRIANGLES, 0, 3);
        glActiveTexture(GL_TEXTURE0);
        cur = 1 - cur;
        updates++;
    }

    // Push-pull fill of unknown texels, then mipmaps for frost.
    void fill() {
        glDisable(GL_BLEND);
        glBindVertexArray(vao);
        glActiveTexture(GL_TEXTURE0);
        Program &ps = *pushP;
        ps.use();
        ps.set("uSrc", 0);
        for (size_t i = 0; i < push.size(); i++) {
            push[i].bind();
            ps.set("uFromMap", i == 0 ? 1 : 0);
            glBindTexture(GL_TEXTURE_2D, i == 0 ? map[cur].tex : push[i - 1].tex);
            glDrawArrays(GL_TRIANGLES, 0, 3);
        }
        // the row fill for the level-0 pull: known room per row and sector,
        // then each row continued from its nearest known sectors
        Program &rp = *rowP;
        rp.use();
        rp.set("uSrc", 0);
        sectors.bind();
        glBindTexture(GL_TEXTURE_2D, push[0].tex);
        glDrawArrays(GL_TRIANGLES, 0, 3);
        Program &hp = *hfillP;
        hp.use();
        hp.set("uSrc", 0);
        rowFill.bind();
        glBindTexture(GL_TEXTURE_2D, sectors.tex);
        glDrawArrays(GL_TRIANGLES, 0, 3);
        Program &pl = *pullP;
        pl.use();
        pl.set("uRow", 2);
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, rowFill.tex);
        glActiveTexture(GL_TEXTURE0);
        pl.set("uFine", 0);
        pl.set("uCoarse", 1);
        pl.set("uEmpty", emptyFill, emptyFill, emptyFill * 1.08f);
        const size_t n = pull.size();
        pull[n - 1].bind();
        pl.set("uLast", 1);
        pl.set("uFineIsMap", 0);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, push[n - 1].tex);
        glDrawArrays(GL_TRIANGLES, 0, 3);
        pl.set("uLast", 0);
        for (int i = int(n) - 2; i >= -1; i--) {
            Target &dst = i >= 0 ? pull[size_t(i)] : filled;
            if (i < 0) {
                glBindFramebuffer(GL_FRAMEBUFFER, filled.fbo);
                glViewport(0, 0, W, H);
            } else {
                dst.bind();
            }
            pl.set("uFineIsMap", i < 0 ? 1 : 0);
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, i < 0 ? map[cur].tex : push[size_t(i)].tex);
            glActiveTexture(GL_TEXTURE1);
            glBindTexture(GL_TEXTURE_2D, pull[size_t(i + 1)].tex);
            glDrawArrays(GL_TRIANGLES, 0, 3);
        }
        glActiveTexture(GL_TEXTURE0);
        filled.mipmap();
    }

    // Mean known fraction and mean room luma (perceptual), from the 1x1 level.
    // Synchronous readback: call rarely (status lines).
    void stats(float &known, float &lum) {
        known = 0;
        lum = 0;
        const Target &t = push.back();
        glBindFramebuffer(GL_FRAMEBUFFER, t.fbo);
        float v[4] = {0, 0, 0, 0};
        if (t.fmt == GL_RGBA16F) {
            while (glGetError() != GL_NO_ERROR) {}
            glReadPixels(0, 0, 1, 1, GL_RGBA, GL_FLOAT, v);
            if (glGetError() != GL_NO_ERROR) v[3] = -1;
        } else {
            uint8_t b[4] = {0, 0, 0, 0};
            glReadPixels(0, 0, 1, 1, GL_RGBA, GL_UNSIGNED_BYTE, b);
            for (int i = 0; i < 4; i++) v[i] = b[i] / 255.f;
        }
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        known = v[3];
        if (v[3] > 1e-4f) {
            float l = (0.2126f * v[0] + 0.7152f * v[1] + 0.0722f * v[2]) / v[3];
            lum = std::pow(std::max(l, 0.f), 1.f / 2.2f);
        }
    }
};
