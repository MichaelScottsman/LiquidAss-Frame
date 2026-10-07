// Slab atlas: rows of the glassd texture under the backdrop region, shelf
// packed with stable placement. A cell, once placed, never moves: new cells go
// into free space, freed cells merge back into it, and only the caller decides
// to re-pack (when nothing fits any more). Cells are separated by kGutter px.
//
// The atlas covers rows [y0, height). It is a vertical list of shelves that
// tile that range: shelf i spans rows [y, y + h) plus a gutter, and the next
// shelf starts at y + h + kGutter (the last one ends at `height`). A shelf
// holding cells keeps its height; empty shelves merge into one free band.
// A new shelf for a tall cell (a quarter of the atlas or more) reserves the
// tallest height requested so far (tallHint), so that a card and a sheet that
// come and go can later share it side by side instead of forcing a re-pack.
#pragma once
#include <algorithm>
#include <vector>

class Atlas {
 public:
    static constexpr int kGutter = 2;
    int width = 0, y0 = 0, height = 0;
    int tallHint = 0;  // tallest cell requested so far (kept across re-packs by the caller)

    void reset(int w, int top, int h) {
        width = w;
        y0 = top;
        height = h;
        shelves.clear();
        if (height > y0) shelves.push_back({y0, height - y0, {}});
    }

    // Places a w x h cell; false when it does not fit.
    bool alloc(int w, int h, int &ox, int &oy) {
        if (w <= 0 || h <= 0 || w > width) return false;
        if (h <= height - y0) tallHint = std::max(tallHint, h);
        const bool tall = 4 * h >= height - y0;
        // 1. a shelf in use, of similar height, with a gap (first pass: no
        //    shelf more than twice as tall as the cell)
        for (int pass = 0; pass < 2; pass++) {
            int best = -1, bestX = 0, bestWaste = 1 << 30;
            for (size_t i = 0; i < shelves.size(); i++) {
                const Shelf &s = shelves[i];
                if (s.cells.empty() || s.h < h) continue;
                if (pass == 0 && s.h > 2 * h) continue;
                int x;
                if (!gap(s, w, x)) continue;
                if (s.h - h < bestWaste) {
                    best = int(i);
                    bestX = x;
                    bestWaste = s.h - h;
                }
            }
            if (best >= 0) {
                Shelf &s = shelves[size_t(best)];
                s.cells.push_back({bestX, w});
                std::sort(s.cells.begin(), s.cells.end(), [](const Cell &a, const Cell &b) { return a.x < b.x; });
                ox = bestX;
                oy = s.y;
                return true;
            }
            // 2. (between the passes) the first free band that is tall enough
            if (pass == 0) {
                for (size_t i = 0; i < shelves.size(); i++) {
                    if (!shelves[i].cells.empty() || shelves[i].h < h) continue;
                    split(i, tall ? std::min(shelves[i].h, std::max(h, tallHint)) : h);
                    shelves[i].cells.push_back({0, w});
                    ox = 0;
                    oy = shelves[i].y;
                    return true;
                }
            }
        }
        return false;
    }

    void release(int x, int y) {
        for (size_t i = 0; i < shelves.size(); i++) {
            Shelf &s = shelves[i];
            if (s.y != y) continue;
            for (size_t k = 0; k < s.cells.size(); k++) {
                if (s.cells[k].x != x) continue;
                s.cells.erase(s.cells.begin() + long(k));
                if (s.cells.empty()) mergeAround(i);
                return;
            }
            return;
        }
    }

 private:
    struct Cell {
        int x, w;
    };
    struct Shelf {
        int y, h;
        std::vector<Cell> cells;  // sorted by x
    };
    std::vector<Shelf> shelves;

    bool gap(const Shelf &s, int w, int &x) const {
        int cur = 0;
        for (const Cell &c : s.cells) {
            if (c.x - cur >= w + kGutter) {
                x = cur;
                return true;
            }
            cur = c.x + c.w + kGutter;
        }
        if (width - cur >= w) {
            x = cur;
            return true;
        }
        return false;
    }
    // Shrinks free band i to h rows; the rest (after a gutter) stays free.
    void split(size_t i, int h) {
        Shelf &s = shelves[i];
        const int rest = s.h - h - kGutter;
        if (rest < 4) return;  // too thin to be useful: leave it inside this shelf
        const int y = s.y + h + kGutter;
        s.h = h;
        shelves.insert(shelves.begin() + long(i) + 1, Shelf{y, rest, {}});
    }
    void mergeAround(size_t i) {
        if (i + 1 < shelves.size() && shelves[i + 1].cells.empty()) {
            shelves[i].h += kGutter + shelves[i + 1].h;
            shelves.erase(shelves.begin() + long(i) + 1);
        }
        if (i > 0 && shelves[i - 1].cells.empty()) {
            shelves[i - 1].h += kGutter + shelves[i].h;
            shelves.erase(shelves.begin() + long(i));
        }
    }
};
