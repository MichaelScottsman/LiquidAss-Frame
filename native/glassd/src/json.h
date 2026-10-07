// Minimal JSON reader (enough for glassd.json) and string escaping for output.
#pragma once
#include <cstdio>
#include <cstdlib>
#include <map>
#include <memory>
#include <string>
#include <vector>

struct JVal {
    enum Type { Null, Bool, Num, Str, Arr, Obj } type = Null;
    bool b = false;
    double n = 0;
    std::string s;
    std::vector<JVal> a;
    std::map<std::string, JVal> o;

    const JVal *get(const std::string &k) const {
        if (type != Obj) return nullptr;
        auto it = o.find(k);
        return it == o.end() ? nullptr : &it->second;
    }
    double num(const std::string &k, double def) const {
        const JVal *v = get(k);
        return v && v->type == Num ? v->n : def;
    }
    bool boolean(const std::string &k, bool def) const {
        const JVal *v = get(k);
        return v && v->type == Bool ? v->b : def;
    }
    std::string str(const std::string &k, const std::string &def) const {
        const JVal *v = get(k);
        return v && v->type == Str ? v->s : def;
    }
    bool has(const std::string &k) const { return get(k) != nullptr; }
};

class JParser {
 public:
    explicit JParser(const std::string &t) : s(t) {}
    bool parse(JVal &out, std::string &err) {
        if (!value(out, 0)) {
            err = "JSON error at byte " + std::to_string(i);
            return false;
        }
        ws();
        if (i != s.size()) {
            err = "trailing data at byte " + std::to_string(i);
            return false;
        }
        return true;
    }

 private:
    const std::string &s;
    size_t i = 0;
    void ws() {
        while (i < s.size() && (s[i] == ' ' || s[i] == '\n' || s[i] == '\r' || s[i] == '\t')) i++;
    }
    bool lit(const char *w) {
        size_t n = std::char_traits<char>::length(w);
        if (s.compare(i, n, w) != 0) return false;
        i += n;
        return true;
    }
    static void utf8(std::string &o, unsigned cp) {
        if (cp < 0x80) o += char(cp);
        else if (cp < 0x800) { o += char(0xC0 | (cp >> 6)); o += char(0x80 | (cp & 0x3F)); }
        else if (cp < 0x10000) { o += char(0xE0 | (cp >> 12)); o += char(0x80 | ((cp >> 6) & 0x3F)); o += char(0x80 | (cp & 0x3F)); }
        else { o += char(0xF0 | (cp >> 18)); o += char(0x80 | ((cp >> 12) & 0x3F)); o += char(0x80 | ((cp >> 6) & 0x3F)); o += char(0x80 | (cp & 0x3F)); }
    }
    bool string(std::string &o) {
        if (i >= s.size() || s[i] != '"') return false;
        i++;
        while (i < s.size()) {
            char c = s[i++];
            if (c == '"') return true;
            if (c != '\\') { o += c; continue; }
            if (i >= s.size()) return false;
            char e = s[i++];
            switch (e) {
                case '"': o += '"'; break;
                case '\\': o += '\\'; break;
                case '/': o += '/'; break;
                case 'b': o += '\b'; break;
                case 'f': o += '\f'; break;
                case 'n': o += '\n'; break;
                case 'r': o += '\r'; break;
                case 't': o += '\t'; break;
                case 'u': {
                    if (i + 4 > s.size()) return false;
                    unsigned cp = unsigned(std::strtoul(s.substr(i, 4).c_str(), nullptr, 16));
                    i += 4;
                    utf8(o, cp);
                    break;
                }
                default: return false;
            }
        }
        return false;
    }
    bool value(JVal &v, int depth) {
        if (depth > 64) return false;
        ws();
        if (i >= s.size()) return false;
        char c = s[i];
        if (c == '{') {
            v.type = JVal::Obj;
            i++;
            ws();
            if (i < s.size() && s[i] == '}') { i++; return true; }
            while (true) {
                ws();
                std::string k;
                if (!string(k)) return false;
                ws();
                if (i >= s.size() || s[i] != ':') return false;
                i++;
                JVal child;
                if (!value(child, depth + 1)) return false;
                v.o[k] = std::move(child);
                ws();
                if (i < s.size() && s[i] == ',') { i++; continue; }
                if (i < s.size() && s[i] == '}') { i++; return true; }
                return false;
            }
        }
        if (c == '[') {
            v.type = JVal::Arr;
            i++;
            ws();
            if (i < s.size() && s[i] == ']') { i++; return true; }
            while (true) {
                JVal child;
                if (!value(child, depth + 1)) return false;
                v.a.push_back(std::move(child));
                ws();
                if (i < s.size() && s[i] == ',') { i++; continue; }
                if (i < s.size() && s[i] == ']') { i++; return true; }
                return false;
            }
        }
        if (c == '"') { v.type = JVal::Str; return string(v.s); }
        if (lit("true")) { v.type = JVal::Bool; v.b = true; return true; }
        if (lit("false")) { v.type = JVal::Bool; v.b = false; return true; }
        if (lit("null")) { v.type = JVal::Null; return true; }
        const char *start = s.c_str() + i;
        char *end = nullptr;
        double d = std::strtod(start, &end);
        if (end == start) return false;
        i += size_t(end - start);
        v.type = JVal::Num;
        v.n = d;
        return true;
    }
};

inline std::string jsonEscape(const std::string &in) {
    std::string o = "\"";
    for (unsigned char c : in) {
        if (c == '"') o += "\\\"";
        else if (c == '\\') o += "\\\\";
        else if (c == '\n') o += "\\n";
        else if (c < 0x20) { char b[8]; std::snprintf(b, sizeof b, "\\u%04x", c); o += b; }
        else o += char(c);
    }
    return o + "\"";
}
