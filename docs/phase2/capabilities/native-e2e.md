# Native layer end to end, first live run (2026-10-07 01:29, coordinator)

How it was run:

- `python glass.py native-build`, then `python glass.py on --native`. That is the user path: CSS + the `lgs-shell` daemon + the real glassd on the live `/dev/video99` feed.
- A headset-view capture (`hvgrab`) was taken, inspected, and deleted.
- Afterwards the theme went back to CSS-only (`python glass.py on --css`).

## Daemon state

| Item | Value |
|---|---|
| `mode` | `native` |
| glassd | healthy |
| Feed | `live mmap x2` |
| Surfaces | `bar`, `floatingfooter`, `frame.menu.*`, `main` |
| glassd GPU | 0.96 ms |
| Scene-graph spec | 3 surfaces, 3 covers, 3 slabs, 3 pops, 10 base pieces |

## What worked

**The chain works.** Steam DOM → reporter → daemon → glassd (dmabuf overlays) → systemui scene graph → compositor.

**Popped crops render in front of the glass with their slabs.** Popped this run:
- the left nav column, as a capsule;
- the header Back and search capsules;
- the bar segments as glass capsules.

**The window and bar covers are opaque glassd glass**, curved with the window.

## What is wrong (the phase 2 build must fix these)

### 1. Ghosts where the cover does not reach

The window cover shape excludes the nav column, which the phase 1 CSS treats as an ornament outside the window glass. So Steam's real panel shows its own nav icons at z = 0 there.

The popped copy floats at +dz. Seen off-axis (here about 30–35°), it sits about 20–25 px beside the original, and both are visible: a doubled icon column.

**Rule:** every pixel of Steam's real panel that shows content must be either:
- (a) under an opaque glassd cover, or
- (b) displayed only at its own position, with no pop.

Ornaments outside the window glass therefore need one of:
- the inset approach (`spatial.md` §2.5): no pop, a glassd slab *behind* it at negative z, Steam's transparent page on top;
- Steam dashboard popups (`spatial.md` §3): a real separate popup document, interactive, placed at any offset and depth.

### 2. Rims read as outlines

The glassd rim is a bright line of uniform width around every cover and slab. On the bar it looks exactly like a white stroke, which the user explicitly rejected ("menus shouldn't have clear outlines ... visible from the appearance of the glass shader").

**Needed:**
- a specular highlight that depends on the edge normal relative to a light from above and slightly behind: bright on the top and upper-left curvature, near zero on the sides and bottom;
- lensing and refraction that brighten and distort the backdrop near the edge;
- a soft outer shadow or occlusion on the room, not a line.

### 3. The window glass is flat grey

The dashboard stayed open the whole session, so the room behind the window was always masked and never captured. The push-pull fill made the cover a uniform mid-grey.

- **In real use** the room map fills while the dashboard is closed and the wearer looks around. glassd updates at 2/s while it is hidden.
- **The fallback** should still look like glass, not a grey card:
  - fill unknown regions from the surrounding known room with a large-scale blur that keeps colour and luminance variation;
  - tint by the average room colour;
  - keep the window's vertical sheen gradient.

### 4. Dashboard-bar tooltips can stay up

Two bar tooltips ("Steam" and "Launch Program") stayed on screen overlapping each other. This is probably left over from agents' synthetic hover events, and is cosmetic. Lab steps that synthesize hover must clear it.

### 5. Still untested without a wearer

- whether laser and controller input get through the non-interactive layers;
- whether the laser cursor dot is visible over the cover;
- comfort of the pop depths.

The UI must stay usable if the dot is hidden: hover states are drawn by Steam inside its texture, so they show in the crops.
