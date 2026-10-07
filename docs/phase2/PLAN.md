# Glass Shell Phase 2 build plan (PLAN)

This is the build plan for Phase 2: the radical visionOS redesign of the Steam Frame's VR interface that the user asked for. It turns the design system (`DESIGN2.md`), seven reviewed concepts, four capability studies and the native layer into work that a team of 10 to 20 agents can run in parallel, with every result checked by agents alone.

**Who it is for.** The coordinator, who assigns packages and commits, and the agents who build them. Agents never commit.

**The user is not available.** Every gate in this plan can be run by an agent. The few questions that only a person wearing the headset can answer are listed in §5.3. None of them blocks the default build: the default uses only mechanisms that agents can prove.

**How this file binds.**

- Where two concepts disagree, §1 decides.
- Where a concept disagrees with §1, §1 wins. The package that owns the concept updates the concept text and its mockups first (milestone M0, §2.1).
- `DESIGN2.md` is amended to match §1 by package P4 (the list is in §1.18).
- §1.19 records the amendments the coordinator decided during the build (round R2). They are applied in place and marked `[R2-n]`. Where an unmarked line still disagrees with §1.19, §1.19 wins.

**Sources, by short name**

| Short | File (under `docs/phase2/` unless a path is given) |
|---|---|
| D2 | `DESIGN2.md` (the design system) |
| WN | `concepts/window-nav.md` (window, navigation, search, system presentations) |
| HA | `concepts/home-apps.md` (Home, launcher, library) |
| XC | `concepts/xc-home-search.md` (home-apps and window-nav agreement) |
| CC | `concepts/control-center.md` (bar, Control Center, HUD, toasts) |
| CTL | `concepts/controls.md` (controls, keyboard, hover and focus) |
| GP | `concepts/game-pages.md` (game pages, Now Playing, bindings) |
| SET | `concepts/settings.md` (Steam and SteamVR settings) |
| SM | `concepts/social-media.md` (People, Photos, Downloads, Store) |
| SR | `capabilities/steam-react.md` (T3, proven) |
| SP | `capabilities/spatial.md` (T4 scene graph and T5 glassd) |
| IM | `capabilities/input-mode.md` (laser vs gamepad, dwell, sounds, haptics, scroll guard) |
| E2E | `capabilities/native-e2e.md` (first live native run: ghosts, rims, flat glass) |
| GM | `glassd-material.md` (glassd material v2) |
| VP | `research/visionos-principles.md` (principles and the P-01 to P-89 conformance checklist) |
| MO | `research/liquid-glass-motion.md` (motion) |
| NAT, LAB | `docs/NATIVE.md`, `docs/LAB.md` |

Evidence tags as in D2: **[PROVEN]**, **[PROVEN-P1]**, **[PLAUSIBLE]**, **[UNPROVEN]**, **[inferred]**, **[ours]**.

---

## 0. The plan on one screen

**What ships.** One visionOS app in the room:

- Home is windowless: games, shortcuts and programs float as glass discs on the visionOS honeycomb, and the focused one opens into a card with Play.
- The "+" popup is a grid launcher. The Liquid Glass switch lives only there.
- The library is a poster window with one bottom toolbar.
- Search is a sheet over the page you were on.
- Game pages are full-bleed art with one action cluster.
- Settings is one visionOS Settings app for Steam and SteamVR.
- Control Center turns the window into three glass tiles.
- People, Photos, Downloads and Store follow their visionOS counterparts.
- Everything uses one control vocabulary at visionOS sizes, one illumination model, one motion system (MO's springs) and one material system.
- In native mode the glass is real (glassd frosts and bends the room) and parts of the page pop out by 10 to 25 mm.

**How it is built.** 27 work packages, each owning a disjoint set of files (§2.6):

- 10 platform packages (P1 to P10): runtime, React framework, interaction runtime, CSS foundation, motion library, reporter, scene graph, daemon, glassd, lab tools.
- 15 context packages (C1a to C7), one per concept area.
- 2 verification and integration packages (V1, V2).

**Order.**

1. The platform packages publish their contracts first (milestone M1).
2. Context packages start their CSS (T1) as soon as P4's tokens land, and their T2/T3 code once P1 to P3 are in.
3. Native integration (plates, pops, depth) follows P6 to P9.
4. V1 runs the native gate, and V2 runs the full verification sweep.

**Defaults that ship without the user** (§1.17):

- Every pop is non-interactive.
- Native glass becomes the default only if the native gate (§4.3) passes. Otherwise the honest CSS-only look ships, and the final report says so.
- Nothing persists: `lgs off`, a Steam restart or a reboot gives the stock UI.

**The ten decisions that matter most** (all in §1):

| # | Decision |
|---|---|
| 1 | Hover never moves Steam's focus (IM D-7, proven). Reveals are driven by one attention state machine: gamepad focus, or laser dwell. HA's "laser hover moves focus" premise is withdrawn |
| 2 | One depth plan with two profiles. The default profile (non-interactive pops at 0 / +10 / +15 / +25 mm, admitted by a click-safe rule) ships. The wearer profile (+30 / +50 mm interactive crops) stays off until a wearer check |
| 3 | Four glass mechanisms: cover, **plate** (new: opaque per-shape glass, up to 32 per surface), slab, **hole treatment** (new). Plates make Home, folders, `/invites` and Control Center real glass without ghosts |
| 4 | Gamepad focus add **white .28** (tuning range .28 to .32), checked by VP P-14 and P-15. Navigation selection is a .18 pill with a top arc and a Semibold label; hover on navigation rows is the light spot only |
| 5 | Steam's legend nodes are never hidden. The ornament is a capsule when it holds actions and a quiet legend when it holds only A and B. WN's laser-mode hiding (Q13) and SET's E-ORN exception are withdrawn |
| 6 | window-nav owns search, as a sheet over a snapshot of the page. home-apps adds programs, the Apps cell and X = Play through a provider API |
| 7 | Dimming for alerts and sheets is Steam's overlay restyled to black .35. The `t1` tint is not used for in-window modals: in native mode it dims everything reparented to Steam's panel, the modal's own crop included (SG-5, measured) [R2-4] |
| 8 | One More circle helper for every area: 60 px with an 80 px hit, inside its host, calling the host's own menu handler |
| 9 | Menus: WN's layout-by-count rule for actions, SET's list page for long value lists on settings routes, a red rule based on the number of destructive rows, Steam's order and default focus untouched |
| 10 | Control Center is drawn in the main window (CC-M). The popup variant (CC-A) ships only if its gamepad spike passes |

---

## 1. Cross-concept decisions

### 1.1 Who owns each shared element

| Element | Owner (concept → package) | Contributions from others |
|---|---|---|
| Window glass, route glass modes (§1.2), toolbar row (Back, Large Title, search field), tab-bar ornament, bottom ornament contract, window-bar row, More circle, frozen target, pointer proxy | WN → C1a | HA (windowless routes, the library's ornament members and its toolbar trailing group [R2-2]), SM (quiet legend, header positions on `/chat` and `/invites`), SET (ornament on settings routes) |
| Search route and sheet | WN → C1b | HA through the provider API (§1.9) |
| Context menus, popovers, dropdown slabs, alerts, sheets, Power menu layout, route transitions | WN → C1c | CC (Power glyphs, group labels, red confirm), CTL (value menus), SET (list page), GP (placement rule for sources in a row) |
| Toasts, bar tooltips, volume HUD, floating footer | CC → C3a | WN §5.5 card size (320 × 76) |
| Illumination model (hover, focus, press), FocusRing light plate, disabled focus | CTL → P3 (JS) and P4 (CSS) | Every area |
| Buttons, switches, check circles, sliders, pop-ups, segmented controls, fields, grouped rows | CTL → C4a | — |
| Keyboard | CTL → C4b | SM (echo context strings) |
| Achievements page | GP → C5a | SM §3.11 (fallback layout) |
| Steam's Quick Access panels inside Control Center | CC → C3b | SET P-S2 (the same rendering method) |

### 1.2 Route glass modes

The route decides the mode, never focus, so the glass never changes size under the user. C1a's T2 sets `data-lgs-glass` on `%{BasicUiRoot}`. The reporter (P6) reads it.

| Mode | Routes | Glass | Native (T5) | CSS-only (T1) |
|---|---|---|---|---|
| `window` | Library tabs and collections, search, Downloads, Photos grid, `/chat`, game details states, Properties, Steam Settings, achievements | 1280 × 656, radius 54, a 64 px ornament margin below (WN §3.1) | `window` cover with that shape | Smoky tint `rgb(20 22 30 / .74)` (dial .60 to .84) + edge cues (WN §8.4) |
| `window-full` | What's New (`/library/lgs/steamhome`), `/account`, the Steam Input page, routes without a footer | 1280 × 720 | `window` cover, full overlay | As above |
| `windowless` | `/library/home`, `/library/lgs/folder/*`, `/invites`, Control Center (CC-M) while it is open | None. Every glass element is a **plate** | Plates (§1.6) | CSS plates: black .58 with a white .16 → .04 gradient + edge cues; CC-M tiles at .94 (CC §4.2) |
| `hero` | `/library/app/:appid` title view | The art fills the window | `window` cover, hidden under the opaque art | The same |

SM's quiet-legend route `/account` is `window-full`. Achievements stay `window`, as the table says; their quiet legend sits in the margin on the dim band of §1.10 [R2-10]. Settings routes are `window` (656) on every page, so the ornament can come and go inside the margin (SET §3.2).

### 1.3 One control vocabulary

Sizes are main-window CSS px. Other surfaces multiply by their m (D2 §2.5, CTL §13). 1 pt = 4/3 px.

| Control | Visible | Hit region | Spacing and notes | Source |
|---|---|---|---|---|
| Icon button | 60 circle, symbol 26–28 | 80 | ≥ 24 px clear between 60 px targets | D2 §4, CTL R2 |
| Text button | 60 capsule, 24 px side padding, label 24 Semibold | 80 tall | — | D2 §4 |
| Primary | 70 capsule; Play 280 × 80 on game pages | ≥ 80 | One per screen, tinted | D2 §4, GP §3.2 |
| Mini circle (clear, disclosure) | 38–44 | 80 clear region | Alone only | CTL §5 |
| Back / close | 60 circle at (24, 24) | 80 box at (14, 14) | Top left on every route; grows into a titled capsule after 0.6 s | WN §3.2 |
| Search field | 64 capsule: 520 wide on section roots, 640 nested; or a 60 circle (§1.9) | 80 tall | No microphone | WN §3.2, XC §2 |
| Segmented control | 64 track, segments 56–60 tall and ≥ 140 wide, contiguous | 80 tall | White selected pill travels on `snappy` | D2 §7.10, CTL §8.3 |
| Switch | 66 × 40 (Steam's toggle at `scale: 1.75`) | 88 × 80 | Knob lifts into clear glass on press | CTL §6.1, P-C3 |
| Check circle | 40 | 80 cell | Blue when on | CTL §6.2 |
| Slider | 64 capsule, knob 64, value fill from Steam's origin | 80 | Inert glyph inside the fill; mute is its own zone | CTL §7 |
| Row in a platter | 80 contiguous, hover pill inset 6 | 80 | 2 px white .08 separator inset 26, hidden next to a lit row | CTL §10, R11 |
| Free-standing row | 72 tall | 80 pitch | — | D2 §4 |
| Menu rows | §1.12 | §1.12 | Exemption E-MENU (§1.16) | WN §5.1 |
| Tab-bar item | Live pitch 52–66 frame-menu px, circle = pitch − 8 | Full row | WN's live sizing rule | WN §3.3.2 |
| Bar disc | 56 bar px at 64 bar px pitch | 64 × 72 slot | 3.0° at the measured distance | CC §3.1, D-CC8 |
| Bottom ornament | 84 capsule, y 628–712, ≤ 960 wide, members 60 | 84 tall | Straddles the glass by 28 | WN §3.4 |
| More circle | 60, black .38 + 10 px blur | 80 | Inside its host (§1.11) | HA §7.2 |
| Home disc | 120 circle on the 4-5-4 honeycomb (224 / 188 pitch) | 200 × 180 cell | One-line label | HA §3.1 |
| Glyph badge | 30 circle, 16 px Bold letter | — | Gamepad mode only (§1.4) | VP P-26 |

### 1.4 States, input modes and attention

**Two input signals** (IM §2), both set by P3 on every Steam popup window:

| Signal | Source | Drives |
|---|---|---|
| `html.lgs-input-pad` / `html.lgs-input-laser` | `FocusNavController.NavigationSource` | Every state look (hover, focus, press) |
| `html[data-lgs-vr-mode="gamepad" \| "laser"]` | `vrGamepadInput.IsInGamepadNav` | Which of Steam's mode-dependent nodes render (the laser-mode Sort/Filter pill), and glyph badges |

- One accessor, `__LGS_RT.input`, with a test stub that changes only our classes and never Steam's getter (HA AT-14d, WN AT-24).
- WN's `html.lgs-gp` / `html.lgs-laser` and HA's `lgsInputMode()` are replaced by this accessor.

**Laser rules.**

- Laser looks key on `:hover`, never on `.gpfocus` or `.Focusable` alone (VP P-01, P-02; IM §3). Steam removes `.gpfocus` and `.Focusable` under the laser, and can leave a stale `.gpfocus` behind.
- Brightness changes at once. Lift, scale and depth start only on `.lgs-dwell`, which is set after 80 ms of dwell (IM §4, VP P-06).

**Attention.** Hover never moves Steam's focus [PROVEN, IM D-7]. Every delayed reveal is therefore fed by one state machine (P3, `05-attention.js`):

- in gamepad mode, from `vgp_onfocus` / `vgp_onblur` or a `Focusable`'s `onGamepadFocus` / `onGamepadBlur`;
- in laser mode, from `pointerenter` plus dwell.

It drives Home's card ramp and name plates (HA §3.4: its documented fallback becomes the primary path), tooltips, the More circle and the frozen target. The frozen target (WN §3.4.3) stays, because legend actions act on `.gpfocus`, which under the laser is either absent or stale (IM §3.3).

**State recipe** (tokens in `theme/00-tokens.nowrap.css`, CSS in `theme/04-states.css`, both owned by P4):

| State | Look |
|---|---|
| Rest, raised | White .10 + top sheen + `inset 0 1.5px 1.5px -1px` white .22 |
| Rest, recessed | Black .30 + `inset 0 2px 5px` black .30 |
| Hover (laser) | + white .08, and a light spot of .12 at the pointer, drawn under the label (VP P-10) |
| Hover on navigation rows (sidebar, list, tab bar) | The light spot only, no fill added (SM-D13, SET T-SEL) |
| **Gamepad focus** | **+ white .28** uniform, a spot of .16 in the upper third, the control's own specular arc ×1.5. The first frame shows 60 % (CTL P-C11). P4 sets the final value once, between .28 and .32, from the G-FOCUS measurement. **Final: `--lgs-focus-add` = .32** (P4-D8: .28 and .30 failed P-14/P-15 on the tab bar over glass at L ~95) [R2-7] |
| Focus inside rows | CTL C-D14: a single-control row carries the focus and its control is lifted; a multi-control row warms (.06) and its control carries the focus |
| Focus on a white or coloured fill | An outer glow, P4's token **`--lgs-white-glow`** (`0 0 22px 8px` white .55 on build 11094443, `contracts/tokens.md` §1.6; scaled by m on other surfaces) (VP P-16). It is blurred, not a ring. The earlier `0 0 18px 2px` white .30 measured only +4 to +12 L in the P-16 band [R2-7] |
| Navigation selected | White .18 pill + specular top arc + Semibold label |
| Selected, on, or the source of an open menu | White .94, label `#0d0e12` |
| Disabled | Content at 40 %, fill at 40 % of its rest alpha, no hover |
| Disabled + focus | Fill .10, arc at 60 %, no spot (CTL C-D15) |
| Press | Glow from the hit point on `interactive` (210 ms); glass controls swell by `min(1.06, 1 + 6 / maxSide)`; rows, cards, keys, switches and sliders only brighten |

- **Withdrawn:** CC's D-CC6 scale on focus. Rows and toolbar buttons never scale (VP P-05). The bloom stays as the outer glow above.
- Only content cards (×1.05, +15 mm) and Home discs (×1.10, +15 mm) lift on focus (VP P-19).
- **Criteria (gate G-FOCUS, §4.1):**
  - focus ≥ +40 L over rest (P-14);
  - focus ≥ selected + 15 L (P-15);
  - selected ≥ hovered + 12 L (SET T-SEL, SM);
  - glow band ≥ +20 L on white and coloured fills (P-16);
  - disabled + focus ≥ +10 L;
  - first frame ≥ 60 % of the final contrast.
- **Glyph badges** show only in gamepad mode (VP P-26), drawn from Steam's own glyph components where they exist (P-27). WN's always-on badges are withdrawn.

### 1.5 One motion system

- **One source.** `research/springs.py` generates three outputs, all owned by P5:
  - the CSS easing strings and durations (`theme/02-motion.nowrap.css`);
  - `device/shared/motion.js`: the closed-form springs and the token table, used by the T3 views and by the scene graph's depth pushes;
  - `native/shared/motion_tokens.h`, used by glassd's phase ramps.
  A change to a token is a change to `springs.py`, never to one of its outputs.
- **Tokens** are D2 §11.2, unchanged. **Rules** are D2 §11.4 (C1 to C8, M1 to M5) and §11.7 (CEF R1 to R11).
- **At rest:** one second after any interaction, no animation is in `playState: running`, and no animation whose name starts with `lgs-` remains. Steam's finished `forwards` fills (`ItemFocusAnim-*`) are allowed (CTL C13).
- **Route, card and menu entrance overrides** of Steam's animations are adopted (sign-off S3). They stay inside Steam's React timeouts: enter ≤ 800 ms including delay, exit ≤ 200 ms (D2 §11.5). Toasts keep Steam's `toastExit*` entry.
- **Reduce Motion:** fades of 150–200 ms only; the end depth is pushed once; glassd gets `reduceMotion: true`.

| Interaction | Channel | Package |
|---|---|---|
| Hover, focus, press | CSS (`04-states.css`) + T2 classes (light spot, pressed) | P4, P3 |
| Materialize and dematerialize (toasts, tooltips, More circle, ornaments, bar popups) | CSS keyframes `lgs-mat-*` | P5 (keyframes), each user |
| Menu morph | CSS `clip-path` from `--sx --sy --sw --sh` (slab ≤ 600 × 600). In native mode glassd has no morph: the slab materializes in place on its `phase` while the CSS clip-path draws the open morph, and glassd dematerializes it on close (C1c D15, `contracts/glassd.md` §6) [R2-12] | C1c, P9 |
| Sheets and alerts | `sheet-in` / `sheet-out`, materialize + swell; scrim on `fade` | C1c |
| Route and tab transitions | `theme/23-transitions.css` (±16 px + fade on `page`) | C1c |
| Depth changes | The scene-graph depth channel: the `depth` spring, ≤ 60 pushes/s only while a value moves, then one final push (SP §4.2) | P7 |
| Glass materialize and dissolve | glassd `phase` / `appear` (GM §5) | P8 writes, P9 renders |
| Home ramp, section and page changes | T3 components with `motion.js` and CSS | C2a |
| Control Center open and close, Now ↔ list, More Controls | T3 components | C3b |

### 1.6 One material system

**Five materials** (D2 §6.1) with the GM v2 presets. Thickness θ is computed from the **shorter** side in both glassd and the CSS fallback (GM §1.7; P4 updates D2 and the kit).

**Four glass mechanisms in native mode:**

| Mechanism | What it is | Used for | Contract |
|---|---|---|---|
| Cover | The glass of a whole surface: a union of rounded shapes | Window (656 or 720), bar segments, popup cards, frame menu, footer, toasts, volume HUD, keyboard | `surfaces[].shapes` (≤ 8 today) |
| **Plate** (new) | An opaque glass shape with its own material, phase and tint, drawn at the cover's depth. Steam's real panel is hidden under it, and the base mosaic shows Steam's content in front of it | Home and folder discs, the top-row controls, the open card and name plate; the `/invites` card; Control Center tiles and close circle; menus, alerts and sheets kept flat by the depth rules | `surfaces[].plates`, ≤ 32 per surface, each `{x, y, w, h, r, material, phase, tint, fill, occluder}` (P9 G1) |
| Slab | Liquid Glass under a popped crop, at dz − 0.8 mm | Every pop | As today, plus a per-slab `tint` (G3) |
| **Hole treatment** (new) | Drawn into the cover under a popped element: that element's contact shadow and its container's tone, so the hole a pop leaves reads as its shadow, not as a bright sliver of glass or room | Every pop over glass or art | `slabs[].hole = {shadow, fill}` (G2). Merges GP's GQ8b and SET's hole tone |

**Edges.**

- CSS E3 is a conic arc with gaps on both sides plus a radial lobe at 26 % of the width (WN D-15). There is no linear top layer.
- glassd draws the GM v2 crescent.
- Nowhere is there a border, an outline or a 1 px ring (VP P-42). Gate: the WN AT-23 edge ratio ≤ 0.35, in CDP shots and in `hvgrab` frames.

**Tone.** Glass luminance L 55–110, and 70–90 under text (D2 §6.3).

**Native-mode CSS** (`theme/05-native.css`, P6) drops the CSS glass only where the daemon has acknowledged a cover, plate or pop. Anything not acknowledged keeps its CSS glass.

**CSS-only look.** WN §8.4's degraded spec is what ships while native mode is off. It is tinted glass with light from above, not frost of the room, and reports say so.

**No glass on glass** (VP P-45). Content (art, posters, web pages) is never glass.

| Element | Material | Native mechanism | CSS-only |
|---|---|---|---|
| Steam window | `window` | Cover | Smoky tint + edges |
| Tab-bar capsules, bar segments, bottom ornament, More circle, Home discs | `liquid` | Cover (popups), slab behind (ornament, inset method), plate (Home) | Panel tint or in-page blur 12 + saturate 1.7 + liquid edges |
| Bar popups, Control Center tiles, toasts, HUD, `/invites` card | `panel` | Cover or plate | Panel tint `rgb(28 30 40 / .78)` + edges |
| Menus, alerts, sheets, search sheet, keyboard platter | `thick` | Slab under the pop, or a plate when kept flat | In-page blur 30 + tint .30–.40 + edges |
| Controls over art and media | `clear` + a 35 % dimming layer | In-page glass only (nothing pops over media) | The same |

### 1.7 One depth plan

**Two profiles.**

- **Default** ships. Every pop is a non-interactive crop: the laser passes through it to Steam's panel at the same x/y.
- **Wearer** is behind the flag `interactivePops` (off). It turns on only after the SP §12 check by a person wearing the headset. It restores D2 §3.8's larger interactive depths.

**Admission rules.** A pop in the default profile must satisfy all of these. The reporter (P6) enforces them and the gate G-DEPTH checks them.

1. **Covered** (ghost rule, E2E §1). The pop lies inside a cover or a plate. Never over the bottom ornament, the store's navigation ornament, the tab bar, the window-bar row, or the `/invites` header nodes.
2. **Click-safe.** dz_mm ≤ 0.25 × s × 0.769, where s is the shorter side (CSS px) of the smallest visible focusable that intersects the crop. In scene units, dz ≤ 0.000521 × s (SM §4.1). +10 mm needs s ≥ 52; +15 mm needs s ≥ 78. A pop that fails drops to the next lower value in the allowed set, never to a value in between.
3. **Not over media or opaque art**, unless the hole treatment (G2) is live and an off-axis `hvgrab` passes (GP AT-HV-OFFAXIS).
4. **Never a destructive confirmation**: an alert or sheet that contains a destructive button stays flat (SET §5 rule 3).
5. **Containers only**: ≥ 60 × 60 px, never text or a glyph alone (VP P-47).
6. **Still**: never while its scroller moves. While a modal (menu, alert, sheet) is open, only the modal itself pops; every other in-page pop is dropped.
7. **Few depths**: at most 4 distinct dz values at rest per route (VP P-46). The set is {0, +10, +15, +25} mm.

| Element | Default | Wearer | Mechanism |
|---|---|---|---|
| Window, content, rows, in-window controls, fields, platters, bottom ornament, store ornament | 0 | 0 | Cover; ornaments get an inset slab behind them |
| Tab-bar ornament | +25 | +25 | The frame-menu popup's own transform (WN §3.3.6) [PLAUSIBLE]; fallback Steam's +10 |
| Bar popups (+, Quick Access, Playspace, Streaming, tab menus) | +25 | +25 | Popup request `z` through the wrapper (SP §3.3) [PLAUSIBLE]; fallback Steam's 3.7 mm. HA's +30 for the "+" popup is unified to +25 |
| Home / folder plates, labels, page dots | 0 | 0 | Plates + mosaic bands (HA §10.2) |
| Focused Home cell, open card, name plate | +15 | +15, interactive | Crop over its plate in the occluder variant |
| Focused or hovered content card ≥ 150 px (poster, media tile, event card, DLC tile, search result) | +15 | +15, interactive | Crop over the cover |
| Primary capsule ≥ 70 px (Apply, Install), and the 60 px Pause circle on the Now Downloading card | +10 | +15, interactive | Crop + tinted slab (G3) |
| Game-page cluster, Play, tab row at rest (over art) | 0; then +10 once G2 lands and GP AT-HV-OFFAXIS passes | Play +15, others +10 | Crop + hole treatment |
| Game-page tabs, pinned | +10 | +20 | Crop + slab |
| Menus, popovers, dropdown slabs | +10, appearing with the materialize (0 → +10 on `depth`) | +30, growing from the source's depth | Crop + `thick` slab |
| Alerts | +10; **0** if it contains a destructive button | +30 (still 0 if destructive) | Crop + `thick` slab, or a flat `thick` plate |
| Sheets, the search sheet | +10 | +30 → +50 | Crop + `thick` slab |
| Source card while its menu is open | 0 with a CSS glow, in both input modes (rule 6: only the modal pops) [R2-3] | 0 with a CSS glow (rule 6 holds in both profiles) | WN's +5 mm is withdrawn (it would be a fifth depth). The control that opened the menu (More circle, Manage) is white .94 (§1.4) |
| Settings hero icon, account avatar | +10 | +10 | Decorative crop |
| Control Center tiles (CC-M) | 0 | 0 | Plates |
| CC-A tiles (gated) | +25 in front of the bar | +25 | Its own popup request |
| Keyboard keys over the platter | 0 (platter at −10 mm after K-G6) | — | Cover + base mosaic |
| Tooltips | CSS shadow only | Owner + 5 mm | — |

**Units.** units = mm / (369 × r), with S and r read live (SP §1.2). Animated deltas ≤ 20 mm; total ≤ 80 mm.

### 1.8 Dimming

- **Menus:** no scrim (WN §5.1.3).
- **Alerts and sheets:** Steam's `.ModalOverlayBackground` restyled to black .35 in CSS, in both modes. Under a pop, the hole treatment's `fill` follows the scrim, so no bright sliver shows.
- **The `t1` tint is not used for in-window modals** [R2-4].
  - **Measured (SG-5, `contracts/sg.md` §5):** in native mode a `t1` tint (the report's `window.dim`) dims **everything reparented to Steam's panel**: glassd's cover, the base mosaic, pops and slabs. The frame menu, the bar and other popups keep their brightness. The earlier inference ("it would dim only the hidden real panel") was wrong. So in native mode a `t1` tint would dim the modal's own crop as well.
  - In CSS-only mode a `t1` tint would also dim the modal (SET §14 #5).
  - A **surface `dim`** (P7's cover and base wrappers) dims the cover and the base only; popped crops keep their brightness. Use it where a window must dim behind a bright popped element.
- **`t1` is used only** for CC-A (the window dims to 0.6 while the popup shows: `window.dim 0.6` **alone**, never together with a surface `dim`, which would compound to 0.36) and for the sheet-recede variant (sign-off S7, off).
- **Control Center (CC-M)** hides the window's content with CSS opacity on Steam's page layers (CC §4.2). The window cover's phase goes to 0 while the tile plates materialize.

### 1.9 Toolbar, search field and search

- **Toolbar row.** 108 px when CQ1 holds (WN AT-2). Otherwise WN §3.2's three-rule fallback applies. C1a sets `html.lgs-hdr-108` or `html.lgs-hdr-40`, and area CSS adapts to that class only.
- **One field, three variants** of the same `%{SearchAndTitleContainer}`:

| Variant | Where |
|---|---|
| 520 × 64 capsule | Section roots (Library, Photos, Downloads) |
| 640 × 64 capsule | Nested routes and the search route |
| 60 px circle in an 80 × 80 box | Home, folders, hero routes, Steam Settings, the `/chat` sidebar row (box at the sidebar's trailing end: x = sidebar width − 94, y 14; (418, 14) with SM-D14's 512 px sidebar [R2-14]), the photo viewer and clip player, `/account`, the `/invites` card corner, achievements |

  The circle is gated by WN AT-4 (no SHRUNK); its fallback is the capsule. There is no microphone anywhere (WN D-8, CTL C-D7, XC §4).
- **Search is WN §4**: a sheet over a snapshot of the page you were on, with Steam's routes underneath. HA's split view is withdrawn (XC §4).
- **HA's contributions** go in through a provider API owned by C1b, `__LGS_RT.search.addProvider({id, rank, render, primary})`:
  - S-A: programs in the ranking; a program can be the Top Hit;
  - S-B: the Apps cell beside the Store row;
  - S-C: X = Steam's primary action on library items. A still opens the game page.
  The Liquid Glass entry is excluded from every provider (HA-10).

### 1.10 Bottom ornament and legends

This resolves WN Q13, XC §3, SET's E-ORN exception and SM's quiet legend.

- **Steam's legend nodes are never hidden** (no `display: none`). There are no audit exceptions for legends.
- **Glass height is set by the route** (§1.2). **The ornament's material is set by its content:**
  - When the legend holds any action other than A and B, it is a **capsule**: 84 px, y 628–712, ≤ 960 wide, members 60 px.
  - When it holds only A and B, it is a **quiet legend**: no capsule material, items 60 px tall, labels Medium white .70. On `window-full` routes it sits inside the glass; on `window` routes it sits in the margin.
  - **On `window` routes the quiet members sit on one dim band** [R2-1]: black .62, 60 px tall, radius 30, edges blurred 7 px, spanning the quiet members plus 10 px on each side; no rim, sheen or `backdrop-filter`, and no plate or slab in native mode (it is a shadow on the room, not glass). Labels there are 22 px Medium white .82 with the on-room shadow (P-41). Flag `quietBacking` (S27).
- **A and B** are always present as quiet trailing members, in both input modes, because Steam renders them in laser mode too (HA §7.1, `shots/p2_lib_collections_on.png`).
- **Laser mode:** Steam's `%{SortAndFilterContainer}` (rendered only on library routes) is the **toolbar row's trailing group**, not an ornament member [R2-2]. It is a page node, and C1a's window clip at the glass edge (y 656) cuts every page node in the ornament margin, so in slot 1 it was half hidden and took no clicks. In gamepad mode the same functions are Steam's X and Y legends in the ornament.
- **Library routes:** the ornament **hugs its members**, as on every other route (WN §3.4.1) [R2-2]. HA's five fixed slots (300 · 130 · 156 · 134 · 120 = 840 px of slots; with four 4 px gaps and 12 + 12 px padding an **880 px** capsule at x 200–1080) stay built behind C2c's flag `libFixedSlots` (off, S28): Steam drops X, Y and ≡ whenever focus is on the header rows, and a fixed capsule then shows up to 434 px of empty slots.
- **Depth 0**, with an inset slab behind (WN D-7).
- **Too many members:** members switch to a compact style (20 px labels, 16 px padding) rather than exceed 960 px. They are never dropped. SM's ≤ 1232 px limit is withdrawn.

### 1.11 More circle, frozen target, pointer proxy

- **More circle.** One helper for every area (C1a, `device/rt/20-more.js`):
  - **Look:** 60 px visible with an 80 px hit, white while its menu is open.
  - **Placement:** inside the host. Cards: top right, inset 10 (HA §7.2). Rows: trailing end, inset 24.
  - **One node per document,** moved to the current target (attention, §1.4), so there is nothing to re-attach when virtualized rows recycle.
  - **Isolation:** a capture-phase listener stops `pointerdown`, `mousedown`, `mouseup` and `click`, so the host never opens.
  - **Dispatch:** the host's own `onMenuButton` from its `Focusable` fiber props (SM-D15). Fallback: Steam's `vgp_onmenu` (button 14) on the host (HA §7.2).
  - **Registration:** areas call `more.register(selector, {placement})`. The helper is never shown on Home's launcher discs.
- **Frozen target.** WN §3.4.3, unchanged (C1a).
- **Pointer proxy.** WN §3.6, **in native mode only** (flag `pointerProxy = "native"`).
  - This deviates from VP P-11 ("draw no cursor"). The reason: in native mode SteamVR's dot may be drawn behind the cover (E2E §5), and no agent can see it.
  - Retire the proxy when a wearer confirms that the dot is visible with the cover flags (§5.3).

### 1.12 Menus, alerts and sheets

- **Context menus (actions):** WN §5.1.1's layout by item count. The slab stays inside the menu box, y 108–616 (12 px clear of the ornament's top). Steam's Cancel stays, as a **60 px** quiet capsule (HA-11; 56 → 60 for VP P-80) [R2-5]: 60 visible on its 60 px element (no clear border), ≥ 192 wide (G-AUD keeps ≥ 85 % of Steam's 280 × 48), white .08 fill, 22 px Medium white .70, centred under the rows (across both columns in the grid), last in Steam's order, ≥ 4 px clear of the last row's visible fill.

| Actionable items | Layout [R2-5] |
|---|---|
| ≤ 5 | One column of 72 px rows, 6 px apart, 40 px header row |
| 6 | Compact: 60 px visible on a contiguous 64 px pitch, inline label |
| 7–10 | Two columns of 72 px rows, ≤ 592 px wide (columns ≥ 280). Seven compact rows with a title and Cancel need 564 px, more than the 508 px box (C1c D28) |
| 11–14 | Two columns, ≤ 592 px wide; the rows exceed the box, so the slab's row area scrolls inside it: scroll-edge fade, no scrollbar at rest (P-72), the focused row kept fully inside the slab |

- **Value menus (dropdowns):** layout follows the same count table; the "up to 8" rule below is **placement** (C1c D11) [R2-5].
  - up to 8 options: a slab anchored to its capsule, right-aligned, below, above or over it (SET §4.5);
  - more than 8 on settings routes: a **list page** over the detail pane (SET §4.5);
  - elsewhere, 9–14 options: the two-column grid;
  - 15 or more: one scrolling column of two-line rows (CTL C-D19).
- **Anchoring and morph** (T2 + `translate`) is gated on WN AT-11, GP AT-MENU and SET CQ10: a click outside must still dismiss, and the D-pad must be unchanged. Otherwise the menu stays centred and still morphs from its source.
- **Placement for sources inside a page row:** GP §3.4's order (above, right, left, then Steam's centred placement).
- **Destructive items:**
  - ≤ 2 destructive rows: red label at rest;
  - > 2 (Power): red glyph and white label at rest;
  - always a red whole fill on focus (WN D-16 = CC D-CC1);
  - never reordered (SM-D8); Steam's default focus untouched (S6).
- **Power menu:** WN §5.2's layout (592 × 464, "This Device" and "Steam" side by side), CC §5's glyphs and group labels, and CC's second entry point (the Power circle in Control Center). Its confirmation is a visionOS alert with a red confirm capsule; text on coloured fills is dark (CC §7).
- **Alerts:** 640 px wide, buttons in Steam's order (`DialogTwoColLayout` is a nav row). **Sheets:** ≤ 960 px wide, with a close circle. Scrim .35 for both.
- **Placement on the glass** (VP P-35, ± 24 px) [R2-6]: alerts are centred on the route's glass: centre (640, 328) on `window` routes, (640, 360) on `window-full` and `windowless`. Sheets are centred at x 640, top at y 108 (under the toolbar row), at most 488 tall on `window` routes and 552 on `window-full`, so their centre stays within 24 px of the glass centre; content scrolls inside. Not the 108–628 modal box (centre 368, 40 px off).
- **Dismissal and default focus** keep Steam's behaviour [R2-6]: an outside click cancels alerts and sheets exactly as stock (Steam's `ModalClickToDismiss`; it only ever cancels, never confirms), and Steam's default focus is untouched (S6). Both are recorded deviations (§4.4: P-65, P-67).
- **Depth:** §1.7.

### 1.13 Tooltips, sounds and haptics

- **Tooltips** (P3, `device/rt/07-tooltip.js`):
  - a thick-glass capsule 48 px tall, 20 px Semibold, below its owner by default; `data-lgs-tip="above"` for GP's action cluster;
  - 0.8 s in and 0.2 s out for both laser and gamepad (VP P-12). Both are **delays**: the 250 ms materialize starts after 0.8 s of attention, and the 350 ms dematerialize starts 0.2 s after attention ends; attention that returns within the 0.2 s keeps the tooltip (D2 §11, MO §4.17, Apple's sample). IN-7 tests exactly this [R2-8];
  - the one exception: GP's icon-only cluster controls show at once under gamepad focus (`data-lgs-tip-pad="now"`);
  - bar tooltips get the 0.8 s delay through a `ShowTooltip` wrapper (CTL P-C5).
- **Sounds:** our controls call Steam's sound bus with the same `ENavSound` Steam uses for the same event (IM §6.4). No sound on hover. Steam's UI-sounds setting is honoured.
- **Haptics:** disarmed (S17). No wearer can judge them.

### 1.14 Home and launcher

HA's decisions HA-1 to HA-14 are adopted, with these corrections from §1:

- The card ramp and name plates are driven by attention (§1.4).
- The focused cell pops +15 mm as a non-interactive crop (§1.7).
- Plates use glassd's new plate primitive (G1); the CSS-only floor is HA §10.5.
- The "+" popup's depth is +25 mm, not +30.

Adopted without change, with D2 §3.5 amended by P4:

- HA-3: LB/RB switch sections on Home; D-pad Left/Right past a row end turns the page.
- HA-4: A opens the game page; X is Play.
- HA-5: one-line labels.
- HA-10: the Liquid Glass switch lives only in the "+" popup and never takes default focus.

### 1.15 Strings

- Text that T2 or T3 draws comes from Steam's or SteamVR's localization, found by source text (the GP `game-pages-locgrep.sh` method).
- Where no string exists, an English string is drawn only when the UI language starts with `en`; otherwise the element is icon-only or omitted (SET T-I18N).
- Every new string is listed in its package's evidence log, and V2 compiles the list.
- Personal names in live shots (`/chat`, `/account`, `/invites`) are never quoted in documents.

### 1.16 Exemptions to the size and audit gates

| Id | Element | Its own criterion | Source |
|---|---|---|---|
| E-BACK | Steam's "Back" text, shown as a chevron circle | `aria-label` equals the stock text; `elementFromPoint` at the centre hits it; it grows into a titled capsule after 0.6 s | WN Q8, CTL C3a, GP Q-B |
| E-MENU | Menu rows | ≥ 60 visible on a contiguous pitch of ≥ 64 (compact) or 78 (regular); rows ≥ 320 wide in one-column layouts, **≥ 280 wide in the two-column grid** (slab ≤ 592) [R2-5]. Resolves GP GQ20 | WN §5.1 |
| E-MENU (Cancel) | Steam's appended Cancel item in a menu | Its own line [R2-5]: visible 60 tall (= its element), ≥ 192 wide, ≥ 4 px clear of the last row's visible fill, inside the slab, last in DOM order, `elementFromPoint` at its centre hits it; judged by this line instead of P-08 and E-MENU's row clauses | §1.12 |
| E-SWITCH | Switch | Hit ≥ 86 × 80 around its centre | CTL §18.1 |
| E-CHECK | Check circle | Hit ≥ 80 × 80, column pitch 80 | CTL §18.1 |
| E-MINI | Mini circle (clear, disclosure) | Hit ≥ 80 × 80 and no other target within 80 px of its centre (the field it clears excepted) | CTL §18.1 |
| E-SEG | Segment | Contiguous across the track; each ≥ 60 × 140 (120 compact) | CTL §18.1 |
| E-KEY | Keyboard keys | Steam's geometry, identical to stock | CTL C10 |
| E-TAB | Tab-bar items | Pitch ≥ 52 frame-menu px at the live window size | WN D-2 |
| E-BAR | Bar slots | ≥ 64 × 72 bar px | CC D-CC8 |
| E-ROW58 | Storage rows, if the `rowHeight` patch (LA LQ2) fails | 58 px, with the actions also in the ornament | SET Q9 |
| E-DRILL | Settings sections hidden in one drill-down view | Visible in exactly one other view; T-CNT sums equal stock | SET T-AUD |
| E-WEB | Web content (`/steamweb`, `/externalweb`) | Exempt from size, type and outline checks; not from chrome checks | VP §6 scope |

### 1.17 Sign-off register: decided without the user

The user cannot be asked. Each item below has a safe default and, where useful, a runtime flag. Defaults live in `device/defaults.json` (owned by V1). Flags can be overridden for a session in `/tmp/lgs/flags.json`, which lives in RAM.

| # | Question | Source | Decision | Default | Flag |
|---|---|---|---|---|---|
| S1 | Native layer on by default | WN Q14 | On when the native gate (§4.3) passes | `auto` | `native` |
| S2 | Interactive pops (+30 / +50 mm) | WN Q12, SET §5, SM §4.3, CTL C-D16 | Built; needs one wearer session (SP §12) | Off | `interactivePops` |
| S3 | Override Steam's entrance animations | WN Q2 | Adopted: the brief asks for Liquid Glass motion. Steam's timeouts are respected | On | — |
| S4 | Back text shown as a chevron (audit exception) | WN Q8, GP Q-B | Adopted (E-BACK) | On | — |
| S5 | Hide A/B legends in laser mode | WN Q13 | Rejected (§1.10) | — | — |
| S6 | Default focus in Power and alerts | WN Q3, CC R7, VP P-67 | Steam's, unchanged | — | — |
| S7 | Sheet push-back (window recedes) | WN Q4, D2 D12 | Off: the sheet comes forward | Off | `sheetRecede` |
| S8 | Frame-height override (window × 1.067) | WN Q5, SP §7 | Off: it changes the user's window size | Off | `frameHeight` |
| S9 | Tab bar always visible | WN Q7 | On if WN AT-7 shows the flag cleared and the bar placed | On (gated) | `tabBarAlways` |
| S10 | Move SteamVR's chrome into one window-bar row | WN Q10 | On if WN AT-17 passes | On (gated) | `winbarMove` |
| S11 | Ornament pop with an occluder | WN Q11, SM Q13 | Off | Off | — |
| S12 | Home: LB/RB sections, A = page, X = Play, one-line labels | HA-3, HA-4, HA-5 | Adopted; D2 §3.5 amended | On | — |
| S13 | Controller Bindings capsule and Steam Input link | GP Q-A | Built and tested, kept off: it adds navigation into SteamVR pages | Off | `vrBindings` |
| S14 | More circle on every host, including GP's event "⋯" | GP Q-A (part), WN §3.4.4 | On: a laser path to an existing menu (D2 §10.4 parity) | On | — |
| S15 | CC-A popup variant | CC §4.11 | Ships only if CS10 records PASS | Off | `ccPopup` |
| S16 | Pointer proxy | WN §3.6, VP P-11 | Native mode only | `native` | `pointerProxy` |
| S17 | Haptics | IM §5 | Disarmed | Off | `haptics` |
| S18 | Settings sidebar selection at .26 | SET Q12 | Replaced by the selection recipe in §1.4, with its tuning range | — | — |
| S19 | Red fill on destructive confirmations | SET Q4 | Adopted (D2) | On | — |
| S20 | No reordering of destructive items | SM-D8 | Adopted | — | — |
| S21 | Volume HUD moved to 12° below the eye line | CC §6 | Off: head-locked comfort needs a wearer. The new look ships at Steam's placement | Off | `hudPlacement` |
| S22 | Store navigation ornament (96 px top strip) | SM-D7 | On after SM's S-P passes | On (gated) | `storeOrnament` |
| S23 | Settings drill-down | SET §4.3 | On after P-S4 and T-CNT pass | On (gated) | `settingsDrill` |
| S24 | Power menu as a two-column grid | WN §5.2 | Adopted | On | — |
| S25 | Laser dwell before lift (80 ms) | IM §4, VP P-06 | Adopted | On | — |
| S26 | T3 actions run (Home and "+" launches, the game page's Play, Search's Open, launcher rows) [R2-9] | D-P2-1, `contracts/react.md` §8 | Built dry-run for the build: every `rt.react.actions` call is logged, never run. V1 turns it on at release, after RX-7 (with its gamepad phase), HA AT-4 and AT-13 pass on the release build | Off during the build, **On at release** | `actionsLive` |
| S27 | Quiet legend on `window` routes on a dim band [R2-1] | WN §3.4.1, O3; VP P-39 | Adopted: P-39 is a must and the bare look measures 1.1–1.5 : 1 over a bright room | `"window"` | `quietBacking` (`"window"` \| `"off"`) |
| S28 | Library ornament in five fixed slots (880 px) [R2-2] | HA §7.1, C2c D-C2c-12 | Built, kept off: the ornament hugs Steam's legends; the laser Sort & Filter pill is the toolbar's trailing group | Off | `libFixedSlots` |
| S29 | Tooltips fully in at 0.8 s, gone ≤ 0.25 s after leaving [R2-8] | P3-D4 | Built, kept off: PLAN §1.13's 0.8 s and 0.2 s are delays before the materialize and dematerialize (Apple's sample, MO §4.17) | Off | `tipQuick` |
| S30 | An outside click does not close alerts and sheets (VP P-65) [R2-6] | C1c D9 | Not built: Steam's outside-click cancel stays (a laser path to cancel in every tier, also where a sheet has no close circle). Reserved | Off | `modalOutsideGuard` (reserved) |

"On (gated)" means V1 enables the flag in `defaults.json` only after the named test passes. "On at release" means V1 sets it when the release checklist (§4.6) runs, never earlier.

### 1.18 Amendments to DESIGN2 (applied by P4)

| # | DESIGN2 section | Change | From |
|---|---|---|---|
| A1 | §3.2, §3.3, §7.4, §7.5 | Glass 656 and ornament y 628–712; title at x 100; search 520 / 640 / circle; no microphone | WN D-1 to D-4, D-8 |
| A2 | §3.5 | Windowless routes and plates; LB/RB = sections; one-line labels; folder pages | HA-1, HA-3, HA-5 |
| A3 | §3.7, §3.8 | The two depth profiles, the admission rules and the values table of §1.7; the dimming recipe of §1.8 | §1.7, §1.8 |
| A4 | §6.1, §6.2, §6.6 | θ from the shorter side; E3 lobe instead of the linear top layer; plates and hole treatment | GM §1.7, WN D-15 |
| A5 | §8.2, §10 | Focus add .28 (tuning .28–.32); navigation-row hover = spot only; selection with arc and Semibold; input-mode keying; laser dwell; glyph badges in gamepad mode only | §1.4, VP D-1, D-2, D-5, D-7 |
| A6 | §3.7 | Menu layouts by count; E-MENU; the destructive rule by count | WN D-5, D-16 |
| A7 | §12 | The friends list is not virtualized; drill-down section hiding is allowed under E-DRILL | SM-D9, SET §4.3 |
| A8 | §2.5 | Bar pitch 64 bar px; tab-bar live pitch with a floor of 52 | CC D-CC8, WN D-2 |
| A9 | new §10.5 | Feedback: Steam's sounds through its bus; haptics off | VP D-4, IM §6 |
| A10 | §11.5 | Route transition overrides allowed within Steam's timeouts | S3 |
| A11 | §17 | The verification checklist points to PLAN §4 | — |
| A12 | §5.2 | `theme/01-font.nowrap.css` now exists (generated) | — |
| A13 | §14 | Tier status updated from the capability studies (T3 proven; T4 click unproven; plates and holes planned) | SR, SP, E2E |
| A14 | §3.2, §3.7, §3.8 | Round R2 (§1.19): the quiet legend's dim band on `window` routes (R2-1); the library ornament hugs its members (R2-2); menu layout by count with 7–14 in the grid, E-MENU widths and Cancel at 60 (R2-5); alerts and sheets placed on the glass (R2-6); the source card at 0 with a glow (R2-3); the measured `t1` dimming (R2-4) | §1.19 |

### 1.19 Amendments from the build (R2)

The coordinator decided these on 2026-10-07 (Steam build 11094443). They come from the requests packages filed while building (`grep -n "REQ [A-Za-z0-9-]*->[Cc]oordinator" docs/phase2/wp/*.md`) and from open review notes. Each one is applied in place in §0 to §5 and marked `[R2-n]` there. The decision log, with the evidence read for each, is `docs/phase2/wp/coordinator.md`. The requests to the owners of files that must change are filed there too.

**How they were decided.**

- §1 decides conflicts.
- A Steam function, with its laser path and its gamepad path, is never traded for a look.
- Between two looks, the one closer to visionOS (VP) wins when it can be measured.
- Every "must" item of VP §6 passes, or it is a recorded deviation in §4.4.
- Every rule below has a check that an agent can run.

| Id | Topic | Asked by | Changed |
|---|---|---|---|
| R2-1 | Quiet legend on `window` routes: the dim band | C1a (WN O3) | §1.10, §1.17 S27 |
| R2-2 | The library ornament hugs its members; Steam's laser Sort & Filter goes in the toolbar | C2c REQ-8, C1a | §1.1, §1.10, §1.17 S28, §2.4 C2c |
| R2-3 | Source card while its menu is open: 0 mm with a glow | C2c REQ-7, C1a (WN O4) | §1.7 |
| R2-4 | The `t1` tint, measured (SG-5) | P7 | §0, §1.8, §2.3 SG-5, §5.1 R9 |
| R2-5 | Menus: layout by count, E-MENU widths, Cancel at 60 | C1c (REQ 6a, gates run 3, D28) | §1.12, §1.16 |
| R2-6 | Alerts and sheets on the glass; P-65 and P-67 deviations | C1c (REQ 6b, 6c) | §1.12, §1.17 S30, §4.4 |
| R2-7 | Focus tokens named: `--lgs-white-glow`, focus add .32 | C4a (and C1a's REQ to P4) | §1.4 |
| R2-8 | Tooltip timing test (IN-7, CTL C9) | P3 | §1.13, §2.3 P3, §1.17 S29 |
| R2-9 | Release switch for T3 actions (`actionsLive`) | P2 | §1.17 S26, §4.5, §4.6 |
| R2-10 | Achievements are `window` | C1a (WN O1) | §1.2 |
| R2-11 | VP P-23 scored at 612 | C1a (WN O2) | §4.4 |
| R2-12 | Menu morph without a glassd morph | P9 review R1 m2 | §1.5 |
| R2-13 | Performance verdicts on a shared device | P1 (RT-7, review R1 m1) | §2.3 P1, §4.1 G-PERF |
| R2-14 | The `/chat` search circle follows the sidebar | C7 (SM-D2 rev. 3) | §1.9 |

#### R2-1 Quiet legend on `window` routes: the dim band

- **Was:** §1.10 gave every quiet legend "no capsule material, labels Medium white .70".
- **Evidence:**
  - On `window` routes the labels sit in the ornament margin, over the room.
  - Over a bright room they measure 1.1–1.5 : 1 (C1b #3, C1c REQ 4, C1a: background L 209–236 behind "Open" and "Select"). VP P-39 is a must, at 4.5 : 1.
  - With C1a's band they measure 4.9–6.7 : 1 over the sill and 5.1–6.0 : 1 over the curtain (WN §13.1).
- **Now:**
  - §1.10's band: black .62, 60 px, radius 30, 7 px blurred edges, the members + 10 px; no rim, sheen, `backdrop-filter`, plate or slab.
  - Labels 22 px Medium white .82 with the on-room shadow.
  - `window-full` routes keep the bare look inside the glass.
  - Flag `quietBacking`, default `"window"` (S27).
- **Why:**
  - A legend that cannot be read is a lost path.
  - The band is a shadow on the room, with no edge and no frost. §1.10's "no capsule material" and the no-outline rule both still hold, and nothing reads as an extra slab.
- **Check:**
  - WN AT-29 (C1a): `glass.py audit main --route /settings/system` in both modes gives CONTRAST = 0, and the band's computed style matches the values above.
  - The mockup measurement of WN §13.1: quiet labels ≥ 4.5 : 1 over the curtain (L ≥ 230).
  - G-OUTLINE: the band's edge probe reads `edge: "none"`.
  - Native: `sgcheck` reports no plate and no slab for `#Footer` while `data-lgs-orn="quiet"`.

#### R2-2 Library ornament and Steam's laser Sort & Filter

- **Was:**
  - §1.10: in laser mode, `%{SortAndFilterContainer}` moves into ornament slot 1.
  - Library routes use five fixed slots, "= 880 px". The slots sum to 840; 880 is the capsule.
  - PLAN-2c-1: ornament width 880 ± 1 in both modes.
- **Evidence (C2c REQ-8, session 2):**
  - C1a's window clip at y 656 cuts every page node in the margin. Steam's pill is a page node, so in slot 1 it was half hidden, and `elementFromPoint` at it returned `#MainNavMenu-Rest`.
  - Steam drops X, Y and ≡ whenever focus is on the header rows, and in laser mode. The fixed capsule then showed up to 434 px of empty slots.
  - D-C2c-12 ships the pill as the toolbar's trailing group. Gates PASS on AllGames and on a collection page, in both modes (C2c S2-G1, S2-G2, S2-G6).
- **Now:**
  - The ornament on library routes hugs its members, as on every other route (WN §3.4.1): centred, ≤ 960, and compact members before anything is dropped. The fixed slots stay built behind `libFixedSlots` (off, S28).
  - In laser mode, Steam's Sort & Filter pill is the **toolbar row's trailing group**. This is where visionOS puts a window's sort and filter (DESIGN2 §3.2, "Trailing actions"). It is one 60 px capsule holding Steam's two buttons, with 80 px hits:
    - visible y 24–84;
    - its right edge at x 1256 (24 px inside the glass);
    - at least **20 px clear** of the search field's visible capsule (DESIGN2 §3.2's spacing for trailing actions);
    - when Steam's account-alert circle (`#header_profile`) shows, the circle stays outermost at the 24 px inset, and the group sits 20 px to its left;
    - when Steam's labels do not fit, the sort name ellipsizes inside the group (Steam's text stays in the DOM); the gap and the inset never shrink.
  - The pill's node, its handlers and its laser-only rendering are untouched.
  - In gamepad mode the same functions stay Steam's X and Y legends in the ornament. The Y legend carries the current sort ("Sort By · Alphabetical").
- **Why:**
  - Both paths keep every function: the laser has the toolbar group, the gamepad has X and Y.
  - A capsule that shows empty slots, or a control that the window clips, is worse than a capsule whose width follows Steam's legends. Every other route already behaves that way.
- **Check (replaces PLAN-2c-1).** Run on `/library/tab/AllGames` and `/library/collection/<id>` with `--flags wp.p3,wp.c1a,wp.c2c`, in `--mode laser` and `--mode pad`, with focus in the grid and on the tab row (`glass.py js` reading rects):
  1. The capsule spans its members: left = the first member's left − 12, right = the last member's right + 12 (± 1). It is centred at x 640 ± 1 and ≤ 960 wide. No gap between adjacent members is wider than 14 px.
  2. Laser mode: the pill's visible capsule is at y 24–84 (± 1), with its right edge at 1256 ± 1 and its left edge ≥ the search capsule's right edge + 20. `elementFromPoint` at the centre of Sort and of Filter returns that button.
  3. No legend node and no pill node has `display: none` or `visibility: hidden`. G-AUD has no GONE, HIDDEN or UNCLICKABLE.

  With `libFixedSlots` on, the old check (880 ± 1 at x 200–1080, in both modes) still applies.

#### R2-3 Source card while its menu is open

- **Was:** §1.7's table said "It keeps +15 if it was the focused card; otherwise 0 with a CSS glow" (wearer +15). Admission rule 6 says "while a modal is open, only the modal itself pops".
- **Evidence:**
  - P6's reporter applies rule 6 in both profiles (`contracts/reporter.md` admission step 6, `modal: true`).
  - A +15 source beside its +10 menu would stand in front of its own menu.
  - C2c (D-C2c-1), C1c (D6b) and C2a (D-C2a-3) already build rule 6. C2c's native session S2-N2 had the sheet open and the poster not popped.
- **Now:** the source card drops to 0 with a CSS glow, in both input modes and both profiles. The control that opened the menu (More circle, Manage) is white .94 (§1.4).
- **Why:**
  - The menu must be in front of its source. In visionOS a presented menu is the frontmost layer.
  - One rule, enforced in one place.
- **Check:**
  - In a native session, run `sgcheck` with the tile menu open, twice: once from a gamepad-focused poster (`--mode pad`, ≡) and once from the More circle (`--mode laser --hover`). Pass: exactly one pop on `main` (the menu, 10.0 mm), the source at 0, and ≤ 4 distinct dz (P-46).
  - In CSS-only mode, the source's computed `box-shadow` carries the glow.

#### R2-4 Dimming: the `t1` tint, measured

- **Was:** §1.8 said "a `t1` tint would dim only the hidden real panel [inferred]. SG-5 confirms this."
- **Evidence:** SG-5 (P7, `native/spike/sg_native.py sg5`, `contracts/sg.md` §5, `p7_results/sg5n.jsonl`, 2026-10-07 08:38):
  - With `window.dim` 0.35, the window glass went from L 73.8 to 45.7, a text row from 108.6 to 65.7, and the popped posters from 95.0 to 57.4. The frame menu, the bar and the room were unchanged.
  - A surface `dim` of 0.35 dimmed the cover and the base only: a popped card stayed at 38.8 → 38.8.
- **Now:**
  - §1.8 as amended: `t1` dims the whole visible window, pops included.
  - In-window modals use the CSS scrim only, in both modes.
  - CC-A uses `window.dim 0.6` alone.
  - A window that must dim behind a bright popped element uses the surface `dim`.
  - SG-5's expectation (§2.3) and R9 (§5.1) follow.
- **Why:**
  - Nothing that ships relies on either path (CC-A is gated, S7 is off).
  - But the stated reason was wrong, and CC-A would have compounded two dims (0.36).
- **Check:**
  - SG-5, as recorded.
  - For CC-A (C3b, once CS10 passes): the report carries `window.dim 0.6` and no surface `dim` on `main` (`__LGS_SG.dump()`).

#### R2-5 Menus: layout by count, E-MENU widths, Cancel

- **Was:**
  - §1.12: "6–7: compact"; "≥ 8: two columns, ≤ 592 wide"; Cancel "a 56 px quiet capsule".
  - §1.16 E-MENU: "rows ≥ 320 wide".
- **Evidence (C1c gates run 3, 07:04–07:11, and D28):**
  - Two columns of ≥ 320 cannot fit a ≤ 592 slab (2 × 320 + 8 + 16 = 664). Steam's own row min-width is 280.
  - Measured live, 7 compact rows with a title and Cancel are 564 px tall. That is beyond the 508 px menu box (y 108–616, C2c REQ-6).
  - Cancel at 56 fails VP P-80, a must (≥ 60 visible). It also has no line of its own in E-MENU.
- **Now:**
  - §1.12's count table: ≤ 5 one column; 6 compact; 7–10 the grid; 11–14 the grid, with the row area scrolling inside the slab. Value menus follow the same table.
  - E-MENU widths: ≥ 280 in the grid, ≥ 320 elsewhere.
  - Cancel: 60 visible on its 60 px element, ≥ 192 wide, ≥ 4 px clear of the last row, with its own E-MENU line.
- **Why:** each change keeps the function and moves closer to VP.
  - The grid gives 7-action menus 72 px rows (P-64) instead of compact ones.
  - Cancel at 60 meets P-80 at no cost in height, because its element is already 60.
- **Check:**
  - `glass.py gates main --pre <menu recipe>` in both modes, for MENU with 5, 6, 7, 8, 10 and 14 items, the tile menu, POWER and the Sort menu. Pass: G-SIZE has no P-08 or P-80 failure on menu items, and every E-MENU line passes (P10's criterion per row, and the Cancel line).
  - WN AT-11b: the class matches the count table; `scrollHeight == clientHeight` up to 10 items; the slab is inside y 108–616 and ≤ 600 wide.

#### R2-6 Alerts and sheets: placement, outside click, default focus

- **Was:**
  - WN placed alerts and sheets "centred in the modal box": centre 368, 40 px off the glass centre. VP P-35 asks for ± 24.
  - §4.4 listed only P-11 and P-37 as deviations.
- **Evidence:**
  - C1c D7: alerts centred on the glass; sheets from y 108, ≤ 488 / 552 tall. Live on ZOO('Scroll Panel Test'): 958 × 487 at (161, 109).
  - C1c D9 (outside click) and D10 (default focus).
- **Now:**
  - §1.12's placement rule.
  - Outside click: Steam's `ModalClickToDismiss` keeps cancelling alerts and sheets. With the runtime off (and so without C1c's close circle), it is the only laser dismiss on a sheet that has no button of its own, and it can only cancel.
  - Default focus: Steam's (S6).
  - Both are recorded deviations in §4.4. The guard flag `modalOutsideGuard` is reserved, not built (S30).
- **Why:**
  - P-65's goal is no accidental loss. Steam's design already meets it: an outside click never confirms. Removing a laser path would break "every function keeps a laser path" in the CSS-only tier.
  - P-67 would change what A does on Steam's own confirmations. S6 already decided against that without a wearer.
- **Check:**
  - DOM after open (`glass.py js` with the CONFIRM and ZOO('Scroll Panel Test') recipes, both modes): the alert's centre is within 24 px of (640, 328) on `window` routes; the sheet's top is 108 ± 1, its height ≤ 488 (552 on `window-full`), and its centre x 640 ± 1.
  - C1c-3: an outside click cancels exactly as stock and never confirms (a spy on the dialog's `onOK` records 0 calls).
  - WN AT-12: the item focused on open is the same with `wp.c1c` on and off.

#### R2-7 Focus tokens named

- **Was:** §1.4 gave the white-fill glow as `0 0 18px 2px` white .30, and left the focus add between .28 and .32.
- **Evidence:**
  - C1c E8, C3a and C4a's `controls-measure.py`: the old glow gave +4 to +12 L in the P-16 band, which needs ≥ +20.
  - P4's `--lgs-white-glow` (`0 0 22px 8px` white .55) gives +23 L in the bright room and +27 L in the dim one.
  - P4-D8 set `--lgs-focus-add` to .32 after C1a's G-FOCUS on the tab bar: .28 gave +35.2 / +7.6 (FAIL), .32 gave +42.5 / +15.1 (PASS).
- **Now:**
  - §1.4 names both tokens. Their values live in `theme/00-tokens.nowrap.css` (P4).
  - PLAN carries the names, so a later tuning by P4 does not reopen PLAN.
  - DESIGN2 A5 already names the glow token.
- **Check:**
  - G-FOCUS as before: the P-16 band ≥ +20 L on white and coloured fills; focus ≥ +40 L over rest; focus ≥ selected + 15 L.
  - `python glass.py status`: 0 unresolved tokens.

#### R2-8 Tooltip timing test (IN-7 and CTL C9)

- **Was:** P3's IN-7 and C4a's C9 said "none at 500 ms; the label at 900 ms; gone ≤ 250 ms after leaving". But §1.13, DESIGN2 §11 and MO §4.17 (Apple's sample) make 0.8 s and 0.2 s **delays**, before a 250 ms materialize and a 350 ms dematerialize.
- **Evidence (P3, measured on computed opacity, `wp/P3.md` IN-7):**
  - The glass shows from about 820 ms, and the label reaches 0.9 by about 1050 ms.
  - The leave starts about 210–230 ms after attention ends. The label is gone by about 400–420 ms, and the node is hidden by about 560–610 ms.
  - `tipQuick` meets the card's literal numbers. But when the laser leaves and comes back within about 180 ms, the capsule dips to about 0.6.
- **Now:**
  - §1.13's timing stands: the numbers are delays.
  - IN-7's pass criterion is amended (§2.3 P3), and C9 follows it.
  - `tipQuick` stays off (S29).
- **Why:**
  - §1 decides, and it matches Apple's sample.
  - The 0.2 s grace absorbs laser jitter, which a laser (unlike eyes) produces all the time.
- **Check:** IN-7 as amended, in both input modes, with P3's runner (opacity sampled on the tooltip node's capsule and label).

#### R2-9 Release switch for T3 actions

- **Was:** nothing in PLAN named P2's `actionsLive`. HA AT-4 and AT-13 and the §4.5 ledger's static check all pass while every T3 launch is a logged dry run.
- **Now:** S26 (§1.17), a rule in §4.5 and an item in §4.6.
- **Why:** a release that forgets the switch silently loses Play, launches and Open from every T3 view. No gate would catch that lost function.
- **Check:** V2's shipped-state check, with the shipped `defaults.json` and no `--flags`:
  - `python glass.py js "__LGS_RT.react.actions.mode()"` returns `reasons` exactly `['runtime action logger on']` (the lab step's own logger).
  - `mode(ev)` for Steam's programmatic click (`new PointerEvent('click')`, `pointerType ''`) adds no other reason.

#### R2-10 Achievements are `window`

- **Was:** §1.2's table put achievements in `window`. Its note called "SM's quiet-legend routes" `window-full`, and SM listed achievements among them.
- **Now:**
  - The table holds.
  - SM revision 3, WN §3.1.1 and C5a already build `window` (656).
  - The quiet legend sits in the margin, on the dim band (R2-1).
- **Check:** on `/library/app/<appid>/achievements/my/individual`, with `wp.c1a,wp.c5a`: `%{BasicUiRoot}[data-lgs-glass="window"]`.

#### R2-11 VP P-23 after A1

- **Was:** VP P-23's bottom bound is 620 (the ornament's top at 636 − 16). A1 moved the ornament to 628.
- **Now:**
  - P-23 is scored at top ≥ 124 and bottom ≤ **612** on routes with a bottom ornament (C1a's `--lgs-guard-bottom`).
  - Without an ornament: bottom ≤ the glass bottom − 16 (704 on `window-full`).
  - VP stays frozen; §4.4 carries the bound.
- **Check:**
  - `glass.py conformance --pad --only P-23` with the 612 bound. P10's `tools/p2/conformance.py` still says 620: the REQ is in the coordinator's log.
  - WN AT-2's guard.

#### R2-12 Menu morph without a glassd morph

- **Was:** §1.5 said "glassd plays `morph-close`".
- **Evidence:**
  - glassd v3 has no morph (`contracts/glassd.md` §6; C1c D15).
  - P9's review R1 (m2) asked for a sign-off.
  - P4 amended DESIGN2 §11 (REQ P9->P4).
- **Now:** in T5 the slab materializes in place on its `phase` while the CSS clip-path draws the open morph, and glassd dematerializes it on close.
- **Why:**
  - The visible open morph is the CSS clip-path in both tiers, so nothing the eye sees is lost.
  - A glassd rect morph would add a second animation path that must be kept in step with the CSS one.
- **Check:** PLAN-1c-2's filmstrips (G-MOTION) of the menu opening and closing; GL-4 and MO-5 for the phase ramps.

#### R2-13 Performance verdicts on a shared device

- **Was:** RT-7 and G-PERF said "no new frames over 34 ms".
- **Evidence (P1: runtime.md §9, review R1 m1):**
  - On the shared device, theme-only runs alone differ by up to 7 long frames per 3 s.
  - Of six RT-7 runs, four met the strict reading. The other two were inside their A/A spread.
- **Now:** RT-7 and G-PERF use one statistic:
  - ABBA × 2, with a second round pooled if the first fails;
  - median fps ratio ≥ 0.95 against the reference (theme only for RT-7, stock for G-PERF);
  - median extra long frames (> 34 ms) ≤ the reference's A/A spread (minimum 1).

  A CSS-only verdict pools only runs whose step line reports `native=off`.
- **Why:**
  - The strict reading fails on other agents' noise, not on our cost.
  - The A/A spread is that noise, measured in the same session.
- **Check:**
  - The numbers above, from the run's JSON.
  - P10 is asked for an ABBA mode of `perf`, so that every owner computes the statistic the same way (the REQ is in the coordinator's log).

#### R2-14 The `/chat` search circle

- **Was:** §1.9 put the `/chat` circle's box at (362, 14), the trailing end of SM revision 2's 456 px sidebar.
- **Now:**
  - The box follows the sidebar's trailing end: x = sidebar width − 94, y 14. With SM-D14's 512 px sidebar that is x 418.
  - This applies only while the circle variant is on (`searchCircle`, off today because of WN AT-4's SHRUNK).
- **Check:** SM's People test with `searchCircle` on: the search element's rect is the 80 × 80 box at (sidebar width − 94, 14).

---

## 2. Work packages

### 2.1 Rules for every package

**Milestones.**

| Milestone | Meaning |
|---|---|
| M0 Conformance | Context packages: the owned concept text and mockups are updated to §1, mockups re-rendered with `tools/mockshot.py`. Platform packages: none |
| M1 Contract | The package's contract file in `docs/phase2/contracts/` is written. Code exists as stubs that load without errors and do nothing (behind flags) |
| M2 T1 | CSS complete for the package's routes; gates G-AUD, G-SIZE, G-TYPE and G-OUTLINE pass in CSS-only mode |
| M3 T2/T3 | Runtime code complete behind the package flag; the package's own tests pass in both input modes |
| M4 Native | The package's layer, plate and popup fragments are in; G-DEPTH and G-HV pass in a native session |
| M5 Accepted | V2 has run the global gates on the package's routes and recorded PASS |

**Definition of done.**

1. Every acceptance test in the package card passes.
2. Evidence is logged in `docs/phase2/wp/<ID>.md`: command, result, shot names, date, Steam build.
3. No file outside the package's set was changed (§2.6).
4. `lgs off` leaves nothing behind (G-REMOVE).

**Flags.** Each context package's runtime code is gated by a flag `wp.<id>` (for example `wp.c2a`), off by default until V2 accepts the package. Tests turn it on only inside their locked step, with the lab option `--flags wp.c2a` (P10), so other agents keep seeing the integrated state.

**Sync safety.** `python glass.py sync` uploads everyone's files (LAB.md), so a broken file breaks everyone.

- Work in progress goes in `theme/_wip/` or `device/rt/_wip/`, which the bundler and the runtime loader skip (P1).
- Run `python glass.py check-theme` (P1) before saving into `theme/`: offline brace and nesting check, `@font-face` / `@keyframes` placement.
- Runtime modules load fail-closed (P1).

**Naming.**

| What | Name |
|---|---|
| Live shots | `shots/p2_<id>_<what>.png` (for example `p2_c2a_home_live.png`) |
| Comparisons | `shots/p2_cmp_<id>_<what>.png` |
| Motion filmstrips | `shots/p2_motion_<id>_<interaction>_<f>.png` |
| Runtime modules | `device/rt/<NN>-<name>.js`, where NN is the owner's theme number (§2.6) |
| Fragments | `theme/layers/`, `theme/popups/`, `theme/sg/`, `<NN>-<name>.json` with the same NN |
| SteamVR page scripts | `device/vr/<page>.<name>.js`, injected by the daemon into page `<page>` (P8) |
| Daemon plugins | `device/shell_ext/<name>.py` (P8 loads them) |

**Never-list** (LAB.md): never launch games or programs, change setting values, confirm dialogs, message, purchase, sign out, take power actions, or keep frames of the room. Launch-type calls in tests go through the action logger (P2), which logs them and never runs them.

### 2.2 Package list

Sizes: S ≈ 1 agent-session, M ≈ 2–3, L ≈ 4 or more.

| ID | Package | Tiers | Depends on (milestone) | Size | Wave |
|---|---|---|---|---|---|
| P1 | Runtime core and lifecycle | T2/T3 host | — | M | A |
| P2 | Steam React framework | T3 | P1 M1 | M | A |
| P3 | Interaction runtime (input mode, attention, states, tooltips, sounds) | T2 | P1 M1 | M | A |
| P4 | CSS foundation (tokens, font, material, states CSS, kit, DESIGN2) | T1 | — | M | A |
| P5 | Motion library | T1, T4, T5 | — | S | A |
| P6 | Compositor, Steam side (reporter, fragments, popup wrapper, native CSS) | T4, T5 | P1 M1, P9 M1 | L | A |
| P7 | Scene graph (depth channel, transform overrides, dim wrappers) | T4 | P5 M1 | M | A |
| P8 | Daemon (lgs-shell) | T4, T5 | P6 M1, P7 M1, P9 M1 | M | A |
| P9 | glassd (plates, holes, tints, keyboard surface) | T5 | P5 M1 | L | A |
| P10 | Lab and verification tools | — | P1 M1 | M | A |
| C1a | Shell chrome (window, toolbar, tab bar, ornament, window-bar row, More, pointer proxy) | T1–T5 | P1–P4 M1; P6, P7 M2 for M4 | L | A′ |
| C1b | Search | T1–T3 | C1a M2, P2 M3 | M | B |
| C1c | System presentations (menus, alerts, sheets, Power, transitions) | T1, T2, T4 | P4, P5 M1; P6 M2 for M4 | M | A′ |
| C2a | Home, folders, What's New | T1–T5 | P2, P3 M3; C1a M2; P6, P9 M2 (plates) | L | A′ |
| C2b | Launcher ("+" popup) | T1, T3, T4 | P2 M3; P6 M2 (popup wrapper) | M | B |
| C2c | Library catalogue | T1–T4 | C1a M2 (ornament), C1c M2 (menus) | M | B |
| C3a | Bar, HUD, toasts, tooltips look | T1, T2, T4, T5 | P4 M1; P6 M2 | M | B |
| C3b | Control Center (CC-M; CC-A spike) | T1–T5 | P2 M3; P9 G1 (plates); P8 M2 | L | B |
| C4a | Controls and primitives | T1, T2 | P3, P4 M1 | M | A′ |
| C4b | Keyboard | T1–T5 | P3 M3; P9 keyboard surface | M | B |
| C5a | Game pages, achievements, Properties | T1–T4 | C1a, C1c, C4a M2; P9 G2/G3 for over-art depth | L | B |
| C5b | Now Playing, binding UI, VR bindings link | T1, T2, T3 | P8 M2 (vr scripts, actions) | M | B |
| C6a | Steam Settings | T1–T4 | C4a M2; P2 M3 | L | B |
| C6b | SteamVR Settings | T1, T2 | P8 M2 (vr scripts); C4a M2 | M | B |
| C7 | People, Photos, Downloads, Store | T1–T4 | C1a, C1c, C4a M2; P2 M3 (lab route) | L | B |
| V1 | Native gate and integration | — | P6–P9 M2; C1a M4 | M | C |
| V2 | Verification suite and conformance | — | P10 M2; each package M3/M4 | L | C (harness from A) |

### 2.3 Platform packages

#### P1 Runtime core and lifecycle

- **Tier:** host for T2 and T3. **Size:** M.
- **Owns:** `device/lgs.py`, `device/lgs_core.js`, `device/lgs_index.js`, `device/lgs`, `device/glass-shell.desktop`, `device/icon.png`, `device/rt/00-rt.js` (new), `docs/phase2/contracts/runtime.md` (new).
- **Inputs:** SR §3.9, §7; IM §8 (popup created/destroyed callbacks); LAB.md; NAT "Runtime".
- **Builds:**
  1. **Loader.** `lgs on` evaluates, after the CSS core, one bundle in SharedJSContext: `device/shared/*.js`, then `device/rt/*.js` in name order (`_wip/` skipped).
     - Each module calls `__LGS_RT.define({name, deps, flag, install(rt), remove()})`.
     - A module that throws is marked failed; the theme and the other modules keep working.
  2. **`00-rt.js`:**
     - registry with dependency order, `status()` and a log ring;
     - flags: `device/defaults.json` (V1; built-in defaults when absent), overridden by `/tmp/lgs/flags.json`, and the CLI `lgs flags [name=value]`;
     - per-window hooks over `g_PopupManager` callbacks (`rt.windows.each`, `rt.windows.onAdd`);
     - a bridge for daemon messages (`rt.bridge.set('geom' | 'page' | 'acks', …)`), used by P8;
     - test hooks (`rt.test`): input-mode stub, action-logger switch, `flags.with()` for a locked step;
     - a liveness watch: if `html.lgs-on` leaves main for 2 s (another agent's `--theme off`), every module is removed.
  3. **`lgs off`** removes modules in reverse order and returns a cleanup report. `lgs status` lists module states.
  4. **Bundler:** skips `theme/_wip/`; `lgs check` (exposed as `glass.py check-theme` by P10) checks braces and `.nowrap` placement offline.
  5. **Native argument:** `lgs on` passes `native = auto | on | off` to `lgs_shell.start` (P8), with `auto` read from `defaults.json`.
- **Acceptance tests:**

| Id | Test | Pass |
|---|---|---|
| RT-1 | `lgs on` / `lgs off` three times with three stub modules | Identical `status()` each time; 0 duplicate listeners (subscriber counts as in IM §8) |
| RT-2 | A stub module that throws in `install` | The other modules and the CSS are on; `status()` names the failure |
| RT-3 | Open the "+" popup (LAB OPEN recipe) | `rt.windows.onAdd` fired for `barpopup`; a stub class is on its `<html>` |
| RT-4 | `lgs off`, then a sweep of every popup | No `__LGS_RT`, no `lgs-*` classes and no `data-lgs-*` attributes on any window; no patched fibers (`patchedLeft: 0`) |
| RT-5 | Lab `--theme off` step | Runtime modules removed within 2.5 s |
| RT-6 | Persistence scan after on/off | Writes only under `/tmp/lgs` and `/dev/shm/lgs`; nothing new under `~/.local/share/glass-shell` except synced sources |
| RT-7 | `python glass.py perf main --route /library/tab/AllGames` with the runtime idle | Within 5 % of the theme-only baseline; no new frames over 34 ms, read as R2-13's statistic: ABBA × 2, median extra long frames ≤ the theme-only A/A spread (min 1) [R2-13] |

- **Fallback:** if the loader fails, `lgs on` still injects the CSS theme (Phase 1 behaviour) and reports the runtime as off.

#### P2 Steam React framework

- **Tier:** T3. **Size:** M.
- **Owns:** `device/rt/02-react.js`, `device/rt/03-react-lab.js`, `device/proto/react_proto.js` (retired at M5), `docs/phase2/contracts/react.md`.
- **Inputs:** SR (all); HA §13 (props-shape patches); CC CC3, CC11; SET P-S1; GP AT-T3-ROUTE; SM §8.3.
- **Builds** (from `react_proto.js`):
  - finders with candidate counts, fail-closed for the required ones (SR §3.2);
  - the route-switch patch: `routes.add(path, Component)` under `/library/lgs/…`, `routes.override(path, fn(steamChildren))`, self-healing on history changes (SR §3.4–3.5);
  - `patch.byProps(predicate, wrap)` for memo and observer components found by props shape. Targets: the "+" popup `{allowLaunchProgram}` (HA), the status pill's button (CC3), `%{AppButtons}`' observer (GP), `PagedSettings` (SET P-S1);
  - UI helpers: `ui.Page` (GamepadPage with a root `onCancel`), `ui.ErrorBoundary` (a focused Back on error), `ui.menu` (`showContextMenu`), `ui.modal` (`showModal`);
  - re-exports of Steam's components (`Focusable`, `DialogButton`, `ToggleField`, `SliderField`, `DropdownField`, `ScrollPanel`, `Menu`, `MenuItem`, `ConfirmModal`);
  - data helpers (collections, art URLs, `useNonSteamApps` keyed by `strCmdline`);
  - **`actions`**: `launchNonSteam(cmdline)`, `primary(appid)`, `desktopWindow(id)`, `navigate(path)`. In test mode they log `{fn, arg}` and never run (HA §14);
  - **lab route** `/library/lgs/lab` (`03-react-lab.js`): mounts Steam's components with fake props for fixtures (SM §8.3) and unmounts them;
  - `remove()` returns `patchedLeft`.
- **Acceptance tests:**

| Id | Test | Pass |
|---|---|---|
| RX-1 | The SR §6 selftest, ported | 19 / 19 PASS, run twice; `patchedLeft: 0` |
| RX-2 | `patch.byProps` on the "+" popup memo with a no-op wrapper | `audit barpopup` (OPEN pre) unchanged against unpatched; removal leaves `patchedLeft: 0` |
| RX-3 | `ui.modal` over `/library/tab/AllGames` (CC11 method) | Route DOM node count unchanged; `.gpfocus` inside the modal after `FocusApplicationRoot()`; B closes it; focus back on the same poster |
| RX-4 | Lab route mounts `ConfirmModal` with no-op props | Rendered, then unmounted; no route left behind |
| RX-5 | A required finder broken through a test hook | `install()` throws before patching anything |
| RX-6 | Install time | ≤ 250 ms, once per `lgs on` (SR §5) |
| RX-7 | Each action in test mode | Logged, not executed; an identity check against Steam's own handler where one exists (HA AT-4) |

- **Fallback:** finders fail closed; every T3 feature falls back to its T1 form (the concepts' tier tables).

#### P3 Interaction runtime

- **Tier:** T2. **Size:** M.
- **Owns:** `device/rt/04-input.js`, `device/rt/05-attention.js`, `device/rt/06-states.js`, `device/rt/07-tooltip.js`, `device/proto/input_mode.js` (retired at M5), `docs/phase2/contracts/interaction.md`.
- **Inputs:** IM (all); CTL §4, §11, P-C1, P-C5, P-C11; VP §1, P-01 to P-12; §1.4, §1.13 here.
- **Builds:**
  - **input mode:** the two signals of §1.4 on every popup, the stub, and `onChange`;
  - **attention:** `rt.attend(el, {dwellMs, padImmediate})` emits enter, dwell and leave events and sets `.lgs-dwell` (80 ms) and `.lgs-attend-<ms>`;
  - **states:**
    - the light spot: `--hx` / `--hy` written on `pointermove`, throttled to frames;
    - `lgs-pressed` from `vgp_onbuttondown` / `vgp_onbuttonup` (button 1), with a 400 ms safety clear;
    - the `.lgs-ring-check` tag on FocusRing over check circles;
    - disabled + focus tags;
    - the `lgs-focus-in` entry class;
  - **tooltip layer:** in-window, plus the bar `ShowTooltip` delay wrapper;
  - **sounds:** `rt.sound(event)` maps to Steam's `ENavSound` (IM §6.4);
  - **haptics:** `rt.haptic()` disarmed (dry-run).
- **Acceptance tests:**

| Id | Test | Pass |
|---|---|---|
| IN-1 | IM §8 live table (one locked step, sounds and haptics intercepted) | All 10 popups switch classes on a CDP mouse move and back on `L.pad` |
| IN-2 | The input stub | Only our classes change; `vrGamepadInput` and `NavigationSource` untouched |
| IN-3 | Dwell (IM §4) | `.lgs-dwell` at 80 ± 10 ms; none during a 45 ms-per-card sweep |
| IN-4 | Gamepad press (CTL C7) | `lgs-pressed` set on button 1, cleared ≤ 100 ms after the up event; other buttons ignored; never `preventDefault` |
| IN-5 | Light spot (CTL C8) | Writes follow within one frame; 0 writes while idle |
| IN-6 | First focus frame (CTL C6, opacity half) | 0.60 ± 0.02 at t0, 1.0 at 700 ms |
| IN-7 | Tooltips (CTL C9), measured on computed opacity [R2-8] | Nothing visible before 760 ms; the materialize starts 800 ± 40 ms after attention begins; label opacity ≥ 0.9 by 1100 ms; the leave starts 200 ± 40 ms after attention ends; label opacity 0 by 460 ms and the node `hidden` by 640 ms after attention ends; attention back within 200 ms keeps the label ≥ 0.9 (no dip); `data-lgs-tip-pad="now"`: label ≥ 0.9 within 300 ms of gamepad focus; `m_mapTooltips` empty after cleanup |
| IN-8 | Sounds | `rt.sound('activate')` requests `DefaultOk` on Steam's bus; nothing on hover (`PlayAudioURL` intercepted) |
| IN-9 | Removal | IM §8 removal row: subscriber counts back to baseline |

#### P4 CSS foundation

- **Tier:** T1. **Size:** M.
- **Owns:**
  - theme: `theme/00-tokens.nowrap.css`, `theme/01-font.nowrap.css` (generated), `theme/03-material.css` (new), `theme/04-states.css` (new), `theme/vr/00-vr-tokens.css` (new), `theme/fonts/**`;
  - device: `device/lgs_lens.js`;
  - tools and mockup kit: `docs/phase2/fontkit.py`, `docs/phase2/mockups/kit.css`, `kit.js`, `_example.html`, `mockups/assets/LICENSE.md`, `assets/room-lounge.jpg`, `assets/room-studio.jpg`;
  - docs: `docs/phase2/DESIGN2.md`, `docs/phase2/contracts/tokens.md`.
- **Inputs:** D2 §4–§10, §13, §16; CTL §4; WN §8.2; GM §1.7; VP P-01 to P-17, P-38 to P-45; §1.3, §1.4, §1.6, §1.18 here.
- **Builds:**
  - **tokens** (D2 §16 with §1 changes):
    - focus add .28;
    - selection recipe;
    - edge lobe;
    - the materials' T1 values;
    - Phase 1 token names kept as aliases until the last area migrates, then removed (§6);
    - motion tokens are not here: P5 owns them;
  - **font:** `theme/01-font.nowrap.css` generated with `fontkit.py`, and the `--lgs-font` sweep rules (D2 §5.2);
  - **`03-material.css`:** `.lgs-edge` (conic arcs and lobe), the four material recipes for T1, scroll-edge utilities, the clear-over-media dimming layer;
  - **`04-states.css`:** the illumination layer keyed by input mode (§1.4); the FocusRing light plate (CTL §4.5); disabled focus; the selection vocabulary; Reduce Motion and High Contrast variants;
  - **`vr/00-vr-tokens.css`:** the shared SteamVR values moved out of `vr/10-systemui.css` §0;
  - **kit:** token parity with the theme;
  - **DESIGN2:** amendments A1–A13.
- **Acceptance tests:**

| Id | Test | Pass |
|---|---|---|
| FD-1 | `python glass.py status` | 0 unresolved tokens |
| FD-2 | Font on `main`, `bar`, `barpopup`, `keyboard`, `notifications`, `vr:systemui` | `document.fonts.check('500 24px "LGS Inter"')` true; a CJK string renders; no CSP error; bundle +163 KB measured; `perf main` within 5 % |
| FD-3 | Token parity script, kit against theme | Every shared token equal |
| FD-4 | Edge profile on a CONFIRM alert and the window (`tools/p2/edge_profile.py`, P10) | Ratio ≤ 0.35 on every slab top edge (WN AT-23) |
| FD-5 | `/zoo/buttons`, `/zoo/toggles` with `L.pad` (with C4a) | G-FOCUS criteria (§1.4); the final focus token is recorded |
| FD-6 | CDP `Emulation.setEmulatedMedia` reduced motion and contrast (lab lock) | Fades only; opaque glass with the 2 px edge |
| FD-7 | DESIGN2 review | Each amendment A1–A13 present, with its source |

#### P5 Motion library

- **Tier:** T1, T4, T5. **Size:** S.
- **Owns:** `docs/phase2/research/springs.py`, `theme/02-motion.nowrap.css` (new), `device/shared/motion.js` (new), `native/shared/motion_tokens.h` (new), `docs/phase2/contracts/motion.md`.
- **Inputs:** D2 §11; MO §3, §6, §8, §9; §1.5 here.
- **Builds:**
  - **generator mode** in `springs.py` (`--emit css|js|h`);
  - **`02-motion.nowrap.css`:**
    - `@property` declarations;
    - easing and duration tokens;
    - keyframes `lgs-mat-glass-in` / `-out`, `lgs-mat-content-in` / `-out`, `lgs-focus-in`, `lgs-page-in` / `-out`, `lgs-arrive`, `lgs-sheet-in` / `-out`, `lgs-toast-in`, `lgs-morph` (clip-path from `--sx --sy --sw --sh --sr`);
    - all with `backwards` fill (R11);
  - **`motion.js`:** closed-form springs (MO §8), `sample(token, t)`, `settle(token)`, and a retarget that keeps velocity;
  - **`motion_tokens.h`:** the same table for glassd.
- **Acceptance tests:**

| Id | Test | Pass |
|---|---|---|
| MO-1 | Generator output against D2 §11.3 | Byte-identical `linear()` strings |
| MO-2 | `motion.js` against `springs.py` | Max error ≤ 0.002 at 1 ms steps for every token |
| MO-3 | Keyframes on a test element on `/zoo` | `getAnimations()` empty of `lgs-*` 1 s after; no resting `scale`, `filter` or `clip-path` left on the element |
| MO-4 | Reduce Motion | Every keyframe falls back to opacity only, ≤ 200 ms |
| MO-5 | glassd compiled with the header (P9 build) | Phase ramps equal the table (`test_phase.sh`, GM §5.5) |

#### P6 Compositor, Steam side

- **Tier:** T4, T5. **Size:** L.
- **Owns:** `device/lgs_layers.js`, `theme/layers.json` (retired), `theme/layers/00-base.json`, `theme/layers/99-legacy.json` (temporary), `theme/05-native.css`, `device/rt/08-popups.js`, `theme/popups/00-base.json`, `docs/phase2/contracts/reporter.md`.
- **Inputs:** NAT (interfaces); E2E §1; SP §2.4, §2.6, §3; §1.2, §1.6, §1.7 here; HA §10; SET §5; SM §4; GP §3.5, §6; CTL §14.
- **Builds:**
  1. **Fragments.** The loader merges `theme/layers/*.json` in name order.
     - `00-base.json` holds the surfaces (main, bar, barpopup, frame.menu, floatingfooter, notifications, volumelevel; the keyboard comes from C4b's fragment).
     - `99-legacy.json` holds Phase 1's rules. An area fragment lists `"supersedes": [ids]` to drop legacy rules it replaces.
     - A fragment may replace a surface's `cover` only if it declares `"owns": [surface]`.
  2. **Glass modes and plates.**
     - `data-lgs-glass` sets the main surface's mode (§1.2).
     - `data-lgs-plate="<material>"` elements are reported as plates (with `data-lgs-plate-phase`, `-tint`, `-fill`, `-occluder`).
     - `data-lgs-mosaic` bands restrict the base mosaic (HA §10.2).
  3. **Layer rule fields:**
     - `profile` (default | wearer), `interactive`;
     - the click-safe cap of §1.7, computed from the smallest intersecting focusable, snapping down to the allowed set;
     - `hole`, `tint`;
     - `exclude` selectors (destructive, media);
     - laser lifts on `.lgs-dwell:hover` and gamepad lifts on `.gpfocus`;
     - a warning in `errors` when a route shows more than 4 distinct dz.
  4. **Popup wrapper** (`08-popups.js`): wraps `vrPooledPopupStore.SendPendingInstanceParamsToSteamVR` and the type-3 `CreatePooledPopup`, applying per-host `z`, `scale` and flags from `theme/popups/*.json` (SP §3.3, §6.3). Restored on removal, with a TTL in the page.
  5. **`05-native.css`:** per-element acks for covers, plates and pops; scroll-edge bands from a neutral scrim; plate surfaces transparent in CSS once acked.
- **Acceptance tests:**

| Id | Test | Pass |
|---|---|---|
| RP-1 | Only `00-base` + `99-legacy` loaded | Report identical to Phase 1's `layers.json` report on Home, AllGames and a game page (`snapshot()` diff) |
| RP-2 | Lab route with 20 `data-lgs-plate` nodes of four materials | Reported as 20 plates with the right materials and rects (texture px) |
| RP-3 | Click-safe cap: a test rule at dz 0.081 over 72 px rows | Reported at 0.0271 (10 mm) with `capped: true`; over 40 px targets it is dropped |
| RP-4 | `interactivePops` false, then true | Every `interactive` true only in the wearer profile |
| RP-5 | CONFIRM with a destructive button; a media route | No pop reported |
| RP-6 | Laser lift (CDP hover with dwell) and gamepad lift (`L.pad`) on posters | `card` reported in both modes; none during a 45 ms sweep |
| RP-7 | Popup wrapper on a test host (SP E2 method) | Requested z and scale read back from systemui's scene graph; the frame-menu flag cleared; all restored after removal |
| RP-8 | `05-native.css` regression with fakeglassd (`lgs_shell.py start --native --glassd fakeglassd --stay`) | Glass dropped only on acked elements; plates acked |

#### P7 Scene graph

- **Tier:** T4. **Size:** M.
- **Owns:** `device/lgs_sg.js`, `theme/sg/00-base.json`, `native/spike/**` except `fakeglassd.cpp` and `hvgrab.cpp`, `docs/phase2/contracts/sg.md`.
- **Inputs:** NAT "Scene-graph facts"; SP §4, §5, §6.2, §8, §9; WN §3.3.6, §3.5; §1.5, §1.7, §1.8 here.
- **Builds:**
  1. **Depth channel:** dz changes follow the `depth` spring (`device/shared/motion.js`, prepended by P8), pushed at ≤ 60/s only while moving, then one final push. Steady-state pushes stay ≤ 15/s.
  2. **Transform overrides** from `theme/sg/*.json`:
     - targets: the frame's left side panel (tab bar +15 mm), `bottom-controls-transform`'s child (frame controls), `DashboardGrabHandleTransform` (window bar), tooltip panels, the resize corner;
     - always composed with React's values, re-applied on each push, restored in `finally` with a TTL (SP §5, §9.5).
  3. **Dim wrappers:** `tint` nodes on a surface's cover and base pieces (`dim` in the spec), for CC-A and the recede variant.
  4. **Profiles:** `interactive` and `steam-input-appid` set only in the wearer profile.
  5. **Ordering** of plates, occluder plates, base, slabs and pops.
  6. **Retire hygiene** for every removed sgid (SP §9.1).
- **Acceptance tests:**

| Id | Test | Pass |
|---|---|---|
| SG-1 | `sg_timeline.py` with a 0 → 10 mm step | Pushed dz values follow the closed-form spring within 0.5 mm; ≤ 60 pushes/s during, 0 after settle |
| SG-2 | 300 add/remove cycles | Rendering continues (E9–E14 regression); no leaked sgids (`dump()` against DOM) |
| SG-3 | Transform override round trip on the frame-control node | `DumpLaserOverlays` shows the target moved and the same size; restored after `clear()`; restored by the TTL when the daemon is killed |
| SG-4 | `dim` on a surface | Only cover and base pieces wrapped (`dump()`) |
| SG-5 | **The `t1` tint in native mode** (native session; `hvgrab` look, then delete) | Records whether a `t1` tint is visible over the cover. The result is written to `contracts/sg.md`. **Recorded 2026-10-07: visible**: it dims everything reparented to Steam's panel, pops included (§1.8) [R2-4] |
| SG-6 | Watchdog and freeze regression (NAT: SIGSTOP 15 s) | Nodes off at 12 s, back 1 s after SIGCONT |

#### P8 Daemon

- **Tier:** T4, T5 orchestration. **Size:** M.
- **Owns:** `device/lgs_shell.py`, `device/lgs_vr.py`, `device/lgs_vr_core.js`, `device/shell_ext/__init__.py`, `docs/phase2/contracts/daemon.md`.
- **Inputs:** NAT (Daemon, Runtime); GM §5.4; GP §4.12 (relay); CC CC15; WN §3.3.2 (geometry); SET §4.12.
- **Builds:**
  - **glassd.json v3** passthrough: plates, holes, tints, phase and appear (materialize in and out), `reduceMotion` (read from Steam's media query), extra mask rects, the keyboard surface;
  - **acks** for plates;
  - **`native=auto`**: `start(native='auto')` honours `defaults.json`;
  - **geometry publishing:** S, r, Hm, the dashboard distance, and the frame-menu panel's `fHeight` and clip height from `DumpLaserOverlays`, sent to Steam through `__LGS_RT.bridge` once a second while they change. `activePage` (CC15) is published the same way;
  - **profile flag file:** `/tmp/lgs/flags.json` read for `interactivePops`;
  - **actions:** a generic `lgsAction` binding that dispatches to `device/shell_ext/*.py` plugins, with type validation, source-window check and rate limit (GP §11 relay rules);
  - **SteamVR page scripts:** `device/vr/<page>.<name>.js` injected into matching pages and removed on stop;
  - **depth channel support:** prepends `device/shared/motion.js` to `lgs_sg.js`.
- **Acceptance tests:**

| Id | Test | Pass |
|---|---|---|
| DM-1 | NAT regressions: teardown order, SIGSTOP freeze, restart backoff | As NAT |
| DM-2 | Spec with plates, holes and tints | `glassd.json` carries them; fakeglassd `--dump` shows them |
| DM-3 | Geometry | Published values equal the SP §1.2 snippet run in the same step |
| DM-4 | Actions: an echo plugin; an unknown type; a wrong source | Echo returns; the others are rejected and logged |
| DM-5 | A test `device/vr/systemui.echo.js` | Injected into `vr:systemui`, removed on stop |
| DM-6 | `lgs on` with `native: auto` and no gate pass in `defaults.json` | `status.mode` css-only, with the reason |

#### P9 glassd

- **Tier:** T5. **Size:** L.
- **Owns:** `native/glassd/**`, `native/spike/fakeglassd.cpp`, `docs/phase2/glassd-material.md`, `docs/phase2/contracts/glassd.md`.
- **Inputs:** GM (all); NAT (glassd); SP §11; HA §10; CC CC9, CC14; GP GQ8a, GQ8b; SET §5, §10 (hole tone); CTL §12.8 (K-G1 to K-G6); SM-D6.
- **Builds:**

| Id | Feature | Notes |
|---|---|---|
| G1 | **Plates** | ≤ 32 per surface (today `kMaxShapes = 8`). Per-plate material (`window`, `panel`, `liquid`, `thick`, `clear`, `dim`), phase, tint, fill, and the occluder variant (brightness .55, no rim; HA §10.2). Drawn at the cover's depth in the two-pass cover (GM §4) |
| G2 | **Hole treatment** per slab | The slab's own contact shadow (black .35, 6 px y, 18 px blur, its rounded rect) clipped to the crop's rect, plus an optional `fill` tone |
| G3 | **Per-slab tint** | Green and blue primary capsules |
| G4 | **Extra mask rects** and the **keyboard surface** | K-G1, K-G2; ornaments outside the main window's mask zone (SP §11.2) |
| G5 | **Wide-slab lower lip** | Re-check the dashed line on wide slabs (GM §6.2) live |
| G6 | **Budget** | ≤ 2.5 ms median GPU with the Phase 2 scenes |
| G7 | Optional | Cover offset behind its surface (K-G6); a room-dim plate behind the window (SM-D6, flag) |

  fakeglassd follows the same contract.
- **Acceptance tests:**

| Id | Test | Pass |
|---|---|---|
| GL-1 | `tools/test_shapes.py`, extended | 32 plates, mixed materials, occluder; unions without holes; `shapes: []` draws nothing |
| GL-2 | `tools/test_material.sh` with holes and tints over `--test-backdrop room`, `--dump-view` from 0.35 m off-axis | Hole reads as shadow; tinted slabs green and blue. Dumps contain no camera data and may be kept as `shots/p2_glassd_*` |
| GL-3 | `glassd --bench` with four scenes: Home (19 plates + 1 slab), library window (cover + 3 slabs), CC-M (4 plates), keyboard (+1 cover) | Median ≤ 2.5 ms at idle clocks, also reported at 903 MHz |
| GL-4 | `tools/test_phase.sh` with plates | Ramps equal `motion_tokens.h` (MO-5) |
| GL-5 | A live native session with a wide slab (`hvgrab` look, then delete) | No dashed lower lip; edge-profile ratio ≤ 0.35 |
| GL-6 | fakeglassd contract | Accepts every v3 field; `glassd-out.json` lists `plates` and `dropped` counts |

#### P10 Lab and verification tools

- **Tier:** tooling. **Size:** M.
- **Owns:** `glass.py`, `lab/**`, `tools/mockshot.py`, `tools/p2/**` (new), `native/spike/hvgrab.cpp`, `docs/phase2/contracts/lab.md`.
- **Inputs:** LAB.md; VP §6 (verification codes); WN `window-nav-measure.py`; SET `settings-pad.js`, `settings-sel.py`; HA AT-10b; D2 §11.9, §17.
- **Builds** (every live command holds `lab.lock`, plus `lab-vr.lock` when it touches systemui):

| Command | What it does |
|---|---|
| `--flags a,b` | On every lab command: flags on for the locked step only |
| `--mode laser\|pad` | Runtime input stub for the step (never Steam's getter) |
| `--media reduce\|contrast` | CDP media emulation for the step |
| `glass.py check-theme` | Offline bundle check |
| `glass.py gates SURF --route R [--pre JS]` | G-AUD, G-SIZE, G-TYPE, G-OUTLINE, G-MOTION in one lock, JSON out |
| `glass.py pad-bfs --route R` | Reachability BFS over the four directions, reversibility, B behaviour, `vr-null-tree` guard (`FocusApplicationRoot()` first) |
| `glass.py focus SURF --route R --pairs …` | Luma of rest, focused, selected and hovered pairs (VP P-14 to P-16; SHOT definition of VP §6) |
| `glass.py motion SURF --pre …` | `getAnimations()` token audit; filmstrips at f = 0, .15, .35, .5, .75, 1 |
| `glass.py sgcheck` | The ghost and click-safe rules over `__LGS_SG.dump()` + DOM rects (HA AT-10b, SM G9) |
| `glass.py hv NAME [--offaxis]` | `hvgrab` on the Frame, fetch, print metrics (glass L inside and outside, edge profile, a doubling score by template match), then delete both copies |
| `glass.py cmp MOCK.html LIVE.png` | Side-by-side `shots/p2_cmp_*.png` plus rect deltas of named elements (mockup `data-id` rects dumped by `mockshot.py`; live selectors from `docs/phase2/wp/<id>-cmp.json`) |
| `glass.py ledger` | Builds the function ledger from the concepts' retention tables (§4.5) |
| `glass.py conformance` | Runs the automatable VP P-items and prints PASS / FAIL / MANUAL per item |
| `glass.py native-session --pre …` | Holds `/tmp/lgs/native.lock`, starts `lgs_shell.py start --native --stay`, runs the step, returns to `--css` |

- **Acceptance tests:**

| Id | Test | Pass |
|---|---|---|
| TL-1 | Each command on the stock UI | Runs; baselines saved in `docs/phase2/wp/P10.md` |
| TL-2 | `focus` on `shots/p2_window-nav_tabbar.png` | ΔL 40 ± 2; `edge` reproduces WN §8.2's table ± 3 |
| TL-3 | `pad-bfs` on `/settings/system` | Same reachable set as `settings-pad.js` |
| TL-4 | `sgcheck` on a synthetic spec with an uncovered pop | Flagged |
| TL-5 | `hv` | No PNG left locally or on the Frame afterwards |
| TL-6 | Lock audit | Every new live command holds the right locks (code review + a concurrent-run test) |

### 2.4 Context packages

Each card lists its routes, its sources in the concepts, what it builds, and its acceptance tests. Every context package also runs the global gates (§4.1) on its routes, in both input modes, CSS-only and native. "Their ATs" means the concept's own tests, updated to §1 at M0.

#### C1a Shell chrome

- **Tiers:** T1–T5. **Size:** L.
- **Owns:**
  - theme: `theme/20-shell.css`, `theme/vr/10-systemui.css`, `theme/vr/pre/sys_hover.js`, `theme/vr/pre/panel_sizes.js`, `theme/vr/pre/audit_inpage.js`;
  - runtime: `device/rt/20-shell.js`, `device/rt/20-more.js`, `device/rt/20-pointer.js`;
  - fragments: `theme/layers/20-shell.json`, `theme/popups/20-shell.json`, `theme/sg/20-winbar.json`;
  - concept: `docs/phase2/concepts/window-nav.md`, `window-nav-measure.py`;
  - mockups: `window-nav-shared.css`, `window-nav-shared.js`, `window-nav-anatomy.html`, `window-nav-anatomy-t1.html`, `window-nav-anatomy-depth.html`, `window-nav-tabbar.html`, `window-nav-tabbar-r863.html`, `window-nav-ornament.html`, `window-nav-chrome.html`.
- **Routes and surfaces:** every `main` route (frame), `frame.menu.*`, `floatingfooter`, `vr:systemui` (window-bar row).
- **Inputs:** WN §3.1–§3.7, §6, §7 (chrome rows), §8, §9.1–§9.3, §9.8; XC §1; SM §3.0; SET §3.2, §4.11; §1.2, §1.9–§1.11 here.
- **Builds:**
  - **T1:** window glass and modes; toolbar row; tab bar (two groups, states); ornament; window-bar row look; floating hint.
  - **T2:**
    - `data-lgs-glass`;
    - the CQ1 header (`--basicui-header-height` and the `HeaderStore` write) with the fallback class;
    - the Large Title route map and Back reveal;
    - ornament backing, member tags `data-lgs-btn` and the quiet / capsule state;
    - the frozen target, the More helper (§1.11) and the pointer proxy;
    - the live tab-bar pitch from P8's geometry.
  - **T4:** the tab bar +15 mm through the side-panel transform and the always-visible flag (`popups/20-shell.json`); the window-bar row moves (`sg/20-winbar.json`).
  - **T5:** the window cover rule in `layers/20-shell.json`, superseding the legacy `hdr-*`, `footer` and `sort-filter` pops (none of them pop now).
- **Acceptance tests:** WN AT-1 to AT-8, AT-8b, AT-17, AT-20, AT-22, AT-23, AT-24, AT-25, AT-26, AT-27, AT-0b, updated for §1:
  - AT-24: A and B stay visible as quiet members in laser mode;
  - AT-26: the More circle is 60 / 80 and inside its host;
  - **PLAN-1a-1:** the ornament is a capsule when a non-A/B member exists and quiet otherwise, on `/library/tab/AllGames`, `/settings/system` and `/account`; no legend node has `display: none`;
  - **PLAN-1a-2:** G-FOCUS on the tab bar (focus ≥ current-route circle + 15 L);
  - **PLAN-1a-3:** `glass.py cmp` against `window-nav-anatomy.html`, `-tabbar.html`, `-ornament.html` and `-chrome.html`.

#### C1b Search

- **Tiers:** T1–T3. **Size:** M.
- **Owns:** `theme/21-search.css`, `device/rt/21-search.js` (LgsSearch + the provider API), `docs/phase2/mockups/window-nav-search.html`, `window-nav-results.html`.
- **Routes:** `/search`, `/search/tab/*`.
- **Inputs:** WN §4, §9.1; XC §2; HA §6; §1.9 here.
- **Builds:** the trigger on `focusin` of the field; the snapshot; the sheet (zero state, results, categories hosting Steam's page); recent searches in memory only; the provider API.
- **Acceptance tests:** WN AT-9a to AT-9e, AT-10 (with C4b's echo), AT-16 (snapshot cost); HA AT-13 against C2a's provider; **PLAN-1b-1:** `cmp` against `window-nav-search.html` and `window-nav-results.html`; G-PAD from the sheet (Down from the field enters the sheet, B returns to the same poster).

#### C1c System presentations

- **Tiers:** T1, T2, T4. **Size:** M.
- **Owns:** `theme/22-presentations.css`, `theme/23-transitions.css`, `device/rt/22-menus.js`, `theme/layers/22-presentations.json`, `docs/phase2/mockups/window-nav-menu.html`, `window-nav-sort.html`, `window-nav-power.html`, `window-nav-alert.html`, `window-nav-sheet.html`, `window-nav-motion.html`.
- **Surfaces:** `main` modals and context menus (inventory shell §0.2 recipes CONFIRM, ALERT, MENU, SUBMENU, POWER, ZOO).
- **Inputs:** WN §5.1–§5.4, §7, §9.4–§9.7; CC §5 (glyphs, groups, red confirm, dark text on fills); CTL §8.2; SET §4.5, §4.6; GP §3.4; §1.12, §1.5 here.
- **Builds:**
  - **T2:** count classes; menu type (action or value); source tracking and the white source; anchoring vars and `translate`; destructive tags; Power group labels and glyphs; the sheet close circle; the value-menu grid and scrolling column (the list page is C6a's).
  - **T1:** slab, rows, tones, alert and sheet cards, scrim .35; route transitions.
  - **T4:** `layers/22-presentations.json` (menus, alerts, sheets at +10 with the admission rules; destructive alerts flat; superseding the legacy `menu`, `sheet` and `sheet-panel` rules).
- **Acceptance tests:** WN AT-11, AT-11b, AT-12, AT-13, AT-14 (depth at 10 mm, `interactive: false`), AT-15, AT-19, AT-21; CC A13 (Power look only); **PLAN-1c-1:** CONFIRM with a destructive button has no pop (`sgcheck`); **PLAN-1c-2:** G-MOTION filmstrips of a menu morph, an alert and a sheet; **PLAN-1c-3:** `cmp` against `window-nav-menu.html`, `-sort.html`, `-power.html`, `-alert.html` and `-sheet.html`.

#### C2a Home, folders, What's New

- **Tiers:** T1–T5. **Size:** L.
- **Owns:**
  - `theme/41-home.css`, `device/rt/41-home.js`, `device/rt/41-search-apps.js`, `theme/layers/41-home.json`;
  - `docs/phase2/concepts/home-apps.md`, `docs/phase2/concepts/xc-home-search.md`;
  - mockups: `home-apps-home.html`, `home-apps-home-t1.html`, `home-apps-apps.html`, `home-apps-collections.html`, `home-apps-folder.html`, `home-apps-depth.html`, `home-apps-search.html`, `home-apps.css`, `home-apps.js`, `home-apps-icons.js`.
- **Routes:** `/library/home` (override), `/library/lgs/folder/<id>`, `/library/lgs/steamhome`.
- **Inputs:** HA §3, §5, §6, §10, §11, §12.1, §12.5, §12.9, §13, §14; XC; §1.4, §1.7, §1.14 here.
- **Builds:**
  - **T3:**
    - the Home override (sections Recent, Collections, Apps, Windows; the honeycomb with explicit neighbours and one-step memory);
    - folder and What's New routes;
    - the attention-driven card ramp and name plates;
    - launch wiring through P2 `actions`;
    - the search provider (S-A, S-B, S-C);
    - Steam's sounds for section and page changes.
  - **T1:** discs, labels, top row, page dots, peeks; What's New restyle (Home feed rules moved here from `40-library.css`).
  - **T5:** plates for discs, top-row controls, card and name plate; mosaic bands; the focused pop at +15 mm over an occluder plate.
- **Acceptance tests:** HA AT-1 to AT-11, AT-10b, AT-10c, AT-16 to AT-19, updated for §1:
  - AT-8(d): the ramp is fed by attention; there is no CSS `:hover` reveal;
  - AT-10: the focused cell at 0.041 u with `interactive: false` in the default profile.

  **PLAN-2a-1:** with native off, `p2_c2a_home_t1` compared with `home-apps-home-t1.html`; with native on, an `hv` look shows one copy of each icon and plate glass beside the lifted disc.

#### C2b Launcher ("+" popup)

- **Tiers:** T1, T3, T4. **Size:** M.
- **Owns:** `theme/32-launcher.css` ("+" popup rules moved out of `30-bar.css`), `device/rt/32-launcher.js`, `theme/popups/32-launcher.json`, `docs/phase2/mockups/home-apps-plus.html`, `home-apps-plus-t1.html`.
- **Surface:** `barpopup` (the "+" popup).
- **Inputs:** HA §4, §5, §12.7; CC §3.4 row "+"; §1.14 here.
- **Builds:**
  - **T1:** the 4-column grid with no `flow-children`, raised `max-height`, labels, the green pip on Liquid Glass.
  - **T3:** the memo patch (A–Z, the full-name plate, the toggle row with `preferredFocus` on the first program, the LQ10 order: navigate main to `/library/home` before launching the switch).
  - **T4:** popup `z` +25 mm.
- **Acceptance tests:** HA AT-5 (a–e), AT-12; **PLAN-2b-1:** `audit barpopup` (OPEN pre) clean in T1 and T3; **PLAN-2b-2:** `cmp` against `home-apps-plus.html` and `-plus-t1.html`; **PLAN-2b-3:** the toggle row is logged, never executed, and logs `Navigate('/library/home', replace)` before the launch when main is on a `/library/lgs/*` route.

#### C2c Library catalogue

- **Tiers:** T1–T4. **Size:** M.
- **Owns:** `theme/40-library.css`, `device/rt/40-library.js`, `theme/layers/40-library.json`, `docs/phase2/mockups/home-apps-library.html`, `home-apps-library-pad.html`, `home-apps-filter.html`, `docs/phase2/mockups/fetch-library-refs.py`.
- **Routes:** `/library/tab/*`, `/library/collection/*`, the Sort menu, the tile menu, Library Filters.
- **Inputs:** HA §7, §8, §9, §12.2–§12.6; WN §3.4.6; §1.10, §1.12 here.
- **Builds:**
  - **T1:** tabs as a segmented control, the VR sub-filter in place, posters (Steam's geometry), focus lift, the "N apps hidden" notice, section headers.
  - **T2:** state labels on Steam's legends (current sort, filter count); the five fixed ornament slots only behind `libFixedSlots` (S28) [R2-2]; More hosts registered with C1a's helper.
  - **T3:** the letter scrubber; larger posters only if LQ2 passes; the filter sheet content (chips, segments, collapsed sections) with the T1 fallback.
  - **T4:** posters at +15 mm (`layers/40-library.json`, superseding the legacy `card`, `tabs` and `tab-arrow` rules for library routes).
- **Acceptance tests:** HA AT-6, AT-7, AT-14 (a–d), AT-15; **PLAN-2c-1** [R2-2]: the ornament hugs its members and Steam's laser Sort & Filter pill is the toolbar row's trailing group (the three checks of §1.19 R2-2); with `libFixedSlots` on, the ornament is 880 ± 1 in both modes; **PLAN-2c-2:** `cmp` against `home-apps-library.html`, `-library-pad.html` and `-filter.html`; G-PAD on AllGames, including Up to the tabs and back.

#### C3a Bar, HUD, toasts, tooltips look

- **Tiers:** T1, T2, T4, T5. **Size:** M.
- **Owns:** `theme/30-bar.css`, `theme/35-hud.css`, `theme/vr/60-overlays.css`, `theme/vr/pre/sys_zoo.js`, `device/rt/30-bar.js`, `device/rt/35-hud.js`, `theme/popups/30-bar.json`, `theme/layers/30-bar.json`, `docs/phase2/mockups/control-center-bar.html`, `control-center-hud.html`, `window-nav-toast.html`.
- **Surfaces:** `bar`, bar popups other than "+" and Quick Access, `tooltip`, `volumelevel`, `notifications`, `floatingfooter` (look only; its content is C1a's), SteamVR overlays.
- **Inputs:** CC §3, §6, §7, §8, §11.1, §11.4, §11.5; WN §5.5, §5.6; §1.3, §1.13 here.
- **Builds:**
  - **T1:** the three bar pieces (Home circle, apps capsule, system capsule on `%{Tray}`), states, the status pill, battery capsule rules, bar popups, toasts (320 × 76), volume HUD look, SteamVR toasts.
  - **T2:** the unread count, the HUD number.
  - **T4:** bar popups +25 mm; HUD placement behind `hudPlacement` (off).
  - **T5:** the bar cover as three shapes (`layers/30-bar.json` owns `bar`).
- **Acceptance tests:** CC A3 to A6, A15, A16, A25 (bar), A26; WN AT-18; **PLAN-3a-1:** `cmp` against `control-center-bar.html` and `-hud.html`; **PLAN-3a-2:** the battery number is never shown when Steam's setting is off.

#### C3b Control Center

- **Tiers:** T1–T5. **Size:** L.
- **Owns:**
  - `theme/31-cc.css`, `device/rt/31-cc.js`, `theme/layers/31-cc.json`;
  - `docs/phase2/capabilities/cc-focus.md` (new; the CS10 result);
  - `docs/phase2/concepts/control-center.md`, `control-center-mockaudit.py`;
  - mockups: every `control-center-*` file except `-bar.html` and `-hud.html`, plus `control-center.css`, `control-center-build.js`, `control-center-icons.js`.
- **Surfaces:** `main` (CC-M modal), Quick Access (CC-C restyle; C3b owns these selectors in `31-cc.css`), the gated CC-A host.
- **Inputs:** CC §4, §5 (the Power circle), §9, §10, §11.2, §11.3, §11.6, §12, §13; §1.2, §1.6, §1.8 here.
- **Builds:**
  - **T3:** the CC-M view in `ui.modal`, with the route container as fallback (tiles, toggles, sliders, rows, Now / list, More Controls with Steam's Quick Access panels, explicit neighbours, LB/RB); the pill patch (CC3); bindings to Steam's handlers (CC4, CC6) behind spies in tests.
  - **T1:** CC-C restyle; the tiles' CSS-only look (.94).
  - **T5:** window cover phase 0 and 4 plates while open (CC14, through G1).
  - **Spike:** the CS10 spike for CC-A, writing `cc-focus.md`.
- **Acceptance tests:** CC A1, A2, A7 to A14, A17 to A23, A25, A27 to A33 (A28 to A30 only if CS10 passes); **PLAN-3b-1:** no window content visible in an `hv` look with CC-M open (A21); **PLAN-3b-2:** `cmp` against `control-center-overview.html`, `-gamepad.html`, `-more.html`, `-notifications.html`.

#### C4a Controls and primitives

- **Tiers:** T1, T2. **Size:** M.
- **Owns:**
  - `theme/10-primitives.css`, `device/rt/10-controls.js`;
  - `docs/phase2/concepts/controls.md`, `controls-probe.js`;
  - mockups: every `controls-*` file except `controls-keyboard*`, plus `controls.css`.
- **Routes:** `/zoo/*`; the primitives on every route.
- **Inputs:** CTL §4–§11, §13, §15–§19; §1.3, §1.4, §1.16 here.
- **Builds:**
  - **T1:** buttons, switches (with the extender), check circles, sliders (64 px knob, notch and default-tick fixes, inert glyph, mute zone), pop-up capsules, segmented controls, fields, grouped rows and platters, disabled rules.
  - **T2:** row tagging `data-lgs-ctl`, slider value text, mute-zone tags.
  - **Migration:** the context-menu and modal sections of `10-primitives.css` are removed once C1c's `22-presentations.css` carries them (§6).
- **Acceptance tests:** CTL C1 to C9, C13 to C15, C18 to C23; **PLAN-4a-1:** G-FOCUS on `/zoo/buttons`, `/zoo/toggles`, `/zoo/sliders`, `/settings/system`; **PLAN-4a-2:** `cmp` against `controls-states.html`, `-system.html`, `-quickaccess.html`.

#### C4b Keyboard

- **Tiers:** T1–T5. **Size:** M.
- **Owns:** `theme/36-keyboard.css` (keyboard rules moved out of `35-hud.css`), `theme/vr/50-keyboard.css`, `theme/vr/pre/kb_states.js`, `device/rt/36-keyboard.js`, `theme/layers/36-keyboard.json`, `docs/phase2/mockups/controls-keyboard.html`, `controls-keyboard-pad.html`, `controls-keyboard-dim.html`, `controls-keyboard-t1.html`, `controls-keyboard.js`.
- **Surfaces:** `keyboard`, `vr:keyboard`.
- **Inputs:** CTL §12 (K-G1 to K-G6), C10 to C12, C16, C17, C24; SM §3.3; §1.6 here.
- **Builds:** keys and states (T1); the echo row with masking and the scoped key-block move (T2); the context Enter label (T3); the keyboard surface with a `thick` cover and its mask (T5, with P9 G4); materialize (K-G5).
- **Acceptance tests:** CTL C10, C11, C11b, C11c, C12, C15b, C16, C17, C24; SM keyboard tests; **PLAN-4b-1:** `cmp` against `controls-keyboard.html` and `-keyboard-t1.html`.

#### C5a Game pages, achievements, Properties

- **Tiers:** T1–T4. **Size:** L.
- **Owns:**
  - `theme/50-appdetails.css`, `device/rt/50-gamepage.js`, `theme/layers/50-gamepage.json`;
  - `docs/phase2/concepts/game-pages.md`, `game-pages-locgrep.sh`, `game-pages-probe.js`;
  - mockups: every `game-pages-*` file except `game-pages-nowplaying*` and `game-pages-bindings*`, plus `game-pages.css`, `game-pages.js`, `make-bright-hero.py`, `legibility-check.py`, `mockups/assets/hero-bright.jpg`, `assets/logo-bright.png`.
- **Routes:** `/library/app/:appid` (title, details, running), achievements, Properties, `/app/:appid/controllerconfigurator` (look; the link is C5b's).
- **Inputs:** GP §3, §4.1–§4.12, §5, §6, §9.1–§9.6, §9.9, §10; SM §3.11; §1.7 (over-art rule) here.
- **Builds:**
  - **T1:** the hero layout, sticky art, the cluster, the segmented tabs with paired arrows, tab content, the achievements split view, Properties as Settings.
  - **T2:** the Steam Input label, tooltips (above), the adaptive dimming sampler, the inline title, arrival detection, More hosts for event cards.
  - **T4:** over-art pops only after G2 and AT-HV-OFFAXIS; cards at +15 mm.
- **Acceptance tests:** GP AT-MOCK, AT-AUDIT, AT-GEO, AT-SIZE, AT-TYPE, AT-TIP, AT-LEGIBLE, AT-NAV, AT-PIN, AT-FADE, AT-NAV-AP, AT-MENU, AT-OPT, AT-EDGE, AT-REST, AT-MOT, AT-DEPTH, AT-HV-OFFAXIS, AT-PERF, AT-RM, AT-RUN; **PLAN-5a-1:** over-art pops stay at 0 until G2 is live (`sgcheck`).

#### C5b Now Playing, binding UI, VR bindings link

- **Tiers:** T1, T2, T3. **Size:** M.
- **Owns:** `theme/vr/20-nowplaying.css`, `theme/vr/40-bindings.css`, `theme/vr/pre/np_states.js`, `theme/vr/pre/bind_hover.js`, `device/vr/systemui.nowplaying.js`, `device/shell_ext/vrbind.py`, `device/rt/52-vrbind.js` (the capsule and the Steam Input link, behind `vrBindings`), `docs/phase2/mockups/game-pages-nowplaying.html`, `game-pages-nowplaying-variants.html`, `game-pages-nowplaying-bindings.html`, `game-pages-bindings.html`, `game-pages-bindings-view.html`.
- **Surfaces:** `vr:systemui` (Now Playing), `vr:controllerbindingui`.
- **Inputs:** GP §4.12 (GQ11a–d), §4.13, §4.14, §9.7, §9.8, §10.
- **Builds:** the Now Playing restyle with T2 keys `data-lgs-np` from SteamVR's own strings; the binding UI restyle at ×1.87; the vrbind relay plugin and capsule (off).
- **Acceptance tests:** GP AT-NP, AT-NP-VARIANTS, AT-BIND, AT-T3, AT-T3-ROUTE, AT-BIND-RETURN (dry-run logger first), AT-HV; **PLAN-5b-1:** with `vrBindings` off, no capsule or link is rendered and `audit main` on a game page equals C5a's result.

#### C6a Steam Settings

- **Tiers:** T1–T4. **Size:** L.
- **Owns:**
  - `theme/60-settings.css`, `device/rt/60-settings.js`, `theme/layers/60-settings.json`;
  - `docs/phase2/concepts/settings.md`, `settings-accept.js`, `settings-pad.js`, `settings-sel.py`;
  - mockups: every `settings-*` file except `settings-steamvr*`, plus `settings.css`, `settings-shared.js`, `settings-icons.js`.
- **Routes:** the 24 `/settings/*` pages, `/settings/lgsvr` (new), Controller › Advanced.
- **Inputs:** SET §3, §4.1–§4.9, §4.11–§4.13, §5 to §9.4, §9.6, §10 to §12; CTL §13; §1.12 (list page), §1.16 (E-DRILL) here.
- **Builds:**
  - **T1:** the 400 px sidebar, 760 px platters, compact hero, magnifier circle, contextual ornament.
  - **T2:** `data-lgs-page` icons, the System badge, the inline title, destructive tags, section tags.
  - **T3:** the P-S1 wrapper (VR Settings page, drill-down slots); the list page for long value menus; Steam's Quick Access VR components (P-S2).
  - **T4:** the hero icon pop at +10 mm; menus per §1.7. SET's T-DEPTH is updated to the unified plan: menus +10, destructive alerts 0.
- **Acceptance tests:** SET T-ACC, T-ROWS, T-SEL, T-PAD, T-DRILL, T-AUD, T-CNT, T-HIT, T-MENU, T-DLG, T-SHOT, T-MOT, T-DEPTH, T-STORE-SEL, T-PERF, T-FONT, T-A11Y, T-I18N, T-T3; P-S1, P-S2, P-S4.

#### C6b SteamVR Settings

- **Tiers:** T1, T2. **Size:** M.
- **Owns:** `theme/vr/30-settings.css`, `theme/vr/pre/settings_mock.js`, `theme/vr/pre/settings_open.js`, `device/vr/systemui.settings.js`, `docs/phase2/mockups/settings-steamvr.html`, `settings-steamvr-playarea.html`.
- **Surface:** `vr:systemui` (frame page `system.settings`).
- **Inputs:** SET §4.10, §4.12, §9.5, T-VR group, P-S3, P-S5, P-S6.
- **Builds:** the footprint inset to 1858 × 952; the sidebar; the Back circle (`SwitchToPage`); Off/On pairs as switches; the Advanced ornament; the modal fit rule.
- **Acceptance tests:** SET T-VR, T-VR-FOOT, T-VR-SW, T-VR-MODAL, T-VR-EXIT; P-S3, P-S5, P-S6; CTL C18.

#### C7 People, Photos, Downloads, Store

- **Tiers:** T1–T4. **Size:** L.
- **Owns:** `theme/70-social.css`, `device/rt/70-social.js`, `theme/layers/70-social.json`, `docs/phase2/concepts/social-media.md`, every `social-media-*` mockup, `social-media.css`, `social-media.js`.
- **Routes:** `/chat`, `/account`, `/invites`, `/media/*`, `/library/downloads`, `/steamweb`, `/externalweb`.
- **Inputs:** SM §3.0–§3.10, §3.12, §4, §5, §6, §7, §8, §9; §1.10, §1.11 here.
- **Builds:**
  - **T1:** People split view, account column, the `/invites` card (windowless with a plate), Photos, viewer, clip player, Downloads, the store ornament.
  - **T2:** segment labels, the current-conversation pill, the compose placeholder, More hosts registered with C1a's helper, the store bounds refresh.
  - **T3:** the media segmented control; lab fixtures through P2's lab route.
  - **T4:** pops per SM §4.2, at +10 instead of +12 (§1.7).
  - **Migration:** the Power menu rules leave `70-social.css` (C1c owns them).
- **Acceptance tests:** SM G1 to G9 (G9 with the §1.7 rules), the per-screen tests of §8.2, the fixtures F-INV, F-CHAT, F-DL, F-FAV, S-P.

### 2.5 Verification and integration (V)

The verification and integration package has two parts that run side by side.

#### V1 Native gate and integration

- **Owns:** `device/defaults.json` (new), `README.md`, `docs/LAB.md`, `docs/NATIVE.md`, `docs/DESIGN.md`, `docs/coverage/**`, `docs/inventory/**` (errata only), `docs/phase2/wp/V1.md`.
- **Builds:**
  - the native gate (§4.3) and the flip of `native` to on, or a recorded fail with the reason;
  - the `defaults.json` flags of §1.17 as their gates pass;
  - documentation (§6).
- **Acceptance:** §4.3 and the release checklist (§4.6).

#### V2 Verification suite and conformance

- **Owns:** `docs/phase2/verify/**` (reports, `functions.csv`, `strings.md`, `REPORT.md`).
- **Builds:**
  - the global gate runs over the route matrix (§4.2) in four states (CSS-only and native, laser and gamepad);
  - the VP conformance run (P-01 to P-89);
  - the function ledger;
  - mockup comparisons;
  - the final report.
- **Acceptance:** `REPORT.md` with PASS / FAIL per gate per route, per P-item and per function, and the list of wearer-only items (§5.3).

### 2.6 File ownership index

Every file has exactly one owner. A file that is not listed is owned by the coordinator. These inputs are frozen and change only by coordinator decision:

- `docs/phase2/audit/**`, `docs/phase2/research/**` (except `springs.py`, which is P5's), `docs/phase2/capabilities/**` (except `cc-focus.md`, which is C3b's), `docs/refs/**`;
- every `shots/p2_*` file from Phase 2 so far.

A package creates new files only inside its listed patterns.

| Path | Owner |
|---|---|
| `README.md` | V1 |
| `glass.py` | P10 |
| `lab/**` | P10 |
| `tools/mockshot.py` | P10 |
| `tools/p2/**` | P10 |
| `device/lgs.py` | P1 |
| `device/lgs_core.js` | P1 |
| `device/lgs_index.js` | P1 |
| `device/lgs` | P1 |
| `device/glass-shell.desktop` | P1 |
| `device/icon.png` | P1 |
| `device/defaults.json` | V1 |
| `device/rt/00-rt.js` | P1 |
| `device/rt/02-react.js` | P2 |
| `device/rt/03-react-lab.js` | P2 |
| `device/rt/04-input.js` | P3 |
| `device/rt/05-attention.js` | P3 |
| `device/rt/06-states.js` | P3 |
| `device/rt/07-tooltip.js` | P3 |
| `device/rt/08-popups.js` | P6 |
| `device/rt/10-controls.js` | C4a |
| `device/rt/20-shell.js` | C1a |
| `device/rt/20-more.js` | C1a |
| `device/rt/20-pointer.js` | C1a |
| `device/rt/21-search.js` | C1b |
| `device/rt/22-menus.js` | C1c |
| `device/rt/30-bar.js` | C3a |
| `device/rt/31-cc.js` | C3b |
| `device/rt/32-launcher.js` | C2b |
| `device/rt/35-hud.js` | C3a |
| `device/rt/36-keyboard.js` | C4b |
| `device/rt/40-library.js` | C2c |
| `device/rt/41-home.js` | C2a |
| `device/rt/41-search-apps.js` | C2a |
| `device/rt/50-gamepage.js` | C5a |
| `device/rt/52-vrbind.js` | C5b |
| `device/rt/60-settings.js` | C6a |
| `device/rt/70-social.js` | C7 |
| `device/shared/motion.js` | P5 |
| `device/lgs_layers.js` | P6 |
| `device/lgs_sg.js` | P7 |
| `device/lgs_shell.py` | P8 |
| `device/lgs_vr.py` | P8 |
| `device/lgs_vr_core.js` | P8 |
| `device/lgs_lens.js` | P4 |
| `device/shell_ext/__init__.py` | P8 |
| `device/shell_ext/vrbind.py` | C5b |
| `device/vr/systemui.nowplaying.js` | C5b |
| `device/vr/systemui.settings.js` | C6b |
| `device/proto/react_proto.js` | P2 |
| `device/proto/input_mode.js` | P3 |
| `theme/00-tokens.nowrap.css` | P4 |
| `theme/01-font.nowrap.css` | P4 |
| `theme/02-motion.nowrap.css` | P5 |
| `theme/03-material.css` | P4 |
| `theme/04-states.css` | P4 |
| `theme/05-native.css` | P6 |
| `theme/10-primitives.css` | C4a |
| `theme/20-shell.css` | C1a |
| `theme/21-search.css` | C1b |
| `theme/22-presentations.css` | C1c |
| `theme/23-transitions.css` | C1c |
| `theme/30-bar.css` | C3a |
| `theme/31-cc.css` | C3b |
| `theme/32-launcher.css` | C2b |
| `theme/35-hud.css` | C3a |
| `theme/36-keyboard.css` | C4b |
| `theme/40-library.css` | C2c |
| `theme/41-home.css` | C2a |
| `theme/50-appdetails.css` | C5a |
| `theme/60-settings.css` | C6a |
| `theme/70-social.css` | C7 |
| `theme/fonts/**` | P4 |
| `theme/layers.json` | P6 (retired) |
| `theme/layers/00-base.json` | P6 |
| `theme/layers/99-legacy.json` | P6 (temporary) |
| `theme/layers/20-shell.json` | C1a |
| `theme/layers/22-presentations.json` | C1c |
| `theme/layers/30-bar.json` | C3a |
| `theme/layers/31-cc.json` | C3b |
| `theme/layers/36-keyboard.json` | C4b |
| `theme/layers/40-library.json` | C2c |
| `theme/layers/41-home.json` | C2a |
| `theme/layers/50-gamepage.json` | C5a |
| `theme/layers/60-settings.json` | C6a |
| `theme/layers/70-social.json` | C7 |
| `theme/popups/00-base.json` | P6 |
| `theme/popups/20-shell.json` | C1a |
| `theme/popups/30-bar.json` | C3a |
| `theme/popups/32-launcher.json` | C2b |
| `theme/sg/00-base.json` | P7 |
| `theme/sg/20-winbar.json` | C1a |
| `theme/vr/00-vr-tokens.css` | P4 |
| `theme/vr/10-systemui.css` | C1a |
| `theme/vr/20-nowplaying.css` | C5b |
| `theme/vr/30-settings.css` | C6b |
| `theme/vr/40-bindings.css` | C5b |
| `theme/vr/50-keyboard.css` | C4b |
| `theme/vr/60-overlays.css` | C3a |
| `theme/vr/pre/audit_inpage.js` | C1a |
| `theme/vr/pre/panel_sizes.js` | C1a |
| `theme/vr/pre/sys_hover.js` | C1a |
| `theme/vr/pre/sys_zoo.js` | C3a |
| `theme/vr/pre/kb_states.js` | C4b |
| `theme/vr/pre/np_states.js` | C5b |
| `theme/vr/pre/bind_hover.js` | C5b |
| `theme/vr/pre/settings_mock.js` | C6b |
| `theme/vr/pre/settings_open.js` | C6b |
| `native/glassd/**` | P9 |
| `native/shared/motion_tokens.h` | P5 |
| `native/spike/fakeglassd.cpp` | P9 |
| `native/spike/hvgrab.cpp` | P10 |
| `native/spike/**` (all other files) | P7 |
| `docs/DESIGN.md` | V1 |
| `docs/LAB.md` | V1 |
| `docs/NATIVE.md` | V1 |
| `docs/coverage/**` | V1 |
| `docs/inventory/**` | V1 (errata only) |
| `docs/phase2/PLAN.md` | Coordinator |
| `docs/phase2/wp/coordinator.md` (decision log and the coordinator's requests) | Coordinator |
| `docs/phase2/DESIGN2.md` | P4 |
| `docs/phase2/fontkit.py` | P4 |
| `docs/phase2/glassd-material.md` | P9 |
| `docs/phase2/research/springs.py` | P5 |
| `docs/phase2/capabilities/cc-focus.md` | C3b |
| `docs/phase2/contracts/runtime.md` | P1 |
| `docs/phase2/contracts/react.md` | P2 |
| `docs/phase2/contracts/interaction.md` | P3 |
| `docs/phase2/contracts/tokens.md` | P4 |
| `docs/phase2/contracts/motion.md` | P5 |
| `docs/phase2/contracts/reporter.md` | P6 |
| `docs/phase2/contracts/sg.md` | P7 |
| `docs/phase2/contracts/daemon.md` | P8 |
| `docs/phase2/contracts/glassd.md` | P9 |
| `docs/phase2/contracts/lab.md` | P10 |
| `docs/phase2/wp/<ID>.md`, `docs/phase2/wp/<ID>-cmp.json` | That package |
| `docs/phase2/verify/**` | V2 |
| `docs/phase2/concepts/window-nav.md`, `window-nav-measure.py` | C1a |
| `docs/phase2/concepts/home-apps.md`, `xc-home-search.md` | C2a |
| `docs/phase2/concepts/control-center.md`, `control-center-mockaudit.py` | C3b |
| `docs/phase2/concepts/controls.md`, `controls-probe.js` | C4a |
| `docs/phase2/concepts/game-pages.md`, `game-pages-locgrep.sh`, `game-pages-probe.js` | C5a |
| `docs/phase2/concepts/settings.md`, `settings-accept.js`, `settings-pad.js`, `settings-sel.py` | C6a |
| `docs/phase2/concepts/social-media.md` | C7 |
| `docs/phase2/mockups/kit.css`, `kit.js`, `_example.html` | P4 |
| `docs/phase2/mockups/assets/LICENSE.md`, `room-lounge.jpg`, `room-studio.jpg` | P4 |
| `docs/phase2/mockups/assets/hero-bright.jpg`, `logo-bright.png` | C5a |
| `docs/phase2/mockups/window-nav-shared.css`, `window-nav-shared.js` | C1a |
| `docs/phase2/mockups/window-nav-anatomy.html`, `-anatomy-t1.html`, `-anatomy-depth.html`, `-tabbar.html`, `-tabbar-r863.html`, `-ornament.html`, `-chrome.html` | C1a |
| `docs/phase2/mockups/window-nav-search.html`, `-results.html` | C1b |
| `docs/phase2/mockups/window-nav-menu.html`, `-sort.html`, `-power.html`, `-alert.html`, `-sheet.html`, `-motion.html` | C1c |
| `docs/phase2/mockups/window-nav-toast.html` | C3a |
| `docs/phase2/mockups/home-apps-home.html`, `-home-t1.html`, `-apps.html`, `-collections.html`, `-folder.html`, `-depth.html`, `-search.html`, `home-apps.css`, `home-apps.js`, `home-apps-icons.js` | C2a |
| `docs/phase2/mockups/home-apps-plus.html`, `-plus-t1.html` | C2b |
| `docs/phase2/mockups/home-apps-library.html`, `-library-pad.html`, `-filter.html`, `fetch-library-refs.py` | C2c |
| `docs/phase2/mockups/control-center-bar.html`, `-hud.html` | C3a |
| `docs/phase2/mockups/control-center-*` (all others), `control-center.css`, `control-center-build.js`, `control-center-icons.js` | C3b |
| `docs/phase2/mockups/controls-keyboard*.html`, `controls-keyboard.js` | C4b |
| `docs/phase2/mockups/controls-*` (all others), `controls.css` | C4a |
| `docs/phase2/mockups/game-pages-nowplaying*.html`, `game-pages-bindings*.html` | C5b |
| `docs/phase2/mockups/game-pages-*` (all others), `game-pages.css`, `game-pages.js`, `make-bright-hero.py`, `legibility-check.py` | C5a |
| `docs/phase2/mockups/settings-steamvr*.html` | C6b |
| `docs/phase2/mockups/settings-*` (all others), `settings.css`, `settings-shared.js`, `settings-icons.js` | C6a |
| `docs/phase2/mockups/social-media-*`, `social-media.css`, `social-media.js` | C7 |

**Cross-file requests.** When package X needs a change in a file owned by Y (for example C2b needs the "+" popup rules removed from `30-bar.css`), X writes the request in `docs/phase2/wp/X.md` under "Requests". Y makes the change and answers there. The coordinator checks open requests at every sync point.

---

## 3. Schedule and dependencies

### 3.1 Waves

| Wave | Starts when | Packages (agents) | Ends with |
|---|---|---|---|
| A: platform | Now | P1, P2, P3, P4, P5, P6, P7, P8, P9, P10 (10) | M1 contracts in the first session; then M2 |
| A′: shared context | P4 M1 (tokens and states CSS) | C1a, C1c, C4a, C2a (4; up to 14 agents in all) | M0 at once, then M2 |
| B: contexts | P1, P2, P3 M3 for T2/T3 work; T1 work can start earlier | C1b, C2b, C2c, C3a, C3b, C4b, C5a, C5b, C6a, C6b, C7 (11). Agents freed by wave A join here; at most 20 run at once | M3, then M4 once P6, P8 and P9 reach M2 |
| C: verification | V2's harness with P10 in wave A; V1 when P6–P9 reach M2 and C1a reaches M4 | V1, V2 (2) | §4.6 checklist |

**Suggested staffing for 16 agents:**

1. Wave A takes ten agents.
2. Four agents start A′ once P4's tokens land (a few hours).
3. As P5, P1, P3 and P10 finish (the smaller packages), their agents take C4b, C3a, C6b and C5b.
4. The wave A agents with deep context continue into the matching context packages: P2 → C3b, P9 → C2a's native work if needed, P6 → C1c.

### 3.2 Critical path

```
P4 tokens ──► C1a window, toolbar (CQ1), ornament ──► C2c, C5a, C6a, C7 layouts
P1 ─► P2 React ───────────────► C2a Home, C3b CC-M, C6a drill-down, C1b search
P1 ─► P3 attention ──────────► C2a ramp, More circle, tooltips
P5 ─► P7 depth channel ┐
P9 G1 plates ──────────┼─► P8 v3 spec ─► P6 plates ─► C2a, C3b, C7 native ─► V1 native gate ─► V2 sweep
P9 G2 holes ───────────┘                                          └─► C5a over-art depth
```

The two longest chains:

- **Plates:** P9 G1 → P8 → P6 → C2a native → V1. Mitigation: C2a ships CSS plates first (HA §10.5), so Home is never blocked on glassd.
- **CQ1** (C1a). Mitigation: every area uses only the `lgs-hdr-108` / `lgs-hdr-40` classes, so both outcomes work.

### 3.3 Sync points

The coordinator runs a sync point after each wave's milestone:

1. Pull every package's evidence log.
2. Resolve cross-file requests.
3. Run `python glass.py check-theme` and `glass.py gates main --route /library/home` as a smoke test.
4. Commit.

Packages never wait on a commit to continue. They read each other's contracts from the working tree.

---

## 4. Verification and integration

### 4.1 Global gates

Every context package runs these gates on its routes (§4.2). V2 reruns them for M5. Unless stated, each gate runs in both input modes (`--mode laser|pad`) and in both tiers (CSS-only, then native through `native-session`).

| Gate | What | Command | Pass |
|---|---|---|---|
| G-AUD | Functions kept | `glass.py audit SURF --route R [--pre P]` | GONE / HIDDEN / SHRUNK / UNCLICKABLE / CONTRAST = 0, apart from the exemptions of §1.16 |
| G-PAD | Gamepad traversal | `glass.py pad-bfs --route R` | Every focusable reached; Down-Up and Right-Left return (except at edges); B closes the topmost layer first; after a menu, sheet or alert closes, focus is on its source; on route entry focus is on the primary item (P-20 to P-24) |
| G-SIZE | Target sizes | `glass.py gates` (DOM sweep with `elementFromPoint` sampling, SM G2b method) | VP P-08, P-80, P-83, or the element's exemption |
| G-TYPE | Type | `gates` | No text under 18 px; no weight under 500; no uppercase, tracking or italics in chrome (P-38, P-84) |
| G-OUTLINE | No outlines | `gates` + `edge_profile.py` | P-42, P-43; edge ratio ≤ 0.35 on glass top edges |
| G-FOCUS | Focus and selection | `glass.py focus` | §1.4 criteria (P-14 to P-16, P-18, T-SEL) |
| G-MOTION | Motion | `glass.py motion` | Every duration and easing a token (P-58); nothing at rest (§1.5); filmstrips for the package's listed interactions show glass before content on entry, content before glass on exit, no text scaling, no closed outline in any frame; Reduce Motion fades only (P-56) |
| G-PERF | Performance | `glass.py perf SURF --route R` | Themed fps within 5 % of stock; no new frames over 34 ms, both read as R2-13's statistic (ABBA × 2: median fps ratio ≥ 0.95; median extra long frames ≤ stock's A/A spread, min 1; CSS-only verdicts pool only `native=off` runs) [R2-13]. Native: glassd median ≤ 2.5 ms (`glassd-out.json`) |
| G-DEPTH | Depth (native) | `glass.py sgcheck` | §1.7 admission rules; ≤ 4 distinct dz at rest; every crop `interactive: false` in the default profile; every lift has its shadow (P-48) |
| G-HV | Headset view (native) | `glass.py hv NAME` and `--offaxis` (look, then delete) | No doubled element; glass L 55–110; no closed outline; labels legible |
| G-MOCK | Looks like the design | `glass.py cmp` against the package's mockups | Named rects within ±8 px, or the difference explained in the evidence log; the agent views both images and records a verdict |
| G-REMOVE | Nothing persists | `lgs off`, then `outline` + `status` | Stock DOM; no `data-lgs-*`; no route patches; no scene-graph nodes; flags file cleared |
| G-A11Y | Accessibility | `--media reduce`, `--media contrast` | Fades only; near-opaque glass with the 2 px edge; contrast clean |
| G-FONT | Font | `document.fonts.check` on each surface | True |

### 4.2 Route matrix

V2 runs every row in the four states. The owner fixes failures.

| Route or surface | Owner | Glass mode | States to capture | Mockups |
|---|---|---|---|---|
| `/library/home` (Recent, Collections, Apps) | C2a | windowless | Rest, focus on a cell, card open, section change | `home-apps-home`, `-apps`, `-collections`, `-home-t1`, `-depth` |
| `/library/lgs/folder/<id>` | C2a | windowless | Rest, focus | `home-apps-folder` |
| `/library/lgs/steamhome` | C2a | window-full | Rest, focus on a shelf card | (Steam's page, restyled) |
| `/library/tab/AllGames`, `/library/collection/*`, Sort, tile menu, Filters | C2c (+C1c menus) | window | Laser and gamepad ornament; menus open; sheet open | `home-apps-library`, `-library-pad`, `-filter` |
| `/search`, `/search/tab/*` | C1b | window | Zero state, results for "half", a category | `window-nav-search`, `-results`, `home-apps-search` |
| CONFIRM, ALERT, MENU, SUBMENU, POWER, ZOO dialogs | C1c | — | Each open | `window-nav-menu`, `-sort`, `-power`, `-alert`, `-sheet` |
| `/library/app/:appid` (title, details, running), achievements, Properties, controller page | C5a | hero / window | GP's state list | `game-pages-*` |
| `/settings/*` (25 routes and sub-views) | C6a | window | Root and sub-views, dropdown, list page, dialog | `settings-*` |
| `/chat`, `/account`, `/invites`, `/media/*`, `/library/downloads`, `/steamweb` | C7 | window / window-full / windowless | SM §8.2 list | `social-media-*` |
| `/zoo/*` | C4a | window | State matrix | `controls-*` |
| CC-M open | C3b | windowless | Rest, gamepad, More Controls, notification list | `control-center-overview`, `-gamepad`, `-more`, `-notifications` |
| `bar`, bar popups, Quick Access (CC-C) | C3a, C3b | — | Rest, hover, focus, open | `control-center-bar`, `-fallback` |
| "+" popup | C2b | — | T1, T3 | `home-apps-plus`, `-plus-t1` |
| `frame.menu`, `floatingfooter` | C1a | — | Collapsed, expanded with gamepad focus | `window-nav-tabbar` |
| `tooltip`, `volumelevel`, `notifications` | C3a | — | Mock recipes (inventory `hud.md`) | `control-center-hud`, `window-nav-toast` |
| `keyboard`, `vr:keyboard` | C4b | — | Shown, echo, masked | `controls-keyboard*` |
| `vr:systemui` window-bar row | C1a | — | Hover, focus, tooltip | `window-nav-chrome` |
| `vr:systemui` Now Playing | C5b | — | Variants (needs the showcase running, LAB.md) | `game-pages-nowplaying*` |
| `vr:systemui` SteamVR Settings | C6b | — | Each section | `settings-steamvr*` |
| `vr:controllerbindingui` | C5b | — | List, view | `game-pages-bindings*` |

### 4.3 The native gate (V1)

The brief asks for full glass, which only glassd can draw over the room. NATIVE.md keeps native mode opt-in until a wearer checks input, the cursor dot and resizing. Since the user is unavailable, V1 replaces each wearer check with an agent check (WN §8.3) and adds the Phase 2 checks. All steps run in one `native-session`.

| Id | Check | Pass |
|---|---|---|
| AT-0a | Pass-through: `DumpLaserOverlays` with `lgs on --native` | Every glassd cover, plate, slab and base piece is under `skippingDueToNonInteractivity`; the main, frame-menu and bar targets have the same size as in CSS-only mode |
| AT-0b | Pointer proxy (WN AT-0b) | The ring is found in CDP shots and in an `hv` frame over the cover |
| AT-0c | Alignment, flags, cost (WN AT-0c) | At r = 0.863: cover and crop edges within 3 view px of Steam's content; no mosaic hairlines; the cover flag sets change nothing visible; glassd median ≤ 2.5 ms; compositor frame time within 5 % of CSS-only |
| AT-0d | Ghost and click-safe rules on every route of §4.2 | `sgcheck` clean |
| AT-0e | Materialize | Covers and plates ramp with GM §5 curves; no doubled content while the window cover's `m` < 0.3 (covers animate only while the dashboard opens) |
| AT-0f | Return to CSS | `lgs on --css` removes every node within 1 s and `lgs-native` within 3 s |

**Decision.**

- If AT-0a to AT-0f pass, V1 sets `native: on` in `defaults.json`. `lgs on` and the "+" toggle then start native mode. The unit stays transient: nothing survives `lgs off`, a Steam restart or a reboot.
- If any check fails, V1 records it, CSS-only ships with the degraded spec (WN §8.4), and `REPORT.md` states plainly that real glass needs native mode.

### 4.4 Conformance (VP §6)

- V2 runs `glass.py conformance` for every automatable P-item and records manual verdicts for the REV and MOCK items in `docs/phase2/verify/conformance.md`.
- Every "must" item passes, or carries a recorded deviation from §1. The known deviations:
  - P-11, the pointer proxy (S16);
  - P-37, a second capsule on the tab bar's edge (WN's two groups are one Steam popup; moving Settings or Power out would hide Steam's nodes);
  - **P-65**, an outside click still cancels alerts and sheets: Steam's `ModalClickToDismiss`, kept as stock. It only ever cancels, and it is the only laser dismiss of a sheet without its own button when the runtime is off (S30) [R2-6];
  - **P-67**, alerts and Power keep Steam's default focus (S6) [R2-6].
- **Scoring rule for P-23** [R2-11]: after A1 moved the ornament to 628, the bottom bound is **612** (628 − 16) on routes with a bottom ornament, and the glass bottom − 16 without one; the top bound stays 124. VP's "620" is read as 612.

### 4.5 Function ledger

1. `glass.py ledger` merges every concept's retention table into `docs/phase2/verify/functions.csv`, with the columns: audit id, function, concept, owner package, laser path, gamepad path, test id, status.
2. Pass: every function in the audits' §A lists (SN, LA, GP, SY, SM) appears at least once, with both paths, and either a passing test or, for actions tests never perform, a static check that the handler is Steam's own (the P2 action logger or a spy).
3. The concepts map 59 (HA), 83 (CC) and 93 (SM) functions, plus the WN, CTL, GP and SET tables. Duplicates across concepts are merged by audit id.
4. **T3 actions** [R2-9]: a function whose path runs through `rt.react.actions` (Home and "+" launches, the game page's Play, Search's Open, launcher rows) counts as kept only when V2's shipped-state check reads `live` (§4.6 item 9). Until then its row is `partial`, whatever its test says.

### 4.6 Release checklist (V1 with V2)

1. Every package at M5, with its evidence log.
2. `REPORT.md`: all global gates PASS on the route matrix in the shipped state.
3. The native gate decided and recorded.
4. `defaults.json` holds only flags whose gates passed.
5. G-REMOVE on every surface. A Steam restart, only if another agent restarted Steam, shows the stock UI (CC A24); never restart Steam for this.
6. The `README.md`, `LAB.md` and `NATIVE.md` updates (§6) done.
7. Phase 1 aliases and `99-legacy.json` removed (§6).
8. The wearer-only list (§5.3) included in `REPORT.md` for the user.
9. **T3 actions live** [R2-9]: `defaults.json` has `"actionsLive": true` (S26), set only after RX-7 (with its gamepad phase), HA AT-4 and AT-13 pass on the release build. V2's shipped-state run (shipped `defaults.json`, no `--flags`) shows `rt.react.actions.mode()` with `reasons` exactly `['runtime action logger on']` (the lab step's own logger), and `mode(ev)` for Steam's programmatic click (`PointerEvent('click')`, `pointerType ''`) adds no other reason. Any other reason fails the release.

---

## 5. Risks and fallbacks

### 5.1 Technical risks

| # | Risk | How it is detected | Fallback | Owner |
|---|---|---|---|---|
| R1 | A Steam update breaks a finder or a fiber patch | P2's fail-closed `install()`; RX-5; `lgs status` | That feature drops to its T1 form; the CSS theme stays | P2, each context |
| R2 | React-private internals change (fiber `type`, `alternate`) | RX-1 on every Steam build | T1 only for T3 features | P2 |
| R3 | The 108 px header (CQ1) fails | WN AT-2 | The three-rule fallback; areas key on `lgs-hdr-40` | C1a |
| R4 | Clicks on interactive crops cannot be verified | — (needs a wearer) | The default profile is non-interactive | P6, P7 |
| R5 | The laser on transparent texels (Home, CC-M gaps, `/invites`) | Needs a wearer | Harmless: a hit on empty page area does nothing; every view has explicit close paths | C2a, C3b, C7 |
| R6 | SteamVR's laser dot hidden behind covers | Needs a wearer | The pointer proxy in native mode | C1a |
| R7 | The native gate fails | AT-0a–f | CSS-only with the degraded spec, stated in the report | V1 |
| R8 | glassd cost with plates exceeds 2.5 ms | GL-3, G-PERF | Plates drawn in the quarter-resolution interior pass; drop slabs on the main window while the keyboard is open; CSS plates on Home | P9 |
| R9 | `t1` tint behaves differently from §1.8's inference | SG-5 | **Happened** (SG-5, 2026-10-07: `t1` dims pops too). §1.8 never relied on it and is amended [R2-4]: in-window modals use the CSS scrim; CC-A uses `window.dim 0.6` alone; a dim behind a bright pop uses the surface `dim` (cover and base wrappers) | P7 |
| R10 | Shared device: other agents change routes, theme or native mode between steps | Status checks in every step | Atomic locked steps; `native.lock`; flags only inside a step | All |
| R11 | `data:` font blocked by CSP somewhere, or bundle memory too high | FD-2 | Steam's font stack on that surface; drop `opsz` (−42 KB) | P4 |
| R12 | Honeycomb neighbours misbehave | HA AT-3 | 5 × 3 square lattice with `flow-children: grid` | C2a |
| R13 | Moved menus stop dismissing on an outside click | WN AT-11, GP AT-MENU, SET CQ10 | Centred menus | C1c |
| R14 | A stale `.gpfocus` under the laser paints a focus look | P-02 CSS audit (V2) | Laser looks key on `:hover` only (§1.4) | P4 |
| R15 | Hero art decode cost on Home | HA AT-11 | Heroes only for the visible page; portraits for peeks | C2a |
| R16 | Decisions taken without the user turn out wrong | §1.17 register | Every one has a flag; defaults are the conservative option | V1 |
| R17 | A broken file synced by one package breaks everyone | `check-theme`; the runtime's fail-closed loader | `_wip/` folders; per-module isolation | P1 |
| R18 | Inter at 1.5× sizes truncates labels | G-TYPE + visual pass | Ellipsis rules; Callout 22 px for dense text; compact ornament members | Each context |
| R19 | Removal leaves state behind (TTL failures, patched fibers) | G-REMOVE, RT-4 | TTLs in the page; the 12 s scene-graph watchdog; `lgs off` cleanup report | P1, P7 |
| R20 | The room behind the window is never captured, so the glass is flat | `hv` look | GM v2 row fill; shots right after the dashboard hides (GM §3.3) | P9 |
| R21 | The vrbind relay disturbs SteamVR pages | AT-BIND-RETURN dry run | Flag off by default (S13) | C5b |
| R22 | Plates exceed 24 layers per surface (Home with peeks and card) | RP-2, GL-1 | Peeks stay CSS only; the mosaic in 4 bands (HA §10.2) | C2a, P6 |
| R23 | The "+" popup patch fails | HA AT-12 | The T1 grid in Steam's scan order; the green pip on Liquid Glass | C2b |
| R24 | CC-M's modal container unmounts the page | CC A7, CC11 | The route container `/library/lgs/cc` | C3b |

### 5.2 Fallback ladder for the whole product

1. **Full:** native glass, T1–T5, default depth profile.
2. **No glassd** (gate failed or glassd down): CSS-only T1–T3. Same layouts, same controls, tinted glass, no depth.
3. **No runtime** (loader or finders failed): Phase 2 CSS only. Layouts that need T3 fall back as each concept specifies (Steam's Home, Steam's search page, Steam's Quick Access).
4. **Theme off:** stock Steam. `lgs off`, a Steam restart or a reboot.

### 5.3 Questions only a wearer can close

None of these blocks the default build. V2 lists them in `REPORT.md` for the user.

1. A real click on an in-place interactive crop at a steep angle (SP §12). This unlocks the wearer profile (S2).
2. SteamVR's laser dot over covers and plates. This could retire the pointer proxy (S16).
3. Laser hits on transparent texels (R5).
4. Comfort of the depths and of the head-locked HUD placement (S21).
5. Haptics (S17).
6. Gamepad focus entering an always-visible frame menu from the window (SP §12, WN AT-8 covers it with `L.pad`, but not the SteamVR overlay focus hand-off).
7. Resized windows keep crops aligned at 0.5× and 1.5× (NAT).

---

## 6. Phase 1 migration and retirement

**Rules.**

- Phase 1 area files are rewritten in place by their new owners, so the bundle order stays.
- Rules move between files only by the two-step request (§2.6): the receiving package adds the rules, then the giving package deletes them.
- Until both steps are done, the old rules win by name order, so nothing breaks in between.

| Phase 1 file | Fate | By | Notes |
|---|---|---|---|
| `theme/00-tokens.nowrap.css` | Rewritten to D2 §16 + §1 | P4 | Phase 1 names (`--lgs-spring`, `--lgs-window-rim`, …) kept as aliases until every area reaches M2, then removed. Motion tokens move to `02-motion.nowrap.css` (P5) |
| `theme/05-native.css` | Rewritten (plates, acks, modes) | P6 | — |
| `theme/10-primitives.css` | Rewritten (CTL) | C4a | Context-menu and modal sections → `22-presentations.css` (C1c) |
| `theme/20-shell.css` | Rewritten (WN chrome) | C1a | Page transitions → `23-transitions.css` (C1c); search-route rules → `21-search.css` (C1b); frame-menu rules come in from `30-bar.css` |
| `theme/30-bar.css` | Rewritten (CC bar) | C3a | Frame-menu rules → `20-shell.css` (C1a); "+" popup rules → `32-launcher.css` (C2b); Quick Access rules → `31-cc.css` (C3b) |
| `theme/35-hud.css` | Rewritten (toasts, volume, tooltip, footer look) | C3a | Keyboard sections → `36-keyboard.css` (C4b) |
| `theme/40-library.css` | Rewritten (catalogue) | C2c | Home shelf and feed rules → `41-home.css` (C2a); search results → `21-search.css` (C1b) |
| `theme/50-appdetails.css` | Rewritten (GP) | C5a | — |
| `theme/60-settings.css` | Rewritten (SET) | C6a | — |
| `theme/70-social.css` | Rewritten (SM) | C7 | Power menu rules → `22-presentations.css` (C1c) |
| `theme/vr/10-systemui.css` | Rewritten (window-bar row) | C1a | §0 shared values → `vr/00-vr-tokens.css` (P4) |
| `theme/vr/20-nowplaying.css`, `40-bindings.css` | Rewritten | C5b | — |
| `theme/vr/30-settings.css` | Rewritten | C6b | — |
| `theme/vr/50-keyboard.css` | Rewritten | C4b | — |
| `theme/vr/60-overlays.css` | Rewritten | C3a | — |
| `theme/layers.json` | Split into `theme/layers/00-base.json` + `99-legacy.json`, then retired | P6 | Areas supersede legacy rules by id; `99-legacy.json` is deleted when empty (release checklist step 7) |
| `device/lgs_layers.js`, `lgs_sg.js`, `lgs_shell.py`, `lgs_vr.py` | Extended (§2.3) | P6, P7, P8 | Behaviour and interfaces stay backward compatible until M2 |
| `device/proto/react_proto.js`, `input_mode.js` | Promoted into `device/rt/`, then deleted at M5 | P2, P3 | — |
| `device/lgs_lens.js` | Kept for E2 lensing on the 1–3 most important controls per page | P4 | Lens targets declared by areas through a class, not a shared file |
| `docs/DESIGN.md` | Banner: superseded by DESIGN2 and this plan. §8 guardrails stay, amended by the layout rules of D2 §12. §10 (ownership) replaced by §2.6 here | V1 | — |
| `docs/LAB.md` | Updated: Phase 2 layout rules (D2 §12) replace "never change position, width, flex"; `display: none` on Steam nodes stays forbidden except E-DRILL; T2/T3 rules (SR §7); the new commands (P10); flags, input stub, media emulation, `native.lock`; `hvgrab` hygiene | V1 | — |
| `docs/NATIVE.md` | Updated: points to `docs/phase2/contracts/*` and GM; layering with plates and holes; default mode per §4.3 | V1 | — |
| `docs/coverage/*.md` | Marked historical (Phase 1 evidence); replaced by `docs/phase2/verify/` | V1 | — |
| `docs/inventory/*.md` | Kept as the DOM reference; errata added by V1 (for example: the friends list is not virtualized, SM-D9) | V1 | — |
| `native/spike/*` | Kept: `hvgrab`, `fakeglassd`, `sg_timeline.py` are test tools | P7, P9, P10 | — |
| `shots/` (Phase 1) | Kept as the before-shots; not regenerated | — | — |

---

## 7. Team rules on the shared device

1. **Locks.**
   - Use only the locked lab commands (LAB.md).
   - Native work runs only inside `glass.py native-session`, which holds `/tmp/lgs/native.lock`.
   - Never leave native mode or a flag on after a step.
2. **Start of every step.** Gamepad sequences call `FocusApplicationRoot()` first (SR §4, `vr-null-tree`). After a synthetic hover, send the pointer to (1400, 900) to clear `:hover` and bar tooltips (IM §9).
3. **Room frames.** `hvgrab` frames and live glassd dumps show the room. `glass.py hv` deletes them; never copy one elsewhere. Procedural-room dumps (`--test-backdrop`) may be kept.
4. **Never-list** (§2.1), including: no real A, B, X or Y on Steam's own controls that act; spies and the action logger instead.
5. **Privacy.** Live shots of `/chat`, `/account` and `/invites` contain personal names. Look at them; never quote the names in documents.
6. **Commits.** Agents never commit. The coordinator commits at sync points.
7. **Evidence.** Every claim of PASS in an evidence log names the command, the shot or JSON it produced, the date and the Steam build (`11094443` at the time of writing). A Steam update invalidates T3 results until RX-1 passes again.
