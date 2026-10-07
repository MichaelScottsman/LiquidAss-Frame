# Glass Shell design spec

**Goal:** re-skin every surface and sub-menu of the Steam Frame's VR interface (Steam gamepadui as SteamVR overlays) into Apple's glass design language, with **zero functional change**.

- visionOS window glass for the window.
- Liquid Glass for the floating controls.

Source material is the project's design bible (`../bible/`, published at https://claude.ai/artifact/T4AqVM5FQrQzn3kW4UTYe9) and its rulebook `../.claude/skills/run-liquid-glass-frame/references/design-language.md`. This spec translates them to CSS inside Steam's CEF.

## 1. What the platform allows

- **Overlays have per-pixel alpha.** Every surface is a quad composited over the room (passthrough, mono or colour) or over the running game.
  - Transparent pixels show the world.
  - Translucent pixels tint it.
- **`backdrop-filter` only sees the page's own content, never the room.** So:
  - **Window glass over the room** = translucent smoky tint + specular rim + sheen. It cannot blur the room, so the tint must carry legibility on its own (`--lgs-window-alpha` ≈ 0.72 by default; the user dial moves it from 0.60 to 0.84).
  - **Liquid Glass over in-page content** = `backdrop-filter` blur + saturation (+ lensing later). Examples: header capsules over scrolling library art, side menus and sheets over the window, context menus over a page.
- **Each popup is its own quad.**
  - The bar segments, bar popups, frame menus, tooltip, volume HUD, footer, toasts and keyboard float alone over the room. They use **panel glass**: tint + rim + sheen, no backdrop blur (there is nothing in-page behind them).
  - Their surroundings are transparent, so rounded corners are real.
- **The Adreno GPU is shared with the compositor.**
  - CEF repaints on change, so static decoration is nearly free. Blurred backdrops re-render whenever what's behind them changes, such as scrolling.
  - **Budget:** at most a few `backdrop-filter` regions visible per window, none on list rows, cards or scrolling containers. No animated filters, no infinite animations.

## 2. Materials (all defined in `theme/00-tokens.nowrap.css`)

| Material | Use for | Recipe (copy these declarations) |
|---|---|---|
| **Window glass** | The dashboard window's root background, i.e. whatever paints the opaque page background today | `background: var(--lgs-window-sheen), var(--lgs-window-bg); box-shadow: var(--lgs-window-rim); border-radius: var(--lgs-r-window);` |
| **Panel glass** | Standalone overlays: bar segments, bar popups, frame menus, toasts, tooltip, HUDs, footer, keyboard | `background: var(--lgs-panel-sheen), var(--lgs-panel-bg); box-shadow: var(--lgs-panel-rim); border-radius: var(--lgs-r-panel)` (or `--lgs-r-capsule` / `--lgs-r-menu` by shape) |
| **Liquid Glass (regular)** | Floating controls over in-page content: header and search capsule, segmented tab bars, floating action capsules | `background: var(--lgs-glass-bg); backdrop-filter: var(--lgs-glass-blur); box-shadow: var(--lgs-glass-rim), var(--lgs-glass-shadow); border-radius: var(--lgs-r-capsule);` |
| **Thick glass** | Sheets, modals, side menus, context and dropdown menus inside the main window | `background: var(--lgs-panel-sheen), var(--lgs-thick-bg); backdrop-filter: var(--lgs-thick-blur); box-shadow: var(--lgs-glass-rim), var(--lgs-glass-shadow); border-radius: var(--lgs-r-sheet)` (menus `--lgs-r-menu`). Modal scrim: `--lgs-scrim` |
| **Fills** (content on glass) | Grouped settings sections, list rows at rest, input wells, chips, non-selected segments | `--lgs-fill-1/2/3`, `--lgs-fill-sunken` for wells; separators `--lgs-separator`. **Never glass on glass**: anything inside a glass container uses fills, not another blur |

**Rim and sheen** are the Liquid Glass signature: a crisp bright top edge, faint side edges and a soft top-down sheen. Light comes from above, the same direction everywhere. Don't add outer drop shadows on standalone overlays, which have no room for them; inside the main window, floating glass may use `--lgs-glass-shadow`.

**Content is not glass.** Game art, capsules, screenshots, hero images, avatars and store pages stay opaque content.
- Round their corners to the concentric radius (`--lgs-r-card` for capsules, `--lgs-r-small` for small art).
- Never tint or blur them.

## 3. Interaction states (must stay unmistakable)

| State | Treatment |
|---|---|
| Rest | Transparent, or `--lgs-fill-1` for rows and grouped items; labels `--lgs-text-1`, secondary `--lgs-text-2` |
| Hover (laser) | `--lgs-hover-fill`, transition `var(--lgs-t-fast) var(--lgs-ease)` |
| **Focus** (`.gpfocus`, controller and laser focus) | `background: var(--lgs-focus-fill); box-shadow: var(--lgs-focus-ring);`. It "illuminates from within". Must be visible on every focusable control in every surface. For content like game capsules, use `--lgs-focus-ring-outer` around the art and keep Steam's scale-up if it has one |
| **Selected** (active tab, current nav item, chosen segment) | White fill `--lgs-selected-fill` + dark label `--lgs-text-on-selected`. Reserved: nothing else is white-filled |
| Pressed | Brighter fill; optional `scale: var(--lgs-pressed-scale)`, using the independent property, never `transform` |
| Disabled | `opacity: var(--lgs-disabled-opacity)` on the control, or `--lgs-text-disabled` for labels |
| Primary action | Only the one primary action per screen is tinted: Play is `--lgs-tint-play`, a dialog's confirm is `--lgs-tint-primary`, destructive is `--lgs-tint-danger`. Tint goes into the whole capsule fill with a white label, never into thin text |

## 4. Components

- **Buttons** (`DialogButton` family, bar small buttons): capsule (`--lgs-r-capsule`) for text buttons, circle for icon buttons.
  - Rest: `--lgs-fill-2` with an inner top rim `inset 0 1px 0 rgba(255,255,255,.18)`.
  - Focus: per §3.
  - Keep sizes; only round and recolour them.
- **Toggles**:
  - Track: capsule, off `--lgs-fill-3`, on `--lgs-toggle-on` (whole fill).
  - Knob: white with a soft shadow `0 1px 3px rgba(0,0,0,.3)`.
  - Focused toggle row gets the focus treatment.
- **Sliders**:
  - Track: `--lgs-fill-3` capsule.
  - Fill: `rgba(255,255,255,.92)`.
  - Knob: white, with a subtle ring.
  - Notches dim.
- **Dropdown buttons** look like capsule buttons. Opened dropdown menus are thick-glass menus.
- **Text inputs / search:** a sunken capsule well (`--lgs-fill-sunken` with `inset 0 1px 2px rgba(0,0,0,.25)`), white text, `--lgs-text-3` placeholder. Focus: ring.
- **Field rows** (settings and dialogs): transparent rows inside a grouped section card (`--lgs-fill-1`, `--lgs-r-card`).
  - Separators `--lgs-separator`, inset from the left.
  - The focused row gets focus fill + ring with `--lgs-r-row`.
- **Tabs / segmented controls:** a Liquid Glass capsule holding the segments; the selected segment is the white pill.
  - Steam's home tabs (WHAT'S NEW / FRIENDS / RECOMMENDED) and library tabs map to this.
  - Keep their text case and size.
- **Menus** (context menus, dropdowns, bar popups, frame menus): thick or panel glass, `--lgs-r-menu`, 6–8 px inner padding.
  - Rows `--lgs-r-row`.
  - Headers in `--lgs-text-2`, small caps-free title case.
  - Separators as hairlines.
  - Materialize with `animation: lgs-materialize var(--lgs-t) var(--lgs-spring) both;`, only on the menu container and only if Steam doesn't already animate it with `opacity`/`transform`.
- **Modals / sheets:** thick glass, `--lgs-r-sheet`, scrim `--lgs-scrim`.
- **Toasts and notifications:** panel glass rounded rect, `--lgs-r-panel`; icon left, title `--lgs-text-1`, body `--lgs-text-2`.
- **Scrollbars:** thin capsule thumbs, `rgba(255,255,255,.28)`, if Steam shows any.
- **The dashboard bar** (ornament):
  - Each `BarSurface` segment becomes a panel-glass capsule or rounded slab.
  - Icons are white.
  - The active tab gets a white-ish selected fill or an underglow dot.
  - The + and small buttons are circular glass hit areas with the focus treatment.
  - The clock uses `--lgs-text-1`.
  - The avatar has a rounded square.
- **The keyboard:** a panel-glass slab.
  - Keys are fills (`--lgs-fill-2`, `--lgs-r-small`) with white labels; special keys `--lgs-fill-3`.
  - The focused or touched key is bright white fill with a dark label (visionOS keyboard style).
  - Enter is tinted `--lgs-tint-primary`.

## 5. Type and colour

- Keep Steam's font (Motiva Sans) and its sizes. Don't change font sizes or weights in a way that can reflow and clip text; a +100 weight on small labels is fine where space allows.
- Labels are white at vibrancy levels: `--lgs-text-1/2/3`.
  - Map Steam's greys: near-white → `--lgs-text-1`, mid grey → `--lgs-text-2`, dim grey → `--lgs-text-3`.
  - Add `text-shadow: var(--lgs-text-shadow)` on text that sits directly on window or panel glass.
- Colour only in whole fills: the green Play capsule, the green toggle-on track, blue primary confirm, red destructive, badges.
- Keep Steam's semantic colours where they carry meaning (online green, in-game blue), but as fills or dots.

## 6. Shape

Concentric: inner radius = outer radius − padding.

| Element | Radius |
|---|---|
| Window | 32 |
| Sheets | 28 |
| Panels | 24 |
| Menus | 20 |
| Cards and capsule art | 16 |
| Rows | 12 |
| Small | 8 |
| Controls | capsule |

## 7. Motion

- Only on state changes, never at rest.
- Hover and focus fills transition over 140 ms.
- Popups and menus materialize in 220 ms with a spring.
- No shimmer, no pulsing, no oscillation.
- `prefers-reduced-motion` sets the durations to 1 ms.

## 8. Functionality guardrails (from `docs/LAB.md`, repeated because they matter most)

**Never:**
- hide, collapse, zero-opacity or disable pointer events on Steam elements;
- change layout geometry (position, size, overflow, flex/grid) of containers;
- override transforms Steam uses for positioning, carousels or virtualization;
- cover controls with pseudo-elements that take pointer events.

**Run `python glass.py audit SURF --route R` on every screen you style.** It must report 0 GONE / HIDDEN / SHRUNK / UNCLICKABLE and 0 CONTRAST.

**Every focusable control must show the focus state** in screenshots taken with that control focused (`.gpfocus`).

## 9. File ownership

| File | Owner |
|---|---|
| `theme/00-tokens.nowrap.css`, `theme/defs.svg` | Foundation (changes go through it) |
| `theme/10-primitives.css` | Foundation: generic Steam components used everywhere (DialogButton, gamepaddialog fields, toggles, sliders, dropdowns, text inputs, context menus, modals, generic focus) |
| `theme/20-shell.css` | Window chrome: root window glass, header and search, side menus, page transitions, in-window footer |
| `theme/30-bar.css` | Dashboard bar, bar popups, frame menus |
| `theme/35-hud.css` | Tooltip, volume HUD, floating footer, notification toasts, keyboard |
| `theme/40-library.css` | Library home, library tabs, collections, capsules, search results |
| `theme/50-appdetails.css` | Game pages, play bar, game menus, properties, running-app overview |
| `theme/60-settings.css` | Settings pages (layout-level styling; controls come from primitives) |
| `theme/70-social.css` | Friends and chat, profile, notifications, media, downloads, store chrome, power menu, other routes |

Area files may refine primitives inside their own containers. Generic primitive changes belong in `10-primitives.css`.
