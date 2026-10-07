# Contract: CSS foundation (P4): tokens, font, material, states

Owner: **P4**. Files: `theme/00-tokens.nowrap.css`, `theme/01-font.nowrap.css` (generated), `theme/03-material.css`, `theme/04-states.css`, `theme/vr/00-vr-tokens.css`, `theme/fonts/**`, `device/lgs_lens.js`; mockup kit `docs/phase2/mockups/kit.css`, `kit.js`, `_example.html`. Sources: PLAN §1.3, §1.4, §1.6, §1.18, §2.3 P4; D2 §4–§10, §13, §16; CTL §4; WN §8.2, §8.4; GM §1.7; VP P-01 to P-17, P-38 to P-45.

**Status:** see "Status" in `docs/phase2/wp/P4.md`. Every name in this file is stable from M1. Values may be tuned (the focus add between .28 and .32 after G-FOCUS); names never change. A change of meaning gets a new name.

**Ground rules for consumers**

- Use tokens, never literals, for colour, fill, radius, size, shadow and material values. If a value you need is missing, file `- [ ] REQ <you>->P4: token for …` in your evidence log; do not define a shared-looking `--lgs-*` token in your own file (prefix area-private tokens with your area, e.g. `--lgs-c2a-…`).
- Motion tokens (`--lgs-ease-*`, `--lgs-d-*`) and every `lgs-*` keyframe except the two Phase 1 ones are **P5's** (`theme/02-motion.nowrap.css`, `contracts/motion.md`). P4 files use them with fallbacks, e.g. `var(--lgs-d-hover-in, 294ms)`.
- Bundle order: `00-tokens` → `01-font` → `02-motion` → `03-material` → `04-states` → `05-native` → area files `10-…` and up. Area files come later, so at equal specificity an area rule beats the foundation.

---

## 1. Tokens (`theme/00-tokens.nowrap.css`)

All tokens are declared on `html.lgs-on` (every Steam window and every SteamVR page; SteamVR pages also get `theme/vr/00-vr-tokens.css`). Sizes are **main-window CSS px**; on other surfaces multiply by that surface's `m` (§1.2).

### 1.1 Type

| Token | Value | Use |
|---|---|---|
| `--lgs-font` | `"LGS Inter", "Motiva Sans", Arial, sans-serif` | Every text run. Vietnamese (`:lang(vi)`) falls back to Steam's stack |
| `--lgs-text-1` / `-2` / `-3` / `-4` | white .96 / .70 / .50 / .32 | Primary, secondary, tertiary, quaternary (disabled glyphs) |
| `--lgs-text-disabled` | = `--lgs-text-4` | |
| `--lgs-text-on-selected` | `#0d0e12` | Label on a white (.94) fill |
| `--lgs-text-on-selected-2` | `rgb(13 14 18 / .60)` | Secondary label on white |
| `--lgs-text-on-tint` | `#fff` | Label on a tinted capsule |
| `--lgs-text-danger` | `rgb(255 130 125)` | Destructive row label at rest (≥ 22 px Semibold only, CTL R7) |
| `--lgs-text-room-shadow` | `0 1px 3px rgb(0 0 0 / .55), 0 0 12px rgb(0 0 0 / .35)` | Text directly on the room (Home labels, P-41) |
| `--lgs-type-xl1` … `--lgs-type-caption` | `font` shorthands, e.g. `--lgs-type-body: 500 24px/1.30 var(--lgs-font)` | `font: var(--lgs-type-body)`; the twelve D2 §5.3 styles: `xl1 xl2 large title1 title2 title3 headline body callout subhead footnote caption` |
| `--lgs-track-xl` / `-large` / `-title` / `-headline` / `-footnote` / `-caption` | −.02em / −.015em / −.01em / −.005em / .005em / .01em | `letter-spacing` paired with the type style (0 for callout and subhead). Only negative or ≤ .01em: no tracked chrome (P-84) |
| `--lgs-fs-*` | 64 52 46 38 30 28 24 24 22 20 18 18 px, same suffixes | Bare sizes when the weight comes from elsewhere |

### 1.2 Sizes and surfaces (PLAN §1.3)

| Token | px | Token | px |
|---|---|---|---|
| `--lgs-hit` | 80 | `--lgs-row` (free-standing) | 72 |
| `--lgs-btn` (icon circle, text capsule) | 60 | `--lgs-row-platter` (contiguous in a platter) | 80 |
| `--lgs-btn-lg` (primary) | 70 | `--lgs-row-gap` | 8 |
| `--lgs-btn-xl` (hero) | 86 | `--lgs-row-inset` (hover pill inset) | 6 |
| `--lgs-btn-sm` | 44 | `--lgs-sep-inset` (row separator inset) | 26 |
| `--lgs-btn-mini` | 38 | `--lgs-field` (search / text field) | 64 |
| `--lgs-btn-pad` (capsule side padding) | 24 | `--lgs-seg` (segmented track) | 64 |
| `--lgs-play-w` × `--lgs-play-h` | 280 × 80 | `--lgs-seg-item` (segment) / `--lgs-seg-min-w` | 56 / 140 |
| `--lgs-symbol` (in a 60 circle) | 26 | `--lgs-switch-w` × `--lgs-switch-h` | 66 × 40 |
| `--lgs-symbol-row` | 24 | `--lgs-check` (check circle) | 40 |
| `--lgs-target-gap` (clear gap between 60 px targets) | 24 | `--lgs-slider` (track and knob) | 64 |
| `--lgs-inset` | 24 | `--lgs-ornament` (bottom capsule) | 84 |
| `--lgs-inset-text` | 40 | `--lgs-ornament-overlap` | 28 |
| `--lgs-gap` | 24 | `--lgs-ornament-y` (top of the capsule) | 628 |
| `--lgs-header` (toolbar row, CQ1) | 108 | `--lgs-ornament-max-w` | 960 |
| `--lgs-glass-h` (`window` mode) | 656 | `--lgs-glass-h-full` (`window-full`) | 720 |
| `--lgs-search-w` / `--lgs-search-w-nested` | 520 / 640 | `--lgs-more` (More circle) / its hit | 60 / 80 |
| `--lgs-glyph` (controller glyph badge) | 30 | `--lgs-home-disc` / pitch x / pitch y | 120 / 224 / 188 |
| `--lgs-menu-row` / `--lgs-menu-row-gap` | 72 / 6 | `--lgs-menu-row-compact` / `--lgs-menu-pitch-compact` | 60 / 64 |
| `--lgs-menu-min-w` / `--lgs-menu-max-w` | 320 / 592 | `--lgs-menu-header` | 40 |
| `--lgs-alert-w` | 640 | `--lgs-sheet-max-w` | 960 |
| `--lgs-tooltip-h` | 48 | `--lgs-toast-w` × `--lgs-toast-h` | 320 × 76 |
| `--lgs-badge-h` | 28 | `--lgs-page-dot` / pitch | 12 / 24 |

Surface multipliers (D2 §2.5, constants): `--lgs-m-popup` .90, `--lgs-m-bar` .83, `--lgs-m-kb` .74, `--lgs-m-vr-frame` 1.33, `--lgs-m-vr-page` 1.44, `--lgs-m-vr-bind` 1.87. Write `calc(var(--lgs-btn) * var(--lgs-m-bar))`.

### 1.3 Radii (concentric)

`--lgs-r-window` 54 · `--lgs-r-sheet` 44 · `--lgs-r-tile` 44 (Control Center tiles, alerts) · `--lgs-r-menu` 32 · `--lgs-r-platter` 30 · `--lgs-r-toast` 30 · `--lgs-r-row` 24 · `--lgs-r-card` 20 · `--lgs-r-small` 14 · `--lgs-r-capsule` 999px.

### 1.4 Colour (whole fills only)

`--lgs-blue` rgb(0 145 255) · `--lgs-green` rgb(48 209 88) · `--lgs-red` rgb(255 66 69) · `--lgs-orange` rgb(255 146 48) · `--lgs-yellow` rgb(255 214 0) · `--lgs-purple` rgb(219 52 242) · `--lgs-teal` rgb(0 210 224) · `--lgs-indigo` rgb(109 124 255) · `--lgs-gray` rgb(142 142 147).
Tints: `--lgs-tint-play` green .88 · `--lgs-tint-primary` blue .86 · `--lgs-tint-danger` red .84 · `--lgs-toggle-on` = green · `--lgs-check-on` = blue.

### 1.5 Fills on glass (D2 §6.5, PLAN §1.4)

| Token | Value | Use |
|---|---|---|
| `--lgs-fill-thin` | white .10 | Raised control at rest (the flat part) |
| `--lgs-raised-bg` | top sheen `linear-gradient(180deg, white .06, transparent 60%)` over white .10 | **Rest, raised** (buttons, capsules, circles). A `background` value |
| `--lgs-raised-shadow` | `inset 0 1.5px 1.5px -1px white .22, 0 1px 2px black .10` | Rest, raised (the lit top lip). A `box-shadow` value |
| `--lgs-fill-regular` | black .14 | Recessed platter, sidebar |
| `--lgs-fill-thick` | black .30 | **Rest, recessed** (fields, tracks, segmented track) |
| `--lgs-recessed-shadow` | `inset 0 2px 5px black .30` | Rest, recessed |
| `--lgs-well-shadow` | `inset 0 2px 5px black .26` | Phase 1 name, same role as `--lgs-recessed-shadow` (no ring any more) |
| `--lgs-fill-nav` | white .18 | **Navigation selected** pill |
| `--lgs-selected-fill` | white .94 | **Selected / on / open-menu source**, with `--lgs-text-on-selected` |
| `--lgs-scrim` | black .35 | Alerts and sheets (Steam's `.ModalOverlayBackground`), PLAN §1.8 |
| `--lgs-field-focus` | `0 0 0 3px white .55, 0 0 16px white .22` | The only ring in the system: focused text and search fields (P-17) |
| `--lgs-separator` | white .08 | Row separator, 2 px tall, inset `--lgs-sep-inset`, hidden next to a lit row |

### 1.6 States (PLAN §1.4; consumed through §3)

| Token | Value | Meaning |
|---|---|---|
| `--lgs-hover-add` | .08 | Laser hover: uniform white added |
| `--lgs-hover-spot` | .12 | Laser hover: light spot peak at the pointer |
| `--lgs-focus-add` | **.28** | Gamepad focus: uniform white added. **The tuned value** (range .28–.32, set once from G-FOCUS, recorded in `wp/P4.md`) |
| `--lgs-focus-spot` | .16 | Gamepad focus: spot in the upper third |
| `--lgs-focus-arc` | .55 | Gamepad focus: the control's specular arc (inset top highlight alpha); the edge rim ×1.5 |
| `--lgs-focus-first` | .60 | Fraction of the focus look on the first frame (P5's `lgs-focus-in` starts at this) |
| `--lgs-within-add` | .06 | A multi-control row that contains the focus (`.gpfocuswithin`) warms by this |
| `--lgs-press-add` / `--lgs-press-spot` | .06 / .22 | Press glow: uniform and spreading spot |
| `--lgs-press-grow` / `--lgs-press-max` | 6 / 1.06 | Glass controls swell `min(var(--lgs-press-max), 1 + var(--lgs-press-grow) / maxSide)`; 0 / 1 under Reduce Motion |
| `--lgs-white-glow` | `0 0 18px 2px white .30` | Focus on a white or coloured fill: blurred outer glow, not a ring (P-16) |
| `--lgs-dis-content` | .40 | Disabled: content opacity (apply to label/glyph colour, never `opacity` on the whole control) |
| `--lgs-dis-focus-add` | .10 | Disabled + focus: fill; arc at 60 %, no spot |
| `--lgs-card-lift` / `--lgs-disc-lift` | 1.05 / 1.10 | Content card / Home disc scale on lift; 1 under Reduce Motion |
| `--lgs-nav-weight` | 600 | Navigation-selected label weight (Semibold) |
| `--lgs-sel-arc` | `inset 0 1.5px 1.5px -1px white .45` | Specular top arc on the navigation-selected pill |

### 1.7 Edges, shadows, materials (D2 §6, WN §8.2, §8.4, PLAN §1.6)

| Token | Value |
|---|---|
| `--lgs-light` | `340deg`: the one key light, 20° left of vertical (conic `from`) |
| `--lgs-rim-window` / `-panel` / `-liquid` / `-thick` / `-clear` / `-control` | .78 / .90 / 1.10 / .85 / 1.20 / 1.00 (E3 strength) |
| `--lgs-rim-w-window` / `--lgs-rim-w` | 2px / 1.5px (ring width of the E3 arc) |
| `--lgs-darkedge-window` / `-panel` / `-liquid` / `-thick` / `-clear` | E4 + E5 inset `box-shadow` lists (16/.20, 10/.16, 6/.12, 12/.20, 5/.10) |
| `--lgs-shadow-10mm` / `-15mm` / `-25mm` / `-30mm` | Depth shadows (y .4 px/mm, blur 1.2 px/mm): `0 4px 12px` .30, `0 6px 18px` .30, `0 10px 30px` .28, `0 12px 36px` .32 |
| `--lgs-shadow-contact` | `0 6px 18px black .35` (Home discs, lifted content) |
| `--lgs-mat-window-bg` | Smoky tint `rgb(20 22 30 / (.60 + dial × .24))` with the top sheen (white .08 → 0 over 30 %) |
| `--lgs-mat-panel-bg` | `rgb(28 30 40 / (.67 + dial × .22))` (= .78 at the default dial) with a top sheen |
| `--lgs-mat-liquid-bg`, `--lgs-mat-liquid-blur` | `linear-gradient(white .12 → .03)` over `rgb(80 80 86 / .12)`; `blur(12px) saturate(1.7)`. In-page only (over Steam content) |
| `--lgs-mat-liquid-room-bg` | Liquid over the room (no backdrop to frost): tint .70 + sheen |
| `--lgs-mat-thick-bg`, `--lgs-mat-thick-blur` | Sheen over `rgb(36 37 42 / (.30 + dial × .20))`; `blur(30px) saturate(1.5)` |
| `--lgs-mat-clear-bg`, `--lgs-mat-clear-blur` | white .05; `blur(3px) saturate(1.3)`. Only over media, always on `--lgs-media-dim` |
| `--lgs-media-dim` | black .35 (the dimming layer under clear glass) |
| `--lgs-mat-plate-bg` | Windowless CSS plate: black .58 under a white .16 → .04 gradient (PLAN §1.2) |
| `--lgs-mat-<m>-shade` | = `--lgs-darkedge-<m>` (E4 + E5), for `box-shadow` on the glass element |
| `--lgs-scroll-band-top` / `-bottom` | Scroll-edge dimming gradients (black .30 → 0) |
| `--lgs-scroll-mask-bottom` / `-top` | `mask-image` values fading a scroller's last / first 120 px |

High Contrast (`prefers-contrast: more`): every `--lgs-mat-*-bg` becomes `rgb(11 13 16 / .94)` (thick .96), text-2/-3 rise to .86/.74, and the edge hook (§2) draws the one allowed stroke, 2 px solid white .70.

### 1.8 Phase 1 aliases (kept until every area reaches M2; then removed, PLAN §6)

Names Phase 2 redefines with the same meaning take the Phase 2 value: radii (`--lgs-r-window` 54, `-sheet` 44, `-menu` 32, `-row` 24, `-card` 20, `-small` 14, `-capsule`), colours (`--lgs-blue` …, `--lgs-tint-*`, `--lgs-toggle-on`), text levels, `--lgs-selected-fill`, `--lgs-scrim`, `--lgs-well-shadow` (ring removed), `--lgs-separator` (.11 → .08), and the rim tokens `--lgs-window-rim`, `--lgs-panel-rim`, `--lgs-glass-rim`, which lose their closing `inset 0 0 0 1px` ring (D2 §6.2 R1).

Every other Phase 1 name keeps its Phase 1 value: `--lgs-dial`, `--lgs-text-shadow`, `--lgs-window-alpha`, `--lgs-window-bg`, `--lgs-window-sheen`, `--lgs-panel-alpha`, `--lgs-panel-bg`, `--lgs-panel-sheen`, `--lgs-glass-bg`, `--lgs-glass-blur`, `--lgs-glass-shadow`, `--lgs-thick-bg`, `--lgs-thick-blur`, `--lgs-menu-scrim-blur`, `--lgs-fill-1/-2/-3`, `--lgs-fill-sunken`, `--lgs-hover-fill`, `--lgs-focus-fill`, `--lgs-focus-ring`, `--lgs-focus-ring-outer`, `--lgs-focus-outline`, `--lgs-focus-glow`, `--lgs-pressed-fill`, `--lgs-pressed-scale`, `--lgs-disabled-opacity`, `--lgs-control-rim`, `--lgs-tint-lift`, `--lgs-well-bg`, `--lgs-caret`, `--lgs-control-outline`, `--lgs-knob`, `--lgs-knob-shadow`, `--lgs-slider-fill`, `--lgs-slider-fill-2`, `--lgs-track-depth`, `--lgs-pill-shadow`, `--lgs-field-gap`, `--lgs-r-panel`, and the motion aliases `--lgs-spring`, `--lgs-ease`, `--lgs-t-fast`, `--lgs-t`, `--lgs-t-slow` with the keyframes `lgs-materialize`, `lgs-materialize-up`.

**Do not use a Phase 1 name in new Phase 2 code.** In particular `--lgs-glass-bg`, `--lgs-thick-bg`, `--lgs-glass-blur` and `--lgs-thick-blur` keep Phase 1 values because Phase 1 files use them inside `linear-gradient()` and `background-color`; Phase 2 code uses `--lgs-mat-*` (D2 §16 amended accordingly). P6's `05-native.css` should zero the `--lgs-mat-*-bg` tokens wherever it zeroes `--lgs-glass-bg` today.

---

## 2. Material hooks (`theme/03-material.css`)

Every hook is **opt-in** and inert until an element asks for it. Two ways to ask:

**(a) CSS only (T1), on any Steam element.** Set one custom property on the element in your area file:

| Property on the element | Draws | On |
|---|---|---|
| `--lgs-edge: window \| panel \| liquid \| thick \| clear \| control` | E3 specular arcs from the key light with gaps on both sides, plus the WN §8.2 lobe at 26 % of the width. Never a closed ring. The rim brightens ×1.5 under gamepad focus (`--lgs-focus`, §3) | the element's `::before` |

The element must be a containing block (`position: relative/absolute/fixed`; most Steam controls already are) and its `::before` must be free (check with `glass.py styles`). The hook sets `content`, `position: absolute`, `inset: 0`, `border-radius: inherit`, `pointer-events: none`, padding, background and mask on `::before` only; it never touches the element itself. The element's own fill, blur and E4/E5 shading come from tokens you write on the element:

```css
%{Card} {
  background: var(--lgs-mat-panel-bg);
  box-shadow: var(--lgs-mat-panel-shade);       /* + var(--lgs-shadow-25mm) where it floats */
  backdrop-filter: none;                        /* liquid/thick in-page: var(--lgs-mat-liquid-blur) */
  border-radius: var(--lgs-r-tile);
  --lgs-edge: panel;                            /* E3 arcs on ::before */
}
```

How it works: `@container style(--lgs-edge: …)` rules on `*::before`; a pseudo-element queries its originating element. `--lgs-edge` is registered `inherits: false`, so children never inherit it. Proven on the device's CEF 126 (`wp/P4.md`, probe SQ-1).

**(b) Markup (T2 / T3 elements we create, or Steam nodes tagged by T2):** `class="lgs-glass" data-lgs-mat="window|panel|liquid|thick|clear"` gives the whole material (fill, blur where valid, E4/E5, E3 edge) on the element; `class="lgs-edge" data-lgs-mat="…"` gives only the E3 edge. `data-lgs-dz="10|15|25|30"` adds the depth shadow.

**Other utilities:**

| Name | What |
|---|---|
| `.lgs-media-dim` | A 35 % black layer element/class for under clear glass over media |
| `.lgs-scroll-fade-bottom`, `.lgs-scroll-fade-top` | Apply the scroll-edge mask on a scroller you tag (T2). T1: write `mask-image: var(--lgs-scroll-mask-bottom)` yourself; never on a scroller that contains `backdrop-filter` (it becomes a backdrop root, MO R1) |
| `--lgs-scroll-band: top \| bottom` on an element | Its `::after` draws the scroll-edge dimming band (`--lgs-scroll-band-h`, default 124 px) |

Thickness θ is computed from the **shorter** side (GM §1.7). CSS presets do not vary with size; glassd does.

---

## 3. States (`theme/04-states.css`)

### 3.1 State numbers: set for you on every element

04-states.css keys every interaction state on P3's input mode (`contracts/interaction.md` §1.1) and publishes it as registered, **non-inherited** numbers on the element itself. Areas never write input-mode logic for these looks; they read the numbers.

| Number (0 → 1) | Set when (P3 laser = `html.lgs-input-laser`, pad = `html.lgs-input-pad`; neither = runtime off) |
|---|---|
| `--lgs-hover` | `:hover` and not pad mode (VP P-01, P-02: never from `.gpfocus` under the laser) |
| `--lgs-focus` | `.gpfocus` and not laser mode |
| `--lgs-within` | `.gpfocuswithin` and not laser mode (a row that contains the focus) |
| `--lgs-press` | `:active` (laser), or `.lgs-pressed` (P3, gamepad A) |
| `--lgs-lift` | Pad: `.gpfocus`. Laser: `.lgs-dwell:hover` (80 ms dwell, VP P-06). Runtime off: `.gpfocus` or `:hover` |
| `--lgs-dis` | `:disabled`, `[aria-disabled="true"]`, `.Disabled`, `%{*Field>Disabled}` and P3's `.lgs-focus-disabled` |

Read them on the element (`scale: calc(1 + (var(--lgs-card-lift) - 1) * var(--lgs-lift))`), or inside your own pseudo-element with `--lgs-focus: inherit` (they do not inherit by themselves).

### 3.2 The illumination hook

| Property on the element | Draws on `::after` |
|---|---|
| `--lgs-ill: raised` | Hover: + white `--lgs-hover-add` and a spot `--lgs-hover-spot` at `--hx/--hy` (P3's pointer, static (50 %, 30 %) without it). Focus: + white `--lgs-focus-add`, a spot `--lgs-focus-spot` at (50 %, 30 %), the inset top arc `--lgs-focus-arc`; the first frame shows `--lgs-focus-first` (P5 `lgs-focus-in`). Press: + `--lgs-press-add` and a spot `--lgs-press-spot` spreading to 120 %. Disabled: no hover or press; focus = `--lgs-dis-focus-add` and the arc at 60 %, no spot |
| `--lgs-ill: recessed` | As raised (fields, tracks) |
| `--lgs-ill: row` | As raised, drawn as a pill inset `--lgs-row-inset` (6 px) with radius `--lgs-r-row`; `.gpfocuswithin` warms it by `--lgs-within-add` (CTL C-D14 multi-control rows) |
| `--lgs-ill: nav` | Navigation rows (sidebar, list, tab bar): hover is the spot only, no fill (SM-D13, SET T-SEL); focus as raised |
| `--lgs-ill: white` | Selected, on, open-menu source, coloured whole fills: focus and hover are the outer glow `--lgs-white-glow` (P-16), never a fill |
| `--lgs-ill: card` | Content (posters, tiles): a diagonal specular sheen on hover or focus. The lift (`scale`, +15 mm) stays the area's, keyed on `--lgs-lift` |

Tuning per element (inherited plain custom properties, all optional): `--lgs-ill-inset` (px, default 0; `row`: 6px), `--lgs-ill-r` (default `inherit`), `--lgs-ill-z` (default `auto`; set `-1` together with `isolation: isolate` on the host to paint the light under the label, VP P-10).

Timing: in on `hover-in` (294 ms, b0), out on `fade` (441 ms, b0); press in on `interactive` (210 ms), out 90 ms linear; focus enters at `--lgs-focus-first` with P5's `lgs-focus-in`. Under Reduce Motion: ≤ 150 ms fades, no swell.

The same rules for T2/T3 markup: `data-lgs-ill="raised|recessed|row|nav|white|card"` on an element we create (equivalent to the property).

**Rules for areas** (VP P-05, CTL C-D12): rows, cards, keys, switches, sliders, tabs and toolbar buttons never scale on hover or focus; only content cards (×1.05) and Home discs (×1.10) lift. Steam's focus fills (`ItemFocusAnim-*`, `forwards`) must be overridden `!important` with the rest fill, so the focus contrast lives in the hook.

### 3.3 Selection vocabulary

| State | Write |
|---|---|
| Selected / on / open-menu source | `background: var(--lgs-selected-fill) !important; color: var(--lgs-text-on-selected) !important; --lgs-ill: white;` |
| Navigation selected | `background: var(--lgs-fill-nav); box-shadow: var(--lgs-sel-arc); font-weight: var(--lgs-nav-weight);` |
| Markup equivalents | `data-lgs-sel="on"`, `data-lgs-sel="nav"` |

G-FOCUS criteria (PLAN §1.4) are met by these values: focus ≥ +40 L over rest, focus ≥ selected + 15 L, selected ≥ hovered + 12 L.

### 3.4 Steam's FocusRing (CTL §4.5)

`%{FocusRing}` becomes a light plate: no outline, animations off (no flash, grow or 20× pulse), a white .12 fill + .16 spot + a blurred glow, radius `min(var(--lgs-r-row), 50%)`. On check circles (P3's `.lgs-ring-check` on the ring) the plate is a bloom 12 px larger than the circle. Only in pad mode or with the runtime off; nothing in laser mode.

### 3.5 Accessibility

- Reduce Motion: state transitions ≤ 150 ms fades; `--lgs-press-grow: 0`, `--lgs-press-max: 1`, `--lgs-card-lift: 1`, `--lgs-disc-lift: 1`.
- High Contrast: hooks use opaque fills; the edge hook draws the allowed 2 px white .70 stroke; no light spot; focus = white .30 + the stroke.

---

## 4. Font (`theme/01-font.nowrap.css`)

Generated, never hand-edited: `python docs/phase2/fontkit.py --css theme/01-font.nowrap.css`. One `@font-face` "LGS Inter" (`wght` 100–900, `opsz` 14–32) as a `data:` URI, plus the `--lgs-font` sweep rules on `body` and form controls. Bundled into every Steam window and every SteamVR page. Areas use `var(--lgs-font)`; never name "Motiva Sans" directly. Fallback if a surface blocks `data:` fonts: Steam's stack (R11).

## 5. SteamVR pages (`theme/vr/00-vr-tokens.css`)

The shared SteamVR values (formerly `vr/10-systemui.css` §0): `--lgs-vr-scale`, `--lgs-vr-r-window`, `--lgs-vr-r-card`, `--lgs-vr-r-row`, `--lgs-vr-ring-w`, `--lgs-vr-focus-ring`, `--lgs-vr-hover-fill`, `--lgs-vr-hover-rim`, `--lgs-vr-solid-bg` and the rest of that block, same names and values. C1a removes its copy after P4 lands it (two-step move, PLAN §6).

## 6. Lens (`device/lgs_lens.js`)

Unchanged Phase 1 interface (`theme/lens.json`, E2 lensing on 1–3 controls per page). Areas declare lens targets with the class `lgs-lens` set by their T2 code; P4 reads it.

## 7. Requests and changes

File requests to P4 as `- [ ] REQ <YOU>->P4: …` in your own `docs/phase2/wp/<YOU>.md`. P4 answers there.
