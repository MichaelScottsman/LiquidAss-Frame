// Small vector / rigid-transform helpers for glassd (standing space: metres,
// x right, y up, -z forward). Matrices handed to GL are column-major.
#pragma once
#include <openvr.h>

#include <algorithm>
#include <cmath>
#include <cstdint>

struct v3 {
    float x = 0, y = 0, z = 0;
};
inline v3 operator+(v3 a, v3 b) { return {a.x + b.x, a.y + b.y, a.z + b.z}; }
inline v3 operator-(v3 a, v3 b) { return {a.x - b.x, a.y - b.y, a.z - b.z}; }
inline v3 operator*(v3 a, float s) { return {a.x * s, a.y * s, a.z * s}; }
inline v3 operator-(v3 a) { return {-a.x, -a.y, -a.z}; }
inline float dot(v3 a, v3 b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
inline v3 cross(v3 a, v3 b) { return {a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x}; }
inline float length(v3 a) { return std::sqrt(dot(a, a)); }
inline v3 normalize(v3 a) {
    float l = length(a);
    return l > 1e-12f ? a * (1.f / l) : v3{0, 0, 0};
}
inline v3 lerp(v3 a, v3 b, float t) { return a + (b - a) * t; }

struct quat {
    float w = 1, x = 0, y = 0, z = 0;
};
inline quat qnorm(quat q) {
    float l = std::sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
    if (l < 1e-12f) return {};
    return {q.w / l, q.x / l, q.y / l, q.z / l};
}
inline quat qnlerp(quat a, quat b, float t) {
    float d = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
    if (d < 0) b = {-b.w, -b.x, -b.y, -b.z};
    return qnorm({a.w + (b.w - a.w) * t, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t});
}

// Rigid pose: rotation as a row-major 3x3 plus translation (like HmdMatrix34_t).
struct Pose {
    float r[3][3] = {{1, 0, 0}, {0, 1, 0}, {0, 0, 1}};
    v3 t;
    v3 apply(v3 p) const {
        return {r[0][0] * p.x + r[0][1] * p.y + r[0][2] * p.z + t.x, r[1][0] * p.x + r[1][1] * p.y + r[1][2] * p.z + t.y,
                r[2][0] * p.x + r[2][1] * p.y + r[2][2] * p.z + t.z};
    }
    v3 rotate(v3 p) const {
        return {r[0][0] * p.x + r[0][1] * p.y + r[0][2] * p.z, r[1][0] * p.x + r[1][1] * p.y + r[1][2] * p.z,
                r[2][0] * p.x + r[2][1] * p.y + r[2][2] * p.z};
    }
    Pose operator*(const Pose &b) const {
        Pose o;
        for (int i = 0; i < 3; i++)
            for (int j = 0; j < 3; j++) o.r[i][j] = r[i][0] * b.r[0][j] + r[i][1] * b.r[1][j] + r[i][2] * b.r[2][j];
        o.t = apply(b.t);
        return o;
    }
    Pose inverse() const {
        Pose o;
        for (int i = 0; i < 3; i++)
            for (int j = 0; j < 3; j++) o.r[i][j] = r[j][i];
        v3 nt = o.rotate(t);
        o.t = -nt;
        return o;
    }
    // column-major 4x4 for glUniformMatrix4fv(..., GL_FALSE, ...)
    void toGL(float m[16]) const {
        m[0] = r[0][0]; m[1] = r[1][0]; m[2] = r[2][0]; m[3] = 0;
        m[4] = r[0][1]; m[5] = r[1][1]; m[6] = r[2][1]; m[7] = 0;
        m[8] = r[0][2]; m[9] = r[1][2]; m[10] = r[2][2]; m[11] = 0;
        m[12] = t.x; m[13] = t.y; m[14] = t.z; m[15] = 1;
    }
};

inline Pose fromVR(const vr::HmdMatrix34_t &m) {
    Pose p;
    for (int i = 0; i < 3; i++)
        for (int j = 0; j < 3; j++) p.r[i][j] = m.m[i][j];
    p.t = {m.m[0][3], m.m[1][3], m.m[2][3]};
    return p;
}

inline quat quatFrom(const Pose &p) {
    const auto &m = p.r;
    float tr = m[0][0] + m[1][1] + m[2][2];
    quat q;
    if (tr > 0) {
        float s = std::sqrt(tr + 1.f) * 2;
        q = {0.25f * s, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s};
    } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
        float s = std::sqrt(1.f + m[0][0] - m[1][1] - m[2][2]) * 2;
        q = {(m[2][1] - m[1][2]) / s, 0.25f * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s};
    } else if (m[1][1] > m[2][2]) {
        float s = std::sqrt(1.f + m[1][1] - m[0][0] - m[2][2]) * 2;
        q = {(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, 0.25f * s, (m[1][2] + m[2][1]) / s};
    } else {
        float s = std::sqrt(1.f + m[2][2] - m[0][0] - m[1][1]) * 2;
        q = {(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25f * s};
    }
    return qnorm(q);
}

inline Pose poseFrom(quat q, v3 t) {
    Pose p;
    float w = q.w, x = q.x, y = q.y, z = q.z;
    p.r[0][0] = 1 - 2 * (y * y + z * z); p.r[0][1] = 2 * (x * y - w * z);     p.r[0][2] = 2 * (x * z + w * y);
    p.r[1][0] = 2 * (x * y + w * z);     p.r[1][1] = 1 - 2 * (x * x + z * z); p.r[1][2] = 2 * (y * z - w * x);
    p.r[2][0] = 2 * (x * z - w * y);     p.r[2][1] = 2 * (y * z + w * x);     p.r[2][2] = 1 - 2 * (x * x + y * y);
    p.t = t;
    return p;
}

inline Pose poseLerp(const Pose &a, const Pose &b, float t) {
    return poseFrom(qnlerp(quatFrom(a), quatFrom(b), t), lerp(a.t, b.t, t));
}

// Angle (radians) between the forward axes of two poses.
inline float poseAngle(const Pose &a, const Pose &b) {
    v3 fa = a.rotate({0, 0, -1}), fb = b.rotate({0, 0, -1});
    return std::acos(std::clamp(dot(fa, fb), -1.f, 1.f));
}
