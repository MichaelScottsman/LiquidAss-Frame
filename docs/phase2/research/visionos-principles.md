# visionOS principles and input model: a conformance spec for Glass Shell Phase 2

Compiled 2026-10-07. This file adds three things that the component spec does not cover. It covers the **principles** behind a native visionOS feel, the **input model** for a controller headset (laser and gamepad), and a **conformance checklist** that critique and QA agents can score mockups and the live build against.

**What this file does not repeat.** Sizes, components, type, colour, materials, depth numbers and motion tokens are in:

- `research/visionos.md` (cited **VR §n**);
- `DESIGN2.md` (**D2 §n**);
- `research/liquid-glass-motion.md` (**MO §n**);
- `research/references.md` (**REF**).

Here they are cross-referenced, not restated. Other project sources:

| Cited as | File |
|---|---|
| **SP** | `capabilities/spatial.md` |
| **DL** | the design-language rulebook `.claude/skills/run-liquid-glass-frame/references/design-language.md` |
| **INV-B** | `docs/inventory/bar.md` |
| **INV-L** | `docs/inventory/library.md` |
| **INV-A** | `docs/inventory/appdetails.md` |
| **INV-H** | `docs/inventory/hud.md` |
| **LA** | `audit/library-apps.md` |
| **GP** | `audit/game-pages.md` |
| **SY** | `audit/system.md` |
| **WN** | `concepts/window-nav.md` |

**Evidence tags** (as in VR):

| Tag | Meaning |
|---|---|
| **[official]** | Apple HIG page, Apple developer documentation, Apple Support or a WWDC transcript |
| **[press]** | Reviews and hands-on reports (MacStories, MacRumors, AppleInsider, 9to5Mac, Road to VR, Six Colors, Macworld, Cult of Mac) |
| **[community]** | Developer blogs, community docs, and other vendors' design guidance (Microsoft MR, Steamworks) |
| **[ours]** | A rule or number chosen for the Steam Frame, with the reasoning given |
| **[unconfirmed]** | Plausible but not verified from a primary source; needs a probe or a wearer |

Geometry used throughout:

- The main window is 1280 × 720 CSS px, 0.98 × 0.55 m at 1.43 m: 0.0307°/px, 37.8° × 21.8° (VR §1.2).
- At the measured summon distance of 1.15 m it is 0.038°/px, about 46° × 27° (SP §1.1, D2 D1).
- A screenshot from `python glass.py shot` is 1920 × 1080, so **1 CSS px = 1.5 shot px**.

---

## 0. Twelve principles in one screen

1. **The laser is the eyes; the gamepad is tvOS focus.** The laser drives the visionOS hover look (instant, subtle, at the hit point). The gamepad drives a persistent, findable focus look. Key both on Steam's input mode, never on `.gpfocus` alone. (§1.2, §1.3)
2. **Every action has a laser path and a gamepad path, visible in the mode that uses it.** Controller glyph badges show in gamepad mode only. (§1.4, §2.11)
3. **B undoes one layer, and focus returns to where it came from.** Menus, then sheets, then pages. Back and close are circles at the top left. (§1.5)
4. **Centre what matters.** Key content and the primary action sit within about ±12° of the window centre (±400 px). Edges hold secondary actions. (§2.1)
5. **Comfort before novelty.** Nothing is head-locked, nothing moves at rest, nothing wide slides sideways, nothing oscillates. Brightness never jumps up from dark. (§2.4)
6. **Legible on any room.** Weight before size, white text at three vibrancy levels, ≥ 4.5:1, no small coloured text on glass. (§2.2)
7. **Depth is rare and meaningful.** Use ≤ 4 depth planes at rest. Only containers pop, and the shadow always agrees with the stereo. (§2.3)
8. **Hierarchy comes from material, space and depth, never from lines.** (§2.7)
9. **Chrome recedes; content leads.** Navigation and tools float at or outside the window edges, borderless inside their ornament. Content is opaque, full-bleed and centred. (§2.6)
10. **Fewer, larger things.** At most 7 rows per column and about 30 targets per window. Page, group or disclose the rest. (§2.5)
11. **Borrow the system's patterns, not just its look.** Home's ramp hover, Spotlight's zero state, the keyboard's echo, menus that grow from their source, alerts in front, notifications that expand when you look. (§3)
12. **Feedback in three channels: light first, sound second, haptics last.** Steam's own UI sounds stay. Haptics are only for discrete events, are rate-limited and can be turned off. (§4)

---

## 1. Input model for laser and gamepad

### 1.1 What visionOS does with inputs other than the eyes

| Input | What the system does | Source |
|---|---|---|
| **Eyes + hands** (default) | Eyes target and a pinch selects. The hover highlight is drawn by the system, outside the app's process | [official, [HIG Eyes][hig-eyes], [WWDC23-10073][wwdc23-10073]] |
| **Trackpad / mouse** | A pointer appears and brings focus to the element under it. Where you look decides which window the pointer is in. The pointer hides while you gesture, and when moved it reappears where you are looking | [official, [HIG Pointing devices][hig-pointing]] |
| **Game controller** (DualSense, Xbox) | Targeting stays with the eyes. X (the bottom face button) taps, the sticks scroll, and the PS button opens Home View. Hand tracking stays on | [press, [AppleInsider][ai-psvr2]] |
| **Spatial controller** (PS VR2 Sense, visionOS 26) | Targeting stays with the eyes ("look at an app icon, and press the physical trigger"). "The triggers replace the pinch function", either stick scrolls and slides Home pages, and the PS button opens Home View. Hand tracking is turned off. Reaching out and pressing a trigger is a direct touch. **No ray is drawn for system UI** in any report | [official, [HIG Game controls][hig-gamecontrols], [WWDC25-289][wwdc25-289]]; [press, [AppleInsider][ai-psvr2], [9to5Mac][9to5-psvr2], [Road to VR][rtvr-psvr2]] |
| **Pointer Control** (accessibility) | Head, wrist or index finger replaces the eyes and drives "the system focus", i.e. the same hover effects. The pointer is small and round, with settings for colour, size, contrast, auto-hide and scroll speed. Selection is still a pinch, or a dwell with Dwell Control | [official, [WWDC23-10034][wwdc23-10034], [Support: Pointer Control][sup-pointer]]; [press, [Six Colors][sixcolors-a11y]] |
| **Keyboard / game-controller focus** | "visionOS supports the same focus system as in iPadOS and tvOS." Focus and hover are separate systems | [official, [HIG Focus and selection][hig-focus]] |

**Consequences for the Frame:**

- **No precedent for directional focus in system UI.** visionOS has no directional-focus precedent in its own system UI: with a controller it still targets with the eyes. The nearest precedent for a D-pad user is **tvOS focus** and iPadOS keyboard focus.
- **The laser is Pointer Control.** The precedent for a ray is Pointer Control, a visible pointer that drives the hover look. For a trackpad pointer, that look is iPadOS-style.

### 1.2 What the Steam Frame actually has (project findings)

- **One class for two inputs.** Steam sets **`.gpfocus` for both the laser and the controller** (INV-B §2 "Focus"; INV-A §9). A theme cannot tell laser hover from gamepad focus by that class alone. The laser also sets `:hover`.
- **Steam knows the input mode.** `IsInGamepadNav` comes from SteamVR's `system_panel_interaction_mode` (Gamepad vs LaserMouse) (INV-L §6.1). Steam **changes its own layout by mode**. In laser mode a laser-only Sort/Filter pill appears; in gamepad mode the footer legend carries the same actions (INV-L §6.1, LA §0.4).
- **SteamVR's laser.** SteamVR draws the laser ray and a cursor dot. Panel flags `hide-laser-intersection` and `hide-laser-when-clicking` exist (SP §8). SteamVR 2.17 updated the "Laser Mouse appearance" and added a laser-length preference [press, [GamingOnLinux][gol-svr217]].
- **Hover cannot be faked.** Laser `:hover` cannot be synthesised by an agent (LA §0.4). Gamepad focus can be driven with `L.pad` (D2 §12).
- **Steam already plays UI sounds.** `PlayNavSound(...)` (INV-H) and a 30-sound vocabulary (§4.2) honour Steam › Audio › UI sounds. The Steam keyboard has its own Haptics setting (SY, Keyboard page).

### 1.3 Rules: situation → visionOS behaviour → our rule

| # | Situation | visionOS / Apple behaviour | Laser rule [ours] | Gamepad rule [ours] |
|---|---|---|---|---|
| I-1 | **Targeting and the pointer** | Eyes target; no ray, even with Sense controllers. A trackpad pointer appears where you look and hides while you gesture. Pointer Control shows a small round pointer [official, press] | The laser is Pointer Control. Keep SteamVR's ray and dot. Draw **no cursor of our own**. Never set `hide-laser-intersection` on an interactive crop | **No pointer.** tvOS: "Avoid displaying a pointer" [official, [HIG Focus][hig-focus]]. The focus look is the only locator. The light spot is static (D2 §10.1) |
| I-2 | **Pointer over a control** | iPadOS 13–18: the pointer snaps and morphs into the control's platter and moves **behind** the label, so the label keeps its true colour. Lift for icons, with a specular that shows the true pointer position. Plain hover for large items. Magnetism [official, [WWDC20-10640][wwdc20-10640], [HIG Pointing devices][hig-pointing]]. iPadOS 26: a grey translucent arrow that no longer morphs [press, [Macworld][macworld-ipad26]]. Whether the platter highlight remains is [unconfirmed] | The highlight is the control's own fill brightening (+ white .08–.10). The **light spot sits under the label or glyph layer**, never over it. On content cards the spot is the sheen. SteamVR's dot is the precise marker, as the iPadOS 26 arrow is; don't imitate a morph | Not applicable |
| I-3 | **Hover timing** | Instant for subtle effects. A short delay for expansions (tab bar). A longer delay for information (tooltips; Apple sample 0.8 s in, 0.2 s out). Ramp for previews. "Nearly all effects benefit from even a short delay" [official, [HIG Eyes][hig-eyes], [WWDC24-10152][wwdc24-10152], [WWDC25-303][wwdc25-303]] | Brightness is immediate (t90 ≤ 130 ms, D2 §11.2 `hover-in`). **Motion-bearing effects (lift, scale, depth) start only after ≥ 80 ms of dwell**: a laser sweeps through every target in its path, while eyes jump between targets (§7 D-7). Reveals: tab labels 0.4 s, back title 0.6 s, tooltips and card previews 0.8 s; out 0.2 s | The focus look is immediate (first frame ≥ 60 %, D2 §10.1). The tab bar expands at once on entry. Other reveals use the laser delays |
| I-4 | **Moving along a bar** | iPadOS: leave no gap between adjacent hit regions, or the pointer morphs back and forth between them [official, [HIG Pointing devices][hig-pointing]] | In tab bars, toolbars, segmented controls and frame controls, **hit boxes abut (gap ≤ 2 px)**; the visual gaps stay | Left/Right steps through the bar in visual order |
| I-5 | **The focus indicator** | Same focus system as iPadOS/tvOS: a ring for text and search fields, a whole-item highlight in lists and collections. A tvOS focused item stands out by "elevation to the foreground, illumination, and animation". In tvOS 26, controls take on Liquid Glass when focused [official, [HIG Focus][hig-focus], MO §4.4] | **In laser mode there is no persistent focus.** `.gpfocus` under the laser paints the hover look, and only while `:hover`, because visionOS hover vanishes when you look away (§7 D-9) | **Persistent focus look**, clearly stronger than selection (§7 D-2): ≥ +40 L over rest and ≥ +15 L over the selected state. The specular arc ×1.5. Content cards lift (D2 §7.8). Text fields add the ring (VR §9) |
| I-6 | **Selection vs focus** | tvOS has five distinct states (unfocused, focused, highlighted on press, selected, unavailable). visionOS navigation selection is a lighter pill; a toggled button is white [official, [HIG Focus][hig-focus], VR §14] | Selection never looks stronger than hover. Selected + hovered shows both | Selection never looks stronger than focus. Focused + selected = pill + focus add (≥ +10 L over selected) |
| I-7 | **Moving focus** | tvOS: directional focus to every element. iPadOS: focus groups (Tab between groups, arrows within). "Avoid changing focus without people's interaction", except when the focused item disappears under directional input [official, [HIG Focus][hig-focus]] | Not applicable (the laser chooses) | One step per D-pad press. Auto-repeat retargets (MO C5). Focus groups: window content, tab-bar ornament, bottom ornament, frame controls. Steam's geometric engine decides (D2 §12) |
| I-8 | **Initial focus and restoration** | iPadOS: when a group gets focus, its primary item gets focus [official, [HIG Focus][hig-focus]] | Nothing is lit until the laser points at it | On a route: the **primary item** (the first content item or the primary action), never Back. When a menu, sheet or alert closes: back to **its source**. When the focused item vanishes: the nearest neighbour in the last direction |
| I-9 | **Scrolling** | Pinch and drag. Controller sticks scroll the view you look at. Look to Scroll (eyes at the edges) is opt-in for reading and browsing views, never control lists. The scroll indicator is small and fixed (trailing edge centre, or bottom centre) and shows only while scrolling [official, [HIG Scroll views][hig-scroll]; press, [AppleInsider][ai-psvr2], [MacStories 26][macstories-26]] | Thumbstick or trackpad **while pointing** scrolls the hovered scroller (SteamVR `scrollable`), following the input with no extra easing. **No dwell or edge scroll** with the laser: a laser rests at edges by accident | **Scrolling follows focus.** `scroll-padding` keeps the focused item ≥ 16 px clear of the toolbar row, the bottom ornament and the scroll-edge bands. Long reading views: the right stick free-scrolls if Steam maps it [unconfirmed] |
| I-10 | **Paging** | Home View pages by swipe. The Sense thumbstick slides pages [press, [9to5Mac][9to5-psvr2]]. The shoulder buttons move to a different screen or section [official, [HIG Game controls][hig-gamecontrols]] | Page dots and ‹ › circles are clickable; drag to page | LB/RB pages or switches sections. Left/Right past the last column pages (Home, D2 §3.5) |
| I-11 | **Activate** | Look + pinch, trigger, or X/A. "A: Activates a control" [official, [HIG Game controls][hig-gamecontrols]]. tvOS separates focus from selection [official, [HIG Focus][hig-focus]] | Trigger click activates (Steam's handler, unchanged) | A activates the focused item. Focus never activates on its own, except Steam's own `onGamepadFocus` behaviours, which stay |
| I-12 | **Press feedback** | Touch Liquid Glass: glow plus swell. With a trackpad "a more subdued effect" [official, [HIG Motion][hig-motion]]. iPadOS pointer click: the shape scales down and darkens [official, [WWDC20-10640][wwdc20-10640]]. visionOS keyboard: the key moves down in z with a sound [official, [WWDC23-10073][wwdc23-10073]]. tvOS: a brief inversion [official, [HIG Focus][hig-focus]] | A glow from the hit point within one frame. A subdued size change (§7 D-3). Steam's activation sound. A haptic tap (§4) | The same, from the centre on A |
| I-13 | **Back and dismiss** | "B: Cancels an action or returns to previous screen" [official, [HIG Game controls][hig-gamecontrols]]. Back is a circle at the top left; close is at the top left of sheets; no words (VR §8). Sheets don't dismiss on an outside tap [community, [ArcTouch][arctouch]]. Menus and popovers do [unconfirmed for visionOS; standard on iPadOS] | Back and close are circles at the top left. An outside click closes menus and popovers only, never sheets or alerts | B closes the **topmost transient layer** first (menu, then sheet or alert), then goes back. At the root, Steam's behaviour is kept (WN §6.2) |
| I-14 | **Secondary actions (more, context)** | Touch and hold opens a contextual menu [official, [HIG Gestures][hig-gestures]]. The Menu button opens settings or pauses [official, [HIG Game controls][hig-gamecontrols]] | A visible **⋯ circle** on the hovered or focused card, or More in the ornament, because the laser has no long-press convention in Steam [ours; LA C.4] | ≡ (Steam's Options) opens the focused item's menu. X/Y keep Steam's per-page meanings |
| I-15 | **Sections inside a page** | Shoulders change sections [official] | Click the segment | LB/RB move the segmented control. Its LB and RB glyph badges sit at its ends, in gamepad mode only |
| I-16 | **Text entry** | A system keyboard in its own movable window, with "the preview at the top of the keyboard"; look + pinch or touch; per-key sound [official, [Support: Enter text][sup-text], [HIG Virtual keyboards][hig-vkb]] | Opens on activation only. Echo row on the keyboard slab (D2 §7.5). Key hit boxes abut | Steam's virtual key focus; the same echo |
| I-17 | **Adjusting a value** | The slider knob appears on hover (an instant effect) [official, [WWDC24-10152][wwdc24-10152]] | Drag; the value equals the pointer position with no easing (D2 §11.5). The knob appears on hover | Left/Right is one detent per press (Steam). A tick per detent (§4) |
| I-18 | **Switching input** | Keep one experience across inputs; people move between them fluidly. "Customize onscreen content to match the connected game controller" [official, [HIG Pointing devices][hig-pointing], [HIG Game controls][hig-gamecontrols]] | One **root input-mode class** from `IsInGamepadNav` drives: light-spot tracking (laser only), persistent focus (gamepad only), glyph badges (gamepad only). Shared elements never re-lay out on a switch; only Steam's mode-only elements come and go | Same class |
| I-19 | **System button** | "Home/logo: Reserved for system controls" [official]. The Sense PS button opens Home View [press] | Not applicable | Steam and Guide buttons untouched |
| I-20 | **Moving the window** | Drag the window bar; the window turns to face you. Sense triggers drag windows [official, [WWDC23-10072][wwdc23-10072]; press] | SteamVR's grab pill, restyled (D2 §7.13) | None, as today |

### 1.4 Button map (Apple's expectations against the Frame)

| Control | Apple's expected UI behaviour [official, [HIG Game controls][hig-gamecontrols]] | Steam Frame today | Rule |
|---|---|---|---|
| A | Activates a control | Activates | Keep |
| B | Cancels or returns to the previous screen | Cancels or goes back (per page) | Keep. Closes the topmost layer first |
| X, Y | Unassigned | Page actions (Filter, Sort, Search…) | Keep Steam's. Show them as **visible buttons** with glyph badges in gamepad mode (D2 §7.3) |
| LB / RB | Move to a different screen or section | Tabs within a page | Keep |
| Triggers | Unassigned (visionOS Sense: trigger = pinch) | Laser trigger = click | Keep |
| Sticks, D-pad | Move selection | Move focus | Keep |
| Home/logo | Reserved for the system | Steam button | Untouched |
| Menu (≡) | Opens settings or pauses | Options / context menu | Keep |

Glyph badges use **the connected controller's labelling**, so Steam's own glyph components, not hard-coded letters [official, [HIG Game controls][hig-gamecontrols]: "Customize onscreen content to match the connected game controller"].

### 1.5 Back, close and focus restoration (one sequence)

1. A menu or popover is open: B, or a laser click outside it, closes it. Focus returns to the menu's source. The source returns from white to its rest state (VR §14).
2. A sheet or alert is open: B or its top-left Close circle closes it. An outside click does nothing. Focus returns to the control that opened it.
3. A nested page: B or the Back circle goes back. Focus lands on the item that led here, if Steam restores it [unconfirmed], or else on the primary item.
4. The window root: Steam's behaviour (WN §6.2: B opens the tab bar).

### 1.6 Not confirmed (probe before relying on it)

| Item | Why it matters | Probe |
|---|---|---|
| Does `.gpfocus` stay on the last laser-hovered element after the laser leaves? Does it follow the laser across every tile on the way to a target (LA LQ7)? | If it stays, a "hover" stays lit with nothing pointing at it. If it follows, every sweep moves focus | Point the laser at a row, move it off the window, read the classes (needs a wearer); or read Steam's laser-focus source |
| Can T2 read `IsInGamepadNav` (or `system_panel_interaction_mode`) live? | Everything in I-18 depends on it | Find the module that holds it (INV-L: module 84114) and subscribe without writing |
| Does Steam play a nav sound on **laser** focus changes? | A laser sweep would play a train of clicks | Count `PlayNavSound` calls through a read-only wrapper while a wearer sweeps |
| Can the Steam CEF page fire controller haptics? | §4 depends on it | List `Object.keys(SteamClient.Input)`; look for haptic methods; never call them on the shared UI without a plan |
| Right-stick free scroll in Steam's gamepad UI | I-9 for long text | Steam source or a wearer |
| Does iPadOS 26 keep the platter highlight under the arrow pointer? | Informs I-2 only | Apple docs once the HIG is updated |

---

## 2. Spatial principles as testable rules

Each principle lists its source, the rule, how it applies to the 0.98 m Steam window at 1.43 m, and how an agent checks it. The check IDs (P-nn) point to §6.

### 2.1 Field of view and centring

- **Source.**
  - "Within the field of view, it's most comfortable to look in the center"; the edges suit secondary actions [official, [WWDC23-10073][wwdc23-10073]].
  - Turning the eyes down, left and right is easiest; "Upward and diagonal eye rotation requires most eye-muscle effort"; reading content goes "towards the center and slightly below line of sight" [official, [WWDC23-10078][wwdc23-10078]].
  - The neck turns left and right more easily than up and down, so prefer wide layouts and keep the most important information centred [official, [WWDC23-10076][wwdc23-10076]].
  - Microsoft MR: avoid gaze more than 10° above the horizon; resting gaze is 10–20° below; avoid neck rotation beyond 45° [community, [Microsoft MR comfort][ms-comfort]].
- **Rule.** Primary content and the primary action sit near the window centre and not in the top band. Edges hold secondary actions. Layouts are wide, not tall.
- **On the Frame.**
  - ±400 px from the window centre is ±12.3° at 1.43 m and ±15.2° at 1.15 m. That is the zone the eyes cover without a head turn.
  - The game page puts Play at −15.5° and Manage at +18°, a 34° sweep (GP §0.3). It fails.
  - The window's top 108 px (the toolbar row, 3.3°) is for navigation (Back, title, search), not reading.
  - Where SteamVR pitches the window relative to eye level is [unconfirmed]. If its centre is at eye level, the top edge is 11–13.5° above the horizon, already past Microsoft's 10°.
- **Agent check.**
  - P-29: the primary action's centre is within |x − 640| ≤ 400 and 144 ≤ y ≤ 600.
  - P-30: the centroid of the main content block is within |x − 640| ≤ 160.
  - P-31: no paragraph text starts above y = 108.
  - In a 1920 × 1080 shot, multiply every number by 1.5.

### 2.2 Legibility and contrast on glass

- **Source.**
  - Text is white by default; colour goes in a background or a whole button; three vibrancy levels [official, [WWDC23-10076][wwdc23-10076]].
  - At least 4:1 contrast [official, [WWDC23-10034][wwdc23-10034]].
  - Higher contrast for reading; lower contrast, transparency or blur to steer attention away [official, [WWDC23-10078][wwdc23-10078]].
  - Colour fails first on glass because the room shows through [official, VR §14].
  - Coloured iPad labels become "barely visible" on visionOS glass [community, [ArcTouch][arctouch], [Varrall][varrall]].
- **Rule.**
  - White text at three vibrancy levels; ≥ 4.5:1 for body and ≥ 3:1 for titles of 28 px Bold or larger.
  - No coloured text under 24 px or under weight 600.
  - Weight before size: no weight under 500.
- **On the Frame.**
  - 19.6 pixels per degree means one CSS px is 0.6–0.74 display px (VR §1.5).
  - Contrast must hold over the bright, grey and dark test rooms (`audit` CONTRAST) and over a running game behind the window.
- **Agent check.** P-38 to P-41 (DOM computed styles, `audit` CONTRAST).

### 2.3 Depth discipline

- **Source.**
  - Prefer subtle depth; depth suits large elements (tab bar, toolbar) and "may not work as well on small objects"; never give text depth [official, [HIG Spatial layout][hig-spatial]].
  - "People need to refocus their eyes to perceive each difference in depth", so use few depths [official, [HIG Spatial layout][hig-spatial]].
  - Keep interactive content at one depth. A modal appears at the original distance [official, [WWDC23-10073][wwdc23-10073]].
  - Conflicting depth cues cause discomfort [official, [WWDC23-10078][wwdc23-10078]].
- **Rule.**
  - **≤ 4 distinct depths at rest** on any route (0 is one of them). Transient presentations (menus, sheets, alerts) may add one more while open.
  - Pop containers only.
  - Every lift has a shadow sized by its depth.
  - Gamepad focus changes depth only on content cards and Home icons.
- **On the Frame.**
  - The Frame's optics have a fixed focus, so only vergence changes. Even so, each depth step is a vergence change.
  - D2 §3.8 already fits: the Library at rest is 0 / +15 / +25 mm; Home is +10 / +25 mm.
- **Agent check.** P-46 to P-51 (`__LGS_SG.dump()`; computed `box-shadow` against `dz`).

### 2.4 Motion comfort

- **Source.**
  - Avoid motion at the edges of the field of view; make large moving objects translucent; use fades to relocate; never rotate the world; avoid sustained oscillation, especially near 0.2 Hz [official, [HIG Motion][hig-motion], [WWDC23-10078][wwdc23-10078]].
  - Avoid head-locked content; if unavoidable, keep it small, central and far, or lazy-follow [official, [WWDC23-10078][wwdc23-10078], [HIG Spatial layout][hig-spatial]].
  - Slow down transitions from dark to bright scenes [official, [WWDC23-10078][wwdc23-10078]].
  - Under Reduce Motion, avoid zooms, multi-axis motion, spinning and persistent background motion [official, [WWDC23-10034][wwdc23-10034]].
- **Rule.** Nothing moves at rest. No surface wider than 600 px moves laterally by more than 24 px. Nothing enters from the periphery. Nothing is head-locked by us. A rise in brightness of more than 80 L takes ≥ 300 ms. Reduce Motion leaves fades only.
- **On the Frame.**
  - Steam's 40 % library tab slide moves about 40 cm of panel sideways (MO §0). It must go.
  - SteamVR's volume HUD is head-locked 0.4 m below and 0.8 m ahead of the eyes (SY A.6). That is SteamVR's, small and transient, and stays out of scope. Our own layers never head-lock.
- **Agent check.** P-52 to P-58 (`document.getAnimations()`, keyframe audit, filmstrips per MO §10, SG dump for head-relative parents).

### 2.5 Fewer, larger things (density)

- **Source.**
  - At least 60 pt of target area; centres 60 pt apart, or a 16 pt margin [official, [HIG Eyes][hig-eyes]].
  - Choose a window size that minimises empty areas [official, [HIG Windows][hig-windows]].
  - Long iPad lists worked poorly on visionOS and became grids [community, [Varrall][varrall]].
  - Progressive disclosure keeps layouts clean [official, [HIG Layout][hig-layout]].
- **Rule.**
  - At most **7 visible rows per column**: 72 + 8 px rows in the 556 px under the toolbar row give 6.95.
  - About **30 interactive targets** per window at rest, excluding the keyboard and web content.
  - Page, group or disclose the rest.
- **On the Frame.** The window is 960 × 540 pt (VR §1.4). Stock Steam settings show 13+ rows of 42 px and a 47-row filter dialog (LA). Both fail.
- **Agent check.** P-32, P-33 (DOM counts per route).

### 2.6 Content first, chrome recedes

- **Source.**
  - Tab bars and toolbars "push outside the window"; ornaments sit slightly in front; ornaments use borderless buttons [official, [WWDC23-10072][wwdc23-10072], [WWDC23-10076][wwdc23-10076]].
  - Ornaments hide only while people focus on one piece of content [official, VR §4].
  - "Spatial doesn't mean buttons and UI should be arbitrarily floating"; content and UI stay in a window, and tab bars and toolbars stay anchored to it [official, [WWDC24-10086][wwdc24-10086]].
  - Solid window backgrounds are "visually distracting and uncomfortable" [official, [WWDC24-10086][wwdc24-10086]].
  - Controls get Liquid Glass, and a scroll-edge effect replaces opaque bands [official, [HIG Layout][hig-layout]].
- **Rule.**
  - No full-width header or footer bands.
  - Chrome sits in corners and in ornaments, attached to the window.
  - Content (art, posters, web) is opaque, rounded and centred, and never glass.
- **On the Frame.** This is the ornament-margin technique (VR §3.3, D2 §3.2).
- **Agent check.** P-81, P-87 (DOM band sweep, fill alpha).

### 2.7 Hierarchy through material, space and depth, not lines

- **Source.**
  - Darker material for sidebars, lighter for interactive elements, darker for input fields; don't stack lighter materials [official, [WWDC23-10076][wwdc23-10076]].
  - "Instead of relying on decoration, hierarchy should be expressed through layout and grouping" [official, VR §15].
  - Avoid thick outlines or effects that call attention to the edges [official, [WWDC23-10073][wwdc23-10073]].
- **Rule.**
  - Panes are separated by a step of ≥ 8 L in material with no line.
  - Rows are separated by space.
  - Nothing thinner than 2 CSS px.
  - No glass inside glass.
- **On the Frame.** VR §15 and D2 §6.2 give the recipe; here it becomes the checks.
- **Agent check.** P-42 to P-45.

### 2.8 Familiarity and staying grounded

- **Source.**
  - Strike a balance with what's familiar: sidebars, tabs, search fields [official, [WWDC23-10072][wwdc23-10072]].
  - Things that look the same behave the same, and are found in the same place (close is always top left on the Mac) [official, [WWDC26-250][wwdc26-250]].
  - Anchor content in the world, not to the head; let people stay put; rely on recentring [official, [WWDC23-10072][wwdc23-10072]].
  - Prefer standard components [official, [HIG Eyes][hig-eyes]].
- **Rule.**
  - Back and close at the top left on every route.
  - The primary action in the same slot on routes of the same type.
  - Standard symbols (magnifier, chevron, xmark, ellipsis), never text for Back or Close.
  - Steam's button conventions kept (§1.4).
- **On the Frame.** The window, ornaments and bar stay world-anchored where SteamVR puts them.
- **Agent check.** P-82, P-60 (DOM position of Back and Close per route; primary-action slot per route type).

### 2.9 Dimensionality used sparingly: one key moment per surface

- **Source.**
  - Find "a key moment" that only spatial can deliver (Photos: a photo grows and dims the surroundings) [official, [WWDC23-10072][wwdc23-10072], [WWDC24-10086][wwdc24-10086]].
  - Use the minimum immersion a moment needs [official, [HIG Designing for visionOS][hig-visionos]].
  - Use 3D content sparingly in windows [official, [HIG Layout][hig-layout]].
- **Rule.** Each surface has at most one "spatial moment", and everything else stays a calm window. Examples:
  - the Home ramp (circle to card);
  - the game-page hero with its Play capsule;
  - the menu morph.
- **On the Frame.** Not every row lifts and not every tile has parallax. A grid where every card floats is noise.
- **Agent check.** P-46 (depth count); reviewer judgement on mockups for the single key moment (MOCK).

### 2.10 Rounded shapes and generous spacing

- **Source.** Rounded shapes keep the eyes at the centre of an element. Sharp corners pull attention outward [official, [HIG Eyes][hig-eyes], [WWDC23-10073][wwdc23-10073]].
- **Rule.** Icon-only controls are circles, text controls are capsules, and vertical stacks are rounded rectangles (VR §11). Nested corners are concentric.
- **Agent check.** P-83.

### 2.11 Multiple ways to interact

- **Source.**
  - "Always give people multiple ways to interact" [official, [HIG Eyes][hig-eyes]].
  - Make everything, "even the UI", reachable with the game controller [official, [WWDC24-10094][wwdc24-10094]].
  - Offer alternatives to gestures [official, [HIG Accessibility][hig-a11y]].
- **Rule.** Every function has a laser path and a gamepad path. Nothing is reachable by hover alone. No action lives only in a footer legend.
- **Agent check.** P-20, P-89 (`L.pad` traversal; CSS twin audit; function tables in the concepts).

---

## 3. System experience patterns

Each pattern lists what the user sees, the motion, the documented sizes, and what to borrow.

### 3.1 Home view and the app grid

- **Sees.**
  - Circular, three-layer icons in a windowless 4-5-4 honeycomb, 13 per page (VR §19).
  - "When people look at them, they expand", and the specular and shadows deepen the gap between layers [official, [WWDC23-10076][wwdc23-10076]].
  - A tab bar on the left (Apps, People, Environments).
  - Folders (visionOS 26): drag one icon onto another; a folder holds pages of up to seven apps in a honeycomb [press, [MacStories 26][macstories-26]].
- **Motion.**
  - The look-expand is immediate.
  - Environment icons use a ramp: a slow scale, then a pop open [official, [WWDC25-303][wwdc25-303]].
  - Pages change with a swipe or the Sense thumbstick [press, [9to5Mac][9to5-psvr2]].
  - visionOS 27 made "no improvements to the Home Screen" [press, [Cult of Mac][cultofmac-27]].
- **Sizes.** VR §19 and D2 §3.5.
- **Borrow.**
  - The ramp as specified in D2 §3.5: highlight now, lift after ≥ 80 ms of laser dwell or at once on gamepad focus, reveal at 0.8 s.
  - LB/RB and stick paging.
  - **An opened collection shows ≤ 7 items per page in a 1 + 6 honeycomb**, as visionOS folders do, instead of a scrolling grid (LA's folder circle stays the closed state).

### 3.2 System search (Spotlight)

- **Sees.**
  - Opened from Control Center's magnifier, Spotlight is a search field that offers "suggestions based on your app usage" before you type and "updates results as you type"; voice is offered [official, [Support: Search][sup-search]].
  - WWDC26 search guidance [official, [WWDC26-292][wwdc26-292]]:
    - show recent searches when the field is focused;
    - show predictive suggestions that complete the query, with the typed part distinguished;
    - narrow with a scope bar or tokens;
    - show a "no results" view that echoes the query.
  - A dedicated search tab may open the keyboard at once only when people usually know what they want [official, [WWDC26-292][wwdc26-292]].
- **Motion.** The field is focused, and results stream in place. The window never changes.
- **Sizes.** VR §9 and D2 §7.5.
- **Borrow.**
  - The zero state (recent searches plus top library suggestions).
  - Live results.
  - Steam's categories as a scope bar.
  - A no-results view that names the query.
  - The keyboard opens on activation, never on arrival (VR §9).

### 3.3 The virtual keyboard

- **Sees.**
  - A separate window you move by its window bar and resize from its bottom corners [official, [Support: Enter text][sup-text], [HIG Virtual keyboards][hig-vkb]].
  - The typed text shows in "the preview at the top of the keyboard".
  - Keys are raised above a platter. Hover brightens a key as a finger approaches.
  - Pinch-and-hold reveals accents.
- **Motion and sound.**
  - At contact the key moves down in z with a matching spatial sound [official, [WWDC23-10073][wwdc23-10073]].
  - The system varies the pitch and volume of key sounds so fast typing doesn't sound mechanical [official, [HIG Playing audio][hig-audio], [WWDC23-10271][wwdc23-10271]].
- **Sizes.** Key sizes and the default placement are unpublished [unconfirmed].
- **Borrow.**
  - The echo row (D2 §7.5, already adopted).
  - Raised keys (D2 §7.15).
  - A depress on press: a 1–2 mm z step or brighten-and-darken, not a swell.
  - Contiguous key hit regions (I-4).
  - Steam's typing sound, kept.
  - Per-key haptic ticks only if Steam's keyboard Haptics setting is on.

### 3.4 Notifications

- **Sees.**
  - A notification appears "at the top of your view" showing the app. "Look at it to see more information"; pinch and hold to expand it and act (reply); tap to open the app. A persistent banner style keeps important apps' notifications up until handled [official, [Support: Notifications][sup-notif]].
  - visionOS 27: preview a notification by looking at it, then expand it to act [press, [MacStories 27][macstories-27], [MacRumors 27][macrumors-27]].
  - Notification Center lives in Control Center (§3.5).
- **Motion.** In place. It expands on a look (a ramp).
- **Borrow.**
  - Steam toasts arrive **compact** (icon + one line).
  - After a 0.8 s laser hover, a toast expands to show its body and actions (Accept or Decline an invite).
  - Toasts never slide in (D2 §3.7, MO §4.10).
  - Persistent only for actionable items (invites).

### 3.5 Control Center

- **Sees.**
  - A palm flip opens it (visionOS 2+) [official, VR §20].
  - visionOS 26 shows the full panel at once [press, [MacStories 26][macstories-26]].
  - visionOS 27 has three panes: time, Now Playing and notifications; controls; environment [press, [MacStories 27][macstories-27]].
  - The collapsed status indicator is head-anchored by default, and moves freely when people prefer no head anchoring [official, [WWDC23-10034][wwdc23-10034]].
- **Sizes.** VR §20 (measured) and D2 §3.6.
- **Borrow.**
  - Everything appears at once, with no staged slides.
  - Notifications in the left tile.
  - One close circle below.
  - The bar's status cluster stays **world-anchored** (it is part of the bar), never head-locked.

### 3.6 Alerts and confirmation

- **Sees.**
  - In the Shared Space an alert appears "in front of the app's window, slightly forward along the z-axis" and stays anchored to the window; the accessory view is ≤ 154 pt [official, [HIG Alerts][hig-alerts]].
  - Use alerts for critical, actionable information. Warn before an **unexpected** irreversible loss, not when loss is the expected result. Confirm completion only for significant actions. Explain why an action failed [official, [HIG Feedback][hig-feedback]].
  - Confirm before destructive actions, and use interruptions sparingly [official, [WWDC26-250][wwdc26-250]].
- **Borrow.**
  - Alerts only for destructive or irreversible actions and for failures.
  - At most 3 buttons.
  - Default focus on the non-destructive choice.
  - The destructive action in a red whole fill.
  - +30 mm, with the parent dimmed (D2 §3.7).

### 3.7 Window controls

- **Sees.**
  - A window-bar pill under each window.
  - A **dot next to the window bar becomes a close button when you look at it**. Pinch and hold it to choose Close or Hide Other Apps.
  - Look at a bottom corner and a curved resize handle appears.
  - Dragging the bar moves the window, which turns to face you [official, [Support: Move, resize, close][sup-windows], [WWDC23-10072][wwdc23-10072]].
  - visionOS 26 can lock windows to walls; locked windows hide the grabber [press, [MacStories 26][macstories-26]].
- **Borrow.**
  - SteamVR's rarely used frame controls rest as quiet dots or dimmed glyphs and become full 60 px circles on hover (laser) or focus (gamepad): the close-dot pattern.
  - The resize corner appears on hover only (SteamVR already hides it until the laser is near [unconfirmed]).
  - The window-bar pill is in D2 §7.13.

### 3.8 App launch and close

- **Sees.**
  - The system places the first window "in a convenient location in front of them" [official, [HIG Eyes][hig-eyes]].
  - Glass "materializes" rather than fading (VR §18).
  - The exact launch and close choreography (Home receding, the window growing) is unpublished [unconfirmed].
- **Borrow.**
  - Launching a game keeps Steam's own launch transition and sound (`deck_ui_launch_game`, §4.2).
  - Our layers dematerialize in place within ≤ 350 ms (MO §4.11). Nothing slides away.

### 3.9 Look to Scroll and the scroll edge

- **Sees.**
  - Look to Scroll (visionOS 26) scrolls when you look near the top, bottom or sides of a scroll view. Apps opt in per view: reading and browsing yes, control lists and dense information no. Speed is adjustable. It turns off while editing [official, [HIG Scroll views][hig-scroll]; press, [MacStories 26][macstories-26]].
  - The scroll indicator is small, fixed and appears only while scrolling. Looking at it and dragging gives a jog bar for speed [official, [HIG Scroll views][hig-scroll]].
  - Liquid Glass uses a scroll-edge effect instead of opaque bands [official, [HIG Layout][hig-layout]].
- **Borrow.**
  - The scroll-edge effect (D2 §6.7).
  - The transient indicator (VR §3.2).
  - **Don't** port Look to Scroll to the laser (I-9). The letter scrubber in the library (home-apps concept) is the jog-bar analogue.

### 3.10 Widgets (visionOS 26)

- **Sees.** Widgets are 3D objects pinned to walls or tables that persist across restarts [official, [HIG Widgets][hig-widgets]]:
  - sizes: small 158 × 158 pt is 268 × 268 mm at 100 %;
  - elevated or recessed mounting;
  - paper (lit by the room) or glass (foreground always bright) treatment;
  - two proximity thresholds: at a distance, fewer details, larger type and no buttons; nearby, full detail;
  - people scale them from 75 to 125 %.
  - visionOS 27 adds an extra-small size [press, [MacRumors 27][macrumors-27]].
- **Borrow.**
  - The **paper vs glass** split matches our content vs chrome rule: art is paper and responds to the room; chrome is glass with steady, bright labels.
  - The **distance threshold** argues for a simplified, larger dashboard bar status (clock, battery) that reads at a glance (D2 §7.14).
  - Steam has no widget surface, so nothing else applies.

### 3.11 What visionOS 27 changed in system UI

| Change | Source | Relevance |
|---|---|---|
| **Curved windows** for large windows (Safari, Freeform, TV Multiview) that "arc around your position for more comfortable viewing at larger sizes" | [press, [MacStories 27][macstories-27]]; no public API (VR §3.1) | SteamVR already curves the dashboard (VR §3.2). Describe it, don't set it |
| **Control Center in three panes** | [press, [MacStories 27][macstories-27]] | D2 §3.6 already follows it |
| **Notifications expand on a look** | [press, [MacRumors 27][macrumors-27]] | §3.4 |
| **Siri as a placeable orb**, with answers as "floating panels of glass, without a defined window shape" | [press, [Cult of Mac][cultofmac-27]] | Precedent for **windowless glass cards** for transient results (search's Top Hit card, the Home card ramp) |
| Extra-small widgets; unfoveated screen recording; faster Wi-Fi; no Home View changes | [press, [MacRumors 27][macrumors-27], [Cult of Mac][cultofmac-27]] | None |
| Custom spatial accessories SDK (LED constellation + IMU + haptics) | [official, [WWDC26-287][wwdc26-287]] | Confirms Apple's direction: tracked controllers with haptics, eyes still targeting system UI |

---

## 4. Feedback: sound, then haptics

### 4.1 What visionOS does with sound

- Vision Pro "plays sound effects when you interact with the controls", for example when you open an app. Users turn them off in Accessibility › Audio & Visual [official, [Support: Sounds][sup-sounds]].
- "Prefer playing sound": an app without sound "can feel lifeless". Custom elements get custom sounds. Never carry important information by sound alone [official, [HIG Playing audio][hig-audio]].
- "A good UI sound has to be subtle", matches the system's sounds and is timed to the transition. Sounds heard often get randomised pitch and volume [official, [WWDC23-10271][wwdc23-10271]].
- Sound replaces the missing touch for direct interactions [official, [WWDC23-10073][wwdc23-10073]].
- Vision Pro has no haptics. Spatial accessories add haptics for apps [official, [WWDC25-289][wwdc25-289]]. Whether visionOS system UI plays Sense haptics is [unconfirmed].

### 4.2 Steam already has the vocabulary

Steam's gamepad UI plays these sounds (file names from the DeckThemes AudioLoader documentation [community, [DeckThemes][deckthemes]]). They honour Steam › Audio › UI sounds (SY):

| Steam sound | When Steam plays it |
|---|---|
| `deck_ui_misc_10` / `deck_ui_navigation` | Focus moves (most areas / settings) |
| `deck_ui_default_activation` | Most activations |
| `deck_ui_bumper_end_02` | Focus can't move further |
| `deck_ui_show_modal` / `deck_ui_hide_modal` | A pop-up appears / closes |
| `deck_ui_side_menu_fly_in` / `_fly_out` | Steam or Quick Access menu opens / closes |
| `deck_ui_tab_transition_01` | Switching tabs |
| `deck_ui_switch_toggle_on` / `_off` | Toggles |
| `deck_ui_slider_up` / `_down` | Slider changes |
| `deck_ui_into_game_detail` / `deck_ui_out_of_game_detail` | Game details in / out |
| `deck_ui_launch_game` | Launching a game |
| `deck_ui_toast`, `deck_ui_achievement_toast` | Toasts, achievements |
| `deck_ui_typing` | Keyboard |

### 4.3 Haptic principles

Apple's haptic principles [official, [HIG Playing haptics][hig-haptics], [WWDC24-10094][wwdc24-10094]]:

- Use patterns according to their meaning, consistently.
- Complement the visual and audio.
- "Avoid overusing haptics."
- Prefer short haptics for discrete events.
- "Make haptics optional."
- For games, rumble should match the on-screen action.

macOS's trackpad haptics are a close analogue for a pointer: *alignment* (snapping, reaching an end), *level change* and *generic*.

The Frame controllers have haptics. Whether Steam's CEF page can trigger them is [unconfirmed] (§1.6). The Steamworks Input API exposes haptic pulses of at most 65 ms and rumble [community, [Steamworks ISteamInput][steamworks-input]].

### 4.4 Mapping [ours]

The base vocabulary comes from DL §6 (the native showcase): tick 0.12/12 ms, tap 0.35/20 ms, click 0.55/30 ms.

| Event | Visual (always) | Sound | Haptic (if a path exists) |
|---|---|---|---|
| Laser enters an **enabled control** (not a row in a list it sweeps across faster than one target per 80 ms) | Hover look | None. visionOS plays no hover sound; suppress Steam's nav sound in laser mode if it fires (§1.6) | **Tick** 0.10–0.12, 10–12 ms. ≥ 80 ms between ticks |
| Gamepad focus moves | Focus look | Steam's nav sound (unchanged) | None. The button press is already tactile |
| Activation (trigger or A) | Press glow | `deck_ui_default_activation` | **Tap** 0.35, 20 ms |
| Toggle on / off | Knob travel, colour fill | `switch_toggle_on/off` | Tap 0.30, 15 ms (on); tick (off) |
| Slider detent (gamepad) / slider drag | Value fill | `slider_up/down` | Tick per detent, ≤ 15 Hz. During a laser drag: a tick only at the ends (the macOS *alignment* analogue) |
| Focus can't move (edge of a list or grid) | None (no shake, M3) | `bumper_end_02` | **Thud** 0.45, 25 ms, low frequency |
| Menu or popover opens | Morph | (none in Steam for menus) | None |
| Sheet or alert appears | Materialize, scrim | `show_modal` | Tap 0.20, 15 ms (alerts only) |
| Sheet or alert closes | Dematerialize | `hide_modal` | None |
| Tab or segment changes | Pill travel | `tab_transition_01` | Tick |
| Toast arrives | Materialize in place | `deck_ui_toast` | None (status is passive, [HIG Feedback][hig-feedback]) |
| Invite or message toast (actionable) | Same | Steam's chat sounds | Tap 0.25, 15 ms, once |
| Achievement | Toast | `achievement_toast` | Two taps 60 ms apart |
| Action unavailable or failed | Unavailable state or an alert | (Steam's) | Two thuds 60 ms apart |
| Launch a game | Our layers dematerialize | `launch_game` | **Click** 0.55, 30 ms |
| Key typed | Key depress | `deck_ui_typing` | Tick, only if Steam's keyboard Haptics setting is on |

Limits:

- At most 1 pulse per 80 ms.
- No pulse longer than 50 ms except launch.
- No haptic during continuous scrolling.
- A Glass Shell "haptics off" switch alongside Steam's settings.
- Never add new sound files. The sound policy is "same events, same Steam sounds, for our restyled and new controls".

---

## 5. Anti-patterns: "2D app in a headset" smells

These are the things that made Phase 1 read as "just a skin". Each has a detection that an agent can run. Detection codes are defined in §6.

| # | Smell | Why it reads as 2D (source) | Detection |
|---|---|---|---|
| A-1 | **Tiny controls** (30–48 px buttons, 33 px tabs) | Targets under 60 pt are hard to look at and point at [official, [HIG Eyes][hig-eyes]] | DOM: visible focusables < 60 px on the short side; `audit` SHRUNK |
| A-2 | **Dense lists** (42 px rows, 13+ rows in a column) | iPad density in a 960 × 540 pt window [official, VR §1.4]; lists became grids on visionOS [community, [Varrall][varrall]] | DOM: row pitch < 72 px, or > 7 visible rows per column |
| A-3 | **Edge-to-edge chrome bands** (40 px header, footer legend band, full-width search strip) | visionOS pushes chrome outside or into corners [official, [WWDC23-10072][wwdc23-10072]]; REF top finding 3 | DOM: an element ≥ 90 % of the glass width, ≤ 120 px tall, with a visible fill, within 0–80 px of the top or bottom of the glass |
| A-4 | **Hairline separators and 1 px rings** | They shimmer at 0.6 display px per CSS px (VR §1.5) and call attention to edges [official, [WWDC23-10073][wwdc23-10073]] | DOM: border or outline width in (0, 2); elements ≤ 1.5 px tall with a fill; `box-shadow` with 0 blur and ≤ 1 px spread |
| A-5 | **Square and rectangular buttons** | "the more rounded a button's shape, the easier it is" to look at [official, VR §11] | DOM: icon-only controls with radius < 0.48 × the short side; text buttons with radius < 0.45 × height, outside vertical stacks and keyboard keys |
| A-6 | **Text-only "Back", "Close", "Cancel" in chrome** | Standard symbols, never words [official, VR §6] | DOM: a visible button whose text matches `/^(back\|close\|done\|cancel)$/i` in the top 120 px of the glass |
| A-7 | **Modal stacks** (dialog on dialog, or a sheet with a nested sheet) | visionOS discourages a second modal; push inside one sheet [official, VR §17] | DOM: count of visible modal or sheet containers > 1 (alerts on a sheet are allowed) |
| A-8 | **Desktop scrollbars** | The visionOS indicator is small, fixed and transient [official, [HIG Scroll views][hig-scroll]] | DOM: scrollers with `offsetWidth − clientWidth > 0`, or a visible custom scrollbar element at rest |
| A-9 | **Desktop drop-downs** (a list hanging under a field, 40 px rows, opening downward from the bottom of the window, native `<select>` popups) | Menus pop from their source as glass bubbles and can leave the window [official, VR §17, [HIG Menus][hig-menus]] | DOM after open: rows < 60 px; menu rect not within 40 px of its source; a `select` popup; a menu wider than 50 % of the window |
| A-10 | **Tooltips everywhere** (on text buttons, or instant) | Tooltips are for icon-only buttons, after a delay [official, VR §11] | DOM/CSS: tooltip or title on an element with visible text; tooltip delay < 0.6 s |
| A-11 | **Outlines on glass** | Glass edges come from light, not strokes [official, VR §15] | DOM: `border-width` > 0 or `outline-style` ≠ none on glass containers; SHOT edge profile shows a closed ring |
| A-12 | **Opaque, flat window panels** | "solid backgrounds on windows" are uncomfortable [official, [WWDC24-10086][wwdc24-10086]] | DOM: window or panel fill alpha > 0.84 (T1) outside Increase Contrast |
| A-13 | **Coloured small text on glass** | Colour on glass fails first [official, [WWDC23-10076][wwdc23-10076]]; [community, [ArcTouch][arctouch]] | DOM: text with HSL saturation > 0.35, under 24 px or under weight 600 (excluding red destructive labels ≥ 22 px Semibold) |
| A-14 | **Uppercase, letter-spaced, italic chrome** | No reference shows any (REF top finding 7) | DOM: `text-transform: uppercase`, `letter-spacing` > 0.01 em, `font-style: italic` in chrome |
| A-15 | **Everything on one plane** (or everything popped) | Depth shows hierarchy, sparingly [official, [HIG Spatial layout][hig-spatial]] | SG: zero popped layers on a route with ornaments, or > 4 distinct depths at rest |
| A-16 | **Hover-only or legend-only paths** | Multiple ways to interact [official, [HIG Eyes][hig-eyes]] | CSS: `:hover` reveals without a gamepad twin; concept function tables: legend-only rows |
| A-17 | **Pulsing focus, shimmering cards, animated heroes** | Nothing moves at rest; peripheral motion pulls the eyes [official, [HIG Eyes][hig-eyes], [HIG Motion][hig-motion]] | DOM: `getAnimations().length > 0` 1 s after an interaction; two shots 1.5 s apart differ |
| A-18 | **Full-width slides and zooms between pages** | Large moving fields cause vection [official, [WWDC23-10078][wwdc23-10078]] | Keyframe audit: translate > 24 px on surfaces > 600 px wide; scale change > 1.5 % on the window |
| A-19 | **Actions far from their content** (Manage menu 18° from its gear; Play at −15.5°) | Show a menu near the content it controls [official, [HIG Menus][hig-menus]]; centre what matters [official, [WWDC23-10076][wwdc23-10076]] | DOM: menu-to-source gap > 40 px; primary action outside \|x − 640\| ≤ 400 |
| A-20 | **Heavy black scrims** (Steam's .85) | Subtle dimming keeps people grounded [official, VR §22] | DOM: scrim alpha > 0.45 |
| A-21 | **Big white areas** | They glare in a dark room (VR §22) | SHOT: pixels with L > 230 over > 4 % of the window outside content art |
| A-22 | **Glyph legends as the only language** (X FILTER Y SORT) | They teach console buttons, not actions; the laser has no path (WN §2) | DOM: footer legend items that are not real buttons; glyph badges visible in laser mode |
| A-23 | **Focus you can't find** | tvOS focus is elevation + illumination; one obvious item [official, [HIG Focus][hig-focus]] | SHOT: focus luma delta < +40 L; more than one element at > 50 % focus contrast at rest |

---

## 6. Conformance checklist

**Verification codes**

| Code | Meaning |
|---|---|
| **AUD** | `python glass.py audit SURF --route R --json`: HIDDEN / SHRUNK / UNCLICKABLE / GONE / CONTRAST (themed vs stock) |
| **DOM** | A CDP DOM sweep through `python glass.py js '…'` with the lab helpers `L` (`getBoundingClientRect`, `getComputedStyle`, `document.getAnimations`). The predicate is given in the row. In mockups, run the same predicate in the headless page with the `.lgk-overlay` origin subtracted |
| **CSS** | A stylesheet rule audit (`theme/*.css` and `document.styleSheets` read through `js`). Used where the device can't synthesise the state (laser `:hover`, LA §0.4) |
| **SHOT** | `python glass.py shot SURF NAME --route R --pre JS`: 1920 × 1080, so CSS px × 1.5. Luma L = 0.299 R + 0.587 G + 0.114 B (0–255), averaged inside the element's rect inset by 6 shot px. Compare state pairs (rest / focused / selected) in one shot or two shots of the same frame |
| **PAD** | `L.pad(dir, n)` traversal with `L.focused('main')`. B through `FocusNavController.DispatchVirtualButtonClick(2)` (inventory social §0). Never A on a launch path |
| **SG** | `__LGS_SG.dump()`: scene-graph nodes, `dz` and flags |
| **HV** | `hvgrab` headset-view frame (look, then delete; D2 §11.9) |
| **FILM** | A motion filmstrip per MO §10 / D2 §11.9 |
| **MOCK** | Mockup inspection: `tools/mockshot.py` render, kit state classes (`is-hover`, `is-focus`, `is-selected`, `is-nav-selected`), `#annot` depth labels |
| **REV** | Spec or code review, where no runtime check exists |

**Scope.**

- Main-window px unless marked. For other surfaces multiply by m (D2 §2.5).
- Web content (`/steamweb`, `/externalweb`, store pages) is content: it is exempt from size, type and outline checks, but not from chrome checks.
- "Must" items gate a release. "Should" items are scored.

### 6.1 Input: laser (P-01 to P-12)

| ID | Requirement | Sev | Verify | Ref |
|---|---|---|---|---|
| P-01 | Hover and focus looks are keyed on the **input mode** (a root class set from `IsInGamepadNav`), not on `.gpfocus` alone. Every rule that paints `.gpfocus` has a laser-mode variant and a gamepad-mode variant | must | CSS: list the selectors that contain `.gpfocus`; each is scoped by the mode class or paired with one | §1.2, I-5, §7 D-1 |
| P-02 | In laser mode a highlight shows only while the laser is on the element: laser-mode `.gpfocus` paint requires `:hover` | must | CSS: laser-mode focus rules include `:hover` | I-5, §7 D-9 |
| P-03 | The laser hover look is subtle: + 10 to + 25 L over rest on controls and rows. It reaches 90 % within 130 ms | must | MOCK (`is-hover` vs rest, SHOT luma); CSS: transition is `hover-in` (D2 §11.2) | I-3, VR §12 |
| P-04 | No hover or focus effect moves a hit box away from its rest geometry: no `translate` on hover or focus; scale ≥ 1; the rest rect is contained in the hovered or focused rect | must | DOM: rect at rest vs rect with `.gpfocus` (INV-A §0 helper) for every focusable on the route | I-3 |
| P-05 | Rows, list cells, toolbar buttons, tabs and menu rows never scale or lift on hover or focus | must | CSS + DOM: computed `scale`/`transform` = none in the hover and focus states for those classes | VR §12, [official] |
| P-06 | Under the laser, motion-bearing effects (lift, scale, depth) start after ≥ 80 ms; brightness starts at once | should | CSS: `transition-delay` ≥ 80 ms on `scale`/`translate`/depth for laser-mode hover; SG timeline for depth | I-3, §7 D-7 |
| P-07 | In every bar (tab bar, toolbar ornament, segmented control, frame controls) adjacent hit boxes abut: gap ≤ 2 px along the bar axis | should | DOM: sorted hit rects per bar | I-4 |
| P-08 | Hit box ≥ 80 × 80 px (≥ 72 where the quad is fixed), or centre spacing ≥ 80 px with ≥ 21 px clear gap | must | AUD SHRUNK = 0; DOM rect sweep | VR §24.1, D2 §4 |
| P-09 | The light spot follows the hit point only in laser mode. In gamepad mode it is static and centred in the upper third (no stale coordinates) | should | DOM: `--hx/--hy` unchanged across 5 `L.pad` moves in gamepad mode | I-1 |
| P-10 | The light spot is painted **below** the label or glyph layer (the label keeps its colour) | should | CSS: the spot pseudo-element sits beneath the text in stacking order; MOCK zoom | I-2 |
| P-11 | We draw no cursor and never set `hide-laser-intersection` or `hide-laser-when-clicking` on interactive crops | must | SG: flags on our nodes | I-1 |
| P-12 | Tooltips appear only on icon-only controls, after 0.8 s (laser) or 0.8 s of focus, and leave after 0.2 s. No control with visible text has a tooltip | should | DOM: tooltip owners have empty `innerText`; CSS delays | VR §11, A-10 |

### 6.2 Input: gamepad focus (P-13 to P-28)

| ID | Requirement | Sev | Verify | Ref |
|---|---|---|---|---|
| P-13 | In gamepad mode exactly **one** element shows the focus look on every route at rest | must | PAD + SHOT: one element ≥ 50 % of focus contrast | I-5 |
| P-14 | Focus contrast on controls and rows: focused mean L ≥ **+40 L** over the same element at rest, on window glass over the bright and dark test rooms | must | SHOT (rest vs `.gpfocus` pair); MOCK on `data-room` lounge and `data-dim` | I-5, §7 D-2 |
| P-15 | Focus beats selection: focused-unselected ≥ **+15 L** over selected-unfocused of the same component (sidebar row, tab, segment); focused + selected ≥ +10 L over selected | must | SHOT: three states side by side (MOCK states or PAD on a sidebar) | I-6, §7 D-2 |
| P-16 | Focus on a white (toggled or selected) control shows as an outer glow: the mean of the 8–16 px band outside the element ≥ +20 L over rest | should | SHOT band sample | I-6 |
| P-17 | No focus ring or outline except on text and search fields; those get a 3 px soft ring | must | DOM: `outline-style`, ring-like `box-shadow` on `.gpfocus` elements other than inputs | VR §9, D2 §6.2 R4 |
| P-18 | The first rendered frame of focus is ≥ 60 % of final contrast. 100 ms after a move during auto-repeat, at most one element is above 50 % of focus contrast | must | FILM at 0, 33, 100, 200 ms after `L.pad` | MO §4.4, I-7 |
| P-19 | Content cards (posters, capsules, Home icons) show focus as a lift: scale 1.04–1.10 + shadow + depth +15 to +25 mm. Rows and buttons never do | must | DOM computed `scale`; SG `dz` on focus | D2 §7.8, §3.5 |
| P-20 | Traversal reaches every target. Down then Up, and Right then Left, return to the start (except at edges) | must | PAD sweep per route (D2 §12) | §2.11 |
| P-21 | After a menu, sheet or alert closes with B, focus is on its **source** | must | PAD: record the source, open, B, compare `L.focused` | I-8, §1.5 |
| P-22 | On route entry, focus lands on the primary item, never on Back or the tab bar | must | PAD: `L.nav(route)` → `L.focused` | I-8 |
| P-23 | The focused element is never under an ornament. After every move its rect satisfies top ≥ 124 (the 108 px toolbar row + 16) and bottom ≤ 620 (the bottom ornament's top edge at 636 − 16) on routes with a bottom ornament, or bottom ≤ glass bottom − 16 without one | must | PAD sweep + DOM rects | I-9, §7 D-6 |
| P-24 | B closes the topmost transient layer first (menu, then sheet or alert, then page) | must | PAD: open a menu on a page, B: the menu closes and the route is unchanged | I-13 |
| P-25 | Steam's button meanings are unchanged (A, B, X, Y, LB/RB, ≡, Steam/Guide): no remapped handlers | must | REV: no listeners replace Steam handlers; legend dispatch unchanged | §1.4 |
| P-26 | Controller glyph badges are visible **only in gamepad mode**. In laser mode the same buttons show labels only | should | DOM in both modes (toggle the mode class in a mockup; live when the mode flips) | I-18, §7 D-5 |
| P-27 | Glyph badges use Steam's glyph components for the connected controller, not hard-coded letters | should | DOM: badge nodes are Steam's glyph elements or derive from them | §1.4 |
| P-28 | The tab-bar ornament takes focus from the window's left edge (Left) and expands at once on entry. Right or B returns to the window | must | PAD | VR §5, WN §6.1 |

### 6.3 Layout and comfort (P-29 to P-37)

| ID | Requirement | Sev | Verify | Ref |
|---|---|---|---|---|
| P-29 | The primary action (Play, Install, Resume, Confirm) is centred within \|x − 640\| ≤ 400 and 144 ≤ y ≤ 600 | must | DOM rect; MOCK | §2.1 |
| P-30 | The main content block's centroid is within \|x − 640\| ≤ 160 (split views: the detail pane's centroid within ±160 of the pane centre) | should | DOM | §2.1 |
| P-31 | No paragraph text (≥ 2 lines, ≤ 24 px) starts above y = 108 | should | DOM text sweep | §2.1 |
| P-32 | ≤ 7 visible rows per column | must | DOM: count row-class rects fully inside the scroller viewport per column | §2.5, A-2 |
| P-33 | ≤ 30 visible interactive targets in the main window at rest (excluding the keyboard and web content) | should | DOM: count visible focusables | §2.5 |
| P-34 | Nothing of ours is head-locked: no node under a head-relative transform (`pin-to-view-transform`, `elasticheadtransform`, `head-facing-transform`) | must | SG | §2.4 |
| P-35 | Menus and popovers open adjacent to their source: rect gap ≤ 40 px, or overlapping. Sheets and alerts are centred on the glass ±24 px | must | DOM after open | A-19, VR §17 |
| P-36 | Content is horizontally balanced: left and right content insets differ by ≤ 24 px (excluding sidebars and ornaments) | should | DOM | §2.1, [HIG Layout][hig-layout] |
| P-37 | The tab-bar ornament holds ≤ 6 items, and no second ornament sits on the same (leading) edge | should | DOM/popup inventory | VR §5, §7 D-8 |

### 6.4 Legibility and material (P-38 to P-45)

| ID | Requirement | Sev | Verify | Ref |
|---|---|---|---|---|
| P-38 | No text under 18 px; body ≥ 22 px; no weight under 500 | must | DOM computed `font-size`, `font-weight` | VR §13 |
| P-39 | Contrast ≥ 4.5:1 for body text and ≥ 3:1 for titles of 28 px Bold or larger; AUD CONTRAST = 0 over the grey, bright and dark rooms | must | AUD | §2.2 |
| P-40 | No coloured text (HSL saturation > 0.35) under 24 px or under weight 600 on glass. Exception: a red destructive label ≥ 22 px Semibold | must | DOM | A-13 |
| P-41 | Text with no glass behind it (Home labels) is weight ≥ 500 with the on-room shadow | must | DOM | D2 §8.3 |
| P-42 | No `border`, `outline` or uniform 1 px ring on any glass container (Increase Contrast exempt) | must | DOM | VR §15, A-11 |
| P-43 | No line thinner than 2 CSS px anywhere (borders, separators, `hr`, 1 px filled elements) | must | DOM | A-4 |
| P-44 | Adjacent panes differ by ≥ 8 L in material across their boundary, with no line | should | SHOT luma across the boundary (±24 px) | §2.7 |
| P-45 | No glass inside glass: no element with `backdrop-filter` nested in another | must | DOM | D2 rule 6 |

### 6.5 Depth (P-46 to P-51)

| ID | Requirement | Sev | Verify | Ref |
|---|---|---|---|---|
| P-46 | ≤ 4 distinct `dz` values (including 0) among visible layers at rest; +1 while a modal is open | must | SG | §2.3 |
| P-47 | Only containers pop: no crop whose content is only text or a glyph, and none smaller than 60 × 60 px | must | SG + DOM mapping of crop rects | §2.3 |
| P-48 | Every popped layer casts a shadow sized by depth: y-offset 0.4 px/mm and blur 1.2 px/mm, each within ±50 % | must | DOM `box-shadow` vs SG `dz` | VR §16.3 |
| P-49 | Animated depth deltas are ≤ 20 mm; total popped depth is ≤ 80 mm | must | SG timeline | D2 §3.8 |
| P-50 | Gamepad focus moves change depth only on content cards and Home icons | should | SG during a PAD sweep | §2.3 |
| P-51 | Modals keep the eye at one depth: sheets and alerts sit at their spec depth; the parent never moves toward the viewer | must | SG | VR §16, D2 §3.8 |

### 6.6 Motion (P-52 to P-58)

| ID | Requirement | Sev | Verify | Ref |
|---|---|---|---|---|
| P-52 | `document.getAnimations().length === 0` 1 s after any interaction; no infinite or alternate iterations | must | DOM | §2.4, A-17 |
| P-53 | No lateral translate > 24 px on any surface wider than 600 px; no window scale change > 1.5 % | must | CSS keyframe audit + FILM | A-18, MO M1 |
| P-54 | Nothing enters from the periphery: toasts, menus and sheets start ≤ 16 px from their rest position | must | CSS keyframes | MO M2 |
| P-55 | Nothing oscillates (no repeating motion in 0.1–0.5 Hz; bounce ≤ 0.25) | must | CSS + FILM | §2.4 |
| P-56 | Reduce Motion: only opacity transitions of ≤ 200 ms; no scale, translate or depth animation | must | DOM with emulated `prefers-reduced-motion` (inside a lab lock) | D2 §11.4 C8 |
| P-57 | A surface whose mean luma rises by > 80 L does so over ≥ 300 ms | should | FILM | §2.4 |
| P-58 | Every duration and easing is a D2 §11.2 token | must | DOM `getAnimations()` timing vs the token table | D2 §11.9 |

### 6.7 System patterns (P-59 to P-73)

| ID | Requirement | Sev | Verify | Ref |
|---|---|---|---|---|
| P-59 | **Home**: circular icons on the D2 §3.5 lattice (or its documented square fallback); hover or focus is a ramp (highlight now, scale 1.10 + depth, reveal at 0.8 s); page dots; LB/RB and edge moves page | must | DOM + PAD + MOCK | §3.1 |
| P-60 | **Consistency**: Back and Close at the top left on every route; the primary action in the same slot on every route of a type (all game pages, all sheets) | must | DOM positions across ≥ 3 routes of each type | §2.8 |
| P-61 | **Collections**: an opened collection shows ≤ 7 items per page in a 1 + 6 honeycomb, or uses the Home lattice; empty collections are dimmed and last | should | DOM + MOCK | §3.1 |
| P-62 | **Search**: a capsule ≥ 64 px with a leading magnifier and an upright placeholder; a clear button appears with text; a zero state with recent searches or suggestions before typing; results update per keystroke; a no-results view echoes the query | must | DOM on `/search` states; MOCK | §3.2 |
| P-63 | **Keyboard**: never opens on arrival, only on activation; typed text is echoed on the keyboard slab; key hit boxes abut (gap ≤ 2 keyboard px) | must | DOM; PAD on the search field (navigation only) | §3.3 |
| P-64 | **Menus**: grow from the source; the source turns white while open; rows ≥ 72 px with ≥ 6 px between; leading symbols; the current value checked; open upward from bottom ornaments; never a native `select` popup | must | DOM after open; MOCK | VR §17, A-9 |
| P-65 | **Dismissal**: a laser click outside or B closes menus and popovers; an outside click does **not** close sheets or alerts | must | REV + DOM (B via PAD) | I-13 |
| P-66 | **Sheets**: one at a time (push inside); a Close or Back circle at the top left; parent scrim alpha 0.30–0.40 | must | DOM | VR §17, A-7, A-20 |
| P-67 | **Alerts**: used only for destructive or irreversible actions and failures; ≤ 3 buttons; left-aligned title and body; destructive action in a red whole fill; **default focus on the non-destructive choice** | must | DOM + PAD (`L.focused` on open) | §3.6 |
| P-68 | **Toasts**: compact on arrival (icon + one line, ≤ 80 popup px tall); expand on 0.8 s of laser hover when they have more; materialize in place; actionable ones persist until handled | should | DOM + MOCK | §3.4 |
| P-69 | **Control Center**: tiles appear together (no staged slide); toggles are circles with a whole-fill on state; sliders are ≥ 64 px capsules with the glyph inside the fill; one close circle below | must | DOM + MOCK | §3.5, D2 §3.6 |
| P-70 | **Window controls**: rarely used frame controls rest quiet (≤ 50 % opacity glyph or dot) and become full circles on hover or focus; the resize corner appears only on hover; the window-bar hit area is ≥ 80 px tall | should | DOM on `vr:systemui`; MOCK | §3.7, D2 §7.13 |
| P-71 | **Launch**: launching a game keeps Steam's launch transition and sound; our layers dematerialize in place in ≤ 350 ms (no slide) | must | FILM (do not actually launch: inspect the code path and the keyframes) | §3.8 |
| P-72 | **Scrolling**: no visible scrollbars at rest; any indicator is a ≤ 8 px capsule on the trailing edge, shown only while scrolling | must | DOM (`offsetWidth − clientWidth`, indicator opacity at rest) | A-8 |
| P-73 | **Scroll edge**: content under the toolbar row and the bottom ornament fades through the scroll-edge effect; no opaque band and no hard clip | should | SHOT luma gradient across the band | D2 §6.7 |

### 6.8 Feedback (P-74 to P-79)

| ID | Requirement | Sev | Verify | Ref |
|---|---|---|---|---|
| P-74 | Restyled and new controls fire the **same Steam UI sounds** as Steam's own for the same event (activation, toggle, slider, modal show/hide, tab, bumper end); no new sound files; Steam's UI-sounds toggle is honoured | must | DOM: a read-only wrapper counts `PlayNavSound` calls during a scripted PAD sequence (if exposed); else REV | §4.2 |
| P-75 | No information is carried by sound or haptics alone: every sound or haptic event has a visible state change | must | REV against §4.4 | [HIG Playing audio][hig-audio] |
| P-76 | Haptics follow the §4.4 map only if a CEF path to the controllers exists; no polling or native hacks otherwise | should | REV + capability probe (§1.6) | §4.3 |
| P-77 | Haptic rate limit: ≤ 1 pulse per 80 ms; no pulse > 50 ms except launch; none during continuous scrolling or a fast laser sweep | must | DOM: log wrapper over the haptic call | §4.4 |
| P-78 | Feedback respects settings: Steam's UI sounds, Steam's keyboard Haptics, and a Glass Shell haptics-off switch | must | REV + DOM (settings read) | [HIG Playing haptics][hig-haptics] |
| P-79 | At an edge where focus can't move, Steam's bumper sound plays and (if haptics exist) one 25 ms thud; no visual shake | should | PAD at a list end; DOM wrapper log | §4.4 |

### 6.9 Anti-pattern sweeps (P-80 to P-88)

| ID | Requirement | Sev | Verify | Ref |
|---|---|---|---|---|
| P-80 | No control smaller than 60 px visible on its short side (mini circles of 38–44 px only alone, with an 80 px clear region) | must | DOM | A-1 |
| P-81 | No full-width bands: no element ≥ 90 % of the glass width and ≤ 120 px tall with a visible fill within 80 px of the top or bottom of the glass | must | DOM | A-3 |
| P-82 | No text Back, Close, Cancel or Done buttons in chrome; these are symbol circles (sheet Cancel and Done capsules in a sheet's own toolbar are allowed) | must | DOM text match in the top 120 px | A-6 |
| P-83 | Icon-only controls are circles (radius ≥ 0.48 × the short side). Text controls are capsules (radius ≥ 0.45 × height), except vertical stacks (rounded rectangles) and keyboard keys | must | DOM | A-5, §2.10 |
| P-84 | No uppercase, letter-spaced (> 0.01 em) or italic chrome text | must | DOM | A-14 |
| P-85 | No more than one modal or sheet layer visible (an alert over a sheet is allowed) | must | DOM | A-7 |
| P-86 | Modal scrim alpha ≤ 0.45 | must | DOM | A-20 |
| P-87 | No opaque window or panel fill: alpha ≤ 0.84 in T1 (the dial maximum), the glassd material in T5; Increase Contrast exempt | must | DOM | A-12 |
| P-88 | Badges only for counts that need action (updates, invites, unread); ≤ 3 badges visible per window | should | DOM | VR §5 |
| P-89 | **Parity**: every hover reveal (tooltip, back title, tab labels, card actions, ⋯ circle) has a gamepad-focus twin, and every footer-legend action is also a visible clickable button | must | CSS: each `:hover` reveal rule has a gamepad-mode `.gpfocus` twin; concept function tables have no legend-only row; PAD reaches each | A-16, §2.11 |

**Total: 89 items** (66 must, 23 should).

---

## 7. Disagreements and gaps in `visionos.md` and `DESIGN2.md`

Ordered by impact.

| # | File, section | What is wrong or missing | Evidence | Change |
|---|---|---|---|---|
| **D-1** | D2 §10.1, §8.2; VR §12 (Frame spec table) | Hover and gamepad focus are specified as two states keyed on `:hover` vs `.gpfocus`. **Steam sets `.gpfocus` for the laser too**, so as written a laser hover paints the stronger "focus" look | INV-B §2 ("`.gpfocus`, which laser and controller both set"); INV-A §9; LA §A note | Add an input-mode root class from `IsInGamepadNav` (INV-L §6.1). Laser mode: `.gpfocus` paints the hover look, only with `:hover`. Gamepad mode: the focus look. Make it the first rule of D2 §10 and a T2 deliverable. Check: P-01, P-02 |
| **D-2** | D2 §6.5 (focus add white .14 vs navigation-selected .18), §8.2; VR §12 ("Gamepad focus: Same [as hover], held") | **A focused unselected row is dimmer than a selected unfocused row.** Over glass at L 85: .14 → +24 L, .18 → +31 L. A gamepad user in a sidebar sees the selected row as the "focused" one. VR's "same as hover, held" is weaker still | tvOS focus is "elevation… illumination, and animation" [official, [HIG Focus][hig-focus]]; REF Part H.1 asked for ≥ +45 L | Raise the gamepad focus add to **white ≥ .28** (+48 L), keep selected at .18 and laser hover at .08–.10. Focused + selected composites to about .41. Check: P-14, P-15 |
| **D-3** | D2 §0.2 decision D2 (press swell), MO §4.3 ("Must not… shrink on press") | Swell is taken from **direct-touch** Liquid Glass. Apple's documented press cues for **indirect** input are depress or darken. The Frame has no direct touch in the dashboard | HIG Motion: trackpad gets "a more subdued effect" [official]; iPadOS pointer click scales down and darkens [official, [WWDC20-10640][wwdc20-10640]]; the visionOS key moves down in z [official, [WWDC23-10073][wwdc23-10073]]; tvOS inverts briefly [official] | For laser and gamepad: glow + brighten + either a 1–2 mm z depress (T4) or a swell capped at ×1.02. Keep +6 px / ×1.06 only if hvgrab review prefers it. Medium confidence: Apple has not published visionOS press motion for indirect pinch |
| **D-4** | D2 (no section); VR §11 (one line) | **There is no sound or haptics policy.** visionOS says "Prefer playing sound". Steam already has a full UI sound set. New T2/T3 controls (Home ramp, search sheet, Control Center side tiles) would be silent, so they feel "dead" next to Steam's | [official, [HIG Playing audio][hig-audio], [Support: Sounds][sup-sounds]]; §4.2 | Add a D2 §10.5 "Feedback" that adopts §4.4: same Steam sounds for the same events, no new files, haptics optional and rate-limited, settings honoured. Check: P-74 to P-79 |
| **D-5** | D2 §7.3, §9.4; concepts window-nav §3.4, settings §0, social-media §3.0 | Controller glyph badges are drawn **in every mode**. In laser mode they teach buttons the user isn't holding and add noise to every capsule | "Customize onscreen content to match the connected game controller" [official, [HIG Game controls][hig-gamecontrols]]; iPadOS: distinguish inputs "only if it provides value" [official, [HIG Pointing devices][hig-pointing]]; Steam itself swaps the legend for a laser-mode pill (INV-L §6.1) | Glyph badges in gamepad mode only, keyed on the D-1 class. Check: P-26 |
| **D-6** | D2 §3.2, §6.7 | The ornament overlap (28 px) and the scroll-edge bands are specified, but **focus-follow scrolling is not**. A D-pad user can focus a poster that sits under the bottom ornament or inside the faded band | tvOS and iPadOS keep focus visible; "avoid changing focus" means focus must stay findable [official, [HIG Focus][hig-focus]] | Keep focused items between y 124 (toolbar row 108 + 16) and y 620 (ornament top 636 − 16). Use `scroll-padding-top: 124px` and `scroll-padding-bottom` = (scroller bottom − 620) px on Steam's scrollers, or a T2 scroll guard where Steam scrolls in JS. Check: P-23 |
| **D-7** | VR §12 (lift "appears at once"), D2 §10.1 / §7.8 (hover = lift on cards) | visionOS timings are tuned for **saccadic eyes, which jump** between targets. A laser **sweeps** continuously through every card in its path, so instant lift, scale and +15 mm depth ripple across grids (peripheral motion; vergence churn) | "Nearly all effects benefit from even a short delay" [official, [WWDC24-10152][wwdc24-10152]]; avoid unexpected motion [official, [WWDC25-303][wwdc25-303]]; peripheral motion pulls the eyes [official, [HIG Eyes][hig-eyes]] | Laser: brightness instant; lift, scale and depth after ≥ 80 ms of dwell (or when pointer speed is below about 1 target per 80 ms). Gamepad: unchanged. Check: P-06 |
| **D-8** | D2 §3.3 (tab bar: 6 items, plus a second capsule of Settings, VR Settings and Power 16 px below; WN adds a third for Power) | A second and third capsule **on the same leading edge** as the tab bar. That is the arrangement the HIG advises against. The column also overflows the window (748 vs 720 px, D2 §18 risk 8) | "avoid placing an ornament on the same edge as a toolbar or tab bar" [official, [HIG Windows][hig-windows], volumes]; ≤ 6 tabs [official, VR §5] | Keep one 6-item capsule. Put Settings in the window's top-right account or More circle, Power in Control Center (where visionOS puts system power-adjacent controls), and VR Settings as a Settings section (settings concept §4.9 already makes it a page). Check: P-37 |
| **D-9** | VR §12, D2 §10 | It is not established whether `.gpfocus` **persists** on the last laser-hovered element after the laser leaves. visionOS hover disappears the moment you look away | [official, [HIG Eyes][hig-eyes]]; §1.6 | Paint laser-mode highlights only with `:hover` (D-1 makes this free); probe the persistence with a wearer. Check: P-02 |
| **D-10** | D2 §3.2 / GP (game page) | There is no centring constraint for the primary action. GP measured Play at −15.5° and Manage at +18°, with its sheet 18° away from the gear | "Prioritize having the most important information centered" [official, [WWDC23-10076][wwdc23-10076]]; "display a menu near the content it controls" [official, [HIG Menus][hig-menus]] | Add to D2 §3.2: primary action within ±400 px of the window centre; menus within 40 px of their source. Check: P-29, P-35 |
| **D-11** | D2 §3.8 | Eight depth classes are defined, but there is no cap on how many are visible at once | "People need to refocus their eyes to perceive each difference in depth" [official, [HIG Spatial layout][hig-spatial]] | Add "≤ 4 distinct depths at rest per route, +1 while a modal is open". Today's plan already fits. This is a guard. Check: P-46 |
| **D-12** | D2 §3.7 (toast: always title + body) | Steam toasts are full cards at once. visionOS shows the app first and expands on a look (and in 27 expands to act) | [official, [Support: Notifications][sup-notif]]; [press, [MacStories 27][macstories-27]] | Compact toast (icon + one line), expanding on a 0.8 s laser hover; actionable invites persistent. Check: P-68 |
| **D-13** | VR §19, D2 §9.4 (collections as 3 × 3 folder circles, then a scrolling grid) | visionOS 26 folders open as pages of up to 7 apps in a honeycomb, not a scrolling grid | [press, [MacStories 26][macstories-26]] | When a collection is opened from Home: 1 + 6 honeycomb pages. The catalogue stays posters (LA D.1). Check: P-61 |

Agreements worth stating, so nobody "fixes" them:

- The keyboard echo row (D2 §7.5) is exactly visionOS's preview at the top of the keyboard.
- Keyboard on activation only (VR §9) matches the HIG and WWDC26 search guidance.
- "Rows and toolbar buttons never scale" (D2 rule 9) is official.
- The laser as the eyes (D2 §10) is the right analogue: it is visionOS's Pointer Control.

---

## Sources

Apple Human Interface Guidelines (fetched as JSON from `developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json` on 2026-10-07):

- [Pointing devices][hig-pointing] · [Game controls][hig-gamecontrols] · [Focus and selection][hig-focus] · [Eyes][hig-eyes] · [Gestures][hig-gestures] · [Virtual keyboards][hig-vkb] · [Scroll views][hig-scroll] · [Spatial layout][hig-spatial] · [Layout][hig-layout] · [Windows][hig-windows] · [Motion][hig-motion] · [Playing audio][hig-audio] · [Playing haptics][hig-haptics] · [Feedback][hig-feedback] · [Alerts][hig-alerts] · [Menus][hig-menus] · [Widgets][hig-widgets] · [Accessibility][hig-a11y] · [Designing for visionOS][hig-visionos]

WWDC session transcripts:

- WWDC20: [Design for the iPadOS pointer][wwdc20-10640]
- WWDC23: [Principles of spatial design][wwdc23-10072] · [Design for spatial user interfaces][wwdc23-10076] · [Design for spatial input][wwdc23-10073] · [Design considerations for vision and motion][wwdc23-10078] · [Create accessible spatial experiences][wwdc23-10034] · [Explore immersive sound design][wwdc23-10271]
- WWDC24: [Design great visionOS apps][wwdc24-10086] · [Explore game input in visionOS][wwdc24-10094] · [Create custom hover effects in visionOS][wwdc24-10152]
- WWDC25: [Explore spatial accessory input on visionOS][wwdc25-289] · [What's new in visionOS 26][wwdc25-317] · [Design hover interactions for visionOS][wwdc25-303]
- WWDC26: [Build next-generation experiences with visionOS 27][wwdc26-287] · [Design intuitive search experiences][wwdc26-292] · [Principles of great design][wwdc26-250]

Apple Support (Apple Vision Pro User Guide):

- [Connect spatial accessories][sup-accessories] · [Pointer Control][sup-pointer] · [Enter text and use Dictation][sup-text] · [See your notifications][sup-notif] · [Notifications and sound effects][sup-sounds] · [Move, resize and close windows][sup-windows] · [Search][sup-search]

Press:

- PS VR2 Sense on Vision Pro: [AppleInsider][ai-psvr2] · [9to5Mac hands-on][9to5-psvr2] · [Road to VR][rtvr-psvr2]
- visionOS 26/27: [MacStories visionOS 26 review][macstories-26] · [MacStories visionOS 27 overview][macstories-27] · [MacRumors visionOS 27][macrumors-27] · [Cult of Mac visionOS 27][cultofmac-27]
- Pointer and accessibility: [Six Colors: Vision Pro accessibility][sixcolors-a11y] · [Macworld: iPadOS 26 pointer][macworld-ipad26]
- SteamVR: [GamingOnLinux: SteamVR 2.17][gol-svr217]

Community and other vendors:

- [Microsoft Mixed Reality: Comfort][ms-comfort] · [Steamworks ISteamInput][steamworks-input] · [DeckThemes AudioLoader (Steam UI sound list)][deckthemes] · [ArcTouch: extending iOS apps to Vision Pro][arctouch] · [Varrall: adapting an app to visionOS][varrall]

Project documents: `research/visionos.md`, `DESIGN2.md`, `research/liquid-glass-motion.md`, `research/references.md`, `capabilities/spatial.md`, `audit/library-apps.md`, `audit/game-pages.md`, `audit/system.md`, `concepts/*.md`, `docs/inventory/bar.md`, `library.md`, `appdetails.md`, `hud.md`, and the design-language rulebook §6.

[hig-pointing]: https://developer.apple.com/design/human-interface-guidelines/pointing-devices
[hig-gamecontrols]: https://developer.apple.com/design/human-interface-guidelines/game-controls
[hig-focus]: https://developer.apple.com/design/human-interface-guidelines/focus-and-selection
[hig-eyes]: https://developer.apple.com/design/human-interface-guidelines/eyes
[hig-gestures]: https://developer.apple.com/design/human-interface-guidelines/gestures
[hig-vkb]: https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards
[hig-scroll]: https://developer.apple.com/design/human-interface-guidelines/scroll-views
[hig-spatial]: https://developer.apple.com/design/human-interface-guidelines/spatial-layout
[hig-layout]: https://developer.apple.com/design/human-interface-guidelines/layout
[hig-windows]: https://developer.apple.com/design/human-interface-guidelines/windows
[hig-motion]: https://developer.apple.com/design/human-interface-guidelines/motion
[hig-audio]: https://developer.apple.com/design/human-interface-guidelines/playing-audio
[hig-haptics]: https://developer.apple.com/design/human-interface-guidelines/playing-haptics
[hig-feedback]: https://developer.apple.com/design/human-interface-guidelines/feedback
[hig-alerts]: https://developer.apple.com/design/human-interface-guidelines/alerts
[hig-menus]: https://developer.apple.com/design/human-interface-guidelines/menus
[hig-widgets]: https://developer.apple.com/design/human-interface-guidelines/widgets
[hig-a11y]: https://developer.apple.com/design/human-interface-guidelines/accessibility
[hig-visionos]: https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos
[wwdc20-10640]: https://developer.apple.com/videos/play/wwdc2020/10640/
[wwdc23-10072]: https://developer.apple.com/videos/play/wwdc2023/10072/
[wwdc23-10076]: https://developer.apple.com/videos/play/wwdc2023/10076/
[wwdc23-10073]: https://developer.apple.com/videos/play/wwdc2023/10073/
[wwdc23-10078]: https://developer.apple.com/videos/play/wwdc2023/10078/
[wwdc23-10034]: https://developer.apple.com/videos/play/wwdc2023/10034/
[wwdc23-10271]: https://developer.apple.com/videos/play/wwdc2023/10271/
[wwdc24-10086]: https://developer.apple.com/videos/play/wwdc2024/10086/
[wwdc24-10094]: https://developer.apple.com/videos/play/wwdc2024/10094/
[wwdc24-10152]: https://developer.apple.com/videos/play/wwdc2024/10152/
[wwdc25-289]: https://developer.apple.com/videos/play/wwdc2025/289/
[wwdc25-317]: https://developer.apple.com/videos/play/wwdc2025/317/
[wwdc25-303]: https://developer.apple.com/videos/play/wwdc2025/303/
[wwdc26-287]: https://developer.apple.com/videos/play/wwdc2026/287/
[wwdc26-292]: https://developer.apple.com/videos/play/wwdc2026/292/
[wwdc26-250]: https://developer.apple.com/videos/play/wwdc2026/250/
[sup-accessories]: https://support.apple.com/guide/apple-vision-pro/connect-spatial-accessories-tan7a3f2c9d3/visionos
[sup-pointer]: https://support.apple.com/guide/apple-vision-pro/tan3869c8a85/visionos
[sup-text]: https://support.apple.com/guide/apple-vision-pro/enter-text-and-use-dictation-tana14220eef/visionos
[sup-notif]: https://support.apple.com/guide/apple-vision-pro/tan3c28cb971/visionos
[sup-sounds]: https://support.apple.com/guide/apple-vision-pro/tanc26d9edb9/visionos
[sup-windows]: https://support.apple.com/guide/apple-vision-pro/dev009366408/visionos
[sup-search]: https://support.apple.com/guide/apple-vision-pro/tan4a2dad188/visionos
[ai-psvr2]: https://appleinsider.com/articles/25/06/12/how-psvr2-sense-controllers-work-on-apple-vision-pro
[9to5-psvr2]: https://9to5mac.com/2025/06/18/vision-pro-sony-vr-controllers-hands-on/
[rtvr-psvr2]: https://roadtovr.com/first-look-vision-pro-psvr-2-sense-controllers/
[macstories-26]: https://www.macstories.net/stories/visionos-26-the-macstories-review/7/
[macstories-27]: https://www.macstories.net/news/visionos-27-the-macstories-overview/
[macrumors-27]: https://www.macrumors.com/2026/06/09/visionos-27-siri-ai-eye-aware-notifications/
[cultofmac-27]: https://www.cultofmac.com/news/visionos-27-announcement
[sixcolors-a11y]: https://sixcolors.com/post/2024/02/vision-pro-accessibility-in-the-realish-world/
[macworld-ipad26]: https://www.macworld.com/article/2845177/the-ipad-gets-one-of-my-favourite-macos-features.html
[gol-svr217]: https://www.gamingonlinux.com/2026/09/steamvr-2-17-arrives-ready-to-go-for-the-steam-frame/
[ms-comfort]: https://learn.microsoft.com/en-us/windows/mixed-reality/design/comfort
[steamworks-input]: https://partner.steamgames.com/doc/api/isteaminput
[deckthemes]: https://docs.deckthemes.com/AudioLoader/
[arctouch]: https://arctouch.com/blog/apple-vision-pro-app
[varrall]: https://varrall.substack.com/p/adapting-an-app-to-visionos
