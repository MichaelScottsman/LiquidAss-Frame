# Liquid Glass: material and motion spec for Glass Shell Phase 2

Research for the Phase 2 overhaul. It extends, and does not repeat, the design bible (`../bible/index.html`) and its rulebook (`../.claude/skills/run-liquid-glass-frame/references/design-language.md`). Read those first for the basics: the seven material behaviours, Regular/Clear/Tinted, the layer rule, concentric shapes and visionOS window anatomy.

This document adds three things:

1. a precise **material spec**, focused on how a glass edge is drawn by optics and not by a stroke (§2);
2. a **motion spec** for every interaction Glass Shell needs, with spring parameters, CSS easings, and what must and must not animate (§3–§5);
3. **implementation recipes** for Steam's CEF (Chromium 126), the SteamVR scene graph (≤ 30 Hz pushes) and glassd (§6–§9).

Evidence tags, as in the rulebook:

- **[official]**: Apple HIG, Apple developer documentation or a WWDC session.
- **[community]**: measured or reverse-engineered by third parties (named in each case).
- **[inferred]**: follows from official facts but is not stated by Apple.
- **[ours]**: chosen for Glass Shell, with the reasoning given.

Sizes are CSS px of the main window (1280 × 720 CSS px, about 0.98 m wide at about 1.43 m). 1 CSS px ≈ 0.77 mm ≈ 0.031°. visionOS's 60 pt target ≈ 75–80 CSS px.

---

## 0. Summary for implementers

1. **Apple publishes behaviours, not durations, for Liquid Glass.** The only official numbers are the SwiftUI spring presets (§3.1). Glass-specific timings below come from third-party 120 fps captures of iOS 26 [community], adjusted for a headset and for pointer and gamepad input [ours].
2. **Pointer and gamepad get the subdued variant.** Apple: Liquid Glass "responds to direct touch interaction with greater emphasis… but produces a more subdued effect when a person interacts using a trackpad" [official, HIG Motion]. The Frame's laser and gamepad are indirect, so press swell, bounce and gel stretch are about a third of the touch values.
3. **Glass and content are two channels.** On entrance the glass resolves first and the content sharpens last (content starts at 35 % of the transition). On exit the content leaves first (gone by 55 %) and the glass dissolves after, briefly leaving an empty shell [community, 120 fps capture of `glassEffectTransition(.materialize)`].
4. **Materialize, never fade glass with `opacity` on a parent.** Apple: "Always prefer setting the effect property over the alpha to ensure that the glass dematerializes or materializes with the appropriate animation" [official, WWDC25-284]. In Chromium an ancestor with `opacity < 1` also becomes a backdrop root, so the glass loses its blur mid-fade and pops at the end (§6.3).
5. **One spring vocabulary.** All motion uses springs defined by *duration* (perceptual) and *bounce* (§3.2). In CSS, the easing depends only on the bounce, and the CSS duration is the spring's settling time (§3.3). Chromium 126 supports `linear()`, so springs are exact.
6. **Bounce only on direct feedback.** Use bounce ≤ 0.2 for small glass under the pointer, and 0 for focus traversal, large surfaces, route changes and anything under Reduce Motion.
7. **Big things move less.** Scale deltas shrink with size (`1 + 12 px / longest side`, clamped to 1.01–1.15). There are no full-width slides. In the headset, Steam's 40 % tab slide moves about 40 cm of panel sideways, and its 0.95 route zoom moves the window's edges by about 2.5 cm. Both are replaced (§5).
8. **Edges come from optics.** Edges are made of lensing at the bezel, a directional specular arc, a darkened inner edge and a luminance step, with no closed 1 px ring. The Phase 1 tokens' `inset 0 0 0 1px` rings must go (§2.2). The only stroke allowed is under Increase Contrast.
9. **Motion lives where it can run at display rate.** Content motion runs in CSS, and the live crops show it at CEF's frame rate. Glass optics run in glassd at up to 72 Hz. The scene graph (≤ 30 Hz) only carries small depth changes (≤ 20 mm), which stay below stereo-step visibility (§7).
10. **Nothing moves at rest, and nothing blocks input.** Every animation is one-shot and interruptible. An action fires on release without waiting. `document.getAnimations()` returns 0 at rest.

---

## 1. Sources of truth and their limits

### 1.1 What Apple states, and what it does not

- **Behaviours [official]** (WWDC25-219 "Meet Liquid Glass"):
  - lensing ("bends, shapes, and concentrates light");
  - highlights whose light "travel[s] around the material and define[s] its silhouette";
  - adaptive shadow;
  - illumination on interaction ("starting right under your fingertips, the glow spreads throughout the element and onto any Liquid Glass elements nearby");
  - "gel-like flexibility";
  - morphing between contexts to keep "a singular floating plane";
  - menus where "the bubble simply pops open";
  - materialize "by gradually modulating the light bending and lensing".
- **Control behaviours [official]** (WWDC25-284, Adopting Liquid Glass):
  - "Control thumbs, like those on switch and segmentedControl, automatically have a new liquid glass appearance for interactions."
  - "With sliders, in addition to the liquid glass effects on the thumb, they now preserve momentum and stretch when they are moved."
  - "Buttons fluidly morph into menus and popovers."
  - "When a presentation, like a menu or a popover is originated from a glass button, the button morphs into the overlay."
  - Interactive glass "reacts to user interaction by scaling, bouncing, and shimmering" (WWDC25-323).
- **Presentations [official]** (WWDC25-323, WWDC25-356):
  - "Sheets can also directly morph out of buttons that present them."
  - "Menus, alerts, and popovers flow smoothly out of liquid glass controls."
  - "Dialogs also automatically morph out of the buttons that present them."
  - "When focus shifts, like dragging a sheet upward, Liquid Glass subtly recedes, becoming more opaque and gently growing in size."
- **Transitions API [official]:**
  - `GlassEffectTransition` has three members: `matchedGeometry` (the default inside a container's spacing), `materialize` ("will fade in content and animate in or out the glass material but will not attempt to match the geometry of any other glass effects") and `identity`.
  - "The system applies more than opacity changes with the available transition types."
- **Numbers [official]:**
  - `Animation.default` (iOS 17+) is `spring(response: 0.55, dampingFraction: 1.0)`.
  - `spring(duration:bounce:)` defaults to duration 0.5 and bounce 0.
  - `smooth`, `snappy` and `bouncy` have duration 0.5 and bounce 0, 0.15 and 0.3.
  - `interactiveSpring` is response 0.15, damping fraction 0.86.
  - `Spring.settlingDuration` uses epsilon 0.001.
  - Apple's `glassEffectID` sample animates with a bare `withAnimation { }`, which is `.default`.
  - WWDC25-284's UIKit samples call a bare `UIView.animate { }`. With iOS 17's defaults that resolves to `animate(springDuration: 0.5, bounce: 0)` [inferred].
- **Not published:** any glass-specific duration, blur radius, refraction strength, press scale or morph spring. The HIG says blur and refraction are adaptive. Everything glass-specific with a number below is therefore [community] or [ours].

### 1.2 Community measurements used

| Source | What it measured | Values |
|---|---|---|
| `liquid_glass_widgets` (Flutter), "tuned against a 120fps capture of iOS 26's `glassEffectTransition(.materialize)` on the native navigation bar" | Materialize | Entrance **250 ms**, exit **350 ms**. Channels are linear. Glass channel 0–92 % of the entrance. Content 35–100 % of the entrance, with Gaussian blur σ 8 → 0. Exit content gone by 55 % of the time; glass dissolves over the whole exit. Scale from **1.15** (the glass swells as it leaves and settles inward as it arrives) |
| Same library, `GlassButton` | Press | "growing its longest side by ~17 pt (1.3× for a 56 pt circle, 1.13× for a 132 pt pill)". Highlight "~150 ms up, gone within ~60 ms of lift-off". Drag elongation "≤5%". Pressed surface "about +15 luma" |
| Same library, `GlassMenu` and morph engine | Menu morph | One underdamped spring both ways: k = 120, c = 16 (ζ ≈ 0.73, which is duration 0.57 s, bounce 0.27). About 5 % path overshoot. The source "ghost" shrinks over the first 40 %. The close carries a velocity kick so the button "takes the hit" |
| Same library, segmented control | Selection | Spring with the drag `interactive` (150 ms, bounce 0.14); `snappy` 300–350 ms on release |
| AndroidLiquidGlass (Kyant) | Press highlight | Compose `spring(dampingRatio 0.5, stiffness 300)`. White +8 % additive plus a radial glow of 15 % at the touch point, radius 1.5 × the shorter side |
| Same library | Value travel (toggle, slider, tabs) | `spring(1.0, 1000)` (duration 0.2 s, no bounce) |
| Same library | Gel | `scaleX spring(0.6, 250)`, `scaleY spring(0.7, 250)` (anisotropic). Velocity stretch `scaleX /= 1 − clamp(0.75 v, ±0.2)`, `scaleY *= 1 − clamp(0.25 v, ±0.2)` |
| Same library | Knob and pill lift | Toggle knob ×1.5 while pressed. Tab-bar pill ×78/56 ≈ 1.39 while pressed. Knob fill goes from opaque white to clear glass as it lifts |

These numbers recreate iOS touch behaviour. §3 scales them down for pointer and gamepad, as the HIG prescribes.

### 1.3 Where visionOS stands (for "native visionOS feel")

- **API availability [official].** `Glass`, `glassEffect`, `GlassEffectContainer`, `glassEffectID`, `glassEffectTransition` and `UIGlassEffect` list iOS, iPadOS, macOS, Mac Catalyst, tvOS and watchOS 26, **not visionOS**. visionOS 26 did gain `scrollEdgeEffectStyle`, `tabBarMinimizeBehavior` and `backgroundExtensionEffect`. visionOS keeps `glassBackgroundEffect`, "a 3D glass background material that includes thickness, specularity, glass blur, shadows".
- **visionOS 26 in practice [press]** (MacStories): the platform "didn't get the Liquid Glass treatment aside from some updated icons". Window chrome stays frosted, with "navigation and toolbars remaining static rather than shrinking and growing".
- **visionOS 27 [press]** (MacStories, UploadVR, MacRumors):
  - the Siri orb is "a floating, semi-translucent orb… the strongest taste of the Liquid Glass style we've gotten so far in visionOS";
  - Control Center is three panes (the user's reference shot 3);
  - notifications expand when looked at;
  - Safari, Freeform and TV Multiview get curved windows.
- **WWDC26 tuning, all platforms [official, Platforms State of the Union]:** "we tuned Liquid Glass so it more effectively diffuses complex content behind it… we also introduced a darkened edge along with brighter specular highlights". A settings slider runs "from ultra clear to fully tinted". macOS 27 interactive glass "is optimized to work great with the mouse pointer" (What's new in SwiftUI, WWDC26).
- **Consequence for Glass Shell [ours]:**
  - The window is visionOS glass: frosted, adaptive, no light/dark flip, chrome steady.
  - Floating controls, menus, sheets, toasts and ornaments are Liquid Glass with the iOS 27 tuning.
  - Motion follows Liquid Glass, with the pointer-subdued variant and the visionOS comfort rules applied on top.

---

## 2. Material spec

### 2.1 Layer stack of one glass element

From back to front. Columns: CSS (in-page glass over Steam content) and glassd (glass over the room).

| # | Layer | What it does | CSS (in-page) | glassd (`glass.frag`) |
|---|---|---|---|---|
| 1 | Sampling region | Glass samples "an area larger than itself" [official, WWDC25-323], which is why adjacent glass must share a container | `backdrop-filter` up to the backdrop root (§6.3) | Room map along the view ray; the sample extends past the rim through the bezel offset |
| 2 | Frost | Diffuses detail. iOS 27 diffuses complex content more [official] | `blur()` + `saturate(1.6–1.8)` | `uFrost` (mip level) |
| 3 | Lens band | Refraction only where the surface slopes. Interior stays readable | SVG displacement (Chromium only), or omitted | `uBezel`, `uRefr`, `uLensMag`, `uDisp` |
| 4 | Tint | Adaptive: tones mapped to the brightness behind [official, WWDC25-219] | Background alpha raised by `--lgs-dial` | `uTintA` adapted by room luma |
| 5 | Darkened edge | Thin dark band just inside the rim: depth and separation [official, WWDC26] | Inner gradient band (§2.2 recipe) | `uDarkEdge` |
| 6 | Specular | Key arc on the light-facing edge, weaker arc opposite; light fixed in the world [official, WWDC25-219; ours: world-fixed] | Masked conic-gradient arcs (§2.2) | `uRim`, `uSpec`, `uLight2/3` |
| 7 | Sheen | Soft top-down gradient on large surfaces | `--lgs-*-sheen` | `uSheen` |
| 8 | Illumination | Hover light, press glow, focus glow. Rises from within, never painted as an outline | `::after` radial gradient with `plus-lighter` (§6.4) | New `uPress`, `uPressPos` (§9) |
| 9 | Content | Vibrant labels and symbols; fills, not glass | Steam's nodes | Steam crops (scene graph) |
| 10 | Shadow | Adaptive: stronger over text, weaker over flat light colour [official]. Only when something is behind to receive it | `--lgs-glass-shadow` in-page; none on standalone overlays | Contact shadow outside the SDF (slabs over the window) |

### 2.2 How the edge is drawn without a stroke

Apple defines the glass silhouette with light and refraction: "Lensing [is] the primary way Liquid Glass defines itself", and moving lights "travel around the material and define its silhouette" [official, WWDC25-219]. The reference shots show the same on visionOS: no window or Control Center tile has a closed outline. Five cues build the edge, and none of them is a uniform line.

| Cue | Look | Strength | CSS | glassd |
|---|---|---|---|---|
| **E1 Luminance step** | Glass is lighter (frosted, tinted) than the room or content behind | Always on; this is most of the edge on large surfaces | Background tint | Tint + frost |
| **E2 Lens band** | Content behind bends inward over a band of about 6–16 px (more on small and thin elements, less on windows) | Strongest on small controls; low on windows | SVG `feDisplacementMap` on `backdrop-filter` for the 1–3 most important small controls only. Otherwise omit: E3–E5 carry the edge | `uBezel` 12–20 mm, `uRefr` per material |
| **E3 Specular arcs** | Bright arc where the edge faces the light (top and top-left), fading to zero along the sides. A weaker arc (25–40 % of the key) on the opposite edge. **Gaps on the sides**, so no closed loop | Key alpha 0.35–0.55 at the brightest point | `conic-gradient` ring masked to 1–1.5 px with `mask-composite: exclude`, alpha 0 over at least two 60° sectors | `uRim`, `uSpec` with a world-fixed light |
| **E4 Darkened edge** (iOS 27) | 2–6 px band just inside the arcs, black at 8–18 % | Larger glass gets more | `inset 0 0 6px -1px rgb(0 0 0 / .14)`. A blurred inset reads as a darkened band, not a line | `uDarkEdge` |
| **E5 Thickness shading** | The lower edge reads slightly darker or occluded (glass has thickness) | Subtle | `inset 0 -1px 2px rgb(0 0 0 / .10)`, blurred, not a crisp line | Inner shadow (`uRimW`) |

**Rules.**

- **R1 No closed rings.** Delete the uniform `inset 0 0 0 1px rgba(255,255,255,.07–.09)` from `--lgs-window-rim`, `--lgs-panel-rim` and `--lgs-glass-rim`. Today they draw exactly the "clear outline" the user objects to. Keep a single crisp highlight only on the light-facing edge, and make it fade along the sides (E3).
- **R2 The rim follows the light, not the box.** Use one light direction for the whole scene: from above, about 20° left of vertical, matching glassd's `uLight2`. Every element's arc peaks at the same angle.
- **R3 Arcs scale with size, not with the element.** On a 40 px capsule the key arc spans the top half. On a 900 px window it is a band about 120 px long near the top-left corner, plus a faint top edge.
- **R4 Selection and focus never add an outline.**
  - Selected = white fill + dark label (visionOS) [official].
  - Focus = illumination from within, plus an outer glow for content cards [ours].
  - An outer focus ring is allowed only on content art (game capsules), where a fill cannot be used. There it is a glow-dominated ring, not a hairline.
- **R5 Increase Contrast is the only place for a stroke.** Apple: "elements become predominantly black or white and highlights them with contrasting borders" [official, WWDC25-219]. Under `prefers-contrast: more`, add a 1.5–2 px solid border at white 70 % and make the glass opaque.

CSS recipe for E3 + E4 (decorative `::before`, pointer-events none):

```css
/* --la: light angle. 340deg points the conic's 0deg up and slightly left.
   The host must already be positioned by Steam; use a pseudo-element Steam leaves free. */
.lgs-edge::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  pointer-events: none; padding: 1.25px;            /* arc thickness */
  background: conic-gradient(from var(--la, 340deg),
      rgb(255 255 255 / .55) 0deg,                   /* key arc peak */
      rgb(255 255 255 / .18) 35deg,
      transparent 70deg, transparent 150deg,         /* gap: side */
      rgb(255 255 255 / .16) 180deg,                 /* weak opposite arc */
      transparent 215deg, transparent 290deg,        /* gap: other side */
      rgb(255 255 255 / .18) 325deg,
      rgb(255 255 255 / .55) 360deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
.lgs-edge {                                         /* E4 + E5, blurred so they read as bands */
  box-shadow: inset 0 0 6px -1px rgb(0 0 0 / .14), inset 0 -1px 2px rgb(0 0 0 / .10);
}
```

On a rounded rectangle the conic is centred on the box. The arc therefore lands on the top-left corner and part of the top edge, which is the Apple look. On very wide capsules, add a second faint linear highlight along the top edge, `linear-gradient(to right, transparent, white 12%, transparent 70%)` masked the same way. That keeps the arc from collapsing to the corner.

### 2.3 Size changes the material (continuous, for morphs)

Apple: when glass grows "it simulates a thicker, more substantial material: deeper shadows, more pronounced lensing and refraction, softer scattering" [official]. "Larger elements like menus and sidebars adapt… but do NOT flip from light to dark" [official].

Define **thickness** `θ = clamp(log2(maxSide / 64 px) / 4, 0, 1)` [ours]. That gives 0 at 64 px, 0.5 at 256 px and 1 at ≥ 1024 px. Interpolate between these presets:

| Property | θ = 0 (capsule, knob, pill) | θ = 0.5 (menu, toast, popover) | θ = 1 (sheet, window) | glassd preset |
|---|---|---|---|---|
| Frost, CSS `blur()` | 10 px | 22 px | 34 px | `liquid` 1.4 → `panel` 3.4 → `thick`/`window` 3.6–4.2 mip |
| Lens band | 0.18 × height, max 14 px | 12 px | 16–20 px, low strength | `bezelM` 0.016 → 0.020 |
| Refraction strength | high | medium | low | `refrM` 0.016 → 0.006 |
| Tint alpha (dial 0.5) | 0.10–0.18 | 0.45–0.55 | 0.55–0.78 | `tintA` 0.18 → 0.55 |
| Key specular | 0.55 | 0.45 | 0.34 | `rim` 1.2 → 0.6 |
| Darkened edge | 0.08 | 0.14 | 0.18 | `darkEdge` 0.55 → 0.45 (shader-scaled) |
| Shadow (in-page only) | `0 4px 12px /.18` | `0 12px 32px /.26` | `0 24px 60px /.32` | Contact shadow scales with size |
| Light/dark flip | No (visionOS behaviour; Steam content is dark) | No | No | — |

During a morph (button → menu), θ interpolates with the shape's size on the same spring. The material visibly thickens as it grows.

### 2.4 Variants in Steam

| Variant | Use in Steam | Rule |
|---|---|---|
| **Regular** | Everything by default: header and search capsules, tab bars, menus, sheets, toasts, the bar, the keyboard | Adaptive. Text is safe on it |
| **Clear** | Only over media: video player controls over a trailer or stream, the Play capsule *group* over hero art, screenshot viewer controls | Requires a dimming layer of **35 % black** over bright media [official, HIG]. Apple's code sample uses 0.3. Content on top must be bold and bright. Never mix with Regular in one group [official] |
| **Tinted** | One primary per screen: Play (green), a dialog's confirm (blue), destructive (red) | Tint is "a range of tones mapped to content brightness underneath" [official]. In CSS this means tinted fill + glass rim, never coloured text |
| **Identity** (glass off) | An element inside other glass; anything under Increase Contrast | "Your content remains unaffected as if no glass effect was applied" [official] |

### 2.5 Light in a headset

- Fix the key light in the world (from above, about 20° left). As the head moves, glassd's specular shifts slightly with the view vector. That is Apple's "lighting responds to device motion" translated to head motion [inferred].
- Keep that response small: a peak shift of less than 10 % of the arc length per 10° of head yaw. Static CSS arcs do not respond, which is acceptable.
- Head-coupled light is a material response, not an animation. It must not add any time-based motion at rest.

---

## 3. Motion foundations

### 3.1 The spring model, and how to convert it

Apple's modern parameters are **duration** d (perceptual; "approximately equal to the settling duration") and **bounce** b (0 = critically damped, >0 = bouncy, <0 = overdamped) [official, SwiftUI `Spring`]. With mass 1:

```
stiffness k = (2π / d)²
damping   c = 4π (1 − b) / d        (b ≥ 0)
ζ (dampingFraction / dampingRatio) = 1 − b      (b ≥ 0)
response = d                        (SwiftUI spring(response:dampingFraction:))
Compose spring(dampingRatio ζ, stiffness k):   d = 2π / √k,  b = 1 − ζ
Flutter SpringDescription(m, k, c):            ζ = c / (2√(mk)),  d = 2π / √(k/m)
settle = last time |1 − x(t)| > 0.001           (Apple's epsilon)
```

Computed with `docs/phase2/research/springs.py` (closed-form step response, 0.5 ms resolution; run `python springs.py` to reproduce):

| Preset [official] | d | b | k | c | t50 | t90 | settle | Overshoot |
|---|---|---|---|---|---|---|---|---|
| `Animation.default` (iOS 17+) | 0.55 | 0 | 130.5 | 22.85 | 147 ms | 340 ms | 808 ms | 0 |
| `spring()` (legacy, response .5, ζ .825) | 0.50 | 0.175 | 157.9 | 20.73 | 122 | 246 | 689 | 1.0 % |
| `interactiveSpring` (response .15, ζ .86) | 0.15 | 0.14 | 1754.6 | 72.05 | 38 | 78 | 210 | 0.5 % |
| `smooth` = UIKit `springDuration` default | 0.50 | 0 | 157.9 | 25.13 | 134 | 310 | 735 | 0 |
| `snappy` | 0.50 | 0.15 | 157.9 | 21.36 | 123 | 254 | 697 | 0.6 % |
| `bouncy` | 0.50 | 0.30 | 157.9 | 17.59 | 114 | 210 | 819 | 4.6 % |

Community springs, for comparison:

| Spring [community] | d | b | t90 | settle | Overshoot |
|---|---|---|---|---|---|
| Kyant press glow and scale (Compose 0.5 / 300) | 0.36 | 0.50 | 123 ms | 734 ms | 16.3 % |
| Kyant value travel (1.0 / 1000) | 0.20 | 0 | 124 | 292 | 0 |
| Kyant gel X (0.6 / 250) and Y (0.7 / 250) | 0.40 | 0.40 / 0.30 | 149 / 166 | 643 / 651 | 9.5 / 4.6 % |
| lgw menu morph (k120 c16) | 0.57 | 0.27 | 250 | 904 | 3.5 % |
| lgw sheet (k220 c30) | 0.42 | 0 | 266 | 644 | 0 |

### 3.2 Glass Shell motion tokens [ours]

Each token is derived from an Apple preset or a community measurement. Durations are shortened or bounces lowered for pointer and gamepad, per the HIG Motion quote in §0.

| Token | d | b | t50 | t90 | **CSS duration = settle** | Overshoot | Use | Derived from |
|---|---|---|---|---|---|---|---|---|
| `interactive` | 0.15 | 0.14 | 38 ms | 78 ms | **210 ms** | 0.5 % | Press-in, drag-follow smoothing, gamepad slider steps | `interactiveSpring` exactly |
| `hover-in` | 0.20 | 0 | 54 | 124 | **294 ms** | 0 | Hover light in, focus illumination in | Kyant value spring (d 0.2) |
| `fade` | 0.30 | 0 | 80 | 186 | **441 ms** | 0 | Hover and focus out, content cross-fades, list insert, scroll-linked bits | `smooth` shortened |
| `snappy` | 0.35 | 0.15 | 87 | 178 | **488 ms** | 0.6 % | Selection pill travel, toggle knob travel, toast in, pointer release | `snappy` at lgw's 350 ms |
| `release-touch` | 0.40 | 0.25 | 94 | 178 | **510 ms** | 2.8 % | Release after a direct hand poke only (if ever supported) | Between `snappy` and `bouncy` |
| `morph-open` | 0.45 | 0.20 | 108 | 214 | **607 ms** | 1.5 % | Menu, popover or dropdown grows out of its button | lgw morph (0.57 / 0.27), subdued |
| `morph-close` | 0.30 | 0 | 80 | 186 | **441 ms** | 0 | Menu or popover returns into its button | Faster than open: "don't make people wait" [official HIG] |
| `sheet-in` | 0.50 | 0 | 134 | 310 | **735 ms** | 0 | Sheet or modal present; parent dims | `smooth`, the UIKit sheet default |
| `sheet-out` | 0.35 | 0 | 94 | 217 | **514 ms** | 0 | Sheet or modal dismiss | — |
| `page` | 0.45 | 0 | 120 | 279 | **662 ms** | 0 | Route and tab content transitions | `smooth`, slightly faster |
| `depth` | 0.30 | 0 | 80 | 186 | **441 ms** | 0 | z-lift of popped crops and slabs (scene graph) | — |
| `materialize-in` (small) | linear channels | — | — | — | **250 ms** | — | Small glass appearing (toast, tooltip, chips, ornaments) | lgw 120 fps capture |
| `materialize-out` (small) | linear channels | — | — | — | **350 ms** | — | Small glass leaving | lgw 120 fps capture |
| `materialize-in/out` (large) | Rides the surface's spring | — | — | — | `sheet-in` / `sheet-out` | — | Sheets, windows: geometry and optics arrive together | lgw insight: a scale on its own curve "reads as two animations" |

### 3.3 Easings: one curve per bounce value

Normalised to its settling time, a spring's curve depends only on its bounce. Duration just stretches it. CSS therefore needs one `linear()` per bounce, with the duration token set to the settle time. These were generated by `python springs.py --css`, with point reduction at a tolerance of 0.4 % of travel:

```css
/* bounce 0      (settle = 1.470 × d) */
--lgs-ease-b0:  linear(0, .005 1.2%, .020 2.3%, .084 5.2%, .159 7.7%, .461 16.9%, .556 20.2%, .639 23.5%, .709 26.9%, .767 30.2%, .817 33.7%, .861 37.6%, .900 42.1%, .930 46.9%, .954 52.4%, .971 58.6%, .991 73.8%, 1);
/* bounce 0.15   (settle = 1.393 × d, overshoot 0.6 %) - also used for interactive (b .14) */
--lgs-ease-b15: linear(0, .006 1.3%, .024 2.7%, .054 4.2%, .093 5.7%, .188 8.7%, .518 18.2%, .613 21.4%, .696 24.5%, .767 27.7%, .825 30.9%, .872 34.1%, .913 37.6%, .945 41.4%, .970 45.6%, .988 50.3%, 1.000 55.8%, 1.006 67.9%, 1);
/* bounce 0.20   (settle = 1.349 × d, overshoot 1.5 %) */
--lgs-ease-b20: linear(0, .006 1.3%, .025 2.8%, .056 4.3%, .099 6.0%, .199 9.2%, .536 18.9%, .633 22.0%, .717 25.2%, .785 28.2%, .844 31.4%, .894 34.7%, .933 38.1%, .964 41.7%, .987 45.7%, 1.003 50.3%, 1.012 55.3%, 1.015 64.8%, 1);
/* bounce 0.25   (settle = 1.274 × d, overshoot 2.8 %) */
--lgs-ease-b25: linear(0, .007 1.5%, .026 3.0%, .058 4.7%, .104 6.5%, .207 9.8%, .556 20.0%, .656 23.4%, .739 26.5%, .806 29.5%, .865 32.7%, .913 35.9%, .952 39.2%, .983 42.9%, 1.005 46.7%, 1.019 50.9%, 1.027 55.8%, 1.027 63.8%, 1);
```

Fallback `cubic-bezier()` least-squares fits, for the rare place a `linear()` cannot go:

| Bounce | Fit | RMS error | Max error |
|---|---|---|---|
| 0 (fit capped at y ≤ 1) | `cubic-bezier(.327, .692, .114, 1)` | 1.1 % | 3.5 % |
| 0.15 | `cubic-bezier(.311, .589, .077, 1.118)` | 1.1 % | 3.1 % |
| 0.20 | `cubic-bezier(.330, .632, .076, 1.138)` | 1.2 % | 3.4 % |
| 0.25 | `cubic-bezier(.344, .630, .084, 1.171)` | 1.4 % | 3.5 % |

The Phase 1 tokens `--lgs-spring: cubic-bezier(.2,.9,.25,1.15)` at 140/220/320 ms are replaced by these.

### 3.4 Choreography rules

- **C1 Two channels.**
  - The glass channel covers lensing, frost, tint, rim, shadow and shape.
  - The content channel covers Steam's pixels: opacity, a small blur and a small offset.
  - Small-glass entrance: glass 0–92 %, content 35–100 % with σ 8 → 0 px (CSS `filter: blur(calc(8px * (1 - c)))`).
  - Small-glass exit: content 100 → 0 % over the first 55 % of the time, then the glass dissolves linearly to 100 %.
  - [community, 120 fps capture]
- **C2 Scale rides the glass channel.** The swell/settle scale has no curve of its own. It is `s = s0 + (1 − s0) · g`, so the surface reaches full size and full strength together [community].
- **C3 Scale depends on size** [ours]. `s0 = 1 + clamp(12 px / maxSide, 0.01, 0.15)`. That is 1.15 for ≤ 80 px, 1.04 for 300 px and 1.01 for windows. Small glass swells on entry (Apple's measured 1.15). Large surfaces use at most 1–2 %, because a 1 m panel growing 15 % (≈ 15 cm) toward the eyes reads as looming.
- **C4 Pointer and gamepad subduing** [official direction, ours values].
  - Press swell is a third of touch: +6 px on the longest side, capped at ×1.06, against about +17 pt on touch.
  - Bounce is at most 0.2 (against 0.3–0.5 on touch).
  - Gel stretch is at most 5 % (against ≤ 20 %).
  - No gel at all for gamepad.
- **C5 Retarget, never queue.** A new target starts from the current value (and velocity, where JS or C++ runs the spring). Holding the D-pad (8–12 focus moves per second) must look like a steadily moving highlight, not a backlog.
- **C6 Never block.** The action fires on release (laser) or on A-down (gamepad, Steam's behaviour). No control is disabled while an animation runs, and no transition layer intercepts input.
- **C7 Nothing at rest.** No idle shimmer, pulse or breathing. Steam's own `Blinker` focus pulse (1.2 s × 20) stays neutralised.
- **C8 Reduce Motion** [official HIG Accessibility list]:
  - Bounce goes to 0 ("tightening animation springs to reduce bounce effects").
  - Scale, translate and depth changes become fades ("replacing transitions in x-, y-, and z-axes with fades"; "avoiding animating depth changes in z-axis layers").
  - No content blur ramps ("avoiding animating into and out of blurs").
  - Drags track the input directly.
  - Materialize becomes a plain cross-dissolve of 150–200 ms. A fade is not motion; Apple keeps it.
  - **Correction to Phase 1:** `prefers-reduced-motion` must not set every duration to 1 ms. It keeps fades and removes motion.

### 3.5 Comfort rules specific to the headset

- **M1** No lateral slide longer than 24 px (≈ 18 mm) of any surface wider than 600 px. Use fade + ≤ 16 px parallax [official: "Consider using fades when you need to relocate an object"; "increase the object's translucency" for large moving objects].
- **M2** No motion that starts in the periphery. Toasts appear in place, without a slide-in [official HIG Motion visionOS].
- **M3** No oscillation that lasts. Every bounce settles in less than one visible cycle: b ≤ 0.25 gives a single overshoot of at most 2.8 %. Nothing repeats near 0.2 Hz [official].
- **M4** Depth changes are ≤ 20 mm and use `depth` (b = 0). Text never gets depth of its own; it rides its glass [official: "Never give text depth"].
- **M5** World-anchored. Animations never move the window or rotate anything.

---

## 4. Interaction spec

### 4.1 Matrix

"In" and "out" are CSS durations (the settle time) with the easing token in brackets.

| Interaction | In | Out | Animates | Must not animate |
|---|---|---|---|---|
| Hover (laser) | 294 ms `hover-in` [b0] | 441 ms `fade` [b0] | Light spot at the hit point (follows the pointer directly), fill alpha | Scale, size, outline, blur radius, text |
| Press | 210 ms `interactive` [b15] | — | Inner glow spreading from the hit point; glass swell (glass controls only, ≤ ×1.06); fill brightness | Position, layout, rows/cards scale, backdrop blur |
| Release | Glow off 90 ms linear | Swell back 488 ms `snappy` [b15] | Glow, scale | Delaying the action until the animation ends |
| Focus move (gamepad) | 294 ms `hover-in` [b0], instant first frame ≥ 60 % | 441 ms `fade` [b0] | Illumination (fill + inner glow), glass "lift" look, content-card z +8 mm (native) | Travel of a focus indicator between items, bounce, delay, scale of rows/toolbar buttons |
| Selection change (segmented, tabs) | Pill travel 488 ms `snappy` [b15]; lift 210 ms `interactive` | Settle 488 ms `snappy` | Pill position and width; pill "lifted into glass" while moving; velocity stretch ≤ 5 % (pointer only); label colour swap at t90 | Tab labels, tab sizes, layout, bounce > 0.15 |
| Menu open (morph from source) | 607 ms `morph-open` [b20] | — | Shape (rect and radius from source button to menu), thickness θ, glass channel, content 15–50 %, z from button depth to menu depth | Content scale (text never scales), source button position, menu item layout |
| Menu close | — | 441 ms `morph-close` [b0] | Content out by 40 %, shape back into the source, small "catch" bump on the source (×1.03) | Input capture by the closing menu |
| Popover | As menu | As menu | As menu | As menu |
| Sheet present | 735 ms `sheet-in` [b0] | — | Glass channel on the sheet spring, scale 0.97 → 1 (or morph from source), content 25–70 %, parent scrim 0 → 35 % over 441 ms, sheet z +30 → +50 mm (native) | Slide from a screen edge, parent position or scale (CSS), blur radius ramps on large areas in CSS |
| Sheet dismiss | — | 514 ms `sheet-out` [b0] | Content out first (0–40 %), glass dissolves, scale → 0.98, scrim → 0 | Swell of large surfaces toward the viewer |
| Alert | Morph from source if known; else materialize 250 ms + `snappy` swell 1.02 → 1 | Dematerialize 250 ms | Glass channel, scrim 0 → 35 %, small swell | Shake, bounce > 0.15, delay before buttons are focusable |
| Toast in | Materialize 250 ms + translate −8 → 0 px `snappy` | — | Glass channel, content 35–100 %, swell `1 + 12/maxSide` | Slide-in from off-screen (Steam's 300 px), attention pulses |
| Toast out | — | Dematerialize 350 ms | Content out by 55 %, glass dissolves, swell | Sliding away across the view |
| Window open / close | Glass ramp 735 ms `sheet-in` (glassd, geometry fixed) | Glass dissolve 300 ms, after content | Lensing, frost, tint, rim (glassd); content per SteamVR | Window position, rotation, scale > 1 % |
| Page / route | Content fade + 16 px parallax 662 ms `page` [b0], 0–60 ms delay | Old content fade 150 ms linear, no motion | Opacity, ≤ 16 px translate in the navigation direction; persistent chrome morphs its contents | Full-width slides, zoom > 1.5 %, 3D, delays > 60 ms, re-animating persistent chrome |
| Scroll edge | Scroll-linked (0 → 24 px of scroll) | Scroll-linked | Edge-effect opacity | Blur radius, edge height, stacking two edge effects |
| List insertion | 441 ms `fade` + translate 8 → 0 px; stagger 30 ms, ≤ 5 rows | Removal instant | Opacity, small translate of really new rows | Height, margins, re-animation of virtualised rows on scroll |
| Toggle | Knob lift 210 ms `interactive`, travel 488 ms `snappy`, settle 488 ms `snappy` | — | Knob translate (Steam's), knob scale ×1.3/×1.2, knob fill white → glass → white, track colour at t50 | Track size, bounce > 0.15, lift under Reduce Motion |
| Slider drag | Thumb lift 210 ms `interactive` | Thumb settle 488 ms `snappy` | Thumb scale ×1.25, thumb glass look, value = pointer (no easing), stretch ≤ 5 % from velocity | Easing on the value during a drag, track size, glass thumb at rest |
| Tab bar minimize | **Not adopted** (see §4.18) | — | — | — |
| Tooltip / reveal on hover | After 0.8 s, materialize 250 ms | 0.2 s, dematerialize 350 ms | As toast | Revealing instantly [official WWDC24] |

### 4.2 Hover (laser pointer)

- **Apple.**
  - visionOS draws a soft highlight under the gaze, "instant" for feedback [official, WWDC25-303].
  - Hover goes "only on interactive elements" [official].
  - "Avoid scale effects on high-use views like toolbar buttons and table cells" [official, bible].
  - Effects that reveal content wait 0.8 s in and 0.2 s out [official sample, WWDC24-10152].
  - A scale effect "provides immediate feedback, so it should apply immediately" (1.05 in the sample, for content-like elements).
- **Spec [ours].**
  - **Light spot:** a radial gradient centred on the laser hit point, radius 1.5 × the shorter side, peak white +8–12 % additive (`plus-lighter`). It follows the pointer directly, or through `interactive` smoothing to hide laser jitter.
  - **Fill:** up to `--lgs-hover-fill`.
  - **Timing:** in `hover-in` (294 ms, b0), out `fade` (441 ms).
  - **Content cards** (game capsules, screenshots): no hover scale from us. Steam's own focus scale already plays when the laser focuses them.
- **Must not.** Scale on controls or rows, outlines, size or weight changes, `backdrop-filter` changes.
- **Reduce Motion.** Unchanged; the light spot is feedback, not motion.
- **Tier.**
  - T1: a static centred glow fades in, with no pointer tracking.
  - T2: a document-level `pointermove`, throttled to animation frames, writes `--hx/--hy` on the hovered glass element (§6.4).
  - glassd: `uPressPos` with `uHover`.

### 4.3 Press and release

- **Apple.**
  - "Illuminates from within… starting right under your fingertips, the glow spreads throughout the element and onto any Liquid Glass elements nearby" [official].
  - Interactive glass "scales, bounces, and shimmers" [official].
  - Measured on touch: glow about 150 ms up and gone about 60 ms after lift-off; the longest side grows about 17 pt; elongation ≤ 5 % [community].
- **Spec [ours].**
  - **Press-in (`interactive`, 210 ms):**
    - The glow starts at the hit point (laser) or the centre (gamepad A). Its radius grows from 0.5× to 1.5× the shorter side. Peak white +15 % additive plus a uniform +6 % brighten.
    - Glass controls swell by +6 px on the longest side, capped at ×1.06.
    - Content-layer items (rows, list cells, cards) do not swell; they brighten to `--lgs-pressed-fill`.
    - Neighbouring glass in the same group gets 25 % of the glow (glassd only; skip in CSS).
  - **Release:** the glow drops linearly over 90 ms and the scale returns on `snappy` (488 ms, b 0.15). The action fires immediately.
  - **Gel (pointer only, T2/glassd):** if the laser moves while pressed, stretch along the drag by up to 5 %, using `tanh` resistance as in Kyant's button (`offset = maxOffset · tanh(0.05 · d / maxOffset)`). No gel for gamepad.
- **Must not.** Shrink on press. Phase 1's `--lgs-pressed-scale: .97` contradicts Liquid Glass, whose glass grows, and is replaced. Also not: move the element, wait for the animation, or bounce over 0.2.
- **Reduce Motion.** Glow only (no spreading radius); no swell, no gel.
- **Tier.**
  - Laser: `:active` works in CEF.
  - Gamepad A has no `:active`. T2 must observe Steam's gamepad button events on the focused element. To verify: whether Steam dispatches DOM events such as `vgp_onbuttondown`/`vgp_onbuttonup` that a listener can use to toggle `lgs-pressed`.

### 4.4 Focus move (gamepad and Steam's focus model)

- **Apple.**
  - tvOS: a focused item "visually stands out… through elevation to the foreground, illumination, and animation". When chosen it gives "instant visual feedback" [official, HIG Focus].
  - In tvOS 26, "standard buttons and controls take on a Liquid Glass appearance when focus moves to them" [official, Adopting Liquid Glass].
  - visionOS uses the same focus system for controllers [official].
- **Spec [ours].**
  - **Focus-in:** the focused control "lifts into glass": illumination (`--lgs-focus-fill` plus an inner glow), its specular arc brightens by 1.5×, and the darkened edge deepens.
    - The first frame must already show at least 60 % of the final contrast. Use a step: set `--focus` straight to 0.6, then transition to 1 on `hover-in` (294 ms). Focus must never be invisible, even during auto-repeat.
  - **Focus-out:** `fade` (441 ms). The short trail shows the direction of travel.
  - **Content cards:** Steam's own scale-up plus, in the native tier, z +8 mm on `depth` (441 ms). Under Reduce Motion the z change is applied, not animated (§7).
  - **No travelling indicator** between list or grid items. Both ends cross-fade. Exception: selection pills (§4.5).
- **Must not.** Bounce, delay, scale on rows or toolbar buttons [official visionOS guidance], blinking.
- **Steam specifics.**
  - Steam paints focus with `ItemFocusAnim-*` keyframes (`forwards`). Animated values beat declarations, so focus styles need `!important` (LAB.md).
  - Our own registered `--focus` transition must be on our layer (`::after`) so Steam's keyframes do not override it.

### 4.5 Selection change: segmented control, tab bar, library tabs, sidebars

- **Apple.**
  - Switch and segmented "thumbs… automatically have a new liquid glass appearance for interactions" [official].
  - Community recreations lift the tab pill to ×1.39 and make it clear glass while pressed or dragged. Values travel on a critically damped 0.2 s spring; release uses `snappy` 300–350 ms.
- **Spec [ours].**
  - **Travel:** the pill's x and width move on `snappy` (488 ms, b 0.15).
  - **Lift during travel:** for the first t90 (≈ 180 ms) the pill renders as clear glass (white fill 0.94 → 0.30, rim ×1.5, scale 1.06 × 1.12), then settles back to the white selected fill.
  - **Velocity stretch:** ≤ 5 % along the travel, laser only.
  - **Label colours:** the old label goes white and the new label dark at t90 (178 ms), cross-fading over 120 ms. Labels never move.
  - **Bumpers (L1/R1):** same animation. Tab content follows §4.13.
- **Must not.** Move or resize the tabs, reflow, bounce > 0.15. The pill is decoration and never takes input.
- **Reduce Motion.** No travel: the old pill fades out and the new one fades in (`fade`).
- **Tier.**
  - SteamVR's settings already slide a `::after` pill (coverage/steamvr.md): restyle it.
  - Steam's gamepad tabs need a T2 decorative node positioned from the selected tab's rect (§6.4).
  - In the native tier the lifted pill is drawn by glassd inside the tab bar's slab (§9).

### 4.6 Menu open and close: morph from source

Steam menus covered here: context menus, dropdowns, "+ > Launch Program", Quick Access, frame menus and game-page menus.

- **Apple.**
  - "The bubble simply pops open to reveal the content… keeps everything right where you just tapped" [official].
  - "The button morphs into the overlay" [official].
  - Glass grows thicker as it grows (§2.3).
  - Measured on touch: one spring with d 0.57 and b 0.27, about 5 % path overshoot, the source shrinking over the first 40 %, a metaball neck between source and menu, and a "catch" bump on close [community].
- **Spec, open (`morph-open`, 607 ms, b 0.2):**
  - **Shape:** from the source button's rect and radius (capsule `h/2`) to the menu's rect and radius (`--lgs-r-menu`, 20 px).
    - The anchor corner is the one nearest the source.
    - In glassd, smooth-union the source and growing shapes over the first 40 % (k ≈ 24 Steam px), so a short liquid neck forms and breaks.
  - **Material:** θ follows the shape size.
  - **Content:** opacity 0 → 1 over 15–50 % of the time (≈ 90–300 ms), with no scale. Text must never scale.
    - Items pass 50 % opacity at about 200 ms. Steam moves gamepad focus into the menu at once; the focused item's illumination appears with the content.
    - Items accept input from the first frame, as in stock Steam. The animation never disables them.
  - **Depth (native):** from the button's dz (≈ 15 mm) to the menu's dz (30 mm) on the same spring.
- **Spec, close (`morph-close`, 441 ms, b 0):**
  - Content opacity 1 → 0 over the first 40 %.
  - The shape returns into the source rect.
  - At arrival the source gives a ×1.03 bump on `snappy` [community "takes the hit", subdued].
  - The closing menu must not intercept input. Steam removes the DOM, so in CSS the close is instant (§6.3). glassd can still play the glass part.
- **Must not.** Scale content, move the source, animate item layout, or use CSS blur-radius ramps on large menus.
- **Reduce Motion.** Cross-fade the menu in place (`fade`, 150–200 ms). No shape morph and no z animation.
- **Cross-quad note.** Bar popups are separate overlays from the bar. A true morph from the "+" button into the popup is possible only in glassd, with one slab placed over the union of both world rects. Otherwise the popup materializes at its own position, with its scale origin at the edge nearest the "+" button.

### 4.7 Popover

Treat it like a menu (§4.6). If the popover covers more than 40 % of the window, treat it as a sheet (§4.8).

### 4.8 Sheet present and dismiss

Steam surfaces covered: modal dialogs, properties, the controller and settings sheets.

- **Apple.**
  - iOS: partial sheets are inset glass; at full height "the glass background gradually transitions, becoming opaque" [official].
  - Sheets can "morph out of buttons that present them" (zoom transition) [official].
  - On a focus shift, glass "subtly recedes, becoming more opaque and gently growing in size" [official].
  - visionOS: sheets open centred at the parent's depth, and the parent pushes back and dims [official, bible].
- **Spec, present (`sheet-in`, 735 ms, b 0):**
  - **Glass:** rides the spring (C2). Scale 0.97 → 1. If the source button is known (T2), morph from it as in §4.6 instead.
  - **Content:** 25–70 % of the time.
  - **Parent:** scrim 0 → 35 % on `fade` (441 ms). The 35 % follows Apple's dimming number.
  - **Native:** the sheet's popped crop and slab go from dz +30 to +50 mm on `depth`. The parent mosaic stays at its depth. The relative depth carries the push-back without moving Steam's real panel.
- **Spec, dismiss (`sheet-out`, 514 ms):**
  - Content out over the first 40 %.
  - The glass dissolves on the spring and scales to 0.98. Large surfaces never swell toward the viewer.
  - Scrim → 0 on `fade`.
- **Must not.** Slide in from an edge (in VR there is no screen edge, and a large slide is large-object motion), scale or blur the parent window in CSS, or ramp `backdrop-filter` radius on a large sheet in CSS.
- **Reduce Motion.** Cross-dissolve 200 ms. Scrim fades. No scale and no z animation.

### 4.9 Alert

Steam surfaces covered: confirm dialogs and small modals.

- **Apple.** "Dialogs also automatically morph out of the buttons that present them" [official]. Alerts use bolder, left-aligned type [official].
- **Spec.**
  - If the source is known, use the menu morph (§4.6).
  - Otherwise materialize centred: glass channel 250 ms linear, scale 1.02 → 1 riding the glass (C2/C3 for a 600 px surface), content 35–100 %, scrim 0 → 35 % on `fade`.
  - The default button is focusable and illuminated as soon as the content passes 50 % (~170 ms).
  - Dismiss: dematerialize over 250 ms, with content out by 55 %.
- **Must not.** Shake, bounce > 0.15, or disable buttons during the entrance.

### 4.10 Toast in and out

Steam surfaces covered: Steam notification toasts, SteamVR toasts and the volume HUD.

- **Steam today.** `translateX(300px → 0)` over 300 ms, which is ≈ 23 cm of lateral motion near the edge of view, then an opacity exit (inventory/hud.md).
- **Spec.**
  - **In:** materialize in place (250 ms). Content runs 35–100 %, swell `1 + 12/maxSide` (≈ 1.04 for a 300 px toast), and at most 8 px of translate from the direction of its anchor on `snappy`.
  - **Out:** dematerialize over 350 ms. Content is gone by 55 % and the glass dissolves to the end, with the same small swell.
  - visionOS 27 expands notifications on look. Expanding on laser hover is a candidate [press; ours: optional].
- **Must not.** Slide-ins, attention pulses, bounce > 0.15.
- **Steam specifics.**
  - CSS transitions do not advance in the hidden notifications window (coverage/hud.md). Use `@keyframes` on mount, which start when the window renders, and verify with a filmstrip (§10).
  - Steam's toast children run `animation: toastEnter, toastExit`. The exit is delayed by `var(--toast-duration)` and uses `fill-mode forwards`.
    - Our entrance must be **added to that list** in place of `toastEnter`, keeping `toastExit` with Steam's own timing.
    - Replacing the whole `animation` would stop the toast from ever fading out.
    - Read the real (possibly hashed) keyframe names from the live stylesheet first.

### 4.11 Window open and close (materialize and dematerialize)

- **Apple.** Glass materializes "by gradually modulating the light bending and lensing" [official]. UIKit: setting the effect inside an animation block "results in a materialize animation" [official, WWDC25-284].
- **Glass Shell reality.** SteamVR owns the dashboard's show and hide. Neither CSS nor glassd can delay Steam's content.
- **Spec (glassd).**
  - When a surface becomes visible, ramp its cover's glass on `sheet-in` (735 ms), with geometry fixed and the ramp order of §9.
  - On hide, if the scene-graph nodes survive the parent's hide, let the glass dissolve over 300 ms after the content is gone. This is Apple's exit order, content first and then glass.
  - If the nodes do not survive, hide them instantly.
  - To verify: whether `reparent-to-panel` children stay visible for one frame after the parent overlay hides.
- **Must not.** Move, rotate or scale the window by more than 1 %.

### 4.12 Page and route transitions

- **Steam today** (inventory/shell.md, library.md):
  - Route enter: `opacity 0 + scale(.95) → 1` over 600 ms `cubic-bezier(0,0,.1,1)`, after a **200 ms delay**.
  - Route exit: 200 ms ease-in to `scale(.95)`.
  - Tab content: `translateX(±40%)` + opacity over 320 ms, after an 80 ms delay.
  - In the headset, the 0.95 zoom moves the window's edges by about 2.5 cm, and the 40 % slide moves about 40 cm of panel.
- **Apple.** Controls "dynamically morph between the controls in each context… a singular floating plane" [official]. visionOS: fade large moving objects [official].
- **Spec [ours].**
  - **New content:** opacity 0 → 1 with `translate ±16 px` in the navigation direction (forward = from the right, back = from the left, tab N → N+1 = from the right), on `page` (662 ms). The entrance delay is 0–60 ms.
  - **Old content:** opacity to 0 over 150 ms linear, with no motion.
  - **Persistent chrome** (header capsules, tab bars, footer legend, bar): never re-animates. If its contents change, widths morph on `snappy` and labels cross-fade over 150 ms.
- **Must not.** Full-width slides, zoom above 1.5 %, 3D, delays above 60 ms, or animating chrome that did not change.
- **Reduce Motion.** Cross-fade only (`fade`).
- **Implementation risk.** Steam's React transition groups probably end each phase on a timeout. Keep our durations at or below Steam's (enter ≤ 800 ms total, exit ≤ 200 ms) so nodes are not removed mid-animation (§6.4 R10).

### 4.13 Scroll edge effect

- **Apple.**
  - "A subtle blur and fade effect applied to content under system toolbars". Soft is the default; hard is "a more opaque, clearly defined linear boundary" for dense UIs and pinned headers.
  - "Avoid mixing or stacking them"; use one per view.
  - Over dark content the effect "switches to apply a subtle dimming instead" [official, WWDC25-219/323/356, `ScrollEdgeEffectStyle`].
  - It replaces bar backgrounds: "remove any extra backgrounds or darkening effects behind the bar items" [official].
- **Spec.**
  - **Shape:** a band under each floating header, of height (bar height + 16 px). It has a progressive `backdrop-filter: blur(10–12px)` masked by `linear-gradient(#000 40%, transparent)`, plus a dimming gradient from black 30 % to 0. Steam content is dark, so dimming dominates.
  - **Appearance:** scroll-linked. Opacity goes 0 → 1 over the first 24 px of scroll, so the effect exists only when content is under the bar. No time-based animation.
  - **Hard variant:** for pinned column headers (downloads, friends list headers). An 85 % opaque band with a 1 px soft fade.
- **Must not.** Animate the blur radius or height, or stack header and sub-header effects.

### 4.14 List insertion

Steam surfaces covered: downloads, notifications, friends, chat.

- **SwiftUI default.** Insertion animates opacity and row height on the default spring [inferred from the `default` docs].
- **Spec.** Really new rows go opacity 0 → 1 with `translate 0 8px → 0` on `fade` (441 ms). Several new rows stagger by 30 ms, capped at 5 rows (150 ms). Removal is instant.
- **Must not.** Animate height, margins or neighbours; that breaks virtualisation and focus geometry.
  - **Never put mount animations on virtualised rows.** Steam mounts rows while scrolling, so the animation would replay on every scroll.
  - Only T2, using a MutationObserver that compares item keys, can tell a real insertion from a virtualisation mount. Without T2, insertions are not animated.

### 4.15 Toggle

- **Apple.** The switch thumb "has a new liquid glass appearance for interactions" [official]. Community recreations:
  - knob ×1.5 while pressed, with gel springs X (0.6, 250) and Y (0.7, 250);
  - knob fill from white to clear glass;
  - value travel critically damped in 0.2 s.
- **Spec [ours, subdued].**
  1. **Lift** (`interactive`, 210 ms): knob ×1.3 wide, ×1.2 high. Fill goes from white 1.0 to 0.35, with rim and specular ×1.5.
  2. **Travel:** Steam's own knob translation with our `snappy` timing.
  3. **Track colour:** cross-fades at t50 (≈ 90 ms after travel starts).
  4. **Settle:** back to ×1 and opaque white on `snappy`.
  5. **Total:** ≈ 450 ms.
- **Must not.** Change the track size or bounce above 0.15.
- **Reduce Motion.** No lift. The knob jumps; the track colour fades over 150 ms.
- **Tier.**
  - Laser `:active` can drive the lift.
  - A gamepad toggle shows only as a state-class flip. A CSS animation keyed to the state would also play on every mount, so the lift needs T2: a MutationObserver on the checked state adds `lgs-anim` for 500 ms.

### 4.16 Slider drag

- **Apple.** The thumb takes on glass during interaction. Sliders "preserve momentum and stretch when they are moved" [official].
- **Spec [ours].**
  - **Grab:** the thumb lifts into glass (×1.25, clear-glass look, rim ×1.5) on `interactive`.
  - **Drag:** the value and the filled track follow the laser **directly**, with no easing ("tracking animations directly with people's gestures" [official HIG Accessibility]). Stretch is ≤ 5 % from velocity (T2 only).
  - **Release:** the thumb settles to white ×1 on `snappy`. No momentum overshoot of the *value*; precision matters more than the momentum flourish in a headset.
  - **Gamepad left/right steps:** each step animates the thumb on `interactive` and retargets on auto-repeat. Lift while stepping; settle 300 ms after the last step (T2).
- **Must not.** Lag the value behind the pointer, change the track size, or show a glass thumb at rest.

### 4.17 Tooltip and reveal-on-hover

- Delay 0.8 s in and 0.2 s out [official sample].
- Materialize and dematerialize as for small glass.
- Steam's tooltip has its own delay; keep it and add only the materialize (Phase 1 already materializes on mount).

### 4.18 Tab bar minimize: not adopted

- iOS minimizes the tab bar on scroll down and expands it on scroll up [official]. visionOS window chrome stays static [press, MacStories].
- NN/g lists "controls shift unpredictably" among Liquid Glass's usability failures, and the bible's checklist says "Nothing collapses or hides just for looks".
- In a 1 m window, chrome does not compete with content for screen space, and a moving header would move gamepad focus targets.
- **Decision [ours]:** do not minimize chrome. A scroll-linked edge effect (§4.13) is the only scroll response.

---

## 5. Steam's motion today against this spec

| Steam motion (from the inventories) | Today | Spec | Change |
|---|---|---|---|
| Route enter | `opacity` + `scale(.95→1)`, 600 ms `cubic-bezier(0,0,.1,1)`, 200 ms delay | Fade + ≤ 16 px parallax, `page` 662 ms, delay ≤ 60 ms | Override `Enter`/`EnterActive` timing and transform (§6.4 R10) |
| Route exit | `scale(.95)` + fade, 200 ms ease-in | 150 ms fade, no scale | Override `ExitActive` |
| Library tab content | `translateX(±40%)`, 320 ms, 80 ms delay | ±16 px + fade, `page` | Override `GamepadTabbedPage` Enter |
| Context menu | `BasicContextMenuContainer` opacity + scale, .5 s, fill-mode both | Morph from source, `morph-open` | Replace the entrance animation (§6.4 R3) |
| Modal dialog | `animation: <fade> .5s` | `sheet-in` with materialize | Replace |
| Toast | `translateX(300px→0)` 300 ms; opacity exit | Materialize in place; dematerialize | Replace the enter keyframe; keep the exit timing hook |
| Focus fills | `ItemFocusAnim-*` keyframes, instant | Illumination, `hover-in` / `fade` | Keep Steam's state; add our illumination layer with `!important` colours |
| Focus ring | `Flash .5s`, `GrowOutline .4s`, `FadeOutline .4s`, `Blinker 1.2s ×20` | Static glow, no pulse | Already neutralised in Phase 1; keep |
| Field focus scale (QAM, settings) | `transform .32s` | Keep (Steam-owned) | None |
| Dashboard menu width | `width .32s` | `snappy` timing | Optional: override the timing function only |
| Avatar bounce | `transform .34s` | OK (small, user-driven) | None |
| SteamVR frame controls | Idle dim `opacity .4s` | OK | None |
| SteamVR grab bar | `scaleX` .08 s | OK | None |

---

## 6. CSS implementation in Steam's CEF (Chromium 126)

### 6.1 What Chromium 126 has

| Feature | Since | Use here |
|---|---|---|
| `linear()` easing | 113 | Exact springs (§3.3) |
| `@property` (registered custom properties, animatable) | 85 | One progress value drives many channels (materialize, morph, focus) |
| Individual `scale` / `translate` / `rotate` | 104 | Animate without touching Steam's `transform` |
| `@starting-style`, `transition-behavior: allow-discrete` | 117 | Entrance transitions on mount for our own nodes |
| Scroll-driven animations, `timeline-scope` | 115 / 116 | Scroll edge effect (§4.13) |
| `backdrop-filter` incl. `url(#svg)` (Chromium only) | 76 | Glass; SVG lensing on a few small controls |
| Compositor-thread `backdrop-filter` and `filter` animations | crbug 965512 | Allowed one-shot, but each frame still costs a blur pass |
| `:has()`, CSS nesting, `@scope` | 105 / 112–120 / 118 | Selectors |
| `mix-blend-mode: plus-lighter` | 100 | Additive illumination |
| Anchor positioning | 125 | Decorative layers next to Steam nodes (resolved at layout; transitions do not fire on anchor changes) |
| View Transitions (same-document), `view-transition-class` and types | 111 / 125 | **Not recommended** (§6.5) |
| `prefers-reduced-motion`, `prefers-contrast` | — | Steam's Reduce Motion and High Contrast map here (LAB.md) |
| `prefers-reduced-transparency` | 118 | Harmless to support; SteamOS will not set it, so the dial is the real control |
| **Not in 126:** `calc-size()` / `interpolate-size` (129), `corner-shape: squircle` (139), `sibling-index()` (138), `if()` (137), element-scoped view transitions | — | Animate height with `clip-path` or `scale`. Continuous corners need a static SVG mask or must be approximated with circular radii |

### 6.2 Proposed motion tokens (for `theme/00-tokens.nowrap.css`, owned by Foundation)

```css
/* Set and transitioned on our own pseudo-elements (§6.4), so they need not inherit.
   If a value is ever set on the host instead, it must be `inherits: true`: a pseudo-element
   does not inherit a non-inheriting registered property. */
@property --lgs-hover { syntax: "<number>"; inherits: false; initial-value: 0; }
@property --lgs-press { syntax: "<number>"; inherits: false; initial-value: 0; }
@property --lgs-focus { syntax: "<number>"; inherits: false; initial-value: 0; }

html.lgs-on {
  /* easings: one per bounce (§3.3); paste the full linear() strings */
  --lgs-ease-b0:  linear(0, .005 1.2%, .020 2.3%, .084 5.2%, .159 7.7%, .461 16.9%, .556 20.2%, .639 23.5%, .709 26.9%, .767 30.2%, .817 33.7%, .861 37.6%, .900 42.1%, .930 46.9%, .954 52.4%, .971 58.6%, .991 73.8%, 1);
  --lgs-ease-b15: linear(0, .006 1.3%, .024 2.7%, .054 4.2%, .093 5.7%, .188 8.7%, .518 18.2%, .613 21.4%, .696 24.5%, .767 27.7%, .825 30.9%, .872 34.1%, .913 37.6%, .945 41.4%, .970 45.6%, .988 50.3%, 1.000 55.8%, 1.006 67.9%, 1);
  --lgs-ease-b20: linear(0, .006 1.3%, .025 2.8%, .056 4.3%, .099 6.0%, .199 9.2%, .536 18.9%, .633 22.0%, .717 25.2%, .785 28.2%, .844 31.4%, .894 34.7%, .933 38.1%, .964 41.7%, .987 45.7%, 1.003 50.3%, 1.012 55.3%, 1.015 64.8%, 1);
  /* durations = settling time of the spring (§3.2) */
  --lgs-d-interactive: 210ms;  /* d .15 b .14 -> b15 curve */
  --lgs-d-hover-in:    294ms;  /* d .20 b 0 */
  --lgs-d-fade:        441ms;  /* d .30 b 0 */
  --lgs-d-snappy:      488ms;  /* d .35 b .15 */
  --lgs-d-morph-open:  607ms;  /* d .45 b .20 */
  --lgs-d-morph-close: 441ms;  /* d .30 b 0 */
  --lgs-d-sheet-in:    735ms;  /* d .50 b 0 */
  --lgs-d-sheet-out:   514ms;  /* d .35 b 0 */
  --lgs-d-page:        662ms;  /* d .45 b 0 */
  --lgs-d-mat-in:      250ms;  /* linear channels, small glass */
  --lgs-d-mat-out:     350ms;
  --lgs-press-grow: 6;         /* CSS px added to the longest side, unitless so it can be divided
                                  (Chromium 126 has no typed division). Touch would be ~17 pt */
  --lgs-press-max:  1.06;
}

@media (prefers-reduced-motion: reduce) {
  html.lgs-on {
    --lgs-ease-b15: var(--lgs-ease-b0);    /* no bounce */
    --lgs-ease-b20: var(--lgs-ease-b0);
    --lgs-press-grow: 0;                   /* no swell, no gel, no travel; fades stay */
    --lgs-d-mat-in: 180ms; --lgs-d-mat-out: 180ms;
  }
}
```

### 6.3 Rules and gotchas specific to Steam's CEF

- **R1 Never fade a parent of glass.** An ancestor with `opacity < 1` (also `filter`, `mask`, `clip-path`, `mix-blend-mode` or `will-change: opacity`) is a backdrop root. The glass inside then blurs only the faded subtree, looks flat during the fade and pops back when the fade ends. The Flutter recreation hit the same thing ("a glass backdrop pass renders fully or not at all, so fading the layer pops").
  - Fade the glass element itself (its own `opacity` applies after its backdrop), or ramp its own `backdrop-filter`, background and `scale` in keyframes (§6.4).
  - Content children may fade freely.
  - Phase 1 already documents Steam's backdrop roots (coverage/shell.md, coverage/primitives.md).
- **R2 Steam's keyframes beat our declarations and transitions.** `ItemFocusAnim-*`, menu entrance animations and route classes animate `background`, `opacity` and `transform`. Put our motion on our own pseudo-elements and registered properties, and use `!important` for focus and selected colours (LAB.md). An `!important` declaration also cancels a transition on that property.
- **R3 Replace an entrance animation only by naming a new one** on the same element.
  - Never stack `transform` animations. Use the independent `scale` and `translate` properties, which compose with Steam's `transform`.
  - Setting `animation` or `transition` replaces Steam's whole list on that element. Repeat any Steam entries that carry function, such as a delayed exit or a focus colour, in our list.
- **R4 Exits need DOM.** When Steam removes a node, CSS cannot animate it out. In T1 exits are instant, except where Steam keeps exit state classes (`Exit`/`ExitActive`, toast `fill-mode forwards`). glassd can still dissolve the glass after the content has gone, which is Apple's own exit order.
- **R5 Mount animations replay on virtualised lists.** No `@keyframes`-on-mount on rows, grid cells or capsules. Mount animations are for overlays: menus, dialogs, toasts and tooltips.
- **R6 Transitions retarget without velocity.** CSS restarts from the current value with zero velocity, plus reversing-shortening when a transition exactly reverses. That is acceptable for hover and focus at these durations. Drag-coupled motion (slider thumb, gel) runs in JS (T2/T3) with the closed-form spring in §8.
- **R7 Hidden windows.** Transitions do not advance in a hidden notifications window (coverage/hud.md). Prefer `@keyframes` for toasts.
- **R8 Filter animations are now allowed, within limits.** LAB.md and DESIGN.md forbid `filter`/`backdrop-filter` animations. For Phase 2, amend the rule to allow one-shot materialize and dematerialize of `backdrop-filter`/`filter` on elements of at most 600 × 600 CSS px, ≤ 350 ms, never infinite, and only if `perf` during the transition shows no long frames (> 34 ms). Larger surfaces get their glass ramp from glassd.
- **R9 Clip-path morphs run on the main thread.** Chromium 126 does not composite `clip-path` animations, and custom-property animations restyle and repaint every frame. Use them for menu-sized elements only, and measure.
- **R10 Respect React's timeouts.** Transition-group components end phases on timeouts. When overriding Steam's route and tab classes, keep each phase at or below Steam's own total (enter ≤ 800 ms including delay, exit ≤ 200 ms).
- **R11 Leave nothing behind at rest.** A resting `filter: blur(0)`, `scale: 1`, `translate: 0 0` or `clip-path: inset(0)` is not `none`. Each one creates a stacking context and a containing block for Steam's `position: fixed` descendants. `filter` and `clip-path` also make a backdrop root. So:
  - Animations on Steam's nodes use `@keyframes` with `animation-fill-mode: backwards` (or no fill when the first keyframe equals the resting style). The element then returns to Steam's own style when the animation ends.
  - Never write channel formulas as normal declarations on Steam's nodes.
  - Custom-property formulas are fine on our own decorative layers.

### 6.4 Recipes

**Materialize and dematerialize (small glass: toasts, tooltips, chips, ornaments)** [C1, C2, C3]

This uses plain multi-property keyframes. `opacity`, `scale`, `filter` and `backdrop-filter` interpolate on the compositor when the filter function lists match. `backwards` fill means nothing is left on Steam's nodes at rest (R11).

```css
/* per component: --lgs-maxside as a plain number (CSS px), --lgs-mat-bg = its resting glass colour,
   --lgs-mat-blur = its resting backdrop-filter, written with the same function list as the 0% frame */
.lgs-mat { --s0: calc(1 + min(.15, 12 / var(--lgs-maxside, 80)));
  animation: lgs-mat-glass-in var(--lgs-d-mat-in) linear backwards; }
.lgs-mat > * { animation: lgs-mat-content-in var(--lgs-d-mat-in) linear backwards; }

@keyframes lgs-mat-glass-in {            /* glass channel: resolved by 92 %, scale rides it (C2) */
  0%        { scale: var(--s0); background-color: transparent;
              backdrop-filter: blur(0px) saturate(1); }
  92%, 100% { scale: 1; background-color: var(--lgs-mat-bg);
              backdrop-filter: var(--lgs-mat-blur, blur(22px) saturate(1.8)); } }
@keyframes lgs-mat-content-in {          /* content channel: 35-100 %, sharpens last */
  0%, 35%   { opacity: 0; filter: blur(8px); }
  100%      { opacity: 1; filter: blur(0px); } }

/* Exit, only where Steam keeps the node in an exit state (toast exit, Exit/ExitActive classes):
   content gone by 55 % of the time, glass dissolves to the end, swell outward. */
.lgs-mat.lgs-leaving       { animation: lgs-mat-glass-out var(--lgs-d-mat-out) linear forwards; }
.lgs-mat.lgs-leaving > *   { animation: lgs-mat-content-out var(--lgs-d-mat-out) linear forwards; }
@keyframes lgs-mat-glass-out {
  0%   { scale: 1; background-color: var(--lgs-mat-bg);
         backdrop-filter: var(--lgs-mat-blur, blur(22px) saturate(1.8)); }
  100% { scale: var(--s0); background-color: transparent; backdrop-filter: blur(0px) saturate(1); } }
@keyframes lgs-mat-content-out {
  0%        { opacity: 1; filter: blur(0px); }
  55%, 100% { opacity: 0; filter: blur(8px); } }

@media (prefers-reduced-motion: reduce) {     /* plain cross-dissolve: no scale, no blur ramps */
  .lgs-mat, .lgs-mat.lgs-leaving { animation-name: lgs-fade-in; animation-duration: var(--lgs-d-mat-in); }
  .lgs-mat > *, .lgs-mat.lgs-leaving > * { animation: none; }
  .lgs-mat.lgs-leaving { animation-name: lgs-fade-out; animation-fill-mode: forwards; }
}
@keyframes lgs-fade-in  { from { opacity: 0 } }
@keyframes lgs-fade-out { to   { opacity: 0 } }
```

- `--lgs-maxside` is a plain number because Chromium 126 cannot divide a length by a length.
- The ramps animate `backdrop-filter`, which R8 allows only for elements of at most 600 × 600 px, one-shot.
- The glass element's own `opacity` stays at 1. Only its children fade, so R1 holds.
- The audit must run after `getAnimations()` is empty.

**Morph from source (in-page menus and dropdowns)** [§4.6]

```css
.lgs-morph {                    /* the menu's glass box (backdrop-filter lives here) */
  /* source rect relative to this box; T2 sets them from the trigger's rect.
     T1 defaults: a 64 x 48 capsule at the top-left corner, Steam's usual anchor. */
  --sx: 0px; --sy: 0px; --sw: 64px; --sh: 48px; --sr: 24px;
  animation: lgs-morph-clip var(--lgs-d-morph-open) var(--lgs-ease-b0) backwards;
}
.lgs-morph > * { animation: lgs-morph-content var(--lgs-d-morph-open) linear backwards; }
@keyframes lgs-morph-clip {     /* clip shrinks from the menu box to the source rect at 0 % */
  from { clip-path: inset(var(--sy) calc(100% - var(--sx) - var(--sw))
                          calc(100% - var(--sy) - var(--sh)) var(--sx) round var(--sr)); }
  to   { clip-path: inset(0 0 0 0 round var(--lgs-r-menu)); } }
@keyframes lgs-morph-content { 0%, 15% { opacity: 0 } 50%, 100% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) {
  .lgs-morph { animation: lgs-fade-in 180ms linear backwards; }
  .lgs-morph > * { animation: none; }
}
```

- The clip uses the bounce-0 curve. A negative `inset()` overshoot is not dependable, and the pointer variant is subdued anyway. glassd draws the 1.5 % overshoot of the glass in the native tier.
- `backwards` fill removes the clip at rest, so Steam's submenus and shadows are never clipped afterwards (R11).

T2 fills `--sx…--sr`:

1. Keep the element that last received `pointerdown` or a gamepad activation.
2. On menu insertion (MutationObserver, which runs before the next paint), compute that element's rect relative to the menu box.
3. If the trigger is in another document or quad (bar popups), leave the defaults.

**Illumination layer (hover light, press glow, focus)** [§4.2–4.4]

```css
/* Only on elements Steam already positions (relative/absolute); never add `position` to a Steam node.
   Use whichever of ::before/::after Steam leaves free (Steam's FocusRing uses ::after).
   States and transitions live on OUR pseudo-element, so Steam's own `transition` list is untouched.
   T2 writes --hx/--hy on the host; unregistered custom properties inherit into the pseudo-element. */
.lgs-lit::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  mix-blend-mode: plus-lighter;
  --lgs-hover: 0; --lgs-press: 0; --lgs-focus: 0;
  transition: --lgs-hover var(--lgs-d-fade) var(--lgs-ease-b0),
              --lgs-press 90ms linear,
              --lgs-focus var(--lgs-d-fade) var(--lgs-ease-b0);
  background:
    radial-gradient(circle at var(--hx, 50%) var(--hy, 35%),
      rgb(255 255 255 / calc(.10 * var(--lgs-hover) + .15 * var(--lgs-press))) 0,
      transparent calc(50% + 100% * var(--lgs-press))),
    rgb(255 255 255 / calc(.06 * var(--lgs-press) + .14 * var(--lgs-focus))); }
.lgs-lit:hover::after   { --lgs-hover: 1; transition-duration: var(--lgs-d-hover-in), 90ms, var(--lgs-d-fade); }
.lgs-lit:is(:active, .lgs-pressed)::after
                        { --lgs-press: 1; transition-duration: var(--lgs-d-hover-in), var(--lgs-d-interactive), var(--lgs-d-fade); }
.lgs-lit.gpfocus::after { --lgs-focus: 1; transition-duration: var(--lgs-d-hover-in), 90ms, var(--lgs-d-hover-in); }
/* Glass controls swell; rows do not. `scale` rests at its initial `none` (nothing declared at rest, R11)
   and interpolates none <-> value. The transition list must repeat Steam's own transitioned
   properties for this element (read them from the inventory), because `transition` replaces the list. */
.lgs-glassctl { transition: scale var(--lgs-d-snappy) var(--lgs-ease-b15)
                            /* , <Steam's own entries, e.g. background-color .1s, color .1s> */; }
.lgs-glassctl:active, .lgs-glassctl.lgs-pressed {
  scale: min(var(--lgs-press-max), calc(1 + var(--lgs-press-grow) / var(--lgs-maxside, 80)));
  transition-duration: var(--lgs-d-interactive) /* , Steam's durations */; }
```

- The transition that runs is taken from the destination state's style. The base rule therefore holds the "out" durations, and each state rule holds its "in" durations.
- This is why release gets `snappy` with its small bounce, while press-in gets `interactive`.
- Do not use an `animation` for the swell. An `animation` shorthand on `:active` would replace Steam's own `ItemFocusAnim-*` keyframes on the same element while it is pressed.
- T2 writes `--hx/--hy` (percentages) from `pointermove`, throttled to animation frames, on the hovered `.lgs-lit` only.
- Focus visibility step: `.gpfocus` should also set a static `box-shadow` or fill with `!important`, so that the first frame shows at least 60 % (§4.4).

**Selection pill (Steam tab bars and segmented controls)** [§4.5]

T2 adds one decorative child to the tab container, `<div class="lgs-pill" aria-hidden="true">`, positioned absolutely. On every selection change it sets `--px` and `--pw` from the selected tab's `offsetLeft` and `offsetWidth`.

```css
.lgs-pill { position: absolute; top: 4px; bottom: 4px; left: 0; width: var(--pw);
  translate: var(--px) 0; border-radius: 999px; pointer-events: none;
  background: var(--lgs-selected-fill);
  transition: translate var(--lgs-d-snappy) var(--lgs-ease-b15),
              width var(--lgs-d-snappy) var(--lgs-ease-b15),
              background-color 120ms linear, scale var(--lgs-d-snappy) var(--lgs-ease-b15); }
.lgs-pill.lgs-lifting { background: rgb(255 255 255 / .30); scale: 1.06 1.12;
  transition-duration: var(--lgs-d-snappy), var(--lgs-d-snappy), 120ms, var(--lgs-d-interactive); }
```

T2 adds `lgs-lifting` for 180 ms (t90 of `snappy`). The pill sits under the labels in z-order. Steam's selected-tab white fill moves to the pill, and Steam's own selected fill becomes transparent with `!important`.

**Toggle lift (state-change triggered)** [§4.15]

```css
.lgs-anim .lgs-knob { animation: lgs-knob-lift var(--lgs-d-snappy) linear; }   /* no fill: 0 % and 100 % equal rest */
@keyframes lgs-knob-lift {
  0%   { scale: 1;       background-color: #fff; }
  20%  { scale: 1.3 1.2; background-color: rgb(255 255 255 / .35); }   /* lifted into glass */
  65%  { scale: 1.3 1.2; background-color: rgb(255 255 255 / .35); }
  100% { scale: 1;       background-color: #fff; } }
@media (prefers-reduced-motion: reduce) { .lgs-anim .lgs-knob { animation: none; } }
```

Steam's knob translation keeps Steam's property. Only its timing changes to `var(--lgs-d-snappy) var(--lgs-ease-b15)`.

**Scroll edge effect** [§4.13]

```css
.lgs-scroll-host { timeline-scope: --lgs-sc; }              /* common ancestor of header and scroller */
.lgs-scroller    { scroll-timeline: --lgs-sc block; }
.lgs-scroll-edge {                                          /* our decorative node or pseudo-element */
  position: absolute; inset: 0 0 auto 0; height: calc(var(--bar-h) + 16px); pointer-events: none;
  backdrop-filter: blur(12px); background: linear-gradient(rgb(0 0 0 / .30), transparent);
  -webkit-mask: linear-gradient(#000 40%, transparent); mask: linear-gradient(#000 40%, transparent);
  animation: lgs-edge-in linear both; animation-timeline: --lgs-sc; animation-range: 0px 24px; }
@keyframes lgs-edge-in { from { opacity: 0 } to { opacity: 1 } }
```

`timeline-scope` and `scroll-timeline` on Steam's nodes are not layout properties, so they are safe.

The animated `opacity` belongs to the glass element itself, not a parent (R1). Scroll-driven opacity runs on the compositor.

**Route transition override** [§4.12; shell owner verifies R10]

```css
%{TopLevelTransitionSwitch>Enter}        { transform: none !important; opacity: 0; translate: 16px 0; }
%{TopLevelTransitionSwitch>EnterActive}  { opacity: 1; translate: 0 0;
  transition: opacity var(--lgs-d-page) var(--lgs-ease-b0), translate var(--lgs-d-page) var(--lgs-ease-b0) !important;
  transition-delay: 40ms !important; }
%{TopLevelTransitionSwitch>ExitActive}   { transform: none !important; opacity: 0;
  transition: opacity 150ms linear !important; }
```

- Steam's own resting `transform: scale(1)` already makes this node a stacking context and a containing block, so the resting `translate: 0 0` that replaces it adds nothing new (R11).
- The direction (±16 px) needs T2, which knows whether a navigation went forward or back.
- In T1, use 0 px (fade only).
- These rules lift the Phase 1 ban on touching `TopLevelTransition`. That needs explicit sign-off and a check that the enter and exit classes still clear on time.

### 6.5 View Transitions: verdict

Same-document `document.startViewTransition()` exists in 126. It is **not recommended** here, for five reasons:

1. It must wrap Steam's router updates, which needs a T3 hook into React navigation.
2. While it runs, the page's rendering is replaced by snapshots, and the `::view-transition` overlay intercepts pointer events unless styled `pointer-events: none`. Both are risks for laser and focus correctness.
3. Captured elements are isolated images. Live `backdrop-filter` glass freezes or flattens during the transition, which is the opposite of materialize.
4. Steam's own transition classes would still run, giving two animations.
5. Element-scoped transitions, which would limit the blast radius, are not in 126.

Persistent chrome already persists across Steam routes, so the main benefit (morphing shared elements) is not needed.

### 6.6 Performance budget for motion

- **Compositor-only properties:** `opacity`, `scale`, `translate`, `transform`, and plain `filter`/`backdrop-filter` keyframes. These cost GPU per frame but no main-thread work.
- **Main-thread properties:** custom-property animations, `clip-path`, `width`, gradients and `box-shadow`. Use them only on elements of at most 600 × 600 px, and only for one-shot transitions.
- **Gate:** `python glass.py perf SURF --route R` while scripting the interaction (focus moves with `L.pad`, a menu open and close). It must show no frames > 34 ms and fps within 5 % of stock.
- **At rest:** `document.getAnimations().length === 0` on every surface.

---

## 7. Scene graph notes (SteamVR systemui, ≤ 30 Hz pushes)

- **What it can animate.** Changes reach the compositor only when `lgs_sg.js` pushes, at most 30 times a second. Each step is held for 2–3 compositor frames at 72–90 Hz. Use the graph for **discrete state** and **small depth changes** only.
- **Depth is safe at 30 Hz** [ours, computed].
  - Example: a 15 mm lift on `depth` (d 0.3, b 0). The largest single push step is 3.8 mm, between 33 and 67 ms.
  - At 1.43 m that changes binocular disparity by IPD · Δz / z² ≈ 0.063 × 0.0038 / 2.04 ≈ 1.2 × 10⁻⁴ rad ≈ 0.4 arcmin. That is at the edge of stereo acuity.
  - It also changes angular size by Δz/z ≈ 0.27 %, about 0.5 px on a 200 px element.
  - Steps are not visible for lifts ≤ 20 mm. Keep every depth animation ≤ 20 mm.
- **Never animate crop x/y or meters-per-pixel.**
  - Input lands on Steam's real panel underneath, so a crop must stay at its original x/y.
  - A 4 % scale of a 300 px crop changes its width by up to 3 px per push (1.5 px per edge), each step held for 2–3 display frames. That reads as stepping on text.
  - Scale belongs in CSS (Steam's live texture), or in glassd inside a padded slab.
- **Opacity nodes exist.** `vsg-node[vsg-type=opacity]` sits above grab and resize handles (inventory/steamvr.md). Fading crops through them works but steps at 30 Hz; a 250 ms fade has about 8 steps of 13 %. Prefer CSS fades on Steam's content: the crop is live, so the fade shows at CEF's frame rate.
- **Evaluate springs by time, not per step.** Compute each animated value with the closed-form spring (§8) from `t0`, so dropped or late pushes never slow an animation down. Always push the exact final value once at settle, then stop pushing (nothing at rest).
- **Synchronisation.**
  - Glass (glassd), content (CSS) and depth (graph) start from the same event, the layer report.
  - Expected skew is ≤ 1 push (33 ms) plus IPC.
  - The choreography tolerates ±50 ms, because content always starts ≥ 15 % into a glass transition.
- **Reduce Motion.** Do not animate depth [official HIG]. Apply the new depth in a single push timed to the lowest-visibility moment of the accompanying fade: at the end of a content fade-out, or before a materialize starts.

---

## 8. Spring math for JS (lgs_sg.js, T2 helpers) and C++ (glassd)

Closed form with an initial offset and velocity, so any animation can be retargeted mid-flight without a jump in velocity:

```js
// y = x - target. Returns [y(t), y'(t)] for y(0) = y0, y'(0) = v0.
// d = perceptual duration (s), b = bounce (-1..1). Mass 1.
function spring(y0, v0, t, d, b) {
  const w = 2 * Math.PI / d, z = b >= 0 ? 1 - b : 1 / (1 + b);
  if (Math.abs(z - 1) < 1e-6) {                       // critically damped
    const e = Math.exp(-w * t), B = v0 + w * y0;
    return [e * (y0 + B * t), e * (B - w * (y0 + B * t))];
  }
  if (z < 1) {                                         // underdamped
    const wd = w * Math.sqrt(1 - z * z), e = Math.exp(-z * w * t);
    const B = (v0 + z * w * y0) / wd, c = Math.cos(wd * t), s = Math.sin(wd * t);
    return [e * (y0 * c + B * s),
            e * ((-z * w) * (y0 * c + B * s) + (-y0 * wd * s + B * wd * c))];
  }
  const r1 = -w * (z - Math.sqrt(z * z - 1)), r2 = -w * (z + Math.sqrt(z * z - 1));   // overdamped
  const A = (v0 - r2 * y0) / (r1 - r2), C = y0 - A;
  return [A * Math.exp(r1 * t) + C * Math.exp(r2 * t), A * r1 * Math.exp(r1 * t) + C * r2 * Math.exp(r2 * t)];
}
// Retarget: [x, v] = current value and velocity; then y0 = x - newTarget, v0 = v, t0 = now.
// Settled when |y| < 0.001 * |travel| and |v| < 0.01 * |travel| / d.
```

---

## 9. glassd notes: materialize as an optics ramp

- **One progress per shape, many uniforms.** Add per-shape `m` (materialize), `press` with a position, and `k` (morph). glassd runs the springs itself, from targets in `glassd.json`, at its render rate (≤ 72 fps). The daemon writes targets only on change, never per frame.
- **Materialize mapping (entrance).** `m` follows a linear 250 ms ramp for small slabs, or the surface's spring for covers and sheets.

  | Uniform | Range of `m` | Notes |
  |---|---|---|
  | `uRim`, `uSpec` (specular arcs) | 0 → 0.6 | Light defines the silhouette first, which is Apple's "light… define[s] its silhouette" |
  | `uRefr`, `uLensMag`, `uDisp` (lensing) | 0 → 0.7 | Materialize "by gradually modulating the light bending and lensing" |
  | `uFrost` (mip 0 → target) | 0.2 → 0.92 | Diffusion follows the bend |
  | `uTintA` | 0.2 → 0.92 | |
  | `uDarkEdge` | 0.3 → 0.92 | |
  | Contact shadow | 0.4 → 1 | |
  | Coverage alpha | `smoothstep(0, 0.3, m)` | |

  - At m = 0 the shader with zero refraction, frost and tint would reproduce the passthrough exactly, so the glass is invisible without alpha. Reconstruction error (latency, calibration) would still show a "room copy", which is why coverage alpha also ramps.
  - The exit runs the same mapping in reverse over 300–350 ms, starting after the content has left.
- **Scale needs padding.** NATIVE.md's slab rule ("exact Steam-pixel size, no margin") cannot show a swell or overshoot. Pad each slab's atlas region by `12 Steam px × backdropScale` on every side, and enlarge the slab panel by the same amount, keeping it centred. The swell and the 1.5 % morph overshoot then fit inside.
- **Press illumination.** `uPress` (0–1) and `uPressPos` (Steam px) add an additive glow. Its radius grows from 0.5 to 1.5 × the shorter side, its peak is +15 %, and it spills at 25 % to other shapes on the same surface within 40 px. The position comes from the layer report: `lgs_layers.js` knows `:hover`, `:active` and `.gpfocus` and can report the pointer coordinates.
- **Morph.**
  - Reserve the atlas region for the **final** menu rect plus padding.
  - Inside it, the SDF goes from the source rect and radius to the menu's on the `morph-open` spring. During the first 40 % it smooth-unions with the source shape (k ≈ 24 Steam px).
  - Thickness θ interpolates the material presets (`liquid` → `thick`) with size (§2.3).
  - The scene graph only places the slab and animates its dz (15 → 30 mm).
- **Selection lens.** Draw the travelling, lifted pill inside the tab bar's own slab. No scene-graph node moves.
- **Time base and frame rate.**
  - Use `CLOCK_MONOTONIC` and closed-form springs (§8), robust to dropped frames.
  - Render at the full rate only while any spring is unsettled. When all are settled, drop to `idleHz`; nothing animates at rest.
  - Budget unchanged: ≤ 2.5 ms GPU per frame.
- **Reduce Motion.**
  - Materialize becomes coverage alpha only (150–200 ms) with the uniforms at their targets.
  - No swell, no morph (shapes cross-fade), no glow spread. A glow at fixed radius stays.
- **Lighting at rest.** View-dependent specular from head motion is allowed (§2.5). No time-based term.

---

## 10. Verifying motion without a wearer

Every item below can be checked by an agent through the locked lab commands (LAB.md).

1. **Token conformance.** On each surface, trigger the interaction and read `document.getAnimations().map(a => [a.animationName || a.transitionProperty, a.effect.getTiming().duration, a.effect.getTiming().easing, a.effect.getTiming().iterations])`.
   - Every duration must equal a token in §6.2.
   - Iterations must be 1.
   - Easing must be one of the `--lgs-ease-*` curves or `linear`.
2. **Nothing at rest.** After 1 s, `getAnimations().length === 0` (the coverage docs already use this check).
3. **Filmstrips.** Pause every running animation and seek it with `a.pause(); a.currentTime = f * duration` for f = 0, 0.15, 0.35, 0.5, 0.75, 1. CDP-screenshot each step as `shots/p2_motion_<surface>_<interaction>_<f>.png`.
   - Check the choreography visually: glass before content on entry, content before glass on exit, no text scaling, no closed outline at any frame.
   - The CDP `Animation.setPlaybackRate` command (Animation domain) is an alternative for slowed live capture.
4. **Reduce Motion and High Contrast.** Use CDP `Emulation.setEmulatedMedia` with `prefers-reduced-motion: reduce` and `prefers-contrast: more` on the page under test, inside a lab lock, and clear the emulation afterwards. This changes no Steam setting.
   - Repeat steps 1–3 and assert no `scale`/`translate` animations and bounce-free easings.
5. **Performance.** Run `python glass.py perf` while scripting the interaction (D-pad focus sweeps with `L.pad`, a menu open and close, a route change). It must show no frames > 34 ms and fps within 5 % of stock.
6. **glassd.** Add a debug override in `glassd.json` that pins `m`, `press` and `k` per shape. Then `glassd --once --dump DIR` at m = 0, 0.15, 0.35, 0.6, 1 for a filmstrip of the optics ramp.
7. **Scene graph timing.** Run `native/spike/sg_timeline.py` with a depth animation spec, grabbing the headset view at fixed delays. Confirm ≤ 30 Hz steps and that the final state is pushed once. The frames show the room: look at them, then delete them.

---

## 11. Open questions and risks

| # | Risk | Effect | Mitigation and check |
|---|---|---|---|
| 1 | Apple publishes no glass durations; ours are community-measured and adjusted | The feel may differ from Apple's | All values are tokens; filmstrips (§10.3) can be compared side by side with frames from Apple's WWDC25-219/323 videos |
| 2 | CSS cannot animate exits of nodes Steam removes | Instant exits in T1 | glassd dissolves the glass after content (Apple's order). To verify: do scene-graph children survive the parent overlay's hide for long enough? |
| 3 | Phase 1 bans `filter`/`backdrop-filter` animations | Materialize in CSS conflicts with LAB.md | Amend with the R8 limits; perf gate |
| 4 | Gamepad A has no `:active` | No press feedback for the controller | T2 listener on Steam's gamepad events. To verify: the event names on the focused element |
| 5 | Mount animations replay on virtualised rows | Noise during scrolling | R5: no mount animations on rows; insertion only via T2 key diffing |
| 6 | Overriding Steam's route and tab transition classes | Nodes stuck mid-transition if React timeouts are shorter | R10: durations at or below Steam's; test every route with `getAnimations()` empty after 1 s |
| 7 | Scene graph at 30 Hz | Judder if anything but depth moves | §7: depth only, ≤ 20 mm |
| 8 | Skew between the CSS content channel and the glassd glass channel | Content shows before its glass, or the reverse | ≥ 15 % content lead-in absorbs ≤ 50 ms; check with hvgrab at fixed delays |
| 9 | Bounce on large surfaces in a headset | Looming or discomfort | b = 0 for anything over 600 px; swell ≤ 1–2 % (C3) |
| 10 | Steam's High Contrast and Reduce Motion reach CEF as media features | Accessibility paths untested live | Emulate media (§10.4); never toggle Steam's settings |
| 11 | `clip-path` and custom-property animations on the main thread | Long frames on big menus | Limit to ≤ 600 × 600 px; perf gate |
| 12 | Continuous (squircle) corners are not available in Chromium 126 | Corners look circular | Accept for controls; glassd's SDF can use a superellipse for slabs and covers |

---

## 12. Sources

**Apple: WWDC sessions**

- WWDC25-219 "Meet Liquid Glass": https://developer.apple.com/videos/play/wwdc2025/219/
- WWDC25-356 "Get to know the new design system": https://developer.apple.com/videos/play/wwdc2025/356/
- WWDC25-323 "Build a SwiftUI app with the new design": https://developer.apple.com/videos/play/wwdc2025/323/
- WWDC25-284 "Build a UIKit app with the new design": https://developer.apple.com/videos/play/wwdc2025/284/
- WWDC25-303 "Design hover interactions for visionOS": https://developer.apple.com/videos/play/wwdc2025/303/
- WWDC24-10152 "Create custom hover effects in visionOS": https://developer.apple.com/videos/play/wwdc2024/10152/
- WWDC26-102 Platforms State of the Union: https://developer.apple.com/videos/play/wwdc2026/102/
- WWDC26-269 "What's new in SwiftUI": https://developer.apple.com/videos/play/wwdc2026/269/

**Apple: documentation**

- Adopting Liquid Glass: https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- Applying Liquid Glass to custom views: https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views
- `Glass`, `GlassEffectContainer`, `GlassEffectTransition`, `glassEffectID(_:in:)`, `glassEffectTransition(_:)`, `glassEffectUnion(id:namespace:)`, `Glass.clear`: https://developer.apple.com/documentation/swiftui/glass (and siblings)
- `UIGlassEffect`: https://developer.apple.com/documentation/uikit/uiglasseffect
- `ScrollEdgeEffectStyle`: https://developer.apple.com/documentation/swiftui/scrolledgeeffectstyle
- `tabBarMinimizeBehavior(_:)`: https://developer.apple.com/documentation/swiftui/view/tabbarminimizebehavior(_:)
- `backgroundExtensionEffect()`: https://developer.apple.com/documentation/swiftui/view/backgroundextensioneffect()
- `glassBackgroundEffect(displayMode:)`: https://developer.apple.com/documentation/swiftui/view/glassbackgroundeffect(displaymode:)
- `Animation.default`: https://developer.apple.com/documentation/swiftui/animation/default
- `spring(duration:bounce:blendDuration:)`: https://developer.apple.com/documentation/swiftui/animation/spring(duration:bounce:blendduration:)
- `spring(response:dampingFraction:blendDuration:)`: https://developer.apple.com/documentation/swiftui/animation/spring(response:dampingfraction:blendduration:)
- `interactiveSpring`: https://developer.apple.com/documentation/swiftui/animation/interactivespring(response:dampingfraction:blendduration:)
- `smooth`, `snappy`, `bouncy` (`(duration:extraBounce:)` variants): https://developer.apple.com/documentation/swiftui/animation/smooth(duration:extrabounce:)
- `Spring` and `settlingDuration`: https://developer.apple.com/documentation/swiftui/spring
- UIKit `animate(springDuration:bounce:…)`: https://developer.apple.com/documentation/uikit/uiview/animate(springduration:bounce:initialspringvelocity:delay:options:animations:completion:)
- CoreAnimation `CASpringAnimation(perceptualDuration:bounce:)`: https://developer.apple.com/documentation/quartzcore/caspringanimation/init(perceptualduration:bounce:)
- Navigation `zoom(sourceID:in:)`: https://developer.apple.com/documentation/swiftui/navigationtransition/zoom(sourceid:in:)

**Apple: Human Interface Guidelines**

- Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Accessibility (Reduce Motion list): https://developer.apple.com/design/human-interface-guidelines/accessibility
- Focus and selection: https://developer.apple.com/design/human-interface-guidelines/focus-and-selection
- (Fetched through the DocC JSON endpoints `https://developer.apple.com/tutorials/data/<path>.json` on 2026-10-06.)

**Press**

- MacStories, visionOS 26 review: https://www.macstories.net/stories/visionos-26-the-macstories-review/7/
- MacStories, visionOS 27 overview: https://www.macstories.net/news/visionos-27-the-macstories-overview/
- UploadVR, visionOS 27: https://www.uploadvr.com/visionos-27-announced-apple-vision-pro-wwdc-26/
- MacRumors, visionOS 27: https://www.macrumors.com/2026/06/09/visionos-27-siri-ai-eye-aware-notifications/
- BGR, iOS 27 Liquid Glass: https://www.bgr.com/2191219/ios-27-liquid-glass-fix-customization/

**Community measurements and recreations**

- `liquid_glass_widgets` (Flutter): `lib/constants/glass_defaults.dart`, `lib/widgets/effects/shared/glass_materialize_effect.dart`, `lib/widgets/effects/glass_materialize.dart`, `lib/theme/glass_interaction_settings.dart`, `lib/utils/glass_spring.dart` and `docs/LIQUID_MORPH_ENGINE.md`: https://github.com/sdegenaar/liquid_glass_widgets
- AndroidLiquidGlass (Kyant): `catalog/utils/InteractiveHighlight.kt`, `DampedDragAnimation.kt` and `components/Liquid{Button,Toggle,Slider,BottomTabs}.kt`: https://github.com/Kyant0/AndroidLiquidGlass

**Chromium**

- `prefers-reduced-transparency` (Chrome 118): https://developer.chrome.com/blog/css-prefers-reduced-transparency
- `calc-size()` / `interpolate-size` (Chrome 129): https://developer.chrome.com/blog/new-in-chrome-129
- `corner-shape` (Chrome 139): https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/corner-shape
- View transitions and pointer events: https://frontendmasters.com/blog/view-transitions-careful-not-to-make-stuff-unclickable/
- Same-document view transitions: https://developer.chrome.com/docs/web-platform/view-transitions/same-document
- `backdrop-filter` compositor animations (crbug 965512): https://lists.w3.org/Archives/Public/public-fxtf-archive/2019Aug/0018.html

**Project**

- `docs/inventory/shell.md`, `library.md`, `hud.md`, `bar.md`, `steamvr.md` (Steam's current motion)
- `docs/coverage/*.md` (backdrop roots, hidden-window transitions)
- `docs/NATIVE.md` (layering, slab rule, 30 Hz pushes)
- `native/glassd/src/glassd.cpp` (material presets)
- `native/glassd/shaders/glass.frag` (uniforms)

**Tables**

- Spring tables and easings: `docs/phase2/research/springs.py` (closed-form step response, epsilon 0.001, point reduction at a tolerance of 0.4 %). The formulas are in §3.1 and §8. The CSS values in §6.2–6.4 were parse-checked in headless Chrome. Every feature used predates Chromium 126.
